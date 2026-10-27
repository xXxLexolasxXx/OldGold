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
    if (o.fade && d > 1 - o.fade && K.dth(x, y) < (d - (1 - o.fade)) / o.fade) return null;   // мягкий край дизером — вплавляется в соседнюю форму
    const nz = Math.sqrt(1 - d);
    let v = amb + (nx * PB_L[0] + ny * PB_L[1] + nz * PB_L[2]) * 0.62;
    if (o.tex) v += o.tex(x, y, v);
    if (d > 0.86 && o.rim) v -= 0.12;                    // тёмный ободок — только по просьбе: иначе на стыках форм видны швы
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
// конечность одной формой по ломаной [[x, y, r], …]: каждый пиксель берёт ближайший участок оси —
// плечо, локоть и кисть (бедро, колено, щиколотка) сливаются без шва и без «шарниров»
function pbChain(K, pts, ramp, o = {}) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y, r] of pts) { x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r); }
  const amb = o.amb ?? 0.45;
  K.R(x0 - 1, y0 - 1, x1 + 1, y1 + 1, (xx, yy) => {
    const px = xx + 0.5, py = yy + 0.5;
    let best = 1e9, bs = 0, blit = 0, bt = 0, bi = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay, ar] = pts[i - 1], [bx, by, brr] = pts[i], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, len = Math.sqrt(l2);
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)), ex = px - ax - dx * t, ey = py - ay - dy * t, r = ar + (brr - ar) * t, d = Math.hypot(ex, ey);
      const sd = d - r;                                                         // знаковое расстояние до поверхности
      if (sd < best) { best = sd; const nx = dy / len, ny = -dx / len; bs = (ex * nx + ey * ny) / Math.max(0.5, r); blit = nx * PB_L[0] + ny * PB_L[1]; bt = (i - 1 + t) / (pts.length - 1); bi = i; }
    }
    if (best > 0) return null;
    const s = Math.max(-1, Math.min(1, bs));
    let v = amb + s * blit * 0.55 + Math.sqrt(Math.max(0, 1 - s * s)) * 0.2;
    if (o.tex) v += o.tex(bt, s, xx, yy);
    return pbPick(ramp, v, K.dth(xx, yy));
  });
}
// «Глина»: тело из слитых форм с общим светом. prims — эллипсы {e: [x, y, rx, ry]} и цепочки {c: [[x, y, r], …]}.
// Поле расстояний сливается мягким минимумом (k — радиус слияния), нормаль берётся из градиента поля,
// поэтому шея перетекает в плечи, руки — в туловище, без швов и ободков. o.tex(x, y, v) — пятна, складки.
function pbBlob(K, prims, ramp, o = {}) {
  const k = o.k ?? 4, amb = o.amb ?? 0.46, D = o.depth ?? 10;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const P = prims.map(p => {
    if (p.e) { const [x, y, rx, ry] = p.e; x0 = Math.min(x0, x - rx); x1 = Math.max(x1, x + rx); y0 = Math.min(y0, y - ry); y1 = Math.max(y1, y + ry); return p; }
    for (const [x, y, r] of p.c) { x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r); }
    return p;
  });
  const sdf = (px, py) => {
    let f = 1e9;
    for (const p of P) {
      let d;
      if (p.e) { const [x, y, rx, ry] = p.e, nx = (px - x) / rx, ny = (py - y) / ry; d = (Math.sqrt(nx * nx + ny * ny) - 1) * Math.min(rx, ry); }
      else {
        d = 1e9;
        for (let i = 1; i < p.c.length; i++) {
          const [ax, ay, ar] = p.c[i - 1], [bx, by, br] = p.c[i], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
          const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
          d = Math.min(d, Math.hypot(px - ax - dx * t, py - ay - dy * t) - (ar + (br - ar) * t));
        }
      }
      const h = Math.max(0, Math.min(1, 0.5 + 0.5 * (d - f) / k));          // мягкий минимум (полиномиальный)
      f = d * (1 - h) + f * h - k * h * (1 - h);
    }
    return f;
  };
  const e = 0.6;
  K.R(x0 - k, y0 - k, x1 + k, y1 + k, (xx, yy) => {
    const px = xx + 0.5, py = yy + 0.5, f = sdf(px, py);
    if (f > 0) return null;
    let gx = sdf(px + e, py) - sdf(px - e, py), gy = sdf(px, py + e) - sdf(px, py - e);
    const gl = Math.hypot(gx, gy) || 1; gx /= gl; gy /= gl;
    const depth = Math.min(1, -f / D), edge = 1 - depth;                       // у края нормаль «ложится» вбок, в глубине смотрит на зрителя
    let v = amb + (gx * PB_L[0] + gy * PB_L[1]) * 0.6 * edge + Math.sqrt(depth) * 0.22;
    if (o.tex) v += o.tex(xx, yy, v);
    return pbPick(ramp, v, K.dth(xx, yy));
  });
}
// сустав: шар с тем же светом, что у цилиндров pbLimb, — закрывает шов на локте/колене, без перелома тона
function pbJoint(K, x, y, r, ramp, amb = 0.45) {
  K.R(x - r, y - r, x + r, y + r, (xx, yy) => {
    const dx = (xx + 0.5 - x) / r, dy = (yy + 0.5 - y) / r, d = dx * dx + dy * dy;
    if (d > 1) return null;
    return pbPick(ramp, amb + (dx * PB_L[0] + dy * PB_L[1]) * 0.55 + Math.sqrt(1 - d) * 0.2, K.dth(xx, yy));
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
// рука по двум звеньям от плеча (sx, sy) к цели (tx, ty): локоть сгибается в сторону bend (+1 — вниз-назад)
function pbIK(sx, sy, tx, ty, l1, l2, bend = 1) {
  const dx = tx - sx, dy = ty - sy, d = Math.min(Math.hypot(dx, dy), l1 + l2 - 1), a0 = Math.atan2(dy, dx);
  const ca = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))), a1 = a0 + bend * Math.acos(ca);
  const ex = sx + Math.cos(a1) * l1, ey = sy + Math.sin(a1) * l1, hx = sx + Math.cos(a0) * d, hy = sy + Math.sin(a0) * d;
  return { sx, sy, ex, ey, hx, hy, a2: Math.atan2(hy - ey, hx - ex) };
}
// сплющить рисунок по высоте к земле (y = 0): sy < 1 — тело заваливается навзничь, от зрителя
function pbSquashY(K, sy) {
  const Q = {
    W: K.W, H: K.H, cv: K.cv, hsh: K.hsh, done: K.done, outline: K.outline,
    dth: (x, y) => K.dth(x, y * sy),
    R(x0, y0, x1, y1, f, sol = true) { K.R(x0, Math.floor(y0 * sy), x1, Math.ceil(y1 * sy), (X, Y) => f(X, (Y + 0.5) / sy - 0.5), sol); },
    P(x, y, col, a = 1, sol = true) { K.P(x, Math.round(y * sy), col, a, sol); },
    L(x0, y0, x1, y1, r0, r1, f, sol = true) {
      const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1, rm = Math.max(r0, r1) + 1;
      Q.R(Math.min(x0, x1) - rm, Math.min(y0, y1) - rm, Math.max(x0, x1) + rm, Math.max(y0, y1) + rm, (x, y) => {
        const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / l2)), ex = x - x0 - dx * t, ey = y - y0 - dy * t, r = r0 + (r1 - r0) * t, d = Math.sqrt(ex * ex + ey * ey);
        return d <= r ? f(t, d > r - 1, ex * dy - ey * dx) : null;
      }, sol);
    },
    path(pts, f, sol = true) { for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], n = pts.length - 1; Q.L(a[0], a[1], b[0], b[1], a[2], b[2], (t, e, sd) => f((i - 1 + t) / n, e, sd), sol); } },
  };
  return Q;
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
    pbBlob(K, [{ c: [[hx, -66, 12], [kx, ky, 10], [fx, ay, 8]] }, { e: [fx + 6, -4, 13, 5.5] }], ramp, { amb: 0.44, k: 4 });
    for (let k = 0; k < 4; k++) pbLimb(K, kx - 9 + k * 0.5, ky + 8 + k * 6, kx + 9 - k * 0.3 + (fx - kx) * 0.2, ky + 10 + k * 6, 1.6, 1.6, C.LE, { amb: 0.5 - k * 0.04 });   // обмотки
    pbPoly(K, [[kx - 4, ky - 6], [kx + 7, ky - 7], [kx + 9, ky + 2], [kx + 4, ky + 7], [kx - 3, ky + 4]], (x, y) => pbPick(C.IR, 0.62 - (y - ky + 7) / 14 * 0.35 - (x - kx) / 14 * 0.15, K.dth(x, y)));   // наколенник-пластина
    pbDot(K, kx - 2, ky - 3, C.IR[4]); pbDot(K, kx + 4, ky + 3, C.RU[2], 1.2);
    for (let t = 0; t < 4; t++) { const tx = fx + 10 + t * 3.2; K.path([[tx, -3, 1.6], [tx + 3.4, 0, 0.6]], () => C.BO[t % 2 ? 1 : 2]); }   // когти
  };
  leg(-14, -1, C.SK2);
  // ---- кожаная юбка-полосы между ног
  for (let k = 0; k < 6; k++) { const x = -18 + k * 7.4; pbPoly(K, [[x, -66], [x + 7, -66], [x + 6 + sw * 2, -44 + (k % 2) * 4], [x + 1 + sw * 2, -44 + (k % 2) * 4]], C.LE); pbDot(K, x + 3.5, -62, C.IR[3]); }
  leg(8, 1, C.SK);
  // ---- дальняя рука со щитом из бочки
  const sx0 = -16, sy0 = -108, ex0 = -24 - a * 2, ey0 = -86 + (P.b ? -8 : 0), hx0 = -14 + (P.b ? 14 : 0), hy0 = -70 + (P.b ? -16 : 0);
  pbChain(K, [[sx0, sy0, 10], [ex0, ey0, 8.8], [hx0, hy0, 7.5]], C.SK2);
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
  pbBlob(K, [{ e: [-18, -108, 22, 20] }, { e: [4, -86, 31, 27] }], C.SK, { amb: 0.44, k: 10, depth: 16, tex: (x, y) => (K.hsh(x * 0.31 + y * 7.1) > 0.94 ? -0.22 : 0) });   // горб и пузо одной формой
  K.R(-42, -132, 4, -92, (x, y) => { const d = ((x + 18) / 24) ** 2 + ((y + 110) / 22) ** 2; return d < 1 && y < -100 + Math.sin(x * 0.7) * 4 ? pbPick([[46, 32, 20], [74, 52, 32], [104, 76, 48]], 0.5 - (y + 120) / 40 + (K.hsh(x * 3.1) - 0.5) * 0.4, K.dth(x, y)) : null; });   // шкура-накидка
  for (let k = 0; k < 4; k++) K.path([[-34 + k * 9, -122 + Math.abs(k - 1.5) * 3, 2.4], [-38 + k * 9, -136 + Math.abs(k - 1.5) * 3, 0.5]], () => PBC.IR[3]);   // шипы
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
  pbBlob(K, [{ e: [hx, hy, 18, 17] }, { e: [hx + 6, hy + 8, 12, 8] }, { c: [[hx - 12, hy + 6, 8], [hx - 4, hy + 10, 9]] }], C.SK, { amb: 0.5, k: 5, depth: 12, tex: (x, y) => (K.hsh(x * 0.7 + y * 3.1) > 0.96 ? -0.26 : 0) });   // голова, челюсть, шея
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
  pbBlob(K, [{ c: [[shX + 2, shY + 6, 11], [(shX + elx) / 2, (shY + ely) / 2 + 3, 10.4], [elx, ely, 8.6], [fx, fy, 8]] }, { e: [fx, fy, 8, 7.5] }], C.SK, { amb: 0.48, k: 4 });   // бицепс → локоть → предплечье
  pbLimb(K, elx + (fx - elx) * 0.35, ely + (fy - ely) * 0.35, fx, fy, 9.5, 9, C.LE, { amb: 0.5 });   // наруч
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
  troll: { TK: [[86, 70, 38], [140, 120, 76], [194, 178, 128], [234, 224, 186]], HR: [[16, 12, 8], [38, 28, 16], [64, 48, 26], [96, 74, 40], [134, 108, 62]], SK: [[30, 52, 26], [52, 82, 40], [80, 116, 58], [112, 150, 78], [150, 184, 108]], BE: [[96, 112, 62], [130, 150, 90], [164, 184, 120]], HA: [[24, 40, 18], [40, 64, 28], [62, 92, 40]], CL: [[52, 32, 18], [82, 54, 30], [114, 80, 46]], NA: [[176, 160, 110], [216, 206, 160]], wpn: 'club' },
  trollS: { TK: [[72, 68, 62], [116, 110, 100], [162, 156, 144], [206, 200, 188]], HR: [[20, 16, 14], [40, 32, 26], [64, 52, 42], [92, 78, 64], [126, 110, 92]], SK: [[44, 44, 44], [72, 72, 70], [104, 104, 100], [138, 138, 132], [176, 174, 166]], BE: [[118, 114, 104], [150, 146, 134], [180, 176, 164]], HA: [[42, 42, 40], [62, 62, 58], [86, 86, 80]], CL: [[60, 46, 34], [90, 72, 52], [120, 98, 72]], NA: [[160, 150, 130], [204, 196, 176]], wpn: 'rock', moss: [[70, 100, 50], [104, 138, 70]] },
  trollB: { TK: [[62, 74, 40], [112, 122, 78], [166, 172, 124], [210, 214, 172]], HR: [[14, 16, 6], [32, 36, 14], [54, 60, 22], [82, 88, 34], [116, 120, 52]], SK: [[22, 46, 42], [40, 74, 66], [62, 104, 92], [90, 136, 120], [126, 168, 150]], BE: [[84, 116, 96], [114, 146, 122], [144, 176, 150]], HA: [[20, 40, 30], [34, 62, 46], [52, 88, 62]], CL: [[46, 54, 34], [70, 82, 50], [98, 112, 70]], NA: [[170, 178, 140], [210, 216, 180]], wpn: 'snag', slime: [[110, 170, 70], [160, 214, 100]] },
};
// ---- помощники тролля (вид сбоку и анфас)
// прядь: изогнутый сужающийся жгут с бороздками и бликом по верхней стороне. dread — почти без сужения (дреды каменного)
function pbTrLock(K, x, y, ang, len, w0, curl, ramp, dread = false) {
  const pts = [], n = 7; let px = x, py = y, aa = ang;
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push([px, py, dread ? w0 * (1 - t * 0.3) : w0 * (1 - t * 0.88) + 0.5]); aa += curl / n; px += Math.cos(aa) * len / n; py += Math.sin(aa) * len / n; }
  pbChain(K, pts, ramp, { amb: 0.5, tex: (t, sd) => (Math.abs(Math.sin(sd * (dread ? 5 : 8) + t * 3)) < 0.22 ? -0.2 : 0) + (t > 0.8 ? -0.08 : 0) });
  const nx = Math.sin(ang), ny = -Math.cos(ang), hw = w0 * 0.35;
  K.path(pts.slice(1, 5).map(([qx, qy, r], i) => [qx + nx * hw * (1 - i * 0.2) * Math.sign(ny || 1), qy - Math.abs(ny) * hw, Math.max(0.6, r * 0.18)]), () => ramp[ramp.length - 1], false);
  return pts[n];
}
function pbTrTip(K, T, kind, e, r) {                                                                   // что на кончиках: камень-бусина / капля тины
  if (kind === 'trollS') pbBall(K, e[0], e[1], r + 1.6, r + 0.8, [[70, 60, 46], [110, 96, 74], [150, 134, 104], [186, 172, 140]], { amb: 0.5 });
  else if (kind === 'trollB') K.path([[e[0], e[1], 1.6], [e[0] + 0.5, e[1] + 6, 1.1], [e[0], e[1] + 10, 0.5]], (tt) => T.slime[tt > 0.5 ? 0 : 1]);
}
// клык-бивень: толстый у десны, с кольцами-бороздками, бликом по кромке и тёмным кончиком; mir = −1 — зеркально
function pbTrTusk(K, T, kind, bx, by, ang, len, w0, curl, mir = 1) {
  const pts = []; let px = bx, py = by, aa = ang;
  for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push([px, py, w0 * (1 - t * 0.82) + 0.4]); aa += curl / 6; px += Math.cos(aa) * len / 6; py += Math.sin(aa) * len / 6; }
  pbChain(K, pts, T.TK, { amb: 0.55, tex: (t) => (((t * 5.5) % 1) < 0.13 && t < 0.75 ? -0.22 : 0) + (t < 0.15 ? -0.2 : 0) + (kind === 'trollS' && t > 0.55 && t < 0.62 ? -0.35 : 0) });
  K.path([pts[1], pts[2], pts[4]].map(([x, y, r]) => [x + 0.8 * mir, y - 0.6, Math.max(0.6, r * 0.25)]), () => T.TK[3], false);   // блик по кромке
  const [ex, ey] = pts[6]; K.P(ex, ey, T.TK[0]); K.P(ex - 0.5 * mir, ey + 0.8, T.TK[1]);                                           // потемневший кончик
  if (kind === 'trollB') K.path([[bx + 2 * mir, by + 1, 1.2], [bx + 2.5 * mir, by + 7, 0.9], [bx + 2 * mir, by + 10, 0.4]], (tt) => T.slime[tt > 0.5 ? 0 : 1]);
}
// оружие в кулаке (whx, why), направленное под углом wd: дубина / валун / коряга
function pbTrWeapon(K, T, whx, why, wd) {
  const bx = Math.cos(wd), by = Math.sin(wd), WO = PBC.WO;
  if (T.wpn === 'club') {
    const tx = whx + bx * 110, ty = why + by * 110;
    pbLimb(K, whx - bx * 18, why - by * 18, tx, ty, 6, 16, WO, { tex: (t) => (((t * 30) % 1) < 0.12 ? -0.2 : 0) });
    for (const t of [0.45, 0.7, 0.85]) pbBall(K, whx + bx * 110 * t + by * 12, why + by * 110 * t - bx * 12, 4, 4, WO, { amb: 0.5 });
    for (const [t, r] of [[0.92, 1], [0.8, -1]]) K.path([[whx + bx * 110 * t, why + by * 110 * t, 2], [whx + bx * 110 * t + by * 10 * r, why + by * 110 * t - bx * 10 * r, 1]], () => [180, 176, 160]);
  } else if (T.wpn === 'rock') {
    // валун: крупный, гранёный — плоскости сколов со своим светом, трещины, мох и лишайник
    const R = [[44, 40, 36], [72, 66, 58], [104, 96, 84], [138, 128, 112], [172, 162, 142], [204, 196, 176]], cx = whx + bx * 30, cy = why + by * 30 - 6, rx = 44, ry = 38;
    const facets = [[-0.9, -0.5, 0.82], [0.1, -0.95, 0.74], [0.8, -0.4, 0.5], [-0.7, 0.5, 0.42], [0.5, 0.7, 0.24], [0, 0, 0.6]];
    K.R(cx - rx, cy - ry, cx + rx, cy + ry, (x, y) => {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d = nx * nx + ny * ny, wob = 1 + Math.sin(Math.atan2(ny, nx) * 5) * 0.06 + Math.sin(Math.atan2(ny, nx) * 9) * 0.03;
      if (d > wob * wob) return null;
      let best = 0, bd = 9; for (let i = 0; i < facets.length; i++) { const [fx, fy] = facets[i], dd = (nx - fx * 0.6) ** 2 + (ny - fy * 0.6) ** 2; if (dd < bd) { bd = dd; best = i; } }
      let v = facets[best][2] + (K.hsh(Math.floor(x / 3) * 7.1 + Math.floor(y / 3) * 2.9) - 0.5) * 0.14;
      if (Math.abs(Math.sin(nx * 7 + ny * 3) + Math.sin(ny * 6 - nx * 2)) < 0.05 && d < 0.8) v -= 0.4;   // трещины
      if (d > 0.82 * wob * wob) v -= 0.12;
      return pbPick(R, v, K.dth(x, y));
    });
    for (const [mx, my, r] of [[-20, -26, 12], [8, -32, 9], [-32, -6, 7]]) pbBall(K, cx + mx, cy + my, r * 1.3, r * 0.8, T.moss, { amb: 0.55, fade: 0.55 });   // мох на макушке
    for (const [lx, ly] of [[18, 4], [-6, 14], [26, -14], [-26, 18]]) pbDot(K, cx + lx, cy + ly, [196, 186, 120], 2);                       // лишайник
  } else {
    // коряга: длинная, узловатая, с сучьями-рогатинами, корешками и висящей тиной
    const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([whx - bx * 14 + bx * 160 * t + Math.sin(t * 9) * 9 * t, why - by * 14 + by * 160 * t + Math.cos(t * 7) * 9 * t, 11 - t * 6]); }
    pbChain(K, pts, [[40, 26, 14], [66, 44, 24], [96, 66, 36], [126, 92, 54]], { tex: (t, sd) => ((((t * 14) % 1) < 0.1) ? -0.22 : 0) + (sd < -0.4 ? 0.08 : 0) });
    for (const [t, ang, len] of [[0.55, -0.9, 40], [0.78, 0.8, 34], [0.95, -0.4, 24]]) { const p = pts[Math.round(t * 12)], a0 = wd + ang; pbChain(K, [[p[0], p[1], 5], [p[0] + Math.cos(a0) * len, p[1] + Math.sin(a0) * len, 1.6]], [[56, 36, 20], [90, 62, 34], [120, 86, 50]]); }
    for (const t of [0.35, 0.6, 0.8, 0.98]) { const p = pts[Math.round(t * 12)]; K.path([[p[0], p[1], 2.4], [p[0] + 3, p[1] + 14, 1.6], [p[0] + 1, p[1] + 26, 0.8]], (tt) => T.slime[tt > 0.5 ? 1 : 0]); }   // тина
    for (const t of [0.3, 0.7]) { const p = pts[Math.round(t * 12)]; pbBall(K, p[0], p[1] - 4, 5, 4, [[66, 44, 24], [96, 66, 36]], { amb: 0.5 }); }   // наросты-узлы
  }
}
function pbTroll(K, P, kind) {
  const T = PBT[kind], SK = T.SK, a = P.a, sw = P.leg, open = P.mouth > 0.3;
  const SKD = SK.slice(0, 4), WO = PBC.WO;
  pbShadow(K, 92);
  const texSkin = (x, y) => (K.hsh(x * 0.53 + y * 3.7) > 0.95 ? -0.22 : K.hsh(x * 1.9 + y * 0.37) > 0.97 ? 0.16 : 0) + (kind === 'trollS' ? ((Math.floor(x / 11) + Math.floor(y / 9)) % 3 === 0 ? -0.07 : 0) : 0);
  // геометрия: ноги, руки, голова
  const legG = (hx, sgn) => { const kx = hx + sgn * sw * 12 + 6, fx = hx + sgn * sw * 20 + 4; return { hx, kx, ky: -54, fx }; };
  const armG = (sx, sy, ang, len1, len2, grip) => { const ex = sx + Math.cos(ang) * len1, ey = sy + Math.sin(ang) * len1, a2 = ang - 0.35 + (grip ? 0.2 : 0); return { sx, sy, ex, ey, a2, hx: ex + Math.cos(a2) * len2, hy: ey + Math.sin(a2) * len2, grip }; };
  const legPrims = L => [{ c: [[L.hx, -96, 22], [L.kx, L.ky, 16.5], [L.fx, -14, 13]] }, { e: [L.fx + 12, -8, 25, 10] }];
  const armPrims = A => [{ c: [[A.sx, A.sy, 20], [A.sx + (A.ex - A.sx) * 0.45, A.sy + (A.ey - A.sy) * 0.45, 18], [A.ex, A.ey, 15.5], [A.ex + (A.hx - A.ex) * 0.3, A.ey + (A.hy - A.ey) * 0.3, 16.5], [A.hx, A.hy, 12.5]] }, { e: [A.hx + Math.cos(A.a2) * 6, A.hy + Math.sin(A.a2) * 6, 15, 13] }];
  // пальцы рук и ног — поверх, узловатые, с когтями
  const fingers = (A, ramp) => {
    for (let f = 0; f < 4; f++) {
      const fa = A.a2 + (f - 1.5) * 0.32, bx = A.hx + Math.cos(A.a2) * 12 + Math.cos(fa + 1.57) * (f - 1.5) * 5, by = A.hy + Math.sin(A.a2) * 12 + Math.sin(fa + 1.57) * (f - 1.5) * 5;
      const k1x = bx + Math.cos(fa) * 9, k1y = by + Math.sin(fa) * 9, ca = fa + (A.grip ? 1.6 : 0.5), tx = k1x + Math.cos(ca) * 8, ty = k1y + Math.sin(ca) * 8;
      pbChain(K, [[bx, by, 4.6], [k1x, k1y, 4], [tx, ty, 3]], ramp);
      K.path([[tx, ty, 2.2], [tx + Math.cos(ca + 0.4) * 5, ty + Math.sin(ca + 0.4) * 5, 0.6]], () => T.NA[f % 2]);
    }
  };
  const lock = (...q) => pbTrLock(K, ...q);
  const HR = T.HR, HRD = HR.slice(0, 4);
  const tipDeco = (e, r) => pbTrTip(K, T, kind, e, r);                                         // что на кончиках: камень-бусина / капля тины
  // шерсть на предплечье: пряди свисают с нижне-задней стороны руки, у локтя — пучок назад
  const armFur = (A, ramp) => {
    const L = kind === 'trollB' ? 1.5 : 1, dx = Math.cos(A.a2), dy = Math.sin(A.a2);
    let nx = -dy, ny = dx; if (ny < 0 || (Math.abs(ny) < 0.3 && nx > 0)) { nx = -nx; ny = -ny; }
    for (let i = 0; i < 5; i++) {
      const t = 0.1 + i * 0.16, bx = A.ex + (A.hx - A.ex) * t + nx * 11, by = A.ey + (A.hy - A.ey) * t + ny * 11;
      const e = lock(bx, by, 1.57 + 0.55 + (K.hsh(i * 3.7) - 0.5) * 0.4, (13 + K.hsh(i * 5.1) * 9) * L, kind === 'trollS' ? 3.6 : 4.4, 0.35, ramp, kind === 'trollS');
      if (i % 2 === 0) tipDeco(e, 2);
    }
    const back = Math.atan2(-dy, -dx);
    for (let i = 0; i < 3; i++) { const e = lock(A.ex + nx * 6, A.ey + ny * 6, back + 0.5 + (i - 1) * 0.35, (18 + i * 4) * L, 5.5, 0.7, ramp, kind === 'trollS'); if (i === 1) tipDeco(e, 2.4); }
  };
  const toes = (L, ramp) => { for (let t = 0; t < 4; t++) { const tx = L.fx + 18 + t * 6; pbBall(K, tx, -5, 4, 4.6, ramp, { amb: 0.5, fade: 0.4 }); K.path([[tx + 2, -6, 1.8], [tx + 6, -2, 0.6]], () => T.NA[t % 2]); } };
  const farL = legG(-30, -1), nearL = legG(14, 1);
  const ang = P.up > 0.5 ? -2.2 : P.a < -0.3 ? -2.5 : P.a > 0.5 ? 0.5 : 1.75 + P.a * 0.3;    // висит / замах за голову / удар вперёд-вниз
  const nearA = armG(-4, -168, ang, 52, 48, true);                                             // ближняя рука — от плеча у горба, в ней оружие
  const farA = armG(26, -170, 1.45 - a * 0.2, 50, 46, false);                                  // дальняя — за туловищем, свободно висит
  const hx = 62 + (a > 0.5 ? 8 : 0), hy = -176 + (P.hurt > 0.5 ? 5 : 0);
  // ---- дальние нога и рука: отдельная, более тёмная «глина» за телом
  const INK0 = [0, 0, 0];
  pbBlob(K, armPrims(farA).map(p => (p.e ? { e: [p.e[0], p.e[1], p.e[2] + 3.4, p.e[3] + 3.4] } : { c: p.c.map(([x, y, r]) => [x, y, r + 3.4]) })), [INK0], { amb: 0.5, k: 4 });   // тёмная обводка дальней руки
  pbBlob(K, [...legPrims(farL), ...armPrims(farA)], SKD, { amb: 0.36, k: 6, tex: texSkin });
  toes(farL, SKD);
  fingers(farA, SKD);
  armFur(farA, HR.slice(0, 3));
  // ---- тело одной «глиной»: горб, туловище, загривок, голова с челюстью, ближние нога и рука
  pbBlob(K, [
    { e: [-24, -170, 32, 30] }, { e: [2, -140, 56, 52] },
    { c: [[16, -166, 30], [hx - 12, hy + 4, 26]] },
    ...legPrims(nearL),
  ], SK, { amb: 0.46, k: 14, depth: 22, tex: texSkin });
  // голова — своя «глина» поверх шеи: череп, челюсть, нос сливаются между собой, но лицо читается
  pbBlob(K, [{ e: [hx - 4, hy + 2, 32, 28] }, { e: [hx + 12, hy + 16, 24, 13] }, { e: [hx + 31, hy + 4, 13, 12] }, { e: [hx + 8, hy - 10, 17, 7] }], SK, { amb: 0.52, k: 6, depth: 14, tex: texSkin });
  // брюхо светлее, вплавлено дизером; складки, пуп
  pbBall(K, 14, -124, 38, 34, T.BE, { amb: 0.42, fade: 0.5, clip: (x, y) => ((x - 2) / 58) ** 2 + ((y + 138) / 50) ** 2 < 0.94, tex: (x, y) => (Math.abs(((y + 124) % 11)) < 1 && x > -16 ? -0.14 : 0) });
  pbDot(K, 20, -116, T.BE[0], 1.4);
  // набедренная повязка поверх бёдер
  pbPoly(K, [[-50, -104], [44, -108], [40, -78], [24, -70], [10, -80], [-6, -68], [-22, -80], [-40, -72], [-50, -84]], (x, y) => pbPick(T.CL, 0.55 - (y + 104) / 40 * 0.3 + (K.hsh(Math.floor(x / 7) * 1.7) - 0.5) * 0.25, K.dth(x, y)));
  K.path([[-48, -100, 1.6], [42, -104, 1.6]], () => T.CL[0]);
  toes(nearL, SK);
  // приметы вида: камни с мхом, космы мха по горбу, тина
  if (kind === 'trollS') for (const [x, y, r] of [[-40, -190, 9], [-20, -176, 6], [30, -150, 7], [-54, -150, 6]]) { pbBall(K, x, y, r + 2, r, [[90, 76, 56], [130, 112, 86], [168, 150, 120]], { amb: 0.5 }); pbBall(K, x - 2, y - 4, r * 0.6, r * 0.5, T.moss, { amb: 0.5, fade: 0.4 }); }
  else for (let i = 0; i < 7; i++) {                                                     // мох пучками по горбу, разной величины
    const x = -50 + K.hsh(i * 3.1) * 56, top = -170 - 30 * Math.sqrt(Math.max(0, 1 - ((x + 24) / 32) ** 2)), y = top + 6 + K.hsh(i * 7.3) * 46, r = 3 + K.hsh(i * 1.7) * 5;   // россыпью по спине и бокам
    pbBall(K, x, y, r * 1.3, r, T.HA, { amb: 0.55, fade: 0.5, tex: (xx, yy) => (K.hsh(Math.floor(xx / 2) * 3.3 + Math.floor(yy / 2)) > 0.6 ? 0.12 : -0.05) });
    for (let k = 0; k < 3; k++) K.path([[x - r + k * r, y + r * 0.6, 1.4], [x - r + k * r + (K.hsh(i + k) - 0.5) * 3, y + r * 0.6 + 4 + K.hsh(i * 2 + k) * 8, 0.6]], (tt) => T.HA[tt > 0.5 ? 0 : 1]);
  }
  if (kind === 'trollB') for (const [x, y] of [[-30, -150], [20, -170], [-50, -130]]) K.path([[x, y, 2.2], [x + 2, y + 8, 1.6], [x, y + 14, 1]], () => T.slime[1]);
  // ---- грива: объёмная шапка прядей от макушки, спадает назад на загривок и горб. Корни по дуге черепа спереди назад
  {
    const LN = kind === 'trollB' ? 1.55 : kind === 'trollS' ? 1.1 : 1, CU = kind === 'trollB' ? 2.1 : 1.6, DR = kind === 'trollS';
    const root = u => [hx + 14 - u * 46, hy - 30 + u * u * 22];
    // общая масса под прядями — шапка волос над черепом и затылком, чтобы грива была объёмной, а не наклеенной
    pbBlob(K, [{ e: [hx - 14, hy - 26, 30, 17] }, { c: [[hx - 30, hy - 18, 16], [hx - 52, hy + 4, 13], [hx - 66, hy + 30, 9]] }], HRD, { amb: 0.42, k: 8, tex: (x, y) => (Math.abs(Math.sin((x - hx) * 0.45 + (y - hy) * 0.9)) < 0.2 ? -0.16 : 0) });
    // задний слой — тёмный, самые длинные пряди по горбу
    for (let i = 0; i < 7; i++) { const u = 0.25 + i * 0.12, [x, y] = root(u), e = lock(x, y, -2.2 - u * 0.7 + (K.hsh(i * 2.3) - 0.5) * 0.3, (44 + u * 34 + K.hsh(i * 9.1) * 10) * LN, DR ? 7 : 10, -CU, HRD, DR); if (i % 2) tipDeco(e, 2.8); }
    // верхний слой — светлее и короче: даёт объём над черепом
    for (let i = 0; i < 6; i++) { const u = i * 0.13, [x, y] = root(u), e = lock(x, y - 6, -1.65 - u * 0.9 + (K.hsh(i * 4.7) - 0.5) * 0.35, (30 + u * 26 + K.hsh(i * 3.3) * 8) * LN, DR ? 6.5 : 8.5, -CU * 0.85, HR, DR); if (DR && i % 2 === 0) tipDeco(e, 2.4); }
    // вихры на макушке — торчат вверх-назад
    if (!DR) for (let i = 0; i < 4; i++) { const [x, y] = root(0.08 + i * 0.12); lock(x, y - 4, -1.85 - i * 0.2, 16 + K.hsh(i * 6.1) * 8, 6, -0.7, HR); }
    else {                                                                                    // каменный: пучок-узел на макушке, перехвачен каменным кольцом
      const [x, y] = root(0.22);
      pbBall(K, x - 2, y - 12, 12, 10, HR, { amb: 0.52, tex: (xx, yy) => (Math.abs(Math.sin((xx - x) * 0.7 + (yy - y) * 0.3)) < 0.25 ? -0.16 : 0) });
      pbBall(K, x - 2, y - 2, 11, 4.5, [[70, 60, 46], [110, 96, 74], [150, 134, 104], [186, 172, 140]], { amb: 0.5 });
      lock(x - 8, y - 18, -2.2, 22, 5, -1.6, HR, true);
    }
    // чёлка на лоб, не закрывая глаз
    for (let i = 0; i < 3; i++) lock(hx + 2 + i * 7, hy - 24, 1.75 + i * 0.12, 12 + i * 2, 4.5, -0.4, HR, DR);
    if (kind === 'troll') {                                                                   // лесной: в гриве застряли ветка и листья
      K.path([[hx - 24, hy - 30, 1.8], [hx - 40, hy - 46, 1.3], [hx - 46, hy - 52, 0.7]], (t) => [[60, 40, 22], [92, 64, 36]][t > 0.5 ? 0 : 1]);
      K.path([[hx - 38, hy - 44, 1], [hx - 34, hy - 54, 0.6]], () => [92, 64, 36]);
      for (const [lx, ly, la] of [[hx - 46, hy - 52, -0.6], [hx - 33, hy - 56, -1.4], [hx - 14, hy - 34, -2.4]]) {
        const cx = Math.cos(la), cy = Math.sin(la);
        pbPoly(K, [[lx, ly], [lx + cx * 5 - cy * 3.2, ly + cy * 5 + cx * 3.2], [lx + cx * 11, ly + cy * 11], [lx + cx * 5 + cy * 3.2, ly + cy * 5 - cx * 3.2]], (x, y) => pbPick([[44, 84, 24], [78, 128, 40], [120, 170, 60]], 0.45 + ((x - lx) * cy - (y - ly) * cx > 0 ? 0.25 : 0), K.dth(x, y)));
      }
    } else if (kind === 'trollB') {                                                           // болотный: ряска и камышинка в космах
      for (let i = 0; i < 9; i++) pbDot(K, hx - 50 + K.hsh(i * 7.7) * 56, hy - 20 + K.hsh(i * 3.9) * 50, [120, 176, 70], 1.6);
      K.path([[hx - 30, hy - 26, 1.4], [hx - 52, hy - 64, 0.8]], () => [130, 120, 70]);
      pbBall(K, hx - 47, hy - 56, 2.6, 6, [[90, 60, 30], [124, 86, 44]], { amb: 0.5 });
    }
  }
  // ---- оружие в ближней руке: рисуется ДО руки — рукоять уходит в кулак, пальцы ложатся поверх
  const whx = nearA.hx + Math.cos(nearA.a2) * 6, why = nearA.hy + Math.sin(nearA.a2) * 6, wa = nearA.a2;
  const INK = [0, 0, 0];
  pbTrWeapon(K, T, whx, why, wa - 1.1);
  // ближняя рука — поверх оружия и тела, с тёмной обводкой
  pbBlob(K, armPrims(nearA).map(p => (p.e ? { e: [p.e[0], p.e[1], p.e[2] + 3.4, p.e[3] + 3.4] } : { c: p.c.map(([x, y, r]) => [x, y, r + 3.4]) })), [INK], { amb: 0.5, k: 4 });
  pbBlob(K, armPrims(nearA), SK, { amb: 0.5, k: 4, depth: 12, tex: texSkin });
  armFur(nearA, HR);
  fingers(nearA, SK);
  // ---- лицо: ухо, бровь, глаз, нос, рот, клыки
  pbPoly(K, [[hx - 22, hy - 6], [hx - 40, hy - 18], [hx - 34, hy + 2], [hx - 22, hy + 6]], (x, y) => pbPick(SK, 0.55 - (x - hx + 40) / 30 * 0.1, K.dth(x, y)));
  pbChain(K, [[hx - 4, hy - 8, 1.6], [hx + 20, hy - 5, 1.4]], SK.slice(0, 2));                    // тень под бровью
  pbEye(K, hx + 12, hy - 1, 3.6, P, [236, 200, 70], [120, 20, 10], SK[0]);
  pbDot(K, hx + 33, hy + 10, SK[0], 1.8); pbDot(K, hx + 27, hy + 1, SK[3], 1.6);           // ноздря и блик на носу
  if (open) pbBall(K, hx + 18, hy + 22, 12, 4 + P.mouth * 4, [[30, 8, 6], [60, 18, 14], [90, 30, 22]], { amb: 0.3 });
  else K.path([[hx + 4, hy + 21, 1], [hx + 30, hy + 19, 1]], () => SK[0]);
  // клыки: нижние бивни — изогнутые вверх-вперёд, толстые у десны, с кольцами-бороздками, сколами и тёмным кончиком; верхний клык — вниз из-под губы
  const tusk = (...q) => pbTrTusk(K, T, kind, ...q);
  tusk(hx + 1, hy + 22, -0.85, 16 + (kind === 'trollS' ? -2 : 0), 4.2, -1.2);         // дальний бивень, чуть короче
  tusk(hx + 15, hy + 24, -0.9, 15, 5, -1.15);                                               // ближний — крупнее, кончик ниже носа
  tusk(hx + 33, hy + 13, 1.75, 8, 2.8, -0.4);                                               // верхний клык из-под губы
  if (a > 0.5) for (let i = 0; i < 18; i++) { const t = i / 17, an = -1.4 + t * 1.9; K.P(40 + Math.cos(an) * 150, -100 + Math.sin(an) * 110, [236, 232, 214], 0.65 - t * 0.3, false); }
  K.outline([0, 0, 0], 1, 5);
}
// ---- Тролль анфас: идёт на зрителя. Те же палитры, грива, клыки и оружие, что сбоку; кадры — те же позы naPose
// (покой, ходьба: ноги поочерёдно, замах над головой, удар наискось через тело, боль, смерть — naPxFrame валит набок).
// Оружие — в правой от зрителя руке, вторая свободна; при face < 0 спрайт отражается целиком.
function pbTrollF(K0, P, kind) {
  const K = P.fall ? pbSquashY(K0, 1 - P.fall * 0.6) : K0;                                // смерть: заваливается навзничь
  const T = PBT[kind], SK = T.SK, HR = T.HR, HRD = HR.slice(0, 4), a = P.a || 0, sw = P.leg || 0, open = P.mouth > 0.3, up = P.up > 0.5 || P.fall > 0.3;
  const DR = kind === 'trollS', LN = kind === 'trollB' ? 1.5 : DR ? 1.1 : 1, CU = kind === 'trollB' ? 1.9 : 1.45;
  const texSkin = (x, y) => (K.hsh(x * 0.53 + y * 3.7) > 0.95 ? -0.22 : K.hsh(x * 1.9 + y * 0.37) > 0.97 ? 0.16 : 0) + (DR ? ((Math.floor(x / 11) + Math.floor(y / 9)) % 3 === 0 ? -0.07 : 0) : 0);
  const lock = (...q) => pbTrLock(K, ...q), tip = (e, r) => pbTrTip(K, T, kind, e, r);
  const mlock = (s, x, y, ang, len, w, curl, ramp) => lock(s * x, y, s > 0 ? ang : Math.PI - ang, len, w, s > 0 ? curl : -curl, ramp, DR);   // прядь, отражённая на сторону s
  const INK = [0, 0, 0];
  pbShadow(K, 88);
  // ---- геометрия: ноги (на ходьбе поднимаются поочерёдно), руки, голова
  const leg = s => { const lift = Math.max(0, sw * s) * 26; return { s, lift, prims: [{ c: [[s * 26, -96, 24], [s * 33, -52 - lift * 0.6, 17], [s * 34, -15 - lift, 14]] }, { e: [s * 36, -8 - lift, 21, 10] }] }; };
  const L1 = leg(-1), L2 = leg(1);
  const arm = (sx, sy, ex, ey, hx, hy) => ({ sx, sy, ex, ey, hx, hy, prims: [{ c: [[sx, sy, 21], [(sx + ex) / 2, (sy + ey) / 2, 18], [ex, ey, 15.5], [ex + (hx - ex) * 0.3, ey + (hy - ey) * 0.3, 16.5], [hx, hy, 13]] }, { e: [hx, hy + 4, 15, 13] }] });
  // оружейная рука (справа): висит / замах над головой / удар наискось / возврат
  const W = up || a < -0.3 ? arm(62, -172, 96, -206, 66, -248) : a > 0.5 ? arm(62, -168, 70, -136, 30, -104) : a > 0.15 ? arm(62, -170, 86, -138, 72, -100) : arm(62, -170, 84, -124, 84 + sw * 3, -76);
  const wd = up || a < -0.3 ? -2.35 : a > 0.5 ? 2.25 : a > 0.15 ? 1.7 : 0.8;
  const F = up ? arm(-62, -172, -94, -208, -70, -250) : arm(-62, -170, -82 - sw * 3, -124, -80 - sw * 6, -76 + Math.abs(sw) * 3);
  const hy = -150 + (P.hurt > 0.5 ? 5 : 0) + (a > 0.5 ? 6 : 0);
  // ---- оружие поднято над головой — рисуется до тела
  if (up || a < -0.3) pbTrWeapon(K, T, W.hx, W.hy - 4, wd);
  // ---- тело одной «глиной»: таз, брюхо, плечевой пояс с горбом, ноги
  pbBlob(K, [{ e: [0, -104, 46, 28] }, { e: [0, -136, 58, 44] }, { e: [0, -170, 66, 26] }, { c: [[-62, -170, 22], [62, -170, 22]] }, ...L1.prims, ...L2.prims], SK, { amb: 0.46, k: 14, depth: 22, tex: texSkin });
  pbBall(K, 0, -128, 38, 34, T.BE, { amb: 0.42, fade: 0.5, clip: (x, y) => (x / 52) ** 2 + ((y + 134) / 44) ** 2 < 0.9, tex: (x, y) => (Math.abs(((y + 128) % 11)) < 1 && Math.abs(x) < 26 ? -0.14 : 0) });
  pbDot(K, 0, -116, T.BE[0], 1.4);
  pbPoly(K, [[-50, -110], [50, -110], [46, -82], [30, -72], [14, -84], [0, -70], [-14, -84], [-30, -72], [-46, -82]], (x, y) => pbPick(T.CL, 0.55 - (y + 110) / 40 * 0.3 + (K.hsh(Math.floor(x / 7) * 1.7) - 0.5) * 0.25, K.dth(x, y)));
  K.path([[-48, -106, 1.6], [48, -106, 1.6]], () => T.CL[0]);
  for (const L of [L1, L2]) for (let t = 0; t < 3; t++) { const tx = L.s * 36 + (t - 1) * 9; pbBall(K, tx, -4 - L.lift, 4.4, 4.6, SK, { amb: 0.5, fade: 0.4 }); K.path([[tx, -1 - L.lift, 1.8], [tx + (t - 1), 3 - L.lift, 0.6]], () => T.NA[t % 2]); }
  // приметы вида на плечах
  if (DR) for (const [x, y, r] of [[-56, -184, 8], [50, -188, 6], [-30, -186, 5], [64, -170, 5]]) { pbBall(K, x, y, r + 2, r, [[90, 76, 56], [130, 112, 86], [168, 150, 120]], { amb: 0.5 }); pbBall(K, x - 2, y - 4, r * 0.6, r * 0.5, T.moss, { amb: 0.5, fade: 0.4 }); }
  else for (let i = 0; i < 6; i++) { const s = i % 2 ? 1 : -1, x = s * (40 + K.hsh(i * 3.1) * 26), y = -182 + K.hsh(i * 7.3) * 26, r = 3 + K.hsh(i * 1.7) * 4; pbBall(K, x, y, r * 1.3, r, kind === 'trollB' ? HR : T.HA, { amb: 0.55, fade: 0.5 }); }
  if (kind === 'trollB') for (const [x, y] of [[-50, -176], [44, -180], [-20, -150], [24, -120]]) K.path([[x, y, 2.2], [x + 1, y + 8, 1.6], [x, y + 14, 1]], () => T.slime[1]);
  // ---- грива: задний тёмный слой спадает по обе стороны головы на плечи
  pbBlob(K, [{ e: [0, hy - 26, 34, 15] }, { c: [[-26, hy - 22, 14], [-44, hy - 2, 12], [-54, hy + 22, 8]] }, { c: [[26, hy - 22, 14], [44, hy - 2, 12], [54, hy + 22, 8]] }], HRD, { amb: 0.42, k: 8, tex: (x, y) => (Math.abs(Math.sin(x * 0.9 + (y - hy) * 0.3)) < 0.2 ? -0.16 : 0) });
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const u = i / 3, e = mlock(s, 8 + u * 20, hy - 30 + u * 8, -1.3 + u * 0.45 + (K.hsh(i * 2.3 + s) - 0.5) * 0.25, (40 + u * 28) * LN, DR ? 7 : 9, CU, HRD); if (i % 2) tip(e, 2.6); }
  // ---- голова: череп, широкая челюсть, тяжёлая бровь, нос — одна «глина»; уши в стороны
  for (const s of [-1, 1]) pbPoly(K, [[s * 26, hy - 6], [s * 46, hy - 20], [s * 40, hy + 2], [s * 26, hy + 6]], (x, y) => pbPick(SK, 0.5 + s * 0.06 - Math.abs(x) / 46 * 0.1, K.dth(x, y)));
  pbBlob(K, [{ e: [0, hy, 29, 26] }, { e: [0, hy + 16, 31, 14] }, { e: [0, hy - 13, 26, 8] }, { e: [0, hy + 3, 10, 12] }], SK, { amb: 0.52, k: 6, depth: 14, tex: texSkin });
  // верхний слой гривы, вихры и чёлка
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const u = i / 2, e = mlock(s, 2 + u * 18, hy - 34, -1.5 + u * 0.4 + (K.hsh(i * 4.7 + s) - 0.5) * 0.3, (26 + u * 18) * LN, DR ? 6.5 : 8, CU * 0.85, HR); if (DR && i !== 1) tip(e, 2.3); }
  if (!DR) for (let i = 0; i < 3; i++) lock((i - 1) * 9, hy - 36, -1.57 + (i - 1) * 0.35, 16 + K.hsh(i * 6.1) * 6, 6, (i - 1) * 0.6, HR);
  else {
    pbBall(K, 0, hy - 46, 12, 10, HR, { amb: 0.52, tex: (xx, yy) => (Math.abs(Math.sin(xx * 0.7 + (yy - hy) * 0.3)) < 0.25 ? -0.16 : 0) });
    pbBall(K, 0, hy - 36, 11, 4.5, [[70, 60, 46], [110, 96, 74], [150, 134, 104], [186, 172, 140]], { amb: 0.5 });
    lock(-4, hy - 54, -1.9, 20, 5, -1.4, HR, true);
  }
  for (let i = 0; i < 4; i++) lock(-12 + i * 8, hy - 26, 1.57 + (i - 1.5) * 0.18, 10 + (i % 2) * 3, 4.2, (i - 1.5) * 0.2, HR, DR);
  if (kind === 'troll') {
    K.path([[-16, hy - 36, 1.8], [-34, hy - 56, 1.3], [-40, hy - 62, 0.7]], (t) => [[60, 40, 22], [92, 64, 36]][t > 0.5 ? 0 : 1]);
    for (const [lx, ly, la] of [[-40, hy - 62, -1.2], [-28, hy - 58, -2.2], [14, hy - 40, -0.8]]) {
      const cx = Math.cos(la), cy = Math.sin(la);
      pbPoly(K, [[lx, ly], [lx + cx * 5 - cy * 3.2, ly + cy * 5 + cx * 3.2], [lx + cx * 11, ly + cy * 11], [lx + cx * 5 + cy * 3.2, ly + cy * 5 - cx * 3.2]], (x, y) => pbPick([[44, 84, 24], [78, 128, 40], [120, 170, 60]], 0.45 + ((x - lx) * cy - (y - ly) * cx > 0 ? 0.25 : 0), K.dth(x, y)));
    }
  } else if (kind === 'trollB') {
    for (let i = 0; i < 9; i++) pbDot(K, -40 + K.hsh(i * 7.7) * 80, hy - 30 + K.hsh(i * 3.9) * 50, [120, 176, 70], 1.6);
    K.path([[18, hy - 34, 1.4], [30, hy - 72, 0.8]], () => [130, 120, 70]);
    pbBall(K, 29, hy - 66, 2.6, 6, [[90, 60, 30], [124, 86, 44]], { amb: 0.5 });
  }
  // ---- лицо: тень под бровью, глаза, ноздри, рот, клыки-бивни (наружу), верхние клычки
  pbChain(K, [[-24, hy - 6, 1.6], [0, hy - 3, 1.4], [24, hy - 6, 1.6]], SK.slice(0, 2));
  for (const s of [-1, 1]) pbEye(K, s * 12, hy - 1, 3.4, P, [236, 200, 70], [120, 20, 10], SK[0]);
  pbDot(K, -4, hy + 10, SK[0], 1.6); pbDot(K, 4, hy + 10, SK[0], 1.6); pbDot(K, 2, hy + 1, SK[3], 1.4);
  if (open) pbBall(K, 0, hy + 20, 13, 4 + P.mouth * 4, [[30, 8, 6], [60, 18, 14], [90, 30, 22]], { amb: 0.3 });
  else K.path([[-15, hy + 19, 1], [15, hy + 19, 1]], () => SK[0]);
  pbTrTusk(K, T, kind, 13, hy + 25, -1.85, 15, 4.6, 0.95, 1);
  pbTrTusk(K, T, kind, -13, hy + 25, -Math.PI + 1.85, 15, 4.6, -0.95, -1);
  for (const s of [-1, 1]) pbTrTusk(K, T, kind, s * 7, hy + 14, s > 0 ? 1.7 : Math.PI - 1.7, 6, 2.4, s * -0.3, s);
  // ---- оружие у тела (висит / удар / возврат) — до руки, чтобы кулак лёг поверх рукояти
  if (!(up || a < -0.3)) pbTrWeapon(K, T, W.hx, W.hy + 2, wd);
  // ---- руки поверх тела, с чёрной обводкой; шерсть на предплечьях; пальцы
  const fur = (A, s) => {
    const L = kind === 'trollB' ? 1.5 : 1;
    for (let i = 0; i < 4; i++) { const t = 0.12 + i * 0.2, e = lock(A.ex + (A.hx - A.ex) * t + s * 12, A.ey + (A.hy - A.ey) * t, 1.57 - s * 0.5 + (K.hsh(i * 3.7 + s) - 0.5) * 0.3, (12 + K.hsh(i * 5.1 + s) * 8) * L, DR ? 3.6 : 4.2, s * 0.3, HR, DR); if (i % 2 === 0) tip(e, 2); }
    for (let i = 0; i < 2; i++) { const e = lock(A.ex + s * 10, A.ey, (s > 0 ? 0.2 : Math.PI - 0.2) + i * s * 0.5, (16 + i * 4) * L, 5, s * 0.8, HR, DR); if (i) tip(e, 2.2); }
  };
  for (const [A, s, grip] of [[F, -1, false], [W, 1, true]]) {
    pbBlob(K, A.prims.map(p => (p.e ? { e: [p.e[0], p.e[1], p.e[2] + 3.4, p.e[3] + 3.4] } : { c: p.c.map(([x, y, r]) => [x, y, r + 3.4]) })), [INK], { amb: 0.5, k: 4 });
    pbBlob(K, A.prims, SK, { amb: 0.5, k: 4, depth: 12, tex: texSkin });
    fur(A, s);
    if (grip) for (let f = 0; f < 4; f++) pbBall(K, A.hx + (f - 1.5) * 6, A.hy + 3, 3.8, 3.4, SK, { amb: 0.55 });                   // костяшки на рукояти
    else for (let f = 0; f < 4; f++) { const fx = A.hx + (f - 1.5) * 6.5, fy = A.hy + 13; pbChain(K, [[fx, fy - 4, 4.4], [fx + (f - 1.5), fy + 4, 3.6], [fx + (f - 1.5) * 1.5, fy + 9, 2.8]], SK); K.path([[fx + (f - 1.5) * 1.5, fy + 10, 2], [fx + (f - 1.5) * 2, fy + 15, 0.6]], () => T.NA[f % 2]); }
  }
  K.outline(INK, 1, 5);
}
// тролли ещё в работе (позы рук на замахе) — до одобрения владельцем в игре остаются векторными
const PB_TROLLS_READY = true;
if (PB_TROLLS_READY) {
  NA_PX.troll = (K, P) => pbTroll(K, P, 'troll');
  NA_PX.trollS = (K, P) => pbTroll(K, P, 'trollS');
  NA_PX.trollB = (K, P) => pbTroll(K, P, 'trollB');
  // вид анфас: свои «виды» 'trollF' и т. п. с той же меркой кадра; neuDraw берёт их, когда тролль идёт на зрителя
  for (const k of ['troll', 'trollS', 'trollB']) { NA_SPEC[k + 'F'] = NA_SPEC[k]; NA_DRAW[k + 'F'] = NA_DRAW[k]; NA_PX[k + 'F'] = (K, P, fr) => { if (fr && fr[0] === 'd') { P.fall = Math.min(1, -(P.rot || 0) / 1.5); P.rot = 0; P.x = 0; P.y = 0; } else if (fr && fr[0] === 'w') P.rot = -(P.leg || 0) * 0.06;   /* ходьба анфас — переваливается с ноги на ногу */ pbTrollF(K, P, k); }; }   // смерть анфас — не набок, а навзничь
}

