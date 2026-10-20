'use strict';
// Одинокие путники (world/travelers.js): появление, смайлики, разговор через окно дилемм, вор, разбойник, сохранение.
// Запуск: node tests/trav-test.js
const S = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

const sim = S.newSim(7);
const h = sim.h;
h.run('Game.noGrace = true');
S.runFor(sim, 240, 10, k => { if (k % 3 === 0) S.botTurn(sim); });
h.run('for (const s of Game.buildings) if (s.isStore()) { s.stock.gold = (s.stock.gold||0) + 60; s.stock.bread = (s.stock.bread||0) + 40; s.stock.beer = (s.stock.beer||0) + 20; break; }');

// 1. Каждый вид появляется и доходит
const kinds = ['pilgrim', 'herbalist', 'courier', 'wanderer', 'seeker', 'thief', 'brigand'];
for (const k of kinds) {
  const id = h.run(`(tvSpawn('${k}') || {}).id || 0`);
  ok(id > 0, `путник ${k} не появился`);
}
ok(h.run('Game.trav.list.length') >= kinds.length, 'не все путники в списке');
ok(h.run("JSON.stringify(Object.keys(TV_EMO))") === '["good","neu","evil","seek"]', 'нет смайликов');
const before = h.run('Game.trav.list.map(T => T.x + T.y).join()');
S.runFor(sim, 20, 10);
ok(h.run('Game.trav.list.map(T => T.x + T.y).join()') !== before, 'путники стоят на месте');

// 2. Сохранение → загрузка
const sv = h.run('JSON.stringify(serializeGame())');
const n0 = h.run('Game.trav.list.length');
h.run(`applySave(JSON.parse(${JSON.stringify(sv)}))`);
ok(h.run('Game.trav && Game.trav.list.length') === n0, 'путники не пережили сохранение');

// 3. Разговор: окно дилеммы, решение, очередь обычных дилемм не сдвинулась
h.run('Game.trav.list = []; dilEnsure().cur = null;');
const pid = h.run("tvSpawn('pilgrim').id");
const nx = h.run('dilEnsure().next');
ok(h.run(`tvTalk(${pid}).ok`) === true, 'разговор не открылся');
ok(h.run('Game.dil.cur && Game.dil.cur.id') === 'tv_pilgrim', 'не то событие: ' + h.run('Game.dil.cur && Game.dil.cur.id'));
ok(h.run(`Game.trav.list.find(T => T.id === ${pid}).st`) === 'talk', 'путник не остановился для разговора');
const bread = h.run('dilHave("bread")');
ok(h.run('dilResolve(0, null).ok') === true, 'решение не принято');
ok(h.run('dilHave("bread")') !== bread, 'приют не стоил хлеба / дар не пришёл');
ok(h.run('dilEnsure().next') === nx, 'разговор сдвинул очередь дилемм');
ok(h.run('Game.dil.rel.road') === 1, 'молва не выросла');
ok(h.run(`Game.trav.list.find(T => T.id === ${pid}).st`) === 'out', 'паломник не ушёл после дара');

// 4. Бродяга: позвать жить
const units = h.run('Game.units.length');
const wid = h.run("tvSpawn('wanderer').id");
h.run(`tvTalk(${wid}); dilResolve(1, null)`);
ok(h.run('Game.units.length') === units + 1, 'бродяга не стал жителем');
ok(!h.run(`!!Game.trav.list.find(T => T.id === ${wid})`), 'бродяга остался путником');

// 5. Искатель: событие по товару
const sid = h.run("tvSpawn('seeker').id");
const g = h.run(`Game.trav.list.find(T => T.id === ${sid}).g`);
h.run(`tvTalk(${sid})`);
ok(h.run('Game.dil.cur.id') === 'tv_seek_' + g, 'искатель открыл не своё событие');
h.run('dilResolve(2, null)');

// 6. Вор: крадёт, если нет стражи; пойман — добыча на земле
h.run('for (const u of Game.units) if (u.hero) u.hero.hp = 0;');
h.run("Game.trav.list = []; var T = tvSpawn('thief'); T.st = 'stay'; T.stay = 0; T.x = tvStore().doorX + 0.5; T.y = tvStore().doorY + 1.5; T.pi = T.route.length - 1;");
const gold0 = h.run('dilHave("gold")');
h.run('tvTick(1.1)');
ok(h.run('!!(Game.trav.list[0] && Game.trav.list[0].loot)'), 'вор ничего не украл');
ok(h.run('dilHave("gold")') < gold0, 'со склада ничего не пропало');
ok(h.run('Game.trav.list[0].st') === 'flee', 'вор не бежит');
const piles0 = h.run('[...Game.piles.values()].reduce((a, p) => a + Object.values(p.stock).reduce((x, y) => x + y, 0), 0)');
h.run('tvCatch(Game.trav.list[0], null)');
ok(!h.run('Game.trav.list[0].loot'), 'пойманный вор унёс добычу');
ok(h.run('[...Game.piles.values()].reduce((a, p) => a + Object.values(p.stock).reduce((x, y) => x + y, 0), 0)') > piles0, 'украденное не упало на землю');

// 7. Разбойник: становится нейтралом, бьёт гнома, убегает или погибает
h.run("Game.trav.list = []; var B = tvSpawn('brigand'); var serf = Game.units.find(u => u.type === 'serf' && !u.inside); tvToNeu(B, serf);");
ok(h.run("Game.neutrals.some(N => N.k === 'brigand' && N.tv)"), 'разбойник не стал бойцом');
S.runFor(sim, 30, 10);
const left = h.run("Game.neutrals.filter(N => N.k === 'brigand').map(N => N.flee ? 'flee' : N.st).join()");
ok(left === '' || /flee|die/.test(left), 'разбойник не отстал от гнома: ' + left);
h.run("var B2 = Game.neutrals.find(N => N.k === 'brigand'); if (!B2) { B2 = tvToNeu(tvSpawn('brigand'), null); } neuHit(B2, Game.units.find(u => u.hero) || Game.units[0], 999);");
ok(!h.run("Game.neutrals.some(N => N.k === 'brigand' && N.st !== 'die')"), 'разбойник не погиб от смертельного удара');

// 8. Долгий прогон: путники приходят сами, ничего не ломается
h.run('for (const u of Game.units) if (u.hero) u.hero.hp = u.hero.maxhp; Game.trav.next = Game.time + 5;');
S.runFor(sim, 900, 10, k => { if (k % 3 === 0) S.botTurn(sim); if (k % 5 === 0) h.run('if (Game.dil && Game.dil.cur) dilFinish(true)'); });
ok(h.run('Game.trav.n') >= 10, 'за 15 минут пришло мало путников: ' + h.run('Game.trav.n'));
ok(!sim.errors.length, 'исключения: ' + sim.errors.slice(0, 3).join(' | '));
const inv = S.checkInvariants(sim, 'путники'); for (const p of inv.problems) ok(false, p);

console.log(`Проверка путников: пришло ${h.run('Game.trav.n')}, украдено ${h.run('Game.trav.stolen')}, поймано ${h.run('Game.trav.caught')}, молва ${h.run('Game.dil.rel.road')}, ошибок ${fails.length}`);
process.exit(fails.length ? 1 : 0);
