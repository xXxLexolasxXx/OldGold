'use strict';
// Ледяной элементаль: зимний нейтрал (season.js рождает его логова с первым снегом и растапливает весной).
// Кадры — тот же набор, что у других нейтралов (neutralart.js): покой 6, ходьба 8, БОЙ 9, смерть 6, торжество 4.
// Ледяной воин из кристаллов: ножки-столбики, тело-призма, плечи-шипы, рука с ледяным клинком, голова-алмаз
// с голубыми глазами. Смерть: трещины, он рассыпается в груду осколков (последние кадры — растворение пикселями).
// Логово — «Ледяной шпиль»: три кристалла на снежной проплешине (живое — с мерцающим сердцем; разбитое — тёмные осколки).

const ICE = { hi: '#eefcff', lt: '#c4ecfb', md: '#86c8ea', dk: '#4c92c4', dp: '#2c5f96', glow: '#7af0ff' };

function drawFrost(c, P) {
  naShadow(c, 9);
  const k = col => naK(P, col);
  if (P.dead) {   // груда осколков
    const f = 1 - P.fade * 0.5;
    for (const [x, y, w, h, col] of [[-8, -1, 5, 4, ICE.dk], [-2, -2, 6, 6, ICE.md], [5, -1, 5, 4, ICE.lt], [-4, -5, 4, 6, ICE.lt], [2, -4, 4, 5, ICE.dk], [9, 0, 3, 2, ICE.md], [-11, 0, 3, 2, ICE.lt]])
      poly(c, [[x - w / 2, y], [x - w * 0.2, y - h * f], [x + w * 0.5, y - h * 0.4 * f], [x + w / 2, y]], col);
    c.fillStyle = 'rgba(255,255,255,0.9)'; for (const [x, y] of [[-3, -7], [3, -6], [0, -9]]) c.fillRect(x, y, 1, 1);
    return;
  }
  c.save();
  c.translate(P.x, P.y);
  c.rotate(P.rot);
  c.scale(1 / Math.sqrt(P.sq), P.sq);
  const sw = P.leg;
  // ноги: ледяные столбики-призмы с лапами-осколками
  for (const [sx, col, col2] of [[-1, ICE.dk, ICE.dp], [1, ICE.md, ICE.dk]]) {
    const fx = sx * (3.4 + Math.abs(sw) * 0.2) + sx * sw * 2.6;
    poly(c, [[sx * 2.4 - 2.4, -9], [sx * 2.4 + 2.4, -9], [fx + 2.6, -1], [fx - 2.6, -1]], k(col));
    poly(c, [[sx * 2.4 - 2.4, -9], [sx * 2.4 - 0.4, -9], [fx - 0.2, -1], [fx - 2.6, -1]], k(col2));
    poly(c, [[fx - 3.4, -1], [fx - 2, -3], [fx + 3.8, -1.4], [fx + 4.4, 0.4], [fx - 3.4, 0.4]], k(ICE.lt));
  }
  // дальняя рука
  naArm(c, -6.4, -21, 4.2, 4, P.up > 0.5 ? -2.8 : 0.1, 0.3, 2.4, k(ICE.dk));
  // тело: призма с гранями
  const body = [[-7.4, -9.5], [7.4, -9.5], [9.2, -18], [5, -27], [-5, -27], [-9.2, -18]];
  poly(c, body, k(ICE.md));
  poly(c, [[-7.4, -9.5], [-1.4, -9.5], [-1.6, -27], [-5, -27], [-9.2, -18]], k(ICE.lt));
  poly(c, [[1.6, -9.5], [7.4, -9.5], [9.2, -18], [5, -27], [2.4, -27]], k(ICE.dk));
  c.strokeStyle = k(ICE.hi); c.lineWidth = 0.7;
  c.beginPath(); c.moveTo(-6, -12); c.lineTo(-6.6, -22); c.moveTo(-1.4, -10); c.lineTo(-1.6, -26); c.stroke();
  // сердце-кристалл в груди: светится
  const gl = 0.7 + 0.3 * Math.sin(P.x * 0.5 + P.y);
  poly(c, [[0, -21.5], [2.4, -17.5], [0, -13.5], [-2.4, -17.5]], k('#e8ffff'));
  poly(c, [[0, -20], [1.4, -17.5], [0, -15], [-1.4, -17.5]], k(ICE.glow));
  c.fillStyle = `rgba(150,240,255,${0.35 * gl})`; c.beginPath(); c.arc(0, -17.5, 4.2, 0, 7); c.fill();
  // трещины после ударов
  if (P.hurt > 0.3 || P.eye === 3) { c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(-4, -26); c.lineTo(-1, -19); c.lineTo(-5, -13); c.moveTo(3, -24); c.lineTo(5, -18); c.stroke(); }
  // плечевые шипы
  poly(c, [[-9.4, -21], [-8, -27], [-11.6, -31], [-6.4, -25]], k(ICE.lt));
  poly(c, [[9.4, -21], [8.2, -27], [11.8, -31], [6.6, -25]], k(ICE.md));
  // голова: алмаз с шипами-короной
  const hx = P.a > 0.5 ? 1.4 : 0, hy = -29 + (P.hurt > 0.5 ? 1 : 0);
  poly(c, [[hx - 4.4, hy - 1], [hx - 2.4, hy - 5.6], [hx + 2.4, hy - 5.6], [hx + 4.4, hy - 1], [hx, hy + 3]], k(ICE.lt));
  poly(c, [[hx + 0.4, hy - 5.6], [hx + 2.4, hy - 5.6], [hx + 4.4, hy - 1], [hx, hy + 3]], k(ICE.md));
  for (const [dx, h] of [[-3.2, 5.5], [0, 7.4], [3.2, 5.5]]) poly(c, [[hx + dx - 1.1, hy - 5.4], [hx + dx, hy - 5.4 - h], [hx + dx + 1.1, hy - 5.4]], k(ICE.hi));
  if (P.eye === 2) { c.strokeStyle = '#1c4a78'; c.lineWidth = 0.55; for (const ex of [-1.8, 2]) { c.beginPath(); c.moveTo(hx + ex - 1, hy - 1); c.lineTo(hx + ex + 1, hy - 0.8); c.stroke(); } }
  else if (P.eye === 3) { c.strokeStyle = '#1c4a78'; c.lineWidth = 0.55; for (const ex of [-1.8, 2]) { c.beginPath(); c.moveTo(hx + ex - 0.9, hy - 1.8); c.lineTo(hx + ex + 0.9, hy - 0.2); c.moveTo(hx + ex + 0.9, hy - 1.8); c.lineTo(hx + ex - 0.9, hy - 0.2); c.stroke(); } }
  else for (const ex of [-1.8, 2]) { ellipse(c, hx + ex, hy - 1, 1.15, P.eye === 1 ? 0.7 : 1.1, ICE.glow); c.fillStyle = '#ffffff'; c.fillRect(hx + ex - 0.3, hy - 1.4, 0.7, 0.7); }
  if (P.mouth > 0.4) ellipse(c, hx + 0.2, hy + 1.2, 1.1, 0.9 * P.mouth, '#1c3a5e');
  // ближняя рука с ледяным клинком
  const th = P.up > 0.5 ? -2.9 : P.a > 0 ? 0.8 + P.a * 0.8 : 0.4 + P.a * 1.3;
  const [hx2, hy2, ang] = naArm(c, 6.4, -21, 4.4, 4.2, th, -0.35, 2.6, k(ICE.md));
  ellipse(c, hx2, hy2, 1.8, 1.8, k(ICE.lt));
  // клинок: растёт из кулака; на замахе — длинный
  const [bx, by] = naDir(ang + 0.15), L = P.b > 0.5 ? 6 : 11 + (P.a > 0.5 ? 2 : 0);
  poly(c, [[hx2 - by * 1.6, hy2 + bx * 1.6], [hx2 + bx * L, hy2 + by * L], [hx2 + by * 1.6, hy2 - bx * 1.6]], k(ICE.hi));
  poly(c, [[hx2, hy2], [hx2 + bx * L, hy2 + by * L], [hx2 + by * 1.6, hy2 - bx * 1.6]], k(ICE.lt));
  if (P.b > 0.5) {   // парирование: ледяной щит из льдинок перед собой
    poly(c, [[9, -26], [14, -22], [14, -10], [9, -7], [6, -16]], k(ICE.hi)); poly(c, [[9, -26], [14, -22], [14, -10], [9, -7]], k(ICE.lt));
  }
  // холод: колючие снежинки вокруг при ударе, рыке, колдовстве и торжестве
  const cold = (P.a > 0.5 ? 1 : 0) + (P.mouth > 0.7 ? 1 : 0) + (P.up > 0.5 ? 1 : 0);
  if (cold) for (const [dx, dy] of [[13, -14], [16, -19], [11, -9], [15, -8], [-12, -17]]) { c.fillStyle = 'rgba(235,252,255,0.95)'; c.fillRect(dx - 0.8, dy - 0.8, 1.6, 1.6); c.fillRect(dx - 0.3, dy - 1.8, 0.7, 3.6); c.fillRect(dx - 1.8, dy - 0.3, 3.6, 0.7); }
  c.restore();
}

