'use strict';
// Авто-срочность и кнопка «Срочно» (js/prio.js) вместо ручных приоритетов:
// 20 секунд в срочное здание и из него везут все свободные, его отрасль — следом; голодный трактир всё равно первым;
// работяга — на срочную стройку; старое поле pr в сейве игнорируется; кооп-команда bact urgent.
// Запуск: node tests/urgent-test.js
const S = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };
const info = m => console.log('Проверка: ' + m);

function sim0(seed) {
  const sim = S.newSim(seed);
  sim.R = s => sim.h.run(s);
  sim.step = sec => S.stepN(sim, Math.round(sec * 20));
  // журнал назначений доставок: [откуда, куда, id адресата, товар, сколько]
  sim.R(`Game.__log = []; { const _ad = assignDelivery; assignDelivery = function (u, f, t, g, n) { Game.__log.push([f.isPile ? 'pile' : f.type, f.id, t.isRoad ? 'road' : t.type, t.id, g, n]); return _ad.apply(this, arguments); }; }`);
  return sim;
}
// заложить здание ботом; дорогу к нему достраиваем сразу; done — сразу готовое
function place(sim, type, done) {
  const r = S.botPlace(sim, type);
  sim.R('for (const s of [...Game.roadSites.values()]) completeRoad(s)');
  const id = sim.R(`(Game.buildings.filter(b => b.state !== 'done' && b.type === ${JSON.stringify(type)}).pop() || {}).id`);
  if (!id) throw new Error('не удалось заложить ' + type + ': ' + r);
  if (done) sim.R(`finishBuilding(Game.buildings.find(b => b.id === ${id}))`);
  return id;
}
const B = id => `Game.buildings.find(b => b.id === ${id})`;
// один проход диспетчера курьеров: кто куда поехал
function dispatchOnce(sim) { sim.R('Game.__log = []; dispatchSerfs()'); return JSON.parse(sim.R('JSON.stringify(Game.__log)')); }

// 1. Кнопка: 20 секунд, без перезарядки; склад не торопится; отрасль — поставщики и такие же здания
{
  const sim = sim0(11);
  sim.step(3);
  const saw = place(sim, 'sawmill', true), wc = place(sim, 'woodcutter', true), qu = place(sim, 'quarry', true);
  ok(sim.R('urgCan(Game.buildings.find(b => b.isStore())) === false'), 'склад нельзя «торопить»');
  ok(sim.R(`urgPress(${B(saw)}) && urgOn(${B(saw)}) && urgLeft(${B(saw)}) === 20`), '«Срочно» не включилось на 20 с');
  ok(sim.R(`urgLv(${B(saw)}) === 2 && urgLv(${B(wc)}) === 1 && urgLv(${B(qu)}) === 0`),
    `отрасль лесопилки: лесопилка ${sim.R(`urgLv(${B(saw)})`)}, лесоруб ${sim.R(`urgLv(${B(wc)})`)} (нужно 1), каменоломня ${sim.R(`urgLv(${B(qu)})`)} (нужно 0)`);
  sim.step(12);
  ok(sim.R(`urgPress(${B(saw)}) && urgLeft(${B(saw)}) === 20`), 'повторное нажатие не продлило до 20 с (перезарядки быть не должно)');
  sim.step(21);
  ok(sim.R(`!urgOn(${B(saw)}) && urgLv(${B(wc)}) === 0`), '«Срочно» не кончилось через 20 с');
  ok(!sim.errors.length, 'исключения: ' + sim.errors.slice(0, 2).join(' | '));
}

// 2. Из срочного здания вывозят все свободные (обычно — не больше 3 за проход)
for (const urgent of [false, true]) {
  const sim = sim0(12);
  sim.step(40);
  const qu = place(sim, 'quarry', true);
  sim.R(`${B(qu)}.stock.stone = 5`);
  const idle = sim.R('Game.units.filter(u => u.isCourier && u.idleFlag && !u.inside && !u.brk).length');
  if (urgent) sim.R(`urgPress(${B(qu)})`);
  const log = dispatchOnce(sim);
  const from = log.filter(l => l[0] === 'quarry').length;
  info(`каменоломня с 5 камнями, свободных курьеров ${idle}${urgent ? ', «Срочно»' : ''}: вывозят ${from}`);
  if (urgent) ok(from >= Math.min(5, idle) && from > 3, `«Срочно»: из каменоломни вывозят ${from} из ${idle} свободных — должны все (до 5)`);
  else ok(from <= 3, `без «Срочно» из одного здания вывозят ${from} за проход — должно быть не больше 3`);
  if (urgent && idle < 4) ok(false, `сценарий: мало свободных курьеров (${idle}), проверка вывоза неполная`);
}

