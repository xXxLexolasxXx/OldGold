'use strict';
// Ручной пиксель-арт на сетке ×3 (метод Полудницы, fzPxKit в fairy2.js) для нейтралов naFrame:
// чемпион гоблинов, тролли, броненосец, гномтавры, ледяной элементаль (два облика).
// Рисуется только при мелком пикселе (PX_FINE > 1, NA_PX в neutralart.js); на телефонах — прежний вектор.
// Единицы — пиксели арта (3 на игровой пиксель), начало координат у ног, лицом вправо, вверх — минус.

// ---------- общая кисть: объём светом сверху-слева, дизер на границах тонов ----------
const PB_L = [-0.5, -0.72, 0.48];                      // направление света (x, y, к зрителю)
function pbPick(ramp, v, d) {
  const n = ramp.length; let i = Math.floor(v * n + (d - 0.5) * 0.9);
  return ramp[i < 0 ? 0 : i >= n ? n - 1 : i];
}
// эллипсоид с освещением; o.amb — общий тон, o.tex(x, y, v) → поправка тона (пятна, чешуя)
function pbBall(K, cx, cy, rx, ry, ramp, o = {}) {
  const amb = o.amb ?? 0.42;
  K.R(cx - rx, cy - ry, cx + rx, cy + ry, (x, y) => {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d = nx * nx + ny * ny;
    if (d > 1) return null;
    if (o.clip && !o.clip(x, y)) return null;
    const nz = Math.sqrt(1 - d);
    let v = amb + (nx * PB_L[0] + ny * PB_L[1] + nz * PB_L[2]) * 0.62;
    if (o.tex) v += o.tex(x, y, v);
    if (d > 0.86 && !o.soft) v -= 0.12;                  // тень по краю — объём (у суставов и мышц — нет)
    return pbPick(ramp, v, K.dth(x, y));
  });
}
// конечность-цилиндр от (x0, y0) радиуса r0 к (x1, y1) радиуса r1
function pbLimb(K, x0, y0, x1, y1, r0, r1, ramp, o = {}) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, nx = dy / len, ny = -dx / len;
  const lit = nx * PB_L[0] + ny * PB_L[1], amb = o.amb ?? 0.45;
  K.L(x0, y0, x1, y1, r0, r1, (t, e, cr) => {
    const s = cr / (len * Math.max(0.5, r0 + (r1 - r0) * t));     // −1…1 поперёк
    let v = amb + s * lit * 0.55 + Math.sqrt(Math.max(0, 1 - s * s)) * 0.2 - (e && o.rim ? 0.14 : 0);   // без тёмного края: сегменты сливаются, суставы не видны
    if (o.tex) v += o.tex(t, s);
    return pbPick(ramp, v, K.dth(x0 + dx * t + nx * s * 3, y0 + dy * t + ny * s * 3));
  });
}
// многоугольник: f(x, y) → цвет, либо ramp с вертикальным светом
function pbPoly(K, pts, f) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const inside = (px, py) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) c = !c; } return c; };
  K.R(x0, y0, x1, y1, (x, y) => inside(x + 0.5, y + 0.5) ? (Array.isArray(f) ? pbPick(f, 0.5 - (y - (y0 + y1) / 2) / (y1 - y0 + 1) * 0.5, K.dth(x, y)) : f(x, y)) : null);
}
// точка/пятно цветом
const pbDot = (K, x, y, col, r = 0) => { if (!r) K.P(x, y, col); else K.R(x - r, y - r, x + r, y + r, (xx, yy) => ((xx - x) ** 2 + (yy - y) ** 2 <= r * r + 0.3 ? col : null)); };
// мягкая тень у ног (не входит в обводку)
function pbShadow(K, rx, ry = rx * 0.26) {
  K.R(-rx, -ry, rx, ry, (x, y) => { const d = (x / rx) ** 2 + (y / ry) ** 2; return d <= 1 && K.dth(x, y) < 0.75 - d * 0.35 ? [10, 8, 4, 0.34] : null; }, false);
}
// глаз: белок-жёлтый, зрачок, блик; закрыт (2) — щёлка, мёртв (3) — крест
function pbEye(K, x, y, r, P, white, pupil, lid) {
  if (P.eye >= 2) {
    if (P.eye === 3) for (let k = -r; k <= r; k++) { K.P(x + k, y + k, lid); K.P(x + k, y - k, lid); }
    else for (let k = -r; k <= r; k++) K.P(x + k, y + (Math.abs(k) === r ? -1 : 0), lid);
    return;
  }
  pbBall(K, x, y, r + 0.6, r * (P.eye === 1 ? 0.75 : 1) + 0.4, [white, white, white], { amb: 0.6 });
  pbDot(K, x + 1, y + 0.3, pupil, Math.max(0.6, r * 0.45));
  K.P(x - 1, y - 1, [255, 255, 240]);
}
// масштаб рисунка: те же координаты, но в s раз крупнее (детали остаются в пикселях арта)
function pbScaled(K, s) {
  const Q = {
    W: K.W, H: K.H, cv: K.cv, hsh: K.hsh, done: K.done, outline: K.outline,
    dth: (x, y) => K.dth(x * s, y * s),
    R(x0, y0, x1, y1, f, sol = true) { K.R(x0 * s, y0 * s, x1 * s, y1 * s, (X, Y) => f((X + 0.5) / s - 0.5, (Y + 0.5) / s - 0.5), sol); },
    P(x, y, col, a = 1, sol = true) { K.R(x * s, y * s, x * s + s - 1, y * s + s - 1, () => [col[0], col[1], col[2], a], sol); },
    L(x0, y0, x1, y1, r0, r1, f, sol = true) {
      const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1, rm = Math.max(r0, r1) + 1;
      Q.R(Math.min(x0, x1) - rm, Math.min(y0, y1) - rm, Math.max(x0, x1) + rm, Math.max(y0, y1) + rm, (x, y) => {
        const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / l2)), ex = x - x0 - dx * t, ey = y - y0 - dy * t, r = r0 + (r1 - r0) * t, d = Math.sqrt(ex * ex + ey * ey);
        return d <= r ? f(t, d > r - 1 / s, ex * dy - ey * dx) : null;
      }, sol);
    },
    path(pts, f, sol = true) { for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], n = pts.length - 1; Q.L(a[0], a[1], b[0], b[1], a[2], b[2], (t, e, sd) => f((i - 1 + t) / n, e, sd), sol); } },
  };
  return Q;
}
// угол руки с оружием (как у вектора): замах назад-вверх, удар вперёд-вниз
function pbArmAng(P) { return P.up > 0.5 ? -2.7 : P.a > 0 ? -0.2 + P.a * 1.5 : -0.6 + P.a * 1.9; }

