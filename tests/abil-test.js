'use strict';
// Способности классов (heroabil.js, HERO_ABIL в herokit.js, 0.10.69): у каждого класса 3–5 своих, общих (зелье лечения,
// огненный шар для всех) нет; ресурс класса, перезарядки, оглушение, ловушка, привал, перевязка, лазарет, слабость после падения,
// миграция старых героев (банки маны → золото), сохранение, кооп (сервер применяет, игроку уходят rs/rsm),
// баланс лечения и урона способностями на 1–15 уровнях.
// Запуск: node tests/abil-test.js
const S = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

const CLASSES = ['warrior', 'barbarian', 'paladin', 'archer', 'monk', 'rogue', 'bard', 'mage', 'priest', 'druid'];
const sim = S.newSim(7);
const J = code => JSON.parse(sim.h.run(`JSON.stringify((() => { ${code} })())`));
S.runFor(sim, 20, 10, () => {});

// ---------- Данные ----------
const D = J(`const out = {};
  for (const k in HERO_ABIL) out[k] = HERO_ABIL[k].map(a => ({ k: a.k, lvl: a.lvl || 1, cd: a.cd, cost: a.cost, passive: !!a.passive, fx: a.fx || null, ult: !!a.ult,
    fxOk: !a.fx || typeof ABIL_FX[a.fx] === 'function', icon: !!(ABIL_ICON[a.k] || HC_ICON[a.k]), desc: (a.desc || '').length }));
  return { abil: out, res: Object.keys(CLS_RES), util: AB_UTIL.map(u => !!(ABIL_ICON[u.icon] || HC_ICON[u.icon])),
    common: { spells: typeof HM_SPELLS !== 'undefined', jar: typeof hmDrink === 'function', healPart: typeof hlHealPart === 'function' } };`);
ok(Object.keys(D.abil).length === 10, 'классов со способностями: ' + Object.keys(D.abil).length);
const allKeys = new Set();
for (const c of CLASSES) {
  const L = D.abil[c] || [];
  const normal = L.filter(a => !a.ult), ults = L.filter(a => a.ult);
  ok(normal.length >= 3 && normal.length <= 5, `${c}: обычных способностей ${normal.length} (нужно 3–5)`);
  ok(ults.length === 1 && L[L.length - 1].ult, `${c}: ульта должна быть одна и последней (${ults.length})`);
  ok(D.res.includes(c), `${c}: нет ресурса класса`);
  let prev = 0;
  for (const a of L) {
    ok(!allKeys.has(a.k), `${c}: ключ ${a.k} повторяется у другого класса`); allKeys.add(a.k);
    ok(a.lvl >= prev && a.lvl <= 15, `${c}.${a.k}: уровень ${a.lvl} не по порядку`); prev = a.lvl;
    ok(a.icon, `${c}.${a.k}: нет значка`);
    ok(a.desc > 10, `${c}.${a.k}: нет описания`);
    ok(a.fxOk, `${c}.${a.k}: нет действия ${a.fx}`);
    if (!a.passive) ok(a.cd > 0 && a.cost > 0, `${c}.${a.k}: без перезарядки или цены (${a.cd}/${a.cost})`);
    if (a.ult) { ok(a.cd >= 180 && a.cd <= 320, `${c}.${a.k}: перезарядка ульты ${a.cd} вне 180–320 с`); ok(a.lvl >= 12 && !a.passive && a.fx, `${c}.${a.k}: ульта должна быть активной, с 12+ уровня и со своим действием`); }
  }
  ok(L[0] && L[0].lvl === 1 && !L[0].passive, `${c}: первая способность должна быть активной с 1 уровня`);
}
ok(D.util.every(Boolean), 'у малых кнопок панели нет значков');
ok(!D.common.spells && !D.common.jar && !D.common.healPart, 'общие заклинания остались: ' + JSON.stringify(D.common));
// «зелье лечения» больше не лечит
const heal = J(`const h = Game.hero, H = h.hero; H.hp = H.maxhp * 0.3; const b = H.hp; heroAbility('heal'); heroAbility('drink'); heroAbility('fire'); return { b, a: H.hp };`);
ok(heal.a === heal.b, 'клавиши старых общих скиллов ещё лечат: ' + JSON.stringify(heal));

