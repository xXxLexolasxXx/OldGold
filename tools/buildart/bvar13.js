'use strict';
// Блок 1, вторая итерация по выбору владельца:
//  колодец — каменный под красной крышей, ровно (фронтон к зрителю), с дорожкой и чуть волшебной водой;
//  лазарет — от варианта 1 (дом в углу, котёл зельевара) + огород лечебных трав; 3 варианта;
//  извозчик — домик в углу, выгул-поле с загонами (лошади и телеги — игровые, анимация);
//  торговый пост — контора с пристройкой (вариант 2), спереди подъезжает торговая телега, торговец грузит;
//  загон для коз — сарай в углу и большой загон (козы — игровые, ходят по загону).

function herbBeds(g, x0, x1, y0, y1) {
  box(g, { x0, x1, y0, y1, h: 1.2, mat: m1Plank(P1.plank, 3), top: (u, v) => ((v | 0) % 6 < 1 ? P1.plank[1] : (u + v) % 5 < 1 ? bhex('#4e3a28') : bhex('#6a5236')) });
  for (let y = y0 + 3; y < y1; y += 6) g.sprite([(x0 + x1) / 2, y, 1.2], P => { const w = (x1 - x0) / 2 - 2; for (let x = -w; x <= w; x += 3) { const h = 2 + ((x + y) & 1); PR.rect(P, x, -h, x, 0, P1.grass[1 + ((x + y) & 1)]); if ((x + y) % 4 === 0) P(x, -h - 1, [P1.white[0], P3.crystal[1], P1.gold[0], P1.red[0]][((x + y) / 4 + 99 | 0) % 4]); } }, -0.2);
}

// =================== КОЛОДЕЦ ===================
function buildWell(g, lv) {
  g.meta = {};
  const R = STRS(lv, STRAW_X.moss, P1.tileR);
  paveSand(g, 26, 38, 0, 26);
  cyl(g, 32, 38, 10, 0, 8, m1Stone(P1.stoneW, 5, 3), 22);
  g.face(Array.from({ length: 20 }, (_, i) => [32 + Math.cos(i / 20 * 6.283) * 8.5, 38 + Math.sin(i / 20 * 6.283) * 8.5, 8.01]), [1, 0, 0], [0, 1, 0], (u, v) => ((u * 3 + v) % 13 < 1 ? P3.rune[0] : (u + v) % 6 < 1 ? P1.scale[1] : P1.scale[2]));
  for (const y of [32, 44]) { post1(g, 21, y, 8, 13, 2, P3.oak); post1(g, 41, y, 8, 13, 2, P3.oak); }
  beam1(g, 22, 42, 37.5, 39, 17, 1.5, P1.plank);
  roof(g, { x0: 20, x1: 44, y0: 30, y1: 47, h: 21 }, { type: 'gable', axis: 'Y', rise: 9, ov: 2, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plank, 3) });   // фронтон к зрителю — колодец стоит ровно
  g.sprite([32, 37, 10], P => QW.bucket(P), -0.5); g.sprite([22, 37, 15], P => { PR.rect(P, -3, -2, 3, 2, P1.plank[2]); PR.rect(P, -4, 0, -3, 0, P1.iron[1]); }, -0.5);   // ворот
  g.sprite([48, 18, 0], P => QW.trough(P)); g.sprite([14, 18, 0], P => Q1.bench(P, 10)); g.sprite([16, 30, 0], P => QW.bucket(P));
  g.meta.doorPt = [32, 26, 0]; g.meta.bucket = [32, 37, 10];
  if (lv >= 2) { g.sprite([8, 44, 0], P => Q1.planter(P, 9)); g.sprite([56, 44, 0], P => Q1.flowers(P, 8)); }
  if (lv >= 3) { g.sprite([52, 28, 0], P => Q1.lantern(P)); g.sprite([10, 52, 0], P => Q3.shroomPatch(P)); }
}