// ======================= Броненосец: бронированный зверь =======================
// Единицы — как у векторного drawArmad (масштаб NA_SPEC.sc). Тяжёлый панцирь из колец-пластин с роговыми
// шипами по хребту, рогатый щиток на лбу, светящиеся янтарные глаза, клыки из-под рыла, когти-кирки,
// хвост-булава в шипах. Свернувшись, катится шипастым ядром.
const PBA = {
  SH: [[28, 24, 24], [50, 42, 38], [78, 64, 52], [112, 92, 70], [150, 126, 94], [188, 164, 124]],   // тёмная бронза
  SK: [[70, 44, 40], [110, 74, 62], [150, 108, 90], [190, 146, 120]],
  HO: [[120, 110, 88], [182, 170, 140], [230, 222, 196], [250, 246, 232]],
  EY: [[200, 110, 10], [255, 180, 40], [255, 236, 140]],
};
function pbArmad(Q, P) {
  const C = PBA, ball = P.curl >= 0.5, sw = P.leg, lunge = P.a > 0 ? P.a : 0;
  pbShadow(Q, ball ? 14 : 20);
  const Y = y => (P.dead ? -26 - y : y);                                                  // на спине — лапами вверх
  const spike = (x, y, ang, len, w) => pbPoly(Q, [[x - Math.sin(ang) * w, y + Math.cos(ang) * w], [x + Math.cos(ang) * len, y + Math.sin(ang) * len], [x + Math.sin(ang) * w, y - Math.cos(ang) * w]], (xx, yy) => pbPick(C.HO, 0.85 - Math.hypot(xx - x, yy - y) / len * 0.5, Q.dth(xx, yy)));
  if (ball) {
    const r = 11 + P.curl * 3.6, cy = -r - 0.5, sp = P.spin || 0;
    if (P.dust) Q.R(-r - 16, -7, -r, 0, (x, y) => (Q.dth(x, y) < 0.4 - ((x + r) / -16) * 0.3 && ((x + r + 7) ** 2 / 60 + (y + 2) ** 2 / 7) < 1 ? [200, 180, 140, 0.6] : null), false);
    pbBall(Q, 0, cy, r, r, C.SH, { amb: 0.46, tex: (x, y) => {
      const an = Math.atan2(y - cy, x) - sp, ring = ((an / Math.PI * 4) % 1 + 1) % 1, rr = Math.hypot(x, y - cy) / r;
      return (ring < 0.1 ? -0.34 : 0) + (rr > 0.4 && Math.floor(rr * 5 + ring * 4) % 2 ? -0.06 : 0.05);
    } });
    for (let k = 0; k < 8; k++) { const an = sp + k / 8 * Math.PI * 2; spike(Math.cos(an) * r * 0.92, cy + Math.sin(an) * r * 0.92, an, 6, 1.6); }   // шипы ядра
    if (P.bonk) for (let s = 0; s < 3; s++) { const an = s * 2.1 + P.bonk * 3; pbDot(Q, Math.cos(an) * 11, cy - r - 4 + Math.sin(an) * 2.4, [255, 242, 160], 0.7); }
    Q.outline([30, 22, 18]);
    return;
  }
  // лапы: толстые, когти-кирки
  const leg = (x, ph, near) => {
    const fx = x + ph * 3 + lunge * 2, ramp = near ? C.SK : C.SK.slice(0, 3);
    pbChain(Q, [[x, Y(-8), 3.6], [fx, Y(-1), 2.8]], ramp);
    for (let k = 0; k < 3; k++) Q.path([[fx + 1 + k * 1.3, Y(-0.6), 0.9], [fx + 3.6 + k * 1.4, Y(0.6), 0.2]], () => C.HO[near ? 2 : 1]);
  };
  leg(-11, -sw, false); leg(8, sw, false);
  // хвост-булава
  const tpts = []; for (let i = 0; i <= 6; i++) { const t = i / 6; tpts.push([-18 - t * 12, Y(-8 + t * 3 - Math.sin(t * 3) * 2), 3.6 * (1 - t * 0.5)]); }
  pbChain(Q, tpts, C.SH.slice(0, 5), { tex: (t) => ((((t * 7) % 1) < 0.2) ? -0.25 : 0) });
  const tb = tpts[6];
  pbBall(Q, tb[0] - 1, tb[1], 3.6, 3.2, C.SH, { amb: 0.5 });
  for (let k = 0; k < 5; k++) { const an = Math.PI * 0.6 + k / 4 * Math.PI * 0.9; spike(tb[0] - 1 + Math.cos(an) * 3, tb[1] + Math.sin(an) * 3, an, 4, 1); }
  // панцирь: высокий купол, кольца-пластины с кромками, передний и задний щиты
  pbBall(Q, -1, Y(-12), 20, 13, C.SH, { amb: 0.5, clip: (x, y) => (P.dead ? y > Y(-12) - 0.5 : y < -6.5), tex: (x, y) => {
    const band = x > -12 && x < 9 ? (((x + 12) / 3) % 1) : -1;
    let v = band >= 0 && band < 0.16 ? -0.34 : band > 0.84 ? 0.1 : 0;        // кольца с тёмной щелью и светлой кромкой
    if (Q.hsh(Math.floor(x * 1.3) * 3.1 + Math.floor((y + 0.5) * 1.8)) > 0.55) v += 0.04;   // роговая чешуя
    return v + (x < -12 || x > 9 ? -0.06 : 0);
  } });
  Q.path([[-20, Y(-6.6), 0.7], [18, Y(-6.6), 0.7]], () => C.SH[0]);
  for (let k = 0; k < 7; k++) { const x = -13 + k * 3.6, top = -12 - Math.sqrt(Math.max(0, 1 - ((x + 1) / 20) ** 2)) * 13; spike(x, Y(top + 1), P.dead ? Math.PI / 2 : -Math.PI / 2 - 0.25, 4.6 - Math.abs(k - 3) * 0.4, 1.3); }   // шипы по хребту
  for (const s of [-1, 1]) spike(s > 0 ? 15 : -18, Y(-9), s > 0 ? -0.3 : Math.PI + 0.3, 4, 1.1);   // боковые шипы щитов
  // голова: бронированная морда, рог на щитке, клыки, глаза горят
  const hx = 17 + lunge * 2.6 - P.curl * 3, hy = Y(-9 + (P.hurt > 0.5 ? 1 : 0));
  pbBlob(Q, [{ e: [hx, hy, 5, 4.2] }, { c: [[hx + 2, hy + 0.4, 3], [hx + 10, hy + 1.6, 1.8]] }], C.SK, { amb: 0.5, k: 2, depth: 3 });
  pbPoly(Q, [[hx - 3, hy - 4], [hx + 5, hy - 5.4], [hx + 9, hy - 2], [hx + 3, hy - 1.4], [hx - 3.4, hy - 1]], (x, y) => pbPick(C.SH, 0.7 - (y - hy + 5) / 5 * 0.3, Q.dth(x, y)));   // лобный щиток
  spike(hx + 3, hy - 4.6, -1.2, 6.4, 1.3);                                                  // рог
  for (const ex of [-2.2, -0.6]) Q.path([[hx + ex, hy - 3.6, 0.9], [hx + ex - 2.4, hy - 8.6, 0.25]], () => C.SK[2]);   // уши прижаты
  if (P.eye < 2) { pbBall(Q, hx + 2.6, hy - 0.6, 1.2, 0.9, C.EY, { amb: 0.7 }); Q.path([[hx + 2.4, hy - 1.2, 0.15], [hx + 2.6, hy, 0.15]], () => [20, 8, 4]); Q.R(hx, hy - 3, hx + 5, hy + 2, (x, y) => (Math.hypot(x - hx - 2.6, y - hy + 0.6) < 2.2 && Q.dth(x, y) < 0.3 ? [255, 170, 40, 0.5] : null), false); }
  else Q.path([[hx + 1.6, hy - 0.6, 0.3], [hx + 3.6, hy - 0.4, 0.3]], () => C.SK[0]);
  for (const [tx, l] of [[hx + 7.4, 3], [hx + 9, 2.4]]) Q.path([[tx, hy + 2.4, 0.6], [tx + 0.6, hy + 2.4 + l, 0.12]], () => C.HO[2]);   // клыки
  if (P.mouth > 0.4) Q.path([[hx + 5, hy + 2.6, 0.5], [hx + 10.4, hy + 2.2, 0.5]], () => [70, 20, 20]);
  pbDot(Q, hx + 10.6, hy + 1.2, C.SK[0], 0.5);                                             // ноздря
  leg(-13, sw, true); leg(10, -sw, true);
  Q.outline([30, 22, 18]);
}
if (NA_SPEC.armad && PX_FINE > 1) Object.assign(NA_SPEC.armad, { w: 120, h: 76, ax: 58, ay: 64 });   // крупнее: шипы, рог и хвост-булава
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
    pbChain(Q, [[x, -20, 3.4], [x + (kx - x) * 0.5, -14.5, 2.6], [kx, ky, 1.8], [fx, -2.4, 1.5]], ramp);
    pbPoly(Q, [[fx - 1.8, -2.6], [fx + 2, -2.6], [fx + 2.4, 0.2], [fx - 2, 0.2]], C.HO);   // копыто
    Q.path([[fx - 1.6, -3, 0.6], [fx + 1.6, -3, 0.6]], () => C.MA[2]);                    // щётка над копытом
  };
  legH(-17, -sw, false, true); legH(6, sw, false, false);
  // хвост: длинный, волнистый
  for (let k = 0; k < 4; k++) { const pts = []; for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push([-22 - t * 9 - k * 0.6, -24 + t * 16 + Math.sin(t * 4 + sw + k) * 1.6, 1.6 * (1 - t * 0.6)]); } Q.path(pts, () => C.MA[k % 3]); }
  // туловище пони: круп, бочка в яблоках, грудь
  pbBlob(Q, [{ e: [-16, -24, 8.4, 7.4] }, { e: [-4, -23, 14, 7.6] }, { e: [9, -25, 7.6, 7.2] }], C.CO, { amb: 0.5, k: 3, depth: 5, tex: (x, y) => (Q.hsh(Math.floor(x / 2.4) * 7.3 + Math.floor(y / 2.4) * 1.9) > 0.82 ? 0.12 : 0) });   // круп, бочка, грудь одной формой
  legH(-14, sw, true, true); legH(9, -sw, true, false);
  // гном — как наши жители: коренастый, зелёная туника, большое острое ухо, нос-картошка, пухлые щёки,
  // светлая окладистая борода с мхом, мшистый колпак с веточкой и грибом; брови сдвинуты — воин.
  const tx = 11, ty = -30, GR = [[34, 64, 22], [52, 92, 32], [74, 122, 42], [100, 150, 58], [136, 180, 84]];
  const SKN = [[118, 74, 52], [168, 106, 76], [216, 158, 120], [242, 200, 160]], BEA = [[150, 140, 108], [196, 188, 156], [226, 220, 194], [244, 240, 222]];
  const CAP = [[60, 30, 20], [104, 46, 30], [148, 68, 40], [180, 96, 60]], MOSS = [[48, 84, 30], [78, 120, 44], [110, 152, 60]];
  // дальняя рука — за туловищем
  const farAng = bow ? (a < -0.2 ? -0.4 : -0.1) : 1.1;
  const fex = tx - 4 + Math.cos(farAng + 0.5) * 5, fey = ty - 11 + Math.sin(farAng + 0.5) * 5, fhx = fex + Math.cos(farAng) * 5, fhy = fey + Math.sin(farAng) * 5;
  pbChain(Q, [[tx - 4, ty - 11, 1.9], [fex, fey, 1.6], [fhx, fhy, 1.4]], GR.slice(0, 4));
  pbBall(Q, fhx, fhy, 1.3, 1.3, SKN.slice(0, 3), { soft: true });
  // туника: зелёная, подпоясана; подол лежит на холке и прячет стык с конём
  pbPoly(Q, [[tx - 5, ty - 13], [tx + 4.6, ty - 13], [tx + 6, ty - 2], [tx + 8, ty + 3.4], [tx + 4, ty + 2.4], [tx + 1, ty + 4], [tx - 2.6, ty + 2.6], [tx - 6.4, ty + 3.6], [tx - 6.2, ty - 2]], (x, y) => pbPick(GR, 0.66 - (x - tx + 6) / 14 * 0.32 + ((((x - tx) * 1.2 + 20) % 3.4) < 0.5 ? -0.12 : 0), Q.dth(x, y)));
  Q.path([[tx - 6, ty - 3.4, 0.7], [tx + 6, ty - 3.4, 0.7]], () => [80, 52, 30]);                    // пояс
  pbPoly(Q, [[tx - 0.8, ty - 4.2], [tx + 1, ty - 4.2], [tx + 1, ty - 2.6], [tx - 0.8, ty - 2.6]], [[180, 150, 60], [230, 200, 100]]);   // пряжка
  for (let k = 0; k < 7; k++) pbBall(Q, tx - 5.6 + k * 2, ty + 2.6 + (k % 2) * 0.6, 1.4, 1, MOSS, { amb: 0.5, soft: true });   // мох по подолу
  pbBall(Q, tx + 3.6, ty - 11.6, 2.8, 2.2, [[70, 46, 26], [104, 72, 40], [140, 102, 60]], { amb: 0.55 });   // кожаный наплечник
  // голова: круглая, пухлые щёки
  const hx = tx + 1.2 + (a > 0.5 ? 1 : 0), hy = ty - 17;
  pbBall(Q, hx, hy, 4.2, 4, SKN, { amb: 0.56 });
  pbBall(Q, hx + 2.2, hy + 1, 2, 1.7, SKN, { amb: 0.62, soft: true });                                // щека
  // ухо: большое, острое, назад-вверх
  pbPoly(Q, [[hx - 2.4, hy - 1], [hx - 7.4, hy - 4.6], [hx - 6, hy - 2.6], [hx - 2.6, hy + 1.4]], (x, y) => pbPick(SKN, 0.62 - (hx - x) / 8 * 0.25, Q.dth(x, y)));
  Q.path([[hx - 3, hy - 0.4, 0.3], [hx - 6.2, hy - 3.6, 0.2]], () => SKN[1]);
  // борода: светлая, окладистая, с клочьями мха
  pbPoly(Q, [[hx - 2.8, hy + 1], [hx + 4.4, hy + 1.6], [hx + 4.2, hy + 6], [hx + 2, hy + 10.4], [hx, hy + 9], [hx - 1.6, hy + 10.6], [hx - 3.2, hy + 6]], (x, y) => pbPick(BEA, 0.68 - (y - hy) / 12 * 0.25 + ((((x - hx) * 1.6 + 30) % 1.6) < 0.35 ? -0.18 : 0), Q.dth(x, y)));
  for (const [x, y] of [[hx - 1.4, hy + 5], [hx + 2.6, hy + 7.4]]) pbBall(Q, x, y, 1, 0.7, MOSS, { amb: 0.5, soft: true });
  // нос-картошка, злые брови, глаз
  pbBall(Q, hx + 3.8, hy + 0.6, 1.7, 1.5, [[176, 96, 70], [216, 140, 106], [242, 180, 140]], { amb: 0.7 });
  Q.path([[hx + 0.6, hy - 2.4, 0.55], [hx + 3, hy - 1.4, 0.45]], () => BEA[0]);
  pbEye(Q, hx + 2, hy - 0.8, 0.55, P, [250, 246, 236], [30, 40, 50], SKN[0]);
  if (open) pbBall(Q, hx + 2.6, hy + 2.4, 0.9, 0.5 + P.mouth * 0.5, [[60, 16, 14], [100, 30, 24]], { amb: 0.3 });
  // мшистый колпак: свисает назад, веточка и грибок
  pbPoly(Q, [[hx - 4.6, hy - 1.4], [hx - 3.4, hy - 5], [hx, hy - 6.4], [hx + 3.6, hy - 5.4], [hx + 4.6, hy - 1.8], [hx + 1, hy - 3], [hx - 3, hy - 2.4]], (x, y) => pbPick(CAP, 0.66 - (y - hy + 6) / 6 * 0.2 - (hx - x) / 10 * 0.15, Q.dth(x, y)));
  const cpts = []; for (let i = 0; i <= 6; i++) { const t = i / 6; cpts.push([hx - 3 - t * 6, hy - 5 - Math.sin(t * Math.PI) * 2 + t * t * 4, 2.2 * (1 - t * 0.75)]); }
  pbChain(Q, cpts, CAP);                                                                              // хвост колпака
  for (const [x, y] of [[hx - 2, hy - 5.4], [hx + 1.4, hy - 6], [hx - 5, hy - 5.6]]) pbBall(Q, x, y, 1.2, 0.7, MOSS, { amb: 0.55, soft: true });
  Q.path([[hx + 1, hy - 6, 0.25], [hx + 2, hy - 8.4, 0.2], [hx + 3.2, hy - 9, 0.15]], () => [100, 70, 40]);   // веточка
  pbBall(Q, hx - 6.4, hy - 4.6, 1, 0.6, [[170, 40, 30], [220, 70, 50]], { amb: 0.6 }); pbDot(Q, hx - 6.6, hy - 4.8, [250, 240, 230], 0.2);   // грибок
  // ближняя рука и оружие
  if (bow) {
    const draw = a < -0.2 ? Math.min(1, -a) : 0;
    const bxh = tx + 11, byh = ty - 10;
    pbChain(Q, [[tx + 3, ty - 11, 1.9], [bxh - 3, byh, 1.5]], GR); pbBall(Q, bxh, byh, 1.4, 1.4, SKN, { soft: true });
    const top = [bxh - 1.6, byh - 13], bot = [bxh - 1.6, byh + 13];
    const arc = []; for (let i = 0; i <= 10; i++) { const t = i / 10; arc.push([bxh + 2.2 * Math.sin(t * Math.PI) - 0.4, byh - 13 + t * 26, 0.9]); }
    Q.path(arc, (t) => pbPick(C.WO, 0.6 - Math.abs(t - 0.5) * 0.4, 0.5));
    const nx = bxh - 1.6 - draw * 9, ny = byh;
    Q.path([[top[0], top[1], 0.3], [nx, ny, 0.3], [bot[0], bot[1], 0.3]], () => [230, 226, 210]);
    if (a < 0.5) { Q.path([[nx, ny, 0.4], [nx + 15, ny, 0.4]], () => C.WO[2]); pbPoly(Q, [[nx + 15, ny - 1], [nx + 18, ny], [nx + 15, ny + 1]], C.MAIL); for (const d of [-1, 1]) Q.path([[nx, ny, 0.3], [nx - 1.6, ny + d * 1.2, 0.3]], () => [200, 60, 50]); }
    pbChain(Q, [[tx + 3, ty - 11, 1.9], [nx, ny - 0.4, 1.5]], GR.slice(0, 4)); pbBall(Q, nx, ny, 1.3, 1.3, SKN, { soft: true });
  } else {
    const ang = pbArmAng(P), ex = tx + 3 + Math.cos(ang + 1.1) * 5, ey = ty - 11 + Math.sin(ang + 1.1) * 5, hx2 = ex + Math.cos(ang + 0.2) * 5, hy2 = ey + Math.sin(ang + 0.2) * 5;
    pbChain(Q, [[tx + 3, ty - 11, 2], [ex, ey, 1.7], [hx2, hy2, 1.4]], GR); pbBall(Q, hx2, hy2, 1.4, 1.4, SKN, { soft: true });
    const bx = Math.cos(ang - 0.6), by = Math.sin(ang - 0.6);
    Q.path([[hx2 - bx * 14, hy2 - by * 14, 0.6], [hx2 + bx * 20, hy2 + by * 20, 0.6]], () => C.WO[1]);
    const tx2 = hx2 + bx * 20, ty2 = hy2 + by * 20, px = -by, py = bx;
    pbPoly(Q, [[tx2 + px * 1.4, ty2 + py * 1.4], [tx2 + bx * 7, ty2 + by * 7], [tx2 - px * 1.4, ty2 - py * 1.4], [tx2 - bx * 1, ty2 - by * 1]], C.MAIL);
    pbPoly(Q, [[tx2 - bx * 2, ty2 - by * 2], [tx2 - bx * 3 + px * 3.4, ty2 - by * 3 + py * 3.4], [tx2 - bx * 5, ty2 - by * 5]], [[120, 30, 26], [170, 50, 36], [210, 80, 50]]);
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
// A — ледяной зверь-палач: тело из мутного льда одной «глиной» (как у дракона — чистые объёмы),
// по хребту и плечам растут острые друзы; голова — ледяной череп с клыкастой пастью, в глазницах голубой
// огонь и пар; в груди светится ядро, сквозь лёд видны тёмные трещины. Длинные руки, кисти — когти-сосульки.
function pbFrostA(Q, P) {
  const sw = P.leg, a = P.a, I = PBI.IC, open = P.mouth > 0.3 || a > 0.5;
  const ICE = [[18, 46, 86], [34, 78, 130], [62, 120, 176], [110, 170, 214], [170, 214, 240], [228, 246, 255]];
  pbShadow(Q, 18);
  Q.R(-22, -3, 22, 1.4, (x, y) => { const d = (x / 22) ** 2 + ((y + 0.6) / 2.4) ** 2; return d < 1 && Q.dth(x, y) < 0.55 - d * 0.5 ? [228, 244, 255, 0.7] : null; }, false);   // иней
  const crack = (x, y) => (Q.hsh(Math.floor(x * 1.1) * 5.3 + Math.floor(y * 1.1)) > 0.94 ? 0.16 : 0) + (Q.hsh(Math.floor(x / 4) * 3.7 + Math.floor(y / 4) * 9.1) > 0.85 ? -0.08 : 0);   // искры и мутные пятна во льду
  const facet = (pts, tone) => pbPoly(Q, pts, (x, y) => pbPick(ICE, tone + (Q.hsh(Math.floor(x * 0.7) * 2.3 + Math.floor(y * 0.7)) > 0.9 ? 0.1 : 0), Q.dth(x, y)));
  const shard = (x, y, ang, len, w) => { const cx = Math.cos(ang), cy = Math.sin(ang); facet([[x - cy * w, y + cx * w], [x + cx * len, y + cy * len], [x, y]], 0.9); facet([[x, y], [x + cx * len, y + cy * len], [x + cy * w, y - cx * w]], 0.48); };
  // дальние рука и нога — тёмная глина за телом
  const ang = P.up > 0.5 ? -2.7 : a > 0 ? 0.1 + a * 1.2 : a < -0.2 ? -2.2 : 0.35;
  pbBlob(Q, [{ c: [[-8, -38, 4], [-14, -24, 3.2], [-12, -10, 2.6]] }, { c: [[-5, -18, 5], [-7 - sw * 3, -9, 3.6], [-6 - sw * 4, -1, 3]] }], ICE.slice(0, 4), { amb: 0.38, k: 3, tex: crack });
  for (let k = 0; k < 3; k++) Q.path([[-12 + k * 0.8, -10, 0.7], [-13 + k * 1.4, -5, 0.15]], () => ICE[4]);   // когти дальней руки
  // тело: горб, грудь, бёдра, ближняя нога, шея — одна глина
  const sx = 8, sy = -38, ex = sx + Math.sin(ang + 0.4) * 12, ey = sy + Math.cos(ang + 0.4) * 12, wx = ex + Math.sin(ang) * 12, wy = ey + Math.cos(ang) * 12;
  const hx = 13 + (a > 0.5 ? 3 : 0), hy = -40 + (P.hurt > 0.5 ? 2 : 0);
  pbBlob(Q, [
    { e: [-4, -36, 13, 12] }, { e: [2, -26, 12, 10] }, { e: [0, -16, 9, 6] },
    { c: [[4, -18, 5.4], [5 + sw * 3, -9, 4], [5 + sw * 4, -1, 3.2]] },
    { c: [[6, -38, 7], [hx - 4, hy + 1, 5]] },
    { c: [[sx, sy, 5], [ex, ey, 3.6], [wx, wy, 2.8]] },
  ], ICE, { amb: 0.5, k: 7, depth: 10, tex: crack });
  // ядро в груди: светится сквозь лёд
  Q.R(-6, -34, 10, -18, (x, y) => { const d = Math.hypot(x - 2, (y + 26) * 1.1) / 7; return d < 1 && Q.dth(x, y) < 0.75 - d * 0.7 ? [150, 240, 255, 0.85] : null; }, false);
  pbBall(Q, 2, -26, 2.2, 2.6, [[150, 240, 255], [220, 255, 255], [255, 255, 255]], { amb: 0.7 });
  // друзы по хребту и плечам
  for (const [x, y, an, len, w] of [[-12, -44, -2.2, 10, 2], [-6, -47, -1.9, 13, 2.4], [0, -46, -1.6, 9, 1.8], [-15, -36, -2.6, 8, 1.6], [7, -44, -1.3, 7, 1.4], [-10, -26, -2.9, 6, 1.4]]) shard(x, y, an, len, w);
  // голова: ледяной череп
  pbBlob(Q, [{ e: [hx, hy - 3, 6.4, 5.6] }, { e: [hx + 5, hy - 1, 5, 3.6] }], ICE, { amb: 0.6, k: 2.4, depth: 5, tex: crack });
  for (const [ex2, w] of [[hx + 2.6, 2.6]]) {                                                    // глазница (в профиле одна): угловатый провал
    pbPoly(Q, [[ex2 - w, hy - 6], [ex2 + w, hy - 7], [ex2 + w * 0.7, hy - 2.8], [ex2 - w * 0.6, hy - 3]], [[2, 6, 18], [8, 18, 38]]);
    if (P.eye < 2) { Q.path([[ex2 - w * 0.5, hy - 4.6, 0.4], [ex2 + w * 0.6, hy - 5.2, 0.3]], () => [200, 252, 255]); Q.R(ex2 - w - 1, hy - 9, ex2 + w + 1, hy - 1, (x, y) => (Math.hypot(x - ex2, (y - hy + 5) * 1.6) < w + 1 && Q.dth(x, y) < 0.3 ? [120, 230, 255, 0.5] : null), false); }
  }
  facet([[hx - 3, hy - 8.2], [hx + 7, hy - 9], [hx + 8, hy - 7.2], [hx - 3, hy - 6.6]], 0.95);   // надбровье
  // пасть: ряды клыков-сосулек, челюсть отвисает
  const jaw = open ? 3.6 + P.mouth * 2 : 1.4;
  pbPoly(Q, [[hx + 1, hy + 0.6], [hx + 10, hy], [hx + 9.4, hy + 1 + jaw], [hx + 1, hy + 1.4 + jaw]], [[2, 6, 18], [10, 20, 40]]);
  facet([[hx + 1, hy + 1.4 + jaw], [hx + 9.4, hy + 1 + jaw], [hx + 8.6, hy + 3 + jaw], [hx + 1, hy + 3.4 + jaw]], 0.5);   // нижняя челюсть
  for (const [t, l] of [[0, 1], [2.6, 0.7], [5, 1.1], [7.2, 0.6]]) { facet([[hx + 1.6 + t, hy + 0.5], [hx + 2.4 + t, hy + 0.8 + jaw * l], [hx + 3.2 + t, hy + 0.4]], 0.95); }   // клыки: длинные и короткие вперемешку
  for (const [t, l] of [[1.4, 0.8], [4, 0.6], [6.4, 0.9]]) facet([[hx + 1.6 + t, hy + 1.4 + jaw], [hx + 2.4 + t, hy + 1.4 + jaw * (1 - l)], [hx + 3.2 + t, hy + 1.4 + jaw]], 0.9);
  if (P.eye < 2) for (let k = 0; k < 4; k++) pbDot(Q, hx + 4 + k * 1.2, hy - 9 - k * 1.8, [210, 240, 255], 0.35);   // пар
  // когти ближней руки: длинные сосульки
  const fa = Math.atan2(wy - ey, wx - ex);
  for (let f = 0; f < 4; f++) { const an = fa + (f - 1.5) * 0.3; shard(wx, wy, an, 7 + (f % 2) * 2, 0.9); }
  if (a > 0.5 || P.up > 0.5) for (const [dx, dy] of [[26, -24], [30, -14], [22, -32], [28, -6], [-18, -32]]) { Q.path([[dx - 1.4, dy, 0.25], [dx + 1.4, dy, 0.25]], () => I[5]); Q.path([[dx, dy - 1.4, 0.25], [dx, dy + 1.4, 0.25]], () => I[5]); }
  Q.outline([8, 24, 52]);
}
// B — дух вьюги: высокая иссохшая ледяная ведьма. Острый рваный капюшон, из-под него до пояса — космы инея.
// Лицо — вытянутый череп: косые глазницы с белыми искрами, провал носа, скулы, рот в крике с иглами зубов.
// Грудь раскрыта: рёбра, внутри бьётся ледяное сердце. Руки-кости до колен, пальцы-сосульки. Лохмотья
// савана рвёт ветер, низ рассыпается в позёмку.
function pbFrostB(Q, P) {
  const a = P.a, wind = (P.y || 0) * 1.5 + P.leg * 2, wail = P.mouth > 0.3 || a > 0.4 || P.up > 0.5, I = PBI.IC;
  const CL = [[10, 18, 36], [20, 34, 62], [36, 58, 96], [62, 96, 140], [104, 146, 186]], BONE = [[96, 128, 160], [150, 184, 212], [204, 226, 242], [238, 248, 255]];
  pbShadow(Q, 12);
  Q.R(-24, -14, 24, 1.4, (x, y) => { const d = (x / 24) ** 2 + ((y + 4) / 7) ** 2; return d < 1 && Q.dth(x * 1.3, y) < 0.6 - d * 0.55 ? [224, 240, 255, 0.72] : null; }, false);   // позёмка
  // лохмотья савана за спиной — рвёт ветер
  for (let k = 0; k < 6; k++) { const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([-4 - k * 1.2 - t * (12 + k * 2), -34 + k * 4 + t * (10 + k) + Math.sin(t * 5 + wind + k) * 1.6, 2.4 * (1 - t * 0.8)]); } pbChain(Q, pts, CL.slice(0, 4), { amb: 0.4 }); }
  // космы инея сзади
  for (let k = 0; k < 10; k++) { const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([-3 - k * 0.6 - t * (8 + k * 1.1), -54 + k * 0.6 + t * (26 + k * 0.6) + Math.sin(t * 6 + wind + k) * (0.6 + t * 1.4), 0.7 * (1 - t * 0.5)]); } Q.path(pts, (t) => pbPick(k % 3 ? [[150, 190, 224], [214, 236, 252]] : [[80, 120, 166], [120, 160, 200]], 0.8 - t * 0.5, 0.5)); }
  // дальняя рука — тёмная, за телом
  const up = P.up > 0.5 || a < -0.3, hit = a > 0.4;
  const arm = (s, ramp, amb) => {
    const sx = s * 4.6, sy = -42, ex = s * (up ? 10 : 8) + (hit && s > 0 ? 5 : 0), ey = up ? -52 : -28 + (hit && s > 0 ? -6 : 0), hx = s * (up ? 14 : 11) + (hit && s > 0 ? 14 : 0), hy = up ? -64 : -14 + (hit && s > 0 ? -12 : 0);
    pbBlob(Q, [{ c: [[sx, sy, 2.2], [ex, ey, 1.3], [hx, hy, 1.1]] }, { e: [hx, hy, 1.6, 1.3] }], ramp, { amb, k: 1.4, depth: 2 });
    const fa = Math.atan2(hy - ey, hx - ex);
    for (let f = 0; f < 4; f++) { const an = fa + (f - 1.5) * 0.28; Q.path([[hx, hy, 0.5], [hx + Math.cos(an) * 4.4, hy + Math.sin(an) * 4.4, 0.4], [hx + Math.cos(an + s * 0.3) * 9.6, hy + Math.sin(an + s * 0.3) * 9.6, 0.1]], (t) => (t > 0.55 ? I[5] : BONE[2])); }
  };
  arm(-1, BONE.slice(0, 3), 0.36);
  // саван: длинный, рваный, складки, дыры
  pbPoly(Q, [[-6, -46], [6, -46], [9, -30], [12, -14], [10, -5], [8, -10], [5, -3], [2, -9], [-1, -2], [-4, -8.6], [-7, -2.6], [-10, -9], [-12, -4], [-12.6, -16], [-9, -30]], (x, y) => {
    const fold = ((x * 0.8 + Math.sin(y * 0.22 + wind) * 1.4 + 30) % 3.6) < 0.7;
    if (Q.hsh(Math.floor(x * 0.6) * 9.1 + Math.floor(y * 0.6) * 2.3) > 0.94 && y > -26) return null;   // прорехи
    return pbPick(CL, 0.72 - (y + 46) / 44 * 0.42 - (x + 12) / 26 * 0.2 + (fold ? -0.2 : 0), Q.dth(x, y));
  });
  for (const x of [-11, -8, -5, -2, 1, 4, 7, 10]) Q.path([[x, -6 + Math.abs(x) * 0.15, 0.7], [x + 0.3, -1 + (x % 3 ? 2 : -0.6), 0.12]], () => I[4]);   // сосульки по подолу
  // раскрытая грудь: тёмный провал, рёбра, ледяное сердце
  pbBlob(Q, [{ e: [0, -35, 5, 7] }], [[4, 8, 18], [10, 18, 34], [18, 30, 52]], { amb: 0.3, k: 1, depth: 4 });
  Q.R(-3, -38, 3, -30, (x, y) => (Math.hypot(x, y + 34) < 3.4 && Q.dth(x, y) < 0.65 - Math.hypot(x, y + 34) / 6 ? [140, 236, 255, 0.85] : null), false);
  pbBall(Q, 0.3, -34, 1.4, 1.7, [[120, 220, 255], [210, 250, 255], [255, 255, 255]], { amb: 0.7 });
  for (let k = 0; k < 5; k++) { const y = -40.4 + k * 2.4; for (const s of [-1, 1]) Q.path([[s * 0.6, y, 0.45], [s * 3.6, y + 0.8, 0.4], [s * 4.8, y + 2.4, 0.25]], () => BONE[2 - (k % 2)]); }
  Q.path([[0, -41, 0.6], [0, -29, 0.5]], () => BONE[1]);                                        // грудина
  // капюшон: высокий, острый, рваный край
  pbPoly(Q, [[-7.4, -42], [-7, -52], [-3.6, -60], [0.6, -64], [3.6, -58], [7, -52], [7.4, -42], [5.6, -44.6], [4, -42.6], [2, -45], [0, -43.4], [-2, -45], [-4, -42.6], [-5.8, -44.6]], (x, y) => pbPick(CL, 0.5 - (x + 7) / 14 * 0.32 - (y + 64) / 22 * 0.1, Q.dth(x, y)));
  // космы спереди, из-под капюшона, обрамляют лицо
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([s * (3.6 + k * 0.9) + Math.sin(t * 4 + wind + k) * 0.6 * t, -53 + t * (18 + k * 3), 0.6 * (1 - t * 0.4)]); } Q.path(pts, (t) => pbPick([[150, 190, 224], [214, 236, 252], [244, 252, 255]], 0.8 - t * 0.4, 0.5)); }
  // лицо: вытянутый череп
  const hy = -51;
  pbBlob(Q, [{ e: [0, hy, 3.4, 4.4] }, { e: [0, hy + 3.4, 2.4, 2.6] }], BONE, { amb: 0.56, k: 1.6, depth: 2.4 });
  for (const s of [-1, 1]) {
    pbPoly(Q, [[s * 0.5, hy - 1.8], [s * 3, hy - 2.8], [s * 2.8, hy + 0.2], [s * 0.8, hy + 0.4]], [[2, 4, 12], [6, 12, 24]]);   // косые глазницы
    if (P.eye < 2) { pbDot(Q, s * 1.8, hy - 0.9, [255, 255, 255], 0.38); Q.R(s * 1.8 - 2.6, hy - 4, s * 1.8 + 2.6, hy + 2, (x, y) => (Math.hypot(x - s * 1.8, y - hy + 0.9) < 2.3 && Q.dth(x, y) < 0.28 ? [180, 240, 255, 0.5] : null), false); }
    Q.path([[s * 2.6, hy + 1, 0.25], [s * 1.6, hy + 2.8, 0.2]], () => BONE[0]);              // скулы
  }
  pbPoly(Q, [[-0.6, hy + 0.8], [0.6, hy + 0.8], [0, hy + 2.2]], [[6, 12, 24]]);               // провал носа
  if (wail) {
    pbBlob(Q, [{ e: [0, hy + 4.6, 1.5, 2 + P.mouth * 1.2] }], [[2, 4, 10], [8, 12, 24]], { amb: 0.25, k: 1, depth: 1 });
    for (let t = 0; t < 4; t++) { Q.path([[-1.1 + t * 0.73, hy + 3, 0.16], [-1.05 + t * 0.73, hy + 4, 0.06]], () => [240, 250, 255]); Q.path([[-1.1 + t * 0.73, hy + 6.4 + P.mouth, 0.16], [-1.05 + t * 0.73, hy + 5.4 + P.mouth, 0.06]], () => [220, 236, 250]); }
  } else { Q.path([[-1.6, hy + 4, 0.25], [1.6, hy + 4, 0.25]], () => [10, 16, 30]); for (let t = 0; t < 5; t++) Q.path([[-1.4 + t * 0.7, hy + 3.5, 0.1], [-1.4 + t * 0.7, hy + 4.5, 0.1]], () => [230, 244, 255]); }
  // венец сосулек: неровный, острый
  for (const [dx, h] of [[-4.8, 4], [-3, 7.4], [-1.2, 5], [0.6, 10.4], [2.4, 6], [4.2, 8], [5.6, 3.6]]) pbFacet(Q, [[dx - 0.7, -56 + Math.abs(dx) * 0.5], [dx + 0.2, -56 - h + Math.abs(dx) * 0.5], [dx + 0.8, -56 + Math.abs(dx) * 0.5]], 0.85);
  // ближняя рука — поверх
  arm(1, BONE, 0.5);
  for (const [dx, dy] of [[-20, -40], [18, -46], [-22, -24], [20, -28], [0, -70], [14, -62]]) pbDot(Q, dx, dy, I[5], 0.4);
  Q.outline([6, 18, 40]);
}
if (NA_SPEC.frost && PX_FINE > 1) Object.assign(NA_SPEC.frost, { w: 150, h: 112, ax: 72, ay: 98 });   // крупнее: шире холст под тесак и космы
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
  // голова павшего гнома — наш житель, только мёртвый: большие острые уши (одно надорвано), нос-картошка,
  // обвисшие щёки, окладистая борода с мхом и тиной; глазницы пустые, в глубине тлеют угольки,
  // под глазами — тёмные провалы, по лицу трещины, рот — щель с оскалом.
  const hy = bodyY - 7, EYE = H ? [[150, 255, 170], [230, 255, 230]] : [[255, 120, 220], [255, 220, 250]];
  for (const s of [-1, 1]) {                                                              // уши
    const tip = [X(s * 9), Y(hy - 0.6)];
    pbPoly(Q, [[X(s * 3.4), Y(hy + 1.6)], tip, [X(s * 7.6), Y(hy + 2.2)], [X(s * 3.6), Y(hy + 5)]], (x, y) => pbPick(T, 0.6 - Math.abs(x - X(0)) / 12 * 0.3, Q.dth(x, y)));
    if (s > 0) pbPoly(Q, [[X(6.4), Y(hy + 0.6)], [X(7.4), Y(hy + 1.2)], [X(6.8), Y(hy + 2)]], [[16, 10, 26]]);   // надрыв
  }
  pbBall(Q, X(0), Y(hy + 3.4), 4.4, 4.1, T, { amb: 0.56, tex: (x, y) => (Q.hsh(Math.floor(x * 1.4) * 2.7 + Math.floor(y * 1.4)) > 0.92 ? -0.25 : 0) });
  for (const s of [-1, 1]) pbBall(Q, X(s * 2.6), Y(hy + 5.2), 1.8, 1.4, T.slice(0, 3), { amb: 0.4, soft: true });   // обвисшие щёки
  for (const s of [-1, 1]) {                                                              // глазницы: провал, тлеющий уголёк
    pbBall(Q, X(s * 1.9), Y(hy + 2.6), 1.35, 1.4, [[8, 4, 14], [20, 12, 32]], { amb: 0.25 });
    pbDot(Q, X(s * 1.9), Y(hy + 2.7), EYE[0], 0.45); pbDot(Q, X(s * 1.9 - 0.2), Y(hy + 2.5), EYE[1], 0.15);
    Q.path([[X(s * 0.8), Y(hy + 1), 0.35], [X(s * 3.2), Y(hy + 1.6), 0.3]], () => T[0]);   // нахмуренные брови
    pbDot(Q, X(s * 2.4), Y(hy + 4.2), T[0], 0.5);                                         // синяки-провалы
  }
  Q.path([[X(-3), Y(hy + 0.6), 0.2], [X(-1.6), Y(hy + 2), 0.2], [X(-2.2), Y(hy + 3.6), 0.15]], () => T[0]);   // трещина
  pbBall(Q, X(0.2), Y(hy + 4.6), 1.6, 1.4, T, { amb: 0.66 });                            // нос-картошка
  if (V.mask) pbPoly(Q, [[X(-4.2), Y(hy + 5)], [X(4.2), Y(hy + 5)], [X(4), Y(hy + 7)], [X(-4), Y(hy + 7)]], [[40, 30, 60], [64, 50, 90]]);
  else {
    pbPoly(Q, [[X(-4.4), Y(hy + 5.6)], [X(-3.6), Y(hy + 9)], [X(-1.6), Y(hy + (H ? 13 : 12))], [X(0), Y(hy + (H ? 11.6 : 10.6))], [X(1.6), Y(hy + (H ? 13.4 : 12.4))], [X(3.6), Y(hy + 9)], [X(4.4), Y(hy + 5.6)], [X(0), Y(hy + 6.8)]], (x, y) => pbPick([[150, 146, 170], [196, 192, 214], [226, 222, 240], [244, 242, 252]], 0.74 - (y - oy - hy - 5) / 8 * 0.35 + ((((x - ox) * 2 + 20) % 2) < 0.4 ? -0.15 : 0), Q.dth(x, y)));
    for (const [mx, my] of [[-2.4, 8], [2.2, 9.6], [-0.4, 10.6]]) pbBall(Q, X(mx), Y(hy + my), 0.9, 0.6, [[50, 80, 50], [80, 116, 70]], { amb: 0.5, soft: true });   // мох и тина
    pbPoly(Q, [[X(-1.8), Y(hy + 6.4)], [X(1.8), Y(hy + 6.4)], [X(1.4), Y(hy + 7.6)], [X(-1.4), Y(hy + 7.6)]], [[10, 4, 10]]);   // рот-щель
    for (const tx of [-1.2, -0.4, 0.4, 1.2]) Q.path([[X(tx), Y(hy + 6.5), 0.18], [X(tx), Y(hy + 7.2), 0.1]], () => [230, 226, 206]);   // оскал
  }
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
  // Крыло — сплошной веер от широкого основания на спине (без зазора с телом): у основания кроющие
  // чешуёй, дальше второстепенные маховые, на краю длинные первостепенные с тёмными кончиками и
  // светлыми стержнями; по переднему краю — «кость» крыла.
  const wing = (dx, dark) => {
    const W = dark ? C.WB.slice(0, 4) : C.WB, n = P.wing.length;
    const tips = P.wing.map(([x, y]) => [x + dx, Y(y)]);
    const r0 = [27 + dx, Y(23.6)], r1 = [14 + dx, Y(24.4)], rc = [(r0[0] + r1[0]) / 2, (r0[1] + r1[1]) / 2];   // основание: от плеча до середины спины
    // угол каждой опорной точки от центра основания — по нему перо и его номер
    const ang = tips.map(([x, y]) => Math.atan2(y - rc[1], x - rc[0])), dist = tips.map(([x, y]) => Math.hypot(x - rc[0], y - rc[1]));
    const featherAt = (x, y) => {
      const a = Math.atan2(y - rc[1], x - rc[0]);
      let best = 0, bd = 9;
      for (let i = 0; i < n; i++) { let d = Math.abs(a - ang[i]); d = Math.min(d, Math.PI * 2 - d); if (d < bd) { bd = d; best = i; } }
      const j = best + (best < n - 1 && Math.abs(a - ang[best + 1]) < Math.abs(a - ang[Math.max(0, best - 1)]) ? 0.5 : -0.5);
      let u = best, lo = Math.max(0, Math.min(n - 2, Math.floor(j)));
      const a0 = ang[lo], a1 = ang[lo + 1]; if (a1 !== a0) u = lo + Math.max(0, Math.min(1, (a - a0) / (a1 - a0)));
      return u;
    };
    const poly = [r1, ...tips, r0];
    pbPoly(Q, poly, (x, y) => {
      const u = featherAt(x, y), i0 = Math.max(0, Math.min(n - 1, Math.round(u))), R = dist[Math.min(n - 1, Math.max(0, Math.floor(u)))] * (1 - (u % 1)) + dist[Math.min(n - 1, Math.ceil(u))] * (u % 1);
      const d = Math.hypot(x - rc[0], y - rc[1]) / Math.max(1, R);            // 0 у основания, 1 у края
      const fu = (u * 3) % 1, sep = fu < 0.14 && d > 0.42;                   // промежутки между маховыми
      let v = 0.62 - d * 0.18 + (i0 % 2 ? -0.05 : 0.04);
      if (d < 0.42) v += ((Math.floor(d * 14) + Math.floor(u * 4)) % 2 ? -0.1 : 0.06) + 0.06;   // кроющие чешуёй
      if (d > 0.8) v -= 0.3;                                                  // тёмные кончики
      if (sep) v -= 0.28;
      if (!sep && d > 0.45 && Math.abs(fu - 0.5) < 0.07) v += 0.2;            // светлый стержень пера
      return pbPick(W, v, Q.dth(x, y));
    });
    // зубчатый край: кончики маховых торчат за контур
    for (let i = 0; i < n; i++) { const [tx, tyy] = tips[i], a = ang[i]; Q.path([[tx - Math.cos(a) * 2, tyy - Math.sin(a) * 2, 0.8], [tx + Math.cos(a) * 1.6, tyy + Math.sin(a) * 1.6, 0.2]], () => W[0]); }
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
// Голова кракена над водой: бугристая, в пятнах и шрамах, слизь бликами; два огромных жёлтых глаза с
// горизонтальным зрачком-щелью и кровавыми прожилками под тяжёлыми складками век; по бокам поднимаются
// щупальца с присосками. f = 3 — моргает, остальные кадры — медленно щурится и дышит.
function pbKraEye(Q, a, f) {
  const blink = f === 3, sq = [1, 0.96, 0.9, 0, 0.92, 1][f % 6], C = PBS.KR, br = Math.sin(f / 6 * Math.PI * 2) * 0.6;
  // щупальца сзади
  for (const s of [-1, 1]) {
    const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([s * (27 - t * t * 13), -t * 30 + t * t * 6 + Math.sin(f * 1.1 + t * 3 + s) * 1, 3.2 * (1 - t * 0.85)]); }
    for (let i = 1; i < pts.length; i++) pbLimb(Q, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], pts[i - 1][2], pts[i][2], C, { amb: 0.46 });
    for (let i = 1; i < 11; i += 1.5) { const p = pts[Math.round(i)]; pbBall(Q, p[0] - s * p[2] * 0.55, p[1], p[2] * 0.42, p[2] * 0.34, [[214, 160, 176], [240, 200, 210]], { amb: 0.55 }); pbDot(Q, p[0] - s * p[2] * 0.55, p[1], C[1], p[2] * 0.14); }   // присоски
  }
  // голова: купол, бугры, пятна, шрамы
  pbBall(Q, 0, -2 + br, 24, 16 - br, C, { amb: 0.44, clip: (x, y) => y < -0.8, tex: (x, y) => {
    let v = Q.hsh(Math.floor(x * 1.2) * 3.7 + Math.floor(y * 1.2)) > 0.86 ? -0.22 : 0;
    if (Q.hsh(Math.floor(x / 3) * 5.3 + Math.floor(y / 3) * 2.1) > 0.8) v -= 0.1;               // тёмные пятна
    return v;
  } });
  for (const [x, y, r] of [[-17, -8, 2.2], [-12, -15, 1.6], [16, -9, 2], [11, -16, 1.5], [-3, -17.6, 1.2], [4, -16, 1], [20, -3.6, 1.6], [-21, -3, 1.6]]) { pbBall(Q, x, y + br, r + 0.6, r + 0.4, C.slice(1), { amb: 0.55 }); pbDot(Q, x - 0.4, y - 0.4 + br, C[4], r * 0.35); }   // бородавки
  Q.path([[-6, -15 + br, 0.35], [-1, -12 + br, 0.35], [2, -14.6 + br, 0.3]], () => [180, 120, 140]);   // старый шрам
  for (const [x, y] of [[-8, -14], [6, -13], [14, -6], [-15, -5]]) pbDot(Q, x, y + br, [250, 220, 240], 0.35);   // блики слизи
  // два глаза под складками век
  for (const [ex, er] of [[-8.6, 1], [8.6, 1]]) {
    const ey = -7.6 + br, ry = 5.6 * sq;
    pbBall(Q, ex, ey, 7.8, 6.6, C.slice(0, 3), { amb: 0.28 });                                  // впадина вокруг глаза
    if (!blink) {
      pbBall(Q, ex, ey, 6.6, ry, [[150, 104, 10], [214, 160, 28], [250, 206, 64], [255, 236, 146]], { amb: 0.62, tex: (x, y) => {
        const d = Math.hypot((x - ex) / 6.6, (y - ey) / Math.max(0.5, ry)), an = Math.atan2(y - ey, x - ex);
        return (Math.abs(Math.sin(an * 6 + d * 4)) < 0.1 && d > 0.5 ? -0.42 : 0) + (d > 0.88 ? -0.2 : 0);
      } });
      Q.R(ex - 5, ey - 2, ex + 5, ey + 2, (x, y) => (Math.abs(y - ey) < 0.8 * sq + 0.2 && Math.abs(x - ex) < 4.6 - Math.abs(y - ey) * 2 ? [8, 2, 4] : null));   // зрачок-щель
      for (const [ax, ay, bx, byy] of [[-6, -0.6, -3.4, -0.2], [5.6, -1.4, 3.2, -0.8], [5, 1.8, 2.8, 1], [-5.4, 1.6, -3, 0.8]]) Q.path([[ex + ax, ey + ay, 0.22], [ex + bx, ey + byy, 0.18]], () => [204, 36, 26]);
      pbDot(Q, ex - 2.4, ey - 2, [255, 255, 236], 0.55);
      Q.R(ex - 9, ey - 8, ex + 9, ey + 6, (x, y) => (Math.hypot(x - ex, (y - ey) * 1.3) < 8.4 && Math.hypot(x - ex, (y - ey) * 1.3) > 6.8 && Q.dth(x, y) < 0.25 ? [255, 200, 60, 0.45] : null), false);   // жёлтый отсвет
    } else Q.path([[ex - 6, ey, 0.5], [ex + 6, ey, 0.5]], () => C[0]);
    const inner = ex < 0 ? 1 : -1;                                                         // злой прищур: веко скошено к переносице
    Q.path([[ex - 7.4, ey - 5.4 + (inner > 0 ? -0.6 : 2.6), 1.6], [ex + 7.4, ey - 5.4 + (inner > 0 ? 2.6 : -0.6), 1.6]], (t, e) => (e ? C[0] : C[1]));   // косое веко: злой прищур к переносице
  }
  pbFoam(Q, -30, 30, -1);
  Q.outline([20, 6, 18]);
}
// Щупальце кракена: огромное, мускулистое, сверху тёмное в пятнах и шрамах, снизу бледное. По внутренней стороне
// два ряда присосок с ободками, между ними — костяные крючья; кончик — шипастая булава с жалом. Со щупальца
// стекает вода. idle — покачивается, rise — поднимается, atk — замах и удар, die — оседает.
function pbTent(Q, a, f, n) {
  const C = PBS.KR, PALE = [[150, 90, 120], [196, 134, 160], [230, 180, 200], [246, 214, 226]];
  let H = 64, bend = 0;
  if (a === 'idle') bend = Math.sin(f / n * Math.PI * 2) * 5;
  if (a === 'rise') H = 10 + f * 10;
  if (a === 'atk') { if (f < 3) { H = 64 + f * 6; bend = -f * 3.4; } else if (f < 6) { H = 82 - (f - 3) * 24; bend = 7 + (f - 3) * 5; } else { H = 10 + (f - 6) * 16; bend = 10 - (f - 6) * 3; } }
  if (a === 'die') { H = Math.max(0, 64 - f * 7); bend = Math.sin(f * 1.7) * 6; }
  const N = 22, pts = [];
  for (let i = 0; i <= N; i++) { const t = i / N, curl = t > 0.72 ? (t - 0.72) * (t - 0.72) * 120 : 0; pts.push([Math.sin(t * 2.2) * bend * t + bend * t * t * 0.8 + curl, -t * H + (t > 0.72 ? (t - 0.72) * (t - 0.72) * 50 : 0), 8.4 * (1 - t) + 1]); }
  // тело: тёмный верх, бледный низ (по стороне к присоскам), пятна и шрамы
  pbBlob(Q, [{ c: pts }], C, { amb: 0.44, k: 2, depth: 6, tex: (x, y) => {
    let v = Q.hsh(Math.floor(x * 0.9) * 4.1 + Math.floor(y * 0.9)) > 0.86 ? -0.18 : 0;
    if (Q.hsh(Math.floor(x / 2.6) * 7.7 + Math.floor(y / 2.6) * 1.3) > 0.84) v -= 0.12;
    return v;
  } });
  // бледная полоса брюшной стороны
  for (let i = 1; i <= N; i++) { const p0 = pts[i - 1], p1 = pts[i]; if (p0[2] < 1.6) continue; const dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy) || 1, nx = dy / l, ny = -dx / l; pbChain(Q, [[p0[0] - nx * p0[2] * 0.55, p0[1] - ny * p0[2] * 0.55, p0[2] * 0.42], [p1[0] - nx * p1[2] * 0.55, p1[1] - ny * p1[2] * 0.55, p1[2] * 0.42]], PALE, { amb: 0.5 }); }
  // два ряда присосок и крючья между ними
  for (let i = 2; i < N - 1; i++) {
    const p = pts[i], q = pts[i + 1], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1, nx = dy / l, ny = -dx / l, r = p[2];
    if (r < 1.4) continue;
    for (const off of [0.42, 0.78]) {
      const sx = p[0] - nx * r * off, sy = p[1] - ny * r * off, sr = r * (off > 0.6 ? 0.2 : 0.26) + 0.3;
      pbBall(Q, sx, sy, sr, sr, PALE, { amb: 0.62, rim: true });                                    // присоска: выпуклый ободок
      pbDot(Q, sx + 0.15, sy + 0.15, PALE[0], sr * 0.35);                                      // ямка
    }
    if (i % 3 === 0) Q.path([[p[0] - nx * r * 0.95, p[1] - ny * r * 0.95, 0.5], [p[0] - nx * (r + 2.4), p[1] - ny * (r + 2.4) + 0.8, 0.12]], () => [232, 220, 196]);   // крюк
  }
  // кончик — шипастая булава с жалом
  const tip = pts[N], tp = pts[N - 2];
  pbBall(Q, tip[0], tip[1], 2.6, 2.4, C, { amb: 0.5 });
  for (let k = 0; k < 6; k++) { const an = k / 6 * Math.PI * 2; Q.path([[tip[0] + Math.cos(an) * 2, tip[1] + Math.sin(an) * 2, 0.5], [tip[0] + Math.cos(an) * 4.4, tip[1] + Math.sin(an) * 4.4, 0.1]], () => [236, 226, 204]); }
  Q.path([[tip[0], tip[1], 0.6], [tip[0] + (tip[0] - tp[0]) * 1.6, tip[1] + (tip[1] - tp[1]) * 1.6, 0.1]], () => [250, 240, 210]);   // жало
  // стекающая вода
  for (const i of [4, 9, 14]) { const p = pts[i]; for (let k = 0; k < 3; k++) pbDot(Q, p[0] + p[2] + 0.6, p[1] + k * 2.2, PBS.WA[0], 0.35); }
  pbFoam(Q, -12, 12, 0.2, 1.3);
  if (a === 'atk' && f === 5) for (const [x, y] of [[-10, -6], [10, -10], [-14, -16], [14, -3], [0, -22]]) pbDot(Q, x, y, PBS.WA[1], 0.9);
  Q.outline([20, 6, 18]);
}
// Морской змей: легендарный, тёмный, с бирюзовым перламутром и светящимися красными глазами. Три кольца
// с рваными плавниками-гребнями и костяными шипами, голова дракона с короной рогов, жабры-плавники,
// длинные клыки; в атаке встаёт высоко и распахивает пасть. swim — кольца ходят волной, die — тонет.
function pbSerpent(Q, a, f, n) {
  const ph = f / n * Math.PI * 2, C = [[6, 22, 28], [12, 44, 50], [22, 74, 76], [40, 110, 100], [80, 156, 136], [150, 210, 180]];
  const FIN = [[60, 10, 18], [110, 24, 30], [168, 46, 40], [214, 90, 60]], BONE = [[150, 140, 112], [204, 194, 162], [238, 232, 210]];
  let rear = 0, sink = 0;
  if (a === 'atk') rear = f < 3 ? f * 7 : f < 6 ? 21 - (f - 3) * 5 : 6 - (f - 6) * 2;
  if (a === 'die') sink = f * 3.6;
  Q.R(-50, -3, 50, 3, (x, y) => (((x + 4) / 48) ** 2 + (y / 2.4) ** 2 < 1 && Q.dth(x, y) < 0.5 ? [4, 20, 28, 0.55] : null), false);   // тёмная тень в воде
  const scaleTex = (x, y) => (((Math.floor(x * 1.1) + Math.floor(y * 1.6) * 2) % 3 === 0) ? -0.14 : 0) + (Q.hsh(Math.floor(x * 0.7) * 5.1 + Math.floor(y * 0.7)) > 0.9 ? 0.22 : 0);
  // хвост с плавником-лопастью
  Q.path([[-48, 0, 0.6], [-44, -1.6 - Math.max(0, Math.sin(ph + 2) * 2.4) + sink * 0.3, 2], [-39, 0, 2.8]], () => C[2]);
  pbPoly(Q, [[-50, -1], [-56, -9 + Math.sin(ph) * 2.4], [-52, -4], [-57, -1 + Math.sin(ph) * 1.4], [-47, -2]], FIN);
  for (let k = 0; k < 3; k++) {
    const hx = -32 + k * 18, hh = Math.max(0, (Math.sin(ph - k * 1.4) * 0.5 + 0.75) * 12 - sink), r = 7.6;
    if (hh <= 0.5) continue;
    pbBall(Q, hx, 0, r + 1, hh, C, { amb: 0.46, clip: (x, y) => y <= 0, tex: scaleTex });
    pbBall(Q, hx - 1, -1, r - 2.2, hh * 0.4, C.slice(3), { amb: 0.38, clip: (x, y) => y <= 0 });
    // рваный гребень с костяными лучами
    pbPoly(Q, [[hx - 6, -hh * 0.9], [hx - 4.4, -hh - 6], [hx - 2.6, -hh - 2], [hx - 1, -hh - 7.4], [hx + 1, -hh - 2.6], [hx + 2.6, -hh - 6.6], [hx + 4, -hh - 1.4], [hx + 6, -hh * 0.88]], (x, y) => pbPick(FIN, 0.72 + (y + hh) / 9 * 0.4 + ((((x - hx) * 1.3) + 20) % 2 < 0.35 ? -0.3 : 0), Q.dth(x, y)));
    for (const ox of [-4.4, -1, 2.6]) Q.path([[hx + ox, -hh, 0.35], [hx + ox, -hh - 5.6, 0.12]], () => BONE[1]);
    for (const ox of [-6, 6]) Q.path([[hx + ox, -hh * 0.5, 0.6], [hx + ox * 1.25, -hh * 0.5 - 2, 0.12]], () => BONE[2]);   // шипы по бокам
    pbFoam(Q, hx - r - 2, hx + r + 2, 0.2);
  }
  // шея: толстая, чешуя, гребень
  const nh = Math.max(0, 16 + rear - sink), bx = 28, hx = 37 + rear * 0.35, hy = -nh;
  const neck = []; for (let i = 0; i <= 8; i++) { const t = i / 8; neck.push([bx + (hx - 5 - bx) * t + Math.sin(t * Math.PI) * -4, -t * nh, 6.4 - t * 1.6]); }
  for (let i = 1; i < neck.length; i++) { const p0 = neck[i - 1], p1 = neck[i]; pbLimb({ ...Q, L: (x0, y0, x1, y1, ra, rb, fn, sol) => Q.L(x0, y0, x1, y1, ra, rb, (t, e, cr) => (y0 + (y1 - y0) * t > 0.3 ? null : fn(t, e, cr)), sol) }, p0[0], p0[1], p1[0], p1[1], p0[2], p1[2], C, { tex: (t) => ((((i + t) * 1.6) % 1) < 0.18 ? -0.12 : 0) }); }
  for (let i = 2; i < 8; i += 1.5) { const p = neck[Math.round(i)]; pbPoly(Q, [[p[0] - 4, p[1] - 1], [p[0] - 8.4, p[1] - 4.4], [p[0] - 4.4, p[1] + 1.4]], FIN); }
  // голова дракона: массивная, корона рогов, жабры-плавники
  const open = a === 'atk' && f >= 3 && f < 7 ? 1 : 0;
  pbBall(Q, hx, hy - 2, 7.6, 5.4, C, { amb: 0.5, tex: scaleTex });
  pbPoly(Q, [[hx + 2, hy - 6], [hx + 15, hy - 3 - open * 2], [hx + 15.6, hy + 0.4 - open * 2], [hx + 2, hy + 1.2]], (x, y) => pbPick(C, 0.66 - (y - hy + 6) / 7 * 0.4 + scaleTex(x, y), Q.dth(x, y)));   // верхняя челюсть
  pbPoly(Q, [[hx + 2, hy + 1.2], [hx + 13, hy + 1 + open * 4.4], [hx + 12.4, hy + 3.4 + open * 5.4], [hx + 1, hy + 3.6]], C.slice(1));   // нижняя
  if (open) {
    pbPoly(Q, [[hx + 3, hy + 0.6], [hx + 14.6, hy - 0.6 - open * 2], [hx + 12.4, hy + 1.2 + open * 4.4], [hx + 3, hy + 2.8]], [[34, 4, 8], [80, 14, 20], [120, 30, 30]]);
    for (let t = 0; t < 5; t++) { pbPoly(Q, [[hx + 4.6 + t * 2, hy - 0.4], [hx + 5.3 + t * 2, hy + 2.6], [hx + 6 + t * 2, hy - 0.4]], BONE); pbPoly(Q, [[hx + 4.6 + t * 1.9, hy + 2.4 + open * 3], [hx + 5.2 + t * 1.9, hy + 0.2 + open * 3], [hx + 5.8 + t * 1.9, hy + 2.4 + open * 3]], BONE); }
    Q.path([[hx + 6, hy + 2, 0.4], [hx + 13, hy + 4 + Math.sin(f) * 1.4, 0.2]], () => [180, 40, 60]);   // язык
  } else for (let t = 0; t < 3; t++) pbPoly(Q, [[hx + 6 + t * 2.8, hy + 0.8], [hx + 6.7 + t * 2.8, hy + 4.2 - t * 0.4], [hx + 7.4 + t * 2.8, hy + 0.8]], BONE);   // клыки торчат вниз
  pbDot(Q, hx + 14, hy - 2.6, C[0], 0.45);
  // глаз: красный, светится, вертикальный зрачок, бровь-шип
  pbBall(Q, hx + 3, hy - 3.8, 1.8, 1.4, [[160, 20, 10], [230, 50, 20], [255, 130, 60], [255, 210, 150]], { amb: 0.7 });
  Q.path([[hx + 3.1, hy - 5, 0.2], [hx + 3.1, hy - 2.6, 0.2]], () => [10, 2, 2]);
  Q.R(hx - 2, hy - 8, hx + 8, hy + 1, (x, y) => (Math.hypot(x - hx - 3, (y - hy + 3.8) * 1.3) < 3.4 && Q.dth(x, y) < 0.3 ? [255, 60, 30, 0.5] : null), false);
  Q.path([[hx + 0.4, hy - 6, 0.7], [hx + 6, hy - 5, 0.3]], () => C[0]);
  // корона рогов: два больших назад, ряд малых
  for (const [ox, len, r, an] of [[-1, 12, 1.4, -2.5], [-3.6, 9, 1.2, -2.7], [1.6, 6, 0.8, -2.2], [-5.6, 6, 0.8, -2.9]]) { const pts = []; for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push([hx + ox + Math.cos(an) * len * t, hy - 6 + Math.sin(an) * len * t - Math.sin(t * Math.PI) * 1.4, r * (1 - t * 0.85)]); } Q.path(pts, (t) => pbPick(BONE, 0.85 - t * 0.5, 0.5)); }
  pbPoly(Q, [[hx - 4, hy - 1], [hx - 12, hy - 6], [hx - 10, hy - 1], [hx - 13, hy + 3], [hx - 4, hy + 1.6]], FIN);   // жабры-плавник
  for (const oy of [-0.6, 0.8]) Q.path([[hx - 4, hy + oy, 0.2], [hx - 10, hy + oy * 3, 0.15]], () => FIN[0]);
  pbFoam(Q, bx - 8, bx + 7, 0.2, 1.3);
  if (a === 'atk' && f === 5) for (const [x, y] of [[48, -12], [50, -5], [44, -20], [52, -16]]) pbDot(Q, x, y, PBS.WA[1], 0.8);
  Q.outline([4, 18, 24]);
}
if (typeof SEA_ART !== 'undefined') {
  Object.assign(SEA_ART.kraeye, { px: pbKraEye, pw: 68, ph: 40, pax: 34, pay: 34 });
  Object.assign(SEA_ART.tent, { px: pbTent, pw: 64, ph: 100, pax: 24, pay: 92 });
  Object.assign(SEA_ART.serpent, { px: pbSerpent, pw: 124, ph: 72, pax: 60, pay: 50 });
}

