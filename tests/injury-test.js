'use strict';
// Травмы и лечение (life.js, sickness.js): шанс травмы от толчка, раненый сам идёт в лазарет, лекарь выходит к тому,
// кто не дошёл, сводка о травмах не спамит, уронённый груз не пропадает, куры не уносят гнома насовсем.
// Запуск: node tests/injury-test.js
const S = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

const sim = S.newSim(5);
const h = sim.h;
h.run('Game.noGrace = true');
S.runFor(sim, 60, 10);

// лазарет у склада, лекарь, зелья — как в sick-test
h.run(`(function () {
  const st = Game.buildings.find(b => b.type === 'storehouse');
  let placed = null;
  for (let r = 3; r < 18 && !placed; r++) for (let dy = -r; dy <= r && !placed; dy++) for (let dx = -r; dx <= r && !placed; dx++) {
    if (checkPlacement('infirmary', st.x + dx, st.y + dy, 0)) continue;
    placed = placeBuilding('infirmary', st.x + dx, st.y + dy, true, 0);
  }
  globalThis.__ward = placed;
  placed.stock.potion = 0;
  globalThis.__doc = spawnUnit('healer', placed.doorX, placed.doorY + 1);
  // считаем всплывающие сводки
  globalThis.__says = [];
  skSay = t => __says.push(t);
})()`);
ok(h.run('!!__ward'), 'лазарет не поставился');
S.runFor(sim, 15, 5);
ok(h.run('__ward.worker === __doc'), 'лекарь не устроился в лазарет');

// 1. Калибровка: днём, бодрый, трезвый — около 30 %; гномёнок — реже; ночью и хмельной — чаще
h.run(`globalThis.__a = Game.units.find(u => u.type === 'serf'); globalThis.__b = Game.units.find(u => u.type !== 'serf' && isPerson(u) && u.type !== 'hero' && u !== __doc)`);
const base = h.run('bumpInjuryChance({ type: "builder", md: { rest: 0.8 } }, { carry: "bread" })');
const kid = h.run('bumpInjuryChance({ type: "kid", md: { rest: 0.8 } }, { carry: "bread" })');
const drunk = h.run('bumpInjuryChance({ type: "builder", md: { rest: 0.1 }, drunkAt: 5 }, { carry: "bread" })');
console.log(`шанс травмы от толчка: обычный ${base.toFixed(2)}, гномёнок ${kid.toFixed(2)}, хмельной и сонный ${drunk.toFixed(2)}`);
ok(base > 0.1 && base < 0.5, 'шанс травмы от толчка вне 10…50 %');
ok(kid < base && drunk > base, 'гномёнку и хмельному шанс не отличается');
ok(h.run('INJURY_GAP') >= 30, 'лимит травм от толчков на деревню слишком мал');

// 2. Раненый налегке сам идёт в лазарет и выходит здоровым (лекарь на месте — без зелья)
h.run(`__b.carry = null; injure(__b, 'leg');`);
ok(h.run('!!__b.injury'), 'injure не поставил травму');
let t = 0;
while (t < 60 && h.run('!!__b.injury')) { S.runFor(sim, 5, 5); t += 5; }
console.log(`раненый ${h.run('__b.type')}: вылечен за ${t} с (${h.run('__b.healedBy')})`);
ok(!h.run('__b.injury'), 'раненый не вылечился у лекаря за 60 с (сам заживает за 150)');
// занятого нельзя оторвать от дела: к нему через CALL с выходит лекарь (injTick) — тоже верный исход, зависит от того, чем занят житель
ok(['ward', 'doc'].includes(h.run('__b.healedBy')), 'вылечился не у лекаря и не в лазарете: ' + h.run('__b.healedBy'));

// 3. Не может дойти — лекарь выходит к нему сам
h.run(`__a.carry = null; injure(__a, 'arm'); __a.injTry = Game.time + 1e6;`);
t = 0;
let doc = false;
while (t < 75 && h.run('!!__a.injury')) { S.runFor(sim, 3, 3); t += 3; doc = doc || h.run('!!__a.injDoc'); }
console.log(`не дошедший ${h.run('__a.type')}: лекарь ${doc ? 'вышел' : 'не вышел'}, вылечен за ${t} с (${h.run('__a.healedBy')})`);
ok(doc, 'лекарь не вышел к раненому, который не может дойти');
ok(!h.run('__a.injury') && h.run('__a.healedBy') === 'doc', 'лекарь не вылечил раненого на месте');

