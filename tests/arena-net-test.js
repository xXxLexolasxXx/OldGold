'use strict';
// Арена онлайн (АРЕНА.md, этап 3): server/arena.js на комнатах server/rooms.js, без сокетов — игроки-заглушки и поддельные часы.
// Подбор по Эло, бой 1 на 1 (клиентская копия ядра по кадрам входов сходится со снимками), рейтинг и лиги,
// защита от накруток (пара, быстрая сдача, один адрес, дружеский бой), пауза по обрыву, мусорные входы, запись arena.json.
const fs = require('fs');
const os = require('os');
const path = require('path');
const A = require('../js/arena/arenasim.js');
const { createRooms } = require('../server/rooms.js');
const { createArena, leagueOf, eloDelta } = require('../server/arena.js');

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'og-arena-'));
let dir = DATA;

let clock = 1e9;
const mk = same => {
  if (!same) dir = fs.mkdtempSync(path.join(os.tmpdir(), 'og-arena-'));
  const kinds = {}, rooms = createRooms({ kinds, now: () => clock, grace: 60000, maxRooms: 10, log: (...a) => { if (process.env.ARDBG) console.log(...a); } });
  const arena = createArena({ DATA: dir, rooms, now: () => clock, saveEvery: 1e9, log: (...a) => { if (process.env.ARDBG) console.log(...a); } });
  kinds.arena = arena.kind;
  return { rooms, arena };
};
// игрок-заглушка: копит сообщения, считает копию боя по кадрам
function player(key, nick, ip) {
  const p = { key, nick, ip: ip || '10.0.0.' + key.charCodeAt(0), msgs: [], S: null, me: -1, bad: 0, send: o => p.msgs.push(JSON.parse(JSON.stringify(o))) };
  p.of = a => p.msgs.filter(m => m.a === a);
  p.last = a => p.of(a).pop();
  return p;
}
// «клиент»: применяет кадры входов к своей копии ядра; на каждый снимок сверяет хэш
function follow(p) {
  let done = 0;
  const unpack = v => (v ? { mx: v[0] / 100, my: v[1] / 100, cast: v[2], roll: v[3], aim: v[4] || v[5] ? [v[4] / 10, v[5] / 10] : null } : null);
  return () => {
    for (; done < p.msgs.length; done++) {
      const m = p.msgs[done];
      if (m.a === 'go') { p.S = JSON.parse(JSON.stringify(m.snap)); p.me = m.me; }
      else if (m.a === 'f' && p.S) for (const f of m.f) { if (f[0] !== p.S.tick + 1) { p.bad++; continue; } A.arenaStep(p.S, [unpack(f[1]), unpack(f[2])]); }
      else if (m.a === 's' && p.S) { if (m.s.tick === p.S.tick && A.arenaHash(m.s) !== A.arenaHash(p.S)) p.bad++; else if (m.s.tick !== p.S.tick) p.bad++; }
    }
  };
}
// гоним часы: 50 мс за такт, rooms.step читает время из clock
function run(env, who, n, feed) {
  for (let k = 0; k < n; k++) { clock += 50; if (feed) feed(k); env.rooms.step(); env.arena.pairUp(); for (const f of who) f(); if (who.ended) break; }
}
const msgIn = (k, i) => { const w = ((k * 7 + i * 13) % 40); return { t: 'arena', a: 'in', mx: Math.sin(k / 9 + i), my: Math.cos(k / 11 + i * 2), cast: k % 23 === 0 ? (k / 23 + i) % 6 | 0 : -1, roll: k % 31 === 0 ? 1 : 0, aim: [3 + (w % 8), 3 + (w % 5)] }; };

