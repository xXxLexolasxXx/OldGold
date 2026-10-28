'use strict';
// Трактир в масштабе референсов (1 px = 1 мировой px): семь разных корпусов — этажность, ширина, высота стен,
// материалы и крыши различаются вместе, а не только кровля. Лот 128×96, дверь на x=80, фасад на юге.

const WIN1 = (w, h, o = {}) => m1Window(Object.assign({ w, h }, o));
const DOOR1 = (w, h, o = {}) => m1Door(Object.assign({ w, h }, o));
function chimney1(g, x, y, z0, h, o = {}) {
  const w = o.w || 5, d = o.d || 5, m = o.brick ? m1Brick(P1.brick) : m1Stone(P1.stone, 4, 3);
  box(g, { x0: x, x1: x + w, y0: y, y1: y + d, z0, h, mat: m, top: m1Flat(P1.stone[2]) });
  box(g, { x0: x - 1, x1: x + w + 1, y0: y - 1, y1: y + d + 1, z0: z0 + h, h: 1.5, mat: m1Flat(P1.stone[1]), top: m1Flat(P1.stone[0]) });
  g.face([[x + 1, y + 1, z0 + h + 1.51], [x + w - 1, y + 1, z0 + h + 1.51], [x + w - 1, y + d - 1, z0 + h + 1.51], [x + 1, y + d - 1, z0 + h + 1.51]], [1, 0, 0], [0, 1, 0], m1Flat(P1.ink), { dz: -0.01 });
  (g.chim = g.chim || []).push([x + w / 2, y + d / 2, z0 + h + 2]);
  if (o.smoke !== false && !g.noSmoke) g.sprite([x + w / 2, y + d / 2, z0 + h + 2], P => Q1.smoke(P), -3);   // в игре дым рисует render.js по spr.chimneys
}
// брус: на мелком растре — волокна вдоль бруса, светлая кромка на ребре, редкие трещины и сучки
const woodBeam = (R, along) => (u, v, F) => {
  const c = R[F.li === 0 ? 1 : 2];
  if (F.fu == null) return c;
  const a = along === 'v' ? v + F.fv : u + F.fu, x = along === 'v' ? u + F.fu : v + F.fv, W = along === 'v' ? F.w : F.h;
  if (x < 0.34) return fShade(c, 1.14);                                            // кромка на свету
  if (W && x > W - 0.34) return fShade(c, 0.8);                                    // кромка в тени
  const line = bhash(Math.floor(x * 3), Math.floor(a / 5), 1901);
  if (line < 0.18) return fShade(c, 0.86);                                         // волокно
  if (bhash(Math.floor(a / 7), Math.floor(x), 1902) < 0.06 && Math.abs((a % 7) - 3.5) < 0.6) return fShade(c, 0.7);   // трещина/сучок
  return fShade(c, fGrain(F, 1903, 0.08));
};
function post1(g, x, y, z0, h, s = 2, R = P1.beam) { box(g, { x0: x, x1: x + s, y0: y, y1: y + s, z0, h, mat: woodBeam(R, 'v'), top: m1Flat(R[1]) }); }
function beam1(g, x0, x1, y0, y1, z0, h, R = P1.beam) { box(g, { x0, x1, y0, y1, z0, h, mat: woodBeam(R, 'u'), top: m1Flat(R[0]) }); }
function fence1(g, x0, x1, y0, y1, h = 6) {
  const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / 8));
  for (let k = 0; k <= n; k++) post1(g, x0 + (x1 - x0) * k / n - 1, y0 + (y1 - y0) * k / n - 1, 0, h, 2, P1.plank);
  for (const z of [h - 2, h * 0.4]) beam1(g, Math.min(x0, x1) - 0.5, Math.max(x0, x1) + 0.5, Math.min(y0, y1) - 0.5, Math.max(y0, y1) + 0.5, z, 1, P1.plank);
}
function railing1(g, x0, x1, y0, y1, z0, h = 6, R = P1.plank) {
  const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / 7));
  for (let k = 0; k <= n; k++) box(g, { x0: x0 + (x1 - x0) * k / n - 0.5, x1: x0 + (x1 - x0) * k / n + 0.5, y0: y0 + (y1 - y0) * k / n - 0.5, y1: y0 + (y1 - y0) * k / n + 0.5, z0, h, mat: (u, v, F) => R[F.li === 0 ? 1 : 3], top: m1Flat(R[1]) });
  for (const z of [h - 1, h * 0.4]) box(g, { x0: Math.min(x0, x1) - 0.5, x1: Math.max(x0, x1) + 0.5, y0: Math.min(y0, y1) - 0.5, y1: Math.max(y0, y1) + 0.5, z0: z0 + z, h: 1, mat: (u, v, F) => R[F.li === 0 ? 0 : 2], top: m1Flat(R[0]) });
}
const rzOf = (b, r) => { const ze = b.h + (b.z0 || 0) - (r.drop ?? 1), zr = b.h + (b.z0 || 0) + r.rise, ya = b.y0 - (r.ov ?? 3), ym = (b.y0 + b.y1) / 2; return y => ze + (y - ya) / (ym - ya) * (zr - ze); };
const split1 = (low, a, b) => (u, v, F) => (v < low ? a(u, v, F) : b(u, v, F));
const S = (list, fn) => { for (const a of list) fn(...a); };