// =================== ЛАЗАРЕТ: три варианта от первого ===================
function infBase(g, lv, o) {
  g.meta = { cots: [] };
  const R = STRS(lv, o.straw, o.tile);
  const M = { x0: 2, x1: o.w, y0: 34, y1: 62, h: 16 };
  box(g, Object.assign({ mat: o.wall }, M));
  (o.sag ? roofSag : roof)(g, M, Object.assign({ type: 'gable', axis: 'X', rise: 16, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: o.gable }, o.sag ? { sag: 2, flare: 3 } : {}));
  elem(g, 'S', M.y0, o.w - 16, 0, 10, 12, m1Door({ w: 10, h: 12, arch: true, col: P1.red })); g.meta.doorPt = [o.w - 11, M.y0, 0];
  elem(g, 'S', M.y0, 6, 4, 9, 8, m1Window({ w: 9, h: 8, sill: true }));
  chimney1(g, 8, 50, M.h + 8, 10, { stone: true, w: 5, d: 5 });
  g.sprite([o.w + 2, 33, 0], P => QW.cross(P));
  g.sprite([14, 22, 0], P => QW.cauldron(P)); g.meta.cauldron = [14, 22, 0];   // зельевар варит отвар
  return M;
}
const INF2_VARS = [
  { name: 'ЛА. Белёный дом в углу, котёл зельевара, огород трав и навес с койками справа', make(g, lv) {
    infBase(g, lv, { w: 40, straw: STRAW_X.pale, tile: P1.tileR, wall: m1Plaster(P1.plasterW || P1.plaster, { low: 4, stoneR: P1.stoneW }), gable: m1Plaster(P1.plaster) });
    herbBeds(g, 4, 34, 4, 16); g.meta.garden = [19, 10, 1.2];
    for (const [x, y] of [[54, 14], [92, 14], [54, 36], [92, 36]]) post1(g, x, y, 0, 13, 2);
    roof(g, { x0: 54, x1: 94, y0: 14, y1: 38, h: 13 }, { type: 'lean', down: 'S', rise: 5, ov: 2, mat: m1Awning(P1.red, P1.white), cut: m1Flat(P1.red[1]), th: 1.5 });
    for (const [x, y] of [[64, 28], [84, 28]]) { g.sprite([x, y, 0], P => QW.cot(P)); g.meta.cots.push([x, y, 0]); }
    if (lv >= 2) { g.sprite([74, 20, 0], P => QW.cot(P)); g.meta.cots.push([74, 20, 0]); g.sprite([44, 18, 0], P => QW.rack(P)); }
    if (lv >= 3) { g.sprite([92, 50, 0], P => Q3.crystalLamp(P, 12)); g.sprite([48, 52, 0], P => Q1.planter(P, 9)); }
  } },
  { name: 'ЛБ. Фахверк в углу, котёл и сушилки трав, большой огород на всю площадку', make(g, lv) {
    infBase(g, lv, { w: 38, straw: STRAW_X.moss, tile: P1.tileD, wall: m1Plaster(P1.plaster, { frame: true, bay: 10, braceOdd: true, low: 4 }), gable: m1Plaster(P1.plaster, { frame: true, bay: 8, brace: false }), sag: true });
    herbBeds(g, 46, 94, 30, 60); g.meta.garden = [70, 44, 1.2];
    g.sprite([56, 20, 0], P => QW.rack(P)); g.sprite([82, 20, 0], P => QW.rack(P));
    g.sprite([34, 12, 0], P => QW.cot(P)); g.meta.cots.push([34, 12, 0]);
    if (lv >= 2) { g.sprite([70, 10, 0], P => QW.cot(P)); g.meta.cots.push([70, 10, 0]); }
    if (lv >= 3) { g.sprite([94, 10, 0], P => Q1.lantern(P)); g.sprite([4, 50, 0], P => Q3.shroomPatch(P)); }
  } },
  { name: 'ЛВ. Каменная лечебница в углу, теплица-навес с травами, котёл и колодец для отвара', make(g, lv) {
    infBase(g, lv, { w: 42, straw: STRAW_X.rust, tile: P1.slate, wall: m1Stone(P1.stoneW, 6, 4), gable: m1Stone(P1.stoneW, 6, 4) });
    for (const [x, y] of [[52, 34], [92, 34], [52, 60], [92, 60]]) post1(g, x, y, 0, 12, 2, P3.oak);
    roof(g, { x0: 52, x1: 94, y0: 34, y1: 62, h: 12 }, { type: 'gable', axis: 'X', rise: 6, ov: 2, ovg: 2, mat: (u, v, F) => ((u | 0) % 8 < 1 ? P3.oak[1] : P3.crystal[0]), cut: m1Flat(P3.oak[2]), th: 1 });   // стеклянная теплица
    herbBeds(g, 54, 92, 36, 60); g.meta.garden = [73, 48, 1.2];
    g.sprite([60, 16, 0], P => QW.cot(P)); g.sprite([82, 16, 0], P => QW.cot(P)); g.meta.cots.push([60, 16, 0], [82, 16, 0]);
    g.sprite([40, 14, 0], P => QW.bucket(P));
    if (lv >= 2) g.sprite([94, 24, 0], P => QW.rack(P));
    if (lv >= 3) g.sprite([4, 10, 0], P => Q3.crystalLamp(P, 12));
  } },
];

