'use strict';
// Кооп-забег до 5 героев — клиент (КООП_ЗАБЕГ.md §2.2). Сервер: server/rooms.js + server/runroom.js.
//  • В Таверне отряда (только в кооп-деревне): «Собрать отряд» — комната с кодом из 4 букв, вход по коду или из списка,
//    готовность, старт у ведущего.
//  • В забеге бой считает сервер: сюда приходят карта этажа и снимки 10 раз в секунду, отсюда уходит только ввод.
//    Свой герой двигается сразу (предсказание по той же карте), остальные — плавно между снимками.
//  • Обрыв связи: сервер держит героя под щитом минуту; после переподключения клиент сам возвращается в комнату.

const RN = { room: null, list: [], el: null, err: '', snaps: [], ws: null, lastSend: 0, sent: [0, 0], code: '' };

// ---------- сообщения сервера ----------
{
  const _h = coopHandle;
  coopHandle = function (m) {
    if (m.t === 'room') { rnRoomMsg(m); return; }
    if (m.t === 'run') { rnRunMsg(m); return; }
    return _h(m);
  };
}
function rnRoomMsg(m) {
  if (m.a === 'err') { RN.err = m.msg; RSfx.play('ui'); }
  if (m.a === 'ok' || m.a === 'state') { RN.room = m.room; RN.err = ''; if (m.room) RN.code = m.room.code; }
  if (m.a === 'left') { RN.room = null; RN.code = ''; }
  if (m.a === 'list') RN.list = m.rooms || [];
  if (RN.room && RN.room.state === 'over' && !Run.on) RN.room = null;
  if (RN.el) rnDraw();
}
function rnRunMsg(m) {
  if (m.a === 'go') {
    if (RN.el) { RN.el.remove(); RN.el = null; }
    if (Run.on && Run.net) { Object.assign(Run.net, m); Run.me = m.me; Run.S.heroes.length = 0; return; }   // вернулись после обрыва
    if (Run.on) runClose();
    if (Tav.open) tavernClose();
    RN.snaps = []; RN.ws = Coop.ws;
    runStart({ id: m.diff.id, name: m.diff.name, floors: m.diff.floors, mult: m.diff.mult, lvl: m.diff.lvl }, { net: m });
    return;
  }
  if (!Run.on || !Run.net) return;
  const S = Run.S;
  if (m.a === 'floor') {
    S.map = new Uint8Array(m.map.length); for (let i = 0; i < m.map.length; i++) S.map[i] = m.map.charCodeAt(i) === 49 ? 1 : 0;
    S.floor = m.f; S.boss = m.boss;
    S.props = m.props.map(([k, x, y, ph]) => ({ k, x, y, ph, used: false, on: false }));
    S.stairs = { x: m.stairs[0], y: m.stairs[1], open: false };
    S.rescue = m.rescue ? { x: m.rescue[0], y: m.rescue[1], kind: m.rescue[2] } : null;
    RN.snaps = []; Run.predict = null;
    S.pick = null; Run.pickShown = false; Run.el.querySelector('#run-pick').style.display = 'none';
  } else if (m.a === 's') {
    if (m.f !== S.floor) return;
    m.at = performance.now();
    RN.snaps.push(m); if (RN.snaps.length > 4) RN.snaps.shift();
    for (const e of m.ev || []) {
      if (e.k === 'sfx') RSfx.play(e.n, e.vol);
      else if (e.k === 'pop') Run.pops.push({ x: e.x, y: e.y, text: e.text, col: e.col, t: 0.8 });
      else if (e.k === 'flash') Run.flash = Math.max(Run.flash, e.v);
      else if (e.k === 'msg') { Run.msg = e.text; Run.msgT = e.t; }
      else if (e.k === 'pal' && RUN_PALS[e.kind]) { Run.msg = 'Новый напарник: ' + RUN_PALS[e.kind][0]; Run.msgT = 2.4; }
    }
    if (m.sw) { Run.msg = `Отряд, к лестнице! ${m.sw}`; Run.msgT = 0.5; }
    if (m.pk && m.pk[Run.me] === 1 && !S.pick && !RN.waitMsg) { Run.msg = `Ждём остальных… ${m.pt}`; Run.msgT = 0.5; }
  } else if (m.a === 'pick') {
    S.pick = { opts: [], got: [] }; S.pick.opts[Run.me] = m.opts; Run.pickShown = false;
  } else if (m.a === 'over') rnOver(m);
}

