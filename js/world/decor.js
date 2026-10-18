'use strict';
// Антураж деревни: скамейки (на 1, 2 и 3 места, по 5 видов), урны (5), клумбы (10),
// ящики и бочки (5) и семь волшебных диковин. Всё это само вырастает вдоль дорог
// (см. decorPlanTick), а по ночам часть предметов, каждую ночь разная, преображается:
// открываются глаза, из-под земли тянется рука, меняется цвет пламени — и становится жутко.

const DECOR_TYPES = ['bench', 'bin', 'bed', 'crate', 'magic', 'fence'];
const MAGIC_NAMES = ['Рунный камень', 'Колодец желаний', 'Пугало', 'Грибное кольцо', 'Каменный гном', 'Котёл', 'Кристальный столп'];
const GROW_T = 2.6;

function benchSeats(o) { return 1 + Math.floor((o.v || 0) / 5); }

// ---------- Мелкие помощники ----------
function dBlooms(c, cx, cy, w, cols, n, seed, tall = 6, r = 1.5) {
  for (let i = 0; i < n; i++) {
    const h = hash(seed * 31 + i * 17), x = cx - w / 2 + (i + 0.5) * w / n + ((h >>> 3) % 3 - 1) * 0.6;
    const hh = tall * (0.65 + ((h >>> 8) % 40) / 100), sw = Math.sin(Game.time * 1.6 + i + seed) * 0.5;
    line(c, x, cy, x + sw, cy - hh, '#3f7a2e', 0.9);
    ellipse(c, x - 1.1, cy - hh * 0.45, 1.4, 0.7, '#4f8e38');
    const col = cols[i % cols.length];
    ellipse(c, x + sw, cy - hh, r + 0.3, r, '#1a1008');
    ellipse(c, x + sw, cy - hh, r, r * 0.85, col);
    ellipse(c, x + sw, cy - hh - 0.2, r * 0.35, r * 0.35, '#fff6c0');
  }
}

function dPlanks(c, x, y, w, h, col, dark) {
  c.fillStyle = dark; c.fillRect(x - 0.6, y - 0.6, w + 1.2, h + 1.2);
  c.fillStyle = col; c.fillRect(x, y, w, h);
  c.fillStyle = 'rgba(255,230,180,0.25)'; c.fillRect(x, y, w, 0.8);
}

// ---------- Скамейки: 5 видов × 1/2/3 места ----------
function drawBench(c, px, py, o) {
  const seats = benchSeats(o), s = (o.v || 0) % 5, w = [12, 20, 29][seats - 1];
  const x0 = px + (TILE - w) / 2, by = py + 24;
  shadowAt(c, x0 + w / 2, by + 1, w / 2 + 1, 2.4);
  if (s === 0) {                                               // простая доска
    c.fillStyle = '#45291a'; c.fillRect(x0 + 1, by - 3, 2, 4); c.fillRect(x0 + w - 3, by - 3, 2, 4);
    c.fillStyle = '#a06840'; rrect(c, x0, by - 5, w, 2.6, 0.8); c.fill(); c.fillStyle = '#cc9a64'; c.fillRect(x0, by - 5, w, 0.7);
    c.fillStyle = '#875434'; rrect(c, x0, by - 10, w, 2.2, 0.8); c.fill();
    c.fillStyle = '#45291a'; c.fillRect(x0 + 1, by - 10, 1.4, 6); c.fillRect(x0 + w - 2.4, by - 10, 1.4, 6);
  } else if (s === 1) {                                         // бревно
    ellipse(c, x0 + w / 2, by - 3, w / 2 + 0.6, 3.4, '#3a2412'); ellipse(c, x0 + w / 2, by - 3.6, w / 2, 2.8, '#7a5030');
    for (let k = 0; k < w / 4; k++) line(c, x0 + 2 + k * 4, by - 5, x0 + 3 + k * 4, by - 2, 'rgba(40,24,12,0.5)', 0.5);
    ellipse(c, x0 + 1, by - 3, 1.6, 2.6, '#c8a070'); ellipse(c, x0 + w - 1, by - 3, 1.6, 2.6, '#c8a070');
    c.fillStyle = '#583820'; c.fillRect(x0 + 2, by - 11, 1.8, 7); c.fillRect(x0 + w - 4, by - 11, 1.8, 7);
    rrect(c, x0 + 1, by - 12, w - 2, 2.4, 1); c.fill(); ellipse(c, x0 + 4, by - 6.4, 2.4, 1.1, '#5a8a38');
  } else if (s === 2) {                                         // каменная плита
    c.fillStyle = '#3e3a34'; c.fillRect(x0 + 1, by - 4, 4, 5); c.fillRect(x0 + w - 5, by - 4, 4, 5);
    c.fillStyle = '#9a948a'; rrect(c, x0, by - 7, w, 3.4, 1); c.fill(); c.fillStyle = '#c0bab0'; c.fillRect(x0 + 1, by - 7, w - 2, 0.8);
    c.fillStyle = '#7a756c'; c.fillRect(x0 + 1, by - 11, w - 2, 3); c.fillStyle = '#9a948a'; c.fillRect(x0 + 1, by - 11, w - 2, 0.8);
    ellipse(c, x0 + w * 0.3, by - 7.4, 2.6, 0.9, '#5f8a3a'); ellipse(c, x0 + w * 0.7, by - 11.4, 2, 0.8, '#5f8a3a');
  } else if (s === 3) {                                         // кованая с рейками
    c.fillStyle = '#17121c'; c.fillRect(x0, by - 4, 1.6, 5); c.fillRect(x0 + w - 1.6, by - 4, 1.6, 5);
    c.strokeStyle = '#17121c'; c.lineWidth = 1; c.beginPath(); c.moveTo(x0 + 0.8, by - 4); c.quadraticCurveTo(x0 - 1, by - 8, x0 + 0.8, by - 12); c.moveTo(x0 + w - 0.8, by - 4); c.quadraticCurveTo(x0 + w + 1, by - 8, x0 + w - 0.8, by - 12); c.stroke();
    for (let k = 0; k < 3; k++) { c.fillStyle = k % 2 ? '#8a5c34' : '#a06c40'; c.fillRect(x0, by - 6 + k * 0.1, w, 1.6); }
    c.fillStyle = '#9a6a3c'; c.fillRect(x0 + 0.6, by - 11.4, w - 1.2, 1.4); c.fillRect(x0 + 0.6, by - 9, w - 1.2, 1.2);
    for (let k = 0; k <= seats; k++) { c.fillStyle = '#17121c'; c.fillRect(x0 + k * w / seats - 0.4, by - 12, 0.9, 7); ellipse(c, x0 + k * w / seats, by - 12.4, 1, 1, '#17121c'); }
  } else {                                                      // резная, расписная
    c.fillStyle = '#6a3c58'; c.fillRect(x0 + 1, by - 3, 2.4, 4); c.fillRect(x0 + w - 3.4, by - 3, 2.4, 4);
    c.fillStyle = '#e8dcc0'; rrect(c, x0, by - 5.4, w, 2.8, 1); c.fill(); c.fillStyle = '#f8f0dc'; c.fillRect(x0, by - 5.4, w, 0.7);
    c.fillStyle = '#d8c8a0'; rrect(c, x0 + 0.6, by - 13, w - 1.2, 7.4, 2); c.fill();
    for (let k = 0; k < seats; k++) { const cx = x0 + (k + 0.5) * w / seats; ellipse(c, cx, by - 10, 1.4, 1.8, '#6a3c58'); ellipse(c, cx - 2.4, by - 7.6, 1, 0.6, '#c85a7a'); ellipse(c, cx + 2.4, by - 7.6, 1, 0.6, '#5a8ac8'); }
  }
}

