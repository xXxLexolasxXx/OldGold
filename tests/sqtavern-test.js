'use strict';
// Таверна отряда появляется сама (КООП_ЗАБЕГ.md, В8): условие (12+ жителей и герой 3-го уровня; в сюжете — глава 3),
// место — в 4–5 клетках наружу от крайнего бокового здания, не двигается при росте деревни, переживает сейв, в коопе её ставит сервер.
// Запуск: node tests/sqtavern-test.js
const S = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

function prep(sim) {
  return sim.h.run(`(function () {
    const st = Game.buildings.find(b => b.isStore()) || Game.buildings[0];
    const cnt = () => Game.units.filter(u => isPerson(u) && !u.dead).length;
    for (let k = 0; k < 30 && cnt() < 12; k++) spawnUnit('serf', st.doorX, st.doorY + 1);
    return cnt();
  })()`);
}
const tav = sim => JSON.parse(sim.h.run(`JSON.stringify(Game.buildings.filter(b => b.type === 'squadtavern' && !b.removed).map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h, done: b.state === 'done' })))`));

// 1. одиночка: нет условия — нет таверны
const sim = S.newSim(12);
sim.h.run(`if (!Game.hero) spawnHero && 0; for (const u of Game.units) if (u.type === 'hero' && u.hero) u.hero.level = 1`);
S.stepN(sim, 200);
ok(tav(sim).length === 0, 'таверна появилась без условия');
ok(sim.h.run(`BUILD_ORDER.includes('squadtavern')`) === false, 'таверны не должно быть в меню стройки');
// 2. условие выполнено — появляется сама, готовая, в 4–5 клетках наружу от крайнего бокового здания
prep(sim);
const hasHero = sim.h.run(`Game.units.some(u => u.type === 'hero')`);
if (!hasHero) sim.h.run(`spawnHero()`);
sim.h.run(`for (const u of Game.units) if (u.type === 'hero' && u.hero) u.hero.level = 3`);
const before = JSON.parse(sim.h.run(`JSON.stringify((function () { const bs = Game.buildings.filter(b => !b.removed); const hub = bs.find(b => b.isStore()) || bs[0], cx = hub.x + hub.w / 2; let e = bs[0], d0 = -1; for (const b of bs) { const d = Math.max(Math.abs(b.x - cx), Math.abs(b.x + b.w - cx)); if (d > d0) { d0 = d; e = b; } } return { cx, ex: e.x, ew: e.w, ey: e.y }; })())`));
S.stepN(sim, 200);
let t = tav(sim);
ok(t.length === 1 && t[0].done, 'таверна не появилась при 12 жителях и герое 3-го уровня: ' + JSON.stringify(t));
if (t.length) {
  const T = t[0], right = before.ex + before.ew / 2 >= before.cx;
  const gap = right ? T.x - (before.ex + before.ew) : before.ex - (T.x + T.w);
  console.log(`  · крайнее здание x=${before.ex}..${before.ex + before.ew}, ${right ? 'справа' : 'слева'}; таверна x=${T.x}, зазор ${gap}`);
  ok(gap >= 3 && gap <= 13, `таверна не на окраине за крайним зданием: зазор ${gap}`);
  // 3. деревня растёт дальше наружу — таверна остаётся, вторая не появляется
  sim.h.run(`(function () { for (let dx = 3; dx < 30; dx++) for (let dy = -6; dy < 6; dy++) { const x = ${right} ? ${T.x + T.w} + dx : ${T.x} - dx - 3, y = ${T.y} + dy; if (checkPlacement('woodcutter', x, y, 0) === null) { placeBuilding('woodcutter', x, y, true); return; } } })()`);
  S.stepN(sim, 200);
  const t2 = tav(sim);
  ok(t2.length === 1 && t2[0].x === T.x && t2[0].y === T.y, 'таверна сдвинулась или задвоилась после роста деревни');
  // 4. сейв/загрузка
  const save = sim.h.run(`JSON.stringify(serializeGame())`);
  ok(/squadtavern/.test(save), 'таверна не попала в сейв');
}
// 5. кооп: ставит сервер и всем говорит
const srv = S.newSim(43, { coop: true });
srv.h.run(`coopJoin('Ая', JSON.stringify({ cls: 'warrior' }))`);
prep(srv);
srv.h.run(`for (const u of Game.units) if (u.type === 'hero' && u.hero) u.hero.level = 3`);
S.stepN(srv, 200);
ok(tav(srv).length === 1, 'в коопе сервер не поставил таверну');
const ev = JSON.parse(srv.h.run('coopDrain()'));
ok(ev.some(e => e.msg && e.msg.t === 'toast' && /Таверна отряда/.test(e.msg.text)), 'в коопе нет оповещения о таверне');

if (fails.length) { console.log('ПРОВАЛ: ' + fails.length); process.exit(1); }
console.log('Проверка таверны отряда: всё в порядке');
process.exit(0);
