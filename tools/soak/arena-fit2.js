'use strict';
// Подбор ARENA_TUNE, второй вариант (после arena-fit.js): якобиан считается только по тем парам, где «ручка» участвует
// (ручка класса X двигает лишь пары с X), поэтому на каждую ручку идёт в 5 раз меньше боёв, а значит можно брать по 300 боёв на пару
// и не гнаться за шумом. Невязки: логиты пар и доли против поля, пары вне 25–75% и поле вне 45–55% весят больше.
// Шаг Левенберга — Марквардта проверяется на свежих сидах вместе с текущей точкой; принимается только улучшение.
//   node tools/soak/arena-fit2.js --n 300 --iters 6 --threads 8 [--resume]
// Лучшее пишет в tools/soak/arena-fit2.json (правки для ARENA_TUNE); перенос в arenasim.js — руками.
const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');
const A = require('../../js/arena/arenasim.js');
const ARENA_JS = path.join(__dirname, 'arena.js');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const N = +arg('n', 300), ITERS = +arg('iters', 6), THREADS = +arg('threads', 8), OUT = arg('out', path.join(__dirname, 'arena-fit2.json')), H = +arg('h', 0.12);
const C = A.ARENA_CLS, B = JSON.parse(JSON.stringify(A.ARENA_TUNE));
const owner = {};
for (const c of C) for (const k of A.ARENA_KIT[c]) owner[k] = c;

// ручки: множитель к базовому значению в границах; cls — чьи пары двигает (null — все)
const K = [];
const clsK = (c, f, lo, hi) => K.push({ n: `${c}.${f}`, cls: c, lo, hi, set: (o, m) => { (o.cls[c] = o.cls[c] || {})[f] = +(B.cls[c][f] * m).toFixed(3); } });
const abK = (k, f, lo, hi) => K.push({ n: `${k}.${f}`, cls: owner[k], lo, hi, set: (o, m) => { (o.ab[k] = o.ab[k] || {})[f] = +(B.ab[k][f] * m).toFixed(3); } });
for (const c of C) { clsK(c, 'hp', 0.7, 1.45); clsK(c, 'dmg', 0.7, 1.45); clsK(c, 'mv', 0.92, 1.08); clsK(c, 'atkT', 0.85, 1.2); }
clsK('druid', 'rng', 0.8, 1.4); clsK('archer', 'rng', 0.75, 1.1); clsK('mage', 'rng', 0.75, 1.2);
abK('consecrate', 'dot', 0.3, 2); abK('ult_paladin', 'dot', 0.3, 2); abK('heal', 'heal', 0.5, 1.5); abK('hands', 'heal', 0.5, 1.5); abK('mend', 'heal', 0.5, 1.5);
abK('sour', 'sil', 0.4, 2); abK('chord', 'stun', 0.5, 1.3); abK('thorns', 'root', 0.4, 2); abK('grow', 'slow', 0.4, 2);
abK('fire', 'mul', 0.6, 1.4); abK('frost', 'ice', 0.5, 1.3); abK('ult_druid', 'root', 0.5, 1.5); abK('ult_bard', 'stun', 0.5, 1.3);
const lo = K.map(k => Math.log(k.lo)), hi = K.map(k => Math.log(k.hi));
const overOf = x => { const o = { cls: {}, ab: {} }; K.forEach((k, i) => { if (x[i]) k.set(o, Math.exp(x[i])); }); return o; };
const clampX = x => x.map((v, i) => Math.max(lo[i], Math.min(hi[i], v)));

const PAIRS = [];
for (let i = 0; i < C.length; i++) for (let j = i + 1; j < C.length; j++) PAIRS.push([C[i], C[j]]);
const pkey = (a, b) => a + '|' + b;

