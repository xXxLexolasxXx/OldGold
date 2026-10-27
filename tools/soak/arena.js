'use strict';
// Прогон баланса арены (АРЕНА.md, 7.4): матрица 10×10 классов × N боёв ботами одного уровня на разных сидах.
// Каждая пара играет поровну с обеих сторон площадки. Итог: доля побед строки над столбцом, класс против поля,
// средняя длина раунда, доля раундов по таймеру, доля «оглушён больше 30% раунда».
//   node tools/soak/arena.js                 — 10×10×200 чемпионами, отчёт в консоль
//   node tools/soak/arena.js --n 40          — быстрее (для правки ARENA_TUNE)
//   node tools/soak/arena.js --write         — записать таблицу в АРЕНА_БАЛАНС.md
//   node tools/soak/arena.js --tier 2 --seed 7
// Считает в нескольких потоках (worker_threads); один бой — около 2–4 тыс. тактов по 3 мкс.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const SIM = path.join(__dirname, '..', '..', 'js', 'arena', 'arenasim.js');

// один бой → короткая сводка (для потока и для tests/arena-test.js)
function playMatch(A, a, b, seed, tier) {
  const S = A.arenaNew({ seed, cls: [a, b], bots: [tier, tier] });
  while (S.phase !== 'over' && S.tick < 40000) A.arenaStep(S, null);
  const rounds = S.rw.map(r => ({ w: r.w, t: r.t, why: r.why }));
  const st = S.f.map(F => ({ dmg: F.sm.dmg, heal: F.sm.heal, stunT: F.sm.stunT, perfect: F.sm.perfect, casts: F.sm.casts, ults: F.sm.ults, hit: F.sm.hit, miss: F.sm.miss }));
  return { w: S.winner, rounds, st, ticks: S.tick };
}

// глубокое слияние правок таблицы (подбор баланса пробует числа, не трогая файл)
function tuneMerge(dst, src) { for (const k in src) { if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && dst[k] && typeof dst[k] === 'object') tuneMerge(dst[k], src[k]); else dst[k] = src[k]; } }

if (!isMainThread) {
  const A = require(SIM);
  if (workerData.over) tuneMerge(A.ARENA_TUNE, workerData.over);
  const out = [];
  for (const [a, b, seed, side] of workerData.jobs) {
    const r = side ? playMatch(A, b, a, seed, workerData.tier) : playMatch(A, a, b, seed, workerData.tier);
    out.push({ a, b, side, r });
  }
  parentPort.postMessage(out);
  return;
}

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };

// матрица: rows — класс строки против столбца; n — боёв на пару (поровну с каждой стороны)
async function runMatrix(opt) {
  const A = require(SIM);
  const cls = A.ARENA_CLS, n = opt.n, tier = opt.tier, seed0 = opt.seed;
  const jobs = [];
  for (let i = 0; i < cls.length; i++) for (let j = 0; j < cls.length; j++) {
    for (let k = 0; k < n; k++) jobs.push([cls[i], cls[j], (seed0 * 1000003 + i * 7919 + j * 104729 + k * 15485863) >>> 0, k & 1]);
  }
  const W = Math.max(1, Math.min(opt.threads || os.cpus().length, 16));
  const chunks = Array.from({ length: W }, () => []);
  jobs.forEach((j, i) => chunks[i % W].push(j));
  const parts = await Promise.all(chunks.map(c => new Promise((res, rej) => {
    const w = new Worker(__filename, { workerData: { jobs: c, tier, over: opt.over || null } });
    w.on('message', res); w.on('error', rej);
  })));
  const M = {}, F = {}, cs = {};
  for (const a of cls) { M[a] = {}; for (const b of cls) M[a][b] = { w: 0, n: 0 }; F[a] = { w: 0, n: 0 }; cs[a] = { dmg: 0, heal: 0, rounds: 0, stunHeavy: 0, fr: 0, perfect: 0 }; }
  let rounds = 0, len = 0, timer = 0, stunHeavy = 0, fr = 0;
  for (const part of parts) for (const { a, b, side, r } of part) {
    // side 1: a играл справа (боец 1)
    const ia = side ? 1 : 0, aw = r.w === ia;
    M[a][b].n++; if (aw) M[a][b].w++;
    if (a !== b) { F[a].n++; if (aw) F[a].w++; }
    for (const rd of r.rounds) {
      rounds++; len += rd.t; if (rd.why === 'time') timer++;
    }
    // оглушён больше 30% раунда: по сумме оглушений за матч на длину матча
    const tm = r.rounds.reduce((s, x) => s + x.t, 0) || 1;
    for (let q = 0; q < 2; q++) {
      fr++;
      const heavy = r.st[q].stunT / tm > 0.3;
      if (heavy) stunHeavy++;
      const c = q === ia ? a : b;
      if (q === ia) { cs[c].dmg += r.st[q].dmg; cs[c].heal += r.st[q].heal; cs[c].rounds += r.rounds.length; cs[c].perfect += r.st[q].perfect; if (heavy) cs[c].stunHeavy++; cs[c].fr++; }
    }
  }
  return { cls, M, F, cs, rounds, avgLen: len / rounds, timerShare: timer / rounds, stunShare: stunHeavy / fr, n, tier };
}

