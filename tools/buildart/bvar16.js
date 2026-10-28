'use strict';
// Блок 2, вторая итерация по замечаниям владельца:
//  ферма — большое здание, без грядок (поля сажает игрок), пугало; 4 варианта;
//  пекарня — как П1 (солома, голубая окантовка), во всю ширину и в половину глубины, спереди большая печь, пекарь;
//  хмельник — сушильня-башенка + здание на половину участка, без хмеля (его сажают рядом);
//  пивоварня — большое здание с большим медным чаном; 4 варианта;
//  свинарник — здание во всю ширину сзади, спереди загон; 4 варианта;
//  бойня — дом во всю ширину, в половину глубины, на улице стенд с тушами и мясник за колодой; 3 варианта.

const COPPER = bramp(['#ffd2a0', '#e89a5c', '#b8683a', '#7c3e22']);
const BLUE_TRIM = bramp(['#a8c8f0', '#6a98d0', '#4a70a8', '#2e4a78']);
const matCopper = (u, v, F) => { const k = L1(F); let i = k + ((u | 0) % 9 < 1 ? 1 : 0); if (((v | 0) % 7) < 1) i += 1; if (bhash(u, v, 1201) < 0.05) i = 0; return p1(COPPER, i); };
function copperVat(g, cx, cy, r, h) {   // большой медный чан: тело, купол-крышка, труба, обод
  cyl(g, cx, cy, r + 1.5, 0, 3, m1Stone(P1.stone, 4, 3), 20);
  cyl(g, cx, cy, r, 3, 3 + h, matCopper, 24);
  dome(g, cx, cy, r, 3 + h, r * 0.6, matCopper, m1Flat(COPPER[3]), 24, 5, 1.2);
  cyl(g, cx + r * 0.3, cy, 1.4, 3 + h + r * 0.4, 3 + h + r * 0.6 + 10, matCopper, 10);
  box(g, { x0: cx + r * 0.3 - 1, x1: cx + r + 5, y0: cy - 1, y1: cy + 1, z0: 3 + h + r * 0.6 + 8, h: 2, mat: matCopper, top: matCopper });
  g.sprite([cx, cy - r, 3 + h * 0.5], P => { PR.rect(P, -2, -2, 2, 2, P1.iron[1]); P(0, 0, P1.iron[0]); }, -0.6);   // люк
}
const QB = {
  carcassStand(P) {   // перекладина на козлах, туши на крюках
    PR.rect(P, -14, -22, 14, -21, P3.oak[1]); for (const x of [-14, 14]) { PR.line(P, x - 3, 0, x, -22, P3.oak[2]); PR.line(P, x + 3, 0, x, -22, P3.oak[2]); }
    for (const x of [-9, -1, 7]) { PR.rect(P, x, -20, x, -18, P1.iron[1]); PR.ell(P, x, -12, 3, 6, (xx, y, a, b) => (Math.abs(a) < 0.25 ? bhex('#f0d8c8') : b < -0.4 ? bhex('#d47868') : bhex('#a8483a'))); }
  },
  bigOven(P, s = 1) {   // большая печь-купол из кирпича с трубой и устьем
    PR.ell(P, 0, -9 * s, 14 * s, 11 * s, (x, y, a, b) => (b > 0.75 ? null : P1.brick[(a < -0.3 && b < -0.2) ? 0 : (x + y * 2) % 7 === 0 ? 3 : 1 + (a > 0.4 ? 1 : 0)]));
    PR.rect(P, -16 * s, -2, 16 * s, 0, P1.stone[2]);
    PR.ell(P, 0, -5 * s, 5 * s, 5 * s, (x, y, a, b) => (b > 0.5 ? null : a * a + b * b > 0.7 ? P1.stone[1] : P1.ink));
    PR.rect(P, 6 * s, -24 * s, 9 * s, -14 * s, P1.brick[2]); PR.rect(P, 5 * s, -25 * s, 10 * s, -24 * s, P1.stone[1]);
  },
  peel(P) { PR.line(P, 0, 0, 10, -12, P1.plank[1]); PR.ell(P, 11, -13, 3, 1.6, () => P1.plank[0]); },
};

