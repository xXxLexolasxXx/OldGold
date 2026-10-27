'use strict';
// Портреты собеседников кампании — ручной пиксель-арт в шаге Полудницы и легендарного дракона (feedback-pixel-monster-method):
// свой растеризатор в ImageData 72×72 (1 пиксель арта = 1 пиксель экрана, без сглаживания), формы — поля расстояний,
// освещение по нормали поля (тело и лицо — одной формой, швов нет), палитра рампами со сдвигом оттенка
// (тени в холод, свет в тепло), Байер 4×4 на границах тонов, детали — руками по пикселям, обводка в конце по маске.
// Заменяет faces.js: те же ключи (grum … golem) и те же два кадра (0 — глаза открыты, 1 — моргнул).

const PXF_W = 72;
const PXF_B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const PXF_HEX = {};
function pxfRgb(h) { return PXF_HEX[h] || (PXF_HEX[h] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]); }
function pxfMix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
// рампа из 5 тонов: 0 тень … 2 основной … 4 блик; тень уходит в холодный фиолет, свет — в тёплый жёлтый
const PXF_RAMP = {};
function pxfRamp(hex) {
  if (PXF_RAMP[hex]) return PXF_RAMP[hex];
  const b = pxfRgb(hex), r = [];
  const sh = [b[0] * 0.36 + 26, b[1] * 0.26 + 12, b[2] * 0.34 + 34], hi = [Math.min(255, b[0] * 0.5 + 150), Math.min(255, b[1] * 0.5 + 138), Math.min(255, b[2] * 0.4 + 96)];
  r[0] = pxfMix(b, sh, 0.8); r[1] = pxfMix(b, sh, 0.38); r[2] = b; r[3] = pxfMix(b, hi, 0.34); r[4] = pxfMix(b, hi, 0.68);
  return (PXF_RAMP[hex] = r.map(c => c.map(v => Math.round(Math.max(0, Math.min(255, v))))));
}
const pxfClamp = (v, a, b) => v < a ? a : v > b ? b : v;
const pxfHash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// формы: координаты — в «старых единицах» (36×36), kit.oy сдвигает по вертикали; внутри всё ×2 в пиксели
function pxfKit() {
  const W = PXF_W, img = new Uint8ClampedArray(W * W * 4), solid = new Uint8Array(W * W);
  const K = { oy: 0, W };
  const X = x => x * 2, Y = y => (y + K.oy) * 2;
  K.E = (cx, cy, rx, ry) => { cx = X(cx); cy = Y(cy); rx *= 2; ry *= 2; const m = Math.min(rx, ry); return (x, y) => (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * m; };
  K.PL = pts => {
    const P = pts.map(p => [X(p[0]), Y(p[1])]), n = P.length;
    return (x, y) => {
      let d = 1e9, ins = false;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const ax = P[j][0], ay = P[j][1], bx = P[i][0], by = P[i][1];
        if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) ins = !ins;
        const dx = bx - ax, dy = by - ay, t = pxfClamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1), ex = x - ax - dx * t, ey = y - ay - dy * t;
        const e = ex * ex + ey * ey; if (e < d) d = e;
      }
      d = Math.sqrt(d); return ins ? -d : d;
    };
  };
  K.CAP = (x0, y0, x1, y1, r0, r1 = r0) => {
    x0 = X(x0); y0 = Y(y0); x1 = X(x1); y1 = Y(y1); r0 *= 2; r1 *= 2; const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1;
    return (x, y) => { const t = pxfClamp(((x - x0) * dx + (y - y0) * dy) / l2, 0, 1); return Math.hypot(x - x0 - dx * t, y - y0 - dy * t) - (r0 + (r1 - r0) * t); };
  };
  K.RB = (x, y, w, h, r = 0) => { const cx = X(x + w / 2), cy = Y(y + h / 2), hw = w, hh = h; r *= 2; return (px, py) => { const qx = Math.abs(px - cx) - hw + r, qy = Math.abs(py - cy) - hh + r; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r; }; };
  K.U = (...fs) => (x, y) => { let d = 1e9; for (const f of fs) { const v = f(x, y); if (v < d) d = v; } return d; };
  K.SM = (a, b, k = 3) => (x, y) => { const p = a(x, y), q = b(x, y), h = pxfClamp(0.5 + 0.5 * (q - p) / k, 0, 1); return q + (p - q) * h - k * h * (1 - h); };
  K.SUB = (a, b) => (x, y) => Math.max(a(x, y), -b(x, y));
  K.AND = (a, b) => (x, y) => Math.max(a(x, y), b(x, y));
  K.SMOOTH = (f, s = 1.2) => (x, y) => (f(x, y) + f(x + s, y) + f(x - s, y) + f(x, y + s) + f(x, y - s)) / 5;      // скругляет углы многоугольника
  K.GROW = (f, k) => (x, y) => f(x, y) - k * 2;

  K.M = (hex, o = {}) => Object.assign({ ramp: pxfRamp(hex), r: 7, dith: 0.2, bias: 0 }, o);
  const L = (() => { const l = Math.hypot(-0.5, -0.62, 0.62); return [-0.5 / l, -0.62 / l, 0.62 / l]; })();
  // заливка формы f материалом m; освещение по нормали поля, глубина → округлость
  K.fill = (f, m, clip) => {
    const e = 0.9, R = m.r, rp = m.ramp, flat = m.flat && pxfRgb(m.flat);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const cx = x + 0.5, cy = y + 0.5, d = f(cx, cy); if (d >= 0) continue;
      if (clip && clip(cx, cy) >= 0) continue;
      let col;
      if (flat) col = flat;
      else {
        let gx = f(cx + e, cy) - f(cx - e, cy), gy = f(cx, cy + e) - f(cx, cy - e); const gl = Math.hypot(gx, gy) || 1; gx /= gl; gy /= gl;
        const h = pxfClamp(-d / R, 0, 1), s = 1 - h, nz = Math.sqrt(Math.max(0, 1 - s * s));
        const lit = gx * s * L[0] + gy * s * L[1] + nz * L[2];
        let idx = 2 + (lit - 0.55) * (m.k || 3.6) + m.bias;
        if (m.tex) idx += m.tex(cx, cy);
        idx += (PXF_B4[(y & 3) * 4 + (x & 3)] / 16 - 0.47) * m.dith * 2;
        col = rp[pxfClamp(Math.round(idx), 0, 4)];
      }
      const o = (y * W + x) * 4; img[o] = col[0]; img[o + 1] = col[1]; img[o + 2] = col[2]; img[o + 3] = 255; solid[y * W + x] = 1;
    }
  };
  K.px = (x, y, hex, a = 1) => {
    x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= W) return;
    const c = typeof hex === 'string' ? pxfRgb(hex) : hex, o = (y * W + x) * 4;
    if (a >= 1 || !img[o + 3]) { img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2]; img[o + 3] = 255; solid[y * W + x] = 1; }
    else { img[o] = img[o] + (c[0] - img[o]) * a; img[o + 1] = img[o + 1] + (c[1] - img[o + 1]) * a; img[o + 2] = img[o + 2] + (c[2] - img[o + 2]) * a; }
  };
  K.rect = (x, y, w, h, hex) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) K.px(x + i, y + j, hex); };
  K.line = (x0, y0, x1, y1, hex) => {                                                                    // пиксельная линия (Брезенхэм)
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let er = dx + dy;
    for (;;) { K.px(x0, y0, hex); if (x0 === x1 && y0 === y1) break; const e2 = 2 * er; if (e2 >= dy) { er += dy; x0 += sx; } if (e2 <= dx) { er += dx; y0 += sy; } }
  };
  K.get = (x, y) => { const o = (y * W + x) * 4; return img[o + 3] ? [img[o], img[o + 1], img[o + 2]] : null; };
  // обводка: 1 пиксель тёплого тёмного из цвета соседа (не чёрного), снаружи по маске твёрдых
  K.finish = () => {
    const out = new Uint8ClampedArray(img);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      if (solid[y * W + x]) continue;
      let c = null;
      for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < W && solid[ny * W + nx]) { const o = (ny * W + nx) * 4; c = c ? [Math.min(c[0], img[o]), Math.min(c[1], img[o + 1]), Math.min(c[2], img[o + 2])] : [img[o], img[o + 1], img[o + 2]]; } }
      if (!c) continue;
      const o = (y * W + x) * 4; out[o] = c[0] * 0.28 + 14; out[o + 1] = c[1] * 0.22 + 8; out[o + 2] = c[2] * 0.3 + 16; out[o + 3] = 255;
    }
    const cv = document.createElement('canvas'); cv.width = cv.height = W; cv.getContext('2d').putImageData(new ImageData(out, W, W), 0, 0);
    return cv;
  };
  return K;
}

