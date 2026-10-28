'use strict';
// Блок 3а — рудники 3×2 (без поворота, ставятся вплотную под скалой: штольня сзади, в скалу; спереди двор).
// Три вида должны сильно отличаться: золото — тёплый, богатый (промывка, рельсы, позолота); железо — тёмный, тяжёлый
// (копёр с колесом, ржавые отвалы, обжиговая печь, сажа); магические камни — грот с огромными светящимися кристаллами и рунами.

const GOLDV = bramp(['#fff0a0', '#ffd040', '#d09820', '#8a6010']);
const RUST = bramp(['#d88050', '#a85230', '#7a3420', '#4a2014']);
const SOOT = bramp(['#6a6670', '#4a4650', '#302c36', '#1c1a22']);
const SLATE = bramp(['#7a7aa0', '#55557a', '#3a3a58', '#24243a']);
const CRYV = bramp(['#f4ecff', '#d0b0ff', '#9a70f0', '#5a3ab0']);
const CRYT = bramp(['#e8fffa', '#9af0e0', '#40c0b0', '#1a7a72']);

// природный камень плитами (как matRock), своя палитра R и жилы V; сверху мох
const matRockT = (R, V, vk, moss = P1.ivy) => (u, v, F) => {
  const k = L1(F), cx = Math.floor(u / 11), cy = Math.floor(v / 8);
  let best = 1e9, sec = 1e9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const gx = cx + i, gy = cy + j, px = (gx + bhash(gx, gy, 1011)) * 11, py = (gy + bhash(gx, gy, 1012)) * 8, d = Math.hypot(u - px, (v - py) * 1.3); if (d < best) { sec = best; best = d; id = gx * 31 + gy; } else if (d < sec) sec = d; }
  if (sec - best < 1.2) return R[3];
  if (V && bhash(Math.floor(u / 2) + id * 3, Math.floor(v / 2), 1802) < vk) return p1(V, (u + v) % 3 ? 1 : 0);   // жила
  if (moss && F.L && v / F.L < 0.22 && bhash(u, v, 1013) < 0.55) return moss[bcl(k + 1, 3)];
  const h = bhash(id, 0, 1014);
  return p1(R, (h < 0.3 ? 0 : h < 0.8 ? 1 : 2) + k);
};
// скальный хребет за рудником: два ряда валунов разной высоты (неровный силуэт), передний край — y0
function mineCliff(g, x0, x1, y0, y1, h, R, V, vk = 0.05, moss = P1.ivy, gap = null) {   // gap = [xa, xb] — проём в переднем ряду под устье штольни
  const M = matRockT(R, V, vk, moss), cut = m1Flat(R[3]);
  for (let x = x0 + 13, k = 0; x <= x1 - 13; x += (x1 - x0 - 26) / 5, k++) { const inGap = gap && x + 13 > gap[0] && x - 13 < gap[1], r = inGap ? 9 : 13; dome(g, x, y1 - r, r, 0, h * (0.95 + bhash(k, 0, 1820) * 0.35), M, cut, 20, 6, 0.5); }   // задний ряд выше; валуны целиком в участке; над устьем — поменьше и дальше, чтобы вход был виден
  for (let x = x0 + 10, k = 0; x < x1 - 6; x += 12, k++) { const r = Math.min(10 + bhash(k, 1, 1821) * 4, x - x0, x1 - x); if (gap && x + r > gap[0] && x - r < gap[1]) continue; dome(g, x, y0 + r * 0.8, r, 0, h * (0.5 + bhash(k, 2, 1822) * 0.3), M, cut, 18, 5, 0.5); }
  return M;
}
// ровный срез скалы под вход (на нём рисуется устье штольни)
function rockFace(g, x0, x1, y, d, h, M) { box(g, { x0, x1, y0: y, y1: y + d, h, mat: M, top: M }); }
// рельсы по земле: шпалы и две полосы
function rails(g, x0, x1, y0, y1, along = 'Y') {
  box(g, { x0, x1, y0, y1, h: 0.4, mat: () => null, top: (u, v) => {
    const a = along === 'Y' ? v : u, c = along === 'Y' ? u : v, W = along === 'Y' ? (x1 - x0) : (y1 - y0);
    if (Math.abs(c - 1) < 0.6 || Math.abs(c - (W - 2)) < 0.6) return P1.iron[c < 2 ? 0 : 1];
    return ((a % 3) + 3) % 3 === 0 ? P1.plank[2] : null;
  } });
}
const QM = {
  cart(P, load = null, L = P1.stone) {   // вагонетка на рельсах, сверху горка груза
    PR.rect(P, -7, -8, 7, -2, P1.iron[1]); PR.rect(P, -7, -8, 7, -8, P1.iron[0]); PR.rect(P, -6, -7, 6, -3, P1.plank[2]);
    for (const x of [-4, 4]) { PR.ell(P, x, -1, 2, 2, () => P1.iron[2]); P(x, -1, P1.iron[0]); }
    if (load) PR.ell(P, 0, -9, 6, 3, (x, y, a, b) => (b > 0.3 ? null : bhash(x, y, 1805) < 0.25 ? load[0] : bhash(x, y, 1806) < 0.5 ? load[1] : L[1]));
  },
  crystal(P, h = 18, w = 4, R = CRYV) {   // гранёный кристалл: сужается к острию, три грани (свет / ребро / тень), блик на ребре
    for (let y = 0; y < h; y++) {
      const t = y / h, hw = Math.max(0, Math.round(t < 0.7 ? w * (1 - t * 0.35) : w * 0.75 * (1 - (t - 0.7) / 0.3)));
      for (let x = -hw; x <= hw; x++) { const f = (x + hw) / (2 * hw + 1); P(x, -y, x === -hw || x === hw ? R[3] : f < 0.38 ? R[1] : f < 0.5 ? R[0] : R[2]); }
      if (y % 7 === 3 && hw > 1) P(-hw + 1, -y, R[0]);
    }
  },
  cluster(P, s = 1, R = CRYV) { QM.crystal(P, 18 * s, Math.max(2, 3.5 * s | 0), R); QM.crystal((x, y, c) => P(x - 6 * s, y + 1, c), 12 * s, 3, R); QM.crystal((x, y, c) => P(x + 6 * s, y + 1, c), 10 * s, 3, R); QM.crystal((x, y, c) => P(x + 2 - 9 * s, y + 2, c), 6 * s, 2, R); },
  nuggets(P, n = 6) { for (let k = 0; k < n; k++) { const x = Math.round((bhash(k, 0, 1807) - 0.5) * 12), y = -Math.round(bhash(k, 1, 1808) * 4); PR.ell(P, x, y, 1.6, 1.2, () => GOLDV[1]); P(x - 1, y - 1, GOLDV[0]); } },
  oreChunks(P, w = 9, R = RUST, S = SOOT) {   // куча рубленой руды: угловатые куски, ржавый блик сверху-слева, тень снизу-справа
    const n = Math.round(w * 2.2);
    for (let k = 0; k < n; k++) {
      const a = bhash(k, 0, 1850) * Math.PI * 2, rr = Math.sqrt(bhash(k, 1, 1851)), x = Math.round(Math.cos(a) * rr * w), y = -Math.round((1 - rr) * w * 0.55 + bhash(k, 2, 1852) * 2), s = 1 + (bhash(k, 3, 1853) * 2 | 0), C = bhash(k, 4, 1854) < 0.35 ? S : R;
      for (let j = -s; j <= s; j++) for (let i = -s + Math.abs(j); i <= s - Math.abs(j) + (j < 0 ? 1 : 0); i++) P(x + i, y + j, i + j < -s / 2 ? C[0] : i + j > s / 2 ? C[3] : C[1 + (j > 0 ? 1 : 0)]);
    }
  },
  oreHeap(P, w = 10, R = RUST) { PR.ell(P, 0, -w * 0.4, w, w * 0.5, (x, y, a, b) => (b > 0.55 ? null : bhash(x, y, 1809) < 0.2 ? R[3] : b < -0.3 ? R[0] : R[1 + (a > 0.3 ? 1 : 0)])); },
  pulley(P, r = 7) {   // колесо копра: обод, спицы, ступица
    PR.ell(P, 0, -r, r, r, (x, y, a, b) => { const d = Math.hypot(a, b); if (d > 0.82) return SOOT[1]; if (d < 0.2) return P1.iron[0]; const an = Math.atan2(b, a); return Math.abs(Math.sin(an * 3)) < 0.18 ? SOOT[2] : null; });
  },
  pan(P) { PR.ell(P, 0, -1, 4, 1.5, () => P1.iron[1]); PR.ell(P, 0, -1, 3, 1, () => bhex('#6a9ac8')); P(1, -1, GOLDV[0]); },
  goldSign(P) { PR.rect(P, 0, -18, 0, 0, P3.oak[1]); PR.rect(P, -7, -18, 7, -11, P3.oak[2]); PR.ell(P, 0, -14.5, 3, 2.5, () => GOLDV[1]); P(-1, -15, GOLDV[0]); },
  runeArch(P, w = 14, h = 22) {   // арка из двух рунических столбов и перемычки
    for (const x of [-w, w]) { PR.rect(P, x - 2, -h, x + 2, 0, P1.stoneW[1]); PR.rect(P, x + 1, -h, x + 2, 0, P1.stoneW[2]); PR.rect(P, x - 2, -h, x - 2, 0, P1.stoneW[0]); for (let y = -h + 3; y < -1; y += 4) { P(x, y, P3.rune[0]); P(x, y + 1, P3.rune[1]); } }
    PR.rect(P, -w - 3, -h - 4, w + 3, -h, P1.stoneW[1]); PR.rect(P, -w - 3, -h - 4, w + 3, -h - 4, P1.stoneW[0]); PR.rect(P, -w - 3, -h, w + 3, -h, P1.stoneW[2]); for (let x = -w + 1; x < w; x += 3) { P(x, -h - 2, P3.rune[0]); P(x + 1, -h - 2, P3.rune[1]); }
  },
};