// ---------- вид забега по снимкам ----------
function runNetBlank(go) {
  return { t: 0, floor: 0, diff: go.diff, n: go.n, map: new Uint8Array(RS_W * RS_H), heroes: [], pals: [], enemies: [], shots: [], drops: [], props: [], stairs: { x: -999, y: 0, open: false }, rescue: null, pick: null, over: null, kills: 0, ev: [] };
}
const RN_DELAY = 110;   // остальных рисуем с отставанием на один снимок — так движение ровное
function rnLerp(a, b, k) { return a + (b - a) * k; }
function rnView(dt) {
  const S = Run.S, L = RN.snaps;
  if (!L.length) return;
  const now = performance.now() - RN_DELAY;
  let a = L[0], b = L[L.length - 1];
  for (let i = 0; i < L.length - 1; i++) if (L[i].at <= now && L[i + 1].at >= now) { a = L[i]; b = L[i + 1]; }
  const k = b.at > a.at ? Math.max(0, Math.min(1, (now - a.at) / (b.at - a.at))) : 1, last = L[L.length - 1];
  S.t = rnLerp(a.tm, b.tm, k); S.kills = last.k;
  const cl = Run.net.cloaks || [];
  S.heroes = b.h.map((hb, i) => {
    const ha = a.h[i] || hb, f = hb[5];
    return { x: rnLerp(ha[0], hb[0], k), y: rnLerp(ha[1], hb[1], k), hp: hb[2], max: hb[3], face: hb[4], down: !!(f & 1), away: !!(f & 2), gone: !!(f & 4), moving: !!(f & 8), swing: f & 16 ? 0.1 : 0, hit: f & 32 ? 0.1 : 0, inv: 0, rev: hb[6] / 10, gold: hb[7], slam: hb[8] / 100, spd: hb[9], dashing: !!hb[10], cloak: cl[i] | 0, sk: (Run.net.sks || [])[i] || null };
  });
  // свой герой — из предсказания
  const me = S.heroes[Run.me], P = Run.predict;
  if (me && P && !me.down && !me.gone) { me.x = P.x; me.y = P.y; me.face = P.face; me.moving = P.moving; }
  S.pals = b.p.map((pb, i) => { const pa = a.p[i] || pb; return { x: rnLerp(pa[0], pb[0], k), y: rnLerp(pa[1], pb[1], k), hp: pb[2], max: pb[3], kind: pb[4], dead: !!pb[5], moving: !!pb[6], owner: pb[7], hit: 0 }; });
  const ea = new Map(a.e.map(e => [e[7], e]));
  S.enemies = b.e.map(eb => { const e0 = ea.get(eb[7]) || eb; return { kind: ['skel', 'raven', 'malgor'][eb[0]] || 'skel', x: rnLerp(e0[1], eb[1], k), y: rnLerp(e0[2], eb[2], k), hp: eb[3], max: eb[4], hit: eb[5] ? 0.1 : 0, cd: eb[6] ? 1 : 0, boss: eb[0] === 2 }; });
  const ago = (performance.now() - last.at) / 1000;
  S.shots = last.s.map(s => ({ x: s[0] + s[4] * ago, y: s[1] + s[5] * ago, own: s[2] ? 'e' : 'p', r: s[3] }));
  S.drops = last.d.map(d => ({ x: d[0], y: d[1] }));
  last.pr.forEach((v, i) => { const q = S.props[i]; if (q) { q.used = !!(v & 1); q.on = !!(v & 2); } });
  S.stairs.open = !!last.st;
}
// свой герой двигается сразу по той же карте; расхождение с сервером мягко подтягивается
function rnPredict(dt, mx, my, dash) {
  const S = Run.S, L = RN.snaps; if (!L.length) return;
  const sv = L[L.length - 1].h[Run.me]; if (!sv) return;
  let P = Run.predict;
  if (!P) P = Run.predict = { x: sv[0], y: sv[1], face: sv[4], dash: 0, moving: false };
  const f = sv[5];
  if (f & 5) { P.x = sv[0]; P.y = sv[1]; return; }   // лежит или выбыл — без предсказания
  P.dash -= dt; if (dash) P.dash = 0.16;
  let ix = mx / 8, iy = my / 8; const d = Math.sqrt(ix * ix + iy * iy); if (d > 1) { ix /= d; iy /= d; }
  const sp = (P.dash > 0 ? sv[9] * 4 : sv[9]) * dt;
  if (ix) P.face = ix > 0 ? 1 : -1;
  P.moving = d > 0.1;
  rnMoveLocal(S, P, ix * sp, iy * sp);
  const ex = sv[0] - P.x, ey = sv[1] - P.y, err = Math.sqrt(ex * ex + ey * ey);
  if (err > 28) { P.x = sv[0]; P.y = sv[1]; }
  else if (!P.moving || err > 6) { const k = Math.min(1, dt * (P.moving ? 3 : 8)); P.x += ex * k; P.y += ey * k; }
}
function rnMoveLocal(S, o, dx, dy) {
  const solid = (x, y) => { const i = Math.floor(x / RS_T), j = Math.floor(y / RS_T); return i < 0 || j < 0 || i >= RS_W || j >= RS_H || !S.map[j * RS_W + i]; };
  const ok = (x, y) => !(solid(x - 4, y - 4) || solid(x + 4, y - 4) || solid(x - 4, y + 4) || solid(x + 4, y + 4));
  if (ok(o.x + dx, o.y)) o.x += dx;
  if (ok(o.x, o.y + dy)) o.y += dy;
}
function runNetFrame(dt) {
  const S = Run.S;
  Run.flash = Math.max(0, Run.flash - dt);
  for (let i = Run.pops.length - 1; i >= 0; i--) { const p = Run.pops[i]; p.t -= dt; p.y -= 14 * dt; if (p.t <= 0) Run.pops.splice(i, 1); }
  // связь переподключилась — возвращаемся в свою комнату
  if (Coop.ws && RN.ws !== Coop.ws && Coop.ws.readyState === 1 && RN.code) { RN.ws = Coop.ws; coopSend({ t: 'room', a: 'join', code: RN.code }); }
  const [mx, my] = runInput(), dash = Run.press.dash, slam = Run.press.slam;
  Run.press.dash = Run.press.slam = false;
  if (!S.over && !S.pick) {
    const t = performance.now();
    if (dash || slam || ((mx !== RN.sent[0] || my !== RN.sent[1]) && t - RN.lastSend > 33)) {
      coopSend({ t: 'run', a: 'in', mx, my, d: dash ? 1 : 0, s: slam ? 1 : 0 });
      RN.sent = [mx, my]; RN.lastSend = t;
    }
    rnPredict(dt, mx, my, dash);
  }
  rnView(dt);
  if (S.pick && !Run.pickShown) runPickShow();
}

