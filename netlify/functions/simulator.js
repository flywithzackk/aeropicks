import { getUserFromContext, unauthorized, forbidden, json, stores, uid } from './_shared.js';

// Test member simulator for end-to-end flow verification.
//
// POST /api/simulator { competitionId, count } — spawns `count` fake members with random bets
// DELETE /api/simulator — wipes all simulated members (their bets, winnings, profiles)
// GET /api/simulator?competitionId=X — returns count of simulated members for this comp

const TEST_PREFIX = 'sim_'; // user IDs that start with this are simulated

const FAKE_USERNAMES = [
  'AeroAce', 'WindRider', 'BalloonBoss', 'SkyHigh42', 'CloudJumper',
  'PilotPete', 'BurnerBob', 'AltitudeAnnie', 'BasketCase', 'ThermalThief',
  'JetStreamJoe', 'DriftKing', 'CrosswindCarl', 'EnvelopeEd', 'ZephyrZach',
  'TailwindTina', 'AviatorAva', 'PropPilot', 'CumulusKid', 'StratoStan',
];

const PHOTO_PLACEHOLDERS = [
  'https://i.pravatar.cc/150?img=1',
  'https://i.pravatar.cc/150?img=2',
  'https://i.pravatar.cc/150?img=3',
  'https://i.pravatar.cc/150?img=4',
  'https://i.pravatar.cc/150?img=5',
  'https://i.pravatar.cc/150?img=6',
  'https://i.pravatar.cc/150?img=7',
  'https://i.pravatar.cc/150?img=8',
  'https://i.pravatar.cc/150?img=9',
  'https://i.pravatar.cc/150?img=10',
];

function randomBetsForCompetition(competitors) {
  // Place 3-7 random bets totaling ~700-1000 points
  const numBets = 3 + Math.floor(Math.random() * 5);
  const bets = [];
  let remainingPoints = 1000;

  for (let i = 0; i < numBets && remainingPoints > 50; i++) {
    const pilot = competitors[Math.floor(Math.random() * competitors.length)];
    if (!pilot.oddsByPlace) continue;
    // Bias toward picking the best odds positions for each pilot (more realistic)
    const sortedPlaces = Object.entries(pilot.oddsByPlace)
      .sort((a, b) => Number(a[1]) - Number(b[1]))
      .slice(0, 5)
      .map(([place]) => Number(place));
    const place = sortedPlaces[Math.floor(Math.random() * sortedPlaces.length)];
    const points = Math.min(remainingPoints, 50 + Math.floor(Math.random() * 250));
    const odds = pilot.overrideOdds?.[place] ?? pilot.oddsByPlace?.[place] ?? 0;
    if (odds <= 0) continue;
    bets.push({ pilotId: pilot.id, place, points, odds, status: 'pending' });
    remainingPoints -= points;
  }
  return bets;
}

export default async (req, context) => {
  const user = getUserFromContext(context, req);
  if (!user) return unauthorized();
  if (!user.isAdmin) return forbidden();

  const url = new URL(req.url);
  const competitionId = url.searchParams.get('competitionId');

  const compStore = stores.competitions();
  const betsStore = stores.bets();
  const profilesStore = stores.profiles();
  const winningsStore = stores.winnings();

  if (req.method === 'GET') {
    // Count existing simulated profiles
    const { blobs } = await profilesStore.list();
    const simCount = blobs.filter(b => b.key.startsWith(TEST_PREFIX)).length;
    return json({ simulatedMembers: simCount });
  }

  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    const { competitionId: compId, count = 10 } = body;
    if (!compId) return json({ error: 'competitionId required' }, 400);

    const comp = await compStore.get(compId, { type: 'json' });
    if (!comp) return json({ error: 'competition not found' }, 404);
    if (!comp.competitors || comp.competitors.length === 0) {
      return json({ error: 'competition has no pilots — seed it first' }, 400);
    }

    const created = [];
    const usedNames = new Set();
    // Existing sim names
    const { blobs: existingProfiles } = await profilesStore.list();
    for (const b of existingProfiles) {
      if (b.key.startsWith(TEST_PREFIX)) {
        const p = await profilesStore.get(b.key, { type: 'json' });
        if (p?.username) usedNames.add(p.username.toLowerCase());
      }
    }

    for (let i = 0; i < Math.min(count, 20); i++) {
      // Find an unused username
      let username;
      for (let tries = 0; tries < 30; tries++) {
        const base = FAKE_USERNAMES[Math.floor(Math.random() * FAKE_USERNAMES.length)];
        const suffix = Math.floor(Math.random() * 100);
        const candidate = `${base}${suffix}`;
        if (!usedNames.has(candidate.toLowerCase())) {
          username = candidate;
          usedNames.add(candidate.toLowerCase());
          break;
        }
      }
      if (!username) continue;

      const userId = `${TEST_PREFIX}${uid()}`;
      const photo = PHOTO_PLACEHOLDERS[Math.floor(Math.random() * PHOTO_PLACEHOLDERS.length)];

      // Profile
      await profilesStore.setJSON(userId, {
        userId,
        username,
        photo,
        email: `${username.toLowerCase()}@simulated.aeropicks`,
        updatedAt: Date.now(),
        simulated: true,
      });

      // Bets
      const userBets = (await betsStore.get(userId, { type: 'json' })) || {};
      const bets = randomBetsForCompetition(comp.competitors);
      const totalWagered = bets.reduce((s, b) => s + b.points, 0);
      userBets[compId] = {
        bets,
        wildcard: null,
        remaining: 1000 - totalWagered,
        placedAt: Date.now(),
      };
      await betsStore.setJSON(userId, userBets);

      created.push({ userId, username, photo, betsPlaced: bets.length });
    }

    return json({ ok: true, created, count: created.length });
  }

  if (req.method === 'DELETE') {
    // Wipe all simulated members across stores
    const { blobs: profileBlobs } = await profilesStore.list();
    let removed = 0;
    for (const b of profileBlobs) {
      if (!b.key.startsWith(TEST_PREFIX)) continue;
      await profilesStore.delete(b.key);
      try { await betsStore.delete(b.key); } catch {}
      try { await winningsStore.delete(b.key); } catch {}
      removed++;
    }
    return json({ ok: true, removed });
  }

  return json({ error: 'method not allowed' }, 405);
};
