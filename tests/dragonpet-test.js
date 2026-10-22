'use strict';
// Дракончики-питомцы (js/world/dragonpet.js): шанс поимки, осторожность, разговор и поимка, умения, уход, сейв, миграция.
// Запуск: node tests/dragonpet-test.js   (печатает ✗, код выхода 1 при провале)
const L = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };
const sim = L.newSim(7), h = sim.h, J = c => JSON.parse(h.run('JSON.stringify((function(){' + c + '})())'));
const step = sec => L.stepN(sim, Math.round(sec / 0.05));

// 1. Шанс поимки по входным данным
const ch = o => h.run(`dpChance(${JSON.stringify(Object.assign({ sp: 'fire', trait: 'brave', bait: 'sausage', trust: 0, tries: 0, sneak: true, foes: false, hp: 1, cls: 'warrior', level: 3, fear: 0 }, o))})`);
ok(ch({ bait: null }) === 0, 'без угощения шанс должен быть 0');
ok(ch({ foes: true }) === 0, 'при врагах шанс должен быть 0');
ok(ch({}) > ch({ bait: 'goldore' }) && ch({ bait: 'goldore' }) > ch({ bait: 'bread' }), 'любимое угощение должно быть лучше обычного, обычное — лучше чужого');
ok(ch({ cls: 'druid' }) > ch({ cls: 'archer' }) && ch({ cls: 'archer' }) > ch({ cls: 'warrior' }), 'друид лучше следопыта, следопыт лучше воина');
ok(ch({ sneak: false }) < ch({}) - 0.15, 'бегом шанс заметно ниже');
ok(ch({ tries: 2 }) < ch({}), 'с каждой попыткой шанс ниже');
ok(ch({ trust: 3 }) > ch({}), 'разговор повышает доверие');
ok(ch({ hp: 0.2 }) < ch({ hp: 1 }), 'раненому герою шанс ниже');
ok(ch({ trait: 'shy' }) < ch({}), 'пугливого поймать труднее');
const top = ch({ cls: 'druid', trust: 3, level: 15 }), low = ch({ bait: 'bread', sneak: false, tries: 2, fear: 1, hp: 0.1 });
ok(top <= 0.8 && low >= 0.03, `шанс в рамках 3–80%: ${low}..${top}`);
ok(ch({}) < 0.6, 'обычная попытка не должна быть почти верной: ' + ch({}));
ok(h.run('dpHint(0)') === '🚫' && h.run('dpHint(0.1)') === '😰' && h.run('dpHint(0.7)') === '😍', 'подсказка-смайлик по шансу');

// 2. Дикий дракончик: сел у добычи, бегущий герой его спугнул
J(`Game.time = Math.max(Game.time, 400); const F = fyState(); fyNests(F); return 1;`);
const prep = () => J(`
  const F = Game.fairy, d = F.dr, hu = Game.hero;
  hu.inside = null; hu.dead = false; hu.x = d.nx + 3.5; hu.y = d.ny + 0.5; hu.dashUntil = 0; hu.dpSpd = 0; hu.dpStill = 0; hu.dpX = hu.x; hu.dpY = hu.y;
  hu.proc = null; hu.action = null; hu.path = null;
  d.st = 'land'; d.z = 0; d.t = 2; d.lt = 1e9; d.loot = 0; d.x = d.nx + 0.5; d.y = d.ny + 0.5; d.talk = null; d.noTalk = false; d.away = 0; d.stage = 0; d.fear = 0;
  for (const s of Game.buildings) if (s.isStore()) { s.stock.sausage = 5; s.stock.fish = 5; s.stock.bread = 5; }
  return { sp: d.sp };
`);
ok(h.run('!!(Game.fairy && Game.fairy.dr)'), 'нет гнезда дракончика');
prep();
h.run('Game.hero.dashUntil = Game.time + 5');
h.run('dragonTick(0.05, Game.fairy)');
ok(h.run('Game.fairy.dr.st') === 'back', 'бегущий герой должен спугнуть дракончика, а не приручить');
ok(h.run('Game.fairy.dp ? Game.fairy.dp.pets.length : 0') === 0, 'дракончик не должен «присосаться» сам');

