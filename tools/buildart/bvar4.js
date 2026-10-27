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
  const Lo = { x0: 4, x1: 62, y0: 50, y1: 92, h: 15 }, Up = { x0: 0, x1: 66, y0: 46, y1: 92, z0: 15, h: 18 };   // в левом углу лота; к двери ведёт дорожка от въезда (x=80)
  box(g, Object.assign({ mat: m1Stone(P1.stone) }, Lo));
  beam1(g, 0, 66, 46, 50, 14, 1, P1.plank);
  box(g, Object.assign({ mat: m1Plaster(P1.plaster, { frame: true, bay: 16, mid: true, braceOdd: true }) }, Up));
  roof(g, Up, { type: 'gable', axis: 'Y', rise: 30, ov: 3, ovg: 5, mat: m1Ivy(roofs.main, [{ u: 30, v: 16, rx: 12, ry: 9 }, { u: 18, v: 32, rx: 7, ry: 6 }]), cut: roofs.cut, th: roofs.th || 2, gable: m1Plaster(P1.plaster, { frame: true, bay: 13, brace: false }) });
  chimney1(g, 10, 72, Up.z0 + Up.h, 20, { w: 6, d: 6 });
  WIN('S', Up.y0, 27, 36, 12, 14, { arch: true });
  if (lv >= 3) {
    beam1(g, 20, 46, 40, 46, 34, 2, P1.plank); railing1(g, 20, 46, 40.5, 40.5, 36, 5); railing1(g, 20, 20, 40.5, 46, 36, 5); railing1(g, 46, 46, 40.5, 46, 36, 5);
    g.sprite([33, 40, 41], P => Q1.planter(P, 11), -0.5);
  } else g.sprite([33, 45.5, 35], P => Q1.planter(P, 13), -0.5);
  elem(g, 'S', Up.y0 - 0.3, 25, 52, 16, 7, m1Sprite(16, 7, P => Q1.board(P, 'mug', 16, 7)));
  WIN('S', Lo.y0, 10, 4, 9, 10, { sill: true }); WIN('S', Lo.y0, 46, 4, 9, 10, { sill: true });
  elem(g, 'S', Lo.y0, 26, 0, 14, 15, m1Door({ w: 14, h: 15, arch: true, knob: true }));
  meta.doorPt = [33, Lo.y0, 0];
  for (const x of [6, 22, 50]) { WIN('S', Up.y0, x, 20, 9, 9); if (x !== 22) g.sprite([x + 4.5, 45.5, 19], P => Q1.planter(P, 9), -0.5); }
  WIN('E', Lo.x1, 58, 4, 9, 10, {}); WIN('E', Lo.x1, 78, 4, 9, 10, {}); elem(g, 'E', Lo.x1, 66, 0, 8, 11, m1Door({ w: 8, h: 11, col: P1.dark }));   // дверь на кухню
  WIN('E', Up.x1, 70, 20, 9, 9);
  S2([[21, 44], [43, 44]], (x, y) => post1(g, x, y, 0, 14));
  roof(g, { x0: 21, x1: 45, y0: 46, y1: 50, h: 15 }, { type: 'lean', down: 'S', rise: 3, ov: 2, mat: m1Awning(), cut: m1Flat(P1.red[1]), th: 1 });
  g.sprite([18, 49.5, 12], P => Q1.lantern(P)); g.sprite([48, 49.5, 12], P => Q1.lantern(P));
  g.sprite([33, 49, 0], P => Q1.steps(P, 16, 2));
  // ---- бар-пристройка сзади справа (6): кирпич, холодный фахверк, синяя чешуя, окно барменши
  const Wb = { x0: 104, x1: 126, y0: 66, y1: 92, h: 12 }, Ub = { x0: 102, x1: 126, y0: 64, y1: 92, z0: 12, h: 14 };
  box(g, Object.assign({ mat: m1Brick(P1.brick) }, Wb));
  beam1(g, 102, 126, 64, 66, 11, 1, P1.plank);
  box(g, Object.assign({ mat: m1Plaster(P1.plasterC, { frame: true, bay: 14, mid: true, braceX: true, beam: P1.beamD }) }, Ub));
  roof(g, Ub, { type: 'gable', axis: 'Y', rise: 18, ov: 3, ovg: 4, mat: roofs.wing, cut: roofs.cutW, th: roofs.th || 2, gable: m1Plaster(P1.plasterC, { frame: true, bay: 12, brace: false, beam: P1.beamD }) });
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
  box(g, { x0: 42, x1: 64, y0: 40, y1: 48, h: 1, mat: m1Flat(P1.plank[3]), top: (u, v) => P1.plank[(u | 0) % 4 === 0 ? 3 : 2] });
  g.sprite([44, 41, 1], P => Q1.crate(P, 8)); g.sprite([44, 41, 9], P => Q1.crate(P, 7)); g.sprite([56, 42, 1], P => Q1.sack(P)); g.sprite([62, 46, 1], P => Q1.sack(P, 6, 8)); g.sprite([52, 47, 1], P => Q1.barrel(P, 7, 9));
  meta.stock = [[46, 44, 1], [54, 44, 1], [62, 43, 1], [48, 47, 1], [58, 47, 1]];
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
    bunting(g, [98, 6, 15], [58, 46, 32]);
  }
  // ---- пивной двор слева спереди: 1 — скромно; 2 — три стола, фонари, гирлянда; 3 — длинный пиршественный стол под гирляндами
  if (lv === 1) {
    fence1(g, 4, 30, 4, 4); fence1(g, 4, 4, 4, 30);
    g.sprite([14, 20, 0], P => Q1.tree(P, 13));
    g.sprite([30, 24, 0], P => Q1.bench(P, 10));
    g.sprite([8, 30, 0], P => Q1.sunflower(P, 16));
  } else if (lv === 2) {
    fence1(g, 4, 60, 4, 4); fence1(g, 4, 4, 4, 36);
    g.sprite([12, 26, 0], P => Q1.tree(P, 13));
    meta.porch = [32, 17, 0];   // главный стол (6 мест) рисует игра — во дворе, не на маленькой веранде
    g.sprite([52, 28, 0], P => Q1.bench(P, 10));
    g.sprite([8, 34, 0], P => Q1.sunflower(P, 18)); g.sprite([4, 38, 0], P => Q1.sunflower(P, 14));
    lampPost(g, 62, 2); lampPost(g, 4, 2); g.sprite([58, 26, 0], P => Q1.barrel(P));
    bunting(g, [4, 2, 16], [62, 2, 16]);
  } else {
    // настил, столбы с фонарями по краю, без перекладин и перил — едоков видно целиком
    box(g, { x0: 2, x1: 66, y0: 2, y1: 34, h: 1.2, mat: m1Flat(P1.plank[2]), top: deckTop });
    S2([[3, 31], [33, 31], [63, 31]], (x, y) => post1(g, x, y, 1.2, 18, 2));        // столбы только сзади — спереди ничего не заслоняет едоков
    for (const [x, y] of [[4, 32], [34, 32], [64, 32]]) g.sprite([x, y, 19], P => Q1.lantern(P));
    bunting(g, [3, 31, 19], [33, 31, 19]); bunting(g, [33, 31, 19], [63, 31, 19]);
    lampPost(g, 2, 2);
    meta.porch = [34, 18, 1.2];   // длинный стол на 8 едоков и скамьи рисует игра (inside.js) — так видно, кто ест
    // бочка-бар на козлах у края террасы
    g.sprite([68, 26, 0], P => { Q1.barrel((x, y, c) => P(x, y - 3, c), 11, 13); PR.rect(P, -6, -3, 6, -3, P1.plank[3]); P(-5, -2, P1.plank[3]); P(5, -2, P1.plank[3]); P(-5, -1, P1.plank[3]); P(5, -1, P1.plank[3]); P(7, -9, P1.iron[1]); P(8, -9, P1.iron[0]); });
    lampPost(g, 70, 2);
  }
  inn1Paths(g, lv, ky0);
  innYard(g, lv, meta);
  g.sprite([2, 49, 0], P => Q1.flowers(P, 6)); g.sprite([12, 49, 0], P => Q1.flowers(P, 6)); g.sprite([96, 66, 0], P => Q1.flowers(P, 4));
  g.sprite([66, 2, 0], P => Q1.mushroom(P, 3)); g.sprite([70, 4, 0], P => Q1.mushroom(P, 2));
}

