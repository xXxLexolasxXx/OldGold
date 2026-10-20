'use strict';
// Запас прочности снаряжения и очередь заказов мастерской доспехов (durability.js, config.js DUR).
// Запуск: node tests/durability-test.js
const S = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };
const sim = S.newSim(7);
const J = code => JSON.parse(sim.h.run(`JSON.stringify((() => { ${code} })())`));
S.runFor(sim, 60, 10, () => {});

// 1. Износ: новая вещь целая, удары и пропущенные удары снимают очки, на пороге — предупреждение, на нуле — штраф
const a = J(`const h = Game.hero, H = h.hero; H.equip.weapon = 'sword'; H.equip.armor = 'ironArmor'; delete H.dur;
  const full = [durRatio(h, 'weapon'), durRatio(h, 'armor')], atk0 = unitAtk(h), def0 = heroDef(h);
  for (let i = 0; i < 80; i++) durWear(h, 'weapon', 1);
  const mid = durRatio(h, 'weapon');
  for (let i = 0; i < 200; i++) durWear(h, 'weapon', 1);
  const atkB = unitAtk(h), broken = durRatio(h, 'weapon');
  H.hp = H.maxhp; hlHurt(h, 6, 'hit'); const armHit = durRatio(h, 'armor');
  hlHurt(h, 6, 'fail'); const armFail = durRatio(h, 'armor');
  for (let i = 0; i < 80; i++) durWear(h, 'armor', 3);
  return { full, atk0, def0, mid, atkB, broken, armHit, armFail, defB: heroDef(h), armR: durRatio(h, 'armor') };`);
ok(a.full[0] === 1 && a.full[1] === 1, 'новые вещи не целые: ' + a.full);
ok(a.mid > 0.45 && a.mid < 0.55, `после 80 ударов меч ${a.mid}, ждём ≈0,5`);
ok(a.broken === 0 && Math.abs(a.atkB / a.atk0 - 0.5) < 0.02, `сломанный меч: ${a.broken}, точность ×${(a.atkB / a.atk0).toFixed(2)}, ждём ×0,5`);
ok(a.armHit < 1 && a.armFail === a.armHit, `доспех: от удара ${a.armHit}, от «fail» должен не меняться (${a.armFail})`);
ok(a.armR === 0 && a.defB === a.def0 - 0.5, `сломанный железный доспех: защита ${a.defB} вместо ${a.def0}`);

// 2. Ремонт: за материалы со склада нужного здания, частичный дешевле полного
const r = J(`const h = Game.hero, H = h.hero; H.equip.weapon = 'sword'; H.dur = { sword: 80, ironArmor: 0 }; H.equip.armor = 'ironArmor';
  const ws = placeAny('weaponsmith'), ar = placeAny('armory');
  ws.stock.iron = 0; ws.stock.timber = 0;
  const e1 = durRepair(h, 'weapon', ws);
  ws.stock.iron = 2; ws.stock.timber = 1;
  const half = durCost('sword', 0.5), full = durCost('sword', 1);
  const e2 = durRepair(h, 'weapon', ws), left = [ws.stock.iron, ws.stock.timber];
  const e3 = durRepair(h, 'armor', ws);
  ar.stock.iron = 2; ar.stock.leather = 2; const e4 = durRepair(h, 'armor', ar);
  ar.stock.iron = 9; ar.stock.leather = 9; const e5 = durRepair(h, 'armor', ar);
  return { e1, half, full, e2, left, e3, e4, e5, w: durRatio(h, 'weapon'), a: durRatio(h, 'armor'), ar: [ar.stock.iron, ar.stock.leather] };
  function placeAny(type) {
    const hub = Game.buildings.find(b => b.type === 'storehouse');
    for (let rr = 3; rr < 24; rr++) for (let k = 0; k < 24; k++) {
      const x = Math.round(hub.doorX + Math.cos(k * 0.5) * rr * 1.6), y = Math.round(hub.doorY + Math.sin(k * 0.5) * rr);
      if (inb(x, y) && !checkPlacement(type, x, y, 0)) { const b = placeBuilding(type, x, y, true, 0); b.state = 'done'; return b; }
    }
    throw new Error('нет места для ' + type);
  }`);
ok(r.e1 && /не хватает/.test(r.e1), 'без материалов ремонт должен отказать: ' + r.e1);
ok(r.half.iron === 1 && r.full.iron === 2 && r.full.timber === 1, `цена ремонта меча: полная ${JSON.stringify(r.full)}, половинная ${JSON.stringify(r.half)}`);
ok(r.e2 === null && r.w === 1, `ремонт меча: ${r.e2}, прочность ${r.w}`);
ok(r.e3 && /мастерская доспехов/.test(r.e3), 'доспех в оружейной чинить нельзя: ' + r.e3);
ok(r.e4 && /не хватает/.test(r.e4), 'железного доспеха на 2 слитка мало: ' + r.e4);
ok(r.e5 === null && r.a === 1 && r.ar[0] < 9, `ремонт доспеха: ${r.e5}, прочность ${r.a}, склад ${r.ar}`);

