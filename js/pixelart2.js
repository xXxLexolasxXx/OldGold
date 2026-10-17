'use strict';
// Ручной пиксель-арт, часть 2: большой костёр, дом лесоруба, пекарня, дубильня.
// Принципы (скилл pixel-art-sprites): рампы цвета со сдвигом оттенка (свет — тёплый жёлтый, тень — холодный
// лиловый), свет сверху-слева, жёсткие края без сглаживания, контур снизу-справа, читаемый силуэт.
// Рисуем кистями из пикселей: заливка эллипса/многоугольника/линии функцией цвета.

const PX2 = {
  stone:  ['#d8cfbc', '#b8ae9a', '#968c7c', '#756c62', '#544e4c', '#3a3640'],
  wood:   ['#e0a468', '#bc7a44', '#94562e', '#6e3a26', '#4c2a26', '#2e1a20'],
  roof:   ['#b0784a', '#8e5a38', '#6e4230', '#523226', '#3a2622', '#26181c'],
  clay:   ['#f0b888', '#d8905c', '#b46c42', '#8c4a32', '#643428', '#42242a'],
  grass:  ['#c8e66c', '#98c84a', '#6aa23a', '#487c32', '#305a2c', '#1e3a28'],
  hide:   ['#d8a86c', '#b8844c', '#946236', '#6e4428', '#4a2c20', '#30201e'],
  cream:  ['#fff8e4', '#ecdfc0', '#cdbd9a', '#a89878', '#7e7058', '#544a40'],
  iron:   ['#8a8a96', '#686874', '#4a4a56', '#32323c', '#22222a', '#16161c'],
  ink: '#24120a', rim: '#6a4a38',
};

function px2hash(x, y, s) { const n = Math.sin(x * 127.1 + y * 311.7 + (s || 0) * 74.7) * 43758.5453; return n - Math.floor(n); }

function px2Ell(G, cx, cy, rx, ry, fn) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
    if (dx * dx + dy * dy <= 1) { const c = fn(x, y, dx, dy); if (c) G.set(x, y, c); }
  }
}
function px2Poly(G, pts, fn) {
  let y0 = 1e9, y1 = -1e9; for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    const xs = [], yy = y + 0.5;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if ((a[1] <= yy && b[1] > yy) || (b[1] <= yy && a[1] > yy)) xs.push(a[0] + (yy - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) { const c = fn(x, y); if (c) G.set(x, y, c); }
  }
}
function px2Rect(G, x0, y0, x1, y1, fn) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const c = fn(x, y); if (c) G.set(x, y, c); } }
// толстая линия: fn получает смещение от оси (−1 … 1; минус — «светлая» сторона слева-сверху)
function px2Line(G, x0, y0, x1, y1, w, fn) {
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy, h = w / 2;
  for (let y = Math.floor(Math.min(y0, y1) - h); y <= Math.ceil(Math.max(y0, y1) + h); y++) for (let x = Math.floor(Math.min(x0, x1) - h); x <= Math.ceil(Math.max(x0, x1) + h); x++) {
    const t = Math.max(0, Math.min(1, ((x + 0.5 - x0) * dx + (y + 0.5 - y0) * dy) / L2));
    const qx = x0 + dx * t, qy = y0 + dy * t, d = Math.hypot(x + 0.5 - qx, y + 0.5 - qy);
    if (d > h) continue;
    const side = ((x + 0.5 - qx) * dy - (y + 0.5 - qy) * dx) / Math.sqrt(L2) / h;
    const c = fn(x, y, side, t); if (c) G.set(x, y, c);
  }
}
function px2Out(G, dark, rim) { selOutline(G, dark || PX2.ink, rim || PX2.rim); }
function px2Canvas(G) {
  const cv = mkCanvas(G.W, G.H), c = cv.getContext('2d');
  for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) { const col = G.g[y][x]; if (col) { c.fillStyle = col; c.fillRect(x, y, 1, 1); } }
  return cv;
}
const px2Cyl = (t, n) => (t < 0.12 ? 0 : t < 0.32 ? 1 : t < 0.58 ? 2 : t < 0.8 ? 3 : t < 0.93 ? 4 : 5);

