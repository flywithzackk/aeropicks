// Aeropicks Odds Algorithm v3 - event-aware weighting
// State events: state > national > world
// National events: national > world > state
// World events: world > national > state

const WEIGHTS = {
  state:    { state: 5.0, national: 2.5, world: 1.5, form: 1.5 },
  national: { state: 1.5, national: 5.0, world: 3.0, form: 1.5 },
  world:    { state: 0.5, national: 2.5, world: 5.0, form: 1.5 },
};

function skillScore(pilot, eventLevel = 'state') {
  const w = WEIGHTS[eventLevel] || WEIGHTS.state;
  const components = [];
  const weights = [];

  if (pilot.us != null) {
    const s = Math.max(0, 100 - (pilot.us - 1) * 1.5);
    components.push(s); weights.push(w.national);
  }
  if (pilot.world != null) {
    const s = Math.max(0, 100 - (pilot.world - 1) * 0.25);
    components.push(s); weights.push(w.world);
  }

  // State = direct head-to-head results from this competition's history
  const stateResults = (pilot.stateResults || []).filter(x => x != null);
  if (stateResults.length > 0) {
    const avg = stateResults.reduce((a, b) => a + b, 0) / stateResults.length;
    const s = Math.max(0, 100 - (avg - 1) * 3.3);
    components.push(s); weights.push(w.state);
  }

  // Broader form
  const history = pilot.history || [];
  if (history.length > 0) {
    const h = [...history];
    if (h.length >= 4) {
      const worst = Math.max(...h);
      h.splice(h.indexOf(worst), 1);
    }
    const recencyWeights = h.map((_, i) => Math.pow(0.85, i));
    const wsum = recencyWeights.reduce((a, b) => a + b, 0);
    const avgPlace = h.reduce((sum, p, i) => sum + p * recencyWeights[i], 0) / wsum;
    const s = Math.max(0, 100 - (avgPlace - 1) * 2.0);
    components.push(s); weights.push(w.form);
  }

  if (components.length === 0) return 12; // rookie
  const total = components.reduce((sum, c, i) => sum + c * weights[i], 0);
  const wtotal = weights.reduce((a, b) => a + b, 0);
  return total / wtotal;
}

function placeProbabilities(score, nPilots = 31) {
  const meanPlace = 2 + (100 - score) * 0.23;
  const spread = 5.5 + (100 - score) * 0.07;
  const probs = {};
  for (let p = 1; p <= nPilots; p++) {
    probs[p] = Math.exp(-Math.pow(p - meanPlace, 2) / (2 * spread * spread));
  }
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  for (const p of Object.keys(probs)) probs[p] /= total;
  return probs;
}

function oddsForPlace(probability) {
  if (probability <= 0.0001) return 150.0;
  const raw = 1 / probability;
  let fair = raw * 0.92;
  if (fair > 8) fair = 8 + Math.pow(fair - 8, 1.10);
  return Math.round(Math.min(fair, 150.0) * 10) / 10;
}

// Calculate odds for every pilot at every position
function calculateOdds(pilots, eventLevel = 'state') {
  const nPilots = pilots.length;
  return pilots.map(pilot => {
    const score = skillScore(pilot, eventLevel);
    const probs = placeProbabilities(score, nPilots);
    const oddsByPlace = {};
    for (let p = 1; p <= nPilots; p++) {
      oddsByPlace[p] = oddsForPlace(probs[p]);
    }
    return {
      ...pilot,
      skillScore: Math.round(score * 10) / 10,
      oddsByPlace,
      top10Pct: Math.round(
        Array.from({ length: Math.min(10, nPilots) }, (_, i) => probs[i + 1] || 0)
          .reduce((a, b) => a + b, 0) * 100
      ),
    };
  });
}

export { skillScore, placeProbabilities, oddsForPlace, calculateOdds };
