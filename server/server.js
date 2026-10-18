'use strict';
// Сервер кооператива OldGold. Запуск: node server/server.js  (или start-server.bat)
// Один процесс: раздаёт игру по HTTP, принимает игроков по WebSocket и крутит общий мир —
// настоящую симуляцию из js/ (см. simhost.js). Зависимостей нет.
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const crypto = require('crypto');
const zlib = require('zlib');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DATA = process.env.OLDGOLD_DATA ? path.resolve(process.env.OLDGOLD_DATA) : path.join(__dirname, 'data');
const PORT = +process.env.PORT || 8787;
const SAVE_EVERY = 30000;        // общий мир сохраняется раз в 30 секунд
const PAUSE_EMPTY = true;
const MAX_CONNS = +process.env.OLDGOLD_MAX_CONNS || 80, MAX_PER_IP = +process.env.OLDGOLD_MAX_PER_IP || 12;
// Хост (права игроков, перезапуск) — подключение с этого же компьютера; на VPS за прокси такого нет,
// поэтому хостами можно назначить ники: OLDGOLD_ADMIN="Торин,Аня"
const ADMINS = new Set(String(process.env.OLDGOLD_ADMIN || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));        // пока на сервере никого нет, деревня стоит (чтобы не пропасть без хозяев)

// ---------- Надсмотрщик: перезапуск по команде хоста (код выхода 42) ----------
if (!process.env.OLDGOLD_CHILD) {
  const run = () => {
    const ch = spawn(process.execPath, [__filename, ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, OLDGOLD_CHILD: '1' } });
    ch.on('exit', code => {
      if (code === 42) { console.log('\n=== Перезапуск сервера ===\n'); setTimeout(run, 500); }
      else process.exit(code || 0);
    });
    cur = ch;
  };
  let cur = null;
  // Ctrl+C / systemctl stop: ребёнок сам сохраняет мир и выходит, надсмотрщик ждёт его
  // (в Windows Ctrl+C и так приходит ребёнку, а kill() там убивает без сохранения — не пересылаем)
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => {
    if (!cur || cur.exitCode !== null) process.exit(0);
    else if (process.platform !== 'win32') cur.kill(sig);
  });
  run();
  return;
}

const { createHost } = require('./simhost');
const { createStats, printSummary } = require('./stats');

fs.mkdirSync(DATA, { recursive: true });
const WORLD_FILE = path.join(DATA, 'world.json');
const SETTINGS_FILE = path.join(DATA, 'settings.json');
const USERS_FILE = path.join(DATA, 'players.json');
const VIL_FILE = path.join(DATA, 'village.json');
const log = (...a) => console.log(new Date().toLocaleTimeString('ru-RU'), ...a);

// ---------- Статистика игроков ----------
const stats = createStats(DATA, log);
const events = require('./events').createEvents(DATA, log);
// версия сервера — коммит, из которого он запущен
const SERVER_VER = (() => {
  try {
    const head = fs.readFileSync(path.join(ROOT, '.git', 'HEAD'), 'utf8').trim();
    const ref = head.startsWith('ref: ') ? head.slice(5) : null;
    const sha = ref ? fs.readFileSync(path.join(ROOT, '.git', ref), 'utf8').trim() : head;
    return sha.slice(0, 7);
  } catch (e) { return 'dev'; }
})();
stats.serverVersion(SERVER_VER);
// Сводка по адресу /stats?key=… — ключ из OLDGOLD_STATS_KEY или из файла stats.key в папке данных (создаётся сам)
const STATS_KEY = (() => {
  if (process.env.OLDGOLD_STATS_KEY) return process.env.OLDGOLD_STATS_KEY;
  const f = path.join(DATA, 'stats.key');
  try { return fs.readFileSync(f, 'utf8').trim(); } catch (e) { /* создадим */ }
  const k = crypto.randomBytes(18).toString('base64url');
  try { fs.writeFileSync(f, k + '\n', { mode: 0o600 }); } catch (e) { log('ключ статистики не сохранился:', e.message); }
  return k;
})();
const keyOk = k => { const a = Buffer.from(String(k || '')), b = Buffer.from(STATS_KEY); return a.length === b.length && crypto.timingSafeEqual(a, b); };

