'use strict';
// Плотность событий на старте: журнал событий и тостов за первые N игровых минут на нескольких сидах.
//   node tools/start-density.js [--seeds 11,22,33] [--minutes 30] [--diff normal|calm] [--json out.json] [--list]
// Считает: записи журнала (logEvent) по видам, тосты, голод (мин. сытость, число голодных), потери гномов, население.
const L = require('../tests/lib/sim');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const SEEDS = arg('seeds', '11,22,33').split(',').map(Number), MINUTES = +arg('minutes', 30), DIFF = arg('diff', 'normal');
const out = [];
for (const seed of SEEDS) {
  const sim = L.newSim(seed);
  sim.h.run(`diffApplyStart(${JSON.stringify(DIFF)});
    globalThis.__ev = []; globalThis.__toasts = [];
    { const le = logEvent; logEvent = function (k, t, x, y) { __ev.push({ t: Game.time, k, text: String(t) }); return le.apply(this, arguments); }; }
    { toast = function (t, a, k) { __toasts.push({ t: Game.time, text: String(t) }); }; }`);
  let hungryMax = 0, foodMin = 99;
  L.runFor(sim, MINUTES * 60, 15, k => {
    if (k % 4 === 0) L.botTurn(sim);
    const s = JSON.parse(sim.h.run(`JSON.stringify((function(){ let h=0, m=99; for (const u of Game.units) if (!u.dead && isPerson(u) && !u.noFood) { if (u.food < 0.15) h++; if (u.food < m) m = u.food; } return { h, m }; })())`));
    hungryMax = Math.max(hungryMax, s.h); foodMin = Math.min(foodMin, s.m);
  });
  const ev = JSON.parse(sim.h.run('JSON.stringify(__ev)')), ts = JSON.parse(sim.h.run('JSON.stringify(__toasts)'));
  const st = JSON.parse(sim.h.run(`JSON.stringify({ pop: Game.units.filter(u => !u.dead && isPerson(u)).length, lost: Game.lostGnomes || 0, blds: Game.buildings.length, night: Game.nightNo || Game.nights || 0 })`));
  out.push({ seed, events: ev, toasts: ts, hungryMax, foodMin: Math.round(foodMin), errors: sim.errors, ...st });
}
const key = t => t.replace(/[0-9]+/g, '#').slice(0, 48);
const lines = [];
for (const o of out) {
  const byKind = {};
  for (const e of o.events) byKind[e.k] = (byKind[e.k] || 0) + 1;
  lines.push(`сид ${o.seed} (${DIFF}): записей журнала ${o.events.length} (${(o.events.length / MINUTES).toFixed(1)}/мин), тостов ${o.toasts.length} (${(o.toasts.length / MINUTES).toFixed(1)}/мин), жителей ${o.pop}, потерь ${o.lost}, макс. голодных ${o.hungryMax}, мин. сытость ${o.foodMin}, ошибок ${o.errors.length}`);
  lines.push('   по видам: ' + Object.entries(byKind).sort((a, b) => b[1] - a[1]).map(e => e[0] + ' ' + e[1]).join(', '));
  if (argv.includes('--list')) {
    const seen = new Set();
    for (const e of [...o.events.map(e => ({ ...e, src: 'лог' })), ...o.toasts.map(e => ({ ...e, k: 'toast', src: 'тост' }))].sort((a, b) => a.t - b.t)) {
      const kk = e.k + key(e.text); if (seen.has(kk)) continue; seen.add(kk);
      lines.push(`   ${String(Math.floor(e.t / 60)).padStart(2, '0')}:${String(Math.floor(e.t % 60)).padStart(2, '0')} [${e.k}] ${e.text.slice(0, 90)}`);
    }
  }
}
console.log(lines.join('\n'));
const jf = arg('json', ''); if (jf) require('fs').writeFileSync(jf, JSON.stringify(out));
process.exit(0);