// 3. Спокойный герой стоит рядом — дракончик заговорит; без попытки угощения он не приручается
prep();
h.run('dpWildInit(Game.fairy.dr)');
ok(h.run('Game.fairy.dr.name') === 'Зазулий Третий', 'первого дракончика зовут Зазулий Третий: ' + h.run('Game.fairy.dr.name'));
for (let i = 0; i < 40; i++) h.run('Game.hero.dpSpd = 0; dragonTick(0.05, Game.fairy)');
ok(h.run('!!Game.fairy.dr.talk'), 'спокойно стоящий герой должен начать разговор');
ok(h.run('Game.fairy.dr.talk && Game.fairy.dr.talk.line') === 'first', 'первая реплика — знакомство');
for (let i = 0; i < 200; i++) h.run('Game.hero.dpSpd = 0; dragonTick(0.05, Game.fairy)');
ok(h.run('Game.fairy.dp.pets.length') === 0, 'просто стоя рядом приручить нельзя');
// разговор, затем угощение с гарантированной неудачей: тратится приманка, попытки кончаются — улетает
h.run('dpWildAct(Game.hero, "talk")');
ok(h.run('Game.fairy.dr.talk.trust') === 1, 'разговор поднимает доверие');
const food0 = h.run('dilHave("sausage") + dilHave("fish") + dilHave("bread")');
h.run('var __r = Math.random; Math.random = () => 0.99');
for (let i = 0; i < 3; i++) h.run('if (Game.fairy.dr.talk) dpWildAct(Game.hero, "bait")');
h.run('Math.random = __r');
ok(h.run('dilHave("sausage") + dilHave("fish") + dilHave("bread")') < food0, 'угощение должно браться со склада');
ok(!h.run('Game.fairy.dr.talk') && h.run('Game.fairy.dr.st') === 'back', 'после трёх неудач дракончик улетает');
ok(h.run('Game.fairy.dp.pets.length') === 0, 'неудачи не дают питомца');

// 4. Удачная попытка → питомец; второй не помещается (одно место)
prep();
for (let i = 0; i < 40; i++) h.run('Game.hero.dpSpd = 0; dragonTick(0.05, Game.fairy)');
h.run('var __r = Math.random; Math.random = () => 0.001');
const res = J('return dpWildAct(Game.hero, "bait", "sausage")');
h.run('Math.random = __r');
ok(res && res.caught, 'угощение при удаче должно приручить');
ok(h.run('Game.fairy.dp.pets.length') === 1 && h.run('Game.fairy.dp.pets[0].name') === 'Зазулий Третий', 'питомец появился и сохранил имя');
ok(h.run('Game.fairy.dr.st') === 'gone' && h.run('Game.fairy.dr.away > Game.time + 565'), 'после поимки новый дикий появится не скоро');
ok(h.run('Game.faunaStat.dpCaught') === 1 && h.run('Game.faunaStat.dpTry') >= 4, 'статистика: поймано и попытки');
ok(h.run('dpSlots(Game.hero)') >= 1, 'место для питомца');

// 5. Умения и рост
J(`const p = Game.fairy.dp.pets[0]; p.sp = 'fire'; p.lv = 1; p.xp = 0; return 1;`);
ok(J('return dpSkills(Game.fairy.dp.pets[0])').join() === 'flame', 'огненный на 1-м уровне умеет только огонь');
h.run('dpGain(Game.fairy.dp.pets[0], 200, 0)');
ok(h.run('Game.fairy.dp.pets[0].lv') >= 3 && J('return dpSkills(Game.fairy.dp.pets[0])').includes('warm'), 'с опытом растёт уровень и открывается согрев');
// огонь по врагу: подменяем врага и считаем попадания; урон не чаще раза в 4 с
J(`
  const hu = Game.hero, p = Game.fairy.dp.pets[0];
  p.sat = 90; p.mood = 90; p.en = 100; p.st = 'with'; p.sick = 0; p.cdA = 0; p.x = hu.x; p.y = hu.y;
  globalThis.__foe = { kind: 'beast', o: { x: hu.x + 2, y: hu.y, kind: 'wolf' } }; globalThis.__kills = 0;
  globalThis.__fn = foesNear; globalThis.__kf = killFoe;
  foesNear = () => [__foe]; killFoe = () => { __kills++; };
  return 1;
`);
for (let i = 0; i < 400; i++) h.run('dpPetTick(Game.fairy.dp.pets[0], 0.1); Game.time += 0.1');
const kills = h.run('__kills');
h.run('foesNear = __fn; killFoe = __kf');
ok(kills >= 1, 'огненный питомец должен помогать в бою');
ok(kills <= 10, 'питомец не должен заменять героя: за 40 с побед ' + kills);
// свет ночью у лесного 5-го уровня
J(`const p = Game.fairy.dp.pets[0]; p.sp = 'forest'; p.lv = 5; return 1;`);
ok(J('return dpSkills(Game.fairy.dp.pets[0])').includes('light'), 'лесной 5-го уровня светит');