// ---------- Аккаунты ----------
let users = {};
try { users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch (e) { users = {}; }
function saveUsers() {
  const tmp = USERS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(users));
  fs.renameSync(tmp, USERS_FILE);
}
const hashPass = (pass, salt) => crypto.scryptSync(pass, salt, 32).toString('hex');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const nickOk = n => typeof n === 'string' && /^[\p{L}\p{N}_\- ]{2,16}$/u.test(n) && n.trim() === n;

// ---------- Мир ----------
const host = createHost(log);
// права игроков (админ-панель хоста) хранятся отдельно от мира
try { host.ctx.coopSetPerms(JSON.stringify(JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')).perms || {})); } catch (e) { /* прав ещё нет — всё разрешено */ }
const call = (fn, ...args) => host.ctx[fn](...args);
try { host.ctx.coopStateSet(fs.readFileSync(VIL_FILE, 'utf8')); } catch (e) { /* серий и рекордов ещё нет */ }
const run = code => host.run(code);
const SIM_DT = run('SIM_DT');

function loadWorld() {
  for (const f of [WORLD_FILE, WORLD_FILE + '.bak']) {
    if (!fs.existsSync(f)) continue;
    try {
      host.ctx.__saveText = fs.readFileSync(f, 'utf8');
      run('(function(){ const s = JSON.parse(__saveText); __saveText = null; if (s.v !== 2) throw new Error("версия"); applySave(s); })()');
      run('coopDropHeroes(); coopInitUnlocks();');
      log('мир загружен из', path.basename(f), '— жителей', run('Game.units.length'), 'зданий', run('Game.buildings.length'));
      return true;
    } catch (e) { log('не вышло прочитать', path.basename(f), e.message); }
  }
  return false;
}
if (!loadWorld()) {
  const seed = (Math.random() * 1e9) | 0;
  run(`setupStart(${seed}); coopDropHeroes(); for (const b of Game.buildings) b.hold = false; coopInitUnlocks();`);
  log('создан новый мир, зерно', seed);
}

function saveWorld() {
  try {
    const text = run('JSON.stringify(serializeGame())');
    const tmp = WORLD_FILE + '.tmp';
    fs.writeFileSync(tmp, text);
    if (fs.existsSync(WORLD_FILE)) fs.copyFileSync(WORLD_FILE, WORLD_FILE + '.bak');
    fs.renameSync(tmp, WORLD_FILE);
    flushHeroes();
    try { fs.writeFileSync(VIL_FILE, call('coopStateGet')); } catch (e) { log('серии ночей не сохранились:', e.message); }
    stats.save();
    return true;
  } catch (e) { log('сохранение мира не удалось:', e.message); return false; }
}

// герои и инвентарь игроков — в аккаунты
function flushHeroes() {
  for (const c of conns) {
    if (!c.inGame) continue;
    const d = call('coopHeroData', c.nick);
    if (d) users[c.key].hero = JSON.parse(d);
  }
  saveUsers();
}

// ---------- HTTP ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/coop-info' && /metrics|digest/.test(req.url) && /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(req.socket.remoteAddress || '') && !req.headers['x-forwarded-for']) {
    const q = new URL(req.url, 'http://x').searchParams;
    const out = q.has('metrics') ? metricsSnap() : digest();
    if (q.has('reset')) metricsReset();
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(out)); return;
  }
  if (p === '/coop-info') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify({ coop: true, online: [...conns].filter(c => c.inGame).length })); return; }
  if (events.handle(req, res, req.socket.remoteAddress || '')) return;
  if (p === '/stats') {
    const q = new URL(req.url, 'http://x').searchParams;
    if (!keyOk(q.get('key'))) { res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('нужен ключ: /stats?key=… (он в файле stats.key в папке данных сервера)'); return; }
    stats.save(); events.save();
    const x = stats.summary();
    if (q.has('json')) { res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ ...x, solo: events.summary() }, null, 2)); }
    else { res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(printSummary(x) + '\n\n' + events.printSummary(events.summary()) + '\n\nСервер: ' + SERVER_VER + '\n'); }
    return;
  }
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  const rel = path.relative(ROOT, file);
  if (rel.startsWith('..') || /^(server|\.git|\.claude)([\\/]|$)/.test(rel) || /(^|[\\/])\./.test(rel) || /coopsim\.js$/.test(rel)) { res.writeHead(404); res.end('нет'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); res.end('нет'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
});

