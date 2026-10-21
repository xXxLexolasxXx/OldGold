'use strict';
// Оружие (arms.js): оружейная открывается рано, гильдии после неё; особое оружие гильдий; заточка +3/80/60/40/20, потолок +12;
// усиленный удар не добивает здоровую цель; свойства уровня 3 (в т.ч. у монаха); сейв.
// Запуск: node tests/arms-test.js
const S = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };
const sim = S.newSim(5);
const J = code => JSON.parse(sim.h.run(`JSON.stringify((() => { ${code} })())`));
S.runFor(sim, 60, 10, () => {});

// общий помощник: найти или поставить здание
const PLACE = `const place = type => {
    let r = Game.buildings.find(b => b.type === type && b.state === 'done' && !b.removed); if (r) return r;
    const hub = Game.buildings.find(b => b.type === 'storehouse');
    for (let rr = 3; rr < 30; rr++) for (let k = 0; k < 28; k++) {
      const x = Math.round(hub.doorX + Math.cos(k * 0.5) * rr * 1.6), y = Math.round(hub.doorY + Math.sin(k * 0.5) * rr);
      if (inb(x, y) && !checkPlacement(type, x, y, 0)) { const q = placeBuilding(type, x, y, true, 0); q.state = 'done'; return q; }
    }
    throw new Error('нет места ' + type);
  };`;

// 1. Порядок открытия
const u = J(`const st = id => UNLOCKS.find(s => s.id === id), idx = t => UNLOCKS.findIndex(s => s.items.includes(t));
  return { arms: st('arms'), ws: idx('weaponsmith'), armory: idx('armory'), metal: idx('metallurgist'), guild: st('guilds'), iron: st('iron') };`);
ok(u.arms && u.arms.items.includes('weaponsmith') && u.arms.after.includes('armory') && !u.arms.rank, 'оружейная должна открываться сразу после мастерской доспехов, без звания: ' + JSON.stringify(u.arms));
ok(u.ws > u.armory && u.ws < u.metal, `оружейная (${u.ws}) должна быть после доспехов (${u.armory}) и раньше металлурга (${u.metal})`);
ok(u.guild.after.includes('weaponsmith'), 'гильдии должны открываться после оружейной');
ok(!u.iron.items.includes('weaponsmith'), 'оружейная всё ещё в стадии железа');

// 2. Таблица заточки
const t = J(`return { ch: ENH_CHANCE, dmg: ENH_DMG, max: ENH_MAX };`);
ok(JSON.stringify(t.ch.slice(0, 7)) === JSON.stringify([1, 1, 1, 0.8, 0.6, 0.4, 0.2]) && t.ch.slice(6).every(v => v === 0.2) && t.ch.length === 12, 'шансы заточки: ' + t.ch);
ok(t.max === 12 && t.dmg.length === 13, 'потолок +12');
ok(t.dmg.every((v, i) => !i || v > t.dmg[i - 1]), 'бонус урона должен расти с уровнем');
ok(t.dmg[5] - t.dmg[0] <= 0.16 && t.dmg[6] - t.dmg[5] >= 0.09 && t.dmg[12] >= 2 && t.dmg[12] <= 2.5, 'после +5 бонусы растут заметно, но без перекоса: ' + t.dmg);

// 3. Точим: до +3 всегда, дальше по шансу, неудача уровень не снижает, железо тратится, потолок
const e = J(`${PLACE} const h = Game.hero, H = h.hero; H.equip.weapon = 'sword'; H.enh = null;
  const ws = place('weaponsmith');
  ws.stock.iron = 99; const rnd = Math.random, log = [];
  Math.random = () => 0.999;                   // «всегда неудача» — на безопасных уровнях всё равно успех
  for (let i = 0; i < 4; i++) { arEnhance(ws); log.push(enhLv(H)); }
  const ironAfter = ws.stock.iron;
  Math.random = () => 0.7; arEnhance(ws); log.push(enhLv(H));      // +4 при 70% < 80% — успех
  Math.random = () => 0.7; arEnhance(ws); log.push(enhLv(H));      // +5 нужно <60%: неудача
  Math.random = () => 0.5; arEnhance(ws); log.push(enhLv(H));      // +5 успех
  Math.random = () => 0.3; arEnhance(ws); log.push(enhLv(H));      // +6 нужно <40%: успех
  Math.random = () => 0.25; arEnhance(ws); log.push(enhLv(H));     // +7 нужно <20%: неудача
  Math.random = () => 0.1; for (let i = 0; i < 12; i++) arEnhance(ws); log.push(enhLv(H));
  H.equip.weapon = 'bow'; const other = enhLv(H); H.equip.weapon = 'sword';
  const html = arEnhPanel(ws) + arForgePanel(ws);
  Math.random = rnd;
  return { log, ironAfter, other, html: /Заточка оружия/.test(html) };`);
