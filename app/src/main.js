/* main.js: router, events, the recorder and the route builder. */
'use strict';

const R = { view: 'feed', params: {}, stack: [] };
const VIEWS = {
  feed: viewFeed, activity: viewActivity, edit: viewEdit, save: viewSave, record: viewRecord, upload: viewUpload,
  explore: viewExplore, segment: viewSegment, routeBuilder: viewRouteBuilder, profile: viewProfile, follows: viewFollows,
  training: viewTraining, groups: viewGroups, club: viewClub, challenge: viewChallenge, gear: viewGear,
  notifications: viewNotifications, search: viewSearch, settings: viewSettings,
};
const TITLES = { feed: 'Painel', record: 'Gravar', explore: 'Explorar', training: 'Treino', groups: 'Grupos', settings: 'Definições', notifications: 'Notificações', search: 'Procurar', gear: 'Equipamento', upload: 'Adicionar atividade' };
const root = () => document.getElementById('app');

function render() {
  const ae = document.activeElement, fid = ae && ae.id, sel = ae && 'selectionStart' in ae ? [ae.selectionStart, ae.selectionEnd] : null;
  let html;
  try { html = (VIEWS[R.view] || viewFeed)(); }
  catch (e) { console.error(e); html = empty('Algo correu mal neste ecrã', esc(e.message), `<button class="btn btn-secondary" ${go('feed')}>Voltar ao painel</button>`); }
  root().innerHTML = chrome() + `<div class="view v-${R.view}">${html}</div>`;
  document.title = (TITLES[R.view] || (R.view === 'activity' && activity(R.params.id)?.name) || 'Passo') + ' · Passo';
  if (fid) { const el = document.getElementById(fid); if (el) { el.focus({ preventScroll: true }); if (sel && el.setSelectionRange) try { el.setSelectionRange(sel[0], sel[1]); } catch (e) { } } }
}
function refreshChrome() {
  const b = document.querySelector('.bell'); if (!b) return;
  const n = unreadCount(); let bd = b.querySelector('.badge');
  if (!n) { if (bd) bd.remove(); return; }
  if (!bd) { bd = document.createElement('span'); bd.className = 'badge'; b.appendChild(bd); }
  bd.textContent = n;
}
function navigate(view, params = {}, push = true) {
  if (push) R.stack.push({ view: R.view, params: R.params });
  if (R.stack.length > 40) R.stack.shift();
  Object.assign(R, { view, params, confirm: null, hlSeg: null, uploadErr: null });
  if (view !== 'edit') R.draftPhotos = null;
  if (view === 'routeBuilder') rbOpen(params.id);
  if (view === 'notifications') setTimeout(() => { markNotificationsRead(); refreshChrome(); }, 1500);
  render();
  window.scrollTo(0, 0);
  if (params.focus === 'comment') setTimeout(() => { const c = document.getElementById('comment-in'); if (c) { c.scrollIntoView({ block: 'center' }); c.focus(); } }, 30);
}
function back() { const p = R.stack.pop(); if (p) navigate(p.view, p.params, false); else navigate('feed', {}, false); }

function toast(msg) {
  const box = document.getElementById('toasts'); if (!box) return;
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  box.appendChild(t); setTimeout(() => t.classList.add('out'), 2600); setTimeout(() => t.remove(), 3000);
}
function ask(text, yes, fn, ref) { R.confirm = { text, yes, fn, ref }; render(); }
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('Link copiado.'); }
  catch (e) { toast('Copia este link: ' + text); }
}