function report(R) {
  const pct = (w, n) => (n ? Math.round(100 * w / n) : 0);
  const short = { warrior: 'Воин', barbarian: 'Варв', archer: 'Лучн', rogue: 'Плут', mage: 'Маг', druid: 'Друид', priest: 'Жрец', paladin: 'Палад', bard: 'Бард', monk: 'Монах' };
  const lines = [];
  lines.push('| строка против столбца | ' + R.cls.map(c => short[c]).join(' | ') + ' | против поля |');
  lines.push('|---|' + R.cls.map(() => '---:').join('|') + '|---:|');
  // пара целиком — обе стороны площадки: строка против столбца плюс столбец против строки
  const bad = [], hard = [];
  R.cls.forEach((a, i) => R.cls.forEach((b, j) => {
    if (j <= i) return;
    const x = R.M[a][b], y = R.M[b][a], p = Math.round(100 * (x.w + y.n - y.w) / (x.n + y.n));
    if (p < 40 || p > 60) bad.push(`${short[a]}–${short[b]} ${p}%`);
    if (p < 20 || p > 80) hard.push(`${short[a]}–${short[b]} ${p}%`);
  }));
  for (const a of R.cls) {
    const row = R.cls.map(b => {
      const p = pct(R.M[a][b].w, R.M[a][b].n);
      return a === b ? '—' : (p < 40 || p > 60 ? `**${p}**` : String(p));
    });
    const f = pct(R.F[a].w, R.F[a].n);
    lines.push(`| ${short[a]} | ${row.join(' | ')} | ${f < 45 || f > 55 ? `**${f}**` : f} |`);
  }
  const field = R.cls.map(a => pct(R.F[a].w, R.F[a].n));
  // допуск для боя ботов (решение владельца 23.10): каждая пара 20–80%, класс против поля 45–55%; 40–60% — цель для живых боёв
  const ok = !hard.length && field.every(f => f >= 45 && f <= 55) && R.avgLen >= 35 && R.avgLen <= 55 && R.timerShare < 0.25 && R.stunShare < 0.05;
  return { table: lines.join('\n'), bad, hard, field, ok };
}

async function main() {
  const opt = { n: +arg('n', 200), tier: +arg('tier', 3), seed: +arg('seed', 1), threads: +arg('threads', 0) };
  const t0 = Date.now();
  const R = await runMatrix(opt);
  const rep = report(R);
  const sec = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(rep.table);
  console.log(`\nбоёв: ${R.cls.length * R.cls.length * R.n}, раундов: ${R.rounds}, средний раунд ${R.avgLen.toFixed(1)} с, по таймеру ${(R.timerShare * 100).toFixed(1)}%, оглушён >30% — ${(R.stunShare * 100).toFixed(1)}%, ${sec} с`);
  console.log('по классам (урон/лечение за раунд, идеальных увёртов за матч):');
  for (const c of R.cls) { const s = R.cs[c]; console.log(`  ${c.padEnd(10)} урон ${(s.dmg / s.rounds).toFixed(0).padStart(4)}  лечение ${(s.heal / s.rounds).toFixed(0).padStart(4)}  увёртов ${(s.perfect / s.fr).toFixed(2)}`); }
  console.log(rep.hard.length ? 'вне 20–80% (допуск): ' + rep.hard.join(', ') : 'все пары в 20–80% (допуск)');
  console.log(rep.bad.length ? `вне 40–60% (цель для живых боёв): ${rep.bad.length} — ${rep.bad.join(', ')}` : 'все пары в 40–60%');
  console.log(rep.ok ? 'В ДОПУСКЕ' : 'НЕ В ДОПУСКЕ');
  if (argv.includes('--write')) {
    const A = require(SIM);
    const file = path.join(__dirname, '..', '..', 'АРЕНА_БАЛАНС.md');
    const md = `# Баланс арены — матрица ботов\n\nСгенерировано \`node tools/soak/arena.js --write\` ${new Date().toISOString().slice(0, 10)}. Таблица \`ARENA_TUNE\` v${A.ARENA_TUNE.v}, протокол ${A.ARENA_PROTO}.\n` +
      `Боты: уровень ${R.tier} (${['', 'Соломенный', 'Ветеран', 'Чемпион'][R.tier]}), обе стороны; ${R.n} боёв на пару (поровну с каждой стороны площадки), всего ${R.cls.length * R.cls.length * R.n}, сиды от ${opt.seed}.\n\n` +
      `Допуск для боя ботов (решение владельца 23.10): каждая пара 20–80% (обе стороны площадки вместе), каждый класс против поля 45–55%, средний раунд 35–55 с, по таймеру < 25%, «оглушён > 30% времени» < 5%. Цель 40–60% по парам (АРЕНА.md, 7.4) проверяется по боям живых игроков.\n\n` +
      `## Доля побед строки над столбцом, %\n\n${rep.table}\n\n` +
      `## Итог\n\n- Средняя длина раунда: **${R.avgLen.toFixed(1)} с**\n- Раундов по таймеру: **${(R.timerShare * 100).toFixed(1)}%**\n- Бойцов, оглушённых больше 30% матча: **${(R.stunShare * 100).toFixed(1)}%**\n` +
      `- Пары вне 20–80% (допуск): ${rep.hard.length ? rep.hard.join(', ') : 'нет'}\n- Пары вне 40–60% (цель для живых боёв): ${rep.bad.length}${rep.bad.length ? ' — ' + rep.bad.join(', ') : ''}\n- Вердикт: **${rep.ok ? 'в допуске' : 'НЕ в допуске'}**\n\n` +
      `## По классам (за раунд)\n\n| класс | урон | лечение | идеальных увёртов за матч |\n|---|---:|---:|---:|\n` +
      R.cls.map(c => { const s = R.cs[c]; return `| ${c} | ${(s.dmg / s.rounds).toFixed(0)} | ${(s.heal / s.rounds).toFixed(0)} | ${(s.perfect / s.fr).toFixed(2)} |`; }).join('\n') + '\n';
    fs.writeFileSync(file, md);
    console.log('записано: АРЕНА_БАЛАНС.md');
  }
  process.exitCode = rep.ok ? 0 : 1;
}

module.exports = { playMatch, runMatrix, report, tuneMerge };
if (require.main === module) main();
