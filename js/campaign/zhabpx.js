'use strict';
// Жабьен — ручной пиксель-арт на сетке ×3 (метод Полудницы и легендарного дракона, набор pb* из pxbeasts.js).
// По рисунку владельца: приземистая оливковая жаба в буром капюшоне с рваным плащом, кремовое брюхо и горловой мешок,
// золотой глаз с поперечным зрачком под тяжёлым веком, беззубый жабий рот, кольца в щеке, белые полосы раскраски,
// шарф-повязка на груди, юбка из шкуры, обмотки на руках и ногах, перо у колена, кривая дубина-посох с загнутым концом
// в руке и палка с бусинами за спиной. Длинные лапы с перепончатыми пальцами, дальняя рука опирается о землю.
// Тело, шея и голова — одной формой (мягкий минимум), свет по нормали общего поля, без швов.
// Единицы — пиксели арта (3 на игровой), начало у ног, лицом вправо, вверх — минус. Только при мелком пикселе (PX_FINE > 1).

const PBZ = {
  SK: [[44, 46, 20], [72, 78, 30], [106, 112, 44], [142, 146, 60], [178, 176, 92], [208, 202, 130]],
  SK2: [[34, 36, 16], [54, 58, 24], [80, 86, 34], [108, 114, 46], [134, 138, 62]],
  BE: [[142, 118, 96], [184, 158, 128], [216, 194, 160], [236, 220, 190], [248, 238, 214]],
  CL: [[34, 20, 14], [56, 34, 22], [82, 52, 32], [112, 74, 46], [146, 102, 66]],
  LE: [[30, 20, 12], [52, 34, 20], [78, 52, 30], [108, 76, 46]],
  WO: [[40, 26, 14], [66, 42, 22], [96, 64, 36], [130, 92, 56], [164, 124, 80]],
  FUR: [[26, 18, 12], [44, 30, 20], [66, 46, 30], [92, 68, 44]],
  EY: [[140, 84, 12], [206, 142, 24], [240, 188, 52], [255, 226, 120]],
  GOLD: [[120, 90, 30], [190, 154, 70], [236, 210, 130]],
  FE: [[[34, 70, 150], [60, 120, 210], [140, 196, 248]], [[150, 40, 110], [200, 80, 150], [240, 150, 190]]],
  PAINT: [236, 240, 224], DARK: [26, 16, 10],
};

