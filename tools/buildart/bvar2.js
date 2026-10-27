'use strict';
// Трактир по шести референсам владельца (27.10) + сводный вариант. Шаг пикселя ×4.5 — в полтора раза мельче
// старых зданий (×3). Лот 4×3 = 128×96, дверь на x=80, фасад на юге.
// Размеры текстур здесь в пикселях сетки ×4.5 (1 мировой px = 4.5 px).

const K2 = 1.5;   // множитель относительно текстур, подобранных для ×3
const TAV = {
  tileR: matTile(BP.tileR, 10, 12), tileD: matTile(BP.tileD, 10, 12), tileT: matTile(BP.tile, 10, 12),
  slate: matShingle(BP.slateD, 11, 10), scale: matScale(BP.scale, 11, 12),
  cutR: matFlat(BP.tileR[4]), cutD: matFlat(BP.tileD[4]), cutT: matFlat(BP.tile[4]), cutS: matFlat(BP.slateD[4]), cutB: matFlat(BP.scale[4]),
  frame: (o = {}) => matFrame(BP.plaster, Object.assign({ bay: 48, bw: 5, noLow: true }, o)),
  stone: (R = BP.stoneW) => matStone(R, 18, 12), stoneBig: () => matStone(BP.stone, 26, 16),
  logs: () => matLogs(BP.log, 19), dark: () => matPlank(BP.dark, 14, false), plank: (R = BP.plank) => matPlank(R, 14),
  brick: () => matBrick(BP.brick, 8, 20),
};
const WIN2 = (w, h, o = {}) => matWindow(Object.assign({ w: w * BK, h: h * BK, lit: true }, o));
const DOOR2 = (w, h, o = {}) => matDoor(Object.assign({ w: w * BK, h: h * BK, pw: 8 }, o));
const splitWall = (low, mLow, mHi) => (u, v, F) => (v < low * BK ? mLow(u, v, F) : mHi(u, v, F));
function winBox(g, side, at, a, z, w, h, o = {}) {   // окно с цветочным ящиком под ним
  elem(g, side, at, a, z, w, h, WIN2(w, h, o));
  const pt = side === 'S' ? [a + w / 2, at - 1, z - 1] : [at + 1, a + w / 2, z - 1];
  g.sprite(pt, P => propPlanter(P, Math.round(w * BK * 0.9)), -0.6);
}
function chimneySmoke(g, x, y, z0, h, o = {}) { chimney(g, x, y, z0, h, o); g.sprite([x + (o.w || 6) / 2, y + (o.d || 6) / 2, z0 + h + 2.5], P => propSmoke(P, 60), -3); }
function postsRow(g, list, z0, h, s = 3) { for (const [x, y] of list) post(g, x, y, z0, h, s); }

