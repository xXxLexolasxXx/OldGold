'use strict';
// Возобновление ресурсов (world.js REGROW) и теска скалы (jobs.js quarryWork, ROCKMINE):
// у каменоломни медленно вырастают глыбы, у дома лесоруба — саженцы (весной сразу пачкой, зимой нет), всё с потолком
// и не у зданий/дорог; зимой лесоруб оставляет последние деревья; клетка скалы держит REGROW.rockHp кусков,
// убывает по куску, осыпается и в коопе доходит до клиента (зеркало 'rk'); старый сейв без запаса — скала целая.
// Запуск: node tests/regrow-test.js
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
function place(sim, type) {
  const r = S.botPlace(sim, type);
  sim.R('for (const s of [...Game.roadSites.values()]) completeRoad(s)');
  const id = sim.R(`(Game.buildings.filter(b => b.state !== 'done' && b.type === ${JSON.stringify(type)}).pop() || {}).id`);
  if (!id) throw new Error('не удалось заложить ' + type + ': ' + r);
  sim.R(`finishBuilding(Game.buildings.find(b => b.id === ${id}))`);
  return id;
}
const B = id => `Game.buildings.find(b => b.id === ${id})`;
// убрать работника здания (меряем только природу) и очистить круг R от объектов типа t
const noWorker = id => `for (const u of Game.units) if (u.home && u.home.id === ${id}) u.dead = true; ${B(id)}.worker = null`;
const clearAround = (id, t, R) => `(() => { const b = ${B(id)}; for (let y = b.doorY - ${R}; y <= b.doorY + ${R}; y++) for (let x = b.doorX - ${R}; x <= b.doorX + ${R}; x++) { if (!inb(x, y)) continue; const o = World.obj[idx(x, y)]; if (o && o.t === '${t}') { World.obj[idx(x, y)] = null; World.growing.delete(idx(x, y)); } } })()`;
const countAround = (id, t, R) => `(() => { const b = ${B(id)}; let n = 0; for (let y = b.doorY - ${R}; y <= b.doorY + ${R}; y++) for (let x = b.doorX - ${R}; x <= b.doorX + ${R}; x++) { if (!inb(x, y) || (x - b.doorX) ** 2 + (y - b.doorY) ** 2 > ${R * R}) continue; const o = World.obj[idx(x, y)]; if (o && o.t === '${t}') n++; } return n; })()`;
// новые объекты не на дорогах и не вплотную к зданиям/входам
const badSpots = `(() => { let bad = 0; for (const i of Game.__rgNew || []) { const x = i % MAP_W, y = (i / MAP_W) | 0; for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) { if (!inb(xx, yy)) continue; const j = idx(xx, yy); if (World.bmap[j] || World.door[j] || World.road[j]) bad++; } } return bad; })()`;
// что вырастила сама природа (regrowAt), а не лесничий, осыпь скалы и прочие
const spy = `Game.__rgNew = []; { const r0 = regrowAt, s0 = setStone, t0 = setTree; let on = false;
  regrowAt = function (...a) { on = true; try { return r0(...a); } finally { on = false; } };
  setStone = function (i, n) { if (on) Game.__rgNew.push(i); return s0(i, n); };
  setTree = function (i, g) { if (on) Game.__rgNew.push(i); return t0(i, g); }; }`;
const made = t => `Game.__rgNew.filter(i => World.obj[i] && World.obj[i].t === '${t}').length`;

// 1. Глыбы у каменоломни: вырастают медленно, до потолка, не у зданий и дорог
{
  const sim = sim0(31);
  sim.step(3);
  const q = place(sim, 'quarry');
  sim.R(noWorker(q));
  sim.R(clearAround(q, 'stone', 12));
  sim.R(spy);
  const R = sim.R('REGROW.stoneR'), cap = sim.R('REGROW.stoneCap');
  sim.step(600);
  const n10 = sim.R(countAround(q, 'stone', R));
  info(`за 10 минут у каменоломни выросло глыб: ${n10} (потолок ${cap})`);
  ok(n10 >= 1, 'за 10 минут у пустой каменоломни должна вырасти хоть одна глыба');
  ok(n10 <= cap, `глыб больше потолка: ${n10} > ${cap}`);
  sim.step(3600);
  const n70 = sim.R(countAround(q, 'stone', R));
  info(`через 70 минут: ${n70}`);
  ok(n70 <= cap && n70 >= Math.min(cap, 2), `через час глыб ${n70} — ждём от 2 до ${cap}`);
  const nn = sim.R(made('stone'));
  ok(sim.R(badSpots) === 0, 'новая глыба выросла вплотную к зданию, входу или на дороге');
  const ns = sim.R(`Game.__rgNew.filter(i => { const o = World.obj[i]; return o && o.t === 'stone' && !(o.n >= REGROW.stoneN[0] && o.n <= REGROW.stoneN[1]); }).length`);
  ok(ns === 0, 'запас новой глыбы вне REGROW.stoneN');
  info(`новых глыб по карте: ${nn}`);
  ok(sim.errors.length === 0, 'исключения: ' + sim.errors.join('; '));
}

