'use strict';
// Вторая итерация по замечаниям владельца:
//  · школа — вариант 4 (волшебный фахверк) + круглая башня из варианта 2, дом в углу, спереди детская площадка
//    (классики, качели, дерево с читающим гномёнком), с уровнем игр и украшений больше;
//  · лесопилка — маленький цех в углу, остальное — большая циркулярная пила, бревно распиливается на две половины;
//  · дом лесоруба в пне и каменоломня — четыре новых варианта каждый.

// ---- материалы: кора пластинами, природный камень ----
const matBark2 = (u, v, F) => {   // вертикальные пластины коры с бороздами, мох у земли
  const k = L1(F), pw = 4 + Math.floor(bhash(Math.floor(u / 5), 0, 1001) * 3), c = Math.floor(u / pw), uu = u - c * pw;
  if (v < 5 && bhash(u, v, 1002) < 0.55 - v * 0.1) return P1.ivy[bcl(1 + k + (bhash(u, v, 1003) < 0.3 ? 1 : 0), 3)];
  if (uu === 0) return BARK[3];
  const seg = Math.floor((v + bhash(c, 0, 1004) * 6) / 7), vv = (v + bhash(c, 0, 1004) * 6) % 7;
  if (vv < 1) return BARK[3];
  let i = bhash(c, seg, 1005) < 0.3 ? 0 : 1;
  if (uu === 1) i -= 1; if (uu === pw - 1) i += 1;
  return p1(BARK, i + k);
};
const matRock = (u, v, F) => {    // природный камень: крупные плиты, трещины, мох сверху
  const k = L1(F), cx = Math.floor(u / 11), cy = Math.floor(v / 8);
  let best = 1e9, sec = 1e9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const gx = cx + i, gy = cy + j, px = (gx + bhash(gx, gy, 1011)) * 11, py = (gy + bhash(gx, gy, 1012)) * 8, d = Math.hypot(u - px, (v - py) * 1.3); if (d < best) { sec = best; best = d; id = gx * 31 + gy; } else if (d < sec) sec = d; }
  if (sec - best < 1.2) return P1.stoneB[3];
  if (F.L && v / F.L < 0.25 && bhash(u, v, 1013) < 0.6) return P1.ivy[bcl(k + 1, 3)];
  const h = bhash(id, 0, 1014);
  return p1(P1.stoneB, (h < 0.3 ? 0 : h < 0.8 ? 1 : 2) + k);
};
const rockTop = (u, v) => (bhash(u, v, 1015) < 0.55 ? P1.grass[1 + (bhash(u, v, 1016) < 0.3 ? 1 : 0)] : P1.stoneB[0]);
function boulder(g, cx, cy, r, h) { dome(g, cx, cy, r, 0, h, matRock, m1Flat(P1.stoneB[3]), 18, 5, 0.5); }
function stump2(g, cx, cy, r, h, top = true) {
  cyl(g, cx, cy, r, 0, h, matBark2, 28);
  if (top) g.face(Array.from({ length: 24 }, (_, i) => [cx + Math.cos(i / 24 * Math.PI * 2) * r, cy + Math.sin(i / 24 * Math.PI * 2) * r, h]), [1, 0, 0], [0, 1, 0], (u, v) => { const d = Math.hypot(u - r, v - r); if (d > r - 1.5) return BARK[2]; if (d < 1.5) return P1.log[2]; return ((d | 0) % 3 === 0 ? P1.log[1] : bhash(u, v, 1017) < 0.04 ? P1.log[2] : P1.log[0]); });
}
function roots(g, cx, cy, r, list) { for (const a of list) { const x = cx + Math.cos(a) * (r + 2), y = cy + Math.sin(a) * (r + 2); cyl(g, x, y, 3, 0, 4, matBark2, 10); dome(g, x, y, 3, 4, 2, matBark2, m1Flat(BARK[2]), 10, 2, 0.5); } }

