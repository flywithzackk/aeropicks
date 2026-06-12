import { getUserFromContext, unauthorized, forbidden, json, stores, uid } from './_shared.js';

// Parses watchmefly.net competition pilot pages (v=pp).
// Real page structure (one block per pilot):
//   Pilot #N    (in <h6>)
//   <h5><a href="...pilot.php?pid=...">LASTNAME, First</a></h5>
//   <img src=".../flags/xx.png"> Country Name
//   (optional) Balloon: "Name"

export default async (req, context) => {
  const user = getUserFromContext(context, req);
  if (!user) return unauthorized();
  if (!user.isAdmin) return forbidden();

  const { competitionId, url } = await req.json();
  if (!url || !competitionId) return json({ error: 'competitionId and url required' }, 400);
  if (!/watchmefly\.net/i.test(url)) {
    return json({ error: 'URL must be a watchmefly.net link' }, 400);
  }

  // Force the pilots view (?v=pp)
  let fetchUrl = url;
  if (/[?&]v=[a-z]+/i.test(fetchUrl)) {
    fetchUrl = fetchUrl.replace(/([?&])v=[a-z]+/i, '$1v=pp');
  } else {
    fetchUrl += (fetchUrl.includes('?') ? '&' : '?') + 'v=pp';
  }

  try {
    const res = await fetch(fetchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WagerAndWind/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) return json({ error: `Watchmefly returned ${res.status}` }, 502);
    const html = await res.text();

    const competitors = [];
    const pilotMarkerRegex = /Pilot\s*#(\d+)/gi;
    const markers = [...html.matchAll(pilotMarkerRegex)];

    for (let i = 0; i < markers.length; i++) {
      const start = markers[i].index;
      const end = i + 1 < markers.length ? markers[i + 1].index : start + 4000;
      const block = html.slice(start, end);
      const pilotNumber = markers[i][1];

      // Name from profile anchor (most reliable)
      let name = '';
      const profileLink = block.match(/<a[^>]+pilot\.php[^>]*>([\s\S]*?)<\/a>/i);
      if (profileLink) {
        name = profileLink[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      }
      if (!name) {
        const h5 = block.match(/<h5[^>]*>([\s\S]*?)<\/h5>/i);
        if (h5) name = h5[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      }
      if (!name) continue;

      // Country from flag image's trailing text
      let country = '';
      const flagMatch = block.match(/flags\/([a-z]{2})\.png[^>]*>\s*([^<]+)/i);
      if (flagMatch) country = flagMatch[2].replace(/\s+/g, ' ').trim();

      // Balloon name (optional)
      let balloon = '';
      const balloonMatch = block.match(/Balloon:\s*["“]?([^"”<\n]+)["”]?/i);
      if (balloonMatch) {
        balloon = balloonMatch[1].replace(/\s+/g, ' ').trim().replace(/^["“]|["”]$/g, '').trim();
      }

      competitors.push({ name, country, balloon, number: pilotNumber });
    }

    if (competitors.length === 0) {
      return json({ error: 'Could not extract competitors. Try Excel upload instead.', count: 0 }, 422);
    }

    // De-dupe by name
    const seen = new Set();
    const deduped = competitors.filter(c => {
      const k = c.name.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    // Save (replace)
    const store = stores.competitions();
    const comp = await store.get(competitionId, { type: 'json' });
    if (!comp) return json({ error: 'competition not found' }, 404);
    comp.competitors = deduped.map(c => ({ id: uid(), ...c, odds: '' }));
    comp.updatedAt = Date.now();
    await store.setJSON(competitionId, comp);

    return json({ count: deduped.length, competitors: deduped });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
};
