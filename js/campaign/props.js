'use strict';
// Декор кампании (свой процедурный пиксель-арт, как js/campaign/art.js):
//  • серо-синяя палитра чужих домов Кремнёвки (акт 3, b.foreign → render.js drawBuilding);
//  • кремнёвцы — хозяева ходят по своей деревне между домами (только вид, не жители симуляции);
//  • руины Подгорья (акт 2) — 3 варианта остатков рухнувших домов;
//  • телеги обоза (акт 4) — крытый воз, тянет горный козёл, 8 кадров.

// ---------- Кремнёвка: серо-синяя палитра ----------
// Перекрашиваем готовый спрайт здания: яркость сохраняем, цвет тянем к сланцу; тёплый свет в окнах не трогаем.
const CAMP_FOREIGN = new WeakMap();
function campForeignSpr(spr) {
  let o = CAMP_FOREIGN.get(spr);
  if (o) return o;
  const src = spr.canvas, cv = mkCanvas(src.width, src.height), c = cv.getContext('2d', { willReadFrequently: true });
  c.drawImage(src, 0, 0);
  try {
    const im = c.getImageData(0, 0, cv.width, cv.height), d = im.data;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (r > 190 && g > 130 && r - b > 100) continue;
      const l = r * 0.3 + g * 0.55 + b * 0.15;
      d[i] = Math.min(255, l * 0.62 + r * 0.2); d[i + 1] = Math.min(255, l * 0.7 + g * 0.2); d[i + 2] = Math.min(255, l * 0.92 + b * 0.2);
    }
    c.putImageData(im, 0, 0);
  } catch (e) { /* холст недоступен для чтения — оставим как есть */ }
  o = Object.assign({}, spr, { canvas: cv });
  CAMP_FOREIGN.set(spr, o);
  return o;
}

