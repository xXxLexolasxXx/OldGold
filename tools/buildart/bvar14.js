'use strict';
// Лазарет (выбор владельца — центральный вариант «ЛБ»): фахверк в углу, большой огород лечебных трав,
// сушилки и детальный котёл зельевара на каменном очаге. Травы на грядках растут и срезаются в игре (inside.js),
// лекарь ходит: грядка → сушилка → котёл.

const QI = {
  hearth(P) {   // каменное кольцо очага, угли
    PR.ell(P, 0, -2, 11, 5, (x, y, a, b) => { const e = a * a + b * b; if (e > 0.6) return ((x + y) & 1) ? P1.stone[1] : P1.stone[2]; return e < 0.25 ? P1.red[(x + y) & 1] : P1.dark[3]; });
  },
  cauldron(P) {   // большой котёл на треноге: пузатый, с ободом, ручками и ложкой
    for (const [x0, x1] of [[-12, -7], [12, 7]]) PR.line(P, x0, 0, x1, -22, P3.oak[1], 2);
    PR.line(P, 0, 1, 0, -22, P3.oak[2], 2); PR.rect(P, -2, -23, 2, -22, P3.oak[0]);
    PR.rect(P, 0, -21, 0, -18, P1.iron[2]);
    PR.ell(P, 0, -10, 9, 8, (x, y, a, b) => { const l = a * -0.6 + b * -0.5; return l > 0.45 ? P1.iron[0] : l > -0.1 ? P1.iron[1] : P1.iron[2]; });
    PR.ell(P, 0, -16, 8, 2.6, (x, y, a, b) => (a * a + b * b > 0.6 ? P1.iron[0] : ((x * 3 + y) % 5 === 0 ? P1.ivy[0] : P1.ivy[1])));   // зелье
    PR.rect(P, -10, -13, -9, -11, P1.iron[2]); PR.rect(P, 9, -13, 10, -11, P1.iron[2]);
    PR.line(P, 3, -15, 9, -24, P1.plank[1]); PR.ell(P, 3, -15, 1.6, 1, () => P1.plank[2]);   // ложка
  },
  shelf(P) {   // полка со склянками у котла
    PR.rect(P, -8, -12, -8, 0, P3.oak[2]); PR.rect(P, 8, -12, 8, 0, P3.oak[2]); PR.rect(P, -9, -8, 9, -7, P1.plank[1]); PR.rect(P, -9, -13, 9, -12, P1.plank[1]);
    const C = [P1.red, P3.crystal, P1.ivy, P1.gold, P1.scale];
    for (let k = 0; k < 5; k++) { const x = -7 + k * 3.5 | 0; PR.rect(P, x, -11, x + 1, -9, C[k][1]); P(x, -12, P1.white[1]); }
    for (let k = 0; k < 4; k++) { const x = -6 + k * 4; PR.rect(P, x, -6, x + 2, -3, C[(k + 2) % 5][0]); P(x + 1, -7, P1.white[1]); }
  },
};
function buildInf(g, lv) {
  g.meta = { cots: [], beds: [] };
  const R = STRS(lv, STRAW_X.moss, P1.tileD);
  const M = { x0: 2, x1: 38, y0: 34, y1: 62, h: 16 };
  box(g, Object.assign({ mat: m1Plaster(P1.plaster, { frame: true, bay: 10, braceOdd: true, low: 4 }) }, M));
  roofSag(g, M, { axis: 'X', rise: 16, sag: 2, flare: 3, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plaster, { frame: true, bay: 8, brace: false }) });
  elem(g, 'S', M.y0, 22, 0, 10, 12, m1Door({ w: 10, h: 12, arch: true, col: P1.red })); g.meta.doorPt = [27, M.y0, 0];
  elem(g, 'S', M.y0, 6, 4, 9, 8, m1Window({ w: 9, h: 8, sill: true }));
  chimney1(g, 8, 50, M.h + 8, 10, { stone: true, w: 5, d: 5 });
  g.sprite([40, 33, 0], P => QW.cross(P));
  // огород: грядки без травы — травы рисует игра (растут и срезаются)
  const B = { x0: 46, x1: 94, y0: 26, y1: lv >= 2 ? 60 : 50 };
  box(g, { x0: B.x0, x1: B.x1, y0: B.y0, y1: B.y1, h: 1.2, mat: m1Plank(P1.plank, 3), top: (u, v) => ((v | 0) % 6 < 1 ? P1.plank[1] : (u + v) % 5 < 1 ? bhex('#4e3a28') : bhex('#6a5236')) });
  for (let y = B.y0 + 3; y < B.y1; y += 6) g.meta.beds.push([[B.x0 + 2, y, 1.2], [B.x1 - 2, y, 1.2]]);
  if (!g.dynPiles) for (const [a, b] of g.meta.beds) g.sprite([(a[0] + b[0]) / 2, a[1], 1.2], P => { const w = (b[0] - a[0]) / 2; for (let x = -w; x <= w; x += 3) { PR.rect(P, x, -3, x, 0, P1.grass[1 + (x & 1)]); if (x % 4 === 0) P(x, -4, P3.crystal[1]); } }, -0.2);
  // сушилки и котёл
  g.sprite([56, 18, 0], P => QW.rack(P)); g.meta.rack = [56, 16, 0];
  if (lv >= 2) g.sprite([80, 18, 0], P => QW.rack(P));
  g.sprite([20, 18, 0], P => QI.hearth(P)); g.sprite([20, 18, 0], P => QI.cauldron(P), -0.3); g.meta.cauldron = [20, 18, 0];
  g.sprite([38, 22, 0], P => QI.shelf(P));
  g.sprite([8, 8, 0], P => QW.cot(P)); g.meta.cots.push([8, 8, 0]);
  if (lv >= 2) { g.sprite([34, 8, 0], P => QW.cot(P)); g.meta.cots.push([34, 8, 0]); }
  if (lv >= 3) { g.sprite([94, 10, 0], P => Q1.lantern(P)); g.sprite([4, 50, 0], P => Q3.shroomPatch(P)); g.sprite([66, 8, 0], P => QW.cot(P)); g.meta.cots.push([66, 8, 0]); }
}
BDEFS.inf3 = BL(buildInf, 'Лазарет', 3, 2, 64);