// Задний двор между домом и кухней (x 74..98, y 42..92) — место, где гномы тусуются. Отступ от дома ≥ 8 px.
// 1: кострище с брёвнами-сиденьями, колода с топором и поленница; 2: + вертел с тушкой, мишень для дротиков, меловая доска;
// 3: + сцена в глубине, пирамида бочонков, гирлянда. Точки для анимации — в meta (fire, spit, seats, chop, darts, stage).
const Y1 = {
  firePit(P) {   // каменное кольцо с углями (пламя рисует игра в meta.fire)
    PR.ell(P, 0, -2, 8, 4, (x, y, a, b) => { const e = a * a + b * b; if (e > 0.55) return ((x + y) & 1) ? P1.stone[1] : P1.stone[2]; return e < 0.2 ? P1.gold[(x + y) & 1] : ((x * 3 + y) % 4 === 0 ? P1.red[0] : P1.dark[3]); });
    PR.rect(P, -3, -4, 3, -4, P1.log[2]); PR.rect(P, -2, -3, 2, -3, P1.log[1]);
  },
  logSeat(P, w = 12) { PR.rect(P, -w / 2, -4, w / 2, -2, P1.log[1]); PR.rect(P, -w / 2, -4, w / 2, -4, P1.log[0]); PR.rect(P, -w / 2, -1, w / 2, -1, P1.log[3]); PR.ell(P, w / 2, -2.5, 1.6, 2, (x, y, a, b) => (a * a + b * b < 0.3 ? P1.log[0] : P1.log[2])); },
  spit(P) {      // две рогатины, перекладина, тушка
    for (const x of [-10, 10]) { PR.rect(P, x, -14, x, 0, P1.beam[1]); P(x - 1, -14, P1.beam[1]); P(x + 1, -14, P1.beam[1]); P(x - 1, -15, P1.beam[1]); P(x + 1, -15, P1.beam[1]); }
    PR.rect(P, -12, -13, 12, -13, P1.iron[1]); P(13, -12, P1.iron[1]); P(13, -11, P1.iron[2]);
    PR.ell(P, 0, -13, 6, 3.4, (x, y, a, b) => (b < -0.4 ? P1.gold[1] : a > 0.5 || b > 0.4 ? P1.log[2] : P1.log[0]));
    P(-6, -15, P1.log[2]); P(6, -15, P1.log[2]);
  },
  chop(P) {      // колода с воткнутым топором
    PR.rect(P, -4, -5, 4, 0, P1.log[2]); PR.ell(P, 0, -5, 4, 1.6, (x, y, a) => (a < -0.3 ? P1.log[0] : P1.log[1]));
    PR.line(P, 1, -6, 5, -12, P1.plank[1]); PR.rect(P, -1, -7, 2, -6, P1.iron[0]); P(-1, -5, P1.iron[1]);
  },
  darts(P) {     // мишень на столбе
    PR.rect(P, 0, -18, 0, 0, P1.beam[1]);
    PR.ell(P, 0, -20, 5, 5, (x, y, a, b) => { const r = Math.hypot(a, b); return r > 0.8 ? P1.beam[2] : r > 0.55 ? P1.white[0] : r > 0.3 ? P1.red[1] : P1.gold[0]; });
    P(1, -21, P1.iron[2]); P(-2, -19, P1.iron[2]); P(2, -18, P1.iron[2]);
  },
  chalk(P) {     // меловая доска «меню» на ножках
    PR.line(P, -4, 0, -2, -12, P1.plank[2]); PR.line(P, 4, 0, 2, -12, P1.plank[2]);
    PR.rect(P, -4, -14, 4, -5, P1.plank[3]); PR.rect(P, -3, -13, 3, -6, bhex('#2e3a32'));
    for (const [y, w] of [[-12, 4], [-10, 5], [-8, 3]]) PR.rect(P, -2, y, -2 + w, y, P1.white[1]);
  },
  kegs(P) {      // пирамида бочонков на боку
    const keg = (cx, cy) => PR.ell(P, cx, cy, 3.4, 3.4, (x, y, a, b) => { const r = a * a + b * b; return r > 0.7 ? P1.plank[3] : r > 0.45 ? P1.iron[1] : r < 0.15 ? P1.plank[0] : P1.plank[1]; });
    for (let k = 0; k < 3; k++) keg(-7 + k * 7, -4); for (let k = 0; k < 2; k++) keg(-3.5 + k * 7, -10); keg(0, -16);
  },
  bench(P, w = 12) { Q1.bench(P, w); },
};
function innYard(g, lv, meta) {
  // утоптанная земля под тусовкой
  box(g, { x0: 74, x1: 98, y0: 42, y1: 90, h: 0.2, mat: m1Flat(P1.dark[1]), top: (u, v) => { const h = bhash(u, v, 301); return h < 0.08 ? P1.grass[2] : h < 0.5 ? bhex('#8a7458') : bhex('#9c8664'); } });
  // кострище с брёвнами вокруг — главное место сборищ
  g.sprite([86, 54, 0.2], P => Y1.firePit(P));
  meta.fire = [86, 54, 0.6];
  g.sprite([86, 47, 0.2], P => Y1.logSeat(P, 14)); g.sprite([86, 62, 0.2], P => Y1.logSeat(P, 14));
  meta.seats = [[80, 47, 3], [92, 47, 3], [80, 62, 3], [92, 62, 3]];
  if (lv >= 2) { g.sprite([77, 54, 0.2], P => Y1.logSeat(P, 8)); g.sprite([95, 54, 0.2], P => Y1.logSeat(P, 8)); meta.seats.push([77, 54, 3], [95, 54, 3]); }
  // колода и поленница в глубине
  g.sprite([80, 80, 0.2], P => Y1.chop(P)); meta.chop = [83, 80, 0];
  g.sprite([88, 88, 0.2], P => Q1.logs(P));
  if (lv >= 2) {
    g.sprite([86, 55, 0.2], P => Y1.spit(P), -0.5); meta.spit = [86, 55, 13];
    g.sprite([96, 76, 0.2], P => Y1.darts(P)); meta.darts = [96, 76, 20];
    g.sprite([92, 26, 0], P => Y1.chalk(P));
  } else g.sprite([92, 26, 0], P => Q1.barrel(P, 7, 9));
  if (lv >= 3) {
    box(g, { x0: 74, x1: 98, y0: 70, y1: 86, h: 3, mat: m1Plank(P1.plank, 4), top: (u, v) => P1.plank[(v | 0) % 4 === 0 ? 2 : 0] });   // сцена в глубине
    meta.stage = [86, 78, 3];
    g.sprite([76, 72, 3], P => Q1.barrel(P, 7, 9));
    S2([[75, 84], [96, 84]], (x, y) => post1(g, x, y, 3, 16, 2));
    beam1(g, 75, 98, 84, 86, 19, 1.2, P1.plank);
    bunting(g, [75, 85, 19], [97, 85, 19]);
    g.sprite([96, 66, 0.2], P => Y1.kegs(P));
    g.sprite([88, 88, 0.2], P => Y1.chop(P));
  }
}

