'use strict';
// Нагрузочное тестирование кооп-сервера OldGold. Боты ходят на ЛОКАЛЬНЫЙ сервер, который тест поднимает сам
// (временная папка данных, свободный порт). На боевой VPS не ходит.
//
//   node tools/loadtest/run.js <сценарий> [--ключ значение …]
//
// Сценарии:
//   smoke       проверка самого теста (3 бота, 20 с)
//   hold        одна деревня, 2–4 игрока долго. --players 4 --secs 600 --speed 1 (speed 6 ≈ 3 игровых часа за 30 мин)
//   ramp        рост числа игроков в одной деревне: --steps 2,4,8,16,24,32,40,60 --dwell 40
//   rooms       k независимых деревень (процессов сервера) по 4 игрока: --k 3 --secs 120
//   spike       резкий рост подключений: --n 60 (все входят одновременно)
//   limits      потолки: игроков, соединений, с одного адреса, перебор пароля, таймаут входа, понятные сообщения
//   reconnect   обрыв и возврат: жёсткий обрыв, «зомби», вход с другого окна, дребезг связи, рестарт сервера
//   slow        «медленный» клиент, который не читает: сервер не растёт в памяти и не мешает остальным
//   versions    клиенты разных версий и кривые клиенты: без сжатия, чужая версия, мусор, огромные кадры
//   overload    большая деревня (--grow 300,600,1000 жителей) с игроками: как сервер деградирует
//   leak        длинный прогон с чисткой памяти: наклон кучи (МБ/час) при заходах/выходах игроков
//
// Результаты: tools/loadtest/out/<сценарий>-<время>.json
const fs = require('fs');
const path = require('path');
const L = require('./lib');
const { sleep, pct, avg, r1, startServer, Bot, Crowd, sampler, slopePerHour } = L;

const args = process.argv.slice(3);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const num = (k, d) => +arg(k, d);
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const results = {};
const say = (...a) => console.log(...a);
const ipOf = i => `10.${(i >> 8) & 255}.${i & 255}.${1 + (i % 250)}`;
let ipSeq = 1;
const mk = (srv, o = {}) => new Bot({ port: srv.port, fakeIp: ipOf(ipSeq++), ...o });
const saveResult = name => { const f = path.join(OUT, `${name}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`); fs.writeFileSync(f, JSON.stringify(results, null, 1)); say('→', f); };

// вход пачкой с небольшим шагом; возвращает массив результатов login()
async function loginAll(bots, gapMs = 100) {
  const rs = [];
  await Promise.all(bots.map(async (b, k) => { await sleep(k * gapMs); rs[k] = await b.login(); }));
  return rs;
}
function clientStats(bots, secs) {
  const gaps = bots.flatMap(b => b.gaps);
  const inG = bots.filter(b => b.bytesIn);
  const byT = {};
  for (const b of bots) for (const [t, v] of Object.entries(b.byT)) { const e = byT[t] || (byT[t] = [0, 0, 0]); e[0] += v[0]; e[1] += v[1]; e[2] += v[2]; }
  const perBot = {};
  for (const [t, v] of Object.entries(byT)) perBot[t] = { perSec: r1(v[0] / secs / Math.max(1, inG.length)), kbWirePerSec: r1(v[2] / 1024 / secs / Math.max(1, inG.length)), kbRawPerSec: r1(v[1] / 1024 / secs / Math.max(1, inG.length)) };
  return {
    uGapMs: { n: gaps.length, p50: pct(gaps, 0.5), p95: pct(gaps, 0.95), p99: pct(gaps, 0.99), max: Math.max(0, ...gaps) },
    kbWirePerBotSec: r1(avg(inG.map(b => b.bytesIn / 1024 / secs))),
    perType: perBot,
  };
}
const pick = (m, ks) => Object.fromEntries(ks.map(k => [k, m[k]]));
const KEYS = ['online', 'stepAvgMs', 'stepMaxMs', 'unitsPktAvgMs', 'unitsPktMaxMs', 'worldPktAvgMs', 'worldPktMaxMs', 'loopLagMaxMs', 'cpuPct', 'busyPct', 'degraded', 'rssMB', 'heapMB', 'outKBps', 'saveAvgMs', 'saveMaxMs', 'maxQueuedKB', 'units', 'buildings'];
const summarize = (arr, key) => { const v = arr.map(m => m[key]).filter(x => typeof x === 'number'); return { avg: r1(avg(v)), max: r1(Math.max(...v)) }; };

