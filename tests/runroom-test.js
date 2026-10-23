'use strict';
// Кооп-забег (КООП_ЗАБЕГ.md, этап 4): комнаты server/rooms.js + бой server/runroom.js.
//  1. Без сети: пятеро ботов собираются по коду, готовность, старт, обрыв и возврат, один сдаётся, забег доходит до конца,
//     каждый получает итог с наградой, герои уходят из деревни и возвращаются (хуки out/back).
//  2. Через настоящий сервер: два игрока по WebSocket входят в деревню, собирают отряд, получают карту и снимки,
//     шлют ввод, сдаются — получают итог, а герой возвращается в деревню. Деревня при этом живёт.
// Запуск: node tests/runroom-test.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const RS = require('../js/run/runsim.js');
const { botInput } = require('./lib/runbot');
const { createRooms } = require('../server/rooms.js');
const { createRunKind, heroFrom } = require('../server/runroom.js');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

// ---------- 1. без сети ----------
{
  let NOW = 1e12;
  const outs = [], backs = [], inbox = {};
  let rooms = null;
  const kind = createRunKind({ out: k => outs.push(k), back: k => backs.push(k), finish: r => rooms.finish(r) });
  rooms = createRooms({ kinds: { run: kind }, now: () => NOW, grace: 60000 });
  const mem = i => ({ key: 'k' + i, nick: 'Гном' + i, send: o => { (inbox['k' + i] = inbox['k' + i] || []).push(o); } });
  const c = rooms.create('run', mem(0), { diff: 'dive' });
  ok(c.room && /^[А-Я]{4}$/.test(c.room.code), 'комната с кодом из 4 букв: ' + (c.room && c.room.code));
  const code = c.room.code;
  for (let i = 1; i < 5; i++) ok(!rooms.join(code.toLowerCase(), mem(i)).err, 'вход по коду (строчными) ' + i);
  ok(rooms.join(code, mem(5)).err === 'комната полна', 'шестой не должен войти');
  ok(rooms.create('run', mem(1)).err, 'второй комнаты у одного игрока быть не должно');
  ok(rooms.start('k0').err === 'не все готовы', 'старт без готовности');
  for (let i = 0; i < 5; i++) rooms.ready('k' + i, true);
  ok(rooms.start('k1').err === 'начинает ведущий', 'стартует только ведущий');
  const r = rooms.start('k0').room; rooms.stop();
  ok(r && r.state === 'play' && r.game.S.n === 5 && outs.length === 5, 'старт отряда из 5, герои ушли из деревни');
  ok(inbox.k3.some(m => m.a === 'go' && m.me === 3) && inbox.k3.some(m => m.a === 'floor' && m.map.length === RS.RS_W * RS.RS_H), 'каждый получил свой номер и карту этажа');
  // подделанная мета не даёт больше максимума мастерской
  const hf = heroFrom({ ups: { hp: 99, dmg: 99, choice: 9 }, weapon: 'laser' });
  ok(hf.hp === 150 && Math.abs(hf.dmg - 16.8) < 1e-9 && hf.choices === 4 && hf.weapon === 'pick', 'мета из клиента должна обрезаться: ' + JSON.stringify(hf));
  // бой ботами: ввод идёт тем же путём, что от игроков
  const S = r.game.S;
  let steps = 0, dropped = false, returned = false, quitted = false;
  while (r.game && !S.over && steps < 20 * 60 * 30) {
    S.heroes.forEach((h, i) => { const b = botInput(S, i); if (b) kind.input(r, 'k' + i, { mx: b.mx, my: b.my, d: b.dash, s: b.slam }); });
    if (S.pick) S.pick.opts.forEach((o, i) => { if (S.pick && S.pick.got[i] == null && !S.heroes[i].away) kind.pick(r, 'k' + i, 0); });
    kind.tick(r, 0.05); steps++;
    if (steps === 200) { rooms.detach('k4'); dropped = true; ok(S.heroes[4].away, 'оборвавшийся герой должен встать под щит'); }
    if (steps === 600) { const x = rooms.join(code, mem(4)); returned = !!x.back; ok(x.back && !S.heroes[4].away, 'возврат после обрыва в ту же комнату'); }
    if (steps === 900) { kind.quit(r, 'k2'); quitted = true; ok(S.heroes[2].gone && inbox.k2.some(m => m.a === 'over' && m.quit), 'сдавшийся получает итог сразу'); }
    NOW += 50;
  }
  ok(dropped && returned && quitted, 'сценарий обрыва/возврата/сдачи не прошёл');
  ok(S.over, `кооп-забег не закончился за ${steps} шагов`);
  console.log(`  · отряд: ${S.over && S.over.win ? 'победа' : 'конец'} на этаже ${S.floor + 1}, убито ${S.kills}, ${(S.t / 60).toFixed(1)} мин игры`);
  for (const k of ['k0', 'k1', 'k3', 'k4']) ok(inbox[k].some(m => m.a === 'over' && m.rw && m.rw.stones >= 0), 'итог не пришёл ' + k);
  ok(new Set(backs).size === 5, 'все герои должны вернуться в деревню: ' + backs.join());
  ok(r.state === 'over', 'комната должна закрыться итогом');
  const snaps = inbox.k0.filter(m => m.a === 's');
  ok(snaps.length > 50 && snaps.every(m => m.h.length === 5), 'снимки идут и содержат всех героев');
  const size = JSON.stringify(snaps[Math.floor(snaps.length / 3)]).length;
  ok(size < 12000, 'снимок слишком тяжёлый: ' + size + ' байт');
  // брошенная комната закрывается, если все ушли
  const c2 = rooms.create('run', mem(7), {}); rooms.ready('k7', true); const r2 = rooms.start('k7').room; rooms.stop();
  rooms.detach('k7'); NOW += 61000; rooms.step(); rooms.stop();
  ok(!rooms.rooms.has(c2.room.code), 'брошенная комната должна закрыться после ожидания');
  ok(!r2.game || r2.game.ended, 'бой в брошенной комнате должен закончиться');
}

