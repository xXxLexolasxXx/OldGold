'use strict';
// Портреты собеседников в диалогах кампании, лора и Старца голема: свой процедурный пиксель-арт в стиле игры.
// Рисуем в сетке 36×36 «единиц», но с надвыборкой ×6 и сводим ×3 — получается 72×72 настоящих пикселя
// (вдвое мельче прежнего: на экране портрет остаётся 72 px, один пиксель арта = один пиксель экрана) с обводкой.
// Гномы устроены как гномы игры: острый колпак с отворотом (цвет — профессии), большой нос, борода, жилет.
// Два кадра: 0 — глаза открыты, 1 — моргнул (у Малгора глаза тускнеют, у рассказчика дрожит свеча,
// у Старца гаснет руна). Моргание — CSS (второй кадр поверх, campaign.css).
// Кадры кэшируются как data-URL: один раз на кадр за всю игру.

const CAMP_FACE = {};
const CF_W = 72;          // пикселей по стороне
const CF_SS = 6;          // надвыборка: единица рисунка = 6 px холста, 3 px холста = 1 px арта

function cfShoulders(c, col, col2, wide = 0) {
  poly(c, [[1 - wide, 36], [4 - wide, 29], [12, 26], [24, 26], [32 + wide, 29], [35 + wide, 36]], col);
  poly(c, [[1 - wide, 36], [4 - wide, 29], [12, 26], [14, 36]], col2);
  c.fillStyle = shade(col, 0.22); c.fillRect(13, 26, 10, 0.6);
}
// жилет: две полы с пуговицами, как у наших гномов
function cfVest(c, col, rivets) {
  poly(c, [[7, 36], [9.4, 28.4], [14.4, 26.4], [16.4, 36]], col); poly(c, [[29, 36], [26.6, 28.4], [21.6, 26.4], [19.6, 36]], col);
  poly(c, [[7, 36], [9.4, 28.4], [10.6, 28], [10, 36]], shade(col, -0.3));
  c.fillStyle = rivets ? '#cec6ba' : '#e8c050';
  for (let k = 0; k < 3; k++) { c.fillRect(15.2, 29.4 + k * 2.2, 0.9, 0.9); c.fillRect(19.9, 29.4 + k * 2.2, 0.9, 0.9); }
}
function cfHead(c, x, y, rx, ry, skin, skin2) {
  for (const d of [-1, 1]) {                                                                              // уши торчат острыми лопухами, как у наших гномов
    poly(c, [[x + d * (rx - 1), y - 1.8], [x + d * (rx + 4.6), y - 4.2], [x + d * (rx + 0.2), y + 2.6]], skin2, shade(skin2, -0.3), 0.3);
    poly(c, [[x + d * (rx - 0.4), y - 0.8], [x + d * (rx + 3.2), y - 3], [x + d * (rx + 0.2), y + 1.4]], shade(skin2, -0.18));
  }
  ellipse(c, x, y, rx, ry, skin);
  ellipse(c, x + rx * 0.55, y + ry * 0.15, rx * 0.34, ry * 0.7, skin2 + '77');                            // тень со стороны
  ellipse(c, x - rx * 0.4, y - ry * 0.1, rx * 0.34, ry * 0.4, shade(skin, 0.18) + '88');                  // свет
}
// большой нос с бликом и тенью — «картошкой»
function cfNose(c, x, y, r, col = '#d8906c') {
  ellipse(c, x + 0.3, y + r * 0.45, r * 1.05, r * 0.7, shade(col, -0.2));
  ellipse(c, x, y, r, r * 0.9, col);
  ellipse(c, x - r * 0.35, y - r * 0.35, r * 0.38, r * 0.3, shade(col, 0.42));
  c.fillStyle = shade(col, -0.45); c.fillRect(x - r * 0.62, y + r * 0.62, 0.6, 0.55); c.fillRect(x + r * 0.28, y + r * 0.62, 0.6, 0.55);
}
// глаза: белок и зрачок (dx — куда смотрит), моргнул — чёрточки с ресницами
function cfEyes(c, x1, x2, y, f, dx = 0, iris = '#1a0f0a') {
  if (f) { c.fillStyle = '#3a2418'; c.fillRect(x1 - 1.4, y + 0.1, 2.8, 0.55); c.fillRect(x2 - 1.4, y + 0.1, 2.8, 0.55); c.fillRect(x1 - 1.4, y + 0.5, 0.5, 0.45); c.fillRect(x2 + 0.9, y + 0.5, 0.5, 0.45); return; }
  ellipse(c, x1, y, 1.4, 1.2, '#f4eee0'); ellipse(c, x2, y, 1.4, 1.2, '#f4eee0');
  ellipse(c, x1 + dx, y + 0.1, 0.8, 0.9, iris); ellipse(c, x2 + dx, y + 0.1, 0.8, 0.9, iris);
  c.fillStyle = '#fff'; c.fillRect(x1 + dx - 0.5, y - 0.5, 0.5, 0.5); c.fillRect(x2 + dx - 0.5, y - 0.5, 0.5, 0.5);
  c.fillStyle = 'rgba(40,20,10,0.5)'; c.fillRect(x1 - 1.4, y - 1.3, 2.8, 0.4); c.fillRect(x2 - 1.4, y - 1.3, 2.8, 0.4);   // верхнее веко
}
function cfBrows(c, x1, x2, y, col, frown = 0, w = 1) {
  poly(c, [[x1 - 2.4, y - frown * 0.4], [x1 + 1.8, y + frown], [x1 + 1.8, y + frown + w], [x1 - 2.4, y + w - frown * 0.4]], col);
  poly(c, [[x2 + 2.4, y - frown * 0.4], [x2 - 1.8, y + frown], [x2 - 1.8, y + frown + w], [x2 + 2.4, y + w - frown * 0.4]], col);
}
// острый колпак с толстым отворотом (как у гномов игры): col — цвет, tall — высота кончика, lean — куда его гнёт,
// moss — зерно для мшистых крапинок, band — цвет ленты над отворотом
// высота кончика по фасонам — как CAP_TALL в people.js
const CF_TALL = [10.5, 11.5, 9.5, 8.5, 11, 11.5, 8, 10.5, 7.5, 9.5];
// контур колпака — те же десять фасонов, что у гномов игры (capShape в people.js): 0 крюком, 1 конус, 2 с загнутым краем,
// 3 с короткой петлёй, 4 длинный ночной до плеча, 5 зигзаг, 6 блин, 7 штопор, 8 купол с помпоном, 9 два рожка
function cfCapShape(c, cx, b, s, tall, style, K) {
  const X = k => cx + k * s * K;
  c.beginPath(); c.moveTo(X(-4.3), b);
  const q = (a1, a2, b1, b2) => c.quadraticCurveTo(X(a1), b - tall * a2, X(b1), b - tall * b2);
  if (style === 1) { q(-3.2, 0.55, 1.4, 1); q(3.4, 0.5, 4.3, 0); }
  else if (style === 2) { q(-4.8, 0.85, 0.6, 0.9); q(5.6, 0.95, 6.4, 0.35); c.quadraticCurveTo(X(6.9), b + 0.2, X(5.6), b + 1.4); q(4.9, 0.2, 3.9, 0.45); q(4.5, 0.2, 4.3, 0); }
  else if (style === 3) { q(-4.4, 0.95, 0.6, 1); q(3.8, 1.05, 4.4, 0.62); q(3.2, 0.7, 3.3, 0.45); q(4.5, 0.25, 4.3, 0); }
  else if (style === 4) { q(-4.6, 0.7, -0.4, 0.96); q(3.6, 1.02, 5.8, 0.5); c.quadraticCurveTo(X(7.6), b - tall * 0.05, X(7.2), b + 5.6); c.quadraticCurveTo(X(6.2), b + 2, X(4.8), b - tall * 0.34); q(4.7, 0.1, 4.3, 0); }
  else if (style === 5) { q(-3.4, 0.3, 0.4, 0.56); q(-0.8, 0.8, -2.4, 1.02); q(0.8, 0.95, 4.8, 0.5); q(5.6, 0.2, 4.3, 0); }
  else if (style === 6) { q(-7.6, 0.12, -6.4, 0.42); q(-3, 0.78, -0.5, 0.7); c.lineTo(X(-0.3), b - tall * 0.98); c.lineTo(X(1.1), b - tall * 0.98); c.lineTo(X(0.9), b - tall * 0.7); q(4, 0.78, 6.4, 0.42); q(7.6, 0.12, 4.3, 0); }
  else if (style === 7) { q(-3.8, 0.6, 0.4, 0.8); q(3.2, 1.18, 4.8, 0.92); q(5.6, 0.64, 3.4, 0.62); q(2.2, 0.66, 2.8, 0.8); q(4.8, 0.42, 4.3, 0); }
  else if (style === 8) { q(-4.2, 0.78, 1.2, 0.9); q(4.4, 0.7, 4.3, 0); }
  else if (style === 9) { q(-6.6, 0.5, -5.4, 0.92); q(-2.6, 0.56, 0, 0.48); q(2.6, 0.56, 5.4, 0.92); q(6.6, 0.5, 4.3, 0); }
  else { q(-4.4, 0.62, -0.8, 0.88); q(2.4, 1.12, 5.8, 0.86); q(7.4, 0.72, 7.4, 0.42); q(6.2, 0.66, 3.8, 0.7); q(4.6, 0.34, 4.3, 0); }
  c.closePath();
}
// style — фасон (0–9), dir — в какую сторону загнут (1 вправо, −1 влево)
function cfCap(c, o) {
  const col = o.col, B = o.by ?? 13.8, W = o.w ?? 8.4, st = o.style ?? 0, s = o.dir ?? 1, K = W / 4.3, T = (o.tall ?? CF_TALL[st]) * 1.08, cx = 18;
  const path = () => cfCapShape(c, cx, B, s, T, st, K);
  path(); c.fillStyle = col; c.fill();
  c.save(); path(); c.clip();
  c.fillStyle = shade(col, -0.32);                                                                       // тень с одной стороны
  c.beginPath(); c.moveTo(cx + 1.2, B); c.lineTo(cx + 1.8, B - T * 0.5); c.lineTo(cx + 1.4, B - T * 1.2); c.lineTo(cx + 30, B - T * 1.2); c.lineTo(cx + 30, B + 2); c.closePath(); c.fill();
  ellipse(c, cx - W * 0.42, B - T * 0.3, 1.1, T * 0.2, shade(col, 0.3));                                 // блик
  if (st === 0 || st === 1 || st === 3 || st === 5 || st === 7) {                                        // складки
    c.strokeStyle = shade(col, -0.4); c.lineWidth = 0.3;
    c.beginPath(); c.moveTo(cx - 2, B); c.quadraticCurveTo(cx - 1.6 * s, B - T * 0.5, cx + 1 * s, B - T * 0.8); c.stroke();
    c.beginPath(); c.moveTo(cx + 2.4, B); c.quadraticCurveTo(cx + 3 * s, B - T * 0.3, cx + 4 * s, B - T * 0.6); c.stroke();
  }
  if (o.moss) {
    const r = mulberry32(o.moss | 0);
    c.fillStyle = '#7ab04e'; for (let k = 0; k < 16; k++) c.fillRect(cx - W + r() * W * 2, B - r() * T, 0.8, 0.7);
    c.fillStyle = '#4e8a2a'; for (let k = 0; k < 8; k++) c.fillRect(cx - W + r() * W * 2, B - r() * T * 0.8, 0.9, 0.9);
  }
  c.restore();
  if (o.band) { c.fillStyle = o.band; c.fillRect(cx - W + 0.8, B - 2.6, W * 2 - 1.6, 1); c.fillStyle = shade(o.band, -0.35); c.fillRect(cx - W + 0.8, B - 1.7, W * 2 - 1.6, 0.35); }
  if (st === 8) { ellipse(c, cx + 1.2 * s * K, B - T * 0.92 - 0.6, 2.2, 2.1, shade(col, 0.3)); ellipse(c, cx + 0.5 * s * K, B - T * 0.92 - 1.4, 0.9, 0.8, shade(col, 0.55)); }   // помпон
  if (st === 9) for (const k of [-5.4, 5.4]) ellipse(c, cx + k * K, B - T * 0.92, 1.3, 1.3, shade(col, 0.3));                                                          // шарики на рожках
  const BW = st === 6 ? W * 1.12 : W;
  // отворот — толстый, подвёрнутый
  c.save(); rrect(c, cx - BW - 0.5, B - 1.6, BW * 2 + 1, 3.2, 1.5);
  c.fillStyle = lingrad(c, 0, B - 1.6, 0, B + 1.6, [[0, shade(col, 0.2)], [0.55, col], [1, shade(col, -0.4)]]); c.fill(); c.clip();
  c.fillStyle = shade(col, -0.45); c.fillRect(cx - BW - 1, B + 1.1, BW * 2 + 2, 0.5);
  c.fillStyle = shade(col, 0.4); c.fillRect(cx - BW + 0.5, B - 1.4, BW * 2 - 1, 0.4);
  if (o.moss) { const r = mulberry32((o.moss | 0) + 5); c.fillStyle = '#6aa03e'; for (let k = 0; k < 7; k++) c.fillRect(cx - W + r() * W * 2, B - 1.4 + r() * 2.6, 1, 0.8); }
  c.restore();
}
// борода: shape — spade (лопатой), fork (раздвоенная), point (клинышком), short; len — нижняя точка; wid — полуширина вверху
function cfBeard(c, col, o = {}) {
  const len = Math.min(36, (o.len ?? 32) + 1.5), wid = (o.wid ?? 7) * 1.25, shape = o.shape || 'spade', top = o.top ?? 18.4;
  const lo = shade(col, -0.3), hi = shade(col, 0.28);
  const tail = shape === 'fork' ? [[18 + wid * 0.7, len], [18, len - 3.4], [18 - wid * 0.7, len]]
    : shape === 'point' ? [[19, len - 1], [18, len], [17, len - 1]]
    : shape === 'short' ? [[18 + wid * 0.5, len - 0.6], [18, len], [18 - wid * 0.5, len - 0.6]]
    : [[18 + wid * 0.6, len - 2.4], [18, len], [18 - wid * 0.6, len - 2.4]];
  const mid = shape === 'point' ? wid * 0.6 : wid + 1.2, my = (top + len) * 0.5 - 1;
  const pts = [[18 - wid - 0.6, top], [18 + wid + 0.6, top], [18 + mid, my], ...tail, [18 - mid, my]];
  poly(c, pts, col);
  c.save(); c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts) c.lineTo(p[0], p[1]); c.closePath(); c.clip();
  c.fillStyle = lo + 'aa'; c.beginPath(); c.moveTo(19, top); c.lineTo(18 + wid + 2, top); c.lineTo(18 + mid + 2, len + 1); c.lineTo(20, len + 1); c.closePath(); c.fill();   // тень справа
  c.lineWidth = 0.32; const n = shape === 'point' ? 4 : 7;
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n - 0.5, x0 = 18 + t * wid * 1.6, x1 = 18 + t * (shape === 'point' ? 0.8 : wid * 1.3), bend = (k % 2 ? 1 : -1) * 0.7;
    c.strokeStyle = k % 2 ? lo : hi; c.beginPath(); c.moveTo(x0, top + 3.6); c.quadraticCurveTo(x0 + bend, (top + len) / 2 + 1, x1, len - 1.2 - (k % 3) * 0.8); c.stroke();
  }
  c.restore();
}
// усы поверх бороды + рот
function cfMouth(c, col, o = {}) {
  const y = o.y ?? 22, lo = shade(col, -0.35), hi = shade(col, 0.25), w = o.w ?? 3.6;
  if (!o.hide) { c.fillStyle = '#4a1a14'; c.fillRect(16.4, y + 0.1, 3.2, 0.9); c.fillStyle = '#c8706a'; c.fillRect(16.8, y + 1, 2.4, 0.4); }
  ellipse(c, 18 - w * 0.85, y - 0.1, w, 1.3, col); ellipse(c, 18 + w * 0.85, y - 0.1, w, 1.3, col);
  ellipse(c, 18 - w * 1.5, y + 0.9, 1.1, 0.8, col); ellipse(c, 18 + w * 1.5, y + 0.9, 1.1, 0.8, col);   // кончики книзу
  c.strokeStyle = hi; c.lineWidth = 0.3; c.beginPath(); c.moveTo(18 - w * 1.6, y - 0.6); c.quadraticCurveTo(18 - w, y - 1, 17.6, y - 0.4); c.stroke();
  c.strokeStyle = lo; c.beginPath(); c.moveTo(18 + w * 1.6, y + 0.2); c.quadraticCurveTo(18 + w, y + 0.6, 18.4, y + 0.2); c.stroke();
}
// гном целиком: тело, голова, борода, лицо, колпак; o — набор настроек (цвета профессии и черты характера)
function cfGnome(c, f, o) {
  const skin = o.skin || '#e8b890', skin2 = o.skin2 || '#c89470';
  cfShoulders(c, o.coat, shade(o.coat, -0.3), o.wide || 0);
  if (o.vest) cfVest(c, o.vest, o.rivets);
  if (o.under) poly(c, [[13, 26], [18, 30.4], [23, 26], [21, 25.4], [18, 27.6], [15, 25.4]], o.under);
  cfHead(c, 18, 18.6, 7.2, 6.4, skin, skin2);
  if (o.beard) cfBeard(c, o.beard, o.bd || {});
  if (o.cheeks) { ellipse(c, 12.6, 20.4, 1.6, 1, o.cheeks); ellipse(c, 23.4, 20.4, 1.6, 1, o.cheeks); }
  cfEyes(c, 14.8, 21.2, 17.4, f, o.look || 0, o.iris);
  cfNose(c, 18, 19.6, o.nose || 2.1, o.noseCol);
  if (o.must) cfMouth(c, o.must, o.mo || {});
  else { c.fillStyle = '#7a3a2a'; c.fillRect(16.4, 22.2, 3.2, 0.7); }
  cfBrows(c, 14.8, 21.2, o.browY || 15.2, o.brow, o.frown || 0, o.browW || 1);
  if (o.extra) o.extra(c, f);
  if (o.cap) cfCap(c, o.cap);
  if (o.over) o.over(c, f);
}

