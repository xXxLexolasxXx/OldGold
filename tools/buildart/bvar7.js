'use strict';
// Склад в стиле нового трактира (×1). Лот 4×3 = 128×96, фасад на юге, главный въезд на x = 80.
// У каждого варианта — двойной вход (две пары ворот: привоз и вывоз) и открытая площадка, где лежит груз:
// брёвна, доски, камень, мешки, бочки, ящики. В игре кучи будут расти и убывать по запасам склада (meta.piles).

// ---- реквизит склада ×1 ----
const Q2 = {
  planks(P, n = 5, L = 18) {   // штабель досок с прокладками
    for (let r = 0; r < n; r++) {
      const y = -1 - r * 2;
      PR.rect(P, -L / 2, y - 1, L / 2, y, P1.plank[r % 2 ? 1 : 0]); PR.rect(P, -L / 2, y, L / 2, y, P1.plank[2]);
      P(-L / 2, y - 1, P1.plank[3]); P(L / 2, y - 1, P1.plank[3]);
      if (r % 2) { P(-L / 2 + 3, y + 1, P1.beam[2]); P(L / 2 - 3, y + 1, P1.beam[2]); }
    }
  },
  logStack(P, rows = 3, n = 5) {   // поленница брёвен торцами к зрителю
    for (let r = 0; r < rows; r++) for (let k = 0; k < n - r; k++) {
      const cx = (k - (n - r - 1) / 2) * 5, cy = -3 - r * 4.4;
      PR.ell(P, cx, cy, 2.6, 2.4, (x, y, a, b) => { const e = a * a + b * b; return e > 0.6 ? P1.log[3] : e < 0.12 ? P1.log[0] : P1.log[1 + (bhash(x, y, 401) < 0.3 ? 1 : 0)]; });
    }
  },
  stones(P, r = 8) {   // куча колотого камня
    for (let k = 0; k < 14; k++) {
      const a = bhash(k, 0, 411) * Math.PI, d = bhash(k, 1, 412) * r, cx = Math.cos(a) * d, cy = -Math.sin(a) * d * 0.7 - 1, s = 1.6 + bhash(k, 2, 413) * 1.6;
      PR.ell(P, cx, cy, s, s * 0.75, (x, y, aa, bb) => P1.stone[bb < -0.3 ? 0 : aa > 0.4 ? 2 : 1]);
    }
  },
  sacks(P, n = 4) { const pos = [[-5, 0], [1, 0], [7, 0], [-2, -5], [4, -5], [1, -9]]; for (let k = 0; k < Math.min(n, pos.length); k++) Q1.sack((x, y, c) => P(x + pos[k][0], y + pos[k][1], c), 7, 8); },
  crates(P, n = 3) { const pos = [[-8, 0], [0, 0], [-4, -8]]; for (let k = 0; k < Math.min(n, pos.length); k++) Q1.crate((x, y, c) => P(x + pos[k][0], y + pos[k][1], c), 7); },
  barrels(P, n = 3) { const pos = [[-6, 0], [2, 0], [-2, -1]]; for (let k = 0; k < Math.min(n, pos.length); k++) Q1.barrel((x, y, c) => P(x + pos[k][0], y + pos[k][1], c), 7, 9); },
  crane(P, h = 34, L = 16) {   // поворотная стрела с блоком и ящиком на верёвке
    PR.rect(P, 0, -h, 1, 0, P1.beam[1]); PR.rect(P, -2, 0, 3, 0, P1.beam[2]);
    PR.rect(P, 0, -h, L, -h + 1, P1.beam[1]); PR.line(P, 1, -h + 8, L - 4, -h + 2, P1.beam[2]);
    PR.rect(P, L - 1, -h + 2, L, -h + 3, P1.iron[1]); PR.rect(P, L, -h + 3, L, -h + 16, BP.rope[1]);
    Q1.crate((x, y, c) => P(x + L - 3, y - h + 22, c), 6);
  },
  sign(P) { Q1.sign(P, 'crate' in Q1 ? 'mug' : 'mug', 1); },
  scale(P) { PR.rect(P, 0, -18, 0, 0, P1.iron[2]); PR.rect(P, -7, -18, 7, -18, P1.iron[1]); for (const s of [-1, 1]) { PR.rect(P, s * 7, -17, s * 7, -12, BP.rope[1]); PR.rect(P, s * 7 - 3, -11, s * 7 + 3, -11, P1.gold[2]); } },
};
// низкая каменная перегородка (закрома)
function bin1(g, x0, x1, y0, y1, h = 5) { box(g, { x0, x1, y0, y1, h, mat: m1Stone(P1.stone, 4, 3), top: m1Flat(P1.stone[1]) }); }
// ворота: две створки, нараспашку (тёмный проём + створки по бокам) или закрытые
function gate1(g, side, at, a, w, h, open = true) {
  if (open) {
    elem(g, side, at, a, 0, w, h, (u, v) => (v > h - 2 || u < 1 || u > w - 2 ? P1.beam[2] : v < 1 ? P1.dark[2] : P1.dark[3 - (v > h * 0.6 ? 1 : 0)]));
    const leaf = m1Plank(P1.plank, 3), F = { w: w / 2 * BK, h };
    if (side === 'S') { g.face([[a - 0.2, at - 0.3, 0], [a - 0.2, at - w / 2, 0], [a - 0.2, at - w / 2, h - 1], [a - 0.2, at - 0.3, h - 1]], [0, -1, 0], [0, 0, 1], leaf, { F }); g.face([[a + w + 0.2, at - w / 2, 0], [a + w + 0.2, at - 0.3, 0], [a + w + 0.2, at - 0.3, h - 1], [a + w + 0.2, at - w / 2, h - 1]], [0, 1, 0], [0, 0, 1], leaf, { F }); }
  } else elem(g, side, at, a, 0, w, h, m1Door({ w, h, double: true, col: P1.plank }));
}

