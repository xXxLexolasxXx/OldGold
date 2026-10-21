'use strict';
// Шпион Малгора (js/world/traitor.js): летописец Пим догоняет отряд у шпиля, нечисть его не трогает, после второго
// стража ворон приносит письмо — дилемма. «Простить»: Пим в отряде, страж слабее, при пробуждении Малгора — удар
// в спину (гибнет фонарщик), Пим уходит. «Не прощать»: злобный план, падение с края, Малгор слабее. Сейв, эпилог,
// рисование, зеркало для коопа. Запуск: node tests/traitor-test.js
const S = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

function ascent(seed) {
  const sim = S.newSim(seed);
  const J = code => JSON.parse(sim.h.run(`JSON.stringify((() => { ${code} })())`));
  S.runFor(sim, 20, 10, () => {});
  J(`goalNew('scenario'); for (const b of Game.buildings) if (b.isStore()) { b.stock.bread = 40; b.stock.sausage = 10; }
     Game.goal.cuts = []; Game.goal.cut = null; goalStartChapter(GOAL_CHAPTERS.length - 1);
     const H = Game.hero.hero; H.level = 12; H.maxhp = hlMaxHp(H) * 3; H.hp = H.maxhp; spireGo(); return 1;`);
  J(`const L = Game.units.find(u => u.lamp), h = Game.hero; h.x = L.x + 1; h.y = L.y; h.path = null; heroStopUnit(h); return 1;`);
  S.runFor(sim, 4, 4, () => {});
  return { sim, J };
}
// убить стража яруса i (сделку Малгора — отклонить)
const KILL = i => `const G = Game.raiders.find(N => N.gi === ${i} && foeLive(N)); if (G) foeKill(G, Game.hero);
  const c = Game.dil && Game.dil.cur; if (c && /^malgor_deal/.test(c.id)) dilResolve(4, null); return 1;`;
const HEAL = 'const H = Game.hero.hero; H.hp = H.maxhp; Game.hero.food = 1; return 1;';

// ---------- Простить ----------
{
  const { sim, J } = ascent(11);
  const a0 = J(`const P = Game.units.find(u => u.pim), T = Game.foe.tiers, N = Game.raiders.find(N => foeLive(N) && N.k !== 'ftower');
    const hp0 = P && P.hp; if (P) neuHurtUnit(P, 50);
    return { pim: P ? P.pim : 0, type: P && P.type, st: T.as.tr && T.as.tr.st, lamp: T.as.lamp, ign: !N || foeTargetNear({ x: P.x, y: P.y, k: N.k }, 3) !== P, alive: P && !P.dead,
      draw: (() => { try { const c = document.createElement('canvas').getContext('2d'); spyDrawBook(c, P, T.as.tr); return 1; } catch (e) { return String(e).slice(0, 200); } })() };`);
  ok(a0.pim === 1 && a0.type === 'scribe' && a0.st === 'tag' && a0.ign && a0.alive && a0.draw === 1, 'простить: Пим не догнал отряд / его бьют / не рисуется ' + JSON.stringify(a0));
  J(KILL(0)); S.runFor(sim, 3, 3, () => {});
  ok(J(`const T = Game.foe.tiers; return T.as.tr.st === 'tag' && !(Game.dil.cur && Game.dil.cur.id === 'malgor_spy')`), 'простить: письмо пришло раньше второго стража');
  J(KILL(1)); J(HEAL); S.runFor(sim, 4, 4, () => {});
  const a1 = J(`const c = Game.dil.cur; return { id: c && c.id, st: Game.foe.tiers.as.tr.st, av: c ? dilAvail(c) : null, chips: c ? dilChipsOf(DIL_BY_ID.malgor_spy.o[0]) : '' };`);
  ok(a1.id === 'malgor_spy' && a1.st === 'open' && a1.av && a1.av[0] && /в отряд/.test(a1.chips), 'простить: окно-дилемма не открылось ' + JSON.stringify(a1));
  // сейв посреди окна: после загрузки окно вернётся
  J('const s = JSON.parse(JSON.stringify(serializeGame())); applySave(s); return 1;');
  S.runFor(sim, 4, 4, () => {});
  const a2 = J(`const c = Game.dil.cur, P = Game.units.find(u => u.pim); return { id: c && c.id, pim: P ? P.pim : 0 };`);
  ok(a2.id === 'malgor_spy' && a2.pim === 1, 'простить: после загрузки нет окна или Пима ' + JSON.stringify(a2));
  const a3 = J(`const T = Game.foe.tiers, i = T.open, G = Game.raiders.find(N => N.gi === i && foeLive(N)), m0 = G ? G.mhp : 0; const r = dilResolve(0, null);
    const P = Game.units.find(u => u.pim && !u.dead); return { ok: r.ok, st: T.as.tr.st, pim: P ? P.pim : 0, rec: !!(P && P.rec && P.rec.order === 'follow'), wk: T.as.wk[i], m0, m1: G ? G.mhp : 0 };`);
  ok(a3.ok && a3.st === 'forgiven' && a3.pim === 2 && a3.rec && a3.wk === 0.75 && a3.m1 < a3.m0, 'простить: Пим не встал в отряд / страж не ослаб ' + JSON.stringify(a3));
  J('const s = JSON.parse(JSON.stringify(serializeGame())); applySave(s); return 1;');
  const sv = J(`const P = Game.units.find(u => u.pim && !u.dead); return { pim: P ? P.pim : 0, rec: !!(P && P.rec), st: Game.foe.tiers.as.tr.st }`);
  ok(sv.pim === 2 && sv.rec && sv.st === 'forgiven', 'простить: сейв потерял прощёного Пима ' + JSON.stringify(sv));
  // все стражи пали — Малгор проснулся — удар в спину
  for (let k = 0; k < 6; k++) { J(KILL('Game.foe.tiers.open')); J(HEAL); S.runFor(sim, 1, 1, () => {}); }
  J(`const B = spireBoss(), h = Game.hero; if (B) { const p = randomFreeNear(Math.floor(B.x), Math.floor(B.y), 2, 5, (x, y) => isWalkable(x, y)); if (p) { h.x = p[0] + 0.5; h.y = p[1] + 0.5; heroStopUnit(h); } } const H = Game.hero.hero; H.maxhp = 9999; H.hp = 9999; return 1;`);
  const hp0 = J('const B = spireBoss(); return B ? B.hp : 0');
  for (let k = 0; k < 26; k++) { J(HEAL + ';'); S.runFor(sim, 1, 1, () => {}); }
  const a4 = J(`const T = Game.foe.tiers, S = T.as.tr; return { st: S.st, vk: S.vk, lamp: T.as.lamp, pimLeft: Game.units.filter(u => u.pim && !u.dead).length, fallen: T.fallen.map(f => f.n), boss: !!spireBoss(),
    fx: (S.fx || []).map(f => f.k), mir: (foeMirror().tiers.as.tr || {}).st,
    draw: (() => { try { const c = document.createElement('canvas').getContext('2d'), F = Game.foe, list = []; SpyUI.seen = 0; drawSkeletons(list, c, F.tx - 40, F.ty - 40, F.tx + 40, F.ty + 40); for (const [, fn] of list) fn(); return 1; } catch (e) { return String(e).slice(0, 200); } })() };`);
  ok(a4.boss && a4.st === 'gone' && a4.vk === 'lamp' && a4.lamp === 'dead' && !a4.pimLeft, 'простить: удара в спину не было ' + JSON.stringify(a4));
  ok(a4.fx.includes('stab') && a4.fx.includes('smoke') && a4.mir === 'gone' && a4.draw === 1, 'простить: нет эффектов/зеркала/рисования ' + JSON.stringify(a4));
  J('const B = spireBoss(); if (B) foeKill(B, Game.hero); return 1;');
  S.runFor(sim, 3, 3, () => {});
  const fin = J(`const c = (Game.goal.cuts || []).find(c => c.kind === 'over'); return { res: c && c.res, ep: c ? c.lines.map(l => l[1]).filter(s => /Пим/.test(s)) : [] };`);
  ok(fin.res === 'win' && fin.ep.length >= 2 && fin.ep.some(s => /Ойвин/.test(s)), 'простить: эпилог не помнит предательство ' + JSON.stringify(fin));
  ok(!sim.errors.length, 'простить: исключения: ' + sim.errors.slice(0, 3).join(' | '));
  console.log(`простить: Пим в отряде, удар в спину → ${a4.vk}, эпилог ${fin.ep.length} строк`);
}

