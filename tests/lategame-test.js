'use strict';
// Лейтгейм: стройка, логистика и школа не встают в большой деревне (отзывы тестеров, 150+ минут игры).
// Сценарии — короткие и детерминированные; полный прогон деревни на 150 жителей — в конце (~1–2 мин).
// Запуск: node tests/lategame-test.js [--no-big]
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
// стройка с дорогой; дорогу достраиваем сразу — проверяем само здание
function site(sim, type) {
  const r = S.botPlace(sim, type);
  sim.R('for (const s of [...Game.roadSites.values()]) completeRoad(s)');
  const id = sim.R(`(Game.buildings.filter(b => b.state !== 'done' && b.type === ${JSON.stringify(type)}).pop() || {}).id`);
  if (!id) throw new Error('не удалось заложить ' + type + ': ' + r);
  return id;
}
const B = id => `Game.buildings.find(b => b.id === ${id})`;

// 1. Все трудяги заняты (здесь — выключены в «Приоритетах»): стройка всё равно идёт — работяга носит сам
{
  const sim = sim0(11);
  sim.R('prioSet("jobs","serf",0); prioSet("jobs","carter",0);');
  const id = site(sim, 'woodcutter');
  sim.step(300);
  const st = JSON.parse(sim.R(`JSON.stringify({ s: ${B(id)}.state, used: ${B(id)}.used, total: ${B(id)}.total })`));
  info(`стройка без трудяг: ${st.s}, уложено ${st.used}/${st.total} за 5 мин`);
  ok(st.s === 'done', `стройка стоит при полном складе, когда трудяги заняты: ${st.used}/${st.total} за 5 минут (работяга должен носить сам)`);
  // и дорога: последняя клетка не ждёт камень вечно
  sim.R('const _h = Game.buildings.find(b => b.isStore()); Game.__rs = [placeRoadSite(_h.doorX + 1, _h.doorY + 2), placeRoadSite(_h.doorX + 2, _h.doorY + 2)].filter(Boolean).length');
  const rs0 = sim.R('Game.__rs');
  sim.step(150);
  const rs = sim.R('Game.roadSites.size');
  ok(!rs0 || rs === 0, `дорога без трудяг не достроена за 2,5 мин: осталось ${rs} клеток`);
  ok(!sim.errors.length, 'исключения: ' + sim.errors.slice(0, 2).join(' | '));
}

// 2. Уронил ношу (испугался ночью) — она не числится «в пути», стройку обслуживают другие
{
  const sim = sim0(12);
  const id = site(sim, 'quarry');
  sim.R('for (const u of Game.units) if (u.type === "builder") removeUnit(u); purgeDead();');   // работяги не носят сами: смотрим только учёт доставки
  sim.R('prioSet("jobs","serf",0)');                      // новые доставки не назначаются — смотрим одну
  sim.step(1);
  const g = sim.R(`(function(){ const s = ${B(id)}, st = Game.buildings.find(b => b.isStore());
    const g = ['timber', 'stone', 'trunk'].find(k => s.demand(k) > 0 && st.offer(k) > 0);
    const u = Game.units.find(u => u.type === 'serf' && !u.brk && !u.dlv && !u.inside);
    if (!u || !g) return '';
    u.proc = null; u.action = null;
    assignDelivery(u, st, s, g, 1); Game.__u = u; Game.__g = g; return g; })()`);
  ok(g, 'сценарий «уронил ношу»: не нашлось трудяги или нужды стройки');
  if (!g) process.exit(1);
  for (let k = 0; k < 600 && sim.R('!(Game.__u.dlv && Game.__u.dlv.picked && Game.__u.carry)'); k++) sim.step(0.25);
  sim.R('const u = Game.__u; startBreak(u, "flee", null); u.proc = fleeGen(u);');
  sim.step(5);
  const inc = sim.R(`${B(id)}.incoming[Game.__g]`);
  info(`уронил ношу: «в пути» к стройке после испуга = ${inc}`);
  ok(inc === 0, `уроненная ноша числится «в пути» (${inc}) — стройка ждёт призрака и не зовёт других`);
  sim.R('prioSet("jobs","serf",2)');
  sim.step(90);
  const got = sim.R(`${B(id)}.stock[Game.__g] + ${B(id)}.usedOf[Game.__g]`);
  ok(got >= 1, `после испуга материал до стройки так и не дошёл за 1,5 мин (${got})`);
}

