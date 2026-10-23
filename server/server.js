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
// Пределы деревни (замеры — НАГРУЗКА_СЕРВЕРА.md): игроков в мире одновременно; сверх лимита пускаем только вернувшихся после обрыва
const MAX_PLAYERS = +process.env.OLDGOLD_MAX_PLAYERS || 40, RESERVE_SLOTS = 6, RETURN_WINDOW = 120000;
const AUTH_TIMEOUT = 20000;           // соединение без входа дольше этого закрываем
const AUTH_FAILS = 8;                 // неудачных входов с одного адреса за минуту — потом пауза
const TEST_SPEED = +process.env.OLDGOLD_SPEED || 1;   // только для нагрузочных тестов (tools/loadtest): ускорение хода времени
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
const MAP_FILE = path.join(DATA, 'custom-map.json');   // карта, которую хост выбрал из игры («Новый мир на своей карте»)
let noSave = false;                                       // мир отложен в архив, идёт перезапуск — старый мир не сохранять
const USERS_FILE = path.join(DATA, 'players.json');
const VIL_FILE = path.join(DATA, 'village.json');
const CAMP_FILE = path.join(DATA, 'campaign.json');    // прогресс и наследие кампании этого сервера (КАМПАНИЯ_КООП.md)
const CAMP_CP_FILE = path.join(DATA, 'camp-cp.json');  // последняя контрольная точка акта
const log = (...a) => console.log(new Date().toLocaleTimeString('ru-RU'), ...a);

// ---------- Статистика игроков ----------
const stats = createStats(DATA, log);
const events = require('./events').createEvents(DATA, log);
const errReports = require('./errors').createErrors(DATA, log);   // анонимные отчёты об ошибках у игроков (POST /err)
const tele = require('./telemetry').createTelemetry(DATA, log, events);   // статистика по согласию (POST /t), «Сообщить о проблеме» (POST /report), удаление по id (POST /t/forget)
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
// scrypt считаем в пуле потоков, а не в главном: 100 входов подряд не должны замораживать мир (scryptSync держал цикл ~60 мс на вход)
let scryptBusy = 0;
const scryptQ = [];
const hashPass = (pass, salt) => new Promise((resolve, reject) => {
  const go = () => {
    scryptBusy++;
    crypto.scrypt(pass, salt, 32, (e, k) => { scryptBusy--; if (scryptQ.length) scryptQ.shift()(); if (e) reject(e); else resolve(k.toString('hex')); });
  };
  if (scryptBusy < 2) go(); else scryptQ.push(go);
});
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const nickOk = n => typeof n === 'string' && /^[\p{L}\p{N}_\- ]{2,16}$/u.test(n) && n.trim() === n;
const userRec = key => (Object.prototype.hasOwnProperty.call(users, key) ? users[key] : undefined);   // ник «constructor» не находит Object.prototype
const MAX_USERS = +process.env.OLDGOLD_MAX_USERS || 3000;
// попытки входа и регистрации: ведро на адрес (и на аккаунт — от подбора пароля с многих адресов); только в памяти
const authHits = new Map();
function authLimited(key, n, ms) {
  const now = Date.now(), h = authHits.get(key);
  if (!h || now - h[0] > ms) { authHits.set(key, [now, 1]); if (authHits.size > 20000) authHits.clear(); return false; }
  return ++h[1] > n;
}
// строки от клиента, которые попадают в журналы и сводки в терминале: без управляющих символов (ESC-последовательностей)
const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').slice(0, n);
// Адрес игрока. За Caddy/nginx на этом же компьютере — последний адрес из X-Forwarded-For (его дописал наш прокси;
// первые игрок мог прислать сам). При прямом подключении заголовок игнорируется — его подделывает кто угодно.
const LOOPBACK = /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/;
function clientIp(req, sock = req.socket) {
  const addr = (sock && sock.remoteAddress) || '';
  const xff = req.headers['x-forwarded-for'];
  if (!xff || !LOOPBACK.test(addr)) return addr;
  const list = String(xff).split(',').map(s => s.trim()).filter(Boolean);
  return list.length ? list[list.length - 1] : addr;
}
// Команды игроков: имена из Object.prototype («constructor», «__proto__», «toString»…) как ключи или значения
// превращали проверки вида BUILDINGS[m.type] в «да» и ломали шаг мира; Infinity (1e999) и огромная вложенность — туда же
const PROTO_NAMES = new Set([...Object.getOwnPropertyNames(Object.prototype), 'prototype']);
function msgSafe(m, keysOnly) {
  const stack = [m];
  let nodes = 0;
  while (stack.length) {
    const v = stack.pop();
    if (++nodes > 20000) return false;
    if (typeof v === 'number') { if (!Number.isFinite(v)) return false; continue; }
    if (typeof v === 'string') { if (!keysOnly && PROTO_NAMES.has(v)) return false; continue; }
    if (!v || typeof v !== 'object') continue;
    if (Array.isArray(v)) { for (const x of v) stack.push(x); continue; }
    for (const k of Object.keys(v)) { if (PROTO_NAMES.has(k)) return false; stack.push(v[k]); }
  }
  return true;
}

