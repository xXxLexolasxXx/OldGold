'use strict';
// Ручной пиксель-арт, часть 3: пекарня (кисти и палитры — в pixelart2.js).

// ---------- Пекарня: каменный дом в скале, печь-купол сбоку ----------
const BK_W = 100, BK_H = 84, BK_AX = 48, BK_AY = 76, BK_OVEN = [82, 73];

function bakeryArt() {
  if (bakeryArt.cv) return bakeryArt.cv;
  const S = PX2.stone, R = PX2.roof, C = PX2.clay, G = pxGrid(BK_W, BK_H);
  // валуны за домом
  px2Rock(G, 14, 52, 11, 9, 1); px2Rock(G, 84, 38, 11, 9, 2); px2Rock(G, 8, 62, 7, 6, 3);
  // восточная стена в тени
  px2Bricks(G, 64, 46, 73, 76, S, 4, 5, 3, () => 4);
  // фасад: свет сверху, чуть темнее у земли
  px2Bricks(G, 24, 44, 64, 76, S, 4, 6, 5, (x, y) => (y < 50 ? 1 : y > 70 ? 3 : 2) + (x > 56 ? 1 : 0));
  for (let k = 0; k < 8; k++) px2Rock(G, 27 + k * 5, 75, 3.4, 2.4, 20 + k, S);   // цоколь из валунов
  // крыша: тёс по рядам, мох пятнами
  const roofC = (x, y, top, base, bw) => {
    const row = Math.floor((y - top) / 3), off = row % 2 ? 2 : 0, seam = (x + off) % bw === 0, lowEdge = (y - top) % 3 === 2;
    return R[Math.min(5, base + (lowEdge ? 1 : 0) + (seam ? 1 : 0) + (px2hash(Math.floor((x + off) / bw), row, 9) > 0.8 ? 1 : 0))];
  };
  px2Poly(G, [[18, 44], [70, 44], [60, 16], [28, 16]], (x, y) => roofC(x, y, 16, x < 34 ? 1 : x < 52 ? 2 : 3, 4));
  px2Poly(G, [[70, 44], [79, 49], [66, 19], [60, 16]], (x, y) => roofC(x, y, 16, 4, 4));
  for (const [mx, my, r] of [[30, 38, 5], [52, 30, 4], [42, 24, 3], [64, 40, 3], [24, 42, 3]]) px2Ell(G, mx, my, r, r * 0.55, (x, y, dx, dy) => (px2hash(x, y, 7) < 0.55 ? PX2.grass[dy < 0 ? 1 : 2] : PX2.grass[3]));
  px2Rect(G, 18, 44, 70, 44, () => R[5]);                       // свес
  px2Rect(G, 24, 45, 64, 47, (x, y) => S[y === 45 ? 5 : 4]);    // тень под свесом
  px2Rect(G, 29, 15, 59, 15, () => R[0]);                       // конёк
  // труба
  px2Bricks(G, 50, 3, 57, 24, S, 3, 4, 8, (x) => (x < 53 ? 1 : 3));
  px2Rect(G, 49, 1, 58, 3, (x, y) => (y === 1 ? S[1] : S[4])); px2Rect(G, 51, 1, 56, 1, () => '#14100e');
  // круглая дверь в каменной арке
  const dx = 44, dy = 66, Rr = 8;
  px2Ell(G, dx, dy, Rr + 3, Rr + 3, (x, y, a) => ((x + y) % 3 === 0 ? S[3] : S[a < 0 ? 0 : 2]));
  px2Poly(G, [[dx - Rr - 3, dy], [dx + Rr + 3, dy], [dx + Rr + 3, 77], [dx - Rr - 3, 77]], (x, y) => ((x + y) % 3 === 0 ? S[3] : S[x < dx ? 1 : 2]));
  px2Ell(G, dx, dy, Rr, Rr, (x, y) => PX2.wood[x < dx - 3 ? 1 : (x * 3 + y) % 7 === 0 ? 4 : x > dx + 3 ? 3 : 2]);
  px2Rect(G, dx - Rr, dy, dx + Rr - 1, 76, (x, y) => PX2.wood[x < dx - 3 ? 1 : (x - dx) % 4 === 0 ? 4 : x > dx + 3 ? 3 : 2]);
  for (const by of [dy - 3, dy + 5]) px2Rect(G, dx - Rr, by, dx + Rr - 1, by + 1, (x) => (x % 5 === 0 ? '#8a8a96' : PX2.iron[3]));
  G.set(dx + 4, dy + 1, '#f4c848'); G.set(dx + 4, dy + 2, '#c89226'); G.set(dx + 5, dy + 2, '#c89226');
  // круглое окно с тёплым светом и полка с караваями
  px2Ell(G, 31, 56, 6, 6, (x, y, a) => S[(x + y) % 3 === 0 ? 4 : a < 0 ? 0 : 3]);
  px2Ell(G, 31, 56, 4, 4, (x, y, a, b) => (x === 31 || y === 56 ? PX2.wood[4] : a * a + b * b > 0.5 ? '#f0b048' : '#ffe898'));
  px2Rect(G, 25, 63, 38, 64, (x, y) => PX2.wood[y === 63 ? 1 : 3]);
  for (let k = 0; k < 3; k++) px2Ell(G, 28 + k * 4, 62, 2.2, 1.7, (x, y, a, b) => (b < -0.2 ? C[0] : a < 0 ? C[1] : C[2]));
  // печь-купол: кольца кирпичей, в жерле угли
  const ox = BK_OVEN[0], oy = BK_OVEN[1];
  px2Ell(G, ox, oy, 13, 15, (x, y, a, b) => {
    if (y > oy) return null;
    const l = (a * -0.6 + b * -0.55) * 0.5 + 0.5, ring = Math.floor((1 - Math.sqrt(a * a + b * b)) * 5.5);
    let i = Math.max(0, Math.min(4, Math.floor((1 - l) * 4.4)));
    if ((y + (ring % 2 ? 2 : 0) + (x + ring * 3) % 5 === 0) || (y % 3 === 0 && ring % 2 === 0)) i = Math.min(5, i + 1);
    return C[i];
  });
  px2Ell(G, ox - 1, oy, 5.4, 7, (x, y, a, b) => {
    if (y > oy) return null;
    const h = px2hash(x, y, 12), r = a * a + b * b;
    return r < 0.35 && h < 0.4 ? '#ffb02e' : r < 0.6 && h < 0.34 ? '#d8421a' : h < 0.2 ? '#7a2a1c' : '#1a0a08';
  });
  px2Bricks(G, ox + 3, 52, ox + 9, 62, ['#e8b898', '#c8644a', '#9a4e34', '#7a3a2a', '#5a2a22', '#3a1c1c'], 3, 3, 15, (x) => (x < ox + 6 ? 1 : 3));
  px2Rect(G, ox + 2, 51, ox + 10, 52, (x, y) => (y === 51 ? S[3] : S[5]));
  // мешки муки, лопата, дровница
  const sack = (x, y) => px2Ell(G, x, y, 5, 5.4, (X, Y, a, b) => PX2.cream[b < -0.5 && Math.abs(a) < 0.5 ? 0 : a < -0.2 ? 1 : a > 0.4 ? 3 : 2]);
  sack(10, 72); sack(17, 75); px2Rect(G, 7, 66, 12, 67, () => PX2.cream[1]);
  px2Line(G, 69, 75, 73, 52, 1.8, (x, y, s) => PX2.wood[s < 0 ? 1 : 3]); px2Ell(G, 68.5, 77, 3, 1.8, () => PX2.wood[2]);
  for (let k = 0; k < 4; k++) px2Ell(G, 90 + (k % 2) * 4, 78 - Math.floor(k / 2) * 3, 2.4, 2, (x, y, a, b) => (a * a + b * b > 0.45 ? PX2.wood[2] : '#e8b878'));
  px2Out(G, PX2.ink, '#5a4a40');
  bakeryArt.cv = px2Canvas(G);
  bakeryArt.perches = [[44, 15], [30, 17]];
  return bakeryArt.cv;
}

