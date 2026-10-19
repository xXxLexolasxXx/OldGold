'use strict';
// Кооп: хост начинает новый мир на своей карте (редактор карт). Гостю нельзя, битую карту сервер отклоняет,
// старый мир уходит в архив, после перезапуска мир строится по карте, «Обычная карта» возвращает генерацию.
// Запуск: node tests/newworld-test.js   (печатает ✗, код выхода 1 при провале)
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const crypto = require('crypto');
const { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// минимальный WebSocket-клиент без зависимостей; xff — притвориться гостем (не хостом)
function connect(port, xff) {
  return new Promise((resolve, reject) => {
    const sock = net.connect(port, '127.0.0.1');
    const msgs = []; let buf = Buffer.alloc(0), upgraded = false, frag = [];
    const cl = { msgs, send(o) { const p = Buffer.from(JSON.stringify(o)); const mask = crypto.randomBytes(4); let h;
        if (p.length < 126) h = Buffer.from([0x81, 0x80 | p.length]); else { h = Buffer.alloc(4); h[0] = 0x81; h[1] = 0x80 | 126; h.writeUInt16BE(p.length, 2); }
        const body = Buffer.from(p); for (let i = 0; i < body.length; i++) body[i] ^= mask[i & 3]; sock.write(Buffer.concat([h, mask, body])); },
      close() { sock.destroy(); },
      last(t) { for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].t === t) return msgs[i]; return null; } };
    sock.on('error', reject);
    sock.on('connect', () => sock.write('GET / HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ' + crypto.randomBytes(16).toString('base64') + '\r\nSec-WebSocket-Version: 13\r\n' + (xff ? 'X-Forwarded-For: ' + xff + '\r\n' : '') + '\r\n'));
    sock.on('data', d => {
      buf = Buffer.concat([buf, d]);
      if (!upgraded) { const i = buf.indexOf('\r\n\r\n'); if (i < 0) return; upgraded = true; buf = buf.subarray(i + 4); resolve(cl); }
      for (;;) {
        if (buf.length < 2) return;
        const fin = !!(buf[0] & 0x80), op = buf[0] & 0x0f; let len = buf[1] & 0x7f, off = 2;
        if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; } else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
        if (buf.length < off + len) return;
        const pl = buf.subarray(off, off + len); buf = buf.subarray(off + len);
        if (op === 1 || op === 0) { frag.push(pl); if (fin) { try { msgs.push(JSON.parse(Buffer.concat(frag).toString('utf8'))); } catch (e) { /* бинарный снимок */ } frag = []; } }
      }
    });
  });
}
async function login(port, nick, xff) {
  const c = await connect(port, xff);
  c.send({ t: 'auth', mode: 'register', nick, pass: 'pass1234', z: 0 });
  for (let i = 0; i < 40 && !c.last('welcome'); i++) await sleep(100);
  const w = c.last('welcome'); ok(!!w, nick + ': нет welcome');
  if (w && w.needClass) c.send({ t: 'class', cls: 'warrior' });
  for (let i = 0; i < 80 && !c.last('tempo'); i++) await sleep(100);
  return { c, w };
}