// ---------- Урны: 5 видов ----------
function drawBin(c, px, py, o) {
  const bx = px + 16, by = py + 24, v = (o.v || 0) % 5, f = o.g || 0;
  shadowAt(c, bx + 1, by, 5.4);
  let top = by - 12;
  if (v === 0) {                                                  // плетёная
    c.fillStyle = lingrad(c, bx - 5, 0, bx + 5, 0, [[0, '#a06840'], [0.5, '#875434'], [1, '#583522']]);
    c.beginPath(); c.moveTo(bx - 5, by - 11); c.lineTo(bx + 5, by - 11); c.lineTo(bx + 4, by); c.lineTo(bx - 4, by); c.closePath(); c.fill();
    c.fillStyle = 'rgba(30,15,5,0.4)'; for (let k = 0; k < 4; k++) c.fillRect(bx - 4.6, by - 9 + k * 2.6, 9.2, 0.6);
    c.fillStyle = '#45291a'; c.fillRect(bx - 5.4, by - 12, 10.8, 1.4);
  } else if (v === 1) {                                           // бочонок
    c.fillStyle = lingrad(c, bx - 6, 0, bx + 6, 0, [[0, '#b07848'], [0.5, '#8a5a30'], [1, '#5a3820']]);
    c.beginPath(); c.moveTo(bx - 4.4, by - 12); c.quadraticCurveTo(bx - 7, by - 6, bx - 4.6, by); c.lineTo(bx + 4.6, by); c.quadraticCurveTo(bx + 7, by - 6, bx + 4.4, by - 12); c.closePath(); c.fill();
    for (const y of [-9, -3]) { c.fillStyle = '#2a2a30'; c.fillRect(bx - 6, by + y, 12, 1.2); }
    ellipse(c, bx, by - 12, 4.4, 1.5, '#2a1a10');
  } else if (v === 2) {                                           // железное ведро с крышкой
    c.fillStyle = lingrad(c, bx - 5, 0, bx + 5, 0, [[0, '#6a6a74'], [0.5, '#4a4a54'], [1, '#2a2a32']]);
    c.beginPath(); c.moveTo(bx - 5, by - 12); c.lineTo(bx + 5, by - 12); c.lineTo(bx + 4, by); c.lineTo(bx - 4, by); c.closePath(); c.fill();
    c.fillStyle = '#8a8a94'; c.fillRect(bx - 5.6, by - 13, 11.2, 1.6); c.strokeStyle = '#2a2a32'; c.lineWidth = 0.8; c.beginPath(); c.arc(bx, by - 13, 4.4, Math.PI, 0); c.stroke();
    top = by - 13;
  } else if (v === 3) {                                           // каменная урна
    c.fillStyle = lingrad(c, bx - 5, 0, bx + 5, 0, [[0, '#b4aea2'], [1, '#6a655c']]);
    c.beginPath(); c.moveTo(bx - 5.4, by - 12); c.quadraticCurveTo(bx - 7.4, by - 6, bx - 3.4, by - 2); c.lineTo(bx - 3.4, by); c.lineTo(bx + 3.4, by); c.lineTo(bx + 3.4, by - 2); c.quadraticCurveTo(bx + 7.4, by - 6, bx + 5.4, by - 12); c.closePath(); c.fill();
    c.fillStyle = '#7a756c'; c.fillRect(bx - 4, by - 8, 8, 0.8); ellipse(c, bx - 2.2, by - 5, 1.2, 0.7, '#5f8a3a');
  } else {                                                        // ящик с нарисованной гномьей рожей
    dPlanks(c, bx - 5.6, by - 12, 11.2, 12, '#a87a4a', '#3a2412');
    c.fillStyle = '#e8bc94'; c.beginPath(); c.arc(bx, by - 6, 3.2, 0, 7); c.fill(); c.fillStyle = '#d88a6a'; ellipse(c, bx, by - 5.4, 1, 0.8, '#d88a6a');
    c.fillStyle = '#f0f0f0'; c.beginPath(); c.moveTo(bx - 3.2, by - 5); c.lineTo(bx, by - 0.6); c.lineTo(bx + 3.2, by - 5); c.fill();
    c.fillStyle = '#c03a22'; c.beginPath(); c.moveTo(bx - 3.6, by - 8.4); c.lineTo(bx, by - 12.8); c.lineTo(bx + 3.6, by - 8.4); c.fill();
    c.fillStyle = '#1a1008'; c.fillRect(bx - 1.8, by - 7, 0.8, 0.8); c.fillRect(bx + 1, by - 7, 0.8, 0.8);
    top = by - 12;
  }
  // мусор торчит по мере наполнения
  if (f > 0.3) { ellipse(c, bx - 1.4, top, 2.2, 1.2, '#9c8e48'); ellipse(c, bx + 2, top - 0.4, 1.6, 1, '#73963e'); }
  if (f > 0.65) { line(c, bx - 2, top, bx - 4, top - 4, '#e0b882', 0.8); ellipse(c, bx + 0.6, top - 1.6, 2, 1.2, '#b6ada0'); }
  if (f >= 1) for (let k = 0; k < 3; k++) { const a = Game.time * 6 + k * 2.1 + px; c.fillStyle = '#1a1210'; c.fillRect(Math.round(bx + Math.cos(a) * 5), Math.round(top - 5 + Math.sin(a * 1.3) * 2), 1, 1); }
}

