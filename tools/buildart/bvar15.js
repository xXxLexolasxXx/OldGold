'use strict';
// Блок 2 (еда), листы по 4 варианта: ферма 4×3, мельница 2×2, пекарня 2×2, хмельник 3×2, пивоварня 3×2,
// свинарник 4×3, бойня 2×2. Дом в углу, двор с делом, крыша по уровню (своя солома).

const STRAW_F = {
  amber: bramp(['#f0c070', '#d09a48', '#a4722c', '#74501a']),
  dusk: bramp(['#c8b48c', '#a08c66', '#786842', '#524628']),
  sun: bramp(['#f8e488', '#dcc25c', '#b49a3a', '#806c22']),
};
const QF = {
  wheat(P, w = 20, h = 6, ripe = 1) { for (let x = -w / 2; x <= w / 2; x++) { const hh = Math.round(h * (0.7 + 0.3 * bhash(x, 0, 1101)) * ripe); PR.rect(P, x, -hh, x, 0, ripe > 0.7 ? P1.straw[1 + (x & 1)] : P1.grass[1 + (x & 1)]); if (ripe > 0.7 && x % 2 === 0) P(x, -hh - 1, P1.straw[0]); } },
  hops(P, h = 22) { PR.rect(P, 0, -h, 0, 0, P3.oak[1]); for (let y = -h + 2; y < -2; y += 3) { P(-1 + (y & 1) * 2, y, P1.ivy[1]); P(y & 1 ? 1 : -1, y + 1, P1.ivy[2]); if (y % 6 === 0) PR.ell(P, 2, y, 1.4, 1.8, () => P1.grass[0]); } },
  sacksFlour(P) { for (const [x, y] of [[-5, 0], [1, 0], [-2, -5]]) PR.ell(P, x, y - 4, 3.5, 4, (xx, yy, a, b) => (b < -0.7 ? P1.white[2] : P1.white[a > 0.4 ? 1 : 0])); },
  oven(P) { PR.ell(P, 0, -6, 9, 7, (x, y, a, b) => (b > 0.6 ? null : P1.brick[a < -0.2 && b < -0.2 ? 0 : 1 + ((x + y) % 4 === 0 ? 1 : 0)])); PR.ell(P, 0, -3, 3.5, 3, (x, y, a, b) => (b > 0.4 ? null : P1.ink)); PR.ell(P, 0, -2, 2, 1.4, () => P1.red[0]); },
  loaves(P) { PR.rect(P, -9, -6, 9, -5, P1.plank[1]); PR.rect(P, -8, -4, -8, 0, P1.plank[3]); PR.rect(P, 8, -4, 8, 0, P1.plank[3]); for (let k = -6; k <= 6; k += 4) PR.ell(P, k, -8, 1.8, 1.3, (x, y, a, b) => (b < 0 ? P1.log[0] : P1.log[1])); },
  vat(P, r = 7) { PR.ell(P, 0, -r, r, r * 0.45, () => P1.gold[2]); for (let y = -r; y <= 0; y++) for (let x = -r; x <= r; x++) { const t = (x + r) / (2 * r); P(x, y, ((y + r) % 4 === 0) ? P1.iron[1] : P1.plank[t < 0.3 ? 0 : t < 0.7 ? 1 : 2]); } PR.ell(P, 0, -r, r - 1, r * 0.4, (x, y, a, b) => (a * a + b * b > 0.6 ? P1.plank[3] : (x + y) % 3 ? P1.gold[1] : P1.white[0])); },
  pig(P, f = 1) { PR.ell(P, 0, -4, 5, 3, (x, y, a, b) => (b < -0.3 ? bhex('#f4bcb0') : a * f > 0.3 ? bhex('#c88478') : bhex('#e4a094'))); for (const x of [-3, -1, 2, 4]) PR.rect(P, x, -2, x, 0, bhex('#c88478')); PR.rect(P, 4 * f, -6, 6 * f, -4, bhex('#e4a094')); P(6 * f, -5, bhex('#a86058')); P(4 * f, -7, bhex('#c88478')); P(-5 * f, -5, bhex('#c88478')); },
  mud(P, w = 22) { PR.ell(P, 0, -2, w / 2, 4, (x, y, a, b) => (bhash(x, y, 1102) < 0.15 ? bhex('#4e3a28') : bhex('#6a5236'))); },
  hooks(P) { PR.rect(P, -10, -18, 10, -17, P3.oak[1]); PR.rect(P, -10, -18, -10, 0, P3.oak[2]); PR.rect(P, 10, -18, 10, 0, P3.oak[2]); for (const x of [-6, 0, 6]) { PR.rect(P, x, -16, x, -14, P1.iron[1]); PR.ell(P, x, -10, 2, 4, (xx, y, a, b) => (b < -0.3 ? bhex('#c86858') : bhex('#9a3a2a'))); } },
  block(P) { PR.rect(P, -5, -6, 5, 0, P1.log[1]); PR.ell(P, 0, -6, 5, 1.6, () => P1.log[0]); PR.line(P, 2, -8, 6, -12, P1.iron[0]); PR.rect(P, -2, -7, 1, -7, bhex('#9a3a2a')); },
  sausages(P) { PR.rect(P, -9, -16, 9, -15, P3.oak[1]); for (let x = -8; x <= 8; x += 3) PR.ell(P, x, -12, 1.2, 3, () => bhex('#a83a2a')); },
};
function field(g, x0, x1, y0, y1, ripe = 1) {
  box(g, { x0, x1, y0, y1, h: 0.3, mat: m1Flat(bhex('#5a4430')), top: (u, v) => ((v | 0) % 5 < 1 ? bhex('#4e3a28') : bhex('#6a5236')) });
  if (!g.dynPiles) for (let y = y0 + 3; y < y1; y += 5) g.sprite([(x0 + x1) / 2, y, 0.3], P => QF.wheat(P, (x1 - x0) * 0.9, 6, ripe), -0.2);
  (g.meta.fields = g.meta.fields || []).push([[x0, y0], [x1, y1]]);
}
const H = (g, M, mat, R, gab, o = {}) => { box(g, Object.assign({ mat }, M)); (o.sag ? roofSag : roof)(g, M, Object.assign({ type: o.type || 'gable', axis: o.axis || 'X', rise: o.rise || 14, ov: 3, ovg: 3, hipL: o.hipL, mat: R.mat, cut: R.cut, th: R.th, gable: gab }, o.sag ? { sag: 2, flare: 3 } : {})); };
const D = (g, M, x, w = 10, h = 12, col = P1.plank) => { elem(g, 'S', M.y0, x, 0, w, h, m1Door({ w, h, arch: true, col })); g.meta.doorPt = [x + w / 2, M.y0, 0]; };
const Wn = (g, M, x, z = 4, w = 8, h = 7, o = {}) => elem(g, 'S', M.y0, x, z, w, h, m1Window(Object.assign({ w, h }, o)));

