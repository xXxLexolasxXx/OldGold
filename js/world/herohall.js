'use strict';
// Зал героев — здание ТОЛЬКО для кооп-деревни (в одиночной игре его нет в меню). Сюда ходят герои игроков за делом:
//  • задания: личные и парные задания дня (js/coop/coopsim.js) плюс «заказ зала» (испытание или дуэль) и смена надоевшего задания;
//  • арена: дуэли героев «до первой кружки» (настоящее здоровье не страдает) и испытания трёх ступеней — их считает сервер;
//  • смена класса: за золото из казны деревни, с порогом по уровню и отдыхом между сменами; ранги гильдий сбрасываются;
//  • облик (heroapp.js) и доска почёта — лучшие герои сервера, в том числе те, кого сейчас нет в деревне.
// Уровень 2: ступень «Чемпион», класс дешевле на четверть, больше смен заданий, дуэли дают больше опыта, доска показывает десятку.
// Один файл и для браузера, и для сервера (сервер считает всё, клиент — только окно). Данные героя H.hl лежат в аккаунте игрока.

const HH_NEAR = 9;            // насколько близко к двери зала должен быть герой
const HH_TIERS = [
  null,
  { name: 'Соломенный страж', info: 'Чучело в кольчуге. Бьёт слабо, но обидно.', lvl: 1, hp: 60, pw: 7, gold: 2, xp: 20, hon: 1, item: ['bread', 2] },
  { name: 'Старый ветеран арены', info: 'Видел сотни героев и ни одного хорошего.', lvl: 4, hp: 115, pw: 12, gold: 5, xp: 40, hon: 2, item: ['sausage', 2], title: [3, 'Испытанный'] },
  { name: 'Каменный чемпион', info: 'Только для зала второго уровня. Без шуток: он правда каменный.', lvl: 9, hp: 175, pw: 16, gold: 10, xp: 80, hon: 4, item: ['steak', 2], title: [2, 'Чемпион арены'], l2: true },
];
const HH_CLS_PW = { warrior: 1.1, barbarian: 1.15, monk: 1.05, rogue: 1, archer: 1, mage: 0.95, druid: 0.9, priest: 0.85 };
const HH_CHANGE_LVL = 3, HH_CHANGE_DAYS = 2, HH_REROLL_GOLD = 3;
const HH = { hooked: false, duels: [], trials: new Map(), asks: new Map(), log: [], ui: { tab: 'q' }, board: null, boardAt: 0, askShown: '' };

const hhServer = () => typeof coop !== 'undefined' && !!coop.players;
const hhMirror = () => typeof Coop !== 'undefined' && !!Coop.on;
const hhCoop = () => hhServer() || hhMirror();
const hhHall = () => Game.buildings.find(b => b.type === 'herohall' && b.state === 'done' && !b.removed) || null;
const hhLvl = b => (b && b.level) || 1;

// ---------- Описание здания ----------

BUILDINGS.herohall = {
  name: 'Зал героев', cat: 'Основа', w: 3, h: 3, top: 112, noRotate: true, cost: { timber: 10, stone: 8 }, coopOnly: true, hall: true,
  desc: 'Дом для тех, кому не сидится: задания, арена для дуэлей и испытаний, смена класса, доска почёта. Только в общей деревне. Работников не нужно — нужны герои.',
  desc2: 'Зал расширен: на арену выходит каменный чемпион, смена класса дешевле на четверть, заданий можно менять больше, а за дуэли дают больше опыта. Доска почёта вмещает десять имён — тщеславие растёт быстрее здания.',
  up: { cost: { timber: 12, stone: 14 } },
};
BUILD_ORDER.push('herohall');
UNLOCKS[0].items.push('herohall');
if (typeof SIGN_OF !== 'undefined') SIGN_OF.herohall = 'swords';

{
  // в одиночной игре зала нет: ни в меню, ни на карте
  const _mi = menuItemShown;
  menuItemShown = function (type) { return !(BUILDINGS[type] && BUILDINGS[type].coopOnly && !hhCoop()) && _mi(type); };
  // готовому залу не нужны ни рабочие, ни дорога к складу: он просто стоит и ждёт героев
  const _pr = Building.prototype.problem;
  Building.prototype.problem = function () { return this.type === 'herohall' && this.state === 'done' ? (this.paused ? 'paused' : null) : _pr.call(this); };
  const _cp = checkPlacement;
  checkPlacement = function (type, x, y, rot) {
    if (BUILDINGS[type] && BUILDINGS[type].coopOnly && !hhCoop()) return 'Зал героев строится только в общей деревне';
    return _cp(type, x, y, rot);
  };
}

// ---------- Картинка здания ----------

function hhBoard(c, x, y) {
  shadowAt(c, x + 1, y + 0.5, 7);
  c.fillStyle = '#3a2414'; c.fillRect(x - 6, y - 14, 1.6, 14); c.fillRect(x + 4.4, y - 14, 1.6, 14);
  c.fillStyle = lingrad(c, x - 8, 0, x + 8, 0, [[0, '#8a5e34'], [1, '#5a3a1e']]); c.fillRect(x - 8, y - 22, 16, 11);
  c.strokeStyle = '#2a1a0c'; c.lineWidth = 0.5; c.strokeRect(x - 8, y - 22, 16, 11);
  for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) { c.fillStyle = r === 0 ? '#e4b434' : r === 1 ? '#c8ccd4' : '#b87838'; c.fillRect(x - 6.6 + k * 4.6, y - 20.4 + r * 3.2, 3.6, 2); }
  c.fillStyle = '#f6d458'; c.fillRect(x - 0.6, y - 24.4, 1.2, 2.4);
}
function hhPost(c, x, y) {
  shadowAt(c, x + 0.6, y + 0.3, 2);
  c.fillStyle = lingrad(c, x - 1.2, 0, x + 1.2, 0, [[0, '#9a6a3a'], [1, '#4a2c14']]); c.fillRect(x - 1.1, y - 8, 2.2, 8);
  ellipse(c, x, y - 8, 1.4, 0.6, '#c89a5a');
}

