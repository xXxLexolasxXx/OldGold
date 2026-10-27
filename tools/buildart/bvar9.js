'use strict';
// Жилые дома 2×2 (64×64), семь разных: форма, материал, крыша и двор у каждого свои; видно, что там живут.
// Вход на юге (x ≈ 48 — дверь игры). Боковой вид (вход на восток) — та же модель с g.rot = 1: дверь уходит на восточную
// стену, конёк поворачивается, поэтому и профили у домов разные.
// Крыши по уровням: 1 — солома (у каждого дома свой оттенок), 2 — дранка с мхом, 3 — черепица.

const STRAW_H = {
  ash: bramp(['#d4ccb0', '#ada68a', '#86806a', '#5c5848']),       // выгоревшая серая
  honey: bramp(['#f2cc78', '#d4a450', '#a87a34', '#76521e']),     // медовая
  sage: bramp(['#c8c890', '#a0a468', '#787c46', '#50542c']),      // шалфейная
};
const HSTRAW = [STRAW1.wheat, STRAW_H.honey, STRAW1.rye, STRAW_H.ash, STRAW1.reed, STRAW_H.sage, STRAW1.olive];
function houseRoof(lv, vi) {
  if (lv === 1) { const S = HSTRAW[vi % HSTRAW.length]; return { mat: m1Straw3(S), cut: m1StrawCut(S), th: 3 }; }
  if (lv === 2) return { mat: m1Shingle2(SHINGLE1, 0.6), cut: m1Fascia, th: 2 };
  const T = [P1.tileR, P1.tileD, P1.slate, P1.tileR, P1.scale, P1.tileD, P1.slate][vi % 7];
  return { mat: T === P1.scale ? m1Scale2(T) : m1Tile2(T), cut: T === P1.slate || T === P1.scale ? m1FasciaDark : m1Fascia, th: 2 };
}
const HQ = {
  laundry(P, w = 22) {   // верёвка с бельём на двух шестах
    PR.rect(P, 0, -16, 0, 0, P3.oak[1]); PR.rect(P, w, -16, w, 0, P3.oak[1]);
    for (let x = 0; x <= w; x++) P(x, -15 + Math.round(Math.sin(x / w * Math.PI) * 2), P1.white[2]);
    const cl = [P1.white[0], P1.red[0], P1.scale[0], P1.gold[0], P1.white[1]];
    for (let k = 0; k < 5; k++) { const x0 = 2 + k * 4, sag = Math.round(Math.sin((x0 + 1) / w * Math.PI) * 2); PR.rect(P, x0, -14 + sag, x0 + 2, -9 + sag - (k % 2), cl[k]); P(x0 + 2, -14 + sag, P1.white[2]); }
  },
  cabbages(P, n = 6) { for (let k = 0; k < n; k++) { const x = (k % 3) * 6, y = Math.floor(k / 3) * 4; PR.ell(P, x, y - 2, 2.6, 2, (xx, yy, a, b) => P1.grass[a < -0.2 && b < 0 ? 0 : a > 0.4 ? 2 : 1]); P(x, y - 3, P1.ivy[0]); } },
  bed(P, w = 20, h = 8) { PR.rect(P, 0, -h, w, 0, bhex('#6a5236')); for (let x = 1; x < w; x += 2) for (let y = -h + 1; y < 0; y += 3) P(x, y, bhex('#5a4430')); PR.rect(P, 0, -h, w, -h, P1.plank[1]); PR.rect(P, 0, 0, w, 0, P1.plank[3]); },
  bench(P) { Q1.bench(P, 10); },
  waterBarrel(P) { Q1.barrel(P, 8, 10); PR.rect(P, -3, -11, 2, -11, P1.scale[1]); },
  hens(P) { for (const [x, y, f] of [[0, 0, 1], [6, 2, -1]]) { PR.rect(P, x - 2, y - 4, x + 2, y - 1, P1.white[0]); P(x + 2 * f, y - 5, P1.white[0]); P(x + 3 * f, y - 5, P1.gold[1]); P(x + 2 * f, y - 6, P1.red[0]); P(x - 1, y, P1.gold[2]); P(x + 1, y, P1.gold[2]); } },
  well(P) { PR.ell(P, 0, -4, 6, 3, (x, y, a, b) => (a * a + b * b > 0.55 ? P1.stone[(x + y) & 1 ? 1 : 2] : P1.scale[3])); PR.rect(P, -6, -4, 6, -1, P1.stone[2]); PR.rect(P, -5, -16, -5, -4, P3.oak[1]); PR.rect(P, 5, -16, 5, -4, P3.oak[1]); PR.rect(P, -7, -17, 7, -16, P1.tileD[1]); PR.rect(P, -1, -14, 1, -9, P1.plank[1]); },
  pumpkin(P) { Q1.pumpkin(P); },
  wood(P) { Q1.logs(P); },
};
const HWIN = (g, side, at, a, z, w, h, o = {}) => { elem(g, side, at, a, z, w, h, m1Window(Object.assign({ w, h }, o))); (g.meta.wins = g.meta.wins || []).push({ side, at, a, z, w, h, round: !!o.round }); };
function hDoor(g, side, at, a, w = 10, h = 13, o = {}) { elem(g, side, at, a, 0, w, h, (o.round ? m1RoundDoor : m1Door)(Object.assign({ w, h, arch: true, knob: true }, o))); g.meta.doorPt = side === 'S' ? [a + w / 2, at, 0] : [at, a + w / 2, 0]; }