NA_SPEC.frost = { name: 'Ледяной элементаль', w: 100, h: 96, ax: 56, ay: 82, sc: 1.4 };
NA_DRAW.frost = drawFrost;
NA_LAIR.frost = { name: 'Ледяной шпиль', w: 92, h: 92, ax: 46, ay: 70 };

{
  const _lair = naLairDraw;
  naLairDraw = function (c, kind, v) {
    if (kind !== 'frost') return _lair(c, kind, v);
    const dead = v === 'd', f = v === '1' ? 1 : 0;
    // снежная проплешина
    c.fillStyle = '#dfe9f4'; c.beginPath(); c.ellipse(0, 2, 34, 9.5, 0, 0, 7); c.fill();
    c.fillStyle = '#bcd0e6'; c.beginPath(); c.ellipse(5, 4, 26, 6, 0, 0, 7); c.fill();
    c.fillStyle = '#f6fbff'; c.beginPath(); c.ellipse(-8, 0, 18, 5, 0, 0, 7); c.fill();
    const col = dead ? ['#8aa0b4', '#6a8096', '#4a6074'] : [ICE.lt, ICE.md, ICE.dk];
    const spike = (x, w, h, lean, shade0) => {
      const tipx = x + lean, tipy = -h;
      poly(c, [[x - w, 0], [x - w * 0.8, -h * 0.55], [tipx, tipy], [x + w * 0.8, -h * 0.5], [x + w, 0]], col[shade0]);
      poly(c, [[x - w, 0], [x - w * 0.8, -h * 0.55], [tipx, tipy], [x - w * 0.1, -h * 0.4], [x - w * 0.2, 0]], shade(col[shade0], 0.22));
      poly(c, [[x + w * 0.35, 0], [x + w * 0.2, -h * 0.4], [tipx, tipy], [x + w * 0.8, -h * 0.5], [x + w, 0]], shade(col[shade0], -0.24));
      c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(x - w * 0.5, -3); c.lineTo(x - w * 0.55, -h * 0.55); c.stroke();
    };
    if (dead) {
      spike(-16, 5, 14, -3, 1); spike(10, 6, 12, 5, 2);
      for (const [x, y] of [[-6, 1], [3, 2], [20, 1], [-22, 2]]) poly(c, [[x - 3, y], [x, y - 4], [x + 3, y]], col[1]);
      return;
    }
    spike(-18, 5.5, 26, -4, 1); spike(16, 6, 30, 5, 2); spike(-6, 7, 40, -2, 0); spike(6, 5, 22, 4, 1);
    // сердце шпиля
    const g = f ? 0.9 : 0.55;
    c.fillStyle = `rgba(150,240,255,${g * 0.5})`; c.beginPath(); c.arc(-6, -18, 10, 0, 7); c.fill();
    poly(c, [[-6, -26], [-3, -18], [-6, -10], [-9, -18]], '#e8ffff');
    poly(c, [[-6, -23], [-4.4, -18], [-6, -13], [-7.6, -18]], ICE.glow);
    // инеевые искры
    for (const [x, y, p] of [[-20, -30, 0], [0, -46, 1], [18, -36, 2], [-12, -8, 3], [24, -14, 4]]) { c.fillStyle = (f + p) % 2 ? '#ffffff' : '#bfefff'; c.fillRect(x - 0.8, y - 0.8, 1.6, 1.6); }
  };
}

