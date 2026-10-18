/* views.js: every screen, as HTML strings. IDs match replica/recon.md. */
'use strict';

const AV_COLORS = ['#2f7d63', '#3d63c9', '#a4508b', '#b26b1f', '#2b8a9e', '#6b5bb8', '#9a4a3a', '#4f7a2a', '#7d5a2f', '#3a6e8f', '#8a3d63'];
function avatar(u, size = 40) {
  u = typeof u === 'string' ? user(u) : u;
  const ini = u.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const col = AV_COLORS[hashStr(u.id) % AV_COLORS.length];
  if (u.photo) return `<img class="av" src="${u.photo}" width="${size}" height="${size}" alt="" style="width:${size}px;height:${size}px">`;
  return `<span class="av" style="--av:${col};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px" aria-hidden="true">${esc(ini)}</span>`;
}
const go = (view, params = {}) => `data-go="${view}" data-p='${esc(JSON.stringify(params))}'`;
const act = (name, params = {}) => `data-act="${name}" data-p='${esc(JSON.stringify(params))}'`;
function sportChip(s) { return `<span class="sport-chip" style="--sc:${SPORTS[s].color}">${icon(SPORTS[s].icon, 16)}${SPORTS[s].label}</span>`; }
function visIcon(v) { return v === 'only_me' ? `<span class="vis" title="Só tu">${icon('lock', 14)}</span>` : v === 'followers' ? `<span class="vis" title="Só seguidores">${icon('people', 14)}</span>` : ''; }
function stat(label, value, unit = '') { return `<div class="stat"><div class="stat-l">${label}</div><div class="stat-v">${value}${unit ? `<small>${unit}</small>` : ''}</div></div>`; }
function empty(title, body, cta = '') { return `<div class="empty"><h3>${title}</h3><p>${body}</p>${cta}</div>`; }
function proLock(what) {
  return `<div class="pro-lock">${icon('lock', 22)}<div><h3>${what} faz parte do plano Pro</h3><p>Ativa o plano Pro nas definições para desbloquear. Nesta demo é um interruptor.</p><button class="btn btn-primary btn-sm" ${go('settings')}>Ver planos</button></div></div>`;
}
function tabs(items, current, actName) {
  return `<div class="tabs" role="tablist">${items.map(([k, l]) => `<button role="tab" class="tab ${k === current ? 'on' : ''}" aria-selected="${k === current}" ${act(actName, { tab: k })}>${l}</button>`).join('')}</div>`;
}
function pageHead(title, sub = '', right = '', back = true) {
  return `<div class="page-head">${back ? `<button class="icon-btn back" data-act="back" aria-label="Voltar">${icon('back')}</button>` : ''}<div class="ph-t"><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${right}</div>`;
}

/* ---------- chrome ---------- */
function chrome() {
  const v = R.view, n = unreadCount();
  const nav = [['feed', 'Painel', 'home'], ['training', 'Treino', 'calendar'], ['explore', 'Explorar', 'map'], ['groups', 'Grupos', 'groups']];
  const on = (k) => (v === k || (k === 'explore' && ['segment', 'routeBuilder'].includes(v)) || (k === 'groups' && ['club', 'challenge'].includes(v))) ? 'on' : '';
  return `
  <header class="top"><div class="top-in">
    <a class="logo" href="#" ${go('feed')} aria-label="Passo, painel">${logoMark()}<span>passo</span></a>
    <nav class="top-nav" aria-label="Principal">${nav.map(([k, l]) => `<button class="tn ${on(k)}" ${go(k)}>${l}</button>`).join('')}</nav>
    <div class="top-r">
      <button class="icon-btn" ${go('search')} aria-label="Procurar atletas">${icon('search')}</button>
      <button class="icon-btn bell" ${go('notifications')} aria-label="Notificações${n ? `, ${n} por ler` : ''}">${icon('bell')}${n ? `<span class="badge" id="bell-n">${n}</span>` : ''}</button>
      <button class="icon-btn hide-sm" ${go('upload')} aria-label="Carregar ou adicionar atividade">${icon('upload')}</button>
      <button class="av-btn hide-sm" ${go('profile', { id: me() })} aria-label="O teu perfil">${avatar(me(), 32)}</button>
      <button class="btn btn-primary btn-sm hide-sm" ${go('record')}>${icon('record', 18)}Gravar</button>
    </div>
  </div></header>
  <nav class="tabbar" aria-label="Navegação">
    <button class="tb ${on('feed')}" ${go('feed')}>${icon('home')}<span>Início</span></button>
    <button class="tb ${on('explore')}" ${go('explore')}>${icon('map')}<span>Explorar</span></button>
    <button class="tb tb-rec ${v === 'record' ? 'on' : ''}" ${go('record')}><span class="rec-dot">${icon('record', 26)}</span><span>Gravar</span></button>
    <button class="tb ${on('groups')}" ${go('groups')}>${icon('groups')}<span>Grupos</span></button>
    <button class="tb ${v === 'profile' && R.params.id === me() ? 'on' : ''}" ${go('profile', { id: me() })}>${icon('user')}<span>Tu</span></button>
  </nav>`;
}
function logoMark() { return `<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><rect width="26" height="26" rx="7" class="logo-bg"/><path d="M7 18.5l4-11 4 7 2.2-3.6L20 18.5" fill="none" class="logo-fg" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`; }

/* ---------- S01 feed ---------- */
function activityCard(a) {
  const u = user(a.uid), an = analyze(a), k = kudosOf(a.id), cs = commentsOf(a.id), mine = a.uid === me();
  const effs = an.hasMap ? effortsFor(a, DB.segments) : [];
  const prs = effs.map(effortBadges).filter((b) => b.isPR).length;
  const crownsN = effs.filter((e) => { const c = crowns(e.seg); return (c.kom && c.kom.aid === a.id) || (c.qom && c.qom.aid === a.id); }).length;
  const hide = a.hideStats || {};
  const s3 = [stat('Distância', an.dist ? fmtDist(an.dist) : '–', an.dist ? distUnit() : '')];
  if (!hide.pace && an.dist) { const tp = tempo(a.sport, an.dist, an.moving); s3.push(stat(tp.label, tp.val, tp.unit)); }
  s3.push(stat('Tempo', fmtDur(an.moving, true)));
  if (an.hasMap && an.gain > 20) s3.push(stat('Desnível', fmtElev(an.gain), elevUnit()));
  return `<article class="card act-card">
    <div class="ac-head">
      <button class="av-btn" ${go('profile', { id: u.id })} aria-label="Perfil de ${esc(u.name)}">${avatar(u, 40)}</button>
      <div class="ac-who"><button class="link strong" ${go('profile', { id: u.id })}>${esc(u.name)}</button>
        <div class="muted sm">${icon(SPORTS[a.sport].icon, 14)} ${fmtWhen(a.start)}${u.city ? ' · ' + esc(u.city) : ''} ${visIcon(a.visibility)}</div></div>
    </div>
    <button class="ac-title" ${go('activity', { id: a.id })}>${esc(a.name)}</button>
    ${a.desc ? `<p class="ac-desc">${esc(a.desc)}</p>` : ''}
    <div class="stats-row">${s3.join('')}</div>
    ${prs || crownsN ? `<div class="ach">${crownsN ? `<span class="pill pill-gold">${icon('crown', 14)} ${crownsN} ${crownsN > 1 ? 'coroas' : 'coroa'}</span>` : ''}${prs ? `<span class="pill pill-pr">${icon('medal', 14)} ${prs} ${prs > 1 ? 'recordes pessoais' : 'recorde pessoal'}</span>` : ''}</div>` : ''}
    ${an.hasMap ? `<button class="ac-map" ${go('activity', { id: a.id })} aria-label="Abrir ${esc(a.name)}">${activityMap(a, { w: 640, h: 300, hideZone: !mine })}${a.photos && a.photos[0] ? `<img class="ac-photo" src="${a.photos[0]}" alt="Foto da atividade">` : ''}</button>` : (a.photos && a.photos[0] ? `<img class="ac-photo-big" src="${a.photos[0]}" alt="Foto da atividade">` : '')}
    <div class="ac-foot">
      <button class="kudos-list link sm" ${go('activity', { id: a.id, tab: 'kudos' })}>${k.length ? `<span class="stack">${k.slice(0, 3).map((x) => avatar(x, 22)).join('')}</span> ${k.length} kudos` : '<span class="muted">Ainda sem kudos</span>'}${cs.length ? ` · ${cs.length} ${cs.length > 1 ? 'comentários' : 'comentário'}` : ''}</button>
      <div class="ac-actions">
        ${mine ? '' : `<button class="icon-btn kudo ${hasKudos(a.id) ? 'on' : ''}" ${act('kudos', { id: a.id })} aria-pressed="${hasKudos(a.id)}" aria-label="Dar kudos">${icon('kudos')}</button>`}
        <button class="icon-btn" ${go('activity', { id: a.id, focus: 'comment' })} aria-label="Comentar">${icon('comment')}</button>
        <button class="icon-btn" ${act('share', { id: a.id })} aria-label="Partilhar">${icon('share')}</button>
      </div>
    </div>
  </article>`;
}

function weekStrip(uid) {
  const w0 = startOfWeek(Date.now()), acts = DB.activities.filter((a) => a.uid === uid && a.start >= w0);
  const days = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
  return `<div class="week-strip">${days.map((d, i) => {
    const day = acts.filter((a) => startOfDay(a.start) === startOfDay(w0 + i * 864e5 + 3 * 36e5));
    const mins = day.reduce((s, a) => s + analyze(a).moving / 60, 0);
    const sz = mins ? clamp(8 + mins / 6, 10, 26) : 6;
    return `<div class="ws-d"><span class="ws-dot ${mins ? 'on' : ''}" style="width:${sz}px;height:${sz}px"></span><span class="ws-l">${d}</span></div>`;
  }).join('')}</div>`;
}

