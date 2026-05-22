import { getUserFromContext, unauthorized, json, stores } from './_shared.js';

export default async (req, context) => {
  const user = getUserFromContext(context, req);
  if (!user) return unauthorized();

  const winningsStore = stores.winnings();
  const profilesStore = stores.profiles();
  const { blobs } = await winningsStore.list();
  const entries = [];

  for (const b of blobs) {
    const w = await winningsStore.get(b.key, { type: 'json' });
    if (!w) continue;
    const profile = await profilesStore.get(b.key, { type: 'json' });
    entries.push({
      userId: b.key,
      total: w.total || 0,
      competitionsWon: (w.history || []).length,
      username: profile?.username || null,
      photo: profile?.photo || null,
    });
  }

  entries.sort((a, b) => b.total - a.total);

  const top = entries.slice(0, 50).map((e, i) => ({
    rank: i + 1,
    total: e.total,
    competitionsWon: e.competitionsWon,
    isYou: e.userId === user.id,
    username: e.username || `Member · ${e.userId.slice(-4).toUpperCase()}`,
    photo: e.photo,
    label: e.userId === user.id ? 'You' : (e.username || `Member · ${e.userId.slice(-4).toUpperCase()}`),
  }));

  let yourEntry = null;
  const yourData = entries.find(e => e.userId === user.id);
  if (yourData) {
    const yourRank = entries.findIndex(e => e.userId === user.id) + 1;
    yourEntry = {
      rank: yourRank,
      total: yourData.total,
      competitionsWon: yourData.competitionsWon,
      username: yourData.username,
      photo: yourData.photo,
    };
  }

  return json({ leaderboard: top, you: yourEntry });
};
