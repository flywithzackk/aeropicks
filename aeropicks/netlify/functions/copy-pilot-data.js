import { getUserFromContext, unauthorized, forbidden, json, stores } from './_shared.js';
import { calculateOdds } from './_odds.js';

// Copy pilot data (rankings, history, state results) from previous Aeropicks competitions
// into the target competition. Matches by WatchMeFly PID first, then by normalized name.
//
// POST body: { competitionId }
// Returns: { matched, unmatched, pilotsUpdated }
//
// Strategy:
//   For each pilot in the target competition:
//     - Scan all other competitions for matching pilots (PID or name)
//     - Take the most recent rankings (highest createdAt source)
//     - Aggregate state results from competitions with the same "state" or similar event
//     - Append historical finishes from any past settled competition

function normalizeName(name) {
  return name.toLowerCase().replace(/[^a-z]/g, '');
}

function looksLikeSameEvent(a, b) {
  // Heuristic: same event location, or names share a significant root
  // (e.g. "Rio Grande Classic 2024" and "Rio Grande Classic 2026")
  if (!a || !b) return false;
  if (a.location && b.location && a.location.toLowerCase() === b.location.toLowerCase()) return true;
  // Strip year from names and compare
  const stripYear = s => s.replace(/\s+\d{4}\s*$/, '').trim().toLowerCase();
  return stripYear(a.name) === stripYear(b.name);
}

export default async (req, context) => {
  const user = getUserFromContext(context, req);
  if (!user) return unauthorized();
  if (!user.isAdmin) return forbidden();
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const body = await req.json().catch(() => ({}));
  const { competitionId } = body;
  if (!competitionId) return json({ error: 'competitionId required' }, 400);

  const compStore = stores.competitions();
  const targetComp = await compStore.get(competitionId, { type: 'json' });
  if (!targetComp) return json({ error: 'Competition not found' }, 404);
  if (!targetComp.competitors?.length) return json({ error: 'Competition has no pilots yet — import the roster first' }, 400);

  // Load every other competition's roster
  const { blobs } = await compStore.list();
  const sources = [];
  for (const b of blobs) {
    if (b.key === competitionId) continue;
    const c = await compStore.get(b.key, { type: 'json' });
    if (c && c.competitors?.length) sources.push(c);
  }

  if (sources.length === 0) {
    return json({
      ok: true,
      pilotsUpdated: 0,
      matched: [],
      unmatched: targetComp.competitors.map(c => c.name),
      note: 'No other competitions to copy from.',
    });
  }

  // Index source pilots by pid + normalized name
  const sourcePilotsByPid = {};
  const sourcePilotsByName = {};
  for (const src of sources) {
    for (const p of src.competitors) {
      const entry = { pilot: p, sourceComp: src };
      if (p.wmfPid) {
        if (!sourcePilotsByPid[p.wmfPid]) sourcePilotsByPid[p.wmfPid] = [];
        sourcePilotsByPid[p.wmfPid].push(entry);
      }
      const n = normalizeName(p.name);
      if (n) {
        if (!sourcePilotsByName[n]) sourcePilotsByName[n] = [];
        sourcePilotsByName[n].push(entry);
      }
    }
  }

  const matched = [];
  const unmatched = [];

  for (const c of targetComp.competitors) {
    // Find all matches across all source competitions
    let allMatches = [];
    if (c.wmfPid && sourcePilotsByPid[c.wmfPid]) {
      allMatches = sourcePilotsByPid[c.wmfPid];
    } else {
      const n = normalizeName(c.name);
      if (sourcePilotsByName[n]) allMatches = sourcePilotsByName[n];
    }

    if (allMatches.length === 0) {
      unmatched.push(c.name);
      continue;
    }

    // Take rankings from the most recent source (highest createdAt or updatedAt)
    const sorted = [...allMatches].sort((a, b) => {
      const ta = a.sourceComp.updatedAt || a.sourceComp.createdAt || 0;
      const tb = b.sourceComp.updatedAt || b.sourceComp.createdAt || 0;
      return tb - ta;
    });
    const newest = sorted[0].pilot;

    let fieldsCopied = [];
    if (!c.world && newest.world) { c.world = newest.world; fieldsCopied.push('world'); }
    if (!c.us && newest.us) { c.us = newest.us; fieldsCopied.push('us'); }
    if (!c.balloon && newest.balloon) { c.balloon = newest.balloon; fieldsCopied.push('balloon'); }
    if (!c.balloonPhoto && newest.balloonPhoto) { c.balloonPhoto = newest.balloonPhoto; fieldsCopied.push('balloonPhoto'); }
    // Only fill in photo if pilot doesn't have one
    if (!c.photo && newest.photo) { c.photo = newest.photo; fieldsCopied.push('photo'); }

    // Aggregate state results from competitions that look like the same event
    const sameEventMatches = allMatches.filter(m => looksLikeSameEvent(m.sourceComp, targetComp));
    const stateResults = [];
    for (const m of sameEventMatches) {
      // Use the pilot's actual finishing place IF the source comp was settled
      if (m.sourceComp.status === 'settled' && m.sourceComp.results?.[m.pilot.id]) {
        stateResults.push(Number(m.sourceComp.results[m.pilot.id]));
      }
      // Also pull in any stored stateResults from that source
      if (m.pilot.stateResults?.length) {
        stateResults.push(...m.pilot.stateResults);
      }
    }
    if (stateResults.length > 0 && (!c.stateResults || c.stateResults.length === 0)) {
      c.stateResults = stateResults.slice(0, 6); // keep up to 6 most recent
      fieldsCopied.push('stateResults');
    }

    // Build form history from all settled comps (most recent first)
    const formHistory = [];
    for (const m of sorted) {
      if (m.sourceComp.status === 'settled' && m.sourceComp.results?.[m.pilot.id]) {
        formHistory.push(Number(m.sourceComp.results[m.pilot.id]));
      }
    }
    // Append the source pilot's own stored history (older data)
    for (const m of sorted) {
      if (m.pilot.history?.length) {
        for (const h of m.pilot.history) {
          if (!formHistory.includes(h)) formHistory.push(h);
        }
        break; // just use the newest source's history to avoid double-counting
      }
    }
    if (formHistory.length > 0 && (!c.history || c.history.length === 0)) {
      c.history = formHistory.slice(0, 10);
      fieldsCopied.push('history');
    }

    matched.push({
      name: c.name,
      fieldsCopied,
      sourcesUsed: sorted.length,
    });
  }

  // Recalculate odds with the new data
  const eventLevel = targetComp.eventLevel || 'state';
  const withOdds = calculateOdds(
    targetComp.competitors.map(p => ({
      num: p.number,
      name: p.name,
      photo: p.photo,
      balloon: p.balloon,
      balloonPhoto: p.balloonPhoto,
      world: p.world,
      us: p.us,
      history: p.history,
      stateResults: p.stateResults,
      wmfPid: p.wmfPid,
    })),
    eventLevel
  );

  targetComp.competitors = targetComp.competitors.map((c, i) => ({
    ...c,
    skillScore: withOdds[i].skillScore,
    top10Pct: withOdds[i].top10Pct,
    oddsByPlace: withOdds[i].oddsByPlace,
  }));

  targetComp.updatedAt = Date.now();
  await compStore.setJSON(competitionId, targetComp);

  return json({
    ok: true,
    pilotsUpdated: matched.filter(m => m.fieldsCopied.length > 0).length,
    matched,
    unmatched,
    note: 'Pilot data copied from previous competitions. Odds recalculated.',
  });
};
