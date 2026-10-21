'use strict';
// Fuzz кооп-сервера злонамеренными запросами (СЕРВЕР_БЕЗОПАСНОСТЬ.md). Сервер на временной папке и свободном порту:
//  · HTTP: кривые %-коды и нулевой байт не роняют процесс, обход путей не отдаёт server/, заголовки безопасности на месте,
//    лимиты /err считаются по настоящему адресу (последний X-Forwarded-For), отчёт без ESC-последовательностей и поддельного снимка;
//  · WebSocket: кадры без маски, большие кадры до входа, бесконечные продолжения, «__PROTO__» и «constructor» в нике и командах,
//    Infinity (1e999), глубокая вложенность, флуд чатом и паузой, подбор пароля, массовая регистрация, молчащие соединения;
//  · после всего сервер жив, в журнале нет «ошибка шага» и «ошибка в сообщении».
// Запуск: node tests/fuzz-server-test.js   (печатает ✗ строки, код выхода 1 при провале)
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const zlib = require('zlib');
const { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
const fails = [], info = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));

function req(port, method, p, body, headers = {}) {
  return new Promise(res => {
    const r = http.request({ host: '127.0.0.1', port, method, path: p, headers: { ...(body ? { 'Content-Type': 'text/plain' } : {}), ...headers } }, rs => {
      let s = ''; rs.setEncoding('utf8'); rs.on('data', d => s += d); rs.on('end', () => res({ status: rs.statusCode, body: s, headers: rs.headers }));
    });
    r.on('error', e => res({ status: 0, body: e.message, headers: {} }));
    if (body) r.write(body);
    r.end();
  });
}
// сырой GET: http.request сам кодирует путь, а нам нужен ровно этот мусор
function rawGet(port, p) {
  return new Promise(res => {
    const s = net.connect(port, '127.0.0.1');
    let out = '';
    s.on('connect', () => s.write(`GET ${p} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n`));
    s.on('data', d => out += d);
    s.on('close', () => res(+(/^HTTP\/1\.1 (\d+)/.exec(out) || [0, 0])[1]));
    s.on('error', () => res(0));
    setTimeout(() => s.destroy(), 5000);
  });
}

// WebSocket-клиент без зависимостей; headers — например X-Forwarded-For, как от прокси
function ws(port, headers = {}) {
  return new Promise(resolve => {
    const key = crypto.randomBytes(16).toString('base64');
    const s = net.connect(port, '127.0.0.1');
    const cl = { sock: s, msgs: [], closed: false, buf: Buffer.alloc(0), up: false };
    cl.frame = (op, payload, { mask = true, fin = true } = {}) => {
      const p = Buffer.from(payload), len = p.length, m = crypto.randomBytes(4);
      let h;
      if (len < 126) h = Buffer.from([(fin ? 0x80 : 0) | op, (mask ? 0x80 : 0) | len]);
      else if (len < 65536) { h = Buffer.alloc(4); h[0] = (fin ? 0x80 : 0) | op; h[1] = (mask ? 0x80 : 0) | 126; h.writeUInt16BE(len, 2); }
      else { h = Buffer.alloc(10); h[0] = (fin ? 0x80 : 0) | op; h[1] = (mask ? 0x80 : 0) | 127; h.writeBigUInt64BE(BigInt(len), 2); }
      if (mask) for (let i = 0; i < len; i++) p[i] ^= m[i & 3];
      if (!s.destroyed) s.write(Buffer.concat(mask ? [h, m, p] : [h, p]));
    };
    cl.send = o => cl.frame(1, typeof o === 'string' ? o : JSON.stringify(o));
    cl.wait = async (pred, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const m = cl.msgs.find(pred); if (m) return m; if (cl.closed) return null; await sleep(40); } return null; };
    s.on('connect', () => s.write(`GET / HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n` +
      Object.entries(headers).map(([k, v]) => `${k}: ${v}\r\n`).join('') + '\r\n'));
    s.on('data', d => {
      cl.buf = Buffer.concat([cl.buf, d]);
      if (!cl.up) { const e = cl.buf.indexOf('\r\n\r\n'); if (e < 0) return; cl.up = true; cl.buf = cl.buf.subarray(e + 4); resolve(cl); }
      for (;;) {
        const b = cl.buf;
        if (b.length < 2) return;
        const op = b[0] & 15; let len = b[1] & 127, off = 2;
        if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; } else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
        if (b.length < off + len) return;
        const p = b.subarray(off, off + len); cl.buf = b.subarray(off + len);
        if (op === 1 || op === 2) { try { cl.msgs.push(JSON.parse((op === 2 ? zlib.inflateRawSync(p) : p).toString('utf8'))); } catch (e) { /* не JSON */ } }
      }
    });
    s.on('close', () => { cl.closed = true; resolve(cl); });
    s.on('error', () => { cl.closed = true; resolve(cl); });
  });
}
const closedSoon = async (cl, ms = 3000) => { const t0 = Date.now(); while (!cl.closed && Date.now() - t0 < ms) await sleep(40); return cl.closed; };