// ---------- Мини-WebSocket ----------
const conns = new Set();
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

// Большие сообщения сжимаются deflate (JSON ужимается в 5–10 раз) и идут бинарным кадром — только клиентам, которые это умеют (z в auth)
const ZMIN = 600;
function pack(text, z) {
  const raw = Buffer.from(text, 'utf8');
  if (z && raw.length >= ZMIN) {
    const t0 = performance.now();
    const c = zlib.deflateRawSync(raw, { level: 1 });
    M.zMs += performance.now() - t0; M.zIn += raw.length; M.zOut += c.length;
    return frame(2, c);
  }
  return frame(1, raw);
}

function frame(op, payload) {
  const len = payload.length;
  let head;
  if (len < 126) head = Buffer.from([0x80 | op, len]);
  else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([head, payload]);
}

class Conn {
  constructor(sock, isHost, ip, origin) {
    this.sock = sock; this.isHost = isHost; this.ip = ip; this.origin = origin; this.buf = Buffer.alloc(0); this.frag = []; this.fragOp = 0;
    this.z = false; this.nick = null; this.key = null; this.inGame = false; this.alive = true; this.seen = Date.now();
    sock.on('data', d => this.onData(d));
    sock.on('close', () => this.onClose());
    sock.on('error', () => { try { sock.destroy(); } catch (e) { /* ничего */ } });
  }
  send(obj) { this.sendText(typeof obj === 'string' ? obj : JSON.stringify(obj)); }
  sendText(s) { this.sendFrame(typeof s === 'string' ? pack(s, this.z) : s); }
  sendFrame(f) {
    if (!this.alive || this.sock.destroyed) return;
    // клиент не успевает читать (в буфере больше 4 МБ) — отключаем, иначе память сервера растёт без предела
    if (this.sock.writableLength > 4 << 20) { this.sock.destroy(); return; }
    M.bytesOut += f.length; M.msgsOut++;
    this.sock.write(f);
  }
  onData(d) {
    this.seen = Date.now();
    this.buf = Buffer.concat([this.buf, d]);
    for (;;) {
      const b = this.buf;
      if (b.length < 2) return;
      const op = b[0] & 0x0f, fin = !!(b[0] & 0x80), masked = !!(b[1] & 0x80);
      let len = b[1] & 0x7f, off = 2;
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
      if (len > 1 << 20) { this.sock.destroy(); return; }
      if (b.length < off + (masked ? 4 : 0) + len) return;
      let payload;
      if (masked) {
        const mask = b.subarray(off, off + 4);
        payload = Buffer.from(b.subarray(off + 4, off + 4 + len));
        for (let i = 0; i < len; i++) payload[i] ^= mask[i & 3];
        off += 4;
      } else payload = Buffer.from(b.subarray(off, off + len));
      this.buf = b.subarray(off + len);
      if (op === 8) { this.sock.end(frame(8, Buffer.alloc(0))); return; }
      if (op === 9) { this.sock.write(frame(10, payload)); continue; }
      if (op === 10) continue;
      if (op === 1 || op === 2) { this.frag = [payload]; this.fragOp = op; } else if (op === 0) this.frag.push(payload);
      if (fin && this.frag.length) {
        const text = Buffer.concat(this.frag).toString('utf8');
        this.frag = [];
        try { onMessage(this, text); } catch (e) { log('ошибка в сообщении:', e.stack); }
      }
    }
  }
  onClose() {
    if (!this.alive) return;
    this.alive = false;
    conns.delete(this);
    if (this.inGame) {
      stats.leave(this.key);
      const d = call('coopLeave', this.nick);
      if (d) users[this.key].hero = JSON.parse(d);
      saveUsers();
      broadcast({ t: 'toast', text: `${this.nick} покидает деревню` });
      log('вышел', this.nick);
    }
  }
}