/* ---------- photos ---------- */
function resizeImage(file, max = 900) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => { const img = new Image(); img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.78)); }; img.onerror = rej; img.src = fr.result; };
    fr.onerror = rej; fr.readAsDataURL(file);
  });
}
function photoTarget() { return R.view === 'save' ? (REC.pending.photos = REC.pending.photos || []) : (R.draftPhotos = R.draftPhotos || []); }
function redrawPhotos() {
  const row = document.getElementById('photo-row'); if (!row) return;
  const arr = photoTarget(), add = row.querySelector('.ph-add');
  row.querySelectorAll('.ph').forEach((n) => n.remove());
  arr.forEach((p, i) => { const s = document.createElement('span'); s.className = 'ph'; s.innerHTML = `<img src="${p}" alt=""><button type="button" class="icon-btn sm" ${act('rmPhoto', { i })} aria-label="Remover foto">${icon('close', 14)}</button>`; row.insertBefore(s, add); });
}

/* ---------- recorder ---------- */
const REC = { state: 'idle', sport: 'run', source: 'sim', speed: 10, routeId: '', routePts: null, track: [], laps: [], start: 0, elapsedMoving: 0, pending: null, beacon: false, beaconId: '' };
let recTimer = 0, lastRender = 0;

function recStart() {
  Object.assign(REC, { state: 'recording', track: [], laps: [], start: Date.now(), elapsedMoving: 0, autoPaused: false, gpsOk: false });
  REC.beaconId = Math.random().toString(36).slice(2, 8);
  if (REC.source === 'gps') {
    if (!navigator.geolocation) { toast('Este navegador não dá acesso à localização. A usar o simulador.'); REC.source = 'sim'; }
    else {
      REC.watchId = navigator.geolocation.watchPosition((pos) => {
        REC.gpsOk = true;
        if (REC.state !== 'recording') return;
        const t = Math.round((Date.now() - REC.start) / 1000);
        const p = [+pos.coords.latitude.toFixed(6), +pos.coords.longitude.toFixed(6), +(pos.coords.altitude || 0).toFixed(1), t, 0];
        const last = REC.track[REC.track.length - 1];
        if (last && haversine(last[0], last[1], p[0], p[1]) < 2) return;
        REC.track.push(p);
      }, (err) => {
        toast(err.code === 1 ? 'Sem autorização para usar a localização. A usar o simulador.' : 'Sem sinal de GPS. A usar o simulador.');
        navigator.geolocation.clearWatch(REC.watchId); REC.source = 'sim'; simInit();
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
    }
  }
  if (REC.source === 'sim') simInit();
  clearInterval(recTimer);
  recTimer = setInterval(recTick, 250);
  try { navigator.wakeLock && navigator.wakeLock.request('screen').catch(() => { }); } catch (e) { }
  render();
}
function simInit() {
  const r = REC.routeId && DB.routes.find((x) => x.id === REC.routeId);
  const pts = r ? (r.pts.length > 1 ? r.pts : null) : BASE_ROUTES[(ROUTES_BY_SPORT[REC.sport] || ['ribeira'])[0]].pts;
  REC.routePts = densify(pts || BASE_ROUTES.ribeira.pts, 20);
  REC.sim = { w: makeWalker(densify(pts || BASE_ROUTES.ribeira.pts, 5)), s: 0, t: 0, lastPt: -99, hr: 90, noise: 0, stopUntil: 0, rnd: mulberry32(Date.now() & 0xffffffff), ox: 0, oy: 0 };
  REC.pos = REC.sim.w.at(0);
}
function recTick() {
  if (REC.state !== 'recording') return;
  if (REC.source === 'sim') {
    const sim = REC.sim, dt = 0.25 * REC.speed, base = (BASE_SPEED[REC.sport] || 3) * 1.03;
    let left = dt;
    while (left > 0) {
      const step = Math.min(1, left); left -= step; sim.t += step;
      if (sim.t > sim.stopUntil && sim.rnd() < 0.0015 * step) sim.stopUntil = sim.t + 15 + sim.rnd() * 20;   // a red light
      const stopped = sim.t < sim.stopUntil;
      const [x, y] = sim.w.at(sim.s), ah = sim.w.at(sim.s + 15), grade = (terrain(ah[0], ah[1]) - terrain(x, y)) / 15;
      sim.noise = sim.noise * 0.92 + (sim.rnd() - 0.5) * 0.05;
      const v = stopped ? 0 : clamp(base * (1 + sim.noise) * (1 - (REC.sport === 'ride' ? 8 : 4) * grade), base * 0.4, base * 1.6);
      sim.s = Math.min(sim.w.total, sim.s + v * step);
      const moving = v > 0.3;
      if (moving || !DB.settings.autopause) REC.elapsedMoving += step;
      REC.autoPaused = !moving && DB.settings.autopause;
      sim.hr += (60 + 110 * clamp(0.62 + 3 * grade + (moving ? 0.1 : -0.25), 0.3, 0.97) - sim.hr) * 0.05 * step;
      if (sim.t - sim.lastPt >= 3 && (moving || sim.t - sim.lastPt >= 15)) {
        sim.lastPt = sim.t;
        sim.ox = clamp(sim.ox * 0.85 + (sim.rnd() - 0.5) * 1.4, -3, 3); sim.oy = clamp(sim.oy * 0.85 + (sim.rnd() - 0.5) * 1.4, -3, 3);
        const [px, py] = sim.w.at(sim.s), ll = toLL(px + sim.ox, py + sim.oy);
        REC.track.push([+ll[0].toFixed(6), +ll[1].toFixed(6), +terrain(px, py).toFixed(1), Math.round(sim.t), Math.round(sim.hr)]);
        REC.pos = [px, py];
      }
      if (sim.s >= sim.w.total) { REC.state = 'paused'; toast('Chegaste ao fim da rota. Termina para guardar.'); break; }
    }
  } else {
    REC.elapsedMoving = (Date.now() - REC.start) / 1000 - (REC.pausedFor || 0);
    if (REC.track.length) REC.pos = toXY(REC.track[REC.track.length - 1][0], REC.track[REC.track.length - 1][1]);
  }
  if (R.view === 'record' && Date.now() - lastRender > 480) { lastRender = Date.now(); render(); }
  else if (R.view === 'record') { const t = document.getElementById('rs-time'); if (t) t.textContent = fmtDur(REC.elapsedMoving); }
}
function recStop() { clearInterval(recTimer); if (REC.watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(REC.watchId); REC.watchId = null; }
function recFinish() {
  recStop();
  if (REC.track.length < 2) { REC.state = 'idle'; toast('A gravação é curta demais para guardar.'); render(); return; }
  const h = new Date(REC.start).getHours(), part = h < 12 ? 'da manhã' : h < 20 ? 'da tarde' : 'da noite';
  const g = gearOf(me()).find((x) => x.defaultFor === REC.sport && !x.retired);
  REC.pending = { sport: REC.sport, track: REC.track, start: REC.start, laps: REC.laps.slice(), name: `${SPORTS[REC.sport].verb} ${part}`, desc: '', visibility: DB.settings.defaultVisibility, gearId: g ? g.id : null, rpe: null, photos: [], hideStats: {}, v: Date.now() };
  REC.state = 'idle';
  navigate('save', {}, false);
}

/* ---------- route builder ---------- */
const RB = { id: null, name: '', sport: 'run', wps: [], pts: [], snap: true, vb: [-2200, -1800, 4400, 2600] };
function rbOpen(id) {
  const r = id && DB.routes.find((x) => x.id === id);
  Object.assign(RB, { id: r ? r.id : null, name: r ? r.name : '', sport: r ? r.sport : 'run', wps: r ? (r.wps || r.pts).map((p) => p.slice()) : [], snap: r ? r.snap !== false : true });
  rbRebuild();
  if (r) { const [x0, y0, x1, y1] = bboxOf([RB.pts], 400), w = Math.max(x1 - x0, (y1 - y0) * 900 / 560); RB.vb = [Math.round((x0 + x1) / 2 - w / 2), Math.round(-(y0 + y1) / 2 - w * 560 / 900 / 2), Math.round(w), Math.round(w * 560 / 900)]; }
  else RB.vb = [-2490, -1200, 4980, 3100];
}
function rbRebuild() {
  const w = RB.wps;
  if (w.length < 2) { RB.pts = w.slice(); return; }
  if (!RB.snap) { RB.pts = w.slice(); return; }
  const out = [w[0]];
  for (let i = 1; i < w.length; i++) { const a = out[out.length - 1], b = w[i]; if (a[0] !== b[0] && a[1] !== b[1]) out.push([b[0], a[1]]); out.push(b); }
  RB.pts = out;
}
function rbWorld(evt) {
  const svg = document.getElementById('rb-svg'), pt = svg.createSVGPoint();
  pt.x = evt.clientX; pt.y = evt.clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  return [p.x, -p.y];
}
function rbAdd(x, y) {
  if (RB.snap) {
    const sx = snap(x), sy = snap(y);
    // stay on the street the click is closest to
    const p = Math.abs(x - sx) < Math.abs(y - sy) ? [sx, Math.round(y / 20) * 20] : [Math.round(x / 20) * 20, sy];
    if (isWater(p[0], p[1])) { toast('Isso é rio. Escolhe um ponto em terra.'); return; }
    RB.wps.push(p);
  } else {
    if (isWater(x, y)) { toast('Isso é rio. Escolhe um ponto em terra.'); return; }
    RB.wps.push([Math.round(x), Math.round(y)]);
  }
  rbRebuild(); render();
}
function rbZoom(k, cx, cy) {
  const [x, y, w, h] = RB.vb, nw = clamp(w * k, 900, 30000), nh = nw * h / w;
  cx = cx == null ? x + w / 2 : cx; cy = cy == null ? y + h / 2 : cy;
  RB.vb = [Math.round(cx - (cx - x) * nw / w), Math.round(cy - (cy - y) * nh / h), Math.round(nw), Math.round(nh)];
  render();
}

/* ---------- chart scrubbing (charts <-> map) ---------- */
function scrub(evt, wrap) {
  const a = activity(wrap.dataset.scrub); if (!a) return;
  const svg = wrap.querySelector('svg'), rect = svg.getBoundingClientRect();
  const vbW = svg.viewBox.baseVal.width, x = (evt.clientX - rect.left) / rect.width * vbW;
  const L = +svg.dataset.l, iw = +svg.dataset.iw, x0 = +svg.dataset.x0, x1 = +svg.dataset.x1;
  const f = clamp((x - L) / iw, 0, 1), dv = x0 + f * (x1 - x0);
  const an = analyze(a), t = trackOf(a), target = S.units === 'imperial' ? dv * 1609.344 : dv * 1000;
  let lo = 0, hi = an.cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (an.cum[m] < target) lo = m + 1; else hi = m; }
  const i = lo, xy = xyOf(a)[i];
  const cur = document.getElementById('map-cursor');
  if (cur && xy) { cur.setAttribute('cx', xy[0]); cur.setAttribute('cy', -xy[1]); cur.setAttribute('visibility', 'visible'); }
  document.querySelectorAll('[data-scrub] svg').forEach((s) => {
    const l = s.querySelector('.c-cross'); if (!l) return;
    const sx0 = +s.dataset.x0, sx1 = +s.dataset.x1, px = +s.dataset.l + clamp((dv - sx0) / (sx1 - sx0), 0, 1) * +s.dataset.iw;
    l.setAttribute('x1', px); l.setAttribute('x2', px); l.setAttribute('visibility', 'visible');
  });
  const j = Math.max(0, i - 6), d = an.cum[i] - an.cum[j], dt = t[i][3] - t[j][3];
  const read = document.getElementById('cursor-read');
  if (read) read.textContent = `${NF2.format(dv)} ${distUnit()} · ${fmtElevU(t[i][2])} · ${fmtTempo(a.sport, d, dt)}${t[i][4] ? ' · ' + t[i][4] + ' bpm' : ''} · ${fmtDur(t[i][3])}`;
}

/* ---------- actions ---------- */
const ACTIONS = {
  back, more() { R.feedLimit = (R.feedLimit || 12) + 12; render(); }, profMore() { R.profLimit = (R.profLimit || 8) + 8; render(); },
  kudos({ id }) { toggleKudos(id); render(); },
  follow({ id }) { const was = isFollowing(me(), id); toggleFollow(id); toast(was ? `Deixaste de seguir ${user(id).name}.` : `Agora segues ${user(id).name}.`); render(); },
  share({ id }) { copyText(`https://passo.app/a/${id}`); },
  copy({ sel }) { const el = document.querySelector(sel); if (el) copyText('https://' + el.textContent); },
  asOthers() { R.asOthers = !R.asOthers; render(); },
  actTab({ tab }) { R.params = { ...R.params, tab }; R.hlSeg = null; render(); },
  hlSeg({ k }) { R.hlSeg = R.hlSeg === k ? null : k; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
  delComment({ id }) { deleteComment(id); render(); },
  exploreTab({ tab }) { R.params = { tab }; render(); }, segFilter({ f }) { R.segFilter = f; render(); }, heatSport({ f }) { R.heatSport = f; render(); },
  lbFilter({ f }) { R.lbFilter = f; render(); }, star({ id }) { toggleStar(id); render(); },
  profSport({ f }) { R.profSport = f; render(); }, followTab({ tab }) { R.params = { ...R.params, tab }; render(); },
  trainTab({ tab }) { R.params = { tab }; render(); }, fitDays({ d }) { R.fitDays = d; render(); },
  calMonth({ d }) { const b = new Date(R.calMonth || startOfMonth(Date.now())); R.calMonth = new Date(b.getFullYear(), b.getMonth() + d, 1).getTime(); render(); },
  delGoal({ id }) { deleteGoal(id); render(); },
  groupTab({ tab }) { R.params = { tab }; render(); }, clubTab({ tab }) { R.params = { ...R.params, tab }; render(); },
  club({ id }) { toggleClub(id); const c = DB.clubs.find((x) => x.id === id); toast(c.members.includes(me()) ? `Entraste em ${c.name}.` : `Saíste de ${c.name}.`); render(); },
  join({ id }) { toggleJoin(id); render(); }, rsvp({ id }) { toggleRsvp(id); render(); },
  retire({ id }) { const g = DB.gear.find((x) => x.id === id); saveGear({ id, retired: !g.retired }); render(); },
  readAll() { markNotificationsRead(); render(); },
  uploadTab({ tab }) { R.params = { tab }; R.uploadErr = null; render(); },
  rmPhoto({ i }) { photoTarget().splice(i, 1); redrawPhotos(); },
  // recorder
  recSport({ s }) { REC.sport = s; render(); },
  recStart, recPause() { REC.state = 'paused'; REC.pauseAt = Date.now(); render(); },
  recResume() { if (REC.sim && REC.sim.s >= REC.sim.w.total) { toast('A rota terminou. Carrega em terminar.'); return; } if (REC.pauseAt) REC.pausedFor = (REC.pausedFor || 0) + (Date.now() - REC.pauseAt) / 1000; REC.state = 'recording'; render(); },
  recLap() { REC.laps.push(Math.max(0, REC.track.length - 1)); toast(`Volta ${REC.laps.length} marcada.`); render(); },
  recFinish, recDiscardAsk() { ask('Descartar esta gravação? Não dá para desfazer.', 'Descartar', () => { recStop(); REC.state = 'idle'; REC.track = []; render(); }); },
  discardAsk() { ask('Descartar esta atividade sem guardar?', 'Descartar', () => { REC.pending = null; navigate('feed', {}, false); }); },
  deleteAsk({ id }) { ask('Apagar esta atividade, os kudos e os comentários? Não dá para desfazer.', 'Apagar', () => { deleteActivity(id); toast('Atividade apagada.'); R.stack = []; navigate('feed', {}, false); }); },
  resetAsk() { ask('Repor todos os dados de exemplo? Perdes o que gravaste nesta demo.', 'Repor', () => { resetDemo(); R.stack = []; toast('Dados de exemplo repostos.'); navigate('feed', {}, false); }); },
  delRouteAsk({ id }) { ask('Apagar esta rota?', 'Apagar', () => { deleteRoute(id); R.confirm = null; render(); }, id); },
  confirmYes() { const c = R.confirm; R.confirm = null; c && c.fn(); if (!R.confirm) render(); },
  confirmNo() { R.confirm = null; render(); },
  recordRoute({ id }) { const r = DB.routes.find((x) => x.id === id); REC.routeId = id; REC.sport = r.sport; REC.source = 'sim'; navigate('record'); },
  async exportGpx({ id }) {
    const r = DB.routes.find((x) => x.id === id), gpx = toGPX(r.name, r.sport, densify(r.pts, 25)), filename = r.name.replace(/[^\w\-]+/g, '_') + '.gpx';
    try { const dl = window.claude && (await window.claude.use('downloads')); if (dl) { await dl.save({ filename, data: gpx }); return; } } catch (e) { if (e && e.code !== 'not_granted') { /* fall through */ } }
    try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([gpx], { type: 'application/gpx+xml' })); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); toast('GPX exportado.'); }
    catch (e) { copyText(gpx); }
  },
  // route builder
  rbZoomIn() { rbZoom(0.7); }, rbZoomOut() { rbZoom(1.4); },
  rbUndo() { RB.wps.pop(); rbRebuild(); render(); }, rbClear() { RB.wps = []; rbRebuild(); render(); },
  rbReverse() { RB.wps.reverse(); rbRebuild(); render(); },
  rbOutBack() { RB.wps = [...RB.wps, ...RB.wps.slice(0, -1).reverse()]; rbRebuild(); render(); },
  rbLoop() { RB.wps.push(RB.wps[0].slice()); rbRebuild(); render(); },
};

