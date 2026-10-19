'use strict';
// Ежедневный вызов: карта и цель однозначно зависят от даты, цели разнообразны и достижимы по размеру,
// вызов заканчивается по цели/времени, результат пишется в localStorage и сравнивается со вчерашним, сохранение хранит вызов.
// Запуск: node tests/daily-test.js
const S = require('./lib/sim');
const sim = S.newSim(7);
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };
const J = code => JSON.parse(sim.h.run(`JSON.stringify((() => { ${code} })())`));

// 1. детерминизм и разнообразие
const a = J('return Daily.for("2026-10-19")'), b = J('return Daily.for("2026-10-19")'), c = J('return Daily.for("2026-10-20")');
ok(JSON.stringify(a) === JSON.stringify(b), 'одна дата — разные карты');
ok(a.seed !== c.seed, 'разные даты дали один сид');
const dist = J('const o = {}, bio = {}; for (let i = 0; i < 90; i++) { const d = Daily.for(dailyShift("2026-09-01", i)); o[d.goal.k] = (o[d.goal.k] || 0) + 1; bio[d.biome] = 1; if (d.seed < 1 || d.seed > 1e9) return "bad seed"; const g = dailyGoalDef(d.goal.k); if (d.goal.n < g.min || d.goal.n >= g.min + g.span) return "bad n " + JSON.stringify(d); } return { o, nb: Object.keys(bio).length };');
ok(typeof dist === 'object' && Object.keys(dist.o).length === 4 && dist.nb >= 4, 'за 90 дней должны встретиться все цели и почти все биомы: ' + JSON.stringify(dist));
ok(J('return [dailyShift("2026-03-01", -1), dailyShift("2026-12-31", 1), dailyShift("2026-10-19", -19)]').join() === '2026-02-28,2027-01-01,2026-09-30', 'сдвиг даты через границы месяцев и года');

// 2. запуск на карте дня + цель выполняется
sim.h.run(`{ const D = Daily.for("2026-10-19"); setupStart(D.seed, { biome: D.biome, size: "small" }); goalNew("free"); Game.daily = { key: "2026-10-19", seed: D.seed, biome: D.biome, goal: { k: "pop", n: 5 }, over: null }; }`);
for (let i = 0; i < 20; i++) sim.h.run('step(SIM_DT * 60)');
ok(J('return Game.daily.over && Game.daily.over.res') === 'goal', 'цель «жителей 5» при старте 16 должна закрыться сразу: ' + sim.h.run('JSON.stringify(Game.daily)'));
const day = J('return JSON.parse(localStorage.getItem("oldgold-daily")).days["2026-10-19"]');
ok(day && day.score > 0 && day.done === 1 && day.tries === 1, 'результат не записан в localStorage: ' + JSON.stringify(day));

// 3. вчера и сравнение
sim.h.run('{ const o = JSON.parse(localStorage.getItem("oldgold-daily")); o.days["2026-10-18"] = { score: 100, done: 0, tries: 1 }; o.days["2026-10-17"] = { score: 50, done: 0, tries: 1 }; localStorage.setItem("oldgold-daily", JSON.stringify(o)); }');
const cmp = J('return dailyCompare("2026-10-19", 400)');
ok(/лучше на <b>300<\/b>/.test(cmp.cmp) && cmp.streak === 3 && cmp.week.length === 7 && cmp.week[6] > 0, 'сравнение со вчера: ' + JSON.stringify(cmp));
ok(/хуже на <b>/.test(J('return dailyCompare("2026-10-19", 10)').cmp), 'хуже вчерашнего');
ok(/не играли/.test(J('return dailyCompare("2026-10-25", 10)').cmp), 'вчера не играли');
ok(/Вызов дня 19\.10/.test(J('return dailyShareText()')), 'текст для «Поделиться»');

// 4. время и очки
sim.h.run('Game.daily.over = null; Game.daily.goal = { k: "blds", n: 99 }; Game.time = DAILY_LIMIT + 1; Game.daily.acc = 5; step(SIM_DT);');
ok(J('return Game.daily.over && Game.daily.over.res') === 'time', 'время вышло — должен быть итог «time»');
ok(J('return [dailyScore({ pop: 20, blds: 10, bread: 40, timber: 40, nights: 2, lost: 1 }, false, 0), dailyScore({ pop: 0, blds: 0, bread: 0, timber: 0, nights: 0, lost: 9 }, false, 0), dailyScore({ pop: 20, blds: 10, bread: 40, timber: 40, nights: 2, lost: 1 }, true, 600)]').join() === '575,0,875', 'формула очков');

// 5. сохранение
const keep = J('return serializeGame().daily');
ok(keep && keep.key === '2026-10-19' && !('acc' in keep), 'вызов не попал в сохранение');
sim.h.run('{ const s = JSON.parse(JSON.stringify(serializeGame())); applySave(s); }');
ok(J('return Game.daily && Game.daily.key') === '2026-10-19', 'после загрузки вызов пропал');
sim.h.run('resetGameState()');
ok(J('return Game.daily') === null, 'сброс игры не очистил вызов');
ok(!sim.errors.length, 'исключения: ' + sim.errors.slice(0, 2).join(' | '));
console.log(`Проверка вызова дня: цель сегодня ${a.goal.k} ${a.goal.n}, биом ${a.biome}`);
console.log(fails.length ? `Провалов: ${fails.length}` : 'Вызов дня в порядке');
process.exit(fails.length ? 1 : 0);