// =================== ИЗВОЗЧИК ===================
function buildStable(g, lv) {
  g.meta = {};
  const R = STRS(lv, STRAW_X.pale, P1.slate);
  const M = { x0: 2, x1: 30, y0: 40, y1: 62, h: 14 };
  box(g, Object.assign({ mat: m1Stone(P1.stoneW, 6, 4) }, M));
  roof(g, M, { type: 'hip', axis: 'X', rise: 11, hipL: 9, ov: 3, mat: R.mat, cut: R.cut, th: R.th });
  elem(g, 'S', M.y0, 12, 0, 9, 11, m1Door({ w: 9, h: 11, arch: true, col: P3.oak })); g.meta.doorPt = [16, M.y0, 0];
  elem(g, 'S', M.y0, 3, 4, 6, 6, m1Window({ w: 6, h: 6 }));
  g.sprite([32, 34, 0], P => QW.horn(P));
  // выгул: поле и два загона, где ходят лошади (игровые), у ворот — телега
  groundYard(g, 36, 94, 4, 62);
  fence1(g, 38, 92, 60, 60); fence1(g, 92, 92, 34, 60); fence1(g, 38, 38, 34, 60); fence1(g, 38, 60, 34, 34); fence1(g, 72, 92, 34, 34);
  fence1(g, 38, 92, 6, 6); fence1(g, 92, 92, 6, 28);
  g.sprite([86, 50, 0], P => QW.trough(P)); g.sprite([44, 50, 0], P => Q1.hay(P, 7));
  g.meta.pens = [[[42, 38], [88, 56]], [[42, 10], [88, 26]]];
  g.meta.cartSpot = [20, 18, 0];
  paveSand(g, 10, 34, 8, 40);
  if (lv >= 2) { g.sprite([86, 22, 0], P => QW.trough(P)); g.sprite([4, 18, 0], P => Q1.streetLamp(P, 12)); }
  if (lv >= 3) { g.sprite([46, 20, 0], P => Q1.hay(P, 6)); g.sprite([4, 34, 0], P => Q2.sacks(P, 3)); }
}