const CHANGES = {
  recSrc(el) { REC.source = el.value; render(); }, recRoute(el) { REC.routeId = el.value; }, recSpeed(el) { REC.speed = +el.value; },
  autopause(el) { setSetting('autopause', el.checked); }, beacon(el) { REC.beacon = el.checked; REC.beaconId = REC.beaconId || Math.random().toString(36).slice(2, 8); render(); },
  async photo(el) {
    const files = [...el.files].slice(0, 6);
    for (const f of files) { try { photoTarget().push(await resizeImage(f)); } catch (e) { toast('Não foi possível ler essa imagem.'); } }
    el.value = ''; redrawPhotos();
  },
  async gpx(el) { const f = el.files[0]; if (f) await importGpx(f); },
  rbSnap(el) { RB.snap = el.checked; rbRebuild(); render(); }, rbSport(el) { RB.sport = el.value; RB.name = document.getElementById('rb-name').value; render(); },
  units(el) { setSetting('units', el.value); render(); }, defVis(el) { setSetting('defaultVisibility', el.value); toast('Guardado.'); },
  zoneOn(el) { DB.settings.privacyZone.on = el.checked; save(); render(); },
  zoneR(el) { DB.settings.privacyZone.radius = +el.value; save(); render(); },
  pro(el) { setSetting('pro', el.checked); toast(el.checked ? 'Plano Pro ativo.' : 'Estás no plano gratuito.'); render(); },
};
async function importGpx(f) {
  try {
    const g = parseGPX(await f.text());
    const gear = gearOf(me()).find((x) => x.defaultFor === g.sport && !x.retired);
    REC.pending = { sport: g.sport, track: g.track, start: g.start, laps: [], name: g.name || `${SPORTS[g.sport].verb} importada`, desc: '', visibility: DB.settings.defaultVisibility, gearId: gear ? gear.id : null, rpe: null, photos: [], hideStats: {}, v: Date.now() };
    navigate('save');
  } catch (e) { R.uploadErr = e.message || 'Não foi possível ler o ficheiro.'; render(); }
}

