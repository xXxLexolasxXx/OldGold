'use strict';
// Единый трактир (сводный из вариантов 2, 3, 4, 6, 7 листа ×1) + игровая механика нынешнего трактира:
// открытая веранда без крыши (стол, гостей, официантку и дождевой тент рисует inside.js поверх спрайта),
// открытая кухня в восточном крыле (печь-купол → spr.oven, полки с запасами → spr.pantry, стойка),
// окно бара на втором этаже крыла → spr.bar, дверь на юге → spr.doorPt, окна → spr.wins.
// Лот 128×96, дверь на x=80. Масштаб 1 px = 1 мировой px.

// полки с запасами на задней стене кухни: три полки, на них хлеб/колбасы/бочонок; слоты для живого запаса — spr.pantry
function m1Shelves(w, h, slots) {
  return (u, v) => {
    const rows = [3, 9, 15];
    for (const r of rows) { if (v >= r && v < r + 1) return P1.plank[u % 7 === 0 ? 3 : 1]; if (v >= r + 1 && v < r + 2 && u % 7 === 3) return P1.plank[3]; }
    if (u < 1 || u > w - 2) return P1.beam[2];
    if (((u + Math.floor(v / 4)) % 5) === 0) return P1.dark[2];
    return P1.dark[1];
  };
}
function oven1(g, cx, cy) {
  cyl(g, cx, cy, 7, 0, 9, m1Stone(P1.stoneW, 4, 3), 16);
  dome(g, cx, cy, 7.5, 8.5, 6, (u, v, F) => m1Stone(P1.stoneW, 4, 3)(u, v, Object.assign({}, F, { h: 0 })), m1Flat(P1.stoneW[2]), 16, 4, 1);
  elem(g, 'S', cy - 7 + 0.6, cx - 3, 1.5, 6, 5, (u, v) => (v > 3.5 && Math.abs(u - 2.5) > 1.6 ? P1.stoneW[3] : v < 1 ? P1.ink : P1.beam[3]));
  box(g, { x0: cx - 5, x1: cx + 5, y0: cy + 5, y1: cy + 9, z0: 9, h: 10, mat: m1Brick(P1.brick), top: m1Flat(P1.stone[2]) });   // дымоход печи к трубе
}

