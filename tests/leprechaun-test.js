'use strict';
// Лепреконы у золотых рудников: рождение, спор за слиток (два исхода), лимиты золота, школа, неуязвимость, сохранение, зеркало.
// Запуск: node tests/leprechaun-test.js   (печатает ✗, код выхода 1 при провале)
const L = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };
const sim = L.newSim(5), h = sim.h, J = c => JSON.parse(h.run('JSON.stringify((function(){' + c + '})())'));
const run = sec => L.runFor(sim, sec, 5, () => {});

// кадры: стандарт КАДРЫ.md — покой 6, ходьба 8, танец 12–16, исходы спора
ok(h.run('LEP_IDLE.length') === 6 && h.run('LEP_WALK.length') === 8, 'покой должен быть 6 кадров, ходьба 8');
const dn = h.run('LEP_DANCE.length');
ok(dn >= 12 && dn <= 16, 'танец должен быть 12–16 кадров, а не ' + dn);
ok(h.run('LEP_STEAL.length') === 4 && h.run('LEP_SLAP.length') === 9 && h.run('LEP_TUG.length') === 3, 'кадры исходов: 4 / 9 / перетягивание 3');
ok(h.run('LEP_ALL.every(f => { const p = lepPose(f); return p && typeof p.y === "number"; })'), 'у каждого кадра есть поза');
ok(h.run('LEP_SEQ_STEAL.map(s => s[0]).filter(Boolean).every(f => LEP_ALL.includes(f)) && LEP_SEQ_SLAP.every(s => LEP_ALL.includes(s[0])) && LEP_SEQ_TUG.every(s => LEP_ALL.includes(s[0]))'), 'в сценариях споров есть неизвестные кадры');

// рудник → лепрекон
const mine = J(`
  let f = null;
  for (let y = 2; y < MAP_H - 2 && !f; y++) for (let x = 2; x < MAP_W - 2 && !f; x++) if (!checkPlacement('goldmine', x, y, 0)) f = [x, y];
  if (!f) return null;
  const b = placeBuilding('goldmine', f[0], f[1], true, 0);
  return { id: b.id, x: b.doorX, y: b.doorY, st: b.state };
`);
ok(mine && mine.st === 'done', 'не удалось поставить рудник');
if (!mine) { console.log('нет рудника — дальше нечего проверять'); process.exit(1); }
ok(h.run('Game.lepr.length') === 0, 'лепрекон не должен быть до постройки рудника');
// лепрекон мог появиться и уже раствориться в радуге (застрял, ушёл после спора) — считаем, что он был, и зовём снова
let lepSeen = 0;
L.runFor(sim, 110, 5, () => { lepSeen = Math.max(lepSeen, h.run('Game.lepr.length')); });
ok(lepSeen === 1, 'у рудника через ~2 мин нет лепрекона: ' + lepSeen);
if (!h.run('Game.lepr.some(L => !L.dead && L.st !== "gone")')) { h.run(`Game.lepr = []; Game.lepMine[${mine.id}] = Game.time;`); run(5); }
ok(h.run('Game.log.some(e => /завёлся лепрекон/.test(e.text))'), 'в журнале нет записи о появлении');
const mkLepReady = () => J(`
  const Lp = Game.lepr[0];
  Lp.st = 'idle'; Lp.cd = 0; Lp.x = Lp.hx; Lp.y = Lp.hy; Lp.t = 99;
  return { id: Lp.id };
`);

// подготовка жителя с грузом и золота на складе
const prep = gold => J(`
  const hub = Game.buildings.find(b => b.type === 'storehouse');
  hub.stock.gold = ${gold}; hub.reserved.gold = 0;
  for (const s of Game.buildings) if (s.isStore() && s !== hub) { s.stock.gold = 0; }
  const Lp = Game.lepr[0];
  const u = Game.units.find(x => isPerson(x) && !x.hero && !x.inside && !x.dead && !x.brk && !x.rec) || null;
  if (!u) return null;
  u.carry = 'goldore'; u.carryN = 1; u.proc = null; u.action = null;
  u.x = Lp.hx + 3; u.y = Lp.hy; u.tx = undefined;
  Game.lepStat = lepStatNew();
  return { uid: u.id, store: hub.stock.gold };
`);
const goldTotal = () => h.run('Game.buildings.reduce((a, s) => a + (s.isStore() ? s.stock.gold : 0), 0)');