Object.assign(MODELS, {
  herohall(m) {
    // песчаная арена перед залом: утоптанный круг с кольями
    m.ground((c, mm) => {
      groundPoly(c, mm, [[2, 2], [94, 2], [94, 32], [2, 32]], 'rgba(184,160,108,0.7)');
      const q = mm.at(30, 16);
      ellipse(c, q[0], q[1], 17, 6.4, 'rgba(206,184,128,0.85)'); ellipse(c, q[0], q[1], 13, 4.6, 'rgba(170,146,98,0.75)');
      for (let k = 0; k < 40; k++) { const p = mm.at(rnd(6, 90), rnd(4, 30)); ellipse(c, p[0], p[1], rnd(1, 2.6), rnd(0.5, 1.1), srand() < 0.5 ? 'rgba(130,108,70,0.6)' : 'rgba(224,204,150,0.6)'); }
    });
    // длинный зал: брёвна внизу, алая черепица
    m.box({
      x0: 4, x1: 68, y0: 36, y1: 88, h: 30, wall: 'logs', col: '#8a5a32',
      roof: { type: 'gable', axis: 'X', rise: 26, mat: 'tiles', col: '#9a3a2a', ov: 5 },
      decor: {
        S: [{ t: 'door', main: true, w: 14, h: 20, o: { frame: 'stone', double: true, col: '#4a2a14' } }, { t: 'win', at: 14, z: 13, w: 7, h: 9, o: { arch: true, lit: true, shutter: '#6a1c1c' } },
          { t: 'shield', at: 28, z: 24, col: '#3a5a8a' }, { t: 'shield', at: 60, z: 24, col: '#8c2c20' }, { t: 'lantern', at: 42, z: 22 }],
        E: [{ t: 'win', at: 50, z: 13, w: 6, h: 9, o: { arch: true } }], W: [],
      },
      chimneys: [{ x: 14, y: 72, h: 12, kind: 'stone', w: 5 }],
    });
    // башня славы со знаменем и золотым шаром
    m.box({
      _g: true, moss: true, x0: 68, x1: 92, y0: 44, y1: 70, h: 62, wall: 'stone', col: '#a49a88', finial: true,
      roof: { type: 'pyramid', rise: 24, mat: 'slate', col: '#3a4a6a', ov: 3 },
      decor: { S: [{ t: 'win', at: 80, z: 42, w: 5, h: 10, o: { arch: true, stone: true, lit: true } }, { t: 'win', at: 80, z: 20, w: 4, h: 8, o: { arch: true, stone: true } }, { t: 'shield', at: 80, z: 56, col: '#c89226' }],
        E: [{ t: 'win', at: 13, z: 42, w: 5, h: 10, o: { arch: true, stone: true, lit: true } }] },
    });
    m.prop((c, x, y) => hhBoard(c, x, y), 76, 30);
    m.prop((c, x, y) => dwarfBanner(c, x, y, '#8c2c20', 36), 6, 34);
    m.prop((c, x, y) => dwarfBanner(c, x, y, '#2f5a8a', 36), 48, 33);
    m.prop((c, x, y) => trainingDummy(c, x, y), 18, 14);
    m.prop((c, x, y) => trainingDummy(c, x, y), 44, 10);
    m.prop((c, x, y) => weaponRack(c, x, y, 'sword'), 62, 18);
    for (const [x, y] of [[8, 6], [52, 5], [10, 26], [54, 27]]) m.prop((c, sx, sy) => hhPost(c, sx, sy), x, y);
    m.prop((c, x, y) => barrel(c, x, y, 0.85), 90, 24);
  },
});

// ---------- Данные героя ----------

const hhDay = () => cycleAt(Game.time).k;
function hhHl(H) {
  const hl = H.hl || (H.hl = { p: 0, dw: 0, dl: 0, tw: 0, tb: 0, cc: 0, ccd: -9, rr: 0, tn: 0, d: -1 });
  const d = hhDay();
  if (hl.d !== d) { hl.d = d; hl.rr = 0; hl.tn = 0; }
  return hl;
}
const hhTrialsMax = lvl => (lvl >= 2 ? 4 : 3);
const hhRerollMax = lvl => (lvl >= 2 ? 3 : 1);
const hhClassPrice = (hl, lvl) => Math.round((6 + 4 * Math.min(hl.cc || 0, 6)) * (lvl >= 2 ? 0.75 : 1));
function hhGold() { let n = 0; for (const b of Game.buildings) if (b.type === 'storehouse' && b.state === 'done' && !b.removed) n += b.stock.gold || 0; return n; }
function hhSpend(n) {
  if (hhGold() < n) return false;
  for (const b of Game.buildings) {
    if (n <= 0) break;
    if (b.type !== 'storehouse' || b.state !== 'done' || b.removed) continue;
    const t = Math.min(n, b.stock.gold || 0); b.stock.gold = (b.stock.gold || 0) - t; n -= t;
  }
  return true;
}
const hhDist = (u, b) => Math.hypot(u.x - (b.doorX + 0.5), u.y - (b.doorY + 0.5));
const hhBusy = name => HH.duels.some(d => d.a === name || d.b === name) || HH.trials.has(name);
function hhLog(text) { HH.log.push(text); if (HH.log.length > 8) HH.log.shift(); coop.out.push({ msg: { t: 'toast', text } }); }
function hhPoints(H, n) { hhHl(H).p += n; }

// ---------- Бой на арене: считает сервер, здоровье героя не страдает ----------

function hhPow(H) {
  const s = heroStats(H);
  return (3 + s.str * 0.55 + s.agi * 0.35 + s.int * 0.1) * (HH_CLS_PW[H.clsKey] || 1);
}
const hhHp = H => 40 + heroStats(H).end * 3.5 + H.level * 3;

// удар: от 60 до 120 % силы, иногда промах и крит
function hhHit(pw) {
  const r = Math.random();
  if (r < 0.12) return { d: 0, t: 'Мимо' };
  const crit = r > 0.92;
  return { d: Math.max(1, Math.round(pw * (0.6 + Math.random() * 0.6) * 1.4 * (crit ? 1.6 : 1))), t: crit ? 'Крит!' : '' };
}
function hhStrike(from, to, hit, col) {
  if (!hit.d) { floater(to.x, to.y - 1.7, 'Мимо', '#d8d0b0'); return; }
  floater(to.x, to.y - 1.7, '-' + hit.d + (hit.t ? ' ' + hit.t : ''), col);
  if (to.hero) to.ouchUntil = Game.time + 0.5;
  from.anim = null;
}

function hhFreeze(u, sec) { heroStopUnit(u); u.hero.stunUntil = Game.time + sec; }

