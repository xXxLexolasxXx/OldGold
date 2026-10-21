'use strict';
// Море (МОРЕ.md): биом «Побережье» даёт море у края, бухты и пляжи; вода делится на виды; обитатели появляются и
// уходят зимой; рыбацкая хижина ставится только у воды и приносит рыбу; кракен бьёт берег и побеждается героем;
// шторм даёт кораблекрушение; сейв хранит кладки черепах и приручённых; кооп-зеркало переносит обитателей.
// Запуск: node tests/sea-test.js
const S = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };

const sim = S.newSim(12345);
const h = sim.h;
h.run(`setupStart(12345, { biome: 'coast' }); Game.heroAsk = false; for (const b of Game.buildings) b.hold = false; Game.unlocked = allUnlocked(); Game.noGrace = true;`);

console.log('карта и вода');
const W = h.run(`(() => { const O = oceanPrep(true); const n = [0, 0, 0, 0, 0, 0]; for (const k of O.kind) n[k]++; let beach = 0; for (let i = 0; i < O.near.length; i++) if (World.terrain[i] === T_SAND && O.near[i] === OC_SEA) beach++; return { n, beach, maxDep: Math.max(...O.dep) }; })()`);
console.log(`    море ${W.n[1]}, озёра ${W.n[2]}, реки ${W.n[3]}, пруды ${W.n[4]}, пляж ${W.beach}, глубина до ${W.maxDep}`);
ok(W.n[1] > 600, 'на «Побережье» есть море');
ok(W.beach > 40, 'у моря есть пляж');
ok(W.maxDep >= 5, 'у моря есть глубина');
ok(h.run(`(() => { const cx = MAP_W >> 1, cy = MAP_H >> 1; for (let y = cy - 12; y <= cy + 12; y++) for (let x = cx - 12; x <= cx + 12; x++) if (Math.hypot(x - cx, y - cy) <= 12 && World.terrain[idx(x, y)] === T_WATER) return false; return true; })()`), 'стартовая поляна сухая');

console.log('обитатели');
S.runFor(sim, 240, 20);
const L = h.run(`(() => { const c = {}; for (const o of Game.seaLife.list) c[o.k] = (c[o.k] || 0) + 1; return c; })()`);
console.log('    ' + JSON.stringify(L));
ok(Object.keys(L).length >= 5, 'за 4 минуты появилось 5+ видов');
ok((L.shoal || 0) + (L.salmon || 0) > 0 && (L.crab || 0) > 0, 'есть рыба и крабы');
ok(h.run('Game.seaLife.list.length') <= 60, 'обитателей не больше 60');

console.log('рыбацкая хижина');
const hut = h.run(`(() => {
  const far = checkPlacement('fisherhut', (MAP_W >> 1) + 2, (MAP_H >> 1) + 2, 0);
  const O = OCN; let best = null; const cx = MAP_W >> 1, cy = MAP_H >> 1;
  for (let i = 0; i < O.dep.length; i++) if (O.kind[i] === OC_SEA && O.dep[i] === 1) { const x = i % MAP_W, y = (i / MAP_W) | 0, d = Math.hypot(x - cx, y - cy); if (!best || d < best.d) best = { x, y, d }; }
  let b = null;
  for (let r = 1; r < 14 && !b; r++) for (let dy = -r; dy <= r && !b; dy++) for (let dx = -r; dx <= r && !b; dx++) if (inb(best.x + dx, best.y + dy) && !checkPlacement('fisherhut', best.x + dx, best.y + dy, 0)) b = placeBuilding('fisherhut', best.x + dx, best.y + dy, true, 0);
  b.state = 'done';
  globalThis.__hut = b; globalThis.__fisher = spawnUnit('fisher', b.doorX, b.doorY);
  return { far, at: [b.x, b.y] };
})()`);
console.log('    далеко от воды: ' + hut.far);
ok(/у воды/.test(hut.far || ''), 'вдали от воды хижину не поставить');
S.runFor(sim, 600, 10);
const fish = h.run('__hut.stock.fish + Game.produced.fish');
console.log(`    рыбы в хижине и сделано: ${h.run('__hut.stock.fish')} / ${h.run('Game.produced.fish')}, рыбак в хижине: ${h.run('__hut.worker === __fisher')}`);
ok(fish > 0, 'рыбак наловил рыбы');
ok(h.run('!!swPier(__hut) && (Game.seaLife.boats || []).length === 1'), 'у хижины пристань и лодка');

