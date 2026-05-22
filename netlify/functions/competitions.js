import { getUserFromContext, unauthorized, forbidden, json, stores, uid } from './_shared.js';
import { calculateOdds } from './_odds.js';

export default async (req, context) => {
  const user = getUserFromContext(context, req);
  if (!user) return unauthorized();

  const store = stores.competitions();
  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  if (req.method === 'GET') {
    if (id) {
      const comp = await store.get(id, { type: 'json' });
      if (!comp) return json({ competition: null }, 404);
      if (comp.status === 'draft' && !user.isAdmin) return json({ competition: null }, 404);
      // Strip data members shouldn't see (skill scores, raw history etc - keep odds + display info)
      if (!user.isAdmin) {
        comp.competitors = (comp.competitors || []).map(c => ({
          id: c.id, number: c.number, name: c.name, country: c.country,
          balloon: c.balloon, balloonPhoto: c.balloonPhoto, photo: c.photo,
          world: c.world, us: c.us,
          oddsByPlace: c.overrideOdds || c.oddsByPlace,
          top10Pct: c.top10Pct,
        }));
      }
      return json({ competition: comp });
    }
    const { blobs } = await store.list();
    const all = await Promise.all(blobs.map(b => store.get(b.key, { type: 'json' })));
    const visible = all.filter(c => c && (user.isAdmin || c.status !== 'draft'));
    return json({
      competitions: visible.map(c => ({
        id: c.id, name: c.name, location: c.location, dates: c.dates,
        status: c.status, eventLevel: c.eventLevel || 'state',
        description: c.description, competitorCount: c.competitors?.length || 0,
        hasWildcard: !!c.wildcard,
      })),
    });
  }

  if (req.method === 'POST') {
    if (!user.isAdmin) return forbidden();
    const body = await req.json();
    const compId = body.id || uid();
    const existing = body.id ? (await store.get(compId, { type: 'json' })) : null;

    const eventLevelChanged = existing && body.eventLevel && body.eventLevel !== existing.eventLevel;

    const comp = {
      id: compId,
      name: body.name,
      location: body.location || '',
      dates: body.dates || '',
      eventLevel: body.eventLevel || existing?.eventLevel || 'state',
      description: body.description || '',
      status: body.status || 'draft',
      wildcard: body.wildcard !== undefined ? body.wildcard : (existing?.wildcard || null),
      competitors: existing?.competitors || [],
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    // If event level changed, re-run odds
    if (eventLevelChanged && comp.competitors.length > 0) {
      const recalc = calculateOdds(comp.competitors, comp.eventLevel);
      comp.competitors = comp.competitors.map((c, i) => ({
        ...c, skillScore: recalc[i].skillScore, top10Pct: recalc[i].top10Pct, oddsByPlace: recalc[i].oddsByPlace,
      }));
    }

    await store.setJSON(compId, comp);
    return json({ competition: comp });
  }

  if (req.method === 'DELETE') {
    if (!user.isAdmin) return forbidden();
    if (!id) return json({ error: 'id required' }, 400);
    await store.delete(id);
    return json({ ok: true });
  }

  return json({ error: 'method not allowed' }, 405);
};