// =================== ФЕРМА 4×3 ===================
const FARM_VARS = [
  { name: 'Ф1. Изба в углу, большое поле пшеницы, пугало, стог', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.amber, P1.tileR), M = { x0: 2, x1: 34, y0: 62, y1: 94, h: 14 };
    H(g, M, m1Logs(P1.log), R, m1Plank(P1.plank, 4)); D(g, M, 12); Wn(g, M, 24);
    field(g, 40, 124, 8, lv >= 2 ? 88 : 60); g.sprite([82, 40, 0], P => { PR.rect(P, 0, -16, 0, 0, P3.oak[1]); PR.rect(P, -5, -12, 5, -12, P3.oak[1]); PR.rect(P, -2, -12, 2, -6, P1.red[1]); PR.ell(P, 0, -15, 2.5, 2.5, () => P1.straw[1]); PR.rect(P, -3, -18, 3, -17, P1.straw[3]); });
    g.sprite([14, 40, 0], P => Q1.hay(P, 9)); if (lv >= 3) g.sprite([20, 20, 0], P => QW.cart(P)); } },
  { name: 'Ф2. Амбар с ломаной крышей, грядки полосами, ветряной насос', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.sun, P1.tileD), M = { x0: 2, x1: 40, y0: 56, y1: 94, h: 16 };
    box(g, Object.assign({ mat: m1Plank(P1.red, 4) }, M)); roof(g, M, { type: 'gambrel', axis: 'Y', rise: 22, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.red, 4, false) }); D(g, M, 13, 14, 13);
    field(g, 46, 124, 8, 40); field(g, 46, 124, 48, lv >= 2 ? 90 : 70, 0.5);
    g.sprite([30, 30, 0], P => { PR.rect(P, 0, -26, 0, 0, P3.oak[1]); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; PR.line(P, 0, -26, Math.round(Math.cos(a) * 7), -26 + Math.round(Math.sin(a) * 7), P1.iron[1]); } }); if (lv >= 3) g.sprite([16, 18, 0], P => QW.trough(P)); } },
  { name: 'Ф3. Каменный хутор с двором-каре, огород, куры', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.dusk, P1.slate), M = { x0: 2, x1: 44, y0: 70, y1: 94, h: 14 }, S = { x0: 2, x1: 16, y0: 40, y1: 70, h: 10 };
    H(g, M, m1Stone(P1.stoneW, 6, 4), R, m1Stone(P1.stoneW, 6, 4)); H(g, S, m1Plank(P1.plank, 4), R, m1Plank(P1.plank, 4), { axis: 'Y' }); D(g, M, 18);
    field(g, 52, 124, 8, 86); herbBeds(g, 20, 44, 40, 62); g.sprite([30, 24, 0], P => HQ.hens(P)); g.sprite([12, 20, 0], P => HQ.hens(P)); if (lv >= 3) g.sprite([40, 14, 0], P => Q1.hay(P, 7)); } },
  { name: 'Ф4. Волшебная ферма: домик-гриб, поле с огоньками, рунные столбы-межи', make(g, lv) { g.meta = {};
    cyl(g, 18, 78, 12, 0, 14, m1Plaster(P1.plasterW || P1.plaster), 24); dome(g, 18, 78, 18, 13, 14, lv >= 3 ? matShroom(BP.shroom) : m1Straw3(STRAW_F.sun), m1Flat(BARK[3]), 24, 6, 3);
    elem(g, 'S', 66.4, 13, 0, 10, 11, m1RoundDoor({ w: 10, h: 11 })); g.meta.doorPt = [18, 66, 0];
    field(g, 40, 124, 8, 88); for (const [x, y] of [[40, 8], [124, 8], [40, 88], [124, 88]]) g.sprite([x, y, 0], P => Q3.runeStone(P, 10));
    g.sprite([80, 40, 14], P => Q3.wisp(P), -2); g.sprite([10, 30, 0], P => Q3.crystalLamp(P, 12)); if (lv >= 2) g.sprite([100, 60, 14], P => Q3.wisp(P), -2); } },
];

