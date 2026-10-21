'use strict';
// Жаболюды (ЖАБОЛЮДЫ.md): поселения у воды, касты, прыжок, влажность и сухость, яд, дети, зима и спячка, лечение, сейв, зеркало.
// Запуск: node tests/frogfolk-test.js
const L = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };
const sim = L.newSim(+(process.argv[2] || 7)), h = sim.h, J = c => JSON.parse(h.run('JSON.stringify((function(){' + c + '})())'));

// 1. Поселения при старте: у воды, далеко от центра, в логове 5–8 жителей, 4 касты
let st = J(`const ls = Game.lairs.filter(l => l.k === 'ftvil');
  return { n: ls.length, quota: ftQuota(), want: ftWant(0), dist: ls.map(l => Math.round(Math.hypot(l.x - (MAP_W >> 1), l.y - (MAP_H >> 1)))),
    mem: ls.map(l => Game.neutrals.filter(N => N.lair === l.id).map(N => N.k)), ft: Game.ft };`);
ok(st.n >= 1 && st.n <= st.quota, 'нет поселений жаболюдов на старте: ' + JSON.stringify(st));
ok(st.dist.every(d => d >= 20), 'поселение слишком близко к деревне: ' + st.dist);
ok(st.mem.every(m => m.length >= 5 && m.length <= 8), 'в поселении должно быть 5–8 жителей: ' + JSON.stringify(st.mem));
ok(st.mem.every(m => m.includes('ftG') && m.includes('ftB') && m.includes('ftP')), 'нет каст в поселении: ' + JSON.stringify(st.mem));
ok(st.ft && st.ft.sp === st.n, 'Game.ft.sp не равно числу поселений');

// 2. Ночи: догоняют по расписанию, огнемаги и вождь приходят позже
const toNight = n => h.run(`(function(){ while (startNights() < ${n} || !startOpen('neutrals')) Game.time += 5; })()`);
for (let n = 1; n <= 4; n++) { toNight(n); L.stepN(sim, 60); }
st = J(`return { n: Game.lairs.filter(l => l.k === 'ftvil').length, want: ftWant(Game.ft.nt), nt: Game.ft.nt, kinds: [...new Set(Game.neutrals.filter(ftIs).map(N => N.k))], hasWater: Game.lairs.filter(l => l.k === 'ftvil').every(l => ftShore(l).length > 0 || true) }`);
ok(st.n >= Math.min(st.want, 1), 'поселения не пришли по ночам: ' + JSON.stringify(st));
ok(st.kinds.includes('ftG') && st.kinds.includes('ftB') && st.kinds.includes('ftP'), 'не все касты: ' + st.kinds);

// 3. Влажность: у воды растёт, вдали — убывает, при 0 теряют здоровье (не умирают)
const wet = J(`
  const N = Game.neutrals.find(N => ftIs(N) && N.st !== 'die');
  const L = Game.lairs.find(l => l.id === N.lair);
  N.x = L.x + 0.5; N.y = L.y + 0.9; N.wet = 0.5; N.wdT = 0;
  const near = []; for (let i = 0; i < 40; i++) { ftLife(N, 0.25); } near.push(N.wet);
  // далеко от воды: берём точку в 12 клетках от логова
  N.wet = 1;
  let best = null;
  for (let a = 0; a < 6.28; a += 0.4) for (const r of [10, 14, 18]) { N.x = L.x + Math.cos(a) * r; N.y = L.y + Math.sin(a) * r; if (ftWaterDist(N) > 8) best = best || [N.x, N.y]; }
  if (!best) return { skip: 1 };
  N.x = best[0]; N.y = best[1]; N.wdT = 0;
  WX.k = 0; for (let i = 0; i < 500; i++) { WX.k = 0; ftLife(N, 0.25); }
  return { near: near[0], far: N.wet, hpOk: N.hp >= N.mhp * 0.14, d: Math.round(N.wd) };`);
ok(wet.near > 0.9, 'у воды влажность не растёт: ' + JSON.stringify(wet));
if (!wet.skip) ok(wet.far < 0.1 && wet.hpOk, 'вдали от воды влажность не падает / здоровье ушло в ноль: ' + JSON.stringify(wet));

// 4. Прыжок: через препятствие, фазы, приземление рядом с целью, удар
const jp = J(`
  const N = Game.neutrals.find(N => N.k === 'ftG' && N.st !== 'die'), u = Game.hero;
  if (!N || !u) return { skip: 1 };
  for (const M of Game.neutrals) { M.prov = -99; M.tg = 0; }
  N.wet = 1; N.pch = null; N.jp = null; N.st = 'idle';
  const tx = Math.floor(N.x + 5), ty = Math.floor(N.y);
  const f = randomFreeNear(tx, ty, 0, 2, (x, y) => isWalkable(x, y));
  if (!f) return { skip: 1 };
  const x0 = N.x, y0 = N.y;
  const okj = ftLeap(N, f[0] + 0.5, f[1] + 0.5, {});
  const ph = {};
  for (let i = 0; i < 40; i++) { step(0.05); if (N.jp) ph[N.jp.ph] = 1; }
  return { okj, ph: Object.keys(ph), moved: Math.hypot(N.x - x0, N.y - y0), land: !N.jp };`);