// ---------- 1. Подбор по Эло и полный бой с клиентской копией ----------
{
  const env = mk(), a = player('a', 'Торин'), b = player('b', 'Бальин');
  ok(!env.arena.qAdd(a, 'mage').err && !env.arena.qAdd(b, 'warrior').err, 'не встали в очередь');
  ok(env.arena.qAdd(a, 'nope').err, 'неизвестный класс принят');
  env.arena.pairUp();
  const ra = env.rooms.roomOf('a');
  ok(ra && ra.kind === 'arena' && ra.state === 'play' && env.rooms.roomOf('b') === ra, 'пара не собралась в комнату');
  ok(a.last('go') && a.last('go').me === 0 && b.last('go').me === 1, 'go: места бойцов');
  ok(a.last('go').cls[0] === 'mage' && a.last('go').cls[1] === 'warrior', 'go: классы');
  const fa = follow(a), fb = follow(b);
  let end = 0;
  run(env, [fa, fb], 40000, k => {
    if (a.last('end')) { end = 1; return; }
    env.arena.onInput(a, msgIn(k, 0)); env.arena.onInput(b, msgIn(k, 1));
    a.ainAt = b.ainAt = 0;   // ведро ввода проверяется отдельно ниже
  });
  const ea = a.last('end'), eb = b.last('end');
  ok(ea && eb && ea.w === eb.w && ea.w >= 0, 'бой не закончился общим итогом');
  ok(a.bad === 0 && b.bad === 0, `копия боя разошлась со снимками сервера: ${a.bad}/${b.bad}`);
  ok(a.S && A.arenaHash(a.S) !== '' && a.S.phase === 'over' && a.S.winner === ea.w, 'копия не дошла до конца с тем же победителем');
  ok(ea.rated && ea.d !== 0 && eb.d !== 0, 'рейтинговый бой не двинул рейтинг');
  const w = ea.w, lw = w === 0 ? ea : eb, ll = w === 0 ? eb : ea;
  ok(lw.d > 0 && ll.d < 0 && lw.me.elo > 1000 && ll.me.elo < 1000, `Эло: победитель ${lw.d}, проигравший ${ll.d}`);
  ok(Math.abs(lw.d + ll.d) <= 3, `Эло не сходится по сумме: ${lw.d} ${ll.d}`);
  ok(lw.me.games === 1 && lw.me.wins === 1, 'счётчики боёв');
  // комната закрывается после боя
  clock += 2000; env.rooms.step(); env.arena.stop();
  run(env, [], 40, null);
  ok(!env.rooms.roomOf('a') && !env.rooms.roomOf('b'), 'комната не закрылась после боя');
  const file = JSON.parse(fs.readFileSync(path.join(dir, 'arena.json'), 'utf8'));
  ok(file.players.a && file.players.b && file.matches.length === 1, 'arena.json не записан');
}

// ---------- 2. Окно подбора по Эло ----------
{
  const env = mk(), a = player('a', 'A'), b = player('b', 'B');
  env.arena.qAdd(a, 'mage'); env.arena.qAdd(b, 'mage');
  env.arena.pl.a.elo = 1000; env.arena.pl.b.elo = 1600;
  env.arena.pairUp();
  ok(env.arena.queue.length === 2, 'слишком разные по Эло встретились сразу');
  clock += 5000 * 12;   // окно выросло до ±400 → всё равно 600, пара ждёт
  env.arena.pairUp();
  ok(env.arena.queue.length === 2, 'окно вышло за потолок ±400');
  env.arena.pl.b.elo = 1350;
  env.arena.pairUp();
  ok(env.arena.queue.length === 0 && env.rooms.roomOf('a'), 'в окне ±400 пара не собралась');
  env.arena.stop();
  // выход из очереди
  const env2 = mk(), c = player('c', 'C');
  env2.arena.qAdd(c, 'rogue'); env2.arena.onMessage(c, { a: 'leave' });
  ok(env2.arena.queue.length === 0, 'выход из очереди не сработал');
  env2.arena.stop();
}

// ---------- 3. Лиги и Эло ----------
{
  ok(leagueOf(500) === 0 && leagueOf(899) === 0 && leagueOf(900) === 1 && leagueOf(1100) === 2 && leagueOf(1300) === 3 && leagueOf(1550) === 4 && leagueOf(1800) === 5 && leagueOf(2600) === 5, 'границы лиг');
  const d = eloDelta({ elo: 1000, games: 20 }, { elo: 1000, games: 20 }, false);
  ok(d.w === 12 && d.l === 12, `равные соперники: ±${d.w}/${d.l}`);
  const f = eloDelta({ elo: 1000, games: 3 }, { elo: 1000, games: 3 }, false);
  ok(f.w === 20, 'калибровка: K = 40');
  const dry = eloDelta({ elo: 1000, games: 20 }, { elo: 1000, games: 20 }, true);
  ok(dry.w > d.w, 'счёт 2:0 даёт больше');
  const e = eloDelta({ elo: 900, games: 20 }, { elo: 1500, games: 20 }, false);
  ok(e.w > 20 && e.l < 4, 'слабый победил сильного: много очков слабому');
}

