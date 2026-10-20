'use strict';
// Безголовый хозяин симуляции: загружает те же файлы js/, что и браузер, в vm-контекст
// с заглушками DOM/canvas. Рисования нет — только мир, жители, здания, герои.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
// порядок как в index.html — список берём оттуда же, чтобы новые файлы игры не забывались
// (без них сервер падал на первом же вызове). Интерфейс меню, заставка, профиль и сетевой клиент не нужны.
const SKIP = new Set(['crashlog', 'loading', 'startmenu', 'perf', 'profile', 'coopclient', 'mapeditui', 'reveal']);
function gameFiles() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const list = [...html.matchAll(/<script[^>]*\ssrc="js\/((?:[\w-]+\/)?[\w-]+)\.js"/g)].map(m => m[1]).filter(f => !SKIP.has(f.split("/").pop()));
  return [...list, 'coop/coopsim'];
}
const FILES = gameFiles();

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

// opts.files — свой список файлов (тесты грузят клиент кооператива вместо серверного)
function createHost(log = console.log, opts = {}) {
  const S = stub();
  const store = new Map();
  const sandbox = {
    console, Math: Object.create(Math), Date,   // свой Math: тесты подменяют random, не задевая соседние песочницы
    JSON, Object, Array, Map, Set, WeakMap, Number, String, Boolean, Symbol, Error, RegExp, Promise,
    Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array, Float32Array, Float64Array, ArrayBuffer,
    parseInt, parseFloat, isFinite, isNaN, setTimeout, clearTimeout, setInterval, clearInterval,
    performance: { now: () => Number(process.hrtime.bigint()) / 1e6 },
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    document: S, window: null, navigator: { userAgent: 'node', maxTouchPoints: 0 }, location: { search: '', hash: '', href: '' },
    Image: S, Audio: S, AudioContext: S, requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
    OffscreenCanvas: S, HTMLElement: function () {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
    // файлы интерфейса трогают прототипы DOM при загрузке (i18n подменяет textContent/innerHTML): без этих
    // заглушек сервер падал на первом же таком файле с ReferenceError
    Node: S, Element: S, Document: S, CharacterData: S, HTMLInputElement: S, HTMLImageElement: S, MutationObserver: S,
    devicePixelRatio: 1, innerWidth: 1280, innerHeight: 720,
    addEventListener() {}, removeEventListener() {}, confirm: () => true, alert() {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of opts.files || FILES) {
    const file = path.join(ROOT, 'js', f + '.js');
    try { vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file }); }
    catch (e) { log('загрузка ' + f + ': ' + (e && e.message)); throw e; }
  }
  const run = code => vm.runInContext(code, ctx);
  run('R.canvas = { clientWidth: 1280, clientHeight: 720 }; R.cam = R.cam || { x: 0, y: 0, z: 2 }; renderBuildMenu = function () {}; updateUI = function () {}; updateMinimapBase = function () {}; buildTerrain = function () {};');
  // Спрайты зданий симуляции нужны только ради точек на крыше (совы, параплан): рисовать их без холста нельзя,
  // поэтому сервер берёт примерный конёк — ряд точек над зданием
  run(`buildingSprite = function () { return { perches: [], padx: 0, top: 0, w: 0, h: 0 }; };
    roofPerches = function (b) {
      const out = [], y = (b.y + 0.2) * TILE - TILE * 0.9, ground = (b.y + b.h) * TILE + 10;
      for (let k = 0; k < Math.max(2, b.w * 2); k++) out.push([(b.x + 0.4 + k * (b.w - 0.8) / Math.max(1, b.w * 2 - 1)) * TILE, y, ground]);
      return out;
    };`);
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
