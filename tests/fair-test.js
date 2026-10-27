'use strict';
// Ярмарка: оружейная лавка (js/world/fair.js) — дорогое оружие и доспехи за золото казны прямо в рюкзак героя.
//  · покупка списывает золото со складов и кладёт вещь в рюкзак; второй раз ту же вещь не купить (одна штука);
//  · мало золота — отказ без списания; полный рюкзак — отказ без списания;
//  · лавка есть у каждой новой ярмарки и переживает сохранение; старая ярмарка без лавки не ломает панель;
//  · в панели обмена названия товаров словами (не только значки).
// Запуск: node tests/fair-test.js
const L = require('./lib/sim');
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };

const sim = L.newSim(4242);
const R = s => sim.h.run(s);
R(`Game.time = Math.max(Game.time, 200); const st = Game.buildings.find(b => b.isStore()); st.stock.gold = 40;
   for (let i = 0; i < 8; i++) Game.units.push(Object.assign({}, Game.units[0], { id: 900000 + i }));`);
// ярмарку открывают днём — время суток в тесте не важно, без прокрутки до утра (быстро)
const bad = R(`(() => { const n = isNightNow, e = isEveningNow; isNightNow = () => false; isEveningNow = () => false;
  try { Game.fair = null; return fairStart(); } finally { isNightNow = n; isEveningNow = e; } })()`);
check(bad === '', 'ярмарка не открылась: ' + bad);
check(R('Game.fair && Array.isArray(Game.fair.arms) && Game.fair.arms.length === FAIR_ARMS.length'), 'у новой ярмарки есть оружейная лавка');

const gold = () => R('frHave("gold")');
const inv = g => R(`Game.hero.hero.inv.filter(s => s && s.k === '${g}').reduce((a, s) => a + s.n, 0)`);
const iSword = R('Game.fair.arms.findIndex(a => a.g === "sword")'), price = R(`Game.fair.arms[${iSword}].gold`);
const g0 = gold();
check(R(`fairBuyArm(${iSword}, Game.hero, 'Тест')`) === '', 'меч не купился');
check(gold() === g0 - price, `золото не списалось: было ${g0}, стало ${gold()}, цена ${price}`);
check(inv('sword') === 1, 'меч не попал в рюкзак героя');
check(R(`fairBuyArm(${iSword}, Game.hero, 'Тест')`) !== '' && inv('sword') === 1, 'одну и ту же вещь купили дважды');

// мало золота
R('for (const b of Game.buildings) if (b.isStore()) b.stock.gold = 1');
const iArm = R('Game.fair.arms.findIndex(a => a.g === "ironArmor")'), g1 = gold();
check(R(`fairBuyArm(${iArm}, Game.hero, 'Тест')`) !== '' && gold() === g1 && inv('ironArmor') === 0, 'при нехватке золота покупка прошла');

// полный рюкзак
R('Game.buildings.find(b => b.isStore()).stock.gold = 40; Game.hero.hero.inv = Game.hero.hero.inv.map((s, i) => ({ k: "stone", n: 20 }))');
const g2 = gold(), iBow = R('Game.fair.arms.findIndex(a => a.g === "bow")');
check(R(`fairBuyArm(${iBow}, Game.hero, 'Тест')`) === 'Рюкзак героя полон' && gold() === g2, 'при полном рюкзаке золото списалось или вещь пропала');

// сохранение
const saved = R('JSON.stringify(serializeGame())');
R(`applySave(JSON.parse(${JSON.stringify(saved)}))`);
check(R('Game.fair && Game.fair.arms && Game.fair.arms.find(a => a.g === "sword").left === 0'), 'после загрузки лавка помнит проданный меч');
// старая ярмарка (сохранена до лавки) — панель строится
R('delete Game.fair.arms');
check(typeof R('fairPanelHTML()') === 'string', 'панель старой ярмарки без лавки не строится');
R('Game.fair.arms = FAIR_ARMS.map(a => ({ g: a.g, gold: a.gold, left: 1 }))');
const html = R('fairPanelHTML()');
check(/Обмен у купцов/.test(html) && /Оружейная лавка/.test(html), 'в панели нет разделов «Обмен у купцов» и «Оружейная лавка»');
check(R('Game.fair.offers.every(o => fairPanelHTML().includes(GOODS[Object.keys(o.give)[0]].name))'), 'в обмене товары подписаны не словами');
check(!sim.errors.length, 'ошибки симуляции: ' + sim.errors.slice(0, 3).join('; '));

if (fails.length) { console.log('ПРОВАЛ:\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('Проверка ярмарки: оружейная лавка, золото, рюкзак, сохранение — в порядке');
process.exit(0);   // в песочнице тикает таймер панели ярмарки — без выхода процесс не завершится
