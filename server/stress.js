'use strict';
// Стресс-тест кооп-сервера: N ботов (WebSocket без зависимостей) входят, строят, ходят, болтают, выходят и перезаходят.
// Запуск:  node server/stress.js [--bots 10] [--secs 60] [--url ws://localhost:8787] [--churn 0.1] [--grow 300] [--delta 1]
// Сервер должен быть запущен отдельно (лучше с чистой папкой данных: OLDGOLD_DATA=… PORT=8787 node server/server.js).
// --grow N: деревня выращивается до N жителей (обучение в школе, цепочки зданий, а недостающих добавляет сервер —
// для этого он должен быть запущен с OLDGOLD_STRESS=1). --delta 0 — боты как старые клиенты (полный пакет жителей).
// Метрики сервера (тик, пакеты, память, трафик) берутся с /coop-info?metrics=1 — доступно только с loopback.
const net = require('net');
const http = require('http');
const crypto = require('crypto');
const zlib = require('zlib');
const { URL } = require('url');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const N = +arg('bots', 10), SECS = +arg('secs', 60), BASE = arg('url', 'ws://localhost:8787'), CHURN = +arg('churn', 0.1), ZIP = arg('zip', '1') === '1';
const GROW = +arg('grow', 0), DELTA = arg('delta', '1') === '1';
const U = new URL(BASE), HOST = U.hostname, PORT = +U.port || 80;
const MAP_W = 96;
const TYPES = ['woodcutter', 'quarry', 'farm', 'sawmill', 'mill', 'bakery', 'swine', 'goatpen', 'brewery', 'hopfarm'];
// производственные цепочки: здания ставятся рядом и соединяются дорогой со складом
const CHAINS = [['woodcutter', 'sawmill'], ['farm', 'mill', 'bakery'], ['swine', 'butcher'], ['hopfarm', 'brewery'], ['quarry'], ['school'], ['house', 'house']];
const TRAIN = ['serf', 'serf', 'builder', 'woodcutter', 'farmer', 'woodcutter', 'stonemason', 'baker'];
const CLASSES = ['warrior', 'barbarian', 'mage', 'archer', 'druid', 'rogue', 'monk', 'priest', 'paladin', 'bard'];
const RUN = crypto.randomBytes(3).toString('hex');

function getJson(path) {
  return new Promise((res, rej) => http.get({ host: HOST, port: PORT, path }, r => {
    let s = ''; r.on('data', d => s += d); r.on('end', () => { try { res(JSON.parse(s)); } catch (e) { rej(e); } });
  }).on('error', rej));
}