// ---------- Каждая способность каждого класса на 15 уровне, по скелетам рядом ----------
// скелеты днём уходят в землю — для проверок держим ночь
sim.h.run('isNightNow = function () { return true; }; skelReact = function () {};');   // и не хватают героя: урон в бою моделируем сами
// место подальше от большого костра (у костра скелеты уходят в землю) и от зверей
const FAR = J(`for (let k = 0; k < 6000; k++) { const x = 6 + Math.floor(Math.random() * (MAP_W - 12)), y = 6 + Math.floor(Math.random() * (MAP_H - 12));
  if (isWalkable(x, y) && !nearBonfire(x, y, 16) && !foesNear(x + 0.5, y + 0.5, 14).length) return [x, y]; } return null;`);
ok(FAR, 'не нашлось места для проверки вдали от костра');
const setup = (cls, lvl) => sim.h.run(`{ const h = Game.hero, H = h.hero; heroStopUnit(h); h.x = ${FAR[0]} + 0.5; h.y = ${FAR[1]} + 0.5; for (const a of Game.animals) if ((a.kind === 'wolf' || a.kind === 'fox') && Math.hypot(a.x - h.x, a.y - h.y) < 15) a.x += 40; H.clsKey = '${cls}'; H.cls = GCLS['${cls}'].name; H.mastery = 3; H.level = ${lvl};
  H.maxhp = hlMaxHp(H); H.hp = H.maxhp; H.abCd = {}; H.abT = {}; H.abNext = 0; H.downT = 0; H.stunUntil = 0; H.drunkUntil = 0; H.weakUntil = 0;
  H.mana = hmMax(H); H.rs = abResKind(H) === 'rage' ? 100 : abResMax(H); h.inside = null; heroStopUnit(h); h.cmd = null; }`);
const spawnSkels = n => sim.h.run(`{ const h = Game.hero; Game.skels = Game.skels || [];
  for (let i = 0; i < ${n}; i++) { skelRise(h.x + 1 + i * 0.5, h.y + (i % 2 ? 0.6 : -0.6)); const s = Game.skels[Game.skels.length - 1]; s.state = 'roam'; s.k = 1; s.t = 0; s.nhp = 3; } }`);
const used = {};
for (const c of CLASSES) {
  setup(c, 15);
  const L = D.abil[c];
  L.forEach((a, i) => {
    if (a.passive) return;
    spawnSkels(3);
    const r = J(`const h = Game.hero, H = h.hero; H.mana = hmMax(H); H.rs = abResMax(H); const before = abResGet(H); const done = heroAbilityFor(h, ${i});
      return { done, spent: before - abResGet(H), cd: (H.abCd['${a.k}'] || 0) > Game.time };`);
    used[`${c}.${a.k}`] = r.done;
    if (a.k !== 'grow' && a.k !== 'cure' && a.k !== 'steal') ok(r.done, `${c}.${a.k}: не сработала рядом со скелетами`);
    if (r.done) { ok(r.cd, `${c}.${a.k}: нет перезарядки`); ok(Math.abs(r.spent - a.cost) < 1.5, `${c}.${a.k}: потрачено ${r.spent}, цена ${a.cost}`); }
    S.runFor(sim, 1, 1, () => {});
    sim.h.run('Game.skels = [];');
  });
  // повторно сразу — на перезарядке
  const again = J(`return heroAbilityFor(Game.hero, 0);`);
  ok(!again, `${c}: первая способность сработала дважды подряд`);
  sim.h.run('Game.skels = []; Game.abz = [];');
}
// ресурса не хватает — не срабатывает
setup('mage', 5);
const lack = J(`const H = Game.hero.hero; H.mana = 2; return heroAbilityFor(Game.hero, 0);`);
ok(!lack, 'огненный шар без маны сработал');
// уровень не тот — не срабатывает
setup('warrior', 1);
const lock = J(`Game.hero.hero.rs = 100; return heroAbilityFor(Game.hero, 4);`);
ok(!lock, 'стена щитов на 1 уровне сработала');
// пассивка: урон по воину на 12 уровне меньше
const red = J(`const h = Game.hero, H = h.hero; H.level = 1; const a = heroBuf(h, 'red'); H.level = 12; return [a, heroBuf(h, 'red')];`);
ok(red[0] === 0 && red[1] >= 0.15, 'пассивка «Непоколебимость» не работает: ' + red);