// 2. Деревья у дома лесоруба: зимой не растут, весной — пачкой, потолок
{
  const sim = sim0(32);
  sim.step(3);
  const w = place(sim, 'woodcutter');
  sim.R(noWorker(w));
  sim.R(clearAround(w, 'tree', 13));
  sim.R(clearAround(w, 'stump', 13));
  sim.R(spy);
  const R = sim.R('REGROW.treeR'), cap = sim.R('REGROW.treeCap');
  sim.R('seaSet(2)');
  sim.step(20);
  sim.step(600);
  const nW = sim.R('Game.__rgNew.length');
  info(`зимой за 10 минут выросло деревьев: ${nW}`);
  ok(nW === 0, `зимой деревья расти не должны: ${nW}`);
  sim.R('seaSet(3); Game.sea.snow = Game.sea.ice = 0');   // снег сошёл
  sim.step(sim.R('REGROW.every') + 1);
  const nS = sim.R('Game.__rgNew.length');
  info(`в первый ход весны: ${nS} (ждём ${sim.R('REGROW.springBurst')})`);
  ok(nS >= sim.R('REGROW.springBurst'), `весной сразу должна вырасти пачка саженцев: ${nS}`);
  sim.step(3000);
  const nL = sim.R(countAround(w, 'tree', R));
  info(`к концу весны: ${nL} (потолок ${cap})`);
  ok(nL <= cap && nL > nS, `весной лес должен подрасти до потолка: ${nL}`);
  ok(sim.R(badSpots) === 0, 'саженец вырос вплотную к зданию, входу или на дороге');
  ok(sim.errors.length === 0, 'исключения: ' + sim.errors.join('; '));
}

// 3. Зимой лесоруб не вырубает рощу у дома в ноль
{
  const sim = sim0(33);
  sim.step(3);
  const w = place(sim, 'woodcutter');
  sim.R(`REGROW.treeChance = [0, 0, 0, 0]; REGROW.springBurst = 0`);   // меряем только рубку
  sim.R('seaSet(2)');
  const RC = 12, keep = sim.R('REGROW.winterKeep');
  // роща: ровно 8 взрослых деревьев в радиусе лесоруба
  sim.R(clearAround(w, 'tree', 16));
  sim.R(`(() => { const b = ${B(w)}; let n = 0; for (let r = 3; r <= 8 && n < 8; r++) for (let a = 0; a < 16 && n < 8; a++) { const x = Math.round(b.doorX + Math.cos(a / 16 * 6.283) * r), y = Math.round(b.doorY + Math.sin(a / 16 * 6.283) * r); if (isFreeGrass(x, y)) { setTree(idx(x, y), 1); n++; } } })()`);
  const n0 = sim.R(countAround(w, 'tree', RC));
  sim.R(`${B(w)}.stock.trunk = 0`);
  for (let t = 0; t < 400; t += 10) { sim.step(10); sim.R(`${B(w)}.stock.trunk = 0; for (let i = 0; i < N_TILES; i++) { const o = World.obj[i]; if (o && o.t === 'tree' && o.g < 1) World.obj[i] = null; }`); }
  const n1 = sim.R(`(() => { const b = ${B(w)}; let n = 0; for (let y = b.doorY - ${RC}; y <= b.doorY + ${RC}; y++) for (let x = b.doorX - ${RC}; x <= b.doorX + ${RC}; x++) { if (!inb(x, y)) continue; const o = World.obj[idx(x, y)]; if (o && o.t === 'tree' && o.g >= 1) n++; } return n; })()`);
  const cut = sim.R('Game.produced.trunk');
  info(`зимой: было взрослых ${n0}, осталось ${n1} (оставлять ${keep}), брёвен всего ${cut}`);
  ok(n1 >= keep, `зимой лесоруб вырубил рощу ниже остатка: ${n1} < ${keep}`);
  ok(n1 < n0, 'зимой лесоруб всё же должен рубить то, что сверх остатка');
  ok(sim.errors.length === 0, 'исключения: ' + sim.errors.join('; '));
}

