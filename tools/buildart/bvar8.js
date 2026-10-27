'use strict';
// Склад (сводный по выбору владельца): небольшое главное здание с двумя воротами (как в варианте 2),
// слева спереди — длинная пристройка-навес вдоль края участка (как крыло варианта 3), справа сзади — навес с брёвнами
// (как в варианте 2). Большая открытая площадка под работу носильщиков. Дорожки — тёплый песчаник.
// Волшебный тон: рунные камни у ворот, светящиеся руны на створках, кристальные фонари, светящиеся грибы, огоньки,
// пучки трав под стрехой, сова на коньке, лиловое знамя с золотой руной.

const P3 = {
  sand: bramp(['#e2cfa4', '#c6b083', '#a48d62', '#76643f']),       // песчаник дорожек
  rune: bramp(['#d8fff4', '#7ef0d8', '#3cbca8', '#1e7a70']),       // свечение рун (бирюза)
  crystal: bramp(['#f0e6ff', '#c6a8ff', '#8c6ae0', '#56409a']),    // кристаллы (сирень)
  violet: bramp(['#9a74c8', '#704ea0', '#4e3478', '#30204e']),     // знамя
  shroomC: bramp(['#bff8ff', '#6ad8f0', '#2e9ac0', '#1c5c80']),    // светящиеся грибы
  oak: bramp(['#7a5a3e', '#5c422c', '#42301e', '#2a1e12']),        // тёмный дуб
};

function paveSand(g, x0, x1, y0, y1) {
  const pave = (u, v) => {
    const row = Math.floor(v / 4), st = (row * 3) % 7, uu = (((u + st) % 7) + 7) % 7, vv = ((v % 4) + 4) % 4, id = Math.floor((u + st) / 7);
    if (uu === 0 || vv === 0) return P3.sand[3];
    const h = bhash(id, row, 501);
    let i = h < 0.3 ? 0 : h < 0.85 ? 1 : 2;
    if (vv === 1 && uu < 6 && i > 0) i -= 1;
    return bhash(u, v, 502) < 0.04 ? P1.grass[1] : P3.sand[i];
  };
  box(g, { x0, x1, y0, y1, h: 0.4, mat: m1Flat(P3.sand[3]), top: pave });
}
function groundYard(g, x0, x1, y0, y1) {
  box(g, { x0, x1, y0, y1, h: 0.2, mat: m1Flat(P1.dark[1]), top: (u, v) => { const h = bhash(u, v, 503); return h < 0.07 ? P1.grass[2] : h < 0.12 ? P1.grass[1] : h < 0.55 ? bhex('#8c7656') : bhex('#9e8864'); } });
}