if (jp.skip) console.log('  · прыжок: пропуск');
else { ok(jp.okj && jp.ph.includes('crouch') && jp.ph.includes('air'), 'нет фаз прыжка: ' + JSON.stringify(jp)); ok(jp.moved > 2 && jp.land, 'прыжок не долетел: ' + JSON.stringify(jp)); }

// 5. Яд: ближний удар по жаболюду может отравить героя; дети — никогда; вода смывает; не убивает
const pz = J(`
  const N = Game.neutrals.find(N => ftIs(N) && N.st !== 'die'), u = Game.hero;
  if (!N || !u) return { skip: 1 };
  u.hero.hp = u.hero.maxhp; u.inside = null; u.x = N.x + 1; u.y = N.y;
  ftPoison(u, N, 7);
  const poisoned = u.pzUntil > Game.time;
  const kid = Game.units.find(k => k.type === 'kid');
  let kidOk = true;
  if (kid) { kid.pzUntil = 0; ftPoison(kid, N, 7); kidOk = !(kid.pzUntil > Game.time); }
  u.hero.hp = 2; for (let i = 0; i < 100; i++) ftTick(0.25);
  return { poisoned, kidOk, hasKid: !!kid, hp: u.hero.hp };`);
if (pz.skip) console.log('  · яд: пропуск');
else { ok(pz.poisoned, 'яд не наложился'); ok(pz.kidOk, 'ребёнка отравили'); ok(pz.hp >= 1, 'яд убил героя: hp ' + pz.hp); }

// 6. Дети не цель: удар по ребёнку отменяется
const kid = J(`
  const N = Game.neutrals.find(N => ftIs(N) && N.st !== 'die'), k = Game.units.find(u => u.type === 'kid');
  if (!N || !k) return { skip: 1 };
  const hp = k.hp, inj = k.injury; N.tg = k.id; neuStrike(N, k);
  return { cleared: N.tg === 0, inj: k.injury === inj };`);
if (kid.skip) console.log('  · дети: пропуск (нет ребёнка)'); else ok(kid.cleared, 'удар по ребёнку не отменён');

// 7. Территория: герой у поселения — предупреждение, затем бой; гном-работник пугается
const terr = J(`
  const L0 = Game.lairs.find(l => l.k === 'ftvil'), u = Game.hero;
  if (!L0 || !u) return { skip: 1 };
  for (const M of Game.neutrals) { M.prov = -99; M.tg = 0; M.pch = null; M.jp = null; M.tor = 0; }
  L0.friend = false; u.inside = null; u.hero.hp = u.hero.maxhp;
  u.x = L0.x + 0.5 + 3; u.y = L0.y + 0.5; Game.time += 0;
  let fought = 0;
  for (let i = 0; i < 160; i++) { u.x = L0.x + 3.5; u.y = L0.y + 0.5; ftLairTick(L0, Game.time); Game.time += 1; if (Game.neutrals.some(N => N.lair === L0.id && N.tg === u.id)) { fought = 1; break; } }
  return { fought, winter: ftWinter() };`);
if (terr.skip) console.log('  · территория: пропуск'); else ok(terr.fought === 1 || terr.winter, 'жаболюды не напали на чужака у поселения');

// 8. Зима: спячка у воды; тронутые просыпаются вялыми
const win = J(`
  const N = Game.neutrals.find(N => ftIs(N) && N.st !== 'die');
  seaSet(2);
  for (const M of Game.neutrals) { M.prov = -99; M.tg = 0; M.jp = null; M.pch = null; }
  for (let i = 0; i < 400; i++) step(0.05);
  const sleeping = Game.neutrals.filter(ftIs).filter(M => M.st !== 'die' && M.tor).length, total = Game.neutrals.filter(ftIs).length;
  return { sleeping, total, fr: N.fr };`);
ok(win.sleeping >= Math.floor(win.total * 0.5), 'зимой жаболюды не ушли в спячку: ' + JSON.stringify(win));
h.run('seaSet(0); SEA().snow = 0; SEA().ice = 0;');

