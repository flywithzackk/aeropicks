import { getUserFromContext, unauthorized, json, stores } from './_shared.js';

// Leaderboard with two views:
//
// GET /api/leaderboard
//   → Overall (lifetime) leaderboard - default
//
// GET /api/leaderboard?competitionId=X
//   → Round leaderboard for a specific competition
//     - settled: actual winnings from that round
//     - live/locked: potential payout if standings hold (default)
//
// GET /api/leaderboard?competitionId=X&mode=wagered
//   → Round leaderboard sorted by points wagered (commitment)
//
// "Comps Won" = how many competitions a user has placed 1st on the leaderboard
// at settle-time. Tracked properly by walking each settled competition's bets.

export default async (req, context) => {
  const user = getUserFromContext(context, req);
  if (!user) return unauthorized();

  const url = new URL(req.url);
  const competitionId = url.searchParams.get('competitionId');
  const mode = url.searchParams.get('mode') || 'payout';

  const profilesStore = stores.profiles();
  const winningsStore = stores.winnings();
  const betsStore = stores.bets();
  const compStore = stores.competitions();

  if (competitionId) {
    return getRoundLeaderboard(competitionId, mode, user, profilesStore, betsStore, compStore);
  }

  return getOverallLeaderboard(user, profilesStore, winningsStore, betsStore, compStore);
};

async function getOverallLeaderboard(user, profilesStore, winningsStore, betsStore, compStore) {
  // Walk every settled competition + every user's bets to figure out:
  //   - actual winner of each settled comp (most won in that comp)
  //   - per-user count of competitions played
  const { blobs: compBlobs } = await compStore.list();
  const settledComps = [];
  for (const cb of compBlobs) {
    const c = await compStore.get(cb.key, { type: 'json' });
    if (c && c.status === 'settled') settledComps.push(c);
  }

  const { blobs: betBlobs } = await betsStore.list();
  const compTotalsByUser = {};
  for (const bb of betBlobs) {
    const userBets = await betsStore.get(bb.key, { type: 'json' });
    if (!userBets) continue;
    compTotalsByUser[bb.key] = {};
    for (const [compId, compBets] of Object.entries(userBets)) {
      const wonThisComp = (compBets.bets || [])
        .filter(b => b.status === 'won')
        .reduce((s, b) => s + (b.payout || 0), 0);
      const wildcardWon = compBets.wildcard?.status === 'won' ? (compBets.wildcard.payout || 0) : 0;
      compTotalsByUser[bb.key][compId] = wonThisComp + wildcardWon;
    }
  }

  // Determine the winner of each settled competition
  const winnerByComp = {};
  for (const comp of settledComps) {
    let topUser = null;
    let topAmount = 0;
    for (const [userId, comps] of Object.entries(compTotalsByUser)) {
      const earned = comps[comp.id] || 0;
      if (earned > topAmount) {
        topAmount = earned;
        topUser = userId;
      }
    }
    if (topUser && topAmount > 0) winnerByComp[comp.id] = topUser;
  }

  const compsWonByUser = {};
  for (const winnerId of Object.values(winnerByComp)) {
    compsWonByUser[winnerId] = (compsWonByUser[winnerId] || 0) + 1;
  }

  // Build entries
  const { blobs: winningsBlobs } = await winningsStore.list();
  const userIds = new Set();
  for (const b of winningsBlobs) userIds.add(b.key);
  for (const b of betBlobs) userIds.add(b.key);
  for (const b of (await profilesStore.list()).blobs) userIds.add(b.key);

  const entries = [];
  for (const userId of userIds) {
    const w = (await winningsStore.get(userId, { type: 'json' })) || { total: 0 };
    const profile = await profilesStore.get(userId, { type: 'json' });
    if (profile?.simulated) continue;
    entries.push({
      userId,
      total: w.total || 0,
      competitionsWon: compsWonByUser[userId] || 0,
      competitionsPlayed: Object.keys(compTotalsByUser[userId] || {}).length,
      username: profile?.username || null,
      photo: profile?.photo || null,
    });
  }

  entries.sort((a, b) => b.total - a.total);

  const top = entries.slice(0, 50).map((e, i) => ({
    rank: i + 1,
    total: e.total,
    competitionsWon: e.competitionsWon,
    competitionsPlayed: e.competitionsPlayed,
    isYou: e.userId === user.id,
    username: e.username || `Member · ${e.userId.slice(-4).toUpperCase()}`,
    photo: e.photo,
    label: e.userId === user.id ? 'You' : (e.username || `Member · ${e.userId.slice(-4).toUpperCase()}`),
  }));

  let yourEntry = null;
  const yourIdx = entries.findIndex(e => e.userId === user.id);
  if (yourIdx >= 0) {
    const yd = entries[yourIdx];
    yourEntry = {
      rank: yourIdx + 1,
      total: yd.total,
      competitionsWon: yd.competitionsWon,
      competitionsPlayed: yd.competitionsPlayed,
      username: yd.username,
      photo: yd.photo,
    };
  }

  return json({
    leaderboard: top,
    you: yourEntry,
    settledCompsCount: settledComps.length,
    view: 'overall',
  });
}

