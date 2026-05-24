import { getUserFromContext, unauthorized, forbidden, json, stores } from './_shared.js';

// Scrape current standings from a WatchMeFly event page and auto-fill provisional results.
//
// POST body: { competitionId, url }
// Returns: { matched: [...], unmatched: [...], provisionalResults: {...} }

function parseStandings(html) {
  // WatchMeFly's totals table can be HTML in various forms. We do a two-step parse:
  // 1. Find all anchor tags that point to pilot profiles (these are the pilot rows)
  // 2. For each match, look backward in the surrounding text for the place number
  //
  // This is more forgiving than a strict structural regex.

  const results = [];
  // Find every pilot anchor: <a href="...pilot.php?pid=X">NUM - NAME</a>
  const anchorRe = /<a\s+[^>]*href="[^"]*pilot\.php\?pid=([^&"]+)[^"]*"[^>]*>\s*(\d+)\s*-\s*([^<]+?)\s*<\/a>/gi;
  const matches = [];
  let m;
  while ((m = anchorRe.exec(html)) !== null) {
    matches.push({
      index: m.index,
      pid: m[1].trim(),
      number: m[2].trim(),
      name: m[3].trim().replace(/\s+/g, ' '),
    });
  }

  // For each anchor, look backward in the HTML for the most recent place number
  // (a digit followed by a period and a closing </td>)
  const placeRe = /<td[^>]*>\s*(\d+)\s*\.?\s*<\/td>/gi;
  const places = [];
  while ((m = placeRe.exec(html)) !== null) {
    places.push({ index: m.index, place: parseInt(m[1], 10) });
  }

  // Match each anchor to the nearest preceding place cell
  const seen = new Set();
  for (const a of matches) {
    // Skip duplicates (same anchor showing in nav etc.)
    const key = a.pid;
    if (seen.has(key)) continue;
    // Find the place cell with the largest index < anchor index
    let bestPlace = null;
    for (const p of places) {
      if (p.index < a.index) {
        if (!bestPlace || p.index > bestPlace.index) bestPlace = p;
      }
    }
    if (bestPlace && bestPlace.place > 0 && bestPlace.place < 200) {
      // Avoid same place being assigned to multiple anchors
      if (results.some(r => r.place === bestPlace.place)) continue;
      results.push({
        place: bestPlace.place,
        pid: a.pid,
        number: a.number,
        name: a.name,
      });
      seen.add(key);
    }
  }

  return results;
}

function normalizeName(name) {
  return name.toLowerCase().replace(/[^a-z]/g, '');
}

export default async (req, context) => {
  const user = getUserFromContext(context, req);
  if (!user) return unauthorized();
  if (!user.isAdmin) return forbidden();
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const body = await req.json().catch(() => ({}));
  const { competitionId, url } = body;
  if (!competitionId) return json({ error: 'competitionId required' }, 400);
  if (!url || !url.includes('watchmefly.net')) return json({ error: 'WatchMeFly URL required' }, 400);

  let scrapeUrl = url;
  if (!scrapeUrl.includes('&v=')) scrapeUrl += '&v=tta';
  // Force totals view
  scrapeUrl = scrapeUrl.replace(/&v=[a-z]+/, '&v=tta');

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

  const standings = parseStandings(html);
  if (standings.length === 0) {
    // Give the admin enough info to diagnose. Include first 200 chars of HTML.
    const snippet = html.slice(0, 200).replace(/\s+/g, ' ');
    return json({
      error: 'No standings parsed from that page',
      hint: 'The scraper looks for table rows with pilot profile links. Make sure the URL points to the Competition Totals page (it should have &v=tta in the URL).',
      htmlSnippet: snippet,
      htmlLength: html.length,
    }, 422);
  }

  // Load the competition + match standings to roster
  const compStore = stores.competitions();
  const comp = await compStore.get(competitionId, { type: 'json' });
  if (!comp) return json({ error: 'Competition not found' }, 404);

  const provisionalResults = comp.provisionalResults || {};
  const matched = [];
  const unmatched = [];

  for (const s of standings) {
    const sNameNorm = normalizeName(s.name);
    const pilot = comp.competitors?.find(c => {
      const cNameNorm = normalizeName(c.name);
      return cNameNorm === sNameNorm || cNameNorm.includes(sNameNorm) || sNameNorm.includes(cNameNorm);
    });
    if (pilot) {
      provisionalResults[pilot.id] = s.place;
      matched.push({ place: s.place, name: s.name, matchedTo: pilot.name });
    } else {
      unmatched.push({ place: s.place, name: s.name, number: s.number });
    }
  }

  // Save the updated provisional results
  comp.provisionalResults = provisionalResults;
  comp.updatedAt = Date.now();
  await compStore.setJSON(competitionId, comp);

  return json({
    ok: true,
    matched,
    unmatched,
    standingsCount: standings.length,
    provisionalResults,
  });
};
