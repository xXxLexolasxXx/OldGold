'use strict';
// Блок 1 (оставшиеся стартовые): колодец 2×2, лазарет 3×2, извозчик 3×2, торговый пост 3×3, загон для коз 3×2 —
// по 4 варианта на выбор. Правила: дом в углу, двор с делом, крыша по уровню (своя солома), ничего не наслаивается.

const STRAW_X = {
  moss: bramp(['#c2c88a', '#98a062', '#6e7a40', '#4a5428']),     // моховая
  rust: bramp(['#e4a670', '#c27c48', '#94582c', '#663a1a']),     // рыжая
  pale: bramp(['#f2ecc4', '#d4cc96', '#aaa06a', '#787044']),     // бледная
};
const QW = {
  bucket(P) { PR.rect(P, -2, -4, 2, 0, P1.plank[2]); PR.rect(P, -2, -4, 2, -4, P1.iron[1]); PR.rect(P, -2, -1, 2, -1, P1.iron[1]); PR.rect(P, -1, -3, 1, -3, P1.scale[0]); },
  trough(P, w = 12) { PR.rect(P, -w / 2, -4, w / 2, 0, P1.plank[2]); PR.rect(P, -w / 2 + 1, -4, w / 2 - 1, -3, P1.scale[1]); PR.rect(P, -w / 2, -4, w / 2, -4, P1.plank[0]); },
  cot(P) { PR.rect(P, -7, -4, 7, -2, P1.plank[2]); PR.rect(P, -6, -6, 6, -4, P1.white[0]); PR.rect(P, -6, -6, -3, -5, P1.white[1]); P(-7, -1, P1.plank[3]); P(7, -1, P1.plank[3]); },
  cauldron(P) { PR.ell(P, 0, -4, 6, 4, (x, y, a, b) => (b < -0.5 ? P1.grass[0] : P1.iron[2])); PR.rect(P, -5, 0, -4, 1, P1.iron[2]); PR.rect(P, 4, 0, 5, 1, P1.iron[2]); for (const [x, y] of [[-2, -10], [1, -13], [-1, -16]]) PR.ell(P, x, y, 2, 1.6, () => P1.smoke[1]); },
  rack(P) { PR.rect(P, -8, -14, -8, 0, P3.oak[1]); PR.rect(P, 8, -14, 8, 0, P3.oak[1]); PR.rect(P, -9, -14, 9, -14, P3.oak[2]); for (let x = -6; x <= 6; x += 3) { PR.rect(P, x, -13, x, -7, (x / 3 & 1) ? P1.grass[1] : P1.straw[1]); P(x, -6, P1.red[0]); } },
  cross(P) { PR.rect(P, 0, -20, 0, 0, P3.oak[1]); PR.rect(P, -5, -20, 5, -12, P1.white[0]); PR.rect(P, -1, -19, 1, -13, P1.red[1]); PR.rect(P, -4, -17, 4, -15, P1.red[1]); },
  horse(P, f = 1) { PR.rect(P, -8, -12, 6, -6, P1.log[1]); PR.rect(P, -8, -12, 6, -12, P1.log[0]); for (const x of [-7, -3, 2, 5]) PR.rect(P, x, -6, x, 0, P1.log[2]); PR.rect(P, 6 * f, -16, 9 * f, -11, P1.log[1]); PR.rect(P, 9 * f, -15, 11 * f, -13, P1.log[1]); P(10 * f, -15, P1.ink); PR.rect(P, 6 * f, -17, 7 * f, -12, P1.dark[3]); PR.rect(P, -9 * f, -11, -9 * f, -5, P1.dark[3]); },
  cart(P) { propCartPlain(P); },
  hitch(P) { PR.rect(P, -10, -6, 10, -5, P3.oak[1]); PR.rect(P, -10, -6, -10, 0, P3.oak[2]); PR.rect(P, 10, -6, 10, 0, P3.oak[2]); },
  horn(P) { PR.rect(P, 0, -18, 0, 0, P3.oak[1]); PR.rect(P, 1, -17, 11, -11, P1.plank[1]); PR.ell(P, 6, -14, 3, 2, (x, y, a) => (a < 0 ? P1.gold[1] : P1.gold[2])); P(9, -14, P1.gold[0]); },
  stall(P, A = P1.red) { PR.rect(P, -9, -16, -9, 0, P3.oak[1]); PR.rect(P, 9, -16, 9, 0, P3.oak[1]); for (let x = -10; x <= 10; x++) PR.rect(P, x, -18, x, -14, (Math.floor((x + 10) / 3) % 2 ? P1.white : A)[x > 6 ? 1 : 0]); PR.rect(P, -9, -6, 9, -4, P1.plank[1]); for (const [x, c] of [[-6, P1.red[0]], [-2, P1.gold[0]], [2, P1.grass[0]], [6, P1.scale[0]]]) PR.ell(P, x, -7, 1.6, 1.3, () => c); },
  tent(P, A = P1.red) { for (let y = -18; y <= 0; y++) { const hw = Math.round((y + 18) * 0.6); for (let x = -hw; x <= hw; x++) P(x, y, (Math.floor((x + 20) / 3) % 2 ? P1.white : A)[x > hw - 2 ? 1 : 0]); } PR.rect(P, -2, -6, 2, 0, P1.dark[3]); PR.rect(P, 0, -22, 0, -18, P3.oak[1]); P(1, -22, A[0]); P(2, -21, A[0]); },
  goat(P, f = 1, R = P1.white) { PR.ell(P, 0, -6, 5, 3, (x, y, a, b) => R[b < -0.3 ? 0 : a * f > 0.4 ? 2 : 1]); for (const x of [-3, -1, 2, 4]) PR.rect(P, x, -4, x, 0, R[2]); PR.rect(P, 4 * f, -10, 6 * f, -6, R[1]); P(6 * f, -11, P1.dark[2]); P(4 * f, -11, P1.dark[2]); P(6 * f, -5, R[2]); P(7 * f, -8, P1.ink); },
};
function propCartPlain(P) { PR.rect(P, -12, -9, 12, -4, P1.plank[2]); PR.rect(P, -12, -10, 12, -10, P1.plank[0]); PR.rect(P, 12, -7, 20, -7, P1.plank[3]); for (const x of [-7, 7]) PR.ell(P, x, -2, 3, 3, (xx, y, a, b) => (a * a + b * b > 0.5 ? P1.plank[3] : (Math.abs(a) < 0.2 || Math.abs(b) < 0.2) ? P1.plank[2] : null)); }
function rf(lv, S, T) { return STRS(lv, S, T); }
function lvlProps(g, lv, list2, list3) { if (lv >= 2) list2(); if (lv >= 3) list3(); }