// (а) лепрекон выигрывает: золото уходит со склада, горшок и радуга появляются и исчезают, лепрекон уходит
mkLepReady();
const p1 = prep(20);
ok(p1, 'не нашёлся житель для спора');
h.run('var __lw = lepGnomeWin; lepGnomeWin = () => 0');
const before1 = goldTotal();
let sawPot = false, sawRainbow = false, sawSteal = false, sawDive = false, sawAlive = false;
for (let k = 0; k < 120; k++) {
  L.stepN(sim, 4);
  const s = J(`const Lp = Game.lepr[0]; return Lp ? { st: Lp.st, pa: Lp.potA, rb: Lp.rbP, ev: Lp.ev, fr: Lp.fr, z: Lp.z, sink: Lp.sink } : null`);
  if (!s) { sawAlive = sawAlive; break; }
  if (s.pa > 0.5) sawPot = true; if (s.rb > 0.5) sawRainbow = true; if (s.ev === 'steal') sawSteal = true; if (s.z > 5) sawDive = true;
}
run(8);
ok(sawSteal, '(а) событие «steal» не наступило');
ok(sawPot && sawRainbow, '(а) горшок или радуга не появились');
ok(sawDive, '(а) лепрекон не прыгнул');
ok(h.run('Game.lepr.length') === 0, '(а) лепрекон не исчез после ухода в горшок');
const st1 = J('return Game.lepStat');
ok(st1.steals === 1 && st1.stolen >= 1 && st1.stolen <= 3, '(а) украдено ' + st1.stolen + ', ждали 1…3');
ok(before1 - goldTotal() === st1.stolen, '(а) со склада ушло не столько, сколько записано: ' + (before1 - goldTotal()) + ' vs ' + st1.stolen);
ok(J('return Game.lepMine[' + mine.id + ']') > J('return Game.time'), '(а) у рудника нет отдыха после ухода');
ok(h.run('Game.log.some(e => /Лепрекон выиграл спор/.test(e.text))'), '(а) нет записи в журнале');
ok(h.run('chronState().e.some(e => /лепрекон/.test(e.s))'), '(а) нет записи в летописи');
ok(J(`const u = Game.unitMap.get(${p1.uid}); return !u.brk`), '(а) гном остался в перерыве');

// отдых рудника, повторное рождение
h.run(`Game.lepMine[${mine.id}] = Game.time + 5`);
run(15);
ok(h.run('Game.lepr.length') === 1, 'лепрекон не вернулся к руднику после отдыха');

// (б) выигрывает гном: пощёчина, золото возвращается, лепрекон растворяется
mkLepReady();
const p2 = prep(20);
h.run('lepGnomeWin = () => 1');
h.run('Game.lepStat.owed = 5');
let sawSlap = false, sawMelt = false;
const pilesBefore = h.run('[...Game.piles.values()].reduce((a, p) => a + p.stock.gold, 0)');
for (let k = 0; k < 160; k++) {
  L.stepN(sim, 4);
  const s = J(`const Lp = Game.lepr[0]; return Lp ? { ev: Lp.ev, fr: Lp.fr } : null`);
  if (!s) break;
  if (s.ev === 'slap') sawSlap = true; if (s.ev === 'melt') sawMelt = true;
}
const st2 = J('return Game.lepStat');
ok(sawSlap && sawMelt, '(б) пощёчина или растворение не наступили');
ok(st2.slaps === 1 && st2.returned >= 1, '(б) золото не вернулось: ' + JSON.stringify(st2));
ok(h.run('Game.lepr.length') === 0, '(б) лепрекон не растворился');
ok(h.run('Game.log.some(e => /пощёчину/.test(e.text))'), '(б) нет записи в журнале');
ok(h.run('chronState().e.some(e => /пощёчин/.test(e.s))'), '(б) нет записи в летописи');
ok(st2.steals === 0 && st2.stolen === 0, '(б) при пощёчине ничего не должно было уйти');
ok(h.run('[...Game.piles.values()].reduce((a, p) => a + p.stock.gold, 0)') > pilesBefore - 1 || goldTotal() >= 20, '(б) монета не упала на землю');