// ---------- Оглушение держит скелета на месте; по лежачему не промахиваются ----------
setup('warrior', 5);
spawnSkels(1);
const st = J(`const h = Game.hero, s = Game.skels[Game.skels.length - 1]; s.x = h.x + 1; s.y = h.y; s.nhp = 5;
  heroAbilityFor(h, 0); return { x: s.x, y: s.y, st: s.abStun > Game.time, nhp: s.nhp };`);
S.runFor(sim, 2, 1, () => {});
const st2 = J(`const s = Game.skels[Game.skels.length - 1]; return { x: s.x, y: s.y, nhp: s.nhp, st: s.abStun > Game.time };`);
ok(st.st && Math.hypot(st.x - st2.x, st.y - st2.y) < 0.01, 'удар щитом не держит скелета: ' + JSON.stringify([st, st2]));
const sure = J(`const h = Game.hero, s = Game.skels[Game.skels.length - 1], n = s.nhp; strike(h, { kind: 'skel', o: s }); return [n, s.nhp, s.state];`);
ok(sure[1] < sure[0] || sure[2] === 'dead', 'по оглушённому скелету промах: ' + sure);
sim.h.run('Game.skels = [];');

// ярость копится в бою
setup('barbarian', 3);
const rage = J(`const h = Game.hero, H = h.hero; H.rs = 10; for (let i = 0; i < 4; i++) abRage(h, 6); return H.rs;`);
ok(rage >= 30, 'ярость не копится: ' + rage);

// ловушка ловит скелета
setup('archer', 6);
const trap = J(`const h = Game.hero; heroAbilityFor(h, 2); const z = Game.abz.find(z => z.k === 'trap'); if (!z) return 'нет';
  skelRise(z.x + 0.2, z.y); const s = Game.skels[Game.skels.length - 1]; s.state = 'roam'; s.k = 1; s.nhp = 4; return 'ok';`);
S.runFor(sim, 1, 1, () => {});
const trapped = J(`const s = Game.skels[Game.skels.length - 1]; return { st: s.abStun > Game.time, left: Game.abz.filter(z => z.k === 'trap').length };`);
ok(trap === 'ok' && trapped.st && trapped.left === 0, 'ловушка не сработала: ' + JSON.stringify([trap, trapped]));
sim.h.run('Game.skels = []; Game.abz = [];');

// ---------- Лечение: привал, перевязка, медленное само по себе, слабость после падения ----------
setup('warrior', 5);
const camp = J(`const h = Game.hero, H = h.hero; H.hp = H.maxhp * 0.3; H.campCd = 0; Game.skels = []; Game.neutrals.forEach(N => N.tg = 0);
  return { ok: abCampStart(h), hp: H.hp / H.maxhp, foes: abFoes(h, 8).length };`);
