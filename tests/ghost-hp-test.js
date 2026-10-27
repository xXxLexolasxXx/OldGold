'use strict';
// Призраки смертны (js/world/ghosts.js, ghostfight.js; жалоба тестера 261026-2235-c649): у призрака есть здоровье и полоса,
// его можно одолеть и получить опыт; святые силы (молитва, изгнание нежити, оберег, освящение) снимают ровно половину
// здоровья всем в зоне, а не прогоняют; с одного удара оружием не умирает; раненый может удрать; призраков выходит меньше.
// Запуск: node tests/ghost-hp-test.js
const S = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

const sim = S.newSim(23);
const J = code => JSON.parse(sim.h.run(`JSON.stringify((() => { ${code} })())`));
S.runFor(sim, 10, 10, () => {});
const atNight = (n, p = 360) => sim.h.run(`{ let t = 0; for (let k = 0; k < ${n}; k++) t += cycleAt(t).nl === NIGHT_LEN ? CYCLE : CYCLE + LONG_EXTRA; Game.time = t + ${p}; }`);
sim.h.run('skelReact = function () {};');
const FAR = J(`for (let k = 0; k < 6000; k++) { const x = 8 + Math.floor(Math.random() * (MAP_W - 16)), y = 8 + Math.floor(Math.random() * (MAP_H - 16));
  if (isWalkable(x, y) && isWalkable(x + 3, y) && !nearBonfire(x, y, 16) && !foesNear(x + 0.5, y + 0.5, 14).length) return [x, y]; } return null;`);
ok(FAR, 'не нашлось места вдали от костра');
const setup = (cls, lvl) => sim.h.run(`{ const h = Game.hero, H = h.hero; heroStopUnit(h); h.x = ${FAR[0]} + 0.5; h.y = ${FAR[1]} + 0.5; h.brk = null;
  for (const a of Game.animals) if (Math.hypot(a.x - h.x, a.y - h.y) < 15) a.x += 40;
  for (const N of Game.neutrals || []) if (Math.hypot(N.x - h.x, N.y - h.y) < 15) N.x += 40;
  Game.skels = []; Game.ents = []; Game.ghosts = []; Game.abz = []; if (Game.fairy2) Game.fairy2.ban = [];
  H.clsKey = '${cls}'; H.cls = GCLS['${cls}'].name; H.mastery = 3; H.level = ${lvl}; H.maxhp = hlMaxHp(H); H.hp = H.maxhp; H.abCd = {}; H.abT = {};
  H.downT = 0; H.stunUntil = 0; H.drunkUntil = 0; H.rs = abResKind(H) === 'rage' ? 100 : abResMax(H); if (abResKind(H) === 'mana') H.mana = abResMax(H); h.cmd = null; h.ghostCD = 0; h.exoUntil = 0; }`);
const ghost = (dx, dy = 0, extra = '') => sim.h.run(`{ const h = Game.hero, x = h.x + ${dx}, y = h.y + ${dy};
  Game.ghosts.push(ghInit(Object.assign({ x, y, hx: x, hy: y, alpha: 1, ph: 0, face: 1, rev: true, fromGy: true, mode: 'drift', modeT: 0, tx: x, ty: y, retarget: 0, scan: 0 }, { ${extra} }))); }`);
const cast = k => J(`const h = Game.hero, as = heroAbils(h.hero), i = as.findIndex(a => a.k === '${k}'); h.hero.abCd = {}; h.hero.rs = abResMax(h.hero); if (abResKind(h.hero) === 'mana') h.hero.mana = abResMax(h.hero); return heroAbilityFor(h, i);`);
const HALF = `g => !g.slain && g.mode !== 'leave' && g.hp === g.mhp - Math.ceil(g.mhp / 2)`;

// ---------- 1. Здоровье: есть с рождения, растёт с ночами до потолка ----------
atNight(2); setup('warrior', 3);
const hp = J(`Game.ghosts = []; Game.lostGnomes = 0; ghostsSpawn(1); const g = Game.ghosts[0]; return g && { hp: g.hp, mhp: g.mhp, max2: ghMaxHp() };`);
ok(hp && hp.mhp > 0 && hp.hp === hp.mhp, 'у нового призрака нет здоровья: ' + JSON.stringify(hp));
atNight(40); ok(J(`return ghMaxHp();`) === J(`return GH.HP_MAX;`), 'здоровье призрака не упирается в потолок');
ok(hp && hp.mhp < J(`return GH.HP_MAX;`), 'на второй ночи призрак уже с потолочным здоровьем');

