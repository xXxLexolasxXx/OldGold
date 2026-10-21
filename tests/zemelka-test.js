'use strict';
// Земелька (ножички, world/zemelka.js): партия гномов от круга до победы, сохранение земли, болельщики,
// партия героя с гномом (прицел, бросок по команде, счёт, сохранение), кадры броска. Запуск: node tests/zemelka-test.js
const S = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

const sim = S.newSim(7);
const h = sim.h;
const DAY = 'Game.time = 30; WX.k = 0; WX.target = 0; WX.nextRain = 1e12; Game.noGrace = true; gameNext = 0; for (const g of GROUPS.slice()) endGroup(g, "test"); GROUPS.length = 0; Game.games = []; for (const u of Game.units) u.pauseUntil = 0;';   // время отмотано назад — «замри» из будущего сбрасываем
h.run(DAY);
h.run('Math.random = __rnd');

ok(h.run('ZT_ROT.length === 9 && ZT_LIFT.length === 9 && ZT_WX.length === 9 && ZT_WY.length === 9 && ZT_KR.length === 9'), 'кадров броска не 9');
ok(h.run('ZEM_TRICKS.length') === 8, 'в лесенке не 8 приёмов');

// ---- партия гномов (партия может распасться, если гнома отозвали по делам: тогда пробуем ещё раз, до трёх партий)
let gameSeen = false, maxFans = 0, areaSum = null, areaOk = true, states = new Set(), cuts = 0, stuck = false, lad = 0;
let ended = false, win = null;
for (let attempt = 0; attempt < 3 && !(states.has('stick') && states.has('end')); attempt++) {
if (attempt) h.run(DAY);
h.run(`{
  const ppl = Game.units.filter(u => isPerson(u) && u.type !== 'hero' && u.type !== 'kid' && !u.isCourier).slice(0, 7);
  const a = ppl[0], hx = Math.floor(a.x), hy = Math.floor(a.y);
  ppl.forEach((u, i) => { u.food = 1; u.idleFlag = true; u.proc = null; u.action = null; u.cmd = null; u.brk = null; u.inside = null; });
  globalThis.__lead = a.id;
  a.proc = (function* () { const g = startKnives(a); if (g) yield* g; else yield { wait: 0.5 }; })();
}`);
gameSeen = false; areaSum = null;
for (let t = 0; t < 4 && !gameSeen; t++) {
  S.runFor(sim, 20, 0.5, () => { if (h.run('GROUPS.some(g => g.kind === "knives")')) gameSeen = true; });
  if (!gameSeen) h.run(`{ gameNext = 0; const a = Game.unitMap.get(__lead); a.gp = null; a.proc = (function* () { const g = startKnives(a); if (g) yield* g; else yield { wait: 0.5 }; })(); a.action = null; a.idleFlag = true; }`);
}
ok(gameSeen, 'партия в ножички не началась');
S.runFor(sim, 150, 0.25, () => {
  const r = h.run(`(() => { const g = GROUPS.find(g => g.kind === 'knives'); if (!g) return null; const s = knifeState(g.vis);
    return JSON.stringify({ st: g.st, fans: g.fans.length, a: s.area[1] + s.area[2], cuts: g.vis.cuts.length, win: g.vis.win, lad: Math.max(g.lad[0], g.lad[1]), kn: g.vis.kn.filter(Boolean).length, sc: g.vis.sc }); })()`);
  if (!r) { if (gameSeen && states.size > 3) ended = true; return; }
  const o = JSON.parse(r);
  states.add(o.st); maxFans = Math.max(maxFans, o.fans); cuts = Math.max(cuts, o.cuts); lad = Math.max(lad, o.lad);
  if (o.st !== 'gather' && o.st !== 'draw' && o.st !== 'divide') {
    if (areaSum === null) areaSum = o.a; else if (o.a !== areaSum) areaOk = false;
  }
  if (o.win !== undefined && o.win !== -1) win = o.win;
});
}
console.log(`гномы: состояния ${[...states].join(',')}, болельщиков до ${maxFans}, отрезов ${cuts}, лесенка до ${lad}, победитель ${win}`);
ok(states.has('fly') && states.has('stick') && states.has('cut') && states.has('end'), 'партия прошла не все состояния');
ok(ended || win !== null, 'партия не закончилась за 150 с');
ok(areaOk, 'площадь круга меняется при отрезании');
ok(cuts >= 1, 'ни один кусок земли не отрезан');
ok(h.run('GROUPS.filter(g => g.kind === "knives").length') === 0 || ended, 'группа не распущена');
ok(h.run('Game.units.every(u => !u.gp || u.gp.k !== "knives" || GROUPS.some(g => g.id === u.gp.gid))'), 'у гнома остался gp распущенной партии');

// ---- сохранение/загрузка не ломается, счёт героя
h.run(DAY);
const hero = h.run('Game.hero && Game.hero.id');
ok(hero, 'в одиночной игре нет героя');
h.run(`{
  const hr = Game.hero, ppl = Game.units.filter(u => isPerson(u) && u.type !== 'hero' && u.type !== 'kid' && !u.isCourier).slice(0, 6);
  for (const u of ppl) { u.x = hr.x + 2; u.y = hr.y + 1; u.food = 1; u.idleFlag = true; u.proc = null; u.action = null; u.cmd = null; u.gp = null; u.brk = null; u.inside = null; }
  hr.gp = null; hr.cmd = null; hr.food = 1; hr.hero.hp = hr.hero.maxhp;
}`);
let started = false;
for (let t = 0; t < 5 && !started; t++) {
  h.run(DAY);
  started = h.run('zemStartHero(Game.hero)');
  if (!started) S.runFor(sim, 2, 0.5, () => {});
}
ok(started, 'герой не смог начать партию с гномом');
let thrown = 0, heroDone = false, held = false, aimSeen = false;
S.runFor(sim, 200, 0.25, () => {
  const r = h.run(`(() => { const g = GROUPS.find(g => g.kind === 'knives'); if (!g) return null; return JSON.stringify({ st: g.st, mine: g.st === 'hold' && g.members[g.turn % 2] === Game.hero, aim: !!g.vis.aim, thr: g.throws }); })()`);
  if (!r) { if (started && thrown) heroDone = true; return; }
  const o = JSON.parse(r);
  if (o.aim) aimSeen = true;
  if (o.mine) { held = true; thrown++; h.run('zemAct(Game.hero, "throw")'); }
});
console.log(`герой: бросков человека ${thrown}, прицел был ${aimSeen}`);
ok(held && aimSeen, 'очередь героя не наступила или прицела не было');
ok(h.run('Game.zem && Game.zem.n >= 1'), 'партия героя не записана в счёт');
const z0 = h.run('JSON.stringify(Game.zem)');
const sv = JSON.parse(h.run('JSON.stringify(serializeGame())'));
ok(sv.zem && sv.zem.n >= 1, 'счёт не пишется в сохранение');
h.ctx.__s = sv; h.run('applySave(__s)');
ok(h.run('JSON.stringify(Game.zem)') === z0, 'счёт не восстановился из сохранения');
h.run('Game.zem = null; applySave(Object.assign({}, __s, { zem: undefined }))');
ok(h.run('Game.zem') === null, 'старое сохранение без счёта не обнулило поле');

// ---- ошибки симуляции
ok(sim.errors.length === 0, 'исключения в симуляции: ' + sim.errors.slice(0, 3).join(' | '));

console.log(fails.length ? `Проверка земельки: ПРОВАЛ (${fails.length})` : 'Проверка земельки: ok');
if (fails.length) { for (const f of fails) console.log('✗ ' + f); process.exit(1); }
process.exit(0);
