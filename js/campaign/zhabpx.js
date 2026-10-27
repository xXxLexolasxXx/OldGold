'use strict';
// Жабьен — ручной пиксель-арт на сетке ×3 (метод Полудницы и легендарного дракона, набор pb* из pxbeasts.js).
// По рисунку владельца: приземистая оливковая жаба в буром капюшоне с рваным плащом, кремовое брюхо и горловой мешок,
// золотой глаз с поперечным зрачком под тяжёлым веком, клык из-под губы, кольца в щеке, белые полосы раскраски,
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
  BONE: [[150, 138, 110], [206, 196, 166], [238, 232, 210]],
  GOLD: [[120, 90, 30], [190, 154, 70], [236, 210, 130]],
  FE: [[[34, 70, 150], [60, 120, 210], [140, 196, 248]], [[150, 40, 110], [200, 80, 150], [240, 150, 190]]],
  PAINT: [236, 240, 224], DARK: [26, 16, 10],
};

function pbZhab(K, P, fr) {
  const C = PBZ, sw = P.sleep ? 0 : (P.leg || 0), cr = P.sleep ? 1 : (P.crouch || 0), air = P.air || 0;
  const dy = cr * 7, wing = P.wing || 0, dead = !!P.dead;
  const sac = P.sac >= 0 ? P.sac : Math.min(1, (P.mouth || 0) * 0.9);
  pbShadow(K, air > 0.3 ? 30 : 44);

  // ---------- палка с бусинами за спиной ----------
  if (!dead) {
    const bx0 = 4, by0 = -40 + dy, bx1 = -26, by1 = -150 + dy;
    pbLimb(K, bx0, by0, bx1, by1, 2.4, 1.8, C.WO, { amb: 0.4 });
    K.path([[bx1 + 2, by1 + 8, 1.2], [bx1 - 6, by1 - 2, 0.7]], () => C.WO[2]);              // развилка
    K.path([[bx1 + 4, by1 + 4, 1.2], [bx1 + 10, by1 - 6, 0.6]], () => C.WO[1]);
    const sx = bx1 + 6, sy = by1 + 18, s = wing * 1.5;
    K.path([[sx, sy, 0.5], [sx + 4 + s, sy + 14, 0.5]], () => C.LE[3]);                      // шнурок
    pbBall(K, sx + 4 + s, sy + 16, 2.4, 2.4, [[20, 20, 22], [44, 44, 48], [90, 90, 96]], { amb: 0.5 });
    pbBall(K, sx + 8 + s, sy + 13, 2, 2, [[20, 20, 22], [44, 44, 48], [90, 90, 96]], { amb: 0.5 });
  }

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
    { e: [hx, hy, 32, 19] },                              // плоская широкая голова
    { e: [hx + 14, hy + 7, 22, 10] },                     // морда и нижняя челюсть
    { e: [hx + 12, hy - 13, 12, 10] },                    // бугор глаза
  ], C.SK, { amb: 0.46, k: 7, depth: 16, tex: (x, y) => (K.hsh(x * 0.37 + y * 5.3) > 0.955 ? -0.25 : K.hsh(x * 1.3 + y * 0.7) > 0.985 ? 0.25 : 0) });
  // кремовое брюхо и горловой мешок: светлая форма поверх, края вплавлены дизером
  pbBall(K, 16, -34 + dy * 0.8, 18, 19, C.BE, { amb: 0.4, fade: 0.4 });
  pbBall(K, hx + 8, hy + 19, 20 + sac * 6, 9 + sac * 6, C.BE, { amb: 0.32, fade: 0.25 });
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
  // рот во всю голову: от угла под капюшоном до кончика морды; губа светлее
  if (open) {
    const j = 3 + P.mouth * 7;
    pbPoly(K, [[hx - 18, hy + 6], [hx + 34, hy + 3], [hx + 30, hy + 7 + j], [hx - 10, hy + 9 + j * 0.6]], () => [58, 20, 20]);
    pbBall(K, hx + 10, hy + 7 + j * 0.6, 13, 2.6, [[150, 60, 70], [200, 96, 104]], { amb: 0.5 });
  }
  for (let i = 0; i <= 26; i++) { const t = i / 26, x = hx - 20 + t * 54, y = hy + 6 - Math.sin(t * Math.PI) * 3 + t * -3; K.P(x, y, C.DARK); K.P(x, y + 1, C.DARK); K.P(x, y - 1, C.SK[3]); }
  // клык из-под губы (как на рисунке — один длинный и один маленький)
  K.path([[hx + 10, hy + 6, 2.2], [hx + 12, hy + 19, 0.5]], (t, e) => pbPick(C.BONE, 0.85 - t * 0.4 - (e ? 0.3 : 0), K.dth(hx, t * 9)));
  K.path([[hx + 20, hy + 5, 1.4], [hx + 21, hy + 11, 0.4]], (t, e) => pbPick(C.BONE, 0.8 - t * 0.4 - (e ? 0.3 : 0), K.dth(hx + 3, t * 9)));
  pbDot(K, hx + 30, hy - 3, C.DARK); pbDot(K, hx + 31, hy - 3, C.SK[0]);                 // ноздря
  // кольца-серьги в щеке у угла рта
  for (const [x, y] of [[hx - 10, hy + 9], [hx - 4, hy + 11], [hx + 2, hy + 12]]) K.R(x - 3, y - 3, x + 3, y + 3, (xx, yy) => { const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y); return d > 1.4 && d < 2.8 ? (yy < y ? C.GOLD[2] : C.GOLD[1]) : null; });
  // белые полосы раскраски: на темени и щеке
  for (const [x0, y0, x1, y1] of [[hx - 10, hy - 14, hx - 3, hy - 2], [hx - 3, hy - 17, hx + 3, hy - 6], [hx - 18, hy - 6, hx - 12, hy + 3]]) K.path([[x0, y0, 0.9], [x1, y1, 0.6]], () => C.PAINT);
  // глаз: золото, поперечный зрачок, блик; тяжёлое веко — взгляд исподлобья
  const ex = hx + 13, ey = hy - 14;
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
    const hood = [[hx + 26, hy - 22], [hx + 14, hy - 32], [hx - 6, hy - 37], [hx - 30, hy - 32], [hx - 48, hy - 14], [hx - 54, hy + 10], [-28, -46 + dy], [-14, -54 + dy], [hx - 32, hy + 16], [hx - 22, hy + 4], [hx - 14, hy - 10], [hx - 2, hy - 20], [hx + 12, hy - 23]];
    pbPoly(K, hood, (x, y) => {
      const fold = Math.sin((x * 0.8 - y) * 0.28) * 0.16 + (K.hsh(Math.floor((x - y * 0.5) / 3) * 2.9) - 0.5) * 0.12;
      return pbPick(C.CL, 0.6 - (y - hy + 30) / 70 * 0.35 + (x - hx) / 80 * 0.2 + fold, K.dth(x, y));
    });
    // толстый подшитый край капюшона над глазом и вдоль щеки
    K.path([[hx + 26, hy - 22, 2], [hx + 12, hy - 24, 2.4], [hx - 2, hy - 21, 2.4], [hx - 14, hy - 11, 2.4], [hx - 22, hy + 3, 2], [hx - 32, hy + 16, 1.8]], (t, e) => pbPick(C.CL, e ? 0.3 : 0.8, K.dth(hx + t * 20, hy)));
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

  // ---------- ближняя рука с кривой дубиной ----------
  {
    let H, ang;
    if (air > 0.3) { H = [44, -96 + dy]; ang = -0.5; }
    else if (P.up > 0.5) { H = [30, -132]; ang = -1.5; }
    else if (P.b > 0.5) { H = [48, -76 + dy]; ang = -1.9; }
    else if ((P.a || 0) < 0) { const t = -P.a; H = [42 - t * 22, -34 - t * 56 + dy]; ang = 1.25 - t * 3.3; }
    else { const t = Math.min(1, P.a || 0); H = [42 + t * 16, -34 - t * 22 + dy]; ang = 1.25 - t * 0.9; }
    const sx = 14, sy = -58 + dy, A = pbIK(sx, sy, H[0], H[1], 28, 28, 1);
    pbChain(K, [[A.sx, A.sy, 7], [A.ex, A.ey, 5], [A.hx, A.hy, 4.4]], C.SK, { amb: 0.46 });
    // обмотка предплечья
    for (let k = 0; k < 3; k++) { const t = 0.3 + k * 0.2, x = A.ex + (A.hx - A.ex) * t, y = A.ey + (A.hy - A.ey) * t, nx = -Math.sin(A.a2), ny = Math.cos(A.a2); pbLimb(K, x - nx * 7, y - ny * 7, x + nx * 7, y + ny * 7, 2, 2, C.LE, { amb: 0.55 }); }
    // дубина: суковатая палка, вниз-вперёд от кулака, на конце — загнутый крюк; ремни у кулака и посередине
    const dx = Math.cos(ang), dyv = Math.sin(ang), px = -dyv, py = dx;
    const pts = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10, s = -16 + t * 66, w = Math.sin(t * 9) * 1.6; pts.push([H[0] + dx * s + px * w, H[1] + dyv * s + py * w, 3.2 - t * 0.6 + (i === 3 || i === 7 ? 0.8 : 0)]); }
    K.path(pts, (t, e, sd) => pbPick(C.WO, 0.55 + (sd > 0 ? 0.18 : -0.12) + (e ? -0.18 : 0) + (K.hsh(Math.floor(t * 30)) - 0.5) * 0.2, K.dth(H[0] + t * 50, H[1])));
    const ex2 = pts[10][0], ey2 = pts[10][1], hook = [];
    for (let i = 0; i <= 8; i++) { const a = i / 8 * 3.6, r = 8 - i * 0.45; hook.push([ex2 + dx * Math.sin(a) * r + px * (r - Math.cos(a) * r), ey2 + dyv * Math.sin(a) * r + py * (r - Math.cos(a) * r), 2.6 - i * 0.18]); }
    K.path(hook, (t, e, sd) => pbPick(C.WO, 0.5 + (sd > 0 ? 0.2 : -0.1) + (e ? -0.2 : 0), K.dth(ex2 + t * 9, ey2)));
    for (const s of [-6, -2, 24, 28]) { const x = H[0] + dx * s, y = H[1] + dyv * s; pbLimb(K, x - px * 4, y - py * 4, x + px * 4, y + py * 4, 1.6, 1.6, C.LE, { amb: 0.5 }); }
    const tx = H[0] + dx * 26, ty = H[1] + dyv * 26;
    K.path([[tx, ty, 0.6], [tx + 2 + wing, ty + 12, 0.5]], () => C.LE[3]); K.path([[tx + 2, ty, 0.6], [tx + 5 + wing, ty + 10, 0.5]], () => C.LE[2]);   // висячие ремешки
    // кулак поверх рукояти: три пальца обхватывают
    pbBall(K, A.hx, A.hy, 5.4, 5, C.SK, { amb: 0.56 });
    for (let k = -1; k <= 1; k++) K.P(A.hx + px * k * 2.6 + dx * 3, A.hy + py * k * 2.6 + dyv * 3, C.SK[1]);
    if ((P.a || 0) > 0.5) for (let i = 0; i < 12; i++) { const t = i / 11, an = ang - 1.6 + t * 1.5, r = 62; K.P(H[0] + Math.cos(an) * r * 0.8 - 6, H[1] + Math.sin(an) * r * 0.7 + 10, [236, 232, 214, 0.7 - t * 0.3], 0.8, false); }
  }

  // ---------- сон: «Z» ----------
  if (P.sleep) for (const [i, s] of [[0, 4], [1, 6]]) { const zx = hx + 20 + i * 12, zy = hy - 26 - i * 12; for (let k = -s; k <= s; k++) { K.P(zx + k, zy - s, [235, 245, 255]); K.P(zx + k, zy + s, [235, 245, 255]); K.P(zx - k, zy + k, [235, 245, 255]); } }
  K.outline([30, 22, 14]);
}

if (typeof NA_PX !== 'undefined' && typeof NA_SPEC !== 'undefined' && NA_SPEC.ftZ) {
  NA_PX.ftZ = (K, P, fr) => {
    if (typeof FT_DEAD !== 'undefined' && FT_DEAD[fr]) Object.assign(P, FT_DEAD[fr], { x: 6, y: 0 });    // падает навзничь на месте, не улетая за кадр
    pbZhab(K, P, fr);
  };
}