function pbZhab(K, P, fr) {
  const C = PBZ, sw = P.sleep ? 0 : (P.leg || 0), cr = P.sleep ? 1 : (P.crouch || 0), air = P.air || 0;
  const dy = cr * 7, wing = P.wing || 0, dead = !!P.dead;
  const sac = P.sac >= 0 ? P.sac : Math.min(1, (P.mouth || 0) * 0.9);
  pbShadow(K, air > 0.3 ? 30 : 44);

  // ---------- рваный плащ за спиной ----------
  {
    const fl = wing * 3;
    const cloak = [[-6, -98 + dy], [-30, -96 + dy], [-48, -76 + dy], [-60, -46 + fl], [-66, -16 + fl], [-56, -8 + fl * 0.6], [-50, -16], [-44, -6], [-36, -18], [-28, -10], [-20, -30], [-8, -50 + dy]];
    pbPoly(K, cloak, (x, y) => {
      const fold = Math.sin((x + y * 0.35) * 0.32) * 0.18, edge = y > -24 + fl && K.hsh(x * 1.7) > 0.7 ? -0.2 : 0;
      return pbPick(C.CL, 0.42 + fold + edge - (x + 66) / 200 * -0.2 + (K.hsh(Math.floor(x / 2) * 5.3) - 0.5) * 0.12, K.dth(x, y));
    });
  }

  // ---------- ноги: бедро вперёд, голень назад, длинная ступня с перепончатыми пальцами ----------
  const leg = (ox, ph, ramp, near) => {
    const lift = Math.max(0, ph) * 6, hx = -14 + ox, hy = -36 + dy * 0.7;
    const kx = hx + 26 + ph * 6 - air * 30, ky = -40 + dy * 0.6 - air * 6 + (near ? 0 : -2);
    const ax = hx + 2 + ph * 10 - air * 36, ay = -8 - lift - air * 4;
    pbBlob(K, [{ e: [hx + 10, hy + 1, 21, 14] }, { c: [[kx, ky, 9], [ax, ay, 5.5]] }], ramp, { amb: 0.44, k: 5, depth: 10, tex: (x, y) => (K.hsh(x * 0.53 + y * 3.7) > 0.95 ? -0.22 : 0) });
    // обмотки на голени
    for (let k = 0; k < 3; k++) { const t = 0.32 + k * 0.17, x = kx + (ax - kx) * t, y = ky + (ay - ky) * t; pbLimb(K, x - 7, y - 2, x + 7, y + 2, 2.2, 2.2, C.LE, { amb: near ? 0.55 : 0.38 }); }
    // ступня: три длинных пальца веером, круглые подушечки
    const fx = ax + 4, fy = ay + 3;
    for (const [i, a] of [[0, -0.18], [1, 0.05], [2, 0.3]]) {
      const len = 22 - i * 3, tx = fx + Math.cos(a) * len * (1 - air * 1.4), ty = fy + Math.sin(a) * 6 + (air ? 6 : 0);
      pbLimb(K, fx, fy, tx, Math.min(-1, ty), 2.6, 1.6, ramp, { amb: near ? 0.5 : 0.36 });
      pbBall(K, tx + 1, Math.min(-1, ty), 2.4, 2, ramp, { amb: near ? 0.6 : 0.44 });
    }
    return [kx, ky, ax, ay];
  };
  leg(-6, -sw, C.SK2, false);

  // ---------- дальняя рука: длинная, пальцами в землю ----------
  {
    const sx = 4, sy = -62 + dy, up = air > 0.3 || P.up > 0.5;
    const hx = up ? 30 : 46 + sw * 4, hy = up ? -100 : -6;
    const A = pbIK(sx, sy, hx, hy, 34, 40, -1);
    pbChain(K, [[A.sx, A.sy, 6], [A.ex, A.ey, 4.4], [A.hx, A.hy, 3.6]], C.SK2, { amb: 0.38 });
    for (const a of [-0.5, 0, 0.5]) { const ang = A.a2 + a * 0.9; pbLimb(K, A.hx, A.hy, A.hx + Math.cos(ang) * 11, A.hy + Math.sin(ang) * 11, 2, 1.4, C.SK2, { amb: 0.4 }); pbBall(K, A.hx + Math.cos(ang) * 12, A.hy + Math.sin(ang) * 12, 2, 2, C.SK2, { amb: 0.5 }); }
  }

  // ---------- туловище, шея и голова — одной формой ----------
  const hx = 32 + (P.a > 0.5 ? 4 : 0) - (P.hurt > 0.5 ? 4 : 0), hy = -82 + dy + (P.hurt > 0.5 ? 3 : 0);
  pbBlob(K, [
    { e: [-4, -50 + dy, 30, 26] },                       // корпус-груша
    { e: [8, -36 + dy * 0.8, 24, 18] },                  // брюхо опущено вниз
    { c: [[-2, -64 + dy, 20], [hx - 14, hy + 4, 18]] },  // шеи у жабы нет: голова сидит на плечах
    { e: [hx, hy, 30, 18] },                              // плоская широкая голова
    { e: [hx + 16, hy + 4, 20, 11] },                     // морда: тупой широкий нос вперёд
    { e: [hx + 16, hy - 14, 11, 10] },                    // бугор глаза — наверху, ближе к морде
  ], C.SK, { amb: 0.46, k: 7, depth: 16, tex: (x, y) => (K.hsh(x * 0.37 + y * 5.3) > 0.955 ? -0.25 : K.hsh(x * 1.3 + y * 0.7) > 0.985 ? 0.25 : 0) });
  // кремовое брюхо; горло и нижняя челюсть — одна светлая полоса от рта до груди
  pbBall(K, 16, -34 + dy * 0.8, 18, 19, C.BE, { amb: 0.4, fade: 0.4 });
  // рот: широкий, низко на голове, уголок опущен под глазом сзади (жабья хмурость)
  const mouthY = x => { const t = (x - (hx - 8)) / 44; return hy + 11 - t * 7 + Math.sin(Math.min(1, Math.max(0, t)) * Math.PI) * -1.5; };
  // нижняя челюсть и горловой мешок — одно светлое пятно от линии рта вниз; к краю мешка оно редеет дизером
  // и тает в оливковой коже, так что овала-«нагрудника» не видно
  const tR = 24 + sac * 6, tRy = 13 + sac * 6;
  K.R(hx - 12, hy - 2, hx + 37, hy + 34, (x, y) => {
    const m = mouthY(Math.max(hx - 8, x));
    if (y < m + 1) return null;
    const inHead = ((x + 0.5 - hx) / 30) ** 2 + ((y + 0.5 - hy) / 18) ** 2 <= 1 || ((x + 0.5 - hx - 16) / 20) ** 2 + ((y + 0.5 - hy - 4) / 11) ** 2 <= 1;
    const q = ((x + 0.5 - hx - 8) / tR) ** 2 + ((y + 0.5 - hy - 14) / tRy) ** 2;
    let w = Math.max(inHead ? 1 - Math.max(0, (hx - 2 - x) / 10) : 0, Math.min(1, (1 - q) / 0.95));
    if (y > hy + 12) w = Math.min(w, Math.min(1, (1 - q) / 0.95));                                  // ниже челюсти — только мягкий мешок
    if (w <= 0 || K.dth(x, y) > w) return null;
    return pbPick(C.BE, 0.7 - (y - m) / 24 * 0.6, K.dth(x, y));
  });
  // белая руна на брюхе (как на рисунке: перевёрнутая «галочка» с чертой)
  for (const [x0, y0, x1, y1] of [[10, -44, 16, -32], [22, -44, 16, -32], [16, -32, 16, -22], [12, -27, 20, -27]]) K.path([[x0, y0 + dy * 0.8, 0.6], [x1, y1 + dy * 0.8, 0.6]], () => C.PAINT);

  // ---------- юбка из шкуры и пояс ----------
  {
    pbLimb(K, -26, -39 + dy * 0.6, 26, -37 + dy * 0.6, 3.2, 3.2, C.LE, { amb: 0.5 });
    for (let k = 0; k < 14; k++) {
      const x = -22 + k * 3.4, len = 8 + K.hsh(k * 3.1) * 7, s = sw * (k % 2 ? 1.5 : -1);
      K.path([[x, -37 + dy * 0.6, 2.4], [x + s + 1, -37 + dy * 0.6 + len, 0.7]], (t, e) => pbPick(C.FUR, 0.7 - t * 0.45 + (k % 3 ? 0 : -0.15) + (e ? -0.2 : 0), K.dth(x, t * 10)));
    }
  }

  // ---------- шарф-повязка на груди с узлом ----------
  {
    pbPoly(K, [[hx - 28, hy + 12], [hx - 8, hy + 22], [hx + 6, hy + 25], [22, -50 + dy], [8, -44 + dy], [-10, -52 + dy], [-18, -62 + dy]], (x, y) => pbPick(C.CL, 0.5 + Math.sin((x - y) * 0.3) * 0.15 - (y - hy) / 80 * 0.2, K.dth(x, y)));
    const tx = 8 + wing, ty = -46 + dy;
    pbPoly(K, [[tx - 3, ty - 2], [tx + 4, ty - 2], [tx + 6 + wing, ty + 22], [tx + 1 + wing, ty + 20], [tx - 2, ty + 24]], C.CL);   // висячий конец
    pbBall(K, tx, ty - 3, 4, 3.4, C.CL, { amb: 0.5 });                                         // узел
  }

  // ---------- лицо ----------
  const open = (P.mouth || 0) > 0.35;
  // открытый рот: нижняя челюсть отходит вниз, внутри тёмно-красное и язык
  if (open) {
    const j = 3 + P.mouth * 7;
    pbPoly(K, [[hx - 8, mouthY(hx - 8)], [hx + 36, mouthY(hx + 36)], [hx + 32, mouthY(hx + 32) + j], [hx - 4, mouthY(hx - 4) + j * 0.5]], () => [58, 20, 20]);
    pbBall(K, hx + 14, mouthY(hx + 14) + j * 0.6, 12, 2.4, [[150, 60, 70], [200, 96, 104]], { amb: 0.5 });
  }
  // линия рта и светлая верхняя губа над ней
  for (let x = hx - 8; x <= hx + 36; x++) { const y = Math.round(mouthY(x)); K.P(x, y, C.DARK); if (x < hx - 4 || x > hx + 32) K.P(x, y + 1, C.DARK); K.P(x, y - 1, C.SK[4]); }
  // ноздря на кончике морды, над губой
  K.P(hx + 32, hy - 2, C.DARK); K.P(hx + 33, hy - 2, C.DARK); K.P(hx + 32, hy - 3, C.SK[1]);
  // кольца-серьги у уголка рта
  for (const [x, y] of [[hx - 10, hy + 12], [hx - 5, hy + 14], [hx, hy + 14]]) K.R(x - 3, y - 3, x + 3, y + 3, (xx, yy) => { const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y); return d > 1.4 && d < 2.8 ? (yy < y ? C.GOLD[2] : C.GOLD[1]) : null; });
  // белые полосы раскраски: на темени за глазом и на щеке
  for (const [x0, y0, x1, y1] of [[hx - 2, hy - 15, hx + 4, hy - 4], [hx + 4, hy - 18, hx + 8, hy - 8], [hx - 10, hy - 6, hx - 5, hy + 4]]) K.path([[x0, y0, 0.9], [x1, y1, 0.6]], () => C.PAINT);
  // глаз: золото, поперечный зрачок, блик; тяжёлое веко — взгляд исподлобья
  const ex = hx + 17, ey = hy - 15;
  if (P.eye >= 2) {
    pbBall(K, ex, ey, 7, 6, C.SK, { amb: 0.6 });
    if (P.eye === 3) for (let k = -4; k <= 4; k++) { K.P(ex + k, ey + k * 0.8, C.DARK); K.P(ex + k, ey - k * 0.8, C.DARK); }
    else for (let k = -6; k <= 6; k++) K.P(ex + k, ey + 1 + Math.abs(k) * 0.2, C.DARK);
  } else {
    pbBall(K, ex, ey, 8.4, 8, C.EY, { amb: 0.58 });
    for (let k = -6; k <= 6; k++) K.P(ex + k, ey + 7.6 - Math.abs(k) * 0.14, C.EY[0]);           // нижний ободок
    K.R(ex - 6, ey, ex + 6, ey, () => C.DARK); K.R(ex - 4, ey - 1, ex + 4, ey + 1, () => C.DARK);   // поперечный зрачок
    K.P(ex - 3, ey - 4, [255, 255, 240]); K.P(ex - 2, ey - 4, [255, 246, 200]); K.P(ex - 3, ey - 3, [255, 246, 200]);
    const lid = P.eye === 1 ? 4 : 2;
    K.R(ex - 9, ey - 9, ex + 9, ey - 7 + lid, (x, y) => (Math.hypot((x - ex) / 8, (y - ey) / 7.6) < 1.05 ? pbPick(C.SK, 0.55 - (y - ey + 8) / 14, K.dth(x, y)) : null));
    for (let k = -8; k <= 8; k++) K.P(ex + k, ey - 7 + lid + Math.abs(k) * 0.14, C.SK[0]);
  }

  // ---------- капюшон: плотная ткань с краем над глазом, складки, лохмотья по низу ----------
  {
    const hood = [[hx + 26, hy - 27], [hx + 14, hy - 37], [hx - 6, hy - 41], [hx - 30, hy - 35], [hx - 48, hy - 16], [hx - 54, hy + 10], [-28, -46 + dy], [-14, -54 + dy], [hx - 32, hy + 16], [hx - 22, hy + 4], [hx - 12, hy - 12], [hx + 2, hy - 25], [hx + 14, hy - 28]];
    pbPoly(K, hood, (x, y) => {
      const fold = Math.sin((x * 0.8 - y) * 0.28) * 0.16 + (K.hsh(Math.floor((x - y * 0.5) / 3) * 2.9) - 0.5) * 0.12;
      return pbPick(C.CL, 0.6 - (y - hy + 30) / 70 * 0.35 + (x - hx) / 80 * 0.2 + fold, K.dth(x, y));
    });
    // толстый подшитый край капюшона над глазом и вдоль щеки
    K.path([[hx + 26, hy - 27, 2], [hx + 14, hy - 29, 2.4], [hx + 2, hy - 26, 2.4], [hx - 12, hy - 13, 2.4], [hx - 22, hy + 3, 2], [hx - 32, hy + 16, 1.8]], (t, e) => pbPick(C.CL, e ? 0.3 : 0.8, K.dth(hx + t * 20, hy)));
    for (let i = 0; i < 6; i++) { const x = hx - 40 + i * 6, y = hy - 26 + i * 2; K.path([[x, y, 0.5], [x - 4, y + 16, 0.5]], () => C.CL[1]); }   // складки
    // лохмотья по краю у плеча
    for (let i = 0; i < 4; i++) { const x = -26 + i * 7, y = -50 + dy + i * -2; pbPoly(K, [[x, y], [x + 5, y], [x + 2 + wing, y + 12 + K.hsh(i) * 6]], C.CL); }
  }

  // ---------- ближняя нога ----------
  const [nkx, nky, nax, nay] = leg(4, sw, C.SK, true);
  // перо у колена, привязанное к обмотке (синее и розовое)
  for (const [i, F] of C.FE.entries()) {
    const bx = nkx - 2 + i * 3, by = nky + 4, s = Math.sin(i + sw * 1.6) * 3;
    K.path([[bx, by, 1.6], [bx + 2 + s, by + 14, 2.2], [bx + 3 + s * 1.4, by + 24, 0.6]], (t, e, sd) => pbPick(F, 0.7 - t * 0.3 + (sd > 0 ? -0.25 : 0.05) + (e ? -0.2 : 0), K.dth(bx, t * 9)));
    K.path([[bx, by, 0.4], [bx + 3 + s * 1.4, by + 23, 0.4]], () => F[0]);
  }

  // ---------- ближняя рука с длинным суковатым посохом ----------
  {
    // ang — куда смотрит верхний конец посоха: в покое — вверх и назад, за капюшон; нижний конец с крюком — у земли впереди
    let H, ang;
    if (air > 0.3) { H = [44, -96 + dy]; ang = -1.6; }
    else if (P.up > 0.5) { H = [30, -120]; ang = -1.7; }
    else if (P.b > 0.5) { H = [48, -76 + dy]; ang = -2.5; }
    else if ((P.a || 0) < 0) { const t = -P.a; H = [42 - t * 22, -34 - t * 56 + dy]; ang = -2.15 - t * 0.5; }
    else { const t = Math.min(1, P.a || 0); H = [42 + t * 16, -34 - t * 22 + dy]; ang = -2.15 + t * 0.95; }
    const sx = 14, sy = -58 + dy, A = pbIK(sx, sy, H[0], H[1], 28, 28, 1);
    pbChain(K, [[A.sx, A.sy, 7], [A.ex, A.ey, 5], [A.hx, A.hy, 4.4]], C.SK, { amb: 0.46 });
    // обмотка предплечья
    for (let k = 0; k < 3; k++) { const t = 0.3 + k * 0.2, x = A.ex + (A.hx - A.ex) * t, y = A.ey + (A.hy - A.ey) * t, nx = -Math.sin(A.a2), ny = Math.cos(A.a2); pbLimb(K, x - nx * 7, y - ny * 7, x + nx * 7, y + ny * 7, 2, 2, C.LE, { amb: 0.55 }); }
    // посох одной палкой: от крюка у земли через кулак до развилки над капюшоном; суковатый, с наростами
    const dx = Math.cos(ang), dyv = Math.sin(ang), px = -dyv, py = dx, LO = 36, HI = 118;
    const pts = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16, s = -LO + t * (LO + HI), w = Math.sin(t * 13) * 1.4 + Math.sin(t * 5.3) * 1.2; pts.push([H[0] + dx * s + px * w, H[1] + dyv * s + py * w, 3.3 - t * 1.1 + (i === 4 || i === 9 || i === 13 ? 0.8 : 0)]); }
    K.path(pts, (t, e, sd) => pbPick(C.WO, 0.55 + (sd > 0 ? 0.18 : -0.12) + (e ? -0.18 : 0) + (K.hsh(Math.floor(t * 50)) - 0.5) * 0.2, K.dth(H[0] + t * 50, H[1])));
    // нижний конец загнут крюком
    const bx = pts[0][0], by = pts[0][1], hook = [];
    for (let i = 0; i <= 8; i++) { const a = i / 8 * 3.6, r = 7 - i * 0.4; hook.push([bx - dx * Math.sin(a) * r + px * (r - Math.cos(a) * r), by - dyv * Math.sin(a) * r + py * (r - Math.cos(a) * r), 3 - i * 0.2]); }
    K.path(hook, (t, e, sd) => pbPick(C.WO, 0.5 + (sd > 0 ? 0.2 : -0.1) + (e ? -0.2 : 0), K.dth(bx + t * 9, by)));
    // верхний конец: развилка-рогатка, на шнурке две чёрные бусины
    const tx = pts[16][0], ty = pts[16][1];
    K.path([[tx, ty, 1.6], [tx + dx * 9 + px * 4, ty + dyv * 9 + py * 4, 0.7]], () => C.WO[2]);
    K.path([[tx - dx * 2, ty - dyv * 2, 1.4], [tx + dx * 7 - px * 5, ty + dyv * 7 - py * 5, 0.6]], () => C.WO[1]);
    const qx = tx - dx * 14, qy = ty - dyv * 14, s = wing * 1.5;
    K.path([[qx, qy, 0.5], [qx + 3 + s, qy + 14, 0.5]], () => C.LE[3]);
    pbBall(K, qx + 3 + s, qy + 16, 2.4, 2.4, [[20, 20, 22], [44, 44, 48], [90, 90, 96]], { amb: 0.5 });
    pbBall(K, qx + 7 + s, qy + 13, 2, 2, [[20, 20, 22], [44, 44, 48], [90, 90, 96]], { amb: 0.5 });
    // ремни: обмотка над и под кулаком, и ещё одна у крюка с висячими ремешками
    for (const sq of [-8, 6, 10, -26, -22]) { const x = H[0] + dx * sq, y = H[1] + dyv * sq; pbLimb(K, x - px * 4, y - py * 4, x + px * 4, y + py * 4, 1.6, 1.6, C.LE, { amb: 0.5 }); }
    const rx = H[0] - dx * 24, ry = H[1] - dyv * 24;
    K.path([[rx, ry, 0.6], [rx + 3 + wing, ry + 10, 0.5]], () => C.LE[3]); K.path([[rx + 2, ry, 0.6], [rx + 6 + wing, ry + 8, 0.5]], () => C.LE[2]);
    // кулак поверх посоха: пальцы обхватывают
    pbBall(K, A.hx, A.hy, 5.4, 5, C.SK, { amb: 0.56 });
    for (let k = -1; k <= 1; k++) K.P(A.hx + px * k * 2.6 + dx * 3, A.hy + py * k * 2.6 + dyv * 3, C.SK[1]);
    // след удара верхним концом
    if ((P.a || 0) > 0.5) for (let i = 0; i < 14; i++) { const t = i / 13, an = ang - 1.3 + t * 1.2, r = HI - 6; K.P(H[0] + Math.cos(an) * r, H[1] + Math.sin(an) * r, [236, 232, 214, 0.7 - t * 0.3], 0.8, false); }
  }

  // ---------- сон: «Z» ----------
  if (P.sleep) for (const [i, s] of [[0, 4], [1, 6]]) { const zx = hx + 20 + i * 12, zy = hy - 26 - i * 12; for (let k = -s; k <= s; k++) { K.P(zx + k, zy - s, [235, 245, 255]); K.P(zx + k, zy + s, [235, 245, 255]); K.P(zx - k, zy + k, [235, 245, 255]); } }
  K.outline([30, 22, 14]);
}