// бои по заданным парам: n на пару, поровну с каждой стороны; результат — доля побед первого класса
async function runPairs(over, pairs, n, seed) {
  const jobs = [];
  pairs.forEach(([a, b], pi) => { for (let k = 0; k < n; k++) jobs.push([a, b, (seed * 1000003 + pi * 104729 + k * 15485863) >>> 0, k & 1]); });
  const W = Math.max(1, Math.min(THREADS, jobs.length));
  const chunks = Array.from({ length: W }, () => []);
  jobs.forEach((j, i) => chunks[i % W].push(j));
  const parts = await Promise.all(chunks.map(c => new Promise((res, rej) => {
    const w = new Worker(ARENA_JS, { workerData: { jobs: c, tier: 3, over } });
    w.on('message', res); w.on('error', rej);
  })));
  const R = {}; let rounds = 0, len = 0;
  for (const [a, b] of pairs) R[pkey(a, b)] = { w: 0, n: 0 };
  for (const part of parts) for (const { a, b, side, r } of part) {
    const x = R[pkey(a, b)]; x.n++; if (r.w === (side ? 1 : 0)) x.w++;
    for (const rd of r.rounds) { rounds++; len += rd.t; }
  }
  R.len = len / Math.max(1, rounds);
  return R;
}
const pOf = x => (x.w + 0.5) / (x.n + 1);
const lg = p => { const q = Math.max(0.02, Math.min(0.98, p)); return Math.log(q / (1 - q)); };
// таблица пар → доли против поля (поровну по девяти соперникам)
function fieldOf(R) {
  const F = {}; for (const c of C) F[c] = 0;
  for (const [a, b] of PAIRS) { const p = pOf(R[pkey(a, b)]); F[a] += p / 9; F[b] += (1 - p) / 9; }
  return F;
}
const wPair = l => (Math.abs(l) > 1.1 ? 2.5 : Math.abs(l) > 0.5 ? 1 : 0.35);
function resid(R) {
  const r = [], F = fieldOf(R);
  for (const [a, b] of PAIRS) { const l = lg(pOf(R[pkey(a, b)])); r.push(wPair(l) * l); }
  for (const c of C) { const l = 2 * lg(F[c]); r.push((Math.abs(F[c] - 0.5) > 0.05 ? 1.5 : 0.5) * l); }
  return r;
}
function stats(R) {
  let o4 = 0, o2 = 0, mx = 0;
  for (const [a, b] of PAIRS) { const d = Math.abs(pOf(R[pkey(a, b)]) - 0.5); if (d > 0.1) o4++; if (d > 0.3) o2++; mx = Math.max(mx, d); }
  const F = fieldOf(R), f = C.map(c => F[c]);
  return { o4, o2, mx: 50 + mx * 100, fieldOut: f.filter(v => v < 0.45 || v > 0.55).length, len: R.len, f, score: o4 + 3 * o2 + 2 * f.filter(v => v < 0.45 || v > 0.55).length + (R.len < 33 || R.len > 55 ? 6 : 0) };
}
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
const fmt = s => `вне 40–60: ${s.o4}, вне 20–80: ${s.o2}, макс ${s.mx.toFixed(0)}%, поле вне 45–55: ${s.fieldOut}, раунд ${s.len.toFixed(1)} с, счёт ${s.score}`;

async function main() {
  let x = K.map(() => 0), lam = 1, best = null;
  if (argv.includes('--resume') && fs.existsSync(OUT)) { const j = JSON.parse(fs.readFileSync(OUT, 'utf8')); if (j.x && j.x.length === K.length) { x = j.x; best = j; } }
  for (let it = 0; it < ITERS; it++) {
    const seed = 7000 + it * 13, t0 = Date.now();
    const R0 = await runPairs(overOf(x), PAIRS, N, seed), r0 = resid(R0);
    console.log(`шаг ${it}: ${fmt(stats(R0))}  (${((Date.now() - t0) / 1000).toFixed(0)} с)`);
    // якобиан: ручка двигает только пары своего класса; остальные невязки берём из базы
    const J = r0.map(() => new Float64Array(K.length));
    for (let k = 0; k < K.length; k++) {
      const xk = x.slice(), h = Math.min(hi[k], x[k] + H) - x[k] || -H; xk[k] = x[k] + h;
      const aff = PAIRS.filter(([a, b]) => a === K[k].cls || b === K[k].cls);
      const Rk = Object.assign({}, R0, await runPairs(overOf(xk), aff, N, seed));
      const rk = resid(Rk);
      for (let q = 0; q < r0.length; q++) J[q][k] = (rk[q] - r0[q]) / h;
    }
    // варианты шага; проверка на свежих сидах вместе с текущей точкой
    const fresh = 91000 + it * 31;
    const cur = stats(await runPairs(overOf(x), PAIRS, N, fresh));
    let pick = { s: cur, x, lam: 0 };
    for (const l of [lam / 3, lam, lam * 3]) {
      const dx = solve(J, r0, l), xn = clampX(x.map((v, i) => v + 0.8 * dx[i]));
      const s = stats(await runPairs(overOf(xn), PAIRS, N, fresh));
      console.log(`  λ ${l.toFixed(2)}: ${fmt(s)}`);
      if (s.score < pick.s.score) pick = { s, x: xn, lam: l };
    }
    console.log(`  текущая точка на свежих сидах: ${fmt(cur)}`);
    if (pick.lam) { x = pick.x; lam = pick.lam; } else lam *= 4;
    if (!best || pick.s.score < best.score) { best = { score: pick.s.score, x: pick.x, stats: pick.s, over: overOf(pick.x) }; fs.writeFileSync(OUT, JSON.stringify(Object.assign({ knobs: K.map(k => k.n) }, best), null, 1)); }
  }
  console.log('ЛУЧШЕЕ', JSON.stringify(best.stats), JSON.stringify(best.over));
}
main();
