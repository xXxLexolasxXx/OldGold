'use strict';
// Варианты стартовых зданий (трактир, школа, склад) в новом пиксельном стиле — гномье фэнтези.
// Локальные координаты модели: лот трактира/склада 128×96, школы 96×96; фасад со входом — y≈0 (юг), дверь на doorX.

const TH = {   // четыре вида соломы: свежая золотая, выгоревшая серая, тёмный камыш, старая с мхом
  gold: { R: BP.straw, mat: matThatch(BP.straw, { course: 17 }), cut: matThatchCut(BP.straw) },
  grey: { R: BP.strawG, mat: matThatch(BP.strawG, { course: 15 }), cut: matThatchCut(BP.strawG) },
  reed: { R: BP.reed, mat: matThatch(BP.reed, { course: 20, fringe: 9 }), cut: matThatchCut(BP.reed) },
  moss: { R: BP.strawM, mat: matThatch(BP.strawM, { course: 16, moss: true }), cut: matThatchCut(BP.strawM) },
};
const WIN = (w, h, o = {}) => matWindow(Object.assign({ w: w * BK, h: h * BK, lit: true }, o));
const DOOR = (w, h, o = {}) => matDoor(Object.assign({ w: w * BK, h: h * BK }, o));
const RDOOR = (w, h, o = {}) => matRoundDoor(Object.assign({ w: w * BK, h: h * BK }, o));
const BLUE = { G: bramp(['#c8f0ff', '#78c8f0', '#3c98d0', '#20629a']) };   // волшебное синее стекло
// окно со ставнями по бокам
function winShut(g, side, at, a, z, w, h, col, o = {}) {
  elem(g, side, at, a, z, w, h, WIN(w, h, o));
  const sw = Math.max(3, w * 0.45);
  elem(g, side, at, a - sw - 0.5, z, sw, h, matShutter(col));
  elem(g, side, at, a + w + 0.5, z, sw, h, matShutter(col));
}
function post(g, x, y, z0, h, s = 3, R = BP.beam) { box(g, { x0: x, x1: x + s, y0: y, y1: y + s, z0, h, mat: (u, v, F) => R[bcl(F.li === 0 ? 0 : F.li === 1 ? 1 : 2, 3)], top: matFlat(R[2]) }); }
function beam(g, x0, x1, y0, y1, z0, h, R = BP.beam) { box(g, { x0, x1, y0, y1, z0, h, mat: (u, v, F) => R[bcl(F.li === 0 ? 0 : 1, 3) + (v < 1 ? 1 : 0)], top: matFlat(R[1]) }); }
function fence(g, x0, x1, y0, y1, h = 7) {
  const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / 10));
  for (let k = 0; k <= n; k++) post(g, x0 + (x1 - x0) * k / n - 1, y0 + (y1 - y0) * k / n - 1, 0, h + (k % 2) * 0.8, 2, BP.plank);
  for (const z of [h - 2, h * 0.45]) {
    if (y0 === y1) beam(g, x0, x1, y0 - 0.5, y0 + 0.5, z, 1.4, BP.plank); else beam(g, x0 - 0.5, x0 + 0.5, y0, y1, z, 1.4, BP.plank);
  }
}
const roofZX = (b, r) => { const ze = b.h + (b.z0 || 0) - (r.drop ?? 1), zr = b.h + (b.z0 || 0) + r.rise, ya = b.y0 - (r.ov ?? 5), ym = (b.y0 + b.y1) / 2; return y => ze + (y - ya) / (ym - ya) * (zr - ze); };
function propBench(P, w = 20) { PR.rect(P, -w / 2, -7, w / 2, -5, BP.plank[1]); PR.rect(P, -w / 2 + 2, -4, -w / 2 + 1, 0, BP.plank[3]); PR.rect(P, w / 2 - 2, -4, w / 2 - 1, 0, BP.plank[3]); PR.rect(P, -w / 2, -8, w / 2, -8, BP.plank[0]); }
function propBellPost(P) { PR.rect(P, 0, -34, 1, 0, BP.beam[1]); PR.rect(P, -8, -34, 9, -33, BP.beam[2]); PR.rect(P, -9, -36, 10, -35, BP.plank[2]); PR.line(P, -6, -33, 1, -26, BP.beam[2]); propBell((x, y, c) => P(x + 5, y - 22, c)); }
function propSundial(P) { PR.ell(P, 0, 0, 9, 9, (x, y, a, b) => (a * a + b * b > 0.78 ? BP.stone[3] : BP.plaster[1])); for (let k = 0; k < 8; k++) { const an = Math.PI + k * Math.PI / 7; P(Math.round(Math.cos(an) * 7), Math.round(Math.sin(an) * 7), BP.stone[4]); } PR.line(P, 0, 0, 0, 6, BP.iron[2]); PR.line(P, 0, 0, 3, 5, BP.iron[1]); }
function propOwl(P) { PR.rect(P, 0, -22, 0, 0, BP.iron[1]); PR.ell(P, 0, -27, 4, 5, (x, y, a, b) => (b < -0.5 ? BP.iron[2] : BP.iron[1])); P(-2, -29, BP.gold[0]); P(1, -29, BP.gold[0]); P(-1, -27, BP.gold[2]); P(-4, -31, BP.iron[2]); P(3, -31, BP.iron[2]); PR.rect(P, -6, -22, 6, -22, BP.iron[2]); }
function mushrooms(g, list) { for (const [x, y, r, R] of list) g.sprite([x, y, 0], P => propMushroom(P, r, R)); }
const matDomeBlue = (u, v, F) => { let i = F.li + (v / F.L > 0.7 ? 1 : 0) + (v / F.L < 0.25 ? -1 : 0); if (((u / 7) | 0) % 2 === 0 && ((u % 7) + 7) % 7 < 1) i += 2; if (bhash(u, v, 33) < 0.04) i += 1; return BP.shroomB[bcl(i)]; };