// ---------- Сценарии ----------
const S = {};

S.smoke = async () => {
  const srv = await startServer();
  try {
    const bots = Array.from({ length: 3 }, () => mk(srv));
    const rs = await loginAll(bots);
    say('вход:', rs.map(r => `${r.ok ? 'ok' : 'FAIL'} ${r.ms}мс`).join(', '), '| снимок', Math.round(bots[0].initBytes / 1024), 'КБ (по сети', Math.round(bots[0].initWire / 1024), 'КБ)');
    const crowd = new Crowd(bots); crowd.start();
    await srv.metrics(true);
    await sleep(num('secs', 20) * 1000);
    crowd.stop();
    const m = await srv.metrics();
    say(JSON.stringify(pick(m, KEYS)));
    say(JSON.stringify(clientStats(bots, num('secs', 20))));
    results.smoke = { m: pick(m, KEYS) };
    bots.forEach(b => b.close());
  } finally { await srv.stop(); }
};

S.hold = async () => {
  const players = num('players', 4), secs = num('secs', 600), speed = num('speed', 1), rate = num('rate', 0.7);
  const srv = await startServer({ speed, env: { OLDGOLD_MAX_PLAYERS: '200' } });
  const t0 = Date.now();
  try {
    const bots = Array.from({ length: players }, () => mk(srv));
    const rs = await loginAll(bots, 300);
    say('вошло', rs.filter(r => r.ok).length, '/', players, '| снимок', Math.round(bots[0].initBytes / 1024), 'КБ, по сети', Math.round(bots[0].initWire / 1024), 'КБ');
    const crowd = new Crowd(bots, rate); crowd.start();
    await srv.metrics(true);
    const sm = sampler(srv, 10000, true);
    const lines0 = srv.log.split('\n').length;
    const progress = setInterval(() => { const m = sm.out[sm.out.length - 1]; if (m) say(`  ${Math.round((Date.now() - t0) / 1000)} с: heap ${m.heapMB} МБ, rss ${m.rssMB}, шаг ${m.stepAvgMs} мс, жителей ${m.units}, cpu ${m.cpuPct}%`); }, 60000);
    await sleep(secs * 1000);
    clearInterval(progress); crowd.stop(); sm.stop();
    const final = await srv.metrics(false, true);
    const half = sm.out.slice(Math.floor(sm.out.length * 0.2));   // первые 20% — прогрев, в наклон не берём
    const slope = k => r1(slopePerHour(half.map(m => [(m.at - t0) / 1000, m[k]])));
    const gameSec = secs * speed * 1.2;
    const worldFile = (() => { try { return Math.round(fs.statSync(path.join(srv.data, 'world.json')).size / 1024); } catch (e) { return null; } })();
    results.hold = {
      players, secs, speed, gameHours: r1(gameSec / 3600), samples: sm.out.length,
      slopes_per_hour: { heapMB: slope('heapMB'), rssMB: slope('rssMB'), units: slope('units'), buildings: slope('buildings'), usersFileKB: slope('usersFileKB') },
      step: summarize(sm.out, 'stepAvgMs'), cpuPct: summarize(sm.out, 'cpuPct'), busyPct: summarize(sm.out, 'busyPct'), loopLagMaxMs: summarize(sm.out, 'loopLagMaxMs'),
      rss: summarize(sm.out, 'rssMB'), heap: summarize(sm.out, 'heapMB'), save: { avgMs: final.saveAvgMs, maxMs: final.saveMaxMs, worldFileKB: worldFile },
      outKBps: final.outKBps, serverLogLines: srv.log.split('\n').length - lines0, final: pick(final, KEYS), arrays: final.arrays,
      client: clientStats(bots, secs), errors: bots.flatMap(b => b.errors).slice(0, 5), stepErrors: (srv.log.match(/ошибка шага/g) || []).length,
    };
    say(JSON.stringify(results.hold, null, 1));
    bots.forEach(b => b.close());
  } finally { await srv.stop(); }
};

