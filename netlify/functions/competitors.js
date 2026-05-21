import { getUserFromContext, unauthorized, forbidden, json, stores, uid } from './_shared.js';
import { calculateOdds } from './_odds.js';

export default async (req, context) => {
  const user = getUserFromContext(context);
  if (!user) return unauthorized();
  if (!user.isAdmin) return forbidden();

  const store = stores.competitions();

  if (req.method === 'POST') {
    const { competitionId, competitors, mode = 'append' } = await req.json();
    const comp = await store.get(competitionId, { type: 'json' });
    if (!comp) return json({ error: 'competition not found' }, 404);

    const incoming = (competitors || []).map(c => ({
      id: uid(),
      number: c.number || '',
      name: c.name,
      country: c.country || '',
      balloon: c.balloon || '',
      balloonPhoto: c.balloonPhoto || null,
      photo: c.photo || null,
      world: c.world || null,
      us: c.us || null,
      history: c.history || [],
      stateResults: c.stateResults || [],
      overrideOdds: null,
    }));

    let newCompetitors;
    if (mode === 'replace') newCompetitors = incoming;
    else newCompetitors = [...(comp.competitors || []), ...incoming];

    // Re-run odds algorithm for the full roster
    const withOdds = calculateOdds(newCompetitors, comp.eventLevel || 'state');
    comp.competitors = newCompetitors.map((c, i) => ({
      ...c,
      skillScore: withOdds[i].skillScore,
      top10Pct: withOdds[i].top10Pct,
      oddsByPlace: withOdds[i].oddsByPlace,
    }));
    comp.updatedAt = Date.now();
    await store.setJSON(competitionId, comp);
    return json({ competition: comp });
  }

  if (req.method === 'PATCH') {
    const body = await req.json();
    const { competitionId, competitorId } = body;
    const comp = await store.get(competitionId, { type: 'json' });
    if (!comp) return json({ error: 'competition not found' }, 404);
    const idx = comp.competitors.findIndex(c => c.id === competitorId);
    if (idx === -1) return json({ error: 'competitor not found' }, 404);

    // Allow updating: name, country, balloon, photo, ranking data, override odds
    const fields = ['name', 'country', 'balloon', 'balloonPhoto', 'photo', 'world', 'us'];
    for (const f of fields) {
      if (body[f] !== undefined) comp.competitors[idx][f] = body[f];
    }
    // Override odds: { 1: 5.5, 2: 8.0, ... } - or null to clear
    if (body.overrideOdds !== undefined) comp.competitors[idx].overrideOdds = body.overrideOdds;
    // History updates trigger re-run of algorithm
    if (body.history !== undefined || body.stateResults !== undefined) {
      if (body.history !== undefined) comp.competitors[idx].history = body.history;
      if (body.stateResults !== undefined) comp.competitors[idx].stateResults = body.stateResults;
      const recalc = calculateOdds(comp.competitors, comp.eventLevel || 'state');
      comp.competitors = comp.competitors.map((c, i) => ({
        ...c,
        skillScore: recalc[i].skillScore,
        top10Pct: recalc[i].top10Pct,
        oddsByPlace: recalc[i].oddsByPlace,
      }));
    }
    comp.updatedAt = Date.now();
    await store.setJSON(competitionId, comp);
    return json({ competitor: comp.competitors[idx] });
  }

  if (req.method === 'DELETE') {
    const url = new URL(req.url);
    const competitionId = url.searchParams.get('competitionId');
    const competitorId = url.searchParams.get('competitorId');
    const comp = await store.get(competitionId, { type: 'json' });
    if (!comp) return json({ error: 'competition not found' }, 404);
    comp.competitors = comp.competitors.filter(c => c.id !== competitorId);
    // Re-run odds with smaller field
    if (comp.competitors.length > 0) {
      const recalc = calculateOdds(comp.competitors, comp.eventLevel || 'state');
      comp.competitors = comp.competitors.map((c, i) => ({
        ...c, skillScore: recalc[i].skillScore, top10Pct: recalc[i].top10Pct, oddsByPlace: recalc[i].oddsByPlace,
      }));
    }
    await store.setJSON(competitionId, comp);
    return json({ ok: true });
  }

  return json({ error: 'method not allowed' }, 405);
};
