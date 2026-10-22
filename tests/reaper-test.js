'use strict';
// Жнец смертен (js/world/reaperfight.js): здоровье по ночам, стихии урона, фазы, изгнание «сопротивляется» и ранит светом,
// рассвет уводит недобитого, победа даёт золото, опыт и передышку, сейв, поля для коопа, нетронутый жнец — не цель отряда.
// Баланс: бои героя 1/6/12 уровня трёх классов с жнецом 3-й и 7-й ночи — одному новичку трудно, опытному по силам.
// Запуск: node tests/reaper-test.js            (быстро: без замера баланса — node tests/reaper-test.js --quick)
const S = require('./lib/sim');
const QUICK = process.argv.includes('--quick');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

const sim = S.newSim(13);
const J = code => JSON.parse(sim.h.run(`JSON.stringify((() => { ${code} })())`));
S.runFor(sim, 10, 10, () => {});

// глубокая ночь номер n (0 — первая), p — секунда суток
const atNight = (n, p = 335) => sim.h.run(`{ let t = 0; for (let k = 0; k < ${n}; k++) t += cycleAt(t).nl === NIGHT_LEN ? CYCLE : CYCLE + LONG_EXTRA; Game.time = t + ${p}; }`);
// место подальше от костра и врагов
const FAR = J(`for (let k = 0; k < 6000; k++) { const x = 8 + Math.floor(Math.random() * (MAP_W - 16)), y = 8 + Math.floor(Math.random() * (MAP_H - 16));
  if (isWalkable(x, y) && isWalkable(x + 2, y) && !nearBonfire(x, y, 16) && !foesNear(x + 0.5, y + 0.5, 14).length) return [x, y]; } return null;`);
ok(FAR, 'не нашлось места вдали от костра');
// бой один на один: тёмные феи (блуждающие огни, банши) и скелеты в замер не вмешиваются; падение героя ловим в hlHurt
sim.h.run(`skelReact = function () {}; if (typeof fairy2Tick === 'function') fairy2Tick = function () {};
  globalThis.__dn = 0; { const _h = hlHurt; hlHurt = function (u, n, w) { _h(u, n, w); if (u === Game.hero && u.hero.hp <= 0) __dn++; }; }`);
const setup = (cls, lvl) => sim.h.run(`{ const h = Game.hero, H = h.hero; heroStopUnit(h); h.x = ${FAR[0]} + 0.5; h.y = ${FAR[1]} + 0.5;
  for (const a of Game.animals) if ((a.kind === 'wolf' || a.kind === 'fox') && Math.hypot(a.x - h.x, a.y - h.y) < 15) a.x += 40;
  for (const N of Game.neutrals || []) if (Math.hypot(N.x - h.x, N.y - h.y) < 15) N.x += 40;
  Game.skels = []; Game.ents = []; Game.ghosts = [];
  H.clsKey = '${cls}'; H.cls = GCLS['${cls}'].name; H.mastery = 3; H.level = ${lvl};
  H.maxhp = hlMaxHp(H); H.hp = H.maxhp; H.abCd = {}; H.abT = {}; H.abNext = 0; H.downT = 0; H.stunUntil = 0; H.drunkUntil = 0; H.weakUntil = 0;
  if (typeof hmMax === 'function') H.mana = hmMax(H); H.rs = abResKind(H) === 'rage' ? 100 : abResMax(H); h.inside = null; h.cmd = null; }`);
const spawnReaper = (dx = 2) => J(`const h = Game.hero, x = h.x + ${dx}, y = h.y;
  Game.ghosts.push({ kind: 'reaper', x, y, hx: x, hy: y, alpha: 1, ph: 0, face: 1, rev: true, appear: 0.95, fromGy: true, mode: 'drift', modeT: 0, tx: x, ty: y, retarget: 9, scan: 9, sweepCD: 0, var: 0 });
  const g = Game.ghosts[Game.ghosts.length - 1]; rpInit(g); return { mhp: g.mhp, hp: g.hp };`);
const R = () => J(`const g = Game.ghosts.find(g => g.kind === 'reaper'); return g ? { hp: g.hp, mhp: g.mhp, ph: g.ph3, slain: !!g.slain, mode: g.mode, prov: rpProv(g), alpha: g.alpha } : null;`);

