'use strict';
// «Навались!» (js/rush.js): без кнопки экономика прежняя; кнопка шлёт свободных работяг и мастеров без дела
// на дефицит; отбой и таймер возвращают как было; сохранение; кооп-команда и зеркало.
// Запуск: node tests/rush-test.js [минуты разгона]
const S = require('./lib/sim');
const { FILES } = require('../server/simhost');
const MIN = +process.argv[2] || 5;
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

// разгон: бот ставит лесоруба, лесопилку, ферму, каменоломню… — как в других сценарных тестах
function warm(opts) {
  const sim = S.newSim(7, opts);
  sim.h.run('Game.noGrace = true');
  S.runFor(sim, MIN * 60, 10, k => { if (k % 3 === 0) S.botTurn(sim); });
  return sim;
}

// 1. Без кнопки — как раньше: тот же сид без rush.js даёт то же самое
const base = warm();
const bare = warm({ files: FILES.filter(f => f !== 'rush') });
const pb = S.inspect(base).produced, pn = S.inspect(bare).produced;
ok(JSON.stringify(pb) === JSON.stringify(pn), 'без нажатия «Навались!» экономика изменилась: ' + JSON.stringify(pb).slice(0, 160) + ' vs ' + JSON.stringify(pn).slice(0, 160));
const h = base.h;
ok(h.run('Game.rush') == null && h.run('Game.units.every(u => !(u.rushJob >= 0))'), 'без кнопки кто-то навалился');
ok(!base.errors.length, 'исключения при разгоне: ' + base.errors.slice(0, 2).join(' | '));

// 2. Кнопка: что в дефиците и кто идёт
const needs = JSON.parse(h.run('JSON.stringify(rushNeeds())'));
console.log('нехватка:', Object.entries(needs).map(([k, v]) => `${k} ${v.short}${v.can ? '' : ' (нельзя)'}`).join(', '));
ok(h.run('rushToggle("тест")') === true && h.run('rushOn()'), 'кнопка не включила «Навались!»');
const kind = h.run('Game.rush.k');
ok(['wood', 'stone', 'grain'].includes(kind), 'непонятно, на что навалились: ' + kind);
const best = Object.keys(needs).filter(k => needs[k].can).sort((a, b) => needs[b].short - needs[a].short)[0];
ok(kind === best, `навалились на ${kind}, а нехватка больше у ${best}`);
// каменоломня всё время полна, мельнице нечего молоть — мастера без дела; принудительно — брёвна, их на карте много
h.run('Game.rush.k = "wood"; Game.rush.nT = 1e9; Game.rush.until = Game.time + 1e4;');
const keepIdle = `for (const b of Game.buildings) { if (b.type === 'quarry' && b.state === 'done') b.stock.stone = b.def.outputs.stone; if (b.type === 'mill') b.stock.wheat = 0; }`;
const trunk0 = h.run('Game.produced.trunk');
const seen = new Set();
let builders = 0, profs = 0;
for (let k = 0; k < 90; k++) {
  h.run(keepIdle);
  S.stepN(base, 20);
  const who = JSON.parse(h.run('JSON.stringify(Game.units.filter(u => u.rushJob >= 0).map(u => [u.id, u.type, isProf(u)]))'));
  for (const [id, t, p] of who) if (!seen.has(id)) { seen.add(id); if (t === 'builder') builders++; else if (p) profs++; }
}
console.log(`навалились: работяг ${builders}, мастеров ${profs}, брёвен +${h.run('Game.produced.trunk') - trunk0}`);
ok(builders > 0, 'свободные работяги не навалились');
ok(profs > 0, 'мастера без дела (каменотёс у полной каменоломни, мельник без зерна) не навалились');
ok(h.run('Game.produced.trunk') > trunk0, 'брёвен не прибавилось');
ok(h.run('Game.units.filter(u => u.rushJob >= 0).every(u => u.type !== "hero" && !u.teamOf)'), 'навалился герой или напарник');
ok(/наваливается/.test(h.run('(Game.units.find(u => u.rushJob >= 0) && wkDoing(Game.units.find(u => u.rushJob >= 0))) || "наваливается"')), 'в карточке гнома нет «наваливается»');

