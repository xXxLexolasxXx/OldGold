'use strict';
// Лесные нейтралы: пиксель-арт кадры. Четыре вида (лесная фея, леший, кабан-страж, чумной моховик),
// у каждого по 25 кадров: покой 2 + ходьба 4 + БОЙ 9 + смерть 6 + торжество 4.
//
// Бой — ровно 9 кадров, как просили: 1 стойка, 2 шаг в выпад, 3 замах, 4 удар, 5 возврат,
// 6 парирование, 7 получение урона, 8 пошатнулся, 9 рёв-зов своих.
// Смерть — 6 кадров: удар, отшатнулся, падает, лежит, тает, остаётся пыль. Меньше — падение выглядит прыжком,
// больше — затягивается и мешает игроку собирать добычу; 6 кадров по 0,11 с = 0,66 с самого падения плюс
// «растворение» ещё 1,4 с на последних двух кадрах (альфа гасится при отрисовке, а не новыми кадрами).
// Победа — 4 кадра (пинг-понг: поднял руки, подпрыгнул, пик, опустил) — крутится по кругу, пока рядом лежит поверженный.
//
// Рисуется векторно в 3× и сводится в пиксели (toPixelArt) — тот же конвейер, что у деревьев, гномов и нечисти.
// Все кадры смотрят вправо, влево — отражением при отрисовке. Начало координат — точка земли под ногами.

const NA_FRAMES = {
  idle: ['i0', 'i1'],
  walk: ['w0', 'w1', 'w2', 'w3'],
  fight: ['ready', 'step', 'windup', 'strike', 'recover', 'parry', 'hurt', 'stagger', 'roar'],
  die: ['d0', 'd1', 'd2', 'd3', 'd4', 'd5'],
  win: ['v0', 'v1', 'v2', 'v3'],
};
const NA_ALL = [].concat(NA_FRAMES.idle, NA_FRAMES.walk, NA_FRAMES.fight, NA_FRAMES.die, NA_FRAMES.win);

// Общая таблица поз; рисовалка каждого вида читает только то, что ей нужно.
// x,y — сдвиг тела; rot — наклон; a — рука/голова/оружие: −1 замах … 0 готов … 1 удар; up — руки вверх;
// b — защита (парирование); leg — фаза шага −1…1; mouth — рот; eye — 0 обычный, 1 злой, 2 зажмурен, 3 крестик;
// hurt — «белая вспышка» от удара; sq — растяжение; wing — взмах; fade — растворение; dead — лежит
function naPose(n) {
  const w = { w0: 0, w1: 1, w2: 0, w3: -1 };
  const T = {
    i0: { y: 0, wing: 0 }, i1: { y: -1, wing: 1, a: 0.05 },
    w0: { leg: 0, wing: -1 }, w1: { leg: 1, y: -1, wing: 1 }, w2: { leg: 0, wing: -1 }, w3: { leg: -1, y: -1, wing: 1 },
    ready: { eye: 1, a: 0, wing: 0 },
    step: { x: 2, leg: 0.9, a: 0.15, eye: 1, wing: 1 },
    windup: { x: -2, rot: -0.1, a: -1, eye: 1, wing: -1 },
    strike: { x: 5, rot: 0.18, a: 1, eye: 1, mouth: 0.6, wing: 1 },
    recover: { x: 2, rot: 0.06, a: 0.35, eye: 1, wing: 0 },
    parry: { x: -2, rot: -0.08, b: 1, a: -0.2, eye: 1, wing: -1 },
    hurt: { x: -4, rot: -0.22, hurt: 1, eye: 2, mouth: 0.8, wing: -1 },
    stagger: { x: -2, rot: 0.14, hurt: 0.55, eye: 2, y: 1, wing: 1 },
    roar: { y: -1, rot: -0.14, a: -0.6, mouth: 1, eye: 1, sq: 1.08, wing: 1 },
    d0: { x: -4, rot: -0.25, hurt: 1, eye: 2, mouth: 0.6, wing: -1 },
    d1: { x: -6, rot: -0.6, y: 0, hurt: 0.7, eye: 3, a: -0.5, wing: 1 },
    d2: { x: -8, rot: -1.1, y: -1, hurt: 0.4, eye: 3, a: -0.2, wing: -1 },
    d3: { x: -9, rot: -1.5, y: -3, eye: 3, dead: 1, wing: 0 },
    d4: { x: -9, rot: -1.5, y: -3, eye: 3, dead: 1, fade: 0.45 },
    d5: { x: -9, rot: -1.5, y: -3, eye: 3, dead: 1, fade: 0.85 },
    v0: { up: 1, eye: 0, mouth: 0.3, wing: 1 },
    v1: { up: 1, y: -5, eye: 0, mouth: 1, wing: -1 },
    v2: { up: 1, y: -1, eye: 0, mouth: 0.4, wing: 1 },
    v3: { up: 0.2, a: 0.2, rot: 0.05, eye: 0, mouth: 0.5, wing: 0 },
  };
  const p = Object.assign({ x: 0, y: 0, rot: 0, a: 0, up: 0, b: 0, leg: 0, mouth: 0, eye: 0, hurt: 0, sq: 1, wing: 0, fade: 0, dead: 0 }, T[n]);
  if (w[n] !== undefined) p.leg = w[n];
  return p;
}

const NA_SPEC = {
  pixie:   { name: 'Цветочная фея', w: 84, h: 72, ax: 54, ay: 54, sc: 1.55, pal: { dr: '#8a6ad8', dr2: '#5a3aa0', hr: '#f2f4ff', hr2: '#a8acd8', tip: '#ffb0e0', crown: true } },
  fairy:   { name: 'Лесная фея',    w: 84, h: 72, ax: 54, ay: 54, sc: 1.55 },
  leshy:   { name: 'Леший',         w: 108, h: 72, ax: 68, ay: 66 },
  boar:    { name: 'Кабан-страж',   w: 84, h: 60, ax: 42, ay: 50, sc: 1.25 },
  spore:   { name: 'Чумной моховик', w: 90, h: 64, ax: 54, ay: 54, sc: 1.2 },
};

const naCache = new Map();
function naHash(a, b) { const n = Math.sin(a * 127.1 + b * 311.7 + 374.5) * 43758.5453; return n - Math.floor(n); }

