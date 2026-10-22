'use strict';
// Достройка гильдии не трогает билд героя: клик по чужой гильдии не переучивает, класс и ранг мастерства на месте,
// переучивание — только явной командой (reclass), ранг прежнего класса запоминается; сохранение и старые сейвы.
// Запуск: node tests/guildbuild-test.js
const S = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };
const sim = S.newSim(5);
S.runFor(sim, 60, 10, () => {});
const R = code => JSON.parse(sim.h.run(`JSON.stringify((() => { ${code} })())`));

R(`const H = Game.hero.hero; H.clsKey = 'mage'; H.cls = 'Маг'; H.mastery = 4; H.level = 10; H.kitGot = ['mage']; H.msKept = undefined; return 1`);
// чужая гильдия строится и достраивается (в тесте — сразу готовая, с главой)
const mk = type => { S.botPlace(sim, type); return R(`const b = Game.buildings.filter(b => b.type === '${type}').pop(); b.state = 'done'; b.hits = b.maxHits || b.hits; return b.id`); };
const idA = mk('guild_archer');
S.runFor(sim, 120, 10, () => {});
const st = () => R(`const H = Game.hero.hero; return { cls: H.clsKey, ms: H.mastery, kept: H.msKept || null, gold: Game.buildings.reduce((a, b) => a + (b.stock.gold || 0), 0) }`);
const learn = (id, extra) => {
  R(`const b = Game.buildings.find(x => x.id === ${id}); b.stock.gold = (b.stock.gold || 0) + 20; issueCmd(Game.hero, Object.assign({ kind: 'guild', b, tx: b.doorX, ty: b.doorY, label: 'Учиться' }, ${JSON.stringify(extra || {})})); return 1`);
  S.runFor(sim, 90, 10, () => {});
};
const before = st();
ok(before.cls === 'mage' && before.ms === 4, 'исходный маг не задан: ' + JSON.stringify(before));

// 1. герой кликает по достроенной гильдии лучников (как «клик при выбранном герое»): билд цел
learn(idA);
let s = st();
ok(s.cls === 'mage' && s.ms === 4, `клик по чужой гильдии переписал билд: ${JSON.stringify(s)}`);
ok(s.gold === before.gold + 20, `золото ушло без урока: было ${before.gold + 20}, стало ${s.gold}`);
// и резолв клика по клетке тоже идёт через ту же команду
const rc = R(`const b = Game.buildings.find(x => x.id === ${idA}); const c = resolveCmd([b.x, b.y]); return c && c.kind`);
ok(rc === 'guild', 'клик по гильдии должен вести к команде «Учиться», а не к смене класса сразу: ' + rc);

// 2. явное переучивание (кнопка в окне гильдии): класс меняется, ранг мага запоминается
learn(idA, { cls: 'archer', reclass: true });
s = st();
ok(s.cls === 'archer' && s.ms === 0, `явное переучивание не сработало: ${JSON.stringify(s)}`);
ok(s.kept && s.kept.mage === 4, `ранг мага не запомнился: ${JSON.stringify(s.kept)}`);

// 3. возврат к магу: ранг 4 на месте
const idM = mk('guild_mage');
S.runFor(sim, 120, 10, () => {});
learn(idM, { cls: 'mage', reclass: true });
s = st();
ok(s.cls === 'mage' && s.ms === 4, `ранг мага не вернулся: ${JSON.stringify(s)}`);

// 4. гильдия своего класса продолжает учить как раньше (ранг растёт на уроке)
R(`Game.hero.hero.level = 14; return 1`);
learn(idM);
s = st();
ok(s.cls === 'mage' && s.ms === 5, `урок мастерства у своей гильдии сломан: ${JSON.stringify(s)}`);

// 5. сохранение: класс, ранг и запомненные ранги переживают save→load; старый сейв без msKept грузится
const snap = sim.h.run('JSON.stringify(serializeGame())');
sim.h.ctx.__t = snap; ok(!sim.h.run('loadSaveText(__t)'), 'загрузка сейва не удалась');
s = st();
ok(s.cls === 'mage' && s.ms === 5 && s.kept && s.kept.mage === 4, `сохранение потеряло билд: ${JSON.stringify(s)}`);
const old = JSON.parse(snap);
for (const u of old.units || []) if (u.h) { delete u.h.msKept; }
sim.h.ctx.__t = JSON.stringify(old); ok(!sim.h.run('loadSaveText(__t)'), 'загрузка старого сейва не удалась');
s = st();
ok(s.cls === 'mage' && s.ms === 5, `старый сейв (без msKept) испортил билд: ${JSON.stringify(s)}`);

ok(!sim.errors.length, 'исключения: ' + sim.errors.slice(0, 2).join(' | '));
console.log(fails.length ? `✗ провал: ${fails.length}` : 'Проверка гильдии: билд героя сохраняется');
process.exit(fails.length ? 1 : 0);