// ---------- 4. Защита от накруток ----------
{
  const env = mk();
  const res = (w, extra) => Object.assign({ a: { key: 'a', nick: 'A', cls: 'mage', ip: '1.1.1.1' }, b: { key: 'b', nick: 'B', cls: 'warrior', ip: '2.2.2.2' }, w, score: [2, 0], fightT: 60, sur: -1, tech: false, rated: true }, extra);
  // одна пара: четвёртый рейтинговый бой за час — дружеский
  let r;
  for (let i = 0; i < 3; i++) { clock += 1000; r = env.arena.settle(res(0)); ok(r.rated, `бой ${i + 1} пары должен быть рейтинговым`); }
  clock += 1000; r = env.arena.settle(res(0));
  ok(!r.rated && r.why === 'pair', 'четвёртый бой пары за час двинул рейтинг');
  const eloW = env.arena.pl.a.elo;
  clock += 3600000 + 5000; r = env.arena.settle(res(0));
  ok(r.rated && env.arena.pl.a.elo > eloW, 'через час пара снова рейтинговая');
  // быстрая сдача
  clock += 7200000; r = env.arena.settle(res(0, { a: { key: 'c', nick: 'C', cls: 'mage', ip: '3.3.3.3' }, b: { key: 'd', nick: 'D', cls: 'mage', ip: '4.4.4.4' }, sur: 1, fightT: 5 }));
  ok(!r.rated && r.why === 'fast', 'сдача на 5-й секунде двинула рейтинг');
  // один адрес
  r = env.arena.settle(res(0, { a: { key: 'e', nick: 'E', cls: 'mage', ip: '5.5.5.5' }, b: { key: 'f', nick: 'F', cls: 'mage', ip: '5.5.5.5' } }));
  ok(!r.rated && r.why === 'ip', 'бой двух окон с одного адреса двинул рейтинг');
  // дружеский
  const before = env.arena.pl.a.elo;
  r = env.arena.settle(res(0, { rated: false, a: { key: 'a', nick: 'A', cls: 'mage', ip: '1.1.1.1' }, b: { key: 'z', nick: 'Z', cls: 'mage', ip: '9.9.9.9' } }));
  ok(!r.rated && env.arena.pl.a.elo === before, 'дружеский бой двинул рейтинг');
  // пол рейтинга
  env.arena.pl.d.elo = 405;
  for (let i = 0; i < 6; i++) { clock += 4000000; env.arena.settle(res(0, { a: { key: 'c', nick: 'C', cls: 'mage', ip: '3.3.3.3' }, b: { key: 'd', nick: 'D', cls: 'mage', ip: '4.4.4.4' } })); }
  ok(env.arena.pl.d.elo >= 400, `рейтинг упал ниже пола: ${env.arena.pl.d.elo}`);
  env.arena.stop();
}

// ---------- 5. Дружеский бой по коду, сдача, пауза по обрыву ----------
{
  const env = mk(), a = player('a', 'A'), b = player('b', 'B');
  const inv = env.arena.inviteMake(a, 'paladin');
  ok(/^\d{6}$/.test(inv.code), 'код вызова не из шести цифр');
  ok(env.arena.inviteTake(a, inv.code, 'mage').err, 'можно принять свой же вызов');
  ok(env.arena.inviteTake(b, '000000', 'mage').err, 'принят несуществующий код');
  ok(!env.arena.inviteTake(b, inv.code, 'mage').err, 'вызов не принят');
  const r = env.rooms.roomOf('a');
  ok(r && r.state === 'play' && !r.game.rated, 'бой по коду должен быть дружеским');
  run(env, [], 100, null);
  // обрыв: пауза, возврат за 20 с — бой идёт дальше
  env.rooms.detach('b');
  ok(a.last('pause') && a.last('pause').who === 1, 'сопернику не сообщили о паузе');
  const tick0 = r.game.S.tick;
  run(env, [], 100, null);
  ok(r.game.S.tick === tick0, 'во время паузы бой идёт');
  const back = { key: 'b', nick: 'B', send: b.send };
  env.arena.onBack(back);
  ok(b.last('go') && b.last('go').snap.tick === tick0, 'вернувшийся не получил снимок боя');
  ok(a.last('resume'), 'сопернику не сообщили о возврате');
  run(env, [], 40, null);
  ok(r.game.S.tick > tick0, 'после возврата бой не пошёл');
  // второй обрыв — техническое поражение
  env.rooms.detach('b');
  ok(a.last('end') && a.last('end').tech && a.last('end').w === 0, 'второй обрыв не дал технического поражения');
  ok(!a.last('end').rated, 'дружеский бой с техпоражением двинул рейтинг');
  env.arena.stop();
}
{
  // не вернулся за 20 с; сдача
  const env = mk(), a = player('a', 'A'), b = player('b', 'B', '2.2.2.2');
  env.arena.qAdd(a, 'rogue'); env.arena.qAdd(b, 'bard'); env.arena.pairUp();
  const r = env.rooms.roomOf('a');
  run(env, [], 20, null);
  env.rooms.detach('a');
  run(env, [], 20 * 21, null);   // 21 секунда
  const eb = b.last('end');
  ok(eb && eb.tech && eb.w === 1, 'не вернувшийся за 20 с не получил поражение');
  ok(eb.rated && eb.d > 0 && a.of('end').length === 0, 'рейтинг техпоражения');
  env.arena.stop();
  const env2 = mk(), c = player('c', 'C'), d = player('d', 'D', '9.9.9.9');
  env2.arena.qAdd(c, 'rogue'); env2.arena.qAdd(d, 'bard'); env2.arena.pairUp();
  run(env2, [], 400, null);   // 20 с
  env2.arena.onMessage(c, { a: 'surrender' });
  const ec = c.last('end'), ed = d.last('end');
  ok(ec && ed && ed.w === 1 && ed.sur === 0, 'сдача не засчитана');
  ok(ec.rated && ec.d < 0 && ed.d > 0, 'сдача после 15 с должна двигать рейтинг');
  env2.arena.stop();
}

