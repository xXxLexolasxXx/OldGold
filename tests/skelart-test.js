'use strict';
// Скелеты в пиксель-арте (js/world/skelart.js): кадры покоя 6, ходьбы 8, атаки 9, удара 4, смерти 9, захвата 9+4;
// три вида (юг, восток, север); все кадры рисуются без исключений и действительно различаются; выбор кадра по состоянию
// скелета не выходит за границы ни в одном состоянии (рост, бой, удар, испуг, смерть, захват, уход в землю);
// кэш не растёт сверх числа кадров; внешность — ключ из дома скелета и переживает сейв (дом хранится с точностью до десятой).
// Рисования в node нет: холст — запись вызовов (по ней видно, что кадр что-то нарисовал и что кадры разные).
// Запуск: node tests/skelart-test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const fails = [];
const check = (ok, msg) => { if (!ok && fails.length < 40) fails.push(msg); };

let TR = [];                                   // след вызовов холста
const num = v => typeof v === 'number' ? Math.round(v * 100) / 100 : typeof v === 'string' ? v : '';
function makeCtx(cv) {
  const target = {
    canvas: cv,
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    createLinearGradient: () => ({ addColorStop: (o, c) => { TR.push('stop' + o + c); } }), createRadialGradient: () => ({ addColorStop: (o, c) => { TR.push('stop' + o + c); } }),
  };
  return new Proxy(target, {
    get(t, k) { if (k in t) return t[k]; return (...a) => { TR.push(String(k) + a.map(num).join(',')); }; },
    set(t, k, v) { TR.push(String(k) + '=' + num(v)); t[k] = v; return true; },
  });
}
function makeCanvas(w, h) { const cv = { width: w, height: h }; cv.getContext = () => cv._c || (cv._c = makeCtx(cv)); return cv; }

const ctx = {
  console, Math, Object, Array, String, Set, Map, JSON, Proxy, RegExp, Number, Date, performance: { now: () => 0 },
  document: { createElement: () => makeCanvas(1, 1), addEventListener() {}, getElementById: () => null },
  window: {}, Game: { time: 0, skels: [] }, R: {}, nightDiff: () => 1,
  mulberry32: a => () => ((a = (a * 16807) % 2147483647) / 2147483647),
  drawGrabbed() {}, drawGrip() {}, snapVictim() {}, grabIdx: () => 0,
};
vm.createContext(ctx);
const load = f => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
for (const f of ['config.js', 'sprites.js', 'pixel.js', 'world/grab.js', 'world/skeletons.js', 'world/skelart.js']) load(f);
vm.runInContext('document.createElement = (n) => __mk(1, 1);', Object.assign(ctx, { __mk: makeCanvas }));
// mkCanvas из sprites.js создаёт холсты через document.createElement — подменяем на запись
ctx.document.createElement = () => makeCanvas(1, 1);
vm.runInContext('mkCanvas = (w, h) => __mk(w, h);', ctx);
const run = code => vm.runInContext(code, ctx);

const COUNT = { idle: 6, walk: 8, atk: 9, hit: 4, die: 9, grab: 13 };
const SKA = run('SKA');
for (const [k, n] of Object.entries(COUNT)) check(SKA.FR[k] === n, `кадров «${k}» должно быть ${n}, а не ${SKA.FR[k]}`);

