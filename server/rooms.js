'use strict';
// Комнаты на сервере — общий кусок для кооп-забега (server/runroom.js) и арены (АРЕНА.md, решение 22.9).
// Комната: до max участников, код входа из 4 букв, готовность, ведущий, ровный тик в игре,
// пауза по связи (участник «отошёл» и ждёт возврата grace мс), закрытие пустых и брошенных комнат.
// Сама игра в комнате — в хуках вида (kind): start(room), tick(room, dt), drop(room, member), end(room), join/leave.
// Участник: { key, nick, send(obj), ready, away, awayAt }. Ключ — аккаунт игрока, по нему возвращаются после обрыва.

const CODE_ABC = 'АБВГДЕЖИКЛМНПРСТУФХЦШЭЮЯ';   // без похожих на латиницу и цифры букв — код легко продиктовать

function createRooms(opts) {
  const o = Object.assign({ maxRooms: 6, hz: 20, grace: 60000, idle: 10 * 60000, log: () => {}, now: () => Date.now(), kinds: {} }, opts);
  const rooms = new Map();            // код → комната
  const byKey = new Map();            // ключ игрока → код комнаты
  let timer = null, last = 0;

  function code() {
    for (let k = 0; k < 200; k++) { let s = ''; for (let i = 0; i < 4; i++) s += CODE_ABC[(Math.random() * CODE_ABC.length) | 0]; if (!rooms.has(s)) return s; }
    return null;
  }
  const kindOf = r => o.kinds[r.kind] || {};
  const pub = r => ({ code: r.code, kind: r.kind, state: r.state, leader: (r.members.get(r.leader) || {}).nick || null,   // наружу — ник ведущего, не ключ аккаунта
     max: r.max, opts: r.opts, members: [...r.members.values()].map(m => ({ nick: m.nick, ready: !!m.ready, away: !!m.away })) });
  function tell(r, obj, exceptKey) { for (const m of r.members.values()) if (!m.away && m.key !== exceptKey) { try { m.send(obj); } catch (e) { /* связь уже рвётся */ } } }
  const lobby = r => tell(r, { t: 'room', a: 'state', room: pub(r) });

  function create(kind, m, ropts) {
    if (!o.kinds[kind]) return { err: 'нет такой комнаты' };
    if (byKey.has(m.key)) return { err: 'вы уже в комнате' };
    if (rooms.size >= o.maxRooms) return { err: 'все комнаты заняты, попробуйте через пару минут' };
    if (o.busy && o.busy()) return { err: 'сервер сейчас нагружен — новые комнаты чуть позже' };
    const c = code(); if (!c) return { err: 'не нашлось свободного кода' };
    const max = Math.max(1, Math.min((kindOf({ kind }).max || 5), (ropts && ropts.max) | 0 || 5));
    const r = { code: c, kind, max, state: 'lobby', leader: m.key, members: new Map(), opts: ropts || {}, created: o.now(), touched: o.now(), game: null };
    rooms.set(c, r);
    add(r, m);
    ensureTimer();   // тик нужен и в лобби: чистит брошенные комнаты
    o.log(`комната ${c} (${kind}): создал ${m.nick}`);
    return { room: r };
  }
  function add(r, m) {
    r.members.set(m.key, { key: m.key, nick: m.nick, send: m.send, ready: false, away: false, awayAt: 0 });
    byKey.set(m.key, r.code); r.touched = o.now();
    if (kindOf(r).join) kindOf(r).join(r, r.members.get(m.key));
    lobby(r);
  }
  function join(cd, m) {
    const r = rooms.get(String(cd || '').toUpperCase().trim());
    if (!r) return { err: 'комнаты с таким кодом нет' };
    const old = r.members.get(m.key);
    if (old) {   // вернулся после обрыва — та же комната, то же место
      old.send = m.send; old.away = false; old.awayAt = 0; r.touched = o.now();
      if (kindOf(r).back) kindOf(r).back(r, old);
      lobby(r);
      return { room: r, back: true };
    }
    if (byKey.has(m.key)) return { err: 'вы уже в другой комнате' };
    if (r.state !== 'lobby') return { err: 'отряд уже в пути' };
    if (r.members.size >= r.max) return { err: 'комната полна' };
    add(r, m);
    return { room: r };
  }
  function roomOf(key) { const c = byKey.get(key); return c ? rooms.get(c) : null; }
  function leave(key, why) {
    const r = roomOf(key); if (!r) return;
    const m = r.members.get(key);
    r.members.delete(key); byKey.delete(key);
    if (m && kindOf(r).leave) kindOf(r).leave(r, m, why || 'leave');
    if (r.leader === key) { const next = [...r.members.values()].find(x => !x.away) || [...r.members.values()][0]; r.leader = next ? next.key : null; }
    if (!r.members.size) close(r, 'пусто');
    else lobby(r);
  }
  function ready(key, on) {
    const r = roomOf(key); if (!r || r.state !== 'lobby') return;
    const m = r.members.get(key); m.ready = !!on; r.touched = o.now();
    lobby(r);
  }
  function setOpts(key, ropts) {
    const r = roomOf(key); if (!r || r.state !== 'lobby' || r.leader !== key) return;
    r.opts = Object.assign({}, r.opts, ropts); for (const m of r.members.values()) m.ready = false;
    lobby(r);
  }
  // старт: только ведущий и только когда готовы все, кто на месте
  function start(key) {
    const r = roomOf(key);
    if (!r || r.state !== 'lobby') return { err: 'нет комнаты' };
    if (r.leader !== key) return { err: 'начинает ведущий' };
    const ms = [...r.members.values()].filter(m => !m.away);
    if (!ms.length || ms.some(m => !m.ready)) return { err: 'не все готовы' };
    r.state = 'play'; r.touched = o.now();
    kindOf(r).start(r);
    lobby(r);
    ensureTimer();
    return { room: r };
  }
  function finish(r) {
    if (r.state === 'over') return;
    r.state = 'over'; r.touched = o.now();
    if (kindOf(r).end) kindOf(r).end(r);
    lobby(r);
  }
  function close(r, why) {
    if (!rooms.has(r.code)) return;
    if (r.state === 'play') finish(r);
    for (const k of r.members.keys()) byKey.delete(k);
    rooms.delete(r.code);
    o.log(`комната ${r.code} закрыта (${why})`);
  }
  // обрыв связи: участник «отходит», через grace — выбывает
  function detach(key) {
    const r = roomOf(key); if (!r) return;
    const m = r.members.get(key);
    if (r.state === 'lobby') { leave(key, 'обрыв'); return; }
    m.away = true; m.awayAt = o.now();
    if (kindOf(r).away) kindOf(r).away(r, m);
    lobby(r);
  }

  function ensureTimer() {
    if (timer) return;
    last = o.now();
    timer = setInterval(loop, Math.round(1000 / o.hz));
    if (timer.unref) timer.unref();
  }
  function loop() {
    const t = o.now(), dt = Math.min(0.25, (t - last) / 1000); last = t;
    let playing = 0;
    for (const r of [...rooms.values()]) {
      for (const m of [...r.members.values()]) if (m.away && t - m.awayAt > o.grace) leave(m.key, 'не вернулся');
      if (!rooms.has(r.code)) continue;
      if (r.state === 'play') {
        playing++;
        try { kindOf(r).tick(r, dt); } catch (e) { o.log(`комната ${r.code}: ошибка шага`, e && e.stack || e); finish(r); }
      }
      if (t - r.touched > o.idle && r.state !== 'play') close(r, 'простой');
      else if (r.state === 'play' && [...r.members.values()].every(m => m.away)) { if (!r.allAway) r.allAway = t; else if (t - r.allAway > o.grace) close(r, 'все ушли'); }
      else r.allAway = 0;
    }
    if (!playing && !rooms.size && timer) { clearInterval(timer); timer = null; }
  }
  function list(kind) { return [...rooms.values()].filter(r => r.kind === kind && r.state === 'lobby' && r.members.size < r.max).map(pub); }

  return { step: loop, create, join, leave, ready, setOpts, start, finish, detach, roomOf, list, pub, tell, rooms, touch: r => { r.touched = o.now(); }, stop: () => { if (timer) clearInterval(timer); timer = null; } };
}

module.exports = { createRooms };
