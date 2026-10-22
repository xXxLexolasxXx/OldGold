'use strict';
// Жилые дома: восемь видов, расселение семьями, ночёвка, укрытие от нечисти, разбитый дом, сейв, кооп, старые деревни без домов.
// Запуск: node tests/house-test.js   (печатает ✗, код выхода 1 при провале)
const L = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };

function place(sim, n, r0 = 3) {
  return JSON.parse(sim.h.run(`JSON.stringify((function () {
    const hub = Game.buildings.find(b => b.type === 'storehouse'), out = [];
    for (let r = ${r0}; r < 30 && out.length < ${n}; r++) for (let dy = -r; dy <= r && out.length < ${n}; dy++) for (let dx = -r; dx <= r && out.length < ${n}; dx++) {
      const x = hub.x + dx, y = hub.y + dy;
      if (x < 2 || y < 2 || x > MAP_W - 4 || y > MAP_H - 4) continue;
      if (!checkPlacement('house', x, y, 0)) { const b = placeBuilding('house', x, y, true, 0); out.push(b.id); }
    }
    return out;
  })())`));
}
// дотикать до ночи (не дольше max секунд)
function toNight(sim, max) {
  for (let t = 0; t < max; t += 5) { if (sim.h.run('isNightNow()')) return true; L.runFor(sim, 5, 5); }
  return sim.h.run('isNightNow()');
}
const J = (sim, c) => JSON.parse(sim.h.run('JSON.stringify((function(){' + c + '})())'));

// ---- 1. Старая деревня без домов: никаких новых перерывов и штрафов
{
  const sim = L.newSim(3);
  ok(sim.h.run('!!BUILDINGS.house && BUILD_ORDER.includes("house") && UNLOCKS.some(s => s.id === "home")'), 'дом есть в списке зданий и открывается в меню');
  ok(sim.h.run('UNLOCKS.find(s => s.id === "home").after.includes("sawmill") && !UNLOCKS.find(s => s.id === "res").items.includes("house")'), 'дом открывается рано (после лесопилки), но не на самом старте');
  toNight(sim, 420);
  L.runFor(sim, 40, 5);
  const r = J(sim, `return { home: Game.units.filter(u => u.brk && u.brk.kind === 'home').length, nh: Game.units.filter(u => u.md && u.md.ev.some(e => e[0] === 'nohome')).length };`);
  ok(r.home === 0 && r.nh === 0, `без домов ничего не меняется: ушли «домой» ${r.home}, «ночует где придётся» ${r.nh}`);
  ok(!sim.errors.length, 'ошибок нет: ' + sim.errors.slice(0, 2).join(' | '));
}