S.runFor(sim, 8, 1, () => {});
const camp2 = J(`const H = Game.hero.hero; return { hp: H.hp / H.maxhp, cd: H.campCd || 0, cmd: Game.hero.cmd && Game.hero.cmd.kind };`);
ok(camp.ok && camp2.hp > camp.hp + 0.15, 'привал не лечит: ' + JSON.stringify([camp, camp2]));
const regen = J(`const h = Game.hero, H = h.hero; heroStopUnit(h); h.cmd = null; h.combatUntil = 0; return hlRegen(h);`);
ok(regen > 0 && regen <= 0.8, 'само лечение не медленное: ' + regen);
const band = J(`const h = Game.hero, H = h.hero; H.inv[0] = { k: 'bandage', n: 1 }; H.hp = H.maxhp * 0.4; h.injury = 'leg'; const b = H.hp;
  heroAbility('u_eat'); return { hp: H.hp - b, inj: h.injury, left: H.inv[0] };`);
ok(band.hp > 0 && !band.inj && !band.left, 'перевязка не сработала: ' + JSON.stringify(band));
const weak = J(`const h = Game.hero, H = h.hero; H.hp = 0; hlRespawn(h, 'тест'); return { w: H.weakUntil > Game.time, atk: unitAtk(h) };`);
ok(weak.w, 'после падения нет слабости');
const ward = J(`const b = Game.buildings.find(x => x.type === 'infirmary'); return b ? 'есть' : 'нет';`);
const wcmd = J(`const B = BUILDINGS.infirmary; return { r: B.recipes.some(r => r.out.bandage), g: !!GOODS.bandage };`);
ok(wcmd.r && wcmd.g, 'лазарет не режет перевязки: ' + JSON.stringify(wcmd));
void ward;

// ---------- Миграция старого героя: банки маны → золото, перезарядки сброшены ----------
const mig = J(`const h = Game.hero, H = h.hero; const st = Game.buildings.find(b => b.type === 'storehouse' && b.state === 'done');
  const g0 = st ? st.stock.gold || 0 : 0; H.abV = 0; H.jars = 3; H.cdHeal = Game.time + 50; H.abCd = { wind: Game.time + 99 }; abMigrate(h);
  return { gold: (st ? st.stock.gold || 0 : 0) - g0, jars: H.jars, cd: Object.keys(H.abCd).length, v: H.abV };`);
ok(mig.v === 3 && mig.jars === undefined && mig.cd === 0, 'миграция героя не прошла: ' + JSON.stringify(mig));
ok(mig.gold === 6, 'за 3 банки маны не дали 6 золота: ' + JSON.stringify(mig));

// ---------- Сохранение ----------
setup('rogue', 9);
sim.h.run(`Game.hero.hero.rs = 37; Game.hero.hero.abCd = { trip: Game.time + 5 };`);
sim.h.run('{ const s = JSON.parse(JSON.stringify(serializeGame())); applySave(s); }');
const back = J(`const H = Game.hero.hero; return { cls: H.clsKey, rs: Math.round(H.rs), v: H.abV };`);
ok(back.cls === 'rogue' && back.rs === 37 && back.v === 3, 'после загрузки: ' + JSON.stringify(back));
S.runFor(sim, 20, 10, () => {});

