import { getStore } from '@netlify/blobs';

// Decode JWT payload without verifying signature (Netlify Identity already validated it
// at the edge before our function runs — they pass it through in clientContext OR header).
function decodeJWT(token) {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    return decoded;
  } catch (e) {
    return null;
  }
}

export function getUserFromContext(context, request) {
  // Try clientContext first (works on older runtime / direct invokes)
  let user = context?.clientContext?.user;

  // If not present, parse from Authorization header (works on Functions v2)
  if (!user && request) {
    const auth = request.headers.get?.('authorization') || request.headers.get?.('Authorization');
    if (auth?.startsWith('Bearer ')) {
      const decoded = decodeJWT(auth.slice(7));
      if (decoded?.sub) {
        user = {
          sub: decoded.sub,
          email: decoded.email,
          app_metadata: decoded.app_metadata || {},
          user_metadata: decoded.user_metadata || {},
        };
      }
    }
  }

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
  photos: () => getStore('photos'),
  profiles: () => getStore('profiles'),
};

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
