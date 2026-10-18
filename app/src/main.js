/* main.js: router, events, the recorder and the route builder. */
'use strict';

const R = { view: 'feed', params: {}, stack: [] };
const VIEWS = {
  feed: viewFeed, activity: viewActivity, edit: viewEdit, save: viewSave, record: viewRecord, upload: viewUpload,
  explore: viewExplore, segment: viewSegment, routeBuilder: viewRouteBuilder, profile: viewProfile, follows: viewFollows,
  training: viewTraining, groups: viewGroups, club: viewClub, challenge: viewChallenge, gear: viewGear,
  notifications: viewNotifications, search: viewSearch, settings: viewSettings,
  live: viewLive, race: viewRace, session: viewSession, gearDetail: viewGearDetail,
};
const TITLES = { feed: 'Painel', record: 'Gravar', explore: 'Explorar', training: 'Treino', groups: 'Grupos', settings: 'Definições', notifications: 'Notificações', search: 'Procurar', gear: 'Equipamento', upload: 'Adicionar atividade', live: 'Ao vivo', race: 'Seguir prova' };
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
  if (view !== 'edit') { R.draftPhotos = null; R.draftRace = null; }
  if (view !== 'live') R.clip = null;
  if (view === 'routeBuilder') rbOpen(params.id);
  if (view === 'notifications') setTimeout(() => { markNotificationsRead(); refreshChrome(); }, 1500);
  render();
  window.scrollTo(0, 0);
  if (params.focus === 'comment') setTimeout(() => { const c = document.getElementById('comment-in'); if (c) { c.scrollIntoView({ block: 'center' }); c.focus(); } }, 30);
}
function redrawRace() {
  const pr = document.getElementById('race-photo-row'), cr = document.getElementById('race-cert-row'); if (!pr || !cr) return;
  pr.querySelectorAll('.ph').forEach((n) => n.remove()); const addP = pr.querySelector('.ph-add');
  R.draftRace.photos.forEach((p, i) => { const s = document.createElement('span'); s.className = 'ph'; s.innerHTML = `<img src="${p}" alt=""><button type="button" class="icon-btn sm" ${act('rmRacePhoto', { i })} aria-label="Remover foto">${icon('close', 14)}</button>`; pr.insertBefore(s, addP); });
  cr.querySelectorAll('.cert-chip').forEach((n) => n.remove()); const addC = cr.querySelector('.file-btn');
  R.draftRace.certs.forEach((c, i) => { const s = document.createElement('span'); s.className = 'cert-chip'; s.innerHTML = `${icon('medal', 14)}${esc(c.name)}<button type="button" class="icon-btn sm" ${act('rmCert', { i })} aria-label="Remover">${icon('close', 12)}</button>`; cr.insertBefore(s, addC); });
}
function parseDur(v) { if (!v) return null; const p = String(v).split(':').map(Number); if (p.some(isNaN)) return null; return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0]; }
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

/* ---------- recorder: a session (level 1) holds one or more activities (level 2) ---------- */
const REC = { state: 'idle', sport: 'run', kind: 'treino', actName: '', courseKey: '', course: null, source: 'sim', speed: 10, routeId: '',
  routePts: null, track: [], start: 0, act: null, acts: [], ranges: [], pending: null, shareId: '', sessDist: 0, clipList: [], song: null, cad: 0, hrLive: 0, hrDevice: '' };
let recTimer = 0, lastRender = 0, camStream = null;