// ---------- Клумбы: 10 видов ----------
function drawBed(c, px, py, o) {
  const v = (o.v || 0) % 10, cx = px + 16, by = py + 25, seed = (px / TILE) * 7 + (py / TILE) * 13 + v;
  shadowAt(c, cx, by, 10, 2.6);
  if (v === 0) {                                                  // деревянный ящик, тюльпаны
    dPlanks(c, cx - 10, by - 6, 20, 6, '#a87a4a', '#3a2412'); line(c, cx - 3, by - 6, cx - 3, by, 'rgba(40,24,12,0.6)', 0.6); line(c, cx + 4, by - 6, cx + 4, by, 'rgba(40,24,12,0.6)', 0.6);
    dBlooms(c, cx, by - 6, 18, ['#e8423a', '#f0c840', '#e8423a', '#f08ac0'], 6, seed, 8);
  } else if (v === 1) {                                           // каменное кольцо, ромашки
    ellipse(c, cx, by - 2, 11, 4.6, '#4a463e'); ellipse(c, cx, by - 3, 10, 4, '#8a8478'); ellipse(c, cx, by - 3.6, 8, 3, '#4a3828');
    dBlooms(c, cx, by - 3, 14, ['#ffffff', '#fff6a0'], 7, seed, 6, 1.3);
  } else if (v === 2) {                                           // соломенное кольцо, подсолнухи
    ellipse(c, cx, by - 2, 11, 4.4, '#7a5a20'); ellipse(c, cx, by - 3, 10, 3.8, '#c8a040'); ellipse(c, cx, by - 3.6, 7, 2.6, '#4a3020');
    dBlooms(c, cx, by - 3, 12, ['#f4c820', '#e8a810'], 3, seed, 13, 2.8);
  } else if (v === 3) {                                           // тележное колесо, лаванда
    ellipse(c, cx, by - 2.4, 11, 4.4, '#2a1a10'); ellipse(c, cx, by - 2.8, 10, 3.8, '#7a5030'); ellipse(c, cx, by - 3, 7, 2.6, '#3a2818');
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 4; line(c, cx - Math.cos(a) * 9.4, by - 2.8 - Math.sin(a) * 3.2, cx + Math.cos(a) * 9.4, by - 2.8 + Math.sin(a) * 3.2, '#5a3a1e', 1); }
    dBlooms(c, cx, by - 3, 14, ['#9a6ae0', '#7a4ac0'], 8, seed, 8, 1);
  } else if (v === 4) {                                           // старая лодка, незабудки
    c.fillStyle = '#3a2412'; c.beginPath(); c.moveTo(cx - 12, by - 8); c.quadraticCurveTo(cx - 10, by, cx, by); c.quadraticCurveTo(cx + 10, by, cx + 12, by - 8); c.closePath(); c.fill();
    c.fillStyle = '#8a5a34'; c.beginPath(); c.moveTo(cx - 11, by - 7.6); c.quadraticCurveTo(cx - 9, by - 1, cx, by - 1); c.quadraticCurveTo(cx + 9, by - 1, cx + 11, by - 7.6); c.closePath(); c.fill();
    c.fillStyle = '#5a3a1e'; c.fillRect(cx - 11, by - 8.4, 22, 1.4);
    dBlooms(c, cx, by - 8, 18, ['#5a9ae8', '#9ac8ff'], 8, seed, 6, 1.1);
  } else if (v === 5) {                                           // пень с мхом и грибами
    c.fillStyle = '#4a2e18'; c.beginPath(); c.moveTo(cx - 7, by); c.quadraticCurveTo(cx - 8, by - 8, cx - 6, by - 12); c.lineTo(cx + 6, by - 12); c.quadraticCurveTo(cx + 8, by - 8, cx + 7, by); c.closePath(); c.fill();
    ellipse(c, cx, by - 12, 6.4, 2.4, '#c8a070'); ellipse(c, cx, by - 12.4, 5.6, 1.8, '#5a8a38'); ellipse(c, cx - 4, by - 5, 2, 3, '#5a8a38');
    for (const [dx, dy, r] of [[-2, -13, 2.2], [2.4, -12.6, 1.8], [0, -11.6, 1.4]]) { line(c, cx + dx, by + dy, cx + dx, by + dy + 2, '#e8ddc0', 1); ellipse(c, cx + dx, by + dy, r, r * 0.7, '#c8341e'); c.fillStyle = '#fff'; c.fillRect(cx + dx - 0.6, by + dy - 0.8, 0.7, 0.7); }
  } else if (v === 6) {                                           // железная тачка, розы
    c.fillStyle = '#17121c'; c.beginPath(); c.moveTo(cx - 10, by - 10); c.lineTo(cx + 9, by - 10); c.lineTo(cx + 6, by - 3); c.lineTo(cx - 7, by - 3); c.closePath(); c.fill();
    c.fillStyle = '#3a3640'; c.beginPath(); c.moveTo(cx - 9, by - 9.4); c.lineTo(cx + 8, by - 9.4); c.lineTo(cx + 5.4, by - 3.8); c.lineTo(cx - 6.4, by - 3.8); c.closePath(); c.fill();
    ellipse(c, cx + 1, by - 2, 3.4, 3.4, '#17121c'); ellipse(c, cx + 1, by - 2, 2.2, 2.2, '#5a5560'); line(c, cx - 8, by - 6, cx - 13, by - 3, '#17121c', 1.2);
    dBlooms(c, cx - 0.5, by - 9.4, 14, ['#e0386a', '#f06a8a', '#c82050'], 5, seed, 6, 2);
  } else if (v === 7) {                                           // сердце из камней, анютины глазки
    c.fillStyle = '#4a463e'; c.beginPath(); c.moveTo(cx, by); c.bezierCurveTo(cx - 14, by - 6, cx - 9, by - 14, cx, by - 8); c.bezierCurveTo(cx + 9, by - 14, cx + 14, by - 6, cx, by); c.fill();
    c.fillStyle = '#8a8478'; c.beginPath(); c.moveTo(cx, by - 1); c.bezierCurveTo(cx - 12.4, by - 6, cx - 8, by - 12.6, cx, by - 8); c.bezierCurveTo(cx + 8, by - 12.6, cx + 12.4, by - 6, cx, by - 1); c.fill();
    c.fillStyle = '#3a2a1c'; c.beginPath(); c.moveTo(cx, by - 2.4); c.bezierCurveTo(cx - 10, by - 6, cx - 7, by - 10.6, cx, by - 8); c.bezierCurveTo(cx + 7, by - 10.6, cx + 10, by - 6, cx, by - 2.4); c.fill();
    dBlooms(c, cx, by - 5, 12, ['#7a3ac0', '#f0c030'], 6, seed, 4, 1.4);
  } else if (v === 8) {                                           // чайник-цветочница
    ellipse(c, cx, by - 5, 8, 5.2, '#2a3a5a'); ellipse(c, cx, by - 5.6, 7.4, 4.8, '#e8eef8'); c.strokeStyle = '#3a5a9a'; c.lineWidth = 0.9; c.beginPath(); c.arc(cx, by - 5.6, 3.2, 0.3, 2.8); c.stroke();
    c.fillStyle = '#e8eef8'; c.beginPath(); c.moveTo(cx + 6, by - 6); c.quadraticCurveTo(cx + 11, by - 9, cx + 12, by - 12); c.lineTo(cx + 10, by - 10.6); c.quadraticCurveTo(cx + 8, by - 8, cx + 5, by - 4); c.fill();
    c.strokeStyle = '#e8eef8'; c.lineWidth = 1.6; c.beginPath(); c.arc(cx - 8, by - 6, 3, 1.6, 4.7); c.stroke();
    ellipse(c, cx, by - 10, 4.4, 1.4, '#e8eef8'); dBlooms(c, cx, by - 10, 8, ['#f08ac0', '#ffd0e8'], 4, seed, 5, 1.5);
  } else {                                                        // гномий сапог, колокольчики
    c.fillStyle = '#2a1608'; c.beginPath(); c.moveTo(cx - 5, by - 14); c.lineTo(cx + 3, by - 14); c.lineTo(cx + 3.6, by - 6); c.quadraticCurveTo(cx + 11, by - 5, cx + 11, by - 1); c.lineTo(cx - 6, by - 1); c.closePath(); c.fill();
    c.fillStyle = '#7a4a28'; c.beginPath(); c.moveTo(cx - 4.2, by - 13.4); c.lineTo(cx + 2.4, by - 13.4); c.lineTo(cx + 3, by - 5.4); c.quadraticCurveTo(cx + 9.6, by - 4.6, cx + 9.8, by - 1.8); c.lineTo(cx - 5, by - 1.8); c.closePath(); c.fill();
    c.fillStyle = '#c8a070'; c.fillRect(cx - 5, by - 14.4, 8.6, 2); line(c, cx - 5, by - 4, cx + 3, by - 4, '#3a2410', 0.7);
    dBlooms(c, cx - 0.6, by - 14, 6, ['#6a8aff', '#9ab0ff'], 4, seed, 6, 1.3);
  }
}

