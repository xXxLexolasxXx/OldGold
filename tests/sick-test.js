'use strict';
// Болезни и лазарет (sickness.js): зараза и выздоровление, эпидемия, лазарет с лекарем и зельями, «Спокойный» без смертей,
// сохранение и старые сейвы. Запуск: node tests/sick-test.js [минуты]
const S = require('./lib/sim');
const MIN = +process.argv[2] || 8;
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

function run(label, setup, opts = {}) {
  const sim = S.newSim(opts.seed || 7);
  if (opts.diff) sim.h.run(`Game.diff = "${opts.diff}"`);
  if (setup) sim.h.run(setup);
  S.runFor(sim, (opts.min || MIN) * 60, 10, k => { if (k % 3 === 0) S.botTurn(sim); if (opts.each) sim.h.run(opts.each); });
  const r = S.inspect(sim);
  const st = JSON.parse(sim.h.run('JSON.stringify(Game.med ? Game.med.st : {})'));
  const sick = sim.h.run('Game.units.filter(u => u.ill && !u.dead).length');
  console.log(`${label.padEnd(26)} жителей ${r.n.units}, больных ${sick}, заболело ${st.sick | 0}, вылечено ${st.cured | 0}, умерло ${st.died | 0}, зелий ${st.potions | 0}, ошибок ${sim.errors.length}`);
  ok(!sim.errors.length, `${label}: исключения: ${sim.errors.slice(0, 2).join(' | ')}`);
  const inv = S.checkInvariants(sim, label); for (const pr of inv.problems) ok(false, pr);
  const nan = sim.h.run('Game.units.some(u => u.ill && !(u.ill.s >= 0 && u.ill.s <= 1))');
  ok(!nan, `${label}: тяжесть болезни вне 0…1`);
  return { sim, r, st, sick };
}
const infect = (n, k) => `Game.time = Math.max(Game.time, 31); { const c = Game.units.filter(u => skOn(u)); for (let i = 0; i < ${n} && i < c.length; i++) sickInfect(c[i], "${k}", "тест"); }`;

const base = run('обычная игра', null);
ok(base.st.sick == null || base.st.sick < base.r.n.units, 'в обычной игре болеют все сразу');

const pox = run('чума у шестерых', infect(6, 'pox'));
ok(pox.st.sick >= 6, 'заражение не засчитано');
ok(pox.st.cured + pox.st.died + pox.sick >= 6, 'больные потерялись: ни выздоровели, ни умерли, ни болеют');

const calm = run('чума, «Спокойный»', infect(8, 'pox'), { diff: 'calm' });
ok((calm.st.died | 0) === 0, '«Спокойный»: от болезни умирать нельзя');

// лазарет: ставим готовый у дороги рядом со складом, лекаря и зелья
const WARD = `if (!globalThis.__wd && Game.time > 150) { globalThis.__wd = 1; ` + infect(5, 'cold') + `
  const st = Game.buildings.find(b => b.type === 'storehouse');
    let placed = null;
    for (let r = 3; r < 16 && !placed; r++) for (let dy = -r; dy <= r && !placed; dy++) for (let dx = -r; dx <= r && !placed; dx++) {
      const x = st.x + dx, y = st.y + dy;
      if (checkPlacement('infirmary', x, y, 0)) continue;
      placed = placeBuilding('infirmary', x, y, true, 0);
    }
    if (placed) { placed.stock.potion = 6; const u = spawnUnit('healer', placed.doorX, placed.doorY + 1); }
    for (const u of Game.units) if (u.ill) u.ill.s = 0.7; }`;
const ward = run('лазарет с лекарем', null, { min: 7, each: WARD });
ok(ward.sim.h.run('Game.buildings.some(b => b.type === "infirmary")'), 'лазарет не поставился');
ok(ward.st.cured >= 1 && ward.st.potions >= 1, 'никто не вылечился в лазарете');

// эпидемия
const h = base.sim.h;
h.run('Game.med = null;' + infect(12, 'pox') + ' sickTick(1.1);');
ok(h.run('Game.med.epi') === true || h.run('Game.units.filter(u => skOn(u)).length') < 12, 'дюжина чумных — а эпидемии нет');
ok(h.run('sickMood(Game.units.find(u => skOn(u) && u.ill))') < -5, 'болезнь почти не портит настроение');
ok(h.run('sickMul(Game.units.find(u => skOn(u) && u.ill))') < 1, 'болезнь не замедляет работу');

// сохранение
const s = JSON.parse(h.run('JSON.stringify(serializeGame())'));
const nIll = h.run('Game.units.filter(u => u.ill).length');
ok(s.med && s.units.filter(d => d.ill).length === nIll, 'болезни не пишутся в сохранение');
h.run('for (const u of Game.units) u.ill = null; Game.med = null;');
h.ctx.__s = s; h.run('applySave(__s)');
ok(h.run('Game.units.filter(u => u.ill).length') === nIll && h.run('Game.med.epi') === s.med.epi, 'болезни не восстановились из сохранения');
const bad = JSON.parse(JSON.stringify(s)); bad.units[0].ill = ['__proto__', 5]; if (bad.units[1]) bad.units[1].ill = ['cold', 'x']; bad.med = { st: { sick: 'много' }, epi: 1, pd: null };
h.ctx.__s = bad; h.run('applySave(__s)');
ok(!h.run('Game.units[0].ill') && (!h.run('Game.units[1]') || !h.run('Game.units[1].ill')), 'мусорные болезни из сохранения прошли');
ok(h.run('Game.med.st.sick') === 0, 'мусор в статистике болезней прошёл');
const old = JSON.parse(JSON.stringify(s)); delete old.med; old.units.forEach(d => delete d.ill);
h.ctx.__s = old; h.run('applySave(__s)');
ok(h.run('Game.med') === null && h.run('Game.units.some(u => u.ill)') === false, 'старый сейв без болезней даёт больных');

console.log(fails.length ? `\nПровалено: ${fails.length}` : '\nБолезни: OK');
process.exit(fails.length ? 1 : 0);