// Валун/камень из рампы: свет сверху-слева, нижний край темнее
function px2Rock(G, cx, cy, rx, ry, seed, ramp) {
  ramp = ramp || PX2.stone;
  px2Ell(G, cx, cy, rx, ry, (x, y, dx, dy) => {
    const l = (dx * -0.55 + dy * -0.75) * 0.5 + 0.5 + (px2hash(x, y, seed) - 0.5) * 0.18;
    return ramp[Math.max(0, Math.min(4, Math.floor((1 - l) * 4.2)))];
  });
}
// Кладка: ряды камней со сдвигом, раствор тёмным; свет слева
function px2Bricks(G, x0, y0, x1, y1, ramp, rh, bw, seed, shadeFn) {
  px2Rect(G, x0, y0, x1, y1, (x, y) => {
    const row = Math.floor((y - y0) / rh), off = row % 2 ? Math.floor(bw / 2) : 0, bx = Math.floor((x - x0 + off) / bw);
    const seamH = (y - y0) % rh === rh - 1, seamV = (x - x0 + off) % bw === bw - 1;
    const base = shadeFn ? shadeFn(x, y) : 2;
    if (seamH || seamV) return ramp[Math.min(5, base + 2)];
    const j = Math.floor(px2hash(bx, row, seed) * 3) - 1;
    return ramp[Math.max(0, Math.min(5, base + j + ((y - y0) % rh === 0 ? -1 : 0)))];
  });
}

// ---------- Большой костёр ----------
const BF_W = 104, BF_H = 98, BF_AX = 52, BF_AY = 60;   // якорь — центр каменного вала
const BF_FIRE = [BF_AX, 46];                               // откуда растёт пламя (в координатах картинки)

