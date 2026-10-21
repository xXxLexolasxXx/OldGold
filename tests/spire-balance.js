'use strict';
// Баланс подъёма к шпилю (не входит в run.js): честный герой 5 уровня без подлечивания, отряд из 4 рекрутов 2 ур.
// и фонарщик. Бот только жмёт «В бой» (spireFight), сам героя не лечит. Печатает время по стражам, падения героя и итог.
// Запуск: node tests/spire-balance.js [--seeds 11,22,33] [--lvl 5] [--squad 4] [--t 3600]
const S = require('./lib/sim');
const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const SEEDS = arg('seeds', '11,22,33').split(',').map(Number), LVL = +arg('lvl', 5), SQUAD = +arg('squad', 4), TMAX = +arg('t', 3600);
const rows = [];
for (const seed of SEEDS) {
  const sim = S.newSim(seed);
  const J = code => JSON.parse(sim.h.run(`JSON.stringify((() => { ${code} })())`));
  S.runFor(sim, 20, 10, () => {});
  if (!J('return !!Game.foe')) { console.log(`сид ${seed}: шпиля нет`); continue; }
  J(`goalNew('scenario'); for (const b of Game.buildings) if (b.isStore()) { b.stock.bread = 40; b.stock.sausage = 10; }
     Game.goal.cuts = []; Game.goal.cut = null; goalStartChapter(GOAL_CHAPTERS.length - 1);
     const h = Game.hero, H = h.hero; H.level = ${LVL}; H.lvDebt = heroTownScore() - heroNeedFor(${LVL} - 1) - 0.5 + (H.lvDebt || 0);
     H.maxhp = hlMaxHp(H); H.hp = H.maxhp;
     const cls = ['warrior', 'archer', 'warrior', 'mage', 'rogue', 'archer'];
     for (let k = 0; k < ${SQUAD}; k++) { const p = randomFreeNear(Math.floor(h.x), Math.floor(h.y), 1, 3, (x, y) => isWalkable(x, y)); const c = cls[k];
       const u = spawnUnit(c, p[0] + 0.5, p[1] + 0.5); u.smoker = false; u.rec = { cls: c, lvl: 2, xp: 0, guild: 0, order: 'follow', leader: h.id, train: 0, armor: true, name: 'Боец' + k }; }
     spireGo();
     const _lh = asLampHurt; asLampHurt = function (u, n) { const st = new Error().stack.split(String.fromCharCode(10)); globalThis.__lh = (globalThis.__lh || []).slice(-5); globalThis.__lh.push(Math.round(Game.time) + 'с ' + n.toFixed(0) + ' ' + (st[3] || '').trim().split(' ')[1]); return _lh(u, n); };
     const _ld = asLampDown; asLampDown = function (u) { globalThis.__ld = { t: Math.round(Game.time), last: globalThis.__lh }; return _ld(u); };
     return 1;`);
  let t = 0, won = false, downs = 0, wasDown = false, lastGd = 0;
  const marks = [];
  for (; t < TMAX && !won; t += 5) {
    S.runFor(sim, 5, 5, () => {});
    const s = J(`const N = spireFoe(), h = Game.hero, H = h.hero, down = H.downT > Game.time || H.hp <= 0;
      if (Game.dil && Game.dil.cur) dilFinish(true);
      const kn = N && N.shield && Game.raiders.find(M => M.id === N.guard && foeLive(M));
      if (!down && kn && !(h.cmd && h.cmd.f && h.cmd.f.o === kn)) issueCmd(h, { kind: 'attack', f: { kind: 'foe', o: kn }, tx: Math.floor(kn.x), ty: Math.floor(kn.y), label: 'Бой' });
      else if (!down && (() => { const T = Game.foe.tiers, tw = T && Game.raiders.find(M => M.k === 'ftower' && foeLive(M) && M.tier <= T.open && Math.hypot(M.x - h.x, M.y - h.y) < 10);   // как игрок: сперва башни рядом
        if (!tw) return false; if (!(h.cmd && h.cmd.f && h.cmd.f.o === tw)) issueCmd(h, { kind: 'attack', f: { kind: 'foe', o: tw }, tx: Math.floor(tw.x), ty: Math.floor(tw.y), label: 'Башня' }); return true; })()) {}
      else if (N && !h.cmd && !down) spireFight();
      const B = spireBoss(), T = Game.foe.tiers;
      return { gd: guardsDone(), down, dead: !!Game.foe.defeated, hp: Math.round(H.hp), bhp: B ? Math.round(B.hp) : 0, fz: B ? B.fz : 0, ecl: T ? T.ecl : 0,
        sq: Game.units.filter(u => u.rec && !u.dead && !(u.rec.hp <= 0 && u.downUntil > Game.time)).length, lamp: T && T.as ? T.as.lamp : '-', gh: N ? Math.round(N.hp) : 0 };`);
    if (s.down && !wasDown) downs++;
    wasDown = s.down;
    if (s.gd > lastGd) { marks.push(`${lastGd + 1}:${t}`); lastGd = s.gd; }
    if (t % 300 === 0) console.log(`  сид ${seed} t=${t}: стражей ${s.gd}, страж/Малгор ${s.gh} HP, герой ${s.hp} HP, отряд ${s.sq}, падений ${downs}, тьма ${s.ecl}, фонарщик ${s.lamp}`);
    won = s.dead;
  }
  const fin = J(`const T = Game.foe.tiers; return { gd: guardsDone(), n: T ? T.n : 0, fallen: T ? T.fallen.length : 0, lamp: T && T.as ? T.as.lamp : '-' };`);
  const row = `сид ${seed}: герой ${LVL} ур. + ${SQUAD}: ${won ? 'ПОБЕДА за ' + t + ' с' : 'не прошёл за ' + t + ' с'}, стражей ${fin.gd}/${fin.n} (${marks.join(' ')}), падений героя ${downs}, павших ${fin.fallen}, фонарщик ${fin.lamp}`;
  console.log(row); rows.push(row);
  const ld = J('return globalThis.__ld || null'); if (ld) console.log('  фонарщик пал на ' + ld.t + ' с: ' + ld.last.join(', '));
  if (sim.errors.length) console.log('  исключения: ' + sim.errors.slice(0, 3).join(' | '));
}
console.log('\n' + rows.join('\n'));