// =================== КОЛОДЕЦ 2×2 ===================
const WELL_VARS = [
  { name: 'К1. Каменный колодец под двускатной крышей с воротом, корыто, лавка', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW_X.moss, P1.tileR);
    cyl(g, 32, 34, 9, 0, 8, m1Stone(P1.stoneW, 5, 3), 20);
    g.face(Array.from({ length: 16 }, (_, i) => [32 + Math.cos(i / 16 * 6.283) * 7.5, 34 + Math.sin(i / 16 * 6.283) * 7.5, 8.01]), [1, 0, 0], [0, 1, 0], (u, v) => ((u + v) % 7 < 1 ? P1.scale[2] : P1.scale[3]));
    for (const x of [23, 40]) post1(g, x, 33, 8, 12, 2, P3.oak);
    beam1(g, 24, 41, 33.5, 35, 16, 1.5, P1.plank);
    roof(g, { x0: 22, x1: 42, y0: 28, y1: 40, h: 20 }, { type: 'gable', axis: 'X', rise: 8, ov: 2, ovg: 2, mat: R.mat, cut: R.cut, th: R.th });
    g.sprite([32, 33, 10], P => QW.bucket(P), -0.5);
    g.sprite([48, 14, 0], P => QW.trough(P)); g.sprite([14, 16, 0], P => Q1.bench(P, 10)); g.meta.doorPt = [32, 25, 0];
    lvlProps(g, lv, () => g.sprite([8, 40, 0], P => Q1.planter(P, 9)), () => { g.sprite([52, 40, 0], P => Q1.lantern(P)); paveSand(g, 26, 38, 0, 25); });
  } },
  { name: 'К2. Колодец-башенка: круглый сруб под конусом, фонарь, вёдра', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW_X.pale, P1.slate);
    cyl(g, 32, 38, 11, 0, 14, m1Logs(P1.log), 22);
    cone(g, 32, 38, 15, 13, 14, R.mat, R.cut, 22, 2);
    elem(g, 'S', 27.5, 27, 2, 10, 9, m1Door({ w: 10, h: 9, col: P1.dark })); g.meta.doorPt = [32, 26, 0];
    g.sprite([18, 22, 0], P => QW.bucket(P)); g.sprite([22, 18, 0], P => QW.bucket(P)); g.sprite([46, 24, 0], P => Q1.streetLamp(P, 12));
    lvlProps(g, lv, () => g.sprite([48, 46, 0], P => QW.trough(P)), () => g.sprite([32, 38, 32], P => Q1.pennant(P, 8)));
  } },
  { name: 'К3. Колодец-журавль: длинный шест с противовесом, бадья, корыто для скота', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW_X.rust, P1.tileD);
    cyl(g, 22, 40, 7, 0, 6, m1Plank(P1.plank, 3), 18);
    post1(g, 40, 40, 0, 16, 2.5, P3.oak);
    g.sprite([41, 41, 16], P => { PR.line(P, -26, 14, 20, -10, P3.oak[1], 2); PR.rect(P, 18, -12, 22, -6, P1.stone[2]); PR.rect(P, -26, 14, -26, 22, BP.rope[1]); QW.bucket((x, y, c) => P(x - 26, y + 26, c)); }, -0.5);
    roof(g, { x0: 46, x1: 62, y0: 40, y1: 56, h: 9 }, { type: 'lean', down: 'S', rise: 4, ov: 2, mat: R.mat, cut: R.cut, th: 2 });
    for (const [x, y] of [[46, 40], [60, 40]]) post1(g, x, y, 0, 9, 2);
    g.sprite([30, 16, 0], P => QW.trough(P, 16)); g.meta.doorPt = [22, 32, 0];
    lvlProps(g, lv, () => g.sprite([54, 48, 0], P => Q1.barrel(P, 7, 9)), () => g.sprite([10, 18, 0], P => Q1.flowers(P, 8)));
  } },
  { name: 'К4. Волшебный родник: каменная чаша с бирюзовой водой, рунные камни, кристальные фонари', make(g, lv) {
    g.meta = {};
    cyl(g, 32, 36, 13, 0, 5, m1Stone(P1.stoneB, 5, 3), 24);
    g.face(Array.from({ length: 24 }, (_, i) => [32 + Math.cos(i / 24 * 6.283) * 11.5, 36 + Math.sin(i / 24 * 6.283) * 11.5, 5.01]), [1, 0, 0], [0, 1, 0], (u, v) => ((u * 3 + v) % 11 < 1 ? P3.rune[0] : (u + v) % 5 < 1 ? P3.rune[1] : P3.rune[2]));
    g.sprite([32, 36, 5], P => { PR.rect(P, -1, -10, 1, 0, P1.stone[1]); PR.ell(P, 0, -12, 3, 2, () => P3.rune[0]); for (let k = 0; k < 5; k++) P(Math.round(Math.sin(k) * 3), -14 - k * 2, P3.rune[k % 2]); }, -0.5);
    for (const a of [0.6, 2.4, 4.0, 5.4]) g.sprite([32 + Math.cos(a) * 22, 36 + Math.sin(a) * 18, 0], P => Q3.runeStone(P, 11));
    g.meta.doorPt = [32, 22, 0];
    lvlProps(g, lv, () => { g.sprite([10, 14, 0], P => Q3.crystalLamp(P, 13)); g.sprite([54, 14, 0], P => Q3.crystalLamp(P, 13)); }, () => { g.sprite([12, 52, 0], P => Q3.shroomPatch(P)); g.sprite([32, 20, 14], P => Q3.wisp(P), -2); });
  } },
];

