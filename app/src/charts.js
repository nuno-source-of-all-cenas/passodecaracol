/* charts.js: the demo city map and every chart, as SVG strings. */
'use strict';

function decimate(arr, max) {
  if (arr.length <= max) return arr;
  const step = arr.length / max, out = [];
  for (let i = 0; i < max; i++) out.push(arr[Math.floor(i * step)]);
  out.push(arr[arr.length - 1]);
  return out;
}

function bboxOf(lines, padM = 120) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  lines.forEach((l) => l.forEach(([x, y]) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }));
  if (!isFinite(x0)) { x0 = -1000; x1 = 1000; y0 = -1000; y1 = 1000; }
  return [x0 - padM, y0 - padM, x1 + padM, y1 + padM];
}

/* Background layers for a world-space window [x0,y0,x1,y1]. Coordinates are
   emitted in world metres with y flipped (svg y = -y), so callers set viewBox. */
function mapLayers(x0, y0, x1, y1, pxPerM) {
  let s = `<rect x="${x0}" y="${-y1}" width="${x1 - x0}" height="${y1 - y0}" class="m-land"/>`;
  // parks
  const c0x = Math.floor(x0 / 320), c1x = Math.ceil(x1 / 320), c0y = Math.floor(y0 / 320), c1y = Math.ceil(y1 / 320);
  if ((c1x - c0x) * (c1y - c0y) < 6000) {
    let d = '';
    for (let cx = c0x; cx <= c1x; cx++) for (let cy = c0y; cy <= c1y; cy++) if (isPark(cx, cy)) { const r = 200 + (hashStr(cx + '/' + cy) % 70); d += `M${cx * 320 + 160 - r} ${-(cy * 320 + 160)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`; }
    if (d) s += `<path d="${d}" class="m-park"/>`;
  }
  // streets: fine grid when zoomed in, avenues otherwise
  const step = GRID * pxPerM >= 12 ? GRID : GRID * 4;
  let d = '', dm = '';
  for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) (x % (GRID * 4) === 0 ? (dm += `M${x} ${-y1}V${-Math.max(y0, RIVER_Y)}`) : (d += `M${x} ${-y1}V${-Math.max(y0, RIVER_Y)}`));
  for (let y = Math.ceil(Math.max(y0, RIVER_Y) / step) * step; y <= y1; y += step) (y % (GRID * 4) === 0 ? (dm += `M${x0} ${-y}H${x1}`) : (d += `M${x0} ${-y}H${x1}`));
  const sw = 1 / pxPerM;
  s += `<path d="${d}" class="m-street" stroke-width="${(1.2 * sw).toFixed(2)}"/><path d="${dm}" class="m-avenue" stroke-width="${(2.6 * sw).toFixed(2)}"/>`;
  // riverside path
  s += `<path d="M${x0} ${1520}H${x1}" class="m-avenue" stroke-width="${(3 * sw).toFixed(2)}"/>`;
  // river
  if (y0 < RIVER_Y + 80) {
    let w = `M${x0} ${-(y0 - 10)}`;
    const n = 60;
    for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; w += `L${x.toFixed(0)} ${(-(RIVER_Y - 60 * Math.sin(x / 900))).toFixed(0)}`; }
    w += `L${x1} ${-(y0 - 10)}Z`;
    s += `<path d="${w}" class="m-water"/>`;
  }
  return s;
}

function polyD(xy) { let d = ''; for (let i = 0; i < xy.length; i++) d += (i ? 'L' : 'M') + xy[i][0].toFixed(1) + ' ' + (-xy[i][1]).toFixed(1); return d; }