// =================== ФЕРМА: большой дом, без грядок ===================
const FARM2_VARS = [
  { name: 'Ф-1. Большой амбар с ломаной красной крышей, сеновал, пугало у края', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.sun, P1.tileD), M = { x0: 2, x1: 74, y0: 40, y1: 94, h: 20 };
    box(g, Object.assign({ mat: m1Plank(P1.red, 4) }, M)); roof(g, M, { type: 'gambrel', axis: 'Y', rise: 28, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.red, 4, false) });
    elem(g, 'S', M.y0, 26, 0, 22, 18, m1Door({ w: 22, h: 18, double: true, col: P1.plank })); g.meta.doorPt = [37, M.y0, 0]; elem(g, 'S', M.y0, 30, 26, 14, 9, m1Door({ w: 14, h: 9, col: P1.plank }));
    g.sprite([100, 40, 0], P => { PR.rect(P, 0, -16, 0, 0, P3.oak[1]); PR.rect(P, -5, -12, 5, -12, P3.oak[1]); PR.rect(P, -2, -12, 2, -6, P1.red[1]); PR.ell(P, 0, -15, 2.5, 2.5, () => P1.straw[1]); PR.rect(P, -3, -18, 3, -17, P1.straw[3]); });
    g.sprite([96, 70, 0], P => Q1.hay(P, 10)); g.sprite([16, 20, 0], P => QW.cart(P)); if (lv >= 2) g.sprite([112, 76, 0], P => Q1.hay(P, 8)); if (lv >= 3) g.sprite([60, 16, 0], P => QW.trough(P)); } },
  { name: 'Ф-2. Длинный фермерский дом с жилым концом и хлевом под одной крышей', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.amber, P1.tileR), M = { x0: 2, x1: 108, y0: 56, y1: 94, h: 16 };
    box(g, Object.assign({ mat: (u, v, F) => (u < 50 * BK ? m1Plaster(P1.plaster, { frame: true, bay: 12, braceOdd: true, low: 4 })(u, v, F) : m1Plank(P1.plank, 4)(u, v, F)) }, M));
    roofSag(g, M, { axis: 'X', rise: 20, sag: 3, flare: 4, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th + 1, gable: m1Plank(P1.plank, 4) });
    elem(g, 'S', M.y0, 20, 0, 10, 12, m1Door({ w: 10, h: 12, arch: true })); g.meta.doorPt = [25, M.y0, 0]; elem(g, 'S', M.y0, 66, 0, 18, 13, m1Door({ w: 18, h: 13, double: true, col: P1.plank }));
    elem(g, 'S', M.y0, 6, 4, 8, 7, m1Window({ w: 8, h: 7, sill: true })); elem(g, 'S', M.y0, 36, 4, 8, 7, m1Window({ w: 8, h: 7, sill: true }));
    chimney1(g, 10, 76, M.h + 10, 10, { stone: true, w: 5, d: 5 });
    g.sprite([116, 40, 0], P => { PR.rect(P, 0, -16, 0, 0, P3.oak[1]); PR.rect(P, -5, -12, 5, -12, P3.oak[1]); PR.rect(P, -2, -12, 2, -6, P1.scale[1]); PR.ell(P, 0, -15, 2.5, 2.5, () => P1.straw[1]); PR.rect(P, -3, -18, 3, -17, P1.straw[3]); });
    g.sprite([96, 30, 0], P => Q1.hay(P, 9)); g.sprite([40, 30, 0], P => HQ.hens(P)); if (lv >= 2) g.sprite([60, 24, 0], P => QW.cart(P)); if (lv >= 3) g.sprite([12, 30, 0], P => Q1.planter(P, 11)); } },
  { name: 'Ф-3. Каменный хутор: дом и зерновой амбар-башня, пугало', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.dusk, P1.slate), M = { x0: 2, x1: 70, y0: 54, y1: 94, h: 18 };
    box(g, Object.assign({ mat: m1Stone(P1.stoneW, 6, 4) }, M)); roof(g, M, { type: 'gable', axis: 'X', rise: 18, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Stone(P1.stoneW, 6, 4) });
    elem(g, 'S', M.y0, 30, 0, 12, 13, m1Door({ w: 12, h: 13, arch: true })); g.meta.doorPt = [36, M.y0, 0]; for (const x of [8, 52]) elem(g, 'S', M.y0, x, 5, 8, 8, m1Window({ w: 8, h: 8 }));
    cyl(g, 92, 74, 13, 0, 38, m1Plank(P1.plank, 4), 24); cone(g, 92, 74, 16, 37, 14, R.mat, R.cut, 24, 3);
    g.sprite([110, 30, 0], P => { PR.rect(P, 0, -16, 0, 0, P3.oak[1]); PR.rect(P, -5, -12, 5, -12, P3.oak[1]); PR.rect(P, -2, -12, 2, -6, P1.red[1]); PR.ell(P, 0, -15, 2.5, 2.5, () => P1.straw[1]); PR.rect(P, -3, -18, 3, -17, P1.straw[3]); });
    g.sprite([30, 24, 0], P => QF.sacksFlour(P)); if (lv >= 3) g.sprite([60, 20, 0], P => QW.cart(P)); } },
  { name: 'Ф-4. Г-образный фахверковый двор с навесом для инструмента', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_X.moss, P1.tileR), A = { x0: 2, x1: 80, y0: 66, y1: 94, h: 16 }, B = { x0: 2, x1: 30, y0: 30, y1: 66, h: 14 };
    box(g, Object.assign({ mat: m1Plaster(P1.plasterC, { frame: true, bay: 12, braceX: true, beam: P3.oak }) }, A)); box(g, Object.assign({ mat: m1Plank(P1.plank, 4) }, B));
    roof(g, A, { type: 'gable', axis: 'X', rise: 16, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plasterC) }); roof(g, B, { type: 'gable', axis: 'Y', rise: 14, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plank, 4) });
    elem(g, 'S', A.y0, 46, 0, 10, 12, m1Door({ w: 10, h: 12, arch: true })); g.meta.doorPt = [51, A.y0, 0]; elem(g, 'S', B.y0, 8, 0, 14, 11, m1Door({ w: 14, h: 11, double: true, col: P1.plank }));
    for (const [x, y] of [[90, 60], [120, 60], [90, 80], [120, 80]]) post1(g, x, y, 0, 12, 2); roof(g, { x0: 90, x1: 122, y0: 60, y1: 82, h: 12 }, { type: 'lean', down: 'S', rise: 4, ov: 2, mat: R.mat, cut: R.cut, th: 2 });
    g.sprite([106, 70, 0], P => QW.cart(P)); g.sprite([110, 30, 0], P => { PR.rect(P, 0, -16, 0, 0, P3.oak[1]); PR.rect(P, -5, -12, 5, -12, P3.oak[1]); PR.rect(P, -2, -12, 2, -6, P1.red[1]); PR.ell(P, 0, -15, 2.5, 2.5, () => P1.straw[1]); PR.rect(P, -3, -18, 3, -17, P1.straw[3]); });
    g.sprite([60, 30, 0], P => HQ.hens(P)); if (lv >= 2) g.sprite([16, 16, 0], P => Q1.hay(P, 8)); } },
];