// ---------- 2. Не с одного удара: самый сильный обычный удар героя 3-го уровня не убивает ----------
atNight(2); setup('warrior', 3);
const one = J(`return { dmg: neuDamageOf(Game.hero) * 1.25, mhp: ghMaxHp() };`);
ok(one.dmg < one.mhp, 'призрак умирает с одного удара: ' + JSON.stringify(one));
ok(one.dmg * 6 > one.mhp, 'призрак слишком крепкий — больше шести ударов: ' + JSON.stringify(one));

// ---------- 3. Святая сила — ровно половина, второй раз — развеян, опыт и запись в журнале ----------
atNight(2); setup('warrior', 3); ghost(1.5);
const holy = J(`const g = Game.ghosts[0], h = Game.hero, xp0 = h.hero.cxp || 0; ghHoly(g, h, 'test'); const a = { hp: g.hp, mhp: g.mhp, slain: !!g.slain };
  ghHoly(g, h, 'test'); return { a, slain2: !!g.slain, mode: g.mode, xp: (h.hero.cxp || 0) - xp0, log: Game.log.some(e => /развеял призрака/.test(e.text || e.t || e)) };`);
ok(!holy.a.slain && holy.a.hp === holy.a.mhp - Math.ceil(holy.a.mhp / 2), 'первая святая сила — не половина: ' + JSON.stringify(holy.a));
ok(holy.slain2 && holy.mode === 'leave', 'вторая святая сила не развеяла призрака: ' + JSON.stringify(holy));
ok(holy.xp >= J(`return GH.XP;`), 'за развеянного призрака нет опыта: ' + holy.xp);
ok(holy.log, 'нет записи в журнале о развеянном призраке');

// ---------- 4. Изгнание нежити: половина всем в зоне сразу; второе — все развеяны ----------
atNight(3); setup('priest', 10); ghost(2); ghost(-2.5, 1); ghost(1, -2); ghost(9);
const t1 = cast('turn');
const turn = J(`const near = Game.ghosts.slice(0, 3), far = Game.ghosts[3]; return { near: near.every(${HALF}), far: far.hp === far.mhp };`);
ok(t1 === true, 'изгнание нежити рядом с призраками не сработало');
ok(turn.near, 'изгнание нежити: призракам в зоне не ровно половина здоровья');
ok(turn.far, 'изгнание нежити задело призрака вне зоны');
const xp0 = J(`return Game.hero.hero.cxp || 0;`);
cast('turn');
ok(J(`return Game.ghosts.slice(0, 3).every(g => g.slain);`), 'второе изгнание нежити не развеяло раненых призраков');
ok(J(`return Game.hero.hero.cxp || 0;`) - xp0 >= 3 * J(`return GH.XP;`), 'за трёх развеянных изгнанием нет опыта');

// ---------- 5. Оберег и «Чудо» — тоже половина, не прогоняют ----------
atNight(2); setup('mage', 5); ghost(3); ghost(-4);
cast('ward');
ok(J(`return Game.ghosts.every(${HALF});`), 'оберег мага: не половина здоровья — ' + JSON.stringify(J(`return Game.ghosts.map(g => [g.hp, g.mhp, g.mode]);`)));
atNight(2); setup('priest', 15); ghost(3); ghost(-4, 1);
const up = cast('ult_priest');
ok(up !== false && J(`return Game.ghosts.every(${HALF});`), '«Чудо»: не половина здоровья — ' + JSON.stringify(J(`return Game.ghosts.map(g => [g.hp, g.mhp, g.mode]);`)));

// ---------- 6. Освящённая земля паладина: половина один раз, сколько бы ни стоял в ней ----------
atNight(2); setup('paladin', 8); ghost(1.2);
cast('consecrate');
S.stepN(sim, 20 * 6);
const cz = J(`const g = Game.ghosts[0]; return { hp: g.hp, mhp: g.mhp, slain: !!g.slain, half: g.mhp - Math.ceil(g.mhp / 2) };`);
ok(!cz.slain && cz.hp >= cz.half - 1 && cz.hp < cz.mhp, 'освящённая земля: ' + JSON.stringify(cz));