function viewFeed() {
  const meU = user(me()), list = feed(), shown = list.slice(0, R.feedLimit || 12);
  const w = totals(sportActs(me(), null), startOfWeek(Date.now()));
  const latest = activitiesOf(me())[0];
  const goals = DB.goals.slice(0, 2);
  const myCh = DB.challenges.filter((c) => joined(c.id) && c.to > Date.now()).slice(0, 3);
  const suggest = DB.users.filter((u) => u.id !== me() && !isFollowing(me(), u.id)).slice(0, 3);
  return `<div class="feed-grid">
    <aside class="feed-l">
      <section class="card me-card">
        <button class="av-btn center" ${go('profile', { id: me() })}>${avatar(meU, 64)}</button>
        <h2 class="center">${esc(meU.name)}</h2>
        <div class="me-counts"><button ${go('follows', { id: me(), tab: 'following' })}><b>${followingOf(me()).length}</b><span>A seguir</span></button><button ${go('follows', { id: me(), tab: 'followers' })}><b>${followersOf(me()).length}</b><span>Seguidores</span></button><button ${go('profile', { id: me() })}><b>${activitiesOf(me()).length}</b><span>Atividades</span></button></div>
        ${latest ? `<div class="latest"><div class="muted xs up">Última atividade</div><button class="link strong" ${go('activity', { id: latest.id })}>${esc(latest.name)}</button><div class="muted sm">${fmtWhen(latest.start)}</div></div>` : ''}
      </section>
      <section class="card">
        <div class="card-h"><h3>Esta semana</h3><button class="link sm" ${go('training')}>Diário</button></div>
        ${weekStrip(me())}
        <div class="mini-stats"><div><b>${fmtDist(w.dist, 1)}</b> ${distUnit()}</div><div><b>${fmtDur(w.time, true)}</b></div><div><b>${fmtElev(w.gain)}</b> ${elevUnit()}</div></div>
      </section>
      ${goals.length ? `<section class="card"><div class="card-h"><h3>Objetivos</h3><button class="link sm" ${go('training', { tab: 'goals' })}>Gerir</button></div>${goals.map(goalRow).join('')}</section>` : ''}
    </aside>
    <main class="feed-c" aria-label="Atividades de quem segues">
      ${list.length ? shown.map(activityCard).join('') : empty('O teu painel está vazio', 'Segue atletas ou grava a tua primeira atividade para ver aqui o feed.', `<button class="btn btn-primary" ${go('search')}>Encontrar atletas</button>`)}
      ${list.length > shown.length ? `<button class="btn btn-secondary wide" data-act="more">Ver mais atividades</button>` : ''}
    </main>
    <aside class="feed-r">
      <section class="card">
        <div class="card-h"><h3>Os teus desafios</h3><button class="link sm" ${go('groups', { tab: 'challenges' })}>Todos</button></div>
        ${myCh.length ? myCh.map((c) => { const p = challengeProgress(c); return `<button class="ch-mini" ${go('challenge', { id: c.id })}><span class="ch-badge sm">${icon(p.done ? 'medal' : 'trophy', 18)}</span><span class="grow"><b>${esc(c.name)}</b><span class="bar"><i style="width:${(p.pct * 100).toFixed(0)}%"></i></span></span></button>`; }).join('') : `<p class="muted sm">Adere a um desafio para o acompanhares aqui.</p>`}
      </section>
      <section class="card">
        <div class="card-h"><h3>Clubes</h3><button class="link sm" ${go('groups')}>Ver</button></div>
        ${DB.clubs.filter((c) => c.members.includes(me())).map((c) => `<button class="row-btn" ${go('club', { id: c.id })}>${clubBadge(c, 32)}<span>${esc(c.name)}</span></button>`).join('') || '<p class="muted sm">Ainda não estás em nenhum clube.</p>'}
      </section>
      ${suggest.length ? `<section class="card"><div class="card-h"><h3>Sugestões</h3></div>${suggest.map(athleteRow).join('')}</section>` : ''}
    </aside>
  </div>`;
}
function goalRow(g) {
  const p = goalProgress(g), per = { week: 'Semana', month: 'Mês', year: 'Ano' }[g.period];
  const val = g.metric === 'distance' ? `${fmtDist(p.value, 1)} / ${fmtDistU(g.target, 0)}` : g.metric === 'time' ? `${fmtDur(p.value, true)} / ${fmtDur(g.target, true)}` : `${fmtElev(p.value)} / ${fmtElevU(g.target)}`;
  return `<div class="goal-row">${ring(p.pct, 44, 5)}<div><b>${per} · ${g.sport === 'all' ? 'Todos' : SPORTS[g.sport].label}</b><div class="muted sm">${val}</div></div></div>`;
}
function athleteRow(u) {
  u = typeof u === 'string' ? user(u) : u;
  const f = isFollowing(me(), u.id);
  return `<div class="ath-row"><button class="av-btn" ${go('profile', { id: u.id })}>${avatar(u, 36)}</button><button class="grow link left" ${go('profile', { id: u.id })}><b>${esc(u.name)}</b><span class="muted sm">${esc(u.city || '')}</span></button>${u.id === me() ? '' : `<button class="btn btn-sm ${f ? 'btn-secondary' : 'btn-primary'}" ${act('follow', { id: u.id })}>${f ? 'A seguir' : 'Seguir'}</button>`}</div>`;
}
function clubBadge(c, size = 40) {
  const col = c.sport === 'ride' ? 'var(--sport-ride)' : c.sport === 'hike' ? 'var(--sport-hike)' : 'var(--sport-run)';
  return `<span class="club-badge" style="--cb:${col};width:${size}px;height:${size}px">${icon(SPORTS[c.sport].icon, Math.round(size * 0.55))}</span>`;
}

/* ---------- S04 activity ---------- */
function viewActivity() {
  const a = activity(R.params.id);
  if (!a || !canView(a)) return pageHead('Atividade') + empty('Esta atividade não está disponível', 'Pode ter sido apagada, ou o atleta tornou-a privada.', `<button class="btn btn-secondary" ${go('feed')}>Voltar ao painel</button>`);
  const u = user(a.uid), an = analyze(a), mine = a.uid === me(), hide = a.hideStats || {};
  const asOthers = mine && R.asOthers;
  const tab = R.params.tab || 'overview';
  const effs = an.hasMap ? effortsFor(a, DB.segments) : [];
  const gear = a.gearId ? DB.gear.find((g) => g.id === a.gearId) : null;
  const big = [stat('Distância', an.dist ? fmtDist(an.dist) : '–', an.dist ? distUnit() : ''), stat('Tempo em movimento', fmtDur(an.moving))];
  if (an.dist && !(asOthers && hide.pace)) { const tp = tempo(a.sport, an.dist, an.moving); big.push(stat(tp.label + (tp.label === 'Ritmo' ? ' médio' : ' média'), tp.val, tp.unit)); }
  if (an.hasMap) big.push(stat('Desnível', fmtElev(an.gain), elevUnit()));
  const small = [];
  small.push(['Tempo decorrido', fmtDur(an.elapsed)]);
  if (an.maxSpeed && !usesPace(a.sport)) small.push(['Velocidade máx.', fmtSpeedU(an.maxSpeed * 1000, 1000)]);
  if (an.avgHr && !(asOthers && hide.hr)) { small.push(['FC média', an.avgHr + ' bpm']); small.push(['FC máx.', an.maxHr + ' bpm']); }
  if (!(asOthers && hide.calories)) small.push(['Calorias', NF0.format(an.calories)]);
  if (a.rpe) small.push(['Esforço percebido', a.rpe + '/10']);
  if (gear) small.push([gear.kind === 'bike' ? 'Bicicleta' : 'Sapatilhas', esc(gear.name)]);

  let body = '';
  if (tab === 'overview') body = activityOverview(a, an, effs, asOthers);
  else if (tab === 'segments') body = activitySegments(a, effs);
  else if (tab === 'analysis') body = activityAnalysis(a, an);
  else if (tab === 'kudos') body = `<section class="card">${kudosOf(a.id).length ? kudosOf(a.id).map(athleteRow).join('') : '<p class="muted">Ainda sem kudos.</p>'}</section>`;

  const tabsList = [['overview', 'Resumo']];
  if (an.hasMap) { tabsList.push(['analysis', 'Análise']); tabsList.push(['segments', `Segmentos${effs.length ? ' (' + effs.length + ')' : ''}`]); }
  tabsList.push(['kudos', `Kudos (${kudosOf(a.id).length})`]);

  return `<div class="act-page">
    ${pageHead(esc(a.name), `${SPORTS[a.sport].verb} · ${fmtWhen(a.start)}`, mine ? `<div class="ph-r"><button class="icon-btn" ${go('edit', { id: a.id })} aria-label="Editar">${icon('edit')}</button></div>` : '')}
    <section class="card act-hero">
      <div class="ah-who"><button class="av-btn" ${go('profile', { id: u.id })}>${avatar(u, 48)}</button><div><button class="link strong" ${go('profile', { id: u.id })}>${esc(u.name)}</button><div class="muted sm">${sportChip(a.sport)} ${visIcon(a.visibility)}</div></div>
        ${mine ? `<label class="switch sm ah-as"><input type="checkbox" id="as-others" ${act('asOthers')} ${R.asOthers ? 'checked' : ''}><span></span>Ver como os outros</label>` : `<button class="btn btn-sm ${hasKudos(a.id) ? 'btn-secondary' : 'btn-primary'} ah-as" ${act('kudos', { id: a.id })}>${icon('kudos', 16)}${hasKudos(a.id) ? 'Kudos dados' : 'Dar kudos'}</button>`}</div>
      ${a.desc ? `<p class="ac-desc">${esc(a.desc)}</p>` : ''}
      <div class="big-stats">${big.join('')}</div>
      <dl class="kv">${small.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      ${an.effort ? `<div class="effort"><span class="eff-n">${an.effort}</span><div><b>Esforço relativo · ${effortLabel(an.effort)}</b><div class="muted sm">${an.zones ? 'Calculado a partir do tempo em cada zona de frequência cardíaca.' : 'Estimado a partir da duração e do ritmo (sem frequência cardíaca).'}</div></div></div>` : ''}
    </section>
    ${an.hasMap ? `<section class="card flush">${activityMap(a, { w: 900, h: 420, kms: true, cursor: true, hideZone: asOthers, cls: 'map-lg', segment: R.hlSeg != null ? effs[R.hlSeg] : null })}${asOthers && DB.settings.privacyZone.on ? `<div class="map-note">${icon('lock', 14)} Os outros não veem o início e o fim dentro da tua zona de privacidade.</div>` : ''}</section>` : ''}
    ${a.photos && a.photos.length ? `<section class="photos">${a.photos.map((p) => `<img src="${p}" alt="Foto da atividade">`).join('')}</section>` : ''}
    ${tabs(tabsList, tab, 'actTab')}
    ${body}
    ${activityComments(a)}
  </div>`;
}

function activityOverview(a, an, effs, asOthers) {
  let s = '';
  if (an.hasMap) {
    const el = elevationFor(a);
    s += `<section class="card"><div class="card-h"><h3>Altimetria</h3><span class="muted sm" id="cursor-read" aria-live="polite"></span></div><div class="chart-wrap" data-scrub="${a.id}">${areaChart(el.xs, el.ys, { w: 900, h: 170, fmtX: (v) => NF0.format(v) + ' ' + distUnit(), fmtY: (v) => NF0.format(v) + ' ' + elevUnit(), cls: 'c-elev', label: 'Perfil de altimetria' })}</div></section>`;
  }
  if (an.splits.length && !(asOthers && a.hideStats && a.hideStats.pace)) {
    const maxT = Math.max(...an.splits.map((x) => x.time / (x.dist || 1)));
    const minT = Math.min(...an.splits.map((x) => x.time / (x.dist || 1)));
    s += `<section class="card"><div class="card-h"><h3>Parciais</h3></div><div class="tbl-wrap"><table class="tbl splits"><thead><tr><th>${distUnit()}</th><th>${usesPace(a.sport) ? 'Ritmo' : 'Velocidade'}</th><th class="w-bar"></th><th>Desnível</th>${an.avgHr ? '<th>FC</th>' : ''}</tr></thead><tbody>${an.splits.map((x) => {
      const rate = x.time / (x.dist || 1), w = 30 + 70 * (1 - (rate - minT) / ((maxT - minT) || 1));
      return `<tr class="${rate === minT ? 'fast' : ''}"><td>${x.partial ? NF1.format(distVal(x.dist)) : x.n}</td><td class="num">${usesPace(a.sport) ? fmtPace(x.dist, x.time) : fmtSpeed(x.dist, x.time)}</td><td class="w-bar"><span class="sbar" style="width:${w.toFixed(0)}%"></span></td><td class="num">${x.elev >= 0 ? '+' : ''}${fmtElev(x.elev)}</td>${an.avgHr ? `<td class="num">${x.hr || '–'}</td>` : ''}</tr>`;
    }).join('')}</tbody></table></div></section>`;
  }
  if (an.best.length) {
    const prior = DB.activities.filter((b) => b.uid === a.uid && b.start < a.start && sportFamily(b.sport) === 'run');
    s += `<section class="card"><div class="card-h"><h3>Melhores esforços</h3></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Distância</th><th>Tempo</th><th>Ritmo</th><th></th></tr></thead><tbody>${an.best.map((b) => {
      const prev = prior.map((p) => analyze(p).best.find((x) => x.len === b.len)).filter(Boolean).map((x) => x.time);
      const rank = prev.filter((t) => t < b.time).length + 1;
      return `<tr><td>${b.label}</td><td class="num">${fmtDur(b.time)}</td><td class="num">${fmtPaceU(b.len, b.time)}</td><td>${rank <= 3 && prev.length ? `<span class="pill ${rank === 1 ? 'pill-pr' : 'pill-soft'}">${rank === 1 ? 'Recorde pessoal' : rank + 'º melhor'}</span>` : ''}</td></tr>`;
    }).join('')}</tbody></table></div></section>`;
  }
  if (effs.length) s += activitySegments(a, effs.slice(0, 4), true);
  if (a.laps && a.laps.length) {
    const t = trackOf(a), cum = an.cum, idx = [0, ...a.laps, t.length - 1];
    s += `<section class="card"><div class="card-h"><h3>Voltas</h3></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Volta</th><th>Distância</th><th>Tempo</th><th>${usesPace(a.sport) ? 'Ritmo' : 'Velocidade'}</th></tr></thead><tbody>${idx.slice(1).map((j, k) => { const i = idx[k], d = cum[j] - cum[i], tt = t[j][3] - t[i][3]; return `<tr><td>${k + 1}</td><td class="num">${fmtDistU(d)}</td><td class="num">${fmtDur(tt)}</td><td class="num">${fmtTempo(a.sport, d, tt)}</td></tr>`; }).join('')}</tbody></table></div></section>`;
  }
  if (pro() && an.hasMap) {
    const sim = similarActivities(a);
    if (sim.length) {
      const list = [...sim, a].sort((p, q) => analyze(p).moving - analyze(q).moving);
      s += `<section class="card"><div class="card-h"><h3>No mesmo percurso</h3><span class="muted sm">${list.length} vezes</span></div>${list.slice(0, 6).map((b, i) => `<button class="row-btn ${b.id === a.id ? 'cur' : ''}" ${go('activity', { id: b.id })}><span class="rank">${i + 1}</span><span class="grow">${esc(b.name)} <span class="muted sm">· ${DTF_SHORT.format(b.start)}</span></span><span class="num strong">${fmtDur(analyze(b).moving)}</span></button>`).join('')}</section>`;
    }
  }
  if (a.uid === me() && an.hasMap) {
    s += `<section class="card"><div class="card-h"><h3>Criar um segmento</h3></div><p class="muted sm">Escolhe o troço desta atividade que queres transformar em segmento. Os esforços passam a ser detetados em todas as atividades.</p>
      <form class="form-grid" data-form="mkseg" data-id="${a.id}">
        <label class="fld"><span>Nome</span><input id="seg-name" name="name" required maxlength="60" placeholder="Ex.: Subida da escola"></label>
        <label class="fld"><span>Início (${distUnit()})</span><input id="seg-from" name="from" type="number" step="0.1" min="0" max="${distVal(an.dist).toFixed(1)}" value="0"></label>
        <label class="fld"><span>Fim (${distUnit()})</span><input id="seg-to" name="to" type="number" step="0.1" min="0.2" max="${distVal(an.dist).toFixed(1)}" value="${Math.min(1, distVal(an.dist)).toFixed(1)}"></label>
        <button class="btn btn-secondary">Criar segmento</button></form></section>`;
  }
  return s;
}

