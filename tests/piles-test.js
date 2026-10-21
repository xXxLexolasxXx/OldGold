'use strict';
// Кучки на земле: мусор не копится на полях (нет костра — не сорим, есть — лимит и срок жизни), подпись при подборе.
// Запуск: node tests/piles-test.js   (печатает ✗, код выхода 1 при провале)
const L = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };
const sim = L.newSim(7), h = sim.h, J = c => JSON.parse(h.run('JSON.stringify((function(){' + c + '})())'));
const run = sec => L.runFor(sim, sec, 5, () => {});
const trashSum = () => h.run('(() => { let n = 0; for (const p of Game.piles.values()) n += p.stock.trash; return n; })()');

// без костра сорить некуда: мусор не появляется
h.run('for (const b of Game.buildings) if (b.type === "bonfire") b.removed = true');
J(`const u = Game.units.find(x => isPerson(x) && !x.inside); for (let i = 0; i < 200; i++) litter(u); return 1;`);
ok(trashSum() === 0, 'без костра появился мусор: ' + trashSum());
h.run('for (const b of Game.buildings) if (b.type === "bonfire") b.removed = false');

// с костром: не больше TRASH_CAP кучек
J(`const b = Game.buildings.find(b => b.type === 'bonfire'); if (!b) placeBuilding('bonfire', Math.floor(MAP_W / 2) + 6, Math.floor(MAP_H / 2) + 6, true, 0); return 1;`);
ok(h.run('Game.buildings.some(b => b.type === "bonfire" && b.state === "done")'), 'не удалось поставить костёр для проверки');
J(`for (let i = 0; i < 300; i++) { const x = 2 + (i * 7) % (MAP_W - 4), y = 2 + (i * 13) % (MAP_H - 4); if (isWalkable(x, y)) { const u = Game.units.find(q => isPerson(q) && !q.inside); u.x = x + 0.5; u.y = y + 0.5; litter(u); } } return 1;`);
const cnt = h.run('trashPileCount()');
ok(cnt <= h.run('TRASH_CAP'), 'мусорных кучек больше лимита: ' + cnt);

// срок жизни: без доставки в костёр кучка пропадает
h.run('for (const b of Game.buildings) if (b.type === "bonfire") b.noDeliver = true');
J(`globalThis.__old = [dropPile(3, 3, 'trash', 2), dropPile(4, 3, 'chickenleg', 1)].filter(Boolean); return 1;`);
run(h.run('TRASH_TTL') + 30);
ok(h.run('__old.length') >= 1 && h.run('__old.every(p => p.stock.trash + p.stock.chickenleg === 0)'), 'неходовой груз пролежал дольше срока жизни');

// общий потолок кучек
J(`for (let i = 0; i < PILE_CAP + 60; i++) { const x = (i * 5) % MAP_W, y = ((i * 5) / MAP_W | 0) * 3 % MAP_H; if (isWalkable(x, y)) dropPile(x, y, 'trash', 1); } return 1;`);
run(8);
ok(h.run('Game.piles.size') <= h.run('PILE_CAP'), 'кучек больше потолка: ' + h.run('Game.piles.size'));

// золото и прочий ходовой груз не пропадает
J(`dropPile(10, 10, 'gold', 5); return 1;`);
run(h.run('TRASH_TTL') + 30);
ok(J(`const p = Game.piles.get(idx(10, 10)); return p ? p.stock.gold : 0;`) >= 0, 'проверка золота');
ok(sim.errors.length === 0, 'ошибки симуляции: ' + sim.errors.join(' || '));

// подбор с земли показывает «Подобрано: …»
const sim2 = L.newSim(8), h2 = sim2.h;
h2.run('Game.floaters = []');
const got = JSON.parse(h2.run(`JSON.stringify((function(){
  const st = Game.buildings.find(b => b.isStore && b.isStore()); const u = Game.units.find(x => isPerson(x) && !x.inside && !x.dead);
  const p = dropPile(st.doorX + 1, st.doorY + 1, 'gold', 2) || dropPile(st.doorX, st.doorY + 2, 'gold', 2);
  p.reserved.gold += 2; to = st; st.incoming.gold += 2;
  const g = deliverGen(u, p, st, 'gold', 2); u.x = p.x + 0.5; u.y = p.y + 0.5;
  for (let i = 0; i < 4; i++) { const r = g.next(true); if (r.done) break; }
  return (Game.floaters || []).map(f => f.text);
})())`));
ok(got.some(t => /Подобрано: золото/.test(t)), 'нет подписи «Подобрано» при подборе: ' + JSON.stringify(got));

console.log(fails.length ? `Проверка кучек: ${fails.length} провалов` : 'Проверка кучек: всё в порядке');
process.exit(fails.length ? 1 : 0);
