'use strict';
// Проверка кооп-сервера: запускается на временной папке данных и свободном порту, затем
//  · раздаёт index.html и КАЖДЫЙ подключённый в нём файл (нет 404 после переездов по папкам),
//  · не раздаёт server/ и coopsim.js,
//  · принимает отчёт об ошибке POST /err и событие POST /e,
//  · /stats без ключа — 403, с ключом — сводка с разделом ошибок.
// Запуск: node tests/server-test.js   (печатает ✗/⚠ строки, код выхода 1 при провале)
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
const fails = [], info = [];

function req(port, method, p, body) {
  return new Promise(res => {
    const r = http.request({ host: '127.0.0.1', port, method, path: p, headers: body ? { 'Content-Type': 'text/plain' } : {} }, rs => {
      let s = ''; rs.setEncoding('utf8'); rs.on('data', d => s += d); rs.on('end', () => res({ status: rs.statusCode, body: s }));
    });
    r.on('error', e => res({ status: 0, body: e.message }));
    if (body) r.write(body);
    r.end();
  });
}

(async () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'oldgold-test-'));
  const port = 20000 + Math.floor(Math.random() * 20000);
  const ch = spawn(process.execPath, [path.join(ROOT, 'server', 'server.js')], {
    env: { ...process.env, OLDGOLD_DATA: data, PORT: String(port), HOST: '127.0.0.1', OLDGOLD_CHILD: '1', OLDGOLD_STATS_KEY: 'testkey' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  ch.stdout.on('data', d => out += d); ch.stderr.on('data', d => out += d);
  const t0 = Date.now();
  let up = false;
  while (Date.now() - t0 < 60000) {
    const r = await req(port, 'GET', '/coop-info');
    if (r.status === 200) { up = true; break; }
    if (ch.exitCode !== null) break;
    await new Promise(r2 => setTimeout(r2, 300));
  }
  try {
    if (!up) { fails.push('сервер не поднялся за 60 с:\n' + out.slice(-1500)); return; }
    info.push(`сервер поднялся за ${((Date.now() - t0) / 1000).toFixed(1)} с`);
    const idx = await req(port, 'GET', '/');
    if (idx.status !== 200 || !/<script/.test(idx.body)) fails.push('/ не отдаёт index.html: ' + idx.status);
    const refs = [...idx.body.matchAll(/<(?:script|link|img)\b[^>]*\b(?:src|href)="([^"#]+)"/g)].map(m => m[1]).filter(u => !/^(https?:|data:|\/\/)/.test(u));
    let bad = 0;
    for (const u of refs) { const r = await req(port, 'GET', '/' + u.replace(/^\.?\//, '')); if (r.status !== 200) { bad++; fails.push(`404: ${u} (${r.status})`); } }
    info.push(`раздаётся ${refs.length - bad} из ${refs.length} файлов страницы`);
    for (const p of ['/server/server.js', '/js/coop/coopsim.js', '/.git/HEAD']) { const r = await req(port, 'GET', p); if (r.status === 200) fails.push('сервер раздаёт закрытый файл ' + p); }
    const e1 = await req(port, 'POST', '/err', JSON.stringify({ v: 'test', k: 'error', m: 'TypeError: x is undefined', f: 'js/main.js:10:5', st: ['js/main.js:10'], ph: 'game', br: 'Chrome 130', os: 'Android 14', mob: 1 }));
    if (e1.status !== 204) fails.push('POST /err не принят: ' + e1.status);
    const e2 = await req(port, 'POST', '/err', 'не json');
    if (e2.status !== 400) fails.push('POST /err с мусором должен быть 400, а не ' + e2.status);
    const big = await req(port, 'POST', '/err', 'x'.repeat(10000));
    if (big.status !== 413) fails.push('большой POST /err должен быть 413, а не ' + big.status);
    const ev = await req(port, 'POST', '/e', JSON.stringify({ c: 'abcdefgh12', e: ['start-desktop'] }));
    if (ev.status !== 204) fails.push('POST /e не принят: ' + ev.status);
    const s0 = await req(port, 'GET', '/stats');
    if (s0.status !== 403) fails.push('/stats без ключа должен быть 403, а не ' + s0.status);
    const s1 = await req(port, 'GET', '/stats?key=testkey');
    if (s1.status !== 200 || !/Ошибки у игроков/.test(s1.body) || !/x is undefined/.test(s1.body)) fails.push('/stats не показывает ошибку из отчёта:\n' + s1.body.slice(-600));
    const s2 = await req(port, 'GET', '/stats?key=testkey&json=1');
    try { const j = JSON.parse(s2.body); if (!j.errors || j.errors.reports < 1) fails.push('/stats?json без errors'); } catch (e) { fails.push('/stats?json не JSON'); }
    // соединение, закрытое клиентом без прощального кадра, не должно висеть в списке (http-сервер держит сокеты полуоткрытыми)
    {
      const net = require('net');
      const sk = net.connect(port, '127.0.0.1');
      await new Promise(r => sk.once('connect', r));
      sk.write(`GET / HTTP/1.1
Host: x
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13

`);
      await new Promise(r => sk.once('data', r));
      const n1 = JSON.parse((await req(port, 'GET', '/coop-info?metrics=1')).body).conns;
      sk.destroy();
      await new Promise(r => setTimeout(r, 600));
      const n2 = JSON.parse((await req(port, 'GET', '/coop-info?metrics=1')).body).conns;
      if (n1 !== 1 || n2 !== 0) fails.push(`оборванное соединение осталось в списке (было ${n1}, стало ${n2})`);
      else info.push('оборванное соединение убирается сразу');
    }
    if (/ошибка шага/.test(out)) fails.push('в логе сервера ошибки шага:\n' + out.split('\n').filter(l => /ошибка шага/.test(l)).slice(0, 3).join('\n'));
  } finally {
    ch.kill();
    await new Promise(r => setTimeout(r, 300));
    try { fs.rmSync(data, { recursive: true, force: true }); } catch (e) { /* временная папка */ }
    for (const m of info) console.log('Сервер: ' + m);
    for (const m of fails) console.log('  ✗ ' + m);
    console.log(fails.length ? `ОШИБОК: ${fails.length}` : 'OK');
    process.exit(fails.length ? 1 : 0);
  }
})();
