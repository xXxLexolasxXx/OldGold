'use strict';
// Подбор ARENA_TUNE по всей матрице сразу (АРЕНА.md, 7.4): для каждой «ручки» (здоровье, урон, скорость класса,
// дальность стрелков, лечение, зоны, контроль) считается, как она сдвигает логит доли побед в каждой паре и долю
// против поля (матрица на одних и тех же сидах), затем решается задача наименьших квадратов с затуханием
// (Левенберг — Марквардт) — какие множители приблизят все пары к 50%. Шаг проверяется на свежих сидах.
//   node tools/soak/arena-fit.js --n 100 --iters 4 --out fit.json
// Итог — JSON правок для ARENA_TUNE (лучший по свежей проверке); переносится в arenasim.js руками.
const fs = require('fs');
const path = require('path');
const { runMatrix } = require('./arena.js');
const A = require('../../js/arena/arenasim.js');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const N = +arg('n', 100), ITERS = +arg('iters', 4), OUT = arg('out', path.join(__dirname, 'arena-fit.json')), H = 0.1;
const C = A.ARENA_CLS, B = JSON.parse(JSON.stringify(A.ARENA_TUNE));

// ручки: множитель к базовому значению в границах
const K = [];
const clsK = (c, f, lo, hi) => K.push({ n: `${c}.${f}`, lo, hi, set: (o, m) => { (o.cls[c] = o.cls[c] || {})[f] = +(B.cls[c][f] * m).toFixed(3); } });
const abK = (k, f, lo, hi) => K.push({ n: `${k}.${f}`, lo, hi, set: (o, m) => { (o.ab[k] = o.ab[k] || {})[f] = +(B.ab[k][f] * m).toFixed(3); } });
for (const c of C) { clsK(c, 'hp', 0.6, 1.6); clsK(c, 'dmg', 0.6, 1.6); clsK(c, 'mv', 0.9, 1.1); }
clsK('druid', 'rng', 0.8, 1.5); clsK('archer', 'rng', 0.75, 1.1); clsK('mage', 'rng', 0.75, 1.2);
abK('consecrate', 'dot', 0.3, 2); abK('ult_paladin', 'dot', 0.3, 2); abK('heal', 'heal', 0.5, 1.5); abK('hands', 'heal', 0.5, 1.5); abK('mend', 'heal', 0.5, 1.5);
abK('sour', 'sil', 0.4, 2); abK('chord', 'stun', 0.5, 1.3); abK('thorns', 'root', 0.4, 2); abK('grow', 'slow', 0.4, 2);
abK('fire', 'mul', 0.6, 1.4); abK('frost', 'ice', 0.5, 1.3); abK('ult_druid', 'root', 0.5, 1.5); abK('ult_bard', 'stun', 0.5, 1.3);
const topK = (f, lo, hi) => K.push({ n: f, lo, hi, set: (o, m) => { o[f] = +(B[f] * m).toFixed(3); } });
topK('dotHeal', 0.6, 2); topK('otHeal', 0.6, 1.33);
const lo = K.map(k => Math.log(k.lo)), hi = K.map(k => Math.log(k.hi));
const overOf = x => { const o = { cls: {}, ab: {} }; K.forEach((k, i) => { if (x[i]) k.set(o, Math.exp(x[i])); }); return o; };
const clampX = x => x.map((v, i) => Math.max(lo[i], Math.min(hi[i], v)));

