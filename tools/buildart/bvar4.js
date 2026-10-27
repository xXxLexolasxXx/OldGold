'use strict';
// Единый трактир (сводный из вариантов 2, 3, 4, 6, 7 листа ×1) + игровая механика нынешнего трактира:
// открытая веранда без крыши (стол, гостей, официантку и дождевой тент рисует inside.js поверх спрайта),
// открытая кухня-двор (печь-купол → spr.oven, полки с запасами → spr.pantry, стойка), крыло бара с окном барменши
// → spr.bar, дверь на юге → spr.doorPt, окна → spr.wins. Лот 128×96, дверь на x=80. Масштаб 1 px = 1 мировой px.
// Уровни: 1 — солома (свой оттенок), веранда малая; 2 — дранка, веранда больше, гирлянда и фонари во дворе;
// 3 — черепица, вторая терраса с перголой слева, бочка-бар, сцена для музыканта, балкон на фронтоне.

function m1Shelves(w, h) {
  return (u, v) => {
    for (const r of [3, 9, 15]) { if (v >= r && v < r + 1) return P1.plank[u % 7 === 0 ? 3 : 1]; if (v >= r + 1 && v < r + 2 && u % 7 === 3) return P1.plank[3]; }
    if (u < 1 || u > w - 2) return P1.beam[2];
    if (((u + Math.floor(v / 4)) % 5) === 0) return P1.dark[2];
    return P1.dark[1];
  };
}
function oven1(g, cx, cy) {
  cyl(g, cx, cy, 7, 0, 9, m1Stone(P1.stoneW, 4, 3), 16);
  dome(g, cx, cy, 7.5, 8.5, 6, (u, v, F) => m1Stone(P1.stoneW, 4, 3)(u, v, Object.assign({}, F, { h: 0 })), m1Flat(P1.stoneW[2]), 16, 4, 1);
  elem(g, 'S', cy - 7 + 0.6, cx - 3, 1.5, 6, 5, (u, v) => (v > 3.5 && Math.abs(u - 2.5) > 1.6 ? P1.stoneW[3] : v < 1 ? P1.ink : P1.beam[3]));
  box(g, { x0: cx - 5, x1: cx + 5, y0: cy + 5, y1: cy + 9, z0: 9, h: 10, mat: m1Brick(P1.brick), top: m1Flat(P1.stone[2]) });
}
function S2(list, fn) { for (const a of list) fn(...a); }
// гирлянда флажков между двумя точками (плакат с глубиной середины)
function bunting(g, a, b, n = 7) {
  const A = [g.sx(...g.W3(a).slice(0, 2)), g.sy(g.W3(a)[1], a[2])], B = [g.sx(...g.W3(b).slice(0, 2)), g.sy(g.W3(b)[1], b[2])];
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  g.sprite(mid, (P, bx, by) => {
    const cols = [P1.red, P1.gold, P1.scale, P1.white, P1.grass];
    for (let i = 0; i <= n * 4; i++) { const t = i / (n * 4), x = Math.round(A[0] + (B[0] - A[0]) * t) - bx, y = Math.round(A[1] + (B[1] - A[1]) * t + Math.sin(t * Math.PI) * 4) - by; P(x, y, P1.beam[1]); if (i % 4 === 2) { const R = cols[(i >> 2) % cols.length]; P(x, y + 1, R[0]); P(x - 1, y + 1, R[0]); P(x, y + 2, R[1]); } }
  }, -2);
}
function lampPost(g, x, y) { g.sprite([x, y, 0], P => Q1.streetLamp(P, 16)); }
function mugs(g, x, y, z) { g.sprite([x, y, z], P => { P(0, -2, P1.gold[1]); P(0, -1, P1.gold[1]); P(1, -1, P1.gold[2]); P(0, -3, P1.white[0]); }, -1); }

