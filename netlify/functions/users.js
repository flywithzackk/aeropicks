import { getUserFromContext, unauthorized, forbidden, json, stores } from './_shared.js';

// Uses the Netlify Identity Admin API. Requires NETLIFY_IDENTITY_TOKEN env var
// (Personal Access Token with Identity admin scope).
async function identityFetch(path, options = {}) {
  const site = process.env.SITE_URL || process.env.URL; // Netlify provides URL
  const token = process.env.NETLIFY_IDENTITY_TOKEN;
  if (!site) throw new Error('SITE_URL or URL env var not set');
  if (!token) throw new Error('NETLIFY_IDENTITY_TOKEN env var not set');
  const baseUrl = site.replace(/\/$/, '');
  const res = await fetch(`${baseUrl}/.netlify/identity/admin${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  return res;
}

export default async (req, context) => {
  const user = getUserFromContext(context);
  if (!user) return unauthorized();
  if (!user.isAdmin) return forbidden();

  const balancesStore = stores.balances();

  if (req.method === 'GET') {
    try {
      const res = await identityFetch('/users');
      if (!res.ok) {
        return json({ users: [], error: 'Could not list users. Set NETLIFY_IDENTITY_TOKEN env var.' });
      }
      const data = await res.json();
      const users = data.users || [];
      // Enrich with balances
      const enriched = await Promise.all(users.map(async u => {
        const b = await balancesStore.get(u.id, { type: 'json' });
        return { ...u, balance: b?.balance ?? 1000 };
      }));
      return json({ users: enriched });
    } catch (err) {
      return json({ users: [], error: err.message });
    }
  }

  if (req.method === 'POST') {
    const body = await req.json();
    const { action } = body;

    if (action === 'setBalance') {
      const { userId, balance } = body;
      await balancesStore.setJSON(userId, { balance: Number(balance), updatedAt: Date.now(), updatedBy: user.id });
      return json({ ok: true });
    }

    if (action === 'setRole') {
      const { userId, admin } = body;
      try {
        // Get current user
        const userRes = await identityFetch(`/users/${userId}`);
        const userData = await userRes.json();
        const roles = new Set(userData.app_metadata?.roles || []);
        if (admin) roles.add('admin');
        else roles.delete('admin');
        const res = await identityFetch(`/users/${userId}`, {
          method: 'PUT',
          body: JSON.stringify({ app_metadata: { ...userData.app_metadata, roles: [...roles] } }),
        });
        if (!res.ok) return json({ error: 'Failed to update role' }, 500);
        return json({ ok: true });
      } catch (err) {
        return json({ error: err.message }, 500);
      }
    }

    if (action === 'recover') {
      const { email } = body;
      try {
        // Send a password recovery email
        const site = process.env.SITE_URL || process.env.URL;
        const res = await fetch(`${site.replace(/\/$/, '')}/.netlify/identity/recover`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        if (!res.ok) return json({ error: 'Recovery failed' }, 500);
        return json({ ok: true });
      } catch (err) {
        return json({ error: err.message }, 500);
      }
    }

    return json({ error: 'unknown action' }, 400);
  }

  return json({ error: 'method not allowed' }, 405);
};