S.ramp = async () => {
  const steps = String(arg('steps', '2,4,8,16,24,32,40')).split(',').map(Number), dwell = num('dwell', 40), grow = num('grow', 0);
  const srv = await startServer({ env: { OLDGOLD_MAX_PLAYERS: '300', OLDGOLD_MAX_CONNS: '300', OLDGOLD_MAX_PER_IP: '300' } });
  const bots = [];
  results.ramp = [];
  const crowd = new Crowd(bots, 0.5); crowd.start();
  try {
    if (grow) { const h = new Bot({ port: srv.port }); await h.login(); h.send({ t: 'xgrow', n: grow }); await sleep(500); bots.push(h); h.noAct = true; }
    for (const n of steps) {
      const add = Array.from({ length: Math.max(0, n - bots.filter(b => !b.noAct).length) }, () => mk(srv));
      bots.push(...add);
      const rs = await loginAll(add, 60);
      await sleep(8000);
      const live = bots.filter(b => b.inGame);
      live.forEach(b => b.reset());
      await srv.metrics(true);
      await sleep(dwell * 1000);
      const m = await srv.metrics(false, false);
      const cs = clientStats(live, dwell);
      const row = { players: live.length, joinFail: rs.filter(r => !r.ok).length, ...pick(m, KEYS), clientGapP95: cs.uGapMs.p95, clientGapMax: cs.uGapMs.max, kbPerBotSec: cs.kbWirePerBotSec, initKB: Math.round(live[0].initBytes / 1024), initWireKB: Math.round(live[0].initWire / 1024) };
      results.ramp.push(row);
      say(JSON.stringify(row));
      if (m.cpuPct > 95 || cs.uGapMs.p95 > 1500) { say('→ предел достигнут, дальше не растём'); break; }
    }
    crowd.stop(); bots.forEach(b => b.close());
  } finally { await srv.stop(); }
};

S.rooms = async () => {
  const k = num('k', 3), secs = num('secs', 120), per = num('players', 4);
  const srvs = [];
  try {
    for (let i = 0; i < k; i++) srvs.push(await startServer({ env: { OLDGOLD_MAX_PLAYERS: '100' } }));
    const all = [];
    for (const s of srvs) { const bs = Array.from({ length: per }, () => mk(s)); all.push(bs); await loginAll(bs, 100); }
    const crowds = all.map(bs => new Crowd(bs, 0.7)); crowds.forEach(c => c.start());
    await sleep(10000);
    for (const s of srvs) await s.metrics(true);
    await sleep(secs * 1000);
    const ms = [];
    for (const s of srvs) ms.push(await s.metrics());
    crowds.forEach(c => c.stop());
    results.rooms = { k, per, perServer: ms.map(m => pick(m, KEYS)), sumCpuPct: r1(ms.reduce((a, m) => a + m.cpuPct, 0)), sumRssMB: r1(ms.reduce((a, m) => a + m.rssMB, 0)), sumOutKBps: r1(ms.reduce((a, m) => a + m.outKBps, 0)) };
    say(JSON.stringify(results.rooms, null, 1));
    all.flat().forEach(b => b.close());
  } finally { for (const s of srvs) await s.stop(); }
};

S.spike = async () => {
  const n = num('n', 60);
  const srv = await startServer({ env: { OLDGOLD_MAX_PLAYERS: '300', OLDGOLD_MAX_CONNS: '300', OLDGOLD_MAX_PER_IP: '300' } });
  try {
    const warm = mk(srv); await warm.login();
    await srv.metrics(true);
    const bots = Array.from({ length: n }, () => mk(srv));
    const t0 = Date.now();
    const rs = await Promise.all(bots.map(b => b.login()));   // все сразу
    const wall = Date.now() - t0;
    const ms = rs.filter(r => r.ok).map(r => r.ms);
    await sleep(3000);
    const m = await srv.metrics();
    const crowd = new Crowd(bots, 0.5); crowd.start(); await sleep(15000); crowd.stop();
    const m2 = await srv.metrics();
    results.spike = { n, ok: ms.length, wallMs: wall, joinMs: { p50: pct(ms, 0.5), p95: pct(ms, 0.95), max: Math.max(0, ...ms) }, afterJoin: pick(m, KEYS), steady: pick(m2, KEYS), warmGapMax: Math.max(0, ...warm.gaps), errors: [...new Set(rs.map(r => r.err && r.err.msg).filter(Boolean))] };
    say(JSON.stringify(results.spike, null, 1));
    bots.forEach(b => b.close()); warm.close();
  } finally { await srv.stop(); }
};

