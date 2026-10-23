'use strict';
// Кампания в коопе (КАМПАНИЯ_КООП.md): сервер и два клиента проходят акт 1 «Праздник Первого Камня».
// Сервер — тот же движок, что server/server.js (coopsim), клиенты — файлы index.html (как coop-тест в run.js),
// пакеты гоняются руками: init, u (жители + зеркало), w (мир), события camp (звук, вспышки).
// Проверяется: акт запускает только хост; мир сменился у обоих клиентов; цели, реплики и флаги сцены приходят
// зеркалом; строку листают голоса обоих игроков; контрольная точка возвращает отряд; итог «победа» записан
// и на сервере, и в одиночной кампании каждого клиента. Строки «✗ …» — провалы, «⚠ …» — замечания (tests/run.js).
const fs = require('fs');
const path = require('path');
const L = require('./lib/sim');

const fails = [], warns = [];
const fail = m => { fails.push(m); console.log('✗ ' + m); };
const warn = m => { warns.push(m); console.log('⚠ ' + m); };

function loadClient(seed) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const files = [...html.matchAll(/<script[^>]*\ssrc="js\/([\w\/-]+)\.js"/g)].map(m => m[1]).filter(f => !['loading', 'perf'].includes(f));
  const c = L.newSim(seed, { files });
  c.h.run('unlockAll = typeof unlockAll === "function" ? unlockAll : function () {}; coopInitHud = function () {}; coopInitControls = function () {}; coopRefreshHud = function () {}; coopVilHud = function () {}; coopQuestHud = function () {}; coopSaveCopy = function () {};');
  return c;
}

// бот сервера — то, что сделали бы игроки: первый герой идёт в зону цели, второй — рядом с ним;
// башня у штрека (стройплощадка), гоблинов, дерущихся дольше 25 с, добивают герои
const BOT = `(function () {
  const C = Game.camp; if (!C || C.over) return;
  const hs = campHeroes();
  const z = C.objs && C.objs.find(o => o.z && o.cur < o.need);
  if (hs[0] && z) {
    Game.__botZ = Game.__botZ || { key: '', t: 0 };
    const key = z.z.join(',');
    if (Game.__botZ.key !== key) {
      Game.__botZ = { key, t: Game.time };
      hs.forEach((h, k) => { const c = resolveCmd([z.z[0] + k * 2, z.z[1] + k]); if (c) issueCmd(h, c); });
    }
    if (Game.time - Game.__botZ.t > 40) { hs[0].x = z.z[0] + 0.5; hs[0].y = z.z[1] + 0.5; hs[0].path = null; }
  }
  const tw = C.objs && C.objs.find(o => o.t.includes('башню') && o.cur < o.need);
  if (tw && !Game.__botTower) {
    for (let r = 4; r < 12 && !Game.__botTower; r++) for (let a = 0; a < 16 && !Game.__botTower; a++) {
      const x = Math.round(CAMP1.mine[0] + Math.cos(a * 0.39) * r), y = Math.round(CAMP1.mine[1] + 6 + Math.abs(Math.sin(a * 0.39)) * r * 0.6);
      if (inb(x, y) && !checkPlacement('watchtower', x, y, 0)) { Game.__botTower = placeBuilding('watchtower', x, y, false, 0); }
    }
  }
  for (const N of Game.raiders) {
    if (N.st === 'die' || N.st === 'vanish' || !N.ctag) continue;
    N.__seen = N.__seen || Game.time;
    if (Game.time - N.__seen > 25 && hs[0]) foeKill(N, hs[0]);
  }
})()`;

const NICKS = ['хост', 'гость'];
const t0 = Date.now();
const srv = L.newSim(5151, { coop: true });
srv.h.run(`coopJoin('хост', JSON.stringify({ cls: 'warrior', level: 3, inv: [{ k: 'bread', n: 2 }] })); coopJoin('гость', JSON.stringify({ cls: 'mage' }))`);
const cli = NICKS.map((n, k) => loadClient(6000 + k));
const srvRun = c => srv.h.run(c);
const cmd = (nick, m) => srvRun(`coopCmd(${JSON.stringify(nick)}, ${JSON.stringify(JSON.stringify(m))}, ${nick === 'хост'})`);
const deliver = (c, text) => { c.h.ctx.__m = text; c.h.run('coopHandle(JSON.parse(__m))'); };

// как server.js: базовая точка дельты мира — новый мир, затем каждому init со своим героем
function reinit() {
  srvRun('coopWorldPacket()');
  NICKS.forEach((n, k) => {
    srvRun(`coopViewDrop(${JSON.stringify(n)})`);
    cli[k].h.ctx.__m = srvRun(`coopInitPacket(coopUidOf(${JSON.stringify(n)}))`);
    cli[k].h.run('coopApplyInit(JSON.parse(__m))');
  });
}
reinit();