function activitySegments(a, effs, compact) {
  if (!effs.length) return `<section class="card"><p class="muted">Esta atividade não passou por nenhum segmento.</p></section>`;
  const all = effortsFor(a, DB.segments);
  return `<section class="card"><div class="card-h"><h3>Segmentos</h3>${compact && all.length > effs.length ? `<button class="link sm" ${act('actTab', { tab: 'segments' })}>Ver os ${all.length}</button>` : ''}</div>
  ${effs.map((e) => {
    const sg = DB.segments.find((x) => x.id === e.seg), info = segmentInfo(sg), b = effortBadges(e), c = crowns(sg.id);
    const isKom = (c.kom && c.kom.aid === a.id && c.kom.i === e.i) || (c.qom && c.qom.aid === a.id && c.qom.i === e.i);
    const k = all.indexOf(e);
    return `<div class="seg-row ${R.hlSeg === k ? 'cur' : ''}"><button class="seg-hl" ${act('hlSeg', { k })} aria-label="Destacar no mapa">${isKom ? `<span class="medal gold">${icon('crown', 16)}</span>` : b.pr ? `<span class="medal m${b.pr}">${icon('medal', 16)}</span>` : `<span class="medal none">${icon('flag', 16)}</span>`}</button>
      <button class="grow left link" ${go('segment', { id: sg.id })}><b>${esc(sg.name)}</b><span class="muted sm">${fmtDistU(info.len)} · ${NF1.format(info.avg * 100)}%${info.cat ? ' · Cat. ' + info.cat : ''}</span></button>
      <div class="right"><b class="num">${fmtDur(e.time)}</b><div class="muted xs">${isKom ? (user(a.uid).sex === 'f' ? 'QOM' : 'KOM') : b.isPR ? 'Recorde pessoal' : b.pr ? b.pr + 'º tempo teu' : b.overall ? b.overall + 'º geral' : fmtTempo(a.sport, info.len, e.time)}</div></div></div>`;
  }).join('')}</section>`;
}

function activityAnalysis(a, an) {
  const p = paceFor(a), el = elevationFor(a);
  let s = `<section class="card"><div class="card-h"><h3>${p.pace ? 'Ritmo' : 'Velocidade'}</h3><span class="muted sm" id="cursor-read" aria-live="polite"></span></div><div class="chart-wrap" data-scrub="${a.id}">${areaChart(p.xs, p.ys, { w: 900, h: 170, invert: p.pace, cls: 'c-pace', fmtX: (v) => NF0.format(v) + ' ' + distUnit(), fmtY: p.pace ? (v) => `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, '0')}` : (v) => NF0.format(v), label: 'Gráfico de ritmo' })}</div></section>`;
  s += `<section class="card"><div class="card-h"><h3>Altimetria</h3></div><div class="chart-wrap" data-scrub="${a.id}">${areaChart(el.xs, el.ys, { w: 900, h: 150, fmtX: (v) => NF0.format(v) + ' ' + distUnit(), fmtY: (v) => NF0.format(v), label: 'Perfil de altimetria' })}</div></section>`;
  const t = trackOf(a);
  if (an.avgHr) {
    const xs = [], ys = []; for (let i = 0; i < t.length; i++) if (t[i][4]) { xs.push(distVal(an.cum[i])); ys.push(t[i][4]); }
    s += `<section class="card"><div class="card-h"><h3>Frequência cardíaca</h3></div><div class="chart-wrap" data-scrub="${a.id}">${areaChart(xs, ys, { w: 900, h: 150, cls: 'c-hr', fmtX: (v) => NF0.format(v) + ' ' + distUnit(), label: 'Frequência cardíaca' })}</div></section>`;
    const tot = an.zones.reduce((x, y) => x + y, 0) || 1;
    s += `<section class="card"><div class="card-h"><h3>Zonas de frequência cardíaca</h3><span class="muted sm">FC máx. ${HR_MAX} bpm</span></div><div class="zones">${an.zones.map((z, i) => `<div class="zone"><span class="zl">Z${i + 1} <span class="muted">${ZONE_NAMES[i]}</span></span><span class="zb"><i class="z${i + 1}" style="width:${(z / tot * 100).toFixed(1)}%"></i></span><span class="num zt">${fmtDur(z)}</span><span class="num muted zp">${NF0.format(z / tot * 100)}%</span></div>`).join('')}</div></section>`;
  }
  return s;
}

function activityComments(a) {
  const cs = commentsOf(a.id);
  return `<section class="card" id="comments"><div class="card-h"><h3>Comentários</h3></div>
    ${cs.map((c) => `<div class="comment">${avatar(c.uid, 32)}<div class="grow"><div><button class="link strong sm" ${go('profile', { id: c.uid })}>${esc(user(c.uid).name)}</button> <span class="muted xs">${fmtAgo(c.at)}</span></div><p>${esc(c.text)}</p></div>${c.uid === me() ? `<button class="icon-btn sm" ${act('delComment', { id: c.id })} aria-label="Apagar comentário">${icon('trash', 16)}</button>` : ''}</div>`).join('') || '<p class="muted sm">Sê o primeiro a comentar.</p>'}
    <form class="comment-form" data-form="comment" data-id="${a.id}"><label class="sr" for="comment-in">Escreve um comentário</label><input id="comment-in" name="text" maxlength="2000" placeholder="Escreve um comentário…" autocomplete="off"><button class="btn btn-primary btn-sm">Publicar</button></form>
  </section>`;
}