async function getRoundLeaderboard(competitionId, mode, user, profilesStore, betsStore, compStore) {
  const comp = await compStore.get(competitionId, { type: 'json' });
  if (!comp) return json({ error: 'competition not found' }, 404);

  const { blobs: betBlobs } = await betsStore.list();

  const entries = [];
  for (const bb of betBlobs) {
    const userBets = await betsStore.get(bb.key, { type: 'json' });
    const compBets = userBets?.[competitionId];
    if (!compBets || !(compBets.bets?.length)) continue;
    const profile = await profilesStore.get(bb.key, { type: 'json' });
    if (profile?.simulated) continue;

    const bets = compBets.bets || [];
    const provisional = comp.provisionalResults || {};

    const totalWagered = bets
      .filter(b => b.status !== 'refunded')
      .reduce((s, b) => s + (b.points || 0), 0);

    const actualWon = bets
      .filter(b => b.status === 'won')
      .reduce((s, b) => s + (b.payout || 0), 0) + (compBets.wildcard?.status === 'won' ? (compBets.wildcard.payout || 0) : 0);

    let potentialPayout = 0;
    for (const b of bets) {
      if (b.status === 'refunded') continue;
      if (b.status === 'won') {
        potentialPayout += b.payout || 0;
        continue;
      }
      const currentPlace = Number(provisional[b.pilotId]);
      if (currentPlace && currentPlace === b.place) {
        potentialPayout += Math.round(b.points * b.odds);
      }
    }

    entries.push({
      userId: bb.key,
      username: profile?.username || `Member · ${bb.key.slice(-4).toUpperCase()}`,
      photo: profile?.photo || null,
      totalWagered,
      actualWon,
      potentialPayout,
      pickCount: bets.filter(b => b.status !== 'refunded').length,
    });
  }

  let sortKey;
  if (comp.status === 'settled') sortKey = 'actualWon';
  else if (mode === 'wagered') sortKey = 'totalWagered';
  else sortKey = 'potentialPayout';

  entries.sort((a, b) => b[sortKey] - a[sortKey]);

  const top = entries.slice(0, 50).map((e, i) => ({
    rank: i + 1,
    isYou: e.userId === user.id,
    username: e.username,
    photo: e.photo,
    label: e.userId === user.id ? 'You' : e.username,
    totalWagered: e.totalWagered,
    actualWon: e.actualWon,
    potentialPayout: e.potentialPayout,
    pickCount: e.pickCount,
    primaryStat: e[sortKey],
  }));

  let yourEntry = null;
  const yourIdx = entries.findIndex(e => e.userId === user.id);
  if (yourIdx >= 0) {
    const e = entries[yourIdx];
    yourEntry = {
      rank: yourIdx + 1,
      username: e.username,
      photo: e.photo,
      totalWagered: e.totalWagered,
      actualWon: e.actualWon,
      potentialPayout: e.potentialPayout,
      pickCount: e.pickCount,
      primaryStat: e[sortKey],
    };
  }

  return json({
    leaderboard: top,
    you: yourEntry,
    view: 'round',
    competition: {
      id: comp.id,
      name: comp.name,
      status: comp.status,
      hasProvisional: Object.keys(comp.provisionalResults || {}).length > 0,
    },
    mode: comp.status === 'settled' ? 'final' : mode,
    sortKey,
  });
}
