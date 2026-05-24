import { getUserFromContext, unauthorized, json, stores } from './_shared.js';

// Members can subscribe to email notifications for a specific competition.
// When admin posts a daily update, all subscribers + all members with picks get notified.
//
// POST { competitionId } — subscribe current user
// DELETE ?competitionId=X — unsubscribe
// GET ?competitionId=X — am I subscribed?

export default async (req, context) => {
  const user = getUserFromContext(context, req);
  if (!user) return unauthorized();

  const store = stores.profiles();
  const profile = await store.get(user.id, { type: 'json' }) || {
    userId: user.id,
    username: user.user_metadata?.username || user.email?.split('@')[0],
    email: user.email,
    photo: user.user_metadata?.photo || null,
    notifySubscriptions: [],
  };
  profile.notifySubscriptions = profile.notifySubscriptions || [];

  const url = new URL(req.url);

  if (req.method === 'GET') {
    const competitionId = url.searchParams.get('competitionId');
    return json({
      subscribed: competitionId ? profile.notifySubscriptions.includes(competitionId) : false,
      subscriptions: profile.notifySubscriptions,
    });
  }

  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    const { competitionId } = body;
    if (!competitionId) return json({ error: 'competitionId required' }, 400);
    if (!profile.notifySubscriptions.includes(competitionId)) {
      profile.notifySubscriptions.push(competitionId);
    }
    profile.updatedAt = Date.now();
    await store.setJSON(user.id, profile);
    return json({ ok: true, subscriptions: profile.notifySubscriptions });
  }

  if (req.method === 'DELETE') {
    const competitionId = url.searchParams.get('competitionId');
    if (!competitionId) return json({ error: 'competitionId required' }, 400);
    profile.notifySubscriptions = profile.notifySubscriptions.filter(id => id !== competitionId);
    profile.updatedAt = Date.now();
    await store.setJSON(user.id, profile);
    return json({ ok: true, subscriptions: profile.notifySubscriptions });
  }

  return json({ error: 'method not allowed' }, 405);
};
