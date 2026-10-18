/* cloud.js: the Supabase backend (schema "passo"). Optional: when the client
   library or the network is missing (the Claude preview, offline) the app
   keeps working on this device only. */
'use strict';

const CLOUD = {
  url: 'https://zwiemchpxxldfsubfybm.supabase.co',
  key: 'sb_publishable_FhLUxglWVZMoQL-9sav8mg_SEzx51-f',   // publishable: safe in the browser, RLS does the rest
  sb: null, user: null, ok: false, signupOpen: false,
  pushed: 0, pushedShare: '', remote: new Map(),         // share id -> {snap, trail, name, ended}
};

function cloudDb() { return CLOUD.sb.schema('passo'); }
async function cloudInit() {
  if (!window.supabase || !window.supabase.createClient) return;
  try {
    CLOUD.sb = window.supabase.createClient(CLOUD.url, CLOUD.key, { auth: { persistSession: true, autoRefreshToken: true } });
    const { data } = await CLOUD.sb.auth.getSession();
    CLOUD.user = data.session ? data.session.user : null;
    CLOUD.ok = true;
    CLOUD.sb.auth.onAuthStateChange((_e, s) => { CLOUD.user = s ? s.user : null; if (CLOUD.user) ensureAthlete(); render(); });
    if (CLOUD.user) ensureAthlete();
    const share = new URLSearchParams(location.search).get('s');
    if (share && /^[a-z0-9]{6,24}$/.test(share)) { followShare(share); R.liveSel = 'cloud-' + share; navigate('live', {}, false); }
  } catch (e) { CLOUD.ok = false; }
}
async function ensureAthlete() {
  const u = user(me());
  const { error } = await cloudDb().from('athletes').upsert({ id: CLOUD.user.id, name: u.name || CLOUD.user.email.split('@')[0], sex: u.sex || null, city: u.city || null }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) console.warn('athlete', error.message);
}
async function cloudSignIn(email, password, create) {
  if (!CLOUD.ok) { toast('Sem ligação ao servidor.'); return; }
  if (create && !CLOUD.signupOpen) { toast('Os registos ainda estão fechados.'); return; }
  const fn = create ? CLOUD.sb.auth.signUp({ email, password, options: { data: { app: 'passo' } } }) : CLOUD.sb.auth.signInWithPassword({ email, password });
  const { error, data } = await fn;
  if (error) { toast(error.message); return; }
  toast(create && !data.session ? 'Conta criada. Confirma o email para entrar.' : 'Sessão iniciada.');
}
async function cloudSignOut() { if (CLOUD.ok) await CLOUD.sb.auth.signOut(); toast('Saíste da conta.'); }
function newShareId() { const a = new Uint8Array(10); crypto.getRandomValues(a); return [...a].map((b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join(''); }

/* ---------- live: runner side ---------- */
let _cloudPushAt = 0;
async function cloudPushLive(force) {
  if (!CLOUD.ok || !CLOUD.user || REC.state === 'idle' || !DB.settings.live.share) return;
  if (!force && Date.now() - _cloudPushAt < 3000) return;
  _cloudPushAt = Date.now();
  if (CLOUD.pushedShare !== REC.shareId) { CLOUD.pushedShare = REC.shareId; CLOUD.pushed = 0; }
  const snap = liveSnapOwn(true); if (!snap) return;
  delete snap.trail;
  const pts = REC.track.slice(CLOUD.pushed, CLOUD.pushed + 400).map((p) => [+p[0].toFixed(5), +p[1].toFixed(5), p[3], p[4] || 0]);
  const { error } = await cloudDb().rpc('push_live', { p_share: REC.shareId, p_session: null, p_snap: snap, p_points: pts });
  if (!error) CLOUD.pushed += pts.length;
}
async function cloudEndLive() { if (CLOUD.ok && CLOUD.user && CLOUD.pushedShare) await cloudDb().rpc('end_live', { p_share: CLOUD.pushedShare }); }

/* ---------- live: viewer side (no account needed) ---------- */
const _follow = new Map();
function followShare(share) {
  if (!CLOUD.ok || _follow.has(share)) return;
  const st = { since: -1, timer: 0 };
  _follow.set(share, st);
  const poll = async () => {
    const { data, error } = await cloudDb().rpc('get_live', { p_share: share, p_since: st.since });
    if (!error && data) {
      const cur = CLOUD.remote.get(share) || { trail: [] };
      (data.trail || []).forEach((p) => cur.trail.push(p));
      if (cur.trail.length) st.since = cur.trail[cur.trail.length - 1][2];
      Object.assign(cur, { snap: data.snap || {}, name: data.name, ended: data.ended });
      CLOUD.remote.set(share, cur);
      liveRerender();
    } else if (!error && !data) { CLOUD.remote.delete(share); }
    st.timer = setTimeout(poll, CLOUD.remote.get(share)?.ended ? 30000 : 3000);
  };
  poll();
  ensureLiveTimer();
}
function shareFromText(t) { const m = String(t).match(/[?&]s=([a-z0-9]{6,24})/) || String(t).match(/^([a-z0-9]{6,24})$/); return m ? m[1] : null; }
function cloudLiveList() {
  const out = [];
  CLOUD.remote.forEach((e, share) => out.push({ ...e.snap, id: 'cloud-' + share, uid: null, name: e.name || e.snap.name, trail: e.trail, remote: true, done: e.ended }));
  return out;
}

/* ---------- copy to the cloud after saving ---------- */
async function cloudSaveActivity(a) {
  if (!CLOUD.ok || !CLOUD.user) return;
  const an = analyze(a), st = activitySteps(a);
  a.remoteId = a.remoteId || crypto.randomUUID();
  const row = { id: a.remoteId, athlete_id: CLOUD.user.id, session_id: a.sessionRemoteId || null, sport: a.sport, kind: a.kind === 'prova' ? 'prova' : 'treino', name: a.name, description: a.desc || null,
    start_at: new Date(a.start).toISOString(), distance_m: Math.round(an.dist), moving_time_s: Math.round(an.moving), elapsed_time_s: Math.max(Math.round(an.elapsed), Math.round(an.moving)), elevation_gain_m: Math.round(an.gain),
    avg_hr: an.avgHr || null, max_hr: an.maxHr || null, calories: an.calories, relative_effort: an.effort, steps: st ? st.steps : null, perceived_exertion: a.rpe || null,
    visibility: a.visibility, hide_stats: a.hideStats || {}, track: a.track || null, laps: a.laps || [], race: a.race ? { ...a.race, photos: undefined, certs: undefined } : null };
  const { error } = await cloudDb().from('activities').upsert(row);
  if (error) console.warn('activity', error.message); else save();
}
async function cloudSaveSession(sess) {
  if (!CLOUD.ok || !CLOUD.user) return;
  sess.remoteId = sess.remoteId || crypto.randomUUID();
  const { error } = await cloudDb().from('sessions').upsert({ id: sess.remoteId, athlete_id: CLOUD.user.id, title: sess.title, start_at: new Date(sess.start).toISOString(), end_at: new Date().toISOString(),
    share_id: sess.shareId && /^[a-z0-9]{6,24}$/.test(sess.shareId) ? sess.shareId : null, track: sess.track, ranges: sess.ranges });
  if (error) { console.warn('session', error.message); return; }
  for (const r of sess.ranges.filter((x) => x.aid)) { const a = activity(r.aid); if (a) { a.sessionRemoteId = sess.remoteId; await cloudSaveActivity(a); } }
  save();
}

function settingsCloud() {
  if (!CLOUD.ok) return `<section class="card form"><h3 class="h-sm">Conta na nuvem</h3><p class="muted sm">Sem ligação ao servidor neste ambiente. Os teus dados ficam só neste navegador. A partilha por link e a cópia para a nuvem funcionam na app publicada no teu domínio.</p></section>`;
  if (CLOUD.user) return `<section class="card form"><h3 class="h-sm">Conta na nuvem</h3><p class="sm">Entraste como <b>${esc(CLOUD.user.email)}</b>. As novas atividades e sessões são copiadas para a nuvem, e a partilha ao vivo funciona para qualquer pessoa com o link.</p><div class="rb-btns"><button class="btn btn-secondary btn-sm" data-act="cloudOut">Sair</button></div></section>`;
  return `<form class="card form" data-form="cloudIn"><h3 class="h-sm">Conta na nuvem</h3><p class="muted sm">Entra para guardares as atividades na nuvem e partilhares a sessão por link com quem quiseres.</p>
    <div class="form-grid"><label class="fld"><span>Email</span><input id="cl-email" name="email" type="email" required autocomplete="email"></label><label class="fld"><span>Palavra-passe</span><input id="cl-pass" name="password" type="password" required minlength="8" autocomplete="current-password"></label></div>
    <div class="form-actions"><button class="btn btn-ghost btn-sm" type="submit" name="mode" value="create" ${CLOUD.signupOpen ? '' : 'disabled title="Registos fechados por agora"'}>Criar conta</button><button class="btn btn-primary btn-sm" type="submit" name="mode" value="in">Entrar</button></div></form>`;
}
