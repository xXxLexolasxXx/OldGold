'use strict';
// Кампания в коопе, акты 2–5 (КАМПАНИЯ_КООП.md): сервер и два клиента проходят акты «Гора ложится», «Гости и рыба»,
// «Игра не стоит свеч», затем сервер переходит в сценарий (акт 5). Посреди каждого акта сервер перезапускают
// (мир → JSON → новый сервер, как после рестарта на VPS) и проверяют, что сценарий, зеркало и контрольная точка
// живы, а клиенты получают мир без null. Выбор в акте 3 делает хост (команда pick). Строки «✗ …» — провалы, «⚠ …» — замечания.
const fs = require('fs');
const path = require('path');
const L = require('./lib/sim');

const fails = [], warns = [];
const fail = m => { fails.push(m); console.log('✗ ' + m); };
const warn = m => { warns.push(m); console.log('⚠ ' + m); };

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const FILES = [...html.matchAll(/<script[^>]*\ssrc="js\/([\w\/-]+)\.js"/g)].map(m => m[1]).filter(f => !['loading', 'perf'].includes(f));
function loadClient(seed) {
  const c = L.newSim(seed, { files: FILES });
  c.h.run('unlockAll = typeof unlockAll === "function" ? unlockAll : function () {}; coopInitHud = function () {}; coopInitControls = function () {}; coopRefreshHud = function () {}; coopVilHud = function () {}; coopQuestHud = function () {}; coopSaveCopy = function () {};');
  return c;
}