// roofs: { main, wing, cut, cutW } материалы кровель по уровню
function buildInn(g, lv, roofs) {
  const meta = g.meta = { wins: [], tables: [] };
  const WIN = (side, at, a, z, w, h, o = {}) => { elem(g, side, at, a, z, w, h, m1Window(Object.assign({ w, h }, o))); meta.wins.push({ side, at, a, z, w, h, round: !!o.round }); };
  const deckTop = (u, v) => (((v | 0) % 3) === 0 ? P1.plank[2] : P1.plank[(u + v) % 9 < 1 ? 1 : 0]);
  // ---- главный дом: компактный, отодвинут вглубь — спереди широкая зона действия
  const Lo = { x0: 42, x1: 100, y0: 50, y1: 92, h: 15 }, Up = { x0: 38, x1: 104, y0: 46, y1: 92, z0: 15, h: 18 };
  box(g, Object.assign({ mat: m1Stone(P1.stone) }, Lo));
  beam1(g, 38, 104, 46, 50, 14, 1, P1.plank);
  box(g, Object.assign({ mat: m1Plaster(P1.plaster, { frame: true, bay: 16, mid: true, braceOdd: true }) }, Up));
  roof(g, Up, { type: 'gable', axis: 'Y', rise: 30, ov: 3, ovg: 5, mat: m1Ivy(roofs.main, [{ u: 30, v: 16, rx: 12, ry: 9 }, { u: 18, v: 32, rx: 7, ry: 6 }]), cut: roofs.cut, th: 2, gable: m1Plaster(P1.plaster, { frame: true, bay: 13, brace: false }) });
  chimney1(g, 48, 72, Up.z0 + Up.h, 20, { w: 6, d: 6 });
  WIN('S', Up.y0, 65, 36, 12, 14, { arch: true });
  if (lv >= 3) {
    beam1(g, 58, 84, 40, 46, 34, 2, P1.plank); railing1(g, 58, 84, 40.5, 40.5, 36, 5); railing1(g, 58, 58, 40.5, 46, 36, 5); railing1(g, 84, 84, 40.5, 46, 36, 5);
    g.sprite([71, 40, 41], P => Q1.planter(P, 11), -0.5);
  } else g.sprite([71, 45.5, 35], P => Q1.planter(P, 13), -0.5);
  elem(g, 'S', Up.y0 - 0.3, 63, 52, 16, 7, m1Sprite(16, 7, P => Q1.board(P, 'mug', 16, 7)));
  WIN('S', Lo.y0, 46, 4, 9, 10, { sill: true });
  elem(g, 'S', Lo.y0, 73, 0, 14, 15, m1Door({ w: 14, h: 15, arch: true, knob: true }));
  meta.doorPt = [80, Lo.y0, 0];
  elem(g, 'S', Lo.y0, 90, 0, 8, 11, m1Door({ w: 8, h: 11, col: P1.dark }));                      // дверь кухни
  for (const x of [44, 60, 86]) { WIN('S', Up.y0, x, 20, 9, 9); if (x !== 60) g.sprite([x + 4.5, 45.5, 19], P => Q1.planter(P, 9), -0.5); }
  WIN('E', Lo.x1, 58, 4, 9, 10, {}); WIN('E', Lo.x1, 78, 4, 9, 10, {}); WIN('E', Up.x1, 70, 20, 9, 9);
  S2([[68, 44], [90, 44]], (x, y) => post1(g, x, y, 0, 14));
  roof(g, { x0: 68, x1: 92, y0: 46, y1: 50, h: 15 }, { type: 'lean', down: 'S', rise: 3, ov: 2, mat: m1Awning(), cut: m1Flat(P1.red[1]), th: 1 });
  g.sprite([64, 49.5, 12], P => Q1.lantern(P)); g.sprite([96, 49.5, 12], P => Q1.lantern(P));
  g.sprite([80, 49, 0], P => Q1.steps(P, 16, 2));
  // ---- бар-пристройка сзади справа (6): кирпич, холодный фахверк, синяя чешуя, окно барменши
  const Wb = { x0: 104, x1: 126, y0: 66, y1: 92, h: 12 }, Ub = { x0: 102, x1: 126, y0: 64, y1: 92, z0: 12, h: 14 };
  box(g, Object.assign({ mat: m1Brick(P1.brick) }, Wb));
  beam1(g, 102, 126, 64, 66, 11, 1, P1.plank);
  box(g, Object.assign({ mat: m1Plaster(P1.plasterC, { frame: true, bay: 14, mid: true, braceX: true, beam: P1.beamD }) }, Ub));
  roof(g, Ub, { type: 'gable', axis: 'Y', rise: 18, ov: 3, ovg: 4, mat: roofs.wing, cut: roofs.cutW, th: 2, gable: m1Plaster(P1.plasterC, { frame: true, bay: 12, brace: false, beam: P1.beamD }) });
  chimney1(g, 116, 84, Ub.z0 + Ub.h + 3, 16, { brick: true, w: 5, d: 5 });
  WIN('S', Ub.y0, 109, 15, 10, 9, { frameR: P1.beamD });
  meta.bar = [114, Ub.y0 - 0.3, 19.5];
  WIN('S', Ub.y0, 104, 28, 6, 7, { arch: true, frameR: P1.beamD, lit: false });
  WIN('E', Ub.x1, 70, 15, 9, 9, { frameR: P1.beamD }); WIN('E', Ub.x1, 82, 15, 9, 9, { frameR: P1.beamD });
  WIN('S', Wb.y0, 106, 2, 7, 8, { frameR: P1.beamD, lit: false });
  g.sprite([127, 64, 20], P => Q1.sign(P, 'lamp', 1));
  g.sprite([114, 64, 44], P => Q1.pennant(P, 10));
  // ---- кухня-двор справа: каменный пол, печь-купол, стеллаж запасов, стойка с кружками, дрова
  const ky0 = lv === 1 ? 26 : lv === 2 ? 32 : 36;
  box(g, { x0: 100, x1: 126, y0: ky0, y1: 64, h: 0.8, mat: m1Flat(P1.stone[2]), top: (u, v, F) => m1Stone(P1.stoneW, 6, 4)(u, v, Object.assign({}, F, { h: 0 })) });
  oven1(g, 117, 54);
  meta.oven = [117, 47, 3];
  box(g, { x0: 101, x1: 113, y0: 54, y1: 62, h: 15, mat: m1Flat(P1.dark[2]), top: m1Flat(P1.plank[1]) });
  elem(g, 'S', 54, 102, 1, 10, 13, m1Shelves(10, 13));
  meta.pantry = [[104, 53.5, 4], [108, 53.5, 4], [104, 53.5, 10], [108, 53.5, 10]];
  roof(g, { x0: 100, x1: 114, y0: 53, y1: 63, h: 15 }, { type: 'lean', down: 'S', rise: 3, ov: 1, mat: m1Plank(P1.plank, 4, false), cut: m1Flat(P1.plank[3]), th: 1 });
  box(g, { x0: 102, x1: 118, y0: ky0 + 1, y1: ky0 + 5, h: 7, mat: m1Plank(P1.plank, 4), top: m1Flat(P1.plank[0]) });
  for (const x of [105, 110, 115]) mugs(g, x, ky0 + 1, 7);
  g.sprite([124, ky0 + 6, 0.8], P => Q1.logs(P)); g.sprite([104, 48, 0.8], P => Q1.barrel(P, 7, 9)); g.sprite([124, 64, 0.8], P => Q1.sack(P));
  // ---- площадка разгрузки слева у дома: поддон, ящики, мешки, тележка (сюда носят припасы)
  box(g, { x0: 8, x1: 38, y0: 50, y1: 64, h: 1, mat: m1Flat(P1.plank[3]), top: (u, v) => P1.plank[(u | 0) % 4 === 0 ? 3 : 2] });
  g.sprite([14, 52, 1], P => Q1.crate(P, 8)); g.sprite([14, 52, 9], P => Q1.crate(P, 7)); g.sprite([26, 54, 1], P => Q1.sack(P)); g.sprite([32, 60, 1], P => Q1.sack(P, 6, 8)); g.sprite([22, 62, 1], P => Q1.barrel(P, 7, 9));
  meta.stock = [[14, 56, 1], [24, 56, 1], [32, 54, 1], [18, 62, 1], [30, 62, 1]];
  g.sprite([4, 42, 0], P => { PR.rect(P, 0, -8, 14, -4, P1.plank[2]); PR.rect(P, 0, -9, 14, -9, P1.plank[0]); PR.rect(P, 14, -7, 20, -7, P1.plank[3]); PR.ell(P, 4, -2, 2.5, 2.5, (x, y, a, b) => (a * a + b * b > 0.5 ? P1.plank[3] : P1.iron[1])); PR.ell(P, 11, -2, 2.5, 2.5, (x, y, a, b) => (a * a + b * b > 0.5 ? P1.plank[3] : P1.iron[1])); });
  // ---- веранда справа спереди (растёт по уровням), без крыши
  const V = { x0: 98, x1: 126, y0: 4, y1: ky0 - 2 };
  box(g, { x0: V.x0, x1: V.x1, y0: V.y0, y1: V.y1, h: 1.2, mat: m1Flat(P1.plank[2]), top: deckTop });
  railing1(g, V.x1, V.x1, V.y0, V.y1, 1.2, 5); railing1(g, V.x0 + 8, V.x1, V.y0, V.y0, 1.2, 5);
  S2([[98, 4], [123, 4], [123, V.y1 - 3]], (x, y) => post1(g, x, y, 1.2, 14, 2));
  beam1(g, 98, 126, 4, 6, 15, 1.2, P1.plank);
  g.sprite([126, 14, 1.2], P => Q1.planter(P, 9), -0.5);
  meta.porch = [112, 11, 1.2];
  if (lv >= 2) {
    g.sprite([112, V.y1 - 7, 1.2], P => Q1.table(P, 14)); meta.tables.push([112, V.y1 - 7, 1.2]);
    g.sprite([124, 5, 15], P => Q1.lantern(P)); g.sprite([99, 5, 15], P => Q1.lantern(P));
    bunting(g, [98, 6, 15], [66, 46, 32]);
  }
  // ---- пивной двор слева спереди
  if (lv < 3) {
    fence1(g, 4, 60, 4, 4); fence1(g, 4, 4, 4, 36);
    g.sprite([14, 20, 0], P => Q1.tree(P, 13));
    g.sprite([40, 14, 0], P => Q1.table(P, 14)); meta.tables.push([40, 14, 0]);
    g.sprite([28, 26, 0], P => Q1.bench(P, 10));
    g.sprite([8, 34, 0], P => Q1.sunflower(P, 18)); g.sprite([4, 38, 0], P => Q1.sunflower(P, 14));
    if (lv === 2) { lampPost(g, 62, 2); g.sprite([52, 28, 0], P => Q1.table(P, 14)); meta.tables.push([52, 28, 0]); g.sprite([56, 10, 0], P => Q1.barrel(P)); bunting(g, [62, 2, 16], [14, 20, 26]); }
  } else {
    box(g, { x0: 4, x1: 60, y0: 2, y1: 34, h: 1.2, mat: m1Flat(P1.plank[2]), top: deckTop });
    railing1(g, 4, 48, 2, 2, 1.2, 5); railing1(g, 4, 4, 2, 34, 1.2, 5);
    S2([[5, 3], [31, 3], [57, 3], [5, 31], [57, 31]], (x, y) => post1(g, x, y, 1.2, 16, 2));
    beam1(g, 5, 59, 3, 5, 17, 1.2, P1.plank); beam1(g, 5, 59, 31, 33, 17, 1.2, P1.plank);
    for (let x = 10; x < 58; x += 8) beam1(g, x, x + 1.5, 3, 33, 18.2, 1, P1.plank);
    g.sprite([18, 12, 1.2], P => Q1.table(P, 14)); g.sprite([44, 12, 1.2], P => Q1.table(P, 14)); g.sprite([30, 26, 1.2], P => Q1.table(P, 14)); meta.tables.push([18, 12, 1.2], [44, 12, 1.2], [30, 26, 1.2]);
    g.sprite([6, 4, 17], P => Q1.lantern(P)); g.sprite([58, 4, 17], P => Q1.lantern(P)); g.sprite([32, 4, 17], P => Q1.lantern(P));
    g.sprite([62, 24, 0], P => { Q1.barrel((x, y, c) => P(x, y - 3, c), 11, 13); PR.rect(P, -6, -3, 6, -3, P1.plank[3]); P(-5, -2, P1.plank[3]); P(5, -2, P1.plank[3]); P(-5, -1, P1.plank[3]); P(5, -1, P1.plank[3]); P(7, -9, P1.iron[1]); P(8, -9, P1.iron[0]); });
    box(g, { x0: 6, x1: 30, y0: 36, y1: 48, h: 3, mat: m1Plank(P1.plank, 4), top: (u, v) => P1.plank[(v | 0) % 4 === 0 ? 2 : 0] });   // сцена
    meta.stage = [18, 42, 3];
    g.sprite([8, 37, 3], P => Q1.barrel(P, 7, 9));
    g.sprite([28, 37, 3], P => { PR.rect(P, 0, -14, 0, 0, P1.beam[2]); PR.rect(P, -3, -14, 3, -14, P1.beam[1]); P(-2, -13, P1.gold[1]); P(2, -13, P1.gold[1]); });
    bunting(g, [4, 2, 17], [58, 2, 17]); bunting(g, [58, 2, 17], [98, 6, 15]);
    lampPost(g, 64, 2);
  }
  for (let k = 0; k < 7; k++) g.sprite([80 + (k % 2 ? 2 : -2), 6 + k * 6, 0], P => Q1.stones(P));
  g.sprite([64, 49, 0], P => Q1.flowers(P, 6)); g.sprite([48, 49, 0], P => Q1.flowers(P, 8)); g.sprite([96, 49, 0], P => Q1.flowers(P, 6));
  g.sprite([66, 2, 0], P => Q1.mushroom(P, 3));
}