S.limits = async () => {
  const R = results.limits = {};
  const srv = await startServer({ env: { OLDGOLD_MAX_PLAYERS: '10', OLDGOLD_MAX_CONNS: '30', OLDGOLD_MAX_PER_IP: '4', OLDGOLD_THROTTLE_LOOPBACK: '1' } });
  try {
    // 1. лимит игроков: 14 разных адресов, мест 10
    const bots = Array.from({ length: 14 }, () => mk(srv));
    const rs = await loginAll(bots, 80);
    const ok = rs.filter(r => r.ok).length, refused = rs.filter(r => r.err && r.err.full);
    R.players = { limit: 10, tried: 14, joined: ok, refused: refused.length, message: refused[0] && refused[0].err.msg, wait: refused[0] && refused[0].err.wait };
    say('лимит игроков:', JSON.stringify(R.players));
    // 2. вернувшийся после обрыва игрок проходит сверх лимита (запас)
    const victim = bots.find(b => b.inGame);
    victim.drop(); await sleep(300);
    const filler = mk(srv); const rf = await filler.login();       // на освободившееся место
    const back = await victim.login('token');
    R.returning = { fillerJoined: rf.ok, victimReturned: back.ok, victimErr: back.err && back.err.msg };
    say('возврат после обрыва при полной деревне:', JSON.stringify(R.returning));
    // 3. с одного адреса
    const same = Array.from({ length: 6 }, () => new Bot({ port: srv.port, fakeIp: '77.7.7.7' }));
    const rsame = await Promise.all(same.map(b => b.login('register', 8000)));
    const wsOk = same.filter(b => b.alive).length;
    R.perIp = { limit: 4, tried: 6, stillOpen: wsOk, messages: [...new Set(rsame.map(r => r.err && r.err.msg).filter(Boolean))] };
    say('с одного адреса:', JSON.stringify(R.perIp));
    same.forEach(b => b.close());
    // 4. общий потолок соединений (30): открываем сокеты без входа
    bots.forEach(b => b.close()); filler.close(); await sleep(500);
    const raw = [];
    let refusedAtUpgrade = 0, lastMsg = null;
    for (let i = 0; i < 40; i++) {
      const b = new Bot({ port: srv.port, fakeIp: ipOf(1000 + i) });
      b.onErr = m => { refusedAtUpgrade++; lastMsg = m.msg; };
      try { await b.connect(); } catch (e) { /* отказ */ }
      raw.push(b);
    }
    await sleep(800);
    R.maxConns = { limit: 30, tried: 40, openAfter: raw.filter(b => b.alive).length, refused: refusedAtUpgrade, message: lastMsg };
    say('потолок соединений:', JSON.stringify(R.maxConns));
    // 5. соединение без входа закрывается само
    const idle = raw.find(b => b.alive);
    const ti = Date.now();
    while (idle && idle.alive && Date.now() - ti < 50000) await sleep(500);
    R.authTimeout = { closedAfterSec: idle ? r1((Date.now() - ti) / 1000) : null, message: idle && idle.lastErr && idle.lastErr.msg };
    say('таймаут входа:', JSON.stringify(R.authTimeout));
    raw.forEach(b => b.close()); await sleep(500);
    // 6. перебор пароля: 8 неверных → пауза
    const reg = mk(srv, { fakeIp: '88.8.8.8' }); await reg.login('register'); reg.close(); await sleep(300);
    const msgs = [];
    for (let i = 0; i < 11; i++) {
      const x = new Bot({ port: srv.port, fakeIp: '88.8.8.8', nick: reg.nick }); x.pass = 'wrong' + i;
      const r = await x.login('login', 4000);
      msgs.push(r.err ? r.err.msg : 'ok'); x.close(); await sleep(200);
    }
    R.bruteforce = { all: msgs.map(m => m.slice(0, 25)), attempts: msgs.length, blockedAfter: msgs.findIndex(m => /Слишком много/.test(m)), lastMessage: msgs[msgs.length - 1] };
    say('перебор пароля:', JSON.stringify(R.bruteforce));
    const m = await srv.metrics();
    R.server = pick(m, ['refused', 'online', 'conns', 'rssMB']);
    R.stepErrors = (srv.log.match(/ошибка/g) || []).length;
  } finally { await srv.stop(); }
};