/* ---------- S05 edit / S03 save ---------- */
function activityForm({ a, mode }) {
  const gear = gearOf(me()).filter((g) => !g.retired);
  const hide = a.hideStats || {};
  return `<form class="card form" data-form="${mode}" data-id="${a.id || ''}">
    <label class="fld"><span>Título</span><input id="f-name" name="name" required maxlength="80" value="${esc(a.name)}"></label>
    <label class="fld"><span>Descrição</span><textarea id="f-desc" name="desc" rows="3" maxlength="2000" placeholder="Como correu? Partilha o que quiseres.">${esc(a.desc || '')}</textarea></label>
    <div class="form-grid">
      <label class="fld"><span>Desporto</span><select id="f-sport" name="sport">${Object.entries(SPORTS).map(([k, v]) => `<option value="${k}" ${a.sport === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
      <label class="fld"><span>Quem pode ver</span><select id="f-vis" name="visibility">${[['everyone', 'Todos'], ['followers', 'Só seguidores'], ['only_me', 'Só eu']].map(([k, l]) => `<option value="${k}" ${a.visibility === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="fld"><span>Equipamento</span><select id="f-gear" name="gearId"><option value="">Nenhum</option>${gear.map((g) => `<option value="${g.id}" ${a.gearId === g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select></label>
      <label class="fld"><span>Esforço percebido</span><select id="f-rpe" name="rpe"><option value="">Sem registo</option>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<option value="${n}" ${+a.rpe === n ? 'selected' : ''}>${n} · ${['Muito leve', 'Muito leve', 'Leve', 'Leve', 'Moderado', 'Moderado', 'Difícil', 'Difícil', 'Máximo', 'Máximo'][n - 1]}</option>`).join('')}</select></label>
    </div>
    <fieldset class="fld"><legend>Esconder dos outros</legend><div class="checks">
      <label class="chk"><input type="checkbox" id="h-pace" name="h_pace" ${hide.pace ? 'checked' : ''}> Ritmo e velocidade</label>
      <label class="chk"><input type="checkbox" id="h-hr" name="h_hr" ${hide.hr ? 'checked' : ''}> Frequência cardíaca</label>
      <label class="chk"><input type="checkbox" id="h-cal" name="h_calories" ${hide.calories ? 'checked' : ''}> Calorias</label></div></fieldset>
    <div class="fld"><span class="fld-l">Fotos</span><div class="photo-row" id="photo-row">${(a.photos || []).map((p, i) => `<span class="ph"><img src="${p}" alt=""><button type="button" class="icon-btn sm" ${act('rmPhoto', { i })} aria-label="Remover foto">${icon('close', 14)}</button></span>`).join('')}<label class="ph-add">${icon('camera')}<span>Adicionar</span><input type="file" id="f-photo" accept="image/*" multiple data-change="photo"></label></div></div>
    <div class="form-actions">
      ${mode === 'save' ? `<button type="button" class="btn btn-ghost danger" data-act="discardAsk">Descartar</button>` : `<button type="button" class="btn btn-ghost danger" ${act('deleteAsk', { id: a.id })}>Apagar atividade</button>`}
      <button class="btn btn-primary">${mode === 'save' ? 'Guardar atividade' : 'Guardar alterações'}</button>
    </div>
    ${R.confirm ? `<div class="confirm" role="alertdialog" aria-label="Confirmar"><p>${R.confirm.text}</p><div><button type="button" class="btn btn-secondary btn-sm" data-act="confirmNo">Cancelar</button><button type="button" class="btn btn-danger btn-sm" data-act="confirmYes">${R.confirm.yes}</button></div></div>` : ''}
  </form>`;
}
function viewEdit() {
  const a = activity(R.params.id);
  if (!a || a.uid !== me()) return pageHead('Editar') + empty('Não podes editar esta atividade', 'Só o dono pode editar.');
  if (!R.draftPhotos) R.draftPhotos = (a.photos || []).slice();
  return pageHead('Editar atividade') + activityForm({ a: { ...a, photos: R.draftPhotos }, mode: 'edit' });
}
function viewSave() {
  const d = REC.pending;
  if (!d) return pageHead('Guardar') + empty('Nada para guardar', 'Grava ou carrega uma atividade primeiro.', `<button class="btn btn-primary" ${go('record')}>Gravar</button>`);
  const fake = { id: '_pending', sport: d.sport, track: d.track, manual: d.manual, start: d.start, v: d.v || 0 };
  const an = analyze(fake);
  return `${pageHead('Guardar atividade', `${SPORTS[d.sport].verb} · ${fmtWhen(d.start)}`)}
    <section class="card"><div class="big-stats">${stat('Distância', fmtDist(an.dist), distUnit())}${stat('Tempo', fmtDur(an.moving))}${an.dist ? (() => { const tp = tempo(d.sport, an.dist, an.moving); return stat(tp.label, tp.val, tp.unit); })() : ''}${an.hasMap ? stat('Desnível', fmtElev(an.gain), elevUnit()) : ''}</div>
    ${an.hasMap ? activityMap(fake, { w: 900, h: 260 }) : ''}</section>
    ${activityForm({ a: { ...d, photos: d.photos || [] }, mode: 'save' })}`;
}

/* ---------- S02 record ---------- */
function viewRecord() {
  const r = REC;
  if (r.state === 'idle') {
    const routes = DB.routes.filter((x) => x.uid === me());
    return `<div class="rec-page">${pageHead('Gravar', 'Escolhe o desporto e carrega em começar')}
      <section class="card"><h3 class="h-sm">Desporto</h3><div class="sport-pick">${Object.entries(SPORTS).filter(([, v]) => v.gps).map(([k, v]) => `<button class="sp ${r.sport === k ? 'on' : ''}" ${act('recSport', { s: k })} aria-pressed="${r.sport === k}" style="--sc:${v.color}">${icon(v.icon, 26)}<span>${v.label}</span></button>`).join('')}</div></section>
      <section class="card"><h3 class="h-sm">Sinal de localização</h3>
        <div class="seg-ctl" role="radiogroup" aria-label="Fonte de localização">
          <label><input type="radio" name="src" value="sim" ${r.source === 'sim' ? 'checked' : ''} data-change="recSrc"><span>Simulador</span></label>
          <label><input type="radio" name="src" value="gps" ${r.source === 'gps' ? 'checked' : ''} data-change="recSrc"><span>GPS do dispositivo</span></label>
        </div>
        <p class="muted sm">${r.source === 'sim' ? 'O simulador percorre uma rota na cidade de demonstração, para poderes testar no computador.' : 'Usa a localização do teu telemóvel. Dentro da pré-visualização do Claude o acesso à localização está bloqueado; funciona quando a app estiver no teu domínio.'}</p>
        ${r.source === 'sim' ? `<div class="form-grid"><label class="fld"><span>Rota</span><select id="rec-route" data-change="recRoute"><option value="">Automática (${esc(BASE_ROUTES[(ROUTES_BY_SPORT[r.sport] || ['ribeira'])[0]].name)})</option>${routes.map((x) => `<option value="${x.id}" ${r.routeId === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
        <label class="fld"><span>Velocidade da simulação</span><select id="rec-speed" data-change="recSpeed">${[1, 10, 30, 60].map((n) => `<option value="${n}" ${r.speed === n ? 'selected' : ''}>${n === 1 ? 'Tempo real' : n + '× mais rápido'}</option>`).join('')}</select></label></div>` : ''}
        <label class="switch"><input type="checkbox" id="rec-auto" ${DB.settings.autopause ? 'checked' : ''} data-change="autopause"><span></span>Pausa automática quando paras</label>
      </section>
      <section class="card beacon"><div class="card-h"><h3>${icon('beacon', 18)} Localização em direto</h3></div>
        ${pro() ? `<label class="switch"><input type="checkbox" id="rec-beacon" ${r.beacon ? 'checked' : ''} data-change="beacon"><span></span>Partilhar a minha posição com contactos de segurança durante esta atividade</label>${r.beacon ? `<div class="beacon-link"><code id="beacon-url">passo.app/b/${r.beaconId}</code><button class="btn btn-secondary btn-sm" ${act('copy', { sel: '#beacon-url' })}>Copiar link</button></div><p class="muted sm">Quem tiver o link vê a tua posição e o teu tempo até terminares. (Nesta demo o link ainda não é servido.)</p>` : ''}` : proLock('A localização em direto')}
      </section>
      <button class="btn btn-primary btn-xl wide" data-act="recStart">${icon('play', 22)}Começar</button>
      <p class="center muted sm">Sem GPS? <button class="link" ${go('upload')}>Carrega um GPX ou adiciona manualmente</button></p>
    </div>`;
  }
  const an = r.track.length > 1 ? analyze({ id: '_live', sport: r.sport, track: r.track, start: r.start, v: r.track.length }) : { dist: 0, moving: 0, gain: 0 };
  const xy = r.track.map((p) => toXY(p[0], p[1]));
  const lastSpd = r.track.length > 3 ? (() => { const n = r.track.length, a = r.track[n - 4], b = r.track[n - 1]; const d = haversine(a[0], a[1], b[0], b[1]), dt = b[3] - a[3]; return dt ? [d, dt] : [0, 0]; })() : [0, 0];
  const plan = r.routePts ? [{ xy: r.routePts, cls: 'm-plan', w: 4, noHalo: true }] : [];
  const lines = [...plan, { xy: xy.length > 1 ? xy : [r.pos || [0, -1280], r.pos || [0, -1280]], cls: '' }];
  const bbox = r.routePts ? bboxOf([r.routePts], 200) : bboxOf([xy.length ? xy : [[0, -1280]]], 500);
  return `<div class="rec-live">
    <div class="rec-map">${mapSVG({ lines, markers: [...(xy.length ? [{ kind: 'start', xy: xy[0] }] : []), { kind: 'me', xy: xy[xy.length - 1] || r.pos || [0, -1280] }], w: 900, h: 420, bbox, label: 'Mapa da gravação em curso' })}
      <div class="rec-status ${r.state}">${r.state === 'paused' ? (r.autoPaused ? 'Pausa automática' : 'Em pausa') : r.source === 'gps' ? (r.gpsOk ? 'GPS ativo' : 'À procura de sinal…') : 'A gravar (simulador ' + r.speed + '×)'}</div>
    </div>
    <div class="rec-stats">
      <div class="rs-main"><div class="rs-l">Tempo</div><div class="rs-v" id="rs-time">${fmtDur(r.elapsedMoving)}</div></div>
      <div class="rs-grid">
        <div><div class="rs-l">Distância</div><div class="rs-v">${fmtDist(an.dist)} <small>${distUnit()}</small></div></div>
        <div><div class="rs-l">${usesPace(r.sport) ? 'Ritmo atual' : 'Velocidade'}</div><div class="rs-v">${usesPace(r.sport) ? fmtPace(lastSpd[0], lastSpd[1]) : fmtSpeed(lastSpd[0], lastSpd[1])} <small>${usesPace(r.sport) ? '/' + distUnit() : 'km/h'}</small></div></div>
        <div><div class="rs-l">${usesPace(r.sport) ? 'Ritmo médio' : 'Média'}</div><div class="rs-v">${an.dist ? (usesPace(r.sport) ? fmtPace(an.dist, an.moving) : fmtSpeed(an.dist, an.moving)) : '–'}</div></div>
        <div><div class="rs-l">Desnível</div><div class="rs-v">${fmtElev(an.gain || 0)} <small>${elevUnit()}</small></div></div>
        ${r.track.length && r.track[r.track.length - 1][4] ? `<div><div class="rs-l">FC</div><div class="rs-v">${r.track[r.track.length - 1][4]} <small>bpm</small></div></div>` : ''}
        <div><div class="rs-l">Voltas</div><div class="rs-v">${r.laps.length + 1}</div></div>
      </div>
    </div>
    <div class="rec-ctl">
      ${r.state === 'recording' ? `<button class="btn btn-secondary btn-round" data-act="recLap" aria-label="Marcar volta">${icon('lap', 24)}<span>Volta</span></button><button class="btn btn-primary btn-round xl" data-act="recPause" aria-label="Pausar">${icon('pause', 30)}</button><span class="btn-round ghost"></span>`
      : `<button class="btn btn-secondary btn-round" data-act="recResume" aria-label="Retomar">${icon('play', 24)}<span>Retomar</span></button><button class="btn btn-danger btn-round xl" data-act="recFinish" aria-label="Terminar">${icon('stop', 28)}</button><button class="btn btn-ghost btn-round" data-act="recDiscardAsk" aria-label="Descartar">${icon('trash', 22)}<span>Descartar</span></button>`}
    </div>
    ${R.confirm ? `<div class="confirm card" role="alertdialog"><p>${R.confirm.text}</p><div><button class="btn btn-secondary btn-sm" data-act="confirmNo">Cancelar</button><button class="btn btn-danger btn-sm" data-act="confirmYes">${R.confirm.yes}</button></div></div>` : ''}
  </div>`;
}

/* ---------- S22 upload / manual ---------- */
function viewUpload() {
  const tab = R.params.tab || 'gpx';
  return `${pageHead('Adicionar atividade')}
    ${tabs([['gpx', 'Ficheiro GPX'], ['manual', 'Entrada manual']], tab, 'uploadTab')}
    ${tab === 'gpx' ? `<section class="card"><label class="drop" id="drop"><input type="file" id="gpx-in" accept=".gpx,application/gpx+xml" data-change="gpx">${icon('upload', 32)}<b>Escolhe um ficheiro GPX</b><span class="muted sm">ou arrasta-o para aqui. Funciona com exportações de relógios e de outras apps.</span></label>${R.uploadErr ? `<p class="err" role="alert">${esc(R.uploadErr)}</p>` : ''}</section>`
    : `<form class="card form" data-form="manual">
      <div class="form-grid">
        <label class="fld"><span>Desporto</span><select id="m-sport" name="sport">${Object.entries(SPORTS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select></label>
        <label class="fld"><span>Data e hora</span><input id="m-when" type="datetime-local" name="when" required value="${new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16)}"></label>
        <label class="fld"><span>Distância (${distUnit()})</span><input id="m-dist" type="number" name="dist" min="0" step="0.01" placeholder="0"></label>
        <label class="fld"><span>Duração (h:mm:ss)</span><input id="m-dur" name="dur" required pattern="\\d{1,2}(:\\d{2}){1,2}" placeholder="0:45:00"></label>
        <label class="fld"><span>Desnível (${elevUnit()})</span><input id="m-elev" type="number" name="elev" min="0" step="1" placeholder="0"></label>
      </div>
      <label class="fld"><span>Título</span><input id="m-name" name="name" maxlength="80" placeholder="Ex.: Treino de força"></label>
      <div class="form-actions"><button class="btn btn-primary">Continuar</button></div>
    </form>`}`;
}

/* ---------- S06 explore ---------- */
function viewExplore() {
  const tab = R.params.tab || 'segments';
  let body = '';
  if (tab === 'segments') {
    const f = R.segFilter || 'all';
    let segs = DB.segments.filter((s) => f === 'all' || s.sport === f || (f === 'starred' && DB.starred.includes(s.id)));
    const lines = segs.map((s) => ({ xy: segmentInfo(s).dense, cls: s.sport === 'ride' ? 'm-ride' : 'm-run', w: 4 }));
    body = `<section class="card flush">${mapSVG({ lines: lines.length ? lines : [{ xy: [[0, -1280], [10, -1280]] }], w: 900, h: 340, pad: 400, label: 'Mapa de segmentos' })}</section>
      <div class="chips">${[['all', 'Todos'], ['run', 'Corrida'], ['ride', 'Bicicleta'], ['starred', 'Com estrela']].map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" ${act('segFilter', { f: k })}>${l}</button>`).join('')}</div>
      <section class="card">${segs.map(segmentRow).join('') || '<p class="muted">Nenhum segmento com este filtro.</p>'}</section>`;
  } else {
    const routes = DB.routes.filter((r) => r.uid === me());
    body = `<div class="row-end"><button class="btn btn-primary" ${go('routeBuilder')}>${icon('plus', 18)}Nova rota</button></div>
      ${routes.length ? `<div class="route-grid">${routes.map(routeCard).join('')}</div>` : empty('Ainda não tens rotas', 'Desenha uma rota no mapa e usa-a para gravar ou partilhar.', `<button class="btn btn-primary" ${go('routeBuilder')}>Desenhar rota</button>`)}`;
  }
  return `${pageHead('Explorar', '', '', false)}${tabs([['segments', 'Segmentos'], ['routes', 'Rotas'], ['heatmap', 'Heatmap pessoal']], tab, 'exploreTab')}${tab === 'heatmap' ? viewHeatmap() : body}`;
}
function segmentRow(s) {
  const info = segmentInfo(s), c = crowns(s.id), mine = myEfforts(s.id)[0], star = DB.starred.includes(s.id);
  return `<div class="seg-row"><button class="icon-btn star ${star ? 'on' : ''}" ${act('star', { id: s.id })} aria-pressed="${star}" aria-label="Marcar com estrela">${icon('star', 18)}</button>
    <button class="grow left link" ${go('segment', { id: s.id })}><b>${esc(s.name)}</b><span class="muted sm">${s.sport === 'ride' ? 'Bicicleta' : 'Corrida'} · ${fmtDistU(info.len)} · ${NF1.format(info.avg * 100)}%${info.cat ? ' · Cat. ' + info.cat : ''}</span></button>
    <div class="right"><div class="sm"><span class="muted">Recorde</span> <b class="num">${c.cr ? fmtDur(c.cr.time) : '–'}</b></div><div class="xs muted">${mine ? 'O teu: ' + fmtDur(mine.time) : 'Sem esforços teus'}</div></div></div>`;
}
function routeCard(r) {
  const d = densify(r.pts, 20), len = pathLength(r.pts), g = routeGain(d);
  return `<article class="card route-card"><button class="ac-map" ${go('routeBuilder', { id: r.id })} aria-label="Abrir ${esc(r.name)}">${mapSVG({ lines: [{ xy: d }], markers: [{ kind: 'start', xy: d[0] }, { kind: 'end', xy: d[d.length - 1] }], w: 420, h: 200 })}</button>
    <div class="rc-b"><b>${esc(r.name)}</b><div class="muted sm">${SPORTS[r.sport].label} · ${fmtDistU(len)} · ${fmtElevU(g)}</div>
    <div class="rc-a"><button class="btn btn-secondary btn-sm" ${act('recordRoute', { id: r.id })}>${icon('record', 16)}Gravar</button><button class="btn btn-ghost btn-sm" ${act('exportGpx', { id: r.id })}>GPX</button><button class="icon-btn sm" ${act('delRouteAsk', { id: r.id })} aria-label="Apagar rota">${icon('trash', 16)}</button></div>
    ${R.confirm && R.confirm.ref === r.id ? `<div class="confirm"><p>${R.confirm.text}</p><div><button class="btn btn-secondary btn-sm" data-act="confirmNo">Cancelar</button><button class="btn btn-danger btn-sm" data-act="confirmYes">${R.confirm.yes}</button></div></div>` : ''}</div></article>`;
}
function routeGain(d) { let g = 0, ref = terrain(d[0][0], d[0][1]); for (const p of d) { const e = terrain(p[0], p[1]); if (e - ref > 1.5) { g += e - ref; ref = e; } else if (ref - e > 1.5) ref = e; } return g; }

function viewHeatmap() {
  if (!pro()) return proLock('O heatmap pessoal');
  const f = R.heatSport || 'all';
  const acts = DB.activities.filter((a) => a.uid === me() && trackOf(a) && (f === 'all' || sportFamily(a.sport) === f));
  const lines = acts.map((a) => ({ xy: xyOf(a), cls: 'm-heat', w: 2.6, noHalo: true, max: 300 }));
  return `<div class="chips">${[['all', 'Tudo'], ['run', 'Corrida'], ['ride', 'Bicicleta'], ['walk', 'Caminhada']].map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" ${act('heatSport', { f: k })}>${l}</button>`).join('')}</div>
    <section class="card flush">${lines.length ? mapSVG({ lines, w: 900, h: 520, pad: 300, cls: 'heat', label: 'Heatmap das tuas atividades' }) : '<div class="map-empty">Sem atividades com GPS neste filtro</div>'}</section>
    <p class="muted sm">${acts.length} atividades sobrepostas. Onde passas mais vezes, a linha fica mais intensa.</p>`;
}

/* ---------- S07 segment ---------- */
function viewSegment() {
  const sg = DB.segments.find((s) => s.id === R.params.id);
  if (!sg) return pageHead('Segmento') + empty('Segmento não encontrado', '');
  const info = segmentInfo(sg), c = crowns(sg.id), f = R.lbFilter || 'all';
  const gated = f !== 'all' && f !== 'f' && f !== 'm' && !pro();
  const lb = gated ? [] : leaderboard(sg.id, f), mine = myEfforts(sg.id), star = DB.starred.includes(sg.id);
  const myRank = lb.findIndex((e) => e.uid === me());
  const xs = info.prof.map((p) => distVal(p[0])), ys = info.prof.map((p) => S.units === 'imperial' ? p[1] * 3.28 : p[1]);
  const myClubs = DB.clubs.filter((x) => x.members.includes(me()));
  return `${pageHead(esc(sg.name), `${sg.sport === 'ride' ? 'Bicicleta' : 'Corrida'}${sg.creator ? ' · criado por ' + esc(user(sg.creator).name) : ''}`, `<div class="ph-r"><button class="btn btn-sm ${star ? 'btn-secondary' : 'btn-primary'}" ${act('star', { id: sg.id })}>${icon('star', 16)}${star ? 'Com estrela' : 'Marcar'}</button></div>`)}
    <div class="seg-top">
      <section class="card flush">${mapSVG({ lines: [{ xy: info.dense, cls: sg.sport === 'ride' ? 'm-ride' : 'm-run', w: 5 }], markers: [{ kind: 'start', xy: info.dense[0] }, { kind: 'end', xy: info.dense[info.dense.length - 1] }], w: 700, h: 300, pad: 250 })}</section>
      <section class="card"><div class="big-stats sm">${stat('Distância', fmtDist(info.len), distUnit())}${stat('Inclinação média', NF1.format(info.avg * 100), '%')}${stat('Inclinação máx.', NF1.format(info.maxG * 100), '%')}${stat('Desnível', fmtElev(Math.max(0, info.high - info.low)), elevUnit())}</div>
        ${info.cat ? `<span class="pill pill-soft">Subida categoria ${info.cat}</span>` : ''}
        <div class="crowns">
          ${c.kom ? crownBox('KOM', c.kom) : ''}${c.qom ? crownBox('QOM', c.qom) : ''}
          ${c.legend ? `<div class="crown"><span class="medal legend">${icon('fire', 16)}</span><div><div class="xs muted up">Lenda local</div><b>${esc(user(c.legend.uid).name)}</b><div class="xs muted">${c.legend.n} esforços em 90 dias</div></div></div>` : ''}
        </div></section>
    </div>
    <section class="card"><div class="card-h"><h3>Perfil</h3></div>${areaChart(xs, ys, { w: 900, h: 140, fmtX: (v) => NF1.format(v) + ' ' + distUnit(), fmtY: (v) => NF0.format(v), label: 'Perfil do segmento' })}</section>
    ${mine.length ? `<section class="card"><div class="card-h"><h3>Os teus esforços</h3><span class="muted sm">${mine.length}</span></div>
      <div class="pr-box"><span class="medal m1">${icon('medal', 18)}</span><div><div class="xs muted up">Recorde pessoal</div><b class="num big">${fmtDur(mine[0].time)}</b> <span class="muted sm">${DTF_SHORT.format(mine[0].at)}</span></div>${myRank >= 0 ? `<div class="right"><div class="xs muted up">Posição</div><b class="big">${myRank + 1}º</b><span class="muted sm"> de ${lb.length}</span></div>` : ''}</div>
      ${barChart(mine.slice().sort((a, b) => a.at - b.at).slice(-12).map((e) => e.time), mine.slice().sort((a, b) => a.at - b.at).slice(-12).map((e) => DTF_SHORT.format(e.at)), { h: 130, fmt: (v) => fmtDur(v) })}</section>` : ''}
    <section class="card"><div class="card-h"><h3>Classificação</h3><span class="muted sm">${c.athletes} atletas · ${c.total} esforços</span></div>
      <div class="chips">${[['all', 'Geral'], ['f', 'Mulheres'], ['m', 'Homens'], ['year', 'Este ano'], ['following', 'Quem sigo'], ...myClubs.map((x) => ['club:' + x.id, x.name])].map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" ${act('lbFilter', { f: k })}>${esc(l)}${!pro() && !['all', 'f', 'm'].includes(k) ? ' ' + icon('lock', 12) : ''}</button>`).join('')}</div>
      ${gated ? proLock('Filtrar a classificação') : `<div class="tbl-wrap"><table class="tbl lb"><thead><tr><th>#</th><th>Atleta</th><th>Data</th><th>${usesPace(sg.sport) ? 'Ritmo' : 'Velocidade'}</th><th>Tempo</th></tr></thead><tbody>${lb.slice(0, 25).map((e, i) => `<tr class="${e.uid === me() ? 'me' : ''}"><td>${i === 0 ? `<span class="medal gold sm">${icon('crown', 12)}</span>` : i + 1}</td><td><button class="link ath-cell" ${go('profile', { id: e.uid })}>${avatar(e.uid, 24)} ${esc(user(e.uid).name)}</button></td><td class="muted"><button class="link" ${go('activity', { id: e.aid })}>${DTF_SHORT.format(e.at)}</button></td><td class="num">${fmtTempo(sg.sport, info.len, e.time)}</td><td class="num strong">${fmtDur(e.time)}</td></tr>`).join('') || `<tr><td colspan="5" class="muted">Ninguém com este filtro passou por aqui.</td></tr>`}</tbody></table></div>`}
    </section>`;
}
function crownBox(label, e) { return `<div class="crown"><span class="medal gold">${icon('crown', 16)}</span><div><div class="xs muted up">${label}</div><b>${esc(user(e.uid).name)}</b><div class="xs muted num">${fmtDur(e.time)}</div></div></div>`; }

/* ---------- S09 route builder ---------- */
function viewRouteBuilder() {
  const B = RB;
  const d = B.pts.length > 1 ? densify(B.pts, 20) : B.pts;
  const len = B.pts.length > 1 ? pathLength(B.pts) : 0, gain = d.length > 1 ? routeGain(d) : 0;
  const el = d.length > 1 ? (() => { let L = 0; const xs = [], ys = []; d.forEach((p, i) => { if (i) L += Math.hypot(p[0] - d[i - 1][0], p[1] - d[i - 1][1]); xs.push(distVal(L)); ys.push(terrain(p[0], p[1])); }); return { xs, ys }; })() : null;
  return `<div class="rb-page">${pageHead(B.id ? 'Editar rota' : 'Nova rota', 'Clica no mapa para acrescentar pontos')}
    <div class="rb-layout">
      <div class="rb-map card flush">
        <svg id="rb-svg" class="map rb" viewBox="${B.vb.join(' ')}" role="application" aria-label="Editor de rota: clica para acrescentar pontos, arrasta para mover o mapa">${mapLayers(B.vb[0], -B.vb[1] - B.vb[3], B.vb[0] + B.vb[2], -B.vb[1], 900 / B.vb[2])}
          ${d.length > 1 ? `<path d="${polyD(d)}" class="m-halo" stroke-width="${(7 * B.vb[2] / 900).toFixed(1)}"/><path d="${polyD(d)}" class="m-route" stroke-width="${(4 * B.vb[2] / 900).toFixed(1)}"/>` : ''}
          ${B.wps.map((p, i) => `<circle cx="${p[0]}" cy="${-p[1]}" r="${((i === 0 || i === B.wps.length - 1 ? 7 : 4.5) * B.vb[2] / 900).toFixed(1)}" class="${i === 0 ? 'm-start' : i === B.wps.length - 1 ? 'm-end' : 'm-pin'}" stroke-width="${(2 * B.vb[2] / 900).toFixed(1)}"/>`).join('')}
        </svg>
        <div class="rb-tools">
          <button class="icon-btn" data-act="rbZoomIn" aria-label="Aproximar">${icon('zoomin')}</button>
          <button class="icon-btn" data-act="rbZoomOut" aria-label="Afastar">${icon('zoomout')}</button>
        </div>
      </div>
      <aside class="rb-side">
        <section class="card">
          <div class="big-stats sm">${stat('Distância', fmtDist(len), distUnit())}${stat('Desnível', fmtElev(gain), elevUnit())}${stat('Tempo estimado', fmtDur(len / (BASE_SPEED[B.sport] || 3)), '')}</div>
          <label class="switch"><input type="checkbox" id="rb-snap" ${B.snap ? 'checked' : ''} data-change="rbSnap"><span></span>Seguir ruas</label>
          <div class="rb-btns">
            <button class="btn btn-secondary btn-sm" data-act="rbUndo" ${B.wps.length ? '' : 'disabled'}>${icon('undo', 16)}Desfazer</button>
            <button class="btn btn-secondary btn-sm" data-act="rbReverse" ${B.wps.length > 1 ? '' : 'disabled'}>${icon('swap', 16)}Inverter</button>
            <button class="btn btn-secondary btn-sm" data-act="rbOutBack" ${B.wps.length > 1 ? '' : 'disabled'}>${icon('route', 16)}Ida e volta</button>
            <button class="btn btn-secondary btn-sm" data-act="rbLoop" ${B.wps.length > 2 ? '' : 'disabled'}>${icon('route', 16)}Fechar volta</button>
            <button class="btn btn-ghost btn-sm danger" data-act="rbClear" ${B.wps.length ? '' : 'disabled'}>${icon('trash', 16)}Limpar</button>
          </div>
        </section>
        ${el ? `<section class="card">${areaChart(el.xs, el.ys, { w: 420, h: 120, fmtX: (v) => NF1.format(v), fmtY: (v) => NF0.format(v), label: 'Perfil da rota' })}</section>` : ''}
        <form class="card form" data-form="route">
          <label class="fld"><span>Nome da rota</span><input id="rb-name" name="name" required maxlength="60" value="${esc(B.name)}" placeholder="Ex.: Volta do sábado"></label>
          <label class="fld"><span>Desporto</span><select id="rb-sport" name="sport" data-change="rbSport">${Object.entries(SPORTS).filter(([, v]) => v.gps).map(([k, v]) => `<option value="${k}" ${B.sport === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
          <button class="btn btn-primary" ${B.pts.length > 1 ? '' : 'disabled'}>Guardar rota</button>
        </form>
      </aside>
    </div></div>`;
}

/* ---------- S10 profile ---------- */
function viewProfile() {
  const u = user(R.params.id || me()), mine = u.id === me();
  const fam = R.profSport || 'run';
  const acts = activitiesOf(u.id), now = Date.now();
  const famActs = acts.filter((a) => sportFamily(a.sport) === fam);
  const wk = totals(famActs, startOfWeek(now)), yr = totals(famActs, startOfYear(now)), all = totals(famActs, 0);
  const w0 = startOfWeek(now), weeks = [], labels = [];
  for (let i = 11; i >= 0; i--) { const from = w0 - i * 7 * 864e5; weeks.push(distVal(totals(famActs, from, from + 7 * 864e5).dist)); labels.push(DTF_SHORT.format(from)); }
  const trophies = DB.challenges.filter((c) => joined(c.id, u.id) && challengeProgress(c, u.id).done);
  const bestRun = mine || u.id ? (() => { const out = {}; acts.filter((a) => sportFamily(a.sport) === 'run').forEach((a) => analyze(a).best.forEach((b) => { if (!out[b.label] || b.time < out[b.label].time) out[b.label] = { ...b, aid: a.id }; })); return Object.values(out).sort((a, b) => a.len - b.len); })() : [];
  const fo = isFollowing(me(), u.id);
  return `${pageHead(mine ? 'O teu perfil' : esc(u.name), '', mine ? `<div class="ph-r"><button class="icon-btn" ${go('settings')} aria-label="Definições">${icon('settings')}</button></div>` : '', !mine)}
    <section class="card prof-head">${avatar(u, 84)}<div class="grow"><h2>${esc(u.name)}</h2><div class="muted">${esc(u.city || '')}${u.joined ? ' · Membro desde ' + DTF_MONTH.format(u.joined) : ''}</div>${u.bio ? `<p>${esc(u.bio)}</p>` : ''}
      <div class="me-counts left"><button ${go('follows', { id: u.id, tab: 'following' })}><b>${followingOf(u.id).length}</b><span>A seguir</span></button><button ${go('follows', { id: u.id, tab: 'followers' })}><b>${followersOf(u.id).length}</b><span>Seguidores</span></button></div></div>
      ${mine ? `<div class="prof-links"><button class="btn btn-secondary btn-sm" ${go('gear')}>${icon('shoe', 16)}Equipamento</button><button class="btn btn-secondary btn-sm" ${go('training')}>${icon('calendar', 16)}Diário</button></div>` : `<button class="btn ${fo ? 'btn-secondary' : 'btn-primary'}" ${act('follow', { id: u.id })}>${fo ? 'A seguir' : 'Seguir'}</button>`}
    </section>
    <div class="chips">${[['run', 'Corrida'], ['ride', 'Bicicleta'], ['walk', 'Caminhada']].map(([k, l]) => `<button class="chip ${fam === k ? 'on' : ''}" ${act('profSport', { f: k })}>${l}</button>`).join('')}</div>
    <div class="prof-grid">
      <section class="card"><div class="card-h"><h3>Últimas 12 semanas</h3><span class="muted sm">${distUnit()} por semana</span></div>${barChart(weeks, labels, { h: 160, hi: 11, fmt: (v) => NF1.format(v) })}</section>
      <section class="card"><div class="card-h"><h3>Totais</h3></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>Semana</th><th>Ano</th><th>Sempre</th></tr></thead><tbody>
        <tr><td>Atividades</td><td class="num">${wk.count}</td><td class="num">${yr.count}</td><td class="num">${all.count}</td></tr>
        <tr><td>Distância</td><td class="num">${fmtDistU(wk.dist, 1)}</td><td class="num">${fmtDistU(yr.dist, 0)}</td><td class="num">${fmtDistU(all.dist, 0)}</td></tr>
        <tr><td>Tempo</td><td class="num">${fmtDur(wk.time, true)}</td><td class="num">${fmtDur(yr.time, true)}</td><td class="num">${fmtDur(all.time, true)}</td></tr>
        <tr><td>Desnível</td><td class="num">${fmtElevU(wk.gain)}</td><td class="num">${fmtElevU(yr.gain)}</td><td class="num">${fmtElevU(all.gain)}</td></tr></tbody></table></div></section>
    </div>
    ${fam === 'run' && bestRun.length ? `<section class="card"><div class="card-h"><h3>Recordes pessoais</h3></div><div class="pr-grid">${bestRun.map((b) => `<button class="pr-cell" ${go('activity', { id: b.aid })}><span class="muted xs up">${b.label}</span><b class="num">${fmtDur(b.time)}</b></button>`).join('')}</div></section>` : ''}
    <section class="card"><div class="card-h"><h3>Vitrine de troféus</h3><span class="muted sm">${trophies.length}</span></div>${trophies.length ? `<div class="trophies">${trophies.map((c) => `<button class="trophy" ${go('challenge', { id: c.id })}><span class="ch-badge">${icon('medal', 26)}</span><span class="xs">${esc(c.name)}</span></button>`).join('')}</div>` : '<p class="muted sm">Completa desafios para ganhar medalhas.</p>'}</section>
    <h3 class="sec-h">Atividades</h3>
    ${acts.length ? acts.slice(0, R.profLimit || 8).map(activityCard).join('') + (acts.length > (R.profLimit || 8) ? `<button class="btn btn-secondary wide" data-act="profMore">Ver mais</button>` : '') : empty('Sem atividades', mine ? 'Grava a primeira.' : 'Este atleta ainda não tem atividades visíveis.')}`;
}
function viewFollows() {
  const u = user(R.params.id), tab = R.params.tab || 'following';
  const list = tab === 'following' ? followingOf(u.id) : followersOf(u.id);
  return `${pageHead(esc(u.name))}${tabs([['following', `A seguir (${followingOf(u.id).length})`], ['followers', `Seguidores (${followersOf(u.id).length})`]], tab, 'followTab')}<section class="card">${list.length ? list.map(athleteRow).join('') : '<p class="muted">Ninguém por aqui ainda.</p>'}</section>`;
}

/* ---------- S12-S14 training ---------- */
function viewTraining() {
  const tab = R.params.tab || 'calendar';
  let body = '';
  if (tab === 'calendar') body = trainingCalendar();
  else if (tab === 'fitness') body = pro() ? trainingFitness() : proLock('Forma e frescura');
  else body = trainingGoals();
  return `${pageHead('Treino', '', '', false)}${tabs([['calendar', 'Diário'], ['fitness', 'Forma e frescura'], ['goals', 'Objetivos']], tab, 'trainTab')}${body}`;
}
function trainingCalendar() {
  const base = new Date(R.calMonth || startOfMonth(Date.now())), y = base.getFullYear(), m = base.getMonth();
  const first = new Date(y, m, 1), startW = startOfWeek(first.getTime()), daysIn = new Date(y, m + 1, 0).getDate();
  const acts = DB.activities.filter((a) => a.uid === me());
  const mt = totals(acts, first.getTime(), new Date(y, m + 1, 1).getTime());
  let cells = '';
  const weeksN = Math.ceil(((first.getDay() + 6) % 7 + daysIn) / 7);
  for (let w = 0; w < weeksN; w++) {
    let wkTime = 0, row = '';
    for (let d = 0; d < 7; d++) {
      const day = new Date(startW + (w * 7 + d) * 864e5 + 3 * 36e5); day.setHours(0, 0, 0, 0);
      const inM = day.getMonth() === m, today = startOfDay(Date.now()) === day.getTime();
      const da = acts.filter((a) => startOfDay(a.start) === day.getTime());
      wkTime += da.reduce((s, a) => s + analyze(a).moving, 0);
      row += `<div class="cal-d ${inM ? '' : 'out'} ${today ? 'today' : ''}"><span class="cal-n">${day.getDate()}</span>${da.map((a) => { const an = analyze(a), sz = clamp(18 + an.moving / 240, 18, 44); return `<button class="cal-a" style="--sc:${SPORTS[a.sport].color};width:${sz}px;height:${sz}px" ${go('activity', { id: a.id })} title="${esc(a.name)} · ${fmtDur(an.moving, true)}" aria-label="${esc(a.name)}">${icon(SPORTS[a.sport].icon, 14)}</button>`; }).join('')}</div>`;
    }
    cells += `<div class="cal-w">${row}<div class="cal-tot num">${wkTime ? fmtDur(wkTime, true) : ''}</div></div>`;
  }
  return `<section class="card"><div class="cal-head"><button class="icon-btn" ${act('calMonth', { d: -1 })} aria-label="Mês anterior">${icon('back')}</button><h3>${cap(DTF_MONTH.format(first))}</h3><button class="icon-btn flip" ${act('calMonth', { d: 1 })} aria-label="Mês seguinte">${icon('back')}</button></div>
    <div class="mini-stats"><div><b>${mt.count}</b> atividades</div><div><b>${fmtDist(mt.dist, 0)}</b> ${distUnit()}</div><div><b>${fmtDur(mt.time, true)}</b></div><div><b>${fmtElev(mt.gain)}</b> ${elevUnit()}</div></div>
    <div class="cal"><div class="cal-w cal-hd">${['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => `<div>${d}</div>`).join('')}<div>Total</div></div>${cells}</div></section>`;
}
function trainingFitness() {
  const days = R.fitDays || 90, ser = fitnessSeries(DB.activities.filter((a) => a.uid === me()), days);
  const last = ser[ser.length - 1], prev = ser[Math.max(0, ser.length - 8)];
  const formLbl = last.form > 5 ? 'Fresco' : last.form > -10 ? 'Equilibrado' : last.form > -30 ? 'Em carga' : 'Risco de sobrecarga';
  return `<section class="card"><div class="big-stats sm">${stat('Forma física', NF0.format(last.fitness))}${stat('Fadiga', NF0.format(last.fatigue))}${stat('Frescura', NF0.format(last.form))}</div>
    <p class="muted sm">Forma física é a média de 42 dias do teu esforço relativo; fadiga é a média de 7 dias; frescura é a diferença. Estás <b>${formLbl.toLowerCase()}</b>${last.fitness > prev.fitness ? ', e a tua forma subiu na última semana' : ''}.</p>
    <div class="chips">${[[30, '30 dias'], [90, '90 dias'], [180, '6 meses']].map(([k, l]) => `<button class="chip ${days === k ? 'on' : ''}" ${act('fitDays', { d: k })}>${l}</button>`).join('')}</div>
    ${multiLine([{ ys: ser.map((x) => x.fitness), cls: 's-fit', area: true }, { ys: ser.map((x) => x.fatigue), cls: 's-fat' }, { ys: ser.map((x) => x.form), cls: 's-form' }], ser.map((x) => x.day), { fmtX: (d) => DTF_SHORT.format(d), zero: true })}
    <div class="legend"><span><i class="s-fit"></i>Forma física</span><span><i class="s-fat"></i>Fadiga</span><span><i class="s-form"></i>Frescura</span></div></section>
    <section class="card"><div class="card-h"><h3>Esforço relativo por semana</h3></div>${(() => { const w0 = startOfWeek(Date.now()), v = [], l = []; for (let i = 11; i >= 0; i--) { const f = w0 - i * 7 * 864e5; v.push(totals(DB.activities.filter((a) => a.uid === me()), f, f + 7 * 864e5).effort); l.push(DTF_SHORT.format(f)); } return barChart(v, l, { h: 150, hi: 11 }); })()}</section>`;
}
function trainingGoals() {
  return `<section class="card">${DB.goals.length ? DB.goals.map((g) => `<div class="goal-line">${goalRow(g)}<button class="icon-btn sm" ${act('delGoal', { id: g.id })} aria-label="Apagar objetivo">${icon('trash', 16)}</button></div>`).join('') : '<p class="muted">Ainda não tens objetivos.</p>'}</section>
    ${!pro() && DB.goals.length >= 1 ? proLock('Ter mais do que um objetivo') : `<form class="card form" data-form="goal"><h3 class="h-sm">Novo objetivo</h3><div class="form-grid">
      <label class="fld"><span>Período</span><select id="g-period" name="period"><option value="week">Semanal</option><option value="month">Mensal</option><option value="year">Anual</option></select></label>
      <label class="fld"><span>Desporto</span><select id="g-sport" name="sport"><option value="run">Corrida</option><option value="ride">Bicicleta</option><option value="walk">Caminhada</option><option value="all">Todos</option></select></label>
      <label class="fld"><span>Medida</span><select id="g-metric" name="metric"><option value="distance">Distância (${distUnit()})</option><option value="time">Tempo (horas)</option><option value="elevation">Desnível (${elevUnit()})</option></select></label>
      <label class="fld"><span>Meta</span><input id="g-target" name="target" type="number" min="1" step="any" required placeholder="30"></label>
    </div><div class="form-actions"><button class="btn btn-primary">Criar objetivo</button></div></form>`}`;
}

/* ---------- S15-S17 groups ---------- */
function viewGroups() {
  const tab = R.params.tab || 'clubs';
  let body;
  if (tab === 'clubs') {
    const mineC = DB.clubs.filter((c) => c.members.includes(me())), others = DB.clubs.filter((c) => !c.members.includes(me()));
    body = `${mineC.length ? `<h3 class="sec-h">Os teus clubes</h3><div class="club-grid">${mineC.map(clubCard).join('')}</div>` : ''}<h3 class="sec-h">Descobrir</h3><div class="club-grid">${others.map(clubCard).join('') || '<p class="muted">Já estás em todos os clubes.</p>'}</div>`;
  } else {
    const cur = DB.challenges.filter((c) => c.to > Date.now()), past = DB.challenges.filter((c) => c.to <= Date.now() && joined(c.id));
    body = `<div class="ch-grid">${cur.map(challengeCard).join('')}</div>${past.length ? `<h3 class="sec-h">Terminados</h3><div class="ch-grid">${past.map(challengeCard).join('')}</div>` : ''}`;
  }
  return `${pageHead('Grupos', '', '', false)}${tabs([['clubs', 'Clubes'], ['challenges', 'Desafios']], tab, 'groupTab')}${body}`;
}
function clubCard(c) {
  const m = c.members.includes(me());
  return `<article class="card club-card"><button class="cc-top" ${go('club', { id: c.id })}>${clubBadge(c, 52)}<div><b>${esc(c.name)}</b><div class="muted sm">${SPORTS[c.sport].label} · ${esc(c.city)} · ${c.members.length} membros</div></div></button><p class="sm">${esc(c.desc)}</p><button class="btn btn-sm ${m ? 'btn-secondary' : 'btn-primary'}" ${act('club', { id: c.id })}>${m ? 'Membro' : 'Entrar'}</button></article>`;
}
function challengeCard(c) {
  const j = joined(c.id), p = challengeProgress(c);
  const days = Math.ceil((c.to - Date.now()) / 864e5);
  return `<article class="card ch-card"><button class="cc-top" ${go('challenge', { id: c.id })}><span class="ch-badge">${icon(p.done && j ? 'medal' : 'trophy', 26)}</span><div><b>${esc(c.name)}</b><div class="muted sm">${days > 0 ? `Faltam ${days} dias` : 'Terminado'} · ${DB.joins.filter((x) => x[0] === c.id).length} participantes</div></div></button>
    <p class="sm">${esc(c.blurb)}</p>
    ${j ? `<div class="bar lg"><i style="width:${(p.pct * 100).toFixed(0)}%"></i></div><div class="sm muted">${challengeValue(c, p.value)} de ${challengeValue(c, c.target)}${p.done ? ' · <b class="ok">Completo</b>' : ''}</div>` : ''}
    ${c.to > Date.now() ? `<button class="btn btn-sm ${j ? 'btn-secondary' : 'btn-primary'}" ${act('join', { id: c.id })}>${j ? 'Inscrito' : 'Aderir'}</button>` : ''}</article>`;
}
function challengeValue(c, v) { return c.metric === 'elevation' ? fmtElevU(v) : c.metric === 'time' ? fmtDur(v, true) : fmtDistU(v, 1); }
function viewChallenge() {
  const c = DB.challenges.find((x) => x.id === R.params.id); if (!c) return pageHead('Desafio') + empty('Desafio não encontrado', '');
  const parts = DB.joins.filter((x) => x[0] === c.id).map((x) => x[1]);
  const rows = parts.map((u) => ({ u, p: challengeProgress(c, u) })).sort((a, b) => b.p.value - a.p.value);
  return `${pageHead(esc(c.name))}<div class="ch-detail">${challengeCard(c)}
    <section class="card"><div class="card-h"><h3>Participantes</h3></div>${rows.map((r, i) => `<div class="ath-row ${r.u === me() ? 'me' : ''}"><span class="rank">${i + 1}</span>${avatar(r.u, 32)}<span class="grow"><b>${esc(user(r.u).name)}</b><span class="bar"><i style="width:${(r.p.pct * 100).toFixed(0)}%"></i></span></span><span class="num sm">${challengeValue(c, r.p.value)}</span></div>`).join('') || '<p class="muted">Sê o primeiro a aderir.</p>'}</section></div>`;
}
function viewClub() {
  const c = DB.clubs.find((x) => x.id === R.params.id); if (!c) return pageHead('Clube') + empty('Clube não encontrado', '');
  const tab = R.params.tab || 'feed', m = c.members.includes(me());
  let body = '';
  if (tab === 'feed') {
    const posts = DB.posts.filter((p) => p.club === c.id);
    const acts = DB.activities.filter((a) => c.members.includes(a.uid) && canView(a) && sportFamily(a.sport) === sportFamily(c.sport)).sort((a, b) => b.start - a.start).slice(0, 5);
    body = `${m ? `<form class="card comment-form" data-form="post" data-id="${c.id}"><label class="sr" for="post-in">Escrever no clube</label><input id="post-in" name="text" maxlength="1000" placeholder="Escreve uma mensagem para o clube…"><button class="btn btn-primary btn-sm">Publicar</button></form>` : ''}
      ${posts.map((p) => `<section class="card post">${avatar(p.uid, 36)}<div class="grow"><div><b>${esc(user(p.uid).name)}</b> <span class="muted xs">${fmtAgo(p.at)}</span></div><p>${esc(p.text)}</p></div></section>`).join('')}
      <h3 class="sec-h">Atividades recentes dos membros</h3>${acts.map(activityCard).join('') || '<p class="muted">Sem atividades recentes.</p>'}`;
  } else if (tab === 'board') {
    const w0 = startOfWeek(Date.now());
    const rows = c.members.map((u) => ({ u, t: totals(DB.activities.filter((a) => a.uid === u && sportFamily(a.sport) === sportFamily(c.sport)), w0) })).sort((a, b) => b.t.dist - a.t.dist);
    body = `<section class="card"><div class="card-h"><h3>Esta semana</h3><span class="muted sm">Recomeça à segunda-feira</span></div><div class="tbl-wrap"><table class="tbl lb"><thead><tr><th>#</th><th>Atleta</th><th>Distância</th><th>Atividades</th><th>Mais longa</th><th>Desnível</th></tr></thead><tbody>${rows.map((r, i) => { const longest = Math.max(0, ...DB.activities.filter((a) => a.uid === r.u && a.start >= w0 && sportFamily(a.sport) === sportFamily(c.sport)).map((a) => analyze(a).dist)); return `<tr class="${r.u === me() ? 'me' : ''}"><td>${i + 1}</td><td><button class="link ath-cell" ${go('profile', { id: r.u })}>${avatar(r.u, 24)} ${esc(user(r.u).name)}</button></td><td class="num strong">${fmtDistU(r.t.dist, 1)}</td><td class="num">${r.t.count}</td><td class="num">${longest ? fmtDistU(longest, 1) : '–'}</td><td class="num">${fmtElevU(r.t.gain)}</td></tr>`; }).join('')}</tbody></table></div></section>`;
  } else if (tab === 'events') {
    const evs = DB.events.filter((e) => e.club === c.id).sort((a, b) => a.at - b.at);
    body = evs.map((e) => { const going = e.rsvp.includes(me()); const rt = BASE_ROUTES[e.route]; return `<section class="card event"><div class="ev-date"><b>${new Date(e.at).getDate()}</b><span>${new Intl.DateTimeFormat('pt-PT', { month: 'short' }).format(e.at)}</span></div><div class="grow"><b>${esc(e.title)}</b><div class="muted sm">${cap(DTF_WD.format(e.at))}, ${DTF_TIME.format(e.at)} · ${esc(rt.name)} · ${fmtDistU(pathLength(rt.pts), 1)}</div><div class="stack">${e.rsvp.slice(0, 6).map((u) => avatar(u, 24)).join('')} <span class="muted sm">${e.rsvp.length} vão</span></div></div><button class="btn btn-sm ${going ? 'btn-secondary' : 'btn-primary'}" ${act('rsvp', { id: e.id })}>${going ? 'Vou' : 'Inscrever'}</button></section>`; }).join('') || '<p class="muted">Sem eventos marcados.</p>';
  } else body = `<section class="card">${c.members.map(athleteRow).join('')}</section>`;
  return `${pageHead(esc(c.name))}<section class="card club-hero">${clubBadge(c, 72)}<div class="grow"><div class="muted sm">${SPORTS[c.sport].label} · ${esc(c.city)} · ${c.members.length} membros</div><p>${esc(c.desc)}</p></div><button class="btn ${m ? 'btn-secondary' : 'btn-primary'}" ${act('club', { id: c.id })}>${m ? 'Sair do clube' : 'Entrar no clube'}</button></section>
    ${tabs([['feed', 'Feed'], ['board', 'Classificação'], ['events', 'Eventos'], ['members', 'Membros']], tab, 'clubTab')}${body}`;
}

/* ---------- S18 gear ---------- */
function viewGear() {
  const list = gearOf(me());
  return `${pageHead('Equipamento')}${['shoe', 'bike'].map((k) => `<h3 class="sec-h">${k === 'shoe' ? 'Sapatilhas' : 'Bicicletas'}</h3><section class="card">${list.filter((g) => g.kind === k).map((g) => {
    const km = gearKm(g), alert = g.alertKm && km / 1000 >= g.alertKm * 0.9 && !g.retired;
    return `<div class="gear-row ${g.retired ? 'retired' : ''}"><span class="gear-ic">${icon(k === 'shoe' ? 'shoe' : 'bike', 22)}</span><div class="grow"><b>${esc(g.name)}</b>${g.retired ? ' <span class="pill pill-soft">Reformado</span>' : ''}${g.defaultFor ? ` <span class="pill pill-soft">Por omissão: ${SPORTS[g.defaultFor].label}</span>` : ''}<div class="muted sm">${esc(g.brand || '')}</div>${g.alertKm ? `<div class="bar ${alert ? 'warn' : ''}"><i style="width:${clamp(km / 1000 / g.alertKm * 100, 0, 100).toFixed(0)}%"></i></div>` : ''}${alert ? `<div class="warn-t sm">Está perto dos ${fmtDistU(g.alertKm * 1000, 0)} que definiste. Pensa em trocar.</div>` : ''}</div><div class="right"><b class="num">${fmtDistU(km, 0)}</b><button class="link sm" ${act('retire', { id: g.id })}>${g.retired ? 'Reativar' : 'Reformar'}</button></div></div>`;
  }).join('') || '<p class="muted sm">Nada aqui ainda.</p>'}</section>`).join('')}
  <form class="card form" data-form="gear"><h3 class="h-sm">Adicionar equipamento</h3><div class="form-grid">
    <label class="fld"><span>Tipo</span><select id="gr-kind" name="kind"><option value="shoe">Sapatilhas</option><option value="bike">Bicicleta</option></select></label>
    <label class="fld"><span>Nome</span><input id="gr-name" name="name" required maxlength="60" placeholder="Ex.: Sapatilhas de prova"></label>
    <label class="fld"><span>Marca e modelo</span><input id="gr-brand" name="brand" maxlength="60"></label>
    <label class="fld"><span>Avisar aos (${distUnit()})</span><input id="gr-alert" name="alert" type="number" min="0" placeholder="700"></label>
    <label class="fld"><span>Usar por omissão em</span><select id="gr-def" name="defaultFor"><option value="">Nenhum</option><option value="run">Corrida</option><option value="trail_run">Trail</option><option value="ride">Bicicleta</option><option value="walk">Caminhada</option></select></label>
  </div><div class="form-actions"><button class="btn btn-primary">Adicionar</button></div></form>`;
}

/* ---------- S19 notifications ---------- */
function viewNotifications() {
  const list = DB.notifications.slice().sort((a, b) => b.at - a.at);
  const txt = (n) => n.kind === 'kudos' ? `deu kudos a <b>${esc(activity(n.ref)?.name || 'uma atividade')}</b>` : n.kind === 'comment' ? `comentou <b>${esc(activity(n.ref)?.name || 'uma atividade')}</b>` : n.kind === 'follow' ? 'começou a seguir-te' : n.kind === 'challenge' ? `Completaste o desafio <b>${esc(DB.challenges.find((c) => c.id === n.ref)?.name || '')}</b>` : '';
  return `${pageHead('Notificações', '', list.some((n) => !n.read) ? `<div class="ph-r"><button class="btn btn-ghost btn-sm" data-act="readAll">Marcar todas como lidas</button></div>` : '')}
    <section class="card">${list.length ? list.map((n) => `<button class="notif ${n.read ? '' : 'unread'}" ${n.ref && n.kind !== 'challenge' ? go('activity', { id: n.ref }) : n.kind === 'challenge' ? go('challenge', { id: n.ref }) : go('profile', { id: n.actor })}>${n.kind === 'challenge' ? `<span class="ch-badge sm">${icon('medal', 18)}</span>` : avatar(n.actor, 36)}<span class="grow left">${n.kind === 'challenge' ? '' : `<b>${esc(user(n.actor).name)}</b> `}${txt(n)}<span class="muted xs block">${fmtAgo(n.at)}</span></span>${n.kind === 'kudos' ? icon('kudos', 18, 'acc') : n.kind === 'comment' ? icon('comment', 18, 'acc') : ''}</button>`).join('') : '<p class="muted">Sem notificações.</p>'}</section>`;
}

/* ---------- S20 search ---------- */
function viewSearch() {
  const q = (R.q || '').trim().toLowerCase();
  const res = DB.users.filter((u) => u.id !== me() && (!q || u.name.toLowerCase().includes(q) || (u.city || '').toLowerCase().includes(q)));
  const segs = q ? DB.segments.filter((s) => s.name.toLowerCase().includes(q)) : [];
  const clubs = q ? DB.clubs.filter((c) => c.name.toLowerCase().includes(q)) : [];
  return `${pageHead('Procurar')}<div class="search-box">${icon('search')}<label class="sr" for="q">Procurar atletas, clubes e segmentos</label><input id="q" type="search" value="${esc(R.q || '')}" placeholder="Nome, cidade, clube ou segmento" data-input="q" autocomplete="off"></div>
    <section class="card"><div class="card-h"><h3>${q ? 'Atletas' : 'Pessoas que talvez conheças'}</h3></div>${res.map(athleteRow).join('') || `<p class="muted">Nenhum atleta com «${esc(R.q)}».</p>`}</section>
    ${clubs.length ? `<section class="card"><div class="card-h"><h3>Clubes</h3></div>${clubs.map((c) => `<button class="row-btn" ${go('club', { id: c.id })}>${clubBadge(c, 32)}<span>${esc(c.name)}</span></button>`).join('')}</section>` : ''}
    ${segs.length ? `<section class="card"><div class="card-h"><h3>Segmentos</h3></div>${segs.map(segmentRow).join('')}</section>` : ''}`;
}

/* ---------- S21 settings ---------- */
function viewSettings() {
  const st = DB.settings, u = user(me()), z = st.privacyZone;
  return `${pageHead('Definições')}
    <form class="card form" data-form="profile"><h3 class="h-sm">Perfil</h3><div class="form-grid">
      <label class="fld"><span>Nome</span><input id="s-name" name="name" required maxlength="80" value="${esc(u.name)}"></label>
      <label class="fld"><span>Cidade</span><input id="s-city" name="city" maxlength="60" value="${esc(u.city || '')}"></label>
      <label class="fld"><span>Sexo (para as classificações)</span><select id="s-sex" name="sex"><option value="m" ${u.sex === 'm' ? 'selected' : ''}>Masculino</option><option value="f" ${u.sex === 'f' ? 'selected' : ''}>Feminino</option><option value="x" ${u.sex === 'x' ? 'selected' : ''}>Prefiro não dizer</option></select></label></div>
      <label class="fld"><span>Biografia</span><input id="s-bio" name="bio" maxlength="160" value="${esc(u.bio || '')}"></label>
      <div class="form-actions"><button class="btn btn-primary btn-sm">Guardar perfil</button></div></form>
    <section class="card form"><h3 class="h-sm">Preferências</h3>
      <div class="seg-ctl" role="radiogroup" aria-label="Unidades"><label><input type="radio" name="units" value="metric" ${st.units === 'metric' ? 'checked' : ''} data-change="units"><span>Quilómetros</span></label><label><input type="radio" name="units" value="imperial" ${st.units === 'imperial' ? 'checked' : ''} data-change="units"><span>Milhas</span></label></div>
      <label class="fld"><span>Visibilidade por omissão das novas atividades</span><select id="s-vis" data-change="defVis">${[['everyone', 'Todos'], ['followers', 'Só seguidores'], ['only_me', 'Só eu']].map(([k, l]) => `<option value="${k}" ${st.defaultVisibility === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    </section>
    <section class="card form"><h3 class="h-sm">Zona de privacidade</h3><p class="muted sm">Esconde o início e o fim das tuas atividades à volta de um local, como a tua casa. Tu continuas a ver o percurso completo.</p>
      <label class="switch"><input type="checkbox" id="s-zone" ${z.on ? 'checked' : ''} data-change="zoneOn"><span></span>Zona ativa</label>
      <label class="fld"><span>Raio: ${fmtDistU(z.radius, 1)}</span><input type="range" id="s-radius" min="200" max="1600" step="100" value="${z.radius}" data-change="zoneR"></label>
      ${mapSVG({ lines: activitiesOf(me()).filter((a) => trackOf(a)).slice(0, 6).map((a) => ({ xy: xyOf(a), w: 2.4, noHalo: true, cls: 'm-faint' })), markers: [{ kind: 'zone', xy: [z.x, z.y], radius: z.radius }], w: 700, h: 240, bbox: [z.x - 2400, z.y - 900, z.x + 2400, z.y + 900] })}
    </section>
    <section class="card form"><h3 class="h-sm">Plano</h3>
      <div class="plans"><div class="plan ${!st.pro ? 'on' : ''}"><b>Gratuito</b><span class="muted sm">Gravar, feed, kudos, segmentos, clubes, desafios, rotas.</span></div><div class="plan ${st.pro ? 'on' : ''}"><b>Pro</b><span class="muted sm">Forma e frescura, filtros nas classificações, heatmap, atividades no mesmo percurso, localização em direto, objetivos ilimitados.</span></div></div>
      <label class="switch"><input type="checkbox" id="s-pro" ${st.pro ? 'checked' : ''} data-change="pro"><span></span>Plano Pro ativo (demonstração, sem pagamento)</label></section>
    <section class="card form"><h3 class="h-sm">Dados</h3><p class="muted sm">Nesta versão de demonstração tudo fica guardado só neste navegador. Atletas, clubes e atividades de exemplo são fictícios.</p>
      <div class="rb-btns"><button class="btn btn-ghost danger btn-sm" data-act="resetAsk">Repor dados de exemplo</button></div>
      ${R.confirm ? `<div class="confirm"><p>${R.confirm.text}</p><div><button class="btn btn-secondary btn-sm" data-act="confirmNo">Cancelar</button><button class="btn btn-danger btn-sm" data-act="confirmYes">${R.confirm.yes}</button></div></div>` : ''}
    </section>`;
}
