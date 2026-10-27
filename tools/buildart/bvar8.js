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
  // мелкая плитка неправильной формы (4–5 px), швы с травинками, край рвётся в траву
  const W = (x1 - x0) * BK, H = (y1 - y0) * BK;
  const pave = (u, v) => {
    const edge = Math.min(u, W - u, v, H - v);
    if (edge < 2.5 && bhash(Math.floor(u / 2), Math.floor(v / 2), 504) < 0.55 - edge * 0.18) return null;   // рваный край
    const row = Math.floor(v / 3), st = Math.floor(bhash(row, 0, 505) * 5), cw = 4 + Math.floor(bhash(Math.floor((u + st) / 5), row, 506) * 2);
    const uu = (((u + st) % cw) + cw) % cw, vv = ((v % 3) + 3) % 3, id = Math.floor((u + st) / cw);
    if (uu === 0 || vv === 0) return bhash(u, v, 507) < 0.12 ? P1.grass[2] : P3.sand[3];
    const h = bhash(id, row, 508);
    let i = h < 0.25 ? 0 : h < 0.8 ? 1 : 2;
    if (vv === 1 && i > 0 && uu < cw - 1) i -= 1;                  // светлая верхняя кромка плитки
    if (uu === cw - 1) i = Math.min(3, i + 1);                    // тень справа
    return P3.sand[i];
  };
  box(g, { x0, x1, y0, y1, h: 0.4, mat: () => null, top: pave });
}
function groundYard(g, x0, x1, y0, y1) {
  // утоптанная земля: крупные мягкие пятна трёх тонов, редкие травинки и камешки
  box(g, { x0, x1, y0, y1, h: 0.2, mat: () => null, top: (u, v) => {
    const big = bhash(Math.floor(u / 9), Math.floor(v / 6), 509), h = bhash(u, v, 503);
    if (h < 0.025) return P1.grass[1]; if (h < 0.035) return P1.stone[1];
    const t = big + (bdith(u, v) - 0.5) * 0.25;
    return t < 0.35 ? bhex('#8e7a5a') : t < 0.8 ? bhex('#9a8664') : bhex('#a69270');
  } });
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
  // ---- главное здание: в левом краю участка
  const Lo = { x0: 2, x1: 48, y0: 58, y1: 92, h: 16 }, Up = { x0: 0, x1: 50, y0: 56, y1: 92, z0: 16, h: 12 };
  box(g, Object.assign({ mat: m1Stone(P1.stoneW) }, Lo));
  beam1(g, 0, 50, 56, 58, 15, 1, P3.oak);
  box(g, Object.assign({ mat: m1Plaster(P1.plaster, { frame: true, bay: 13, braceOdd: true, beam: P3.oak }) }, Up));
  const Z = roofSag(g, Up, { axis: 'Y', rise: 30, sag: 3, flare: 4, ov: 3, ovg: 5, mat: m1Ivy(roofs.main, [{ u: 20, v: 18, rx: 8, ry: 6 }]), cut: roofs.cut, th: roofs.th || 3, gable: m1Plaster(P1.plaster, { frame: true, bay: 11, brace: false, beam: P3.oak }) });
  gate1(g, 'S', Lo.y0, 5, 15, 14, true); gate1(g, 'S', Lo.y0, 29, 15, 14, true);
  runeGate(g, 'S', Lo.y0, 5, 15, 14); runeGate(g, 'S', Lo.y0, 29, 15, 14);
  meta.gates = [[12.5, Lo.y0, 0], [36.5, Lo.y0, 0]];
  WIN('S', Up.y0, 21, 18, 8, 8, { arch: true, G: P3.crystal });
  elem(g, 'S', Up.y0 - 0.3, 7, 18, 9, 8, m1Door({ w: 9, h: 8, col: P3.oak }));
  beam1(g, 9, 13, 48, 56, 30, 1.5, P3.oak); g.sprite([11, 50, 18], P => { PR.rect(P, 0, -10, 0, 0, BP.rope[1]); Q1.sack((x, y, c) => P(x, y + 2, c), 6, 7); });
  WIN('E', Lo.x1, 66, 5, 7, 7, { G: P3.crystal, round: true }); WIN('E', Lo.x1, 80, 5, 7, 7, { G: P3.crystal, round: true });
  g.sprite([25, 74, Z.zr(0.5) + 0.5], P => Q3.owl(P));
  chimneyCrooked(g, 40, 80, Up.z0 + Up.h + 6, 16, { stone: true, w: 5, d: 5, lean: 2 });
  g.sprite([4, 55.5, 26], P => Q3.herbs(P, 2), -0.5); g.sprite([46, 55.5, 26], P => Q3.herbs(P, 2), -0.5);
  // ---- длинная пристройка слева спереди (до дома): бревенчатая стена с запада, открыта во двор
  const W = { x0: 2, x1: lv >= 3 ? 20 : 18, y0: lv === 1 ? 22 : 6, y1: 48 }, wh = lv >= 3 ? 20 : 13;
  wallW(g, W.x0, W.y0, W.y1, 0, wh, m1Logs(P1.log)); wallN(g, W.x0, W.x1, W.y1, 0, wh, m1Logs(P1.log));
  for (let y = W.y0 + 2; y <= W.y1; y += 19) post1(g, W.x1 - 2, y, 0, wh - 1, 2, P3.oak);
  if (lv >= 3) { beam1(g, W.x0, W.x1, W.y0, W.y1, 10, 1.2, P1.plank); g.sprite([W.x1 - 1, 30, 10], P => Q2.sacks(P, 4), -0.5); beam1(g, W.x1 - 3, W.x1 + 6, 26, 28, wh + 2, 1.5, P3.oak); g.sprite([W.x1 + 5, 27, wh], P => { PR.rect(P, 0, 0, 0, 10, BP.rope[1]); Q1.crate((x, y, c) => P(x - 3, y + 18, c), 6); }, -0.5); }
  roof(g, { x0: W.x0, x1: W.x1, y0: W.y0, y1: W.y1, h: wh - 1 }, { type: 'lean', down: 'E', rise: 6, ov: 2, mat: roofs.wing, cut: roofs.cutW, th: 3 });
  g.sprite([18, 5, 10], P => Q3.herbs(P, 2), -0.5);
  g.sprite([26, 40, 0], P => Q2.planks(P, lv === 1 ? 4 : 7, 18)); meta.piles.timber = [26, 40, 0];
  g.sprite([26, 26, 0], P => Q2.sacks(P, lv === 1 ? 3 : 6)); meta.piles.food = [26, 26, 0];
  if (lv >= 2) { g.sprite([24, 10, 0], P => Q2.crates(P)); meta.piles.goods = [24, 10, 0]; }
  if (lv >= 3) { g.sprite([36, 12, 0], P => Q2.planks(P, 6, 16)); g.sprite([38, 30, 0], P => Q2.sacks(P, 5)); }
  // ---- правая пристройка: бревенчатый амбар сзади + навес на столбах с подкосами спереди
  const ax = lv === 1 ? 80 : 58, A = { x0: ax, x1: 126, y0: 80, y1: 92, h: 14 };
  box(g, Object.assign({ mat: m1Logs(P1.log) }, A));
  roof(g, { x0: ax, x1: 126, y0: 72, y1: 92, h: 18 }, { type: 'lean', down: 'S', rise: 8, ov: 2, mat: roofs.wing, cut: roofs.cutW, th: 3 });
  const px = lv === 1 ? [80, 102, 124] : [58, 80, 102, 124];
  for (const x of px) post1(g, x, 72, 0, 17, 2.5, P3.oak);
  beam1(g, ax - 1, 127, 72, 74.5, 16, 1.6, P3.oak);
  for (const x of px.slice(0, -1)) g.sprite([x + 2.5, 72.5, 15], P => { PR.line(P, 0, 0, 5, -3, P3.oak[1]); PR.line(P, 0, 1, 5, -2, P3.oak[2]); }, -0.3);   // подкосы
  for (const x of px.slice(1)) g.sprite([x, 72.5, 15], P => { PR.line(P, 0, 0, -5, -3, P3.oak[1]); PR.line(P, 0, 1, -5, -2, P3.oak[2]); }, -0.3);
  elem(g, 'S', A.y0, ax + 8, 2, 12, 11, m1Door({ w: 12, h: 11, double: true, col: P3.oak }));
  elem(g, 'S', A.y0, 108, 5, 8, 6, m1Window({ w: 8, h: 6, G: P3.crystal }));
  // ложементы перед навесом: два бруса на столбиках, на них брёвна — видно, сколько леса
  const racks = lv === 1 ? [96] : lv === 2 ? [72, 102] : [66, 88, 110];
  for (const cx of racks) { for (const x of [cx - 10, cx + 8]) { post1(g, x, 58, 0, 5, 1.5, P3.oak); post1(g, x, 68, 0, 5, 1.5, P3.oak); beam1(g, x - 0.5, x + 2, 58, 69.5, 5, 1.2, P3.oak); } g.sprite([cx, 64, 5], P => Q2.logStack(P, lv === 1 ? 3 : 4, lv === 3 ? 5 : 6)); }
  meta.piles.trunk = [racks[0], 64, 5]; meta.racks = racks.map(x => [x, 64, 5]);
  if (lv >= 2) { g.sprite([120, 64, 0], P => Q2.crates(P)); g.sprite([ax + 12, 79, 0], P => Q2.barrels(P, 2)); }
  g.sprite([114, 79, 0], P => Q2.sacks(P, 3));
  // инструменты на стене амбара: топор, пила, мотыга
  g.sprite([82, A.y0 - 0.2, 10], P => { PR.line(P, 0, 0, 0, -8, P1.plank[1]); PR.rect(P, -2, -9, 1, -7, P1.iron[1]); PR.rect(P, 5, -8, 15, -7, P1.iron[1]); for (let x = 6; x <= 15; x += 2) P(x, -6, P1.iron[2]); PR.rect(P, 15, -9, 16, -6, P1.plank[2]); PR.line(P, 20, 0, 20, -9, P1.plank[1]); PR.rect(P, 18, -10, 22, -10, P1.iron[1]); }, -0.5);
  g.sprite([92, 72, 14], P => Q1.lantern(P), -0.5); g.sprite([114, 72, 14], P => Q1.lantern(P), -0.5);
  // ---- двор и дорожки: от въезда (x 80) к обоим воротам и к навесу
  groundYard(g, 20, 126, 4, 60);
  paveSand(g, 73, 87, 0, 50); paveSand(g, 6, 87, 44, 56); paveSand(g, 87, 98, 46, 56);
  g.sprite([110, 30, 0], P => Q2.stones(P, lv === 1 ? 8 : 12)); meta.piles.stone = [110, 30, 0];
  if (lv >= 3) g.sprite([98, 18, 0], P => Q2.stones(P, 9));
  if (lv >= 2) g.sprite([56, 36, 0], P => Q2.crane(P, 30, 14));
  if (lv >= 3) {   // помост у ворот и рунный круг на земле, где носильщики сгружают ношу
    box(g, { x0: 2, x1: 48, y0: 50, y1: 57, h: 3, mat: m1Stone(P1.stone, 5, 3), top: (u, v) => P1.plank[(v | 0) % 3 === 0 ? 2 : (u | 0) % 11 === 0 ? 1 : 0] });
    g.sprite([62, 24, 0.3], P => { for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2; P(Math.round(Math.cos(a) * 10), Math.round(Math.sin(a) * 5), P3.rune[k % 3 ? 1 : 0]); } for (const [x, y] of [[0, -2], [-1, -1], [1, -1], [0, 0], [-2, 1], [2, 1], [0, 2]]) P(x, y, P3.rune[0]); }, -0.1);
    meta.circle = [62, 24, 0.3];
  }
  meta.drop = [[40, 30, 0], [96, 50, 0], [100, 30, 0]];
  // ---- волшебство
  g.sprite([70, 3, 0], P => Q3.runeStone(P, 16)); g.sprite([91, 3, 0], P => Q3.runeStone(P, 14));
  g.sprite([4, 52, 0], P => Q3.crystalLamp(P, 18)); g.sprite([52, 52, 0], P => Q3.crystalLamp(P, 18));
  g.sprite([54, 86, 0], P => Q3.shroomPatch(P)); g.sprite([126, 52, 0], P => Q3.shroomPatch(P)); g.sprite([62, 8, 0], P => Q3.shroomPatch(P));
  g.sprite([56, 30, 14], P => Q3.wisp(P), -2); g.sprite([44, 18, 20], P => Q3.wisp(P), -2); g.sprite([118, 46, 18], P => Q3.wisp(P), -2);
  g.sprite([120, 12, 0], P => Q3.banner(P));
  meta.glow = [[4, 52, 22], [52, 52, 22], [70, 3, 10], [91, 3, 9]];
}