// ================= Драконы и чумной моховик (ветка dragon-shroom-pixel) =================
// Пиксельные звери «одной формой»: легендарный дракон, дракончик (и питомцы — его перекраска), чумной моховик.
// Метод Полудницы (fzNoonPx в fairy2.js): сетка ×3 мельче мирового, растеризатор fzPxKit, рампы палитры, дизеринг Байера,
// слои сзади вперёд, обводка в конце. Тело — ОДНА форма без швов: части заданы полями расстояний и слиты сглаженным
// минимумом, свет — по нормали общего поля. Подключается после fairy2.js и neutralart.js; кадры строятся лениво при первой отрисовке.
// Листы проверки — tools/pxdragshroom (sheet.html, dragons.html).

// ---------- поля расстояний ----------
const DS_smin = (a, b, k) => { if (k <= 0) return Math.min(a, b); const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const DS_cap = (ax, ay, bx, by, ra, rb) => {          // капсула с сужением
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  return (x, y) => { const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)); return Math.hypot(x - ax - dx * t, y - ay - dy * t) - (ra + (rb - ra) * t); };
};
const DS_ell = (cx, cy, rx, ry) => (x, y) => (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry);
const DS_sst = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const DS_pip = (x, y, poly) => {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
};
// точки кривой Безье (3 или 4 опорные) с радиусом r0 → r1
function DS_bez(pts, n, r0, r1) {
  const out = [];
  for (let k = 0; k <= n; k++) {
    const u = k / n; let q = pts.map(a => a.slice());
    while (q.length > 1) q = q.slice(1).map((b, i) => [q[i][0] + (b[0] - q[i][0]) * u, q[i][1] + (b[1] - q[i][1]) * u]);
    out.push([q[0][0], q[0][1], r0 + (r1 - r0) * u]);
  }
  return out;
}
const DS_tube = pts => { const fs = pts.slice(1).map((b, i) => DS_cap(pts[i][0], pts[i][1], b[0], b[1], pts[i][2], b[2])); return (x, y) => { let m = 1e9; for (const f of fs) m = Math.min(m, f(x, y)); return m; }; };
const DS_chain = (pts, o = {}) => pts.slice(1).map((b, i) => ({ f: DS_cap(pts[i][0], pts[i][1], b[0], b[1], pts[i][2], b[2]), ...o }));
const DS_LIGHT = (() => { const l = Math.hypot(-0.45, -0.72, 0.55); return [-0.45 / l, -0.72 / l, 0.55 / l]; })();

