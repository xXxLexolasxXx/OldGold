'use strict';
// Начало игры: первый шаг обучения — большой костёр (фундамент, который складывают после касания),
// сцены лора чередуются с шагами обучения (одна сцена между двумя шагами, следующий шаг её ждёт),
// заставка главы не открывается поверх сцены, цели «Пережить N ночей» со склонением.
// Запуск: node tests/newstart-test.js
const L = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };

const sim = L.newSim(11);
const h = sim.h;
const run = s => h.run(s);

// ---- 1. «Пережить ночь / N ночей»
const nightsText = n => run(`goalNightsText(${n})`);
for (const [n, want] of [[1, 'Пережить ночь'], [2, 'Пережить 2 ночи'], [3, 'Пережить 3 ночи'], [5, 'Пережить 5 ночей'], [11, 'Пережить 11 ночей'], [12, 'Пережить 12 ночей'], [21, 'Пережить 21 ночь'], [24, 'Пережить 24 ночи'], [25, 'Пережить 25 ночей']])
  ok(nightsText(n) === want, `goalNightsText(${n}) = «${nightsText(n)}», ждали «${want}»`);
const chapterNights = JSON.parse(run(`JSON.stringify(GOAL_CHAPTERS.flatMap(c => c.goals.filter(o => o.k === 'nights').map(o => goalObjective(o, goalStats()).t)))`));
ok(chapterNights.length >= 3, 'в главах меньше трёх целей на ночи: ' + chapterNights.length);
for (const t of chapterNights) ok(t !== 'Пережить ночей' && /^Пережить (ночь|\d+ ноч(и|ей|ь))$/.test(t), 'цель главы без числа или склонения: «' + t + '»');
ok(run(`GOAL_NEED_NAMES.nights`) === 'пережито ночей', '«До деревни»: подпись ночей — ' + run(`GOAL_NEED_NAMES.nights`));

// ---- 2. Шаги обучения: первый — костёр, id уникальны, сцены лора ссылаются на настоящие шаги
const ids = JSON.parse(run(`JSON.stringify(TUT_STEPS.map(s => s.id))`));
ok(ids[0] === 'fire', 'первый шаг обучения не костёр: ' + ids[0]);
ok(ids.every(Boolean) && new Set(ids).size === ids.length, 'у шагов обучения нет id или они повторяются: ' + ids.join(','));
const loreSrc = require('fs').readFileSync(require('path').join(__dirname, '../js/lore.js'), 'utf8');
for (const m of loreSrc.matchAll(/loreTut\('(\w+)'\)/g)) ok(ids.includes(m[1]), 'лор ссылается на несуществующий шаг обучения: ' + m[1]);
ok(!/loreTut\(\d/.test(loreSrc), 'лор ещё ссылается на шаг обучения по номеру');

// ---- 3. Костёр: в новой деревне — фундамент, ждёт касания, потом его складывают строители
run(`Game.time = 5; Tut.coop = false; tutFireSite();`);
const bf = () => JSON.parse(run(`JSON.stringify(Game.buildings.filter(b => b.type === 'bonfire' && !b.removed).map(b => ({ s: b.state, hold: !!b.hold })))`));
ok(bf().length === 1 && bf()[0].s === 'site' && bf()[0].hold, 'стартовый костёр не стал фундаментом: ' + JSON.stringify(bf()));
ok(run(`TUT_STEPS[0].done()`) === false, 'шаг «костёр» засчитан до постройки');
L.runFor(sim, 60, 5);
ok(bf()[0].s === 'site', 'фундамент костра начали строить без касания: ' + JSON.stringify(bf()));
run(`Game.selected = Game.buildings.find(b => b.type === 'bonfire' && !b.removed); tutFireTick(); Game.selected = null;`);
ok(!bf()[0].hold, 'касание фундамента не отпустило стройку');
let builtAt = -1;
L.runFor(sim, 400, 5, k => { if (builtAt < 0 && bf()[0].s === 'done') builtAt = (k + 1) * 5; });
ok(builtAt > 0, 'костёр не сложили за 400 с после касания: ' + JSON.stringify(bf()));
ok(run(`TUT_STEPS[0].done()`) === true, 'шаг «костёр» не засчитан после постройки');
// повтор обучения в старой деревне костёр не трогает
run(`Game.time = 5000; tutFireSite();`);
ok(bf().length === 1 && bf()[0].s === 'done', 'повтор обучения сломал готовый костёр');

// ---- 4. Чередование: сцена лора — только между шагами, следующий шаг её ждёт
run(`Tut.on = false; loreTick(0);   // первый тик запоминает мир (и сбрасывает часы лора)
  Lore.playT = 100; Lore.lastAt = 99; Lore.pend = null; Lore.cur = null; Lore.found = {}; Notify.modals = [];
  Tut.on = true; Tut.i = 2; Tut.ok = [true, true]; Tut.doneAt = 0; Tut.loreSlot = false;`);
ok(run(`!!loreTutPick(true)`), 'нет готовой сцены обучения для проверки чередования');
run(`loreTick(0.1)`);
ok(run(`Lore.pend === null && Notify.modals.length === 0`), 'сцена лора встала в очередь посреди шага обучения');
run(`Tut.doneAt = performance.now(); Tut.loreSlot = true; loreTick(0.1)`);
ok(run(`Lore.pend === null`), 'сцена лора встала в очередь, пока висит «✔ Готово»');
ok(run(`tutLoreHold()`), 'следующий шаг не ждёт готовую сцену');
run(`Tut.doneAt = performance.now() - 1300; loreTick(0.1)`);
ok(run(`!!Lore.pend && Notify.modals.length === 1`), 'в паузе между шагами сцена не встала в очередь (без интервала LORE_TUT_GAP)');
ok(run(`tutLoreHold()`), 'следующий шаг не ждёт сцену в очереди');
// сцена на экране: заставка главы ждёт её
run(`Lore.cur = { f: Lore.pend, i: 0 }; Lore.pend = null; Tut.loreSlot = false;`);
ok(run(`goalCutWait()`), 'заставка главы откроется поверх сцены лора');
ok(run(`tutLoreHold()`), 'следующий шаг обучения начнётся поверх сцены лора');
// сцену закрыли: пауза, потом шаг
run(`Lore.cur = null; Lore.closedAt = performance.now();`);
ok(run(`tutLoreHold()`), 'следующий шаг начался сразу после сцены, без паузы');
ok(run(`goalCutWait()`), 'заставка главы открылась сразу после сцены, без паузы');
run(`Lore.closedAt = performance.now() - 2000; Tut.doneAt = performance.now() - 2500;`);
ok(!run(`tutLoreHold()`), 'после паузы шаг обучения всё ещё ждёт');
// вторая сцена в ту же паузу не попадает
run(`Lore.found = {}; Notify.modals = []; loreTick(0.1)`);
ok(run(`Lore.pend === null`), 'вторая сцена подряд между теми же шагами');

for (const e of sim.errors) fails.push('исключение в симуляции: ' + e);
for (const m of [...new Set(fails)]) console.log('✗ ' + m);
console.log(fails.length ? '' : `Проверка начала игры: костёр первым шагом (сложили через ${builtAt} с после касания), лор и обучение чередуются, ночи со склонением — ок`);
process.exit(fails.length ? 1 : 0);
