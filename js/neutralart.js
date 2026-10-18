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
  fairy:   { name: 'Лесная фея',    w: 84, h: 72, ax: 54, ay: 54, sc: 1.55 },
  leshy:   { name: 'Леший',         w: 108, h: 72, ax: 68, ay: 66 },
  boar:    { name: 'Кабан-страж',   w: 84, h: 60, ax: 42, ay: 50, sc: 1.25 },
  spore:   { name: 'Чумной моховик', w: 90, h: 64, ax: 54, ay: 54, sc: 1.2 },
};

const naCache = new Map();

function naFrame(kind, fr) {
  const key = kind + '|' + fr;
  let s = naCache.get(key);
  if (s) return s;
  const S = NA_SPEC[kind];
  const [cv, c] = mkSprite(S.w, S.h, 3);
  c.lineCap = 'round'; c.lineJoin = 'round';
  const P = naPose(fr);
  c.save();
  c.translate(S.ax, S.ay);
  if (S.sc) c.scale(S.sc, S.sc);
  NA_DRAW[kind](c, P, fr);
  c.restore();
  const out = toPixelArt(cv, 3, { outline: true, outlineDark: 0.3, alphaCut: 100 });
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
  const SK = '#f8dcc0', DR = naK(P, '#4cae3c'), DR2 = naK(P, '#2e7a2c'), HR = naK(P, '#f6d458'), HR2 = naK(P, '#c8921e'), WG = P.dead ? 'rgba(236,250,236,0.55)' : 'rgba(240,252,236,0.72)';
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
  ellipse(c, tipx, tipy, 1.1, 1.1, '#fff6b0');
  if (P.a > 0.5 || P.up > 0.5) for (const [dx, dy] of [[3, -2], [2, 2.4], [4.4, 0.4], [-1, -3]]) { c.fillStyle = '#fff6b0'; c.fillRect(tipx + dx - 0.4, tipy + dy - 0.4, 0.8, 0.8); }
  // голова
  const hy0 = -15.2 + (P.hurt > 0.5 ? 0.6 : 0);
  poly(c, [[-3.8, hy0 - 1], [-2, hy0 - 4.6], [2.4, hy0 - 4.4], [3.4, hy0 - 0.4], [1, hy0 + 1.8], [-3.6, hy0 + 3.4]], HR2);   // волосы сзади
  ellipse(c, 0.6, hy0, 3.1, 3.3, SK);
  poly(c, [[-2.4, hy0 - 2.2], [0.5, hy0 - 4.2], [3.6, hy0 - 1.6], [2.6, hy0 - 2.4], [0.2, hy0 - 3.2]], HR);                        // чёлка
  ellipse(c, -2.3, hy0 - 3.8, 1.6, 1.4, HR);                                                                                      // пучок
  poly(c, [[3.2, hy0 - 0.8], [6, hy0 - 2.2], [3.6, hy0 + 0.2]], SK);                                                              // острое ушко
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

const NA_DRAW = { fairy: drawFairy, leshy: drawLeshy, boar: drawBoar, spore: drawSpore };

// ---------- Логова ----------
const NA_LAIR = {
  fairy: { w: 56, h: 40, ax: 28, ay: 22 },
  leshy: { w: 60, h: 60, ax: 30, ay: 46 },
  boar:  { w: 56, h: 36, ax: 28, ay: 22 },
  spore: { w: 52, h: 36, ax: 26, ay: 22 },
};
const naLairCache = new Map();
function naLairSprite(kind) {
  let s = naLairCache.get(kind);
  if (s) return s;
  const S = NA_LAIR[kind], [cv, c] = mkSprite(S.w, S.h, 3);
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.save(); c.translate(S.ax, S.ay);
  const R = mulberry32(kind.length * 977 + 5);
  const shroom = (x, y, s, col, col2) => {
    c.fillStyle = '#e8dcc0'; c.fillRect(x - 0.9 * s, y - 3 * s, 1.8 * s, 3 * s);
    poly(c, [[x - 3.2 * s, y - 2.6 * s], [x - 2.2 * s, y - 5 * s], [x, y - 6 * s], [x + 2.2 * s, y - 5 * s], [x + 3.2 * s, y - 2.6 * s]], col);
    c.fillStyle = col2; c.fillRect(x - 1.4 * s, y - 4.6 * s, 0.9 * s, 0.9 * s); c.fillRect(x + 0.8 * s, y - 3.8 * s, 0.9 * s, 0.9 * s);
  };
  if (kind === 'fairy') {            // грибное кольцо с цветами
    c.fillStyle = 'rgba(120,200,160,0.22)'; c.beginPath(); c.ellipse(0, 0, 22, 9, 0, 0, 7); c.fill();
    c.strokeStyle = 'rgba(190,255,220,0.55)'; c.lineWidth = 0.6; c.beginPath(); c.ellipse(0, 0, 19, 7.4, 0, 0, 7); c.stroke();
    const n = 12;
    for (let k = 0; k < n; k++) { const a = k / n * 6.283, x = Math.cos(a) * 19, y = Math.sin(a) * 7.4; if (k % 3 === 0) shroom(x, y + 1, 1.15, '#e85a4a', '#fff0e0'); else if (k % 3 === 1) { ellipse(c, x, y, 1.4, 1.1, '#f4a8d8'); ellipse(c, x, y, 0.5, 0.5, '#fff0a0'); } else shroom(x, y + 1, 0.8, '#e0a8f0', '#fff'); }
    shroom(0, 3, 1.5, '#e85a4a', '#fff0e0');
  } else if (kind === 'leshy') {     // дупло-пень: коряга с мхом и тёмным провалом
    c.fillStyle = 'rgba(10,8,4,0.3)'; c.beginPath(); c.ellipse(0, 1, 17, 5, 0, 0, 7); c.fill();
    poly(c, [[-15, 0], [-12, -9], [-9, -22], [-12, -34], [-5, -30], [0, -36], [6, -31], [11, -35], [10, -22], [13, -9], [16, 0]], '#5e4026');
    poly(c, [[-15, 0], [-12, -9], [-9, -22], [-12, -34], [-8, -32], [-6, -20], [-7, -6], [-6, 0]], '#43301c');
    poly(c, [[-4, 0], [-5, -9], [-3, -17], [3, -17], [6, -9], [5, 0]], '#120a05');
    ellipse(c, -1.4, -10, 0.9, 0.7, '#d8e84a'); ellipse(c, 2.6, -10, 0.9, 0.7, '#d8e84a');
    poly(c, [[-12, -34], [-5, -30], [0, -36], [6, -31], [11, -35], [8, -29], [-9, -29]], '#5a8a38');
    c.fillStyle = '#3e6a28'; c.fillRect(-9, -29, 3, 1.6); c.fillRect(2, -29.4, 3, 1.6);
    poly(c, [[-15, 0], [-19, -2], [-17, -5], [-12, -4]], '#5e4026'); poly(c, [[16, 0], [20, -1.4], [18, -5], [12, -4]], '#5e4026');
    shroom(-14, 1, 1.1, '#c8883a', '#f6e8c0'); shroom(16, 2, 0.9, '#c8883a', '#f6e8c0');
  } else if (kind === 'boar') {      // кабанья лёжка: вытоптанная земля, кучи веток и кости
    c.fillStyle = '#5a4630'; c.beginPath(); c.ellipse(0, 0, 21, 8.6, 0, 0, 7); c.fill();
    c.fillStyle = '#463420'; c.beginPath(); c.ellipse(1, 1, 15, 5.6, 0, 0, 7); c.fill();
    for (let k = 0; k < 9; k++) { const a = R() * 6.283, r = 6 + R() * 12; naLimb(c, Math.cos(a) * r, Math.sin(a) * r * 0.4 - 1, Math.cos(a) * r + 6 * (R() - 0.5), Math.sin(a) * r * 0.4 - 4 - R() * 3, 1.3, k % 2 ? '#7a5a34' : '#4a3420'); }
    poly(c, [[-10, 0], [-6, -8], [2, -10], [9, -7], [12, 0]], '#7a6a34');     // подстилка из сена
    c.fillStyle = '#a69248'; c.fillRect(-4, -8, 3, 1); c.fillRect(2, -6, 4, 1); c.fillRect(-8, -3, 3, 1);
    naLimb(c, 12, -2, 18, -5, 1.4, '#f0e8cc'); naLimb(c, 18, -5, 20, -3, 1.2, '#f0e8cc');    // кость
    ellipse(c, -17, 0, 2, 1.4, '#e0d8bc');
  } else {                           // пятно чумных грибов: фиолетовая поляна
    c.fillStyle = 'rgba(120,70,150,0.3)'; c.beginPath(); c.ellipse(0, 0, 21, 8, 0, 0, 7); c.fill();
    c.fillStyle = 'rgba(160,236,90,0.25)'; c.beginPath(); c.ellipse(0, 0, 13, 5, 0, 0, 7); c.fill();
    for (const [x, y, s, col, c2] of [[-14, 2, 1.1, '#8a48b0', '#eee0f8'], [-7, -2, 1.5, '#62308a', '#d8c0ec'], [3, 3, 1.3, '#8a48b0', '#eee0f8'], [10, -1, 1.7, '#b676d6', '#fff'], [16, 3, 0.9, '#62308a', '#d8c0ec'], [-1, -4, 0.9, '#b676d6', '#fff']]) shroom(x, y, s, col, c2);
  }
  c.restore();
  const out = toPixelArt(cv, 3, { outline: true, outlineDark: 0.3, alphaCut: 100 });
  s = { cv: out, ax: S.ax, ay: S.ay, w: S.w, h: S.h };
  naLairCache.set(kind, s);
  return s;
}
