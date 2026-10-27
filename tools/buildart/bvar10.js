'use strict';
// Следующая партия (по 4 варианта на выбор): школа 3×3 (96×96), лесопилка 3×2 (96×64), дом лесоруба 2×2 в пне (64×64),
// каменоломня 2×2 (64×64) — по нынешним правилам: ×1, своя кровля по уровню, двор с делом, вход на юге.
// На листе — уровень 1 и 3, фасад и вход сбоку.

const STR = lv => (lv === 1 ? { mat: m1Straw3(STRAW1.wheat), cut: m1StrawCut(STRAW1.wheat), th: 3 } : lv === 2 ? { mat: m1Shingle2(SHINGLE1, 0.6), cut: m1Fascia, th: 2 } : { mat: m1Tile2(P1.tileR), cut: m1Fascia, th: 2 });
const STRS = (lv, S, T) => (lv === 1 ? { mat: m1Straw3(S), cut: m1StrawCut(S), th: 3 } : lv === 2 ? { mat: m1Shingle2(SHINGLE1, 0.6), cut: m1Fascia, th: 2 } : { mat: T === P1.scale ? m1Scale2(T) : m1Tile2(T), cut: T === P1.slate || T === P1.scale ? m1FasciaDark : m1Fascia, th: 2 });
const QS = {
  board(P) { PR.rect(P, -9, -16, 9, -6, bhex('#2e3a32')); PR.rect(P, -10, -17, 10, -17, P1.plank[1]); PR.rect(P, -10, -5, 10, -5, P1.plank[2]); PR.line(P, -8, 0, -6, -5, P1.plank[2]); PR.line(P, 8, 0, 6, -5, P1.plank[2]); PR.rect(P, -6, -13, -1, -13, P1.white[1]); PR.rect(P, -6, -10, 3, -10, P1.white[1]); P(5, -13, P1.white[0]); P(6, -12, P1.white[0]); },
  desk(P) { PR.rect(P, -5, -6, 5, -5, P1.plank[0]); PR.rect(P, -5, -4, 5, -4, P1.plank[2]); P(-4, -3, P1.plank[3]); P(-4, -2, P1.plank[3]); P(4, -3, P1.plank[3]); P(4, -2, P1.plank[3]); PR.rect(P, -1, -8, 1, -7, P1.white[0]); },
  globe(P) { PR.rect(P, 0, -4, 0, 0, P1.plank[2]); PR.rect(P, -2, 0, 2, 0, P1.plank[3]); PR.ell(P, 0, -8, 4, 4, (x, y, a, b) => (bhash(x, y, 901) < 0.4 ? P1.grass[1] : P1.scale[a < 0 ? 0 : 1])); },
  books(P) { const C = [P1.red, P1.scale, P1.grass, P1.gold, P1.violet || P1.red]; for (let k = 0; k < 5; k++) { PR.rect(P, -6 + k * 2, -6 - (k % 2), -5 + k * 2, 0, C[k % 4][k % 2]); } },
  saw(P, r = 7) { PR.ell(P, 0, -r, r, r, (x, y, a, b) => { const d = a * a + b * b; return d > 0.8 ? ((Math.atan2(b, a) * 8 | 0) % 2 ? P1.iron[1] : P1.iron[2]) : d < 0.08 ? P1.iron[2] : P1.iron[0]; }); },
  wheel(P, r = 13) {   // водяное колесо сбоку
    PR.ell(P, 0, -r, r, r, (x, y, a, b) => { const d = Math.hypot(a, b), an = Math.atan2(b, a); if (d > 0.86) return P1.plank[2]; if (d > 0.72) return (Math.round(an / (Math.PI / 6)) % 2 ? P1.plank[1] : null); if (Math.abs(Math.sin(an * 4)) < 0.12) return P1.plank[3]; return d < 0.18 ? P1.iron[1] : null; });
  },
  water(P, w = 20) { for (let x = -w / 2; x < w / 2; x++) for (let y = -3; y <= 0; y++) P(x, y, (x + y * 2) % 5 === 0 ? P1.white[0] : P1.scale[y < -1 ? 0 : 1]); },
  sawhorse(P) { PR.line(P, -6, 0, -3, -6, P1.plank[2]); PR.line(P, 6, 0, 3, -6, P1.plank[2]); PR.rect(P, -8, -7, 8, -6, P1.plank[1]); PR.ell(P, 0, -9, 9, 2, (x, y, a, b) => (b < 0 ? P1.log[0] : P1.log[2])); PR.rect(P, 1, -14, 2, -9, P1.iron[1]); PR.rect(P, -2, -15, 5, -14, P1.plank[2]); },
  axeBlock(P) { Y1.chop(P); },
  rocks(P, n = 5, R = P1.stone) { for (let k = 0; k < n; k++) { const x = (bhash(k, 0, 911) - 0.5) * 18, y = -bhash(k, 1, 912) * 6, r = 2.5 + bhash(k, 2, 913) * 3; PR.ell(P, x, y, r, r * 0.8, (xx, yy, a, b) => R[b < -0.3 ? 0 : a > 0.4 ? 2 : 1]); } },
  blocks(P) { for (const [x, y] of [[-6, 0], [2, 0], [-2, -5]]) { PR.rect(P, x, y - 5, x + 7, y, P1.stone[1]); PR.rect(P, x, y - 5, x + 7, y - 5, P1.stone[0]); PR.rect(P, x + 7, y - 5, x + 7, y, P1.stone[2]); } },
  pick(P) { PR.line(P, 0, 0, 4, -12, P1.plank[1]); PR.line(P, 0, -13, 8, -10, P1.iron[1]); },
};

