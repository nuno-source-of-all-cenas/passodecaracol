/* seed.js: the demo city, its routes and segments, fictional athletes and a
   deterministic history of activities. Everything here is invented. */
'use strict';

function loopPts(cx, cy, rx, ry, n, a0, wob, seed) {
  const r = mulberry32(seed), out = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (i / n) * Math.PI * 2, k = 1 + wob * (r() - 0.5);
    out.push([Math.round(cx + Math.cos(a) * rx * k), Math.round(cy + Math.sin(a) * ry * k)]);
  }
  out[n] = out[0].slice();
  return out;
}
function wigglyLine(x0, x1, y, step, amp, per) {
  const out = [], dir = Math.sign(x1 - x0);
  for (let x = x0; dir > 0 ? x <= x1 : x >= x1; x += dir * step) out.push([x, Math.round(y + amp * Math.sin(x / per))]);
  if (out[out.length - 1][0] !== x1) out.push([x1, Math.round(y + amp * Math.sin(x1 / per))]);
  return out;
}

const PARK_LOOP = loopPts(-2600, 2300, 950, 820, 18, -Math.PI * 0.75, 0.25, 7);
const RIDGE_LOOP = loopPts(-6500, 3600, 2100, 1700, 24, -Math.PI * 0.4, 0.18, 11);
const MARG_OUT = wigglyLine(0, -9600, -1540, 400, 35, 700);

const BASE_ROUTES = {
  ribeira: { name: 'Volta ribeirinha', sport: 'run', pts: [[0, -1280], [0, -1520], [3200, -1520], [3200, -640], [0, -640], [0, -1280]] },
  miradouro: { name: 'Subida ao miradouro', sport: 'run', pts: [[0, -1280], [0, 0], [1120, 0], [1120, 960], [1440, 960], [1440, -320], [0, -320], [0, -1280]] },
  parque: { name: 'Trilhos do parque', sport: 'trail_run', pts: [[-320, -1280], [-320, -320], [-1440, 480], ...PARK_LOOP, [-1440, 480], [-320, -320], [-320, -1280]] },
  baixa: { name: 'Passeio na baixa', sport: 'walk', pts: [[0, -1280], [640, -1280], [640, -480], [-480, -480], [-480, -1280], [0, -1280]] },
  marginal: { name: 'Marginal', sport: 'ride', pts: [[0, -1280], ...MARG_OUT, ...MARG_OUT.slice(0, -1).reverse(), [0, -1280]] },
  serra: { name: 'Volta da serra', sport: 'ride', pts: [[0, -1280], [0, -640], [-1600, -640], [-3400, 900], ...RIDGE_LOOP, [-3400, 900], [-1600, -640], [0, -640], [0, -1280]] },
  colina: { name: 'Colinas a nascente', sport: 'ride', pts: [[0, -1280], [3200, -1280], ...loopPts(4200, 2600, 1400, 1300, 16, -Math.PI / 2, 0.2, 5), [3200, -1280], [0, -1280]] },
};

const SEGMENT_DEFS = [
  { id: 'sg1', name: 'Sprint do cais', sport: 'run', pts: [[800, -1520], [2400, -1520]] },
  { id: 'sg2', name: 'Rampa do miradouro', sport: 'run', pts: [[1120, 0], [1120, 960]] },
  { id: 'sg3', name: 'Descida do castelo', sport: 'run', pts: [[1440, 960], [1440, -320]] },
  { id: 'sg4', name: 'Avenida do regresso', sport: 'run', pts: [[3200, -640], [0, -640]] },
  { id: 'sg5', name: 'Trilho do pinhal', sport: 'run', pts: PARK_LOOP.slice(3, 10) },
  { id: 'sg6', name: 'Reta da marginal', sport: 'ride', pts: wigglyLine(-2000, -7200, -1540, 400, 35, 700) },
  { id: 'sg7', name: 'Subida da serra', sport: 'ride', pts: RIDGE_LOOP.slice(2, 9) },
  { id: 'sg8', name: 'Muro das colinas', sport: 'ride', pts: loopPts(4200, 2600, 1400, 1300, 16, -Math.PI / 2, 0.2, 5).slice(1, 5) },
];