// ---------- 6. Мусорные входы и флуд ----------
{
  const env = mk(), a = player('a', 'A'), b = player('b', 'B', '2.2.2.2');
  env.arena.qAdd(a, 'archer'); env.arena.qAdd(b, 'monk'); env.arena.pairUp();
  const junk = [null, 1, 'x', [], { mx: NaN, my: Infinity }, { mx: 1e9, my: -1e9, cast: 99, roll: 'да', aim: [1e9, -1e9] }, { __proto__: { mx: 5 }, cast: 2.5 }, { mx: '1', cast: '2' }, { t: 'arena', a: 'in', cast: -50 }];
  let thrown = false;
  try { for (const m of junk) { a.ainAt = 0; env.arena.onInput(a, m); } run(env, [], 200, null); } catch (e) { thrown = true; }
  ok(!thrown, 'мусорный вход уронил сервер');
  const G = env.rooms.roomOf('a').game;
  ok(G.inp.every(x => Math.abs(x.mx) <= 1 && Math.abs(x.my) <= 1 && x.cast >= -1 && x.cast < 6), 'мусор прошёл в вход');
  ok(G.S.f.every(F => Number.isFinite(F.x) && Number.isFinite(F.y) && Number.isFinite(F.hp)), 'мусор испортил состояние боя');
  // ведро 30/с: лишнее отбрасывается
  a.ainAt = 0; a.ainN = 0; G.inp[0].mx = 0;
  for (let i = 0; i < 100; i++) env.arena.onInput(a, { mx: 1, my: 0 });
  ok(a.ainBad === 70, `ведро ввода: отброшено ${a.ainBad}`);
  // чужой вход в бой посторонним
  const x = player('x', 'X'); G.inp[0].mx = 0; G.inp[1].mx = 0;
  env.arena.onInput(x, { mx: 1 });
  ok(G.inp[0].mx === 0 && G.inp[1].mx === 0, 'посторонний повлиял на бой');
  env.arena.onMessage(a, { a: 'queue', cls: 'mage' });
  ok(a.last('err'), 'можно встать в очередь, будучи в бою');
  for (const m of [{ a: '__proto__' }, { a: 5 }, {}, { a: 'queue', cls: { toString: 1 } }, { a: 'accept', code: {} }, { a: 'board' }]) env.arena.onMessage(x, m);
  env.arena.stop();
}

// ---------- 7. Таблица лидеров, скрытие, удаление данных, перезапуск ----------
{
  const env = mk();
  const set = (k, n, elo, g) => { env.arena.pl[k] = { nick: n, elo, games: g, wins: g, streak: 0, best: elo, hide: false, cls: { mage: g }, last: 1, flags: 0 }; };
  set('p1', 'Один', 1900, 30); set('p2', 'Два', 1500, 30); set('p3', 'Три', 1200, 30); set('p4', 'Новичок', 1000, 0);
  const a = player('p2', 'Два');
  env.arena.onMessage(a, { a: 'board' });
  const bd = a.last('board');
  ok(bd.top.length === 3 && bd.top[0].nick === 'Один' && bd.top[0].lg === 5 && bd.place === 2, `таблица: ${JSON.stringify(bd.top.map(r => r.nick))} место ${bd.place}`);
  ok(!JSON.stringify(bd).includes('"p1"'), 'в таблицу попали ключи аккаунтов');
  env.arena.onMessage(a, { a: 'hide', on: true });
  clock += 61000;
  env.arena.onMessage(a, { a: 'board' });
  const bd2 = a.last('board');
  ok(bd2.top.length === 2 && bd2.place === 0 && bd2.me.hide, 'скрытый игрок остался в таблице');
  env.arena.save();
  env.arena.pl.p1.elo = 1; env.arena.stop();
  // перезапуск читает файл
  const env2 = mk(true);
  ok(env2.arena.pl.p3 && env2.arena.pl.p3.elo === 1200, 'рейтинг не пережил перезапуск');
  env2.arena.forget('p3');
  ok(!env2.arena.pl.p3, 'данные не удалены');
  env2.arena.stop();
}

fs.rmSync(DATA, { recursive: true, force: true });
if (fails.length) { console.log('arena-net-test: ПРОВАЛ\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('arena-net-test: ок');
process.exit(0);