// ---- объёмный реквизит (грани растеризатора — тот же мелкий пиксель и свет, что у зданий) ----
// вагонетка вдоль рельсов (ось Y): кузов, борта, колёса по бокам, сверху горка груза
function cart3(g, x, y, load, L = P1.stone, z0 = 0.4) {
  for (const yy of [y - 4, y + 2.5]) for (const xx of [x - 4.6, x + 3.6]) box(g, { x0: xx, x1: xx + 1, y0: yy, y1: yy + 2.5, z0, h: 2.5, mat: (u, v, F) => P1.iron[2 + (F.li === 0 ? 0 : 0)], top: m1Flat(P1.iron[1]) });
  box(g, { x0: x - 3.6, x1: x + 3.6, y0: y - 5.5, y1: y + 5.5, z0: z0 + 1.2, h: 4.5, mat: (u, v, F) => (F.fu != null && (v < 0.4 || v > F.h - 0.5) ? P1.iron[0] : (Math.floor(u) % 4 === 0 && F.fu != null && F.fu < 0.3) ? P1.iron[2] : P1.iron[F.li === 0 ? 1 : 2]), top: (u, v) => (u < 0.7 || v < 0.7 || u > 6.5 || v > 10.3 ? P1.iron[0] : P1.dark[2]) });
  if (load) dome(g, x, y, 3.4, z0 + 5.6, 2.4, (u, v, F) => (bhash(Math.floor(u * 2), Math.floor(v * 2), 1840) < 0.3 ? load[0] : bhash(Math.floor(u * 2), Math.floor(v * 2), 1841) < 0.6 ? load[1] : L[1 + (F.li > 1 ? 1 : 0)]), m1Flat(L[2]), 12, 3, 0.5);
}
function crate3(g, x, y, s = 7, z0 = 0) {   // ящик: доски с рамой по рёбрам
  const fr = R => (u, v, F) => { const w = F.w || s, h = F.h || s; if (u < 0.8 || v < 0.8 || u > w - 0.8 || v > h - 0.8) return R[2]; return m1Plank(R, 2.4)(u, v, F); };
  box(g, { x0: x - s / 2, x1: x + s / 2, y0: y - s / 2, y1: y + s / 2, z0, h: s * 0.85, mat: fr(P1.plank), top: fr(P1.plank) });
}
function barrel3(g, x, y, r = 3.2, h = 7, z0 = 0) {   // бочка: клёпки, два обруча, крышка
  cyl(g, x, y, r, z0, z0 + h, (u, v, F) => { const vv = v / (F.h || h * 3); if (Math.abs(v - 1.5) < 0.6 || Math.abs(v - h + 1.5) < 0.6) return P1.iron[1 + (F.li > 1 ? 1 : 0)]; const c = P1.plank[(Math.floor(u / 1.6) % 2) + (F.li > 1 ? 1 : 0)]; return F.fu != null && (u % 1.6) < 0.3 ? fShade(c, 0.8) : c; }, 14);
  cone(g, x, y, r, z0 + h, 0.3, m1Flat(P1.plank[0]), m1Flat(P1.plank[2]), 14, 0.5);
}
// кристалл — шестигранная призма с острием: настоящие грани ловят свет, на гранях тонкие прожилки и блик
const crysMat = R => (u, v, F) => { const i = F.li === 0 ? 0 : F.li === 1 ? 1 : F.li === 2 ? 2 : 3; let c = R[Math.min(3, i)]; if (F.fu != null) { if (bhash(Math.floor(u * 3), 0, 1842) < 0.12) c = fShade(c, 1.15); if (F.fx % 7 === 0 && bhash(F.fx, Math.floor(v), 1843) < 0.4) c = fShade(c, 0.9); } return c; };
function crystal3(g, x, y, h, r, R = CRYV, z0 = 0) { cyl(g, x, y, r, z0, z0 + h * 0.72, crysMat(R), 6); cone(g, x, y, r, z0 + h * 0.72, h * 0.28, crysMat(R), m1Flat(R[3]), 6, 0.5); }
function cluster3(g, x, y, s = 1, R = CRYV, z0 = 0) { crystal3(g, x, y, 18 * s, 2.6 * s, R, z0); crystal3(g, x - 4.5 * s, y + 1.5, 12 * s, 1.9 * s, R, z0); crystal3(g, x + 4.5 * s, y + 1, 10 * s, 1.7 * s, R, z0); crystal3(g, x - 2 * s, y - 3 * s, 6 * s, 1.3 * s, R, z0); }