// =================== ТРАКТИР ===================
const INN_VARS = [
  { name: 'Фахверк с нависающим этажом и провисшей крышей', make(g) {
    const T = TH.gold, Lo = { x0: 12, x1: 116, y0: 16, y1: 92, h: 20 }, Up = { x0: 8, x1: 120, y0: 11, y1: 92, z0: 20, h: 24 };
    box(g, Object.assign({ mat: matStone(BP.stoneW, 13, 8) }, Lo));
    beam(g, 8, 120, 11, 16, 18.5, 1.5, BP.plank);
    for (const x of [14, 40, 66, 92, 112]) post(g, x, 12, 12, 7, 2.5);          // кронштейны под нависанием
    box(g, Object.assign({ mat: matFrame(BP.plaster, { bay: 32, mid: true, bw: 4, noLow: true }) }, Up));
    const r = { axis: 'X', rise: 26, sag: 5, flare: 5, ov: 6, ovg: 8, mat: T.mat, cut: T.cut, th: 4, gable: matPlank(BP.plank, 8) };
    const Z = roofSag(g, Up, r);
    const rz = y => Z.ze(0.5) + (y - (Up.y0 - 6)) / ((Up.y0 + Up.y1) / 2 - (Up.y0 - 6)) * (Z.zr(0.5) - Z.ze(0.5));
    dormer(g, 40, 18, 16, 9, 7, rz, matPlaster(BP.plaster), T.mat, T.cut, { w: 8, h: 6, lit: true });
    dormer(g, 92, 18, 16, 9, 7, rz, matPlaster(BP.plaster), T.mat, T.cut, { w: 8, h: 6, lit: true });
    chimneyCrooked(g, 24, 62, Up.z0 + Up.h, 30, { stone: true, w: 7, d: 7, lean: 3 });
    g.sprite([112, 51.5, Z.zr(0.93)], P => propBigMug(P));
    elem(g, 'S', Lo.y0, 72, 0, 16, 19, DOOR(16, 19, { arch: true, ring: true, pw: 7 }));
    for (const x of [24, 48]) winShut(g, 'S', Lo.y0, x, 6, 10, 10, BP.green, { sill: true });
    for (const x of [22, 50, 96]) winShut(g, 'S', Up.y0, x, 26, 9, 10, BP.green);
    elem(g, 'E', Lo.x1, 40, 6, 10, 10, WIN(10, 10)); elem(g, 'E', Up.x1, 64, 26, 9, 10, WIN(9, 10));
    g.sprite([120, 11, 32], P => propSign(P, 'mug', 1));
    g.sprite([94, 15, 15], P => propLanternGlow(P)); g.sprite([66, 15, 15], P => propLanternGlow(P));
    g.sprite([36, 11, 18.5], P => propBanner(P, BP.red)); g.sprite([104, 11, 18.5], P => propBanner(P, BP.red));
    g.sprite([80, 14, 0], P => propSteps(P, 28, 2));
    g.sprite([20, 6, 0], P => propBarrel(P, 8, 22)); g.sprite([32, 4, 0], P => propBarrel(P, 7, 18));
    mushrooms(g, [[116, 8, 6, BP.shroom], [122, 12, 4, BP.shroom], [10, 20, 5, BP.shroomB], [44, 14, 3, BP.cloth]]);
  } },
  { name: 'Бревенчатый Г-образный с верандой и круглой дверью', make(g) {
    const T = TH.reed, M = { x0: 6, x1: 122, y0: 40, y1: 92, h: 30 }, Wg = { x0: 66, x1: 122, y0: 8, y1: 44, h: 30 };
    const logs = matLogs(BP.log, 13);
    box(g, Object.assign({ mat: logs }, M)); box(g, Object.assign({ mat: logs }, Wg));
    roofSag(g, M, { axis: 'X', rise: 22, sag: 4, flare: 5, ov: 5, ovg: 7, mat: T.mat, cut: T.cut, th: 5, gable: matPlank(BP.plank, 8) });
    roofSag(g, Wg, { axis: 'Y', rise: 24, sag: 3, flare: 6, ov: 5, ovg: 7, mat: T.mat, cut: T.cut, th: 5, gable: matPlank(BP.plank, 8) });
    chimneyCrooked(g, 24, 64, M.h, 26, { stone: true, w: 8, d: 8, lean: -3 });
    elem(g, 'S', Wg.y0, 71, 0, 18, 18, RDOOR(18, 18));
    elem(g, 'S', Wg.y0, 90, 33, 9, 9, WIN(9, 9, { round: true }));
    winShut(g, 'S', Wg.y0, 101, 8, 10, 11, BP.red, { sill: true });
    winShut(g, 'S', M.y0, 16, 9, 11, 10, BP.red); winShut(g, 'S', M.y0, 42, 9, 11, 10, BP.red);
    elem(g, 'E', Wg.x1, 18, 8, 11, 10, WIN(11, 10)); elem(g, 'E', M.x1, 62, 8, 11, 10, WIN(11, 10));
    beam(g, 8, 64, 8, 40, 0, 2.5, BP.plank);
    for (const x of [9, 34, 59]) post(g, x, 9, 2.5, 22, 3);
    roof(g, { x0: 9, x1: 64, y0: 10, y1: 40, h: 25 }, { type: 'lean', down: 'S', rise: 9, ov: 3, mat: T.mat, cut: T.cut, th: 4 });
    g.sprite([36, 22, 2.5], P => propTable(P, 26));
    g.sprite([64, 8, 22], P => propSign(P, 'mug', 1));
    g.sprite([22, 8, 24], P => propBanner(P, BP.green, 9, 16)); g.sprite([47, 8, 24], P => propBanner(P, BP.gold, 9, 16));
    g.sprite([92, 7, 15], P => propLanternGlow(P));
    g.sprite([124, 4, 0], P => propBarrel(P, 8, 22)); g.sprite([112, 2, 0], P => propBarrel(P, 7, 18));
    g.sprite([2, 44, 0], P => propLogs(P, 4, 3));
    mushrooms(g, [[100, 6, 5, BP.shroom], [106, 9, 3, BP.shroom], [4, 36, 6, BP.purple], [124, 30, 4, BP.cloth]]);
  } },
  { name: 'С круглой башней-пивоварней и вымпелом', make(g) {
    const T = TH.gold, M = { x0: 6, x1: 92, y0: 14, y1: 92, h: 30 };
    box(g, Object.assign({ mat: matPlaster(BP.plasterW, { low: 24, stoneR: BP.stoneW }) }, M));
    roofSag(g, M, { axis: 'Y', rise: 26, sag: 4, flare: 5, ov: 5, ovg: 7, mat: T.mat, cut: T.cut, th: 4, gable: matPlank(BP.plank, 9) });
    chimney(g, 36, 60, M.h, 30, { w: 6, d: 6 });
    elem(g, 'S', M.y0, 73, 0, 14, 18, DOOR(14, 18, { arch: true, knob: true }));
    winShut(g, 'S', M.y0, 18, 8, 10, 11, BP.blue, { sill: true }); winShut(g, 'S', M.y0, 44, 8, 10, 11, BP.blue, { sill: true });
    elem(g, 'S', M.y0, 44, 36, 9, 9, WIN(9, 9, { round: true }));
    elem(g, 'E', M.x1, 30, 8, 10, 11, WIN(10, 11));
    const cx = 108, cy = 68, rr = 18;
    cyl(g, cx, cy, rr, 0, 44, matStone(BP.stoneW, 11, 7));
    cone(g, cx, cy, rr + 5, 43, 34, T.mat, T.cut, 28, 4);
    g.sprite([cx, cy, 77], P => propPennant(P, 18, BP.red));
    elem(g, 'S', cy - rr + 1, cx - 4, 24, 8, 10, WIN(8, 10, { arch: true }));
    elem(g, 'S', cy - rr + 1, cx - 3, 8, 6, 7, WIN(6, 7, { lit: false, bars: true }));
    elem(g, 'E', cx + rr - 1, cy - 4, 24, 8, 10, WIN(8, 10, { arch: true }));
    g.sprite([cx + rr, cy - 6, 36], P => propSign(P, 'mug', 1));
    g.sprite([80, 13, 0], P => propSteps(P, 26, 1));
    g.sprite([14, 2, 0], P => propBarrel(P, 9, 24)); g.sprite([30, 4, 0], P => propBarrel(P, 8, 20)); g.sprite([22, 0, 6.5], P => propBarrel(P, 7, 18));
    g.sprite([98, 13, 16], P => propLanternGlow(P));
    g.sprite([30, 13, 0], P => propFlowers(P, 26));
    mushrooms(g, [[96, 48, 6, BP.shroom], [4, 60, 5, BP.shroomB], [60, 12, 3, BP.cloth]]);
  } },
  { name: 'Грибная корчма: круглый дом под шляпкой-мухомором, двор с лавками', make(g) {
    const cx = 76, cy = 58, rr = 30;
    cyl(g, cx, cy, rr, 0, 12, matStone(BP.stoneW, 11, 7), 32);
    cyl(g, cx, cy, rr, 12, 36, matPlaster(BP.plasterW), 32);
    beam(g, cx - rr - 1, cx + rr + 1, cy - 1.5, cy + 1.5, 35, 1.5, BP.plank);
    dome(g, cx, cy, rr + 7, 35, 24, matShroom(BP.shroom), matFlat(BP.shroom[5]), 32, 8, 4);
    chimneyCrooked(g, 60, 72, 48, 22, { stone: true, w: 6, d: 6, lean: 3 });
    elem(g, 'S', cy - rr + 1, 72, 0, 16, 16, RDOOR(16, 16));
    elem(g, 'S', cy - rr + 3, 54, 10, 9, 9, WIN(9, 9, { round: true })); elem(g, 'S', cy - rr + 3, 90, 10, 9, 9, WIN(9, 9, { round: true }));
    elem(g, 'S', cy - rr + 1, 76, 22, 8, 8, WIN(8, 8, { round: true }));
    elem(g, 'E', cx + rr - 2, cy - 5, 12, 9, 9, WIN(9, 9, { round: true }));
    g.sprite([80, cy - rr, 0], P => propSteps(P, 24, 1));
    g.sprite([cx + rr - 1, cy - 12, 30], P => propSign(P, 'mug', 1));
    g.sprite([92, cy - rr + 1, 14], P => propLanternGlow(P));
    // малый гриб-пристройка
    cyl(g, 116, 36, 9, 0, 12, matPlaster(BP.plasterW), 20);
    dome(g, 116, 36, 14, 11, 12, matShroom(BP.shroom), matFlat(BP.shroom[5]), 20, 6, 2);
    elem(g, 'S', 28, 113, 2, 6, 7, WIN(6, 7, { round: true }));
    // двор слева: ограда, столы, бочки
    fence(g, 4, 40, 6, 6); fence(g, 4, 4, 6, 60);
    g.sprite([22, 20, 0], P => propTable(P, 24)); g.sprite([24, 40, 0], P => propTable(P, 24));
    g.sprite([40, 50, 0], P => propBarrel(P, 9, 24)); g.sprite([38, 64, 0], P => propBarrel(P, 8, 22));
    g.sprite([10, 4, 24], P => propPennant(P, 30, BP.gold));
    mushrooms(g, [[10, 70, 7, BP.shroom], [16, 76, 4, BP.shroom], [108, 20, 5, BP.shroomB], [122, 50, 4, BP.purple], [50, 2, 3, BP.cloth]]);
  } },
];

