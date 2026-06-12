import { getUserFromContext, unauthorized, forbidden, json, stores } from './_shared.js';
import { calculateOdds } from './_odds.js';

// Pull US National Rankings from the BFA National Eligibility List, hosted at:
//   https://watchmefly.net/bfa/nel.php?year=YYYY
//
// We match competitors by their WatchMeFly PID (perfect 1:1 match, no fuzzy name matching).
// For pilots without a stored wmfPid (e.g. manually added or seeded), we fall back to
// fuzzy name matching as a last resort.
//
// POST body: { competitionId, year? }
// Returns: { matched: [...], unmatched: [...], pilotsUpdated, recalculated: true }

function parseNelRankings(html) {
  // The NEL table has rows like:
  //   <td>1</td>
  //   <td>...<a href="...nel_pilot.php?pid=ABC&year=YYYY">SKINNER, Jobe</a>...</td>
  //   <td>899.7</td>  (score)
  //
  // Same forgiving two-step approach as our other parsers:
  //   1. Find every nel_pilot.php anchor + extract pid + name
  //   2. For each, find the most recent <td>NUMBER</td> before it = NEL rank

  const matches = [];
  const anchorRe = /<a\s+[^>]*href="[^"]*nel_pilot\.php\?pid=([^&"]+)[^"]*"[^>]*>\s*([^<]+?)\s*<\/a>/gi;
  let m;
  while ((m = anchorRe.exec(html)) !== null) {
    matches.push({
      index: m.index,
      pid: m[1].trim(),
      name: m[2].trim().replace(/\s+/g, ' '),
    });
  }

  const placeRe = /<td[^>]*>\s*(\d+)\s*\.?\s*<\/td>/gi;
  const places = [];
  while ((m = placeRe.exec(html)) !== null) {
    places.push({ index: m.index, place: parseInt(m[1], 10) });
  }

  const seen = new Set();
  const results = [];
  for (const a of matches) {
    if (seen.has(a.pid)) continue;
    let bestPlace = null;
    for (const p of places) {
      if (p.index < a.index) {
        if (!bestPlace || p.index > bestPlace.index) bestPlace = p;
      }
    }
    if (bestPlace && bestPlace.place > 0 && bestPlace.place < 500) {
      if (results.some(r => r.usRank === bestPlace.place)) continue;
      results.push({
        usRank: bestPlace.place,
        pid: a.pid,
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
  const { competitionId, year } = body;
  if (!competitionId) return json({ error: 'competitionId required' }, 400);

  const useYear = year || new Date().getFullYear();
  const nelUrl = `https://watchmefly.net/bfa/nel.php?year=${useYear}`;

  let html;
  let httpStatus;
  try {
    const r = await fetch(nelUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    httpStatus = r.status;
    if (!r.ok) return json({ error: `BFA NEL page returned ${r.status}`, url: nelUrl }, 502);
    html = await r.text();
  } catch (ex) {
    return json({ error: `Could not reach BFA NEL page: ${ex.message}` }, 502);
  }

  const rankings = parseNelRankings(html);
  if (rankings.length === 0) {
    const snippet = html.slice(0, 600).replace(/\s+/g, ' ');
    return json({
      error: 'No NEL rankings parsed from page',
      hint: 'BFA NEL HTML structure may have changed. Try a different year.',
      url: nelUrl,
      httpStatus,
      htmlLength: html.length,
      htmlSnippet: snippet,
    }, 422);
  }

  // Build lookup tables: pid -> rank, normalized_name -> rank
  const rankByPid = {};
  const rankByName = {};
  for (const r of rankings) {
    rankByPid[r.pid] = r.usRank;
    rankByName[normalizeName(r.name)] = r.usRank;
  }

  // Load competition + match each competitor
  const compStore = stores.competitions();
  const comp = await compStore.get(competitionId, { type: 'json' });
  if (!comp) return json({ error: 'Competition not found' }, 404);
  if (!comp.competitors?.length) return json({ error: 'Competition has no pilots yet' }, 400);

  const matched = [];
  const unmatched = [];

  for (const c of comp.competitors) {
    let rank = null;
    let matchMethod = null;

    // Method 1: exact PID match (preferred)
    if (c.wmfPid && rankByPid[c.wmfPid]) {
      rank = rankByPid[c.wmfPid];
      matchMethod = 'pid';
    }

    // Method 2: exact normalized name match
    if (!rank) {
      const n = normalizeName(c.name);
      if (rankByName[n]) {
        rank = rankByName[n];
        matchMethod = 'name-exact';
      }
    }

    // Method 3: fuzzy partial name match (one direction only to avoid false positives)
    if (!rank) {
      const n = normalizeName(c.name);
      for (const [rn, rk] of Object.entries(rankByName)) {
        if (n.length >= 8 && rn.includes(n)) {
          rank = rk;
          matchMethod = 'name-fuzzy';
          break;
        }
        if (rn.length >= 8 && n.includes(rn)) {
          rank = rk;
          matchMethod = 'name-fuzzy';
          break;
        }
      }
    }

    if (rank) {
      c.us = rank;
      matched.push({ name: c.name, usRank: rank, matchMethod });
    } else {
      unmatched.push({ name: c.name, wmfPid: c.wmfPid || null });
    }
  }

  // Recalculate odds with the new ranking data
  const eventLevel = comp.eventLevel || 'state';
  const withOdds = calculateOdds(
    comp.competitors.map(p => ({
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

  comp.competitors = comp.competitors.map((c, i) => ({
    ...c,
    skillScore: withOdds[i].skillScore,
    top10Pct: withOdds[i].top10Pct,
    oddsByPlace: withOdds[i].oddsByPlace,
  }));

  comp.updatedAt = Date.now();
  await compStore.setJSON(competitionId, comp);

  return json({
    ok: true,
    year: useYear,
    nelEntriesParsed: rankings.length,
    pilotsUpdated: matched.length,
    matched,
    unmatched,
    note: matched.length > 0
      ? `Updated ${matched.length} pilots with US National rankings. Odds recalculated.`
      : 'No pilots matched — they may not be on the NEL for this year yet.',
  });
};