function portal(g, x0, x1, y, h, R = P3.oak) {   // крепь у входа в штольню: стойки и перемычка (грани — в боковом виде ровно)
  post1(g, x0 - 2, y - 2, 0, h, 2.5, R); post1(g, x1, y - 2, 0, h, 2.5, R); beam1(g, x0 - 3, x1 + 3, y - 3, y + 0.5, h, 2.5, R);
}

// устье штольни на срезе скалы: рамы крепи уходят вглубь, рельсы сходятся, в глубине теплится фонарь
function adit(g, y, x0, w, h, z0 = 0) {
  const cx = w / 2;
  elem(g, 'S', y, x0, z0, w, h, (u, v) => {
    const top = h - 1 - Math.max(0, Math.abs(u - cx) - cx * 0.6) * 0.8; if (v > top) return null;   // свод
    const d = Math.min(u, w - u, (top - v) * 1.3, v * 3 + 2.5);   // насколько глубоко (0 — у края)
    for (const f of [1.2, 3.4, 5.4]) if (Math.abs(d - f) < 0.45 && v > 0.6) return P3.oak[f < 2 ? 1 : 2];   // рамы крепи
    if (v < 1.2 && (Math.abs(u - cx + 1.5 - d * 0.2) < 0.35 || Math.abs(u - cx - 1.5 + d * 0.2) < 0.35)) return P1.iron[1];   // рельсы
    if (d > 6 && Math.abs(u - cx) < 1 && Math.abs(v - 2.5) < 1) return bhex('#ffc860');   // фонарь в глубине
    return P1.dark[d > 4.5 ? 3 : d > 2.5 ? 2 : 1];
  });
}