// =================== МЕЛЬНИЦА 2×2 (крылья рисует игра) ===================
const MILL_VARS = [
  { name: 'М1. Каменная башня-мельница под конусом, мешки муки', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.amber, P1.tileR);
    cyl(g, 30, 40, 13, 0, 40, m1Stone(P1.stoneW, 6, 4), 24); cone(g, 30, 40, 16, 39, 16, R.mat, R.cut, 24, 3);
    elem(g, 'S', 27.4, 25, 0, 10, 12, m1Door({ w: 10, h: 12, arch: true })); g.meta.doorPt = [30, 27, 0]; g.meta.hub = [30, 26, 46];
    g.sprite([50, 18, 0], P => QF.sacksFlour(P)); if (lv >= 2) g.sprite([12, 16, 0], P => QW.cart(P)); } },
  { name: 'М2. Деревянная мельница-козлы на столбах (поворачивается к ветру)', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.dusk, P1.tileD);
    post1(g, 29, 39, 0, 14, 4, P3.oak); const B = { x0: 18, x1: 42, y0: 30, y1: 50, z0: 14, h: 22 };
    box(g, Object.assign({ mat: m1Plank(P1.plank, 4) }, B)); roof(g, B, { type: 'gable', axis: 'Y', rise: 10, ov: 2, ovg: 2, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plank, 4) });
    g.sprite([30, 22, 0], P => { for (let k = 0; k < 10; k++) PR.rect(P, -3, -k * 2 - 1, 3, -k * 2 - 1, P1.plank[k % 2]); }); g.meta.doorPt = [30, 22, 0]; g.meta.hub = [30, 29, 30];
    g.sprite([50, 16, 0], P => QF.sacksFlour(P)); } },
  { name: 'М3. Белёная мельница с галереей вокруг и каменным амбаром', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.sun, P1.slate);
    cyl(g, 24, 42, 12, 0, 42, m1Plaster(P1.plasterW || P1.plaster, { low: 6, stoneR: P1.stoneW }), 24); cone(g, 24, 42, 15, 41, 14, R.mat, R.cut, 24, 3);
    beam1(g, 10, 38, 28, 30, 18, 1.2, P1.plank); g.meta.doorPt = [24, 30, 0]; elem(g, 'S', 30.4, 19, 0, 10, 12, m1Door({ w: 10, h: 12, arch: true })); g.meta.hub = [24, 29, 48];
    box(g, { x0: 40, x1: 62, y0: 40, y1: 60, h: 10, mat: m1Stone(P1.stoneW, 6, 4) }); roof(g, { x0: 40, x1: 62, y0: 40, y1: 60, h: 10 }, { type: 'gable', axis: 'X', rise: 8, ov: 2, ovg: 2, mat: R.mat, cut: R.cut, th: R.th }); g.sprite([50, 30, 0], P => QF.sacksFlour(P)); } },
  { name: 'М4. Водяная мельница: сруб у ручья с колесом и жёлобом', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.amber, P1.tileR), M = { x0: 4, x1: 36, y0: 30, y1: 58, h: 16 };
    H(g, M, m1Logs(P1.log), R, m1Plank(P1.plank, 4), { axis: 'Y', rise: 14 }); D(g, M, 13);
    g.sprite([44, 44, 0], P => QS.wheel(P, 13)); g.sprite([44, 22, 0], P => QS.water(P, 22)); g.sprite([18, 14, 0], P => QF.sacksFlour(P)); g.meta.wheel = [44, 44, 0]; } },
];