// ---------- Мир ----------
const host = createHost(log);
// права игроков (админ-панель хоста) хранятся отдельно от мира
try { host.ctx.coopSetPerms(JSON.stringify(JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')).perms || {})); } catch (e) { /* прав ещё нет — всё разрешено */ }
const call = (fn, ...args) => host.ctx[fn](...args);
const run = code => host.run(code);
try { host.ctx.coopStateSet(fs.readFileSync(VIL_FILE, 'utf8')); } catch (e) { /* серий и рекордов ещё нет */ }
// кампания: прогресс живёт в localStorage песочницы (campaign.js), контрольная точка — в CampSrv
let campSaved = '', campCpN = 0;
try { campSaved = fs.readFileSync(CAMP_FILE, 'utf8'); host.ctx.localStorage.setItem('oldgold.campaign', campSaved); } catch (e) { /* кампанию на сервере ещё не играли */ }
// CampSrv — const скрипта campaign.js: не свойство глобального объекта песочницы, достаём через run
const campSrvObj = () => run('typeof CampSrv === "undefined" ? null : CampSrv');
try { const S = campSrvObj(); if (S && fs.existsSync(CAMP_CP_FILE)) { S.cp = fs.readFileSync(CAMP_CP_FILE, 'utf8'); campCpN = S.cpN = 1; } } catch (e) { log('контрольная точка кампании не прочитана:', e.message); }
function saveCampaign() {
  const S = campSrvObj();
  if (!S) return;
  const p = host.ctx.localStorage.getItem('oldgold.campaign') || '';
  if (p && p !== campSaved) { fs.writeFileSync(CAMP_FILE, p); campSaved = p; }
  if (S.cpN !== campCpN) {
    campCpN = S.cpN;
    if (S.cp) fs.writeFileSync(CAMP_CP_FILE, S.cp); else if (fs.existsSync(CAMP_CP_FILE)) fs.unlinkSync(CAMP_CP_FILE);
  }
}
const SIM_DT = run('SIM_DT');
const COOP_SPEED = 1.2 * TEST_SPEED;
// Время общей деревни: скорость ×0,5/×1/×2/×3 выбирает хост (запоминается в settings.json), пауза — хост сразу или голосованием
const SPEEDS_OK = [0.5, 1, 2, 3];
const tempo = { speed: 1, paused: false };
function writeSettings(patch) {
  let cur = {};
  try { cur = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); } catch (e) { /* файла ещё нет */ }
  try { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(Object.assign(cur, patch))); } catch (e) { log('настройки не сохранились:', e.message); }
}
try { const sp = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')).speed; if (SPEEDS_OK.includes(sp)) tempo.speed = sp; } catch (e) { /* скорость ещё не выбирали */ }
const tempoMsg = () => { const n = [...conns].filter(c => c.inGame).length; return { t: 'tempo', speed: tempo.speed, paused: tempo.paused, votes: [...conns].filter(c => c.inGame && c.vote).length, need: Math.floor(n / 2) + 1 }; };
function setPaused(on, who) {
  tempo.paused = on;
  for (const c of conns) c.vote = false;
  broadcast(tempoMsg());
  if (who) broadcast({ t: 'toast', text: who + (on ? ': пауза — можно планировать' : ': игра продолжается') });
}

const worldIO = require('./worldio').createWorldIO({ host, dir: DATA, file: WORLD_FILE, log });
function loadWorld() {
  const r = worldIO.load();
  if (r.fatal === 'newer') {
    log('ОСТАНОВКА: мир записан более новой версией игры, чем этот сервер. Обновите сервер или положите мир нужной версии (world-pre-*.json, world-snap-*.json). Файлы не тронуты.');
    process.exit(3);
  }
  if (r.ok) log('мир загружен из', r.from, r.migratedFrom ? '(записан версией ' + r.migratedFrom + ')' : '', '— жителей', run('Game.units.length'), 'зданий', run('Game.buildings.length'));
  else if (r.tried.length) log('мир не поднялся ни из одного файла — создаю новый; нечитаемые файлы сохранены как world-broken-*.json');
  return r.ok;
}
if (!loadWorld()) {
  // карту выбирает хост: OLDGOLD_BIOME (meadow, forest, steppe, mountain, swamp, winter), OLDGOLD_SIZE (small, medium, large), OLDGOLD_SEED
  const biome = String(process.env.OLDGOLD_BIOME || 'meadow').replace(/[^a-z]/g, ''), size = String(process.env.OLDGOLD_SIZE || 'large').replace(/[^a-z]/g, '');
  const seed = process.env.OLDGOLD_SEED ? run(`mapSeedFrom(${JSON.stringify(String(process.env.OLDGOLD_SEED))})`) : (Math.random() * 1e9) | 0;
  // OLDGOLD_MAP=путь к файлу карты игрока (редактор карт, КАРТЫ_РЕДАКТОР.md): вместо генерации, свободная игра с правилами карты
  let custom = false;
  // карта, выбранная хостом из игры (custom-map.json), важнее переменной окружения
  const mapPath = fs.existsSync(MAP_FILE) ? MAP_FILE : process.env.OLDGOLD_MAP;
  if (mapPath) {
    try {
      host.ctx.__mapText = fs.readFileSync(mapPath, 'utf8');
      custom = run('(function(){ const r = meParse(__mapText); __mapText = null; if (r.err) throw new Error(r.err); const v = meValidate(r.map); if (v.errors.length) throw new Error(v.errors.join("; ")); __customMap = r.map; return true; })()');
    } catch (e) { log('карта игрока не принята, делаем обычную:', e.message); }
  }
  run(`setupStart(${seed}, ${custom ? '{ custom: __customMap }' : `{ biome: '${biome}', size: '${size}' }`}); goalNew('${custom ? 'free' : 'scenario'}'); coopDropHeroes(); for (const b of Game.buildings) b.hold = false; coopInitUnlocks();`);
  log('создан новый мир, зерно', seed, custom ? 'карта игрока ' + run('MapOpt.custom.name') : 'биом ' + biome + ', размер ' + size);
}

function saveWorld() {
  if (noSave) return false;
  try {
    const text = run('JSON.stringify(serializeGame())');
    worldIO.write(text);   // .tmp → переименование, .bak, снимки раз в полчаса (server/worldio.js)
    flushHeroes();
    try { fs.writeFileSync(VIL_FILE, call('coopStateGet')); } catch (e) { log('серии ночей не сохранились:', e.message); }
    try { saveCampaign(); } catch (e) { log('кампания не сохранилась:', e.message); }
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
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.woff2': 'font/woff2' };
// Заголовки безопасности для всего, что раздаёт сервер. Скрипты только свои (+ счётчик GoatCounter), без встроенных
// обработчиков: даже если в разметку попадёт чужая строка, <img onerror> не выполнится. Встраивать игру в чужие фреймы нельзя.
const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' https://gc.zgo.at; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.goatcounter.com; " +
    "font-src 'self' data:; media-src 'self' data: blob:; connect-src 'self' ws: wss: https:; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
};
const server = http.createServer((req, res) => {
  try { handleHttp(req, res); } catch (e) {
    log('ошибка HTTP:', e.message);
    try { if (!res.headersSent) res.writeHead(500, SEC_HEADERS); res.end(); } catch (e2) { /* соединение уже закрыто */ }
  }
});
server.requestTimeout = 60000; server.headersTimeout = 20000;   // медленные «висящие» запросы не держат сокеты минутами
function handleHttp(req, res) {
  for (const k in SEC_HEADERS) res.setHeader(k, SEC_HEADERS[k]);
  let p;
  // кривой %-код (/%E0%A4%A) раньше бросал исключение прямо в обработчике и ронял весь процесс
  try { p = decodeURIComponent((req.url || '/').split('?')[0]); } catch (e) { res.writeHead(400); res.end(); return; }
  if (p.includes('\0')) { res.writeHead(400); res.end(); return; }
  const ip = clientIp(req);
  if (p === '/coop-info' && /metrics|digest/.test(req.url) && LOOPBACK.test(req.socket.remoteAddress || '') && !req.headers['x-forwarded-for']) {
    const q = new URL(req.url, 'http://x').searchParams;
    if (q.has('gc') && global.gc) global.gc();   // для замеров утечек: сервер запущен с --expose-gc
    const out = q.has('metrics') ? metricsSnap() : digest();
    if (q.has('reset')) metricsReset();
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(out)); return;
  }
  if (p === '/coop-info') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify({ coop: true, online: [...conns].filter(c => c.inGame).length })); return; }
  // за прокси remoteAddress у всех 127.0.0.1 — лимиты /e и /err были общими на весь интернет
  if (events.handle(req, res, ip)) return;
  if (errReports.handle(req, res, ip)) return;
  if (tele.handle(req, res, ip)) return;
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
  if (p === '/stats') {
    const q = new URL(req.url, 'http://x').searchParams;
    if (!keyOk(q.get('key'))) { res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('нужен ключ: /stats?key=… (он в файле stats.key в папке данных сервера)'); return; }
    stats.save(); events.save(); errReports.save();
    const x = stats.summary();
    if (q.has('json')) { res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ ...x, solo: events.summary(), errors: errReports.summary() }, null, 2)); }
    else { res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(printSummary(x) + '\n\n' + events.printSummary(events.summary()) + '\n\n' + errReports.printSummary(errReports.summary()) + '\n\nСервер: ' + SERVER_VER + '\n'); }
    return;
  }
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  const rel = path.relative(ROOT, file);
  if (rel.startsWith('..') || /^(server|desktop|mobile|\.git|\.claude)([\\/]|$)/.test(rel) || /(^|[\\/])\./.test(rel) || /coopsim\.js$/.test(rel)) { res.writeHead(404); res.end('нет'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); res.end('нет'); return; }
    const ext = path.extname(file).toLowerCase();
    const h = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': /^\.(ttf|woff2|png)$/.test(ext) ? 'public, max-age=604800' : 'no-cache', Vary: 'Accept-Encoding' };
    if (/^\.(html|js|css|svg|json|webmanifest|ttf)$/.test(ext) && buf.length > 1024 && /gzip/.test(req.headers['accept-encoding'] || '')) {
      h['Content-Encoding'] = 'gzip';
      res.writeHead(200, h); res.end(gzipCached(file, buf)); return;
    }
    res.writeHead(200, h);
    res.end(buf);
  });
}
// Сжатые копии статики. Раньше каждый запрос сжимал файл заново в главном потоке (changelog.js 209 КБ ≈ 8 мс, все скрипты
// страницы ≈ 130 мс): поток запросов крупных файлов из интернета тормозил шаг мира для всех. Ключ — содержимое файла,
// после git pull файл пересжимается сам.
const GZ_CACHE = new Map();
function gzipCached(file, buf) {
  const key = buf.length + ':' + crypto.createHash('sha1').update(buf).digest('base64');
  const c = GZ_CACHE.get(file);
  if (c && c.key === key) return c.gz;
  const gz = zlib.gzipSync(buf, { level: 6 });
  if (GZ_CACHE.size >= 400) GZ_CACHE.clear();
  GZ_CACHE.set(file, { key, gz });
  return gz;
}

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
    this.z = false; this.nick = null; this.key = null; this.inGame = false; this.alive = true; this.seen = this.born = Date.now();
    sock.on('data', d => this.onData(d));
    // http-сервер держит сокеты в режиме allowHalfOpen: без этого клиент, закрывший соединение без прощального кадра (смена сети, убитая вкладка), висел в деревне до минуты
    sock.on('end', () => { try { sock.end(); } catch (e) { /* ничего */ } });
    sock.on('close', () => this.onClose());
    sock.on('error', () => { try { sock.destroy(); } catch (e) { /* ничего */ } });
  }
  send(obj) { this.sendText(typeof obj === 'string' ? obj : JSON.stringify(obj)); }
  sendText(s) { this.sendFrame(typeof s === 'string' ? pack(s, this.z) : s); }
  sendFrame(f) {
    if (!this.alive || this.sock.destroyed) return;
    // клиент не успевает читать (в буфере больше 2 МБ) — отключаем, иначе память сервера растёт без предела
    if (this.sock.writableLength > 2 << 20) { M.slowKicked++; this.sock.destroy(); return; }
    M.bytesOut += f.length; M.msgsOut++; ML.bytes += f.length;
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
      // до входа хватит 8 КБ (вход — пара строк), после — 1 МБ (карта нового мира у хоста); кадры клиента обязаны быть в маске (RFC 6455)
      const maxLen = this.nick ? 1 << 20 : 8192;
      if (len > maxLen || !masked || (op >= 8 && len > 125)) { this.sock.destroy(); return; }
      if (b.length < off + 4 + len) return;
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
      if (op === 1 || op === 2) { this.frag = [payload]; this.fragOp = op; this.fragLen = len; }
      else if (op === 0) {
        // продолжения без начала или склейка больше лимита: раньше куски копились без предела — память сервера
        this.fragLen = (this.fragLen || 0) + len;
        if (!this.frag.length || this.fragLen > maxLen) { this.sock.destroy(); return; }
        this.frag.push(payload);
      } else { this.sock.destroy(); return; }   // неизвестный код кадра
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
      left.set(this.key, Date.now());
      stats.leave(this.key);
      const d = call('coopLeave', this.nick);
      call('coopViewDrop', this.nick);
      if (d) users[this.key].hero = JSON.parse(d);
      saveUsers();
      broadcast({ t: 'toast', text: `${this.nick} покидает деревню` });
      log('вышел', this.nick);
    }
  }
}

