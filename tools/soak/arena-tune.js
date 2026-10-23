'use strict';
// Подбор чисел ARENA_TUNE по матрице ботов (АРЕНА.md, 7.4) — стохастический спуск SPSA: на каждом шаге все
// параметры сдвигаются случайно в обе стороны, по разнице двух прогонов матрицы (на одних и тех же сидах)
// делается шаг. Параметры — множители здоровья и урона и скорость каждого класса плюс несколько «ручек» механики.
// Цель — пары 40–60%, класс против поля 45–55%, раунд 35–55 с, по таймеру < 25%.
//   node tools/soak/arena-tune.js --iters 120 --n 30 --out tune.json
// Итог — JSON правок для ARENA_TUNE (лучший найденный), его переносят в arenasim.js руками.
const fs = require('fs');
const path = require('path');
const { runMatrix, report } = require('./arena.js');
const A = require('../../js/arena/arenasim.js');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const ITERS = +arg('iters', 120), N = +arg('n', 30), OUT = arg('out', path.join(__dirname, 'arena-tune.json'));
const CLS = A.ARENA_CLS, B = A.ARENA_TUNE;

// параметры: [имя, как применить к правкам, нижняя и верхняя граница множителя]
const P = [];
for (const c of CLS) {
  P.push({ n: c + '.hp', lo: 0.6, hi: 1.6, set: (o, m) => { (o.cls[c] = o.cls[c] || {}).hp = Math.round(B.cls[c].hp * m); } });
  P.push({ n: c + '.dmg', lo: 0.6, hi: 1.6, set: (o, m) => { (o.cls[c] = o.cls[c] || {}).dmg = +(B.cls[c].dmg * m).toFixed(2); } });
  P.push({ n: c + '.mv', lo: 0.9, hi: 1.1, set: (o, m) => { (o.cls[c] = o.cls[c] || {}).mv = +(B.cls[c].mv * m).toFixed(3); } });
}
const knob = (n, k, f, lo, hi) => P.push({ n, lo, hi, set: (o, m) => { const a = (o.ab[k] = o.ab[k] || {}); a[f] = +(B.ab[k][f] * m).toFixed(3); } });
knob('heal.heal', 'heal', 'heal', 0.6, 1.3);
knob('hands.heal', 'hands', 'heal', 0.6, 1.3);
knob('mend.heal', 'mend', 'heal', 0.6, 1.3);
knob('thorns.root', 'thorns', 'root', 0.5, 1.25);
knob('grow.slow', 'grow', 'slow', 0.5, 1.2);
knob('wall.dur', 'wall', 'dur', 0.6, 1.3);

function overOf(th) {
  const o = { cls: {}, ab: {} };
  P.forEach((p, i) => p.set(o, Math.exp(th[i])));
  return o;
}
function lossOf(R) {
  const rep = report(R);
  let L = 0, np = 0;
  for (let i = 0; i < CLS.length; i++) for (let j = i + 1; j < CLS.length; j++) {
    const m = R.M[CLS[i]][CLS[j]], p = m.w / m.n, d = Math.abs(p - 0.5);
    L += Math.max(0, d - 0.06) ** 2 + 0.15 * d * d; np++;
  }
  L /= np;
  for (const f of rep.field) L += 3 * Math.max(0, Math.abs(f / 100 - 0.5) - 0.02) ** 2 / CLS.length;
  if (R.avgLen < 38) L += 0.05 * ((38 - R.avgLen) / 10) ** 2;
  if (R.avgLen > 52) L += 0.05 * ((R.avgLen - 52) / 10) ** 2;
  if (R.timerShare > 0.2) L += (R.timerShare - 0.2) ** 2;
  return { L, rep, R };
}
const lo = P.map(p => Math.log(p.lo)), hi = P.map(p => Math.log(p.hi));
const clampTh = th => th.map((v, i) => Math.max(lo[i], Math.min(hi[i], v)));

async function main() {
  let th = P.map(() => 0);
  if (fs.existsSync(OUT) && argv.includes('--resume')) { const j = JSON.parse(fs.readFileSync(OUT, 'utf8')); if (j.th && j.th.length === P.length) th = j.th; }
  let best = null, gAvg = 0;
  // равномерный «случайный» знак по номеру шага: прогон повторяем
  let rs = 12345;
  const rnd = () => { rs = (rs * 1103515245 + 12345) >>> 0; return rs / 4294967296; };
  for (let k = 0; k < ITERS; k++) {
    const a = 0.05 / Math.pow(1 + k / 30, 0.602), c = 0.07 / Math.pow(1 + k / 30, 0.101);
    const D = P.map(() => (rnd() < 0.5 ? -1 : 1));
    const seed = 1000 + k;
    const [rp, rm] = await Promise.all([
      runMatrix({ n: N, tier: 3, seed, over: overOf(clampTh(th.map((v, i) => v + c * D[i]))), threads: 8 }),
      runMatrix({ n: N, tier: 3, seed, over: overOf(clampTh(th.map((v, i) => v - c * D[i]))), threads: 8 }),
    ]);
    const lp = lossOf(rp), lm = lossOf(rm), dl = lp.L - lm.L;
    gAvg = gAvg ? 0.9 * gAvg + 0.1 * Math.abs(dl) : Math.abs(dl);
    const g = Math.max(-2, Math.min(2, dl / (gAvg || 1e-9)));
    th = clampTh(th.map((v, i) => v - a * g * D[i]));
    const Lmid = (lp.L + lm.L) / 2;
    const lenS = ((lp.R.avgLen + lm.R.avgLen) / 2).toFixed(1), bad = (lp.rep.bad.length + lm.rep.bad.length) / 2;
    console.log(`шаг ${k}: потеря ${Lmid.toFixed(4)} (± ${dl.toFixed(4)}), пар вне 40–60%: ${bad}, раунд ${lenS} с, поле: ${CLS.map((cc, i) => cc.slice(0, 4) + Math.round((lp.rep.field[i] + lm.rep.field[i]) / 2)).join(' ')}`);
    // раз в 10 шагов — честная проверка текущей точки на свежих сидах
    if (k % 10 === 9 || k === ITERS - 1) {
      const R = await runMatrix({ n: N * 2, tier: 3, seed: 777777 + k, over: overOf(th), threads: 16 });
      const e = lossOf(R);
      console.log(`  проверка: потеря ${e.L.toFixed(4)}, пар вне 40–60%: ${e.rep.bad.length}, раунд ${R.avgLen.toFixed(1)} с, таймер ${(R.timerShare * 100).toFixed(0)}%${e.rep.ok ? ', В ДОПУСКЕ' : ''}`);
      if (!best || e.L < best.L) best = { L: e.L, th: th.slice(), bad: e.rep.bad.length, over: overOf(th) };
      fs.writeFileSync(OUT, JSON.stringify({ th, best, params: P.map(p => p.n) }, null, 1));
    }
  }
  console.log('лучшее:', best && best.L.toFixed(4), JSON.stringify(best && best.over));
}
main();