// =================== ПЕКАРНЯ 2×2: во всю ширину, в половину глубины, печь спереди ===================
function buildBakery(g, lv) {
  g.meta = {};
  const R = STRS(lv, STRAW_F.sun, P1.tileR), M = { x0: 0, x1: 64, y0: 32, y1: 62, h: 14 };
  box(g, Object.assign({ mat: m1Plaster(P1.plaster, { frame: true, bay: 10, braceOdd: true, low: 4, beam: BLUE_TRIM }) }, M));
  roof(g, M, { type: 'gable', axis: 'X', rise: 15, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plaster, { frame: true, bay: 8, brace: false, beam: BLUE_TRIM }) });
  elem(g, 'S', M.y0, 6, 0, 10, 12, m1Door({ w: 10, h: 12, arch: true, col: BLUE_TRIM })); g.meta.doorPt = [11, M.y0, 0];
  for (const x of [24, 46]) elem(g, 'S', M.y0, x, 4, 9, 7, m1Window({ w: 9, h: 7, sill: true, frameR: BLUE_TRIM }));
  chimney1(g, 52, 50, M.h + 8, 8, { brick: true, w: 4, d: 4 });
  g.sprite([32, 10, 0], P => QB.bigOven(P, lv >= 3 ? 1.15 : 1)); g.meta.oven = [32, 7, 0];   // печь отодвинута от дома
  g.sprite([54, 10, 0], P => QF.loaves(P)); g.sprite([10, 16, 0], P => Q1.logs(P));
  g.meta.baker = [12, 6, 0];   // пекарь сбоку от печи, не заслоняет устье
  if (lv >= 2) {   // ур. 2: стол для теста — подмастерье месит; мешки муки
    g.sprite([60, 26, 0], P => QF.sacksFlour(P));
    box(g, { x0: 42, x1: 54, y0: 20, y1: 26, h: 5, mat: m1Plank(P1.plank, 3), top: (u, v) => (u > 3 && u < 9 && v > 1 && v < 5 ? bhex('#f0e0c0') : P1.plank[0]) }); g.meta.knead = [48, 16, 0];
  }
  if (lv >= 3) { g.sprite([4, 28, 0], P => Q1.planter(P, 9)); g.sprite([58, 2, 0], P => QB.peel(P)); g.meta.buyer = [[60, 2, 0], [54, 6, 0]]; g.meta.cat = [6, 6, 0]; }   // ур. 3: покупатель за хлебом, кот у печного тепла
}