// ---------- итог ----------
function rnOver(m) {
  const S = Run.S; if (S.over) return;
  S.over = { win: m.win, quit: !!m.quit };
  RSfx.play(m.win ? 'win' : 'lose'); RSfx.ambStop();
  const meta = runMeta(), rw = m.rw;
  meta.runs++; meta.stones += rw.stones | 0; meta.shards += rw.shards | 0;
  if (m.win) meta.wins++;
  meta.kills = (meta.kills | 0) + ((Run.S.heroes[Run.me] || {}).kills | 0);
  meta.best = Math.max(meta.best, rw.floors | 0);
  meta.coopRuns = (meta.coopRuns || 0) + 1; meta.coopMax = Math.max(meta.coopMax || 0, Run.net.n | 0);
  if (!m.win) meta.hurtUntil = Date.now() + 60000;
  runMetaSave(meta);
  RN.code = ''; RN.room = null;
  Run.shown = true;
  const box = Run.el.querySelector('#run-pick'); box.style.display = 'flex';
  box.innerHTML = `<div style="text-align:center;color:#f1dfb0;font-family:sans-serif"><div style="font-size:30px;font-weight:700">${m.win ? 'Отряд одолел Малгора!' : m.quit ? 'Вы вернулись в таверну' : 'Отряд пал'}</div>
    <p style="font-size:15px">Этажей: ${m.floors} · Убито отрядом: ${m.kills} · Героев: ${Run.net.n}<br>Награда: 💎 ${rw.stones}${rw.shards ? ` ◆ ${rw.shards}` : ''}${Run.net.n > 1 ? ` (бонус отряда +${Math.min(4, Run.net.n - 1) * 10}%)` : ''}</p>
    <button id="run-back" style="padding:10px 22px;background:#3a2410;color:#f1dfb0;border:2px solid #b8902c;border-radius:8px;cursor:pointer;font-size:16px">В таверну</button></div>`;
  box.querySelector('#run-back').onclick = () => { runClose(); tavernOpen(); };
}