// Мощёные дорожки: въезд с юга (x 74..86) → развилка → к двери дома (запад), к веранде и к кухне (восток).
// Брусчатка неправильной кладкой, тёмный бордюр, трава щёточкой по краям.
function inn1Paths(g, lv, ky0) {
  const pave = (u, v, F) => {
    const row = Math.floor(v / 3), st = (row * 2) % 5, uu = (((u + st) % 5) + 5) % 5, vv = ((v % 3) + 3) % 3, id = Math.floor((u + st) / 5);
    if (uu === 0 || vv === 0) return P1.stone[3];
    const h = bhash(id, row, 291);
    let i = h < 0.3 ? 0 : h < 0.85 ? 1 : 2;
    if (vv === 1 && uu < 4 && i > 0) i -= 1;
    if (bhash(u, v, 292) < 0.03) return P1.grass[2];                 // травинка в шве
    return P1.stone[i];
  };
  const seg = (x0, x1, y0, y1) => {
    box(g, { x0, x1, y0, y1, h: 0.4, mat: m1Flat(P1.stone[3]), top: pave });
    for (let x = x0 + 1; x < x1; x += 3) { if (bhash(x, y0, 293) < 0.55) g.sprite([x, y0 - 0.2, 0], P => { P(0, 0, P1.grass[1]); if (bhash(x, 1, 294) < 0.5) P(0, -1, P1.grass[0]); }, -0.1); }
  };
  seg(73, 87, 0, 40);                      // въезд с юга
  seg(28, 87, 34, 40);                     // поперёк к дому
  seg(27, 39, 40, 50);                     // к двери
  seg(87, 98, 12, 18);                     // к веранде
  seg(87, 100, Math.min(ky0 + 6, 40) - 6, Math.min(ky0 + 6, 40));   // к кухне
  g.sprite([80, 0.5, 0.4], P => { for (let x = -7; x <= 7; x++) P(x, 0, P1.stone[3]); }, -0.2);
}