// =================== ХМЕЛЬНИК 3×2: сушильня-башенка + здание на половину, без хмеля ===================
function buildHop(g, lv) {
  g.meta = {};
  const R = STRS(lv, STRAW_F.amber, P1.tileD), M = { x0: 0, x1: 70, y0: 32, y1: 62, h: 15 };
  box(g, Object.assign({ mat: m1Plank(P1.plank, 4) }, M));
  roof(g, M, { type: 'gable', axis: 'X', rise: 15, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plank, 4) });
  elem(g, 'S', M.y0, 30, 0, 14, 12, m1Door({ w: 14, h: 12, double: true, col: P1.plank })); g.meta.doorPt = [37, M.y0, 0];
  elem(g, 'S', M.y0, 6, 4, 8, 7, m1Window({ w: 8, h: 7 })); elem(g, 'S', M.y0, 54, 4, 8, 7, m1Window({ w: 8, h: 7 }));
  cyl(g, 84, 46, 11, 0, 26, m1Brick(P1.brick), 22); cone(g, 84, 46, 13, 25, 20, R.mat, R.cut, 22, 2);
  g.sprite([84, 46, 46], P => { PR.rect(P, -2, -4, 2, 0, P1.white[1]); PR.line(P, 2, -2, 6, -6, P1.white[1]); }, -0.5);   // флюгер-вытяжка
  elem(g, 'S', 35.4, 80, 0, 8, 10, m1Door({ w: 8, h: 10, col: P1.dark }));
  g.sprite([22, 18, 0], P => QW.rack(P)); g.sprite([64, 18, 0], P => Q2.sacks(P, 3)); g.sprite([84, 18, 0], P => Q1.barrel(P));
  g.meta.vent = [84, 46, 50]; g.meta.racks = [[4, 14, 0]];   // дым сушильни; хмелевод развешивает шишки — сбоку от сушилки, не перед ней
  if (lv >= 2) { g.sprite([46, 14, 0], P => QW.rack(P)); g.meta.racks.push([28, 10, 0]); }
  if (lv >= 3) { g.sprite([70, 10, 0], P => QW.cart(P)); g.meta.cart = [70, 10, 0]; }
}

