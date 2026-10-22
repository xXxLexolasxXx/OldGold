'use strict';
// Кооп: обученный специалист занимает здание сам, а клиент это видит (раньше у клиента home/worker не приходили:
// здания, построенные после входа, навсегда значились «без работника», хотя сервер давно поставил туда гнома).
// Запуск: node tests/coop-hire-test.js [минуты]
const fs = require('fs');
const path = require('path');
const S = require('./lib/sim');
const MIN = +process.argv[2] || 5;
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const files = [...html.matchAll(/<script[^>]*\ssrc="js\/([\w\/-]+)\.js"/g)].map(m => m[1]).filter(f => !['loading', 'perf'].includes(f));
const cli = S.newSim(1031, { files });
cli.h.run('unlockAll = typeof unlockAll === "function" ? unlockAll : function () {}; coopInitHud = function () {}; coopInitControls = function () {}; coopRefreshHud = function () {}; coopVilHud = function () {}; coopQuestHud = function () {}; coopSaveCopy = function () {};');
const srv = S.newSim(31, { coop: true });
srv.h.run(`coopJoin('бот1', JSON.stringify({ cls: 'warrior' }))`);
const uid = srv.h.run(`coop.players.get('бот1').id`);
cli.h.ctx.__m = srv.h.run(`coopInitPacket(${uid})`);
cli.h.run('coopApplyInit(JSON.parse(__m))');
srv.h.run('coopWorldPacket()');

function sync(i) {
  cli.h.run('coopStep(0.05)');
  if (i % 4 === 0) { cli.h.ctx.__m = srv.h.run('coopUnitsPacket()'); cli.h.run('coopHandle(JSON.parse(__m))'); }
  if (i % 10 === 0) { const w = srv.h.run('coopWorldPacket()'); if (w) { cli.h.ctx.__m = w; cli.h.run('coopHandle(JSON.parse(__m))'); } }
}
let tick = 0;
function play(sec) { for (let n = 0; n < sec / 0.05; n++) { S.stepN(srv, 1); sync(++tick); } }

for (let m = 0; m < MIN; m++) { play(60); S.botTurn(srv); S.botTurn(srv); }
play(5);

// 1) сервер и клиент одинаково видят, у каких зданий есть работник
const P = 'JSON.stringify(Game.buildings.filter(b => b.state === "done" && b.def.worker).map(b => b.type + ":" + b.id + ":" + (b.worker && b.worker.home === b ? 1 : 0)).sort())';
const a = JSON.parse(srv.h.run(P)), b = JSON.parse(cli.h.run(P));
console.log(`зданий с работником: ${a.filter(s => s.endsWith(':1')).length} из ${a.length}`);
ok(a.length >= 3, 'в деревне меньше 3 зданий с работниками — проверять нечего');
ok(JSON.stringify(a) === JSON.stringify(b), `клиент видит работников иначе:\n   сервер ${a.join(' ')}\n   клиент ${b.join(' ')}`);

// 2) специалист ушёл с места (дом отобрали) — свободный того же ремесла занимает здание за N секунд, клиент видит то же
const bid = srv.h.run(`(() => { const b = Game.buildings.find(b => b.state === 'done' && b.def.worker && b.worker && b.worker.home === b && !b.worker.dead && b.type !== 'school'); if (!b) return 0; const u = b.worker; u.home = null; b.worker = null; u.proc = null; u.action = null; u.anim = null; Game.__fired = u.id; return b.id; })()`);
ok(bid, 'не нашлось здания с работником для проверки');
if (bid) {
  const T = 30;
  let at = -1;
  for (let s = 1; s <= T && at < 0; s++) { play(1); if (srv.h.run(`(() => { const b = Game.buildings.find(b => b.id === ${bid}); return !!(b && b.worker && b.worker.home === b); })()`)) at = s; }
  ok(at > 0, `специалист не занял здание за ${T} с (сервер)`);
  if (at > 0) console.log(`здание снова занято через ${at} с`);
  play(3);
  const w = `(() => { const b = Game.buildings.find(b => b.id === ${bid}); return !!(b && b.worker && b.worker.home === b && b.worker.home.problem() !== 'noworker'); })()`;
  ok(cli.h.run(w) === true, 'клиент не видит, что здание занято');
  // 3) снос работника: здание у клиента снова «без работника»
  srv.h.run(`(() => { const b = Game.buildings.find(b => b.id === ${bid}); const u = b.worker; u.home = null; b.worker = null; u.type = 'serf'; })()`);
  S.stepN(srv, 1);
  play(2);
  const has = `(() => { const b = Game.buildings.find(b => b.id === ${bid}); return !!(b && b.worker && b.worker.home === b); })()`;
  ok(cli.h.run(has) === srv.h.run(has), 'после ухода работника клиент и сервер расходятся во мнении, занято ли здание');
}
for (const e of srv.errors) ok(false, 'сервер: ' + e);
for (const e of cli.errors) ok(false, 'клиент: ' + e);
console.log(fails.length ? `ПРОВАЛ: ${fails.length}` : 'ok');
process.exit(fails.length ? 1 : 0);
