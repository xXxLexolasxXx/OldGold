'use strict';
// Снос и перестройка гильдии (баг тестера: «Разбойник: свободно 11» при лимите 6). Прежние рекруты и глава переходят
// в отстроенную гильдию своего класса, сверх лимита — снова трудяги; наём не обходит лимит; сейв.
// Запуск: node tests/guildrebuild-test.js
const S = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };
const J = (sim, code) => JSON.parse(sim.h.run(`JSON.stringify((() => { ${code} })())`));
const PLACE = `function placeAny(type, done) {
    const hub = Game.buildings.find(b => b.type === 'storehouse');
    for (let rr = 4; rr < 30; rr++) for (let k = 0; k < 24; k++) {
      const x = Math.round(hub.doorX + Math.cos(k * 0.5) * rr * 1.6), y = Math.round(hub.doorY + Math.sin(k * 0.5) * rr);
      if (inb(x, y) && !checkPlacement(type, x, y, 0)) { return placeBuilding(type, x, y, !!done, 0); }
    }
    throw new Error('нет места для ' + type);
  }`;
const tick = sim => sim.h.run('G.t = 1; guildsTick(0.01);');

for (const cls of ['rogue', 'warrior', 'archer', 'mage']) {
  const sim = S.newSim(7);
  S.runFor(sim, 60, 10, () => {});
  sim.h.run(PLACE);
  // гильдия с главой и полным набором рекрутов
  const r0 = J(sim, `const b = placeAny('guild_${cls}', true); finishBuilding && b.state !== 'done' && finishBuilding(b);
    spawnMaster(b);
    const C = GCLS['${cls}'], max = recMaxOf(b); let n = 0;
    for (let k = 0; k < 40 && n < max + 3; k++) {
      const u = spawnUnit('serf', b.doorX, b.doorY); b.stock[C.weapon] = 5; b.stock.gold = 5; b.stock.mana = 5;
      b.hireQ = 1; if (tryHire(b)) n++;
    }
    return { id: b.id, max, rec: recruitsOf(b).length };`);
  ok(r0.rec === r0.max, `${cls}: набрали ${r0.rec} рекрутов, лимит ${r0.max}`);
  // наём сверх лимита запрещён
  ok(J(sim, `const b = Game.buildings.find(x => x.id === ${r0.id}); return !!hireCheck(b);`), `${cls}: hireCheck пропускает наём сверх лимита`);
  // снос и перестройка 3 раза: каждый раз — полный наём сверху (как делал игрок)
  for (let k = 0; k < 3; k++) {
    J(sim, `const old = Game.buildings.find(x => x.type === 'guild_${cls}'); removeBuilding(old);
      const b = placeAny('guild_${cls}', true); return b.id;`);
    tick(sim);
    J(sim, `const b = Game.buildings.find(x => x.type === 'guild_${cls}'), C = GCLS['${cls}'];
      for (let i = 0; i < 10; i++) { spawnUnit('serf', b.doorX, b.doorY); b.stock[C.weapon] = 5; b.stock.gold = 5; b.stock.mana = 5; if (!hireCheck(b)) { b.hireQ = 1; tryHire(b); } }
      return 1;`);
    tick(sim);
  }
  const r = J(sim, `const b = Game.buildings.find(x => x.type === 'guild_${cls}'), cl = guildClasses('${cls}');
    const recs = Game.units.filter(u => !u.dead && u.rec && cl.includes(u.rec.cls));
    const gms = Game.units.filter(u => !u.dead && u.type === GCLS['${cls}'].gm);
    return { rec: recruitsOf(b).length, all: recs.length, orphans: recs.filter(u => !guildOf(u)).length, gms: gms.length, gmOk: !!masterOf(b), max: recMaxOf(b) };`);
  console.log(`${cls}: ${JSON.stringify(r)}`);
  ok(r.rec <= r.max && r.all <= r.max, `${cls}: после 3 перестроек рекрутов ${r.all} (в гильдии ${r.rec}) при лимите ${r.max}`);
  ok(r.orphans === 0, `${cls}: осиротевших рекрутов ${r.orphans}`);
  ok(r.gms === 1 && r.gmOk, `${cls}: глав ${r.gms}, у новой гильдии глава ${r.gmOk}`);
  // сейв: после загрузки лимит держится
  const sv = J(sim, `applySave(JSON.parse(JSON.stringify(serializeGame()))); G.t = 1; guildsTick(0.01);
    const b = Game.buildings.find(x => x.type === 'guild_${cls}'); return { rec: recruitsOf(b).length, max: recMaxOf(b) };`);
  ok(sv.rec <= sv.max, `${cls}: после сейва рекрутов ${sv.rec} при лимите ${sv.max}`);
  ok(!sim.errors.length, `${cls}: исключения: ${sim.errors.slice(0, 2).join(' | ')}`);
}

// гильдии своего класса нет вовсе — рекруты сторожат место и не пропадают
{
  const sim = S.newSim(11);
  S.runFor(sim, 30, 10, () => {});
  sim.h.run(PLACE);
  const r = J(sim, `const b = placeAny('guild_rogue', true); spawnMaster(b); spawnUnit('serf', b.doorX, b.doorY);
    b.stock.dagger = 2; b.stock.gold = 2; b.hireQ = 1; tryHire(b); removeBuilding(b); G.t = 1; guildsTick(0.01);
    const u = Game.units.find(x => x.rec && x.rec.cls === 'rogue'); return u ? u.rec.order : 'нет';`);
  ok(r === 'hold', `без гильдии рекрут должен сторожить место (hold), а не ${r}`);
}

console.log(fails.length ? `✗ провалов: ${fails.length}` : 'Проверка перестройки гильдий: всё в порядке');
process.exit(fails.length ? 1 : 0);