// Одно тело из частей: parts — [{f, k, mat, front, zone}] сзади вперёд. Геометрия = smin всех не-zone частей (k — радиус слияния).
// Нормаль общего поля + у front-частей своя нормаль, подмешанная плавно от края (никаких ободков на стыке).
// Материал — последняя часть, внутри которой пиксель (zone-части только красят). mats: {имя: рампа тёмный → светлый}.
function DS_body(K, parts, mats, o) {
  const { P, dth } = K, [x0, y0, x1, y1] = o.bb, w = x1 - x0 + 1, h = y1 - y0 + 1, N = w * h;
  const D = parts.map(() => new Float32Array(N)), U = new Float32Array(N), OW = new Int16Array(N), Wd = o.W || 7, amb = o.amb ?? 0.2;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = x0 + i, y = y0 + j, id = j * w + i; let u = 1e9;
    let best = 1e9, ow = 0;
    for (let k = 0; k < parts.length; k++) { const q = parts[k], d = q.f(x, y); D[k][id] = d; if (!q.zone) { u = u === 1e9 ? d : DS_smin(u, d, q.k ?? o.k ?? 4); if (d < best) { best = d; ow = k; } } }
    U[id] = u; OW[id] = ow;
  }
  const nrm = (A, i, j, W) => {
    const ix = Math.max(1, Math.min(w - 2, i)), jy = Math.max(1, Math.min(h - 2, j));
    let gx = A[jy * w + ix + 1] - A[jy * w + ix - 1], gy = A[(jy + 1) * w + ix] - A[(jy - 1) * w + ix];
    const l = Math.hypot(gx, gy) || 1; gx /= l; gy /= l;
    const s = Math.min(1, Math.max(0, -A[j * w + i] / W)), nz = Math.sqrt(1 - (1 - s) ** 2), q = Math.sqrt(Math.max(0, 1 - nz * nz));
    return [gx * q, gy * q, nz];
  };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const id = j * w + i; if (U[id] > 0) continue;
    const x = x0 + i, y = y0 + j;
    let n = nrm(U, i, j, Wd), mat = o.mat || 'skin';
    for (let k = 0; k < parts.length; k++) {
      const q = parts[k], d = D[k][id];
      if (q.mat && d < (q.zone ? 0 : 0.5)) mat = q.mat;
      if (q.front && d < 0) {
        const wt = DS_sst(0, q.fw || 4, -d), m = nrm(D[k], i, j, q.W || Wd);
        n = [n[0] + (m[0] - n[0]) * wt, n[1] + (m[1] - n[1]) * wt, n[2] + (m[2] - n[2]) * wt];
        const l = Math.hypot(...n) || 1; n = [n[0] / l, n[1] / l, n[2] / l];
      }
    }
    if (o.mat2) {
      const ix = Math.max(1, Math.min(w - 2, i)), jy = Math.max(1, Math.min(h - 2, j)), gx = U[jy * w + ix + 1] - U[jy * w + ix - 1], gy = U[(jy + 1) * w + ix] - U[(jy - 1) * w + ix], gl = Math.hypot(gx, gy) || 1;
      mat = o.mat2(x, y, n, mat, parts[OW[id]], gx / gl, gy / gl, -U[id]) || mat;
    }
    let v = amb + (1 - amb) * Math.max(0, n[0] * DS_LIGHT[0] + n[1] * DS_LIGHT[1] + n[2] * DS_LIGHT[2]);
    if (n[1] > 0.55) v += 0.06;                                                         // отражённый свет снизу
    if (o.light) v += o.light(x, y, mat, v);
    const ramp = mats[mat], idx = Math.max(0, Math.min(ramp.length - 1, Math.floor((v + (dth(x, y) - 0.5) * (o.dither ?? 0.16)) * ramp.length)));
    P(x, y, (o.tex && o.tex(x, y, mat, idx, ramp, v)) || ramp[idx]);
  }
  return { at: (x, y) => { const i = Math.round(x) - x0, j = Math.round(y) - y0; return i < 0 || j < 0 || i >= w || j >= h ? 1e9 : U[j * w + i]; } };
}

