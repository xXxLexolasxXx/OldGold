'use strict';
// Малые очаги огня (world/wildfire.js): горящие куры и ходячие деревья, фонари, печи и котлы, молния, колодец, крыши.
// Каждый случай — отдельная проверка; главное — огонь всегда гаснет (нет «вечного» пламени и зависших эффектов),
// число очагов ограничено, сейв чистый, кооп-флаг горящей курицы доезжает до клиента.
// Ходячие камни не горят: камень — это камень, молния его раскалывает (strikeEnt), пожар не трогает — проверяется ниже.
// Запуск: node tests/wildfire-test.js [сиды через запятую]
const L = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };
const SEEDS = (process.argv[2] || '11,22').split(',').map(Number);
const J = (h, c) => JSON.parse(h.run('JSON.stringify((function(){' + c + '})())'));
const DAY = 'while (!(cycleAt(Game.time).p < 40 && cycleAt(Game.time).k >= 2)) Game.time += 5; WX.k = 0; WX.target = 0; WX.nextRain = Game.time + 1e6; Game.dz.freq = 0; Game.dz.next = Game.time + 1e6;';

// ровная поляна далеко от жителей: центр [x, y]
const ARENA = `(function () {
  const hub = dzHub(); let best = null;
  for (let r = 22; r < 60 && !best; r += 2) for (let a = 0; a < 40 && !best; a++) {
    const x = Math.round(hub.doorX + Math.cos(a * 0.157) * r), y = Math.round(hub.doorY + Math.sin(a * 0.157) * r);
    let n = 0; for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (inb(x + dx, y + dy) && isFreeGrass(x + dx, y + dy)) n++;
    if (n > 70 && !Game.units.some(u => Math.hypot(u.x - x, u.y - y) < 14)) best = [x, y];
  }
  return best;
})()`;
const grove = (cx, cy) => `for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = ${cx} + dx, y = ${cy} + dy; if (isFreeGrass(x, y) && (dx || dy)) World.obj[idx(x, y)] = { t: 'tree', g: 1 }; }`;
const cellsLeft = h => J(h, 'return { c: Game.wf ? Game.wf.cells.length : 0, b: Game.wf ? Game.wf.bld.length : 0, fx: WX.fires.length, hens: Game.animals.filter(a => a.burn).length, ents: Game.ents.filter(e => e.burnT && e.state !== "gone" && e.state !== "dying").length }');
const NIGHT = 'while (!(isNightNow() && nightAmt() > 0.6)) Game.time += 5; WX.k = 0; WX.target = 0; WX.nextRain = Game.time + 1e6; Game.dz.freq = 0; Game.dz.next = Game.time + 1e6;';
const peak = { c: 0 };
function run(sim, sec) { for (let s = 0; s < sec; s++) { sim.h.run('if (!Game.__rain) { WX.k = 0; WX.target = 0; WX.nextRain = Game.time + 1e6; }'); L.stepN(sim, 20); const n = sim.h.run('Game.wf ? Game.wf.cells.length : 0'); peak.c = Math.max(peak.c, n); } }