ok(JSON.stringify(e.log) === JSON.stringify([1, 2, 3, 3, 4, 4, 5, 6, 6, 12]), 'заточка по шансам: ' + e.log);
ok(e.ironAfter < 99, 'железо должно тратиться на заточку');
ok(e.other === 0, 'заточка относится к надетому оружию (у лука должно быть +0): ' + e.other);
ok(e.html, 'в окне оружейной нет раздела заточки');

// 4. Бонусы заточки в бою: меткость и урон растут; удар по здоровой цели не добивает её (по слабой — как обычно)
const b = J(`const h = Game.hero, H = h.hero; H.equip.weapon = 'sword';
  H.enh = { k: 'sword', lv: 0 }; const d0 = neuDamageOf(h), a0 = heroAtk(h);
  H.enh = { k: 'sword', lv: 12 }; const d12 = neuDamageOf(h), a12 = heroAtk(h);
  const N = { hp: 100, mhp: 100, x: 1, y: 1 }, N2 = { hp: 30, mhp: 100, x: 1, y: 1 };
  const w = arHitWrap((n, uu, d) => { n.hp -= d; }, () => true, false);
  w(N, h, 90); w(N2, h, 90);   // без заточки удар был бы 40
  return { r: d12 / d0, a: a12 - a0, left: N.hp, left2: N2.hp };`);
ok(b.r > 2.2 && b.r < 2.3, 'урон +12 должен быть ×2,25: ' + b.r);
ok(b.a > 0.1 && b.a < 0.2, 'меткость +12: ' + b.a);
ok(b.left >= 55, `усиленный удар добил здоровую цель: осталось ${b.left}`);
ok(b.left2 < 1, `удар по слабой цели должен проходить: осталось ${b.left2}`);

// 5. Особое оружие: у каждой гильдии своё, есть у монаха; ковка, цена, полный бонус своему классу
const g = J(`${PLACE} const ks = Object.keys(GW), guilds = new Set(ks.map(k => GW[k].guild));
  const h = Game.hero, H = h.hero;
  const ws = place('weaponsmith'), gm = place('guild_mage');
  ws.stock.iron = 20; ws.stock.timber = 20; gm.stock.gold = 30;
  for (const s of Game.buildings) if (s.isStore()) s.stock.gold = 0;
  H.inv = H.inv.map(() => null); H.equip.weapon = null; H.clsKey = 'mage'; H.mastery = 1; H.enh = null;
  arForge(ws, 'gwStaff');
  const have = H.inv.some(s => s && s.k === 'gwStaff'), iron = ws.stock.iron, gold = gm.stock.gold;
  arForge(ws, 'gwBow');                                   // гильдии лучников нет — отказ
  const bow = H.inv.some(s => s && s.k === 'gwBow');
  H.equip.weapon = 'staff'; const aStaff = heroAtk(h), intStaff = heroStats(H).int;
  H.equip.weapon = 'gwStaff'; const aGw = heroAtk(h), intGw = heroStats(H).int;
  const l2 = gwProp(h); gm.level = 3; const l3 = gwProp(h); gm.level = 1;
  H.clsKey = 'warrior'; const wrong = gwProp(h); H.clsKey = 'mage';
  const props = Object.fromEntries(ks.map(k => [k, GW[k].prop]));
  return { ks, guilds: [...guilds], have, iron, gold, bow, aGw, aStaff, intGw, intStaff, l2, l3, wrong, props, monk: GW.gwWraps.cls, hlg: ks.every(k => HL_GEAR[k] && GEAR_BONUS[k] && DUR.max[k] && WPN_LOOK[k]) };`);