// =================== ШКОЛА ===================
const SCHOOL_VARS = [
  { name: 'С колоколенкой и совой на коньке', make(g) {
    const T = TH.gold, M = { x0: 10, x1: 86, y0: 14, y1: 90, h: 32 };
    box(g, Object.assign({ mat: matFrame(BP.plaster, { low: 28, bay: 28, bw: 3, braceOdd: true, stoneR: BP.stoneW }) }, M));
    const Z = roofSag(g, M, { axis: 'Y', rise: 26, sag: 4, flare: 5, ov: 5, ovg: 7, mat: T.mat, cut: T.cut, th: 4, gable: matFrame(BP.plaster, { bay: 24, bw: 3, noLow: true, brace: false }) });
    chimneyCrooked(g, 18, 62, M.h, 26, { w: 6, d: 6, lean: 2 });
    elem(g, 'S', M.y0, 41, 0, 14, 18, DOOR(14, 18, { arch: true, knob: true }));
    elem(g, 'S', M.y0, 44, 35, 9, 9, WIN(9, 9, { round: true }));
    for (const x of [16, 64]) elem(g, 'S', M.y0, x, 9, 12, 14, WIN(12, 14, { sill: true }));
    elem(g, 'E', M.x1, 26, 9, 12, 14, WIN(12, 14)); elem(g, 'E', M.x1, 56, 9, 12, 14, WIN(12, 14));
    const zr = Z.zr(0.12);
    for (const [x, y] of [[44, 18], [50, 18], [44, 24], [50, 24]]) post(g, x, y, zr - 4, 14, 2.5);
    roof(g, { x0: 43, x1: 53.5, y0: 17, y1: 27.5, h: 0, z0: zr + 10 }, { type: 'pyr', axis: 'X', rise: 8, ov: 3, mat: T.mat, cut: T.cut, th: 2, drop: 0 });
    g.sprite([48.5, 18, zr + 7], P => propBell(P));
    g.sprite([48, 70, Z.zr(0.75)], P => propOwl(P));
    g.sprite([48, 13, 0], P => propSteps(P, 30, 2));
    g.sprite([88, 14, 24], P => propSign(P, 'book', 1));
    g.sprite([30, 14, 30], P => propBanner(P, BP.blue, 9, 16)); g.sprite([66, 14, 30], P => propBanner(P, BP.blue, 9, 16));
    g.sprite([62, 13, 15], P => propLanternGlow(P));
    g.sprite([22, 13, 0], P => propFlowers(P, 20)); g.sprite([64, 13, 0], P => propFlowers(P, 20));
    g.sprite([6, 6, 0], P => propBench(P, 22));
    mushrooms(g, [[90, 8, 5, BP.shroomB], [94, 12, 3, BP.shroomB], [6, 30, 4, BP.cloth]]);
  } },
  { name: 'Кривая башня с совой и низкое крыло', make(g) {
    const T = TH.grey, Wg = { x0: 8, x1: 60, y0: 14, y1: 90, h: 24 }, T1 = { x0: 56, x1: 90, y0: 46, y1: 90, h: 30 }, T2 = { x0: 53, x1: 93, y0: 43, y1: 92, z0: 30, h: 22 };
    box(g, Object.assign({ mat: matPlank(BP.plank, 10) }, Wg));
    box(g, Object.assign({ mat: matStone(BP.stoneW, 12, 8) }, T1));
    beam(g, 53, 93, 43, 92, 29, 1.5, BP.plank);
    box(g, Object.assign({ mat: matFrame(BP.plaster, { bay: 20, bw: 3, noLow: true, braceX: true }) }, T2));
    roofSag(g, Wg, { axis: 'X', rise: 20, sag: 4, flare: 4, ov: 5, ovg: 6, mat: T.mat, cut: T.cut, th: 4, gable: matPlank(BP.plank, 10) });
    cone(g, 73, 67.5, 27, 51, 34, T.mat, T.cut, 28, 4);
    chimneyCrooked(g, 18, 60, Wg.h, 20, { stone: true, w: 7, d: 7, lean: -2 });
    elem(g, 'S', Wg.y0, 40, 0, 16, 16, RDOOR(16, 16));
    winShut(g, 'S', Wg.y0, 16, 7, 10, 10, BP.plankB, { sill: true });
    elem(g, 'S', T1.y0, 69, 12, 8, 11, WIN(8, 11, { arch: true }));
    elem(g, 'S', T2.y0, 68, 36, 10, 10, WIN(10, 10, Object.assign({ round: true }, BLUE)));
    elem(g, 'E', T2.x1, 63, 36, 10, 10, WIN(10, 10, Object.assign({ round: true }, BLUE)));
    elem(g, 'E', T1.x1, 63, 10, 7, 8, WIN(7, 8, { lit: false, bars: true }));
    elem(g, 'E', Wg.x1, 22, 7, 10, 10, WIN(10, 10));
    g.sprite([73, 67.5, 85], P => propOwl(P));
    g.sprite([93, 46, 30], P => propSign(P, 'book', 1));
    g.sprite([48, 13, 0], P => propSteps(P, 26, 1));
    g.sprite([4, 20, 0], P => propLogs(P, 4, 3));
    g.sprite([70, 42, 0], P => propBench(P, 20));
    g.sprite([58, 13, 15], P => propLanternGlow(P));
    g.sprite([30, 13, 0], P => propFlowers(P, 14));
    mushrooms(g, [[94, 30, 6, BP.purple], [90, 36, 3, BP.purple], [6, 8, 4, BP.shroom]]);
  } },
  { name: 'Амбарная с ломаной крышей, телескопом и синим куполом', make(g) {
    const T = TH.gold, M = { x0: 10, x1: 86, y0: 12, y1: 90, h: 26 };
    box(g, Object.assign({ mat: matPlank(BP.plankB, 9) }, M));
    roof(g, M, { type: 'gambrel', axis: 'Y', rise: 32, knee: 0.42, ov: 5, ovg: 6, mat: T.mat, cut: T.cut, th: 4, gable: matPlank(BP.plankB, 9, false) });
    const zr = M.h + 32;
    box(g, { x0: 39, x1: 57, y0: 18, y1: 34, z0: zr - 8, h: 9, mat: matPlank(BP.plank, 8), top: matPlank(BP.plank, 7, false) });
    for (const [x, y] of [[39, 18], [55, 18], [39, 31], [55, 31]]) post(g, x, y, zr + 1, 5, 2, BP.plank);
    beam(g, 39, 57, 18, 19, zr + 5, 1.2, BP.plank); beam(g, 39, 40, 18, 33, zr + 5, 1.2, BP.plank);
    g.sprite([47, 24, zr + 1], P => propTelescope(P));
    dome(g, 48, 70, 11, zr - 2, 10, matDomeBlue, matFlat(BP.shroomB[5]), 20, 5, 2);
    g.sprite([48, 70, zr + 8], P => propPennant(P, 12, BP.gold));
    elem(g, 'S', M.y0, 41, 0, 14, 17, DOOR(14, 17, { col: BP.plank, ring: true }));
    elem(g, 'S', M.y0, 36, 30, 24, 12, WIN(24, 12, { frameR: BP.plank }));
    for (const x of [14, 66]) elem(g, 'S', M.y0, x, 8, 12, 10, WIN(12, 10, { frameR: BP.plank, sill: true }));
    elem(g, 'E', M.x1, 24, 8, 12, 10, WIN(12, 10, { frameR: BP.plank })); elem(g, 'E', M.x1, 56, 8, 12, 10, WIN(12, 10, { frameR: BP.plank }));
    g.sprite([48, 11, 0], P => propSteps(P, 24, 1));
    g.sprite([22, 4, 0], P => propBellPost(P));
    g.sprite([88, 12, 22], P => propSign(P, 'book', 1));
    g.sprite([70, 6, 0], P => propBench(P, 22));
    g.sprite([60, 11, 0], P => propFlowers(P, 18));
    g.sprite([30, 11, 15], P => propLanternGlow(P));
    mushrooms(g, [[90, 60, 5, BP.shroom], [4, 50, 4, BP.shroomB], [8, 56, 3, BP.shroomB]]);
  } },
  { name: 'Каменная с арками, фонарём на крыше и рунными окнами', make(g) {
    const T = TH.reed, M = { x0: 8, x1: 88, y0: 16, y1: 90, h: 34 };
    box(g, Object.assign({ mat: matStone(BP.stoneW, 14, 9) }, M));
    roof(g, M, { type: 'hip', axis: 'X', rise: 20, hipL: 26, ov: 6, mat: T.mat, cut: T.cut, th: 5 });
    const C = { x0: 40, x1: 56, y0: 46, y1: 60, z0: 50, h: 12 };
    box(g, Object.assign({ mat: matPlank(BP.plank, 7) }, C));
    roof(g, C, { type: 'pyr', axis: 'X', rise: 12, ov: 3, mat: T.mat, cut: T.cut, th: 3 });
    g.sprite([48, 53, 73], P => propPennant(P, 12, BP.purple));
    for (const x of [42, 50]) elem(g, 'S', C.y0, x, 53, 5, 7, WIN(5, 7, Object.assign({ arch: true }, BLUE)));
    elem(g, 'E', C.x1, 49, 53, 6, 7, WIN(6, 7, Object.assign({ arch: true }, BLUE)));
    chimneyCrooked(g, 70, 62, M.h, 22, { stone: true, w: 7, d: 7, lean: 2 });
    elem(g, 'S', M.y0, 41, 0, 14, 20, DOOR(14, 20, { arch: true, ring: true }));
    for (const x of [16, 68]) elem(g, 'S', M.y0, x, 9, 12, 16, WIN(12, 16, Object.assign({ arch: true, sill: true }, BLUE)));
    elem(g, 'E', M.x1, 28, 9, 12, 16, WIN(12, 16, Object.assign({ arch: true }, BLUE))); elem(g, 'E', M.x1, 56, 9, 12, 16, WIN(12, 16, Object.assign({ arch: true }, BLUE)));
    g.sprite([48, 15.5, 28], P => propSundial(P), -0.5);
    g.sprite([48, 15, 0], P => propSteps(P, 34, 3));
    g.sprite([90, 16, 26], P => propSign(P, 'book', 1));
    g.sprite([34, 16, 31], P => propBanner(P, BP.purple, 9, 18)); g.sprite([62, 16, 31], P => propBanner(P, BP.purple, 9, 18));
    g.sprite([30, 15, 0], P => propFlowers(P, 14)); g.sprite([66, 15, 0], P => propFlowers(P, 14));
    g.sprite([6, 8, 0], P => propBench(P, 22));
    mushrooms(g, [[92, 40, 6, BP.shroomB], [94, 46, 3, BP.shroomB], [4, 60, 5, BP.purple]]);
  } },
];

