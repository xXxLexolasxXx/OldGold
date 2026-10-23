'use strict';
// Слуги Малгора ручным пиксель-артом по образцу Полудницы (набор fzPxKit из fairy2.js): сетка втрое мельче мировой,
// палитры рампами, дизеринг Байером, свет сверху-слева, цветная обводка по маске в конце.
// Лица — черепа с горящими глазами и оскалом, когти, рваньё, свечение, пепел/снег/дым у стихий.
// Кадры называются как у naFrame: i0..5 покой, w0..7 шаг, windup/strike/recover/ready, hurt, c0..5 колдовство.
// foeBlit (foeart.js) берёт кадр отсюда; векторные кадры foeart.js остаются запасными (и для листа «было»).

const FPX_T = Math.PI * 2, FPX_LX = -0.6, FPX_LY = -0.8;
// вид → [w, h, ax, ay] в мировых пикселях (сетка ×3: ax, ay — точка у земли) и S — пикселей сетки на единицу эскиза
const FPX_BOX = {
  fThrall: [48, 54, 20, 48, 0.8], fKnight: [66, 74, 29, 64, 1.1], fRaven: [32, 28, 15, 15, 1],
  fMalgor1: [84, 104, 38, 92, 1], fMalgor3: [84, 104, 38, 92, 1], fBone: [36, 34, 16, 29, 1], fRock: [48, 42, 22, 36, 1],
  fG_fire: [62, 70, 27, 62, 1], fG_ice: [62, 70, 27, 62, 1], fG_bone: [62, 70, 27, 62, 1], fG_shadow: [62, 70, 27, 62, 1], fG_golem: [104, 100, 48, 90, 1],
};

// поза по имени кадра; углы — радианы экрана (0 — вперёд, вправо; π/2 — вниз)
function fpxPose(fr) {
  const Q = { st: 'idle', p: 0, t: 0, sw: 0, lfN: 0, lfF: 0, bob: 0, br: 0, lean: 0, ha: 1.2, wa: -1.05, fa: 1.75, open: 0, blink: false, cast: 0, hurt: 0, smear: 0 };
  const n = +fr.slice(1) || 0;
  if (fr === 'windup') Object.assign(Q, { st: 'windup', t: 0.2, ha: -2.3, wa: 2.75, fa: 0.7, lean: -3, open: 0.45 });
  else if (fr === 'strike') Object.assign(Q, { st: 'strike', t: 0.45, ha: 0.35, wa: 0.6, fa: 2.4, lean: 4, open: 1, smear: 1, sw: 0.35, lfF: 1 });
  else if (fr === 'recover') Object.assign(Q, { st: 'recover', t: 0.7, ha: 0.95, wa: 1.25, fa: 2.05, lean: 2, open: 0.3, sw: 0.2 });
  else if (fr === 'hurt') Object.assign(Q, { st: 'hurt', t: 0.6, ha: 1.95, wa: -0.4, fa: -2.5, lean: -5, open: 0.85, hurt: 1, sw: -0.15 });
  else if (fr[0] === 'c') Object.assign(Q, { st: 'cast', p: n, t: n / 6, cast: (n + 1) / 6, ha: -1.3, wa: -1.45, fa: -1.95, open: 0.55 + (n & 1) * 0.2, lean: -1 });
  else if (fr[0] === 'w') {
    const a = n / 8 * FPX_T;
    Object.assign(Q, { st: 'walk', p: n, t: n / 8, sw: Math.sin(a), lfN: Math.max(0, Math.cos(a)) * 5, lfF: Math.max(0, -Math.cos(a)) * 5, bob: -(1 - Math.abs(Math.sin(a))) * 2 });
    Q.ha += Math.sin(a) * 0.15; Q.fa -= Math.sin(a) * 0.35;
  } else if (fr[0] === 'i') { Q.p = n; Q.t = n / 6; Q.br = Math.sin(Q.t * FPX_T); Q.blink = n === 4; Q.fa += Q.br * 0.05; }
  return Q;
}

// набор поверх fzPxKit: координаты эскиза × S → сетка; заливки с затенением по рампе
function fpxKit(b) {
  const B = fzPxKit(b[0] * 3, b[1] * 3, b[2] * 3, b[3] * 3), S = b[4] || 1;
  const X = { B, S, hsh: B.hsh };
  X.dth = (x, y) => B.dth(x * S, y * S);
  X.P = (x, y, col, a = 1, sol = true) => B.P(x * S, y * S, col, a, sol);
  X.R = (x0, y0, x1, y1, f, sol = true) => B.R(x0 * S - 1, y0 * S - 1, x1 * S + 1, y1 * S + 1, (x, y) => f(x / S, y / S), sol);
  // цвет рампы по светлоте v 0..1 с дизером между ступенями
  X.q = (ramp, v, x, y) => {
    const n = ramp.length - 1, f = Math.max(0, Math.min(n, v * n)), i = Math.floor(f);
    return ramp[Math.min(n, i + (f - i > X.dth(x, y) ? 1 : 0))];
  };
  // шар/эллипс со светом сверху-слева
  X.ell = (cx, cy, rx, ry, ramp, o = {}) => X.R(cx - rx, cy - ry, cx + rx, cy + ry, (x, y) => {
    const nx = (x - cx) / rx, ny = (y - cy) / ry, d = nx * nx + ny * ny;
    if (d > 1 || (o.cut && o.cut(x, y))) return null;
    const v = 0.42 + 0.42 * (nx * FPX_LX + ny * FPX_LY) + 0.18 * Math.sqrt(1 - d) + (o.b || 0);
    return (o.f && o.f(x, y, v, d)) || X.q(ramp, v, x, y);
  }, o.sol !== false);
  // цилиндр с сужением
  X.limb = (x0, y0, x1, y1, r0, r1, ramp, o = {}) => {
    const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1, rm = Math.max(r0, r1) + 1;
    X.R(Math.min(x0, x1) - rm, Math.min(y0, y1) - rm, Math.max(x0, x1) + rm, Math.max(y0, y1) + rm, (x, y) => {
      const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / l2)), ex = x - x0 - dx * t, ey = y - y0 - dy * t, r = r0 + (r1 - r0) * t;
      if (ex * ex + ey * ey > r * r) return null;
      const v = 0.52 + 0.38 * (ex * FPX_LX + ey * FPX_LY) / Math.max(0.5, r) + (o.b || 0);
      return (o.f && o.f(t, x, y, v)) || X.q(ramp, v, x, y);
    }, o.sol !== false);
  };
  // многоугольник: vf(x, y) → светлота или готовый цвет
  X.poly = (pts, ramp, vf, sol = true) => {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    X.R(x0, y0, x1, y1, (x, y) => {
      let ins = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
      }
      if (!ins) return null;
      const v = vf ? vf(x, y) : 0.7 - 0.45 * (x - x0) / (x1 - x0 || 1) - 0.2 * (y - y0) / (y1 - y0 || 1);
      return Array.isArray(v) ? v : v === null ? null : X.q(ramp, v, x, y);
    }, sol);
  };
  // горящий глаз: белое ядро, ореол без обводки
  X.eye = (cx, cy, r, G, hot) => {
    const rr = r * (hot ? 1.35 : 1);
    X.R(cx - rr * 3, cy - rr * 3, cx + rr * 3, cy + rr * 3, (x, y) => {
      const d = Math.hypot(x - cx, y - cy);
      return d < rr * 2.8 && d >= rr && X.dth(x, y) < 0.55 * (1 - d / (rr * 2.8)) ? [...G[2], 0.55] : null;
    }, false);
    X.R(cx - rr - 1, cy - rr - 1, cx + rr + 1, cy + rr + 1, (x, y) => { const d = Math.hypot(x - cx, y - cy); return d < rr * 0.55 ? G[3] : d < rr ? G[2] : d < rr + 0.7 ? G[1] : null; });
  };
  // язык пламени от основания (cx, by) вверх; F — рампа от тёмного к белому
  X.flame = (cx, by, w, h, t, F, k = 0, a = 0.95) => X.R(cx - w * 1.6, by - h, cx + w * 1.6, by + 1, (x, y) => {
    const u = (by - y) / h; if (u < 0 || u > 1) return null;
    const sx = cx + Math.sin(u * 3.2 + t * FPX_T + k) * w * 0.45 * u, hw = w * Math.pow(1 - u, 0.75) * (1 + 0.15 * Math.sin(t * FPX_T * 2 + k + u * 5));
    const r = Math.abs(x - sx) / Math.max(0.5, hw); if (r > 1) return null;
    if (u > 0.55 && X.dth(x, y) > 1.6 - u * 1.4) return null;
    const c = r < 0.4 && u < 0.5 ? F[3] : u < 0.35 + (1 - r) * 0.2 ? F[2] : u < 0.72 ? F[1] : F[0];
    return [...c, a];
  }, false);
  // искры/пепел/снег, поднимаются (или падают при dir > 0) по фазе t
  X.motes = (n, x0, x1, yb, hh, t, cols, dir = -1, seed = 0) => {
    for (let j = 0; j < n; j++) {
      const u = (X.hsh(j * 7 + seed) + t) % 1, x = x0 + X.hsh(j + seed) * (x1 - x0) + Math.sin(t * FPX_T + j) * 2.5, y = yb + dir * u * hh;
      if (u > 0.85 && X.dth(x, y) < (u - 0.85) * 6) continue;
      X.P(x, y, cols[j % cols.length], 0.9, false);
      if (j % 3 === 0) X.P(x, y - dir, cols[(j + 1) % cols.length], 0.6, false);
    }
  };
  // след удара: дуга вокруг (cx, cy) от угла a0 к a1
  X.smear = (cx, cy, r0, r1, a0, a1, cols) => X.R(cx - r1, cy - r1, cx + r1, cy + r1, (x, y) => {
    const d = Math.hypot(x - cx, y - cy); if (d < r0 || d > r1) return null;
    let a = Math.atan2(y - cy, x - cx); while (a < a0) a += FPX_T; if (a > a1) return null;
    const u = (a - a0) / (a1 - a0), e = (d - r0) / (r1 - r0);
    if (X.dth(x, y) > u * u * (0.15 + e * 0.6)) return null;
    return [...(e > 0.8 ? cols[1] : cols[0]), 0.25 + u * 0.45];
  }, false);
  // когтистая пятерня: n пальцев веером по направлению a, загнутые когти
  X.claw = (hx, hy, a, n, len, F, C, side = 1, spread = 0.38) => {
    for (let j = 0; j < n; j++) {
      const aj = a + (j - (n - 1) / 2) * spread, x1 = hx + Math.cos(aj) * len * 0.5, y1 = hy + Math.sin(aj) * len * 0.5;
      const a2 = aj + 0.6 * side, x2 = x1 + Math.cos(a2) * len * 0.6, y2 = y1 + Math.sin(a2) * len * 0.6;
      X.limb(hx, hy, x1, y1, 1.6, 1.2, F);
      X.limb(x1, y1, x2, y2, 1.2, 0.3, C, { f: t => t > 0.7 ? C[0] : null });
    }
  };
  // меч: рукоять, гарда с шипами, клинок с пилами на обухе, дол с рунами
  X.blade = (hx, hy, a, o) => {
    const ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux, L = o.len, W = o.w, M = o.M, Gd = o.Gd || M;
    X.limb(hx - ux * 6, hy - uy * 6, hx + ux * 3, hy + uy * 3, 1.6, 1.6, FPX_PAL.leather);
    X.ell(hx - ux * 7.5, hy - uy * 7.5, 2.4, 2.4, Gd);
    const gx = hx + ux * 4, gy = hy + uy * 4, gw = o.guard || W * 2.2;
    X.limb(gx - nx * gw, gy - ny * gw, gx + nx * gw, gy + ny * gw, 1.8, 1.8, Gd, { b: 0.1 });
    for (const s of [-1, 1]) X.limb(gx + s * nx * gw, gy + s * ny * gw, gx + s * nx * (gw + 2) + ux * 4, gy + s * ny * (gw + 2) + uy * 4, 1.4, 0.3, Gd);
    const bx = gx + ux * 1.5, by = gy + uy * 1.5, m = W + 3 + (o.curve || 0) * L * 0.3;
    X.R(Math.min(bx, bx + ux * L) - m, Math.min(by, by + uy * L) - m, Math.max(bx, bx + ux * L) + m, Math.max(by, by + uy * L) + m, (x, y) => {
      const px = x - bx, py = y - by, t = (px * ux + py * uy) / L;
      if (t < 0 || t > 1) return null;
      const sd = px * nx + py * ny - (o.curve || 0) * t * t * L * 0.3;
      const hw = W * (t < 0.78 ? 1 - t * 0.2 : (1 - t) / 0.22 * 0.84);
      let lo = -hw;
      if (o.jag && t > 0.06 && t < 0.8) { const ph = (t * L) % 6; lo += ph < 3 ? ph * 0.7 : (6 - ph) * 0.7; }
      if (sd < lo || sd > hw) return null;
      if (hw - sd < 1.1) return M[3];
      if (Math.abs(sd) < 0.8) return o.runes && t > 0.1 && t < 0.72 ? ((t * L) % 5 < 2.2 ? o.G[3] : o.G[1]) : M[0];
      return X.q(M, 0.5 + sd / hw * 0.3, x, y);
    });
  };
  return X;
}