// =================== ПИВОВАРНЯ 3×2: большое здание, большой медный чан ===================
const BREW2_VARS = [
  { name: 'П-1. Каменная пивоварня во всю ширину, медный чан под открытым небом перед ней', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.amber, P1.tileR), M = { x0: 0, x1: 96, y0: 34, y1: 62, h: 16 };
    box(g, Object.assign({ mat: m1Stone(P1.stoneW, 6, 4) }, M)); roof(g, M, { type: 'gable', axis: 'X', rise: 15, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Stone(P1.stoneW, 6, 4) });
    elem(g, 'S', M.y0, 8, 0, 12, 12, m1Door({ w: 12, h: 12, arch: true })); g.meta.doorPt = [14, M.y0, 0]; for (const x of [30, 74]) elem(g, 'S', M.y0, x, 5, 8, 7, m1Window({ w: 8, h: 7 }));
    copperVat(g, 54, 18, 10, 10); g.meta.vat = [54, 18, 26]; g.sprite([80, 14, 0], P => Q2.barrels(P)); g.sprite([24, 16, 0], P => Q1.logs(P)); if (lv >= 3) g.sprite([92, 26, 0], P => Y1.kegs(P)); } },
  { name: 'П-2. Фахверковый цех с высокой башней-варницей, чан виден сквозь большие ворота', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.dusk, P1.tileD), M = { x0: 0, x1: 70, y0: 30, y1: 62, h: 18 };
    box(g, Object.assign({ mat: m1Plaster(P1.plaster, { frame: true, bay: 12, braceX: true, low: 4 }) }, M)); roof(g, M, { type: 'gable', axis: 'X', rise: 16, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plaster) });
    elem(g, 'S', M.y0, 10, 0, 10, 12, m1Door({ w: 10, h: 12, arch: true })); g.meta.doorPt = [15, M.y0, 0];
    box(g, { x0: 70, x1: 96, y0: 30, y1: 62, h: 30, mat: m1Brick(P1.brick) }); roof(g, { x0: 70, x1: 96, y0: 30, y1: 62, h: 30 }, { type: 'pyr', axis: 'X', rise: 12, ov: 2, mat: R.mat, cut: R.cut, th: R.th });
    copperVat(g, 46, 16, 9, 9); g.meta.vat = [46, 16, 22]; g.sprite([80, 14, 0], P => Y1.kegs(P)); if (lv >= 2) g.sprite([20, 16, 0], P => QF.vat(P)); } },
  { name: 'П-3. Пивной дом с медным чаном на каменном постаменте и трубой-змеевиком', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_X.rust, P1.slate), M = { x0: 0, x1: 96, y0: 36, y1: 62, h: 15 };
    box(g, Object.assign({ mat: m1Logs(P1.log) }, M)); roofSag(g, M, { axis: 'X', rise: 14, sag: 2, flare: 3, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th + 1, gable: m1Plank(P1.plank, 4) });
    elem(g, 'S', M.y0, 70, 0, 14, 12, m1Door({ w: 14, h: 12, double: true, col: P1.plank })); g.meta.doorPt = [77, M.y0, 0];
    box(g, { x0: 22, x1: 46, y0: 10, y1: 30, h: 5, mat: m1Stone(P1.stone, 5, 3), top: m1Flat(P1.stone[1]) }); copperVat(g, 34, 20, 10, 8); g.meta.vat = [34, 20, 28];
    g.sprite([54, 24, 0], P => { for (let k = 0; k < 4; k++) PR.ell(P, 0, -4 - k * 4, 5, 1.6, (x, y, a, b) => (b < 0 ? COPPER[1] : COPPER[2])); }); g.sprite([86, 16, 0], P => Q2.barrels(P)); } },
  { name: 'П-4. Волшебная пивоварня: медный чан с бирюзовым паром, руны, хмелевые гирлянды', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_H.sage, P1.scale), M = { x0: 0, x1: 96, y0: 36, y1: 62, h: 16 };
    box(g, Object.assign({ mat: m1Plaster(P1.plasterC, { frame: true, bay: 12, braceX: true, beam: P3.oak }) }, M)); roof(g, M, { type: 'gable', axis: 'X', rise: 15, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plasterC) });
    elem(g, 'S', M.y0, 42, 0, 12, 12, m1Door({ w: 12, h: 12, arch: true, col: P3.oak })); g.meta.doorPt = [48, M.y0, 0]; for (const x of [10, 76]) elem(g, 'S', M.y0, x, 5, 8, 8, m1Window({ w: 8, h: 8, round: true, G: P3.crystal }));
    copperVat(g, 24, 18, 10, 10); g.meta.vat = [24, 18, 26]; g.sprite([24, 18, 34], P => Q3.wisp(P), -2); g.sprite([70, 16, 0], P => Q3.runeStone(P, 11)); g.sprite([86, 22, 0], P => Q3.crystalLamp(P, 13)); } },
];