const ROOF_ST = {
  1: () => ({ main: m1Straw3(STRAW1.reed), wing: m1Straw3(STRAW1.reed), cut: m1StrawCut(STRAW1.reed), cutW: m1StrawCut(STRAW1.reed), th: 3 }),
  2: () => ({ main: m1Shingle2(SHINGLE1, 0.6), wing: m1Shingle2(SHINGLE1, 0.9), cut: m1Fascia, cutW: m1Fascia }),
  3: () => ({ main: m1Ivy(m1Tile2(P1.slate), [{ u: 34, v: 30, rx: 9, ry: 6 }], bramp(['#7a9a4c', '#5a7a3a', '#3e5a2a', '#2a3e1e'])), wing: m1Shingle2(SHINGLE1, 1), cut: m1FasciaDark, cutW: m1Fascia }),
};
BDEFS.store2 = { w: 4, h: 3, top: 70, vars: [
  { name: 'Уровень 1 — камыш: короткие пристройки, один ложемент', make: g => buildStore(g, 1, ROOF_ST[1]()) },
  { name: 'Уровень 2 — дранка: пристройки во всю длину, два ложемента, кран', make: g => buildStore(g, 2, ROOF_ST[2]()) },
  { name: 'Уровень 3 — сланец: высокая пристройка с чердаком и лебёдкой, три ложемента, помост у ворот, рунный круг', make: g => buildStore(g, 3, ROOF_ST[3]()) },
], title: 'Склад (сводный, ×1)', bk: 1, ink: P1.ink };
