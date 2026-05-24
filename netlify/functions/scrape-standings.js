import { getUserFromContext, unauthorized, forbidden, json, stores } from './_shared.js';

// Scrape current standings from a WatchMeFly event page and auto-fill provisional results.
//
// POST body: { competitionId, url }
// Returns: { matched: [...], unmatched: [...], provisionalResults: {...} }

function parseStandings(html) {
  // WatchMeFly totals table rows look like:
  //   <td>1.</td>
  //   <td><a href="...pilot.php?pid=X">3 - SKINNER, Jobe</a>...</td>
  //
  // We extract: { place: 1, number: '3', name: 'SKINNER, Jobe', pid: 'X' }

  const results = [];
  // Match a numeric place cell followed by the pilot anchor on the next td
  // This is the most reliable pattern from the totals page.
  const rowRe = /<td[^>]*>\s*(\d+)\.?\s*<\/td>\s*<td[^>]*>\s*<a\s+href="[^"]*pilot\.php\?pid=([^&"]+)[^"]*"[^>]*>\s*(\d+)\s*-\s*([^<]+?)\s*<\/a>/gi;
  let m;
  while ((m = rowRe.exec(html)) !== null) {
    results.push({
      place: parseInt(m[1], 10),
      pid: m[2].trim(),
      number: m[3].trim(),
      name: m[4].trim().replace(/\s+/g, ' '),
    });
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
  if (standings.length === 0) return json({ error: 'No standings found at that URL' }, 422);

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
