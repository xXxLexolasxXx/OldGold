'use strict';
// Прогон травм и лечения: node tests/injury-run.js [--seeds 11,22,33] [--minutes 60]
// Метрики: травм в минуту (всего и по причинам), доля вылеченных у лекаря, среднее время до начала лечения, ошибки шага.
// Без мягкого старта (Game.noGrace); на 5-й минуте у склада ставится готовый лазарет с лекарем и зельями (--noward — без него).
const L = require('./lib/sim');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const SEEDS = arg('seeds', '11,22,33').split(',').map(Number);
const MINUTES = +arg('minutes', 60);
// чтобы метрики были при любой версии игры, считаем сами: обёртка над injure и снятием травмы
const HOOK = `(function () {
  const S = globalThis.__inj = { n: 0, src: {}, healed: 0, selfHealed: 0, light: 0, waits: [], seen: new Map() };
  const _i = injure;
  injure = function (u, part) {
    const had = !!u.injury; _i(u, part);
    if (!had && u.injury) { S.n++; S.seen.set(u.id, { t0: Game.time, light: null }); const m = /at ([^ (]+)/.exec(String(new Error().stack).split(String.fromCharCode(10))[2] || ''); const s = m ? m[1] : '?'; S.src[s] = (S.src[s] || 0) + 1; }
  };
  globalThis.__injPoll = function () {
    for (const [id, e] of S.seen) {
      const u = Game.units.find(x => x.id === id), t0 = e.t0;
      if (!u || u.dead) { S.seen.delete(id); continue; }
      // лёгкая (ушиб: гусь, кабан — заживает за минуту сама) — в долю вылеченных не идёт
      if (e.light === null && u.injury) e.light = !u.injCare && u.injuryUntil - t0 <= 60;
      if (!u.injury) { S.seen.delete(id); if (u.healedBy) { S.healed++; S.waits.push((u.healedAt || Game.time) - t0); } else if (e.light) S.light++; else S.selfHealed++; u.healedBy = null; }
    }
  };
})()`;
const WARD = `(function () {
  const st = Game.buildings.find(b => b.type === 'storehouse');
  let placed = null;
  for (let r = 3; r < 18 && !placed; r++) for (let dy = -r; dy <= r && !placed; dy++) for (let dx = -r; dx <= r && !placed; dx++) {
    if (checkPlacement('infirmary', st.x + dx, st.y + dy, 0)) continue;
    placed = placeBuilding('infirmary', st.x + dx, st.y + dy, true, 0);
  }
  if (placed) { placed.stock.potion = 4; spawnUnit('healer', placed.doorX, placed.doorY + 1); }
})()`;
// --dbg: раз в 10 минут — лекари, лазареты и раненые (тип:перерыв:где:уход:лекарь идёт:груз:секунд с травмы)
const DBG = `JSON.stringify({ t: Math.round(Game.time / 60),
  healers: Game.units.filter(u => u.type === 'healer').map(h => [h.inside ? h.inside.type : 'out', h.home ? h.home.type : '-', h.brk ? h.brk.kind : '-', !!h.injPat].join(':')),
  wards: Game.buildings.filter(b => b.type === 'infirmary').map(b => [b.state, !!b.worker, b.stock.potion, sickBeds(b)].join(':')),
  hurt: Game.units.filter(u => u.injury && isPerson(u)).map(u => [u.type, u.brk ? u.brk.kind : '-', u.inside ? u.inside.type : 'out', u.injCare || '', u.injDoc ? 'D' : '', u.carry || '', Math.round(Game.time - u.injAt)].join(':')) })`;
let bad = 0;
for (const seed of SEEDS) {
  const sim = L.newSim(seed);
  sim.h.run(HOOK);
  if (!argv.includes('--grace')) sim.h.run('Game.noGrace = true');
  const t0 = Date.now();
  L.runFor(sim, MINUTES * 60, 5, k => { if (k % 12 === 0) L.botTurn(sim); sim.h.run('__injPoll()'); if (k === 60 && !argv.includes('--noward')) sim.h.run(WARD);
    if (argv.includes('--dbg') && k % 120 === 119) console.log(sim.h.run(DBG)); });
  const r = JSON.parse(sim.h.run(`JSON.stringify({ n: __inj.n, src: __inj.src, healed: __inj.healed, self: __inj.selfHealed, light: __inj.light, open: __inj.seen.size, w: __inj.waits, pop: Game.units.filter(u => isPerson(u) && !u.dead).length, inf: Game.buildings.some(b => b.type === 'infirmary') })`));
  const avg = r.w.length ? Math.round(r.w.reduce((a, b) => a + b, 0) / r.w.length) : 0;
  const tot = r.healed + r.self;
  console.log(`сид ${seed}: ${MINUTES} мин, жителей ${r.pop}, травм ${r.n} (${(r.n / MINUTES).toFixed(2)}/мин) [${Object.entries(r.src).map(e => e.join(' ')).join(', ')}], у лекаря ${r.healed}, само ${r.self} (+ушибов ${r.light}), лечено ${tot ? Math.round(100 * r.healed / tot) : 0}%, до лечения ~${avg} с, лазарет ${r.inf ? 'есть' : 'нет'}, ${((Date.now() - t0) / 1000).toFixed(0)} с`);
  if (sim.errors.length) { bad++; console.log('  ✗ ошибки шага: ' + sim.errors.slice(0, 3).join(' | ')); }
  const inv = L.checkInvariants(sim, 'сид ' + seed);
  for (const p of inv.problems) { bad++; console.log('  ✗ ' + p); }
}
process.exit(bad ? 1 : 0);
