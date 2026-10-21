'use strict';
// Проверка статистики по согласию и отчётов о проблемах без браузера:
//  · клиент js/telemetry.js: по умолчанию выключено, на localhost не шлёт даже с согласием, с согласием — минутный снимок,
//    отказ останавливает и воронку /e, журнал консоли (200 строк), тело отчёта;
//  · сервер server/telemetry.js: валидация, хранение jsonl, отчёты в reports/, удаление по id;
//  · tools/stats-report.js и tools/reports.js на этих данных.
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
const beat = p => { for (const [f, ms] of p.intervals) if (ms === 60000) f(); };

const { createTelemetry, cleanEvent } = require('../server/telemetry');

(async () => {
  // ---- 1. Клиент: по умолчанию выключено
  {
    const p = page({}, 'xxxlexolasxxx.github.io');
    check(p.ctx.teleOn() === false, 'статистика должна быть выключена по умолчанию');
    check(page({ 'feod.tele': JSON.stringify({ on: true, asked: 1 }) }, 'xxxlexolasxxx.github.io').ctx.teleOn() === false, '«Хорошо» из 0.10.102 (старый ключ) не должно считаться согласием');
    beat(p);
    check(!p.sent.some(s => /\/t$/.test(s.url)), 'без согласия ушёл запрос на /t');
    check(p.ctx.teleDeclined() === false, 'без ответа — не «отказ» (воронка /e работает как раньше)');
  }
  // ---- 2. Локальная разработка: даже с согласием не шлём
  for (const host of ['localhost', '127.0.0.1', '192.168.1.5', 'game.test']) {
    const p = page({ 'feod.consent': JSON.stringify({ on: true, asked: 1 }) }, host);
    check(p.ctx.teleOn() === false, 'на ' + host + ' статистика не должна включаться');
    beat(p);
    check(!p.sent.length, 'на ' + host + ' ушёл запрос');
  }
  // ---- 3. С согласием: снимок раз в минуту, тело проходит серверную проверку
  {
    const p = page({ 'feod.consent': JSON.stringify({ on: true, asked: 1 }) }, 'xxxlexolasxxx.github.io');
    p.ctx.console.warn('проверка журнала', { a: 1 });
    beat(p);
    const t = p.sent.find(s => /\/t$/.test(s.url));
    check(!!t, 'с согласием снимок не ушёл на /t');
    if (t) {
      const b = t.body, e = b.ev.find(x => x.k === 'beat');
      check(/^[a-z0-9]{16}$/.test(b.id) && b.v === '9.9.9' && b.dev === 'phone' && b.scr === '400x900', 'шапка снимка неверна: ' + JSON.stringify({ ...b, ev: 0 }));
      check(e && e.fps === 57 && e.pop === 7 && e.cls === 'mage' && e.mode === 'solo', 'поля снимка неверны: ' + JSON.stringify(e));
      check(e && cleanEvent(e) && cleanEvent(e).fps === 57, 'сервер не принял бы снимок');
      check(!JSON.stringify(b).includes('проверка журнала'), 'журнал консоли попал в статистику');
    }
    // отчёт: журнал консоли и номер
    const body = JSON.parse(p.ctx.teleReportBody('не строится мост', true, ''));
    check(body.text === 'не строится мост' && body.log.some(l => /проверка журнала/.test(l)), 'в отчёте нет текста или журнала консоли');
    check(body.id === JSON.parse(p.store['feod.tid']), 'в отчёте не тот id установки');
    for (let i = 0; i < 300; i++) p.ctx.console.log('строка ' + i);
    check(JSON.parse(p.ctx.teleReportBody('x', false, '')).log.length === 200, 'журнал консоли должен держать 200 строк');
  }
  // ---- 4. Отказ: воронка /e тоже молчит
  {
    const p = page({ 'feod.consent': JSON.stringify({ on: false, asked: 1 }), 'oldgold-pending': '["start-mobile"]' }, 'xxxlexolasxxx.github.io');
    check(p.ctx.teleDeclined() === true, 'отказ не распознан');
    p.ctx.statsSend();
    check(!p.sent.some(s => /\/e$/.test(s.url)), 'после отказа воронка /e всё равно отправилась');
  }

  // ---- 5. Сервер: приём, отчёты, удаление, сводки
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oldgold-tele-'));
  try {
    const forgotten = [];
    const T = createTelemetry(dir, () => {}, { forget: c => { forgotten.push(c); return true; } });
    const id = 'abcdefgh12345678', id2 = 'zzzzzzzz12345678';
    check(T.addT(JSON.stringify({ id, s: 'sess0001', v: '1.0', dev: 'phone', scr: '400x900', ev: [
      { k: 'start', t: 0, mode: 'solo' }, { k: 'beat', t: 60, fps: 55, day: 2, pop: 9, cls: 'mage', b: { house: 2, 'bad key!': 1 }, evil: 'x'.repeat(9999) },
      { k: 'vdeath', t: 900, day: 6, causes: { starve: 3, night: 1 } }, { k: 'end', t: 960, ph: 'game', day: 6, last: 'night-seen', play: 960 }, { k: 'hack' }] })), 'нормальный пакет не принят');
    check(T.addT(JSON.stringify({ id: id2, s: 'sess0002', v: '1.1', dev: 'pc', ev: [{ k: 'beat', t: 60, fps: 120, b: { farm: 1 } }, { k: 'hdeath', why: 'ghost', day: 3 }, { k: 'err', ek: 'error', m: 'x is undefined', f: 'js/a.js:1' }] })), 'второй пакет не принят');
    check(!T.addT('мусор') && !T.addT(JSON.stringify({ id: 'A!', s: 'x', ev: [] })), 'мусор принят');
    const f = path.join(dir, 'telemetry', fs.readdirSync(path.join(dir, 'telemetry'))[0]);
    const rows = fs.readFileSync(f, 'utf8').trim().split('\n').map(l => JSON.parse(l));
    check(rows.length === 7, 'ожидалось 7 строк, а записано ' + rows.length);
    check(!rows.some(r => r.evil || r.k === 'hack') && rows[1].b.house === 2 && !('bad key!' in rows[1].b), 'лишние поля не отброшены');
    const n = T.addReport(JSON.stringify({ id, v: '1.0', dev: 'phone', text: 'гномы стоят', log: ['a', 'b'], crash: 'журнал', shot: 'data:image/jpeg;base64,/9j/4AAQ', save: '{"v":2}', snap: { day: 3, pop: 4 } }));
    check(!!n && fs.existsSync(path.join(dir, 'reports', n, 'shot.jpg')) && fs.existsSync(path.join(dir, 'reports', n, 'save.json')), 'отчёт не сохранился целиком');
    check(T.addReport(JSON.stringify({ text: '' })) === null, 'пустой отчёт принят');
    const S = require('../tools/stats-report');
    const x = S.summarize(S.load(dir, 3), dir);
    check(x.installs === 2 && x.sessions === 2 && x.villageDeaths === 1 && x.villageDeathCauses.starve === 3, 'сводка неверна: ' + JSON.stringify(x).slice(0, 300));
    check(x.heroDeaths.ghost === 1 && x.errors.length === 1 && x.built.some(([k]) => k === 'house'), 'сводка: герой/ошибки/стройка');
    check(/Деревни погибли: 1/.test(S.print(x, 3)), 'печать сводки');
    const R = require('../tools/reports');
    const L = R.list(dir);
    check(L.length === 1 && /гномы стоят/.test(R.line(L[0])) && /Журнал сбоев/.test(R.show(L[0], true)), 'tools/reports.js не показывает отчёт');
    const fr = T.forget(id, 'abcdefgh12');
    check(fr.lines === 4 && fr.reports === 1 && forgotten[0] === 'abcdefgh12', 'удаление по id: ' + JSON.stringify(fr));
    check(!fs.readFileSync(f, 'utf8').includes(id) && fs.readFileSync(f, 'utf8').includes(id2), 'после удаления остались чужие/свои строки не так');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }

  console.log('Проверка статистики и отчётов: ' + (fails.length ? `ошибок ${fails.length}` : 'OK'));
  for (const m of fails) console.log('  ✗ ' + m);
  process.exit(fails.length ? 1 : 0);
})();
