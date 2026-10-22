'use strict';
// Замер скорости симуляции на большой деревне (безголово, тот же код, что в браузере и на кооп-сервере).
//   node tools/soak/bench.js [--seed 3] [--warm 900] [--secs 300] [--units 220] [--bld 130] [--prof 1]
// Сначала «разгон»: бот harness.js строит, склады пополняются, жителей добавляем до --units; затем замер --secs игровых
// секунд: среднее/95%/макс время шага и (с --prof 1) самые тяжёлые функции по собственному времени.
const path = require('path');
const fs = require('fs');
const inspector = require('inspector');
const ROOT = path.join(__dirname, '..', '..');
const { createHost } = require(path.join(ROOT, 'server/simhost.js'));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SEED = +arg('seed', 3), WARM = +arg('warm', 900), SECS = +arg('secs', 300), UNITS = +arg('units', 220), BLD = +arg('bld', 130), PROF = arg('prof', '1') === '1';

const h = createHost(() => {});
h.run(fs.readFileSync(path.join(__dirname, 'harness.js'), 'utf8'));
h.ctx.H.init(SEED);
const SIM_DT = h.run('SIM_DT');
const grow = h.run(`(function () {
  const PROFS = ['serf', 'serf', 'serf', 'builder', 'woodcutter', 'farmer', 'stonemason', 'carpenter', 'miller', 'baker'];
  let k = 0;
  return function () {
    for (const st of Game.buildings) if (st.isStore() && st.state === 'done') for (const g of GOOD_KEYS) if ((st.stock[g] || 0) < 60) st.stock[g] = 60;
    if (Game.buildings.length < ${BLD}) for (let i = 0; i < 3; i++) H.tryBuild();
    H.trainNeeded();
    const st = Game.buildings.find(b => b.type === 'storehouse');
    for (let i = 0; i < 6 && Game.units.length < ${UNITS} && st; i++) {
      const t = (typeof UNIT_TYPES !== 'undefined' && !UNIT_TYPES[PROFS[k % PROFS.length]]) ? 'serf' : PROFS[k % PROFS.length]; k++;
      const s = randomFreeNear(st.doorX, st.doorY + 1, 1, 8); if (s) spawnUnit(t, s[0], s[1]);
    }
  };
})()`);
const G = h.run('({ get Game(){return Game}, step: s => step(s) })');

