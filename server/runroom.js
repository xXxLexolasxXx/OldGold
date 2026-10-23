'use strict';
// Кооп-забег до 5 героев (КООП_ЗАБЕГ.md §2.2): вид комнаты 'run' для server/rooms.js.
// Сервер крутит ядро js/run/runsim.js (60 шагов в секунду), игроки шлют только ввод,
// сервер рассылает снимки 10 раз в секунду, карту — при смене этажа. Подделать урон или золото нельзя.
// Отошедший (обрыв связи) стоит под щитом, вернувшийся продолжает; выбывший получает награду за пройденное.
// Хуки сервера: out(key) — герой уходит из деревни в таверну, back(key) — возвращается.

const RS = require('../js/run/runsim.js');

const RUN_DIFFS = { walk: { id: 'walk', name: 'Прогулка', floors: 3, mult: 0.8 }, dive: { id: 'dive', name: 'Спуск', floors: 5, mult: 1 }, curse: { id: 'curse', name: 'Проклятие', floors: 5, mult: 1.5 } };
const KINDS = ['skel', 'raven', 'malgor'];
const r1 = v => Math.round(v * 10) / 10;

// стартовые параметры героя из меты игрока — с проверкой пределов мастерской (подделка даст не больше честного максимума)
function heroFrom(meta) {
  const m = meta && typeof meta === 'object' ? meta : {}, U = m.ups && typeof m.ups === 'object' ? m.ups : {};
  const hp = Math.max(0, Math.min(5, U.hp | 0)), dmg = Math.max(0, Math.min(5, U.dmg | 0)), ch = Math.max(0, Math.min(1, U.choice | 0));
  return { hp: 100 + 10 * hp, dmg: 12 * (1 + 0.08 * dmg), weapon: ['pick', 'xbow', 'staff'].includes(m.weapon) ? m.weapon : 'pick', choices: 3 + ch, pal: RS.RS_PAL_KINDS.includes(m.pal) ? m.pal : 'warrior', cloak: Math.max(0, Math.min(15, m.cloak | 0)), sk: skinOf(m.sk) };
}
// скины (только вид): индекс в пределах числа вещей слота, иначе без скина
const SK_N = { hat: 7, beard: 5, cape: 6 };
function skinOf(s) { const o = s && typeof s === 'object' ? s : {}, r = {}; for (const k in SK_N) r[k] = Number.isInteger(o[k]) && o[k] >= 0 && o[k] < SK_N[k] ? o[k] : -1; return r; }
// карта этажа строкой: по символу на клетку ('0'/'1') — 52×38 = 2 КБ, приходит раз на этаж
const mapStr = S => Array.prototype.map.call(S.map, v => (v ? '1' : '0')).join('');

