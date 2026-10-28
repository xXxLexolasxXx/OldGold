'use strict';
// Бюджет производительности симуляции: деревня на 60 жителей, время шага (без отрисовки — в node её нет).
// Время меряется в «единицах машины»: перед замером крутится одна и та же числовая петля, и шаг делится на неё,
// поэтому порог не зависит от скорости компьютера и почти не зависит от его загрузки.
// Новая фича, которая заметно утяжелит шаг (ИИ, пути, нечисть на всех жителях), уронит тест — а не fps у игроков.
// Отрисовку и сборку кадров нечисти меряет tools/mobileperf.js в браузере (экран телефона, замедленный процессор).
// Запуск: node tests/perf-test.js [--report]   (--report — только цифры, без порога)
const S = require('./lib/sim');
const REPORT = process.argv.includes('--report');
// Порог: шаг деревни на 60 жителей ≤ STEP_UNITS единиц машины (замер 28.10: 2.6 и в 0.11.48, и в 0.11.87 — запас ×2).
const STEP_UNITS = 5;
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

// петля-эталон: ~10 мс на обычном ПК
function calib() {
  const a = new Float64Array(4096);
  let best = 1e9;
  for (let r = 0; r < 7; r++) {
    const t = process.hrtime.bigint();
    let s = 0;
    for (let k = 0; k < 600; k++) for (let i = 0; i < 4096; i++) { a[i] = a[i] * 0.999 + Math.sqrt(i + k); s += a[i]; }
    best = Math.min(best, Number(process.hrtime.bigint() - t) / 1e6);
    if (!isFinite(s)) throw new Error('эталон');
  }
  return best;
}

const sim = S.newSim(21);
const R = s => sim.h.run(s);
const PLAN = ['woodcutter', 'sawmill', 'farm', 'quarry', 'mill', 'bakery', 'woodcutter', 'swine', 'farm', 'brewery', 'hopfarm', 'storehouse', 'inn', 'well', 'butchery', 'tannery'];
for (const t of PLAN) { S.botPlace(sim, t); R("for (const b of Game.buildings) if (b.state !== 'done') finishBuilding(b); for (const s of [...Game.roadSites.values()]) completeRoad(s);"); }
R(`(function(){ const st = Game.buildings.find(b => b.type === 'storehouse');
  const add = (t, n) => { for (let k = 0; k < n; k++) { const s = randomFreeNear(st.doorX, st.doorY + 2, 0, 6) || [st.doorX, st.doorY + 1]; spawnUnit(t, s[0], s[1]); } };
  for (const b of Game.buildings) if (b.def.worker) add(b.def.worker, 1);
  add('builder', 6); add('serf', Math.max(0, 60 - Game.units.filter(isPerson).length));
  for (const s of Game.buildings.filter(b => b.isStore())) Object.assign(s.stock, { timber: 80, stone: 80, trunk: 40, bread: 80, sausage: 40, beer: 30 }); })()`);
const people = R('Game.units.filter(isPerson).length');
S.stepN(sim, 20 * 60);                 // минута прогрева: работы розданы, пути в кэше
const c0 = calib();
const STEPS = 20 * 120;                // две игровые минуты (день и вечер: нечисть, фонари)
const t0 = process.hrtime.bigint();
S.stepN(sim, STEPS);
const ms = Number(process.hrtime.bigint() - t0) / 1e6;
const c1 = calib(), cal = Math.min(c0, c1);
const perStep = ms / STEPS, units = perStep / cal * 10;   // на 10 мс эталона
const counts = R('JSON.stringify({ units: Game.units.length, floaters: (Game.floaters || []).length, log: (Game.log || []).length, piles: Game.piles.size })');
console.log(`Проверка: ${people} жителей, шаг ${perStep.toFixed(2)} мс (эталон ${cal.toFixed(1)} мс) = ${units.toFixed(2)} ед. машины; ${counts}`);
if (!REPORT) {
  ok(units <= STEP_UNITS, `шаг симуляции деревни на ${people} жителей дороже бюджета: ${units.toFixed(2)} > ${STEP_UNITS} ед. машины`);
  const c = JSON.parse(counts);
  ok(c.floaters < 200 && c.log < 400, `за 3 минуты накопились списки: всплывающих ${c.floaters}, журнал ${c.log}`);
  ok(!sim.errors.length, 'исключения: ' + sim.errors.slice(0, 2).join(' | '));
}
console.log(fails.length ? `Проверка: провалов ${fails.length}` : 'Проверка: бюджет производительности — в порядке');
process.exit(fails.length ? 1 : 0);
