/* store.js: the data layer. Same operations the real API will have
   (see replica/architecture.md); today it keeps everything in this browser. */
'use strict';

const LS_KEY = 'passo.db.v3';
let DB = null;

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) { const d = JSON.parse(raw); if (d && d.version === 3) DB = d; }
  } catch (e) { /* storage blocked: run from seed */ }
  if (!DB) DB = buildSeed();
  S.units = DB.settings.units;
}
let _saveT = 0;
function save() {
  clearTimeout(_saveT);
  _saveT = setTimeout(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(DB)); }
    catch (e) { toast('Não foi possível guardar neste navegador (armazenamento cheio ou bloqueado).'); }
  }, 150);
}
function resetDemo() { try { localStorage.removeItem(LS_KEY); } catch (e) { } DB = buildSeed(); _anCache.clear(); _effCache.clear(); _trackCache.clear(); _xyCache.clear(); S.units = DB.settings.units; }

/* ---------- reads ---------- */
const me = () => DB.me;
const user = (id) => DB.users.find((u) => u.id === id) || { id, name: 'Atleta', sex: 'x', city: '' };
const activity = (id) => DB.activities.find((a) => a.id === id);
const isFollowing = (a, b) => DB.follows.some((f) => f[0] === a && f[1] === b);
const followingOf = (id) => DB.follows.filter((f) => f[0] === id).map((f) => f[1]);
const followersOf = (id) => DB.follows.filter((f) => f[1] === id).map((f) => f[0]);
function canView(a, viewer = me()) {
  if (a.uid === viewer) return true;
  if (a.visibility === 'only_me') return false;
  if (a.visibility === 'followers') return isFollowing(viewer, a.uid);
  return true;
}
function feed() {
  const ids = new Set([me(), ...followingOf(me())]);
  return DB.activities.filter((a) => ids.has(a.uid) && canView(a)).sort((a, b) => b.start - a.start);
}
const activitiesOf = (uid) => DB.activities.filter((a) => a.uid === uid && canView(a)).sort((a, b) => b.start - a.start);
const kudosOf = (aid) => DB.kudos.filter((k) => k[0] === aid).map((k) => k[1]);
const hasKudos = (aid, u = me()) => DB.kudos.some((k) => k[0] === aid && k[1] === u);
const commentsOf = (aid) => DB.comments.filter((c) => c.aid === aid).sort((a, b) => a.at - b.at);
const gearOf = (uid) => DB.gear.filter((g) => g.uid === uid);
function gearKm(g) { return g.baseKm * 1000 + DB.activities.filter((a) => a.gearId === g.id).reduce((s, a) => s + analyze(a).dist, 0); }
const unreadCount = () => DB.notifications.filter((n) => !n.read).length;
const pro = () => !!DB.settings.pro;

function totals(acts, from, to = Infinity) {
  const r = { count: 0, dist: 0, time: 0, gain: 0, effort: 0 };
  acts.forEach((a) => { if (a.start >= from && a.start < to) { const x = analyze(a); r.count++; r.dist += x.dist; r.time += x.moving; r.gain += x.gain; r.effort += x.effort; } });
  return r;
}
function sportActs(uid, fam) { return DB.activities.filter((a) => a.uid === uid && (!fam || sportFamily(a.sport) === fam)); }

