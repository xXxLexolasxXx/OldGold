'use strict';
// Баги из отчётов тестеров 23–26.10 (0.11.45), которые проверяются в симуляции:
//  1. летописец Пим без шпиля (ярусы сброшены, поход окончен) не стоит вечно на дороге и уходит из отряда героя
//     (261023-2107-ec29, 261023-2108-9f15: «гном зациклился с сохранением»);
//  2. значки способностей в 11 строк (HC_ICON) рисуются без исключения — у жреца в коопе панель падала
//     на herokit.js:410 по 30 раз за минуту (261026-1741-2ecb);
//  3. кучка, пять минут пролежавшая на дороге, уходит на склад; что склад не берёт (мусор) — остаётся
//     (261026-1839-c751: «на дороге много валяется», 84 кучки в мире коопа).
// Запуск: node tests/reports-test.js
const S = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

const sim = S.newSim(5);
const R = code => sim.h.run(code);
S.runFor(sim, 5, 5, () => {});

// ---------- 1. летописец без шпиля
R(`Game.foe.tiers = null;
  const h = Game.hero, p = randomFreeNear(Math.floor(h.x), Math.floor(h.y), 1, 4, (x, y) => isWalkable(x, y));
  const u = spawnUnit('scribe', p[0] + 0.5, p[1] + 0.5); spyMakeScribe(u); u.teamOf = h.id; Game.__pim = u.id;
  Game.__lost = Game.lostGnomes;`);
ok(R('asT() === null') === true, 'шпиль не сброшен — проверка бессмысленна');
S.runFor(sim, 12, 1, () => {});
ok(R('!Game.units.some(u => u.id === Game.__pim && !u.dead)') === true, 'летописец без шпиля остался стоять в деревне');
ok(R('Game.lostGnomes === Game.__lost') === true, 'ушедший летописец засчитан в потери деревни');
ok(R('!Game.units.some(u => u.pim === 1 && u.teamOf)') === true, 'летописец остался в отряде героя');

// ---------- 2. значки: рисовалка не падает ни на одном значке (в песочнице document — заглушка, цикл идёт по-настоящему)
const bad = R(`(() => { const out = []; const keys = new Set([...Object.keys(ABIL_ICON), ...Object.keys(HC_ICON)]);
  for (const k of keys) { delete ABIL_ICON_URL[k]; try { abilIconURL(k); } catch (e) { out.push(k + ': ' + e.message); } }
  return out.join('; '); })()`);
ok(!bad, 'значок способности роняет рисовалку: ' + bad);
ok(R('Object.values(HC_ICON).some(g => g.length === 12)') === true, 'нет значков в 11 строк — проверка рисовалки ничего не ловит');

// ---------- 3. давняя кучка на дороге
const r3 = JSON.parse(R(`JSON.stringify((() => {
  const st = Game.buildings.find(b => b.type === 'storehouse');
  let cell = null;
  for (let r = 1; r < 12 && !cell; r++) for (let dy = -r; dy <= r && !cell; dy++) for (let dx = -r; dx <= r && !cell; dx++) {
    const x = st.doorX + dx, y = st.doorY + dy;
    if (inb(x, y) && World.road[idx(x, y)] && !World.door[idx(x, y)] && !Game.piles.has(idx(x, y))) cell = [x, y];
  }
  if (!cell) return { err: 'нет дороги у склада' };
  const p = dropPile(cell[0], cell[1], 'sausage', 3); dropPile(cell[0], cell[1], 'trash', 1);
  const s0 = st.stock.sausage, t0 = st.stock.trash;
  for (let i = 0; i < 20; i++) step(0.05);
  const early = st.stock.sausage - s0;        // свежая кучка сама на склад не прыгает (её может только унести трудяга)
  p.t0 = Game.time - PILE_SWEEP_T - 1;
  for (let i = 0; i < 20; i++) step(0.05);
  return { early, offer: p.offer('sausage'), trash: st.stock.trash - t0, got: st.stock.sausage - s0 };
})())`));
ok(!r3.err, r3.err);
if (!r3.err) {
  ok(r3.early === 0, `свежая кучка сразу оказалась на складе (+${r3.early})`);
  ok(r3.offer === 0 && r3.got > 0, `давняя кучка колбасы не ушла на склад: на месте ${r3.offer}, на складе +${r3.got}`);
  ok(r3.trash === 0, 'мусор с дороги «унесли» на склад, а склад его не берёт');
}

ok(!sim.errors.length, 'исключения: ' + sim.errors.slice(0, 2).join(' | '));
if (fails.length) { console.log(`✗ отчёты тестеров: ${fails.length} ошибок`); process.exit(1); }
console.log('✓ отчёты тестеров: летописец без шпиля, значки в 11 строк, давние кучки на дороге');
process.exit(0);