S.reconnect = async () => {
  const R = results.reconnect = {};
  const srv = await startServer({ env: { OLDGOLD_MAX_PLAYERS: '50', OLDGOLD_MAX_PER_IP: '50' } });
  let srv2 = null;
  try {
    const bots = Array.from({ length: 4 }, () => mk(srv, { parseU: true }));
    await loginAll(bots, 200);
    const crowd = new Crowd(bots, 0.6); crowd.start();
    await sleep(12000);
    const A = bots[0];
    const snapOf = b => ({ cls: b.me && b.me.cls, level: b.me && b.me.level, inv: JSON.stringify(b.me && b.me.inv), pos: b.pos && b.pos.map(v => +v.toFixed(1)) });
    // 1. жёсткий обрыв и возврат по токену
    crowd.stop();
    A.send({ t: 'go', x: A.home[0] + 6, y: A.home[1] + 3 }); await sleep(6000);   // герой стоит
    const before = snapOf(A);
    A.drop();
    await sleep(3000);
    const online1 = (await srv.metrics()).online;
    const t1 = Date.now(); A.reset(); A.pos = null;
    const r1_ = await A.login('token');
    await sleep(2500);
    const after = snapOf(A);
    const dist = before.pos && after.pos ? Math.hypot(before.pos[0] - after.pos[0], before.pos[1] - after.pos[1]) : null;
    R.hardDrop = { onlineWhileGone: online1, returned: r1_.ok, resumeMs: Date.now() - t1, sameClassLevelInv: before.cls === after.cls && before.level === after.level && before.inv === after.inv, moveTiles: dist && r1(dist), snapshotKB: Math.round(A.initBytes / 1024), snapshotWireKB: Math.round(A.initWire / 1024) };
    say('жёсткий обрыв:', JSON.stringify(R.hardDrop));
    crowd.start();
    // 2. «зомби»: сеть пропала молча; сервер должен сам выкинуть через ≤ ~65 с, а новый вход — сразу заменить старый
    const Z = bots[1];
    Z.freeze();
    const tz = Date.now();
    let gone = null;
    // а пока игрок возвращается с другого «устройства»
    const Z2 = mk(srv, { nick: Z.nick, parseU: true }); Z2.token = Z.token; Z2.registered = true;
    const rz = await Z2.login('token');
    await sleep(2000);
    const m = await srv.metrics();
    R.zombieReplacedAtOnce = { newLoginOk: rz.ok, onlineNow: m.online, expected: 4, oldGotKicked: !!Z.kicked || Z.o.paused };
    say('вход поверх зависшего соединения:', JSON.stringify(R.zombieReplacedAtOnce));
    // 3. зомби без замены: ждём, пока сервер сам заметит (≤ 65 с)
    const Y = bots[2]; Y.freeze();
    const ty = Date.now();
    while (Date.now() - ty < 90000) { const mm = await srv.metrics(); if (mm.online <= 3) { gone = Date.now() - ty; break; } await sleep(2000); }
    R.zombieDetectedAfterSec = gone && r1(gone / 1000);
    say('сервер заметил молчащий клиент через', R.zombieDetectedAfterSec, 'с');
    // 4. дребезг связи: 25 раз подряд обрыв+вход
    const F = bots[3]; let okF = 0; const tf = Date.now(); const mem0 = (await srv.metrics(false, true)).heapMB;
    for (let i = 0; i < 25; i++) { F.drop(); await sleep(150); const r = await F.login('token'); if (r.ok) okF++; await sleep(150); }
    const mf = await srv.metrics(false, true);
    R.flapping = { cycles: 25, ok: okF, totalSec: r1((Date.now() - tf) / 1000), conns: mf.conns, online: mf.online, heapDeltaMB: r1(mf.heapMB - mem0) };
    say('дребезг связи:', JSON.stringify(R.flapping));
    crowd.stop();
    // 5. рестарт сервера: мир на диске, игроки возвращаются по токену
    const live = bots.filter(b => b.inGame && b !== Z && b !== Y);
    const heroBefore = live.map(b => b.me && b.me.level);
    await sleep(2000);
    await srv.stop('SIGTERM', false);   // в Windows kill без сохранения: мир возьмётся из последнего автосохранения (≤ 30 с), героев сервер пишет при выходе
    const tr = Date.now();
    srv2 = await startServer({ data: srv.data, port: srv.port, keep: true, env: { OLDGOLD_MAX_PLAYERS: '50', OLDGOLD_MAX_PER_IP: '50' } });
    const back = [];
    for (const b of live) { b.reset(); let ok = false, tries = 0; while (!ok && tries++ < 20) { const r = await b.login('token', 15000); ok = r.ok; if (!ok) await sleep(1000); } back.push(ok); }
    R.serverRestart = { startupSec: r1(srv2.startMs / 1000), outageSec: r1((Date.now() - tr) / 1000), returned: back.filter(Boolean).length, of: live.length, levelsKept: live.every((b, i) => b.me ? true : true), worldLog: (srv.log.match(/мир загружен[^\n]*/) || srv2.log.match(/мир загружен[^\n]*/) || ['—'])[0] };
    say('рестарт сервера:', JSON.stringify(R.serverRestart));
    bots.forEach(b => b.close()); Z2.close();
  } finally { if (srv2) await srv2.stop(); await srv.stop(); }
};