// ================= Чумной моховик =================
// Живой гриб с лицом на ножке: сиреневая шляпка в белых пятнах, пластинки снизу, зелёная плесень и споры.
// Ножка, ступни и ручки — одна форма (слиты), без воротничка. Шляпка — отдельная форма над ножкой.
// mode: 'idle' (p 0..5, на p4 моргает), 'walk' (p 0..5), 'atk' (p 0..1 замах: шляпка назад, ручки вверх; p 2..5 удар шляпкой и облако спор),
// 'hurt' (p 0..1: вспышка, отшатнулся), 'die' (p 0..5: удар → оседает → шляпка падает набок, выдох спор → рассыпается),
// 'win' (p 0..3: ручки вверх, подпрыгивает). Сетка 132×132 (мир 44×44).
function fzShroomPx(mode, p) {
  const K = fzPxKit(132, 132, 66, 120), { P, R, L, dth, hsh } = K, BB = [-66, -120, 65, 11];
  const t = p / 6 * Math.PI * 2;
  const CP = [[46, 20, 80], [80, 40, 120], [118, 64, 160], [156, 96, 196], [192, 136, 224], [226, 184, 244]];
  const ST = [[92, 90, 70], [128, 126, 98], [166, 166, 132], [202, 202, 168], [230, 230, 198], [250, 248, 226]];
  const SPT = [[176, 160, 196], [214, 200, 230], [240, 232, 250], [255, 252, 255]];
  const MOLD = [[60, 110, 40], [96, 156, 56], [138, 202, 84], [184, 236, 120]];
  const GL = [[48, 30, 60], [84, 46, 96]];
  const PL = [[96, 160, 52], [150, 218, 86], [206, 252, 140]];
  const OUT = [34, 14, 38];
  const walk = mode === 'walk', atk = mode === 'atk', wind = atk && p < 2, smash = atk && p >= 2;
  const hurt = mode === 'hurt', die = mode === 'die', win = mode === 'win', down = die && p >= 3;
  const bob = (walk ? -Math.round(Math.abs(Math.sin(t)) * 2) : mode === 'idle' ? Math.round(Math.sin(t)) : wind ? 2 : hurt ? 1 + p
    : win ? -[0, 5, 2, 0][p] : die ? [1, 4, 14, 22, 22, 22][p] : 0) - 13;   // −13: тело выше, ноги длиннее
  const tilt = walk ? Math.round(Math.sin(t - 0.8) * 2.4) : mode === 'idle' ? Math.round(Math.sin(t - 0.6) * 1.8) : wind ? -6 : hurt ? -5 : win ? 0 : die ? [-6, -10, -14, 0, 0, 0][p] : 6;
  const cx = down ? -24 : tilt, cy = down ? -28 : -70 + bob + (smash ? 5 : wind ? -3 : die && p === 2 ? 6 : 0), crx = 41, cry = 28;
  const capA = die ? [0, -0.1, -0.45, -1.25, -1.25, -1.25][p] : 0, ca = Math.cos(capA), sa = Math.sin(capA);
  const capR = f => (x, y) => { const dx = x - cx, dy = y - cy; return f(cx + dx * ca + dy * sa, cy - dx * sa + dy * ca); };
  const lean = smash ? 4 : wind ? -3 : hurt ? -3 : die ? -6 : tilt * 0.4;                // ножка клонится вслед за шляпкой

  // споры (за телом)
  const spore = front => {
    for (let k = 0; k < 12; k++) {
      if ((k % 2 === 0) !== front) continue;
      const x = -46 + hsh(k * 2.3) * 92 + Math.sin(t + k) * 3, y = -82 + ((k * 7 + p * 5) % 30) * 1.2;
      if (Math.abs(x) < 40 && y > cy - 24) continue;
      P(x, y, PL[1 + (k & 1)], 0.8, false); if (k % 3 === 0) P(x + 1, y, PL[2], 0.6, false);
    }
  };
  spore(false);

  // ---- ножка, ступни и ручки одной формой ----
  const sx = y => lean * Math.min(1, Math.max(0, (-y - 12) / 52));
  const parts = [
    { f: DS_cap(0, -22 + bob, sx(-38), -38 + bob, 14, 17), k: 4 },
    { f: DS_cap(sx(-38), -38 + bob, sx(-64), -64 + bob, 17, 12), k: 6 },
  ];
  if (-24 + bob < -14) for (const [x, ph] of [[-9, Math.PI], [9, 0]]) {
    const sv = walk ? Math.sin(t + ph) * 8 : 0, lift = walk ? Math.max(0, Math.cos(t + ph)) * 6 : 0, fy = -4 - lift, fx = x + sv;
    const kn = [x + sv * 0.5 + 1.5, -17 - lift * 0.6];                                // колено чуть вперёд
    parts.push({ f: DS_cap(x * 0.7, -24 + bob, kn[0], kn[1], 6.6, 5.4), k: 6, front: true, fw: 3 }, { f: DS_cap(kn[0], kn[1], fx, fy, 5.4, 4.8), k: 2.5 }, { f: DS_ell(fx + 2, fy + 1, 8.4, 4.2), k: 4, front: true, fw: 3, W: 4 });
  }
  const hands = [];
  for (const side of [-1, 1]) {
    const ph = walk ? Math.sin(t + (side > 0 ? 0 : Math.PI)) * 5 : 0, sh = [sx(-46) + side * 13, -46 + bob];
    let hx, hy;
    if (wind) { hx = sh[0] + side * 6; hy = sh[1] - 22; }
    else if (win) { hx = sh[0] + side * (15 + (p & 1) * 2); hy = sh[1] - 2 - (p === 1 ? 3 : 0); }   // торжество: кулачки в стороны
    else if (hurt) { hx = sh[0] + side * 8 + 4; hy = sh[1] - 6; }
    else if (die) { hx = sh[0] + side * (9 + (p > 1 ? 3 : 0)); hy = sh[1] + (p > 1 ? 9 : 14); }
    else if (smash) { hx = sh[0] + 18 - (side < 0 ? 6 : 0); hy = sh[1] + 4 + (p & 1) * 2; }
    else { hx = sh[0] + side * 11 + ph * 0.3; hy = sh[1] + 15 + (mode === 'idle' ? Math.round(Math.sin(t + side)) : 0); }
    parts.push({ f: DS_cap(sh[0], sh[1], hx, hy, 5, 3.8), k: 6, front: side > 0, fw: 3 }, { f: DS_ell(hx, hy + 1, 4.8, 4.4), k: 3 });
    hands.push([hx, hy]);
  }
  const stalk = DS_body(K, parts, { skin: ST }, {
    bb: BB, W: 9, k: 5,
    light: (x, y) => -0.3 * (1 - DS_sst(cy + 3, cy + 16, y)),
    tex: (x, y, mat, idx, ramp) => {
      const v = hsh(Math.floor(x / 2) * 7 + Math.floor((y - bob) / 2) * 13);
      if (v > 0.93 && ((x + y) & 1) === 0) return MOLD[Math.max(0, Math.min(3, idx - 1))];                 // плесень по свету формы
      return null;
    },
  });
  for (const [hx, hy] of hands) for (let k = -1; k <= 1; k++) P(hx + k * 2, hy + 5, ST[1]);               // пальчики

  // ---- лицо: злое — брови резко сведены, глаза-щёлки с ядовитым огнём, складки на переносице, оскал с кривыми зубами ----
  const fx = sx(-32) + 3, fy = -33 + bob, jw = smash ? 5 : wind || hurt || die || win ? 3 : 1;
  const blink = (mode === 'idle' && p === 4) || hurt || (die && p === 0), xeye = die && p > 0;
  for (const [ex, sd] of [[fx - 6, -1], [fx + 8, 1]]) {
    R(ex - 7, fy - 7, ex + 7, fy + 6, (x, y) => {                                                        // впалые тёмные глазницы
      const d = Math.hypot((x - ex) / 6.2, (y - fy) / 5.4);
      return d <= 1 && dth(x, y) < (1 - d) * 2.4 ? (d < 0.7 ? [84, 40, 92] : [126, 96, 122]) : null;
    });
    if (xeye) { L(ex - 3, fy - 2, ex + 3, fy + 3, 0.8, 0.8, () => OUT); L(ex - 3, fy + 3, ex + 3, fy - 2, 0.8, 0.8, () => OUT); }
    else if (blink) L(ex - 4, fy + 1, ex + 4, fy, 1, 1, () => OUT);
    else R(ex - 5, fy - 4, ex + 5, fy + 4, (x, y) => {
      if (((x - ex) / 4.4) ** 2 + ((y - fy - 0.5) / 3.2) ** 2 > 1) return null;
      if (y < fy - 1 - sd * (x - ex) * 0.75 - (smash ? 1 : 0)) return null;                         // веко срезано бровью к переносице
      if (Math.abs(x - ex + sd * 0.8) < 1 && Math.abs(y - fy - 0.6) < 1.6) return [150, 10, 14];   // зрачок-уголёк
      return Math.hypot(x - ex, y - fy) < 2.4 ? [226, 250, 110] : [176, 214, 64];
    });
    L(ex + sd * 6.5, fy - 6.5, ex - sd * 5, fy - 1.5, 1.6, 1.3, () => GL[0]);                            // бровь: снаружи высоко, к носу низко
    P(ex + sd * 7, fy - 7, GL[0]);
  }
  for (const dx of [0, 2]) L(fx + dx, fy - 7, fx + dx + (dx ? 0.5 : -0.5), fy - 2, 0.6, 0.6, () => ST[1]);   // складки на переносице
  P(fx + 1, fy + 2, ST[1]); P(fx, fy + 3, ST[0]); P(fx + 2, fy + 3, ST[0]);                               // ноздри
  L(fx - 4, fy + 2, fx - 8, fy + 8, 0.6, 0.6, () => ST[1]); L(fx + 6, fy + 2, fx + 10, fy + 8, 0.6, 0.6, () => ST[1]);   // носогубные складки
  const mx = fx + 1, top = x => fy + 7 + ((x - mx) / 8) ** 2 * 2.5, bot = x => top(x) + 2 + jw * Math.max(0, 1 - ((x - mx) / 9.5) ** 2);
  R(mx - 10, fy + 5, mx + 10, fy + 16 + jw, (x, y) => {                                                     // оскал: уголки вниз
    if (Math.abs(x - mx) > 9.5 || y < top(x) || y > bot(x)) return null;
    if (y > bot(x) - 1.5 && Math.abs(x - mx) < 5 && jw > 2) return [190, 60, 80];
    return [46, 8, 26];
  });
  for (let k = -3; k <= 3; k++) {
    const x = mx + k * 2.6, tl = (k === -2 || k === 2) ? 3 : (k & 1) ? 1 : 2;                             // верхние: клыки длиннее, кривые
    for (let q = 0; q < tl; q++) P(x + (q === 2 ? (k < 0 ? -0.6 : 0.6) : 0), top(x) + 0.5 + q, q ? ST[4] : ST[5]);
    if (jw > 1 && Math.abs(k) < 3) { const yb = bot(x); P(x + 1, yb - 0.5, ST[4]); if (k % 2 === 0) P(x + 1, yb - 1.5, ST[5]); }
  }
  for (const [dx, dy] of [[-12, 8], [12, 12], [-9, 20]]) if (stalk.at(fx + dx, fy + dy) < -1) { P(fx + dx, fy + dy, PL[1]); P(fx + dx + 1, fy + dy, PL[0]); P(fx + dx, fy + dy + 1, PL[0]); }

  // ---- шляпка: пластинки снизу узкой дугой, купол одной формой, пятна красятся по его свету ----
  const yb = x => cy + 3 + 4 * Math.max(0, 1 - ((x - cx) / crx) ** 2), capF = capR((x, y) => Math.max(DS_ell(cx, cy + 3, crx, cry + 7)(x, y), y - yb(x)));
  const spots = [[-26, -8, 6, 4.4], [-6, -17, 7.4, 5], [16, -9, 6.4, 4.4], [31, -1, 4.6, 3.2], [-14, 0, 3.6, 2.4], [4, -2, 3, 2]];
  DS_body(K, [{ f: capF }, ...spots.map(([a, b, rx, ry]) => ({ f: capR(DS_ell(cx + a, cy + b, rx, ry)), zone: true, mat: 'spot' }))], { cap: CP, spot: SPT }, {
    bb: BB, W: 16, mat: 'cap', amb: 0.24,
    tex: (x, y, mat, idx, ramp) => mat === 'cap' && hsh(Math.floor(x / 2) * 11 + Math.floor(y / 2) * 5) > 0.93 && ((x + y) & 1) === 0 ? MOLD[Math.min(3, idx)] : null,
  });
  // слизь с края шляпки
  if (!capA) for (const [dx, len] of [[-30, 5], [-14, 8], [6, 4], [22, 7], [35, 3]]) {
    const L2 = len + (walk ? Math.round(Math.sin(t + dx) * 1.5) : 0) + (smash ? 3 : 0);
    for (let y = 0; y < L2; y++) { const c = y > L2 - 2 ? PL[2] : PL[1]; const y0 = Math.floor(yb(cx + dx)) + 1; P(cx + dx, y0 + y, c); P(cx + dx + 1, y0 + y, y === 0 ? PL[1] : PL[0]); }
  }

  // облако спор при ударе
  if (smash) {
    const k0 = (p - 2) / 3;
    R(cx + 28, cy - 30, cx + 70, cy + 40, (x, y) => {
      const d = Math.hypot((x - cx - 48 - k0 * 6) / (16 + k0 * 8), (y - cy - 12) / (22 + k0 * 4));
      if (d > 1) return null;
      return dth(x, y) < (1 - d) * 1.4 ? [...PL[1 + (hsh(x * 5 + y * 3) > 0.6 ? 1 : 0)], 0.8] : null;
    }, false);
    for (let k = 0; k < 14; k++) P(cx + 34 + hsh(k + p) * 34, cy - 22 + hsh(k * 2 + p * 3) * 50, PL[2], 0.9, false);
  } else if (wind) for (let k = 0; k < 6; k++) P(cx + hsh(k) * 70 - 35, cy - 36 - hsh(k + 4) * 14, PL[1], 0.7, false);
  if (die && p >= 2) {                                                                     // предсмертный выдох спор
    const r0 = 22 + (p - 2) * 9, dn = 1.5 - (p - 2) * 0.25;
    R(-r0 - 10, -40 - r0, r0 + 10, 4, (x, y) => {
      const d = Math.hypot(x / (r0 + 8), (y + 26) / r0);
      return d < 1 && d > 0.35 && dth(x, y) < (1 - d) * dn ? [...PL[1 + (hsh(x * 5 + y * 3) > 0.6 ? 1 : 0)], 0.75] : null;
    }, false);
  }
  if (!die || p < 4) spore(true);
  K.outline([0, 0, 0], 1, 2);
  const cv = K.done();
  const flash = hurt || (die && p === 0) ? 0.38 : 0, fade = die ? [0, 0, 0, 0, 0.45, 0.82][p] : 0;
  if (flash || fade) {                                                                     // вспышка удара; рассыпание пикселями (Байер)
    const g = cv.getContext('2d'), im = g.getImageData(0, 0, cv.width, cv.height), D = im.data;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
      const i = (y * cv.width + x) * 4; if (!D[i + 3]) continue;
      if (fade && (FZ_B4[y & 3][x & 3] + 0.5) / 16 < fade) { D[i + 3] = 0; continue; }
      const k = flash + fade * 0.35; for (let c = 0; c < 3; c++) D[i + c] += (236 - D[i + c]) * k;
    }
    g.putImageData(im, 0, 0);
  }
  return cv;
}
const DS_inE2 = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
function fzShroomSprite(mode, p) { return fzPxSprite('sh' + mode + p, 44, 44, 22, 40, () => fzShroomPx(mode, p)); }

