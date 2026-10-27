'use strict';
// Безголовый прогон игры с инвариантами и ботом-игроком (тот же код, что в браузере и на кооп-сервере — через server/simhost.js).
//   node tools/soak/run.js --seed 1 --secs 10800 --rt 900     (--rt N — сейв→загрузка→сравнение каждые N игровых секунд, 0 — выкл; --quiet 1)
// Печатает: время шага, ошибки шага, застрявших жителей, зависшую бронь, утечки occ, NaN/отрицательные остатки, рост коллекций,
// отличия сейва после загрузки; подробности — tools/soak/out-<seed>.json. Инварианты и бот — harness.js.
// Оговорка: simhost грузит coop/coopsim.js, поэтому герой здесь не возрождается (семантика сервера).
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..', '..');
const { createHost } = require(path.join(ROOT, 'server/simhost.js'));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SEED = +arg('seed', 1), SECS = +arg('secs', 3600), RT = +arg('rt', 900), ACT = +arg('act', 6), QUIET = arg('quiet', '0') === '1';
const logs = [];
const log = (...a) => { const s = a.join(' '); logs.push(s); if (!QUIET) console.log(s); };
const h = createHost(() => {});
h.run(fs.readFileSync(path.join(__dirname, 'harness.js'), 'utf8'));
h.ctx.H.init(SEED);
const SIM_DT = h.run('SIM_DT');
const steps = Math.round(SECS / SIM_DT);
let errs = 0, lastErr = '', errSamples = new Map();
const t0 = Date.now();
let actT = 0, chkT = 0, rtT = 0, slow = 0, stepMsMax = 0, stepMsSum = 0;
const hist = [];
const ctx = h.ctx; const G = h.run("({ get Game(){return Game}, step: s => step(s), nightAmt: () => nightAmt(), isNightNow: () => isNightNow(), isEveningNow: () => isEveningNow() })");
for (let i = 0; i < steps; i++) {
  const s0 = process.hrtime.bigint();
  try { G.step(SIM_DT); } catch (e) {
    errs++; const k = (e && e.stack || String(e)).split('\n').slice(0, 2).join(' | ');
    errSamples.set(k, (errSamples.get(k) || 0) + 1);
  }
  const ms = Number(process.hrtime.bigint() - s0) / 1e6;
  stepMsSum += ms; if (ms > stepMsMax) stepMsMax = ms; if (ms > 50) slow++;
  actT += SIM_DT; chkT += SIM_DT; rtT += SIM_DT;
  if (actT >= ACT) { actT = 0; try { ctx.H.act(); } catch (e) { ctx.H.report('act-throw', 'игрок-бот бросил: ' + (e.stack || e).split('\n').slice(0, 2).join(' | '), 'err'); } }
  if (chkT >= 10) { chkT = 0; const sz = ctx.H.check(); if (Math.round(G.Game.time) % 600 < 10 && (!hist.length || hist[hist.length-1].t !== Math.round(G.Game.time))) hist.push({ t: Math.round(G.Game.time), units: G.Game.units.length, bld: G.Game.buildings.length, rss: Math.round(process.memoryUsage().rss / 1048576), heap: Math.round(process.memoryUsage().heapUsed / 1048576), ms: +(stepMsSum / (i + 1)).toFixed(2), night: +G.nightAmt().toFixed(2), ...sz }); }
  if (RT && rtT >= RT) { rtT = 0; const r = ctx.H.roundTrip('t' + Math.round(G.Game.time) + (G.isNightNow() ? 'N' : G.isEveningNow() ? 'E' : 'D')); if (r) log(`[rt] t=${Math.round(G.Game.time)} ${r.bytes} байт, сериализация ${r.serMs} мс, загрузка ${r.loadMs} мс, отличий ${r.diffs}`); }
}
const wall = (Date.now() - t0) / 1000;
const issues = [...ctx.H.issues.values()].sort((a, b) => ({ crit: 0, err: 1, warn: 2 }[a.sev] - { crit: 0, err: 1, warn: 2 }[b.sev]) || b.n - a.n);
const res = {
  seed: SEED, secs: SECS, wall: +wall.toFixed(1), stepAvgMs: +(stepMsSum / steps).toFixed(3), stepMaxMs: +stepMsMax.toFixed(1), slowSteps: slow,
  stepErrors: errs, errSamples: [...errSamples.entries()].slice(0, 10), units: G.Game.units.length, maxUnits: ctx.H.maxUnits, buildings: G.Game.buildings.length, lost: G.Game.lostGnomes,
  stats: ctx.H.stats, hero: G.Game.hero && G.Game.hero.hero && G.Game.hero.hero.level, hist, issues,
};
fs.writeFileSync(path.join(__dirname, `out-${SEED}.json`), JSON.stringify(res, null, 1));
console.log(`seed ${SEED}: ${SECS}с игры за ${wall.toFixed(0)}с, шаг ${res.stepAvgMs} мс (max ${res.stepMaxMs}), ошибок шага ${errs}, жителей ${res.units} (max ${res.maxUnits}), зданий ${res.buildings}, потерь ${res.lost}, проблем ${issues.length}`);
for (const e of res.errSamples) console.log('  STEP-ERR x' + e[1] + ': ' + e[0]);
for (const is of issues) console.log(`  [${is.sev}] x${is.n} ${is.key}: ${is.text.slice(0, 400)}`);
process.exit(0);   // таймеры игры в песочнице иначе держат процесс часами после конца прогона
