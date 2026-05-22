import { getUserFromContext, unauthorized, json, stores } from './_shared.js';

// Called by the client after signup/profile update to mirror the user's
// public profile (username, photo) into a lookup store for the leaderboard.
//
// POST: sync current user's profile to the store
// GET ?userIds=a,b,c: bulk lookup profiles

export default async (req, context) => {
  const user = getUserFromContext(context, req);
  if (!user) return unauthorized();

  const store = stores.profiles();

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const ids = (url.searchParams.get('userIds') || '').split(',').filter(Boolean);
    if (ids.length === 0) return json({ profiles: {} });
    const result = {};
    for (const id of ids) {
      const p = await store.get(id, { type: 'json' });
      if (p) result[id] = p;
    }
    return json({ profiles: result });
  }

  if (req.method === 'POST') {
    const body = await req.json();
    const profile = {
      userId: user.id,
      username: body.username || user.email?.split('@')[0],
      photo: body.photo || null,
      email: user.email,
      updatedAt: Date.now(),
    };
    await store.setJSON(user.id, profile);
    return json({ ok: true, profile });
  }

  return json({ error: 'method not allowed' }, 405);
};
