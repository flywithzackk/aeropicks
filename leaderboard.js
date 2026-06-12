import { getUserFromContext, unauthorized, forbidden, json, stores } from './_shared.js';

// Mark a pilot as withdrawn from a competition + refund all bets on them.
//
// POST body: { competitionId, pilotId, withdrawn: true|false }
//   withdrawn:true  — mark withdrawn, refund all bets to per-competition remaining balance
//   withdrawn:false — un-mark withdrawn (admin can reverse a mistake; bets stay as-is)
//
// Refunds go to each user's `remaining` for that competition. Status of refunded bets
// becomes 'refunded'. If the competition is currently live (picks open), the member
// can re-deploy those points immediately. If locked, they sit until next competition.

export default async (req, context) => {
  const user = getUserFromContext(context, req);
  if (!user) return unauthorized();
  if (!user.isAdmin) return forbidden();
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const body = await req.json().catch(() => ({}));
  const { competitionId, pilotId, withdrawn } = body;
  if (!competitionId || !pilotId) return json({ error: 'competitionId and pilotId required' }, 400);
  const shouldWithdraw = withdrawn !== false; // default true

  const compStore = stores.competitions();
  const betsStore = stores.bets();

  const comp = await compStore.get(competitionId, { type: 'json' });
  if (!comp) return json({ error: 'Competition not found' }, 404);

  const pilot = comp.competitors?.find(c => c.id === pilotId);
  if (!pilot) return json({ error: 'Pilot not found in this competition' }, 404);

  pilot.withdrawn = shouldWithdraw;
  pilot.withdrawnAt = shouldWithdraw ? Date.now() : null;

  let refundCount = 0;
  let refundTotal = 0;
  const affectedUsers = new Set();

  if (shouldWithdraw) {
    // Walk all users' bets and refund any bet on this pilot in this comp
    const { blobs } = await betsStore.list();
    for (const b of blobs) {
      const userBets = await betsStore.get(b.key, { type: 'json' });
      if (!userBets || !userBets[competitionId]) continue;
      const compBets = userBets[competitionId];
      let userRefund = 0;
      let changed = false;
      for (const bet of (compBets.bets || [])) {
        if (bet.pilotId === pilotId && bet.status !== 'refunded' && bet.status !== 'won' && bet.status !== 'lost') {
          bet.status = 'refunded';
          bet.refundedAt = Date.now();
          userRefund += bet.points;
          changed = true;
        }
      }
      if (changed) {
        compBets.remaining = (compBets.remaining || 0) + userRefund;
        userBets[competitionId] = compBets;
        await betsStore.setJSON(b.key, userBets);
        refundCount++;
        refundTotal += userRefund;
        affectedUsers.add(b.key);
      }
    }
  }

  comp.updatedAt = Date.now();
  await compStore.setJSON(competitionId, comp);

  return json({
    ok: true,
    pilot: { id: pilot.id, name: pilot.name, withdrawn: pilot.withdrawn },
    refundsIssued: refundCount,
    pointsRefunded: refundTotal,
    affectedUsersCount: affectedUsers.size,
  });
};