// ——— общие детали лица ———
// мех/волосы: вертикальные пряди — смещение тона по волнистым полосам
function pxfStrands(seed = 0, sc = 1) { return (x, y) => { const w = x * 0.36 * sc + Math.sin(y * 0.16 + x * 0.05 + seed) * 0.9, s = Math.floor(w), fr = w - s; return (s % 3 === 0) ? -0.7 : fr < 0.25 ? 0.35 : 0; }; }
function pxfShoulders(K, col, wide = 0) {
  const sh = K.PL([[1 - wide, 36], [4 - wide, 29], [12, 26], [24, 26], [32 + wide, 29], [35 + wide, 36]]);
  K.fill(K.SMOOTH(sh, 1.6), K.M(col, { r: 9 }));
}
function pxfVest(K, col, rivets) {
  const m = K.M(col, { r: 5 });
  K.fill(K.SMOOTH(K.PL([[7, 36], [9.4, 28.4], [14.4, 26.4], [16.4, 36]]), 1), m);
  K.fill(K.SMOOTH(K.PL([[29, 36], [26.6, 28.4], [21.6, 26.4], [19.6, 36]]), 1), m);
  const b = rivets ? '#d8d0c4' : '#f0c850';
  for (let k = 0; k < 3; k++) { K.px(31, 59 + k * 4 + 0, b); K.px(31, 60 + k * 4, shade_hex(b, -0.4)); K.px(41, 59 + k * 4, b); K.px(41, 60 + k * 4, shade_hex(b, -0.4)); }
}
function shade_hex(h, f) { const c = pxfRgb(h), t = f < 0 ? [0, 0, 0] : [255, 255, 255], a = Math.abs(f); return '#' + pxfMix(c, t, a).map(v => Math.round(v).toString(16).padStart(2, '0')).join(''); }
const pxfH = c => typeof c === 'string' ? c : '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

// голова гнома: уши-лопухи, череп, тень сбоку/свет — одной формой
function pxfHead(K, x, y, rx, ry, skin, skin2) {
  const em = K.M(skin2, { r: 3.5 });
  for (const d of [-1, 1]) {
    K.fill(K.SMOOTH(K.PL([[x + d * (rx - 1), y - 1.8], [x + d * (rx + 4.6), y - 4.2], [x + d * (rx + 0.2), y + 2.6]]), 0.9), em);
    const ear = K.PL([[x + d * (rx - 0.4), y - 0.8], [x + d * (rx + 3.2), y - 3], [x + d * (rx + 0.2), y + 1.4]]);
    K.fill(ear, K.M(skin2, { flat: pxfH(pxfRamp(skin2)[1]) }));
  }
  K.fill(K.E(x, y, rx, ry), K.M(skin, { r: 14, bias: 0.6, k: 2.2 }));
}
function pxfNose(K, x, y, r, col = '#d8906c') {
  K.fill(K.E(x + 0.2, y + r * 0.5, r * 1.05, r * 0.7), K.M(col, { flat: pxfH(pxfRamp(col)[0]) }));
  K.fill(K.E(x, y, r, r * 0.9), K.M(col, { r: r * 1.6 }));
  const X = x * 2, Y = (y + K.oy) * 2, R = r * 2;
  K.px(X - R * 0.62, Y - R * 0.55, pxfH(pxfRamp(col)[4]));                                               // блик
  K.px(X - R * 0.62 + 1, Y - R * 0.55, pxfH(pxfRamp(col)[3]));
  const dk = pxfH(pxfRamp(col)[0]);                                                                      // ноздри
  K.px(X - R * 0.5, Y + R * 0.78, dk); K.px(X + R * 0.34, Y + R * 0.78, dk);
}
// глаза: белок, радужка, зрачок, блик; моргнул — линия с ресницами
function pxfEyes(K, x1, x2, y, f, dx = 0, iris = '#1a0f0a', yy = null) {
  const Y = yy ?? Math.round((y + K.oy) * 2);
  for (const ex of [Math.round(x1 * 2), Math.round(x2 * 2)]) {
    if (f) { K.rect(ex - 2, Y, 5, 1, '#3a2418'); K.px(ex - 3, Y - 1, '#3a2418'); K.px(ex + 3, Y - 1, '#3a2418'); K.rect(ex - 1, Y + 1, 3, 1, '#a8705a'); continue; }
    K.rect(ex - 2, Y - 1, 5, 2, '#f4eee0'); K.rect(ex - 1, Y + 1, 3, 1, '#cfc2ac');
    K.rect(ex - 2, Y - 2, 5, 1, '#3a2418');                                                              // верхнее веко
    const ix = ex - 1 + Math.round(dx * 2);
    K.rect(ix, Y - 1, 2, 2, iris); K.px(ix, Y + 1, shade_hex(iris, 0.2)); K.px(ix, Y - 1, '#ffffff');
  }
}
function pxfBrows(K, x1, x2, y, col, frown = 0, w = 1) {
  const m = K.M(col, { flat: col });
  const a = K.PL([[x1 - 2.4, y - frown * 0.4], [x1 + 1.8, y + frown], [x1 + 1.8, y + frown + w], [x1 - 2.4, y + w - frown * 0.4]]);
  const b = K.PL([[x2 + 2.4, y - frown * 0.4], [x2 - 1.8, y + frown], [x2 - 1.8, y + frown + w], [x2 + 2.4, y + w - frown * 0.4]]);
  K.fill(K.SMOOTH(a, 0.6), m); K.fill(K.SMOOTH(b, 0.6), m);
}

