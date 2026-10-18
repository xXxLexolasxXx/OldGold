'use strict';
// Фляжки: после стройки гном достаёт фляжку из-за пазухи и делает глоток.
// Рядом (в клетке) такой же — чокаются. От фляжки не пьянеют по-настоящему (никакого сна и шатания),
// но от тоста нос краснеет: гном ходит с красным носом несколько минут.

const FLASK_CLINK_R = 1.05;          // радиус «чокнуться»
const NOSE_TIME = 180;               // сколько держится красный нос, с

function* flaskGen(u, opt = {}) {
  if (!u || u.dead || u.inside) return;
  u.flaskT = Game.time + 6;                      // «с фляжкой» — другие могут чокнуться
  u.flaskClinkAt = 0;
  yield { wait: 0.9, anim: 'flaskout' };         // достаёт из-за пазухи
  // сосед в радиусе клетки, тоже со фляжкой
  let mate = null;
  for (const o of Game.units) {
    if (o === u || o.dead || o.inside || !(o.flaskT > Game.time) || o.flaskClinkAt > Game.time - 3) continue;
    if (Math.hypot(o.x - u.x, o.y - u.y) <= FLASK_CLINK_R) { mate = o; break; }
  }
  if (mate) {
    u.face = mate.x > u.x ? 1 : -1; u.vdir = 'E';
    yield { wait: 0.35 };
    u.flaskClinkAt = mate.flaskClinkAt = Game.time;
    const mx = (u.x + mate.x) / 2, my = (u.y + mate.y) / 2 - 1.1;
    fxBurst(mx * TILE, my * TILE, 6, ['#fff2a0', '#dfe8f0', '#ffffff'], 40, 30, 0.3, 1.2, 100);
    sfxAt('five', mx * TILE, my * TILE, 0.7);
    floater(mx, my - 0.4, 'Чин-чин!', '#fff2a0');
    if (!opt.noNose && Math.random() < 0.25) redNose(u);
    if (!opt.noNose && Math.random() < 0.25) redNose(mate);
  }
  yield { wait: 1.5 + Math.random() * 0.6, anim: 'drink' };
  if (!opt.noNose && !mate && Math.random() < 0.06) redNose(u);
  u.flaskT = 0;
}

function redNose(u) {
  if (u.type === 'hero') return;                 // герой всегда трезв
  u.noseUntil = Game.time + NOSE_TIME * (0.7 + Math.random() * 0.6);
}

// красный нос — поверх спрайта головы
function drawRedNose(c, u, px, py, view, face) {
  if (!(u.noseUntil > Game.time)) return;
  const fade = Math.min(1, (u.noseUntil - Game.time) / 12);
  c.globalAlpha = 0.5 + 0.5 * fade;
  const nx = view === 'S' ? px : px + face * 4.2, ny = py - 16.4;
  c.fillStyle = '#c8302a'; c.fillRect(Math.round(nx - 1), Math.round(ny - 1), 3, 2);
  c.fillStyle = '#ff7a64'; c.fillRect(Math.round(nx - 1), Math.round(ny - 1), 1, 1);
  c.globalAlpha = 1;
}