// ---------- Дубильня: тёплый фахверковый дом, сушилка со шкурами, чаны с дубильным настоем ----------
const TN_W = 124, TN_H = 90, TN_AX = 62, TN_AY = 82;

function tanneryArt() {
  if (tanneryArt.cv) return tanneryArt.cv;
  const S = PX2.stone, C = PX2.cream, W = PX2.wood, R = PX2.roof, H = PX2.hide, Gr = PX2.grass, I = PX2.iron, CL = PX2.clay, G = pxGrid(TN_W, TN_H);
  const GY = 82;
  // трава у подножия
  px2Ell(G, 62, GY - 1, 58, 6, (x, y) => (px2hash(x, y, 2) < 0.5 ? null : Gr[px2hash(x, y, 3) < 0.5 ? 2 : 3]));
  // боковая стена (восток) в тени
  px2Rect(G, 84, 52, 90, GY, (x, y) => (y > 72 ? S[4] : C[4]));
  // фасад: тёплая штукатурка, цоколь из камня
  px2Rect(G, 40, 50, 83, GY, (x, y) => {
    if (y > 73) return S[Math.floor(px2hash(Math.floor((x + (y > 77 ? 3 : 0)) / 6), Math.floor(y / 4), 5) * 3) + (x > 70 ? 2 : 1)];
    return C[(y < 54 ? 1 : 2) + (x > 70 ? 1 : 0) + (px2hash(x, y, 6) > 0.9 ? 1 : 0)];
  });
  // фахверк: столбы, обвязка, раскосы
  const beam = (x0, y0, x1, y1) => px2Line(G, x0, y0, x1, y1, 2.2, (x, y, s) => W[s < 0 ? 2 : 4]);
  for (const x of [41, 62, 82]) px2Rect(G, x - 1, 50, x + 1, 73, (X) => W[X === x - 1 ? 1 : X === x ? 2 : 4]);
  px2Rect(G, 40, 62, 84, 63, (x, y) => W[y === 62 ? 2 : 4]);
  px2Rect(G, 40, 72, 84, 73, (x, y) => W[y === 72 ? 2 : 4]);
  beam(42, 62, 53, 52); beam(82, 62, 73, 52); beam(42, 72, 49, 65); beam(82, 72, 76, 65);
  // крыша: тёс по рядам, мох пятнами
  const roofC = (x, y, top, base) => {
    const row = Math.floor((y - top) / 3), off = row % 2 ? 2 : 0, seam = (x + off) % 5 === 0, low = (y - top) % 3 === 2;
    return R[Math.min(5, base + (low ? 1 : 0) + (seam ? 1 : 0) + (px2hash(Math.floor((x + off) / 5), row, 9) > 0.78 ? 1 : 0))];
  };
  px2Poly(G, [[33, 51], [91, 51], [80, 20], [44, 20]], (x, y) => roofC(x, y, 20, x < 52 ? 0 : x < 70 ? 1 : 2));
  px2Poly(G, [[91, 51], [99, 56], [86, 24], [80, 20]], (x, y) => roofC(x, y, 20, 4));
  for (const [mx, my, r] of [[40, 46, 4], [58, 38, 3], [70, 28, 3], [50, 28, 2], [86, 48, 3]]) px2Ell(G, mx, my, r, r * 0.5, (x, y, dx, dy) => (px2hash(x, y, 7) < 0.55 ? Gr[dy < 0 ? 1 : 2] : Gr[3]));
  px2Rect(G, 33, 51, 91, 51, () => R[5]);
  px2Rect(G, 36, 52, 88, 54, (x, y) => (y === 52 ? C[5] : C[4]));
  px2Rect(G, 43, 19, 81, 19, () => R[0]);
  // кирпичная труба
  px2Bricks(G, 68, 6, 76, 30, CL, 3, 4, 8, (x) => (x < 71 ? 1 : 3));
  px2Rect(G, 67, 4, 77, 6, (x, y) => (y === 4 ? S[1] : S[4])); px2Rect(G, 69, 4, 75, 4, () => '#14100e');
  // слуховое окошко
  px2Ell(G, 56, 38, 5, 5, (x, y, dx, dy) => (dx * dx + dy * dy > 0.55 ? W[3] : (x === 56 || y === 38 ? W[4] : '#ffd878')));
  // дверь в каменной арке
  const dx = 62;
  px2Poly(G, [[dx - 7, 82], [dx - 7, 62], [dx - 5, 58], [dx - 2, 56], [dx + 2, 56], [dx + 5, 58], [dx + 7, 62], [dx + 7, 82]], (x, y) => S[(x + y) % 3 === 0 ? 3 : x < dx ? 1 : 2]);
  px2Poly(G, [[dx - 5, 82], [dx - 5, 62], [dx - 3, 59], [dx + 3, 59], [dx + 5, 62], [dx + 5, 82]], (x, y) => W[(x - dx) % 3 === 0 ? 4 : x < dx - 2 ? 1 : x > dx + 2 ? 3 : 2]);
  for (const by of [64, 75]) px2Rect(G, dx - 5, by, dx + 5, by + 1, (x) => (x % 4 === 0 ? I[0] : I[3]));
  G.set(dx + 3, 71, '#f4c848'); G.set(dx + 3, 72, '#c89226');
  // окно со ставнями и цветами
  px2Rect(G, 69, 55, 77, 66, (x, y) => (x === 69 || x === 77 || y === 55 || y === 66 ? W[4] : x === 73 || y === 60 ? W[3] : (x < 73 && y < 60 ? '#a6f0ff' : '#ffd878')));
  px2Rect(G, 66, 55, 68, 66, (x) => (x === 66 ? '#b0503a' : '#8a3a2c')); px2Rect(G, 78, 55, 80, 66, (x) => (x === 80 ? '#6a2a22' : '#8a3a2c'));
  px2Rect(G, 68, 67, 78, 68, (x, y) => W[y === 67 ? 1 : 3]);
  G.set(70, 66, '#e86a9a'); G.set(73, 66, '#f4f0f6'); G.set(76, 66, '#e86a9a');
  // вывеска-шкура на кронштейне
  px2Rect(G, 43, 56, 53, 56, () => W[4]); px2Rect(G, 43, 56, 43, 59, () => W[4]);
  px2Poly(G, [[44, 58], [52, 58], [53, 63], [51, 68], [48, 70], [45, 68], [43, 63]], (x) => H[x < 47 ? 1 : x < 50 ? 2 : 3]);
  px2Ell(G, 48, 63, 2, 3, () => H[0]);
  // сушилка слева: столбы, перекладина, три шкуры
  const rx0 = 6, rx1 = 34, ry = 46;
  px2Rect(G, rx0, ry - 2, rx0 + 1, GY, (x) => W[x === rx0 ? 1 : 3]); px2Rect(G, rx1, ry - 2, rx1 + 1, GY, (x) => W[x === rx1 ? 1 : 3]);
  px2Rect(G, rx0 - 2, ry, rx1 + 3, ry + 1, (x, y) => W[y === ry ? 0 : 3]);
  px2Rect(G, rx0 + 1, 70, rx1, 71, (x, y) => W[y === 70 ? 2 : 4]);
  for (const [x, len, k] of [[9, 26, 0], [17, 32, 1], [25, 22, 2]]) {
    const ramp = k === 1 ? H : k === 2 ? C : CL;
    px2Poly(G, [[x, ry + 2], [x + 7, ry + 2], [x + 8, ry + len * 0.45], [x + 6, ry + len], [x + 4, ry + len - 3], [x + 2, ry + len], [x - 1, ry + len * 0.5]], (X, Y) => {
      const t = (X - x) / 8, n = px2hash(X, Y, k + 3);
      return ramp[Math.max(0, Math.min(5, (k === 1 ? 2 : 1) + (t < 0.3 ? 0 : t < 0.65 ? 1 : 2) + (n > 0.9 ? 1 : n < 0.08 ? -1 : 0) + (Y > ry + len - 5 ? 1 : 0)))];
    });
  }
  // чаны справа
  const vat = (x, y, w, liq, ht) => {
    px2Rect(G, x - w, y - ht, x + w, y, (X, Y) => { const t = (X - (x - w)) / (2 * w); return W[(Y - y) % 5 === 0 ? 4 : px2Cyl(t)]; });
    px2Rect(G, x - w, y - ht + 3, x + w, y - ht + 4, () => I[2]); px2Rect(G, x - w, y - 3, x + w, y - 2, () => I[2]);
    px2Ell(G, x, y - ht, w, 3, (X, Y, a, b) => (a * a + b * b > 0.72 ? W[0] : liq[(X + Y) % 5 === 0 ? 2 : (X * 3 + Y) % 7 === 0 ? 0 : 1]));
  };
  vat(102, 80, 8, ['#a0b44c', '#7a8a3a', '#bccc68'], 12); vat(116, 74, 6, ['#b88a4c', '#8a5a2a', '#d8a868'], 11);
  px2Line(G, 100, 70, 107, 56, 1.4, (x, y, s) => W[s < 0 ? 1 : 3]);
  // куча шкур
  for (let k = 0; k < 4; k++) px2Rect(G, 88 + (k % 2) * 2, GY - 1 - k * 2, 97 + (k % 2) * 2, GY - k * 2, (x, y) => (y === GY - 1 - k * 2 ? [CL[0], H[0], CL[1], H[1]][k] : [CL[2], H[2], CL[3], H[3]][k]));
  px2Rock(G, 36, 81, 2.6, 1.8, 3); px2Rock(G, 110, 84, 2.6, 1.6, 4);
  for (const [x, y, c] of [[38, 80, '#f0d040'], [94, 85, '#f4f0f6'], [4, 80, '#e86a9a']]) { G.set(x, y, c); G.set(x, y + 1, Gr[3]); }
  for (let k = 0; k < 3; k++) px2Rock(G, 62 + (k % 2 ? 1 : -1), GY + 3 + k * 2, 3.4, 1.6, 30 + k, S);
  px2Out(G, PX2.ink, '#6a4a38');
  tanneryArt.cv = px2Canvas(G);
  tanneryArt.perches = [[62, 19], [72, 5]];
  return tanneryArt.cv;
}