const HOUSE_VARS = [
  { name: 'Белёный коттедж: низкий, толстая солома, круглые окна, лавка и бочка с водой', make(g, lv) {
    g.meta = {};
    const M = { x0: 8, x1: 58, y0: 22, y1: 52, h: 14 };
    box(g, Object.assign({ mat: m1Plaster(P1.plasterW || P1.plaster, { low: 4, stoneR: P1.stoneW }) }, M));
    const R = houseRoof(lv, 0);
    roofSag(g, M, { axis: 'X', rise: 20, sag: 2, flare: 3, ov: 4, ovg: 4, mat: R.mat, cut: R.cut, th: R.th + 1, gable: m1Plaster(P1.plaster) });
    hDoor(g, 'S', M.y0, 43, 10, 12, { col: P1.green ? undefined : undefined });
    HWIN(g, 'S', M.y0, 14, 4, 8, 8, { round: true }); HWIN(g, 'S', M.y0, 28, 4, 8, 8, { round: true });
    HWIN(g, 'E', M.x1, 32, 4, 7, 7, { round: true });
    chimney1(g, 16, 40, M.h + 10, 12, { brick: true, w: 5, d: 5 });
    g.sprite([22, 21, 0], P => Q1.flowers(P, 10)); g.sprite([32, 20, 0], P => HQ.bench(P));
    g.sprite([60, 26, 0], P => HQ.waterBarrel(P)); g.sprite([12, 12, 0], P => Q1.planter(P, 11));
    if (lv >= 2) { g.sprite([4, 30, 0], P => Q1.sunflower(P, 16)); g.sprite([56, 12, 0], P => Q1.planter(P, 9)); }
    if (lv >= 3) { box(g, { x0: 40, x1: 56, y0: 16, y1: 22, h: 1, mat: m1Flat(P1.stone[2]), top: m1Flat(P1.stone[1]) }); g.sprite([8, 54, 0], P => HQ.laundry(P, 18)); }
  } },
  { name: 'Узкий высокий фахверк: нависающий этаж, крутая крыша, слуховое окно, бельё на верёвке', make(g, lv) {
    g.meta = {};
    const Lo = { x0: 30, x1: 58, y0: 26, y1: 56, h: 14 }, Up = { x0: 28, x1: 60, y0: 23, y1: 56, z0: 14, h: 14 + (lv >= 2 ? 4 : 0) };
    box(g, Object.assign({ mat: m1Stone(P1.stone) }, Lo)); beam1(g, 28, 60, 23, 26, 13, 1, P1.beam);
    box(g, Object.assign({ mat: m1Plaster(P1.plaster, { frame: true, bay: 12, braceOdd: true }) }, Up));
    const R = houseRoof(lv, 1), r = { type: 'gable', axis: 'Y', rise: 30, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plaster, { frame: true, bay: 10, brace: false }) };
    roof(g, Up, r);
    hDoor(g, 'S', Lo.y0, 43, 10, 13);
    HWIN(g, 'S', Up.y0, 34, Up.z0 + 4, 8, 9, { sill: true }); HWIN(g, 'S', Up.y0, 48, Up.z0 + 4, 8, 9, { sill: true });
    HWIN(g, 'S', Up.y0, 40, Up.z0 + Up.h + 4, 8, 8, { arch: true });
    HWIN(g, 'E', Up.x1, 36, Up.z0 + 4, 7, 8, {}); HWIN(g, 'E', Lo.x1, 40, 4, 7, 8, {});
    chimney1(g, 34, 44, Up.z0 + Up.h + 12, 12, { w: 5, d: 5 });
    g.sprite([2, 30, 0], P => HQ.laundry(P, 24));
    g.sprite([10, 14, 0], P => HQ.bed(P, 16, 8)); g.sprite([14, 10, 0], P => HQ.cabbages(P, lv >= 2 ? 6 : 3));
    if (lv >= 3) { beam1(g, 34, 54, 18, 23, Up.z0 + 2, 1.5, P1.plank); railing1(g, 34, 54, 18.5, 18.5, Up.z0 + 3.5, 4); }
  } },
  { name: 'Бревенчатая изба: крыльцо под навесом, резные наличники, поленница', make(g, lv) {
    g.meta = {};
    const M = { x0: 4, x1: 52, y0: 24, y1: 58, h: 16 };
    box(g, Object.assign({ mat: m1Logs(P1.log) }, M));
    const R = houseRoof(lv, 2);
    roof(g, M, { type: 'gable', axis: 'Y', rise: 22, ov: 4, ovg: 5, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plank, 4) });
    hDoor(g, 'S', M.y0, 30, 10, 13, { col: P1.dark });
    for (const x of [10]) { HWIN(g, 'S', M.y0, x, 5, 9, 8, { frameR: P1.plank }); elem(g, 'S', M.y0 - 0.2, x - 1, 13, 11, 2, m1Flat(P1.plank[0])); }
    HWIN(g, 'S', M.y0, 24, 26, 6, 6, { round: true });
    HWIN(g, 'E', M.x1, 34, 5, 8, 8, { frameR: P1.plank });
    // крыльцо под навесом
    box(g, { x0: 24, x1: 46, y0: 14, y1: 24, h: 2, mat: m1Plank(P1.plank, 4, false), top: m1Plank(P1.plank, 4, false) });
    S2([[24, 14], [44, 14]], (x, y) => post1(g, x, y, 2, 12, 2));
    roof(g, { x0: 24, x1: 46, y0: 14, y1: 24, h: 14 }, { type: 'lean', down: 'S', rise: 4, ov: 2, mat: R.mat, cut: R.cut, th: 2 });
    chimney1(g, 12, 46, M.h + 14, 10, { stone: true, w: 6, d: 6 });
    g.sprite([58, 40, 0], P => HQ.wood(P)); g.sprite([58, 30, 0], P => Y1.chop(P));
    if (lv >= 2) g.sprite([34, 18, 2], P => HQ.bench(P));
    if (lv >= 3) { g.sprite([8, 12, 0], P => HQ.hens(P)); g.sprite([56, 14, 0], P => Q1.planter(P, 9)); }
  } },
  { name: 'Каменный домик: вальмовая крыша, большая труба, огород с капустой и тыквами', make(g, lv) {
    g.meta = {};
    const M = { x0: 20, x1: 58, y0: 30, y1: 58, h: 16 };
    box(g, Object.assign({ mat: m1Stone(P1.stoneW, 6, 4) }, M));
    const R = houseRoof(lv, 3);
    roof(g, M, { type: 'hip', axis: 'X', rise: 18, hipL: 14, ov: 3, mat: R.mat, cut: R.cut, th: R.th });
    hDoor(g, 'S', M.y0, 43, 10, 13, { col: P1.plank });
    HWIN(g, 'S', M.y0, 26, 5, 8, 9, { arch: true }); HWIN(g, 'E', M.x1, 38, 5, 8, 9, { arch: true });
    box(g, { x0: 22, x1: 30, y0: 40, y1: 48, h: M.h + 22, mat: m1Stone(P1.stone, 5, 3), top: m1Flat(P1.stone[3]) });   // большая труба
    chimney1(g, 23, 41, M.h + 22, 2, { stone: true, w: 6, d: 6 });
    box(g, { x0: 2, x1: 18, y0: 6, y1: 28, h: 0.3, mat: m1Flat(bhex('#5a4430')), top: (u, v) => ((u | 0) % 4 === 0 ? bhex('#4e3a28') : bhex('#6a5236')) });   // грядки
    g.sprite([6, 24, 0.3], P => HQ.cabbages(P, 6)); g.sprite([6, 12, 0.3], P => HQ.cabbages(P, lv >= 2 ? 6 : 3));
    g.sprite([24, 14, 0], P => HQ.pumpkin(P)); g.sprite([30, 18, 0], P => HQ.pumpkin(P));
    fence1(g, 2, 18, 4, 4, 5); fence1(g, 18, 18, 4, 28, 5);
    if (lv >= 2) g.sprite([60, 24, 0], P => HQ.waterBarrel(P));
    if (lv >= 3) g.sprite([10, 46, 0], P => HQ.well(P));
  } },
  { name: 'Круглый домик: цилиндр под конической крышей, круглая дверь, грибы и огоньки', make(g, lv) {
    g.meta = {};
    const cx = 34, cy = 38, rr = 18;
    cyl(g, cx, cy, rr, 0, 6, m1Stone(P1.stoneW, 5, 3), 28);
    cyl(g, cx, cy, rr, 6, 18, m1Plaster(P1.plaster), 28);
    const R = houseRoof(lv, 4);
    cone(g, cx, cy, rr + 5, 17, 26 + (lv >= 3 ? 4 : 0), R.mat, R.cut, 28, 3);
    elem(g, 'S', cy - rr + 1, 43, 0, 11, 11, m1RoundDoor({ w: 11, h: 11 })); g.meta.doorPt = [48.5, cy - rr + 1, 0];
    HWIN(g, 'S', cy - rr + 2, 22, 7, 7, 7, { round: true, G: P3.crystal });
    HWIN(g, 'E', cx + rr - 1, cy - 3, 7, 7, 7, { round: true });
    chimneyCrooked(g, 40, 44, 34, 10, { stone: true, w: 4, d: 4, lean: 2 });
    g.sprite([cx, cy, 43 + (lv >= 3 ? 4 : 0)], P => Q3.owl(P));
    g.sprite([8, 22, 0], P => Q3.shroomPatch(P)); g.sprite([58, 52, 0], P => Q3.shroomPatch(P));
    g.sprite([12, 30, 12], P => Q3.wisp(P), -2);
    g.sprite([56, 18, 0], P => Q3.crystalLamp(P, 14));
    if (lv >= 2) g.sprite([18, 12, 0], P => Q1.planter(P, 11));
    if (lv >= 3) { cyl(g, 10, 50, 7, 0, 10, m1Plaster(P1.plaster), 16); cone(g, 10, 50, 9, 9, 10, R.mat, R.cut, 16, 2); }
  } },
  { name: 'Г-образный дом: два крыла разной высоты, крытая галерея, куры', make(g, lv) {
    g.meta = {};
    const A = { x0: 6, x1: 30, y0: 22, y1: 58, h: 22 }, B = { x0: 30, x1: 60, y0: 36, y1: 58, h: 13 };
    box(g, Object.assign({ mat: m1Plaster(P1.plaster, { frame: true, bay: 12, mid: true, low: 6, braceX: true }) }, A));
    box(g, Object.assign({ mat: m1Plank(P1.plankB, 4) }, B));
    const R = houseRoof(lv, 5);
    roof(g, A, { type: 'gable', axis: 'Y', rise: 18, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plaster, { frame: true, bay: 10, brace: false }) });
    roof(g, B, { type: 'gable', axis: 'X', rise: 12, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plankB, 4) });
    hDoor(g, 'S', B.y0, 43, 10, 11, { col: P1.dark });
    HWIN(g, 'S', A.y0, 12, 4, 8, 8, {}); HWIN(g, 'S', A.y0, 13, 14, 7, 7, {});
    HWIN(g, 'S', B.y0, 33, 3, 7, 7, { frameR: P1.plank }); HWIN(g, 'E', B.x1, 44, 3, 7, 7, { frameR: P1.plank });
    // галерея вдоль короткого крыла
    S2([[32, 28], [58, 28]], (x, y) => post1(g, x, y, 0, 11, 2));
    roof(g, { x0: 30, x1: 60, y0: 28, y1: 36, h: 12 }, { type: 'lean', down: 'S', rise: 3, ov: 2, mat: R.mat, cut: R.cut, th: 2 });
    chimney1(g, 12, 44, A.h + 12, 10, { brick: true, w: 5, d: 5 });
    g.sprite([20, 12, 0], P => HQ.hens(P)); g.sprite([8, 16, 0], P => HQ.hens(P));
    if (lv >= 2) g.sprite([34, 30, 0], P => HQ.bench(P));
    if (lv >= 3) { g.sprite([56, 16, 0], P => Q1.planter(P, 9)); g.sprite([4, 10, 0], P => Q1.sunflower(P, 18)); }
  } },
  { name: 'Дом в холме: дерновая крыша с цветами, круглая дверь в каменной арке, окошки в склоне', make(g, lv) {
    g.meta = {};
    // холм — широкая низкая «крыша» из дёрна прямо от земли
    const sod = (u, v, F) => { const h = bhash(u, v, 701); if (h < 0.04 && lv >= 2) return [P1.red[0], P1.gold[0], P1.white[0], P1.scale[0]][(bhash(u, v, 702) * 4) | 0]; const t = v / F.L; return P1.grass[bcl((t > 0.7 ? 1 : 0) + (h < 0.3 ? 0 : h < 0.85 ? 1 : 2) + L1(F) - 1, 2)]; };
    // холм — травяной купол с каменным цоколем; окна и дверь — в каменной стенке спереди
    cyl(g, 32, 44, 24, 0, 3, m1Stone(P1.stoneW, 5, 3), 32);
    dome(g, 32, 44, 25, 2.5, 20, lv >= 3 ? m1Ivy(sod, [{ u: 60, v: 20, rx: 10, ry: 6 }]) : sod, m1Flat(bhex('#4e6a2e')), 32, 8, 2);
    // фасад в склоне: каменная арка с круглой дверью и два круглых окна
    box(g, { x0: 10, x1: 58, y0: 20, y1: 26, h: 12, mat: m1Stone(P1.stoneW, 5, 3), top: sod });   // подпорная стенка фасада
    elem(g, 'S', 20, 42, 0, 12, 12, m1RoundDoor({ w: 12, h: 12, col: P1.green ? P1.plank : P1.plank })); g.meta.doorPt = [48, 20, 0];
    HWIN(g, 'S', 20, 16, 3, 7, 7, { round: true }); HWIN(g, 'S', 20, 28, 3, 7, 7, { round: true });
    chimney1(g, 20, 48, 16, 8, { stone: true, w: 5, d: 5 });
    g.sprite([30, 20, 0], P => Q1.flowers(P, 8)); g.sprite([60, 14, 0], P => Q1.planter(P, 9));
    g.sprite([10, 14, 0], P => HQ.bench(P));
    if (lv >= 2) g.sprite([22, 10, 0], P => Q1.sunflower(P, 14));
    if (lv >= 3) { g.sprite([4, 50, 0], P => Q3.shroomPatch(P)); g.sprite([60, 34, 0], P => Q3.crystalLamp(P, 12)); }
  } },
];

BDEFS.houses = { w: 2, h: 2, top: 70, vars: HOUSE_VARS.map((v, i) => ({ name: v.name, make: g => v.make(g, 1, i) })), title: 'Дома, уровень 1: фасад и вид сбоку', bk: 1, ink: P1.ink };
BDEFS.houses2 = { w: 2, h: 2, top: 70, vars: HOUSE_VARS.map((v, i) => ({ name: v.name, make: g => v.make(g, 2, i) })), title: 'Дома, уровень 2', bk: 1, ink: P1.ink };
BDEFS.houses3 = { w: 2, h: 2, top: 70, vars: HOUSE_VARS.map((v, i) => ({ name: v.name, make: g => v.make(g, 3, i) })), title: 'Дома, уровень 3', bk: 1, ink: P1.ink };
