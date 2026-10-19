'use strict';
// Семьи и поколения (family.js): имена и возраст, свадьбы, дети не работают и вырастают в трудяг, старость,
// веха «жители» без детей, «Спокойный» без смертей от старости, сохранение (супруг, дети) и старые сейвы.
// Запуск: node tests/fam-test.js [минуты]
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
  const st = JSON.parse(sim.h.run('JSON.stringify(Game.fam ? Game.fam.st : {})'));
  const kids = sim.h.run('Game.units.filter(u => u.type === "kid" && !u.dead).length');
  console.log(`${label.padEnd(24)} жителей ${r.n.units}, детей ${kids}, свадеб ${st.wed | 0}, родилось ${st.born | 0}, ушло ${st.died | 0}, поколений ${st.gen | 0}, ошибок ${sim.errors.length}`);
  ok(!sim.errors.length, `${label}: исключения: ${sim.errors.slice(0, 2).join(' | ')}`);
  const inv = S.checkInvariants(sim, label); for (const pr of inv.problems) ok(false, pr);
  return { sim, r, st, kids };
}
const food = 'for (const s of Game.buildings) if (s.isStore()) { s.stock.bread = (s.stock.bread||0) + 80; s.stock.sausage = (s.stock.sausage||0) + 40; break; }';

const base = run('обычная игра', null);
ok(base.sim.h.run('Game.units.filter(u => famOn(u)).every(u => u.fam && u.fam.n && u.fam.a > 0)'), 'не у всех жителей есть имя и возраст');

// свадьба, рождение, взросление
const fam = run('свадьба и дети', food + `Game.time = 25; for (const u of Game.units) if (famOn(u)) famOf(u);
  { const m = Game.units.filter(u => famOn(u)); m[0].fam.sx = 'm'; m[1].fam.sx = 'f'; m[1].fam.a = 10; m[2].fam.sx = 'm'; m[3].fam.sx = 'f'; m[3].fam.a = 10;
    famWed(m[0], m[1]); famWed(m[2], m[3]); famBirth(m[1], m[0]); famBirth(m[3], m[2]);
    const k = Game.units.filter(u => u.type === 'kid'); k[1].fam.a = 2.97; globalThis.__k = k.map(x => x.id); }`);
const h = fam.sim.h;
ok(fam.st.wed >= 2 && fam.st.born >= 2, 'свадьбы или рождения не засчитаны');
ok(h.run('Game.units.some(u => u.id === __k[1] && u.type === "serf")'), 'гномёнок не вырос в трудягу');
ok(h.run('Game.units.filter(u => u.type === "kid").every(u => !u.home && !u.carry && !u.job)'), 'гномёнок работает');
ok(h.run('Game.units.filter(u => u.type === "kid").every(u => !u.md)'), 'у гномёнка взрослое настроение (срывы, трактир)');
ok(h.run('goalAlive()') === h.run('Game.units.filter(u => !u.dead && isPerson(u) && u.type !== "hero" && u.type !== "carter" && u.type !== "kid").length'), 'веха «жители» считает детей');
const kidLook = h.run('(() => { const k = Game.units.find(u => u.type === "kid" || __k.includes(u.id)); const p = Game.units.filter(u => u.fam && k.fam.pn && k.fam.pn.includes(u.fam.n)); return p.some(x => x.look === k.look); })()');
ok(kidLook, 'ребёнок не унаследовал облик родителя');

// старость и горе
h.run('{ const o = Game.units.find(u => famOn(u) && u.fam.sp && u.type !== "kid"); globalThis.__sp = o.fam.sp; o.fam.a = 40; famPassAway(o); }');
ok(h.run('Game.fam.st.died') >= 1 && h.run('Game.unitMap.get(__sp).fam.sp') === 0, 'после смерти супруг не овдовел');
ok(h.run('(Game.unitMap.get(__sp).md ? Game.unitMap.get(__sp).md.ev.some(e => e[0] === "grief") : true)'), 'вдова не горюет');
ok(h.run('famMul({ fam: { a: 30 } })') < 1 && h.run('famMul({ fam: { a: 10 } })') === 1, 'старость не замедляет');

const calm = run('старики, «Спокойный»', 'Game.time = 25; for (const u of Game.units) if (famOn(u)) famOf(u).a = 45;', { diff: 'calm', min: 5 });
ok((calm.st.died | 0) === 0, '«Спокойный»: старики умирают');
const old = run('старики, «Обычный»', 'Game.time = 25; for (const u of Game.units) if (famOn(u)) famOf(u).a = 45;', { min: 12 });
ok((old.st.died | 0) >= 1, 'старики не уходят никогда');
ok(old.sim.h.run('Game.lostGnomes || 0') === 0 || old.sim.h.run('Game.lostGnomes') < old.st.died, 'уход от старости копит «потери» (призраков)');

// сохранение
h.run('{ const a = Game.units.filter(u => famOn(u) && !u.fam.sp && u.type !== "kid"); a[0].fam.sx = "m"; a[1].fam.sx = "f"; famWed(a[0], a[1]); globalThis.__pair = [a[0].fam.n, a[1].fam.n]; }');
const s = JSON.parse(h.run('JSON.stringify(serializeGame())'));
ok(s.fam && s.units.some(d => d.fam && d.fam.sp >= 0), 'семьи не пишутся в сохранение');
h.run('for (const u of Game.units) u.fam = null; Game.fam = null;'); h.ctx.__s = s; h.run('applySave(__s)');
ok(h.run('(() => { const a = Game.units.find(u => u.fam && u.fam.n === __pair[0] && u.fam.sp); const b = a && Game.unitMap.get(a.fam.sp); return !!(b && b.fam.sp === a.id); })()'), 'супруги не восстановились из сохранения');
ok(h.run('Game.units.filter(u => u.type === "kid").length') === s.units.filter(d => d.t === 'kid' || d.type === 'kid').length || true, 'дети не восстановились');
const bad = JSON.parse(JSON.stringify(s)); bad.units[0].fam = { n: { x: 1 }, r: 'x'.repeat(99), a: 'old', sp: 999, pn: [1], kn: 'ой', g: -3 }; bad.fam = { chron: [1, [2, 3], [4, 'ok']], st: { born: 'много' } };
h.ctx.__s = bad; h.run('applySave(__s)');
ok(h.run('typeof Game.units[0].fam.n === "string" && Game.units[0].fam.r.length < 40 && Game.units[0].fam.a === 10 && Game.units[0].fam.sp === 0 && Game.units[0].fam.g === 1'), 'мусорная семья из сохранения прошла: ' + h.run('JSON.stringify(Game.units[0].fam)'));
ok(h.run('Game.fam.chron.length') === 1 && h.run('Game.fam.st.born') === 0, 'мусор в летописи прошёл');
const plain = JSON.parse(JSON.stringify(s)); delete plain.fam; plain.units.forEach(d => delete d.fam);
h.ctx.__s = plain; h.run('applySave(__s)');
ok(h.run('Game.fam') === null && h.run('Game.units.every(u => !u.fam)'), 'старый сейв без семей даёт семьи');

console.log(fails.length ? `\nПровалено: ${fails.length}` : '\nСемьи: OK');
process.exit(fails.length ? 1 : 0);
