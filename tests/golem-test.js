'use strict';
// Голем оживает (js/world/golemlife.js, golemart.js, golem.js): три руны, диалог Старца, пробуждение, поломка завала
// до барьера Малгора, сезонные облики, ночная охота на скелетов, летнее лечение мхом, сейв и кооп-зеркало.
// Запуск: node tests/golem-test.js [--seeds 11,22]
const S = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };
const argv = process.argv.slice(2), si = argv.indexOf('--seeds');
const SEEDS = (si >= 0 ? argv[si + 1] : '11').split(',').map(Number);

for (const seed of SEEDS) {
  const sim = S.newSim(seed);
  const J = code => JSON.parse(sim.h.run(`JSON.stringify((() => { ${code} })())`));
  S.runFor(sim, 10, 5, () => {});

  // --- руны и сон ---
  const q = J(`const G = Game.glq, g = Game.golem; return { has: !!G, n: G && G.runes.length, ks: G && G.runes.map(r => r.k), awake: G && G.awake, g: !!g, x: g && g.fx, y: g && g.fy,
    free: G && G.runes.every(r => glRuneSpotOk(r.x, r.y) || r.got) };`);
  ok(q.has && q.n === 3 && q.ks.join() === 'forest,mine,water', `сид ${seed}: руны не созданы ${JSON.stringify(q)}`);
  ok(q.g && q.awake === false, `сид ${seed}: голем должен спать до рун`);
  S.runFor(sim, 30, 5, () => {});
  const q2 = J('return { x: Game.golem.fx, y: Game.golem.fy, st: Game.golem.state }');
  ok(q2.x === q.x && q2.y === q.y, `сид ${seed}: спящий голем ходит`);
  ok(J('return glWake()') === false, `сид ${seed}: разбудили без рун`);

  // --- сбор рун героем ---
  for (let k = 0; k < 3; k++) {
    J(`const r = Game.glq.runes[${k}], h = Game.units.find(u => u.type === 'hero'); h.x = r.x + 0.5; h.y = r.y + 0.5; return 1;`);
    S.stepN(sim, 30);
  }
  const got = J('return { n: glGot(), all: glAll() }');
  ok(got.n === 3 && got.all, `сид ${seed}: руны не подобраны ${JSON.stringify(got)}`);

  // --- большой завал: гномы отказываются, Старец говорит, голем ломает ---
  const blocked = J(`const F = Game.foe, fr = spireFront(F), cx = fr[0] + 0.5, cy = fr[1] + 0.5;
    for (let y = Math.floor(cy) - 30; y <= cy + 30; y++) for (let x = Math.floor(cx) - 30; x <= cx + 30; x++) {
      if (!inb(x, y)) continue; const d = Math.hypot(x - cx, y - cy); if (d >= 14 && d < 28 && !World.bmap[idx(x, y)] && World.terrain[idx(x, y)] !== T_WATER) World.terrain[idx(x, y)] = T_ROCK; }
    PF.regT = -1e9; const v = spireVillage(); const r = spireEnsureRoute(v[0], v[1]); return { r, block: Game.glq.block, d: glDialogState() };`);
  if (blocked.r.big) {
    ok(blocked.block && !blocked.r.ok, `сид ${seed}: большой завал не помечен ${JSON.stringify(blocked)}`);
    ok(blocked.d.canWake && blocked.d.runes.length === 3 && /Три руны/.test(blocked.d.text), `сид ${seed}: диалог Старца ${JSON.stringify(blocked.d)}`);
    ok(J('return glWake()') === true && J('return Game.glq.awake'), `сид ${seed}: не проснулся`);
    let minD = 99;
    S.runFor(sim, 360, 1, () => { minD = Math.min(minD, J('const g = Game.golem, C = glCentre(); return Math.hypot(g.fx + 1.5 - C[0], g.fy + 1 - C[1]);')); });
    const after = J('return { cleared: Game.glq.cleared, bar: Game.glq.bar, block: Game.glq.block, job: !!Game.golem.job }');
    ok(after.cleared && !after.block, `сид ${seed}: голем не расчистил тропу ${JSON.stringify(after)}`);
    ok(after.bar > 0, `сид ${seed}: барьер не сработал`);
    ok(minD >= 9.5, `сид ${seed}: голем зашёл за барьер (мин. расстояние ${minD.toFixed(1)})`);
    const r2 = J('const v = spireVillage(); PF.regT = -1e9; return spireEnsureRoute(v[0], v[1]);');
    ok(r2.ok, `сид ${seed}: после голема пути нет ${JSON.stringify(r2)}`);
  } else {
    console.log(`  (сид ${seed}: завал не упёрся в лимит — ${JSON.stringify(blocked.r)}; проверяем пробуждение напрямую)`);
    ok(J('return glWake()'), `сид ${seed}: не проснулся`);
  }

  // --- ночная охота: скелет рядом с големом ---
  sim.h.run('isNightNow = function () { return true; }; isEveningNow = function () { return false; }; skeletonsTick = function () {};');
  J(`const g = Game.golem; g.job = null; g.state = 'idle'; g.timer = 99; Game.glq.hunt = 0; Game.skels = [];
     let x = g.fx + 9, y = g.fy + 1; const sx = Math.round(g.fx + 1), sy = Math.round(g.fy + 1);
     for (let r = 4; r < 14; r++) for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r]]) if (isWalkable(sx + dx, sy + dy) && findPath(sx, sy, sx + dx, sy + dy)) { x = sx + dx + 0.5; y = sy + dy + 0.5; r = 99; break; }
     skelRise(x, y, 0); const s = Game.skels[0]; s.state = 'roam'; s.t = 5; s.k = 1; return 1;`);
  S.runFor(sim, 90, 1, () => {});
  const sk = J('return Game.skels.map(s => s.state)');
  ok(sk.every(s => s === 'dead'), `сид ${seed}: голем не раздавил скелета ${sk}`);

  // --- летний мох лечит ---
  J(`Game.sea.fixed = 0; const g = Game.golem; g.job = null; const u = Game.units.find(u => isPerson(u) && u.type !== 'hero' && !u.dead);
     u.x = g.fx + 2; u.y = g.fy + 3; u.inside = false; injure(u, 'arm'); Game.glq.ht = 5; return 1;`);
  S.stepN(sim, 5);
  ok(J(`return !Game.units.some(u => u.injury && Math.hypot(u.x - (Game.golem.fx + 1.5), u.y - (Game.golem.fy + 1)) < 5)`), `сид ${seed}: мох не вылечил`);

  // --- сезонные облики рисуются без ошибок; зимой медленнее ---
  const draw = J(`const px = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : (k === 'canvas' ? px : px), apply: () => px, set: () => true });
    const out = []; for (let sea = 0; sea < 4; sea++) { Game.sea.fixed = sea; GL_SEA = sea; GL_DORM = sea === 1;
      for (const [v, p, f] of [['S', 'idle', 0], ['E', 'walk', 3], ['N', 'idle', 1], ['S', 'wave', 5]]) { try { drawGolemBody(px, v, p, f); } catch (e) { out.push(sea + v + p + ': ' + e.message); } }
      try { golemAura(px, Game.golem); } catch (e) { out.push('aura' + sea + e.message); } }
    GL_DORM = false; return { out, win: (Game.sea.fixed = 2, golemSpeedMul()), sum: (Game.sea.fixed = 0, golemSpeedMul()) };`);
  ok(draw.out.length === 0, `сид ${seed}: рисование облика: ${draw.out.join('; ')}`);
  ok(draw.win < draw.sum, `сид ${seed}: зимой не медленнее`);
  const rr = J(`const px = new Proxy(function () {}, { get: () => px, apply: () => px, set: () => true }); const out = [];
    for (const r of Game.glq.runes) try { drawRune(px, r); } catch (e) { out.push(e.message); } try { Game.glq.bar = Game.time; Game.glq.barX = Game.foe.tx; Game.glq.barY = Game.foe.ty; drawBarrier(px, Game.foe); } catch (e) { out.push(e.message); } return out;`);
  ok(rr.length === 0, `сид ${seed}: руны/барьер: ${rr.join('; ')}`);

  // --- сейв ---
  const sv = JSON.parse(sim.h.run('JSON.stringify(serializeGame())'));
  ok(sv.glq && sv.glq.awake === true && sv.glq.runes.length === 3 && sv.glq.runes.every(r => r.got), `сид ${seed}: glq не в сейве`);
  const sim2 = S.newSim(seed + 1);
  sim2.h.run(`applySave(${JSON.stringify(sv)})`);
  const back = JSON.parse(sim2.h.run('JSON.stringify({ awake: Game.glq.awake, n: Game.glq.runes.length, g: !!Game.golem })'));
  ok(back.awake && back.n === 3 && back.g, `сид ${seed}: загрузка потеряла голема ${JSON.stringify(back)}`);
  // старый сейв без glq: руны создаются, голем спит
  const old = { ...sv }; delete old.glq;
  const sim3 = S.newSim(seed + 2);
  sim3.h.run(`applySave(${JSON.stringify(old)})`);
  const back3 = JSON.parse(sim3.h.run('JSON.stringify({ awake: Game.glq.awake, n: Game.glq.runes.length })'));
  ok(back3.awake === false && back3.n === 3, `сид ${seed}: старый сейв ${JSON.stringify(back3)}`);

  if (sim.errors.length) ok(false, `сид ${seed}: исключения: ${sim.errors.slice(0, 3).join(' | ')}`);
}

// --- кооп: сервер отдаёт glq, клиент принимает; команда пробуждения ---
{
  const srv = S.newSim(7, { coop: true });
  const J = code => JSON.parse(srv.h.run(`JSON.stringify((() => { ${code} })())`));
  S.stepN(srv, 20);
  const m = J('const m = coopMirror(); return { glq: m.glq, golem: !!m.golem, job: m.golem && 0 in m.golem && m.golem.job };');
  ok(m.glq && m.glq.runes && m.glq.runes.length === 3 && m.glq.awake === false, `кооп: glq нет в зеркале ${JSON.stringify(m.glq)}`);
  J('for (const r of Game.glq.runes) r.got = 1; return 1');
  ok(J('return glWake()'), 'кооп: сервер не будит голема');
  S.stepN(srv, 40);
  ok(J('return coopMirror().glq.awake === true'), 'кооп: пробуждение не в зеркале');
  if (srv.errors.length) ok(false, 'кооп: исключения ' + srv.errors.slice(0, 2).join(' | '));
}

if (fails.length) { console.log(`\nГолем: провалов ${fails.length}`); process.exit(1); }
console.log('Голем: всё зелёное');