const ROOF_LV = {
  1: s => ({ main: m1Straw3(s), wing: m1Straw3(s), cut: m1StrawCut(s), cutW: m1StrawCut(s), th: 4 }),
  2: () => ({ main: m1Shingle(SHINGLE1), wing: m1Shingle(SHINGLE1), cut: m1Fascia, cutW: m1FasciaDark }),
  3: () => ({ main: m1Tile2(P1.tileR), wing: m1Scale2(P1.scale), cut: m1Fascia, cutW: m1FasciaDark }),
};
const INN_LV_VARS = [
  { name: 'Уровень 1 — солома (оливковая): малая веранда, двор с деревом', make: g => buildInn(g, 1, ROOF_LV[1](STRAW1.olive)) },
  { name: 'Уровень 2 — дранка: веранда больше, второй стол, фонари, гирлянда, бочка во дворе', make: g => buildInn(g, 2, ROOF_LV[2]()) },
  { name: 'Уровень 3 — черепица и чешуя: вторая терраса с перголой, бочка-бар, сцена, балкон на фронтоне', make: g => buildInn(g, 3, ROOF_LV[3]()) },
];
const INN_STRAW_VARS = Object.entries(STRAW1).map(([k, R]) => ({ name: `Солома «${{ rye: 'ржаная', olive: 'оливковая', wheat: 'пшеничная', reed: 'камышовая' }[k]}»`, make: g => buildInn(g, 1, ROOF_LV[1](R)) }));

BDEFS.innlv = { w: 4, h: 3, top: 86, vars: INN_LV_VARS, title: 'Трактир по уровням (×1)', bk: 1, ink: P1.ink };
BDEFS.innstraw = { w: 4, h: 3, top: 86, vars: INN_STRAW_VARS, title: 'Трактир, уровень 1: оттенки соломы', bk: 1, ink: P1.ink };
BDEFS.innfinal = { w: 4, h: 3, top: 86, vars: [INN_LV_VARS[2]], title: 'Трактир — единый вариант (×1)', bk: 1, ink: P1.ink };