const PEOPLE = [
  { id: 'u0', name: 'Nuno', sex: 'm', city: 'Lisboa', ability: 1.04, hr: true, sports: ['run', 'run', 'run', 'trail_run', 'ride', 'walk'] },
  { id: 'u1', name: 'Marta Ribeiro', sex: 'f', city: 'Lisboa', ability: 1.12, hr: true, sports: ['run', 'run', 'trail_run'] },
  { id: 'u2', name: 'João Almeida', sex: 'm', city: 'Oeiras', ability: 1.08, hr: true, sports: ['ride', 'ride', 'run'] },
  { id: 'u3', name: 'Inês Carvalho', sex: 'f', city: 'Lisboa', ability: 0.98, hr: false, sports: ['run', 'walk', 'run'] },
  { id: 'u4', name: 'Rui Fonseca', sex: 'm', city: 'Almada', ability: 1.15, hr: true, sports: ['ride', 'ride', 'ride'] },
  { id: 'u5', name: 'Sofia Mendes', sex: 'f', city: 'Lisboa', ability: 1.06, hr: true, sports: ['ride', 'run', 'ride'] },
  { id: 'u6', name: 'Tiago Pires', sex: 'm', city: 'Amadora', ability: 0.94, hr: false, sports: ['run', 'walk', 'hike'] },
  { id: 'u7', name: 'Beatriz Lopes', sex: 'f', city: 'Lisboa', ability: 1.0, hr: true, sports: ['trail_run', 'hike', 'run'] },
  { id: 'u8', name: 'André Costa', sex: 'm', city: 'Cascais', ability: 1.1, hr: true, sports: ['run', 'run', 'ride'] },
  { id: 'u9', name: 'Carla Nunes', sex: 'f', city: 'Lisboa', ability: 0.9, hr: false, sports: ['walk', 'run', 'swim'] },
  { id: 'u10', name: 'Pedro Sá', sex: 'm', city: 'Loures', ability: 1.02, hr: true, sports: ['ride', 'run', 'workout'] },
];

const NAMES = {
  run: ['Corrida matinal', 'Rodagem tranquila', 'Treino de ritmo', 'Longão de domingo', 'Séries no cais', 'Corrida ao fim da tarde', 'Recuperação leve', 'Corrida com o clube'],
  trail_run: ['Trilho com nevoeiro', 'Subidas no parque', 'Trail entre pinheiros'],
  ride: ['Pedalada pela marginal', 'Volta à serra', 'Café a meio da volta', 'Treino de cadência', 'Saída de grupo'],
  walk: ['Passeio ao fim da tarde', 'Caminhada com o cão', 'Volta pela baixa'],
  hike: ['Caminhada no parque', 'Serra ao sábado'],
  swim: ['Piscina: 40 × 50 m', 'Natação técnica'],
  workout: ['Força: pernas e core', 'Mobilidade e alongamentos'],
};
const COMMENT_POOL = ['Que ritmo!', 'Essa rampa não perdoa.', 'Boa recuperação.', 'Estás em grande forma.', 'Para a próxima vou contigo.', 'Esse parcial do km 6 está fortíssimo.', 'Bora repetir no sábado?', 'O vento hoje estava terrível.', 'Grande volta!', 'Belo desnível.'];
const ROUTES_BY_SPORT = { run: ['ribeira', 'miradouro', 'ribeira', 'miradouro', 'baixa'], trail_run: ['parque'], ride: ['marginal', 'serra', 'colina', 'marginal'], walk: ['baixa', 'ribeira'], hike: ['parque'] };

/* ---------- track synthesis ---------- */
function densify(pts, step = 5) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d / step));
    for (let k = 0; k < n; k++) out.push([x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n]);
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}
function pathLength(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }

/* A cursor that walks a polyline by distance. */
function makeWalker(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[cum.length - 1];
  let j = 0;
  return {
    total,
    at(s) {
      s = clamp(s, 0, total);
      if (s < cum[j]) j = 0;
      while (j < cum.length - 2 && cum[j + 1] < s) j++;
      const seg = cum[j + 1] - cum[j] || 1, f = (s - cum[j]) / seg;
      return [pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f];
    },
  };
}

const BASE_SPEED = { run: 3.05, trail_run: 2.45, ride: 7.6, walk: 1.42, hike: 1.2 };
const HR_REST = 52, HR_MAX = 188;

