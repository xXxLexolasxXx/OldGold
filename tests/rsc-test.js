'use strict';
// Открытия (research.js): читальня копит знания, порядок в ветке и звания, эффекты (темп, сытость, места под указы,
// цены), без открытий экономика не меняется, сохранение и старые сейвы. Запуск: node tests/rsc-test.js [минуты]
const S = require('./lib/sim');
const MIN = +process.argv[2] || 6;
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

function run(label, setup) {
  const sim = S.newSim(7);
  if (setup) sim.h.run(setup);
  S.runFor(sim, MIN * 60, 10, k => { if (k % 3 === 0) S.botTurn(sim); });
  const r = S.inspect(sim), p = r.produced;
  console.log(`${label.padEnd(20)} жителей ${r.n.units}, брёвна ${p.trunk | 0}, доски ${p.timber | 0}, камень ${p.stone | 0}, знаний ${sim.h.run('Game.rsc ? Math.floor(Game.rsc.pts) : 0')}, ошибок ${sim.errors.length}`);
  ok(!sim.errors.length, `${label}: исключения: ${sim.errors.slice(0, 2).join(' | ')}`);
  const inv = S.checkInvariants(sim, label); for (const pr of inv.problems) ok(false, pr);
  return { sim, r, p };
}
const give = 'for (const s of Game.buildings) if (s.isStore()) { for (const g of ["gold","stone","timber","bread","sausage","hops","beer","magicstone"]) s.stock[g] = (s.stock[g]||0) + 60; break; }';

const base = run('без открытий');
const empty = run('пустой Game.rsc', 'rscEnsure(); rscRecalc();');
ok(JSON.stringify(empty.p) === JSON.stringify(base.p), 'пустые открытия меняют экономику');
const lib = run('читальня', `{ const st = Game.buildings.find(b => b.type === 'storehouse'); let ok = null;
  for (let r = 3; r < 16 && !ok; r++) for (let dy = -r; dy <= r && !ok; dy++) for (let dx = -r; dx <= r && !ok; dx++) if (!checkPlacement('library', st.x + dx, st.y + dy, 0)) ok = placeBuilding('library', st.x + dx, st.y + dy, true, 0); }`);
const pts = lib.sim.h.run('Game.rsc ? Game.rsc.pts : 0');
ok(pts > MIN * 60 / 8 * 0.8 && pts <= 240, `читальня накопила ${pts} знаний за ${MIN} мин`);
const saw = run('пила и плуг', give + 'rscEnsure().pts = 200; goalEnsure().rank = 0; rscOpen("saw"); rscOpen("plough");');
ok(saw.sim.h.run('Game.rsc.done.join()') === 'saw,plough', 'открытия не открылись: ' + saw.sim.h.run('Game.rsc.done.join()'));
ok(saw.sim.h.run('Game.units.filter(u => u.home && u.home.type === "woodcutter").every(u => resWork(u) > 1.1 && u.mdMul > 0)'), 'пила не ускоряет лесоруба');

// правила
const h = base.sim.h;
h.run(give + 'Game.rsc = null; rscRecalc(); goalEnsure().rank = 0;');
ok(h.run('rscOpen("saw").text') === 'Мало знаний', 'без знаний открылось');
h.run('rscEnsure().pts = 240');
ok(h.run('rscOpen("mason").text').startsWith('Сначала'), 'порядок в ветке не проверяется');
ok(h.run('rscOpen("saw").ok') && h.run('rscOpen("mason").ok'), 'по порядку не открывается');
ok(h.run('rscOpen("forge").text').startsWith('Нужно звание'), 'звание не проверяется');
h.run('goalEnsure().rank = 2; rscEnsure().pts = 240;');
ok(h.run('rscOpen("forge").ok && rscOpen("brand").ok'), 'с городом не открылось');
const q0 = h.run('tradeQuote("bread","sell")');
h.run('Game.rsc.done = Game.rsc.done.filter(x => x !== "brand"); rscRecalc()');
ok(q0 > h.run('tradeQuote("bread","sell")'), 'клейма не поднимают цену продажи');
h.run('rscEnsure().pts = 240; rscOpen("lamps"); rscEnsure().pts = 240; rscOpen("circle"); rscEnsure().pts = 240; rscOpen("calendar"); rscEnsure().pts = 240; rscOpen("council");');
ok(h.run('lawSlots()') === 4 && h.run('resMood()') === 2, 'совет мудрецов не дал места или календарь не дал настроения');
h.run('rscEnsure().pts = 240; rscOpen("plough"); rscEnsure().pts = 240; rscOpen("yeast"); rscEnsure().pts = 240; rscOpen("salt");');
ok(h.run('dif().food') > h.run('DIFFS[Game.diff].food'), 'соленья не продлевают сытость');

// сохранение
const s = JSON.parse(h.run('JSON.stringify(serializeGame())'));
ok(s.rsc && s.rsc.done.length === 10, 'открытия не пишутся в сохранение');
h.run('Game.rsc = null; rscRecalc();'); h.ctx.__s = s; h.run('applySave(__s)');
ok(h.run('Game.rsc.done.length') === 10 && h.run('lawSlots()') === 4, 'открытия не восстановились');
h.ctx.__s = Object.assign({}, s, { rsc: { done: ['saw', 'saw', '__proto__', 'nope'], pts: 1e9 } }); h.run('applySave(__s)');
ok(h.run('Game.rsc.done.join()') === 'saw' && h.run('Game.rsc.pts') === 240, 'мусор в сохранении открытий прошёл');
const old = Object.assign({}, s); delete old.rsc; h.ctx.__s = old; h.run('applySave(__s)');
ok(h.run('Game.rsc') === null && h.run('lawSlots()') === 3 && h.run('resMood()') === 0, 'старый сейв без открытий даёт открытия');

console.log(fails.length ? `\nПровалено: ${fails.length}` : '\nОткрытия: OK');
process.exit(fails.length ? 1 : 0);