// ---------- Не прощать ----------
{
  const { sim, J } = ascent(22);
  J(KILL(0)); J(HEAL); S.runFor(sim, 2, 2, () => {});
  J(KILL(1)); J(HEAL); S.runFor(sim, 4, 4, () => {});
  const g0 = J('return dilHave("gold")');
  const b0 = J(`const c = Game.dil.cur; if (!c || c.id !== 'malgor_spy') return { id: c && c.id }; const r = dilResolve(1, null); return { ok: r.ok, st: Game.foe.tiers.as.tr.st };`);
  ok(b0.ok && b0.st === 'rant', 'не прощать: нет окна или Пим не начал речь ' + JSON.stringify(b0));
  for (let k = 0; k < 14; k++) { J(HEAL); S.runFor(sim, 1, 1, () => {}); }
  const b1 = J(`const T = Game.foe.tiers, S = T.as.tr; return { st: S.st, mw: S.mw, pim: Game.units.some(u => u.pim && !u.dead), fx: (S.fx || []).map(f => f.k), gold: dilHave('gold'), k: S.k };`);
  ok(b1.st === 'fell' && b1.mw === 0.9 && !b1.pim && b1.fx.includes('fall') && b1.gold >= g0 + 15 - 1, 'не прощать: Пим не сорвался / нет награды ' + JSON.stringify(b1) + ' было золота ' + g0);
  J('const s = JSON.parse(JSON.stringify(serializeGame())); applySave(s); return 1;');
  for (let k = 0; k < 6; k++) { J(KILL('Game.foe.tiers.open')); J(HEAL); S.runFor(sim, 1, 1, () => {}); }
  const b2 = J(`const B = spireBoss(), A = Game.foe.tiers.as; return { boss: !!B, trw: !!(B && B._trw), m: B ? B.mhp : 0, full: Math.round(FSPEC.malgor.mhp * (A.bm || 1)) };`);
  ok(b2.boss && b2.trw && b2.m < b2.full, 'не прощать: Малгор не ослаб ' + JSON.stringify(b2));
  J('const B = spireBoss(); if (B) foeKill(B, Game.hero); return 1;');
  S.runFor(sim, 3, 3, () => {});
  const fin = J(`const c = (Game.goal.cuts || []).find(c => c.kind === 'over'); return { res: c && c.res, ep: c ? c.lines.map(l => l[1]).filter(s => /Пим|коза/.test(s)) : [] };`);
  ok(fin.res === 'win' && fin.ep.length >= 2, 'не прощать: эпилог не помнит падение ' + JSON.stringify(fin));
  ok(!sim.errors.length, 'не прощать: исключения: ' + sim.errors.slice(0, 3).join(' | '));
  console.log(`не прощать: речь ${b1.k} реплик, падение, Малгор ${b2.m}/${b2.full} HP`);
}

console.log(fails.length ? `Проверка шпиона: провалов ${fails.length}` : 'Проверка шпиона: всё в порядке');
process.exit(fails.length ? 1 : 0);
