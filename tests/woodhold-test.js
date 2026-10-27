'use strict';
// Зимний запас дров не душит стройку (отзыв владельца 27.10: «на носу зима, брёвна не уходят в лесопилку — здания не достраиваются»).
// Осень, брёвен на складе меньше, чем нужно на зиму, досок нет, стройки ждут доски: лесопилка должна получить брёвна
// и напилить ровно под стройки; стройке с брёвнами в смете брёвна дают из запаса. Без строек лесопилка впрок не пилит.
// Запуск: node tests/woodhold-test.js
const S = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };
const info = m => console.log('Проверка: ' + m);

function scene(withSites) {
  const sim = S.newSim(9), R = s => sim.h.run(s);
  S.stepN(sim, 20 * 5);
  S.botPlace(sim, 'sawmill');
  R('for (const s of [...Game.roadSites.values()]) completeRoad(s); for (const b of Game.buildings) if (b.type === "sawmill" && b.state !== "done") finishBuilding(b);');
  if (withSites) for (const t of ['house', 'woodcutter']) { S.botPlace(sim, t); R('for (const s of [...Game.roadSites.values()]) completeRoad(s)'); }
  // печи: пара готовых домов в стороне (дороги им не нужны — только для расчёта зимней нормы)
  R(`const hub = Game.buildings.find(b => b.isStore()); let n = 0;
    for (let r = 8; r < 40 && n < 6; r++) for (let a = 0; a < 24 && n < 6; a++) {
      const x = Math.round(hub.doorX + Math.cos(a * 0.26 + r) * r * 1.6), y = Math.round(hub.doorY + Math.sin(a * 0.26 + r) * r);
      if (inb(x, y) && !checkPlacement('house', x, y, 0)) { const b = placeBuilding('house', x, y, true, 0); b.state = 'done'; b.hold = false; n++; }
    }
    SEA().fixed = null; SEA().off = 8 + 1 - cycleAt(Game.time).k;
    for (const s of Game.buildings) if (s.isStore()) { s.stock.timber = 0; s.stock.trunk = 0; }
    hub.stock.trunk = 20; SEA().holdWT = null; SEA().tsT = null;`);
  const st = JSON.parse(R('JSON.stringify({ sea: seaIdx(), low: seaWoodLow(), hold: seaWoodHold(), need: seaWoodInfo().need })'));
  return { sim, R, st };
}
const look = R => JSON.parse(R(`JSON.stringify({ timber: Game.produced.timber | 0,
  sites: Game.buildings.filter(b => b.state !== 'done').length,
  trunk: Game.buildings.filter(b => b.isStore()).reduce((n, b) => n + b.stock.trunk, 0) })`));

// 1. стройки ждут доски — лесопилка пилит, стройки идут
{
  const { sim, R, st } = scene(true);
  info(`осень: зимний запас ${st.hold} брёвен на склад, нужно на зиму ${st.need}, «дров мало» ${st.low}`);
  ok(st.sea === 1 && st.low, 'сценарий: должна быть осень с нехваткой дров');
  const a = look(R);
  S.runFor(sim, 4 * 60, 10, () => {});
  const b = look(R);
  info(`за 4 мин: доски ${a.timber}→${b.timber}, строек ${a.sites}→${b.sites}, брёвен на складах ${a.trunk}→${b.trunk}`);
  ok(b.timber > a.timber, 'стройки ждут доски, а лесопилка не напилила ни одной (брёвна заперты зимним запасом)');
  ok(b.sites < a.sites, `ни одна стройка не достроилась за 4 минуты (было ${a.sites}, стало ${b.sites})`);
  ok(!sim.errors.length, 'исключения: ' + sim.errors.slice(0, 2).join(' | '));
}
// 2. строек нет — запас держится, впрок не пилим
{
  const { sim, R } = scene(false);
  const a = look(R);
  S.runFor(sim, 3 * 60, 10, () => {});
  const b = look(R);
  info(`без строек за 3 мин: доски ${a.timber}→${b.timber}, брёвен на складах ${a.trunk}→${b.trunk}`);
  ok(b.timber === a.timber, `без строек лесопилка пилит зимний запас впрок: досок ${a.timber}→${b.timber}`);
  ok(!sim.errors.length, 'исключения: ' + sim.errors.slice(0, 2).join(' | '));
}

console.log(fails.length ? `\nПровалено: ${fails.length}` : '\nЗимний запас и стройка: OK');
process.exit(fails.length ? 1 : 0);