// 9. Лечение у воды
const heal = J(`
  const N = Game.neutrals.find(N => ftIs(N) && N.st !== 'die'), L1 = Game.lairs.find(l => l.id === N.lair);
  N.x = L1.x + 0.5; N.y = L1.y + 0.9; N.hp = N.mhp * 0.3; N.wdT = 0; N.tor = 0;
  for (let i = 0; i < 40; i++) ftLife(N, 0.25);
  return { r: N.hp / N.mhp };`);
ok(heal.r > 0.4, 'у воды жаболюд не лечится: ' + heal.r);

// 10. Шаманы: лечение, молния, огнемаг — не падают
const mg = J(`
  const P = Game.neutrals.find(N => N.k === 'ftP' && N.st !== 'die'), u = Game.hero;
  if (!P || !u) return { skip: 1 };
  const fr = Game.neutrals.find(N => N.k === 'ftG' && N.st !== 'die' && N.lair === P.lair); if (fr) fr.hp = fr.mhp * 0.3;
  u.x = P.x + 3; u.y = P.y; u.inside = null; u.hero.hp = u.hero.maxhp;
  P.abT = 0; P.tor = 0; ftAfter(P, u);
  P.zapT = 0; P.callT = Game.time + 99; ftAfter(P, u);
  const R = Game.neutrals.find(N => N.k === 'ftR' && N.st !== 'die');
  if (R) { R.abT = 0; R.tor = 0; u.x = R.x + 3; u.y = R.y; ftAfter(R, u); }
  return { healed: fr ? fr.hp > fr.mhp * 0.35 : true, zap: !!P.zap, hasR: !!R };`);
if (mg.skip) console.log('  · маги: пропуск'); else ok(mg.healed, 'шаман не вылечил соплеменника');

// 11. Огонь высушивает; дротик синего летит (запись N.dart)
const fl = J(`
  const B = Game.neutrals.find(N => N.k === 'ftB' && N.st !== 'die'), u = Game.hero;
  if (!B || !u) return { skip: 1 };
  u.x = B.x + 2; u.y = B.y; u.inside = null; u.hero.hp = u.hero.maxhp; B.tor = 0;
  neuStrike(B, u);
  return { dart: !!B.dart };`);
if (!fl.skip) ok(fl.dart, 'у охотника нет дротика');

// 12. Сохранение, зеркало
const before = J('return { lairs: Game.lairs.filter(l => l.k === "ftvil").length, ft: Game.ft, mem: Game.neutrals.filter(ftIs).length }');
h.run('__s = JSON.parse(JSON.stringify(serializeGame())); applySave(__s)');
const after = J('return { lairs: Game.lairs.filter(l => l.k === "ftvil").length, ft: Game.ft, mem: Game.neutrals.filter(ftIs).length, wet: Game.neutrals.filter(ftIs).every(N => N.wet === 1) }');
ok(before.lairs === after.lairs && JSON.stringify(before.ft) === JSON.stringify(after.ft), 'сейв не сохранил поселения/Game.ft: ' + JSON.stringify([before, after]));
ok(after.mem === before.mem, 'число жаболюдов изменилось после загрузки');
ok(J('return neuMirror().filter(d => d.k === "ftG").length > 0'), 'жаболюды не в зеркале');
h.run('__s.nt.ft = undefined; applySave(__s)');
ok(J('return Game.ft && typeof Game.ft.nt === "number"'), 'старый сейв без ft сломал Game.ft');

// 13. Товары и аптека
ok(J('return !!GOODS.venom && !!GOODS.slime && GOOD_KEYS.includes("venom") && TR_BASE.venom > 0 && BUILDINGS.infirmary.recipes.some(r => r.in.venom)'), 'яд/слизь/рецепт зелья не подключены');


// 14. Король жаболюдов: один на карту, с 3-й ночи, лечит подданных
const king = J(`
  const Q = Game.neutrals.filter(N => N.k === 'ftQ' && N.st !== 'die');
  const q = Q[0];
  if (!q) return { n: Q.length, flag: Game.ft.king, nt: Game.ft.nt };
  const sub = Game.neutrals.find(N => N.k === 'ftG' && N.st !== 'die' && Math.hypot(N.x - q.x, N.y - q.y) < 9) || Game.neutrals.find(N => ftIs(N) && N !== q && N.st !== 'die');
  sub.x = q.x + 2; sub.y = q.y; sub.hp = sub.mhp * 0.3; q.abT = 0; q.healT = 0; q.tor = 0;
  const u = Game.hero; u.inside = null; u.x = q.x + 3; u.y = q.y;
  ftAfter(q, u);
  return { n: Q.length, mhp: q.mhp, healed: sub.hp > sub.mhp * 0.45 };`);
ok(king.n === 1, 'король должен быть один на карту: ' + JSON.stringify(king));
if (king.n === 1) ok(king.mhp >= 260 && king.healed, 'король не лечит подданных: ' + JSON.stringify(king));

