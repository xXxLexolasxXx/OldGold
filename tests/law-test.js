'use strict';
// Указы (laws.js): без указов экономика не меняется, указы работают в обе стороны, сохранение и старые сейвы.
// Запуск: node tests/law-test.js [минуты]
const S = require('./lib/sim');
const MIN = +process.argv[2] || 6;
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

function run(label, setup, seed = 7) {
  const sim = S.newSim(seed);
  sim.h.run("Game.noGrace = true");
  if (setup) sim.h.run(setup);
  S.runFor(sim, MIN * 60, 10, k => { if (k % 3 === 0) S.botTurn(sim); });
  const r = S.inspect(sim);
  const p = r.produced;
  console.log(`${label.padEnd(22)} жителей ${r.n.units}, доски ${p.timber | 0}, хлеб ${p.bread | 0}, камень ${p.stone | 0}, ошибок ${sim.errors.length}`);
  ok(!sim.errors.length, `${label}: исключения: ${sim.errors.slice(0, 2).join(' | ')}`);
  const inv = S.checkInvariants(sim, label); for (const pr of inv.problems) ok(false, pr);
  return { sim, r, p };
}
const give = 'for (const s of Game.buildings) if (s.isStore()) { s.stock.gold = (s.stock.gold||0) + 200; s.stock.beer = (s.stock.beer||0) + 40; break; }';
const enact = ids => give + ids.map(id => `goalEnsure().rank = 2; lawSet("${id}", true); Game.laws.day = -9;`).join('');

const base = run('без указов');
const none = run('пустой Game.laws', 'lawEnsure(); lawRecalc();');
ok(JSON.stringify(none.p) === JSON.stringify(base.p), 'пустые указы меняют экономику');

const strict = run('жёсткий режим', enact(['strict']));
ok(strict.sim.h.run('lawWork()') > 1 && strict.sim.h.run('MD.FIGHT_GAP') > 70, 'жёсткий режим не ускоряет работу или не реже драки');
const mix = run('пир+ворота+пиво', enact(['feast', 'open', 'beer']));
ok(mix.sim.h.run('Game.laws.on.length') === 3, 'три указа в городе должны встать: ' + mix.sim.h.run('JSON.stringify(Game.laws.on)'));
ok(mix.sim.h.run('dif().food') < base.sim.h.run('dif().food'), 'сытный стол не меняет dif().food');

// правила
const h = base.sim.h;
h.run(give + 'Game.goal && (Game.goal.rank = 0); lawEnsure().on = []; Game.laws.day = -9; lawRecalc();');
ok(h.run('lawSet("strict", true).ok') === true, 'указ не вводится');
ok(h.run('lawSet("free", true).ok') === false, 'второй указ в тот же день прошёл');
h.run('Game.laws.day = -9');
ok(h.run('lawSet("free", true).text').includes('Мешает'), 'взаимоисключающие указы не проверяются');
ok(h.run('lawSet("open", true).ok') === false, 'в поселении больше одного места');
ok(h.run('lawMood(false)') === -6, 'жёсткий режим должен давать −6 к настроению, а дал ' + h.run('lawMood(false)'));
h.run('Game.laws.day = -9');
ok(h.run('lawSet("strict", false).ok') === true && h.run('lawWork()') === 1 && h.run('MD.FIGHT_GAP') === 70, 'отмена не возвращает эффекты');

// сохранение
h.run('Game.laws.day = -9; lawSet("watch", true)');
const s = JSON.parse(h.run('JSON.stringify(serializeGame())'));
ok(s.law && s.law.on.join() === 'watch', 'указы не пишутся в сохранение');
h.run('Game.laws = null; lawRecalc();');
h.ctx.__s = s; h.run('applySave(__s)');
ok(h.run('lawIsOn("watch")') === true && h.run('LAWC.moodNight') === 3, 'указы не восстановились из сохранения');
h.ctx.__s = Object.assign({}, s, { law: { on: ['watch', 'nope', 'watch', '__proto__'], day: 'x' } }); h.run('applySave(__s)');
ok(h.run('Game.laws.on.join()') === 'watch', 'мусор в сохранении не отфильтрован: ' + h.run('Game.laws.on.join()'));
const old = Object.assign({}, s); delete old.law; h.ctx.__s = old; h.run('applySave(__s)');
ok(h.run('Game.laws') === null && h.run('lawMood(true)') === 0 && h.run('lawWork()') === 1, 'старый сейв без указов должен давать пустые указы');

// кооп: предложение, голоса, зеркало
h.run(give + 'goalEnsure().rank = 0; Game.laws = null; lawRecalc(); coop.players.set("a", {}); coop.players.set("b", {}); coop.players.set("c", {});');
h.run('lawCmd("a", false, { a: "prop", id: "free", on: true })');
ok(h.run('!!Game.laws.prop && !lawIsOn("free")'), 'предложение в коопе сразу ввело указ или не создалось');
ok(h.run('JSON.parse(JSON.stringify(lawMirrorOut())).prop.id') === 'free', 'зеркало не несёт голосование');
h.run('lawCmd("b", false, { a: "vote", seq: Game.laws.prop.seq, y: true })');
ok(h.run('lawIsOn("free") && !Game.laws.prop'), 'большинство «за» не ввело указ');
h.run('Game.laws.day = -9; lawCmd("a", false, { a: "prop", id: "free", on: false }); lawCmd("b", false, { a: "vote", seq: Game.laws.prop.seq, y: false }); lawCmd("c", false, { a: "vote", seq: Game.laws.prop.seq, y: false })');
ok(h.run('lawIsOn("free") && !Game.laws.prop'), 'большинство «против» отменило указ');
h.run('Game.laws.prop = null; lawCmd("a", false, { a: "prop", id: "__proto__", on: true }); lawCmd("a", false, { a: "prop", id: 5 })');
ok(h.run('!Game.laws.prop'), 'мусорное предложение создало голосование');
h.run('coop.players.clear()');

console.log(fails.length ? `\nПровалено: ${fails.length}` : '\nУказы: OK');
process.exit(fails.length ? 1 : 0);
