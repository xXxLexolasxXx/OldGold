'use strict';
// Вещи на земле и в рюкзаке (gearpick.js): меч с совы ждёт героя (трудяги не уносят), «В руку героя» подбирает и надевает,
// «В рюкзак», «Положить на землю», «Отнести на склад», меню рюкзака не ломает «поесть» с панели.
// Запуск: node tests/gearpick-test.js
const S = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };
const sim = S.newSim(7);
const J = code => JSON.parse(sim.h.run(`JSON.stringify((() => { ${code} })())`));
const until = (cond, sec) => { for (let i = 0; i < sec * 4; i++) { S.stepN(sim, 5); if (J(`return !!(${cond});`)) return true; } return false; };
S.runFor(sim, 40, 10, () => {});

// площадка у склада, куда можно положить вещь
const SPOT = `const hub = Game.buildings.find(b => b.type === 'storehouse');
  const at = randomFreeNear(hub.doorX + 4, hub.doorY + 3, 1, 6, (x, y) => isWalkable(x, y) && !World.bmap[idx(x, y)] && !Game.piles.get(idx(x, y)));`;

// 1. Меч на земле ждёт героя: кольцо, трудяги не берут, подпись подсказки
const a = J(`${SPOT} Game.crows = [];
  const p = dropPile(at[0], at[1], 'sword', 1); Game.__p = p;
  const c = resolveCmd([p.x, p.y]);
  return { hold: p.heroHold - Game.time, offer: p.offer('sword'), label: c && c.label, x: p.x, y: p.y };`);
ok(a.hold > 60, 'меч на земле должен ждать героя: ' + a.hold);
ok(a.offer === 0, 'пока меч ждёт героя, трудяги не должны его видеть: offer=' + a.offer);
ok(/Меч: взять/.test(a.label || ''), 'подпись под курсором: ' + a.label);
S.runFor(sim, 30, 5, () => {});
ok(J(`return Game.__p.stock.sword;`) === 1, 'за 30 с трудяги не должны унести меч, который ждёт героя');

// 2. «В рюкзак»: герой идёт и кладёт меч в рюкзак
J(`const h = Game.hero, H = h.hero; H.inv.fill(null); H.equip.weapon = null; h.x = Game.__p.x + 3.5; h.y = Game.__p.y + 0.5;
  issueCmd(h, { kind: 'grab', p: Game.__p, g: 'sword', equip: false, tx: Game.__p.x, ty: Game.__p.y, label: 'Взять в рюкзак' }); return 1;`);
ok(until(`Game.hero.hero.inv.some(s => s && s.k === 'sword')`, 40), 'герой не положил меч в рюкзак');
ok(J(`return !Game.hero.hero.equip.weapon && (Game.__p.removed || Game.__p.stock.sword === 0);`), 'меч должен уйти с земли в рюкзак, но не в руку');

// 3. «Положить на землю»: из рюкзака на клетку героя, снова ждёт героя
const d = J(`const H = Game.hero.hero, i = H.inv.findIndex(s => s && s.k === 'sword'); gpPutDown(i);
  const p = Game.piles.get(idx(Math.floor(Game.hero.x), Math.floor(Game.hero.y))) || null; Game.__p = p;
  return { inv: H.inv.some(s => s && s.k === 'sword'), pile: p ? p.stock.sword : 0, hold: p ? p.heroHold - Game.time : 0 };`);
ok(!d.inv && d.pile === 1, 'меч должен лечь на землю рядом с героем: ' + JSON.stringify(d));
ok(d.hold > 60, 'выложенный меч тоже ждёт героя');

// 4. «В руку героя»: подобрать и надеть (удача надевания — подставляем)
J(`Game.__rnd0 = Math.random; Math.random = () => 0.01; const h = Game.hero, p = Game.__p;
  issueCmd(h, { kind: 'grab', p, g: 'sword', equip: true, tx: p.x, ty: p.y, label: 'Взять в руку' }); return 1;`);
const eq = until(`Game.hero.hero.equip.weapon === 'sword'`, 40);
J(`Math.random = Game.__rnd0; return 1;`);
ok(eq, '«В руку героя»: меч должен оказаться в руке: ' + J(`return Game.hero.hero.equip.weapon;`));

// 5. «Отнести на склад»: герой сам относит вещь из рюкзака
J(`const H = Game.hero.hero; H.inv.fill(null); hlAddItem(H, 'bow', 1); Game.__st0 = Game.buildings.filter(b => b.isStore()).reduce((n, b) => n + b.stock.bow, 0);
  gpToStore(0); return 1;`);