// =================== ПЕКАРНЯ 2×2 ===================
const BAKE_VARS = [
  { name: 'П1. Фахверковый домик с печью-куполом во дворе и столом с хлебами', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.sun, P1.tileR), M = { x0: 2, x1: 32, y0: 36, y1: 60, h: 14 };
    H(g, M, m1Plaster(P1.plaster, { frame: true, bay: 10, braceOdd: true, low: 4 }), R, m1Plaster(P1.plaster, { frame: true, bay: 8, brace: false })); D(g, M, 10); chimney1(g, 6, 50, M.h + 8, 8, { brick: true, w: 4, d: 4 });
    g.sprite([48, 34, 0], P => QF.oven(P)); g.meta.oven = [48, 31, 0]; g.sprite([30, 16, 0], P => QF.loaves(P)); if (lv >= 2) g.sprite([54, 14, 0], P => QF.sacksFlour(P)); } },
  { name: 'П2. Кирпичная пекарня с большой трубой, прилавок с караваями', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.dusk, P1.slate), M = { x0: 2, x1: 36, y0: 38, y1: 60, h: 15 };
    H(g, M, m1Brick(P1.brick), R, m1Brick(P1.brick), { type: 'hip', hipL: 10 }); D(g, M, 18); Wn(g, M, 4, 4, 9, 7); chimney1(g, 8, 46, M.h + 10, 16, { brick: true, w: 6, d: 6 });
    g.sprite([46, 30, 0], P => QW.stall(P, P1.gold)); g.sprite([18, 16, 0], P => QF.loaves(P)); } },
  { name: 'П3. Домик-каравай: круглый под соломой, печь сбоку, мешки муки', make(g, lv) { g.meta = {};
    cyl(g, 22, 44, 14, 0, 12, m1Plaster(P1.plaster), 24); dome(g, 22, 44, 18, 11, 12, m1Straw3(STRAW_F.amber), m1StrawCut(STRAW_F.amber), 24, 5, 3);
    elem(g, 'S', 30.6, 17, 0, 10, 10, m1RoundDoor({ w: 10, h: 10 })); g.meta.doorPt = [22, 30, 0];
    g.sprite([50, 40, 0], P => QF.oven(P)); g.meta.oven = [50, 37, 0]; g.sprite([48, 16, 0], P => QF.sacksFlour(P)); g.sprite([22, 14, 0], P => QF.loaves(P)); } },
  { name: 'П4. Каменная пекарня в скале с печью внутри (огонь в проёме), полки хлеба', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.sun, P1.tileD), M = { x0: 2, x1: 38, y0: 40, y1: 62, h: 14 };
    boulder(g, 50, 54, 10, 12); H(g, M, m1Stone(P1.stoneW, 6, 4), R, m1Stone(P1.stoneW, 6, 4)); D(g, M, 6);
    elem(g, 'S', M.y0, 22, 2, 10, 8, (u, v) => (v > 6 || u < 1 || u > 8 ? P1.brick[2] : v < 3 ? P1.red[0] : P1.ink)); g.meta.oven = [27, M.y0, 4];
    g.sprite([30, 20, 0], P => QF.loaves(P)); g.sprite([52, 22, 0], P => Q1.logs(P)); } },
];