// =================== ТОРГОВЫЙ ПОСТ ===================
function buildTrade(g, lv) {
  g.meta = {};
  const R = STRS(lv, STRAW_X.rust, P1.slate);
  const M = { x0: 2, x1: 40, y0: 54, y1: 94, h: 20 }, A = { x0: 40, x1: 70, y0: 70, y1: 94, h: 12 };
  box(g, Object.assign({ mat: m1Plaster(P1.plasterC, { frame: true, bay: 12, braceX: true, beam: P3.oak }) }, M));
  roof(g, M, { type: 'gable', axis: 'Y', rise: 20, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plasterC, { frame: true, bay: 10, brace: false, beam: P3.oak }) });
  box(g, Object.assign({ mat: m1Plank(P1.plank, 4) }, A));
  roof(g, A, { type: 'lean', down: 'S', rise: 6, ov: 2, mat: R.mat, cut: R.cut, th: 2 });
  elem(g, 'S', M.y0, 14, 0, 10, 13, m1Door({ w: 10, h: 13, arch: true, col: P3.oak })); g.meta.doorPt = [19, M.y0, 0];
  elem(g, 'S', A.y0, 48, 0, 14, 10, m1Door({ w: 14, h: 10, double: true, col: P1.plank })); g.meta.annexDoor = [55, A.y0, 0];
  elem(g, 'S', M.y0, 4, 6, 7, 7, m1Window({ w: 7, h: 7 })); elem(g, 'S', M.y0, 28, 6, 7, 7, m1Window({ w: 7, h: 7 }));
  // площадка погрузки: дорога въезда, весы, товар; телегу и торговца рисует игра
  paveSand(g, 40, 94, 8, 66);
  g.sprite([46, 62, 0], P => Q2.scale(P)); g.sprite([88, 62, 0], P => Q2.crates(P)); g.sprite([30, 40, 0], P => Q2.sacks(P, 4)); g.sprite([88, 76, 0], P => Q2.barrels(P));
  g.meta.cartSpot = [68, 34, 0]; g.meta.loadFrom = [55, 66, 0];
  if (lv >= 2) { g.sprite([8, 40, 0], P => Q2.crates(P)); g.sprite([46, 16, 0], P => Q1.streetLamp(P, 13)); }
  if (lv >= 3) { g.sprite([24, 24, 0], P => QW.stall(P, P1.scale)); g.sprite([92, 16, 0], P => Q1.streetLamp(P, 13)); }
}

// =================== ЗАГОН ДЛЯ КОЗ ===================
function buildGoat(g, lv) {
  g.meta = {};
  const R = STRS(lv, STRAW_X.moss, P1.tileR);
  const M = { x0: 2, x1: 28, y0: 42, y1: 62, h: 11 };
  box(g, Object.assign({ mat: m1Plank(P1.plank, 4) }, M));
  roof(g, M, { type: 'gable', axis: 'X', rise: 10, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plank, 4) });
  elem(g, 'S', M.y0, 9, 0, 9, 9, m1Door({ w: 9, h: 9, col: P1.plank })); g.meta.doorPt = [13, M.y0, 0];
  groundYard(g, 32, 94, 4, 62);
  fence1(g, 32, 94, 4, 4); fence1(g, 94, 94, 4, 62); fence1(g, 32, 32, 4, 30); fence1(g, 32, 94, 62, 62);
  g.sprite([86, 54, 0], P => Q1.hay(P, 8)); g.sprite([46, 12, 0], P => QW.trough(P));
  g.meta.pen = [[38, 10], [88, 56]];
  if (lv >= 2) { g.sprite([18, 24, 0], P => QW.bucket(P)); g.sprite([62, 52, 0], P => Q1.hay(P, 6)); boulder(g, 70, 34, 6, 6); }
  if (lv >= 3) { g.sprite([10, 20, 0], P => Q1.bench(P, 10)); g.sprite([4, 34, 0], P => Q1.planter(P, 9)); }
}

const BL = (make, title, w, h, top) => ({ w, h, top, vars: [1, 2, 3].map(lv => ({ name: `уровень ${lv}`, make: g => make(g, lv) })), title, bk: 1, ink: P1.ink });
BDEFS.well2 = BL(buildWell, 'Колодец', 2, 2, 54);
BDEFS.inf2 = BV(INF2_VARS, 'Лазарет: 3 варианта от первого', 3, 2, 64);
BDEFS.stable2 = BL(buildStable, 'Извозчик', 3, 2, 70);
BDEFS.trade2 = BL(buildTrade, 'Торговый пост', 3, 3, 62);
BDEFS.goat2 = BL(buildGoat, 'Загон для коз', 3, 2, 50);
