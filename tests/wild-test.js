'use strict';
// Поселения диких гномов (world/wildgnomes.js): число на картах, злые не больше двух, клетки заняты, окно у ворот,
// обмен и отношение, караван, купец от ворот, поединок (мир на паузе, победа, бунт), сохранение, лица-смайлики путников.
// Запуск: node tests/wild-test.js
const S = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

// 1. Сколько поселений на малой, средней и большой карте
const counts = {};
for (const size of ['small', 'medium', 'large']) {
  for (const seed of [3, 7, 21]) {
    const sim = S.newSim(seed);
    const h = sim.h;
    h.run(`setupStart(${seed}, { size: '${size}' }); for (const b of Game.buildings) b.hold = false;`);
    const n = h.run('Game.wgs.list.length'), ev = h.run('Game.wgs.list.filter(S => S.evil).length');
    const want = h.run('wgWant()');
    (counts[size] = counts[size] || []).push(`${n}/${ev}`);
    ok(n >= 1 && n <= want, `${size} сид ${seed}: поселений ${n}, нужно ${want}`);
    if (n < want - 1) console.log(`  ⚠ ${size} сид ${seed}: места хватило только на ${n} из ${want} поселений (вода и скалы)`);
    ok(n >= 2 ? ev >= 1 && ev <= 2 : ev === 0, `${size} сид ${seed}: злых ${ev} из ${n}`);
    ok(h.run('Game.wgs.list.every(S => wgCells(S).every(i => World.obj[i] && World.obj[i].blk))'), `${size}: клетки построек не заняты`);
    ok(h.run('Game.wgs.list.every(S => isWalkable(...wgGate(S)))'), `${size}: к воротам не пройти`);
    ok(h.run('new Set(Game.wgs.list.map(S => S.fac)).size === Game.wgs.list.length'), `${size}: фракции повторяются`);
  }
}
console.log('Проверка: поселений (всего/злых) — ' + Object.entries(counts).map(([k, v]) => `${k}: ${v.join(' ')}`).join('; '));

// 2. Лица путников: 13×13, у всех борода
const sim = S.newSim(7);
const h = sim.h;
h.run('Game.noGrace = true');
S.runFor(sim, 120, 10, k => { if (k % 3 === 0) S.botTurn(sim); });
ok(h.run("Object.values(TV_EMO).every(E => E.ring && E.glyph) && typeof wildSprite === 'function'"), 'лица над путниками: портрет гнома + значок настроения');
ok(h.run("['pilgrim','thief','brigand','mason','wt:copper','chief:moss','chief:grey!','folk:sand:4','folk:copper:2!'].every(k => { const D = wildDesc(k); return D && D.id === k && D.head && D.coat; })"), 'описания диких гномов не строятся');
h.run('for (const s of Game.buildings) if (s.isStore()) { for (const g of ["gold","bread","beer","sausage","timber","stone","iron","hide"]) s.stock[g] = (s.stock[g]||0) + 40; break; }');

// 3. Окно у ворот, обмен, отношение
h.run('var W0 = Game.wgs.list.find(S => !S.evil); W0.rel = 0; dilEnsure().cur = null;');
ok(!!h.run('W0'), 'нет доброго поселения');
const nx = h.run('dilEnsure().next');
ok(h.run('wgTalk(W0.id).ok') === true, 'окно у ворот не открылось');
ok(h.run('Game.dil.cur.id') === h.run('"wg_" + W0.fac + "_ok"'), 'не то событие у ворот: ' + h.run('Game.dil.cur && Game.dil.cur.id'));
const give = h.run('Object.keys(WG_FAC[W0.fac].tr[0][1])[0]');
const have0 = h.run(`dilHave('${give}')`);
ok(h.run('dilResolve(0, null).ok') === true, 'обмен не прошёл');
ok(h.run(`dilHave('${give}')`) > have0, 'обмен не дал товара');
ok(h.run('W0.rel') === 4, 'отношение после сделки: ' + h.run('W0.rel'));
ok(h.run('dilEnsure().next') === nx, 'окно у ворот сдвинуло очередь дилемм');

// 4. Караван: туда и обратно с товаром
h.run('wgTalk(W0.id); dilResolve(2, null);');
ok(h.run('Game.wgs.cars.length') === 1, 'караван не вышел');
let back = false;
for (let i = 0; i < 40 && !back; i++) { S.runFor(sim, 30, 30); back = h.run('Game.wgs.cars.length') === 0; }
ok(back, 'караван не вернулся за 20 минут');
ok(h.run('W0.rel') >= 12, 'караван не поднял отношение: ' + h.run('W0.rel'));