const FPX_PAL = {
  ink: [10, 6, 14],
  bone: [[64, 56, 46], [116, 106, 88], [170, 160, 134], [214, 206, 180], [244, 238, 218]],
  green: [[26, 84, 22], [72, 190, 48], [156, 255, 102], [236, 255, 214]],
  iron: [[18, 14, 34], [38, 30, 66], [64, 54, 104], [98, 88, 146], [146, 138, 192]],
  night: [[12, 10, 26], [26, 22, 52], [46, 40, 88], [76, 68, 132], [124, 116, 184]],
  cloth: [[10, 6, 20], [22, 14, 40], [38, 26, 64], [58, 42, 92]],
  steel: [[48, 46, 70], [100, 98, 128], [170, 168, 196], [232, 232, 248]],
  violet: [[46, 36, 90], [90, 74, 170], [138, 122, 224], [200, 190, 255]],
  claw: [[20, 14, 24], [56, 46, 60], [120, 108, 118]],
  leather: [[26, 16, 12], [54, 36, 24], [86, 60, 38]],
};

// ---------- череп: глазницы со злой бровью, огонь в глазах, провал носа, оскал (open — насколько разинута пасть) ----------
function fpxSkull(X, cx, cy, r, o) {
  const B = o.Bn, G = o.G, open = o.open || 0, f = 0.18 * r, V = o.void || FPX_PAL.ink;
  const jy = cy + r * 0.8 + open * r * 0.45, mx = cx + f + r * 0.05;
  X.ell(cx + f * 1.2, jy, r * 0.6, r * 0.32, B, { b: -0.12 });                                 // нижняя челюсть
  X.ell(cx, cy - r * 0.18, r, r * 0.9, B, { b: o.b || 0 });                                   // черепная коробка
  X.ell(cx + f, cy + r * 0.38, r * 0.8, r * 0.46, B, { b: -0.06 });                           // скулы и верхняя челюсть
  X.R(cx - r, cy - r * 0.3, cx - r * 0.45, cy + r * 0.6, (x, y) => ((x - cx + r * 0.72) / (r * 0.26)) ** 2 + ((y - cy - r * 0.12) / (r * 0.34)) ** 2 < 1 ? X.q(B, 0.12, x, y) : null);   // висок
  // пасть: оскал с уголками вверх, в ударе — разинута
  X.R(mx - r * 0.55, cy + r * 0.5, mx + r * 0.55, jy + r * 0.1, (x, y) => {
    const ax = Math.abs(x - mx) / (r * 0.5); if (ax > 1) return null;
    const yy = y + ax * ax * r * 0.16, gx = Math.round(x * X.S), up = yy >= cy + r * 0.6 && yy < cy + r * 0.76, lo = yy >= jy - r * 0.24 && yy < jy - r * 0.08;
    const fang = (gx % 7 === 2 || gx % 7 === 3) && ax < 0.8;
    if (up || (open > 0.25 && fang && yy >= cy + r * 0.76 && yy < cy + r * (0.76 + open * 0.24))) return gx % 3 === 0 ? B[1] : yy < cy + r * 0.66 ? B[3] : B[4];
    if (lo || (open > 0.25 && fang && yy < jy - r * 0.24 && yy >= jy - r * (0.24 + open * 0.2))) return gx % 3 === 0 ? B[1] : B[3];
    if (open > 0.15 && yy >= cy + r * 0.76 && yy < jy - r * 0.24) return o.maw ? (X.dth(x, y) < 0.3 ? o.maw[1] : o.maw[0]) : V;
    if (!open && Math.abs(yy - cy - r * 0.76) < 0.6) return V;
    return null;
  });
  // глазницы: злая бровь — внутренний край ниже
  for (const s of [-1, 1]) {
    const ex = cx + f + s * r * 0.4, ey = cy + r * 0.04, rx = r * (s > 0 ? 0.32 : 0.27), ry = r * 0.28;
    X.R(ex - rx - 1, ey - ry - 2, ex + rx + 1, ey + ry + 1, (x, y) => {
      const d = ((x - ex) / rx) ** 2 + ((y - ey) / ry) ** 2, top = ey - ry * 0.7 + (x - ex) * -s * 0.55;
      if (d > 1 || y < top) return d <= 1.7 && y >= top - 1.4 && y < ey ? X.q(B, 0.1, x, y) : null;
      return V;
    });
    if (o.blink) X.R(ex - rx * 0.7, ey + 0.5, ex + rx * 0.7, ey + 1, () => G[1]);
    else X.eye(ex + s * r * 0.03, ey + ry * 0.2, Math.max(1.1, r * (s > 0 ? 0.14 : 0.12)), G, o.hot);
  }
  X.poly([[mx - r * 0.14, cy + r * 0.3], [mx + r * 0.1, cy + r * 0.3], [mx - r * 0.02, cy + r * 0.54]], [V], () => 0);   // провал носа
  for (const [a, b] of (o.cracks || [[-0.2, -1], [-0.05, -0.75], [-0.15, -0.55], [0.4, -0.95], [0.5, -0.8]])) X.P(cx + a * r, cy + b * r, B[0]);
}

// рог: от основания вверх и вперёд, кольцевые бороздки
function fpxHorn(X, bx, by, s, len, R0, ramp, b = 0) {
  const pts = [];
  for (let m = 0; m <= 8; m++) { const u = m / 8; pts.push([bx + s * u * len * 0.3 + u * u * len * 0.45, by - u * len * 0.9 + u * u * u * len * 0.25, R0 * (1 - u * 0.85)]); }
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0, r0] = pts[i - 1], [x1, y1, r1] = pts[i];
    X.limb(x0, y0, x1, y1, r0, r1, ramp, { b, f: (t, x, y, v) => (i + t) % 1.5 < 0.25 ? X.q(ramp, v - 0.3, x, y) : null });
  }
}

// ---------- латник: общая фигура прислужника, рыцаря и стражей ----------
// o: A — латы, C — плащ/ткань, Tm — отделка, G — свечение, Bn — кость лица, M — клинок, bulk, head(), weapon(), chest(), aura(),
// noLegs — вместо ног дымный подол, ribs — вместо кирасы рёбра, cape, out — цвет обводки
function fpxWarrior(X, Q, o) {
  const bk = o.bulk || 1, A = o.A, ux = Q.lean, uy = Q.bob + Q.br * 0.8, hipY = -46 + Q.bob * 0.6 + (o.noLegs ? -4 + Q.br * 1.5 : 0), shY = -88 + uy;
  if (o.aura) o.aura(X, Q, false);
  // плащ за спиной: рваный, с прорехами, отлетает назад в ударе
  if (o.cape) {
    const C = o.C, sway = Q.sw * 5 + Q.br * 1.5 + (Q.st === 'strike' ? 7 : Q.st === 'windup' ? -3 : 0), y0 = shY - 2, y1 = -6;
    X.R(-50, y0, 20, 2, (x, y) => {
      const t = (y - y0) / (y1 - y0), xl = -16 * bk + ux - t * (12 + sway) - t * t * 8, xr = 12 * bk + ux * (1 - t) - t * 6;
      if (x < xl || x > xr) return null;
      const cut = y1 - 6 + Math.floor(X.hsh(Math.floor(x / 3) + 7) * 12) + Math.sin(x * 0.4 + Q.t * FPX_T) * 1.5;
      if (y > cut || (y > cut - 10 && X.dth(x, y) > (cut - y) / 10 + 0.15)) return null;
      if (t > 0.3 && X.hsh(Math.floor(x / 4) * 13 + Math.floor(y / 5) * 7) > 0.94) return null;
      const fold = (((x - xl) / 5 + Math.sin(y * 0.07) * 0.6) % 1 + 1) % 1;
      return X.q(C, 0.2 + (fold < 0.3 ? 0.35 : 0) - t * 0.15 + (x - xl) / (xr - xl + 1) * 0.15, x, y);
    });
  }
  // ноги: бедро, наколенник с шипом, поножи, сапог с острым носком
  const leg = s => {
    const b = s < 0 ? -0.2 : 0, lf = s < 0 ? Q.lfF : Q.lfN, hx = s * 6 * bk + ux * 0.25, hy = hipY;
    const fx = s * 3 + s * Q.sw * 12, fy = -lf, kx = (hx + fx) / 2 + 4, ky = (hy + fy) / 2 - 2 + lf * 0.3;
    X.limb(hx, hy, kx, ky, 7 * bk, 5.5 * bk, A, { b });
    X.limb(kx, ky, fx - 1, fy - 8, 5.5 * bk, 4.2 * bk, A, { b: b - 0.05, f: (t, x, y, v) => t > 0.2 && (t * 16) % 4 < 0.7 ? X.q(A, v - 0.35, x, y) : null });
    X.poly([[fx - 6, fy], [fx - 6, fy - 9], [fx + 3, fy - 10], [fx + 6, fy - 4], [fx + 13, fy - 1], [fx + 13, fy]], A, (x, y) => 0.5 - (y - fy + 10) * 0.03 + b);
    X.ell(kx + 1, ky, 5 * bk, 4.5 * bk, A, { b: b + 0.1 });
    X.poly([[kx + 4, ky - 3], [kx + 11, ky - 1], [kx + 4, ky + 1.5]], o.Tm, (x, y) => 0.6 + b);
  };
  if (o.noLegs) {                                                                           // дымный подол вместо ног
    const C = o.C;
    X.R(-24, hipY - 4, 26, 4, (x, y) => {
      const t = (y - hipY) / (-hipY), hw = 13 * bk + t * 10, cx = ux * 0.3 + Math.sin(t * 4 + Q.t * FPX_T) * 3 * t;
      if (Math.abs(x - cx) > hw || y < hipY - 4) return null;
      const col = Math.floor((x - cx + 30) / 3.2), cut = -4 - X.hsh(col * 3.1) * 22 + Math.sin(Q.t * FPX_T + col) * 3;
      if (y > cut + 6) return null;
      if (y > cut - 8 && X.dth(x, y) > (cut + 6 - y) / 14) return null;
      return X.q(C, 0.45 - t * 0.45 + (((x - cx) / 4 % 1 + 1) % 1 < 0.3 ? 0.2 : 0), x, y);
    });
  } else { leg(-1); }
  // дальняя рука
  const arm = (s, a, len) => {
    const sx = s * 15 * bk + ux, sy = shY + 5, hx = sx + Math.cos(a) * len, hy = sy + Math.sin(a) * len;
    let nx = -(hy - sy), ny = hx - sx; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
    if (ny < 0 || (Math.abs(ny) < 0.2 && nx > 0)) { nx = -nx; ny = -ny; }
    const ex = (sx + hx) / 2 + nx * 5, ey = (sy + hy) / 2 + ny * 5, b = s < 0 ? -0.22 : 0;
    X.limb(sx, sy, ex, ey, 5.5 * bk, 4.5 * bk, A, { b });
    X.limb(ex, ey, hx, hy, 4.8 * bk, 4 * bk, A, { b: b + 0.05 });
    X.limb(ex + (hx - ex) * 0.55, ey + (hy - ey) * 0.55, ex + (hx - ex) * 0.8, ey + (hy - ey) * 0.8, 5.6 * bk, 5.4 * bk, A, { b: b + 0.12 });   // раструб наруча
    X.ell(ex, ey, 4 * bk, 4 * bk, A, { b: b + 0.1 });
    return [hx, hy, b];
  };
  const [fhx, fhy, fb] = arm(-1, Q.fa, 30 * bk);
  if (o.offhand) o.offhand(X, fhx, fhy, Q, o);
  else { X.ell(fhx, fhy, 4.4 * bk, 4 * bk, A, { b: fb + 0.1 }); X.claw(fhx, fhy, Q.fa + 0.15, 4, 9 * bk, A, o.Cl || FPX_PAL.claw, 1); }
  if (!o.noLegs) leg(1);
  // набедренник: пластины, по центру — рваная ткань с знаком
  X.poly([[-13 * bk + ux * 0.5, hipY - 10], [13 * bk + ux * 0.5, hipY - 10], [16 * bk + ux * 0.3, hipY + 8], [-16 * bk + ux * 0.3, hipY + 8]], A,
    (x, y) => (((x + 40) % 7) < 1 ? 0.15 : 0.55 - (x - ux) / (30 * bk) * 0.3 + (y - hipY) * -0.01));
  if (o.C && !o.noLegs) X.R(-2 + ux * 0.4, hipY - 8, 8 + ux * 0.4, hipY + 30, (x, y) => {
    const cut = hipY + 22 - Math.abs(x - ux * 0.4 - 3) * 1.2 + Math.floor(X.hsh(Math.floor(x / 2) + 3) * 6) + Q.sw * 2;
    if (y > cut || (y > cut - 6 && X.dth(x, y) > (cut - y) / 6)) return null;
    if (Math.abs(x - ux * 0.4 - 3) < 1.5 && y > hipY && y < hipY + 10) return o.G[(y - hipY) % 4 < 2 ? 2 : 1];   // знак на ткани
    return X.q(o.C, 0.75 - (x - ux * 0.4 + 2) / 10 * 0.5 + (y < hipY - 5 ? 0.2 : 0), x, y);
  });
  // торс
  const tw = 17 * bk;
  if (o.ribs) {                                                                             // костяная грудь: позвонки, рёбра, зелёный огонь души внутри
    X.ell(ux + 2, shY + 22, tw * 0.75, 18, [[...o.G[0]], o.G[1], o.G[2], o.G[3]], { sol: false, b: 0.1, f: (x, y, v, d) => d > 0.6 && X.dth(x, y) > 1 - d ? null : null });
    X.R(ux - 16, shY - 2, ux + 22, hipY - 4, (x, y) => {
      const dx = x - ux - 2, dy = y - shY - 22, d = (dx / (tw * 0.8)) ** 2 + (dy / 20) ** 2;
      return d < 1 && X.dth(x, y) < 0.7 - d * 0.6 ? [...o.G[d < 0.3 ? 2 : 1], 0.8] : null;
    }, false);
    for (let y = shY - 2; y < hipY - 4; y += 4) X.ell(ux - 7, y, 3, 2, o.Bn, { b: -0.05 });
    for (let k = 0; k < 6; k++) {
      const ry = shY + 6 + k * 6, rl = tw * (1 - Math.abs(k - 2) * 0.12);
      const pts = []; for (let m = 0; m <= 6; m++) { const u = m / 6; pts.push([ux - 7 + u * rl * 1.5, ry - Math.sin(u * Math.PI) * 5 + u * 3]); }
      for (let i = 1; i < pts.length; i++) X.limb(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], 1.8, 1.6, o.Bn, { b: -0.05 * i });
    }
    X.limb(ux + 10, shY + 6, ux + 12, shY + 30, 2, 1.6, o.Bn);                                // грудина
  } else {
    X.poly([[-tw + ux, shY], [tw + ux - 1, shY], [tw + 2 + ux, shY + 14], [13 * bk + ux * 0.6, hipY - 8], [-12 * bk + ux * 0.6, hipY - 8], [-tw + ux, shY + 14]], A, (x, y) => {
      const r = (x - ux) / tw;
      if (Math.abs(x - ux - 3) < 0.8 && y < shY + 30) return X.q(A, 0.85, x, y);           // гребень кирасы
      if (Math.abs(y - shY - 21 - Math.abs(x - ux - 3) * 0.25) < 0.7) return A[0];            // нижний край нагрудника
      if (y > shY + 24 && (y - shY - 24) % 6 < 0.8) return A[1];                              // пластины живота
      if ((Math.abs(r) > 0.82 && (y - shY) % 5 < 0.9)) return o.Tm[2];                        // заклёпки
      return 0.62 - r * 0.28 - (y - shY) / 60 * 0.3;
    });
  }
  if (o.chest) o.chest(X, ux, shY, hipY, Q, o);
  // пояс с пряжкой-черепком
  X.R(-14 * bk + ux * 0.6, hipY - 12, 14 * bk + ux * 0.6, hipY - 8, (x, y) => Math.abs(x - ux * 0.6) <= 13.5 * bk ? X.q(o.Tm, y === hipY - 12 ? 0.8 : 0.4, x, y) : null);
  X.ell(ux * 0.6 + 3, hipY - 10, 3.4, 3, o.Bn, { b: 0.1 });
  X.P(ux * 0.6 + 2, hipY - 10.5, o.G[2]); X.P(ux * 0.6 + 4.4, hipY - 10.5, o.G[2]);
  // дальний наплечник, горжет, голова
  const pauldron = (s, b) => {
    const px = s * (tw + 1) + ux, py = shY + 3;
    X.ell(px, py, 10 * bk, 8 * bk, A, { b: b + 0.08, cut: (x, y) => y > py + 5 * bk });
    X.R(px - 10 * bk, py + 2 * bk, px + 10 * bk, py + 5 * bk, (x, y) => ((x - px) / (10 * bk)) ** 2 + ((y - py) / (8 * bk)) ** 2 <= 1 ? X.q(o.Tm, 0.5 + b + ((x - px) % 4 < 0.9 ? 0.3 : 0), x, y) : null);
    for (const k of [-0.7, 0, 0.7]) {                                                       // шипы
      const bx = px + k * 6 * bk, by = py - 6 * bk + Math.abs(k) * 2, a = -Math.PI / 2 + k * 0.6 + s * 0.15, L = (k ? 7 : 10) * bk;
      X.poly([[bx - 2.2 * bk, by + 1], [bx + Math.cos(a) * L, by + Math.sin(a) * L], [bx + 2.2 * bk, by + 1]], o.Tm, (x, y) => 0.75 + b - (x - bx) * 0.08);
    }
  };
  pauldron(-1, -0.2);
  X.ell(ux + 1, shY - 3, 8 * bk, 5, A, { b: -0.15 });
  const hx = ux * 1.1 + 3, hy = shY - 18 + (Q.hurt ? -1 : 0);
  o.head(X, hx, hy, Q, o);
  // ближняя рука с оружием; в ударе — след
  if (Q.smear && o.wlen) X.smear(15 * bk + ux, shY + 5, 26 * bk + o.wlen * 0.55, 28 * bk + o.wlen, -1.9, Q.wa + 0.2, [o.G[1], o.G[3]]);
  const [hx2, hy2, b2] = arm(1, Q.ha, 29 * bk);
  o.weapon(X, hx2, hy2, Q.wa, Q, o);
  X.ell(hx2, hy2, 4.8 * bk, 4.4 * bk, A, { b: b2 + 0.12 });
  for (const j of [-1, 0, 1]) { const a = Q.wa + Math.PI / 2, x = hx2 + Math.cos(Q.wa) * j * 2.2 + Math.cos(a) * 3, y = hy2 + Math.sin(Q.wa) * j * 2.2 + Math.sin(a) * 3; X.limb(x, y, x + Math.cos(a - 0.7) * 4, y + Math.sin(a - 0.7) * 4, 1.1, 0.3, o.Cl || FPX_PAL.claw); }
  pauldron(1, 0);
  if (o.aura) o.aura(X, Q, true);
  X.B.outline(o.out || [16, 8, 30]);
}