// =================== ШКОЛА 3×3 ===================
const SCHOOL2_VARS = [
  { name: 'Ш1. Каменная школа с колокольней и уроком под открытым небом', make(g, lv) {
    g.meta = {};
    const M = { x0: 6, x1: 60, y0: 52, y1: 92, h: 20 }, R = STRS(lv, STRAW1.wheat, P1.slate);
    box(g, Object.assign({ mat: m1Stone(P1.stoneW, 6, 4) }, M));
    roof(g, M, { type: 'gable', axis: 'X', rise: 20, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Stone(P1.stoneW, 6, 4) });
    const T = { x0: 60, x1: 78, y0: 56, y1: 76, h: 40 };
    box(g, Object.assign({ mat: m1Stone(P1.stoneB, 6, 4) }, T));
    roof(g, T, { type: 'hip', axis: 'X', rise: 16, hipL: 10.5, ov: 3, mat: R.mat, cut: R.cut, th: R.th });
    elem(g, 'S', T.y0, 64, 28, 10, 9, m1Window({ w: 10, h: 9, arch: true, lit: false })); g.sprite([69, 55.5, 30], P => Q1.bell(P), -0.5);
    elem(g, 'S', M.y0, 41, 0, 12, 15, m1Door({ w: 12, h: 15, arch: true, knob: true }));
    for (const x of [10, 24]) elem(g, 'S', M.y0, x, 5, 10, 11, m1Window({ w: 10, h: 11, arch: true, sill: true }));
    elem(g, 'E', T.x1, 62, 8, 8, 10, m1Window({ w: 8, h: 10, arch: true }));
    chimney1(g, 14, 80, M.h + 10, 12, { stone: true, w: 5, d: 5 });
    paveSand(g, 40, 54, 0, 52);
    // урок во дворе: доска, парты, глобус
    g.sprite([24, 34, 0], P => QS.board(P)); for (const [x, y] of [[16, 22], [28, 22], [16, 14], [28, 14]]) g.sprite([x, y, 0], P => QS.desk(P));
    g.sprite([70, 30, 0], P => QS.globe(P)); g.sprite([84, 20, 0], P => Q1.tree(P, 13));
    if (lv >= 2) g.sprite([62, 44, 0], P => QS.books(P));
    if (lv >= 3) { g.sprite([4, 40, 0], P => Q1.planter(P, 11)); g.sprite([88, 46, 0], P => Q1.planter(P, 9)); }
  } },
  { name: 'Ш2. Круглая башня-библиотека с телескопом и флигелем', make(g, lv) {
    g.meta = {};
    const cx = 64, cy = 68, rr = 18, R = STRS(lv, STRAW1.reed, P1.scale);
    cyl(g, cx, cy, rr, 0, 34, m1Stone(P1.stoneW, 6, 4), 28);
    cone(g, cx, cy, rr + 4, 33, 26, R.mat, R.cut, 28, 3);
    elem(g, 'S', cy - rr + 1, 59, 0, 10, 14, m1Door({ w: 10, h: 14, arch: true, col: P1.dark }));
    for (const z of [12, 24]) elem(g, 'S', cy - rr + 1.5, 52, z, 6, 8, m1Window({ w: 6, h: 8, arch: true, G: P3.crystal }));
    elem(g, 'E', cx + rr - 1, cy - 3, 20, 6, 8, m1Window({ w: 6, h: 8, arch: true, G: P3.crystal }));
    const F = { x0: 8, x1: 46, y0: 58, y1: 90, h: 16 };
    box(g, Object.assign({ mat: m1Plaster(P1.plaster, { frame: true, bay: 13, braceOdd: true }) }, F));
    roof(g, F, { type: 'gable', axis: 'Y', rise: 18, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plaster, { frame: true, bay: 11, brace: false }) });
    elem(g, 'S', F.y0, 14, 4, 9, 9, m1Window({ w: 9, h: 9, sill: true })); elem(g, 'S', F.y0, 30, 4, 9, 9, m1Window({ w: 9, h: 9, sill: true }));
    g.sprite([cx, cy, 60], P => { if (lv >= 2) { PR.line(P, -6, -2, 8, -12, P1.gold[2], 2); PR.rect(P, 7, -14, 9, -12, P1.gold[1]); } else Q3.owl(P); });
    paveSand(g, 56, 70, 0, 50);
    g.sprite([24, 40, 0], P => QS.books(P)); g.sprite([34, 42, 0], P => QS.globe(P)); g.sprite([22, 30, 0], P => Q1.bench(P, 12));
    g.sprite([86, 30, 0], P => Q3.crystalLamp(P, 16)); g.sprite([88, 52, 0], P => Q3.shroomPatch(P));
    if (lv >= 3) g.sprite([10, 46, 0], P => Q3.runeStone(P, 12));
  } },
  { name: 'Ш3. Длинная изба-школа с крыльцом, садом и партами под навесом', make(g, lv) {
    g.meta = {};
    const M = { x0: 6, x1: 90, y0: 60, y1: 88, h: 16 }, R = STRS(lv, STRAW_H.honey, P1.tileD);
    box(g, Object.assign({ mat: m1Logs(P1.log) }, M));
    roofSag(g, M, { axis: 'X', rise: 18, sag: 2, flare: 3, ov: 4, ovg: 4, mat: R.mat, cut: R.cut, th: R.th + 1, gable: m1Plank(P1.plank, 4) });
    elem(g, 'S', M.y0, 41, 0, 12, 13, m1Door({ w: 12, h: 13, col: P1.dark }));
    for (const x of [10, 24, 62, 76]) elem(g, 'S', M.y0, x, 5, 9, 8, m1Window({ w: 9, h: 8, frameR: P1.plank }));
    box(g, { x0: 34, x1: 60, y0: 50, y1: 60, h: 2, mat: m1Plank(P1.plank, 4, false), top: m1Plank(P1.plank, 4, false) });
    for (const x of [34, 58]) post1(g, x, 50, 2, 12, 2);
    roof(g, { x0: 34, x1: 60, y0: 50, y1: 60, h: 14 }, { type: 'lean', down: 'S', rise: 4, ov: 2, mat: R.mat, cut: R.cut, th: 2 });
    chimney1(g, 20, 76, M.h + 14, 10, { stone: true, w: 5, d: 5 });
    paveSand(g, 40, 54, 0, 50);
    // навес-класс во дворе: крыша на столбах, под ней парты — видно учеников
    for (const [x, y] of [[62, 14], [88, 14], [62, 36], [88, 36]]) post1(g, x, y, 0, 12, 2);
    roof(g, { x0: 62, x1: 90, y0: 30, y1: 38, h: 12 }, { type: 'lean', down: 'S', rise: 3, ov: 2, mat: R.mat, cut: R.cut, th: 2 });
    for (const [x, y] of [[70, 22], [82, 22], [70, 30], [82, 30]]) g.sprite([x, y, 0], P => QS.desk(P));
    g.sprite([76, 12, 0], P => QS.board(P));
    fence1(g, 4, 30, 6, 6); fence1(g, 4, 4, 6, 40); g.sprite([12, 26, 0], P => HQ.cabbages(P, 6)); g.sprite([20, 14, 0], P => Q1.sunflower(P, 16));
    if (lv >= 3) g.sprite([92, 50, 0], P => Q1.tree(P, 12));
  } },
  { name: 'Ш4. Волшебная школа: фахверк с синими окнами, совятник, рунный круг', make(g, lv) {
    g.meta = {};
    const Lo = { x0: 20, x1: 76, y0: 56, y1: 90, h: 14 }, Up = { x0: 18, x1: 78, y0: 52, y1: 90, z0: 14, h: 14 }, R = STRS(lv, STRAW_H.sage, P1.slate);
    box(g, Object.assign({ mat: m1Stone(P1.stone) }, Lo)); beam1(g, 18, 78, 52, 56, 13, 1, P3.oak);
    box(g, Object.assign({ mat: m1Plaster(P1.plasterC, { frame: true, bay: 12, braceX: true, beam: P3.oak }) }, Up));
    const Z = roofSag(g, Up, { axis: 'X', rise: 24, sag: 3, flare: 5, ov: 3, ovg: 5, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plasterC, { frame: true, bay: 10, brace: false, beam: P3.oak }) });
    elem(g, 'S', Lo.y0, 42, 0, 12, 13, m1Door({ w: 12, h: 13, arch: true, col: P3.oak }));
    for (const x of [24, 62]) elem(g, 'S', Lo.y0, x, 4, 8, 8, m1Window({ w: 8, h: 8, round: true, G: P3.crystal }));
    for (const x of [24, 40, 56]) elem(g, 'S', Up.y0, x, 18, 9, 8, m1Window({ w: 9, h: 8, arch: true, G: P3.crystal }));
    chimneyCrooked(g, 64, 76, Up.z0 + Up.h + 10, 14, { stone: true, w: 5, d: 5, lean: 2 });
    g.sprite([10, 70, 0], P => { PR.rect(P, 0, -26, 0, 0, P3.oak[1]); PR.rect(P, -6, -36, 6, -26, P1.plank[1]); PR.rect(P, -7, -37, 7, -37, P1.slate[1]); for (const x of [-4, 1]) PR.rect(P, x, -33, x + 2, -30, P1.ink); Q3.owl((x, y, c) => P(x + 2, y - 37, c)); });   // совятник
    paveSand(g, 42, 56, 0, 52);
    g.sprite([48, 24, 0.3], P => { for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2; P(Math.round(Math.cos(a) * 12), Math.round(Math.sin(a) * 6), P3.rune[k % 3 ? 1 : 0]); } }, -0.1);
    g.sprite([30, 40, 0], P => Q3.crystalLamp(P, 16)); g.sprite([68, 40, 0], P => Q3.crystalLamp(P, 16));
    g.sprite([82, 20, 0], P => Q3.runeStone(P, 14)); g.sprite([14, 20, 0], P => Q3.shroomPatch(P)); g.sprite([50, 30, 12], P => Q3.wisp(P), -2);
    if (lv >= 3) g.sprite([86, 44, 0], P => Q3.banner(P));
  } },
];