function bonfireArt() {
  if (bonfireArt.cv) return bonfireArt.cv;
  const S = PX2.stone, W = PX2.wood, G = pxGrid(BF_W, BF_H), cx = BF_AX, cy = BF_AY;
  // выжженная земля: тёмное пятно с зольными крапинками
  px2Ell(G, cx, cy + 1, 46, 26, (x, y, dx, dy) => {
    const r = dx * dx + dy * dy, h = px2hash(x, y, 3);
    if (r > 0.82 && h < (r - 0.8) * 5) return null;
    return h < 0.1 ? '#5a504a' : h < 0.22 ? '#443c3a' : r > 0.7 ? '#2e2828' : '#38302e';
  });
  const stones = (back) => {
    const N = 24;
    for (let k = 0; k < N; k++) {
      const a = k / N * Math.PI * 2 + 0.07, sy = Math.sin(a);
      if ((sy < 0) !== back) continue;
      const x = cx + Math.cos(a) * 37, y = cy + sy * 20, r = 4.4 + px2hash(k, 1) * 1.4;
      px2Rock(G, x, y, r, r * 0.74, k);
      if (!back || k % 2) px2Rock(G, x + (px2hash(k, 4) - 0.5) * 4, y - 4, r * 0.8, r * 0.6, k + 9);   // второй ярус
    }
  };
  stones(true);
  // жаровня внутри вала: угли
  px2Ell(G, cx, cy - 2, 31, 14, (x, y, dx, dy) => {
    const r = dx * dx + dy * dy, h = px2hash(x, y, 8);
    if (r > 0.8) return '#241818';
    return h < 0.14 ? '#e0701c' : h < 0.3 ? '#a83a14' : h < 0.55 ? '#5a2018' : '#321814';
  });
  // шалаш из брёвен: каждое — наклонная толстая линия с корой, торец светлый
  const apex = [cx, 22], logs = [];
  for (let k = 0; k < 11; k++) {
    const a = k / 11 * Math.PI * 2, bx = cx + Math.cos(a) * 24, by = cy - 3 + Math.sin(a) * 9.5;
    logs.push({ bx, by, ax: apex[0] + Math.cos(a) * 2.2, ay: apex[1] + 4 + (k % 3) * 2, k });
  }
  logs.sort((p, q) => p.by - q.by);
  for (const L of logs) {
    px2Line(G, L.bx, L.by, L.ax, L.ay, 4.4, (x, y, side, t) => {
      const n = px2hash(x, y, L.k);
      let i = side < -0.55 ? 0 : side < -0.1 ? 1 : side < 0.4 ? 2 : side < 0.75 ? 3 : 4;
      if (n < 0.18) i = Math.min(5, i + 1);           // кора в трещинках
      if (t > 0.7 && side < 0.2) i = Math.max(0, i - 1);
      return W[i];
    });
    // торец у основания: светлое дерево с кольцом
    px2Ell(G, L.bx, L.by, 2.4, 1.9, (x, y, dx, dy) => (dx * dx + dy * dy > 0.45 ? W[2] : (x + y) % 2 ? '#f0c888' : '#d89a5c'));
  }
  // хворост и мусор вокруг основания
  for (let k = 0; k < 16; k++) {
    const a = k * 2.4, x = Math.round(cx + Math.cos(a) * (14 + (k % 5) * 3)), y = Math.round(cy + 5 + Math.sin(a) * 7);
    G.set(x, y, k % 3 ? W[3] : '#cfc4a8'); G.set(x + 1, y, k % 2 ? W[4] : '#8a7a5a');
  }
  stones(false);
  // скамьи-брёвна у огня: цилиндр по горизонтали, торцы с кольцами
  for (const [bx, by, w] of [[10, 80, 32], [64, 84, 28]]) {
    px2Rect(G, bx, by, bx + w, by + 5, (x, y) => {
      const t = (y - by) / 5, i = t < 0.2 ? 0 : t < 0.5 ? 1 : t < 0.78 ? 2 : 3;
      return W[(x * 7 + y) % 11 === 0 ? Math.min(5, i + 1) : i];
    });
    for (const ex of [bx, bx + w]) px2Ell(G, ex, by + 2.6, 2.2, 3, (x, y, dx, dy) => (dx * dx + dy * dy > 0.5 ? W[2] : (y % 2 ? '#f0c888' : '#d89a5c')));
  }
  // котёл на треноге
  const kx = 88, ky = 50;
  for (const dx of [-8, 0, 8]) px2Line(G, kx + dx * 0.9, ky + 8, kx + dx * 0.25, ky - 10, 1.6, (x, y, s) => (s < 0 ? W[2] : W[4]));
  px2Ell(G, kx, ky - 3, 8, 7, (x, y, dx, dy) => PX2.iron[Math.max(0, Math.min(4, Math.floor((dx * 0.7 + dy * 0.4 + 1) * 2.1)))]);
  px2Ell(G, kx, ky - 8, 7, 2.6, (x, y, dx, dy) => (dx * dx + dy * dy > 0.7 ? PX2.iron[5] : (x + y) % 3 ? '#5e7a2c' : '#8aa83c'));
  // куча мусора слева у вала: кость, мешок, горшок
  px2Ell(G, 14, 62, 7, 3.4, (x, y, dx, dy) => (px2hash(x, y, 5) < 0.4 ? '#6a5a44' : px2hash(x, y, 6) < 0.5 ? '#8a7a5c' : '#4a3e30'));
  G.set(12, 59, '#e8dcc0'); G.set(13, 59, '#e8dcc0'); G.set(16, 60, '#b04a30'); G.set(17, 60, '#b04a30'); G.set(15, 58, '#6a8a3a');
  px2Out(G, PX2.ink, '#5a4838');
  bonfireArt.cv = px2Canvas(G);
  bonfireArt.perches = [[cx, 22], [cx - 24, 40], [cx + 24, 40]];
  return bonfireArt.cv;
}