server.on('upgrade', (req, sock) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { sock.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  sock.setNoDelay(true);
  const addr = sock.remoteAddress || '';
  const isHost = /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(addr) && !req.headers['x-forwarded-for'];
  // настоящий адрес игрока за прокси — только для хэша в статистике, в открытом виде не хранится
  const ip = String(req.headers['x-forwarded-for'] || addr).split(',')[0].trim();
  // потолок соединений: лишних отсекаем сразу, чтобы не съесть память
  if (conns.size >= MAX_CONNS || (!isHost && [...conns].filter(o => o.ip === ip).length >= MAX_PER_IP)) { sock.end(frame(8, Buffer.from([0x03, 0xf3]))); return; }
  conns.add(new Conn(sock, isHost, ip, req.headers.origin || ''));
});

// Метрики нагрузки: время шага и сборки пакетов, исходящий трафик (отдаются на /coop-info?metrics=1 только с loopback)
const M = { ticks: 0, stepMs: 0, stepMax: 0, uMs: 0, uMax: 0, wMs: 0, wMax: 0, loopMax: 0, bytesOut: 0, msgsOut: 0, zMs: 0, zIn: 0, zOut: 0, lag: 0, since: Date.now() };
function metricsReset() { Object.assign(M, { ticks: 0, stepMs: 0, stepMax: 0, uMs: 0, uMax: 0, wMs: 0, wMax: 0, loopMax: 0, bytesOut: 0, msgsOut: 0, lag: 0, uN: 0, wN: 0, since: Date.now() }); }
function metricsSnap() {
  const sec = Math.max(0.001, (Date.now() - M.since) / 1000), mu = process.memoryUsage();
  return {
    sec: +sec.toFixed(1), online: [...conns].filter(c => c.inGame).length, conns: conns.size,
    stepAvgMs: +(M.stepMs / Math.max(1, M.ticks)).toFixed(2), stepMaxMs: +M.stepMax.toFixed(1),
    unitsPktAvgMs: +(M.uMs / Math.max(1, M.uN || 1)).toFixed(2), unitsPktMaxMs: +M.uMax.toFixed(1),
    worldPktAvgMs: +(M.wMs / Math.max(1, M.wN || 1)).toFixed(2), worldPktMaxMs: +M.wMax.toFixed(1),
    zipMs: +M.zMs.toFixed(0), zipRatio: M.zOut ? +(M.zIn / M.zOut).toFixed(1) : 0, loopLagMaxMs: +M.loopMax.toFixed(1), outKBps: +(M.bytesOut / 1024 / sec).toFixed(1), outMsgsPerSec: +(M.msgsOut / sec).toFixed(1),
    rssMB: +(mu.rss / 1048576).toFixed(1), heapMB: +(mu.heapUsed / 1048576).toFixed(1),
    units: run('Game.units.length'), buildings: run('Game.buildings.length'),
  };
}
function digest() { return JSON.parse(run('JSON.stringify({ roads: World.road.reduce((a, v) => a + v, 0), buildings: Game.buildings.length, bids: Game.buildings.map(b => b.id).sort((a, b) => a - b).join(","), objs: World.obj.filter(Boolean).length })')); }

function broadcast(obj, to) {
  const s = typeof obj === 'string' ? obj : JSON.stringify(obj);
  let plain, zipped;   // каждый вариант кадра собираем один раз на всех
  for (const c of conns) {
    if (!c.inGame || (to && to !== c.nick)) continue;
    if (c.z) c.sendFrame(zipped || (zipped = pack(s, true))); else c.sendFrame(plain || (plain = pack(s, false)));
  }
}

// ---------- Сообщения игроков ----------
function joinWorld(c) {
  const rec = users[c.key];
  const uid = call('coopJoin', c.nick, JSON.stringify(rec.hero));
  c.inGame = true;
  stats.join(c.key, c.nick, { cls: rec.hero && rec.hero.cls, ip: c.ip, ver: c.ver, from: c.origin });
  c.sendText(call('coopInitPacket', uid));
  const me = call('coopMeData', c.nick);
  if (me) c.sendText(me);
  log('вошёл', c.nick, c.isHost ? '(хост)' : '');
}