// ======================= Чемпион гоблинов =======================
// Горбатый громила ростом почти с тролля: лоскутная броня из жести с заклёпками и ржавчиной, шлем с настоящими
// витыми рогами, круглый щит из бочки, ржавый зазубренный меч. Мускулистые руки с наручами, толстые ноги
// с наколенниками и обмотками, когтистые пальцы ног. Злые жёлтые глаза, клыки из-под нижней губы, шрам.
const PBC = {
  SK: [[30, 48, 20], [50, 78, 30], [78, 112, 44], [110, 148, 60], [150, 184, 92]],
  SK2: [[26, 40, 18], [42, 64, 26], [64, 94, 38], [92, 126, 52]],
  IR: [[34, 32, 38], [58, 56, 62], [92, 90, 94], [136, 134, 134], [188, 186, 180]],
  RU: [[62, 30, 16], [102, 52, 24], [148, 82, 38], [186, 118, 56]],
  LE: [[38, 24, 14], [64, 40, 22], [96, 62, 36], [132, 90, 54]],
  WO: [[44, 28, 14], [76, 50, 26], [112, 78, 42], [150, 110, 64]],
  BO: [[92, 80, 58], [146, 132, 98], [196, 184, 146], [234, 226, 194]],
  CL: [[78, 24, 20], [116, 38, 28], [158, 60, 40]],
};
function pbChamp(K, P) {
  const C = PBC, a = P.a, sw = P.leg, open = P.mouth > 0.3;
  pbShadow(K, 46);
  // ---- дальняя нога (тень) и ближняя: бедро, наколенник, голень в обмотках, ступня с когтями
  const leg = (hx, sgn, ramp) => {
    const kx = hx + sgn * sw * 8 + 4, fx = hx + sgn * sw * 14 + 2, ky = -38, ay = -9;
    pbLimb(K, hx, -66, kx, ky, 12, 10, ramp);
    pbLimb(K, kx, ky, fx, ay, 10, 8, ramp);
    for (let k = 0; k < 4; k++) pbLimb(K, kx - 9 + k * 0.5, ky + 8 + k * 6, kx + 9 - k * 0.3 + (fx - kx) * 0.2, ky + 10 + k * 6, 1.6, 1.6, C.LE, { amb: 0.5 - k * 0.04 });   // обмотки
    pbBall(K, kx + 2, ky, 7.5, 7, C.IR, { amb: 0.34 });                                   // наколенник
    pbDot(K, kx - 2, ky - 3, C.IR[4]); pbDot(K, kx + 4, ky + 3, C.RU[2], 1.2);
    pbBall(K, fx + 6, -4, 13, 5.5, ramp, { amb: 0.38 });                                  // ступня
    for (let t = 0; t < 4; t++) { const tx = fx + 10 + t * 3.2; K.path([[tx, -3, 1.6], [tx + 3.4, 0, 0.6]], () => C.BO[t % 2 ? 1 : 2]); }   // когти
  };
  leg(-14, -1, C.SK2);
  // ---- кожаная юбка-полосы между ног
  for (let k = 0; k < 6; k++) { const x = -18 + k * 7.4; pbPoly(K, [[x, -66], [x + 7, -66], [x + 6 + sw * 2, -44 + (k % 2) * 4], [x + 1 + sw * 2, -44 + (k % 2) * 4]], C.LE); pbDot(K, x + 3.5, -62, C.IR[3]); }
  leg(8, 1, C.SK);
  // ---- дальняя рука со щитом из бочки
  const sx0 = -16, sy0 = -108, ex0 = -24 - a * 2, ey0 = -86 + (P.b ? -8 : 0), hx0 = -14 + (P.b ? 14 : 0), hy0 = -70 + (P.b ? -16 : 0);
  pbLimb(K, sx0, sy0, ex0, ey0, 10, 9, C.SK2); pbLimb(K, ex0, ey0, hx0, hy0, 9, 7.5, C.SK2);
  const shx = hx0 - 4, shy = hy0 + 2, shr = 26;
  K.R(shx - shr, shy - shr, shx + shr, shy + shr, (x, y) => {
    const dx = x + 0.5 - shx, dy = y + 0.5 - shy, d = Math.hypot(dx, dy) / shr;
    if (d > 1) return null;
    if (d > 0.86) return pbPick(C.IR, 0.7 - d * 0.4 + (dy < 0 ? 0.15 : -0.1), K.dth(x, y));           // железный обод
    const plank = Math.floor((dx + shr) / 8.6), seam = ((dx + shr) % 8.6) < 1;
    if (seam) return C.WO[0];
    let v = 0.55 - dy / shr * 0.25 + (K.hsh(plank * 9.1) - 0.5) * 0.25 + (K.hsh(Math.floor(y / 3) * 1.3 + plank) - 0.5) * 0.12;
    if (Math.abs(dy - 6) < 2.2 || Math.abs(dy + 10) < 2.2) return pbPick(C.IR, v, K.dth(x, y));        // стальные полосы
    return pbPick(C.WO, v, K.dth(x, y));
  });
  pbBall(K, shx, shy - 2, 6, 6, C.IR, { amb: 0.55 }); pbDot(K, shx - 2, shy - 4, C.IR[4]);             // умбон
  for (const [dx, dy] of [[-12, -14], [10, 16], [16, -8]]) K.path([[shx + dx, shy + dy, 0.6], [shx + dx + 3, shy + dy + 2, 0.6]], () => C.WO[0]);   // зарубки
  // ---- горб и туловище: брюхо, лоскутная броня
  pbBall(K, -18, -108, 22, 20, C.SK, { amb: 0.3 });                                      // горб
  K.R(-42, -132, 4, -92, (x, y) => { const d = ((x + 18) / 24) ** 2 + ((y + 110) / 22) ** 2; return d < 1 && y < -100 + Math.sin(x * 0.7) * 4 ? pbPick([[46, 32, 20], [74, 52, 32], [104, 76, 48]], 0.5 - (y + 120) / 40 + (K.hsh(x * 3.1) - 0.5) * 0.4, K.dth(x, y)) : null; });   // шкура-накидка
  for (let k = 0; k < 4; k++) K.path([[-34 + k * 9, -122 + Math.abs(k - 1.5) * 3, 2.4], [-38 + k * 9, -136 + Math.abs(k - 1.5) * 3, 0.5]], () => PBC.IR[3]);   // шипы
  pbBall(K, 4, -86, 31, 27, C.SK, { amb: 0.45, tex: (x, y) => (K.hsh(x * 0.31 + y * 7.1) > 0.94 ? -0.25 : 0) });   // пузо в бородавках
  // нагрудная пластина: жесть, заклёпки, ржавые потёки
  pbPoly(K, [[-16, -112], [22, -114], [28, -92], [20, -76], [-10, -74], [-20, -92]], (x, y) => {
    const v = 0.62 - (y + 112) / 50 * 0.35 - (x + 16) / 60 * 0.15 + (K.hsh(Math.floor(x / 9) * 3.3 + Math.floor(y / 9)) - 0.5) * 0.2;
    return (K.hsh(x * 1.7 + y * 0.9) > 0.86 && y > -100) ? pbPick(C.RU, v, K.dth(x, y)) : pbPick(C.IR, v, K.dth(x, y));
  });
  for (const [x, y] of [[-12, -108], [18, -110], [24, -94], [-16, -92], [16, -80], [-6, -78]]) { pbDot(K, x, y, C.IR[4]); K.P(x + 1, y + 1, C.IR[1]); }
  K.path([[-14, -100, 0.6], [6, -96, 0.6], [22, -102, 0.6]], () => C.IR[1]);              // шов между листами
  pbPoly(K, [[-22, -114], [-8, -114], [14, -76], [2, -76]], C.LE);                       // перевязь наискось
  for (let k = 0; k < 4; k++) pbDot(K, -14 + k * 6.6, -108 + k * 9, C.IR[3], 0.8);
  // пояс с пряжкой-черепом
  pbPoly(K, [[-24, -72], [30, -74], [30, -64], [-24, -62]], C.LE);
  pbBall(K, 4, -68, 6, 5.4, C.BO, { amb: 0.55 }); pbDot(K, 2, -69, [20, 12, 8], 1); pbDot(K, 6, -69, [20, 12, 8], 1); K.P(4, -66, [20, 12, 8]);
  // ---- голова: выдвинута вперёд, огромные уши, тяжёлая бровь, нос-крюк, клыки
  const hx = 30 + (a > 0.5 ? 4 : 0), hy = -124 + (P.hurt > 0.5 ? 3 : 0);
  // дальнее ухо
  pbPoly(K, [[hx - 10, hy - 2], [hx - 40, hy - 16], [hx - 34, hy - 8], [hx - 10, hy + 6]], C.SK2);
  pbBall(K, hx, hy, 18, 17, C.SK, { amb: 0.52, tex: (x, y) => (K.hsh(x * 0.7 + y * 3.1) > 0.96 ? -0.3 : 0) });
  pbBall(K, hx + 6, hy + 8, 12, 8, C.SK, { amb: 0.38 });                                 // челюсть
  // ближнее ухо: длинное, с дырой и кольцом
  pbPoly(K, [[hx - 2, hy - 4], [hx - 30, hy - 22], [hx - 26, hy - 12], [hx - 4, hy + 6]], (x, y) => pbPick(C.SK, 0.62 - (y - hy + 22) / 40 * 0.4, K.dth(x, y)));
  K.path([[hx - 6, hy - 2, 0.6], [hx - 24, hy - 15, 0.6]], () => C.SK2[1]);
  pbDot(K, hx - 18, hy - 9, C.RU[3], 1.4); K.P(hx - 18, hy - 9, C.SK2[0]);
  // бровь, глаз, шрам
  K.path([[hx + 2, hy - 8, 2.2], [hx + 16, hy - 4, 1.6]], () => C.SK2[1]);
  pbEye(K, hx + 9, hy - 2, 2.4, P, [255, 214, 64], [200, 30, 20], C.SK2[0]);
  K.path([[hx + 4, hy - 13, 0.6], [hx + 10, hy + 2, 0.6], [hx + 8, hy + 8, 0.6]], () => [168, 96, 80]);
  // нос-крюк
  pbPoly(K, [[hx + 12, hy - 2], [hx + 24, hy + 6], [hx + 18, hy + 8], [hx + 12, hy + 6]], (x, y) => pbPick(C.SK, 0.7 - (y - hy) / 14 * 0.4, K.dth(x, y)));
  pbDot(K, hx + 18, hy + 7, C.SK2[0]);
  // рот и клыки
  if (open) {
    pbBall(K, hx + 12, hy + 12, 7, 4 + P.mouth * 2, [[30, 6, 6], [56, 14, 12], [80, 24, 18]], { amb: 0.3 });
    for (const t of [0, 4, 8]) K.path([[hx + 7 + t, hy + 9, 0.8], [hx + 8 + t, hy + 12, 0.4]], () => C.BO[3]);
  } else K.path([[hx + 4, hy + 11, 0.7], [hx + 18, hy + 10, 0.7]], () => [30, 10, 8]);
  for (const t of [6, 14]) K.path([[hx + t, hy + 13, 1.4], [hx + t + 1, hy + 6, 0.6]], () => C.BO[2]);   // нижние клыки
  // шлем с витыми рогами: железная шапка с заклёпками, рога толстые, кольчатые, загнуты вверх-вперёд
  pbBall(K, hx - 2, hy - 8, 19, 15, C.IR, { amb: 0.5, clip: (x, y) => y < hy - 5 });
  K.path([[hx - 18, hy - 7, 1.4], [hx + 14, hy - 7, 1.4]], () => C.IR[1]);
  for (let k = 0; k < 5; k++) pbDot(K, hx - 14 + k * 7, hy - 8, C.IR[4]);
  K.R(hx - 12, hy - 22, hx + 10, hy - 10, (x, y) => (K.hsh(x * 2.1 + y) > 0.9 && y > hy - 18 ? C.RU[1] : null));    // ржавчина
  const horn = (bx, by, dir, len) => {
    const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10, ang = -1.9 + dir * 0.4 + t * 1.6 * dir; pts.push([bx + Math.cos(ang) * len * t * 0.9 + dir * t * 6, by + Math.sin(ang) * len * t * 0.95 - t * 4, 5.4 * (1 - t * 0.82)]); }
    K.path(pts, (t, e) => pbPick(C.BO, (e ? 0.25 : 0.62) - t * 0.15 + (((t * 10) % 1) < 0.18 ? -0.3 : 0), K.dth(bx + t * 20, by)));
  };
  horn(hx - 12, hy - 16, -1, 30);
  horn(hx + 8, hy - 18, 1, 32);
  // ---- ближняя рука: мускулистое плечо, наруч, кулак с мечом
  const ang = pbArmAng(P), shX = 18, shY = -108;
  const elx = shX + Math.cos(ang + 1.25) * 24, ely = shY + Math.sin(ang + 1.25) * 24, fx = elx + Math.cos(ang + 0.45) * 22, fy = ely + Math.sin(ang + 0.45) * 22;
  pbBall(K, shX, shY + 2, 14, 12, C.IR, { amb: 0.55 });                                 // наплечник
  for (let k = 0; k < 3; k++) pbDot(K, shX - 8 + k * 7, shY - 6 + Math.abs(k - 1) * 2, C.IR[4]);
  pbLimb(K, shX + 2, shY + 6, elx, ely, 11, 9, C.SK);                                    // бицепс
  pbLimb(K, elx, ely, fx, fy, 9, 8, C.SK);
  pbLimb(K, elx + (fx - elx) * 0.35, ely + (fy - ely) * 0.35, fx, fy, 9.5, 9, C.LE, { amb: 0.5 });   // наруч
  pbBall(K, fx, fy, 8, 7.5, C.SK, { amb: 0.5 });                                          // кулак
  for (let k = -1; k <= 1; k++) K.P(fx + Math.cos(ang) * 4 + k * 2.4, fy + Math.sin(ang) * 4 - 3, C.SK2[1]);
  // меч: длинный, широкий, зазубренный, с ржавчиной, рукоять обмотана
  const bx = Math.cos(ang - 0.2), by = Math.sin(ang - 0.2), px = -by, py = bx, BL = 74, BW = 6;
  pbLimb(K, fx - bx * 10, fy - by * 10, fx + bx * 4, fy + by * 4, 2.6, 2.6, C.LE);        // рукоять
  pbBall(K, fx - bx * 11, fy - by * 11, 3.2, 3.2, C.IR);                                  // навершие
  pbPoly(K, [[fx + px * 11 + bx * 5, fy + py * 11 + by * 5], [fx - px * 11 + bx * 5, fy - py * 11 + by * 5], [fx - px * 11 + bx * 9, fy - py * 11 + by * 9], [fx + px * 11 + bx * 9, fy + py * 11 + by * 9]], C.IR);   // гарда
  const bl = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12, w = BW * (1 - t * 0.3); bl.push([fx + bx * (9 + BL * t) - px * w, fy + by * (9 + BL * t) - py * w]); }   // обух
  bl.push([fx + bx * (9 + BL + 10), fy + by * (9 + BL + 10)]);
  for (let i = 24; i >= 0; i--) { const t = i / 24, w = BW * (1 - t * 0.3) + (i % 2 && t > 0.1 && t < 0.92 ? -2.2 : 0.4); bl.push([fx + bx * (9 + BL * t) + px * w, fy + by * (9 + BL * t) + py * w]); }   // зубья
  pbPoly(K, bl, (x, y) => {
    const s = ((x - fx) * px + (y - fy) * py) / BW, along = ((x - fx) * bx + (y - fy) * by) / BL;
    let v = 0.56 + s * 0.28 + (K.hsh(Math.floor(along * 14) * 4.3) - 0.5) * 0.12;
    if (K.hsh(x * 0.9 + y * 1.3) > 0.8 && along > 0.1 && along < 0.85) return pbPick(C.RU, v, K.dth(x, y));
    return pbPick(C.IR, v, K.dth(x, y));
  });
  K.path([[fx + bx * 12, fy + by * 12, 0.5], [fx + bx * (BL - 4), fy + by * (BL - 4), 0.5]], () => C.IR[1]);   // дол
  // след удара
  if (a > 0.5) for (let i = 0; i < 14; i++) { const t = i / 13, an = ang - 1.8 + t * 1.7, r = 92; K.P(fx + Math.cos(an) * r * 0.9 - 10, fy + Math.sin(an) * r * 0.6 + 20, [236, 232, 214, 0.7 - t * 0.3], 0.8, false); }
  K.outline([26, 22, 16]);
}
NA_PX.goblinChamp = (K, P) => pbChamp(pbScaled(K, 1.5), P);   // ростом почти с тролля