// ---------- Ящики и бочки: 5 видов ----------
function drawCrateObj(c, px, py, o) {
  const v = (o.v || 0) % 5, cx = px + 16, by = py + 25;
  shadowAt(c, cx, by, 11, 2.6);
  const barrel = (x, y, s = 1, tap = false) => {
    c.fillStyle = lingrad(c, x - 6 * s, 0, x + 6 * s, 0, [[0, '#b07848'], [0.5, '#8a5a30'], [1, '#5a3820']]);
    c.beginPath(); c.moveTo(x - 4.6 * s, y - 15 * s); c.quadraticCurveTo(x - 8 * s, y - 8 * s, x - 5 * s, y); c.lineTo(x + 5 * s, y); c.quadraticCurveTo(x + 8 * s, y - 8 * s, x + 4.6 * s, y - 15 * s); c.closePath(); c.fill();
    for (const yy of [-12, -4]) { c.fillStyle = '#2a2a30'; c.fillRect(x - 7 * s, y + yy * s, 14 * s, 1.3); }
    ellipse(c, x, y - 15 * s, 4.6 * s, 1.6 * s, '#caa070'); ellipse(c, x, y - 15.2 * s, 3.6 * s, 1.1 * s, '#7a5030');
    if (tap) { c.fillStyle = '#c8a040'; c.fillRect(x + 4 * s, y - 6, 4, 1.6); c.fillRect(x + 7 * s, y - 6, 1.4, 4); }
  };
  const crate = (x, y, w, h) => { dPlanks(c, x, y - h, w, h, '#b08850', '#3a2412'); line(c, x, y - h, x + w, y, 'rgba(50,30,14,0.7)', 0.8); line(c, x + w, y - h, x, y, 'rgba(50,30,14,0.7)', 0.8); };
  const sack = (x, y, col) => { c.fillStyle = '#4a3a20'; c.beginPath(); c.moveTo(x - 4, y); c.quadraticCurveTo(x - 6, y - 8, x - 2, y - 10); c.lineTo(x + 2, y - 10); c.quadraticCurveTo(x + 6, y - 8, x + 4, y); c.closePath(); c.fill(); c.fillStyle = col; c.beginPath(); c.moveTo(x - 3.4, y - 0.6); c.quadraticCurveTo(x - 5, y - 7.6, x - 1.6, y - 9.4); c.lineTo(x + 1.6, y - 9.4); c.quadraticCurveTo(x + 5, y - 7.6, x + 3.4, y - 0.6); c.fill(); line(c, x - 2, y - 10, x + 2, y - 10, '#8a6a3a', 1.2); };
  if (v === 0) barrel(cx, by);
  else if (v === 1) { barrel(cx - 5, by + 1, 0.9); barrel(cx + 6, by - 1, 0.85); }
  else if (v === 2) { crate(cx - 11, by, 13, 11); crate(cx + 3, by, 11, 9); crate(cx - 7, by - 11, 11, 9); }
  else if (v === 3) { sack(cx - 8, by, '#c8b070'); sack(cx - 2, by + 1, '#b8a060'); crate(cx + 3, by, 11, 10); }
  else { barrel(cx - 4, by, 1, true); c.save(); c.translate(cx + 8, by - 2); c.rotate(-0.15); c.fillStyle = '#6a4424'; c.fillRect(-3.4, -7, 6.8, 7); c.fillStyle = '#2a2a30'; c.fillRect(-3.4, -5, 6.8, 1); c.restore(); }
}

