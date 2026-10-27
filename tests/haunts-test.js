'use strict';
// Места нечисти и прогон мышей (js/world/haunts.js): мышь прогоняется кликом героя, оберегом и стражем (улетает, не гибнет),
// стая возвращается не сразу; колодец заселяет кикимору ИЛИ водяного (не обоих); Полудница зимой не приходит;
// гнёзда мышей и их число зависят от сезона и глубины ночи. Запуск: node tests/haunts-test.js
const S = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

const sim = S.newSim(23);
const J = code => JSON.parse(sim.h.run(`JSON.stringify((() => { ${code} })())`));
S.runFor(sim, 10, 10, () => {});
const atNight = (n, p = 360) => sim.h.run(`{ let t = 0; for (let k = 0; k < ${n}; k++) t += cycleAt(t).nl === NIGHT_LEN ? CYCLE : CYCLE + LONG_EXTRA; Game.time = t + ${p}; }`);
const season = s => sim.h.run(`dilSeason = () => ${s};`);

// ---------- 1. Таблица ----------
ok(J(`return HAUNTS.length >= 8 && HAUNTS.every(h => h.s.length === 4);`), 'HAUNTS: в таблице меньше 8 строк или нет весов по четырём сезонам');
ok(J(`return HAUNTS.some(h => h.place === 'well' && h.who === 'kik') && HAUNTS.some(h => h.place === 'well' && h.who === 'vod') && HAUNTS.some(h => h.place === 'farm' && h.who === 'noon');`), 'нет колодца и поля в таблице');

// ---------- 2. Прогон мыши ----------
const FAR = J(`for (let k = 0; k < 6000; k++) { const x = 8 + Math.floor(Math.random() * (MAP_W - 16)), y = 8 + Math.floor(Math.random() * (MAP_H - 16));
  if (isWalkable(x, y) && isWalkable(x + 3, y) && !nearBonfire(x, y, 16) && !foesNear(x + 0.5, y + 0.5, 14).length) return [x, y]; } return null;`);
ok(FAR, 'не нашлось места вдали от костра');
const setup = () => sim.h.run(`{ const h = Game.hero, H = h.hero; heroStopUnit(h); h.x = ${FAR[0]} + 0.5; h.y = ${FAR[1]} + 0.5; h.brk = null;
  for (const a of Game.animals) if (Math.hypot(a.x - h.x, a.y - h.y) < 15) a.x += 40;
  for (const N of Game.neutrals || []) if (Math.hypot(N.x - h.x, N.y - h.y) < 15) N.x += 40;
  Game.skels = []; Game.ents = []; Game.ghosts = []; Game.bats = []; Game.batAway = 0; if (Game.fairy2) Game.fairy2.ban = [];
  H.clsKey = 'priest'; H.cls = GCLS.priest.name; H.mastery = 3; H.level = 10; H.maxhp = hlMaxHp(H); H.hp = H.maxhp; H.abCd = {}; H.abT = {};
  H.downT = 0; H.stunUntil = 0; H.drunkUntil = 0; H.rs = abResKind(H) === 'rage' ? 100 : abResMax(H); if (abResKind(H) === 'mana') H.mana = abResMax(H); h.cmd = null; h.exoUntil = 0; }`);
const bat = (dx, dy = 0) => sim.h.run(`{ const h = Game.hero; Game.bats.push({ x: h.x + ${dx}, y: h.y + ${dy}, z: 30, tx: h.x + ${dx}, ty: h.y + ${dy}, ph: 0, spd: 0.01, retarget: 99, leave: false, cd: 99, face: 1 }); }`);

atNight(2, 340); setup(); bat(2.5, -0.5);
const cmd = J(`const b = Game.bats[0], c = resolveCmd([Math.floor(b.x), Math.floor(b.y)]); if (c) issueCmd(Game.hero, c); return c && c.kind;`);
ok(cmd === 'shoobat', `клик по мыши — не «Прогнать мышь» (${cmd})`);
let gone = false;
for (let t = 0; t < 30 && !gone; t++) { S.stepN(sim, 20); gone = J(`return !Game.bats[0] || Game.bats[0].leave;`); }
ok(gone, 'мышь не прогнана кликом героя');
ok(J(`return Game.batAway > Game.time;`), 'после прогона стая возвращается сразу');
// клик по силуэту (клеткой ниже мыши, она рисуется выше своей точки)
atNight(2, 340); setup(); bat(3, -1);
ok(J(`const b = Game.bats[0], c = resolveCmd([Math.floor(b.x), Math.floor(b.y) + 1]); return !!c && c.kind === 'shoobat';`), 'клик по силуэту мыши не ловится');

