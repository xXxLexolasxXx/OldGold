'use strict';
// Нейтралы 2 (НЕЙТРАЛЫ_2.md): ранги по ночам, новые логова (гоблины, тролли, броненосец, гномтавры), патрули,
// качение броненосца, огненный шар по гоблинам, сохранение и зеркало. Запуск: node tests/neutrals2-test.js
const L = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };
const sim = L.newSim(+(process.argv[2] || 7)), h = sim.h, J = c => JSON.parse(h.run('JSON.stringify((function(){' + c + '})())'));
const toNight = n => h.run(`(function(){ while (startNights() < ${n} || !startOpen('neutrals')) Game.time += 5; })()`);

ok(J('return Game.neutrals.filter(N => N2_KINDS[N.k]).length') === 0, 'новые виды не должны быть на старте');
ok(J('return Game.neutrals.every(N => (N.rk || 1) === 1)') === true, 'на старте все нейтралы 1-го ранга');

// 1-я ночь: гоблины и хотя бы один нейтрал 2-го ранга
toNight(1); L.stepN(sim, 40);
let st = J('return { gob: Game.lairs.filter(l => l.k === "goblin").length, rk2: Game.neutrals.filter(N => N.st !== "die" && N.rk >= 2).length, nt: Game.n2 && Game.n2.nt, gN: Game.neutrals.filter(N => N.k === "goblin").length }');
ok(st.nt === 1, 'ночь не обработана: ' + JSON.stringify(st));
ok(st.gob >= 1, 'после 1-й ночи нет гоблинского лагеря: ' + JSON.stringify(st));
ok(st.gN >= 5 * st.gob && st.gN <= 8 * st.gob, 'в лагере должно быть 5–8 гоблинов: ' + JSON.stringify(st));
ok(st.rk2 >= 1, 'со 2-го дня должен быть нейтрал 2-го ранга: ' + JSON.stringify(st));

// до 4-й ночи: тролль, броненосец, гномтавры; потолок ранга соблюдён
for (let n = 2; n <= 4; n++) { toNight(n); L.stepN(sim, 30); }
st = J('return { kinds: [...new Set(Game.lairs.map(l => l.k))], maxRk: Math.max(...Game.neutrals.map(N => N.rk || 1)), cap: n2Cap(4), roam: NSPEC.boar.roam, roam0: NSPEC.boar.roam0 }');
ok(st.kinds.some(k => /^troll/.test(k)), 'нет логова тролля к 4-й ночи: ' + st.kinds);
ok(st.kinds.includes('armad'), 'нет норы броненосца: ' + st.kinds);
ok(st.kinds.includes('gnomtaur'), 'нет стойбища гномтавров: ' + st.kinds);
ok(st.maxRk >= 2 && st.maxRk <= st.cap, `ранг вне потолка: ${st.maxRk} / ${st.cap}`);
ok(st.roam > st.roam0, 'покой у логова не расширился с днями');
L.stepN(sim, 400);   // 20 с: всё ходит, никто не падает

// броненосец: на героя в 6 клетках — сворачивается и катится; гномёнка на пути объезжает
const roll = J(`
  const A = Game.neutrals.find(N => N.k === 'armad' && N.st !== 'die'), u = Game.hero;
  if (!A || !u) return { skip: !A ? 'нет броненосца' : 'нет героя' };
  let x = A.x + 6, y = A.y;
  for (let d = 4; d <= 8 && !isWalkable(Math.floor(x), Math.floor(y)); d++) { x = A.x - d; }
  u.x = x; u.y = y; u.inside = null; u.hero.hp = u.hero.maxhp;
  neuProvoke(A, u); A.rlCd = 0; A.cdA = 0;
  let seen = 0, phases = {};
  for (let i = 0; i < 120; i++) { step(0.05); if (A.rl) { seen = 1; phases[A.rl.ph] = 1; } }
  return { seen, phases: Object.keys(phases), hp: u.hero.hp, max: u.hero.maxhp };`);