function synthTrack(routePts, sport, ability, seed, withHr, interval = 4) {
  const r = mulberry32(seed), w = makeWalker(routePts);
  const base = BASE_SPEED[sport] * ability, out = [];
  let s = 0, t = 0, noise = 0, ox = 0, oy = 0, hr = 92, lastEle = null;
  const fatigue = 0.04 * (w.total / 10000);
  while (true) {
    const [x, y] = w.at(s);
    const e = terrain(x, y), ahead = w.at(s + 15), grade = (terrain(ahead[0], ahead[1]) - e) / 15;
    noise = noise * 0.9 + (r() - 0.5) * 0.06;
    ox = clamp(ox * 0.85 + (r() - 0.5) * 1.6, -4, 4); oy = clamp(oy * 0.85 + (r() - 0.5) * 1.6, -4, 4);
    const gk = sport === 'ride' ? (grade > 0 ? 9 : 5) : (grade > 0 ? 4.2 : 1.8);
    let v = base * (1 + noise) * (1 - gk * grade) * (1 - fatigue * (s / w.total));
    v = clamp(v, base * 0.35, base * (sport === 'ride' ? 1.9 : 1.25));
    if (withHr) {
      const intensity = clamp(0.62 + 0.25 * (v / base - 1) + 3.2 * Math.max(0, grade) + 0.1 * (s / w.total), 0.45, 0.98);
      hr += (HR_REST + (HR_MAX - HR_REST) * intensity - hr) * 0.08;
    }
    const ll = toLL(x + ox, y + oy);
    const ele = lastEle == null ? e : lastEle * 0.6 + e * 0.4;
    lastEle = ele;
    out.push([+ll[0].toFixed(6), +ll[1].toFixed(6), +(ele + (r() - 0.5) * 0.4).toFixed(1), t, withHr ? Math.round(hr) : 0]);
    if (s >= w.total) break;
    s = Math.min(w.total, s + v * interval);
    t += interval;
  }
  return out;
}