// ---------- головы ----------
function fpxHeadThrall(X, hx, hy, Q, o) {                                                    // рогатый шлем, лицо-череп
  const r = 11;
  fpxHorn(X, hx - 6, hy - 8, -1, 22, 3.6, o.Hr, -0.2);
  fpxSkull(X, hx, hy, r, { Bn: o.Bn, G: o.G, open: Q.open, blink: Q.blink, hot: Q.hurt });
  X.R(hx - r * 1.3, hy - r * 1.35, hx + r * 1.3, hy, (x, y) => {
    const d = ((x - hx + 1) / (r * 1.18)) ** 2 + ((y - hy + r * 0.38) / (r * 0.98)) ** 2;
    if (d > 1 || y > hy - r * 0.3 + Math.max(0, hx - x) * 0.55) return null;
    const rim = y > hy - r * 0.3 + Math.max(0, hx - x) * 0.55 - 2.5;
    if (rim) return X.q(o.Tm, 0.55 + ((x + 50) % 5 < 1 ? 0.35 : 0), x, y);
    if (Math.abs(x - hx - 1) < 0.8) return X.q(o.A, 0.95, x, y);
    return X.q(o.A, 0.5 + 0.45 * ((x - hx) / r * FPX_LX + (y - hy + r) / r * FPX_LY) * 0.6, x, y);
  });
  X.poly([[hx - r * 1.1, hy - r * 0.4], [hx - r * 0.45, hy - r * 0.2], [hx - r * 0.6, hy + r * 0.75], [hx - r * 1.15, hy + r * 0.6]], o.A, (x, y) => (y - hy) % 4 < 0.8 ? 0.1 : 0.4);   // нащёчник
  fpxHorn(X, hx + 7, hy - 8, 1, 24, 3.8, o.Hr, 0.05);
}
function fpxHeadKnight(X, hx, hy, Q, o) {                                                    // шлем с Т-прорезью, в прорези — череп; венец шипов, плюмаж зелёного огня
  const r = 12, f = r * 0.18;
  for (let k = 0; k < 10; k++) {                                                             // плюмаж: огненные пряди назад
    const u = k / 9, bx = hx - 2 - u * 3, by = hy - r * 1.15;
    const ex = bx - 14 - u * 14 - Q.sw * 4 - (Q.st === 'strike' ? 6 : 0), ey = by - 8 + u * 14 + Math.sin(Q.t * FPX_T + k) * 2.5;
    X.limb(bx, by, (bx + ex) / 2, (by + ey) / 2 - 4, 3 - u * 0.8, 2.2, o.G, { sol: false, f: (t, x, y, v) => [...o.G[k % 3 === 0 ? 3 : 2], 0.85] });
    X.limb((bx + ex) / 2, (by + ey) / 2 - 4, ex, ey, 2.2, 0.4, o.G, { sol: false, f: (t, x, y) => X.dth(x, y) < 1 - t * 0.8 ? [...o.G[t < 0.4 ? 2 : 1], 0.8] : null });
  }
  fpxSkull(X, hx, hy, r * 0.92, { Bn: o.Bn, G: o.G, open: Q.open, blink: Q.blink, hot: Q.hurt });
  const hole = (x, y) => (Math.abs(x - hx - f) < r * 0.78 && y > hy - r * 0.32 && y < hy + r * 0.3 - Math.abs(x - hx - f) * 0.18) || (Math.abs(x - hx - f - r * 0.05) < r * 0.34 && y > hy && y < hy + r * 1.0);
  X.R(hx - r * 1.15, hy - r * 1.25, hx + r * 1.2, hy + r * 1.05, (x, y) => {
    const top = ((x - hx) / (r * 1.1)) ** 2 + ((y - hy + r * 0.2) / (r * 1.05)) ** 2;
    if (y < hy - r * 0.2 ? top > 1 : Math.abs(x - hx) > r * 1.1 - Math.max(0, y - hy - r * 0.5) * 0.4) return null;
    if (y > hy + r * 1.05 || hole(x, y)) return null;
    if (hole(x - 1, y) || hole(x + 1, y) || hole(x, y - 1) || hole(x, y + 1)) return o.A[0];     // кромка прорези
    if (Math.abs(x - hx - f) < 0.8 && y < hy - r * 0.32) return X.q(o.A, 0.95, x, y);          // гребень
    if (y > hy + r * 0.45 && x > hx + f + r * 0.4 && (Math.round(y * X.S) % 3 === 0) && x < hx + r) return o.A[0];   // прорези-дыхальца
    return X.q(o.A, 0.5 + 0.4 * ((x - hx) / r * FPX_LX + (y - hy) / r * FPX_LY) + (x > hx + r * 0.6 ? -0.15 : 0), x, y);
  });
  for (const k of [-0.6, -0.2, 0.2, 0.6]) {                                                  // венец шипов
    const a = -Math.PI / 2 + k * 0.9, bx = hx + Math.cos(a) * r * 1.05, by = hy - r * 0.2 + Math.sin(a) * r * 1.0, L = Math.abs(k) < 0.3 ? 11 : 7;
    X.poly([[bx - 2.2, by + 1.5], [bx + Math.cos(a) * L, by + Math.sin(a) * L], [bx + 2.2, by + 1.5]], o.Tm, (x, y) => 0.8 - (x - bx) * 0.1);
  }
}
function fpxHeadFire(X, hx, hy, Q, o) {                                                      // горящий череп в пламенном венце
  const r = 12, t = Q.t;
  for (let k = 0; k < 7; k++) X.flame(hx - 9 + k * 3 + (k & 1), hy - r * 0.55 + Math.abs(k - 3) * 1.5, 4.2, 18 + (k % 3) * 6 + (Q.cast ? 8 : 0), t, o.F, k * 1.7);
  fpxSkull(X, hx, hy, r, { Bn: o.Bn, G: o.F, open: Q.open, blink: false, hot: 1, maw: [o.F[0], o.F[1]], cracks: [[-0.3, -0.9], [-0.2, -0.7], [-0.25, -0.5], [0.3, -0.85], [0.42, -0.65], [0.5, -0.5], [-0.6, 0.1], [-0.65, 0.25]] });
  for (const s of [-1, 1]) X.flame(hx + r * 0.18 + s * r * 0.4, hy - r * 0.1, 1.8, 8, t + 0.3, o.F, s * 3, 0.8);   // огонь из глазниц
}
function fpxHeadIce(X, hx, hy, Q, o) {                                                       // замёрзший череп: венец сосулек, ледяная борода
  const r = 12;
  for (const [k, L] of [[-0.75, 9], [-0.4, 15], [0, 19], [0.4, 14], [0.75, 8]]) {
    const a = -Math.PI / 2 + k, bx = hx + Math.cos(a) * r * 0.8, by = hy - r * 0.2 + Math.sin(a) * r * 0.75;
    X.poly([[bx - 2.6, by + 2], [bx + Math.cos(a) * L, by + Math.sin(a) * L], [bx + 2.6, by + 2]], o.I, (x, y) => (x - bx) * (Math.cos(a + 1.57)) > 0 ? 0.95 : 0.5);
  }
  fpxSkull(X, hx, hy, r, { Bn: o.Bn, G: o.G, open: Q.open, blink: Q.blink, hot: Q.hurt, void: [8, 16, 30] });
  const jy = hy + r * 0.85 + Q.open * r * 0.45;
  for (let k = 0; k < 6; k++) {                                                              // ледяная борода
    const bx = hx - 3 + k * 2.6, L = 6 + X.hsh(k + 3) * 9 + (k === 2 ? 5 : 0);
    X.poly([[bx - 1.6, jy], [bx + 1.6, jy], [bx + 0.6, jy + L]], o.I, (x, y) => x < bx ? 0.9 : 0.45);
  }
  X.R(hx - 6, hy - r * 1.05, hx + 10, hy - r * 0.5, (x, y) => ((x - hx - 2) / 8) ** 2 + ((y - hy + r * 0.85) / 2.6) ** 2 < 1 && X.dth(x, y) < 0.6 ? o.I[4] : null);   // иней на темени
}
function fpxHeadBone(X, hx, hy, Q, o) {                                                      // бычий череп, бараньи рога закручены назад вокруг уха
  const r = 12.5;
  fpxHorn(X, hx - 7, hy - 7, -1, 18, 3.4, o.Hr, -0.25);
  const cx = hx - r * 0.95, cy = hy + r * 0.05;                                             // спираль за черепом: корень у темени, виток назад и вниз
  let px = 0, py = 0;
  for (let m = 0; m <= 20; m++) {
    const u = m / 20, a = -0.9 - u * 4.9, rr = r * 0.95 * (1 - u * 0.6), x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr, w = 5.2 * (1 - u * 0.75);
    if (m) X.limb(px, py, x, y, w + 0.4, w, o.Hr, { b: -0.05, f: (t, xx, yy, v) => (m % 2 && t < 0.3) ? X.q(o.Hr, v - 0.35, xx, yy) : null });
    px = x; py = y;
  }
  fpxSkull(X, hx, hy, r, { Bn: o.Bn, G: o.G, open: Q.open, blink: Q.blink, hot: Q.hurt });
  for (const k of [-0.25, 0.25]) {                                                          // короткие рожки на лбу
    const bx = hx + r * (0.15 + k), by = hy - r * 0.85;
    X.poly([[bx - 2, by + 1.5], [bx + 1 + k * 8, by - 7], [bx + 2, by + 1.5]], o.Hr, (x) => x < bx ? 0.85 : 0.45);
  }
}
function fpxHeadShadow(X, hx, hy, Q, o) {                                                    // острый капюшон, в пустоте — глаза и парящий оскал
  const r = 13;
  X.poly([[hx - r * 1.05, hy + r * 1.1], [hx - r * 1.1, hy - r * 0.2], [hx - r * 1.3 - Q.sw * 3, hy - r * 1.7], [hx - r * 0.2, hy - r * 1.05], [hx + r * 0.75, hy - r * 0.55], [hx + r * 1.05, hy + r * 0.4], [hx + r * 0.9, hy + r * 1.15]], o.C,
    (x, y) => 0.75 - (x - hx + r) / (2.4 * r) * 0.55 + ((((x - hx) / 4 + y * 0.05) % 1 + 1) % 1 < 0.2 ? -0.2 : 0));
  const vx = hx + 3, vy = hy + 2;
  X.ell(vx, vy, r * 0.62, r * 0.78, [[4, 2, 10]], { cut: () => false });
  X.R(vx - 9, vy - 11, vx + 9, vy + 11, (x, y) => ((x - vx) / (r * 0.7)) ** 2 + ((y - vy) / (r * 0.86)) ** 2 < 1 && ((x - vx) / (r * 0.6)) ** 2 + ((y - vy) / (r * 0.76)) ** 2 >= 1 ? o.C[0] : null);
  for (const s of [-1, 1]) {
    const ex = vx + s * 3.6 + 0.8, ey = vy - 3;
    X.R(ex - 3, ey - 2, ex + 3, ey + 2, (x, y) => Math.abs(y - ey - (x - ex) * s * 0.4) < 0.9 && Math.abs(x - ex) < 2.8 ? (Math.abs(x - ex) < 1.2 ? o.G[3] : o.G[2]) : null);
    if (!Q.blink) X.eye(ex, ey, 1.1, o.G, Q.hurt);
  }
  const op = Q.open * 4;
  X.R(vx - 7, vy + 2, vx + 7, vy + 9 + op, (x, y) => {                                       // парящий оскал
    const ax = Math.abs(x - vx) / 6.5; if (ax > 1) return null;
    const yy = y + ax * ax * 2.5, gx = Math.round(x * X.S);
    if (yy > vy + 3.2 && yy < vy + 5.4) return gx % 2 ? (yy < vy + 4.6 ? o.G[3] : o.G[2]) : null;
    if (op > 0.5 && yy > vy + 5.4 && yy < vy + 5.4 + op) return [40, 8, 50];
    if (yy >= vy + 5.4 + op && yy < vy + 7.4 + op) return gx % 2 ? null : o.G[2];
    return null;
  });
}

