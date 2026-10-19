'use strict';
// Клятвы предков (oaths.js, КЛАССЫ.md): у каждого из десяти классов работают перки, цена и дар деревне, способности
// новых классов, дрожь клятвы паладина, вкладка «Клятва», сохранение (герой остаётся при своём классе).
// Запуск: node tests/oath-test.js
const S = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

const CLASSES = ['warrior', 'barbarian', 'paladin', 'archer', 'monk', 'rogue', 'bard', 'mage', 'priest', 'druid'];
const sim = S.newSim(5);
const J = code => sim.h.run(`JSON.stringify((() => { ${code} })())`) && JSON.parse(sim.h.run(`JSON.stringify((() => { ${code} })())`));
S.runFor(sim, 60, 10, () => {});

const n = J('return { o: Object.keys(OATHS).length, g: Object.keys(GCLS).length, a: Object.keys(HERO_ABIL).length }');
ok(n.o === 10 && n.g === 10 && n.a === 10, `классов: клятв ${n.o}, GCLS ${n.g}, способностей ${n.a} — должно быть по 10`);
const guilds = J('return ["warrior","archer","rogue","mage"].map(g => guildClasses(g).length)');
ok(guilds.join() === '3,2,2,3', `гильдии учат не те классы: ${guilds}`);

for (const k of CLASSES) {
  const r = J(`const h = Game.hero, H = h.hero;
    const sum = s => s.str + s.agi + s.int + s.end;
    H.clsKey = null; H.mastery = null; H.level = 1; const b1 = sum(heroStats(H)); H.level = 12; const b12 = sum(heroStats(H));
    H.clsKey = '${k}'; H.cls = GCLS['${k}'].name; H.mastery = 0; H.level = 1;
    const s1 = heroStats(H); H.level = 12; const s12 = heroStats(H);
    H.maxhp = hlMaxHp(H); H.hp = H.maxhp; H.abCd = {}; H.abT = {};
    const html = oathTabHTML(H);
    return { d: sum(s12) - sum(s1) - (b12 - b1), hp: H.maxhp, atk: heroAtk(h), spd: teamSpeedMul(h), html: html.length, quote: html.includes(OATHS['${k}'].quote) };`);
  ok(r.d >= 6 && r.d <= 8, `${k}: перки 3–12 уровня дают ${r.d}, ждём 6–8`);
  ok(r.hp > 20 && r.atk > 0.2 && r.atk < 1 && r.spd > 0.8, `${k}: странные числа ${JSON.stringify(r)}`);
  ok(r.quote, `${k}: во вкладке «Клятва» нет цитаты`);
  // обе способности (вторая с 4 уровня) — без исключений
  sim.h.run('heroAbilityFor(Game.hero, 0); heroAbilityFor(Game.hero, 1)');
  S.runFor(sim, 20, 10, () => {});
  console.log(`${k.padEnd(10)} перки +${r.d}, здоровье ${r.hp}, точность ${r.atk.toFixed(2)}, скорость ×${r.spd.toFixed(2)}`);
}

// окно гильдии: Клятвы своих классов
const gl = J('return ["warrior","archer","rogue","mage"].map(g => guildClasses(g).map(oathLine).join("").length > 100)');
ok(gl.every(Boolean), 'в окне гильдии нет Клятв: ' + gl);

// цена: монах без защиты доспеха, друид без железа
const arm = J(`const h = Game.hero, H = h.hero; H.equip.armor = 'ironArmor';
  H.clsKey = 'warrior'; const w = heroDef(h), ws = heroStats(H).end;
  H.clsKey = 'monk'; const m = heroDef(h);
  H.clsKey = 'druid'; const d = heroDef(h), ds = heroStats(H).end;
  H.equip.armor = null; return { w, m, d, ws, ds };`);
ok(arm.w > 0 && arm.m < arm.w && arm.d < arm.w, `доспех: воин ${arm.w}, монах ${arm.m}, друид ${arm.d}`);

// друид: поле рядом растёт быстрее обычного
const grow = J(`const h = Game.hero, H = h.hero; H.clsKey = 'druid'; H.level = 15;
  const x = Math.floor(h.x) + 1, y = Math.floor(h.y), i = y * MAP_W + x; globalThis.__fi = i;
  World.obj[i] = { t: 'field', g: 0.2 }; World.growing.add(i); globalThis.__hx = [h.x, h.y]; return 0.2;`);
S.runFor(sim, 8, 1, () => sim.h.run('Game.hero.x = __hx[0]; Game.hero.y = __hx[1];'));
const g2 = J('const o = World.obj[__fi]; return o ? o.g : -1');
ok(g2 > grow + 8 / 65 + 0.03, `друид: поле выросло только до ${g2.toFixed(3)}`);

// бард: «Дай пять!» поднимает настроение гномам рядом
const five = J(`const h = Game.hero, H = h.hero; H.clsKey = 'bard'; H.level = 6; H.abCd = {};
  const g = Game.units.find(u => u.md && !u.dead && !u.inside); if (!g) return -1;
  h.x = g.x + 0.5; h.y = g.y; heroAbilityFor(h, 1);
  return Game.units.filter(u => u.md && u.md.ev.some(e => e[0] === 'five')).length;`);
ok(five >= 1, `бард: «Дай пять» никому не досталось (${five})`);

// паладин: погиб гном — клятва дрожит
sim.h.run(`Game.hero.hero.clsKey = 'paladin'; Game.lostGnomes = (Game.lostGnomes || 0) + 1;`);
S.runFor(sim, 5, 1, () => {});
const crack = J('return (Game.hero.hero.oathCrack || 0) > Game.time');
ok(crack, 'паладин: гибель гнома не тронула клятву');

// сохранение: класс и уровень героя на месте
sim.h.run(`Game.hero.hero.clsKey = 'bard'; Game.hero.hero.cls = 'Бард'; Game.hero.hero.mastery = 2;`);
sim.h.run('{ const s = JSON.parse(JSON.stringify(serializeGame())); applySave(s); }');
const back = J('return Game.hero && Game.hero.hero ? Game.hero.hero.clsKey + ":" + Game.hero.hero.mastery : "нет"');
ok(back === 'bard:2', `после загрузки герой стал ${back}`);
S.runFor(sim, 30, 10, () => {});

ok(!sim.errors.length, 'исключения: ' + sim.errors.slice(0, 3).join(' | '));
const inv = S.checkInvariants(sim, 'клятвы'); for (const p of inv.problems) ok(false, p);
console.log(fails.length ? `Проверка клятв: провалов ${fails.length}` : 'Проверка клятв: всё в порядке');
process.exit(fails.length ? 1 : 0);