// =================== ЗОЛОТО ===================
const GOLD_VARS = [
  { name: 'З-1. Золотая штольня: крепь, рельсы из штольни, вагонетка с самородками, промывочный жёлоб с колесом', make(g, lv) {
    g.meta = { piles: {} };
    const MG = mineCliff(g, 0, 96, 42, 64, 28, P1.stoneW, GOLDV, 0.07, P1.ivy, [30, 54]); rockFace(g, 30, 54, 44, 8, 20, MG);
    adit(g, 44, 34, 16, 14); g.meta.doorPt = [42, 44, 0];
    portal(g, 34, 50, 44, 15); g.sprite([42, 43, 16], P => QM.goldSign(P), -0.5);
    rails(g, 37, 47, 4, 44);
    if (!g.dynPiles) cart3(g, 42, 24, GOLDV, P1.stoneW); g.meta.cart = [[42, 38, 0.4], [42, 8, 0.4]]; g.meta.cartLoad = 'gold';   // в игре вагонетка ездит (inside.js)
    // промывочный жёлоб на козлах, справа — колесо, внизу лоток
    for (const [x, y] of [[60, 28], [78, 22]]) post1(g, x, y, 0, 6, 2, P1.plank);
    box(g, { x0: 58, x1: 82, y0: 22, y1: 30, z0: 6, h: 2, mat: m1Plank(P1.plank, 3), top: (u, v) => (v > 1 && v < 6 ? (bhash(u, v, 1810) < 0.1 ? P1.white[0] : bhex('#6aa6d8')) : P1.plank[1]) });
    g.sprite([90, 26, 2], P => QS.wheel(P, 9)); g.meta.wheel = [90, 26, 11];   // колесо в конце жёлоба, не на нём
    g.sprite([70, 12, 0], P => QM.pan(P));
    g.meta.piles.goldore = [[32, 30, 0], [32, 18, 0], [54, 8, 0]].slice(0, lv + 1);
    if (!g.dynPiles) for (const p of g.meta.piles.goldore) g.sprite(p, P => QM.nuggets(P, 8));
    g.meta.miner = [42, 46, 0]; g.meta.panner = [72, 14, 0];
    const R = STRS(lv, STRAW_F.amber, P1.tileR), H = { x0: 2, x1: 28, y0: 4, y1: 22, h: 12 };   // будка учётчика
    box(g, Object.assign({ mat: m1Plank(P1.plank, 3) }, H)); roof(g, H, { type: 'gable', axis: 'X', rise: 9, ov: 2, ovg: 2, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plank, 3) });
    elem(g, 'S', H.y0, 11, 0, 8, 10, m1Door({ w: 8, h: 10, col: P1.red })); elem(g, 'S', H.y0, 21, 4, 5, 5, m1Window({ w: 5, h: 5 }));
    if (lv >= 2) { g.sprite([30, 10, 0], P => Q2.scale(P)); g.sprite([56, 40, 0], P => Q1.lantern(P), -1); }
    if (lv >= 3) { g.sprite([92, 8, 0], P => Q1.streetLamp(P, 14)); crate3(g, 8, 36); crate3(g, 15, 37); crate3(g, 11.5, 36.5, 6, 6); }
  } },
  { name: 'З-2. Золотой карьер-уступ: ворот над шахтой, позолоченная скала, навес с весами', make(g, lv) {
    g.meta = { piles: {} };
    mineCliff(g, 0, 96, 44, 64, 30, P1.stoneW, GOLDV, 0.1);
    // шахта-колодец с воротом
    box(g, { x0: 66, x1: 84, y0: 30, y1: 44, h: 3, mat: m1Plank(P1.plank, 3), top: (u, v) => (u > 3 && u < 15 && v > 3 && v < 11 ? P1.dark[3] : P1.plank[1]) });
    post1(g, 66, 36, 3, 14, 2, P3.oak); post1(g, 82, 36, 3, 14, 2, P3.oak); g.sprite([75, 37, 17], P => { PR.rect(P, -9, -1, 9, 1, P1.log[1]); PR.ell(P, 0, 0, 3, 3, () => P1.log[2]); PR.rect(P, 0, 3, 0, 12, BP.rope[1]); }, -0.3);
    g.meta.doorPt = [75, 30, 0]; g.meta.winch = [75, 37, 17];
    const R = STRS(lv, STRAW_F.sun, P1.tileR);
    for (const [x, y] of [[6, 6], [30, 6], [6, 22], [30, 22]]) post1(g, x, y, 0, 11, 2);
    roof(g, { x0: 4, x1: 34, y0: 6, y1: 24, h: 11 }, { type: 'lean', down: 'S', rise: 4, ov: 2, mat: R.mat, cut: R.cut, th: 2 });
    g.sprite([18, 14, 0], P => Q2.scale(P));
    g.meta.piles.goldore = [[46, 20, 0], [56, 26, 0], [50, 12, 0]].slice(0, lv + 1);
    if (!g.dynPiles) for (const p of g.meta.piles.goldore) g.sprite(p, P => QM.nuggets(P, 8));
    g.sprite([88, 10, 0], P => QM.cart(P, GOLDV, P1.stoneW)); g.meta.miner = [70, 26, 0];
    if (lv >= 3) g.sprite([92, 26, 0], P => Q1.streetLamp(P, 14));
  } },
];