// =================== ХМЕЛЬНИК 3×2 ===================
const HOP_VARS = [
  { name: 'Х1. Сушильня в углу и шпалеры хмеля рядами', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.dusk, P1.tileR), M = { x0: 2, x1: 28, y0: 40, y1: 62, h: 14 };
    H(g, M, m1Plank(P1.plank, 4), R, m1Plank(P1.plank, 4), { axis: 'Y', rise: 18 }); D(g, M, 8);
    for (let x = 40; x <= 90; x += 10) for (let y = 14; y <= (lv >= 2 ? 54 : 34); y += 20) g.sprite([x, y, 0], P => QF.hops(P)); } },
  { name: 'Х2. Хмелесушилка-башенка с конусом-вытяжкой (oast), шпалеры', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.amber, P1.tileD);
    cyl(g, 16, 46, 11, 0, 20, m1Brick(P1.brick), 20); cone(g, 16, 46, 13, 19, 18, R.mat, R.cut, 20, 2);
    elem(g, 'S', 35.6, 11, 0, 9, 11, m1Door({ w: 9, h: 11, col: P1.plank })); g.meta.doorPt = [16, 35, 0];
    for (let x = 40; x <= 90; x += 10) for (let y = 14; y <= 54; y += 20) g.sprite([x, y, 0], P => QF.hops(P)); } },
  { name: 'Х3. Длинный сарай-сушильня с открытой стороной и корзинами шишек', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.sun, P1.slate);
    for (const [x, y] of [[2, 40], [34, 40], [2, 60], [34, 60]]) post1(g, x, y, 0, 12, 2, P3.oak); roof(g, { x0: 2, x1: 36, y0: 40, y1: 62, h: 12 }, { type: 'gable', axis: 'X', rise: 9, ov: 2, ovg: 2, mat: R.mat, cut: R.cut, th: R.th });
    g.sprite([18, 50, 0], P => QW.rack(P)); g.meta.doorPt = [18, 40, 0]; for (let x = 46; x <= 90; x += 11) for (let y = 14; y <= 44; y += 15) g.sprite([x, y, 0], P => QF.hops(P, 18)); } },
  { name: 'Х4. Зелёный домик в углу, хмель вьётся по беседке-арке, бочка', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_X.moss, P1.tileR), M = { x0: 2, x1: 30, y0: 42, y1: 62, h: 13 };
    H(g, M, m1Plaster(P1.plasterC, { frame: true, bay: 10, beam: P3.oak }), R, m1Plaster(P1.plasterC), { sag: true }); D(g, M, 10);
    for (const x of [40, 60, 80]) { g.sprite([x, 30, 0], P => QF.hops(P, 24)); g.sprite([x + 10, 30, 0], P => QF.hops(P, 24)); } g.sprite([20, 20, 0], P => Q1.barrel(P)); } },
];