// ---------- Баланс: лечение и урон способностями ----------
// Лечение в минуту боя (% здоровья): ресурс и перезарядка ограничивают, общее «малое лечение» (было 30–72% раз в 25 с) убрано
const bal = J(`const out = {};
  for (const c of ${JSON.stringify(CLASSES)}) {
    const H = Game.hero.hero; H.clsKey = c; H.mastery = 5;
    const row = {};
    for (const L of [1, 5, 10, 15]) {
      H.level = L;
      const as = heroAbils(H), rk = abResKind(H), max = abResMax(H), mul = abPassive(H, 'res', 1);
      const regen = rk === 'mana' ? max * 0.012 * mul * 60 : rk === 'energy' ? 6 * mul * 60 : rk === 'faith' ? 60 * mul : 7 * 6 * 2 * 60 / 2;
      let budget = regen + max * 0.5, heal = 0, hits = 0, ctl = 0;
      for (const a of as) {
        if (a.passive || L < (a.lvl || 1)) continue;
        const casts = Math.max(0, Math.min(60 / (a.cd * abPassive(H, 'cd', 1)), budget / a.cost));
        budget -= casts * a.cost;
        if (a.heal) heal += casts * (a.heal + 0.01 * (L - 1)) * abPassive(H, 'heal', 1);
        if (a.next || a.k === 'fire' || a.k === 'frost' || a.k === 'bash' || a.k === 'palm') hits += casts;
        if (a.shots) hits += casts * a.shots.n * 0.6;
        if (a.turn) hits += casts * 2;
        if (a.buf && a.dur) hits += casts * a.dur * ((a.buf.dmg || 0) + (a.buf.atk || 0) + (a.buf.spd || 0)) / 1.5;
        if (a.fx === 'stomp' || a.fx === 'thorns') hits += casts * 2;
        if (/bash|trip|stomp|chord|palm|frost|thorns|wall|trap/.test(a.fx || '')) ctl += casts;
      }
      heal += 0.04 * 60 / hlMaxHp(H) + (heroBuf(Game.hero, 'hpr') || 0) * 60 / hlMaxHp(H);
      row[L] = { heal: Math.round(heal * 100), hits: Math.round(hits * 10) / 10, ctl: Math.round(ctl * 10) / 10 };
    }
    out[c] = row;
  }
  return out;`);
const HEAL_CLS = new Set(['priest', 'druid', 'paladin']);
console.log('Баланс за минуту боя: лечение % здоровья / удары способностями / оглушения (1 · 5 · 10 · 15 ур.)');
for (const c of CLASSES) {
  const r = bal[c];
  console.log(`  ${c.padEnd(10)} ${[1, 5, 10, 15].map(L => `${String(r[L].heal).padStart(3)}% ${String(r[L].hits).padStart(4)} ${String(r[L].ctl).padStart(4)}`).join('  ·  ')}`);
  if (!HEAL_CLS.has(c)) ok(r[15].heal <= 25, `${c}: лечится в бою ${r[15].heal}%/мин — не лекарь`);
  else ok(r[15].heal >= 40 && r[15].heal <= 110, `${c}: лечение лекаря ${r[15].heal}%/мин вне 40–110`);
  ok(r[15].hits + r[15].ctl >= 3, `${c}: на 15 уровне способности почти ничего не дают в бою`);
}
console.log('  было у всех: малое лечение 30% (1 ур.) … 72% (15 ур.) раз в 25 с = 72–173% здоровья в минуту');

// ---------- Поздняя игра: бой ночью 14-го дня, 15 уровень, способности по готовности ----------
const late = {};
for (const c of CLASSES) {
  setup(c, 15);
  sim.h.run(`Game.skels = []; Game.abz = []; Game.hero.hero.downs = 0;`);
  let kills = 0, downs = 0;
  for (let wave = 0; wave < 6; wave++) {
    spawnSkels(3);
    const r = J(`const h = Game.hero, H = h.hero, wave = Game.skels.slice(-3);
      for (let k = 0; k < 40; k++) {
        const as = heroAbils(H); as.forEach((a, i) => { if (!a.passive) heroAbilityFor(h, i); });
        const f = foesNear(h.x, h.y, 6)[0]; if (f) { strike(h, f); if (Math.random() < 0.35) heroHit(h, 6 + 2.5 * 4, ''); }
        if (H.hp <= 0) { H.hp = H.maxhp; H.downs = (H.downs || 0) + 1; }
        Game.time += 0.25; hmFxStep(0.25); abTick(0.25);      // быстро: без всего мира, только бой героя
      }
      return { kills: wave.filter(s => s.state === 'dead' || !Game.skels.includes(s)).length, downs: H.downs || 0 };`);
    kills += r.kills; downs = r.downs;
    sim.h.run(`Game.skels = Game.skels.filter(s => s.state !== 'dead');`);
  }
  late[c] = { kills, downs };
}
console.log('Поздняя игра (6 волн по 3 скелета, 15 ур.): убито / падений');
console.log('  ' + CLASSES.map(c => `${c} ${late[c].kills}/${late[c].downs}`).join(' · '));
const ks = CLASSES.map(c => late[c].kills), kmax = Math.max(...ks), kmin = Math.min(...ks);
ok(kmin > 0, 'кто-то из классов не убил ни одного скелета: ' + JSON.stringify(late));
if (kmax > kmin * 3) console.log(`  ⚠ разброс убийств по классам велик: ${kmin}…${kmax}`);