// =================== ЖЕЛЕЗО ===================
let IRON_ORE_LAYOUT = 'row';   // выбор владельца: рядок кучек слева от рельсов ('heap' — одной кучей)
const IRON_VARS = [
  { name: 'Ж-1. Железная шахта с копром: штольня в скале, копёр с колесом над стволом, ржавые отвалы, обжиговая печь дымит', make(g, lv) {
    g.meta = { piles: {} };
    const MI = mineCliff(g, 0, 96, 44, 64, 30, SOOT, RUST, 0.08, null, [6, 30]); rockFace(g, 6, 30, 46, 8, 20, MI);
    adit(g, 46, 10, 15, 14); portal(g, 10, 25, 46, 15, SOOT); g.meta.doorPt = [17, 46, 0];
    rails(g, 13, 22, 2, 46); if (!g.dynPiles) cart3(g, 17.5, 20, RUST, SOOT); g.meta.cart = [[17.5, 40, 0.4], [17.5, 6, 0.4]]; g.meta.cartLoad = 'iron';
    // копёр: четыре стойки, перемычки, площадка, колесо наверху; под ним — устье ствола
    const cx = 48, cy = 36;   // копёр ровный: прямоугольная башня, неглубокая (вид спереди без перекоса), колесо по центру
    for (const [x, y] of [[cx - 8, cy - 3], [cx + 6, cy - 3], [cx - 8, cy + 3], [cx + 6, cy + 3]]) post1(g, x, y, 0, 34, 2.5, SOOT);
    for (const z of [10, 20, 30]) for (const y of [cy - 3, cy + 3]) beam1(g, cx - 8, cx + 8.5, y, y + 2, z, 1.5, SOOT);
    box(g, { x0: cx - 9, x1: cx + 9.5, y0: cy - 4, y1: cy + 6, z0: 34, h: 1.5, mat: m1Plank(P1.plank, 3, false), top: m1Plank(P1.plank, 3) });
    g.sprite([cx + 0.25, cy - 3, 36], P => QM.pulley(P, 8), -6); g.meta.pulley = [cx + 0.25, cy - 3, 44];
    box(g, { x0: cx - 6, x1: cx + 6, y0: cy - 9, y1: cy - 3, h: 2, mat: m1Stone(SOOT, 4, 3), top: (u, v) => (u > 2 && u < 10 && v > 1 && v < 5 ? P1.dark[3] : SOOT[1]) });   // устье ствола перед башней
    g.meta.cage = [cx, cy - 4, 4];
    // обжиговая печь: каменная башенка, конус в саже, жерло с жаром
    cyl(g, 80, 30, 9, 0, 14, m1Stone(P1.stoneB, 4, 3), 20); cone(g, 80, 30, 7, 14, 10, m1Stone(SOOT, 4, 3), m1Flat(SOOT[2]), 18, 1);
    elem(g, 'S', 21.5, 76, 0, 8, 6, (u, v) => (v > 5 ? null : v < 3 ? bhex('#ff9a30') : bhex('#c04818'))); g.meta.kiln = [80, 21, 3]; g.meta.smoke = [80, 30, 26];
    g.meta.piles.ironore = (IRON_ORE_LAYOUT === 'heap' ? [[6, 36, 0], [9, 31, 0], [4, 28, 0], [8, 25, 0]] : [[8, 40, 0], [8, 32, 0], [8, 24, 0], [8, 16, 0]]).slice(0, lv + 1);   // одной кучей между рельсами и скалой — или рядком слева от рельсов
    if (!g.dynPiles) for (const p of g.meta.piles.ironore) g.sprite(p, P => QM.oreChunks(P, IRON_ORE_LAYOUT === 'heap' ? 7 : 5));
    g.sprite([66, 8, 0], P => QM.oreChunks(P, 6, SOOT, SOOT));   // шлак у печи
    // передний двор: рудодробилка — каменная плита, рама из бруса, три песта с бойками; руду дробят перед печью
    box(g, { x0: 28, x1: 46, y0: 6, y1: 16, h: 3, mat: m1Stone(P1.stoneB, 5, 3), top: (u, v) => (bhash(Math.floor(u * 2), Math.floor(v * 2), 1860) < 0.25 ? RUST[1] : P1.stoneB[1]) });
    for (const x of [29, 43]) post1(g, x, 10, 3, 16, 2, P3.oak);
    beam1(g, 28.5, 45.5, 10, 12, 19, 2, P3.oak); beam1(g, 28.5, 45.5, 10, 12, 12, 1.2, P3.oak);
    for (const [k, x] of [[0, 32.5], [1, 36.5], [2, 40.5]]) { const lift = [3, 0, 1.5][k]; box(g, { x0: x - 0.5, x1: x + 0.5, y0: 10.5, y1: 11.5, z0: 6 + lift, h: 13 - lift, mat: m1Flat(P1.iron[1]), top: m1Flat(P1.iron[0]) }); box(g, { x0: x - 1.4, x1: x + 1.4, y0: 9.6, y1: 12.4, z0: 3 + lift, h: 3, mat: (u, v, F) => P1.iron[F.li === 0 ? 1 : 2], top: m1Flat(P1.iron[0]) }); }
    g.meta.stamp = [37, 11, 3]; g.meta.crusher = [50, 8, 0];
    g.meta.miner = [17, 48, 0]; g.meta.stoker = [70, 18, 0];   // кочегар у печи
    if (lv >= 2) barrel3(g, 92, 14);
    if (lv >= 3) { g.sprite([62, 40, 0], P => Q1.streetLamp(P, 14)); crate3(g, 66, 16); }
  } },
  { name: 'Ж-2. Рудник-бастион: каменный корпус в скале, окованные ворота, жёлоб для руды в бункеры, две трубы', make(g, lv) {
    g.meta = { piles: {} };
    const MI = mineCliff(g, 0, 96, 48, 64, 30, SOOT, RUST, 0.07, null);
    const R = STRS(lv, STRAW_X.rust, P1.slate), M = { x0: 6, x1: 56, y0: 30, y1: 50, h: 16 };
    box(g, Object.assign({ mat: m1Stone(P1.stoneB, 6, 4) }, M)); roof(g, M, { type: 'gable', axis: 'X', rise: 10, ov: 2, ovg: 2, mat: R.mat, cut: R.cut, th: R.th, gable: m1Stone(P1.stoneB, 6, 4) });
    elem(g, 'S', M.y0, 22, 0, 16, 13, (u, v) => (u < 1 || u > 14 || v > 11 ? SOOT[2] : (v % 4 === 0 || u % 5 === 0) ? P1.iron[2] : P3.oak[1])); g.meta.doorPt = [30, M.y0, 0];
    chimney1(g, 12, 44, M.h + 10, 10, { stone: true, w: 5, d: 5 }); chimney1(g, 48, 44, M.h + 8, 8, { stone: true, w: 4, d: 4 });
    // жёлоб из скалы в бункеры
    box(g, { x0: 66, x1: 72, y0: 26, y1: 50, z0: 8, h: 2, mat: m1Plank(P1.plank, 3), top: (u, v) => (bhash(u, v, 1813) < 0.3 ? RUST[1] : P1.plank[2]) });
    for (const y of [28, 40]) post1(g, 66, y, 0, 8, 2, P3.oak);
    for (const [x0] of [[62], [74]]) box(g, { x0, x1: x0 + 10, y0: 14, y1: 24, h: 7, mat: m1Plank(P1.plank, 3), top: (u, v) => (bhash(u, v, 1814) < 0.6 ? RUST[1 + (u + v) % 2] : RUST[3]) });
    g.meta.piles.ironore = [[86, 30, 0], [88, 18, 0], [84, 8, 0]].slice(0, lv + 1);
    if (!g.dynPiles) for (const p of g.meta.piles.ironore) g.sprite(p, P => QM.oreHeap(P, 8));
    g.meta.smoke = [12, 44, 28]; g.meta.miner = [40, 22, 0]; g.meta.cart = [[60, 10, 0.4], [30, 10, 0.4]];
    if (lv >= 2) g.sprite([6, 14, 0], P => QM.oreHeap(P, 7, SOOT));
    if (lv >= 3) g.sprite([56, 6, 0], P => Q1.streetLamp(P, 14));
  } },
];