// ---------- Здоровье по ночам ----------
atNight(2); setup('warrior', 5);
const r3 = spawnReaper();
ok(r3.mhp === 600 && r3.hp === 600, `жнец 3-й ночи: здоровье ${r3.mhp} (ждём 600)`);
atNight(6); sim.h.run('Game.ghosts = [];');
const r7 = spawnReaper();
ok(r7.mhp === 800, `жнец 7-й ночи: здоровье ${r7.mhp} (ждём 800)`);
atNight(30); sim.h.run('Game.ghosts = [];');
ok(spawnReaper().mhp === 1200, 'здоровье жнеца ограничено 1200');

// ---------- Нетронутый жнец — не цель отряда; клик — бой ----------
atNight(2); setup('warrior', 5); spawnReaper(2);
const tgt = J(`const h = Game.hero, g = Game.ghosts[0];
  const far = foesNear(h.x, h.y, 9).some(f => f.kind === 'reaper');
  const click = resolveCmd([Math.floor(g.x), Math.floor(g.y)]);
  return { far, click: click && click.kind, label: click && click.label, abil: abFoes(h, 9).some(f => f.kind === 'reaper') };`);
ok(!tgt.far, 'нетронутого жнеца видно в foesNear — рекруты полезут сами');
ok(tgt.click === 'attack' && tgt.label === 'Бой со жнецом', 'клик по жнецу не даёт приказа «Бой со жнецом»: ' + JSON.stringify(tgt));
ok(tgt.abil, 'способности героя не видят жнеца');

// мимоходом (жнеца не трогали) коса бьёт героя по-старому: 5–8
const pass = J(`const h = Game.hero, H = h.hero, g = Game.ghosts[0]; H.hp = H.maxhp; const hp0 = H.hp; g.prov = -99; g.x = h.x + 1; g.y = h.y;
  ghostStrike(g, h); for (let k = 0; k < 30; k++) ghostStrikeTick(g, 0.05); return hp0 - H.hp;`);
ok(pass <= 8.01, 'нетронутый жнец бьёт героя сильнее прежнего: ' + pass);

// ---------- Стихии ----------
const el = J(`const out = {}; for (const e of ['sacred', 'holy', 'fire', 'steel', 'pierce']) { const g = Game.ghosts[0]; g.hp = g.mhp = 1000; g.ph3 = 1; rpHurt(g, Game.hero, 10, e); out[e] = Math.round(1000 - g.hp); } return out;`);
ok(el.sacred === 22 && el.holy === 15 && el.fire === 14 && el.steel === 6 && el.pierce === 5, 'множители стихий: ' + JSON.stringify(el));
ok(R().prov, 'после удара жнец не помнит обидчика');
ok(J(`const h = Game.hero; return foesNear(h.x, h.y, 9).some(f => f.kind === 'reaper');`), 'тронутый жнец не стал врагом для отряда');

// ---------- Фазы ----------
const ph = J(`const g = Game.ghosts[0]; g.mhp = 300; g.hp = 300; g.ph3 = 1; const n0 = Game.ghosts.length;
  rpHurt(g, Game.hero, 110 / 0.6, 'steel'); const p2 = g.ph3; rpHurt(g, Game.hero, 100 / 0.6, 'steel'); return { p2, p3: g.ph3, summoned: Game.ghosts.length - n0 };`);
ok(ph.p2 === 2 && ph.p3 === 3, 'фазы ярости не наступают: ' + JSON.stringify(ph));
ok(ph.summoned === 2, 'в 3-й фазе жнец не позвал двух призраков: ' + ph.summoned);

// ---------- Изгнание: сопротивляется, но ранен светом ----------
for (const [cls, lvl, how] of [['priest', 10, 'turn'], ['mage', 5, 'ward'], ['priest', 13, 'ult_priest']]) {
  atNight(2); setup(cls, lvl); spawnReaper(2.5);
  const res = J(`const h = Game.hero, H = h.hero, as = heroAbils(H), i = as.findIndex(a => a.k === '${how}');
    if (i < 0) return { err: 'нет способности' };
    const g = Game.ghosts.find(g => g.kind === 'reaper'), hp0 = g.hp;
    const r = heroAbilityFor(h, i); return { r, mode: g.mode, dmg: hp0 - g.hp };`);
  ok(res.r && res.mode !== 'leave', `${how}: жнеца прогнало или способность не сработала (${JSON.stringify(res)})`);
  ok(res.dmg > 10, `${how}: святой свет не ранил жнеца (урон ${res.dmg})`);
}
// молитва-изгнание героя (herolife) жнеца не выбирает
ok(J(`const g = Game.ghosts.find(g => g.kind === 'reaper'); return !hlGhostAt([Math.floor(g.x), Math.floor(g.y)]);`), 'молитва героя выбирает жнеца');

