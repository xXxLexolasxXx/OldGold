'use strict';
// Баланс дров зимой: бот-хозяйство с домами, по каждой зиме — печей, дров к зиме, расход, сколько зданий и сколько секунд мёрзло, жители.
// Запуск: node tests/firewood-balance.js [--seeds 1,2,3,4,5] [--years 2] [--houses 4] [--cutters 2]
const L = require('./lib/sim');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const SEEDS = arg('seeds', '1,2,3,4,5').split(',').map(Number), YEARS = +arg('years', 2), HOUSES = +arg('houses', 4), CUT = +arg('cutters', 2);
const PLAN = ['woodcutter', 'sawmill', 'farm', 'quarry', 'mill', 'bakery', 'woodcutter', 'swine', 'farm', 'brewery', 'hopfarm', 'goatpen', 'quarry']
  .concat(Array(Math.max(0, CUT - 2)).fill('woodcutter')).concat(Array(HOUSES).fill('house'));
let bad = 0; const ONCE = argv.includes('--once'), ND = +arg('winterdays', 0);
for (const seed of SEEDS) {
  const sim = L.newSim(seed), h = sim.h, len = h.run('SEA().len'), target = len * 4 * YEARS;
  let win = null, coldSec = 0, last = null;
  const people = () => h.run('Game.units.filter(u => !u.dead && isPerson(u)).length');
  while (true) {
    L.stepN(sim, 200);
    if (Math.round(h.run('Game.time')) % 60 < 10) L.botTurn(sim, PLAN);
    const st = JSON.parse(h.run('JSON.stringify({ idx: seaIdx(), day: seaDay(), w: seaWoodInfo(), b: SEA().burned || 0, cold: Game.buildings.filter(b => b.cold).length, trunk: Game.produced.trunk || 0, cut: Game.buildings.filter(b => b.type === "woodcutter" && b.state === "done").length })'));
    if (st.day >= target) break;
    if (st.idx === 2) {
      if (!win) win = { seed, y: Math.floor(st.day / (len * 4)) + 1, heated: st.w.n, wood0: st.w.have, need: st.w.need, cut: st.cut, ppl0: people() };
      coldSec += st.cold * 10;
      if (ND && st.day % len >= ND) { win.burned = st.b; win.coldBldSec = coldSec; win.wood1 = st.w.have; win.ppl1 = people(); win.cutDone = st.cut; console.log(JSON.stringify(win)); if (coldSec > 0) bad++; break; }
    }
    if (st.idx !== 2 && win) { win.burned = last.b; win.coldBldSec = coldSec; win.wood1 = last.w.have; win.ppl1 = people(); console.log(JSON.stringify(win)); if (coldSec > 0) bad++; win = null; coldSec = 0; if (ONCE) break; }
    last = st;
  }
  console.log(`seed ${seed}: errors=${sim.errors.length}`);
  for (const e of sim.errors.slice(0, 3)) console.log('  ✗ ' + e);
}
console.log(bad ? `зим с холодом: ${bad}` : 'ни одна зима не мёрзла');