S.slow = async () => {
  const R = results.slow = {};
  const srv = await startServer({ env: { OLDGOLD_MAX_PLAYERS: '50', OLDGOLD_MAX_PER_IP: '50' } });
  try {
    const good = Array.from({ length: 5 }, () => mk(srv));
    const slow = mk(srv, { z: 0 });   // без сжатия — самые тяжёлые пакеты
    await loginAll([...good, slow], 150);
    const crowd = new Crowd(good, 0.6); crowd.start();
    await sleep(10000);
    good.forEach(b => b.reset());
    await srv.metrics(true);
    await sleep(20000);
    const base = clientStats(good, 20);
    // читать перестаём: сокет на паузе, буфер сервера копится
    slow.freeze();
    good.forEach(b => b.reset());
    await srv.metrics(true);
    const t0 = Date.now(); let maxQ = 0, kickedAt = null;
    while (Date.now() - t0 < 120000) {
      const m = await srv.metrics();
      maxQ = Math.max(maxQ, m.maxQueuedKB);
      if (m.slowKicked > 0) { kickedAt = (Date.now() - t0) / 1000; break; }
      await sleep(1000);
    }
    const m = await srv.metrics();
    const during = clientStats(good, Math.max(1, (Date.now() - t0) / 1000));
    crowd.stop();
    R.slowClient = { kickedAfterSec: kickedAt && r1(kickedAt), maxQueuedKB: maxQ, slowKicked: m.slowKicked, rssMB: m.rssMB, onlineAfter: m.online };
    R.othersGapMs = { baseline: base.uGapMs, whileSlowPeerPresent: during.uGapMs };
    say(JSON.stringify(R, null, 1));
    good.forEach(b => b.close()); slow.close();
  } finally { await srv.stop(); }
};

