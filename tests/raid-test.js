'use strict';
// Курган Курганного князя (raid.js): вход по клику в одиночке и в общей деревне, подпись над курганом, причины «закрыто», сейв.
// Запуск: node tests/raid-test.js
const path = require('path');
const fs = require('fs');
const L = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };
const X = (sim, c) => sim.h.run('(function(){' + c + '})()');
const J = (sim, c) => JSON.parse(sim.h.run('JSON.stringify((function(){' + c + '})())'));
const toNight = sim => sim.h.run('(function(){ let k = 0; while (!isNightNow() && k++ < 100000) Game.time += 5; })()');
const toDay = sim => sim.h.run('(function(){ let k = 0; while ((isNightNow() || isEveningNow()) && k++ < 100000) Game.time += 5; })()');

// скрипты как в index.html (без coopsim.js — иначе симуляция считает себя сервером общей деревни)
function browserSim(seed) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const files = [...html.matchAll(/<script[^>]*\ssrc="js\/([\w\/-]+)\.js"/g)].map(m => m[1]).filter(f => !['loading', 'perf'].includes(f));
  const c = L.newSim(seed, { files });
  c.h.run('unlockAll = typeof unlockAll === "function" ? unlockAll : function () {}; coopInitHud = function () {}; coopInitControls = function () {}; coopRefreshHud = function () {}; coopVilHud = function () {}; coopQuestHud = function () {}; coopSaveCopy = function () {};');
  return c;
}

// ---------- 1. Одиночка: курган на карте, клик — «Войти в курган», герой доходит и узнаёт, почему закрыто
{
  const sim = browserSim(31);
  sim.h.run('var __toasts = []; toast = function (m) { __toasts.push(String(m)); };');
  L.stepN(sim, 20);
  const s1 = J(sim, `const S = Game.raid, d = raidDoor(S), c = resolveCmd([Math.floor(S.site.x), Math.floor(S.site.y) - 1]);
    return { site: !!S.site, st: S.st, kind: c && c.kind, label: c && c.label, door: c && [c.tx, c.ty], d, walk: isWalkable(d[0], d[1]) };`);
  ok(s1.site, 'одиночка: нет кургана на карте');
  ok(s1.st === 'shut', 'одиночка: в первый день курган должен быть запечатан, а не ' + s1.st);
  ok(s1.kind === 'kurgan' && s1.label === 'Войти в курган', 'одиночка: клик по кургану не даёт «Войти в курган»: ' + JSON.stringify(s1));
  ok(s1.door && s1.door[0] === s1.d[0] && s1.door[1] === s1.d[1] && s1.walk, 'одиночка: вход не у проёма или туда не пройти: ' + JSON.stringify(s1));
  X(sim, `const S = Game.raid, h = Game.hero; h.x = S.site.x + 3.5; h.y = S.site.y + 2.5; issueCmd(h, resolveCmd([Math.floor(S.site.x), Math.floor(S.site.y)]));`);
  L.stepN(sim, 200);
  const t1 = J(sim, 'return __toasts.filter(m => /урган|Князь|князь/.test(m))');
  ok(t1.some(m => /запечатан/.test(m)), 'одиночка: герой дошёл, но не узнал, что курган запечатан: ' + JSON.stringify(t1));

  // ночь, курган открыт, герой 5 уровня, но один — подсказка про двух рекрутов
  sim.h.run('Game.noGrace = true; Game.hero.hero.level = 5; __toasts.length = 0;');
  toNight(sim); L.stepN(sim, 20);
  ok(J(sim, 'return Game.raid.st') === 'wait', 'одиночка: ночью без отряда курган должен ждать (wait), а не ' + J(sim, 'return Game.raid.st'));
  X(sim, 'const S = Game.raid, h = Game.hero; issueCmd(h, resolveCmd([Math.floor(S.site.x), Math.floor(S.site.y)]));');
  L.stepN(sim, 200);
  ok(J(sim, 'return __toasts').some(m => /двух рекрутов/.test(m)), 'одиночка: одному герою не сказали про двух рекрутов: ' + JSON.stringify(J(sim, 'return __toasts')));
  ok(!J(sim, 'return !!Game.raid.f'), 'одиночка: князь встал перед одиноким героем');

  // сейв: курган остаётся на том же месте, состояние пересчитывается
  const sv = J(sim, `const a = Game.raid.site, s = serializeGame(); applySave(JSON.parse(JSON.stringify(s))); return { a, b: Game.raid && Game.raid.site, s: !!s.raid };`);
  ok(sv.s && sv.b && sv.a.x === sv.b.x && sv.a.y === sv.b.y, 'сейв: курган сместился или пропал: ' + JSON.stringify(sv));
  L.stepN(sim, 20);
  ok(J(sim, 'return Game.raid.st') === 'wait', 'сейв: состояние кургана не пересчиталось после загрузки');
  for (const e of sim.errors) ok(false, 'одиночка: ' + e);
}