// =================== СКЛАД ===================
const STORE_VARS = [
  { name: 'Большой амбар с подъёмником на фронтоне', make(g) {
    const T = TH.reed, M = { x0: 14, x1: 114, y0: 12, y1: 92, h: 40 };
    const wall = (u, v, F) => (v < 24 ? matStone(BP.stone, 12, 8)(u, v, F) : matPlank(BP.plank, 10)(u, v, F));
    box(g, Object.assign({ mat: wall }, M));
    roofSag(g, M, { axis: 'Y', rise: 34, sag: 5, flare: 6, ov: 6, ovg: 9, mat: T.mat, cut: T.cut, th: 5, gable: matPlank(BP.plank, 10) });
    elem(g, 'S', M.y0, 66, 0, 28, 28, DOOR(28, 28, { double: true, ring: true, pw: 7 }));
    elem(g, 'S', M.y0, 72, 44, 16, 14, DOOR(16, 14, { pw: 6 }));
    beam(g, 78, 82, 0, 14, 68, 3);
    g.sprite([80, 1, 55], P => propHoistSack(P));
    for (const x of [26, 46]) elem(g, 'S', M.y0, x, 12, 9, 8, WIN(9, 8, { lit: false, bars: true }));
    elem(g, 'E', M.x1, 40, 12, 9, 8, WIN(9, 8, { lit: false, bars: true })); elem(g, 'E', M.x1, 70, 12, 9, 8, WIN(9, 8, { lit: false, bars: true }));
    for (const y of [32, 78]) post(g, 123, y, 0, 20, 3);
    roof(g, { x0: 114, x1: 124, y0: 30, y1: 82, h: 21 }, { type: 'lean', down: 'E', rise: 7, ov: 3, mat: T.mat, cut: T.cut, th: 4 });
    g.sprite([119, 44, 0], P => propSack(P, 13, 15)); g.sprite([120, 58, 0], P => propSack(P, 12, 14)); g.sprite([119, 70, 0], P => propCrate(P, 14));
    g.sprite([4, 20, 0], P => propCrate(P, 16)); g.sprite([4, 20, 5.3], P => propCrate(P, 14));
    g.sprite([0, 2, 0], P => propCart(P, 34));
    g.sprite([116, 12, 30], P => propSign(P, 'crate', 1));
    g.sprite([104, 10, 0], P => propBarrel(P, 8, 22));
    g.sprite([60, 11, 16], P => propLanternGlow(P));
    g.sprite([56, 12, 36], P => propBanner(P, BP.green, 9, 16));
    mushrooms(g, [[10, 40, 6, BP.shroom], [6, 46, 3, BP.shroom], [122, 20, 4, BP.cloth]]);
  } },
  { name: 'Каменный с двором впереди: тюки, весы, навес', make(g) {
    const T = TH.grey, M = { x0: 20, x1: 100, y0: 46, y1: 92, h: 32 };
    box(g, Object.assign({ mat: matStone(BP.stone, 13, 9) }, M));
    roof(g, M, { type: 'hip', axis: 'X', rise: 20, hipL: 26, ov: 6, mat: T.mat, cut: T.cut, th: 5 });
    elem(g, 'S', M.y0, 68, 0, 24, 22, DOOR(24, 22, { double: true, ring: true, pw: 6 }));
    elem(g, 'S', M.y0, 30, 10, 12, 10, WIN(12, 10, { lit: false, bars: true }));
    elem(g, 'E', M.x1, 60, 10, 12, 10, WIN(12, 10, { lit: false, bars: true }));
    g.sprite([80, 45, 0], P => propSteps(P, 30, 1));
    // двор: ограда с проходом к воротам, навес с весами у восточной стены
    fence(g, 6, 62, 8, 8); fence(g, 98, 124, 8, 8); fence(g, 6, 6, 8, 60); fence(g, 124, 124, 8, 44);
    for (const y of [48, 90]) post(g, 123, y, 0, 21, 3);
    beam(g, 100, 126, 48, 51, 21, 2.5); beam(g, 100, 126, 88, 91, 21, 2.5);
    roof(g, { x0: 100, x1: 124, y0: 48, y1: 90, h: 23 }, { type: 'lean', down: 'E', rise: 9, ov: 3, mat: T.mat, cut: T.cut, th: 4 });
    g.sprite([110, 64, 0], P => propCrate(P, 16)); g.sprite([110, 64, 5.3], P => propCrate(P, 14)); g.sprite([118, 84, 0], P => propSack(P, 13, 15));
    g.sprite([106, 88, 22], P => propScale(P));
    g.sprite([18, 20, 0], P => propCrate(P, 16)); g.sprite([18, 20, 5.3], P => propCrate(P, 15)); g.sprite([18, 20, 10.6], P => propCrate(P, 13));
    g.sprite([40, 16, 0], P => propSack(P, 13, 15)); g.sprite([48, 24, 0], P => propSack(P, 12, 14)); g.sprite([32, 30, 0], P => propBarrel(P, 9, 24)); g.sprite([46, 36, 0], P => propBarrel(P, 8, 22));
    g.sprite([0, 10, 0], P => propCart(P, 30));
    g.sprite([110, 26, 0], P => propLogs(P, 4, 3));
    g.sprite([124, 46, 22], P => propSign(P, 'crate', -1));
    g.sprite([62, 8, 0], P => propPennant(P, 26, BP.gold));
    mushrooms(g, [[12, 50, 6, BP.shroom], [16, 56, 3, BP.shroom], [96, 20, 5, BP.shroomB]]);
  } },
  { name: 'Полувальмовый фахверк с чердачным краном', make(g) {
    const T = TH.gold, M = { x0: 10, x1: 118, y0: 20, y1: 92, h: 44 };
    box(g, Object.assign({ mat: matFrame(BP.plaster, { low: 42, bay: 32, bw: 4, braceX: true, stoneR: BP.stone }) }, M));
    const r = { type: 'half', axis: 'X', rise: 30, hipL: 16, ov: 6, ovg: 6, mat: T.mat, cut: T.cut, th: 5, gable: matPlank(BP.plank, 8) };
    roof(g, M, r);
    const rz = roofZX(M, r);
    dormer(g, 80, 26, 24, 12, 9, rz, matPlank(BP.plank, 8), T.mat, T.cut, null);
    elem(g, 'S', 26, 73, rz(26) - 1, 14, 12, DOOR(14, 12, { pw: 5 }));
    beam(g, 78, 82, 12, 28, rz(26) + 12, 3);
    g.sprite([80, 13, rz(26) - 1.5], P => propHoistSack(P));
    elem(g, 'S', M.y0, 68, 0, 24, 24, DOOR(24, 24, { double: true, ring: true, pw: 6 }));
    for (const x of [20, 44, 100]) winShut(g, 'S', M.y0, x, 16, 10, 10, BP.plankB);
    elem(g, 'S', M.y0, 30, 30, 8, 8, WIN(8, 8, { lit: false })); elem(g, 'S', M.y0, 104, 30, 8, 8, WIN(8, 8, { lit: false }));
    elem(g, 'E', M.x1, 50, 16, 10, 10, WIN(10, 10, { lit: false, bars: true }));
    g.sprite([106, 19, 0], P => propLadder(P, 46));
    g.sprite([6, 12, 0], P => propBarrel(P, 9, 24)); g.sprite([6, 28, 0], P => propBarrel(P, 8, 22)); g.sprite([120, 10, 0], P => propCrate(P, 16));
    g.sprite([120, 20, 32], P => propSign(P, 'crate', 1));
    g.sprite([40, 19, 0], P => propSack(P, 12, 14));
    g.sprite([60, 19, 16], P => propLanternGlow(P));
    g.sprite([56, 20, 40], P => propBanner(P, BP.red, 9, 16)); g.sprite([104, 20, 40], P => propBanner(P, BP.red, 9, 16));
    mushrooms(g, [[4, 40, 6, BP.shroomB], [8, 46, 3, BP.shroomB], [122, 36, 4, BP.shroom]]);
  } },
  { name: 'Двойная крыша «М», бревенчатый, с флюгером', make(g) {
    const T = TH.moss, A = { x0: 6, x1: 64, y0: 14, y1: 92, h: 28 }, B = { x0: 64, x1: 122, y0: 14, y1: 92, h: 28 };
    const logs = matLogs(BP.logD, 13);
    box(g, Object.assign({ mat: logs }, A)); box(g, Object.assign({ mat: logs }, B));
    roofSag(g, A, { axis: 'Y', rise: 22, sag: 4, flare: 5, ov: 4, ovg: 7, mat: T.mat, cut: T.cut, th: 5, gable: matPlank(BP.plank, 9) });
    roofSag(g, B, { axis: 'Y', rise: 22, sag: 4, flare: 5, ov: 4, ovg: 7, mat: T.mat, cut: T.cut, th: 5, gable: matPlank(BP.plank, 9) });
    elem(g, 'S', B.y0, 70, 0, 20, 22, DOOR(20, 22, { double: true, ring: true, pw: 6 }));
    elem(g, 'S', A.y0, 24, 8, 22, 16, DOOR(22, 16, { double: true, pw: 6, mid: true }));
    elem(g, 'S', A.y0, 31, 32, 8, 8, WIN(8, 8, { round: true, lit: false }));
    elem(g, 'S', B.y0, 100, 10, 9, 8, WIN(9, 8, { lit: false, bars: true }));
    elem(g, 'S', B.y0, 89, 32, 8, 8, DOOR(8, 8, { pw: 4 }));
    elem(g, 'E', B.x1, 40, 10, 9, 8, WIN(9, 8, { lit: false, bars: true })); elem(g, 'E', B.x1, 70, 10, 9, 8, WIN(9, 8, { lit: false, bars: true }));
    g.sprite([93, 10, 50], P => propVane(P));
    g.sprite([-4, 2, 0], P => propCart(P, 34));
    g.sprite([126, 12, 0], P => propBarrel(P, 8, 22)); g.sprite([126, 26, 0], P => propBarrel(P, 8, 22)); g.sprite([124, 42, 0], P => propCrate(P, 15));
    g.sprite([124, 14, 28], P => propSign(P, 'crate', 1));
    g.sprite([56, 10, 0], P => propSack(P, 12, 14)); g.sprite([10, 10, 0], P => propLogs(P, 3, 2));
    g.sprite([60, 13, 16], P => propLanternGlow(P));
    mushrooms(g, [[2, 30, 6, BP.shroom], [0, 36, 3, BP.shroom], [122, 60, 5, BP.purple]]);
  } },
];

