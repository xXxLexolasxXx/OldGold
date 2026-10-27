'use strict';
// Звери ручным пиксель-артом ×3, тем же методом, что Полудница и нечисть фей (fzPxKit в fairy2.js), но не страшные:
// сетка втрое мельче мировой, формы — функциями, объём по рампам тонов (свет слева сверху), мех — штрихи и крапины,
// верхний край шерсти светлее, переходы — дизеринг Байера, крупная голова и глаза с бликом, обводка цветом самого зверя.
// Кадр — canvas с пометкой fine = 3 (рисуется через afBlit/blitFine в игровом размере). Только при PX_FINE > 1.

const AK_TAU = Math.PI * 2;
const AK_LIGHT = (() => { const v = [-0.5, -0.72, 0.48], l = Math.hypot(...v); return v.map(a => a / l); })();

// Рампа тонов от тени к свету: тени холоднее (в лиловое), свет теплее (в золото) — как у художника
function akRamp(hex, n = 7, spread = 0.62) {
  const [r, g, b] = hexToRgb(hex), out = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) * 2 - 1, k = t < 0 ? 1 + t * spread : 1 + t * spread * 0.55;
    let R = r * k, G = g * k, B = b * k;
    if (t < 0) { R += t * 10; G += t * 6; B -= t * 14; }                        // тень: синее
    else { R += t * (255 - r) * 0.28 + t * 10; G += t * (255 - g) * 0.24 + t * 4; B += t * (255 - b) * 0.12 - t * 6; }   // свет: теплее
    out.push([R, G, B].map(v => Math.max(0, Math.min(255, Math.round(v)))));
  }
  return out;
}

// Набор зверя: холст w×h игровых пикселей (×3 мельче), начало координат — (ox, oy) в игровых; рисуем в мелких пикселях,
// y вверх отрицательный. Поверх fzPxKit: объёмные эллипсоиды, ноги-цилиндры, мех, глаз, обводка.
function akKit(w, h, ox, oy) {
  const K = fzPxKit(w * 3, h * 3, Math.round(ox * 3), Math.round(oy * 3)), { P, R, dth, hsh } = K;
  // тон рампы по освещённости v (0..1) с дизерингом между ступенями
  K.tone = (ramp, v, x, y) => { const f = Math.max(0, Math.min(0.999, v)) * (ramp.length - 1), i = Math.floor(f), q = (f - i - 0.5) * 2.6 + 0.5; return ramp[Math.min(ramp.length - 1, i + (q > dth(x, y) ? 1 : 0))]; };   // дизеринг — только узкой полосой на стыке тонов
  // освещённость точки эллипсоида (cx, cy, rx, ry, наклон rot) с полутенью; null — вне
  K.lit = (x, y, e) => {
    const [cx, cy, rx, ry, rot = 0] = e, dx = x + 0.5 - cx, dy = y + 0.5 - cy, c = Math.cos(rot), s = Math.sin(rot);
    const u = (dx * c + dy * s) / rx, v = (-dx * s + dy * c) / ry, d = u * u + v * v;
    if (d > 1) return null;
    const nz = Math.sqrt(1 - d), nx = u * c - v * s, ny = u * s + v * c;
    return { l: Math.max(0, nx * AK_LIGHT[0] + ny * AK_LIGHT[1] + nz * AK_LIGHT[2]), nz };
  };
  // тело из нескольких эллипсоидов: в каждой точке берётся самый «выпуклый» (больший nz). o: fur — сила меха, rim — светлый верх,
  // belly — тёмное брюхо ниже yb, mark(x, y, v) → свой цвет (пятна, полосы) или null
  // Объём «подушкой»: сначала силуэт (объединение эллипсов или своя проверка o.inside), потом высота по расстоянию до края
  // (круглый профиль радиуса o.round), из неё нормаль и свет. Так тело читается одним целым, без пятен на стыках частей.
  // o: fur — сила меха (вытянутые штрихи вниз-назад), rim — светлый верхний край, shade — сдвиг света по высоте (верх светлее),
  // zone(x, y) → [рампа, вес 0..1] — светлая грудь, тёмный чепрак: смешиваются с основой дизерингом
  K.blob = (parts, ramp, o = {}) => {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [cx, cy, rx, ry] of parts) { const r = Math.max(rx, ry); x0 = Math.min(x0, cx - r); x1 = Math.max(x1, cx + r); y0 = Math.min(y0, cy - r); y1 = Math.max(y1, cy + r); }
    x0 = Math.floor(x0) - 2; y0 = Math.floor(y0) - 2; x1 = Math.ceil(x1) + 2; y1 = Math.ceil(y1) + 2;
    const inside = o.inside || ((x, y) => parts.some(([cx, cy, rx, ry, rot = 0]) => { const dx = x + 0.5 - cx, dy = y + 0.5 - cy, c = Math.cos(rot), s = Math.sin(rot), u = (dx * c + dy * s) / rx, v = (-dx * s + dy * c) / ry; return u * u + v * v <= 1; }));
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, D = new Float32Array(bw * bh), BIG = 1e4;
    for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) D[j * bw + i] = inside(x0 + i, y0 + j) ? BIG : 0;
    for (let j = 1; j < bh; j++) for (let i = 1; i < bw - 1; i++) { const k = j * bw + i; if (D[k]) D[k] = Math.min(D[k], D[k - 1] + 1, D[k - bw] + 1, D[k - bw - 1] + 1.414, D[k - bw + 1] + 1.414); }
    for (let j = bh - 2; j >= 0; j--) for (let i = bw - 2; i > 0; i--) { const k = j * bw + i; if (D[k]) D[k] = Math.min(D[k], D[k + 1] + 1, D[k + bw] + 1, D[k + bw + 1] + 1.414, D[k + bw - 1] + 1.414); }
    const Rm = o.round || 7, Hf = k => { const d = Math.min(D[k], Rm) / Rm; return Math.sqrt(Math.max(0, 1 - (1 - d) * (1 - d))) * Rm; };
    const span = Math.max(1, y1 - y0);
    R(x0, y0, x1, y1, (x, y) => {
      const i = x - x0, j = y - y0, k = j * bw + i;
      if (!D[k]) return null;
      const gx = (Hf(k + 1) - Hf(k - 1)) / 2, gy = (Hf(k + bw) - Hf(k - bw)) / 2, nl = Math.hypot(gx, gy, 1);
      const l = Math.max(0, (-gx * AK_LIGHT[0] - gy * AK_LIGHT[1] + AK_LIGHT[2]) / nl);
      let v = 0.08 + l * 0.82 + (o.bias || 0) + (o.shade ?? 0.18) * (0.5 - j / span);
      if (o.fur) { const st = hsh(Math.floor((x * 0.7 + y) / 2) * 7.31 + Math.floor((x - y * 0.4) / 4) * 13.7 + (o.seed || 0)); if (st > 0.8) v -= o.fur * 0.2; else if (st < 0.08) v += o.fur * 0.1; }
      if (o.rim !== false && D[k] < 1.6 && !D[k - bw]) v = Math.max(v, 0.9);
      let rp = ramp;
      if (o.zone) { const z = o.zone(x, y, v); if (z && z[1] > (z[4] ? dth(x, y) : 0.5)) { rp = z[0]; if (z[2] != null) v = Math.max(v + z[2], z[3] ?? 0.5); } }
      const m = o.mark && o.mark(x, y, v);
      if (m) return m;
      return K.tone(rp, v, x, y);
    });
    return (x, y) => x >= x0 && y >= y0 && x <= x1 && y <= y1 && D[(y - y0) * bw + (x - x0)] > 0;
  };
  // нога/шея — цилиндр с сужением, затенённый поперёк (светлее слева)
  K.limb = (x0, y0, x1, y1, r0, r1, ramp, o = {}) => {
    const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1, l = Math.sqrt(l2), rm = Math.max(r0, r1) + 1, sg = Math.sign(dy || 1);
    R(Math.min(x0, x1) - rm, Math.min(y0, y1) - rm, Math.max(x0, x1) + rm, Math.max(y0, y1) + rm, (x, y) => {
      const px = x + 0.5, py = y + 0.5, t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / l2)), ex = px - x0 - dx * t, ey = py - y0 - dy * t, r = r0 + (r1 - r0) * t, d = Math.hypot(ex, ey);
      if (d > r) return null;
      if (o.tip && t > 1 - o.tip) return o.tipCol;
      const side = (ex * dy - ey * dx) / l / (r || 1);
      let v = 0.55 - side * 0.38 * sg + (o.bias || 0);
      if (d > r - 1) v -= 0.18;
      return K.tone(ramp, v, x, y);
    });
  };
  // глаз: радужка, крупный зрачок чуть вперёд, блик сверху слева — делает зверя живым и милым
  K.eye = (x, y, r, iris = [40, 28, 24], dark = [16, 12, 14], shine = [255, 252, 240]) => {
    R(x - r - 1, y - r - 1, x + r + 1, y + r + 1, (px, py) => {
      const d = Math.hypot(px + 0.5 - x, py + 0.5 - y);
      if (d > r) return null;
      return Math.hypot(px + 0.5 - x - r * 0.18, py + 0.5 - y - r * 0.08) < r * 0.62 || r < 1.4 ? dark : iris;
    });
    P(Math.round(x - r * 0.5), Math.round(y - r * 0.55), shine);
    if (r >= 2.2) P(Math.round(x - r * 0.5) + 1, Math.round(y - r * 0.55), shine);
  };
  // закрытый глаз — дужка
  K.blink = (x, y, r, col) => { for (let k = -r; k <= r; k++) P(x + k, y + (Math.abs(k) >= r ? -1 : 0), col); };
  K.fin = (outline) => { K.outline(outline, 0.95); const cv = K.done(); cv.fine = 3; return cv; };
  return K;
}
// фаза шага кадра f из N → угол
const akT = (f, N) => f == null ? 0 : f / N * AK_TAU;

// ---------- Звери creatures.js: тот же размер кадра (CR_SIZE) и точка лап; f — кадр шага из crFrames или null ----------
const AK_CR = {};

// Наложить на кадр груз/поклажу из векторного drawLoad, сведённый в тот же мелкий пиксель
function akOverlay(cv, w, h, ax, oy, draw) {
  const ov = afVec(w, h, ax, oy, draw, { outlineDark: 0.5 });
  cv.getContext('2d').drawImage(ov, 0, 0);
  return cv;
}

const akCl = v => Math.max(0, Math.min(1, v));

// Лапа зверя: бедро (x, top) → колено → ступня по фазе шага; far — дальняя (темнее). o.hind — скакательный сустав назад
function akLeg(K, x, top, ph, far, ramp, paw, o = {}) {
  const st = o.step ?? 6, sw = ph == null ? 0 : Math.sin(ph) * st, lift = ph == null ? 0 : Math.max(0, Math.cos(ph)) * (o.lift ?? 3.5);
  const fx = x + sw, fy = -lift, b = (far ? -0.2 : 0) + (o.bias || 0), r0 = o.r0 ?? 3.2, r1 = o.r1 ?? 2, r2 = o.r2 ?? 1.6;
  const kx = x + sw * 0.5 + (o.hind ? -2.5 : 1), ky = top + (fy - top) * 0.5;
  K.limb(x, top, kx, ky, r0, r1, ramp, { bias: b });
  K.limb(kx, ky, fx + (o.hind ? 0.5 : 0), fy - 1.2, r1, r2, o.sock || ramp, { bias: b });
  if (paw) K.R(fx - 3, fy - 3, fx + 4, fy + 1, (x, y) => ((x + 0.5 - fx - 0.6) / (o.pw ?? 2.6)) ** 2 + ((y + 0.5 - fy + 0.8) / 1.4) ** 2 <= 1 ? K.tone(paw, far ? 0.15 : 0.5, x, y) : null);
}

// пушистый хвост дугой: точки [x, y, r] — каждая станет кружком меха; кончик (последние tipN) другой рампой
function akTail(K, pts, ramp, tip, o = {}) {
  const parts = [];
  for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < 3; k++) { const u = k / 3, a = pts[i], b = pts[i + 1]; parts.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[2] + (b[2] - a[2]) * u]); }
  const e = pts[pts.length - 1]; parts.push([e[0], e[1], e[2], e[2]]);
  const end = pts[pts.length - 1], tl = o.tipLen ?? 4;
  K.blob(parts, ramp, { fur: o.fur ?? 0.9, seed: o.seed || 5, round: o.round ?? 3, zone: tip ? (x, y) => [tip, akCl((tl - Math.hypot(x + 0.5 - end[0], y + 0.5 - end[1])) / 1.2), 0.1] : null });
}

// Псовые сбоку (волк, лиса): o — палитры (G основа, D чепрак, C светлое, PAW лапы, EAR внутри уха), размер s, носочки, хвост
function akCanine(K, f, o) {
  const s = o.s || 1, t = akT(f, 8), ph = k => f == null ? null : t + k, bob = f == null ? 0 : Math.round(Math.sin(t * 2) * 0.8);
  const { G, D, C, PAW } = o, X = v => v * s, Y = v => v * s + bob + (o.low || 0), top = Y(-27);
  const legO = { r0: 3.2 * s, r1: 2 * s, r2: 1.6 * s, step: 6 * s, pw: 2.6 * s, sock: o.sock };
  const legR = () => G;
  akLeg(K, X(14), top, ph(0), true, legR(true), PAW, legO); akLeg(K, X(-15), top, ph(Math.PI), true, legR(true), PAW, { ...legO, hind: true });
  akTail(K, o.tail.map(([x, y, r]) => [X(x), Y(y), r * s]), o.TG || G, o.TC || C, { seed: 3, tipLen: (o.tipLen || 4) * s });
  K.blob([[X(-2), Y(-31), 17 * s, 7.6 * s], [X(11), Y(-31), 9 * s, 9 * s], [X(-15), Y(-32), 8.5 * s, 7.8 * s]], G, { fur: 1, round: 7 * s, zone: (x, y) => {
    const under = akCl((y - Y(-25.5)) / 0.8) * akCl((x - X(-12)) / 2), chest = akCl((x - X(15)) / 1.2) * akCl((y - Y(-36)) / 1.2);
    if (Math.max(under, chest) > 0) return [C, Math.max(under, chest), 0.08];
    return D ? [D, akCl((Y(-36) + Math.sin(x * 0.3) - y) / 1.4) * akCl((X(12) - x) / 3) * akCl((x - X(-20)) / 3)] : null;
  } });
  K.blob([[X(17), Y(-38), 6.5 * s, 7 * s, -0.6], [X(22), Y(-43), 6 * s, 6 * s]], G, { fur: 0.8, seed: 9, round: 5 * s, zone: (x, y) => [C, akCl((x - X(21)) / 1.2) * akCl((y - Y(-38)) / 1.2), 0.1] });
  const hx = X(27), hy = Y(-47);
  K.blob([[hx, hy, 6.8 * s, 5.8 * s], [hx + 8 * s, hy + 3 * s, 6 * s, (o.snout || 2.9) * s, 0.2]], G, { fur: 0.4, seed: 7, round: 4 * s, zone: (x, y) => [C, akCl((y - hy - (o.cheek ?? 2.6) * s) / 1) * akCl((x - hx + 4) / 1.2), 0.15, 0.55] });
  for (const [ex, dk] of [[hx - 3 * s, true], [hx + 1.5 * s, false]]) K.R(ex - 6, hy - 18 * s, ex + 6, hy - 3, (x, y) => {   // уши торчком
    const q = (hy - 3.5 * s - y) / ((dk ? 8.5 : 10) * s * (o.ear || 1)); if (q < 0 || q > 1) return null; const hw = 3.6 * s * (1 - q), d = x + 0.5 - ex - q * 1.2;
    if (Math.abs(d) > hw) return null;
    if (o.earTip && q > 0.74) return K.tone(o.earTip, 0.4, x, y);
    if (!dk && q < 0.7 && Math.abs(d) < hw - 1.3) return q < 0.3 ? o.EAR[1] : o.EAR[0];
    return K.tone(G, (dk ? 0.3 : 0.75) - d * 0.06, x, y);
  });
  K.R(hx + 11 * s, hy, hx + 16 * s, hy + 5, (x, y) => Math.hypot(x + 0.5 - hx - 13.6 * s, y + 0.5 - hy - 2 * s) < 1.8 ? (x < hx + 13 * s && y < hy + 2 * s ? [110, 104, 110] : [30, 26, 30]) : null);   // нос
  for (let x = Math.round(hx + 6 * s); x <= hx + 12 * s; x++) K.P(x, Math.round(hy + 4.6 * s) - (x > hx + 10 * s ? 1 : 0), o.MOUTH || [96, 84, 80]);
  K.eye(hx + 2.5 * s, hy - 1 * s, 2.3, o.IRIS, [36, 24, 16]);
  for (let x = Math.round(hx); x <= hx + 5; x++) K.P(x, Math.round(hy - 4 * s) + (x < hx + 2 ? 1 : 0), (D || G)[1]);   // бровь
  akLeg(K, X(18), top, ph(Math.PI * 0.5), false, legR(false), PAW, legO); akLeg(K, X(-11), top, ph(Math.PI * 1.5), false, legR(false), PAW, { ...legO, hind: true });
}

