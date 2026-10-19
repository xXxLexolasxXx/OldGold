'use strict';
// Баланс зимы при SEASON_DAYS суток на сезон: прогон нескольких сидов по нескольку игровых лет, бот-хозяйство.
// Запуск: node tests/season-balance.js [--seeds 11,22,33] [--years 3]   (печатает по каждой зиме: сено, падёж, жители)
const L = require('./lib/sim');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const SEEDS = arg('seeds', '11,22,33').split(',').map(Number), YEARS = +arg('years', 3);
const rows = [];
for (const seed of SEEDS) {
  const sim = L.newSim(seed);
  const len = sim.h.run('SEA().len');
  let hay0 = 0, prev = null, last = null, t0 = Date.now(), win = null;
  const people = () => sim.h.run('Game.units.filter(u => !u.dead && isPerson(u)).length');
  const target = len * 4 * YEARS;
  while (true) {
    L.stepN(sim, 200);                                   // 10 игровых секунд
    if (Math.round(sim.h.run('Game.time')) % 60 < 10) L.botTurn(sim);
    const st = JSON.parse(sim.h.run('JSON.stringify({ idx: seaIdx(), day: seaDay(), snow: SEA().snow, h: seaHayInfo(), pl: SEA().pigsLost, lost: SEA().lost, t: Game.time, pigs: Game.buildings.reduce((a, b) => a + seaHerd(b), 0), hayMade: Math.round(Game.produced.hay || 0), farms: Game.buildings.filter(b => b.type === 'farm').length, starve: Game.log.filter(l => /голод|умер/i.test(l.text || l.msg || "")).length })'));
    if (st.day >= target) break;
    if (st.idx === 2 && !win) win = { seed, y: Math.floor(st.day / (len * 4)) + 1, need: st.h.need, have: st.h.have, pigs0: st.pigs, hayMade: st.hayMade - (hay0 || 0), farms: st.farms, ppl0: people() };
    if (st.idx !== 2 && win) { hay0 = st.hayMade; win.pigsLost = st.pl; win.wildLost = st.lost; win.ppl1 = people(); win.sec = ((Date.now() - t0) / 1000) | 0; rows.push(win); console.log(JSON.stringify(win)); win = null; }
    last = st;
  }
  console.log(`seed ${seed}: errors=${sim.errors.length}, дней=${last && last.day}, сек=${((Date.now() - t0) / 1000) | 0}`);
  for (const e of sim.errors.slice(0, 3)) console.log('  ✗ ' + e);
}