// ---- реквизит площадки и пилы ----
const QK = {
  hopscotch(P) { const cells = [[0, 0], [0, -4], [-3, -8], [3, -8], [0, -12], [-3, -16], [3, -16], [0, -20]]; cells.forEach(([x, y], k) => { for (let i = -2; i <= 2; i++) { P(x + i, y, P1.white[1]); P(x + i, y - 3, P1.white[1]); } P(x - 2, y - 1, P1.white[1]); P(x - 2, y - 2, P1.white[1]); P(x + 2, y - 1, P1.white[1]); P(x + 2, y - 2, P1.white[1]); if (k % 3 === 0) P(x, y - 2, P1.white[0]); }); PR.ell(P, 5, -2, 1.3, 0.9, () => P1.stone[1]); },
  swings(P) { PR.line(P, -12, 0, -9, -22, P3.oak[1]); PR.line(P, -6, 0, -9, -22, P3.oak[1]); PR.line(P, 12, 0, 9, -22, P3.oak[2]); PR.line(P, 6, 0, 9, -22, P3.oak[2]); PR.rect(P, -10, -23, 10, -22, P3.oak[0]); for (const x of [-4, 3]) { PR.rect(P, x - 1, -21, x - 1, -8, BP.rope[1]); PR.rect(P, x + 2, -21, x + 2, -8, BP.rope[1]); PR.rect(P, x - 2, -7, x + 3, -7, P1.plank[1]); } },
  seesaw(P) { PR.rect(P, -1, -3, 1, 0, P3.oak[2]); PR.line(P, -11, -2, 11, -5, P1.plank[1], 2); PR.rect(P, -11, -5, -10, -2, P1.red[1]); PR.rect(P, 10, -8, 11, -5, P1.red[1]); },
  sandbox(P) { PR.rect(P, -9, -6, 9, 0, P1.plank[2]); PR.rect(P, -8, -5, 8, -1, P3.sand[1]); for (const [x, y] of [[-4, -3], [3, -2]]) P(x, y, P3.sand[3]); PR.rect(P, 4, -5, 6, -4, P1.red[0]); PR.rect(P, -6, -4, -5, -3, P1.scale[0]); },
  slide(P) { PR.rect(P, -8, -16, -8, 0, P1.plank[2]); PR.rect(P, -4, -16, -4, 0, P1.plank[2]); for (let y = -14; y < 0; y += 3) PR.rect(P, -8, y, -4, y, P1.plank[1]); PR.rect(P, -9, -17, -3, -16, P1.plank[0]); PR.line(P, -3, -16, 10, -1, P1.scale[0], 2); PR.line(P, -3, -15, 10, 0, P1.scale[2]); },
  maypole(P) { PR.rect(P, 0, -30, 0, 0, P1.white[1]); P(0, -31, P1.gold[0]); const C = [P1.red, P1.gold, P1.scale, P1.grass]; for (let k = 0; k < 4; k++) PR.line(P, 0, -29, -10 + k * 7, -6 + (k % 2) * 3, C[k][1]); PR.ell(P, 0, -28, 3, 1.5, () => P1.ivy[1]); },
  ball(P) { PR.ell(P, 0, -2, 2, 2, (x, y, a, b) => (a + b < 0 ? P1.red[0] : P1.white[0])); },
  readTree(P) { Q1.tree(P, 15); PR.rect(P, 6, -2, 9, -1, P1.red[1]); PR.rect(P, 7, -3, 8, -3, P1.white[0]); },   // дерево, у корней книжка
  bigSaw(P, r = 13, a = 0) {   // большой диск торцом к зрителю (вертикально), зубья по краю
    PR.ell(P, 0, -r, r, r, (x, y, aa, b) => { const d = Math.hypot(aa, b), an = Math.atan2(b, aa) + a; if (d > 0.9) return Math.floor(an / (Math.PI / 14)) % 2 ? P1.iron[2] : null; if (d > 0.82) return P1.iron[1]; if (d < 0.14) return P1.iron[2]; if (Math.abs(Math.sin((an) * 3)) < 0.06) return P1.iron[1]; return aa < -0.3 && b < -0.2 ? P1.white[0] : P1.iron[0]; });
  },
  halfLog(P, L = 22, flip = false) { for (let x = 0; x < L; x++) for (let y = -4; y <= 0; y++) P(flip ? -x : x, y, y === -4 ? P1.log[0] : y === -3 ? P1.straw[0] : P1.log[1 + (x % 7 === 0 ? 1 : 0)]); PR.ell(P, flip ? -L : L, -2, 1.5, 2.5, () => P1.straw[1]); },
  log(P, L = 24) { for (let x = 0; x < L; x++) for (let y = -6; y <= 0; y++) P(x, y, y === -6 ? P1.log[0] : y > -2 ? P1.log[3] : P1.log[1 + ((x * 3 + y) % 9 === 0 ? 1 : 0)]); PR.ell(P, L, -3, 2, 3.5, (x, y, a, b) => (a * a + b * b < 0.25 ? P1.log[2] : P1.straw[0])); },
  dust(P) { for (let k = 0; k < 26; k++) P(Math.round((bhash(k, 0, 1021) - 0.5) * 14), -Math.round(bhash(k, 1, 1022) * 3), P1.straw[k % 3]); },
  wedges(P) { for (const x of [-3, 0, 3]) { PR.rect(P, x, -3, x + 1, 0, P1.iron[1]); P(x, -4, P1.iron[0]); } PR.line(P, 6, 0, 10, -8, P1.plank[1]); PR.rect(P, 8, -10, 12, -8, P1.iron[2]); },
  rails(P, L = 26) { for (let x = 0; x <= L; x += 4) PR.rect(P, x, -1, x + 1, 1, P1.plank[2]); PR.rect(P, 0, -2, L, -2, P1.iron[1]); PR.rect(P, 0, 1, L, 1, P1.iron[1]); },
  cart(P) { PR.rect(P, -7, -9, 7, -3, P1.iron[2]); PR.rect(P, -7, -9, 7, -9, P1.iron[1]); for (const x of [-4, 4]) PR.ell(P, x, -2, 2, 2, () => P1.iron[2]); for (let k = 0; k < 5; k++) PR.ell(P, -4 + k * 2, -10, 2, 1.6, () => P1.stone[k % 2]); },
  tripod(P) { PR.line(P, -9, 0, 0, -28, P3.oak[1]); PR.line(P, 9, 0, 0, -28, P3.oak[2]); PR.line(P, 2, 2, 0, -28, P3.oak[1]); PR.rect(P, 0, -27, 0, -12, BP.rope[1]); PR.rect(P, -4, -12, 4, -6, P1.stone[1]); PR.rect(P, -4, -12, 4, -12, P1.stone[0]); },
  slabs(P) { for (let k = 0; k < 3; k++) { PR.rect(P, -6 + k * 4, -14 + k, -3 + k * 4, 0, P1.stone[k % 2]); PR.rect(P, -6 + k * 4, -14 + k, -6 + k * 4, 0, P1.stone[2]); } },
};