// Волк: серый, тёмный чепрак по спине, светлые щёки и грудь, янтарные глаза; бежит, утащенное несёт в зубах
AK_CR.wolf = (f, load) => {
  const K = akKit(32, 24, 16, 21);
  akCanine(K, f, { G: akRamp('#7d7772', 7), D: akRamp('#56504c', 6), C: akRamp('#d8d0c4', 5), PAW: akRamp('#45403e', 4), EAR: [[98, 72, 78], [124, 96, 100]], IRIS: [214, 150, 40],
    tail: [[-21, -36, 3.6], [-28, -33, 4.2], [-33, -27, 3.8], [-35, -22, 2.6]] });
  const cv = K.fin([44, 38, 44]);
  return load ? akOverlay(cv, 32, 24, 16, 0, c => { c.save(); c.translate(15.6, 6.6); c.scale(0.45, 0.45); drawLoad(c, load); c.restore(); }) : cv;
};
// Лиса: рыжая, мельче волка, чёрные «носочки» и кончики ушей, белые грудка и кончик пышного хвоста
AK_CR.fox = (f, load) => {
  const K = akKit(28, 20, 14, 17);
  akCanine(K, f, { s: 0.78, G: akRamp('#d8782a', 7, 0.55), D: null, C: akRamp('#f2ece0', 5), PAW: akRamp('#2e2018', 4), sock: akRamp('#3a2a20', 5), EAR: [[70, 40, 30], [96, 60, 44]], earTip: akRamp('#2a1c14', 3),
    IRIS: [206, 128, 40], snout: 2.5, ear: 1.35, low: 4, cheek: 1, TG: akRamp('#d8782a', 7, 0.55), tipLen: 5,
    tail: [[-20, -35, 4], [-28, -33, 5.6], [-36, -29, 5.6], [-42, -25, 4.2]] });
  const cv = K.fin([66, 30, 18]);
  return load ? akOverlay(cv, 28, 20, 14, 0, c => { c.save(); c.translate(10.6, 6.4); c.scale(0.4, 0.4); drawLoad(c, load); c.restore(); }) : cv;
};

// Копытные сбоку (олень, лось, коза): координаты в игровых пикселях от точки копыт (×3 внутри). o: body [cx, cy, rx, ry],
// hump — горб на холке, neck — [x0, y0, x1, y1, r0, r1], head [cx, cy, rx, ry], muzzle [cx, cy, rx, ry, rot], legTop, legs [задние x, передние x],
// G/C/D/HOOF — рампы, horns(K, g) — рога/рога-лопаты поверх, extra(K, g) — пятна, борода, поклажа
function akHoof(K, f, o) {
  const g = v => v * 3, t = akT(f, 8), ph = k => f == null ? null : t + k, bob = f == null ? 0 : Math.round(Math.sin(t * 2) * 1);
  const { G, C, HOOF } = o, LG = o.LEG || G, B = o.body, top = g(o.legTop) + bob;
  const lo = { r0: (o.thigh || 1.25) * 3, r1: (o.shin || 0.62) * 3, r2: (o.shin || 0.62) * 2.6, step: g(o.step || 2.4), lift: g(1.2), pw: 2.2, sock: o.SOCK };
  const hoof = (x, ph0, far) => { akLeg(K, g(x), top, ph(ph0), far, LG, null, lo); const sw = ph(ph0) == null ? 0 : Math.sin(ph(ph0)) * lo.step, lift = ph(ph0) == null ? 0 : Math.max(0, Math.cos(ph(ph0))) * lo.lift; K.R(g(x) + sw - 3, -lift - 3, g(x) + sw + 3, -lift, (px, py) => Math.abs(px + 0.5 - g(x) - sw) < 1.9 && py >= -lift - 2.5 ? K.tone(HOOF, far ? 0.2 : 0.55, px, py) : null); };
  hoof(o.legs[1], 0, true); hoof(o.legs[0], Math.PI, true);
  if (o.tail) K.blob([[g(o.tail[0]), g(o.tail[1]) + bob, g(o.tail[2]), g(o.tail[3]), o.tail[4] || 0]], o.TAIL || G, { round: 2, fur: 0.3 });
  const parts = [[g(B[0]), g(B[1]) + bob, g(B[2]), g(B[3])]];
  if (o.hump) parts.push([g(o.hump[0]), g(o.hump[1]) + bob, g(o.hump[2]), g(o.hump[3])]);
  if (o.rump) parts.push([g(o.rump[0]), g(o.rump[1]) + bob, g(o.rump[2]), g(o.rump[3])]);
  const by = g(B[1] + B[3]) + bob;
  K.blob(parts, G, { fur: o.fur ?? 0.8, round: g(B[3]) * 0.75, zone: (x, y) => o.zone ? o.zone(x, y - bob, g) : [C, akCl((y - by + g(o.belly ?? 1.4)) / 0.8), 0.12, 0.55] });
  if (o.under) o.under(K, g, bob);
  const N = o.neck;
  K.limb(g(N[0]), g(N[1]) + bob, g(N[2]), g(N[3]) + bob, g(N[4]), g(N[5]), G, { bias: 0.08 });
  const H = o.head, M = o.muzzle;
  K.blob([[g(H[0]), g(H[1]) + bob, g(H[2]), g(H[3]), H[4] || 0], [g(M[0]), g(M[1]) + bob, g(M[2]), g(M[3]), M[4] || 0]], o.HEAD || G, { fur: 0.3, round: 4, zone: o.headZone ? (x, y) => o.headZone(x, y - bob, g) : null });
  if (o.ears) for (const [ex, ey, len, ang, dk] of o.ears) {                                                // уши листиком
    const ax = g(ex), ay = g(ey) + bob, ca = Math.cos(ang), sa = Math.sin(ang);
    K.R(ax - 10, ay - 10, ax + 10, ay + 10, (x, y) => { const dx = x + 0.5 - ax, dy = y + 0.5 - ay, u = dx * ca + dy * sa, v = -dx * sa + dy * ca, L = g(len); if (u < 0 || u > L) return null; const w = Math.sin(u / L * Math.PI) * 2.2; return Math.abs(v) <= w ? (Math.abs(v) < w - 1.1 && !dk && u > 1.5 ? o.EAR : K.tone(G, dk ? 0.3 : 0.62, x, y)) : null; });
  }
  if (o.horns) o.horns(K, g, bob);
  K.eye(g(o.eye[0]), g(o.eye[1]) + bob, o.eye[2] || 2, o.IRIS || [60, 36, 24], [20, 14, 12]);
  if (o.nose) K.R(g(o.nose[0]) - 3, g(o.nose[1]) + bob - 3, g(o.nose[0]) + 3, g(o.nose[1]) + bob + 3, (x, y) => Math.hypot(x + 0.5 - g(o.nose[0]), (y + 0.5 - g(o.nose[1]) - bob) * 1.2) < (o.nose[2] || 1.5) ? o.NOSE || [34, 24, 22] : null);
  if (o.extra) o.extra(K, g, bob);
  hoof(o.legs[1] + (o.legGap || 1.4), Math.PI * 0.5, false); hoof(o.legs[0] + (o.legGap || 1.4), Math.PI * 1.5, false);
  if (o.front) o.front(K, g, bob);
}

// рог-веточка: от основания (x, y) по точкам, толщина r → r*0.5; ramp светлая кость
function akAntler(K, pts, r, ramp) { for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; K.limb(a[0], a[1], b[0], b[1], r * (1 - (i - 1) / pts.length * 0.5), r * (1 - i / pts.length * 0.5), ramp, { bias: 0.15 }); } }

// Олень: тёплый бурый с белыми пятнами, светлое брюхо и «зеркальце», ветвистые рога
AK_CR.deer = f => {
  const K = akKit(34, 37, 17, 34), BONE = akRamp('#d8c8a8', 5);
  akHoof(K, f, { G: akRamp('#9a6a3c', 7), C: akRamp('#ecdcc4', 5), HOOF: akRamp('#2a1c14', 4), EAR: [196, 140, 120], IRIS: [70, 40, 22],
    body: [0, -14, 9.2, 4.6], rump: [-6, -14.5, 4.6, 4.4], hump: [5.5, -15.2, 4.6, 4.4], legTop: -11.5, legs: [-6, 5], legGap: 1.6,
    neck: [6.8, -16.5, 10.6, -24, 2.4, 1.7], head: [11.6, -24.6, 2.8, 2.1, 0.35], muzzle: [14, -23.2, 1.7, 1.1, 0.5], nose: [15.3, -22.8, 0.9],
    eye: [11.8, -25.2, 2], ears: [[10.4, -26.4, 3, -2.3, true], [11.2, -26.6, 3.4, -1.9, false]], tail: [-9.6, -15.6, 1.4, 1.8, 0.4], TAIL: akRamp('#f2eadc', 4),
    extra: (K, g, bob) => { for (let k = 0; k < 7; k++) { const x = g(-6 + k * 1.9), y = g(-16.6 + (k % 2) * 1.2) + bob; K.R(x - 1, y - 1, x + 1, y + 1, (px, py) => Math.hypot(px + 0.5 - x, py + 0.5 - y) < 1.2 ? [244, 234, 214] : null); } },
    horns: (K, g, bob) => {
      const y0 = g(-26.8) + bob;
      akAntler(K, [[g(10.6), y0], [g(9.6), y0 - 6], [g(8.4), y0 - 12], [g(9.2), y0 - 17]], 1.2, BONE); akAntler(K, [[g(9.7), y0 - 5], [g(7.2), y0 - 7]], 0.8, BONE); akAntler(K, [[g(8.6), y0 - 11], [g(6.6), y0 - 13.5]], 0.7, BONE);
      akAntler(K, [[g(11.8), y0], [g(12.8), y0 - 6], [g(13.6), y0 - 12], [g(12.8), y0 - 16]], 1.2, BONE); akAntler(K, [[g(12.7), y0 - 5.5], [g(15), y0 - 7.5]], 0.8, BONE); akAntler(K, [[g(13.5), y0 - 11], [g(15.6), y0 - 13]], 0.7, BONE);
    } });
  return K.fin([50, 30, 20]);
};

// Лось: тёмно-бурый, горб на холке, длинные светлые ноги, нависающая морда, «серьга» и рога-лопаты
AK_CR.elk = (f, load) => {
  const K = akKit(46, 46, 23, 42), HORN = akRamp('#a88c62', 6, 0.5), G = akRamp('#5e3e24', 7, 0.5);
  akHoof(K, f, { G, C: akRamp('#4a3020', 5), HOOF: akRamp('#2a1c14', 4), LEG: akRamp('#b0a088', 6), EAR: [120, 84, 60], IRIS: [60, 34, 20],
    body: [0, -17, 11, 5.4], hump: [5.6, -20.6, 6, 4.8], rump: [-7, -17.4, 5, 5], legTop: -13.5, legs: [-7, 6.4], legGap: 1.8, thigh: 1.6, shin: 0.75, step: 2.8, belly: 1.8,
    neck: [9, -21, 14.6, -24.6, 3.2, 2.4], head: [17.2, -23.6, 3.6, 2.4, 0.25], muzzle: [20.4, -20.8, 2.2, 1.9, 0.9], nose: [21.4, -19.6, 0.9],
    eye: [17, -24.6, 2], ears: [[14.6, -25.4, 2.8, -2.4, true], [15.2, -25.6, 3, -2.0, false]], tail: [-11, -18.6, 1.2, 1.6, -0.5],
    extra: (K, g, bob) => { K.limb(g(16.2), g(-21.4) + bob, g(16), g(-19.2) + bob, 1.8, 1.1, G, { bias: -0.15 }); },                // «серьга» под горлом
    horns: (K, g, bob) => {
      for (const [dx, fl, b] of [[-0.4, 1, -0.12], [1.8, -1, 0.12]]) {
        const bx = g(15.4 + dx), by = g(-26) + bob;
        K.limb(bx, by, bx - fl * 6, by - 5, 1.7, 1.4, HORN, { bias: b });
        const pal = [[0, 0], [-1.2, -3.6], [-5, -5], [-3.2, -6.4], [-6.8, -8.6], [-3, -9], [-4, -11.6], [0, -9.4], [3, -11.2], [2.6, -7.6], [6, -7.4], [3.6, -4.6], [5, -2.2], [1.2, -2.8]].map(([x, y]) => [bx + fl * x * 2.3 - fl * 7, by + y * 2.1 - 5]);
        K.R(bx - 30, by - 50, bx + 30, by + 2, (x, y) => {
          let ins = false; for (let i = 0, j = pal.length - 1; i < pal.length; j = i++) { const [xi, yi] = pal[i], [xj, yj] = pal[j]; if ((yi > y + 0.5) !== (yj > y + 0.5) && x + 0.5 < (xj - xi) * (y + 0.5 - yi) / (yj - yi) + xi) ins = !ins; }
          return ins ? HORN[Math.max(0, Math.min(5, Math.round(3 + b * 8 + (by - y) * 0.06 + (K.hsh(x * 3.1 + y * 7.7) > 0.85 ? -1 : 0))))] : null;
        });
      }
    } });
  const cv = K.fin([42, 26, 16]);
  return load ? akOverlay(cv, 46, 46, 23, 13, c => { c.save(); c.translate(20, 12); c.scale(0.45, 0.45); drawLoad(c, load); c.restore(); }) : cv;
};

