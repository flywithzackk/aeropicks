import { getUserFromContext, unauthorized, forbidden, json, stores, uid } from './_shared.js';

// Daily updates and provisional results for live multi-day events.
//
// GET ?competitionId=X — returns updates feed + provisional standings
// POST — admin posts a new daily update
//   body: { competitionId, title, body, day, provisionalResults: { pilotId: place } }
// DELETE ?competitionId=X&updateId=Y — admin removes an update

export default async (req, context) => {
  const user = getUserFromContext(context, req);
  if (!user) return unauthorized();

  const compStore = stores.competitions();
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const competitionId = url.searchParams.get('competitionId');
    if (!competitionId) return json({ updates: [], provisionalResults: {} });
    const comp = await compStore.get(competitionId, { type: 'json' });
    if (!comp) return json({ updates: [], provisionalResults: {} });

    // Sort updates newest first
    const updates = (comp.dailyUpdates || []).slice().sort((a, b) => b.postedAt - a.postedAt);
    return json({
      updates,
      provisionalResults: comp.provisionalResults || {},
    });
  }

  if (req.method === 'POST') {
    if (!user.isAdmin) return forbidden();
    const body = await req.json();
    const { competitionId, title, body: noteBody, day, provisionalResults } = body;
    if (!competitionId) return json({ error: 'competitionId required' }, 400);
    const comp = await compStore.get(competitionId, { type: 'json' });
    if (!comp) return json({ error: 'competition not found' }, 404);

    if (!comp.dailyUpdates) comp.dailyUpdates = [];

    // If they provided a title/body, this is a new update
    if (title || noteBody) {
      const update = {
        id: uid(),
        day: day || null,
        title: title || '',
        body: noteBody || '',
        postedAt: Date.now(),
        postedBy: user.id,
      };
      comp.dailyUpdates.unshift(update);
    }

    // If they provided provisional results, merge them
    if (provisionalResults && typeof provisionalResults === 'object') {
      comp.provisionalResults = { ...(comp.provisionalResults || {}), ...provisionalResults };
    }

    comp.updatedAt = Date.now();
    await compStore.setJSON(competitionId, comp);
    return json({ ok: true, dailyUpdates: comp.dailyUpdates, provisionalResults: comp.provisionalResults });
  }

  if (req.method === 'DELETE') {
    if (!user.isAdmin) return forbidden();
    const competitionId = url.searchParams.get('competitionId');
    const updateId = url.searchParams.get('updateId');
    if (!competitionId || !updateId) return json({ error: 'ids required' }, 400);
    const comp = await compStore.get(competitionId, { type: 'json' });
    if (!comp) return json({ error: 'competition not found' }, 404);
    comp.dailyUpdates = (comp.dailyUpdates || []).filter(u => u.id !== updateId);
    comp.updatedAt = Date.now();
    await compStore.setJSON(competitionId, comp);
    return json({ ok: true });
  }

  return json({ error: 'method not allowed' }, 405);
};
