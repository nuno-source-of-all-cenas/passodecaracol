/* analysis.js: everything computed from a GPS stream. Pure functions plus caches. */
'use strict';

const _trackCache = new Map(), _anCache = new Map(), _xyCache = new Map();

function trackOf(a) {
  if (a.track) return a.track;
  if (!a.gen) return null;
  let t = _trackCache.get(a.id);
  if (!t) {
    const route = BASE_ROUTES[a.gen.route];
    t = synthTrack(route.pts, a.sport === 'trail_run' ? 'trail_run' : a.sport, a.gen.ability, a.gen.seed, a.gen.hr);
    _trackCache.set(a.id, t);
  }
  return t;
}
function xyOf(a) {
  let v = _xyCache.get(a.id);
  if (!v) { const t = trackOf(a); v = t ? t.map((p) => toXY(p[0], p[1])) : null; _xyCache.set(a.id, v); }
  return v;
}
function invalidate(id) { _anCache.delete(id); _xyCache.delete(id); _trackCache.delete(id); }

const ZONES = [0.6, 0.7, 0.8, 0.9];          // fractions of max HR
const ZONE_NAMES = ['Recuperação', 'Resistência', 'Ritmo', 'Limiar', 'Anaeróbio'];
const ZONE_W = [0.6, 1, 1.8, 3.2, 5];
const BEST_EFFORTS = [[400, '400 m'], [1000, '1 km'], [1609.344, '1 milha'], [5000, '5 km'], [10000, '10 km'], [21097.5, 'Meia-maratona']];

function analyze(a) {
  const key = a.id + ':' + S.units + ':' + (a.v || 0);
  const hit = _anCache.get(a.id);
  if (hit && hit.key === key) return hit;
  const t = trackOf(a);
  let res;
  if (!t || t.length < 2) {
    const m = a.manual || { dist: 0, time: 0, elev: 0 };
    res = { key, hasMap: false, dist: m.dist, moving: m.time, elapsed: m.time, gain: m.elev, loss: 0, maxSpeed: 0, avgHr: 0, maxHr: 0, splits: [], best: [], zones: null, cum: [], points: 0 };
  } else {
    const n = t.length, cum = new Float64Array(n);
    let moving = 0, maxSpeed = 0, hrSum = 0, hrN = 0, maxHr = 0, gain = 0, loss = 0;
    const minV = a.sport === 'ride' ? 1 : 0.45;
    const zones = [0, 0, 0, 0, 0];
    let refEle = t[0][2];
    for (let i = 1; i < n; i++) {
      const d = haversine(t[i - 1][0], t[i - 1][1], t[i][0], t[i][1]);
      const dt = t[i][3] - t[i - 1][3];
      cum[i] = cum[i - 1] + d;
      if (dt > 0) {
        const v = d / dt;
        if (v > minV) moving += dt;
        if (dt <= 30 && v > maxSpeed) maxSpeed = v;
      }
      const hr = t[i][4];
      if (hr) {
        hrSum += hr; hrN++; if (hr > maxHr) maxHr = hr;
        const f = hr / HR_MAX; let z = 0; while (z < 4 && f >= ZONES[z]) z++;
        zones[z] += dt;
      }
      const de = t[i][2] - refEle;
      if (de > 1.5) { gain += de; refEle = t[i][2]; } else if (de < -1.5) { loss -= de; refEle = t[i][2]; }
    }
    const dist = cum[n - 1];
    const unit = S.units === 'imperial' ? 1609.344 : 1000;
    const splits = [];
    let k = 0, i0 = 0;
    for (let i = 1; i < n; i++) {
      if (cum[i] >= (k + 1) * unit || i === n - 1) {
        const dd = cum[i] - cum[i0];
        if (dd < unit * 0.1 && i === n - 1 && splits.length) break;
        let hs = 0, hn = 0; for (let q = i0; q <= i; q++) if (t[q][4]) { hs += t[q][4]; hn++; }
        splits.push({ n: k + 1, dist: dd, time: t[i][3] - t[i0][3], elev: t[i][2] - t[i0][2], hr: hn ? Math.round(hs / hn) : 0, partial: dd < unit * 0.98 });
        k++; i0 = i;
      }
    }
    const best = [];
    if (sportFamily(a.sport) === 'run') {
      BEST_EFFORTS.forEach(([len, label]) => {
        if (dist < len) return;
        let j = 0, bestT = Infinity, bi = 0, bj = 0;
        for (let i = 0; i < n; i++) {
          while (j < n - 1 && cum[j] - cum[i] < len) j++;
          if (cum[j] - cum[i] < len) break;
          const tt = (t[j][3] - t[i][3]) * len / (cum[j] - cum[i]);
          if (tt < bestT) { bestT = tt; bi = i; bj = j; }
        }
        if (isFinite(bestT)) best.push({ len, label, time: Math.round(bestT), i: bi, j: bj });
      });
    }
    res = { key, hasMap: true, dist, moving, elapsed: t[n - 1][3] - t[0][3], gain, loss, maxSpeed, avgHr: hrN ? Math.round(hrSum / hrN) : 0, maxHr, splits, best, zones: hrN ? zones : null, cum, points: n };
  }
  res.calories = calories(a.sport, res);
  res.effort = relativeEffort(a.sport, res);
  _anCache.set(a.id, res);
  return res;
}

