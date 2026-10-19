'use strict';
// Проверка js/crashlog.js без браузера: причины прошлых вылетов, запись ошибок, лимиты и содержимое отчёта.
// Запуск: node tests/crashlog-test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const FILE = path.join(__dirname, '..', 'js', 'crashlog.js');
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };

function page(store, opts = {}) {
  const listeners = {}, sent = [], timers = [];
  const el = () => ({ classList: { contains: () => false }, style: {} });
  const ctx = {
    console, JSON, Math, Date, Object, Array, String, Number, RegExp, Set, Map, Promise, Error,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    location: { hostname: opts.host || 'xxxlexolasxxx.github.io', protocol: 'https:' },
    navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-X) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36', maxTouchPoints: 5, deviceMemory: 4 },
    screen: { width: 400, height: 900 }, devicePixelRatio: 2.5,
    document: { visibilityState: 'visible', getElementById: () => null, addEventListener: (t, f) => (listeners['d' + t] = f), createElement: el, body: { appendChild() {} } },
    getComputedStyle: () => ({ display: 'none' }),
    setInterval: () => 0, setTimeout: (f, ms) => timers.push([f, ms]),
    fetch: (url, o) => { sent.push({ url, body: JSON.parse(o.body) }); return Promise.resolve({ status: 204 }); },
    coopDefaultServer: () => 'wss://srv.example', coopHttpUrl: ws => ws.replace(/^ws/, 'http'),
    GAME_VERSION: '9.9.9',
  };
  ctx.window = ctx;
  ctx.addEventListener = (t, f) => (listeners[t] = f);
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), ctx, { filename: FILE });
  return { ctx, listeners, sent, timers, store };
}

const now = Date.now();
const sess = o => ({ start: now - 600000, beat: now - 120000, vis: 'visible', closed: false, ph: 'game', v: '1', errs: 0, ...o });

// 1. Причины прошлых вылетов
{
  const store = {
    'feod.sessions': '',
    'feod.sess': JSON.stringify({
      a: sess({ vis: 'hidden' }), b: sess({ lastErr: now - 125000, errs: 2 }), c: sess({}), d: sess({ closed: true }), e: sess({ beat: now - 2000 }),
    }),
  };
  const p = page(store);
  const exits = JSON.parse(store['feod.exits'] || '[]');
  const by = exits.map(x => x.r).sort().join(',');
  check(by === 'bg,error,unknown', 'причины вылетов: ожидалось bg,error,unknown, а вышло ' + by);
  const left = Object.keys(JSON.parse(store['feod.sess']));
  check(left.includes('e') && !left.includes('d') && !left.includes('a'), 'живая соседняя вкладка должна остаться, закрытые и разобранные — удалиться: ' + left);
  // через 15 с соседняя вкладка так и не подала признаков — тоже вылет
  const st = JSON.parse(store['feod.sess']); st.e.beat = Date.now() - 20000; store['feod.sess'] = JSON.stringify(st);
  for (const [f, ms] of p.timers) if (ms === 15000) f();
  check(JSON.parse(store['feod.exits']).length === 4, 'отложенный разбор не подхватил замолчавшую вкладку');
  // память
  const s2 = { 'feod.diag': JSON.stringify({ last: [{ heap: 700, lim: 1000, cvMB: 20 }] }), 'feod.sess': JSON.stringify({ x: sess({}) }) };
  page(s2);
  check(JSON.parse(s2['feod.exits'])[0].r === 'memory', 'большая куча перед обрывом должна дать причину «память»');
  // старый формат записи сессии не ломает запуск
  const s3 = { 'feod.sess': JSON.stringify(sess({})) };
  try { page(s3); } catch (e) { fails.push('старый формат feod.sess уронил скрипт: ' + e.message); }
}

// 2. Ошибки: журнал, отправка без личных данных, лимиты
{
  const store = {};
  const p = page(store);
  const fire = (m, f = 'https://x.github.io/OldGold/js/main.js', stack) => p.listeners.error({ message: m, filename: f, lineno: 10, colno: 3, error: { stack: stack || `Error: ${m}\n    at step (https://x.github.io/OldGold/js/main.js:210:5)\n    at loop (https://x.github.io/OldGold/js/main.js:500:1)` } });
  fire('TypeError: a is undefined; mail me@example.com, id 123456789');
  const log = JSON.parse(store['feod.errlog']);
  check(log.length === 1 && log[0].f === 'js/main.js:10:3', 'файл:строка в журнале: ' + (log[0] && log[0].f));
  check(!/example\.com|123456789/.test(store['feod.errlog']), 'почта и длинные числа должны вычищаться');
  check(p.sent.length === 1 && p.sent[0].url === 'https://srv.example/err', 'отчёт должен уйти на /err сервера: ' + JSON.stringify(p.sent.map(s => s.url)));
  const b = p.sent[0] && p.sent[0].body;
  check(b && b.v === '9.9.9' && b.os === 'Android 14' && /Chrome 130/.test(b.br) && b.mob === 1 && b.st[0] === 'js/main.js:210', 'поля отчёта: ' + JSON.stringify(b));
  check(b && !('c' in b) && !JSON.stringify(b).includes('SM-X'), 'в отчёте не должно быть id клиента и модели телефона');
  fire('TypeError: a is undefined; mail me@example.com, id 123456789');
  check(p.sent.length === 1, 'одинаковая ошибка не должна отправляться повторно');
  for (let i = 0; i < 10; i++) fire('ошибка ' + i);
  check(p.sent.length === 1, 'не чаще раза в 10 с');
  check(JSON.parse(store['feod.errlog']).length === 12, 'все ошибки должны попасть в локальный журнал');
  check(Object.values(JSON.parse(store['feod.sess']))[0].errs === 12, 'счётчик ошибок сессии');
  // ошибка загрузки скрипта
  p.listeners.error({ target: { tagName: 'SCRIPT', src: 'https://x.github.io/OldGold/js/world/pets.js' } });
  check(/не загрузился script/.test(store['feod.errlog']) && /js\/world\/pets\.js/.test(store['feod.errlog']), 'ошибка загрузки файла должна попасть в журнал');
  // текст журнала
  let text = '';
  try { text = p.ctx.crashLogText(); } catch (e) { fails.push('crashLogText упал: ' + e.message); }
  check(/OldGold 9\.9\.9/.test(text) && /Android 14/.test(text) && /Ошибки/.test(text), 'текст журнала неполный:\n' + text);
}

// 3. Локальная игра ничего не отправляет
{
  const p = page({}, { host: 'localhost' });
  p.listeners.error({ message: 'x', filename: 'http://localhost/js/a.js', lineno: 1, colno: 1 });
  check(p.sent.length === 0, 'с localhost отчёты не отправляются');
}

console.log('Проверка журнала сбоев: ' + (fails.length ? '' : 'всё сходится'));
for (const f of fails) console.log('  ✗ ' + f);
process.exit(fails.length ? 1 : 0);