// Отказ с понятным текстом: клиент получает сообщение (а не немую обрубку связи) и знает, сколько ждать до новой попытки
function refuseSock(sock, msg, wait) {
  M.refused++;
  try { sock.end(Buffer.concat([frame(1, Buffer.from(JSON.stringify({ t: 'err', msg, full: true, wait }))), frame(8, Buffer.from([0x03, 0xf5]))])); } catch (e) { /* ничего */ }
}
const left = new Map();   // ключ игрока -> когда ушёл: вернувшимся после обрыва место в деревне держим 2 минуты
const online = () => { let n = 0; for (const c of conns) if (c.inGame) n++; return n; };
const returning = (key, self) => { for (const o of conns) if (o !== self && o.key === key && o.inGame) return true; const t = left.get(key); return !!t && Date.now() - t < RETURN_WINDOW; };
const authFails = new Map();   // адрес -> { n, t }
const THROTTLE_LOOP = process.env.OLDGOLD_THROTTLE_LOOPBACK === '1';

server.on('upgrade', (req, sock) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { sock.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  sock.setNoDelay(true);
  const addr = sock.remoteAddress || '';
  const isHost = LOOPBACK.test(addr) && !req.headers['x-forwarded-for'];
  // настоящий адрес игрока за прокси — для лимитов и хэша в статистике, в открытом виде не хранится
  const ip = clientIp(req, sock);
  // потолок соединений: лишних отсекаем сразу, чтобы не съесть память
  if (conns.size >= MAX_CONNS) return refuseSock(sock, 'Сервер переполнен подключениями. Подождите минуту и зайдите снова.', 30);
  if (!isHost && [...conns].filter(o => o.ip === ip).length >= MAX_PER_IP) return refuseSock(sock, 'С вашего адреса открыто слишком много окон игры. Закройте лишние и зайдите снова.', 30);
  const c = new Conn(sock, isHost, ip, clean(req.headers.origin, 80));
  c.thr = !isHost || THROTTLE_LOOP;   // loopback (хост) от перебора паролей не ограничиваем, кроме тестов
  conns.add(c);
});

