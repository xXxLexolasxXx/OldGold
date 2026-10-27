'use strict';
// Блок 2 — итоговые здания еды по выбору владельца:
//  ферма — амбар (Ф-1): дорожка к воротам, детальный двор, сено копится у амбара (по запасам), фермер работает;
//  пекарня — печь отодвинута от дома; хмельник — buildHop как есть; пивоварня — бревенчатая с медным чаном на постаменте
//  (П-3) + витрина продукции спереди (бочки по запасу пива); свинарник — С-4 (свиньи игровые в загоне);
//  бойня — М-2 (фахверк с навесом): спереди стенд с тушами, топор в полене, мясник рубит мясо.

function buildFarm(g, lv) {
  // в боковом виде (g.rot) больший x модели уходит вглубь — там стога заходили бы за крышу; поэтому сбоку амбар справа (B),
  // а сенник слева (S), и он оказывается перед амбаром
  g.meta = { piles: {} };
  const B = g.rot ? 52 : 0, S = g.rot ? -78 : 0;
  const R = STRS(lv, STRAW_F.sun, P1.tileD), M = { x0: 2 + B, x1: 74 + B, y0: 40, y1: 94, h: 20 };
  box(g, Object.assign({ mat: m1Plank(P1.red, 4) }, M));
  roof(g, M, { type: 'gambrel', axis: 'Y', rise: 28, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.red, 4, false) });
  elem(g, 'S', M.y0, 26 + B, 0, 22, 18, m1Door({ w: 22, h: 18, double: true, col: P1.plank })); g.meta.doorPt = [37 + B, M.y0, 0];
  elem(g, 'S', M.y0, 30 + B, 26, 14, 9, (u, v) => (u < 1 || u > 12 || v > 7 ? P1.plank[2] : v < 4 + Math.sin(u * 1.7) * 1.2 ? (bhash(u, v, 1701) < 0.3 ? P1.straw[0] : P1.straw[1 + ((u + v) & 1)]) : P1.dark[3]));   // открытый сеновал — видно сено
  beam1(g, 35 + B, 39 + B, 30, 40, 36, 1.5, P1.plank); g.sprite([37 + B, 32, 22], P => { PR.rect(P, 0, -12, 0, 0, BP.rope[1]); PR.ell(P, 0, 3, 3, 2, () => P1.straw[1]); }, -0.5);   // подъёмник сена
  elem(g, 'S', M.y0, 6 + B, 6, 8, 7, m1Window({ w: 8, h: 7 })); elem(g, 'S', M.y0, 60 + B, 6, 8, 7, m1Window({ w: 8, h: 7 }));
  // двор: утоптанная земля, песчаная дорожка к воротам амбара, огороженный сенник — стога растут с запасом
  groundYard(g, 2, 126, 2, 38); groundYard(g, 78 + S, 126 + S, 38, 92); paveSand(g, 30 + B, 44 + B, 0, 41);
  fence1(g, 80 + S, 124 + S, 40, 40);
  if (g.rot) { fence1(g, 2, 2, 40, 90); fence1(g, 46, 46, 54, 90); } else { fence1(g, 124, 124, 40, 90); fence1(g, 80, 80, 54, 90); }   // вход в сенник со стороны амбара спереди
  g.meta.piles.hay = [[92, 82, 0], [110, 82, 0], [92, 66, 0], [110, 66, 0], [101, 52, 0]].slice(0, lv + 2).map(([x, y, z]) => [x + S, y, z]);   // стога — рисует игра по запасу; мест больше с уровнем (3/4/5)
  if (!g.dynPiles) for (const p of g.meta.piles.hay) g.sprite(p, P => Q1.hay(P, 8));
  const scare = g.rot ? 8 : 118;
  g.sprite([scare, 30, 0], P => { PR.rect(P, 0, -16, 0, 0, P3.oak[1]); PR.rect(P, -5, -12, 5, -12, P3.oak[1]); PR.rect(P, -2, -12, 2, -6, P1.red[1]); PR.ell(P, 0, -15, 2.5, 2.5, () => P1.straw[1]); PR.rect(P, -3, -18, 3, -17, P1.straw[3]); });   // пугало
  g.sprite([64 + B * 0.5, 12, 0], P => QW.trough(P)); g.sprite([14 + B, 14, 0], P => Q1.barrow(P)); g.sprite([22 + B, 30, 0], P => Q2.sacks(P, 2));
  g.sprite([52 + B, 39, 0], P => { PR.line(P, 0, 0, 2, -16, P1.plank[1]); for (const x of [0, 2, 4]) PR.rect(P, x + 1, -19, x + 1, -16, P1.iron[1]); }, -0.3);   // вилы у стены
  g.sprite([g.rot ? 40 : 70, 26, 0.3], P => PR.ell(P, 0, 0, 7, 2, (x, y, a, b) => (b < -0.3 ? bhex('#8ab0c8') : bhex('#5a7890'))));   // лужа
  for (const [x, y] of [[6, 4], [48, 6], [100, 8], [72, 30], [124, 14]]) g.sprite([x, y, 0], P => { P(0, 0, P1.grass[1]); P(1, -1, P1.grass[0]); P(-1, -1, P1.grass[2]); P(0, -2, P1.grass[1]); });   // пучки травы
  g.meta.farmer = [[50 + B, 20, 0], [g.rot ? 46 : 86, 46, 0]];
  if (lv >= 2) { g.sprite([4 + B, 30, 0], P => Q1.barrel(P, 7, 9)); g.meta.hens = g.rot ? [[6, 10, 0], [30, 34, 0]] : [[96, 10, 0], [122, 34, 0]]; g.meta.hand = [[16 + B, 14, 0], [g.rot ? 50 : 78, 30, 0]]; }   // куры клюют, работник возит тачку
  if (lv >= 3) { g.sprite(g.rot ? [70, 14, 0] : [86, 22, 0], P => QW.cart(P)); g.sprite([6 + B, 6, 0], P => Q1.flowers(P, 8)); g.meta.horse = g.rot ? [84, 16, 0] : [102, 24, 0]; g.sprite([g.rot ? 20 : 112, 4, 0], P => Q3.crystalLamp(P, 12)); }   // лошадь у воза, кристальный фонарь
}