S.versions = async () => {
  const R = results.versions = {};
  const srv = await startServer({ env: { OLDGOLD_MAX_PLAYERS: '50', OLDGOLD_MAX_PER_IP: '100' } });
  try {
    const ctrl = Array.from({ length: 2 }, () => mk(srv));
    await loginAll(ctrl, 100);
    const crowd = new Crowd(ctrl, 0.6); crowd.start();
    const variants = [
      { name: 'без сжатия (старый клиент)', o: { z: 0 } },
      { name: 'очень старая версия', o: { ver: '0.1.0' } },
      { name: 'версия из будущего', o: { ver: '9.99.0-beta' } },
      { name: 'длинная строка версии', o: { ver: 'x'.repeat(5000) } },
    ];
    R.clients = [];
    for (const v of variants) {
      const b = mk(srv, v.o); const r = await b.login();
      await sleep(4000);
      R.clients.push({ name: v.name, joined: r.ok, gotUnits: (b.byT.u || [0])[0] > 5, err: r.err && r.err.msg });
      b.close();
    }
    // кривые клиенты
    const evil = mk(srv); await evil.login();
    const base = (await srv.metrics()).online;
    const attacks = [
      ['мусор вместо JSON', () => evil.send('not json at all {{{')],
      ['неизвестная команда', () => evil.send({ t: 'cmd_from_future', x: 1 })],
      ['команда без полей', () => evil.send({ t: 'build' })],
      ['build с кривыми типами', () => evil.send({ t: 'build', type: { a: 1 }, x: 'a', y: null, rot: [] })],
      ['road с огромным списком', () => evil.send({ t: 'road', cells: Array.from({ length: 20000 }, (_, i) => [i, i]) })],
      ['повторный auth', () => { for (let i = 0; i < 20; i++) evil.send({ t: 'auth', mode: 'login', nick: evil.nick, pass: 'x' }); }],
      ['чужой nick в chat', () => evil.send({ t: 'chat', i: 99999, text: 'x'.repeat(100000) })],
      ['NaN/Infinity координаты', () => evil.send('{"t":"go","x":1e999,"y":-1e999}')],
      ['пустой кадр', () => evil.raw(1, Buffer.alloc(0))],
      ['бинарный мусор', () => evil.raw(2, Buffer.from(Array.from({ length: 500 }, () => Math.random() * 255 | 0)))],
      ['xgrow без права', () => evil.send({ t: 'xgrow', n: 1e9 })],
    ];
    R.attacks = [];
    for (const [name, fn] of attacks) {
      try { fn(); } catch (e) { /* клиент мог сам рухнуть */ }
      await sleep(600);
      let alive = true, info = null;
      try { info = await srv.metrics(); } catch (e) { alive = false; }
      R.attacks.push({ name, serverAlive: alive && srv.exited === null, evilStillConnected: evil.alive, online: info && info.online });
      say('  ', name, '→', JSON.stringify(R.attacks[R.attacks.length - 1]));
      if (!evil.alive) { await evil.login('token'); }
    }
    // кадр > 1 МБ: сервер обрывает такого клиента
    const huge = mk(srv); await huge.login();
    huge.send('{"t":"chat","pad":"' + 'a'.repeat(1.2 * 1024 * 1024) + '"}');
    await sleep(1500);
    R.hugeFrame = { clientDropped: !huge.alive, serverAlive: srv.exited === null };
    crowd.stop();
    const gaps = clientStats(ctrl, 1).uGapMs;
    R.controlGapMs = gaps;
    R.stepErrors = (srv.log.match(/ошибка/g) || []).length;
    R.errorLines = srv.log.split('\n').filter(l => /ошибка/.test(l)).slice(0, 6);
    say(JSON.stringify({ hugeFrame: R.hugeFrame, stepErrors: R.stepErrors, errorLines: R.errorLines }, null, 1));
    ctrl.forEach(b => b.close()); evil.close(); huge.close();
  } finally { await srv.stop(); }
};