function hhSpots(b) {
  const ok = (x, y) => isWalkable(x, y) && !World.door[idx(x, y)] && !World.bmap[idx(x, y)];
  const a = randomFreeNear(b.doorX - 2, b.doorY + 4, 0, 2, ok), c = randomFreeNear(b.doorX + 2, b.doorY + 4, 0, 2, ok);
  return a && c && !(a[0] === c[0] && a[1] === c[1]) ? [a, c] : null;
}

function hhDuelStart(an, bn) {
  const hall = hhHall(), ua = coop.players.get(an), ub = coop.players.get(bn);
  if (!hall || !ua || !ub || hhBusy(an) || hhBusy(bn)) return;
  const sp = hhSpots(hall);
  if (!sp) { coopSay(an, 'На арене нет места'); coopSay(bn, 'На арене нет места'); return; }
  for (const [u, s] of [[ua, sp[0]], [ub, sp[1]]]) {
    hhFreeze(u, 60); u.hero.downT = 0; u.inside = null;
    u.x = s[0] + 0.5; u.y = s[1] + 0.5; u.face = u === ua ? 1 : -1;
  }
  const d = { a: an, b: bn, pa: hhPow(ua.hero), pb: hhPow(ub.hero), hp: [hhHp(ua.hero), hhHp(ub.hero)], mx: [hhHp(ua.hero), hhHp(ub.hero)], next: Game.time + 2, r: 0, lvl: hhLvl(hall) };
  HH.duels.push(d);
  hhLog(`На арене зала героев: ${an} против ${bn}!`);
}
function hhDuelEnd(d, winner) {
  HH.duels.splice(HH.duels.indexOf(d), 1);
  const ua = coop.players.get(d.a), ub = coop.players.get(d.b);
  for (const u of [ua, ub]) if (u) u.hero.stunUntil = 0;
  if (!winner) return;
  const wn = winner, ln = winner === d.a ? d.b : d.a, uw = coop.players.get(wn), ul = coop.players.get(ln);
  const k = d.lvl >= 2 ? 1.5 : 1;
  if (uw) {
    const hl = hhHl(uw.hero); hl.dw++; hl.p += 3;
    coopGiveXp(uw.hero, Math.round(25 * k));
    if (typeof coopQEvent === 'function') coopQEvent(uw.hero, 'duel');
    if (hl.dw >= 5) coopGiveTitle(uw.hero, 'Дуэлянт');
    if (hl.dw >= 15) coopGiveTitle(uw.hero, 'Гроза арены');
    floater(uw.x, uw.y - 1.9, 'Победа!', '#ffe070');
  }
  if (ul) { const hl = hhHl(ul.hero); hl.dl++; hl.p += 1; coopGiveXp(ul.hero, Math.round(10 * k)); floater(ul.x, ul.y - 1.9, 'Проиграл с честью', '#d8d0b0'); }
  hhLog(`${wn} побеждает ${ln} на арене зала героев`);
}
function hhDuelTick(d) {
  const ua = coop.players.get(d.a), ub = coop.players.get(d.b);
  if (!ua || !ub) { hhDuelEnd(d, null); return; }
  if (Game.time < d.next) return;
  d.next = Game.time + 1;
  d.r++;
  const ha = hhHit(d.pa), hb = hhHit(d.pb);
  hhStrike(ua, ub, ha, '#ffb090'); hhStrike(ub, ua, hb, '#ff9a80');
  d.hp[1] = Math.max(0, d.hp[1] - ha.d); d.hp[0] = Math.max(0, d.hp[0] - hb.d);
  if (d.hp[0] <= 0 || d.hp[1] <= 0 || d.r >= 14) {
    const fa = d.hp[0] / d.mx[0], fb = d.hp[1] / d.mx[1];
    hhDuelEnd(d, fa === fb ? (Math.random() < 0.5 ? d.a : d.b) : fa > fb ? d.a : d.b);
  }
}

function hhTrialStart(name, tier) {
  const hall = hhHall(), u = coop.players.get(name), T = HH_TIERS[tier];
  if (!hall || !u || !T || hhBusy(name)) return;
  const H = u.hero, hl = hhHl(H), lvl = hhLvl(hall);
  if (hhDist(u, hall) > HH_NEAR) { coopSay(name, 'Подойдите ближе к залу героев'); return; }
  if (T.l2 && lvl < 2) { coopSay(name, 'Эта ступень откроется, когда зал станет вторым уровнем'); return; }
  if (H.level < T.lvl) { coopSay(name, `Нужен ${T.lvl} уровень героя`); return; }
  if (hl.tn >= hhTrialsMax(lvl)) { coopSay(name, 'На сегодня испытаний хватит — завтра будут новые синяки'); return; }
  if (H.downT || H.drunkUntil > Game.time) { coopSay(name, 'Сначала придите в себя'); return; }
  hl.tn++;
  hhFreeze(u, 90);
  HH.trials.set(name, { tier, p: hhPow(H), op: T.pw, hp: hhHp(H), mx: hhHp(H), ohp: T.hp, omx: T.hp, next: Game.time + 1.5, r: 0, lvl });
  floater(u.x, u.y - 1.9, 'К бою!', '#ffe070');
}
function hhTrialEnd(name, t, won) {
  HH.trials.delete(name);
  const u = coop.players.get(name);
  if (!u) return;
  const H = u.hero, hl = hhHl(H), T = HH_TIERS[t.tier];
  H.stunUntil = 0;
  if (won) {
    hl.tw++; hl.tb = Math.max(hl.tb, t.tier); hl.p += T.hon;
    coopGiveXp(H, T.xp);
    if (T.item) coopAddItem(H, T.item[0], T.item[1]);
    if (typeof coopVillageGold === 'function') coopVillageGold(T.gold);
    if (typeof coopQEvent === 'function') coopQEvent(H, 'trial');
    if (T.title && hl.tw >= T.title[0] && t.tier >= 2) coopGiveTitle(H, T.title[1]);
    floater(u.x, u.y - 1.9, 'Испытание пройдено!', '#ffe070');
    coopSay(name, `«${T.name}» повержен: +${T.xp} опыта, ${T.gold} зол. в казну деревни`);
    hhLog(`${name} прошёл испытание «${T.name}»`);
  } else {
    coopGiveXp(H, 5);
    floater(u.x, u.y - 1.9, 'Не вышло', '#d8d0b0');
    coopSay(name, `«${T.name}» оказался крепче. Отдышитесь и приходите ещё`);
  }
}
function hhTrialTick(name, t) {
  const u = coop.players.get(name);
  if (!u) { HH.trials.delete(name); return; }
  if (Game.time < t.next) return;
  t.next = Game.time + 1;
  t.r++;
  const ho = { x: u.x + 1.2, y: u.y, hero: false };
  const mine = hhHit(t.p), theirs = hhHit(t.op);
  hhStrike(u, ho, mine, '#ffe0a0'); hhStrike(ho, u, theirs, '#ff9a80');
  t.ohp = Math.max(0, t.ohp - mine.d); t.hp = Math.max(0, t.hp - theirs.d);
  if (t.ohp <= 0 || t.hp <= 0 || t.r >= 16) hhTrialEnd(name, t, t.ohp <= 0 ? t.hp > 0 || Math.random() < 0.5 : t.hp > 0 && t.ohp / t.omx < t.hp / t.mx);
}