function buildBakery2(g, lv) {
  buildBakery(g, lv);   // дом во всю ширину (из bvar16)
}

function buildBrew(g, lv) {
  g.meta = { piles: {} };
  const R = STRS(lv, STRAW_X.rust, P1.slate), M = { x0: 0, x1: 96, y0: 36, y1: 62, h: 15 };
  box(g, Object.assign({ mat: m1Logs(P1.log) }, M));
  roofSag(g, M, { axis: 'X', rise: 14, sag: 2, flare: 3, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th + 1, gable: m1Plank(P1.plank, 4) });
  elem(g, 'S', M.y0, 70, 0, 14, 12, m1Door({ w: 14, h: 12, double: true, col: P1.plank })); g.meta.doorPt = [77, M.y0, 0];
  elem(g, 'S', M.y0, 50, 4, 8, 7, m1Window({ w: 8, h: 7 }));
  box(g, { x0: 4, x1: 32, y0: 14, y1: 34, h: 5, mat: m1Stone(P1.stone, 5, 3), top: m1Flat(P1.stone[1]) });
  copperVat(g, 18, 24, 10, 8); g.meta.vat = [18, 24, 26]; g.meta.brewer = [0, 22, 0];   // пивовар слева от чана — не заслоняет его
  g.sprite([38, 30, 0], P => { for (let k = 0; k < 4; k++) PR.ell(P, 0, -4 - k * 4, 5, 1.6, (x, y, a, b) => (b < 0 ? COPPER[1] : COPPER[2])); });
  // витрина продукции: помост с бочками и пирамидой бочонков — заполняется по запасу пива (рисует игра)
  box(g, { x0: 50, x1: 94, y0: 8, y1: 30, h: 1.2, mat: m1Flat(P1.plank[2]), top: (u, v) => (((v | 0) % 3) === 0 ? P1.plank[2] : P1.plank[(u + v) % 9 < 1 ? 1 : 0]) });
  g.meta.piles.beer = [[58, 16, 1.2], [68, 16, 1.2], [78, 16, 1.2], [88, 16, 1.2], [63, 26, 1.2], [73, 26, 1.2], [83, 26, 1.2]];
  if (!g.dynPiles) for (const p of g.meta.piles.beer) g.sprite(p, P => Q1.barrel(P, 7, 9));
  g.sprite([94, 34, 0], P => Q1.sign(P, 'mug', 1));
  g.meta.piles.beer = g.meta.piles.beer.slice(0, [4, 5, 7][lv - 1]);   // мест под бочки больше с уровнем
  if (lv >= 2) { g.sprite([44, 30, 0], P => Q2.sacks(P, 3)); g.meta.roll = [[77, 34, 0], [56, 32, 0]]; }   // подмастерье катит бочку из ворот к помосту
  if (lv >= 3) { box(g, { x0: 36, x1: 48, y0: 2, y1: 5, h: 3, mat: m1Plank(P1.plank, 3), top: m1Flat(P1.plank[0]) }); g.meta.taster = [42, 4, 0]; g.sprite([2, 8, 0], P => Q1.streetLamp(P, 12)); g.meta.lamp = [2, 8, 12]; }   // скамья с дегустатором
}

