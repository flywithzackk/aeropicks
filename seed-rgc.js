import { stores, uid, json } from './_shared.js';

// Accepts data: { data: "data:image/jpeg;base64,..." }
// Stores in a public-photos blob store with a random key, returns the URL.
// No auth required - this is used during sign-up before the user has a token.

export default async (req, context) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const body = await req.json().catch(() => null);
  if (!body?.data || typeof body.data !== 'string') {
    return json({ error: 'data required (base64 image)' }, 400);
  }

  // Extract mime type and binary
  const match = body.data.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  if (!match) return json({ error: 'invalid data URL' }, 400);

  const mime = match[1];
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowed.includes(mime.toLowerCase())) {
    return json({ error: 'jpeg/png/webp only' }, 400);
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 5 * 1024 * 1024) {
    return json({ error: 'too large (>5MB)' }, 400);
  }

  const ext = mime.split('/')[1].replace('jpeg', 'jpg');
  const key = `${uid()}.${ext}`;

  const store = stores.photos();
  await store.set(key, buffer, { metadata: { contentType: mime } });

  // The serve-photo function returns this blob
  const url = `/api/photo/${key}`;
  return json({ ok: true, url, key });
};