// =================== ШКОЛА: волшебный фахверк + башня, площадка ===================
function buildSchool(g, lv) {
  g.meta = { wins: [], play: {} };
  const R = STRS(lv, STRAW_H.sage, P1.slate);
  const Lo = { x0: 2, x1: 54, y0: 60, y1: 92, h: 13 }, Up = { x0: 0, x1: 56, y0: 56, y1: 92, z0: 13, h: 13 };
  box(g, Object.assign({ mat: m1Stone(P1.stone) }, Lo)); beam1(g, 0, 56, 56, 60, 12, 1, P3.oak);
  box(g, Object.assign({ mat: m1Plaster(P1.plasterC, { frame: true, bay: 12, braceX: true, beam: P3.oak }) }, Up));
  roofSag(g, Up, { axis: 'X', rise: 22, sag: 3, flare: 5, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plasterC, { frame: true, bay: 10, brace: false, beam: P3.oak }) });
  elem(g, 'S', Lo.y0, 22, 0, 12, 12, m1Door({ w: 12, h: 12, arch: true, col: P3.oak })); g.meta.doorPt = [28, Lo.y0, 0];
  for (const x of [6, 42]) elem(g, 'S', Lo.y0, x, 3, 8, 8, m1Window({ w: 8, h: 8, round: true, G: P3.crystal }));
  for (const x of [6, 22, 40]) elem(g, 'S', Up.y0, x, 17, 9, 8, m1Window({ w: 9, h: 8, arch: true, G: P3.crystal }));
  elem(g, 'S', Up.y0 - 0.3, 20, 30, 16, 7, m1Sprite(16, 7, P => { Q1.board(P, 'none', 16, 7); PR.rect(P, -4, -2, 3, 2, P1.red[1]); PR.rect(P, -3, -1, -1, 1, P1.white[0]); PR.rect(P, 0, -1, 2, 1, P1.white[0]); }));   // вывеска с раскрытой книгой
  // круглая башня-библиотека за домом справа
  const cx = 68, cy = 80, rr = 12;
  cyl(g, cx, cy, rr, 0, 34 + (lv >= 3 ? 6 : 0), m1Stone(P1.stoneW, 6, 4), 24);
  cone(g, cx, cy, rr + 4, 33 + (lv >= 3 ? 6 : 0), 22, R.mat, R.cut, 24, 3);
  for (const z of [10, 22]) elem(g, 'S', cy - rr + 1.2, 65, z, 6, 8, m1Window({ w: 6, h: 8, arch: true, G: P3.crystal }));
  elem(g, 'E', cx + rr - 1, cy - 3, 18, 6, 8, m1Window({ w: 6, h: 8, arch: true, G: P3.crystal }));
  g.sprite([cx, cy, 56 + (lv >= 3 ? 6 : 0)], P => (lv >= 3 ? (PR.line(P, -6, -2, 8, -12, P1.gold[2], 2), PR.rect(P, 7, -14, 9, -12, P1.gold[1])) : Q3.owl(P)));
  chimneyCrooked(g, 46, 80, Up.z0 + Up.h + 10, 12, { stone: true, w: 5, d: 5, lean: 2 });
  if (lv >= 2) { for (const x of [6, 22, 40]) g.sprite([x + 4.5, 55.5, 16], P => Q1.planter(P, 9), -0.5); g.sprite([2, 56, 26], P => Q3.banner(P)); }
  if (lv >= 3) { beam1(g, 16, 40, 50, 56, 13, 2, P1.plank); railing1(g, 16, 40, 50.5, 50.5, 15, 5); g.sprite([cx + rr, cy - 4, 40], P => Q1.pennant(P, 12, P3.violet)); }
  // дорожка от входа участка (x 48) к двери
  paveSand(g, 42, 54, 0, 46); paveSand(g, 22, 54, 46, 56);
  // площадка: классики, качели, дерево с читающим гномёнком
  g.sprite([16, 30, 0.3], P => QK.hopscotch(P), -0.1); g.meta.play.hop = [16, 22, 0];
  g.sprite([74, 30, 0], P => QK.swings(P)); g.meta.play.swing = [[71, 30, 7], [78, 30, 7]];
  g.sprite([86, 50, 0], P => QK.readTree(P)); g.meta.play.read = [80, 48, 0];
  g.sprite([60, 10, 0], P => QK.ball(P));
  if (lv >= 2) { g.sprite([34, 12, 0], P => QK.sandbox(P)); g.sprite([88, 12, 0], P => QK.seesaw(P)); g.meta.play.sand = [34, 10, 0]; g.meta.play.seesaw = [[78, 12, 3], [98, 12, 5]]; }
  if (lv >= 3) { g.sprite([6, 10, 0], P => QK.slide(P)); g.sprite([32, 44, 0], P => QK.maypole(P)); g.meta.play.slide = [10, 8, 0]; g.meta.play.pole = [32, 44, 0]; g.sprite([92, 36, 0], P => Q3.crystalLamp(P, 14)); }
  g.sprite([4, 50, 0], P => Q3.shroomPatch(P)); g.sprite([54, 40, 0], P => Q3.crystalLamp(P, 14));
  // угол справа от башни: ученический огород с травами, пугало и скворечник; выше уровнем — ульи и детский домик
  box(g, { x0: 82, x1: 95, y0: 58, y1: 92, h: 1.5, mat: m1Plank(P1.plank, 3), top: (u, v) => ((v | 0) % 6 < 1 ? P1.plank[1] : (u + v) % 5 < 1 ? bhex('#4e3a28') : bhex('#6a5236')) });
  for (let y = 61; y < 92; y += 6) g.sprite([88, y, 1.5], P => { for (let x = -5; x <= 5; x += 2) { const h = 2 + ((x + y) & 1); PR.rect(P, x, -h, x, 0, P1.grass[1 + ((x + y) & 1)]); if ((x + y) % 4 === 0) P(x, -h - 1, [P3.crystal[1], P1.gold[0], P1.red[0]][(x + y + 30) % 3]); } }, -0.2);
  g.sprite([92, 74, 1.5], P => { PR.rect(P, 0, -16, 0, 0, P3.oak[1]); PR.rect(P, -5, -12, 5, -12, P3.oak[1]); PR.rect(P, -2, -12, 2, -6, P1.red[1]); PR.ell(P, 0, -15, 2.5, 2.5, () => P1.straw[1]); PR.rect(P, -3, -18, 3, -17, P1.straw[3]); P(-1, -15, P1.ink); P(1, -15, P1.ink); });   // пугало
  g.sprite([84, 56, 0], P => { PR.rect(P, 0, -18, 0, 0, P3.oak[1]); PR.rect(P, -3, -24, 3, -18, P1.plank[1]); PR.rect(P, -4, -25, 4, -25, P1.tileR[1]); P(0, -21, P1.ink); });   // скворечник
  g.meta.play.garden = [88, 66, 1.5];
  if (lv >= 2) for (const y of [84, 90]) g.sprite([94, y, 1.5], P => { PR.rect(P, -3, -7, 3, 0, P1.straw[1]); for (let k = -6; k < 0; k += 2) PR.rect(P, -3, k, 3, k, P1.straw[3]); PR.rect(P, -4, -8, 4, -8, P1.plank[2]); P(0, -2, P1.ink); P(-6, -9, P1.gold[0]); P(5, -11, P1.gold[0]); });   // ульи с пчёлами
  if (lv >= 3) { box(g, { x0: 84, x1: 94, y0: 60, y1: 70, z0: 1.5, h: 8, mat: m1Plank(P1.plankB, 3), top: m1Flat(P1.plank[1]) }); roof(g, { x0: 84, x1: 94, y0: 60, y1: 70, z0: 1.5, h: 8 }, { type: 'gable', axis: 'X', rise: 6, ov: 2, mat: m1Tile2(P1.tileR), cut: m1Fascia, th: 1.5 }); elem(g, 'S', 60, 87, 1.5, 4, 6, m1Door({ w: 4, h: 6, col: P1.red })); }
}