// =================== ЛАЗАРЕТ 3×2 ===================
const INF_VARS = [
  { name: 'Л1. Белёный дом с красным крестом, веранда с койками под навесом', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW_X.pale, P1.tileR);
    const M = { x0: 2, x1: 46, y0: 32, y1: 62, h: 16 };
    box(g, Object.assign({ mat: m1Plaster(P1.plasterW || P1.plaster, { low: 4, stoneR: P1.stoneW }) }, M));
    roof(g, M, { type: 'gable', axis: 'X', rise: 16, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plaster) });
    elem(g, 'S', M.y0, 30, 0, 10, 12, m1Door({ w: 10, h: 12, arch: true, col: P1.red })); g.meta.doorPt = [35, M.y0, 0];
    elem(g, 'S', M.y0, 8, 4, 9, 8, m1Window({ w: 9, h: 8, sill: true }));
    for (const [x, y] of [[50, 12], [92, 12], [50, 34], [92, 34]]) post1(g, x, y, 0, 13, 2);
    roof(g, { x0: 50, x1: 94, y0: 12, y1: 36, h: 13 }, { type: 'lean', down: 'S', rise: 5, ov: 2, mat: m1Awning(P1.red, P1.white), cut: m1Flat(P1.red[1]), th: 1.5 });
    g.sprite([62, 26, 0], P => QW.cot(P)); g.sprite([82, 26, 0], P => QW.cot(P)); g.meta.cots = [[62, 26, 0], [82, 26, 0]];
    g.sprite([46, 30, 0], P => QW.cross(P)); g.sprite([22, 18, 0], P => QW.rack(P));
    lvlProps(g, lv, () => { g.sprite([72, 18, 0], P => QW.cot(P)); g.meta.cots.push([72, 18, 0]); }, () => { g.sprite([10, 12, 0], P => QW.cauldron(P)); g.sprite([94, 46, 0], P => Q1.planter(P, 9)); });
  } },
  { name: 'Л2. Каменная часовня-лечебница с аптекарским огородом и сушилкой трав', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW_X.moss, P1.slate);
    const M = { x0: 2, x1: 34, y0: 26, y1: 62, h: 18 };
    box(g, Object.assign({ mat: m1Stone(P1.stoneW, 6, 4) }, M));
    roof(g, M, { type: 'gable', axis: 'Y', rise: 20, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Stone(P1.stoneW, 6, 4) });
    elem(g, 'S', M.y0, 12, 0, 10, 13, m1Door({ w: 10, h: 13, arch: true, col: P1.plank })); g.meta.doorPt = [17, M.y0, 0];
    elem(g, 'S', M.y0, 14, 22, 6, 7, m1Window({ w: 6, h: 7, round: true, G: P3.crystal }));
    box(g, { x0: 40, x1: 94, y0: 30, y1: 60, h: 1.2, mat: m1Plank(P1.plank, 3), top: (u, v) => ((v | 0) % 6 < 1 ? P1.plank[1] : (u + v) % 5 < 1 ? bhex('#4e3a28') : bhex('#6a5236')) });
    for (let y = 33; y < 60; y += 6) g.sprite([67, y, 1.2], P => { for (let x = -24; x <= 24; x += 3) { const h = 2 + ((x + y) & 1); PR.rect(P, x, -h, x, 0, P1.grass[1 + ((x + y) & 1)]); if ((x + y) % 4 === 0) P(x, -h - 1, [P1.white[0], P3.crystal[1], P1.gold[0]][(x + y + 99) % 3]); } }, -0.2);
    g.sprite([60, 18, 0], P => QW.rack(P)); g.sprite([84, 18, 0], P => QW.rack(P)); g.meta.garden = [67, 44, 1.2];
    lvlProps(g, lv, () => g.sprite([44, 14, 0], P => QW.cauldron(P)), () => g.sprite([94, 14, 0], P => Q3.crystalLamp(P, 12)));
  } },
  { name: 'Л3. Длинный барак с шатром-лазаретом во дворе и котлом с отваром', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW_X.rust, P1.tileD);
    const M = { x0: 2, x1: 70, y0: 44, y1: 62, h: 13 };
    box(g, Object.assign({ mat: m1Logs(P1.log) }, M));
    roofSag(g, M, { axis: 'X', rise: 12, sag: 2, flare: 2, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plank, 4) });
    elem(g, 'S', M.y0, 30, 0, 10, 11, m1Door({ w: 10, h: 11, col: P1.dark })); g.meta.doorPt = [35, M.y0, 0];
    for (const x of [8, 52]) elem(g, 'S', M.y0, x, 4, 8, 7, m1Window({ w: 8, h: 7, frameR: P1.plank }));
    g.sprite([70, 22, 0], P => QW.tent(P, P1.red)); g.sprite([40, 20, 0], P => QW.cauldron(P)); g.sprite([14, 24, 0], P => QW.cot(P)); g.meta.cots = [[14, 24, 0]];
    lvlProps(g, lv, () => { g.sprite([88, 24, 0], P => QW.tent(P, P1.scale)); }, () => { g.sprite([24, 12, 0], P => QW.cot(P)); g.meta.cots.push([24, 12, 0]); g.sprite([92, 50, 0], P => QW.cross(P)); });
  } },
  { name: 'Л4. Целительская башенка: синие окна, рунный круг исцеления, грибы и огоньки', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW_H.sage, P1.scale);
    cyl(g, 18, 46, 13, 0, 26, m1Plaster(P1.plasterC), 24);
    cone(g, 18, 46, 17, 25, 18, R.mat, R.cut, 24, 3);
    elem(g, 'S', 33.6, 13, 0, 10, 13, m1Door({ w: 10, h: 13, arch: true, col: P3.oak })); g.meta.doorPt = [18, 33, 0];
    for (const z of [8, 17]) elem(g, 'S', 34, 6, z, 6, 7, m1Window({ w: 6, h: 7, arch: true, G: P3.crystal }));
    g.sprite([60, 30, 0.3], P => { for (let k = 0; k < 32; k++) { const a = k / 32 * 6.283; P(Math.round(Math.cos(a) * 16), Math.round(Math.sin(a) * 8), P3.rune[k % 3 ? 1 : 0]); } for (const [x, y] of [[0, -3], [-2, 0], [2, 0], [0, 3], [0, 0]]) P(x, y, P3.rune[0]); }, -0.1);
    g.sprite([60, 30, 0], P => QW.cot(P)); g.meta.cots = [[60, 30, 0]]; g.meta.circle = [60, 30, 0];
    g.sprite([90, 50, 0], P => Q3.shroomPatch(P)); g.sprite([36, 12, 0], P => Q3.crystalLamp(P, 13)); g.sprite([60, 40, 12], P => Q3.wisp(P), -2);
    lvlProps(g, lv, () => g.sprite([88, 14, 0], P => Q3.crystalLamp(P, 13)), () => g.sprite([86, 34, 0], P => Q3.runeStone(P, 12)));
  } },
];