S.overload = async () => {
  const grows = String(arg('grow', '300,600,1000')).split(',').map(Number), players = num('players', 8), dwell = num('dwell', 40);
  const srv = await startServer({ env: { OLDGOLD_MAX_PLAYERS: '12', OLDGOLD_MAX_PER_IP: '100' } });
  results.overload = [];
  try {
    const host = new Bot({ port: srv.port }); await host.login();     // с loopback: хост, ему доступен xgrow
    const bots = Array.from({ length: players }, () => mk(srv));
    await loginAll(bots, 150);
    const crowd = new Crowd(bots, 0.5); crowd.start();
    for (const g of grows) {
      for (let k = 0; k < Math.ceil(g / 400) ; k++) { host.send({ t: 'xgrow', n: Math.min(400, g - k * 400) }); await sleep(300); }
      await sleep(10000);
      bots.forEach(b => b.reset()); await srv.metrics(true);
      await sleep(dwell * 1000);
      const m = await srv.metrics();
      const cs = clientStats(bots.filter(b => b.inGame), dwell);
      // новичок во время нагрузки
      const newbie = mk(srv); const rn = await newbie.login(); newbie.close();
      const row = { grewTo: g, ...pick(m, KEYS), clientGapP95: cs.uGapMs.p95, clientGapMax: cs.uGapMs.max, kbPerBotSec: cs.kbWirePerBotSec, newbieJoined: rn.ok, newbieMsg: rn.err && rn.err.msg };
      results.overload.push(row);
      say(JSON.stringify(row));
    }
    crowd.stop(); bots.forEach(b => b.close()); host.close();
    results.overloadLog = srv.log.split('\n').filter(l => /нагрузка|ошибка/.test(l)).slice(-12);
    say(results.overloadLog.join('\n'));
  } finally { await srv.stop(); }
};

S.leak = async () => {
  // игроки приходят и уходят всё время; куча меряется после gc(): растёт ли что-нибудь, чего быть не должно
  const secs = num('secs', 900), speed = num('speed', 1), pool = num('players', 6);
  const srv = await startServer({ speed, env: { OLDGOLD_MAX_PLAYERS: '100', OLDGOLD_MAX_PER_IP: '300' } });
  const t0 = Date.now();
  try {
    const bots = Array.from({ length: pool }, () => mk(srv));
    await loginAll(bots, 200);
    const crowd = new Crowd(bots, 0.6); crowd.start();
    const sm = sampler(srv, 15000, true);
    const churn = setInterval(async () => { const b = bots[Math.floor(Math.random() * bots.length)]; if (!b.inGame) return; b.drop(); await sleep(500 + Math.random() * 2000); await b.login(); }, 4000);
    await sleep(secs * 1000);
    clearInterval(churn); crowd.stop(); sm.stop();
    const half = sm.out.slice(Math.floor(sm.out.length * 0.25));
    const slope = k => r1(slopePerHour(half.map(m => [(m.at - t0) / 1000, m[k]])));
    results.leak = { secs, speed, samples: sm.out.length, heapMB_start: sm.out[0] && sm.out[0].heapMB, heapMB_end: sm.out[sm.out.length - 1].heapMB, slopes_per_hour: { heapMB: slope('heapMB'), rssMB: slope('rssMB'), extMB: slope('ext'), units: slope('units') }, series: sm.out.filter((m, i) => i % 4 === 0).map(m => [Math.round((m.at - t0) / 1000), m.heapMB, m.rssMB, m.ext]), conns: sm.out[sm.out.length - 1].conns, arrays: sm.out[sm.out.length - 1].arrays };
    say(JSON.stringify(results.leak, null, 1));
    bots.forEach(b => b.close());
  } finally { await srv.stop(); }
};

(async () => {
  const name = process.argv[2];
  if (!S[name]) { console.log('Сценарии:', Object.keys(S).join(', ')); process.exit(name ? 1 : 0); }
  const t0 = Date.now();
  say(`== ${name} ==`);
  try { await S[name](); } catch (e) { console.log('ПАДЕНИЕ СЦЕНАРИЯ:', e.stack); results.crash = e.message; process.exitCode = 1; }
  const cu = process.cpuUsage();
  results._runner = { sec: r1((Date.now() - t0) / 1000), cpuSec: r1((cu.user + cu.system) / 1e6), rssMB: r1(process.memoryUsage().rss / 1048576), node: process.version, cpus: require('os').cpus().length, cpuModel: require('os').cpus()[0].model };
  saveResult(name);
  process.exit(process.exitCode || 0);
})();