/* A static map. lines: [{xy, cls}] in world metres. */
function mapSVG({ lines = [], markers = [], w = 600, h = 300, pad = 140, bbox, cls = '', id = '', label = 'Mapa do percurso', extra = '' }) {
  const all = lines.map((l) => l.xy);
  let [x0, y0, x1, y1] = bbox || bboxOf(all, pad);
  // fit to aspect
  const bw = x1 - x0, bh = y1 - y0, ar = w / h;
  if (bw / bh > ar) { const nh = bw / ar; y0 -= (nh - bh) / 2; y1 += (nh - bh) / 2; } else { const nw = bh * ar; x0 -= (nw - bw) / 2; x1 += (nw - bw) / 2; }
  const ppm = w / (x1 - x0), sw = 1 / ppm;
  let s = `<svg class="map ${cls}" ${id ? `id="${id}"` : ''} viewBox="${x0.toFixed(0)} ${(-y1).toFixed(0)} ${(x1 - x0).toFixed(0)} ${(y1 - y0).toFixed(0)}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(label)}">`;
  s += mapLayers(x0, y0, x1, y1, ppm);
  lines.forEach((l) => {
    const d = polyD(decimate(l.xy, l.max || 700));
    const lw = (l.w || 3.4) * sw;
    if (!l.noHalo) s += `<path d="${d}" class="m-halo" stroke-width="${(lw + 3 * sw).toFixed(2)}"/>`;
    s += `<path d="${d}" class="m-route ${l.cls || ''}" stroke-width="${lw.toFixed(2)}"/>`;
  });
  markers.forEach((m) => {
    const r = (m.r || 6) * sw, [x, y] = m.xy;
    if (m.kind === 'start') s += `<circle cx="${x}" cy="${-y}" r="${r}" class="m-start" stroke-width="${2 * sw}"/>`;
    else if (m.kind === 'end') s += `<circle cx="${x}" cy="${-y}" r="${r}" class="m-end" stroke-width="${2 * sw}"/><circle cx="${x}" cy="${-y}" r="${r * 0.4}" class="m-end-dot"/>`;
    else if (m.kind === 'km') s += `<g class="m-km"><circle cx="${x}" cy="${-y}" r="${8 * sw}" stroke-width="${1.5 * sw}"/><text x="${x}" y="${-y + 3.6 * sw}" font-size="${10 * sw}" text-anchor="middle">${m.text}</text></g>`;
    else if (m.kind === 'zone') s += `<circle cx="${x}" cy="${-y}" r="${m.radius}" class="m-zone" stroke-width="${1.5 * sw}"/>`;
    else if (m.kind === 'me') s += `<circle cx="${x}" cy="${-y}" r="${14 * sw}" class="m-me-halo"/><circle cx="${x}" cy="${-y}" r="${6 * sw}" class="m-me" stroke-width="${2.5 * sw}"/>`;
    else if (m.kind === 'cursor') s += `<circle id="map-cursor" cx="${x}" cy="${-y}" r="${6 * sw}" class="m-cursor" stroke-width="${2.5 * sw}" visibility="hidden"/>`;
    else if (m.kind === 'pin') s += `<circle cx="${x}" cy="${-y}" r="${(m.r || 4.5) * sw}" class="m-pin" stroke-width="${1.6 * sw}"/>`;
  });
  s += extra;
  return s + '</svg>';
}

function activityMap(a, { w = 600, h = 320, kms = false, cursor = false, segment = null, hideZone = false, cls = '' } = {}) {
  let xy = xyOf(a);
  if (!xy) return '';
  const z = DB.settings.privacyZone;
  if (hideZone && z.on && a.uid === me()) xy = trimZone(xy, z);
  if (xy.length < 2) return `<div class="map-empty">Percurso escondido pela zona de privacidade</div>`;
  const markers = [{ kind: 'start', xy: xy[0] }, { kind: 'end', xy: xy[xy.length - 1] }];
  if (kms) {
    const an = analyze(a), unit = S.units === 'imperial' ? 1609.344 : 1000, full = xyOf(a);
    let k = 1;
    for (let i = 0; i < an.cum.length && k < 60; i++) if (an.cum[i] >= k * unit) { markers.push({ kind: 'km', xy: full[i], text: k }); k++; }
  }
  if (cursor) markers.push({ kind: 'cursor', xy: xy[0] });
  const lines = [{ xy, cls: '' }];
  if (segment) lines.push({ xy: xyOf(a).slice(segment.i, segment.j + 1), cls: 'm-seg', w: 5, noHalo: true });
  return mapSVG({ lines, markers, w, h, cls, label: `Mapa de ${a.name}` });
}
function trimZone(xy, z) {
  const inZ = (p) => Math.hypot(p[0] - z.x, p[1] - z.y) < z.radius;
  let i = 0, j = xy.length - 1;
  while (i < xy.length && inZ(xy[i])) i++;
  while (j > i && inZ(xy[j])) j--;
  return xy.slice(i, j + 1);
}

