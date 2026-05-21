import { getStore } from '@netlify/blobs';

export function getUserFromContext(context) {
  // Netlify Identity injects clientContext.user when JWT is valid
  const user = context?.clientContext?.user;
  if (!user) return null;
  return {
    id: user.sub,
    email: user.email,
    roles: user.app_metadata?.roles || [],
    isAdmin: (user.app_metadata?.roles || []).includes('admin'),
  };
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function forbidden() {
  return new Response(JSON.stringify({ error: 'forbidden' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const stores = {
  competitions: () => getStore('competitions'),
  bets: () => getStore('bets'),
  balances: () => getStore('balances'),
  winnings: () => getStore('winnings'),
};

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
