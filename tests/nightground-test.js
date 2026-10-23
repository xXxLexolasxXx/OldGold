'use strict';
// Ночная земля (world/nightground.js): цветки, руки и плиты стоят редко и не кучей, цветки разных цветов, цветок жуёт, когда рядом жертва.
// Жалоба: «цветы подальше друг от друга, разных цветов; могилки и руки тоже реже». Запуск: node tests/nightground-test.js
const S = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

for (const seed of [11]) {
  const h = S.newSim(seed).h;
  const r = JSON.parse(h.run(`JSON.stringify((() => {
    const out = { kinds: {}, vars: 0, badVar: 0, pose: [], cross: 999 }, all = [];
    for (const k of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
      const pts = [];
      ngSpots(k, 0, 0, MAP_W - 1, MAP_H - 1, Game.seed | 0, ngTileOk, sp => { pts.push(sp); all.push([k, sp.tx, sp.ty]); });
      let minD = 999;
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) minD = Math.min(minD, Math.max(Math.abs(pts[i].tx - pts[j].tx), Math.abs(pts[i].ty - pts[j].ty)));
      let maxWin = 0;   // самое людное окно 32x20 клеток (большой монитор)
      for (let y0 = 0; y0 + 20 <= MAP_H; y0 += 4) for (let x0 = 0; x0 + 32 <= MAP_W; x0 += 4) { let n = 0; for (const p of pts) if (p.tx >= x0 && p.tx < x0 + 32 && p.ty >= y0 && p.ty < y0 + 20) n++; maxWin = Math.max(maxWin, n); }
      out.kinds[k] = { n: pts.length, minD, maxWin };
      if (k === 2) {
        const seen = new Set();
        for (const p of pts) { seen.add(ngFlowerVar(p.cx, p.cy, Game.seed | 0)); for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) if (ngFlowerVar(p.cx + dx, p.cy + dy, Game.seed | 0) === ngFlowerVar(p.cx, p.cy, Game.seed | 0)) out.badVar++; }
        out.vars = seen.size;
      }
    }
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (all[i][0] !== all[j][0]) out.cross = Math.min(out.cross, Math.max(Math.abs(all[i][1] - all[j][1]), Math.abs(all[i][2] - all[j][2])));
    // поведение: без жертвы покой, с жертвой — пасть открывается, хлопает и жуёт, потом отдыхает
    const st = { t0: -99, next: 0, face: 1 };
    const saveU = Game.units, saveA = Game.animals;
    Game.units = []; Game.animals = [];
    const calm = []; for (let t = 0; t < 6; t += 0.5) calm.push(ngFlowerPose(st, t, 50, 50, 0.3));
    Game.units = [{ x: 51, y: 50, dead: false }];
    const seq = []; for (let t = 10; t < 18; t += 0.1) seq.push(ngFlowerPose(st, t, 50, 50, 0.3));
    Game.units = saveU; Game.animals = saveA;
    out.calm = calm; out.seq = seq;
    // укус: гном ночью у цветка пугается и бежит, урона нет; днём цветок не кусает
    const seed = Game.seed | 0;
    let fl = null; ngSpots(2, 0, 0, MAP_W - 1, MAP_H - 1, seed, ngTileOk, sp => { if (!fl) fl = sp; });
    const g = Game.units.find(u => isPerson(u) && u.type !== 'carter' && !u.dead && !u.inside && interruptible(u));
    if (fl && g) {
      const p = ngPlaceXY(fl.tx, fl.ty, seed), keep = JSON.stringify({ hp: g.hp, carry: g.carry, dead: g.dead, type: g.type });
      let day = Game.time; while (nightAmt(day) > 0.2) day += 7;
      let night = Game.time; while (nightAmt(night) < 0.9) night += 7;
      Game.time = day; g.x = p.px / TILE; g.y = p.py / TILE + 0.3; nightGroundTick(0.6);
      out.dayBite = !!(g.brk && g.brk.kind === 'flee');
      Game.time = night; nightGroundTick(0.6);
      out.nightBite = !!(g.brk && g.brk.kind === 'flee');
      out.cd = (g.ngBiteCD || 0) > Game.time;
      out.unhurt = JSON.stringify({ hp: g.hp, carry: g.carry, dead: g.dead, type: g.type }) === keep;
      const x0 = g.x, y0 = g.y; for (let i = 0; i < 40; i++) step(0.25);
      out.ran = Math.hypot(g.x - x0, g.y - y0);
    }
    return out;
  })())`));
  for (const [k, minWant, maxWinWant, name] of [[2, 8, 5, 'цветок'], [1, 10, 5, 'рука'], [3, 10, 5, 'плита'], [5, 10, 5, 'череп'], [6, 10, 5, 'щупальца'], [7, 10, 5, 'паук'], [8, 10, 5, 'рука зомби'], [9, 10, 5, 'гроб'], [10, 10, 5, 'поганки'], [11, 12, 4, 'цветок-полудница'], [4, 4, 8, 'глаза']]) {
    const d = r.kinds[k];
    ok(d.n > 0, `сид ${seed}: ${name} не встречается`);
    ok(d.minD >= minWant, `сид ${seed}: ${name}: два на расстоянии ${d.minD} < ${minWant}`);
    ok(d.maxWin <= maxWinWant, `сид ${seed}: ${name}: ${d.maxWin} в одном окне 32×20 (больше ${maxWinWant})`);
    console.log(`сид ${seed}: ${name}: всего ${d.n}, мин. расстояние ${d.minD}, максимум на экране ${d.maxWin}`);
  }
  ok(r.cross >= 4, `сид ${seed}: разные твари стоят вплотную (${r.cross} клетки)`);
  console.log(`сид ${seed}: разные виды не ближе ${r.cross} клеток`);
  ok(r.vars === 5, `сид ${seed}: расцветок ${r.vars} из 5`);
  ok(r.badVar === 0, `сид ${seed}: соседние квадраты одного цвета (${r.badVar})`);
  ok(r.dayBite === false, `сид ${seed}: цветок кусает днём`);
  ok(r.nightBite === true, `сид ${seed}: ночью гном у цветка не испугался`);
  ok(r.unhurt === true && r.cd === true, `сид ${seed}: укус что-то отнял у гнома или нет передышки`);
  ok(r.ran > 1.5, `сид ${seed}: испуганный гном не убежал (${(r.ran || 0).toFixed(1)} кл.)`);
  console.log(`сид ${seed}: укус ночью — испуг, убежал на ${(r.ran || 0).toFixed(1)} кл., урона нет`);
  ok(r.calm.every(f => f === 0 || f === 1), `сид ${seed}: без жертвы цветок не должен открывать пасть`);
  ok([2, 3, 4, 5, 6, 7].every(f => r.seq.includes(f)), `сид ${seed}: цепочка кадров неполная: ${[...new Set(r.seq)].join(',')}`);
  ok(r.seq.indexOf(4) > r.seq.indexOf(3) && r.seq.indexOf(5) > r.seq.indexOf(4), `сид ${seed}: порядок кадров нарушен`);
}
if (fails.length) { console.log(`✗ провалов: ${fails.length}`); process.exit(1); }
console.log('✓ ночная земля в порядке');
process.exit(0);   // симуляция держит таймеры — без явного выхода процесс висит до таймаута run.js