// Коза: светлая, рожки назад, бородка, короткий хвостик; вьючная — с сумками и грузом поверх
function akGoat(f, pack, load) {
  const K = akKit(28, pack ? 28 : 26, 14, pack ? 25 : 23), col = pack ? '#e4ddd0' : '#d8d0c0', HORN = akRamp('#8a7a60', 5), G = akRamp(col, 7, 0.5);
  akHoof(K, f, { G, C: akRamp('#f6f2ea', 4), HOOF: akRamp('#3a3028', 4), EAR: [210, 170, 160], IRIS: [176, 140, 50], LEG: akRamp(col, 6, 0.55),
    body: [0, -9, 8, 4.2], rump: [-4.4, -9.4, 4, 3.8], hump: [4, -10, 4, 4], legTop: -6.6, legs: [-5, 4], legGap: 1.4, thigh: 1.15, shin: 0.6, step: 2,
    neck: [5.4, -11, 9.2, -15, 2.2, 1.7], head: [10.4, -15.6, 2.6, 1.7, 0.3], muzzle: [12.4, -14.6, 1.3, 0.95, 0.4], nose: [13.4, -14.4, 0.6], NOSE: [90, 70, 64],
    eye: [10.6, -16.3, 1.8], ears: [[9, -16.6, 2.4, 3.4, true], [9.4, -16.4, 2.6, 3.0, false]], tail: [-8.2, -11.4, 1, 1.6, 0.6],
    horns: (K, g, bob) => { for (const [dx, b] of [[0, -0.15], [0.7, 0.1]]) { const x0 = g(9.8 + dx), y0 = g(-17) + bob; K.path([[x0, y0, 1.6], [x0 - 3, y0 - 6, 1.3], [x0 - 9, y0 - 8, 0.9], [x0 - 11.5, y0 - 5, 0.6]], (u, e) => K.tone(HORN, (e ? 0.25 : 0.6) + b + (Math.floor(u * 9) % 2 ? -0.1 : 0), x0, y0)); } },
    extra: (K, g, bob) => { K.limb(g(11.4), g(-13.6) + bob, g(11), g(-10.6) + bob, 1.4, 0.5, akRamp('#b4aa98', 4), {}); },        // бородка
    front: pack ? (K, g, bob) => {                                                                                       // вьючные сумки
      const S = akRamp('#8a5c32', 6);
      K.blob([[g(-0.6), g(-8.4) + bob, g(4), g(3.4)]], S, { round: 4, fur: 0, zone: (x, y) => [akRamp('#c89226', 3), Math.abs(x + 0.5 - g(-0.4)) < 1.5 && Math.abs(y - g(-8.6) - bob) < 1.5 ? 1 : 0, 0.2, 0.6] });
      K.L(g(-4), g(-11.6) + bob, g(3), g(-11.6) + bob, 1.2, 1.2, () => [90, 58, 30]);
    } : null });
  const cv = K.fin(pack ? [60, 50, 40] : [62, 54, 44]);
  return pack && load ? akOverlay(cv, 28, 28, 14, 1, c => { c.save(); c.translate(-0.6, 8.4); c.scale(0.7, 0.7); drawLoad(c, load); c.restore(); }) : cv;
}
AK_CR.goat = f => akGoat(f, false);
AK_CR.packgoat = (f, load) => akGoat(f, true, load);

// Ручной питомец (кролик, утка): бантик и посылка — тем же векторным petGear, сведённым в мелкий пиксель
const akGear = (cv, w, h, ax, ay, load, nx, ny, bx, by) => load && /T|c:/.test(load) ? akOverlay(cv, w, h, ax, ay, c => petGear(c, load, nx, ny, bx, by)) : cv;
// многоугольник одной рампой со светом сверху
function akPoly(K, pts, ramp, v0 = 0.6, dv = 0.02) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  K.R(x0 - 1, y0 - 1, x1 + 1, y1 + 1, (x, y) => {
    let ins = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y + 0.5) !== (yj > y + 0.5) && x + 0.5 < (xj - xi) * (y + 0.5 - yi) / (yj - yi) + xi) ins = !ins; }
    return ins ? K.tone(ramp, v0 - (y - y0) * dv, x, y) : null;
  });
}
const akG = pts => pts.map(([x, y]) => [x * 3, y * 3]);
// кольцо ряби на воде вокруг (0, cy): радиусы rx, ry в игровых, a — прозрачность
const akRipple = (K, cy, rx, ry, a, col = [235, 245, 255]) => K.R(-rx * 3 - 2, cy * 3 - ry * 3 - 2, rx * 3 + 2, cy * 3 + ry * 3 + 2, (x, y) => { const d = Math.hypot((x + 0.5) / (rx * 3), (y + 0.5 - cy * 3) / (ry * 3)); return Math.abs(d - 1) < 0.06 ? [...col, a] : null; }, false);

// Курица: белая, красный гребешок и бородка, семенит; клюёт — голова вниз
// тело курицы (без ног) со сдвигом вверх dy игровых px; peck — голова вниз, angry — сердитые брови
function akHenBody(K, g, dy, peck, angry) {
  const W = akRamp('#f2eee4', 6, 0.42), Wd = akRamp('#d4ccbc', 5), RED = akRamp('#d83a24', 4), G = v => g(v) - g(dy);
  akPoly(K, [[g(-2.4), G(-8.4)], [g(-6.2), G(-10.8)], [g(-6.6), G(-6.4)], [g(-3.6), G(-5)]], W, 0.7);                 // хвост
  for (let k = 0; k < 3; k++) K.limb(g(-4.6 + k * 0.5), G(-9.6 + k * 1.1), g(-6.2 + k * 0.3), G(-9.8 + k * 1.4), 0.7, 0.4, Wd);
  K.blob([[g(-0.4), G(-6), g(4.3), g(3.1)], [g(1.6), G(-7.2), g(2.4), g(2.4)]], W, { fur: 0.5, round: 6, zone: (x, y) => [Wd, akCl((y - G(-4.6)) / 1) * akCl((g(1.5) - x) / 2)] });
  K.limb(g(-2.6), G(-6.6), g(1), G(-5.6), 1.6, 1.2, Wd, { bias: 0.1 });                                              // крыло
  const hx = g(2.8) + (peck ? g(1.8) : 0), hy = G(-9.6) + (peck ? g(3.4) : 0);
  K.blob([[hx, hy, g(1.9), g(1.8)]], W, { round: 4, fur: 0.2 });
  for (let k = 0; k < 3; k++) K.R(hx - 6 + k * 2.4, hy - 9, hx - 1 + k * 2.4, hy - 4, (x, y) => Math.hypot(x + 0.5 - (hx - 2.6 + k * 2.2), y + 0.5 - (hy - 5.6 - (k === 1 ? 1 : 0))) < 1.5 ? K.tone(RED, 0.5, x, y) : null);   // гребешок
  K.blob([[hx + g(0.8), hy + g(1.5), 1.4, 2]], RED, { round: 1, rim: false });
  akPoly(K, [[hx + 4.2, hy - 1.6], [hx + 8.6, hy + 0.2], [hx + 4.2, hy + 1.8]], akRamp('#e8a028', 4), 0.7, 0.1);
  K.eye(hx + 1.6, hy - 1, 1.5, [60, 30, 20], [20, 14, 12]);
  if (angry) for (let k = 0; k < 4; k++) K.P(hx - 0.5 + k, hy - 3.6 + k * 0.5, [70, 30, 24]);                         // сердитая бровь
}

AK_CR.chicken = (f, load) => {
  const K = akKit(16, 15, 8, 13), g = v => v * 3, st = f == null ? 0 : Math.sin(akT(f, 6)), peck = load === 'peck';
  const LEG = akRamp('#e0a030', 4);
  for (const [x, s] of [[-1, st], [1, -st]]) { K.limb(g(x), g(-4), g(x + s * 1.2), g(-0.4), 1, 0.9, LEG); K.limb(g(x + s * 1.2 - 0.8), g(-0.2), g(x + s * 1.2 + 1), g(-0.2), 0.8, 0.6, LEG); }
  akHenBody(K, g, 0, peck, false);
  return K.fin([96, 80, 66]);
};

// Курица-мстительница на комично накачанных человеческих ногах (месть кур, leisure.js): load — 'g0..g3' ноги растут,
// 'k0..k5' пинок (замах → удар → назад), 's' стоит. Бёдра-окорока, икры-шары, рельеф, босые ступни с пальцами
AK_CR.henbuff = (f, load) => {
  const K = akKit(22, 30, 11, 28), g = v => v * 3, P = henBuffPose(load), L = P.L, sc = L / 9;
  const SK = akRamp('#e8b088', 8, 0.55), SKd = akRamp('#c88c68', 6, 0.5), HI = [254, 232, 206];
  const hipY = -2.4 - L, th = L * 0.52, cf = L * 0.52;
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  // нога одной формой: диски вдоль кости (бедро, колено, голень, ступня, пальцы) сливаются плавным минимумом —
  // без швов на стыках; рельеф мышц — тёмная бороздка между головками квадрицепса и икры, блики на выпуклостях
  const leg = (hx, a, b, far) => {
    const kx = hx + Math.sin(a) * th, ky = hipY + Math.cos(a) * th, ax = kx + Math.sin(a - b) * cf, ay = ky + Math.cos(a - b) * cf;
    const R = far ? SKd : SK, tw = 0.85 + sc * 1.25, cw = 0.65 + sc * 0.95, fa = a - b;
    const discs = [], bone = (x0, y0, x1, y1, w0, w1, bulge, bAt, nrm) => {
      for (let t = 0; t <= 1.0001; t += 0.1) { const w = w0 + (w1 - w0) * t + bulge * Math.exp(-(((t - bAt) / 0.3) ** 2)); discs.push([g(x0 + (x1 - x0) * t) + nrm[0] * g(w) * 0.12, g(y0 + (y1 - y0) * t) + nrm[1] * g(w) * 0.12, g(w)]); }
    };
    const nT = [Math.cos(a), -Math.sin(a)], nC = [Math.cos(fa), -Math.sin(fa)];                                   // нормали: мышцы выпирают назад/вперёд
    bone(hx, hipY, kx, ky, tw, tw * 0.58, sc * 0.75, 0.38, [-nT[0], -nT[1]]);                                          // бедро: окорок назад
    bone(kx, ky, ax, ay, cw * 0.85, cw * 0.45, sc * 0.65, 0.26, [-nC[0], -nC[1]]);                                      // голень: икра-шар назад
    discs.push([g(kx), g(ky), g(cw * 0.7)]);                                                                        // колено
    const fx = g(ax) + Math.cos(fa) * g(1.3 + sc * 0.6), fy = g(ay) + Math.sin(fa) * g(0.5) + 1;                     // ступня вперёд от голеностопа
    for (let t = 0; t <= 1.0001; t += 0.25) discs.push([g(ax) + (fx - g(ax)) * t + Math.cos(fa) * g(0.4), g(ay) + (fy - g(ay)) * t + 1, g(0.9 + sc * 0.3) * (1 - t * 0.25)]);
    for (let t = 0; t < 3; t++) discs.push([fx + Math.cos(fa) * (g(1.1 + sc * 0.5) - t * 1.6), fy + Math.sin(fa) * 1.5 - 0.6 - t * 0.2, 1.3 - t * 0.15]);   // пальцы
    const sdf = (x, y) => { let d = 1e9; for (const [cx, cy, r] of discs) d = smin(d, Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - r, 2.6); return d; };
    const crease = (x, y) => {                                                                                       // бороздки мышц
      if (sc < 0.45) return 0;
      const px = x + 0.5, py = y + 0.5;
      const along = (x0, y0, x1, y1, t0, t1, off) => { const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1, t = ((px - x0) * dx + (py - y0) * dy) / l2; if (t < t0 || t > t1) return 9; const nx = -dy / Math.sqrt(l2), ny = dx / Math.sqrt(l2); return Math.abs((px - x0 - dx * t) * nx + (py - y0 - dy * t) * ny - off); };
      const q = along(g(hx), g(hipY), g(kx), g(ky), 0.18, 0.72, g(tw) * 0.22 * (far ? 1 : -1)), c = along(g(kx), g(ky), g(ax), g(ay), 0.1, 0.55, 0);
      return Math.min(q, c) < 0.6 ? 1 : 0;
    };
    const glint = (x, y) => { const px = x + 0.5, py = y + 0.5; const d1 = Math.hypot(px - g(hx + (kx - hx) * 0.36) + Math.cos(a) * g(tw) * 0.5, py - g(hipY + (ky - hipY) * 0.36)), d2 = Math.hypot(px - g(kx + (ax - kx) * 0.26) + Math.cos(fa) * g(cw) * 0.45, py - g(ky + (ay - ky) * 0.26)); return d1 < 1.5 || d2 < 1.2; };
    K.blob(discs.map(([x, y, r]) => [x, y, r + 3, r + 3]), R, { inside: (x, y) => sdf(x, y) < 0, round: g(tw) * 0.95, fur: 0, shade: 0.3,
      mark: (x, y, v) => crease(x, y) ? K.tone(R, v - 0.2, x, y) : !far && sc > 0.5 && glint(x, y) ? HI : null });
  };
  leg(-1.5, P.ka2, P.kb2, true);
  K.blob([[0, g(hipY) - 2, g(2.7), g(1.6)]], akRamp('#e4ddd0', 5, 0.4), { round: 3, fur: 0.6 });                     // пушистые «шортики» из перьев
  akHenBody(K, g, L - 0.6 + Math.sin(Math.max(0, P.a)) * 0.6, false, P.kick);
  leg(1.5, P.a, P.b, false);
  return K.fin([96, 70, 52]);
};

// Гусь: длинная изогнутая шея, оранжевый клюв; в атаке шея вперёд и крылья вверх; плывёт — сидит в воде с рябью
AK_CR.goose = (f, load) => {
  const attack = load === 'attack', swim = load === 'swim', st = f == null ? 0 : Math.sin(akT(f, 6));
  const K = akKit(26, 24, 12, 21), g = v => v * 3, dy = swim ? g(5.5) : 0;
  const W = akRamp('#f2eee6', 6, 0.42), Wd = akRamp('#d0c8ba', 5), OR = akRamp('#f08a20', 5);
  if (!swim) for (const [x, s] of [[-1.4, st], [1.4, -st]]) { const fx = g(x + s * 1.6); K.limb(g(x), g(-5.6), fx, g(-0.6), 1.3, 1.1, OR); K.R(fx - 4, -3, fx + 5, 0, (px, py) => ((px + 0.5 - fx - 0.6) / 4.2) ** 2 + ((py + 0.5 + 1) / 1.3) ** 2 <= 1 ? K.tone(OR, 0.45, px, py) : null); }
  if (attack) akPoly(K, akG([[-3, -11.6], [-6.4, -19.6], [-1, -14.6], [1, -12.6]]), Wd, 0.75, 0.01);   // дальнее крыло
  akPoly(K, akG([[-5, -9], [-8.6, -11.8], [-8.2, -8]]).map(([x, y]) => [x, y + dy]), W, 0.7);
  K.blob([[0, g(-8.6) + dy, g(7), g(4.2)], [g(-3.6), g(-8.8) + dy, g(3.6), g(3.4)]], W, { fur: 0.4, round: 8, zone: (x, y) => [Wd, akCl((y - dy - g(-7)) / 1.2) * akCl((g(4) - x) / 2), 0.05] });
  for (let k = 0; k < 3; k++) K.limb(g(-5 + k * 1.6), g(-10 + k * 0.3) + dy, g(-1.6 + k * 1.6), g(-8.6 + k * 0.3) + dy, 0.9, 0.5, Wd, { bias: 0.1 });   // перья крыла
  if (attack) akPoly(K, akG([[0, -11.6], [2.4, -20.6], [4.4, -12.2]]), W, 0.85, 0.01);
  const neck = attack ? [[5, -10.4], [8.6, -12.4], [10.6, -11]] : [[5, -10.6], [7.4, -14.6], [6.6, -18]];
  K.path(neck.map(([x, y], i) => [g(x), g(y) + dy, i === 0 ? 3.8 : 3.3]), (u, e, sd) => K.tone(W, e ? 0.4 : sd > 0 ? 0.55 : 0.78, 0, Math.round(u * 9)));
  const hx = g(attack ? 11 : 7), hy = g(attack ? -11.2 : -18.4) + dy;
  K.blob([[hx, hy, g(1.9), g(1.6)]], W, { round: 3, fur: 0.1 });
  akPoly(K, [[hx + 4, hy - 2.4], [hx + 12, hy - 0.6], [hx + 4, hy + 1.2]], OR, 0.7, 0.08);
  if (attack) akPoly(K, [[hx + 4, hy + 1.6], [hx + 10.4, hy + 4.4], [hx + 4, hy + 3]], akRamp('#d07010', 4), 0.5);
  K.P(hx + 11, hy - 1, [40, 30, 24]);
  K.eye(hx + 1.6, hy - 1.2, 1.5, [50, 36, 30], [20, 14, 12]);
  if (attack) for (let k = 0; k < 5; k++) K.P(hx - 1 + k, hy - 4 + (k > 2 ? 1 : 0), [58, 42, 34]);           // сердитая бровь
  if (!swim) return K.fin([100, 88, 76]);
  K.outline([100, 88, 76], 0.95);                                                                                // вода — поверх обводки: тело под ней не видно
  K.R(g(-9.6), g(-2.8), g(9.6), g(2.6), (x, y) => { const e = Math.hypot((x + 0.5) / g(9.6), (y + 0.5 - g(-0.8)) / g(2.2)); return e > 1 ? null : y < g(-2.2) ? [120, 170, 200] : [44 + (y < g(-1.4) ? 20 : 0), 92 + (y < g(-1.4) ? 24 : 0), 134 + (y < g(-1.4) ? 20 : 0), 1 - akCl(e - 0.7) * 1.6]; }, false);
  akRipple(K, -0.8, 8.6 + st, 1.4, 0.75, [214, 238, 246]); akRipple(K, -0.6, 11.5 + st * 1.4, 2, 0.35, [214, 238, 246]);
  const cv = K.done(); cv.fine = 3; return cv;
};