const Q3 = {
  runeStone(P, h = 16) {   // стоячий камень с бирюзовыми рунами и мхом
    for (let y = -h; y <= 0; y++) { const hw = Math.round(3.5 - Math.max(0, (-y - h + 4)) * 0.6 + (y > -3 ? 0.5 : 0)); for (let x = -hw; x <= hw; x++) P(x, y, P1.stone[x < -hw + 2 ? 0 : x > hw - 2 ? 2 : 1]); }
    for (const [x, y] of [[0, -h + 3], [0, -h + 4], [-1, -h + 5], [1, -h + 5], [0, -h + 7], [-1, -h + 8], [0, -h + 9], [1, -h + 10], [0, -h + 11]]) P(x, y, P3.rune[1]);
    P(0, -h + 6, P3.rune[0]);
    for (const [x, y] of [[-3, -2], [-2, -1], [-3, -1], [2, -h + 2]]) P(x, y, P1.ivy[1]);
    for (const [x, y] of [[-5, -h + 4], [4, -h + 7], [-4, -h + 10], [5, -h + 2]]) P(x, y, P3.rune[2]);
  },
  crystalLamp(P, h = 18) {   // шест с кристаллом в железной оправе и ореолом
    PR.rect(P, 0, -h, 0, 0, P3.oak[1]); PR.rect(P, -1, 0, 1, 0, P3.oak[2]);
    for (let y = -h - 12; y <= -h + 2; y++) for (let x = -7; x <= 7; x++) { const d = Math.hypot(x, (y + h + 5) * 1.1); if (d < 7 && d > 3 && bdith(x, y) < 1 - d / 7) P(x, y, P3.crystal[0]); }
    PR.rect(P, -2, -h - 1, 2, -h - 1, P1.iron[1]);
    for (let k = 0; k < 7; k++) { const w = k < 3 ? k : 6 - k; PR.rect(P, -w + 0, -h - 2 - k, w, -h - 2 - k, P3.crystal[k < 2 ? 0 : w > 1 ? 1 : 2]); }
    P(-1, -h - 5, P3.crystal[0]);
  },
  glowShroom(P, r = 3) { PR.rect(P, 0, -r + 1, 0, 0, P1.cloth[0]); PR.ell(P, 0, -r, r, r * 0.6, (x, y, a, b) => (b > 0.6 ? null : P3.shroomC[a < -0.3 ? 0 : a > 0.4 ? 2 : 1])); P(0, -r - 2, P3.shroomC[0]); },
  shroomPatch(P) { Q3.glowShroom(P, 3); Q3.glowShroom((x, y, c) => P(x + 4, y + 1, c), 2); Q3.glowShroom((x, y, c) => P(x - 3, y + 1, c), 2); },
  wisp(P) { PR.ell(P, 0, 0, 2, 2, () => P3.rune[0]); for (const [x, y] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) P(x, y, P3.rune[2]); P(-2, 4, P3.rune[3]); P(-3, 6, P3.rune[3]); },
  herbs(P, n = 4) { PR.rect(P, -n * 2 - 1, 0, n * 2 + 1, 0, P3.oak[1]); for (let k = 0; k < n; k++) { const x = -n * 2 + 1 + k * 4, R = k % 2 ? P1.ivy : P1.straw; PR.rect(P, x, 1, x, 6, R[2]); P(x - 1, 3, R[1]); P(x + 1, 4, R[1]); P(x, 7, R[1]); } },
  owl(P) { PR.ell(P, 0, -5, 3, 4, (x, y, a, b) => (b < -0.5 ? P3.oak[2] : a < 0 ? P3.oak[1] : P3.oak[2])); P(-1, -6, P3.rune[0]); P(1, -6, P3.rune[0]); P(0, -5, P1.gold[2]); P(-3, -9, P3.oak[2]); P(3, -9, P3.oak[2]); PR.rect(P, -2, -1, 2, -1, P3.oak[3]); },
  banner(P) { PR.rect(P, 0, -26, 0, 0, P3.oak[1]); PR.rect(P, -1, -26, 9, -26, P3.oak[2]); for (let y = -25; y < -11; y++) { const w = y > -14 ? (y + 14) : 0; for (let x = 1; x <= 9; x++) { if (y > -14 && Math.abs(x - 5) < w) continue; P(x, y, P3.violet[x > 7 ? 1 : 0]); } } for (const [x, y] of [[5, -22], [5, -21], [4, -20], [6, -20], [5, -19], [5, -18]]) P(x, y, P1.gold[0]); },
};
// руна на створке ворот (материал-оверлей)
function runeGate(g, side, at, a, w, h) {
  elem(g, side, at - 0.4, a, h * 0.45, w, h * 0.35, m1Sprite(w, Math.round(h * 0.35), P => { for (const [x, y] of [[0, -3], [0, -2], [-1, -1], [1, -1], [0, 0], [-2, 1], [2, 1], [0, 2], [0, 3]]) P(x, y, P3.rune[(x + y) & 1 ? 1 : 0]); }));
}

