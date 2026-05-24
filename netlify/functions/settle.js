import { getUserFromContext, unauthorized, forbidden, json, stores } from './_shared.js';

// Settle a competition.
// POST body: { competitionId, results: { [pilotId]: finishingPlace }, wildcardWinner?: <varies by type> }
//
// Payout rules:
//   - Each placement bet: pays bet.points * bet.odds IF pilot finished EXACTLY in bet.place. Else 0.
//   - Wildcard: pays a flat bonus (e.g. 500 pts) if guess is correct. No cost to enter.
//   - Competition becomes "settled" - cannot be re-bet.
//
// Each member's final balance for this competition = sum of payouts. This is added to their lifetime winnings.

const WILDCARD_BONUS = 500;

export default async (req, context) => {
  const user = getUserFromContext(context, req);
  if (!user) return unauthorized();
  if (!user.isAdmin) return forbidden();

  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const { competitionId, results, wildcardWinner, revert } = await req.json();
  const compStore = stores.competitions();
  const betsStore = stores.bets();
  const winningsStore = stores.winnings();

  const comp = await compStore.get(competitionId, { type: 'json' });
  if (!comp) return json({ error: 'competition not found' }, 404);

  // REVERT path
  if (revert) {
    if (comp.status !== 'settled') return json({ error: 'competition is not settled' }, 400);
    const settlement = comp.settlement;
    if (!settlement) return json({ error: 'no settlement record' }, 400);

    // Reverse each member's lifetime winnings delta
    for (const [userId, delta] of Object.entries(settlement.userPayouts || {})) {
      const w = (await winningsStore.get(userId, { type: 'json' })) || { total: 0, history: [] };
      w.total = Math.max(0, w.total - delta);
      w.history = (w.history || []).filter(h => h.competitionId !== competitionId);
      await winningsStore.setJSON(userId, w);
    }

    // Restore everyone's bets to pending
    const { blobs: betBlobs } = await betsStore.list();
    for (const bb of betBlobs) {
      const userBets = await betsStore.get(bb.key, { type: 'json' });
      if (!userBets?.[competitionId]) continue;
      const compBets = userBets[competitionId];
      compBets.bets = (compBets.bets || []).map(b => ({ ...b, status: 'pending', payout: 0 }));
      if (compBets.wildcard) compBets.wildcard = { ...compBets.wildcard, status: 'pending', payout: 0 };
      await betsStore.setJSON(bb.key, userBets);
    }

    comp.status = 'locked';
    comp.results = null;
    comp.wildcardWinner = null;
    comp.settlement = null;
    comp.settledAt = null;
    await compStore.setJSON(competitionId, comp);

    return json({ ok: true, reverted: true });
  }

  // SETTLE path
  if (comp.status === 'settled') return json({ error: 'competition already settled' }, 400);
  if (!results || Object.keys(results).length === 0) {
    return json({ error: 'results required' }, 400);
  }

  // Resolve each member's bets
  const { blobs: betBlobs } = await betsStore.list();
  const userPayouts = {}; // userId -> total payout for this competition

  for (const bb of betBlobs) {
    const userBets = await betsStore.get(bb.key, { type: 'json' });
    if (!userBets?.[competitionId]) continue;
    const compBets = userBets[competitionId];
    let totalPayout = 0;

    // Placement bets
    compBets.bets = (compBets.bets || []).map(b => {
      // Refunded bets stay refunded - no payout, no loss
      if (b.status === 'refunded') return b;
      const actualPlace = Number(results[b.pilotId]);
      if (actualPlace && actualPlace === b.place) {
        const payout = Math.round(b.points * b.odds);
        totalPayout += payout;
        return { ...b, status: 'won', payout };
      }
      return { ...b, status: 'lost', payout: 0 };
    });

    // Wildcard
    if (compBets.wildcard && comp.wildcard && wildcardWinner !== undefined) {
      const correct = String(compBets.wildcard.value) === String(wildcardWinner);
      const payout = correct ? WILDCARD_BONUS : 0;
      totalPayout += payout;
      compBets.wildcard = { ...compBets.wildcard, status: correct ? 'won' : 'lost', payout };
    }

    compBets.totalPayout = totalPayout;
    compBets.settledAt = Date.now();
    userPayouts[bb.key] = totalPayout;
    await betsStore.setJSON(bb.key, userBets);

    // Update lifetime winnings
    if (totalPayout > 0) {
      const w = (await winningsStore.get(bb.key, { type: 'json' })) || { total: 0, history: [] };
      w.total = (w.total || 0) + totalPayout;
      w.history = w.history || [];
      // Replace any existing record for this competition (in case of re-settle - though we block that)
      w.history = w.history.filter(h => h.competitionId !== competitionId);
      w.history.push({
        competitionId,
        competitionName: comp.name,
        payout: totalPayout,
        date: Date.now(),
      });
      await winningsStore.setJSON(bb.key, w);
    }
  }

  // Stamp the competition
  comp.status = 'settled';
  comp.results = results;
  comp.wildcardWinner = wildcardWinner ?? null;
  comp.settlement = { userPayouts, settledAt: Date.now(), settledBy: user.id };
  comp.settledAt = Date.now();
  await compStore.setJSON(competitionId, comp);

  return json({
    ok: true,
    settled: true,
    membersPaid: Object.keys(userPayouts).filter(k => userPayouts[k] > 0).length,
    totalPaidOut: Object.values(userPayouts).reduce((a, b) => a + b, 0),
  });
};