// ---------- Кремнёвцы ----------
// Шесть обликов в серо-синем: v — облик, ph — фаза шага (0..3); смотрят вправо (влево — зеркалим при выводе)
const CAMP_KV = [
  { coat: '#5a6a86', coat2: '#46546c', beard: '#8a8e96', hat: 'cap', item: 'pick', skin: '#e0b498' },
  { coat: '#7a8aa6', coat2: '#5e6c86', beard: null, hat: 'scarf', item: 'basket', skin: '#e8bc9c' },
  { coat: '#4a5a76', coat2: '#3a465e', beard: '#6a5a4a', hat: 'hood', item: 'sack', skin: '#d8ac90' },
  { coat: '#6a7078', coat2: '#50565e', beard: '#d8dce4', hat: 'bald', item: 'stick', skin: '#e0b498' },
  { coat: '#5e7290', coat2: '#4a5a74', beard: null, hat: 'scarf2', item: 'bucket', skin: '#e8c0a0' },
  { coat: '#56606e', coat2: '#424a56', beard: '#b07a4a', hat: 'cap', item: 'stone', skin: '#e0b090' },
];
const CAMP_PROP_SPR = {};
function campDrawKv(c, v, ph) {
  const P = CAMP_KV[v % CAMP_KV.length], sw = [0, 1, 0, -1][ph] * 2.2, bob = ph % 2 ? -0.7 : 0;
  c.fillStyle = 'rgba(10,8,4,0.32)'; c.beginPath(); c.ellipse(0, 0, 7, 2, 0, 0, 7); c.fill();
  naLimb(c, -2, -8, -2 + sw, -0.6, 2.2, '#34363e'); naLimb(c, 2, -8, 2 - sw, -0.6, 2.2, '#3a3c44');
  ellipse(c, -1.4 + sw, -0.4, 1.8, 0.9, '#2a2420'); ellipse(c, 2.6 - sw, -0.4, 1.8, 0.9, '#2a2420');
  c.translate(0, bob);
  if (P.item === 'sack') { ellipse(c, -6, -17, 4, 5, '#a89a7a'); c.fillStyle = '#7a6a4a'; c.fillRect(-7, -22, 2, 1.4); }
  naLimb(c, -5, -18.6, -6 - sw * 0.7, -11, 2, P.coat2);                                   // дальняя рука
  poly(c, [[-6, -21], [6, -21], [7, -7], [-7, -7]], P.coat);
  poly(c, [[-6, -21], [-2, -21], [-3, -7], [-7, -7]], P.coat2);
  c.fillStyle = '#2a2a32'; c.fillRect(-7, -10, 14, 1.4);                                    // пояс
  ellipse(c, 0, -25, 5, 4.8, P.skin);
  ellipse(c, 2.2, -24.8, 1.4, 1.1, '#cc9478');                                              // нос
  c.fillStyle = '#1a0f0a'; c.fillRect(1.4, -26.6, 1, 1.2); c.fillRect(-1.4, -26.6, 0.9, 1.2);
  if (P.beard) poly(c, [[-4.4, -23.6], [4.8, -23.6], [3.4, -16.4], [0, -15], [-3.4, -16.6]], P.beard);
  if (P.hat === 'cap') { poly(c, [[-5.2, -27], [-4, -31], [4, -31], [5.4, -27]], '#3a4256'); c.fillStyle = '#2a3040'; c.fillRect(-1, -27.6, 8, 1.2); }
  else if (P.hat === 'scarf' || P.hat === 'scarf2') poly(c, [[-5.6, -24], [-5, -30], [0, -31.6], [5, -30], [5.4, -26], [3, -28.6], [-3.4, -28.4], [-4.4, -22]], P.hat === 'scarf' ? '#9aa8c0' : '#8a6a8a');
  else if (P.hat === 'hood') poly(c, [[-5.6, -21], [-5.6, -28], [-1, -32], [4, -30], [5.6, -27], [2, -28.6], [-3, -28], [-3.6, -21]], '#3a465e');
  else poly(c, [[-5, -26], [-4.6, -28.6], [-2, -29.6], [-1, -27.4], [-4, -25]], P.beard);     // лысина с седым венчиком
  const ax = 6 + sw * 0.7, ay = -11;                                                        // ближняя рука и ноша
  if (P.item === 'pick') { naLimb(c, 4, -19, 5, -22, 2, P.coat); naLimb(c, 3, -26, 9, -18, 0.9, '#6a4a2a'); poly(c, [[1, -27], [5, -24.6], [4.6, -24], [0.6, -26]], '#8a8e96'); }
  else if (P.item === 'stick') { naLimb(c, 5, -18.6, ax + 1, ay, 2, P.coat); naLimb(c, ax + 2, ay - 4, ax + 3, 0, 0.9, '#6a4a2a'); }
  else {
    naLimb(c, 5, -18.6, ax, ay, 2, P.coat);
    if (P.item === 'basket') { ellipse(c, ax + 1, ay + 2.6, 3.4, 2.4, '#a07a40'); c.strokeStyle = '#7a5a2a'; c.lineWidth = 0.6; c.beginPath(); c.arc(ax + 1, ay + 1.6, 2.6, Math.PI, 0); c.stroke(); ellipse(c, ax, ay + 1.4, 1, 0.8, '#d84a3a'); }
    else if (P.item === 'bucket') { poly(c, [[ax - 1.6, ay + 0.6], [ax + 3, ay + 0.6], [ax + 2.4, ay + 5], [ax - 1, ay + 5]], '#8a8e96'); c.fillStyle = '#7ab0e0'; c.fillRect(ax - 1.2, ay + 0.6, 4, 0.9); }
    else if (P.item === 'stone') { ellipse(c, ax + 1, ay + 1.4, 2.8, 2.4, '#8a8478'); ellipse(c, ax + 0.4, ay + 0.8, 1.2, 0.9, '#aaa498'); }
  }
}
function campKvSprite(v, ph) {
  const key = 'kv' + v + '_' + ph;
  if (CAMP_PROP_SPR[key]) return CAMP_PROP_SPR[key];
  const [cv, c] = mkSprite(40, 48, 3);
  c.translate(20, 44);
  campDrawKv(c, v, ph);
  return (CAMP_PROP_SPR[key] = toPixelArt(cv, 3, { outline: true, outlineDark: 0.3, alphaCut: 100 }));
}
// x, y — клетка (как у campDrawNpc); flip — идёт влево
function campDrawKvAt(c, v, ph, x, y, flip) {
  const s = campKvSprite(v, ph), px = Math.round(x * TILE + 16), py = Math.round(y * TILE + 26 - 44);
  if (!flip) { c.drawImage(s, px - 20, py); return; }
  c.save(); c.translate(px, py); c.scale(-1, 1); c.drawImage(s, -20, 0); c.restore();
}