// контур колпака — те же десять фасонов, что у гномов игры
const PXF_TALL = [10.5, 11.5, 9.5, 8.5, 11, 11.5, 8, 10.5, 7.5, 9.5];
function pxfCapPts(cx, b, s, tall, style, K) {
  const pts = []; let px = 0, py = 0;
  const rec = {
    beginPath() {}, closePath() {}, moveTo(x, y) { px = x; py = y; pts.push([x, y]); }, lineTo(x, y) { px = x; py = y; pts.push([x, y]); },
    quadraticCurveTo(cx1, cy1, x, y) { for (let i = 1; i <= 8; i++) { const t = i / 8, u = 1 - t; pts.push([u * u * px + 2 * u * t * cx1 + t * t * x, u * u * py + 2 * u * t * cy1 + t * t * y]); } px = x; py = y; }
  };
  const X = k => cx + k * s * K; rec.moveTo(X(-4.3), b);
  const q = (a1, a2, b1, b2) => rec.quadraticCurveTo(X(a1), b - tall * a2, X(b1), b - tall * b2);
  if (style === 1) { q(-3.2, 0.55, 1.4, 1); q(3.4, 0.5, 4.3, 0); }
  else if (style === 2) { q(-4.8, 0.85, 0.6, 0.9); q(5.6, 0.95, 6.4, 0.35); rec.quadraticCurveTo(X(6.9), b + 0.2, X(5.6), b + 1.4); q(4.9, 0.2, 3.9, 0.45); q(4.5, 0.2, 4.3, 0); }
  else if (style === 3) { q(-4.4, 0.95, 0.6, 1); q(3.8, 1.05, 4.4, 0.62); q(3.2, 0.7, 3.3, 0.45); q(4.5, 0.25, 4.3, 0); }
  else if (style === 4) { q(-4.6, 0.7, -0.4, 0.96); q(3.6, 1.02, 5.8, 0.5); rec.quadraticCurveTo(X(7.6), b - tall * 0.05, X(7.2), b + 5.6); rec.quadraticCurveTo(X(6.2), b + 2, X(4.8), b - tall * 0.34); q(4.7, 0.1, 4.3, 0); }
  else if (style === 5) { q(-3.4, 0.3, 0.4, 0.56); q(-0.8, 0.8, -2.4, 1.02); q(0.8, 0.95, 4.8, 0.5); q(5.6, 0.2, 4.3, 0); }
  else if (style === 6) { q(-7.6, 0.12, -6.4, 0.42); q(-3, 0.78, -0.5, 0.7); rec.lineTo(X(-0.3), b - tall * 0.98); rec.lineTo(X(1.1), b - tall * 0.98); rec.lineTo(X(0.9), b - tall * 0.7); q(4, 0.78, 6.4, 0.42); q(7.6, 0.12, 4.3, 0); }
  else if (style === 7) { q(-3.8, 0.6, 0.4, 0.8); q(3.2, 1.18, 4.8, 0.92); q(5.6, 0.64, 3.4, 0.62); q(2.2, 0.66, 2.8, 0.8); q(4.8, 0.42, 4.3, 0); }
  else if (style === 8) { q(-4.2, 0.78, 1.2, 0.9); q(4.4, 0.7, 4.3, 0); }
  else if (style === 9) { q(-6.6, 0.5, -5.4, 0.92); q(-2.6, 0.56, 0, 0.48); q(2.6, 0.56, 5.4, 0.92); q(6.6, 0.5, 4.3, 0); }
  else { q(-4.4, 0.62, -0.8, 0.88); q(2.4, 1.12, 5.8, 0.86); q(7.4, 0.72, 7.4, 0.42); q(6.2, 0.66, 3.8, 0.7); q(4.6, 0.34, 4.3, 0); }
  return pts;
}
// колпак: тело — одна форма с мягкими складками по нормали, отворот — толстый валик поверх; мох — пятнами
function pxfCap(K, o) {
  const col = o.col, B = o.by ?? 14.6, W = o.w ?? 8.4, st = o.style ?? 0, s = o.dir ?? 1, k = W / 4.3, T = (o.tall ?? PXF_TALL[st]) * 1.3, cx = 18;
  const body = K.SMOOTH(K.PL(pxfCapPts(cx, B, s, T, st, k)), 1);
  const seed = o.moss || parseInt(col.slice(1), 16) % 997;
  const fold = (x, y) => Math.sin((x - 36) * 0.55 * s + (y) * 0.05) * 0.22;
  K.fill(body, K.M(col, { r: W * 1.5, tex: fold, bias: 0.1 }));
  // мох налётом
  const mp = o.moss ? ['#7ab04e', '#4e8a2a'] : [pxfH(pxfRamp(col)[4]), '#5e8e3a'];
  const nm = o.moss ? 46 : 14;
  for (let i = 0; i < nm; i++) {
    const rx = pxfHash(seed, i * 7 + 1), ry = pxfHash(seed, i * 7 + 2), x = cx * 2 + (rx - 0.5) * W * 4.6, y = (B + K.oy) * 2 - ry * T * 2 * 0.95;
    if (body(x + 0.5, y + 0.5) < -1.5) { K.px(x, y, mp[i % 2]); if (i % 3 === 0) K.px(x + 1, y, mp[i % 2]); }
  }
  if (o.band) {
    const y = Math.round((B - 2.6 + K.oy) * 2), x0 = Math.round((cx - W + 0.8) * 2), x1 = Math.round((cx + W - 0.8) * 2);
    for (let x = x0; x < x1; x++) { if (body(x + 0.5, y + 0.5) < 0) { K.px(x, y, o.band); K.px(x, y + 1, o.band); K.px(x, y + 2, shade_hex(o.band, -0.4)); } }
  }
  if (st === 8) { K.fill(K.E(cx + 1.2 * s * k, B - T * 0.92 - 0.6, 2.4, 2.3), K.M(col, { r: 5, bias: 0.5 })); }
  if (st === 9) for (const q of [-5.4, 5.4]) K.fill(K.E(cx + q * k, B - T * 0.92, 1.5, 1.5), K.M(col, { r: 3, bias: 0.5 }));
  const BW = st === 6 ? W * 1.12 : W;
  const brim = K.SMOOTH(K.RB(cx - BW - 0.5, B - 1.6, (BW + 0.5) * 2, 3.2, 1.6), 0.5);
  K.fill(brim, K.M(col, { r: 3.4, bias: 0.25, tex: x => Math.sin(x * 0.7) * 0.15 }));
  if (o.moss || true) { for (let i = 0; i < 6; i++) { const x = (cx - W + pxfHash(seed + 5, i) * W * 2) * 2, y = (B - 1.2 + pxfHash(seed + 6, i) * 2.2 + K.oy) * 2; if (brim(x + 0.5, y + 0.5) < -1) K.px(x, y, o.moss ? '#6aa03e' : '#6a9a3e'); } }
}
// борода: shape — spade (лопатой), fork (раздвоенная), point (клинышком), short
function pxfBeard(K, col, o = {}) {
  const len = Math.min(36, (o.len ?? 32) + 1.5), wid = (o.wid ?? 7) * 1.25, shape = o.shape || 'spade', top = o.top ?? 18.4;
  const tail = shape === 'fork' ? [[18 + wid * 0.7, len], [18, len - 3.4], [18 - wid * 0.7, len]]
    : shape === 'point' ? [[19, len - 1], [18, len], [17, len - 1]]
    : shape === 'short' ? [[18 + wid * 0.5, len - 0.6], [18, len], [18 - wid * 0.5, len - 0.6]]
    : [[18 + wid * 0.6, len - 2.4], [18, len], [18 - wid * 0.6, len - 2.4]];
  const mid = shape === 'point' ? wid * 0.6 : wid + 1.2, my = (top + len) * 0.5 - 1;
  const pts = [[18 - wid - 0.6, top], [18 + wid + 0.6, top], [18 + mid, my], ...tail, [18 - mid, my]];
  const f = K.SMOOTH(K.PL(pts), 1.4);
  K.fill(f, K.M(col, { r: wid * 1.6, tex: pxfStrands(wid, 1), dith: 0.06, bias: 0.3 }));
  return f;
}
function pxfMouth(K, col, o = {}) {
  const y = o.y ?? 22, w = o.w ?? 3.6, Y = Math.round((y + K.oy) * 2);
  if (!o.hide) { K.rect(33, Y, 6, 2, '#4a1a14'); K.rect(34, Y + 2, 4, 1, '#c8706a'); }
  const m = K.M(col, { r: 3.2, tex: pxfStrands(2, 1.4), dith: 0.05 });
  K.fill(K.E(18 - w * 0.85, y - 0.1, w, 1.3), m); K.fill(K.E(18 + w * 0.85, y - 0.1, w, 1.3), m);
  K.fill(K.E(18 - w * 1.5, y + 0.9, 1.1, 0.9), m); K.fill(K.E(18 + w * 1.5, y + 0.9, 1.1, 0.9), m);
}

// гном целиком: тело, голова, борода, лицо, колпак; o — те же настройки, что у faces.js
function pxfGnome(K, f, o) {
  const skin = o.skin || '#e8b890', skin2 = o.skin2 || '#c89470';
  K.oy = 1.6;
  pxfShoulders(K, o.coat, o.wide || 0);
  if (o.vest) pxfVest(K, o.vest, o.rivets);
  if (o.under) K.fill(K.PL([[13, 26], [18, 30.4], [23, 26], [21, 25.4], [18, 27.6], [15, 25.4]]), K.M(o.under, { r: 3 }));
  pxfHead(K, 18, 18.6, 7.2, 6.4, skin, skin2);
  if (o.beard) pxfBeard(K, o.beard, o.bd || {});
  if (o.cheeks) { K.fill(K.E(12.6, 20.4, 1.6, 1), K.M(o.cheeks, { flat: o.cheeks })); K.fill(K.E(23.4, 20.4, 1.6, 1), K.M(o.cheeks, { flat: o.cheeks })); }
  pxfEyes(K, 14.8, 21.2, 17.4, f, o.look || 0, o.iris);
  pxfNose(K, 18, 19.6, o.nose || 2.1, o.noseCol);
  if (o.must) pxfMouth(K, o.must, o.mo || {});
  else { K.rect(33, 45, 6, 1, '#7a3a2a'); }
  if (o.extra) o.extra(K, f);
  if (o.cap) pxfCap(K, o.cap);
  pxfBrows(K, 14.8, 21.2, o.browY || 15.6, o.brow, o.frown || 0, o.browW || 1);
  if (o.over) o.over(K, f);
  K.oy = 0;
}