// ---------- оружие ----------
const fpxSword = (len, w, opt = {}) => (X, hx, hy, a, Q, o) => X.blade(hx, hy, a, Object.assign({ len, w, M: o.M, G: o.G, Gd: o.Tm, jag: true, runes: true }, opt));
function fpxTorchMace(X, hx, hy, a, Q, o) {                                                  // булава-факел: древко, шипастый кованый шар, огонь вверх
  const ux = Math.cos(a), uy = Math.sin(a), L = 26, bx = hx + ux * L, by = hy + uy * L;
  X.limb(hx - ux * 6, hy - uy * 6, bx, by, 1.8, 1.6, FPX_PAL.leather);
  for (let k = 0; k < 8; k++) { const ka = k / 8 * FPX_T; X.poly([[bx + Math.cos(ka + 0.4) * 4, by + Math.sin(ka + 0.4) * 4], [bx + Math.cos(ka) * 10, by + Math.sin(ka) * 10], [bx + Math.cos(ka - 0.4) * 4, by + Math.sin(ka - 0.4) * 4]], o.A, () => 0.6 - Math.cos(ka - 4) * 0.3); }
  X.ell(bx, by, 6.5, 6.5, o.A, { f: (x, y, v) => X.hsh(Math.round(x * 3) + Math.round(y * 7)) > 0.82 ? o.F[1] : null });
  for (let k = 0; k < 4; k++) X.flame(bx - 4 + k * 2.6, by - 3, 3.4, 14 + (k & 1) * 6 + (Q.smear ? 6 : 0), Q.t + k * 0.2, o.F, k * 2);
}
function fpxIceBlade(X, hx, hy, a, Q, o) {                                                   // ледяной клинок: гранёный, прозрачный, с осколками
  X.blade(hx, hy, a, { len: 40, w: 4.2, M: [o.I[1], o.I[2], o.I[3], o.I[4]], G: o.G, Gd: o.A, jag: false, runes: false });
  const ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
  for (const [t, s, l] of [[0.3, 1, 6], [0.5, -1, 7], [0.68, 1, 5], [0.42, 1, 4]]) {
    const bx = hx + ux * (6 + t * 40), by = hy + uy * (6 + t * 40);
    X.poly([[bx - ux * 2, by - uy * 2], [bx + nx * s * l + ux * 3, by + ny * s * l + uy * 3], [bx + ux * 2.5, by + uy * 2.5]], o.I, (x, y) => 0.75);
  }
}
function fpxBoneClub(X, hx, hy, a, Q, o) {                                                   // палица из бедренной кости с черепом и шипами
  const ux = Math.cos(a), uy = Math.sin(a), L = 26, bx = hx + ux * L, by = hy + uy * L;
  X.limb(hx - ux * 7, hy - uy * 7, bx, by, 2.4, 2.8, o.Bn);
  X.ell(hx - ux * 8, hy - uy * 8, 3.2, 3.2, o.Bn);
  for (const s of [-1, 1]) X.poly([[bx - ux * 3 + uy * s * 2, by - uy * 3 - ux * s * 2], [bx + uy * s * 9 - ux * 2, by - ux * s * 9 - uy * 2], [bx + ux * 2 + uy * s * 2, by + uy * 2 - ux * s * 2]], o.Hr, () => 0.7);
  fpxSkull(X, bx + ux * 3, by + uy * 3, 6.5, { Bn: o.Bn, G: o.G, open: Q.smear ? 0.8 : 0.2 });
}
function fpxShadowSickle(X, hx, hy, a, Q, o) {                                               // серп-керамбит: корявая рукоять, костяное кольцо, клинок с провалом у пяты и длинным крюком
  const U = [Math.cos(a), Math.sin(a)], V = [-Math.sin(a), Math.cos(a)], at = (u, v) => [hx + U[0] * u + V[0] * v, hy + U[1] * u + V[1] * v];
  const WD = [[14, 8, 10], [34, 22, 22], [58, 40, 36], [84, 62, 52]], RG = [[70, 56, 30], [140, 116, 64], [198, 176, 110], [236, 222, 168]];
  // рукоять: толстая, корявая, с изгибом и раструбом на конце
  const hp = [[-13, -1.6, 3.2], [-9, -0.6, 2.8], [-4, 0.2, 2.5], [2, 0, 2.4]];
  for (let i = 1; i < hp.length; i++) { const [x0, y0] = at(hp[i - 1][0], hp[i - 1][1]), [x1, y1] = at(hp[i][0], hp[i][1]); X.limb(x0, y0, x1, y1, hp[i - 1][2], hp[i][2], WD, { f: (t, x, y, v) => X.hsh(Math.round(x * 3) * 7 + Math.round(y * 3) * 13) > 0.78 ? X.q(WD, v - 0.35, x, y) : null }); }
  // костяное кольцо-гарда с узлами
  const [gx, gy] = at(4, 0);
  X.ell(gx, gy, 2.2, 3.6, RG, { f: (x, y, v) => X.hsh(Math.round(x * 3) * 5 + Math.round(y * 3) * 11) > 0.6 ? X.q(RG, v + 0.3, x, y) : X.q(RG, v - 0.2, x, y) });
  // клинок по осевой: (u, v, полуширина); +v — внутренняя (режущая) сторона крюка
  const C = [[5, 0, 2.2], [10, -0.4, 1.4], [14, -2.6, 2.4], [20, -3.8, 3.2], [27, -3.4, 3.6], [33, -0.6, 3.6], [37, 4, 3.2], [38.5, 10, 2.5], [37.5, 16, 1.6], [34.5, 21, 0.7], [31, 24, 0.1]];
  const P = C.map(([u, v, w]) => [...at(u, v), w]);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of P) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const M = [[24, 20, 40], [62, 56, 92], [118, 112, 156], [196, 192, 228]], G = o.G;
  X.R(x0 - 5, y0 - 5, x1 + 5, y1 + 5, (x, y) => {
    let best = null;
    for (let i = 1; i < P.length; i++) {
      const [ax, ay, aw] = P[i - 1], [bx, by, bw] = P[i], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)), px = x - ax - dx * t, py = y - ay - dy * t, w = aw + (bw - aw) * t, dd = Math.hypot(px, py), sd = (dx * py - dy * px) >= 0 ? dd : -dd;
      const s = (i - 1 + t) / (P.length - 1), ph = (s * 22) % 1, jag = s > 0.14 && s < 0.7 ? (ph < 0.5 ? ph * 2.6 : (1 - ph) * 2.6) * (0.6 + X.hsh(Math.floor(s * 22)) * 0.6) : 0;   // пилы на обухе
      if (sd > w || sd < -w + jag) continue;
      const k = Math.abs(sd) / w;
      if (!best || k < best.k) best = { k, sd, w, s };
    }
    if (!best) return null;
    const { sd, w, s } = best, e = sd / w;                                                   // e: −1 обух … +1 жало
    if (e > 0.72) return s > 0.2 && s < 0.9 && X.dth(x, y) < 0.45 ? G[3] : M[3];              // жало блестит, с отсветом тени
    if (e < -0.6) return M[0];   // тёмный рваный обух
    const wave = Math.sin((e * 1.6 + s * 5 + Math.sin(s * 12) * 0.3) * Math.PI);             // узор дамаска вдоль изгиба
    if (e > 0) return wave > 0.3 ? M[3] : M[2];
    return wave > 0.5 ? M[2] : M[1];
  });
}