// ---------- Ульты: 6-я кнопка, клавиша 6, цена по ресурсу, действие, анимации, миграция старых героев ----------
{
  const U = J(`const out = {};
    for (const c of ${JSON.stringify(CLASSES)}) {
      const H = Game.hero.hero; H.clsKey = c; H.cls = GCLS[c].name; H.mastery = 3; H.level = 15;
      const as = heroAbils(H), i = as.findIndex(a => a.ult), a = as[i];
      out[c] = { i, n: as.length, key6: abIdxByKey(H, 5) === i, key5: abIdxByKey(H, 4), cost: a.cost, max: abResMax(H), keyn: abKeyN(a, i), snd: !!ABIL_SND[a.k], col: !!ABIL_COL[a.k] };
    }
    return out;`);
  for (const c of CLASSES) {
    const u = U[c];
    ok(u.i === u.n - 1 && u.key6 && u.keyn === '6', `${c}: ульта не на шестой кнопке / клавише 6: ` + JSON.stringify(u));
    ok(u.cost <= u.max, `${c}: цена ульты ${u.cost} больше запаса ресурса ${u.max} на 15 уровне`);
    ok(u.snd && u.col, `${c}: у ульты нет звука или цвета`);
    ok(u.key5 < 0 || u.key5 < u.n - 1, `${c}: клавиша 5 попадает на ульту`);
  }
  // панель: до шести кнопок, ульта последней и выделена
  const bar = J(`const out = {}; const h = Game.hero, H = h.hero;
    for (const c of ['mage', 'barbarian']) { H.clsKey = c; H.level = 15; H.abCd = {}; const html = abBarHTML(abBarState()); out[c] = { b: (html.match(/data-ab="/g) || []).length, ult: /class="[^"]*\\bult\\b[^"]*" data-ab="\\d"/.test(html), six: html.includes('>6</i>') }; }
    return out;`);
  ok(bar.mage.b === 6 && bar.mage.ult && bar.mage.six, 'панель мага не на 6 кнопок с ультой: ' + JSON.stringify(bar.mage));
  ok(bar.barbarian.b === 5 && bar.barbarian.ult && bar.barbarian.six, 'панель варвара: 4 обычных + ульта: ' + JSON.stringify(bar.barbarian));
  // ульта закрыта до 13 уровня
  setup('mage', 12);
  spawnSkels(2);
  ok(!J(`return heroAbilityFor(Game.hero, 5);`), 'ульта мага сработала на 12 уровне');
  sim.h.run('Game.skels = [];');
  // на 15 уровне: действие, цена, длинная перезарядка, повторно нельзя, вспышка
  for (const c of CLASSES) {
    setup(c, 15);
    spawnSkels(3);
    const r = J(`const h = Game.hero, H = h.hero, i = heroAbils(H).length - 1, a = heroAbils(H)[i];
      H.mana = hmMax(H); H.rs = abResMax(H); const before = abResGet(H);
      const done = heroAbilityFor(h, i);
      return { done, spent: before - abResGet(H), cd: ((H.abCd[a.k] || 0) - Game.time), again: heroAbilityFor(h, i), fx: !!h.abbu && h.abbu.k === a.k, zones: (Game.abz || []).map(z => z.k) };`);
    ok(r.done, `${c}: ульта не сработала рядом со скелетами`);
    ok(r.done && Math.abs(r.spent - U[c].cost) < 1.5, `${c}: ульта потратила ${r.spent}, цена ${U[c].cost}`);
    ok(r.done && r.cd >= 170, `${c}: перезарядка ульты ${Math.round(r.cd)} с слишком мала`);
    ok(!r.again, `${c}: ульта сработала дважды подряд`);
    ok(r.done && r.fx, `${c}: нет вспышки ульты (abbu)`);
    if (c === 'mage') ok(r.zones.includes('meteor'), 'маг: метеориты не появились');
    if (c === 'druid') ok(r.zones.includes('grove'), 'друид: роща не появилась');
    if (c === 'paladin') ok(r.zones.includes('sun'), 'паладин: солнце не появилось');
    if (c === 'priest' || c === 'rogue') { const left = J(`return Game.skels.filter(s => s.state !== 'dead').length;`); ok(left < 3, `${c}: ульта не тронула скелетов (${left} из 3)`); }
    S.runFor(sim, 1, 1, () => {});
    sim.h.run('Game.skels = []; Game.abz = [];');
  }
  // метеориты и солнце действуют по времени и сами исчезают
  for (const c of ['mage', 'paladin']) {
    setup(c, 15);
    spawnSkels(3);
    sim.h.run(`Game.hero.hero.mana = hmMax(Game.hero.hero); Game.hero.hero.rs = abResMax(Game.hero.hero); heroAbilityFor(Game.hero, heroAbils(Game.hero.hero).length - 1);`);
    for (let k = 0; k < 28; k++) sim.h.run('Game.time += 0.5; abZoneTick(0.5);');
    const left = J(`return { alive: Game.skels.filter(s => s.state !== 'dead').length, zones: (Game.abz || []).length };`);
    ok(left.alive < 3, `${c}: зона ульты не убила ни одного скелета из трёх (${left.alive})`);
    ok(left.zones === 0, `${c}: зона ульты не исчезла по времени (${left.zones})`);
    sim.h.run('Game.skels = []; Game.abz = [];');
  }
  // рисование: все вспышки, ауры и зоны рисуются без исключений (холст-пустышка)
  const dr = J(`const ctx = new Proxy({}, { get(t, k) { if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} }); return t[k] || function () {}; }, set(t, k, v) { t[k] = v; return true; } });
    let n = 0; const u = { x: 20, y: 20, face: 1, abfx: null };
    for (const k in ULT_BURST) for (const p of [0, 0.5, 0.99]) { drawAbilBurst(ctx, u, k, p); n++; }
    for (const k in ULT_AURA) { drawAbilAura(ctx, u, k, 1, 5); drawAbilAura(ctx, u, k, 1, 0.5); n++; }
    for (const k of ['meteor', 'grove', 'sun']) for (const t of [0, 1, 3, 5.9]) { abDrawZone(ctx, { k, x: 20, y: 20, r: 4, s: 0, until: 6, n: 0 }, t); n++; }
    return n;`);
  ok(dr > 20, 'рисование ульт не прогнало все кадры: ' + dr);
  // русский и английский текст у каждой ульты, значок 12×12 (16×16 с контуром)
  const dict = {};
  new Function('I18N', require('fs').readFileSync(require('path').join(__dirname, '..', 'js', 'i18n', 'en-abil.js'), 'utf8'))({ add: (l, d) => Object.assign(dict, d) });
  const en = J(`const out = []; for (const c in HERO_ABIL) for (const a of HERO_ABIL[c]) if (a.ult) out.push([a.name, a.desc, ABIL_ICON[a.k] ? ABIL_ICON[a.k].length : 0]); return out;`);
  const bad = en.filter(r => !dict[r[0]] || !dict[r[1]] || /[А-Яа-яЁё]/.test(dict[r[0]] + dict[r[1]]) || r[2] !== 13);
  ok(en.length === 10 && !bad.length, 'ульты без английского текста или значка: ' + JSON.stringify(bad.map(b => b[0])));
  // старый герой (abV 2): получает ульту готовой, ничего не теряет
  setup('warrior', 14);
  const old = J(`const h = Game.hero, H = h.hero; H.abV = 2; H.abCd = { bash: Game.time + 3 }; H.abT = {}; abMigrate(h);
    const a = heroAbils(H).find(x => x.ult); return { v: H.abV, bash: H.abCd.bash > Game.time, ready: abReady(H, a) };`);
  ok(old.v === 3 && old.bash && old.ready, 'старый герой не получил ульту или потерял перезарядку: ' + JSON.stringify(old));
}

