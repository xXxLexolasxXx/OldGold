'use strict';
// Общее для нагрузочных сценариев кооп-сервера: запуск локального сервера, WebSocket-боты без зависимостей, метрики.
// Боты ходят ТОЛЬКО на локальный сервер, который поднимает сам тест (временная папка данных, свободный порт).
const net = require('net');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const r1 = v => Math.round(v * 10) / 10;

function getJson(port, p) {
  return new Promise((res, rej) => {
    const rq = http.get({ host: '127.0.0.1', port, path: p, timeout: 15000 }, r => {
      let s = ''; r.on('data', d => s += d); r.on('end', () => { try { res(JSON.parse(s)); } catch (e) { rej(e); } });
    });
    rq.on('error', rej); rq.on('timeout', () => { rq.destroy(new Error('таймаут')); });
  });
}

// ---------- Сервер ----------
// opts: speed (ускорение времени), env (доп. переменные), data (папка данных; по умолчанию новая), port, keep (не удалять папку)
async function startServer(opts = {}) {
  const data = opts.data || fs.mkdtempSync(path.join(os.tmpdir(), 'oldgold-load-'));
  const port = opts.port || 21000 + Math.floor(Math.random() * 15000);
  const env = {
    ...process.env, OLDGOLD_DATA: data, PORT: String(port), HOST: '127.0.0.1', OLDGOLD_CHILD: '1', OLDGOLD_STATS_KEY: 'loadtest',
    OLDGOLD_STRESS: '1', OLDGOLD_SPEED: String(opts.speed || 1), ...(opts.env || {}),
  };
  const args = ['--expose-gc', ...(opts.nodeArgs || []), path.join(ROOT, 'server', 'server.js')];
  const proc = spawn(process.execPath, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
  const srv = { port, data, proc, url: `ws://127.0.0.1:${port}`, log: '', exited: null };
  proc.stdout.on('data', d => { srv.log += d; if (srv.log.length > 400000) srv.log = srv.log.slice(-200000); });
  proc.stderr.on('data', d => { srv.log += d; });
  proc.on('exit', code => { srv.exited = code; });
  const t0 = Date.now();
  for (;;) {
    if (srv.exited !== null) throw new Error('сервер не запустился:\n' + srv.log.slice(-1200));
    try { await getJson(port, '/coop-info'); break; } catch (e) { /* ещё грузится */ }
    if (Date.now() - t0 > 90000) throw new Error('сервер не поднялся за 90 с:\n' + srv.log.slice(-1200));
    await sleep(250);
  }
  srv.startMs = Date.now() - t0;
  srv.metrics = (reset, gc) => getJson(port, '/coop-info?metrics=1' + (reset ? '&reset=1' : '') + (gc ? '&gc=1' : ''));
  srv.info = () => getJson(port, '/coop-info');
  srv.stop = async (signal = 'SIGTERM', rm = true) => {
    if (srv.exited === null) {
      // в Windows kill() убивает без сохранения мира — для тестов этого достаточно; мир сохраняется раз в 30 с
      srv.proc.kill(signal);
      for (let i = 0; i < 40 && srv.exited === null; i++) await sleep(100);
      if (srv.exited === null) srv.proc.kill('SIGKILL');
    }
    if (rm && !opts.keep) { try { fs.rmSync(data, { recursive: true, force: true }); } catch (e) { /* временная папка */ } }
  };
  return srv;
}

// ---------- Бот ----------
const CLASSES = ['warrior', 'barbarian', 'mage', 'archer', 'druid', 'rogue', 'monk', 'priest'];
const TYPES = ['woodcutter', 'quarry', 'farm', 'sawmill', 'mill', 'bakery', 'swine', 'goatpen', 'brewery', 'hopfarm'];
let botSeq = 0;
const RUN = crypto.randomBytes(2).toString('hex');

class Bot {
  // o: port, nick, z (сжатие, по умолчанию да), ver, fakeIp (притвориться удалённым игроком — иначе сервер считает бота хостом),
  //    parseU (разбирать пакеты жителей — нужно, чтобы знать свою позицию), keepAlive (отвечать на пинг; false — «зомби»)
  constructor(o = {}) {
    this.o = { z: 1, ver: 'loadtest', fakeIp: null, parseU: false, ...o };
    this.i = botSeq++;
    this.nick = o.nick || `lt${RUN}${this.i}`;
    this.pass = 'loadtest1';
    this.token = null;
    this.cls = o.cls || CLASSES[this.i % CLASSES.length];
    this.sock = null; this.buf = Buffer.alloc(0); this.frag = []; this.fragOp = 0;
    this.inGame = false; this.alive = false; this.closedAt = 0;
    this.home = [40, 30]; this.me = null; this.pos = null; this.uid = null;
    this.reset();
  }
  reset() {
    this.bytesIn = 0; this.msgs = 0; this.byT = {}; this.gaps = []; this.uAt = 0; this.errors = []; this.toasts = 0; this.kicked = null; this.lastErr = null;
    this.joinMs = []; this.initBytes = 0; this.initWire = 0; this.parseMs = 0; this.closeCode = null; this.refusals = 0;
  }
  connect() {
    return new Promise((resolve, reject) => {
      const key = crypto.randomBytes(16).toString('base64');
      const s = this.sock = net.connect(this.o.port, '127.0.0.1');
      s.setNoDelay(true);
      this.buf = Buffer.alloc(0); this.frag = []; this.inGame = false; this.alive = true; this.closeCode = null;
      const ip = this.o.fakeIp ? `X-Forwarded-For: ${this.o.fakeIp}\r\n` : '';
      let upgraded = false;
      s.on('connect', () => s.write(`GET / HTTP/1.1\r\nHost: 127.0.0.1:${this.o.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n${ip}\r\n`));
      s.on('data', d => {
        this.buf = Buffer.concat([this.buf, d]);
        if (!upgraded) {
          const e = this.buf.indexOf('\r\n\r\n');
          if (e < 0) return;
          if (!/ 101 /.test(this.buf.subarray(0, 30).toString())) return reject(new Error('нет апгрейда'));
          this.buf = this.buf.subarray(e + 4); upgraded = true; resolve();
        }
        if (!this.o.paused) this.parse();
      });
      s.on('error', e => { if (!upgraded) reject(e); });
      s.on('close', () => { this.alive = false; this.inGame = false; this.closedAt = Date.now(); this.onClosed && this.onClosed(); });
    });
  }
  parse() {
    for (;;) {
      const b = this.buf;
      if (b.length < 2) return;
      const op = b[0] & 0x0f, fin = !!(b[0] & 0x80);
      let len = b[1] & 0x7f, off = 2;
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
      if (b.length < off + len) return;
      const payload = Buffer.from(b.subarray(off, off + len));
      this.buf = b.subarray(off + len);
      this.bytesIn += off + len;
      if (op === 9) { if (this.o.keepAlive !== false) this.raw(10, payload); continue; }
      if (op === 8) { this.closeCode = payload.length >= 2 ? payload.readUInt16BE(0) : 0; try { this.sock.end(); } catch (e) { /* ничего */ } return; }
      if (op === 2) this.frag = [zlib.inflateRawSync(payload)]; else if (op === 1) this.frag = [payload]; else if (op === 0) this.frag.push(payload);
      if (fin && this.frag.length) { const t = Buffer.concat(this.frag).toString('utf8'); this.onText(t, off + len); this.frag = []; }
    }
  }
  raw(op, payload) {
    if (!this.sock || this.sock.destroyed) return;
    const len = payload.length, mask = crypto.randomBytes(4);
    let head;
    if (len < 126) head = Buffer.from([0x80 | op, 0x80 | len]);
    else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 0x80 | 126; head.writeUInt16BE(len, 2); }
    else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 0x80 | 127; head.writeBigUInt64BE(BigInt(len), 2); }
    const body = Buffer.from(payload);
    for (let i = 0; i < len; i++) body[i] ^= mask[i & 3];
    this.sock.write(Buffer.concat([head, mask, body]));
  }
  send(o) { this.raw(1, Buffer.from(typeof o === 'string' ? o : JSON.stringify(o))); }
  onText(text, wire) {
    this.msgs++;
    const ty = (text.slice(0, 14).match(/"t":"(\w+)"/) || [0, '?'])[1];
    const e = this.byT[ty] || (this.byT[ty] = [0, 0, 0]);
    e[0]++; e[1] += text.length; e[2] += wire;
    if (ty === 'u') {
      const now = Date.now();
      if (this.uAt) this.gaps.push(now - this.uAt);
      this.uAt = now;
      if (this.o.parseU && this.uid != null) {
        const m = JSON.parse(text);
        const me = m.units.find(u => u.i === this.uid);
        if (me) this.pos = [me.x, me.y];
      }
      return;
    }
    if (ty === 'w' || ty === 'tempo' || ty === 'saved') return;
    const t0 = process.hrtime.bigint();
    const m = JSON.parse(text);
    this.parseMs += Number(process.hrtime.bigint() - t0) / 1e6;
    switch (m.t) {
      case 'welcome':
        if (m.token) this.token = m.token;
        this.welcome = m;
        if (m.needClass) this.send({ t: 'class', cls: this.cls });
        break;
      case 'err':
        this.lastErr = m; this.errors.push(m.msg); if (m.full) this.refusals++;
        if (m.stale) this.token = null;
        this.onErr && this.onErr(m);
        break;
      case 'kicked': this.kicked = m.msg; break;
      case 'init': {
        this.initBytes = text.length; this.initWire = wire;
        const st = m.world.buildings.find(b => b.type === 'storehouse');
        if (st) this.home = [st.x + 2, st.y + 5];
        this.uid = m.uid; this.inGame = true; this.uAt = 0;
        if (this.joinT0) { this.joinMs.push(Date.now() - this.joinT0); this.joinT0 = 0; }
        this.onInit && this.onInit(m);
        break;
      }
      case 'me': this.me = m; break;
      case 'toast': this.toasts++; break;
    }
  }
  // Войти. mode: register | login | token. Возвращает { ok, ms, err } — err это последнее сообщение 'err' сервера (или null)
  async login(mode, timeoutMs = 30000) {
    const m = mode || (this.token ? 'token' : this.registered ? 'login' : 'register');
    this.lastErr = null;
    try { await this.connect(); } catch (e) { return { ok: false, ms: 0, err: { msg: 'connect: ' + e.message } }; }
    this.joinT0 = Date.now();
    this.send({ t: 'auth', mode: m, nick: this.nick, pass: this.pass, token: this.token, ver: this.o.ver, z: this.o.z });
    this.registered = true;
    const t0 = Date.now();
    while (!this.inGame && !this.lastErr && this.alive && Date.now() - t0 < timeoutMs) await sleep(20);
    return { ok: this.inGame, ms: Date.now() - t0, err: this.lastErr, closed: !this.alive };
  }
  rnd(n) { return Math.floor(Math.random() * n); }
  act() {
    if (!this.inGame) return;
    const [hx, hy] = this.home, r = Math.random();
    const near = R => [hx + this.rnd(2 * R + 1) - R, hy + this.rnd(2 * R + 1) - R];
    if (r < 0.35) { const [x, y] = near(12); this.send({ t: 'go', x, y }); }
    else if (r < 0.5) this.send({ t: 'chat', i: this.rnd(6) });
    else if (r < 0.7) { const [x, y] = near(14); this.send({ t: 'build', type: TYPES[this.rnd(TYPES.length)], x, y, rot: 0 }); }
    else if (r < 0.88) {
      const [x, y] = near(10), cells = [], dir = this.rnd(2);
      for (let k = 0; k < 6 + this.rnd(10); k++) cells.push(dir ? [x + k, y] : [x, y + k]);
      this.send({ t: 'road', cells });
    } else if (r < 0.95) { const [x, y] = near(10); this.send({ t: 'field', mode: 'add', crop: 'wheat', cells: [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]] }); }
    else { const [x, y] = near(8); this.send({ t: 'erase', cells: [[x, y]] }); }
  }
  // обрыв без прощания (выдернули кабель / закрыли крышку): сокет рвётся сразу
  drop() { try { this.sock.destroy(); } catch (e) { /* ничего */ } this.inGame = false; this.alive = false; }
  // «зомби»: сеть пропала молча — клиент перестаёт читать и отвечать на пинги, но сокет открыт
  freeze() { this.o.paused = true; this.o.keepAlive = false; try { this.sock.pause(); } catch (e) { /* ничего */ } }
  close() { this.drop(); }
}