// ---------- виды-латники ----------
const FPX_FIRE = [[120, 26, 8], [222, 92, 20], [255, 176, 64], [255, 244, 186]];
const FPX_ICE = [[40, 70, 108], [86, 140, 186], [150, 206, 236], [210, 242, 255], [250, 255, 255]];
const FPX_WAR = {
  fThrall: { A: FPX_PAL.iron, C: FPX_PAL.cloth, Tm: FPX_PAL.steel, G: FPX_PAL.green, Bn: FPX_PAL.bone, M: FPX_PAL.steel, Hr: [[54, 44, 34], [104, 90, 66], [158, 142, 104], [206, 194, 156]],
    cape: true, head: fpxHeadThrall, weapon: fpxSword(32, 3.4), wlen: 34, out: [14, 8, 26] },
  fKnight: { A: FPX_PAL.night, C: FPX_PAL.cloth, Tm: FPX_PAL.violet, G: FPX_PAL.green, Bn: FPX_PAL.bone, M: FPX_PAL.steel, bulk: 1.15,
    cape: true, head: fpxHeadKnight, weapon: fpxSword(54, 5, { guard: 9 }), wlen: 56, out: [10, 6, 22],
    chest: (X, ux, shY, hipY, Q, o) => {                                                     // зелёная руна на кирасе
      for (const [x0, y0, x1, y1] of [[2, 6, 2, 20], [-3, 10, 7, 10], [-2, 16, 6, 20], [6, 16, -2, 20]]) X.limb(ux + x0, shY + y0, ux + x1, shY + y1, 1, 1, o.G, { f: () => o.G[2] });
      X.R(ux - 6, shY + 3, ux + 10, shY + 23, (x, y) => X.dth(x, y) < 0.12 ? [...o.G[2], 0.5] : null, false);
    } },
  fG_fire: { A: [[26, 14, 10], [52, 26, 18], [86, 40, 24], [130, 62, 32], [176, 92, 44]], C: [[20, 8, 6], [44, 16, 10], [74, 28, 14], [106, 44, 20]], Tm: [[60, 30, 14], [130, 70, 30], [200, 120, 50], [250, 190, 110]],
    G: FPX_FIRE, F: FPX_FIRE, Bn: [[40, 22, 16], [86, 50, 34], [140, 96, 64], [196, 150, 104], [236, 200, 150]], head: fpxHeadFire, weapon: fpxTorchMace, wlen: 30, out: [30, 10, 6],
    chest: (X, ux, shY, hipY, Q, o) => {                                                     // лавовые трещины
      for (const pts of [[[-8, 2], [-4, 10], [-7, 16], [-2, 24]], [[8, 4], [5, 12], [10, 18]], [[0, 26], [3, 32], [-2, 38]]]) for (let i = 1; i < pts.length; i++) X.limb(ux + pts[i - 1][0], shY + pts[i - 1][1], ux + pts[i][0], shY + pts[i][1], 1.2, 0.9, o.F, { f: (t, x, y) => X.dth(x, y) < 0.4 ? o.F[3] : o.F[2] });
    },
    aura: (X, Q, front) => {
      if (!front) { X.R(-30, -14, 34, 3, (x, y) => { const d = (x / 30) ** 2 + ((y + 3) / 7) ** 2; return d < 1 && X.dth(x, y) < 0.5 * (1 - d) ? [...FPX_FIRE[1], 0.5] : null; }, false); return; }
      X.motes(18, -24, 30, -20, 110, Q.t, [FPX_FIRE[2], FPX_FIRE[3], FPX_FIRE[1]]);
    } },
  fG_ice: { A: [[26, 40, 64], [46, 74, 108], [78, 118, 156], [128, 170, 204], [196, 230, 248]], C: [[14, 24, 44], [30, 50, 80], [52, 82, 120], [84, 122, 164]], Tm: [[80, 120, 160], [150, 200, 230], [210, 240, 255], [255, 255, 255]],
    G: [[60, 120, 170], [140, 214, 244], [214, 248, 255], [255, 255, 255]], I: FPX_ICE, Bn: [[70, 92, 114], [124, 152, 174], [176, 202, 220], [218, 236, 248], [248, 252, 255]],
    cape: true, head: fpxHeadIce, weapon: fpxIceBlade, wlen: 44, out: [10, 22, 40],
    chest: (X, ux, shY, hipY, Q, o) => {                                                     // сосульки с наплечников и иней
      for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const bx = ux + s * 18 - 6 + k * 3.6, by = shY + 7, L = 4 + X.hsh(k * 5 + s) * 7; X.poly([[bx - 1.4, by], [bx + 1.4, by], [bx + 0.3, by + L]], o.I, (x) => x < bx ? 0.95 : 0.5); }
      X.R(ux - 16, shY, ux + 18, hipY, (x, y) => X.hsh(Math.round(x * 2) * 31 + Math.round(y * 2) * 17) > 0.965 ? o.I[4] : null);
    },
    aura: (X, Q, front) => {
      if (!front) { X.R(-34, -12, 38, 3, (x, y) => { const d = (x / 34) ** 2 + ((y + 3) / 8) ** 2; return d < 1 && X.dth(x, y) < 0.6 * (1 - d) ? [...FPX_ICE[3], 0.55] : null; }, false); return; }
      X.motes(16, -30, 34, -125, 125, Q.t, [FPX_ICE[4], FPX_ICE[3]], 1, 5);
    } },
  fG_bone: { A: [[40, 36, 30], [72, 66, 54], [106, 98, 82], [146, 138, 116], [188, 180, 156]], C: [[16, 14, 10], [34, 30, 22], [56, 50, 38], [80, 72, 56]], Tm: [[60, 56, 46], [116, 106, 88], [176, 166, 140], [230, 222, 196]],
    G: FPX_PAL.green, Bn: FPX_PAL.bone, Hr: [[60, 50, 36], [112, 98, 72], [164, 148, 112], [212, 200, 164]], ribs: true, cape: true, head: fpxHeadBone, weapon: fpxBoneClub, wlen: 34, out: [20, 16, 10] },
  fG_shadow: { A: [[6, 4, 14], [16, 10, 32], [30, 20, 58], [50, 34, 92], [80, 58, 136]], C: [[6, 4, 14], [18, 10, 36], [34, 22, 66], [58, 40, 104]], Tm: [[40, 26, 80], [96, 60, 170], [160, 120, 240], [220, 200, 255]],
    G: [[80, 40, 140], [160, 100, 240], [216, 184, 255], [250, 240, 255]], Bn: FPX_PAL.bone, noLegs: true, cape: true, head: fpxHeadShadow, weapon: fpxShadowSickle, wlen: 40, out: [8, 4, 18],
    aura: (X, Q, front) => {
      if (front) { X.motes(12, -26, 30, -10, 100, Q.t, [[160, 100, 240], [80, 50, 140]], -1, 9); return; }
      for (let k = 0; k < 7; k++) {                                                          // дымные языки за спиной
        const bx = -18 + k * 6, by = -40 - X.hsh(k) * 50;
        X.R(bx - 10, by - 30, bx + 10, by + 4, (x, y) => {
          const u = (by - y) / 30, cx = bx + Math.sin(u * 4 + Q.t * FPX_T + k) * 5 - u * 8, hw = 5 * (1 - u);
          return u >= 0 && u <= 1 && Math.abs(x - cx) < hw && X.dth(x, y) < 0.55 * (1 - u) ? [26, 14, 52, 0.7] : null;
        }, false);
      }
    } },
};
for (const k of Object.keys(FPX_WAR)) FPX_WAR[k].kind = k;
// колдовство стражей: в дальней руке растёт сгусток стихии, под ногами — круг рун
function fpxCastOff(X, hx, hy, Q, o) {
  const r = 3 + Q.cast * 7, G = o.F || o.G;
  X.ell(hx, hy, 4.4, 4, o.A, { b: 0 }); X.claw(hx, hy, -Math.PI / 2, 4, 9, o.A, FPX_PAL.claw, 1, 0.55);
  X.R(hx - r * 2.6, hy - 6 - r * 2.6, hx + r * 2.6, hy - 6 + r * 2.6, (x, y) => { const d = Math.hypot(x - hx, y - hy + 6); return d < r * 2.5 && d > r && X.dth(x, y) < 0.5 * (1 - d / (r * 2.5)) ? [...G[2], 0.6] : null; }, false);
  X.R(hx - r, hy - 6 - r, hx + r, hy - 6 + r, (x, y) => { const d = Math.hypot(x - hx, y - hy + 6), sp = Math.sin(Math.atan2(y - hy + 6, x - hx) * 5 + Q.t * FPX_T * 2) * 0.15; return d < r * (0.45 + sp) ? G[3] : d < r * (0.8 + sp) ? G[2] : d < r ? G[1] : null; }, false);
  X.R(-40, -10, 44, 6, (x, y) => { const d = Math.sqrt((x / 38) ** 2 + ((y + 1) / 7) ** 2); return Math.abs(d - 1) < 0.08 + (((Math.atan2(y + 1, x / 5) * 8 / FPX_T + Q.t) % 1 + 1) % 1 < 0.3 ? 0.06 : 0) && X.dth(x, y) < 0.3 + Q.cast * 0.6 ? [...G[2], 0.8] : null; }, false);
}
function fpxDrawWar(kind) {
  return (X, Q) => {
    const o = FPX_WAR[kind];
    fpxWarrior(X, Q, Q.st === 'cast' ? Object.assign({}, o, { offhand: fpxCastOff }) : o);
  };
}