// ---------- Семь диковин ----------
function drawMagicObj(c, px, py, o) {
  const v = (o.v || 0) % 7, cx = px + 16, by = py + 26, t = Game.time;
  shadowAt(c, cx, by, 9, 2.6);
  if (v === 0) {                                                  // рунный камень
    c.fillStyle = lingrad(c, cx - 6, 0, cx + 6, 0, [[0, '#9a96a0'], [1, '#4a4650']]);
    c.beginPath(); c.moveTo(cx - 7, by); c.lineTo(cx - 5, by - 22); c.quadraticCurveTo(cx, by - 27, cx + 5, by - 21); c.lineTo(cx + 7, by); c.closePath(); c.fill();
    c.strokeStyle = '#1e1c22'; c.lineWidth = 0.8; c.stroke();
    c.strokeStyle = `rgba(120,230,255,${0.5 + 0.2 * Math.sin(t * 2 + px)})`; c.lineWidth = 1;
    c.beginPath(); c.moveTo(cx - 2, by - 8); c.lineTo(cx + 2, by - 12); c.lineTo(cx - 2, by - 16); c.moveTo(cx + 2, by - 18); c.lineTo(cx - 1, by - 21); c.stroke();
    ellipse(c, cx - 4, by - 2, 2.4, 1, '#5f8a3a');
  } else if (v === 1) {                                           // колодец желаний
    c.fillStyle = '#4a463e'; c.beginPath(); c.ellipse(cx, by - 4, 11, 5, 0, 0, 7); c.fill();
    c.fillStyle = '#9a948a'; c.fillRect(cx - 10, by - 10, 20, 8); c.fillStyle = '#7a756c'; for (let k = 0; k < 4; k++) c.fillRect(cx - 10 + k * 5, by - 10 + (k % 2) * 4, 5, 0.8);
    ellipse(c, cx, by - 10, 10, 4, '#b4aea2'); ellipse(c, cx, by - 10, 8, 3, '#2a5a88'); ellipse(c, cx + 2, by - 10.4, 1.2, 0.5, '#ffe9a0');
    c.fillStyle = '#4a2e18'; c.fillRect(cx - 10, by - 24, 2, 15); c.fillRect(cx + 8, by - 24, 2, 15);
    c.fillStyle = '#8a3a28'; c.beginPath(); c.moveTo(cx - 13, by - 22); c.lineTo(cx, by - 30); c.lineTo(cx + 13, by - 22); c.closePath(); c.fill(); c.fillStyle = '#b8583a'; c.beginPath(); c.moveTo(cx - 13, by - 22); c.lineTo(cx, by - 30); c.lineTo(cx - 2, by - 22); c.closePath(); c.fill();
    line(c, cx, by - 22, cx, by - 15, '#2a1a10', 0.7); c.fillStyle = '#6a4424'; c.fillRect(cx - 2, by - 15, 4, 3.4);
  } else if (v === 2) {                                           // пугало
    line(c, cx, by, cx, by - 26, '#4a2e18', 1.8); line(c, cx - 11, by - 17, cx + 11, by - 17, '#4a2e18', 1.8);
    c.fillStyle = '#6a7a3a'; c.beginPath(); c.moveTo(cx - 5, by - 16); c.lineTo(cx + 5, by - 16); c.lineTo(cx + 6, by - 6); c.lineTo(cx - 6, by - 6); c.closePath(); c.fill(); c.fillStyle = '#c8a040'; for (const [dx, dy] of [[-10, -17], [10, -17], [-5, -5], [5, -5]]) { line(c, cx + dx, by + dy, cx + dx + (dx < 0 ? -2 : 2), by + dy + 3, '#d8b050', 0.9); line(c, cx + dx, by + dy, cx + dx + (dx < 0 ? -3 : 3), by + dy + 1.4, '#d8b050', 0.9); }
    c.fillStyle = '#7a3a22'; c.fillRect(cx - 2, by - 12, 3, 3);
    ellipse(c, cx, by - 22, 4, 4.4, '#d8b070'); c.fillStyle = '#1a1008'; c.fillRect(cx - 2.2, by - 23, 1, 1); c.fillRect(cx + 1.2, by - 23, 1, 1); line(c, cx - 2, by - 20, cx + 2, by - 20, '#1a1008', 0.7);
    c.fillStyle = '#4a3a6a'; c.beginPath(); c.moveTo(cx - 6, by - 25); c.lineTo(cx + 1, by - 36); c.lineTo(cx + 6, by - 25); c.closePath(); c.fill(); c.fillStyle = '#e0a030'; c.fillRect(cx - 6.4, by - 26, 12.8, 1.4);
  } else if (v === 3) {                                           // грибное кольцо
    ellipse(c, cx, by - 3, 13, 5.6, 'rgba(60,110,40,0.55)');
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2, x = cx + Math.cos(a) * 11, y = by - 3 + Math.sin(a) * 4.6, r = 2 + (k % 3) * 0.5;
      line(c, x, y, x, y - 3, '#efe4cc', 1.3); ellipse(c, x, y - 3.4, r, r * 0.7, k % 2 ? '#c8341e' : '#e8d8a0'); c.fillStyle = '#fff'; c.fillRect(x - 0.6, y - 4.2, 0.7, 0.7);
    }
    for (let k = 0; k < 4; k++) { const q = (t * 0.4 + k * 0.25 + px) % 1; c.fillStyle = `rgba(255,240,160,${0.7 * (1 - q)})`; c.fillRect(cx - 6 + k * 4 + Math.sin(q * 6 + k) * 2, by - 6 - q * 16, 1, 1); }
  } else if (v === 4) {                                           // каменный гном
    c.fillStyle = '#6a655c'; c.fillRect(cx - 7, by - 4, 14, 4); c.fillStyle = '#8a8478'; c.fillRect(cx - 7, by - 4, 14, 1);
    c.fillStyle = lingrad(c, cx - 5, 0, cx + 5, 0, [[0, '#aaa59a'], [1, '#625e56']]); c.fillRect(cx - 4.4, by - 14, 8.8, 10);
    ellipse(c, cx, by - 17, 3.6, 3.6, '#a4a094'); c.fillStyle = '#c0bcb0'; c.beginPath(); c.moveTo(cx - 3, by - 15); c.quadraticCurveTo(cx, by - 8, cx + 3, by - 15); c.fill();
    c.fillStyle = '#7a756c'; c.beginPath(); c.moveTo(cx - 4.4, by - 18); c.lineTo(cx + 1, by - 28); c.lineTo(cx + 4.4, by - 18); c.fill(); c.fillStyle = '#1e1c22'; c.fillRect(cx - 2, by - 18, 1, 1); c.fillRect(cx + 1, by - 18, 1, 1);
    line(c, cx + 4, by - 12, cx + 10, by - 18, '#8a8478', 2);
  } else if (v === 5) {                                           // котёл на треноге
    for (const dx of [-7, 0, 7]) line(c, cx + dx * 0.8, by, cx + dx * 0.3, by - 12, '#2a1a10', 1.4);
    ellipse(c, cx, by - 2, 4, 1.4, '#e0601a'); for (let k = 0; k < 3; k++) { const fl = Math.sin(t * 9 + k * 2) * 1.2; c.fillStyle = k % 2 ? '#ff9a30' : '#e0501a'; c.beginPath(); c.moveTo(cx - 3 + k * 3, by - 1); c.quadraticCurveTo(cx - 3 + k * 3 + fl, by - 5, cx - 2 + k * 3, by - 8); c.lineTo(cx - 1 + k * 3, by - 1); c.fill(); }
    c.fillStyle = lingrad(c, cx - 8, 0, cx + 8, 0, [[0, '#4a4a52'], [1, '#17171c']]); c.beginPath(); c.ellipse(cx, by - 14, 9, 7.4, 0, 0, 7); c.fill();
    ellipse(c, cx, by - 19, 8, 2.8, '#17171c'); ellipse(c, cx, by - 19.2, 6.8, 2.2, '#58d870');
    for (let k = 0; k < 3; k++) { const q = (t * 0.7 + k * 0.33) % 1; c.fillStyle = `rgba(200,255,210,${0.6 * (1 - q)})`; c.beginPath(); c.arc(cx - 3 + k * 3 + Math.sin(q * 5 + k) * 1.4, by - 20 - q * 14, 1.2 + q * 1.6, 0, 7); c.fill(); }
  } else {                                                        // кристальный столп
    c.fillStyle = '#5a554e'; c.fillRect(cx - 6, by - 4, 12, 4); c.fillStyle = '#8a8478'; c.fillRect(cx - 6, by - 4, 12, 1);
    const bob = Math.sin(t * 1.4 + px) * 1.6;
    for (const [dx, h, w, col, lt] of [[-4, 16, 3.4, '#7a4ac8', '#c8a0ff'], [0, 22, 4.2, '#9a6aec', '#e2d0ff'], [4.4, 14, 3.2, '#6a3ab0', '#b890f0']]) {
      const y0 = by - 6 + bob * (dx === 0 ? 1.2 : 0.7);
      c.fillStyle = col; c.beginPath(); c.moveTo(cx + dx - w, y0); c.lineTo(cx + dx - w * 0.6, y0 - h * 0.7); c.lineTo(cx + dx, y0 - h); c.lineTo(cx + dx + w * 0.6, y0 - h * 0.7); c.lineTo(cx + dx + w, y0); c.closePath(); c.fill();
      c.fillStyle = lt; c.beginPath(); c.moveTo(cx + dx - w, y0); c.lineTo(cx + dx - w * 0.6, y0 - h * 0.7); c.lineTo(cx + dx, y0 - h); c.lineTo(cx + dx - 0.6, y0); c.closePath(); c.fill();
    }
    glow(c, cx, by - 16 + bob, 15, '170,110,255', 0.16 + 0.05 * Math.sin(t * 2));
  }
}