// Утка-кряква: бурая, зелёная голова, белое кольцо, синее «зеркальце»; на воде — в круге ряби
AK_CR.duck = (f, load) => {
  const fl = petFlags(load), K = akKit(22, 20, 11, 17), g = v => v * 3, st = f == null ? 0 : Math.sin(akT(f, 6)), dy = fl.swim ? g(2.4) : 0;
  const B = akRamp('#8a6a46', 6, 0.5), Bl = akRamp('#d2c0a0', 5), GR = akRamp('#2f7040', 6, 0.55), Y = akRamp('#e8b830', 4), OR = akRamp('#e08a24', 4);
  const SPEC = [[40, 70, 150], [58, 92, 176], [96, 132, 210]];
  if (fl.swim) { akRipple(K, -0.4, 8 + st * 0.6, 2.3, 0.6); akRipple(K, -0.4, 5.6, 1.5, 0.55); }
  else for (const [x, s] of [[-1, st], [1.2, -st]]) { K.limb(g(x), g(-2.6), g(x + s * 1.3), g(-0.3), 0.9, 0.8, OR); K.limb(g(x + s * 1.3 - 1.2), g(-0.2), g(x + s * 1.3 + 1.1), g(-0.2), 0.7, 0.6, OR); }
  akPoly(K, akG([[-4.4, -5.8], [-7.6, -8.4], [-6.4, -4]]).map(([x, y]) => [x, y + dy]), akRamp('#5a4630', 4), 0.55);
  K.blob([[g(-0.6), g(-5) + dy, g(5.4), g(3.5)]], B, { fur: 0.4, round: 7, zone: (x, y) => [Bl, akCl((y - dy - g(-4.4)) / 1) * akCl((x - g(-3)) / 1.5), 0.1] });
  K.blob([[g(-1.4), g(-5.4) + dy, g(2.8), g(1.6), -0.1]], akRamp('#6a5034', 5), { round: 2, rim: false, fur: 0.2, zone: (x, y) => [SPEC, akCl((y - dy - g(-5)) / 0.8) * akCl((x - g(-2.6)) / 0.8)] });
  K.blob([[g(3.2), g(-8.2) + dy, g(1.9), g(1.3)]], akRamp('#f2eee6', 4), { round: 2 });
  K.blob([[g(4.4), g(-10.4) + dy, g(2.2), g(2)]], GR, { round: 4, fur: 0.2 });
  akPoly(K, [[g(6.1), g(-11.2) + dy], [g(9.2), g(-10) + dy], [g(6.1), g(-8.8) + dy]], Y, 0.7, 0.1);
  K.eye(g(4.9), g(-11.2) + dy, 1.5, [40, 30, 24], [16, 12, 12]);
  return akGear(K.fin([44, 34, 26]), 22, 20, 11, 4 + (fl.swim ? 2.4 : 0), load, 3.2, 5.4, -1, 5.2);
};

// Кролик: серо-бурый, белый хвостик-пуховка, длинные уши; скачет
AK_CR.rabbit = (f, load) => {
  const K = akKit(18, 14, 9, 12), g = v => v * 3, hop = f == null ? 0 : Math.abs(Math.sin(akT(f, 6))) * 2.4, dy = -g(hop);
  const B = akRamp('#9a8a74', 6, 0.5), Bl = akRamp('#d4c8b4', 5), WH = akRamp('#f4f0e8', 3), PINK = [224, 168, 160];
  K.blob([[g(-1.4), g(-1.6) + dy, g(2.4), g(1.6)]], B, { round: 3, fur: 0.3 });                                    // задняя лапа
  K.blob([[0, g(-3) + dy, g(4.4), g(3)], [g(2.4), g(-4.2) + dy, g(2.2), g(2.2)]], B, { fur: 0.7, round: 6, zone: (x, y) => [Bl, akCl((y - dy - g(-2.4)) / 1) * akCl((x - g(-2.4)) / 1.2), 0.1] });
  K.blob([[g(-4.3), g(-3.6) + dy, g(1.3), g(1.3)]], WH, { round: 2, rim: false });                                    // хвостик
  K.limb(g(2.6), g(-2) + dy, g(3), g(-0.3) + dy, 1.4, 1.1, B);
  for (const [ex, a, dk] of [[3, -0.32, true], [4.2, 0.08, false]]) {                                                   // уши
    const cx = g(ex), cy = g(-8.4) + dy;
    K.R(cx - 8, cy - 10, cx + 8, cy + 10, (x, y) => { const q = K.lit(x, y, [cx, cy, 2.5, 7.6, a]); if (!q) return null; return !dk && K.lit(x, y, [cx + 0.2, cy + 0.6, 1, 5.6, a]) ? PINK : K.tone(B, (dk ? 0.25 : 0.4) + q.l * 0.5, x, y); });
  }
  K.blob([[g(3.8), g(-5) + dy, g(2.1), g(1.85)]], B, { round: 4, fur: 0.3, zone: (x, y) => [Bl, akCl((y - dy - g(-4.4)) / 1) * akCl((x - g(4)) / 1), 0.1] });
  K.P(g(5.8), g(-5) + dy, PINK); K.P(g(5.8) + 1, g(-5) + dy, PINK);
  K.eye(g(4.6), g(-5.6) + dy, 1.6, [70, 44, 30], [20, 14, 12]);
  return akGear(K.fin([60, 50, 42]), 18, 14, 9, 1 - hop, load, 3.2, 4.8, 0, 5.2);
};

// ---------- Звери с ручных карт-строк (afSprite): кадр того же размера, что карта, земля — нижний край, морда вправо ----------
const akWH = rows => [Math.max(...rows.map(r => r.length)), rows.length];
// фаза шага кадра из ключа «…W3»/«…w3» (N кадров) → угол или null
const akPhK = (key, N) => { const p = afPh(key, N); return p == null ? null : p * AK_TAU; };
// простая лапа: от бедра (x, top) к ступне со сдвигом по фазе (игровые px), толщина r (мелкие px)
function akStub(K, x, top, t, ph, far, ramp, r, o = {}) {
  const g = v => v * 3, sw = t == null ? 0 : Math.sin(t + ph) * (o.step ?? 1.1), lift = t == null ? 0 : Math.max(0, Math.cos(t + ph)) * (o.lift ?? 0.5);
  K.limb(g(x), g(top), g(x + sw), g(-lift) - (o.foot ? 1.2 : 0.8), r, r * (o.taper ?? 0.85), ramp, { bias: far ? -0.25 : 0 });
  if (o.foot) K.R(g(x + sw) - 4, g(-lift) - 3, g(x + sw) + 5, g(-lift), (px, py) => ((px + 0.5 - g(x + sw) - 0.8) / (r + 0.8)) ** 2 + ((py + 0.5 - g(-lift) + 1) / 1.3) ** 2 <= 1 ? K.tone(o.foot, far ? 0.15 : 0.5, px, py) : null);
}

// Кабан: бурый, щетина по хребту, пятачок, клык; роет — голова к земле
afHand(/^boar/, (rows, pal, key) => {
  const [w, h] = akWH(rows), root = key === 'boarR', t = akPhK(key, 8), g = v => v * 3, K = akKit(w, h, 0, h);
  const B = akRamp('#5e4836', 7, 0.55), N = akRamp('#2e2420', 4), SN = akRamp('#c69484', 5), TUSK = akRamp('#ece6cc', 3), HOOF = akRamp('#1e1814', 3);
  const lift = h > 10 ? g(-1) : 0;
  for (const [x, ph] of [[4.4, Math.PI], [15.2, 0]]) akStub(K, x, -3.4 + lift / 3, t, ph, true, B, 2.1, { foot: HOOF });
  const tilt = root ? 0.07 : 0, rot = (x, y) => [x, y + (x - g(10)) * tilt];
  K.blob([[g(9), g(-5.2) + lift, g(8.2), g(3.2)], [g(12.4), g(-5.8) + lift, g(4.6), g(3.5)], [g(3.8), g(-5) + lift, g(3.4), g(3)]].map(([x, y, rx, ry]) => [...rot(x, y), rx, ry, tilt]), B,
    { fur: 1.3, round: 7, seed: 11, zone: (x, y) => [N, akCl((y - lift - g(-3) - (x - g(10)) * tilt) / 1.2), 0, 0.3] });
  for (let x = 4; x < 14.6; x += 0.55) {                                                         // щетина по хребту: выше на загривке
    const y = -8 - Math.sin((x - 2) / 12.6 * Math.PI) * 0.8 + (x - 10) * tilt, hh = (0.4 + (x - 4) / 10 * 0.9) * (0.6 + K.hsh(x * 5) * 0.6);
    K.limb(g(x), g(y) + lift + 2, g(x - 0.4), g(y - hh) + lift, 1, 0.45, N, { bias: 0.1 });
  }
  K.limb(g(0.9), g(-6.2) + lift, g(0.2), g(-4.6) + lift, 1, 0.6, N);                                // хвостик
  const hx = g(15.6), hy = g(root ? -3.4 : -5.4) + lift, a = root ? 0.42 : 0.08, ca = Math.cos(a), sa = Math.sin(a), H = (u, v) => [hx + u * ca - v * sa, hy + u * sa + v * ca];
  K.blob([[...H(-1, -0.6), g(3), g(2.6), a], [...H(4.6, 0.8), g(2.1), g(1.6), a + 0.15]], B, { fur: 0.6, round: 5, seed: 5, zone: (x, y) => [N, akCl(((y - hy) * ca - (x - hx) * sa - 4) / 1.2), 0, 0.3] });
  const [sx, sy] = H(10.2, 1);
  K.blob([[sx, sy, 1.8, 3.4, a]], SN, { round: 2, rim: false });                                     // пятачок
  K.P(Math.round(sx + 0.5), Math.round(sy - 1), [96, 56, 50]); K.P(Math.round(sx + 0.5), Math.round(sy + 1.4), [96, 56, 50]);
  const [tx, ty] = H(6.4, 3.4), [tx2, ty2] = H(8.2, 0.6);
  K.path([[tx, ty, 1.2], [tx + 1.6, ty - 1.2, 0.9], [tx2, ty2, 0.5]], () => TUSK[2]);                    // клык
  const [ex, ey] = H(1.2, -2.6); K.eye(ex, ey, 1.4, [70, 40, 30], [16, 10, 8]);
  const [ax, ay] = H(-2.4, -6); akPoly(K, [[ax - 2.4, ay + 2.6], [ax - 0.4, ay - 3.4], [ax + 2.6, ay + 2.2]], B, 0.5, 0.03);   // ухо
  for (const [x, ph] of [[3.2, Math.PI * 1.5], [13.8, Math.PI * 0.5]]) akStub(K, x, -3.4 + lift / 3, t, ph, false, B, 2.3, { foot: HOOF });
  return K.fin([30, 22, 18]);
});

// Медведь: бурый, горб на загривке, круглые уши, светлая морда; ест мёд — морда в меду
afHand(/^bear/, (rows, pal, key) => {
  const [w, h] = akWH(rows), eat = key === 'bearE', t = akPhK(key, 8), g = v => v * 3, K = akKit(w, h, 0, h);
  const B = akRamp('#6c4628', 7, 0.55), Bd = akRamp('#4a2e1a', 5), M = akRamp('#c09a6e', 5), PAW = akRamp('#32200f', 4), HON = akRamp('#e0b438', 4);
  const lift = h > 13 ? -3 : 0;
  for (const [x, ph] of [[5.6, Math.PI], [18.6, 0]]) akStub(K, x, -3.6 + lift / 3, t, ph, true, Bd, 3.6, { foot: PAW, step: 1.2 });
  K.blob([[g(10.6), g(-6.6) + lift, g(8.6), g(4)], [g(14.2), g(-7.6) + lift, g(5), g(4)], [g(4.6), g(-6.4) + lift, g(4), g(4)]], B,
    { fur: 1.2, round: 9, seed: 13, zone: (x, y) => [Bd, akCl((y - lift - g(-4)) / 1.4), 0, 0.3] });
  for (let k = 0; k < 16; k++) { const x = g(2 + k * 1.05), y = g(-3.4 - (k % 3) * 0.25) + lift; K.limb(x, y - 2, x - 1.2, y + 1, 1.2, 0.5, Bd); }   // клоки меха по низу
  const hx = g(19.8), hy = g(eat ? -6 : -6.8) + lift;
  K.blob([[hx, hy, g(3.6), g(3.2)]], B, { fur: 0.5, round: 6, seed: 3 });
  for (const [ux, dk] of [[-1.6, true], [1.8, false]]) { const ex = hx + g(ux), ey = hy - g(2.6); K.blob([[ex, ey, 3.2, 3]], dk ? Bd : B, { round: 2, fur: 0 }); if (!dk) K.blob([[ex, ey + 0.5, 1.6, 1.4]], Bd, { round: 1, rim: false }); }
  K.blob([[hx + g(2.4), hy + g(1.1), g(1.8), g(1.35)]], M, { round: 3, fur: 0.1 });
  K.R(hx + g(3.4) - 3, hy + g(0.6) - 3, hx + g(3.4) + 3, hy + g(0.6) + 2, (x, y) => Math.hypot(x + 0.5 - hx - g(3.6), (y + 0.5 - hy - g(0.5)) * 1.3) < 2 ? (y < hy + g(0.4) && x < hx + g(3.5) ? [90, 76, 70] : [22, 16, 14]) : null);
  K.limb(hx + g(3.4), hy + g(1.2), hx + g(3.2), hy + g(2), 0.6, 0.6, Bd);
  K.eye(hx + g(0.6), hy - g(0.7), 1.6, [60, 36, 20], [14, 10, 8]);
  if (eat) { K.blob([[hx + g(3), hy + g(2.4), 2.4, 2], [hx + g(3.2), hy + g(3.6), 1, 2]], HON, { round: 2 }); }
  for (const [x, ph] of [[3.4, Math.PI * 1.5], [16.6, Math.PI * 0.5]]) akStub(K, x, -3.6 + lift / 3, t, ph, false, B, 3.8, { foot: PAW, step: 1.2 });
  return K.fin([36, 22, 12]);
});