// ---------- Малгор: высокий колдун в рваной мантии, высокий шипастый ворот, посох с когтями и кристаллом ----------
// Фаза 1 — иссохшее лицо в глубоком капюшоне, борода-тень; фаза 3 — капюшон истлел, череп в венце зелёного огня, рёбра наружу.
// Кристалл — в точке (36, -204) сетки = (12, -68) мира: там foeDrawMalgor рисует векторное свечение.
function fpxMalgor(ph) {
  return (X, Q) => {
    const P3 = ph === 3, t = Q.t, cast = Q.st === 'cast', hov = Q.br * 2;
    const RB = [[8, 5, 18], [20, 14, 42], [36, 26, 72], [58, 44, 108], [88, 72, 150]], LN = [[30, 8, 34], [64, 16, 60]];
    const G = P3 ? [[40, 110, 30], [120, 230, 70], [200, 255, 150], [250, 255, 236]] : FPX_PAL.green, SK = [[34, 40, 34], [62, 74, 58], [98, 112, 88], [138, 150, 118], [178, 188, 150]];
    const Bn = FPX_PAL.bone, CL = [[18, 12, 18], [48, 40, 46], [96, 88, 90]], BD = [[24, 22, 34], [50, 46, 64], [84, 80, 100], [124, 120, 138]];
    const HX = 4, HY = -172 + hov, shY = -142 + hov;
    // зелёный дым у подола и огонь в фазе 3
    X.R(-60, -30, 60, 2, (x, y) => { const d = (x / 54) ** 2 + ((y + 6) / 12) ** 2; return d < 1 && X.dth(x, y) < (0.45 + (P3 ? 0.2 : 0)) * (1 - d) ? [...G[P3 ? 1 : 0], 0.55] : null; }, false);
    // ворот: шипы веером за головой
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + (k - 3) * 0.32, bx = HX - 6 + Math.cos(a) * 16, by = shY - 4 + Math.sin(a) * 10, L = 26 + (k % 2 ? -6 : 4) - Math.abs(k - 3) * 2;
      X.poly([[bx - 4, by + 4], [bx + Math.cos(a) * L - 2, by + Math.sin(a) * L], [bx + 4, by + 4]], RB, (x, y) => 0.55 - (x - bx) * 0.03 + (((x + y) * 0.5) % 3 < 0.6 ? -0.25 : 0));
      X.limb(bx, by, bx + Math.cos(a) * L - 2, by + Math.sin(a) * L, 0.8, 0.5, G, { f: (tt, x, y) => tt > 0.15 && X.dth(x, y) < 0.6 ? G[1] : RB[0] });
    }
    // дальняя рука: в покое когти вниз с каплей огня, в колдовстве — над головой с шаром зелёного огня
    const FA = cast ? [-44, -206] : [-38, -84 + hov];
    const sleeve = (sx, sy, hx, hy, b) => {
      const mx = (sx + hx) / 2 - 4, my = (sy + hy) / 2 + 4;
      X.limb(sx, sy, mx, my, 9, 8, RB, { b });
      X.R(Math.min(mx, hx) - 12, Math.min(my, hy) - 12, Math.max(mx, hx) + 12, Math.max(my, hy) + 12, (x, y) => {   // широкий рукав-колокол с рваньём
        const dx = hx - mx, dy = hy - my, l2 = dx * dx + dy * dy, tt = Math.max(0, Math.min(1, ((x - mx) * dx + (y - my) * dy) / l2)), ex = x - mx - dx * tt, ey = y - my - dy * tt, r = 8 + tt * 4;
        if (tt > 0.86 || ex * ex + ey * ey > r * r) return null;
        if (tt > 0.7 && X.hsh(Math.round(Math.atan2(ey, ex) * 6) + 3) * 0.2 + 0.7 < tt) return null;
        return X.q(RB, 0.5 + 0.35 * (ex * FPX_LX + ey * FPX_LY) / r + b, x, y);
      });
      return [hx, hy];
    };
    const [fhx, fhy] = sleeve(-24, shY + 8, FA[0], FA[1], -0.15);
    if (cast) {
      const r = 11;
      X.R(fhx - 34, fhy - 46, fhx + 34, fhy + 14, (x, y) => { const d = Math.hypot(x - fhx, y - fhy + 14); return d < 30 && d > r && X.dth(x, y) < 0.55 * (1 - d / 30) ? [...G[2], 0.6] : null; }, false);
      for (let k = 0; k < 5; k++) X.flame(fhx - 8 + k * 4, fhy - 6, 4.5, 26 + (k % 2) * 10, t + k * 0.15, G, k * 1.3, 0.92);
      X.R(fhx - r, fhy - 14 - r, fhx + r, fhy - 14 + r, (x, y) => { const d = Math.hypot(x - fhx, y - fhy + 14); return d < r * 0.5 ? G[3] : d < r * 0.85 ? G[2] : d < r ? G[1] : null; }, false);
      X.claw(fhx, fhy, -Math.PI / 2, 5, 13, SK, CL, 1, 0.42);
    } else {
      X.claw(fhx, fhy, Math.PI / 2 + 0.2, 5, 14, SK, CL, -1, 0.34);
      const dy = (t * 30) % 30;
      X.R(fhx - 3, fhy + 10, fhx + 3, fhy + 46, (x, y) => { const u = (y - fhy - 10 - dy); return Math.abs(x - fhx) < 1.6 - Math.abs(u) * 0.1 && Math.abs(u) < 6 ? (u > 2 ? G[3] : G[2]) : null; }, false);
    }
    // мантия: книзу раструбом, рваный подол тает дымом, вертикальные складки, разрез с рунами
    const hwAt = y => 22 + (y - shY) * 0.17, front = x => x > HX + 4;
    X.R(-60, shY - 2, 60, 4, (x, y) => {
      const hw = hwAt(y), cx = Math.sin(t * FPX_T + y * 0.04) * 2 * (y - shY) / 140, r = (x - cx) / hw;
      if (Math.abs(r) > 1) return null;
      const col = Math.floor((x + 80) / 4), cut = -8 - X.hsh(col * 2.3 + ph) * (P3 ? 34 : 18) + Math.sin(t * FPX_T + col * 0.7) * 2.5;
      if (y > cut + 8) return null;
      if (y > cut - 4 && X.dth(x, y) > (cut + 8 - y) / 12) return null;
      if (P3 && y > -110 && X.hsh(Math.floor(x / 5) * 17 + Math.floor(y / 7) * 5) > 0.93) return null;
      const op = Math.abs(x - cx - 8 - (y - shY) * 0.04);                                    // разрез мантии
      if (op < 3.2 && y > shY + 40) return op < 0.9 ? (((y + 400) % 9) < 4 ? G[2] : G[0]) : LN[op < 2 ? 0 : 1];
      if (y > cut - 14 && y < cut - 10) return ((Math.round(x) + 200) % 6 < 3) ? G[1] : RB[0];    // рунная кайма у подола
      const fold = ((((x - cx) / (hw / 5) + Math.sin(y * 0.05 + t * FPX_T) * 0.3) % 1) + 1) % 1;
      return X.q(RB, 0.62 - r * 0.32 - (y - shY) / 160 * 0.25 + (fold < 0.17 ? -0.3 : fold < 0.3 ? 0.12 : 0), x, y);
    });
    if (P3) {                                                                                 // фаза 3: огонь по подолу, рёбра сквозь истлевшую грудь
      for (let k = 0; k < 9; k++) X.flame(-38 + k * 9.5, -10 - X.hsh(k + 9) * 18, 4, 16 + (k % 3) * 6, t + k * 0.11, G, k, 0.85);
      X.ell(HX + 2, shY + 30, 14, 20, [[6, 4, 12]]);
      for (let k = 0; k < 5; k++) { const ry = shY + 16 + k * 6; X.limb(HX - 10, ry, HX + 4, ry - 2, 1.6, 1.6, Bn); X.limb(HX + 4, ry - 2, HX + 14, ry + 3, 1.6, 1.3, Bn); }
      X.ell(HX + 2, shY + 34, 4, 4, G, { sol: false, f: (x, y, v, d) => d < 0.4 ? G[3] : G[2] });
    }
    // пояс: верёвка и черепки
    X.R(-30, shY + 54, 34, shY + 58, (x, y) => Math.abs(x) <= hwAt(y) ? X.q(FPX_PAL.leather, ((x + y) % 3 < 1) ? 0.2 : 0.7, x, y) : null);
    for (const [sx, sy] of [[-14, 64], [-4, 70], [8, 66]]) { X.limb(sx, shY + 57, sx + 1, shY + sy - 4, 0.6, 0.6, FPX_PAL.leather); fpxSkull(X, sx + 1, shY + sy, 4.2, { Bn, G, open: 0 }); }
    // наплечная накидка: рваные слои
    X.R(-40, shY - 8, 42, shY + 36, (x, y) => {
      const d = ((x - 1) / 34) ** 2 + ((y - shY - 4) / 30) ** 2, cut = shY + 20 + X.hsh(Math.floor((x + 60) / 4) + 40) * 16;
      if (d > 1 || y > cut) return null;
      if (y > cut - 4 && X.dth(x, y) > (cut - y) / 4) return null;
      return X.q(RB, 0.68 - x / 40 * 0.32 - (y - shY) / 40 * 0.2 + (((x + 60) % 9) < 1.2 ? -0.3 : 0), x, y);
    });
    // капюшон и лицо
    if (!P3) {
      X.poly([[HX - 24, HY + 28], [HX - 26, HY - 4], [HX - 30 - Q.br, HY - 34], [HX - 4, HY - 26], [HX + 14, HY - 18], [HX + 22, HY + 2], [HX + 20, HY + 30]], RB,
        (x, y) => 0.7 - (x - HX + 26) / 50 * 0.5 + ((((x - HX) / 5 + y * 0.04) % 1 + 1) % 1 < 0.18 ? -0.25 : 0));
      X.ell(HX + 4, HY + 4, 16, 21, [[5, 3, 10]]);
      // иссохшее лицо: впалые щёки, крючковатый нос, глаза-угли, тонкий оскал
      const FX = HX + 6, FY = HY + 3;
      X.R(FX - 12, FY - 14, FX + 12, FY + 20, (x, y) => {
        const dx = (x - FX) / 11.5, dy = (y - FY) / (y > FY ? 16 : 13); if (dx * dx * (1 + Math.max(0, dy) * 0.7) + dy * dy > 1) return null;
        const ax = Math.abs(x - FX), ch = (ax - 6.5) ** 2 * 0.7 + (y - FY - 6) ** 2;
        if (ch < 8) return ch < 3 ? SK[0] : SK[1];
        return X.q(SK, 0.75 - (x - FX + 10) / 20 * 0.35 - Math.max(0, y - FY) / 40 + (y < FY - 6 ? 0.1 : 0), x, y);
      });
      for (const s of [-1, 1]) {
        const ex = FX + s * 4.5 + 0.5, ey = FY - 1;
        X.R(ex - 4, ey - 3, ex + 4, ey + 3, (x, y) => { const d = ((x - ex) / 3.2) ** 2 + ((y - ey) / 2.6) ** 2, top = ey - 2 + (x - ex) * -s * 0.6; return d <= 1 && y >= top ? FPX_PAL.ink : d <= 1.6 && y >= top - 1 ? SK[0] : null; });
        if (Q.blink) X.R(ex - 2, ey, ex + 2, ey + 0.5, () => G[1]); else X.eye(ex + s * 0.3, ey + 0.5, 1.3, G, cast);
      }
      X.poly([[FX + 1, FY], [FX + 5, FY + 7], [FX + 2, FY + 8]], SK, () => 0.8);
      X.R(FX - 5, FY + 9, FX + 7, FY + 14 + (cast ? 4 : 0), (x, y) => {
        const ax = Math.abs(x - FX - 1) / 6, yy = y + ax * ax * 2.5; if (ax > 1) return null;
        if (cast && yy > FY + 10.5 && yy < FY + 15) return Math.round(x * 3) % 3 === 0 && yy < FY + 12 ? Bn[3] : [30, 6, 20];
        return Math.abs(yy - FY - 10.5) < 0.7 ? FPX_PAL.ink : Math.abs(yy - FY - 11.5) < 0.6 && Math.round(x * 3) % 2 ? Bn[2] : null;
      });
      for (let k = 0; k < 9; k++) {                                                          // борода-тень: длинные рваные пряди
        const bx = FX - 7 + k * 1.8, by = FY + 14, L = 30 + X.hsh(k) * 22, sw = Math.sin(t * FPX_T + k) * 2;
        X.limb(bx, by, bx - 3 + sw, by + L * 0.55, 1.8, 1.6, BD, { b: -0.1 + (k % 2) * 0.15 });
        X.limb(bx - 3 + sw, by + L * 0.55, bx - 6 + sw * 1.6, by + L, 1.6, 0.4, BD, { b: -0.2 });
      }
    } else {
      // фаза 3: истлевший капюшон сполз, череп в венце зелёного огня
      X.poly([[HX - 24, HY + 28], [HX - 25, HY + 2], [HX - 20, HY - 6], [HX - 6, HY - 2], [HX + 20, HY + 6], [HX + 20, HY + 30]], RB, (x, y) => X.hsh(Math.round(x) * 7 + Math.round(y)) > 0.9 ? 0.05 : 0.55 - (x - HX + 24) / 44 * 0.4);
      for (let k = 0; k < 8; k++) X.flame(HX - 10 + k * 3.4, HY - 9 + Math.abs(k - 3.5) * 1.6, 4.6, 22 + (k % 3) * 9 + (cast ? 8 : 0), t + k * 0.13, G, k * 1.9);
      fpxSkull(X, HX + 3, HY + 2, 14, { Bn, G, open: cast ? 1 : 0.35, blink: false, hot: 1, maw: [[20, 60, 16], G[1]] });
      for (const s of [-1, 1]) X.flame(HX + 5.5 + s * 5.6, HY + 1, 2, 10, t + 0.4, G, s * 2, 0.8);
    }
    // посох: кривое тёмное древко, оправа-когти вокруг кристалла
    const lift = cast ? -12 : 0, SX = 30, top = -192 + lift + hov * 0.5;
    X.limb(SX - 2, -6 + lift * 0.3, SX + 6, top, 2.6, 2.2, [[22, 14, 22], [46, 30, 40], [76, 54, 62], [104, 80, 84]], { f: (tt, x, y, v) => (tt * 30) % 5 < 0.7 ? X.q([[22, 14, 22], [46, 30, 40]], 0.2, x, y) : null });
    const cy = top - 12, CR = P3 || cast ? [[30, 90, 30], [90, 210, 60], [180, 255, 130], [244, 255, 226]] : [[60, 30, 110], [126, 88, 204], [192, 140, 255], [246, 232, 255]];
    X.poly([[SX + 6, cy - 13], [SX + 14, cy], [SX + 6, cy + 11], [SX - 2, cy]], CR, (x, y) => x < SX + 6 ? (y < cy ? 0.98 : 0.6) : (y < cy ? 0.65 : 0.3));
    X.limb(SX + 5, cy - 9, SX + 3, cy - 3, 0.7, 0.7, CR, { f: () => CR[3] });
    for (const s of [-1, 1]) {
      const bx = SX + 6 + s * 3, by = top + 2;
      X.limb(bx, by, bx + s * 8, by - 9, 1.6, 1.2, Bn); X.limb(bx + s * 8, by - 9, bx + s * 5, by - 20, 1.2, 0.4, CL);
    }
    X.limb(SX + 6, top + 2, SX + 6, top - 2, 2.2, 1.6, Bn);
    // ближняя рука на посохе
    const hy2 = -112 + lift + hov;
    const [hx2] = sleeve(24, shY + 8, SX + 2, hy2, 0.05);
    X.ell(hx2 + 1, hy2, 4.4, 4, SK, { b: 0.05 });
    for (const j of [-1, 0, 1]) X.limb(hx2 + 2, hy2 - 2 + j * 2.6, hx2 + 7, hy2 + j * 2.6 + 1, 1.2, 0.4, CL);
    X.B.outline(P3 ? [8, 16, 8] : [10, 6, 22]);
  };
}

// ---------- костяной прислужник: скелет-заморыш с зазубренным ржавым клинком ----------
function fpxBone(X, Q) {
  const Bn = FPX_PAL.bone, G = FPX_PAL.green, ux = Q.lean * 0.6, uy = Q.bob * 0.6 + Q.br * 0.5, hipY = -26 + Q.bob * 0.5, shY = -44 + uy;
  const RU = [[50, 26, 14], [98, 56, 28], [146, 96, 60], [196, 160, 120]];
  const bone = (x0, y0, x1, y1, r, b = 0) => { X.limb(x0, y0, x1, y1, r, r * 0.85, Bn, { b }); X.ell(x1, y1, r * 1.15, r * 1.15, Bn, { b: b + 0.1 }); };
  for (const s of [-1, 1]) {                                                                 // ноги
    const b = s < 0 ? -0.22 : 0, lf = s < 0 ? Q.lfF : Q.lfN, hx = s * 3 + ux * 0.2, fx = s * 2 + s * Q.sw * 7, fy = -lf * 0.6, kx = (hx + fx) / 2 + 2.5, ky = (hipY + fy) / 2;
    bone(hx, hipY, kx, ky, 1.6, b); bone(kx, ky, fx, fy - 2, 1.4, b);
    X.limb(fx - 2, fy - 1, fx + 4, fy - 0.5, 1.2, 0.8, Bn, { b });
    if (s < 0) {                                                                             // дальняя рука
      const a = Q.fa, sx = -5 + ux, sy = shY + 2, ex = sx + Math.cos(a) * 9 - 2, ey = sy + Math.sin(a) * 9, hx2 = ex + Math.cos(a - 0.2) * 9, hy2 = ey + Math.sin(a - 0.2) * 9;
      bone(sx, sy, ex, ey, 1.3, -0.25); bone(ex, ey, hx2, hy2, 1.1, -0.25); X.claw(hx2, hy2, a, 3, 5, Bn, FPX_PAL.claw, 1);
    }
  }
  X.R(-9 + ux * 0.3, hipY - 2, 9 + ux * 0.3, hipY + 14, (x, y) => {                          // рваная набедренная тряпка
    const cut = hipY + 6 + X.hsh(Math.floor(x) + 4) * 8 + Q.sw * 1.5; if (y > cut || (y > cut - 3 && X.dth(x, y) > (cut - y) / 3)) return null;
    return X.q(FPX_PAL.cloth, 0.6 - (x - ux * 0.3 + 9) / 18 * 0.5, x, y);
  });
  X.ell(ux * 0.3, hipY - 1, 6, 3.2, Bn, { b: -0.05 });                                       // таз
  for (let y = hipY - 3; y > shY; y -= 2.6) X.ell(ux * 0.6 - 1, y, 1.6, 1.2, Bn, { b: -0.1 }); // позвоночник
  X.R(ux - 7, shY, ux + 9, shY + 15, (x, y) => ((x - ux - 1) / 7) ** 2 + ((y - shY - 7) / 7) ** 2 < 1 && X.dth(x, y) < 0.35 ? [...G[1], 0.6] : null, false);
  for (let k = 0; k < 4; k++) {                                                              // рёбра
    const ry = shY + 3 + k * 3.2, rl = 8 - Math.abs(k - 1) * 1.2;
    X.limb(ux - 1, ry, ux + rl * 0.6, ry - 1.5, 1, 1, Bn, { b: -0.05 }); X.limb(ux + rl * 0.6, ry - 1.5, ux + rl, ry + 1.5, 1, 0.8, Bn, { b: -0.05 });
  }
  X.ell(ux + 0.5, shY, 6, 1.8, Bn);                                                          // ключицы
  const hx = ux + 3 + (Q.hurt ? -1 : 0), hy = shY - 10 + (Q.st === 'strike' ? 1 : 0);
  X.limb(ux, shY, hx - 1, hy + 5, 1.4, 1.4, Bn);
  fpxSkull(X, hx, hy, 8.5, { Bn, G, open: Q.open, blink: Q.blink, hot: Q.hurt });
  if (Q.smear) X.smear(6 + ux, shY + 2, 24, 36, -1.9, 1.0, [G[1], G[3]]);
  const a = Q.ha, sx = 5 + ux, sy = shY + 2, ex = sx + Math.cos(a) * 9 - 1, ey = sy + Math.sin(a) * 9 + 1.5, hx2 = ex + Math.cos(a - 0.15) * 9, hy2 = ey + Math.sin(a - 0.15) * 9;
  bone(sx, sy, ex, ey, 1.4);
  X.blade(hx2, hy2, Q.wa, { len: 21, w: 2.6, M: RU, G, Gd: RU, jag: true, runes: false, guard: 4 });
  bone(ex, ey, hx2, hy2, 1.2);
  for (const j of [-1, 0, 1]) X.limb(hx2 + j * 1.1, hy2 + 1, hx2 + j * 1.1 + 2, hy2 + 3, 0.8, 0.3, FPX_PAL.claw);
  X.B.outline([22, 18, 12]);
}