const INN_FINAL = {
  name: 'Трактир: сводный (2+3+4+6+7) с верандой, открытой кухней и баром', make(g) {
    const meta = g.meta = { wins: [] };
    const WIN = (side, at, a, z, w, h, o = {}) => { elem(g, side, at, a, z, w, h, m1Window(Object.assign({ w, h }, o))); meta.wins.push({ side, at, a, z, w, h, round: !!o.round }); };
    // ---- главный дом: каменный низ, фахверк с нависанием, крутая красная крыша с плющом (2, 3, 7)
    const Lo = { x0: 8, x1: 92, y0: 30, y1: 92, h: 16 }, Up = { x0: 4, x1: 96, y0: 26, y1: 92, z0: 16, h: 20 };
    box(g, Object.assign({ mat: m1Stone(P1.stone) }, Lo));
    beam1(g, 4, 96, 26, 30, 15, 1, P1.plank);
    box(g, Object.assign({ mat: m1Plaster(P1.plaster, { frame: true, bay: 16, mid: true, braceOdd: true }) }, Up));
    roof(g, Up, { type: 'gable', axis: 'Y', rise: 36, ov: 3, ovg: 5, mat: m1Ivy(m1Tile(P1.tileR), [{ u: 40, v: 20, rx: 15, ry: 11 }, { u: 26, v: 40, rx: 9, ry: 8 }]), cut: m1Fascia, th: 2, gable: m1Plaster(P1.plaster, { frame: true, bay: 13, brace: false }) });
    chimney1(g, 18, 68, Up.z0 + Up.h, 22, { w: 6, d: 6 });
    // фронтон: большое арочное окно с цветами (6) и доска с кружкой (3)
    WIN('S', Up.y0, 44, 40, 12, 15, { arch: true });
    g.sprite([50, 25.5, 39], P => Q1.planter(P, 13), -0.5);
    elem(g, 'S', Up.y0 - 0.3, 42, 58, 16, 7, m1Sprite(16, 7, P => Q1.board(P, 'mug', 16, 7)));
    // окна и дверь
    for (const x of [16, 36, 56]) WIN('S', Lo.y0, x, 4, 9, 10, { sill: true });
    elem(g, 'S', Lo.y0, 73, 0, 14, 16, m1Door({ w: 14, h: 16, arch: true, knob: true }));
    meta.doorPt = [80, Lo.y0, 0];
    for (const x of [12, 30, 66, 84]) { WIN('S', Up.y0, x, 22, 9, 9); if (x !== 66) g.sprite([x + 4.5, 25.5, 21], P => Q1.planter(P, 9), -0.5); }
    for (const y of [38, 70]) WIN('E', Lo.x1 + 0, y, 4, 9, 10, {});
    WIN('E', Up.x1, 70, 22, 9, 9);
    // полосатый козырёк над входом (4) — не над верандой, чтобы не закрывать стол
    S2([[68, 24], [90, 24]], (x, y) => post1(g, x, y, 0, 15));
    roof(g, { x0: 68, x1: 92, y0: 26, y1: 30, h: 16 }, { type: 'lean', down: 'S', rise: 3, ov: 2, mat: m1Awning(), cut: m1Flat(P1.red[1]), th: 1 });
    g.sprite([94, 29.5, 13], P => Q1.lantern(P)); g.sprite([66, 29.5, 13], P => Q1.lantern(P));
    g.sprite([80, 29, 0], P => Q1.steps(P, 16, 2));
    // ---- восточная часть: веранда спереди, открытая кухня-двор посередине, двухэтажное крыло бара в глубине (6)
    // крыло бара: кирпичный низ, холодный фахверк, синяя чешуя
    const Wb = { x0: 94, x1: 126, y0: 64, y1: 92, h: 14 }, Ub = { x0: 92, x1: 126, y0: 62, y1: 92, z0: 14, h: 16 };
    box(g, Object.assign({ mat: m1Brick(P1.brick) }, Wb));
    beam1(g, 92, 126, 62, 64, 13, 1, P1.plank);
    box(g, Object.assign({ mat: m1Plaster(P1.plasterC, { frame: true, bay: 16, mid: true, braceX: true, beam: P1.beamD }) }, Ub));
    roof(g, Ub, { type: 'gable', axis: 'Y', rise: 22, ov: 3, ovg: 4, mat: m1Scale(P1.scale), cut: m1FasciaDark, th: 2, gable: m1Plaster(P1.plasterC, { frame: true, bay: 12, brace: false, beam: P1.beamD }) });
    chimney1(g, 114, 84, Ub.z0 + Ub.h + 4, 18, { brick: true, w: 5, d: 5 });
    WIN('S', Ub.y0, 104, 18, 10, 9, { frameR: P1.beamD });                                           // окно бара — здесь барменша
    meta.bar = [109, Ub.y0 - 0.3, 22.5];
    WIN('S', Ub.y0, 96, 32, 7, 8, { arch: true, frameR: P1.beamD, lit: false });
    WIN('E', Ub.x1, 70, 18, 9, 9, { frameR: P1.beamD }); WIN('E', Ub.x1, 82, 18, 9, 9, { frameR: P1.beamD });
    WIN('S', Wb.y0, 100, 3, 8, 9, { frameR: P1.beamD, lit: false });
    elem(g, 'S', Wb.y0, 112, 0, 10, 12, m1Door({ w: 10, h: 12, col: P1.dark }));                      // дверь кухни в бар
    g.sprite([127, 62, 24], P => Q1.sign(P, 'lamp', 1));
    g.sprite([109, 62, 52], P => Q1.pennant(P, 10));
    // кухня-двор: каменный пол, печь-купол с трубой, стеллаж с запасами лицом на юг, стойка с кружками, дрова
    box(g, { x0: 94, x1: 126, y0: 32, y1: 62, h: 0.8, mat: m1Flat(P1.stone[2]), top: (u, v, F) => m1Stone(P1.stoneW, 6, 4)(u, v, Object.assign({}, F, { h: 0 })) });
    oven1(g, 116, 52);
    meta.oven = [116, 45, 3];
    box(g, { x0: 95, x1: 109, y0: 52, y1: 60, h: 16, mat: m1Flat(P1.dark[2]), top: m1Flat(P1.plank[1]) });                       // стеллаж: корпус
    elem(g, 'S', 52, 96, 1, 12, 14, m1Shelves(12, 14));                                                                         // полки (на них игра рисует запасы)
    meta.pantry = [[98, 51.5, 4], [102, 51.5, 4], [106, 51.5, 4], [98, 51.5, 10], [102, 51.5, 10], [106, 51.5, 10]];
    roof(g, { x0: 94, x1: 110, y0: 51, y1: 61, h: 16 }, { type: 'lean', down: 'S', rise: 3, ov: 1, mat: m1Plank(P1.plank, 4, false), cut: m1Flat(P1.plank[3]), th: 1 });   // козырёк над стеллажом
    box(g, { x0: 96, x1: 114, y0: 33, y1: 37, h: 7, mat: m1Plank(P1.plank, 4), top: m1Flat(P1.plank[0]) });                       // стойка
    for (const x of [99, 104, 109]) g.sprite([x, 33, 7], P => { P(0, -2, P1.gold[1]); P(0, -1, P1.gold[1]); P(1, -1, P1.gold[2]); P(0, -3, P1.white[0]); }, -1);
    g.sprite([124, 36, 0.8], P => Q1.logs(P)); g.sprite([98, 44, 0.8], P => Q1.barrel(P, 7, 9)); g.sprite([124, 62, 0.8], P => Q1.sack(P));
    // ---- веранда перед кухней: настил, перила, столбы без крыши (стол и гостей рисует игра)
    const V = { x0: 94, x1: 126, y0: 8, y1: 30 };
    box(g, { x0: V.x0, x1: V.x1, y0: V.y0, y1: V.y1, h: 1.2, mat: m1Flat(P1.plank[2]), top: (u, v) => (((v | 0) % 3) === 0 ? P1.plank[2] : P1.plank[(u + v) % 9 < 1 ? 1 : 0]) });
    railing1(g, V.x1, V.x1, V.y0, V.y1, 1.2, 5); railing1(g, V.x0 + 10, V.x1, V.y0, V.y0, 1.2, 5);
    S2([[94, 8], [123, 8], [123, 27]], (x, y) => post1(g, x, y, 1.2, 14, 2));
    beam1(g, 94, 126, 8, 10, 15, 1.2, P1.plank);
    g.sprite([126, 18, 1.2], P => Q1.planter(P, 9), -0.5);
    meta.porch = [109, 15, 1.2];
    // ---- двор на западе (3, 4): ограда, дерево, стол, цветы, камни, бочки
    fence1(g, 4, 62, 6, 6); fence1(g, 4, 4, 6, 24);
    g.sprite([16, 18, 0], P => Q1.tree(P, 13));
    g.sprite([44, 14, 0], P => Q1.table(P, 14)); g.sprite([30, 18, 0], P => Q1.bench(P, 10));
    g.sprite([8, 26, 0], P => Q1.sunflower(P, 18)); g.sprite([4, 30, 0], P => Q1.sunflower(P, 14));
    for (let k = 0; k < 4; k++) g.sprite([80 + (k % 2 ? 2 : -2), 10 + k * 5, 0], P => Q1.stones(P));
    g.sprite([2, 60, 0], P => Q1.barrel(P)); g.sprite([2, 74, 0], P => Q1.crate(P, 7));
    g.sprite([64, 29, 0], P => Q1.flowers(P, 8)); g.sprite([26, 29, 0], P => Q1.flowers(P, 8));
    g.sprite([66, 5, 0], P => Q1.mushroom(P, 3));
  },
};
function S2(list, fn) { for (const a of list) fn(...a); }

BDEFS.innfinal = { w: 4, h: 3, top: 86, vars: [INN_FINAL], title: 'Трактир — единый вариант (×1)', bk: 1, ink: P1.ink };
