'use strict';
// Подбор ARENA_TUNE покоординатным спуском (третий вариант: линейная модель arena-fit/arena-fit2 на арене не работает —
// бой ботов слишком нелинеен, шаг по якобиану ухудшает матрицу). Здесь каждая ручка двигается по одной и проверяется
// настоящими боями, но только в тех парах, где участвует её класс (остальные пары от неё не меняются — их берём из таблицы).
// Цель — штраф за выход пар из 40–60% (сильнее за 25–75% и 20–80%) и класса против поля из 45–55%.
// Каждый круг — новые сиды и полный пересчёт таблицы (чтобы не подгонять числа под удачные сиды).
//   node tools/soak/arena-cd.js --n 600 --thr 0.3 --sweeps 4 --threads 8 [--resume]   (thr — на сколько должен упасть штраф, чтобы ход приняли: выше шума)
// Итог — tools/soak/arena-cd.json: { over } — правки для ARENA_TUNE, переносятся в arenasim.js руками.
const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');
const A = require('../../js/arena/arenasim.js');
const ARENA_JS = path.join(__dirname, 'arena.js');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const THR = +arg('thr', 0.3), N = +arg('n', 600), SWEEPS = +arg('sweeps', 4), THREADS = +arg('threads', 8), OUT = arg('out', path.join(__dirname, 'arena-cd.json'));
const C = A.ARENA_CLS, B = JSON.parse(JSON.stringify(A.ARENA_TUNE));
const owner = {}; for (const c of C) for (const k of A.ARENA_KIT[c]) owner[k] = c;

const K = [];
const clsK = (c, f, lo, hi) => K.push({ n: `${c}.${f}`, cls: c, lo, hi, get: o => o.cls[c][f], put: (o, v) => { o.cls[c][f] = +v.toFixed(3); } });
const abK = (k, f, lo, hi) => K.push({ n: `${k}.${f}`, cls: owner[k], lo, hi, get: o => o.ab[k][f], put: (o, v) => { o.ab[k][f] = +v.toFixed(3); } });
for (const c of C) { clsK(c, 'hp', 0.75, 1.35); clsK(c, 'dmg', 0.75, 1.35); clsK(c, 'atkT', 0.85, 1.2); clsK(c, 'mv', 0.93, 1.07); }
clsK('druid', 'rng', 0.8, 1.3); clsK('archer', 'rng', 0.8, 1.1); clsK('mage', 'rng', 0.8, 1.15);
abK('consecrate', 'dot', 0.4, 1.8); abK('ult_paladin', 'dot', 0.4, 1.8); abK('heal', 'heal', 0.6, 1.4); abK('hands', 'heal', 0.6, 1.4); abK('mend', 'heal', 0.6, 1.4);
abK('sour', 'sil', 0.5, 1.6); abK('chord', 'stun', 0.6, 1.25); abK('thorns', 'root', 0.5, 1.6); abK('grow', 'slow', 0.5, 1.6);
abK('fire', 'mul', 0.7, 1.3); abK('fire', 'burn', 0.5, 1.4); abK('frost', 'ice', 0.6, 1.25); abK('ult_druid', 'root', 0.6, 1.4); abK('ult_bard', 'stun', 0.6, 1.25);
abK('palm', 'sil', 0.5, 1.3); clsK('mage', 'melee', 0.85, 1.2); clsK('archer', 'melee', 0.85, 1.2); abK('ult_druid', 'regen', 0.4, 1.3); abK('consecrate', 'regen', 0.4, 1.5); abK('windstep', 'dist', 0.6, 1.2); abK('chord', 'r', 0.75, 1.1); abK('bash', 'stun', 0.6, 1.2); abK('stomp', 'stun', 0.6, 1.2); abK('wild', 'dur', 0.6, 1.3); abK('ult_priest', 'heal', 0.6, 1.3);

// текущие значения (точка) и границы от исходных
let cur = JSON.parse(JSON.stringify({ cls: B.cls, ab: B.ab }));
const base = K.map(k => k.get(cur));
let step = K.map(() => 0.08);
const overOf = o => ({ cls: o.cls, ab: o.ab });