// ---------- 7. Молитва по клику и бой: призрак развеян, герою опыт ----------
let won = 0, ran = 0;
for (let n = 0; n < 6; n++) {
  atNight(2 + (n % 3), 340 + n * 9); setup('warrior', 3); ghost(3 + (n % 2), n % 2 ? 0.7 : -0.5, '__t: 1');
  const x0 = J(`return Game.hero.hero.cxp || 0;`);
  const c = J(`const g = Game.ghosts[0], c = resolveCmd([Math.floor(g.x), Math.floor(g.y)]); if (c) issueCmd(Game.hero, c); return c && c.kind;`);
  ok(c === 'exorcise', 'клик по призраку — не молитва: ' + c);
  let done = false;
  let fled = false;
  for (let t = 0; t < 60 && !done; t++) { S.stepN(sim, 20); const q = J(`const g = Game.ghosts.find(g => g.__t); return { done: !g || !!g.slain, flee: !!g && g.mode === 'flee' };`); done = q.done; fled = fled || q.flee; }
  const r = J(`const g = Game.ghosts.find(g => g.__t); return { slain: !g || !!g.slain, xp: (Game.hero.hero.cxp || 0) - ${x0} };`);
  if (r.slain && r.xp > 0) won++;
  if (fled) ran++;
  ok(r.slain || fled, `бой ${n}: призрак и не развеян, и не удрал`);
}
console.log(`Проверка: молитвой и боем развеяно ${won} призраков из 6, удирали ${ran}`);
ok(won >= 4, `молитва и бой редко побеждают: ${won} из 6`);

// ---------- 8. Раненый удирает: при меньше 45% здоровья (с везением) бежит прочь от обидчика ----------
atNight(2); setup('warrior', 3); ghost(1.5);
const fl = J(`const g = Game.ghosts[0], h = Game.hero, r = Math.random; Math.random = () => 0; ghHurt(g, h, g.mhp * 0.6, 'steel', 'test'); Math.random = r;
  return { mode: g.mode, d0: Math.hypot(g.x - h.x, g.y - h.y) };`);
ok(fl.mode === 'flee', 'раненый призрак не удирает: ' + fl.mode);
S.stepN(sim, 20 * 3);
ok(J(`const g = Game.ghosts[0], h = Game.hero; return Math.hypot(g.x - h.x, g.y - h.y);`) > fl.d0 + 3, 'удирающий призрак не отдалился от героя');
const healthy = J(`const g = Game.ghosts[0]; return !g.slain && g.hp > 0;`);
ok(healthy, 'удравший призрак погиб сам');

// ---------- 9. Спавн: реже и меньше одновременно ----------
const sp = J(`const r = { avg0: 0, zero: 0, avg8: 0 }, N = 4000; Game.lostGnomes = 0;
  for (let i = 0; i < N; i++) { const n = ghostsWant(); r.avg0 += n / N; if (!n) r.zero++; }
  Game.lostGnomes = 8; for (let i = 0; i < N; i++) r.avg8 += ghostsWant() / N;
  Game.lostGnomes = 0; Game.ghosts = []; ghostsSpawn(20); r.cap0 = Game.ghosts.length;
  Game.lostGnomes = 40; Game.ghosts = []; ghostsSpawn(40); r.capMax = Game.ghosts.length; Game.lostGnomes = 0; Game.ghosts = []; return r;`);
console.log('Проверка: призраков за вечер в среднем ' + sp.avg0.toFixed(2) + ' (было 2), при 8 потерях ' + sp.avg8.toFixed(2) + ' (было 6); разом не больше ' + sp.cap0 + ' (было 4), потолок ' + sp.capMax + ' (было 12)');
ok(sp.avg0 < 1.3, 'призраков выходит не меньше прежнего: ' + sp.avg0);
ok(sp.zero > 4000 * 0.2, 'не бывает пустых вечеров');
ok(sp.avg8 < 4, 'при потерях призраков всё так же много: ' + sp.avg8);
ok(sp.cap0 <= 3 && sp.capMax <= 6, 'одновременно призраков больше прежнего потолка: ' + JSON.stringify(sp));
ok(J(`return START_GRACE.firstGhosts;`) <= 1, 'в первую ночь всё ещё больше одного призрака');

if (sim.errors.length) for (const e of sim.errors.slice(0, 5)) ok(false, 'исключение: ' + e);
if (fails.length) { console.log(`✗ провалов: ${fails.length}`); process.exit(1); }
console.log('✓ призраки: здоровье и полоса, не с одного удара, святые силы — половина, опыт за победу, раненый удирает, выходят реже');
process.exit(0);