// =================== ИЗВОЗЧИК 3×2 ===================
const STABLE_VARS = [
  { name: 'И1. Конюшня-сарай с воротами, коновязь, телега, кормушка', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW1.rye, P1.tileR);
    const M = { x0: 2, x1: 50, y0: 30, y1: 62, h: 15 };
    box(g, Object.assign({ mat: m1Plank(P1.plank, 4) }, M));
    roof(g, M, { type: 'gable', axis: 'Y', rise: 16, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plank, 4) });
    elem(g, 'S', M.y0, 14, 0, 18, 13, m1Door({ w: 18, h: 13, double: true, col: P1.plank })); g.meta.doorPt = [23, M.y0, 0];
    elem(g, 'S', M.y0, 21, 17, 6, 5, m1Window({ w: 6, h: 5, lit: false }));
    g.sprite([70, 34, 0], P => QW.hitch(P)); g.sprite([66, 33, 0], P => QW.horse(P, 1)); g.meta.horse = [66, 33, 0];
    g.sprite([72, 14, 0], P => QW.cart(P)); g.sprite([90, 46, 0], P => QW.trough(P));
    lvlProps(g, lv, () => g.sprite([92, 26, 0], P => Q2.sacks(P, 3)), () => { g.sprite([84, 34, 0], P => QW.horse(P, -1)); g.sprite([44, 18, 0], P => Q1.lantern(P)); });
  } },
  { name: 'И2. Каретный двор: дом извозчика в углу и длинный навес с телегами', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW_X.rust, P1.tileD);
    const H = { x0: 2, x1: 30, y0: 36, y1: 62, h: 14 };
    box(g, Object.assign({ mat: m1Plaster(P1.plaster, { frame: true, bay: 10, braceOdd: true }) }, H));
    roof(g, H, { type: 'gable', axis: 'Y', rise: 14, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plaster, { frame: true, bay: 8, brace: false }) });
    elem(g, 'S', H.y0, 10, 0, 9, 11, m1Door({ w: 9, h: 11, col: P1.dark })); g.meta.doorPt = [14, H.y0, 0];
    for (const [x, y] of [[36, 40], [64, 40], [92, 40], [36, 60], [92, 60]]) post1(g, x, y, 0, 13, 2, P3.oak);
    roof(g, { x0: 36, x1: 94, y0: 40, y1: 62, h: 13 }, { type: 'lean', down: 'S', rise: 6, ov: 2, mat: R.mat, cut: R.cut, th: R.th });
    g.sprite([52, 52, 0], P => QW.cart(P)); g.sprite([66, 20, 0], P => QW.horse(P, 1)); g.meta.horse = [66, 20, 0];
    lvlProps(g, lv, () => g.sprite([80, 52, 0], P => QW.cart(P)), () => g.sprite([20, 18, 0], P => QW.horn(P)));
  } },
  { name: 'И3. Конюшня с сеновалом под полувальмой, стог, поилка', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW1.wheat, P1.tileR);
    const M = { x0: 2, x1: 54, y0: 32, y1: 62, h: 18 };
    box(g, Object.assign({ mat: (u, v, F) => (v < 8 ? m1Stone(P1.stoneW)(u, v, F) : m1Plank(P1.plank, 4)(u, v, F)) }, M));
    roof(g, M, { type: 'half', axis: 'X', rise: 18, hipL: 10, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plank, 4) });
    elem(g, 'S', M.y0, 6, 0, 14, 12, m1Door({ w: 14, h: 12, double: true, col: P1.plank })); elem(g, 'S', M.y0, 32, 0, 14, 12, m1Door({ w: 14, h: 12, double: true, col: P1.plank })); g.meta.doorPt = [13, M.y0, 0];
    elem(g, 'S', M.y0, 22, 14, 10, 7, m1Door({ w: 10, h: 7, col: P1.plank }));
    g.sprite([76, 46, 0], P => Q1.hay(P, 9)); g.sprite([80, 16, 0], P => QW.trough(P, 16)); g.sprite([66, 22, 0], P => QW.horse(P, 1)); g.meta.horse = [66, 22, 0];
    lvlProps(g, lv, () => g.sprite([92, 30, 0], P => Q1.hay(P, 7)), () => g.sprite([92, 14, 0], P => QW.horse(P, -1)));
  } },
  { name: 'И4. Почтовая станция: вывеска с рожком, двор с двумя телегами и фонарями', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW_X.pale, P1.slate);
    const M = { x0: 2, x1: 40, y0: 36, y1: 62, h: 16 };
    box(g, Object.assign({ mat: m1Stone(P1.stoneW, 6, 4) }, M));
    roof(g, M, { type: 'hip', axis: 'X', rise: 12, hipL: 10, ov: 3, mat: R.mat, cut: R.cut, th: R.th });
    elem(g, 'S', M.y0, 14, 0, 10, 12, m1Door({ w: 10, h: 12, arch: true, col: P3.oak })); g.meta.doorPt = [19, M.y0, 0];
    for (const x of [4, 30]) elem(g, 'S', M.y0, x, 4, 7, 7, m1Window({ w: 7, h: 7 }));
    g.sprite([44, 30, 0], P => QW.horn(P)); g.sprite([62, 44, 0], P => QW.cart(P)); g.sprite([62, 20, 0], P => QW.cart(P));
    g.sprite([84, 30, 0], P => QW.horse(P, -1)); g.meta.horse = [84, 30, 0];
    paveSand(g, 44, 94, 8, 56);
    lvlProps(g, lv, () => { g.sprite([46, 10, 0], P => Q1.streetLamp(P, 13)); g.sprite([94, 10, 0], P => Q1.streetLamp(P, 13)); }, () => g.sprite([92, 52, 0], P => Q2.crates(P)));
  } },
];