function naFrame(kind, fr) {
  const key = kind + '|' + fr;
  let s = naCache.get(key);
  if (s) return s;
  const S = NA_SPEC[kind];
  const [cv, c] = mkSprite(S.w, S.h, 3);
  c.lineCap = 'round'; c.lineJoin = 'round';
  const P = naPose(fr);
  P.pal = S.pal || null;
  c.save();
  c.translate(S.ax, S.ay);
  if (S.sc) c.scale(S.sc, S.sc);
  NA_DRAW[kind](c, P, fr);
  c.restore();
  const out = toPixelArt(cv, 3, { outline: true, outlineDark: 0.3, alphaCut: 100 });
  if (P.fade > 0) {   // рассыпается пикселями: случайные точки пропадают (пиксель-арт «дизер»), остальные бледнеют
    const oc = out.getContext('2d'), img = oc.getImageData(0, 0, out.width, out.height), d = img.data;
    for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) {
      const o = (y * out.width + x) * 4;
      if (!d[o + 3]) continue;
      if (naHash(x, y) < P.fade) d[o + 3] = 0;
      else { d[o] = d[o] + (230 - d[o]) * P.fade * 0.4; d[o + 1] = d[o + 1] + (240 - d[o + 1]) * P.fade * 0.4; d[o + 2] = d[o + 2] + (200 - d[o + 2]) * P.fade * 0.4; }
    }
    oc.putImageData(img, 0, 0);
  }
  s = { cv: out, ax: S.ax, ay: S.ay, w: S.w, h: S.h };
  naCache.set(key, s);
  return s;
}

// ---------- общие помощники ----------

const naK = (P, col) => (P.hurt > 0.01 ? shade(col, P.hurt * 0.26) : col);
const naDir = a => [Math.sin(a), Math.cos(a)];   // угол от «вниз» вперёд
function naLimb(c, x0, y0, x1, y1, w, col) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
// двухзвенная рука: плечо → локоть → кисть, угол направления в ra
function naArm(c, sx, sy, L1, L2, th, bend, w, col) {
  const [dx, dy] = naDir(th), [ex, ey] = naDir(th + bend);
  const mx = sx + dx * L1, my = sy + dy * L1, hx = mx + ex * L2, hy = my + ey * L2;
  naLimb(c, sx, sy, mx, my, w, col); naLimb(c, mx, my, hx, hy, w * 0.9, col);
  return [hx, hy, th + bend];
}
// угол замаха из позы: −1 → вверх-назад, 0 → готов, 1 → вперёд-вниз-в-цель; руки вверх (торжество) — поверх всего
function naTheta(P) {
  if (P.up > 0.5) return -3.0 + (1 - P.up) * 2.4;
  return P.a < 0 ? 0.7 + P.a * 3.2 : 0.7 + P.a * 0.9;
}
function naShadow(c, w, k = 1) { c.fillStyle = 'rgba(10,8,4,0.32)'; c.beginPath(); c.ellipse(0, 0.5, w, w * 0.28, 0, 0, 7); c.fill(); }
function naEye(c, x, y, P, col, r = 1) {
  if (P.eye === 3) { c.strokeStyle = '#1a0f0a'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(x - 0.8, y - 0.8); c.lineTo(x + 0.8, y + 0.8); c.moveTo(x + 0.8, y - 0.8); c.lineTo(x - 0.8, y + 0.8); c.stroke(); return; }
  if (P.eye === 2) { c.strokeStyle = '#1a0f0a'; c.lineWidth = 0.55; c.beginPath(); c.moveTo(x - 1, y); c.lineTo(x + 0.8, y + 0.2); c.stroke(); return; }
  ellipse(c, x, y, r, r * (P.eye === 1 ? 0.7 : 1), col || '#1a0f0a');
  if (P.eye === 1) { c.strokeStyle = '#1a0f0a'; c.lineWidth = 0.55; c.beginPath(); c.moveTo(x - 1.4, y - 1.5); c.lineTo(x + 1.2, y - 0.4); c.stroke(); }
}

// =============== Лесная фея ===============
function drawFairy(c, P) {
  const lift = 9 + (P.dead ? -9 : 0);
  naShadow(c, 5.5 - lift * 0.18);
  c.save();
  c.translate(P.x, P.y - lift);
  c.rotate(P.rot);
  const SK = '#f8dcc0', PL = P.pal || {}, DR = naK(P, PL.dr || '#4cae3c'), DR2 = naK(P, PL.dr2 || '#2e7a2c'), HR = naK(P, PL.hr || '#f6d458'), HR2 = naK(P, PL.hr2 || '#c8921e'), WG = P.dead ? 'rgba(236,250,236,0.55)' : 'rgba(240,252,236,0.72)';
  const fl = P.wing;
  // дальнее крыло
  const wt = -6 + (P.dead ? 6 : 0) - fl * 5;
  poly(c, [[-1, -9], [-8, wt - 4], [-10.4, wt + 1], [-4.4, -6]], 'rgba(200,232,200,0.6)', 'rgba(110,170,120,0.9)', 0.35);
  // ноги
  const sw = P.leg * 1.4;
  naLimb(c, -1, -4.5, -1.5 + sw, -0.5, 1.1, SK); naLimb(c, 1, -4.5, 1.2 - sw, -0.5, 1.1, SK);
  // платье-колокольчик
  poly(c, [[-2, -10], [2, -10], [4.6 + P.leg * 0.4, -3.6], [-4.4 - P.leg * 0.4, -3.6]], DR);
  poly(c, [[-2, -10], [0.4, -10], [0, -3.6], [-4.4, -3.6]], DR2);
  c.fillStyle = naK(P, '#d8f6a8'); c.fillRect(-4.4, -4.2, 8.8, 0.9);   // подол из листочков
  // торс и рука с волшебной палочкой
  ellipse(c, 0, -11, 2.5, 2.7, DR);
  const th = naTheta(P);
  const sx = 1.2, sy = -11.5;
  const [hx, hy, ang] = naArm(c, sx, sy, 3.4, 3.2, th, -0.5 + P.b * 0.6, 1.1, SK);
  if (P.b > 0.5) {   // парирование: крыло-щит и круг света
    c.strokeStyle = 'rgba(190,255,230,0.9)'; c.lineWidth = 0.7; c.beginPath(); c.arc(5, -11, 5.5, -1.2, 1.2); c.stroke();
  }
  const [wx, wy] = naDir(ang + 0.2);
  naLimb(c, hx, hy, hx + wx * 6.5, hy + wy * 6.5, 0.8, '#7a5a34');
  const tipx = hx + wx * 6.8, tipy = hy + wy * 6.8;
  c.save(); c.globalCompositeOperation = 'lighter';
  ellipse(c, tipx, tipy, 2.2 + (P.a > 0.5 ? 1.5 : 0), 2.2 + (P.a > 0.5 ? 1.5 : 0), 'rgba(255,240,140,0.55)');
  c.restore();
  ellipse(c, tipx, tipy, 1.1, 1.1, PL.tip || '#fff6b0');
  if (P.a > 0.5 || P.up > 0.5) for (const [dx, dy] of [[3, -2], [2, 2.4], [4.4, 0.4], [-1, -3]]) { c.fillStyle = '#fff6b0'; c.fillRect(tipx + dx - 0.4, tipy + dy - 0.4, 0.8, 0.8); }
  // голова
  const hy0 = -15.2 + (P.hurt > 0.5 ? 0.6 : 0);
  poly(c, [[-3.8, hy0 - 1], [-2, hy0 - 4.6], [2.4, hy0 - 4.4], [3.4, hy0 - 0.4], [1, hy0 + 1.8], [-3.6, hy0 + 3.4]], HR2);   // волосы сзади
  ellipse(c, 0.6, hy0, 3.1, 3.3, SK);
  poly(c, [[-2.4, hy0 - 2.2], [0.5, hy0 - 4.2], [3.6, hy0 - 1.6], [2.6, hy0 - 2.4], [0.2, hy0 - 3.2]], HR);                        // чёлка
  ellipse(c, -2.3, hy0 - 3.8, 1.6, 1.4, HR);                                                                                      // пучок
  poly(c, [[3.2, hy0 - 0.8], [6, hy0 - 2.2], [3.6, hy0 + 0.2]], SK);                                                              // острое ушко
  if (PL.crown) for (const [fx, fy, fc] of [[-1.6, -4.4, '#ff8ac8'], [1.2, -5, '#ffe070'], [3.4, -3.4, '#ff8ac8']]) ellipse(c, fx, hy0 + fy + 0.6, 0.95, 0.95, fc);
  naEye(c, 1.9, hy0 - 0.1, P, '#1a3a4a', 0.75);
  if (P.mouth > 0.4) ellipse(c, 2.2, hy0 + 1.7, 0.8, 0.9 * P.mouth, '#8a2a3a');
  else { c.fillStyle = '#c85a6a'; c.fillRect(1.6, hy0 + 1.5, 1, 0.5); }
  // ближнее крыло (поверх)
  const wt2 = -9 - fl * 5 + (P.dead ? 7 : 0);
  poly(c, [[-0.4, -10.5], [-6.8, wt2 - 3.6], [-9.6, wt2 + 2.6], [-3.4, -6.6]], WG, 'rgba(110,170,120,0.95)', 0.35);
  c.strokeStyle = 'rgba(255,255,255,0.65)'; c.lineWidth = 0.3; c.beginPath(); c.moveTo(-0.4, -10.5); c.lineTo(-8.6, wt2 - 0.5); c.stroke();
  c.restore();
}