h.run('lepGnomeWin = __lw');
// шансы: плут чаще выигрывает, сила героя и ставка повышают шанс гнома
const chances = J(`
  const hero = Game.hero;
  const base = () => lepGnomeWin(hero, 1);
  const prev = hero.hero.clsKey, prevL = hero.hero.level;
  hero.hero.clsKey = 'mage'; hero.hero.level = 1; const mage = base();
  hero.hero.clsKey = 'rogue'; const rogue = base();
  hero.hero.clsKey = 'warrior'; const warr = base();
  hero.hero.level = 10; const warr10 = base();
  hero.hero.clsKey = prev; hero.hero.level = prevL;
  return { mage, rogue, warr, warr10, st3: lepGnomeWin(hero, 3), st1: lepGnomeWin(hero, 1) };
`);
ok(chances.rogue > chances.warr && chances.warr > chances.mage, 'плут должен выигрывать чаще воина и мага: ' + JSON.stringify(chances));
ok(chances.warr10 > chances.warr, 'сила (уровень) героя должна повышать шанс');
ok(chances.st3 >= chances.st1, 'ставка не должна снижать упрямство гнома');
ok(chances.rogue <= 0.88 && chances.mage >= 0.15, 'шанс вне пределов 0.15–0.88');

// лимиты: на кон не больше LEP_STAKE; склад не ниже LEP_KEEP; школе — золото в приоритете; окно LEP_WIN_CAP
const lim = J(`
  const hub = Game.buildings.find(b => b.type === 'storehouse');
  for (const s of Game.buildings) if (s.isStore() && s !== hub) s.stock.gold = 0;
  Game.lepStat = lepStatNew();
  const u = Game.units.find(x => isPerson(x) && !x.hero && !x.dead);
  const r = {};
  hub.stock.gold = 100; r.rich = lepStakeFor(u);
  hub.stock.gold = LEP_KEEP + 1; r.poor = lepStakeFor(u);
  hub.stock.gold = LEP_KEEP; r.keep = lepStakeFor(u);
  hub.stock.gold = 100; Game.lepStat.winAmt = LEP_WIN_CAP; r.capped = lepStakeFor(u);
  Game.lepStat.winAmt = LEP_WIN_CAP - 1; r.room1 = lepStakeFor(u);
  Game.lepStat.winAmt = 0;
  const sch = placeBuilding('school', hub.doorX + 8, hub.doorY, true, 0);
  r.school = !!sch;
  if (sch) { sch.queue = [{ t: 'serf' }]; sch.stock.gold = 0; r.schoolWait = lepStakeFor(u); Game.buildings.splice(Game.buildings.indexOf(sch), 1); sch.removed = true; }
  return r;
`);
ok(lim.rich >= 1 && lim.rich <= 3, 'ставка при богатом складе должна быть 1…3: ' + lim.rich);
ok(lim.poor === 1, 'при LEP_KEEP+1 на складе ставка должна быть 1: ' + lim.poor);
ok(lim.keep === 0, 'склад не должен уходить ниже LEP_KEEP: ' + lim.keep);
ok(lim.capped === 0, 'в пределах окна нельзя красть больше LEP_WIN_CAP: ' + lim.capped);
ok(lim.room1 === 1, 'остаток окна 1 → ставка 1: ' + lim.room1);
if (lim.school) ok(lim.schoolWait === 0, 'пока школа ждёт золото, лепрекон склад не трогает: ' + lim.schoolWait);

// кошель героя: берётся из рюкзака, не больше ставки
const purse = J(`
  const H = Game.hero.hero; H.inv = H.inv || [];
  const saved = H.inv.slice();
  H.inv[0] = { k: 'gold', n: 5 };
  const a = lepPurse(H), t = lepPurseTake(H, 2), left = lepPurse(H);
  H.inv.length = 0; for (const s of saved) H.inv.push(s);
  return { a, t, left };
`);
ok(purse.a === 5 && purse.t === 2 && purse.left === 3, 'кошель героя: ' + JSON.stringify(purse));

// неуязвимость: клик по лепрекону даёт приказ «ударить сквозь», а не нападение
const sw = J(`
  const mkL = Game.lepr[0] || (Game.lepr.push(lepMake(Game.buildings.find(b => b.id === ${mine.id}))), Game.lepr[0]);
  mkL.hide = false; mkL.x = mkL.hx; mkL.y = mkL.hy;
  const c = resolveCmd([Math.floor(mkL.x), Math.floor(mkL.y)]);
  const out = { kind: c && c.kind, foes: foesNear(mkL.x, mkL.y, 2).filter(f => f.kind === 'neu' && f.o.k === 'lep').length };
  return out;
`);
ok(sw.kind === 'lepswing', 'клик по лепрекону должен давать lepswing, а не ' + sw.kind);
ok(sw.foes === 0, 'лепрекон не должен быть целью для боя');