const FORMS = {
  comment(fd, form) { addComment(form.dataset.id, fd.get('text') || ''); render(); const c = document.getElementById('comment-in'); if (c) c.focus(); },
  post(fd, form) { addPost(form.dataset.id, fd.get('text') || ''); render(); },
  save(fd) {
    const d = REC.pending;
    const a = createActivity({ sport: fd.get('sport'), name: fd.get('name').trim() || d.name, desc: fd.get('desc').trim(), start: d.start, track: d.track, manual: d.manual, laps: d.laps || [], visibility: fd.get('visibility'), gearId: fd.get('gearId') || null, rpe: fd.get('rpe') ? +fd.get('rpe') : null, photos: d.photos || [], hideStats: { pace: !!fd.get('h_pace'), hr: !!fd.get('h_hr'), calories: !!fd.get('h_calories') } });
    REC.pending = null; R.stack = [{ view: 'feed', params: {} }];
    const effs = analyze(a).hasMap ? effortsFor(a, DB.segments) : [], prs = effs.filter((e) => effortBadges(e).isPR).length;
    toast(prs ? `Atividade guardada. ${prs} ${prs > 1 ? 'recordes pessoais' : 'recorde pessoal'} em segmentos!` : 'Atividade guardada.');
    navigate('activity', { id: a.id }, false);
  },
  edit(fd, form) {
    updateActivity(form.dataset.id, { sport: fd.get('sport'), name: fd.get('name').trim(), desc: fd.get('desc').trim(), visibility: fd.get('visibility'), gearId: fd.get('gearId') || null, rpe: fd.get('rpe') ? +fd.get('rpe') : null, photos: R.draftPhotos || [], hideStats: { pace: !!fd.get('h_pace'), hr: !!fd.get('h_hr'), calories: !!fd.get('h_calories') } });
    toast('Alterações guardadas.'); R.stack.pop(); navigate('activity', { id: form.dataset.id }, false);
  },
  manual(fd) {
    const parts = fd.get('dur').split(':').map(Number), secs = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
    if (!secs) { toast('Indica a duração, por exemplo 0:45:00.'); return; }
    const k = S.units === 'imperial' ? 1609.344 : 1000, ek = S.units === 'imperial' ? 0.3048 : 1, sport = fd.get('sport');
    const g = gearOf(me()).find((x) => x.defaultFor === sport && !x.retired);
    REC.pending = { sport, manual: { dist: Math.round((+fd.get('dist') || 0) * k), time: secs, elev: Math.round((+fd.get('elev') || 0) * ek) }, start: new Date(fd.get('when')).getTime() || Date.now(), name: fd.get('name').trim() || SPORTS[sport].verb, desc: '', visibility: DB.settings.defaultVisibility, gearId: g ? g.id : null, rpe: null, photos: [], hideStats: {}, laps: [], v: Date.now() };
    navigate('save');
  },
  mkseg(fd, form) {
    const a = activity(form.dataset.id), an = analyze(a), k = S.units === 'imperial' ? 1609.344 : 1000;
    const from = (+fd.get('from')) * k, to = (+fd.get('to')) * k;
    if (!(to - from >= 200)) { toast('O segmento tem de ter pelo menos 200 m.'); return; }
    const i = an.cum.findIndex((c) => c >= from), j = an.cum.findIndex((c) => c >= to);
    const sg = createSegment(fd.get('name').trim(), a, Math.max(0, i), j < 0 ? an.cum.length - 1 : j);
    toast('Segmento criado.'); navigate('segment', { id: sg.id });
  },
  route(fd) {
    if (RB.pts.length < 2) return;
    const r = saveRoute({ id: RB.id || undefined, name: fd.get('name').trim(), sport: fd.get('sport'), pts: RB.pts.map((p) => p.slice()), wps: RB.wps.map((p) => p.slice()), snap: RB.snap });
    toast('Rota guardada.'); R.stack.pop(); navigate('explore', { tab: 'routes' }, false); void r;
  },
  goal(fd) {
    const m = fd.get('metric'), v = +fd.get('target');
    const target = m === 'distance' ? v * (S.units === 'imperial' ? 1609.344 : 1000) : m === 'time' ? v * 3600 : v * (S.units === 'imperial' ? 0.3048 : 1);
    saveGoal({ period: fd.get('period'), sport: fd.get('sport'), metric: m, target }); toast('Objetivo criado.'); render();
  },
  gear(fd) {
    const k = S.units === 'imperial' ? 1.609344 : 1;
    saveGear({ kind: fd.get('kind'), name: fd.get('name').trim(), brand: fd.get('brand').trim(), alertKm: Math.round((+fd.get('alert') || 0) * k), defaultFor: fd.get('defaultFor'), retired: false });
    toast('Equipamento adicionado.'); render();
  },
  profile(fd) { updateMe({ name: fd.get('name').trim(), city: fd.get('city').trim(), sex: fd.get('sex'), bio: fd.get('bio').trim() }); toast('Perfil guardado.'); render(); },
};