// оберег/изгнание: мышь рядом — улетает
atNight(2, 340); setup(); bat(3);
const ab = J(`const h = Game.hero, as = heroAbils(h.hero), i = as.findIndex(a => a.k === 'turn'); const r = heroAbilityFor(h, i); return { r, leave: Game.bats[0].leave };`);
ok(ab.leave, 'изгнание нежити жреца не прогнало мышь: ' + JSON.stringify(ab));

// страж гонит сам, обычный гном — иногда
atNight(2, 340); setup();
let guardN = 0, plain = 0;
const mk = `Game.bats = [{ x: 0, y: 0, z: 30, tx: 0, ty: 0, ph: 0, spd: 1, retarget: 99, leave: false, cd: 99, face: 1 }];`;
for (let n = 0; n < 40; n++) {
  sim.h.run(mk);
  guardN += J(`return batShooTry(Game.bats[0], { type: 'warrior', x: 1, y: 1 }) ? 1 : 0;`);
  sim.h.run(mk);
  plain += J(`return batShooTry(Game.bats[0], { type: 'farmer', x: ${FAR[0]}, y: ${FAR[1]} }) ? 1 : 0;`);
}
console.log(`Проверка: страж прогнал ${guardN} из 40, фермер ${plain} из 40`);
ok(guardN >= 30, `стражи гонят мышь редко: ${guardN} из 40`);
ok(plain >= 3 && plain <= 26, `обычные гномы гонят мышь вне разумного: ${plain} из 40`);

// ---------- 2б. Противодействие: свет, фонарь, потолок ----------
atNight(2, 340); setup();
const light = J(`const h = Game.hero, x = Math.floor(h.x), y = Math.floor(h.y);
  const far = { type: 'farmer', x: h.x, y: h.y };
  const before = batSafe(far);
  World.obj[idx(x + 1, y)] = { t: 'lamp' };
  const lamp = batSafe(far), lit = !!batLitAt(h.x, h.y);
  World.obj[idx(x + 1, y)].out = true;
  const outLamp = batSafe(far);
  World.obj[idx(x + 1, y)] = null;
  return { before, lamp, lit, outLamp };`);
ok(!light.before, 'гном в темноте уже «в безопасности»: ' + JSON.stringify(light));
ok(light.lamp && light.lit, 'уличный фонарь не защищает от мышей: ' + JSON.stringify(light));
ok(!light.outLamp, 'погасший фонарь всё ещё защищает');
const bonf = J(`const b = Game.buildings.find(b => b.type === 'bonfire' && b.state === 'done'); if (!b) return null; return batSafe({ type: 'farmer', x: b.doorX + 1.5, y: b.doorY + 1.5 });`);
ok(bonf !== false, 'у костра гнома пугает мышь');
// фонарь в руке: большинство налётов мимо
let lan = 0;
for (let n = 0; n < 60; n++) lan += J(`return batSafe({ type: 'farmer', x: ${FAR[0]} + 0.5, y: ${FAR[1]} + 0.5, lantern: true }) ? 1 : 0;`);
console.log(`Проверка: с фонарём в руке мышь отступила ${lan} из 60`);
ok(lan >= 25 && lan <= 50, `фонарь в руке защищает вне разумного: ${lan} из 60`);
// мышь в свету отворачивает
{
  const r = J(`const h = Game.hero, x = Math.floor(h.x), y = Math.floor(h.y); World.obj[idx(x, y)] = { t: 'lamp' };
    const b = { x: h.x + 1, y: h.y, tx: h.x, ty: h.y, litCD: 0 }; batAvoidLight(b); World.obj[idx(x, y)] = null;
    return { away: Math.hypot(b.tx - h.x, b.ty - h.y) > 5 };`);
  ok(r.away, 'мышь в свете фонаря не отворачивает');
}
// потолок: даже в глубокую долгую ночь с гнёздами — не больше четырёх
season(1); atNight(30, 340); sim.h.run(`Game.buildings.push(new Building('graveyard', 40, 40, true));`);
ok(J(`return batCap();`) <= 4, 'мышей больше четырёх');
sim.h.run(`Game.buildings.pop();`);
// подсказка один раз
const hint = J(`Game.batHint = false; const said = []; const _t = toast; toast = m => said.push(m); batHint(); batHint(); toast = _t; return said.length;`);
ok(hint === 1, 'подсказка про мышей не одна: ' + hint);