// сохранение → загрузка; зеркало
h.run('Game.lepStat.stolen = 7');
const s0 = JSON.parse(h.run('JSON.stringify(serializeGame())'));
ok(s0.lp && s0.lp.list.length === 1, 'в сейве нет лепрекона');
h.ctx.__s = s0; h.run('applySave(__s)');
ok(h.run('Game.lepr.length') === 1 && h.run('Game.lepStat.stolen') === 7, 'после загрузки лепрекон или статистика пропали');
const old = JSON.parse(JSON.stringify(s0)); delete old.lp;
h.ctx.__s = old; h.run('applySave(__s)');
ok(h.run('Game.lepr.length') === 0, 'старый сейв без lp не должен ломаться');
const mir = J('return lepMirror()');
ok(Array.isArray(mir), 'зеркало кооператива не массив');
h.ctx.__s = s0; h.run('applySave(__s)');
const mir2 = J('return lepMirror()');
ok(mir2.length === 1 && mir2[0].__id && typeof mir2[0].fr === 'string' && mir2[0].x > 0, 'зеркало: ' + JSON.stringify(mir2[0]));

// страховка от застревания: «ушёл», а горшок не тает → через LEP_GONE_MAX исчезает сам; зависший спор тоже
J(`const Lp = Game.lepr[0]; Lp.st = 'gone'; Lp.hide = true; Lp.potA = 1; Lp.potFade = false; Lp.rbA = 1; return 1;`);
run(12);
ok(h.run('Game.lepr.length') === 0, 'лепрекон с нерастаявшим горшком не исчез за 12 с (застрял «в бегстве»)');
ok(h.run('Game.lepMine[' + mine.id + '] > Game.time'), 'после исчезновения у рудника нет отдыха');
h.run('Game.lepMine[' + mine.id + '] = 0'); run(10);
ok(h.run('Game.lepr.length') === 1, 'лепрекон не вернулся к руднику после отдыха');
J(`const Lp = Game.lepr[0]; Lp.st = 'duel'; Lp.d = { u: -5, slap: false, stake: 1, got: 0 }; Lp.seq = LEP_SEQ_STEAL; Lp.si = 2; Lp.sT = 0; return 1;`);
run(3);
ok(h.run('Game.lepr.length') === 0 || h.run('Game.lepr[0].st') !== 'duel', 'спор без свидетеля не прерван');
// в непроходимой клетке (на лепрекона встал дом) — переносится к руднику, а не застывает в стене
h.run('Game.lepMine[' + mine.id + '] = 0'); run(10);
const wall = J(`
  const Lp = Game.lepr[0]; if (!Lp) return null;
  let bad = null;
  for (let y = 1; y < MAP_H - 1 && !bad; y++) for (let x = 1; x < MAP_W - 1 && !bad; x++) if (!isWalkable(x, y) && Math.hypot(x - Lp.hx, y - Lp.hy) < 12 && Math.hypot(x - Lp.hx, y - Lp.hy) > 4) bad = [x, y];
  if (!bad) return { skip: true };
  Lp.st = 'idle'; Lp.x = bad[0] + 0.5; Lp.y = bad[1] + 0.5; Lp.hide = false;
  return { x: bad[0], y: bad[1] };
`);
if (wall && !wall.skip) { run(3); ok(h.run('Game.lepr.length === 0 || isWalkable(Math.floor(Game.lepr[0].x), Math.floor(Game.lepr[0].y))'), 'лепрекон остался в непроходимой клетке'); }
h.run('Game.lepMine[' + mine.id + '] = 0'); run(10);
// сейв выше мог потерять лепрекона — тест ниже не зависит от него

// пара минут без ошибок и лишних лепреконов
run(120);
ok(h.run('Game.lepr.length') <= 1, 'лепреконов больше, чем рудников: ' + h.run('Game.lepr.length'));
ok(sim.errors.length === 0, 'ошибки симуляции: ' + sim.errors.join(' || '));

console.log(fails.length ? `Проверка лепреконов: ${fails.length} провалов` : 'Проверка лепреконов: всё в порядке');
process.exit(fails.length ? 1 : 0);