// =================== ЛЕСОПИЛКА: маленький цех в углу, большая циркулярка ===================
// Диск — грань-круг в плоскости XZ (вдоль подачи бревна): в виде со входом сбоку он поворачивается вместе со станком.
function sawDisc(g, cx, y, cz, r) {
  const N = 32, pts = [];
  for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, rr = r + (i % 2 ? 0 : 1.3); pts.push([cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr]); }
  // материал считаем от центра диска: (du, dv) — смещение пикселя от центра в плоскости диска
  const disc = (du, dv) => { const d = Math.hypot(du, dv) / r, an = Math.atan2(dv, du); if (d > 0.93) return P1.iron[2]; if (d > 0.86) return P1.iron[0]; if (d < 0.13) return P1.iron[2]; if (d < 0.2) return P1.iron[1]; if (Math.abs(Math.sin(an * 3)) < 0.05 && d < 0.8) return P1.iron[1]; return du - dv < -r * 0.5 ? P1.white[0] : du + dv > r * 0.6 ? P1.iron[1] : P1.iron[0]; };
  for (const [P, U] of [[pts, [1, 0, 0]], [pts.slice().reverse(), [-1, 0, 0]]]) {
    const o = P[0], cu = (cx - o[0]) * U[0], cv = cz - o[2];
    g.face(P, U, [0, 0, 1], (u, v) => disc(u - cu, v - cv), { dz: -0.4 });
  }
}
// Бревно (или половинка) брусом вдоль X: кора по бокам, свежий срез на торцах
function logBox(g, x0, x1, y0, y1, z0, h, half = false) {
  const bark = (u, v, F) => P1.log[bcl(L1(F) + 1 + ((u | 0) % 7 === 0 ? 1 : 0) + (v < 1 ? 1 : 0), 3)];
  box(g, { x0, x1, y0, y1, z0, h, mat: bark, E: (u, v) => (Math.hypot(u - (y1 - y0) / 2, v - h / 2) < 1 ? P1.log[2] : P1.straw[(u + v) % 3 < 1 ? 1 : 0]), top: half ? (u, v) => P1.straw[((u | 0) % 6 === 0) ? 1 : 0] : (u, v) => P1.log[(u | 0) % 5 === 0 ? 1 : 0] });
}