// =================== МАГИЧЕСКИЕ КАМНИ ===================
// основа (выбрана владельцем): тёмная скала с друзами у подножия, грот-штольня в рунической арке; двор — по варианту
function crysBase(g, lv) {
  g.meta = { piles: {} };
  const MC = mineCliff(g, 0, 96, 42, 64, 30, SLATE, CRYV, 0.06, P1.ivy, [34, 60]); rockFace(g, 34, 60, 44, 8, 22, MC);
  adit(g, 44, 38, 18, 16); g.meta.doorPt = [47, 44, 0];
  g.sprite([47, 42, 0], P => QM.runeArch(P, 11, 20), -20);   // высокий плакат у стены: глубину берём с запасом, иначе верх уходит за скалу
  for (const [x, y, s, R] of [[12, 38, 1.2, CRYV], [24, 44, 0.9, CRYT], [72, 38, 1.3, CRYV], [86, 44, 1, CRYT]]) cluster3(g, x, y, s, R);   // друзы растут из подножия скалы
  g.meta.glow = [[10, 38, 14], [72, 38, 16], [88, 44, 12], [47, 42, 10]];
  g.meta.miner = [47, 46, 0];
}
const CRYS_VARS = [
  { name: 'М-1. Кристальный грот (как было): рельсы и вагонетка, фонари-кристаллы, рунный камень', make(g, lv) {
    crysBase(g, lv);
    rails(g, 43, 51, 6, 44); g.sprite([47, 18, 0.4], P => QM.cart(P, CRYV, SLATE)); g.meta.cart = [[47, 38, 0.4], [47, 10, 0.4]];
    g.meta.piles.magicstone = [[16, 22, 0], [28, 28, 0], [20, 12, 0]].slice(0, lv + 1);
    if (!g.dynPiles) for (const p of g.meta.piles.magicstone) cluster3(g, p[0], p[1], 0.55);
    g.sprite([68, 22, 0], P => Q3.shroomPatch(P)); g.sprite([88, 6, 0], P => Q3.crystalLamp(P, 16));
    if (lv >= 2) g.sprite([62, 8, 0], P => Q3.runeStone(P, 12));
  } },
  { name: 'М-2. Кристальный сад: из светящихся грядок растут молодые кристаллы, стол сортировщика с корзинами', make(g, lv) {
    crysBase(g, lv);
    rails(g, 43, 51, 2, 44); if (!g.dynPiles) cart3(g, 47, 20, CRYV, SLATE); g.meta.cart = [[47, 38, 0.4], [47, 6, 0.4]]; g.meta.cartLoad = 'crystal';
    for (const [x0, y0] of [[4, 6], [4, 20], [60, 6], [60, 20]]) {   // грядки: тёмная земля с мерцанием, ряды ростков
      box(g, { x0, x1: x0 + 30, y0, y1: y0 + 9, h: 1.5, mat: m1Plank(P3.oak, 3, false), top: (u, v) => (bhash(u, v, 1830) < 0.05 ? P3.rune[1] : bhex(bhash(u, v, 1831) < 0.5 ? '#2a2438' : '#3a3050')) });
      for (let k = 0; k < 5; k++) crystal3(g, x0 + 4 + k * 5.5, y0 + 4.5, 4 + ((k + x0) % 3) * 2, 1, (k + y0) % 2 ? CRYV : CRYT, 1.5);
    }
    box(g, { x0: 70, x1: 90, y0: 32, y1: 38, h: 6, mat: m1Plank(P1.plank, 3), top: m1Plank(P1.plank, 3, false) });   // стол сортировщика
    cluster3(g, 76, 35, 0.45, CRYT, 6); cluster3(g, 85, 35, 0.35, CRYV, 6);
    g.meta.sorter = [80, 30, 0];
    g.meta.piles.magicstone = [[92, 26, 0], [92, 14, 0], [40, 30, 0]].slice(0, lv + 1);
    if (!g.dynPiles) for (const p of g.meta.piles.magicstone) cluster3(g, p[0], p[1], 0.55);
    g.sprite([2, 2, 0], P => Q3.crystalLamp(P, 16)); g.sprite([94, 2, 0], P => Q3.crystalLamp(P, 16));   // фонари по углам — не заслоняют вагонетку
    if (lv >= 2) g.sprite([36, 36, 0], P => Q3.runeStone(P, 12));
    if (lv >= 3) { g.sprite([94, 40, 0], P => Q3.owl(P), -0.4); g.sprite([58, 36, 0], P => Q3.shroomPatch(P)); }
  } },
  { name: 'М-3. Светящееся озерцо: бирюзовая вода у грота, мостки к входу, кристаллы по берегу, лодочка с добычей', make(g, lv) {
    crysBase(g, lv);
    box(g, { x0: 6, x1: 40, y0: 6, y1: 36, h: 0.3, mat: () => null, top: (u, v) => { const r = Math.hypot((u - 17) / 17, (v - 15) / 15); if (r > 1) return null; if (r > 0.88) return SLATE[2]; return bhash(u, v, 1832) < 0.04 ? CRYT[0] : r < 0.5 ? CRYT[2] : CRYT[3]; } });   // озерцо
    box(g, { x0: 42, x1: 52, y0: 0, y1: 44, h: 1.2, mat: m1Plank(P1.plank, 3, false), top: m1Plank(P1.plank, 3, false) });   // мостки
    for (const y of [8, 20, 32]) { post1(g, 42, y, 0, 1.6, 1.2); post1(g, 51, y, 0, 1.6, 1.2); }
    for (const [x, y] of [[8, 34], [36, 30], [6, 10], [38, 6]]) g.sprite([x, y, 0], P => QM.crystal(P, 7, 2, CRYT));
    g.sprite([22, 18, 0.3], P => { PR.ell(P, 0, -1, 7, 2.5, (x, y, a, b) => (b < -0.3 ? P1.plank[1] : P1.plank[2])); QM.cluster((x, y, c) => P(x, y - 2, c), 0.35, CRYV); });   // лодочка с кристаллами
    g.meta.pool = [23, 21, 0]; g.meta.boat = [22, 18, 0.3];
    g.meta.piles.magicstone = [[64, 26, 0], [80, 22, 0], [70, 12, 0]].slice(0, lv + 1);
    if (!g.dynPiles) for (const p of g.meta.piles.magicstone) cluster3(g, p[0], p[1], 0.55);
    g.sprite([90, 6, 0], P => Q3.crystalLamp(P, 16)); g.sprite([58, 6, 0], P => Q3.shroomPatch(P));
    if (lv >= 2) g.sprite([86, 32, 0], P => Q3.runeStone(P, 12));
  } },
  { name: 'М-4. Рунный алтарь огранки: из грота рельсы к круглому алтарю, над ним парит большой кристалл, рядом готовые камни', make(g, lv) {
    crysBase(g, lv);
    rails(g, 43, 51, 26, 44); g.meta.cart = [[47, 40, 0.4], [47, 28, 0.4]];
    cyl(g, 47, 14, 11, 0, 3, m1Stone(SLATE, 5, 3), 24);   // круглый помост
    box(g, { x0: 36, x1: 58, y0: 3, y1: 25, z0: 2.9, h: 0.2, mat: () => null, top: (u, v) => { const r = Math.hypot(u - 11, v - 11); if (r > 11) return null; return Math.abs(r - 8.5) < 0.6 ? P3.rune[1] : (Math.abs(r - 5) < 0.5 && ((Math.atan2(v - 11, u - 11) * 4 + 9) % 2) < 1) ? P3.rune[2] : SLATE[1]; } });   // рунный круг на помосте
    box(g, { x0: 43, x1: 51, y0: 11, y1: 17, z0: 3, h: 5, mat: m1Stone(SLATE, 4, 3), top: m1Flat(SLATE[0]) });   // алтарь
    g.sprite([47, 14, 12], P => QM.crystal(P, 14, 4, CRYV), -12); g.meta.float = [47, 14, 14]; g.meta.glow = g.meta.glow.concat([[47, 14, 20]]);
    g.meta.piles.magicstone = [[20, 22, 0], [74, 22, 0], [28, 10, 0]].slice(0, lv + 1);
    if (!g.dynPiles) for (const p of g.meta.piles.magicstone) cluster3(g, p[0], p[1], 0.55);
    g.sprite([66, 6, 0], P => Q3.crystalLamp(P, 16)); g.sprite([28, 6, 0], P => Q3.crystalLamp(P, 16));
    g.meta.cutter = [60, 14, 0];
    if (lv >= 2) g.sprite([86, 14, 0], P => Q3.runeStone(P, 12));
  } },
];

BDEFS.goldm = Object.assign(BV(GOLD_VARS, 'Золотой рудник', 3, 2, 70), { fine: 3 });
BDEFS.ironm = Object.assign(BV(IRON_VARS, 'Железный рудник', 3, 2, 70), { fine: 3 });
BDEFS.crysm = Object.assign(BV(CRYS_VARS, 'Шахта маг. камней', 3, 2, 70), { fine: 3 });

PILE_DRAW.goldore = f => P => QM.nuggets(P, 3 + Math.round(f * 7));
PILE_DRAW.ironore = f => P => QM.oreChunks(P, 3 + Math.round(f * 4));
PILE_DRAW.magicstone = f => P => QM.cluster(P, 0.3 + f * 0.3, f > 0.5 ? CRYV : CRYT);