// ======================= Тролли: лесной, каменный, болотный =======================
// Сгорбленная гора мышц: горб с мхом, бочкообразное брюхо, длинные руки до колен — бицепс, предплечье,
// огромные кисти с узловатыми пальцами и жёлтыми когтями; короткие кривые ноги, колени, ступни с пальцами.
// Маленькая голова выдвинута вперёд: нос-картошка, тяжёлая бровь, клыки снизу, уши. Дубина/валун/коряга.
const PBT = {
  troll: { SK: [[30, 52, 26], [52, 82, 40], [80, 116, 58], [112, 150, 78], [150, 184, 108]], BE: [[96, 112, 62], [130, 150, 90], [164, 184, 120]], HA: [[24, 40, 18], [40, 64, 28], [62, 92, 40]], CL: [[52, 32, 18], [82, 54, 30], [114, 80, 46]], NA: [[176, 160, 110], [216, 206, 160]], wpn: 'club' },
  trollS: { SK: [[44, 44, 44], [72, 72, 70], [104, 104, 100], [138, 138, 132], [176, 174, 166]], BE: [[118, 114, 104], [150, 146, 134], [180, 176, 164]], HA: [[42, 42, 40], [62, 62, 58], [86, 86, 80]], CL: [[60, 46, 34], [90, 72, 52], [120, 98, 72]], NA: [[160, 150, 130], [204, 196, 176]], wpn: 'rock', moss: [[70, 100, 50], [104, 138, 70]] },
  trollB: { SK: [[22, 46, 42], [40, 74, 66], [62, 104, 92], [90, 136, 120], [126, 168, 150]], BE: [[84, 116, 96], [114, 146, 122], [144, 176, 150]], HA: [[20, 40, 30], [34, 62, 46], [52, 88, 62]], CL: [[46, 54, 34], [70, 82, 50], [98, 112, 70]], NA: [[170, 178, 140], [210, 216, 180]], wpn: 'snag', slime: [[110, 170, 70], [160, 214, 100]] },
};
function pbTroll(K, P, kind) {
  const T = PBT[kind], SK = T.SK, a = P.a, sw = P.leg, open = P.mouth > 0.3;
  const SKD = SK.slice(0, 4), WO = PBC.WO;
  pbShadow(K, 92);
  const texSkin = (x, y) => (K.hsh(x * 0.53 + y * 3.7) > 0.95 ? -0.28 : K.hsh(x * 1.9 + y * 0.37) > 0.97 ? 0.2 : 0) + (kind === 'trollS' ? ((Math.floor(x / 11) + Math.floor(y / 9)) % 3 === 0 ? -0.08 : 0) : 0);
  // ---- ноги: бедро, колено, голень, ступня с пальцами и когтями
  const leg = (hx, sgn, ramp, dk) => {
    const kx = hx + sgn * sw * 12 + 6, ky = -54, fx = hx + sgn * sw * 20 + 4;
    pbLimb(K, hx, -96, kx, ky, 22, 17, ramp, { tex: () => 0 });
    pbLimb(K, kx, ky, fx, -14, 16, 13, ramp);
    pbBall(K, fx + 12, -8, 25, 10, ramp, { amb: dk ? 0.3 : 0.42, tex: texSkin });        // ступня
    for (let t = 0; t < 4; t++) { const tx = fx + 18 + t * 6; pbBall(K, tx, -5, 4, 4.6, ramp, { amb: 0.5 }); K.path([[tx + 2, -6, 1.8], [tx + 6, -2, 0.6]], () => T.NA[t % 2]); }
  };
  leg(-30, -1, SKD, true);
  // набедренная повязка
  pbPoly(K, [[-50, -104], [44, -108], [40, -78], [24, -70], [10, -80], [-6, -68], [-22, -80], [-40, -72], [-50, -84]], (x, y) => {
    const v = 0.55 - (y + 104) / 40 * 0.3 + (K.hsh(Math.floor(x / 7) * 1.7) - 0.5) * 0.25;
    return pbPick(T.CL, v, K.dth(x, y));
  });
  K.path([[-48, -100, 1.6], [42, -104, 1.6]], () => T.CL[0]);
  leg(14, 1, SK, false);
  // ---- дальняя рука: свисает до колен, огромная кисть
  const arm = (sx, sy, ang, len1, len2, ramp, grip) => {
    const ex = sx + Math.cos(ang) * len1, ey = sy + Math.sin(ang) * len1, a2 = ang - 0.35 + (grip ? 0.2 : 0), hx = ex + Math.cos(a2) * len2, hy = ey + Math.sin(a2) * len2;
    pbBall(K, sx, sy, 22, 20, ramp, { amb: 0.48, tex: texSkin, soft: true });             // плечо-дельта
    pbLimb(K, sx, sy, ex, ey, 19, 16, ramp, { tex: (t, s) => (t > 0.3 && t < 0.6 ? 0.08 : 0) });   // бицепс
    K.path([[sx - 8, sy + 12, 0.8], [sx + Math.cos(ang) * len1 * 0.45, sy + Math.sin(ang) * len1 * 0.45, 0.6]], () => ramp[1]);   // граница дельты и бицепса — мягко
    pbLimb(K, ex, ey, hx, hy, 17, 13, ramp);                                               // предплечье, толще к локтю
    pbBall(K, hx + Math.cos(a2) * 6, hy + Math.sin(a2) * 6, 15, 13, ramp, { amb: 0.46, tex: texSkin });   // кисть
    for (let f = 0; f < 4; f++) {                                                          // узловатые пальцы и когти
      const fa = a2 + (f - 1.5) * 0.32, bx = hx + Math.cos(a2) * 12 + Math.cos(fa + 1.57) * (f - 1.5) * 5, by = hy + Math.sin(a2) * 12 + Math.sin(fa + 1.57) * (f - 1.5) * 5;
      const k1x = bx + Math.cos(fa) * 9, k1y = by + Math.sin(fa) * 9, ca = fa + (grip ? 1.6 : 0.5), tx = k1x + Math.cos(ca) * 8, ty = k1y + Math.sin(ca) * 8;
      pbLimb(K, bx, by, k1x, k1y, 4.6, 4, ramp); pbBall(K, k1x, k1y, 4, 4, ramp, { amb: 0.5 }); pbLimb(K, k1x, k1y, tx, ty, 3.8, 3, ramp);
      K.path([[tx, ty, 2.2], [tx + Math.cos(ca + 0.4) * 5, ty + Math.sin(ca + 0.4) * 5, 0.6]], () => T.NA[f % 2]);
    }
    return [hx, hy, a2];
  };
  arm(-58, -170, 1.75 - a * 0.3, 54, 50, SKD, false);
  // ---- туловище: горб, брюхо светлее, складки
  pbBall(K, -36, -172, 44, 40, SK, { amb: 0.36, tex: texSkin });                          // горб
  pbBall(K, 2, -138, 58, 50, SK, { amb: 0.46, tex: texSkin });
  pbBall(K, 14, -124, 38, 34, T.BE, { amb: 0.42, clip: (x, y) => ((x - 2) / 58) ** 2 + ((y + 138) / 50) ** 2 < 0.96, tex: (x, y) => (Math.abs(((y + 124) % 11)) < 1 && x > -16 ? -0.16 : 0) });   // брюхо со складками
  pbDot(K, 20, -116, T.BE[0], 1.4);                                                       // пуп
  if (kind === 'trollS') for (const [x, y, r] of [[-40, -190, 9], [-20, -176, 6], [30, -150, 7], [-54, -150, 6]]) { pbBall(K, x, y, r + 2, r, [[90, 76, 56], [130, 112, 86], [168, 150, 120]], { amb: 0.5 }); pbBall(K, x - 2, y - 4, r * 0.6, r * 0.5, T.moss, { amb: 0.5 }); }
  else for (let i = 0; i < 18; i++) { const t = i / 17, x = -70 + t * 66, y = -196 + Math.sin(t * 3) * 16 + 8; K.path([[x, y, 3], [x + (K.hsh(i) - 0.5) * 6, y + 10 + K.hsh(i * 3) * 12, 1]], (tt) => T.HA[tt > 0.5 ? 0 : 2 - (i % 2)]); }   // мох/космы по горбу
  if (kind === 'trollB') for (const [x, y] of [[-30, -150], [20, -170], [-50, -130]]) K.path([[x, y, 2.2], [x + 2, y + 8, 1.6], [x, y + 14, 1]], () => T.slime[1]);   // тина
  // ---- голова: маленькая, выдвинута вперёд и вниз
  const hx = 62 + (a > 0.5 ? 8 : 0), hy = -176 + (P.hurt > 0.5 ? 5 : 0);
  pbBall(K, hx - 4, hy + 2, 34, 30, SK, { amb: 0.5, tex: texSkin });
  pbBall(K, hx + 10, hy + 16, 24, 14, SK, { amb: 0.4 });                                   // челюсть
  for (const s of [-1]) pbPoly(K, [[hx - 22, hy - 6], [hx - 40, hy - 18], [hx - 34, hy + 2], [hx - 22, hy + 6]], (x, y) => pbPick(SK, 0.55 - (x - hx + 40) / 30 * 0.1, K.dth(x, y)));   // ухо
  // волосы-пакля
  for (let i = 0; i < 9; i++) { const x = hx - 26 + i * 5; K.path([[x, hy - 22, 3], [x - 4 - K.hsh(i * 7) * 6, hy - 8 + K.hsh(i) * 10, 1]], (t) => T.HA[t > 0.5 ? 0 : 1 + (i % 2)]); }
  // тяжёлая бровь и глаз
  pbBall(K, hx + 8, hy - 10, 16, 6, SK, { amb: 0.38 });
  pbEye(K, hx + 12, hy - 3, 3.2, P, [236, 200, 70], [120, 20, 10], SK[0]);
  // нос-картошка
  pbBall(K, hx + 30, hy + 4, 14, 13, SK, { amb: 0.58, tex: texSkin }); pbDot(K, hx + 30, hy + 10, SK[0], 1.4);
  // рот и клыки снизу
  if (open) { pbBall(K, hx + 18, hy + 22, 12, 4 + P.mouth * 4, [[30, 8, 6], [60, 18, 14], [90, 30, 22]], { amb: 0.3 }); }
  else K.path([[hx + 4, hy + 21, 1], [hx + 30, hy + 19, 1]], () => SK[0]);
  for (const t of [8, 26]) K.path([[hx + t, hy + 26, 3], [hx + t + 2, hy + 12, 1]], (tt) => T.NA[tt > 0.5 ? 1 : 0]);
  // ---- ближняя рука с оружием
  const ang = P.up > 0.5 ? -2.4 : P.a < -0.3 ? -2.3 : P.a > 0.5 ? 0.55 : 1.2 + P.a * 0.4;    // висит / замах вверх / удар вперёд-вниз
  const [whx, why, wa] = arm(40, -168, ang, 50, 46, SK, true);
  const bx = Math.cos(wa - 1.1), by = Math.sin(wa - 1.1);
  if (T.wpn === 'club') {                                                                  // дубина: ствол с сучками, утолщение
    const tx = whx + bx * 110, ty = why + by * 110;
    pbLimb(K, whx - bx * 14, why - by * 14, tx, ty, 6, 16, WO, { tex: (t, s) => (((t * 30) % 1) < 0.12 ? -0.2 : 0) });
    for (const t of [0.45, 0.7, 0.85]) pbBall(K, whx + bx * 110 * t + by * 12, why + by * 110 * t - bx * 12, 4, 4, WO, { amb: 0.5 });
    for (const [t, r] of [[0.92, 1], [0.8, -1]]) K.path([[whx + bx * 110 * t, why + by * 110 * t, 2], [whx + bx * 110 * t + by * 10 * r, why + by * 110 * t - bx * 10 * r, 1]], () => [180, 176, 160]);   // вбитые гвозди
  } else if (T.wpn === 'rock') {                                                           // валун над головой/в руке
    pbBall(K, whx + bx * 20, why + by * 20, 30, 26, [[70, 62, 50], [106, 96, 80], [140, 130, 110], [176, 166, 146]], { amb: 0.5, tex: (x, y) => (K.hsh(x * 0.4 + y * 2.3) > 0.9 ? -0.25 : 0) });
    pbBall(K, whx + bx * 20 - 8, why + by * 20 - 10, 10, 6, T.moss, { amb: 0.5 });
  } else {                                                                                 // коряга с тиной
    const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([whx + bx * 100 * t + Math.sin(t * 9) * 6, why + by * 100 * t + Math.cos(t * 7) * 6, 8 - t * 4]); }
    K.path(pts, () => WO[1]); for (const t of [0.4, 0.7, 0.95]) K.path([[pts[Math.round(t * 8)][0], pts[Math.round(t * 8)][1], 2], [pts[Math.round(t * 8)][0] + 4, pts[Math.round(t * 8)][1] + 18, 1]], () => T.slime[0]);
  }
  if (a > 0.5) for (let i = 0; i < 18; i++) { const t = i / 17, an = -1.4 + t * 1.9; K.P(40 + Math.cos(an) * 150, -100 + Math.sin(an) * 110, [236, 232, 214, 0.65 - t * 0.3], 0.8, false); }
  K.outline(kind === 'trollS' ? [30, 28, 26] : [18, 26, 14]);
}
NA_PX.troll = (K, P) => pbTroll(K, P, 'troll');
NA_PX.trollS = (K, P) => pbTroll(K, P, 'trollS');
NA_PX.trollB = (K, P) => pbTroll(K, P, 'trollB');

// ======================= Броненосец =======================
// Единицы — как у векторного drawArmad (масштаб NA_SPEC.sc). Панцирь из поперечных колец с роговыми щитками,
// передний и задний щиты, морда-рыльце, высокие уши, когти-лопаты, хвост в кольцах. Шар — кольца вращаются.
const PBA = {
  SH: [[56, 42, 30], [92, 72, 52], [132, 108, 80], [172, 148, 112], [208, 188, 150]],
  SK: [[86, 60, 52], [128, 94, 80], [170, 132, 112], [206, 170, 146]],
  CL: [[60, 52, 44], [110, 100, 86], [170, 160, 140]],
};
function pbArmad(Q, P) {
  const C = PBA, ball = P.curl >= 0.5, sw = P.leg, lunge = P.a > 0 ? P.a : 0;
  pbShadow(Q, ball ? 12 : 16);
  const Y = y => (P.dead ? -24 - y : y);                                                 // на спине — лапки вверх
  if (ball) {
    const r = 9 + P.curl * 3.4, cy = -r - 0.5, sp = P.spin || 0;
    if (P.dust) Q.R(-r - 14, -6, -r, 0, (x, y) => (Q.dth(x, y) < 0.35 - ((x + r) / -14) * 0.25 && ((x + r + 6) ** 2 / 50 + (y + 2) ** 2 / 6) < 1 ? [200, 180, 140, 0.6] : null), false);
    if (P.curl < 0.9) for (const s of [-1, 1]) pbLimb(Q, s * 5, cy + r * 0.7, s * 6, -1, 2.2, 1.8, C.SK);
    pbBall(Q, 0, cy, r, r, C.SH, { amb: 0.46, tex: (x, y) => {
      const an = Math.atan2(y - cy, x) - sp, ring = ((an / Math.PI * 4.5) % 1 + 1) % 1;   // кольца по кругу
      const rr = Math.hypot(x, y - cy) / r;
      return (ring < 0.12 ? -0.32 : 0) + (Math.floor(rr * 6 + ring * 3) % 2 && rr > 0.35 ? -0.06 : 0.04);
    } });
    pbBall(Q, r * 0.62 * Math.cos(sp), cy + r * 0.62 * Math.sin(sp), 2.4, 2, C.SK, { amb: 0.4 });   // кончик морды в шве
    if (P.bonk) for (let s = 0; s < 3; s++) { const an = s * 2.1 + P.bonk * 3; pbDot(Q, Math.cos(an) * 9, cy - r - 3 + Math.sin(an) * 2.4, [255, 242, 160], 0.6); }
    Q.outline([40, 30, 22]);
    return;
  }
  const leg = (x, ph, near) => {
    const fx = x + ph * 3 + lunge * 2, y0 = Y(-6), y1 = Y(-0.6);
    pbLimb(Q, x, y0, fx, y1, 2.6, 2.2, near ? C.SK : C.SK.slice(0, 3));
    for (let k = 0; k < 3; k++) Q.path([[fx + 1 + k * 1.1, y1, 0.7], [fx + 2.8 + k * 1.2, Y(0.3), 0.25]], () => C.CL[near ? 2 : 1]);   // когти-лопаты
  };
  leg(-9, -sw, false); leg(7, sw, false);
  // хвост в кольцах, сужается
  const tpts = []; for (let i = 0; i <= 6; i++) { const t = i / 6; tpts.push([-16 - t * 11, Y(-7 + t * 4 - Math.sin(t * 3) * 1.4), 3.2 * (1 - t * 0.75)]); }
  Q.path(tpts, (t, e) => pbPick(C.SH, (e ? 0.25 : 0.55) - (((t * 8) % 1) < 0.2 ? 0.25 : 0), 0.5));
  // панцирь: купол из колец, передний и задний щиты
  pbBall(Q, -1, Y(-11), 17, 10.5, C.SH, { amb: 0.5, clip: (x, y) => (P.dead ? y > Y(-11) - 0.5 : y < -6), tex: (x, y) => {
    const band = x > -9 && x < 7 ? (((x + 9) / 2.3) % 1) : -1;
    let v = band >= 0 && band < 0.18 ? -0.3 : 0;
    if (Q.hsh(Math.floor(x * 1.2) * 3.1 + Math.floor((y + 0.5) * 1.6)) > 0.5) v += 0.05;   // роговые щитки
    return v + (x < -9 || x > 7 ? -0.04 : 0);
  } });
  Q.path([[-17, Y(-6.2), 0.5], [15, Y(-6.2), 0.5]], () => C.SH[0]);                        // нижняя кромка
  // голова: рыльце вперёд, высокие уши, глазок
  const hx = 15 + lunge * 2.4 - P.curl * 3, hy = Y(-8 + (P.hurt > 0.5 ? 1 : 0));
  pbBall(Q, hx, hy, 4.2, 3.6, C.SK, { amb: 0.5 });
  pbPoly(Q, [[hx + 2, hy - 2.4], [hx + 10, hy - 0.4], [hx + 10, hy + 1.2], [hx + 2, hy + 2.6]], (x, y) => pbPick(C.SK, 0.62 - (y - hy + 2) / 5 * 0.35, Q.dth(x, y)));   // рыльце
  pbBall(Q, hx + 1, hy - 3.4, 3, 2.6, C.SH, { amb: 0.55 });                               // щиток на темени
  for (const [ex, ang] of [[-1.4, -1.9], [0.6, -1.6]]) Q.path([[hx + ex, hy - 3, 1.2], [hx + ex + Math.cos(ang) * 6, hy - 3 + Math.sin(ang) * 6, 0.5]], (t) => C.SK[t > 0.6 ? 3 : 2]);   // уши
  pbEye(Q, hx + 3, hy - 1, 0.8, P, [30, 20, 16], [8, 4, 2], C.SK[0]);
  pbDot(Q, hx + 10, hy + 0.4, C.SK[0], 0.4);                                              // нос
  if (P.mouth > 0.4) Q.path([[hx + 6, hy + 2, 0.4], [hx + 10, hy + 1.6, 0.4]], () => [60, 20, 20]);
  leg(-11, sw, true); leg(9, -sw, true);
  Q.outline([40, 30, 22]);
}
NA_PX.armad = (K, P) => pbArmad(pbScaled(K, 3 * NA_SPEC.armad.sc), P);