// Метрики нагрузки: время шага и сборки пакетов, исходящий трафик (отдаются на /coop-info?metrics=1 только с loopback)
const M = { ticks: 0, stepMs: 0, stepMax: 0, uMs: 0, uMax: 0, wMs: 0, wMax: 0, loopMax: 0, bytesOut: 0, msgsOut: 0, zMs: 0, zIn: 0, zOut: 0, lag: 0, since: Date.now(), refused: 0, slowKicked: 0, saveMs: 0, saveMax: 0, saveN: 0, busy: 0, cpu0: process.cpuUsage(), degraded: 0 };
function metricsReset() { Object.assign(M, { ticks: 0, stepMs: 0, stepMax: 0, uMs: 0, uMax: 0, wMs: 0, wMax: 0, loopMax: 0, bytesOut: 0, msgsOut: 0, lag: 0, uN: 0, wN: 0, since: Date.now(), refused: 0, slowKicked: 0, saveMs: 0, saveMax: 0, saveN: 0, cpu0: process.cpuUsage() }); }
function metricsSnap() {
  const sec = Math.max(0.001, (Date.now() - M.since) / 1000), mu = process.memoryUsage(), cpu = process.cpuUsage(M.cpu0);
  return {
    sec: +sec.toFixed(1), online: [...conns].filter(c => c.inGame).length, conns: conns.size,
    stepAvgMs: +(M.stepMs / Math.max(1, M.ticks)).toFixed(2), stepMaxMs: +M.stepMax.toFixed(1),
    unitsPktAvgMs: +(M.uMs / Math.max(1, M.uN || 1)).toFixed(2), unitsPktMaxMs: +M.uMax.toFixed(1),
    worldPktAvgMs: +(M.wMs / Math.max(1, M.wN || 1)).toFixed(2), worldPktMaxMs: +M.wMax.toFixed(1),
    zipMs: +M.zMs.toFixed(0), zipRatio: M.zOut ? +(M.zIn / M.zOut).toFixed(1) : 0, loopLagMaxMs: +M.loopMax.toFixed(1), outKBps: +(M.bytesOut / 1024 / sec).toFixed(1), outMsgsPerSec: +(M.msgsOut / sec).toFixed(1),
    outBytes: M.bytesOut, rssMB: +(mu.rss / 1048576).toFixed(1), heapMB: +(mu.heapUsed / 1048576).toFixed(1),
    units: run('Game.units.length'), buildings: run('Game.buildings.length'),
    cpuPct: +(((cpu.user + cpu.system) / 1000) / (sec * 10)).toFixed(1), busyPct: +(M.busy * 100).toFixed(1), degraded: M.degraded, refused: M.refused, slowKicked: M.slowKicked,
    saveAvgMs: +(M.saveMs / Math.max(1, M.saveN)).toFixed(1), saveMaxMs: +M.saveMax.toFixed(1), maxQueuedKB: Math.round(Math.max(0, ...[...conns].map(c => c.sock.writableLength)) / 1024),
    ext: +(mu.external / 1048576).toFixed(1), arrays: run('Object.entries(Game).filter(([k, v]) => Array.isArray(v) && v.length > 50).map(([k, v]) => k + ":" + v.length).join(" ")'),
    usersFileKB: Math.round(JSON.stringify(users).length / 1024),
  };
}
function digest() { return JSON.parse(run('JSON.stringify({ roads: World.road.reduce((a, v) => a + v, 0), buildings: Game.buildings.length, bids: Game.buildings.map(b => b.id).sort((a, b) => a - b).join(","), objs: World.obj.filter(Boolean).length, units: Game.units.filter(u => !u.dead).map(u => [u.id, Math.round(u.x * 10) / 10, Math.round(u.y * 10) / 10]) })')); }

// Постоянный журнал нагрузки: раз в минуту строка JSON в metrics.log в папке данных (тик, память, трафик, онлайн)
const METRICS_LOG = path.join(DATA, 'metrics.log');
const ML = { bytes: 0, ticks: 0, stepMs: 0, stepMax: 0, loopMax: 0, at: Date.now() };
setInterval(() => {
  const now = Date.now(), sec = Math.max(1, (now - ML.at) / 1000), mu = process.memoryUsage();
  const rec = {
    at: new Date(now).toISOString(), online: [...conns].filter(c => c.inGame).length, units: run('Game.units.length'),
    stepAvgMs: +(ML.stepMs / Math.max(1, ML.ticks)).toFixed(2), stepMaxMs: +ML.stepMax.toFixed(1), loopLagMaxMs: +ML.loopMax.toFixed(0),
    outKBps: +(ML.bytes / 1024 / sec).toFixed(1), rssMB: +(mu.rss / 1048576).toFixed(1), heapMB: +(mu.heapUsed / 1048576).toFixed(1),
  };
  Object.assign(ML, { bytes: 0, ticks: 0, stepMs: 0, stepMax: 0, loopMax: 0, at: now });
  try {
    if (fs.existsSync(METRICS_LOG) && fs.statSync(METRICS_LOG).size > 5 << 20) fs.renameSync(METRICS_LOG, METRICS_LOG + '.1');   // не больше ~10 МБ на два файла
    fs.appendFileSync(METRICS_LOG, JSON.stringify(rec) + '\n');
  } catch (e) { /* журнал необязателен */ }
}, 60000).unref();