// 4. Скала: большой запас, убывает по куску, осыпается; кооп-зеркало и старый сейв
{
  const sim = sim0(34);
  sim.step(3);
  const hp = sim.R('ROCK_FACE_HP');
  info(`запас клетки скалы: ${hp} кусков`);
  ok(hp === sim.R('REGROW.rockHp') && hp >= 40, 'запас скалы должен браться из REGROW.rockHp и быть большим');
  // каменоломня, вокруг ни одной глыбы — каменотёс идёт тесать скалу
  const q = place(sim, 'quarry');
  sim.R('REGROW.stoneChance = 0');
  sim.R(`for (let i = 0; i < N_TILES; i++) if (World.obj[i] && World.obj[i].t === 'stone') World.obj[i] = null; PF.regT = -1e9`);
  const face = sim.R(`(() => { const f = findRockFace(${B(q)}, quarryReach({ level: 1 }, ${B(q)}) + 20); return f ? [f.x, f.y] : null; })()`);
  ok(!!face, 'рядом с каменоломней нет скалы для проверки');
  sim.R(`${B(q)}.level = 3; isNightNow = () => false; isEveningNow = () => false`);   // дальше ходит; вечером далеко не ходят — в тесте вечный день
  const s0 = sim.R('Game.produced.stone');
  for (let k = 0; k < 30; k++) { sim.R(`${B(q)}.stock.stone = 0`); sim.step(10); }
  const s1 = sim.R('Game.produced.stone');
  const worn = sim.R('[...ROCKMINE.hp].map(p => p[1])');
  info(`за 5 минут со скалы камня: ${s1 - s0}, клетки в работе: ${JSON.stringify(worn)}`);
  ok(s1 > s0, 'каменотёс без глыб должен тесать скалу');
  ok(worn.length >= 1 && worn.every(n => n < hp && n > 0), 'выработка клетки должна уменьшаться, клетка ещё цела');
  // доводим клетку до осыпания
  const fi = sim.R('[...ROCKMINE.hp][0][0]');
  sim.R(`ROCKMINE.hp.set(${fi}, 1)`);
  const rv0 = sim.R('ROCKNET.rv');
  let t = 0;
  for (; t < 300 && sim.R(`World.terrain[${fi}] === T_ROCK`); t += 5) { sim.R(`${B(q)}.stock.stone = 0`); sim.step(5); }
  if (process.env.DBG) console.log(sim.R(`JSON.stringify({ hp: [...ROCKMINE.hp], fi: ${fi}, u: Game.units.filter(u => u.home && u.home.id === ${q}).map(u => [u.type, Math.round(u.x), Math.round(u.y), u.action && Object.keys(u.action)]) })`));
  ok(sim.R(`World.terrain[${fi}] !== T_ROCK && ROCKMINE.mined.has(${fi})`), 'клетка скалы с последним куском должна осыпаться');
  ok(sim.R('ROCKNET.rv') > rv0, 'осыпание должно попасть в кооп-зеркало');
  // зеркало: клиент получает выработку и осыпавшуюся клетку
  const mir = sim.R('JSON.stringify(rockMirrorOut())');
  const m = JSON.parse(mir);
  ok(m && (m.cv || []).includes(fi), 'в зеркале нет осыпавшейся клетки');
  const cl = sim0(34);
  cl.step(1);
  const hp2 = sim.R('JSON.stringify([...ROCKMINE.hp])');
  cl.R(`rockMirrorIn(${mir})`);
  ok(cl.R(`World.terrain[${fi}] !== T_ROCK && ROCKMINE.mined.has(${fi})`), 'клиент не применил осыпание скалы');
  ok(cl.R('JSON.stringify([...ROCKMINE.hp])') === hp2, 'клиент не получил выработку скалы');
  // сохранение: выработка и осыпь переживают загрузку; старый сейв без rockHp — скала с полным запасом
  const sv = sim.R('JSON.stringify(serializeGame())');
  sim.R(`applySave(${sv})`);
  ok(sim.R(`World.terrain[${fi}] !== T_ROCK`) && sim.R('JSON.stringify([...ROCKMINE.hp])') === hp2, 'выработка скалы потерялась при загрузке');
  const old = JSON.parse(sv); delete old.rockHp;
  sim.R(`applySave(${JSON.stringify(old)})`);
  ok(sim.R('ROCKMINE.hp.size') === 0, 'старый сейв без выработки: клетки должны быть целыми');
  ok(sim.R(`(() => { const f = findRockFace(${B(q)}, 30); return f ? (ROCKMINE.hp.get(idx(f.x, f.y)) ?? ROCK_FACE_HP) : -1; })()`) === hp, 'у скалы из старого сейва должен быть полный запас');
  ok(sim.errors.length === 0, 'исключения: ' + sim.errors.join('; '));
}

if (fails.length) { console.log(`\n✗ ПРОВАЛ (${fails.length})`); process.exit(1); }
console.log('\n✓ Возобновление ресурсов и теска скалы — ок');
process.exit(0);
