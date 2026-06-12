import { getUserFromContext, unauthorized, forbidden, json, stores, uid } from './_shared.js';
import { calculateOdds } from './_odds.js';

// Scrape pilots from a WatchMeFly event page.
//
// POST body: { competitionId, url, fetchPhotos }
//   url should be a WatchMeFly event page like:
//     https://watchmefly.net/events/event.php?e=gtbr2026
//     https://watchmefly.net/events/event.php?e=ygtbr2026&v=tt
//   Handles both &v=tt and &v=tta formats.
//
// Adds parsed pilots to the named competition. Returns count + diagnostic info.

function parsePilots(html) {
  // Pilot anchor pattern. WatchMeFly has two formats:
  //   v=tta — anchor text is "3 - SKINNER, Jobe" (banner inside link)
  //   v=tt  — text is "#3 - <a>SKINNER, Jobe</a>" (banner outside link)
  // Handle both with a forgiving parse.

  const anchorRe = /<a\s+[^>]*href="[^"]*pilot\.php\?pid=([^&"]+)[^"]*"[^>]*>\s*([^<]+?)\s*<\/a>/gi;
  const matches = [];
  let m;
  while ((m = anchorRe.exec(html)) !== null) {
    let rawText = m[2].trim().replace(/\s+/g, ' ');
    let number = null;
    let name = rawText;
    // Format A: "3 - SKINNER, Jobe" inside the anchor
    const inAnchor = rawText.match(/^(\d+)\s*-\s*(.+)$/);
    if (inAnchor) {
      number = inAnchor[1];
      name = inAnchor[2].trim();
    }
    matches.push({
      index: m.index,
      pid: m[1].trim(),
      number,
      name,
    });
  }

  // Format B: "#3 - <a>" - banner number appears in HTML right before the anchor
  for (const a of matches) {
    if (a.number) continue;
    const lookback = html.slice(Math.max(0, a.index - 80), a.index);
    const numMatch = lookback.match(/#\s*(\d+)\s*-\s*$/);
    if (numMatch) a.number = numMatch[1];
  }

  // Deduplicate by pid
  const seen = new Set();
  const pilots = [];
  for (const a of matches) {
    if (seen.has(a.pid)) continue;
    seen.add(a.pid);
    pilots.push({ pid: a.pid, number: a.number || '', name: a.name });
  }
  return pilots;
}

async function fetchPilotPhotoFromProfile(pid) {
  try {
    const r = await fetch(`https://watchmefly.net/profile/pilot.php?pid=${pid}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!r.ok) return null;
    const html = await r.text();
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

  // Respect whatever URL the admin pasted. Only add &v=tt if no view param is set.
  let scrapeUrl = url;
  if (!scrapeUrl.includes('v=')) {
    scrapeUrl += (scrapeUrl.includes('?') ? '&' : '?') + 'v=tt';
  }

  let html;
  let httpStatus;
  try {
    const r = await fetch(scrapeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
    httpStatus = r.status;
    if (!r.ok) return json({ error: `WatchMeFly returned ${r.status}`, url: scrapeUrl, httpStatus }, 502);
    html = await r.text();
  } catch (ex) {
    return json({ error: `Could not reach WatchMeFly: ${ex.message}`, url: scrapeUrl }, 502);
  }

  const parsed = parsePilots(html);
  if (parsed.length === 0) {
    // Detailed diagnostic so admin can see what happened
    const snippet = html.slice(0, 600).replace(/\s+/g, ' ');
    const anchorCount = (html.match(/pilot\.php\?pid=/gi) || []).length;
    return json({
      error: 'No pilots parsed from that page',
      hint: 'The page loaded but no pilot links were extracted. Check that the URL points to an event page with a pilot roster.',
      url: scrapeUrl,
      httpStatus,
      htmlLength: html.length,
      pilotAnchorsFound: anchorCount,
      htmlSnippet: snippet,
    }, 422);
  }

  // Optionally fetch photos for each pilot (slow but useful)
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
    number: String(p.num || ''),
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