// ---- 1. каждый кадр каждого вида и облика рисуется, непустой и отличается от соседей
const mkSk = look => { for (let a = 0; a < 60; a++) { const s = { hx: a * 0.5, hy: 3.5 }; if (run(`skelLook(${JSON.stringify(s)})`) === look) return s; } return null; };
ctx.__sprite = (s, view, pose, frame) => { TR = []; ctx.__s = s; const e = run(`skelSprite(__s, ${JSON.stringify(view)}, ${JSON.stringify(pose)}, ${frame})`); return { e, trace: TR.join('|') }; };
let made = 0, expected = 0;
for (let look = 0; look < 4; look++) {
  const sk = mkSk(look);
  check(!!sk, `нет дома с обликом ${look}`);
  if (!sk) continue;
  for (const view of ['S', 'E', 'N']) for (const pose of ['idle', 'walk']) {
    const seen = new Set();
    for (let i = 0; i < COUNT[pose]; i++) {
      const { e, trace } = ctx.__sprite({ ...sk }, view, pose, i);
      made++; expected++;
      check(e && e.cv && e.cv.width === SKA.W * SKA.PART && e.cv.height === SKA.H * SKA.PART, `${pose} ${view} #${i}: размер кадра не ${SKA.W * SKA.PART}×${SKA.H * SKA.PART}`);
      check(trace.length > 500, `${pose} ${view} #${i} облик ${look}: кадр почти пуст`);
      seen.add(trace);
    }
    check(seen.size === COUNT[pose], `${pose} ${view} облик ${look}: ${seen.size} разных кадров из ${COUNT[pose]}`);
  }
  for (const pose of ['atk', 'hit', 'die', 'grab']) {
    const seen = new Set();
    for (let i = 0; i < COUNT[pose]; i++) {
      const { e, trace } = ctx.__sprite({ ...sk }, 'E', pose, i);
      made++; expected++;
      check(e && e.cv, `${pose} #${i}: кадра нет`);
      check(trace.length > 300, `${pose} #${i}: кадр почти пуст`);
      seen.add(trace);
    }
    check(seen.size === COUNT[pose], `${pose}: ${seen.size} разных кадров из ${COUNT[pose]}`);
  }
}
check(run('SKA_CACHE.size') === expected, `кэш: ${run('SKA_CACHE.size')} спрайтов вместо ${expected}`);
// повторный запрос — из кэша, без рисования
{ TR = []; const sk = mkSk(0); ctx.__s = { ...sk }; const a = run('skelSprite(__s, "S", "idle", 2)'); const n = TR.length; const b = run('skelSprite(__s, "S", "idle", 2)'); check(a === b && TR.length === n, 'повторный кадр берётся не из кэша'); }
// разные облики дают разные кадры (колпак, щит)
{ run('SKA_CACHE.clear()'); const a = ctx.__sprite(mkSk(0), 'S', 'idle', 0).trace, b = ctx.__sprite(mkSk(1), 'S', 'idle', 0).trace, c3 = ctx.__sprite(mkSk(2), 'S', 'idle', 0).trace; check(a !== b && a !== c3, 'облики скелетов не различаются'); }