// ---------- 3. Спавн мышей: сезон и ночь ----------
season(1); atNight(1, 340); const capSummer1 = J(`return batCap();`);
atNight(8, 340); const capSummer8 = J(`return batCap();`);
season(3); const capWinter8 = J(`return batCap();`);
ok(capSummer8 >= capSummer1, `к 8-й ночи мышей не больше (${capSummer1} → ${capSummer8})`);
ok(capWinter8 < capSummer8, `зимой мышей не меньше, чем летом (${capWinter8} vs ${capSummer8})`);
season(1);
sim.h.run(`Game.buildings.push(new Building('graveyard', 40, 40, true));`);
const sp = J(`const r = hnRoosts(); const p = batSpawnPoint(Game.units[0].x, Game.units[0].y); return { n: r.length, roost: p.roost };`);
ok(sp.n >= 1 && sp.roost === 'graveyard', 'мыши не вылетают с кладбища: ' + JSON.stringify(sp));
sim.h.run(`Game.buildings.pop();`);

// ---------- 4. Колодец: кикимора ИЛИ водяной ----------
season(2); atNight(3, 340);
sim.h.run(`{ Game.fairy2 = null; for (const b of Game.buildings.filter(b => b.type === 'well')) b.removed = true; }`);
J(`for (let i = 0; i < 2; i++) Game.buildings.push(new Building('well', 30 + i * 12, 30, true)); return 0;`);
const who = J(`return hnWells().map(b => hnWellWho(b));`);
ok(who.length === 2, 'колодцы не найдены');
let sawK = 0, sawV = 0, both = 0;
for (let n = 0; n < 60; n++) {
  const r = J(`const F = fz(); F.kik = []; F.wp = []; F.pond = null; hnSpawnWells(F); return { k: F.kik.filter(k => k.well).length, v: F.wp.length, ids: F.kik.filter(k => k.well).map(k => k.well).concat(F.wp.map(p => p.well)) };`);
  sawK += r.k; sawV += r.v;
  if (new Set(r.ids).size !== r.ids.length) both++;
}
console.log(`Проверка: за 60 ночей колодцы дали кикимор ${sawK}, водяных ${sawV}`);
ok(both === 0, 'в одном колодце поселились оба');
ok(sawK + sawV > 20, 'колодцы почти не заселяются');
ok(J(`return hnWells().every(b => hnWellWho(b) === hnWellWho(b));`), 'колодец меняет жильца');
// шаги ночи с колодезными жильцами — без исключений
sim.h.run(`{ const F = fz(); F.kik = []; F.wp = []; hnSpawnWells(F); F.over = false; }`);
S.stepN(sim, 20 * 30);
ok(sim.errors.length === 0, 'исключения в шагах: ' + sim.errors.slice(0, 2).join(' | '));
ok(J(`return (fz().wp || []).every(p => p.vod.alpha >= 0 && p.vod.alpha <= 1);`), 'водяной колодца с кривой видимостью');

// ---------- 5. Полудница ----------
season(3);
ok(J(`return hauntW('farm', 'noon') === 0;`), 'зимой Полудница возможна');
season(1);
ok(J(`return hauntW('farm', 'noon') === 1;`), 'летом Полудница не в полную силу');

// ---------- 6. Обычная ночь без ошибок ----------
sim.h.run(`for (const b of Game.buildings.filter(b => b.type === 'well')) b.removed = true;`);
season(1); atNight(3, 300); sim.h.run(`Game.bats = []; Game.batAway = 0;`);
S.stepN(sim, 20 * 120);
ok(sim.errors.length === 0, 'исключения за ночь: ' + sim.errors.slice(0, 2).join(' | '));

if (fails.length) { console.log(`✗ haunts-test: ${fails.length} ошибок`); process.exit(1); }
console.log('✓ haunts-test');
process.exit(0);
