'use strict';
// Фонари (world/night.js): днём все погашены, вечером зажигаются, на рассвете гаснут — и уличные, и в руках у гномов.
// Жалоба: «Фонари у гномов зажглись днём». Старый «забытый» фонарь (u.lantern = true со вчера) не должен светить в светлое время.
// Запуск: node tests/lantern-test.js
const S = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

for (const seed of [11, 22]) {
  const h = S.newSim(seed).h;
  const at = (day, p) => {          // состояние фонарей в секунде p суток номер day (обычные сутки; 4 — пятые, длинная ночь)
    return JSON.parse(h.run(`JSON.stringify((() => {
      let t = 0; for (let k = 0; k < ${day}; k++) t += cycleAt(t).nl === NIGHT_LEN ? CYCLE : CYCLE + LONG_EXTRA;
      Game.time = t + ${p};
      const c = cycleAt(Game.time);
      const u = Game.units.find(u => isPerson(u) && !u.dead && !u.inside);
      u.lantern = true;          // фонарь «со вчера»
      Game.units.forEach(x => { if (isPerson(x)) x.lantern = true; });
      const ls = nightLights(0, 0, MAP_W, MAP_H);
      const lamps = Game.units.filter(x => isPerson(x) && !x.dead && !x.inside && lanternLit(x)).length;
      return { p: c.p, nl: c.nl, on: lampsOn(), hand: lanternLit(u), handN: lamps, lights: ls.length, night: nightAmt() };
    })())`));
  };
  const base = at(0, 0).lights;
  for (const day of [0, 1, 4, 5]) {
    const nl = at(day, 0).nl, dawnEnd = 220 + 80 + 20 + nl + 25;
    // день: от рассвета до начала вечера — ни одного фонаря
    for (const p of [0, 60, 150, 219]) {
      const r = at(day, p);
      ok(!r.on && !r.hand && r.handN === 0, `сид ${seed}, сутки ${day}, ${p}с (день): фонари горят`);
      ok(r.lights === base, `сид ${seed}, сутки ${day}, ${p}с (день): фонари дают свет в карте света`);
    }
    // вечер и ночь — горят
    for (const p of [260, 320, 400, 220 + 100 + nl - 1]) {
      const r = at(day, p);
      ok(r.on && r.hand && r.handN > 0, `сид ${seed}, сутки ${day}, ${p}с (вечер/ночь): фонари не горят`);
    }
    // конец рассвета и новое утро — погашены
    for (const p of [dawnEnd - 1, dawnEnd + 5]) {
      const q = p >= dawnEnd ? p - dawnEnd + 0 : p;
      const r = p >= dawnEnd ? at(day + 1, p - dawnEnd) : at(day, p);
      ok(!r.on && !r.hand, `сид ${seed}, сутки ${day}, ${p}с (рассвет кончился): фонари ещё горят (ночь ${r.night.toFixed(2)})`);
    }
  }
  console.log(`сид ${seed}: фазы суток проверены`);
}
if (fails.length) { console.log(`✗ провалов: ${fails.length}`); process.exit(1); }
console.log('✓ фонари: днём выключены, вечером горят, на рассвете гаснут');
process.exit(0);