function hhTick() {
  for (const d of HH.duels.slice()) hhDuelTick(d);
  for (const [n, t] of [...HH.trials]) hhTrialTick(n, t);
  for (const [n, a] of [...HH.asks]) if (Game.time > a.until || !coop.players.has(n) || !coop.players.has(a.from)) HH.asks.delete(n);
}

// ---------- Класс и задания ----------

const HH_CLASS_ONLY = new Set(['foes', 'lamps', 'grow', 'treasure']);
function hhNewQuest(H, avoid) {
  const day = coopDayP() < EVE_START;
  const pool = ['tavern', 'road', 'field', 'build', 'far'];
  if (day) pool.push('night');
  if (QCLS[H.clsKey]) pool.push(QCLS[H.clsKey]);
  const opts = pool.filter(id => !avoid.includes(id));
  while (opts.length) {
    const id = opts.splice(Math.floor(Math.random() * opts.length), 1)[0];
    const q = { id, n: 0, need: QDEF[id].need, done: false };
    if (id === 'grow') { q.cells = []; q.seen = []; }
    if (id === 'far') { const p = coopFarPoint(); if (!p) continue; q.x = p[0]; q.y = p[1]; }
    if (id === 'treasure') { const p = coopTreasurePoint(); if (!p) continue; q.x = p[0]; q.y = p[1]; }
    return q;
  }
  return null;
}
function hhReroll(name, i) {
  const hall = hhHall(), u = coop.players.get(name);
  if (!hall || !u || !Number.isInteger(i)) return;
  const H = u.hero, hl = hhHl(H), lvl = hhLvl(hall), list = H.quests && H.quests.list, q = list && list[i];
  if (hhDist(u, hall) > HH_NEAR) { coopSay(name, 'Подойдите ближе к залу героев'); return; }
  if (!q || q.done) { coopSay(name, 'Это задание менять нельзя'); return; }
  if (hl.rr >= hhRerollMax(lvl)) { coopSay(name, 'Смен на сегодня больше нет'); return; }
  if (hhGold() < HH_REROLL_GOLD) { coopSay(name, `В казне деревни мало золота (нужно ${HH_REROLL_GOLD})`); return; }
  const nq = hhNewQuest(H, list.map(x => x.id));
  if (!nq) { coopSay(name, 'Писарь развёл руками: новых заданий нет'); return; }
  hhSpend(HH_REROLL_GOLD);
  list[i] = nq; hl.rr++;
  coopSay(name, `Задание заменено: «${QDEF[nq.id].name}» (−${HH_REROLL_GOLD} зол. из казны)`);
}
function hhChangeClass(name, cls) {
  const hall = hhHall(), u = coop.players.get(name);
  if (!hall || !u || !COOP_CLASSES[cls]) return;
  const H = u.hero, hl = hhHl(H), lvl = hhLvl(hall), price = hhClassPrice(hl, lvl);
  if (hhDist(u, hall) > HH_NEAR) { coopSay(name, 'Подойдите ближе к залу героев'); return; }
  if (hhBusy(name)) return;
  if (H.clsKey === cls) { coopSay(name, 'Вы уже ' + COOP_CLASSES[cls].name.toLowerCase() + 'ом, куда ещё'); return; }
  if (H.level < HH_CHANGE_LVL) { coopSay(name, `Менять класс можно с ${HH_CHANGE_LVL} уровня`); return; }
  const wait = HH_CHANGE_DAYS - (hhDay() - hl.ccd);
  if (wait > 0) { coopSay(name, `Не чаще раза в ${HH_CHANGE_DAYS} дня: подождите ещё ${wait}`); return; }
  if (!hhSpend(price)) { coopSay(name, `В казне деревни мало золота (нужно ${price})`); return; }
  const was = H.cls, ratio = H.hp / H.maxhp;
  H.clsKey = cls; H.cls = COOP_CLASSES[cls].name; H.mastery = undefined;
  H.maxhp = coopBaseHp(cls, H.level); H.hp = Math.max(1, Math.round(H.maxhp * Math.min(1, ratio)));
  hl.cc++; hl.ccd = hhDay(); hl.p += 0;
  // классовые задания старого класса меняем на обычные
  if (H.quests) H.quests.list = H.quests.list.map(q => (!q.done && HH_CLASS_ONLY.has(q.id) && QCLS[cls] !== q.id ? hhNewQuest(H, H.quests.list.map(x => x.id)) || q : q));
  floater(u.x, u.y - 1.9, H.cls + '!', '#ffe070');
  hhLog(`${name} сменил класс: был ${was.toLowerCase()}, стал ${H.cls.toLowerCase()} (−${price} зол. из казны)`);
}

// ---------- Сервер: подключение к кооп-симуляции ----------