// ---------- Руины Подгорья (акт 2) ----------
// r = [x, y, w, h, вариант]: 0 — обломки стен и упавшие балки, 1 — уцелевшая труба и съехавшая крыша, 2 — обгорелый остов с дверной рамой
function campRuinSprite(w, h, v) {
  const key = 'ruin' + w + 'x' + h + ':' + v;
  if (CAMP_PROP_SPR[key]) return CAMP_PROP_SPR[key];
  const W = w * TILE + 16, H = h * TILE + 40;
  const [cv, c] = mkSprite(W, H, 3);
  const rnd = mulberry32(hashStr(key)), x0 = 8, y1 = H - 6, fw = w * TILE, fh = h * TILE * 0.62;
  c.fillStyle = 'rgba(40,32,26,0.45)'; c.beginPath(); c.ellipse(x0 + fw / 2, y1 - fh / 2, fw / 2 + 4, fh / 2 + 2, 0, 0, 7); c.fill();   // пятно щебня
  const stone = () => ['#7a7068', '#8a8278', '#5e564e', '#9a9288'][rnd() * 4 | 0];
  const wall = (ax, ay, len, hgt, col) => {                       // стенка из камней с рваным верхом
    for (let k = 0; k < len; k += 4) {
      const hh = hgt * (0.35 + rnd() * 0.65);
      for (let yy = 0; yy < hh; yy += 3.4) { c.fillStyle = col || stone(); c.fillRect(ax + k + (yy / 3.4 % 2 ? 1.5 : 0), ay - yy - 3.2, 3.6, 3); }
    }
  };
  const beam = (ax, ay, bx, by) => { naLimb(c, ax, ay, bx, by, 2.6, '#4a3020'); naLimb(c, ax, ay - 0.8, bx, by - 0.8, 0.9, '#6a4a2e'); };
  if (v === 0) {
    wall(x0 + 2, y1 - fh + 4, fw * 0.45, 20); wall(x0 + fw * 0.55, y1 - fh + 6, fw * 0.4, 14);
    wall(x0 + 2, y1 - 2, fw * 0.3, 8);
    beam(x0 + fw * 0.15, y1 - 6, x0 + fw * 0.7, y1 - fh - 6); beam(x0 + fw * 0.4, y1 - 2, x0 + fw * 0.95, y1 - fh * 0.5);
  } else if (v === 1) {
    wall(x0 + 4, y1 - fh + 4, fw * 0.8, 10);
    poly(c, [[x0 + fw * 0.15, y1 - 4], [x0 + fw * 0.5, y1 - fh * 0.9], [x0 + fw * 0.9, y1 - 8], [x0 + fw * 0.6, y1]], '#6a4a2e');   // съехавшая крыша
    c.fillStyle = '#8a6238'; for (let k = 0; k < 6; k++) c.fillRect(x0 + fw * (0.2 + k * 0.11), y1 - fh * 0.5 + k * 2 - 6, 5, 1.6);
    c.fillStyle = '#5e564e'; c.fillRect(x0 + fw * 0.72, y1 - fh - 26, 9, 30); c.fillStyle = '#7a7068'; c.fillRect(x0 + fw * 0.72, y1 - fh - 26, 3, 30);   // труба
    c.fillStyle = '#2a2420'; c.fillRect(x0 + fw * 0.72 + 2, y1 - fh - 27, 5, 2);
  } else {
    wall(x0 + 2, y1 - fh + 4, fw * 0.9, 12, '#5a5048'); wall(x0 + 2, y1 - 2, fw * 0.25, 10, '#5a5048'); wall(x0 + fw * 0.7, y1 - 2, fw * 0.25, 10, '#5a5048');
    c.fillStyle = '#2a1e16'; c.fillRect(x0 + fw * 0.4, y1 - 22, 3, 20); c.fillRect(x0 + fw * 0.4 + 10, y1 - 22, 3, 20); c.fillRect(x0 + fw * 0.4, y1 - 23, 13, 3);   // дверная рама
    beam(x0 + fw * 0.1, y1 - fh * 0.4, x0 + fw * 0.55, y1 - fh * 0.75);
    c.fillStyle = '#1e1814'; for (let k = 0; k < 8; k++) c.fillRect(x0 + rnd() * fw, y1 - rnd() * fh, 3, 2);   // угли
  }
  for (let k = 0; k < 14; k++) { const s = 1.6 + rnd() * 3; ellipse(c, x0 + rnd() * fw, y1 - rnd() * fh * 0.9, s, s * 0.7, stone()); }   // щебень
  return (CAMP_PROP_SPR[key] = toPixelArt(cv, 3, { outline: true, outlineDark: 0.3, alphaCut: 100 }));
}
function campDrawRuin(c, r) {
  const s = campRuinSprite(r[2], r[3], r[4] || 0);
  c.drawImage(s, r[0] * TILE - 8, (r[1] + r[3]) * TILE - s.height + 6);
}