// 3. Школа получает золото: склад «не принимает золото» (перечёркнуто), доставки на склад закрыты,
//    достройка школы до уровня 2 застряла без досок — всё равно учит
{
  const sim = sim0(13);
  const r = JSON.parse(sim.R(`(function(){ const sc = Game.buildings.find(b => b.type === 'school' && b.state === 'done'), st = Game.buildings.find(b => b.isStore());
    sc.stock.gold = 0; st.stock.gold = 10; Game.storeBlock.gold = true; st.noDeliver = true;
    for (const b of Game.buildings) b.stock.timber = 0;      // достройка школы встаёт без досок — а учить должна
    const up = startUpgrade(sc);
    sc.queue.push('serf', 'serf'); Game.__n0 = Game.units.filter(u => u.type === 'serf').length;
    return JSON.stringify({ up }); })()`));
  sim.step(150);
  const n = sim.R('Game.units.filter(u => u.type === "serf").length - Game.__n0');
  info(`школа (золото «перечёркнуто», склад закрыт, достройка ${r.up ? 'идёт' : 'нет'}): выучено ${n} из 2`);
  ok(n >= 2, `школа не выучила учеников за 2,5 мин при золоте на складе (выучено ${n})`);
  const why = sim.R(`(function(){ const sc = Game.buildings.find(b => b.type === 'school'); sc.queue.push('builder'); const st = Game.buildings.find(b => b.isStore()); st.stock.gold = 0; sc.stock.gold = 0; for (const b of Game.buildings) if (b.type !== 'school') b.stock.gold = 0; const w = whyInfo(sc); return w ? w.t : ''; })()`);
  ok(/нет нигде/.test(why), 'без золота школа не объясняет, что его нет нигде: «' + why + '»');
}

// 4. Мёртвая хватка: ни одного перевозчика — школа сама берёт слиток со склада; нет и золота — учит трудягу в долг
{
  const sim = sim0(14);
  sim.R(`(function(){ for (const u of Game.units) if (u.isCourier) removeUnit(u); purgeDead();
    const sc = Game.buildings.find(b => b.type === 'school' && b.state === 'done'); sc.stock.gold = 0; sc.queue.push('builder'); })()`);
  sim.step(45);
  const a = sim.R('Game.units.filter(u => u.isCourier).length + "/" + Game.units.filter(u => u.type === "builder").length');
  sim.R(`(function(){ for (const b of Game.buildings) b.stock.gold = 0; for (const p of Game.piles.values()) p.stock.gold = 0;
    for (const u of Game.units) if (u.isCourier) removeUnit(u); purgeDead();
    const sc = Game.buildings.find(b => b.type === 'school'); sc.queue.push('builder'); })()`);
  sim.step(60);
  const serfs = sim.R('Game.units.filter(u => u.type === "serf").length');
  info(`мёртвая хватка: без перевозчиков выучено (перевозчики/работяги) ${a}; без золота выучен трудяга в долг: ${serfs}`);
  ok(+a.split('/')[1] >= 5, 'без перевозчиков школа не взяла золото со склада сама: ' + a);
  ok(serfs >= 1, 'без золота и перевозчиков школа не выучила трудягу в долг — деревня заперта');
}

// 5. Трудяга на обрывке дороги без склада возвращается в сеть склада
{
  const sim = sim0(15);
  const res = sim.R(`(function(){ const st = Game.buildings.find(b => b.isStore());
    // обрывок дороги в стороне от сети
    let spot = null;
    for (let r = 12; r < 30 && !spot; r++) for (let a = 0; a < 16 && !spot; a++) {
      const x = Math.round(st.doorX + Math.cos(a) * r), y = Math.round(st.doorY + Math.sin(a) * r);
      if ([0, 1, 2].every(k => canPlaceRoad(x + k, y)) && !compNear(x, y) && !compNear(x + 2, y)) spot = [x, y];
    }
    if (!spot) return 'нет места';
    for (let k = 0; k < 3; k++) setRoad(spot[0] + k, spot[1], true);
    const u = Game.units.find(u => u.type === 'serf' && !u.inside && !u.carry);
    if (u.brk) dropBreak(u);
    u.dlv = null; u.releaseOcc();
    u.x = spot[0] + 1.5; u.y = spot[1] + 0.5; u.proc = null; u.action = null; u.idleFlag = true;
    Game.__u = u; Game.__comp = compAt(spot[0], spot[1]);
    return 'ok'; })()`);
  if (res !== 'ok') info('обрывок дороги: ' + res);
  else {
    sim.step(60);
    const c = sim.R('(function(){ const u = Game.__u, st = Game.buildings.find(b => b.isStore()); return compNear(Math.floor(u.x), Math.floor(u.y)) === compAt(st.doorX, st.doorY); })()');
    info('трудяга с обрывка дороги вернулся в сеть склада: ' + c);
    ok(c, 'трудяга остался стоять на обрывке дороги без склада');
  }
}

// 6. Причина простоя стройки — правдивая: при свободных работягах не просим «обучить работяг»
{
  const sim = sim0(16);
  const id = site(sim, 'sawmill');
  const t = sim.R(`(function(){ const b = ${B(id)}; b.state = 'build'; for (const s of Game.buildings.filter(b => b.isStore())) { s.stock.timber = 0; s.stock.stone = 0; s.stock.trunk = 0; } return (whyInfo(b) || {}).t || ''; })()`);
  info('причина простоя без материала: ' + t);
  ok(!/Обучите|ждёт свободного работягу/.test(t) && /материал|Нет/.test(t), 'стройка без материала пишет про работяг: «' + t + '»');
}

