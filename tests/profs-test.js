'use strict';
// Прокачка мастеров (js/entities.js PROF_*, js/jobs.js): уровни 1–5 у профессий, скорость и бонусы по уровню,
// каменотёс ходит дальше с уровнем гнома и каменоломни, долбит скалу, не рвётся туда, куда не дойти, ночью работает у дома;
// выслуга копится в игре, переживает сейв и уходит клиентам коопа.
// Запуск: node tests/profs-test.js [минуты]
const S = require('./lib/sim');
const MIN = +process.argv[2] || 25;
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };
const J = (sim, code) => JSON.parse(sim.h.run(`JSON.stringify((() => { ${code} })())`));

// 1) таблица уровней
{
  const sim = S.newSim(7);
  const r = J(sim, `const u = { type: 'woodcutter', xp: 0 }, out = [];
    for (const xp of [0, 11, 12, 34, 35, 74, 75, 139, 140, 999]) { u.xp = xp; out.push(unitLevel(u)); }
    const s = { type: 'serf', xp: 999 };
    return { lv: out, serf: unitLevel(s), max: levelMax('miner'), all: PROF_KEYS.every(k => LEVEL_XP[k] === PROF_XP),
      sp1: profSpeed({ type: 'baker', xp: 0 }), sp5: profSpeed({ type: 'baker', xp: 500 }), spSerf: profSpeed({ type: 'serf', xp: 500 }),
      pr: levelProgress({ type: 'miner', xp: 23 }), prMax: levelProgress({ type: 'miner', xp: 900 }) };`);
  ok(JSON.stringify(r.lv) === '[1,1,2,2,3,3,4,4,5,5]', 'пороги уровней мастеров: ' + r.lv);
  ok(r.serf === 3, 'трудяга должен остаться с 3 уровнями, а не ' + r.serf);
  ok(r.max === 5 && r.all, 'у всех профессий 5 уровней');
  ok(r.sp1 === 1 && r.sp5 > 1.3 && r.spSerf === 1, `скорость: новичок ${r.sp1}, мастер ${r.sp5}, трудяга ${r.spSerf}`);
  ok(Math.abs(r.pr - 11 / 23) < 0.01 && r.prMax === 1, `шкала выслуги: ${r.pr}, ${r.prMax}`);
}

// 2) в игре: мастера копят выслугу, работают быстрее, сейв и кооп
for (const seed of [7, 22]) {
  const sim = S.newSim(seed);
  S.runFor(sim, MIN * 60, 10, k => { if (k % 3 === 0) S.botTurn(sim); });
  ok(!sim.errors.length, `сид ${seed}: исключения: ${sim.errors.slice(0, 2).join(' | ')}`);
  const g = J(sim, `const by = {};
    for (const u of Game.units) if (isProf(u)) by[u.type] = Math.max(by[u.type] || 0, u.xp || 0);
    return by;`);
  const grown = Object.entries(g).filter(([, x]) => x >= 12).map(([k]) => k);
  console.log(`сид ${seed}: выслуга мастеров ${JSON.stringify(g)}`);
  ok(Object.keys(g).length >= 2, `сид ${seed}: мало мастеров в деревне: ${Object.keys(g)}`);
  ok(grown.length >= 1, `сид ${seed}: за ${MIN} мин до 2-го уровня доросли только ${grown}`);
  // сейв: выслуга мастера переживает сохранение и загрузку
  // (жители после загрузки получают новые id — ищем по выслуге)
  const sv = J(sim, `const u = Game.units.find(x => isProf(x)); u.xp = 77; const t = u.type;
    applySave(JSON.parse(JSON.stringify(serializeGame()))); return Game.units.filter(x => x.type === t && x.xp === 77).length;`);
  ok(sv === 1, `сид ${seed}: выслуга 77 после сейва нашлась у ${sv} жителей, ждали 1`);
  // кооп: выслуга уходит клиенту в записи жителя
  const cp = J(sim, `if (typeof coopUnitRec !== 'function') return 'нет coopUnitRec'; const u = Game.units.find(x => isProf(x)); const o = coopUnitRec(u, Game.time); return o.ex && o.ex.xp;`);
  ok(cp === 77, `сид ${seed}: выслуга не уходит клиенту коопа: ${cp}`);
  // скорость: мастер 5-го уровня делает работу быстрее
  const w = J(sim, `const u = Game.units.find(x => isProf(x) && x.home); if (!u) return null;
    const keep = u.xp; u.xp = 0; const a1 = { wait: 4, anim: 'work' }; u.action = a1; u.food = 1; u.injury = null; u.stepAction(0);
    u.xp = 500; const a5 = { wait: 4, anim: 'work' }; u.action = a5; u.stepAction(0); u.xp = keep; return [a1.T, a5.T];`);
  if (w) ok(w[1] < w[0] * 0.8, `сид ${seed}: мастер 5 ур. не быстрее новичка: ${w}`);
}