function buildSaw(g, lv) {
  g.meta = { wins: [] };
  const R = STRS(lv, STRAW1.reed, P1.tileD);
  const M = { x0: 2, x1: 30, y0: 36, y1: 62, h: 14 };
  box(g, Object.assign({ mat: m1Logs(P1.log) }, M));
  roof(g, M, { type: 'gable', axis: 'Y', rise: 14, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plank, 4) });
  elem(g, 'S', M.y0, 9, 0, 12, 11, m1Door({ w: 12, h: 11, double: true, col: P1.plank })); g.meta.doorPt = [15, M.y0, 0];
  chimney1(g, 8, 52, M.h + 8, 8, { stone: true, w: 4, d: 4 });
  // станок: длинный стол на козлах, посередине — большой диск торцом к зрителю; бревно входит справа, половинки выходят слева
  const T = { x0: 40, x1: 90, y0: 26, y1: 34 };
  box(g, { x0: T.x0, x1: T.x1, y0: T.y0, y1: T.y1, h: 6, mat: m1Plank(P1.plank, 4, false), top: (u, v) => ((u | 0) % 12 === 0 ? P1.plank[2] : P1.plank[0]) });
  for (const x of [41, 64, 88]) for (const y of [26.5, 32.5]) post1(g, x, y, 0, 6, 1.2, P3.oak);
  const r = lv >= 3 ? 14 : 12;
  sawDisc(g, 65, 30, 6 + r * 0.55, r); g.meta.saw = [65, 30, 6 + r * 0.55]; g.meta.sawR = r;
  logBox(g, 69, 89, 27, 33, 6, 6); g.meta.logIn = [79, 30, 9];
  logBox(g, 44, 61, 25.5, 29, 6, 3.5, true); logBox(g, 44, 61, 31, 34.5, 6, 3.5, true); g.meta.halves = [52, 30, 8];
  g.sprite([65, 24, 0], P => QK.dust(P)); g.meta.dust = [65, 24, 0];
  // защитный кожух и ремённый привод от вала (на 2-м и 3-м уровне)
  if (lv >= 2) { g.sprite([65, 34, 6], P => { PR.rect(P, -3, -28, 3, -27, P1.iron[2]); PR.rect(P, -3, -27, -3, -20, P1.iron[2]); PR.rect(P, 3, -27, 3, -20, P1.iron[2]); }, -0.6); g.sprite([62, 40, 0], P => { PR.ell(P, 0, -8, 4, 4, () => P1.plank[2]); PR.line(P, 0, -12, 3, -30, P1.beam[2]); PR.line(P, 3, -12, 6, -30, P1.beam[2]); }); }
  // подача и выдача
  g.sprite([104, 16, 0], P => Q2.logStack(P, lv >= 2 ? 4 : 3, 5)); g.meta.logPile = [104, 16, 0];
  g.sprite([46, 14, 0], P => Q2.planks(P, lv >= 2 ? 6 : 4, 18)); g.meta.plankPile = [46, 14, 0];
  if (lv >= 2) g.sprite([24, 18, 0], P => Q2.planks(P, 5, 16));
  if (lv >= 3) { g.sprite([100, 46, 0], P => Q2.crane(P, 26, 12)); g.sprite([14, 24, 0], P => Q1.lantern(P)); }
  g.meta.workers = [[96, 26, 0], [36, 22, 0]];   // кто подаёт бревно и кто принимает доски
  groundYard(g, 32, 126, 4, 62);
  paveSand(g, 9, 21, 20, 36);
}