for (const seed of SEEDS) {
  const sim = L.newSim(seed), h = sim.h;
  h.run(DAY);
  const A = J(h, 'return ' + ARENA);
  if (!A) { console.log(`  · сид ${seed}: нет подходящей поляны, пропуск`); continue; }
  const [ax, ay] = A;

  // ---- 1. Горящая курица: мечется, поджигает лес, гаснет или гибнет, огонь кончается
  h.run(grove(ax, ay) + `; Game.__hen = makeAnimal('chicken', ${ax}, ${ay}); Game.animals.push(Game.__hen); wfLightHen(Game.__hen, 'fire');`);
  ok(h.run('!!Game.__hen.burn'), `сид ${seed}: курица не загорелась`);
  run(sim, 8);
  const trees0 = J(h, 'return World.obj.filter(o => o && o.t === "stump").length');
  ok(trees0 > 0 || h.run('Game.wf && Game.wf.ever') > 0, `сид ${seed}: горящая курица ничего не подожгла`);
  run(sim, 60);
  let q = cellsLeft(h);
  ok(q.c === 0 && q.b === 0 && q.hens === 0, `сид ${seed}: огонь не погас через минуту: ${JSON.stringify(q)}`);
  ok(q.fx === 0 || J(h, 'return WX.fires.every(f => Game.time - f.t0 <= f.life + 1)'), `сид ${seed}: зависшие огни на карте`);

  // ---- 2. Курица в воде и у колодца гаснет сразу
  h.run(`{ const x = ${ax}, y = ${ay}; World.terrain[idx(x, y)] = T_WATER; const a = makeAnimal('chicken', x, y); Game.animals.push(a); wfLightHen(a, 'fire'); Game.__w = a; }`);
  run(sim, 1);
  ok(h.run('!Game.__w.burn'), `сид ${seed}: курица в воде не погасла`);
  h.run(`World.terrain[idx(${ax}, ${ay})] = T_GRASS`);
  const well = J(h, `const w = placeBuilding('well', ${ax + 3}, ${ay + 3}, true, 0); if (checkPlacement) {} return w ? { x: w.doorX, y: w.doorY } : null`);
  if (well) {
    h.run(`{ const a = makeAnimal('chicken', ${well.x}, ${well.y}); Game.animals.push(a); wfLightHen(a, 'fire'); Game.__w2 = a; }`);
    run(sim, 1);
    ok(h.run('!Game.__w2.burn'), `сид ${seed}: курица у колодца не погасла`);
  }

  // ---- 3. Горящее ходячее дерево: мечется, поджигает лес, сгорает; ходячий камень не горит
  h.run(NIGHT + grove(ax, ay));
  h.run(`{ const o = { t: 'tree', g: 1 }; const e = newEnt({ i: idx(${ax}, ${ay}), o, hx: ${ax}, hy: ${ay}, x: ${ax} + 0.5, y: ${ay} + 0.5, state: 'walk', k: 1 }); Game.ents.push(e); Game.__e = e;
    const rk = newEnt({ rock: true, i: idx(${ax + 1}, ${ay}), o: { t: 'stone', n: 3 }, hx: ${ax + 1}, hy: ${ay}, x: ${ax + 1} + 0.5, y: ${ay} + 0.5, state: 'walk', k: 1 }); Game.ents.push(rk); Game.__rk = rk;
    e.burnT = Game.time; }`);
  const x0 = h.run('Game.__e.x');
  run(sim, 8);
  ok(J(h, 'return Game.__e.state === "dying" || Game.__e.state === "gone"'), `сид ${seed}: горящее дерево не сгорело за 8 с`);
  ok(h.run('!Game.__rk.burnT'), `сид ${seed}: ходячий камень загорелся от соседнего пожара`);
  ok(h.run('Game.wf && Game.wf.ever') > 0, `сид ${seed}: горящее дерево не поджигает лес`);
  run(sim, 60);
  q = cellsLeft(h);
  ok(q.c === 0 && q.ents === 0, `сид ${seed}: после дерева огонь не погас: ${JSON.stringify(q)}`);
  h.run('Game.ents = Game.ents.filter(e => e !== Game.__rk && e !== Game.__e);' + DAY);

  // ---- 4. Огонь пожара-бедствия перекидывается на кур и деревья-ходоки
  h.run(grove(ax, ay) + `; Game.dz.cur = { k: 'fire', x: ${ax}, y: ${ay}, f: [{ i: idx(${ax}, ${ay}), t0: Game.time, dur: 30 }], b: [], burnt: new Set(), bBurnt: new Set(), nIgn: 1, sp: 0, ash: [], st: { bld: new Set(), road: 0, tree: 0, field: 0, fly: 0, raze: 0, spoil: 0 }, t0: Game.time };
    Game.__hen3 = makeAnimal('chicken', ${ax}, ${ay}); Game.__hen3.x = ${ax} + 0.7; Game.__hen3.wait = 1e9; Game.animals.push(Game.__hen3);`);
  h.run('{ const _l = wfLightHen; wfLightHen = function (a, s) { const r = _l(a, s); if (r && a === Game.__hen3) Game.__lit = 1; return r; }; }');
  let lit = false;
  for (let s = 0; s < 240 && !lit; s++) { L.stepN(sim, 1); lit = !!h.run('Game.__lit'); if (s % 20 === 0) h.run(`if (Game.dz.cur) Game.dz.cur.f[0] && (Game.dz.cur.f[0].t0 = Game.time); Game.__hen3.x = ${ax} + 0.7; Game.__hen3.y = ${ay} + 0.5; Game.__hen3.path = null;`); }
  ok(lit, `сид ${seed}: курица рядом с пожаром-бедствием не загорелась: ` + h.run('JSON.stringify([!!Game.dz.cur, Game.dz.cur && Game.dz.cur.f.length, wfHeat().length, Game.__hen3.x, Game.__hen3.y, Game.animals.includes(Game.__hen3), Game.units.filter(u => Math.hypot(u.x - Game.__hen3.x, u.y - Game.__hen3.y) < 8).length])') + sim.errors.join('|'));
  h.run('Game.dz.cur = null; Game.animals.forEach(a => { a.burn = null; })');
  run(sim, 50);

  // ---- 5. Колодец и дождь: поджигаем в одинаковых условиях сотни раз
  const stat = J(h, `
    const n = 600; let far = 0, nearW = 0, rainy = 0;
    const w = dzWells()[0];
    const hub = dzHub();
    const T = (x, y, pre) => { if (pre) pre(); Game.wf = null; World.obj[idx(x, y)] = { t: 'tree', g: 1 }; const r = wfIgnite(x, y, 1); if (r) { Game.wf.cells.length = 0; } return r ? 1 : 0; };
    for (let k = 0; k < n; k++) far += T(${ax}, ${ay - 14});
    const wx = w ? Math.floor(w.doorX) + 1 : ${ax}, wy = w ? Math.floor(w.doorY) + 1 : ${ay};
    for (let k = 0; k < n; k++) nearW += T(wx, wy);
    WX.k = 1;
    for (let k = 0; k < n; k++) rainy += T(${ax}, ${ay - 14});
    WX.k = 0; Game.wf = null;
    return { far, nearW, rainy, hasWell: !!w };`);
  ok(stat.far === 600 || !stat.far, `сид ${seed}: без поправок поджиг должен быть надёжным: ${stat.far}/600`);
  ok(stat.rainy < stat.far * 0.4, `сид ${seed}: дождь не защищает: ${stat.rainy} из ${stat.far}`);
  if (stat.hasWell) ok(stat.nearW < stat.far * 0.5, `сид ${seed}: колодец не защищает: ${stat.nearW} из ${stat.far}`);
  // колодец: срок горения клетки вдвое короче
  const durs = J(h, `Game.wf = null; const w = dzWells()[0]; if (!w) return null; let a = 0, b = 0, n = 0;
    for (let k = 0; k < 200; k++) { Game.wf = null; World.obj[idx(${ax}, ${ay - 14})] = { t: 'tree', g: 1 }; wfIgnite(${ax}, ${ay - 14}, 1); a += Game.wf.cells[0].dur;
      const x = Math.floor(w.doorX) + 1, y = Math.floor(w.doorY) + 1; World.obj[idx(x, y)] = { t: 'tree', g: 1 }; Game.wf = null; if (wfIgnite(x, y, 1, true)) { b += Game.wf.cells[0].dur; n++; } }
    Game.wf = null; return { a: a / 200, b: n ? b / n : 0 }`);
  if (durs) ok(durs.b < durs.a * 0.7, `сид ${seed}: у колодца огонь горит так же долго: ${JSON.stringify(durs)}`);

  // ---- 6. Крыши: солома загорается чаще, черепица почти не горит
  const roofs = J(h, `
    const b = Game.buildings.find(o => o.type === 'house') || Game.buildings.find(o => o.state === 'done' && o.type !== 'storehouse' && o.type !== 'well');
    const res = {};
    for (const lv of [1, 2, 3]) { b.level = lv; let n = 0; for (let k = 0; k < 800; k++) { Game.wf = null; if (wfIgniteB(b, 1)) n++; } res[lv] = n; }
    b.level = 1; Game.wf = null; return res;`);
  ok(roofs[1] > roofs[2] && roofs[2] > roofs[3] && roofs[3] > 0, `сид ${seed}: крыши по уровням: ${JSON.stringify(roofs)}`);
  const dmgL = J(h, `const b = Game.buildings.find(o => o.type === 'house') || Game.buildings.find(o => o.state === 'done' && o.type !== 'storehouse' && o.type !== 'well'); const out = {};
    for (const lv of [1, 3]) { b.level = lv; b.dmg = 0; Game.wf = null; let k = 0; while (!wfIgniteB(b, 1) && k++ < 200) {} for (let t = 0; t < 40; t++) wfTick(0.5); out[lv] = b.dmg; }
    b.level = 1; b.dmg = 0; Game.wf = null; WX.fires.length = 0; return out;`);
  ok(dmgL[1] > dmgL[3], `сид ${seed}: черепица страдает от огня так же, как солома: ${JSON.stringify(dmgL)}`);

  // ---- 7. Фонарь, упавший с гнома ночью, поджигает траву; днём — нет
  const lant = J(h, `
    let n = 0, d = 0;
    const u = Game.units.find(o => isPerson(o) && !o.dead && !o.inside);
    const sx = u.x, sy = u.y;
    Game.time = (function () { let t = 0; return t; })();
    const night = () => { let t = 0; while (!(lampsOn() && isNightNow())) t += 5, Game.time += 5; };
    night();
    for (let k = 0; k < 200; k++) { Game.wf = null; u.x = ${ax} + 0.5; u.y = ${ay} + 0.5; World.obj[idx(${ax}, ${ay})] = { t: 'tree', g: 1 }; u.lantern = true; lanternFall(u); if (Game.wf && Game.wf.cells.length) n++; }
    u.x = sx; u.y = sy; u.lantern = false; Game.wf = null; WX.fires.length = 0;
    return { n };`);
  ok(lant.n > 5 && lant.n < 120, `сид ${seed}: упавший ночью фонарь поджигает редко-но-метко: ${lant.n}/200`);
  h.run(DAY);

  // ---- 8. Печь и котёл: искры при урагане и землетрясении, колодец рядом снижает ущерб
  const src = J(h, `
    const inn = Game.buildings.find(o => o.type === 'inn' && o.state === 'done') || (function () { const hub = dzHub(); for (let r = 3; r < 30; r++) for (let k = 0; k < 28; k++) { const x = Math.round(hub.doorX + Math.cos(k * 0.5) * r * 1.6), y = Math.round(hub.doorY + Math.sin(k * 0.5) * r); if (inb(x, y) && !checkPlacement('inn', x, y, 0)) { const q = placeBuilding('inn', x, y, true, 0); q.state = 'done'; return q; } } return null; })();
    if (!inn) return null;
    const out = { src: wfSource(inn), wind: 0, quake: 0, calm: 0 };
    const bx = inn.x + inn.w / 2, by = inn.y + inn.h / 2;
    const base = { k: 'wind', x: bx, y: by, px: bx, py: by, ex: bx, ey: by, t0: Game.time, st: { bld: new Set(), road: 0, tree: 0, field: 0, fly: 0, raze: 0, spoil: 0 } };
    for (let k = 0; k < 300; k++) { Game.wf = null; Game.dz.cur = Object.assign({}, base); const S = WFS(); S.rk = 2; S.t = 0.5; wfTick(0.1); if (Game.wf.bld.length) out.wind++; }
    for (let k = 0; k < 300; k++) { Game.wf = null; Game.dz.cur = Object.assign({}, base, { k: 'quake', r: 8 }); const S = WFS(); S.rk = 2; S.t = 0.5; wfTick(0.1); if (Game.wf.bld.length) out.quake++; }
    for (let k = 0; k < 300; k++) { Game.wf = null; Game.dz.cur = null; const S = WFS(); S.rk = 2; S.t = 0.5; wfTick(0.1); if (Game.wf.bld.length) out.calm++; }
    Game.dz.cur = null; Game.wf = null; WX.fires.length = 0; inn.dmg = 0;
    return out;`);
  if (src) {
    ok(src.src, `сид ${seed}: у печи трактира нет источника огня`);
    ok(src.wind > 10, `сид ${seed}: ураган не заставляет печь искрить: ${src.wind}/300`);
    ok(src.quake > 3, `сид ${seed}: землетрясение не роняет печь: ${src.quake}/300`);
    ok(src.calm === 0, `сид ${seed}: в тихую погоду здания загораются сами: ${src.calm}`);
  }

  // ---- 9. Молния в землю: поджигает клетку, ломает фонарь
  const bolt = J(h, `
    let burned = 0, lamps = 0;
    World.obj[idx(${ax + 6}, ${ay})] = { t: 'lamp', out: false };
    for (let k = 0; k < 60; k++) { Game.wf = null; World.obj[idx(${ax}, ${ay})] = { t: 'tree', g: 1 }; groundStrike(${ax} + 0.5, ${ay} + 0.5); if (Game.wf && Game.wf.cells.length) burned++; }
    groundStrike(${ax + 6} + 0.5, ${ay} + 0.5); lamps = World.obj[idx(${ax + 6}, ${ay})].out ? 1 : 0;
    Game.wf = null; WX.fires.length = 0; return { burned, lamps };`);
  ok(bolt.burned >= 40, `сид ${seed}: молния в землю редко поджигает дерево: ${bolt.burned}/60`);
  ok(bolt.lamps === 1, `сид ${seed}: молния не разбила фонарь`);

  // ---- 10. Нагрузка и «вечный огонь»: лес на пол-карты, все очаги — число ограничено, всё гаснет
  h.run(DAY);
  h.run(`for (let dy = -9; dy <= 9; dy++) for (let dx = -9; dx <= 9; dx++) { const x = ${ax} + dx, y = ${ay} + dy; if (isFreeGrass(x, y)) World.obj[idx(x, y)] = { t: 'tree', g: 1 }; }
    Game.wf = null; for (let k = 0; k < 40; k++) wfIgnite(${ax} + (k % 7) - 3, ${ay} + ((k / 7) | 0) - 3, 1, true);`);
  peak.c = 0;
  run(sim, 40);
  ok(peak.c <= 28, `сид ${seed}: очагов одновременно ${peak.c} (> 28)`);
  run(sim, 120);
  q = cellsLeft(h);
  ok(q.c === 0 && q.b === 0 && q.fx === 0 && q.hens === 0 && q.ents === 0, `сид ${seed}: огонь не погас через ~3 мин: ${JSON.stringify(q)}`);

  // ---- 11. Сейв: очагов в сохранении нет, после загрузки их нет; кооп-флаг горящей курицы
  h.run(`Game.wf = null; wfIgnite(${ax}, ${ay}, 1, true); Game.__sv = JSON.parse(JSON.stringify(serializeGame()));`);
  ok(!/"wf"/.test(h.run('JSON.stringify(Game.__sv)')), `сид ${seed}: очаги огня попали в сохранение`);
  h.run('applySave(Game.__sv)');
  ok(h.run('!Game.wf'), `сид ${seed}: после загрузки остались очаги`);
  ok(!sim.errors.length, `сид ${seed}: исключения: ` + sim.errors.slice(0, 3).join(' | '));
}

