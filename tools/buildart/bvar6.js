'use strict';
// Трактир со входом на восток — в профиль (участок 3×4: 96 в ширину, 128 вглубь). Дом стоит длинной стороной к зрителю,
// конёк вдоль X, вход — в восточном торце (видимая правая грань). От восточного въезда (y ≈ 48) дорожка идёт к торцу.
// Обеденный двор и костёр — впереди, кухня-двор — за домом справа, поддон с припасами — между двором и домом.

function buildInnProfile(g, lv, roofs) {
  const meta = g.meta = { wins: [], tables: [] };
  const WIN = (side, at, a, z, w, h, o = {}) => { elem(g, side, at, a, z, w, h, m1Window(Object.assign({ w, h }, o))); meta.wins.push({ side, at, a, z, w, h, round: !!o.round }); };
  const deckTop = (u, v) => (((v | 0) % 3) === 0 ? P1.plank[2] : P1.plank[(u + v) % 9 < 1 ? 1 : 0]);
  // ---- дом: длинная сторона к зрителю, нависающий второй этаж, конёк вдоль X
  const Lo = { x0: 4, x1: 66, y0: 76, y1: 112, h: 15 }, Up = { x0: 2, x1: 68, y0: 72, y1: 112, z0: 15, h: 18 };
  box(g, Object.assign({ mat: m1Stone(P1.stone) }, Lo));
  beam1(g, 2, 68, 72, 76, 14, 1, P1.plank);
  box(g, Object.assign({ mat: m1Plaster(P1.plaster, { frame: true, bay: 16, mid: true, braceOdd: true }) }, Up));
  const r = { type: 'gable', axis: 'X', rise: 24, ov: 3, ovg: 4, mat: m1Ivy(roofs.main, [{ u: 50, v: 12, rx: 13, ry: 8 }, { u: 120, v: 20, rx: 8, ry: 6 }]), cut: roofs.cut, th: roofs.th || 2, gable: m1Plaster(P1.plaster, { frame: true, bay: 13, brace: false }) };
  roof(g, Up, r);
  const rz = rzOf(Up, r);
  dormer(g, 30, 76, 16, 10, 8, rz, m1Plaster(P1.plaster, { frame: true, bay: 10, brace: false }), roofs.main, roofs.cut, null);   // слуховое окно бара
  WIN('S', 75.7, 26, rz(76) + 1, 8, 7, { frameR: P1.beam });
  meta.bar = [30, 75.4, rz(76) + 4.5];
  chimney1(g, 12, 92, Up.z0 + Up.h + 8, 18, { w: 6, d: 6 });
  chimney1(g, 54, 96, Up.z0 + Up.h + 8, 14, { brick: true, w: 5, d: 5 });
  // длинная стена: окна с цветами, на втором этаже доска с кружкой
  for (const x of [8, 24, 40, 54]) { WIN('S', Lo.y0, x, 4, 9, 10, { sill: true }); }
  for (const x of [6, 20, 50]) { WIN('S', Up.y0, x, 20, 9, 9); g.sprite([x + 4.5, 71.5, 19], P => Q1.planter(P, 9), -0.5); }
  elem(g, 'S', Up.y0 - 0.3, 34, 22, 14, 7, m1Sprite(14, 7, P => Q1.board(P, 'mug', 14, 7)));
  // восточный торец: дверь, козырёк, фонари, окно во фронтоне
  elem(g, 'E', Lo.x1, 87, 0, 14, 15, m1Door({ w: 14, h: 15, arch: true, knob: true }));
  meta.doorPt = [70, 94, 0];
  WIN('E', Up.x1, 84, 20, 8, 9, {}); WIN('E', Up.x1, 98, 20, 8, 9, {});
  WIN('E', Up.x1, 89, 38, 10, 9, { arch: true });
  S2([[70, 85], [70, 101]], (x, y) => post1(g, x, y, 0, 14));
  roof(g, { x0: 66, x1: 72, y0: 85, y1: 103, h: 15 }, { type: 'lean', down: 'E', rise: 3, ov: 2, mat: m1Awning(), cut: m1Flat(P1.red[1]), th: 1 });
  g.sprite([69, 84, 12], P => Q1.lantern(P)); g.sprite([69, 104, 12], P => Q1.lantern(P));
  g.sprite([72, 95, 0], P => Q1.steps(P, 10, 1));
  g.sprite([70, 72, 26], P => Q1.sign(P, 'lamp', 1));
  // ---- кухня-двор за домом справа: печь, полки с запасами лицом к зрителю, стойка
  box(g, { x0: 74, x1: 96, y0: 104, y1: 126, h: 0.8, mat: m1Flat(P1.stone[2]), top: (u, v, F) => m1Stone(P1.stoneW, 6, 4)(u, v, Object.assign({}, F, { h: 0 })) });
  oven1(g, 88, 118);
  meta.oven = [88, 111, 3];
  box(g, { x0: 74, x1: 82, y0: 118, y1: 126, h: 14, mat: m1Flat(P1.dark[2]), top: m1Flat(P1.plank[1]) });
  elem(g, 'S', 118, 75, 1, 6, 12, m1Shelves(6, 12));
  meta.pantry = [[77, 117.5, 4], [79, 117.5, 10]];
  box(g, { x0: 76, x1: 92, y0: 105, y1: 108, h: 6, mat: m1Plank(P1.plank, 4), top: m1Flat(P1.plank[0]) });
  for (const x of [79, 84, 89]) mugs(g, x, 105, 6);
  // ---- поддон с припасами между двором и домом
  box(g, { x0: 8, x1: 40, y0: 58, y1: 68, h: 1, mat: m1Flat(P1.plank[3]), top: (u, v) => P1.plank[(u | 0) % 4 === 0 ? 3 : 2] });
  g.sprite([11, 60, 1], P => Q1.crate(P, 8)); g.sprite([11, 60, 9], P => Q1.crate(P, 7)); g.sprite([24, 62, 1], P => Q1.sack(P)); g.sprite([34, 64, 1], P => Q1.barrel(P, 7, 9));
  meta.stock = [[20, 66, 1], [26, 66, 1], [30, 62, 1], [38, 66, 1]];
  g.sprite([46, 66, 0], P => { PR.rect(P, 0, -8, 14, -4, P1.plank[2]); PR.rect(P, 0, -9, 14, -9, P1.plank[0]); PR.rect(P, 14, -7, 20, -7, P1.plank[3]); PR.ell(P, 4, -2, 2.5, 2.5, (x, y, a, b) => (a * a + b * b > 0.5 ? P1.plank[3] : P1.iron[1])); PR.ell(P, 11, -2, 2.5, 2.5, (x, y, a, b) => (a * a + b * b > 0.5 ? P1.plank[3] : P1.iron[1])); });
  // ---- дорожки: восточный въезд → вдоль двора → к торцу с дверью; ответвление к кухне
  paveSeg(g, 64, 96, 44, 52); paveSeg(g, 72, 82, 52, 104); paveSeg(g, 82, 92, 100, 104);
  // ---- обеденный двор впереди слева
  if (lv === 1) {
    box(g, { x0: 8, x1: 50, y0: 10, y1: 32, h: 1.2, mat: m1Flat(P1.plank[2]), top: deckTop });
    meta.porch = [29, 22, 1.2];
    fence1(g, 4, 56, 4, 4); fence1(g, 4, 4, 4, 40);
    g.sprite([8, 36, 0], P => Q1.sunflower(P, 16)); g.sprite([54, 38, 0], P => Q1.tree(P, 12));
  } else if (lv === 2) {
    box(g, { x0: 4, x1: 58, y0: 8, y1: 38, h: 1.2, mat: m1Flat(P1.plank[2]), top: deckTop });
    meta.porch = [31, 22, 1.2];
    fence1(g, 2, 60, 3, 3); fence1(g, 2, 2, 3, 42);
    lampPost(g, 2, 44); lampPost(g, 60, 3); bunting(g, [2, 44, 16], [60, 3, 16]);
    g.sprite([56, 44, 0], P => Q1.barrel(P));
  } else {
    box(g, { x0: 2, x1: 62, y0: 2, y1: 42, h: 1.2, mat: m1Flat(P1.plank[2]), top: deckTop });
    meta.porch = [32, 20, 1.2];
    S2([[3, 39], [31, 39], [59, 39]], (x, y) => post1(g, x, y, 1.2, 18, 2));
    for (const [x, y] of [[4, 40], [32, 40], [60, 40]]) g.sprite([x, y, 19], P => Q1.lantern(P));
    bunting(g, [3, 39, 19], [31, 39, 19]); bunting(g, [31, 39, 19], [59, 39, 19]);
    lampPost(g, 0, 2);
  }
  // ---- двор с костром впереди справа
  box(g, { x0: 66, x1: 94, y0: 4, y1: 40, h: 0.2, mat: m1Flat(P1.dark[1]), top: (u, v) => { const h = bhash(u, v, 301); return h < 0.08 ? P1.grass[2] : h < 0.5 ? bhex('#8a7458') : bhex('#9c8664'); } });
  g.sprite([80, 22, 0.2], P => Y1.firePit(P)); meta.fire = [80, 22, 0.6];
  g.sprite([80, 14, 0.2], P => Y1.logSeat(P, 14)); g.sprite([80, 31, 0.2], P => Y1.logSeat(P, 14));
  meta.seats = [[74, 14, 3], [86, 14, 3], [74, 31, 3], [86, 31, 3]];
  if (lv >= 2) { g.sprite([69, 22, 0.2], P => Y1.logSeat(P, 8)); g.sprite([91, 22, 0.2], P => Y1.logSeat(P, 8)); meta.seats.push([69, 22, 3], [91, 22, 3]); }
  g.sprite([90, 60, 0.2], P => Y1.chop(P)); meta.chop = [93, 60, 0];
  g.sprite([86, 68, 0.2], P => Q1.logs(P));
  if (lv >= 2) { g.sprite([80, 23, 0.2], P => Y1.spit(P), -0.5); meta.spit = [80, 23, 13]; g.sprite([92, 6, 0.2], P => Y1.darts(P)); meta.darts = [92, 6, 20]; g.sprite([62, 54, 0], P => Y1.chalk(P)); }
  if (lv >= 3) {
    box(g, { x0: 40, x1: 62, y0: 54, y1: 68, h: 3, mat: m1Plank(P1.plank, 4), top: (u, v) => P1.plank[(v | 0) % 4 === 0 ? 2 : 0] });   // сцена у дома
    meta.stage = [51, 61, 3];
    g.sprite([66, 6, 0.2], P => Y1.kegs(P));
  }
  g.sprite([2, 70, 0], P => Q1.barrel(P)); g.sprite([62, 75, 0], P => Q1.flowers(P, 4)); g.sprite([6, 75, 0], P => Q1.flowers(P, 6));
}
