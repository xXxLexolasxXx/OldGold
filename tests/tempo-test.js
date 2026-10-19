'use strict';
// Кооп: пауза (хост — сразу, гость — голосованием), скорость (только хост), приоритеты работ (рассылка и сохранение).
// Запуск: node tests/tempo-test.js   (печатает ✗, код выхода 1 при провале)
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

(async () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'oldgold-tempo-'));
  const port = 20000 + Math.floor(Math.random() * 20000);
  const ch = spawn(process.execPath, [path.join(ROOT, 'server', 'server.js')], {
    env: { ...process.env, OLDGOLD_DATA: data, PORT: String(port), HOST: '127.0.0.1', OLDGOLD_CHILD: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; ch.stdout.on('data', d => out += d); ch.stderr.on('data', d => out += d);
  try {
    for (let i = 0; i < 200; i++) { try { const s = net.connect(port, '127.0.0.1'); await new Promise((r, j) => { s.on('connect', r); s.on('error', j); }); s.destroy(); break; } catch (e) { await sleep(300); } }
    const host = await login(port, 'Хостик'), guest = await login(port, 'Гость1', '203.0.113.5');
    ok(host.w && host.w.host === true && guest.w && guest.w.host === false, 'хост/гость определились неверно');
    const t0 = host.c.last('tempo');
    ok(t0 && t0.paused === false && t0.speed === 1, 'при входе нет tempo ×1: ' + JSON.stringify(t0));

    // скорость: гость не может, хост может, мусор не принимается
    guest.c.send({ t: 'speed', v: 3 }); await sleep(300);
    ok(!(guest.c.last('tempo') && guest.c.last('tempo').speed === 3), 'гость поменял скорость');
    host.c.send({ t: 'speed', v: 7 }); await sleep(300);
    ok(host.c.last('tempo').speed === 1, 'принята недопустимая скорость 7');
    host.c.send({ t: 'speed', v: 2 }); await sleep(400);
    ok(guest.c.last('tempo').speed === 2, 'скорость хоста не дошла до гостя');
    host.c.send({ t: 'speed', v: 1 }); await sleep(300);

    // пауза: гость один голос из двух — не хватает; хост паузит сразу
    guest.c.send({ t: 'pause', on: true }); await sleep(400);
    let t = host.c.last('tempo'); ok(t.paused === false && t.votes === 1 && t.need === 2, 'голос гостя: ' + JSON.stringify(t));
    host.c.send({ t: 'pause', on: true }); await sleep(400);
    ok(host.c.last('tempo').paused === true && guest.c.last('tempo').paused === true, 'хост не поставил паузу сразу');
    // на паузе строить можно (команда проходит), время стоит
    guest.c.send({ t: 'prio', k: 'tasks', key: 'wood', v: 0 }); await sleep(400);
    ok(host.c.last('prio') && host.c.last('prio').p.tasks.wood === 0, 'приоритет не разослан хосту');
    guest.c.send({ t: 'prio', k: 'tasks', key: 'zzz', v: 0 }); guest.c.send({ t: 'prio', k: 'jobs', key: 'serf', v: 9 }); await sleep(300);
    const p = host.c.last('prio').p; ok(Object.keys(p.tasks).join() === 'wood' && Object.keys(p.jobs).length === 0, 'принят мусор: ' + JSON.stringify(p));
    // снять паузу: хост сразу
    host.c.send({ t: 'pause', on: false }); await sleep(400);
    ok(guest.c.last('tempo').paused === false, 'хост не снял паузу');
    // гость один, голос «за паузу» от двоих
    guest.c.send({ t: 'pause', on: true }); await sleep(200);
    guest.c.close(); await sleep(500);
    const late = await login(port, 'Гость2', '203.0.113.6');
    host.c.close(); late.c.close();
    await sleep(800);
  } catch (e) { fails.push('исключение теста: ' + (e && e.stack || e)); }
  finally { ch.kill(); }
  if (fails.length) console.log(out.slice(-800));
  console.log(fails.length ? `Провалено: ${fails.length}` : 'Кооп-время и приоритеты: OK');
  process.exit(fails.length ? 1 : 0);
})();