function broadcast(obj, to) {
  const s = typeof obj === 'string' ? obj : JSON.stringify(obj);
  let plain, zipped;   // каждый вариант кадра собираем один раз на всех
  for (const c of conns) {
    if (!c.inGame || (to && to !== c.nick)) continue;
    if (c.z) c.sendFrame(zipped || (zipped = pack(s, true))); else c.sendFrame(plain || (plain = pack(s, false)));
  }
}

// Пакет жителей: новым клиентам — своя дельта с учётом их камеры, старым — общий полный пакет
function sendUnits() {
  call('coopUnitsBuild');
  let full = null, fz = null, fp = null;
  for (const c of conns) {
    if (!c.inGame) continue;
    if (c.d) { const v = c.view || [NaN, NaN, NaN, NaN]; c.sendText(call('coopUnitsFor', c.nick, v[0], v[1], v[2], v[3])); continue; }
    if (!full) full = call('coopUnitsPacket');
    c.sendFrame(c.z ? fz || (fz = pack(full, true)) : fp || (fp = pack(full, false)));
  }
}

// ---------- Сообщения игроков ----------
function joinWorld(c) {
  const rec = users[c.key];
  const uid = call('coopJoin', c.nick, JSON.stringify(rec.hero));
  call('coopViewDrop', c.nick);   // дельта жителей для него начинается заново
  c.inGame = true;
  stats.join(c.key, c.nick, { cls: rec.hero && rec.hero.cls, ip: c.ip, ver: c.ver, from: c.origin });
  c.sendText(call('coopInitPacket', uid));
  c.send(tempoMsg());
  const me = call('coopMeData', c.nick);
  if (me) c.sendText(me);
  log('вошёл', c.nick, c.isHost ? '(хост)' : '');
}

// Вход: пароль считается в пуле потоков (await), поэтому после каждого ожидания проверяем, что соединение ещё живо
async function auth(c, m) {
  const now = Date.now();
  if (c.thr) {
    const f = authFails.get(c.ip);
    if (f && f.n >= AUTH_FAILS && now - f.t < 60000) return c.send({ t: 'err', msg: 'Слишком много неудачных попыток входа. Подождите минуту.', wait: 60 });
  }
  const bad = (msg, extra) => { if (c.thr) { const f = authFails.get(c.ip); if (f && now - f.t < 60000) f.n++; else authFails.set(c.ip, { n: 1, t: now }); } return c.send({ t: 'err', msg, ...extra }); };
  const nick = String(m.nick || '').trim(), pass = String(m.pass || '');
  if (!nickOk(nick)) return c.send({ t: 'err', msg: 'Ник: 2–16 символов, буквы, цифры, пробел, _ и -' });
  if (m.mode !== 'token' && (pass.length < 3 || pass.length > 64)) return c.send({ t: 'err', msg: 'Пароль: от 3 символов' });
  const key = nick.toLowerCase();
  // «__PROTO__» → ключ «__proto__»: users[key] = … подменил бы прототип таблицы игроков
  if (PROTO_NAMES.has(key)) return c.send({ t: 'err', msg: 'Такой ник нельзя' });
  let rec = userRec(key);
  if (m.mode === 'register') {
    if (rec) return c.send({ t: 'err', msg: 'Такой ник уже занят' });
    // ботоферма: не больше 5 новых героев в час с адреса и потолок аккаунтов (players.json пишется целиком при каждом входе)
    if (c.thr && authLimited('reg|' + c.ip, 5, 3600000)) return c.send({ t: 'err', msg: 'Слишком много новых героев с этого адреса — попробуйте через час', wait: 3600 });
    if (Object.keys(users).length >= MAX_USERS) return c.send({ t: 'err', msg: 'На сервере больше нет мест для новых игроков' });
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await hashPass(pass, salt);
    if (!c.alive) return;
    if (userRec(key)) return c.send({ t: 'err', msg: 'Такой ник уже занят' });
    const full = admitMsg(c, key);
    if (full) return refuse(c, full);
    rec = users[key] = { nick, salt, hash, hero: null, created: Date.now() };
    saveUsers();
  } else if (m.mode === 'token') {
    if (!rec || !(rec.toks || []).includes(sha(String(m.token || '')))) return bad('Сессия устарела — войдите по паролю', { stale: true });
  } else {
    if (!rec) return bad('Такого игрока нет — сначала зарегистрируйтесь');
    // подбор пароля одного героя с многих адресов: 30 неудач за 10 минут — вход по паролю для этого ника на паузе
    const nf = nickFails.get(key);
    if (c.thr && nf && nf.n >= 30 && now - nf.t < 600000) return c.send({ t: 'err', msg: 'Слишком много неудачных попыток входа в этого героя. Подождите 10 минут.', wait: 600 });
    const h = await hashPass(pass, rec.salt);
    if (!c.alive) return;
    if (h !== rec.hash) {
      if (c.thr) { if (nf && now - nf.t < 600000) nf.n++; else nickFails.set(key, { n: 1, t: now }); if (nickFails.size > 20000) nickFails.clear(); }
      return bad('Неверный пароль');
    }
  }
  const full = admitMsg(c, key);
  if (full) return refuse(c, full);
  // тот же игрок с другой вкладки или после обрыва связи: старое соединение уступает новому
  for (const o of conns) if (o !== c && o.key === key) {
    o.send({ t: 'kicked', msg: 'Вы вошли в деревню с другого окна или устройства' });
    try { o.sock.end(); } catch (e) { /* ничего */ }
    o.onClose();
  }
  c.nick = rec.nick; c.key = key; c.ver = typeof m.ver === 'string' ? clean(m.ver, 40) : ''; c.z = m.z === 1; c.d = m.d === 1; c.view = null;
  if (ADMINS.has(key)) c.isHost = true;
  let token;
  if (m.mode !== 'token') { token = crypto.randomBytes(24).toString('hex'); rec.toks = [...(rec.toks || []).slice(-4), sha(token)]; saveUsers(); }   // запомнить вход на этом устройстве
  const meta = JSON.parse(call('coopMeta'));
  c.send({ t: 'welcome', token, nick: c.nick, host: c.isHost, perms: meta.perms, permLabels: meta.permLabels, needClass: !rec.hero, classes: meta.classes, chat: meta.chat, sv: SERVER_VER });
  if (rec.hero) joinWorld(c);
}
const nickFails = new Map();   // ключ ника -> { n, t }: неудачные пароли с любых адресов

