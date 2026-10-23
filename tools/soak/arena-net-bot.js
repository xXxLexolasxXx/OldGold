'use strict';
// Бот-игрок арены онлайн по настоящему сокету (проверка server/arena.js «живьём» и нагрузка).
//   node tools/soak/arena-net-bot.js --url ws://127.0.0.1:8787 --nick Бот1 --pass 123456 [--cls mage] [--fights 1] [--friend 123456 | --invite]
// Входит (регистрируется при первом запуске), встаёт в очередь (или вызывает/принимает по коду), играет случайными входами,
// копию боя ведёт по кадрам и сверяет со снимками сервера; печатает итог. Нужен Node 22+ (глобальный WebSocket).
const path = require('path');
const A = require(path.join(__dirname, '..', '..', 'js', 'arena', 'arenasim.js'));
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL_ = arg('url', 'ws://127.0.0.1:8787'), NICK = arg('nick', 'Бот' + (Math.random() * 1000 | 0)), PASS = arg('pass', 'botpass'), CLS = arg('cls', A.ARENA_CLS[Math.random() * 10 | 0]);
const FIGHTS = +arg('fights', 1), FRIEND = arg('friend', ''), INVITE = argv.includes('--invite');

let ws, mode = 'register', fights = 0, S = null, me = 0, bad = 0, frames = 0, snaps = 0, tick = 0, n = 0;
const send = o => ws.send(JSON.stringify(o));
const unpack = v => (v ? { mx: v[0] / 100, my: v[1] / 100, cast: v[2], roll: v[3], aim: v[4] || v[5] ? [v[4] / 10, v[5] / 10] : null } : null);
function connect() {
  ws = new WebSocket(URL_);
  ws.onopen = () => send({ t: 'auth', mode, nick: NICK, pass: PASS, ver: 'bot', z: 0, d: 1 });
  ws.onclose = () => { console.log(NICK, 'связь закрыта'); process.exit(fights >= FIGHTS ? 0 : 2); };
  ws.onmessage = ev => {
    if (typeof ev.data !== 'string') return;   // сжатые пакеты мира нам не нужны
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.t === 'err') {
      if (mode === 'register' && /занят/.test(m.msg)) { mode = 'login'; ws.onclose = null; ws.close(); connect(); return; }
      console.log(NICK, 'ошибка:', m.msg); process.exit(3);
    }
    if (m.t === 'welcome') { if (m.needClass) send({ t: 'class', cls: Object.keys(m.classes)[0] }); setTimeout(start, 500); return; }
    if (m.t === 'arena') onArena(m);
  };
}
function start() {
  if (INVITE) send({ t: 'arena', a: 'invite', cls: CLS });
  else if (FRIEND) send({ t: 'arena', a: 'accept', code: FRIEND, cls: CLS });
  else send({ t: 'arena', a: 'queue', cls: CLS });
}
function onArena(m) {
  switch (m.a) {
    case 'invite': console.log(NICK, 'КОД ВЫЗОВА', m.code); break;
    case 'err': console.log(NICK, 'арена:', m.msg); process.exit(4); break;
    case 'wait': if (m.s % 10 === 0) console.log(NICK, 'ждёт', m.s, 'с'); break;
    case 'go': S = JSON.parse(JSON.stringify(m.snap)); me = m.me; console.log(NICK, 'бой начат, место', me, 'классы', m.cls.join('/'), m.rated ? 'рейтинг' : 'дружеский'); break;
    case 'f': if (S) for (const f of m.f) { frames++; if (f[0] !== S.tick + 1) { bad++; continue; } A.arenaStep(S, [unpack(f[1]), unpack(f[2])]); tick = S.tick; sendInput(); } break;
    case 's': if (S) { snaps++; if (m.s.tick === S.tick && A.arenaHash(m.s) !== A.arenaHash(S)) { bad++; S = JSON.parse(JSON.stringify(m.s)); } } break;
    case 'end': {
      fights++;
      console.log(NICK, `бой окончен: победил ${m.w === me ? 'я' : 'соперник'} ${m.score.join(':')}, рейтинг ${m.rated ? m.me.elo + ' (' + m.d + ')' : 'не менялся'}${m.tech ? ', тех.' : ''}, кадров ${frames}, снимков ${snaps}, расхождений ${bad}`);
      if (fights >= FIGHTS || bad) { process.exitCode = bad ? 5 : 0; setTimeout(() => process.exit(bad ? 5 : 0), 300); } else { S = null; setTimeout(start, 1500); }
      break;
    }
  }
}
function sendInput() {
  if (!S || S.phase === 'over') return;
  n++;
  const a = n / 7;
  const F = S.f[me], B = S.f[1 - me];
  // идёт к сопернику со случайным разбросом, периодически жмёт способности и перекат
  const dx = B.x - F.x, dy = B.y - F.y, d = Math.hypot(dx, dy) || 1;
  const mx = d > 1.4 ? dx / d : Math.sin(a), my = d > 1.4 ? dy / d : Math.cos(a);
  send({ t: 'arena', a: 'in', mx: +mx.toFixed(2), my: +my.toFixed(2), cast: n % 17 === 0 ? (n / 17 | 0) % 6 : -1, roll: n % 41 === 0 ? 1 : 0 });
}
connect();
setTimeout(() => { console.log(NICK, 'таймаут'); process.exit(6); }, +arg('timeout', 600) * 1000);
