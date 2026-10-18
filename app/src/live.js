/* live.js: live sharing of sessions, following several runners in one race,
   500 m clips, now-playing, official race files, CSV export, shoes and steps. */
'use strict';

const APP_URL = 'https://claude.ai/artifact/YWWo8nGdZsjqCQyLorTM4d';
function shareUrl() {
  const h = location.hostname || '';
  const hosted = /^https?:$/.test(location.protocol) && h && !/claude|anthropic|localhost|127\.0\.0\.1/.test(h);
  return (hosted ? location.origin + location.pathname : APP_URL) + '#aovivo';
}
function whatsappHref(text) { return 'https://wa.me/?text=' + encodeURIComponent(text); }

/* ---------- the room: other devices that have the app open ---------- */
let ROOM = null;
const PEERS = new Map();            // peer -> {snap, trail, seen}
async function initRoom() {
  try { ROOM = window.claude && typeof window.claude.use === 'function' ? await window.claude.use('room') : null; } catch (e) { ROOM = null; }
  if (!ROOM) return;
  ROOM.onPeers((ch) => {
    const alive = new Set();
    ch.peers.forEach((p) => {
      const l = p.presence && p.presence.live;
      if (!l || p.isMe || typeof l !== 'object') return;
      alive.add(p.peer);
      const e = PEERS.get(p.peer) || { trail: [] };
      const lastT = e.trail.length ? e.trail[e.trail.length - 1][2] : -1;
      (Array.isArray(l.trail) ? l.trail : []).forEach((pt) => { if (Array.isArray(pt) && pt[2] > lastT) e.trail.push(pt); });
      if (e.trail.length > 4000) e.trail.splice(0, e.trail.length - 4000);
      e.snap = l; e.seen = Date.now();
      PEERS.set(p.peer, e);
    });
    [...PEERS.keys()].forEach((k) => { if (!alive.has(k)) PEERS.delete(k); });
    liveRerender();
  }, () => { });
}
let _lastPub = 0;
function publishLive(force) {
  if (!ROOM || !(Date.now() - _lastPub > 2000 || force)) return;
  _lastPub = Date.now();
  const snap = REC.state !== 'idle' && DB.settings.live.share ? liveSnapOwn(true) : null;
  ROOM.presence({ live: snap }).catch(() => { });
}

/* ---------- live snapshots: one shape for me, room peers and simulations ---------- */
function curPace(track, n = 5) {
  if (track.length <= n) return 0;
  const a = track[track.length - 1 - n], b = track[track.length - 1];
  const d = haversine(a[0], a[1], b[0], b[1]), dt = b[3] - a[3];
  return d > 3 ? dt / (d / 1000) : 0;
}
function liveSnapOwn(compact) {
  const tr = REC.track; if (!tr.length) return null;
  const last = tr[tr.length - 1], u = user(me()), a = REC.act;
  const actMoving = a ? a.moving : 0;
  const snap = {
    v: 1, id: REC.shareId, uid: me(), name: u.name, sport: a ? a.sport : REC.sport, phase: a ? 'activity' : 'session',
    kind: a ? a.kind : '', actName: a ? a.name : '', paused: !!(a && a.paused),
    sessStart: REC.start, sessT: last[3], sessDist: Math.round(REC.sessDist), actDist: a ? Math.round(a.dist) : 0, actT: actMoving,
    pace: Math.round(curPace(tr)), hr: last[4] || (REC.hrLive || 0), cad: REC.cad || 0, ele: Math.round(last[2]), lat: last[0], lon: last[1],
    song: DB.settings.live.music && REC.song ? { title: REC.song[0], artist: REC.song[1] } : null,
    clips: DB.settings.live.clips ? REC.clipList.slice(-12).map((c) => ({ km: c.km, x: Math.round(c.x), y: Math.round(c.y) })) : [],
    course: REC.course ? decimate(REC.course, 40).map((p) => [Math.round(p[0]), Math.round(p[1])]) : null,
    at: Date.now(),
  };
  const tail = compact ? tr.slice(-25) : tr;
  snap.trail = tail.map((p) => [+p[0].toFixed(5), +p[1].toFixed(5), p[3]]);
  return snap;
}

/* Simulated runners: for the demo, and for following a race with friends. */
const SIMS = new Map();
function addSim({ uid: who, course, ability, name, actName, seed, warmup }) {
  const id = 'sim-' + who + '-' + (seed || 1);
  const r = mulberry32(seed || hashStr(who));
  SIMS.set(id, { id, uid: who, name: name || user(who).name, course, w: makeWalker(densify(course, 5)), s: 0, t: 0, ability, r, noise: 0, hr: 95,
    trail: [], clips: [], nextClip: 500, actName: actName || 'Treino', warm: 0, song: PLAYLIST[Math.floor(r() * PLAYLIST.length)], done: false, start: Date.now() });
  const m = SIMS.get(id); m.warm = m.warmTotal = warmup ? 300 + r() * 400 : 0;
  return id;
}
function tickSims(dt) {
  SIMS.forEach((m) => {
    if (m.done) return;
    let left = dt;
    while (left > 0) {
      const step = Math.min(2, left); left -= step; m.t += step;
      if (m.warm > 0) { m.warm -= step; m.hr += (110 - m.hr) * 0.05; if (Math.floor(m.t) % 6 === 0) pushSimPt(m); continue; }
      const [x, y] = m.w.at(m.s), ah = m.w.at(m.s + 15), g = (terrain(ah[0], ah[1]) - terrain(x, y)) / 15;
      m.noise = m.noise * 0.9 + (m.r() - 0.5) * 0.05;
      const fat = 1 - 0.05 * (m.s / m.w.total);
      const v = clamp(BASE_SPEED.run * m.ability * (1 + m.noise) * (1 - 4 * g) * fat, 1.5, 6.5);
      m.s = Math.min(m.w.total, m.s + v * step);
      m.hr += (60 + 125 * clamp(0.78 + 3 * g + 0.12 * m.s / m.w.total, 0.5, 0.99) - m.hr) * 0.05 * step;
      if (m.s >= m.nextClip) { const p = m.w.at(m.s); m.clips.push({ km: +(m.nextClip / 1000).toFixed(1), x: Math.round(p[0]), y: Math.round(p[1]) }); m.nextClip += 500; }
      if (Math.floor(m.t) % 4 === 0) pushSimPt(m);
      if (Math.floor(m.t) % 210 === 0) m.song = PLAYLIST[Math.floor(m.r() * PLAYLIST.length)];
      if (m.s >= m.w.total) { m.done = true; m.finish = m.t; pushSimPt(m); break; }
    }
  });
}
function pushSimPt(m) { const [x, y] = m.w.at(m.s), ll = toLL(x, y); const last = m.trail[m.trail.length - 1]; if (last && last[2] === Math.round(m.t)) return; m.trail.push([+ll[0].toFixed(5), +ll[1].toFixed(5), Math.round(m.t), Math.round(m.hr)]); }
function simSnap(m) {
  const tr = m.trail, last = tr[tr.length - 1] || [...toLL(...m.w.at(0)), 0, 0];
  let pace = 0;
  if (tr.length > 5) { const a = tr[tr.length - 6], d = haversine(a[0], a[1], last[0], last[1]); pace = d > 3 ? (last[2] - a[2]) / (d / 1000) : 0; }
  const running = m.warm <= 0;
  const actT = running ? Math.max(0, m.t - (m.warmTotal || 0)) : 0;
  return {
    v: 1, id: m.id, uid: m.uid, name: m.name, sport: 'run', phase: running ? 'activity' : 'session', kind: 'prova', actName: m.actName, paused: false, done: m.done,
    sessStart: m.start, sessT: m.t, sessDist: Math.round(m.s), actDist: Math.round(m.s), actT: m.done ? m.finish - (m.warmTotal || 0) : actT,
    pace: Math.round(pace), hr: Math.round(m.hr), cad: running ? Math.round(clamp(150 + (1000 / (pace || 330) - 2.5) * 14, 150, 190)) : 0,
    ele: Math.round(terrain(...m.w.at(m.s))), lat: last[0], lon: last[1], song: { title: m.song[0], artist: m.song[1] }, clips: m.clips.slice(-12),
    course: decimate(m.course, 60), trail: tr, sim: true, at: Date.now(),
  };
}
function liveList() {
  const out = [];
  if (REC.state !== 'idle') { const s = liveSnapOwn(false); if (s) out.push({ ...s, mine: true }); }
  PEERS.forEach((e, k) => { if (e.snap) out.push({ ...e.snap, trail: e.trail, peer: k, remote: true }); });
  SIMS.forEach((m) => out.push(simSnap(m)));
  return out;
}