const STORE1_VARS = [
  { name: 'Амбар с двумя воротами и закромами впереди', make(g) {
    const meta = g.meta = { piles: {} };
    const M = { x0: 6, x1: 122, y0: 54, y1: 92, h: 22 };
    box(g, Object.assign({ mat: (u, v, F) => (v < 8 ? m1Stone(P1.stone)(u, v, F) : m1Plank(P1.plank, 4)(u, v, F)) }, M));
    roof(g, M, { type: 'gable', axis: 'X', rise: 22, ov: 3, ovg: 4, mat: m1Straw3(STRAW1.rye), cut: m1StrawCut(STRAW1.rye), th: 4, gable: m1Plank(P1.plank, 4) });
    gate1(g, 'S', M.y0, 40, 16, 16, true); gate1(g, 'S', M.y0, 72, 16, 16, true);
    for (const x of [12, 100]) elem(g, 'S', M.y0, x, 10, 8, 6, m1Window({ w: 8, h: 6, lit: false }));
    elem(g, 'S', M.y0 - 0.3, 58, 24, 12, 7, m1Sprite(12, 7, P => { Q1.board(P, 'mug', 12, 7); }));
    chimney1(g, 20, 80, M.h + 6, 14, { w: 5, d: 5 });
    // закрома: четыре отсека низкими каменными стенками
    const Y0 = 10, Y1 = 40;
    for (const x of [6, 36, 66, 96, 122]) bin1(g, x, x + 2, Y0, Y1);
    bin1(g, 6, 124, Y1, Y1 + 2);
    g.sprite([21, 28, 0], P => Q2.logStack(P, 4, 6)); meta.piles.trunk = [21, 28, 0];
    g.sprite([51, 26, 0], P => Q2.planks(P, 7, 24)); meta.piles.timber = [51, 26, 0];
    g.sprite([81, 26, 0], P => Q2.stones(P, 12)); meta.piles.stone = [81, 26, 0];
    g.sprite([109, 26, 0], P => Q2.sacks(P, 5)); meta.piles.food = [109, 26, 0];
    paveSeg(g, 42, 56, 40, 54); paveSeg(g, 74, 88, 0, 54);
    g.sprite([62, 44, 0], P => Q2.scale(P));
    g.sprite([4, 50, 0], P => Q2.barrels(P)); g.sprite([118, 50, 0], P => Q2.crates(P));
  } },
  { name: 'Дом-склад с открытым навесом и краном', make(g) {
    const meta = g.meta = { piles: {} };
    const M = { x0: 6, x1: 62, y0: 48, y1: 92, h: 20 }, Up = { x0: 4, x1: 64, y0: 46, y1: 92, z0: 20, h: 12 };
    box(g, Object.assign({ mat: m1Stone(P1.stoneW) }, M));
    box(g, Object.assign({ mat: m1Plaster(P1.plaster, { frame: true, bay: 14, braceOdd: true }) }, Up));
    roof(g, Up, { type: 'gable', axis: 'Y', rise: 26, ov: 3, ovg: 4, mat: m1Straw3(STRAW1.reed), cut: m1StrawCut(STRAW1.reed), th: 4, gable: m1Plaster(P1.plaster, { frame: true, bay: 12, brace: false }) });
    gate1(g, 'S', M.y0, 12, 14, 15, true); gate1(g, 'S', M.y0, 38, 14, 15, true);
    elem(g, 'S', Up.y0, 27, 22, 10, 9, m1Door({ w: 10, h: 9, col: P1.plank }));                 // чердачная дверь
    beam1(g, 30, 34, 38, 48, 34, 2); g.sprite([32, 40, 20], P => { PR.rect(P, 0, -12, 0, 0, BP.rope[1]); Q1.sack((x, y, c) => P(x, y + 2, c), 6, 7); });
    chimney1(g, 12, 76, Up.z0 + Up.h + 6, 12, { w: 5, d: 5 });
    // открытый навес на столбах: под ним штабеля видны целиком
    const N = { x0: 68, x1: 124, y0: 72, y1: 90 };   // навес только над задней полосой: дождь не мочит, а штабеля спереди видны
    for (const [x, y] of [[68, 72], [96, 72], [122, 72], [68, 88], [122, 88]]) post1(g, x, y, 0, 16, 2);
    roof(g, { x0: N.x0, x1: N.x1, y0: N.y0, y1: N.y1, h: 16 }, { type: 'lean', down: 'S', rise: 6, ov: 2, mat: m1Shingle(SHINGLE1), cut: m1Fascia, th: 2 });
    g.sprite([82, 84, 0], P => Q2.barrels(P)); g.sprite([110, 84, 0], P => Q2.crates(P));
    g.sprite([82, 58, 0], P => Q2.planks(P, 7, 24)); meta.piles.timber = [82, 58, 0];
    g.sprite([110, 60, 0], P => Q2.logStack(P, 4, 6)); meta.piles.trunk = [110, 60, 0];
    // площадка впереди: камень, мешки, бочки, кран
    box(g, { x0: 4, x1: 124, y0: 4, y1: 42, h: 0.3, mat: m1Flat(P1.stone[3]), top: (u, v) => { const h = bhash(u, v, 421); return h < 0.06 ? P1.grass[2] : h < 0.5 ? bhex('#8a7458') : bhex('#9c8664'); } });
    g.sprite([24, 24, 0], P => Q2.stones(P, 13)); meta.piles.stone = [24, 24, 0];
    g.sprite([52, 22, 0], P => Q2.sacks(P, 6)); meta.piles.food = [52, 22, 0];
    g.sprite([106, 22, 0], P => Q2.barrels(P)); g.sprite([118, 30, 0], P => Q2.crates(P));
    g.sprite([66, 30, 0], P => Q2.crane(P));
    paveSeg(g, 74, 88, 0, 42); paveSeg(g, 16, 50, 36, 48);
  } },
  { name: 'Двор-каре: два крыла, ворота во двор и задний амбар', make(g) {
    const meta = g.meta = { piles: {} };
    const B = { x0: 18, x1: 110, y0: 66, y1: 92, h: 20 }, L = { x0: 4, x1: 18, y0: 30, y1: 92, h: 12 }, R = { x0: 110, x1: 124, y0: 30, y1: 92, h: 12 };   // узкие низкие крылья — двор на виду
    box(g, Object.assign({ mat: m1Plaster(P1.plaster, { frame: true, bay: 16, braceOdd: true, low: 6 }) }, B));
    box(g, Object.assign({ mat: m1Logs(P1.log) }, L)); box(g, Object.assign({ mat: m1Logs(P1.log) }, R));
    roof(g, B, { type: 'gable', axis: 'X', rise: 20, ov: 3, ovg: 4, mat: m1Straw3(STRAW1.wheat), cut: m1StrawCut(STRAW1.wheat), th: 4, gable: m1Plank(P1.plank, 4) });
    roof(g, L, { type: 'lean', down: 'E', rise: 5, ov: 2, mat: m1Straw3(STRAW1.wheat), cut: m1StrawCut(STRAW1.wheat), th: 3 });
    roof(g, R, { type: 'lean', down: 'W', rise: 5, ov: 2, mat: m1Straw3(STRAW1.wheat), cut: m1StrawCut(STRAW1.wheat), th: 3 });
    gate1(g, 'S', B.y0, 40, 16, 15, true); gate1(g, 'S', B.y0, 72, 16, 15, true);
    elem(g, 'S', B.y0 - 0.3, 58, 16, 12, 7, m1Sprite(12, 7, P => Q1.board(P, 'mug', 12, 7)));
    for (const y of [40, 60]) { elem(g, 'E', L.x1, y, 4, 8, 7, m1Window({ w: 8, h: 7, lit: false })); }
    elem(g, 'E', R.x1, 50, 0, 12, 12, m1Door({ w: 12, h: 12, double: true, col: P1.plank }));
    // ворота во двор на южной стороне: два столба и перекладина
    S2([[18, 24], [108, 24]], (x, y) => post1(g, x, y, 0, 16, 3)); fence1(g, 20, 54, 26, 26); fence1(g, 90, 108, 26, 26);
    // двор: кучи по углам, дорожка через центр к обоим воротам
    g.sprite([38, 50, 0], P => Q2.logStack(P, 4, 6)); meta.piles.trunk = [40, 50, 0];
    g.sprite([94, 50, 0], P => Q2.planks(P, 7, 22)); meta.piles.timber = [90, 50, 0];
    g.sprite([38, 34, 0], P => Q2.stones(P, 11)); meta.piles.stone = [40, 36, 0];
    g.sprite([94, 34, 0], P => Q2.sacks(P, 6)); meta.piles.food = [90, 36, 0];
    paveSeg(g, 56, 96, 52, 66); paveSeg(g, 56, 88, 0, 52);
    g.sprite([16, 16, 0], P => Q2.barrels(P)); g.sprite([114, 14, 0], P => Q2.crates(P));
  } },
  { name: 'Каменный склад с погрузочным помостом', make(g) {
    const meta = g.meta = { piles: {} };
    const M = { x0: 6, x1: 98, y0: 50, y1: 92, h: 24 };
    box(g, Object.assign({ mat: m1Stone(P1.stoneB, 7, 4) }, M));
    roof(g, M, { type: 'hip', axis: 'X', rise: 18, hipL: 18, ov: 3, mat: m1Straw3(STRAW1.reed), cut: m1StrawCut(STRAW1.reed), th: 4 });
    // помост вдоль фасада, по нему катят бочки к двум воротам
    box(g, { x0: 6, x1: 98, y0: 40, y1: 50, h: 5, mat: m1Stone(P1.stone, 5, 3), top: (u, v) => P1.plank[(v | 0) % 3 === 0 ? 2 : (u | 0) % 11 === 0 ? 1 : 0] });
    for (const x of [30, 74]) box(g, { x0: x - 6, x1: x + 6, y0: 30, y1: 40, h: 2.5, mat: m1Stone(P1.stone, 5, 3), top: m1Flat(P1.stone[1]) });   // пандусы к воротам
    gate1(g, 'S', M.y0, 22, 16, 17, true); gate1(g, 'S', M.y0, 66, 16, 17, true);
    for (const x of [8, 48, 88]) elem(g, 'S', M.y0, x, 12, 6, 6, m1Window({ w: 6, h: 6, lit: false, bars: true }));
    railing1(g, 6, 18, 40, 40, 5, 5); railing1(g, 42, 62, 40, 40, 5, 5); railing1(g, 86, 98, 40, 40, 5, 5);
    g.sprite([44, 44, 5], P => Q2.barrels(P)); g.sprite([54, 46, 5], P => Q2.sacks(P, 3));
    chimney1(g, 80, 72, M.h + 6, 12, { stone: true, w: 6, d: 6 });
    // открытый двор справа и впереди
    box(g, { x0: 100, x1: 126, y0: 4, y1: 92, h: 0.3, mat: m1Flat(P1.stone[3]), top: (u, v) => { const h = bhash(u, v, 421); return h < 0.06 ? P1.grass[2] : h < 0.5 ? bhex('#8a7458') : bhex('#9c8664'); } });
    g.sprite([112, 76, 0], P => Q2.logStack(P, 4, 5)); meta.piles.trunk = [112, 76, 0];
    g.sprite([112, 56, 0], P => Q2.planks(P, 7, 20)); meta.piles.timber = [112, 56, 0];
    g.sprite([112, 34, 0], P => Q2.stones(P, 11)); meta.piles.stone = [112, 34, 0];
    g.sprite([30, 16, 0], P => Q2.sacks(P, 6)); meta.piles.food = [30, 16, 0];
    g.sprite([100, 40, 0], P => Q2.crane(P, 30, 12));
    paveSeg(g, 68, 92, 0, 30); paveSeg(g, 22, 38, 20, 30);
    g.sprite([10, 18, 0], P => Q2.crates(P)); g.sprite([54, 14, 0], P => Q2.scale(P));
  } },
];

BDEFS.store1 = { w: 4, h: 3, top: 70, vars: STORE1_VARS, title: 'Склад: варианты (×1)', bk: 1, ink: P1.ink };