// =================== ПИВОВАРНЯ 3×2 ===================
const BREW_VARS = [
  { name: 'Б1. Каменная пивоварня в углу, во дворе чаны с суслом и бочки', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.amber, P1.tileR), M = { x0: 2, x1: 36, y0: 36, y1: 62, h: 16 };
    H(g, M, m1Stone(P1.stoneW, 6, 4), R, m1Stone(P1.stoneW, 6, 4)); D(g, M, 13); chimney1(g, 6, 50, M.h + 8, 12, { brick: true, w: 5, d: 5 });
    g.sprite([52, 30, 0], P => QF.vat(P)); g.sprite([74, 30, 0], P => QF.vat(P)); g.sprite([88, 52, 0], P => Q2.barrels(P)); g.meta.vats = [[52, 30, 0], [74, 30, 0]]; } },
  { name: 'Б2. Фахверк с медным котлом под навесом и пирамидой бочек', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.dusk, P1.tileD), M = { x0: 2, x1: 34, y0: 38, y1: 62, h: 15 };
    H(g, M, m1Plaster(P1.plaster, { frame: true, bay: 10, braceX: true }), R, m1Plaster(P1.plaster), { axis: 'Y', rise: 16 }); D(g, M, 11);
    for (const [x, y] of [[44, 16], [70, 16], [44, 40], [70, 40]]) post1(g, x, y, 0, 12, 2); roof(g, { x0: 44, x1: 72, y0: 16, y1: 42, h: 12 }, { type: 'lean', down: 'S', rise: 4, ov: 2, mat: R.mat, cut: R.cut, th: 2 });
    g.sprite([58, 30, 0], P => QI.cauldron(P)); g.sprite([86, 46, 0], P => Y1.kegs(P)); } },
  { name: 'Б3. Пивоварня-погреб: домик над подвалом, бочки скатывают по пандусу', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.sun, P1.slate), M = { x0: 2, x1: 34, y0: 40, y1: 62, h: 14 };
    H(g, M, m1Logs(P1.logD || P1.log), R, m1Plank(P1.plank, 4)); D(g, M, 12);
    box(g, { x0: 40, x1: 60, y0: 34, y1: 48, h: 4, mat: m1Stone(P1.stone, 5, 3), top: m1Flat(P1.ink) }); g.sprite([66, 30, 0], P => Q2.barrels(P)); g.sprite([84, 18, 0], P => Q2.barrels(P)); } },
  { name: 'Б4. Пивной сад: маленькая пивоварня, хмелевая арка, столы', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_X.rust, P1.tileR), M = { x0: 2, x1: 28, y0: 42, y1: 62, h: 13 };
    H(g, M, m1Brick(P1.brick), R, m1Brick(P1.brick)); D(g, M, 9); g.sprite([40, 40, 0], P => QF.vat(P));
    for (const x of [56, 80]) g.sprite([x, 20, 0], P => Q1.table(P, 14)); g.sprite([68, 44, 0], P => QF.hops(P, 24)); g.sprite([90, 44, 0], P => QF.hops(P, 24)); } },
];

