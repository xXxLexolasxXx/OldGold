'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function load(file, globals) {
  const context = vm.createContext(globals);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
  return context;
}

function testMenu() {
  const actions = [];
  let keydown, panel = 'main';
  const menu = {
    dataset: {},
    insertAdjacentHTML() {},
    addEventListener() {},
    querySelector(selector) {
      if (selector === '[data-sm="connect"]') return { click: () => actions.push('connect') };
      return selector === '[data-panel="main"]:not(.hidden)' && panel === 'main' ? {} : null;
    },
  };
  const context = load('js/startmenu.js', {
    window: { addEventListener: (type, handler) => { if (type === 'keydown') keydown = handler; } },
    document: { getElementById: id => id === 'start-menu' ? menu : null, querySelector: () => null, addEventListener() {} },
    BIOME_ORDER: [], MAP_SIZE_ORDER: [], DIFF_ORDER: [],
    buildingIconURL() {}, startGame() {}, render() {}, drawMinimap() {}, updateMinimapBase() {},
    recordAction: action => actions.push(action),
  });
  vm.runInContext("StartMenu.open = true; smBestSave = () => ({}); smAction = recordAction; initStartMenu();", context);
  const enter = (target, extra = {}) => keydown({ key: 'Enter', target, ...extra });
  const body = { tagName: 'BODY', closest: () => null };
  const button = { tagName: 'BUTTON', closest: selector => selector.startsWith('button') ? button : null };
  const input = {
    tagName: 'INPUT',
    closest: selector => selector.startsWith('input') || (selector.startsWith('[data-panel="mp"]') && panel === 'mp') ? input : null,
  };
  enter(button);
  enter(body, { defaultPrevented: true });
  assert.deepEqual(actions, [], 'Focused buttons handle Enter through their native click');
  enter(body);
  vm.runInContext('smBestSave = () => null', context);
  enter(body);
  panel = 'mp';
  enter(input);
  panel = 'help';
  enter(body);
  assert.deepEqual(actions, ['continue', 'new', 'connect']);
}

function musicDefaults({ mode, coarse = true, fullscreenElement = null, saved = {} }) {
  const context = load('js/sound/music.js', {
    window: { matchMedia: true, addEventListener() {} },
    document: { fullscreenElement, addEventListener() {} },
    matchMedia: query => ({ matches: query === '(pointer: coarse)' ? coarse : query === `(display-mode: ${mode})` }),
    location: { hostname: 'oldgold.example', search: '' },
    localStorage: { getItem: key => saved[key] ?? null },
    URLSearchParams,
  });
  return [vm.runInContext('Music.on', context), vm.runInContext('Music.menuOn', context)];
}

test('Start menu Enter respects focused controls and the active panel', testMenu);
test('Touch PWA defaults to silent and respects saved music preferences', () => {
  for (const mode of ['fullscreen', 'standalone']) assert.deepEqual(musicDefaults({ mode }), [false, false]);
  assert.deepEqual(musicDefaults({ mode: 'fullscreen', coarse: false }), [true, true]);
  assert.deepEqual(musicDefaults({ mode: 'fullscreen', fullscreenElement: {} }), [true, true]);
  assert.deepEqual(musicDefaults({ mode: 'browser' }), [true, true]);
  assert.deepEqual(musicDefaults({ mode: 'fullscreen', saved: { 'feod.music': '1', 'feod.menuMusic': '0' } }), [true, false]);
});

const origin = 'https://oldgold.example';
function fetchThroughWorker({ status, entries = {}, pathname = '/index.html', mode = 'navigate', method = 'GET' }) {
  const writes = [], reads = [];
  let fetchHandler, result;
  load('sw.js', {
    self: { addEventListener: (type, handler) => { if (type === 'fetch') fetchHandler = handler; } },
    location: { origin }, URL, Response, AbortController, setTimeout, clearTimeout,
    fetch: async () => {
      if (status === undefined) throw new TypeError('Offline');
      return new Response('network', { status });
    },
    caches: { open: async () => ({
      put: async (request, response) => writes.push(response.status),
      match: async request => {
        const key = typeof request === 'string' ? request : new URL(request.url).pathname;
        reads.push(key);
        return entries[key];
      },
    }) },
  });
  fetchHandler({
    request: { url: origin + pathname, method, mode },
    respondWith: response => { result = response; },
  });
  return { result, writes, reads };
}

test('Service worker recovers cached content on 503 and failed fetch', async () => {
  const cached = new Response('cached');
  for (const status of [503, undefined]) {
    const warm = fetchThroughWorker({ status, entries: { '/index.html': cached } });
    assert.equal(await warm.result, cached);
    assert.deepEqual(warm.writes, []);
  }
  const navigation = fetchThroughWorker({ status: 503, pathname: '/subpage', entries: { 'index.html': cached } });
  assert.equal(await navigation.result, cached);
  const cold = fetchThroughWorker({ status: 503, pathname: '/js/test.js', mode: 'same-origin', entries: { 'index.html': cached } });
  assert.equal((await cold.result).status, 503);
  assert.deepEqual(cold.reads, ['/js/test.js']);
  const offline = fetchThroughWorker({ pathname: '/js/test.js', mode: 'same-origin' });
  assert.equal((await offline.result).type, 'error');
});

test('Service worker keeps network success, client errors and co-op requests on their normal paths', async () => {
  const entries = { '/index.html': new Response('cached') };
  for (const status of [200, 404]) {
    const { result, writes, reads } = fetchThroughWorker({ status, entries });
    assert.equal((await result).status, status);
    assert.deepEqual(writes, status === 200 ? [200] : []);
    assert.deepEqual(reads, []);
  }
  for (const pathname of ['/e', '/coop-info', '/coop']) assert.equal(fetchThroughWorker({ pathname }).result, undefined);
  assert.equal(fetchThroughWorker({ method: 'POST' }).result, undefined);
});