const BDEFS = { inn: { w: 4, h: 3, top: 86, vars: INN_VARS, title: 'Трактир' }, school: { w: 3, h: 3, top: 96, vars: SCHOOL_VARS, title: 'Школа' }, storehouse: { w: 4, h: 3, top: 70, vars: STORE_VARS, title: 'Склад' } };
const TILE_ = 32, BPADX_ = 38, BBOTTOM_ = 14;

// спрайт варианта: холст размером как в игре (×3)
function renderVariant(type, vi, rot = 0) {
  const def = BDEFS[type], LW = def.w * TILE_, LD = def.h * TILE_;
  BK = def.bk || 3;
  const FW = rot ? LD : LW, FD = rot ? LW : LD, top = def.top + 34;
  const W = Math.ceil(FW + BPADX_ * 2 + FD * BSK), H = FD + top + BBOTTOM_;
  FINE = def.fine || 1;
  const g = new BGrid(Math.round(W * BK * FINE), Math.round(H * BK * FINE), Math.round(BPADX_ * BK * FINE), Math.round((top + FD) * BK * FINE));
  g.rot = rot; g.LD = LD; g.spk = def.spk || 1;
  def.vars[vi].make(g);
  g.finish({ step: def.bk && def.bk < 2 ? 1.6 : 1.0, ink: def.ink });
  groundShadow(g, [[-6, -4, 0], [LW + 6, -4, 0], [LW + 6, LD + 4, 0], [-6, LD + 4, 0]], 0.22);
  const cv = g.toCanvas(); FINE = 1; return cv;
}