// =================== ТОРГОВЫЙ ПОСТ 3×3 ===================
const TRADE_VARS = [
  { name: 'Т1. Лавка в углу и рыночная площадь с прилавками под полосатыми тентами', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW1.olive, P1.tileR);
    const M = { x0: 2, x1: 38, y0: 60, y1: 94, h: 16 };
    box(g, Object.assign({ mat: m1Plaster(P1.plaster, { frame: true, bay: 12, braceOdd: true, low: 4 }) }, M));
    roof(g, M, { type: 'gable', axis: 'X', rise: 16, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plaster, { frame: true, bay: 10, brace: false }) });
    elem(g, 'S', M.y0, 14, 0, 10, 12, m1Door({ w: 10, h: 12, col: P1.dark })); g.meta.doorPt = [19, M.y0, 0];
    elem(g, 'S', M.y0, 4, 4, 8, 7, m1Window({ w: 8, h: 7 }));
    paveSand(g, 40, 94, 6, 70);
    g.sprite([54, 40, 0], P => QW.stall(P, P1.red)); g.sprite([80, 40, 0], P => QW.stall(P, P1.scale)); g.meta.stalls = [[54, 36, 0], [80, 36, 0]];
    g.sprite([66, 18, 0], P => Q2.crates(P)); g.sprite([88, 16, 0], P => Q2.barrels(P)); g.sprite([22, 46, 0], P => Q2.scale(P));
    lvlProps(g, lv, () => { g.sprite([54, 62, 0], P => QW.stall(P, P1.grass)); g.meta.stalls.push([54, 58, 0]); }, () => { g.sprite([80, 62, 0], P => QW.stall(P, P1.gold)); g.meta.stalls.push([80, 58, 0]); bunting(g, [40, 70, 16], [94, 70, 16]); });
  } },
  { name: 'Т2. Фахверковая контора со складом-пристройкой, весы, бочки и ящики на пристани товаров', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW_X.rust, P1.slate);
    const M = { x0: 2, x1: 40, y0: 54, y1: 94, h: 20 }, A = { x0: 40, x1: 70, y0: 70, y1: 94, h: 12 };
    box(g, Object.assign({ mat: m1Plaster(P1.plasterC, { frame: true, bay: 12, braceX: true, beam: P3.oak }) }, M));
    roof(g, M, { type: 'gable', axis: 'Y', rise: 20, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plasterC, { frame: true, bay: 10, brace: false, beam: P3.oak }) });
    box(g, Object.assign({ mat: m1Plank(P1.plank, 4) }, A));
    roof(g, A, { type: 'lean', down: 'S', rise: 6, ov: 2, mat: R.mat, cut: R.cut, th: 2 });
    elem(g, 'S', M.y0, 14, 0, 10, 13, m1Door({ w: 10, h: 13, arch: true, col: P3.oak })); g.meta.doorPt = [19, M.y0, 0];
    elem(g, 'S', A.y0, 48, 0, 14, 10, m1Door({ w: 14, h: 10, double: true, col: P1.plank }));
    g.sprite([54, 40, 0], P => Q2.scale(P)); g.sprite([76, 30, 0], P => Q2.barrels(P)); g.sprite([82, 50, 0], P => Q2.crates(P)); g.sprite([30, 26, 0], P => Q2.sacks(P, 4));
    lvlProps(g, lv, () => g.sprite([66, 14, 0], P => QW.cart(P)), () => g.sprite([90, 14, 0], P => QW.stall(P, P1.scale)));
  } },
  { name: 'Т3. Ярмарка: шатёр торговца в углу, палатки и флажки на площади', make(g, lv) {
    g.meta = {};
    g.sprite([22, 80, 0], P => { QW.tent((x, y, c) => P(x * 1.6 | 0, y * 1.6 | 0, c), P1.violet || P1.red); });
    paveSand(g, 34, 94, 6, 70);
    g.sprite([52, 50, 0], P => QW.tent(P, P1.red)); g.sprite([80, 50, 0], P => QW.tent(P, P1.gold)); g.sprite([66, 22, 0], P => QW.stall(P, P1.grass));
    g.meta.doorPt = [22, 66, 0]; g.meta.stalls = [[52, 46, 0], [80, 46, 0], [66, 18, 0]];
    bunting(g, [34, 70, 16], [94, 70, 16]);
    lvlProps(g, lv, () => g.sprite([92, 22, 0], P => QW.stall(P, P1.scale)), () => { g.sprite([40, 22, 0], P => QW.stall(P, P1.red)); bunting(g, [34, 30, 14], [94, 30, 14]); });
  } },
  { name: 'Т4. Волшебная лавка: башенка с витриной кристаллов, вывеска-фонарь, рунный прилавок', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW_H.sage, P1.scale);
    const M = { x0: 2, x1: 34, y0: 62, y1: 94, h: 16 };
    box(g, Object.assign({ mat: m1Plaster(P1.plasterC, { frame: true, bay: 10, braceX: true, beam: P3.oak, low: 4 }) }, M));
    roofSag(g, M, { axis: 'X', rise: 16, sag: 2, flare: 4, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plasterC, { frame: true, bay: 8, brace: false, beam: P3.oak }) });
    cyl(g, 44, 82, 9, 0, 30, m1Stone(P1.stoneW, 5, 3), 20); cone(g, 44, 82, 12, 29, 16, R.mat, R.cut, 20, 2);
    elem(g, 'S', M.y0, 12, 0, 10, 12, m1Door({ w: 10, h: 12, arch: true, col: P3.oak })); g.meta.doorPt = [17, M.y0, 0];
    elem(g, 'S', M.y0, 3, 3, 8, 8, m1Window({ w: 8, h: 8, G: P3.crystal })); elem(g, 'S', 73.4, 41, 14, 6, 8, m1Window({ w: 6, h: 8, arch: true, G: P3.crystal }));
    g.sprite([64, 46, 0], P => { QW.stall(P, P3.violet); for (const x of [-6, -2, 2, 6]) { PR.rect(P, x, -10, x + 1, -7, P3.crystal[x & 1]); } }); g.meta.stalls = [[64, 42, 0]];
    g.sprite([36, 60, 0], P => Q3.crystalLamp(P, 14)); g.sprite([86, 20, 0], P => Q3.runeStone(P, 12)); g.sprite([60, 20, 0], P => QS.rocks(P, 5, P3.crystal));
    lvlProps(g, lv, () => g.sprite([90, 56, 0], P => Q3.shroomPatch(P)), () => { g.sprite([84, 42, 0], P => QW.stall(P, P1.scale)); g.meta.stalls.push([84, 38, 0]); g.sprite([66, 30, 14], P => Q3.wisp(P), -2); });
  } },
];