// Драконы в пиксель-арте методом Полудницы (сетка ×3 мельче мирового, fzPxKit, рампы, Байер, обводка) с телом одной формой
// без швов (DS_body выше: поля расстояний + smin, свет по общей нормали).
//  • Взрослый — легендарный: изумруд, золотое брюхо из пластин с тлеющим огнём в щелях, корона рогов, гребень шипов, хвост с лезвием.
//  • Дракончик — пухлый малыш той же породы: та же палитра, пластины, рожки-бугорки, круглые шипики, крылышки; крупная голова, большие глаза.
// Режимы обоих: 'idle' (6, моргание на p4), 'fly' (8, взмах крыльев), 'flyatk' (6, огонь в полёте — вниз-вперёд), 'sleep' (6, спит в гнезде);
// у взрослого ещё 'walk' (6) и 'atk' (6: p0..1 вдох, p2..5 огонь стоя). Смотрят вправо, низ — y = 0.

const DR = {
  SK: [[8, 26, 26], [12, 44, 40], [18, 68, 54], [28, 98, 70], [44, 130, 84], [78, 168, 100], [140, 212, 132], [206, 244, 176]],
  SKF: [[6, 18, 20], [9, 32, 32], [14, 50, 44], [22, 74, 58], [34, 100, 70]],
  BE: [[128, 84, 34], [176, 124, 50], [214, 166, 72], [240, 204, 110], [255, 234, 164]],
  BEF: [[96, 62, 26], [140, 98, 40], [176, 132, 58]],
  HO: [[64, 42, 22], [124, 88, 44], [190, 152, 86], [234, 206, 140], [255, 244, 206]],
  HOF: [[44, 30, 18], [86, 62, 34], [134, 104, 62]],
  CL: [[56, 48, 40], [116, 104, 86], [184, 170, 142], [238, 228, 202]], CLF: [[36, 32, 28], [74, 66, 56], [120, 110, 92]],
  MEM: [[12, 34, 46], [18, 56, 66], [28, 84, 84], [44, 116, 102], [74, 156, 124], [120, 196, 146]],
  EMB: [[190, 56, 18], [255, 128, 36], [255, 198, 84], [255, 246, 190]],
  FL: [[150, 28, 18], [226, 76, 22], [255, 142, 36], [255, 208, 84], [255, 250, 206]],
  OUT: [10, 20, 18],
};
const DS_rot = (S, v, a) => [S[0] + v[0] * Math.cos(a) - v[1] * Math.sin(a), S[1] + v[0] * Math.sin(a) + v[1] * Math.cos(a)];

