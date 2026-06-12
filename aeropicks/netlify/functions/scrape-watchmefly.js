import { getUserFromContext, unauthorized, forbidden, json, stores, uid } from './_shared.js';
import { calculateOdds } from './_odds.js';

// Scrape pilots from a WatchMeFly event page.
//
// POST body: { competitionId, url }
//   url should be like: https://watchmefly.net/events/event.php?e=rgc2026&v=pp
//   (the &v=pp param gets the Pilots page which has the roster)
//   We'll try both &v=pp (pilots) and &v=tta (totals) for max coverage.
//
// Adds parsed pilots to the named competition. Returns count of pilots imported.

function parsePilots(html) {
  const pilots = [];
  // WatchMeFly pages use a structured HTML table for the pilot list.
  // We parse the "tta" (totals) view which has rows like:
  //   <td>1.</td>
  //   <td><a href="...pilot.php?pid=...">3 - SKINNER, Jobe</a> ...flag...United States</td>
  // We also try to extract the pilot photo from the profile page link.

  // Pattern: anchor with pilot.php?pid=... containing "BANNER - LASTNAME, First"
  const anchorRe = /<a\s+href="[^"]*pilot\.php\?pid=([^&"]+)[^"]*"[^>]*>\s*(\d+)\s*-\s*([^<]+?)\s*<\/a>/gi;
  let m;
  const seen = new Set();
  while ((m = anchorRe.exec(html)) !== null) {
    const pid = m[1].trim();
    const number = m[2].trim();
    const name = m[3].trim().replace(/\s+/g, ' ');
    const key = `${pid}|${number}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pilots.push({ pid, number, name });
  }
  return pilots;
}

async function fetchPilotPhotoFromProfile(pid) {
  // Best-effort: fetch the pilot profile page and find a photo URL.
  try {
    const r = await fetch(`https://watchmefly.net/profile/pilot.php?pid=${pid}`, {
      headers: { 'User-Agent': 'Aeropicks/1.0 (https://aeropicks.com)' },
    });
    if (!r.ok) return null;
    const html = await r.text();
    // Look for the pilot photo - usually in an <img src="...uploads/pilots/..."> tag
    const photoMatch = html.match(/<img[^>]+src="(https?:\/\/[^"]*uploads\/pilots\/[^"]+)"/i);
    return photoMatch ? photoMatch[1] : null;
  } catch {
    return null;
  }
}

export default async (req, context) => {
  const user = getUserFromContext(context, req);
  if (!user) return unauthorized();
  if (!user.isAdmin) return forbidden();
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const body = await req.json().catch(() => ({}));
  const { competitionId, url, fetchPhotos } = body;
  if (!competitionId) return json({ error: 'competitionId required' }, 400);
  if (!url || !url.includes('watchmefly.net')) return json({ error: 'WatchMeFly URL required' }, 400);

  // Normalize the URL to use the totals view (most reliable source of roster + numbers)
  let scrapeUrl = url;
  if (!scrapeUrl.includes('&v=')) {
    scrapeUrl += '&v=tta';
  }

  let html;
  try {
    const r = await fetch(scrapeUrl, {
      headers: { 'User-Agent': 'Aeropicks/1.0 (https://aeropicks.com)' },
    });
    if (!r.ok) return json({ error: `WatchMeFly returned ${r.status}` }, 502);
    html = await r.text();
  } catch (ex) {
    return json({ error: `Could not reach WatchMeFly: ${ex.message}` }, 502);
  }

  const parsed = parsePilots(html);
  if (parsed.length === 0) return json({ error: 'No pilots found at that URL — make sure it is the event totals/pilots page' }, 422);

  // Optionally fetch photos for each pilot (slow - limit to 32 to be safe)
  const enriched = [];
  const photoLimit = fetchPhotos ? parsed.length : 0;
  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i];
    let photo = null;
    if (i < photoLimit) {
      photo = await fetchPilotPhotoFromProfile(p.pid);
    }
    enriched.push({
      ...p,
      photo,
      balloon: null,
      balloonPhoto: null,
      world: null,
      us: null,
      history: [],
      stateResults: [],
    });
  }

  // Load the target competition and apply pilots
  const compStore = stores.competitions();
  const comp = await compStore.get(competitionId, { type: 'json' });
  if (!comp) return json({ error: 'Competition not found' }, 404);

  const eventLevel = comp.eventLevel || 'state';
  const withOdds = calculateOdds(
    enriched.map(p => ({
      num: p.number,
      name: p.name,
      photo: p.photo,
      balloon: p.balloon,
      balloonPhoto: p.balloonPhoto,
      world: p.world,
      us: p.us,
      history: p.history,
      stateResults: p.stateResults,
    })),
    eventLevel
  );

  comp.competitors = withOdds.map(p => ({
    id: uid(),
    number: String(p.num),
    name: p.name,
    photo: p.photo,
    balloon: p.balloon,
    balloonPhoto: p.balloonPhoto,
    country: 'United States',
    world: p.world,
    us: p.us,
    history: p.history,
    stateResults: p.stateResults,
    skillScore: p.skillScore,
    top10Pct: p.top10Pct,
    oddsByPlace: p.oddsByPlace,
    overrideOdds: null,
    withdrawn: false,
  }));
  comp.updatedAt = Date.now();
  await compStore.setJSON(competitionId, comp);

  return json({
    ok: true,
    pilotCount: comp.competitors.length,
    pilots: comp.competitors.map(c => ({ name: c.name, number: c.number, hasPhoto: !!c.photo })),
    note: 'Pilots imported. Rankings (World/US/history) are blank — add manually for accurate odds.',
  });
};