// ---- 2. выбор кадра по состоянию — всегда в границах
const POSES = Object.keys(COUNT), VIEWS = new Set(['S', 'E', 'N']);
let probes = 0;
const states = [];
const base = { x: 5.5, y: 5.5, hx: 5.5, hy: 5.5, face: 1, phase: 0, k: 1, state: 'roam', t: 0, moving: false, atk: -9, scared: 0, fighters: [], hitT: -9 };
for (const state of ['rise', 'roam', 'fight', 'dead', 'sink', 'grab']) for (const moving of [false, true]) for (const scared of [0, 3]) for (const phase of [0, 1.7, 99.9, -5, 1e6]) for (const t of [0, 0.3, 0.8, 1.2, 2.2, 3, 5, 100]) states.push({ ...base, state, moving, scared, phase, t, vsnap: state === 'grab' || state === 'sink' ? {} : undefined });
for (const T of [0, 0.15, 3.3, 77.77, 1234.5]) for (const s of states) for (const sh of [-9, T - 0.05, T - 0.3, T - 0.5]) for (const at of [-9, T - 0.1, T - 0.4, T - 0.8, T + 0.1]) {
  ctx.__st = { ...s, hitT: sh, atk: at }; ctx.Game.time = T; ctx.__v = ['S', 'E', 'N'][probes % 3];
  const r = run('skelFrameOf(__st, __v)');
  probes++;
  const [pose, frame, view] = r;
  check(POSES.includes(pose) && Number.isInteger(frame) && frame >= 0 && frame < COUNT[pose] && VIEWS.has(view), `выбор кадра: ${JSON.stringify(r)} в состоянии ${s.state} t=${s.t} моving=${s.moving} T=${T}`);
}
check(probes > 5000, 'мало проб выбора кадра');
// ключевые соответствия
ctx.Game.time = 100;
const fr = o => { ctx.__st = { ...base, ...o }; ctx.__v = 'S'; return run('skelFrameOf(__st, __v)'); };
check(fr({}).join() === 'idle,' + fr({})[1] + ',S', 'покой стоит видом на нас');
check(fr({ moving: true, phase: 1 })[0] === 'walk', 'идущий скелет — кадры ходьбы');
check(fr({ state: 'dead', t: 0.01 })[0] === 'die' && fr({ state: 'dead', t: 0.01 })[1] === 0 && fr({ state: 'dead', t: 3 })[1] === 8, 'смерть: от первого кадра к последнему');
check(fr({ state: 'fight', atk: 99.9 })[0] === 'atk' && fr({ state: 'fight', atk: 99.9 })[2] === 'E', 'в бою — кадры атаки сбоку');
check(fr({ state: 'fight', hitT: 99.95, atk: 100.1 })[0] === 'hit', 'удар по скелету — кадры «удар»');
check(fr({ state: 'grab', t: 0.2, vsnap: {} })[0] === 'grab', 'похищение — кадры захвата');

// ---- 3. рисование на холсте мира не падает ни в одном состоянии
ctx.__c = makeCtx(makeCanvas(10, 10)); ctx.TILE = 32;
let drawn = 0;
for (const s of states.slice(0, 600)) {
  ctx.__st = { ...s, hitT: -9, atk: -9, s: 0 }; ctx.Game.time = 12.3 + drawn * 0.37;
  try { run('skelDraw(__c, __st)'); drawn++; } catch (e) { check(false, `skelDraw упал (${s.state}, t=${s.t}): ${e.message}`); break; }
}
check(drawn === Math.min(600, states.length), 'не все состояния нарисовались');
// ---- 3б. drawSkeleton без skelDraw остаётся рабочим (старое рисование не ломается)
ctx.__st = { ...base, hitT: -9 };
try { run('drawSkeleton(__c, __st)'); } catch (e) { check(false, 'drawSkeleton упал: ' + e.message); }

// ---- 4. внешность — ключ из дома: не зависит от движения, не меняется от десятых после сейва
for (let i = 0; i < 300; i++) {
  const hx = Math.floor(Math.random() * 120) + 0.5, hy = Math.floor(Math.random() * 120) + 0.5;
  const saved = [+hx.toFixed(1), +hy.toFixed(1)];            // как в save.js
  ctx.__a = { hx, hy, x: 1, y: 2 }; ctx.__b = { hx: saved[0], hy: saved[1], x: 9, y: 9, state: 'sink' };
  check(run('skelLook(__a)') === run('skelLook(__b)') && run('skelLook(__a)') >= 0 && run('skelLook(__a)') <= 3, `облик ${hx},${hy} меняется после сейва`);
}
// уходящий в землю и растущий скелет рисуется срезом по k — кадр тот же, кэш не раздувается
const before = run('SKA_CACHE.size');
for (const k of [0.1, 0.5, 0.99]) { ctx.__st = { ...base, k, state: 'rise' }; ctx.Game.time = 50; run('skelDraw(__c, __st)'); }
check(run('SKA_CACHE.size') - before <= 1, 'рост из земли плодит новые кадры');

if (fails.length) { for (const f of fails) console.log('✗ ' + f); process.exit(1); }
console.log(`Скелеты в пиксель-арте: ${made} кадров (покой 6, ходьба 8 ×3 вида; атака 9, удар 4, смерть 9, захват 13) × 4 облика, ${probes} проб выбора кадра, рисование без падений`);