function parseP(el) { try { return JSON.parse(el.dataset.p || '{}'); } catch (e) { return {}; } }
function bind() {
  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-go]');
    if (g) { e.preventDefault(); navigate(g.dataset.go, parseP(g)); return; }
    const a = e.target.closest('[data-act]');
    if (a && ACTIONS[a.dataset.act]) { if (a.tagName !== 'INPUT') e.preventDefault(); ACTIONS[a.dataset.act](parseP(a)); }
  });
  document.addEventListener('change', (e) => { const el = e.target.closest('[data-change]'); if (el && CHANGES[el.dataset.change]) CHANGES[el.dataset.change](el); });
  document.addEventListener('input', (e) => { const el = e.target; if (el.dataset.input === 'q') { R.q = el.value; render(); } });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-form]'); if (!f) return;
    e.preventDefault(); if (FORMS[f.dataset.form]) FORMS[f.dataset.form](new FormData(f), f);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && R.confirm) { R.confirm = null; render(); } });
  // chart scrubbing
  document.addEventListener('pointermove', (e) => { const w = e.target.closest && e.target.closest('[data-scrub]'); if (w) scrub(e, w); });
  // GPX drag and drop
  document.addEventListener('dragover', (e) => { if (e.target.closest && e.target.closest('#drop')) { e.preventDefault(); e.target.closest('#drop').classList.add('over'); } });
  document.addEventListener('drop', (e) => { const d = e.target.closest && e.target.closest('#drop'); if (d) { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) importGpx(f); } });
  // route builder: click adds a point, drag pans, wheel zooms
  let drag = null;
  document.addEventListener('pointerdown', (e) => {
    const svg = e.target.closest && e.target.closest('#rb-svg'); if (!svg) return;
    drag = { x: e.clientX, y: e.clientY, vb: RB.vb.slice(), moved: false, w: svg.getBoundingClientRect().width };
    svg.setPointerCapture(e.pointerId);
  });
  document.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
    if (!drag.moved) return;
    const k = drag.vb[2] / drag.w;
    RB.vb = [Math.round(drag.vb[0] - dx * k), Math.round(drag.vb[1] - dy * k), drag.vb[2], drag.vb[3]];
    const svg = document.getElementById('rb-svg'); if (svg) svg.setAttribute('viewBox', RB.vb.join(' '));
  });
  document.addEventListener('pointerup', (e) => {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.moved) render(); else { const [x, y] = rbWorld(e); rbAdd(x, y); }
  });
  document.addEventListener('wheel', (e) => {
    const svg = e.target.closest && e.target.closest('#rb-svg'); if (!svg) return;
    e.preventDefault(); const [x, y] = rbWorld(e); rbZoom(e.deltaY > 0 ? 1.15 : 0.87, x, -y);
  }, { passive: false });
}

load();
bind();
render();