(async () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'oldgold-fuzz-'));
  const port = 20000 + Math.floor(Math.random() * 20000);
  const ch = spawn(process.execPath, [path.join(ROOT, 'server', 'server.js')], {
    env: { ...process.env, OLDGOLD_DATA: data, PORT: String(port), HOST: '127.0.0.1', OLDGOLD_CHILD: '1', OLDGOLD_STATS_KEY: 'testkey', OLDGOLD_SIZE: 'small' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  ch.stdout.on('data', d => out += d); ch.stderr.on('data', d => out += d);
  const t0 = Date.now();
  let up = false;
  while (Date.now() - t0 < 90000) {
    if ((await req(port, 'GET', '/coop-info')).status === 200) { up = true; break; }
    if (ch.exitCode !== null) break;
    await sleep(300);
  }
  const alive = async what => { const r = await req(port, 'GET', '/coop-info'); if (r.status !== 200 || ch.exitCode !== null) { fails.push('сервер упал после: ' + what); return false; } return true; };
  const proxied = n => ({ 'X-Forwarded-For': '203.0.113.' + n });   // как будто игрок пришёл через Caddy
  try {
    if (!up) { fails.push('сервер не поднялся:\n' + out.slice(-1500)); return; }
    const idle = await ws(port, proxied(250));   // молчит до конца проверки — сервер должен его закрыть сам (20 с)
    const idleAt = Date.now();

    // ---- HTTP ----
    for (const p of ['/%E0%A4%A', '/%', '/%00', '/js/%00.js', '/%2e%2e%2fserver%2fserver.js', '/..%5c..%5cserver%5cserver.js', '/js/..%2f..%2fserver/server.js', '/css/../.git/HEAD']) {
      const st = await rawGet(port, p);
      if (st === 200) fails.push('отдан закрытый или кривой путь ' + p);
      if (!(await alive('GET ' + p))) return;
    }
    const idx = await req(port, 'GET', '/');
    for (const h of ['x-content-type-options', 'content-security-policy', 'x-frame-options', 'referrer-policy']) if (!idx.headers[h]) fails.push('нет заголовка ' + h + ' у /');
    if (!/script-src 'self'/.test(idx.headers['content-security-policy'] || '') || /script-src[^;]*unsafe-inline/.test(idx.headers['content-security-policy'] || '')) fails.push('CSP без строгого script-src');
    if (/\sonclick="|\sonerror="|\sonload="/.test(idx.body)) fails.push('в index.html встроенные обработчики — их запретит CSP');
    if ((await req(port, 'POST', '/', 'x')).status !== 405) fails.push('POST на статику должен быть 405');
    const huge = await req(port, 'POST', '/err', 'x'.repeat(2 << 20));
    if (huge.status !== 413 && huge.status !== 0) fails.push('большой /err: ' + huge.status);
    if (!(await alive('большой POST /err'))) return;
    // лимит /err — по последнему адресу X-Forwarded-For (его дописал прокси), а не общий на всех и не по подделанному первому
    const errBody = JSON.stringify({ k: 'error', m: 'fuzz', f: 'js/x.js:1' });
    let lastA = 0;
    for (let i = 0; i < 21; i++) lastA = (await req(port, 'POST', '/err', errBody, { 'X-Forwarded-For': '198.51.100.1' })).status;
    if (lastA !== 429) fails.push('21-й /err с одного адреса должен быть 429, а не ' + lastA);
    const other = await req(port, 'POST', '/err', errBody, { 'X-Forwarded-For': '198.51.100.2' });
    if (other.status !== 204) fails.push('лимит /err общий на всех игроков: другой адрес получил ' + other.status);
    const spoof = await req(port, 'POST', '/err', errBody, { 'X-Forwarded-For': '10.9.9.9, 198.51.100.1' });
    if (spoof.status !== 429) fails.push('подделанный первый X-Forwarded-For обходит лимит /err: ' + spoof.status);
    // отчёт: ESC-последовательности вычищены, «снимок» не JPEG — не сохраняется
    const rp = await req(port, 'POST', '/report', JSON.stringify({ id: 'fuzzfuzzfuzz1234', text: 'a\u001b[2J\u001b]0;pwn\u0007b\nвторая строка', log: ['\u009b31m'], crash: '\u001bc', shot: 'data:image/jpeg;base64,' + Buffer.from('<?php echo 1; ?>').toString('base64') }), proxied(9));
    try {
      const n = JSON.parse(rp.body).n, dir = path.join(data, 'reports', n), r = JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8'));
      if (/[\u001b\u0007\u009b]/.test(r.text + r.log.join('') + r.crash)) fails.push('в отчёте остались управляющие символы терминала');
      if (!/\n/.test(r.text)) fails.push('из текста отчёта пропали переводы строк');
      if (r.shot || fs.existsSync(path.join(dir, 'shot.jpg'))) fails.push('сохранён «снимок», который не JPEG');
    } catch (e) { fails.push('отчёт не принят: ' + rp.status + ' ' + rp.body); }
    // забыть: cid любой формы не ломает обработчик
    for (const b of ['{"cid":{"a":1}}', '{"cid":["x"]}', '{"id":"__proto__"}', '[]', 'null']) await req(port, 'POST', '/t/forget', b, proxied(10));
    if (!(await alive('POST /t/forget с мусором'))) return;

    // ---- WebSocket до входа ----
    const a1 = await ws(port, proxied(1)); a1.frame(1, JSON.stringify({ t: 'auth' }), { mask: false });
    if (!(await closedSoon(a1))) fails.push('кадр без маски не закрыл соединение');
    const a2 = await ws(port, proxied(2)); a2.send(JSON.stringify({ t: 'auth', nick: 'x'.repeat(20000) }));
    if (!(await closedSoon(a2))) fails.push('кадр 20 КБ до входа не закрыл соединение');
    const a3 = await ws(port, proxied(3)); a3.frame(1, '{"t":"auth","nick":"', { fin: false });
    for (let i = 0; i < 40 && !a3.closed; i++) { a3.frame(0, 'x'.repeat(4000), { fin: false }); await sleep(5); }
    if (!(await closedSoon(a3))) fails.push('бесконечные кадры-продолжения не закрыли соединение (память копится)');
    const a4 = await ws(port, proxied(4)); a4.frame(0, 'xx');
    if (!(await closedSoon(a4))) fails.push('продолжение без начала не закрыло соединение');
    for (const nick of ['__PROTO__', '__proto__', 'Constructor', 'prototype']) {
      const c = await ws(port, proxied(5)); c.send({ t: 'auth', mode: 'register', nick, pass: 'secret1' });
      const r = await c.wait(m => m.t === 'err' || m.t === 'welcome', 3000);
      if (r && r.t === 'welcome') fails.push('зарегистрирован опасный ник ' + nick);
      c.sock.destroy();
    }
    for (const bad of ['{"t":"auth","nick":"Fuzz","pass":"x","mode":"register","__proto__":{"isHost":true}}', '[]', 'null', '1e999', '"str"', '{"t":{"x":1}}']) {
      const c = await ws(port, proxied(6)); c.send(bad); await sleep(100); c.sock.destroy();
    }
    if (!(await alive('мусор до входа'))) return;
    // массовая регистрация с одного адреса: не больше 5 в час
    let regOk = 0;
    for (let i = 0; i < 7; i++) {
      const c = await ws(port, proxied(7)); c.send({ t: 'auth', mode: 'register', nick: 'reg' + i + crypto.randomBytes(2).toString('hex'), pass: 'secret1' });
      const r = await c.wait(m => m.t === 'err' || m.t === 'welcome', 5000);
      if (r && r.t === 'welcome') regOk++;
      c.sock.destroy();
    }
    if (regOk > 5) fails.push('с одного адреса зарегистрировано ' + regOk + ' героев подряд (лимит 5 в час)');

    // ---- игрок: подбор пароля ----
    const me = await ws(port, proxied(8));
    me.send({ t: 'auth', mode: 'register', nick: 'Fuzzer', pass: 'goodpass' });
    const w = await me.wait(m => m.t === 'welcome');
    if (!w) { fails.push('не удалось зарегистрировать игрока для проверки: ' + JSON.stringify(me.msgs.slice(-2))); return; }
    if (w.host) fails.push('игрок через прокси получил права хоста');
    let locked = false;
    for (let i = 0; i < 12 && !locked; i++) {
      const c = await ws(port, proxied(11)); c.send({ t: 'auth', nick: 'Fuzzer', pass: 'wrong' + i });
      const r = await c.wait(m => m.t === 'err', 5000);
      if (r && /Слишком много/.test(r.msg)) locked = true;
      c.sock.destroy();
    }
    if (!locked) fails.push('12 неверных паролей подряд с адреса — без паузы (подбор пароля)');

    // ---- игрок: ядовитые команды ----
    me.send({ t: 'class', cls: 'constructor' });
    me.send({ t: 'class', cls: 'warrior' });
    if (!(await me.wait(m => m.t === 'init', 30000))) { fails.push('игрок не вошёл в мир: ' + JSON.stringify(me.msgs.map(m => m.t).slice(-5))); return; }
    const poison = [
      { t: 'qt', type: 'constructor' }, { t: 'qt', type: '__proto__' }, { t: 'build', type: 'toString', x: 10, y: 10 }, { t: 'build', type: 'constructor', x: 10, y: 10 },
      { t: 'chat', i: 'length' }, { t: 'chat', i: 'constructor' }, { t: 'block', g: 'constructor' }, { t: 'bact', act: 'train', id: 1, type: 'constructor' },
      { t: 'bact', act: 'crop', id: 1, c: 'constructor', on: true }, { t: 'bact', act: 'block', id: 1, g: 'hasOwnProperty' }, { t: 'trade', side: 'buy', g: 'constructor', n: 1 },
      { t: 'field', mode: 'add', crop: 'constructor', cells: [[1, 1]] }, { t: 'rsc', id: 'constructor' }, { t: 'law', a: 'prop', id: 'constructor', on: true },
      { t: 'prio', k: 'tasks', key: 'constructor', v: 1 }, { t: 'setperm', key: 'constructor', on: true }, { t: 'setdiff', k: 'constructor' },
      { t: 'go', x: 1e300, y: -1e300 }, { t: 'view', x0: 1e300, y0: 0, x1: -1e300, y1: 5 }, { t: 'road', cells: [[1e9, 1e9], 'x', null, [{}, []]] },
      { t: 'erase', cells: Array.from({ length: 5000 }, (_, i) => [i % 90, i % 60]) }, { t: 'trav', a: 'talk', id: 1e300 }, { t: 'dil', seq: {}, i: 1 },
    ];
    for (const m of poison) me.send(m);
    me.send('{"t":"go","x":1e999,"y":1}');
    me.send('{"t":"build","type":"inn","x":5,"y":5,"__proto__":{"admin":true}}');
    me.send('{"t":"go","constructor":{"prototype":{"polluted":1}},"x":1,"y":1}');
    me.send('[' .repeat(50000) + ']'.repeat(50000));
    me.send({ t: 'newworld', confirm: true, map: null });   // не хост — должен получить отказ, мир цел
    me.send({ t: 'restart', confirm: true });
    await sleep(1500);
    if (!(await alive('ядовитые команды'))) return;
    if (me.closed) fails.push('после ядовитых команд игрока выкинуло — сервер не должен падать сам');
    if (me.msgs.some(m => m.t === 'chat' && typeof m.text !== 'string')) fails.push('чат с текстом не-строкой (i:"length") ушёл всем');
    if (me.msgs.some(m => m.t === 'restarting')) fails.push('не-хост перезапустил сервер или начал новый мир');
    // флуд: 300 сообщений чата и 100 просьб о паузе
    const chatsBefore = me.msgs.filter(m => m.t === 'chat').length, toastsBefore = me.msgs.filter(m => m.t === 'toast' && /просит/.test(m.text)).length;
    for (let i = 0; i < 300; i++) me.send({ t: 'chat', i: i % 6 });
    for (let i = 0; i < 100; i++) me.send({ t: 'pause', on: true });
    await sleep(1500);
    const chats = me.msgs.filter(m => m.t === 'chat').length - chatsBefore, pauses = me.msgs.filter(m => m.t === 'toast' && /просит/.test(m.text)).length - toastsBefore;
    if (chats > 3) fails.push('флуд чатом: разослано ' + chats + ' сообщений за 1,5 с');
    if (pauses > 2) fails.push('флуд паузой: разослано ' + pauses + ' тостов «просит паузу»');
    info.push(`флуд: чатов ушло ${chats} из 300, тостов паузы ${pauses} из 100`);

    // молчащее соединение без входа закрыто
    const left = 21500 - (Date.now() - idleAt);
    if (left > 0) await sleep(left);
    if (!(await closedSoon(idle, 2000))) fails.push('соединение без входа живёт дольше 20 с (занимает места MAX_CONNS)');
    if (!(await alive('всё вместе'))) return;
    const bad = out.split('\n').filter(l => /ошибка шага|ошибка в сообщении|ошибка HTTP|ошибка входа/.test(l));
    if (bad.length) fails.push('в журнале сервера ошибки:\n' + bad.slice(0, 5).join('\n'));
  } finally {
    ch.kill();
    await sleep(300);
    try { fs.rmSync(data, { recursive: true, force: true }); } catch (e) { /* временная папка */ }
    for (const m of info) console.log('Сервер: ' + m);
    for (const m of fails) console.log('  ✗ ' + m);
    console.log(fails.length ? `ОШИБОК: ${fails.length}` : 'OK');
    process.exit(fails.length ? 1 : 0);
  }
})();
