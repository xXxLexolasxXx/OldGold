'use strict';
// Зимние коньки: гном, оставшийся на льду или на чужом берегу, возвращается на свой берег (не застревает до весны);
// герой катится по льду напрямик. Запуск: node tests/skate-test.js   (печатает ✗, код выхода 1 при провале)
const L = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

let tested = 0;
for (const seed of [3, 5, 7, 11, 13, 17]) {
  const sim = L.newSim(seed), h = sim.h, J = c => JSON.parse(h.run('JSON.stringify((function(){' + c + '})())'));
  h.run('seaFix(2)');                          // зима, лёд 1
  L.stepN(sim, 40);
  // берег с водой не меньше 3 клеток; на другой стороне воды — суша другой связной области (река/озеро с обходом бывает и без)
  const sc = J(`
    pfRegions();
    for (let y = 4; y < MAP_H - 4; y += 2) for (let x = 4; x < MAP_W - 4; x += 2) {
      if (!isWalkable(x, y) || World.door[idx(x, y)]) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        let n = 0; while (n < 12 && inb(x + dx * (n + 1), y + dy * (n + 1)) && World.terrain[idx(x + dx * (n + 1), y + dy * (n + 1))] === T_WATER) n++;
        const fx = x + dx * (n + 1), fy = y + dy * (n + 1);
        if (n >= 3 && n < 12 && inb(fx, fy) && isWalkable(fx, fy) && PF.reg[idx(fx, fy)] && PF.reg[idx(fx, fy)] !== PF.reg[idx(x, y)])
          return { home: [x, y], far: [fx, fy], mid: [x + dx * 2, y + dy * 2], n };
      }
    }
    return null;`);
  if (!sc) continue;
  tested++;
  const reg = c => h.run(`(PF.regT = -1e9, pfRegions(), PF.reg[idx(${c[0]}, ${c[1]})])`);
  const put = (x, y) => J(`const u = Game.units.find(u => !u.dead && isPerson(u) && u.type !== 'hero' && !u.inside); u.proc = null; u.action = null; u.x = ${x} + 0.5; u.y = ${y} + 0.5; u.skateHome = [${sc.home[0]}, ${sc.home[1]}]; u.fun = null; return u.id;`);
  const where = id => J(`const u = Game.unitMap.get(${id}); return [Math.floor(u.x), Math.floor(u.y)];`);
  // 1) катание оборвали посреди льда: возвращаем на свой берег, а не на чужой
  let id = put(sc.mid[0], sc.mid[1]);
  L.stepN(sim, 30);
  let w = where(id);
  ok(reg(w) === reg(sc.home), `сид ${seed}: гном со льда попал на чужой берег ${w}`);
  ok(J(`return World.terrain[idx(${w[0]}, ${w[1]})] !== T_WATER`), `сид ${seed}: гном остался на воде`);
  // 2) уже оказался на чужом берегу: через несколько секунд дома
  id = put(sc.far[0], sc.far[1]);
  L.stepN(sim, 240);
  w = where(id);
  ok(reg(w) !== reg(sc.far), `сид ${seed}: гном застрял на чужом берегу ${w}`);
  // 3) герой едет по льду на тот берег
  const hs = J(`const u = Game.hero; if (!u) return null; u.proc = null; u.action = null; u.x = ${sc.home[0]} + 0.5; u.y = ${sc.home[1]} + 0.5; issueCmd(u, resolveCmd([${sc.far[0]}, ${sc.far[1]}])); return { kind: u.cmd && u.cmd.kind };`);
  ok(hs && hs.kind === 'move', `сид ${seed}: герой не принял команду идти на тот берег`);
  const t0 = h.run('Game.time');
  L.runFor(sim, 40, 1, () => {});
  const hp = J(`const u = Game.hero; return [u.x, u.y];`);
  ok(Math.hypot(hp[0] - sc.far[0] - 0.5, hp[1] - sc.far[1] - 0.5) < 1.5, `сид ${seed}: герой не докатился (${hp.map(v => v.toFixed(1))} вместо ${sc.far})`);
  // клик по самой воде — команда «Кататься»
  const lab = J(`return resolveCmd([${sc.mid[0]}, ${sc.mid[1]}])`);
  ok(lab && lab.label === 'Кататься', `сид ${seed}: клик по льду не даёт «Кататься»`);
  // без льда герой по воде не ходит
  h.run('seaFix(0); SEA().ice = 0; SEA().snow = 0');
  ok(J(`return resolveCmd([${sc.mid[0]}, ${sc.mid[1]}])`) === null, `сид ${seed}: летом клик по воде что-то делает`);
  ok(sim.errors.length === 0, `сид ${seed}: исключения: ${sim.errors.join('; ')}`);
}
ok(tested >= 2, `сидов с рекой и двумя областями слишком мало: ${tested}`);
console.log(fails.length ? `skate-test: ${fails.length} ✗` : `skate-test: всё в порядке (сидов с рекой: ${tested})`);
process.exit(fails.length ? 1 : 0);