/* ---------- charts ---------- */
function niceTicks(min, max, n = 4) {
  const span = max - min || 1, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const out = []; for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}

/* xs ascending, ys values. opts: invert (pace), fmtY, fmtX, cls, id */
function areaChart(xs, ys, { w = 640, h = 160, fmtY = (v) => NF0.format(v), fmtX = (v) => v, cls = 'c-elev', invert = false, id = '', yMin, yMax, label = '' } = {}) {
  if (xs.length < 2) return '';
  const L = 44, R = 10, T = 10, B = 24, iw = w - L - R, ih = h - T - B;
  let lo = yMin != null ? yMin : Math.min(...ys), hi = yMax != null ? yMax : Math.max(...ys);
  if (hi - lo < 1e-6) { hi += 1; lo -= 1; }
  const padY = (hi - lo) * 0.08; lo -= padY; hi += padY;
  const X = (v) => L + (v - xs[0]) / (xs[xs.length - 1] - xs[0]) * iw;
  const Y = (v) => invert ? T + (v - lo) / (hi - lo) * ih : T + (1 - (v - lo) / (hi - lo)) * ih;
  const idx = decimate(xs.map((_, i) => i), 400);
  let line = ''; idx.forEach((i, k) => { line += (k ? 'L' : 'M') + X(xs[i]).toFixed(1) + ' ' + Y(ys[i]).toFixed(1); });
  const base = invert ? T : T + ih;
  const area = line + `L${X(xs[xs.length - 1]).toFixed(1)} ${base}L${X(xs[0]).toFixed(1)} ${base}Z`;
  let g = '';
  niceTicks(lo, hi, 3).forEach((v) => { const y = Y(v); if (y < T - 1 || y > T + ih + 1) return; g += `<line x1="${L}" x2="${w - R}" y1="${y}" y2="${y}" class="c-grid"/><text x="${L - 6}" y="${y + 4}" text-anchor="end" class="c-lbl">${fmtY(v)}</text>`; });
  niceTicks(xs[0], xs[xs.length - 1], 5).forEach((v) => { const x = X(v); if (x > w - R - 10) return; g += `<text x="${x}" y="${h - 6}" text-anchor="middle" class="c-lbl">${fmtX(v)}</text>`; });
  return `<svg class="chart ${cls}" ${id ? `id="${id}"` : ''} viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}" data-l="${L}" data-iw="${iw}" data-x0="${xs[0]}" data-x1="${xs[xs.length - 1]}">${g}<path d="${area}" class="c-area"/><path d="${line}" class="c-line"/><line class="c-cross" x1="0" x2="0" y1="${T}" y2="${T + ih}" visibility="hidden"/></svg>`;
}