// =============== Леший ===============
function drawLeshy(c, P) {
  naShadow(c, 12);
  c.save();
  c.translate(P.x, P.y);
  c.rotate(P.rot);
  c.scale(1, P.sq);
  const BK = naK(P, '#8c6438'), BK2 = naK(P, '#62442a'), BK3 = naK(P, '#b08048'), MS = naK(P, '#62943a'), MS2 = naK(P, '#456f2a'), BD = naK(P, '#7eac4a');
  const sw = P.leg;
  // корневые ноги
  naLimb(c, -3.5, -14, -4 - sw * 3, -0.5, 4.2, BK2); naLimb(c, 3.5, -14, 4.5 + sw * 3, -0.5, 4.2, BK);
  poly(c, [[-7 - sw * 3, 0], [-3 - sw * 3, -2.4], [-1 - sw * 3, 0]], BK2); poly(c, [[2 + sw * 3, 0], [6 + sw * 3, -2.6], [9 + sw * 3, 0]], BK);
  // дальняя рука
  const th2 = P.b > 0.5 ? -1.1 : P.up > 0.5 ? -2.7 : 0.15 - P.a * 0.4;
  naArm(c, -4, -30, 8, 8, th2, P.b > 0.5 ? 1.7 : 0.35, 2.4, BK2);
  // ствол-туловище
  poly(c, [[-6.8, -14], [6.8, -14], [8, -32], [5, -37], [-5, -37], [-8, -32]], BK);
  poly(c, [[-6.8, -14], [-2.4, -14], [-3, -37], [-5, -37], [-8, -32]], BK2);
  c.strokeStyle = BK3; c.lineWidth = 0.7; for (const [x0, y0, x1, y1] of [[3, -16, 2.4, -26], [5.4, -20, 5, -31], [-0.5, -22, -1, -33]]) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
  ellipse(c, 1.5, -20, 1.6, 1.1, BK2);                                       // сучок
  // мох-накидка на плечах
  poly(c, [[-8, -33], [8.4, -33], [7, -28], [4, -30], [1, -26.6], [-3, -30], [-6.6, -27.4]], MS);
  c.fillStyle = MS2; c.fillRect(-4, -31, 2, 1.2); c.fillRect(2.4, -30.4, 2, 1.2);
  // голова: узловатая, борода-мох, рога-ветви
  const hy = -42 + (P.hurt > 0.5 ? 1 : 0), hx = 1 + (P.a > 0.5 ? 1.5 : 0);
  poly(c, [[hx - 4, hy - 7], [hx - 7, hy - 14], [hx - 5.4, hy - 14.4], [hx - 3, hy - 9]], BK2);                         // ветви-рога
  poly(c, [[hx + 3, hy - 7], [hx + 6, hy - 15], [hx + 7.4, hy - 13], [hx + 5.4, hy - 6]], BK);
  poly(c, [[hx + 5.6, hy - 12.4], [hx + 9, hy - 14], [hx + 8, hy - 12]], BK);
  c.fillStyle = MS; c.fillRect(hx - 8, hy - 14.6, 1.6, 1.4); c.fillRect(hx + 7, hy - 15.4, 1.6, 1.4);
  ellipse(c, hx, hy, 6.4, 6.6, BK);
  ellipse(c, hx - 2.2, hy, 4, 6, BK2);
  poly(c, [[hx - 6, hy + 1], [hx + 6, hy + 1], [hx + 4, hy + 9], [hx + 1, hy + 11 + (P.mouth > 0.5 ? 2 : 0)], [hx - 3, hy + 8]], BD);   // борода
  c.fillStyle = MS2; c.fillRect(hx - 2, hy + 4, 1.4, 4); c.fillRect(hx + 1.4, hy + 3, 1.4, 4.4);
  ellipse(c, hx + 3.6, hy + 0.2, 1.6, 1.4, '#e6f060');                                                                        // глаза светятся
  ellipse(c, hx - 1.2, hy + 0.2, 1.4, 1.2, '#e6f060');
  if (P.eye === 2) { c.fillStyle = BK2; c.fillRect(hx - 3, hy - 1.4, 8, 2.6); naEye(c, hx + 3.6, hy + 0.2, P); naEye(c, hx - 1.2, hy + 0.2, P); }
  else if (P.eye === 3) { naEye(c, hx + 3.6, hy + 0.2, P); naEye(c, hx - 1.2, hy + 0.2, P); }
  else { c.fillStyle = '#1a2a08'; c.fillRect(hx + 3.2, hy - 0.4, 0.9, 1.3); c.fillRect(hx - 1.6, hy - 0.4, 0.9, 1.3); if (P.eye === 1) { c.strokeStyle = BK2; c.lineWidth = 0.9; c.beginPath(); c.moveTo(hx - 3, hy - 2.4); c.lineTo(hx + 0.6, hy - 0.8); c.moveTo(hx + 2, hy - 0.8); c.lineTo(hx + 6, hy - 2.6); c.stroke(); } }
  ellipse(c, hx + 6.2, hy + 3, 1.4, 1.2, BK2);                                                                               // нос-сучок
  // ближняя рука с дубиной
  const th = naTheta(P);
  const [hx2, hy2, ang] = naArm(c, 5, -31, 8.4, 8.6, th, P.up > 0.5 ? 0.2 : -0.5, 3, BK);
  ellipse(c, hx2, hy2, 2.3, 2.3, BK3);
  const [cx, cy] = naDir(ang + 0.15);
  const cl = 15;
  c.strokeStyle = naK(P, '#74502a'); c.lineWidth = 3.4; c.beginPath(); c.moveTo(hx2 - cx * 3, hy2 - cy * 3); c.lineTo(hx2 + cx * cl, hy2 + cy * cl); c.stroke();
  c.strokeStyle = naK(P, '#a67840'); c.lineWidth = 1; c.beginPath(); c.moveTo(hx2 - cx * 3 - 0.7, hy2 - cy * 3); c.lineTo(hx2 + cx * cl - 0.7, hy2 + cy * cl); c.stroke();
  ellipse(c, hx2 + cx * cl, hy2 + cy * cl, 3.6, 3.4, naK(P, '#74502a'));   // набалдашник
  c.fillStyle = naK(P, '#a67840'); c.fillRect(hx2 + cx * cl - 2.4, hy2 + cy * cl - 2.2, 1.4, 1.2);
  if (P.a > 0.6) { c.strokeStyle = 'rgba(255,255,230,0.75)'; c.lineWidth = 0.7; c.beginPath(); c.arc(hx2, hy2, cl + 3, ang - 1.3, ang - 0.2); c.stroke(); }   // дуга замаха
  if (P.mouth > 0.7) for (const [dx, dy] of [[9, -2], [11, 1], [10.4, -5]]) { c.fillStyle = '#c8e878'; c.fillRect(hx + dx, hy + dy, 0.9, 0.9); }   // рёв — летят листья
  c.restore();
}