class Bot {
  constructor(i) {
    this.i = i; this.nick = `bot${RUN}${i}`; this.pass = 'stress123'; this.registered = false;
    this.sock = null; this.buf = Buffer.alloc(0); this.frag = [];
    this.roads = new Set(); this.bids = new Set(); this.objs = 0;
    this.home = [40, 30]; this.inGame = false;
    this.bytesIn = 0; this.msgs = 0; this.uAt = 0; this.gaps = []; this.parseMs = 0; this.joins = 0; this.errors = 0; this.toasts = 0;
    this.byT = {}; this.deltaB = 0; this.deltaW = 0; this.initBytes = 0; this.initMs = 0;
    this.units = new Map(); this.view = null;
  }
  connect() {
    return new Promise((resolve, reject) => {
      const key = crypto.randomBytes(16).toString('base64');
      const s = this.sock = net.connect(PORT, HOST);
      s.setNoDelay(true);
      this.buf = Buffer.alloc(0); this.frag = []; this.inGame = false;
      s.on('connect', () => s.write(`GET / HTTP/1.1\r\nHost: ${HOST}:${PORT}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`));
      let upgraded = false;
      s.on('data', d => {
        this.buf = Buffer.concat([this.buf, d]);
        if (!upgraded) {
          const e = this.buf.indexOf('\r\n\r\n');
          if (e < 0) return;
          if (!/101/.test(this.buf.subarray(0, 20).toString())) return reject(new Error('нет апгрейда'));
          this.buf = this.buf.subarray(e + 4); upgraded = true; resolve();
        }
        this.parse();
      });
      s.on('error', e => { this.errors++; if (!upgraded) reject(e); });
      s.on('close', () => { this.inGame = false; });
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
      if (op === 9) { this.raw(10, payload); continue; }
      if (op === 8) { this.sock.destroy(); return; }
      if (op === 2) { this.frag = [zlib.inflateRawSync(payload)]; } else if (op === 1) this.frag = [payload]; else if (op === 0) this.frag.push(payload);
      if (fin && this.frag.length) { const t = Buffer.concat(this.frag).toString('utf8'); this.frag = []; this.onText(t); }
    }
  }
  raw(op, payload) {
    if (!this.sock || this.sock.destroyed) return;
    const len = payload.length, mask = crypto.randomBytes(4);
    let head;
    if (len < 126) head = Buffer.from([0x80 | op, 0x80 | len]);
    else { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 0x80 | 126; head.writeUInt16BE(len, 2); }
    const body = Buffer.from(payload);
    for (let i = 0; i < len; i++) body[i] ^= mask[i & 3];
    this.sock.write(Buffer.concat([head, mask, body]));
  }
  send(o) { this.raw(1, Buffer.from(JSON.stringify(o))); }
  onText(text) {
    this.msgs++;
    const ty = text.slice(6, 9).replace(/\W/g, ''); (this.byT[ty] || (this.byT[ty] = [0, 0]))[0]++; this.byT[ty][1] += text.length;
    const t0 = process.hrtime.bigint();
    const m = JSON.parse(text);
    this.parseMs += Number(process.hrtime.bigint() - t0) / 1e6;
    switch (m.t) {
      case 'welcome':
        if (m.needClass) this.send({ t: 'class', cls: CLASSES[this.i % CLASSES.length] });
        break;
      case 'err': this.errors++; if (/нет|Такого/.test(m.msg)) this.registered = false; break;
      case 'kicked': break;
      case 'init': {
        this.initBytes = text.length; this.initMs = Number(process.hrtime.bigint() - t0) / 1e6;
        this.roads = new Set(m.world.road); this.bids = new Set(m.world.buildings.map(b => b.id)); this.objs = m.ob.length;
        const st = m.world.buildings.find(b => b.type === 'storehouse');
        if (st) this.home = [st.x + 2, st.y + 5];
        this.inGame = true; this.joins++; this.uAt = 0; this.units.clear();
        this.sendView();
        break;
      }
      case 'u': {
        const now = Date.now();
        if (this.uAt) this.gaps.push(now - this.uAt);
        this.uAt = now;
        // старый формат — полный список; новый (d:1) — изменившиеся, ушедшие (ug) и раз в секунду весь список id
        if (!m.d) this.units.clear();
        for (const d of m.units) this.units.set(d.i, [d.x, d.y]);
        if (m.ug) for (const id of m.ug) this.units.delete(id);
        if (m.ids) { const keep = new Set(m.ids); for (const id of this.units.keys()) if (!keep.has(id)) this.units.delete(id); }
        break;
      }
      case 'w':
        this.deltaW++; this.deltaB += text.length;
        if (m.r) for (const i of m.r) this.roads.add(i);
        if (m.rx) for (const i of m.rx) this.roads.delete(i);
        if (m.b) for (const d of m.b) this.bids.add(d.id);
        if (m.bx) for (const id of m.bx) this.bids.delete(id);
        if (m.o) this.objs += 0;   // число объектов на клетках сверяем ниже по отдельному счётчику не будем: достаточно дорог и зданий
        break;
      case 'toast': this.toasts++; break;
    }
  }
  async login() {
    await this.connect();
    this.send({ t: 'auth', nick: this.nick, pass: this.pass, mode: this.registered ? 'login' : 'register', z: ZIP ? 1 : 0, d: DELTA ? 1 : 0 });
    this.registered = true;
    for (let k = 0; k < 100 && !this.inGame; k++) await sleep(50);
    return this.inGame;
  }
  rnd(n) { return Math.floor(Math.random() * n); }
  // камера как у браузера: окно ~30×17 клеток где-то около склада
  sendView() {
    const [hx, hy] = this.home, cx = hx + this.rnd(31) - 15, cy = hy + this.rnd(21) - 10;
    this.view = [cx - 15, cy - 9, cx + 15, cy + 9];
    this.send({ t: 'view', x0: this.view[0], y0: this.view[1], x1: this.view[2], y1: this.view[3] });
  }
  chain() {
    const [hx, hy] = this.home, ch = CHAINS[this.rnd(CHAINS.length)];
    let x = hx + this.rnd(37) - 18;
    const y = hy + this.rnd(29) - 14;
    for (const type of ch) { this.send({ t: 'build', type, x, y, rot: 0 }); x += 4; }
    const cells = [];
    for (let xx = Math.min(x, hx); xx <= Math.max(x, hx); xx++) cells.push([xx, y + 3]);
    for (let yy = Math.min(y + 3, hy); yy <= Math.max(y + 3, hy); yy++) cells.push([hx, yy]);
    this.send({ t: 'road', cells });
  }
  act() {
    if (!this.inGame) return;
    const [hx, hy] = this.home, r = Math.random();
    const near = R => [hx + this.rnd(2 * R + 1) - R, hy + this.rnd(2 * R + 1) - R];
    if (GROW && r < 0.12) { if (Math.random() < 0.5) this.chain(); else this.send({ t: 'qt', type: TRAIN[this.rnd(TRAIN.length)] }); return; }
    if (r > 0.97) { this.sendView(); return; }
    if (r < 0.35) { const [x, y] = near(12); this.send({ t: 'go', x, y }); }
    else if (r < 0.55) this.send({ t: 'chat', i: this.rnd(6) });
    else if (r < 0.75) { const [x, y] = near(14); this.send({ t: 'build', type: TYPES[this.rnd(TYPES.length)], x, y, rot: 0 }); }
    else if (r < 0.9) {
      let [x, y] = near(10); const cells = [], dir = this.rnd(2);
      for (let k = 0; k < 6 + this.rnd(10); k++) cells.push(dir ? [x + k, y] : [x, y + k]);
      this.send({ t: 'road', cells });
    } else if (r < 0.95) { const [x, y] = near(10); this.send({ t: 'field', mode: 'add', crop: 'wheat', cells: [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]] }); }
    else { const [x, y] = near(8); this.send({ t: 'erase', cells: [[x, y]] }); }
  }
  close() { try { this.sock.destroy(); } catch (e) { /* ничего */ } this.inGame = false; }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };

(async () => {
  console.log(`Стресс-тест: ${N} ботов, ${SECS} с, ${BASE}, перезаходов ~${CHURN}/с на бота-10`);
  const bots = Array.from({ length: N }, (_, i) => new Bot(i));
  try { await getJson('/coop-info?metrics=1&reset=1'); } catch (e) { console.log('метрики сервера недоступны:', e.message); }
  const t0 = Date.now();
  // входим пачками, чтобы не оглушить сервер ещё до начала
  for (const b of bots) { try { await b.login(); } catch (e) { console.log(b.nick, 'не вошёл:', e.message); } await sleep(150); }
  console.log(`вошло ${bots.filter(b => b.inGame).length}/${N} за ${((Date.now() - t0) / 1000).toFixed(1)} с; начальный снимок ${(bots[0].initBytes / 1024).toFixed(0)} КБ`);
  const samples = [];
  const endAt = Date.now() + SECS * 1000;
  const actT = setInterval(() => { for (const b of bots) if (Math.random() < 0.5) b.act(); }, 500);
  const churnT = setInterval(async () => {
    for (const b of bots) if (b.inGame && Math.random() < CHURN / 10) {
      b.close(); await sleep(200 + Math.random() * 800);
      try { await b.login(); } catch (e) { b.errors++; }
    }
  }, 1000);
  const sampT = setInterval(async () => { try { samples.push(await getJson('/coop-info?metrics=1')); } catch (e) { /* ничего */ } }, 5000);
  // рост деревни: чего не дообучили — досыпает сервер (см. xgrow в server.js), смерти тоже восполняются
  const growT = GROW && setInterval(() => {
    const s = samples[samples.length - 1], host = bots.find(b => b.inGame);
    if (s && host && s.units < GROW) host.send({ t: 'xgrow', n: Math.min(60, GROW - s.units) });
  }, 5000);
  while (Date.now() < endAt) await sleep(500);
  clearInterval(actT); clearInterval(churnT); clearInterval(sampT); if (growT) clearInterval(growT);
  await sleep(1200);   // доезжают последние перезаходы
  for (const b of bots) if (!b.inGame) { try { await b.login(); } catch (e) { b.errors++; } }
  await sleep(4000);   // тишина: все дельты разошлись, сравниваем состояния
  const sv = await getJson('/coop-info?metrics=1').catch(() => null);
  const dg = await getJson('/coop-info?digest=1').catch(() => null);
  const secs = (Date.now() - t0) / 1000;
  // расхождение
  let bad = 0;
  const details = [];
  if (dg) for (const b of bots) {
    if (!b.inGame) continue;
    const myIds = [...b.bids].sort((x, y) => x - y).join(',');
    const rd = b.roads.size !== dg.roads, bd = myIds !== dg.bids;
    if (rd || bd) { bad++; details.push(`${b.nick}: дороги ${b.roads.size}/${dg.roads}, здания ${b.bids.size}/${dg.buildings}`); }
  }
  // жители: тот же состав, а положение — не дальше нескольких клеток (дальних сервер шлёт реже, они могут чуть отставать)
  let badU = 0, farU = 0;
  const uDetails = [];
  if (dg && dg.units) {
    const sv = new Map(dg.units.map(u => [u[0], u]));
    for (const b of bots) {
      if (!b.inGame) continue;
      const miss = [...sv.keys()].filter(id => !b.units.has(id)).length, extra = [...b.units.keys()].filter(id => !sv.has(id)).length;
      let off = 0;
      for (const [id, p] of b.units) { const q = sv.get(id); if (q && Math.hypot(q[1] - p[0], q[2] - p[1]) > 6) off++; }
      farU += off;
      if (miss || extra) { badU++; uDetails.push(`${b.nick}: жителей ${b.units.size}/${sv.size}, нет ${miss}, лишних ${extra}`); }
    }
  }
  const agg = {}; for (const b of bots) for (const k in b.byT) { agg[k] = agg[k] || [0, 0]; agg[k][0] += b.byT[k][0]; agg[k][1] += b.byT[k][1]; }
  console.log('по типам пакетов (на бота/с):', Object.entries(agg).map(([k, v]) => `${k}: ${(v[0] / secs / N).toFixed(1)} шт, ${(v[1] / 1024 / secs / N).toFixed(1)} КБ`).join(' | '));
  const gaps = bots.flatMap(b => b.gaps);
  const totIn = bots.reduce((a, b) => a + b.bytesIn, 0);
  console.log('\n=== Результат ===');
  console.log(`ботов в игре: ${bots.filter(b => b.inGame).length}/${N}, перезаходов всего: ${bots.reduce((a, b) => a + b.joins - 1, 0)}, ошибок: ${bots.reduce((a, b) => a + b.errors, 0)}`);
  console.log(`клиентский трафик: ${(totIn / 1024 / secs).toFixed(0)} КБ/с на всех, ${(totIn / 1024 / secs / N).toFixed(1)} КБ/с на бота; сообщений ${(bots.reduce((a, b) => a + b.msgs, 0) / secs / N).toFixed(1)}/с на бота`);
  console.log(`интервал между снимками жителей (цель 200 мс): p50 ${pct(gaps, 0.5)} мс, p95 ${pct(gaps, 0.95)} мс, p99 ${pct(gaps, 0.99)} мс, max ${Math.max(0, ...gaps)} мс`);
  console.log(`разбор JSON у бота: ${(bots.reduce((a, b) => a + b.parseMs, 0) / bots.reduce((a, b) => a + b.msgs, 0)).toFixed(2)} мс/сообщ.`);
  if (sv) console.log('сервер (с начала):', JSON.stringify(sv));
  const peak = samples.reduce((a, s) => ({ rss: Math.max(a.rss, s.rssMB), step: Math.max(a.step, s.stepMaxMs), lag: Math.max(a.lag, s.loopLagMaxMs), kb: Math.max(a.kb, s.outKBps) }), { rss: 0, step: 0, lag: 0, kb: 0 });
  console.log(`пики по выборкам: RSS ${peak.rss} МБ, шаг ${peak.step} мс, лаг цикла ${peak.lag} мс, исх. трафик ${peak.kb} КБ/с`);
  console.log(dg ? `состояние сервера: дорог ${dg.roads}, зданий ${dg.buildings}` : 'digest недоступен');
  console.log(bad ? `РАСХОЖДЕНИЕ у ${bad} ботов:\n  ` + details.slice(0, 10).join('\n  ') : 'расхождений нет: дороги и здания у всех ботов совпали с сервером');
  if (dg && dg.units) console.log(badU ? `РАСХОЖДЕНИЕ жителей у ${badU} ботов:\n  ` + uDetails.slice(0, 10).join('\n  ') : `жители совпали у всех ботов (${dg.units.length}), отстающих дальше 6 клеток: ${farU} на всех`);
  // утечки: наклон RSS и кучи по второй половине прогона (первая — прогрев и рост деревни)
  const tail = samples.slice(samples.length >> 1);
  const slope = k => {
    if (tail.length < 4) return 0;
    const n = tail.length, xs = tail.map(s => s.sec / 60), ys = tail.map(s => s[k]);
    const mx = xs.reduce((a, v) => a + v, 0) / n, my = ys.reduce((a, v) => a + v, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
    return den ? num / den : 0;
  };
  const avgKb = tail.length > 1 && tail[0].outBytes !== undefined ? (tail[tail.length - 1].outBytes - tail[0].outBytes) / 1024 / Math.max(1, tail[tail.length - 1].sec - tail[0].sec) : 0;
  console.log(`вторая половина: исх. трафик в среднем ${avgKb.toFixed(0)} КБ/с, жителей ${tail.length ? tail[tail.length - 1].units : '?'}; память RSS ${slope('rssMB').toFixed(2)} МБ/мин, куча ${slope('heapMB').toFixed(2)} МБ/мин (${tail.length} выборок)`);
  for (const b of bots) b.close();
  process.exit(bad || badU ? 1 : 0);
})();
