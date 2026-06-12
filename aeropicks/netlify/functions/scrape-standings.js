import { getUserFromContext, unauthorized, forbidden, json, stores } from './_shared.js';

// Scrape current standings from a WatchMeFly event page and auto-fill provisional results.
//
// POST body: { competitionId, url }
// Returns: { matched: [...], unmatched: [...], provisionalResults: {...} }

function parseStandings(html) {
  // WatchMeFly has multiple totals page formats:
  //   &v=tta — anchor text is "3 - SKINNER, Jobe" (banner number INSIDE the link)
  //   &v=tt  — text is "#3 - <a>SKINNER, Jobe</a>" (banner number OUTSIDE the link)
  //
  // Strategy: find every pilot anchor (just the name), then look backward for the
  // most recent place cell. Banner number is captured if present nearby but not required.

  const results = [];
  // Anchor pattern that works for BOTH formats — just captures whatever text is in the anchor
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
      rawText,
    });
  }

  // Format B: "#3 - <a>" — banner number appears in the HTML right before the anchor
  // Look backward up to 80 chars for a pattern like "#3 - " or "#3-"
  for (const a of matches) {
    if (a.number) continue;
    const lookback = html.slice(Math.max(0, a.index - 80), a.index);
    const numMatch = lookback.match(/#\s*(\d+)\s*-\s*$/);
    if (numMatch) a.number = numMatch[1];
  }

  const placeRe = /<td[^>]*>\s*(\d+)\s*\.?\s*<\/td>/gi;
  const places = [];
  while ((m = placeRe.exec(html)) !== null) {
    places.push({ index: m.index, place: parseInt(m[1], 10) });
  }

  const seen = new Set();
  for (const a of matches) {
    if (seen.has(a.pid)) continue;
    let bestPlace = null;
    for (const p of places) {
      if (p.index < a.index) {
        if (!bestPlace || p.index > bestPlace.index) bestPlace = p;
      }
    }
    if (bestPlace && bestPlace.place > 0 && bestPlace.place < 200) {
      if (results.some(r => r.place === bestPlace.place)) continue;
      results.push({
        place: bestPlace.place,
        pid: a.pid,
        number: a.number || '',
        name: a.name,
      });
      seen.add(a.pid);
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

  // Respect the URL the admin pasted. Only add &v=tta if no view param is set at all
  // (WatchMeFly has multiple totals pages: tt, tta, ttd, etc — different sort orders)
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
    if (!r.ok) return json({ error: `WatchMeFly returned ${r.status}`, url: scrapeUrl }, 502);
    html = await r.text();
  } catch (ex) {
    return json({ error: `Could not reach WatchMeFly: ${ex.message}`, url: scrapeUrl }, 502);
  }

  const standings = parseStandings(html);
  if (standings.length === 0) {
    // Diagnostic info to help debug
    const snippet = html.slice(0, 600).replace(/\s+/g, ' ');
    // Count what we DID find
    const anchorCount = (html.match(/pilot\.php\?pid=/gi) || []).length;
    const placeCount = (html.match(/<td[^>]*>\s*\d+\s*\.?\s*<\/td>/gi) || []).length;
    return json({
      error: 'No standings parsed from that page',
      hint: 'The HTML structure may have changed, or the URL points to the wrong page. Try the URL with &v=tta at the end.',
      url: scrapeUrl,
      httpStatus,
      htmlLength: html.length,
      pilotAnchorsFound: anchorCount,
      placeCellsFound: placeCount,
      htmlSnippet: snippet,
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