function pxfGrum(K, f) {
  pxfGnome(K, f, { coat: '#6e1c22', vest: '#8a6a44', skin: '#e0a880', skin2: '#c08060', beard: '#6a4024', bd: { len: 33, wid: 7.4 }, must: '#7a5434',
    brow: '#c8c0b4', frown: -0.8, browW: 1.5, nose: 2.4, look: 0, cap: { col: '#e0a822', style: 2, dir: 1, w: 8.6 },
    extra(K) { K.fill(K.PL([[14, 24], [15.6, 24], [16, 33], [14.6, 32]]), K.M('#9a8a7a', { r: 2 })); },
    over(K, f) {
      K.rect(48, 21, 4, 7, '#efe6cc'); K.rect(51, 21, 1, 7, '#c8bea0'); K.rect(47, 28, 6, 2, '#6a4a1a');
      const fx = f ? 1 : 0; K.rect(49 + fx, 17, 2, 3, '#ffd870'); K.px(50 + fx, 16, '#ffd870'); K.px(50 + fx, 18, '#fff6c8'); K.px(50 + fx, 19, '#fff6c8');
    } });
}
function pxfTan(K, f) {
  pxfGnome(K, f, { coat: '#2a4a8a', wide: 1, skin: '#e8b890', skin2: '#c89470', beard: '#f2eee4', bd: { len: 36, wid: 7.4, top: 18 }, must: '#e8e4d8', mo: { w: 3.2 },
    brow: '#f8f6ee', frown: -0.2, browW: 1.4, nose: 2.2, iris: '#2a3a5a', cap: { col: '#2a4a8a', style: 1, dir: 1, w: 8.4, band: '#f0c848' },
    extra(K) { K.rect(6, 65, 16, 2, '#e8c050'); K.rect(50, 65, 16, 2, '#e8c050'); },
    over(K) { K.fill(K.E(18, 11.8, 1.3, 1.3), K.M('#e03a4a', { r: 2.6 })); K.px(35, 25, '#ffd0d4'); } });
}
function pxfHero(K, f) {
  pxfGnome(K, f, { coat: '#8a1c22', vest: '#c8a030', skin: '#e8bc98', skin2: '#c89878', beard: '#8a5a2a', bd: { len: 31, wid: 6.6 }, must: '#9a6a32',
    brow: '#6a3a1a', frown: 0.3, browW: 1, nose: 2, iris: '#2a3a5a', cap: { col: '#d4a018', style: 0, dir: 1, w: 8.4, band: '#8a1c22' },
    over(K) { K.oy = 0; K.fill(K.SMOOTH(K.PL([[18, 29.6], [18.8, 31.2], [20.6, 31.4], [19.2, 32.4], [19.6, 34], [18, 33], [16.4, 34], [16.8, 32.4], [15.4, 31.4], [17.2, 31.2]]), 0.4), K.M('#f6dc5c', { r: 2 })); } });
}
function pxfElder(K, f) {
  pxfGnome(K, f, { coat: '#5a5a52', vest: '#7a7a6c', skin: '#d8c0a0', skin2: '#b09878', beard: '#e4e2d4', bd: { len: 35, wid: 7, top: 18 }, must: '#d8d6c8', mo: { w: 3.4 },
    brow: '#eceadc', frown: -0.3, browW: 1.1, nose: 2.3, iris: '#2a5a5a', cap: { col: '#4e7e3a', style: 4, dir: -1, w: 8.6, moss: 29, band: '#8a7a5a' },
    extra(K) { for (const [x, y] of [[12.4, 25], [14, 29], [22.6, 27], [21, 32], [16, 33.4]]) { K.rect(Math.round(x * 2), Math.round((y + 1.6) * 2), 2, 2, '#6aa03e'); } for (const [x, y] of [[13, 27], [23, 30], [18, 31]]) K.rect(Math.round(x * 2), Math.round((y + 1.6) * 2), 2, 1, '#4e8a2a'); },
    over(K, f) {
      K.oy = 1.6;
      const g = f ? '#2a6a68' : '#6ae8d8';
      K.fill(K.PL([[18, 29.4], [20.2, 31.6], [18, 34.4], [15.8, 31.6]]), K.M('#4a4a44', { r: 3 }));
      K.fill(K.PL([[18, 30.4], [19.3, 31.6], [18, 33.2], [16.7, 31.6]]), K.M(g, { flat: g }));
      K.rect(36, 65, 1, 4, '#1a2a2a'); K.rect(35, 67, 3, 1, '#1a2a2a');
      if (!f) { for (const [dx, dy] of [[-4, 0], [4, 0], [0, -4], [0, 5]]) K.px(36 + dx, 67 + dy, '#6ae8d8', 0.4); }
    } });
}
function pxfPim(K, f) {
  pxfGnome(K, f, { coat: '#3a5a4a', under: '#f2e8d0', skin: '#e8c0a0', skin2: '#c89c80', beard: '#7a5a3a', bd: { len: 29, wid: 3.6, shape: 'point', top: 21 },
    must: '#7a5a3a', mo: { w: 2.2, y: 21.8 }, brow: '#5a3a24', frown: 0.2, browW: 0.8, nose: 1.8, look: 0.6, iris: '#2a3a2a',
    cap: { col: '#2e5a22', style: 3, dir: -1, w: 7.8, band: '#e8d8a0' },
    extra(K) { K.rect(24, 46, 2, 2, '#3ac87a'); },
    over(K) { K.oy = 1.6; K.fill(K.CAP(24, 13.6, 31, 3.4, 0.9, 0.5), K.M('#f2eee4', { r: 1.6 })); K.fill(K.CAP(26, 9.4, 30.6, 3.4, 1.8, 1.0), K.M('#e0dccc', { r: 2 })); K.line(48, 30, 52, 20, '#8a8a7a'); } });
}
function pxfKremen(K, f) {
  pxfGnome(K, f, { coat: '#b07a5a', wide: 2, vest: '#6a7078', rivets: true, skin: '#e8b890', skin2: '#c89470', beard: '#c86a2a', bd: { len: 31, wid: 7, shape: 'fork' },
    must: '#d8782e', mo: { w: 3.2 }, brow: '#8a3a14', frown: 1.5, browW: 1.5, nose: 2, iris: '#3a2414',
    cap: { col: '#9a9aa6', style: 5, dir: -1, w: 8.4, band: '#6a6a78' },
    extra(K) { K.oy = 1.6; K.fill(K.SMOOTH(K.PL([[16.4, 18], [19.6, 18.6], [20.2, 20.8], [17.4, 21.6], [16, 19.8]]), 0.5), K.M('#d8906c', { r: 3 })); K.rect(35, 39, 4, 1, '#f0e8d0'); K.rect(36, 40, 2, 3, '#f0e8d0'); },
    over(K) { K.rect(25, 35, 5, 1, '#a0402a'); K.px(26, 36, '#a0402a'); } });
}

// кривая Безье в точки (для платков и капюшонов)
function pxfQ(...seg) { const pts = [seg[0]]; let [px, py] = seg[0]; for (let i = 1; i < seg.length; i++) { const q = seg[i]; if (q.length === 2) { pts.push(q); [px, py] = q; continue; } for (let k = 1; k <= 8; k++) { const t = k / 8, u = 1 - t; pts.push([u * u * px + 2 * u * t * q[0] + t * t * q[2], u * u * py + 2 * u * t * q[1] + t * t * q[3]]); } px = q[2]; py = q[3]; } return pts; }
// пиксельное кольцо (очки, серьга)
function pxfRing(K, cx, cy, r, hex) { for (let a = 0; a < 64; a++) K.px(cx + Math.cos(a / 64 * 6.283) * r, cy + Math.sin(a / 64 * 6.283) * r, hex); }