// 5. Купец от ворот поселения
h.run('Game.trav && (Game.trav.list = []); dilEnsure().cur = null;');
const tid = h.run('(wgSendTraveler(W0, "wt_" + W0.fac) || {}).id || 0');
ok(tid > 0, 'купец не вышел');
ok(h.run(`(T => Math.hypot(T.x - wgGate(W0)[0] - 0.5, T.y - wgGate(W0)[1] - 0.5) < 1)(Game.trav.list.find(T => T.id === ${tid}))`), 'купец вышел не из ворот');
ok(h.run(`tvTalk(${tid}).ok`) === true, 'с купцом не заговорить');
ok(h.run('Game.dil.cur.id') === h.run('"tv_wg_" + W0.fac'), 'не то событие купца');
const r0 = h.run('W0.rel');
h.run('dilResolve(1, null)');
ok(h.run('W0.rel') === r0 + 8, 'угощение купца не подняло отношение');

// 6. Поединок: мир на паузе, победа, дань, бунт
h.run('var H = Game.units.find(u => u.type === "hero" && !u.dead); if (H) H.hero.hp = H.hero.maxhp;');
ok(!!h.run('!!H'), 'нет героя');
h.run('dilEnsure().cur = null; wgTalk(W0.id);');
const di = h.run('DIL_BY_ID[Game.dil.cur.id].o.findIndex(o => o.fx && o.fx.wg === "duel")');
ok(di >= 0, 'в окне нет поединка');
h.run(`dilResolve(${di}, null)`);
ok(!!h.run('!!Game.wgs.duel'), 'поединок не начался');
ok(h.run('Game.neutrals.some(N => N.k === "wgchief")'), 'вождя нет на арене');
const serf0 = h.run('JSON.stringify(Game.units.filter(u => u.type === "serf").slice(0, 5).map(u => [u.x.toFixed(2), u.y.toFixed(2)]))');
S.runFor(sim, 4, 4);
ok(h.run('JSON.stringify(Game.units.filter(u => u.type === "serf").slice(0, 5).map(u => [u.x.toFixed(2), u.y.toFixed(2)]))') === serf0, 'во время поединка жители ходят');
ok(h.run('Game.wgs.duel ? Game.wgs.duel.t : 99') > 3, 'часы поединка не идут');
h.run('var N = Game.neutrals.find(N => N.k === "wgchief"); neuHit(N, H, 9999);');
ok(h.run('N.hp') >= 1 && h.run('N.st') !== 'die', 'вождь погиб, а должен сдаться');
h.run('N.hp = 1; N.iframe = 0;');
const units0 = h.run('Game.units.length');
S.runFor(sim, 0.2, 0.2);
ok(!h.run('Game.wgs.duel'), 'поединок не кончился победой');
ok(h.run('W0.own') > 0, 'деревня не присоединилась');
ok(h.run('Game.units.length') >= units0 + 2, 'жители деревни не пришли');
ok(!h.run('Game.neutrals.some(N => N.k === "wgchief")'), 'вождь остался на арене');
ok(h.run('wgTalk(W0.id).ok') === false, 'у своей деревни открылось окно торговли');
h.run('wgDaily(W0.own)');
ok(h.run('W0.own') === 0 && h.run('W0.evil') === 0, 'бунта не было');

// 7. Злое поселение: окно только с поединком и откупом
h.run('var E0 = Game.wgs.list.find(S => S.evil); dilEnsure().cur = null;');
if (h.run('!!E0')) {
  ok(h.run('wgTalk(E0.id).ok') === true, 'у злых окно не открылось');
  ok(h.run('Game.dil.cur.id') === h.run('"wg_" + E0.fac + "_evil"'), 'у злых не их событие');
  h.run('dilResolve(1, null)');
  ok(h.run('E0.rel') <= -10, 'злые подружились за откуп');
}

// 8. Сохранение → загрузка
const sv = h.run('JSON.stringify(serializeGame())');
ok(!h.run(`JSON.parse(${JSON.stringify(sv)}).obj.some(e => e[1] === 'wgb')`), 'клетки поселений попали в сохранение объектов');
const n0 = h.run('Game.wgs.list.length'), rels = h.run('Game.wgs.list.map(S => S.rel).join()');
h.run(`applySave(JSON.parse(${JSON.stringify(sv)}))`);
ok(h.run('Game.wgs.list.length') === n0, 'поселения не пережили сохранение');
ok(h.run('Game.wgs.list.map(S => S.rel).join()') === rels, 'отношения не сохранились');
ok(h.run('Game.wgs.list.every(S => wgCells(S).every(i => World.obj[i] && World.obj[i].blk))'), 'после загрузки клетки поселений проходимы');
// старое сохранение без поселений — появятся при загрузке
const old = JSON.parse(sv); delete old.wgs;
h.run(`applySave(${JSON.stringify(old)})`);
ok(h.run('Game.wgs.list.length') >= 1, 'у старого сохранения не появились поселения');

S.runFor(sim, 60, 10);
ok(!sim.errors.length, 'исключения: ' + sim.errors.slice(0, 3).join(' | '));
console.log(fails.length ? `Проверка: дикие гномы — ${fails.length} провалов` : 'Проверка: дикие гномы — всё в порядке');
process.exit(fails.length ? 1 : 0);