// треугольное ушко с розовым нутром (кошки, лисы-малыши): основание x0..x1 на высоте yb, вершина (xt, yt) — мелкие px
function akEar(K, x0, x1, xt, yt, yb, ramp, inner, v = 0.6) {
  akPoly(K, [[x0, yb], [xt, yt], [x1, yb]], ramp, v, 0.02);
  if (inner) akPoly(K, [[x0 + 1.6, yb], [xt + (x0 + x1 - 2 * xt) * 0.08, yt + 2.4], [x1 - 1.6, yb]], [inner, inner], 0);
}

// ---------- Коты (CAT_SIT 11×11, CAT_WALK_A 14×9, CAT_SLEEP 11×5), окрас — палитра CAT_VARS ----------
afHand(/^cat\d/, (rows, pal, key) => {
  const [w, h] = akWH(rows), g = v => v * 3, K = akKit(w, h, 0, h), P = pal;
  const A = akRamp(P.a, 7, 0.55), Cc = akRamp(P.c, 5, 0.4), X = akRamp(P.x, 4), PINK = hexToRgb(P.p), EYE = hexToRgb(P.e);
  const stripes = (x, y) => (Math.floor((x * 0.8 + y * 0.35) / 3.2) % 3 === 0) && K.hsh(Math.floor(x / 4) * 7 + Math.floor(y / 6)) > 0.25;
  const furZ = (x, y, light) => light && light(x, y) ? [Cc, 1, 0.1] : stripes(x, y) ? [X, 1, 0, 0.3] : null;
  const head = (hx, hy, r, closed) => {
    K.blob([[hx, hy, r * 1.08, r * 0.92]], A, { fur: 0.2, round: 4, zone: (x, y) => furZ(x, y, (x, y) => y > hy + r * 0.3 && Math.abs(x - hx - 1) < r * 0.75) });
    akEar(K, hx - r * 1.0, hx - r * 0.1, hx - r * 0.75, hy - r * 1.75, hy - r * 0.55, A, PINK);
    akEar(K, hx + r * 0.15, hx + r * 1.05, hx + r * 0.85, hy - r * 1.75, hy - r * 0.55, A, PINK);
    if (closed) { K.blink(Math.round(hx - r * 0.35), Math.round(hy), 1, X[0]); K.blink(Math.round(hx + r * 0.5), Math.round(hy), 1, X[0]); }
    else for (const ex of [hx - r * 0.38, hx + r * 0.48]) {                                                     // кошачьи глаза: зрачок-щёлка, блик
      K.R(ex - 3, hy - 3, ex + 3, hy + 3, (x, y) => { const d = Math.hypot(x + 0.5 - ex, (y + 0.5 - hy) * 0.95); return d < 1.9 ? (Math.abs(x + 0.5 - ex - 0.2) < 0.6 && d < 1.7 ? [16, 14, 18] : EYE) : null; });
      K.P(Math.round(ex - 1), Math.round(hy - 1), [255, 255, 250]);
    }
    akPoly(K, [[hx + r * 0.05, hy + r * 0.32], [hx + r * 0.33, hy + r * 0.32], [hx + r * 0.19, hy + r * 0.52]], [PINK, PINK], 0);   // нос
    for (const s of [-1, 1]) K.limb(hx + r * 0.2 + s * 1.2, hy + r * 0.66, hx + r * 0.2 + s * 2.4, hy + r * 0.6, 0.45, 0.45, X);
  };
  if (/s$/.test(key)) {                                                                                          // спит калачиком
    K.blob([[g(5), g(-2.2), g(4.8), g(2)]], A, { fur: 0.4, round: 5, zone: (x, y) => furZ(x, y) });
    K.limb(g(0.8), g(-1.2), g(6.4), g(-0.5), 2.2, 1.6, A, { bias: -0.1 });                                       // хвост вокруг
    head(g(8.6), g(-2.2), g(1.8), true);
    return K.fin([Math.round(A[0][0] * 0.6), Math.round(A[0][1] * 0.55), Math.round(A[0][2] * 0.6)]);
  }
  if (/i$/.test(key)) {                                                                                          // сидит
    K.path([[g(3.8), g(-0.8), 2.4], [g(1), g(-1.2), 2.2], [g(0.7), g(-3.6), 2], [g(1.4), g(-4.6), 1.6]], (u, e) => K.tone(A, e ? 0.3 : 0.55, 0, 0));
    K.blob([[g(5), g(-2.6), g(3.9), g(2.6)], [g(7.4), g(-4.6), g(2.2), g(3.1)]], A, { fur: 0.5, round: 6, zone: (x, y) => furZ(x, y, (x, y) => x > g(7.6) && y > g(-6.6)) });
    for (const x of [7.2, 8.8]) { K.limb(g(x), g(-4), g(x), g(-0.6), 1.7, 1.5, A); K.blob([[g(x) + 0.6, -1.2, 2.2, 1.3]], Cc, { round: 1 }); }
    head(g(8.3), g(-8), g(2.4), false);
    return K.fin([Math.round(A[0][0] * 0.6), Math.round(A[0][1] * 0.55), Math.round(A[0][2] * 0.6)]);
  }
  const t = akPhK(key, 6), lift = h > 9 ? -3 : 0;                                                                // идёт
  for (const [x, ph] of [[2.8, Math.PI], [11.4, 0]]) akStub(K, x, -2.6 + lift / 3, t, ph, true, A, 1.4, { step: 1 });
  K.path([[g(2), g(-4) + lift, 2.2], [g(0.6), g(-5.6) + lift, 1.9], [g(1), g(-8) + lift, 1.6]], (u, e) => K.tone(A, e ? 0.3 : 0.6, 0, 0));
  K.blob([[g(6.8), g(-4.4) + lift, g(5.4), g(1.8)]], A, { fur: 0.5, round: 4, zone: (x, y) => furZ(x, y, (x, y) => y > g(-3.4) + lift && x > g(8)) });
  head(g(11.3), g(-6.4) + lift, g(2.2), false);
  for (const [x, ph] of [[4, Math.PI * 1.5], [12.6, Math.PI * 0.5]]) akStub(K, x, -2.6 + lift / 3, t, ph, false, A, 1.5, { step: 1 });
  return K.fin([Math.round(A[0][0] * 0.6), Math.round(A[0][1] * 0.55), Math.round(A[0][2] * 0.6)]);
});

// ---------- Аист (STORK_S 16×19; на гнезде — первые 13 рядов, без ног) ----------
afHand(/^stork[SN]$/, (rows, pal, key) => {
  const [w, h] = akWH(rows), nest = key === 'storkN', g = v => v * 3, K = akKit(w, h, 0, h);
  const W = akRamp('#f4f2ea', 6, 0.42), Wd = akRamp('#cfcabc', 5), BK = akRamp('#262430', 5, 0.5), RD = akRamp('#d03a2c', 5);
  const Y = v => g(v) - h * 3;                                                                                  // ряд карты → от нижнего края
  if (!nest) for (const x of [5.6, 8.4]) { K.limb(g(x), Y(12.6), g(x), Y(18.4), 1.3, 1.1, RD); K.limb(g(x) - 2.4, Y(18.6), g(x) + 2.6, Y(18.6), 0.8, 0.8, RD); K.blob([[g(x), Y(15.4), 1.6, 1.3]], RD, { round: 1 }); }
  K.blob([[g(7.2), Y(9.4), g(5.2), g(2.9), -0.18], [g(8.4), Y(8), g(3), g(2.6)]], W, { fur: 0.3, round: 7, zone: (x, y) => [Wd, akCl((y - Y(10.6)) / 1.2), 0] });
  akPoly(K, [[g(0), Y(8.2)], [g(3.6), Y(7.2)], [g(7), Y(8.2)], [g(6.2), Y(10.8)], [g(2), Y(11)]], BK, 0.5, 0.01);   // чёрные маховые
  for (let k = 0; k < 5; k++) K.limb(g(0.8 + k * 1.2), Y(8.3), g(0.4 + k * 1.35), Y(10.6), 0.7, 0.5, BK, { bias: 0.2 });
  K.path([[g(9.6), Y(8.2), 3.4], [g(8.4), Y(5.2), 2.8], [g(8.7), Y(2.4), 2.6]], (u, e, sd) => K.tone(W, e ? 0.45 : sd > 0 ? 0.6 : 0.85, 0, 0));
  K.blob([[g(8.8), Y(1.6), g(1.6), g(1.3)]], W, { round: 3 });
  akPoly(K, [[g(9.9), Y(1.05)], [g(15.8), Y(1.5)], [g(9.9), Y(2.4)]], RD, 0.75, 0.06);
  K.eye(g(9.3), Y(1.3), 1.3, [40, 30, 34], [16, 12, 14]);
  return K.fin([86, 80, 88]);
});

// ---------- Цапля (HERON_S 12×19, удар HERON_STRIKE) ----------
afHand(/^heron[SK]$/, (rows, pal, key) => {
  const [w, h] = akWH(rows), strike = key === 'heronK', g = v => v * 3, K = akKit(w, h, 0, h), Y = v => g(v - 19);
  const H = akRamp('#8a98a8', 6, 0.5), Hd = akRamp('#5a6878', 5), Wn = akRamp('#dce4ea', 5, 0.4), DK = akRamp('#2e3644', 4), YL = akRamp('#e0b438', 5);
  for (const x of [5.5, 7.5]) { K.limb(g(x), Y(11.6), g(x), Y(18.4), 1.1, 1, YL); K.limb(g(x) - 2.4, Y(18.6), g(x) + 2.2, Y(18.6), 0.7, 0.7, YL); }
  K.blob([[g(6), Y(9.4), g(3.9), g(2.5), strike ? 0.25 : -0.12]], H, { fur: 0.4, round: 6, zone: (x, y) => [Hd, akCl((y - Y(10.4)) / 1.2), 0] });
  K.path([[g(3.2), Y(8.4), 1.2], [g(4.6), Y(10.6), 1], [g(7.4), Y(11.3), 0.8]], () => DK[1]);
  for (let k = 0; k < 3; k++) K.limb(g(2.4 + k * 0.6), Y(9.8 + k * 0.4), g(1.4 + k * 0.8), Y(12 + k * 0.3), 0.7, 0.4, Hd);   // перья хвоста
  if (strike) {
    K.path([[g(6.6), Y(7.6), 2.8], [g(8.6), Y(7.4), 2.4], [g(9.6), Y(8.4), 2.2]], (u, e, sd) => K.tone(Wn, e ? 0.4 : 0.7, 0, 0));
    K.blob([[g(10), Y(8.6), g(1), g(0.9)]], H, { round: 2 });
    akPoly(K, [[g(10.4), Y(9)], [g(11.7), Y(12.8)], [g(10.9), Y(9.1)]], YL, 0.7, 0.02);
    K.eye(g(10.2), Y(8.3), 1, [30, 26, 22], [16, 12, 12]);
    K.path([[g(9.2), Y(8), 0.8], [g(7.6), Y(7.2), 0.5]], () => DK[0]);                                                // хохолок
  } else {
    K.path([[g(6.6), Y(7.8), 2.8], [g(4.8), Y(5.4), 2.4], [g(5.6), Y(2.6), 2.4]], (u, e, sd) => K.tone(Wn, e ? 0.45 : sd > 0 ? 0.6 : 0.85, 0, 0));
    for (let k = 0; k < 3; k++) K.P(g(5.1 + k * 0.05), Y(3.8 + k * 1.2), DK[1]);
    K.blob([[g(5.6), Y(1.6), g(1.4), g(1.05)]], H, { round: 2, zone: (x, y) => [Wn, akCl((y - Y(1.8)) / 0.8), 0.1] });
    K.path([[g(4.6), Y(1), 1], [g(3.2), Y(0.5), 0.7], [g(2.4), Y(1.4), 0.4]], () => DK[0]);                           // хохолок
    akPoly(K, [[g(6.6), Y(1.2)], [g(11.8), Y(1.6)], [g(6.6), Y(2.2)]], YL, 0.75, 0.06);
    K.eye(g(6.2), Y(1.3), 1.1, [200, 160, 40], [16, 12, 12]);
  }
  return K.fin([40, 46, 58]);
});

// ---------- Ворона стоя и в шаге (CROW_STAND + ноги, 18×13) ----------
afHand(/^crow:[sw]/, (rows, pal, key) => {
  const [w, h] = akWH(rows), g = v => v * 3, K = akKit(w, h, 0, h), kind = key.split(':')[1];
  const B = akRamp('#2a2a36', 6, 0.45), GL = akRamp('#4a4a6a', 4), BEAK = akRamp('#cfae58', 4), LEG = akRamp('#7a6444', 3);
  const t = kind[0] === 'w' ? (+kind.slice(1) % 6) / 6 * AK_TAU : null, sn = t == null ? 0 : Math.sin(t), pose = kind[0] === 's' ? +kind[1] : 0, sp = pose === 1 ? 1.4 : pose === 2 ? -0.6 : 0;
  const leg = (x, off, far) => { K.limb(g(x), g(-3), g(x + off), g(-0.3), 0.8, 0.7, LEG, { bias: far ? -0.3 : 0 }); K.limb(g(x + off) - 2, -1, g(x + off) + 2.4, -1, 0.6, 0.6, LEG, { bias: far ? -0.3 : 0 }); };
  leg(9.4, -sn * 1.1 - sp * 0.4, true);
  akPoly(K, akG([[0, -5.6], [3.6, -6.8], [6.8, -5.4], [5.8, -3.4], [0.6, -4.2]]), B, 0.45, 0);                  // хвост
  K.blob([[g(8.4), g(-5.8), g(5), g(3), -0.22], [g(11.4), g(-9.6), g(2.6), g(2.3)], [g(11.6), g(-8), g(1.8), g(1.6)]], B, { fur: 0.5, round: 6, zone: (x, y) => [GL, akCl((g(-7.6) - y) / 1.2) * akCl((x - g(4)) / 1) * akCl((g(10) - x) / 1), 0.05] });
  for (let k = 0; k < 3; k++) K.path([[g(5 + k * 1.6), g(-7.4)], [g(6.4 + k * 1.4), g(-5.6)], [g(5.6 + k * 1.5), g(-4.4)]].map(p => [...p, 0.5]), () => GL[1]);   // маховые
  akPoly(K, [[g(13.2), g(-10.6)], [g(17.4), g(-9.6)], [g(13.2), g(-8.6)]], BEAK, 0.75, 0.08);
  K.eye(g(12.1), g(-10.6), 1.4, [120, 110, 90], [12, 12, 16]);
  leg(10.6, sn * 1.1 + sp, false);
  return K.fin([14, 14, 20]);
});

