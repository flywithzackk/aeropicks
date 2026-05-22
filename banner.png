import { getUserFromContext, unauthorized, forbidden, json, stores, uid } from './_shared.js';
import { calculateOdds } from './_odds.js';

// Full pilot dataset for RGC 2026
// photo / balloonPhoto: URLs (will be re-hosted later for production)
// world / us: rankings (null if unranked)
// history: recent profile finishes (newest first)
// stateResults: past RGC finishes [2024, 2025]
const RGC_PILOTS = [
  { num:1,  name:'BLOOM, Cory',            photo:'https://watchmefly.net/assets/uploads/pilots/p1715014304.jpg',  balloon:null,                 balloonPhoto:null, world:158, us:5,    history:[4,5,10,16,4,1,5,13,2],         stateResults:[9,2] },
  { num:2,  name:'HEARTSILL, Joe',         photo:'https://watchmefly.net/assets/uploads/pilots/p1642467364.jpg',  balloon:'Texas Racer',        balloonPhoto:'https://watchmefly.net/assets/uploads/aircraft/a1644875398.jpg', world:4,   us:3,    history:[50,35,3,3,7,7,19,1],           stateResults:[1,3] },
  { num:3,  name:'SKINNER, Jobe',          photo:'https://watchmefly.net/assets/uploads/pilots/p1748814848.jpg',  balloon:'Texas Bandit',       balloonPhoto:'https://watchmefly.net/assets/uploads/aircraft/a1749416714.jpeg', world:205, us:15,   history:[17,46,15,4,2],                 stateResults:[4] },
  { num:4,  name:'AKIN, JB',               photo:'https://watchmefly.net/assets/uploads/pilots/p1684774204.jpg',  balloon:'Little Bit',         balloonPhoto:'https://watchmefly.net/assets/uploads/aircraft/a1689476947.jpg', world:null,us:null, history:[76,26,21,28],                  stateResults:[21,26] },
  { num:5,  name:'BARTRA, Alex',           photo:'https://watchmefly.net/assets/uploads/pilots/p1768956627.jpg',  balloon:null,                 balloonPhoto:null, world:null,us:null, history:[29],                           stateResults:[] },
  { num:6,  name:'BILLSON, Peg',           photo:'https://watchmefly.net/assets/uploads/pilots/p1679929689.jpg',  balloon:'Shilo',              balloonPhoto:'https://watchmefly.net/assets/uploads/aircraft/a1709086439.jpg', world:363, us:47,   history:[6,5,3,8,49,14,14,49,7,13],     stateResults:[7,14] },
  { num:7,  name:'BYER, Ryan',             photo:'https://watchmefly.net/assets/uploads/pilots/p1702846878.jpg',  balloon:'Mischief',           balloonPhoto:'https://watchmefly.net/assets/uploads/aircraft/a1716141174.jpg', world:null,us:null, history:[36,28,22,14],                  stateResults:[22,28] },
  { num:8,  name:'CALDWELL, Trenten',      photo:'https://watchmefly.net/assets/uploads/pilots/p1681581711.jpg',  balloon:'Wild Child',         balloonPhoto:'https://watchmefly.net/assets/uploads/aircraft/a1689478936.jpg', world:null,us:null, history:[15,6,37,5,10,9],               stateResults:[5,6] },
  { num:9,  name:'CANDELARIA, Gerald Joe', photo:'https://watchmefly.net/assets/uploads/pilots/p1684971029.jpg',  balloon:'Mr. Blue Skies',     balloonPhoto:'https://watchmefly.net/assets/uploads/aircraft/a1689477318.jpg', world:null,us:null, history:[38,15,15,17],                  stateResults:[15,15] },
  { num:10, name:'COFFING, Stephen',       photo:null,                                                            balloon:null,                 balloonPhoto:null, world:null,us:null, history:[17,26,16],                     stateResults:[26,17] },
  { num:11, name:'DEGATTIS, Colin',        photo:'https://watchmefly.net/assets/uploads/pilots/p1682548915.jpg',  balloon:'Happy Endings',      balloonPhoto:'https://watchmefly.net/assets/uploads/aircraft/a1724551895.jpg', world:null,us:null, history:[33,19],                        stateResults:[33] },
  { num:12, name:'DEPOY, Justin',          photo:'https://watchmefly.net/assets/uploads/pilots/p1771562960.jpg',  balloon:null,                 balloonPhoto:null, world:null,us:null, history:[],                             stateResults:[] },
  { num:13, name:'EICHHORN, David',        photo:'https://watchmefly.net/assets/uploads/pilots/p1660083964.jpg',  balloon:'Mischief Managed',   balloonPhoto:'https://watchmefly.net/assets/uploads/aircraft/a4567544.jpg', world:349, us:45,   history:[64,47,29,12,5,22,32,41],       stateResults:[12,29] },
  { num:14, name:'GARCIA, Chris',          photo:'https://watchmefly.net/assets/uploads/pilots/p1734829172.jpg',  balloon:'Half Fast',          balloonPhoto:'https://watchmefly.net/assets/uploads/aircraft/a1688042987.jpg', world:null,us:null, history:[25,23],                        stateResults:[25] },
  { num:15, name:'GARCIA, Triston',        photo:'https://watchmefly.net/assets/uploads/pilots/p1778131172.jpg',  balloon:null,                 balloonPhoto:null, world:null,us:null, history:[],                             stateResults:[] },
  { num:16, name:'GONZALES, Robert',       photo:'https://watchmefly.net/assets/uploads/pilots/p1731528834.jpg',  balloon:'Hard Earned',        balloonPhoto:'https://watchmefly.net/assets/uploads/aircraft/a1749416177.jpeg', world:268, us:29,   history:[19,96,30,5],                   stateResults:[] },
  { num:17, name:'HEAVIN, Gary',           photo:'https://watchmefly.net/assets/uploads/pilots/p1656718316.jpg',  balloon:'Almost Heavin',      balloonPhoto:'https://watchmefly.net/assets/uploads/aircraft/a1626238698.jpg', world:337, us:43,   history:[45,45,11,15,3,33,39,34,37,28], stateResults:[33,11] },
  { num:18, name:'KAUFMAN, Blair',         photo:null,                                                            balloon:"Heart's Desire",     balloonPhoto:'https://watchmefly.net/assets/uploads/aircraft/a1689476206.jpg', world:null,us:null, history:[49,31,31,31],                  stateResults:[31,31] },
  { num:19, name:'MANCINI, J.J.',          photo:'https://watchmefly.net/assets/uploads/pilots/p1685221629.jpg',  balloon:'Mr. Sprinkles',      balloonPhoto:'https://watchmefly.net/assets/uploads/aircraft/a1689477382.jpg', world:null,us:null, history:[],                             stateResults:[] },
  { num:20, name:'PALMER, Gerry',          photo:'https://watchmefly.net/assets/uploads/pilots/p1739675720.jpg',  balloon:'IONA',               balloonPhoto:'https://watchmefly.net/assets/uploads/aircraft/a1745637851.jpg', world:null,us:null, history:[27,6,30,29],                   stateResults:[30] },
  { num:21, name:'SCHWEMMER, Kasey',       photo:'https://watchmefly.net/assets/uploads/pilots/p1775426750.jpg',  balloon:'Zenith',             balloonPhoto:'https://watchmefly.net/assets/uploads/aircraft/a1685737995.jpg', world:165, us:9,    history:[27,9,6,27,24,13,49,31],        stateResults:[13,27] },
  { num:22, name:'SHIPMAN, Shane',         photo:'https://watchmefly.net/assets/uploads/pilots/p1683838312.jpg',  balloon:null,                 balloonPhoto:null, world:null,us:null, history:[170,20,5,16,1],                stateResults:[16,20] },
  { num:23, name:'SPEICHER, Shawn',        photo:'https://watchmefly.net/assets/uploads/pilots/p1680195056.jpg',  balloon:'Gut Punched',        balloonPhoto:'https://watchmefly.net/assets/uploads/aircraft/a1724551801.jpg', world:290, us:34,   history:[9,35,12,41,10,4,17],           stateResults:[10,12] },
  { num:24, name:'STANKE, Natasha',        photo:'https://watchmefly.net/assets/uploads/pilots/p1708548605.jpg',  balloon:'Wonder Woman',       balloonPhoto:'https://watchmefly.net/assets/uploads/aircraft/a1708467005.jpg', world:null,us:null, history:[51,4,13,5,44,19,9,2,16],       stateResults:[19,13] },
  { num:25, name:'SULLIVAN, Mark',         photo:'https://watchmefly.net/assets/uploads/pilots/p1682429383.jpg',  balloon:'Code Red',           balloonPhoto:'https://watchmefly.net/assets/uploads/aircraft/a1743519030.jpg', world:278, us:32,   history:[86,33,16,30,20,20,44],         stateResults:[20,16] },
  { num:26, name:'TAKACH, Keith',          photo:'https://watchmefly.net/assets/uploads/pilots/p1681672059.jpg',  balloon:'2 Fast Takach',      balloonPhoto:'https://watchmefly.net/assets/uploads/aircraft/a1689465338.jpg', world:null,us:null, history:[39,9,14,12],                   stateResults:[14,9] },
  { num:27, name:'TRAINOR, Jarrod',        photo:'https://watchmefly.net/assets/uploads/pilots/p1777583560.jpg',  balloon:null,                 balloonPhoto:null, world:null,us:null, history:[34],                           stateResults:[] },
  { num:28, name:'WELZ, Zerek',            photo:'https://watchmefly.net/assets/uploads/pilots/p1686627046.jpg',  balloon:'Guilty',             balloonPhoto:'https://watchmefly.net/assets/uploads/aircraft/a5445667.jpg', world:218, us:17,   history:[52,34,17,10,7,23,10,26],       stateResults:[10] },
  { num:29, name:'WILSON, John',           photo:'https://watchmefly.net/assets/uploads/pilots/p1681618916.jpg',  balloon:"JAW's",              balloonPhoto:'https://watchmefly.net/assets/uploads/aircraft/a1689476737.jpg', world:null,us:null, history:[107,19,8,8],                   stateResults:[8,19] },
  { num:30, name:'WOOD, Bruce',            photo:'https://watchmefly.net/assets/uploads/pilots/p1748986066.jpg',  balloon:'OTTR',               balloonPhoto:'https://watchmefly.net/assets/uploads/aircraft/a1689477627.jpg', world:131, us:21,   history:[8,22,8,5,21,12,8,40,4,6],      stateResults:[6,8] },
  { num:31, name:'WRIGHT, Jonathan',       photo:'https://watchmefly.net/assets/uploads/pilots/p1749571176.jpg',  balloon:'Unchained Remix',    balloonPhoto:'https://watchmefly.net/assets/uploads/aircraft/a1652712485.jpg', world:117, us:23,   history:[24,7,10,3,43,9,12,39],         stateResults:[3,7] },
];

export default async (req, context) => {
  const user = getUserFromContext(context, req);
  if (!user) return unauthorized();
  if (!user.isAdmin) return forbidden();

  const store = stores.competitions();
  const { blobs } = await store.list();
  const all = await Promise.all(blobs.map(b => store.get(b.key, { type: 'json' })));

  let comp = all.find(c => c && c.name === 'Rio Grande Classic 2026');
  if (!comp) {
    comp = {
      id: uid(),
      name: 'Rio Grande Classic 2026',
      location: 'Rio Rancho, NM',
      dates: 'TBD',
      eventLevel: 'state', // state | national | world
      description: 'New Mexico State Championship featuring 31 pilots.',
      status: 'live',
      wildcard: null, // admin will configure
      competitors: [],
      createdAt: Date.now(),
    };
  }

  // Run the odds algorithm using the State event weighting
  const withOdds = calculateOdds(RGC_PILOTS, 'state');

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
    // admin overrides (null = use algorithm odds)
    overrideOdds: null,
  }));
  comp.updatedAt = Date.now();
  await store.setJSON(comp.id, comp);

  return json({ ok: true, competitionId: comp.id, name: comp.name, pilotCount: comp.competitors.length });
};