// =================== СВИНАРНИК 4×3 ===================
const SWINE_VARS = [
  { name: 'С1. Сарай в углу, большой загон с лужей, корыто', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.dusk, P1.tileR), M = { x0: 2, x1: 34, y0: 62, y1: 94, h: 13 };
    H(g, M, m1Plank(P1.plank, 4), R, m1Plank(P1.plank, 4)); D(g, M, 12); fence1(g, 40, 124, 8, 8); fence1(g, 124, 124, 8, 88); fence1(g, 40, 40, 8, 88); fence1(g, 40, 124, 88, 88);
    g.sprite([80, 50, 0.2], P => QF.mud(P, 30)); g.sprite([60, 20, 0], P => QW.trough(P, 16)); for (const [x, y, f] of [[70, 40, 1], [92, 60, -1], [100, 30, 1]]) g.sprite([x, y, 0], P => QF.pig(P, f)); g.meta.pen = [[44, 12], [120, 84]]; } },
  { name: 'С2. Каменный хлев с загонами-отсеками и кормушками', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.sun, P1.slate), M = { x0: 2, x1: 50, y0: 66, y1: 94, h: 13 };
    H(g, M, m1Stone(P1.stoneW, 6, 4), R, m1Stone(P1.stoneW, 6, 4)); D(g, M, 20);
    for (const x of [40, 82, 124]) fence1(g, x, x, 8, 60); fence1(g, 40, 124, 8, 8); fence1(g, 40, 124, 60, 60);
    for (const [x, f] of [[60, 1], [100, -1]]) { g.sprite([x, 34, 0], P => QF.pig(P, f)); g.sprite([x, 14, 0], P => QW.trough(P)); } g.meta.pen = [[44, 12], [120, 56]]; } },
  { name: 'С3. Свиной хутор: изба, дубовая роща (жёлуди), грязевая лужа', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.amber, P1.tileD), M = { x0: 2, x1: 36, y0: 64, y1: 94, h: 14 };
    H(g, M, m1Logs(P1.log), R, m1Plank(P1.plank, 4), { sag: true }); D(g, M, 12);
    for (const [x, y] of [[100, 70], [116, 40]]) g.sprite([x, y, 0], P => Q1.tree(P, 14)); g.sprite([70, 40, 0.2], P => QF.mud(P, 26)); fence1(g, 40, 124, 6, 6);
    for (const [x, y, f] of [[60, 30, 1], [82, 50, -1], [96, 20, 1]]) g.sprite([x, y, 0], P => QF.pig(P, f)); g.meta.pen = [[44, 10], [120, 84]]; } },
  { name: 'С4. Свинарник на сваях над лужей, трап, коптильня рядом', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_X.rust, P1.tileR), Hs = { x0: 4, x1: 34, y0: 64, y1: 90, z0: 8, h: 10 };
    for (const [x, y] of [[5, 65], [31, 65], [5, 87], [31, 87]]) post1(g, x, y, 0, 8, 2, P3.oak); box(g, Object.assign({ mat: m1Plank(P1.plank, 3) }, Hs)); roof(g, Hs, { type: 'gable', axis: 'X', rise: 9, ov: 2, ovg: 2, mat: R.mat, cut: R.cut, th: R.th });
    g.sprite([18, 70, 0.2], P => QF.mud(P, 22)); g.sprite([38, 60, 0], P => { for (let k = 0; k < 8; k++) PR.rect(P, -4 + k, -k - 1, 2 + k, -k - 1, P1.plank[k % 2]); }); g.meta.doorPt = [19, 62, 0];
    fence1(g, 44, 124, 6, 6); fence1(g, 124, 124, 6, 70); for (const [x, y, f] of [[70, 30, 1], [96, 44, -1]]) g.sprite([x, y, 0], P => QF.pig(P, f)); g.meta.pen = [[48, 10], [120, 66]]; } },
];