// =============== Кабан-страж ===============
function drawBoar(c, P) {
  c.save();
  c.translate(P.x, P.y);
  if (P.up > 0.5) { c.translate(-10, 0); c.rotate(-0.38 * P.up); c.translate(10, 0); }   // торжество: встал на дыбы
  c.rotate(P.dead ? 0 : P.rot * 0.4);
  if (P.dead) { c.translate(0, -13); c.scale(1, -1); c.translate(0, 13); }               // лежит на боку: ноги торчат вверх
  c.scale(1, P.sq);
  const FU = naK(P, '#6a5240'), FU2 = naK(P, '#463428'), FU3 = naK(P, '#86684c'), MS = naK(P, '#5a8a38'), MS2 = naK(P, '#3e6a28'), TU = '#f2eacc';
  const sw = P.leg, dead = P.dead;
  const lunge = P.a > 0 ? P.a : 0, paw = P.a < 0 ? -P.a : 0;
  // ноги: задние и передние, фаза шага
  const leg = (x, ph, front) => {
    const lift = front && paw > 0.3 ? 5 : Math.max(0, ph) * 2.6;
    naLimb(c, x, -9, x + (front ? 1.6 : -1.2) + ph * 2.4, -0.4 - lift, 2.9, front ? FU : FU2);
    ellipse(c, x + (front ? 1.8 : -1) + ph * 2.4, -0.7 - lift, 1.9, 1.1, '#2a1c14');
  };
  leg(-9, -sw, false); leg(5, -sw, true);
  // туловище
  ellipse(c, -2, -13.4, 14.4, 8.8, FU);
  ellipse(c, -4, -9.6, 11, 5.2, FU2);
  ellipse(c, -1, -17.6, 10, 4, FU3);
  // моховая накидка с грибочками на спине
  poly(c, [[-12, -17.4], [-6, -22.6], [2, -22.8], [8, -19.6], [6, -17.4], [1, -19.2], [-4, -17.6], [-8, -19]], MS);
  c.fillStyle = MS2; c.fillRect(-9, -19.4, 3, 1.2); c.fillRect(1.4, -20.4, 3, 1.2);
  ellipse(c, -2, -23, 1.8, 1.2, '#c8483a'); c.fillStyle = '#f6ece0'; c.fillRect(-2.8, -23.4, 0.8, 0.8); c.fillRect(-1, -22.8, 0.8, 0.7);
  c.fillStyle = FU2; c.fillRect(-1.6, -22, 1.2, 1.4);
  // шерстяной гребень
  for (let k = 0; k < 5; k++) poly(c, [[-11 + k * 3.4, -21], [-9.6 + k * 3.4, -25.4 - (k % 2)], [-8 + k * 3.4, -21.4]], FU2);
  // хвост
  naLimb(c, -16, -15, -19.5, -17 - P.hurt * 2 + sw, 1, FU2); ellipse(c, -19.8, -17.4 + sw, 1, 1, FU2);
  // голова: наклоняется вниз в атаке, вверх при замахе
  const hy = -13.4 + lunge * 3 - paw * 3, hx = 13 + lunge * 5.6 - paw * 1.4;
  poly(c, [[7, -18.4], [hx + 0.5, hy - 5], [hx + 8, hy - 1], [hx + 10, hy + 2.4], [hx + 3, hy + 4.6], [6, -8]], FU);
  poly(c, [[6, -9.4], [hx + 3, hy + 4.6], [hx + 9, hy + 3], [hx + 2, hy + 6.4], [4, -6]], FU2);
  ellipse(c, hx + 9.8, hy + 1.5, 2.8, 2.2, naK(P, '#8e6a58'));
  c.fillStyle = '#1a0f0a'; c.fillRect(hx + 10.6, hy + 0.4, 1, 1.1); c.fillRect(hx + 11.8, hy + 1.2, 0.8, 1);   // ноздри
  poly(c, [[hx + 5, hy + 2.6], [hx + 10.4, hy + 3], [hx + 11, hy - 2.4], [hx + 8.4, hy + 0.6]], TU);                     // клык
  poly(c, [[hx + 3, hy + 3.2], [hx + 6.8, hy + 4.4], [hx + 6.4, hy + 1.6]], '#d8cfae');
  if (P.mouth > 0.4) { c.fillStyle = '#6a1a1a'; c.fillRect(hx + 4.6, hy + 4, 5, 1.6); }
  poly(c, [[hx - 2.4, hy - 4.8], [hx + 0.6, hy - 9.2], [hx + 3.2, hy - 5]], FU2);                                         // ухо
  naEye(c, hx + 5, hy - 1.8, P, '#f0d838', 0.9);
  if (P.eye === 1) { c.fillStyle = '#1a0f0a'; c.fillRect(hx + 4.6, hy - 2.2, 0.8, 0.8); }
  // ближняя пара ног поверх
  leg(-5, sw, false); leg(9, sw, true);
  if (lunge > 0.6) { c.strokeStyle = 'rgba(255,255,230,0.7)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(hx + 12, hy - 5); c.lineTo(hx + 17, hy - 6); c.moveTo(hx + 12, hy + 5); c.lineTo(hx + 17, hy + 6); c.stroke(); }   // скорость
  if (paw > 0.3) for (const [dx, dy] of [[20, -1], [23, 0.4], [18, 0.8]]) { c.fillStyle = '#8a7058'; c.fillRect(dx, dy - 1, 1.2, 1.2); }   // пыль из-под копыта
  if (P.b > 0.5) { c.strokeStyle = 'rgba(200,236,160,0.85)'; c.lineWidth = 0.9; c.beginPath(); c.arc(hx + 6, hy, 7, -1.2, 1.2); c.stroke(); }    // парирование: клык отводит удар
  c.restore();
}

// =============== Чумной моховик ===============
function drawSpore(c, P) {
  naShadow(c, 9);
  c.save();
  c.translate(P.x, P.y);
  c.rotate(P.rot);
  c.scale(1 / Math.sqrt(P.sq), P.sq);
  const CAP = naK(P, '#8a48b0'), CAP2 = naK(P, '#62308a'), CAP3 = naK(P, '#b676d6'), ST = naK(P, '#cfd2bc'), ST2 = naK(P, '#9ea48e'), SP = '#eee0f8';
  const sw = P.leg;
  // ножки
  naLimb(c, -2.6, -10, -3 - sw * 2.2, -0.5, 2.6, ST2); naLimb(c, 2.6, -10, 3 + sw * 2.2, -0.5, 2.6, ST);
  ellipse(c, -3.4 - sw * 2.2, -0.8, 2.6, 1.2, ST2); ellipse(c, 3.6 + sw * 2.2, -0.8, 2.8, 1.2, ST);
  // дальняя ручка
  naArm(c, -4.6, -13, 4, 4, P.up > 0.5 ? -2.8 : 0.1, 0.4, 1.8, ST2);
  // ножка-тело
  poly(c, [[-5, -9], [5, -9], [4.4, -18], [-4.4, -18]], ST);
  poly(c, [[-5, -9], [-1.6, -9], [-1.6, -18], [-4.4, -18]], ST2);
  c.fillStyle = naK(P, '#9a8e6c'); c.fillRect(-4.8, -13, 9.6, 1);                               // кольцо на ножке
  // лицо на ножке
  const fx = 1.6;
  if (P.eye < 2) { ellipse(c, fx + 1.8, -15, 1.7, 1.7, '#f4f0d8'); ellipse(c, fx - 2.4, -15, 1.7, 1.7, '#f4f0d8'); ellipse(c, fx + 2.2, -15, 0.95, 0.95, '#1a1208'); ellipse(c, fx - 2, -15, 0.95, 0.95, '#1a1208'); if (P.eye === 1) { c.strokeStyle = '#3a1a2a'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(fx - 4.4, -17.2); c.lineTo(fx - 0.6, -15.8); c.moveTo(fx + 0.4, -15.8); c.lineTo(fx + 4, -17.4); c.stroke(); } }
  else { naEye(c, fx + 1.8, -15, P, '#2a1a08', 1.1); naEye(c, fx - 2.4, -15, P, '#2a1a08', 1.1); }
  if (P.mouth > 0.4) ellipse(c, fx - 0.4, -12.8, 1.5, 1.1 * P.mouth, '#4a1a2a'); else { c.fillStyle = '#6a3a3a'; c.fillRect(fx - 1.4, -13, 2.6, 0.6); }
  // шляпка: качается; парирование — опущена как зонт; удар — бьёт вперёд
  const tilt = P.a * 0.28 - (P.b > 0.5 ? -0.25 : 0), capY = -18 + (P.b > 0.5 ? 2.6 : 0) + (P.hurt > 0.5 ? 1.6 : 0), cr = P.dead ? 0.6 : 1;
  c.save(); c.translate(0.6, capY); c.rotate(tilt);
  poly(c, [[-12, 0.8], [12.4, 0.8], [10.4, -4], [6, -8.4 * cr], [0, -9.8 * cr], [-6, -8.4 * cr], [-10.4, -4]], CAP);
  poly(c, [[-12, 0.8], [-3, 0.8], [-3.6, -9.4 * cr], [-6, -8.4 * cr], [-10.4, -4]], CAP2);
  poly(c, [[1.4, -9.4 * cr], [6, -8 * cr], [9.6, -4.2], [5.4, -6], [2, -7.4 * cr]], CAP3);
  for (const [sx, sy, r] of [[-4, -3.2, 1.6], [3.4, -5.4, 1.4], [7.4, -2, 1.2], [-8, -1.4, 1]]) ellipse(c, sx, sy * cr, r, r * 0.8, SP);
  c.fillStyle = naK(P, '#5a2a78'); for (let k = -10; k <= 10; k += 3.4) c.fillRect(k, 0.4, 1.2, 1.6);    // пластинки снизу
  c.restore();
  // ближняя ручка
  const th = P.up > 0.5 ? -2.9 : P.a > 0 ? 0.8 + P.a * 0.8 : 0.4 + P.a * 1.3;
  naArm(c, 4.6, -13, 4.2, 4, th, -0.4, 1.9, ST);
  // споры: при ударе и рёве — зелёное облачко вперёд, при торжестве — маленькие
  const puff = (P.a > 0.5 ? 1 : 0) + (P.mouth > 0.7 ? 0.7 : 0) + (P.dead && P.fade < 0.9 ? 0.5 : 0);
  if (puff > 0) for (const [dx, dy, r] of [[10, -12, 2.6], [13.4, -14.4, 2.2], [15.6, -10.6, 1.8], [12, -9, 1.5], [8.6, -15.6, 1.4]]) { c.fillStyle = `rgba(160,236,90,${Math.min(0.8, puff * 0.6)})`; c.beginPath(); c.arc(dx, dy, r * Math.min(1.2, puff), 0, 7); c.fill(); }
  if (P.dead) for (const [dx, dy] of [[-6, -9], [2, -12], [8, -8], [-2, -16]]) { c.fillStyle = 'rgba(200,255,140,0.8)'; c.fillRect(dx, dy, 1, 1); }
  c.restore();
}

const NA_DRAW = { pixie: drawFairy, fairy: drawFairy, leshy: drawLeshy, boar: drawBoar, spore: drawSpore };

// ---------- Логова ----------
// У каждого логова 3 вида: кадры 0 и 1 (живое, огоньки/дым/свет чуть иные) и 'd' — разорено (зачищено, потухло, поблекло).
const NA_LAIR = {
  pixie: { name: 'Домик цветочных фей', w: 84, h: 76, ax: 42, ay: 56 },
  fairy: { name: 'Грибное кольцо фей',  w: 92, h: 64, ax: 46, ay: 36 },
  leshy: { name: 'Дупло лешего',        w: 96, h: 92, ax: 48, ay: 78 },
  boar:  { name: 'Лёжка кабанов',       w: 96, h: 64, ax: 48, ay: 38 },
  spore: { name: 'Пятно чумных грибов', w: 88, h: 64, ax: 44, ay: 38 },
};
const NA_LAIR_VARS = ['0', '1', 'd'];
const naLairCache = new Map();

// мазок «объём»: свет сверху-слева, тень справа-снизу; pts — контур, base — цвет
function naBlob(c, pts, base, lit = 0.28, dark = -0.32) {
  poly(c, pts, base);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  c.save();
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); c.clip();
  c.fillStyle = shade(base, dark); c.beginPath(); c.ellipse(x1 + (x1 - x0) * 0.1, y1 + (y1 - y0) * 0.2, (x1 - x0) * 0.75, (y1 - y0) * 0.7, 0, 0, 7); c.fill();
  c.fillStyle = shade(base, lit); c.beginPath(); c.ellipse(x0 + (x1 - x0) * 0.2, y0 + (y1 - y0) * 0.15, (x1 - x0) * 0.4, (y1 - y0) * 0.28, -0.4, 0, 7); c.fill();
  c.restore();
}
function naPuff(c, x, y, r, col, a) { c.fillStyle = col.replace('A', a.toFixed(2)); c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
function naShroomB(c, x, y, s, cap, spot, dead) {
  const st = dead ? '#9a9480' : '#ece0c4', cp = dead ? shade(cap, -0.1) : cap;
  naBlob(c, [[x - 1.1 * s, y], [x - 0.9 * s, y - 4.6 * s], [x + 0.9 * s, y - 4.6 * s], [x + 1.2 * s, y]], st, 0.2, -0.28);
  naBlob(c, [[x - 4.2 * s, y - 3.8 * s], [x - 3.4 * s, y - 6.8 * s], [x - 0.8 * s, y - 8.6 * s], [x + 2 * s, y - 8.4 * s], [x + 4 * s, y - 6.4 * s], [x + 4.4 * s, y - 3.8 * s], [x, y - 3 * s]], cp, 0.3, -0.34);
  if (!dead) { c.fillStyle = spot; c.fillRect(x - 2.2 * s, y - 6.8 * s, 1.1 * s, 1.1 * s); c.fillRect(x + 0.8 * s, y - 7.4 * s, 1.1 * s, 1.1 * s); c.fillRect(x + 2.2 * s, y - 5.6 * s, 0.9 * s, 0.9 * s); }
}
function naSparks(c, pts, t, col) {
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const [x, y, p] of pts) { const a = 0.5 + 0.5 * Math.sin(t * 3 + p); c.fillStyle = col.replace('A', a.toFixed(2)); c.fillRect(Math.round(x - 0.7), Math.round(y - 0.7), 1.6, 1.6); }
  c.restore();
}