function buildSwine(g, lv) {
  SWINE2_VARS[3].make(g, lv);
}

// подвес для туш — объёмный (стойки, ноги-упоры и перекладина — грани), туши на крюках — спрайты в точках перекладины:
// в боковом виде поворачивается вместе с моделью
const carcassPx = P => { PR.rect(P, 0, 0, 0, 2, P1.iron[1]); PR.ell(P, 0, 8, 3, 6, (xx, y, a, b) => (Math.abs(a) < 0.25 ? bhex('#f0d8c8') : b < -0.4 ? bhex('#d47868') : bhex('#a8483a'))); };
function carcassRack(g, x0, x1, y, n, h = 22) {
  for (const x of [x0, x1 - 2]) { post1(g, x, y, 0, h, 2, P3.oak); beam1(g, x - 0.5, x + 2.5, y - 4, y + 6, 0, 1.5, P3.oak); }
  beam1(g, x0, x1, y, y + 2, h, 2, P3.oak);
  const pts = []; for (let k = 0; k < n; k++) { const x = x0 + 4 + (x1 - x0 - 8) * (n === 1 ? 0.5 : k / (n - 1)); pts.push([x, y + 1, h - 1]); g.sprite([x, y + 1, h - 1], carcassPx, 0.4); }
  return pts;
}
function buildButch(g, lv) {   // М-2 как выбран: фахверк с каменным низом, коптильная труба, навес; спереди подвес с тушами, пень с топором, мясник
  g.meta = {};
  const R = STRS(lv, STRAW_F.amber, P1.tileD), M = { x0: 0, x1: 64, y0: 34, y1: 62, h: 15 };
  box(g, Object.assign({ mat: m1Plaster(P1.plaster, { frame: true, bay: 10, braceOdd: true, low: 4 }) }, M));
  roofSag(g, M, { axis: 'X', rise: 14, sag: 2, flare: 3, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plaster) });
  elem(g, 'S', M.y0, 27, 0, 10, 12, m1Door({ w: 10, h: 12, arch: true })); g.meta.doorPt = [32, M.y0, 0];
  chimney1(g, 6, 48, M.h + 8, 14, { brick: true, w: 6, d: 6 });
  for (const [x, y] of [[40, 18], [62, 18], [40, 32], [62, 32]]) post1(g, x, y, 0, 12, 2);
  roof(g, { x0: 40, x1: 64, y0: 18, y1: 34, h: 12 }, { type: 'lean', down: 'S', rise: 4, ov: 2, mat: R.mat, cut: R.cut, th: 2 });
  // подвес — левее и глубже, на уровне козырька; туш больше с уровнем (2 → 3 → 4)
  g.meta.hooks = carcassRack(g, 2, lv >= 3 ? 30 : 24, 24, lv + 1);
  g.sprite([38, 14, 0], P => QB.axeLog(P)); g.meta.butcher = [46, 12, 0]; g.meta.block = [38, 14, 6];   // пень с топором у козырька, мясник рубит
  g.sprite([46, 14, 0], P => QW.bucket(P));
  if (lv >= 2) {   // ур. 2: колбасы вялятся под навесом, кадка для засолки, коптильня дымит, подмастерье носит мясо
    beam1(g, 41, 62, 25, 26, 10, 1, P3.oak); for (const x of [44, 50, 56]) g.sprite([x, 25.5, 10], P => { for (let k = -2; k <= 2; k += 2) PR.ell(P, k, 4, 0.8, 3, () => bhex('#a83a2a')); }, 0.3);
    g.sprite([56, 6, 0], P => Q1.barrel(P, 7, 8)); g.meta.smoke = [9, 51, M.h + 22]; g.meta.carry = [[34, 2, 0], [33, 33, 0]];
  }
  if (lv >= 3) {   // ур. 3: прилавок-колода с весами, фонарь, пёс ждёт обрезки
    box(g, { x0: 4, x1: 22, y0: 4, y1: 10, h: 6, mat: m1Plank(P1.plank, 3), top: m1Flat(P1.plank[0]) });
    g.sprite([8, 7, 6], P => { PR.rect(P, -1, -6, 1, 0, P1.iron[1]); PR.rect(P, -4, -6, 4, -6, P1.iron[1]); PR.ell(P, -4, -3, 2, 1, () => P1.gold[1]); PR.ell(P, 4, -3, 2, 1, () => P1.gold[1]); });
    g.sprite([16, 7, 6], P => PR.ell(P, 0, -1, 3, 1.5, () => bhex('#c86858')));
    g.sprite([62, 34, 12], P => Q1.lantern(P), -0.5); g.meta.dog = [46, 6, 0]; g.meta.lamp = [62, 34, 10];
  }
}

