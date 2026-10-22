'use strict';
// Курганный князь в пиксель-арте (js/world/kurganart.js): все кадры логики босса (i0–i5, w0–w7, ready/step, windup/strike/recover,
// roar, hurt/stagger, d0–d5) в трёх фазах рисуются без исключений, непусты и различаются; кадр выше обычного скелета в 2,2+ раза;
// кэш не растёт сверх лимита; неизвестный кадр не роняет рисование; фаза берётся из Game.raid.f. Холст — запись вызовов.
// Запуск: node tests/kurganart-test.js
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
for (const f of ['config.js', 'sprites.js', 'pixel.js', 'world/kurganart.js']) load(f);
vm.runInContext('document.createElement = (n) => __mk(1, 1);', Object.assign(ctx, { __mk: makeCanvas }));
// mkCanvas из sprites.js создаёт холсты через document.createElement — подменяем на запись
ctx.document.createElement = () => makeCanvas(1, 1);
vm.runInContext('mkCanvas = (w, h) => __mk(w, h);', ctx);
const run = code => vm.runInContext(code, ctx);


const KP = run('KP');
const FRAMES = [];
for (let i = 0; i < 6; i++) FRAMES.push('i' + i);
for (let i = 0; i < 8; i++) FRAMES.push('w' + i);
for (let i = 0; i < 6; i++) FRAMES.push('d' + i);
for (let i = 0; i < 4; i++) FRAMES.push('v' + i);
FRAMES.push('ready', 'step', 'windup', 'strike', 'recover', 'roar', 'hurt', 'stagger');
check(KP.TOP / 45 >= 2.2, `князь не вдвое выше скелета: ${KP.TOP} px`);
ctx.__spr = (fr, ph) => { TR = []; ctx.__fr = fr; ctx.__ph = ph; const e = run('kpSprite(__fr, __ph)'); return { e, trace: TR.join('|') }; };
const sameByDesign = new Set(['ready|step', 'hurt|stagger']);   // эти пары кадров логики рисуются одинаково
for (const ph of [1, 2, 3]) {
  const seen = new Map();
  run('KP_CACHE.clear()');
  for (const fr of FRAMES.slice(0, 40)) {
    const { e, trace } = ctx.__spr(fr, ph);
    check(e && e.cv && e.cv.width === KP.W * KP.PART && e.cv.height === KP.H * KP.PART, `${fr} ф${ph}: размер кадра`);
    check(trace.length > 1500, `${fr} ф${ph}: кадр почти пуст (${trace.length})`);
    const prev = seen.get(trace);
    if (prev && !sameByDesign.has(prev + '|' + fr)) check(false, `кадры ${prev} и ${fr} (фаза ${ph}) совпали`);
    seen.set(trace, fr);
  }
  check(run('KP_CACHE.size') <= KP.MAX, 'кэш выше лимита');
}
// разные фазы — разный вид
{ run('KP_CACHE.clear()'); const a = ctx.__spr('i0', 1).trace, b = ctx.__spr('i0', 2).trace, c3 = ctx.__spr('i0', 3).trace; check(a !== b && b !== c3 && a !== c3, 'фазы I–III выглядят одинаково'); }
// лимит кэша
run('KP_CACHE.clear()');
for (const ph of [1, 2, 3]) for (const fr of FRAMES) { ctx.__spr(fr, ph); }
check(run('KP_CACHE.size') <= KP.MAX, `кэш ${run('KP_CACHE.size')} > ${KP.MAX}`);
// рисование в мире: все кадры, живой и умирающий, обе стороны, без боя и с боем (фаза из Game.raid.f)
ctx.__c = makeCtx(makeCanvas(10, 10)); ctx.TILE = 32;
let drawn = 0;
for (const fr of [...FRAMES, 'мусор', undefined, 'w9', 'i']) for (const face of [1, -1]) for (const st of ['idle', 'die']) for (const F of [null, { nid: 7, ph: 2 }, { nid: 7, ph: 3 }, { nid: 8, ph: 3 }]) {
  ctx.Game.raid = F ? { f: F } : null; ctx.__N = { id: 7, x: 5, y: 5, face, st, fr, dt: 1.2 }; ctx.Game.time = 3 + drawn * 0.1;
  try { run('kpDraw(__c, __N)'); drawn++; } catch (e) { check(false, `kpDraw упал (${fr}, ${st}): ${e.message}`); }
}
check(drawn > 200, 'мало нарисовано');
ctx.Game.raid = { f: { nid: 7, ph: 3 } };
check(run('kpPhaseOf({ id: 7 })') === 3 && run('kpPhaseOf({ id: 9 })') === 1, 'фаза берётся только у своего босса');
ctx.Game.raid = null;
check(run('kpPhaseOf({ id: 7 })') === 1, 'без боя — фаза I');
// полная смерть: пропадает (alpha 0) — кадр не рисуется
ctx.__N = { id: 7, x: 5, y: 5, face: 1, st: 'die', fr: 'd5', dt: 9 }; TR = []; run('kpDraw(__c, __N)'); check(TR.length === 0, 'исчезнувший князь всё ещё рисуется');

if (fails.length) { for (const f of fails) console.log('✗ ' + f); process.exit(1); }
console.log(`Курганный князь: ${FRAMES.length} кадров × 3 фазы рисуются без падений, различаются, кэш ≤ ${KP.MAX}, ${drawn} проб рисования`);
