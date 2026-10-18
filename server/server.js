'use strict';
// Сервер кооператива OldGold. Запуск: node server/server.js  (или start-server.bat)
// Один процесс: раздаёт игру по HTTP, принимает игроков по WebSocket и крутит общий мир —
// настоящую симуляцию из js/ (см. simhost.js). Зависимостей нет.
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DATA = process.env.OLDGOLD_DATA ? path.resolve(process.env.OLDGOLD_DATA) : path.join(__dirname, 'data');
const PORT = +process.env.PORT || 8787;
const SAVE_EVERY = 30000;        // общий мир сохраняется раз в 30 секунд
const PAUSE_EMPTY = true;
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

fs.mkdirSync(DATA, { recursive: true });
const WORLD_FILE = path.join(DATA, 'world.json');
const SETTINGS_FILE = path.join(DATA, 'settings.json');
const USERS_FILE = path.join(DATA, 'players.json');
const log = (...a) => console.log(new Date().toLocaleTimeString('ru-RU'), ...a);

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
const run = code => host.run(code);
const SIM_DT = run('SIM_DT');

function loadWorld() {
  for (const f of [WORLD_FILE, WORLD_FILE + '.bak']) {
    if (!fs.existsSync(f)) continue;
    try {
      host.ctx.__saveText = fs.readFileSync(f, 'utf8');
      run('(function(){ const s = JSON.parse(__saveText); __saveText = null; if (s.v !== 2) throw new Error("версия"); applySave(s); })()');
      run('coopDropHeroes(); Game.unlocked = allUnlocked();');
      log('мир загружен из', path.basename(f), '— жителей', run('Game.units.length'), 'зданий', run('Game.buildings.length'));
      return true;
    } catch (e) { log('не вышло прочитать', path.basename(f), e.message); }
  }
  return false;
}
if (!loadWorld()) {
  const seed = (Math.random() * 1e9) | 0;
  run(`setupStart(${seed}); coopDropHeroes(); for (const b of Game.buildings) b.hold = false; Game.unlocked = allUnlocked();`);
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
  if (p === '/coop-info') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify({ coop: true, online: [...conns].filter(c => c.inGame).length })); return; }
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

function frame(op, payload) {
  const len = payload.length;
  let head;
  if (len < 126) head = Buffer.from([0x80 | op, len]);
  else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([head, payload]);
}

class Conn {
  constructor(sock, isHost) {
    this.sock = sock; this.isHost = isHost; this.buf = Buffer.alloc(0); this.frag = []; this.fragOp = 0;
    this.nick = null; this.key = null; this.inGame = false; this.alive = true; this.seen = Date.now();
    sock.on('data', d => this.onData(d));
    sock.on('close', () => this.onClose());
    sock.on('error', () => { try { sock.destroy(); } catch (e) { /* ничего */ } });
  }
  send(obj) { this.sendText(typeof obj === 'string' ? obj : JSON.stringify(obj)); }
  sendText(s) { if (this.alive && !this.sock.destroyed) this.sock.write(frame(1, Buffer.from(s, 'utf8'))); }
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
  conns.add(new Conn(sock, isHost));
});

function broadcast(obj) {
  const s = typeof obj === 'string' ? obj : JSON.stringify(obj);
  for (const c of conns) if (c.inGame) c.sendText(s);
}

// ---------- Сообщения игроков ----------
function joinWorld(c) {
  const rec = users[c.key];
  const uid = call('coopJoin', c.nick, JSON.stringify(rec.hero));
  c.inGame = true;
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
    c.nick = rec.nick; c.key = key;
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
  call('coopCmd', c.nick, text, c.isHost);
}

// ---------- Главный цикл ----------
let last = Date.now(), acc = 0, tU = 0, tW = 0, tMe = 0, tSave = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = Math.min(0.5, (now - last) / 1000);
  last = now;
  const online = [...conns].some(c => c.inGame);
  if (online || !PAUSE_EMPTY) {
    acc += dt;
    let n = 0;
    while (acc >= SIM_DT && n < 20) {
      try { host.ctx.step(SIM_DT); } catch (e) { log('ошибка шага:', e.stack); }
      acc -= SIM_DT; n++;
    }
    if (n >= 20) acc = 0;
  } else acc = 0;
  if (online) {
    tU += dt; tW += dt; tMe += dt;
    if (tU >= 0.2) { tU = 0; broadcast(call('coopUnitsPacket')); }
    if (tW >= 0.5) { tW = 0; const w = call('coopWorldPacket'); if (w) broadcast(w); }
    if (tMe >= 1) { tMe = 0; for (const c of conns) if (c.inGame) { const me = call('coopMeData', c.nick); if (me) c.sendText(me); } }
    const ev = JSON.parse(call('coopDrain'));
    for (const e of ev) {
      const s = JSON.stringify(e.msg);
      for (const c of conns) if (c.inGame && (!e.to || e.to === c.nick)) c.sendText(s);
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