// ---------- 2. Общая деревня: сервер считает, клиент видит; вход двумя героями поднимает князя
{
  const seed = 31;
  const srv = L.newSim(seed, { coop: true });
  srv.h.run(`coopJoin('a', JSON.stringify({ cls: 'warrior' })); coopJoin('b', JSON.stringify({ cls: 'mage' }))`);
  const cli = browserSim(seed + 1000);
  cli.h.ctx.__m = srv.h.run(`coopInitPacket(coop.players.get('a').id)`);
  cli.h.run('coopApplyInit(JSON.parse(__m)); raidClientHook();');
  srv.h.run('coopWorldPacket()');
  const sync = () => { cli.h.ctx.__m = srv.h.run('coopWorldPacket()'); if (cli.h.ctx.__m) cli.h.run('coopHandle(JSON.parse(__m))'); cli.h.ctx.__m = srv.h.run('coopUnitsPacket()'); cli.h.run('coopHandle(JSON.parse(__m))'); };
  const said = name => J(srv, `return coop.out.filter(o => o.to === '${name}' && o.msg && o.msg.t === 'toast' && /урган|нязь|Одному/.test(o.msg.text)).map(o => o.msg.text)`);
  // клиент шлёт то же, что отправил бы клик: 'go' на клетку из своего resolveCmd
  const tap = name => {
    const c = J(cli, 'const S = Game.raid; const c = S && S.site ? resolveCmd([Math.floor(S.site.x), Math.floor(S.site.y) - 1]) : null; return c && { kind: c.kind, tx: c.tx, ty: c.ty };');
    if (c) srv.h.run(`coopCmd('${name}', JSON.stringify({ t: 'go', x: ${c.tx}, y: ${c.ty} }), true)`);
    return c;
  };
  for (let i = 0; i < 20; i++) { L.stepN(srv, 1); if (i % 10 === 9) sync(); }
  const c0 = J(cli, 'return Game.raid && { site: Game.raid.site, st: Game.raid.st }');
  ok(c0 && c0.site && c0.st === 'shut', 'кооп: клиент не видит курган или его состояние: ' + JSON.stringify(c0));
  const tp = tap('a');
  ok(tp && tp.kind === 'kurgan', 'кооп: клик клиента по кургану — не «Войти в курган»: ' + JSON.stringify(tp));
  srv.h.run('coop.out.length = 0');
  tap('a');
  for (let i = 0; i < 80 && !said('a').length; i++) L.stepN(srv, 10);
  ok(said('a').some(m => /запечатан/.test(m)), 'кооп: игрок не узнал, что курган запечатан: ' + JSON.stringify(said('a')));

  // ночь, курган открыт: один герой — «нужен второй», двое у входа — князь встаёт, клиент видит бой
  X(srv, `Game.noGrace = true; for (const p of coop.players.values()) p.hero.level = 5; const S = Game.raid; let k = 0; for (const p of coop.players.values()) { p.x = S.site.x - 6 + 12 * k++; p.y = S.site.y + 6; }`);
  toNight(srv); L.stepN(srv, 20); sync();
  ok(J(cli, 'return Game.raid.st') === 'omen', 'кооп: ночью с двумя героями клиент не видит синих огней: ' + J(cli, 'return Game.raid.st'));
  srv.h.run('coop.out.length = 0');
  tap('a');
  for (let i = 0; i < 80 && !J(srv, 'return !!Game.raid.f') && !said('a').length; i++) L.stepN(srv, 10);
  ok(!J(srv, 'return !!Game.raid.f'), 'кооп: князь встал перед одним героем');
  ok(said('a').some(m => /второй герой/.test(m)), 'кооп: одному герою не сказали, что нужен второй: ' + JSON.stringify(said('a')));
  tap('b');
  for (let i = 0; i < 80 && !J(srv, 'return !!Game.raid.f'); i++) L.stepN(srv, 10);
  ok(J(srv, 'return !!Game.raid.f && !!raidBoss()'), 'кооп: двое героев у входа, а князь не встал');
  sync();
  const c2 = J(cli, 'return { f: !!(Game.raid && Game.raid.f), st: Game.raid && Game.raid.st, boss: Game.neutrals.some(N => N.k === "kurgan") }');
  ok(c2.f && c2.st === 'fight' && c2.boss, 'кооп: клиент не видит боя с князем: ' + JSON.stringify(c2));
  // днём курган снова закрыт, клик объясняет
  toDay(srv); L.stepN(srv, 30); sync();
  ok(J(cli, 'return Game.raid.st') !== 'omen' && !J(cli, 'return !!Game.raid.f'), 'кооп: на рассвете князь не ушёл');
  for (const e of srv.errors) ok(false, 'сервер: ' + e);
  for (const e of cli.errors) ok(false, 'клиент: ' + e);
}

// ---------- 3. Перевод: подписи и причины есть в английском словаре
{
  const en = fs.readFileSync(path.join(__dirname, '..', 'js', 'i18n', 'en-manual.js'), 'utf8');
  for (const k of ['Войти в курган', 'Курган · запечатан', '▼ Вход в курган ▼', 'Вход в курган — ночью', 'Одному не войти: возьмите двух рекрутов «За героем»', 'Курган запечатан: князь проснётся после {0}-й ночи'])
    ok(en.includes(`'${k}'`), 'нет английского перевода: ' + k);
}

console.log(fails.length ? `Проверка кургана: ${fails.length} ошибок` : 'Проверка кургана: всё в порядке');
process.exit(fails.length ? 1 : 0);
