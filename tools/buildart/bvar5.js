'use strict';
// Трактир с входом на восток (участок 3×4: 96 в ширину, 128 вглубь). Не поворот модели, а своя ровная компоновка:
// фасад так же смотрит к зрителю (на юг), дом в глубине слева, кухня и бар справа, впереди обеденный двор и двор с костром,
// мощёная дорожка ведёт от восточного въезда (y ≈ 48) к двери дома. Те же материалы и точки meta, что у buildInn.

function paveSeg(g, x0, x1, y0, y1) {
  const pave = (u, v) => {
    const row = Math.floor(v / 3), st = (row * 2) % 5, uu = (((u + st) % 5) + 5) % 5, vv = ((v % 3) + 3) % 3, id = Math.floor((u + st) / 5);
    if (uu === 0 || vv === 0) return P1.stone[3];
    const h = bhash(id, row, 291);
    let i = h < 0.3 ? 0 : h < 0.85 ? 1 : 2;
    if (vv === 1 && uu < 4 && i > 0) i -= 1;
    return bhash(u, v, 292) < 0.03 ? P1.grass[2] : P1.stone[i];
  };
  box(g, { x0, x1, y0, y1, h: 0.4, mat: m1Flat(P1.stone[3]), top: pave });
}

function buildInnTall(g, lv, roofs) {
  const meta = g.meta = { wins: [], tables: [] };
  const WIN = (side, at, a, z, w, h, o = {}) => { elem(g, side, at, a, z, w, h, m1Window(Object.assign({ w, h }, o))); meta.wins.push({ side, at, a, z, w, h, round: !!o.round }); };
  const deckTop = (u, v) => (((v | 0) % 3) === 0 ? P1.plank[2] : P1.plank[(u + v) % 9 < 1 ? 1 : 0]);
  // ---- дом в глубине слева
  const Lo = { x0: 4, x1: 56, y0: 78, y1: 124, h: 15 }, Up = { x0: 0, x1: 60, y0: 74, y1: 124, z0: 15, h: 18 };
  box(g, Object.assign({ mat: m1Stone(P1.stone) }, Lo));
  beam1(g, 0, 60, 74, 78, 14, 1, P1.plank);
  box(g, Object.assign({ mat: m1Plaster(P1.plaster, { frame: true, bay: 16, mid: true, braceOdd: true }) }, Up));
  roof(g, Up, { type: 'gable', axis: 'Y', rise: 30, ov: 3, ovg: 5, mat: m1Ivy(roofs.main, [{ u: 28, v: 16, rx: 11, ry: 9 }, { u: 16, v: 32, rx: 7, ry: 6 }]), cut: roofs.cut, th: roofs.th || 2, gable: m1Plaster(P1.plaster, { frame: true, bay: 13, brace: false }) });
  chimney1(g, 8, 100, Up.z0 + Up.h, 20, { w: 6, d: 6 });
  WIN('S', Up.y0, 24, 36, 12, 14, { arch: true });
  if (lv >= 3) { beam1(g, 17, 43, 68, 74, 34, 2, P1.plank); railing1(g, 17, 43, 68.5, 68.5, 36, 5); railing1(g, 17, 17, 68.5, 74, 36, 5); railing1(g, 43, 43, 68.5, 74, 36, 5); g.sprite([30, 68, 41], P => Q1.planter(P, 11), -0.5); }
  else g.sprite([30, 73.5, 35], P => Q1.planter(P, 13), -0.5);
  elem(g, 'S', Up.y0 - 0.3, 22, 52, 16, 7, m1Sprite(16, 7, P => Q1.board(P, 'mug', 16, 7)));
  WIN('S', Lo.y0, 8, 4, 9, 10, { sill: true }); WIN('S', Lo.y0, 42, 4, 9, 10, { sill: true });
  elem(g, 'S', Lo.y0, 23, 0, 14, 15, m1Door({ w: 14, h: 15, arch: true, knob: true }));
  meta.doorPt = [30, Lo.y0, 0];
  for (const x of [4, 46]) { WIN('S', Up.y0, x, 20, 9, 9); g.sprite([x + 4.5, 73.5, 19], P => Q1.planter(P, 9), -0.5); }
  WIN('E', Lo.x1, 90, 4, 9, 10, {}); WIN('E', Lo.x1, 108, 4, 9, 10, {}); WIN('E', Up.x1, 100, 20, 9, 9);
  S2([[14, 72], [42, 72]], (x, y) => post1(g, x, y, 0, 14));
  roof(g, { x0: 14, x1: 44, y0: 74, y1: 78, h: 15 }, { type: 'lean', down: 'S', rise: 3, ov: 2, mat: m1Awning(), cut: m1Flat(P1.red[1]), th: 1 });
  g.sprite([12, 77.5, 12], P => Q1.lantern(P)); g.sprite([48, 77.5, 12], P => Q1.lantern(P));
  g.sprite([30, 77, 0], P => Q1.steps(P, 16, 2));
  // ---- бар-пристройка в глубине справа
  const Wb = { x0: 66, x1: 92, y0: 104, y1: 124, h: 12 }, Ub = { x0: 64, x1: 92, y0: 102, y1: 124, z0: 12, h: 14 };
  box(g, Object.assign({ mat: m1Brick(P1.brick) }, Wb));
  beam1(g, 64, 92, 102, 104, 11, 1, P1.plank);
  box(g, Object.assign({ mat: m1Plaster(P1.plasterC, { frame: true, bay: 14, mid: true, braceX: true, beam: P1.beamD }) }, Ub));
  roof(g, Ub, { type: 'gable', axis: 'Y', rise: 16, ov: 3, ovg: 4, mat: roofs.wing, cut: roofs.cutW, th: roofs.th || 2, gable: m1Plaster(P1.plasterC, { frame: true, bay: 12, brace: false, beam: P1.beamD }) });
  chimney1(g, 82, 116, Ub.z0 + Ub.h + 3, 14, { brick: true, w: 5, d: 5 });
  WIN('S', Ub.y0, 73, 15, 10, 9, { frameR: P1.beamD });
  meta.bar = [78, Ub.y0 - 0.3, 19.5];
  WIN('E', Ub.x1, 108, 15, 9, 9, { frameR: P1.beamD });
  g.sprite([93, 102, 20], P => Q1.sign(P, 'lamp', 1));
  g.sprite([78, 102, 42], P => Q1.pennant(P, 10));
  // ---- кухня-двор между верандой и баром
  box(g, { x0: 62, x1: 94, y0: 62, y1: 102, h: 0.8, mat: m1Flat(P1.stone[2]), top: (u, v, F) => m1Stone(P1.stoneW, 6, 4)(u, v, Object.assign({}, F, { h: 0 })) });
  oven1(g, 84, 92);
  meta.oven = [84, 85, 3];
  box(g, { x0: 63, x1: 75, y0: 92, y1: 100, h: 15, mat: m1Flat(P1.dark[2]), top: m1Flat(P1.plank[1]) });
  elem(g, 'S', 92, 64, 1, 10, 13, m1Shelves(10, 13));
  meta.pantry = [[66, 91.5, 4], [70, 91.5, 4], [66, 91.5, 10], [70, 91.5, 10]];
  roof(g, { x0: 62, x1: 76, y0: 91, y1: 101, h: 15 }, { type: 'lean', down: 'S', rise: 3, ov: 1, mat: m1Plank(P1.plank, 4, false), cut: m1Flat(P1.plank[3]), th: 1 });
  box(g, { x0: 64, x1: 80, y0: 64, y1: 68, h: 7, mat: m1Plank(P1.plank, 4), top: m1Flat(P1.plank[0]) });
  for (const x of [67, 72, 77]) mugs(g, x, 64, 7);
  g.sprite([90, 70, 0.8], P => Q1.logs(P)); g.sprite([88, 80, 0.8], P => Q1.barrel(P, 7, 9)); g.sprite([62, 82, 0.8], P => Q1.sack(P));
  // поддон с припасами у кухни (бочонки пива рисует игра в meta.stock)
  box(g, { x0: 40, x1: 58, y0: 60, y1: 68, h: 1, mat: m1Flat(P1.plank[3]), top: (u, v) => P1.plank[(u | 0) % 4 === 0 ? 3 : 2] });
  g.sprite([43, 61, 1], P => Q1.crate(P, 8)); g.sprite([54, 63, 1], P => Q1.sack(P));
  meta.stock = [[46, 66, 1], [52, 66, 1], [56, 64, 1], [48, 63, 1]];
  // ---- дорожки: восточный въезд (y 44..52) → к двери дома, ответвление к кухне
  paveSeg(g, 26, 96, 44, 52); paveSeg(g, 25, 35, 52, 78); paveSeg(g, 74, 82, 52, 62);
  for (let x = 30; x < 94; x += 4) if (bhash(x, 44, 293) < 0.5) g.sprite([x, 43.8, 0], P => { P(0, 0, P1.grass[1]); P(0, -1, P1.grass[0]); }, -0.1);
  // ---- обеденный двор впереди слева
  if (lv === 1) {
    box(g, { x0: 10, x1: 50, y0: 10, y1: 30, h: 1.2, mat: m1Flat(P1.plank[2]), top: deckTop });
    meta.porch = [30, 20, 1.2];
    fence1(g, 4, 56, 4, 4); fence1(g, 4, 4, 4, 38);
    g.sprite([8, 34, 0], P => Q1.sunflower(P, 16));
  } else if (lv === 2) {
    box(g, { x0: 6, x1: 56, y0: 8, y1: 34, h: 1.2, mat: m1Flat(P1.plank[2]), top: deckTop });
    meta.porch = [30, 20, 1.2];
    fence1(g, 2, 58, 3, 3); fence1(g, 2, 2, 3, 40);
    lampPost(g, 2, 40); lampPost(g, 58, 3);
    bunting(g, [2, 40, 16], [58, 3, 16]);
    g.sprite([6, 38, 0], P => Q1.sunflower(P, 18)); g.sprite([50, 38, 0], P => Q1.barrel(P));
  } else {
    box(g, { x0: 2, x1: 60, y0: 2, y1: 40, h: 1.2, mat: m1Flat(P1.plank[2]), top: deckTop });
    meta.porch = [33, 16, 1.2];
    S2([[3, 37], [31, 37], [57, 37]], (x, y) => post1(g, x, y, 1.2, 18, 2));
    for (const [x, y] of [[4, 38], [32, 38], [58, 38]]) g.sprite([x, y, 19], P => Q1.lantern(P));
    bunting(g, [3, 37, 19], [31, 37, 19]); bunting(g, [31, 37, 19], [57, 37, 19]);
    box(g, { x0: 4, x1: 18, y0: 26, y1: 36, h: 3, mat: m1Plank(P1.plank, 4), top: (u, v) => P1.plank[(v | 0) % 4 === 0 ? 2 : 0] });   // сцена
    meta.stage = [11, 31, 4.2];
    lampPost(g, 0, 2);
  }
  // ---- двор с костром впереди справа
  box(g, { x0: 64, x1: 94, y0: 4, y1: 40, h: 0.2, mat: m1Flat(P1.dark[1]), top: (u, v) => { const h = bhash(u, v, 301); return h < 0.08 ? P1.grass[2] : h < 0.5 ? bhex('#8a7458') : bhex('#9c8664'); } });
  g.sprite([79, 24, 0.2], P => Y1.firePit(P)); meta.fire = [79, 24, 0.6];
  g.sprite([79, 17, 0.2], P => Y1.logSeat(P, 14)); g.sprite([79, 32, 0.2], P => Y1.logSeat(P, 14));
  meta.seats = [[73, 17, 3], [85, 17, 3], [73, 32, 3], [85, 32, 3]];
  if (lv >= 2) { g.sprite([68, 24, 0.2], P => Y1.logSeat(P, 8)); g.sprite([90, 24, 0.2], P => Y1.logSeat(P, 8)); meta.seats.push([68, 24, 3], [90, 24, 3]); }
  g.sprite([70, 38, 0.2], P => Y1.chop(P)); meta.chop = [73, 38, 0];
  g.sprite([88, 38, 0.2], P => Q1.logs(P));
  if (lv >= 2) {
    g.sprite([79, 25, 0.2], P => Y1.spit(P), -0.5); meta.spit = [79, 25, 13];
    g.sprite([92, 8, 0.2], P => Y1.darts(P)); meta.darts = [92, 8, 20];
    g.sprite([60, 56, 0], P => Y1.chalk(P));
  }
  if (lv >= 3) { g.sprite([66, 6, 0.2], P => Y1.kegs(P)); }
  g.sprite([2, 60, 0], P => Q1.barrel(P)); g.sprite([2, 70, 0], P => Q1.crate(P, 7));
  g.sprite([10, 77, 0], P => Q1.flowers(P, 6)); g.sprite([48, 77, 0], P => Q1.flowers(P, 6));
}