ok(g.ks.length >= 5 && ['warrior', 'archer', 'rogue', 'mage'].every(x => g.guilds.includes(x)), 'особое оружие должно быть у каждой гильдии: ' + g.ks);
ok(g.monk.includes('monk') && g.props.gwWraps, 'у монаха нет своего особого оружия и свойства');
ok(new Set(Object.values(g.props)).size === g.ks.length, 'свойства оружия должны различаться: ' + JSON.stringify(g.props));
ok(g.hlg, 'особое оружие не зарегистрировано в HL_GEAR/GEAR_BONUS/DUR/WPN_LOOK');
ok(g.have && g.iron === 14 && g.gold === 24, `ковка: в рюкзаке ${g.have}, железа ${g.iron} (ждём 14), золота ${g.gold} (ждём 24)`);
ok(!g.bow, 'без гильдии лучников лук не куётся');
ok(g.aGw > g.aStaff, `особый посох должен быть точнее обычного: ${g.aGw} против ${g.aStaff}`);
ok(g.intGw > g.intStaff, 'особый посох даёт больше смекалки');
ok(g.l2 === null && g.l3 === 'flame', `свойство только с 3 уровня гильдии: ур.1 → ${g.l2}, ур.3 → ${g.l3}`);
ok(g.wrong === null, 'чужому классу свойство не даётся');

// 6. Свойства в бою: вампиризм лечит героя и рекрутов гильдии 3 уровня
const p = J(`${PLACE} const h = Game.hero, H = h.hero; H.clsKey = 'warrior'; H.mastery = 1; H.equip.weapon = 'gwBlade';
  const wg = place('guild_warrior'); wg.level = 3; H.maxhp = 100; H.hp = 50;
  const N = { hp: 80, mhp: 100, x: h.x + 1, y: h.y, k: 'boar', fx: null };
  arProc(h, N, 40, false);
  const vamp = H.hp;
  H.clsKey = 'archer'; H.equip.weapon = 'gwBow'; const noGuild = Game.buildings.some(x => x.type === 'guild_archer') ? 'есть' : gwProp(h);
  const rec = Game.units.find(x => x.type === 'serf' && !x.dead); rec.type = 'warrior'; rec.rec = { cls: 'warrior', lvl: 3, xp: 0, guild: wg.id, order: 'guard', train: 0, hp: 20, name: 'Т' };
  const rp = gwProp(rec); wg.level = 2; const rp2 = gwProp(rec); wg.level = 3;
  arProc(rec, N, 40, false); const rhp = rec.rec.hp;
  rec.type = 'serf'; rec.rec = null; rec._spr = null;
  return { vamp, noGuild, rp, rp2, rhp };`);
ok(p.vamp > 50 && p.vamp <= 56, `вампиризм: здоровье 50 → ${p.vamp}, ждём ≈ +4,8`);
ok(p.noGuild === null || p.noGuild === 'есть', 'без гильдии лучников свойство лука не работает');
ok(p.rp === 'vamp' && p.rp2 === null, `рекрут: ур.3 → ${p.rp}, ур.2 → ${p.rp2}`);
ok(p.rhp > 20, 'вампиризм рекрута не лечит');

// 7. Значки не падают, сейв хранит заточку
const ic = J(`const out = []; for (const k of Object.keys(GW)) { try { out.push(typeof iconCanvas === 'function' ? !!iconCanvas('good', k) : true); } catch (er) { out.push(String(er)); } } return out;`);
ok(ic.every(v => v === true), 'значки особого оружия: ' + ic);
const sv = J(`const H = Game.hero.hero; H.equip.weapon = 'gwBlade'; H.enh = { k: 'gwBlade', lv: 9 }; return serializeGame();`);
const dst = S.newSim(9);
dst.h.ctx.__t = JSON.stringify(sv);
ok(!dst.h.run('loadSaveText(__t)'), 'загрузка сейва не удалась');
ok(dst.h.run('enhLv(Game.hero.hero)') === 9, 'заточка не пережила сейв');

S.runFor(sim, 30, 10, () => {});
for (const er of sim.errors) fails.push('исключение в игре: ' + er);
console.log(fails.length ? 'Проверка оружия: ПРОВАЛ' : 'Проверка оружия: порядок открытия, особое оружие, заточка, свойства, сейв — ок');
process.exit(fails.length ? 1 : 0);