// =================== БОЙНЯ 2×2 ===================
const BUTCH_VARS = [
  { name: 'Мя1. Каменная лавка с навесом, крюки с окороками, колода', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.dusk, P1.tileR), M = { x0: 2, x1: 34, y0: 38, y1: 60, h: 14 };
    H(g, M, m1Stone(P1.stoneW, 6, 4), R, m1Stone(P1.stoneW, 6, 4)); D(g, M, 12); g.sprite([48, 30, 0], P => QF.hooks(P)); g.sprite([30, 18, 0], P => QF.block(P)); } },
  { name: 'Мя2. Коптильня-башенка с дымом и колбасами под навесом', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.amber, P1.tileD);
    box(g, { x0: 4, x1: 22, y0: 40, y1: 58, h: 24, mat: m1Brick(P1.brick) }); roof(g, { x0: 4, x1: 22, y0: 40, y1: 58, h: 24 }, { type: 'pyr', axis: 'X', rise: 10, ov: 2, mat: R.mat, cut: R.cut, th: R.th }); g.meta.doorPt = [13, 40, 0]; elem(g, 'S', 40, 8, 0, 9, 11, m1Door({ w: 9, h: 11, col: P1.dark }));
    g.sprite([13, 49, 36], P => Q1.smoke(P), -2); g.sprite([40, 30, 0], P => QF.sausages(P)); g.sprite([46, 14, 0], P => QF.block(P)); } },
  { name: 'Мя3. Фахверковая мясная лавка с прилавком и вывеской-окороком', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.sun, P1.slate), M = { x0: 2, x1: 32, y0: 36, y1: 60, h: 16 };
    H(g, M, m1Plaster(P1.plaster, { frame: true, bay: 10, braceOdd: true, low: 4 }), R, m1Plaster(P1.plaster), { axis: 'Y', rise: 16 }); D(g, M, 11);
    g.sprite([46, 26, 0], P => QW.stall(P, P1.red)); g.sprite([16, 18, 0], P => QF.block(P)); g.sprite([50, 46, 0], P => QF.hooks(P)); } },
  { name: 'Мя4. Ледник-погреб в холме и разделочный навес', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_X.rust, P1.tileR);
    dome(g, 20, 48, 16, 0, 12, (u, v, F) => P1.grass[bcl(L1(F) + (bhash(u, v, 1103) < 0.3 ? 0 : 1), 2)], m1Flat(bhex('#4e6a2e')), 20, 5, 0.5);
    box(g, { x0: 12, x1: 28, y0: 30, y1: 36, h: 9, mat: m1Stone(P1.stoneW, 5, 3), top: m1Flat(P1.grass[1]) }); elem(g, 'S', 30, 16, 0, 8, 8, m1Door({ w: 8, h: 8, col: P1.plankB })); g.meta.doorPt = [20, 30, 0];
    for (const [x, y] of [[38, 16], [58, 16], [38, 34], [58, 34]]) post1(g, x, y, 0, 11, 2); roof(g, { x0: 38, x1: 60, y0: 16, y1: 36, h: 11 }, { type: 'lean', down: 'S', rise: 4, ov: 2, mat: R.mat, cut: R.cut, th: 2 });
    g.sprite([48, 30, 0], P => QF.hooks(P)); g.sprite([48, 20, 0], P => QF.block(P)); } },
];

BDEFS.farm1 = BV(FARM_VARS, 'Ферма', 4, 3, 72);
BDEFS.mill1 = BV(MILL_VARS, 'Мельница (крылья — в игре)', 2, 2, 118);
BDEFS.bake1 = BV(BAKE_VARS, 'Пекарня', 2, 2, 66);
BDEFS.hop1 = BV(HOP_VARS, 'Хмельник', 3, 2, 92);
BDEFS.brew1 = BV(BREW_VARS, 'Пивоварня', 3, 2, 78);
BDEFS.swine1 = BV(SWINE_VARS, 'Свинарник', 4, 3, 56);
BDEFS.butch1 = BV(BUTCH_VARS, 'Бойня', 2, 2, 60);