// ---------- Параметры и подключение к нейтралам (neutrals.js грузится раньше) ----------

if (typeof NSPEC !== 'undefined') {
NSPEC.frost = { name: 'Ледяной элементаль', mhp: 72, dmg: [5, 8], cd: 1.6, rng: 1.8, spd: 1.8, parry: 0.12, xp: 80, roam: 3, sz: 11,
  drop: [['mana', 2, 0.7], ['magicstone', 1, 0.6], ['gold', 2, 0.5]], msg: ['Хруст-хруст!', 'Зима не любит гостей!', 'Заморожу!', 'Холодно? Будет холоднее!'] };
NLAIR.frost = ['frost'];
NEU_LAIR_NAME.frost = 'Ледяной шпиль';

{
  const _strike = neuStrike;
  neuStrike = function (N, tg) {
    _strike(N, tg);
    if (N.k !== 'frost') return;
    fxBurst(tg.x * TILE, tg.y * TILE - 12, 9, ['#ffffff', '#c4ecfb', '#86c8ea'], 55, 40, 0.6, 1.5, 120);
    if (Math.random() < 0.4) floater(tg.x, tg.y - 2.1, 'Брр!', '#bfefff');
    sfxAt('chime', tg.x * TILE, tg.y * TILE, 0.4);
  };
  const _hit = neuHit;
  neuHit = function (N, u, dmg) {
    const was = N.hp;
    _hit(N, u, dmg);
    if (N.k === 'frost' && N.hp < was) fxBurst(N.x * TILE, N.y * TILE - 14, 8, ['#ffffff', '#c4ecfb', '#86c8ea'], 60, 40, 0.5, 1.6, 200);
  };
}
}