function naLairDraw(c, kind, v) {
  const dead = v === 'd', f = v === '1' ? 1 : 0, R = mulberry32(kind.length * 977 + 11);
  if (kind === 'pixie') {
    // тень и тропинка из плиток
    c.fillStyle = '#4a4430'; c.beginPath(); c.ellipse(1, 1, 24, 6.4, 0, 0, 7); c.fill();
    for (const [x, y, r] of [[2, 6, 3.2], [-3, 9.6, 2.8], [4, 12.6, 2.6]]) { ellipse(c, x, y, r, r * 0.55, dead ? '#8a8472' : '#b8b09a'); ellipse(c, x - 0.6, y - 0.5, r * 0.6, r * 0.3, dead ? '#a09a86' : '#d6cdb4'); }
    // ножка: бочка с корой-узором
    naBlob(c, [[-9, 0], [-8, -16], [-6, -26], [6, -26], [8, -16], [9, 0]], dead ? '#a89c80' : '#f0e2c2', 0.22, -0.3);
    c.strokeStyle = dead ? '#8a7e66' : '#d4c2a0'; c.lineWidth = 0.7; for (const x of [-4, 0, 4]) { c.beginPath(); c.moveTo(x, -3); c.lineTo(x + 0.4, -22); c.stroke(); }
    // дверка с аркой
    naBlob(c, [[-3.6, 0], [-3.6, -9], [-2, -12.4], [2, -12.4], [3.6, -9], [3.6, 0]], dead ? '#4a3a2a' : '#7a4a26', 0.2, -0.4);
    if (dead) { poly(c, [[0.4, 0], [3.6, -1], [3.6, -9], [0.4, -11]], '#14100a'); }
    else { c.fillStyle = '#e8c850'; c.fillRect(1.7, -5.4, 1, 1); c.strokeStyle = '#4a2a14'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(0, -11.6); c.lineTo(0, 0); c.stroke(); }
    // круглое окошко
    const glow = dead ? '#2a2820' : f ? '#fff2a0' : '#ffd860';
    ellipse(c, 6.2, -17, 3.1, 3.1, '#6a4a2a'); ellipse(c, 6.2, -17, 2.2, 2.2, glow);
    if (!dead) { c.strokeStyle = '#6a4a2a'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(6.2, -19.2); c.lineTo(6.2, -14.8); c.moveTo(4, -17); c.lineTo(8.4, -17); c.stroke(); }
    // шляпка-крыша
    const cap = dead ? '#9a6a5a' : '#e0486e';
    naBlob(c, [[-24, -20], [-22, -29], [-15, -38], [-5, -43], [6, -43], [15, -38], [22, -29], [24, -20], [14, -22.4], [0, -24], [-14, -22.4]], cap, 0.3, -0.36);
    c.fillStyle = shade(cap, -0.45); for (let x = -20; x <= 20; x += 5) c.fillRect(x, -21.2 + Math.abs(x) * 0.02, 2.4, 2.4);   // пластинки по краю
    if (!dead) for (const [x, y, r] of [[-12, -31, 3.2], [0, -38, 2.8], [11, -30, 2.6], [-3, -27, 1.8], [18, -25, 1.8], [-19, -24, 1.6]]) { ellipse(c, x, y, r, r * 0.78, '#fff4f8'); ellipse(c, x - r * 0.3, y - r * 0.3, r * 0.45, r * 0.3, '#ffffff'); }
    // труба с дымком
    naBlob(c, [[10, -37], [10.6, -46], [14.6, -46], [15, -37]], dead ? '#7a6a58' : '#8a6a4a', 0.2, -0.3);
    if (!dead) { naPuff(c, 12.6 + f * 1.4, -50 - f * 1.5, 2.2, 'rgba(240,240,248,A)', 0.8); naPuff(c, 14 - f, -56 - f * 2, 2.8, 'rgba(240,240,248,A)', 0.55); naPuff(c, 12 + f * 2, -62, 3, 'rgba(240,240,248,A)', 0.3); }
    // цветы у крыльца
    for (const [x, y, col] of [[-16, 2, '#ff8ac8'], [-12, 4, '#ffe070'], [-20, 4, '#a8e0ff'], [15, 3, '#c8a0ff'], [20, 5, '#ff8ac8'], [12, 6, '#ffe070']]) {
      const sw = dead ? 0 : (f ? 0.8 : -0.8);
      naLimb(c, x, y, x + sw, y - (dead ? 2 : 5), 0.8, dead ? '#6a6a3a' : '#3e8a30');
      ellipse(c, x + sw, y - (dead ? 1.4 : 5.6), 1.7, dead ? 0.9 : 1.7, dead ? '#8a7a6a' : col); if (!dead) ellipse(c, x + sw, y - 5.6, 0.6, 0.6, '#fff6b0');
    }
    if (!dead) naSparks(c, [[-26, -30, 0 + f], [26, -24, 2 + f], [-18, -44, 4 + f * 2], [22, -40, 6 + f], [0, -50, 1 + f]], f * 1.7, 'rgba(255,240,170,A)');
    else { c.strokeStyle = 'rgba(230,230,230,0.8)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(-14, -20); c.lineTo(-4, -26); c.moveTo(-14, -26); c.lineTo(-4, -22); c.stroke(); }   // паутина
  } else if (kind === 'fairy') {
    c.fillStyle = dead ? 'rgba(120,120,90,0.2)' : 'rgba(110,210,160,0.3)'; c.beginPath(); c.ellipse(0, 0, 34, 12.6, 0, 0, 7); c.fill();
    c.strokeStyle = dead ? 'rgba(160,150,120,0.5)' : (f ? 'rgba(220,255,236,0.8)' : 'rgba(190,255,220,0.6)'); c.lineWidth = 0.8; c.beginPath(); c.ellipse(0, 0, 30, 10.8, 0, 0, 7); c.stroke();
    // центр: плоский камень-алтарь с кристаллом
    naBlob(c, [[-7, 1], [-8, -4], [-4, -7], [5, -7], [9, -3], [8, 1]], dead ? '#7a7870' : '#9a9a9a', 0.28, -0.34);
    if (!dead) { poly(c, [[-2, -7], [0, -17 - f], [3, -7]], f ? '#d8f6ff' : '#a8e8ff'); poly(c, [[-1, -7], [0, -17 - f], [0.6, -7]], '#ffffff'); c.save(); c.globalCompositeOperation = 'lighter'; ellipse(c, 0.6, -11, 6 + f * 1.5, 7 + f * 1.5, 'rgba(160,240,255,0.25)'); c.restore(); }
    // кольцо из грибов и цветов
    const n = 14;
    const items = [];
    for (let k = 0; k < n; k++) { const a = k / n * 6.283 + 0.2, x = Math.cos(a) * 30, y = Math.sin(a) * 10.8; items.push([x, y, k]); }
    items.sort((a, b) => a[1] - b[1]);
    for (const [x, y, k] of items) {
      if (k % 3 === 0) naShroomB(c, x, y + 1.5, 1.35, dead ? '#9a7a6a' : '#e85a4a', '#fff0e0', dead);
      else if (k % 3 === 1) { naLimb(c, x, y + 1, x, y - 4, 0.8, dead ? '#6a6a3a' : '#3e8a30'); ellipse(c, x, y - 4.6, 1.9, 1.9, dead ? '#8a7a6a' : '#f4a8d8'); if (!dead) ellipse(c, x, y - 4.6, 0.7, 0.7, '#fff0a0'); }
      else naShroomB(c, x, y + 1.5, 0.95, dead ? '#8a7a8a' : '#e0a8f0', '#fff', dead);
    }
    if (!dead) naSparks(c, [[-22, -10, f], [18, -14, 2 + f], [-8, -18, 4], [26, -4, 1 + f * 2], [-28, -2, 3 + f], [6, -22, 5 + f], [0, -4, 7 + f]], f * 1.5, 'rgba(255,244,170,A)');
  } else if (kind === 'leshy') {
    c.fillStyle = '#4a4430'; c.beginPath(); c.ellipse(0, 1, 30, 7.4, 0, 0, 7); c.fill();
    const BK = dead ? '#6a5a46' : '#7a5632', MS = dead ? '#6a6a3a' : '#62943a';
    // корни
    for (const [x, d] of [[-22, -1], [-17, -1], [20, 1], [25, 1]]) naBlob(c, [[x, 1], [x + d * 6, -3], [x + d * 11, 1], [x + d * 7, 3]], BK, 0.2, -0.34);
    // ствол-пень
    naBlob(c, [[-20, 1], [-16, -12], [-13, -30], [-17, -48], [-9, -44], [-3, -54], [4, -46], [11, -53], [14, -44], [19, -40], [15, -28], [18, -12], [22, 1]], BK, 0.24, -0.36);
    c.strokeStyle = dead ? '#4a3c2c' : '#5a3c20'; c.lineWidth = 0.9; for (const [x0, y0, x1, y1] of [[-10, -6, -11, -38], [-4, -8, -5, -44], [8, -6, 9, -40], [14, -10, 15, -34]]) { c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2 + 1.4, (y0 + y1) / 2, x1, y1); c.stroke(); }
    // дупло — лицо
    poly(c, [[-8, 0], [-9, -10], [-6, -20], [0, -24], [6, -20], [9, -10], [8, 0]], '#120a05');
    poly(c, [[-5, -3], [-6, -10], [-3, -16], [0, -18], [3, -16], [6, -10], [5, -3]], '#1c1008');
    if (!dead) {
      const ec = f ? '#fff08a' : '#d8e84a';
      ellipse(c, -2.6, -14.4, 1.7, 1.2 - f * 0.2, ec); ellipse(c, 3, -14.4, 1.7, 1.2 - f * 0.2, ec);
      c.save(); c.globalCompositeOperation = 'lighter'; ellipse(c, 0.2, -14.4, 8, 4, 'rgba(210,235,60,' + (f ? 0.22 : 0.14) + ')'); c.restore();
      c.fillStyle = '#1a2a08'; c.fillRect(-3, -14.8, 0.8, 1.2); c.fillRect(2.6, -14.8, 0.8, 1.2);
    }
    // мох сверху, свисающие лианы
    naBlob(c, [[-19, -44], [-9, -44], [-3, -54], [4, -46], [11, -53], [15, -44], [19, -40], [8, -36], [-4, -40], [-16, -36]], MS, 0.28, -0.32);
    for (const [x, l] of [[-14, 14], [-6, 10], [6, 16], [13, 11]]) { c.strokeStyle = dead ? '#5a5a30' : '#4a7a2a'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(x, -38); c.quadraticCurveTo(x + (f ? 2 : -2), -38 + l * 0.5, x + (f ? 1 : -1), -38 + l); c.stroke(); }
    // рога-ветви
    naLimb(c, -9, -50, -16, -64, 3, dead ? '#4a3c2c' : '#5a3c20'); naLimb(c, -14, -60, -20, -62, 2, dead ? '#4a3c2c' : '#5a3c20'); naLimb(c, 11, -50, 17, -66, 3, dead ? '#4a3c2c' : '#5a3c20'); naLimb(c, 15, -60, 21, -60, 2, dead ? '#4a3c2c' : '#5a3c20');
    if (!dead) { ellipse(c, -17, -64, 2.4, 1.8, '#7ab04a'); ellipse(c, 18, -66, 2.6, 1.8, '#7ab04a'); }
    // тотем-череп на колу
    naLimb(c, 26, 1, 26, -18, 1.8, '#5a3c20'); ellipse(c, 26, -20, 3.2, 3, dead ? '#b8b09a' : '#e6dcc0'); c.fillStyle = '#1a120a'; c.fillRect(24.4, -21, 1.4, 1.6); c.fillRect(27, -21, 1.4, 1.6);
    naShroomB(c, -26, 3, 1.4, dead ? '#8a7a56' : '#c8883a', '#f6e8c0', dead); naShroomB(c, -22, 4, 0.9, dead ? '#8a7a56' : '#c8883a', '#f6e8c0', dead); naShroomB(c, 30, 4, 1.2, dead ? '#8a7a56' : '#c8883a', '#f6e8c0', dead);
    if (!dead) naSparks(c, [[-26, -30, f], [24, -34, 3 + f], [0, -30, 5]], f * 1.4, 'rgba(210,240,110,A)');
    else { naLimb(c, 14, -2, 30, 2, 2.6, '#4a3c2c'); }   // упавшая ветка
  } else if (kind === 'boar') {
    c.fillStyle = dead ? '#5a5240' : '#5a4630'; c.beginPath(); c.ellipse(0, 0, 38, 12.6, 0, 0, 7); c.fill();
    c.fillStyle = dead ? '#4a4434' : '#3e2e1c'; c.beginPath(); c.ellipse(2, 1.6, 28, 8.4, 0, 0, 7); c.fill();
    // следы копыт
    c.fillStyle = dead ? '#3a3628' : '#2e2014'; for (const [x, y] of [[-30, 6], [-26, 7.6], [30, 5], [34, 7], [-14, 10]]) { c.fillRect(x, y, 1.4, 1.8); c.fillRect(x + 2.4, y, 1.4, 1.8); }
    // шалаш из брёвен и веток
    const LG = dead ? '#6a5c48' : '#7a5a34';
    if (!dead) {
      naBlob(c, [[-18, 0], [-14, -14], [-4, -22], [8, -22], [17, -14], [20, 0]], '#6a4a2a', 0.25, -0.36);
      for (let k = 0; k < 6; k++) naLimb(c, -18 + k * 7, 1, -12 + k * 5, -22 + (k % 2) * 2, 2.6, k % 2 ? '#8a6638' : '#6a4a28');
      poly(c, [[-7, 0], [-6, -9], [0, -13], [6, -9], [7, 0]], '#0e0804');
      // дымок-пар изнутри (дыхание)
      naPuff(c, 2 + f * 3, -9 - f * 2, 2.6, 'rgba(230,230,235,A)', 0.4); naPuff(c, 5 + f * 3, -13 - f * 2, 2, 'rgba(230,230,235,A)', 0.25);
      c.fillStyle = '#f0d838'; c.fillRect(-1, -6, 1.2, 1); c.fillRect(2.6, -6, 1.2, 1);   // глаза из тьмы
    } else {
      for (let k = 0; k < 4; k++) naLimb(c, -16 + k * 9, 1, -8 + k * 8, -3 - (k % 2) * 4, 2.6, LG);
      naLimb(c, -20, -2, 6, 1, 2.4, LG); naLimb(c, 14, 0, 26, -3, 2.2, LG);
    }
    // колья с клыками и кости
    for (const [x, ang] of [[-30, -0.2], [32, 0.2]]) { naLimb(c, x, 3, x + ang * 14, -17, 1.8, '#5a3c20'); poly(c, [[x + ang * 14 - 2.4, -15], [x + ang * 14 + 0.4, -23], [x + ang * 14 + 2.4, -15]], dead ? '#bfb8a0' : '#f4ecd0'); }
    naLimb(c, 20, 5, 30, 2, 1.8, '#f0e8cc'); ellipse(c, 31, 1.4, 1.8, 1.8, '#f0e8cc'); ellipse(c, 21, 6, 1.6, 1.6, '#f0e8cc');
    ellipse(c, -34, 6, 2.6, 1.8, '#e0d8bc'); c.fillStyle = '#6a5c48'; c.fillRect(-35.6, 5.4, 1, 1);
    // сено
    c.strokeStyle = dead ? '#8a8458' : '#b8a448'; c.lineWidth = 0.8; for (const [x, y] of [[-14, 6], [-9, 8], [-4, 6.6], [20, 8], [25, 6]]) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + 4, y - 1); c.stroke(); }
    // муха
    if (!dead) naSparks(c, [[-12 + f * 3, -20, 0], [30 - f * 2, -12, 2]], f * 1.1, 'rgba(60,50,40,A)');
  } else {
    c.fillStyle = dead ? '#55554a' : '#4e3a5a'; c.beginPath(); c.ellipse(0, 1, 34, 12, 0, 0, 7); c.fill();
    c.fillStyle = dead ? '#62625a' : '#52663a'; c.beginPath(); c.ellipse(0, 1, 21, 7.6, 0, 0, 7); c.fill();
    // грибница: жилки по земле
    c.strokeStyle = dead ? 'rgba(150,150,130,0.6)' : 'rgba(200,170,230,0.7)'; c.lineWidth = 0.6;
    for (let k = 0; k < 9; k++) { const a = k * 0.7 + 0.3; c.beginPath(); c.moveTo(Math.cos(a) * 3, Math.sin(a) * 1.2); c.quadraticCurveTo(Math.cos(a + 0.4) * 16, Math.sin(a + 0.4) * 6, Math.cos(a) * 31, Math.sin(a) * 10.6); c.stroke(); }
    const set = [[-22, 3, 1.3, '#8a48b0', '#eee0f8'], [-12, -3, 1.9, '#62308a', '#d8c0ec'], [0, 4, 2.3, '#8a48b0', '#eee0f8'], [14, -1, 2.6, '#b676d6', '#fff'], [25, 4, 1.2, '#62308a', '#d8c0ec'], [-4, -5, 1.4, '#b676d6', '#fff'], [8, 7, 1.1, '#62308a', '#d8c0ec'], [-28, -1, 0.9, '#b676d6', '#fff']];
    set.sort((a, b) => a[1] - b[1]);
    for (const [x, y, s, cp, sp] of set) naShroomB(c, x, y, s * (dead ? 0.75 : (f && s > 2 ? 1.04 : 1)), dead ? '#8a8294' : cp, sp, dead);
    if (!dead) {
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 7; k++) { const a = k * 0.9 + f * 0.8, x = Math.cos(a) * (8 + k * 2.4), y = -10 - ((k * 5 + f * 6) % 22); naPuff(c, x, y, 2.2 + (k % 3) * 0.7, 'rgba(170,240,100,A)', 0.2 + 0.05 * (k % 3)); }
      c.restore();
    } else { naLimb(c, -2, -2, 8, -1, 1, '#6a6a5a'); }
  }
}

function naLairSprite(kind, v = '0') {
  const key = kind + v;
  let s = naLairCache.get(key);
  if (s) return s;
  const S = NA_LAIR[kind], [cv, c] = mkSprite(S.w, S.h, 3);
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.save(); c.translate(S.ax, S.ay);
  naLairDraw(c, kind, v);
  c.restore();
  const out = toPixelArt(cv, 3, { outline: true, outlineDark: 0.3, alphaCut: 100 });
  s = { cv: out, ax: S.ax, ay: S.ay, w: S.w, h: S.h };
  naLairCache.set(key, s);
  return s;
}