if (roll.skip) console.log('  · броненосец: пропуск — ' + roll.skip);
else {
  ok(roll.seen === 1, 'броненосец не свернулся в шар');
  ok(roll.phases.includes('curl') && (roll.phases.includes('roll') || roll.phases.includes('bounce')), 'нет фаз сворачивания/качения: ' + roll.phases);
}

// огненный шар: летит в гоблинов, жжёт по площади
const fb = J(`
  const G = Game.neutrals.filter(N => N.k === 'goblin' && N.st !== 'die'), u = Game.hero;
  if (!G.length || !u || typeof hmCast !== 'function') return { skip: 1 };
  for (const N of Game.neutrals) { N.prov = -99; N.tg = 0; N.rl = null; }
  for (const s of Game.skels || []) s.state = 'dead';
  Game.ents = [];
  // кучка из четырёх гоблинов вокруг того, в кого полетит шар
  u.x = G[0].x - 4; u.y = G[0].y; u.inside = null; u.hero.hp = u.hero.maxhp; u.hero.mana = 99; u.hero.cdFire = 0; u.hero.level = Math.max(u.hero.level || 1, 3);
  N2.cast = 'fire'; const t = hmFoe(u, 9); N2.cast = null; N2.fireN = null;
  if (!t || t.o.k !== 'goblin') return { skip: 1 };
  const c = t.o; for (const g of G.filter(g => g !== c).slice(0, 3)) { g.x = c.x + (Math.random() - 0.5); g.y = c.y + (Math.random() - 0.5) * 0.6; }
  const before = Game.neutrals.filter(N => N.k === 'goblin' && N.st !== 'die').length;
  hmCast('fire');
  for (let i = 0; i < 30; i++) step(0.05);
  return { hl: typeof hlOn === "function" && hlOn(), lvl: u.hero.level, before, after: Game.neutrals.filter(N => N.k === 'goblin' && N.st !== 'die').length, mana: u.hero.mana };`);
if (fb.skip) console.log('  · огненный шар: пропуск');
else ok(fb.after < fb.before - 1, `огненный шар не сжёг гоблинов по площади: ${JSON.stringify(fb)}`);

// сохранение: ранги, здоровье, счётчики ночей и новых логов
const before = J('return { rk: Game.neutrals.filter(N => N.st !== "die" && N.rk > 1).map(N => [N.id, N.rk, Math.round(N.hp), N.mhp]), n2: Game.n2, lairs: Game.lairs.length }');
h.run('__s = JSON.parse(JSON.stringify(serializeGame())); applySave(__s)');
const after = J('return { rk: Game.neutrals.filter(N => N.st !== "die" && N.rk > 1).map(N => [N.id, N.rk, Math.round(N.hp), N.mhp]), n2: Game.n2, lairs: Game.lairs.length }');
ok(JSON.stringify(before.rk) === JSON.stringify(after.rk), 'ранги/здоровье не пережили сохранение');
ok(JSON.stringify(before.n2) === JSON.stringify(after.n2), 'Game.n2 не пережил сохранение');
ok(before.lairs === after.lairs, 'число логов изменилось после загрузки');
// старый сейв без рангов: на 2-м дне и позже хотя бы один окрепнет
h.run('__s.nt.rk = undefined; __s.nt.n2 = undefined; __s.nt.lrk = undefined; applySave(__s)');
L.stepN(sim, 40);
ok(J('return Game.neutrals.some(N => N.st !== "die" && N.rk >= 2)') === true, 'старый сейв: никто не окреп');

// зеркало кооператива несёт ранг
ok(J('return neuMirror().some(d => d.rk >= 2)') === true, 'в зеркале нет ранга (rk)');
L.stepN(sim, 600);
ok(!sim.errors.length, 'исключения: ' + sim.errors.join('\n'));

console.log(`Проверка нейтралов 2: ${fails.length ? 'провалов ' + fails.length : 'ранги, логова, качение, огненный шар, сейв — ок'}`);
process.exit(fails.length ? 1 : 0);