// ======================= Жабьен анфас: идёт к зрителю или стоит лицом =======================
// Та же жаба, что и сбоку: присел, колени в стороны, дальняя от посоха рука пальцами в землю, посох — в правой руке
// (слева от зрителя) от крюка у земли до развилки с бусинами над капюшоном. Голова широкая, глаза-бугры по краям,
// капюшон аркой с подшитым краем, рот во всю ширину с опущенными уголками, светлая челюсть тает в горле.
function pbZhabF(K, P) {
  const C = PBZ, sw = P.leg || 0, wing = P.wing || 0, open = (P.mouth || 0) > 0.35;
  pbShadow(K, 54);
  const hx = 0, hy = -84;

  // ---------- плащ за спиной: шире плеч, рваный низ ----------
  pbPoly(K, [[-34, -98], [34, -98], [52, -62], [60, -16 + wing * 2], [52, -8], [46, -16], [38, -6], [30, -14], [-30, -14], [-38, -6], [-46, -16], [-52, -8], [-60, -16 - wing * 2], [-52, -62]], (x, y) => {
    const fold = Math.sin(x * 0.42) * 0.16 + (K.hsh(Math.floor(x / 3) * 4.1) - 0.5) * 0.14;
    return pbPick(C.CL, 0.36 + fold + (y + 98) / 90 * -0.12, K.dth(x, y));
  });

  // ---------- позы конечностей ----------
  const legP = d => { const lift = Math.max(0, d * sw) * 7; return { lift, tx: d * 24, ty: -30 - lift * 0.4, kx: d * 34, ky: -42 - lift * 0.5, ax: d * 22, ay: -9 - lift }; };
  const L = legP(-1), R = legP(1);
  // руки выходят из-под капюшона ниже и шире плеч: правая (слева от зрителя) держит посох, левая — пальцами в землю
  const SH = 60, aR = pbIK(-36, -SH, -54, -34 - sw * 2, 20, 20, 1), aL = pbIK(36, -SH, 56 + sw * 2, -6, 30, 30, -1);

  // ---------- кожа одной формой: ноги, туловище, руки, шея, голова, бугры глаз ----------
  pbBlob(K, [
    { e: [L.tx, L.ty, 17, 15] }, { c: [[L.kx, L.ky, 9], [L.ax, L.ay, 6]] },
    { e: [R.tx, R.ty, 17, 15] }, { c: [[R.kx, R.ky, 9], [R.ax, R.ay, 6]] },
    { e: [0, -50, 26, 26] }, { e: [0, -38, 22, 18] },
    { c: [[0, -62, 22], [0, hy + 6, 22]] },
    { e: [hx, hy, 34, 18] },
    { e: [hx - 19, hy - 13, 10, 9] }, { e: [hx + 19, hy - 13, 10, 9] },
  ], C.SK, { amb: 0.46, k: 8, depth: 16, tex: (x, y) => (K.hsh(x * 0.37 + y * 5.3) > 0.955 ? -0.25 : K.hsh(x * 1.3 + y * 0.7) > 0.985 ? 0.25 : 0) });
  pbBall(K, 0, -36, 16, 17, C.BE, { amb: 0.4, fade: 0.4 });
  for (const [x0, y0, x1, y1] of [[-6, -46, 0, -34], [6, -46, 0, -34], [0, -34, 0, -24], [-4, -29, 4, -29]]) K.path([[x0, y0, 0.6], [x1, y1, 0.6]], () => C.PAINT);

  // ---------- ступни, обмотки на голенях ----------
  for (const [d, G] of [[-1, L], [1, R]]) {
    for (let k = 0; k < 3; k++) { const t = 0.3 + k * 0.18, x = G.kx + (G.ax - G.kx) * t, y = G.ky + (G.ay - G.ky) * t; pbLimb(K, x - 7, y, x + 7, y + 1, 2.2, 2.2, C.LE, { amb: 0.5 }); }
    for (const [ox, oy] of [[d * 12, 4], [d * 4, 7], [-d * 4, 6]]) {
      const fx = G.ax + ox, fy = Math.min(-1, G.ay + oy + G.lift * 0.6);
      pbLimb(K, G.ax, G.ay + 2, fx, fy, 2.8, 1.8, C.SK, { amb: 0.5 });
      pbBall(K, fx, fy, 2.4, 2, C.SK, { amb: 0.62 });
    }
  }
  // руки: каждая — одна цепь без шва в локте; плечо уходит под полы капюшона, стык с телом закрыт тканью
  pbChain(K, [[aR.sx, aR.sy, 7.4], [aR.ex, aR.ey, 5.6], [aR.hx, aR.hy, 4.6]], C.SK, { amb: 0.52 });
  pbChain(K, [[aL.sx, aL.sy, 7.4], [aL.ex, aL.ey, 5.4], [aL.hx, aL.hy, 4.2]], C.SK, { amb: 0.52 });
  // пальцы левой руки — в землю
  for (const a of [-0.6, 0, 0.6]) { const ang = Math.PI / 2 + a; pbLimb(K, aL.hx, aL.hy, aL.hx + Math.cos(ang) * 9, aL.hy + Math.sin(ang) * 6, 2, 1.4, C.SK, { amb: 0.5 }); pbBall(K, aL.hx + Math.cos(ang) * 10, aL.hy + Math.sin(ang) * 6.6, 2, 2, C.SK, { amb: 0.6 }); }
  // обмотки на предплечьях
  for (const A of [aL, aR]) for (let k = 0; k < 2; k++) { const t = 0.35 + k * 0.25, x = A.ex + (A.hx - A.ex) * t, y = A.ey + (A.hy - A.ey) * t, nx = -Math.sin(A.a2) * 5.6, ny = Math.cos(A.a2) * 5.6; pbLimb(K, x - nx, y - ny, x + nx, y + ny, 2, 2, C.LE, { amb: 0.55 }); }

  // ---------- юбка из шкуры ----------
  pbLimb(K, -26, -34, 26, -34, 3.2, 3.2, C.LE, { amb: 0.5 });
  for (let k = 0; k < 15; k++) { const x = -24 + k * 3.4, len = 8 + K.hsh(k * 3.1) * 7; K.path([[x, -32, 2.4], [x + sw * (k % 2 ? 1 : -1), -32 + len, 0.7]], (t, e) => pbPick(C.FUR, 0.7 - t * 0.45 + (k % 3 ? 0 : -0.15) + (e ? -0.2 : 0), K.dth(x, t * 10))); }

  // ---------- лицо ----------
  const mY = x => hy + 6 + Math.pow(Math.min(1, Math.abs(x) / 31), 3) * 5;          // уголки рта опущены
  if (open) { const j = 3 + P.mouth * 6; pbPoly(K, [[-30, mY(-30)], [30, mY(30)], [22, hy + 8 + j], [-22, hy + 8 + j]], () => [58, 20, 20]); pbBall(K, 0, hy + 8 + j * 0.6, 12, 2.4, [[150, 60, 70], [200, 96, 104]], { amb: 0.5 }); }
  // светлая нижняя челюсть и горло — тает к краям дизером
  K.R(-34, hy, 34, hy + 34, (x, y) => {
    if (y < mY(x) + 1) return null;
    const inHead = ((x + 0.5) / 34) ** 2 + ((y + 0.5 - hy) / 18) ** 2 <= 1, q = ((x + 0.5) / 28) ** 2 + ((y + 0.5 - hy - 14) / 13) ** 2;
    let w = Math.max(inHead ? 1 - Math.max(0, (Math.abs(x) - 22) / 10) : 0, Math.min(1, (1 - q) / 0.95));
    if (y > hy + 12) w = Math.min(w, Math.min(1, (1 - q) / 0.95));
    if (w <= 0 || K.dth(x, y) > w) return null;
    return pbPick(C.BE, 0.7 - (y - mY(x)) / 24 * 0.6, K.dth(x, y));
  });
  for (let x = -31; x <= 31; x++) { const y = Math.round(mY(x)); K.P(x, y, C.DARK); if (Math.abs(x) > 26) K.P(x, y + 1, C.DARK); K.P(x, y - 1, C.SK[4]); }
  for (const s of [-1, 1]) { K.P(s * 5, hy - 5, C.DARK); K.P(s * 5, hy - 6, C.SK[1]); }                              // ноздри
  for (const [x, y] of [[-27, hy + 12], [-22, hy + 14], [-17, hy + 15]]) K.R(x - 3, y - 3, x + 3, y + 3, (xx, yy) => { const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y); return d > 1.4 && d < 2.8 ? (yy < y ? C.GOLD[2] : C.GOLD[1]) : null; });
  for (const [x0, y0, x1, y1] of [[-6, hy - 20, -5, hy - 9], [0, hy - 22, 0, hy - 10], [6, hy - 20, 5, hy - 9], [-30, hy - 4, -26, hy + 4]]) K.path([[x0, y0, 0.9], [x1, y1, 0.6]], () => C.PAINT);
  for (const s of [-1, 1]) {
    const ex = s * 19, ey = hy - 14;
    if (P.eye >= 2) { pbBall(K, ex, ey, 7.4, 6.4, C.SK, { amb: 0.6 }); for (let k = -6; k <= 6; k++) K.P(ex + k, ey + 1 + Math.abs(k) * 0.2, C.DARK); continue; }
    pbBall(K, ex, ey, 8, 7.6, C.EY, { amb: 0.58 });
    for (let k = -6; k <= 6; k++) K.P(ex + k, ey + 7.2 - Math.abs(k) * 0.14, C.EY[0]);
    K.R(ex - 6, ey, ex + 6, ey, () => C.DARK); K.R(ex - 4, ey - 1, ex + 4, ey + 1, () => C.DARK);
    K.P(ex - 3, ey - 4, [255, 255, 240]); K.P(ex - 2, ey - 4, [255, 246, 200]);
    const lid = P.eye === 1 ? 4 : 2;
    K.R(ex - 9, ey - 9, ex + 9, ey - 7 + lid, (x, y) => (Math.hypot((x - ex) / 8.4, (y - ey) / 7.8) < 1.05 ? pbPick(C.SK, 0.55 - (y - ey + 8) / 14, K.dth(x, y)) : null));
    for (let k = -8; k <= 8; k++) K.P(ex + k, ey - 7 + lid + Math.abs(k) * 0.14 + (s * k > 0 ? Math.abs(k) * 0.08 : 0), C.SK[0]);   // веко ниже к внешнему краю — взгляд исподлобья
  }

  // ---------- капюшон аркой: подшитый край над глазами, складки, полы закрывают плечи ----------
  K.R(-58, hy - 42, 58, -56, (x, y) => {
    const out = (x / 46) ** 2 + ((y - hy + 4) / 38) ** 2 <= 1 || (y > hy && Math.abs(x) < 44 + (y - hy) * 0.3);       // полы ложатся на плечи скатом
    const hole = (x / 36) ** 2 + ((y - hy - 4) / 27) ** 2 <= 1;
    if (!out || hole) return null;
    const rimD = (x / 36) ** 2 + ((y - hy - 4) / 27) ** 2;
    if (rimD < 1.22) return pbPick(C.CL, 0.82 - (y - hy + 30) / 60 * 0.3, K.dth(x, y));                     // толстый подшитый край
    const fold = Math.sin(Math.atan2(y - hy, x) * 9) * 0.16 + (K.hsh(Math.floor(Math.atan2(y - hy, x) * 14) * 3.1) - 0.5) * 0.14;
    return pbPick(C.CL, 0.56 - (y - hy + 40) / 80 * 0.3 + fold, K.dth(x, y));
  });
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const x = s * (30 + i * 6), y = -57; pbPoly(K, [[x - 3, y], [x + 3, y], [x + s * 2 + wing, y + 8 + K.hsh(i + s) * 6]], C.CL); }   // рваный край пол над руками

  // ---------- шарф под челюстью с узлом ----------
  pbPoly(K, [[-24, -62], [0, -56], [24, -62], [26, -56], [0, -50], [-26, -56]], (x, y) => pbPick(C.CL, 0.5 + Math.sin(x * 0.4) * 0.15, K.dth(x, y)));
  pbBall(K, 6, -54, 4.4, 3.6, C.CL, { amb: 0.55 });
  pbPoly(K, [[4, -52], [9, -52], [11 + wing, -34], [6 + wing, -36]], C.CL);

  // перо у правого колена (у зрителя справа)
  for (const [i, F] of C.FE.entries()) { const bx = R.kx - 2 + i * 3, by = R.ky + 4, s = Math.sin(i + sw * 1.6) * 2; K.path([[bx, by, 1.6], [bx + 1 + s, by + 14, 2.2], [bx + 2 + s, by + 24, 0.6]], (t, e, sd) => pbPick(F, 0.7 - t * 0.3 + (sd > 0 ? -0.25 : 0.05) + (e ? -0.2 : 0), K.dth(bx, t * 9))); }

  // ---------- длинный посох в правой руке (слева от зрителя) ----------
  {
    const X0 = aR.hx - 4, pts = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16, y = -2 + t * (-150), x = X0 - 2 + t * 8 + Math.sin(t * 13) * 1.3 + Math.sin(t * 5.3) * 1.1; pts.push([x, y, 3.3 - t * 1.1 + (i === 4 || i === 9 || i === 13 ? 0.8 : 0)]); }
    K.path(pts, (t, e, sd) => pbPick(C.WO, 0.55 + (sd > 0 ? 0.18 : -0.12) + (e ? -0.18 : 0) + (K.hsh(Math.floor(t * 50)) - 0.5) * 0.2, K.dth(X0, t * 90)));
    const bx = pts[0][0], hook = [];
    for (let i = 0; i <= 8; i++) { const a = i / 8 * 3.6, r = 6 - i * 0.35; hook.push([bx - (r - Math.cos(a) * r), -2 - Math.sin(a) * r * 0.6 + 2, 3 - i * 0.2]); }
    K.path(hook, (t, e) => pbPick(C.WO, 0.5 + (e ? -0.2 : 0), K.dth(bx + t * 9, -2)));
    const tx = pts[16][0], ty = pts[16][1];
    K.path([[tx, ty, 1.6], [tx + 6, ty - 8, 0.7]], () => C.WO[2]); K.path([[tx, ty + 2, 1.4], [tx - 6, ty - 6, 0.6]], () => C.WO[1]);
    K.path([[tx + 1, ty + 14, 0.5], [tx + 4 + wing, ty + 28, 0.5]], () => C.LE[3]);
    pbBall(K, tx + 4 + wing, ty + 30, 2.4, 2.4, [[20, 20, 22], [44, 44, 48], [90, 90, 96]], { amb: 0.5 });
    pbBall(K, tx + 8 + wing, ty + 27, 2, 2, [[20, 20, 22], [44, 44, 48], [90, 90, 96]], { amb: 0.5 });
    for (const yy of [-50, -28, -24, -14, -10]) { const x = X0 + (yy + 2) / -150 * 8; pbLimb(K, x - 5, yy, x + 5, yy + 1, 1.6, 1.6, C.LE, { amb: 0.5 }); }
    // кулак поверх посоха
    pbBall(K, aR.hx, aR.hy, 5.4, 5, C.SK, { amb: 0.56 });
    for (let k = -1; k <= 1; k++) K.P(aR.hx + 3, aR.hy + k * 2.6, C.SK[1]);
  }
  K.outline([30, 22, 14]);
}

if (typeof NA_PX !== 'undefined' && typeof NA_SPEC !== 'undefined' && NA_SPEC.ftZ) {
  NA_PX.ftZ = (K, P, fr) => {
    if (typeof FT_DEAD !== 'undefined' && FT_DEAD[fr]) Object.assign(P, FT_DEAD[fr], { x: 6, y: 0 });    // падает навзничь на месте, не улетая за кадр
    pbZhab(K, P, fr);
  };
  // анфас (идёт к зрителю): только покой и ходьба — переваливается с ноги на ногу; остальное — боковые кадры
  NA_SPEC.ftZF = NA_SPEC.ftZ; NA_DRAW.ftZF = NA_DRAW.ftZ;
  NA_PX.ftZF = (K, P, fr) => {
    if (!fr || (fr[0] !== 'i' && fr[0] !== 'w')) return NA_PX.ftZ(K, P, fr);
    if (fr[0] === 'w') P.rot = -(P.leg || 0) * 0.05;
    pbZhabF(K, P);
  };
}