function sessionStart(withActivity) {
  Object.assign(REC, { state: 'session', track: [], start: Date.now(), act: null, acts: [], ranges: [], sessDist: 0, clipList: [], gpsOk: false,
    shareId: newShareId(), sessionId: uid('ss'), song: DB.settings.conn.spotify ? PLAYLIST[Math.floor(Math.random() * PLAYLIST.length)] : null });
  if (REC.source === 'gps') {
    if (!navigator.geolocation) { toast('Este navegador não dá acesso à localização. A usar o simulador.'); REC.source = 'sim'; }
    else {
      REC.watchId = navigator.geolocation.watchPosition((pos) => {
        REC.gpsOk = true;
        if (REC.act && REC.act.paused) return;
        const t = Math.round((Date.now() - REC.start) / 1000);
        const p = [+pos.coords.latitude.toFixed(6), +pos.coords.longitude.toFixed(6), +(pos.coords.altitude || 0).toFixed(1), t, REC.hrLive || 0];
        const last = REC.track[REC.track.length - 1];
        if (last && haversine(last[0], last[1], p[0], p[1]) < 2) return;
        pushPoint(p);
      }, (err) => {
        toast(err.code === 1 ? 'Sem autorização para usar a localização. A usar o simulador.' : 'Sem sinal de GPS. A usar o simulador.');
        navigator.geolocation.clearWatch(REC.watchId); REC.source = 'sim'; simInit();
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
      if (DB.settings.live.clips && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder) {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: 640 }, audio: false }).then((s) => { camStream = s; }).catch(() => { camStream = null; });
      }
    }
  }
  if (REC.source === 'sim') simInit();
  clearInterval(recTimer);
  recTimer = setInterval(recTick, 250);
  try { navigator.wakeLock && navigator.wakeLock.request('screen').catch(() => { }); } catch (e) { }
  if (withActivity) actStart(); else { toast(DB.settings.live.share ? 'Sessão iniciada e partilhada.' : 'Sessão iniciada.'); render(); }
  publishLive(true); cloudPushLive(true);
}
function pushPoint(p) {
  const last = REC.track[REC.track.length - 1];
  if (last) {
    const d = haversine(last[0], last[1], p[0], p[1]);
    REC.sessDist += d;
    if (REC.act && !REC.act.paused) {
      REC.act.dist += d;
      if (REC.act.dist >= REC.act.nextClip) { recordClip(p); REC.act.nextClip += 500; }
    }
    const dt = p[3] - last[3];
    if (dt > 0) { const v = d / dt; REC.cad = v > 0.6 ? Math.round(sportFamily(REC.act ? REC.act.sport : 'run') === 'run' ? clamp(150 + (v - 2.5) * 14, 150, 190) : clamp(100 + (v - 1.2) * 30, 95, 125)) : 0; }
  }
  REC.track.push(p);
}
function recordClip(p) {
  if (!DB.settings.live.clips) return;
  const [x, y] = toXY(p[0], p[1]), c = { km: +(REC.act.dist / 1000).toFixed(1), x, y, url: '' };
  REC.clipList.push(c);
  if (camStream) {
    try {
      const rec = new MediaRecorder(camStream), chunks = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => { c.url = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || 'video/webm' })); };
      rec.start(); setTimeout(() => rec.state !== 'inactive' && rec.stop(), 3000);
    } catch (e) { /* keep the generated frame */ }
  }
}
function simInit() {
  const r = REC.routeId && DB.routes.find((x) => x.id === REC.routeId);
  const pts = r && r.pts.length > 1 ? r.pts : (BASE_ROUTES[(ROUTES_BY_SPORT[REC.sport] || ['ribeira'])[0]] || BASE_ROUTES.ribeira).pts;
  REC.routePts = densify(pts, 20);
  REC.sim = { pts, w: makeWalker(densify(pts, 5)), s: 0, t: 0, lastPt: -99, hr: 90, noise: 0, stopUntil: 0, rnd: mulberry32(Date.now() & 0xffffffff), ox: 0, oy: 0, flip: false };
  REC.pos = REC.sim.w.at(0);
}
function simUseCourse(pts) {
  // a race: walk the runner to the start of the course, then follow it
  const sim = REC.sim, here = sim.w.at(sim.s);
  const path = [[here[0], here[1]], ...pts];
  sim.pts = path; sim.w = makeWalker(densify(path, 5)); sim.s = 0;
  REC.routePts = densify(pts, 20);
}
function recTick() {
  if (REC.state === 'idle') return;
  const a = REC.act;
  if (REC.source === 'sim') {
    const sim = REC.sim, dt = 0.25 * REC.speed;
    const sp = a ? a.sport : REC.sport;
    const base = a ? (BASE_SPEED[sp] || 3) * 1.03 : (BASE_SPEED[sp] || 3) * (sp === 'ride' ? 0.5 : 0.55);
    let left = dt;
    while (left > 0) {
      const step = Math.min(1, left); left -= step; sim.t += step;
      if (sim.t > sim.stopUntil && sim.rnd() < (a ? 0.0015 : 0.004) * step) sim.stopUntil = sim.t + 15 + sim.rnd() * (a ? 20 : 60);
      const stopped = sim.t < sim.stopUntil || (a && a.paused);
      const [x, y] = sim.w.at(sim.s), ah = sim.w.at(sim.s + 15), grade = (terrain(ah[0], ah[1]) - terrain(x, y)) / 15;
      sim.noise = sim.noise * 0.92 + (sim.rnd() - 0.5) * 0.05;
      const v = stopped ? 0 : clamp(base * (1 + sim.noise) * (1 - (sp === 'ride' ? 8 : 4) * grade), base * 0.4, base * 1.6);
      sim.s = Math.min(sim.w.total, sim.s + v * step);
      const moving = v > 0.3;
      if (a && !a.paused && (moving || !DB.settings.autopause)) a.moving += step;
      if (a) a.autoPaused = !moving && !a.paused && DB.settings.autopause;
      sim.hr += (60 + 110 * clamp((a ? 0.66 : 0.42) + 3 * grade + (moving ? 0.1 : -0.25), 0.3, 0.97) - sim.hr) * 0.05 * step;
      REC.hrLive = Math.round(sim.hr);
      if (sim.t - sim.lastPt >= 3 && (moving || sim.t - sim.lastPt >= 15)) {
        sim.lastPt = sim.t;
        sim.ox = clamp(sim.ox * 0.85 + (sim.rnd() - 0.5) * 1.4, -3, 3); sim.oy = clamp(sim.oy * 0.85 + (sim.rnd() - 0.5) * 1.4, -3, 3);
        const [px, py] = sim.w.at(sim.s), ll = toLL(px + sim.ox, py + sim.oy);
        pushPoint([+ll[0].toFixed(6), +ll[1].toFixed(6), +terrain(px, py).toFixed(1), Math.round(sim.t), Math.round(sim.hr)]);
        REC.pos = [px, py];
      }
      if (sim.s >= sim.w.total) {
        if (a && REC.course) { a.paused = true; toast('Chegaste à meta! Termina a atividade.'); break; }
        sim.pts = sim.pts.slice().reverse(); sim.w = makeWalker(densify(sim.pts, 5)); sim.s = 0;     // keep moving: turn around
      }
    }
    if (DB.settings.conn.spotify && Math.floor(sim.t) % 200 < dt) REC.song = PLAYLIST[Math.floor(sim.rnd() * PLAYLIST.length)];
  } else {
    if (a && !a.paused) a.moving = (Date.now() - a.startedAt) / 1000 - (a.pausedFor || 0);
    if (REC.track.length) REC.pos = toXY(REC.track[REC.track.length - 1][0], REC.track[REC.track.length - 1][1]);
  }
  publishLive(); cloudPushLive();
  if (Date.now() - (REC.savedAt || 0) > 10000) { REC.savedAt = Date.now(); try { localStorage.setItem('passo.rec', JSON.stringify({ at: Date.now(), track: REC.track.slice(-3000), start: REC.start, act: REC.act, acts: REC.acts, ranges: REC.ranges, sport: REC.sport })); } catch (e) { } }
  if (R.view === 'record' && Date.now() - lastRender > 480) { lastRender = Date.now(); render(); }
  else if (R.view === 'record') { const t = document.getElementById('rs-time'); if (t) t.textContent = fmtDur(a ? a.moving : (Date.now() - REC.start) / 1000 * (REC.source === 'sim' ? REC.speed : 1)); }
}
function actStart() {
  const course = REC.kind === 'prova' ? coursePts(REC.courseKey) : null;
  REC.course = course;
  REC.act = { startIdx: Math.max(0, REC.track.length - 1), startedAt: Date.now(), sport: REC.sport, kind: REC.kind, name: REC.actName || (REC.kind === 'prova' ? 'Prova' : SPORTS[REC.sport].verb), laps: [], paused: false, moving: 0, dist: 0, nextClip: 500 };
  if (course && REC.source === 'sim') simUseCourse(course);
  toast(REC.kind === 'prova' ? 'Boa prova! A atividade começou.' : 'A atividade começou.');
  render(); publishLive(true);
}
function recStop() { clearInterval(recTimer); if (REC.watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(REC.watchId); REC.watchId = null; if (camStream) { camStream.getTracks().forEach((t) => t.stop()); camStream = null; } }
function actFinish(discard) {
  const a = REC.act; if (!a) return;
  REC.act = null; REC.course = null;
  const pts = REC.track.slice(a.startIdx);
  if (discard) { toast('Atividade descartada. A sessão continua.'); render(); return; }
  if (pts.length < 2) { toast('A atividade é curta demais para guardar. A sessão continua.'); render(); return; }
  const t0 = pts[0][3], g = gearOf(me()).find((x) => x.defaultFor === a.sport && !x.retired);
  const act0 = createActivity({ sport: a.sport, kind: a.kind, name: a.name, desc: '', start: REC.start + t0 * 1000, track: pts.map((p) => [p[0], p[1], p[2], p[3] - t0, p[4]]),
    laps: a.laps.map((i) => i - a.startIdx).filter((i) => i > 0), visibility: DB.settings.defaultVisibility, gearId: g ? g.id : null, rpe: null, photos: [], hideStats: {},
    sessionId: REC.sessionId, race: a.kind === 'prova' ? { name: a.name, photos: [], certs: [] } : undefined, steps: undefined });
  REC.acts.push(act0.id); cloudSaveActivity(act0);
  REC.ranges.push({ kind: 'activity', aid: act0.id, i0: a.startIdx, i1: REC.track.length - 1, label: a.name });
  toast('Atividade guardada na sessão. Podes começar outra.');
  render(); publishLive(true);
}
function sessionFinish() {
  if (REC.act) actFinish(false);
  recStop();
  try { localStorage.removeItem('passo.rec'); } catch (e) { }
  const tr = REC.track;
  if (tr.length < 2) { REC.state = 'idle'; toast('A sessão terminou sem pontos para guardar.'); publishLive(true); render(); return; }
  // ranges between activities are transitions (warm-up, travel, cool-down)
  const ranges = [], acts = REC.ranges.slice().sort((p, q) => p.i0 - q.i0);
  let cur = 0;
  acts.forEach((r, k) => { if (r.i0 > cur) ranges.push({ kind: k === 0 ? 'warmup' : 'transit', label: k === 0 ? 'Deslocação e aquecimento' : 'Transição', i0: cur, i1: r.i0 }); ranges.push(r); cur = r.i1; });
  if (cur < tr.length - 1) ranges.push({ kind: acts.length ? 'cooldown' : 'warmup', label: acts.length ? 'Depois da atividade' : 'Sessão', i0: cur, i1: tr.length - 1 });
  const step = Math.max(1, Math.floor(tr.length / 4000));
  const sess = { id: REC.sessionId, uid: me(), title: acts.length ? 'Sessão: ' + acts.map((r) => r.label).join(' + ') : 'Sessão sem atividade', start: REC.start, shareId: DB.settings.live.share ? REC.shareId : '', track: step > 1 ? tr.filter((_, i) => i % step === 0) : tr, ranges: step > 1 ? ranges.map((r) => ({ ...r, i0: Math.floor(r.i0 / step), i1: Math.floor(r.i1 / step) })) : ranges };
  DB.sessions.unshift(sess); save(); cloudEndLive(); cloudSaveSession(sess);
  REC.state = 'idle'; REC.track = []; REC.act = null;
  publishLive(true);
  toast('Sessão terminada e guardada.');
  navigate('session', { id: sess.id }, false);
}
function recFinish() { sessionFinish(); }

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
  copyText({ t }) { copyText(t); }, cloudOut() { cloudSignOut(); },
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
  recSport({ s }) { REC.sport = s; render(); }, recKind({ k }) { REC.kind = k; render(); },
  sessionStart() { sessionStart(false); }, quickStart() { sessionStart(true); },
  actStart() { const n = document.getElementById('act-name'); if (n) REC.actName = n.value.trim(); actStart(); },
  recPause() { REC.act.paused = true; REC.act.pauseAt = Date.now(); render(); publishLive(true); },
  recResume() { const a = REC.act; if (a.pauseAt) a.pausedFor = (a.pausedFor || 0) + (Date.now() - a.pauseAt) / 1000; a.paused = false; render(); publishLive(true); },
  recLap() { REC.act.laps.push(Math.max(0, REC.track.length - 1)); toast(`Volta ${REC.act.laps.length} marcada.`); render(); },
  actFinish() { actFinish(false); }, actDiscardAsk() { ask('Descartar esta atividade? A sessão continua a gravar.', 'Descartar', () => actFinish(true)); },
  sessionFinishAsk() { ask(REC.act ? 'Terminar a sessão? A atividade em curso é guardada.' : 'Terminar a sessão?', 'Terminar', sessionFinish); },
  recDiscardAsk() { ask('Descartar a sessão inteira? As atividades já guardadas ficam.', 'Descartar', () => { recStop(); REC.state = 'idle'; REC.track = []; REC.act = null; try { localStorage.removeItem('passo.rec'); } catch (e) { } publishLive(true); render(); }); },
  liveSel({ id }) { R.liveSel = id; R.clip = null; render(); }, demoLive() { R.demoSpeed = 10; addSim({ uid: 'u1', course: BASE_ROUTES.prova10k.pts, ability: 1.12, actName: 'Corrida da Ribeira 10K', seed: 7, warmup: true }); ensureLiveTimer(); render(); },
  simSpeed({ n }) { if (R.race) R.race.speed = n; else R.demoSpeed = n; render(); },
  clip(p) { const own = REC.clipList.find((c) => c.x === Math.round(p.x) || (Math.abs(c.x - p.x) < 1 && Math.abs(c.y - p.y) < 1)); R.clip = { ...p, url: own && own.url ? own.url : '' }; render(); if (!R.clip.url) playClip(); },
  clipClose() { R.clip = null; cancelAnimationFrame(_clipAnim); render(); },
  raceEnd() { if (R.race) R.race.ids.forEach((id) => SIMS.delete(id)); R.race = null; render(); },
  raceFocus({ id }) { R.liveSel = id; navigate('live'); },
  async exportAct({ id, what }) { await exportActivity(activity(id), what); }, exportAll() { exportAll(); },
  async certSave({ id, i }) { const c = activity(id).race.certs[i]; const bin = atob(c.data.split(',')[1]); const u8 = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k); await saveFile(c.name, new Blob([u8], { type: c.type }), c.type); },
  rmRacePhoto({ i }) { R.draftRace.photos.splice(i, 1); redrawRace(); }, rmCert({ i }) { R.draftRace.certs.splice(i, 1); redrawRace(); },
  async hrConnect() {
    if (!navigator.bluetooth) { toast('Este navegador não tem Bluetooth. Usa o Chrome no Android ou no computador.'); return; }
    try {
      const dev = await navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] });
      const ch = await (await (await dev.gatt.connect()).getPrimaryService('heart_rate')).getCharacteristic('heart_rate_measurement');
      ch.addEventListener('characteristicvaluechanged', (e) => { const v = e.target.value, f = v.getUint8(0); REC.hrLive = f & 1 ? v.getUint16(1, true) : v.getUint8(1); });
      await ch.startNotifications(); REC.hrDevice = dev.name || 'Sensor'; toast('Sensor ligado: ' + REC.hrDevice); render();
    } catch (e) { toast('Não foi possível ligar o sensor.'); }
  },
  discardAsk() { ask('Descartar esta atividade sem guardar?', 'Descartar', () => { REC.pending = null; navigate('feed', {}, false); }); },
  deleteAsk({ id }) { ask('Apagar esta atividade, os kudos e os comentários? Não dá para desfazer.', 'Apagar', () => { deleteActivity(id); toast('Atividade apagada.'); R.stack = []; navigate('feed', {}, false); }); },
  resetAsk() { ask('Repor todos os dados de exemplo? Perdes o que gravaste nesta demo.', 'Repor', () => { resetDemo(); R.stack = []; toast('Dados de exemplo repostos.'); navigate('feed', {}, false); }); },
  delRouteAsk({ id }) { ask('Apagar esta rota?', 'Apagar', () => { deleteRoute(id); R.confirm = null; render(); }, id); },
  confirmYes() { const c = R.confirm; R.confirm = null; c && c.fn(); if (!R.confirm) render(); },
  confirmNo() { R.confirm = null; render(); },
  recordRoute({ id }) { const r = DB.routes.find((x) => x.id === id); REC.routeId = id; REC.sport = r.sport; REC.source = 'sim'; navigate('record'); },
  resumeRec() { const s = R.resumable; if (!s) return; Object.assign(REC, { track: s.track, start: s.start, act: s.act, acts: s.acts || [], ranges: s.ranges || [], sport: s.sport, source: 'sim', sessionId: uid('ss'), shareId: newShareId(), state: 'session', sessDist: 0, clipList: [] }); simInit(); clearInterval(recTimer); recTimer = setInterval(recTick, 250); R.resumable = null; navigate('record'); },
  dropRec() { try { localStorage.removeItem('passo.rec'); } catch (e) { } R.resumable = null; render(); },
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
  actCourse(el) { REC.courseKey = el.value; }, actName(el) { REC.actName = el.value; },
  liveOpt(el) { DB.settings.live[el.dataset.k] = el.checked; save(); publishLive(true); render(); },
  liveCourse(el) { R.liveCourse = el.value; render(); },
  async liveGpx(el) { const f = el.files[0]; if (!f) return; try { const g = parseGPX(await f.text()); R.liveGpx = g.track.map((p) => toXY(p[0], p[1])); R.liveCourse = 'gpx'; toast('Percurso carregado.'); } catch (e) { toast(e.message); } render(); },
  conn(el) {
    const id = el.dataset.id; DB.settings.conn[id] = el.checked;
    if (id === 'samsung') {
      if (el.checked) { const r = mulberry32(99), today = startOfDay(Date.now()); for (let i = 0; i < 60; i++) { const t = today - i * 864e5, base = new Date(t).getDay() % 6 === 0 ? 6500 : 8200; const ex = DB.activities.filter((a) => a.uid === me() && startOfDay(a.start) === t).reduce((s, a) => s + ((activitySteps(a) || {}).steps || 0), 0); DB.steps[dayKey(t)] = Math.round(base + r() * 4200 + ex); } toast('Samsung Health ligado (dados de demonstração).'); }
      else { DB.steps = {}; toast('Samsung Health desligado.'); }
    }
    save(); render();
  },
  async stepsCsv(el) {
    const f = el.files[0]; if (!f) return; let n = 0;
    (await f.text()).split(/\r?\n/).forEach((line) => { const m = line.match(/(\d{4}-\d{2}-\d{2})[^\d]+(\d+)/); if (m) { DB.steps[m[1]] = +m[2]; n++; } });
    save(); toast(n ? `${n} dias de passos importados.` : 'Não encontrei linhas no formato data,passos.'); render();
  },
  async gearPhoto(el) { const f = el.files[0]; if (!f) return; try { saveGear({ id: el.dataset.id, photo: await resizeImage(f, 600) }); render(); } catch (e) { toast('Não foi possível ler essa imagem.'); } },
  async racePhoto(el) { for (const f of [...el.files].slice(0, 12)) { try { R.draftRace.photos.push(await resizeImage(f, 1200)); } catch (e) { toast('Não foi possível ler uma das imagens.'); } } el.value = ''; redrawRace(); },
  async raceCert(el) {
    for (const f of [...el.files]) {
      if (f.size > 1.5 * 1024 * 1024 && !f.type.startsWith('image/')) { toast(`${f.name} tem mais de 1,5 MB.`); continue; }
      const data = f.type.startsWith('image/') ? await resizeImage(f, 1400) : await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(f); });
      R.draftRace.certs.push({ name: f.name, type: f.type.startsWith('image/') ? 'image/jpeg' : f.type || 'application/pdf', data });
    }
    el.value = ''; redrawRace();
  },
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
    REC.pending = null; R.stack = [{ view: 'feed', params: {} }]; cloudSaveActivity(a);
    const effs = analyze(a).hasMap ? effortsFor(a, DB.segments) : [], prs = effs.filter((e) => effortBadges(e).isPR).length;
    toast(prs ? `Atividade guardada. ${prs} ${prs > 1 ? 'recordes pessoais' : 'recorde pessoal'} em segmentos!` : 'Atividade guardada.');
    navigate('activity', { id: a.id }, false);
  },
  edit(fd, form) {
    const isRace = !!fd.get('isRace'), num = (k) => (fd.get(k) ? +fd.get(k) : null);
    const race = isRace ? { name: fd.get('r_name').trim(), bib: fd.get('r_bib').trim(), official: parseDur(fd.get('r_official')), pos: num('r_pos'), total: num('r_total'), cat: fd.get('r_cat').trim(), posCat: num('r_posCat'), url: fd.get('r_url').trim(), photos: R.draftRace.photos, certs: R.draftRace.certs } : undefined;
    updateActivity(form.dataset.id, { kind: isRace ? 'prova' : 'treino', race, sport: fd.get('sport'), name: fd.get('name').trim(), desc: fd.get('desc').trim(), visibility: fd.get('visibility'), gearId: fd.get('gearId') || null, rpe: fd.get('rpe') ? +fd.get('rpe') : null, photos: R.draftPhotos || [], hideStats: { pace: !!fd.get('h_pace'), hr: !!fd.get('h_hr'), calories: !!fd.get('h_calories') } });
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
    saveGear({ kind: fd.get('kind'), name: fd.get('name').trim(), brand: fd.get('brand').trim(), type: fd.get('type'), drop: fd.get('drop') === '' ? null : +fd.get('drop'), weight: +fd.get('weight') || null, alertKm: Math.round((+fd.get('alert') || 0) * k), defaultFor: fd.get('defaultFor'), retired: false });
    toast('Equipamento adicionado.'); render();
  },
  gearEdit(fd, form) {
    const k = S.units === 'imperial' ? 1.609344 : 1;
    saveGear({ id: form.dataset.id, name: fd.get('name').trim(), brand: fd.get('brand').trim(), type: fd.get('type'), drop: fd.get('drop') === '' ? null : +fd.get('drop'), weight: +fd.get('weight') || null, purchased: fd.get('purchased'), price: +fd.get('price') || null, alertKm: Math.round((+fd.get('alert') || 0) * k), notes: fd.get('notes').trim() });
    toast('Equipamento guardado.'); render();
  },
  race(fd) {
    const key = fd.get('course'), course = coursePts(key), name = fd.get('name').trim() || 'Prova', runners = fd.getAll('runners');
    if (!runners.length && !String(fd.get('links') || '').trim()) { toast('Escolhe pelo menos um atleta.'); return; }
    SIMS.clear();
    const links = String(fd.get('links') || '').split(/\s+/).map(shareFromText).filter(Boolean);
    if (CLOUD.ok) links.forEach(followShare);
    R.race = { name, course: key, speed: 10, ids: [...links.map((s) => 'cloud-' + s), ...runners.map((u, i) => addSim({ uid: u, course, ability: (user(u).ability || 1) * (0.94 + (hashStr(u + name) % 100) / 1000), actName: name, seed: 100 + i }))] };
    ensureLiveTimer(); render();
  },
  cloudIn(fd) { cloudSignIn(fd.get('email').trim(), fd.get('password'), fd.get('mode') === 'create'); },
  followLink(fd) { const s = shareFromText(fd.get('link') || ''); if (!s) { toast('Esse link não parece um link de partilha do Passo.'); return; } if (!CLOUD.ok) { toast('Sem ligação ao servidor neste ambiente.'); return; } followShare(s); R.liveSel = 'cloud-' + s; toast('A seguir.'); render(); },
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
    e.preventDefault(); if (FORMS[f.dataset.form]) FORMS[f.dataset.form](new FormData(f, e.submitter && e.submitter.form === f && e.submitter.name ? e.submitter : undefined), f);
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
try { const s = JSON.parse(localStorage.getItem('passo.rec') || 'null'); if (s && s.track && s.track.length > 1 && Date.now() - s.at < 6 * 36e5) R.resumable = s; } catch (e) { }
if (location.hash === '#aovivo') { R.view = 'live'; ensureLiveTimer(); }
render();
initRoom();
cloudInit();
window.addEventListener('hashchange', () => { if (location.hash === '#aovivo') navigate('live'); });
