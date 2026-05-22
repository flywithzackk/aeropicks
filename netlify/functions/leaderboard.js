import { getUserFromContext, unauthorized, json, stores } from './_shared.js';

export default async (req, context) => {
  const user = getUserFromContext(context, req);
  if (!user) return unauthorized();

  const winningsStore = stores.winnings();
  const { blobs } = await winningsStore.list();
  const entries = [];

  for (const b of blobs) {
    const w = await winningsStore.get(b.key, { type: 'json' });
    if (!w) continue;
    entries.push({
      userId: b.key,
      total: w.total || 0,
      competitionsWon: (w.history || []).length,
    });
  }

  entries.sort((a, b) => b.total - a.total);
  // Show top 50; mark which entry is the current user
  const top = entries.slice(0, 50).map((e, i) => ({
    rank: i + 1,
    total: e.total,
    competitionsWon: e.competitionsWon,
    isYou: e.userId === user.id,
    // anonymize: show "Member" + last 4 of userId
    label: e.userId === user.id ? 'You' : `Member · ${e.userId.slice(-4).toUpperCase()}`,
  }));

  // Also fetch current user's own entry if they're not in top 50
  let yourEntry = null;
  const yourData = entries.find(e => e.userId === user.id);
  if (yourData) {
    const yourRank = entries.findIndex(e => e.userId === user.id) + 1;
    yourEntry = { rank: yourRank, total: yourData.total, competitionsWon: yourData.competitionsWon };
  }

  return json({ leaderboard: top, you: yourEntry });
};