// =================== ДОМ ЛЕСОРУБА В ПНЕ: 4 новых ===================
const WOOD2_VARS = [
  { name: 'Л-1. Пень-великан на корнях-арках, дверь между корней, избушка-дозор на срезе', make(g, lv) {
    g.meta = {};
    stump2(g, 30, 40, 19, 20); roots(g, 30, 40, 19, [0.3, 1.2, 2.2, 3.0, 4.0, 5.1]);
    elem(g, 'S', 21.5, 24, 0, 11, 13, m1Door({ w: 11, h: 13, arch: true, knob: true, col: P1.plank })); g.meta.doorPt = [29.5, 21.5, 0];
    elem(g, 'S', 22, 14, 9, 6, 6, m1Window({ w: 6, h: 6, round: true })); elem(g, 'S', 22, 38, 11, 6, 6, m1Window({ w: 6, h: 6, round: true }));
    const H = { x0: 22, x1: 38, y0: 34, y1: 48, z0: 20, h: 8 }, R = STRS(lv, STRAW1.rye, P1.tileR);
    box(g, Object.assign({ mat: m1Plank(P1.plank, 3) }, H)); roof(g, H, { type: 'hip', axis: 'X', rise: 8, hipL: 8, ov: 2, mat: R.mat, cut: R.cut, th: R.th });
    elem(g, 'S', 34, 27, 23, 6, 4, m1Window({ w: 6, h: 4 }));
    g.sprite([56, 44, 0], P => Q2.logStack(P, 3, 4)); g.sprite([54, 20, 0], P => QS.axeBlock(P)); g.sprite([8, 14, 0], P => Q3.shroomPatch(P));
    if (lv >= 2) g.sprite([42, 16, 0], P => Q1.lantern(P));
  } },
  { name: 'Л-2. Пень с проросшим деревцем: крона над срезом, окна в коре, фонарь', make(g, lv) {
    g.meta = {};
    stump2(g, 30, 40, 17, 22); roots(g, 30, 40, 17, [0.6, 2.5, 3.6, 5.4]);
    cyl(g, 30, 42, 3, 22, 32, matBark2, 10);
    dome(g, 30, 42, 15, 30, 12 + (lv >= 3 ? 4 : 0), matLeaf, m1Flat(LEAF[3]), 20, 5, 1); dome(g, 20, 36, 8, 28, 7, matLeaf, m1Flat(LEAF[3]), 14, 4, 1);
    elem(g, 'S', 23.5, 25, 0, 10, 12, m1Door({ w: 10, h: 12, arch: true, col: P1.dark })); g.meta.doorPt = [30, 23.5, 0];
    for (const [a, z] of [[16, 10], [38, 12]]) elem(g, 'S', 24, a, z, 6, 7, m1Window({ w: 6, h: 7, arch: true }));
    g.sprite([42, 22, 0], P => Q1.streetLamp(P, 14)); g.sprite([56, 40, 0], P => Q1.logs(P)); g.sprite([54, 18, 0], P => QS.axeBlock(P));
    if (lv >= 2) g.sprite([8, 22, 0], P => Q1.bench(P, 10));
  } },
  { name: 'Л-3. Пень и дровяной сарай: навес с топорами и пилой, свежие спилы, козлы', make(g, lv) {
    g.meta = {};
    stump2(g, 22, 42, 16, 20); roots(g, 22, 42, 16, [0.5, 2.6, 4.2]);
    const R = STRS(lv, STRAW1.wheat, P1.tileD);
    dome(g, 22, 42, 19, 20, 9, R.mat, R.cut, 20, 4, 3);
    elem(g, 'S', 26.5, 16, 0, 10, 12, m1Door({ w: 10, h: 12, arch: true, col: P1.plank })); g.meta.doorPt = [21, 26.5, 0];
    elem(g, 'S', 27, 30, 9, 6, 6, m1Window({ w: 6, h: 6, round: true }));
    for (const [x, y] of [[42, 26], [62, 26], [42, 50], [62, 50]]) post1(g, x, y, 0, 13, 2, P3.oak);
    roof(g, { x0: 42, x1: 64, y0: 40, y1: 52, h: 13 }, { type: 'lean', down: 'S', rise: 4, ov: 2, mat: R.mat, cut: R.cut, th: 2 });
    g.sprite([52, 48, 0], P => Q2.logStack(P, 3, 4)); g.sprite([52, 30, 0], P => QS.sawhorse(P));
    g.sprite([53, 50.5, 9], P => { PR.line(P, -8, 0, -8, -7, P1.plank[1]); PR.rect(P, -10, -8, -7, -6, P1.iron[1]); PR.line(P, -2, 0, -2, -7, P1.plank[1]); PR.rect(P, -4, -8, -1, -6, P1.iron[1]); PR.rect(P, 3, -6, 12, -5, P1.iron[1]); for (let x = 4; x <= 12; x += 2) P(x, -4, P1.iron[2]); }, -0.5);
    for (const [x, y] of [[40, 12], [48, 8], [58, 14]]) g.sprite([x, y, 0], P => PR.ell(P, 0, -1, 3, 2, (xx, yy, a, b) => (a * a + b * b < 0.3 ? P1.log[0] : P1.log[1])));
    if (lv >= 3) g.sprite([8, 14, 0], P => Q1.planter(P, 9));
  } },
  { name: 'Л-4. Высокий полый пень: лестница по стволу, смотровая площадка с перилами и флажком', make(g, lv) {
    g.meta = {};
    stump2(g, 30, 42, 15, 32); roots(g, 30, 42, 15, [0.4, 1.8, 3.2, 4.6]);
    beam1(g, 14, 46, 26, 58, 32, 1.2, P1.plank);
    railing1(g, 14, 46, 26, 26, 33.2, 5); railing1(g, 46, 46, 26, 58, 33.2, 5); railing1(g, 14, 14, 26, 58, 33.2, 5);
    if (lv >= 2) { const R = STRS(lv, STRAW1.reed, P1.slate); for (const [x, y] of [[16, 28], [44, 28], [16, 56], [44, 56]]) post1(g, x, y, 33, 9, 1.5); roof(g, { x0: 16, x1: 46, y0: 28, y1: 58, z0: 33, h: 9 }, { type: 'hip', axis: 'X', rise: 9, hipL: 12, ov: 2, mat: R.mat, cut: R.cut, th: 2 }); }
    elem(g, 'S', 27.5, 25, 0, 10, 12, m1Door({ w: 10, h: 12, arch: true, col: P1.dark })); g.meta.doorPt = [30, 27.5, 0];
    for (const z of [12, 22]) elem(g, 'S', 28, 34, z, 5, 6, m1Window({ w: 5, h: 6, arch: true }));
    g.sprite([46, 30, 0], P => { for (let k = 0; k < 10; k++) PR.rect(P, -3, -k * 3 - 1, 2, -k * 3 - 1, P1.plank[k % 2]); PR.line(P, -4, 0, -4, -31, P1.plank[2]); PR.line(P, 3, 0, 3, -31, P1.plank[3]); });
    g.sprite([44, 56, 33.2], P => Q1.pennant(P, 12)); g.sprite([56, 46, 0], P => Q1.logs(P)); g.sprite([8, 18, 0], P => QS.axeBlock(P));
  } },
];