function buildStore(g, lv, roofs) {
  const meta = g.meta = { piles: {}, wins: [] };
  const WIN = (side, at, a, z, w, h, o = {}) => { elem(g, side, at, a, z, w, h, m1Window(Object.assign({ w, h }, o))); meta.wins.push({ side, at, a, z, w, h }); };
  // ---- главное здание: небольшое, каменный низ, тёмный дубовый фахверк, крутая провисшая крыша
  const Lo = { x0: 54, x1: 102, y0: 58, y1: 92, h: 16 }, Up = { x0: 52, x1: 104, y0: 56, y1: 92, z0: 16, h: 12 };
  box(g, Object.assign({ mat: m1Stone(P1.stoneW) }, Lo));
  beam1(g, 52, 104, 56, 58, 15, 1, P3.oak);
  box(g, Object.assign({ mat: m1Plaster(P1.plaster, { frame: true, bay: 13, braceOdd: true, beam: P3.oak }) }, Up));
  const Z = roofSag(g, Up, { axis: 'Y', rise: 30, sag: 3, flare: 4, ov: 3, ovg: 5, mat: m1Ivy(roofs.main, [{ u: 20, v: 18, rx: 8, ry: 6 }]), cut: roofs.cut, th: roofs.th || 3, gable: m1Plaster(P1.plaster, { frame: true, bay: 11, brace: false, beam: P3.oak }) });
  // двое ворот: привоз и вывоз, со светящимися рунами
  gate1(g, 'S', Lo.y0, 57, 15, 14, true); gate1(g, 'S', Lo.y0, 74, 15, 14, true);
  runeGate(g, 'S', Lo.y0, 57, 15, 14); runeGate(g, 'S', Lo.y0, 74, 15, 14);
  meta.gates = [[64.5, Lo.y0, 0], [81.5, Lo.y0, 0]];
  WIN('S', Up.y0, 72, 18, 8, 8, { arch: true, G: P3.crystal });
  elem(g, 'S', Up.y0 - 0.3, 58, 18, 10, 8, m1Door({ w: 10, h: 8, col: P3.oak }));                 // чердачная дверца
  beam1(g, 61, 65, 48, 56, 30, 1.5, P3.oak); g.sprite([63, 50, 18], P => { PR.rect(P, 0, -10, 0, 0, BP.rope[1]); Q1.sack((x, y, c) => P(x, y + 2, c), 6, 7); });
  WIN('E', Lo.x1, 66, 5, 7, 7, { G: P3.crystal, round: true }); WIN('E', Lo.x1, 80, 5, 7, 7, { G: P3.crystal, round: true });
  g.sprite([78, 74, Z.zr(0.5) + 0.5], P => Q3.owl(P));
  chimneyCrooked(g, 92, 80, Up.z0 + Up.h + 6, 16, { stone: true, w: 5, d: 5, lean: 2 });
  g.sprite([56, 55.5, 26], P => Q3.herbs(P, 3), -0.5); g.sprite([98, 55.5, 26], P => Q3.herbs(P, 3), -0.5);
  // ---- длинная пристройка слева спереди: бревенчатая стена с запада, навес открыт на восток, груз — вдоль неё
  const W = { x0: 4, x1: 22, y0: 10, y1: 80 };
  wallW(g, W.x0, W.y0, W.y1, 0, 14, m1Logs(P1.log)); wallN(g, W.x0, W.x1, W.y1, 0, 14, m1Logs(P1.log));
  for (const y of [12, 34, 56, 78]) post1(g, W.x1 - 2, y, 0, 13, 2, P3.oak);
  roof(g, { x0: W.x0, x1: W.x1, y0: W.y0, y1: W.y1, h: 13 }, { type: 'lean', down: 'E', rise: 6, ov: 2, mat: roofs.wing, cut: roofs.cutW, th: 3 });
  g.sprite([22, 9, 10], P => Q3.herbs(P, 2), -0.5);
  // ---- навес справа сзади: только крыша над задней полосой, брёвна спереди на виду
  for (const [x, y] of [[108, 72], [124, 72], [108, 90], [124, 90]]) post1(g, x, y, 0, 15, 2, P3.oak);
  roof(g, { x0: 106, x1: 126, y0: 72, y1: 92, h: 15 }, { type: 'lean', down: 'S', rise: 6, ov: 2, mat: roofs.wing, cut: roofs.cutW, th: 3 });
  g.sprite([116, 84, 0], P => Q2.barrels(P));
  // ---- площадка и дорожки
  groundYard(g, 24, 126, 4, 56);
  paveSand(g, 74, 88, 0, 58); paveSand(g, 58, 74, 44, 58); paveSand(g, 22, 58, 36, 44);
  // кучи груза: вдоль длинной пристройки и у навеса (в игре растут и убывают по запасам)
  g.sprite([32, 72, 0], P => Q2.planks(P, 6, 20)); meta.piles.timber = [32, 72, 0];
  g.sprite([32, 54, 0], P => Q2.sacks(P, 6)); meta.piles.food = [32, 54, 0];
  g.sprite([32, 26, 0], P => Q2.crates(P)); meta.piles.goods = [32, 26, 0];
  g.sprite([116, 62, 0], P => Q2.logStack(P, 4, 5)); meta.piles.trunk = [116, 62, 0];
  g.sprite([110, 34, 0], P => Q2.stones(P, 11)); meta.piles.stone = [110, 34, 0];
  meta.drop = [[40, 40, 0], [100, 50, 0], [96, 30, 0]];   // где носильщики ставят ношу
  // ---- волшебство: рунные камни у въезда, кристальные фонари, грибы, огоньки, знамя
  g.sprite([70, 4, 0], P => Q3.runeStone(P, 16)); g.sprite([92, 4, 0], P => Q3.runeStone(P, 14));
  g.sprite([52, 46, 0], P => Q3.crystalLamp(P, 18)); g.sprite([96, 46, 0], P => Q3.crystalLamp(P, 18));
  g.sprite([26, 82, 0], P => Q3.shroomPatch(P)); g.sprite([104, 56, 0], P => Q3.shroomPatch(P)); g.sprite([8, 6, 0], P => Q3.shroomPatch(P));
  g.sprite([60, 30, 14], P => Q3.wisp(P), -2); g.sprite([46, 22, 20], P => Q3.wisp(P), -2);
  g.sprite([104, 12, 0], P => Q3.banner(P));
  meta.glow = [[52, 46, 22], [96, 46, 22], [70, 4, 10], [92, 4, 9]];   // кристаллы и руны мерцают (игра)
}

const ROOF_ST = {
  1: () => ({ main: m1Straw3(STRAW1.reed), wing: m1Straw3(STRAW1.reed), cut: m1StrawCut(STRAW1.reed), cutW: m1StrawCut(STRAW1.reed), th: 3 }),
  2: () => ({ main: m1Shingle(SHINGLE1), wing: m1Shingle(SHINGLE1), cut: m1Fascia, cutW: m1Fascia }),
  3: () => ({ main: m1Tile2(P1.slate), wing: m1Shingle(SHINGLE1), cut: m1FasciaDark, cutW: m1Fascia }),
};
BDEFS.store2 = { w: 4, h: 3, top: 70, vars: [
  { name: 'Склад: дом + длинная пристройка + навес, волшебный (уровень 1, камыш)', make: g => buildStore(g, 1, ROOF_ST[1]()) },
  { name: 'Уровень 2 — дранка', make: g => buildStore(g, 2, ROOF_ST[2]()) },
  { name: 'Уровень 3 — сланцевая черепица', make: g => buildStore(g, 3, ROOF_ST[3]()) },
], title: 'Склад (сводный, ×1)', bk: 1, ink: P1.ink };