// ======================= Гномтавры: копейщик и лучник =======================
// Тело пони в яблоках (грудь, бочка, круп, четыре ноги с суставами и копытами, хвост), из холки растёт гном
// в кольчуге и кожаной куртке, борода до пояса, шлем с наносником. Копьё с листовидным жалом и флажком
// или длинный лук: на замахе тетива натянута к щеке, на ударе — стрела ушла.
const PBG = {
  CO: [[46, 30, 18], [80, 52, 32], [118, 82, 50], [156, 116, 74], [192, 154, 104]],
  MA: [[30, 20, 14], [52, 36, 24], [80, 58, 40]],
  HO: [[30, 26, 24], [58, 52, 48], [96, 90, 82]],
  SK: [[120, 76, 54], [168, 116, 86], [210, 160, 124], [236, 196, 160]],
  BE: [[120, 70, 30], [170, 110, 50], [214, 160, 80], [240, 206, 130]],
  MAIL: [[52, 54, 60], [88, 90, 96], [130, 132, 136], [176, 178, 180]],
  LE: [[50, 34, 20], [84, 58, 34], [120, 86, 52]],
  WO: [[60, 40, 22], [100, 70, 40], [140, 104, 62]],
};
function pbGnomtaur(Q, P, bow) {
  const C = PBG, sw = P.leg, a = P.a, open = P.mouth > 0.3;
  pbShadow(Q, 22);
  const legH = (x, ph, near, hind) => {                                                  // нога: плечо/бедро → колено → бабка → копыто
    const ramp = near ? C.CO : C.CO.slice(0, 3), kx = x + ph * 3.2 + (hind ? -1.2 : 0.6), ky = -9, fx = x + ph * 5.4;
    pbLimb(Q, x, -20, kx, ky, 3.4, 2, ramp);
    pbLimb(Q, kx, ky, fx, -2.4, 1.8, 1.5, ramp);
    pbBall(Q, kx, ky, 1.9, 1.6, ramp, { amb: 0.45 });                                      // сустав
    pbPoly(Q, [[fx - 1.8, -2.6], [fx + 2, -2.6], [fx + 2.4, 0.2], [fx - 2, 0.2]], C.HO);   // копыто
    Q.path([[fx - 1.6, -3, 0.6], [fx + 1.6, -3, 0.6]], () => C.MA[2]);                    // щётка над копытом
  };
  legH(-17, -sw, false, true); legH(6, sw, false, false);
  // хвост: длинный, волнистый
  for (let k = 0; k < 4; k++) { const pts = []; for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push([-22 - t * 9 - k * 0.6, -24 + t * 16 + Math.sin(t * 4 + sw + k) * 1.6, 1.6 * (1 - t * 0.6)]); } Q.path(pts, () => C.MA[k % 3]); }
  // туловище пони: круп, бочка в яблоках, грудь
  pbBall(Q, -16, -24, 8.4, 7.4, C.CO, { amb: 0.5 });
  pbBall(Q, -4, -23, 14, 7.6, C.CO, { amb: 0.48, tex: (x, y) => (Q.hsh(Math.floor(x / 2.4) * 7.3 + Math.floor(y / 2.4) * 1.9) > 0.82 ? 0.14 : 0) });
  pbBall(Q, 9, -25, 7.6, 7.2, C.CO, { amb: 0.55 });
  legH(-14, sw, true, true); legH(9, -sw, true, false);
  // гном: торс из холки
  const tx = 11, ty = -30;
  // дальняя рука
  const farAng = bow ? (a < -0.2 ? -0.4 : -0.1) : 1.1;
  const fex = tx - 4 + Math.cos(farAng + 0.5) * 5, fey = ty - 11 + Math.sin(farAng + 0.5) * 5, fhx = fex + Math.cos(farAng) * 5, fhy = fey + Math.sin(farAng) * 5;
  pbLimb(Q, tx - 4, ty - 11, fex, fey, 1.8, 1.6, C.MAIL.slice(0, 3)); pbLimb(Q, fex, fey, fhx, fhy, 1.6, 1.4, C.SK.slice(0, 3));
  pbPoly(Q, [[tx - 5.4, ty + 2], [tx + 5.4, ty + 2], [tx + 4.6, ty - 13], [tx - 4.6, ty - 13]], (x, y) => pbPick(C.MAIL, 0.55 + ((Math.floor(x * 1.4) + Math.floor(y * 1.4)) % 2) * 0.12 - (x - tx) / 12 * 0.3, Q.dth(x, y)));   // кольчуга
  pbPoly(Q, [[tx - 5, ty - 5], [tx + 5, ty - 5], [tx + 5.2, ty + 0.4], [tx - 5.2, ty + 0.4]], C.LE);   // кожаная куртка-пояс
  Q.path([[tx - 5, ty - 1.4, 0.6], [tx + 5, ty - 1.4, 0.6]], () => [150, 120, 60]);
  // голова: нос картошкой, борода до пояса, шлем с наносником
  const hx = tx + 1 + (a > 0.5 ? 1 : 0), hy = ty - 17;
  pbBall(Q, hx, hy, 3.8, 3.8, C.SK, { amb: 0.55 });
  for (let k = 0; k < 7; k++) { const x = hx - 3 + k; Q.path([[x, hy + 1, 1.2], [x + (k - 3) * 0.2 + Math.sin(k + sw) * 0.4, hy + 9 + (k % 3), 0.6]], (t) => C.BE[t > 0.6 ? 1 : 2 + (k % 2)]); }   // борода
  pbBall(Q, hx + 2.8, hy + 0.4, 1.6, 1.4, C.SK, { amb: 0.7 });                            // нос
  pbEye(Q, hx + 1.6, hy - 1.2, 0.6, P, [255, 250, 240], [30, 50, 80], C.SK[0]);
  if (open) pbDot(Q, hx + 1.6, hy + 2.6, [70, 20, 18], 0.6);
  pbBall(Q, hx - 0.2, hy - 2.6, 4.4, 3, C.MAIL, { amb: 0.6, clip: (x, y) => y < hy - 1.6 });   // шлем
  Q.path([[hx + 2.6, hy - 2, 0.6], [hx + 2.8, hy + 0.6, 0.5]], () => C.MAIL[2]);          // наносник
  pbDot(Q, hx - 0.2, hy - 5.8, C.MAIL[3], 0.6);
  // ближняя рука и оружие
  if (bow) {
    const draw = a < -0.2 ? Math.min(1, -a) : 0;                                           // натяжение
    const bxh = tx + 11, byh = ty - 10;                                                    // рука с луком вытянута вперёд
    pbLimb(Q, tx + 3, ty - 11, bxh - 3, byh, 1.8, 1.5, C.MAIL); pbBall(Q, bxh, byh, 1.4, 1.4, C.SK);
    const top = [bxh - 1.6, byh - 13], bot = [bxh - 1.6, byh + 13];
    const arc = []; for (let i = 0; i <= 10; i++) { const t = i / 10; arc.push([bxh + 2.2 * Math.sin(t * Math.PI) - 0.4, byh - 13 + t * 26, 0.9]); }
    Q.path(arc, (t) => pbPick(C.WO, 0.6 - Math.abs(t - 0.5) * 0.4, 0.5));
    const nx = bxh - 1.6 - draw * 9, ny = byh;
    Q.path([[top[0], top[1], 0.3], [nx, ny, 0.3], [bot[0], bot[1], 0.3]], () => [230, 226, 210]);   // тетива
    if (a < 0.5) { Q.path([[nx, ny, 0.4], [nx + 15, ny, 0.4]], () => C.WO[2]); pbPoly(Q, [[nx + 15, ny - 1], [nx + 18, ny], [nx + 15, ny + 1]], C.MAIL); for (const d of [-1, 1]) Q.path([[nx, ny, 0.3], [nx - 1.6, ny + d * 1.2, 0.3]], () => [200, 60, 50]); }
    pbLimb(Q, tx + 3, ty - 11, nx, ny - 0.4, 1.8, 1.5, C.MAIL.slice(0, 3)); pbBall(Q, nx, ny, 1.3, 1.3, C.SK);
  } else {
    const ang = pbArmAng(P), ex = tx + 3 + Math.cos(ang + 1.1) * 5, ey = ty - 11 + Math.sin(ang + 1.1) * 5, hx2 = ex + Math.cos(ang + 0.2) * 5, hy2 = ey + Math.sin(ang + 0.2) * 5;
    pbLimb(Q, tx + 3, ty - 11, ex, ey, 1.9, 1.7, C.MAIL); pbLimb(Q, ex, ey, hx2, hy2, 1.6, 1.4, C.SK); pbBall(Q, hx2, hy2, 1.4, 1.4, C.SK);
    const bx = Math.cos(ang - 0.6), by = Math.sin(ang - 0.6);
    Q.path([[hx2 - bx * 14, hy2 - by * 14, 0.6], [hx2 + bx * 20, hy2 + by * 20, 0.6]], () => C.WO[1]);   // древко
    const tx2 = hx2 + bx * 20, ty2 = hy2 + by * 20, px = -by, py = bx;
    pbPoly(Q, [[tx2 + px * 1.4, ty2 + py * 1.4], [tx2 + bx * 7, ty2 + by * 7], [tx2 - px * 1.4, ty2 - py * 1.4], [tx2 - bx * 1, ty2 - by * 1]], C.MAIL);   // жало
    pbPoly(Q, [[tx2 - bx * 2, ty2 - by * 2], [tx2 - bx * 3 + px * 3.4, ty2 - by * 3 + py * 3.4], [tx2 - bx * 5, ty2 - by * 5]], [[120, 30, 26], [170, 50, 36], [210, 80, 50]]);   // флажок
  }
  Q.outline([30, 22, 16]);
}
NA_PX.gtSpear = (K, P) => pbGnomtaur(pbScaled(K, 3 * NA_SPEC.gtSpear.sc), P, false);
NA_PX.gtBow = (K, P) => pbGnomtaur(pbScaled(K, 3 * NA_SPEC.gtBow.sc), P, true);