// ---------- Оглушение короче ----------
const st = J(`const h = Game.hero, g = Game.ghosts.find(g => g.kind === 'reaper'); abStun({ kind: 'reaper', o: g }, 4, h); return g.abStun - Game.time;`);
ok(st > 1 && st < 1.6, 'оглушение жнеца не втрое короче: ' + st);

// ---------- Рассвет уводит ----------
atNight(2, 335); setup('warrior', 5); spawnReaper(3);
sim.h.run(`{ const g = Game.ghosts[0]; g.hp = g.mhp / 2; }`);
atNight(2, 320 + 220 + 5);          // начало рассвета
S.stepN(sim, 20 * 30);
ok(!J(`return Game.ghosts.some(g => g.kind === 'reaper');`), 'жнец не ушёл с рассветом');

// ---------- Победа: награда, передышка ----------
atNight(2); setup('warrior', 5); spawnReaper(2);
const win = J(`const h = Game.hero, H = h.hero, g = Game.ghosts[0];
  const gold0 = [...Game.piles.values()].reduce((s, p) => s + (p.removed ? 0 : p.stock.gold || 0), 0), xp0 = H.cxp || 0;
  rpHurt(g, h, 99999, 'holy');
  const gold1 = [...Game.piles.values()].reduce((s, p) => s + (p.removed ? 0 : p.stock.gold || 0), 0);
  return { slain: g.slain, alive: foeAlive({ kind: 'reaper', o: g }), gold: gold1 - gold0, xp: (H.cxp || 0) - xp0, n: Game.reaperSlain, rest: Game.reaperRest - nightIndex(), want: reapersWanted() };`);
ok(win.slain && !win.alive, 'жнец не погиб: ' + JSON.stringify(win));
ok(win.gold >= 5, 'нет золота за жнеца: ' + win.gold);
ok(win.xp >= 100, 'герой не получил опыт за жнеца: ' + win.xp);
ok(win.n === 1 && win.rest === 2, 'не записалась победа или передышка: ' + JSON.stringify(win));
ok(win.want === 0, 'после победы жнецы всё равно приходят');
S.stepN(sim, 20 * 6);
ok(!J(`return Game.ghosts.some(g => g.kind === 'reaper');`), 'тело жнеца не растворилось за 6 с');
ok(J(`return Game.log.some(e => /одолел жнеца/.test(e.text || e.t || e));`), 'нет записи в журнале о победе');

// ---------- Сейв ----------
const sv = J(`Game.reaperHint = 1; const s = JSON.parse(JSON.stringify(serializeGame())); resetGameState(); const before = Game.reaperSlain; applySave(s); return { s: s.rp, before, n: Game.reaperSlain, rest: Game.reaperRest, hint: Game.reaperHint };`);
ok(sv.s && sv.n === 1 && sv.rest === win.rest + sv.rest - win.rest && sv.hint === 1 && sv.before === 0, 'сейв жнеца: ' + JSON.stringify(sv));

// ---------- Кооп: поля здоровья уходят клиенту ----------
{
  const srv = S.newSim(41, { coop: true });
  const C = JSON.parse(srv.h.run(`JSON.stringify((() => { const x = MAP_W / 2, y = MAP_H / 2;
    Game.ghosts = [{ kind: 'reaper', x, y, hx: x, hy: y, alpha: 1, ph: 0, face: 1, rev: true, mode: 'drift', modeT: 0, tx: x, ty: y, retarget: 9, scan: 9, var: 0 }];
    rpInit(Game.ghosts[0]); Game.ghosts[0].hp = 77; Game.ghosts[0].ph3 = 2;
    const L = coopList(Game.ghosts); return L[0] ? { hp: L[0].hp, mhp: L[0].mhp, ph3: L[0].ph3 } : null; })())`));
  ok(C && C.hp === 77 && C.mhp > 0 && C.ph3 === 2, 'кооп: здоровье жнеца не уходит клиенту: ' + JSON.stringify(C));
}