// 3) каменотёс: радиус, ночь, недоступные цели, скала
{
  // сид, где каменотёса за 6 минут не утащила нечисть (случайные события зависят от состава деревни)
  let sim, has = false;
  for (const seed of [11, 12, 13, 14]) {
    sim = S.newSim(seed);
    S.runFor(sim, 6 * 60, 10, k => { if (k % 3 === 0) S.botTurn(sim); });
    has = J(sim, `return Game.buildings.some(b => b.type === 'quarry' && b.state === 'done') && Game.units.some(u => u.type === 'stonemason' && u.home);`);
    if (has) break;
  }
  ok(has, 'каменоломня с каменотёсом не появилась за 6 минут');
  if (has) {
    // вокруг каменоломни чисто на 12 клеток, одна глыба в 15 клетках
    const r = J(sim, `const b = Game.buildings.find(b => b.type === 'quarry' && b.state === 'done'), u = Game.units.find(u => u.type === 'stonemason' && u.home === b);
      for (let y = b.doorY - 30; y <= b.doorY + 30; y++) for (let x = b.doorX - 30; x <= b.doorX + 30; x++) {
        if (!inb(x, y)) continue; const i = idx(x, y), o = World.obj[i];
        if (o && o.t === 'stone') World.obj[i] = null;
        if (World.terrain[i] === T_ROCK && Math.hypot(x - b.doorX, y - b.doorY) <= 26) World.terrain[i] = T_GRASS;
      }
      PF.regT = -1e9;
      let far = null;
      for (let d = 15; d <= 15 && !far; d++) for (let k = 0; k < 64 && !far; k++) {
        const x = Math.round(b.doorX + Math.cos(k / 64 * 6.283) * d), y = Math.round(b.doorY + Math.sin(k / 64 * 6.283) * d);
        if (inb(x, y) && isFreeGrass(x, y) && DIRS.some(([dx, dy]) => isWalkable(x + dx, y + dy))) { far = [x, y]; setStone(idx(x, y), 3); }
      }
      if (!far) return { err: 'нет места под глыбу' };
      const _n = isNightNow, _e = isEveningNow; isNightNow = () => false; isEveningNow = () => false;   // днём
      const lv = (xp, lvl) => { u.xp = xp; b.level = lvl; const t = quarryTarget(u, b); return t ? (t.stone ? 'stone' : 'face') : null; };
      const out = { r1: quarryReach((u.xp = 0, u), (b.level = 1, b)), r5: quarryReach((u.xp = 500, u), (b.level = 3, b)) };
      out.l1 = lv(0, 1); out.l3 = lv(35, 1); out.l4 = lv(75, 1); out.l1b3 = lv(0, 3);
      // ночью далеко не ходит
      isNightNow = () => true; out.night = lv(500, 3); isNightNow = () => false;
      isEveningNow = () => true; out.eve = lv(500, 3); isEveningNow = () => false;
      // недоступная глыба — минуту не рвётся к ней
      const o = World.obj[idx(far[0], far[1])]; QUARRY_BAD_STONE.set(o, Game.time + 60); out.bad = lv(500, 3); QUARRY_BAD_STONE.delete(o);
      // скала вместо глыбы: клетка скалы в 14 клетках
      World.obj[idx(far[0], far[1])] = null;
      let rk = null;
      for (let k = 0; k < 64 && !rk; k++) {
        const x = Math.round(b.doorX + Math.cos(k / 64 * 6.283) * 14), y = Math.round(b.doorY + Math.sin(k / 64 * 6.283) * 14);
        if (inb(x, y) && isFreeGrass(x, y) && !World.road[idx(x, y)] && DIRS.filter(([dx, dy]) => isWalkable(x + dx, y + dy)).length >= 3) { World.terrain[idx(x, y)] = T_ROCK; rk = [x, y]; }
      }
      PF.regT = -1e9;
      out.rock = rk ? lv(75, 1) : 'нет места под скалу';
      out.rockL1 = rk ? lv(0, 1) : null;
      isNightNow = _n; isEveningNow = _e;
      u.xp = 500; b.level = 1;
      out.rk = rk; out.qid = b.id; out.uid = u.id; out.stone0 = b.stock.stone;
      if (rk) b.stock.stone = 0;
      return out;`);
    if (r.err) ok(false, 'каменотёс: ' + r.err);
    else {
      console.log('каменотёс: ' + JSON.stringify(r));
      ok(r.r1 === 10 && r.r5 === 24, `радиус каменотёса: новичок ${r.r1}, мастер в каменоломне 3 ур. ${r.r5}`);
      ok(r.l1 === null, 'новичок в каменоломне 1 ур. не должен идти за глыбой в 15 клетках');
      ok(r.l3 === null, 'каменотёс 3 ур. (радиус 14) не должен идти за глыбой в 15 клетках');
      ok(r.l4 === 'stone', 'каменотёс 4 ур. должен дойти до глыбы в 15 клетках');
      ok(r.l1b3 === 'stone', 'новичок в каменоломне 3 ур. должен дойти до глыбы в 15 клетках');
      ok(r.night === null && r.eve === null, 'ночью и вечером каменотёс далеко не ходит');
      ok(r.bad === null, 'к недоступной глыбе каменотёс рвётся снова');
      ok(r.rock === 'face' && r.rockL1 === null, `скала в 14 клетках: опытный ${r.rock}, новичок ${r.rockL1}`);
      if (r.rk) {
        // днём (без ночи) каменотёс 5 ур. долбит дальнюю скалу и носит камень домой
        sim.h.run('isNightNow = () => false; isEveningNow = () => false;');
        S.runFor(sim, 240, 10, () => {});
        const m = J(sim, `const i = idx(${r.rk[0]}, ${r.rk[1]}), b = Game.buildings.find(x => x.id === ${r.qid});
          const u = Game.units.find(x => x.id === ${r.uid}); return { hp: ROCKMINE.hp.get(i), mined: ROCKMINE.mined.has(i), stone: b.stock.stone, made: Game.produced.stone, at: u && [Math.round(u.x), Math.round(u.y), u.inside ? u.inside.type : '', u.brk ? u.brk.kind : ''] };`);
        console.log('скала после 240 с: ' + JSON.stringify(m));
        ok(m.mined || (m.hp !== undefined && m.hp <= 60 - 3), `каменотёс 5 ур. не долбит скалу в 14 клетках: ${JSON.stringify(m)}`);
        ok(!sim.errors.length, 'каменотёс: исключения: ' + sim.errors.slice(0, 2).join(' | '));
      }
    }
  }
}

console.log(fails.length ? `✗ провалов: ${fails.length}` : 'Проверка прокачки мастеров: всё в порядке');
process.exit(fails.length ? 1 : 0);