// ---------- Дом лесоруба: пень ----------
const WC_W = 80, WC_H = 84, WC_AX = 40, WC_AY = 70;

function woodcutterArt() {
  if (woodcutterArt.cv) return woodcutterArt.cv;
  const G = pxGrid(WC_W, WC_H), Wd = PX2.wood, Gr = PX2.grass, cx = 40;
  // моховой холм
  px2Ell(G, cx, 70, 38, 10, (x, y, dx, dy) => {
    const t = (dy + 1) / 2, side = dx, h = px2hash(x, y, 2);
    let i = t < 0.22 ? 1 : t < 0.5 ? 2 : t < 0.78 ? 3 : 4;
    if (side < -0.45 && i < 3) i--; if (side > 0.55 && i < 4) i++;
    if (i === 1 && h < 0.2) i = 0;
    return Gr[Math.max(0, Math.min(5, i))];
  });
  // ствол: бочка, расширяется к корням; кора — вертикальные полосы-борозды
  const halfAt = y => 22 + (y > 52 ? (y - 52) * 0.9 : 0) - (y < 30 ? (30 - y) * 0.15 : 0);
  const topY = x => 18 + Math.round(Math.sin((x - 18) * 0.5) * 2 + (x > 52 ? -(x - 52) * 0.35 : 0));
  for (let y = 10; y <= 68; y++) {
    const hw = halfAt(y);
    for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
      if (y < topY(x)) continue;
      const t = (x - (cx - hw)) / (2 * hw), n = px2hash(Math.floor(x / 2), Math.floor(y / 7), 3);
      let i = px2Cyl(t); const groove = (x * 5 + Math.floor(y / 9) * 3) % 7 === 0;
      if (groove) i = Math.min(5, i + 2); else if (n < 0.22) i = Math.min(5, i + 1); else if (n > 0.86) i = Math.max(0, i - 1);
      G.set(x, y, Wd[i]);
    }
  }
  // корни
  for (const [x0, dir, y0] of [[cx - 22, -1, 64], [cx + 22, 1, 64], [cx - 12, -1, 69], [cx + 11, 1, 69]]) {
    px2Line(G, x0, y0, x0 + dir * 11, y0 + 6, 4, (x, y, s) => Wd[s < -0.2 ? 2 : 4]);
  }
  // срез сверху: светлая древесина с кольцами, неровный зубчатый край
  const ex = cx - 2, ey = 21;
  px2Ell(G, ex, ey, 22, 5.2, (x, y, dx, dy) => {
    const r = Math.sqrt(dx * dx + dy * dy);
    if (r > 0.82) return '#c88a50';
    const ring = Math.floor(r * 7.2);
    return ring % 2 ? '#e8b878' : '#f4d49c';
  });
  for (let x = ex - 22; x <= ex + 22; x += 4) G.set(x, ey - 5 + (x % 3), '#d89a5c');
  // мох шапкой по кромке среза и в трещинах
  for (let x = cx - 24; x <= cx + 24; x++) {
    const y = topY(x), h = px2hash(x, 1, 4);
    if (G.get(x, y)) { G.set(x, y, h < 0.5 ? Gr[0] : Gr[1]); if (h < 0.55) G.set(x, y + 1, Gr[2]); if (h < 0.25) G.set(x, y + 2, Gr[3]); }
  }
  // мох у подножия
  for (let x = cx - 26; x <= cx + 28; x++) {
    const h = 2 + Math.floor(px2hash(x, 9, 6) * 6);
    for (let k = 0; k < h; k++) { const y = 66 - k; if (G.get(x, y)) G.set(x, y, k === h - 1 ? Gr[0] : k > h - 3 ? Gr[1] : Gr[3]); }
  }
  // труба-ветка: сучок на срезе, из него дым (позицию даёт chimneys)
  px2Rect(G, ex + 8, 10, ex + 12, 20, (x, y) => (x - ex - 8 < 2 ? Wd[2] : Wd[4]));
  px2Rect(G, ex + 7, 9, ex + 13, 10, () => '#d89a5c');
  // арочная дверь
  const dX = cx + 4, dY = 58;
  px2Poly(G, [[dX - 6, dY - 2], [dX - 5, dY - 9], [dX - 2, dY - 12], [dX + 2, dY - 12], [dX + 5, dY - 9], [dX + 6, dY - 2], [dX + 6, dY + 8], [dX - 6, dY + 8]], (x, y) => (x < dX - 3 ? '#cc945a' : (x + y) % 5 === 0 ? '#5a3018' : '#a8703c'));
  px2Rect(G, dX - 6, dY + 1, dX + 6, dY + 1, () => '#5a3018'); px2Rect(G, dX - 6, dY + 5, dX + 6, dY + 5, () => '#5a3018');
  G.set(dX + 3, dY + 2, '#f4c848'); G.set(dX + 3, dY + 3, '#c89226');
  px2Rect(G, dX - 7, dY + 9, dX + 7, dY + 9, () => '#9a9086');     // порог-камень
  // окошко
  const wX = cx - 14, wY = 44;
  px2Rect(G, wX - 3, wY - 3, wX + 3, wY + 3, (x, y) => (Math.abs(x - wX) === 3 || Math.abs(y - wY) === 3 ? '#24120a' : x === wX || y === wY ? '#5a3018' : (x < wX && y < wY ? '#a6f0ff' : '#ffd878')));
  px2Rect(G, wX - 4, wY + 4, wX + 4, wY + 4, () => '#8a4a2c');
  for (let k = 0; k < 3; k++) { G.set(wX - 3 + k * 3, wY + 3, k % 2 ? '#d83a22' : '#f4c848'); }   // цветочки на подоконнике
  // трутовики-этажерки
  for (const [x, y, w] of [[cx - 4, 34, 8], [cx - 2, 38, 6], [cx + 12, 40, 7]]) {
    px2Rect(G, x, y, x + w, y, () => '#fbe0bc'); px2Rect(G, x, y + 1, x + w, y + 1, () => '#e8b48c'); px2Rect(G, x + 1, y + 2, x + w, y + 2, () => '#a8704a');
  }
  // мухоморы и камушки
  const shroom = (x, y, s) => { px2Ell(G, x, y, s, s * 0.7, (X, Y) => ((X * 3 + Y) % 5 === 0 ? '#fff2de' : '#d83a22')); px2Rect(G, x - 1, y + 1, x, y + 3, () => '#f2e2c8'); };
  shroom(7, 66, 4); shroom(13, 72, 2.4); shroom(68, 68, 3);
  px2Rock(G, 58, 74, 3.4, 2.2, 1); px2Rock(G, 24, 77, 3, 2, 2);
  // топор в колоде у входа
  px2Rect(G, cx + 15, 62, cx + 22, 68, (x, y) => (y < 63 ? Wd[0] : Wd[2 + (x > cx + 19 ? 1 : 0)]));
  px2Line(G, cx + 17, 62, cx + 16, 50, 1.6, (x, y, s) => Wd[s < 0 ? 1 : 3]);
  px2Poly(G, [[cx + 12, 50], [cx + 18, 50], [cx + 19, 56], [cx + 13, 55]], (x, y) => (x < cx + 15 ? PX2.iron[0] : PX2.iron[2]));
  px2Out(G, PX2.ink, '#5a2a1c');
  woodcutterArt.cv = px2Canvas(G);
  woodcutterArt.perches = [[cx - 6, 17], [cx + 12, 19]];
  return woodcutterArt.cv;
}
