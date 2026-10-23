'use strict';
// Акт 1, задание «Поставить сторожевую башню у штрека»: башня на самом входе штрека (63,20 — отчёт 261023-1542-0e76) засчитывается,
// башня в глубине ниши, далеко от штрека и недостроенная — нет.
const { createHost } = require('../server/simhost');
const fails = [];
const fail = m => { fails.push(m); console.log('✗ ' + m); };
const h = createHost(() => {});
h.run('campStart(1); Game.heroAsk = false;');
const ok = (x, y, state) => h.run(`(function () { const o = CAMP_ACTS[1].steps.flatMap(s => s.objs || []).find(o => o.id === 'tower'); const b = { type: 'watchtower', x: ${x}, y: ${y}, state: '${state || 'done'}', removed: false }; Game.buildings.push(b); const v = o.cur() > 0; Game.buildings.pop(); return v; })()`);
const base = h.run("CAMP_ACTS[1].steps.flatMap(s => s.objs || []).find(o => o.id === 'tower').cur() > 0");
if (base) fail('до постройки башни задание уже засчитано');
for (const [x, y, want, why] of [[63, 20, true, 'башня на входе штрека (из отчёта)'], [64, 24, true, 'башня южнее входа'], [64, 16, false, 'башня в глубине ниши'], [100, 60, false, 'башня далеко']]) {
  if (ok(x, y) !== want) fail(`${why} (${x},${y}): ожидали ${want}`);
}
if (ok(63, 20, 'build')) fail('недостроенная башня засчитана');
if (fails.length) process.exit(1);
console.log('camp-tower: ok');
process.exit(0);