// ---------- ворон-разведчик: дохлый ворон с голым черепом-клювом, рваными крыльями и зелёным глазом ----------
function fpxRaven(X, Q) {
  const up = Math.cos(Q.p / 6 * FPX_T), FE = [[8, 6, 18], [20, 16, 38], [36, 28, 62], [60, 48, 98], [96, 84, 150]], Bn = FPX_PAL.bone, G = FPX_PAL.green;
  const wing = (b, s) => {                                                                   // плечо → кисть → маховые перья веером
    const sx = 0, sy = -3, wx = -6 - up * 1, wy = sy - up * 16, tip = up * 22;
    X.limb(sx, sy, wx, wy, 3.6, 2.6, FE, { b });
    for (let k = 0; k < 7; k++) {
      const u = k / 6, ex = wx - 4 - u * 22 + (1 - u) * 6, ey = wy - tip * (0.4 + u * 0.6) * (up > 0 ? 0.5 : -0.4) - (up > 0 ? 8 - u * 10 : -6 + u * 6) + s * 2;
      if (X.hsh(k * 3 + 1) > 0.85) continue;                                                 // выпавшее перо
      X.limb(wx + u * 3, wy + u * 2, ex, ey, 2.4, 0.8, FE, { b: b + (k % 2 ? 0.1 : -0.05), f: (t, x, y, v) => t > 0.85 && X.dth(x, y) > 0.5 ? null : null });
    }
    X.limb(sx - 2, sy + 1, wx - 6, wy + (up > 0 ? 6 : -4), 3.2, 2.2, FE, { b: b + 0.15 });  // кроющие
  };
  wing(-0.25, -1);
  for (let k = 0; k < 6; k++) X.limb(-10, 1, -26 - k * 0.6, -4 + k * 2.4 + Math.sin(Q.t * FPX_T + k) * 0.6, 2.2, 1, FE, { b: -0.05 * k });   // хвост
  X.ell(-2, 1, 13, 7, FE, { b: 0.05 });                                                      // тело
  X.R(-8, 3, 4, 8, (x, y) => (Math.round(x * 3) % 4 === 0 && ((x + 2) / 7) ** 2 + ((y - 5) / 3) ** 2 < 1) ? Bn[2] : null);   // рёбра сквозь проплешину
  X.R(-8, 2, 4, 9, (x, y) => ((x + 2) / 6.5) ** 2 + ((y - 5) / 3) ** 2 < 1 && Math.round(x * 3) % 4 !== 0 ? [24, 10, 20] : null);
  for (let k = 0; k < 5; k++) X.limb(5 + k, -6 + k * 0.5, 4 + k * 0.8, -11 - X.hsh(k) * 3, 1.2, 0.4, FE, { b: 0.05 });   // взъерошенный ворот
  fpxSkull(X, 10, -5, 6, { Bn, G, open: 0, blink: false, hot: 0, cracks: [] });             // голый череп
  X.poly([[13, -6], [27, -3.2], [24, -1.5], [27, -0.8], [14, 0.5]], [[60, 56, 50], [120, 114, 100], [190, 184, 168]], (x, y) => y < -3 ? 0.9 : 0.35);   // клюв с крюком
  for (const s of [-1, 1]) {                                                                 // лапы с когтями
    X.limb(-1 + s * 2, 7, s * 2, 12, 0.9, 0.7, [[60, 56, 50], [120, 114, 100]]);
    X.claw(s * 2, 12, 1.2, 3, 4, [[60, 56, 50], [120, 114, 100]], FPX_PAL.claw, -1, 0.6);
  }
  wing(0.05, 1);
  X.B.outline([10, 6, 22]);
}

// ---------- ожившая глыба: зубастый гранёный валун, обсидиановые шипы на спине, лава в пасти и трещинах, глаза-угли под каменной бровью ----------
// камень с гранями: рваный край по секторам, свет по грани
function fpxStone(X, cx, cy, rx, ry, ramp, seed, b = 0, crack = 0.92) {
  const N = 11, rad = k => 0.82 + X.hsh(((k % N) + N) % N + seed) * 0.3;
  X.R(cx - rx * 1.15, cy - ry * 1.15, cx + rx * 1.15, cy + ry * 1.15, (x, y) => {
    const dx = (x - cx) / rx, dy = (y - cy) / ry, a = Math.atan2(dy, dx), f = (a + Math.PI) / FPX_T * N, k = Math.floor(f), u = f - k, d = Math.hypot(dx, dy);
    const R0 = rad(k) + (rad(k + 1) - rad(k)) * u;
    if (d > R0) return null;
    const ac = (k + 0.5) / N * FPX_T - Math.PI, inner = d < R0 * 0.5;
    const nx = Math.cos(ac) * (inner ? 0.25 : 0.85), ny = Math.sin(ac) * (inner ? 0.25 : 0.85), nz = Math.sqrt(1 - nx * nx - ny * ny);
    let v = 0.4 + 0.45 * (nx * FPX_LX + ny * FPX_LY) + 0.2 * nz + b + X.hsh(k * 7 + seed + (inner ? 50 : 0)) * 0.1;
    if (Math.abs(d - R0 * 0.5) < 0.06 || (u < 0.06 && !inner)) v -= 0.22;                    // рёбра граней
    if (X.hsh(Math.round(x * 2) * 13 + Math.round(y * 2) * 7 + seed) > crack) v -= 0.3;       // выбоины
    return X.q(ramp, v, x, y);
  });
}
function fpxRock(X, Q) {
  const ST = [[26, 22, 22], [50, 44, 42], [80, 72, 66], [114, 104, 94], [150, 140, 126]], LV = [[110, 30, 8], [226, 98, 24], [255, 182, 70], [255, 246, 200]], OB = [[14, 10, 18], [36, 28, 44], [70, 58, 84], [120, 108, 140]];
  const ux = Q.lean * 1.4, uy = Q.bob + Q.br * 0.8, cx = ux, cy = -32 + uy, op = Q.open * 6 + (Q.st === 'strike' ? 3 : 0);
  // ножки-обломки с когтями
  for (const s of [-1, 1]) {
    const lf = s < 0 ? Q.lfF : Q.lfN, fx = s * 13 + s * Q.sw * 7, b = s < 0 ? -0.2 : 0;
    fpxStone(X, fx, -9 - lf, 8, 9, ST, 30 + s, b - 0.05);
    for (const j of [0, 1, 2]) X.poly([[fx + j * 4 - 2, -2 - lf], [fx + j * 4 + 5, 1 - lf], [fx + j * 4 + 1, -4 - lf]], OB, () => 0.55 + b);
  }
  // обсидиановые шипы на спине, у основания светится лава
  for (const [bx, by, a, L] of [[-22, -12, -2.5, 22], [-16, -26, -2.1, 28], [-4, -32, -1.75, 24], [8, -32, -1.45, 16]]) {
    const x0 = cx + bx, y0 = cy + by, nx = -Math.sin(a), ny = Math.cos(a);
    X.poly([[x0 + nx * 5, y0 + ny * 5], [x0 + Math.cos(a) * L, y0 + Math.sin(a) * L], [x0 - nx * 5, y0 - ny * 5]], OB, (x, y) => ((x - x0) * nx + (y - y0) * ny) > 0 ? 0.85 : 0.3);
    X.ell(x0, y0, 4, 4, LV, { sol: false, f: () => [...LV[1], 0.8] });
  }
  fpxStone(X, cx - 12, cy + 6, 16, 14, ST, 7, -0.15);                                         // глыба-туловище
  fpxStone(X, cx + 3, cy, 29, 25, ST, 3);
  for (const pts of [[[-10, -22], [-6, -12], [-12, -4], [-7, 6], [-10, 14]], [[-20, -6], [-14, 2]], [[14, -24], [10, -18]]]) for (let i = 1; i < pts.length; i++) X.limb(cx + pts[i - 1][0], cy + pts[i - 1][1], cx + pts[i][0], cy + pts[i][1], 1.4, 1, LV, { f: (t, x, y) => X.dth(x, y) < 0.45 ? LV[2] : LV[1] });   // лавовые трещины
  // пасть: широкая трещина с лавой, каменные клыки сверху и снизу, капает
  const MX = cx + 14, MY = cy + 6;
  X.R(MX - 18, MY - 4, MX + 16, MY + 12 + op, (x, y) => {
    const ax = (x - MX) / 16; if (Math.abs(ax) > 1) return null;
    const top = MY - 1 - ax * ax * 3, bot = MY + 4 + op * (1 - ax * ax) - ax * ax * 2;
    if (y < top - 1 || y > bot + 1) return null;
    const gx = Math.round(x * X.S), fu = (gx % 6 + 6) % 6, fang = fu < 3 ? (3 - Math.abs(fu - 1.5)) * 1.2 : 0;
    if (y >= top && y < top + fang * (1 + Q.open)) return y < top + 1 ? ST[4] : ST[3];          // верхние клыки
    if (y <= bot && y > bot - fang * 0.8 * (1 + Q.open)) return ST[3];                         // нижние клыки
    if (y < top || y > bot) return null;
    return (y - top) / (bot - top + 0.1) < 0.3 ? LV[0] : X.dth(x, y) < 0.5 ? LV[2] : LV[1];
  });
  for (const k of [0, 1]) { const dx = MX - 6 + k * 10, dl = ((Q.t + k * 0.5) % 1) * 8; X.limb(dx, MY + 5 + op, dx + 0.3, MY + 8 + op + dl, 1, 0.5, LV, { sol: false, f: () => [...LV[2], 0.9] }); }
  // каменная бровь-уступ и глаза-угли под ней
  X.poly([[cx + 1, cy - 16], [cx + 30, cy - 15], [cx + 32, cy - 10], [cx + 24, cy - 6], [cx + 16, cy - 9], [cx + 8, cy - 6], [cx + 1, cy - 10]], ST, (x, y) => y < cy - 13 ? 0.95 : 0.55);
  for (const s of [-1, 1]) {
    const ex = cx + 16 + s * 6.5, ey = cy - 4;
    X.poly([[ex - 4, ey - 3 - s * 1.2], [ex + 4, ey - 3 + s * 1.2], [ex + 3, ey + 2], [ex - 3, ey + 2]], [FPX_PAL.ink], () => 0);
    if (!Q.blink) X.eye(ex, ey - 0.3, 1.6, LV, 1);
  }
  // каменная лапа с когтями спереди
  const ha = Q.st === 'strike' ? 0.2 : Q.st === 'windup' ? -1.2 : 0.9 + Q.br * 0.1, shx = cx + 20, shy = cy + 8, hx = shx + Math.cos(ha) * 14, hy = shy + Math.sin(ha) * 14;
  X.limb(shx, shy, hx, hy, 4.5, 3.6, ST, { b: 0.05 });
  X.claw(hx, hy, ha + 0.3, 3, 9, ST, OB, 1, 0.45);
  if (Q.smear) X.motes(12, cx + 12, cx + 40, cy + 18, 22, 0.3, [ST[3], ST[2], LV[1]], -1, 3);
  X.motes(6, cx - 20, cx + 20, cy - 20, 30, Q.t, [LV[2], LV[1]], -1, 11);                     // искры над шипами
  X.B.outline([20, 12, 10]);
}

