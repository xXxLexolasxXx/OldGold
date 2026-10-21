'use strict';
// Проверка «Сообщить о проблеме» без браузера:
//  · клиент js/telemetry.js: журнал консоли (200 строк), тело отчёта;
//  · сервер server/telemetry.js: отчёты в reports/, удаление по id;
//  · tools/reports.js на этих данных.
// Запуск: node tests/telemetry-test.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };

function page(store, host) {
  const sent = [], listeners = {}, intervals = [];
  const quiet = { log() {}, info() {}, warn() {}, error() {} };
  const ctx = {
    console: quiet, JSON, Math, Date, Object, Array, String, Number, RegExp, Set, Map, Promise, Error, Uint8Array, Blob: class { constructor(p) { this.p = p; } },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; }, length: 0, key: () => null },
    location: { hostname: host, protocol: 'https:', search: '' },
    navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile', maxTouchPoints: 5 },
    screen: { width: 400, height: 900 }, devicePixelRatio: 2,
    document: { hidden: false, visibilityState: 'visible', getElementById: () => null, addEventListener() {}, createElement: () => ({ style: {}, classList: { contains: () => false } }), body: { appendChild() {} }, querySelector: () => null },
    getComputedStyle: () => ({ display: 'none' }),
    setInterval: (f, ms) => { intervals.push([f, ms]); return 0; }, setTimeout: () => 0, clearTimeout() {},
    fetch: (url, o) => { sent.push({ url, body: JSON.parse(o.body) }); return Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve({ n: 'x' }) }); },
    coopDefaultServer: () => 'wss://srv.example', coopHttpUrl: ws => ws.replace(/^ws/, 'http'),
    GAME_VERSION: '9.9.9', crypto: { getRandomValues: a => { for (let i = 0; i < a.length; i++) a[i] = (Math.random() * 256) | 0; return a; } },
    Game: { time: 500, units: [1, 2, 3], buildings: [], hero: { hero: { cls: 'mage', level: 2 } }, paused: false },
    Fps: { fps: 57.4, eco: false }, Mobile: { on: true },
    cycleAt: t => ({ k: Math.floor(t / 565) }), goalAlive: () => 7,
  };
  ctx.window = ctx;
  ctx.addEventListener = (t, f) => { (listeners[t] = listeners[t] || []).push(f); };
  vm.createContext(ctx);
  for (const f of ['js/crashlog.js', 'js/telemetry.js', 'js/stats.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  vm.runInContext('function crashPhase() { return "game"; }', ctx);   // в тесте нет DOM: считаем, что идёт игра
  for (const f of listeners.load || []) f();
  return { ctx, sent, intervals, store, listeners };
}

const { createTelemetry } = require('../server/telemetry');

(async () => {
  // ---- 1. Клиент: журнал консоли и тело отчёта
  {
    const p = page({}, 'xxxlexolasxxx.github.io');
    p.ctx.console.warn('проверка журнала', { a: 1 });
    const body = JSON.parse(p.ctx.teleReportBody('не строится мост', true, ''));
    check(body.text === 'не строится мост' && body.log.some(l => /проверка журнала/.test(l)), 'в отчёте нет текста или журнала консоли');
    check(body.id === JSON.parse(p.store['feod.tid']) && /^[a-z0-9]{16}$/.test(body.id), 'в отчёте не тот id установки');
    check(body.v === '9.9.9' && body.dev === 'phone' && body.scr === '400x900' && body.snap.pop === 7 && body.snap.cls === 'mage', 'в отчёте неверны версия/устройство/снимок: ' + JSON.stringify({ ...body, log: 0, crash: 0 }));
    for (let i = 0; i < 300; i++) p.ctx.console.log('строка ' + i);
    check(JSON.parse(p.ctx.teleReportBody('x', false, '')).log.length === 200, 'журнал консоли должен держать 200 строк');
    check(!p.sent.length, 'без нажатия ничего не должно уходить');
  }

  // ---- 2. Сервер: отчёты, удаление, просмотр
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oldgold-tele-'));
  try {
    const forgotten = [];
    const T = createTelemetry(dir, () => {}, { forget: c => { forgotten.push(c); return true; } });
    const id = 'abcdefgh12345678';
    const n = T.addReport(JSON.stringify({ id, v: '1.0', dev: 'phone', text: 'гномы стоят', log: ['a', 'b'], crash: 'журнал', shot: 'data:image/jpeg;base64,/9j/4AAQ', save: '{"v":2}', snap: { day: 3, pop: 4 } }));
    check(!!n && fs.existsSync(path.join(dir, 'reports', n, 'shot.jpg')) && fs.existsSync(path.join(dir, 'reports', n, 'save.json')), 'отчёт не сохранился целиком');
    check(T.addReport(JSON.stringify({ text: '' })) === null && T.addReport('мусор') === null, 'пустой отчёт/мусор принят');
    const R = require('../tools/reports');
    const L = R.list(dir);
    check(L.length === 1 && /гномы стоят/.test(R.line(L[0])) && /Журнал сбоев/.test(R.show(L[0], true)), 'tools/reports.js не показывает отчёт');
    const fr = T.forget(id, 'abcdefgh12');
    check(fr.reports === 1 && forgotten[0] === 'abcdefgh12' && !R.list(dir).length, 'удаление по id: ' + JSON.stringify(fr));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }

  console.log('Проверка отчётов о проблемах: ' + (fails.length ? `ошибок ${fails.length}` : 'OK'));
  for (const m of fails) console.log('  ✗ ' + m);
  process.exit(fails.length ? 1 : 0);
})();