// ---------- Оградка у дорожки (субботник) ----------
function drawFenceObj(c, px, py, o) {
  const v = (o.v || 0) % 5, vert = !!o.vert, cx = px + 16, cy = py + 24;
  const post = (x, y) => {
    if (v === 0) { c.fillStyle = '#e8dcc0'; c.fillRect(x - 1, y - 8, 2, 9); c.beginPath(); c.moveTo(x - 1, y - 8); c.lineTo(x, y - 10); c.lineTo(x + 1, y - 8); c.fill(); }
    else if (v === 1) { c.fillStyle = '#7a5030'; c.fillRect(x - 1.2, y - 7, 2.4, 8); ellipse(c, x, y - 7, 1.4, 0.8, '#c8a070'); }
    else if (v === 2) { c.fillStyle = '#17121c'; c.fillRect(x - 0.6, y - 9, 1.2, 10); c.beginPath(); c.moveTo(x - 1.4, y - 8.4); c.lineTo(x, y - 11); c.lineTo(x + 1.4, y - 8.4); c.fill(); }
    else if (v === 3) { c.fillStyle = '#8a8478'; c.fillRect(x - 1.6, y - 6, 3.2, 7); c.fillStyle = '#c0bab0'; c.fillRect(x - 1.6, y - 6, 3.2, 0.8); }
    else { c.fillStyle = '#6a3c58'; c.fillRect(x - 1, y - 8, 2, 9); ellipse(c, x, y - 8.6, 1.6, 1.6, '#e8a0c0'); }
  };
  if (!vert) {
    const x0 = px + 1, x1 = px + TILE - 1;
    if (v !== 2 && v !== 3) { c.fillStyle = v === 0 ? '#d8cca8' : v === 4 ? '#8a5870' : '#9a6a3c'; c.fillRect(x0, cy - 5, x1 - x0, 1.4); c.fillRect(x0, cy - 2.4, x1 - x0, 1.4); }
    else if (v === 2) { c.fillStyle = '#17121c'; c.fillRect(x0, cy - 7, x1 - x0, 1); c.fillRect(x0, cy - 2, x1 - x0, 1); }
    else { c.fillStyle = '#7a756c'; c.fillRect(x0, cy - 4, x1 - x0, 3.4); c.fillStyle = '#aaa59a'; c.fillRect(x0, cy - 4, x1 - x0, 0.8); }
    for (let k = 0; k < 4; k++) post(x0 + 2 + k * 9.4, cy);
  } else {
    const y0 = py + 6, y1 = py + TILE - 2;
    for (let k = 0; k < 4; k++) post(cx, y0 + 4 + k * 7);
    c.fillStyle = v === 0 ? '#d8cca8' : v === 2 ? '#17121c' : v === 3 ? '#7a756c' : '#9a6a3c'; c.fillRect(cx - 0.7, y0 - 4, 1.4, y1 - y0 + 4);
  }
}

// ---------- Ночные преображения ----------
// 15 вариантов; каждую ночь для каждого предмета с вероятностью ~30% выбирается один из подходящих.
const MORPH_NAMES = ['', 'Глаза на спинке', 'Скалящаяся урна', 'Кровавые цветы', 'Светящиеся цветы', 'Дребезжащий ящик', 'Зелёная жижа', 'Призрачное пламя', 'Красные руны', 'Шёпот колодца', 'Поворот головы', 'Споры', 'Плачущий гном', 'Лицо в дыму', 'Молнии кристаллов', 'Рука из земли'];

function morphList(o) {
  switch (o.t) {
    case 'bench': return [1, 15];
    case 'bin': return [2, 15];
    case 'bed': return [3, 4, 15];
    case 'crate': return [5, 6, 15];
    case 'lamp': return [7, 15];
    case 'magic': return [[8, 15], [9, 15], [10, 15], [11, 15], [12, 15], [13, 15], [14, 15]][(o.v || 0) % 7];
    case 'fence': return [15];
  }
  return null;
}

function decorMorph(o, x, y) {
  if (nightAmt() < 0.35) return 0;
  const l = morphList(o);
  if (!l) return 0;
  const h = hash(nightIndex() * 7919 + idx(x, y) * 31 + 3);
  if ((h >>> 8) % 100 >= 30) return 0;
  return l[(h >>> 16) % l.length];
}