// ---------- Кооп: сервер применяет способность, игроку уходит ресурс ----------
const srv = S.newSim(9, { coop: true });
const R = code => JSON.parse(srv.h.run(`JSON.stringify((() => { ${code} })())`));
srv.h.run(`coopJoin('страж', JSON.stringify({ cls: 'warrior' })); coopJoin('маг', JSON.stringify({ cls: 'mage' }))`);
S.runFor(srv, 6, 3, () => {});
srv.h.run('isNightNow = function () { return true; };');
const co = R(`const m = coop.players.get('маг'), w = coop.players.get('страж'); w.hero.hp = w.hero.maxhp * 0.5; w.hero.campCd = 0; m.hero.level = 6; m.hero.abCd = {}; m.hero.mana = 60;
  const why = abFoes(w, 8).length; coopCmd('страж', JSON.stringify({ t: 'camp' }), false); const camp = w.cmd && w.cmd.kind;
  m.x = w.x + 20; skelRise(m.x + 1, m.y); const s = Game.skels[Game.skels.length - 1]; s.state = 'roam'; s.k = 1;
  coopCmd('маг', JSON.stringify({ t: 'abil', i: 2 }), false);
  coopCmd('маг', JSON.stringify({ t: 'abil', i: 99 }), false);
  return { cd: (m.abcd || {}).frost > Game.time, rs: m.rs, rsm: m.rsm, camp, why, ex: COOP_UNIT_EX.includes('rs') };`);