// ---------- Лягушка (FROG_FR 11×7 и прыжки): зелёная, жёлтое горлышко, глаза-бусины ----------
afHand(/^frog:/, (rows, pal, key) => {
  const [w, h] = akWH(rows), g = v => v * 3, K = akKit(w, h, 0, h), name = key.split(':')[1];
  const G = akRamp('#4a8a34', 6, 0.55), Gl = akRamp('#9ccc64', 4), Q = akRamp('#d8f090', 3), SP = akRamp('#2c5a24', 3);
  const air = name === 'air' || name === 'launch', crouch = name === 'crouch', dy = crouch ? g(0.8) : 0;
  if (air) {                                                                                                    // в прыжке: вытянута, задние лапы назад
    K.limb(g(3), g(-3), g(0.4), g(-1.6), 2.2, 1.4, G); K.limb(g(0.4), g(-1.6), g(0), g(-0.4), 1.4, 1, G);
    K.blob([[g(6.2), g(-3.6), g(3.6), g(2)], [g(8.6), g(-4.4), g(2.2), g(1.6)]], G, { fur: 0, round: 4, zone: (x, y) => [Gl, akCl((y - g(-3)) / 1), 0.1] });
    for (const ex of [g(8.2), g(10.2)]) { K.blob([[ex, g(-5.6), 2.4, 2.2]], G, { round: 2 }); K.eye(ex + 0.3, g(-5.8), 1.3, [200, 180, 40], [14, 16, 10]); }
    K.limb(g(9), g(-2.6), g(10.4), g(-1.2), 1.1, 0.8, G);
    return K.fin([24, 48, 20]);
  }
  for (const s of [-1, 1]) K.blob([[g(5.5 + s * 4.2), g(-1.4) + dy, g(1.6), g(1.2)]], G, { round: 2, fur: 0 });     // поджатые лапы
  const croak = name === 'croak';
  K.blob([[g(5.5), g(-3.6) + dy * 0.5, g(4.6), g(2.7) - dy * 0.3]], G, { fur: 0, round: 6, zone: (x, y) => {
    if (croak && y > g(-3.6) && Math.abs(x - g(5.5)) < g(2.6)) return [Q, 1, 0.3, 0.7];
    if (K.hsh(Math.floor(x / 3) * 13 + Math.floor(y / 3) * 7) > 0.86 && y < g(-3.4)) return [SP, 1, 0, 0.3];
    return [Gl, akCl((y - g(-2.6)) / 1), 0.1];
  } });
  for (const ex of [g(3), g(8)]) {                                                                              // глаза-бусины
    K.blob([[ex, g(-6) + dy * 0.5, 3, 2.8]], G, { round: 2 });
    if (name === 'blink') K.blink(Math.round(ex), Math.round(g(-6) + dy * 0.5), 1, SP[0]);
    else K.eye(ex + 0.3, g(-6.2) + dy * 0.5, 1.6, [210, 190, 50], [14, 16, 10]);
  }
  for (let x = g(3.4); x <= g(7.6); x++) K.P(x, g(-3.4) + dy * 0.5 + (Math.abs(x - g(5.5)) > g(1.6) ? -1 : 0), SP[0]);   // улыбка
  return K.fin([24, 48, 20]);
});

// тёмная обводка зверя — тёмный тон его же основы
const akInk = ramp => ramp[0].map(v => Math.round(v * 0.62));

// ---------- Мышь (MOUSE_A 10×6): серая, круглые розовые уши, хвостик-ниточка ----------
afHand(/^mouse/, (rows, pal, key) => {
  const [w, h] = akWH(rows), g = v => v * 3, K = akKit(w, h, 0, h), t = akPhK(key, 6), M = akRamp(pal.m, 6, 0.5), PK = hexToRgb(pal.p);
  K.path([[g(2), g(-3), 1], [g(0.6), g(-2.6), 0.8], [g(0.2), g(-1.2), 0.6], [g(1), g(-0.6), 0.5]], () => PK);
  for (const [x, ph] of [[3.4, 0], [6.6, Math.PI]]) akStub(K, x, -1.4, t, ph, false, M, 0.9, { step: 0.6 });
  K.blob([[g(5), g(-3), g(3.6), g(2)], [g(7.4), g(-3.6), g(1.8), g(1.6)]], M, { fur: 0.5, round: 4, zone: (x, y) => [akRamp('#cec6ba', 3), akCl((y - g(-2)) / 1), 0.1] });
  K.blob([[g(7.4), g(-5.3), 2.4, 2.4]], M, { round: 1 }); K.blob([[g(7.4), g(-5.2), 1.2, 1.2]], [PK, PK], { round: 1, rim: false });
  K.P(g(9.4), g(-4) - 1, PK); K.P(g(9.4) + 1, g(-4) - 1, PK);
  K.eye(g(8), g(-4.4), 1.1, [20, 16, 20], [14, 12, 16]);
  return K.fin(akInk(M));
});

// ---------- Барсук (BADGER_A 21×9, роет BADGER_DIG): серый, белая морда с чёрными полосами ----------
afHand(/^badger/, (rows, pal, key) => {
  const [w, h] = akWH(rows), g = v => v * 3, K = akKit(w, h, 0, h), dig = key === 'badgerD', t = akPhK(key, 6);
  const Bg = akRamp('#8c8c96', 6, 0.5), Bd = akRamp('#56565e', 5), W = akRamp('#f0ece0', 4, 0.35), N = akRamp('#25252c', 4), lift = h > 9 ? -3 : 0;
  for (const [x, ph] of [[3.6, Math.PI], [13.6, 0]]) akStub(K, x, -2 + lift / 3, t, ph, true, N, 2, { step: 0.8 });
  const tilt = dig ? 0.12 : 0;
  K.blob([[g(8.4), g(-4) + lift, g(8), g(2.6), tilt], [g(3), g(-4) + lift, g(3), g(2.4)]], Bg, { fur: 1.2, round: 6, seed: 4, zone: (x, y) => [Bd, akCl((y - g(-2.6) - lift - (x - g(8)) * tilt) / 1.2), 0, 0.3] });
  for (let k = 0; k < 12; k++) K.limb(g(1.6 + k * 1.15), g(-6.2) + lift + 1, g(1.2 + k * 1.15), g(-5.2) + lift, 0.7, 0.4, Bd, { bias: 0.2 });   // жёсткая ость
  const hx = g(16.4), hy = g(dig ? -2.6 : -4.4) + lift;
  K.blob([[hx, hy, g(2.6), g(2)], [hx + g(2.6), hy + g(0.6), g(1.8), g(1.1), 0.2]], W, { round: 4, fur: 0.1, zone: (x, y) => {
    const u = x - hx, v = y - hy, band = Math.abs(v + 1.2 - u * 0.12) < 1.7 && u > -6 && u < 10;               // чёрная полоса через глаз к носу
    return [N, band ? 1 : akCl((v - 3.2) / 1) * akCl((-u - 3) / 1), 0, 0.35];
  } });
  K.blob([[hx - g(1.4), hy - g(2), 2, 1.6]], W, { round: 1 });                                                      // ушко
  K.R(hx + g(4.4) - 3, hy - 3, hx + g(4.4) + 3, hy + 4, (x, y) => Math.hypot(x + 0.5 - hx - g(4.3), y + 0.5 - hy - g(0.6)) < 1.6 ? [26, 24, 30] : null);
  K.eye(hx + g(0.4), hy - g(0.3), 1.2, [40, 36, 44], [10, 10, 14]);
  if (dig) for (let k = 0; k < 4; k++) K.blob([[g(18.6 + k * 0.5), g(-0.8 - k * 0.45), 1.2, 1]], akRamp('#6a4a2a', 3), { round: 1, rim: false });
  for (const [x, ph] of [[2.4, Math.PI * 1.5], [12.4, Math.PI * 0.5]]) akStub(K, x, -2 + lift / 3, t, ph, false, N, 2.2, { step: 0.8 });
  return K.fin([30, 30, 36]);
});

// ---------- Белка (SQ_SIT 13×8, прыжок SQ_RUN/SQ_RUN2 13×7): рыжая, пышный хвост, кисточки на ушах ----------
afHand(/^sq/, (rows, pal, key) => {
  const [w, h] = akWH(rows), g = v => v * 3, K = akKit(w, h, 0, h), O = akRamp(pal.o, 6, 0.55), Od = akRamp(pal.O, 5), C = akRamp(pal.c, 4, 0.35);
  const sit = key === 'sqS', ph = afPh(key, 6), str = ph == null || ph < 0.5 ? 1 : -1;
  const tail = sit ? [[4.4, -1, 2.6], [1.6, -1.6, 4.2], [0.8, -4.4, 4.6], [1.8, -6.6, 3.6]] : [[3.8, -3.2, 2.4], [1.4, -3.6, 3.6], [0.8, -5.2, 3.6], [1.6, -6.2, 2.6]];
  akTail(K, tail.map(([x, y, r]) => [g(x), g(y), r]), O, null, { fur: 1.3, round: 4, seed: 8 });
  if (sit) {
    K.blob([[g(6.8), g(-3), g(2.6), g(2.6)], [g(8.4), g(-4.2), g(1.8), g(2)]], O, { fur: 0.6, round: 5, zone: (x, y) => [C, akCl((x - g(8.2)) / 1) * akCl((y - g(-5)) / 1), 0.1] });
    K.blob([[g(5.6), g(-0.6), g(1.4), g(0.6)], [g(8), g(-0.5), g(1.1), g(0.5)]], Od, { round: 1, rim: false });
    K.blob([[g(9.6), g(-2.8), 2.4, 2]], akRamp('#8a5a30', 3), { round: 1 });                                     // орешек в лапках
    K.limb(g(8.8), g(-3.8), g(9.6), g(-3), 1.2, 1, O);
  } else {
    K.blob([[g(6.6), g(-3.6), g(3.6), g(1.6)]], O, { fur: 0.6, round: 4, zone: (x, y) => [C, akCl((y - g(-2.8)) / 1), 0.1] });
    K.limb(g(4.6), g(-2.4), g(3.6 - str * 0.8), g(-0.3), 1.6, 1.2, Od); K.limb(g(8.4), g(-2.6), g(9.2 + str * 0.8), g(-0.3), 1.3, 1, Od);
  }
  const hx = g(10.4), hy = g(sit ? -5.6 : -4.4);
  K.blob([[hx, hy, g(1.9), g(1.5)], [hx + g(1.4), hy + g(0.4), g(1), g(0.8)]], O, { round: 3, fur: 0.2, zone: (x, y) => [C, akCl((y - hy - 2) / 1) * akCl((x - hx) / 1), 0.1] });
  for (const [ex, dk] of [[-0.8, true], [0.6, false]]) { akEar(K, hx + g(ex) - 2, hx + g(ex) + 2, hx + g(ex), hy - g(2.6), hy - g(1), dk ? Od : O, null); K.P(Math.round(hx + g(ex)), Math.round(hy - g(2.6)) - 1, Od[0]); }
  K.eye(hx + g(0.6), hy - g(0.3), 1.4, [40, 26, 18], [14, 10, 8]);
  K.P(Math.round(hx + g(2.3)), Math.round(hy + g(0.2)), [60, 34, 26]);
  return K.fin(akInk(O));
});

// ---------- Ёж (HEDGE 13×8, клубком HEDGE_BALL 13×7) ----------
afHand(/^hg/, (rows, pal, key) => {
  const [w, h] = akWH(rows), g = v => v * 3, K = akKit(w, h, 0, h), ball = key === 'hgBall', t = akPhK(key, 4);
  const Q = akRamp(pal.q, 5, 0.5), Qd = akRamp(pal.Q, 4), X = akRamp(pal.x, 4, 0.4), F = akRamp(pal.f, 5, 0.4), NOSE = hexToRgb(pal.p || pal.P);
  const spines = (cx, cy, rx, ry, a0, a1, n) => {
    for (let k = 0; k < n; k++) {
      const a = a0 + (a1 - a0) * K.hsh(k * 3.7 + 1), r = 0.25 + K.hsh(k * 1.9) * 0.8, x = cx + Math.cos(a) * rx * r, y = cy + Math.sin(a) * ry * r, L = 3 + K.hsh(k * 5.3) * 2;
      const dx = Math.cos(a - 0.5) * L, dy = Math.sin(a - 0.5) * L * 0.8;
      K.limb(x, y, x + dx * 0.6, y + dy * 0.6, 0.9, 0.7, Qd); K.limb(x + dx * 0.6, y + dy * 0.6, x + dx, y + dy, 0.7, 0.4, X);
    }
  };
  if (ball) { K.blob([[g(6.5), g(-3.4), g(5.8), g(3.2)]], Q, { round: 6, fur: 0.4 }); spines(g(6.5), g(-3.4), g(5.4), g(3), 0, AK_TAU, 70); return K.fin(akInk(Qd)); }
  for (const [x, ph] of [[3.6, 0], [8.4, Math.PI]]) akStub(K, x, -1.4, t, ph, false, F, 1.2, { step: 0.6 });
  K.blob([[g(5.6), g(-3.8), g(5.4), g(3)]], Q, { round: 6, fur: 0.4 });
  spines(g(5.6), g(-4), g(5), g(2.8), Math.PI * 0.85, Math.PI * 2.05, 60);
  K.blob([[g(10.6), g(-2.6), g(2), g(1.6)], [g(12), g(-2), g(1), g(0.8), 0.3]], F, { round: 3, fur: 0.2 });
  K.R(g(12.6) - 2, g(-2.2) - 2, g(12.6) + 3, g(-2.2) + 2, (x, y) => Math.hypot(x + 0.5 - g(12.7), y + 0.5 - g(-2.1)) < 1.3 ? NOSE : null);
  K.eye(g(10.9), g(-3.1), 1.2, [30, 22, 18], [12, 10, 8]);
  K.blob([[g(9.6), g(-4.2), 1.6, 1.4]], F, { round: 1 });
  return K.fin(akInk(Qd));
});

// ---------- Дятел на стволе (PECKER_A/B 6×11): чёрно-белый, красная шапочка; B — голова вперёд, долбит ----------
afHand(/^pk[AB]$/, (rows, pal, key) => {
  const [w, h] = akWH(rows), g = v => v * 3, K = akKit(w, h, 0, h), Y = v => g(v) - h * 3, peck = key === 'pkB', dx = peck ? 1.2 : 0;
  const A = akRamp(pal.a, 5, 0.5), Sd = akRamp(pal.s, 4, 0.35), RD = akRamp(pal.r, 4), BK = akRamp(pal.y, 3);
  K.path([[g(2.6), Y(8.6), 2.8], [g(2.2), Y(10.6), 1.6]], () => A[1]);                                         // хвост-подпорка
  K.blob([[g(2.6), Y(6), g(2), g(3.2)]], A, { round: 5, fur: 0.2, zone: (x, y) => [Sd, akCl((g(1.2) - x) / 1) * akCl((y - Y(3.4)) / 1), 0.15] });
  for (let k = 0; k < 3; k++) K.P(g(1.3), Y(4.6 + k * 1.3), Sd[3]);
  K.blob([[g(3) + g(dx), Y(2.6), g(1.7), g(1.5)]], A, { round: 3, zone: (x, y) => [Sd, akCl((y - Y(3.2)) / 0.8), 0.2] });
  K.blob([[g(2.6) + g(dx), Y(1.2), g(1.6), g(1.1)]], RD, { round: 2 });
  akPoly(K, [[g(4.4) + g(dx), Y(2.2)], [g(6) + g(dx), Y(2.9)], [g(4.4) + g(dx), Y(3.4)]], BK, 0.7, 0.05);
  K.eye(g(3.6) + g(dx), Y(2.5), 1, [30, 26, 30], [12, 10, 12]);
  K.limb(g(3.8), Y(7.8), g(4.6), Y(8.2), 0.7, 0.6, BK); K.limb(g(3.8), Y(5.6), g(4.6), Y(5.8), 0.7, 0.6, BK);    // коготки на коре
  return K.fin(akInk(A));
});

