'use strict';
// Разбор одной пары ботов-чемпионов (для правки баланса по смыслу, а не вслепую):
//   node tools/soak/arena-diag.js mage paladin [--n 60]
// Печатает: долю побед, длину раунда, урон по видам (удар/способность/зона/горение-кровь), лечение,
// касты по способностям, среднюю дистанцию и долю времени «в своей дальности», время под контролем.
const A = require('../../js/arena/arenasim.js');
const argv = process.argv.slice(2);
const [ca, cb] = argv;
const n = +(argv[argv.indexOf('--n') + 1] || 60) || 60;
const side = () => ({ w: 0, dmg: {}, heal: {}, casts: {}, inRange: 0, cc: 0, hpEnd: 0, ev: {} });
const R = [side(), side()];
let ticks = 0, dist = 0, rounds = 0, rlen = 0;
const add = (o, k, v) => { o[k] = (o[k] || 0) + v; };
for (let k = 0; k < n; k++) {
  const flip = k & 1, cls = flip ? [cb, ca] : [ca, cb];
  const S = A.arenaNew({ seed: 1000 + k * 7919, cls, bots: [3, 3] });
  const me = i => (flip ? 1 - i : i);   // индекс бойца → сторона отчёта (0 — первый класс)
  while (S.phase !== 'over' && S.tick < 40000) {
    A.arenaStep(S, null);
    if (S.phase !== 'fight') continue;
    ticks++;
    const [F0, F1] = S.f, d = Math.hypot(F0.x - F1.x, F0.y - F1.y);
    dist += d;
    for (const F of S.f) {
      const C = A.ARENA_TUNE.cls[F.cls];
      if (d <= C.rng + 0.5) R[me(F.i)].inRange++;
      if (F.st.stun > S.T || F.st.ice > S.T || F.st.root > S.T) R[me(F.i)].cc++;
    }
    for (const e of S.ev) {
      if (e.k === 'dmg' && e.a >= 0) add(R[me(e.a)].dmg, e.kind + (e.src ? ':' + e.src : ''), e.n);
      else if (e.k === 'heal') add(R[me(e.i)].heal, e.why || 'heal', e.n);
      else if (e.k === 'cast' || e.k === 'ult') add(R[me(e.i)].casts, e.ab, 1);
      if (['miss', 'dodge', 'perfect', 'ward', 'whiff', 'inv', 'block', 'shield', 'st', 'fail', 'tel'].includes(e.k) && e.i >= 0) add(R[me(e.i)].ev, e.k + (e.s ? ':' + e.s : '') + (e.why ? ':' + e.why : ''), 1);
    }
  }
  for (const F of S.f) add(R[me(F.i)].dmg, 'всего(sm)', F.sm.dmg);
  if (S.winner >= 0) R[me(S.winner)].w++;
  for (const r of S.rw) { rounds++; rlen += r.t; }
}
const r1 = v => Math.round(v);
console.log(`${ca} против ${cb}: ${n} боёв, ${ca} побед ${Math.round(R[0].w / n * 100)}%, раунд ${(rlen / rounds).toFixed(1)} с, дистанция ${(dist / ticks).toFixed(2)}`);
[ca, cb].forEach((c, i) => {
  const s = R[i], per = v => r1(v / rounds);
  console.log(`\n${c}: в своей дальности ${Math.round(s.inRange / ticks * 100)}% времени, под контролем ${Math.round(s.cc / ticks * 100)}%`);
  console.log('  урон за раунд:', Object.entries(s.dmg).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${per(v)}`).join(', '));
  console.log('  лечение за раунд:', Object.entries(s.heal).map(([k, v]) => `${k} ${per(v)}`).join(', ') || '—');
  console.log('  события на нём за раунд:', Object.entries(s.ev).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / rounds).toFixed(1)}`).join(', '));
  console.log('  касты за раунд:', Object.entries(s.casts).map(([k, v]) => `${k} ${(v / rounds).toFixed(1)}`).join(', '));
});