// ---------- Баланс: герой один на один ----------
if (!QUICK) {
  const fight = (cls, lvl, night) => {
    atNight(night, 330); setup(cls, lvl); spawnReaper(2.2);
    sim.h.run(`{ __dn = 0; RPF.trace = []; const h = Game.hero, g = Game.ghosts[0]; issueCmd(h, { kind: 'attack', f: { kind: 'reaper', o: g }, tx: Math.floor(g.x), ty: Math.floor(g.y), label: 'Бой со жнецом' }); }`);
    let t = 0, res = 'ничья';
    for (; t < 240; t += 1) {
      S.stepN(sim, 20);
      // герой жмёт способности, как игрок: всё, что готово (кроме ульты на низких уровнях — её нет)
      sim.h.run(`{ const h = Game.hero, H = h.hero, as = heroAbils(H) || []; for (let i = 0; i < as.length; i++) if (abReady(H, as[i]) && !as[i].passive) heroAbilityFor(h, i);
        const g = Game.ghosts[0]; if (g && !g.slain && (!h.cmd || h.cmd.kind !== 'attack') && !(H.hp <= 0)) issueCmd(h, { kind: 'attack', f: { kind: 'reaper', o: g }, tx: Math.floor(g.x), ty: Math.floor(g.y), label: '' }); }`);
      const s = J(`const g = Game.ghosts.find(g => g.kind === 'reaper'), H = Game.hero.hero; return { slain: !g || g.slain, hp: g ? g.hp : 0, down: __dn > 0 || H.hp <= 0 || !!H.downT || Game.hero.dead };`);
      if (s.slain) { res = 'победа'; break; }
      if (s.down) { res = 'поражение'; break; }
    }
    const tr = J(`const a = {}; for (const [s, e, d] of RPF.trace || []) a[s + '/' + e] = Math.round((a[s + '/' + e] || 0) + d); RPF.trace = null; return a;`);
    const st = J(`const H = Game.hero.hero; return { dmg: Math.round(neuDamageOf(Game.hero)), mhp: Math.round(H.maxhp), hp: Math.round(H.hp) };`);
    const left = J(`const g = Game.ghosts.find(g => g.kind === 'reaper'); return g && !g.slain ? Math.round(g.hp / g.mhp * 100) : 0;`);
    return { res, t, left, tr, st };
  };
  const table = {};
  for (const night of [2, 6]) for (const cls of ['warrior', 'priest', 'mage']) for (const lvl of [1, 6, 12]) {
    const r = fight(cls, lvl, night);
    table[`${night + 1}н ${cls} ${lvl}`] = r;
    console.log(`  ночь ${night + 1}, ${cls} ${lvl} ур.: ${r.res} за ${r.t} с${r.res !== 'победа' ? `, у жнеца осталось ${r.left}%` : ''} | герой ${JSON.stringify(r.st)} | ${JSON.stringify(r.tr)}`);
  }
  const w = k => table[k].res === 'победа';
  ok(!w('3н warrior 1') || table['3н warrior 1'].t > 25, 'воин 1 ур. убил жнеца слишком легко: ' + JSON.stringify(table['3н warrior 1']));
  ok(['warrior', 'priest', 'mage'].some(c => w(`3н ${c} 12`)), 'опытный герой 12 ур. не может одолеть жнеца 3-й ночи');
  const wins = Object.values(table).filter(r => r.res === 'победа').length;
  ok(wins >= 2 && wins <= 14, `побед ${wins} из 18 — жнец ${wins < 2 ? 'почти неуязвим' : 'слишком лёгкий'}`);
  console.log(`Проверка: побед героя над жнецом ${wins} из 18`);
}

if (sim.errors.length) for (const e of sim.errors.slice(0, 5)) ok(false, 'исключение: ' + e);
if (fails.length) { console.log(`✗ провалов: ${fails.length}`); process.exit(1); }
console.log('✓ жнец смертен: стихии, фазы, изгнание, рассвет, награда, сейв, кооп' + (QUICK ? '' : ', баланс'));
process.exit(0);