function hhServerHook() {
  HH.hooked = true;
  QDEF.duel = { name: 'Выиграть дуэль в зале героев', need: 1, xp: 40, item: ['steak', 2], title: [3, 'Дуэлянт'] };
  QDEF.trial = { name: 'Пройти испытание в зале героев', need: 1, xp: 35, item: ['sausage', 2], title: [3, 'Испытанный'] };
  const _mq = coopMakeQuests;
  coopMakeQuests = function (H) {
    _mq(H);
    // зал вывешивает свой заказ: один из простых заданий дня заменяется на дуэль или испытание
    const L = H.quests && H.quests.list, hall = hhHall();
    if (!L || !hall) return;
    const i = L.findIndex(q => !q.done && !HH_CLASS_ONLY.has(q.id));
    if (i >= 0) L[i] = { id: Math.random() < 0.5 && coop.players.size > 1 ? 'duel' : 'trial', n: 0, need: 1, done: false };
  };
  const _gt = coopGiveTitle;
  coopGiveTitle = function (H, t) { const n = (H.titles || []).length; _gt(H, t); if ((H.titles || []).length > n) hhPoints(H, 2); };
  const _cc = coopCmd;
  coopCmd = function (name, json, admin) {
    let m = null;
    try { m = JSON.parse(json); } catch (e) { return; }
    if (!m || m.t !== 'hall') return _cc(name, json, admin);
    const u = coop.players.get(name), hall = hhHall();
    if (!u || !hall) return;
    switch (m.a) {
      case 'duel': {
        const o = coop.players.get(String(m.who));
        if (!o || o === u) { coopSay(name, 'Такого героя сейчас нет в деревне'); break; }
        if (hhDist(u, hall) > HH_NEAR) { coopSay(name, 'Подойдите ближе к залу героев'); break; }
        if (hhBusy(name) || hhBusy(o.hero.owner) || o.hero.downT || u.hero.downT) { coopSay(name, 'Кто-то из вас сейчас занят'); break; }
        HH.asks.set(o.hero.owner, { from: name, until: Game.time + 30 });
        coopSay(o.hero.owner, `${name} вызывает вас на дуэль в зале героев! Откройте зал героев → «Арена»`);
        coopSay(name, `Вызов отправлен: ${o.hero.owner} думает 30 секунд`);
        break;
      }
      case 'accept': {
        const a = HH.asks.get(name);
        if (!a) break;
        HH.asks.delete(name);
        const o = coop.players.get(a.from);
        if (!o) { coopSay(name, 'Вызвавший уже ушёл'); break; }
        if (hhBusy(name) || hhBusy(a.from) || o.hero.downT || u.hero.downT) { coopSay(name, 'Кто-то уже занят — не вышло'); break; }
        hhDuelStart(a.from, name);
        break;
      }
      case 'decline': {
        const a = HH.asks.get(name);
        if (a) { HH.asks.delete(name); coopSay(a.from, `${name} отказался от дуэли`); }
        break;
      }
      case 'trial': if (Number.isInteger(m.tier)) hhTrialStart(name, m.tier); break;
      case 'cls': if (typeof m.cls === 'string') hhChangeClass(name, m.cls); break;
      case 'reroll': hhReroll(name, m.i); break;
    }
  };
  const _cj = coopJoin;
  coopJoin = function (name, json) {
    const id = _cj(name, json);
    let d = null; try { d = JSON.parse(json); } catch (e) { /* ничего */ }
    const u = coop.players.get(name);
    if (u && d && d.hl && typeof d.hl === 'object') {
      const n = (v, mx) => (Number.isFinite(v) ? Math.max(0, Math.min(mx, Math.floor(v))) : 0);
      u.hero.hl = { p: n(d.hl.p, 1e6), dw: n(d.hl.dw, 1e5), dl: n(d.hl.dl, 1e5), tw: n(d.hl.tw, 1e5), tb: n(d.hl.tb, 3), cc: n(d.hl.cc, 1e3), ccd: Number.isFinite(d.hl.ccd) ? d.hl.ccd : -9, rr: n(d.hl.rr, 9), tn: n(d.hl.tn, 9), d: Number.isFinite(d.hl.d) ? d.hl.d : -1 };
    }
    return id;
  };
  const _hd = coopHeroData;
  coopHeroData = function (name) {
    const j = _hd(name), u = coop.players.get(name);
    if (!j || !u || !u.hero.hl) return j;
    const d = JSON.parse(j); d.hl = u.hero.hl; return JSON.stringify(d);
  };
  const _cl = coopLeave;
  coopLeave = function (name) {
    for (const d of HH.duels.slice()) if (d.a === name || d.b === name) hhDuelEnd(d, null);
    HH.trials.delete(name); HH.asks.delete(name);
    for (const [n, a] of [...HH.asks]) if (a.from === name) HH.asks.delete(n);
    const u = coop.players.get(name);
    if (u) u.hero.stunUntil = 0;
    return _cl(name);
  };
  const _md = coopMeData;
  coopMeData = function (name) {
    const j = _md(name), u = coop.players.get(name);
    if (!j || !u) return j;
    const d = JSON.parse(j), hall = hhHall();
    d.hl = hall ? hhInfo(u, hall) : { has: 0 };
    return JSON.stringify(d);
  };
}

function hhInfo(u, hall) {
  const H = u.hero, hl = hhHl(H), lvl = hhLvl(hall), name = H.owner;
  const info = {
    has: 1, lvl, dist: Math.round(hhDist(u, hall) * 10) / 10, near: hhDist(u, hall) <= HH_NEAR ? 1 : 0, door: [hall.doorX, hall.doorY + 1],
    p: hl.p, dw: hl.dw, dl: hl.dl, tw: hl.tw, tb: hl.tb, cc: hl.cc,
    price: hhClassPrice(hl, lvl), wait: Math.max(0, HH_CHANGE_DAYS - (hhDay() - hl.ccd)), gold: hhGold(),
    rr: Math.max(0, hhRerollMax(lvl) - hl.rr), rrPrice: HH_REROLL_GOLD, tl: Math.max(0, hhTrialsMax(lvl) - hl.tn),
    busy: hhBusy(name) ? 1 : 0, ask: [], on: [], log: HH.log.slice(-6),
  };
  const a = HH.asks.get(name);
  if (a) info.ask.push(a.from);
  for (const [n, o] of coop.players) if (n !== name) info.on.push({ n, c: o.hero.clsKey, l: o.hero.level, b: hhBusy(n) ? 1 : 0 });
  const d = HH.duels.find(x => x.a === name || x.b === name);
  if (d) { const me = d.a === name ? 0 : 1; info.fight = { w: me ? d.a : d.b, hp: Math.round(d.hp[me]), mx: Math.round(d.mx[me]), ohp: Math.round(d.hp[1 - me]), omx: Math.round(d.mx[1 - me]) }; }
  const t = HH.trials.get(name);
  if (t) info.fight = { w: HH_TIERS[t.tier].name, hp: Math.round(t.hp), mx: Math.round(t.mx), ohp: Math.round(t.ohp), omx: Math.round(t.omx) };
  return info;
}

