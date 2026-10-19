'use strict';
// Летопись деревни: записи появляются, не превышают лимит, переживают сохранение, ночь/смерть пишутся, детерминированы.
// Запуск: node tests/chronicle-test.js [минуты]
const S = require('./lib/sim');
const MIN = +process.argv[2] || 10;
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

function run(seed) {
  const sim = S.newSim(seed);
  S.runFor(sim, MIN * 60, 10, k => { if (k % 3 === 0) S.botTurn(sim); });
  return sim;
}
const a = run(7), b = run(7);
const ea = JSON.parse(a.h.run('JSON.stringify(Game.chron ? Game.chron.e : [])'));
const eb = JSON.parse(b.h.run('JSON.stringify(Game.chron ? Game.chron.e : [])'));
console.log(`Проверка летописи: записей ${ea.length}, ошибок ${a.errors.length}`);
ok(!a.errors.length, 'исключения: ' + a.errors.slice(0, 2).join(' | '));
ok(ea.length >= 2, 'за ' + MIN + ' минут летопись почти пуста: ' + ea.length);
ok(ea.length === 0 || /Основана деревня/.test(ea[0].s), 'первая запись — основание деревни');
ok(JSON.stringify(ea) === JSON.stringify(eb), 'летопись не детерминирована: один сид — разные записи');
ok(ea.every(e => e.d >= 1 && typeof e.s === 'string' && e.s.length > 5 && !/undefined|NaN|\[object/.test(e.s)), 'мусор в тексте записей');

// смерть жителя: запись появляется на следующем шаге, уход (без роста потерь) — нет
a.h.run('Game.chronPend = null; { const u = Game.units.find(x => x.type === "serf" && !x.dead); const n0 = Game.chron.e.length; globalThis.__n0 = n0; logEvent("tree", "Скелет утащил в могилу: Трудяга", u.x, u.y); removeUnit(u); step(SIM_DT); step(SIM_DT); }');
const dead = JSON.parse(a.h.run('JSON.stringify(Game.chron.e.slice(__n0))'));
ok(dead.some(e => e.k === 'death' && /скелет/i.test(e.s)), 'гибель жителя не попала в летопись: ' + JSON.stringify(dead.map(e => e.s)));
a.h.run('{ const u = Game.units.find(x => x.type === "serf" && !x.dead); globalThis.__n1 = Game.chron.e.length; const l = Game.lostGnomes; removeUnit(u); Game.lostGnomes = l; step(SIM_DT); step(SIM_DT); }');
ok(a.h.run('Game.chron.e.length === __n1') === true, 'уход жителя записан как гибель');

// лимит и сохранение
a.h.run('for (let i = 0; i < 600; i++) { Game.chron.dayN = -1; chronAdd("goal", "тестовая запись " + i, 2); }');
ok(a.h.run('Game.chron.e.length <= CHRON_MAX') === true, 'лимит записей превышен');
const save = a.h.run('JSON.stringify(serializeGame().chron)');
ok(save && save.length > 100, 'летопись не попала в сохранение');
a.h.run('{ const s = JSON.parse(JSON.stringify(serializeGame())); applySave(s); }');
ok(a.h.run('Game.chron && Game.chron.e.length > 100') === true, 'после загрузки летопись пропала');
ok(!a.errors.length, 'исключения после загрузки: ' + a.errors.slice(0, 2).join(' | '));

console.log(fails.length ? `Провалов: ${fails.length}` : 'Летопись в порядке');
process.exit(fails.length ? 1 : 0);
