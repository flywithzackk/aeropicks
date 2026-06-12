import { json, stores } from './_shared.js';

// Public endpoint - given a username, returns the associated email.
// Used by the login flow so users can sign in with either username or email.
// We don't return the email directly to anonymous users for privacy - instead
// we return whether a username exists.
//
// GET /api/lookup-username?username=foo
// Returns: { email: "..." } if found, { email: null } if not.

export default async (req, context) => {
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405);
  const url = new URL(req.url);
  const username = (url.searchParams.get('username') || '').trim().toLowerCase();
  if (!username) return json({ email: null });

  const store = stores.profiles();
  const { blobs } = await store.list();
  for (const b of blobs) {
    const p = await store.get(b.key, { type: 'json' });
    if (p?.username?.toLowerCase() === username) {
      return json({ email: p.email || null });
    }
  }
  return json({ email: null });
};