// ---------- Клиент: окно зала ----------

function hhCss() {
  if (document.getElementById('hh-css')) return;
  const st = document.createElement('style');
  st.id = 'hh-css';
  st.textContent = `
  #hh-win{position:fixed;inset:0;background:rgba(8,6,3,.8);z-index:10005;display:flex;align-items:center;justify-content:center;color:#e8dcc0;font-family:inherit}
  .hh-card{background:#1f1710;border:2px solid #b8902c;border-radius:8px;width:min(640px,97vw);max-height:94vh;display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden}
  .hh-top{display:flex;align-items:center;gap:8px;padding:10px 14px 4px}.hh-top h2{margin:0;color:#f6d458;font-size:19px;flex:1}
  .hh-x{background:none;border:none;color:#e8dcc0;font-size:22px;cursor:pointer;padding:0 6px}
  .hh-tabs{display:flex;flex-wrap:wrap;gap:4px;padding:4px 14px}
  .hh-tabs button{padding:5px 11px;font-size:13px;background:#2a2014;color:#f6e8c0;border:1px solid #5a4620;border-radius:5px;cursor:pointer;font-family:inherit}
  .hh-tabs button.on{background:#8a6a1c;border-color:#d8b04a;color:#fff4d0}
  .hh-pane{padding:8px 14px 14px;overflow:auto;font-size:13px;line-height:1.4}
  .hh-pane h3{margin:10px 0 4px;color:#f6d458;font-size:14px}.hh-pane h3:first-child{margin-top:2px}
  .hh-near{background:#3a2c14;border:1px dashed #d8b04a;border-radius:5px;padding:6px 9px;margin-bottom:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .hh-row{display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.07)}.hh-row>div{flex:1;min-width:0}
  .hh-row small,.hh-pane small{opacity:.7}
  .hh-b{padding:5px 11px;font-size:12px;background:#8a6a1c;color:#fff4d0;border:1px solid #d8b04a;border-radius:4px;cursor:pointer;font-family:inherit}
  .hh-b:disabled{opacity:.45;cursor:default}.hh-b.sec{background:#3a2c14;border-color:#7a5f28}
  .hh-ok{color:#9fe070}.hh-bar{height:9px;background:#2a1410;border-radius:3px;overflow:hidden;border:1px solid #000;margin:2px 0}.hh-bar i{display:block;height:100%}
  .hh-cls{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:6px;margin-top:6px}
  .hh-cls button{display:flex;flex-direction:column;align-items:center;gap:2px;padding:7px 4px;background:#2a2014;border:2px solid var(--c);border-radius:6px;color:#f6e8c0;font-family:inherit;font-size:12px;cursor:pointer}
  .hh-cls button:disabled{opacity:.45;cursor:default}.hh-cls b{color:var(--c);font-size:13px}.hh-cls img{width:44px;height:44px;image-rendering:pixelated}
  .hh-tb{width:100%;border-collapse:collapse}.hh-tb td,.hh-tb th{padding:3px 4px;text-align:center;border-bottom:1px solid rgba(255,255,255,.07)}.hh-tb td:nth-child(2){text-align:left}.hh-tb th{color:#f6d458;font-weight:normal;font-size:12px}
  .hh-tb tr.me td{background:rgba(246,212,88,.12)}
  #hh-ask{position:fixed;left:50%;top:70px;transform:translateX(-50%);z-index:10004;background:rgba(26,19,13,.96);border:2px solid #d8b04a;border-radius:8px;padding:10px 14px;color:#f0e4c0;font-size:13px;box-shadow:0 4px 18px rgba(0,0,0,.6);text-align:center;max-width:92vw}
  #hh-ask b{color:#f6d458}`;
  document.head.appendChild(st);
}

const hhEsc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hhMe = () => (Coop.me && Coop.me.hl) || null;
const hhClsMeta = k => ((Coop.meta && Coop.meta.classes) || {})[k] || { name: k || '', col: '#e8dcc0', info: '', hp: 0 };

function hhNearBar(I) {
  if (I.near) return '';
  return `<div class="hh-near"><span>Герой далеко от зала (${I.dist} кл.). Дела с залом — вблизи двери.</span><button class="hh-b" data-hh="go">Идти к залу</button></div>`;
}

function hhPaneQuests(I) {
  const qx = Coop.me && Coop.me.qx;
  let x = hhNearBar(I) + '<h3>Мои задания дня</h3>';
  const list = (qx && qx.q) || [];
  if (!list.length) x += '<div class="small">Задания выдаются утром — загляните позже.</div>';
  list.forEach((q, i) => {
    x += `<div class="hh-row"><div>${q.d ? '<span class="hh-ok">✔ </span>' : ''}${hhEsc(q.t)} <small>${q.n}/${q.need}${q.h ? ' · ' + hhEsc(q.h) : ''}</small></div>${q.d ? '' : `<button class="hh-b sec" data-hh="rr:${i}" ${I.near && I.rr > 0 && I.gold >= I.rrPrice ? '' : 'disabled'} title="Другое задание вместо этого">Сменить · ${I.rrPrice} зол.</button>`}</div>`;
  });
  x += `<div class="small">Смен сегодня: <b>${I.rr}</b> · золото берётся из казны деревни (сейчас ${I.gold}). Заказы зала (дуэль, испытание) выдаются вместо одного из простых заданий.</div>`;
  const p = qx && qx.p;
  x += '<h3>Парное задание</h3>';
  x += p ? `<div class="hh-row"><div>${p.d ? '<span class="hh-ok">✔ </span>' : ''}<b>${hhEsc(p.t)}</b> с ${hhEsc(p.w)} ${p.on ? '' : '(не в деревне)'}<br><small>${hhEsc(p.x)}${p.prog != null ? ' · ' + p.prog + '%' : ''} · дружба ${p.fr}/5</small></div></div>`
    : '<div class="small">Парные задания приходят, когда в деревне есть кто-то ещё.</div>';
  return x;
}