// ---------- Крот из кучки (MOLE_HEAD/2 6×6): бархатный, розовый нос и лапки ----------
afHand(/^mole[12]$/, (rows, pal, key) => {
  const [w, h] = akWH(rows), g = v => v * 3, K = akKit(w, h, 0, h), V = akRamp(pal.v, 5, 0.55), PK = akRamp(pal.P, 3, 0.3), up = key === 'mole2';
  K.blob([[g(3), g(-3.6), g(2.8), g(2.4)]], V, { round: 5, fur: 0.3 });
  K.blob([[g(3), g(-1.6), g(1.2), g(0.9)]], PK, { round: 2 });                                                     // нос-пятачок
  for (const s of [-1, 1]) K.blob([[g(3 + s * 2), g(up ? -1.6 : -0.6), g(1.2), g(0.7), s * 0.4]], PK, { round: 1 });
  for (const s of [-1, 1]) K.P(g(3 + s * 1.1), g(-3.6), [20, 18, 24]);
  return K.fin(akInk(V));
});

// ---------- Дичь wildlife.js: ключ «wl:<вид>[W]:<кадр>» (W — зимний окрас), кадры: i — покой, w — шаг, r — насторожился, f — полёт ----------
const akWl = key => { const [, k, fr] = key.split(':'); return { win: k.endsWith('W'), fr, n: +fr.replace(/\D/g, '') || 0, kind: fr.replace(/\d/g, '') }; };

// Заяц: бурый (зимой белый), длинные уши, светлое брюхо, белый «цветок»-хвостик; столбиком — привстал
afHand(/^wl:hareW?:/, (rows, pal, key) => {
  const [w, h] = akWH(rows), g = v => v * 3, K = akKit(w, h, 0, h), P = pal, F = akWl(key);
  const Hh = akRamp(P.h, 6, 0.5), Hl = akRamp(P.H, 4, 0.35), WH = akRamp(P.w, 3, 0.3), EARt = akRamp(P.e, 3), NOSE = hexToRgb(P.n), D = akRamp(P.d, 4);
  const ears = (x, y, back) => {
    for (const [dx, a, dk] of [[-0.5, back ? 1.2 : -0.25, true], [0.4, back ? 1.0 : 0.1, false]]) {
      const cx = g(x + dx) + Math.sin(a) * 4, cy = g(y) - Math.cos(a) * 4;
      K.R(cx - 10, cy - 10, cx + 10, cy + 10, (px, py) => { const q = K.lit(px, py, [cx, cy, 1.8, 5.4, a]); if (!q) return null; return !dk && K.lit(px, py, [cx, cy + 0.4, 0.7, 4, a]) ? [214, 160, 150] : K.lit(px, py, [cx, cy - 4.4, 1.8, 1.4, a]) ? EARt[1] : K.tone(Hh, (dk ? 0.3 : 0.45) + q.l * 0.5, px, py); });
    }
  };
  if (F.kind === 'up') {
    K.blob([[g(6.6), g(-2.6), g(2.6), g(2.2)], [g(6.8), g(-5), g(1.7), g(2.2)]], Hh, { fur: 0.6, round: 5, zone: (x, y) => [Hl, akCl((x - g(7.2)) / 1) * akCl((y - g(-6)) / 1), 0.12] });
    K.blob([[g(4), g(-2), g(0.8), g(0.8)]], WH, { round: 1 });
    K.blob([[g(6.2), g(-0.5), g(1.6), g(0.5)], [g(8.2), g(-0.5), g(1), g(0.5)]], D, { round: 1, rim: false });
    ears(8, -8.6, F.n % 2);
    K.blob([[g(8), g(-7), g(1.6), g(1.3)]], Hh, { round: 3, fur: 0.2 });
    K.P(g(9.4), g(-6.8), NOSE); K.eye(g(8.4), g(-7.4), 1.2, [60, 40, 26], [16, 12, 10]);
    return K.fin(akInk(Hh));
  }
  const t = F.kind === 'w' ? F.n / 6 * AK_TAU : null, hop = t == null ? 0 : Math.sin(F.n / 6 * Math.PI) * 1.2, dy = -g(hop * 0.4);
  const ear = F.fr === 'i2' || F.fr === 'i3', nose = F.fr === 'i5' ? 1 : 0;
  const s = t == null ? 0 : Math.cos(t);
  K.limb(g(2.6 - s), g(-2) + dy, g(2.4 - s * 1.6), g(-0.4), 1.6, 1.2, Hh, { bias: -0.15 });
  K.blob([[g(5), g(-3.6) + dy, g(4.2), g(2.2)], [g(2.6), g(-2.6) + dy, g(2), g(1.4)]], Hh, { fur: 0.8, round: 5, zone: (x, y) => [Hl, akCl((y - dy - g(-2.6)) / 1) * akCl((x - g(3)) / 1), 0.12] });
  K.blob([[g(0.9), g(-3.8) + dy, g(0.8), g(0.8)]], WH, { round: 1 });
  K.limb(g(7.6 + s), g(-2.4) + dy, g(7.8 + s * 1.6), g(-0.4), 1.2, 1, Hh);
  K.blob([[g(2.4 - s * 1.6), g(-0.4), 2.6, 1.1], [g(8 + s * 1.6), g(-0.4), 2, 1]], D, { round: 1, rim: false });
  ears(10, -7.2 + (ear ? 0.6 : 0) + hop * -0.3, ear);
  K.blob([[g(9.8), g(-6.2) + dy, g(1.9), g(1.5)], [g(11.2), g(-5.8) + dy, g(1), g(0.9)]], Hh, { round: 3, fur: 0.2, zone: (x, y) => [Hl, akCl((y - dy - g(-5.4)) / 1), 0.1] });
  K.P(g(12), g(-6) + dy + nose, NOSE); K.eye(g(10.3), g(-6.8) + dy, 1.3, [60, 40, 26], [16, 12, 10]);
  return K.fin(akInk(Hh));
});

// Пичуги (bird 7×5): круглый воробей с рыжей грудкой; f/r — крылья в полёте; зимой снегирь
afHand(/^wl:birdW?:/, (rows, pal, key) => {
  const [w, h] = akWH(rows), g = v => v * 3, K = akKit(w, h, 0, h), P = pal, F = akWl(key);
  const B = akRamp(P.b, 5, 0.5), Rr = akRamp(P.r, 4, 0.4), T = akRamp(P.t, 3), WG = akRamp(P.W, 4), O = hexToRgb(P.o);
  const peck = F.kind === 'i' && (F.n === 1 || F.n === 4), fly = F.kind === 'f' || F.kind === 'r';
  if (!fly) for (const x of [2.6, 4]) K.limb(g(x), g(-1.2), g(x), g(-0.2), 0.5, 0.5, T);
  akPoly(K, akG([[0, -2.8], [2, -2.6], [2.4, -1.8], [0.4, -2]]), T, 0.5);
  K.blob([[g(3.4), g(-2.4), g(2), g(1.4)]], B, { round: 3, fur: 0.2, zone: (x, y) => [Rr, akCl((x - g(3.6)) / 0.8) * akCl((y - g(-2.6)) / 0.8), 0.1] });
  const hx = g(peck ? 5.6 : 4.8), hy = g(peck ? -2.2 : -3.4);
  K.blob([[hx, hy, g(1.2), g(1.1)]], B, { round: 2 });
  K.P(hx + g(1.2), hy, O); K.P(hx + g(1.2) + 1, hy, O); K.P(hx + g(1.2), hy + 1, O);
  K.eye(hx + 0.8, hy - 0.6, 0.8, [20, 16, 14], [14, 12, 10]);
  if (fly) { const off = F.kind === 'f' ? [-2, -1, 0, 1, 2, 1, 0, -1][F.n % 8] : -1, sp = F.kind === 'r' ? Math.min(3, F.n + 1) : 3; for (const s of [-1, 1]) akPoly(K, [[g(3), g(-2.8)], [g(3 + s * sp * 0.9), g(-2.8 + off * 0.9)], [g(3 + s * sp), g(-2.2 + off)], [g(3.6), g(-2.2)]], WG, 0.6, 0); }
  return K.fin(akInk(B));
});

// Фазан (16×10): медная грудь в крапинку, зелёная голова с красной «маской», белый ошейник, длинный полосатый хвост
afHand(/^wl:pheasant:/, (rows, pal, key) => {
  const [w, h] = akWH(rows), g = v => v * 3, K = akKit(w, h, 0, h), P = pal, F = akWl(key);
  const Bc = akRamp(P.b, 6, 0.5), Bl = akRamp(P.B, 4), Tt = akRamp(P.t, 5), Gg = akRamp(P.g, 5, 0.5), RD = akRamp(P.r, 3), C = akRamp(P.c, 3), L = akRamp(P.l, 3);
  const t = F.kind === 'w' ? F.n / 6 * AK_TAU : null, sn = t == null ? 0 : Math.sin(t), peck = F.fr === 'i2' || F.fr === 'i3' ? 2 : 0;
  for (const [x, s] of [[5.6, sn], [8.2, -sn]]) { K.limb(g(x), g(-2.6), g(x + s), g(-0.3), 0.8, 0.7, L); K.limb(g(x + s) - 1.6, -1, g(x + s) + 1.8, -1, 0.6, 0.6, L); }
  K.path([[g(4.6), g(-5), 3], [g(2.4), g(-5.6), 2.4], [g(0.2), g(-6), 1.6]], (u, e, sd) => (Math.floor(u * 10) % 2 ? Tt[1] : sd > 0 ? Tt[2] : Tt[3]));
  K.blob([[g(7.4), g(-4.2), g(3.6), g(1.9)]], Bc, { round: 5, fur: 0.2, mark: (x, y, v) => K.hsh(Math.floor(x / 2) * 7 + Math.floor(y / 2) * 3) > 0.82 ? Tt[0] : null });
  if (F.kind === 'r') { const sp = 2 + F.n; akPoly(K, [[g(6), g(-5.2)], [g(8), g(-5.6 - sp * 0.4)], [g(9.6 + sp * 0.4), g(-5.8 - sp * 0.6)], [g(9), g(-4.4)]], Bl, 0.6); }
  const dx = g(peck * 0.6), dy = g(peck);
  K.path([[g(9.4), g(-5), 2.8], [g(10.5), g(-6.6) + dy * 0.5, 2.3], [g(10.4) + dx, g(-8) + dy, 2.1]], (u, e) => K.tone(Gg, e ? 0.3 : 0.6, 0, 0));
  K.blob([[g(9.9) + dx * 0.4, g(-5.4) + dy * 0.3, g(0.9), g(0.45), -0.4]], C, { round: 1 });
  K.blob([[g(10.6) + dx, g(-8.6) + dy, g(1.1), g(1)]], Gg, { round: 2 });
  K.blob([[g(11.3) + dx, g(-8.6) + dy, g(0.7), g(0.6)]], RD, { round: 1, rim: false });
  akPoly(K, [[g(11.5) + dx, g(-8.4) + dy], [g(12.8) + dx, g(-8.1) + dy], [g(11.5) + dx, g(-7.8) + dy]], akRamp(P.o, 3), 0.7);
  K.limb(g(10.2) + dx, g(-9.4) + dy, g(9.6) + dx, g(-10) + dy, 0.8, 0.5, Gg);                                       // ушки-перья
  K.eye(g(11.1) + dx, g(-8.8) + dy, 0.9, [200, 160, 60], [14, 10, 8]);
  return K.fin([40, 22, 12]);
});

// Сурок (10×7, столбиком 10×8): песочный, тёмная мордочка; насторожившись — встаёт и свистит
afHand(/^wl:marmot:/, (rows, pal, key) => {
  const [w, h] = akWH(rows), g = v => v * 3, K = akKit(w, h, 0, h), P = pal, F = akWl(key);
  const M = akRamp(P.m, 6, 0.5), Ml = akRamp(P.M, 4, 0.35), N = akRamp(P.n, 3), WH = hexToRgb(P.i);
  const up = h >= 8 || (F.kind === 'r' && F.n > 0) || F.fr === 'i4';
  if (up) {
    K.blob([[g(3.8), g(-2.6), g(2.2), g(2.6)], [g(3.8), g(-5), g(1.7), g(2)]], M, { fur: 0.6, round: 5, zone: (x, y) => [Ml, akCl((x - g(4)) / 1) * akCl((y - g(-6)) / 1), 0.1] });
    K.blob([[g(3.2), g(-0.4), g(1.4), g(0.5)], [g(5), g(-0.4), g(1), g(0.5)]], N, { round: 1, rim: false });
    K.limb(g(4.6), g(-4.4), g(5.4), g(-3.6), 1, 0.9, M);
    K.blob([[g(4.4), g(-7), g(1.6), g(1.3)]], M, { round: 3, zone: (x, y) => [N, akCl((x - g(5.2)) / 0.8), 0, 0.3] });
    K.P(g(5.6), g(-6.4), WH); K.eye(g(4.8), g(-7.4), 1.1, [30, 20, 14], [12, 10, 8]);
    return K.fin(akInk(M));
  }
  const t = F.kind === 'w' ? F.n / 6 * AK_TAU : null, dip = F.fr === 'i1' ? g(1) : 0;
  for (const [x, ph] of [[2.4, Math.PI], [6.6, 0]]) akStub(K, x, -1.2, t, ph, false, N, 1.3, { step: 0.6 });
  K.blob([[g(4.6), g(-2.8), g(4), g(2)]], M, { fur: 0.7, round: 5, zone: (x, y) => [Ml, akCl((y - g(-2)) / 1), 0.1] });
  K.blob([[g(7.6), g(-4.2) + dip, g(1.6), g(1.3)], [g(8.8), g(-3.8) + dip, g(0.8), g(0.8)]], M, { round: 3, zone: (x, y) => [N, akCl((x - g(8.6)) / 0.8), 0, 0.3] });
  K.P(g(9.4), g(-3.4) + dip, WH); K.eye(g(7.9), g(-4.6) + dip, 1.1, [30, 20, 14], [12, 10, 8]);
  return K.fin(akInk(M));
});

// Выдра (14×5, в воде 6×3): гладкая, тёмно-бурая, светлое горлышко; плывёт — видна голова и рябь
afHand(/^wl:otter:/, (rows, pal, key) => {
  const [w, h] = akWH(rows), g = v => v * 3, K = akKit(w, h, 0, h), P = pal, F = akWl(key);
  const O = akRamp(P.o, 6, 0.5), Ol = akRamp(P.O, 4, 0.35), N = hexToRgb(P.n), WT = hexToRgb(P.w);
  if (F.kind === 's') {
    K.blob([[g(3), g(-1.6), g(1.8), g(1.3)], [g(4.2), g(-1.4), g(1.1), g(0.8)]], O, { round: 3, zone: (x, y) => [Ol, akCl((y - g(-1.2)) / 0.8), 0.1] });
    K.P(g(5.2), g(-1.6), N); K.eye(g(3.8), g(-2), 1, [20, 14, 10], [12, 10, 8]);
    if (F.n % 3 !== 2) for (const s of [-1, 1]) K.R(g(3) + s * 6 - 4, -3, g(3) + s * 6 + 4, 0, (x, y) => y === -1 ? [...WT, 0.8] : null, false);
    return K.fin(akInk(O));
  }
  const t = F.kind === 'w' ? F.n / 6 * AK_TAU : null, look = F.kind === 'i' && (F.n === 2 || F.n === 3) || (F.kind === 'r' && F.n % 2) ? g(1) : 0;
  K.path([[g(3), g(-2.4), 2.4], [g(1.2), g(-2.6), 1.8], [g(0.2), g(-3.6), 1]], (u, e) => K.tone(O, e ? 0.3 : 0.55, 0, 0));
  for (const [x, ph] of [[3.4, Math.PI], [10, 0]]) akStub(K, x, -1, t, ph, false, O, 1.3, { step: 0.5 });
  K.blob([[g(6.6), g(-2.2), g(4.4), g(1.4)]], O, { fur: 0.3, round: 4, zone: (x, y) => [Ol, akCl((y - g(-1.6)) / 0.8) * akCl((x - g(8)) / 1), 0.1] });
  K.blob([[g(11.2), g(-3.2) + look, g(1.5), g(1.1)], [g(12.4), g(-3) + look, g(0.9), g(0.7)]], O, { round: 3, zone: (x, y) => [Ol, akCl((y - look - g(-2.6)) / 0.8), 0.1] });
  K.P(g(13.2), g(-3.2) + look, N); K.eye(g(11.6), g(-3.6) + look, 1, [20, 14, 10], [12, 10, 8]);
  return K.fin(akInk(O));
});