// карта 64×48 из тех же функций, что в игре (simhost без сервера)
function makeMap() {
  const { createHost } = require('../server/simhost');
  const h = createHost(() => {});
  return JSON.parse(h.run(`(function () {
    const m = meNew(64, 48, 'forest', 'Остров <b>теста</b>');
    for (let y = 0; y < 48; y++) for (let x = 0; x < 64; x++) {
      const i = y * 64 + x;
      if (x > 50) m.t[i] = 1;
      if (y < 6) { m.t[i] = 2; if (x % 4 === 0 && y === 5) m.c[i] = 1; }
      if (x < 14 && y > 10 && (x + y) % 3) m.o[i] = 1;
      if (y > 40 && x > 20 && x < 40 && (x + y) % 4 === 0) m.o[i] = 3;
    }
    m.start = [30, 24];
    return JSON.stringify(meEncode(m));
  })()`));
}
// тост, пришедший после отметки n (сервер шлёт и игровые тосты, поэтому не «последний»)
const toastAfter = (c, n, re) => c.msgs.slice(n).some(m => m.t === 'toast' && re.test(m.text || ''));
function startServer(data, port) {
  const ch = spawn(process.execPath, [path.join(ROOT, 'server', 'server.js')], {
    env: { ...process.env, OLDGOLD_DATA: data, PORT: String(port), HOST: '127.0.0.1', OLDGOLD_CHILD: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  ch.out = ''; ch.stdout.on('data', d => ch.out += d); ch.stderr.on('data', d => ch.out += d);
  return ch;
}
async function waitUp(port) {
  for (let i = 0; i < 200; i++) { try { const s = net.connect(port, '127.0.0.1'); await new Promise((r, j) => { s.on('connect', r); s.on('error', j); }); s.destroy(); return; } catch (e) { await sleep(300); } }
}

(async () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'oldgold-newworld-'));
  const port = 20000 + Math.floor(Math.random() * 20000);
  let ch = startServer(data, port), out = '';
  try {
    await waitUp(port);
    const map = makeMap();
    const host = await login(port, 'Хостик'), guest = await login(port, 'Гость1', '203.0.113.5');
    let n = guest.c.msgs.length;
    guest.c.send({ t: 'newworld', confirm: true, map }); await sleep(400);
    ok(toastAfter(guest.c, n, /только хост/), 'гость смог начать новый мир');
    n = host.c.msgs.length;
    host.c.send({ t: 'newworld', confirm: true, map: Object.assign({}, map, { start: null }) }); await sleep(400);
    ok(toastAfter(host.c, n, /не принята: Не поставлена/), 'карта без старта принята');
    n = host.c.msgs.length;
    host.c.send({ t: 'newworld', confirm: true, map: { fmt: 'oldgold-map', v: 99 } }); await sleep(400);
    ok(toastAfter(host.c, n, /не принята/), 'карта будущей версии принята');
    ok(ch.exitCode === null, 'сервер перезапустился от битой карты');
    host.c.send({ t: 'newworld', confirm: true, map });
    for (let i = 0; i < 50 && ch.exitCode === null; i++) await sleep(100);
    ok(ch.exitCode === 42, 'сервер не ушёл на перезапуск (код ' + ch.exitCode + ')');
    ok(guest.c.last('restarting'), 'игрокам не сказали о перезапуске');
    ok(fs.existsSync(path.join(data, 'custom-map.json')), 'карта не записана');
    ok(!fs.existsSync(path.join(data, 'world.json')) && fs.readdirSync(data).some(f => /^world-.+\.json$/.test(f)), 'старый мир не ушёл в архив: ' + fs.readdirSync(data).join(', '));
    host.c.close(); guest.c.close();
    out += ch.out;

    ch = startServer(data, port);
    await waitUp(port);
    const h2 = await login(port, 'Хостик2');
    await sleep(300);
    ok(/карта игрока Остров/.test(ch.out), 'мир построен не по карте:\n' + ch.out.slice(-400));
    ok(!/</.test(ch.out.split('карта игрока')[1] || '<'), 'имя карты с разметкой в логе');
    h2.c.send({ t: 'newworld', confirm: true, map: null });
    for (let i = 0; i < 50 && ch.exitCode === null; i++) await sleep(100);
    ok(ch.exitCode === 42 && !fs.existsSync(path.join(data, 'custom-map.json')), '«Обычная карта» не убрала карту');
    h2.c.close();
    out += ch.out;
  } catch (e) { fails.push('исключение теста: ' + (e && e.stack || e)); }
  finally { ch.kill(); await sleep(300); try { fs.rmSync(data, { recursive: true, force: true }); } catch (e) { /* временная папка */ } }
  if (fails.length) console.log(out.slice(-800));
  console.log(fails.length ? `Провалено: ${fails.length}` : 'Новый мир на своей карте: OK');
  process.exit(fails.length ? 1 : 0);
})();
