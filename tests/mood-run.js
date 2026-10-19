'use strict';
// Прогон настроения гномов: node tests/mood-run.js [--seeds 11,22,33] [--minutes 30] [--save]
// Метрики каждые 5 игровых минут: среднее настроение, бодрые/хмурые, срывы (драки, пиво, бастовка), уходы, хандра,
// число жителей, производство, ошибки консоли (исключения шага), время шага симуляции.
const L = require('./lib/sim');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const SEEDS = arg('seeds', '11,22,33').split(',').map(Number);
const MINUTES = +arg('minutes', 30);
let bad = 0;
for (const seed of SEEDS) {
  const sim = L.newSim(seed);
  if (argv.includes('--off')) sim.h.run('moodTick = function () {}');   // для сравнения: без настроения
  const t0 = Date.now();
  const rows = [];
  L.runFor(sim, MINUTES * 60, 30, k => {
    if (k % 2 === 0) L.botTurn(sim);
    if ((k + 1) % 10 === 0) {
      const r = JSON.parse(sim.h.run(`JSON.stringify((function(){ const V = typeof mdVillage === 'function' ? mdVillage() : {avg:0,good:0,bad:0,crit:0}, S = Object.assign({}, Game.moodStat || {}); let prod = 0; for (const g in Game.produced) prod += Game.produced[g]; const mu = Game.units.filter(u => u.mdMul).map(u => u.mdMul); return { t: Math.round(Game.time / 60), n: Game.units.length, avg: Math.round(V.avg * 10) / 10, good: V.good, bad: V.bad, crit: V.crit, S, prod, mul: mu.length ? Math.round(mu.reduce((a, b) => a + b, 0) / mu.length * 1000) / 1000 : 1, lost: Game.lostGnomes || 0, gl: Game.mood ? Game.mood.gloom > Game.time : false }; })())`));
      rows.push(r);
    }
  });
  const inv = L.checkInvariants(sim, 'сид ' + seed);
  console.log(`\n=== сид ${seed}, ${MINUTES} мин, ${((Date.now() - t0) / 1000).toFixed(1)} с реального ===`);
  for (const r of rows) console.log(`  ${String(r.t).padStart(2)} мин: жителей ${r.n}, настроение ${r.avg} (бодры ${r.good}, хмуры ${r.bad}, на грани ${r.crit}), темп ×${r.mul}, произведено ${r.prod}, потерь ${r.lost}${r.gl ? ', ХАНДРА' : ''}; ` + Object.entries(r.S).map(e => e[0] + ' ' + e[1]).join(', '));
  if (inv.problems.length) { bad++; console.log('  ✗ инварианты: ' + inv.problems.join('; ')); }
  if (sim.errors.length) { bad++; console.log('  ✗ ошибки шага:\n    ' + sim.errors.join('\n    ')); }
  else console.log('  ошибок шага нет');
  if (argv.includes('--card')) {
    console.log(sim.h.run(`(function(){ const u = Game.units.find(u => mdOn(u) && u.md && u.md.r.length); return u ? JSON.stringify({ t: u.type, m: u.md.m, n: u.md.n, r: u.md.r }) : 'нет'; })()`));
  }
}
process.exit(bad ? 1 : 0);