// 3. Сохранение
const s = JSON.parse(h.run('JSON.stringify(serializeGame())'));
ok(s.rush && s.rush.k === 'wood' && s.rush.left > 0, '«Навались!» не пишется в сохранение: ' + JSON.stringify(s.rush));
h.ctx.__s = s; h.run('applySave(__s)');
ok(h.run('rushOn() && Game.rush.k === "wood" && Game.rush.until > Game.time'), '«Навались!» не восстановилось из сохранения');
h.ctx.__s = Object.assign({}, s, { rush: { k: '__proto__', left: 50 } }); h.run('applySave(__s)');
ok(!h.run('rushOn()'), 'мусор в сохранении включил «Навались!»');
const old = Object.assign({}, s); delete old.rush; h.ctx.__s = old; h.run('applySave(__s)');
ok(h.run('Game.rush') === null, 'старый сейв без поля rush должен давать «выключено»');

// 4. Отбой: начатое доделывают, нового не берут
h.run('rushToggle(); Game.rush.k = "wood"; Game.rush.nT = 1e9;');
S.stepN(base, 200);
ok(h.run('Game.units.some(u => u.rushJob >= 0)'), 'после загрузки никто не навалился');
h.run('rushToggle()');
ok(!h.run('rushOn()'), 'повторное нажатие не выключило');
S.stepN(base, 1200);   // 60 с — каждый доделал своё
ok(h.run('Game.units.every(u => !(u.rushJob >= 0))'), 'после отбоя гномы всё ещё наваливаются: ' + h.run('Game.units.filter(u => u.rushJob >= 0).length'));
ok(h.run('World.obj.filter(o => o && o.t === "tree" && o.res).length <= Game.units.filter(u => !u.dead && (u.type === "woodcutter" || u.chopJob >= 0 || u.cmd)).length'), 'после отбоя деревья остались забронированными');
// таймер
h.run('rushToggle(); Game.rush.until = Game.time + 1;');
S.stepN(base, 60);
ok(!h.run('rushOn()'), 'таймер не выключил «Навались!»');
ok(!base.errors.length, 'исключения: ' + base.errors.slice(0, 2).join(' | '));

// 5. Кооп: команда игрока, права, зеркало
const co = S.newSim(9, { coop: true });
const c = co.h;
c.run(`coopJoin('a', JSON.stringify({ cls: 'warrior' }))`);
S.runFor(co, 60, 10, k => { if (k % 3 === 0) S.botTurn(co); });
c.run('coop.perms.manage = false; coop.out.length = 0');
c.run(`coopCmd('a', JSON.stringify({ t: 'rush' }), false)`);
ok(!c.run('rushOn()'), 'игрок без права «управлять» включил «Навались!»');
c.run('coop.perms.manage = true');
S.stepN(co, 30);
c.run(`coopCmd('a', JSON.stringify({ t: 'rush' }), false)`);
ok(c.run('rushOn()'), 'кооп-команда не включила «Навались!»');
const mir = JSON.parse(c.run('JSON.stringify(coopMirror().rush)'));
ok(mir && mir.k === c.run('Game.rush.k') && mir.until > 0, 'зеркало не несёт «Навались!»: ' + JSON.stringify(mir));
ok(c.run('coop.out.some(o => o.msg && o.msg.t === "toast" && /Навались/.test(o.msg.text))'), 'игроки не услышали «Навались!»');
c.run(`coopCmd('a', JSON.stringify({ t: 'rush' }), false)`);
ok(c.run('rushOn()'), 'вторая команда сразу же прошла (нет защиты от двойного нажатия)');
S.stepN(co, 30);
c.run(`coopCmd('a', JSON.stringify({ t: 'rush' }), false)`);
ok(!c.run('rushOn()') && c.run('coopMirror().rush') === null, 'кооп-команда не выключила «Навались!»');
// клиент: из зеркала — состояние для кнопки, сам никого не шлёт
c.run('rushMirrorIn({ k: "stone", why: "x", until: Game.time + 30 })');
ok(c.run('Game.rush.k === "stone"'), 'клиент не принял зеркало');
c.run('rushMirrorIn(null)');
ok(c.run('Game.rush') === null, 'клиент не снял «Навались!» по зеркалу');
c.run('rushMirrorIn({ k: "nope" })');
ok(c.run('Game.rush') === null, 'клиент принял мусор из зеркала');
ok(!co.errors.length, 'кооп: исключения: ' + co.errors.slice(0, 2).join(' | '));

console.log(fails.length ? `\nПровалено: ${fails.length}` : '\nНавались: OK');
process.exit(fails.length ? 1 : 0);
