import { getUserFromContext, unauthorized, json, stores } from './_shared.js';

// In-app notification badge — counts daily updates posted after user's last view.
//
// GET — returns { unread: number, latestUpdates: [...] }
// POST { competitionId } — mark all updates for this competition as seen

export default async (req, context) => {
  const user = getUserFromContext(context, req);
  if (!user) return unauthorized();

  const profilesStore = stores.profiles();
  const compStore = stores.competitions();
  const betsStore = stores.bets();

  const profile = (await profilesStore.get(user.id, { type: 'json' })) || {
    userId: user.id,
    lastSeenUpdates: {},
  };
  profile.lastSeenUpdates = profile.lastSeenUpdates || {};

  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    const { competitionId } = body;
    if (competitionId) {
      profile.lastSeenUpdates[competitionId] = Date.now();
      await profilesStore.setJSON(user.id, profile);
    }
    return json({ ok: true });
  }

  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405);

  // Count unread updates across competitions where user has picks or is subscribed
  const userBets = (await betsStore.get(user.id, { type: 'json' })) || {};
  const relevantCompIds = new Set([
    ...Object.keys(userBets),
    ...(profile.notifySubscriptions || []),
  ]);

  let unread = 0;
  const newest = [];

  for (const compId of relevantCompIds) {
    const comp = await compStore.get(compId, { type: 'json' });
    if (!comp || !comp.dailyUpdates) continue;
    const lastSeen = profile.lastSeenUpdates[compId] || 0;
    for (const u of comp.dailyUpdates) {
      if (u.postedAt > lastSeen) {
        unread++;
        newest.push({
          competitionId: compId,
          competitionName: comp.name,
          id: u.id,
          title: u.title,
          body: u.body,
          day: u.day,
          postedAt: u.postedAt,
        });
      }
    }
  }

  newest.sort((a, b) => b.postedAt - a.postedAt);

  return json({ unread, latestUpdates: newest.slice(0, 10) });
};
