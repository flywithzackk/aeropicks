import { getUserFromContext, unauthorized, forbidden, json, stores } from './_shared.js';

// Admin endpoint: list all members with username/photo/email AND their bets.
//
// GET — returns: { members: [{ userId, username, photo, email, simulated, totalWon, betCount, competitions: [...] }] }
// GET ?userId=X — returns: { member: {...}, bets: [bet1, bet2, ...] } with full bet details
//
// Uses profiles store as the source of truth (works without NETLIFY_IDENTITY_TOKEN).

export default async (req, context) => {
  const user = getUserFromContext(context, req);
  if (!user) return unauthorized();
  if (!user.isAdmin) return forbidden();

  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405);

  const url = new URL(req.url);
  const targetUserId = url.searchParams.get('userId');

  const profilesStore = stores.profiles();
  const betsStore = stores.bets();
  const winningsStore = stores.winnings();
  const compsStore = stores.competitions();

  if (targetUserId) {
    // Detail view for one member - return all their bets enriched with pilot + competition info
    const profile = await profilesStore.get(targetUserId, { type: 'json' });
    if (!profile) return json({ error: 'member not found' }, 404);

    const userBets = (await betsStore.get(targetUserId, { type: 'json' })) || {};
    const winnings = (await winningsStore.get(targetUserId, { type: 'json' })) || { total: 0, history: [] };

    const allBets = [];
    for (const [compId, compBets] of Object.entries(userBets)) {
      const comp = await compsStore.get(compId, { type: 'json' });
      if (!comp) continue;
      const compName = comp.name || 'Unknown';
      for (const bet of (compBets.bets || [])) {
        const pilot = comp.competitors?.find(c => c.id === bet.pilotId);
        allBets.push({
          competitionId: compId,
          competitionName: compName,
          competitionStatus: comp.status,
          pilotId: bet.pilotId,
          pilotName: pilot?.name || 'Unknown pilot',
          pilotPhoto: pilot?.photo || null,
          pilotNumber: pilot?.number || null,
          place: bet.place,
          points: bet.points,
          odds: bet.odds,
          status: bet.status || 'pending',
          payout: bet.payout || 0,
        });
      }
    }

    return json({
      member: {
        userId: profile.userId,
        username: profile.username,
        photo: profile.photo,
        email: profile.email,
        simulated: !!profile.simulated,
        totalWon: winnings.total || 0,
      },
      bets: allBets,
    });
  }

  // List view
  const { blobs } = await profilesStore.list();
  const members = [];
  for (const b of blobs) {
    const p = await profilesStore.get(b.key, { type: 'json' });
    if (!p) continue;
    const winnings = (await winningsStore.get(b.key, { type: 'json' })) || { total: 0 };
    const userBets = (await betsStore.get(b.key, { type: 'json' })) || {};
    let betCount = 0;
    const competitions = new Set();
    for (const [compId, compBets] of Object.entries(userBets)) {
      const n = (compBets.bets || []).length;
      betCount += n;
      if (n > 0) competitions.add(compId);
    }
    members.push({
      userId: p.userId,
      username: p.username,
      photo: p.photo,
      email: p.email,
      simulated: !!p.simulated,
      joinedAt: p.updatedAt,
      totalWon: winnings.total || 0,
      betCount,
      competitionCount: competitions.size,
    });
  }

  // Sort: real users first, then sims; within each group by joinedAt desc
  members.sort((a, b) => {
    if (a.simulated !== b.simulated) return a.simulated ? 1 : -1;
    return (b.joinedAt || 0) - (a.joinedAt || 0);
  });

  return json({ members });
};