function createRunKind(hooks) {
  const H = Object.assign({ out: () => {}, back: () => {}, log: () => {} }, hooks);
  const kind = { max: 5 };

  kind.join = (r, m) => { m.meta = null; };
  kind.start = r => {
    const ms = [...r.members.values()].filter(m => !m.away);
    const d = RUN_DIFFS[r.opts.diff] || RUN_DIFFS.dive;
    let diff = d;
    if (d.id === 'curse') { const lvl = Math.max(1, Math.min(5, r.opts.lvl | 0 || 1)); diff = Object.assign({}, d, { mult: 1.3 + 0.2 * lvl, lvl, name: 'Проклятие ' + lvl }); }
    const S = RS.rsNew({ seed: (Math.random() * 1e9) >>> 0, diff, heroes: ms.map(m => Object.assign(heroFrom(m.meta), { id: m.nick })), pals: ms.length <= 2 });
    r.game = { S, idx: new Map(ms.map((m, i) => [m.key, i])), inp: ms.map(() => ({ mx: 0, my: 0, dash: false, slam: false })), acc: 0, snapT: 0, floor: -1, pickSent: null, ev: [], t0: Date.now() };
    for (const m of ms) { H.out(m.key); sendGo(r, m); }
    H.log(`забег ${r.code}: старт, героев ${ms.length}, ${diff.name}`);
  };
  function sendGo(r, m) {
    const G = r.game, i = G.idx.get(m.key);
    m.send({ t: 'run', a: 'go', me: i, n: G.S.n, diff: G.S.diff, nicks: [...G.idx.keys()].map(k => (r.members.get(k) || {}).nick || '?'), cloaks: G.S.heroes.map(h => h.cloak), sks: G.S.heroes.map(h => h.sk) });
    sendFloor(r, m);
  }
  function sendFloor(r, m) {
    const S = r.game.S;
    m.send({ t: 'run', a: 'floor', f: S.floor, map: mapStr(S), props: S.props.map(q => [q.k, r1(q.x), r1(q.y), q.ph || 0]), stairs: [S.stairs.x, S.stairs.y], boss: S.boss, rescue: S.rescue ? [S.rescue.x, S.rescue.y, S.rescue.kind] : null });
  }
  kind.tick = (r, dt) => {
    const G = r.game, S = G.S;
    if (!G || S.over) return;
    G.acc = Math.min(G.acc + dt, RS.RS_DT * 15);
    while (G.acc >= RS.RS_DT && !S.over) {
      G.acc -= RS.RS_DT;
      RS.rsStep(S, G.inp);
      for (const e of S.ev) if (G.ev.length < 60 && (e.k !== 'sfx' || e.n !== 'step')) G.ev.push(e);
      S.ev.length = 0;
      if (!S.pick) for (const it of G.inp) { it.dash = false; it.slam = false; }
      if (S.floor !== G.floor) { G.floor = S.floor; for (const m of r.members.values()) if (!m.away) sendFloor(r, m); }
    }
    if (S.pick && G.pickSent !== S.floor) {
      G.pickSent = S.floor;
      for (const [k, i] of G.idx) { const m = r.members.get(k); if (m && !m.away) m.send({ t: 'run', a: 'pick', opts: S.pick.opts[i], t: Math.round(S.pick.t) }); }
    }
    G.snapT -= dt;
    if (G.snapT <= 0 || S.over) { G.snapT = 0.1; snap(r); }
    if (S.over) end(r);
  };
  function snap(r) {
    const G = r.game, S = G.S;
    const msg = {
      t: 'run', a: 's', f: S.floor, tm: r1(S.t),
      h: S.heroes.map(h => [r1(h.x), r1(h.y), Math.round(h.hp), Math.round(h.max), h.face, (h.down ? 1 : 0) | (h.away ? 2 : 0) | (h.gone ? 4 : 0) | (h.moving ? 8 : 0) | (h.swing > 0 ? 16 : 0) | (h.hit > 0 || h.inv > 0.3 ? 32 : 0), Math.round(h.rev * 10), h.gold, Math.round(h.slam * 100), r1(h.spd), h.dash > 0 ? 1 : 0]),
      p: S.pals.map(p => [r1(p.x), r1(p.y), Math.round(p.hp), p.max, p.kind, p.dead ? 1 : 0, p.moving ? 1 : 0, p.owner]),
      e: S.enemies.reduce((a, e, id) => { if (e.hp > 0) a.push([KINDS.indexOf(e.kind), r1(e.x), r1(e.y), Math.round(e.hp), Math.round(e.max), e.hit > 0 ? 1 : 0, e.cd > 0.5 ? 1 : 0, id]); return a; }, []),   // id — место в списке этажа: по нему клиент сглаживает движение
      s: S.shots.map(s => [r1(s.x), r1(s.y), s.own === 'e' ? 1 : 0, s.r ? 1 : 0, Math.round(s.vx), Math.round(s.vy)]),
      d: S.drops.map(d => [r1(d.x), r1(d.y)]),
      pr: S.props.map(q => (q.used ? 1 : 0) | (q.on ? 2 : 0)),
      st: S.stairs.open ? 1 : 0, sw: S.stairs.wait > 0 ? Math.ceil(S.stairs.wait) : 0, k: S.kills,
      pk: S.pick ? S.pick.got.map(g => (g == null ? 0 : 1)) : null, pt: S.pick ? Math.ceil(S.pick.t) : 0,
      ev: G.ev.splice(0),
    };
    for (const m of r.members.values()) if (!m.away) m.send(msg);
  }
  function end(r) {
    const G = r.game, S = G.S;
    if (G.ended) return; G.ended = true;
    const rw = RS.rsRewards(S), score = RS.rsScore(S);
    for (const [k] of G.idx) { const m = r.members.get(k); if (m && !m.away) m.send({ t: 'run', a: 'over', win: rw.win, rw, score, kills: S.kills, floors: rw.floors }); H.back(k); }
    H.log(`забег ${r.code}: ${rw.win ? 'победа' : 'конец'} на этаже ${rw.floors}, ${Math.round(S.t)} с`);
    r.endedAt = Date.now();
    if (H.finish) H.finish(r);
  }
  kind.input = (r, key, m) => {
    const G = r.game; if (!G || G.S.over) return;
    const i = G.idx.get(key); if (i == null) return;
    const it = G.inp[i];
    if (Number.isFinite(m.mx) && Number.isFinite(m.my)) { it.mx = Math.max(-8, Math.min(8, Math.round(m.mx))) / 8; it.my = Math.max(-8, Math.min(8, Math.round(m.my))) / 8; }
    if (m.d) it.dash = true;
    if (m.s) it.slam = true;
  };
  kind.pick = (r, key, k) => { const G = r.game; if (!G) return; const i = G.idx.get(key); if (i != null) RS.rsChoose(G.S, i, k | 0); };
  kind.quit = (r, key) => { const G = r.game; if (!G) return; const i = G.idx.get(key); if (i == null) return; giveUp(r, key, i); };
  function giveUp(r, key, i) {
    const G = r.game, S = G.S, h = S.heroes[i];
    if (h.gone || S.over) return;
    h.gone = true; h.down = false;
    const m = r.members.get(key);
    const rw = Object.assign(RS.rsRewards(Object.assign({}, S, { over: { win: false } })), { win: false });
    if (m && !m.away) m.send({ t: 'run', a: 'over', win: false, quit: true, rw, score: RS.rsScore(S), kills: S.kills, floors: rw.floors });
    H.back(key);
    if (S.pick && S.pick.got[i] == null) RS.rsChoose(S, i, 0);
    if (!S.heroes.some(x => !x.gone)) { RS.rsEnd(S, false, true); G.ended = true; if (H.finish) H.finish(r); }
    else if (!S.heroes.some(x => !x.gone && !x.down)) RS.rsEnd(S, false);
  }
  kind.away = (r, m) => { const G = r.game; if (!G) return; const i = G.idx.get(m.key); if (i != null) G.S.heroes[i].away = true; };
  kind.back = (r, m) => {
    const G = r.game; if (!G) return;
    const i = G.idx.get(m.key); if (i == null) return;
    G.S.heroes[i].away = false;
    if (!G.S.over && !G.S.heroes[i].gone) { H.out(m.key); sendGo(r, m); if (G.S.pick && G.S.pick.got[i] == null) m.send({ t: 'run', a: 'pick', opts: G.S.pick.opts[i], t: Math.round(G.S.pick.t) }); }
  };
  kind.leave = (r, m) => {
    const G = r.game; if (!G || G.S.over) return;
    const i = G.idx.get(m.key); if (i != null) giveUp(r, m.key, i);
  };
  kind.end = r => { const G = r.game; if (G && !G.ended) { RS.rsEnd(G.S, false, true); end(r); } };
  return kind;
}

module.exports = { createRunKind, heroFrom, RUN_DIFFS };