function hhPaneArena(I) {
  let x = hhNearBar(I);
  if (I.fight) {
    const f = I.fight;
    x += `<h3>Бой: ${hhEsc(f.w)}</h3><div>Вы</div><div class="hh-bar"><i style="width:${Math.round(100 * f.hp / f.mx)}%;background:#5ac04a"></i></div><div>${hhEsc(f.w)}</div><div class="hh-bar"><i style="width:${Math.round(100 * f.ohp / f.omx)}%;background:#d0603a"></i></div><div class="small">Бой идёт сам: считают сила, ловкость и стойкость. Настоящее здоровье не страдает.</div>`;
  }
  x += `<h3>Дуэль</h3><div class="small">Рекорд: <b>${I.dw}</b> побед, <b>${I.dl}</b> поражений. Бой «до первой кружки» — героя это не калечит.</div>`;
  for (const f of I.ask) x += `<div class="hh-near"><span><b>${hhEsc(f)}</b> вызывает вас на дуэль!</span><button class="hh-b" data-hh="acc">Принять</button><button class="hh-b sec" data-hh="dec">Отказать</button></div>`;
  if (!I.on.length) x += '<div class="small">В деревне больше никого нет — дуэлянтов пока не видно. Испытания ниже ждут одиночек.</div>';
  for (const o of I.on) {
    const C = hhClsMeta(o.c);
    x += `<div class="hh-row"><div><b style="color:${C.col}">${hhEsc(o.n)}</b> <small>${hhEsc(C.name)} · ур. ${o.l}</small></div><button class="hh-b" data-hh="duel:${hhEsc(o.n)}" ${I.near && !I.busy && !o.b ? '' : 'disabled'}>Вызвать</button></div>`;
  }
  x += `<h3>Испытания <small>осталось сегодня: ${I.tl}</small></h3>`;
  for (let k = 1; k < HH_TIERS.length; k++) {
    const T = HH_TIERS[k];
    const lock = T.l2 && I.lvl < 2 ? 'нужен зал 2 уровня' : (Game.hero && Game.hero.hero.level < T.lvl ? `нужен ${T.lvl} уровень` : '');
    x += `<div class="hh-row"><div><b>${k}. ${T.name}</b><br><small>${T.info} Награда: ${T.xp} опыта, ${T.gold} зол. в казну, честь +${T.hon}${lock ? ' · ' + lock : ''}</small></div><button class="hh-b" data-hh="trial:${k}" ${I.near && !I.busy && I.tl > 0 && !lock ? '' : 'disabled'}>Вызов</button></div>`;
  }
  if (I.log && I.log.length) x += '<h3>Недавно на арене</h3>' + I.log.slice().reverse().map(t => `<div class="small">• ${hhEsc(t)}</div>`).join('');
  return x;
}

function hhPaneClass(I) {
  const h = Game.hero, H = h && h.hero;
  if (!H) return '';
  const cur = hhClsMeta(H.clsKey);
  let x = hhNearBar(I) + `<h3>Сейчас: <span style="color:${cur.col}">${hhEsc(cur.name)}</span> · ур. ${H.level}</h3>`;
  const lvlOk = H.level >= 3, goldOk = I.gold >= I.price;
  x += `<div class="small">Цена смены: <b>${I.price}</b> зол. из казны деревни (сейчас ${I.gold}); растёт с каждой сменой${I.lvl >= 2 ? ', в зале 2 уровня на четверть дешевле' : ''}. С 3 уровня, не чаще раза в 2 дня${I.wait ? ` — подождите ещё ${I.wait}` : ''}. Ранги мастерства в гильдиях придётся учить заново; здоровье пересчитается.</div>`;
  x += '<div class="hh-cls">';
  for (const [k, C] of Object.entries((Coop.meta && Coop.meta.classes) || {})) {
    const same = k === H.clsKey;
    const off = same || !I.near || !lvlOk || I.wait > 0 || !goldOk || I.busy;
    x += `<button style="--c:${C.col}" data-hh="cls:${k}" ${off ? 'disabled' : ''}><img src="${portraitURL('hero_' + k, 7)}" alt=""><b>${hhEsc(C.name)}</b><span>${same ? 'это вы' : hhEsc(C.info)}</span><small>здоровье ${C.hp}</small></button>`;
  }
  x += '</div>';
  x += `<div class="small" style="margin-top:6px">Смен класса: ${I.cc}. ${!lvlOk ? 'Подрастите до 3 уровня.' : ''}</div>`;
  return x;
}

function hhPaneLook(I) {
  const h = Game.hero;
  if (!h) return '';
  return `<h3>Облик героя</h3><div class="hh-row"><img src="${portraitURL('hero', h.look)}" alt="" style="width:64px;height:64px;image-rendering:pixelated;border:2px solid #5a4620;border-radius:6px"><div>Колпак, борода, усы, цвета. Все в деревне видят вас таким. Бесплатно, не нужно быть рядом с залом — то же окно открывается из карточки героя («✎ Облик героя»).</div><button class="hh-b" data-hh="look">Переодеться</button></div>`;
}

function hhPaneBoard(I) {
  const b = HH.board;
  if (!b) return '<div class="small">Писарь ищет чернила…</div>';
  const hall = hhHall(), max = hhLvl(hall) >= 2 ? 10 : 5;
  let x = `<h3>Доска почёта${hhLvl(hall) < 2 ? ' <small>(в зале 2 уровня — десятка)</small>' : ''}</h3><table class="hh-tb"><tr><th>#</th><th>Герой</th><th>Честь</th><th>Дуэли</th><th>Испыт.</th><th>Титулов</th></tr>`;
  b.slice(0, max).forEach((e, i) => {
    const C = hhClsMeta(e.c0);
    x += `<tr class="${e.n === Coop.nick ? 'me' : ''}"><td>${i + 1}</td><td>${e.on ? '● ' : ''}<b style="color:${C.col}">${hhEsc(e.n)}</b> <small>${hhEsc(C.name)} ${e.l} ур.${e.tt ? ' · «' + hhEsc(e.tt) + '»' : ''}</small></td><td>${e.p}</td><td>${e.dw}/${e.dl}</td><td>${e.tw}</td><td>${e.t}</td></tr>`;
  });
  x += '</table><div class="small">Честь даёт дуэль (+3, поражение +1), испытание (+1…4) и каждый новый титул (+2) — в том числе за ярмарку и босса.</div>';
  return x + `<div style="margin-top:6px"><button class="hh-b sec" data-hh="board">Обновить</button></div>`;
}