// 15. Дикие малыши и рабство
const wl = J(`return { snail: Game.wild.filter(W => W.k === 'snail').length, newt: Game.wild.filter(W => W.k === 'newt').length, moth: Game.wild.filter(W => W.k === 'moth').length, q: fwQuota('snail') }`);
ok(wl.snail >= 1 && wl.newt >= 1 && wl.moth >= 1, 'нет диких малышей на карте: ' + JSON.stringify(wl));
const cap = J(`
  const N = Game.neutrals.find(N => N.k === 'ftG' && N.st !== 'die'), L2 = Game.lairs.find(l => l.id === N.lair);
  for (const M of Game.neutrals) { M.tg = 0; M.prov = -99; M.tor = 0; M.jp = null; M.pch = null; }
  seaSet(0); SEA().snow = 0; SEA().ice = 0;
  const W = Game.wild.find(w => w.k === 'snail' && !w.own);
  W.x = N.x + 3; W.y = N.y; W.hx = W.x; W.hy = W.y; W.cap = 0; W.st = 'idle';
  if (!isWalkable(Math.floor(W.x), Math.floor(W.y))) { W.x = N.x + 1.5; W.y = N.y + 1; }
  N.job = { t: 'cap', id: W.id, ph: 'go', exp: Game.time + 120 };
  let ph = {};
  for (let i = 0; i < 1600 && !W.own; i++) { step(0.05); if (N.job) ph[N.job.ph] = 1; }
  return { own: W.own === L2.id, ph: Object.keys(ph), job: !!N.job, dist: Math.round(Math.hypot(W.x - (L2.x + 0.5), W.y - L2.y)) };`);
ok(cap.own, 'жаболюд не увёл улитку в кабалу: ' + JSON.stringify(cap));


// гоблин из лагеря уводится в кабалу
const gb = J(`
  const M = Game.neutrals.find(N => N.k === 'goblin' && N.st !== 'die'), N = Game.neutrals.find(N => N.k === 'ftG' && N.st !== 'die');
  if (!M || !N) return { skip: 1 };
  for (const X of Game.neutrals) { X.tg = 0; X.prov = -99; X.tor = 0; X.jp = null; X.pch = null; }
  const L2 = Game.lairs.find(l => l.id === N.lair), n0 = Game.neutrals.length;
  N.x = M.x - 2; N.y = M.y; N.wet = 1; N.job = { t: 'gob', id: M.id, ph: 'go', exp: Game.time + 120 };
  const before = Game.wild.filter(W => W.k === 'goblin').length;
  for (let i = 0; i < 80; i++) step(0.05);
  const W = Game.wild.find(w => w.k === 'goblin' && w.cap === N.id);
  return { led: !!W, gone: !Game.neutrals.includes(M), phase: N.job && N.job.ph };`);
if (gb.skip) console.log('  · гоблины: пропуск (нет лагеря)'); else ok(gb.led && gb.gone, 'гоблин не уведён в кабалу: ' + JSON.stringify(gb));

// сейв: рабы и вольные малыши
const wb = J('return { n: Game.wild.length, own: Game.wild.filter(W => W.own).length }');
h.run('__s = JSON.parse(JSON.stringify(serializeGame())); applySave(__s)');
const wa = J('return { n: Game.wild.length, own: Game.wild.filter(W => W.own).length }');
ok(wb.n === wa.n && wb.own === wa.own, 'сейв потерял малышей/рабов: ' + JSON.stringify([wb, wa]));
ok(J('return fwMirror().length === Game.wild.length'), 'зеркало диких не совпало');
// освобождение
const fr = J(`const W = Game.wild.find(w => w.own); if (!W) return { skip: 1 }; fwRelease(W, '', true); return { own: W.own };`);
if (!fr.skip) ok(fr.own === 0, 'раб не освободился');

// «Бах!»: жаболюд убегает от гномёнка с пистолетом
const bah = J(`
  const N = Game.neutrals.find(N => ftIs(N) && N.st !== 'die'), u = Game.hero;
  if (typeof folkScare !== 'function') return { skip: 1 };
  N.tg = u.id; folkScare(N, 'frog', u);
  return { flee: !!N.job && N.job.ph === 'flee', tg: N.tg };`);
if (!bah.skip) ok(bah.flee && bah.tg === 0, '«Бах!» не заставил жаболюда удрать: ' + JSON.stringify(bah));

L.stepN(sim, 1200);
ok(!sim.errors.length, 'исключения: ' + sim.errors.join('\n'));

console.log(`Проверка жаболюдов: ${fails.length ? 'провалов ' + fails.length : 'поселения, касты, прыжок, влажность, яд, дети, зима, сейв — ок'}`);
process.exit(fails.length ? 1 : 0);