// вектор «невязок»: логиты пар (цель 0) и доли против поля (цель 0)
const lg = p => { const q = Math.max(0.02, Math.min(0.98, p)); return Math.log(q / (1 - q)); };
function resid(R) {
  const r = [];
  for (let i = 0; i < C.length; i++) for (let j = i + 1; j < C.length; j++) {
    const a = R.M[C[i]][C[j]], b = R.M[C[j]][C[i]];
    r.push(lg((a.w + b.n - b.w) / (a.n + b.n)));
  }
  for (const c of C) r.push(2 * lg(R.F[c].w / R.F[c].n));
  return r;
}
function stats(R) {
  let o4 = 0, o2 = 0, mx = 0;
  for (let i = 0; i < C.length; i++) for (let j = i + 1; j < C.length; j++) {
    const a = R.M[C[i]][C[j]], b = R.M[C[j]][C[i]], d = Math.abs((a.w + b.n - b.w) / (a.n + b.n) - 0.5);
    if (d > 0.1) o4++; if (d > 0.3) o2++; mx = Math.max(mx, d);
  }
  const f = C.map(c => R.F[c].w / R.F[c].n);
  return { o4, o2, mx: 50 + mx * 100, fieldOut: f.filter(v => v < 0.45 || v > 0.55).length, len: R.avgLen, timer: R.timerShare, f };
}
const run = (x, seed) => runMatrix({ n: N, tier: 3, seed, over: overOf(x), threads: 16 });
// решение (JᵀJ + λ·diag) dx = −Jᵀr методом Гаусса
function solve(J, r, lam) {
  const n = J[0].length, M = Array.from({ length: n }, () => new Float64Array(n + 1));
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) { let s = 0; for (let k = 0; k < J.length; k++) s += J[k][a] * J[k][b]; M[a][b] = s; }
    M[a][a] += lam * (M[a][a] + 1);
    let s = 0; for (let k = 0; k < J.length; k++) s -= J[k][a] * r[k]; M[a][n] = s;
  }
  for (let c = 0; c < n; c++) {
    let p = c; for (let q = c + 1; q < n; q++) if (Math.abs(M[q][c]) > Math.abs(M[p][c])) p = q;
    [M[c], M[p]] = [M[p], M[c]];
    for (let q = 0; q < n; q++) if (q !== c && M[c][c]) { const f = M[q][c] / M[c][c]; for (let k = c; k <= n; k++) M[q][k] -= f * M[c][k]; }
  }
  return M.map((row, i) => (row[i] ? row[n] / row[i] : 0));
}

async function main() {
  let x = K.map(() => 0), best = null;
  if (argv.includes('--resume') && fs.existsSync(OUT)) { const j = JSON.parse(fs.readFileSync(OUT, 'utf8')); if (j.x && j.x.length === K.length) x = j.x; }
  for (let it = 0; it < ITERS; it++) {
    const seed = 4000 + it * 17;
    const R0 = await run(x, seed), r0 = resid(R0), s0 = stats(R0);
    console.log(`шаг ${it}: вне 40–60 ${s0.o4}, вне 20–80 ${s0.o2}, макс ${s0.mx.toFixed(0)}%, поле вне 45–55: ${s0.fieldOut}, раунд ${s0.len.toFixed(1)} с`);
    // якобиан по ручкам (в логарифмах множителей)
    const J = r0.map(() => new Float64Array(K.length));
    for (let k = 0; k < K.length; k++) {
      const xk = x.slice(); xk[k] = Math.min(hi[k], x[k] + H);
      const h = xk[k] - x[k] || -H; if (h < 0) xk[k] = x[k] + h;
      const rk = resid(await run(xk, seed));
      for (let q = 0; q < r0.length; q++) J[q][k] = (rk[q] - r0[q]) / h;
    }
    // несколько силы затухания — берём лучший на свежих сидах
    let pick = null;
    for (const lam of [0.3, 1, 3]) {
      const dx = solve(J, r0, lam);
      const xn = clampX(x.map((v, i) => v + 0.7 * dx[i]));
      const s = stats(await run(xn, 90000 + it * 31 + Math.round(lam * 10)));
      const score = s.o4 + 2 * s.o2 + 2 * s.fieldOut + (s.len < 35 || s.len > 55 ? 5 : 0);
      console.log(`  λ ${lam}: вне 40–60 ${s.o4}, вне 20–80 ${s.o2}, макс ${s.mx.toFixed(0)}%, поле вне ${s.fieldOut}, раунд ${s.len.toFixed(1)} с`);
      if (!pick || score < pick.score) pick = { score, xn, s };
    }
    const s0score = s0.o4 + 2 * s0.o2 + 2 * s0.fieldOut;
    if (pick.score < s0score) x = pick.xn;
    if (!best || pick.score < best.score) best = { score: pick.score, x: pick.xn, stats: pick.s, over: overOf(pick.xn) };
    fs.writeFileSync(OUT, JSON.stringify(Object.assign({ knobs: K.map(k => k.n) }, best), null, 1));
  }
  console.log('ЛУЧШЕЕ', JSON.stringify(best.stats), JSON.stringify(best.over));
}
main();