// Пускать ли ещё одного игрока: лимит игроков (вернувшимся после обрыва — с запасом) и перегрузка сервера
function admitMsg(c, key) {
  if (c.isHost) return null;
  const back = returning(key, c), n = online() - ([...conns].some(o => o !== c && o.key === key && o.inGame) ? 1 : 0);
  if (n >= MAX_PLAYERS + (back ? RESERVE_SLOTS : 0)) return { msg: `В деревне сейчас ${n} игроков из ${MAX_PLAYERS} возможных — мест нет. Попробуйте через несколько минут.`, wait: 30 };
  if (M.degraded >= 2 && !back) return { msg: 'Сервер сейчас сильно загружен, новых игроков пока не пускаем. Попробуйте через минуту.', wait: 30 };
  return null;
}
function refuse(c, x) { M.refused++; c.send({ t: 'err', msg: x.msg, full: true, wait: x.wait }); setTimeout(() => { try { c.sock.end(frame(8, Buffer.from([0x03, 0xf5]))); } catch (e) { /* ничего */ } }, 200); }

function onMessage(c, text) {
  let m;
  try { m = JSON.parse(text); } catch (e) { return; }
  if (!m || typeof m !== 'object' || Array.isArray(m) || typeof m.t !== 'string') return;
  if (!msgSafe(m, m.t === 'newworld')) { c.bad = (c.bad || 0) + 1; if (c.bad > 20) c.sock.destroy(); return; }
  if (!c.nick) {
    if (m.t !== 'auth' || c.authing) return;
    // до входа — не больше 10 попыток с соединения, дальше обрыв
    if ((c.tries = (c.tries || 0) + 1) > 10) { c.sock.destroy(); return; }
    c.authing = true;
    auth(c, m).catch(e => { log('ошибка входа:', e.message); c.send({ t: 'err', msg: 'Сервер не смог обработать вход, попробуйте ещё раз' }); }).finally(() => { c.authing = false; });
    return;
  }
  return onGameMessage(c, m, text);
}

