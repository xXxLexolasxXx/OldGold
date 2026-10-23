'use strict';
// Таблица рекордов забегов server/runboard.js: сервер сам переигрывает запись и считает очки,
// одна попытка в день, без согласия ничего не хранится, плохой ник не проходит, вчерашний день закрыт,
// «Удалить мои рекорды» стирает всё, таблица переживает перезапуск, HTTP-обвязка с лимитами.
// Запуск: node tests/runboard-test.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const RS = require('../js/run/runsim.js');
const { play } = require('./lib/runbot');
const { createRunboard, cleanNick } = require('../server/runboard.js');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'og-runboard-'));
let NOW = Date.parse('2026-10-22T12:00:00Z');
const B = createRunboard(dir, () => {}, () => NOW);
const today = '2026-10-22', week = RS.rsWeekOf(today);
const id = n => ('player' + n + 'abcdefghijkl').slice(0, 16);

// честный забег дня
const run = play(RS.rsRankedOpts('day', today), 30);
const local = RS.rsScore(run.S);
const r1 = B.submit({ id: id(1), nick: 'Торин', show: true, kind: 'day', key: today, rec: run.rec, score: 999999 });
ok(!r1.err && r1.score === local, `честная попытка должна пройти с очками сервера: ${JSON.stringify(r1).slice(0, 160)} (локально ${local})`);
ok(r1.top && r1.top[0] && r1.top[0].nick === 'Торин' && r1.top[0].me, 'игрок должен оказаться в таблице дня');
ok(B.submit({ id: id(1), nick: 'Торин', show: true, kind: 'day', key: today, rec: run.rec }).err, 'вторая попытка за день принята');

// без согласия — очки считаются, но не хранятся
const r2 = B.submit({ id: id(2), nick: 'Скрытный', show: false, kind: 'day', key: today, rec: run.rec });
ok(!r2.err && r2.score === local && !B.board('day', today).top.some(e => e.nick === 'Скрытный'), 'без согласия игрок не должен попасть в таблицу');

// подделки: запись другого дня, мусор, плохой ник
const other = play(RS.rsRankedOpts('day', '2026-10-21'), 30);
const r3 = B.submit({ id: id(3), nick: 'Хитрец', show: true, kind: 'day', key: today, rec: other.rec });
ok(r3.err || r3.score !== RS.rsScore(other.S), 'запись чужого дня дала свои очки');
ok(B.submit({ id: id(4), nick: 'Мусор', show: true, kind: 'day', key: today, rec: [[0, 0, 7], 'x'] }).err, 'мусорная запись принята');
ok(B.submit({ id: id(5), nick: 'Вчерашний', show: true, kind: 'day', key: '2026-10-21', rec: other.rec }).err === 'этот день уже закрыт', 'вчерашний день должен быть закрыт');
const r6 = B.submit({ id: id(6), nick: 'сука123', show: true, kind: 'day', key: today, rec: run.rec });
ok(r6.err && !B.board('day', today).top.some(e => e.id === id(6)), 'ругательный ник попал в таблицу');
ok(cleanNick('Гимли_2') === 'Гимли_2' && !cleanNick('a') && !cleanNick('<script>') && !cleanNick('x'.repeat(17)), 'проверка ника');
ok(B.submit({ id: 'КРИВОЙ', kind: 'day', key: today, rec: run.rec }).err, 'кривой id принят');

// сразу после полуночи вчерашний забег ещё принимается
NOW = Date.parse('2026-10-23T00:10:00Z');
const late = B.submit({ id: id(7), nick: 'Полуночник', show: true, kind: 'day', key: today, rec: run.rec });
ok(!late.err, 'забег, начатый до полуночи, должен приниматься первые 30 минут: ' + late.err);
NOW = Date.parse('2026-10-22T13:00:00Z');

// недельный
const wrun = play(RS.rsRankedOpts('week', week), 30);
const w1 = B.submit({ id: id(1), nick: 'Торин', show: true, kind: 'week', key: week, rec: wrun.rec });
ok(!w1.err && w1.score === RS.rsScore(wrun.S) && B.board('week', String(week)).top.length === 1, 'недельный рекорд: ' + JSON.stringify(w1).slice(0, 120));

// сохранение и перезапуск
B.save();
const B2 = createRunboard(dir, () => {}, () => NOW);
ok(B2.board('day', today).top.length === 2 && B2.board('week', String(week)).top.length === 1, 'таблица не пережила перезапуск: ' + JSON.stringify(B2.board('day', today)));
ok(B2.submit({ id: id(1), nick: 'Торин', show: true, kind: 'day', key: today, rec: run.rec }).err, 'после перезапуска сервер забыл, что попытка была');

// удаление
const n = B2.forget(id(1));
ok(n === 2 && !B2.board('day', today).top.some(e => e.id === id(1)) && !B2.board('week', String(week)).top.length, 'удаление моих рекордов: ' + n);
B.stop(); B2.stop();

// HTTP-обвязка
(async () => {
  const B3 = createRunboard(dir, () => {}, () => NOW);
  const srv = http.createServer((req, res) => { if (!B3.handle(req, res, '1.2.3.4')) { res.writeHead(404); res.end(); } });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  const req = (method, p, body) => new Promise(resolve => {
    const rq = http.request({ host: '127.0.0.1', port, method, path: p, headers: { 'Content-Type': 'text/plain' } }, res => { let d = ''; res.on('data', c => { d += c; }); res.on('end', () => resolve({ code: res.statusCode, body: d })); });
    rq.on('error', () => resolve({ code: 0 }));
    if (body) rq.write(body); rq.end();
  });
  ok((await req('GET', '/runs/board')).code === 405, 'GET должен давать 405');
  const bd = await req('POST', '/runs/board', JSON.stringify({ kind: 'day', key: today }));
  ok(bd.code === 200 && JSON.parse(bd.body).top.length >= 1, 'таблица по HTTP: ' + bd.body.slice(0, 100));
  ok((await req('POST', '/runs/submit', 'x'.repeat(500000))).code === 413, 'огромное тело должно давать 413');
  ok((await req('POST', '/runs/submit', '{не json')).code === 400, 'кривой JSON должен давать 400');
  let lim = 0; for (let i = 0; i < 8; i++) if ((await req('POST', '/runs/forget', JSON.stringify({ id: id(9) }))).code === 429) lim++;
  ok(lim >= 2, 'удаление должно упираться в лимит частоты');
  srv.close(); B3.stop();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(fails.length ? `Проверка таблицы рекордов: провалов ${fails.length}` : 'Проверка таблицы рекордов: всё в порядке');
  process.exit(fails.length ? 1 : 0);
})();
