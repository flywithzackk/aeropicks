import { getUserFromContext, unauthorized, json, stores } from './_shared.js';

// Placement bet model:
//   bet = { pilotId, place, points, odds }
// Member can have multiple bets per pilot (one per place predicted), but each unique
// (pilotId+place) is one bet. Re-submitting overrides.
//
// Wildcard: a free guess. { pilotId } or { value } depending on wildcard type.

export default async (req, context) => {
  const user = getUserFromContext(context);
  if (!user) return unauthorized();

  const betsStore = stores.bets();
  const compStore = stores.competitions();

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const competitionId = url.searchParams.get('competitionId');
    const key = `${user.id}`;
    const userBets = (await betsStore.get(key, { type: 'json' })) || {};

    if (competitionId) {
      const data = userBets[competitionId] || { bets: [], wildcard: null, balance: 1000 };
      return json(data);
    }

    // Return all bets across competitions, enriched
    const result = [];
    for (const [compId, compData] of Object.entries(userBets)) {
      const comp = await compStore.get(compId, { type: 'json' });
      if (!comp) continue;
      for (const b of (compData.bets || [])) {
        const competitor = comp.competitors?.find(c => c.id === b.pilotId);
        if (!competitor) continue;
        result.push({
          competitionId: compId,
          competitionName: comp.name,
          pilotName: competitor.name,
          pilotPhoto: competitor.photo,
          balloon: competitor.balloon,
          place: b.place,
          points: b.points,
          odds: b.odds,
          status: b.status || 'pending',
          payout: b.payout || 0,
        });
      }
    }
    return json({ bets: result });
  }

  if (req.method === 'POST') {
    const body = await req.json();
    const { competitionId, bets, wildcard } = body;
    const comp = await compStore.get(competitionId, { type: 'json' });
    if (!comp) return json({ error: 'competition not found' }, 404);
    if (comp.status === 'locked') return json({ error: 'betting is locked for this competition' }, 400);
    if (comp.status === 'settled') return json({ error: 'competition already settled' }, 400);
    if (comp.status === 'draft') return json({ error: 'competition not open' }, 400);

    // Validate: each bet has pilotId + place + points + odds
    const cleanBets = [];
    let total = 0;
    for (const b of (bets || [])) {
      const points = Math.max(0, Math.floor(Number(b.points) || 0));
      const place = Math.max(1, Math.floor(Number(b.place) || 0));
      if (points <= 0) continue;
      const pilot = comp.competitors.find(c => c.id === b.pilotId);
      if (!pilot) continue;
      // Use override if set, otherwise algorithm odds
      const odds = pilot.overrideOdds?.[place] ?? pilot.oddsByPlace?.[place] ?? 0;
      if (odds <= 0) continue;
      cleanBets.push({ pilotId: b.pilotId, place, points, odds, status: 'pending' });
      total += points;
    }

    if (total > 1000) {
      return json({ error: `Total wagered (${total}) exceeds 1000 point stake` }, 400);
    }

    // Wildcard is free - separate from points
    let cleanWildcard = null;
    if (wildcard && comp.wildcard) {
      cleanWildcard = {
        type: comp.wildcard.type,
        value: wildcard.value, // pilotId, place number, or whatever the wildcard asks
        status: 'pending',
        payout: 0,
      };
    }

    const key = `${user.id}`;
    const allBets = (await betsStore.get(key, { type: 'json' })) || {};
    allBets[competitionId] = {
      bets: cleanBets,
      wildcard: cleanWildcard,
      remaining: 1000 - total,
      placedAt: Date.now(),
    };
    await betsStore.setJSON(key, allBets);

    return json({ ok: true, total, remaining: 1000 - total });
  }

  return json({ error: 'method not allowed' }, 405);
};
