'use strict';
// Безголовый хозяин симуляции: загружает те же файлы js/, что и браузер, в vm-контекст
// с заглушками DOM/canvas. Рисования нет — только мир, жители, здания, герои.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
// порядок как в index.html; интерфейс, звук, отрисовка и меню не нужны
const FILES = ['config', 'world', 'path', 'entities', 'levels', 'events', 'jobs', 'life', 'animals', 'leisure', 'streets',
  'night', 'rocks', 'nechist', 'ghosts', 'skeletons', 'mountains', 'logistics', 'sprites', 'buildings', 'bmodels', 'graveyard',
  'decor', 'subbotnik', 'pixel', 'pixelart', 'fire', 'icons', 'people', 'creatures', 'terrain', 'render', 'save', 'ui',
  'music', 'sfx', 'weather', 'sfx2', 'stress', 'mobile', 'stats', 'tutorial', 'layout', 'main', 'hero', 'herolife', 'flask', 'herochain', 'golem', 'pets', 'coopsim'];

// Универсальная заглушка: любое свойство — снова заглушка, вызов — заглушка
function stub() {
  const f = function () { return p; };
  const p = new Proxy(f, {
    get(_, k) {
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === 'length') return 0;
      if (k === 'then') return undefined;
      return p;
    },
    set() { return true; },
    apply() { return p; },
    construct() { return p; },
  });
  return p;
}

function createHost(log = console.log) {
  const S = stub();
  const store = new Map();
  const sandbox = {
    console, Math, Date, JSON, Object, Array, Map, Set, WeakMap, Number, String, Boolean, Symbol, Error, RegExp, Promise,
    Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array, Float32Array, Float64Array, ArrayBuffer,
    parseInt, parseFloat, isFinite, isNaN, setTimeout, clearTimeout, setInterval, clearInterval,
    performance: { now: () => Date.now() },
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    document: S, window: null, navigator: { userAgent: 'node', maxTouchPoints: 0 }, location: { search: '', hash: '', href: '' },
    Image: S, Audio: S, AudioContext: S, requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
    OffscreenCanvas: S, HTMLElement: function () {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
    devicePixelRatio: 1, innerWidth: 1280, innerHeight: 720,
    addEventListener() {}, removeEventListener() {}, confirm: () => true, alert() {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of FILES) {
    const file = path.join(ROOT, 'js', f + '.js');
    try { vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file }); }
    catch (e) { log('загрузка ' + f + ': ' + (e && e.message)); throw e; }
  }
  const run = code => vm.runInContext(code, ctx);
  run('R.canvas = { clientWidth: 1280, clientHeight: 720 }; R.cam = R.cam || { x: 0, y: 0, z: 2 }; renderBuildMenu = function () {}; updateUI = function () {}; updateMinimapBase = function () {}; buildTerrain = function () {};');
  return { ctx, run };
}

module.exports = { createHost, FILES };
if (require.main === module) {
  const h = createHost();
  console.log('загружено');
  try {
    h.run('R.canvas = { clientWidth: 1280, clientHeight: 720 }; R.cam = R.cam || { x: 0, y: 0, z: 2 }; setupStart(12345)');
    console.log('setupStart ok, units', h.run('Game.units.length'), 'buildings', h.run('Game.buildings.length'));
    const t0 = Date.now();
    h.run('for (let i = 0; i < 600; i++) step(SIM_DT)');
    console.log('600 шагов за', Date.now() - t0, 'мс; время', h.run('Game.time'));
  } catch (e) { console.log('ошибка', e.stack); }
}