// 6. Уход: кормёжка, голод — улетает на время, потом возвращается
const fed = J('const p = Game.fairy.dp.pets[0]; p.sat = 20; return dpFeed(Game.hero, p.id, "bread")');
ok(fed.ok && h.run('Game.fairy.dp.pets[0].sat') > 20, 'кормёжка повышает сытость');
J('const p = Game.fairy.dp.pets[0]; p.sat = 0; p.hungry = 0; return 1;');
for (let i = 0; i < 40; i++) h.run('dpPetTick(Game.fairy.dp.pets[0], 5)');
ok(h.run('Game.fairy.dp.pets[0].st') === 'away', 'голодный питомец улетает');
ok(h.run('Game.fairy.dp.pets.length') === 1 && h.run('Game.fairy.dp.lost') === 1, 'но не пропадает насовсем, потеря учтена');
h.run('Game.time = Game.fairy.dp.pets[0].until + 1; dpPetTick(Game.fairy.dp.pets[0], 0.1)');
ok(h.run('Game.fairy.dp.pets[0].st') === 'with', 'питомец возвращается');

// 7. Сейв: питомец и дикий дракончик переживают сохранение
const before = J('const p = Game.fairy.dp.pets[0]; return { lv: p.lv, name: p.name, sp: p.sp, away: Game.fairy.dr.st }');
h.run('{ const s = JSON.parse(JSON.stringify(serializeGame())); applySave(s); }');
step(2);
const after = J('const F = Game.fairy; const p = F && F.dp && F.dp.pets[0]; return p ? { lv: p.lv, name: p.name, sp: p.sp, away: F.dr ? F.dr.st : (F.drSaved && F.drSaved[9] ? "gone" : "?") } : null');
ok(after && after.lv === before.lv && after.name === before.name && after.sp === before.sp, 'питомец пережил сохранение: ' + JSON.stringify(after));
ok(after && after.away === 'gone', 'пустое гнездо пережило сохранение: ' + (after && after.away));

// 8. Миграция: старый сейв с ручным драконом
const mig = J(`
  const F = Game.fairy; F.dp = null;
  if (!F.dr) fyNests(F);
  F.dr.tamed = true; F.dr.st = 'pet'; F.dr.stage = 1; F.dr.raids = 8;
  const o = JSON.parse(JSON.stringify(serializeGame())); applySave(o);
  const F2 = fyState(); fyNests(F2); dragonTick(0.05, F2);
  return { n: F2.dp ? F2.dp.pets.length : 0, lv: F2.dp && F2.dp.pets[0] ? F2.dp.pets[0].lv : 0, tamed: F2.dr.tamed };
`);
ok(mig.n === 1 && mig.lv >= 3 && !mig.tamed, 'ручной дракон из старого сейва стал питомцем: ' + JSON.stringify(mig));

// 9. Кооп: сервер считает, питомец принадлежит игроку, клиентам идёт в зеркале
const cs = L.newSim(9, { coop: true }), ch2 = cs.h, J2 = c => JSON.parse(ch2.run('JSON.stringify((function(){' + c + '})())'));
const co = J2(`
  coopJoin('Аня', JSON.stringify({ cls: 'druid' })); coopJoin('Боря', JSON.stringify({ cls: 'warrior' }));
  Game.time = Math.max(Game.time, 400);
  const F = fyState(); fyNests(F); const d = F.dr, a = coop.players.get('Аня');
  for (const s of Game.buildings) if (s.isStore()) s.stock.sausage = 5;
  d.st = 'land'; d.z = 0; d.lt = 1e9; d.x = a.x + 2; d.y = a.y; dpWildInit(d);
  d.talk = { hid: a.id, key: 'Аня', t: 0, trust: 0, tries: 0, line: 'first', seq: 1, last: '' };
  const r0 = Math.random; Math.random = () => 0.001;
  coopCmd('Боря', JSON.stringify({ t: 'dp', a: 'bait', g: 'sausage' }), false);      // чужой разговор — не его
  const afterB = F.dp ? F.dp.pets.length : 0;
  coopCmd('Аня', JSON.stringify({ t: 'dp', a: 'bait', g: 'sausage' }), false);
  Math.random = r0;
  const m = fyMirrorOut();
  return { afterB, n: F.dp.pets.length, owner: F.dp.pets[0] && F.dp.pets[0].owner, mir: !!(m && m.dp), druid: dpChance({ sp: 'forest', bait: 'bread', sneak: true, cls: 'druid', hp: 1 }) > dpChance({ sp: 'forest', bait: 'bread', sneak: true, cls: 'warrior', hp: 1 }) };
`);
ok(co.afterB === 0, 'в коопе чужой игрок не может приручить дракончика, с которым говорит другой');
ok(co.n === 1 && co.owner === 'Аня', 'в коопе питомец принадлежит игроку: ' + JSON.stringify(co));
ok(co.mir, 'питомцы попадают в зеркало для клиентов');
ok(!cs.errors.length, 'исключения в коопе: ' + cs.errors.join(' | '));

ok(!sim.errors.length, 'исключения: ' + sim.errors.join(' | '));
console.log(`Проверка дракончиков: ${fails.length ? 'ПРОВАЛ ' + fails.length : 'OK'}`);
process.exit(fails.length ? 1 : 0);