// 3. Доспехи делаются долго: кожаный — дольше любого оружия, железный — только на 2-м уровне
const t = J(`const w = BUILDINGS.weaponsmith.recipes, a = BUILDINGS.armory.recipes, l2 = levelDef('armory').recipes;
  return { wmax: Math.max(...w.map(x => x.time)), a1: a.map(x => Object.keys(x.out)[0] + x.time), l2: l2.map(x => Object.keys(x.out)[0] + x.time), l2iron: l2.find(x => x.out.ironArmor) };`);
ok(t.a1.length === 1 && t.a1[0].startsWith('leatherArmor') && !t.a1.join().includes('ironArmor'), 'на 1-м уровне железных доспехов быть не должно: ' + t.a1);
ok(t.l2iron && t.l2iron.time >= 3 * t.wmax && t.l2iron.in.iron >= 5, `железный доспех L2: ${JSON.stringify(t.l2iron)}, оружие до ${t.wmax}с`);

// 4. Очередь заказов: заказанное делается первым, очередь убывает, лишнее не принимается
const q = J(`const b = Game.buildings.find(x => x.type === 'armory'); b.def = levelDef('armory'); b.level = 2; b.recipeOn = b.def.recipes.map(() => true); b.recipeIdx = 0;
  b.stock.leather = 6; b.stock.iron = 6; b.stock.leatherArmor = 0; b.stock.ironArmor = 0; b.orders = [];
  durAct('ord:' + b.id + ':1:1'); durAct('ord:' + b.id + ':1:1'); durAct('ord:' + b.id + ':0:1');
  const first = pickRecipe(b), second = pickRecipe(b), third = pickRecipe(b);
  for (let i = 0; i < 20; i++) durAct('ord:' + b.id + ':0:1');
  return { f: Object.keys(first.out)[0], s: Object.keys(second.out)[0], th: third && Object.keys(third.out)[0], left: b.orders.map(o => o.i + 'x' + o.n), tot: b.orders.reduce((s, o) => s + o.n, 0) };`);
ok(q.f === 'ironArmor' && q.s === 'ironArmor', `заказы идут не по очереди: ${q.f}, ${q.s}`);
ok(q.tot <= 8, `в очереди ${q.tot} заказов, максимум 8`);

// 5. Сохранение: прочность и очередь переживают сейв; старый сейв (без dur/orders) — полная прочность
const sv = J(`const h = Game.hero, H = h.hero; H.equip.weapon = 'sword'; H.dur = { sword: 40 };
  const b = Game.buildings.find(x => x.type === 'armory'); b.orders = [{ i: 1, n: 2 }];
  return serializeGame();`);
const dst = S.newSim(9);
dst.h.ctx.__t = JSON.stringify(sv);
ok(!dst.h.run('loadSaveText(__t)'), 'загрузка сейва не удалась');
const back = JSON.parse(dst.h.run(`JSON.stringify({ dur: Game.hero.hero.dur, ord: (Game.buildings.find(x => x.type === 'armory') || {}).orders })`));
ok(back.dur && back.dur.sword === 40, 'прочность героя не сохранилась: ' + JSON.stringify(back.dur));
ok(back.ord && back.ord[0] && back.ord[0].n === 2, 'очередь заказов не сохранилась: ' + JSON.stringify(back.ord));
const old = JSON.parse(JSON.stringify(sv)); for (const u of old.units) if (u.h) delete u.h.dur; for (const b of old.buildings) delete b.orders;
const d2 = S.newSim(10);
d2.h.ctx.__t = JSON.stringify(old);
ok(!d2.h.run('loadSaveText(__t)'), 'старый сейв не загрузился');
ok(d2.h.run(`(() => { const h = Game.hero; h.hero.equip.weapon = 'sword'; return durRatio(h, 'weapon'); })()`) === 1, 'в старом сейве прочность не полная');

// 6. Рекрут: износ по слотам, сломанный доспех не защищает, UI не падает
const rc = J(`const u = Game.units.find(x => x.type === 'serf' && !x.dead);
  u.type = 'warrior'; u.rec = { cls: 'warrior', lvl: 1, xp: 0, guild: 0, order: 'guard', train: 0, armor: true, name: 'Тест' };
  const a0 = unitAtk(u); for (let i = 0; i < 400; i++) durWear(u, 'weapon', 1);
  const ratio = [durRatio(u, 'weapon'), durRatio(u, 'armor')], a1 = unitAtk(u);
  const html = durRecHTML(u) + durTag(u); u.type = 'serf'; u.rec = null; u._spr = null;
  return { ratio, k: a1 / a0, html: html.length };`);
ok(rc.ratio[0] === 0 && rc.ratio[1] === 1 && Math.abs(rc.k - 0.5) < 0.02 && rc.html > 50, 'рекрут: ' + JSON.stringify(rc));

S.runFor(sim, 30, 10, () => {});
for (const e of sim.errors) fails.push('исключение в игре: ' + e);
console.log(fails.length ? 'Проверка прочности: ПРОВАЛ' : 'Проверка прочности: износ, ремонт, очередь, сейв — ок');
process.exit(fails.length ? 1 : 0);