// 3б. Средство для раны: перевязка раньше зелья (зелья — для хворей); «Совет» показывает раненых
if (h.run('!!GOODS.bandage')) {
  h.run('__ward.stock.bandage = 1; __ward.stock.potion = 1;');
  ok(h.run('injTakeAid(__ward)') === 'bandage' && h.run('__ward.stock.potion') === 1, 'на рану ушло зелье, хотя есть перевязка');
}
h.run('__a.injury = null; injure(__a, "leg");');
ok(/Раненых: <b>[1-9]/.test(h.run('medHTML()')), 'в «Совете» не видно раненых');

// 3в. Травма переживает сохранение
h.run('__a.injuryUntil = Game.time + 77; globalThis.__k = Game.units.indexOf(__a); globalThis.__sv = JSON.parse(JSON.stringify(serializeGame())); applySave(__sv);');
const inj = JSON.parse(h.run('JSON.stringify([Game.units[__k].injury, Math.round(Game.units[__k].injuryUntil - Game.time)])'));
ok(inj[0] === 'leg' && inj[1] >= 70 && inj[1] <= 77, 'травма не восстановилась из сохранения: ' + inj);
h.run(`globalThis.__a = Game.units[__k]; globalThis.__ward = Game.buildings.find(b => b.type === 'infirmary'); globalThis.__doc = Game.units.find(u => u.type === 'healer'); skSay = t => __says.push(t);
  for (const u of Game.units) if (u.injury) { u.injury = null; u.injuryUntil = 0; }`);

// 4. Сводка: десять травм за минуту — не больше одной всплывашки, с причиной
h.run(`__says.length = 0; for (const b of Game.buildings) if (b.type === 'infirmary') b.worker = null;
  __doc.dead = true; for (const u of Game.units.filter(u => isPerson(u) && u.type !== 'hero' && !u.dead).slice(0, 10)) { u.injury = null; injure(u, 'leg'); }`);
S.runFor(sim, 65, 5);
const says = JSON.parse(h.run('JSON.stringify(__says)')).filter(s => /Травм/.test(s));
console.log('сводка: ' + (says[0] || 'нет'));
ok(says.length === 1, `сводок о травмах за минуту: ${says.length}, а нужна одна`);
ok(says.length && /нет ни лекаря|нет лекаря/.test(says[0]), 'в сводке нет причины «нет лекаря»');
h.run('__doc.dead = false');

// 5. Груз не пропадает: уронить некуда — остаётся в руках; есть куда — кучка на земле
h.run(`globalThis.__dp = dropPile; dropPile = () => null; __a.carry = 'bread'; __a.carryN = 1;`);
ok(h.run('dropLoad(__a)') === null && h.run('__a.carry') === 'bread', 'груз пропал, когда положить было некуда');
h.run('dropPile = __dp');
const before = h.run('[...Game.piles.values()].reduce((n, p) => n + p.stock.bread, 0)');
h.run('dropLoad(__a)');
ok(h.run('[...Game.piles.values()].reduce((n, p) => n + p.stock.bread, 0)') === before + 1 && !h.run('__a.carry'), 'уронённый хлеб не лёг кучкой на землю');

// 6. Куры мстят, но не уносят гнома насовсем
h.run(`Game.diff = 'normal'; for (let i = 0; i < 4; i++) { const st = Game.buildings.find(b => b.type === 'storehouse'); const a = makeAnimal('chicken', st.doorX + i, st.doorY + 3); a.home = [st.doorX, st.doorY + 3]; Game.animals.push(a); }
  globalThis.__v = Game.units.find(u => u.type === 'serf' && u !== __a && !u.inside) || __a; __v.injury = null;
  globalThis.__henRm = 0; const _ru = removeUnit; removeUnit = function (u) { if (/avengeTick/.test(String(new Error().stack))) __henRm++; return _ru(u); };
  triggerAvenge(__v);`);
S.runFor(sim, 30, 5);
ok(h.run('__henRm') === 0, 'куры унесли гнома насовсем');
ok(!h.run('(Game.avenge || []).some(ev => ev.vid === __v.id)'), 'месть кур не закончилась за 30 с');

ok(!sim.errors.length, 'исключения: ' + sim.errors.slice(0, 3).join(' | '));
for (const p of S.checkInvariants(sim, 'травмы').problems) ok(false, p);

if (fails.length) { console.log(`✗ травмы: провалов ${fails.length}`); process.exit(1); }
console.log('Проверка травм: всё в порядке');
process.exit(0);   // песочница держит таймеры — без выхода процесс не завершится