ok(until(`!Game.hero.hero.inv.some(s => s && s.k === 'bow')`, 60), 'герой не сдал лук на склад');
ok(J(`return Game.buildings.filter(b => b.isStore()).reduce((n, b) => n + b.stock.bow, 0) - Game.__st0;`) === 1, 'на складе должен прибавиться лук');

// 6. «Пусть отнесут на склад»: снятая бронь — трудяги снова видят вещь; «поесть» с панели работает как раньше
const f = J(`${SPOT} const p = dropPile(at[0], at[1], 'dagger', 1); const before = p.offer('dagger'); p.heroHold = 0;
  const H = Game.hero.hero; H.inv.fill(null); hlAddItem(H, 'bread', 1); Game.hero.food = 0.3; Game.hero.cmd = null; Game.hero.proc = null;
  heroAbility('use0');
  return { before, after: p.offer('dagger'), bread: H.inv.some(s => s && s.k === 'bread'), food: Game.hero.food };`);
ok(f.before === 0 && f.after === 1, 'после «на склад» трудяги должны видеть вещь: ' + JSON.stringify(f));
ok(!f.bread && f.food > 0.3, '«use» из панели должен по-прежнему есть сразу: ' + JSON.stringify(f));

// 7. Бронь не вечная, трудяги уносят меч после неё; сейв с вещами в рюкзаке
const g = J(`${SPOT} const p = dropPile(at[0], at[1], 'sword', 1); p.heroHold = Game.time - 1; Game.crows = []; Game.__p = p; return p.offer('sword');`);
ok(g === 1, 'после брони меч снова для трудяг');
const sv = J(`const H = Game.hero.hero; H.inv.fill(null); hlAddItem(H, 'sword', 1); const s = JSON.stringify(serializeGame());
  return s.length > 100;`);
ok(sv, 'сохранение с мечом в рюкзаке');
ok(!sim.errors.length, 'исключения в симуляции: ' + sim.errors.join(' | '));