// ---------- Телеги обоза (акт 4): крытый воз, тянет горный козёл ----------
// 8 кадров: ноги козла (4 фазы) × поворот спиц; смотрит вправо, влево — зеркалим
function campDrawCartArt(c, f) {
  const leg = [0, 1, 0, -1][f % 4] * 2, spin = f * Math.PI / 16;
  c.fillStyle = 'rgba(10,8,4,0.3)'; c.beginPath(); c.ellipse(-4, 0, 20, 3.4, 0, 0, 7); c.fill();
  // козёл: серо-белый, рога-завитки, бородка
  naLimb(c, 14, -8, 14 + leg, 0, 1.6, '#8a8278'); naLimb(c, 22, -8, 22 - leg, 0, 1.6, '#8a8278');
  ellipse(c, 18, -11, 6.4, 4, '#e0dcd2'); ellipse(c, 16, -12, 4, 2.6, '#f2eee4');
  naLimb(c, 13, -8, 13 - leg, 0, 1.7, '#d8d2c4'); naLimb(c, 21, -8, 21 + leg, 0, 1.7, '#d8d2c4');
  ellipse(c, 25, -15, 3, 2.6, '#e0dcd2'); ellipse(c, 27.4, -14.2, 1.6, 1.2, '#c8c0b4');
  c.strokeStyle = '#8a7a5a'; c.lineWidth = 1.2; c.beginPath(); c.arc(23.6, -18, 2.2, Math.PI * 0.9, Math.PI * 2.1); c.stroke();
  poly(c, [[26, -13], [27, -9.6], [25.4, -12.4]], '#c8c0b4');
  c.fillStyle = '#1a0f0a'; c.fillRect(25.6, -16, 0.9, 0.9);
  naLimb(c, 6, -9, 14, -11, 1.2, '#4a3020');                                                // оглобля
  // воз: короб, парусиновый верх с заплатой, мешки и бочонок сзади
  poly(c, [[-22, -16], [6, -16], [6, -7], [-22, -7]], '#6a4424'); c.fillStyle = '#8a5a30'; c.fillRect(-22, -16, 28, 2);
  c.fillStyle = '#4a2e18'; for (const x of [-15, -6]) c.fillRect(x, -15, 1, 8);
  c.fillStyle = '#e8dcc0'; c.beginPath(); c.moveTo(-21, -16); c.quadraticCurveTo(-21, -34, -8, -34); c.quadraticCurveTo(5, -34, 5, -16); c.closePath(); c.fill();
  c.fillStyle = '#d0c4a4'; c.beginPath(); c.moveTo(-21, -16); c.quadraticCurveTo(-21, -34, -13, -33); c.lineTo(-15, -16); c.closePath(); c.fill();
  c.fillStyle = '#8a9ab0'; c.fillRect(-4, -28, 5, 4);                                       // заплата
  c.strokeStyle = '#a89878'; c.lineWidth = 0.7; for (const x of [-13, -4]) { c.beginPath(); c.moveTo(x, -16); c.lineTo(x + 0.5, -33); c.stroke(); }
  ellipse(c, -23, -18, 3, 4, '#a89a7a'); poly(c, [[-27, -22], [-23, -24], [-21, -18], [-25, -16]], '#6a4424');
  for (const wx of [-16, 0]) {                                                              // колёса со спицами
    c.fillStyle = '#2a1c10'; c.beginPath(); c.arc(wx, -5, 5, 0, 7); c.fill();
    c.fillStyle = '#5a3a20'; c.beginPath(); c.arc(wx, -5, 3.8, 0, 7); c.fill();
    c.strokeStyle = '#9a7a4a'; c.lineWidth = 1;
    for (let k = 0; k < 4; k++) { const a = spin + k * Math.PI / 4; c.beginPath(); c.moveTo(wx - Math.cos(a) * 3.8, -5 - Math.sin(a) * 3.8); c.lineTo(wx + Math.cos(a) * 3.8, -5 + Math.sin(a) * 3.8); c.stroke(); }
    ellipse(c, wx, -5, 1.2, 1.2, '#c8a050');
  }
}
function campCartSprite(f) {
  const key = 'cart' + f;
  if (CAMP_PROP_SPR[key]) return CAMP_PROP_SPR[key];
  const [cv, c] = mkSprite(64, 44, 3);
  c.translate(34, 40);
  campDrawCartArt(c, f);
  return (CAMP_PROP_SPR[key] = toPixelArt(cv, 3, { outline: true, outlineDark: 0.3, alphaCut: 100 }));
}
// x, y — клетка; ph — пройденный путь, клеток (крутит колёса и ноги); flip — едет влево
function campDrawCartAt(c, x, y, ph, flip) {
  const s = campCartSprite(Math.floor(ph * 3) & 7), px = Math.round(x * TILE + 16), py = Math.round(y * TILE + 26 - 40);
  c.save(); c.translate(px, py); if (flip) c.scale(-1, 1); c.drawImage(s, -34, 0); c.restore();
}