// Бабушка Ягла: платок в цветочек с узелком-кончиком, круглые очки, румяные щёки
function pxfYagla(K, f) {
  pxfShoulders(K, '#7a3a5a');
  for (const [x, y] of [[8, 31], [14, 29.4], [22, 30], [28, 32], [18, 34]]) { K.rect(x * 2, y * 2, 2, 2, '#e8b4d4'); K.px(x * 2 + 1, y * 2 + 1, '#b07898'); }
  const scarf = K.SMOOTH(K.PL(pxfQ([8.4, 26.4], [6.4, 11, 18, 6.4], [29.6, 11, 27.6, 26.4], [23, 27.6], [13, 27.6])), 1);
  K.fill(scarf, K.M('#b04a6a', { r: 8, bias: -0.4 }));
  pxfHead(K, 18, 18.6, 6.4, 6.6, '#e8bc9c', '#c89878');
  K.fill(K.AND(K.E(18, 11.4, 11, 4.4), scarf), K.M('#b04a6a', { r: 7, tex: (x, y) => Math.sin(x * 0.35 + y * 0.2) * 0.25 }));
  K.fill(K.SMOOTH(K.PL([[17, 7.4], [21.4, 1.6], [22, 2.4], [19.6, 8.2]]), 0.5), K.M('#b04a6a', { r: 3 }));
  K.fill(K.SMOOTH(K.PL([[11.2, 14.6], [18, 12], [24.8, 14.6], [23.6, 13.4], [18, 12.6], [12.4, 13.4]]), 0.4), K.M('#6e1830', { flat: '#6e1830' }));
  for (const [x, y] of [[12, 8.6], [17, 6.6], [23, 9], [10, 16], [25.6, 17], [14, 11], [21, 11.4]]) { const X = x * 2, Y = y * 2; K.px(X, Y, '#f0c4e0'); K.px(X + 1, Y, '#e8b4d4'); K.px(X, Y + 1, '#e8b4d4'); K.px(X + 1, Y + 1, '#c890b4'); }
  K.fill(K.SMOOTH(K.PL([[15, 25.6], [21, 25.6], [22.6, 29], [18, 27.4], [13.4, 29]]), 0.5), K.M('#b04a6a', { r: 3 }));
  K.rect(24, 41, 5, 2, '#e89a9a'); K.rect(44, 41, 5, 2, '#e89a9a');
  if (f) pxfEyes(K, 15, 21, 0, 1, 0, '', 36);
  else for (const ex of [30, 42]) { K.rect(ex - 1, 35, 2, 2, '#2a1a10'); K.px(ex - 1, 35, '#8a7060'); }
  pxfBrows(K, 15, 21, 15.2, '#d8d4d0', 0, 0.8);
  pxfRing(K, 30, 35.6, 4.6, '#c8a050'); pxfRing(K, 42, 35.6, 4.6, '#c8a050'); K.rect(35, 35, 2, 1, '#c8a050');
  K.px(27, 33, '#ffffff', 0.7); K.px(39, 33, '#ffffff', 0.7);
  pxfNose(K, 18, 20.2, 1.7, '#d89a80');
  for (let x = 32; x <= 40; x++) { const y = 44 + Math.round(Math.sin((x - 32) / 8 * Math.PI) * 2); K.px(x, y, '#8a3a3a'); }
}
// Жмыха Кремнёвая: седой пучок со шпилькой, серо-синяя шаль с бахромой, поджатые губы
function pxfZhmykha(K, f) {
  pxfShoulders(K, '#7a8aa6', 1);
  for (const x of [4, 8, 12, 24, 28, 32]) { K.rect(x * 2 - 2, 67, 2, 5, '#4a5a76'); K.px(x * 2 - 1, 71, '#6a7a96'); }
  K.fill(K.SMOOTH(K.PL([[12, 26], [18, 33], [24, 26], [22, 25.6], [18, 29.4], [14, 25.6]]), 0.5), K.M('#9aaac6', { r: 3 }));
  K.fill(K.E(18, 6.6, 3.8, 2.8), K.M('#b8bcc6', { r: 5, tex: pxfStrands(3, 1.5) }));
  pxfHead(K, 18, 18, 6.8, 6.8, '#e0b498', '#c09478');
  K.fill(K.SMOOTH(K.PL([[10.8, 17], [11, 11], [15, 8.4], [21, 8.4], [25, 11], [25.2, 17], [23.4, 13.4], [18, 11.6], [12.6, 13.4]]), 0.8), K.M('#c8ccd4', { r: 6, tex: (x, y) => ((Math.floor(x * 0.5 + y * 0.25) % 3) ? 0 : -0.5) }));
  K.line(27, 9, 45, 15, '#6a4a2a'); K.px(26, 9, '#a07a4a');
  pxfEyes(K, 15.2, 20.8, 17.2, f, 0, '#3a4a5a');
  pxfBrows(K, 15.2, 20.8, 14.8, '#a8acb4', 0.7, 0.8);
  pxfNose(K, 18, 19.8, 1.9, '#cc9478');
  K.rect(33, 45, 6, 1, '#9a5a4a'); K.px(32, 46, '#b07868'); K.px(39, 46, '#b07868');
  for (const [x, y, w] of [[23, 39, 3], [47, 39, 3], [24, 41, 2], [46, 41, 2], [27, 46, 2], [43, 46, 2]]) K.rect(x, y, w, 1, '#b08268');
}
// Героиня: золотой колпак-купол с помпоном, две рыжие косы, веснушки
function pxfHeroF(K, f) {
  pxfShoulders(K, '#8a1c22'); pxfVest(K, '#c8a030');
  const braid = (x, y) => (Math.floor(y * 0.5 + (x < 36 ? 0 : 1)) % 2 ? -0.6 : 0.4);
  K.fill(K.CAP(10.6, 17, 9.4, 30, 1.7, 1.5), K.M('#c86a2a', { r: 3, tex: braid, dith: 0.05 }));
  K.fill(K.CAP(25.4, 17, 26.6, 30, 1.7, 1.5), K.M('#c86a2a', { r: 3, tex: braid, dith: 0.05 }));
  K.rect(16, 59, 6, 3, '#e8c050'); K.rect(50, 59, 6, 3, '#e8c050'); K.rect(16, 61, 6, 1, '#a8822a'); K.rect(50, 61, 6, 1, '#a8822a');
  pxfHead(K, 18, 18.6, 6.6, 6.4, '#ecc4a4', '#cca080');
  K.fill(K.SMOOTH(K.PL([[11.4, 17.4], [12, 13.6], [18, 12.4], [24, 13.6], [24.6, 17.4], [22, 14.8], [18, 15.4], [14, 14.8]]), 0.7), K.M('#c86a2a', { r: 4, tex: pxfStrands(1, 1.6), dith: 0.05 }));
  K.rect(24, 41, 5, 2, '#ec9a9a'); K.rect(43, 41, 5, 2, '#ec9a9a');
  for (const [x, y] of [[28, 39], [31, 40], [40, 40], [43, 39], [30, 41], [42, 41]]) K.px(x, y, '#c8704a');
  pxfEyes(K, 14.8, 21.2, 17.6, f, 0, '#2a4a3a');
  pxfBrows(K, 14.8, 21.2, 15.4, '#a04a1a', 0, 0.7);
  pxfNose(K, 18, 19.8, 1.6, '#dca080');
  for (let x = 33; x <= 39; x++) K.px(x, 44 + Math.round(Math.sin((x - 33) / 6 * Math.PI) * 1.6), '#8a3a3a');
  pxfCap(K, { col: '#d4a018', style: 8, dir: 1, w: 8, band: '#8a1c22', by: 13.6 });
  K.fill(K.SMOOTH(K.PL([[18, 29.8], [18.8, 31.4], [20.6, 31.6], [19.2, 32.6], [19.6, 34.2], [18, 33.2], [16.4, 34.2], [16.8, 32.6], [15.4, 31.6], [17.2, 31.4]]), 0.4), K.M('#f6dc5c', { r: 2 }));
}
// голова гоблина в три четверти (нос вправо): голова и нос-морковка — одна форма, уши сзади
function pxfGob(K, f, skin, skin2, eye = '#ffe040', s = 1) {
  const X = x => 17.6 + (x - 17.6) * s, Y = y => 18 + (y - 18) * s;
  const em = K.M(skin2, { r: 3 });
  K.fill(K.SMOOTH(K.PL([[X(11), Y(16.4)], [X(0.4), Y(6.4)], [X(2.6), Y(8.2)], [X(11.4), Y(20)]]), 0.25), em);
  K.fill(K.SMOOTH(K.PL([[X(24.4), Y(15)], [X(33.6), Y(6.6)], [X(25.2), Y(19.4)]]), 0.25), em);
  K.fill(K.PL([[X(9.6), Y(16.4)], [X(3), Y(9)], [X(10.2), Y(18.6)]]), K.M('#b07a6a', { flat: '#b07a6a' }));
  K.fill(K.PL([[X(25.4), Y(15.4)], [X(31.6), Y(9)], [X(25.6), Y(17.6)]]), K.M('#a06a5a', { flat: '#a06a5a' }));
  K.px(X(4.4) * 2, Y(9.6) * 2, pxfH(pxfRamp(skin2)[0])); K.px(X(6.6) * 2, Y(11.6) * 2, pxfH(pxfRamp(skin2)[0]));
  const head = K.E(X(17.6), Y(18), 7.6 * s, 7 * s), nose = K.CAP(X(21), Y(19.2), X(29.4), Y(22.8), 1.6 * s, 0.85 * s);
  K.fill(K.SM(head, nose, 3), K.M(skin, { r: 14, bias: 0.35, k: 2.6 }));
  K.px(X(21) * 2, Y(20.6) * 2, pxfH(pxfRamp(skin)[0]));
  for (const [x, y] of [[12.6, 21.4], [23.4, 13.6], [13.4, 13]]) { K.px(X(x) * 2, Y(y) * 2, pxfH(pxfRamp(skin)[1])); K.px(X(x) * 2 + 1, Y(y) * 2, pxfH(pxfRamp(skin)[1])); K.px(X(x) * 2, Y(y) * 2 - 1, pxfH(pxfRamp(skin)[3])); }
  const ey = Math.round(Y(16.4) * 2);
  for (const ex of [Math.round(X(15.4) * 2), Math.round(X(20.6) * 2)]) {
    if (f) { K.rect(ex - 2, ey, 5, 1, '#1a2a0a'); continue; }
    K.rect(ex - 2, ey - 1, 5, 3, eye); K.rect(ex - 1, ey - 2, 3, 1, eye); K.rect(ex - 1, ey + 2, 3, 1, shade_hex(eye, -0.3));
    K.rect(ex + 1, ey - 1, 1, 3, '#1a0f0a'); K.px(ex - 1, ey - 1, '#ffffff');
  }
  const br = K.M(skin2, { flat: pxfH(pxfRamp(skin2)[0]) });
  K.fill(K.PL([[X(12.6), Y(14.6)], [X(17), Y(15.4)], [X(17), Y(14.2)], [X(13), Y(13.2)]]), br);
  K.fill(K.PL([[X(18.6), Y(15.4)], [X(23.2), Y(14)], [X(23), Y(13)], [X(18.6), Y(14.2)]]), br);
  for (let t = 0; t <= 1; t += 0.12) K.px(X(11.6 + t * 2.8) * 2, Y(19.4 + Math.sin(t * 1.6) * 4.6) * 2, pxfH(pxfRamp(skin)[1]));
}
function pxfGobMouth(K, grin, s = 1) {
  const X = x => Math.round((17.6 + (x - 17.6) * s) * 2), Y = y => Math.round((18 + (y - 18) * s) * 2);
  const w = Math.round((grin ? 8.4 : 6) * s * 2), h = grin ? 4 : 2;
  K.rect(X(13.4), Y(22.8), w, h, '#4a1a1a');
  if (grin) K.rect(X(14.2), Y(22.8) + h - 1, w - 3, 1, '#8a3a3a');
  K.rect(X(14.4), Y(22.8), 2, 2, '#f2eee0'); K.rect(X(19.6), Y(22.8), 2, 3, '#f2eee0');
  if (grin) { K.rect(X(17), Y(22.8), 2, 2, '#f2eee0'); K.rect(X(15.6) + 1, Y(22.8) + 2, 1, 2, '#e0d8c4'); }
}
// Король Шнырь: корона с самоцветами поверх латунных очков, горностай, серьга, фитилёк в зубах
function pxfShnyr(K, f) {
  pxfShoulders(K, '#5a2a7a', 1);
  K.fill(K.SMOOTH(K.PL([[3, 32], [8, 27], [28, 27], [33, 32], [33, 34], [3, 34]]), 0.8), K.M('#f2eee4', { r: 4, tex: (x, y) => pxfHash(x | 0, y | 0) > 0.8 ? -0.6 : 0 }));
  for (const x of [6, 11, 16, 21, 26, 30]) { K.rect(x * 2, 61, 2, 3, '#1a1414'); K.px(x * 2 + 1, 64, '#1a1414'); }
  for (let a = 0.4; a < Math.PI - 0.4; a += 0.03) K.px(36 + Math.cos(a) * 12, 52 + Math.sin(a) * 12, '#f0c848');
  K.fill(K.E(18, 31.4, 1.6, 1.6), K.M('#e03a4a', { r: 3, bias: 0.3 }));
  pxfGob(K, f, '#82b44c', '#5a8634');
  pxfGobMouth(K, 1);
  const g = K.M('#b08040', { r: 2.6 });
  K.fill(K.E(15, 12.6, 2.2, 1.7), g); K.fill(K.E(20.6, 12.6, 2.2, 1.7), g);
  K.fill(K.E(15, 12.6, 1.3, 0.95), K.M('#9ad8e8', { r: 2, bias: 0.4 })); K.fill(K.E(20.6, 12.6, 1.3, 0.95), K.M('#9ad8e8', { r: 2, bias: 0.4 }));
  K.px(28, 24, '#ffffff'); K.px(40, 24, '#ffffff');
  K.fill(K.PL([[10.6, 11], [9.6, 3.4], [13, 7.4], [15.6, 2], [18, 7], [20.6, 2], [23, 7.4], [26, 3.6], [25.2, 11]]), K.M('#f0c848', { r: 4, tex: x => Math.sin(x * 0.9) * 0.3 }));
  K.rect(21, 19, 30, 3, '#c89a28'); K.rect(21, 19, 30, 1, '#f6dc70');
  K.fill(K.E(15.6, 6.8, 1, 1), K.M('#e03a4a', { r: 2, bias: 0.5 })); K.fill(K.E(20.6, 6.8, 0.9, 0.9), K.M('#3ac87a', { r: 2, bias: 0.5 })); K.fill(K.E(18, 9.8, 0.9, 0.9), K.M('#5a8ae8', { r: 2, bias: 0.5 }));
  pxfRing(K, 9, 27, 2.4, '#f0c848');
  K.line(47, 43, 53, 40, '#5a3a1a'); K.px(54, 40, '#ff9a3a'); K.px(54, 39, '#ffe070'); if (!f) K.px(55, 38, '#ffe070', 0.6);
}
// Гоблин Шныря: рваный капюшон из мешковины с заплатой, щербатый оскал
function pxfGoblin(K, f) {
  pxfShoulders(K, '#6a5a4a');
  K.fill(K.CAP(6, 27, 30, 33, 1.1), K.M('#3a2a1a', { r: 2 }));
  const sack = (x, y) => (((x | 0) + (y | 0)) % 2 ? -0.25 : 0.15);
  K.fill(K.SMOOTH(K.PL([[7, 18], [10, 7], [18, 3.6], [26, 7], [29, 18], [27, 26], [9, 26]]), 1), K.M('#5e5048', { r: 8, bias: -0.5, tex: sack }));
  pxfGob(K, f, '#7aa848', '#567e32');
  K.fill(K.SMOOTH(K.PL([[9.6, 12.4], [12, 6.4], [18, 4.4], [24, 6.4], [26.4, 12.4], [22, 9.6], [14, 9.6]]), 0.6), K.M('#5e5048', { r: 6, tex: sack }));
  K.rect(25, 15, 5, 4, '#7a6450'); for (let x = 25; x < 30; x += 2) { K.px(x, 14, '#3a2e28'); K.px(x, 19, '#3a2e28'); }
  K.line(42, 18, 46, 13, '#3a2e28'); K.line(33, 10, 35, 15, '#3a2e28');
  pxfGobMouth(K, 0);
}
// Чемпион гоблинов: шлем-котелок с рогами, лоскутная броня, щит из дверцы бочки, шрам и клык
function pxfChamp(K, f) {
  pxfShoulders(K, '#7c7468', 2);
  K.fill(K.SMOOTH(K.PL([[1, 36], [2, 27], [8, 24.6], [12, 26], [11, 36]]), 1), K.M('#8a8278', { r: 6, bias: 0.2 }));
  K.rect(26, 58, 24, 2, '#5a544c'); K.rect(26, 64, 24, 2, '#5a544c');
  for (const [x, y] of [[4, 28], [7, 27], [15, 30.2], [22, 33.2]]) { K.px(x * 2, y * 2, '#c8bca8'); K.px(x * 2 + 1, y * 2 + 1, '#5a544c'); }
  K.fill(K.CAP(9, 26, 26, 36, 1.4), K.M('#3a2a1a', { r: 2 }));
  K.fill(K.E(33, 32, 6, 6.6), K.M('#5a5a62', { r: 5 }));
  K.fill(K.E(33, 32, 4.9, 5.5), K.M('#845a30', { r: 8, tex: x => (Math.floor(x / 4) % 2 ? -0.35 : 0.1) }));
  K.rect(55, 63, 17, 2, '#3a2a1a'); K.rect(65, 62, 3, 3, '#b0b0b8');
  pxfGob(K, f, '#6e9a40', '#4e7228', '#ffd030', 1.08);
  pxfGobMouth(K, 0, 1.08);
  K.fill(K.PL([[19.8, 23.8], [21, 23.8], [21, 21.2]]), K.M('#f2eee0', { flat: '#f2eee0' }));
  K.line(39, 26, 40, 38, '#3a4a20'); K.line(41, 38, 41, 40, '#3a4a20');
  K.fill(K.SMOOTH(K.PL([[8.4, 12.6], [10, 5], [26, 4.6], [27.6, 12.6]]), 0.8), K.M('#6a6460', { r: 9, bias: 0.3 }));
  K.fill(K.RB(7.6, 11.6, 20.8, 1.9, 0.6), K.M('#4a4440', { r: 3 }));
  for (const x of [10, 14, 18, 22, 26]) { K.px(x * 2, 24, '#c8c2bc'); K.px(x * 2 + 1, 25, '#7a746c'); }
  const horn = K.M('#e8dcc0', { r: 2.4, tex: (x, y) => (Math.floor((x + y) * 0.5) % 3 ? 0 : -0.5) });
  K.fill(K.CAP(11.4, 6.6, 4.8, 2, 1.2, 0.3), horn); K.fill(K.CAP(24.2, 6.4, 30.8, 1.8, 1.2, 0.3), horn);
}
// Тролль: огромная голова на сгорбленных плечах, тяжёлая бровь, нос-картошка, клыки снизу, мох и ягоды
function pxfTroll(K, f) {
  const SK = '#6c9a56', SK2 = '#4a7038', BL = '#a2bc80';
  const hump = K.SMOOTH(K.PL([[-1, 36], [0, 25], [8, 19.6], [28, 19.6], [36, 25], [37, 36]]), 2);
  K.fill(hump, K.M(SK2, { r: 10 }));
  K.fill(K.SMOOTH(K.PL([[6, 36], [10, 27], [26, 27], [30, 36]]), 1.5), K.M(BL, { r: 8, bias: -0.2 }));
  const fur = K.M('#6a4a2c', { r: 4, tex: pxfStrands(5, 1.2), dith: 0.05 });
  K.fill(K.SMOOTH(K.PL([[-1, 36], [0, 31], [12, 33], [14, 36]]), 0.8), fur); K.fill(K.SMOOTH(K.PL([[37, 36], [36, 31], [24, 33], [22, 36]]), 0.8), fur);
  const em = K.M(SK2, { r: 3 });
  K.fill(K.SMOOTH(K.PL([[7.8, 15], [2.4, 11.6], [3.6, 13.4], [7.6, 19]]), 0.6), em); K.fill(K.SMOOTH(K.PL([[28.2, 15], [33.6, 11.6], [32.4, 13.4], [28.4, 19]]), 0.6), em);
  const head = K.E(18, 16.6, 10.6, 11), nose = K.E(18, 21.6, 4.2, 3.8);
  K.fill(head, K.M(SK, { r: 16, bias: 0.1 }));
  const moss = K.M('#5a8a38', { r: 3, tex: (x, y) => pxfHash(x | 0, y | 0) > 0.7 ? 0.6 : 0, dith: 0.3 });
  for (const [x, y, rx, ry] of [[14, 6.6, 3.2, 1.6], [20.4, 6.2, 2.6, 1.4], [24.4, 8.6, 1.8, 1.2], [10.6, 9.4, 1.6, 1.1]]) K.fill(K.E(x, y, rx, ry), moss);
  for (const [x, d] of [[12.6, -1], [16, -0.4], [19.4, 0.6], [22.8, 1.2]]) for (let t = 0; t <= 1; t += 0.1) K.px((x + d * t * 2 + d * t * (1 - t)) * 2, (7 - 4 * t) * 2, '#3e5a2c');
  K.fill(K.E(15.4, 6.2, 0.9, 0.9), K.M('#d8302a', { r: 2, bias: 0.6 })); K.fill(K.E(23.8, 8, 0.8, 0.8), K.M('#d8302a', { r: 2, bias: 0.6 }));
  K.fill(K.SMOOTH(K.PL([[8.4, 14.6], [18, 12.6], [27.6, 14.6], [27, 16.6], [18, 15], [9, 16.6]]), 0.8), K.M(SK, { r: 3, bias: -0.3 }));
  K.rect(19, 33, 34, 1, pxfH(pxfRamp(SK2)[0]));
  if (f) { K.rect(23, 35, 7, 1, '#2a3a1a'); K.rect(42, 35, 7, 1, '#2a3a1a'); }
  else for (const ex of [27, 45]) { K.rect(ex - 2, 34, 5, 2, '#e8d870'); K.rect(ex - 1, 36, 3, 1, '#b8a848'); K.rect(ex, 34, 2, 2, '#1a0f0a'); K.px(ex - 1, 34, '#ffffff'); }
  K.fill(K.E(18.6, 23.4, 4.8, 2.6), K.M(SK2, { flat: pxfH(pxfRamp(SK2)[0]) }));
  K.fill(nose, K.M('#94c46a', { r: 7 }));
  K.px(31, 41, '#e8ffd0'); K.px(32, 41, '#c8e8a0'); K.px(33, 46, '#3a5a2a'); K.px(39, 46, '#3a5a2a');
  K.rect(23, 52, 26, 3, '#2a1a0a');
  const tusk = K.M('#e8e0c0', { r: 2, bias: 0.3 });
  K.fill(K.SMOOTH(K.PL([[12.4, 27.2], [13.6, 22.6], [14.8, 27.2]]), 0.3), tusk); K.fill(K.SMOOTH(K.PL([[21.2, 27.2], [22.4, 22.6], [23.6, 27.2]]), 0.3), tusk);
  K.rect(18, 46, 2, 2, '#4a7038'); K.rect(52, 45, 2, 2, '#4a7038'); K.px(18, 45, '#8ab870'); K.px(52, 44, '#8ab870');
}
// Голем: каменная глыба в мху с грибами, лоб-плита, глаза-щели янтарём, золотая руна-спираль на груди
function pxfGolem(K, f) {
  const ST = '#8a8a84', ST2 = '#62625c', ST3 = '#a8a8a0';
  const rock = (pts, col, b = 0) => K.fill(K.PL(pts), K.M(col, { r: 5, bias: b, dith: 0.3, tex: (x, y) => pxfHash(x >> 1, y >> 1) > 0.85 ? -0.7 : 0 }));
  rock([[-1, 36], [0, 24], [9, 20], [14, 23], [12, 36]], ST2); rock([[37, 36], [36, 24], [27, 20], [22, 23], [24, 36]], ST);
  rock([[10, 36], [12, 25], [24, 25], [26, 36]], ST);
  const rg = f ? '#b88820' : '#f0c040';
  for (let a = 0; a < 9.5; a += 0.08) { const r = 0.3 + a * 0.36; K.px((18 + Math.cos(a) * r) * 2, (31 + Math.sin(a) * r * 0.9) * 2, rg); }
  if (!f) for (let a = 0; a < 9.5; a += 0.3) { const r = 0.6 + a * 0.36; K.px((18 + Math.cos(a) * r) * 2 + 1, (31 + Math.sin(a) * r * 0.9) * 2, '#ffe890', 0.5); }
  rock([[8, 22], [7, 10], [11, 4.6], [25, 4.6], [29, 10], [28, 22], [22, 25], [14, 25]], ST, 0.1);
  K.line(20, 36, 26, 40, '#3a3a36'); K.line(26, 40, 24, 46, '#3a3a36'); K.line(50, 14, 46, 20, '#3a3a36');
  rock([[8.6, 11.4], [27.4, 11.4], [27, 15], [9, 15]], ST3, 0.3);
  K.rect(22, 32, 10, 4, '#2a2a28'); K.rect(40, 32, 10, 4, '#2a2a28');
  if (!f) { K.rect(24, 33, 6, 2, '#ffc040'); K.rect(42, 33, 6, 2, '#ffc040'); K.rect(26, 33, 2, 1, '#fff0b0'); K.rect(44, 33, 2, 1, '#fff0b0'); for (const x of [21, 32, 39, 50]) K.px(x, 34, '#ffc040', 0.35); }
  rock([[16, 17.6], [20, 17.6], [20.4, 21.4], [15.6, 21.4]], ST2, 0.2);
  K.rect(27, 45, 18, 1, '#2a2a28'); K.rect(28, 46, 16, 1, pxfH(pxfRamp(ST)[1]));
  const moss = (x, y, rx, ry) => K.fill(K.E(x, y, rx, ry), K.M('#5a9a3a', { r: 3, dith: 0.35, tex: (a, b) => pxfHash(a | 0, b | 0) > 0.75 ? 0.7 : 0 }));
  moss(14, 5.4, 5.6, 2); moss(23.4, 6, 4, 1.6); moss(4, 23, 4.6, 2); moss(32, 22.6, 4.2, 1.8); moss(27.6, 20.4, 1.8, 1.2); moss(9, 24.6, 2, 1);
  for (const x of [17, 18, 55]) for (let y = 26; y < 34 + (x % 2) * 4; y++) K.px(x, y, (y & 1) ? '#5a9a3a' : '#4a8a2a');
  for (const [x, y] of [[20, 3.8], [33, 21]]) { K.fill(K.E(x, y, 1.5, 1), K.M('#d8302a', { r: 2, bias: 0.4 })); K.px(x * 2 - 1, y * 2 - 1, '#ffffff'); K.px(x * 2 + 1, y * 2, '#ffffff'); K.rect(x * 2 - 1, y * 2 + 2, 2, 2, '#e8e0c8'); }
  K.line(12, 42, 10, 37, '#8ac060'); K.line(14, 42, 15, 36, '#8ac060');
}
// Малгор: капюшон, лица не видно — зелёные глаза в темноте и борода-тень; моргнул — глаза тускнеют
function pxfMalgor(K, f) {
  pxfShoulders(K, '#2a2452', 1);
  K.rect(12, 57, 48, 2, '#6a5ab8'); K.rect(35, 56, 3, 16, '#3a8a30'); K.px(36, 56, '#6ac050');
  const hood = K.SMOOTH(K.PL([[6, 26], [8, 12], [13, 5], [18, 0.6], [23, 5], [28, 12], [30, 26]]), 1.2), face = K.E(18, 17, 6.4, 7.4);
  K.fill(K.SUB(hood, face), K.M('#2a2450', { r: 7, tex: (x, y) => Math.sin(x * 0.45 + Math.abs(x - 36) * 0.2) * 0.35 }));
  K.fill(face, K.M('#07050f', { flat: '#07050f' }));
  K.fill(K.SMOOTH(K.PL([[13.4, 20], [22.6, 20], [21, 28], [18, 31], [15, 28]]), 0.8), K.M('#2e2758', { r: 5, tex: pxfStrands(7, 1.3), dith: 0.05, bias: -0.3 }));
  const eye = f ? '#4a8a30' : '#9cff66';
  for (const ex of [27, 39]) {
    if (!f) { K.rect(ex - 1, 29, 8, 5, '#1c3a14'); K.rect(ex, 30, 6, 3, '#2e6a1e'); }
    K.rect(ex, 31, 6, 2, eye); if (!f) K.rect(ex + 1, 31, 2, 1, '#e8ffd0');
  }
}
// Рассказчик: раскрытая летопись, чернильница с пером и свеча (кадр 1 — пламя качнулось)
function pxfNote(K, f) {
  K.fill(K.PL([[2, 30], [18, 26], [34, 30], [34, 33], [18, 30], [2, 33]]), K.M('#5a3a20', { r: 3 }));
  K.fill(K.SMOOTH(K.PL([[3, 28], [17.6, 24.6], [18, 29], [3, 31]]), 0.4), K.M('#f2e8d0', { r: 6, bias: 0.2 }));
  K.fill(K.SMOOTH(K.PL([[33, 28], [18.4, 24.6], [18, 29], [33, 31]]), 0.4), K.M('#e8dcc0', { r: 6 }));
  for (let k = 0; k < 4; k++) { K.line(11, 57 - k * 2, 27, 53 - k * 2, '#8a7a60'); K.line(42, 53 - k * 2, 60, 57 - k * 2, '#8a7a60'); }
  K.fill(K.E(8, 22, 3.4, 3), K.M('#2a2a34', { r: 6, bias: 0.2 })); K.fill(K.RB(6, 18.6, 4, 1.6, 0.3), K.M('#3a3a48', { r: 2 }));
  K.fill(K.CAP(8.4, 19, 14, 4, 0.5, 0.9), K.M('#f2eee4', { r: 1.6 })); K.fill(K.CAP(10.6, 13, 13.6, 5, 1.1, 0.6), K.M('#e0dccc', { r: 2, tex: (x, y) => ((x + y) | 0) % 2 ? -0.4 : 0.2 }));
  K.line(17, 38, 21, 28, '#6a6a5a');
  K.fill(K.RB(26, 13, 3.6, 10), K.M('#e8e0c8', { r: 4, bias: 0.2 }));
  K.fill(K.RB(24.6, 22.6, 6.4, 1.6, 0.5), K.M('#6a4a2a', { r: 2 }));
  K.px(56, 25, '#2a1a10'); K.px(56, 24, '#2a1a10');
  const fx = f ? 1 : 0;
  K.fill(K.E(27.8 + fx * 0.6, 10.2, 1.2, 2.2), K.M('#ffb040', { flat: '#ffb040' }));
  K.fill(K.E(27.8 + fx * 0.5, 11, 0.7, 1.3), K.M('#ffe070', { flat: '#ffe070' }));
  K.rect(55 + fx, 22, 2, 2, '#fff6c8');
}

