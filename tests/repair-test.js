'use strict';
// Ремонт повреждённых зданий (logistics.js dispatchRepairs, repairWhy):
// разбитое здание (от 0.5) берёт ближайший свободный, а если все работяги на несрочных стройках — один бросает стройку;
// сильнее побитое — первым; слабо побитое стройку не прерывает; подсказка называет причину, а не «скоро подойдут».
// Запуск: node tests/repair-test.js
const S = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };
const info = m => console.log('Проверка: ' + m);

function sim0(seed) {
  const sim = S.newSim(seed);
  sim.R = s => sim.h.run(s);
  sim.step = sec => S.stepN(sim, Math.round(sec * 20));
  return sim;
}
function place(sim, type, done) {
  const r = S.botPlace(sim, type);
  sim.R('for (const s of [...Game.roadSites.values()]) completeRoad(s)');
  const id = sim.R(`(Game.buildings.filter(b => b.state !== 'done' && b.type === ${JSON.stringify(type)}).pop() || {}).id`);
  if (!id) throw new Error('не удалось заложить ' + type + ': ' + r);
  if (done) sim.R(`finishBuilding(Game.buildings.find(b => b.id === ${id}))`);
  return id;
}
const B = id => `Game.buildings.find(b => b.id === ${id})`;
// все, кто мог бы чинить, кроме работяг, — заняты (в тесте проверяем именно работяг)
const noFree = `for (const u of Game.units) if (u.type !== 'builder' && !u.isCourier && u.type !== 'hero' && !u.home) u.dead = true`;

// 1. Все работяги на стройках: разбитое здание всё равно чинят быстро, стройку потом доделывают
{
  const sim = sim0(21);
  sim.step(5);
  const saw = place(sim, 'sawmill', true);
  sim.R(`${B(saw)}.worker = null; for (const u of Game.units) if (u.home && u.home.id === ${saw}) u.home = null`);
  sim.R(noFree);
  sim.R(`for (const s of Game.buildings) if (s.isStore()) { s.stock.trunk += 60; s.stock.timber += 60; s.stock.stone += 60; }`);   // стройки не встают без материала
  const nb = sim.R(`Game.units.filter(u => u.type === 'builder' && !u.dead).length`);
  const sites = [];
  for (let i = 0; i < nb + 1; i++) sites.push(place(sim, i % 2 ? 'woodcutter' : 'quarry'));
  sim.step(15);
  const busy = sim.R(`Game.units.filter(u => u.type === 'builder' && !u.dead && u.job).length`);
  info(`работяг ${nb}, на стройках ${busy}`);
  ok(busy === nb, `все работяги должны быть на стройках: ${busy} из ${nb}`);
  sim.R(`${B(saw)}.dmg = 0.7`);
  const why0 = sim.R(`repairWhy(${B(saw)})`);
  ok(why0 && !/скоро/.test(why0), 'подсказка до назначения: ' + why0);
  let t = 0;
  for (; t < 90 && sim.R(`${B(saw)}.dmg > 0`); t++) sim.step(1);
  info(`разбитую лесопилку починили за ${t} с, подсказка была «${why0}»`);
  ok(t < 60, `разбитое здание при занятых работягах чинили ${t} с — должно быть меньше минуты`);
  sim.step(60);
  const left = sim.R(`[${sites}].filter(id => { const b = ${B('id')}; return b && b.state !== 'done' && !b.builder; }).length`);
  const idle = sim.R(`Game.units.filter(u => u.type === 'builder' && !u.dead && u.idleFlag).length`);
  ok(!(left && idle), `после ремонта стройки брошены: без работяги ${left}, работяг без дела ${idle}`);
  ok(!sim.errors.length, 'исключения: ' + sim.errors.slice(0, 2).join(' | '));
}

// 2. Слабо побитое здание стройку не прерывает; подсказка честная
{
  const sim = sim0(22);
  sim.step(5);
  const saw = place(sim, 'sawmill', true);
  sim.R(noFree);
  const nb = sim.R(`Game.units.filter(u => u.type === 'builder' && !u.dead).length`);
  for (let i = 0; i < nb + 1; i++) place(sim, 'quarry');
  sim.step(15);
  sim.R(`${B(saw)}.dmg = 0.3`);
  sim.step(3);
  ok(sim.R(`!${B(saw)}.repairer`), 'слабо побитое (0.3) здание сняло работягу со стройки');
  const why = sim.R(`repairWhy(${B(saw)})`);
  ok(/освободится/.test(why), 'подсказка для слабо побитого: ' + why);
  sim.R(`for (const u of Game.units) if (u.type === 'builder') u.dead = true`);
  ok(/нет работяг/.test(sim.R(`repairWhy(${B(saw)})`)), 'без работяг подсказка должна говорить «нет работяг»');
  ok(!sim.errors.length, 'исключения: ' + sim.errors.slice(0, 2).join(' | '));
}

// 3. Один свободный работяга, два повреждённых здания: первым — сильнее побитое; ремонт идёт мимо лимита «на работе»
{
  const sim = sim0(23);
  sim.step(5);
  const a = place(sim, 'sawmill', true), b = place(sim, 'quarry', true);
  sim.R(noFree);
  sim.R(`let k = 0; for (const u of Game.units) if (u.type === 'builder' && !u.dead && k++ > 0) u.dead = true`);
  sim.step(2);
  sim.R(`${B(a)}.dmg = 0.3; ${B(b)}.dmg = 0.8; dispatchBuilders()`);
  ok(sim.R(`${B(b)}.repairer && !${B(a)}.repairer`), 'первым должны чинить сильнее побитое здание');
  ok(/идёт чинить|чинят/.test(sim.R(`repairWhy(${B(b)})`)), 'подсказка у назначенного ремонта');
  ok(!sim.errors.length, 'исключения: ' + sim.errors.slice(0, 2).join(' | '));
}

if (fails.length) { console.log(`\nREPAIR: ПРОВАЛ (${fails.length})`); process.exit(1); }
console.log('\nREPAIR: OK');
process.exit(0);
