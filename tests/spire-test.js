'use strict';
// Поздняя игра: глава 6 «Тишина дороже золота», поход к Чёрному шпилю (js/world/spire.js, enemy.js, goal.js).
// Проверяет: тап по башне даёт приказ (а не «Сюда не пройти»), тропа прорубается через завал, чек-лист,
// поход с провиантом и привалом, бой с Малгором по фазам до победы, экран итога сценария, сохранение, кооп.
// Запуск: node tests/spire-test.js [--seeds 11,22]
const S = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };
const argv = process.argv.slice(2), si = argv.indexOf('--seeds');
const SEEDS = (si >= 0 ? argv[si + 1] : '11,22').split(',').map(Number);

for (const seed of SEEDS) {
  const sim = S.newSim(seed);
  const J = code => JSON.parse(sim.h.run(`JSON.stringify((() => { ${code} })())`));
  S.runFor(sim, 20, 10, () => {});
  if (!J('return !!Game.foe')) { ok(false, `сид ${seed}: шпиля нет`); continue; }

  // сценарий сразу в главе 6
  J(`goalNew('scenario'); for (const b of Game.buildings) if (b.isStore()) { b.stock.bread = 40; b.stock.sausage = 10; }
     Game.goal.cuts = []; Game.goal.cut = null; goalStartChapter(GOAL_CHAPTERS.length - 1); return 1;`);
  const st = J('return { known: Game.foe.known, active: spireActive(), ch: Game.goal.ch }');
  ok(st.known && st.active && st.ch === 5, `сид ${seed}: глава 6 не открыла шпиль ${JSON.stringify(st)}`);

  // тап по любой клетке башни — приказ, а не null
  const taps = J(`const F = Game.foe, out = []; for (let y = F.ty - 6; y <= F.ty + 1; y += 2) for (let x = F.tx - 1; x <= F.tx + 3; x += 2) { const c = resolveCmd([x, y]); out.push(c ? c.kind : null); } return out;`);
  ok(taps.every(k => k === 'attack'), `сид ${seed}: тап по башне: ${taps}`);

  // завал: кольцо скал вокруг подножия — тропа прорубается
  const carve = J(`const F = Game.foe, cx = F.tx + 1.5, cy = F.ty + 3;
    for (let y = F.ty - 12; y <= F.ty + 14; y++) for (let x = F.tx - 12; x <= F.tx + 14; x++) {
      if (!inb(x, y)) continue; const d = Math.hypot(x - cx, y - cy); if (d >= 8 && d < 10 && !World.bmap[idx(x, y)]) World.terrain[idx(x, y)] = T_ROCK; }
    PF.regT = -1e9; const v = spireVillage(); const r = spireEnsureRoute(v[0], v[1]); return r;`);
  ok(carve.ok && carve.carved > 0, `сид ${seed}: тропа через скалы не прорублена ${JSON.stringify(carve)}`);

  // чек-лист: слабый герой без отряда — «○», но идти можно
  const prep = J('Spire.pathT = -99; const P = spirePrep(); return { n: P.items.length, can: P.can, ready: P.ready, route: P.items[P.items.length - 1].ok };');
  ok(prep.can && prep.route && prep.n >= 5, `сид ${seed}: чек-лист ${JSON.stringify(prep)}`);
  const html = sim.h.run('spirePrepHTML()');
  ok(/Выступить в поход/.test(html) && /Показать шпиль/.test(html), `сид ${seed}: нет кнопок похода в панели целей`);

  // поход: сильный герой (ускоренно) — провиант со склада, привал, бой
  J(`const h = Game.hero, H = h.hero; H.level = 12; H.maxhp = typeof hlMaxHp === 'function' ? hlMaxHp(H) * 3 : 400; H.hp = H.maxhp; h.food = 1; return 1;`);
  const food0 = J('return spireFoodStock()');
  J('spireGo(); return 1;');
  ok(J('return !!Game.spireGo && !!Game.hero.cmd') && food0 - J('return spireFoodStock()') === 10, `сид ${seed}: поход не начался или провиант не взят`);
  let camp = false, won = false, phases = new Set(), t = 0;
  for (; t < 900 && !won; t += 5) {
    S.runFor(sim, 5, 5, () => {});
    const s = J(`const N = spireBoss(), h = Game.hero, H = h.hero; if (H.hp < H.maxhp * 0.5 && !(H.downT > Game.time)) H.hp = H.maxhp; h.food = 1;
      if (N && !h.cmd && !(H.downT > Game.time)) spireFight();
      return { camp: !!h._spireCamp, fz: N ? N.fz : 0, hp: N ? Math.round(N.hp) : 0, dead: !!Game.foe.defeated, over: Game.goal.over && Game.goal.over.res };`);
    camp = camp || s.camp; if (s.fz) phases.add(s.fz);
    won = s.dead && s.over === 'win';
  }
  ok(camp, `сид ${seed}: привал у подножия не случился`);
  ok(won, `сид ${seed}: Малгор не побеждён за ${t} с (фазы ${[...phases]})`);
  ok(phases.has(3) || won && phases.size >= 2, `сид ${seed}: бой прошёл не все фазы: ${[...phases]}`);
  if (won) {
    const fin = J(`const c = (Game.goal.cuts || []).find(c => c.kind === 'over'); return { cut: !!c, res: c && c.res, lines: c && c.lines.length, title: Game.hero.hero.title, raiders: Game.raiders.filter(N => N.st !== 'die').length };`);
    ok(fin.cut && fin.res === 'win' && fin.lines > 0, `сид ${seed}: нет экрана победы с эпилогом ${JSON.stringify(fin)}`);
    ok(fin.title === 'Победитель Малгора', `сид ${seed}: титул героя ${fin.title}`);
    ok(!J('return spireActive()'), `сид ${seed}: после победы стрелка к шпилю всё ещё нужна`);
  }
  // сохранение и загрузка
  J('const s = JSON.parse(JSON.stringify(serializeGame())); applySave(s); return 1;');
  ok(J('return !!Game.foe && Game.foe.defeated === ' + won + ' && Game.goal.won === ' + won), `сид ${seed}: после загрузки состояние врага/цели потерялось`);
  S.runFor(sim, 20, 10, () => {});
  ok(!sim.errors.length, `сид ${seed}: исключения: ` + sim.errors.slice(0, 3).join(' | '));
  const inv = S.checkInvariants(sim, 'шпиль'); for (const p of inv.problems) ok(false, `сид ${seed}: ` + p);
  console.log(`сид ${seed}: тропа ${carve.carved} кл., привал ${camp}, фазы ${[...phases]}, победа ${won} за ${t} с`);
}

// ---------- Кооп: тап по башне на сервере — бой с Малгором ----------
const srv = S.newSim(11, { coop: true });
const R = code => JSON.parse(srv.h.run(`JSON.stringify((() => { ${code} })())`));
srv.h.run(`coopJoin('гном', JSON.stringify({ cls: 'warrior' }))`);
S.runFor(srv, 10, 5, () => {});
const cg = R(`if (!Game.foe) return 'нет шпиля'; const u = coop.players.get('гном'); const F = Game.foe; coopGo(u, F.tx + 1, F.ty); return u.cmd ? u.cmd.kind : null;`);
ok(cg === 'attack' || cg === 'foe', 'кооп: тап по башне не дал приказа: ' + cg);
S.runFor(srv, 20, 5, () => {});
ok(!srv.errors.length, 'кооп: исключения: ' + srv.errors.slice(0, 3).join(' | '));

console.log(fails.length ? `Проверка шпиля: провалов ${fails.length}` : 'Проверка шпиля: всё в порядке');
process.exit(fails.length ? 1 : 0);