// Грум Ворчун: прораб — жёлтый колпак строителя, бордовая куртка, косматые седеющие брови домиком, борода лопатой
function cfGrum(c, f) {
  cfGnome(c, f, { coat: '#6e1c22', vest: '#8a6a44', skin: '#e0a880', skin2: '#c08060', beard: '#6a4024', bd: { len: 33, wid: 7.4 }, must: '#7a5434',
    brow: '#c8c0b4', frown: -0.8, browW: 1.5, nose: 2.4, look: 0, cap: { col: '#e0a822', style: 2, dir: 1, w: 8.6 },
    extra(c) { poly(c, [[14, 24], [15.6, 24], [16, 33], [14.6, 32]], '#9a8a7a'); },                          // седая прядь
    over(c, f) {                                                                                           // свеча в отвороте
      c.fillStyle = '#efe6cc'; c.fillRect(24, 9.6, 2.2, 3.4); c.fillStyle = '#6a4a1a'; c.fillRect(23.4, 12.6, 3.4, 1);
      ellipse(c, 25.1 + (f ? 0.3 : 0), 8.4 - (f ? 0.2 : 0), 0.9, 1.4, '#ffd870');
    } });
}
// Бабушка Ягла: хранительница песен — платок в цветочек с торчащим узелком-кончиком, круглые очки, румяные щёки
function cfYagla(c, f) {
  cfShoulders(c, '#7a3a5a', '#5a2a44');
  c.fillStyle = '#e8b4d4'; for (const [x, y] of [[8, 31], [14, 29.4], [22, 30], [28, 32], [18, 34]]) c.fillRect(x, y, 1.2, 1.2);
  const sc = () => { c.beginPath(); c.moveTo(8.4, 26.4); c.quadraticCurveTo(6.4, 11, 18, 6.4); c.quadraticCurveTo(29.6, 11, 27.6, 26.4); c.lineTo(23, 27.6); c.lineTo(13, 27.6); c.closePath(); };
  sc(); c.fillStyle = '#b04a6a'; c.fill();                                                                // платок сзади
  cfHead(c, 18, 18.6, 6.4, 6.6, '#e8bc9c', '#c89878');
  c.save(); sc(); c.clip();                                                                              // край платка надо лбом
  ellipse(c, 18, 11.4, 11, 4.4, '#b04a6a');
  c.fillStyle = '#8a3450'; c.beginPath(); c.moveTo(18, 6); c.quadraticCurveTo(28, 14, 27.6, 22); c.lineTo(31, 28); c.lineTo(31, 4); c.closePath(); c.fill();
  c.restore();
  poly(c, [[17, 7.4], [21.4, 1.6], [19.6, 8.2]], '#b04a6a'); poly(c, [[19.6, 8.2], [21.4, 1.6], [22, 2.4]], '#8a3450');   // кончик
  poly(c, [[11.2, 14.6], [18, 12], [24.8, 14.6], [23.6, 13.4], [18, 12.6], [12.4, 13.4]], '#6e1830');     // кромка над бровями
  c.fillStyle = '#e8b4d4'; for (const [x, y] of [[12, 8.6], [17, 6.6], [23, 9], [10, 16], [25.6, 17], [14, 11], [21, 11.4]]) c.fillRect(x, y, 1, 1);
  poly(c, [[15, 25.6], [21, 25.6], [22.6, 29], [18, 27.4], [13.4, 29]], '#b04a6a');                      // узел под подбородком
  ellipse(c, 13, 21, 1.8, 1.1, '#e89a9a'); ellipse(c, 23, 21, 1.8, 1.1, '#e89a9a');                      // румянец
  if (f) cfEyes(c, 15, 21, 17.8, 1);
  else { ellipse(c, 15, 17.8, 0.9, 1, '#2a1a10'); ellipse(c, 21, 17.8, 0.9, 1, '#2a1a10'); }
  cfBrows(c, 15, 21, 15.2, '#d8d4d0', 0, 0.8);
  c.strokeStyle = '#c8a050'; c.lineWidth = 0.5;                                                          // очки
  c.beginPath(); c.arc(15, 17.8, 2.4, 0, 7); c.stroke(); c.beginPath(); c.arc(21, 17.8, 2.4, 0, 7); c.stroke();
  c.beginPath(); c.moveTo(17.4, 17.6); c.lineTo(18.6, 17.6); c.stroke();
  cfNose(c, 18, 20.2, 1.7, '#d89a80');
  c.strokeStyle = '#8a3a3a'; c.lineWidth = 0.6; c.beginPath(); c.arc(18, 21.8, 2.4, 0.35, Math.PI - 0.35); c.stroke();   // улыбка
}
// Пим Чернилкин: летописец — зелёный колпак с пером, бородка клинышком, белый воротник, зелёное пятно чернил;
// глаза чуть в сторону, усмешка уголком
function cfPim(c, f) {
  cfGnome(c, f, { coat: '#3a5a4a', under: '#f2e8d0', skin: '#e8c0a0', skin2: '#c89c80', beard: '#7a5a3a', bd: { len: 29, wid: 3.6, shape: 'point', top: 21 },
    must: '#7a5a3a', mo: { w: 2.2, y: 21.8 }, brow: '#5a3a24', frown: 0.2, browW: 0.8, nose: 1.8, look: 0.6, iris: '#2a3a2a',
    cap: { col: '#2e5a22', style: 3, dir: -1, w: 7.8, band: '#e8d8a0' },
    extra(c) { c.fillStyle = '#3ac87a'; c.fillRect(12.4, 20.4, 1.2, 1.2); c.fillRect(30.8, 1.6, 1, 1); },
    over(c) { naLimb(c, 24, 13.6, 31, 3.4, 0.9, '#f2eee4'); naLimb(c, 26, 9.4, 30.6, 3.4, 1.8, '#e0dccc'); naLimb(c, 24, 13.6, 25.4, 10, 0.5, '#8a8a7a'); } });   // перо за лентой
}
// Тан Борода Старший: старейшина — высокий синий колпак с золотой лентой и рубином, белая борода до колен, мантия с золотом
function cfTan(c, f) {
  cfGnome(c, f, { coat: '#2a4a8a', wide: 1, skin: '#e8b890', skin2: '#c89470', beard: '#f2eee4', bd: { len: 36, wid: 7.4, top: 18 }, must: '#e8e4d8', mo: { w: 3.2 },
    brow: '#f8f6ee', frown: -0.2, browW: 1.4, nose: 2.2, iris: '#2a3a5a', cap: { col: '#2a4a8a', style: 1, tall: 13, dir: 1, w: 8.4, band: '#f0c848' },
    extra(c) { c.fillStyle = '#e8c050'; c.fillRect(3, 31, 8, 1.1); c.fillRect(25, 31, 8, 1.1); },
    over(c) { ellipse(c, 18, 11.8, 1.3, 1.3, '#e03a4a'); ellipse(c, 17.5, 11.3, 0.45, 0.45, '#ffb0b8'); } });   // рубин на ленте
}
// голова гоблина в три четверти (нос вправо)
function cfGob(c, f, skin, skin2, eye = '#ffe040') {
  poly(c, [[11, 16], [1, 9.6], [11.6, 20]], skin2); poly(c, [[24.6, 15], [34.6, 9], [25, 19.4]], skin2);  // уши
  poly(c, [[10, 16.4], [3.4, 11.6], [10.4, 19]], skin + 'aa'); poly(c, [[24.8, 16], [31.6, 11.4], [25, 18]], skin + '55');
  ellipse(c, 17.6, 18, 7.6, 7, skin);
  ellipse(c, 15, 19.4, 4, 5, skin2 + '66'); ellipse(c, 14.4, 15.6, 2.2, 1.4, shade(skin, 0.2) + '88');
  poly(c, [[20, 17], [29.4, 21.4], [20.4, 21.2]], skin);                                                   // нос
  poly(c, [[20.4, 20], [29.4, 21.4], [20.4, 21.2]], skin2);
  if (f) { c.fillStyle = '#1a2a0a'; c.fillRect(14, 16.4, 2.6, 0.6); c.fillRect(19.4, 16.4, 2.6, 0.6); }
  else {
    ellipse(c, 15.4, 16.4, 1.4, 1.2, eye); ellipse(c, 20.6, 16.4, 1.4, 1.2, eye);
    c.fillStyle = '#1a0f0a'; c.fillRect(15.6, 15.8, 0.8, 1.3); c.fillRect(20.8, 15.8, 0.8, 1.3);
    c.fillStyle = '#fff'; c.fillRect(15, 15.8, 0.4, 0.4); c.fillRect(20.2, 15.8, 0.4, 0.4);
  }
  poly(c, [[13, 14.4], [17, 15.2], [17, 14.2], [13.4, 13.4]], skin2); poly(c, [[18.6, 15.2], [23, 14], [22.8, 13.2], [18.6, 14.2]], skin2);
}
function cfGobMouth(c, grin) {
  c.fillStyle = '#4a1a1a'; c.fillRect(13.6, 22.6, grin ? 8 : 6, grin ? 1.8 : 1);
  c.fillStyle = '#f2eee0'; c.fillRect(14.6, 22.6, 0.9, 1.1); c.fillRect(19.6, 22.6, 0.9, 1.1); if (grin) { c.fillRect(17, 22.6, 0.9, 1.1); c.fillRect(15.6, 23.2, 0.7, 0.9); }
}
// Король Шнырь Пороховой: корона с самоцветами поверх латунных очков подрывника, горностай, серьга, ухмылка
function cfShnyr(c, f) {
  cfShoulders(c, '#5a2a7a', '#3e1a58', 1);
  poly(c, [[3, 32], [8, 27], [28, 27], [33, 32], [33, 34], [3, 34]], '#f2eee4');                          // горностай
  c.fillStyle = '#1a1414'; for (const x of [6, 11, 16, 21, 26, 30]) c.fillRect(x, 30.4, 1, 1.6);
  c.strokeStyle = '#f0c848'; c.lineWidth = 0.7; c.beginPath(); c.arc(18, 26, 6, 0.4, Math.PI - 0.4); c.stroke();
  cfGob(c, f, '#82b44c', '#5a8634');
  cfGobMouth(c, 1);
  ellipse(c, 15, 12.6, 2.1, 1.6, '#b08040'); ellipse(c, 20.6, 12.6, 2.1, 1.6, '#b08040');                // очки на лбу
  ellipse(c, 15, 12.6, 1.3, 0.9, '#9ad8e8'); ellipse(c, 20.6, 12.6, 1.3, 0.9, '#9ad8e8');
  poly(c, [[10.6, 11], [9.6, 3.4], [13, 7.4], [15.6, 2], [18, 7], [20.6, 2], [23, 7.4], [26, 3.6], [25.2, 11]], '#f0c848');   // корона
  poly(c, [[18, 7], [20.6, 2], [23, 7.4], [25.2, 11], [19, 11]], '#d8a82a');
  c.fillStyle = '#c89a28'; c.fillRect(10.6, 9.6, 14.6, 1.6);
  ellipse(c, 15.6, 6.8, 0.9, 0.9, '#e03a4a'); ellipse(c, 20.6, 6.8, 0.8, 0.8, '#3ac87a'); ellipse(c, 18, 9.8, 0.8, 0.8, '#5a8ae8');
  c.strokeStyle = '#f0c848'; c.lineWidth = 0.6; c.beginPath(); c.arc(5, 15, 1.3, 0, 7); c.stroke();        // серьга
}
// Гоблин Шныря: рваный капюшон из мешковины, щербатый оскал
function cfGoblin(c, f) {
  cfShoulders(c, '#6a5a4a', '#4a3e34');
  poly(c, [[7, 18], [10, 7], [18, 3.6], [26, 7], [29, 18], [27, 26], [9, 26]], '#7a6450');               // капюшон
  cfGob(c, f, '#7aa848', '#567e32');
  poly(c, [[9.6, 12], [12, 6.4], [18, 4.6], [24, 6.4], [26.4, 12], [22, 9.6], [14, 9.6]], '#7a6450');
  c.fillStyle = '#5a4a3a'; c.fillRect(12, 8, 1, 1); c.fillRect(23, 9, 1.2, 1); c.fillRect(17, 6, 1.4, 0.6);
  c.strokeStyle = '#5a4630'; c.lineWidth = 0.3; c.beginPath(); c.moveTo(13, 10); c.lineTo(15, 7); c.moveTo(21, 9); c.lineTo(23, 6.6); c.stroke();   // швы
  cfGobMouth(c, 0);
}
// Жмыха Кремнёвая: старейшина Кремнёвки — седой пучок со шпилькой, серо-синяя шаль с бахромой, большой нос, поджатые губы
function cfZhmykha(c, f) {
  cfShoulders(c, '#7a8aa6', '#5a6a86', 1);
  c.fillStyle = '#4a5a76'; for (const x of [4, 8, 12, 24, 28, 32]) c.fillRect(x - 1, 33.4, 1.4, 2.6);
  poly(c, [[12, 26], [18, 33], [24, 26], [22, 25.6], [18, 29.4], [14, 25.6]], '#9aaac6');
  ellipse(c, 18, 6.6, 3.8, 2.8, '#b8bcc6'); ellipse(c, 17, 5.8, 1.8, 1.1, '#e4e6ec');                       // пучок
  cfHead(c, 18, 18, 6.8, 6.8, '#e0b498', '#c09478');
  poly(c, [[10.8, 17], [11, 11], [15, 8.4], [21, 8.4], [25, 11], [25.2, 17], [23.4, 13.4], [18, 11.6], [12.6, 13.4]], '#c8ccd4');
  poly(c, [[18, 8.4], [21, 8.4], [25, 11], [25.2, 17], [23.4, 13.4], [19, 11.4]], '#a8acb6');
  naLimb(c, 13.6, 4.6, 22.6, 7.6, 0.6, '#6a4a2a');                                                        // шпилька
  cfEyes(c, 15.2, 20.8, 17.2, f, 0, '#3a4a5a');
  cfBrows(c, 15.2, 20.8, 14.8, '#a8acb4', 0.7, 0.8);
  cfNose(c, 18, 19.8, 1.9, '#cc9478');
  c.fillStyle = '#9a5a4a'; c.fillRect(16.4, 22.4, 3.2, 0.8);                                              // поджатые губы
  c.fillStyle = '#c09478'; c.fillRect(11.6, 19.6, 1.6, 0.4); c.fillRect(22.8, 19.6, 1.6, 0.4); c.fillRect(12.4, 20.4, 1.2, 0.4); c.fillRect(22.4, 20.4, 1.2, 0.4);   // морщины
}
// Кремень-младший: задира — серый колпак каменщика набекрень, рыжая раздвоенная борода, нахмуренные брови, сломанный нос, кремнёвый жилет
function cfKremen(c, f) {
  cfGnome(c, f, { coat: '#b07a5a', wide: 2, vest: '#6a7078', rivets: true, skin: '#e8b890', skin2: '#c89470', beard: '#c86a2a', bd: { len: 31, wid: 7, shape: 'fork' },
    must: '#d8782e', mo: { w: 3.2 }, brow: '#8a3a14', frown: 1.5, browW: 1.5, nose: 2, iris: '#3a2414',
    cap: { col: '#9a9aa6', style: 5, dir: -1, w: 8.4, band: '#6a6a78' },
    extra(c) { poly(c, [[16.4, 18], [19.6, 18.6], [20.2, 20.8], [17.4, 21.6], [16, 19.8]], '#d8906c'); c.fillStyle = '#f0e8d0'; c.fillRect(17.4, 18.6, 1.8, 0.6); c.fillRect(17.8, 19.2, 0.6, 1.2); },   // сломанный нос с пластырем
    over(c) { c.fillStyle = '#a0402a'; c.fillRect(12.4, 15.2, 2.6, 0.5); } });                              // шрам
}
// Малгор: капюшон, лица не видно — только зелёные глаза в темноте и борода-тень; «моргнул» — глаза тускнеют
function cfMalgor(c, f) {
  cfShoulders(c, '#2a2452', '#15112c', 1);
  c.fillStyle = '#6a5ab8'; c.fillRect(6, 28.4, 24, 1); c.fillStyle = '#3a8a30'; c.fillRect(17.4, 28, 1.6, 8);
  poly(c, [[6, 26], [8, 12], [13, 5], [18, 0.6], [23, 5], [28, 12], [30, 26]], '#1c1838');             // капюшон
  poly(c, [[18, 0.6], [23, 5], [28, 12], [30, 26], [22, 26], [24, 10]], '#120f28');
  poly(c, [[16, 3], [18, 0], [20, 3]], '#241c46');
  c.strokeStyle = '#3a3066'; c.lineWidth = 0.3; for (const [a, b] of [[10, 22], [13, 12], [24, 9], [27, 22]]) { c.beginPath(); c.moveTo(a, 8 + (b - 10) * 0.2); c.lineTo(a + (a < 18 ? -1 : 1), b + 3); c.stroke(); }
  ellipse(c, 18, 17, 6.4, 7.4, '#07050f');
  poly(c, [[13.4, 20], [22.6, 20], [21, 28], [18, 31], [15, 28]], '#3a3066');                              // борода-тень
  c.strokeStyle = '#4a4080'; c.lineWidth = 0.3; for (const x of [15.6, 18, 20.4]) { c.beginPath(); c.moveTo(x, 21); c.lineTo(x + (x - 18) * 0.3, 29.4); c.stroke(); }
  const eye = f ? '#4a8a30' : '#9cff66';
  c.fillStyle = eye; c.fillRect(13.6, 15.4, 3, 1.2); c.fillRect(19.4, 15.4, 3, 1.2);
  if (!f) { c.fillStyle = 'rgba(156,255,102,0.35)'; c.fillRect(12.6, 14.4, 5, 3.2); c.fillRect(18.4, 14.4, 5, 3.2); c.fillStyle = '#e8ffd0'; c.fillRect(14.4, 15.6, 1, 0.5); c.fillRect(20.2, 15.6, 1, 0.5); }
}
// Рассказчик: раскрытая летопись, чернильница с пером и свеча (кадр 1 — пламя качнулось)
function cfNote(c, f) {
  poly(c, [[2, 30], [18, 26], [34, 30], [34, 33], [18, 30], [2, 33]], '#5a3a20');                          // переплёт
  poly(c, [[3, 28], [17.6, 24.6], [18, 29], [3, 31]], '#f2e8d0'); poly(c, [[33, 28], [18.4, 24.6], [18, 29], [33, 31]], '#e8dcc0');
  c.fillStyle = '#8a7a60'; for (let k = 0; k < 4; k++) { c.fillRect(5.6, 28.6 - k * 0.9, 8.4, 0.35); c.fillRect(21, 27.6 - k * 1, 9, 0.35); }
  ellipse(c, 8, 22, 3.4, 3, '#2a2a34'); ellipse(c, 7, 21, 1.2, 1, '#4a4a5c'); c.fillStyle = '#3a3a48'; c.fillRect(6, 18.6, 4, 1.6);   // чернильница
  naLimb(c, 8.4, 19, 14, 4, 1, '#f2eee4'); naLimb(c, 10.6, 13, 13.6, 5, 2, '#e0dccc'); naLimb(c, 8.4, 19, 10.4, 14, 0.5, '#8a8a7a');   // перо
  c.fillStyle = '#e8e0c8'; c.fillRect(26, 13, 3.6, 10); c.fillStyle = '#c8bea0'; c.fillRect(28.6, 13, 1, 10);
  c.fillStyle = '#6a4a2a'; c.fillRect(24.6, 22.6, 6.4, 1.6);                                              // свеча
  ellipse(c, 27.8 + (f ? 0.7 : 0), 10.4, 1.2, 2.2, '#ffd870'); ellipse(c, 27.8 + (f ? 0.5 : 0), 11.2, 0.6, 1, '#fff6c8');
}
// Герой: гном в золотом колпаке и алой куртке, как в игре; застёжка-звезда
function cfHero(c, f) {
  cfGnome(c, f, { coat: '#8a1c22', vest: '#c8a030', skin: '#e8bc98', skin2: '#c89878', beard: '#8a5a2a', bd: { len: 31, wid: 6.6 }, must: '#9a6a32',
    brow: '#6a3a1a', frown: 0.3, browW: 1, nose: 2, iris: '#2a3a5a', cap: { col: '#d4a018', style: 0, dir: 1, w: 8.4, band: '#8a1c22' },
    over(c) { poly(c, [[18, 29.6], [18.8, 31.2], [20.6, 31.4], [19.2, 32.4], [19.6, 34], [18, 33], [16.4, 34], [16.8, 32.4], [15.4, 31.4], [17.2, 31.2]], '#f6dc5c'); } });
}
// Героиня: тот же золотой колпак, из-под него — две рыжие косы, без бороды
function cfHeroF(c, f) {
  cfShoulders(c, '#8a1c22', '#6a1018'); cfVest(c, '#c8a030');
  naLimb(c, 10.6, 17, 9.4, 30, 3.2, '#c86a2a'); naLimb(c, 25.4, 17, 26.6, 30, 3.2, '#c86a2a');
  naLimb(c, 10.6, 17, 9.4, 30, 1, '#e08a3a'); naLimb(c, 25.4, 17, 26.6, 30, 1, '#a04a1a');
  c.fillStyle = '#e8c050'; c.fillRect(8, 29.6, 2.8, 1.5); c.fillRect(25.2, 29.6, 2.8, 1.5);
  cfHead(c, 18, 18.6, 6.6, 6.4, '#ecc4a4', '#cca080');
  poly(c, [[11.4, 17.4], [12, 13.6], [18, 12.4], [24, 13.6], [24.6, 17.4], [22, 14.8], [18, 15.4], [14, 14.8]], '#c86a2a');   // чёлка
  ellipse(c, 13, 20.6, 1.5, 0.9, '#ec9a9a'); ellipse(c, 23, 20.6, 1.5, 0.9, '#ec9a9a');
  c.fillStyle = '#c8704a'; for (const [x, y] of [[14.4, 19.6], [16, 19.9], [20, 19.9], [21.6, 19.6]]) c.fillRect(x, y, 0.5, 0.5);   // веснушки
  cfEyes(c, 14.8, 21.2, 17.6, f, 0, '#2a4a3a');
  cfBrows(c, 14.8, 21.2, 15.4, '#a04a1a', 0, 0.7);
  cfNose(c, 18, 19.8, 1.6, '#dca080');
  c.strokeStyle = '#8a3a3a'; c.lineWidth = 0.6; c.beginPath(); c.arc(18, 21.4, 1.8, 0.4, Math.PI - 0.4); c.stroke();
  cfCap(c, { col: '#d4a018', style: 8, dir: 1, w: 8, band: '#8a1c22', by: 13.6 });
  poly(c, [[18, 29.8], [18.8, 31.4], [20.6, 31.6], [19.2, 32.6], [19.6, 34.2], [18, 33.2], [16.4, 34.2], [16.8, 32.6], [15.4, 31.6], [17.2, 31.4]], '#f6dc5c');
}
// Старец голема: древний гном-отшельник — мшистый колпак набекрень, белая борода с мхом, каменно-серая куртка,
// на шее руна-оберег (светится бирюзой; на втором кадре гаснет вместе с глазами)
function cfElder(c, f) {
  cfGnome(c, f, { coat: '#5a5a52', vest: '#7a7a6c', skin: '#d8c0a0', skin2: '#b09878', beard: '#e4e2d4', bd: { len: 35, wid: 7, top: 18 }, must: '#d8d6c8', mo: { w: 3.4 },
    brow: '#eceadc', frown: -0.3, browW: 1.1, browY: 14.8, nose: 2.3, iris: '#2a5a5a', cap: { col: '#5e7a52', style: 4, dir: -1, w: 8.6, moss: 29, band: '#8a7a5a' },
    extra(c) { c.fillStyle = '#6aa03e'; for (const [x, y] of [[12.4, 25], [14, 29], [22.6, 27], [21, 32], [16, 33.4]]) c.fillRect(x, y, 1.1, 0.9); c.fillStyle = '#4e8a2a'; for (const [x, y] of [[13, 27], [23, 30], [18, 31]]) c.fillRect(x, y, 0.8, 0.8); },   // мох в бороде
    over(c, f) {
      c.strokeStyle = '#8a7a5a'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(13, 26.6); c.quadraticCurveTo(18, 31, 23, 26.6); c.stroke();
      const g = f ? '#2a6a68' : '#6ae8d8';                                                                 // руна-оберег
      poly(c, [[18, 29.4], [20.2, 31.6], [18, 34.4], [15.8, 31.6]], '#3a3a36'); poly(c, [[18, 30.2], [19.4, 31.6], [18, 33.4], [16.6, 31.6]], g);
      c.fillStyle = '#1a2a2a'; c.fillRect(17.8, 30.8, 0.5, 1.8); c.fillRect(17.2, 31.6, 1.6, 0.4);
      if (!f) ellipse(c, 18, 31.6, 3, 3, 'rgba(106,232,216,0.22)');
    } });
}

const CAMP_FACE_DRAW = { grum: cfGrum, yagla: cfYagla, pim: cfPim, tan: cfTan, shnyr: cfShnyr, gob: cfGoblin, zhmykha: cfZhmykha, kremen: cfKremen, mrak: cfMalgor, note: cfNote, hero: cfHero, heroF: cfHeroF, elder: cfElder };

// data-URL кадра портрета (f: 0 — обычный, 1 — моргнул); '' — портрета нет или рисовать негде (сервер, тесты)
function campFaceUrl(who, f) {
  const key = who + f;
  if (CAMP_FACE[key] !== undefined) return CAMP_FACE[key];
  const D = CAMP_FACE_DRAW[who];
  if (!D || typeof document === 'undefined' || typeof toPixelArt !== 'function') return (CAMP_FACE[key] = '');
  try {
    const [cv, c] = mkSprite(36, 36, CF_SS);
    D(c, f);
    CAMP_FACE[key] = toPixelArt(cv, CF_SS / 2, { outline: true, outlineDark: 0.3, alphaCut: 100 }).toDataURL();
  } catch (e) { CAMP_FACE[key] = ''; }
  return CAMP_FACE[key];
}