// ======================= Ледяной элементаль: два облика на выбор =======================
// A — кристаллический страж: тело из граней льда со светящимся сердцем, плечи-друзы, голова-алмаз, клинок-сосулька.
// B — дух вьюги: парящая ледяная ведьма в рваном инейном плаще, венец сосулек, обмороженное лицо-череп,
//     длинные когтистые пальцы, снизу плащ рассыпается в позёмку. В игре — FROST_LOOK (по выбору владельца).
let FROST_LOOK = 'A';
const PBI = {
  IC: [[24, 60, 104], [44, 96, 150], [80, 142, 196], [134, 196, 232], [196, 236, 252], [240, 252, 255]],
  GL: [[122, 240, 255], [220, 255, 255]],
  CL: [[20, 34, 60], [36, 60, 96], [64, 100, 146], [110, 152, 196], [170, 206, 236]],
};
// грань: многоугольник одним тоном (свет по наклону грани) с редкими искрами
function pbFacet(Q, pts, tone, ramp = PBI.IC) { pbPoly(Q, pts, (x, y) => pbPick(ramp, tone + (Q.hsh(Math.floor(x * 0.9) * 2.1 + Math.floor(y * 0.9)) > 0.9 ? 0.1 : 0), Q.dth(x, y))); }
function pbFrostA(Q, P) {
  const sw = P.leg, a = P.a;
  pbShadow(Q, 10);
  Q.R(-14, -3, 14, 1, (x, y) => { const d = (x / 14) ** 2 + ((y + 0.8) / 2.2) ** 2; return d < 1 && Q.dth(x, y) < 0.55 - d * 0.5 ? [230, 244, 255, 0.7] : null; }, false);   // позёмка
  // ноги-столбы
  for (const [s, near] of [[-1, false], [1, true]]) {
    const fx = s * 3.6 + s * sw * 2.6;
    pbFacet(Q, [[s * 2.4 - 2.6, -10], [s * 2.4 + 2.6, -10], [fx + 3, -1], [fx - 3, -1]], near ? 0.55 : 0.35);
    pbFacet(Q, [[s * 2.4 - 2.6, -10], [s * 2.4 - 0.4, -10], [fx - 0.2, -1], [fx - 3, -1]], near ? 0.75 : 0.5);
    pbFacet(Q, [[fx - 3.8, -1.2], [fx - 2, -3.4], [fx + 4.2, -1.6], [fx + 4.8, 0.4], [fx - 3.8, 0.4]], 0.62);
  }
  pbLimb(Q, -6.6, -21, -9 - (P.up > 0.5 ? 0 : 1), P.up > 0.5 ? -29 : -14, 2.2, 1.8, PBI.IC.slice(0, 4));   // дальняя рука
  // тело-призма: светлые грани слева, тёмные справа, трещины
  pbFacet(Q, [[-7.4, -9.5], [7.4, -9.5], [9.2, -18], [5, -27], [-5, -27], [-9.2, -18]], 0.5);
  pbFacet(Q, [[-7.4, -9.5], [-1.4, -9.5], [-1.6, -27], [-5, -27], [-9.2, -18]], 0.78);
  pbFacet(Q, [[1.6, -9.5], [7.4, -9.5], [9.2, -18], [5, -27], [2.4, -27]], 0.3);
  pbFacet(Q, [[-9.2, -18], [-5, -27], [-3, -23], [-6, -16]], 0.92);
  for (const pts of [[[-4, -26, 0.25], [-1, -19, 0.25], [-5, -13, 0.25]], [[3, -24, 0.25], [5, -18, 0.25]]]) Q.path(pts, () => PBI.IC[5]);
  // сердце: светится сквозь лёд
  Q.R(-6, -24, 6, -11, (x, y) => { const d = Math.hypot(x, y + 17.5) / 5.4; return d < 1 && Q.dth(x, y) < 0.7 - d * 0.6 ? [150, 240, 255, 0.85] : null; }, false);
  pbFacet(Q, [[0, -21.5], [2.6, -17.5], [0, -13.5], [-2.6, -17.5]], 0.9, [[180, 250, 255], [230, 255, 255], [255, 255, 255]]);
  pbDot(Q, 0, -17.5, PBI.GL[0], 0.8);
  // плечи-друзы
  for (const [s, tn] of [[-1, 0.8], [1, 0.45]]) for (const [dx, h, w] of [[0, 9, 1.6], [2.2, 6, 1.2], [-1.8, 5, 1]]) {
    const bx = s * (9 + dx * 0.4), by = -24;
    pbFacet(Q, [[bx - w, by], [bx + s * dx * 0.5, by - h], [bx + w, by]], tn + (dx ? -0.1 : 0.1));
  }
  // голова-алмаз с венцом шипов и глазами
  const hx = a > 0.5 ? 1.4 : 0, hy = -29 + (P.hurt > 0.5 ? 1 : 0);
  pbFacet(Q, [[hx - 4.6, hy - 1], [hx - 2.6, hy - 5.8], [hx + 2.6, hy - 5.8], [hx + 4.6, hy - 1], [hx, hy + 3.4]], 0.6);
  pbFacet(Q, [[hx - 4.6, hy - 1], [hx - 2.6, hy - 5.8], [hx - 0.4, hy - 5.8], [hx - 1, hy + 2.4]], 0.85);
  pbFacet(Q, [[hx + 0.6, hy - 5.8], [hx + 2.6, hy - 5.8], [hx + 4.6, hy - 1], [hx, hy + 3.4]], 0.35);
  for (const [dx, h] of [[-3.2, 5.5], [-1, 7.6], [1.2, 6.4], [3.4, 4.6]]) pbFacet(Q, [[hx + dx - 1, hy - 5.6], [hx + dx, hy - 5.6 - h], [hx + dx + 1, hy - 5.6]], 0.8);
  for (const ex of [-1.8, 2]) {
    if (P.eye >= 2) Q.path([[hx + ex - 1, hy - 1, 0.3], [hx + ex + 1, hy - 0.8, 0.3]], () => PBI.IC[0]);
    else { Q.R(hx + ex - 2, hy - 3, hx + ex + 2, hy + 1, (x, y) => (Math.hypot(x - hx - ex, y - hy + 1) < 1.9 && Q.dth(x, y) < 0.6 ? [122, 240, 255, 0.6] : null), false); pbDot(Q, hx + ex, hy - 1, PBI.GL[1], 0.7); }
  }
  // ближняя рука с клинком-сосулькой
  const th = P.up > 0.5 ? -2.9 : a > 0 ? 0.8 + a * 0.8 : 0.4 + a * 1.3;
  const ex = 6.4 + Math.sin(th) * 4.4, ey = -21 + Math.cos(th) * 4.4, hx2 = ex + Math.sin(th - 0.35) * 4.2, hy2 = ey + Math.cos(th - 0.35) * 4.2;
  pbLimb(Q, 6.4, -21, ex, ey, 2.4, 2, PBI.IC); pbLimb(Q, ex, ey, hx2, hy2, 2, 1.8, PBI.IC);
  const bx = Math.sin(th - 0.2), by = Math.cos(th - 0.2), L = P.b > 0.5 ? 6 : 12 + (a > 0.5 ? 2 : 0);
  pbFacet(Q, [[hx2 - by * 1.6, hy2 + bx * 1.6], [hx2 + bx * L, hy2 + by * L], [hx2 + by * 1.6, hy2 - bx * 1.6]], 0.85);
  pbFacet(Q, [[hx2, hy2], [hx2 + bx * L, hy2 + by * L], [hx2 + by * 1.6, hy2 - bx * 1.6]], 0.5);
  if (a > 0.5 || P.up > 0.5 || P.mouth > 0.7) for (const [dx, dy] of [[13, -14], [16, -19], [11, -9], [15, -8], [-12, -17]]) { Q.path([[dx - 1.2, dy, 0.25], [dx + 1.2, dy, 0.25]], () => PBI.IC[5]); Q.path([[dx, dy - 1.2, 0.25], [dx, dy + 1.2, 0.25]], () => PBI.IC[5]); }
  Q.outline([16, 36, 70]);
}
function pbFrostB(Q, P) {
  const a = P.a, ph = (P.y || 0) * 2 + P.leg * 1.5, wail = P.mouth > 0.4 || a > 0.5;
  pbShadow(Q, 9);
  // позёмка и снежный вихрь у земли: плащ рассыпается
  Q.R(-16, -12, 16, 1, (x, y) => { const d = (x / 16) ** 2 + ((y + 3) / 6) ** 2; return d < 1 && Q.dth(x * 1.3, y) < 0.6 - d * 0.55 ? [226, 242, 255, 0.75] : null; }, false);
  // плащ: колокол из инея, рваный низ, складки
  pbPoly(Q, [[-4, -36], [4, -36], [10, -16], [12, -6], [9, -3], [7, -7], [4, -2.5], [1, -6], [-2, -2], [-5, -6.5], [-8, -3], [-11, -7], [-10, -16]], (x, y) => {
    const fold = ((x * 0.9 + Math.sin(y * 0.3 + ph) * 0.8 + 20) % 3) < 0.6;
    return pbPick(PBI.CL, 0.72 - (y + 36) / 34 * 0.42 - (x + 10) / 22 * 0.18 + (fold ? -0.18 : 0), Q.dth(x, y));
  });
  for (const x of [-9, -6, -3, 0, 3, 6, 9]) Q.path([[x, -6 + Math.abs(x) * 0.15, 0.6], [x + 0.2, -2 + (x % 2 ? 1 : -0.5), 0.15]], () => PBI.IC[4]);   // сосульки по подолу
  // руки: тощие, длинные пальцы-когти, на замахе подняты
  for (const s of [-1, 1]) {
    const up = P.up > 0.5 || a < -0.3, hit = a > 0.5 && s > 0;
    const sx = s * 4.6, sy = -32, ex = s * (up ? 9 : 8), ey = up ? -38 : -24, hx = s * (up ? 11 : 10) + (hit ? 5 : 0), hy = up ? -45 : -16 + (hit ? -6 : 0);
    pbLimb(Q, sx, sy, ex, ey, 2, 1.4, PBI.CL);
    pbLimb(Q, ex, ey, hx, hy, 1.3, 1, PBI.IC.slice(1, 5));
    const fa = Math.atan2(hy - ey, hx - ex);
    for (let f = 0; f < 4; f++) { const an = fa + (f - 1.5) * 0.32; Q.path([[hx, hy, 0.45], [hx + Math.cos(an) * 3.2, hy + Math.sin(an) * 3.2, 0.35], [hx + Math.cos(an + s * 0.4) * 5.4, hy + Math.sin(an + s * 0.4) * 5.4, 0.12]], (t) => (t > 0.6 ? PBI.IC[5] : PBI.IC[3])); }
  }
  // капюшон из инея, венец сосулек
  pbPoly(Q, [[-6, -32], [-5.4, -40], [-2, -45], [2, -45], [5.4, -40], [6, -32], [3.4, -33], [0, -31], [-3.4, -33]], (x, y) => pbPick(PBI.CL, 0.5 - (x + 6) / 12 * 0.3 - (y + 45) / 13 * 0.15, Q.dth(x, y)));
  for (const [dx, h] of [[-4, 4], [-2.2, 6.4], [0, 8.4], [2.2, 6.4], [4, 4]]) pbFacet(Q, [[dx - 0.8, -44 + Math.abs(dx) * 0.4], [dx, -44 - h + Math.abs(dx) * 0.4], [dx + 0.8, -44 + Math.abs(dx) * 0.4]], 0.85);
  // лицо: обмороженный череп, глазницы с белым огнём, рот — чёрный провал
  const hy = -38;
  pbBall(Q, 0, hy, 3.4, 4, [[110, 150, 186], [170, 204, 228], [214, 236, 248], [244, 252, 255]], { amb: 0.55 });
  for (const s of [-1, 1]) {
    pbBall(Q, s * 1.4, hy - 0.6, 1.1, 1.2, [[6, 14, 30], [12, 26, 50]], { amb: 0.3 });
    if (P.eye < 2) { pbDot(Q, s * 1.4, hy - 0.6, [230, 255, 255], 0.45); Q.R(s * 1.4 - 2, hy - 3, s * 1.4 + 2, hy + 1, (x, y) => (Math.hypot(x - s * 1.4, y - hy + 0.6) < 1.8 && Q.dth(x, y) < 0.4 ? [190, 250, 255, 0.5] : null), false); }
    pbDot(Q, s * 2.2, hy + 1.4, [120, 160, 196], 0.4);                                   // впалые скулы
  }
  if (wail) { pbBall(Q, 0, hy + 2.6, 1.2, 1.4 + P.mouth, [[6, 10, 20], [20, 30, 50]], { amb: 0.3 }); for (const x of [-0.6, 0.2]) Q.path([[x, hy + 1.6, 0.18], [x + 0.2, hy + 2.3, 0.1]], () => [240, 250, 255]); }
  else Q.path([[-1.2, hy + 2.2, 0.2], [1.2, hy + 2.2, 0.2]], () => [12, 22, 40]);
  for (const [dx, dy] of [[-12, -30], [12, -34], [-14, -20], [13, -22], [0, -50]]) pbDot(Q, dx, dy, PBI.IC[5], 0.35);   // ледяные искры
  Q.outline([14, 30, 60]);
}
NA_PX.frost = (K, P) => (FROST_LOOK === 'B' ? pbFrostB : pbFrostA)(pbScaled(K, 3 * NA_SPEC.frost.sc), P);
// для листа выбора: оба облика отдельными видами
if (NA_SPEC.frost) {
  NA_SPEC.frostA = Object.assign({}, NA_SPEC.frost); NA_DRAW.frostA = NA_DRAW.frost; NA_PX.frostA = (K, P) => pbFrostA(pbScaled(K, 3 * NA_SPEC.frost.sc), P);
  NA_SPEC.frostB = Object.assign({}, NA_SPEC.frost); NA_DRAW.frostB = NA_DRAW.frost; NA_PX.frostB = (K, P) => pbFrostB(pbScaled(K, 3 * NA_SPEC.frost.sc), P);
}