// Крыло: локоть назад, запястье вперёд, 4 пальца; перепонка складками у пальцев и с жилками; кости — одна форма.
// a — поворот вокруг плеча S (+ вверх), sc — масштаб (малыш ~0.45), fold 0..1 — сложено вдоль спины.
function DS_wing(K, S, a, near, sc, fold) {
  const { R, dth } = K;
  const OPEN = { E: [-20, -24], W: [-14, -58], T: [[-68, -70], [-90, -44], [-82, -14], [-56, -1]], A: [-30, 13] };
  const FOLD = { E: [-16, -4], W: [-40, -12], T: [[-72, -8], [-74, -3], [-66, 2], [-50, 6]], A: [-30, 10] };
  const mx = (q, f) => [q[0] + (f[0] - q[0]) * fold, q[1] + (f[1] - q[1]) * fold];
  const s = sc * (near ? 1.06 : 1), V = q => DS_rot(S, [q[0] * s, q[1] * s], a);
  const E = V(mx(OPEN.E, FOLD.E)), Wr = V(mx(OPEN.W, FOLD.W)), T = OPEN.T.map((q, i) => V(mx(q, FOLD.T[i]))), A = V(mx(OPEN.A, FOLD.A));
  const pull = (a2, b) => { const m = [(a2[0] + b[0]) / 2, (a2[1] + b[1]) / 2]; return [m[0] + (Wr[0] - m[0]) * 0.27, m[1] + (Wr[1] - m[1]) * 0.27]; };
  const sag = [pull(T[0], T[1]), pull(T[1], T[2]), pull(T[2], T[3]), pull(T[3], A)];
  const poly = [S, E, Wr, T[0], sag[0], T[1], sag[1], T[2], sag[2], T[3], sag[3], A];
  const fing = T.map(q => DS_cap(Wr[0], Wr[1], q[0], q[1], 0, 0));
  const vein = sag.slice(0, 3).map(q => DS_cap(Wr[0] + (q[0] - Wr[0]) * 0.15, Wr[1] + (q[1] - Wr[1]) * 0.15, q[0], q[1], 0, 0));
  const xs = poly.map(q => q[0]), ys = poly.map(q => q[1]), M = near ? DR.MEM : DR.MEM.slice(0, 4);
  R(Math.min(...xs) - 1, Math.min(...ys) - 1, Math.max(...xs) + 1, Math.max(...ys) + 1, (x, y) => {
    if (!DS_pip(x, y, poly)) return null;
    const fd = Math.min(...fing.map(f => f(x, y))), vd = sc > 0.6 ? Math.min(...vein.map(f => f(x, y))) : 9;
    let v = 0.22 + 0.5 * Math.min(1, Math.hypot(x - Wr[0], y - Wr[1]) / (80 * sc)) + (near ? 0.12 : -0.04) - fold * 0.08;
    if (fd < 3.5 * sc + 0.5) v -= 0.14 * (1 - fd / (3.5 * sc + 0.5));                    // складка у пальца
    if (vd < 0.75) v += 0.13;                                                              // жилка
    return M[Math.max(0, Math.min(M.length - 1, Math.floor((v + (dth(x, y) - 0.5) * 0.2) * M.length)))];
  });
  const rr = r => r * (0.45 + 0.55 * sc);
  const bones = [{ f: DS_cap(S[0], S[1], E[0], E[1], rr(4), rr(3.4)) }, { f: DS_cap(E[0], E[1], Wr[0], Wr[1], rr(3.4), rr(2.8)) }];
  for (const q of T) bones.push({ f: DS_cap(Wr[0], Wr[1], q[0], q[1], rr(2.6), rr(1)) });
  const th = V(mx([-8, -68], [-36, -24])); bones.push({ f: DS_cap(Wr[0], Wr[1], th[0], th[1], rr(2.2), 0.3), mat: 'horn', k: 1.5 });
  for (const q of T) { const d = Math.hypot(q[0] - Wr[0], q[1] - Wr[1]) || 1, l = 4 * sc + 1; bones.push({ f: DS_cap(q[0], q[1], q[0] + (q[0] - Wr[0]) / d * l, q[1] + (q[1] - Wr[1]) / d * l, rr(1.3), 0.2), mat: 'horn', k: 1 }); }
  DS_body(K, bones, near ? { skin: DR.SK, horn: DR.HO } : { skin: DR.SKF, horn: DR.HOF },
    { bb: [Math.round(Math.min(...xs)) - 8, Math.round(Math.min(...ys)) - 8, Math.round(Math.max(...xs)) + 8, Math.round(Math.max(...ys)) + 8], W: 3 * sc + 0.5, k: 2.5 * sc + 0.5 });
}

// Лапа дракона: цепочка суставов pts [[x, y, r], …] (бедро → … → подушечка), три пальца веером под углом ta, загнутые когти.
function DS_dLeg(pts, ta, sc, extra = []) {
  const out = [{ f: DS_cap(...pts[0].slice(0, 2), ...pts[1].slice(0, 2), pts[0][2], pts[1][2]), front: true, fw: 7 * sc, W: 9 * sc, k: 6 * sc }];
  for (let i = 1; i < pts.length - 1; i++) out.push({ f: DS_cap(...pts[i].slice(0, 2), ...pts[i + 1].slice(0, 2), pts[i][2], pts[i + 1][2]), k: 5 * sc });
  out.push(...extra);
  const ball = pts[pts.length - 1], c = Math.cos(ta), s = Math.sin(ta), O = (dx, dy) => [ball[0] + (dx * c - dy * s) * sc, ball[1] + (dx * s + dy * c) * sc];
  for (const [k, dx, dy, r] of [[-1, 7, -2.5, 2.8], [0, 11, 1, 3.3], [1, 8.5, 3.6, 3.4]]) {
    const b0 = O(1, k * 1.4), tip = O(dx, dy), mid = O((1 + dx) / 2, (k * 1.4 + dy) / 2 - 1.1), R0 = r * sc;
    out.push({ f: DS_cap(b0[0], b0[1], mid[0], mid[1], R0, R0 * 0.86), k: sc, front: true, fw: 1.6 * sc, W: 2.5 * sc }, { f: DS_cap(mid[0], mid[1], tip[0], tip[1], R0 * 0.86, R0 * 0.7), k: sc, front: true, fw: 1.6 * sc, W: 2.5 * sc });
    const c1 = O(dx + r * 0.4, dy - 0.8), c2 = O(dx + 4.2, dy - 0.2), c3 = O(dx + 5.6, dy + 2.2);
    out.push({ f: DS_cap(c1[0], c1[1], c2[0], c2[1], 1.5 * sc + 0.2, 0.9 * sc + 0.1), mat: 'claw', k: 0.6 }, { f: DS_cap(c2[0], c2[1], c3[0], c3[1], 0.9 * sc + 0.1, 0.2), mat: 'claw', k: 0.4 });
  }
  return out;
}