/* Segment leaderboard: best effort per athlete. */
function allEfforts(segId) {
  const sg = DB.segments.find((s) => s.id === segId);
  const out = [];
  DB.activities.forEach((a) => { if (canView(a) && segSportOk(sg, a.sport)) effortsFor(a, DB.segments).forEach((e) => { if (e.seg === segId) out.push(e); }); });
  return out;
}
function leaderboard(segId, filter = 'all') {
  let eff = allEfforts(segId);
  const yr = startOfYear(Date.now());
  if (filter === 'f' || filter === 'm') eff = eff.filter((e) => user(e.uid).sex === filter);
  if (filter === 'year') eff = eff.filter((e) => e.at >= yr);
  if (filter === 'following') { const fo = new Set([me(), ...followingOf(me())]); eff = eff.filter((e) => fo.has(e.uid)); }
  if (filter.startsWith('club:')) { const c = DB.clubs.find((x) => x.id === filter.slice(5)); eff = eff.filter((e) => c.members.includes(e.uid)); }
  const best = new Map();
  eff.forEach((e) => { const b = best.get(e.uid); if (!b || e.time < b.time) best.set(e.uid, e); });
  return [...best.values()].sort((a, b) => a.time - b.time);
}
function crowns(segId) {
  const all = leaderboard(segId), m = leaderboard(segId, 'm')[0], f = leaderboard(segId, 'f')[0];
  const since = Date.now() - 90 * 864e5, cnt = new Map();
  allEfforts(segId).forEach((e) => { if (e.at >= since) cnt.set(e.uid, (cnt.get(e.uid) || 0) + 1); });
  let legend = null; cnt.forEach((n, u) => { if (!legend || n > legend.n) legend = { uid: u, n }; });
  return { cr: all[0], kom: m, qom: f, legend, total: allEfforts(segId).length, athletes: all.length };
}
function myEfforts(segId) { return allEfforts(segId).filter((e) => e.uid === me()).sort((a, b) => a.time - b.time); }
/* For an effort: PR rank among my efforts up to that day, and overall rank. */
function effortBadges(e) {
  const mine = allEfforts(e.seg).filter((x) => x.uid === e.uid && x.at <= e.at).sort((a, b) => a.time - b.time);
  const pr = mine.findIndex((x) => x.aid === e.aid && x.i === e.i) + 1;
  const lb = leaderboard(e.seg), myBest = lb.find((x) => x.uid === e.uid);
  const overall = myBest && myBest.aid === e.aid && myBest.i === e.i ? lb.indexOf(myBest) + 1 : 0;
  return { pr: pr <= 3 ? pr : 0, overall: overall && overall <= 10 ? overall : 0, isPR: pr === 1 && mine.length > 1 };
}

function challengeProgress(ch, uid = me()) {
  const acts = DB.activities.filter((a) => a.uid === uid && a.start >= ch.from && a.start < ch.to && (!ch.sport || sportFamily(a.sport) === ch.sport));
  let v = 0;
  if (ch.metric === 'distance') v = acts.reduce((s, a) => s + analyze(a).dist, 0);
  else if (ch.metric === 'elevation') v = acts.reduce((s, a) => s + analyze(a).gain, 0);
  else if (ch.metric === 'time') v = acts.reduce((s, a) => s + analyze(a).moving, 0);
  else if (ch.metric === 'single_distance') v = Math.max(0, ...acts.map((a) => analyze(a).dist));
  return { value: v, pct: clamp(v / ch.target, 0, 1), done: v >= ch.target };
}
const joined = (chId, uid = me()) => DB.joins.some((j) => j[0] === chId && j[1] === uid);

function goalProgress(g) {
  const now = Date.now(), from = g.period === 'week' ? startOfWeek(now) : g.period === 'month' ? startOfMonth(now) : startOfYear(now);
  const t = totals(sportActs(me(), g.sport === 'all' ? null : g.sport), from);
  const v = g.metric === 'distance' ? t.dist : g.metric === 'time' ? t.time : t.gain;
  return { value: v, pct: clamp(v / g.target, 0, 1) };
}

function similarActivities(a) {
  const x = analyze(a); if (!x.hasMap) return [];
  const t = trackOf(a), s0 = t[0], e0 = t[t.length - 1];
  return DB.activities.filter((b) => b.id !== a.id && b.uid === a.uid && b.sport === a.sport && trackOf(b)).filter((b) => {
    const y = analyze(b), tb = trackOf(b);
    return Math.abs(y.dist - x.dist) / x.dist < 0.06 && haversine(s0[0], s0[1], tb[0][0], tb[0][1]) < 150 && haversine(e0[0], e0[1], tb[tb.length - 1][0], tb[tb.length - 1][1]) < 150;
  }).sort((p, q) => p.start - q.start);
}

