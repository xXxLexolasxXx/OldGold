'use strict';
// Горгульи на уличных фонарях: каменные, рогатые, с клыками и каменными крыльями.
// Днём застыли; к вечеру глаза разгораются, ночью голова поворачивается за прохожими, а крылья медленно взмахивают.
// Три облика (A — сидит на капители и держит фонарь в когте, B — высунулась из столба и держит цепь зубами,
// C — сидит на крыше фонаря с распахнутыми крыльями). GARG_STYLE — какой рисуется на улицах.
// Рисуется процедурно (формулы по времени), поэтому число кадров непрерывное; взмах крыла — цикл из 8 фаз (КАДРЫ.md).

let GARG_STYLE = 'A';
const GST = ['#1e1b19', '#3a3632', '#5c564f', '#867e74', '#b6ada0'];   // камень: тень → свет, свет сверху-слева

function garPoly(c, pts, col) {
  c.fillStyle = col; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath(); c.fill();
}
// Освещённость глаз: к вечеру разгораются, днём тёмные
function garEyeK() { return typeof nightAmt === 'function' ? Math.max(0, Math.min(1, (nightAmt() - 0.12) * 2.4)) : 1; }

// Каменное крыло: три ребра, зубчатый край; s — сторона, lift 0..1 — взмах вверх, rest — угол покоя
function garWing(c, ox, oy, s, lift, rest, size) {
  c.save(); c.translate(ox, oy); c.scale(s * size, size); c.rotate(-(rest + lift * 0.5));
  garPoly(c, [[0, 0], [2.4, -7], [7, -11.5], [13, -11], [11.6, -8], [14.4, -5.6], [11, -4.6], [12.4, -1.2], [8, -2.6], [6, 1]], GST[2]);                 // перепонка-плита
  garPoly(c, [[0, 0], [2.4, -7], [7, -11.5], [13, -11], [7, -9.4], [3.6, -5], [1.4, 0]], GST[3]);                                                      // освещённая кромка
  c.strokeStyle = GST[0]; c.lineWidth = 0.7; c.lineCap = 'round';
  for (const [x, y] of [[13, -11], [14.4, -5.6], [12.4, -1.2]]) { c.beginPath(); c.moveTo(2.4, -7); c.lineTo(x, y); c.stroke(); }                  // рёбра
  c.strokeStyle = GST[4]; c.lineWidth = 0.5; c.beginPath(); c.moveTo(0.2, -0.6); c.lineTo(2.2, -6.8); c.lineTo(6.8, -11); c.stroke();               // верхняя кость блестит
  c.fillStyle = GST[1]; c.fillRect(11.2, -11.8, 1.6, 1.2);                                                                                             // коготь на сгибе
  c.restore();
}
// Рога, голова с клыками и светящиеся глаза. (hx, hy) — центр черепа, ang −1..1 — поворот головы, k — свет глаз, hang — голова склонена вниз
function garHead(c, hx, hy, ang, k, down, ph) {
  const fw = 1 - 0.28 * Math.abs(ang), sh = ang * 1.5;
  // рога: изогнутые назад и внутрь, с утолщением у основания
  for (const s of [-1, 1]) {
    const bx = hx + sh * 0.5 + s * 2.6 * fw, tipx = hx + sh + s * 5.4 * fw, tipy = hy - 8.6;
    c.strokeStyle = GST[1]; c.lineWidth = 1.9; c.lineCap = 'round'; c.beginPath(); c.moveTo(bx, hy - 2.2); c.quadraticCurveTo(hx + sh + s * 6.4 * fw, hy - 5.4, tipx, tipy); c.stroke();
    c.strokeStyle = GST[3]; c.lineWidth = 0.8; c.beginPath(); c.moveTo(bx - 0.3, hy - 2.6); c.quadraticCurveTo(hx + sh + s * 6 * fw, hy - 5.6, tipx - s * 0.2, tipy + 0.4); c.stroke();
    garPoly(c, [[hx + sh + s * 4.4 * fw, hy - 1.2], [hx + sh + s * 8 * fw, hy - 2.6], [hx + sh + s * 4.4 * fw, hy - 3.6]], GST[1]);   // острое ухо
  }
  // череп и морда
  const sx = hx + sh * 0.4;
  garPoly(c, [[sx - 3.8 * fw, hy - 1], [sx - 2.6 * fw, hy - 3.6], [sx + 2.6 * fw, hy - 3.6], [sx + 3.8 * fw, hy - 1], [sx + 3.2 * fw, hy + 2.2], [sx + 1.6 * fw + sh * 0.4, hy + 3.8 + down], [sx - 1.6 * fw + sh * 0.4, hy + 3.8 + down], [sx - 3.2 * fw, hy + 2.2]], GST[2]);
  garPoly(c, [[sx - 3.8 * fw, hy - 1], [sx - 2.6 * fw, hy - 3.6], [sx, hy - 3.6], [sx - 0.8, hy + 1], [sx - 3.2 * fw, hy + 2.2]], GST[3]);   // свет слева
  c.fillStyle = GST[1]; c.fillRect(sx - 3.4 * fw, hy - 1.7, 6.8 * fw, 1);                                                                  // тяжёлая бровь
  // пасть: тёмная щель и клыки вниз (два длинных, два короче)
  c.fillStyle = GST[0]; c.fillRect(sx - 2.6 * fw + sh * 0.3, hy + 1.8, 5.2 * fw, 1.2);
  c.fillStyle = '#d8d2c4';
  for (const [dx, h] of [[-2.2, 2.4], [-0.9, 1.4], [0.9, 1.4], [2.2, 2.4]]) garPoly(c, [[sx + dx * fw - 0.5 + sh * 0.3, hy + 2.6], [sx + dx * fw + 0.5 + sh * 0.3, hy + 2.6], [sx + dx * fw + sh * 0.3, hy + 2.6 + h]], '#d8d2c4');
  // глаза
  for (const s of [-1, 1]) {
    const ex = sx + s * 1.7 * fw, ey = hy - 0.4;
    c.fillStyle = GST[0]; c.fillRect(ex - 0.9, ey - 0.6, 1.8, 1.4);
    if (k > 0.02) {
      const pulse = 0.85 + 0.15 * Math.sin(Game.time * 5 + ph + s);
      c.fillStyle = `rgba(255,${150 + 60 * k | 0},40,${Math.min(1, k * pulse)})`; c.fillRect(ex - 0.8, ey - 0.4, 1.6, 1);
      if (typeof glow === 'function') glow(c, ex, ey, 4.5 * k + 1, '255,170,60', 0.34 * k * pulse);
    }
  }
}
function garBody(c, ox, oy, lean) {   // сидящий торс: покатые плечи, грудь, согнутые лапы с когтями
  garPoly(c, [[ox - 3.6, oy], [ox - 4.4, oy - 4], [ox - 2.8, oy - 8.2], [ox + 2.8, oy - 8.2], [ox + 4.4, oy - 4], [ox + 3.6, oy]], GST[2]);
  garPoly(c, [[ox - 3.6, oy], [ox - 4.4, oy - 4], [ox - 2.8, oy - 8.2], [ox - 0.6, oy - 8.2], [ox - 1.4, oy - 4], [ox - 1.6, oy]], GST[3]);
  c.fillStyle = GST[1]; c.fillRect(ox + 1.8, oy - 7.6, 1, 7.6);   // тень справа
  c.strokeStyle = GST[1]; c.lineWidth = 0.5; for (const dy of [-5.4, -3.4]) { c.beginPath(); c.moveTo(ox - 2.2, oy + dy); c.lineTo(ox + 2.2, oy + dy + 0.6); c.stroke(); }   // рёбра
  // передние лапы и когти на краю капители
  for (const s of [-1, 1]) { c.fillStyle = GST[2]; c.fillRect(ox + s * 3.8 - 0.9, oy - 0.6, 1.8, 2); c.fillStyle = GST[0]; for (const t of [-0.7, 0, 0.7]) c.fillRect(ox + s * 3.8 + t - 0.2, oy + 1.2, 0.5, 1); }
}