// кооп-сервер: курица, горящая на сервере, помечена в пакете зверей; бедствие и очаги не роняют сервер
{
  const sim = L.newSim(5, { coop: true }), h = sim.h;
  h.run(DAY);
  for (let k = 0; k < 4; k++) { L.botTurn(sim); L.stepN(sim, 400); }
  h.run(`{ const hub = dzHub(); const a = makeAnimal('chicken', hub.doorX + 2, hub.doorY + 2); Game.animals.push(a); wfLightHen(a, 'fire'); Game.__ch = a; }`);
  L.stepN(sim, 20);
  const pk = h.run('typeof coopUnitsPacket === "function" ? coopUnitsPacket() : (typeof coopBuildU === "function" ? "" : "")');
  const src = require('fs').readFileSync(__dirname + '/../js/coop/coopsim.js', 'utf8') + require('fs').readFileSync(__dirname + '/../js/coop/coopclient.js', 'utf8');
  ok(/b: a\.burn \? 1/.test(src) && /a\.burn = d\.b/.test(src), 'кооп: флаг горящей курицы не передаётся клиенту');
  run(sim, 30);
  ok(!sim.errors.length, 'кооп: исключения: ' + sim.errors.slice(0, 3).join(' | '));
}

console.log(`Проверка малого огня: ${fails.length ? 'провалов ' + fails.length : 'всё в порядке'}; пик очагов ${peak.c}`);
process.exit(fails.length ? 1 : 0);