/* ---------- writes ---------- */
function notify(kind, actor, ref) { DB.notifications.unshift({ id: uid('n'), kind, actor, ref, at: Date.now(), read: false }); }
function toggleKudos(aid) {
  const i = DB.kudos.findIndex((k) => k[0] === aid && k[1] === me());
  if (i >= 0) DB.kudos.splice(i, 1); else DB.kudos.push([aid, me(), Date.now()]);
  save();
}
function addComment(aid, text) {
  text = text.trim(); if (!text) return;
  DB.comments.push({ id: uid('c'), aid, uid: me(), text: text.slice(0, 2000), at: Date.now() });
  save();
}
function deleteComment(cid) { DB.comments = DB.comments.filter((c) => !(c.id === cid && c.uid === me())); save(); }
function toggleFollow(u) {
  const i = DB.follows.findIndex((f) => f[0] === me() && f[1] === u);
  if (i >= 0) DB.follows.splice(i, 1); else DB.follows.push([me(), u]);
  save();
}
function createActivity(a) {
  a.id = uid('a'); a.uid = me(); a.created = Date.now(); a.v = 1;
  DB.activities.unshift(a);
  checkChallenges();
  save();
  // friends react a little later, so notifications behave like the real thing
  const fans = followersOf(me()).slice(0, 4);
  fans.forEach((f, i) => setTimeout(() => {
    if (!activity(a.id) || a.visibility === 'only_me') return;
    DB.kudos.push([a.id, f, Date.now()]); notify('kudos', f, a.id); save(); refreshChrome();
  }, 4000 + i * 3500));
  return a;
}
function updateActivity(id, patch) { const a = activity(id); Object.assign(a, patch); a.v = (a.v || 0) + 1; invalidate(id); save(); }
function deleteActivity(id) {
  DB.activities = DB.activities.filter((a) => a.id !== id);
  DB.kudos = DB.kudos.filter((k) => k[0] !== id);
  DB.comments = DB.comments.filter((c) => c.aid !== id);
  invalidate(id); save();
}
function checkChallenges() {
  DB.challenges.forEach((ch) => {
    if (joined(ch.id) && challengeProgress(ch).done) {
      const j = DB.joins.find((x) => x[0] === ch.id && x[1] === me());
      if (!j[2]) { j[2] = Date.now(); notify('challenge', me(), ch.id); }
    }
  });
}
function toggleJoin(chId) {
  const i = DB.joins.findIndex((j) => j[0] === chId && j[1] === me());
  if (i >= 0) DB.joins.splice(i, 1); else DB.joins.push([chId, me()]);
  checkChallenges(); save();
}
function toggleClub(cid) {
  const c = DB.clubs.find((x) => x.id === cid);
  const i = c.members.indexOf(me()); if (i >= 0) c.members.splice(i, 1); else c.members.push(me());
  save();
}
function toggleRsvp(eid) {
  const e = DB.events.find((x) => x.id === eid);
  const i = e.rsvp.indexOf(me()); if (i >= 0) e.rsvp.splice(i, 1); else e.rsvp.push(me());
  save();
}
function addPost(club, text) { text = text.trim(); if (!text) return; DB.posts.unshift({ id: uid('p'), club, uid: me(), text, at: Date.now() }); save(); }
function toggleStar(sid) { const i = DB.starred.indexOf(sid); if (i >= 0) DB.starred.splice(i, 1); else DB.starred.push(sid); save(); }
function createSegment(name, a, i, j) {
  const xy = xyOf(a).slice(i, j + 1);
  const step = Math.max(1, Math.floor(xy.length / 40));
  const pts = xy.filter((_, k) => k % step === 0); pts.push(xy[xy.length - 1]);
  const sg = { id: uid('sg'), name, sport: a.sport === 'ride' ? 'ride' : 'run', pts: pts.map((p) => [Math.round(p[0]), Math.round(p[1])]), creator: me() };
  DB.segments.push(sg); DB.starred.push(sg.id); _effCache.clear(); save();
  return sg;
}
function saveRoute(r) { if (r.id) { Object.assign(DB.routes.find((x) => x.id === r.id), r); } else { r.id = uid('rt'); r.uid = me(); r.created = Date.now(); DB.routes.unshift(r); } save(); return r; }
function deleteRoute(id) { DB.routes = DB.routes.filter((r) => r.id !== id); save(); }
function saveGear(g) { if (g.id) Object.assign(DB.gear.find((x) => x.id === g.id), g); else { g.id = uid('g'); g.uid = me(); g.baseKm = g.baseKm || 0; DB.gear.push(g); } save(); }
function saveGoal(g) { g.id = uid('go'); DB.goals.push(g); save(); }
function deleteGoal(id) { DB.goals = DB.goals.filter((g) => g.id !== id); save(); }
function setSetting(k, v) { DB.settings[k] = v; if (k === 'units') { S.units = v; } save(); }
function markNotificationsRead() { DB.notifications.forEach((n) => (n.read = true)); save(); }
function updateMe(patch) { Object.assign(user(me()), patch); save(); }