// =================== ЛЕСОПИЛКА 3×2 ===================
const SAW_VARS = [
  { name: 'Л1. Водяная лесопилка: колесо, жёлоб, штабеля досок', make(g, lv) {
    g.meta = {};
    const M = { x0: 8, x1: 52, y0: 26, y1: 60, h: 18 }, R = STRS(lv, STRAW1.rye, P1.tileR);
    box(g, Object.assign({ mat: m1Plank(P1.plank, 4) }, M));
    roof(g, M, { type: 'gable', axis: 'Y', rise: 18, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plank, 4) });
    elem(g, 'S', M.y0, 24, 0, 14, 14, m1Door({ w: 14, h: 14, double: true, col: P1.plank }));
    // жёлоб с водой и колесо у западной стены
    box(g, { x0: 0, x1: 8, y0: 30, y1: 34, z0: 20, h: 2, mat: m1Plank(P1.plank, 3), top: () => P1.scale[1] });
    g.sprite([4, 44, 0], P => { QS.wheel(P, 14); }); g.sprite([4, 20, 0], P => QS.water(P, 10));
    g.sprite([30, 18, 0], P => Q2.planks(P, 6, 20)); g.sprite([70, 40, 0], P => Q2.logStack(P, 4, 5)); g.sprite([74, 16, 0], P => QS.sawhorse(P));
    g.sprite([84, 28, 0], P => Q2.planks(P, 5, 16));
    paveSand(g, 44, 58, 0, 26);
    if (lv >= 3) g.sprite([60, 54, 0], P => QS.saw(P, 8));
  } },
  { name: 'Л2. Открытая пильня: большой навес на столбах, двуручная пила, козлы', make(g, lv) {
    g.meta = {};
    const R = STRS(lv, STRAW1.reed, P1.tileD);
    for (const [x, y] of [[8, 20], [46, 20], [84, 20], [8, 58], [84, 58]]) post1(g, x, y, 0, 18, 3, P3.oak);
    beam1(g, 6, 90, 20, 23, 18, 2, P3.oak);
    roof(g, { x0: 8, x1: 88, y0: 36, y1: 60, h: 20 }, { type: 'lean', down: 'S', rise: 8, ov: 3, mat: R.mat, cut: R.cut, th: R.th });   // крыша только сзади — пилу видно
    box(g, { x0: 10, x1: 86, y0: 50, y1: 60, h: 12, mat: m1Logs(P1.log) });
    g.sprite([30, 34, 0], P => QS.sawhorse(P)); g.sprite([60, 32, 0], P => QS.sawhorse(P));
    g.sprite([46, 44, 0], P => QS.saw(P, 9));
    g.sprite([20, 12, 0], P => Q2.planks(P, 7, 22)); g.sprite([74, 10, 0], P => Q2.logStack(P, 4, 6));
    g.sprite([46, 6, 0], P => { for (let k = 0; k < 12; k++) P(Math.round((bhash(k, 0, 921) - 0.5) * 20), -Math.round(bhash(k, 1, 922) * 3), P1.straw[k % 3]); });   // опилки
    if (lv >= 2) g.sprite([92, 30, 0], P => Q1.lantern(P));
  } },
  { name: 'Л3. Лесопилка с ветряком-маховиком: башенка с крыльями крутит пилу', make(g, lv) {
    g.meta = {};
    const M = { x0: 6, x1: 50, y0: 24, y1: 58, h: 16 }, R = STRS(lv, STRAW_H.honey, P1.tileR);
    box(g, Object.assign({ mat: m1Plaster(P1.plaster, { frame: true, bay: 12, braceOdd: true, low: 5 }) }, M));
    roof(g, M, { type: 'gable', axis: 'X', rise: 16, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plaster, { frame: true, bay: 10, brace: false }) });
    elem(g, 'S', M.y0, 22, 0, 12, 13, m1Door({ w: 12, h: 13, double: true, col: P1.plank }));
    const T = { x0: 54, x1: 70, y0: 36, y1: 52, h: 30 };
    box(g, Object.assign({ mat: m1Plank(P1.plank, 4) }, T)); roof(g, T, { type: 'hip', axis: 'X', rise: 10, hipL: 9.5, ov: 2, mat: R.mat, cut: R.cut, th: R.th });
    g.sprite([62, 35, 26], P => { for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; for (let r = 2; r < 20; r++) { const x = Math.round(Math.cos(a) * r), y = Math.round(Math.sin(a) * r * 0.9); P(x, y, P1.plank[2]); if (r > 6) { const nx = Math.round(-Math.sin(a) * 3), ny = Math.round(Math.cos(a) * 3); PR.line(P, x, y, x + nx, y + ny, P1.cloth[r % 3 ? 0 : 1]); } } } PR.ell(P, 0, 0, 2, 2, () => P1.iron[1]); }, -1);
    g.sprite([80, 26, 0], P => QS.sawhorse(P)); g.sprite([82, 44, 0], P => Q2.logStack(P, 3, 5)); g.sprite([30, 14, 0], P => Q2.planks(P, 6, 20));
    paveSand(g, 22, 34, 0, 24);
  } },
  { name: 'Л4. Каменный цех с трубой и рольгангом: брёвна въезжают, доски выезжают', make(g, lv) {
    g.meta = {};
    const M = { x0: 20, x1: 76, y0: 30, y1: 60, h: 18 }, R = STRS(lv, STRAW1.olive, P1.slate);
    box(g, Object.assign({ mat: m1Stone(P1.stoneW, 6, 4) }, M));
    roof(g, M, { type: 'gable', axis: 'X', rise: 16, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Stone(P1.stoneW, 6, 4) });
    elem(g, 'S', M.y0, 24, 0, 12, 12, (u, v) => (v > 10 || u < 1 || u > 10 ? P1.beam[2] : P1.dark[3]));   // проём: брёвна внутрь
    elem(g, 'S', M.y0, 60, 0, 12, 12, (u, v) => (v > 10 || u < 1 || u > 10 ? P1.beam[2] : P1.dark[3]));   // проём: доски наружу
    for (const x of [24, 60]) { box(g, { x0: x, x1: x + 12, y0: 6, y1: 30, h: 4, mat: m1Plank(P1.plank, 3), top: (u, v) => ((v | 0) % 4 === 0 ? P1.iron[2] : P1.iron[1]) }); }
    g.sprite([30, 18, 4], P => PR.ell(P, 0, -2, 6, 2.5, (x, y, a, b) => (b < 0 ? P1.log[0] : P1.log[2]))); g.sprite([66, 16, 4], P => Q2.planks(P, 2, 12));
    chimney1(g, 66, 46, M.h + 12, 16, { brick: true, w: 6, d: 6 });
    g.sprite([8, 30, 0], P => Q2.logStack(P, 4, 4)); g.sprite([90, 30, 0], P => Q2.planks(P, 6, 14));
    if (lv >= 2) g.sprite([48, 26, 0], P => Q1.lantern(P));
  } },
];