// ---------- Каменоломня: скальный уступ с вырубленными ступенями, журавль-кран, каменная сторожка ----------
const QR_W = 108, QR_H = 90, QR_AX = 54, QR_AY = 82;

function quarryArt() {
  if (quarryArt.cv) return quarryArt.cv;
  const S = ['#e4cfa6', '#c4a880', '#a08462', '#7c6450', '#584640', '#3a2c30'], SS = PX2.stone, W = PX2.wood, CL = PX2.clay, Gr = PX2.grass, I = PX2.iron, C = PX2.cream, H = PX2.hide, G = pxGrid(QR_W, QR_H);
  const GY = 82;
  // выбитая земля и щебень
  px2Ell(G, 54, GY - 1, 52, 6, (x, y) => (px2hash(x, y, 2) < 0.45 ? null : H[px2hash(x, y, 3) < 0.5 ? 1 : 2]));
  // скала: ступенчатый уступ слева-сзади, тёплый свет сверху-слева, слои и сколы
  const cliff = [[2, 76], [3, 60], [8, 50], [15, 42], [26, 38], [38, 42], [46, 52], [48, 76]];
  px2Poly(G, cliff, (x, y) => {
    const layer = Math.floor((y + (x > 38 ? 3 : 0)) / 7), l = (x < 22 ? 0 : x < 44 ? 1 : 2) + (px2hash(layer, Math.floor(x / 9), 4) > 0.6 ? 1 : 0) + ((y + 3) % 7 === 0 ? 1 : 0);
    const n = px2hash(x, y, 5);
    return S[Math.max(0, Math.min(5, l + (n > 0.93 ? 1 : n < 0.06 ? -1 : 0) + (y > 68 ? 1 : 0)))];
  });
  // вырубленная ступень-площадка (светлый срез) и тёмные трещины
  px2Poly(G, [[4, 62], [18, 58], [22, 62], [4, 68]], (x, y) => S[y < 58 ? 0 : 1]);
  px2Poly(G, [[26, 48], [40, 48], [44, 54], [28, 56]], (x, y) => S[y < 51 ? 0 : 1]);
  for (const [x0, y0, x1, y1] of [[10, 46, 12, 60], [30, 42, 32, 52], [40, 58, 42, 72]]) px2Line(G, x0, y0, x1, y1, 1.2, () => S[5]);
  // мох на верхней кромке
  for (let x = 8; x <= 44; x++) {
    let y = 30; while (y < 56 && !G.get(x, y)) y++;
    const h = px2hash(x, 1, 4);
    if (G.get(x, y) && y < 56) { G.set(x, y, h < 0.5 ? Gr[0] : Gr[1]); if (h < 0.6) G.set(x, y + 1, Gr[2]); if (h < 0.25) G.set(x, y + 2, Gr[3]); }
  }
  // журавль: две ноги, мачта, стрела, блок и канат с глыбой
  const wl = (x0, y0, x1, y1, w) => px2Line(G, x0, y0, x1, y1, w, (x, y, s) => W[s < 0 ? 1 : 3]);
  wl(5, 68, 14, 34, 2.2); wl(23, 68, 14, 34, 2.2); wl(14, 34, 14, 70, 1.6);
  wl(8, 56, 20, 56, 1.4); wl(14, 34, 26, 40, 1.8);
  px2Ell(G, 14, 33, 2.2, 2.2, (x, y, a) => I[a < 0 ? 1 : 3]);
  px2Line(G, 25, 40, 25, 50, 0.8, () => C[2]);
  px2Rect(G, 22, 50, 28, 52, (x, y) => I[y === 50 ? 0 : 3]);
  px2Rect(G, 19, 52, 31, 60, (x, y) => S[y < 54 ? 0 : x < 25 ? 1 : y > 57 ? 4 : 3]);   // глыба на канате
  px2Rect(G, 19, 60, 31, 60, () => S[5]);
  // сторожка: каменная кладка, тёплая глиняная черепица, дверь по центру
  px2Rect(G, 66, 60, 72, GY, (x, y) => (y < 66 ? CL[4] : S[4]));
  px2Bricks(G, 36, 58, 66, GY, SS, 4, 6, 6, (x, y) => (y < 62 ? 1 : y > 76 ? 3 : 2) + (x > 56 ? 1 : 0));
  const roofC = (x, y, top, base) => {
    const row = Math.floor((y - top) / 3), off = row % 2 ? 2 : 0, scallop = (y - top) % 3 === 2 && (x + off) % 4 < 2;
    return CL[Math.min(5, base + (scallop ? 1 : 0) + ((x + off) % 4 === 0 ? 1 : 0) + (px2hash(Math.floor((x + off) / 4), row, 8) > 0.82 ? 1 : 0))];
  };
  px2Poly(G, [[32, 60], [70, 60], [62, 40], [40, 40]], (x, y) => roofC(x, y, 40, x < 46 ? 0 : x < 58 ? 1 : 2));
  px2Poly(G, [[70, 60], [76, 64], [66, 43], [62, 40]], (x, y) => roofC(x, y, 40, 4));
  px2Rect(G, 32, 60, 70, 60, () => CL[5]); px2Rect(G, 36, 61, 66, 62, (x, y) => (y === 61 ? S[5] : S[4]));
  px2Rect(G, 39, 39, 63, 39, () => CL[0]);
  // труба
  px2Bricks(G, 56, 26, 61, 44, SS, 3, 3, 9, (x) => (x < 58 ? 1 : 3));
  px2Rect(G, 55, 24, 62, 26, (x, y) => (y === 24 ? S[1] : S[4])); px2Rect(G, 57, 24, 60, 24, () => '#14100e');
  // арочная дверь
  const dx = 54;
  px2Poly(G, [[dx - 6, GY], [dx - 6, 68], [dx - 4, 65], [dx - 1, 64], [dx + 1, 64], [dx + 4, 65], [dx + 6, 68], [dx + 6, GY]], (x, y) => S[(x + y) % 3 === 0 ? 4 : x < dx ? 1 : 3]);
  px2Poly(G, [[dx - 4, GY], [dx - 4, 69], [dx - 2, 67], [dx + 2, 67], [dx + 4, 69], [dx + 4, GY]], (x, y) => W[(x - dx) % 3 === 0 ? 4 : x < dx - 1 ? 1 : x > dx + 1 ? 3 : 2]);
  for (const by of [71, 77]) px2Rect(G, dx - 4, by, dx + 4, by, (x) => (x % 4 === 0 ? I[0] : I[3]));
  G.set(dx + 2, 75, '#f4c848'); G.set(dx + 2, 76, '#c89226');
  // окошко с тёплым светом
  px2Rect(G, 42, 66, 47, 71, (x, y) => (x === 42 || x === 47 || y === 66 || y === 71 ? S[5] : x === 44 || y === 68 ? W[4] : '#ffd878'));
  // кирка в пне и киянка
  px2Rect(G, 78, 74, 86, 82, (x, y) => (y < 76 ? W[0] : W[2 + (x > 82 ? 1 : 0)]));
  px2Line(G, 81, 74, 79, 58, 1.6, (x, y, s) => W[s < 0 ? 1 : 3]);
  px2Poly(G, [[73, 58], [85, 56], [86, 59], [74, 61]], (x) => I[x < 79 ? 0 : 2]);
  // штабель тёсаных блоков справа
  const blk = (x, y, w, h, seed) => px2Rect(G, x, y, x + w, y + h, (X, Y) => S[Y === y ? 0 : Y === y + h ? 4 : X === x ? 1 : X === x + w ? 3 : 1 + (px2hash(X, Y, seed) > 0.85 ? 1 : 0)]);
  blk(86, 70, 14, 11, 11); blk(90, 60, 11, 9, 12); blk(78, 80, 9, 3, 13);
  px2Rect(G, 86, 69, 100, 69, () => S[5]);
  // щебень, камешки, цветы
  for (let k = 0; k < 9; k++) px2Rock(G, 6 + k * 3 + (k % 2) * 40, GY + 2 - (k % 3), 2.2, 1.4, 20 + k, S);
  for (const [x, y, c] of [[72, 80, '#f0d040'], [3, 79, '#f4f0f6'], [100, 82, '#e86a9a']]) { G.set(x, y, c); G.set(x, y + 1, Gr[3]); }
  px2Out(G, PX2.ink, '#6a4a38');
  quarryArt.cv = px2Canvas(G);
  quarryArt.perches = [[14, 32], [51, 39]];
  return quarryArt.cv;
}