// Группа ботов с общим «ритмом игры»: каждый шлёт команду в среднем раз в 1/rate секунд
class Crowd {
  constructor(bots, rate = 0.7) { this.bots = bots; this.rate = rate; this.t = null; }
  start() { this.t = setInterval(() => { for (const b of this.bots) if (b.inGame && !b.o.paused && Math.random() < this.rate * 0.25) b.act(); }, 250); }
  stop() { clearInterval(this.t); }
}

// Сэмплер: раз в N секунд снимает метрики сервера и CPU/память самого теста
function sampler(srv, everyMs, gc) {
  const out = [];
  const t = setInterval(async () => { try { const m = await srv.metrics(false, gc); m.at = Date.now(); out.push(m); } catch (e) { /* пропуск */ } }, everyMs);
  return { out, stop() { clearInterval(t); } };
}

// Наклон линейной регрессии (единиц на час) по точкам [секунды, значение]
function slopePerHour(pts) {
  const n = pts.length;
  if (n < 4) return 0;
  const mx = avg(pts.map(p => p[0])), my = avg(pts.map(p => p[1]));
  let num = 0, den = 0;
  for (const [x, y] of pts) { num += (x - mx) * (y - my); den += (x - mx) ** 2; }
  return den ? (num / den) * 3600 : 0;
}

module.exports = { ROOT, sleep, pct, avg, r1, getJson, startServer, Bot, Crowd, sampler, slopePerHour, CLASSES };