// ---------- окно «Собрать отряд» в Таверне ----------
function rnOpen() {
  if (!(typeof Coop !== 'undefined' && Coop.on)) { tavernSay('Отряд собирают в общей деревне. Позови друзей — тогда и спустимся вместе.'); return; }
  const box = document.createElement('div');
  box.style.cssText = 'position:absolute;inset:0;z-index:6;background:#000b;display:flex;align-items:center;justify-content:center;padding:8px;overflow:auto';
  Tav.el.appendChild(box);
  RN.el = box; RN.err = '';
  const metaOut = () => { const m = runMeta(); return { ups: m.ups, weapon: m.weapon, pal: m.pal, cloak: m.cloak, sk: skWorn(m) }; };
  box.onclick = e => {
    const t = e.target.closest('[data-rn]'); if (!t || t.disabled) return;
    const a = t.dataset.rn;
    if (a === 'x') { box.remove(); RN.el = null; return; }
    if (a === 'create') coopSend({ t: 'room', a: 'create', diff: RN.diff || 'dive', lvl: Math.max(1, Math.min(5, runMeta().wins)), meta: metaOut() });
    if (a === 'join') { const code = (box.querySelector('#rn-code').value || t.dataset.code || '').trim(); if (code) coopSend({ t: 'room', a: 'join', code, meta: metaOut() }); }
    if (a === 'jl') coopSend({ t: 'room', a: 'join', code: t.dataset.code, meta: metaOut() });
    if (a === 'ready') { const me = RN.room && RN.room.members.find(x => x.nick === Coop.nick); coopSend({ t: 'room', a: 'ready', on: !(me && me.ready), meta: metaOut() }); }
    if (a === 'start') coopSend({ t: 'room', a: 'start' });
    if (a === 'leave') coopSend({ t: 'room', a: 'leave' });
    if (a === 'diff') { RN.diff = t.dataset.d; if (RN.room) coopSend({ t: 'room', a: 'opts', diff: RN.diff, lvl: Math.max(1, Math.min(5, runMeta().wins)) }); rnDraw(); }
    if (a === 'list') coopSend({ t: 'room', a: 'list' });
    RSfx.play('ui');
  };
  coopSend({ t: 'room', a: 'list' });
  rnDraw();
}
function rnDraw() {
  const box = RN.el; if (!box) return;
  const R = RN.room, btn = 'padding:6px 12px;background:#3a2410;color:#f1dfb0;border:1px solid #b8902c;border-radius:6px;cursor:pointer';
  const esc = t => String(t).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const DN = { walk: 'Прогулка', dive: 'Спуск', curse: 'Проклятие' }, wins = runMeta().wins;
  let body;
  if (!R) {
    const diffs = ['walk', 'dive'].concat(wins ? ['curse'] : []);
    body = `<p style="margin:4px 0 8px">До пяти героев спускаются вместе. Враги в отряде злее, а камней каждому больше: +10% за товарища.</p>
      <div style="margin-bottom:6px">${diffs.map(d => `<button data-rn="diff" data-d="${d}" style="${btn};${(RN.diff || 'dive') === d ? 'background:#6a4a1a' : ''}">${DN[d]}</button>`).join(' ')}</div>
      <button data-rn="create" style="${btn};width:100%;margin-bottom:10px"><b>Собрать отряд</b> — получить код для друзей</button>
      <div style="display:flex;gap:6px;align-items:center"><input id="rn-code" maxlength="4" placeholder="КОД" style="width:80px;text-transform:uppercase;background:#1a0f08;color:#f1dfb0;border:1px solid #b8902c;border-radius:4px;padding:5px 8px;font-size:16px;letter-spacing:2px"><button data-rn="join" style="${btn}">Войти по коду</button></div>
      <div style="margin-top:10px;font-size:13px">Открытые отряды <button data-rn="list" style="${btn};padding:2px 8px;font-size:12px">обновить</button></div>
      ${RN.list.length ? RN.list.map(r => `<div style="display:flex;justify-content:space-between;align-items:center;margin:4px 0"><span>${esc(r.members[0] ? r.members[0].nick : '?')} · ${DN[r.opts.diff] || ''} · ${r.members.length}/${r.max}</span><button data-rn="jl" data-code="${esc(r.code)}" style="${btn};padding:3px 10px">Войти</button></div>`).join('') : '<p style="opacity:.7;font-size:13px">Пока никого — соберите свой.</p>'}`;
  } else {
    const me = R.members.find(x => x.nick === Coop.nick), iLead = R.leader === Coop.nick;
    const allReady = R.members.filter(x => !x.away).every(x => x.ready);
    body = `<div style="font-size:15px">Код отряда: <b style="font-size:24px;letter-spacing:4px;color:#ffd84a">${esc(R.code)}</b></div>
      <div style="font-size:13px;opacity:.85;margin-bottom:6px">${DN[R.opts.diff] || 'Спуск'} · скажите код друзьям</div>
      ${R.members.map(x => `<div style="margin:3px 0">${x.ready ? '✅' : '⬜'} ${esc(x.nick)}${x.away ? ' (нет связи)' : ''}</div>`).join('')}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
        <button data-rn="ready" style="${btn}">${me && me.ready ? 'Не готов' : 'Готов!'}</button>
        ${iLead ? `<button data-rn="start" ${allReady ? '' : 'disabled'} style="${btn};${allReady ? '' : 'opacity:.5'}">В подземелье!</button>` : '<span style="align-self:center;font-size:13px;opacity:.8">Начинает тот, кто собрал отряд</span>'}
        <button data-rn="leave" style="${btn}">Выйти из отряда</button></div>`;
  }
  box.innerHTML = `<div style="background:#2a1a0e;border:2px solid #b8902c;border-radius:8px;padding:14px;max-width:420px;width:100%;color:#f1dfb0">
    <div style="font-size:18px;font-weight:700;margin-bottom:4px">Отряд в подземелье</div>${body}
    <div style="color:#ffb0a0;font-size:13px;min-height:16px;margin-top:6px">${esc(RN.err || '')}</div>
    <div style="text-align:right"><button data-rn="x" style="${btn}">Закрыть</button></div></div>`;
}
