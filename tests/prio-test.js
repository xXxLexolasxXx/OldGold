'use strict';
// Приоритеты работ: «Авто» не меняет экономику, «Выкл»/«Высокий» работают, сохранение хранит выбор.
// Запуск: node tests/prio-test.js [минуты]
const S = require('./lib/sim');
const MIN = +process.argv[2] || 8;
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

function run(label, setup, seed = 7) {
  const sim = S.newSim(seed);
  if (setup) sim.h.run(setup);
  S.runFor(sim, MIN * 60, 10, k => { if (k % 3 === 0) S.botTurn(sim); });
  const r = S.inspect(sim);
  const p = r.produced;
  console.log(`${label.padEnd(26)} зданий ${r.n.buildings}, жителей ${r.n.units}, брёвна ${p.trunk | 0}, доски ${p.timber | 0}, хлеб ${p.bread | 0}, пшеница ${p.wheat | 0}, камень ${p.stone | 0}, ошибок ${sim.errors.length}`);
  ok(!sim.errors.length, `${label}: исключения: ${sim.errors.slice(0, 2).join(' | ')}`);
  const inv = S.checkInvariants(sim, label); for (const pr of inv.problems) ok(false, pr);
  return { sim, r, p };
}

const base = run('без приоритетов');
const auto = run('всё явно «Авто»', 'prioSet("tasks","food",2); prioSet("jobs","serf",2); Game.prio.tasks.wood = 2;');
ok(JSON.stringify(auto.p) === JSON.stringify(base.p), 'явное «Авто» меняет экономику: должно совпадать с пустой таблицей');

const noWood = run('дрова выкл', 'prioSet("tasks","wood",0)');
ok((noWood.p.trunk | 0) < (base.p.trunk | 0) * 0.5 || (base.p.trunk | 0) === 0, `дрова «Выкл» должны остановить рубку (было ${base.p.trunk | 0}, стало ${noWood.p.trunk | 0})`);

const noFood = run('еда выкл', 'prioSet("tasks","food",0)');
ok((noFood.p.bread | 0) <= (base.p.bread | 0), 'еда «Выкл» не должна увеличивать хлеб');
ok((noFood.p.wheat | 0) < (base.p.wheat | 0) * 0.5 || (base.p.wheat | 0) === 0, `еда «Выкл» должна остановить ферму (было ${base.p.wheat | 0}, стало ${noFood.p.wheat | 0})`);

const noBuild = run('стройка выкл', 'prioSet("tasks","build",0)');
ok(noBuild.r.n.buildings <= base.r.n.buildings, 'стройка «Выкл»: зданий не больше, чем с автоматикой');

const noSerf = run('трудяги выкл', 'prioSet("jobs","serf",0)');
const hi = run('еда высокий, стройка низк.', 'prioSet("tasks","food",3); prioSet("tasks","build",1); prioSet("jobs","carter",3)');

// сохранение
const h = base.sim.h;
h.run('prioReset(); prioSet("tasks","food",3); prioSet("jobs","miner",0); prioSet("jobs","nobody",0); prioSet("tasks","__proto__",0); prioSet("tasks","wood",9);');
const save = h.run('JSON.stringify(serializeGame())');
const s = JSON.parse(save);
ok(s.pr && s.pr.tasks.food === 3 && s.pr.jobs.miner === 0, 'в сохранении нет приоритетов');
ok(!('nobody' in (s.pr.jobs)) && Object.keys(s.pr.tasks).length === 1, 'в сохранение попали мусорные ключи: ' + JSON.stringify(s.pr));
h.run('prioReset()');
h.ctx.__s = s; h.run('applySave(__s)');
ok(h.run('prioLv("tasks","food")') === 3 && h.run('prioLv("jobs","miner")') === 0, 'приоритеты не восстановились из сохранения');
h.run('prioReset()'); const s2 = JSON.parse(h.run('JSON.stringify(serializeGame())'));
ok(!('pr' in s2), 'пустая таблица не должна писаться в сохранение');
h.ctx.__s = JSON.parse(save); delete h.ctx.__s.pr; h.run('applySave(__s)');
ok(h.run('prioAny()') === false, 'старое сохранение без pr должно давать «Авто»');

console.log(fails.length ? `\nПровалено: ${fails.length}` : '\nПриоритеты: OK');
process.exit(fails.length ? 1 : 0);