// =================== ДОМ ЛЕСОРУБА В ПНЕ 2×2 ===================
function stump(g, cx, cy, r, h, top = true) {
  cyl(g, cx, cy, r + 3, 0, 3, matBark, 24);
  cyl(g, cx, cy, r, 3, h, matBark, 24);
  if (top) g.face(Array.from({ length: 20 }, (_, i) => [cx + Math.cos(i / 20 * Math.PI * 2) * r, cy + Math.sin(i / 20 * Math.PI * 2) * r, h]), [1, 0, 0], [0, 1, 0], (u, v) => { const d = Math.hypot(u - r, v - r); return d > r - 1.5 ? BARK[1] : ((d | 0) % 3 === 0 ? P1.log[1] : P1.log[0]); });
}
const WOOD_VARS = [
  { name: 'П1. Пень под шляпкой гриба: круглая дверь, окошко, колода с топором', make(g, lv) {
    g.meta = {};
    stump(g, 32, 38, 16, 22, false);
    dome(g, 32, 38, 22, 21, 14, lv === 3 ? matShroom(BP.shroom) : lv === 2 ? m1Shingle2(SHINGLE1, 0.8) : m1Straw3(STRAW_H.ash), m1Flat(BARK[3]), 24, 6, 3);
    elem(g, 'S', 23, 42, 3, 11, 12, m1RoundDoor({ w: 11, h: 12 })); g.meta.doorPt = [47, 23, 0];
    elem(g, 'S', 23.5, 22, 10, 6, 6, m1Window({ w: 6, h: 6, round: true }));
    chimneyCrooked(g, 24, 46, 30, 10, { stone: true, w: 4, d: 4, lean: 2 });
    g.sprite([58, 30, 0], P => QS.axeBlock(P)); g.sprite([58, 46, 0], P => Q1.logs(P)); g.sprite([10, 18, 0], P => Q3.shroomPatch(P));
  } },
  { name: 'П2. Пень с избушкой на срезе: сруб сверху, лестница по корням', make(g, lv) {
    g.meta = {};
    stump(g, 30, 40, 17, 14);
    const H = { x0: 18, x1: 42, y0: 30, y1: 50, z0: 14, h: 11 };
    box(g, Object.assign({ mat: m1Logs(P1.log) }, H));
    const R = STRS(lv, STRAW1.rye, P1.tileR);
    roof(g, H, { type: 'gable', axis: 'X', rise: 11, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plank, 4) });
    elem(g, 'S', H.y0, 26, 14, 8, 10, m1Door({ w: 8, h: 10, col: P1.dark })); elem(g, 'S', 23, 40, 3, 10, 10, m1Door({ w: 10, h: 10, arch: true, col: P1.plank })); g.meta.doorPt = [45, 23, 0];
    g.sprite([48, 26, 0], P => { for (let k = 0; k < 7; k++) PR.rect(P, -4 + k, -k * 2 - 1, 0 + k, -k * 2 - 1, P1.plank[k % 2]); });
    chimney1(g, 36, 44, 34, 6, { stone: true, w: 4, d: 4 });
    g.sprite([58, 40, 0], P => Q1.logs(P)); g.sprite([10, 16, 0], P => QS.axeBlock(P));
  } },
  { name: 'П3. Пень с дуплами-окнами и мхом, мосток к поленнице', make(g, lv) {
    g.meta = {};
    stump(g, 28, 40, 18, 26);
    if (lv >= 2) dome(g, 28, 40, 10, 26, 4, (u, v, F) => P1.ivy[bcl(L1(F) + (bhash(u, v, 931) < 0.4 ? 0 : 1), 3)], m1Flat(P1.ivy[3]), 16, 3, 1);
    elem(g, 'S', 22, 22, 3, 11, 13, m1Door({ w: 11, h: 13, arch: true, knob: true, col: P1.plank })); g.meta.doorPt = [27.5, 22, 0];
    for (const [a, z] of [[14, 16], [32, 18]]) elem(g, 'S', 22.5, a, z, 6, 7, m1Window({ w: 6, h: 7, arch: true }));
    box(g, { x0: 46, x1: 62, y0: 30, y1: 36, z0: 8, h: 1.2, mat: m1Plank(P1.plank, 3), top: m1Plank(P1.plank, 3) });
    for (const x of [46, 60]) post1(g, x, 30, 0, 8, 1.5);
    g.sprite([54, 50, 0], P => Q2.logStack(P, 3, 4)); g.sprite([54, 18, 0], P => QS.axeBlock(P));
    chimneyCrooked(g, 34, 46, 26, 10, { stone: true, w: 4, d: 4, lean: -2 });
    if (lv >= 3) g.sprite([10, 52, 0], P => Q1.tree(P, 10));
  } },
  { name: 'П4. Пень-башенка: высокий ствол, конусная кровля, вывеска-топор, балкончик', make(g, lv) {
    g.meta = {};
    stump(g, 32, 40, 15, 30, false);
    const R = STRS(lv, STRAW1.reed, P1.slate);
    cone(g, 32, 40, 19, 29, 18, R.mat, R.cut, 24, 3);
    elem(g, 'S', 25, 27, 3, 10, 13, m1Door({ w: 10, h: 13, arch: true, col: P1.dark })); g.meta.doorPt = [32, 25, 0];
    elem(g, 'S', 25.5, 28, 18, 8, 7, m1Window({ w: 8, h: 7, arch: true }));
    beam1(g, 20, 44, 20, 25, 16, 1.2, P1.plank); railing1(g, 20, 44, 20.5, 20.5, 17.2, 4);
    g.sprite([48, 24, 0], P => { PR.rect(P, 0, -22, 0, 0, P3.oak[1]); PR.rect(P, 1, -21, 9, -20, P3.oak[1]); PR.rect(P, 4, -19, 9, -12, P1.plank[1]); PR.line(P, 5, -13, 8, -18, P1.plank[3]); PR.rect(P, 7, -18, 8, -16, P1.iron[0]); });
    g.sprite([56, 46, 0], P => Q1.logs(P)); g.sprite([10, 30, 0], P => QS.axeBlock(P)); g.sprite([8, 52, 0], P => Q3.shroomPatch(P));
  } },
];