let actT = 0;
const warmSteps = Math.round(WARM / SIM_DT);
for (let i = 0; i < warmSteps; i++) {
  try { G.step(SIM_DT); } catch (e) { /* ошибки шага ловит soak, здесь только скорость */ }
  if ((actT += SIM_DT) >= 3) { actT = 0; try { grow(); } catch (e) { /* бот иногда промахивается */ } }
}
// --split 1: обёртки-таймеры на тики подсистем (время включительное) и на update жителей/зданий; шаги > 40 мс
// раскладываются по подсистемам — видно, кто даёт рывки
const SPLIT = arg('split', '0') === '1';
if (SPLIT) h.run(`(function () {
  const T = globalThis.__T = { tot: {}, cur: {}, max: {}, spikes: {} };
  const wrap = (name, get, set) => {
    const f = get(); if (typeof f !== 'function') return;
    set(function () { const s = performance.now(); try { return f.apply(this, arguments); } finally { const d = performance.now() - s; T.cur[name] = (T.cur[name] || 0) + d; } });
  };
  const names = Object.getOwnPropertyNames(globalThis).filter(n => /Tick$|^update[A-Z]|^checkCollisions$|^dispatchAll$|^sfxTick$/.test(n) && typeof globalThis[n] === 'function');
  for (const n of names) wrap(n, () => globalThis[n], v => { globalThis[n] = v; });
  wrap('Unit.update', () => Unit.prototype.update, v => { Unit.prototype.update = v; });
  wrap('Building.update', () => Building.prototype.update, v => { Building.prototype.update = v; });
  T.end = function (ms) {
    for (const k in T.cur) { T.tot[k] = (T.tot[k] || 0) + T.cur[k]; if (T.cur[k] > (T.max[k] || 0)) T.max[k] = T.cur[k]; }
    if (ms > 40) { let bk = '', bv = 0; for (const k in T.cur) if (k !== 'Unit.update' && T.cur[k] > bv) { bv = T.cur[k]; bk = k; } if (T.cur['Unit.update'] > bv * 2) bk = 'Unit.update'; T.spikes[bk] = (T.spikes[bk] || 0) + 1; }
    T.cur = {};
  };
})()`);
const sess = new inspector.Session(); sess.connect();
// время сборщика мусора за замер (рывки шага часто от него)
const { PerformanceObserver } = require('perf_hooks');
let gcMs = 0, gcN = 0;
new PerformanceObserver(l => { for (const e of l.getEntries()) { gcMs += e.duration; gcN++; } }).observe({ entryTypes: ['gc'] });
const post = (m, p) => new Promise((res, rej) => sess.post(m, p || {}, (e, r) => e ? rej(e) : res(r)));
(async () => {
  if (PROF) { await post('Profiler.enable'); await post('Profiler.setSamplingInterval', { interval: 200 }); await post('Profiler.start'); }
  const n = Math.round(SECS / SIM_DT), ms = new Float64Array(n);
  const u0 = G.Game.units.length, b0 = G.Game.buildings.length;
  await new Promise(r => setTimeout(r, 50)); gcMs = 0; gcN = 0;
  for (let i = 0; i < n; i++) {
    const s0 = process.hrtime.bigint();
    try { G.step(SIM_DT); } catch (e) { /* см. выше */ }
    ms[i] = Number(process.hrtime.bigint() - s0) / 1e6;
    if (SPLIT) h.ctx.__T.end(ms[i]);
    if ((actT += SIM_DT) >= 3) { actT = 0; try { grow(); } catch (e) { /* */ } }
  }
  await new Promise(r => setTimeout(r, 50));
  const sorted = Array.from(ms).sort((a, b) => a - b), sum = sorted.reduce((a, b) => a + b, 0);
  console.log(`seed ${SEED}: жителей ${u0}→${G.Game.units.length}, зданий ${b0}→${G.Game.buildings.length}, шагов ${n}`);
  // отпечаток состояния: оптимизация не должна менять поведение — при том же зерне он обязан совпасть
  const fp = h.run(`(function () {
    let x = 0; const mix = v => { x = (Math.imul(x ^ (typeof v === 'number' ? Math.round(v * 1000) : String(v).split('').reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7)), 2654435761) + 1) | 0; };
    mix(Game.time); mix(Game.units.length); mix(Game.buildings.length); mix(Game.animals.length); mix(Game.piles.size);
    for (const u of Game.units) { mix(u.id); mix(u.type); mix(u.x); mix(u.y); mix(u.carry || ''); mix(u.food || 0); }
    for (const b of Game.buildings) { mix(b.id); mix(b.state); for (const g of GOOD_KEYS) mix(b.stock[g] || 0); }
    for (const a of Game.animals) { mix(a.kind); mix(a.x); mix(a.y); }
    return (x >>> 0).toString(16);
  })()`);
  console.log('отпечаток состояния: ' + fp);
  console.log(`сборка мусора: ${gcN} раз, ${(gcMs / n).toFixed(3)} мс/шаг`);
  console.log(`шаг: среднее ${(sum / n).toFixed(3)} мс, медиана ${sorted[n >> 1].toFixed(3)}, 95% ${sorted[Math.floor(n * 0.95)].toFixed(3)}, 99% ${sorted[Math.floor(n * 0.99)].toFixed(2)}, макс ${sorted[n - 1].toFixed(1)}`);
  if (SPLIT) {
    const T = h.ctx.__T;
    for (const [k, v] of Object.entries(T.tot).sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(`${(v / n).toFixed(3).padStart(7)} мс/шаг  макс ${T.max[k].toFixed(1).padStart(6)}  ${k}`);
    console.log('рывки > 40 мс по виновнику:', JSON.stringify(T.spikes));
  }
  if (!PROF) process.exit(0);
  const { profile } = await post('Profiler.stop');
  const self = new Map(), dt = new Map();
  for (let i = 0; i < profile.samples.length; i++) dt.set(profile.samples[i], (dt.get(profile.samples[i]) || 0) + profile.timeDeltas[i]);
  let tot = 0;
  for (const nd of profile.nodes) {
    const t = dt.get(nd.id) || 0; tot += t;
    const cf = nd.callFrame, k = `${cf.functionName || '(anon)'} ${path.basename(cf.url || '')}:${cf.lineNumber + 1}`;
    self.set(k, (self.get(k) || 0) + t);
  }
  const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, +arg('top', 30));
  for (const [k, t] of top) console.log(`${(100 * t / tot).toFixed(1).padStart(5)}%  ${k}`);
  // включительное время: время узла и всех потомков, рекурсия одной функции считается один раз
  const byId = new Map(profile.nodes.map(nd => [nd.id, nd])), incl = new Map();
  const key = nd => `${nd.callFrame.functionName || '(anon)'} ${path.basename(nd.callFrame.url || '')}:${nd.callFrame.lineNumber + 1}`;
  const walk = (nd, onStack) => {
    let t = dt.get(nd.id) || 0;
    const k = key(nd), fresh = !onStack.has(k);
    if (fresh) onStack.add(k);
    for (const c of nd.children || []) t += walk(byId.get(c), onStack);
    if (fresh) { onStack.delete(k); incl.set(k, (incl.get(k) || 0) + t); }
    return t;
  };
  walk(profile.nodes[0], new Set());
  console.log('--- включительно ---');
  for (const [k, t] of [...incl.entries()].sort((a, b) => b[1] - a[1]).slice(0, +arg('itop', 60))) console.log(`${(100 * t / tot).toFixed(1).padStart(5)}%  ${k}`);
  process.exit(0);   // таймеры игры в vm держат процесс живым
})();