BDEFS.food3 = { w: 4, h: 3, top: 72, vars: [1, 2, 3].map(lv => ({ name: `Ферма · ур. ${lv}`, make: g => buildFarm(g, lv) })), title: 'Ферма', bk: 1, ink: P1.ink };
BDEFS.brew3 = BL(buildBrew, 'Пивоварня', 3, 2, 78);
BDEFS.butch3 = BL(buildButch, 'Бойня', 2, 2, 60);
QB.axeLog = P => {   // полено-чурбак с воткнутым топором
  PR.rect(P, -5, -5, 5, 0, P1.log[1]); PR.ell(P, 0, -5, 5, 2, (x, y, a, b) => (a * a + b * b < 0.3 ? P1.log[0] : P1.log[2]));
  PR.line(P, 1, -6, 6, -15, P1.plank[1]); PR.rect(P, -2, -8, 2, -6, P1.iron[1]); P(-2, -8, P1.iron[0]);
};
BDEFS.bake3 = BL(buildBakery, 'Пекарня', 2, 2, 66);
BDEFS.swine3 = BL(buildSwine, 'Свинарник', 4, 3, 56);
PILE_DRAW.hay = f => P => Q1.hay(P, 4 + Math.round(f * 5));                                // стог растёт с запасом сена
PILE_DRAW.beer = f => P => (f < 0.5 ? Q1.barrel(P, 5, 6) : Q1.barrel(P, 7, 9));            // бочонок → бочка