const TAV1_VARS = [
  { name: 'Р1 · Тёмная таверна: широкий двухэтажный корпус, галерея, фронтон с черепом, сланец, фонари', make(g) {
    const Lo = { x0: 6, x1: 122, y0: 14, y1: 92, h: 22 }, Up = { x0: 2, x1: 126, y0: 10, y1: 92, z0: 22, h: 20 };
    box(g, Object.assign({ mat: split1(6, m1Stone(P1.stone), m1Plank(P1.dark, 4, false)) }, Lo));
    beam1(g, 2, 126, 10, 14, 21, 1, P1.dark);
    box(g, Object.assign({ mat: m1Plank(P1.dark, 4, false) }, Up));
    const r = { type: 'gable', axis: 'X', rise: 24, ov: 3, ovg: 4, mat: m1Slate(P1.slate), cut: m1FasciaDark, th: 2, gable: m1Plank(P1.dark, 4, false) };
    roof(g, Up, r); const rz = rzOf(Up, r);
    dormer(g, 80, 12, 22, 12, 11, rz, m1Plank(P1.dark, 4, false), m1Slate(P1.slate), m1FasciaDark, null);
    elem(g, 'S', 11.7, 72, rz(12) + 1, 16, 7, m1Sprite(16, 7, P => Q1.board(P, 'skull', 16, 7)));
    elem(g, 'S', 11.7, 76, rz(12) - 1 + 1, 8, 1, m1Flat(P1.beamD[1]));
    chimney1(g, 20, 60, Up.z0 + Up.h, 20, { w: 6, d: 6 });
    beam1(g, 4, 124, 2, 10, 20, 2, P1.dark);
    S([[6, 3], [40, 3], [116, 3]], (x, y) => post1(g, x, y, 0, 20, 2, P1.dark));
    railing1(g, 5, 123, 3, 3, 22, 6, P1.dark);
    S([[6, 3], [64, 3], [116, 3]], (x, y) => post1(g, x, y, 22, 19, 2, P1.dark));
    elem(g, 'S', Lo.y0, 73, 0, 14, 17, DOOR1(14, 17, { arch: true, col: P1.dark }));
    S([[16], [36], [54], [98], [112]], x => elem(g, 'S', Lo.y0, x, 6, 9, 10, WIN1(9, 10)));
    S([[12], [32], [52], [72], [92], [110]], x => elem(g, 'S', Up.y0, x, 27, 9, 9, WIN1(9, 9)));
    S([[30], [62]], y => elem(g, 'E', Lo.x1, y, 6, 9, 10, WIN1(9, 10))); elem(g, 'E', Up.x1, 50, 27, 9, 9, WIN1(9, 9));
    g.sprite([94, 13.5, 15], P => Q1.lantern(P)); g.sprite([66, 13.5, 15], P => Q1.lantern(P));
    g.sprite([127, 10, 30], P => Q1.sign(P, 'lamp', 1));
    g.sprite([0, 2, 0], P => Q1.streetLamp(P, 24)); g.sprite([128, 4, 0], P => Q1.streetLamp(P, 24));
    g.sprite([80, 13, 0], P => Q1.steps(P, 18, 2));
    g.sprite([26, 8, 0], P => Q1.barrel(P)); g.sprite([38, 7, 0], P => Q1.barrel(P, 7, 9)); g.sprite([108, 7, 0], P => Q1.barrel(P));
    g.sprite([126, 72, 0], P => Q1.tree(P, 14, bramp(['#5e8a46', '#406a32', '#2c4c22'])));
    g.sprite([80, 12, rz(12) + 11 + 11], P => Q1.pennant(P, 10, bramp(['#8c62b4', '#4a306a'])));
  } },
  { name: 'Р2 · Узкий высокий дом с крутой крышей и крылом, каменный подиум со ступенями, дым', make(g) {
    plinth(g, 2, 126, 6, 96, 4, 80, 30);
    const M = { x0: 32, x1: 100, y0: 26, y1: 90, z0: 4, h: 34 }, Wg = { x0: 68, x1: 118, y0: 12, y1: 50, z0: 4, h: 26 };
    const wall = split1(12, m1Stone(P1.stone), m1Plaster(P1.plaster, { frame: true, bay: 16, mid: true, braceOdd: true }));
    box(g, Object.assign({ mat: wall }, M)); box(g, Object.assign({ mat: wall }, Wg));
    roof(g, M, { type: 'gable', axis: 'Y', rise: 36, ov: 3, ovg: 4, mat: m1Tile(P1.tileR), cut: m1Fascia, th: 2, gable: m1Plaster(P1.plaster, { frame: true, bay: 12, brace: false }) });
    roof(g, Wg, { type: 'gable', axis: 'X', rise: 22, ov: 3, ovg: 4, mat: m1Tile(P1.tileR), cut: m1Fascia, th: 2, gable: m1Plaster(P1.plaster, { frame: true, bay: 12, brace: false }) });
    chimney1(g, 46, 68, M.z0 + M.h + 10, 28, { w: 6, d: 6 });
    elem(g, 'S', Wg.y0, 74, 4, 12, 16, DOOR1(12, 16, { arch: true }));
    elem(g, 'S', Wg.y0, 94, 12, 8, 10, WIN1(8, 10, { arch: true })); elem(g, 'E', Wg.x1, 22, 12, 8, 10, WIN1(8, 10, { arch: true })); elem(g, 'E', Wg.x1, 36, 12, 8, 10, WIN1(8, 10, { arch: true }));
    S([[40], [54]], x => elem(g, 'S', M.y0, x, 10, 9, 11, WIN1(9, 11)));
    elem(g, 'S', M.y0, 60, 42, 12, 18, WIN1(12, 18, { arch: true }));
    elem(g, 'S', M.y0, 40, 26, 8, 9, WIN1(8, 9));
    elem(g, 'E', M.x1, 60, 10, 9, 11, WIN1(9, 11)); elem(g, 'E', M.x1, 74, 26, 8, 9, WIN1(8, 9));
    g.sprite([120, 12, 28], P => Q1.sign(P, 'mug', 1));
    g.sprite([8, 10, 4], P => Q1.barrel(P)); g.sprite([122, 24, 4], P => Q1.barrel(P)); g.sprite([124, 40, 4], P => Q1.barrel(P, 7, 9)); g.sprite([16, 60, 4], P => Q1.crate(P, 7));
    g.sprite([96, 11.5, 20], P => Q1.lantern(P));
  } },
  { name: 'Р3 · Низкий светлый дом с плющом и вывеской на фронтоне, двор с оградой, деревом и столом', make(g) {
    const M = { x0: 30, x1: 106, y0: 26, y1: 92, h: 22 };
    box(g, Object.assign({ mat: split1(5, m1Stone(P1.stoneW), m1Plaster(P1.plaster, { frame: true, bay: 18, mid: true })) }, M));
    roof(g, M, { type: 'gable', axis: 'Y', rise: 30, ov: 3, ovg: 5, mat: m1Ivy(m1Tile(P1.tileR), [{ u: 44, v: 18, rx: 16, ry: 11 }, { u: 32, v: 36, rx: 9, ry: 8 }]), cut: m1Fascia, th: 2, gable: m1Plaster(P1.plaster, { frame: true, bay: 14, brace: false }) });
    chimney1(g, 92, 62, M.h + 6, 22, { w: 5, d: 5 });
    elem(g, 'S', M.y0, 73, 0, 14, 16, DOOR1(14, 16, { arch: true, knob: true }));
    S([[38], [54]], x => elem(g, 'S', M.y0, x, 6, 9, 10, WIN1(9, 10, { sill: true }))); elem(g, 'S', M.y0, 92, 6, 9, 10, WIN1(9, 10, { sill: true }));
    elem(g, 'E', M.x1, 40, 6, 9, 10, WIN1(9, 10)); elem(g, 'E', M.x1, 68, 6, 9, 10, WIN1(9, 10));
    elem(g, 'S', M.y0 - 0.3, 58, 28, 20, 8, m1Sprite(20, 8, P => Q1.board(P, 'mug', 20, 8)));
    roof(g, { x0: 106, x1: 107, y0: 36, y1: 48, h: 15 }, { type: 'lean', down: 'E', rise: 4, ov: 1, mat: m1Awning(), cut: m1Flat(P1.red[1]), th: 1 });
    fence1(g, 4, 60, 6, 6); fence1(g, 100, 126, 6, 6); fence1(g, 4, 4, 6, 90); fence1(g, 126, 126, 6, 56);
    g.sprite([14, 44, 0], P => Q1.tree(P, 17));
    g.sprite([22, 18, 0], P => Q1.table(P, 14)); g.sprite([38, 12, 0], P => Q1.bench(P, 10));
    g.sprite([118, 14, 0], P => Q1.barrel(P)); g.sprite([124, 26, 0], P => Q1.barrel(P, 7, 9)); g.sprite([116, 34, 0], P => Q1.barrel(P, 7, 9));
    g.sprite([48, 10, 0], P => Q1.stones(P)); g.sprite([80, 25, 0], P => Q1.steps(P, 16, 1));
    g.sprite([96, 25.5, 14], P => Q1.lantern(P));
    g.sprite([44, 25, 0], P => Q1.flowers(P, 12)); g.sprite([110, 60, 0], P => Q1.flowers(P, 8));
  } },
  { name: 'Р4 · Уютный: крестовое крыло с двумя этажами, слуховое окно, полосатый навес, огород и подсолнухи', make(g) {
    const M = { x0: 22, x1: 110, y0: 36, y1: 92, h: 26 }, Wg = { x0: 32, x1: 68, y0: 14, y1: 44, h: 38 };
    const wall = split1(8, m1Stone(P1.stoneW), m1Plaster(P1.plaster, { frame: true, bay: 16, mid: true, braceOdd: true }));
    box(g, Object.assign({ mat: wall }, M)); box(g, Object.assign({ mat: wall }, Wg));
    const r = { type: 'gable', axis: 'X', rise: 24, ov: 3, ovg: 4, mat: m1Tile(P1.tileR), cut: m1Fascia, th: 2, gable: m1Plaster(P1.plaster, { frame: true, bay: 12, brace: false }) };
    roof(g, M, r); const rz = rzOf(M, r);
    roof(g, Wg, { type: 'gable', axis: 'Y', rise: 22, ov: 3, ovg: 4, mat: m1Tile(P1.tileR), cut: m1Fascia, th: 2, gable: m1Plaster(P1.plaster, { frame: true, bay: 12, brace: false }) });
    dormer(g, 92, 32, 14, 9, 8, rz, m1Plaster(P1.plaster, { frame: true, bay: 10, brace: false }), m1Tile(P1.tileR), m1Fascia, null);
    elem(g, 'S', 31.7, 88, rz(32) - 1 + 1, 7, 7, WIN1(7, 7));
    chimney1(g, 96, 66, M.h, 24, { brick: true, w: 5, d: 5 });
    elem(g, 'S', M.y0, 73, 0, 14, 16, DOOR1(14, 16, { arch: true }));
    elem(g, 'S', Wg.y0, 40, 6, 9, 10, WIN1(9, 10, { sill: true })); elem(g, 'S', Wg.y0, 54, 6, 9, 10, WIN1(9, 10, { sill: true }));
    elem(g, 'S', Wg.y0, 42, 24, 8, 9, WIN1(8, 9)); elem(g, 'S', Wg.y0, 54, 24, 8, 9, WIN1(8, 9));
    elem(g, 'S', Wg.y0, 46, 42, 7, 8, WIN1(7, 8, { arch: true }));
    elem(g, 'S', M.y0, 96, 7, 9, 10, WIN1(9, 10, { sill: true })); elem(g, 'E', M.x1, 50, 7, 9, 10, WIN1(9, 10)); elem(g, 'E', M.x1, 72, 7, 9, 10, WIN1(9, 10));
    g.sprite([44.5, 13.5, 5], P => Q1.planter(P, 11)); g.sprite([58.5, 13.5, 5], P => Q1.planter(P, 11)); g.sprite([100.5, 35.5, 6], P => Q1.planter(P, 11));
    S([[72, 24], [104, 24]], (x, y) => post1(g, x, y, 0, 18));
    roof(g, { x0: 72, x1: 106, y0: 26, y1: 36, h: 19 }, { type: 'lean', down: 'S', rise: 5, ov: 2, mat: m1Awning(), cut: m1Flat(P1.red[1]), th: 1 });
    g.sprite([96, 30, 0], P => Q1.table(P, 14)); g.sprite([80, 35, 0], P => Q1.steps(P, 16, 1));
    g.sprite([8, 22, 0], P => Q1.sunflower(P, 20)); g.sprite([14, 16, 0], P => Q1.sunflower(P, 16)); g.sprite([6, 32, 0], P => Q1.sunflower(P, 18));
    g.sprite([120, 18, 0], P => Q1.hay(P, 8)); g.sprite([120, 44, 0], P => Q1.barrel(P)); g.sprite([124, 58, 0], P => Q1.barrel(P, 7, 9)); g.sprite([110, 10, 0], P => Q1.barrow(P));
    g.sprite([116, 30, 0], P => Q1.pumpkin(P)); g.sprite([122, 34, 0], P => Q1.pumpkin(P));
    g.sprite([14, 50, 0], P => Q1.planter(P, 15)); g.sprite([14, 64, 0], P => Q1.planter(P, 15));
    g.sprite([92, 35.5, 14], P => Q1.lantern(P));
  } },
  { name: 'Р5 · Каменная башня крупными блоками с пирамидой, низкий бревенчатый дом, козырёк и крыльцо с перилами', make(g) {
    const Tw = { x0: 10, x1: 42, y0: 48, y1: 92, h: 48 }, M = { x0: 42, x1: 116, y0: 32, y1: 92, h: 24 };
    box(g, Object.assign({ mat: m1Stone(P1.stoneB, 7, 4) }, Tw));
    box(g, Object.assign({ mat: split1(6, m1Stone(P1.stone, 5, 3), m1Logs(P1.log)) }, M));
    roof(g, Tw, { type: 'pyr', axis: 'X', rise: 24, ov: 3, mat: m1Tile(P1.tileD), cut: m1Fascia, th: 2 });
    roof(g, M, { type: 'gable', axis: 'X', rise: 20, ov: 3, ovg: 4, mat: m1Tile(P1.tileD), cut: m1Fascia, th: 2, gable: m1Plank(P1.plank, 4) });
    chimney1(g, 96, 66, M.h, 22, { w: 6, d: 6 });
    elem(g, 'S', Tw.y0, 20, 32, 8, 10, WIN1(8, 10, { arch: true })); elem(g, 'S', Tw.y0, 22, 12, 6, 8, WIN1(6, 8, { arch: true, lit: false }));
    elem(g, 'E', Tw.x1, 64, 32, 8, 10, WIN1(8, 10, { arch: true }));
    elem(g, 'S', M.y0, 73, 0, 14, 17, DOOR1(14, 17, { col: P1.plank }));
    roof(g, { x0: 68, x1: 92, y0: 26, y1: 32, h: 19 }, { type: 'lean', down: 'S', rise: 4, ov: 1, mat: m1Tile(P1.tileD), cut: m1Fascia, th: 1.5 });
    S([[68, 26], [90, 26]], (x, y) => post1(g, x, y, 0, 18));
    elem(g, 'S', M.y0, 50, 7, 9, 10, WIN1(9, 10)); elem(g, 'S', M.y0, 100, 7, 9, 10, WIN1(9, 10)); elem(g, 'E', M.x1, 56, 7, 9, 10, WIN1(9, 10));
    beam1(g, 96, 126, 8, 32, 0, 2.5, P1.plank);
    S([[98, 9], [122, 9], [122, 24]], (x, y) => post1(g, x, y, 2.5, 18));
    roof(g, { x0: 98, x1: 124, y0: 10, y1: 32, h: 20.5 }, { type: 'lean', down: 'S', rise: 5, ov: 2, mat: m1Tile(P1.tileD), cut: m1Fascia, th: 1.5 });
    railing1(g, 98, 122, 9, 9, 2.5, 6); railing1(g, 124, 124, 9, 28, 2.5, 6);
    g.sprite([110, 20, 2.5], P => Q1.bench(P, 10));
    g.sprite([80, 31, 0], P => Q1.steps(P, 16, 1));
    g.sprite([118, 32, 26], P => Q1.sign(P, 'mug', 1));
    g.sprite([96, 31.5, 14], P => Q1.lantern(P));
    g.sprite([22, 22, 0], P => Q1.barrel(P)); g.sprite([34, 16, 0], P => Q1.barrel(P, 7, 9));
    S([[10, 10], [50, 12], [60, 6], [116, 42], [4, 44]], (x, y) => g.sprite([x, y, 0], P => Q1.flowers((px, py, c) => P(px, py, P1.grass[1 + (px % 2)]), 7)));
    g.sprite([26, 70, 72], P => Q1.pennant(P, 12));
  } },
  { name: 'Р6 · Компактный фасадный домик: синяя чешуя, кирпичный низ, большие окна с цветами, фонарь-шар; дворик с дорожкой', make(g) {
    const M = { x0: 44, x1: 112, y0: 44, y1: 92, h: 32 };
    box(g, Object.assign({ mat: split1(14, m1Brick(P1.brick), m1Plaster(P1.plasterC, { frame: true, bay: 20, mid: true, braceX: true, beam: P1.beamD })) }, M));
    roof(g, M, { type: 'gable', axis: 'Y', rise: 32, ov: 3, ovg: 5, mat: m1Scale(P1.scale), cut: m1FasciaDark, th: 2, gable: m1Plaster(P1.plasterC, { frame: true, bay: 14, brace: false, beam: P1.beamD }) });
    chimney1(g, 98, 70, M.h + 8, 24, { brick: true, w: 5, d: 5 });
    elem(g, 'S', M.y0, 73, 0, 14, 19, DOOR1(14, 19, { arch: true, knob: true, col: P1.dark }));
    elem(g, 'S', M.y0, 50, 6, 11, 12, WIN1(11, 12, { lit: false, frameR: P1.beamD }));
    elem(g, 'S', M.y0, 68, 38, 16, 14, WIN1(16, 14, { lit: false, frameR: P1.beamD, arch: true })); g.sprite([76, 43.5, 37], P => Q1.planter(P, 15), -0.5);
    elem(g, 'S', M.y0, 96, 20, 9, 10, WIN1(9, 10, { lit: false, frameR: P1.beamD })); g.sprite([100.5, 43.5, 19], P => Q1.planter(P, 9), -0.5);
    elem(g, 'E', M.x1, 56, 6, 11, 12, WIN1(11, 12, { lit: false, frameR: P1.beamD })); elem(g, 'E', M.x1, 62, 26, 9, 10, WIN1(9, 10, { frameR: P1.beamD }));
    g.sprite([114, 44, 26], P => Q1.sign(P, 'lamp', 1));
    g.sprite([80, 43, 0], P => Q1.steps(P, 16, 2));
    fence1(g, 4, 62, 8, 8); fence1(g, 98, 126, 8, 8); fence1(g, 4, 4, 8, 90);
    for (let k = 0; k < 5; k++) g.sprite([80 + (k % 2 ? 2 : -2), 12 + k * 6, 0], P => Q1.stones(P));
    g.sprite([22, 68, 0], P => Q1.tree(P, 14));
    g.sprite([24, 22, 0], P => Q1.planter(P, 17)); g.sprite([30, 36, 0], P => Q1.planter(P, 15));
    g.sprite([112, 20, 0], P => Q1.barrel(P)); g.sprite([122, 30, 0], P => Q1.barrel(P, 7, 9)); g.sprite([110, 32, 0], P => Q1.bench(P, 12));
    g.sprite([50, 12, 0], P => Q1.flowers(P, 14)); g.sprite([104, 12, 0], P => Q1.flowers(P, 10));
    g.sprite([42, 42, 0], P => Q1.mushroom(P, 3));
  } },
  { name: 'Сводный · Камень + фахверк с нависанием, крестовая черепица с плющом и слуховым окном, галерея, тент, цветы, дым', make(g) {
    const Lo = { x0: 14, x1: 112, y0: 24, y1: 92, h: 16 }, Up = { x0: 10, x1: 116, y0: 20, y1: 92, z0: 16, h: 20 }, Wg = { x0: 84, x1: 124, y0: 10, y1: 56, h: 36 };
    box(g, Object.assign({ mat: m1Stone(P1.stone) }, Lo));
    beam1(g, 10, 116, 20, 24, 15, 1, P1.plank);
    box(g, Object.assign({ mat: m1Plaster(P1.plaster, { frame: true, bay: 16, mid: true, braceOdd: true }) }, Up));
    box(g, Object.assign({ mat: split1(16, m1Stone(P1.stone), m1Plaster(P1.plaster, { frame: true, bay: 16, mid: true })) }, Wg));
    const r = { type: 'gable', axis: 'X', rise: 24, ov: 3, ovg: 4, mat: m1Ivy(m1Tile(P1.tileR), [{ u: 30, v: 16, rx: 14, ry: 10 }, { u: 18, v: 34, rx: 8, ry: 7 }]), cut: m1Fascia, th: 2, gable: m1Plaster(P1.plaster, { frame: true, bay: 12, brace: false }) };
    roof(g, Up, r); const rz = rzOf(Up, r);
    dormer(g, 44, 18, 14, 9, 8, rz, m1Plaster(P1.plaster, { frame: true, bay: 10, brace: false }), m1Tile(P1.tileR), m1Fascia, null);
    elem(g, 'S', 17.7, 40, rz(18) - 1 + 1, 7, 7, WIN1(7, 7));
    roof(g, Wg, { type: 'gable', axis: 'Y', rise: 24, ov: 3, ovg: 4, mat: m1Tile(P1.tileR), cut: m1Fascia, th: 2, gable: m1Plaster(P1.plaster, { frame: true, bay: 12, brace: false }) });
    chimney1(g, 22, 62, Up.z0 + Up.h, 26, { w: 6, d: 6 });
    beam1(g, 12, 84, 12, 20, 15, 2, P1.plank);
    S([[14, 13], [48, 13]], (x, y) => post1(g, x, y, 0, 15));
    railing1(g, 13, 83, 13, 13, 17, 6);
    elem(g, 'S', Lo.y0, 73, 0, 14, 16, DOOR1(14, 16, { arch: true }));
    elem(g, 'S', Lo.y0, 26, 4, 9, 10, WIN1(9, 10)); elem(g, 'S', Lo.y0, 50, 4, 9, 10, WIN1(9, 10));
    S([[20], [42], [64]], x => { elem(g, 'S', Up.y0, x, 22, 9, 9, WIN1(9, 9)); g.sprite([x + 4.5, 19.5, 21], P => Q1.planter(P, 9), -0.5); });
    elem(g, 'S', Wg.y0, 92, 6, 10, 11, WIN1(10, 11, { sill: true })); elem(g, 'S', Wg.y0, 94, 24, 8, 9, WIN1(8, 9)); elem(g, 'S', Wg.y0, 100, 40, 7, 9, WIN1(7, 9, { arch: true }));
    elem(g, 'E', Wg.x1, 22, 6, 10, 11, WIN1(10, 11)); elem(g, 'E', Wg.x1, 26, 24, 8, 9, WIN1(8, 9)); elem(g, 'E', Lo.x1, 72, 4, 9, 10, WIN1(9, 10));
    S([[16, 2], [50, 2]], (x, y) => post1(g, x, y, 0, 16));
    roof(g, { x0: 16, x1: 52, y0: 4, y1: 12, h: 17 }, { type: 'lean', down: 'S', rise: 4, ov: 2, mat: m1Awning(), cut: m1Flat(P1.red[1]), th: 1 });
    g.sprite([26, 8, 0], P => Q1.table(P, 14)); g.sprite([44, 9, 0], P => Q1.bench(P, 10));
    g.sprite([126, 10, 28], P => Q1.sign(P, 'mug', 1));
    g.sprite([94, 23.5, 14], P => Q1.lantern(P)); g.sprite([66, 23.5, 14], P => Q1.lantern(P));
    g.sprite([80, 23, 0], P => Q1.steps(P, 16, 2));
    g.sprite([6, 30, 0], P => Q1.barrel(P)); g.sprite([4, 44, 0], P => Q1.barrel(P, 7, 9)); g.sprite([70, 6, 0], P => Q1.barrel(P, 7, 9));
    g.sprite([116, 4, 0], P => Q1.planter(P, 13)); g.sprite([6, 70, 0], P => Q1.tree(P, 13));
    g.sprite([100, 8, 0], P => Q1.flowers(P, 10)); g.sprite([60, 20, 0], P => Q1.stones(P));
    g.sprite([104, 10, 72], P => Q1.pennant(P, 10));
  } },
];

BDEFS.tav1 = { w: 4, h: 3, top: 86, vars: TAV1_VARS, title: 'Трактир в масштабе референсов (1 px = 1 мировой px)', bk: 1, ink: P1.ink };
BDEFS.tav15 = { w: 4, h: 3, top: 86, vars: TAV1_VARS, title: 'Те же модели, шаг пикселя ×1.5', bk: 1.5, ink: P1.ink };