let _liveTimer = 0, _liveLast = 0;
function liveRerender() {
  if (!['live', 'race', 'record'].includes(R.view)) return;
  const ae = document.activeElement;
  if (ae && /INPUT|SELECT|TEXTAREA/.test(ae.tagName) && R.view !== 'record') return;
  if (Date.now() - _liveLast < 700) return;
  _liveLast = Date.now(); render();
}
function ensureLiveTimer() {
  if (_liveTimer) return;
  let last = Date.now();
  _liveTimer = setInterval(() => {
    const now = Date.now(), dt = (now - last) / 1000; last = now;
    if (SIMS.size) tickSims(dt * (R.race ? R.race.speed : (R.demoSpeed || 10)));
    if (R.view === 'live' || R.view === 'race') liveRerender();
  }, 1000);
}

/* ---------- course helpers ---------- */
function courseOptions() {
  return [['b:prova10k', BASE_ROUTES.prova10k.name + ' (demo)'], ['b:ribeira', BASE_ROUTES.ribeira.name + ' (demo)'], ['b:miradouro', BASE_ROUTES.miradouro.name + ' (demo)'],
    ...DB.routes.filter((r) => r.uid === me()).map((r) => ['r:' + r.id, r.name])];
}
function coursePts(key) {
  if (!key) return null;
  if (key === 'gpx') return R.liveGpx || null;
  if (key.startsWith('b:')) return BASE_ROUTES[key.slice(2)]?.pts || null;
  const r = DB.routes.find((x) => x.id === key.slice(2)); return r ? r.pts : null;
}
/* Distance covered along a course for a position, and what is left. */
function courseProgress(course, x, y, hintFrac = 0) {
  const d = densify(course, 25); let best = Infinity, bi = 0, L = 0; const cum = [0];
  for (let i = 1; i < d.length; i++) { L += Math.hypot(d[i][0] - d[i - 1][0], d[i][1] - d[i - 1][1]); cum.push(L); }
  for (let i = 0; i < d.length; i++) {
    const dd = Math.hypot(d[i][0] - x, d[i][1] - y) + Math.abs(cum[i] / L - hintFrac) * 400;   // out-and-back courses: prefer the leg we expect
    if (dd < best) { best = dd; bi = i; }
  }
  return { covered: cum[bi], total: L, off: Math.hypot(d[bi][0] - x, d[bi][1] - y) };
}

/* ---------- 500 m clips: a frame of where the runner is ---------- */
const _frameCache = new Map();
function drawScene(ctx, w, h, x, y, phase) {
  const r = mulberry32(hashStr(Math.round(x / 40) + ':' + Math.round(y / 40)));
  const park = isPark(Math.floor(x / 320), Math.floor(y / 320)), river = y - RIVER_Y < 260;
  const hz = h * 0.46;
  const sky = ctx.createLinearGradient(0, 0, 0, hz); sky.addColorStop(0, '#7fb2e0'); sky.addColorStop(1, '#dce9f2');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, hz);
  ctx.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 3; i++) { const cx = (r() * w + phase * 6) % w, cy = r() * hz * 0.5; ctx.beginPath(); ctx.ellipse(cx, cy, 30 + r() * 30, 9, 0, 0, 7); ctx.fill(); }
  ctx.fillStyle = park ? '#8bb36d' : '#b9b3a6'; ctx.fillRect(0, hz, w, h - hz);
  if (river) { ctx.fillStyle = '#6f9fc4'; ctx.fillRect(0, hz - 2, w * 0.42, (h - hz) * 0.35); }
  // buildings or trees on each side, in perspective
  for (let side = 0; side < 2; side++) {
    for (let k = 0; k < 7; k++) {
      const depth = (k + ((phase * 0.6) % 1)) / 7, sc = 1 - depth * 0.85;
      const bx = side ? w * (0.62 + depth * -0.1) + (1 - depth) * w * 0.25 : w * (0.38 + depth * 0.1) - (1 - depth) * w * 0.25;
      if (park || (river && side === 0)) {
        if (river && side === 0) continue;
        ctx.fillStyle = '#5d8a45'; ctx.beginPath(); ctx.arc(bx, hz - 18 * sc, 26 * sc, 0, 7); ctx.fill();
        ctx.fillStyle = '#6b4f2f'; ctx.fillRect(bx - 2 * sc, hz - 6 * sc, 4 * sc, 16 * sc);
      } else {
        const bh = (40 + r() * 70) * sc, bw = (34 + r() * 30) * sc;
        ctx.fillStyle = ['#d9cbb4', '#e7ded0', '#c9b79c', '#f0e6d8', '#bfae95'][Math.floor(r() * 5)];
        ctx.fillRect(side ? bx : bx - bw, hz - bh + 6 * sc, bw, bh);
        ctx.fillStyle = 'rgba(60,70,80,.35)';
        for (let wy = hz - bh + 12 * sc; wy < hz; wy += 12 * sc) for (let wx = 4 * sc; wx < bw - 6 * sc; wx += 10 * sc) ctx.fillRect((side ? bx : bx - bw) + wx, wy, 4 * sc, 5 * sc);
      }
    }
  }
  // road
  ctx.fillStyle = park ? '#c9b48a' : '#6d6f73';
  ctx.beginPath(); ctx.moveTo(w * 0.08, h); ctx.lineTo(w * 0.47, hz); ctx.lineTo(w * 0.53, hz); ctx.lineTo(w * 0.92, h); ctx.fill();
  if (!park) { ctx.strokeStyle = '#f2f2f2'; ctx.lineWidth = 3; for (let k = 0; k < 6; k++) { const f = ((k + phase) % 6) / 6, y0 = hz + (h - hz) * f * f, y1 = hz + (h - hz) * Math.min(1, (f + 0.07) * (f + 0.07)); ctx.beginPath(); ctx.moveTo(w / 2, y0); ctx.lineTo(w / 2, y1); ctx.stroke(); } }
}
function sceneFrame(x, y, km, w = 320, h = 180) {
  const key = Math.round(x) + ':' + Math.round(y) + ':' + w;
  if (_frameCache.has(key)) return _frameCache.get(key);
  let url = '';
  try {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d');
    drawScene(ctx, w, h, x, y, 0);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(8, h - 30, 74, 22); ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.fillText('km ' + NF1.format(km), 14, h - 14);
    url = c.toDataURL('image/jpeg', 0.7);
  } catch (e) { url = ''; }
  _frameCache.set(key, url);
  return url;
}
let _clipAnim = 0;
function playClip() {
  cancelAnimationFrame(_clipAnim);
  const c = document.getElementById('clip-canvas'); if (!c || !R.clip) return;
  const ctx = c.getContext('2d'), t0 = performance.now(), { x, y } = R.clip;
  const frame = (now) => {
    const ph = ((now - t0) / 1000) * 2.2;
    drawScene(ctx, c.width, c.height, x, y, ph);
    if (document.getElementById('clip-canvas') === c) _clipAnim = requestAnimationFrame(frame);
  };
  _clipAnim = requestAnimationFrame(frame);
}

