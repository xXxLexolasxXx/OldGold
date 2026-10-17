'use strict';
// Ручной пиксель-арт, часть 3: пекарня и дубильня (кисти и палитры — в pixelart2.js).

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

// ---------- Дубильня: нора в зелёном холме, сушилка со шкурами и чаны ----------
const TN_W = 116, TN_H = 84, TN_AX = 58, TN_AY = 76;

function tanneryArt() {
  if (tanneryArt.cv) return tanneryArt.cv;
  const S = PX2.stone, Gr = PX2.grass, H = PX2.hide, W = PX2.wood, G = pxGrid(TN_W, TN_H);
  const hx = 64, hy = 76;
  px2Ell(G, hx, hy, 42, 44, (x, y, a, b) => {
    if (y > hy + 2) return null;
    const l = (a * -0.45 + b * -0.7) * 0.5 + 0.5, h = px2hash(x, y, 4);
    let i = Math.max(0, Math.min(5, Math.floor((1 - l) * 5.2)));
    if (h < 0.1) i = Math.max(0, i - 1); else if (h > 0.93) i = Math.min(5, i + 1);
    return Gr[i];
  });
  for (let k = 0; k < 70; k++) { const x = 28 + Math.floor(px2hash(k, 1, 5) * 72), y = 38 + Math.floor(px2hash(k, 2, 5) * 36); if (G.get(x, y)) { G.set(x, y, Gr[0]); G.set(x, y - 1, Gr[0]); } }
  for (const [x, y, c] of [[38, 52, '#f4f0f6'], [96, 56, '#f0d040'], [50, 44, '#e86a9a'], [88, 46, '#b080e0'], [32, 66, '#f0d040'], [100, 66, '#f4f0f6']]) { G.set(x, y, c); G.set(x, y + 1, Gr[4]); }
  // труба из склона
  px2Bricks(G, 84, 22, 90, 40, S, 3, 4, 6, (x) => (x < 87 ? 1 : 3));
  px2Rect(G, 83, 20, 91, 22, (x, y) => (y === 20 ? S[1] : S[4])); px2Rect(G, 85, 20, 89, 20, () => '#14100e');
  // круглая дверь в каменной арке
  const dx = 64, dy = 62, R = 9;
  px2Ell(G, dx, dy, R + 3.4, R + 3.4, (x, y, a) => ((x + y) % 3 === 0 ? S[3] : S[a < -0.1 ? 0 : 2]));
  px2Ell(G, dx, dy, R, R, (x, y, a) => W[(x - dx) % 4 === 0 ? 4 : a < -0.35 ? 1 : a > 0.4 ? 3 : 2]);
  px2Rect(G, dx - R, dy - 1, dx + R - 1, dy, () => PX2.iron[3]);
  G.set(dx + 3, dy + 3, '#f4c848'); G.set(dx + 4, dy + 3, '#c89226');
  px2Rect(G, dx - R - 3, dy + R + 2, dx + R + 3, dy + R + 3, (x, y) => S[y === dy + R + 2 ? 1 : 3]);
  // круглые окошки с цветами
  for (const wx of [40, 88]) {
    px2Ell(G, wx, 60, 5.6, 5.6, (x, y, a) => S[(x + y) % 3 === 0 ? 4 : a < 0 ? 0 : 3]);
    px2Ell(G, wx, 60, 3.6, 3.6, (x, y, a, b) => (x === wx || y === 60 ? W[4] : a * a + b * b > 0.5 ? '#f0b048' : '#ffe898'));
    px2Rect(G, wx - 4, 66, wx + 4, 67, (x, y) => W[y === 66 ? 1 : 3]);
    G.set(wx - 2, 65, '#e86a9a'); G.set(wx, 65, '#f4f0f6'); G.set(wx + 2, 65, '#e86a9a'); G.set(wx - 1, 64, Gr[3]); G.set(wx + 1, 64, Gr[3]);
  }
  for (let k = 0; k < 3; k++) px2Rock(G, dx + (k % 2 ? 2 : -2), dy + R + 8 + k * 2, 4, 1.8, 30 + k, S);   // плоские камни дорожки
  // сушилка слева: стойки, перекладина, шкуры
  const rx0 = 4, rx1 = 34, ry = 42;
  px2Rect(G, rx0, ry, rx0 + 1, 77, (x) => W[x === rx0 ? 1 : 3]); px2Rect(G, rx1, ry, rx1 + 1, 77, (x) => W[x === rx1 ? 1 : 3]);
  px2Rect(G, rx0 - 1, ry, rx1 + 2, ry + 1, (x, y) => W[y === ry ? 0 : 3]);
  for (const [x, len, k] of [[8, 22, 0], [16, 28, 1], [24, 20, 2]]) {
    px2Poly(G, [[x, ry + 2], [x + 7, ry + 2], [x + 8, ry + len * 0.5], [x + 6, ry + len], [x + 3, ry + len - 2], [x + 1, ry + len], [x - 1, ry + len * 0.5]], (X, Y) => {
      const t = (X - x) / 8, n = px2hash(X, Y, k + 3);
      return H[Math.max(0, Math.min(5, (t < 0.3 ? 1 : t < 0.65 ? 2 : 3) + (n > 0.88 ? 1 : n < 0.1 ? -1 : 0) + (Y > ry + len - 5 ? 1 : 0)))];
    });
  }
  // чаны и куча шкур справа
  const vat = (x, y, w, liquid) => {
    px2Rect(G, x - w, y - 9, x + w, y, (X, Y) => { const t = (X - (x - w)) / (2 * w); return W[(Y - y) % 5 === 0 ? 4 : px2Cyl(t)]; });
    px2Rect(G, x - w, y - 7, x + w, y - 6, () => PX2.iron[2]); px2Rect(G, x - w, y - 2, x + w, y - 1, () => PX2.iron[2]);
    px2Ell(G, x, y - 9, w, 2.6, (X, Y, a, b) => (a * a + b * b > 0.7 ? W[0] : liquid[(X + Y) % 4 === 0 ? 1 : 0]));
  };
  vat(100, 75, 7, ['#7a8a3a', '#a0b04c']); vat(110, 69, 5, ['#8a5a2a', '#b88a4c']);
  for (let k = 0; k < 4; k++) px2Rect(G, 84 + (k % 2) * 2, 76 - k * 2, 95 + (k % 2) * 2, 77 - k * 2, (x, y) => H[y === 76 - k * 2 ? 1 : 3]);
  px2Out(G, PX2.ink, '#3a5a2a');
  tanneryArt.cv = px2Canvas(G);
  tanneryArt.perches = [[hx, 33], [87, 21]];
  return tanneryArt.cv;
}