// ---------- 2. через настоящий сервер ----------
const ROOT = path.join(__dirname, '..');
function req(port, p) { return new Promise(res => { const q = http.get({ host: '127.0.0.1', port, path: p }, r => { r.resume(); r.on('end', () => res(r.statusCode)); }); q.on('error', () => res(0)); }); }
function client(port, nick) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/`), box = [];
    const c = { ws, box, send: o => ws.send(JSON.stringify(o)), wait: (f, ms = 15000) => new Promise((res, rej) => { const t0 = Date.now(); const tick = () => { const i = box.findIndex(f); if (i >= 0) return res(box.splice(i, 1)[0]); if (Date.now() - t0 > ms) return rej(new Error(nick + ': не дождался')); setTimeout(tick, 30); }; tick(); }) };
    ws.onmessage = e => { if (typeof e.data === 'string') { try { box.push(JSON.parse(e.data)); } catch (er) { /* не JSON */ } } };
    ws.onopen = () => { c.send({ t: 'auth', mode: 'register', nick, pass: 'secret12', ver: 'test', z: 0, d: 1 }); resolve(c); };
    ws.onerror = () => reject(new Error('нет связи'));
  });
}
(async () => {
  const port = 21000 + Math.floor(Math.random() * 3000), data = fs.mkdtempSync(path.join(os.tmpdir(), 'og-runroom-'));
  const ch = spawn(process.execPath, [path.join(ROOT, 'server', 'server.js')], { env: { ...process.env, OLDGOLD_DATA: data, PORT: String(port), HOST: '127.0.0.1', OLDGOLD_CHILD: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; ch.stdout.on('data', d => { out += d; }); ch.stderr.on('data', d => { out += d; });
  try {
    let up = false;
    for (let t0 = Date.now(); Date.now() - t0 < 60000;) { if (await req(port, '/coop-info') === 200) { up = true; break; } await new Promise(r => setTimeout(r, 300)); }
    if (!up) throw new Error('сервер не поднялся:\n' + out.slice(-800));
    const A = await client(port, 'Торин'), B = await client(port, 'Двалин');
    for (const C of [A, B]) { const w = await C.wait(m => m.t === 'welcome'); if (w.needClass) C.send({ t: 'class', cls: 'warrior' }); await C.wait(m => m.t === 'init'); }
    A.send({ t: 'room', a: 'create', diff: 'walk', meta: { ups: { hp: 2 }, weapon: 'pick' } });
    const cr = await A.wait(m => m.t === 'room' && m.a === 'ok');
    ok(cr.room && cr.room.code, 'комната создана по сети');
    B.send({ t: 'room', a: 'join', code: cr.room.code });
    await B.wait(m => m.t === 'room' && m.a === 'ok');
    A.send({ t: 'room', a: 'ready', on: true }); B.send({ t: 'room', a: 'ready', on: true });
    await new Promise(r => setTimeout(r, 300));
    A.send({ t: 'room', a: 'start' });
    const go = await A.wait(m => m.t === 'run' && m.a === 'go');
    ok(go.n === 2 && go.nicks.join() === 'Торин,Двалин', 'старт по сети: ' + JSON.stringify(go).slice(0, 120));
    const fl = await B.wait(m => m.t === 'run' && m.a === 'floor');
    ok(fl.map.length === RS.RS_W * RS.RS_H, 'карта этажа по сети');
    await A.wait(m => m.t === 'toast' && /спускается в подземелье/.test(m.text));
    const s1 = await A.wait(m => m.t === 'run' && m.a === 's');
    for (let k = 0; k < 20; k++) { A.send({ t: 'run', a: 'in', mx: 8, my: 0 }); await new Promise(r => setTimeout(r, 25)); }
    await new Promise(r => setTimeout(r, 600));
    A.box.length = 0;
    const s2 = await A.wait(m => m.t === 'run' && m.a === 's');
    ok(s2.h[0][0] !== s1.h[0][0] || s2.h[0][1] !== s1.h[0][1], `герой должен сдвинуться от ввода: ${s1.h[0]} → ${s2.h[0]}`);
    ok(s2.h.length === 2 && Array.isArray(s2.e), 'снимок по сети');
    // залив ввода не роняет и не валит в общее ведро
    for (let k = 0; k < 300; k++) A.send({ t: 'run', a: 'in', mx: 8, my: 8, d: 1 });
    A.send({ t: 'run', a: 'quit' });
    const ov = await A.wait(m => m.t === 'run' && m.a === 'over');
    ok(ov.quit && ov.rw, 'сдача по сети даёт итог');
    await A.wait(m => m.t === 'init', 10000);   // герой вернулся в деревню
    B.send({ t: 'run', a: 'quit' });
    await B.wait(m => m.t === 'run' && m.a === 'over');
    ok(await req(port, '/coop-info') === 200, 'сервер должен жить после забега');
    A.ws.close(); B.ws.close();
  } catch (e) { fails.push('сеть: ' + e.message + '\n' + out.slice(-600)); console.log('  ✗ сеть: ' + e.message); }
  ch.kill();
  await new Promise(r => setTimeout(r, 400));
  try { fs.rmSync(data, { recursive: true, force: true }); } catch (e) { /* Windows держит файл */ }
  console.log(fails.length ? `Проверка кооп-забега: провалов ${fails.length}` : 'Проверка кооп-забега: всё в порядке');
  process.exit(fails.length ? 1 : 0);
})();