// ======================= Эхо павших (echoart.js) =======================
// Призрак того, кем он был: полупрозрачное светящееся тело, хвост-дым вместо ног, пустые глазницы с искрой,
// борода. Убор и оружие — по классу героя или профессии гнома. Единицы — игровые пиксели (как ecPaint).
function pbTone(rgb, ks = [0.32, 0.52, 0.72, 0.9, 1.06]) {
  const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(rgb) || [0, 160, 160, 200], c = [+m[1], +m[2], +m[3]];
  return ks.map(k => c.map(v => Math.max(0, Math.min(255, Math.round(v * k + (k > 1 ? 40 : 0))))));
}
function pbHex(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function pbRampHex(h) { return pbTone(`rgb(${pbHex(h).join(',')})`, [0.4, 0.62, 0.82, 1, 1.12]); }
function pbEchoWeapon(Q, w, acc, ang, x, y) {
  const M = [[120, 140, 170], [180, 200, 220], [230, 240, 252], [255, 255, 255]], W = [[90, 70, 50], [140, 112, 80], [190, 160, 120]];
  const dx = Math.sin(ang), dy = -Math.cos(ang), px = -dy, py = dx;              // вдоль оружия «вверх» по руке
  const at = (a, b) => [x + dx * a + px * b, y + dy * a + py * b];
  const shaft = (a0, a1, r, ramp) => { const [x0, y0] = at(a0, 0), [x1, y1] = at(a1, 0); pbLimb(Q, x0, y0, x1, y1, r, r, ramp); };
  const ACC = acc && acc[0] === '#' ? pbRampHex(acc) : [[120, 60, 40], [170, 90, 60], [220, 130, 90]];
  switch (w) {
    case 'sword': shaft(-1, 2, 0.7, W); pbPoly(Q, [at(2, -1.8), at(2, 1.8), at(2.8, 1.8), at(2.8, -1.8)], ACC); pbPoly(Q, [at(2.8, -1), at(13, -0.6), at(15, 0), at(13, 0.6), at(2.8, 1)], (xx, yy) => pbPick(M, 0.7, Q.dth(xx, yy))); break;
    case 'axe': shaft(-2, 13, 0.6, W); pbPoly(Q, [at(9, 0.4), at(13.6, 1), at(13, 5.4), at(9.6, 5), at(10, 0.4)], M); break;
    case 'dagger': pbPoly(Q, [at(0.5, -0.8), at(7, 0), at(0.5, 0.8)], M); pbPoly(Q, [at(0, -1.4), at(0.6, -1.4), at(0.6, 1.4), at(0, 1.4)], ACC); break;
    case 'bow': { const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([...at(-9 + t * 18, -2 - Math.sin(t * Math.PI) * 3), 0.5]); } Q.path(pts, () => W[1]); Q.path([[...at(-9, -2), 0.18], [...at(9, -2), 0.18]], () => [230, 230, 220]); break; }
    case 'staff': shaft(-6, 16, 0.55, W); pbBall(Q, ...at(17.4, 0), 1.6, 1.6, ACC, { amb: 0.6 }); pbDot(Q, ...at(17.8, -0.4), [255, 255, 255], 0.3); break;
    case 'mace': shaft(-2, 8, 0.55, W); pbBall(Q, ...at(9.6, 0), 1.8, 1.8, M, { amb: 0.6 }); for (const s of [-1, 1]) pbPoly(Q, [at(9.2, s * 1.4), at(9.6, s * 2.8), at(10.2, s * 1.4)], M); break;
    case 'lute': shaft(2, 10, 0.5, W); pbBall(Q, ...at(0, 0), 2.6, 2.4, [[120, 80, 40], [170, 120, 70], [210, 160, 100]], { amb: 0.55 }); pbDot(Q, ...at(0.4, 0), [40, 30, 60], 0.6); break;
    case 'hammer': shaft(-2, 8, 0.55, W); pbPoly(Q, [at(8, -2.4), at(10.4, -2.4), at(10.4, 2.6), at(8, 2.6)], M); break;
    case 'pick': { shaft(-2, 9, 0.55, W); const pts = []; for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push([...at(8 + Math.sin(t * Math.PI) * 2.4, -4.6 + t * 9.2), 0.7 - Math.abs(t - 0.5) * 0.6]); } Q.path(pts, () => M[1]); break; }
    case 'saw': pbPoly(Q, [at(2, -1.4), at(11, -1.4), at(11, 2.8), at(2, 2.8)], M); for (let i = 0; i < 5; i++) pbPoly(Q, [at(2.6 + i * 1.8, 2.8), at(3.4 + i * 1.8, 3.8), at(4.2 + i * 1.8, 2.8)], M); shaft(-1, 2, 0.8, W); break;
    case 'scythe': { shaft(-4, 14, 0.55, W); const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([...at(14 + Math.sin(t * 2.2) * 1.6, -t * 7), 1 - t * 0.85]); } Q.path(pts, () => M[2]); break; }
    case 'pitch': shaft(-4, 14, 0.55, W); for (const b of [-1.2, 0, 1.2]) Q.path([[...at(14, b), 0.3], [...at(18, b), 0.25]], () => M[2]); Q.path([[...at(14, -1.4), 0.4], [...at(14, 1.4), 0.4]], () => M[1]); break;
    case 'tongs': for (const b of [-0.8, 0.8]) Q.path([[...at(-1, b), 0.35], [...at(9, b * 0.6), 0.35]], () => M[1]); pbBall(Q, ...at(10, 0), 1.6, 1.1, [[200, 80, 20], [255, 150, 60], [255, 220, 140]], { amb: 0.6 }); break;
    case 'cleaver': shaft(-1, 2, 0.6, W); pbPoly(Q, [at(2, -1), at(8.6, -1), at(8.2, 4), at(2, 3.6)], M); break;
    case 'pin': pbPoly(Q, [at(-2, -1.4), at(7, -1.4), at(7, 1.4), at(-2, 1.4)], [[180, 160, 120], [220, 200, 160], [240, 226, 196]]); break;
    case 'mug': pbPoly(Q, [at(-1, -2), at(4, -2), at(4, 2.4), at(-1, 2.4)], [[150, 100, 40], [200, 150, 70], [230, 190, 110]]); pbPoly(Q, [at(3.4, -2.2), at(5, -2.2), at(5, 2.6), at(3.4, 2.6)], [[240, 240, 230], [255, 255, 250]]); break;
    case 'sack': pbBall(Q, ...at(1.6, 0), 3.4, 3, [[160, 150, 120], [210, 200, 170], [236, 230, 210]], { amb: 0.55 }); break;
    case 'whip': { const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([...at(t * 8, Math.sin(t * 4) * 2 * t), 0.45 - t * 0.3]); } Q.path(pts, () => W[1]); break; }
    case 'lamp': Q.path([[...at(0, 0), 0.3], [...at(-3, 0), 0.3]], () => M[1]); pbPoly(Q, [at(-3, -2.4), at(-9, -2.2), at(-9, 2.2), at(-3, 2.4)], [[90, 90, 100], [140, 140, 150]]); pbBall(Q, ...at(-6, 0), 1.5, 2, [[255, 220, 120], [255, 244, 180], [255, 255, 230]], { amb: 0.7 }); break;
    default: pbBall(Q, x, y, 1.6, 1.5, M, { amb: 0.6 });                                 // кулак
  }
}
function pbEcho(Q, V, an, f) {
  if (V.wisp) {                                                                          // «Огонёк Лампы»: язычок пламени с глазками
    const bob = an === 'hov' ? Math.sin(f / 9 * 6.283) * 2 : 0, h = [10, 12, 13, 12, 11, 10, 12, 13, 11][an === 'hov' ? f : 0];
    pbPoly(Q, [[-4.6, -9 + bob], [-4, -10 - h * 0.6 + bob], [0, -12 - h + bob], [4, -10 - h * 0.6 + bob], [4.6, -9 + bob], [0, -6 + bob]], (x, y) => pbPick([[220, 100, 30], [255, 160, 50], [255, 210, 100], [255, 244, 190]], 0.9 - Math.hypot(x, y + 11 - bob) / 10, Q.dth(x, y)));
    for (const s of [-1, 1]) pbBall(Q, s * 1.5, -15 + bob, 0.7, 1, [[50, 20, 60], [80, 40, 90]], { amb: 0.4 });
    if (an === 'atk' && f >= 3 && f <= 5) pbPoly(Q, [[4, -20 + bob], [14, -20.6 + bob], [4, -17.6 + bob]], [[255, 220, 120], [255, 250, 200]]);
    Q.outline([120, 50, 20]);
    return;
  }
  const H = !!V.hero, T = pbTone(V.col), sw = H ? 6 : 5, bodyH = H ? 13 : 10, bodyY = -4 - bodyH;
  const bob = an === 'hov' ? Math.sin(f / 9 * 6.283) * 1.5 : an === 'hurt' ? [1, 2, 1, 0][f] : 0;
  const lean = an === 'atk' ? [0, -1, -1, -2, 1, 2, 2, 1][f] : an === 'hurt' ? -[1, 2, 1, 0][f] : 0;
  const arm = an === 'atk' ? [-0.5, -1.3, -2.1, -2.5, -0.5, 0.9, 1.3, 0.5][f] : -0.35 + (an === 'hov' ? Math.sin(f / 9 * 6.283 + 1) * 0.12 : 0);
  const ox = lean, oy = -4 + bob, X = x => x + ox, Y = y => y + oy;
  // хвост-дым: сужается, колышется, тает дизером
  const tw = an === 'hov' ? f : an === 'atk' ? f + 2 : 3;
  const tail = []; for (let i = 0; i <= 8; i++) { const t = i / 8; tail.push([X(Math.sin((tw + t * 6) / 9 * 6.283) * 2.4 * t), Y(-4 + t * 10), sw * (1 - t * 0.8)]); }
  Q.path(tail, (t, e, s) => (Q.dth(t * 40, s) < 1.05 - t * 0.9 ? pbPick(T, 0.62 - t * 0.35 + s * 0.0, 0.5) : null));
  // плащ героя за спиной
  if (H) pbPoly(Q, [[X(-sw - 0.6), Y(bodyY + 1)], [X(sw + 0.6), Y(bodyY + 1)], [X(sw + 1.6), Y(bodyY + bodyH + 1)], [X(sw - 1), Y(bodyY + bodyH + 3)], [X(-sw + 1), Y(bodyY + bodyH + 2)], [X(-sw - 1.8), Y(bodyY + bodyH + 3.4)]], pbRampHex(V.acc));
  // вторая рука (за телом)
  pbLimb(Q, X(-sw + 1), Y(bodyY + 2), X(-sw - 1.4), Y(bodyY + (H ? 9 : 8)), 1.4, 1.1, T.slice(0, 4));
  pbBall(Q, X(-sw - 1.4), Y(bodyY + (H ? 9.6 : 8.6)), 1.1, 1.1, T, { amb: 0.6 });
  // тело-балахон: шире к подолу, светлее слева, складки
  pbPoly(Q, [[X(-sw + 0.4), Y(bodyY)], [X(sw - 0.4), Y(bodyY)], [X(sw + 1.6), Y(bodyY + bodyH)], [X(-sw - 1.6), Y(bodyY + bodyH)]], (x, y) => {
    const fold = ((x - ox) * 1.1 + 20) % 3.2 < 0.5;
    return pbPick(T, 0.7 - (x - ox + sw) / (sw * 2) * 0.35 - (fold ? 0.12 : 0) + (y - oy - bodyY) / bodyH * 0.0, Q.dth(x, y));
  });
  Q.path([[X(-sw - 1), Y(bodyY + bodyH - 2.6), 0.4], [X(sw + 1), Y(bodyY + bodyH - 2.6), 0.4]], () => T[0]);   // пояс
  if (V.shield) pbPoly(Q, [[X(-sw - 5), Y(bodyY + 3)], [X(-sw + 1), Y(bodyY + 3)], [X(-sw + 0.6), Y(bodyY + 8)], [X(-sw - 2), Y(bodyY + 11)], [X(-sw - 4.6), Y(bodyY + 8)]], (x, y) => pbPick([[150, 170, 200], [200, 214, 236], [236, 244, 255]], 0.7 - (x - ox + sw + 5) / 6 * 0.3, Q.dth(x, y)));
  // голова: круглое лицо, пустые глазницы с искрой, борода клином
  const hy = bodyY - 7;
  pbBall(Q, X(0), Y(hy + 3.4), 4.2, 3.9, T, { amb: 0.6 });
  for (const ex of [-1.8, 1.8]) { pbBall(Q, X(ex), Y(hy + 2.9), 1.15, 1.2, [[24, 14, 40], [40, 26, 64]], { amb: 0.3 }); pbDot(Q, X(ex + 0.2), Y(hy + 2.6), [255, 255, 255], 0.3); }
  if (V.mask) pbPoly(Q, [[X(-4.2), Y(hy + 4)], [X(4.2), Y(hy + 4)], [X(4), Y(hy + 6)], [X(-4), Y(hy + 6)]], [[40, 30, 60], [64, 50, 90]]);
  else pbPoly(Q, [[X(-4.2), Y(hy + 5)], [X(-3.4), Y(hy + 8.6)], [X(0), Y(hy + (H ? 13 : 12))], [X(3.4), Y(hy + 8.6)], [X(4.2), Y(hy + 5)], [X(0), Y(hy + 6.2)]], (x, y) => pbPick([[190, 184, 220], [226, 222, 248], [246, 244, 255]], 0.75 - (y - oy - hy - 5) / 8 * 0.35 + (((x - ox) * 2 + 20) % 2 < 0.4 ? -0.15 : 0), Q.dth(x, y)));
  // убор
  const hd = V.head, A = V.acc ? pbRampHex(V.acc) : null, MET = [[130, 140, 160], [180, 190, 206], [224, 230, 240], [250, 252, 255]];
  if (H) {
    if (hd === 'helm') { pbBall(Q, X(0), Y(hy + 0.8), 5.2, 4, MET, { amb: 0.6, clip: (x, y) => y < Y(hy + 0.9) }); for (const s of [-1, 1]) pbPoly(Q, [[X(s * 4.2), Y(hy + 0.6)], [X(s * 5.2), Y(hy + 0.6)], [X(s * 5.2), Y(hy + 5)], [X(s * 4.4), Y(hy + 5)]], MET); Q.path([[X(0), Y(hy + 0.6), 0.45], [X(0), Y(hy + 4.4), 0.4]], () => MET[2]); pbBall(Q, X(0), Y(hy - 3.6), 1, 1.4, A, { amb: 0.6 }); }
    else if (hd === 'horns') { pbPoly(Q, [[X(-4), Y(hy - 1.6)], [X(4), Y(hy - 1.6)], [X(4), Y(hy + 1)], [X(-4), Y(hy + 1)]], [[150, 120, 80], [200, 170, 120]]); for (const s of [-1, 1]) { const pts = []; for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push([X(s * (3.6 + t * 4)), Y(hy - 0.6 - t * t * 6), 1.1 * (1 - t * 0.8)]); } Q.path(pts, (t) => pbPick([[180, 170, 140], [230, 222, 196], [250, 246, 230]], 0.8 - t * 0.3, 0.5)); } }
    else if (hd === 'hood') pbPoly(Q, [[X(-5.2), Y(hy + 6)], [X(-5), Y(hy - 0.4)], [X(-3), Y(hy - 4)], [X(0), Y(hy - 4.8)], [X(3), Y(hy - 4)], [X(5), Y(hy - 0.4)], [X(5.2), Y(hy + 6)], [X(3.4), Y(hy + 6)], [X(3.2), Y(hy + 0.4)], [X(0), Y(hy - 0.8)], [X(-3.2), Y(hy + 0.4)], [X(-3.4), Y(hy + 6)]], A);
    else if (hd === 'band') Q.path([[X(-4.2), Y(hy + 0.8), 0.5], [X(4.2), Y(hy + 0.8), 0.5], [X(5.6), Y(hy + 3.4), 0.4]], () => A[3]);
    else if (hd === 'feather') { pbBall(Q, X(0), Y(hy - 0.4), 5.4, 1.4, A, { amb: 0.55 }); pbBall(Q, X(0), Y(hy - 1.8), 3.2, 2.2, A, { amb: 0.6, clip: (x, y) => y < Y(hy - 0.8) }); Q.path([[X(2.6), Y(hy - 2.6), 0.6], [X(4.4), Y(hy - 6), 0.4], [X(3.6), Y(hy - 9.4), 0.15]], () => [250, 250, 255]); }
    else if (hd === 'wizard') { pbBall(Q, X(0), Y(hy), 6, 1.4, A, { amb: 0.55 }); pbPoly(Q, [[X(-4), Y(hy)], [X(-1.6), Y(hy - 5)], [X(2.4), Y(hy - 10.6)], [X(4.6), Y(hy - 10)], [X(3), Y(hy - 6)], [X(4), Y(hy)]], (x, y) => pbPick(A, 0.7 - (x - ox + 4) / 9 * 0.35, Q.dth(x, y))); pbDot(Q, X(-0.4), Y(hy - 3.4), [255, 240, 160], 0.5); }
    else if (hd === 'antler') { pbPoly(Q, [[X(-4), Y(hy - 0.8)], [X(4), Y(hy - 0.8)], [X(4), Y(hy + 1)], [X(-4), Y(hy + 1)]], [[80, 160, 100], [120, 200, 140]]); for (const s of [-1, 1]) { Q.path([[X(s * 3.2), Y(hy - 0.4), 0.5], [X(s * 5.6), Y(hy - 6), 0.35]], () => [232, 216, 184]); Q.path([[X(s * 4.8), Y(hy - 4), 0.35], [X(s * 7.6), Y(hy - 5), 0.25]], () => [232, 216, 184]); } }
    else if (hd === 'mitre') { pbPoly(Q, [[X(-3.2), Y(hy)], [X(-3), Y(hy - 4.6)], [X(0), Y(hy - 7.6)], [X(3), Y(hy - 4.6)], [X(3.2), Y(hy)]], [[210, 204, 180], [240, 236, 220], [252, 250, 244]]); Q.path([[X(0), Y(hy - 5), 0.5], [X(0), Y(hy - 0.4), 0.5]], () => A[2]); Q.path([[X(-1.6), Y(hy - 2.8), 0.4], [X(1.6), Y(hy - 2.8), 0.4]], () => A[2]); }
    if (V.halo) { const cy = hy - (hd === 'mitre' ? 9 : 6); Q.R(X(-6.6), Y(cy - 2.4), X(6.6), Y(cy + 2.4), (x, y) => { const d = ((x - X(0)) / 5.6) ** 2 + ((y - Y(cy)) / 1.7) ** 2; return d > 0.62 && d < 1.12 ? [255, 240, 160] : null; }); }
  } else {
    const cp = V.cap;
    if (cp === 'toque') { pbPoly(Q, [[X(-4), Y(hy - 2)], [X(4), Y(hy - 2)], [X(4), Y(hy + 0.4)], [X(-4), Y(hy + 0.4)]], [[220, 220, 220], [250, 250, 250]]); for (const x of [-3, 0, 3]) pbBall(Q, X(x), Y(hy - 4.6), 2.4, 2.4, [[200, 200, 210], [236, 236, 244], [255, 255, 255]], { amb: 0.6 }); }
    else if (cp === 'wizard') { const R2 = [[50, 40, 120], [80, 66, 160], [110, 96, 200]]; pbBall(Q, X(0), Y(hy), 5.2, 1.3, R2, { amb: 0.5 }); pbPoly(Q, [[X(-3.4), Y(hy)], [X(-0.4), Y(hy - 6)], [X(2.2), Y(hy - 9.6)], [X(2.4), Y(hy - 4)], [X(3.4), Y(hy)]], R2); pbDot(Q, X(0.4), Y(hy - 2.6), [255, 240, 160], 0.45); }
    else {                                                                                // гномий колпак цвета профессии
      const CR = typeof cp === 'string' && cp[0] === '#' ? pbRampHex(cp) : [[120, 40, 30], [170, 60, 40], [210, 90, 60]];
      pbPoly(Q, [[X(-5), Y(hy + 1)], [X(-4.4), Y(hy - 3.6)], [X(-1.4), Y(hy - 6.8)], [X(2.6), Y(hy - 8.4)], [X(5.4), Y(hy - 7.6)], [X(6), Y(hy - 5)], [X(4.2), Y(hy - 5.6)], [X(3.6), Y(hy - 3)], [X(5), Y(hy + 1)]], (x, y) => pbPick(CR, 0.72 - (x - ox + 5) / 11 * 0.35 - (y - oy - hy + 8) / 10 * 0.1, Q.dth(x, y)));
      Q.path([[X(-5), Y(hy + 0.6), 0.5], [X(5), Y(hy + 0.6), 0.5]], () => CR[CR.length - 1]);
      if (V.candle) { pbPoly(Q, [[X(0), Y(hy - 10)], [X(1.6), Y(hy - 10)], [X(1.6), Y(hy - 7.4)], [X(0), Y(hy - 7.4)]], [[220, 214, 196], [244, 240, 228]]); pbBall(Q, X(0.8), Y(hy - 11.4 - (f & 1) * 0.6), 0.8, 1.3, [[255, 170, 60], [255, 220, 120], [255, 250, 210]], { amb: 0.7 }); }
    }
  }
  // ближняя рука с оружием
  const sx = X(sw - 0.4), sy = Y(bodyY + 2), L1 = H ? 6.6 : 5.6, ex = sx - Math.sin(arm) * L1, ey = sy + Math.cos(arm) * L1;
  pbLimb(Q, sx, sy, ex, ey, 1.5, 1.2, T);
  pbEchoWeapon(Q, V.wpn, V.acc || V.cap, arm + (an === 'atk' ? 1.2 : 0.3 - arm) + Math.PI, ex, ey);
  pbBall(Q, ex, ey, 1.2, 1.2, T, { amb: 0.65 });
  // след удара
  if (an === 'atk' && f >= 4 && f <= 6) for (let i = 0; i < 16; i++) { const t = i / 15, a2 = -1.9 + t * (f - 3) * 0.9, r = H ? 15 : 12; pbDot(Q, sx + Math.cos(a2) * r, sy + Math.sin(a2) * r, [255, 255, 255], 0.35); }
  Q.outline(T[0]);
}
if (typeof ecSprite === 'function') {
  const _ec = ecSprite;
  ecSprite = function (V, an, f) {
    if (PX_FINE <= 1 || typeof fzPxKit !== 'function') return _ec(V, an, f);
    const key = V.key + '|px|' + an + '|' + f;
    let cv = EC_CACHE.get(key);
    if (cv) return cv;
    const K = fzPxKit(EC_W * 3, EC_H * 3, EC_OX * 3, EC_OY * 3), Q = pbScaled(K, 3);
    pbEcho(Q, V, an === 'in' || an === 'out' ? 'hov' : an, an === 'in' ? 0 : f);
    cv = K.done(); cv.fine = 3;
    if (an === 'in') {                                                                     // встаёт из земли: сдвиг вниз, ниже земли — срезано
      const sh = Math.round((1 - (f + 1) / 6) * 30 * 3), c2 = mkCanvas(cv.width, cv.height), o2 = c2.getContext('2d');
      o2.beginPath(); o2.rect(0, 0, cv.width, EC_OY * 3 + 1); o2.clip(); o2.drawImage(cv, 0, sh); cv = c2; cv.fine = 3;
    }
    if (an === 'out' || an === 'hurt') {
      const o = cv.getContext('2d');
      if (an === 'hurt') { o.globalCompositeOperation = 'source-atop'; o.fillStyle = `rgba(255,255,255,${[0.75, 0.5, 0.3, 0.1][f]})`; o.fillRect(0, 0, cv.width, cv.height); }
      else { const img = o.getImageData(0, 0, cv.width, cv.height), d = img.data, p = (f + 1) / 6; for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (d[(y * cv.width + x) * 4 + 3] && naHash(x >> 1, y >> 1) < p) d[(y * cv.width + x) * 4 + 3] = 0; o.putImageData(img, 0, 0); }
    }
    if (EC_CACHE.size >= EC_CACHE_MAX) EC_CACHE.delete(EC_CACHE.keys().next().value);
    EC_CACHE.set(key, cv);
    return cv;
  };
}