const TAVERN_VARS = [
  { name: 'Р1 · Тёмная таверна: два этажа, галерея, череп на фронтоне, фонари', make(g) {
    const Lo = { x0: 10, x1: 118, y0: 16, y1: 92, h: 24 }, Up = { x0: 6, x1: 122, y0: 10, y1: 92, z0: 24, h: 24 };
    box(g, Object.assign({ mat: splitWall(7, TAV.stone(BP.stone), TAV.dark()) }, Lo));
    beam(g, 6, 122, 10, 16, 22.5, 1.5, BP.dark);
    box(g, Object.assign({ mat: TAV.dark() }, Up));
    const r = { type: 'gable', axis: 'X', rise: 30, ov: 6, ovg: 8, mat: TAV.slate, cut: TAV.cutS, th: 3, gable: TAV.dark() };
    roof(g, Up, r);
    const rz = roofZX(Up, r);
    // большой фронтон над входом с черепом
    dormer(g, 80, 14, 34, 16, 15, rz, TAV.dark(), TAV.slate, TAV.cutS, { w: 12, h: 9, lit: true });
    elem(g, 'S', 14 - 0.3, 80 - 11, rz(14) + 9.5, 22, 6, spriteMat(22 * BK, 6 * BK, P => propBoard(P, 'skull', 70, 26)));
    chimneySmoke(g, 24, 64, Up.z0 + Up.h, 30, { stone: true, w: 7, d: 7 });
    // галерея второго этажа
    beam(g, 8, 120, 2, 10, 22, 2.5, BP.dark);
    postsRow(g, [[10, 3], [40, 3], [116, 3]], 0, 22);
    railing(g, 9, 119, 3, 3, 24.5, 9, BP.dark);
    postsRow(g, [[10, 3], [60, 3], [116, 3]], 24.5, 23.5, 2.5);
    elem(g, 'S', Lo.y0, 71, 0, 18, 22, DOOR2(18, 22, { arch: true, ring: true, col: BP.dark }));
    for (const x of [20, 44, 98]) elem(g, 'S', Lo.y0, x, 7, 12, 12, WIN2(12, 12));
    for (const x of [16, 40, 64, 100]) elem(g, 'S', Up.y0, x, 30, 11, 11, WIN2(11, 11));
    elem(g, 'E', Lo.x1, 36, 7, 12, 12, WIN2(12, 12)); elem(g, 'E', Lo.x1, 66, 7, 12, 12, WIN2(12, 12)); elem(g, 'E', Up.x1, 50, 30, 11, 11, WIN2(11, 11));
    g.sprite([94, 15, 18], P => propLanternGlow(P)); g.sprite([66, 15, 18], P => propLanternGlow(P));
    g.sprite([124, 10, 32], P => propSign(P, 'lamp', 1, 22, 22));
    g.sprite([2, 2, 0], P => propStreetLamp(P, 54)); g.sprite([126, 4, 0], P => propStreetLamp(P, 54));
    g.sprite([80, 14, 0], P => propSteps(P, 40, 2));
    g.sprite([26, 8, 0], P => propBarrel(P, 12, 32)); g.sprite([40, 6, 0], P => propBarrel(P, 10, 28)); g.sprite([108, 7, 0], P => propBarrel(P, 11, 30));
    g.sprite([122, 70, 0], P => propTree(P, 30, BP.moss));
    g.sprite([80, 14, rz(14) + 14 + 15], P => propPennant(P, 18, BP.purple));
  } },
  { name: 'Р2 · Черепичный с крестовой крышей на каменном подиуме, дым из трубы', make(g) {
    plinth(g, 0, 128, 6, 96, 5, 80, 44);
    const M = { x0: 12, x1: 108, y0: 24, y1: 90, z0: 5, h: 40 }, Wg = { x0: 62, x1: 116, y0: 12, y1: 50, z0: 5, h: 32 };
    const wall = splitWall(16, TAV.stone(), TAV.frame({ mid: true, braceOdd: true }));
    box(g, Object.assign({ mat: wall }, M)); box(g, Object.assign({ mat: wall }, Wg));
    roof(g, M, { type: 'gable', axis: 'Y', rise: 34, ov: 6, ovg: 8, mat: TAV.tileR, cut: TAV.cutR, th: 3, gable: TAV.frame({ brace: false, bay: 30 }) });
    roof(g, Wg, { type: 'gable', axis: 'Y', rise: 24, ov: 5, ovg: 7, mat: TAV.tileR, cut: TAV.cutR, th: 3, gable: TAV.frame({ brace: false, bay: 30 }) });
    chimneySmoke(g, 36, 70, M.z0 + M.h + 6, 36, { stone: true, w: 8, d: 8 });
    elem(g, 'S', Wg.y0, 72, 5, 16, 22, DOOR2(16, 22, { arch: true, ring: true }));
    elem(g, 'S', Wg.y0, 86, 44, 10, 12, WIN2(10, 12, { arch: true }));
    elem(g, 'S', M.y0, 22, 11, 11, 13, WIN2(11, 13)); elem(g, 'S', M.y0, 44, 11, 11, 13, WIN2(11, 13));
    elem(g, 'S', M.y0, 52, 49, 14, 20, WIN2(14, 20, { arch: true }));
    elem(g, 'S', M.y0, 24, 29, 10, 11, WIN2(10, 11));
    elem(g, 'E', Wg.x1, 20, 11, 11, 13, WIN2(11, 13)); elem(g, 'E', M.x1, 60, 11, 11, 13, WIN2(11, 13)); elem(g, 'E', M.x1, 64, 29, 10, 11, WIN2(10, 11));
    g.sprite([118, 12, 34], P => propSign(P, 'mug', 1, 26, 22));
    g.sprite([120, 20, 5], P => propBarrel(P, 12, 32)); g.sprite([124, 40, 5], P => propBarrel(P, 11, 30)); g.sprite([8, 12, 5], P => propBarrel(P, 11, 30));
    g.sprite([100, 11, 24], P => propLanternGlow(P));
    g.sprite([40, 20, 5], P => propCrate(P, 20));
  } },
  { name: 'Р3 · Светлый фахверк, плющ на черепице, вывеска на фронтоне, двор с оградой и деревом', make(g) {
    const M = { x0: 30, x1: 112, y0: 22, y1: 92, h: 32 };
    box(g, Object.assign({ mat: splitWall(9, TAV.stone(), TAV.frame({ bay: 40, mid: true })) }, M));
    const ivy = matIvy(TAV.tileR, [{ u: 150, v: 60, rx: 50, ry: 34 }, { u: 110, v: 120, rx: 30, ry: 26 }, { u: 190, v: 110, rx: 22, ry: 18 }]);
    roof(g, M, { type: 'gable', axis: 'Y', rise: 30, ov: 6, ovg: 8, mat: ivy, cut: TAV.cutR, th: 3, gable: TAV.frame({ brace: false, bay: 36 }) });
    chimneySmoke(g, 96, 64, M.h + 6, 30, { w: 7, d: 7 });
    elem(g, 'S', M.y0, 71, 0, 18, 22, DOOR2(18, 22, { arch: true, knob: true }));
    for (const x of [38, 54] ) elem(g, 'S', M.y0, x, 9, 11, 13, WIN2(11, 13, { sill: true }));
    elem(g, 'S', M.y0, 96, 9, 11, 13, WIN2(11, 13, { sill: true }));
    elem(g, 'E', M.x1, 36, 9, 11, 13, WIN2(11, 13)); elem(g, 'E', M.x1, 66, 9, 11, 13, WIN2(11, 13));
    // полосатый тент над восточным окном
    roof(g, { x0: 112, x1: 114, y0: 30, y1: 54, h: 23 }, { type: 'lean', down: 'E', rise: 6, ov: 2, mat: matAwning(BP.red, BP.white, 12), cut: matFlat(BP.red[2]), th: 1.5 });
    elem(g, 'S', M.y0 - 0.3, 71 - 11, 38, 22, 7, spriteMat(22 * BK, 7 * BK, P => propBoard(P, 'mug', 72, 30)));
    fence(g, 6, 58, 6, 6, 9); fence(g, 100, 126, 6, 6, 9); fence(g, 6, 6, 6, 88, 9); fence(g, 126, 126, 6, 60, 9);
    g.sprite([16, 72, 0], P => propTree(P, 34));
    g.sprite([18, 24, 0], P => propTable(P, 34)); g.sprite([22, 44, 0], P => propBench(P, 26));
    g.sprite([118, 14, 0], P => propBarrel(P, 11, 30)); g.sprite([124, 26, 0], P => propBarrel(P, 10, 26)); g.sprite([116, 36, 0], P => propBarrel(P, 10, 26));
    g.sprite([40, 10, 0], P => propStones(P)); g.sprite([80, 20, 0], P => propSteps(P, 36, 1));
    g.sprite([96, 21, 18], P => propLanternGlow(P));
    g.sprite([60, 20, 0], P => propFlowers(P, 30));
  } },
  { name: 'Р4 · Уютный: терракота, слуховое окно, полосатый навес со столами, огород и подсолнухи', make(g) {
    const M = { x0: 26, x1: 116, y0: 32, y1: 92, h: 38 };
    box(g, Object.assign({ mat: splitWall(10, TAV.stone(), TAV.frame({ bay: 36, mid: true, braceOdd: true })) }, M));
    const r = { type: 'gable', axis: 'X', rise: 28, ov: 6, ovg: 8, mat: TAV.tileT, cut: TAV.cutT, th: 3, gable: TAV.frame({ brace: false, bay: 30 }) };
    roof(g, M, r);
    const rz = roofZX(M, r);
    dormer(g, 52, 28, 26, 14, 12, rz, TAV.frame({ brace: false, bay: 26, bw: 4 }), TAV.tileT, TAV.cutT, { w: 11, h: 10, lit: true });
    chimneySmoke(g, 94, 66, M.h, 34, { w: 8, d: 8 });
    elem(g, 'S', M.y0, 71, 0, 18, 22, DOOR2(18, 22, { arch: true, ring: true }));
    elem(g, 'S', M.y0, 34, 9, 12, 13, WIN2(12, 13, { sill: true })); winBox(g, 'S', M.y0, 96, 9, 12, 13, { sill: true });
    for (const x of [34, 58, 96]) winBox(g, 'S', M.y0, x, 25, 10, 11);
    elem(g, 'E', M.x1, 44, 9, 12, 13, WIN2(12, 13)); elem(g, 'E', M.x1, 72, 25, 10, 11, WIN2(10, 11));
    // полосатый навес на столбах, под ним столы
    postsRow(g, [[28, 8], [68, 8]], 0, 24);
    roof(g, { x0: 28, x1: 70, y0: 10, y1: 32, h: 25 }, { type: 'lean', down: 'S', rise: 7, ov: 3, mat: matAwning(BP.red, BP.white, 14), cut: matFlat(BP.red[2]), th: 2 });
    g.sprite([40, 16, 0], P => propTable(P, 34)); g.sprite([60, 22, 0], P => propBench(P, 24));
    g.sprite([80, 31, 0], P => propSteps(P, 36, 1));
    g.sprite([94, 31, 20], P => propLanternGlow(P));
    g.sprite([10, 20, 0], P => propSunflower(P, 44)); g.sprite([16, 14, 0], P => propSunflower(P, 36)); g.sprite([6, 30, 0], P => propSunflower(P, 40));
    g.sprite([120, 16, 0], P => propHay(P, 18)); g.sprite([120, 44, 0], P => propBarrel(P, 12, 32)); g.sprite([124, 60, 0], P => propBarrel(P, 10, 26)); g.sprite([112, 10, 0], P => propBarrow(P));
    g.sprite([100, 24, 0], P => propPumpkin(P, 8)); g.sprite([108, 28, 0], P => propPumpkin(P, 6));
    g.sprite([14, 50, 0], P => propPlanter(P, 30)); g.sprite([14, 66, 0], P => propPlanter(P, 30));
    g.sprite([120, 80, 0], P => propSack(P, 16, 18));
  } },
  { name: 'Р5 · Каменная башня с пирамидой, деревянный дом под тёмной черепицей, крыльцо с перилами', make(g) {
    const Tw = { x0: 8, x1: 42, y0: 50, y1: 92, h: 58 }, M = { x0: 42, x1: 118, y0: 30, y1: 92, h: 30 };
    box(g, Object.assign({ mat: TAV.stoneBig() }, Tw));
    box(g, Object.assign({ mat: splitWall(10, TAV.stone(BP.stone), TAV.logs()) }, M));
    roof(g, Tw, { type: 'pyr', axis: 'X', rise: 28, ov: 5, mat: TAV.tileD, cut: TAV.cutD, th: 3 });
    roof(g, M, { type: 'gable', axis: 'X', rise: 24, ov: 6, ovg: 7, mat: TAV.tileD, cut: TAV.cutD, th: 3, gable: TAV.plank() });
    chimneySmoke(g, 96, 66, M.h, 28, { stone: true, w: 8, d: 8 });
    elem(g, 'S', Tw.y0, 18, 40, 10, 12, WIN2(10, 12, { arch: true })); elem(g, 'S', Tw.y0, 20, 14, 7, 10, WIN2(7, 10, { arch: true, lit: false }));
    elem(g, 'E', Tw.x1, 66, 40, 10, 12, WIN2(10, 12, { arch: true }));
    elem(g, 'S', M.y0, 71, 0, 18, 22, DOOR2(18, 22, { ring: true, col: BP.plank }));
    roof(g, { x0: 66, x1: 94, y0: 22, y1: 30, h: 23 }, { type: 'lean', down: 'S', rise: 5, ov: 2, mat: TAV.tileD, cut: TAV.cutD, th: 2 });
    postsRow(g, [[67, 22], [91, 22]], 0, 22);
    elem(g, 'S', M.y0, 50, 10, 11, 12, WIN2(11, 12)); elem(g, 'S', M.y0, 100, 10, 11, 12, WIN2(11, 12));
    elem(g, 'E', M.x1, 50, 10, 11, 12, WIN2(11, 12));
    // крыльцо с восточной стороны
    beam(g, 96, 126, 8, 30, 0, 3, BP.plank);
    postsRow(g, [[98, 9], [122, 9], [122, 26]], 3, 22);
    roof(g, { x0: 98, x1: 124, y0: 10, y1: 30, h: 25 }, { type: 'lean', down: 'S', rise: 7, ov: 3, mat: TAV.tileD, cut: TAV.cutD, th: 2 });
    railing(g, 98, 122, 9, 9, 3, 9); railing(g, 124, 124, 9, 28, 3, 9);
    g.sprite([110, 20, 3], P => propBench(P, 24));
    g.sprite([80, 29, 0], P => propSteps(P, 36, 1));
    g.sprite([120, 30, 34], P => propSign(P, 'mug', 1, 26, 22));
    g.sprite([96, 29, 18], P => propLanternGlow(P));
    g.sprite([20, 20, 0], P => propBarrel(P, 12, 32)); g.sprite([34, 16, 0], P => propBarrel(P, 10, 26));
    for (const [x, y] of [[10, 10], [48, 12], [60, 6], [116, 42], [4, 44]]) g.sprite([x, y, 0], P => propFlowers((px, py, c) => P(px, py, BP.grass[1 + (px % 2)]), 14));
    g.sprite([24, 50, 86], P => propPennant(P, 22, BP.red));
  } },
  { name: 'Р6 · Фасадный домик: синяя чешуя, кирпичный низ, цветочные ящики, фонарь-шар; двор впереди', make(g) {
    const M = { x0: 40, x1: 118, y0: 44, y1: 92, h: 36 };
    box(g, Object.assign({ mat: splitWall(16, TAV.brick(), TAV.frame({ bay: 40, mid: true, braceX: true })) }, M));
    roof(g, M, { type: 'gable', axis: 'Y', rise: 36, ov: 6, ovg: 9, mat: TAV.scale, cut: TAV.cutB, th: 3, gable: TAV.frame({ brace: false, bay: 30 }) });
    chimneySmoke(g, 100, 70, M.h + 10, 30, { w: 7, d: 7 });
    elem(g, 'S', M.y0, 71, 0, 18, 24, DOOR2(18, 24, { arch: true, knob: true, col: BP.logD }));
    elem(g, 'S', M.y0, 46, 10, 14, 14, WIN2(14, 14, { lit: false }));
    winBox(g, 'S', M.y0, 70, 42, 18, 16, { lit: false });
    winBox(g, 'S', M.y0, 100, 22, 11, 12, { lit: false });
    elem(g, 'E', M.x1, 56, 10, 14, 14, WIN2(14, 14, { lit: false })); elem(g, 'E', M.x1, 60, 30, 10, 11, WIN2(10, 11));
    g.sprite([120, 44, 30], P => propSign(P, 'lamp', 1, 22, 20));
    g.sprite([80, 43, 0], P => propSteps(P, 34, 2));
    fence(g, 4, 60, 8, 8, 9); fence(g, 100, 126, 8, 8, 9); fence(g, 4, 4, 8, 90, 9);
    for (let k = 0; k < 5; k++) g.sprite([80 + (k % 2 ? 4 : -4), 12 + k * 6, 0], P => propStones(P));
    g.sprite([20, 70, 0], P => propTree(P, 26));
    g.sprite([22, 20, 0], P => propPlanter(P, 34)); g.sprite([30, 36, 0], P => propPlanter(P, 30));
    g.sprite([112, 20, 0], P => propBarrel(P, 11, 30)); g.sprite([122, 30, 0], P => propBarrel(P, 10, 26));
    g.sprite([110, 32, 0], P => propBench(P, 26));
    g.sprite([48, 12, 0], P => propFlowers(P, 30)); g.sprite([104, 12, 0], P => propFlowers(P, 20));
    g.sprite([40, 44, 0], P => propMushroom(P, 7));
  } },
  { name: 'Сводный · Камень + фахверк, крестовая красная черепица с плющом и слуховым окном, галерея, тент, цветы, дым', make(g) {
    const Lo = { x0: 12, x1: 112, y0: 22, y1: 92, h: 20 }, Up = { x0: 8, x1: 116, y0: 18, y1: 92, z0: 20, h: 22 }, Wg = { x0: 84, x1: 124, y0: 10, y1: 56, h: 40 };
    box(g, Object.assign({ mat: TAV.stone() }, Lo));
    beam(g, 8, 116, 18, 22, 18.5, 1.5, BP.plank);
    box(g, Object.assign({ mat: TAV.frame({ bay: 36, mid: true, braceOdd: true }) }, Up));
    box(g, Object.assign({ mat: splitWall(18, TAV.stone(), TAV.frame({ bay: 36, mid: true })) }, Wg));
    const ivy = matIvy(TAV.tileR, [{ u: 90, v: 50, rx: 44, ry: 30 }, { u: 60, v: 110, rx: 26, ry: 22 }]);
    const r = { type: 'gable', axis: 'X', rise: 28, ov: 6, ovg: 8, mat: ivy, cut: TAV.cutR, th: 3, gable: TAV.frame({ brace: false, bay: 30 }) };
    roof(g, Up, r);
    const rz = roofZX(Up, r);
    dormer(g, 40, 14, 22, 12, 10, rz, TAV.frame({ brace: false, bay: 22, bw: 4 }), TAV.tileR, TAV.cutR, { w: 10, h: 9, lit: true });
    roof(g, Wg, { type: 'gable', axis: 'Y', rise: 26, ov: 5, ovg: 7, mat: TAV.tileR, cut: TAV.cutR, th: 3, gable: TAV.frame({ brace: false, bay: 30 }) });
    chimneySmoke(g, 24, 64, Up.z0 + Up.h, 32, { stone: true, w: 8, d: 8 });
    // галерея над входом слева от крыла
    beam(g, 10, 84, 10, 18, 18.5, 2.5, BP.plank);
    postsRow(g, [[12, 11], [48, 11]], 0, 18.5);
    railing(g, 11, 83, 11, 11, 21, 9);
    elem(g, 'S', Lo.y0, 71, 0, 18, 20, DOOR2(18, 20, { arch: true, ring: true }));
    elem(g, 'S', Lo.y0, 24, 6, 12, 12, WIN2(12, 12)); elem(g, 'S', Lo.y0, 48, 6, 12, 12, WIN2(12, 12));
    for (const x of [20, 44, 68]) winBox(g, 'S', Up.y0, x, 25, 11, 11);
    elem(g, 'S', Wg.y0, 90, 8, 12, 13, WIN2(12, 13, { sill: true })); elem(g, 'S', Wg.y0, 92, 27, 10, 11, WIN2(10, 11)); elem(g, 'S', Wg.y0, 100, 46, 9, 12, WIN2(9, 12, { arch: true }));
    elem(g, 'E', Wg.x1, 20, 8, 12, 13, WIN2(12, 13)); elem(g, 'E', Wg.x1, 24, 27, 10, 11, WIN2(10, 11)); elem(g, 'E', Lo.x1, 70, 6, 12, 12, WIN2(12, 12));
    // тент со столами перед галереей
    postsRow(g, [[14, 2], [50, 2]], 0, 20);
    roof(g, { x0: 14, x1: 52, y0: 4, y1: 12, h: 21 }, { type: 'lean', down: 'S', rise: 5, ov: 3, mat: matAwning(BP.red, BP.white, 14), cut: matFlat(BP.red[2]), th: 2 });
    g.sprite([24, 8, 0], P => propTable(P, 32)); g.sprite([44, 10, 0], P => propBench(P, 22));
    g.sprite([126, 10, 34], P => propSign(P, 'mug', 1, 26, 22));
    g.sprite([94, 21, 18], P => propLanternGlow(P)); g.sprite([66, 21, 18], P => propLanternGlow(P));
    g.sprite([80, 21, 0], P => propSteps(P, 36, 2));
    g.sprite([4, 30, 0], P => propBarrel(P, 12, 32)); g.sprite([2, 46, 0], P => propBarrel(P, 10, 26)); g.sprite([70, 6, 0], P => propBarrel(P, 10, 26));
    g.sprite([116, 4, 0], P => propPlanter(P, 26)); g.sprite([4, 70, 0], P => propTree(P, 26));
    g.sprite([100, 8, 0], P => propFlowers(P, 20)); g.sprite([60, 20, 0], P => propStones(P));
    g.sprite([104, 10, 86], P => propPennant(P, 20, BP.red));
  } },
];

BDEFS.tavern = { w: 4, h: 3, top: 86, vars: TAVERN_VARS, title: 'Трактир по референсам (×4.5)', bk: 4.5 };