function onMessage(c, text) {
  let m;
  try { m = JSON.parse(text); } catch (e) { return; }
  if (!c.nick) {
    if (m.t !== 'auth') return;
    const nick = String(m.nick || '').trim(), pass = String(m.pass || '');
    if (!nickOk(nick)) return c.send({ t: 'err', msg: 'Ник: 2–16 символов, буквы, цифры, пробел, _ и -' });
    if (m.mode !== 'token' && (pass.length < 3 || pass.length > 64)) return c.send({ t: 'err', msg: 'Пароль: от 3 символов' });
    const key = nick.toLowerCase();
    let rec = users[key];
    if (m.mode === 'register') {
      if (rec) return c.send({ t: 'err', msg: 'Такой ник уже занят' });
      const salt = crypto.randomBytes(16).toString('hex');
      rec = users[key] = { nick, salt, hash: hashPass(pass, salt), hero: null, created: Date.now() };
      saveUsers();
    } else if (m.mode === 'token') {
      if (!rec || !(rec.toks || []).includes(sha(String(m.token || '')))) return c.send({ t: 'err', msg: 'Сессия устарела — войдите по паролю', stale: true });
    } else {
      if (!rec) return c.send({ t: 'err', msg: 'Такого игрока нет — сначала зарегистрируйтесь' });
      if (hashPass(pass, rec.salt) !== rec.hash) return c.send({ t: 'err', msg: 'Неверный пароль' });
    }
    // тот же игрок с другой вкладки или после обрыва связи: старое соединение уступает новому
    for (const o of conns) if (o !== c && o.key === key) {
      o.send({ t: 'kicked', msg: 'Вы вошли в деревню с другого окна или устройства' });
      try { o.sock.end(); } catch (e) { /* ничего */ }
      o.onClose();
    }
    c.nick = rec.nick; c.key = key; c.ver = typeof m.ver === 'string' ? m.ver.slice(0, 40) : ''; c.z = m.z === 1;
    if (ADMINS.has(key)) c.isHost = true;
    let token;
    if (m.mode !== 'token') { token = crypto.randomBytes(24).toString('hex'); rec.toks = [...(rec.toks || []).slice(-4), sha(token)]; saveUsers(); }   // запомнить вход на этом устройстве
    const meta = JSON.parse(call('coopMeta'));
    c.send({ t: 'welcome', token, nick: c.nick, host: c.isHost, perms: meta.perms, permLabels: meta.permLabels, needClass: !rec.hero, classes: meta.classes, chat: meta.chat });
    if (rec.hero) joinWorld(c);
    return;
  }
  if (m.t === 'class') {
    const rec = users[c.key];
    if (rec.hero || c.inGame) return;
    const meta = JSON.parse(call('coopMeta'));
    if (!meta.classes[m.cls]) return;
    rec.hero = { cls: m.cls, level: 1, hp: meta.classes[m.cls].hp, inv: [{ k: 'bread', n: 2 }], look: (Math.random() * 1000) | 0 };
    saveUsers();
    joinWorld(c);
    return;
  }
  if (!c.inGame) return;
  if (m.t === 'restart') {
    if (!c.isHost || m.confirm !== true) return c.send({ t: 'toast', text: 'Перезапустить сервер может только хост' });
    log('хост запросил перезапуск');
    broadcast({ t: 'restarting' });
    saveWorld();
    setTimeout(() => process.exit(42), 300);
    return;
  }
  if (m.t === 'stats') {
    if (!c.isHost) return c.send({ t: 'toast', text: 'Статистику видит только хост' });
    stats.save();
    c.send({ t: 'stats', s: stats.summary(), server: SERVER_VER });
    return;
  }
  if (m.t === 'setperm') {
    if (!c.isHost) return c.send({ t: 'toast', text: 'Права меняет только хост' });
    const cur = JSON.parse(call('coopMeta')).perms;
    if (!(m.key in cur) || typeof m.on !== 'boolean') return;
    const now = JSON.parse(call('coopSetPerms', JSON.stringify({ [m.key]: m.on })));
    try { fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ perms: now })); } catch (e) { log('права не сохранились:', e.message); }
    broadcast({ t: 'perms', perms: now });
    log('права:', m.key, m.on ? 'вкл' : 'выкл');
    return;
  }
  // защита от заливания командами (залипшая мышь, кривой клиент): ведро на 60 сообщений, 30 в секунду
  const nowMs = Date.now();
  c.bucket = Math.min(60, (c.bucket ?? 60) + (nowMs - (c.bucketAt || nowMs)) / 1000 * 30);
  c.bucketAt = nowMs;
  if (c.bucket < 1) { if (!c.warned || nowMs - c.warned > 5000) { c.warned = nowMs; c.send({ t: 'toast', text: 'Слишком много команд подряд — чуть помедленнее' }); } return; }
  c.bucket--;
  call('coopCmd', c.nick, text, c.isHost);
}