console.log('кракен');
h.run(`(() => { const S = Game.seaLife; S.krT = -1e9; const ck = cycleAt; const st = startOpen; startOpen = () => true; cycleAt = t => Object.assign(ck(t), { k: 9 });
  for (let i = 0; i < 400 && !S.kr; i++) slKrakenTry(); cycleAt = ck; startOpen = st; })()`);
ok(h.run('!!Game.seaLife.kr'), 'кракен поднялся');
const tents = h.run('Game.seaLife.kr ? Game.seaLife.kr.tents.length : 0');
h.run(`(() => { const K = Game.seaLife.kr; const hero = Game.hero; if (!K || !hero) return; hero.hero.hp = hero.hero.maxhp = 9999; globalThis.__kt = 0; })()`);
let won = false;
for (let k = 0; k < 120 && !won; k++) {
  h.run(`(() => { const K = Game.seaLife.kr, hero = Game.hero; if (!K || !hero) return; const t = K.tents.find(q => q.st !== 'dead' && q.st !== 'die'); if (t) { hero.x = t.x - 0.8; hero.y = t.y; } hero.hero.hp = 9999; })()`);
  S.runFor(sim, 1, 1);
  won = h.run('Game.seaLife.krWon > 0');
}
console.log(`    щупалец ${tents}, побеждён: ${won}`);
ok(won, 'герой одолел кракена');
ok(h.run('[...Game.piles.values()].some(p => p.stock.pearl > 0)') || h.run('(() => { let n = 0; for (const b of Game.buildings) if (b.isStore && b.isStore()) n += b.stock.pearl; return n; })()') > 0, 'с кракена выпал жемчуг');

console.log('шторм и кораблекрушение');
h.run(`(() => { const w = swState(); w.stormT = 30; w.wreckDay = -99; WX.k = 0.1; WX.target = 0; const mr = slRand; let first = true; slRand = () => (first ? (first = false, 0.1) : mr()); try { swStormTick(0.1); } finally { slRand = mr; } })()`);
ok(h.run('swState().wreckDay >= 0'), 'после шторма — кораблекрушение');
ok(h.run('Game.dil && Game.dil.chain.some(c => c.id === "shipwreck") || !!(Game.dil && Game.dil.cur && Game.dil.cur.id === "shipwreck")'), 'дилемма о моряках в очереди');

console.log('зима');
h.run(`Game.sea.ice = 1; Game.sea.snow = 1;`);
S.runFor(sim, 10, 5);
const wl = h.run(`Game.seaLife.list.filter(o => ['shoal', 'crab', 'jelly', 'gull'].includes(o.k)).length`);
ok(wl === 0, 'зимой косяки, крабы, медузы и чайки ушли');
h.run(`Game.sea.ice = 0; Game.sea.snow = 0;`);

console.log('сохранение');
h.run(`Game.seaLife.nests.push({ x: 10.5, y: 10.5, t0: Game.time }); Game.seaLife.tame.gull = 'Тиля';`);
const sv = h.run('JSON.stringify(serializeGame())');
h.run(`applySave(JSON.parse(${JSON.stringify(sv)}))`);
ok(h.run('Game.seaLife.nests.some(n => n.x === 10.5 && n.y === 10.5)') && h.run('Game.seaLife.tame.gull') === 'Тиля', 'кладка и ручная чайка пережили сейв');
ok(h.run('MapOpt.biome') === 'coast' && h.run('oceanPrep(true) && OCN.kind.some(k => k === OC_SEA)'), 'море на месте после загрузки');

console.log('кооп-зеркало');
const m = h.run('JSON.stringify(seaLifeMirrorOut())');
h.run(`Game.seaLife.list = []; seaLifeMirrorIn(JSON.parse(${JSON.stringify(m)}))`);
ok(h.run('Game.seaLife.list.length') > 0 || JSON.parse(m).list.length === 0, 'зеркало переносит обитателей');

ok(!sim.errors.length, 'без исключений' + (sim.errors.length ? ': ' + sim.errors.join(' | ') : ''));
console.log(fails.length ? `ПРОВАЛОВ: ${fails.length}` : 'OK');
process.exit(fails.length ? 1 : 0);