// =================== СВИНАРНИК 4×3: здание во всю ширину сзади, загон спереди ===================
function swineBase(g, lv, wall, R, gab, o = {}) {
  const M = { x0: 0, x1: 128, y0: 64, y1: 94, h: 13 };
  box(g, Object.assign({ mat: wall }, M)); (o.sag ? roofSag : roof)(g, M, Object.assign({ type: 'gable', axis: 'X', rise: 14, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: gab }, o.sag ? { sag: 3, flare: 4 } : {}));
  elem(g, 'S', M.y0, 8, 0, 10, 11, m1Door({ w: 10, h: 11, col: P1.plank })); g.meta.doorPt = [13, M.y0, 0];
  for (const x of [34, 64, 94]) elem(g, 'S', M.y0, x, 0, 12, 9, (u, v) => (v > 7 || u < 1 || u > 10 ? P1.beam[2] : P1.dark[3]));   // лазы в хлев
  fence1(g, 0, 128, 4, 4); fence1(g, 0, 0, 4, 62); fence1(g, 128, 128, 4, 62);
  g.meta.pen = [[8, 10], [120, 58]];
}
const SWINE2_VARS = [
  { name: 'С-1. Длинный дощатый хлев, загон с лужей и корытами', make(g, lv) { g.meta = {}; swineBase(g, lv, m1Plank(P1.plank, 4), STRS(lv, STRAW_F.dusk, P1.tileR), m1Plank(P1.plank, 4));
    g.sprite([70, 32, 0.2], P => QF.mud(P, 34)); for (const x of [30, 100]) g.sprite([x, 14, 0], P => QW.trough(P, 14)); } },
  { name: 'С-2. Каменный хлев под провисшей соломой, грязь, дубок с желудями', make(g, lv) { g.meta = {}; swineBase(g, lv, m1Stone(P1.stoneW, 6, 4), STRS(lv, STRAW_F.amber, P1.slate), m1Stone(P1.stoneW, 6, 4), { sag: true });
    g.sprite([50, 30, 0.2], P => QF.mud(P, 30)); g.sprite([108, 36, 0], P => Q1.tree(P, 12)); g.sprite([30, 12, 0], P => QW.trough(P, 14)); } },
  { name: 'С-3. Бревенчатый хлев с навесом-кормушкой вдоль фасада', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_X.rust, P1.tileD); swineBase(g, lv, m1Logs(P1.log), R, m1Plank(P1.plank, 4));
    for (const x of [24, 64, 104]) post1(g, x, 52, 0, 10, 2); roof(g, { x0: 20, x1: 108, y0: 52, y1: 64, h: 10 }, { type: 'lean', down: 'S', rise: 3, ov: 2, mat: R.mat, cut: R.cut, th: 2 });
    for (const x of [40, 80]) g.sprite([x, 56, 0], P => QW.trough(P, 18)); g.sprite([66, 24, 0.2], P => QF.mud(P, 28)); } },
  { name: 'С-4. Фахверковый свинарник с поросячьим домиком-будкой в загоне', make(g, lv) { g.meta = {}; swineBase(g, lv, m1Plaster(P1.plaster, { frame: true, bay: 12, braceOdd: true, low: 4 }), STRS(lv, STRAW_F.sun, P1.tileR), m1Plaster(P1.plaster));
    box(g, { x0: 92, x1: 112, y0: 20, y1: 36, h: 7, mat: m1Plank(P1.plank, 3) }); roof(g, { x0: 92, x1: 112, y0: 20, y1: 36, h: 7 }, { type: 'gable', axis: 'X', rise: 5, ov: 2, mat: m1Straw3(STRAW_F.sun), cut: m1StrawCut(STRAW_F.sun), th: 2 });
    g.sprite([46, 28, 0.2], P => QF.mud(P, 28)); g.sprite([24, 12, 0], P => QW.trough(P, 14));
    g.meta.trough = [24, 12, 0]; g.meta.mud = [46, 28, 0];
    if (lv >= 2) { g.sprite([70, 12, 0], P => QW.trough(P, 14)); g.meta.feed = [[13, 62, 0], [24, 16, 0], [70, 16, 0]]; }   // ур. 2: второе корыто, свинопас носит ведро
    if (lv >= 3) { g.sprite([116, 48, 0], P => Q1.tree(P, 10)); g.sprite([102, 36, 7], P => Q1.lantern(P), -0.5); g.meta.lamp = [102, 36, 6]; } } },   // ур. 3: дубок с желудями, фонарь у будки
];