const ROOF_LV = {
  1: s => ({ main: m1Straw2(s), wing: m1Straw2(s), cut: (u, v, F) => s[2], cutW: (u, v, F) => s[3] }),
  2: () => ({ main: m1Shingle(SHINGLE1), wing: m1Shingle(SHINGLE1), cut: m1Fascia, cutW: m1FasciaDark }),
  3: () => ({ main: m1Tile2(P1.tileR), wing: m1Scale(P1.scale), cut: m1Fascia, cutW: m1FasciaDark }),
};
const INN_LV_VARS = [
  { name: 'Уровень 1 — солома (ржаная): малая веранда, двор с деревом', make: g => buildInn(g, 1, ROOF_LV[1](STRAW1.rye)) },
  { name: 'Уровень 2 — дранка: веранда больше, второй стол, фонари, гирлянда, бочка во дворе', make: g => buildInn(g, 2, ROOF_LV[2]()) },
  { name: 'Уровень 3 — черепица и чешуя: вторая терраса с перголой, бочка-бар, сцена, балкон на фронтоне', make: g => buildInn(g, 3, ROOF_LV[3]()) },
];
const INN_STRAW_VARS = Object.entries(STRAW1).map(([k, R]) => ({ name: `Солома «${{ rye: 'ржаная', olive: 'оливковая', wheat: 'пшеничная', reed: 'камышовая' }[k]}»`, make: g => buildInn(g, 1, ROOF_LV[1](R)) }));

BDEFS.innlv = { w: 4, h: 3, top: 86, vars: INN_LV_VARS, title: 'Трактир по уровням (×1)', bk: 1, ink: P1.ink };
BDEFS.innstraw = { w: 4, h: 3, top: 86, vars: INN_STRAW_VARS, title: 'Трактир, уровень 1: оттенки соломы', bk: 1, ink: P1.ink };
BDEFS.innfinal = { w: 4, h: 3, top: 86, vars: [INN_LV_VARS[2]], title: 'Трактир — единый вариант (×1)', bk: 1, ink: P1.ink };