// Жабьен (как его модель на карте, zhabpx.js): жёлто-оливковая жаба анфас в буром капюшоне с толстым подшитым краем,
// золотые глаза с поперечным зрачком под тяжёлыми веками, широкий беззубый рот с опущенными уголками, светлая нижняя
// челюсть мягко тает в горле, белые полосы раскраски на темени, золотые кольца у уголка рта, шарф с узлом
// и верх длинного посоха — развилка с бусинами за плечом
function pxfZhab(K, f) {
  const SK = '#8e8e3e', SK2 = '#68682c', BE = '#e8d6b0', CL = '#5c3a24', CL2 = '#3a2416', WO = '#6a4628';
  const cloth = K.M(CL, { r: 7, tex: pxfStrands(3, 0.8), dith: 0.15 });
  // капюшон сзади и плащ на плечах — одной формой
  K.fill(K.SMOOTH(K.PL([[-1, 36], [1, 27], [3, 14], [8, 4], [18, 1], [28, 4], [33, 14], [35, 27], [37, 36]]), 2), cloth);
  // посох за левым плечом (справа от зрителя): развилка и две бусины на шнурке
  const wood = K.M(WO, { r: 2, tex: (x, y) => pxfHash(x >> 1, y >> 2) > 0.8 ? -0.6 : 0 });
  K.fill(K.CAP(31, 36, 32.4, 3.6, 1.1, 0.8), wood);
  K.fill(K.CAP(32.4, 4, 34.6, -0.6, 0.6, 0.4), wood); K.fill(K.CAP(32.2, 4.4, 30, 0, 0.6, 0.4), wood);
  K.line(64, 12, 66, 22, '#a88a5a'); K.rect(65, 22, 3, 3, '#2a2a2e'); K.px(65, 22, '#6a6a72'); K.rect(68, 20, 2, 2, '#2a2a2e');
  for (const y of [40, 44]) K.rect(61, y, 6, 2, '#4a301a');                                         // обмотка
  // плечи и грудь: кожа в вырезе плаща, светлое брюхо с белой руной
  K.fill(K.SMOOTH(K.PL([[8, 36], [10, 27], [26, 27], [28, 36]]), 1.4), K.M(SK, { r: 7 }));
  K.fill(K.E(18, 34.6, 6, 5), K.M(BE, { r: 6 }));
  for (const [x0, y0, x1, y1] of [[32, 64, 36, 69], [40, 64, 36, 69], [36, 69, 36, 72]]) K.line(x0, y0, x1, y1, '#f4f6ea');
  // голова: широкая плоская, глаза-бугры сливаются с ней (smin)
  const head = K.SM(K.E(18, 19.4, 13.4, 8), K.U(K.E(11.4, 13.8, 4.6, 4.4), K.E(24.6, 13.8, 4.6, 4.4)), 2.4);
  K.fill(head, K.M(SK, { r: 12, bias: 0.1, tex: (x, y) => pxfHash(x >> 1, y >> 1) > 0.88 ? -0.8 : pxfHash(x, y) > 0.97 ? 0.6 : 0 }));
  // рот: низко, во всю ширину, уголки опущены (жабья хмурость); над ним светлая губа
  const mY = x => 45 - Math.sin((x - 10) / 52 * Math.PI) * 2 + (x < 16 || x > 56 ? (Math.min(Math.abs(x - 16), Math.abs(x - 56)) * (x < 16 || x > 56 ? 0.45 : 0)) : 0);
  // нижняя челюсть и горло — одно светлое пятно ниже рта, к краю редеет и тает в коже
  const be = pxfRamp(BE);
  for (let y = 40; y < 64; y++) for (let x = 6; x < 66; x++) {
    if (y <= mY(x)) continue;
    const inHead = head(x + 0.5, y + 0.5) < 0, q = ((x + 0.5 - 36) / 18) ** 2 + ((y + 0.5 - 55) / 6) ** 2;
    let w = Math.max(inHead ? 1 : 0, Math.min(1, (1 - q) / 0.9));
    if (y > 51) w = Math.min(w, Math.min(1, (1 - q) / 0.9));
    if (Math.abs(x - 36) > 22) w *= Math.max(0, 1 - (Math.abs(x - 36) - 22) / 6);
    if (w <= 0 || (PXF_B4[(y & 3) * 4 + (x & 3)] + 0.5) / 16 > w) continue;
    const v = 3.4 - (y - mY(x)) / 3.6 + ((PXF_B4[((y + 2) & 3) * 4 + ((x + 1) & 3)] + 0.5) / 16 - 0.5) * 0.9;
    K.px(x, y, be[Math.max(1, Math.min(4, Math.round(v)))]);
  }
  for (let x = 10; x <= 62; x++) { const y = Math.round(mY(x)); K.px(x, y, '#2a1a0a'); K.px(x, y - 1, pxfH(pxfRamp(SK)[4])); }
  // ноздри
  K.px(33, 38, '#2a1a0a'); K.px(39, 38, '#2a1a0a'); K.px(33, 37, pxfH(pxfRamp(SK)[1])); K.px(39, 37, pxfH(pxfRamp(SK)[1]));
  // белые полосы раскраски на темени между глазами и на щеке
  for (const [x, y] of [[31, 30], [35, 29], [39, 30]]) K.line(x, y, x + 1, y + 5, '#f4f6ea');
  K.line(13, 34, 15, 39, '#f4f6ea');
  // золотые кольца у левого уголка рта
  for (const [cx, cy] of [[13, 46], [16, 48], [19, 49]]) { K.px(cx, cy - 1, '#ecd282'); K.px(cx - 1, cy, '#ecd282'); K.px(cx + 1, cy, '#b8963a'); K.px(cx, cy + 1, '#b8963a'); }
  // глаза: золото, поперечный зрачок, блик; моргнул — веко
  for (const ex of [23, 49]) {
    const ey = 28;
    if (f) { for (let x = -5; x <= 5; x++) { K.px(ex + x, ey + 1 + Math.round(Math.abs(x) * 0.25), '#2a1a0a'); for (let y = -4; y <= 0; y++) if (Math.hypot(x, y) < 5) K.px(ex + x, ey + y, pxfH(pxfRamp(SK)[3])); } continue; }
    for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
      const r = Math.hypot(x, y * 1.05); if (r > 4.4) continue;
      K.px(ex + x, ey + y, r > 3.5 ? '#9a6414' : y > 1 ? '#d8901c' : y < -1 ? '#ffd860' : '#f2b428');
    }
    K.rect(ex - 3, ey, 7, 1, '#1a0f0a'); K.rect(ex - 2, ey - 1, 5, 3, '#1a0f0a');
    K.px(ex - 2, ey - 3, '#ffffff'); K.px(ex - 1, ey - 3, '#fff6d0');
    for (let x = -5; x <= 5; x++) K.px(ex + x, ey - 4 + Math.round(Math.abs(x) * 0.3), pxfH(pxfRamp(SK2)[1]));     // тяжёлое веко
    for (let x = -4; x <= 4; x++) K.px(ex + x, ey - 5 + Math.round(Math.abs(x) * 0.3), pxfH(pxfRamp(SK)[2]));
  }
  // капюшон: толстый подшитый край над глазами, складки, лохмотья по бокам
  const rim = K.SUB(K.E(18, 11.4, 15.2, 9.6), K.E(18, 16, 13.4, 8.4));
  K.fill(K.AND(rim, K.RB(0, 0, 36, 13.6)), K.M(CL, { r: 4, bias: 0.15 }));
  K.line(14, 6, 22, 5, pxfH(pxfRamp(CL)[4])); K.line(22, 5, 32, 6, pxfH(pxfRamp(CL)[4])); K.line(40, 5, 50, 5, pxfH(pxfRamp(CL)[3]));
  for (const x of [10, 26, 46, 60]) K.line(x, 8 + (x % 3), x - 1, 14 + (x % 3), pxfH(pxfRamp(CL)[1]));
  K.fill(K.PL([[2.4, 18], [0.4, 26], [2.4, 24], [3.2, 28], [4.6, 21]]), K.M(CL2, { r: 2 }));
  K.fill(K.PL([[33.6, 18], [35.6, 26], [33.6, 24], [32.8, 28], [31.4, 21]]), K.M(CL2, { r: 2 }));
  // шарф на шее с узлом и свисающими концами
  K.fill(K.SMOOTH(K.PL([[8.6, 27.6], [18, 30.4], [27.4, 27.6], [27.8, 29.6], [18, 32.4], [8.2, 29.6]]), 0.6), K.M(CL, { r: 3, tex: pxfStrands(7, 1.6) }));
  K.fill(K.E(21.4, 31, 1.8, 1.4), K.M(CL, { r: 2, bias: 0.3 }));
  K.fill(K.PL([[20.6, 31.6], [22.4, 31.6], [23.6, 36], [21.8, 36]]), K.M(CL2, { r: 2 }));
}
const PXF_DRAW = { grum: pxfGrum, yagla: pxfYagla, pim: pxfPim, tan: pxfTan, shnyr: pxfShnyr, gob: pxfGoblin, zhmykha: pxfZhmykha, kremen: pxfKremen, mrak: pxfMalgor, note: pxfNote, hero: pxfHero, heroF: pxfHeroF, elder: pxfElder, champ: pxfChamp, troll: pxfTroll, golem: pxfGolem, zhab: pxfZhab };
const PXF_CACHE = {};
// data-URL кадра (f: 0 — обычный, 1 — моргнул); '' — портрета нет или рисовать негде
function pxfFaceUrl(who, f) {
  const key = who + f;
  if (PXF_CACHE[key] !== undefined) return PXF_CACHE[key];
  const D = PXF_DRAW[who];
  if (!D || typeof document === 'undefined') return (PXF_CACHE[key] = '');
  try { const K = pxfKit(); D(K, f); PXF_CACHE[key] = K.finish().toDataURL(); } catch (e) { console.error(e); PXF_CACHE[key] = ''; }
  return PXF_CACHE[key];
}
