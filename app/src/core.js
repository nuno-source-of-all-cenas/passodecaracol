/* core.js: helpers, geography, terrain, formatting. No dependencies. */
'use strict';

const LAT0 = 38.7223, LON0 = -9.1393;          // demo city origin
const M_PER_DEG_LAT = 111320;
const M_PER_DEG_LON = 111320 * Math.cos(LAT0 * Math.PI / 180);

function toXY(lat, lon) { return [(lon - LON0) * M_PER_DEG_LON, (lat - LAT0) * M_PER_DEG_LAT]; }
function toLL(x, y) { return [LAT0 + y / M_PER_DEG_LAT, LON0 + x / M_PER_DEG_LON]; }

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/* Terrain of the demo city, in metres. River to the south, a hill (the lookout)
   near the centre, a bigger forested ridge to the north-west. */
const RIVER_Y = -1650;
function terrain(x, y) {
  const g = (cx, cy, amp, s) => amp * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * s * s));
  let h = 8 + g(1300, 950, 92, 620) + g(-2600, 2300, 165, 1150) + g(-6500, 3600, 260, 2200) + g(4200, 2600, 55, 900);
  h += 4 * Math.sin(x / 260) * Math.cos(y / 310) + 3 * Math.sin((x + y) / 530);
  const toRiver = y - RIVER_Y;
  if (toRiver < 400) h *= Math.max(0.12, toRiver / 400);
  return Math.max(1.5, h);
}
function isWater(x, y) { return y < RIVER_Y - 60 * Math.sin(x / 900); }

/* Park cells on a 320 m grid, deterministic. */
function isPark(cx, cy) {
  if (Math.hypot(cx * 320 + 2600, cy * 320 - 2300) < 1300) return true;
  if (Math.hypot(cx * 320 + 6500, cy * 320 - 3600) < 2200) return true;
  const r = mulberry32(hashStr(cx + ':' + cy))();
  return r > 0.9;
}

const GRID = 160;                               // street spacing in metres
function snap(v) { return Math.round(v / GRID) * GRID; }