// Оверлей преображения поверх предмета; k — сила (0..1)
function drawMorph(c, id, px, py, o, k) {
  const t = Game.time, cx = px + 16, by = py + 25, pulse = 0.6 + 0.4 * Math.sin(t * 3 + px);
  c.save();
  c.globalAlpha = k;
  const eye = (x, y, r, col) => { glow(c, x, y, r * 3.4, col === '#ff3a30' ? '255,60,48' : '140,255,170', 0.3 * k); ellipse(c, x, y, r, r * 0.8, col); c.fillStyle = '#05100a'; c.fillRect(x - 0.25, y - r * 0.8, 0.6, r * 1.6); };
  switch (id) {
    case 1: for (let i = 0; i < 5; i++) if (Math.sin(t * 2.3 + i * 1.9 + px) > -0.7) eye(px + 7 + i * 4.4, py + 14 + (i % 2), 1.3, '#d8ff70'); break;
    case 2: eye(cx - 3, by - 8, 1.8, '#ff3a30'); eye(cx + 3, by - 8, 1.8, '#ff3a30'); c.fillStyle = '#12060a'; c.beginPath(); c.moveTo(cx - 5, by - 4.6); for (let i = 0; i <= 5; i++) c.lineTo(cx - 5 + i * 2, by - 4.6 + (i % 2 ? 2.4 : 0.4)); c.lineTo(cx + 5, by - 2); c.lineTo(cx - 5, by - 2); c.fill(); c.fillStyle = '#f0f0e0'; for (let i = 0; i < 5; i++) c.fillRect(cx - 4.6 + i * 2, by - 4.4, 1, 1.6); break;
    case 3: for (let i = 0; i < 6; i++) { const x = px + 6 + i * 4, lean = Math.sin(t + i) * 1.4 + 2; ellipse(c, x + lean, by - 10 - (i % 3) * 2, 2, 1.8, '#d01830'); glow(c, x + lean, by - 10, 8, '255,40,60', 0.22 * k); const q = (t * 0.8 + i * 0.3) % 1; c.fillStyle = `rgba(200,20,40,${1 - q})`; c.fillRect(x + lean, by - 8 + q * 7, 0.9, 1.5); } break;
    case 4: for (let i = 0; i < 7; i++) { const x = px + 5 + i * 3.6, y = by - 7 - (i % 3) * 3; glow(c, x, y, 7, i % 2 ? '120,220,255' : '200,120,255', (0.22 + 0.14 * Math.sin(t * 2 + i)) * k); ellipse(c, x, y, 1.4, 1.4, i % 2 ? '#a8f0ff' : '#e0b0ff'); } break;
    case 5: { const j = Math.sin(t * 40) * 0.8; c.fillStyle = '#6aff7a'; c.fillRect(px + 8 + j, by - 12, 16, 1.2); glow(c, cx, by - 10, 12, '120,255,120', 0.2 * k); line(c, cx - 8 + j, by - 14, cx + 6 + j, by - 14, 'rgba(60,40,20,0.8)', 1.4); break; }
    case 6: for (let i = 0; i < 4; i++) { const q = (t * 0.6 + i * 0.27) % 1; c.fillStyle = `rgba(110,255,90,${0.9 * (1 - q * 0.5)})`; c.fillRect(cx - 7 + i * 4.6, by - 12 + q * 12, 1.6, 2 + q * 3); } ellipse(c, cx, by + 0.4, 9, 2.2, 'rgba(100,255,90,0.55)'); glow(c, cx, by - 2, 14, '110,255,90', 0.22 * k); break;
    case 7: glow(c, px + 22, py - 6, 22, '110,255,200', 0.34 * k); eye(px + 20.4, py - 7, 1.1, '#e8fff0'); eye(px + 23.6, py - 7, 1.1, '#e8fff0'); c.fillStyle = 'rgba(190,255,230,0.8)'; c.beginPath(); c.ellipse(px + 22, py - 3.6, 1.2, 1.8 + Math.sin(t * 6) * 0.6, 0, 0, 7); c.fill(); break;
    case 8: c.strokeStyle = `rgba(255,50,40,${0.7 + 0.3 * pulse})`; c.lineWidth = 1.2; c.beginPath(); c.moveTo(cx - 2, by - 8); c.lineTo(cx + 2, by - 12); c.lineTo(cx - 2, by - 16); c.moveTo(cx + 2, by - 18); c.lineTo(cx - 1, by - 21); c.stroke(); glow(c, cx, by - 14, 20, '255,50,40', 0.26 * pulse * k); break;
    case 9: for (let i = 0; i < 3; i++) { const q = (t * 0.45 + i * 0.33) % 1; c.strokeStyle = `rgba(150,200,255,${0.7 * (1 - q)})`; c.lineWidth = 1; c.beginPath(); c.ellipse(cx, by - 11 - q * 22, 8 - q * 3, 3 - q, 0, 0, 7); c.stroke(); } glow(c, cx, by - 14, 22, '110,170,255', 0.28 * k); break;
    case 10: eye(cx - 1.4, by - 23, 1.3, '#ff3a30'); eye(cx + 2, by - 23, 1.3, '#ff3a30'); line(c, cx - 3, by - 20, cx + 3.6, by - 20.6, '#ff3a30', 0.8); break;
    case 11: for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28, x = cx + Math.cos(a) * 11, y = by - 3 + Math.sin(a) * 4.6; glow(c, x, y - 3, 8, i % 2 ? '120,255,220' : '255,140,220', 0.3 * k); const q = (t * 0.5 + i * 0.13) % 1; c.fillStyle = `rgba(200,255,230,${1 - q})`; c.fillRect(x + Math.sin(q * 8 + i) * 2, y - 5 - q * 18, 1, 1); } break;
    case 12: eye(cx - 1.4, by - 17.6, 1, '#ff3a30'); eye(cx + 1.6, by - 17.6, 1, '#ff3a30'); for (const dx of [-1.4, 1.6]) { const q = (t * 0.7 + dx) % 1; c.fillStyle = 'rgba(10,5,8,0.9)'; c.fillRect(cx + dx - 0.3, by - 16.6 + q * 9, 0.8, 2.4); } break;
    case 13: { const q = (t * 0.5) % 1, fy = by - 30 - q * 6; c.fillStyle = `rgba(215,255,225,${0.5 * (1 - q * 0.6)})`; ellipse(c, cx, fy, 6, 7, c.fillStyle); c.fillStyle = '#0a1a10'; ellipse(c, cx - 2.2, fy - 1, 1.2, 1.8, '#0a1a10'); ellipse(c, cx + 2.2, fy - 1, 1.2, 1.8, '#0a1a10'); ellipse(c, cx, fy + 3, 1.6, 2.4 + Math.sin(t * 5), '#0a1a10'); glow(c, cx, by - 16, 16, '110,255,150', 0.26 * k); break; }
    case 14: { const a = [[cx - 4, by - 14], [cx, by - 20], [cx + 4, by - 12]]; if (Math.sin(t * 9) > 0.3) { c.strokeStyle = 'rgba(230,200,255,0.95)'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(a[0][0], a[0][1]); c.lineTo(cx - 1, by - 17); c.lineTo(a[1][0], a[1][1]); c.lineTo(cx + 2, by - 14); c.lineTo(a[2][0], a[2][1]); c.stroke(); } glow(c, cx, by - 16, 22, '190,120,255', (0.26 + 0.14 * Math.sin(t * 7)) * k); break; }
    case 15: { // костлявая рука тянется из земли рядом
      const x = px + 5 + (hash(px * 3 + py) % 6), up = 5 + Math.sin(t * 1.3 + px) * 1.6;
      ellipse(c, x, py + 28, 3.4, 1.3, '#2a1c10'); line(c, x, py + 28, x, py + 28 - up, '#d8d0b4', 1.4);
      for (let i = -1; i <= 1; i++) { line(c, x, py + 28 - up, x + i * 1.6 + Math.sin(t * 3 + i) * 0.8, py + 28 - up - 3, '#d8d0b4', 0.8); }
      glow(c, x, py + 24, 8, '120,255,170', 0.2 * k); break;
    }
  }
  c.restore();
}

// Огонёк преображения для карты ночных огней (в тумане светятся только они)
function decorMorphLight(id, x, y) {
  const px = x * TILE, py = y * TILE;
  switch (id) {
    case 1: case 2: case 12: case 10: return [px + 16, py + 12, 26, 0.35, 'ent'];
    case 3: return [px + 16, py + 16, 30, 0.45];
    case 4: case 11: return [px + 16, py + 16, 32, 0.45, 'ent'];
    case 5: case 6: case 13: return [px + 16, py + 14, 34, 0.45, 'ent'];
    case 7: return [px + 22, py - 6, 44, 0.55, 'ent'];
    case 8: return [px + 16, py + 10, 34, 0.5];
    case 9: case 14: return [px + 16, py + 10, 36, 0.5, 'ent'];
    case 15: return [px + 14, py + 24, 22, 0.3, 'ent'];
  }
  return null;
}