// ======================= Грифон (fairy1.js) =======================
// Орёл спереди, лев сзади: мощный львиный круп с мышцами и кисточкой хвоста, грудь в чешуе белых перьев,
// голова орла с хохлом и ушными пучками, загнутый золотой клюв, злой оранжевый глаз под надбровьем.
// Крылья — маховые перья с тёмными кончиками и ряды кроющих. Позы — griParams (как раньше), единицы — холст 62×60.
const PBR = {
  T: [[86, 52, 20], [130, 84, 34], [174, 120, 52], [214, 162, 86], [240, 204, 132]],
  WH: [[150, 140, 116], [200, 190, 164], [232, 226, 206], [250, 248, 240]],
  WB: [[52, 32, 16], [84, 54, 26], [122, 82, 40], [164, 116, 62], [204, 160, 100]],
  YE: [[150, 96, 10], [214, 150, 30], [246, 200, 70], [255, 236, 150]],
  DK: [[24, 16, 8], [50, 34, 18]],
};
function pbGriffin(Q, P) {
  const C = PBR, by = P.by, Y = y => y + 13 + by;
  const ty = y => y - P.tuck * Math.max(0, y - 33) * 0.75;
  const wing = (dx, dark) => {
    const sx = 22 + dx - 3, sy = Y(19 - 1);
    const W = dark ? C.WB.slice(0, 4) : C.WB;
    // маховые: длинные перья к опорным точкам, между ними — промежуточные; кончики темнее
    const tips = P.wing.map(([x, y]) => [x + dx, Y(y)]);
    pbBall(Q, sx, sy, 3.6, 2.4, W.slice(1), { amb: 0.5 });                                  // плечо крыла — под перьями
    for (let i = tips.length - 1; i >= 0; i--) {
      const [tx, tyy] = tips[i];
      for (const k of [0, 0.5]) {
        if (k && i === tips.length - 1) continue;
        const [nx, ny] = k ? [(tx + tips[i + 1][0]) / 2, (tyy + tips[i + 1][1]) / 2] : [tx, tyy];
        pbLimb(Q, sx, sy, nx, ny, 2.2, 0.7, W, { tex: (t) => (t > 0.78 ? -0.32 : t < 0.3 ? 0.08 : 0) });
      }
    }
    // кроющие: ряды коротких перьев у основания
    for (let r = 0; r < 2; r++) for (let i = 0; i < tips.length; i++) {
      const [tx, tyy] = tips[i], t = 0.32 + r * 0.18;
      pbLimb(Q, sx, sy, sx + (tx - sx) * t, sy + (tyy - sy) * t, 1.9 - r * 0.4, 0.8, W.slice(1), { amb: 0.6 - r * 0.1, tex: (tt) => (tt > 0.8 ? -0.2 : 0) });
    }
  };
  wing(-3, true);
  // хвост: львиный, с кисточкой
  const tw = P.tail, tl = P.tlift;
  Q.path([[8, Y(26), 1.8], [3 + tw * 0.5, Y(31 - tl * 0.4), 1.3], [4 + tw, Y(39 - tl), 1.1]], (t) => pbPick(C.T, 0.5 - t * 0.1, 0.5));
  pbBall(Q, 4 + tw, Y(41 - tl), 2.8, 3.2, [[40, 24, 10], [74, 46, 20], [104, 70, 34]], { amb: 0.5, tex: (x, y) => (Q.hsh(x * 3 + y) > 0.7 ? -0.15 : 0) });
  // дальняя задняя лапа
  pbLimb(Q, 14, Y(31), 13 + P.lr, Y(ty(38)), 2.4, 1.6, C.T.slice(0, 3));
  pbBall(Q, 14 + P.lr, Y(ty(42.6)), 3, 1.4, C.T.slice(0, 3), { amb: 0.4 });
  // львиное тело: круп, бочка, плечо; мышцы бедра, светлое брюхо
  pbBall(Q, 11, Y(30), 7, 6.8, C.T, { amb: 0.5, tex: (x, y) => (Math.hypot(x - 10, y - Y(31)) < 4.2 && Math.hypot(x - 10, y - Y(31)) > 3.4 ? -0.12 : 0) });
  pbBall(Q, 20, Y(29), 11.5, 6.6, C.T, { amb: 0.5 });
  pbBall(Q, 20, Y(33), 9, 2.4, C.T.slice(2), { amb: 0.4 });                                 // брюхо
  for (let k = 0; k < 4; k++) Q.path([[16 + k * 2.4, Y(26), 0.2], [15.6 + k * 2.4, Y(30), 0.2]], () => C.T[1]);   // рёбра под шкурой
  // ближняя задняя лапа: мощное бедро, скакательный сустав, лапа с подушечками
  const lx = -P.lr;
  pbBall(Q, 10, Y(32), 5, 5, C.T, { amb: 0.52 });
  pbLimb(Q, 10, Y(33), 8 + lx, Y(ty(38)), 3, 2, C.T);
  pbBall(Q, 8.6 + lx, Y(ty(42.6)), 3.6, 1.6, C.T, { amb: 0.45 });
  for (const x of [6.4, 8.6, 10.8]) pbDot(Q, x + lx, Y(ty(44)), C.DK[0], 0.4);
  // орлиная грудь и шея: чешуя перьев
  const hx = P.hx, hy = P.hy;
  pbLimb(Q, 28.6, Y(23.6), 34.6 + hx * 0.5, Y(14.6 + hy * 0.5), 5, 3.6, C.WH, { tex: (t, s) => ((Math.floor(t * 9 + s * 2) % 2) ? -0.12 : 0.04) });
  pbBall(Q, 28.6, Y(26), 5.8, 6, C.WH, { amb: 0.55, tex: (x, y) => (((Math.floor((x - 22) * 0.9) + Math.floor((y - Y(20)) * 0.7) * 2) % 3) === 0 ? -0.14 : 0) });
  // голова
  const HX = x => x + hx, HY = y => Y(y) + hy, bo = P.beak, hu = bo > 0.6 ? 1 : 0;
  pbBall(Q, HX(38), HY(12.2), 5.2, 4.8, C.WH, { amb: 0.6 });
  // хохол и ушные пучки, назад
  for (const [x0, y0, x1, y1, r] of [[34.5, 8.6, 30.6, 2.4 + hu, 1.4], [36.6, 7.8, 35.4, 1.4 + hu, 1.2], [35, 11, 30.4, 9.6, 1.2], [35.4, 13.4, 31, 14, 1]]) Q.path([[HX(x0), HY(y0), r], [HX(x1), HY(y1), 0.2]], (t) => C.WH[t > 0.6 ? 1 : 3]);
  // клюв: верхний крюк, нижняя челюсть; открыт — язык
  pbPoly(Q, [[HX(41), HY(9.2)], [HX(46.6), HY(10.4 - bo * 1.2)], [HX(49.4), HY(12.6 - bo * 1.6)], [HX(49.6), HY(16 - bo * 1.6)], [HX(47.6), HY(14.4 - bo * 1.2)], [HX(44), HY(14.6 - bo)], [HX(41.4), HY(13.6)]], (x, y) => pbPick(C.YE, 0.85 - (y - HY(9)) / 7 * 0.45, Q.dth(x, y)));
  pbDot(Q, HX(43.6), HY(11.4), C.YE[0], 0.4);                                               // ноздря
  if (bo > 0.15) { pbPoly(Q, [[HX(42), HY(14)], [HX(47.4), HY(14.4 - bo * 0.6)], [HX(47.6), HY(16.2 + bo * 1.8)], [HX(42.6), HY(16.4)]], [[60, 16, 10], [96, 30, 20]]); pbDot(Q, HX(45.6), HY(15.4 + bo * 0.5), [216, 86, 74], 0.6); }
  pbPoly(Q, [[HX(41.6), HY(14 + bo * 1.4)], [HX(46), HY(15.4 + bo * 2.6)], [HX(43.4), HY(17 + bo * 2.4)], [HX(41.4), HY(16 + bo * 1.4)]], C.YE.slice(0, 3));
  // глаз: оранжевый, зрачок, надбровье хмурится
  if (P.eye) { pbBall(Q, HX(39.4), HY(11.2), 1.6, 1.5, [[200, 90, 10], [240, 140, 30], [255, 190, 70]], { amb: 0.6 }); pbDot(Q, HX(39.7), HY(11.3), C.DK[0], 0.55); pbDot(Q, HX(39), HY(10.6), [255, 255, 255], 0.25); }
  else Q.path([[HX(38), HY(11.4), 0.4], [HX(41), HY(11.4), 0.4]], () => C.DK[0]);
  Q.path([[HX(36.8), HY(9 + (P.eye ? 0 : 1)), 0.9], [HX(41.8), HY(10 + (P.eye ? 0 : 1)), 0.6]], () => C.WB[1]);
  // передние лапы: орлиные, жёлтая чешуя, чёрные когти; в броске тянутся вперёд
  const fx = P.lf, cr = P.claw;
  pbBall(Q, 28.4, Y(31), 4, 3.4, C.WH, { amb: 0.55 });                                      // перьевые «штаны»
  pbLimb(Q, 29.4, Y(31), 29.6 + fx, Y(ty(38.6)), 1.8, 1.4, C.YE, { tex: (t) => ((t * 6) % 1 < 0.2 ? -0.18 : 0) });
  for (const [x, y] of [[35.4, 40.4], [33.4, 42.4], [29, 41.6]]) { const yy = ty(y) - cr * 6, xx = x + fx + cr * 3; Q.path([[31 + fx, Y(ty(39)), 0.9], [xx, Y(yy), 0.6]], () => C.YE[2]); Q.path([[xx, Y(yy), 0.6], [xx + 1.2, Y(yy + 0.8), 0.15]], () => C.DK[0]); }
  wing(0, false);
  Q.outline([42, 26, 10]);
}
if (typeof sprGriffin === 'function') {
  const _gri = sprGriffin;
  sprGriffin = function (pose, i = 0) {
    if (PX_FINE <= 1 || typeof fzPxKit !== 'function') return _gri(pose, i);
    const key = 'griPX' + pose + i;
    let cv = fyCache.get(key);
    if (cv) return cv;
    const K = fzPxKit(62 * 3, 60 * 3, 0, 0);
    pbGriffin(pbScaled(K, 3), griParams(pose, i));
    cv = K.done(); cv.fine = 3;
    fyCache.set(key, cv);
    return cv;
  };
}