function onGameMessage(c, m, text) {
  // камера клиента: какие клетки он видит — жителей за пределами шлём реже (интерес-менеджмент).
  // Шлётся при прокрутке часто, поэтому мимо общего ведра (дёшево: четыре числа)
  if (m.t === 'view') {
    const v = [m.x0, m.y0, m.x1, m.y1];
    if (v.every(Number.isFinite)) c.view = v.map(x => Math.max(-1e4, Math.min(1e4, Math.round(x))));
    return;
  }
  // защита от заливания (залипшая мышь, кривой клиент, бот): ведро на 60 сообщений, 30 в секунду — на ВСЕ сообщения
  // после входа (раньше пауза, доска почёта и прочие служебные шли мимо и рассылали тосты всем без предела)
  const nowMs = Date.now();
  c.bucket = Math.min(60, (c.bucket ?? 60) + (nowMs - (c.bucketAt || nowMs)) / 1000 * 30);
  c.bucketAt = nowMs;
  if (c.bucket < 1) {
    if (!c.warned || nowMs - c.warned > 5000) { c.warned = nowMs; c.send({ t: 'toast', text: 'Слишком много команд подряд — чуть помедленнее' }); }
    if ((c.floods = (c.floods || 0) + 1) > 3000) c.sock.destroy();   // минуты непрерывного залива — обрыв
    return;
  }
  c.bucket--;
  if (m.t === 'class') {
    const rec = users[c.key];
    if (rec.hero || c.inGame) return;
    const meta = JSON.parse(call('coopMeta'));
    if (typeof m.cls !== 'string' || !Object.prototype.hasOwnProperty.call(meta.classes, m.cls)) return;
    const full = admitMsg(c, c.key);
    if (full) return refuse(c, full);
    rec.hero = { cls: m.cls, level: 1, hp: meta.classes[m.cls].hp, inv: [{ k: 'bread', n: 2 }], look: (Math.random() * 1000) | 0 };
    if (Array.isArray(m.ap) && m.ap.length <= 12) rec.hero.ap = m.ap.map(v => (Number.isInteger(v) ? v : -1));   // облик героя (heroapp.js чистит значения при входе)
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
  if (m.t === 'newworld') {
    // хост начинает новый мир: на своей карте (m.map — карта в формате файла) или обычной генерацией (m.map = null)
    if (!c.isHost || m.confirm !== true) return c.send({ t: 'toast', text: 'Новый мир начинает только хост' });
    let text = null;
    if (m.map != null) {
      try { text = JSON.stringify(m.map); } catch (e) { text = ''; }
      if (!text || text.length > 400000) return c.send({ t: 'toast', text: 'Карта слишком большая' });
      host.ctx.__mapText = text;
      const bad = run('(function(){ const r = meParse(__mapText); __mapText = null; if (r.err) return r.err; const v = meValidate(r.map); return v.errors.length ? v.errors.join("; ") : ""; })()');
      if (bad) return c.send({ t: 'toast', text: 'Карта не принята: ' + bad });
    }
    saveWorld();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    try {
      for (const f of [WORLD_FILE, WORLD_FILE + '.bak']) if (fs.existsSync(f)) fs.renameSync(f, f.replace(/\.json(\.bak)?$/, '-' + stamp + '.json$1'));
      // снимки и копии «до обновления» старого мира тоже в архив, иначе после перезапуска сервер поднял бы из них прежний мир
      for (const f of fs.readdirSync(DATA)) if (/^world-(snap|pre)-.*\.json$/.test(f)) fs.renameSync(path.join(DATA, f), path.join(DATA, 'old-' + stamp + '-' + f));
      if (text) fs.writeFileSync(MAP_FILE, text); else if (fs.existsSync(MAP_FILE)) fs.unlinkSync(MAP_FILE);
    } catch (e) { log('новый мир не начат:', e.message); return c.send({ t: 'toast', text: 'Сервер не смог начать новый мир' }); }
    noSave = true;
    log('хост начал новый мир', text ? 'на своей карте' : 'обычной генерацией', '— старый мир в архиве', stamp);
    broadcast({ t: 'restarting' });
    setTimeout(() => process.exit(42), 300);
    return;
  }
  if (m.t === 'goalmode') {
    if (!c.isHost) return c.send({ t: 'toast', text: 'Режим мира меняет только хост' });
    if (m.mode !== 'scenario' && m.mode !== 'free') return;
    call('goalNew', m.mode);
    broadcast({ t: 'toast', text: m.mode === 'scenario' ? 'Хост включил сценарий «Тишина дороже золота»' : 'Хост включил свободную игру' });
    return;
  }
  if (m.t === 'board') {
    // доска почёта зала героев: лучшие герои сервера, в том числе те, кого сейчас нет в деревне
    const nowMs = Date.now();
    if (c.boardAt && nowMs - c.boardAt < 2000) return;
    c.boardAt = nowMs;
    const online = new Set();
    for (const o of conns) if (o.inGame) { online.add(o.key); const d = call('coopHeroData', o.nick); if (d) users[o.key].hero = JSON.parse(d); }
    const list = Object.entries(users).filter(([, r]) => r.hero).map(([k, r]) => {
      const h = r.hero, hl = h.hl || {};
      return { n: r.nick, c: h.cls, l: h.level || 1, p: hl.p || 0, dw: hl.dw || 0, dl: hl.dl || 0, tw: hl.tw || 0, t: (h.ti || []).length, tt: h.tt || null, on: online.has(k) ? 1 : 0 };
    }).sort((a, b) => b.p - a.p || b.l - a.l || a.n.localeCompare(b.n)).slice(0, 10);
    c.send({ t: 'board', list });
    return;
  }
  if (m.t === 'stats') {
    if (!c.isHost) return c.send({ t: 'toast', text: 'Статистику видит только хост' });
    stats.save();
    c.send({ t: 'stats', s: stats.summary(), server: SERVER_VER });
    return;
  }
  if (m.t === 'setdiff') {
    if (!c.isHost) return c.send({ t: 'toast', text: 'Сложность выбирает только хост' });
    const k = call('coopSetDiff', String(m.k));
    log('сложность:', k);
    broadcast({ t: 'diff', k });
    saveWorld();
    return;
  }
  if (m.t === 'speed') {
    if (!c.isHost) return c.send({ t: 'toast', text: 'Скорость выбирает только хост' });
    if (!SPEEDS_OK.includes(m.v)) return;
    tempo.speed = m.v;
    writeSettings({ speed: m.v });
    broadcast(tempoMsg());
    return;
  }
  if (m.t === 'pause') {
    const on = m.on === true;
    if (on === tempo.paused) { c.vote = false; return; }
    if (c.isHost) return setPaused(on, 'Хост ' + c.nick);
    if (c.vote && nowMs - (c.voteAt || 0) < 3000) return;   // повтор голоса не рассылает тост всем снова и снова
    c.vote = true; c.voteAt = nowMs;
    const t = tempoMsg();
    if (t.votes >= t.need) return setPaused(on, 'Голосование');
    broadcast(t);
    broadcast({ t: 'toast', text: c.nick + (on ? ' просит паузу' : ' просит продолжить') + ' (' + t.votes + '/' + t.need + ')' });
    return;
  }
  if (m.t === 'setperm') {
    if (!c.isHost) return c.send({ t: 'toast', text: 'Права меняет только хост' });
    const cur = JSON.parse(call('coopMeta')).perms;
    if (typeof m.key !== 'string' || !Object.prototype.hasOwnProperty.call(cur, m.key) || typeof m.on !== 'boolean') return;
    const now = JSON.parse(call('coopSetPerms', JSON.stringify({ [m.key]: m.on })));
    try { writeSettings({ perms: now }); } catch (e) { log('права не сохранились:', e.message); }
    broadcast({ t: 'perms', perms: now });
    log('права:', m.key, m.on ? 'вкл' : 'выкл');
    return;
  }
  // стресс-тест: вырастить деревню сразу (только с OLDGOLD_STRESS=1 и только хосту с этого компьютера)
  if (m.t === 'xgrow') {
    if (process.env.OLDGOLD_STRESS !== '1' || !c.isHost) return;
    const n = Math.max(0, Math.min(400, m.n | 0));
    run(`(function (n) {
      const st = Game.buildings.find(b => b.type === 'storehouse') || { doorX: MAP_W >> 1, doorY: MAP_H >> 1 };
      const T = ['serf', 'serf', 'serf', 'builder', 'woodcutter', 'farmer', 'stonemason', 'carpenter'];
      for (let k = 0, tries = 0; k < n && tries < n * 50; tries++) {
        const x = st.doorX + Math.floor(Math.random() * 31) - 15, y = st.doorY + Math.floor(Math.random() * 31) - 15;
        if (!inb(x, y) || !isWalkable(x, y)) continue;
        spawnUnit(T[k % T.length], x + 0.5, y + 0.5); k++;
      }
    })(${n})`);
    return;
  }
  // чат рассылается всем — не чаще раза в 1,5 секунды с игрока
  if (m.t === 'chat') { if (nowMs - (c.chatAt || 0) < 1500) return; c.chatAt = nowMs; }
  // кампания: хост переводит деревню в мир акта — прежний (не кампанийный) мир сначала уходит в архив
  if (m.t === 'campaign' && c.isHost && m.a === 'start' && !run('!!Game.camp') && saveWorld() && fs.existsSync(WORLD_FILE)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    try { fs.copyFileSync(WORLD_FILE, path.join(DATA, 'world-' + stamp + '-before-camp.json')); log('мир до кампании сохранён в архив', stamp); } catch (e) { log('архив мира перед кампанией не записан:', e.message); }
  }
  // передача предметов и декор — не чаще 4 и 8 раз в секунду (сверх этого симуляция сама режет по игровому времени)
  if (m.t === 'give') { if (nowMs - (c.giveAt || 0) < 250) return; c.giveAt = nowMs; }
  if (m.t === 'decor' || m.t === 'undecor') { if (nowMs - (c.decorAt || 0) < 120) return; c.decorAt = nowMs; }
  call('coopCmd', c.nick, text, c.isHost);
  if (m.t === 'campaign' && call('coopCampTakeReinit')) campReinit(c);
}

// мир сменился на ходу (акт кампании, контрольная точка): всем — новый мир целиком, дельты начинаются заново
function campReinit(by) {
  call('coopWorldPacket');   // базовая точка дельты мира — уже новый мир
  for (const o of conns) {
    if (!o.inGame) continue;
    call('coopViewDrop', o.nick);
    o.sendText(call('coopInitPacket', call('coopUidOf', o.nick)));
    o.send(tempoMsg());
  }
  saveWorld();
  log('кампания:', by.nick, 'сменил мир — акт', run('Game.camp ? Game.camp.act : "сценарий"'));
}

// ---------- Главный цикл ----------
let last = Date.now(), acc = 0, tU = 0, tW = 0, tMe = 0, tSave = Date.now();
let toldOverload = 0;
setInterval(() => {
  const now = Date.now(), tLoop = performance.now();
  const gapMs = Math.max(50, now - last);   // сколько прошло с прошлого тика (при перегрузе тик опаздывает)
  M.loopMax = Math.max(M.loopMax, now - last - 50); ML.loopMax = Math.max(ML.loopMax, now - last - 50);
  const dt = Math.min(0.5, (now - last) / 1000);
  last = now;
  let inGame = 0;
  for (const c of conns) if (c.inGame) inGame++;
  const online = inGame > 0;
  if (online || !PAUSE_EMPTY) {
    if (tempo.paused) acc = 0; else acc += dt * COOP_SPEED * tempo.speed;   // в общей деревне время идёт чуть быстрее обычного
    let n = 0;
    const t0 = performance.now();
    while (acc >= SIM_DT && n < 20) {
      try { host.ctx.step(SIM_DT); } catch (e) { log('ошибка шага:', e.stack); }
      acc -= SIM_DT; n++;
    }
    if (n) { const ms = (performance.now() - t0) / n; M.ticks += n; M.stepMs += ms * n; M.stepMax = Math.max(M.stepMax, ms); ML.ticks += n; ML.stepMs += ms * n; ML.stepMax = Math.max(ML.stepMax, ms); }
    if (n >= 20) acc = 0;
  } else { acc = 0; if (tempo.paused) setPaused(false); }
  if (online) {
    tU += dt; tW += dt; tMe += dt;
    // деградация: сервер не успевает — снимки жителей и мира реже (меньше работы и трафика), игра при этом идёт
    const slow = M.degraded >= 1;
    if (tU >= (slow ? 0.4 : inGame >= 16 ? 0.3 : 0.2)) { tU = 0; const t1 = performance.now(); sendUnits(); const ms = performance.now() - t1; M.uN = (M.uN || 0) + 1; M.uMs += ms; M.uMax = Math.max(M.uMax, ms); }
    if (tW >= (slow ? 1 : 0.5)) { tW = 0; const t1 = performance.now(); const w = call('coopWorldPacket'); const ms = performance.now() - t1; M.wN = (M.wN || 0) + 1; M.wMs += ms; M.wMax = Math.max(M.wMax, ms); if (w) broadcast(w); }
    if (tMe >= 1) { tMe = 0; for (const c of conns) if (c.inGame) { const me = call('coopMeData', c.nick); if (me) c.sendText(me); } }
    const ev = JSON.parse(call('coopDrain'));
    for (const e of ev) {
      broadcast(e.msg, e.to);
    }
  } else call('coopDrain');
  if (now - tSave >= SAVE_EVERY) { tSave = now; const t2 = performance.now(); const ok = saveWorld(); const ms = performance.now() - t2; M.saveN++; M.saveMs += ms; M.saveMax = Math.max(M.saveMax, ms); if (ok && online) broadcast({ t: 'saved' }); }
  // загрузка цикла: доля времени, занятая работой между тиками (скользящее среднее). >60% — реже снимки, >85% — новых игроков не пускаем
  M.busy = M.busy * 0.97 + Math.min(1.5, (performance.now() - tLoop) / gapMs) * 0.03;
  const lvl = M.busy > 0.85 ? 2 : M.busy > 0.6 ? 1 : M.busy < 0.4 ? 0 : M.degraded;
  if (lvl !== M.degraded) {
    M.degraded = lvl;
    log('нагрузка:', ['норма', 'тяжело — снимки реже', 'перегруз — новых игроков не пускаем'][lvl], `(цикл занят на ${Math.round(M.busy * 100)}%)`);
    if (lvl === 2 && now - toldOverload > 60000) { toldOverload = now; broadcast({ t: 'toast', text: 'Сервер перегружен: игра может замедлиться, новых игроков пока не пускаем' }); }
  }
}, 50);

// Пинг: браузер сам отвечает на него, а молчащее больше минуты соединение (сон ноутбука, обрыв Wi-Fi) закрываем —
// иначе герой висит в деревне, а игрок не может зайти снова
setInterval(() => {
  const now = Date.now();
  for (const c of conns) {
    // не ответил на вежливое закрытие (держит соединение полуоткрытым) — рвём, иначе занимает место в MAX_CONNS навсегда
    if (!c.nick && now - c.born > AUTH_TIMEOUT + 10000) { try { c.sock.destroy(); } catch (e) { /* ничего */ } c.onClose(); }
    else if (!c.nick && now - c.born > AUTH_TIMEOUT) { try { c.sock.end(Buffer.concat([frame(1, Buffer.from(JSON.stringify({ t: 'err', msg: 'Время на вход вышло — зайдите снова' }))), frame(8, Buffer.from([0x03, 0xe8]))])); } catch (e) { /* ничего */ } }
    else if (now - c.seen > 60000) { try { c.sock.destroy(); } catch (e) { /* ничего */ } c.onClose(); }
    else if (!c.sock.destroyed && now - (c.pinged || 0) >= 20000) { c.pinged = now; c.sock.write(frame(9, Buffer.alloc(0))); }
  }
  for (const [k, t] of left) if (now - t > RETURN_WINDOW) left.delete(k);
  for (const [k, f] of authFails) if (now - f.t > 60000) authFails.delete(k);
}, 5000);

function shutdown() { log('остановка, сохраняю мир…'); saveWorld(); process.exit(0); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(PORT, process.env.HOST || '0.0.0.0', () => {
  log(`Сервер OldGold запущен на порту ${PORT}`);
  log(`Хост играет здесь:  http://localhost:${PORT}/`);
  // список адресов — только подсказка для LAN; под песочницей systemd без AF_NETLINK вызов бросает EAFNOSUPPORT и ронял сервер на старте
  let ifaces = {};
  try { ifaces = os.networkInterfaces(); } catch (e) { log('адреса сети не прочитались (песочница?):', e.code || e.message); }
  for (const list of Object.values(ifaces))
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) log(`Друзьям в сети:     http://${a.address}:${PORT}/`);
  log(`Данные: ${DATA}`);
});