// ---------- Общий вход: рисование предмета с «вырастанием» ----------
function drawDecorObj(c, x, y, o) {
  const px = x * TILE, py = y * TILE;
  const age = o.born !== undefined ? Game.time - o.born : 99;
  if (age < 0) return;
  const draw = () => {
    if (o.t === 'bench') drawBench(c, px, py, o);
    else if (o.t === 'bin') drawBin(c, px, py, o);
    else if (o.t === 'bed') drawBed(c, px, py, o);
    else if (o.t === 'crate') drawCrateObj(c, px, py, o);
    else if (o.t === 'magic') drawMagicObj(c, px, py, o);
    else if (o.t === 'fence') drawFenceObj(c, px, py, o);
  };
  if (age < GROW_T) {
    // вырастает из земли: показывается снизу вверх, сверху сыплются искры
    const k = age / GROW_T;
    c.save(); c.beginPath(); c.rect(px - 10, py + 30 - 46 * k, TILE + 20, 46 * k + 4); c.clip();
    c.translate(0, (1 - k) * 6); draw(); c.restore();
    for (let i = 0; i < 5; i++) { const q = (age * 1.2 + i * 0.21) % 1; c.fillStyle = `rgba(255,236,160,${0.9 * (1 - q)})`; c.fillRect(px + 6 + ((i * 7 + x) % 20), py + 28 - q * 30 * Math.max(0.3, k), 1.5, 1.5); }
    return;
  }
  draw();
  const m = decorMorph(o, x, y);
  if (m) drawMorph(c, m, px, py, o, Math.min(1, (nightAmt() - 0.35) * 3));
}

// ---------- Самовозведение ----------

function makeDecor(t) {
  if (t === 'bench') return { t, v: (Math.random() * 15) | 0 };
  if (t === 'bin') return { t, v: (Math.random() * 5) | 0, g: Math.random() * 0.3 };
  if (t === 'bed') return { t, v: (Math.random() * 10) | 0 };
  if (t === 'crate') return { t, v: (Math.random() * 5) | 0 };
  if (t === 'magic') return { t, v: (Math.random() * 7) | 0 };
  return { t };
}

function decorCount(t) { let n = 0; for (let i = 0; i < N_TILES; i++) { const o = World.obj[i]; if (o && o.t === t) n++; } return n; }

let decorT = 10;
function decorPlanTick(step) {
  decorT -= step;
  if (decorT > 0) return;
  decorT = 14 + Math.random() * 12;
  if (Game.buildings.length < 3) return;
  let roads = 0; for (let i = 0; i < N_TILES; i++) if (World.road[i] && !World.door[i]) roads++;
  if (roads < 14) return;
  // кого не хватает: потолки растут вместе с деревней
  const caps = { bench: roads / 7, bin: roads / 9, bed: roads / 4, crate: roads / 10, magic: Math.max(0, (roads - 24) / 22) };
  const pool = [];
  for (const t of Object.keys(caps)) if (decorCount(t) < caps[t]) pool.push(t, t);
  if (decorCount('lamp') < roads / 3.2) pool.push('lamp', 'lamp');
  if (!pool.length) return;
  const t = pool[(Math.random() * pool.length) | 0];
  // случайная дорожная клетка; скамейки, урны и фонари — рядом с ней, клумбы, ящики и диковины — в стороне, не кучами
  const far = t === 'bed' || t === 'crate' || t === 'magic';
  for (let k = 0; k < 40; k++) {
    const i = (Math.random() * N_TILES) | 0;
    if (!World.road[i] || World.door[i]) continue;
    const x = i % MAP_W, y = (i / MAP_W) | 0;
    let sx, sy;
    if (far) {
      const s = farSpot(x, y, 5, t === 'magic' ? 9 : 4);
      if (!s) continue;
      [sx, sy] = s;
    } else {
      const spots = [[x, y + 1], [x, y - 1], [x + 1, y], [x - 1, y]].filter(([a, b]) => streetSpot(a, b));
      if (!spots.length) continue;
      [sx, sy] = spots[(Math.random() * spots.length) | 0];
      if (t !== 'lamp' && streetNear(sx, sy, 4, t)) continue;
      if (t === 'lamp' && streetNear(sx, sy, 3, 'lamp')) continue;
    }
    const o = t === 'lamp' ? { t } : makeDecor(t);
    o.born = Game.time;
    World.obj[idx(sx, sy)] = o;
    fxBurst((sx + 0.5) * TILE, (sy + 0.9) * TILE, 8, ['#ffe9a0', '#c8f0ff', '#ffffff'], 30, 50, 0.9, 1.6, 40);
    if (t === 'magic' && Math.random() < 0.7) toast(`Из земли выросло что-то странное: ${MAGIC_NAMES[o.v].toLowerCase()}`);
    return;
  }
}

// ---------- Размещение «на отдалении»: клумбы, ящики, диковины — не вдоль дороги и не кучами ----------

function roadDistance(x, y, max) {
  let best = max + 1;
  for (let yy = y - max; yy <= y + max; yy++) for (let xx = x - max; xx <= x + max; xx++) {
    if (!inb(xx, yy) || !World.road[idx(xx, yy)]) continue;
    best = Math.min(best, Math.max(Math.abs(xx - x), Math.abs(yy - y)));
  }
  return best;
}

function decorWithin(x, y, r, types) {
  for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) {
    if (!inb(xx, yy)) continue;
    const o = World.obj[idx(xx, yy)];
    if (o && types.includes(o.t) && Math.hypot(xx - x, yy - y) <= r) return true;
  }
  return false;
}

// Свободная трава в 2–4 клетках от дороги вокруг (cx, cy), в стороне от таких же предметов
function farSpot(cx, cy, r, spacing, taken) {
  for (let k = 0; k < 70; k++) {
    const x = Math.floor(cx + (Math.random() * 2 - 1) * r), y = Math.floor(cy + (Math.random() * 2 - 1) * r);
    if (!inb(x, y) || !isFreeGrass(x, y) || (taken && taken.has(idx(x, y)))) continue;
    const d = roadDistance(x, y, 5);
    if (d < 2 || d > 4) continue;
    let door = false;
    for (let yy = y - 2; yy <= y + 2 && !door; yy++) for (let xx = x - 2; xx <= x + 2; xx++) if (inb(xx, yy) && World.door[idx(xx, yy)]) { door = true; break; }
    if (door) continue;
    if (decorWithin(x, y, spacing, ['bed', 'crate', 'magic', 'bench', 'bin'])) continue;
    if (taken) { let near = false; for (const ti of taken) if (Math.hypot(ti % MAP_W - x, ((ti / MAP_W) | 0) - y) <= spacing) { near = true; break; } if (near) continue; }
    return [x, y];
  }
  return null;
}