// ---------- Главный цикл ----------
let last = Date.now(), acc = 0, tU = 0, tW = 0, tMe = 0, tSave = Date.now();
setInterval(() => {
  const now = Date.now();
  M.loopMax = Math.max(M.loopMax, now - last - 50);
  const dt = Math.min(0.5, (now - last) / 1000);
  last = now;
  const online = [...conns].some(c => c.inGame);
  if (online || !PAUSE_EMPTY) {
    acc += dt;
    let n = 0;
    const t0 = performance.now();
    while (acc >= SIM_DT && n < 20) {
      try { host.ctx.step(SIM_DT); } catch (e) { log('ошибка шага:', e.stack); }
      acc -= SIM_DT; n++;
    }
    if (n) { const ms = (performance.now() - t0) / n; M.ticks += n; M.stepMs += ms * n; M.stepMax = Math.max(M.stepMax, ms); }
    if (n >= 20) acc = 0;
  } else acc = 0;
  if (online) {
    tU += dt; tW += dt; tMe += dt;
    if (tU >= 0.2) { tU = 0; const t1 = performance.now(); const p = call('coopUnitsPacket'); const ms = performance.now() - t1; M.uN = (M.uN || 0) + 1; M.uMs += ms; M.uMax = Math.max(M.uMax, ms); broadcast(p); }
    if (tW >= 0.5) { tW = 0; const t1 = performance.now(); const w = call('coopWorldPacket'); const ms = performance.now() - t1; M.wN = (M.wN || 0) + 1; M.wMs += ms; M.wMax = Math.max(M.wMax, ms); if (w) broadcast(w); }
    if (tMe >= 1) { tMe = 0; for (const c of conns) if (c.inGame) { const me = call('coopMeData', c.nick); if (me) c.sendText(me); } }
    const ev = JSON.parse(call('coopDrain'));
    for (const e of ev) {
      broadcast(e.msg, e.to);
    }
  } else call('coopDrain');
  if (now - tSave >= SAVE_EVERY) { tSave = now; if (saveWorld() && online) broadcast({ t: 'saved' }); }
}, 50);

// Пинг: браузер сам отвечает на него, а молчащее больше минуты соединение (сон ноутбука, обрыв Wi-Fi) закрываем —
// иначе герой висит в деревне, а игрок не может зайти снова
setInterval(() => {
  const now = Date.now();
  for (const c of conns) {
    if (now - c.seen > 60000) { try { c.sock.destroy(); } catch (e) { /* ничего */ } c.onClose(); }
    else if (!c.sock.destroyed) c.sock.write(frame(9, Buffer.alloc(0)));
  }
}, 20000);

function shutdown() { log('остановка, сохраняю мир…'); saveWorld(); process.exit(0); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(PORT, process.env.HOST || '0.0.0.0', () => {
  log(`Сервер OldGold запущен на порту ${PORT}`);
  log(`Хост играет здесь:  http://localhost:${PORT}/`);
  for (const list of Object.values(os.networkInterfaces()))
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) log(`Друзьям в сети:     http://${a.address}:${PORT}/`);
  log(`Данные: ${DATA}`);
});