// ======================= Море: глаз кракена и легендарный морской змей (seaart.js, A.px) =======================
const PBS = {
  SC: [[10, 40, 46], [18, 70, 72], [30, 104, 98], [56, 142, 120], [104, 186, 150], [170, 226, 190]],
  FIN: [[90, 24, 30], [150, 40, 44], [206, 78, 60], [240, 140, 90]],
  KR: [[34, 12, 30], [62, 22, 52], [96, 38, 78], [134, 62, 104], [172, 98, 132]],
  WA: [[216, 238, 244], [250, 254, 255]],
};
// пена и рябь вокруг того, что торчит из воды
function pbFoam(Q, x0, x1, y, k = 1) {
  Q.R(x0 - 1, y - 1, x1 + 1, y + 1, (x, yy) => {
    const t = (x - x0) / (x1 - x0), wv = y + Math.sin(x * 0.9) * 0.35;
    return t >= -0.04 && t <= 1.04 && Math.abs(yy - wv) < 0.45 && Q.dth(x * 2, yy) < 0.7 * k ? PBS.WA[Q.hsh(Math.floor(x * 0.6)) > 0.6 ? 1 : 0] : null;
  }, false);                                                                              // пена — пунктир без обводки
}
// Глаз кракена: из воды поднимается бугристый край головы с присосками, огромный жёлтый глаз с
// горизонтальным зрачком-щелью и кровавыми прожилками; в покое медленно щурится, на f = 3 моргает.
function pbKraEye(Q, a, f) {
  const blink = f === 3, sq = [1, 0.9, 0.8, 0, 0.85, 0.95][f % 6], C = PBS.KR;
  pbBall(Q, 0, -4, 20, 13, C, { amb: 0.42, clip: (x, y) => y < -1.2, tex: (x, y) => (Q.hsh(Math.floor(x * 1.3) * 3.7 + Math.floor(y * 1.3)) > 0.88 ? -0.22 : 0) });
  for (const [x, y, r] of [[-14, -6, 1.3], [-11, -10, 1], [13, -7, 1.2], [9, -11, 0.9], [-4, -12.6, 0.8], [16, -3.4, 1]]) { pbBall(Q, x, y, r + 0.5, r + 0.5, C.slice(2), { amb: 0.5 }); pbDot(Q, x, y, C[0], r * 0.5); }   // присоски
  // складки века вокруг глаза
  pbBall(Q, 1, -6.6, 10, 6.4 * Math.max(0.35, sq) + 1.2, C, { amb: 0.3 });
  if (!blink) {
    const ry = 5.2 * sq;
    pbBall(Q, 1, -6.6, 9, ry, [[150, 110, 10], [220, 170, 30], [255, 214, 70], [255, 240, 150]], { amb: 0.6, tex: (x, y) => {
      const d = Math.hypot((x - 1) / 9, (y + 6.6) / ry), an = Math.atan2(y + 6.6, x - 1);
      return (Math.abs(Math.sin(an * 7 + d * 3)) < 0.08 && d > 0.55 ? -0.4 : 0) + (d < 0.35 ? 0.12 : 0);   // радужка с прожилками
    } });
    Q.R(-5, -9 - ry * 0.3, 7, -4 + ry * 0.3, (x, y) => (Math.abs(y + 6.6) < 0.9 * sq + 0.25 && Math.abs(x - 1) < 6.4 - Math.abs(y + 6.6) * 2 ? [10, 4, 6] : null));   // зрачок-щель
    for (const [x0, y0, x1, y1] of [[-7.6, -7, -4.4, -6.2], [9, -8, 6.2, -7.4], [8.4, -4.6, 5.8, -5.6]]) Q.path([[x0, y0, 0.25], [x1, y1, 0.2]], () => [200, 40, 30]);   // кровавые жилки
    pbDot(Q, -2.6, -9.2, [255, 255, 240], 0.6);
  } else Q.path([[-8, -6.6, 0.6], [10, -6.6, 0.6]], () => C[0]);
  // щупальца по бокам: поднимаются из воды и загибаются к глазу
  for (const s of [-1, 1]) {
    const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10, cu = t > 0.6 ? (t - 0.6) * 2.5 : 0; pts.push([s * (22 - t * t * 11), -t * 24 + t * t * 4 + Math.sin(f * 1.1 + t * 3) * 0.8, 2.6 * (1 - t * 0.8)]); }
    for (let i = 1; i < pts.length; i++) pbLimb(Q, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], pts[i - 1][2], pts[i][2], C, { amb: 0.5 });
    for (let i = 1; i < 8; i += 2) pbDot(Q, pts[i][0] - s * pts[i][2] * 0.6, pts[i][1], C[4], 0.45);   // присоски с внутренней стороны
  }
  pbFoam(Q, -24, 24, -1);
  Q.outline([20, 6, 18]);
}
// Морской змей: легендарный, длиной с ладью. Три горба-кольца над водой с плавником-гребнем и шипами,
// чешуя бирюзовая с перламутром, голова дракона — рога, гребень-плавники, светящиеся глаза, пасть с клыками.
// swim — горбы ходят волной, atk — встаёт над водой и бьёт пастью, die — уходит под воду.
function pbSerpent(Q, a, f, n) {
  const ph = f / n * Math.PI * 2, C = PBS.SC;
  let rear = 0, sink = 0;
  if (a === 'atk') rear = f < 3 ? f * 6 : f < 6 ? 18 - (f - 3) * 4 : 6 - (f - 6) * 2;
  if (a === 'die') sink = f * 3.4;
  const W = 0;
  // тень под водой
  Q.R(-46, -3, 46, 3, (x, y) => (((x + 4) / 44) ** 2 + (y / 2.4) ** 2 < 1 && Q.dth(x, y) < 0.45 ? [6, 30, 40, 0.5] : null), false);
  const scaleTex = (x, y) => (((Math.floor(x * 1.1) + Math.floor(y * 1.6) * 2) % 3 === 0) ? -0.12 : 0) + (Q.hsh(Math.floor(x * 0.7) * 5.1 + Math.floor(y * 0.7)) > 0.9 ? 0.18 : 0);
  // хвост за кольцами
  Q.path([[-44, 0, 0.5], [-40, -1.2 - Math.max(0, Math.sin(ph + 2) * 2) + sink * 0.3, 1.6], [-36, 0, 2.4]], () => C[2]);
  pbPoly(Q, [[-46, -1], [-50, -6 + Math.sin(ph) * 2], [-44, -3]], PBS.FIN);
  // горбы-кольца: полуторы из воды, гребень, шипы, пена у основания
  for (let k = 0; k < 3; k++) {
    const hx = -30 + k * 17, hh = Math.max(0, (Math.sin(ph - k * 1.4) * 0.5 + 0.7) * 10 - sink), r = 6.6;
    if (hh <= 0.5) continue;
    pbBall(Q, hx, 0, r + 1, hh, C, { amb: 0.5, clip: (x, y) => y <= 0, tex: scaleTex });
    pbBall(Q, hx, -1, r - 1.6, hh * 0.45, C.slice(3), { amb: 0.4, clip: (x, y) => y <= 0 });   // светлое брюхо-кромка
    pbPoly(Q, [[hx - 5, -hh * 0.92], [hx - 3, -hh - 4.4], [hx - 0.6, -hh - 1.4], [hx + 1.4, -hh - 5], [hx + 3.4, -hh - 1.2], [hx + 5, -hh * 0.9]], (x, y) => pbPick(PBS.FIN, 0.75 + (y + hh) / 8 * 0.4 + (((x - hx) * 1.4 + 20) % 2 < 0.4 ? -0.25 : 0), Q.dth(x, y)));   // плавник-гребень
    pbFoam(Q, hx - r - 2, hx + r + 2, 0.2);
  }
  // шея и голова: изгиб из воды
  const nh = Math.max(0, 14 + rear - sink), bx = 26, hx = 34 + rear * 0.3, hy = -nh;
  const neck = []; for (let i = 0; i <= 8; i++) { const t = i / 8; neck.push([bx + (hx - 4 - bx) * t + Math.sin(t * Math.PI) * -3, -t * nh, 5.4 - t * 1.4]); }
  for (let i = 1; i < neck.length; i++) { const p0 = neck[i - 1], p1 = neck[i]; pbLimb({ ...Q, L: (x0, y0, x1, y1, r0, r1, fn, sol) => Q.L(x0, y0, x1, y1, r0, r1, (t, e, cr) => { const yy = y0 + (y1 - y0) * t; return yy > 0.3 ? null : fn(t, e, cr); }, sol) }, p0[0], p0[1], p1[0], p1[1], p0[2], p1[2], C, { tex: (t) => ((((i + t) * 1.6) % 1) < 0.18 ? -0.1 : 0) }); }   // шея над водой
  for (let i = 2; i < 8; i += 2) { const p = neck[i]; pbPoly(Q, [[p[0] - 3.4, p[1] - 1], [p[0] - 7, p[1] - 3], [p[0] - 3.6, p[1] + 1.2]], PBS.FIN); }   // гребень по шее
  // голова дракона
  const open = a === 'atk' && f >= 3 && f < 7 ? 1 : 0;
  pbBall(Q, hx, hy - 2, 6.4, 4.6, C, { amb: 0.55, tex: scaleTex });
  pbPoly(Q, [[hx + 2, hy - 5], [hx + 13, hy - 2.6 - open * 1.4], [hx + 13, hy + 0.2 - open * 1.4], [hx + 2, hy + 1]], (x, y) => pbPick(C, 0.7 - (y - hy + 5) / 6 * 0.4, Q.dth(x, y)));   // верхняя челюсть
  pbPoly(Q, [[hx + 2, hy + 1], [hx + 11, hy + 0.6 + open * 3], [hx + 10.4, hy + 2.6 + open * 4], [hx + 1, hy + 3]], C.slice(2));   // нижняя челюсть
  if (open) { pbPoly(Q, [[hx + 3, hy + 0.6], [hx + 12.4, hy - 0.4 - open * 1.4], [hx + 10.6, hy + 0.8 + open * 3], [hx + 3, hy + 2.4]], [[40, 6, 10], [90, 20, 24]]); for (let t = 0; t < 4; t++) { pbPoly(Q, [[hx + 5 + t * 2, hy - 0.2], [hx + 5.6 + t * 2, hy + 1.6], [hx + 6.2 + t * 2, hy - 0.2]], [[236, 236, 220], [255, 255, 250]]); pbPoly(Q, [[hx + 5 + t * 2, hy + 1.8 + open * 2], [hx + 5.6 + t * 2, hy + 0.4 + open * 2], [hx + 6.2 + t * 2, hy + 1.8 + open * 2]], [[220, 220, 200], [250, 250, 240]]); } }
  else for (let t = 0; t < 3; t++) pbPoly(Q, [[hx + 6 + t * 2.4, hy + 0.6], [hx + 6.6 + t * 2.4, hy + 2.6], [hx + 7.2 + t * 2.4, hy + 0.6]], [[236, 236, 220], [255, 255, 250]]);   // клыки торчат
  pbDot(Q, hx + 12, hy - 2, C[0], 0.4);                                                   // ноздря
  // глаз: светится янтарём, бровь-шип
  pbBall(Q, hx + 2.6, hy - 3.4, 1.5, 1.2, [[220, 140, 20], [255, 200, 60], [255, 240, 160]], { amb: 0.7 });
  Q.path([[hx + 2.4, hy - 4.4, 0.2], [hx + 2.6, hy - 2.4, 0.2]], () => [10, 6, 4]);
  Q.R(hx - 1, hy - 7, hx + 6, hy, (x, y) => (Math.hypot(x - hx - 2.6, y - hy + 3.4) < 3 && Q.dth(x, y) < 0.3 ? [255, 210, 80, 0.5] : null), false);
  // рога и плавники-уши
  for (const [ox, len, r] of [[-1, 9, 1.2], [-3.4, 7, 1]]) Q.path([[hx + ox, hy - 5, r], [hx + ox - len * 0.7, hy - 5 - len * 0.6, 0.3]], (t) => pbPick([[150, 140, 110], [210, 200, 170], [240, 236, 214]], 0.8 - t * 0.4, 0.5));
  pbPoly(Q, [[hx - 3, hy - 1], [hx - 10, hy - 4], [hx - 9, hy], [hx - 11, hy + 2.6], [hx - 3, hy + 1.4]], PBS.FIN);
  pbFoam(Q, bx - 7, bx + 6, 0.2, 1.2);
  if (a === 'atk' && f === 5) for (const [x, y] of [[44, -10], [46, -4], [40, -16], [48, -14]]) pbDot(Q, x, y, PBS.WA[1], 0.7);   // брызги удара
  Q.outline([6, 24, 30]);
}
if (typeof SEA_ART !== 'undefined') {
  Object.assign(SEA_ART.kraeye, { px: pbKraEye, pw: 56, ph: 34, pax: 28, pay: 28 });
  Object.assign(SEA_ART.serpent, { px: pbSerpent, pw: 112, ph: 64, pax: 54, pay: 44 });
}