S.runFor(srv, 6, 3, () => {});
ok(co.cd && co.rs != null && co.rsm > 0 && co.ex, 'кооп: способность или ресурс не дошли: ' + JSON.stringify(co));
const cu = R(`const m = coop.players.get('маг'); m.hero.level = 15; m.hero.abCd = {}; m.hero.mana = hmMax(m.hero); m.x = coop.players.get('страж').x + 25; skelRise(m.x + 1, m.y); const s = Game.skels[Game.skels.length - 1]; s.state = 'roam'; s.k = 1;
  coopCmd('маг', JSON.stringify({ t: 'abil', i: 5 }), false);
  const z = (coopMirror().abz || []).find(z => z.k === 'meteor');
  return { cd: (m.abcd || {}).ult_mage > Game.time, z: z ? { s: typeof z.s, x: typeof z.x } : null };`);
ok(cu.cd && cu.z && cu.z.s === 'number', 'кооп: ульта мага не сработала или зона не ушла игрокам: ' + JSON.stringify(cu));
ok(co.camp === 'camp', 'кооп: привал не начался: ' + JSON.stringify(co));
const mz = R(`const m = coop.players.get('маг'); Game.abz.push({ k: 'holy', own: m.id, x: m.x, y: m.y, r: 3, until: Game.time + 5, tick: 0 });
  const z = (coopMirror().abz || []).find(z => z.k === 'holy'); return { n: z ? 1 : 0, own: z && 'own' in z };`);
ok(mz.n === 1 && !mz.own, 'кооп: зоны способностей не уходят игрокам в зеркале мира: ' + JSON.stringify(mz));
ok(!srv.errors.length, 'кооп: исключения: ' + srv.errors.slice(0, 3).join(' | '));

ok(!sim.errors.length, 'исключения: ' + sim.errors.slice(0, 3).join(' | '));
const inv = S.checkInvariants(sim, 'способности'); for (const p of inv.problems) ok(false, p);
console.log(fails.length ? `Проверка способностей: провалов ${fails.length}` : 'Проверка способностей: всё в порядке');
process.exit(fails.length ? 1 : 0);