// бот: герои идут в зону цели, стройплощадки акта 3, завал акта 2, дерущихся гоблинов дольше 25 с добивает герой
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
  const rb = C.objs && C.objs.find(o => o.t.includes('завал') && o.cur < o.need);
  if (rb && C.flags.school && Game.time - (Game.__botRb || 0) > 4) {
    Game.__botRb = Game.time;
    const [sx, sy] = C.flags.school;
    for (let y = sy - 5; y <= sy + 5; y++) for (let x = sx - 5; x <= sx + 5; x++) { const o = inb(x, y) && World.obj[idx(x, y)]; if (o && o.t === 'stone' && Math.hypot(x - sx, y - sy) <= 4.5) { World.obj[idx(x, y)] = null; return; } }
  }
  const BT = { 'Поставить дома': 'house', 'Дом лесоруба': 'woodcutter', 'Ферма': 'farm', 'Пекарня': 'bakery', 'Свой колодец': 'well' };
  for (const o of (C.act === 3 && C.objs) || []) {
    const t = BT[o.t];
    if (!t || o.cur >= o.need) continue;
    const have = Game.buildings.filter(b => b.type === t && !b.removed && !b.foreign).length;
    if (have >= o.need) continue;
    const k = Game.__botK = (Game.__botK || 0) + 1;
    camp1Place(t, CAMP3.start[0] + Math.round(Math.cos(k) * 8), CAMP3.start[1] + Math.round(Math.sin(k) * 7), camp1Net(), false);
  }
  for (const N of Game.raiders) {
    if (N.st === 'die' || N.st === 'vanish' || !N.ctag) continue;
    N.__seen = N.__seen || Game.time;
    if (Game.time - N.__seen > 25 && hs[0]) foeKill(N, hs[0]);
  }
})()`;

const NICKS = ['хост', 'гость'];
const PROG = {
  2: { v: 1, done: { 1: { t: 1, stars: 2, alive: 36 } }, legacy: { a1: { alive: 36, key: 1, caches: 1 } }, last: 1 },
  3: { v: 1, done: { 1: { stars: 2 }, 2: { stars: 2 } }, legacy: { a1: { alive: 36 }, a2: { saved: 22, bread: 30, vaska: true } }, last: 2 },
  4: { v: 1, done: { 1: { stars: 2 }, 2: { stars: 2 }, 3: { stars: 2 } }, legacy: { a1: { alive: 36 }, a2: { saved: 24, bread: 30, vaska: true }, a3: { resp: 4, gift: { bread: 20, stone: 20, trade: 1 } } }, last: 3 },
  5: { v: 1, done: { 1: { stars: 2 }, 2: { stars: 2 }, 3: { stars: 2 }, 4: { stars: 2 } }, legacy: { a1: { alive: 36 }, a2: { saved: 24, bread: 30, vaska: true }, a3: { resp: 4, gift: { bread: 20, stone: 20, trade: 1 } }, a4: { arrived: 24, found: 3 } }, last: 4 },
};
const LIMIT_MIN = { 2: 40, 3: 60, 4: 60 };

// Мир → текст → новый сервер (как рестарт на VPS: server.js читает world.json в loadSaveText и сразу coopDropHeroes)
function restartServer(srv, seed) {
  const text = srv.h.run('JSON.stringify(serializeGame())');
  const cp = srv.h.run('CampSrv.cp'), cpN = srv.h.run('CampSrv.cpN');
  const prog = srv.h.run('localStorage.getItem("oldgold.campaign")');
  const n = L.newSim(seed + 1, { coop: true });
  n.h.ctx.__saveText = text;
  const err = n.h.run('loadSaveText(__saveText)');
  if (err) return { err };
  n.h.run('coopDropHeroes(); coopInitUnlocks();');
  n.h.ctx.__cp = cp; n.h.ctx.__cpN = cpN; n.h.ctx.__prog = prog;
  n.h.run('CampSrv.cp = __cp; CampSrv.cpN = __cpN; localStorage.setItem("oldgold.campaign", __prog);');
  return { srv: n };
}

function playAct(act, seed) {
  const t0 = Date.now();
  let srv = L.newSim(seed, { coop: true });
  srv.h.run(`localStorage.setItem('oldgold.campaign', ${JSON.stringify(JSON.stringify(PROG[act]))})`);
  srv.h.run(`coopJoin('хост', JSON.stringify({ cls: 'warrior', level: 3, inv: [{ k: 'bread', n: 2 }] })); coopJoin('гость', JSON.stringify({ cls: 'mage' }))`);
  const cli = NICKS.map((n, k) => loadClient(seed + 100 + k));
  const srvRun = c => srv.h.run(c);
  const cmd = (nick, m) => srvRun(`coopCmd(${JSON.stringify(nick)}, ${JSON.stringify(JSON.stringify(m))}, ${nick === 'хост'})`);
  const deliver = (c, text) => { c.h.ctx.__m = text; c.h.run('coopHandle(JSON.parse(__m))'); };
  const reinit = () => {
    srvRun('coopWorldPacket()');
    NICKS.forEach((n, k) => {
      srvRun(`coopViewDrop(${JSON.stringify(n)})`);
      cli[k].h.ctx.__m = srvRun(`coopInitPacket(coopUidOf(${JSON.stringify(n)}))`);
      cli[k].h.run('coopApplyInit(JSON.parse(__m))');
    });
  };
  reinit();
  const tag = `акт ${act}`;
  // закрытый акт хост запустить не может: открываем по прогрессу выше, а на пустом сервере проверяем отказ
  cmd('гость', { t: 'campaign', a: 'start', n: act });
  if (srvRun('!!Game.camp')) fail(`${tag}: акт запустил не хост`);
  cmd('хост', { t: 'campaign', a: 'start', n: act });
  if (!srvRun('coopCampTakeReinit()')) { fail(`${tag}: после запуска сервер не попросил переслать мир`); return; }
  const s0 = JSON.parse(srvRun(`JSON.stringify({ act: Game.camp && Game.camp.act, scen: Game.goal && Game.goal.mode, w: MAP_W, ppl: Game.units.filter(u => !u.dead && isPerson(u) && u.type !== "hero").length, players: coop.players.size, nh: Game.units.filter(u => u.type === "hero" && u.owner).length, leg: Game.campLeg })`));
  console.log(`Проверка: ${tag} — сервер: сценарий ${s0.scen || '—'}, карта ${s0.w}, жителей ${s0.ppl}, героев ${s0.nh} из ${s0.players}`);
  if (act < 5 && s0.act !== act) fail(`${tag}: на сервере не тот акт (${s0.act})`);
  if (s0.nh !== 2) fail(`${tag}: после смены мира героев ${s0.nh} из 2`);
  reinit();
  for (const [k, c] of cli.entries()) {
    const v = JSON.parse(c.h.run('JSON.stringify({ w: MAP_W, act: Game.camp && Game.camp.act, b: Game.buildings.length, mine: Game.units.some(u => u.type === "hero" && u.owner === coopSelf()) })'.replace('coopSelf()', 'Coop.me || ""')));
    if (v.w !== s0.w) fail(`${tag}: клиент ${NICKS[k]}: мир не сменился (${v.w} вместо ${s0.w})`);
    if (act < 5 && v.act !== act) fail(`${tag}: клиент ${NICKS[k]}: нет зеркала кампании после init`);
    if (act === 5 && v.act) fail(`${tag}: у клиента остался кампанийный акт ${v.act} в сценарии`);
  }

  const seen = [];
  let lastI = -1, over = null, restarted = false, objsSame = 0, objsDiff = 0, picks = 0, nullBad = 0, lastNull = '';
  const voteAt = {};
  const limit = (LIMIT_MIN[act] || 6) * 60;
  for (let sec = 0; sec < limit; sec++) {
    try {
      for (let k = 0; k < 20; k++) { srv.h.ctx.step(0.05); srvRun('coopTick(0.05)'); }
      if (act < 5) srvRun(BOT);
    } catch (e) { fail(`${tag}: сервер, исключение на ${sec} с: ` + String(e.stack || e).split('\n').slice(0, 3).join(' | ')); break; }
    try {
      const u = srvRun('coopUnitsPacket()');
      const w = sec % 2 ? null : srvRun('coopWorldPacket()');
      const ev = JSON.parse(srvRun('coopDrain()'));
      for (const c of cli) {
        for (let k = 0; k < 20; k++) c.h.run('coopStep(0.05)');
        deliver(c, u);
        if (w) deliver(c, w);
        for (const e of ev) if (e.msg.t === 'campaign' || e.msg.t === 'toast') deliver(c, JSON.stringify(e.msg));
      }
    } catch (e) { fail(`${tag}: клиент, исключение на ${sec} с: ` + String(e.stack || e).split('\n').slice(0, 3).join(' | ')); break; }
    if (act === 5) { if (sec >= 300) break; continue; }
    // «Дальше» голосами обоих; выбор (акт 3) — хост, вариант по очереди
    cli.forEach((c, k) => {
      const v = JSON.parse(c.h.run('JSON.stringify(Game.camp ? { seq: Game.camp.seq, k: Game.camp.st && Game.camp.st.k, kind: (campStepNow(Game.camp) || {}).k, pick: Game.camp.st && Game.camp.st.pick, over: !!Game.camp.over } : null)'));
      if (!v || v.over || (v.kind !== 'say' && v.kind !== 'cut' && v.kind !== 'choice')) return;
      const key = v.seq + ':' + v.k;
      if (voteAt[k] !== key) { voteAt[k] = key; voteAt[k + 'T'] = sec; return; }
      if (v.kind === 'choice') {
        if (k === 0 && v.pick < 0 && sec - voteAt[k + 'T'] === 3) { cmd('хост', { t: 'campaign', a: 'pick', seq: v.seq, i: picks++ % 2 }); }
        if (v.pick >= 0 && sec - voteAt[k + 'T'] > 4) cmd(NICKS[k], { t: 'campaign', a: 'next', seq: v.seq, k: v.k });
        return;
      }
      if (sec - voteAt[k + 'T'] === 2 + k) cmd(NICKS[k], { t: 'campaign', a: 'next', seq: v.seq, k: v.k });
    });
    const s = JSON.parse(srvRun('JSON.stringify({ i: Game.camp.i, kind: (campStepNow(Game.camp) || {}).k, over: Game.camp.over, cp: Game.camp.cp, cpN: CampSrv.cpN, objs: Game.camp.objs })'));
    if (s.i !== lastI) { seen.push(`${s.i}:${s.kind}@${sec}`); lastI = s.i; }
    if (sec % 5 === 0 && s.objs) {
      const c0 = cli[1].h.run('JSON.stringify(Game.camp && Game.camp.objs)');
      if (c0 === JSON.stringify(s.objs)) objsSame++; else objsDiff++;
    }
    // рестарт сервера посреди акта (после первой контрольной точки, на шаге-цели)
    if (!restarted && s.cpN >= 1 && s.kind === 'goal' && s.i > s.cp + 1) {
      restarted = true;
      const before = JSON.parse(srvRun('JSON.stringify({ i: Game.camp.i, act: Game.camp.act, cpN: CampSrv.cpN, ppl: campPeople(), un: Object.keys(Game.unlocked).filter(k => Game.unlocked[k]).length })'));
      const r = restartServer(srv, seed);
      if (r.err) { fail(`${tag}: сервер не поднял мир кампании после перезапуска: ${r.err}`); return; }
      srv = r.srv;
      const after = JSON.parse(srvRun('JSON.stringify({ i: Game.camp && Game.camp.i, act: Game.camp && Game.camp.act, cpN: CampSrv.cpN, ppl: campPeople(), players: coop.players.size })'));
      console.log(`Проверка: ${tag} — перезапуск на шаге ${before.i}: после ${after.i} (акт ${after.act}), жителей ${before.ppl}→${after.ppl}`);
      const un = srvRun('Object.keys(Game.unlocked).filter(k => Game.unlocked[k]).length');
      if (un < before.un) fail(`${tag}: после перезапуска меню стройки закрылось (${before.un} → ${un} ступеней) — гость не построит башню`);
      if (after.act !== act || after.i !== before.i) fail(`${tag}: после перезапуска акт/шаг ${after.act}/${after.i}, был ${before.act}/${before.i}`);
      // пока сервер лежит, клиенты без связи (Coop.on = false, зеркало остаётся): сценарий сами не считают и не падают
      for (const [k, c] of cli.entries()) {
        try { c.h.run('Coop.on = false; Game.coop = false; for (let j = 0; j < 60; j++) step(0.05); Coop.on = true; Game.coop = true;'); }
        catch (e) { fail(`${tag}: клиент ${NICKS[k]} без связи падает: ` + String(e.message || e).slice(0, 160)); }
      }
      // игроки заходят заново (как server.js при переподключении): герой из аккаунта, потом init
      srvRun(`coopJoin('хост', JSON.stringify({ cls: 'warrior', level: 3 })); coopJoin('гость', JSON.stringify({ cls: 'mage' }))`);
      reinit();
      // зеркало у клиентов на месте, герои есть, в пакетах нет null вместо объектов
      for (const [k, c] of cli.entries()) {
        const v = JSON.parse(c.h.run('JSON.stringify({ act: Game.camp && Game.camp.act, i: Game.camp && Game.camp.i })'));
        if (v.act !== act) fail(`${tag}: клиент ${NICKS[k]} после перезапуска: нет акта в зеркале`);
      }
      srvRun('Game.__botZ = null; Game.__botTower = null;');
      // контрольная точка пережила перезапуск, возврат к ней работает
      if (srvRun('CampSrv.cpN') < 1 || !srvRun('!!CampSrv.cp')) fail(`${tag}: контрольная точка потеряна при перезапуске`);
      else {
        cmd('хост', { t: 'campaign', a: 'cp' });
        if (!srvRun('coopCampTakeReinit()')) fail(`${tag}: контрольная точка после перезапуска не вернула отряд`);
        else { reinit(); srvRun('Game.__botZ = null;'); if (srvRun('campHeroes().length') !== 2) fail(`${tag}: после возврата к точке героев не 2`); }
      }
      try { const p = srvRun('coopWorldPacket()') || ''; const bad = (p.match(/:null[,}\]]/g) || []).length; if (bad > 400) warn(`${tag}: в пакете мира много null (${bad})`); } catch (e) { fail(`${tag}: пакет мира после перезапуска: ${e.message}`); }
    }
    if (s.over) { over = s.over; break; }
  }
  if (act === 5) {
    // сценарий: Малгор настоящий, наследие, клиенты без кампанийного акта; 5 минут игры без исключений
    const sc = JSON.parse(srvRun('JSON.stringify({ camp: !!Game.camp, mode: Game.goal && Game.goal.mode, foe: !!(Game.foe && !Game.foe.camp), leg: Game.campLeg, vaska: Game.units.some(u => u.cname === "Васька") })'));
    console.log(`Проверка: ${tag} — сценарий «${sc.mode}», Малгор ${sc.foe ? 'настоящий' : 'нет'}, наследие ${JSON.stringify(sc.leg)}`);
    if (sc.camp) fail(`${tag}: сценарий запустился как акт кампании`);
    if (sc.mode !== 'scenario') fail(`${tag}: не сценарий «Тишина дороже золота»`);
    if (!sc.foe) fail(`${tag}: нет настоящего Малгора`);
    if (!sc.leg || !sc.vaska) fail(`${tag}: наследие не перешло`);
    const hh = srvRun('Game.units.filter(u => u.type === "hero" && u.owner).length');
    if (hh !== 2) fail(`${tag}: героев ${hh} из 2`);
    for (const [k, c] of cli.entries()) { const v = JSON.parse(c.h.run('JSON.stringify({ camp: !!Game.camp, mode: Game.goal && Game.goal.mode })')); if (v.camp) fail(`${tag}: клиент ${NICKS[k]} остался в зеркале кампании`); if (v.mode !== 'scenario') warn(`${tag}: у клиента ${NICKS[k]} цель сценария «${v.mode}»`); }
  } else {
    console.log(`Проверка: ${tag} шаги ${seen.join(' ')}`);
    if (!over) fail(`${tag} в коопе не закончился за ${LIMIT_MIN[act]} минут: шаги ${seen.slice(-3).join(' ')}`);
    else {
      console.log(`Проверка: ${tag} — итог «${over.res}» на ${Math.round(over.stats.t / 60)} мин (${over.why || '—'}), звёзд ${over.stars}, жителей ${over.stats.alive}; цели у клиента совпали ${objsSame}/${objsSame + objsDiff}`);
      if (over.res !== 'win') fail(`${tag} в коопе не пройден: ${over.why}`);
      else {
        const sp = JSON.parse(srvRun('JSON.stringify(campProg())'));
        if (!sp.done[act] || !sp.legacy['a' + act]) fail(`${tag}: прогресс кампании сервера не записан`);
        if (!JSON.parse(srvRun('JSON.stringify(coopCampProg())')).done[act]) fail(`${tag}: меню хоста не видит пройденный акт`);
        for (const [k, c] of cli.entries()) {
          const p = JSON.parse(c.h.run('JSON.stringify({ p: campProg(), over: Game.camp && Game.camp.over && Game.camp.over.res })'));
          if (p.over !== 'win') fail(`${tag}: клиент ${NICKS[k]} не увидел победы`);
          if (!p.p.done[act]) fail(`${tag}: клиент ${NICKS[k]}: акт не отмечен в его кампании`);
        }
      }
    }
    if (!restarted) fail(`${tag}: перезапуск сервера не проверен`);
    if (objsDiff > objsSame * 0.2) fail(`${tag}: цели у клиента расходятся с сервером: ${objsDiff} раз`);
  }
  const errs = [srv, ...cli].flatMap(s => s.errors).filter(e => !/предупрежд/i.test(e));
  if (errs.length) fail(`${tag}: ошибки в логе: ` + errs.slice(0, 3).join(' | '));
  console.log(`Проверка: ${tag} — прогон ${((Date.now() - t0) / 1000).toFixed(0)} с`);
}

// выключатель кооп-кампании (OLDGOLD_COOP_CAMPAIGN=0): акт не запускается, клиентам в init уходит cc:0 и кнопка прячется
{
  const srv = L.newSim(99, { coop: true });
  srv.h.run(`coopJoin('хост', JSON.stringify({ cls: 'warrior' })); coopCampOff(true)`);
  srv.h.run(`coopCmd('хост', JSON.stringify({ t: 'campaign', a: 'start', n: 1 }), true)`);
  if (srv.h.run('!!Game.camp') || srv.h.run('coopCampTakeReinit()')) fail('флаг: при выключенной кампании акт всё равно запустился');
  const init = JSON.parse(srv.h.run('coopInitPacket(coopUidOf("хост"))'));
  if (init.cc !== 0) fail('флаг: init не сообщает клиентам, что кампания выключена');
  srv.h.run('coopCampOff(false)');
  if (JSON.parse(srv.h.run('coopInitPacket(coopUidOf("хост"))')).cc !== 1) fail('флаг: после включения init всё ещё cc:0');
  const c = loadClient(98);
  c.h.ctx.__m = JSON.stringify(Object.assign(init, { cc: 0 }));
  c.h.run('Coop.host = true; coopApplyInit(JSON.parse(__m))');
  if (!c.h.run('Coop.noCamp')) fail('флаг: клиент не принял cc:0');
  console.log('Проверка: флаг OLDGOLD_COOP_CAMPAIGN — отказ, init, клиент');
}

const only = process.argv[2] ? process.argv[2].split(',').map(Number) : [2, 3, 4, 5];
for (const act of only) {
  try { playAct(act, 7000 + act * 13); } catch (e) { fail(`акт ${act}: ` + String(e.stack || e).split('\n').slice(0, 4).join(' | ')); }
}
console.log(`Сводка: ${fails.length ? 'провалов ' + fails.length : 'OK'}${warns.length ? ', замечаний ' + warns.length : ''}`);
process.exit(fails.length ? 1 : 0);