// гость не может начать акт
cmd('гость', { t: 'campaign', a: 'start', n: 1 });
if (srvRun('!!Game.camp')) fail('акт запустил не хост');
// закрытый акт не запускается
cmd('хост', { t: 'campaign', a: 'start', n: 3 });
if (srvRun('!!Game.camp') || srvRun('coopCampTakeReinit()')) fail('хост запустил закрытый акт 3');
cmd('хост', { t: 'campaign', a: 'start', n: 1 });
if (!srvRun('coopCampTakeReinit()')) fail('после запуска акта сервер не попросил переслать мир');
const s0 = JSON.parse(srvRun(`JSON.stringify({ act: Game.camp && Game.camp.act, w: MAP_W, heroes: campHeroes().map(h => [h.owner, h.hero.level, Math.round(Math.hypot(h.x - CAMP1.start[0], h.y - CAMP1.start[1]))]), players: coop.players.size, town: Game.camp && Game.camp.flags.town })`));
console.log(`Проверка: сервер — акт ${s0.act}, карта ${s0.w} в ширину, город ${s0.town} зданий, герои ${JSON.stringify(s0.heroes)}`);
if (s0.act !== 1) fail('акт 1 не запустился на сервере');
if (s0.players !== 2 || s0.heroes.length !== 2) fail(`после смены мира героев ${s0.heroes.length} из 2`);
const hostHero = s0.heroes.find(h => h[0] === 'хост');
if (!hostHero || hostHero[1] !== 3) fail('герой хоста потерял уровень при переходе в акт');
if (s0.heroes.some(h => h[2] > 14)) fail('герои встали далеко от площади Подгорья');
reinit();
for (const [k, c] of cli.entries()) {
  const v = JSON.parse(c.h.run('JSON.stringify({ w: MAP_W, act: Game.camp && Game.camp.act, custom: !!MapOpt.custom, b: Game.buildings.length })'));
  if (v.w !== s0.w || !v.custom) fail(`клиент ${NICKS[k]}: мир не сменился на карту акта (${v.w})`);
  if (v.act !== 1) fail(`клиент ${NICKS[k]}: нет зеркала кампании после init`);
}

const seen = [];
let lastI = -1, over = null, cpDone = false, lines = 0, byVote = 0, boomCli = 0, tiltCli = 0, fxMsgs = 0, sndMsgs = 0, objsSame = 0, objsDiff = 0, sawVoteHalf = false;
const voteAt = {};    // клиент → когда увидел строку (seq:k)
let simT = 0;
for (let sec = 0; sec < 80 * 60; sec++) {
  try {
    for (let k = 0; k < 20; k++) { srv.h.ctx.step(0.05); srvRun('coopTick(0.05)'); }
    srvRun(BOT);
  } catch (e) { fail('сервер, исключение на ' + sec + ' с: ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')); break; }
  simT++;
  // пакеты клиентам: жители с зеркалом — каждую секунду, мир — каждые 2 с, события — сразу
  try {
    const u = srvRun('coopUnitsPacket()');
    const w = sec % 2 ? null : srvRun('coopWorldPacket()');
    const ev = JSON.parse(srvRun('coopDrain()'));
    for (const c of cli) {
      for (let k = 0; k < 20; k++) c.h.run('coopStep(0.05)');
      deliver(c, u);
      if (w) deliver(c, w);
      for (const e of ev) if (e.msg.t === 'campaign') deliver(c, JSON.stringify(e.msg));
    }
    for (const e of ev) if (e.msg.t === 'campaign') { if (e.msg.a === 'fx') fxMsgs++; else sndMsgs++; }
  } catch (e) { fail('клиент, исключение на ' + sec + ' с: ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')); break; }
  // игроки читают строку 2–3 с и жмут «Дальше» — номер строки и шаг берут из своего зеркала
  cli.forEach((c, k) => {
    const v = JSON.parse(c.h.run('JSON.stringify(Game.camp ? { seq: Game.camp.seq, k: Game.camp.st && Game.camp.st.k, rd: Game.camp.st && Game.camp.st.rd, kind: (campStepNow(Game.camp) || {}).k, over: !!Game.camp.over } : null)'));
    if (!v || v.over || (v.kind !== 'say' && v.kind !== 'cut')) return;
    const key = v.seq + ':' + v.k;
    if (voteAt[k] !== key) { voteAt[k] = key; voteAt[k + 'T'] = sec; return; }
    if (sec - voteAt[k + 'T'] === 2 + k) cmd(NICKS[k], { t: 'campaign', a: 'next', seq: v.seq, k: v.k });
    if (v.rd && v.rd.length === 1) sawVoteHalf = true;
  });
  const s = JSON.parse(srvRun('JSON.stringify({ i: Game.camp.i, seq: Game.camp.seq, kind: (campStepNow(Game.camp) || {}).k, k: Game.camp.st.k || 0, lt: Game.camp.st.lt || 0, over: Game.camp.over, cp: Game.camp.cp, cpN: CampSrv.cpN, objs: Game.camp.objs })'));
  if (s.i !== lastI) { seen.push(`${s.i}:${s.kind}@${sec}`); lastI = s.i; }
  // цели клиентов совпадают с серверными (после свежего пакета)
  if (sec % 5 === 0 && s.objs) {
    const c0 = cli[1].h.run('JSON.stringify(Game.camp && Game.camp.objs)');
    if (c0 === JSON.stringify(s.objs)) objsSame++; else objsDiff++;
  }
  const cv = JSON.parse(cli[1].h.run('JSON.stringify({ boom: !!(Game.camp && Game.camp.flags.boom), tilt: Game.camp ? Game.camp.tilt : 0 })'));
  if (cv.boom) boomCli = 1;
  tiltCli = Math.max(tiltCli, cv.tilt || 0);
  // контрольная точка: после первой хост возвращает отряд к ней (как после поражения)
  if (!cpDone && s.cpN >= 1 && s.kind === 'goal' && s.i > s.cp + 2) {
    cpDone = true;
    cmd('хост', { t: 'campaign', a: 'cp' });
    if (!srvRun('coopCampTakeReinit()')) fail('контрольная точка: сервер не пересобрал мир');
    const b = JSON.parse(srvRun('JSON.stringify({ i: Game.camp && Game.camp.i, cp: Game.camp && Game.camp.cp, heroes: campHeroes().length, players: coop.players.size })'));
    console.log(`Проверка: контрольная точка — шаг ${s.i} → ${b.i} (точка ${b.cp}), героев ${b.heroes}`);
    if (b.i !== s.cp) fail(`контрольная точка вернула на шаг ${b.i}, а точка — ${s.cp}`);
    if (b.heroes !== 2 || b.players !== 2) fail('после контрольной точки героев не 2');
    reinit();
    Game_botReset();
  }
  if (s.over) { over = s.over; break; }
}
function Game_botReset() { srvRun('Game.__botZ = null; Game.__botTower = null;'); }