function barChart(vals, labels, { w = 640, h = 150, fmt = (v) => NF0.format(v), hi = -1, cls = '' } = {}) {
  const L = 8, R = 8, T = 18, B = 22, iw = w - L - R, ih = h - T - B, n = vals.length, max = Math.max(...vals, 1e-9);
  const bw = iw / n, gap = Math.min(10, bw * 0.3);
  let s = `<svg class="chart c-bars ${cls}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Gráfico de barras">`;
  s += `<line x1="${L}" x2="${w - R}" y1="${T + ih}" y2="${T + ih}" class="c-axis"/>`;
  vals.forEach((v, i) => {
    const bh = v / max * ih, x = L + i * bw + gap / 2, y = T + ih - bh;
    s += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw - gap).toFixed(1)}" height="${Math.max(bh, v ? 2 : 0).toFixed(1)}" rx="2" class="${i === hi ? 'c-bar-hi' : 'c-bar'}"><title>${esc(labels[i])}: ${fmt(v)}</title></rect>`;
    if (i === hi || (v === max && v > 0)) s += `<text x="${(x + (bw - gap) / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}" text-anchor="middle" class="c-val">${fmt(v)}</text>`;
    if (n <= 14 && (n <= 7 || i % 2 === (n - 1) % 2)) s += `<text x="${(x + (bw - gap) / 2).toFixed(1)}" y="${h - 6}" text-anchor="middle" class="c-lbl">${esc(labels[i])}</text>`;
  });
  return s + '</svg>';
}

function multiLine(series, xs, { w = 720, h = 220, fmtX = (v) => v, zero = false } = {}) {
  const L = 36, R = 12, T = 12, B = 24, iw = w - L - R, ih = h - T - B;
  const all = series.flatMap((s) => s.ys);
  let lo = Math.min(...all, zero ? 0 : Infinity), hi = Math.max(...all);
  const pad = (hi - lo) * 0.08 || 1; lo -= pad; hi += pad;
  const X = (i) => L + i / (xs.length - 1) * iw, Y = (v) => T + (1 - (v - lo) / (hi - lo)) * ih;
  let s = `<svg class="chart c-multi" viewBox="0 0 ${w} ${h}" role="img" aria-label="Gráfico de forma e frescura">`;
  niceTicks(lo, hi, 4).forEach((v) => { s += `<line x1="${L}" x2="${w - R}" y1="${Y(v)}" y2="${Y(v)}" class="${v === 0 ? 'c-axis' : 'c-grid'}"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end" class="c-lbl">${NF0.format(v)}</text>`; });
  const nl = 6; for (let k = 0; k <= nl; k++) { const i = Math.round(k / nl * (xs.length - 1)); s += `<text x="${X(i)}" y="${h - 6}" text-anchor="${k === 0 ? 'start' : k === nl ? 'end' : 'middle'}" class="c-lbl">${fmtX(xs[i])}</text>`; }
  series.forEach((se) => {
    let d = ''; se.ys.forEach((v, i) => { d += (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); });
    if (se.area) s += `<path d="${d}L${X(se.ys.length - 1)} ${Y(Math.max(lo, 0))}L${X(0)} ${Y(Math.max(lo, 0))}Z" class="c-area ${se.cls}"/>`;
    s += `<path d="${d}" class="c-line ${se.cls}"/>`;
    const last = se.ys.length - 1;
    s += `<circle cx="${X(last)}" cy="${Y(se.ys[last])}" r="3.5" class="c-dot ${se.cls}"/>`;
  });
  return s + '</svg>';
}

function ring(pct, size = 64, stroke = 7, cls = '') {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return `<svg class="ring ${cls}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bg" stroke-width="${stroke}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fg" stroke-width="${stroke}" stroke-dasharray="${(c * pct).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
}

function elevationFor(a) {
  const t = trackOf(a), an = analyze(a);
  const xs = [], ys = [];
  for (let i = 0; i < t.length; i++) { xs.push(distVal(an.cum[i])); ys.push(S.units === 'imperial' ? t[i][2] * 3.28084 : t[i][2]); }
  return { xs, ys };
}
function paceFor(a) {
  const t = trackOf(a), an = analyze(a), xs = [], ys = [], pace = usesPace(a.sport);
  const win = 6;
  for (let i = win; i < t.length; i++) {
    const d = an.cum[i] - an.cum[i - win], dt = t[i][3] - t[i - win][3];
    if (dt <= 0) continue;
    xs.push(distVal(an.cum[i]));
    ys.push(pace ? clamp(dt / distVal(d || 0.01), 120, 1200) : distVal(d) / (dt / 3600));
  }
  return { xs, ys, pace };
}