function calories(sport, r) {
  const kg = 72, km = r.dist / 1000, h = r.moving / 3600;
  const f = { run: 1.0, trail_run: 1.1, walk: 0.62, hike: 0.75 }[sport];
  if (f) return Math.round(kg * km * f + r.gain * 0.3);
  if (sport === 'ride') return Math.round(km * 26 + r.gain * 0.9);
  if (sport === 'swim') return Math.round(h * 540);
  return Math.round(h * 380);
}
function relativeEffort(sport, r) {
  if (r.zones) return Math.round(r.zones.reduce((s, sec, z) => s + sec / 60 * ZONE_W[z], 0) / 1.6);
  const min = r.moving / 60;
  if (!min) return 0;
  const base = BASE_SPEED[sport];
  const intensity = base && r.dist ? clamp((r.dist / r.moving) / base, 0.6, 1.4) : 0.9;
  return Math.round(min * intensity * intensity * 0.95 * (sport === 'ride' ? 0.75 : 1));
}
function effortLabel(v) { return v < 25 ? 'Leve' : v < 60 ? 'Moderado' : v < 110 ? 'Exigente' : v < 180 ? 'Muito exigente' : 'Extremo'; }

/* ---------- segments ---------- */
const _segCache = new Map();
function segmentInfo(sg) {
  let c = _segCache.get(sg.id);
  if (c) return c;
  const d = densify(sg.pts, 10);
  const prof = []; let L = 0;
  for (let i = 0; i < d.length; i++) {
    if (i) L += Math.hypot(d[i][0] - d[i - 1][0], d[i][1] - d[i - 1][1]);
    prof.push([L, terrain(d[i][0], d[i][1])]);
  }
  const e0 = prof[0][1], e1 = prof[prof.length - 1][1];
  let maxG = 0;
  for (let i = 0, j = 0; i < prof.length; i++) {
    while (j < prof.length - 1 && prof[j][0] - prof[i][0] < 100) j++;
    if (prof[j][0] - prof[i][0] >= 50) maxG = Math.max(maxG, (prof[j][1] - prof[i][1]) / (prof[j][0] - prof[i][0]));
  }
  const avg = (e1 - e0) / L;
  const score = L * avg * 100;
  let cat = null;
  if (avg > 0.03) cat = score > 80000 ? 'HC' : score > 64000 ? '1' : score > 32000 ? '2' : score > 16000 ? '3' : score > 8000 ? '4' : null;
  c = { len: L, avg, maxG, low: Math.min(...prof.map((p) => p[1])), high: Math.max(...prof.map((p) => p[1])), cat, prof, dense: d };
  _segCache.set(sg.id, c);
  return c;
}
function segSportOk(sg, sport) { return sg.sport === 'ride' ? sport === 'ride' : sportFamily(sport) === 'run'; }