// A: сидит на капители, крылья вверх, фонарь в правом когте на цепи
function garA(c, bx, by, lit, ph) {
  const t = Game.time, k = garEyeK(), ox = bx, oy = by - 24;
  c.fillStyle = '#6e685e'; c.fillRect(bx - 2.2, by - 22, 4.4, 17);
  c.fillStyle = '#9a9488'; c.fillRect(bx - 2.2, by - 22, 1.2, 17); c.fillStyle = '#3e3a34'; c.fillRect(bx + 1.2, by - 22, 1, 17);
  c.fillStyle = '#5a554e'; c.fillRect(bx - 4.4, by - 25, 8.8, 2.4); c.fillStyle = '#8e887c'; c.fillRect(bx - 4.4, by - 25, 8.8, 0.8);
  const flap = Math.max(0, Math.sin(t * 0.9 + ph)) ** 6 * k, turn = Math.sin(t * 0.45 + ph) * (0.35 + 0.65 * k);
  garWing(c, ox - 2.4, oy - 7.4, -1, flap, 0.25, 1); garWing(c, ox + 2.4, oy - 7.4, 1, flap, 0.25, 1);
  garBody(c, ox, oy - 1, 0);
  garHead(c, ox + turn * 0.8, oy - 11.6, turn, k, 0, ph);
  // цепь из когтя к фонарю
  c.strokeStyle = IRON[0]; c.lineWidth = 0.6; c.beginPath(); c.moveTo(ox + 4.4, oy + 0.4); c.lineTo(bx + 5.6, by - 18.4); c.stroke();
  lampCage(c, bx + 5.6, by - 11, 4.4, 7, lit, Math.round(Math.sin(t * 6 + ph) * 18));
  if (lit) glow(c, bx + 5.6, by - 16, 16, '255,196,100', 0.26 + 0.06 * Math.sin(t * 5 + ph));
}
// B: высунулась из столба вбок, как водосток-химера, цепь с фонарём держит в зубах; крылья сложены за спиной
function garB(c, bx, by, lit, ph) {
  const t = Game.time, k = garEyeK();
  c.fillStyle = '#6e685e'; c.fillRect(bx - 2.4, by - 24, 4.8, 19);
  c.fillStyle = '#9a9488'; c.fillRect(bx - 2.4, by - 24, 1.2, 19); c.fillStyle = '#3e3a34'; c.fillRect(bx + 1.4, by - 24, 1, 19);
  c.fillStyle = '#5a554e'; c.fillRect(bx - 3.6, by - 26.6, 7.2, 2.6);
  const flap = Math.max(0, Math.sin(t * 0.8 + ph)) ** 6 * k, turn = Math.sin(t * 0.5 + ph) * (0.3 + 0.7 * k);
  garWing(c, bx - 1, by - 24, -1, flap, 0.2, 0.75); garWing(c, bx + 1, by - 24, 1, flap, 0.2, 0.75);
  // туловище выдвигается вправо и вниз
  garPoly(c, [[bx + 1, by - 18], [bx + 2, by - 26], [bx + 9, by - 25], [bx + 11, by - 20], [bx + 8, by - 18.4]], GST[2]);
  garPoly(c, [[bx + 1, by - 18], [bx + 2, by - 26], [bx + 9, by - 25], [bx + 8, by - 23], [bx + 3, by - 22]], GST[3]);
  c.fillStyle = GST[0]; for (const dx of [0, 1.1, 2.2]) c.fillRect(bx + 6.2 + dx, by - 17.4, 0.5, 1.6);   // когти на краю
  garHead(c, bx + 11.4 + turn * 0.6, by - 24.4, turn * 0.8, k, 1, ph);
  c.strokeStyle = IRON[0]; c.lineWidth = 0.6; c.beginPath(); c.moveTo(bx + 11.4 + turn * 0.5, by - 19.4); c.lineTo(bx + 11.4, by - 15.4); c.stroke();
  lampCage(c, bx + 11.4, by - 8, 4.6, 7.4, lit, Math.round(Math.sin(t * 6 + ph) * 18));
  if (lit) glow(c, bx + 11.4, by - 13, 16, '255,196,100', 0.26 + 0.06 * Math.sin(t * 5 + ph));
}
// C: сидит на крыше фонаря, крылья распахнуты, голова склонена к улице
function garC(c, bx, by, lit, ph) {
  const t = Game.time, k = garEyeK();
  c.fillStyle = IRON[1]; c.fillRect(bx - 0.9, by - 30, 1.8, 25); c.fillStyle = IRON[2]; c.fillRect(bx - 0.9, by - 30, 0.6, 25);
  for (const yy of [-10, -17, -24]) { c.fillStyle = IRON[0]; c.fillRect(bx - 2, by + yy, 4, 1.2); }
  lampCage(c, bx, by - 30, 5.6, 9, lit, Math.round(Math.sin(t * 6 + ph) * 18));
  if (lit) glow(c, bx, by - 35, 17, '255,196,100', 0.26 + 0.06 * Math.sin(t * 5 + ph));
  const oy = by - 46.4, flap = (Math.sin(t * 1.1 + ph) * 0.5 + 0.5) * (0.25 + 0.75 * k), turn = Math.sin(t * 0.4 + ph) * (0.4 + 0.6 * k);
  garWing(c, bx - 2.4, oy - 6, -1, flap, -0.25, 1); garWing(c, bx + 2.4, oy - 6, 1, flap, -0.25, 1);
  garPoly(c, [[bx - 3, oy], [bx - 3.6, oy - 4], [bx - 2.4, oy - 7.6], [bx + 2.4, oy - 7.6], [bx + 3.6, oy - 4], [bx + 3, oy]], GST[2]);
  garPoly(c, [[bx - 3, oy], [bx - 3.6, oy - 4], [bx - 2.4, oy - 7.6], [bx - 0.4, oy - 7.6], [bx - 1.2, oy - 3]], GST[3]);
  for (const s of [-1, 1]) { c.fillStyle = GST[2]; c.fillRect(bx + s * 3.6 - 0.9, oy - 1, 1.8, 1.8); c.fillStyle = GST[0]; c.fillRect(bx + s * 3.6 - 0.6, oy + 0.6, 0.5, 1); c.fillRect(bx + s * 3.6 + 0.2, oy + 0.6, 0.5, 1); }
  garHead(c, bx + turn * 0.8, oy - 10.6, turn, k, 1, ph);
}

// Только горгулья с фонарём (цоколь и тень рисует drawGothicLamp)
function garDraw(c, bx, by, lit, ph, style) {
  const st = style || GARG_STYLE;
  if (st === 'B') garB(c, bx, by, lit, ph); else if (st === 'C') garC(c, bx, by, lit, ph); else garA(c, bx, by, lit, ph);
}
// Целиком, с цоколем (для листа вариантов)
function drawGargoyleLamp(c, bx, by, lit, ph, style) {
  shadowAt(c, bx + 1, by, 4);
  c.fillStyle = '#5a554e'; c.fillRect(bx - 3, by - 3, 6, 3); c.fillStyle = '#8e887c'; c.fillRect(bx - 3, by - 3, 6, 1);
  c.fillStyle = '#3e3a34'; c.fillRect(bx - 2.2, by - 5.5, 4.4, 2.6);
  garDraw(c, bx, by, lit, ph, style);
}