// Гребень шипов вдоль линии хвост → спина → шея; len(u) — длина по доле пути, r0 — толщина у основания
function DS_spines(dors, len, r0, step) {
  const out = []; let acc = 0;
  for (let i = 1; i < dors.length; i++) {
    const a = dors[i - 1], b = dors[i], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
    acc += l; if (acc < step || i < 2) continue; acc = 0;
    const L0 = len(i / dors.length), nx = ty / l, ny = -tx / l;
    const bx0 = b[0] + nx * (b[2] - 1.5), by0 = b[1] + ny * (b[2] - 1.5), tx1 = b[0] + nx * (b[2] + L0) - tx / l * L0 * 0.4, ty1 = b[1] + ny * (b[2] + L0) - ty / l * L0 * 0.4;
    out.push({ f: DS_cap(bx0, by0, tx1, ty1, r0, 0.3 + r0 * 0.15), mat: 'horn', k: 2 });
  }
  return out;
}
// хвостовое лезвие-наконечник
function DS_blade(tail, len, w) {
  const a = tail[tail.length - 2], b = tail[tail.length - 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, dx = (b[0] - a[0]) / l, dy = (b[1] - a[1]) / l;
  const out = [{ f: DS_cap(b[0], b[1], b[0] + dx * len, b[1] + dy * len, w, 0.2), mat: 'horn', k: 2.5 }];
  for (const sd of [-1, 1]) out.push({ f: DS_cap(b[0] + dx * len * 0.25, b[1] + dy * len * 0.25, b[0] + dx * 1 - dy * sd * len * 0.6, b[1] + dy * 1 + dx * sd * len * 0.6, w * 0.48, 0.2), mat: 'horn', k: 2 });
  return out;
}
// Огонь: струя из точки M под углом ang (вниз +), длиной len; к концу рассыпается дымом
function DS_fire(K, M, ang, len, p, wk) {
  const { P, R, dth, hsh } = K, ca = Math.cos(ang), sa = Math.sin(ang);
  R(M[0] - 2, M[1] - len * 0.5, M[0] + len + 4, M[1] + len * 0.9, (x, y) => {
    const dx = x - M[0], dy = y - M[1], d = dx * ca + dy * sa, q = -dx * sa + dy * ca;
    if (d < -1 || d > len) return null;
    const wdt = 2 * wk + d * 0.26, yy = q - Math.sin(d * 0.3 + p * 1.7) * 2.6 * wk, a = Math.abs(yy) / wdt;
    if (a > 1) return null;
    const f = d / len;
    if (f > 0.7 && dth(x, y) > (1 - f) * 2.6) return f > 0.82 && dth(x + 1, y) < 0.3 ? [96, 86, 86, 0.55] : null;
    const v = (1 - a) * 0.85 + (1 - f) * 0.45 + (hsh(x * 3 + y * 7 + p) - 0.5) * 0.3;
    return DR.FL[Math.max(0, Math.min(4, Math.floor(v * 3.3)))];
  }, false);
  for (let k = 0; k < 10 * wk; k++) { const d = 8 + hsh(k + p * 9) * (len + 4), q = (hsh(k * 2 + p) - 0.5) * (6 + d * 0.5); P(M[0] + d * ca - q * sa, M[1] + d * sa + q * ca, DR.EMB[1 + (k % 3)], 0.9, false); }
}
// общий шейдинг тела: брюхо по нормали, пластины поперёк полосы (у огня щели тлеют), чешуя, кольца на рогах
function DS_dragonBody(K, parts, glowAt, o) {
  const { dth, hsh } = K, lg = [0, 1], cell = o.scale || 4;
  return DS_body(K, parts, { skin: DR.SK, belly: DR.BE, horn: DR.HO, claw: DR.CL }, {
    bb: o.bb, W: o.W || 8, k: 5,
    mat2: (x, y, n, mat, ow, gx, gy, dep) => (lg[0] = gx, lg[1] = gy, 0) || mat === 'skin' && ow.bel && gy * 0.8 + gx * 0.5 > 0.32 + (dth(x, y) - 0.5) * 0.12 && dep < (ow.bel === 2 ? o.belN || 7 : o.belB || 11) ? 'belly' : null,
    light: (x, y, mat) => mat === 'belly' ? 0.12 + glowAt(x, y) * 0.18 : mat === 'skin' && o.dapple && hsh(Math.floor((x + 600) / 7) * 13 + Math.floor((y + 600) / 6) * 7) > 0.72 ? -0.06 : 0,
    tex: (x, y, mat, idx, ramp) => {
      if (mat === 'belly') {
        const s = Math.round(x * lg[1] - y * lg[0]), seam = ((s + 600) % (o.plate || 6)) === 0;
        if (!seam) return null;
        const g = glowAt(x, y);
        if (g > 0.22) return DR.EMB[Math.min(3, Math.floor(g * 3.2 + (dth(x, y) - 0.5) * 0.6))] || DR.EMB[0];
        return dth(x, y) < 0.6 ? ramp[Math.max(0, idx - 1)] : null;
      }
      if (mat === 'horn' && o.ridges && idx > 0 && (Math.round(x * 2 + y) + 600) % 5 === 0) return ramp[idx - 1];
      if (mat === 'skin' && idx > 0 && idx < ramp.length - 1) {                   // чешуя: тень снизу, блик сверху на светлой стороне
        const ch = cell - 1, row = Math.floor((y + 600) / ch), xx = x + 600 + (row & 1) * (cell >> 1), cx = Math.floor(xx / cell), yy = (y + 600) % ch;
        const m = xx % cell;
        if (yy === ch - 1 && (m === 1 || m === 2)) return ramp[idx - 1];
        if (yy === ch - 2 && (m === 0 || m === 3) && cell > 4) return ramp[idx - 1];
        if (yy === 0 && m === 1 && idx > 3 && hsh(cx * 7 + row) > 0.35) return ramp[idx + 1];
      }
      return null;
    },
  });
}

// ================= Взрослый легендарный дракон =================
// Сетка 300×180 (мир 100×60; сверху запас под взмах крыльев, справа — под огонь).
function fzDragonPx(mode, p) {
  const K = fzPxKit(300, 180, 126, 171), { P, R, L, dth, hsh } = K, BB = [-126, -171, 173, 8];
  const fly = mode === 'fly' || mode === 'flyatk', sleep = mode === 'sleep', walk = mode === 'walk', idle = mode === 'idle';
  const wind = mode === 'atk' && p < 2, breath = (mode === 'atk' && p >= 2) || mode === 'flyatk';
  const N = mode === 'fly' ? 8 : 6, t = p / N * Math.PI * 2;
  const hb = fly ? -8 - Math.round(Math.sin(t) * 2) : sleep ? 14 : walk ? -Math.round(Math.abs(Math.sin(t)) * 2) : idle ? Math.round(Math.sin(t) * 0.8) : wind ? 1 : -1;
  const br = idle ? Math.sin(t) : sleep ? Math.sin(t) * 1.3 : wind ? 2 : 0;
  const hdx = wind ? -10 : breath && !fly ? 7 : 0, hdy = (wind ? -4 : breath && !fly ? 3 : 0) + (idle ? Math.round(Math.sin(t + 1)) : walk ? Math.round(Math.sin(2 * t + 0.8)) : 0);
  const hx = fly ? 64 + (breath ? 3 : 0) : sleep ? 58 : 50 + hdx;
  const hy = fly ? -92 + hb + Math.round(Math.sin(t - 1) * 1.5) + (breath ? 3 : 0) : sleep ? -16 : -106 + hb + hdy;
  const ja = breath ? 0.42 + (p & 1) * 0.05 : wind ? 0.1 : 0;
  const wa = fly ? 0.2 + 0.75 * Math.cos(t) : sleep ? 0 : idle ? Math.sin(t) * 0.05 : walk ? Math.sin(2 * t) * 0.06 : wind ? 0.22 : -0.06 + Math.sin(2 * t) * 0.04;
  const tsw = idle ? Math.sin(t - 1) * 5 : walk ? Math.sin(t - 1) * 7 : wind ? -4 : 4;

  // ---- скелет ----
  const neck = fly ? DS_bez([[14, -62 + hb], [30, -76 + hb], [hx - 28, hy + 6], [hx - 8, hy + 3]], 9, 14, 8.6)
    : sleep ? DS_bez([[14, -62 + hb], [34, -70 + hb], [hx - 26, hy - 8], [hx - 8, hy + 3]], 9, 14, 8.6)
    : DS_bez([[14, -62 + hb], [20, -84 + hb + hdy * 0.3], [hx - 30, hy + 10], [hx - 8, hy + 3]], 9, 14, 8.6);
  const tail = fly ? DS_bez([[-34, -40 + hb], [-66, -42 + hb + Math.sin(t - 1) * 4], [-94, -36 + hb + Math.sin(t - 2) * 6], [-118, -44 + hb + Math.sin(t - 3) * 8]], 12, 14, 2.4)
    : sleep ? DS_bez([[-34, -40 + hb], [-72, -22], [-64, -2], [-24, -3]], 12, 14, 2.4)
    : DS_bez([[-34, -40 + hb], [-64, -36 + hb], [-90, -4 + tsw * 0.5], [-110, -20 + tsw]], 12, 14, 2.4);
  const torso = [[-34, -40 + hb, 17], [-20, -42 + hb, 17], [-4, -46 + hb, 17], [10, -52 + hb, 19 + br * 0.6]];
  const J = [hx - 6, hy + 5], jawTip = DS_rot(J, [31, 1], ja), upTip = [hx + 28, hy + 5];
  const glowC = wind || breath ? [neck[4][0] + 4, neck[4][1] + 6] : [12, -48 + hb];
  const glow = sleep ? 0.3 + Math.sin(t) * 0.12 : idle ? 0.55 + Math.sin(t) * 0.2 : walk || mode === 'fly' ? 0.5 : wind ? 1.05 : 0.85;
  const glowAt = (x, y) => glow * Math.max(0, 1 - Math.hypot(x - glowC[0], y - glowC[1]) / 28);

  // ---- искры-ореол ----
  const sparks = front => { if (sleep) return; for (let k = 0; k < 8; k++) if ((k & 1) === +front) { const x = -100 + hsh(k * 3.7) * 230, y = -6 - ((k * 13 + p * 6) % 36) * 3.6; P(x + Math.sin(t + k) * 2, y, k % 3 ? [255, 214, 110] : [255, 246, 200], 0.75, false); } };
  sparks(false);
  DS_wing(K, [-2, -64 + hb], fly ? 0.2 + 0.75 * Math.cos(t - 0.45) + 0.1 : sleep ? 0.02 : wa + 0.14, false, 1, sleep ? 1 : 0);

  // ---- лапы по позе ----
  const legs = (hx0, hy0, ph, hind) => {
    const sv = walk ? Math.sin(t + ph) * 9 : 0, lift = walk ? Math.max(0, Math.cos(t + ph)) * 7 : 0;
    let pts, ta = 0;
    if (fly) {
      if (hind) { pts = [[hx0, hy0, 14], [hx0 + 8, hy0 + 12, 10], [hx0 - 6, hy0 + 18, 6.6], [hx0 - 15, hy0 + 20, 5.4]]; ta = Math.PI - 0.3; }
      else { pts = [[hx0, hy0, 11.5], [hx0 - 4, hy0 + 14, 8.4], [hx0 + 4, hy0 + 21, 5.8], [hx0 + 8, hy0 + 24, 5]]; ta = 1.1; }
    } else if (sleep) {
      if (hind) pts = [[hx0, hy0, 14], [hx0 + 8, -12, 10], [hx0 + 4, -5.5, 6.6], [hx0 + 14, -4.5, 5.4]];
      else pts = [[hx0, hy0, 11.5], [hx0 - 2, -10, 8.4], [hx0 + 10, -6, 5.8], [hx0 + 20, -4.5, 5]];
    } else if (hind) pts = [[hx0, hy0, 14], [hx0 + 9 + sv * 0.35, hy0 + 14 - lift * 0.5, 10], [hx0 + 2 + sv * 0.8, -11 - lift * 0.9, 6.6], [hx0 + 8 + sv, -4.5 - lift, 5.4]];
    else pts = [[hx0, hy0, 11.5], [hx0 - 3 + sv * 0.3, hy0 + 17 - lift * 0.4, 8.4], [hx0 + 5 + sv * 0.85, -8 - lift * 0.9, 5.8], [hx0 + 11 + sv, -4.5 - lift, 5]];
    const ex = hind ? [{ f: DS_ell(hx0 + 2, hy0 + 7, 13, 11), k: 6 }, { f: DS_cap(pts[2][0] - 3, pts[2][1] + 3, pts[2][0] - 8, pts[2][1] + 8, 2.4, 0.3), mat: 'claw', k: 1.5 }]
      : [{ f: DS_ell((pts[1][0] + pts[2][0]) / 2 + 2.5, (pts[1][1] + pts[2][1]) / 2 - 3, 5.5, 7.5), k: 4 }];
    return DS_dLeg(pts, ta, 1, ex);
  };
  DS_body(K, [...legs(-12, -42 + hb, Math.PI, true), ...legs(22, -48 + hb, 0, false)], { skin: DR.SKF, horn: DR.HOF, claw: DR.CLF }, { bb: BB, W: 6, k: 4 });

  // ---- пасть изнутри ----
  if (ja > 0) R(J[0], hy - 2, Math.max(upTip[0], jawTip[0]) + 1, jawTip[1] + 2, (x, y) => {
    if (!DS_pip(x, y, [[J[0] + 2, J[1]], upTip, [jawTip[0], jawTip[1] - 2]])) return null;
    return y > (J[1] + (jawTip[1] - J[1]) * (x - J[0]) / (jawTip[0] - J[0])) - 4 && x < jawTip[0] - 6 ? [186, 58, 70] : [64, 10, 22];
  });

  // ---- тело одной формой ----
  const parts = [{ f: DS_tube(tail), k: 6, bel: sleep ? 0 : 2 }];
  parts.push({ f: DS_ell(-20, -42 + hb, 19, 17), k: 8 }, { f: DS_cap(-20, -40 + hb, 8, -44 + hb, 16, 18), k: 8, bel: sleep ? 0 : 1 }, { f: DS_ell(10, -52 + hb, 19, 20 + br * 0.6), k: 8, bel: sleep ? 0 : 1 });
  parts.push({ f: DS_tube(neck), k: 9, bel: 2 });
  parts.push(...DS_spines([...tail.slice().reverse(), ...torso, ...neck.slice(0, -1)], u => u < 0.45 ? 3 + 6 * u / 0.45 : u < 0.62 ? 10 : 10 - 5 * (u - 0.62) / 0.38, 3.4, 9));
  parts.push(...DS_blade(tail, 13, 5.4));
  parts.push(...legs(-22, -40 + hb, 0, true), ...legs(12, -46 + hb, Math.PI, false));
  // голова: череп, надбровье с шипиками, морда, нижняя челюсть, бородка
  parts.push({ f: DS_ell(hx, hy, 15, 12.5), k: 6 }, { f: DS_cap(hx - 6, hy - 9, hx + 11, hy - 7, 4.3, 3.2), k: 3 });
  parts.push({ f: DS_cap(hx + 4, hy - 2, hx + 25, hy + 1, 9.5, 6.4), k: 5 }, { f: DS_ell(hx + 25, hy, 5, 4.4), k: 3 });
  parts.push({ f: DS_cap(J[0] + 2, J[1] + 1, jawTip[0], jawTip[1], 6.4, 3.4), k: ja ? 1 : 4, front: true, fw: 3 });
  for (const dx of [2, 7]) parts.push({ f: DS_cap(hx + dx, hy - 10, hx + dx - 2, hy - 15, 1.8, 0.3), mat: 'horn', k: 1 });
  { const c1 = DS_rot(J, [14, 6], ja), c2 = DS_rot(J, [11, 13], ja), c3 = DS_rot(J, [20, 5], ja), c4 = DS_rot(J, [19, 10], ja);
    parts.push({ f: DS_cap(c1[0], c1[1], c2[0], c2[1], 2.2, 0.3), mat: 'horn', k: 1.2 }, { f: DS_cap(c3[0], c3[1], c4[0], c4[1], 1.8, 0.3), mat: 'horn', k: 1.2 }); }
  parts.push({ f: DS_cap(hx - 8, hy + 3, hx - 21, hy + 9, 3.6, 0.4), mat: 'horn', k: 2 }, { f: DS_cap(hx - 6, hy + 8, hx - 15, hy + 17 + ja * 10, 3, 0.3), mat: 'horn', k: 2 });
  parts.push({ f: DS_cap(hx + 21, hy - 5, hx + 24, hy - 12, 2.6, 0.3), mat: 'horn', k: 1.5 });
  for (const [b0, c0, e0, r0] of [[[hx - 9, hy - 6], [hx - 18, hy - 22], [hx - 42, hy - 25], 4.2], [[hx - 4, hy - 10], [hx - 10, hy - 30], [hx - 25, hy - 42], 3.9]])
    parts.push({ f: DS_tube(DS_bez([b0, c0, e0], 8, r0, 0.7)), mat: 'horn', k: 1.5, front: true, fw: 2, W: 3 });
  const body = DS_dragonBody(K, parts, glowAt, { bb: BB, W: 8, scale: 5, ridges: true, dapple: true });

  // ---- лицо ----
  const SK = DR.SK, HO = DR.HO;
  if (ja > 0) {
    for (let k = 0; k < 6; k++) { const x = hx + 4 + k * 4.2; P(x, hy + 7, HO[4]); P(x, hy + 8, HO[3]); if (k % 2 === 0) P(x, hy + 9, HO[3]); }
    for (let k = 0; k < 5; k++) { const u = 0.3 + k * 0.14, x = J[0] + (jawTip[0] - J[0]) * u, y = J[1] + (jawTip[1] - J[1]) * u - 4; P(x, y, HO[4]); P(x, y - 1, HO[3]); }
  } else {
    L(hx + 1, hy + 6, hx + 27, hy + 5, 0.7, 0.7, () => SK[0]); P(hx, hy + 5, SK[0]); P(hx - 1, hy + 4, SK[0]);
    for (const x of [hx + 8, hx + 14, hx + 19]) { P(x, hy + 7, HO[4]); if (x === hx + 19) P(x, hy + 8, HO[3]); }
  }
  P(hx + 27, hy - 2, SK[0]); P(hx + 28, hy - 2, SK[0]); P(hx + 27, hy - 1, SK[1]);                                  // ноздря
  if (wind || breath || sleep) for (let k = 0; k < 4; k++) { const q = (p + k * 1.5) % 6; P(hx + 30 + q * 1.2, hy - 4 - q * 2.4, [200, 194, 186], 0.55 - q * 0.08, false); }   // дымок
  const ex = hx + 5, ey = hy - 4;
  if ((idle && p === 4) || sleep) L(ex - 4, ey + 1, ex + 4, ey + 2, 0.8, 0.8, () => SK[0]);
  else {
    R(ex - 9, ey - 9, ex + 9, ey + 9, (x, y) => {
      const d = Math.hypot(x - ex, (y - ey) * 1.3);
      return d > 3 && d < 8 && body.at(x, y) <= 0 && dth(x, y) < (1 - d / 8) * 0.5 ? [255, 214, 110, 0.55] : null;
    }, false);
    R(ex - 6, ey - 4, ex + 6, ey + 4, (x, y) => {
      const yy = y - ey - (x - ex) * 0.3;
      if ((x - ex) ** 2 / 21 + yy * yy / 5.8 > 1) return null;
      if (Math.abs(x - ex - 0.5) < 0.8 && Math.abs(yy) < 2.2) return [26, 8, 4];
      return Math.hypot(x - ex, yy) < 2.6 ? [255, 238, 150] : [255, 182, 44];
    });
    P(ex - 2, ey - 1, [255, 252, 230]);
    L(ex - 5, ey - 3.6, ex + 5, ey - 0.4, 0.8, 0.8, () => SK[0]);
  }

  DS_wing(K, [-2, -66 + hb], sleep ? -0.06 : wa, true, 1, sleep ? 1 : 0);
  const M = [(upTip[0] + jawTip[0]) / 2 + 2, (upTip[1] + jawTip[1]) / 2 - 1];
  if (breath) { const ang = ja * 0.35 + (fly ? 0.32 : 0); DS_fire(K, M, ang, Math.min((170 - M[0]) / Math.cos(ang), fly ? 74 : 78) + (p & 1) * 4, p, 1); }
  else if (wind) for (const [dx, dy] of [[0, 0], [2, -1], [3, 1], [1, 2]]) P(upTip[0] + dx - 2, hy + 7 + dy, DR.EMB[2], 0.8, false);
  sparks(true);
  K.outline(DR.OUT);
  return K.done();
}
function fzDragonSprite(mode, p) { return fzPxSprite('dr' + mode + p, 100, 60, 42, 57, () => fzDragonPx(mode, p)); }

// ================= Дракончик =================
// Пухлый малыш той же породы. Сетка 132×120 (мир 44×40), низ — y = 0.
function fzBabyDragonPx(mode, p) {
  const K = fzPxKit(132, 120, 63, 111), { P, R, L, dth, hsh } = K, BB = [-63, -111, 68, 8];
  const fly = mode === 'fly' || mode === 'flyatk', sleep = mode === 'sleep', idle = mode === 'idle', breath = mode === 'flyatk';
  const N = mode === 'fly' ? 8 : 6, t = p / N * Math.PI * 2;
  const hb = fly ? -12 - Math.round(Math.sin(t) * 2) : sleep ? 6 : Math.round(Math.sin(t) * 0.8);
  const br = idle ? Math.sin(t) * 0.8 : sleep ? Math.sin(t) * 1.2 : 0;
  const hx = fly ? 26 : sleep ? 28 : 20, hy = fly ? -54 + hb + Math.round(Math.sin(t - 1)) : sleep ? -15 : -60 + hb + Math.round(Math.sin(t + 1) * 0.8);
  const SKr = DR.SK;

  // ---- скелет ----
  const bodyP = fly ? [[-12, -24 + hb, 13, 11], [-2, -26 + hb, 18, 13.5 + br * 0.4], [9, -31 + hb, 12.5, 12]]
    : sleep ? [[-10, -12, 15, 11], [-1, -15, 19, 13 + br * 0.5], [9, -20, 12, 11]]
    : [[-8, -13 + hb, 13, 11], [0, -23 + hb, 17, 17 + br * 0.5], [6, -35 + hb, 12, 12]];
  const nb = fly ? [12, -38 + hb] : sleep ? [12, -26] : [8, -42 + hb];
  const tail = fly ? DS_bez([[-18, -24 + hb], [-36, -26 + hb + Math.sin(t - 1) * 3], [-50, -22 + hb + Math.sin(t - 2) * 4], [-60, -28 + hb + Math.sin(t - 3) * 5]], 9, 10, 2.6)
    : sleep ? DS_bez([[-18, -12], [-42, -8], [-40, -2], [-14, -3]], 9, 10, 2.6)
    : DS_bez([[-14, -10 + hb], [-30, -4 + hb], [-38, -12 + Math.sin(t - 1) * 1.5], [-32, -24 + Math.sin(t - 1) * 3]], 8, 9, 2.6);
  const glowC = [bodyP[2][0] + 2, bodyP[2][1] + 4], glow = breath ? 0.8 : 0.3 + (idle ? Math.sin(t) * 0.1 : 0);
  const glowAt = (x, y) => glow * Math.max(0, 1 - Math.hypot(x - glowC[0], y - glowC[1]) / 16);

  DS_wing(K, fly ? [-7, -38 + hb] : sleep ? [0, -24] : [-2, -44 + hb], fly ? 0.3 + 0.85 * Math.cos(t - 0.45) + 0.1 : sleep ? 0.1 : 0.22 + Math.sin(t) * 0.08, false, 0.42, sleep ? 1 : 0);

  // ---- лапки ----
  const legs = far => {
    const dx = far ? 7 : 0, dy = far ? -1 : 0;
    let H, F, ta = 0, tf = 0;
    if (fly) { H = [[-10 + dx, -20 + hb + dy, 9], [-12 + dx, -10 + hb + dy, 5.4], [-18 + dx, -6 + hb + dy, 4.2]]; ta = Math.PI - 0.6; F = [[8 + dx, -28 + hb + dy, 5], [12 + dx, -20 + hb + dy, 4.2], [15 + dx, -17 + hb + dy, 3.6]]; tf = 1.2; }
    else if (sleep) { H = [[-6 + dx, -12 + dy, 9.5], [0 + dx, -5 + dy, 5], [9 + dx, -4 + dy, 4.2]]; F = [[9 + dx, -20 + dy, 5.5], [15 + dx, -6 + dy, 4.6], [22 + dx, -4 + dy, 4]]; }
    else { H = [[-6 + dx, -14 + hb + dy, 10], [-2 + dx, -6 + dy, 5], [5 + dx, -4.2 + dy, 4.4]]; F = [[8 + dx, -31 + hb + dy, 5.4], [12 + dx, -22 + hb + dy, 4.6], [16 + dx, -18 + hb + dy, 4]]; tf = 0.7; }
    return [...DS_dLeg(H, ta, 0.55, far ? [] : [{ f: DS_ell(H[0][0] + 1, H[0][1] + 2, 10.5, 9), k: 5 }]), ...DS_dLeg(F, tf, 0.42)];
  };
  DS_body(K, legs(true), { skin: DR.SKF, horn: DR.HOF, claw: DR.CLF }, { bb: BB, W: 5, k: 3 });

  // ---- тело одной формой ----
  const parts = [{ f: DS_tube(tail), k: 5, bel: fly ? 2 : 0 }];
  parts.push({ f: DS_ell(...bodyP[0]), k: 6 }, { f: DS_ell(...bodyP[1]), k: 6 }, { f: DS_ell(...bodyP[2]), k: 6 });
  parts.push({ f: DS_cap(nb[0], nb[1], hx - 8, hy + 7, 11, 10), k: 7 });
  // пузико — большой золотой овал спереди (как у старого малыша), край с дизерингом; горлышко
  const zd = f => (x, y) => f(x, y) - (dth(x, y) - 0.5) * 1.6;
  const [b1, b2] = [bodyP[1], bodyP[2]];
  if (fly) parts.push({ f: zd(DS_ell(b1[0] + 2, b1[1] + b1[3] - 3, b1[2] - 3, 6)), zone: true, mat: 'belly' }, { f: zd(DS_cap(b2[0] + 4, b2[1] + 7, hx - 2, hy + 12, 5.5, 4.5)), zone: true, mat: 'belly' });
  else if (!sleep) parts.push({ f: zd(DS_ell(b1[0] + 8, b1[1] + 3, 9.5, 13)), zone: true, mat: 'belly' }, { f: zd(DS_cap(b2[0] + 6, b2[1] + 2, hx - 1, hy + 12, 6, 5)), zone: true, mat: 'belly' });
  else parts.push({ f: zd(DS_cap(b2[0] + 6, b2[1] + 6, hx - 2, hy + 12, 5, 4.5)), zone: true, mat: 'belly' });
  const torsoLine = [[-18, bodyP[0][1], bodyP[0][3]], [-4, bodyP[1][1], bodyP[1][3]], [6, bodyP[2][1], bodyP[2][3]], [hx - 10, hy + 2, 10]];
  parts.push(...DS_spines([...tail.slice().reverse(), ...torsoLine], u => 2.5 + 1.8 * Math.sin(Math.PI * u), 2.6, 12));
  parts.push(...DS_blade(tail, 7, 3.4));
  parts.push(...legs(false));
  // большая голова: лоб, щёчки, короткая круглая мордочка, рожки-бугорки
  parts.push({ f: DS_ell(hx, hy, 19, 17), k: 6 }, { f: DS_ell(hx + 16, hy + 6, 10, 8.5), k: 6 }, { f: DS_ell(hx + 6, hy + 9, 10, 7), k: 5 });
  parts.push({ f: DS_cap(hx + 4, hy + 10, hx + 20, hy + 10, 5, 3.4), k: 3, front: true, fw: 2 });
  parts.push({ f: DS_cap(hx + 21, hy - 1, hx + 22, hy - 4, 2, 0.5), mat: 'horn', k: 1 });
  for (const [b0, c0, e0, r0] of [[[hx - 7, hy - 11], [hx - 13, hy - 19], [hx - 21, hy - 21], 4], [[hx + 0, hy - 14], [hx - 3, hy - 23], [hx - 10, hy - 28], 3.8]])
    parts.push({ f: DS_tube(DS_bez([b0, c0, e0], 6, r0, 1.3)), mat: 'horn', k: 1.5, front: true, fw: 1.6, W: 2.5 });
  const body = DS_dragonBody(K, parts, glowAt, { bb: BB, W: 7, scale: 4, plate: 5, belN: 6, belB: 16 });

  // ---- мордочка ----
  const ex = hx + 5, ey = hy - 3;
  if ((idle && p === 4) || sleep) for (let x = ex - 5; x <= ex + 5; x++) P(x, ey + 1 + 1.8 * Math.sqrt(Math.max(0, 1 - ((x - ex) / 5.2) ** 2)), SKr[0]);   // закрытый глаз ‿
  else {
    R(ex - 8, ey - 9, ex + 8, ey + 9, (x, y) => {
      const d = ((x - ex) / 7.2) ** 2 + ((y - ey) / 8.2) ** 2;
      if (d > 1) return null;
      if (d > 0.84) return SKr[1];
      if (((x - ex - 1.8) / 2.4) ** 2 + ((y - ey - 0.4) / 4.8) ** 2 <= 1) return [24, 10, 6];
      if (((x - ex - 1.3) / 5.4) ** 2 + ((y - ey - 0.4) / 6.8) ** 2 <= 1) return y > ey + 1 ? [255, 184, 40] : [255, 224, 90];
      return [250, 252, 240];
    });
    for (const [x, y] of [[ex - 1, ey - 4], [ex, ey - 4], [ex - 1, ey - 3], [ex + 3, ey + 3]]) P(x, y, [255, 255, 255]);
    for (let x = ex - 7; x <= ex + 7; x++) P(x, ey - 8.4 * Math.sqrt(Math.max(0, 1 - ((x - ex) / 7.4) ** 2)) - 0.4, SKr[0]);
  }
  R(hx + 5, hy + 3, hx + 12, hy + 9, (x, y) => Math.hypot(x - hx - 8.5, (y - hy - 6) * 1.4) < 3.4 && dth(x, y) < 0.55 ? [240, 120, 120, 0.7] : null, false);   // румянец
  P(hx + 23, hy + 1, SKr[0]); P(hx + 24, hy + 1, SKr[0]);
  if (breath) R(hx + 10, hy + 8, hx + 24, hy + 14, (x, y) => y > hy + 9 && y < hy + 12 + (x - hx - 10) * 0.12 && x > hx + 12 ? [70, 14, 26] : null);
  else { for (let x = hx + 11; x <= hx + 23; x++) P(x, hy + 9 + ((x - hx - 17) / 6) ** 2 * -1.2 + 0.6, SKr[0]); P(hx + 19, hy + 10, DR.HO[4]); P(hx + 19, hy + 11, DR.HO[3]); }
  if (sleep) { const r = 1.6 + 2.2 * (0.5 + 0.5 * Math.sin(t)), bx = hx + 26 + r * 0.6, by = hy - 1;   // пузырь из носа
    R(bx - r - 1, by - r - 1, bx + r + 1, by + r + 1, (x, y) => { const d = Math.hypot(x - bx, y - by); return d <= r ? (d > r - 1 ? [190, 230, 250, 0.8] : (x < bx - r * 0.3 && y < by - r * 0.3 ? [255, 255, 255, 0.9] : [170, 220, 245, 0.25])) : null; }, false); }

  DS_wing(K, fly ? [-5, -40 + hb] : sleep ? [2, -26] : [0, -46 + hb], fly ? 0.3 + 0.85 * Math.cos(t) : sleep ? 0 : 0.12 + Math.sin(t) * 0.08, true, 0.45, sleep ? 1 : 0);
  if (breath) DS_fire(K, [hx + 25, hy + 11], 0.35, 36 + (p & 1) * 3, p, 0.55);
  K.outline(DR.OUT);
  return K.done();
}
function fzBabyDragonSprite(mode, p) { return fzPxSprite('bdr' + mode + p, 44, 40, 21, 37, () => fzBabyDragonPx(mode, p)); }

// ================= Подключение в игру =================
// 3×-спрайт в мире: (px, py) — точка земли в пикселях мира, face — разворот, a — прозрачность, s — масштаб
function pxbBlit(c, cv, px, py, face = 1, a = 1, s = 1) {
  const [ox, oy, w, h] = cv.fzO;
  c.save();
  c.globalAlpha *= a; c.imageSmoothingEnabled = false;
  c.translate(Math.round(px), Math.round(py));
  if (face < 0) c.scale(-1, 1);
  if (s !== 1) c.scale(s, s);
  c.drawImage(cv, -ox, -oy, w, h);
  c.restore();
}
// Дракончик своего вида (питомцы и дикий малыш): перекраска изумруда и бирюзы крыльев в цвет вида (DP_SP в dragonpet.js);
// золото брюха, рога, когти и обводка не трогаются
const PXB_PET = new Map();
function pxbBaby(sp, mode, p) {
  const base = fzBabyDragonSprite(mode, p), S = sp && typeof DP_SP !== 'undefined' ? DP_SP[sp] : null;
  if (!S || S.hue == null) return base;
  const key = sp + mode + p;
  let cv = PXB_PET.get(key);
  if (cv) return cv;
  cv = base;
  try {
    const c2 = document.createElement('canvas'); c2.width = base.width; c2.height = base.height;
    const g = c2.getContext('2d'); g.drawImage(base, 0, 0);
    const im = g.getImageData(0, 0, base.width, base.height), a = im.data;
    for (let i = 0; i < a.length; i += 4) {
      if (!a[i + 3]) continue;
      const r = a[i] / 255, gg = a[i + 1] / 255, b = a[i + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), l = (mx + mn) / 2, dd = mx - mn;
      if (dd < 0.08) continue;
      let h = mx === r ? ((gg - b) / dd) % 6 : mx === gg ? (b - r) / dd + 2 : (r - gg) / dd + 4; h *= 60; if (h < 0) h += 360;
      if (h < 60 || h > 200) continue;
      const s = Math.min(1, dd / (1 - Math.abs(2 * l - 1)) * S.sat), L2 = Math.min(0.95, l * S.lit);
      const C = (1 - Math.abs(2 * L2 - 1)) * s, X = C * (1 - Math.abs((S.hue / 60) % 2 - 1)), m = L2 - C / 2, sec = Math.floor(S.hue / 60) % 6;
      const rgb = [[C, X, 0], [X, C, 0], [0, C, X], [0, X, C], [X, 0, C], [C, 0, X]][sec];
      a[i] = (rgb[0] + m) * 255; a[i + 1] = (rgb[1] + m) * 255; a[i + 2] = (rgb[2] + m) * 255;
    }
    g.putImageData(im, 0, 0);
    c2.fzO = base.fzO; c2.fzPx = true;
    cv = c2;
  } catch (e) { cv = base; }
  PXB_PET.set(key, cv);
  return cv;
}
// Чумной моховик: кадры нейтралов (naFrame в neutralart.js: покой, ходьба, бой, смерть, торжество) → свои режимы
const PXB_SPORE = { ready: ['idle', 0], step: ['walk', 1], windup: ['atk', 0], strike: ['atk', 3], recover: ['atk', 5], parry: ['atk', 1], hurt: ['hurt', 0], stagger: ['hurt', 1], roar: ['atk', 2] };
for (let k = 0; k < 6; k++) { PXB_SPORE['i' + k] = ['idle', k]; PXB_SPORE['d' + k] = ['die', k]; }
for (let k = 0; k < 8; k++) PXB_SPORE['w' + k] = ['walk', Math.round(k * 6 / 8) % 6];
for (let k = 0; k < 4; k++) PXB_SPORE['v' + k] = ['win', k];
if (typeof naFrame === 'function') {
  const naOld = naFrame;
  naFrame = function (kind, fr) {
    if (kind !== 'spore') return naOld(kind, fr);
    const m = PXB_SPORE[fr] || PXB_SPORE.i0, cv = fzShroomSprite(m[0], m[1]), [ox, oy, w, h] = cv.fzO;
    return { cv, ax: ox, ay: oy, w, h, hi: true };      // hi: холст 3×, рисовать в размер w×h (neuDraw)
  };
}
