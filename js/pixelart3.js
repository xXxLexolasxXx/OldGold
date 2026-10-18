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