/* ---------- formatting ---------- */
const S = { units: 'metric' };
const nf = (d) => new Intl.NumberFormat('pt-PT', { minimumFractionDigits: d, maximumFractionDigits: d });
const NF0 = nf(0), NF1 = nf(1), NF2 = nf(2);

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function distUnit() { return S.units === 'imperial' ? 'mi' : 'km'; }
function elevUnit() { return S.units === 'imperial' ? 'ft' : 'm'; }
function distVal(m) { return S.units === 'imperial' ? m / 1609.344 : m / 1000; }
function fmtDist(m, d = 2) { const v = distVal(m); return (v >= 100 ? NF0.format(v) : nf(d).format(v)); }
function fmtDistU(m, d = 2) { return fmtDist(m, d) + ' ' + distUnit(); }
function fmtElev(m) { return NF0.format(S.units === 'imperial' ? m * 3.28084 : m); }
function fmtElevU(m) { return fmtElev(m) + ' ' + elevUnit(); }
function fmtDur(s, long) {
  s = Math.round(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (long) return h ? `${h}h ${m}min` : `${m}min ${sec}s`;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}
function paceSecPerUnit(m, s) { if (!m) return 0; return s / distVal(m); }
function fmtPace(m, s) {
  let p = paceSecPerUnit(m, s);
  if (!p || !isFinite(p) || p > 3600) return '–';
  p = Math.round(p);
  return `${Math.floor(p / 60)}:${String(p % 60).padStart(2, '0')}`;
}
function fmtPaceU(m, s) { return fmtPace(m, s) + ' /' + distUnit(); }
function fmtSpeed(m, s) { if (!s) return '–'; return NF1.format(distVal(m) / (s / 3600)); }
function fmtSpeedU(m, s) { return fmtSpeed(m, s) + (S.units === 'imperial' ? ' mi/h' : ' km/h'); }
function usesPace(sport) { return sport === 'run' || sport === 'walk' || sport === 'hike' || sport === 'trail_run'; }
function fmtSwim(m, s) { if (!m) return '–'; const p = Math.round(s / (m / 100)); return `${Math.floor(p / 60)}:${String(p % 60).padStart(2, '0')}`; }
function tempo(sport, m, s) {
  if (sport === 'swim') return { label: 'Ritmo', val: fmtSwim(m, s), unit: '/100 m' };
  if (usesPace(sport)) return { label: 'Ritmo', val: fmtPace(m, s), unit: '/' + distUnit() };
  return { label: 'Velocidade', val: fmtSpeed(m, s), unit: S.units === 'imperial' ? 'mi/h' : 'km/h' };
}
function fmtTempo(sport, m, s) { const t = tempo(sport, m, s); return t.val + ' ' + t.unit; }

const DTF_DAY = new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
const DTF_SHORT = new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short' });
const DTF_TIME = new Intl.DateTimeFormat('pt-PT', { hour: '2-digit', minute: '2-digit' });
const DTF_WD = new Intl.DateTimeFormat('pt-PT', { weekday: 'long' });
const DTF_MONTH = new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' });
function startOfDay(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
function startOfWeek(t) { const d = new Date(startOfDay(t)); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return d.getTime(); }
function startOfMonth(t) { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); }
function startOfYear(t) { return new Date(new Date(t).getFullYear(), 0, 1).getTime(); }
function fmtWhen(t) {
  const today = startOfDay(Date.now()), day = startOfDay(t);
  const time = DTF_TIME.format(t);
  if (day === today) return `Hoje às ${time}`;
  if (day === today - 864e5) return `Ontem às ${time}`;
  if (today - day < 6 * 864e5) return `${cap(DTF_WD.format(t))} às ${time}`;
  return `${DTF_DAY.format(t)} às ${time}`;
}
function fmtAgo(t) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  if (s < 7 * 86400) return `há ${Math.floor(s / 86400)} d`;
  return DTF_SHORT.format(t);
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function uid(p) { return p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

const SPORTS = {
  run: { label: 'Corrida', verb: 'Corrida', color: 'var(--sport-run)', icon: 'run', gps: true },
  trail_run: { label: 'Trail', verb: 'Trail', color: 'var(--sport-hike)', icon: 'trail', gps: true },
  ride: { label: 'Bicicleta', verb: 'Pedalada', color: 'var(--sport-ride)', icon: 'ride', gps: true },
  walk: { label: 'Caminhada', verb: 'Caminhada', color: 'var(--sport-walk)', icon: 'walk', gps: true },
  hike: { label: 'Montanha', verb: 'Caminhada de montanha', color: 'var(--sport-hike)', icon: 'hike', gps: true },
  swim: { label: 'Natação', verb: 'Natação', color: 'var(--sport-swim)', icon: 'swim', gps: false },
  workout: { label: 'Treino', verb: 'Treino', color: 'var(--sport-workout)', icon: 'workout', gps: false },
};
function sportFamily(s) { return s === 'trail_run' ? 'run' : s === 'hike' ? 'walk' : s; }

/* Icon set: drawn here, 24px grid, stroke icons. */
const ICONS = {
  run: '<circle cx="14" cy="4.5" r="2"/><path d="M8 21l3-6 3 2v5M6 12l3-4 4 1 2 4 3 1M11 15l-1-4"/>',
  trail: '<path d="M3 20l6-9 4 5 3-3 5 7z"/><circle cx="16" cy="5" r="2"/>',
  ride: '<circle cx="6" cy="16" r="4"/><circle cx="18" cy="16" r="4"/><path d="M6 16l4-7h5l3 7M10 9l3 7M13 5h3"/>',
  walk: '<circle cx="13" cy="4.5" r="2"/><path d="M10 21l2-6-2-3 1-4 3 3 3 1M12 15l3 6M10 9l-3 3"/>',
  hike: '<circle cx="11" cy="4.5" r="2"/><path d="M8 21l2-7 3 2 1 5M10 14l1-5 3 2 2 1M17 9l2 12"/>',
  swim: '<path d="M2 18c2 0 2-1.5 4-1.5S8 18 10 18s2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5M7 13l4-4 3 3 3-1"/><circle cx="17" cy="6" r="2"/>',
  workout: '<path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/>',
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"/>',
  record: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5" fill="currentColor"/>',
  groups: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 14.5c3 0 6 2 6 5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5"/>',
  kudos: '<path d="M7 11v9H4v-9zM7 11l4-7c1.5 0 2.5 1 2.2 2.6L12.6 10H19a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.8 20H7"/>',
  comment: '<path d="M4 5h16v11H9l-5 4z"/>',
  share: '<path d="M12 3v13M7 8l5-5 5 5M5 14v6h14v-6"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  crown: '<path d="M3 18h18M4 8l4 4 4-7 4 7 4-4-2 10H6z"/>',
  medal: '<circle cx="12" cy="15" r="6"/><path d="M8 3l2 6M16 3l-2 6M12 12.5l1 2 2 .3-1.5 1.4.4 2.1-1.9-1-1.9 1 .4-2.1L9 14.8l2-.3z"/>',
  trophy: '<path d="M8 4h8v6a4 4 0 0 1-8 0zM8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M12 14v4M8 21h8M10 18h4"/>',
  shoe: '<path d="M3 16l1-7 4 1 3 2 5 1c3 .5 5 1.5 5 3v2H3zM3 18h18"/>',
  bike: '<circle cx="6" cy="16" r="4"/><circle cx="18" cy="16" r="4"/><path d="M6 16l4-7h5l3 7M10 9l3 7"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
  people: '<circle cx="9" cy="9" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="8" r="2"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  lap: '<path d="M12 7v5l3 2"/><circle cx="12" cy="13" r="8"/><path d="M9 2h6"/>',
  undo: '<path d="M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/>',
  route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  fire: '<path d="M12 21c-4 0-6-2.7-6-6 0-4 4-6 4-10 3 2 4 4 4 6 1-1 1.5-2 1.5-3 2 2 2.5 4.5 2.5 7 0 3.3-2 6-6 6z"/>',
  mountain: '<path d="M2 20l7-12 4 6 3-4 6 10z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  beacon: '<circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/>',
  zoomin: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5M8 11h6M11 8v6"/>',
  zoomout: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5M8 11h6"/>',
  swap: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
};
function icon(name, size = 20, cls = '') {
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}