// =================== КАМЕНОЛОМНЯ: 4 новых ===================
const QUARRY2_VARS = [
  { name: 'К-1. Скальный выход с забоем: валуны, ступенчатый срез, сторожка, блоки и клинья', make(g, lv) {
    g.meta = {};
    boulder(g, 14, 52, 14, 18); boulder(g, 46, 54, 16, 22); boulder(g, 30, 60, 12, 16);
    box(g, { x0: 22, x1: 40, y0: 40, y1: 50, h: 12, mat: m1Stone(P1.stoneB, 7, 4), top: rockTop }); box(g, { x0: 22, x1: 40, y0: 34, y1: 40, h: 5, mat: m1Stone(P1.stoneB, 7, 4), top: m1Flat(P1.stoneB[0]) });
    const H = { x0: 48, x1: 62, y0: 18, y1: 30, h: 10 }, R = STRS(lv, STRAW_H.ash, P1.slate);
    box(g, Object.assign({ mat: m1Plank(P1.plank, 3) }, H)); roof(g, H, { type: 'gable', axis: 'Y', rise: 8, ov: 2, ovg: 2, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plank, 3) });
    elem(g, 'S', H.y0, 51, 0, 8, 9, m1Door({ w: 8, h: 9, col: P1.dark })); g.meta.doorPt = [55, H.y0, 0];
    g.sprite([24, 26, 0], P => QS.blocks(P)); g.sprite([34, 30, 0], P => QK.wedges(P)); g.sprite([10, 18, 0], P => QS.rocks(P, 6, P1.stoneB)); g.sprite([38, 12, 0], P => Q1.barrow(P));
    // передний план: каменотёс тешет блок на колоде (сам гном и сколы — анимация игры, inside.js)
    box(g, { x0: 40, x1: 48, y0: 12, y1: 18, h: 4, mat: m1Stone(P1.stone, 4, 3), top: m1Flat(P1.stone[0]) });
    g.meta.work = [36, 14, 0]; g.meta.block = [44, 15, 4];
    if (lv >= 2) g.sprite([8, 34, 0], P => QK.tripod(P));
  } },
  { name: 'К-2. Штольня в холме: деревянный портал, рельсы, вагонетка с камнем, фонари', make(g, lv) {
    g.meta = {};
    dome(g, 32, 70, 26, 0, 24, matRock, m1Flat(P1.stoneB[3]), 24, 6, 0.5);
    box(g, { x0: 20, x1: 44, y0: 34, y1: 48, h: 16, mat: matRock, top: rockTop });   // скальный лоб перед холмом — в нём портал
    elem(g, 'S', 34, 25, 0, 14, 13, (u, v) => (v > 11 || u < 2 || u > 11 ? P3.oak[1] : v > 10 ? P3.oak[0] : P1.ink));   // портал
    post1(g, 24, 32, 0, 13, 2, P3.oak); post1(g, 39, 32, 0, 13, 2, P3.oak); beam1(g, 23, 42, 32, 34, 13, 2, P3.oak);
    g.sprite([32, 20, 0.3], P => { for (let y = 0; y < 14; y += 3) PR.rect(P, -5, -y, 5, -y, P1.plank[2]); PR.rect(P, -4, -14, -4, 0, P1.iron[1]); PR.rect(P, 4, -14, 4, 0, P1.iron[1]); }, -0.1);
    g.sprite([32, 18, 0.3], P => QK.cart(P)); g.meta.doorPt = [32, 32, 0];
    g.sprite([22, 32, 12], P => Q1.lantern(P), -0.5); g.sprite([43, 32, 12], P => Q1.lantern(P), -0.5);
    g.sprite([50, 14, 0], P => QS.blocks(P)); g.sprite([12, 12, 0], P => QS.rocks(P, 6, P1.stoneB));
    if (lv >= 2) g.sprite([54, 30, 0], P => QK.slabs(P));
    if (lv >= 3) g.sprite([8, 30, 0], P => Q1.streetLamp(P, 14));
  } },
  { name: 'К-3. Двор каменотёса: расколотый валун, тренога с блоком, готовые плиты, верстак', make(g, lv) {
    g.meta = {};
    boulder(g, 20, 40, 11, 14); boulder(g, 36, 42, 10, 13);   // валун, расколотый надвое
    box(g, { x0: 27, x1: 29, y0: 30, y1: 52, h: 13, mat: m1Flat(P1.ink) });
    g.sprite([28, 28, 0], P => QK.wedges(P)); g.meta.work = [28, 24, 0];
    g.sprite([50, 30, 0], P => QK.tripod(P)); g.sprite([56, 52, 0], P => QK.slabs(P)); g.sprite([8, 54, 0], P => QK.slabs(P));
    const R = STRS(lv, STRAW1.olive, P1.tileR);
    for (const [x, y] of [[4, 8], [22, 8], [4, 20], [22, 20]]) post1(g, x, y, 0, 10, 2);
    roof(g, { x0: 4, x1: 24, y0: 8, y1: 22, h: 10 }, { type: 'lean', down: 'S', rise: 4, ov: 2, mat: R.mat, cut: R.cut, th: 2 });
    box(g, { x0: 8, x1: 20, y0: 12, y1: 16, h: 5, mat: m1Stone(P1.stone, 4, 3), top: m1Flat(P1.stone[0]) });
    g.sprite([14, 14, 5], P => QS.pick(P), -0.5); g.meta.doorPt = [14, 8, 0];
    g.sprite([40, 10, 0], P => QS.blocks(P)); g.sprite([56, 12, 0], P => Q1.barrow(P));
    if (lv >= 3) g.sprite([60, 34, 0], P => Q1.lantern(P));
  } },
  { name: 'К-4. Рунный карьер: яма в земле, кольцо стоячих камней, светящиеся жилы, кристаллы', make(g, lv) {
    g.meta = {};
    g.sprite([32, 38, 0.2], P => { PR.ell(P, 0, -6, 20, 10, (x, y, a, b) => { const d = a * a + b * b; return d > 0.8 ? P1.stoneB[2] : d > 0.55 ? P1.stoneB[3] : bhash(x, y, 1031) < 0.04 ? P3.rune[1] : P1.ink; }); for (let k = 0; k < 8; k++) { const x = Math.round(Math.cos(k) * 12), y = -6 + Math.round(Math.sin(k) * 5); P(x, y, P3.rune[k % 2]); } }, -0.1);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + 0.3; g.sprite([32 + Math.cos(a) * 24, 44 + Math.sin(a) * 18, 0], P => Q3.runeStone(P, 10 + (k % 3) * 2)); }
    boulder(g, 54, 56, 8, 10); boulder(g, 10, 58, 7, 9);
    g.sprite([14, 14, 0], P => QS.rocks(P, 6, P3.crystal)); g.sprite([52, 14, 0], P => QS.blocks(P)); g.sprite([32, 10, 0], P => Q3.crystalLamp(P, 12));
    g.meta.doorPt = [32, 28, 0]; g.meta.work = [32, 32, 0];
    if (lv >= 2) g.sprite([20, 30, 14], P => Q3.wisp(P), -2);
    if (lv >= 3) g.sprite([56, 32, 0], P => Q3.banner(P));
  } },
];

const BV1 = (make, title, w, h, top) => ({ w, h, top, vars: [1, 2, 3].map(lv => ({ name: `уровень ${lv}`, make: g => make(g, lv) })), title, bk: 1, ink: P1.ink });
BDEFS.school3 = BV1(buildSchool, 'Школа: волшебный фахверк + башня, площадка', 3, 3, 96);
BDEFS.saw3 = BV1(buildSaw, 'Лесопилка: цех в углу, большая циркулярка', 3, 2, 58);
BDEFS.wood3 = BV(WOOD2_VARS, 'Дом лесоруба в пне: 4 новых варианта', 2, 2, 66);
BDEFS.quarry3 = BV(QUARRY2_VARS, 'Каменоломня: 4 новых варианта', 2, 2, 50);