// Мшистый олень (24×17): бурый, по спине подушка мха с прядями, рога-веточки в цветах; пасётся — голова к траве
afHand(/^wl:stag:/, (rows, pal, key) => {
  const [w, h] = akWH(rows), K = akKit(w, h, 9, h), P = pal, F = akWl(key), BONE = akRamp(P.a, 5, 0.4);
  const graze = F.kind === 'i' && F.n >= 2 && F.n <= 4, dp = graze ? (F.n === 3 ? 5.5 : 4.6) : 0, lf = F.kind === 'r' ? [0, 1, 2, 1][F.n] * -0.3 : 0;
  const MS = akRamp(P.m, 5, 0.5), ML = akRamp(P.M, 4, 0.4), PI = hexToRgb(P.p), PY = hexToRgb(P.P);
  const f = F.kind === 'w' ? F.n : null;
  akHoof(K, f, { G: akRamp(P.s, 7, 0.5), C: akRamp(P.S, 4, 0.35), HOOF: akRamp(P.d, 3), EAR: [190, 140, 110], IRIS: [60, 34, 20],
    body: [-1, -4.6 + lf, 6.6, 2.4], rump: [-5, -4.8 + lf, 3, 2.4], hump: [3, -5.2 + lf, 3, 2.4], legTop: -3, legs: [-5, 2.6], legGap: 1.2, thigh: 1, shin: 0.5, step: 1.6,
    neck: [3.6, -6 + lf, 5.6, -9.6 + dp + lf, 1.6, 1.2], head: [6.4, -10 + dp + lf, 1.9, 1.4, 0.3 + dp * 0.06], muzzle: [7.9, -9.3 + dp + lf, 1.1, 0.8, 0.5], nose: [8.7, -9.1 + dp + lf, 0.5],
    eye: [6.5, -10.5 + dp + lf, 1.6], ears: [[5.2, -11.2 + dp + lf, 2, -2.5, true], [5.8, -11.4 + dp + lf, 2.2, -2.1, false]], tail: [-7.8, -5.4 + lf, 0.8, 1, 0.4],
    under: (K, g, bob) => {                                                                                         // подушка мха и пряди
      K.blob([[g(-1.4), g(-6.6 + lf), g(5.6), g(1.2)], [g(-4.6), g(-6.3 + lf), g(2.4), g(1)], [g(2.4), g(-6.8 + lf), g(2.4), g(1.1)]], MS, { round: 3, fur: 0, mark: (x, y) => K.hsh(Math.floor(x / 2) * 11 + Math.floor(y / 2) * 5) > 0.7 ? ML[2] : null });
      for (let k = 0; k < 6; k++) K.limb(g(-5.4 + k * 1.8), g(-5.8 + lf), g(-5.6 + k * 1.8), g(-4.6 + lf - (k % 2) * 0.3), 0.8, 0.5, MS);
    },
    horns: (K, g) => {
      const y0 = g(-11.6 + dp + lf);
      akAntler(K, [[g(5.6), y0], [g(5.1), y0 - 6], [g(4.6), y0 - 11]], 1.2, BONE); akAntler(K, [[g(5.2), y0 - 5], [g(3.8), y0 - 7.4]], 0.8, BONE);
      akAntler(K, [[g(6.6), y0], [g(7.3), y0 - 6], [g(8.2), y0 - 10.6]], 1.2, BONE); akAntler(K, [[g(7.2), y0 - 5.4], [g(8.8), y0 - 7]], 0.8, BONE);
      for (const [x, y, c] of [[g(4.6), y0 - 11.6, PI], [g(8.2), y0 - 11, PY], [g(3.6), y0 - 7.8, PY], [g(9), y0 - 7.4, PI]]) K.R(x - 2, y - 2, x + 2, y + 2, (px, py) => { const d = Math.hypot(px + 0.5 - x, py + 0.5 - y); return d < 0.6 ? [250, 240, 200] : d < 1.4 ? c : null; });
    } });
  return K.fin([40, 30, 18]);
});

// Звёздный лис (16×9): ночной синий, светлая грудь, звёздные искры по хвосту; насторожившись — припал
afHand(/^wl:starfox:/, (rows, pal, key) => {
  const [w, h] = akWH(rows), K = akKit(w, h, 7.8, h), P = pal, F = akWl(key), low = F.kind === 'r' && (F.n === 1 || F.n === 2) ? 1.5 : 0;
  akCanine(K, F.kind === 'w' ? F.n : null, { s: 0.42, low, G: akRamp(P.x, 7, 0.5), D: null, C: akRamp(P.X, 4, 0.35), PAW: akRamp(P.K, 3), EAR: [70, 80, 140], IRIS: [248, 240, 192],
    snout: 2.5, ear: 1.2, earTip: akRamp(P.K, 3), tipLen: 6, tail: [[-20, -35, 4], [-28, -33, 5.4], [-36, -29, 5.6], [-42, -25, 4.4]] });
  const tw = F.kind === 'i' ? F.n % 3 : 0, ST = hexToRgb(P['*']), ST2 = hexToRgb(P['+']);
  [[-14, -13], [-11, -15], [-17.5, -11], [-15.5, -9.5], [-12.4, -12]].forEach(([x, y], i) => {                     // искры на хвосте
    const big = (i + tw) % 3 === 0, cx = x, cy = y + low;
    K.P(cx, cy, big ? ST2 : ST); if (big) { K.P(cx - 1, cy, ST); K.P(cx + 1, cy, ST); K.P(cx, cy - 1, ST); K.P(cx, cy + 1, ST); }
  });
  return K.fin([22, 26, 54]);
});

// ---------- Свинья в загоне (render.js pigSpriteHR, 24×16, лапы в (12, 13)): розовая, пятачок, ушки, хвостик-крючок; stage — 1/3, 2/3, взрослая ----------
function akPig(stage, f) {
  const sc = [0.55, 0.75, 1][stage - 1], K = akKit(24, 16, 12, 13), g = v => v * 3 * sc;
  const P = akRamp('#eeaaa8', 7, 0.45), Pd = akRamp('#c47c7c', 5), SN = akRamp('#e090a0', 4), HOOF = akRamp('#6a3a3a', 3), MUD = [120, 82, 52];
  const leg = f ? 1 : -1;
  for (const [lx, d, far] of [[-5, leg, true], [3, leg, true], [-2, -leg, false], [6, -leg, false]]) {
    K.limb(g(lx + d * 0.4), g(-2.4), g(lx + d * 0.6), g(-0.6), 1.9 * sc + 0.6, 1.7 * sc + 0.5, far ? Pd : P, { bias: far ? -0.15 : 0 });
    K.R(g(lx + d * 0.6) - 3, g(-0.8), g(lx + d * 0.6) + 3, 0, (x, y) => Math.abs(x + 0.5 - g(lx + d * 0.6)) < 1.8 * sc + 0.6 ? HOOF[1] : null);
  }
  K.blob([[0, g(-5), g(8.4), g(4.5)], [g(6.6), g(-5.8), g(3.8), g(3.4)]], P, { fur: 0.15, round: 9 * sc + 2, zone: (x, y) => [Pd, akCl((y - g(-1.8)) / 1.2), 0, 0.3] });
  K.R(g(-6), g(-4), g(2), g(-1), (x, y) => ((x - g(-2)) / g(4)) ** 2 + ((y - g(-2.4)) / g(1.4)) ** 2 <= 1 && K.hsh(x * 3 + y * 7) > 0.35 ? [...MUD, 0.55] : null);   // пятно грязи на боку
  K.blob([[g(10.4), g(-5.4), g(1.4), g(1.7)]], SN, { round: 2, fur: 0 });                                          // пятачок
  for (const dy of [-0.6, 0.6]) K.P(Math.round(g(10.9)), Math.round(g(-5.4 + dy)), [130, 60, 66]);
  akPoly(K, [[g(5.6), g(-8.4)], [g(7.6), g(-11.2)], [g(8.8), g(-8.2)]], P, 0.6, 0.02);                              // ушко
  akPoly(K, [[g(6.6), g(-8.6)], [g(7.6), g(-10.4)], [g(8.2), g(-8.6)]], Pd, 0.4, 0);
  K.eye(g(8.6), g(-7.2), sc > 0.7 ? 1.4 : 1.1, [60, 30, 30], [20, 10, 12]);
  K.path([[g(-8.4), g(-6), 0.8], [g(-10), g(-7.6), 0.7], [g(-9.2), g(-8.8), 0.6], [g(-8.6), g(-8), 0.5]], () => Pd[2]);   // хвостик-крючок
  return K.fin([120, 60, 64]);
}

// ---------- Рыба в прыжке (beasts BE_FISH 10×5): серебристо-синяя, розоватый бок, плавники ----------
afHand(/^fish$/, (rows) => {
  const [w, h] = akWH(rows), g = v => v * 3, K = akKit(w, h, 0, h), B = akRamp('#4a7a9a', 6, 0.5), S = akRamp('#c09484', 4), FIN = akRamp('#d03a2c', 3);
  akPoly(K, akG([[0.2, -4.6], [2.2, -2.8], [0.2, -1]]), FIN, 0.6);                                                     // хвост
  K.blob([[g(5.4), g(-2.8), g(4), g(1.7)]], B, { round: 4, fur: 0, zone: (x, y) => [S, akCl((y - g(-2.6)) / 0.8), 0.15], mark: (x, y) => (x + y * 2) % 5 === 0 && y < g(-2.6) ? B[4] : null });
  akPoly(K, akG([[4, -4.2], [6, -5], [6.6, -4.2]]), B, 0.5); akPoly(K, akG([[4.6, -1.4], [5.6, -0.2], [6.2, -1.4]]), akRamp('#e8e2d8', 3), 0.6);
  K.eye(g(8.2), g(-3.2), 1, [230, 220, 180], [16, 20, 30]);
  return K.fin([22, 40, 60]);
});

// ---------- Птицы в полёте: те же позы крыла (flapPose, 8 кадров), что у старых кадров ----------
// крыло-четырёхугольник [плечо, локоть, кончик, задний край] в игровых px: маховые перья веером, кончики темнее
function akWing(K, quad, ramp, tip, o = {}) {
  const pts = akG(quad);
  akPoly(K, pts, ramp, 0.62, 0.004);
  const [[ax, ay], [bx, by], [cx, cy], [dx, dy]] = pts, n = o.n || 5;
  for (let k = 0; k <= n; k++) {                                                                // перья: от кромки к заднему краю
    const t = k / n, sx = ax + (bx - ax) * (0.2 + t * 0.7), sy = ay + (by - ay) * (0.2 + t * 0.7), ex = dx + (cx - dx) * t, ey = dy + (cy - dy) * t;
    K.limb(sx + (ex - sx) * 0.35, sy + (ey - sy) * 0.35, ex, ey, 0.9, 0.6, tip && t < (o.tipK ?? 0.5) ? tip : ramp, { bias: -0.12 });
  }
  K.limb(ax, ay, bx, by, 1.6, 1.2, ramp, { bias: 0.25 });                                         // кромка крыла светлее
}

// Ворона в полёте (22×15): тело, голова с клювом, хвост; крыло вверх → ровно → вниз
function akCrowFly(frame) {
  const K = akKit(22, 15, 0, 0), g = v => v * 3, B = akRamp('#2a2a36', 6, 0.45), GL = akRamp('#4a4a6a', 4), BEAK = akRamp('#cfae58', 4);
  const W6 = flapPose([[7, 8], [15, 8], [14, 1], [4, 2]], [[6, 8], [15, 8], [15, 6], [2, 6]], [[7, 8], [15, 8], [13, 14], [4, 13]], frame, 8);
  const up = W6[2][1] < 6;
  if (!up) akWing(K, W6.map(([x, y]) => [x + 1, y - 0.6]), GL, B, {});                                // дальнее крыло
  akPoly(K, akG([[0.6, 7.4], [5, 7.2], [5, 9.8], [1, 10]]), B, 0.4);                                    // хвост
  K.blob([[g(10), g(8), g(5.6), g(2.5)], [g(15.8), g(6.6), g(2.4), g(2.1)]], B, { round: 5, fur: 0.3, zone: (x, y) => [GL, akCl((g(6.8) - y) / 1), 0.05] });
  akPoly(K, akG([[17.6, 6.2], [20.8, 7.3], [17.6, 7.9]]), BEAK, 0.75, 0.08);
  K.eye(g(16.6), g(6.1), 1.2, [120, 110, 90], [12, 12, 16]);
  akWing(K, W6, B, null, {});
  return K.fin([14, 14, 20]);
}

// Аист/цапля в полёте (30×20): шея вперёд, ноги назад, крыло с тёмными кончиками (o — палитра BE_STORK_FLY/BE_HERON_FLY)
function akBirdFly(o, frame) {
  const K = akKit(30, 20, 0, 0), g = v => v * 3, B = akRamp(o.body, 6, 0.42), BL = akRamp(o.belly, 4), N = akRamp(o.neck, 4, 0.4), TIP = akRamp(o.tip, 4, 0.5), BILL = akRamp(o.bill, 4), LEG = akRamp(o.leg, 3);
  const wing = flapPose([[9, 9], [17, 9], [16, 1], [3, 3]], [[8, 9], [17, 9], [17, 7], [2, 7]], [[9, 11], [16, 11], [14, 19], [5, 18]], frame, 8);
  K.limb(g(6), g(10.6), g(0.6), g(11.8), 1, 0.9, LEG); K.limb(g(6), g(11), g(0.4), g(12.4), 1, 0.9, LEG, { bias: -0.2 });   // ноги назад
  K.blob([[g(12), g(10), g(6), g(2.4)]], B, { round: 5, fur: 0.2, zone: (x, y) => [BL, akCl((y - g(10.6)) / 1), 0.05] });
  K.path([[g(17), g(9.4), 2.6], [g(20.5), g(8.6), 2.2], [g(23.4), g(7.2), 2]], (u, e, sd) => K.tone(N, e ? 0.4 : sd > 0 ? 0.55 : 0.8, 0, 0));
  K.blob([[g(23.8), g(6.8), g(1.3), g(1.05)]], B, { round: 2 });
  akPoly(K, [[g(24.6), g(6.4)], [g(25 + o.beak), g(7.1)], [g(24.6), g(7.6)]], BILL, 0.75, 0.08);
  K.eye(g(24), g(6.4), 1, [40, 30, 34], [14, 12, 14]);
  akWing(K, wing, B, TIP, { n: 6, tipK: 0.45 });
  return K.fin([Math.round(B[0][0] * 0.55), Math.round(B[0][1] * 0.55), Math.round(B[0][2] * 0.6)]);
}