// ---- 2. Дома: виды, расселение, ночь, нечисть, разбитый дом, сейв
{
  const sim = L.newSim(7);
  const ids = place(sim, 6);
  ok(ids.length === 6, 'поставлено 6 домов: ' + ids.length);
  const vs = J(sim, `return Game.buildings.filter(b => b.type === 'house').map(b => b.hv);`);
  ok(new Set(vs).size >= 4 && vs.every(v => v >= 0 && v < 8), 'виды домов разные (0–7): ' + vs.join(','));
  ok(sim.h.run('HV.length') === 8, 'восемь вариантов облика');
  // семья: двое взрослых — супруги, у них гномёнок
  J(sim, `const a = Game.units.filter(u => houseFolk(u) && u.type !== 'kid' && u.fam);
    const m = a.find(u => u.fam.sx === 'm'), f = a.find(u => u !== m);
    f.fam.sx = 'f'; m.fam.sp = f.id; f.fam.sp = m.id;
    const k = spawnUnit('kid', m.x | 0, m.y | 0);
    k.fam = { n: 'Тестик', r: m.fam.r, sx: 'm', a: 0, sp: 0, pn: [m.fam.n, f.fam.n], kn: [], g: 2 };
    Game.__fam = [m.id, f.id, k.id]; return 0;`);
  L.runFor(sim, 4, 2);
  const as = J(sim, `const hs = Game.buildings.filter(b => b.type === 'house');
    const fam = Game.__fam.map(id => Game.units.find(u => u.id === id));
    return { over: hs.filter(b => houseResidents(b).length > houseCap(b)).length, n: Game.units.filter(u => u.dwell).length,
      folk: Game.units.filter(houseFolk).length, same: fam.every(u => u.dwell && u.dwell === fam[0].dwell) };`);
  ok(as.over === 0, 'ни один дом не переполнен');
  ok(as.n === Math.min(as.folk, 18), `расселены все, кому хватило мест: ${as.n} из ${as.folk}`);
  ok(as.same, 'семья (муж, жена, гномёнок) живёт в одном доме');
  // ночь: уставшие спят дома
  J(sim, `for (const u of Game.units) if (houseFolk(u) && u.md) u.md.rest = 0.4; return 0;`);
  ok(toNight(sim, 480), 'наступила ночь');
  J(sim, `for (const u of Game.units) if (houseFolk(u)) { mdOf(u).rest = 0.4; u.homeNext = 0; } return 0;`);
  L.runFor(sim, 30, 5);
  const n1 = J(sim, `return { in: Game.units.filter(u => u.inside && u.inside.type === 'house').length, home: Game.units.filter(u => u.brk && u.brk.kind === 'home').length };`);
  ok(n1.in >= 3, `ночью жильцы спят по домам: внутри ${n1.in}, идут домой ${n1.home}`);
  // призраки у домов не трогают тех, кто внутри
  J(sim, `const b = Game.buildings.find(x => x.type === 'house' && Game.units.some(u => u.inside === x));
    Game.__h = b.id; Game.__in = Game.units.filter(u => u.inside === b).map(u => u.id);
    for (const u of Game.units) if (Game.__in.includes(u.id)) { u.md.rest = 0.1; }
    if (typeof ghostsSpawn === 'function') ghostsSpawn(3);
    for (const g of Game.ghosts || []) { g.x = b.doorX + 0.5; g.y = b.doorY + 1; }
    return 0;`);
  L.runFor(sim, 15, 5);
  const g = J(sim, `const b = Game.buildings.find(x => x.id === Game.__h);
    const us = Game.__in.map(id => Game.units.find(u => u.id === id)).filter(Boolean);
    return { n: Game.__in.length, alive: us.filter(u => !u.dead).length, inside: us.filter(u => u.inside === b).length, gh: (Game.ghosts || []).length, why: us.filter(u => u.inside !== b).map(u => [u.type, u.dead, u.brk && u.brk.kind, u.inside && u.inside.type, isNightNow(), u.food, u.md && u.md.rest]) };`);
  ok(g.alive === g.n && g.inside === g.n, `внутри дома призраки никого не тронули: ${g.inside}/${g.n} на месте (призраков ${g.gh}) ${JSON.stringify(g.why)}`);
  // разбитый дом не защищает: жильцы выходят
  J(sim, `const b = Game.buildings.find(x => x.id === Game.__h); b.dmg = 0.6; return 0;`);
  L.runFor(sim, 4, 2);
  const br = J(sim, `const b = Game.buildings.find(x => x.id === Game.__h); return Game.units.filter(u => u.inside === b).length;`);
  ok(br === 0, 'из разбитого дома жильцы выбежали: внутри ' + br);
  // дом 3-го уровня: 6 жильцов, ломается вдвое медленнее
  const l3 = J(sim, `const b = Game.buildings.find(x => x.id === Game.__h); b.dmg = 0;
    upgradeBuilding(b, true); upgradeBuilding(b, true);
    const e = { x: b.x, y: b.y }; const d0 = b.dmg; buildingHit(e, b); const one = b.dmg - d0;
    const c = Game.buildings.find(x => x.type === 'house' && x !== b); c.dmg = 0; buildingHit(e, c);
    return { lv: b.level, cap: houseCap(b), k: one / c.dmg };`);
  ok(l3.lv === 3 && l3.cap === 6, `дом уровня 3 вмещает 6: уровень ${l3.lv}, мест ${l3.cap}`);
  ok(Math.abs(l3.k - 0.5) < 0.01, 'дом уровня 3 ломается вдвое медленнее: ' + l3.k.toFixed(2));
  // сейв: дома, уровни и виды на месте
  const before = J(sim, `return Game.buildings.filter(b => b.type === 'house').map(b => [b.x, b.y, b.level || 1, b.hv]);`);
  sim.h.run('{ const s = JSON.parse(JSON.stringify(serializeGame())); applySave(s); }');
  L.runFor(sim, 4, 2);
  const after = J(sim, `return Game.buildings.filter(b => b.type === 'house').map(b => [b.x, b.y, b.level || 1, b.hv]);`);
  ok(JSON.stringify(after) === JSON.stringify(before), 'после загрузки дома, уровни и виды те же');
  ok(J(sim, 'return Game.units.filter(u => u.dwell).length') > 0, 'после загрузки жильцы снова расселены');
  ok(!sim.errors.length, 'ошибок нет: ' + sim.errors.slice(0, 2).join(' | '));
}

// ---- 3. Кооп-сервер: дома считает сервер, ошибок нет
{
  const sim = L.newSim(11, { coop: true });
  place(sim, 3);
  toNight(sim, 480);
  L.runFor(sim, 30, 5);
  ok(!sim.errors.length, 'кооп: ночь с домами без ошибок: ' + sim.errors.slice(0, 2).join(' | '));
  ok(J(sim, 'return Game.units.filter(u => u.dwell).length') > 0, 'кооп: жильцы расселены');
}

// ---- 4. Баланс: с домами деревня живёт не хуже, чем без них (двое суток, бот строит хозяйство; сумма по сидам — одна деревня слишком случайна)
{
  const runV = (seed, houses) => {
    const sim = L.newSim(seed);
    if (houses) place(sim, 4, 8);
    L.runFor(sim, 1150, 5, () => L.botTurn(sim));
    return Object.assign(J(sim, `return { alive: Game.units.filter(u => !u.dead && isPerson(u) && u.type !== 'hero').length,
      made: Object.values(Game.produced).reduce((a, n) => a + n, 0), slept: Game.units.filter(u => u.md && u.md.ev.some(e => e[0] === 'home')).length };`), { err: sim.errors.length });
  };
  const sum = (houses) => [13, 22, 31].map(s => runV(s, houses)).reduce((a, r) => ({ alive: a.alive + r.alive, made: a.made + r.made, slept: a.slept + r.slept, err: a.err + r.err }), { alive: 0, made: 0, slept: 0, err: 0 });
  const a = sum(false), b = sum(true);
  console.log(`    три деревни без домов: жителей ${a.alive}, сделано ${a.made} · с домами: жителей ${b.alive}, сделано ${b.made}, выспались дома ${b.slept}`);
  ok(b.alive >= a.alive - 3, 'с домами жителей не меньше (допуск 1 на деревню)');
  ok(b.made >= a.made * 0.88, 'с домами производство не проседает больше чем на 12%');
  ok(!a.err && !b.err, 'двое суток без ошибок');
}

console.log(fails.length ? `Проверка домов: провалов ${fails.length}` : 'Проверка домов: всё в порядке');
process.exit(fails.length ? 1 : 0);