const HH_TABS = [['q', 'Задания'], ['a', 'Арена'], ['c', 'Класс'], ['l', 'Облик'], ['b', 'Доска почёта']];
function hhRender(force) {
  const win = document.getElementById('hh-win');
  if (!win) return;
  const I = hhMe();
  const pane = win.querySelector('.hh-pane');
  if (!I || !I.has) { pane.innerHTML = '<div class="small">Зала героев в деревне больше нет.</div>'; return; }
  const t = HH.ui.tab;
  const html = t === 'q' ? hhPaneQuests(I) : t === 'a' ? hhPaneArena(I) : t === 'c' ? hhPaneClass(I) : t === 'l' ? hhPaneLook(I) : hhPaneBoard(I);
  for (const b of win.querySelectorAll('.hh-tabs button')) b.classList.toggle('on', b.dataset.hh === 'tab:' + t);
  win.querySelector('.hh-top h2').textContent = `Зал героев${I.lvl >= 2 ? ' · 2 ур.' : ''} · честь ${I.p}`;
  if (force || pane.dataset.h !== html) { const st = pane.scrollTop; pane.dataset.h = html; pane.innerHTML = html; pane.scrollTop = st; }
}

function hhOpen(tab) {
  hhCss();
  document.getElementById('hh-win')?.remove();
  if (tab) HH.ui.tab = tab;
  const win = document.createElement('div');
  win.id = 'hh-win';
  win.innerHTML = `<div class="hh-card"><div class="hh-top"><h2>Зал героев</h2><button class="hh-x" data-hh="close" title="Закрыть (Esc)">×</button></div>
    <div class="hh-tabs">${HH_TABS.map(([k, n]) => `<button data-hh="tab:${k}">${n}</button>`).join('')}</div><div class="hh-pane"></div></div>`;
  document.body.appendChild(win);
  win.addEventListener('click', e => { if (e.target === win) win.remove(); });
  hhAskBoard(true);
  hhRender(true);
}

function hhAskBoard(force) {
  if (!force && Date.now() - HH.boardAt < 8000) return;
  HH.boardAt = Date.now();
  coopSend({ t: 'board' });
}

function hhAskPrompt() {
  const I = hhMe();
  const from = I && I.has && I.ask && I.ask[0];
  const el = document.getElementById('hh-ask');
  if (!from) { if (el) el.remove(); HH.askShown = ''; return; }
  if (el && HH.askShown === from) return;
  hhCss();
  el?.remove();
  HH.askShown = from;
  const box = document.createElement('div');
  box.id = 'hh-ask';
  box.innerHTML = `<div><b>${hhEsc(from)}</b> вызывает вас на дуэль в зале героев!</div><div style="margin-top:6px"><button class="hh-b" data-hh="acc">Принять</button> <button class="hh-b sec" data-hh="dec">Отказать</button></div>`;
  document.body.appendChild(box);
}

function hhClick(e) {
  const el = e.target.closest && e.target.closest('[data-hh]');
  if (!el || el.disabled) return;
  e.stopPropagation();
  const [k, v] = el.dataset.hh.split(':');
  const I = hhMe();
  switch (k) {
    case 'open': hhOpen(); break;
    case 'close': document.getElementById('hh-win')?.remove(); break;
    case 'tab': HH.ui.tab = v; if (v === 'b') hhAskBoard(true); hhRender(true); break;
    case 'go': if (I && I.door) coopSend({ t: 'go', x: I.door[0], y: I.door[1] }); document.getElementById('hh-win')?.remove(); break;
    case 'duel': coopSend({ t: 'hall', a: 'duel', who: el.dataset.hh.slice(5) }); break;
    case 'acc': coopSend({ t: 'hall', a: 'accept' }); document.getElementById('hh-ask')?.remove(); HH.askShown = ''; HH.ui.tab = 'a'; break;
    case 'dec': coopSend({ t: 'hall', a: 'decline' }); document.getElementById('hh-ask')?.remove(); HH.askShown = ''; break;
    case 'trial': coopSend({ t: 'hall', a: 'trial', tier: +v }); break;
    case 'rr': coopSend({ t: 'hall', a: 'reroll', i: +v }); break;
    case 'cls': {
      const C = hhClsMeta(v);
      if (confirm(`Стать классом «${C.name}» за ${I ? I.price : '?'} зол. из казны деревни? Ранги мастерства гильдий сбросятся.`)) coopSend({ t: 'hall', a: 'cls', cls: v });
      break;
    }
    case 'look': if (typeof haEditNow === 'function') haEditNow(); break;
    case 'board': hhAskBoard(true); break;
  }
}

function hhClientInit() {
  if (HH.clientOn) return;
  HH.clientOn = true;
  document.addEventListener('click', hhClick, true);
  document.addEventListener('keydown', e => { if (e.code === 'Escape') document.getElementById('hh-win')?.remove(); });
  const _ch = coopHandle;
  coopHandle = function (m) {
    if (m.t === 'board') {
      HH.board = (m.list || []).map(e => Object.assign({}, e, { c0: e.c }));
      hhRender(true);
      return;
    }
    _ch(m);
    if (m.t === 'me') { hhRender(false); hhAskPrompt(); }
  };
  const _ib = infoBuilding;
  infoBuilding = function (b) {
    let h = _ib(b);
    if (b.type === 'herohall' && b.state === 'done' && !b.removed && hhMirror()) {
      const I = hhMe();
      const x = `<div class="irow"><button class="hp-ab" data-hh="open" style="width:100%"><b>Открыть зал героев</b><small>задания · арена · класс · облик · доска почёта</small></button></div>`
        + (I && I.has ? `<div class="irow small muted">Ваша честь: <b>${I.p}</b> · дуэли ${I.dw}/${I.dl} · испытаний ${I.tw}${I.near ? '' : ' · герой далеко от двери'}</div>` : '');
      const i = h.lastIndexOf('<div class="idesc">');
      h = i >= 0 ? h.slice(0, i) + x + h.slice(i) : h + x;
    }
    return h;
  };
}

if (typeof coopHandle === 'function') hhClientInit();

// ---------- Сервер: подключение через шаг симуляции ----------

{
  for (const fn of ['setupStart', 'applySave']) {
    const _f = globalThis[fn];
    globalThis[fn] = function (...a) { const r = _f.apply(this, a); if (!HH.hooked && hhServer() && typeof coopCmd === 'function') hhServerHook(); return r; };
  }
  const _st = step;
  step = function (dt) {
    _st(dt);
    if (hhServer()) {
      if (!HH.hooked && typeof coopCmd === 'function') hhServerHook();
      if (HH.hooked && (HH.duels.length || HH.trials.size || HH.asks.size)) hhTick();
    }
  };
}