// 8. Общая деревня: на сервере меч ждёт героя, «grab» кладёт в рюкзак, «putdown» — на землю, «stash» — на склад, «release» отдаёт трудягам
{
  const srv = S.newSim(43, { coop: true });
  const R = js => srv.h.run(js);
  const cmd = (who, o) => R(`coopCmd(${JSON.stringify(who)}, ${JSON.stringify(JSON.stringify(o))}, false)`);
  const wait = (cond, sec) => { for (let i = 0; i < sec * 4; i++) { S.stepN(srv, 5); R('coopDrain()'); if (R(`!!(${cond})`)) return true; } return false; };
  R(`coopJoin('Ая', JSON.stringify({ cls: 'warrior' })); const u = coop.players.get('Ая'); heroStopUnit(u); u.cmd = null;
    const st = Game.buildings.find(b => b.type === 'storehouse'); const c = randomFreeNear(st.doorX, st.doorY + 3, 0, 4, (x, y) => isWalkable(x, y) && !World.door[idx(x, y)]);
    u.x = c[0] + 0.5; u.y = c[1] + 0.5; Game.crows = [];
    const at = randomFreeNear(c[0] + 3, c[1], 1, 4, (x, y) => isWalkable(x, y) && !World.bmap[idx(x, y)] && !Game.piles.get(idx(x, y)));
    globalThis.__p = dropPile(at[0], at[1], 'sword', 1); u.hero.inv.fill(null); 0`);
  ok(R('__p.heroHold - Game.time') > 60 && R(`__p.offer('sword')`) === 0, 'кооп: меч на земле должен ждать героя');
  cmd('Ая', { t: 'grab', x: R('__p.x'), y: R('__p.y') });
  ok(wait(`coop.players.get('Ая').hero.inv.some(s => s && s.k === 'sword')`, 40), 'кооп: «grab» не положил меч в рюкзак');
  S.stepN(srv, 20);
  cmd('Ая', { t: 'putdown', slot: R(`coop.players.get('Ая').hero.inv.findIndex(s => s && s.k === 'sword')`) });
  ok(R(`!coop.players.get('Ая').hero.inv.some(s => s && s.k === 'sword') && [...Game.piles.values()].some(p => p.stock.sword > 0)`), 'кооп: «putdown» не положил меч на землю');
  R(`globalThis.__s0 = Game.buildings.filter(b => b.isStore()).reduce((n, b) => n + b.stock.bow, 0); coop.players.get('Ая').hero.inv[0] = { k: 'bow', n: 1 }; 0`);
  S.stepN(srv, 20);
  cmd('Ая', { t: 'stash', slot: 0 });
  ok(wait(`!coop.players.get('Ая').hero.inv[0]`, 60) && R(`Game.buildings.filter(b => b.isStore()).reduce((n, b) => n + b.stock.bow, 0) - __s0`) === 1, 'кооп: «stash» не сдал лук на склад');
  R(`globalThis.__q = dropPile(__p.x, __p.y, 'dagger', 1); 0`);
  S.stepN(srv, 20);
  cmd('Ая', { t: 'release', x: R('__q.x'), y: R('__q.y') });
  ok(R(`__q.offer('dagger')`) === 1, 'кооп: «release» должен отдать вещь трудягам');
  R(`coop.players.get('Ая').hero.inv[1] = { k: 'baton', n: 1 }; 0`); S.stepN(srv, 20);
  cmd('Ая', { t: 'putdown', slot: 1 });
  ok(R(`!!coop.players.get('Ая').hero.inv[1]`), 'кооп: предмет задания (эстафета) нельзя выложить на землю');
  // в руку с земли — даже не своего класса (маг с мечом), видно всем, сохраняется; снять; надеть из рюкзака; отдать другому
  R(`coopJoin('Бо', JSON.stringify({ cls: 'mage' })); const a = coop.players.get('Ая'), b = coop.players.get('Бо'); heroStopUnit(b); b.cmd = null; b.x = a.x + 1; b.y = a.y; b.hero.inv.fill(null);
    heroStopUnit(a); a.cmd = null; a.hero.inv.fill(null); a.hero.equip.weapon = null;
    globalThis.__r = Math.random; Math.random = () => 0.01; globalThis.__p = dropPile(Math.floor(b.x) + 2, Math.floor(b.y), 'sword', 1); 0`);
  S.stepN(srv, 20);
  cmd('Бо', { t: 'grab', x: R('__p.x'), y: R('__p.y'), eq: true });
  const inHand = wait(`coop.players.get('Бо').hero.equip.weapon === 'sword'`, 40);
  R('Math.random = __r; 0');
  ok(inHand, 'кооп: маг должен взять меч в руку');
  ok(R(`JSON.stringify(coopUnitRec(coop.players.get('Бо'), Game.time))`).includes('"w":"sword"'), 'кооп: меч в руке должен быть виден другим (пакет героя)');
  ok(JSON.parse(R(`coopHeroData('Бо')`)).eq.weapon === 'sword', 'кооп: надетое должно сохраняться');
  S.stepN(srv, 20);
  cmd('Бо', { t: 'unequip', s: 'weapon' });
  ok(R(`!coop.players.get('Бо').hero.equip.weapon && coop.players.get('Бо').hero.inv.some(s => s && s.k === 'sword')`), 'кооп: «снять» должно вернуть меч в рюкзак');
  S.stepN(srv, 20);
  const slot = R(`coop.players.get('Бо').hero.inv.findIndex(s => s && s.k === 'sword')`);
  cmd('Бо', { t: 'give', to: 'Ая', slot });
  ok(R(`coop.players.get('Ая').hero.inv.some(s => s && s.k === 'sword') && !coop.players.get('Бо').hero.inv.some(s => s && s.k === 'sword')`), 'кооп: меч должен перейти к герою другого игрока');
  R(`globalThis.__r = Math.random; Math.random = () => 0.01; 0`); S.stepN(srv, 20);
  cmd('Ая', { t: 'equip', slot: R(`coop.players.get('Ая').hero.inv.findIndex(s => s && s.k === 'sword')`) });
  const eq2 = wait(`coop.players.get('Ая').hero.equip.weapon === 'sword'`, 20);
  R('Math.random = __r; 0');
  ok(eq2, 'кооп: «надеть» из рюкзака');
  // вход с подделанным надетым: хлеб в руку и меч в доспех не принимаются
  R(`coopLeave('Бо'); coopJoin('Бо', JSON.stringify({ cls: 'mage', eq: { weapon: 'bread', armor: 'sword' } })); 0`);
  ok(R(`JSON.stringify(coop.players.get('Бо').hero.equip)`) === '{"weapon":null,"armor":null}', 'кооп: подделанное надетое при входе не принимается: ' + R(`JSON.stringify(coop.players.get('Бо').hero.equip)`));
  ok(!srv.errors.length, 'кооп: исключения на сервере: ' + srv.errors.join(' | '));
}

console.log(fails.length ? `Проверка вещей: ${fails.length} провал(ов)` : 'Проверка вещей: всё в порядке');
process.exit(fails.length ? 1 : 0);