// 3. В срочную стройку везут раньше обычной, но голодный трактир — всё равно первым
{
  const sim = sim0(13);
  sim.step(40);
  const a = place(sim, 'farm'), b = place(sim, 'farm');
  const inn = sim.R('Game.buildings.find(b => b.type === "inn").id');
  sim.R(`for (const g of FOODS) ${B(inn)}.stock[g] = 0; Game.buildings.find(b => b.isStore()).stock.bread = 1;`);   // хлеба на одну ходку — остальные курьеры свободны
  sim.R(`urgPress(${B(b)})`);
  const log = dispatchOnce(sim);
  const toA = log.filter(l => l[3] === a).length, toB = log.filter(l => l[3] === b).length, toInn = log.filter(l => l[3] === inn).length;
  const idle = sim.R('Game.units.filter(u => u.isCourier && u.idleFlag && !u.inside && !u.brk).length');
  info(`две стройки ферм, вторая «Срочно», трактир пуст, свободных курьеров ${idle}: в срочную ${toB}, в обычную ${toA}, хлеб в трактир ${toInn}`);
  ok(toInn > 0 && log.findIndex(l => l[3] === inn) < Math.max(0, log.findIndex(l => l[3] === b)) + (toB ? 0 : 1e9), 'голодный трактир должен получить хлеб раньше срочной стройки');
  ok(toB > 0 && toB >= toA, `срочная стройка получила меньше обычной (${toB} против ${toA})`);
  if (log.findIndex(l => l[3] === a) >= 0 && toB) ok(log.findIndex(l => l[3] === b) < log.findIndex(l => l[3] === a), 'обычная стройка обслужена раньше срочной');
  // работяга — на срочную стройку
  sim.R(`const bs = Game.units.filter(u => u.type === 'builder'); for (const u of bs.slice(1)) removeUnit(u); purgeDead();
    for (const x of Game.buildings) if (x.builder) x.builder = null;
    const u = Game.units.find(u => u.type === 'builder'); u.job = null; u.idleFlag = true; u.proc = null; u.action = null; u.brk = null; u.inside = false;
    ${B(b)}.builder = null; ${B(a)}.builder = null; dispatchBuilders();`);
  ok(sim.R(`!!${B(b)}.builder && !${B(a)}.builder`), `единственный работяга пошёл не на срочную стройку (срочная: ${sim.R(`!!${B(b)}.builder`)}, обычная: ${sim.R(`!!${B(a)}.builder`)})`);
  ok(!sim.errors.length, 'исключения: ' + sim.errors.slice(0, 2).join(' | '));
}

// 4. Сохранение и старые сейвы; кооп-команда
{
  const sim = sim0(14);
  sim.step(5);
  const inn = sim.R('Game.buildings.find(b => b.type === "inn").id');
  sim.R(`urgPress(${B(inn)})`);
  const s = JSON.parse(sim.R('JSON.stringify(serializeGame())'));
  ok(!('pr' in s), 'в сохранении осталось поле pr');
  const sb = s.buildings && s.buildings.find(x => x.id === inn);
  ok(sb && sb.urg > 0, 'в сохранении нет «Срочно» у трактира');
  sim.h.ctx.__s = s; sim.R('applySave(__s)');
  ok(sim.R(`urgOn(${B(inn)})`), '«Срочно» не восстановилось из сохранения');
  // старый сейв с ручными приоритетами: всё выключено — а деревня всё равно работает
  const old = JSON.parse(JSON.stringify(s));
  old.pr = { jobs: { serf: 0, builder: 0, carter: 0 }, tasks: { food: 0, build: 0, wood: 0, haul: 0 } };
  for (const x of old.buildings) delete x.urg;
  sim.h.ctx.__s = old; sim.R('applySave(__s)');
  ok(sim.R('Game.prio === undefined && !("pr" in serializeGame())'), 'старые приоритеты из сейва не проигнорированы');
  const t0 = sim.R('Game.units.filter(u => u.dlv).length');
  sim.step(30);
  const moved = sim.R('Game.units.filter(u => u.dlv).length + Game.units.filter(u => u.type === "serf" && !u.idleFlag).length');
  ok(moved > 0, `после старого сейва с «Выкл» трудяги стоят (в пути было ${t0}, стало ${moved})`);
  // кооп: кнопка окна здания на сервере
  sim.R(`coopBuildingAct('Гость', { id: ${inn}, act: 'urgent' })`);
  ok(sim.R(`urgOn(${B(inn)})`), 'кооп-команда bact urgent не включила «Срочно»');
  sim.R(`coopBuildingAct('Гость', { id: Game.buildings.find(b => b.isStore()).id, act: 'urgent' })`);
  ok(sim.R('!urgOn(Game.buildings.find(b => b.isStore()))'), 'кооп: склад стал «срочным»');
  ok(!sim.errors.length, 'исключения: ' + sim.errors.slice(0, 2).join(' | '));
}

// 5. Деревня с ботом и игроком, который жмёт «Срочно» каждые полминуты: без исключений и нарушений инвариантов
{
  const sim = S.newSim(7);
  S.runFor(sim, 8 * 60, 10, k => {
    if (k % 3 === 0) S.botTurn(sim);
    if (k % 3 === 1) sim.h.run('{ const c = Game.buildings.filter(urgCan); if (c.length) urgPress(c[Math.floor(Math.random() * c.length)]); }');
  });
  const r = S.inspect(sim), p = r.produced;
  info(`8 мин с «Срочно» каждые 30 с: зданий ${r.n.buildings}, жителей ${r.n.units}, брёвна ${p.trunk | 0}, доски ${p.timber | 0}, камень ${p.stone | 0}, хлеб ${p.bread | 0}`);
  ok(!sim.errors.length, 'исключения: ' + sim.errors.slice(0, 2).join(' | '));
  for (const pr of S.checkInvariants(sim, 'срочно').problems) ok(false, pr);
  ok(r.n.buildings >= 8, `деревня почти не строилась: зданий ${r.n.buildings}`);
}

console.log(fails.length ? `\nПровалено: ${fails.length}` : '\n«Срочно»: OK');
process.exit(fails.length ? 1 : 0);