const _effCache = new Map();
function effortsFor(a, segments) {
  const ck = a.id + ':' + (a.v || 0) + ':' + segments.map((s) => s.id).join(',');
  const hit = _effCache.get(a.id);
  if (hit && hit.ck === ck) return hit.list;
  const xy = xyOf(a), t = trackOf(a), out = [];
  if (xy) {
    for (const sg of segments) {
      if (!segSportOk(sg, a.sport)) continue;
      const info = segmentInfo(sg), S0 = sg.pts[0], E = sg.pts[sg.pts.length - 1];
      const mid = info.dense[Math.floor(info.dense.length / 2)];
      const near = (p, q, r) => Math.abs(p[0] - q[0]) < r && Math.abs(p[1] - q[1]) < r && Math.hypot(p[0] - q[0], p[1] - q[1]) < r;
      const cumA = analyze(a).cum;
      let i = 0;
      while (i < xy.length) {
        if (!near(xy[i], S0, 30)) { i++; continue; }
        let bi = i; while (bi + 1 < xy.length && near(xy[bi + 1], S0, 30) && Math.hypot(xy[bi + 1][0] - S0[0], xy[bi + 1][1] - S0[1]) <= Math.hypot(xy[bi][0] - S0[0], xy[bi][1] - S0[1])) bi++;
        let j = bi, found = -1;
        while (j < xy.length && cumA[j] - cumA[bi] <= info.len * 1.3) {
          if (cumA[j] - cumA[bi] >= info.len * 0.8 && near(xy[j], E, 30)) { found = j; break; }
          j++;
        }
        if (found > 0) {
          let midOk = false;
          for (let q = bi; q <= found; q++) if (near(xy[q], mid, 45)) { midOk = true; break; }
          if (midOk) {
            out.push({ seg: sg.id, aid: a.id, uid: a.uid, i: bi, j: found, time: t[found][3] - t[bi][3], at: a.start + t[bi][3] * 1000 });
            i = found + 1; continue;
          }
        }
        i = bi + 1;
      }
    }
  }
  _effCache.set(a.id, { ck, list: out });
  return out;
}

/* ---------- training load ---------- */
function fitnessSeries(acts, days) {
  const today = startOfDay(Date.now()), load = new Map();
  acts.forEach((a) => { const d = startOfDay(a.start); load.set(d, (load.get(d) || 0) + analyze(a).effort); });
  let ctl = 0, atl = 0;
  const out = [], first = today - (days + 60) * 864e5;
  for (let d = first; d <= today; d += 864e5) {
    const dd = startOfDay(d + 3 * 36e5), l = load.get(dd) || 0;
    ctl += (l - ctl) / 42; atl += (l - atl) / 7;
    if (dd >= today - days * 864e5) out.push({ day: dd, load: l, fitness: ctl, fatigue: atl, form: ctl - atl });
  }
  return out;
}

/* ---------- GPX ---------- */
function parseGPX(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('O ficheiro não é um GPX válido.');
  const pts = [...doc.getElementsByTagName('trkpt'), ...doc.getElementsByTagName('rtept')];
  if (pts.length < 2) throw new Error('O ficheiro não tem pontos de percurso.');
  let t0 = null;
  const out = pts.map((p, i) => {
    const lat = parseFloat(p.getAttribute('lat')), lon = parseFloat(p.getAttribute('lon'));
    const ele = parseFloat(p.getElementsByTagName('ele')[0]?.textContent || '0');
    const tt = p.getElementsByTagName('time')[0]?.textContent;
    let sec = i * 4;
    if (tt) { const ms = Date.parse(tt); if (t0 == null) t0 = ms; sec = Math.round((ms - t0) / 1000); }
    const hrEl = [...p.getElementsByTagName('*')].find((e) => /(^|:)hr$/i.test(e.tagName));
    return [lat, lon, ele, sec, hrEl ? parseInt(hrEl.textContent, 10) || 0 : 0];
  }).filter((p) => isFinite(p[0]) && isFinite(p[1]));
  const name = doc.getElementsByTagName('name')[0]?.textContent?.trim();
  const type = (doc.getElementsByTagName('type')[0]?.textContent || '').toLowerCase();
  const sport = /bik|cycl|ride/.test(type) ? 'ride' : /walk/.test(type) ? 'walk' : /hik/.test(type) ? 'hike' : 'run';
  return { track: out, start: t0 || Date.now(), name, sport };
}
function toGPX(name, sport, pts) {
  const body = pts.map(([x, y]) => { const [lat, lon] = toLL(x, y); return `    <rtept lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"><ele>${terrain(x, y).toFixed(1)}</ele></rtept>`; }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Passo" xmlns="http://www.topografix.com/GPX/1/1">\n  <rte><name>${esc(name)}</name><type>${sport}</type>\n${body}\n  </rte>\n</gpx>\n`;
}