// 7. Рудники: подсветка мест и подсказка «ближайшее место там»
{
  const sim = sim0(17);
  if (sim.R('typeof mineSpots') !== 'function') ok(false, 'нет подсветки мест под рудник (mineSpots)');
  else {
  const r = JSON.parse(sim.R(`(function(){ const g = mineSpots('goldmine'), i = mineSpots('ironmine'); const s = g[0];
    return JSON.stringify({ g: g.length, i: i.length, ok: s ? checkPlacement('goldmine', s[0], s[1], 0, true) : 'нет', hint: mineSpotHint('ironmine', 5, 5) }); })()`));
  info(`места под рудник: золотой ${r.g}, железный ${r.i}; подсказка: ${r.hint.trim()}`);
  ok(r.g > 0 && r.i > 0, 'на карте со скалами не нашлось ни одного места под рудник');
  ok(r.ok === null, 'место из подсветки не проходит проверку: ' + r.ok);
  ok(/Ближайшее место/.test(r.hint), 'нет подсказки «ближайшее место»: ' + r.hint);
  }
}

// 8. Большая деревня (150 жителей): 12 новых строек при полном складе достраиваются, школа учит
if (!process.argv.includes('--no-big')) {
  const sim = sim0(5);
  const R = sim.R;
  const PLAN = ['woodcutter', 'sawmill', 'farm', 'quarry', 'mill', 'bakery', 'woodcutter', 'swine', 'farm', 'brewery', 'hopfarm', 'goatpen', 'quarry', 'storehouse',
    'farm', 'butchery', 'inn', 'woodcutter', 'sawmill', 'quarry', 'farm', 'mill', 'bakery', 'storehouse', 'tannery', 'goldmine', 'metallurgist', 'farm', 'swine', 'woodcutter'];
  for (const t of PLAN) { S.botPlace(sim, t); R("for (const b of Game.buildings) if (b.state !== 'done') finishBuilding(b); for (const s of [...Game.roadSites.values()]) completeRoad(s);"); }
  R(`(function(){ const st = Game.buildings.find(b => b.type === 'storehouse');
    const add = (t, n) => { for (let k = 0; k < n; k++) { const s = randomFreeNear(st.doorX, st.doorY + 2, 0, 6) || [st.doorX, st.doorY + 1]; spawnUnit(t, s[0], s[1]); } };
    for (const b of Game.buildings) if (b.def.worker) add(b.def.worker, 1);
    add('builder', 18); add('serf', Math.max(0, 150 - Game.units.filter(isPerson).length));
    for (const s of Game.buildings.filter(b => b.isStore())) Object.assign(s.stock, { timber: 150, stone: 150, trunk: 80, bread: 80, sausage: 60, beer: 40, gold: 0 });
    st.stock.gold = 40;
    for (const b of Game.buildings) if (b.type === 'school') b.stock.gold = 0; })()`);
  sim.step(60);
  const plan2 = ['woodcutter', 'farm', 'sawmill', 'quarry', 'mill', 'brewery', 'bakery', 'swine', 'farm', 'woodcutter', 'hopfarm', 'inn'];
  for (const t of plan2) S.botPlace(sim, t);
  R("for (let k = 0; k < 6; k++) queueTraining(['woodcutter', 'farmer', 'serf'][k % 3]); Game.__u0 = Game.units.length;");
  const n0 = R("Game.buildings.filter(b => b.state !== 'done').length");
  const t0 = Date.now();
  let left = n0, mins = 0;
  for (; mins < 12 && left > 0; mins++) { sim.step(60); left = R("Game.buildings.filter(b => b.state !== 'done').length"); }
  const q = R("Game.buildings.find(b => b.type === 'school').queue.length");
  const hungry = R('Game.units.filter(u => isPerson(u) && u.food < HUNGRY).length'), people = R('Game.units.filter(isPerson).length');
  info(`деревня ${people} жителей: из ${n0} строек за ${mins} мин осталось ${left}, в очереди школы ${q}, голодных ${hungry} (${((Date.now() - t0) / 1000).toFixed(0)} с)`);
  ok(left <= 1, `в большой деревне стройки стоят при полном складе: за 12 мин не достроено ${left} из ${n0}`);
  ok(q === 0, `школа в большой деревне не выучила очередь: осталось ${q}`);
  ok(hungry < people * 0.25, `стройки отняли трудяг у трактира: голодных ${hungry} из ${people}`);
  ok(!sim.errors.length, 'исключения: ' + sim.errors.slice(0, 2).join(' | '));
}

console.log(fails.length ? `Проверка: провалов ${fails.length}` : 'Проверка: лейтгейм — всё в порядке');
process.exit(fails.length ? 1 : 0);