const PAIRS = []; for (let i = 0; i < C.length; i++) for (let j = i + 1; j < C.length; j++) PAIRS.push([C[i], C[j]]);
const pk = (a, b) => a + '|' + b;
async function runPairs(over, pairs, n, seed) {
  const jobs = [];
  pairs.forEach(([a, b]) => { const pi = PAIRS.findIndex(p => p[0] === a && p[1] === b); for (let k = 0; k < n; k++) jobs.push([a, b, (seed * 1000003 + pi * 104729 + k * 15485863) >>> 0, k & 1]); });
  const W = Math.max(1, Math.min(THREADS, jobs.length)), chunks = Array.from({ length: W }, () => []);
  jobs.forEach((j, i) => chunks[i % W].push(j));
  const parts = await Promise.all(chunks.map(c => new Promise((res, rej) => { const w = new Worker(ARENA_JS, { workerData: { jobs: c, tier: 3, over } }); w.on('message', res); w.on('error', rej); })));
  const R = {}; let rounds = 0, len = 0;
  for (const [a, b] of pairs) R[pk(a, b)] = { w: 0, n: 0 };
  for (const part of parts) for (const { a, b, side, r } of part) { const x = R[pk(a, b)]; x.n++; if (r.w === (side ? 1 : 0)) x.w++; for (const rd of r.rounds) { rounds++; len += rd.t; } }
  R.len = len / Math.max(1, rounds);
  return R;
}
const pOf = x => x.w / x.n;
function loss(P) {
  let L = 0; const F = {}; for (const c of C) F[c] = 0;
  for (const [a, b] of PAIRS) {
    const p = pOf(P[pk(a, b)]), d = Math.abs(p - 0.5);
    L += Math.max(0, d - 0.08) ** 2 * 10 + (d > 0.25 ? (d - 0.25) * 4 : 0) + (d > 0.3 ? 1 : 0);
    F[a] += p / 9; F[b] += (1 - p) / 9;
  }
  for (const c of C) L += Math.max(0, Math.abs(F[c] - 0.5) - 0.03) ** 2 * 60;
  return L;
}
function stats(P) {
  let o4 = 0, o2 = 0, mx = 0; const F = {}; for (const c of C) F[c] = 0;
  for (const [a, b] of PAIRS) { const p = pOf(P[pk(a, b)]), d = Math.abs(p - 0.5); if (d > 0.1) o4++; if (d > 0.3) o2++; mx = Math.max(mx, d); F[a] += p / 9; F[b] += (1 - p) / 9; }
  return `вне 40–60: ${o4}, вне 20–80: ${o2}, макс ${(50 + mx * 100).toFixed(0)}%, поле вне 45–55: ${C.filter(c => Math.abs(F[c] - 0.5) > 0.05).length} (${C.map(c => Math.round(F[c] * 100)).join('/')}), раунд ${P.len.toFixed(1)} с, штраф ${loss(P).toFixed(2)}`;
}
const save = (P) => fs.writeFileSync(OUT, JSON.stringify({ stats: stats(P), over: overOf(cur), step }, null, 1));

async function main() {
  if (argv.includes('--resume') && fs.existsSync(OUT)) { const j = JSON.parse(fs.readFileSync(OUT, 'utf8')); cur = j.over; if (j.step && j.step.length === K.length) step = j.step; }
  for (let sw = 0; sw < SWEEPS; sw++) {
    const seed = 3000 + sw * 101;
    let P = await runPairs(overOf(cur), PAIRS, N, seed);
    console.log(`круг ${sw}: ${stats(P)}`);
    // сначала ручки классов с самым большим вкладом в штраф
    const blame = {}; for (const c of C) blame[c] = 0;
    for (const [a, b] of PAIRS) { const d = Math.abs(pOf(P[pk(a, b)]) - 0.5); blame[a] += Math.max(0, d - 0.08); blame[b] += Math.max(0, d - 0.08); }
    const order = K.map((k, i) => i).sort((x, y) => blame[K[y].cls] - blame[K[x].cls]);
    let acc = 0;
    for (const i of order) {
      const k = K[i], L0 = loss(P), aff = PAIRS.filter(([a, b]) => a === k.cls || b === k.cls);
      let best = null;
      for (const dir of [1, -1]) {
        const v0 = k.get(cur), v = Math.max(base[i] * k.lo, Math.min(base[i] * k.hi, v0 * (1 + dir * step[i])));
        if (Math.abs(v - v0) < 1e-6) continue;
        const o = JSON.parse(JSON.stringify(cur)); k.put(o, v);
        const Rk = await runPairs(overOf(o), aff, N, seed), Pk = Object.assign({}, P, Rk, { len: P.len });
        const L = loss(Pk);
        if (L < L0 - THR && (!best || L < best.L)) best = { L, o, Pk };
        if (best && dir === 1) break;   // вверх помогло — вниз не пробуем
      }
      if (best) { cur = best.o; P = best.Pk; step[i] = Math.min(0.2, step[i] * 1.4); acc++; console.log(`  ${k.n} → ${k.get(cur)}  штраф ${loss(P).toFixed(2)}`); save(P); }
      else step[i] = Math.max(0.03, step[i] * 0.7);
    }
    console.log(`  принято ходов: ${acc}`);
    save(P);
  }
  const P = await runPairs(overOf(cur), PAIRS, N, 777);
  console.log('ПРОВЕРКА на свежих сидах:', stats(P));
  save(P);
}
main();