// =================== КАМЕНОЛОМНЯ 2×2 ===================
function cliff(g, x0, x1, y0, y1, h) {
  box(g, { x0, x1, y0, y1, h, mat: (u, v, F) => { const row = Math.floor(v / 4), st = row % 2 ? 4 : 0, uu = ((u + st) % 9 + 9) % 9; let i = L1(F) + (bhash(Math.floor((u + st) / 9), row, 941) < 0.3 ? 0 : 1); if (uu === 0 || v % 4 === 0) i = 3; if (bhash(u, v, 942) < 0.04) return P1.ivy[2]; return p1(P1.stoneB, i); }, top: (u, v) => (bhash(u, v, 943) < 0.6 ? P1.grass[1 + (bhash(u, v, 944) < 0.3 ? 1 : 0)] : P1.stoneB[1]) });
}
const QUARRY_VARS = [
  { name: 'К1. Уступ с журавлём и сторожкой: блоки, тачка, кирка', make(g, lv) {
    g.meta = {};
    cliff(g, 2, 62, 40, 62, 26); cliff(g, 2, 26, 26, 40, 14);
    const H = { x0: 34, x1: 58, y0: 18, y1: 36, h: 13 }, R = STRS(lv, STRAW_H.ash, P1.slate);
    box(g, Object.assign({ mat: m1Stone(P1.stoneW, 5, 3) }, H)); roof(g, H, { type: 'gable', axis: 'X', rise: 10, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Stone(P1.stoneW, 5, 3) });
    elem(g, 'S', H.y0, 42, 0, 9, 11, m1Door({ w: 9, h: 11, col: P1.plank })); g.meta.doorPt = [46.5, H.y0, 0];
    chimney1(g, 52, 30, H.h + 8, 8, { stone: true, w: 4, d: 4 });
    g.sprite([14, 20, 0], P => Q2.crane(P, 28, 12)); g.sprite([22, 10, 0], P => QS.blocks(P)); g.sprite([8, 8, 0], P => QS.rocks(P, 6)); g.sprite([60, 12, 0], P => QS.pick(P)); g.sprite([30, 6, 0], P => Q1.barrow(P));
  } },
  { name: 'К2. Карьер-ступени: террасы в скале, лестница, ворот с бадьёй', make(g, lv) {
    g.meta = {};
    cliff(g, 2, 62, 46, 62, 30); cliff(g, 2, 62, 34, 46, 18); cliff(g, 2, 40, 24, 34, 8);
    g.sprite([50, 30, 18], P => { PR.rect(P, -6, -10, -6, 0, P3.oak[1]); PR.rect(P, 6, -10, 6, 0, P3.oak[1]); PR.rect(P, -7, -11, 7, -11, P3.oak[2]); PR.ell(P, 0, -8, 3, 3, () => P1.log[1]); PR.rect(P, 0, -5, 0, 10, BP.rope[1]); PR.rect(P, -3, 10, 3, 14, P1.plank[2]); }, -0.5);
    g.sprite([46, 14, 0], P => { for (let k = 0; k < 6; k++) PR.rect(P, -3, -k * 3 - 1, 3, -k * 3 - 1, P1.plank[k % 2]); PR.line(P, -4, 0, -4, -18, P1.plank[2]); PR.line(P, 4, 0, 4, -18, P1.plank[3]); });
    const R = STRS(lv, STRAW1.wheat, P1.tileR);
    for (const [x, y] of [[4, 6], [20, 6], [4, 18], [20, 18]]) post1(g, x, y, 0, 10, 2);
    roof(g, { x0: 4, x1: 22, y0: 6, y1: 20, h: 10 }, { type: 'lean', down: 'S', rise: 4, ov: 2, mat: R.mat, cut: R.cut, th: 2 });
    g.sprite([12, 14, 0], P => QS.blocks(P)); g.sprite([34, 10, 0], P => QS.rocks(P, 7)); g.sprite([58, 10, 0], P => Q1.barrow(P));
    g.meta.doorPt = [32, 10, 0];
  } },
  { name: 'К3. Каменотёсная мастерская у скалы: навес, верстак, готовые плиты', make(g, lv) {
    g.meta = {};
    cliff(g, 2, 62, 44, 62, 28);
    const R = STRS(lv, STRAW1.olive, P1.slate);
    for (const [x, y] of [[6, 22], [34, 22], [58, 22]]) post1(g, x, y, 0, 13, 2, P3.oak);
    roof(g, { x0: 6, x1: 60, y0: 30, y1: 44, h: 15 }, { type: 'lean', down: 'S', rise: 6, ov: 3, mat: R.mat, cut: R.cut, th: R.th });
    box(g, { x0: 14, x1: 30, y0: 30, y1: 36, h: 6, mat: m1Stone(P1.stone, 5, 3), top: m1Flat(P1.stone[0]) });   // верстак-плита
    g.sprite([22, 32, 6], P => QS.pick(P), -0.5);
    g.sprite([44, 34, 0], P => QS.blocks(P)); g.sprite([10, 10, 0], P => QS.blocks(P)); g.sprite([30, 8, 0], P => QS.rocks(P, 5)); g.sprite([54, 10, 0], P => Q1.barrow(P));
    g.meta.doorPt = [32, 22, 0];
  } },
  { name: 'К4. Рунная каменоломня: светящиеся жилы в скале, рунный камень, кристаллы', make(g, lv) {
    g.meta = {};
    cliff(g, 2, 62, 40, 62, 30); cliff(g, 36, 62, 28, 40, 14);
    g.sprite([20, 39.5, 6], P => { for (let k = 0; k < 18; k++) P(Math.round(k * 1.2 - 10), -Math.round(Math.sin(k * 0.7) * 3 + k * 0.6), P3.rune[k % 3 ? 1 : 0]); }, -0.4);
    g.sprite([44, 27.5, 4], P => { for (let k = 0; k < 10; k++) P(k - 5, -Math.round(Math.sin(k) * 2 + k * 0.3), P3.crystal[k % 2]); }, -0.4);
    g.sprite([12, 16, 0], P => Q3.runeStone(P, 14)); g.sprite([28, 12, 0], P => QS.blocks(P)); g.sprite([52, 14, 0], P => Q3.crystalLamp(P, 14));
    g.sprite([40, 8, 0], P => QS.rocks(P, 6, P3.crystal)); g.sprite([6, 34, 0], P => Q3.shroomPatch(P));
    g.meta.doorPt = [32, 20, 0];
  } },
];

const BV = (arr, title, w, h, top) => ({ w, h, top, vars: arr.flatMap(v => [1, 3].map(lv => ({ name: v.name + ` · ур. ${lv}`, make: g => v.make(g, lv) }))), title, bk: 1, ink: P1.ink });
BDEFS.school2 = BV(SCHOOL2_VARS, 'Школа: 4 варианта (уровни 1 и 3)', 3, 3, 96);
BDEFS.saw2 = BV(SAW_VARS, 'Лесопилка: 4 варианта', 3, 2, 58);
BDEFS.wood2 = BV(WOOD_VARS, 'Дом лесоруба в пне: 4 варианта', 2, 2, 66);
BDEFS.quarry2 = BV(QUARRY_VARS, 'Каменоломня: 4 варианта', 2, 2, 50);