/* ---------- CSV export ---------- */
function csvCell(v) { if (v == null) return ''; const s = String(v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function toCSV(rows) { return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n'; }
async function saveFile(filename, data, mime = 'text/csv') {
  try { const dl = window.claude && typeof window.claude.use === 'function' ? await window.claude.use('downloads') : null; if (dl) { await dl.save({ filename, data }); return; } }
  catch (e) { if (e && e.code === 'declined') return; }
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: mime })); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); toast('Ficheiro exportado: ' + filename); }
  catch (e) { toast('Este navegador não deixou guardar o ficheiro.'); }
}
const SUMMARY_HEAD = ['id', 'nome', 'desporto', 'tipo', 'inicio', 'distancia_m', 'tempo_movimento_s', 'tempo_decorrido_s', 'desnivel_m', 'ritmo_medio_min_km', 'velocidade_media_kmh', 'fc_media', 'fc_max', 'calorias', 'passos', 'cadencia_spm', 'esforco_relativo', 'esforco_percebido', 'equipamento', 'sessao', 'prova', 'dorsal', 'tempo_oficial_s', 'posicao_geral', 'participantes', 'posicao_escalao', 'escalao', 'link_resultados', 'fotos_oficiais', 'certificados', 'kudos', 'comentarios', 'descricao'];
function summaryRow(a) {
  const an = analyze(a), st = activitySteps(a), g = a.gearId ? DB.gear.find((x) => x.id === a.gearId) : null, rc = a.race || {};
  const sess = a.sessionId ? (DB.sessions.find((s) => s.id === a.sessionId) || {}).title : '';
  return [a.id, a.name, SPORTS[a.sport].label, a.kind === 'prova' ? 'Prova' : 'Treino', new Date(a.start).toISOString(), Math.round(an.dist), Math.round(an.moving), Math.round(an.elapsed), Math.round(an.gain),
    an.dist ? (an.moving / 60 / (an.dist / 1000)).toFixed(2) : '', an.moving ? (an.dist / 1000 / (an.moving / 3600)).toFixed(1) : '', an.avgHr || '', an.maxHr || '', an.calories, st ? st.steps : '', st ? st.cadence : '', an.effort, a.rpe || '',
    g ? g.name : '', sess || '', rc.name || '', rc.bib || '', rc.official || '', rc.pos || '', rc.total || '', rc.posCat || '', rc.cat || '', rc.url || '',
    (rc.photos || []).length, (rc.certs || []).map((c) => c.name).join(' | '), kudosOf(a.id).length, commentsOf(a.id).length, a.desc || ''];
}
function exportActivity(a, what) {
  const an = analyze(a), base = (a.name || 'atividade').replace(/[^\w\-]+/g, '_');
  if (what === 'summary') return saveFile(base + '_resumo.csv', toCSV([SUMMARY_HEAD, summaryRow(a)]));
  if (what === 'splits') return saveFile(base + '_parciais.csv', toCSV([['parcial', 'distancia_m', 'tempo_s', 'ritmo_min_km', 'desnivel_m', 'fc_media'], ...an.splits.map((s) => [s.n, Math.round(s.dist), s.time, (s.time / 60 / (s.dist / 1000)).toFixed(2), Math.round(s.elev), s.hr || ''])]));
  const t = trackOf(a);
  if (!t) { toast('Esta atividade não tem pontos GPS.'); return; }
  return saveFile(base + '_pontos.csv', toCSV([['t_s', 'hora', 'lat', 'lon', 'altitude_m', 'fc', 'distancia_m'], ...t.map((p, i) => [p[3], new Date(a.start + p[3] * 1000).toISOString(), p[0], p[1], p[2], p[4] || '', Math.round(an.cum[i])])]));
}
function exportAll() {
  const acts = DB.activities.filter((a) => a.uid === me()).sort((a, b) => a.start - b.start);
  return saveFile('passo_atividades.csv', toCSV([SUMMARY_HEAD, ...acts.map(summaryRow)]));
}

/* ---------- views ---------- */
function liveBanner() {
  const list = liveList().filter((s) => !s.mine);
  if (!list.length) return '';
  return `<button class="card live-banner" ${go('live')}><span class="live-dot"></span><span class="grow left"><b>${list.length === 1 ? esc(list[0].name) + ' está em direto' : list.length + ' atletas em direto'}</b><span class="muted sm">${list.length === 1 ? esc(list[0].phase === 'activity' ? list[0].actName : 'Sessão iniciada, ainda não começou a atividade') : 'Toca para acompanhar'}</span></span>${icon('back', 18, 'flip-ic')}</button>`;
}