// последние пакеты после итога
for (let k = 0; k < 3; k++) { const u = srvRun('coopUnitsPacket()'); for (const c of cli) deliver(c, u); }
console.log('Проверка: шаги ' + seen.join(' '));
({ byVote, byTime: lines } = JSON.parse(srvRun('JSON.stringify(CampSrv)')));
lines += byVote;
console.log(`Проверка: строк пролистано ${lines}, голосами обоих — ${byVote}; цели у клиента совпали ${objsSame}/${objsSame + objsDiff}; событий сцены: вспышек ${fxMsgs}, звуков ${sndMsgs}`);
if (!over) fail('акт 1 в коопе не закончился за 80 минут');
else {
  console.log(`Проверка: итог «${over.res}» на ${Math.round(over.stats.t / 60)} мин (${over.why || '—'}), звёзд ${over.stars}, жителей ${over.stats.alive}`);
  if (over.res !== 'win') fail('акт 1 в коопе не пройден: ' + over.why);
}
if (!cpDone) fail('контрольная точка не проверена');
if (!sawVoteHalf) fail('клиенты не видели голоса «Дальше» (1 из 2)');
if (lines && byVote < lines * 0.5) fail(`строки листаются в основном по времени, а не голосами: ${byVote} из ${lines}`);
if (objsDiff > objsSame * 0.2) fail(`цели у клиента расходятся с сервером: ${objsDiff} раз`);
if (!boomCli) fail('клиент не увидел взрыва (flags.boom в зеркале)');
if (tiltCli < 0.05) fail('у клиента гора не накренилась (tilt ' + tiltCli + ')');
if (!sndMsgs) fail('звуки сценария (рожок, взрыв) не дошли до клиентов');
if (!fxMsgs) warn('крупные вспышки сценария не дошли до клиентов');
const sp = JSON.parse(srvRun('JSON.stringify(campProg())'));
if (over && over.res === 'win') {
  if (!sp.done[1] || !sp.legacy.a1) fail('прогресс кампании сервера не записан');
  for (const [k, c] of cli.entries()) {
    const p = JSON.parse(c.h.run('JSON.stringify({ p: campProg(), open2: campIsOpen(2), over: Game.camp && Game.camp.over && Game.camp.over.res })'));
    if (p.over !== 'win') fail(`клиент ${NICKS[k]} не увидел победы`);
    if (!p.p.done[1] || !p.p.done[1].coop) fail(`клиент ${NICKS[k]}: акт 1 не отмечен в его кампании`);
    if (!p.open2) fail(`клиент ${NICKS[k]}: акт 2 не открылся`);
  }
  if (!JSON.parse(srvRun('JSON.stringify(coopCampProg())')).done[1]) fail('меню хоста не видит пройденный акт 1');
}
const errs = [srv, ...cli].flatMap(s => s.errors).filter(e => !/предупрежд/i.test(e));
if (errs.length) fail('ошибки в логе: ' + errs.slice(0, 3).join(' | '));
console.log(`Проверка: прогон — ${((Date.now() - t0) / 1000).toFixed(0)} с`);
process.exit(fails.length ? 1 : 0);
