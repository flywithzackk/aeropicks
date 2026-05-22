import { stores } from './_shared.js';

// Public endpoint to serve uploaded profile photos.
// URL pattern: /api/photo/:key

export default async (req, context) => {
  const url = new URL(req.url);
  const key = url.pathname.split('/').pop();
  if (!key) return new Response('not found', { status: 404 });

  const store = stores.photos();
  const result = await store.getWithMetadata(key, { type: 'arrayBuffer' });
  if (!result) return new Response('not found', { status: 404 });

  const contentType = result.metadata?.contentType || 'image/jpeg';
  return new Response(result.data, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