function viewLive() {
  ensureLiveTimer();
  const list = liveList();
  if (!list.length) {
    return `${pageHead('Ao vivo', 'Atletas a partilhar a sessão agora', '', false)}
      ${empty('Ninguém está a partilhar agora', 'Quando alguém partilhar uma sessão contigo, aparece aqui o mapa, os indicadores e a música em tempo real.', `<div class="row-gap"><button class="btn btn-primary" data-act="demoLive">${icon('play', 18)}Ver uma demonstração</button><button class="btn btn-secondary" ${go('race')}>${icon('groups', 18)}Seguir vários atletas numa prova</button></div>`)}
      <section class="card"><h3 class="h-sm">Como funciona</h3><p class="sm">Quem corre inicia uma <b>sessão</b> na app (por exemplo ao sair de casa) e partilha o link pelo WhatsApp. Quem abre o link vê-o no mapa logo a partir daí: deslocação, aquecimento e depois a atividade, quando ele carregar em iniciar.</p></section>`;
  }
  const sel = list.find((s) => s.id === R.liveSel) || list[0];
  R.liveSel = sel.id;
  return `${pageHead('Ao vivo', `${list.length} ${list.length > 1 ? 'atletas' : 'atleta'} a partilhar`, `<div class="ph-r"><button class="btn btn-secondary btn-sm" ${go('race')}>${icon('groups', 16)}Seguir prova</button></div>`, false)}
    <div class="live-layout">
      <aside class="live-list">${list.map((s) => `<button class="card live-item ${s.id === sel.id ? 'cur' : ''}" ${act('liveSel', { id: s.id })}>${avatar(s.uid && DB.users.find((u) => u.id === s.uid) ? s.uid : { id: s.id, name: s.name || 'Atleta' }, 36)}<span class="grow left"><b>${esc(s.name || 'Atleta')}${s.mine ? ' (tu)' : ''}</b><span class="muted sm">${s.done ? 'Terminou' : s.phase === 'activity' ? esc(s.actName || 'Atividade') : 'Sessão iniciada'} · ${fmtDistU(s.phase === 'activity' ? s.actDist : s.sessDist, 1)}</span></span>${s.done ? '' : '<span class="live-dot"></span>'}</button>`).join('')}</aside>
      <div class="live-main">${liveDetail(sel)}</div>
    </div>
    ${R.clip ? clipModal() : ''}`;
}
function liveDetail(s) {
  const trailXY = (s.trail || []).map((p) => toXY(p[0], p[1]));
  const pos = trailXY[trailXY.length - 1] || toXY(s.lat, s.lon);
  const course = coursePts(R.liveCourse) || s.course;
  const lines = [];
  if (course) lines.push({ xy: densify(course, 30), cls: 'm-plan-solid', w: 6, noHalo: true });
  if (trailXY.length > 1) lines.push({ xy: trailXY, cls: '' });
  const bbox = course ? bboxOf([course], 250) : bboxOf([trailXY.length ? trailXY : [pos]], 500);
  const clipPins = (s.clips || []).map((c) => ({ kind: 'pin', xy: [c.x, c.y], r: 4 }));
  let prog = null;
  if (course && s.phase === 'activity') prog = courseProgress(course, pos[0], pos[1], s.actDist / (pathLength(course) || 1));
  const avg = s.actDist > 50 ? s.actT / (s.actDist / 1000) : 0;
  const eta = prog && avg ? Date.now() + (prog.total - prog.covered) / 1000 * avg * 1000 / (s.sim ? (R.race ? R.race.speed : (R.demoSpeed || 10)) : 1) : 0;
  const phase = s.done ? 'Terminou' : s.phase === 'activity' ? (s.kind === 'prova' ? 'Prova' : 'Treino') + (s.paused ? ' · em pausa' : '') : 'Sessão iniciada · ainda não começou';
  const metric = (l, v, u = '') => `<div class="lm"><div class="rs-l">${l}</div><div class="lm-v">${v}${u ? `<small>${u}</small>` : ''}</div></div>`;
  return `<section class="card live-head"><div class="ah-who">${avatar(s.uid && DB.users.find((u) => u.id === s.uid) ? s.uid : { id: s.id, name: s.name || 'Atleta' }, 44)}<div class="grow"><b class="big">${esc(s.name || 'Atleta')}</b><div class="sm"><span class="pill ${s.phase === 'activity' && !s.done ? 'pill-live' : 'pill-soft'}">${phase}</span> ${s.actName && s.phase === 'activity' ? esc(s.actName) : ''}</div></div>
      <div class="right sm muted">Sessão: ${fmtDur(s.sessT)}<br>${s.sim ? 'Simulação' : s.remote ? 'Noutro dispositivo' : s.mine ? 'Este dispositivo' : ''}</div></div></section>
    <section class="card flush live-map">${mapSVG({ lines: lines.length ? lines : [{ xy: [pos, pos] }], markers: [...clipPins, ...(trailXY.length ? [{ kind: 'start', xy: trailXY[0] }] : []), { kind: 'me', xy: pos }], w: 900, h: 420, bbox, label: 'Posição em direto' })}
      ${prog ? `<div class="map-note">${icon('flag', 14)} Falta ${fmtDistU(Math.max(0, prog.total - prog.covered), 1)} · chegada prevista às ${DTF_TIME.format(eta)}</div>` : ''}</section>
    <section class="card"><div class="live-metrics">
      ${metric(s.phase === 'activity' ? 'Tempo' : 'Tempo de sessão', fmtDur(s.phase === 'activity' ? s.actT : s.sessT))}
      ${metric('Distância', fmtDist(s.phase === 'activity' ? s.actDist : s.sessDist), distUnit())}
      ${metric('Ritmo atual', s.pace ? fmtPace(1000, s.pace) : '–', '/' + distUnit())}
      ${metric('Ritmo médio', avg ? fmtPace(1000, avg) : '–', '/' + distUnit())}
      ${metric('FC', s.hr || '–', s.hr ? 'bpm' : '')}
      ${metric('Cadência', s.cad || '–', s.cad ? 'ppm' : '')}
      ${metric('Altitude', fmtElev(s.ele || 0), elevUnit())}
      ${prog ? metric('Percurso', NF0.format(prog.covered / prog.total * 100), '%') : ''}
    </div></section>
    ${s.song ? `<section class="card music"><span class="disc" style="--dc:${AV_COLORS[hashStr(s.song.title) % AV_COLORS.length]}"></span><div class="grow"><div class="xs muted up">A ouvir agora</div><b>${esc(s.song.title)}</b><div class="muted sm">${esc(s.song.artist)}</div></div><span class="eq"><i></i><i></i><i></i></span></section>` : ''}
    <section class="card"><div class="card-h"><h3>Clipes a cada 500 m</h3><span class="muted sm">${(s.clips || []).length}</span></div>
      ${(s.clips || []).length ? `<div class="clips">${s.clips.slice().reverse().map((c) => `<button class="clip" ${act('clip', { x: c.x, y: c.y, km: c.km, name: s.name })} aria-label="Ver clipe do km ${NF1.format(c.km)}"><img src="${sceneFrame(c.x, c.y, c.km)}" alt=""><span>${icon('play', 14)} km ${NF1.format(c.km)}</span></button>`).join('')}</div>` : '<p class="muted sm">O primeiro clipe chega aos 500 m da atividade.</p>'}
      <p class="muted xs">${s.sim || !s.remote ? 'Na demonstração as imagens são geradas a partir do local no mapa. Na app nativa são gravadas pela câmara do telemóvel.' : ''}</p></section>
    <section class="card form"><h3 class="h-sm">Percurso da prova</h3><p class="muted sm">Carrega o percurso oficial para veres quanto falta e a hora prevista de chegada.</p>
      <div class="form-grid"><label class="fld"><span>Percurso</span><select id="live-course" data-change="liveCourse"><option value="">${s.course ? 'O que o atleta partilhou' : 'Nenhum'}</option>${courseOptions().map(([k, l]) => `<option value="${k}" ${R.liveCourse === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}${R.liveGpx ? `<option value="gpx" ${R.liveCourse === 'gpx' ? 'selected' : ''}>Ficheiro GPX carregado</option>` : ''}</select></label>
      <label class="fld"><span>Ou um ficheiro GPX</span><input type="file" id="live-gpx" accept=".gpx" data-change="liveGpx"></label></div></section>
    ${s.sim ? `<div class="chips"><span class="muted sm">Velocidade da simulação:</span>${[1, 10, 30].map((n) => `<button class="chip ${(R.race ? R.race.speed : (R.demoSpeed || 10)) === n ? 'on' : ''}" ${act('simSpeed', { n })}>${n}×</button>`).join('')}</div>` : ''}`;
}
function clipModal() {
  const c = R.clip;
  return `<div class="modal" role="dialog" aria-label="Clipe do km ${NF1.format(c.km)}"><div class="modal-card"><div class="card-h"><h3>${esc(c.name)} · km ${NF1.format(c.km)}</h3><button class="icon-btn" data-act="clipClose" aria-label="Fechar">${icon('close')}</button></div>
    ${c.url ? `<video src="${c.url}" autoplay muted playsinline loop class="clip-video"></video>` : `<canvas id="clip-canvas" width="640" height="360" class="clip-video"></canvas>`}
    <p class="muted xs">Clipe de 3 segundos gravado ao passar no km ${NF1.format(c.km)}.</p></div></div>`;
}

/* Feature 5: follow several runners in the same race. */
function viewRace() {
  ensureLiveTimer();
  if (!R.race) {
    const cand = [...new Set([...followingOf(me()), ...DB.clubs.filter((c) => c.members.includes(me())).flatMap((c) => c.members)])].filter((u) => u !== me());
    return `${pageHead('Seguir uma prova', 'Acompanha vários atletas ao mesmo tempo')}
      <form class="card form" data-form="race">
        <label class="fld"><span>Nome</span><input id="race-name" name="name" required maxlength="60" value="Corrida da Ribeira 10K"></label>
        <label class="fld"><span>Percurso da prova</span><select id="race-course" name="course">${courseOptions().map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select></label>
        <fieldset class="fld"><legend>Atletas a seguir</legend><div class="pick-grid">${cand.map((u) => `<label class="pick"><input type="checkbox" name="runners" value="${u}" ${['u1', 'u3', 'u8', 'u5'].includes(u) ? 'checked' : ''}>${avatar(u, 28)}<span>${esc(user(u).name)}</span></label>`).join('')}</div></fieldset>
        <p class="muted sm">Na demonstração estes atletas são simulados no percurso. Quem estiver a partilhar uma sessão a sério noutro dispositivo também aparece.</p>
        <div class="form-actions"><button class="btn btn-primary">${icon('play', 18)}Começar a seguir</button></div>
      </form>`;
  }
  const rc = R.race, course = coursePts(rc.course), L = pathLength(course);
  const runners = liveList().filter((s) => rc.ids.includes(s.id) || (!s.sim && s.phase === 'activity'));
  const rows = runners.map((s) => {
    const tr = (s.trail || []).map((p) => toXY(p[0], p[1])), pos = tr[tr.length - 1] || toXY(s.lat, s.lon);
    const pr = courseProgress(course, pos[0], pos[1], s.actDist / L);
    const avg = s.actDist > 50 ? s.actT / (s.actDist / 1000) : 0;
    return { s, tr, pos, covered: s.done ? L : Math.min(pr.covered, s.actDist + 60), avg };
  }).sort((a, b) => (b.s.done && a.s.done) ? a.s.actT - b.s.actT : b.covered - a.covered);
  const lead = rows[0];
  const colors = ['#d6336c', '#3461c9', '#0b7a57', '#b07c00', '#7b5cc4', '#1691b3', '#b5466b', '#9a6a22'];
  const lines = [{ xy: densify(course, 30), cls: 'm-plan-solid', w: 6, noHalo: true }];
  const extra = rows.map((r, i) => { const sw = (bboxOf([course], 250)[2] - bboxOf([course], 250)[0]) / 900; const [x, y] = r.pos; const ini = (r.s.name || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join(''); return `<g><circle cx="${x}" cy="${-y}" r="${11 * sw}" fill="${colors[i % colors.length]}" stroke="#fff" stroke-width="${2 * sw}"/><text x="${x}" y="${-y + 4 * sw}" font-size="${10 * sw}" text-anchor="middle" fill="#fff" font-weight="700">${esc(ini)}</text></g>`; }).join('');
  return `${pageHead(esc(rc.name), `${rows.length} atletas · ${fmtDistU(L, 1)}`, `<div class="ph-r"><button class="btn btn-ghost btn-sm danger" data-act="raceEnd">Parar de seguir</button></div>`)}
    <section class="card flush">${mapSVG({ lines, markers: [{ kind: 'start', xy: course[0] }, { kind: 'end', xy: course[course.length - 1] }], w: 900, h: 420, bbox: bboxOf([course], 250), extra, label: 'Mapa da prova com os atletas' })}</section>
    <div class="chips"><span class="muted sm">Velocidade da simulação:</span>${[1, 10, 30, 60].map((n) => `<button class="chip ${rc.speed === n ? 'on' : ''}" ${act('simSpeed', { n })}>${n}×</button>`).join('')}</div>
    <section class="card"><div class="tbl-wrap"><table class="tbl lb"><thead><tr><th>#</th><th>Atleta</th><th>Percorrido</th><th>Diferença</th><th>Ritmo atual</th><th>Ritmo médio</th><th>FC</th><th>Chegada prevista</th></tr></thead><tbody>
      ${rows.map((r, i) => { const gap = i && r.avg ? (lead.covered - r.covered) / 1000 * r.avg : 0; const left = L - r.covered; const k = R.race.speed; return `<tr><td><span class="dot" style="background:${colors[i % colors.length]}"></span>${i + 1}</td><td><button class="link ath-cell" ${act('raceFocus', { id: r.s.id })}>${esc(r.s.name || 'Atleta')}</button></td><td class="num">${r.s.done ? '<b class="ok">Chegou</b> ' + fmtDur(r.s.actT) : fmtDistU(r.covered, 2)}</td><td class="num">${i ? '+' + fmtDur(gap) : '–'}</td><td class="num">${r.s.pace && !r.s.done ? fmtPace(1000, r.s.pace) : '–'}</td><td class="num">${r.avg ? fmtPace(1000, r.avg) : '–'}</td><td class="num">${r.s.hr || '–'}</td><td class="num">${r.s.done ? '–' : r.avg ? DTF_TIME.format(Date.now() + left / 1000 * r.avg * 1000 / (r.s.sim ? k : 1)) : '–'}</td></tr>`; }).join('')}
    </tbody></table></div><p class="muted xs">A diferença é o tempo estimado que cada atleta demora a chegar ao ponto onde está o primeiro.</p></section>`;
}

/* Level 1 session page. */
function viewSession() {
  const sess = DB.sessions.find((s) => s.id === R.params.id);
  if (!sess) return pageHead('Sessão') + empty('Sessão não encontrada', '');
  const d = sessionData(sess);
  const xy = d.track.map((p) => toXY(p[0], p[1]));
  const lines = d.ranges.map((r) => ({ xy: xy.slice(r.i0, r.i1 + 1), cls: r.kind === 'activity' ? '' : 'm-transit', w: r.kind === 'activity' ? 3.6 : 3, noHalo: r.kind !== 'activity' }));
  const total = d.time || 1;
  const phaseLbl = { warmup: 'Aquecimento', wait: 'Espera', cooldown: 'Regresso', transit: 'Transição', activity: 'Atividade' };
  return `${pageHead(esc(sess.title || 'Sessão'), `Sessão · ${fmtWhen(sess.start)}`)}
    <section class="card"><div class="big-stats sm">${stat('Duração da sessão', fmtDur(d.time))}${stat('Distância total', fmtDist(d.dist), distUnit())}${stat('Atividades', d.ranges.filter((r) => r.kind === 'activity').length)}${stat('Partilhada', sess.shareId ? 'Sim' : 'Não')}</div>
      <div class="timeline" aria-label="Fases da sessão">${d.ranges.map((r) => { const dt = d.track[r.i1][3] - d.track[r.i0][3]; return `<span class="tl tl-${r.kind}" style="flex:${Math.max(dt / total, 0.02)}" title="${esc(r.label || '')}"></span>`; }).join('')}</div>
      <div class="legend"><span><i class="tl-activity"></i>Atividade</span><span><i class="tl-warmup"></i>Aquecimento, espera e regresso</span></div></section>
    ${xy.length > 1 ? `<section class="card flush">${mapSVG({ lines, markers: [{ kind: 'start', xy: xy[0] }, { kind: 'end', xy: xy[xy.length - 1] }], w: 900, h: 380, label: 'Mapa da sessão' })}</section>` : ''}
    <section class="card"><div class="card-h"><h3>Fases</h3></div>${d.ranges.map((r) => {
      const dt = d.track[r.i1][3] - d.track[r.i0][3], dd = d.cum[r.i1] - d.cum[r.i0], a = r.aid && activity(r.aid);
      return `<div class="phase-row"><span class="tl-dot tl-${r.kind}"></span><div class="grow"><b>${a ? esc(a.name) : esc(r.label || phaseLbl[r.kind])}</b><div class="muted sm">${phaseLbl[r.kind] || ''}${a && a.kind === 'prova' ? ' · Prova' : ''} · ${DTF_TIME.format(sess.start + d.track[r.i0][3] * 1000)}</div></div><div class="right num">${fmtDistU(dd, 2)}<div class="muted xs">${fmtDur(dt)}</div></div>${a ? `<button class="btn btn-secondary btn-sm" ${go('activity', { id: a.id })}>Abrir</button>` : ''}</div>`;
    }).join('')}</section>`;
}

/* Shoe detail (feature 4). */
function viewGearDetail() {
  const g = DB.gear.find((x) => x.id === R.params.id);
  if (!g) return pageHead('Equipamento') + empty('Equipamento não encontrado', '');
  const acts = DB.activities.filter((a) => a.gearId === g.id).sort((a, b) => b.start - a.start);
  const km = gearKm(g) / 1000, life = g.alertKm ? clamp(km / g.alertKm, 0, 1) : 0;
  const run = acts.reduce((s, a) => { const x = analyze(a); s.d += x.dist; s.t += x.moving; s.g += x.gain; return s; }, { d: 0, t: 0, g: 0 });
  const months = [], labels = []; const m0 = startOfMonth(Date.now());
  for (let i = 5; i >= 0; i--) { const d = new Date(m0); d.setMonth(d.getMonth() - i); const f = d.getTime(), t = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(); months.push(distVal(acts.filter((a) => a.start >= f && a.start < t).reduce((s, a) => s + analyze(a).dist, 0))); labels.push(new Intl.DateTimeFormat('pt-PT', { month: 'short' }).format(f)); }
  const field = (l, v) => v || v === 0 ? `<div><dt>${l}</dt><dd>${v}</dd></div>` : '';
  return `${pageHead(esc(g.name), esc(g.brand || ''))}
    <section class="card gear-hero">${g.photo ? `<img src="${g.photo}" alt="" class="gear-photo">` : `<span class="gear-ic lg">${icon(g.kind === 'bike' ? 'bike' : 'shoe', 40)}</span>`}
      <div class="grow"><div class="big-stats sm">${stat('Distância', fmtDist(km * 1000, 0), distUnit())}${stat('Atividades', acts.length)}${stat('Ritmo médio', run.d ? fmtPace(run.d, run.t) : '–', '/' + distUnit())}${g.price && km ? stat('Custo por km', NF2.format(g.price / km), '€') : ''}</div>
      ${g.alertKm ? `<div class="sm">Vida útil: ${NF0.format(life * 100)}% de ${fmtDistU(g.alertKm * 1000, 0)}</div><div class="bar lg ${life > 0.9 ? 'warn' : ''}"><i style="width:${(life * 100).toFixed(0)}%"></i></div>` : ''}</div></section>
    <section class="card"><dl class="kv">${field('Tipo', esc(g.type || ''))}${field('Drop', g.drop != null && g.drop !== '' ? g.drop + ' mm' : '')}${field('Peso', g.weight ? g.weight + ' g' : '')}${field('Comprado em', g.purchased ? DTF_DAY.format(new Date(g.purchased)) : '')}${field('Preço', g.price ? NF2.format(g.price) + ' €' : '')}${field('Último uso', acts[0] ? DTF_SHORT.format(acts[0].start) : '')}${field('Desnível acumulado', fmtElevU(run.g))}${field('Usar por omissão em', g.defaultFor ? SPORTS[g.defaultFor].label : '')}</dl>${g.notes ? `<p class="sm">${esc(g.notes)}</p>` : ''}</section>
    <section class="card"><div class="card-h"><h3>Distância por mês</h3><span class="muted sm">${distUnit()}</span></div>${barChart(months, labels, { h: 140, hi: 5, fmt: (v) => NF0.format(v) })}</section>
    <form class="card form" data-form="gearEdit" data-id="${g.id}"><h3 class="h-sm">Editar</h3><div class="form-grid">
      <label class="fld"><span>Nome</span><input id="ge-name" name="name" value="${esc(g.name)}" required maxlength="60"></label>
      <label class="fld"><span>Marca e modelo</span><input id="ge-brand" name="brand" value="${esc(g.brand || '')}" maxlength="60"></label>
      <label class="fld"><span>Tipo</span><select id="ge-type" name="type">${['Estrada', 'Trail', 'Competição', 'Pista', 'Caminhada', 'Bicicleta'].map((t) => `<option ${g.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="fld"><span>Drop (mm)</span><input id="ge-drop" name="drop" type="number" min="0" max="16" value="${g.drop ?? ''}"></label>
      <label class="fld"><span>Peso (g)</span><input id="ge-weight" name="weight" type="number" min="0" value="${g.weight || ''}"></label>
      <label class="fld"><span>Comprado em</span><input id="ge-date" name="purchased" type="date" value="${g.purchased || ''}"></label>
      <label class="fld"><span>Preço (€)</span><input id="ge-price" name="price" type="number" min="0" step="0.01" value="${g.price || ''}"></label>
      <label class="fld"><span>Avisar aos (${distUnit()})</span><input id="ge-alert" name="alert" type="number" min="0" value="${g.alertKm ? Math.round(distVal(g.alertKm * 1000)) : ''}"></label>
    </div><label class="fld"><span>Notas</span><input id="ge-notes" name="notes" maxlength="200" value="${esc(g.notes || '')}"></label>
    <div class="fld"><span class="fld-l">Foto</span><label class="ph-add">${icon('camera')}<span>${g.photo ? 'Trocar' : 'Adicionar'}</span><input type="file" id="ge-photo" accept="image/*" data-change="gearPhoto" data-id="${g.id}"></label></div>
    <div class="form-actions"><button class="btn btn-primary">Guardar</button></div></form>
    <h3 class="sec-h">Atividades com ${esc(g.name)}</h3>${acts.slice(0, 10).map((a) => `<button class="card row-btn" ${go('activity', { id: a.id })}>${icon(SPORTS[a.sport].icon, 18)}<span class="grow left">${esc(a.name)} <span class="muted sm">· ${DTF_SHORT.format(a.start)}</span></span><span class="num">${fmtDistU(analyze(a).dist, 1)}</span></button>`).join('') || '<p class="muted">Ainda sem atividades.</p>'}`;
}

/* Steps (feature 4): Samsung Health / Health Connect, CSV import, or estimates. */
function dayKey(t) { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function stepsSeries(days) {
  const out = [], today = startOfDay(Date.now());
  for (let i = days - 1; i >= 0; i--) {
    const t = today - i * 864e5, k = dayKey(t);
    const fromActs = DB.activities.filter((a) => a.uid === me() && startOfDay(a.start) === t).reduce((s, a) => s + ((activitySteps(a) || {}).steps || 0), 0);
    out.push({ t, k, steps: DB.steps[k] != null ? DB.steps[k] : 0, fromActs, synced: DB.steps[k] != null });
  }
  return out;
}
function trainingSteps() {
  const c = DB.settings.conn;
  const ser = stepsSeries(30), synced = ser.some((d) => d.synced);
  const vals = ser.map((d) => d.synced ? d.steps : d.fromActs);
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length, goal = DB.settings.stepGoal || 10000;
  const today = vals[vals.length - 1];
  return `<section class="card"><div class="card-h"><h3>Passos</h3><span class="muted sm">${c.samsung ? 'Samsung Health ligado' : synced ? 'Importados de ficheiro' : 'Estimados só a partir das tuas atividades'}</span></div>
      <div class="goal-row">${ring(clamp(today / goal, 0, 1), 64, 7)}<div><b class="big num">${NF0.format(today)}</b> <span class="muted">hoje · objetivo ${NF0.format(goal)}</span><div class="muted sm">Média de 30 dias: ${NF0.format(avg)} por dia</div></div></div>
      ${barChart(vals.slice(-14), ser.slice(-14).map((d) => new Date(d.t).getDate() + ''), { h: 150, hi: 13, fmt: (v) => NF0.format(v) })}</section>
    ${c.samsung ? '' : `<section class="card"><div class="card-h"><h3>Ligar o Samsung Health</h3></div><p class="sm">Para veres todos os passos do dia, não só os das atividades.</p><div class="row-gap"><button class="btn btn-primary btn-sm" ${go('settings')}>Ir para ligações</button></div></section>`}
    <section class="card"><div class="card-h"><h3>Passos por atividade</h3></div>${DB.activities.filter((a) => a.uid === me() && activitySteps(a)).slice(0, 8).map((a) => { const st = activitySteps(a); return `<button class="row-btn" ${go('activity', { id: a.id })}>${icon(SPORTS[a.sport].icon, 18)}<span class="grow left">${esc(a.name)} <span class="muted sm">· ${DTF_SHORT.format(a.start)}</span></span><span class="num">${NF0.format(st.steps)} passos · ${st.cadence} ppm</span></button>`; }).join('')}</section>`;
}
function settingsConnections() {
  const c = DB.settings.conn;
  const row = (id, name, desc, on) => `<div class="conn"><span class="conn-ic">${icon(id === 'samsung' ? 'heart' : id === 'spotify' ? 'play' : 'beacon', 20)}</span><div class="grow"><b>${name}</b><div class="muted sm">${desc}</div></div><label class="switch"><input type="checkbox" id="conn-${id}" ${on ? 'checked' : ''} data-change="conn" data-id="${id}"><span></span><span class="sr">${name}</span></label></div>`;
  return `<section class="card form"><h3 class="h-sm">Ligações</h3>
    ${row('samsung', 'Samsung Health', c.samsung ? 'Ligado (dados de demonstração). Passos diários dos últimos 60 dias.' : 'Passos diários e frequência cardíaca do Galaxy Watch.', c.samsung)}
    ${row('spotify', 'Música a tocar', c.spotify ? 'Ligado (demonstração). A música aparece na partilha ao vivo.' : 'Mostra a quem te segue ao vivo a música que estás a ouvir.', c.spotify)}
    <div class="conn"><span class="conn-ic">${icon('heart', 20)}</span><div class="grow"><b>Sensor de frequência cardíaca</b><div class="muted sm">${REC.hrDevice ? 'Ligado: ' + esc(REC.hrDevice) : 'Cintas e relógios com Bluetooth (no Chrome do Android ou do computador).'}</div></div><button class="btn btn-secondary btn-sm" data-act="hrConnect">${REC.hrDevice ? 'Religar' : 'Ligar'}</button></div>
    <label class="fld"><span>Importar passos de um ficheiro CSV (data, passos)</span><input type="file" id="steps-csv" accept=".csv,text/csv" data-change="stepsCsv"></label>
    <p class="muted xs">O Samsung Health não tem acesso pela web. Na app Android lemos os passos através do Health Connect, para onde o Samsung Health sincroniza. Nesta demonstração a ligação gera dados de exemplo.</p></section>
    <section class="card form"><h3 class="h-sm">Exportar</h3><p class="muted sm">Todas as tuas atividades num CSV, com os dados da prova, equipamento, passos e sessão.</p><div class="rb-btns"><button class="btn btn-secondary btn-sm" data-act="exportAll">${icon('upload', 16)}Exportar atividades (CSV)</button></div></section>`;
}

/* Activity page additions (feature 3). */
function activityRaceCard(a) {
  const rc = a.race; if (!rc) return '';
  const an = analyze(a);
  return `<section class="card race-card"><div class="card-h"><h3>${icon('medal', 18)} ${esc(rc.name || a.name)}</h3>${rc.url ? `<a class="link sm" href="${esc(rc.url)}" target="_blank" rel="noopener">Resultados oficiais</a>` : ''}</div>
    <div class="big-stats sm">${rc.official ? stat('Tempo oficial', fmtDur(rc.official)) : ''}${rc.pos ? stat('Classificação', rc.pos + 'º', rc.total ? 'de ' + NF0.format(rc.total) : '') : ''}${rc.posCat ? stat('Escalão ' + esc(rc.cat || ''), rc.posCat + 'º') : ''}${rc.bib ? stat('Dorsal', esc(rc.bib)) : ''}</div>
    ${rc.official && an.moving ? `<p class="muted sm">Tempo no relógio: ${fmtDur(an.moving)}${Math.abs(rc.official - an.moving) > 2 ? ` (${rc.official > an.moving ? '+' : '−'}${fmtDur(Math.abs(rc.official - an.moving))} face ao oficial)` : ''}.</p>` : ''}
    ${(rc.photos || []).length ? `<div class="photos">${rc.photos.map((p) => `<img src="${p}" alt="Foto oficial da prova">`).join('')}</div>` : ''}
    ${(rc.certs || []).length ? `<div class="certs">${rc.certs.map((c, i) => c.type.startsWith('image/') ? `<figure class="cert"><img src="${c.data}" alt="${esc(c.name)}"><figcaption class="xs">${esc(c.name)}</figcaption></figure>` : `<button class="cert-file" ${act('certSave', { id: a.id, i })}>${icon('upload', 18)}<span>${esc(c.name)}</span></button>`).join('')}</div>` : ''}
    ${a.uid === me() && !(rc.photos || []).length && !(rc.certs || []).length ? `<p class="muted sm">Adiciona as fotos oficiais e o diploma em <button class="link" ${go('edit', { id: a.id })}>Editar</button>.</p>` : ''}</section>`;
}
function raceFields(a) {
  const rc = a.race || {};
  return `<fieldset class="fld race-fields"><legend>Prova oficial</legend>
    <label class="chk"><input type="checkbox" id="f-israce" name="isRace" ${a.kind === 'prova' || a.race ? 'checked' : ''}> Esta atividade foi uma prova</label>
    <div class="form-grid">
      <label class="fld"><span>Nome da prova</span><input id="f-rname" name="r_name" maxlength="80" value="${esc(rc.name || '')}"></label>
      <label class="fld"><span>Dorsal</span><input id="f-bib" name="r_bib" maxlength="12" value="${esc(rc.bib || '')}"></label>
      <label class="fld"><span>Tempo oficial (h:mm:ss)</span><input id="f-off" name="r_official" pattern="\\d{1,2}(:\\d{2}){1,2}" value="${rc.official ? fmtDur(rc.official) : ''}"></label>
      <label class="fld"><span>Posição geral</span><input id="f-pos" name="r_pos" type="number" min="1" value="${rc.pos || ''}"></label>
      <label class="fld"><span>Participantes</span><input id="f-tot" name="r_total" type="number" min="1" value="${rc.total || ''}"></label>
      <label class="fld"><span>Escalão</span><input id="f-cat" name="r_cat" maxlength="12" value="${esc(rc.cat || '')}"></label>
      <label class="fld"><span>Posição no escalão</span><input id="f-pcat" name="r_posCat" type="number" min="1" value="${rc.posCat || ''}"></label>
      <label class="fld"><span>Link dos resultados</span><input id="f-url" name="r_url" type="url" value="${esc(rc.url || '')}" placeholder="https://"></label>
    </div>
    <div class="fld"><span class="fld-l">Fotos oficiais</span><div class="photo-row" id="race-photo-row">${(R.draftRace.photos || []).map((p, i) => `<span class="ph"><img src="${p}" alt=""><button type="button" class="icon-btn sm" ${act('rmRacePhoto', { i })} aria-label="Remover foto">${icon('close', 14)}</button></span>`).join('')}<label class="ph-add">${icon('camera')}<span>Adicionar</span><input type="file" id="f-rphoto" accept="image/*" multiple data-change="racePhoto"></label></div></div>
    <div class="fld"><span class="fld-l">Certificados e diplomas (imagem ou PDF, até 1,5 MB)</span><div class="cert-row" id="race-cert-row">${(R.draftRace.certs || []).map((c, i) => `<span class="cert-chip">${icon('medal', 14)}${esc(c.name)}<button type="button" class="icon-btn sm" ${act('rmCert', { i })} aria-label="Remover">${icon('close', 12)}</button></span>`).join('')}<label class="btn btn-secondary btn-sm file-btn">${icon('plus', 14)}Adicionar ficheiro<input type="file" id="f-cert" accept="image/*,application/pdf" multiple data-change="raceCert"></label></div></div>
  </fieldset>`;
}