// ---------- страж-голем: сгорбленная глыба, голова утоплена ниже плеч-валунов с кристаллами, в груди — расколотое светящееся ядро,
// клыкастая пасть, ручищи до земли с шипастыми кулаками и обрывками кандалов ----------
function fpxGolem(X, Q) {
  const ST = [[22, 20, 32], [44, 40, 58], [70, 64, 88], [100, 92, 122], [138, 130, 160]], GL = [[90, 40, 150], [170, 100, 255], [216, 176, 255], [255, 246, 255]], MS = [[26, 44, 22], [50, 78, 36], [86, 118, 56]];
  const CR = [[60, 30, 120], [134, 86, 226], [196, 160, 255], [250, 238, 255]], IR = [[22, 20, 26], [56, 52, 60], [100, 96, 104]];
  const ux = Q.lean * 1.8, uy = Q.bob * 1.4 + Q.br * 1.5, hipY = -64 + Q.bob, cst = Q.st === 'cast', hot = Q.hurt || cst || Q.st === 'strike';
  const rune = (x0, y0, x1, y1) => X.limb(x0, y0, x1, y1, 1.3, 1.1, GL, { f: (t, x, y) => X.dth(x, y) < 0.3 + Q.cast * 0.5 ? GL[3] : GL[2] });
  if (cst) for (let k = 0; k < 7; k++) { const a = k / 7 * FPX_T + Q.t * FPX_T, r = 70; fpxStone(X, Math.cos(a) * r, -110 + Math.sin(a) * 18 - Q.cast * 18, 6 + (k % 3) * 2, 5 + (k % 2) * 2, ST, k, Math.sin(a) > 0 ? 0 : -0.2); }
  X.R(-70, -16, 74, 4, (x, y) => { const d = (x / 66) ** 2 + ((y + 4) / 10) ** 2; return d < 1 && X.dth(x, y) < 0.35 * (1 - d) ? [...ST[2], 0.6] : null; }, false);   // пыль
  const arm = (s, a, b) => {                                                                 // ручища: плечо-валун, предплечье, кулак с шипами, кандалы
    const sx = s * 44 + ux, sy = -136 + uy, ex = sx + Math.cos(a) * 34 - 6, ey = sy + Math.sin(a) * 34, a2 = a - 0.12 * s, hx = ex + Math.cos(a2) * 38, hy = ey + Math.sin(a2) * 38;
    X.limb(sx, sy, ex, ey, 15, 13, ST, { b });
    X.limb(ex, ey, hx, hy, 14, 16, ST, { b: b + 0.05 });
    const cx = ex + (hx - ex) * 0.62, cy = ey + (hy - ey) * 0.62;
    X.limb(cx - Math.cos(a2) * 4, cy - Math.sin(a2) * 4, cx + Math.cos(a2) * 4, cy + Math.sin(a2) * 4, 17.5, 17.5, IR, { b: b + 0.1, f: (t, x, y) => (Math.round(x * 3 + y * 3) % 7 === 0) ? IR[0] : null });   // кандалы
    for (let j = 0; j < 3; j++) { const lx = cx - 6 - j * 5, ly = cy + 16 + j * 5 + Math.sin(Q.t * FPX_T + j) * 1.5; X.ell(lx, ly, 3, 2.2, IR, { b, cut: (x, y) => Math.hypot((x - lx) / 1.6, (y - ly) / 0.9) < 1 }); }
    fpxStone(X, hx, hy, 20, 17, ST, 20 + s, b + 0.1);
    for (const k of [-1, 0, 1]) { const kx = hx + Math.cos(a2) * 15 + Math.cos(a2 + 1.57) * k * 9, ky = hy + Math.sin(a2) * 15 + Math.sin(a2 + 1.57) * k * 9; X.poly([[kx - Math.cos(a2 + 1.57) * 3.5, ky - Math.sin(a2 + 1.57) * 3.5], [kx + Math.cos(a2) * 10, ky + Math.sin(a2) * 10], [kx + Math.cos(a2 + 1.57) * 3.5, ky + Math.sin(a2 + 1.57) * 3.5]], CR, () => 0.6 + b - k * 0.15); }
    rune(ex - 4, ey + 8, ex + 5, ey + 20); rune(sx - 6, sy + 4, sx + 2, sy + 14);
    return [hx, hy];
  };
  arm(-1, Q.st === 'strike' ? 2.0 : Q.st === 'windup' ? 0.9 : cst ? -1.9 : 1.62 + Q.sw * 0.25, -0.25);
  for (const s of [-1, 1]) {                                                                 // ноги-столбы
    const b = s < 0 ? -0.22 : 0, lf = s < 0 ? Q.lfF : Q.lfN, hx = s * 20 + ux * 0.3, fx = s * 18 + s * Q.sw * 12;
    X.limb(hx, hipY, fx, -14 - lf, 17, 16, ST, { b });
    fpxStone(X, fx + 3, -9 - lf, 21, 10, ST, 40 + s, b);
    rune(hx - 3, hipY + 16, fx + 2, hipY + 34);
  }
  fpxStone(X, ux + 6, -92 + uy, 42, 30, ST, 2, -0.1);                                        // брюхо
  fpxStone(X, ux + 6, -124 + uy, 52, 40, ST, 5, 0);                                          // грудь-глыба
  fpxStone(X, ux - 18, -158 + uy, 36, 22, ST, 9, 0.08);                                      // горб
  X.R(ux - 56, -186 + uy, ux + 20, -146 + uy, (x, y) => { const d = ((x - ux + 18) / 36) ** 2 + ((y + 158 - uy) / 22) ** 2; return d < 1 && d > 0.55 && y < -160 + uy && X.dth(x, y) < 0.8 ? X.q(MS, 0.3 + X.hsh(Math.round(x)) * 0.7, x, y) : null; });
  for (const s of [-1, 1]) fpxStone(X, s * 42 + ux + (s > 0 ? 4 : 0), -150 + uy, 26, 22, ST, 60 + s, s < 0 ? -0.1 : 0.1);   // плечи-валуны выше головы
  // расколотое ядро в груди: тёмная расщелина, свет изнутри, трещины лучами
  const KX = ux - 4, KY = -104 + uy;
  for (let k = 0; k < 7; k++) { const a = k / 7 * FPX_T + 0.4, L = 18 + X.hsh(k) * 16; X.limb(KX + Math.cos(a) * 8, KY + Math.sin(a) * 8, KX + Math.cos(a + 0.2) * L, KY + Math.sin(a + 0.2) * L, 1.6, 0.6, GL, { f: (t, x, y) => X.dth(x, y) < 0.6 - t * 0.4 + Q.cast * 0.3 ? GL[2] : GL[1] }); }
  X.R(KX - 12, KY - 14, KX + 12, KY + 14, (x, y) => {
    const d = Math.hypot((x - KX) / 10, (y - KY) / 12), j = X.hsh(Math.round(Math.atan2(y - KY, x - KX) * 5) + 3) * 0.25;
    if (d > 0.95 + j) return null;
    if (d > 0.75 + j) return ST[0];
    return d < 0.3 + Q.cast * 0.15 ? GL[3] : d < 0.55 ? GL[2] : X.dth(x, y) < 0.5 ? GL[1] : GL[0];
  });
  const head = () => {
  // голова утоплена ниже плеч, выдвинута вперёд: тяжёлый лоб, рога-кристаллы, глаза-угли, клыкастая пасть с отсветом
  const hx = ux + 12, hy = -166 + uy + (Q.st === 'strike' ? 8 : 0) + (Q.hurt ? -3 : 0);
  X.ell(hx - 2, hy + 8, 24, 18, [ST[0]]);                                                    // тень-провал вокруг головы
  fpxStone(X, hx, hy + 4, 20, 17, ST, 13, 0.12);
  for (const [dx, a, L] of [[-12, -2.2, 22], [2, -1.6, 20], [12, -0.9, 26]]) { const bx = hx + dx, by = hy - 8, nx = -Math.sin(a), ny = Math.cos(a); X.poly([[bx + nx * 4, by + ny * 4], [bx + Math.cos(a) * L, by + Math.sin(a) * L], [bx - nx * 4, by - ny * 4]], CR, (x, y) => ((x - bx) * nx + (y - by) * ny) > 0 ? 0.95 : 0.45); }
  X.poly([[hx - 18, hy - 6], [hx + 20, hy - 9], [hx + 22, hy - 2], [hx + 12, hy + 1], [hx + 3, hy - 2], [hx - 6, hy + 1], [hx - 17, hy - 1]], ST, (x, y) => y < hy - 5 ? 0.95 : 0.6);   // лоб
  for (const s of [-1, 1]) {
    const ex = hx + 4 + s * 7.5, ey = hy + 3;
    X.poly([[ex - 5, ey - 2.5 - s * 1.6], [ex + 5, ey - 2.5 + s * 1.6], [ex + 4, ey + 2.5], [ex - 4, ey + 2.5]], [FPX_PAL.ink], () => 0);
    if (!Q.blink) X.eye(ex, ey, 2.6, GL, hot);
  }
  const op = 3 + Q.open * 6, MY = hy + 10;
  X.R(hx - 12, MY - 2, hx + 18, MY + 8 + op, (x, y) => {
    const ax = (x - hx - 3) / 14; if (Math.abs(ax) > 1) return null;
    const top = MY - ax * ax * 2, bot = MY + op * (1 - ax * ax * 0.6);
    const gx = Math.round(x * X.S), fu = (gx % 7 + 7) % 7, fang = fu < 3 ? (3 - Math.abs(fu - 1.5)) * 1.4 : 0;
    if (y >= top && y < top + fang * 1.3) return ST[4];
    if (y <= bot && y > bot - fang) return ST[3];
    if (y < top || y > bot) return null;
    return X.dth(x, y) < 0.35 ? GL[2] : GL[0];
  });
  };
  for (const [cx, cy, a, L] of [[-56, -166, -2.4, 24], [-44, -172, -1.9, 36], [-30, -168, -1.5, 22], [40, -170, -1.4, 22], [52, -168, -1.0, 34], [64, -156, -0.5, 20]]) {   // кристаллы на плечах
    const bx = cx + ux, by = cy + uy, nx = -Math.sin(a), ny = Math.cos(a);
    X.poly([[bx + nx * 5, by + ny * 5], [bx + Math.cos(a) * L, by + Math.sin(a) * L], [bx - nx * 5, by - ny * 5]], CR, (x, y) => ((x - bx) * nx + (y - by) * ny) > 0 ? 0.92 : 0.42);
  }
  if (Q.smear) X.smear(44 + ux, -136 + uy, 66, 92, -1.4, 1.0, [GL[1], GL[3]]);
  const [fx2, fy2] = arm(1, Q.st === 'strike' ? 0.3 : Q.st === 'windup' ? -2.4 : Q.st === 'hurt' ? 2.0 : cst ? -1.45 : 1.45 - Q.sw * 0.25, 0.02);
  head();
  if (cst) X.R(fx2 - 40, fy2 - 40, fx2 + 40, fy2 + 40, (x, y) => { const d = Math.hypot(x - fx2, y - fy2); return d < 38 && d > 20 && X.dth(x, y) < 0.5 * (1 - d / 38) * Q.cast * 1.4 ? [...GL[2], 0.6] : null; }, false);
  X.motes(8, -50, 60, -150, 140, Q.t, [ST[3], ST[2]], 1, 21);                               // осыпается каменная крошка
  X.B.outline([12, 8, 22]);
}

const FPX_DRAW = {
  fThrall: fpxDrawWar('fThrall'), fKnight: fpxDrawWar('fKnight'), fRaven: fpxRaven, fMalgor1: fpxMalgor(1), fMalgor3: fpxMalgor(3), fBone: fpxBone, fRock: fpxRock,
  fG_fire: fpxDrawWar('fG_fire'), fG_ice: fpxDrawWar('fG_ice'), fG_bone: fpxDrawWar('fG_bone'), fG_shadow: fpxDrawWar('fG_shadow'), fG_golem: fpxGolem,
};

// кадр: { cv, ax, ay, w, h } или null (нет набора — рисует векторный кадр foeart.js); кэш с вытеснением старых
const FPX_CACHE = new Map();
let FPX_FAIL = false;
function foePxFrame(kind, fr) {
  const make = FPX_DRAW[kind];
  if (!make || FPX_FAIL || typeof fzPxKit !== 'function') return null;
  const key = kind + '|' + fr;
  let s = FPX_CACHE.get(key);
  if (s) { FPX_CACHE.delete(key); FPX_CACHE.set(key, s); return s; }
  const b = FPX_BOX[kind];
  try {
    const X = fpxKit(b);
    make(X, fpxPose(fr));
    s = { cv: X.B.done(), ax: b[2], ay: b[3], w: b[0], h: b[1] };
  } catch (e) { FPX_FAIL = true; if (typeof console !== 'undefined') console.warn('foepx', kind, fr, e); return null; }
  FPX_CACHE.set(key, s);
  if (FPX_CACHE.size > 180) FPX_CACHE.delete(FPX_CACHE.keys().next().value);
  return s;
}