/* ---------- the seed database ---------- */
function buildSeed() {
  const r = mulberry32(20261018);
  const now = Date.now(), today = startOfDay(now);
  const users = PEOPLE.map((p) => ({ id: p.id, name: p.name, sex: p.sex, city: p.city, ability: p.ability, hasHr: p.hr, bio: '', joined: today - (200 + Math.floor(r() * 900)) * 864e5 }));
  users[0].bio = 'A treinar para a meia-maratona de março.';
  const follows = [];
  ['u1', 'u2', 'u3', 'u4', 'u5', 'u7', 'u8'].forEach((u) => follows.push(['u0', u]));
  ['u1', 'u2', 'u3', 'u5', 'u6', 'u8'].forEach((u) => follows.push([u, 'u0']));
  for (let i = 1; i < PEOPLE.length; i++) for (let j = 1; j < PEOPLE.length; j++) if (i !== j && r() < 0.35) follows.push(['u' + i, 'u' + j]);

  const gear = [
    { id: 'g1', uid: 'u0', kind: 'shoe', name: 'Sapatilhas de estrada', brand: 'Asfalto Runner 4', baseKm: 548, alertKm: 700, retired: false, defaultFor: 'run' },
    { id: 'g2', uid: 'u0', kind: 'shoe', name: 'Sapatilhas de trilho', brand: 'Serrano GTX', baseKm: 212, alertKm: 800, retired: false, defaultFor: 'trail_run' },
    { id: 'g3', uid: 'u0', kind: 'bike', name: 'Bicicleta de estrada', brand: 'Ventura 105', baseKm: 3120, alertKm: 0, retired: false, defaultFor: 'ride' },
    { id: 'g4', uid: 'u0', kind: 'shoe', name: 'Sapatilhas antigas', brand: 'Asfalto Runner 3', baseKm: 812, alertKm: 700, retired: true, defaultFor: '' },
  ];

  const activities = [];
  PEOPLE.forEach((p, pi) => {
    const count = p.id === 'u0' ? 26 : 6 + Math.floor(r() * 5);
    const days = new Set();
    for (let k = 0; k < count; k++) {
      let d; do { d = Math.floor(r() * (p.id === 'u0' ? 78 : 40)); } while (days.has(d) && days.size < 70);
      days.add(d);
      if (p.id === 'u0' && k === 0) d = 1;
      const sport = p.sports[Math.floor(r() * p.sports.length)];
      const hour = 6 + Math.floor(r() * 13), start = today - d * 864e5 + hour * 36e5 + Math.floor(r() * 59) * 6e4;
      const names = NAMES[sport];
      const a = {
        id: `a${pi}_${k}`, uid: p.id, sport, name: names[Math.floor(r() * names.length)], desc: '', start,
        visibility: r() < 0.08 ? 'followers' : 'everyone', gearId: null, rpe: r() < 0.5 ? 3 + Math.floor(r() * 6) : null,
        photos: [], laps: [], hideStats: {}, created: start + 4e6,
      };
      if (SPORTS[sport].gps) {
        const opts = ROUTES_BY_SPORT[sport];
        a.gen = { route: opts[Math.floor(r() * opts.length)], seed: Math.floor(r() * 1e9), ability: p.ability * (0.93 + r() * 0.12), hr: p.hr };
        if (sport === 'ride' && a.gen.route === 'marginal' && r() < 0.5) a.name = 'Marginal até ao farol';
      } else {
        const dur = sport === 'swim' ? 2400 + r() * 1500 : 2700 + r() * 1800;
        a.manual = { dist: sport === 'swim' ? Math.round((1800 + r() * 1200) / 50) * 50 : 0, time: Math.round(dur), elev: 0 };
      }
      if (p.id === 'u0') {
        a.gearId = sport === 'run' ? 'g1' : sport === 'trail_run' ? 'g2' : sport === 'ride' ? 'g3' : null;
        if (k === 0) { a.name = 'Longão de domingo'; a.desc = 'Pernas pesadas no início, soltaram depois do km 3.'; a.sport = 'run'; a.gen = { route: 'miradouro', seed: 99, ability: 1.1, hr: true }; a.gearId = 'g1'; a.rpe = 7; }
      }
      activities.push(a);
    }
  });
  activities.sort((a, b) => b.start - a.start);

  const kudos = [], comments = [];
  activities.forEach((a) => {
    PEOPLE.forEach((p) => {
      if (p.id === a.uid || p.id === 'u0') return;
      if (r() < 0.32) kudos.push([a.id, p.id, a.start + 5e6 + r() * 4e7]);
    });
    if (r() < 0.3) {
      const who = PEOPLE[1 + Math.floor(r() * (PEOPLE.length - 1))].id;
      if (who !== a.uid) comments.push({ id: 'c' + comments.length, aid: a.id, uid: who, text: COMMENT_POOL[Math.floor(r() * COMMENT_POOL.length)], at: a.start + 7e6 + r() * 3e7 });
    }
  });
  // a few of my kudos on friends, so the feed shows given kudos too
  activities.filter((a) => a.uid !== 'u0').slice(0, 30).forEach((a) => { if (r() < 0.3) kudos.push([a.id, 'u0', a.start + 6e6]); });

  const clubs = [
    { id: 'cl1', name: 'Corredores da Ribeira', sport: 'run', city: 'Lisboa', desc: 'Corridas de grupo junto ao rio, todas as terças e quintas às 19h. Todos os ritmos.', members: ['u0', 'u1', 'u3', 'u6', 'u8', 'u9'], admin: 'u1' },
    { id: 'cl2', name: 'Pedal Atlântico', sport: 'ride', city: 'Oeiras', desc: 'Saídas de estrada ao sábado de manhã pela marginal e pela serra.', members: ['u2', 'u4', 'u5', 'u10'], admin: 'u4' },
    { id: 'cl3', name: 'Madrugadores das 6h', sport: 'run', city: 'Lisboa', desc: 'Para quem corre antes do trabalho. Café garantido no fim.', members: ['u0', 'u5', 'u8'], admin: 'u8' },
    { id: 'cl4', name: 'Trilhos & Serras', sport: 'hike', city: 'Sintra', desc: 'Trail e caminhadas de montanha. Saídas ao domingo, ponto de encontro no parque.', members: ['u6', 'u7', 'u9', 'u1'], admin: 'u7' },
  ];
  const posts = [
    { id: 'p1', club: 'cl1', uid: 'u1', text: 'Quinta-feira fazemos 8 km com 4 km a ritmo de prova. Ponto de encontro no cais, 19h.', at: now - 2 * 864e5 },
    { id: 'p2', club: 'cl1', uid: 'u8', text: 'Alguém para a meia-maratona de março? Podemos combinar treinos longos ao domingo.', at: now - 5 * 864e5 },
    { id: 'p3', club: 'cl2', uid: 'u4', text: 'Sábado: serra com paragem no miradouro. 60 km, ritmo moderado.', at: now - 1 * 864e5 },
    { id: 'p4', club: 'cl3', uid: 'u5', text: 'Amanhã às 6h15, 10 km leves. Levem frontal.', at: now - 3 * 36e5 },
    { id: 'p5', club: 'cl4', uid: 'u7', text: 'Domingo vamos ao trilho do pinhal. Calçado de trail obrigatório.', at: now - 4 * 864e5 },
  ];
  const nextDow = (dow, h) => { const d = new Date(today); d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7 || 7)); d.setHours(h, 0, 0, 0); return d.getTime(); };
  const events = [
    { id: 'e1', club: 'cl1', title: 'Treino de ritmo no cais', at: nextDow(4, 19), route: 'ribeira', rsvp: ['u1', 'u3', 'u8'] },
    { id: 'e2', club: 'cl1', title: 'Longo de domingo', at: nextDow(0, 8), route: 'miradouro', rsvp: ['u1', 'u0'] },
    { id: 'e3', club: 'cl2', title: 'Volta da serra', at: nextDow(6, 8), route: 'serra', rsvp: ['u2', 'u4', 'u5'] },
    { id: 'e4', club: 'cl3', title: 'Rodagem das 6h15', at: nextDow(3, 6), route: 'ribeira', rsvp: ['u5', 'u8'] },
    { id: 'e5', club: 'cl4', title: 'Trilho do pinhal', at: nextDow(0, 9), route: 'parque', rsvp: ['u7', 'u6'] },
  ];

  const m0 = startOfMonth(now), m1 = new Date(new Date(m0).getFullYear(), new Date(m0).getMonth() + 1, 1).getTime();
  const pm0 = new Date(new Date(m0).getFullYear(), new Date(m0).getMonth() - 1, 1).getTime();
  const monthName = (t) => new Intl.DateTimeFormat('pt-PT', { month: 'long' }).format(t);
  const challenges = [
    { id: 'ch1', name: `100 km em ${monthName(now)}`, sport: 'run', metric: 'distance', target: 100000, from: m0, to: m1, blurb: 'Corre 100 km até ao fim do mês. Conta qualquer corrida ou trail.' },
    { id: 'ch2', name: 'Escalada do mês', sport: 'ride', metric: 'elevation', target: 2000, from: m0, to: m1, blurb: 'Soma 2 000 m de desnível positivo em bicicleta este mês.' },
    { id: 'ch3', name: '5 km de outono', sport: 'run', metric: 'single_distance', target: 5000, from: m0, to: m1, blurb: 'Faz uma corrida de pelo menos 5 km de uma só vez.' },
    { id: 'ch4', name: '20 horas em movimento', sport: '', metric: 'time', target: 72000, from: m0, to: m1, blurb: 'Qualquer desporto conta. Junta 20 horas de tempo em movimento.' },
    { id: 'ch5', name: `Meio mês, ${monthName(pm0)}`, sport: 'run', metric: 'distance', target: 40000, from: pm0, to: m0, blurb: 'Corre 40 km no mês.' },
  ];
  const joins = [['ch1', 'u0'], ['ch3', 'u0'], ['ch5', 'u0'], ['ch1', 'u1'], ['ch1', 'u3'], ['ch1', 'u8'], ['ch2', 'u2'], ['ch2', 'u4'], ['ch4', 'u5'], ['ch3', 'u6']];

  const notifications = [];
  kudos.filter((k) => activities.find((a) => a.id === k[0] && a.uid === 'u0') && k[2] > now - 6 * 864e5)
    .forEach((k) => notifications.push({ id: uid('n'), kind: 'kudos', actor: k[1], ref: k[0], at: k[2], read: k[2] < now - 2 * 864e5 }));
  comments.filter((c) => activities.find((a) => a.id === c.aid && a.uid === 'u0') && c.at > now - 14 * 864e5)
    .forEach((c) => notifications.push({ id: uid('n'), kind: 'comment', actor: c.uid, ref: c.aid, at: c.at, read: false }));
  notifications.push({ id: uid('n'), kind: 'follow', actor: 'u6', ref: null, at: now - 3 * 864e5, read: true });

  return {
    version: 3, me: 'u0', users, follows, activities, kudos, comments, gear,
    routes: [
      { id: 'rt1', uid: 'u0', name: 'Volta ribeirinha', sport: 'run', pts: BASE_ROUTES.ribeira.pts, created: now - 30 * 864e5 },
      { id: 'rt2', uid: 'u0', name: 'Treino de subidas', sport: 'run', pts: BASE_ROUTES.miradouro.pts, created: now - 12 * 864e5 },
    ],
    segments: SEGMENT_DEFS.map((s) => ({ ...s, creator: null })),
    starred: ['sg2', 'sg6'], clubs, posts, events, challenges, joins,
    goals: [
      { id: 'go1', period: 'week', sport: 'run', metric: 'distance', target: 30000 },
      { id: 'go2', period: 'year', sport: 'ride', metric: 'distance', target: 2000000 },
    ],
    notifications,
    settings: { units: 'metric', defaultVisibility: 'everyone', privacyZone: { on: true, x: 0, y: -1280, radius: 400 }, pro: true, autopause: true },
  };
}