// =================== БОЙНЯ 2×2: дом во всю ширину, в половину глубины; стенд с тушами ===================
const BUTCH2_VARS = [
  { name: 'М-1. Каменная бойня, стенд с тушами и колода мясника перед входом', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.dusk, P1.tileR), M = { x0: 0, x1: 64, y0: 32, y1: 62, h: 14 };
    box(g, Object.assign({ mat: m1Stone(P1.stoneW, 6, 4) }, M)); roof(g, M, { type: 'gable', axis: 'X', rise: 14, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Stone(P1.stoneW, 6, 4) });
    elem(g, 'S', M.y0, 6, 0, 10, 12, m1Door({ w: 10, h: 12, arch: true, col: P1.red })); g.meta.doorPt = [11, M.y0, 0]; elem(g, 'S', M.y0, 46, 4, 9, 7, m1Window({ w: 9, h: 7 }));
    g.sprite([42, 18, 0], P => QB.carcassStand(P)); g.sprite([20, 12, 0], P => QF.block(P)); g.meta.butcher = [26, 12, 0]; if (lv >= 2) g.sprite([56, 6, 0], P => QF.sausages(P)); } },
  { name: 'М-2. Фахверковая мясная лавка с коптильной трубой, туши под навесом', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.amber, P1.tileD), M = { x0: 0, x1: 64, y0: 34, y1: 62, h: 15 };
    box(g, Object.assign({ mat: m1Plaster(P1.plaster, { frame: true, bay: 10, braceOdd: true, low: 4 }) }, M)); roofSag(g, M, { axis: 'X', rise: 14, sag: 2, flare: 3, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plaster) });
    elem(g, 'S', M.y0, 27, 0, 10, 12, m1Door({ w: 10, h: 12, arch: true })); g.meta.doorPt = [32, M.y0, 0]; chimney1(g, 6, 48, M.h + 8, 14, { brick: true, w: 6, d: 6 });
    for (const [x, y] of [[40, 14], [62, 14], [40, 30], [62, 30]]) post1(g, x, y, 0, 12, 2); roof(g, { x0: 40, x1: 64, y0: 14, y1: 32, h: 12 }, { type: 'lean', down: 'S', rise: 4, ov: 2, mat: R.mat, cut: R.cut, th: 2 });
    g.sprite([52, 24, 0], P => QB.carcassStand(P)); g.sprite([18, 14, 0], P => QF.block(P)); g.meta.butcher = [24, 14, 0]; } },
  { name: 'М-3. Бревенчатая бойня с ледником-погребом и прилавком на улице', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_X.rust, P1.slate), M = { x0: 0, x1: 64, y0: 34, y1: 62, h: 14 };
    box(g, Object.assign({ mat: m1Logs(P1.log) }, M)); roof(g, M, { type: 'gable', axis: 'X', rise: 14, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plank, 4) });
    elem(g, 'S', M.y0, 6, 0, 10, 12, m1Door({ w: 10, h: 12, col: P1.dark })); g.meta.doorPt = [11, M.y0, 0]; elem(g, 'S', M.y0, 46, 0, 10, 8, m1Door({ w: 10, h: 8, col: P1.plankB }));
    g.sprite([44, 16, 0], P => QB.carcassStand(P)); g.sprite([20, 22, 0], P => QW.stall(P, P1.red)); g.sprite([20, 8, 0], P => QF.block(P)); g.meta.butcher = [26, 10, 0]; } },
];

BDEFS.farm2 = BV(FARM2_VARS, 'Ферма: 4 варианта (без грядок)', 4, 3, 72);
BDEFS.bake2 = BL(buildBakery, 'Пекарня', 2, 2, 66);
BDEFS.hop2 = BL(buildHop, 'Хмельник', 3, 2, 92);
BDEFS.brew2 = BV(BREW2_VARS, 'Пивоварня: 4 варианта', 3, 2, 78);
BDEFS.swine2 = BV(SWINE2_VARS, 'Свинарник: 4 варианта', 4, 3, 56);
BDEFS.butch2 = BV(BUTCH2_VARS, 'Бойня: 3 варианта', 2, 2, 60);