// =================== ЗАГОН ДЛЯ КОЗ 3×2 ===================
const GOAT_VARS = [
  { name: 'З1. Козлятник-сарайчик в углу, загон оградой, стог и кормушка', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW_X.moss, P1.tileR);
    const M = { x0: 2, x1: 30, y0: 40, y1: 62, h: 11 };
    box(g, Object.assign({ mat: m1Plank(P1.plank, 4) }, M));
    roof(g, M, { type: 'gable', axis: 'X', rise: 10, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plank, 4) });
    elem(g, 'S', M.y0, 10, 0, 9, 9, m1Door({ w: 9, h: 9, col: P1.plank })); g.meta.doorPt = [14, M.y0, 0];
    fence1(g, 34, 94, 6, 6); fence1(g, 94, 94, 6, 60); fence1(g, 34, 34, 6, 30);
    g.sprite([86, 50, 0], P => Q1.hay(P, 8)); g.sprite([48, 14, 0], P => QW.trough(P));
    g.meta.pen = [[40, 10], [90, 56]];
    for (const [x, y, f] of [[56, 32, 1], [72, 22, -1], [78, 40, 1]]) g.sprite([x, y, 0], P => QG(P, f));
    lvlProps(g, lv, () => g.sprite([20, 22, 0], P => QW.bucket(P)), () => g.sprite([12, 18, 0], P => Q1.bench(P, 10)));
  } },
  { name: 'З2. Каменный хлев и горка из валунов — козы лазают по камням', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW_X.pale, P1.slate);
    const M = { x0: 2, x1: 32, y0: 38, y1: 62, h: 12 };
    box(g, Object.assign({ mat: m1Stone(P1.stoneW, 6, 4) }, M));
    roof(g, M, { type: 'hip', axis: 'X', rise: 10, hipL: 8, ov: 3, mat: R.mat, cut: R.cut, th: R.th });
    elem(g, 'S', M.y0, 11, 0, 9, 9, m1Door({ w: 9, h: 9, arch: true, col: P1.plank })); g.meta.doorPt = [15, M.y0, 0];
    boulder(g, 64, 36, 12, 12); boulder(g, 80, 46, 9, 9); boulder(g, 54, 46, 7, 7);
    fence1(g, 36, 94, 4, 4); fence1(g, 94, 94, 4, 60);
    g.sprite([64, 36, 12], P => QG(P, 1), -0.5); g.sprite([80, 22, 0], P => QG(P, -1)); g.sprite([46, 18, 0], P => QW.trough(P));
    g.meta.pen = [[40, 8], [90, 58]];
    lvlProps(g, lv, () => g.sprite([80, 46, 9], P => QG(P, -1), -0.5), () => g.sprite([88, 14, 0], P => Q1.hay(P, 7)));
  } },
  { name: 'З3. Плетёный загон с навесом, доильная скамья, ведро и сыроварня-котёл', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW1.wheat, P1.tileD);
    for (const [x, y] of [[4, 40], [34, 40], [4, 60], [34, 60]]) post1(g, x, y, 0, 11, 2);
    roof(g, { x0: 4, x1: 36, y0: 40, y1: 62, h: 11 }, { type: 'lean', down: 'S', rise: 5, ov: 2, mat: R.mat, cut: R.cut, th: R.th });
    box(g, { x0: 4, x1: 36, y0: 58, y1: 62, h: 9, mat: m1Plank(P1.plank, 3) });
    g.sprite([18, 46, 0], P => Q1.bench(P, 8)); g.sprite([24, 46, 0], P => QW.bucket(P)); g.sprite([12, 20, 0], P => QW.cauldron(P)); g.meta.doorPt = [20, 40, 0];
    g.sprite([66, 34, 0], P => { for (let x = -28; x <= 28; x++) { P(x, -6 + ((x & 3) ? 0 : -1), P1.plank[1]); P(x, -3, P1.plank[2]); if (x % 7 === 0) PR.rect(P, x, -8, x, 0, P3.oak[1]); } }, -0.3);
    for (const [x, y, f] of [[56, 24, 1], [74, 18, -1], [84, 30, 1]]) g.sprite([x, y, 0], P => QG(P, f));
    g.meta.pen = [[40, 8], [92, 30]];
    lvlProps(g, lv, () => g.sprite([90, 50, 0], P => Q1.hay(P, 8)), () => g.sprite([60, 50, 0], P => QG(P, -1, P1.log)));
  } },
  { name: 'З4. Козий домик на сваях с трапом, высокая кормушка, качели-брёвна', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW_X.rust, P1.scale);
    const H = { x0: 4, x1: 26, y0: 40, y1: 60, z0: 8, h: 9 };
    for (const [x, y] of [[5, 41], [23, 41], [5, 57], [23, 57]]) post1(g, x, y, 0, 8, 2, P3.oak);
    box(g, Object.assign({ mat: m1Plank(P1.plank, 3) }, H));
    roof(g, H, { type: 'gable', axis: 'X', rise: 8, ov: 2, ovg: 2, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plank, 3) });
    g.sprite([30, 36, 0], P => { for (let k = 0; k < 8; k++) PR.rect(P, -4 + k, -k - 1, 2 + k, -k - 1, P1.plank[k % 2]); }); g.meta.doorPt = [15, 38, 0];
    g.sprite([60, 44, 0], P => { PR.rect(P, -1, -14, 1, 0, P3.oak[1]); PR.rect(P, -8, -16, 8, -12, P1.plank[2]); PR.rect(P, -7, -17, 7, -16, P1.straw[1]); });
    g.sprite([80, 24, 0], P => { PR.line(P, -12, 0, 12, -4, P1.log[1], 3); PR.rect(P, -1, -3, 1, 0, P3.oak[2]); });
    fence1(g, 36, 94, 4, 4); fence1(g, 94, 94, 4, 60);
    for (const [x, y, f] of [[50, 26, 1], [72, 40, -1], [15, 50, 1]]) g.sprite([x, y, x < 30 ? 8 : 0], P => QG(P, f), x < 30 ? -0.5 : 0);
    g.meta.pen = [[40, 8], [90, 58]];
    lvlProps(g, lv, () => g.sprite([88, 50, 0], P => Q1.hay(P, 7)), () => g.sprite([44, 14, 0], P => QW.trough(P)));
  } },
];
function QG(P, f, R) { QW.goat(P, f, R); }

BDEFS.well1 = BV(WELL_VARS, 'Колодец: 4 варианта', 2, 2, 54);
BDEFS.inf1 = BV(INF_VARS, 'Лазарет: 4 варианта', 3, 2, 64);
BDEFS.stable1 = BV(STABLE_VARS, 'Извозчик: 4 варианта', 3, 2, 70);
BDEFS.trade1 = BV(TRADE_VARS, 'Торговый пост: 4 варианта', 3, 3, 62);
BDEFS.goat1 = BV(GOAT_VARS, 'Загон для коз: 4 варианта', 3, 2, 50);
