'use strict';
// СОБРАНО АВТОМАТИЧЕСКИ из tools/buildart (node tools/buildart/build-runtime.js) — правьте исходники там.
// Пиксельные здания ×1 (1 px арта = 1 мировой px): трактир, склад, дома — растеризатор граней, материалы, модели по уровням, адаптер к buildingSprite.
const { innPxSprite, pxSprite, pxPile, PX_HOUSE_NAMES } = (() => {
// ======== bpx.js ========
// Пиксельный растеризатор зданий OldGold, шаг пикселя ×3 (как у нечисти: 1 мировой px = 3 px сетки).
// Здание — набор граней в 3D (мир: X на восток, Y на север, Z вверх; та же косая проекция, что в bmodels.js).
// Каждая грань растеризуется по экранным пикселям с z-буфером; цвет пикселя считает материал по
// координатам (u, v) на грани — так получаются чистые жёсткие пиксели, как при ручной работе.
// В конце — обводка по маске твёрдых пикселей и тёмные линии на стыках граней (дальняя грань темнеет у ближней).

let BK = 3; const BSK = 0.5, BDK = 0.78;
let FINE = 1;   // мелкий растр: геометрия и обводка в FINE раз мельче, узоры материалов — в прежних пикселях (u, v целые)
const BRAY = [-0.5, 1, -0.78];                           // направление взгляда вглубь (ось проекции)
const BLIGHT = (() => { const v = [-0.45, -0.62, 0.65], l = Math.hypot(...v); return v.map(a => a / l); })();
const bhex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const bramp = a => a.map(bhex);
function bhash(x, y = 0, s = 0) {
  let h = (Math.floor(x) * 374761393 + Math.floor(y) * 668265263 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const bcl = (i, n = 5) => i < 0 ? 0 : i > n ? n : i;
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bdith = (x, y) => (BAYER4[((y | 0) & 3) * 4 + ((x | 0) & 3)] + 0.5) / 16;
const bmix = (a, b, t) => [a[0] + (b[0] - a[0]) * t | 0, a[1] + (b[1] - a[1]) * t | 0, a[2] + (b[2] - a[2]) * t | 0];
const bdark = (c, k) => [c[0] * k | 0, c[1] * k | 0, c[2] * k | 0];
const v3 = { cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], norm: a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }, sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add: (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k] };

// ---------- Палитра зданий (рампы: 0 светлый … 5 тёмный) ----------
const BP = {
  ink: bhex('#2a1810'),
  straw: bramp(['#f2d47a', '#dcb85c', '#c29a46', '#a27a34', '#7e5c26', '#58401a']),      // свежая золотая солома
  strawG: bramp(['#d8caa0', '#bcaa7c', '#9e8c5c', '#7e6e44', '#5e5230', '#403820']),     // выгоревшая, серая
  reed: bramp(['#b89a66', '#9a7c4c', '#7c6238', '#604a28', '#46361c', '#2e2412']),       // тёмный камыш
  strawM: bramp(['#d6c070', '#b8a258', '#96843e', '#74662c', '#564c20', '#3a3416']),     // старая, с прозеленью
  shingle: bramp(['#b48c60', '#967048', '#785836', '#5e4428', '#46321c', '#2e2010']),
  tile: bramp(['#e28c5c', '#c86c46', '#aa5234', '#883e26', '#642c1a', '#441a0e']),
  log: bramp(['#c48e5a', '#a47244', '#885a34', '#6a4424', '#50301a', '#36200e']),
  logD: bramp(['#a87a52', '#8a603c', '#704a2c', '#563620', '#402616', '#2a180c']),
  plank: bramp(['#bc9a6c', '#9e7e54', '#80643e', '#664c2e', '#4e3820', '#342410']),
  plankB: bramp(['#8ea0a8', '#728690', '#5a6c76', '#46565e', '#344048', '#242c32']),     // крашеные доски, выцветшая синь
  plaster: bramp(['#f8f0da', '#ecdfc2', '#d8c8a6', '#bcaa86', '#9a8864', '#7a6a4c']),
  plasterW: bramp(['#fbf8ee', '#eeeadc', '#dad4c0', '#bcb49e', '#9a927c', '#78705c']),   // белёная
  stone: bramp(['#b8b4a6', '#9e9a8c', '#848072', '#6a6658', '#524e42', '#38352c']),
  shroom: bramp(['#f67a5c', '#dc5040', '#b83828', '#90281e', '#661a16', '#42100e']),
  shroomB: bramp(['#8ab0d8', '#5e88b8', '#416690', '#2e4a6c', '#20344c', '#142232']),
  purple: bramp(['#b48ad8', '#8c62b4', '#684690', '#4a306a', '#32204a', '#1e1230']),
  stoneW: bramp(['#c8c0ac', '#aca492', '#908878', '#746c5e', '#5a5446', '#403c30']),     // тёплый бут
  brick: bramp(['#c88060', '#aa644a', '#8e4e3a', '#703c2a', '#54281a', '#3a1a10']),
  beam: bramp(['#5c3c24', '#48301a', '#36220f', '#24160a']),
  glass: bramp(['#fff4b8', '#ffd468', '#eaa838', '#b87820']),                            // тёплый свет
  glassD: bramp(['#9ab4c6', '#6a889c', '#4a6478', '#324656']),                           // дневное стекло
  iron: bramp(['#9a9aa2', '#6e6e78', '#4c4c54', '#303036']),
  grass: bramp(['#a4d060', '#7eae46', '#5c8c34', '#426a26']),
  moss: bramp(['#9ab850', '#7a9a3c', '#5c7c2c', '#44601e']),
  red: bramp(['#e05848', '#c03c30', '#962a22', '#6a1c16']),
  green: bramp(['#78b058', '#509040', '#386c2c', '#264c1e']),
  blue: bramp(['#6a9ad0', '#4a78b0', '#345a8a', '#243e60']),
  cloth: bramp(['#e8d8b0', '#ccb888', '#a89460', '#847040']),
  white: bramp(['#ffffff', '#e4e0d4', '#bcb8ac', '#908c80']),
  gold: bramp(['#ffe070', '#e8b838', '#b88420', '#805810']),
  rope: bramp(['#d8c088', '#b49a60', '#8c7444']),
};

// ---------- Сетка ----------
class BGrid {
  constructor(W, H, ox, oy) {
    this.W = W; this.H = H; this.ox = ox; this.oy = oy;
    this.d = new Uint8ClampedArray(W * H * 4);
    this.z = new Float32Array(W * H).fill(1e9);
    this.f = new Int32Array(W * H).fill(-1);
    this.nf = 0; this.rot = 0; this.LD = 0;
  }
  // локальные координаты модели → мир (как toW в bmodels.js: при rot=1 фасад смотрит на восток)
  W3(p) { return this.rot ? [this.LD - p[1], p[0], p[2]] : p; }
  sx(X, Y) { return this.ox + (X + Y * BSK) * BK * FINE; }
  sy(Y, Z) { return this.oy - (Y * BDK + Z) * BK * FINE; }
  depth(X, Y, Z) { return -0.5 * X + Y - 0.78 * Z; }
  put(x, y, c, z, f) {
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return;
    const i = y * this.W + x;
    if (z > this.z[i]) return;
    this.z[i] = z; this.f[i] = f;
    const j = i * 4; this.d[j] = c[0]; this.d[j + 1] = c[1]; this.d[j + 2] = c[2]; this.d[j + 3] = 255;
  }
  // грань: многоугольник (выпуклый) в локальных координатах; U, V — оси текстуры (единичные, локальные);
  // материал mat(u, v, F) → цвет или null; u, v в пикселях сетки от первой вершины.
  face(pts, U, V, mat, o = {}) {
    const fid = this.nf++;
    const P3 = pts.map(p => this.W3(p)), Uw = this.W3d(U), Vw = this.W3d(V);
    const S = P3.map(p => [this.sx(p[0], p[1]), this.sy(p[1], p[2])]);
    let n = v3.norm(v3.cross(Uw, Vw));
    if (v3.dot(n, BRAY) > 0) n = [-n[0], -n[1], -n[2]];
    const nl = v3.dot(n, BLIGHT);
    const li = o.li != null ? o.li : nl > 0.55 ? 0 : nl > 0.25 ? 1 : nl > -0.5 ? 2 : 3;
    const Mu = [(Uw[0] + Uw[1] * BSK) * BK * FINE, -(Uw[1] * BDK + Uw[2]) * BK * FINE];
    const Mv = [(Vw[0] + Vw[1] * BSK) * BK * FINE, -(Vw[1] * BDK + Vw[2]) * BK * FINE];
    const det = Mu[0] * Mv[1] - Mu[1] * Mv[0];
    if (Math.abs(det) < 1e-6) return;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const s of S) { x0 = Math.min(x0, s[0]); x1 = Math.max(x1, s[0]); y0 = Math.min(y0, s[1]); y1 = Math.max(y1, s[1]); }
    let area = 0;
    for (let i = 0; i < S.length; i++) { const a = S[i], b = S[(i + 1) % S.length]; area += a[0] * b[1] - b[0] * a[1]; }
    const sg = area >= 0 ? 1 : -1;
    const F = Object.assign({ li, nl, n, fid }, o.F || {});
    const O = P3[0], dz = o.dz || 0;
    const px0 = Math.max(0, Math.floor(x0)), px1 = Math.min(this.W - 1, Math.ceil(x1)), py0 = Math.max(0, Math.floor(y0)), py1 = Math.min(this.H - 1, Math.ceil(y1));
    for (let py = py0; py <= py1; py++) {
      const cy = py + 0.5;
      for (let px = px0; px <= px1; px++) {
        const cx = px + 0.5;
        let inside = true;
        for (let i = 0; i < S.length && inside; i++) {
          const a = S[i], b = S[(i + 1) % S.length];
          if (sg * ((b[0] - a[0]) * (cy - a[1]) - (b[1] - a[1]) * (cx - a[0])) < -1e-6) inside = false;
        }
        if (!inside) continue;
        const dx = cx - S[0][0], dy = cy - S[0][1];
        const a = (dx * Mv[1] - dy * Mv[0]) / det, b = (Mu[0] * dy - Mu[1] * dx) / det;
        let c;
        if (FINE === 1) c = mat(a * BK, b * BK, F);
        else { const ua = a * BK, vb = b * BK, uf = Math.floor(ua), vf = Math.floor(vb); F.fu = ua - uf; F.fv = vb - vf; F.fx = px; F.fy = py; c = mat(uf, vf, F); }   // fu, fv — доля внутри мирового пикселя: материалы рисуют по ней мелкую фактуру
        if (!c) continue;
        const X = O[0] + a * Uw[0] + b * Vw[0], Y = O[1] + a * Uw[1] + b * Vw[1], Z = O[2] + a * Uw[2] + b * Vw[2];
        this.put(px, py, c, this.depth(X, Y, Z) + dz, fid);
      }
    }
  }
  W3d(v) { return this.rot ? [-v[1], v[0], v[2]] : v; }
  // «плакат»: рисунок в экранных пикселях с одной глубиной (реквизит); draw(P) где P(x, y, col)
  sprite(at, draw, dz = 0) {
    const p = this.W3(at), z = this.depth(p[0], p[1], p[2]) + dz, fid = this.nf++;
    const bx = Math.round(this.sx(p[0], p[1])), by = Math.round(this.sy(p[1], p[2]));
    const k = (this.spk || 1) * FINE;   // мелкий шаг пикселя (BK > 1): реквизит, нарисованный в пикселях ×1, ставим блоками k×k — размер тот же
    if (k === 1) draw((x, y, c) => c && this.put(bx + x, by + y, c, z, fid), bx, by);
    else draw((x, y, c) => { if (c) for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) this.put(bx + x * k + i, by + y * k + j, c, z, fid); }, bx, by);
  }
  // обводка снаружи (тёплый тёмный) и тёмные линии на стыках: дальний пиксель рядом с ближней чужой гранью темнеет
  finish(o = {}) {
    const { W, H, d, z, f } = this, ink = o.ink || BP.ink, mark = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (f[i] < 0) continue;
      let dark = 0;
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (f[j] < 0 || f[j] === f[i]) continue;
        if (z[i] - z[j] > (o.step ?? 1.2)) dark = Math.max(dark, 1);
      }
      if (dark) mark[i] = 1;
    }
    for (let i = 0; i < W * H; i++) if (mark[i]) { const j = i * 4; d[j] = d[j] * 0.62 | 0; d[j + 1] = d[j + 1] * 0.6 | 0; d[j + 2] = d[j + 2] * 0.58 | 0; }
    if (o.outline !== false) {
      const out = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (f[i] >= 0) continue;
        if ((x > 0 && f[i - 1] >= 0) || (x < W - 1 && f[i + 1] >= 0) || (y > 0 && f[i - W] >= 0) || (y < H - 1 && f[i + W] >= 0)) out.push(i);
      }
      for (const i of out) { const j = i * 4; d[j] = ink[0]; d[j + 1] = ink[1]; d[j + 2] = ink[2]; d[j + 3] = 255; }
    }
  }
  toCanvas() {
    const cv = document.createElement('canvas'); cv.width = this.W; cv.height = this.H;
    const c = cv.getContext('2d'), im = c.createImageData(this.W, this.H);
    im.data.set(this.d); c.putImageData(im, 0, 0);
    return cv;
  }
}

// ---------- Материалы ----------
// Все материалы: mat(u, v, F) → [r,g,b] | null. u, v — пиксели сетки. F.li — базовый сдвиг рампы по свету.

// Солома: пряди вдоль ската (v — вниз от конька), ряды-«курсы» с тенью, рваная бахрома за свесом (v > F.L).
function matThatch(R, o = {}) {
  const course = o.course || 16, fr = o.fringe ?? 7;
  return (u, v, F) => {
    const L = F.L, t = v / L;
    // пряди: колонки шириной 1–3 px, каждая со своим тоном; изредка глубокая борозда на всю длину
    const cw = 1 + ((bhash(Math.floor(u / 3), 0, 4) * 3) | 0), col = Math.floor(u / cw);
    const hv = bhash(col, cw, 7);
    if (v > L) {                                                   // бахрома: рваные концы прядей
      const len = fr * (0.3 + bhash(col, 1, 5) * 0.7);
      if (v > L + len) return null;
      return R[bcl(F.li + 2 + (hv < 0.4 ? 1 : 0) + (v > L + len - 2 ? 1 : 0))];
    }
    let i = F.li;
    if (hv < 0.2) i -= 1; else if (hv > 0.72) i += 1;
    if (bhash(col, 2, 14) < 0.07) i += 2;                           // борозда
    // слои-курсы: каждая ступень имеет светлую кромку сверху и тень под собой
    const cv = (v + bhash(Math.floor(u / 9), 0, 8) * 5) % course;
    if (cv < 2) i += 2; else if (cv < 3.5) i += 1; else if (cv > course - 2.5) i -= 1;
    // градиент: светлее к коньку, темнее к свесу, с дизерингом на границах
    const gsh = t * 2.2 - 0.6 + (bdith(u, v) - 0.5) * 0.9;
    i += gsh > 1.5 ? 1 : gsh < -0.3 ? -1 : 0;
    if (bhash(u, v, 3) < 0.04) i += 1;
    if (F.cap && v < F.cap) {                                       // конёк: уплотнённый валик, прошитый прутьями
      i = F.li + (v < 1.5 ? -1 : v > F.cap - 2 ? 2 : 0);
      const s = ((u % 12) + 12) % 12;
      if (s < 1.5 && v > 1.5 && v < F.cap - 1) i = 5;
    }
    if (o.moss && t > 0.25) {                                       // мох пятнами: ячейки-пятна с рваным краем
      const mcx = Math.floor(u / 22), mcy = Math.floor(v / 14);
      for (let j = -1; j <= 0; j++) for (let k = -1; k <= 0; k++) {
        const gx = mcx + k, gy = mcy + j;
        if (bhash(gx, gy, 15) > 0.3) continue;
        const px = (gx + bhash(gx, gy, 16)) * 22, py = (gy + bhash(gx, gy, 17)) * 14, rx = 6 + bhash(gx, gy, 18) * 8, ry = 3 + bhash(gx, gy, 19) * 4;
        const d = Math.hypot((u - px) / rx, (v - py) / ry) + (bhash(u, v, 20) - 0.5) * 0.35;
        if (d < 1) return BP.moss[bcl(F.li + (d < 0.5 ? 0 : 1) + (bhash(u, v, 21) < 0.2 ? 1 : 0), 3)];
      }
    }
    return R[bcl(i)];
  };
}
// Грибная шляпка: красная с кремовыми пятнами (u — по дуге, v — по меридиану от макушки)
function matShroom(R, o = {}) {
  const S = o.spot || BP.cloth;
  return (u, v, F) => {
    let i = F.li + (v / F.L > 0.7 ? 1 : 0) + (v / F.L < 0.2 ? -1 : 0);
    const gx = Math.floor(u / 16), gy = Math.floor(v / 12);
    for (let j = -1; j <= 0; j++) for (let k = -1; k <= 0; k++) {
      const cx = gx + k, cy = gy + j;
      if (bhash(cx, cy, 25) > 0.55) continue;
      const px = (cx + 0.2 + bhash(cx, cy, 26) * 0.6) * 16, py = (cy + 0.2 + bhash(cx, cy, 27) * 0.6) * 12, r = 2.5 + bhash(cx, cy, 28) * 3.5;
      const d = Math.hypot(u - px, (v - py) * 1.1);
      if (d < r) return S[bcl((d > r - 1 ? 1 : 0) + (v - py > 0 ? 1 : 0) + (F.li > 0 ? 1 : 0), 3)];
    }
    if (bhash(u, v, 29) < 0.04) i += 1;
    return R[bcl(i)];
  };
}
// Срез соломы на свесе: торцы прядей
function matThatchCut(R) {
  return (u, v, F) => R[bcl(F.li + 2 + (bhash(Math.floor(u / 2), Math.floor(v / 2), 13) < 0.35 ? 1 : 0) + (v > F.T - 2 ? 1 : 0))];
}
// Дранка (деревянные пластины) — рядами, в шахмат
function matShingle(R, rh = 8, sw = 7) {
  return (u, v, F) => {
    const row = Math.floor(v / rh), st = row % 2 ? Math.floor(sw / 2) : 0, su = Math.floor((u + st) / sw), vv = v - row * rh, uu = ((u + st) % sw + sw) % sw;
    let i = F.li;
    const h = bhash(su, row, 21); if (h < 0.2) i -= 1; else if (h > 0.82) i += 1;
    if (uu < 1) i += 2; else if (vv >= rh - 1) i += 2; else if (vv >= rh - 2) i += 1; else if (vv < 1) i -= 1;
    if (v / F.L > 0.8) i += 1;
    return R[bcl(i)];
  };
}
// Черепица: ряды выпуклых полукруглых плиток
function matTile(R, rh = 7, tw = 8) {
  return (u, v, F) => {
    const row = Math.floor(v / rh), st = row % 2 ? Math.floor(tw / 2) : 0, tu = ((u + st) % tw + tw) % tw, vv = v - row * rh, su = Math.floor((u + st) / tw);
    let i = F.li;
    if (bhash(su, row, 31) < 0.15) i += 1;
    if (tu < 2) i -= 1; else if (tu >= tw - 2) i += 1;
    if (vv >= rh - 1) i += 2; else if (vv >= rh - 2) i += 1;
    if (tu === 0) i += 1;
    return R[bcl(i)];
  };
}
// Брёвна: горизонтальные венцы со светлым верхом и тёмной щелью
function matLogs(R, lh = 13) {
  return (u, v, F) => {
    const row = Math.floor(v / lh), t = (v - row * lh) / lh;
    let i = F.li;
    if (t < 0.22) i -= 1; else if (t > 0.62) i += 1;
    if (t > 0.9) i += 2;
    if (t < 0.08) i += 1;
    const g = bhash(Math.floor(u / 7), row, 41);
    if (g < 0.18 && t > 0.3 && t < 0.6) i += 1;
    if (bhash(u, v, 42) < 0.03) i += 1;
    if (F.h && v > F.h - 8) i += 1;
    return R[bcl(i)];
  };
}
// Доски: вертикальные (ver) или горизонтальные
function matPlank(R, pw = 9, ver = true) {
  return (u, v, F) => {
    const a = ver ? u : v, b = ver ? v : u, k = Math.floor(a / pw), aa = ((a % pw) + pw) % pw;
    let i = F.li;
    const h = bhash(k, 0, 51); if (h < 0.25) i -= 1; else if (h > 0.8) i += 1;
    if (aa < 1) i += 2; else if (aa === 1) i -= (h > 0.4 ? 1 : 0);
    if (bhash(Math.floor(b / 5), k, 52) < 0.12 && aa > 2 && aa < pw - 1 && b % 5 < 2) i += 1;      // волокно
    if (F.h && v > F.h - 8) i += 1;
    return R[bcl(i)];
  };
}
// Штукатурка с фахверком: столбы, обвязка, раскосы; F.w, F.h — размер грани
function matFrame(R, o = {}) {
  const bay = o.bay || 30, bw = o.bw || 4, B = BP.beam;
  return (u, v, F) => {
    const w = F.w, h = F.h;
    if (!o.noLow && v < (o.low ?? 0)) return matStoneFn(u, v, F);
    const inBeam = (() => {
      if (v < bw || v > h - bw - 1) return true;
      if (u < bw || u > w - bw - 1) return true;
      const n = Math.max(1, Math.round(w / bay)), bwid = w / n, k = Math.floor(u / bwid), lu = u - k * bwid;
      if (lu < bw / 2 || lu > bwid - bw / 2) return true;
      if (o.mid && Math.abs(v - h * 0.55) < bw / 2) return true;
      if (o.brace !== false && (k % 2 === (o.braceOdd ? 1 : 0))) {
        const t = (v - (o.low ?? 0)) / (h - (o.low ?? 0)), bx = (o.braceX ? bwid - t * bwid : t * bwid);
        if (Math.abs(lu - bx) < bw * 0.7) return true;
      }
      return false;
    })();
    if (inBeam) return B[bcl(F.li === 0 ? 0 : 1, 3) + (bhash(u, v, 61) < 0.15 ? 1 : 0)];
    let i = F.li;
    if (bhash(u, v, 62) < 0.07) i += 1;
    if (v > h - bw - 6 || u > w - bw - 3) i += 1;                     // тень под обвязкой и у столба
    return R[bcl(i)];
  };
  function matStoneFn(u, v, F) { return matStone(o.stoneR || BP.stone)(u, v, F); }
}
// Бутовый камень: ячейки с дрожанием, швы тёмные, верх камня светлее
function matStone(R, cw = 12, ch = 8) {
  return (u, v, F) => {
    const cx = Math.floor(u / cw), cy = Math.floor(v / ch);
    let best = 1e9, second = 1e9, id = 0, by = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const gx = cx + i, gy = cy + j, px = (gx + 0.2 + bhash(gx, gy, 71) * 0.6) * cw, py = (gy + 0.2 + bhash(gx, gy, 72) * 0.6) * ch;
      const dd = Math.hypot((u - px) * 0.8, (v - py) * 1.2);
      if (dd < best) { second = best; best = dd; id = gx * 131 + gy; by = py; } else if (dd < second) second = dd;
    }
    let i = F.li;
    if (second - best < 1.4) return R[bcl(i + 3 + (bhash(u, v, 73) < 0.3 ? 1 : 0))];
    const h = bhash(id, 0, 74); if (h < 0.25) i -= 1; else if (h > 0.75) i += 1;
    if (v > by + 1.5) i += 1; else if (v < by - 2 && second - best > 3) i -= 1;
    if (bhash(u, v, 75) < 0.05) i += 1;
    if (F.h && v > F.h - 7) i += 1;
    return R[bcl(i)];
  };
}
// Кирпич
function matBrick(R, bh = 6, bw = 13) {
  return (u, v, F) => {
    const row = Math.floor(v / bh), st = row % 2 ? Math.floor(bw / 2) : 0, uu = ((u + st) % bw + bw) % bw, vv = v - row * bh;
    let i = F.li;
    if (uu < 1 || vv < 1) return R[bcl(i + 3)];
    if (bhash(Math.floor((u + st) / bw), row, 81) < 0.3) i += 1;
    if (vv === 1) i -= 1;
    return R[bcl(i)];
  };
}
// Штукатурка гладкая (с каменным низом по F.low)
function matPlaster(R, o = {}) {
  return (u, v, F) => {
    if (o.low && v < o.low) return matStone(o.stoneR || BP.stone)(u, v, F);
    let i = F.li;
    if (bhash(u, v, 91) < 0.06) i += 1;
    if (bhash(Math.floor(u / 3), Math.floor(v / 3), 92) < 0.04) i += 1;
    if (F.h && v > F.h - 7) i += 1;
    if (o.low && v < o.low + 2) i += 1;
    return R[bcl(i)];
  };
}
const matFlat = (c) => () => c;

// ---------- Элементы на стенах ----------
// Окно: рама из бруса, переплёт крестом, тёплое стекло; o.round — круглое, o.arch — арка, o.shut — ставни (цвет)
function matWindow(o = {}) {
  const G = o.G || (o.lit === false ? BP.glassD : BP.glass), Fr = o.frameR || BP.beam, w = o.w, h = o.h;
  return (u, v, F) => {
    const cx = w / 2, cy = h / 2;
    if (o.round) { const r = Math.min(w, h) / 2, d = Math.hypot(u - cx, v - cy); if (d > r) return null; if (d > r - 2) return Fr[1]; if (Math.abs(u - cx) < 1 || Math.abs(v - cy) < 1) return Fr[2]; return G[d < r * 0.45 && u < cx ? 0 : v > cy ? 2 : 1]; }
    if (o.arch) { const r = w / 2; if (v > h - r) { const d = Math.hypot(u - cx, v - (h - r)); if (d > r) return null; if (d > r - 2) return Fr[1]; } }
    if (u < 2 || u > w - 3 || v < 2 || v > h - 3) return Fr[v < 2 ? 2 : 1];
    if (o.sill && v < 3) return BP.plank[1];
    if (Math.abs(u - cx) < 1 || Math.abs(v - cy) < 1) return Fr[2];
    if (o.bars && (((u | 0) % 4) === 0)) return BP.iron[2];
    const lt = (u - 2) / (w - 4), vt = (v - 2) / (h - 4);
    return G[lt + (1 - vt) < 0.7 ? 0 : lt + (1 - vt) < 1.3 ? 1 : 2];
  };
}
// Ставня: доски с перекладиной
function matShutter(col) { const R = col; return (u, v, F) => { const r = ((u | 0) % 3) === 0 ? 2 : (Math.abs(v - F.h * 0.5) < 1 || v < 1 || v > F.h - 2) ? 3 : 1; return R[bcl(r, 3)]; }; }
// Дверь: дощатая, с железными полосами; o.arch, o.double (ворота), o.col — рампа дерева
function matDoor(o = {}) {
  const R = o.col || BP.plank, w = o.w, h = o.h;
  return (u, v, F) => {
    const cx = w / 2;
    if (o.arch) { const r = w / 2; if (v > h - r && Math.hypot(u - cx, v - (h - r)) > r) return null; }
    if (u < 1.5 || u > w - 2.5 || v > h - 2.5) return BP.beam[2];
    if (o.double && Math.abs(u - cx) < 1) return BP.beam[3];
    const pw = o.pw || 6, k = Math.floor(u / pw), uu = ((u % pw) + pw) % pw;
    let i = 2 + (bhash(k, 0, 101) < 0.3 ? 1 : 0);
    if (uu < 1) i = 4;
    const band = (v > 6 && v < 9) || (v > h - 11 && v < h - 8) || (o.mid && Math.abs(v - h / 2) < 1.5);
    if (band) return (uu | 0) % 4 === 1 ? BP.iron[0] : BP.iron[1 + (v % 2 | 0)];
    if (o.ring && Math.hypot(u - (o.double ? cx - 4 : w - 6), v - h * 0.5) < 2.2) return BP.iron[0];
    if (o.ring && Math.hypot(u - (o.double ? cx - 4 : w - 6), v - h * 0.5) < 3.4) return BP.iron[2];
    if (o.knob && Math.hypot(u - (w - 5), v - h * 0.5) < 1.6) return BP.gold[1];
    return R[bcl(i)];
  };
}

// ---------- Геометрия ----------
// Стена с юга (фасад): x0..x1 по локальному X на y, Z z0..z1; материал получает v снизу вверх
function wallS(g, x0, x1, y, z0, z1, mat, o = {}) {
  g.face([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], [1, 0, 0], [0, 0, 1], mat, Object.assign({ F: { w: (x1 - x0) * BK, h: (z1 - z0) * BK } }, o));
}
function wallE(g, x, y0, y1, z0, z1, mat, o = {}) {
  g.face([[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]], [0, 1, 0], [0, 0, 1], mat, Object.assign({ F: { w: (y1 - y0) * BK, h: (z1 - z0) * BK } }, o));
}
function wallW(g, x, y0, y1, z0, z1, mat, o = {}) {
  g.face([[x, y1, z0], [x, y0, z0], [x, y0, z1], [x, y1, z1]], [0, -1, 0], [0, 0, 1], mat, Object.assign({ F: { w: (y1 - y0) * BK, h: (z1 - z0) * BK } }, o));
}
function wallN(g, x0, x1, y, z0, z1, mat, o = {}) {
  g.face([[x1, y, z0], [x0, y, z0], [x0, y, z1], [x1, y, z1]], [-1, 0, 0], [0, 0, 1], mat, Object.assign({ F: { w: (x1 - x0) * BK, h: (z1 - z0) * BK } }, o));
}
function topFace(g, x0, x1, y0, y1, z, mat) { g.face([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], [1, 0, 0], [0, 1, 0], mat, { F: { w: (x1 - x0) * BK, h: (y1 - y0) * BK } }); }
// элемент на стене (окно/дверь/ставня): side 'S'|'E'|'W'|'N', a — координата вдоль стены (левый край), z — низ
function elem(g, side, at, a, z, w, h, mat) {
  const o = { F: { w: w * BK, h: h * BK }, dz: -0.3 };
  if (side === 'S') g.face([[a, at - 0.25, z], [a + w, at - 0.25, z], [a + w, at - 0.25, z + h], [a, at - 0.25, z + h]], [1, 0, 0], [0, 0, 1], mat, o);
  else if (side === 'E') g.face([[at + 0.25, a, z], [at + 0.25, a + w, z], [at + 0.25, a + w, z + h], [at + 0.25, a, z + h]], [0, 1, 0], [0, 0, 1], mat, o);
  else if (side === 'W') g.face([[at - 0.25, a + w, z], [at - 0.25, a, z], [at - 0.25, a, z + h], [at - 0.25, a + w, z + h]], [0, -1, 0], [0, 0, 1], mat, o);
  else g.face([[a + w, at + 0.25, z], [a, at + 0.25, z], [a, at + 0.25, z + h], [a + w, at + 0.25, z + h]], [-1, 0, 0], [0, 0, 1], mat, o);
}
// короб со стенами (все четыре — z-буфер спрячет задние)
function box(g, b) {
  const { x0, x1, y0, y1, h } = b, z0 = b.z0 || 0;
  const mS = b.S || b.mat, mE = b.E || b.mat, mW = b.W || b.E || b.mat, mN = b.N || b.S || b.mat;
  wallS(g, x0, x1, y0, z0, z0 + h, mS); wallE(g, x1, y0, y1, z0, z0 + h, mE); wallW(g, x0, y0, y1, z0, z0 + h, mW); wallN(g, x0, x1, y1, z0, z0 + h, mN);
  if (b.top) topFace(g, x0, x1, y0, y1, z0 + h, b.top);
}
// Скат: четырёхугольник/треугольник; U вдоль конька, V вниз по скату (v=0 на коньке); материалу даём L — длину ската
function slope(g, pts, mat, o = {}) {
  const A = pts[0], B = pts[1], D = pts[pts.length - 1];
  const U = v3.norm(v3.sub(B, A));
  let Vd = v3.sub(D, A); if (Math.hypot(...Vd) < 1e-6) Vd = v3.sub(pts[2], B);
  const L = Math.hypot(...Vd), V = v3.norm(Vd);
  g.face(pts, U, V, mat, Object.assign({ F: Object.assign({ L: L * BK, cap: o.cap ?? 6 }, o.F || {}) }, o.li != null ? { li: o.li } : {}));
}
// толщина кровли: вертикальная лента под кромкой (от pts[0] к pts[1]), высота th
function edgeBand(g, a, b, th, mat, o = {}) {
  g.face([[a[0], a[1], a[2] - th], [b[0], b[1], b[2] - th], [b[0], b[1], b[2]], [a[0], a[1], a[2]]], v3.norm(v3.sub(b, a)), [0, 0, 1], mat, Object.assign({ F: { T: th * BK } }, o));
}

// Крыша над коробом. r: { type: 'gable'|'hip'|'half'|'pyr'|'lean'|'gambrel', axis: 'X'|'Y', rise, ov, ovg (свес на фронтонах),
//   mat, cut (материал среза/толщины), th (толщина), gable (материал фронтона), hipL (длина вальмы), down (для lean) }
function roof(g, b, r) {
  const { x0, x1, y0, y1 } = b, zt = (b.z0 || 0) + b.h, ze = zt - (r.drop ?? 1), zr = zt + r.rise, ov = r.ov ?? 5, ovg = r.ovg ?? ov, th = r.th ?? 4;
  const cut = r.cut || r.mat, li = r.li;
  const t = r.type || 'gable', ax = r.axis || 'X';
  const gab = r.gable;
  if (t === 'gable' || t === 'half') {
    const hip = t === 'half' ? (r.hipL ?? 10) : 0, zh = t === 'half' ? zr - r.rise * 0.42 : zr;   // полувальма: верх фронтона срезан
    if (ax === 'X') {
      const ym = (y0 + y1) / 2;
      const S = [[x0 - ovg + hip * 0, ym, zr], [x1 + ovg, ym, zr], [x1 + ovg, y0 - ov, ze], [x0 - ovg, y0 - ov, ze]];
      if (hip) { S[0] = [x0 - ovg + hip, ym, zr]; S[1] = [x1 + ovg - hip, ym, zr]; }
      slope(g, S, r.mat, { li });
      const N = hip ? [[x1 + ovg - hip, ym, zr], [x0 - ovg + hip, ym, zr], [x0 - ovg, y1 + ov, ze], [x1 + ovg, y1 + ov, ze]] : [[x1 + ovg, ym, zr], [x0 - ovg, ym, zr], [x0 - ovg, y1 + ov, ze], [x1 + ovg, y1 + ov, ze]];
      slope(g, N, r.mat, { li: li != null ? li : 1 });
      if (hip) {   // маленькие вальмы по торцам
        slope(g, [[x1 + ovg - hip, ym, zr], [x1 + ovg, y1 + ov, ze], [x1 + ovg, y0 - ov, ze]], r.mat, { cap: 0, li: 1 });
        slope(g, [[x0 - ovg + hip, ym, zr], [x0 - ovg, y0 - ov, ze], [x0 - ovg, y1 + ov, ze]], r.mat, { cap: 0, li: 0 });
      }
      edgeBand(g, [x0 - ovg, y0 - ov, ze], [x1 + ovg, y0 - ov, ze], th, cut);
      edgeBand(g, [x1 + ovg, y0 - ov, ze], [x1 + ovg, y1 + ov, ze], th, cut, { li: 2 });
      if (!hip) {
        edgeBand(g, [x1 + ovg, y0 - ov, ze], [x1 + ovg, ym, zr], th, cut, { li: 2 });
        edgeBand(g, [x1 + ovg, ym, zr], [x1 + ovg, y1 + ov, ze], th, cut, { li: 2 });
        edgeBand(g, [x0 - ovg, y0 - ov, ze], [x0 - ovg, ym, zr], th, cut, { li: 1 });
        if (gab) {
          g.face([[x1, y0, zt - 1], [x1, y1, zt - 1], [x1, ym, zr]], [0, 1, 0], [0, 0, 1], gab, { F: { w: (y1 - y0) * BK, h: (zr - zt + 1) * BK, gable: true } });
          g.face([[x0, y1, zt - 1], [x0, y0, zt - 1], [x0, ym, zr]], [0, -1, 0], [0, 0, 1], gab, { F: { w: (y1 - y0) * BK, h: (zr - zt + 1) * BK, gable: true } });
        }
      } else if (gab) {
        g.face([[x1, y0, zt - 1], [x1, y1, zt - 1], [x1, ym + hip * 0.5, zh], [x1, ym - hip * 0.5, zh]], [0, 1, 0], [0, 0, 1], gab, { F: { w: (y1 - y0) * BK, h: (zh - zt + 1) * BK, gable: true } });
        g.face([[x0, y1, zt - 1], [x0, y0, zt - 1], [x0, ym - hip * 0.5, zh], [x0, ym + hip * 0.5, zh]], [0, -1, 0], [0, 0, 1], gab, { F: { w: (y1 - y0) * BK, h: (zh - zt + 1) * BK, gable: true } });
      }
    } else {
      const xm = (x0 + x1) / 2;
      const Wd = hip ? [[xm, y1 + ovg - hip, zr], [xm, y0 - ovg + hip, zr], [x0 - ov, y0 - ovg, ze], [x0 - ov, y1 + ovg, ze]] : [[xm, y1 + ovg, zr], [xm, y0 - ovg, zr], [x0 - ov, y0 - ovg, ze], [x0 - ov, y1 + ovg, ze]];
      slope(g, Wd, r.mat, { li: li != null ? li : 0 });
      const E = hip ? [[xm, y0 - ovg + hip, zr], [xm, y1 + ovg - hip, zr], [x1 + ov, y1 + ovg, ze], [x1 + ov, y0 - ovg, ze]] : [[xm, y0 - ovg, zr], [xm, y1 + ovg, zr], [x1 + ov, y1 + ovg, ze], [x1 + ov, y0 - ovg, ze]];
      slope(g, E, r.mat, { li: li != null ? li : 1 });
      if (hip) {
        slope(g, [[xm, y0 - ovg + hip, zr], [x1 + ov, y0 - ovg, ze], [x0 - ov, y0 - ovg, ze]], r.mat, { cap: 0, li: 0 });
        slope(g, [[xm, y1 + ovg - hip, zr], [x0 - ov, y1 + ovg, ze], [x1 + ov, y1 + ovg, ze]], r.mat, { cap: 0, li: 1 });
      }
      edgeBand(g, [x1 + ov, y0 - ovg, ze], [x1 + ov, y1 + ovg, ze], th, cut, { li: 2 });
      if (hip) edgeBand(g, [x0 - ov, y0 - ovg, ze], [x1 + ov, y0 - ovg, ze], th, cut);   // у фронтона горизонтальной кромки нет
      if (!hip) {
        edgeBand(g, [x0 - ov, y0 - ovg, ze], [xm, y0 - ovg, zr], th, cut);
        edgeBand(g, [xm, y0 - ovg, zr], [x1 + ov, y0 - ovg, ze], th, cut, { li: 1 });
        if (gab) {
          g.face([[x0, y0, zt - 1], [x1, y0, zt - 1], [xm, y0, zr]], [1, 0, 0], [0, 0, 1], gab, { F: { w: (x1 - x0) * BK, h: (zr - zt + 1) * BK, gable: true } });
          g.face([[x1, y1, zt - 1], [x0, y1, zt - 1], [xm, y1, zr]], [-1, 0, 0], [0, 0, 1], gab, { F: { w: (x1 - x0) * BK, h: (zr - zt + 1) * BK, gable: true } });
        }
      } else if (gab) {
        g.face([[x0, y0, zt - 1], [x1, y0, zt - 1], [xm + hip * 0.5, y0, zh], [xm - hip * 0.5, y0, zh]], [1, 0, 0], [0, 0, 1], gab, { F: { w: (x1 - x0) * BK, h: (zh - zt + 1) * BK, gable: true } });
      }
    }
  } else if (t === 'hip' || t === 'pyr') {
    const hl = t === 'pyr' ? 1e9 : (r.hipL ?? 20);
    if (ax === 'X') {
      const ym = (y0 + y1) / 2, hx = Math.min(hl, (x1 - x0) / 2 + ov), ra = x0 - ov + hx, rb = x1 + ov - hx;
      slope(g, [[ra, ym, zr], [rb, ym, zr], [x1 + ov, y0 - ov, ze], [x0 - ov, y0 - ov, ze]], r.mat, { li });
      slope(g, [[rb, ym, zr], [ra, ym, zr], [x0 - ov, y1 + ov, ze], [x1 + ov, y1 + ov, ze]], r.mat, { li: li != null ? li : 1 });
      slope(g, [[rb, ym, zr], [x1 + ov, y1 + ov, ze], [x1 + ov, y0 - ov, ze]], r.mat, { cap: 0, li: li != null ? li : 1 });
      slope(g, [[ra, ym, zr], [x0 - ov, y0 - ov, ze], [x0 - ov, y1 + ov, ze]], r.mat, { cap: 0, li: li != null ? li : 0 });
    } else {
      const xm = (x0 + x1) / 2, hy = Math.min(hl, (y1 - y0) / 2 + ov), ra = y0 - ov + hy, rb = y1 + ov - hy;
      slope(g, [[xm, rb, zr], [xm, ra, zr], [x0 - ov, y0 - ov, ze], [x0 - ov, y1 + ov, ze]], r.mat, { li: li != null ? li : 0 });
      slope(g, [[xm, ra, zr], [xm, rb, zr], [x1 + ov, y1 + ov, ze], [x1 + ov, y0 - ov, ze]], r.mat, { li: li != null ? li : 1 });
      slope(g, [[xm, ra, zr], [x1 + ov, y0 - ov, ze], [x0 - ov, y0 - ov, ze]], r.mat, { cap: 0, li: li != null ? li : 0 });
      slope(g, [[xm, rb, zr], [x0 - ov, y1 + ov, ze], [x1 + ov, y1 + ov, ze]], r.mat, { cap: 0, li: li != null ? li : 1 });
    }
    edgeBand(g, [x0 - ov, y0 - ov, ze], [x1 + ov, y0 - ov, ze], th, cut);
    edgeBand(g, [x1 + ov, y0 - ov, ze], [x1 + ov, y1 + ov, ze], th, cut, { li: 2 });
  } else if (t === 'lean') {
    const d = r.down || 'S';
    if (d === 'S') { slope(g, [[x0 - ov, y1, zr], [x1 + ov, y1, zr], [x1 + ov, y0 - ov, ze], [x0 - ov, y0 - ov, ze]], r.mat, { cap: 0, li }); edgeBand(g, [x0 - ov, y0 - ov, ze], [x1 + ov, y0 - ov, ze], th, cut); edgeBand(g, [x1 + ov, y0 - ov, ze], [x1 + ov, y1, zr], th, cut, { li: 2 }); }
    else if (d === 'E') { slope(g, [[x0, y1 + ov, zr], [x0, y0 - ov, zr], [x1 + ov, y0 - ov, ze], [x1 + ov, y1 + ov, ze]], r.mat, { cap: 0, li: li != null ? li : 1 }); edgeBand(g, [x1 + ov, y0 - ov, ze], [x1 + ov, y1 + ov, ze], th, cut, { li: 2 }); edgeBand(g, [x0, y0 - ov, zr], [x1 + ov, y0 - ov, ze], th, cut); }
    else if (d === 'W') { slope(g, [[x1, y0 - ov, zr], [x1, y1 + ov, zr], [x0 - ov, y1 + ov, ze], [x0 - ov, y0 - ov, ze]], r.mat, { cap: 0, li }); edgeBand(g, [x0 - ov, y0 - ov, ze], [x1, y0 - ov, zr], th, cut); edgeBand(g, [x1, y0 - ov, zr], [x1, y1 + ov, zr], th, cut, { li: 2 }); }
    else { slope(g, [[x1 + ov, y0, zr], [x0 - ov, y0, zr], [x0 - ov, y1 + ov, ze], [x1 + ov, y1 + ov, ze]], r.mat, { cap: 0, li: li != null ? li : 1 }); edgeBand(g, [x0 - ov, y0, zr], [x1 + ov, y0, zr], th, cut); edgeBand(g, [x1 + ov, y0, zr], [x1 + ov, y1 + ov, ze], th, cut, { li: 2 }); }
  } else if (t === 'gambrel') {
    // ломаная двускатная (амбар): крутой низ, пологий верх; ось Y (фронтон на юг)
    const xm = (x0 + x1) / 2, k = r.knee ?? 0.4, zk = ze + r.rise * 0.62, xk0 = x0 - ov + (xm - x0 + ov) * k, xk1 = x1 + ov - (x1 + ov - xm) * k;
    slope(g, [[xm, y1 + ovg, zr], [xm, y0 - ovg, zr], [xk0, y0 - ovg, zk], [xk0, y1 + ovg, zk]], r.mat, { li: 0 });
    slope(g, [[xk0, y1 + ovg, zk], [xk0, y0 - ovg, zk], [x0 - ov, y0 - ovg, ze], [x0 - ov, y1 + ovg, ze]], r.mat, { cap: 0, li: 0 });
    slope(g, [[xm, y0 - ovg, zr], [xm, y1 + ovg, zr], [xk1, y1 + ovg, zk], [xk1, y0 - ovg, zk]], r.mat, { li: 1 });
    slope(g, [[xk1, y0 - ovg, zk], [xk1, y1 + ovg, zk], [x1 + ov, y1 + ovg, ze], [x1 + ov, y0 - ovg, ze]], r.mat, { cap: 0, li: 2 });
    edgeBand(g, [x1 + ov, y0 - ovg, ze], [x1 + ov, y1 + ovg, ze], th, cut, { li: 2 });
    for (const [a, b, l] of [[[x0 - ov, y0 - ovg, ze], [xk0, y0 - ovg, zk], 0], [[xk0, y0 - ovg, zk], [xm, y0 - ovg, zr], 0], [[xm, y0 - ovg, zr], [xk1, y0 - ovg, zk], 1], [[xk1, y0 - ovg, zk], [x1 + ov, y0 - ovg, ze], 1]]) edgeBand(g, a, b, th, cut, { li: l });
    if (gab) g.face([[x0, y0, zt - 1], [x1, y0, zt - 1], [xk1 - ov * (1 - k), y0, zk], [xm, y0, zr], [xk0 + ov * (1 - k), y0, zk]], [1, 0, 0], [0, 0, 1], gab, { F: { w: (x1 - x0) * BK, h: (zr - zt + 1) * BK, gable: true } });
  }
}
// Конус (круглая башня): n сегментов; материал получает u по дуге, v вниз
function cone(g, cx, cy, rr, z0, rise, mat, cut, n = 24, th = 3) {
  const apex = [cx, cy, z0 + rise];
  let u0 = 0;
  for (let i = 0; i < n; i++) {
    const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
    const p0 = [cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr, z0], p1 = [cx + Math.cos(a1) * rr, cy + Math.sin(a1) * rr, z0];
    const U = v3.norm(v3.sub(p1, p0)), V = v3.norm(v3.sub(p0, apex)), L = Math.hypot(...v3.sub(p0, apex));
    const uo = u0; u0 += Math.hypot(...v3.sub(p1, p0)) * BK;
    g.face([apex, p1, p0], U, V, (u, v, F) => mat(u + uo, v, F), { F: { L: L * BK, cap: 0 } });
    edgeBand(g, p0, p1, th, cut);
  }
}
// Цилиндр (башня): n сегментов, материал стены
function cyl(g, cx, cy, rr, z0, z1, mat, n = 24) {
  let u0 = 0;
  for (let i = 0; i < n; i++) {
    const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
    const p0 = [cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr], p1 = [cx + Math.cos(a1) * rr, cy + Math.sin(a1) * rr];
    const U = v3.norm([p1[0] - p0[0], p1[1] - p0[1], 0]), uo = u0; u0 += Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) * BK;
    g.face([[p0[0], p0[1], z0], [p1[0], p1[1], z0], [p1[0], p1[1], z1], [p0[0], p0[1], z1]], U, [0, 0, 1], (u, v, F) => mat(u + uo, v, F), { F: { w: 1e9, h: (z1 - z0) * BK } });
  }
}
// Труба: кирпичный/каменный столбик с навершием
function chimney(g, x, y, z0, h, o = {}) {
  const w = o.w || 6, d = o.d || 6, R = o.stone ? BP.stone : BP.brick, m = o.stone ? matStone(R, 8, 5) : matBrick(R, 5, 9);
  box(g, { x0: x, x1: x + w, y0: y, y1: y + d, z0, h, mat: m, top: matFlat(BP.stone[4]) });
  box(g, { x0: x - 1, x1: x + w + 1, y0: y - 1, y1: y + d + 1, z0: z0 + h, h: 2, mat: matFlat(BP.stone[2]), top: matFlat(BP.stone[3]) });
  g.face([[x + 1.5, y + 1.5, z0 + h + 2.01], [x + w - 1.5, y + 1.5, z0 + h + 2.01], [x + w - 1.5, y + d - 1.5, z0 + h + 2.01], [x + 1.5, y + d - 1.5, z0 + h + 2.01]], [1, 0, 0], [0, 1, 0], matFlat(BP.ink), { dz: -0.01 });
}
// Слуховое окно на южном скате (ось X): x — центр, yf — где на скате стоит фасадик; roofZ(y) — высота ската
function dormer(g, x, yf, w, hh, rise, roofZ, wallM, roofM, cutM, win) {
  const zb = roofZ(yf) - 2, zt = zb + hh, xm = x, x0 = x - w / 2, x1 = x + w / 2;
  // задняя линия: где конёк слухового окна входит в скат
  let yb = yf; for (let k = 0; k < 60 && roofZ(yb) < zt + rise; k++) yb += 1;
  wallS(g, x0, x1, yf, zb, zt, wallM);
  g.face([[x0, yf, zt - 0.5], [x1, yf, zt - 0.5], [xm, yf, zt + rise]], [1, 0, 0], [0, 0, 1], wallM, { F: { w: w * BK, h: rise * BK, gable: true } });
  wallE(g, x1, yf, yb, zb, zt, wallM); wallW(g, x0, yf, yb, zb, zt, wallM);
  const ov = 2;
  slope(g, [[xm, yb, zt + rise], [xm, yf - ov, zt + rise], [x0 - ov, yf - ov, zt - 1], [x0 - ov, yb, zt - 1]], roofM, { li: 0, cap: 3 });
  slope(g, [[xm, yf - ov, zt + rise], [xm, yb, zt + rise], [x1 + ov, yb, zt - 1], [x1 + ov, yf - ov, zt - 1]], roofM, { li: 1, cap: 3 });
  edgeBand(g, [x0 - ov, yf - ov, zt - 1], [xm, yf - ov, zt + rise], 2.5, cutM);
  edgeBand(g, [xm, yf - ov, zt + rise], [x1 + ov, yf - ov, zt - 1], 2.5, cutM, { li: 1 });
  edgeBand(g, [x1 + ov, yf - ov, zt - 1], [x1 + ov, yb, zt - 1], 2.5, cutM, { li: 2 });
  if (win) elem(g, 'S', yf, x - win.w / 2, zb + 2, win.w, win.h, matWindow(Object.assign({}, win, { w: win.w * BK, h: win.h * BK })));
}

// ---------- Реквизит (плакаты) ----------
// рисовалки в экранных пикселях: P(x, y, col); y вверх отрицательно; (0,0) — точка опоры на земле
const PR = {
  rect(P, x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) P(x, y, c); },
  ell(P, cx, cy, rx, ry, fn) { for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) { const a = (x + 0.5 - cx) / rx, b = (y + 0.5 - cy) / ry; if (a * a + b * b <= 1) { const c = fn(x, y, a, b); if (c) P(x, y, c); } } },
  line(P, x0, y0, x1, y1, c, w = 1) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0; for (let i = 0; i <= n; i++) { const x = Math.round(x0 + (x1 - x0) * i / (n || 1)), y = Math.round(y0 + (y1 - y0) * i / (n || 1)); for (let k = 0; k < w; k++) P(x + (k % 2 ? -(k + 1) >> 1 : k >> 1), y, c); } },
};
// бочка (стоя): радиус r px сетки
function propBarrel(P, r = 9, h = 24, R = BP.plank) {
  PR.ell(P, 0, -h, r, r * 0.45, () => R[1]);
  for (let y = -h; y <= 0; y++) for (let x = -r; x <= r; x++) {
    const t = (x + r) / (2 * r), bulge = 1 + 0.08 * Math.sin((y + h) / h * Math.PI);
    if (Math.abs(x) > r * bulge) continue;
    let i = t < 0.18 ? 2 : t < 0.5 ? 1 : t < 0.8 ? 2 : 3;
    if (((x + r) % 5) === 0) i += 1;
    const yy = (y + h) / h;
    if (Math.abs(yy - 0.22) < 0.05 || Math.abs(yy - 0.78) < 0.05) P(x, y, BP.iron[t < 0.5 ? 1 : 2]); else P(x, y, R[bcl(i)]);
  }
  PR.ell(P, 0, 0, r * 1.02, r * 0.45, (x, y, a, b) => (b > 0 ? R[4] : null));
}
function propCrate(P, s = 16, R = BP.plank) {
  // косой ящик: перед, бок, верх
  const d = Math.round(s * 0.5), dy = Math.round(s * 0.39);
  for (let y = -s; y <= 0; y++) for (let x = 0; x < s; x++) { let i = 1; if (x % 5 === 0 || y === -s || y === 0 || x === s - 1) i = 3; if (Math.abs(y + s * 0.5) < 1) i = 3; P(x, y, R[i]); }
  for (let k = 0; k < d; k++) for (let y = -s; y <= 0; y++) { let i = 2; if (k === d - 1 || y === -s || y === 0) i = 4; if ((y - k) % 5 === 0) i = 3; P(s + k, y - Math.round(k * dy / d), R[i]); }
  for (let k = 0; k < d; k++) for (let x = 0; x < s; x++) { let i = 0; if (k === d - 1 || x === 0 || x === s - 1 || k === 0) i = 2; if (x % 5 === 0) i = 1; P(x + k, -s - Math.round(k * dy / d), R[i]); }
}
function propSack(P, w = 12, h = 14, R = BP.cloth) {
  PR.ell(P, 0, -h * 0.45, w / 2, h * 0.5, (x, y, a, b) => { let i = a < -0.3 && b < 0 ? 0 : a > 0.4 || b > 0.5 ? 2 : 1; if (bhash(x, y, 111) < 0.06) i += 1; return R[bcl(i, 3)]; });
  PR.rect(P, -2, -h - 1, 2, -h + 1, R[3]); PR.rect(P, -3, -h + 2, 3, -h + 2, BP.rope[1]);
}
// вывеска на кронштейне: доска с рисунком; dir = 1 вправо от стены
function propSign(P, kind, dir = 1, w = 22, h = 18) {
  const x0 = dir > 0 ? 4 : -4 - w, y0 = -h;
  PR.rect(P, Math.min(0, dir * 6), -h - 4, Math.max(0, dir * 6), -h - 3, BP.iron[1]);              // кронштейн
  PR.rect(P, dir > 0 ? x0 + 3 : x0 + w - 3, -h - 3, dir > 0 ? x0 + 3 : x0 + w - 3, -h, BP.iron[2]);
  PR.rect(P, dir > 0 ? x0 + w - 3 : x0 + 3, -h - 3, dir > 0 ? x0 + w - 3 : x0 + 3, -h, BP.iron[2]);
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { let i = 1; if (x === x0 || x === x0 + w - 1 || y === y0 || y === y0 + h - 1) i = 3; else if ((y - y0) % 6 === 0) i = 2; P(x, y, BP.plank[i]); }
  const cx = x0 + w / 2, cy = y0 + h / 2;
  if (kind === 'mug') { PR.rect(P, cx - 4, cy - 2, cx + 2, cy + 5, BP.gold[1]); PR.rect(P, cx - 4, cy - 2, cx - 4, cy + 5, BP.gold[2]); PR.rect(P, cx + 3, cy, cx + 4, cy + 3, BP.gold[2]); PR.rect(P, cx - 5, cy - 5, cx + 3, cy - 3, BP.white[0]); PR.rect(P, cx - 3, cy - 6, cx + 1, cy - 6, BP.white[0]); }
  else if (kind === 'book') { PR.rect(P, cx - 6, cy - 4, cx + 5, cy + 4, BP.red[1]); PR.rect(P, cx - 5, cy - 3, cx - 1, cy + 3, BP.white[1]); PR.rect(P, cx + 1, cy - 3, cx + 4, cy + 3, BP.white[1]); PR.rect(P, cx, cy - 4, cx, cy + 4, BP.red[3]); PR.rect(P, cx - 4, cy - 1, cx - 2, cy - 1, BP.stone[3]); PR.rect(P, cx - 4, cy + 1, cx - 2, cy + 1, BP.stone[3]); }
  else if (kind === 'crate') { PR.rect(P, cx - 5, cy - 4, cx + 5, cy + 5, BP.plank[2]); PR.rect(P, cx - 5, cy - 4, cx + 5, cy - 4, BP.plank[4]); PR.rect(P, cx - 5, cy + 5, cx + 5, cy + 5, BP.plank[4]); PR.rect(P, cx - 5, cy - 4, cx - 5, cy + 5, BP.plank[4]); PR.rect(P, cx + 5, cy - 4, cx + 5, cy + 5, BP.plank[4]); PR.line(P, cx - 5, cy - 4, cx + 5, cy + 5, BP.plank[4]); PR.line(P, cx + 5, cy - 4, cx - 5, cy + 5, BP.plank[4]); }
}
// фонарь на стене
function propLantern(P) { PR.rect(P, -2, -10, 2, -3, BP.iron[2]); PR.rect(P, -1, -9, 1, -4, BP.glass[1]); P(0, -7, BP.glass[0]); PR.rect(P, -1, -11, 1, -11, BP.iron[1]); PR.rect(P, 0, -12, 0, -12, BP.iron[0]); }
// флаг/вымпел на шесте
function propPennant(P, h = 26, R = BP.red) { PR.rect(P, 0, -h, 0, 0, BP.beam[2]); for (let y = -h; y < -h + 8; y++) { const len = 12 - (y + h) * 1.3; for (let x = 1; x <= len; x++) P(x, y, R[x > len - 2 ? 2 : (y + h) < 2 ? 0 : 1]); } P(0, -h - 1, BP.gold[1]); }
// колокол
function propBell(P) { PR.rect(P, -3, -8, 3, -3, BP.gold[1]); PR.rect(P, -4, -3, 4, -2, BP.gold[2]); PR.rect(P, -2, -10, 2, -9, BP.gold[2]); PR.rect(P, -1, -11, 1, -11, BP.iron[2]); P(0, -1, BP.gold[3]); PR.rect(P, -2, -7, -2, -4, BP.gold[0]); }
// ступени перед дверью: n ступеней шириной w (камень)
function propSteps(P, w = 24, n = 2) { for (let k = 0; k < n; k++) { const y = -k * 3, hw = w / 2 - k * 2; PR.rect(P, -hw, y - 3, hw, y - 1, BP.stone[k === n - 1 ? 1 : 2]); PR.rect(P, -hw, y, hw, y, BP.stone[4]); PR.rect(P, -hw, y - 3, -hw, y, BP.stone[3]); } }
// деревянная телега (вид сбоку, кузов вправо)
function propCart(P, L = 36) {
  PR.rect(P, 0, -16, L, -7, BP.plank[2]); for (let x = 0; x <= L; x += 6) PR.rect(P, x, -16, x, -7, BP.plank[4]); PR.rect(P, 0, -17, L, -17, BP.plank[0]); PR.rect(P, 0, -7, L, -6, BP.plank[4]);
  for (const cx of [10, L - 10]) { PR.ell(P, cx, -4, 6, 6, (x, y, a, b) => (a * a + b * b > 0.6 ? BP.plank[3] : (Math.abs(a) < 0.18 || Math.abs(b) < 0.18) ? BP.plank[2] : null)); PR.ell(P, cx, -4, 2, 2, () => BP.iron[1]); }
  PR.rect(P, L + 1, -12, L + 10, -11, BP.plank[3]);
  for (let k = 0; k < 3; k++) PR.ell(P, 7 + k * 11, -21, 6, 4, (x, y, a, b) => BP.cloth[b < -0.3 ? 0 : a > 0.4 ? 2 : 1]);
}
// стол со скамьями (пивной двор): вид косой
function propTable(P, w = 28) {
  PR.rect(P, -w / 2, -14, w / 2, -12, BP.plank[1]); PR.rect(P, -w / 2 + 2, -11, w / 2 - 2, -11, BP.plank[3]); PR.rect(P, -w / 2 + 3, -11, -w / 2 + 1, 0, BP.plank[3]); PR.rect(P, w / 2 - 3, -11, w / 2 - 1, 0, BP.plank[3]);
  PR.rect(P, -w / 2 - 4, -5, w / 2 + 4, -4, BP.plank[2]); PR.rect(P, -w / 2 - 3, -3, -w / 2 - 3, 0, BP.plank[4]); PR.rect(P, w / 2 + 3, -3, w / 2 + 3, 0, BP.plank[4]);
  PR.rect(P, -4, -19, 0, -15, BP.gold[1]); PR.rect(P, -5, -21, 1, -20, BP.white[0]); PR.rect(P, 1, -18, 2, -16, BP.gold[2]);
}
// поленница
function propLogs(P, n = 4, rows = 3) { for (let r = 0; r < rows; r++) for (let k = 0; k < n - (r % 2); k++) { const cx = k * 8 + (r % 2) * 4, cy = -4 - r * 7; PR.ell(P, cx, cy, 4, 3.5, (x, y, a, b) => (a * a + b * b > 0.55 ? BP.log[3] : (a * a + b * b < 0.12 ? BP.log[0] : BP.log[a < 0 ? 1 : 2]))); } }
// лестница приставная (к стене), высота h
function propLadder(P, h = 40) { for (let y = -h; y <= 0; y++) { P(-4, y, BP.plank[2]); P(4, y, BP.plank[3]); if (((y + h) % 7) === 3) PR.rect(P, -3, y, 3, y, BP.plank[1]); } }
// весы подвесные
function propScale(P) { PR.rect(P, 0, -26, 0, -16, BP.iron[1]); PR.rect(P, -9, -16, 9, -16, BP.iron[0]); for (const s of [-1, 1]) { PR.rect(P, s * 9, -15, s * 9, -8, BP.rope[1]); PR.ell(P, s * 9, -6, 5, 2, () => BP.gold[2]); PR.ell(P, s * 9, -7, 5, 2, () => BP.gold[1]); } }
// мешок на верёвке подъёмника
function propHoistSack(P) { PR.rect(P, 0, -40, 0, -14, BP.rope[1]); propSack(P, 11, 13); }
// грядка/клумба у стены: цветы
function propFlowers(P, w = 20) { for (let x = 0; x < w; x++) { const h = 2 + (bhash(x, 0, 121) * 4 | 0); PR.rect(P, x, -h, x, 0, BP.green[1 + (x % 3 === 0 ? 1 : 0)]); if (x % 3 === 1) P(x, -h - 1, [BP.red[0], BP.gold[0], BP.white[0], BP.blue[0]][(bhash(x, 1, 122) * 4) | 0]); } }
// вымпел-флюгер «сова»/стрелка на шесте
function propVane(P) { PR.rect(P, 0, -18, 0, 0, BP.iron[1]); PR.rect(P, -5, -14, 5, -14, BP.iron[2]); PR.line(P, 1, -18, 8, -18, BP.iron[0]); PR.rect(P, 6, -19, 8, -17, BP.iron[0]); PR.rect(P, -7, -20, -3, -16, BP.iron[1]); P(-1, -19, BP.iron[0]); }

// мягкая тень под зданием (для листа; в игре тень на отдельном слое)
function groundShadow(g, pts, k = 0.42) {
  // отдельная сетка не нужна: пишем прямо в цвет, не трогая z/f
  const S = pts.map(p => { const q = g.W3(p); return [g.sx(q[0], q[1]), g.sy(q[1], 0)]; });
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const s of S) { x0 = Math.min(x0, s[0]); x1 = Math.max(x1, s[0]); y0 = Math.min(y0, s[1]); y1 = Math.max(y1, s[1]); }
  let area = 0; for (let i = 0; i < S.length; i++) { const a = S[i], b = S[(i + 1) % S.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const sg = area >= 0 ? 1 : -1;
  for (let py = Math.max(0, y0 | 0); py <= Math.min(g.H - 1, y1 | 0); py++) for (let px = Math.max(0, x0 | 0); px <= Math.min(g.W - 1, x1 | 0); px++) {
    let inside = true;
    for (let i = 0; i < S.length && inside; i++) { const a = S[i], b = S[(i + 1) % S.length]; if (sg * ((b[0] - a[0]) * (py + 0.5 - a[1]) - (b[1] - a[1]) * (px + 0.5 - a[0])) < 0) inside = false; }
    if (!inside) continue;
    const i = py * g.W + px; if (g.f[i] >= 0) continue;
    const j = i * 4; if (g.d[j + 3]) continue;
    g.d[j] = 20; g.d[j + 1] = 16; g.d[j + 2] = 10; g.d[j + 3] = 255 * k | 0;
  }
}

// ---------- Фэнтези-геометрия ----------
// Двускатная крыша с провисшим коньком и загнутыми вверх краями (полосами): r.sag — провис середины, r.flare — подъём углов
function roofSag(g, b, r) {
  const { x0, x1, y0, y1 } = b, zt = (b.z0 || 0) + b.h, ze0 = zt - (r.drop ?? 1), zr0 = zt + r.rise, ov = r.ov ?? 5, ovg = r.ovg ?? ov, th = r.th ?? 4;
  const cut = r.cut || r.mat, N = r.n || 10, sag = r.sag ?? 5, flare = r.flare ?? 4, ax = r.axis || 'X';
  const fl = t => { const e = Math.min(t, 1 - t); return e < 0.3 ? flare * Math.pow(1 - e / 0.3, 2) : 0; };
  const zr = t => zr0 - sag * Math.sin(Math.PI * t), ze = t => ze0 + fl(t);
  const strips = [];
  for (let k = 0; k < N; k++) strips.push([k / N, (k + 1) / N]);
  if (ax === 'X') {
    const ym = (y0 + y1) / 2, xa = x0 - ovg, xb = x1 + ovg, X = t => xa + (xb - xa) * t;
    let uo = 0;
    for (const [t0, t1] of strips) {
      const w = (X(t1) - X(t0)) * BK, o0 = uo; uo += w;
      const mS = (u, v, F) => r.mat(u + o0, v, F), mN = (u, v, F) => r.mat(u + o0, v, F);
      slope(g, [[X(t0), ym, zr(t0)], [X(t1), ym, zr(t1)], [X(t1), y0 - ov, ze(t1)], [X(t0), y0 - ov, ze(t0)]], mS, { li: r.li });
      slope(g, [[X(t1), ym, zr(t1)], [X(t0), ym, zr(t0)], [X(t0), y1 + ov, ze(t0)], [X(t1), y1 + ov, ze(t1)]], mN, { li: r.li != null ? r.li : 1 });
      edgeBand(g, [X(t0), y0 - ov, ze(t0)], [X(t1), y0 - ov, ze(t1)], th, cut);
    }
    edgeBand(g, [xb, y0 - ov, ze(1)], [xb, ym, zr(1)], th, cut, { li: 2 }); edgeBand(g, [xb, ym, zr(1)], [xb, y1 + ov, ze(1)], th, cut, { li: 2 });
    edgeBand(g, [xa, y0 - ov, ze(0)], [xa, ym, zr(0)], th, cut, { li: 1 });
    if (r.gable) {
      g.face([[x1, y0, zt - 1], [x1, y1, zt - 1], [x1, ym, zr(1)]], [0, 1, 0], [0, 0, 1], r.gable, { F: { w: (y1 - y0) * BK, h: (zr0 - zt + 1) * BK, gable: true } });
      g.face([[x0, y1, zt - 1], [x0, y0, zt - 1], [x0, ym, zr(0)]], [0, -1, 0], [0, 0, 1], r.gable, { F: { w: (y1 - y0) * BK, h: (zr0 - zt + 1) * BK, gable: true } });
    }
  } else {
    const xm = (x0 + x1) / 2, ya = y0 - ovg, yb = y1 + ovg, Y = t => ya + (yb - ya) * t;
    let uo = 0;
    for (const [t0, t1] of strips) {
      const w = (Y(t1) - Y(t0)) * BK, o0 = uo; uo += w;
      const m = (u, v, F) => r.mat(u + o0, v, F);
      slope(g, [[xm, Y(t1), zr(t1)], [xm, Y(t0), zr(t0)], [x0 - ov, Y(t0), ze(t0)], [x0 - ov, Y(t1), ze(t1)]], m, { li: r.li != null ? r.li : 0 });
      slope(g, [[xm, Y(t0), zr(t0)], [xm, Y(t1), zr(t1)], [x1 + ov, Y(t1), ze(t1)], [x1 + ov, Y(t0), ze(t0)]], m, { li: r.li != null ? r.li : 1 });
      edgeBand(g, [x1 + ov, Y(t0), ze(t0)], [x1 + ov, Y(t1), ze(t1)], th, cut, { li: 2 });
    }
    edgeBand(g, [x0 - ov, ya, ze(0)], [xm, ya, zr(0)], th, cut); edgeBand(g, [xm, ya, zr(0)], [x1 + ov, ya, ze(0)], th, cut, { li: 1 });
    if (r.gable) {
      g.face([[x0, y0, zt - 1], [x1, y0, zt - 1], [xm, y0, zr(0)]], [1, 0, 0], [0, 0, 1], r.gable, { F: { w: (x1 - x0) * BK, h: (zr0 - zt + 1) * BK, gable: true } });
      g.face([[x1, y1, zt - 1], [x0, y1, zt - 1], [xm, y1, zr(1)]], [-1, 0, 0], [0, 0, 1], r.gable, { F: { w: (x1 - x0) * BK, h: (zr0 - zt + 1) * BK, gable: true } });
    }
  }
  return { zr, ze };
}
// Купол/грибная шляпка: кольца от макушки до кромки; R — радиус кромки, H — высота; bulge>1 — шляпка шире у середины
function dome(g, cx, cy, R, z0, H, mat, cut, n = 28, m = 7, th = 3) {
  const ring = j => { const ph = j / m * Math.PI / 2; return { r: R * Math.cos(ph) * (j === m ? 0.001 : 1), z: z0 + H * Math.sin(ph) }; };
  const L = Math.PI / 2 * Math.max(R, H) * BK;
  for (let j = 0; j < m; j++) {
    const a = ring(j), b = ring(j + 1);
    let uo = 0;
    for (let i = 0; i < n; i++) {
      const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
      const p0 = [cx + Math.cos(a0) * a.r, cy + Math.sin(a0) * a.r, a.z], p1 = [cx + Math.cos(a1) * a.r, cy + Math.sin(a1) * a.r, a.z];
      const q0 = [cx + Math.cos(a0) * b.r, cy + Math.sin(a0) * b.r, b.z], q1 = [cx + Math.cos(a1) * b.r, cy + Math.sin(a1) * b.r, b.z];
      const U = v3.norm(v3.sub(p1, p0)), V = v3.norm(v3.sub(p0, q0)), o0 = uo; uo += Math.hypot(...v3.sub(p1, p0)) * BK;
      const vo = (m - j - 1) / m * L;
      g.face([q1, q0, p0, p1], U, V, (u, v, F) => mat(u + o0 * (j === 0 ? 1 : 1), v + vo, F), { F: { L, cap: 0 } });
      if (j === 0) edgeBand(g, p0, p1, th, cut);
    }
  }
}
// Круглая дверь (как у норы): дощатая, с ручкой посередине
function matRoundDoor(o = {}) {
  const R = o.col || BP.plank, w = o.w, h = o.h, cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2;
  return (u, v) => {
    const d = Math.hypot(u - cx, v - cy);
    if (d > r) return null;
    if (d > r - 2.5) return BP.beam[2];
    if (d > r - 4) return BP.beam[0];
    if (Math.hypot(u - cx, v - cy) < 2) return BP.gold[1];
    const k = Math.floor((u + 2) / 6);
    let i = 2 + (bhash(k, 0, 131) < 0.3 ? 1 : 0);
    if (((u + 2) | 0) % 6 === 0) i = 4;
    if (Math.abs(v - cy) < 1 && Math.abs(u - cx) > 3) return BP.iron[1];
    return R[bcl(i)];
  };
}
// Гриб у стены (плакат)
function propMushroom(P, r = 5, R = BP.shroom) {
  const h = r * 1.6 | 0;
  PR.rect(P, -2, -h + 1, 1, 0, BP.cloth[1]); PR.rect(P, 1, -h + 1, 1, 0, BP.cloth[3]);
  PR.ell(P, 0, -h, r, r * 0.7, (x, y, a, b) => (b > 0.75 ? null : b > 0.4 ? R[4] : a < -0.3 && b < -0.2 ? R[0] : a > 0.5 ? R[2] : R[1]));
  P(-1, -h - 1, BP.cloth[0]); P(2, -h, BP.cloth[0]); P(-3, -h + 1, BP.cloth[1]);
}
// Кривая труба: два колена со сдвигом
function chimneyCrooked(g, x, y, z0, h, o = {}) {
  chimney(g, x, y, z0, h * 0.55, Object.assign({}, o));
  chimney(g, x + (o.lean ?? 2), y - 1, z0 + h * 0.55 + 2, h * 0.45, Object.assign({}, o));
}
// Фонарь с тёплым ореолом (ореол — дизеринг по соседним пикселям, не трогает z)
function propLanternGlow(P) { for (let y = -16; y <= -2; y++) for (let x = -7; x <= 7; x++) { const d = Math.hypot(x, (y + 8) * 1.2); if (d < 7 && d > 2 && bdith(x, y) < 1 - d / 7) P(x, y, BP.gold[0]); } propLantern(P); }
// Вымпел-полотнище (треугольный, свисает с балки)
function propBanner(P, R = BP.red, w = 10, h = 18) { for (let y = 0; y < h; y++) { const hw = Math.round(w / 2 * (1 - y / h)); for (let x = -hw; x <= hw; x++) P(x, y, R[x < -hw + 2 ? 0 : x > hw - 2 ? 2 : 1]); } PR.rect(P, -w / 2 - 1, 0, w / 2 + 1, 0, BP.beam[2]); P(0, Math.round(h * 0.45), BP.gold[0]); P(-1, Math.round(h * 0.45) - 1, BP.gold[0]); P(1, Math.round(h * 0.45) - 1, BP.gold[0]); P(0, Math.round(h * 0.45) - 2, BP.gold[0]); }
// Гигантская кружка на коньке
function propBigMug(P) { PR.rect(P, -8, -20, 6, -2, BP.plank[2]); for (let x = -8; x <= 6; x += 4) PR.rect(P, x, -20, x, -2, BP.plank[4]); PR.rect(P, -8, -12, 6, -11, BP.iron[1]); PR.rect(P, -8, -5, 6, -4, BP.iron[1]); PR.rect(P, 7, -16, 10, -7, BP.plank[3]); PR.rect(P, 8, -14, 9, -9, BP.plank[1]); PR.rect(P, -10, -24, 8, -20, BP.white[0]); PR.rect(P, -9, -26, 2, -24, BP.white[0]); P(-4, -27, BP.white[0]); P(5, -25, BP.white[1]); }
// Телескоп на треноге
function propTelescope(P) { PR.line(P, 0, -14, -5, 0, BP.beam[2]); PR.line(P, 0, -14, 5, 0, BP.beam[2]); PR.line(P, 0, -14, 1, -2, BP.beam[2]); PR.line(P, -8, -10, 10, -24, BP.gold[2], 3); PR.line(P, -8, -10, 10, -24, BP.gold[1]); PR.rect(P, 9, -26, 12, -23, BP.gold[2]); P(-9, -9, BP.iron[2]); }

// ======== bpx1.js ========
// Материалы и реквизит в масштабе референсов: 1 пиксель арта = 1 мировой пиксель (BK = 1).
// Технические цифры взяты с референсов владельца (pixeljoint 190×190, башня 139×128, фасадный домик ~115×140):
// ряд черепицы 3 px, плитка 4 px, брус 2 px, окно 8×10 с рамой 1 px, обводка 1 px тёмно-лиловая, 4 тона на материал.

const P1 = {
  ink: bhex('#2a1a24'),
  tileR: bramp(['#ec7e52', '#c8503a', '#9a3428', '#681f1c']),
  tileD: bramp(['#b85452', '#8e3434', '#662222', '#441616']),
  scale: bramp(['#7aa6e8', '#4e78c4', '#365694', '#243a68']),
  slate: bramp(['#7c8496', '#5c6478', '#444a5a', '#2e3240']),
  plaster: bramp(['#f4ecd8', '#dfd4ba', '#bfb296', '#9c8e74']),
  plasterC: bramp(['#e2e4dc', '#c6c9bf', '#a5a89e', '#82857c']),       // холодная серая (фасадный домик)
  beam: bramp(['#7a5238', '#563826', '#3a2418', '#241610']),
  beamD: bramp(['#5a3040', '#40202e', '#2c1420', '#1a0c14']),         // тёмно-лиловый брус
  stone: bramp(['#aab2c0', '#8792a4', '#677286', '#4b5364']),         // голубоватый камень pixeljoint
  stoneW: bramp(['#c6beaa', '#a69e8a', '#827a6a', '#5e584a']),
  stoneB: bramp(['#b4b8c4', '#949aa8', '#747a88', '#545866']),        // крупные блоки башни
  log: bramp(['#b67e50', '#905c36', '#6c4224', '#4a2c18']),
  dark: bramp(['#6e4e3e', '#52362a', '#38241c', '#241610']),
  plank: bramp(['#c09060', '#9a6c42', '#74502e', '#50361e']),
  plankB: bramp(['#8ea6b4', '#6c8494', '#506472', '#384854']),
  brick: bramp(['#bc6e52', '#9a503c', '#7a3a2c', '#56281e']),
  fascia: bramp(['#d8945a', '#b06a38', '#804824']),                   // деревянная кромка кровли
  glass: bramp(['#fff0a8', '#f2bc4c', '#cc8630']),
  glassD: bramp(['#b4d0e4', '#7a98b0', '#52708a']),
  glassB: bramp(['#d0f0ff', '#78c0f0', '#3c88c8']),
  iron: bramp(['#9898a4', '#64646e', '#3c3c44']),
  ivy: bramp(['#a4d85c', '#6eac40', '#4a8030', '#2e5a1e']),
  grass: bramp(['#92c454', '#6ea040', '#4e7c2e']),
  trunk: bramp(['#6e4a30', '#4c3020']),
  red: bramp(['#e04c40', '#b03028', '#7c1e1a']),
  white: bramp(['#f8f4ea', '#d4cec2', '#aca69a']),
  gold: bramp(['#ffd864', '#e0a830', '#a87818']),
  cloth: bramp(['#e6d6b0', '#c4b084', '#9c8858']),
  smoke: bramp(['#e4e2dc', '#bcbab4', '#908e8a']),
  straw: bramp(['#e8c868', '#c8a448', '#a07c30', '#705420']),
};
const p1 = (R, i, n = R.length - 1) => R[i < 0 ? 0 : i > n ? n : i];
// свет: li 0 — освещённая грань (юг/запад/верх), 1 — боковая (восток), 2 — тень
const L1 = F => (F.li >= 2 ? 1 : F.li);

// --- кровли ---
function m1Tile(R) {
  return (u, v, F) => {
    const row = Math.floor(v / 3), st = row % 2 ? 2 : 0, tu = (((u + st) % 4) + 4) % 4, vv = ((v % 3) + 3) % 3, k = L1(F);
    if (tu === 0) return p1(R, 2 + k);
    if (vv === 0) return p1(R, 0 + k);
    if (vv === 2) return p1(R, 2 + k);
    return p1(R, 1 + k + (bhash(Math.floor((u + st) / 4), row, 201) < 0.12 ? 1 : 0));
  };
}
function m1Scale(R) {
  return (u, v, F) => {
    const row = Math.floor(v / 3), st = row % 2 ? 2 : 0, tu = (((u + st) % 4) + 4) % 4, vv = ((v % 3) + 3) % 3, k = L1(F);
    if (vv === 2 && (tu === 0 || tu === 3)) return p1(R, 1 + k);           // скруглённый низ: углы уходят в тон ряда ниже
    if (vv === 2) return p1(R, 3);
    if (tu === 0) return p1(R, 2 + k);
    if (vv === 0) return p1(R, 0 + k);
    return p1(R, 1 + k);
  };
}
function m1Slate(R) {
  return (u, v, F) => {
    const row = Math.floor(v / 3), st = row % 2 ? 3 : 0, tu = (((u + st) % 5) + 5) % 5, vv = ((v % 3) + 3) % 3, k = L1(F);
    if (tu === 0 || vv === 2) return p1(R, 2 + k);
    const h = bhash(Math.floor((u + st) / 5), row, 202);
    return p1(R, (h < 0.3 ? 0 : h < 0.85 ? 1 : 2) + k);
  };
}
function m1Straw(R) {
  return (u, v, F) => {
    const k = L1(F), c = Math.floor(u / 2), h = bhash(c, 0, 203), t = v / F.L;
    let i = h < 0.3 ? 0 : h < 0.8 ? 1 : 2;
    if (((v + Math.floor(h * 3)) % 7) === 0) i += 1;
    if (t > 0.8) i += 1; if (t < 0.15) i -= 1;
    if (F.cap && v < 2) i = 2;
    if (v > F.L) { if (v > F.L + 1 + (h < 0.5 ? 1 : 0)) return null; return p1(R, 3); }
    return p1(R, i + k);
  };
}
function m1Ivy(base, patches, R = P1.ivy) {
  return (u, v, F) => {
    for (const p of patches) {
      const d = Math.hypot((u - p.u) / p.rx, (v - p.v) / p.ry) + (bhash(u, v, 204) - 0.5) * 0.5;
      if (d < 1) { const h = bhash(u + v, v - u, 205); return p1(R, (h < 0.25 ? 0 : h < 0.75 ? 1 : 2) + (d > 0.8 ? 1 : 0) + L1(F)); }
    }
    return base(u, v, F);
  };
}
function m1Awning(A = P1.red, B = P1.white) { return (u, v, F) => p1(Math.floor(u / 4) % 2 ? B : A, ((u % 4) + 4) % 4 === 0 ? 1 : 0 + (v > F.L - 1.5 ? 1 : 0), 2); }
const m1Fascia = (u, v, F) => (v > F.T - 1 ? P1.fascia[0] : P1.fascia[F.li >= 2 ? 2 : 1]);
const m1FasciaDark = (u, v, F) => (v > F.T - 1 ? P1.beamD[0] : P1.beamD[1]);

// --- стены ---
function m1Stone(R, cw = 5, ch = 3) {
  return (u, v, F) => {
    const row = Math.floor(v / ch), st = row % 2 ? Math.floor(cw / 2) : 0, uu = (((u + st) % cw) + cw) % cw, vv = ((v % ch) + ch) % ch, k = L1(F);
    if (F.fu != null) {   // шов в 1 пиксель растра, скол-блик сверху-слева, тень снизу-справа, шероховатость
      if ((uu === 0 && F.fu < 0.4) || (vv === 0 && F.fv < 0.4)) return p1(R, 3);
      const h = bhash(Math.floor((u + st) / cw), row, 211); let i = h < 0.3 ? 0 : h < 0.8 ? 1 : 2; if (F.h && v > F.h - 3) i += 1;
      const c = p1(R, i + k);
      if ((uu === 0 || vv === 0)) return fShade(c, 1.12);
      if ((uu === cw - 1 && F.fu > 0.6) || (vv === ch - 1 && F.fv > 0.6)) return fShade(c, 0.84);
      return fShade(c, fGrain(F, 938, 0.12));
    }
    if (uu === 0 || vv === 0) return p1(R, 3);
    const h = bhash(Math.floor((u + st) / cw), row, 211);
    let i = h < 0.3 ? 0 : h < 0.8 ? 1 : 2;
    if (vv === 1 && i > 0) i -= 1;                                  // светлый верх камня
    if (F.h && v > F.h - 3) i += 1;                                 // тень под свесом
    return p1(R, i + k);
  };
}
function m1Plaster(R, o = {}) {
  const B = o.beam || P1.beam, bay = o.bay || 14, low = o.low || 0;
  return (u, v, F) => {
    if (low && v < low) return m1Stone(o.stoneR || P1.stone)(u, v, F);
    const k = L1(F), w = F.w, h = F.h;
    if (o.frame) {
      const inB = (() => {
        if (v < 2 || v > h - 3) return true;
        if (u < 2 || u > w - 3) return true;
        if (o.mid && Math.abs(v - h * 0.55) < 1) return true;
        const n = Math.max(1, Math.round(w / bay)), bw = w / n, kx = Math.floor(u / bw), lu = u - kx * bw;
        if (lu < 1 || lu > bw - 2) return true;
        if (o.brace !== false && kx % 2 === (o.braceOdd ? 1 : 0)) { const t = (v - low) / (h - low); const bx = o.braceX ? bw - t * bw : t * bw; if (Math.abs(lu - bx) < 1.3) return true; }
        return false;
      })();
      if (inB) return F.fu != null ? fShade(p1(B, 1 + k), fGrain(F, 942, 0.14)) : p1(B, 1 + k);
    }
    let i = k;
    if (bhash(u, v, 212) < 0.04) i += 1;
    if (F.h && v > F.h - 3) i += 1;
    if (F.fu != null) {   // штукатурка: мелкая шероховатость, редкие волосяные трещины и затёки
      const c = p1(R, i), cr = bhash(Math.floor(u / 6), Math.floor(v / 5), 939);
      if (cr < 0.12 && Math.abs((u % 6) + F.fu - 3 - Math.sin((v + F.fv) * 1.3) * 1.2) < 0.18) return fShade(c, 0.86);
      return fShade(c, fGrain(F, 940, 0.09) * (bhash(Math.floor(u / 3), Math.floor(v / 2), 941) < 0.15 ? 0.97 : 1));
    }
    return p1(R, i);
  };
}

// ---- мелкая фактура при растре ×3 (FINE > 1): F.fu, F.fv — положение внутри мирового пикселя, F.fx, F.fy — пиксель растра ----
const fShade = (c, k) => (k === 1 ? c : [Math.min(255, c[0] * k) | 0, Math.min(255, c[1] * k) | 0, Math.min(255, c[2] * k) | 0]);
const fGrain = (F, s, a = 0.07) => 1 + (bhash(F.fx, F.fy, s) - 0.5) * a;   // зерно по пикселям растра
// доски: шов в 1 пиксель растра, светлая кромка после шва и тень перед ним, волокна вдоль доски, редкие сучки и шляпки гвоздей
function fPlank(c, R, a, aa, pw, along, F) {
  if (F.fu == null) return c;
  const sub = (aa + F.fu) / pw, board = Math.floor(a / pw);
  if (aa === 0) return F.fu < 0.34 ? p1(R, 3) : fShade(c, 1.12);
  if (aa === pw - 1 && F.fu > 0.66) return fShade(c, 0.86);
  const L = along + F.fv, col = Math.floor(sub * pw * 3);
  const wav = Math.sin(L * 0.45 + board * 1.7) * 0.6;
  if (bhash(board, Math.floor(sub * pw * 3 + wav), 931) < 0.22) return fShade(c, 0.9);   // волокно
  const kn = Math.floor(L / 9), kx = 0.25 + bhash(board, kn, 932) * 0.5, ky = kn * 9 + 4.5;
  if (bhash(board, kn, 933) < 0.18 && (sub - kx) ** 2 * pw * pw + (L - ky) ** 2 * 0.6 < 0.8) return fShade(c, 0.72);   // сучок
  if (((L % 12) + 12) % 12 < 0.4 && Math.abs(sub - 0.5) < 0.12) return fShade(c, 0.65);   // гвоздь
  return fShade(c, fGrain(F, 934, 0.05) * (col % 3 === 0 ? 0.97 : 1));
}
function m1Logs(R) { return (u, v, F) => { const vv = ((v % 4) + 4) % 4, k = L1(F);
  if (F.fu != null) {   // бревно круглое: снизу тень и щель, сверху блик; кора — штрихи вдоль бревна
    const t = (vv + F.fv) / 4; if (t < 0.08) return p1(R, 3);
    let i = t < 0.3 ? 2 : t < 0.55 ? 1 : t < 0.85 ? 0 : 1; if (F.h && v > F.h - 3) i += 1;
    const c = p1(R, i + k), log = Math.floor(v / 4), stroke = bhash(Math.floor((u + F.fu) * 0.7 + bhash(log, 0, 935) * 9), Math.floor((vv + F.fv) * 3), 936);
    return fShade(c, stroke < 0.2 ? 0.88 : stroke > 0.92 ? 1.08 : fGrain(F, 937, 0.05));
  }
  let i = vv === 0 ? 3 : vv === 1 ? 2 : vv === 2 ? 1 : 0; if (vv === 3 && bhash(Math.floor(u / 5), Math.floor(v / 4), 213) < 0.2) i = 1; if (F.h && v > F.h - 3) i += 1; return p1(R, i + (vv === 0 ? 0 : k)); }; }
function m1Plank(R, pw = 4, ver = true) { return (u, v, F) => { const a = ver ? u : v, aa = ((a % pw) + pw) % pw, k = L1(F); if (aa === 0 && F.fu == null) return p1(R, 3); const h = bhash(Math.floor(a / pw), 0, 214); let i = h < 0.3 ? 0 : h < 0.85 ? 1 : 2; if (F.h && v > F.h - 3) i += 1; const c = p1(R, i + k); if (F.fu == null) return c; const F2 = ver ? F : Object.assign({}, F, { fu: F.fv, fv: F.fu }); return fPlank(c, R, a, aa, pw, ver ? v : u, F2); }; }
function m1Brick(R) { return (u, v, F) => { const row = Math.floor(v / 3), st = row % 2 ? 3 : 0, uu = (((u + st) % 6) + 6) % 6, vv = ((v % 3) + 3) % 3, k = L1(F); if (F.fu != null) { if ((uu === 0 && F.fu < 0.45) || (vv === 0 && F.fv < 0.45)) return p1(R, 3); const h = bhash(Math.floor((u + st) / 6), row, 215); const c = p1(R, (h < 0.25 ? 0 : h < 0.8 ? 1 : 2) + k); return fShade(c, (uu === 0 || vv === 0) ? 1.1 : fGrain(F, 943, 0.12)); } if (uu === 0 || vv === 0) return p1(R, 3); const h = bhash(Math.floor((u + st) / 6), row, 215); return p1(R, (h < 0.25 ? 0 : h < 0.8 ? 1 : 2) + k); }; }
const m1Flat = c => () => c;

// --- окна и двери (рама 1 px) ---
function m1Window(o = {}) {
  const G = o.G || (o.lit === false ? P1.glassD : P1.glass), Fr = o.frameR || P1.beam, w = o.w, h = o.h;
  return (u, v) => {
    const cx = (w - 1) / 2, cy = (h - 1) / 2;
    if (o.round) { const r = Math.min(w, h) / 2, d = Math.hypot(u - cx, v - cy); if (d > r) return null; if (d > r - 1.2) return Fr[1]; if (Math.abs(u - cx) < 0.6 || Math.abs(v - cy) < 0.6) return Fr[2]; return G[u < cx && v > cy ? 0 : u > cx && v < cy ? 2 : 1]; }
    if (o.arch) { const r = (w - 1) / 2; if (v > h - 1 - r) { const d = Math.hypot(u - cx, v - (h - 1 - r)); if (d > r + 0.5) return null; if (d > r - 0.6) return Fr[1]; } }
    if (u < 1 || u > w - 2 || v < 1 || v > h - 2) return Fr[v < 1 ? 1 : 1];
    if (o.sill && v < 2) return P1.plank[0];
    if (o.cross !== false && (Math.abs(u - cx) < 0.6 || Math.abs(v - cy) < 0.6)) return Fr[2];
    const t = (u - 1) / (w - 3) + (1 - (v - 1) / (h - 3));
    return G[t < 0.6 ? 0 : t < 1.3 ? 1 : 2];
  };
}
function m1Door(o = {}) {
  const R = o.col || P1.plank, w = o.w, h = o.h, cx = (w - 1) / 2;
  return (u, v) => {
    if (o.arch) { const r = (w - 1) / 2; if (v > h - 1 - r && Math.hypot(u - cx, v - (h - 1 - r)) > r + 0.5) return null; }
    if (u < 1 || u > w - 2 || v > h - 2) return P1.beam[2];
    if (o.double && Math.abs(u - cx) < 0.6) return P1.beam[3];
    const uu = ((u % 3) + 3) % 3;
    if (uu === 0) return R[3];
    if ((v > 3 && v < 5) || (v > h - 7 && v < h - 5)) return P1.iron[uu === 1 ? 0 : 1];
    if (o.knob && Math.abs(u - (w - 3)) < 0.6 && Math.abs(v - h / 2) < 0.6) return P1.gold[1];
    return R[uu === 1 ? 1 : 2];
  };
}
function m1RoundDoor(o = {}) {
  const R = o.col || P1.plank, w = o.w, h = o.h, cx = (w - 1) / 2, cy = (h - 1) / 2, r = Math.min(w, h) / 2;
  return (u, v) => { const d = Math.hypot(u - cx, v - cy); if (d > r) return null; if (d > r - 1.2) return P1.beam[2]; if (d < 1) return P1.gold[1]; const uu = (((u + 1) % 3) + 3) % 3; return uu === 0 ? R[3] : R[uu === 1 ? 1 : 2]; };
}
// рисунок как материал грани (вывеска на фронтоне)
function m1Sprite(w, h, draw) { const buf = new Map(); draw((x, y, c) => { if (c) buf.set(x + ',' + y, c); }); return (u, v) => buf.get(Math.round(u - w / 2) + ',' + Math.round(h / 2 - v - 0.5)) || null; }

// --- реквизит ×1 (экранные пиксели, опора в (0,0)) ---
const Q1 = {
  barrel(P, w = 9, h = 11, R = P1.plank) {
    for (let y = -h; y <= 0; y++) for (let x = 0; x < w; x++) { let i = x === 0 || x === w - 1 ? 3 : x < 3 ? 0 : x < 6 ? 1 : 2; if ((y + h) % 4 === 0 && x > 0 && x < w - 1) { P(x - (w >> 1), y, P1.iron[x < 4 ? 0 : 1]); continue; } if (y === -h) i = 2; P(x - (w >> 1), y, R[i]); }
    for (let x = 1; x < w - 1; x++) P(x - (w >> 1), -h - 1, R[3]);
  },
  crate(P, s = 8, R = P1.plank) { for (let y = -s; y <= 0; y++) for (let x = 0; x < s; x++) { let i = 1; if (x === 0 || x === s - 1 || y === -s || y === 0) i = 3; else if (x === y + s || x === s - 1 - (y + s)) i = 2; else if (x === 1 || y === -s + 1) i = 0; P(x, y, R[i]); } for (let k = 1; k <= 3; k++) for (let x = 0; x < s; x++) P(x + k, -s - k, R[k === 3 ? 3 : 0]); for (let k = 1; k <= 3; k++) for (let y = -s; y <= 0; y++) P(s - 1 + k, y - k, R[k === 3 ? 3 : 2]); },
  sack(P, w = 7, h = 9, R = P1.cloth) { PR.ell(P, 0, -h / 2, w / 2, h / 2, (x, y, a, b) => R[a < -0.3 && b < 0 ? 0 : a > 0.5 || b > 0.6 ? 2 : 1]); P(0, -h, R[2]); P(-1, -h + 1, R[2]); P(1, -h + 1, R[2]); },
  tree(P, r = 13, R = P1.grass) { PR.rect(P, -1, -r + 2, 0, 0, P1.trunk[1]); P(-1, -r + 4, P1.trunk[0]); for (const [cx, cy, rr, s] of [[0, -r - 3, r, 1], [-r * 0.45, -r - 6, r * 0.6, 0], [r * 0.4, -r - 1, r * 0.55, 1], [0, -r - r * 0.55, r * 0.5, 0]]) PR.ell(P, cx, cy, rr, rr * 0.85, (x, y, a, b) => { const e = a * a + b * b; let i = s + (e > 0.6 ? 1 : 0) + (a > 0.35 || b > 0.45 ? 1 : 0); if (bhash(x, y, 221) < 0.12 && e < 0.7) i -= 1; return p1(R, i, 2); }); },
  smoke(P) { for (const [cx, cy, r, t] of [[0, -4, 2.2, 0], [2, -9, 2.8, 0], [-1, -15, 3.2, 1], [3, -21, 3.6, 1], [0, -27, 3.6, 2]]) PR.ell(P, cx, cy, r, r * 0.8, (x, y, a, b) => (t < 2 || bdith(x, y) < 0.5 ? P1.smoke[t === 0 ? (a < 0 ? 0 : 1) : t] : null)); },
  lantern(P) { PR.rect(P, -1, -6, 1, -2, P1.iron[2]); P(0, -5, P1.glass[1]); P(0, -4, P1.glass[0]); P(0, -7, P1.iron[1]); for (const [x, y] of [[-3, -5], [3, -4], [-2, -8], [2, -8], [0, 0], [-3, -1], [3, -2]]) P(x, y, P1.gold[0]); },
  streetLamp(P, h = 22) { PR.rect(P, 0, -h, 0, 0, P1.iron[2]); PR.rect(P, -1, 0, 1, 0, P1.iron[2]); PR.rect(P, -1, -h - 5, 1, -h, P1.iron[2]); P(0, -h - 3, P1.glass[0]); P(0, -h - 2, P1.glass[1]); for (const [x, y] of [[-3, -h - 3], [3, -h - 2], [-2, -h - 7], [2, -h - 7], [-4, -h], [4, -h - 1], [0, -h - 9]]) P(x, y, P1.gold[0]); },
  sign(P, kind, dir = 1, w = 12, h = 9) {
    const x0 = dir > 0 ? 2 : -2 - w, y0 = -h - 2;
    for (let x = 0; x <= Math.abs(dir * 7); x++) P(x * dir, -h - 4, P1.iron[1]);
    P(x0 + (dir > 0 ? 2 : w - 3), -h - 3, P1.iron[2]); P(x0 + (dir > 0 ? w - 3 : 2), -h - 3, P1.iron[2]);
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) P(x, y, P1.plank[x === x0 || x === x0 + w - 1 || y === y0 || y === y0 + h - 1 ? 3 : 1]);
    Q1.icon(P, kind, x0 + (w >> 1), y0 + (h >> 1));
  },
  board(P, kind, w = 16, h = 10) { const x0 = -(w >> 1), y0 = -(h >> 1); for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) P(x, y, P1.plank[x === x0 || x === x0 + w - 1 || y === y0 || y === y0 + h - 1 ? 3 : y === y0 + 1 ? 0 : 1]); Q1.icon(P, kind, 0, 0); },
  icon(P, kind, cx, cy) {
    if (kind === 'mug') { PR.rect(P, cx - 2, cy - 1, cx + 1, cy + 3, P1.gold[1]); P(cx - 2, cy + 3, P1.gold[2]); PR.rect(P, cx + 2, cy, cx + 2, cy + 2, P1.gold[2]); PR.rect(P, cx - 3, cy - 2, cx + 1, cy - 2, P1.white[0]); P(cx - 1, cy - 3, P1.white[0]); }
    else if (kind === 'skull') { PR.rect(P, cx - 2, cy - 2, cx + 2, cy, P1.white[0]); PR.rect(P, cx - 1, cy + 1, cx + 1, cy + 1, P1.white[1]); P(cx - 1, cy - 1, P1.ink); P(cx + 1, cy - 1, P1.ink); P(cx - 3, cy + 2, P1.white[1]); P(cx + 3, cy + 2, P1.white[1]); P(cx - 3, cy - 3, P1.white[1]); P(cx + 3, cy - 3, P1.white[1]); }
    else if (kind === 'lamp') { PR.ell(P, cx, cy, 2.6, 2.6, (x, y, a, b) => (a * a + b * b > 0.6 ? P1.iron[2] : a < 0 && b < 0 ? P1.glass[0] : P1.glass[1])); P(cx, cy - 3, P1.iron[1]); }
  },
  table(P, w = 14) { PR.rect(P, -w / 2, -7, w / 2, -6, P1.plank[0]); PR.rect(P, -w / 2 + 1, -5, w / 2 - 1, -5, P1.plank[2]); P(-w / 2 + 1, -4, P1.plank[2]); P(-w / 2 + 1, -3, P1.plank[2]); P(w / 2 - 1, -4, P1.plank[2]); P(w / 2 - 1, -3, P1.plank[2]); PR.rect(P, -w / 2 - 2, -2, w / 2 + 2, -2, P1.plank[1]); P(-w / 2 - 1, -1, P1.plank[3]); P(w / 2 + 1, -1, P1.plank[3]); P(-1, -9, P1.gold[1]); P(0, -9, P1.gold[1]); P(-1, -8, P1.gold[1]); P(0, -8, P1.gold[1]); P(-1, -10, P1.white[0]); P(0, -10, P1.white[0]); },
  bench(P, w = 10) { PR.rect(P, -w / 2, -3, w / 2, -3, P1.plank[0]); PR.rect(P, -w / 2, -2, w / 2, -2, P1.plank[2]); P(-w / 2 + 1, -1, P1.plank[3]); P(w / 2 - 1, -1, P1.plank[3]); },
  steps(P, w = 12, n = 2) { for (let k = 0; k < n; k++) { const y = -k * 2, hw = (w >> 1) - k; PR.rect(P, -hw, y - 1, hw, y - 1, P1.stone[k === n - 1 ? 0 : 1]); PR.rect(P, -hw, y, hw, y, P1.stone[2]); } },
  stones(P) { for (const [cx, cy, r] of [[0, 0, 2.2], [4, -1, 1.6], [-3, -1, 1.6]]) PR.ell(P, cx, cy, r, r * 0.7, (x, y, a, b) => P1.stone[b < -0.3 ? 0 : a > 0.4 ? 2 : 1]); },
  flowers(P, w = 10) { for (let x = 0; x < w; x++) { const h = 1 + (bhash(x, 0, 231) * 2 | 0); PR.rect(P, x, -h, x, 0, P1.grass[1 + (x % 2)]); if (x % 2 === 1) P(x, -h - 1, [P1.red[0], P1.gold[0], P1.white[0], P1.scale[0]][(bhash(x, 1, 232) * 4) | 0]); } },
  planter(P, w = 9) { PR.rect(P, -(w >> 1), -3, (w >> 1), 0, P1.plank[2]); PR.rect(P, -(w >> 1), -3, (w >> 1), -3, P1.plank[0]); for (let x = -(w >> 1) + 1; x < (w >> 1); x++) { P(x, -4, P1.ivy[1 + (x % 2 ? 1 : 0)]); if (x % 3 === 0) P(x, -5, [P1.red[0], P1.gold[0], P1.white[0]][((x + 30) / 3 | 0) % 3]); } },
  hay(P, r = 7) { PR.ell(P, 0, -r, r, r * 0.9, (x, y, a, b) => P1.straw[a < -0.3 && b < -0.2 ? 0 : a > 0.4 || b > 0.5 ? 2 : (bhash(x, y, 241) < 0.2 ? 2 : 1)]); },
  sunflower(P, h = 16) { PR.rect(P, 0, -h, 0, 0, P1.grass[1]); P(1, -h / 2 | 0, P1.grass[2]); P(-1, -(h * 0.7) | 0, P1.grass[2]); PR.ell(P, 0, -h, 3.2, 3.2, (x, y, a, b) => (a * a + b * b < 0.25 ? P1.beam[2] : P1.gold[(x + y) % 2 ? 0 : 1])); },
  pumpkin(P) { PR.ell(P, 0, -2.5, 3.5, 2.8, (x, y, a, b) => (x % 3 === 0 ? P1.tileR[2] : a < -0.3 && b < -0.2 ? P1.gold[1] : P1.tileR[1])); P(0, -6, P1.grass[2]); },
  barrow(P) { PR.rect(P, -5, -5, 4, -3, P1.plank[1]); PR.rect(P, -5, -6, 4, -6, P1.plank[0]); PR.rect(P, 4, -4, 8, -4, P1.plank[2]); P(-4, -2, P1.plank[3]); PR.ell(P, 1, -1, 2.2, 2.2, (x, y, a, b) => (a * a + b * b > 0.5 ? P1.plank[3] : P1.iron[1])); P(-3, -7, P1.red[0]); P(-1, -7, P1.gold[0]); P(1, -7, P1.grass[0]); },
  pennant(P, h = 12, R = P1.red) { PR.rect(P, 0, -h, 0, 0, P1.beam[2]); for (let y = -h; y < -h + 4; y++) { const len = 6 - (y + h) * 1.5; for (let x = 1; x <= len; x++) P(x, y, R[x > len - 1 ? 1 : 0]); } P(0, -h - 1, P1.gold[1]); },
  banner(P, R = P1.red, w = 5, h = 8) { for (let y = 0; y < h; y++) { const hw = Math.round(w / 2 * (1 - y / h)); for (let x = -hw; x <= hw; x++) P(x, y, R[x === hw ? 1 : 0]); } PR.rect(P, -w / 2 - 1, 0, w / 2 + 1, 0, P1.beam[2]); },
  ladder(P, h = 20) { for (let y = -h; y <= 0; y++) { P(-2, y, P1.plank[2]); P(2, y, P1.plank[3]); if (((y + h) % 4) === 2) { P(-1, y, P1.plank[1]); P(0, y, P1.plank[1]); P(1, y, P1.plank[1]); } } },
  logs(P) { for (let r = 0; r < 2; r++) for (let k = 0; k < 4 - r; k++) PR.ell(P, k * 4 + r * 2, -2 - r * 3.4, 2, 1.8, (x, y, a, b) => (a * a + b * b > 0.55 ? P1.log[3] : a * a + b * b < 0.15 ? P1.log[0] : P1.log[a < 0 ? 1 : 2])); },
  bell(P) { PR.rect(P, -1, -4, 1, -2, P1.gold[1]); PR.rect(P, -2, -1, 2, -1, P1.gold[2]); P(0, -5, P1.iron[2]); P(-1, -3, P1.gold[0]); P(0, 0, P1.gold[2]); },
  mushroom(P, r = 3, R = P1.red) { PR.rect(P, -1, -r + 1, 0, 0, P1.cloth[1]); PR.ell(P, 0, -r, r, r * 0.7, (x, y, a, b) => (b > 0.6 ? null : R[a < -0.3 && b < -0.2 ? 0 : a > 0.4 ? 2 : 1])); P(0, -r - 1, P1.white[0]); P(-2, -r, P1.white[0]); },
};

// --- кровли ×1, уточнение: чёткая черепица (плитка 5×4), дранка, солома своих оттенков ---
function m1Tile2(R) {
  // черепица «монах-монашка»: плитка 6×5, выпуклая (слева блик, справа тень), нахлёст рядов со щелью, разброс тона по плиткам
  return (u, v, F) => {
    const k = L1(F);
    if (v < 3) return p1(R, v < 1 ? 1 + k : 2 + k);                  // коньковая черепица
    const vv0 = v - 3, row = Math.floor(vv0 / 5), st = row % 2 ? 3 : 0, tu = (((u + st) % 6) + 6) % 6, vv = ((vv0 % 5) + 5) % 5;
    const id = Math.floor((u + st) / 6), h = bhash(id, row, 281);
    if (vv === 4) return tu === 0 ? R[3] : p1(R, 2 + k + (tu > 3 ? 1 : 0));   // тень-нахлёст под рядом
    if (tu === 0) return R[3];                                        // шов
    let i = tu === 1 ? 0 : tu <= 3 ? 1 : 2;                           // выпуклость плитки
    if (vv === 0 && tu < 4) i -= 1;                                   // блик на кромке
    if (h < 0.15) i += 1; else if (h > 0.9) i -= 1;                   // старая/новая плитка
    if (h > 0.97 && vv > 0 && vv < 3) return P1.moss ? p1(BP.moss, 1 + k, 3) : p1(R, 2);   // редкий мох
    return p1(R, i + k);
  };
}
function m1Shingle(R) {
  return (u, v, F) => {
    const row = Math.floor(v / 3), st = row % 2 ? 2 : 0, tu = (((u + st) % 4) + 4) % 4, vv = ((v % 3) + 3) % 3, k = L1(F);
    if (v < 2) return p1(R, 2 + k);
    const h = bhash(Math.floor((u + st) / 4), row, 251);
    if (vv === 2) return p1(R, (tu === 0 || tu === 3) ? 2 + k : 3);  // скруглённый низ пластины
    if (tu === 0) return p1(R, 2 + k);
    if (vv === 0 && h > 0.5) return p1(R, 0 + k);
    return p1(R, (h < 0.15 ? 0 : h < 0.93 ? 1 : 2) + k);
  };
}
function m1Straw2(R) {
  return (u, v, F) => {
    const k = L1(F), c = Math.floor(u / 2), h = bhash(c, 0, 261), t = v / F.L;
    if (v > F.L) { if (v > F.L + 1 + (h < 0.5 ? 1 : 0)) return null; return p1(R, 3); }
    let i = h < 0.25 ? 0 : h < 0.8 ? 1 : 2;
    const course = (v + Math.floor(h * 3)) % 8;
    if (course === 0) i += 1; else if (course === 7) i -= 1;        // слои соломы
    if (bhash(c, 1, 262) < 0.06) i += 1;                            // борозда
    if (t > 0.78) i += 1; if (t < 0.12) i -= 1;
    if (F.cap && v < 3) i = v < 1 ? 0 : 2;                          // конёк: валик с прутьями
    if (F.cap && v < 3 && v >= 1 && ((u % 6) + 6) % 6 === 0) i = 3;
    return p1(R, i + k);
  };
}
const STRAW1 = {   // солома трактира — четыре своих оттенка (не золотая, как у склада и школы)
  rye: bramp(['#eab874', '#cc9050', '#a46a32', '#744822']),      // ржаная, рыже-медовая
  olive: bramp(['#cfc784', '#a8a25c', '#807a3c', '#565226']),    // оливковая, старая
  wheat: bramp(['#f6e6a6', '#d8c676', '#b09a4c', '#7c6c30']),    // светлая пшеничная
  reed: bramp(['#c4a070', '#a07c4e', '#7a5c34', '#523c20']),     // камышовая, тёмная
};
const SHINGLE1 = bramp(['#b48a5c', '#8e6840', '#6c4c2c', '#48321c']);

// Солома объёмная: 4-тоновый градиент конёк→свес с дизерингом, курсы слоями (блик сверху, тень снизу),
// пряди колонками, валик конька, толстый свес с торцами (материал cut — m1StrawCut)
function m1Straw3(R) {
  return (u, v, F) => {
    const fine = F.fu != null, su = fine ? u + F.fu : u, sv = fine ? v + F.fv : v;   // на мелком растре пряди тоньше мирового пикселя
    const k = L1(F), L = F.L, t = sv / L, c = fine ? Math.floor(su * 1.5) : Math.floor(u / 2), h = bhash(c, 0, 271);
    if (v > L) { const len = 1 + (bhash(c, 1, 272) * 2 | 0); if (sv > L + len) return null; return p1(R, 3); }
    // базовый тон по положению на скате, с дизерингом между зонами
    const dth = fine ? bhash(F.fx, F.fy, 277) : bdith(u, v);
    let i = t + (dth - 0.5) * 0.35 < 0.22 ? 0 : t + (dth - 0.5) * 0.35 < 0.62 ? 1 : 2;
    if (fine && bhash(c, Math.floor(sv / 3), 278) < 0.12) i += 1;   // отдельные тёмные стебли
    // пряди: часть колонок светлее/темнее
    if (h < 0.18) i -= 1; else if (h > 0.84) i += 1;
    // курсы: слой каждые 7 px, сверху блик, снизу тень
    const cv = (v + Math.floor(bhash(Math.floor(u / 6), 0, 273) * 3)) % 7;
    if (cv === 0) i -= 1; else if (cv === 6) i += 1; else if (cv === 5 && bhash(u, v, 274) < 0.5) i += 1;
    if (bhash(c, 2, 275) < 0.05 && cv > 1) i += 2;                                  // глубокая борозда
    if (F.cap && v < 4) { i = v < 1 ? 0 : v < 3 ? 1 : 2; if (v >= 1 && v < 3 && ((u % 5) + 5) % 5 === 0) i = 3; }   // валик конька с прутьями
    return p1(R, i + k);
  };
}
function m1StrawCut(R) { return (u, v, F) => (v > F.T - 1 ? p1(R, 1) : ((u + (v | 0)) % 3 === 0 ? p1(R, 3) : p1(R, 2 + (bhash(u, v, 276) < 0.3 ? 1 : 0)))); }
STRAW1.olive = bramp(['#d8d08c', '#aeaa60', '#84803e', '#585424']);

// Чешуя крупная: пластины 6×5, полукруглый низ с тёмной каймой, блик слева сверху, тень справа, разброс тона
function m1Scale2(R) {
  return (u, v, F) => {
    const k = L1(F);
    if (v < 3) return p1(R, v < 1 ? 1 + k : 2 + k);
    const w = v - 3, row = Math.floor(w / 5), st = row % 2 ? 3 : 0, tu = (((u + st) % 6) + 6) % 6, vv = ((w % 5) + 5) % 5;
    const id = Math.floor((u + st) / 6), h = bhash(id, row, 311);
    const d = Math.hypot(tu - 2.5, Math.max(0, vv - 1.5) * 1.6);       // скругление нижнего края
    if (d > 3.2) return p1(R, 1 + k);                                  // зазор — виден ряд ниже
    if (d > 2.4) return R[3];                                          // кайма пластины
    let i = tu < 2 && vv < 2 ? 0 : tu > 3 || vv > 2 ? 2 : 1;
    if (h < 0.15) i += 1; else if (h > 0.9) i -= 1;
    return p1(R, i + k);
  };
}

// Дранка подробная: ряды по 4 px, пластины 3–6 px разной ширины и тона, блик по верхней кромке, тень-нахлёст снизу,
// волокна, у свеса темнее. Мох — пятнами и полосой у свеса (moss: 0..1 — сколько).
function m1Shingle2(R, moss = 0.5) {
  const M = P1.ivy;
  return (u, v, F) => {
    const k = L1(F);
    if (v < 2) return p1(R, 2 + k);
    const row = Math.floor((v - 2) / 4), vv = ((v - 2) % 4 + 4) % 4;
    // ширина пластины: накопленная граница по хэшу
    const st = Math.floor(bhash(row, 1, 601) * 6), x = u + st, cell = Math.floor(x / 5), cw = 3 + Math.floor(bhash(cell, row, 602) * 3), uu = x - cell * 5;
    const id = cell * 7 + row;
    // мох: пятна (крупные ячейки) + полоса у свеса, с рваным краем через дизеринг
    if (moss > 0) {
      const t = v / F.L, cx = Math.floor(u / 14), cy = Math.floor(v / 10);
      const blob = bhash(cx, cy, 603) < 0.38 * moss ? 1 - Math.hypot((u % 14) - 7, ((v % 10) - 5) * 1.3) / 7 : 0;
      const eave = t > 0.82 ? (t - 0.82) * 5 * moss : 0;
      const m = Math.max(blob, eave) + (bdith(u, v) - 0.5) * 0.6;
      if (m > 0.35) return M[bcl((m > 0.75 ? 1 : 2) + (bhash(u, v, 604) < 0.2 ? 1 : 0) + k - (vv === 0 ? 1 : 0), 3)];
    }
    if (uu >= cw) return p1(R, 3);                                   // щель между пластинами
    if (vv === 3) return p1(R, 3 - (uu === 0 ? 0 : 1) + k > 3 ? 3 : 2 + k);   // тень-нахлёст
    const h = bhash(id, 0, 605);
    let i = h < 0.22 ? 0 : h < 0.8 ? 1 : 2;
    if (vv === 0) i -= 1;                                            // блик по кромке
    if (uu === 0 && vv > 0) i -= 1;                                  // светлый левый край
    if (uu === cw - 1) i += 1;                                       // тёмный правый край
    if (vv === 2 && bhash(u, row, 606) < 0.18) i += 1;               // волокно
    if (v / F.L > 0.85) i += 1;
    return p1(R, i + k);
  };
}

// ======== bvar3.js (помощники) ========
const WIN1 = (w, h, o = {}) => m1Window(Object.assign({ w, h }, o));
const DOOR1 = (w, h, o = {}) => m1Door(Object.assign({ w, h }, o));
function chimney1(g, x, y, z0, h, o = {}) {
  const w = o.w || 5, d = o.d || 5, m = o.brick ? m1Brick(P1.brick) : m1Stone(P1.stone, 4, 3);
  box(g, { x0: x, x1: x + w, y0: y, y1: y + d, z0, h, mat: m, top: m1Flat(P1.stone[2]) });
  box(g, { x0: x - 1, x1: x + w + 1, y0: y - 1, y1: y + d + 1, z0: z0 + h, h: 1.5, mat: m1Flat(P1.stone[1]), top: m1Flat(P1.stone[0]) });
  g.face([[x + 1, y + 1, z0 + h + 1.51], [x + w - 1, y + 1, z0 + h + 1.51], [x + w - 1, y + d - 1, z0 + h + 1.51], [x + 1, y + d - 1, z0 + h + 1.51]], [1, 0, 0], [0, 1, 0], m1Flat(P1.ink), { dz: -0.01 });
  (g.chim = g.chim || []).push([x + w / 2, y + d / 2, z0 + h + 2]);
  if (o.smoke !== false && !g.noSmoke) g.sprite([x + w / 2, y + d / 2, z0 + h + 2], P => Q1.smoke(P), -3);   // в игре дым рисует render.js по spr.chimneys
}
function post1(g, x, y, z0, h, s = 2, R = P1.beam) { box(g, { x0: x, x1: x + s, y0: y, y1: y + s, z0, h, mat: (u, v, F) => R[F.li === 0 ? 1 : 2], top: m1Flat(R[1]) }); }
function beam1(g, x0, x1, y0, y1, z0, h, R = P1.beam) { box(g, { x0, x1, y0, y1, z0, h, mat: (u, v, F) => R[F.li === 0 ? 1 : 2], top: m1Flat(R[0]) }); }
function fence1(g, x0, x1, y0, y1, h = 6) {
  const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / 8));
  for (let k = 0; k <= n; k++) post1(g, x0 + (x1 - x0) * k / n - 1, y0 + (y1 - y0) * k / n - 1, 0, h, 2, P1.plank);
  for (const z of [h - 2, h * 0.4]) beam1(g, Math.min(x0, x1) - 0.5, Math.max(x0, x1) + 0.5, Math.min(y0, y1) - 0.5, Math.max(y0, y1) + 0.5, z, 1, P1.plank);
}
function railing1(g, x0, x1, y0, y1, z0, h = 6, R = P1.plank) {
  const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / 7));
  for (let k = 0; k <= n; k++) box(g, { x0: x0 + (x1 - x0) * k / n - 0.5, x1: x0 + (x1 - x0) * k / n + 0.5, y0: y0 + (y1 - y0) * k / n - 0.5, y1: y0 + (y1 - y0) * k / n + 0.5, z0, h, mat: (u, v, F) => R[F.li === 0 ? 1 : 3], top: m1Flat(R[1]) });
  for (const z of [h - 1, h * 0.4]) box(g, { x0: Math.min(x0, x1) - 0.5, x1: Math.max(x0, x1) + 0.5, y0: Math.min(y0, y1) - 0.5, y1: Math.max(y0, y1) + 0.5, z0: z0 + z, h: 1, mat: (u, v, F) => R[F.li === 0 ? 0 : 2], top: m1Flat(R[0]) });
}
const rzOf = (b, r) => { const ze = b.h + (b.z0 || 0) - (r.drop ?? 1), zr = b.h + (b.z0 || 0) + r.rise, ya = b.y0 - (r.ov ?? 3), ym = (b.y0 + b.y1) / 2; return y => ze + (y - ya) / (ym - ya) * (zr - ze); };
const split1 = (low, a, b) => (u, v, F) => (v < low ? a(u, v, F) : b(u, v, F));
const S = (list, fn) => { for (const a of list) fn(...a); };


// ======== bvar4.js (модель трактира) ========
// Единый трактир (сводный из вариантов 2, 3, 4, 6, 7 листа ×1) + игровая механика нынешнего трактира:
// открытая веранда без крыши (стол, гостей, официантку и дождевой тент рисует inside.js поверх спрайта),
// открытая кухня-двор (печь-купол → spr.oven, полки с запасами → spr.pantry, стойка), крыло бара с окном барменши
// → spr.bar, дверь на юге → spr.doorPt, окна → spr.wins. Лот 128×96, дверь на x=80. Масштаб 1 px = 1 мировой px.
// Уровни: 1 — солома (свой оттенок), веранда малая; 2 — дранка, веранда больше, гирлянда и фонари во дворе;
// 3 — черепица, вторая терраса с перголой слева, бочка-бар, сцена для музыканта, балкон на фронтоне.

function m1Shelves(w, h) {
  return (u, v) => {
    for (const r of [3, 9, 15]) { if (v >= r && v < r + 1) return P1.plank[u % 7 === 0 ? 3 : 1]; if (v >= r + 1 && v < r + 2 && u % 7 === 3) return P1.plank[3]; }
    if (u < 1 || u > w - 2) return P1.beam[2];
    if (((u + Math.floor(v / 4)) % 5) === 0) return P1.dark[2];
    return P1.dark[1];
  };
}
function oven1(g, cx, cy) {
  cyl(g, cx, cy, 7, 0, 9, m1Stone(P1.stoneW, 4, 3), 16);
  dome(g, cx, cy, 7.5, 8.5, 6, (u, v, F) => m1Stone(P1.stoneW, 4, 3)(u, v, Object.assign({}, F, { h: 0 })), m1Flat(P1.stoneW[2]), 16, 4, 1);
  elem(g, 'S', cy - 7 + 0.6, cx - 3, 1.5, 6, 5, (u, v) => (v > 3.5 && Math.abs(u - 2.5) > 1.6 ? P1.stoneW[3] : v < 1 ? P1.ink : P1.beam[3]));
  box(g, { x0: cx - 5, x1: cx + 5, y0: cy + 5, y1: cy + 9, z0: 9, h: 10, mat: m1Brick(P1.brick), top: m1Flat(P1.stone[2]) });
}
function S2(list, fn) { for (const a of list) fn(...a); }
// гирлянда флажков между двумя точками (плакат с глубиной середины)
function bunting(g, a, b, n = 7) {
  const A = [g.sx(...g.W3(a).slice(0, 2)), g.sy(g.W3(a)[1], a[2])], B = [g.sx(...g.W3(b).slice(0, 2)), g.sy(g.W3(b)[1], b[2])];
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  g.sprite(mid, (P, bx, by) => {
    const cols = [P1.red, P1.gold, P1.scale, P1.white, P1.grass];
    for (let i = 0; i <= n * 4; i++) { const t = i / (n * 4), x = Math.round(A[0] + (B[0] - A[0]) * t) - bx, y = Math.round(A[1] + (B[1] - A[1]) * t + Math.sin(t * Math.PI) * 4) - by; P(x, y, P1.beam[1]); if (i % 4 === 2) { const R = cols[(i >> 2) % cols.length]; P(x, y + 1, R[0]); P(x - 1, y + 1, R[0]); P(x, y + 2, R[1]); } }
  }, -2);
}
function lampPost(g, x, y) { g.sprite([x, y, 0], P => Q1.streetLamp(P, 16)); }
function mugs(g, x, y, z) { g.sprite([x, y, z], P => { P(0, -2, P1.gold[1]); P(0, -1, P1.gold[1]); P(1, -1, P1.gold[2]); P(0, -3, P1.white[0]); }, -1); }

// roofs: { main, wing, cut, cutW } материалы кровель по уровню
function buildInn(g, lv, roofs) {
  const meta = g.meta = { wins: [], tables: [] };
  const WIN = (side, at, a, z, w, h, o = {}) => { elem(g, side, at, a, z, w, h, m1Window(Object.assign({ w, h }, o))); meta.wins.push({ side, at, a, z, w, h, round: !!o.round }); };
  const deckTop = (u, v) => (((v | 0) % 3) === 0 ? P1.plank[2] : P1.plank[(u + v) % 9 < 1 ? 1 : 0]);
  // ---- главный дом: компактный, отодвинут вглубь — спереди широкая зона действия
  const Lo = { x0: 4, x1: 62, y0: 50, y1: 92, h: 15 }, Up = { x0: 0, x1: 66, y0: 46, y1: 92, z0: 15, h: 18 };   // в левом углу лота; к двери ведёт дорожка от въезда (x=80)
  box(g, Object.assign({ mat: m1Stone(P1.stone) }, Lo));
  beam1(g, 0, 66, 46, 50, 14, 1, P1.plank);
  box(g, Object.assign({ mat: m1Plaster(P1.plaster, { frame: true, bay: 16, mid: true, braceOdd: true }) }, Up));
  roof(g, Up, { type: 'gable', axis: 'Y', rise: 30, ov: 3, ovg: 5, mat: m1Ivy(roofs.main, [{ u: 30, v: 16, rx: 12, ry: 9 }, { u: 18, v: 32, rx: 7, ry: 6 }]), cut: roofs.cut, th: roofs.th || 2, gable: m1Plaster(P1.plaster, { frame: true, bay: 13, brace: false }) });
  chimney1(g, 10, 72, Up.z0 + Up.h, 20, { w: 6, d: 6 });
  WIN('S', Up.y0, 27, 36, 12, 14, { arch: true });
  if (lv >= 3) {
    beam1(g, 20, 46, 40, 46, 34, 2, P1.plank); railing1(g, 20, 46, 40.5, 40.5, 36, 5); railing1(g, 20, 20, 40.5, 46, 36, 5); railing1(g, 46, 46, 40.5, 46, 36, 5);
    g.sprite([33, 40, 41], P => Q1.planter(P, 11), -0.5);
  } else g.sprite([33, 45.5, 35], P => Q1.planter(P, 13), -0.5);
  elem(g, 'S', Up.y0 - 0.3, 25, 52, 16, 7, m1Sprite(16, 7, P => Q1.board(P, 'mug', 16, 7)));
  WIN('S', Lo.y0, 10, 4, 9, 10, { sill: true }); WIN('S', Lo.y0, 46, 4, 9, 10, { sill: true });
  elem(g, 'S', Lo.y0, 26, 0, 14, 15, m1Door({ w: 14, h: 15, arch: true, knob: true }));
  meta.doorPt = [33, Lo.y0, 0];
  for (const x of [6, 22, 50]) { WIN('S', Up.y0, x, 20, 9, 9); if (x !== 22) g.sprite([x + 4.5, 45.5, 19], P => Q1.planter(P, 9), -0.5); }
  WIN('E', Lo.x1, 58, 4, 9, 10, {}); WIN('E', Lo.x1, 78, 4, 9, 10, {}); elem(g, 'E', Lo.x1, 66, 0, 8, 11, m1Door({ w: 8, h: 11, col: P1.dark }));   // дверь на кухню
  WIN('E', Up.x1, 70, 20, 9, 9);
  S2([[21, 44], [43, 44]], (x, y) => post1(g, x, y, 0, 14));
  roof(g, { x0: 21, x1: 45, y0: 46, y1: 50, h: 15 }, { type: 'lean', down: 'S', rise: 3, ov: 2, mat: m1Awning(), cut: m1Flat(P1.red[1]), th: 1 });
  g.sprite([18, 49.5, 12], P => Q1.lantern(P)); g.sprite([48, 49.5, 12], P => Q1.lantern(P));
  g.sprite([33, 49, 0], P => Q1.steps(P, 16, 2));
  // ---- бар-пристройка сзади справа (6): кирпич, холодный фахверк, синяя чешуя, окно барменши
  const Wb = { x0: 104, x1: 126, y0: 66, y1: 92, h: 12 }, Ub = { x0: 102, x1: 126, y0: 64, y1: 92, z0: 12, h: 14 };
  box(g, Object.assign({ mat: m1Brick(P1.brick) }, Wb));
  beam1(g, 102, 126, 64, 66, 11, 1, P1.plank);
  box(g, Object.assign({ mat: m1Plaster(P1.plasterC, { frame: true, bay: 14, mid: true, braceX: true, beam: P1.beamD }) }, Ub));
  roof(g, Ub, { type: 'gable', axis: 'Y', rise: 18, ov: 3, ovg: 4, mat: roofs.wing, cut: roofs.cutW, th: roofs.th || 2, gable: m1Plaster(P1.plasterC, { frame: true, bay: 12, brace: false, beam: P1.beamD }) });
  chimney1(g, 116, 84, Ub.z0 + Ub.h + 3, 16, { brick: true, w: 5, d: 5 });
  WIN('S', Ub.y0, 109, 15, 10, 9, { frameR: P1.beamD });
  meta.bar = [114, Ub.y0 - 0.3, 19.5];
  WIN('S', Ub.y0, 104, 28, 6, 7, { arch: true, frameR: P1.beamD, lit: false });
  WIN('E', Ub.x1, 70, 15, 9, 9, { frameR: P1.beamD }); WIN('E', Ub.x1, 82, 15, 9, 9, { frameR: P1.beamD });
  WIN('S', Wb.y0, 106, 2, 7, 8, { frameR: P1.beamD, lit: false });
  g.sprite([127, 64, 20], P => Q1.sign(P, 'lamp', 1));
  g.sprite([114, 64, 44], P => Q1.pennant(P, 10));
  // ---- кухня-двор справа: каменный пол, печь-купол, стеллаж запасов, стойка с кружками, дрова
  const ky0 = lv === 1 ? 26 : lv === 2 ? 32 : 36;
  box(g, { x0: 100, x1: 126, y0: ky0, y1: 64, h: 0.8, mat: m1Flat(P1.stone[2]), top: (u, v, F) => m1Stone(P1.stoneW, 6, 4)(u, v, Object.assign({}, F, { h: 0 })) });
  oven1(g, 117, 54);
  meta.oven = [117, 47, 3];
  box(g, { x0: 101, x1: 113, y0: 54, y1: 62, h: 15, mat: m1Flat(P1.dark[2]), top: m1Flat(P1.plank[1]) });
  elem(g, 'S', 54, 102, 1, 10, 13, m1Shelves(10, 13));
  meta.pantry = [[104, 53.5, 4], [108, 53.5, 4], [104, 53.5, 10], [108, 53.5, 10]];
  roof(g, { x0: 100, x1: 114, y0: 53, y1: 63, h: 15 }, { type: 'lean', down: 'S', rise: 3, ov: 1, mat: m1Plank(P1.plank, 4, false), cut: m1Flat(P1.plank[3]), th: 1 });
  box(g, { x0: 102, x1: 118, y0: ky0 + 1, y1: ky0 + 5, h: 7, mat: m1Plank(P1.plank, 4), top: m1Flat(P1.plank[0]) });
  for (const x of [105, 110, 115]) mugs(g, x, ky0 + 1, 7);
  g.sprite([124, ky0 + 6, 0.8], P => Q1.logs(P)); g.sprite([104, 48, 0.8], P => Q1.barrel(P, 7, 9)); g.sprite([124, 64, 0.8], P => Q1.sack(P));
  // ---- площадка разгрузки слева у дома: поддон, ящики, мешки, тележка (сюда носят припасы)
  box(g, { x0: 42, x1: 64, y0: 40, y1: 48, h: 1, mat: m1Flat(P1.plank[3]), top: (u, v) => P1.plank[(u | 0) % 4 === 0 ? 3 : 2] });
  g.sprite([44, 41, 1], P => Q1.crate(P, 8)); g.sprite([44, 41, 9], P => Q1.crate(P, 7)); g.sprite([56, 42, 1], P => Q1.sack(P)); g.sprite([62, 46, 1], P => Q1.sack(P, 6, 8)); g.sprite([52, 47, 1], P => Q1.barrel(P, 7, 9));
  meta.stock = [[46, 44, 1], [54, 44, 1], [62, 43, 1], [48, 47, 1], [58, 47, 1]];
  // ---- веранда справа спереди (растёт по уровням), без крыши
  const V = { x0: 98, x1: 126, y0: 4, y1: ky0 - 2 };
  box(g, { x0: V.x0, x1: V.x1, y0: V.y0, y1: V.y1, h: 1.2, mat: m1Flat(P1.plank[2]), top: deckTop });
  railing1(g, V.x1, V.x1, V.y0, V.y1, 1.2, 5); railing1(g, V.x0 + 8, V.x1, V.y0, V.y0, 1.2, 5);
  S2([[98, 4], [123, 4], [123, V.y1 - 3]], (x, y) => post1(g, x, y, 1.2, 14, 2));
  beam1(g, 98, 126, 4, 6, 15, 1.2, P1.plank);
  g.sprite([126, 14, 1.2], P => Q1.planter(P, 9), -0.5);
  meta.porch = [112, 11, 1.2];
  if (lv >= 2) {
    g.sprite([112, V.y1 - 7, 1.2], P => Q1.table(P, 14)); meta.tables.push([112, V.y1 - 7, 1.2]);
    g.sprite([124, 5, 15], P => Q1.lantern(P)); g.sprite([99, 5, 15], P => Q1.lantern(P));
    bunting(g, [98, 6, 15], [58, 46, 32]);
  }
  // ---- пивной двор слева спереди: 1 — скромно; 2 — три стола, фонари, гирлянда; 3 — длинный пиршественный стол под гирляндами
  if (lv === 1) {
    fence1(g, 4, 30, 4, 4); fence1(g, 4, 4, 4, 30);
    g.sprite([14, 20, 0], P => Q1.tree(P, 13));
    g.sprite([30, 24, 0], P => Q1.bench(P, 10));
    g.sprite([8, 30, 0], P => Q1.sunflower(P, 16));
  } else if (lv === 2) {
    fence1(g, 4, 60, 4, 4); fence1(g, 4, 4, 4, 36);
    g.sprite([12, 26, 0], P => Q1.tree(P, 13));
    meta.porch = [32, 17, 0];   // главный стол (6 мест) рисует игра — во дворе, не на маленькой веранде
    g.sprite([52, 28, 0], P => Q1.bench(P, 10));
    g.sprite([8, 34, 0], P => Q1.sunflower(P, 18)); g.sprite([4, 38, 0], P => Q1.sunflower(P, 14));
    lampPost(g, 62, 2); lampPost(g, 4, 2); g.sprite([58, 26, 0], P => Q1.barrel(P));
    bunting(g, [4, 2, 16], [62, 2, 16]);
  } else {
    // настил, столбы с фонарями по краю, без перекладин и перил — едоков видно целиком
    box(g, { x0: 2, x1: 66, y0: 2, y1: 34, h: 1.2, mat: m1Flat(P1.plank[2]), top: deckTop });
    S2([[3, 31], [33, 31], [63, 31]], (x, y) => post1(g, x, y, 1.2, 18, 2));        // столбы только сзади — спереди ничего не заслоняет едоков
    for (const [x, y] of [[4, 32], [34, 32], [64, 32]]) g.sprite([x, y, 19], P => Q1.lantern(P));
    bunting(g, [3, 31, 19], [33, 31, 19]); bunting(g, [33, 31, 19], [63, 31, 19]);
    lampPost(g, 2, 2);
    meta.porch = [34, 18, 1.2];   // длинный стол на 8 едоков и скамьи рисует игра (inside.js) — так видно, кто ест
    // бочка-бар на козлах у края террасы
    g.sprite([68, 26, 0], P => { Q1.barrel((x, y, c) => P(x, y - 3, c), 11, 13); PR.rect(P, -6, -3, 6, -3, P1.plank[3]); P(-5, -2, P1.plank[3]); P(5, -2, P1.plank[3]); P(-5, -1, P1.plank[3]); P(5, -1, P1.plank[3]); P(7, -9, P1.iron[1]); P(8, -9, P1.iron[0]); });
    lampPost(g, 70, 2);
  }
  inn1Paths(g, lv, ky0);
  innYard(g, lv, meta);
  g.sprite([2, 49, 0], P => Q1.flowers(P, 6)); g.sprite([12, 49, 0], P => Q1.flowers(P, 6)); g.sprite([96, 66, 0], P => Q1.flowers(P, 4));
  g.sprite([66, 2, 0], P => Q1.mushroom(P, 3)); g.sprite([70, 4, 0], P => Q1.mushroom(P, 2));
}

// Задний двор между домом и кухней (x 74..98, y 42..92) — место, где гномы тусуются. Отступ от дома ≥ 8 px.
// 1: кострище с брёвнами-сиденьями, колода с топором и поленница; 2: + вертел с тушкой, мишень для дротиков, меловая доска;
// 3: + сцена в глубине, пирамида бочонков, гирлянда. Точки для анимации — в meta (fire, spit, seats, chop, darts, stage).
const Y1 = {
  firePit(P) {   // каменное кольцо с углями (пламя рисует игра в meta.fire)
    PR.ell(P, 0, -2, 8, 4, (x, y, a, b) => { const e = a * a + b * b; if (e > 0.55) return ((x + y) & 1) ? P1.stone[1] : P1.stone[2]; return e < 0.2 ? P1.gold[(x + y) & 1] : ((x * 3 + y) % 4 === 0 ? P1.red[0] : P1.dark[3]); });
    PR.rect(P, -3, -4, 3, -4, P1.log[2]); PR.rect(P, -2, -3, 2, -3, P1.log[1]);
  },
  logSeat(P, w = 12) { PR.rect(P, -w / 2, -4, w / 2, -2, P1.log[1]); PR.rect(P, -w / 2, -4, w / 2, -4, P1.log[0]); PR.rect(P, -w / 2, -1, w / 2, -1, P1.log[3]); PR.ell(P, w / 2, -2.5, 1.6, 2, (x, y, a, b) => (a * a + b * b < 0.3 ? P1.log[0] : P1.log[2])); },
  spit(P) {      // две рогатины, перекладина, тушка
    for (const x of [-10, 10]) { PR.rect(P, x, -14, x, 0, P1.beam[1]); P(x - 1, -14, P1.beam[1]); P(x + 1, -14, P1.beam[1]); P(x - 1, -15, P1.beam[1]); P(x + 1, -15, P1.beam[1]); }
    PR.rect(P, -12, -13, 12, -13, P1.iron[1]); P(13, -12, P1.iron[1]); P(13, -11, P1.iron[2]);
    PR.ell(P, 0, -13, 6, 3.4, (x, y, a, b) => (b < -0.4 ? P1.gold[1] : a > 0.5 || b > 0.4 ? P1.log[2] : P1.log[0]));
    P(-6, -15, P1.log[2]); P(6, -15, P1.log[2]);
  },
  chop(P) {      // колода с воткнутым топором
    PR.rect(P, -4, -5, 4, 0, P1.log[2]); PR.ell(P, 0, -5, 4, 1.6, (x, y, a) => (a < -0.3 ? P1.log[0] : P1.log[1]));
    PR.line(P, 1, -6, 5, -12, P1.plank[1]); PR.rect(P, -1, -7, 2, -6, P1.iron[0]); P(-1, -5, P1.iron[1]);
  },
  darts(P) {     // мишень на столбе
    PR.rect(P, 0, -18, 0, 0, P1.beam[1]);
    PR.ell(P, 0, -20, 5, 5, (x, y, a, b) => { const r = Math.hypot(a, b); return r > 0.8 ? P1.beam[2] : r > 0.55 ? P1.white[0] : r > 0.3 ? P1.red[1] : P1.gold[0]; });
    P(1, -21, P1.iron[2]); P(-2, -19, P1.iron[2]); P(2, -18, P1.iron[2]);
  },
  chalk(P) {     // меловая доска «меню» на ножках
    PR.line(P, -4, 0, -2, -12, P1.plank[2]); PR.line(P, 4, 0, 2, -12, P1.plank[2]);
    PR.rect(P, -4, -14, 4, -5, P1.plank[3]); PR.rect(P, -3, -13, 3, -6, bhex('#2e3a32'));
    for (const [y, w] of [[-12, 4], [-10, 5], [-8, 3]]) PR.rect(P, -2, y, -2 + w, y, P1.white[1]);
  },
  kegs(P) {      // пирамида бочонков на боку
    const keg = (cx, cy) => PR.ell(P, cx, cy, 3.4, 3.4, (x, y, a, b) => { const r = a * a + b * b; return r > 0.7 ? P1.plank[3] : r > 0.45 ? P1.iron[1] : r < 0.15 ? P1.plank[0] : P1.plank[1]; });
    for (let k = 0; k < 3; k++) keg(-7 + k * 7, -4); for (let k = 0; k < 2; k++) keg(-3.5 + k * 7, -10); keg(0, -16);
  },
  bench(P, w = 12) { Q1.bench(P, w); },
};
function innYard(g, lv, meta) {
  // утоптанная земля под тусовкой
  box(g, { x0: 74, x1: 98, y0: 42, y1: 90, h: 0.2, mat: m1Flat(P1.dark[1]), top: (u, v) => { const h = bhash(u, v, 301); return h < 0.08 ? P1.grass[2] : h < 0.5 ? bhex('#8a7458') : bhex('#9c8664'); } });
  // кострище с брёвнами вокруг — главное место сборищ
  g.sprite([86, 54, 0.2], P => Y1.firePit(P));
  meta.fire = [86, 54, 0.6];
  g.sprite([86, 47, 0.2], P => Y1.logSeat(P, 14)); g.sprite([86, 62, 0.2], P => Y1.logSeat(P, 14));
  meta.seats = [[80, 47, 3], [92, 47, 3], [80, 62, 3], [92, 62, 3]];
  if (lv >= 2) { g.sprite([77, 54, 0.2], P => Y1.logSeat(P, 8)); g.sprite([95, 54, 0.2], P => Y1.logSeat(P, 8)); meta.seats.push([77, 54, 3], [95, 54, 3]); }
  // колода и поленница в глубине
  g.sprite([80, 80, 0.2], P => Y1.chop(P)); meta.chop = [83, 80, 0];
  g.sprite([88, 88, 0.2], P => Q1.logs(P));
  if (lv >= 2) {
    g.sprite([86, 55, 0.2], P => Y1.spit(P), -0.5); meta.spit = [86, 55, 13];
    g.sprite([96, 76, 0.2], P => Y1.darts(P)); meta.darts = [96, 76, 20];
    g.sprite([92, 26, 0], P => Y1.chalk(P));
  } else g.sprite([92, 26, 0], P => Q1.barrel(P, 7, 9));
  if (lv >= 3) {
    box(g, { x0: 74, x1: 98, y0: 70, y1: 86, h: 3, mat: m1Plank(P1.plank, 4), top: (u, v) => P1.plank[(v | 0) % 4 === 0 ? 2 : 0] });   // сцена в глубине
    meta.stage = [86, 78, 3];
    g.sprite([76, 72, 3], P => Q1.barrel(P, 7, 9));
    S2([[75, 84], [96, 84]], (x, y) => post1(g, x, y, 3, 16, 2));
    beam1(g, 75, 98, 84, 86, 19, 1.2, P1.plank);
    bunting(g, [75, 85, 19], [97, 85, 19]);
    g.sprite([96, 66, 0.2], P => Y1.kegs(P));
    g.sprite([88, 88, 0.2], P => Y1.chop(P));
  }
}

// Мощёные дорожки: въезд с юга (x 74..86) → развилка → к двери дома (запад), к веранде и к кухне (восток).
// Брусчатка неправильной кладкой, тёмный бордюр, трава щёточкой по краям.
function inn1Paths(g, lv, ky0) {
  const pave = (u, v, F) => {
    const row = Math.floor(v / 3), st = (row * 2) % 5, uu = (((u + st) % 5) + 5) % 5, vv = ((v % 3) + 3) % 3, id = Math.floor((u + st) / 5);
    if (uu === 0 || vv === 0) return P1.stone[3];
    const h = bhash(id, row, 291);
    let i = h < 0.3 ? 0 : h < 0.85 ? 1 : 2;
    if (vv === 1 && uu < 4 && i > 0) i -= 1;
    if (bhash(u, v, 292) < 0.03) return P1.grass[2];                 // травинка в шве
    return P1.stone[i];
  };
  const seg = (x0, x1, y0, y1) => {
    box(g, { x0, x1, y0, y1, h: 0.4, mat: m1Flat(P1.stone[3]), top: pave });
    for (let x = x0 + 1; x < x1; x += 3) { if (bhash(x, y0, 293) < 0.55) g.sprite([x, y0 - 0.2, 0], P => { P(0, 0, P1.grass[1]); if (bhash(x, 1, 294) < 0.5) P(0, -1, P1.grass[0]); }, -0.1); }
  };
  seg(73, 87, 0, 40);                      // въезд с юга
  seg(28, 87, 34, 40);                     // поперёк к дому
  seg(27, 39, 40, 50);                     // к двери
  seg(87, 98, 12, 18);                     // к веранде
  seg(87, 100, Math.min(ky0 + 6, 40) - 6, Math.min(ky0 + 6, 40));   // к кухне
  g.sprite([80, 0.5, 0.4], P => { for (let x = -7; x <= 7; x++) P(x, 0, P1.stone[3]); }, -0.2);
}

const ROOF_LV = {
  1: s => ({ main: m1Straw3(s), wing: m1Straw3(s), cut: m1StrawCut(s), cutW: m1StrawCut(s), th: 4 }),
  2: () => ({ main: m1Shingle(SHINGLE1), wing: m1Shingle(SHINGLE1), cut: m1Fascia, cutW: m1FasciaDark }),
  3: () => ({ main: m1Tile2(P1.tileR), wing: m1Scale2(P1.scale), cut: m1Fascia, cutW: m1FasciaDark }),
};
const INN_LV_VARS = [
  { name: 'Уровень 1 — солома (оливковая): малая веранда, двор с деревом', make: g => buildInn(g, 1, ROOF_LV[1](STRAW1.olive)) },
  { name: 'Уровень 2 — дранка: веранда больше, второй стол, фонари, гирлянда, бочка во дворе', make: g => buildInn(g, 2, ROOF_LV[2]()) },
  { name: 'Уровень 3 — черепица и чешуя: вторая терраса с перголой, бочка-бар, сцена, балкон на фронтоне', make: g => buildInn(g, 3, ROOF_LV[3]()) },
];
const INN_STRAW_VARS = Object.entries(STRAW1).map(([k, R]) => ({ name: `Солома «${{ rye: 'ржаная', olive: 'оливковая', wheat: 'пшеничная', reed: 'камышовая' }[k]}»`, make: g => buildInn(g, 1, ROOF_LV[1](R)) }));


// ======== bvar5.js (трактир, вход на восток) ========
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

// ======== bvar6.js (трактир в профиль) ========
// Трактир со входом на восток — в профиль (участок 3×4: 96 в ширину, 128 вглубь). Дом стоит длинной стороной к зрителю,
// конёк вдоль X, вход — в восточном торце (видимая правая грань). От восточного въезда (y ≈ 48) дорожка идёт к торцу.
// Обеденный двор и костёр — впереди, кухня-двор — за домом справа, поддон с припасами — между двором и домом.

function buildInnProfile(g, lv, roofs) {
  const meta = g.meta = { wins: [], tables: [] };
  const WIN = (side, at, a, z, w, h, o = {}) => { elem(g, side, at, a, z, w, h, m1Window(Object.assign({ w, h }, o))); meta.wins.push({ side, at, a, z, w, h, round: !!o.round }); };
  const deckTop = (u, v) => (((v | 0) % 3) === 0 ? P1.plank[2] : P1.plank[(u + v) % 9 < 1 ? 1 : 0]);
  // ---- дом: длинная сторона к зрителю, нависающий второй этаж, конёк вдоль X
  const Lo = { x0: 4, x1: 66, y0: 76, y1: 112, h: 15 }, Up = { x0: 2, x1: 68, y0: 72, y1: 112, z0: 15, h: 18 };
  box(g, Object.assign({ mat: m1Stone(P1.stone) }, Lo));
  beam1(g, 2, 68, 72, 76, 14, 1, P1.plank);
  box(g, Object.assign({ mat: m1Plaster(P1.plaster, { frame: true, bay: 16, mid: true, braceOdd: true }) }, Up));
  const r = { type: 'gable', axis: 'X', rise: 24, ov: 3, ovg: 4, mat: m1Ivy(roofs.main, [{ u: 50, v: 12, rx: 13, ry: 8 }, { u: 120, v: 20, rx: 8, ry: 6 }]), cut: roofs.cut, th: roofs.th || 2, gable: m1Plaster(P1.plaster, { frame: true, bay: 13, brace: false }) };
  roof(g, Up, r);
  const rz = rzOf(Up, r);
  dormer(g, 30, 76, 16, 10, 8, rz, m1Plaster(P1.plaster, { frame: true, bay: 10, brace: false }), roofs.main, roofs.cut, null);   // слуховое окно бара
  WIN('S', 75.7, 26, rz(76) + 1, 8, 7, { frameR: P1.beam });
  meta.bar = [30, 75.4, rz(76) + 4.5];
  chimney1(g, 12, 92, Up.z0 + Up.h + 8, 18, { w: 6, d: 6 });
  chimney1(g, 54, 96, Up.z0 + Up.h + 8, 14, { brick: true, w: 5, d: 5 });
  // длинная стена: окна с цветами, на втором этаже доска с кружкой
  for (const x of [8, 24, 40, 54]) { WIN('S', Lo.y0, x, 4, 9, 10, { sill: true }); }
  for (const x of [6, 20, 50]) { WIN('S', Up.y0, x, 20, 9, 9); g.sprite([x + 4.5, 71.5, 19], P => Q1.planter(P, 9), -0.5); }
  elem(g, 'S', Up.y0 - 0.3, 34, 22, 14, 7, m1Sprite(14, 7, P => Q1.board(P, 'mug', 14, 7)));
  // восточный торец: дверь, козырёк, фонари, окно во фронтоне
  elem(g, 'E', Lo.x1, 87, 0, 14, 15, m1Door({ w: 14, h: 15, arch: true, knob: true }));
  meta.doorPt = [70, 94, 0];
  WIN('E', Up.x1, 84, 20, 8, 9, {}); WIN('E', Up.x1, 98, 20, 8, 9, {});
  WIN('E', Up.x1, 89, 38, 10, 9, { arch: true });
  S2([[70, 85], [70, 101]], (x, y) => post1(g, x, y, 0, 14));
  roof(g, { x0: 66, x1: 72, y0: 85, y1: 103, h: 15 }, { type: 'lean', down: 'E', rise: 3, ov: 2, mat: m1Awning(), cut: m1Flat(P1.red[1]), th: 1 });
  g.sprite([69, 84, 12], P => Q1.lantern(P)); g.sprite([69, 104, 12], P => Q1.lantern(P));
  g.sprite([72, 95, 0], P => Q1.steps(P, 10, 1));
  g.sprite([70, 72, 26], P => Q1.sign(P, 'lamp', 1));
  // ---- кухня-двор за домом справа: печь, полки с запасами лицом к зрителю, стойка
  box(g, { x0: 74, x1: 96, y0: 104, y1: 126, h: 0.8, mat: m1Flat(P1.stone[2]), top: (u, v, F) => m1Stone(P1.stoneW, 6, 4)(u, v, Object.assign({}, F, { h: 0 })) });
  oven1(g, 88, 118);
  meta.oven = [88, 111, 3];
  box(g, { x0: 74, x1: 82, y0: 118, y1: 126, h: 14, mat: m1Flat(P1.dark[2]), top: m1Flat(P1.plank[1]) });
  elem(g, 'S', 118, 75, 1, 6, 12, m1Shelves(6, 12));
  meta.pantry = [[77, 117.5, 4], [79, 117.5, 10]];
  box(g, { x0: 76, x1: 92, y0: 105, y1: 108, h: 6, mat: m1Plank(P1.plank, 4), top: m1Flat(P1.plank[0]) });
  for (const x of [79, 84, 89]) mugs(g, x, 105, 6);
  // ---- поддон с припасами между двором и домом
  box(g, { x0: 8, x1: 40, y0: 58, y1: 68, h: 1, mat: m1Flat(P1.plank[3]), top: (u, v) => P1.plank[(u | 0) % 4 === 0 ? 3 : 2] });
  g.sprite([11, 60, 1], P => Q1.crate(P, 8)); g.sprite([11, 60, 9], P => Q1.crate(P, 7)); g.sprite([24, 62, 1], P => Q1.sack(P)); g.sprite([34, 64, 1], P => Q1.barrel(P, 7, 9));
  meta.stock = [[20, 66, 1], [26, 66, 1], [30, 62, 1], [38, 66, 1]];
  g.sprite([46, 66, 0], P => { PR.rect(P, 0, -8, 14, -4, P1.plank[2]); PR.rect(P, 0, -9, 14, -9, P1.plank[0]); PR.rect(P, 14, -7, 20, -7, P1.plank[3]); PR.ell(P, 4, -2, 2.5, 2.5, (x, y, a, b) => (a * a + b * b > 0.5 ? P1.plank[3] : P1.iron[1])); PR.ell(P, 11, -2, 2.5, 2.5, (x, y, a, b) => (a * a + b * b > 0.5 ? P1.plank[3] : P1.iron[1])); });
  // ---- дорожки: восточный въезд → вдоль двора → к торцу с дверью; ответвление к кухне
  paveSeg(g, 64, 96, 44, 52); paveSeg(g, 72, 82, 52, 104); paveSeg(g, 82, 92, 100, 104);
  // ---- обеденный двор впереди слева
  if (lv === 1) {
    box(g, { x0: 8, x1: 50, y0: 10, y1: 32, h: 1.2, mat: m1Flat(P1.plank[2]), top: deckTop });
    meta.porch = [29, 22, 1.2];
    fence1(g, 4, 56, 4, 4); fence1(g, 4, 4, 4, 40);
    g.sprite([8, 36, 0], P => Q1.sunflower(P, 16)); g.sprite([54, 38, 0], P => Q1.tree(P, 12));
  } else if (lv === 2) {
    box(g, { x0: 4, x1: 58, y0: 8, y1: 38, h: 1.2, mat: m1Flat(P1.plank[2]), top: deckTop });
    meta.porch = [31, 22, 1.2];
    fence1(g, 2, 60, 3, 3); fence1(g, 2, 2, 3, 42);
    lampPost(g, 2, 44); lampPost(g, 60, 3); bunting(g, [2, 44, 16], [60, 3, 16]);
    g.sprite([56, 44, 0], P => Q1.barrel(P));
  } else {
    box(g, { x0: 2, x1: 62, y0: 2, y1: 42, h: 1.2, mat: m1Flat(P1.plank[2]), top: deckTop });
    meta.porch = [32, 20, 1.2];
    S2([[3, 39], [31, 39], [59, 39]], (x, y) => post1(g, x, y, 1.2, 18, 2));
    for (const [x, y] of [[4, 40], [32, 40], [60, 40]]) g.sprite([x, y, 19], P => Q1.lantern(P));
    bunting(g, [3, 39, 19], [31, 39, 19]); bunting(g, [31, 39, 19], [59, 39, 19]);
    lampPost(g, 0, 2);
  }
  // ---- двор с костром впереди справа
  box(g, { x0: 66, x1: 94, y0: 4, y1: 40, h: 0.2, mat: m1Flat(P1.dark[1]), top: (u, v) => { const h = bhash(u, v, 301); return h < 0.08 ? P1.grass[2] : h < 0.5 ? bhex('#8a7458') : bhex('#9c8664'); } });
  g.sprite([80, 22, 0.2], P => Y1.firePit(P)); meta.fire = [80, 22, 0.6];
  g.sprite([80, 14, 0.2], P => Y1.logSeat(P, 14)); g.sprite([80, 31, 0.2], P => Y1.logSeat(P, 14));
  meta.seats = [[74, 14, 3], [86, 14, 3], [74, 31, 3], [86, 31, 3]];
  if (lv >= 2) { g.sprite([69, 22, 0.2], P => Y1.logSeat(P, 8)); g.sprite([91, 22, 0.2], P => Y1.logSeat(P, 8)); meta.seats.push([69, 22, 3], [91, 22, 3]); }
  g.sprite([90, 60, 0.2], P => Y1.chop(P)); meta.chop = [93, 60, 0];
  g.sprite([86, 68, 0.2], P => Q1.logs(P));
  if (lv >= 2) { g.sprite([80, 23, 0.2], P => Y1.spit(P), -0.5); meta.spit = [80, 23, 13]; g.sprite([92, 6, 0.2], P => Y1.darts(P)); meta.darts = [92, 6, 20]; g.sprite([62, 54, 0], P => Y1.chalk(P)); }
  if (lv >= 3) {
    box(g, { x0: 40, x1: 62, y0: 54, y1: 68, h: 3, mat: m1Plank(P1.plank, 4), top: (u, v) => P1.plank[(v | 0) % 4 === 0 ? 2 : 0] });   // сцена у дома
    meta.stage = [51, 61, 3];
    g.sprite([66, 6, 0.2], P => Y1.kegs(P));
  }
  g.sprite([2, 70, 0], P => Q1.barrel(P)); g.sprite([62, 75, 0], P => Q1.flowers(P, 4)); g.sprite([6, 75, 0], P => Q1.flowers(P, 6));
}

// ======== bvar7.js (реквизит склада) ========
const Q2 = {
  planks(P, n = 5, L = 18) {   // штабель досок с прокладками
    for (let r = 0; r < n; r++) {
      const y = -1 - r * 2;
      PR.rect(P, -L / 2, y - 1, L / 2, y, P1.plank[r % 2 ? 1 : 0]); PR.rect(P, -L / 2, y, L / 2, y, P1.plank[2]);
      P(-L / 2, y - 1, P1.plank[3]); P(L / 2, y - 1, P1.plank[3]);
      if (r % 2) { P(-L / 2 + 3, y + 1, P1.beam[2]); P(L / 2 - 3, y + 1, P1.beam[2]); }
    }
  },
  logStack(P, rows = 3, n = 5) {   // поленница брёвен торцами к зрителю
    for (let r = 0; r < rows; r++) for (let k = 0; k < n - r; k++) {
      const cx = (k - (n - r - 1) / 2) * 5, cy = -3 - r * 4.4;
      PR.ell(P, cx, cy, 2.6, 2.4, (x, y, a, b) => { const e = a * a + b * b; return e > 0.6 ? P1.log[3] : e < 0.12 ? P1.log[0] : P1.log[1 + (bhash(x, y, 401) < 0.3 ? 1 : 0)]; });
    }
  },
  stones(P, r = 8) {   // куча колотого камня
    for (let k = 0; k < 14; k++) {
      const a = bhash(k, 0, 411) * Math.PI, d = bhash(k, 1, 412) * r, cx = Math.cos(a) * d, cy = -Math.sin(a) * d * 0.7 - 1, s = 1.6 + bhash(k, 2, 413) * 1.6;
      PR.ell(P, cx, cy, s, s * 0.75, (x, y, aa, bb) => P1.stone[bb < -0.3 ? 0 : aa > 0.4 ? 2 : 1]);
    }
  },
  sacks(P, n = 4) { const pos = [[-5, 0], [1, 0], [7, 0], [-2, -5], [4, -5], [1, -9]]; for (let k = 0; k < Math.min(n, pos.length); k++) Q1.sack((x, y, c) => P(x + pos[k][0], y + pos[k][1], c), 7, 8); },
  crates(P, n = 3) { const pos = [[-8, 0], [0, 0], [-4, -8]]; for (let k = 0; k < Math.min(n, pos.length); k++) Q1.crate((x, y, c) => P(x + pos[k][0], y + pos[k][1], c), 7); },
  barrels(P, n = 3) { const pos = [[-6, 0], [2, 0], [-2, -1]]; for (let k = 0; k < Math.min(n, pos.length); k++) Q1.barrel((x, y, c) => P(x + pos[k][0], y + pos[k][1], c), 7, 9); },
  crane(P, h = 34, L = 16) {   // поворотная стрела с блоком и ящиком на верёвке
    PR.rect(P, 0, -h, 1, 0, P1.beam[1]); PR.rect(P, -2, 0, 3, 0, P1.beam[2]);
    PR.rect(P, 0, -h, L, -h + 1, P1.beam[1]); PR.line(P, 1, -h + 8, L - 4, -h + 2, P1.beam[2]);
    PR.rect(P, L - 1, -h + 2, L, -h + 3, P1.iron[1]); PR.rect(P, L, -h + 3, L, -h + 16, BP.rope[1]);
    Q1.crate((x, y, c) => P(x + L - 3, y - h + 22, c), 6);
  },
  sign(P) { Q1.sign(P, 'crate' in Q1 ? 'mug' : 'mug', 1); },
  scale(P) { PR.rect(P, 0, -18, 0, 0, P1.iron[2]); PR.rect(P, -7, -18, 7, -18, P1.iron[1]); for (const s of [-1, 1]) { PR.rect(P, s * 7, -17, s * 7, -12, BP.rope[1]); PR.rect(P, s * 7 - 3, -11, s * 7 + 3, -11, P1.gold[2]); } },
};
// низкая каменная перегородка (закрома)
function bin1(g, x0, x1, y0, y1, h = 5) { box(g, { x0, x1, y0, y1, h, mat: m1Stone(P1.stone, 4, 3), top: m1Flat(P1.stone[1]) }); }
// ворота: две створки, нараспашку (тёмный проём + створки по бокам) или закрытые
function gate1(g, side, at, a, w, h, open = true) {
  if (open) {
    elem(g, side, at, a, 0, w, h, (u, v) => (v > h - 2 || u < 1 || u > w - 2 ? P1.beam[2] : v < 1 ? P1.dark[2] : P1.dark[3 - (v > h * 0.6 ? 1 : 0)]));
    const leaf = m1Plank(P1.plank, 3), F = { w: w / 2 * BK, h };
    if (side === 'S') { g.face([[a - 0.2, at - 0.3, 0], [a - 0.2, at - w / 2, 0], [a - 0.2, at - w / 2, h - 1], [a - 0.2, at - 0.3, h - 1]], [0, -1, 0], [0, 0, 1], leaf, { F }); g.face([[a + w + 0.2, at - w / 2, 0], [a + w + 0.2, at - 0.3, 0], [a + w + 0.2, at - 0.3, h - 1], [a + w + 0.2, at - w / 2, h - 1]], [0, 1, 0], [0, 0, 1], leaf, { F }); }
  } else elem(g, side, at, a, 0, w, h, m1Door({ w, h, double: true, col: P1.plank }));
}


// ======== bvar8.js (склад) ========
// Склад (сводный по выбору владельца): небольшое главное здание с двумя воротами (как в варианте 2),
// слева спереди — длинная пристройка-навес вдоль края участка (как крыло варианта 3), справа сзади — навес с брёвнами
// (как в варианте 2). Большая открытая площадка под работу носильщиков. Дорожки — тёплый песчаник.
// Волшебный тон: рунные камни у ворот, светящиеся руны на створках, кристальные фонари, светящиеся грибы, огоньки,
// пучки трав под стрехой, сова на коньке, лиловое знамя с золотой руной.

const P3 = {
  sand: bramp(['#e2cfa4', '#c6b083', '#a48d62', '#76643f']),       // песчаник дорожек
  rune: bramp(['#d8fff4', '#7ef0d8', '#3cbca8', '#1e7a70']),       // свечение рун (бирюза)
  crystal: bramp(['#f0e6ff', '#c6a8ff', '#8c6ae0', '#56409a']),    // кристаллы (сирень)
  violet: bramp(['#9a74c8', '#704ea0', '#4e3478', '#30204e']),     // знамя
  shroomC: bramp(['#bff8ff', '#6ad8f0', '#2e9ac0', '#1c5c80']),    // светящиеся грибы
  oak: bramp(['#7a5a3e', '#5c422c', '#42301e', '#2a1e12']),        // тёмный дуб
};

function paveSand(g, x0, x1, y0, y1) {
  // мелкая плитка неправильной формы (4–5 px), швы с травинками, край рвётся в траву
  const W = (x1 - x0) * BK, H = (y1 - y0) * BK;
  const pave = (u, v) => {
    const edge = Math.min(u, W - u, v, H - v);
    if (edge < 2.5 && bhash(Math.floor(u / 2), Math.floor(v / 2), 504) < 0.55 - edge * 0.18) return null;   // рваный край
    const row = Math.floor(v / 3), st = Math.floor(bhash(row, 0, 505) * 5), cw = 4 + Math.floor(bhash(Math.floor((u + st) / 5), row, 506) * 2);
    const uu = (((u + st) % cw) + cw) % cw, vv = ((v % 3) + 3) % 3, id = Math.floor((u + st) / cw);
    if (uu === 0 || vv === 0) return bhash(u, v, 507) < 0.12 ? P1.grass[2] : P3.sand[3];
    const h = bhash(id, row, 508);
    let i = h < 0.25 ? 0 : h < 0.8 ? 1 : 2;
    if (vv === 1 && i > 0 && uu < cw - 1) i -= 1;                  // светлая верхняя кромка плитки
    if (uu === cw - 1) i = Math.min(3, i + 1);                    // тень справа
    return P3.sand[i];
  };
  box(g, { x0, x1, y0, y1, h: 0.4, mat: () => null, top: pave });
}
function groundYard(g, x0, x1, y0, y1) {
  // утоптанная земля: крупные мягкие пятна трёх тонов, редкие травинки и камешки
  box(g, { x0, x1, y0, y1, h: 0.2, mat: () => null, top: (u, v) => {
    const big = bhash(Math.floor(u / 9), Math.floor(v / 6), 509), h = bhash(u, v, 503);
    if (h < 0.025) return P1.grass[1]; if (h < 0.035) return P1.stone[1];
    const t = big + (bdith(u, v) - 0.5) * 0.25;
    return t < 0.35 ? bhex('#8e7a5a') : t < 0.8 ? bhex('#9a8664') : bhex('#a69270');
  } });
}

const Q3 = {
  runeStone(P, h = 16) {   // стоячий камень с бирюзовыми рунами и мхом
    for (let y = -h; y <= 0; y++) { const hw = Math.round(3.5 - Math.max(0, (-y - h + 4)) * 0.6 + (y > -3 ? 0.5 : 0)); for (let x = -hw; x <= hw; x++) P(x, y, P1.stone[x < -hw + 2 ? 0 : x > hw - 2 ? 2 : 1]); }
    for (const [x, y] of [[0, -h + 3], [0, -h + 4], [-1, -h + 5], [1, -h + 5], [0, -h + 7], [-1, -h + 8], [0, -h + 9], [1, -h + 10], [0, -h + 11]]) P(x, y, P3.rune[1]);
    P(0, -h + 6, P3.rune[0]);
    for (const [x, y] of [[-3, -2], [-2, -1], [-3, -1], [2, -h + 2]]) P(x, y, P1.ivy[1]);
    for (const [x, y] of [[-5, -h + 4], [4, -h + 7], [-4, -h + 10], [5, -h + 2]]) P(x, y, P3.rune[2]);
  },
  crystalLamp(P, h = 18) {   // шест с кристаллом в железной оправе и ореолом
    PR.rect(P, 0, -h, 0, 0, P3.oak[1]); PR.rect(P, -1, 0, 1, 0, P3.oak[2]);
    for (let y = -h - 12; y <= -h + 2; y++) for (let x = -7; x <= 7; x++) { const d = Math.hypot(x, (y + h + 5) * 1.1); if (d < 7 && d > 3 && bdith(x, y) < 1 - d / 7) P(x, y, P3.crystal[0]); }
    PR.rect(P, -2, -h - 1, 2, -h - 1, P1.iron[1]);
    for (let k = 0; k < 7; k++) { const w = k < 3 ? k : 6 - k; PR.rect(P, -w + 0, -h - 2 - k, w, -h - 2 - k, P3.crystal[k < 2 ? 0 : w > 1 ? 1 : 2]); }
    P(-1, -h - 5, P3.crystal[0]);
  },
  glowShroom(P, r = 3) { PR.rect(P, 0, -r + 1, 0, 0, P1.cloth[0]); PR.ell(P, 0, -r, r, r * 0.6, (x, y, a, b) => (b > 0.6 ? null : P3.shroomC[a < -0.3 ? 0 : a > 0.4 ? 2 : 1])); P(0, -r - 2, P3.shroomC[0]); },
  shroomPatch(P) { Q3.glowShroom(P, 3); Q3.glowShroom((x, y, c) => P(x + 4, y + 1, c), 2); Q3.glowShroom((x, y, c) => P(x - 3, y + 1, c), 2); },
  wisp(P) { PR.ell(P, 0, 0, 2, 2, () => P3.rune[0]); for (const [x, y] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) P(x, y, P3.rune[2]); P(-2, 4, P3.rune[3]); P(-3, 6, P3.rune[3]); },
  herbs(P, n = 4) { PR.rect(P, -n * 2 - 1, 0, n * 2 + 1, 0, P3.oak[1]); for (let k = 0; k < n; k++) { const x = -n * 2 + 1 + k * 4, R = k % 2 ? P1.ivy : P1.straw; PR.rect(P, x, 1, x, 6, R[2]); P(x - 1, 3, R[1]); P(x + 1, 4, R[1]); P(x, 7, R[1]); } },
  owl(P) { PR.ell(P, 0, -5, 3, 4, (x, y, a, b) => (b < -0.5 ? P3.oak[2] : a < 0 ? P3.oak[1] : P3.oak[2])); P(-1, -6, P3.rune[0]); P(1, -6, P3.rune[0]); P(0, -5, P1.gold[2]); P(-3, -9, P3.oak[2]); P(3, -9, P3.oak[2]); PR.rect(P, -2, -1, 2, -1, P3.oak[3]); },
  banner(P) { PR.rect(P, 0, -26, 0, 0, P3.oak[1]); PR.rect(P, -1, -26, 9, -26, P3.oak[2]); for (let y = -25; y < -11; y++) { const w = y > -14 ? (y + 14) : 0; for (let x = 1; x <= 9; x++) { if (y > -14 && Math.abs(x - 5) < w) continue; P(x, y, P3.violet[x > 7 ? 1 : 0]); } } for (const [x, y] of [[5, -22], [5, -21], [4, -20], [6, -20], [5, -19], [5, -18]]) P(x, y, P1.gold[0]); },
};
// руна на створке ворот (материал-оверлей)
function runeGate(g, side, at, a, w, h) {
  elem(g, side, at - 0.4, a, h * 0.45, w, h * 0.35, m1Sprite(w, Math.round(h * 0.35), P => { for (const [x, y] of [[0, -3], [0, -2], [-1, -1], [1, -1], [0, 0], [-2, 1], [2, 1], [0, 2], [0, 3]]) P(x, y, P3.rune[(x + y) & 1 ? 1 : 0]); }));
}

// Куча груза: на листе рисуется полной, в игре (g.dynPiles) — нет: её рисует inside.js по запасам склада (pxPile)
const PILE_DRAW = {
  trunk: f => P => Q2.logStack(P, 2 + Math.round(f * 2), 4 + Math.round(f * 2)),
  timber: f => P => Q2.planks(P, 2 + Math.round(f * 5), 18),
  stone: f => P => Q2.stones(P, 5 + Math.round(f * 7)),
  food: f => P => Q2.sacks(P, 1 + Math.round(f * 5)),
  goods: f => P => Q2.crates(P, 1 + Math.round(f * 2)),
};
function pile(g, kind, pt) {
  (g.meta.piles[kind] = g.meta.piles[kind] || []).push(pt);
  if (!g.dynPiles) g.sprite(pt, PILE_DRAW[kind](1));
}

function buildStore(g, lv, roofs) {
  const meta = g.meta = { piles: {}, wins: [] };
  const WIN = (side, at, a, z, w, h, o = {}) => { elem(g, side, at, a, z, w, h, m1Window(Object.assign({ w, h }, o))); meta.wins.push({ side, at, a, z, w, h }); };
  // ---- главное здание: в левом краю участка
  const Lo = { x0: 2, x1: 48, y0: 58, y1: 92, h: 16 }, Up = { x0: 0, x1: 50, y0: 56, y1: 92, z0: 16, h: 12 };
  box(g, Object.assign({ mat: m1Stone(P1.stoneW) }, Lo));
  beam1(g, 0, 50, 56, 58, 15, 1, P3.oak);
  box(g, Object.assign({ mat: m1Plaster(P1.plaster, { frame: true, bay: 13, braceOdd: true, beam: P3.oak }) }, Up));
  const Z = roofSag(g, Up, { axis: 'Y', rise: 30, sag: 3, flare: 4, ov: 3, ovg: 5, mat: m1Ivy(roofs.main, [{ u: 20, v: 18, rx: 8, ry: 6 }]), cut: roofs.cut, th: roofs.th || 3, gable: m1Plaster(P1.plaster, { frame: true, bay: 11, brace: false, beam: P3.oak }) });
  gate1(g, 'S', Lo.y0, 5, 15, 14, true); gate1(g, 'S', Lo.y0, 29, 15, 14, true);
  runeGate(g, 'S', Lo.y0, 5, 15, 14); runeGate(g, 'S', Lo.y0, 29, 15, 14);
  meta.gates = [[12.5, Lo.y0, 0], [36.5, Lo.y0, 0]];
  WIN('S', Up.y0, 21, 18, 8, 8, { arch: true, G: P3.crystal });
  elem(g, 'S', Up.y0 - 0.3, 7, 18, 9, 8, m1Door({ w: 9, h: 8, col: P3.oak }));
  beam1(g, 9, 13, 48, 56, 30, 1.5, P3.oak); g.sprite([11, 50, 18], P => { PR.rect(P, 0, -10, 0, 0, BP.rope[1]); Q1.sack((x, y, c) => P(x, y + 2, c), 6, 7); });
  WIN('E', Lo.x1, 66, 5, 7, 7, { G: P3.crystal, round: true }); WIN('E', Lo.x1, 80, 5, 7, 7, { G: P3.crystal, round: true });
  g.sprite([25, 74, Z.zr(0.5) + 0.5], P => Q3.owl(P));
  chimneyCrooked(g, 40, 80, Up.z0 + Up.h + 6, 16, { stone: true, w: 5, d: 5, lean: 2 });
  g.sprite([4, 55.5, 26], P => Q3.herbs(P, 2), -0.5); g.sprite([46, 55.5, 26], P => Q3.herbs(P, 2), -0.5);
  // ---- длинная пристройка слева спереди (до дома): бревенчатая стена с запада, открыта во двор
  const W = { x0: 2, x1: lv >= 3 ? 20 : 18, y0: lv === 1 ? 22 : 6, y1: 48 }, wh = lv >= 3 ? 20 : 13;
  wallW(g, W.x0, W.y0, W.y1, 0, wh, m1Logs(P1.log)); wallN(g, W.x0, W.x1, W.y1, 0, wh, m1Logs(P1.log));
  for (let y = W.y0 + 2; y <= W.y1; y += 19) post1(g, W.x1 - 2, y, 0, wh - 1, 2, P3.oak);
  if (lv >= 3) { beam1(g, W.x0, W.x1, W.y0, W.y1, 10, 1.2, P1.plank); g.sprite([W.x1 - 1, 30, 10], P => Q2.sacks(P, 4), -0.5); beam1(g, W.x1 - 3, W.x1 + 6, 26, 28, wh + 2, 1.5, P3.oak); g.sprite([W.x1 + 5, 27, wh], P => { PR.rect(P, 0, 0, 0, 10, BP.rope[1]); Q1.crate((x, y, c) => P(x - 3, y + 18, c), 6); }, -0.5); }
  roof(g, { x0: W.x0, x1: W.x1, y0: W.y0, y1: W.y1, h: wh - 1 }, { type: 'lean', down: 'E', rise: 6, ov: 2, mat: roofs.wing, cut: roofs.cutW, th: 3 });
  g.sprite([18, 5, 10], P => Q3.herbs(P, 2), -0.5);
  pile(g, 'timber', [26, 40, 0]); pile(g, 'food', [26, 26, 0]);
  if (lv >= 2) pile(g, 'goods', [24, 10, 0]);
  if (lv >= 3) { pile(g, 'timber', [38, 14, 0]); pile(g, 'food', [38, 30, 0]); }
  // ---- правая пристройка: бревенчатый амбар сзади + навес на столбах с подкосами спереди
  const ax = lv === 1 ? 80 : 58, A = { x0: ax, x1: 126, y0: 80, y1: 92, h: 14 };
  box(g, Object.assign({ mat: m1Logs(P1.log) }, A));
  roof(g, { x0: ax, x1: 126, y0: 72, y1: 92, h: 18 }, { type: 'lean', down: 'S', rise: 8, ov: 2, mat: roofs.wing, cut: roofs.cutW, th: 3 });
  const px = lv === 1 ? [80, 102, 124] : [58, 80, 102, 124];
  for (const x of px) post1(g, x, 72, 0, 17, 2.5, P3.oak);
  beam1(g, ax - 1, 127, 72, 74.5, 16, 1.6, P3.oak);
  for (const x of px.slice(0, -1)) g.sprite([x + 2.5, 72.5, 15], P => { PR.line(P, 0, 0, 5, -3, P3.oak[1]); PR.line(P, 0, 1, 5, -2, P3.oak[2]); }, -0.3);   // подкосы
  for (const x of px.slice(1)) g.sprite([x, 72.5, 15], P => { PR.line(P, 0, 0, -5, -3, P3.oak[1]); PR.line(P, 0, 1, -5, -2, P3.oak[2]); }, -0.3);
  elem(g, 'S', A.y0, ax + 8, 2, 12, 11, m1Door({ w: 12, h: 11, double: true, col: P3.oak }));
  elem(g, 'S', A.y0, 108, 5, 8, 6, m1Window({ w: 8, h: 6, G: P3.crystal }));
  // ложементы перед навесом: два бруса на столбиках, на них брёвна — видно, сколько леса
  const racks = lv === 1 ? [96] : lv === 2 ? [72, 102] : [66, 88, 110];
  for (const cx of racks) { for (const x of [cx - 10, cx + 8]) { post1(g, x, 58, 0, 5, 1.5, P3.oak); post1(g, x, 68, 0, 5, 1.5, P3.oak); beam1(g, x - 0.5, x + 2, 58, 69.5, 5, 1.2, P3.oak); } pile(g, 'trunk', [cx, 64, 5]); }
  if (lv >= 2) { g.sprite([120, 64, 0], P => Q2.crates(P)); g.sprite([ax + 12, 79, 0], P => Q2.barrels(P, 2)); }
  g.sprite([114, 79, 0], P => Q2.sacks(P, 3));
  // инструменты на стене амбара: топор, пила, мотыга
  g.sprite([82, A.y0 - 0.2, 10], P => { PR.line(P, 0, 0, 0, -8, P1.plank[1]); PR.rect(P, -2, -9, 1, -7, P1.iron[1]); PR.rect(P, 5, -8, 15, -7, P1.iron[1]); for (let x = 6; x <= 15; x += 2) P(x, -6, P1.iron[2]); PR.rect(P, 15, -9, 16, -6, P1.plank[2]); PR.line(P, 20, 0, 20, -9, P1.plank[1]); PR.rect(P, 18, -10, 22, -10, P1.iron[1]); }, -0.5);
  g.sprite([92, 72, 14], P => Q1.lantern(P), -0.5); g.sprite([114, 72, 14], P => Q1.lantern(P), -0.5);
  // ---- двор и дорожки: от въезда (x 80) к обоим воротам и к навесу
  groundYard(g, 20, 126, 4, 60);
  paveSand(g, 73, 87, 0, 50); paveSand(g, 6, 87, 44, 56); paveSand(g, 87, 98, 46, 56);
  pile(g, 'stone', [110, 30, 0]);
  if (lv >= 3) pile(g, 'stone', [98, 18, 0]);
  if (lv >= 2) g.sprite([56, 36, 0], P => Q2.crane(P, 30, 14));
  if (lv >= 3) {   // помост у ворот и рунный круг на земле, где носильщики сгружают ношу
    box(g, { x0: 2, x1: 48, y0: 50, y1: 57, h: 3, mat: m1Stone(P1.stone, 5, 3), top: (u, v) => P1.plank[(v | 0) % 3 === 0 ? 2 : (u | 0) % 11 === 0 ? 1 : 0] });
    g.sprite([62, 24, 0.3], P => { for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2; P(Math.round(Math.cos(a) * 10), Math.round(Math.sin(a) * 5), P3.rune[k % 3 ? 1 : 0]); } for (const [x, y] of [[0, -2], [-1, -1], [1, -1], [0, 0], [-2, 1], [2, 1], [0, 2]]) P(x, y, P3.rune[0]); }, -0.1);
    meta.circle = [62, 24, 0.3];
  }
  meta.drop = [[40, 30, 0], [96, 50, 0], [100, 30, 0]];
  // ---- волшебство
  g.sprite([70, 3, 0], P => Q3.runeStone(P, 16)); g.sprite([91, 3, 0], P => Q3.runeStone(P, 14));
  g.sprite([4, 52, 0], P => Q3.crystalLamp(P, 18)); g.sprite([52, 52, 0], P => Q3.crystalLamp(P, 18));
  g.sprite([54, 86, 0], P => Q3.shroomPatch(P)); g.sprite([126, 52, 0], P => Q3.shroomPatch(P)); g.sprite([62, 8, 0], P => Q3.shroomPatch(P));
  g.sprite([56, 30, 14], P => Q3.wisp(P), -2); g.sprite([44, 18, 20], P => Q3.wisp(P), -2); g.sprite([118, 46, 18], P => Q3.wisp(P), -2);
  g.sprite([120, 12, 0], P => Q3.banner(P));
  meta.glow = [[4, 52, 22], [52, 52, 22], [70, 3, 10], [91, 3, 9]];
}

const ROOF_ST = {
  1: () => ({ main: m1Straw3(STRAW1.reed), wing: m1Straw3(STRAW1.reed), cut: m1StrawCut(STRAW1.reed), cutW: m1StrawCut(STRAW1.reed), th: 3 }),
  2: () => ({ main: m1Shingle2(SHINGLE1, 0.6), wing: m1Shingle2(SHINGLE1, 0.9), cut: m1Fascia, cutW: m1Fascia }),
  3: () => ({ main: m1Ivy(m1Scale2(P1.scale), [{ u: 34, v: 30, rx: 9, ry: 6 }], bramp(['#7a9a4c', '#5a7a3a', '#3e5a2a', '#2a3e1e'])), wing: m1Ivy(m1Scale2(P1.scale), [{ u: 60, v: 14, rx: 10, ry: 5 }, { u: 150, v: 18, rx: 8, ry: 5 }], bramp(['#7a9a4c', '#5a7a3a', '#3e5a2a', '#2a3e1e'])), cut: m1FasciaDark, cutW: m1FasciaDark }),   // синяя черепица на всех крышах
};

// ======== bvar9.js (дома) ========
// Жилые дома 2×2 (64×64), семь разных: форма, материал, крыша и двор у каждого свои; видно, что там живут.
// Вход на юге (x ≈ 48 — дверь игры). Боковой вид (вход на восток) — та же модель с g.rot = 1: дверь уходит на восточную
// стену, конёк поворачивается, поэтому и профили у домов разные.
// Крыши по уровням: 1 — солома (у каждого дома свой оттенок), 2 — дранка с мхом, 3 — черепица.

const STRAW_H = {
  ash: bramp(['#d4ccb0', '#ada68a', '#86806a', '#5c5848']),       // выгоревшая серая
  honey: bramp(['#f2cc78', '#d4a450', '#a87a34', '#76521e']),     // медовая
  sage: bramp(['#c8c890', '#a0a468', '#787c46', '#50542c']),      // шалфейная
};
const HSTRAW = [STRAW1.wheat, STRAW_H.honey, STRAW1.rye, STRAW_H.ash, STRAW1.reed, STRAW_H.sage, STRAW1.olive];
function houseRoof(lv, vi) {
  if (lv === 1) { const S = HSTRAW[vi % HSTRAW.length]; return { mat: m1Straw3(S), cut: m1StrawCut(S), th: 3 }; }
  if (lv === 2) return { mat: m1Shingle2(SHINGLE1, 0.6), cut: m1Fascia, th: 2 };
  const T = [P1.tileR, P1.tileD, P1.slate, P1.tileR, P1.scale, P1.tileD, P1.slate][vi % 7];
  return { mat: T === P1.scale ? m1Scale2(T) : m1Tile2(T), cut: T === P1.slate || T === P1.scale ? m1FasciaDark : m1Fascia, th: 2 };
}
const HQ = {
  laundry(P, w = 22) {   // верёвка с бельём на двух шестах
    PR.rect(P, 0, -16, 0, 0, P3.oak[1]); PR.rect(P, w, -16, w, 0, P3.oak[1]);
    for (let x = 0; x <= w; x++) P(x, -15 + Math.round(Math.sin(x / w * Math.PI) * 2), P1.white[2]);
    const cl = [P1.white[0], P1.red[0], P1.scale[0], P1.gold[0], P1.white[1]];
    for (let k = 0; k < 5; k++) { const x0 = 2 + k * 4, sag = Math.round(Math.sin((x0 + 1) / w * Math.PI) * 2); PR.rect(P, x0, -14 + sag, x0 + 2, -9 + sag - (k % 2), cl[k]); P(x0 + 2, -14 + sag, P1.white[2]); }
  },
  cabbages(P, n = 6) { for (let k = 0; k < n; k++) { const x = (k % 3) * 6, y = Math.floor(k / 3) * 4; PR.ell(P, x, y - 2, 2.6, 2, (xx, yy, a, b) => P1.grass[a < -0.2 && b < 0 ? 0 : a > 0.4 ? 2 : 1]); P(x, y - 3, P1.ivy[0]); } },
  bed(P, w = 20, h = 8) { PR.rect(P, 0, -h, w, 0, bhex('#6a5236')); for (let x = 1; x < w; x += 2) for (let y = -h + 1; y < 0; y += 3) P(x, y, bhex('#5a4430')); PR.rect(P, 0, -h, w, -h, P1.plank[1]); PR.rect(P, 0, 0, w, 0, P1.plank[3]); },
  bench(P) { Q1.bench(P, 10); },
  waterBarrel(P) { Q1.barrel(P, 8, 10); PR.rect(P, -3, -11, 2, -11, P1.scale[1]); },
  hens(P) { for (const [x, y, f] of [[0, 0, 1], [6, 2, -1]]) { PR.rect(P, x - 2, y - 4, x + 2, y - 1, P1.white[0]); P(x + 2 * f, y - 5, P1.white[0]); P(x + 3 * f, y - 5, P1.gold[1]); P(x + 2 * f, y - 6, P1.red[0]); P(x - 1, y, P1.gold[2]); P(x + 1, y, P1.gold[2]); } },
  well(P) { PR.ell(P, 0, -4, 6, 3, (x, y, a, b) => (a * a + b * b > 0.55 ? P1.stone[(x + y) & 1 ? 1 : 2] : P1.scale[3])); PR.rect(P, -6, -4, 6, -1, P1.stone[2]); PR.rect(P, -5, -16, -5, -4, P3.oak[1]); PR.rect(P, 5, -16, 5, -4, P3.oak[1]); PR.rect(P, -7, -17, 7, -16, P1.tileD[1]); PR.rect(P, -1, -14, 1, -9, P1.plank[1]); },
  pumpkin(P) { Q1.pumpkin(P); },
  wood(P) { Q1.logs(P); },
};
const HWIN = (g, side, at, a, z, w, h, o = {}) => { elem(g, side, at, a, z, w, h, m1Window(Object.assign({ w, h }, o))); (g.meta.wins = g.meta.wins || []).push({ side, at, a, z, w, h, round: !!o.round }); };
function hDoor(g, side, at, a, w = 10, h = 13, o = {}) { elem(g, side, at, a, 0, w, h, (o.round ? m1RoundDoor : m1Door)(Object.assign({ w, h, arch: true, knob: true }, o))); g.meta.doorPt = side === 'S' ? [a + w / 2, at, 0] : [at, a + w / 2, 0]; }

const HOUSE_VARS = [
  { name: 'Белёный коттедж: низкий, толстая солома, круглые окна, лавка и бочка с водой', make(g, lv) {
    g.meta = {};
    const M = { x0: 8, x1: 58, y0: 22, y1: 52, h: 14 };
    box(g, Object.assign({ mat: m1Plaster(P1.plasterW || P1.plaster, { low: 4, stoneR: P1.stoneW }) }, M));
    const R = houseRoof(lv, 0);
    roofSag(g, M, { axis: 'X', rise: 20, sag: 2, flare: 3, ov: 4, ovg: 4, mat: R.mat, cut: R.cut, th: R.th + 1, gable: m1Plaster(P1.plaster) });
    hDoor(g, 'S', M.y0, 43, 10, 12, { col: P1.green ? undefined : undefined });
    HWIN(g, 'S', M.y0, 14, 4, 8, 8, { round: true }); HWIN(g, 'S', M.y0, 28, 4, 8, 8, { round: true });
    HWIN(g, 'E', M.x1, 32, 4, 7, 7, { round: true });
    chimney1(g, 16, 40, M.h + 10, 12, { brick: true, w: 5, d: 5 });
    g.sprite([22, 21, 0], P => Q1.flowers(P, 10)); g.sprite([32, 20, 0], P => HQ.bench(P));
    g.sprite([60, 26, 0], P => HQ.waterBarrel(P)); g.sprite([12, 12, 0], P => Q1.planter(P, 11));
    if (lv >= 2) { g.sprite([4, 30, 0], P => Q1.sunflower(P, 16)); g.sprite([56, 12, 0], P => Q1.planter(P, 9)); }
    if (lv >= 3) { box(g, { x0: 40, x1: 56, y0: 16, y1: 22, h: 1, mat: m1Flat(P1.stone[2]), top: m1Flat(P1.stone[1]) }); g.sprite([8, 54, 0], P => HQ.laundry(P, 18)); }
  } },
  { name: 'Узкий высокий фахверк: нависающий этаж, крутая крыша, слуховое окно, бельё на верёвке', make(g, lv) {
    g.meta = {};
    const Lo = { x0: 30, x1: 58, y0: 26, y1: 56, h: 14 }, Up = { x0: 28, x1: 60, y0: 23, y1: 56, z0: 14, h: 14 + (lv >= 2 ? 4 : 0) };
    box(g, Object.assign({ mat: m1Stone(P1.stone) }, Lo)); beam1(g, 28, 60, 23, 26, 13, 1, P1.beam);
    box(g, Object.assign({ mat: m1Plaster(P1.plaster, { frame: true, bay: 12, braceOdd: true }) }, Up));
    const R = houseRoof(lv, 1), r = { type: 'gable', axis: 'Y', rise: 30, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plaster, { frame: true, bay: 10, brace: false }) };
    roof(g, Up, r);
    hDoor(g, 'S', Lo.y0, 43, 10, 13);
    HWIN(g, 'S', Up.y0, 34, Up.z0 + 4, 8, 9, { sill: true }); HWIN(g, 'S', Up.y0, 48, Up.z0 + 4, 8, 9, { sill: true });
    HWIN(g, 'S', Up.y0, 40, Up.z0 + Up.h + 4, 8, 8, { arch: true });
    HWIN(g, 'E', Up.x1, 36, Up.z0 + 4, 7, 8, {}); HWIN(g, 'E', Lo.x1, 40, 4, 7, 8, {});
    chimney1(g, 34, 44, Up.z0 + Up.h + 12, 12, { w: 5, d: 5 });
    g.sprite([2, 30, 0], P => HQ.laundry(P, 24));
    g.sprite([10, 14, 0], P => HQ.bed(P, 16, 8)); g.sprite([14, 10, 0], P => HQ.cabbages(P, lv >= 2 ? 6 : 3));
    if (lv >= 3) { beam1(g, 34, 54, 18, 23, Up.z0 + 2, 1.5, P1.plank); railing1(g, 34, 54, 18.5, 18.5, Up.z0 + 3.5, 4); }
  } },
  { name: 'Бревенчатая изба: крыльцо под навесом, резные наличники, поленница', make(g, lv) {
    g.meta = {};
    const M = { x0: 4, x1: 52, y0: 24, y1: 58, h: 16 };
    box(g, Object.assign({ mat: m1Logs(P1.log) }, M));
    const R = houseRoof(lv, 2);
    roof(g, M, { type: 'gable', axis: 'Y', rise: 22, ov: 4, ovg: 5, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plank, 4) });
    hDoor(g, 'S', M.y0, 30, 10, 13, { col: P1.dark });
    for (const x of [10]) { HWIN(g, 'S', M.y0, x, 5, 9, 8, { frameR: P1.plank }); elem(g, 'S', M.y0 - 0.2, x - 1, 13, 11, 2, m1Flat(P1.plank[0])); }
    HWIN(g, 'S', M.y0, 24, 26, 6, 6, { round: true });
    HWIN(g, 'E', M.x1, 34, 5, 8, 8, { frameR: P1.plank });
    // крыльцо под навесом
    box(g, { x0: 24, x1: 46, y0: 14, y1: 24, h: 2, mat: m1Plank(P1.plank, 4, false), top: m1Plank(P1.plank, 4, false) });
    S2([[24, 14], [44, 14]], (x, y) => post1(g, x, y, 2, 12, 2));
    roof(g, { x0: 24, x1: 46, y0: 14, y1: 24, h: 14 }, { type: 'lean', down: 'S', rise: 4, ov: 2, mat: R.mat, cut: R.cut, th: 2 });
    chimney1(g, 12, 46, M.h + 14, 10, { stone: true, w: 6, d: 6 });
    g.sprite([58, 40, 0], P => HQ.wood(P)); g.sprite([58, 30, 0], P => Y1.chop(P));
    if (lv >= 2) g.sprite([34, 18, 2], P => HQ.bench(P));
    if (lv >= 3) { g.sprite([8, 12, 0], P => HQ.hens(P)); g.sprite([56, 14, 0], P => Q1.planter(P, 9)); }
  } },
  { name: 'Каменный домик: вальмовая крыша, большая труба, огород с капустой и тыквами', make(g, lv) {
    g.meta = {};
    const M = { x0: 20, x1: 58, y0: 30, y1: 58, h: 16 };
    box(g, Object.assign({ mat: m1Stone(P1.stoneW, 6, 4) }, M));
    const R = houseRoof(lv, 3);
    roof(g, M, { type: 'hip', axis: 'X', rise: 18, hipL: 14, ov: 3, mat: R.mat, cut: R.cut, th: R.th });
    hDoor(g, 'S', M.y0, 43, 10, 13, { col: P1.plank });
    HWIN(g, 'S', M.y0, 26, 5, 8, 9, { arch: true }); HWIN(g, 'E', M.x1, 38, 5, 8, 9, { arch: true });
    box(g, { x0: 22, x1: 30, y0: 40, y1: 48, h: M.h + 22, mat: m1Stone(P1.stone, 5, 3), top: m1Flat(P1.stone[3]) });   // большая труба
    chimney1(g, 23, 41, M.h + 22, 2, { stone: true, w: 6, d: 6 });
    box(g, { x0: 2, x1: 18, y0: 6, y1: 28, h: 0.3, mat: m1Flat(bhex('#5a4430')), top: (u, v) => ((u | 0) % 4 === 0 ? bhex('#4e3a28') : bhex('#6a5236')) });   // грядки
    g.sprite([6, 24, 0.3], P => HQ.cabbages(P, 6)); g.sprite([6, 12, 0.3], P => HQ.cabbages(P, lv >= 2 ? 6 : 3));
    g.sprite([24, 14, 0], P => HQ.pumpkin(P)); g.sprite([30, 18, 0], P => HQ.pumpkin(P));
    fence1(g, 2, 18, 4, 4, 5); fence1(g, 18, 18, 4, 28, 5);
    if (lv >= 2) g.sprite([60, 24, 0], P => HQ.waterBarrel(P));
    if (lv >= 3) g.sprite([10, 46, 0], P => HQ.well(P));
  } },
  { name: 'Круглый домик: цилиндр под конической крышей, круглая дверь, грибы и огоньки', make(g, lv) {
    g.meta = {};
    const cx = 34, cy = 38, rr = 18;
    cyl(g, cx, cy, rr, 0, 6, m1Stone(P1.stoneW, 5, 3), 28);
    cyl(g, cx, cy, rr, 6, 18, m1Plaster(P1.plaster), 28);
    const R = houseRoof(lv, 4);
    cone(g, cx, cy, rr + 5, 17, 26 + (lv >= 3 ? 4 : 0), R.mat, R.cut, 28, 3);
    elem(g, 'S', cy - rr + 1, 43, 0, 11, 11, m1RoundDoor({ w: 11, h: 11 })); g.meta.doorPt = [48.5, cy - rr + 1, 0];
    HWIN(g, 'S', cy - rr + 2, 22, 7, 7, 7, { round: true, G: P3.crystal });
    HWIN(g, 'E', cx + rr - 1, cy - 3, 7, 7, 7, { round: true });
    chimneyCrooked(g, 40, 44, 34, 10, { stone: true, w: 4, d: 4, lean: 2 });
    g.sprite([cx, cy, 43 + (lv >= 3 ? 4 : 0)], P => Q3.owl(P));
    g.sprite([8, 22, 0], P => Q3.shroomPatch(P)); g.sprite([58, 52, 0], P => Q3.shroomPatch(P));
    g.sprite([12, 30, 12], P => Q3.wisp(P), -2);
    g.sprite([56, 18, 0], P => Q3.crystalLamp(P, 14));
    if (lv >= 2) g.sprite([18, 12, 0], P => Q1.planter(P, 11));
    if (lv >= 3) { cyl(g, 10, 50, 7, 0, 10, m1Plaster(P1.plaster), 16); cone(g, 10, 50, 9, 9, 10, R.mat, R.cut, 16, 2); }
  } },
  { name: 'Г-образный дом: два крыла разной высоты, крытая галерея, куры', make(g, lv) {
    g.meta = {};
    const A = { x0: 6, x1: 30, y0: 22, y1: 58, h: 22 }, B = { x0: 30, x1: 60, y0: 36, y1: 58, h: 13 };
    box(g, Object.assign({ mat: m1Plaster(P1.plaster, { frame: true, bay: 12, mid: true, low: 6, braceX: true }) }, A));
    box(g, Object.assign({ mat: m1Plank(P1.plankB, 4) }, B));
    const R = houseRoof(lv, 5);
    roof(g, A, { type: 'gable', axis: 'Y', rise: 18, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plaster, { frame: true, bay: 10, brace: false }) });
    roof(g, B, { type: 'gable', axis: 'X', rise: 12, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plankB, 4) });
    hDoor(g, 'S', B.y0, 43, 10, 11, { col: P1.dark });
    HWIN(g, 'S', A.y0, 12, 4, 8, 8, {}); HWIN(g, 'S', A.y0, 13, 14, 7, 7, {});
    HWIN(g, 'S', B.y0, 33, 3, 7, 7, { frameR: P1.plank }); HWIN(g, 'E', B.x1, 44, 3, 7, 7, { frameR: P1.plank });
    // галерея вдоль короткого крыла
    S2([[32, 28], [58, 28]], (x, y) => post1(g, x, y, 0, 11, 2));
    roof(g, { x0: 30, x1: 60, y0: 28, y1: 36, h: 12 }, { type: 'lean', down: 'S', rise: 3, ov: 2, mat: R.mat, cut: R.cut, th: 2 });
    chimney1(g, 12, 44, A.h + 12, 10, { brick: true, w: 5, d: 5 });
    g.sprite([20, 12, 0], P => HQ.hens(P)); g.sprite([8, 16, 0], P => HQ.hens(P));
    if (lv >= 2) g.sprite([34, 30, 0], P => HQ.bench(P));
    if (lv >= 3) { g.sprite([56, 16, 0], P => Q1.planter(P, 9)); g.sprite([4, 10, 0], P => Q1.sunflower(P, 18)); }
  } },
  { name: 'Дом в холме: дерновая крыша с цветами, круглая дверь в каменной арке, окошки в склоне', make(g, lv) {
    g.meta = {};
    // холм — широкая низкая «крыша» из дёрна прямо от земли
    const sod = (u, v, F) => { const h = bhash(u, v, 701); if (h < 0.04 && lv >= 2) return [P1.red[0], P1.gold[0], P1.white[0], P1.scale[0]][(bhash(u, v, 702) * 4) | 0]; const t = v / F.L; return P1.grass[bcl((t > 0.7 ? 1 : 0) + (h < 0.3 ? 0 : h < 0.85 ? 1 : 2) + L1(F) - 1, 2)]; };
    // холм — травяной купол с каменным цоколем; окна и дверь — в каменной стенке спереди
    cyl(g, 32, 44, 24, 0, 3, m1Stone(P1.stoneW, 5, 3), 32);
    dome(g, 32, 44, 25, 2.5, 20, lv >= 3 ? m1Ivy(sod, [{ u: 60, v: 20, rx: 10, ry: 6 }]) : sod, m1Flat(bhex('#4e6a2e')), 32, 8, 2);
    // фасад в склоне: каменная арка с круглой дверью и два круглых окна
    box(g, { x0: 10, x1: 58, y0: 20, y1: 26, h: 12, mat: m1Stone(P1.stoneW, 5, 3), top: sod });   // подпорная стенка фасада
    elem(g, 'S', 20, 42, 0, 12, 12, m1RoundDoor({ w: 12, h: 12, col: P1.green ? P1.plank : P1.plank })); g.meta.doorPt = [48, 20, 0];
    HWIN(g, 'S', 20, 16, 3, 7, 7, { round: true }); HWIN(g, 'S', 20, 28, 3, 7, 7, { round: true });
    chimney1(g, 20, 48, 16, 8, { stone: true, w: 5, d: 5 });
    g.sprite([30, 20, 0], P => Q1.flowers(P, 8)); g.sprite([60, 14, 0], P => Q1.planter(P, 9));
    g.sprite([10, 14, 0], P => HQ.bench(P));
    if (lv >= 2) g.sprite([22, 10, 0], P => Q1.sunflower(P, 14));
    if (lv >= 3) { g.sprite([4, 50, 0], P => Q3.shroomPatch(P)); g.sprite([60, 34, 0], P => Q3.crystalLamp(P, 12)); }
  } },
];


// ---- Замена норы: три варианта на выбор ----
const BARK = bramp(['#8a6a4a', '#6a4e34', '#4e3824', '#342416']);
const LEAF = bramp(['#9ccc5a', '#6aa040', '#4a7a2e', '#30561e']);
const matBark = (u, v, F) => { const k = L1(F), c = Math.floor(u / 3); let i = bhash(c, 0, 801) < 0.3 ? 0 : 1; if (((u + Math.floor(v / 7)) % 3) === 0) i = 2; if (bhash(c, Math.floor(v / 5), 802) < 0.08) i = 3; return p1(BARK, i + k); };
const matLeaf = (u, v, F) => { const k = L1(F), h = bhash(Math.floor(u / 3), Math.floor(v / 3), 803); let i = h < 0.3 ? 0 : h < 0.75 ? 1 : 2; if (v / F.L > 0.75) i += 1; if (bhash(u, v, 804) < 0.05) return P1.red[0]; return p1(LEAF, i + k); };
const HOUSE_ALT = [
  { name: 'А. Дом на сваях: приподнятый сруб, лестница, под полом — куры и дрова', make(g, lv, vi = 6) {
    g.meta = {};
    const F = { x0: 8, x1: 56, y0: 22, y1: 56, z0: 10, h: 14 };
    for (const [x, y] of [[9, 23], [26, 23], [44, 23], [53, 23], [9, 53], [53, 53], [30, 53]]) post1(g, x, y, 0, 10, 2.5, P3.oak);
    beam1(g, 8, 56, 22, 56, 9, 1.4, P1.plank);
    box(g, Object.assign({ mat: m1Logs(P1.logD || P1.log) }, F));
    const R = houseRoof(lv, vi);
    roofSag(g, F, { axis: 'X', rise: 18, sag: 2, flare: 3, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plank, 4) });
    elem(g, 'S', F.y0, 42, 10, 9, 12, m1Door({ w: 9, h: 12, col: P1.dark, arch: true })); g.meta.doorPt = [48, 14, 0];
    HWIN(g, 'S', F.y0, 14, 14, 8, 7, { frameR: P1.plank }); HWIN(g, 'S', F.y0, 26, 14, 8, 7, { frameR: P1.plank }); HWIN(g, 'E', F.x1, 36, 14, 7, 7, { frameR: P1.plank });
    beam1(g, 38, 56, 16, 22, 9, 1.2, P1.plank); railing1(g, 38, 56, 16.5, 16.5, 10.2, 4);   // площадка у двери
    g.sprite([48, 8, 0], P => { for (let k = 0; k < 6; k++) { PR.rect(P, -4, -k * 2 - 1, 4, -k * 2 - 1, P1.plank[k % 2]); } PR.line(P, -5, 0, -5, -12, P1.plank[2]); PR.line(P, 5, 0, 5, -12, P1.plank[3]); });   // лестница
    g.sprite([20, 40, 0], P => HQ.hens(P)); g.sprite([34, 44, 0], P => HQ.wood(P));
    chimney1(g, 16, 40, F.z0 + F.h + 8, 10, { stone: true, w: 5, d: 5 });
    g.sprite([4, 14, 0], P => HQ.waterBarrel(P));
    if (lv >= 2) g.sprite([20, 18, 10], P => Q1.planter(P, 11), -0.5);
    if (lv >= 3) g.sprite([60, 34, 0], P => HQ.laundry(P, 0));
  } },
  { name: 'Б. Каменная башенка: три этажа, деревянная надстройка, голубятня и флюгер', make(g, lv, vi = 6) {
    g.meta = {};
    const T = { x0: 24, x1: 50, y0: 28, y1: 54, h: 26 }, U = { x0: 22, x1: 52, y0: 26, y1: 56, z0: 26, h: 10 };
    box(g, Object.assign({ mat: m1Stone(P1.stoneW, 6, 4) }, T));
    beam1(g, 22, 52, 26, 56, 25, 1.4, P1.beam);
    box(g, Object.assign({ mat: m1Plank(P1.plankB, 4) }, U));
    const R = houseRoof(lv, vi);
    roof(g, U, { type: 'hip', axis: 'X', rise: 18, hipL: 17.5, ov: 3, mat: R.mat, cut: R.cut, th: R.th });   // шатёр (pyr вырождает переднюю грань в отрезок)
    hDoor(g, 'S', T.y0, 43, 9, 13, { col: P1.plank });
    HWIN(g, 'S', T.y0, 30, 12, 6, 8, { arch: true }); HWIN(g, 'S', U.y0, 32, 28, 10, 6, { frameR: P1.plank }); HWIN(g, 'E', T.x1, 38, 14, 6, 8, { arch: true }); HWIN(g, 'E', U.x1, 36, 28, 8, 6, { frameR: P1.plank });
    g.sprite([37, 41, 54 + (lv >= 3 ? 2 : 0)], P => { PR.rect(P, 0, -8, 0, 0, P1.iron[2]); PR.rect(P, -4, -8, 4, -8, P1.iron[1]); PR.rect(P, 2, -10, 5, -9, P1.iron[1]); P(-5, -9, P1.iron[1]); });   // флюгер
    // голубятня на шесте и пристройка-сарайчик
    g.sprite([12, 30, 0], P => { PR.rect(P, 0, -18, 0, 0, P3.oak[1]); PR.rect(P, -5, -26, 5, -18, P1.plank[1]); PR.rect(P, -6, -27, 6, -27, P1.tileD[1]); for (const x of [-3, 2]) PR.rect(P, x, -23, x + 1, -21, P1.ink); P(4, -29, P1.white[0]); P(5, -29, P1.white[1]); P(-2, -28, P1.white[0]); });
    box(g, { x0: 52, x1: 62, y0: 32, y1: 50, h: 9, mat: m1Plank(P1.plank, 4), top: m1Flat(P1.plank[1]) });
    roof(g, { x0: 52, x1: 62, y0: 32, y1: 50, h: 9 }, { type: 'lean', down: 'E', rise: 3, ov: 2, mat: R.mat, cut: R.cut, th: 2 });
    g.sprite([18, 16, 0], P => Q1.flowers(P, 10)); g.sprite([6, 50, 0], P => HQ.wood(P));
    if (lv >= 2) g.sprite([30, 22, 0], P => HQ.bench(P));
    if (lv >= 3) { beam1(g, 26, 48, 22, 26, 25, 1.2, P1.plank); railing1(g, 26, 48, 22.5, 22.5, 26.2, 4); }
  } },
  { name: 'В. Дом в старом дубе: толстый ствол с дверью и окнами, крона вместо крыши, корни', make(g, lv, vi = 6) {
    g.meta = {};
    const cx = 32, cy = 40, rr = 15;
    cyl(g, cx, cy, rr + 3, 0, 3, matBark, 24);                         // корни-основание
    cyl(g, cx, cy, rr, 3, 26, matBark, 24);
    elem(g, 'S', cy - rr + 0.8, 43, 3, 10, 13, m1Door({ w: 10, h: 13, arch: true, knob: true, col: P1.plank })); g.meta.doorPt = [48, cy - rr, 0];
    HWIN(g, 'S', cy - rr + 1.2, 22, 12, 6, 7, { arch: true }); HWIN(g, 'E', cx + rr - 1, cy - 2, 16, 6, 7, { round: true });
    // ветви и крона — на 3-м уровне ещё и домик-скворечник наверху
    dome(g, cx, cy + 2, 26, 22, 20, matLeaf, m1Flat(LEAF[3]), 28, 7, 2);
    dome(g, cx - 12, cy - 6, 12, 22, 10, matLeaf, m1Flat(LEAF[3]), 20, 5, 2);
    dome(g, cx + 14, cy + 10, 12, 24, 10, matLeaf, m1Flat(LEAF[3]), 20, 5, 2);
    chimneyCrooked(g, 40, 48, 38, 12, { stone: true, w: 4, d: 4, lean: 2 });
    g.sprite([12, 22, 0], P => { for (const [x, y] of [[0, 0], [5, 2], [-4, 3]]) PR.ell(P, x, y, 4, 1.4, () => BARK[2]); });   // корни
    g.sprite([56, 18, 0], P => Q3.shroomPatch(P)); g.sprite([8, 50, 0], P => Q3.shroomPatch(P));
    g.sprite([46, 20, 3], P => Q1.lantern(P));
    if (lv >= 2) { g.sprite([24, 18, 0], P => HQ.bench(P)); g.sprite([20, 26, 30], P => Q3.wisp(P), -2); }
    if (lv >= 3) { box(g, { x0: 44, x1: 54, y0: 30, y1: 40, z0: 34, h: 7, mat: m1Plank(P1.plank, 3), top: m1Flat(P1.plank[1]) }); roof(g, { x0: 44, x1: 54, y0: 30, y1: 40, h: 7, z0: 34 }, { type: 'gable', axis: 'X', rise: 5, ov: 2, mat: m1Tile2(P1.tileR), cut: m1Fascia, th: 1.5 }); }
  } },
];

// ======== bvar10.js (реквизит школы и лесопилки) ========
// Следующая партия (по 4 варианта на выбор): школа 3×3 (96×96), лесопилка 3×2 (96×64), дом лесоруба 2×2 в пне (64×64),
// каменоломня 2×2 (64×64) — по нынешним правилам: ×1, своя кровля по уровню, двор с делом, вход на юге.
// На листе — уровень 1 и 3, фасад и вход сбоку.

const STR = lv => (lv === 1 ? { mat: m1Straw3(STRAW1.wheat), cut: m1StrawCut(STRAW1.wheat), th: 3 } : lv === 2 ? { mat: m1Shingle2(SHINGLE1, 0.6), cut: m1Fascia, th: 2 } : { mat: m1Tile2(P1.tileR), cut: m1Fascia, th: 2 });
const STRS = (lv, S, T) => (lv === 1 ? { mat: m1Straw3(S), cut: m1StrawCut(S), th: 3 } : lv === 2 ? { mat: m1Shingle2(SHINGLE1, 0.6), cut: m1Fascia, th: 2 } : { mat: T === P1.scale ? m1Scale2(T) : m1Tile2(T), cut: T === P1.slate || T === P1.scale ? m1FasciaDark : m1Fascia, th: 2 });
const QS = {
  board(P) { PR.rect(P, -9, -16, 9, -6, bhex('#2e3a32')); PR.rect(P, -10, -17, 10, -17, P1.plank[1]); PR.rect(P, -10, -5, 10, -5, P1.plank[2]); PR.line(P, -8, 0, -6, -5, P1.plank[2]); PR.line(P, 8, 0, 6, -5, P1.plank[2]); PR.rect(P, -6, -13, -1, -13, P1.white[1]); PR.rect(P, -6, -10, 3, -10, P1.white[1]); P(5, -13, P1.white[0]); P(6, -12, P1.white[0]); },
  desk(P) { PR.rect(P, -5, -6, 5, -5, P1.plank[0]); PR.rect(P, -5, -4, 5, -4, P1.plank[2]); P(-4, -3, P1.plank[3]); P(-4, -2, P1.plank[3]); P(4, -3, P1.plank[3]); P(4, -2, P1.plank[3]); PR.rect(P, -1, -8, 1, -7, P1.white[0]); },
  globe(P) { PR.rect(P, 0, -4, 0, 0, P1.plank[2]); PR.rect(P, -2, 0, 2, 0, P1.plank[3]); PR.ell(P, 0, -8, 4, 4, (x, y, a, b) => (bhash(x, y, 901) < 0.4 ? P1.grass[1] : P1.scale[a < 0 ? 0 : 1])); },
  books(P) { const C = [P1.red, P1.scale, P1.grass, P1.gold, P1.violet || P1.red]; for (let k = 0; k < 5; k++) { PR.rect(P, -6 + k * 2, -6 - (k % 2), -5 + k * 2, 0, C[k % 4][k % 2]); } },
  saw(P, r = 7) { PR.ell(P, 0, -r, r, r, (x, y, a, b) => { const d = a * a + b * b; return d > 0.8 ? ((Math.atan2(b, a) * 8 | 0) % 2 ? P1.iron[1] : P1.iron[2]) : d < 0.08 ? P1.iron[2] : P1.iron[0]; }); },
  wheel(P, r = 13) {   // водяное колесо сбоку
    PR.ell(P, 0, -r, r, r, (x, y, a, b) => { const d = Math.hypot(a, b), an = Math.atan2(b, a); if (d > 0.86) return P1.plank[2]; if (d > 0.72) return (Math.round(an / (Math.PI / 6)) % 2 ? P1.plank[1] : null); if (Math.abs(Math.sin(an * 4)) < 0.12) return P1.plank[3]; return d < 0.18 ? P1.iron[1] : null; });
  },
  water(P, w = 20) { for (let x = -w / 2; x < w / 2; x++) for (let y = -3; y <= 0; y++) P(x, y, (x + y * 2) % 5 === 0 ? P1.white[0] : P1.scale[y < -1 ? 0 : 1]); },
  sawhorse(P) { PR.line(P, -6, 0, -3, -6, P1.plank[2]); PR.line(P, 6, 0, 3, -6, P1.plank[2]); PR.rect(P, -8, -7, 8, -6, P1.plank[1]); PR.ell(P, 0, -9, 9, 2, (x, y, a, b) => (b < 0 ? P1.log[0] : P1.log[2])); PR.rect(P, 1, -14, 2, -9, P1.iron[1]); PR.rect(P, -2, -15, 5, -14, P1.plank[2]); },
  axeBlock(P) { Y1.chop(P); },
  rocks(P, n = 5, R = P1.stone) { for (let k = 0; k < n; k++) { const x = (bhash(k, 0, 911) - 0.5) * 18, y = -bhash(k, 1, 912) * 6, r = 2.5 + bhash(k, 2, 913) * 3; PR.ell(P, x, y, r, r * 0.8, (xx, yy, a, b) => R[b < -0.3 ? 0 : a > 0.4 ? 2 : 1]); } },
  blocks(P) { for (const [x, y] of [[-6, 0], [2, 0], [-2, -5]]) { PR.rect(P, x, y - 5, x + 7, y, P1.stone[1]); PR.rect(P, x, y - 5, x + 7, y - 5, P1.stone[0]); PR.rect(P, x + 7, y - 5, x + 7, y, P1.stone[2]); } },
  pick(P) { PR.line(P, 0, 0, 4, -12, P1.plank[1]); PR.line(P, 0, -13, 8, -10, P1.iron[1]); },
};

// =================== ШКОЛА 3×3 ===================
const SCHOOL2_VARS = [
  { name: 'Ш1. Каменная школа с колокольней и уроком под открытым небом', make(g, lv) {
    g.meta = {};
    const M = { x0: 6, x1: 60, y0: 52, y1: 92, h: 20 }, R = STRS(lv, STRAW1.wheat, P1.slate);
    box(g, Object.assign({ mat: m1Stone(P1.stoneW, 6, 4) }, M));
    roof(g, M, { type: 'gable', axis: 'X', rise: 20, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Stone(P1.stoneW, 6, 4) });
    const T = { x0: 60, x1: 78, y0: 56, y1: 76, h: 40 };
    box(g, Object.assign({ mat: m1Stone(P1.stoneB, 6, 4) }, T));
    roof(g, T, { type: 'hip', axis: 'X', rise: 16, hipL: 10.5, ov: 3, mat: R.mat, cut: R.cut, th: R.th });
    elem(g, 'S', T.y0, 64, 28, 10, 9, m1Window({ w: 10, h: 9, arch: true, lit: false })); g.sprite([69, 55.5, 30], P => Q1.bell(P), -0.5);
    elem(g, 'S', M.y0, 41, 0, 12, 15, m1Door({ w: 12, h: 15, arch: true, knob: true }));
    for (const x of [10, 24]) elem(g, 'S', M.y0, x, 5, 10, 11, m1Window({ w: 10, h: 11, arch: true, sill: true }));
    elem(g, 'E', T.x1, 62, 8, 8, 10, m1Window({ w: 8, h: 10, arch: true }));
    chimney1(g, 14, 80, M.h + 10, 12, { stone: true, w: 5, d: 5 });
    paveSand(g, 40, 54, 0, 52);
    // урок во дворе: доска, парты, глобус
    g.sprite([24, 34, 0], P => QS.board(P)); for (const [x, y] of [[16, 22], [28, 22], [16, 14], [28, 14]]) g.sprite([x, y, 0], P => QS.desk(P));
    g.sprite([70, 30, 0], P => QS.globe(P)); g.sprite([84, 20, 0], P => Q1.tree(P, 13));
    if (lv >= 2) g.sprite([62, 44, 0], P => QS.books(P));
    if (lv >= 3) { g.sprite([4, 40, 0], P => Q1.planter(P, 11)); g.sprite([88, 46, 0], P => Q1.planter(P, 9)); }
  } },
  { name: 'Ш2. Круглая башня-библиотека с телескопом и флигелем', make(g, lv) {
    g.meta = {};
    const cx = 64, cy = 68, rr = 18, R = STRS(lv, STRAW1.reed, P1.scale);
    cyl(g, cx, cy, rr, 0, 34, m1Stone(P1.stoneW, 6, 4), 28);
    cone(g, cx, cy, rr + 4, 33, 26, R.mat, R.cut, 28, 3);
    elem(g, 'S', cy - rr + 1, 59, 0, 10, 14, m1Door({ w: 10, h: 14, arch: true, col: P1.dark }));
    for (const z of [12, 24]) elem(g, 'S', cy - rr + 1.5, 52, z, 6, 8, m1Window({ w: 6, h: 8, arch: true, G: P3.crystal }));
    elem(g, 'E', cx + rr - 1, cy - 3, 20, 6, 8, m1Window({ w: 6, h: 8, arch: true, G: P3.crystal }));
    const F = { x0: 8, x1: 46, y0: 58, y1: 90, h: 16 };
    box(g, Object.assign({ mat: m1Plaster(P1.plaster, { frame: true, bay: 13, braceOdd: true }) }, F));
    roof(g, F, { type: 'gable', axis: 'Y', rise: 18, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plaster, { frame: true, bay: 11, brace: false }) });
    elem(g, 'S', F.y0, 14, 4, 9, 9, m1Window({ w: 9, h: 9, sill: true })); elem(g, 'S', F.y0, 30, 4, 9, 9, m1Window({ w: 9, h: 9, sill: true }));
    g.sprite([cx, cy, 60], P => { if (lv >= 2) { PR.line(P, -6, -2, 8, -12, P1.gold[2], 2); PR.rect(P, 7, -14, 9, -12, P1.gold[1]); } else Q3.owl(P); });
    paveSand(g, 56, 70, 0, 50);
    g.sprite([24, 40, 0], P => QS.books(P)); g.sprite([34, 42, 0], P => QS.globe(P)); g.sprite([22, 30, 0], P => Q1.bench(P, 12));
    g.sprite([86, 30, 0], P => Q3.crystalLamp(P, 16)); g.sprite([88, 52, 0], P => Q3.shroomPatch(P));
    if (lv >= 3) g.sprite([10, 46, 0], P => Q3.runeStone(P, 12));
  } },
  { name: 'Ш3. Длинная изба-школа с крыльцом, садом и партами под навесом', make(g, lv) {
    g.meta = {};
    const M = { x0: 6, x1: 90, y0: 60, y1: 88, h: 16 }, R = STRS(lv, STRAW_H.honey, P1.tileD);
    box(g, Object.assign({ mat: m1Logs(P1.log) }, M));
    roofSag(g, M, { axis: 'X', rise: 18, sag: 2, flare: 3, ov: 4, ovg: 4, mat: R.mat, cut: R.cut, th: R.th + 1, gable: m1Plank(P1.plank, 4) });
    elem(g, 'S', M.y0, 41, 0, 12, 13, m1Door({ w: 12, h: 13, col: P1.dark }));
    for (const x of [10, 24, 62, 76]) elem(g, 'S', M.y0, x, 5, 9, 8, m1Window({ w: 9, h: 8, frameR: P1.plank }));
    box(g, { x0: 34, x1: 60, y0: 50, y1: 60, h: 2, mat: m1Plank(P1.plank, 4, false), top: m1Plank(P1.plank, 4, false) });
    for (const x of [34, 58]) post1(g, x, 50, 2, 12, 2);
    roof(g, { x0: 34, x1: 60, y0: 50, y1: 60, h: 14 }, { type: 'lean', down: 'S', rise: 4, ov: 2, mat: R.mat, cut: R.cut, th: 2 });
    chimney1(g, 20, 76, M.h + 14, 10, { stone: true, w: 5, d: 5 });
    paveSand(g, 40, 54, 0, 50);
    // навес-класс во дворе: крыша на столбах, под ней парты — видно учеников
    for (const [x, y] of [[62, 14], [88, 14], [62, 36], [88, 36]]) post1(g, x, y, 0, 12, 2);
    roof(g, { x0: 62, x1: 90, y0: 30, y1: 38, h: 12 }, { type: 'lean', down: 'S', rise: 3, ov: 2, mat: R.mat, cut: R.cut, th: 2 });
    for (const [x, y] of [[70, 22], [82, 22], [70, 30], [82, 30]]) g.sprite([x, y, 0], P => QS.desk(P));
    g.sprite([76, 12, 0], P => QS.board(P));
    fence1(g, 4, 30, 6, 6); fence1(g, 4, 4, 6, 40); g.sprite([12, 26, 0], P => HQ.cabbages(P, 6)); g.sprite([20, 14, 0], P => Q1.sunflower(P, 16));
    if (lv >= 3) g.sprite([92, 50, 0], P => Q1.tree(P, 12));
  } },
  { name: 'Ш4. Волшебная школа: фахверк с синими окнами, совятник, рунный круг', make(g, lv) {
    g.meta = {};
    const Lo = { x0: 20, x1: 76, y0: 56, y1: 90, h: 14 }, Up = { x0: 18, x1: 78, y0: 52, y1: 90, z0: 14, h: 14 }, R = STRS(lv, STRAW_H.sage, P1.slate);
    box(g, Object.assign({ mat: m1Stone(P1.stone) }, Lo)); beam1(g, 18, 78, 52, 56, 13, 1, P3.oak);
    box(g, Object.assign({ mat: m1Plaster(P1.plasterC, { frame: true, bay: 12, braceX: true, beam: P3.oak }) }, Up));
    const Z = roofSag(g, Up, { axis: 'X', rise: 24, sag: 3, flare: 5, ov: 3, ovg: 5, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plasterC, { frame: true, bay: 10, brace: false, beam: P3.oak }) });
    elem(g, 'S', Lo.y0, 42, 0, 12, 13, m1Door({ w: 12, h: 13, arch: true, col: P3.oak }));
    for (const x of [24, 62]) elem(g, 'S', Lo.y0, x, 4, 8, 8, m1Window({ w: 8, h: 8, round: true, G: P3.crystal }));
    for (const x of [24, 40, 56]) elem(g, 'S', Up.y0, x, 18, 9, 8, m1Window({ w: 9, h: 8, arch: true, G: P3.crystal }));
    chimneyCrooked(g, 64, 76, Up.z0 + Up.h + 10, 14, { stone: true, w: 5, d: 5, lean: 2 });
    g.sprite([10, 70, 0], P => { PR.rect(P, 0, -26, 0, 0, P3.oak[1]); PR.rect(P, -6, -36, 6, -26, P1.plank[1]); PR.rect(P, -7, -37, 7, -37, P1.slate[1]); for (const x of [-4, 1]) PR.rect(P, x, -33, x + 2, -30, P1.ink); Q3.owl((x, y, c) => P(x + 2, y - 37, c)); });   // совятник
    paveSand(g, 42, 56, 0, 52);
    g.sprite([48, 24, 0.3], P => { for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2; P(Math.round(Math.cos(a) * 12), Math.round(Math.sin(a) * 6), P3.rune[k % 3 ? 1 : 0]); } }, -0.1);
    g.sprite([30, 40, 0], P => Q3.crystalLamp(P, 16)); g.sprite([68, 40, 0], P => Q3.crystalLamp(P, 16));
    g.sprite([82, 20, 0], P => Q3.runeStone(P, 14)); g.sprite([14, 20, 0], P => Q3.shroomPatch(P)); g.sprite([50, 30, 12], P => Q3.wisp(P), -2);
    if (lv >= 3) g.sprite([86, 44, 0], P => Q3.banner(P));
  } },
];

// =================== ЛЕСОПИЛКА 3×2 ===================
const SAW_VARS = [
  { name: 'Л1. Водяная лесопилка: колесо, жёлоб, штабеля досок', make(g, lv) {
    g.meta = {};
    const M = { x0: 8, x1: 52, y0: 26, y1: 60, h: 18 }, R = STRS(lv, STRAW1.rye, P1.tileR);
    box(g, Object.assign({ mat: m1Plank(P1.plank, 4) }, M));
    roof(g, M, { type: 'gable', axis: 'Y', rise: 18, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plank, 4) });
    elem(g, 'S', M.y0, 24, 0, 14, 14, m1Door({ w: 14, h: 14, double: true, col: P1.plank }));
    // жёлоб с водой и колесо у западной стены
    box(g, { x0: 0, x1: 8, y0: 30, y1: 34, z0: 20, h: 2, mat: m1Plank(P1.plank, 3), top: () => P1.scale[1] });
    g.sprite([4, 44, 0], P => { QS.wheel(P, 14); }); g.sprite([4, 20, 0], P => QS.water(P, 10));
    g.sprite([30, 18, 0], P => Q2.planks(P, 6, 20)); g.sprite([70, 40, 0], P => Q2.logStack(P, 4, 5)); g.sprite([74, 16, 0], P => QS.sawhorse(P));
    g.sprite([84, 28, 0], P => Q2.planks(P, 5, 16));
    paveSand(g, 44, 58, 0, 26);
    if (lv >= 3) g.sprite([60, 54, 0], P => QS.saw(P, 8));
  } },
  { name: 'Л2. Открытая пильня: большой навес на столбах, двуручная пила, козлы', make(g, lv) {
    g.meta = {};
    const R = STRS(lv, STRAW1.reed, P1.tileD);
    for (const [x, y] of [[8, 20], [46, 20], [84, 20], [8, 58], [84, 58]]) post1(g, x, y, 0, 18, 3, P3.oak);
    beam1(g, 6, 90, 20, 23, 18, 2, P3.oak);
    roof(g, { x0: 8, x1: 88, y0: 36, y1: 60, h: 20 }, { type: 'lean', down: 'S', rise: 8, ov: 3, mat: R.mat, cut: R.cut, th: R.th });   // крыша только сзади — пилу видно
    box(g, { x0: 10, x1: 86, y0: 50, y1: 60, h: 12, mat: m1Logs(P1.log) });
    g.sprite([30, 34, 0], P => QS.sawhorse(P)); g.sprite([60, 32, 0], P => QS.sawhorse(P));
    g.sprite([46, 44, 0], P => QS.saw(P, 9));
    g.sprite([20, 12, 0], P => Q2.planks(P, 7, 22)); g.sprite([74, 10, 0], P => Q2.logStack(P, 4, 6));
    g.sprite([46, 6, 0], P => { for (let k = 0; k < 12; k++) P(Math.round((bhash(k, 0, 921) - 0.5) * 20), -Math.round(bhash(k, 1, 922) * 3), P1.straw[k % 3]); });   // опилки
    if (lv >= 2) g.sprite([92, 30, 0], P => Q1.lantern(P));
  } },
  { name: 'Л3. Лесопилка с ветряком-маховиком: башенка с крыльями крутит пилу', make(g, lv) {
    g.meta = {};
    const M = { x0: 6, x1: 50, y0: 24, y1: 58, h: 16 }, R = STRS(lv, STRAW_H.honey, P1.tileR);
    box(g, Object.assign({ mat: m1Plaster(P1.plaster, { frame: true, bay: 12, braceOdd: true, low: 5 }) }, M));
    roof(g, M, { type: 'gable', axis: 'X', rise: 16, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plaster, { frame: true, bay: 10, brace: false }) });
    elem(g, 'S', M.y0, 22, 0, 12, 13, m1Door({ w: 12, h: 13, double: true, col: P1.plank }));
    const T = { x0: 54, x1: 70, y0: 36, y1: 52, h: 30 };
    box(g, Object.assign({ mat: m1Plank(P1.plank, 4) }, T)); roof(g, T, { type: 'hip', axis: 'X', rise: 10, hipL: 9.5, ov: 2, mat: R.mat, cut: R.cut, th: R.th });
    g.sprite([62, 35, 26], P => { for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; for (let r = 2; r < 20; r++) { const x = Math.round(Math.cos(a) * r), y = Math.round(Math.sin(a) * r * 0.9); P(x, y, P1.plank[2]); if (r > 6) { const nx = Math.round(-Math.sin(a) * 3), ny = Math.round(Math.cos(a) * 3); PR.line(P, x, y, x + nx, y + ny, P1.cloth[r % 3 ? 0 : 1]); } } } PR.ell(P, 0, 0, 2, 2, () => P1.iron[1]); }, -1);
    g.sprite([80, 26, 0], P => QS.sawhorse(P)); g.sprite([82, 44, 0], P => Q2.logStack(P, 3, 5)); g.sprite([30, 14, 0], P => Q2.planks(P, 6, 20));
    paveSand(g, 22, 34, 0, 24);
  } },
  { name: 'Л4. Каменный цех с трубой и рольгангом: брёвна въезжают, доски выезжают', make(g, lv) {
    g.meta = {};
    const M = { x0: 20, x1: 76, y0: 30, y1: 60, h: 18 }, R = STRS(lv, STRAW1.olive, P1.slate);
    box(g, Object.assign({ mat: m1Stone(P1.stoneW, 6, 4) }, M));
    roof(g, M, { type: 'gable', axis: 'X', rise: 16, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Stone(P1.stoneW, 6, 4) });
    elem(g, 'S', M.y0, 24, 0, 12, 12, (u, v) => (v > 10 || u < 1 || u > 10 ? P1.beam[2] : P1.dark[3]));   // проём: брёвна внутрь
    elem(g, 'S', M.y0, 60, 0, 12, 12, (u, v) => (v > 10 || u < 1 || u > 10 ? P1.beam[2] : P1.dark[3]));   // проём: доски наружу
    for (const x of [24, 60]) { box(g, { x0: x, x1: x + 12, y0: 6, y1: 30, h: 4, mat: m1Plank(P1.plank, 3), top: (u, v) => ((v | 0) % 4 === 0 ? P1.iron[2] : P1.iron[1]) }); }
    g.sprite([30, 18, 4], P => PR.ell(P, 0, -2, 6, 2.5, (x, y, a, b) => (b < 0 ? P1.log[0] : P1.log[2]))); g.sprite([66, 16, 4], P => Q2.planks(P, 2, 12));
    chimney1(g, 66, 46, M.h + 12, 16, { brick: true, w: 6, d: 6 });
    g.sprite([8, 30, 0], P => Q2.logStack(P, 4, 4)); g.sprite([90, 30, 0], P => Q2.planks(P, 6, 14));
    if (lv >= 2) g.sprite([48, 26, 0], P => Q1.lantern(P));
  } },
];

// =================== ДОМ ЛЕСОРУБА В ПНЕ 2×2 ===================
function stump(g, cx, cy, r, h, top = true) {
  cyl(g, cx, cy, r + 3, 0, 3, matBark, 24);
  cyl(g, cx, cy, r, 3, h, matBark, 24);
  if (top) g.face(Array.from({ length: 20 }, (_, i) => [cx + Math.cos(i / 20 * Math.PI * 2) * r, cy + Math.sin(i / 20 * Math.PI * 2) * r, h]), [1, 0, 0], [0, 1, 0], (u, v) => { const d = Math.hypot(u - r, v - r); return d > r - 1.5 ? BARK[1] : ((d | 0) % 3 === 0 ? P1.log[1] : P1.log[0]); });
}
const WOOD_VARS = [
  { name: 'П1. Пень под шляпкой гриба: круглая дверь, окошко, колода с топором', make(g, lv) {
    g.meta = {};
    stump(g, 32, 38, 16, 22, false);
    dome(g, 32, 38, 22, 21, 14, lv === 3 ? matShroom(BP.shroom) : lv === 2 ? m1Shingle2(SHINGLE1, 0.8) : m1Straw3(STRAW_H.ash), m1Flat(BARK[3]), 24, 6, 3);
    elem(g, 'S', 23, 42, 3, 11, 12, m1RoundDoor({ w: 11, h: 12 })); g.meta.doorPt = [47, 23, 0];
    elem(g, 'S', 23.5, 22, 10, 6, 6, m1Window({ w: 6, h: 6, round: true }));
    chimneyCrooked(g, 24, 46, 30, 10, { stone: true, w: 4, d: 4, lean: 2 });
    g.sprite([58, 30, 0], P => QS.axeBlock(P)); g.sprite([58, 46, 0], P => Q1.logs(P)); g.sprite([10, 18, 0], P => Q3.shroomPatch(P));
  } },
  { name: 'П2. Пень с избушкой на срезе: сруб сверху, лестница по корням', make(g, lv) {
    g.meta = {};
    stump(g, 30, 40, 17, 14);
    const H = { x0: 18, x1: 42, y0: 30, y1: 50, z0: 14, h: 11 };
    box(g, Object.assign({ mat: m1Logs(P1.log) }, H));
    const R = STRS(lv, STRAW1.rye, P1.tileR);
    roof(g, H, { type: 'gable', axis: 'X', rise: 11, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plank, 4) });
    elem(g, 'S', H.y0, 26, 14, 8, 10, m1Door({ w: 8, h: 10, col: P1.dark })); elem(g, 'S', 23, 40, 3, 10, 10, m1Door({ w: 10, h: 10, arch: true, col: P1.plank })); g.meta.doorPt = [45, 23, 0];
    g.sprite([48, 26, 0], P => { for (let k = 0; k < 7; k++) PR.rect(P, -4 + k, -k * 2 - 1, 0 + k, -k * 2 - 1, P1.plank[k % 2]); });
    chimney1(g, 36, 44, 34, 6, { stone: true, w: 4, d: 4 });
    g.sprite([58, 40, 0], P => Q1.logs(P)); g.sprite([10, 16, 0], P => QS.axeBlock(P));
  } },
  { name: 'П3. Пень с дуплами-окнами и мхом, мосток к поленнице', make(g, lv) {
    g.meta = {};
    stump(g, 28, 40, 18, 26);
    if (lv >= 2) dome(g, 28, 40, 10, 26, 4, (u, v, F) => P1.ivy[bcl(L1(F) + (bhash(u, v, 931) < 0.4 ? 0 : 1), 3)], m1Flat(P1.ivy[3]), 16, 3, 1);
    elem(g, 'S', 22, 22, 3, 11, 13, m1Door({ w: 11, h: 13, arch: true, knob: true, col: P1.plank })); g.meta.doorPt = [27.5, 22, 0];
    for (const [a, z] of [[14, 16], [32, 18]]) elem(g, 'S', 22.5, a, z, 6, 7, m1Window({ w: 6, h: 7, arch: true }));
    box(g, { x0: 46, x1: 62, y0: 30, y1: 36, z0: 8, h: 1.2, mat: m1Plank(P1.plank, 3), top: m1Plank(P1.plank, 3) });
    for (const x of [46, 60]) post1(g, x, 30, 0, 8, 1.5);
    g.sprite([54, 50, 0], P => Q2.logStack(P, 3, 4)); g.sprite([54, 18, 0], P => QS.axeBlock(P));
    chimneyCrooked(g, 34, 46, 26, 10, { stone: true, w: 4, d: 4, lean: -2 });
    if (lv >= 3) g.sprite([10, 52, 0], P => Q1.tree(P, 10));
  } },
  { name: 'П4. Пень-башенка: высокий ствол, конусная кровля, вывеска-топор, балкончик', make(g, lv) {
    g.meta = {};
    stump(g, 32, 40, 15, 30, false);
    const R = STRS(lv, STRAW1.reed, P1.slate);
    cone(g, 32, 40, 19, 29, 18, R.mat, R.cut, 24, 3);
    elem(g, 'S', 25, 27, 3, 10, 13, m1Door({ w: 10, h: 13, arch: true, col: P1.dark })); g.meta.doorPt = [32, 25, 0];
    elem(g, 'S', 25.5, 28, 18, 8, 7, m1Window({ w: 8, h: 7, arch: true }));
    beam1(g, 20, 44, 20, 25, 16, 1.2, P1.plank); railing1(g, 20, 44, 20.5, 20.5, 17.2, 4);
    g.sprite([48, 24, 0], P => { PR.rect(P, 0, -22, 0, 0, P3.oak[1]); PR.rect(P, 1, -21, 9, -20, P3.oak[1]); PR.rect(P, 4, -19, 9, -12, P1.plank[1]); PR.line(P, 5, -13, 8, -18, P1.plank[3]); PR.rect(P, 7, -18, 8, -16, P1.iron[0]); });
    g.sprite([56, 46, 0], P => Q1.logs(P)); g.sprite([10, 30, 0], P => QS.axeBlock(P)); g.sprite([8, 52, 0], P => Q3.shroomPatch(P));
  } },
];

// =================== КАМЕНОЛОМНЯ 2×2 ===================
function cliff(g, x0, x1, y0, y1, h) {
  box(g, { x0, x1, y0, y1, h, mat: (u, v, F) => { const row = Math.floor(v / 4), st = row % 2 ? 4 : 0, uu = ((u + st) % 9 + 9) % 9; let i = L1(F) + (bhash(Math.floor((u + st) / 9), row, 941) < 0.3 ? 0 : 1); if (uu === 0 || v % 4 === 0) i = 3; if (bhash(u, v, 942) < 0.04) return P1.ivy[2]; return p1(P1.stoneB, i); }, top: (u, v) => (bhash(u, v, 943) < 0.6 ? P1.grass[1 + (bhash(u, v, 944) < 0.3 ? 1 : 0)] : P1.stoneB[1]) });
}
const QUARRY_VARS = [
  { name: 'К1. Уступ с журавлём и сторожкой: блоки, тачка, кирка', make(g, lv) {
    g.meta = {};
    cliff(g, 2, 62, 40, 62, 26); cliff(g, 2, 26, 26, 40, 14);
    const H = { x0: 34, x1: 58, y0: 18, y1: 36, h: 13 }, R = STRS(lv, STRAW_H.ash, P1.slate);
    box(g, Object.assign({ mat: m1Stone(P1.stoneW, 5, 3) }, H)); roof(g, H, { type: 'gable', axis: 'X', rise: 10, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Stone(P1.stoneW, 5, 3) });
    elem(g, 'S', H.y0, 42, 0, 9, 11, m1Door({ w: 9, h: 11, col: P1.plank })); g.meta.doorPt = [46.5, H.y0, 0];
    chimney1(g, 52, 30, H.h + 8, 8, { stone: true, w: 4, d: 4 });
    g.sprite([14, 20, 0], P => Q2.crane(P, 28, 12)); g.sprite([22, 10, 0], P => QS.blocks(P)); g.sprite([8, 8, 0], P => QS.rocks(P, 6)); g.sprite([60, 12, 0], P => QS.pick(P)); g.sprite([30, 6, 0], P => Q1.barrow(P));
  } },
  { name: 'К2. Карьер-ступени: террасы в скале, лестница, ворот с бадьёй', make(g, lv) {
    g.meta = {};
    cliff(g, 2, 62, 46, 62, 30); cliff(g, 2, 62, 34, 46, 18); cliff(g, 2, 40, 24, 34, 8);
    g.sprite([50, 30, 18], P => { PR.rect(P, -6, -10, -6, 0, P3.oak[1]); PR.rect(P, 6, -10, 6, 0, P3.oak[1]); PR.rect(P, -7, -11, 7, -11, P3.oak[2]); PR.ell(P, 0, -8, 3, 3, () => P1.log[1]); PR.rect(P, 0, -5, 0, 10, BP.rope[1]); PR.rect(P, -3, 10, 3, 14, P1.plank[2]); }, -0.5);
    g.sprite([46, 14, 0], P => { for (let k = 0; k < 6; k++) PR.rect(P, -3, -k * 3 - 1, 3, -k * 3 - 1, P1.plank[k % 2]); PR.line(P, -4, 0, -4, -18, P1.plank[2]); PR.line(P, 4, 0, 4, -18, P1.plank[3]); });
    const R = STRS(lv, STRAW1.wheat, P1.tileR);
    for (const [x, y] of [[4, 6], [20, 6], [4, 18], [20, 18]]) post1(g, x, y, 0, 10, 2);
    roof(g, { x0: 4, x1: 22, y0: 6, y1: 20, h: 10 }, { type: 'lean', down: 'S', rise: 4, ov: 2, mat: R.mat, cut: R.cut, th: 2 });
    g.sprite([12, 14, 0], P => QS.blocks(P)); g.sprite([34, 10, 0], P => QS.rocks(P, 7)); g.sprite([58, 10, 0], P => Q1.barrow(P));
    g.meta.doorPt = [32, 10, 0];
  } },
  { name: 'К3. Каменотёсная мастерская у скалы: навес, верстак, готовые плиты', make(g, lv) {
    g.meta = {};
    cliff(g, 2, 62, 44, 62, 28);
    const R = STRS(lv, STRAW1.olive, P1.slate);
    for (const [x, y] of [[6, 22], [34, 22], [58, 22]]) post1(g, x, y, 0, 13, 2, P3.oak);
    roof(g, { x0: 6, x1: 60, y0: 30, y1: 44, h: 15 }, { type: 'lean', down: 'S', rise: 6, ov: 3, mat: R.mat, cut: R.cut, th: R.th });
    box(g, { x0: 14, x1: 30, y0: 30, y1: 36, h: 6, mat: m1Stone(P1.stone, 5, 3), top: m1Flat(P1.stone[0]) });   // верстак-плита
    g.sprite([22, 32, 6], P => QS.pick(P), -0.5);
    g.sprite([44, 34, 0], P => QS.blocks(P)); g.sprite([10, 10, 0], P => QS.blocks(P)); g.sprite([30, 8, 0], P => QS.rocks(P, 5)); g.sprite([54, 10, 0], P => Q1.barrow(P));
    g.meta.doorPt = [32, 22, 0];
  } },
  { name: 'К4. Рунная каменоломня: светящиеся жилы в скале, рунный камень, кристаллы', make(g, lv) {
    g.meta = {};
    cliff(g, 2, 62, 40, 62, 30); cliff(g, 36, 62, 28, 40, 14);
    g.sprite([20, 39.5, 6], P => { for (let k = 0; k < 18; k++) P(Math.round(k * 1.2 - 10), -Math.round(Math.sin(k * 0.7) * 3 + k * 0.6), P3.rune[k % 3 ? 1 : 0]); }, -0.4);
    g.sprite([44, 27.5, 4], P => { for (let k = 0; k < 10; k++) P(k - 5, -Math.round(Math.sin(k) * 2 + k * 0.3), P3.crystal[k % 2]); }, -0.4);
    g.sprite([12, 16, 0], P => Q3.runeStone(P, 14)); g.sprite([28, 12, 0], P => QS.blocks(P)); g.sprite([52, 14, 0], P => Q3.crystalLamp(P, 14));
    g.sprite([40, 8, 0], P => QS.rocks(P, 6, P3.crystal)); g.sprite([6, 34, 0], P => Q3.shroomPatch(P));
    g.meta.doorPt = [32, 20, 0];
  } },
];

const BV = (arr, title, w, h, top) => ({ w, h, top, vars: arr.flatMap(v => [1, 3].map(lv => ({ name: v.name + ` · ур. ${lv}`, make: g => v.make(g, lv) }))), title, bk: 1, ink: P1.ink });

// ======== bvar11.js (школа, лесопилка, лесоруб, каменоломня) ========
// Вторая итерация по замечаниям владельца:
//  · школа — вариант 4 (волшебный фахверк) + круглая башня из варианта 2, дом в углу, спереди детская площадка
//    (классики, качели, дерево с читающим гномёнком), с уровнем игр и украшений больше;
//  · лесопилка — маленький цех в углу, остальное — большая циркулярная пила, бревно распиливается на две половины;
//  · дом лесоруба в пне и каменоломня — четыре новых варианта каждый.

// ---- материалы: кора пластинами, природный камень ----
const matBark2 = (u, v, F) => {   // вертикальные пластины коры с бороздами, мох у земли
  const k = L1(F), pw = 4 + Math.floor(bhash(Math.floor(u / 5), 0, 1001) * 3), c = Math.floor(u / pw), uu = u - c * pw;
  if (v < 5 && bhash(u, v, 1002) < 0.55 - v * 0.1) return P1.ivy[bcl(1 + k + (bhash(u, v, 1003) < 0.3 ? 1 : 0), 3)];
  if (uu === 0) return BARK[3];
  const seg = Math.floor((v + bhash(c, 0, 1004) * 6) / 7), vv = (v + bhash(c, 0, 1004) * 6) % 7;
  if (vv < 1) return BARK[3];
  let i = bhash(c, seg, 1005) < 0.3 ? 0 : 1;
  if (uu === 1) i -= 1; if (uu === pw - 1) i += 1;
  return p1(BARK, i + k);
};
const matRock = (u, v, F) => {    // природный камень: крупные плиты, трещины, мох сверху
  const k = L1(F), cx = Math.floor(u / 11), cy = Math.floor(v / 8);
  let best = 1e9, sec = 1e9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const gx = cx + i, gy = cy + j, px = (gx + bhash(gx, gy, 1011)) * 11, py = (gy + bhash(gx, gy, 1012)) * 8, d = Math.hypot(u - px, (v - py) * 1.3); if (d < best) { sec = best; best = d; id = gx * 31 + gy; } else if (d < sec) sec = d; }
  if (sec - best < 1.2) return P1.stoneB[3];
  if (F.L && v / F.L < 0.25 && bhash(u, v, 1013) < 0.6) return P1.ivy[bcl(k + 1, 3)];
  const h = bhash(id, 0, 1014);
  return p1(P1.stoneB, (h < 0.3 ? 0 : h < 0.8 ? 1 : 2) + k);
};
const rockTop = (u, v) => (bhash(u, v, 1015) < 0.55 ? P1.grass[1 + (bhash(u, v, 1016) < 0.3 ? 1 : 0)] : P1.stoneB[0]);
function boulder(g, cx, cy, r, h) { dome(g, cx, cy, r, 0, h, matRock, m1Flat(P1.stoneB[3]), 18, 5, 0.5); }
function stump2(g, cx, cy, r, h, top = true) {
  cyl(g, cx, cy, r, 0, h, matBark2, 28);
  if (top) g.face(Array.from({ length: 24 }, (_, i) => [cx + Math.cos(i / 24 * Math.PI * 2) * r, cy + Math.sin(i / 24 * Math.PI * 2) * r, h]), [1, 0, 0], [0, 1, 0], (u, v) => { const d = Math.hypot(u - r, v - r); if (d > r - 1.5) return BARK[2]; if (d < 1.5) return P1.log[2]; return ((d | 0) % 3 === 0 ? P1.log[1] : bhash(u, v, 1017) < 0.04 ? P1.log[2] : P1.log[0]); });
}
function roots(g, cx, cy, r, list) { for (const a of list) { const x = cx + Math.cos(a) * (r + 2), y = cy + Math.sin(a) * (r + 2); cyl(g, x, y, 3, 0, 4, matBark2, 10); dome(g, x, y, 3, 4, 2, matBark2, m1Flat(BARK[2]), 10, 2, 0.5); } }

// ---- реквизит площадки и пилы ----
const QK = {
  hopscotch(P) { const cells = [[0, 0], [0, -4], [-3, -8], [3, -8], [0, -12], [-3, -16], [3, -16], [0, -20]]; cells.forEach(([x, y], k) => { for (let i = -2; i <= 2; i++) { P(x + i, y, P1.white[1]); P(x + i, y - 3, P1.white[1]); } P(x - 2, y - 1, P1.white[1]); P(x - 2, y - 2, P1.white[1]); P(x + 2, y - 1, P1.white[1]); P(x + 2, y - 2, P1.white[1]); if (k % 3 === 0) P(x, y - 2, P1.white[0]); }); PR.ell(P, 5, -2, 1.3, 0.9, () => P1.stone[1]); },
  swings(P) { PR.line(P, -12, 0, -9, -22, P3.oak[1]); PR.line(P, -6, 0, -9, -22, P3.oak[1]); PR.line(P, 12, 0, 9, -22, P3.oak[2]); PR.line(P, 6, 0, 9, -22, P3.oak[2]); PR.rect(P, -10, -23, 10, -22, P3.oak[0]); for (const x of [-4, 3]) { PR.rect(P, x - 1, -21, x - 1, -8, BP.rope[1]); PR.rect(P, x + 2, -21, x + 2, -8, BP.rope[1]); PR.rect(P, x - 2, -7, x + 3, -7, P1.plank[1]); } },
  seesaw(P) { PR.rect(P, -1, -3, 1, 0, P3.oak[2]); PR.line(P, -11, -2, 11, -5, P1.plank[1], 2); PR.rect(P, -11, -5, -10, -2, P1.red[1]); PR.rect(P, 10, -8, 11, -5, P1.red[1]); },
  sandbox(P) { PR.rect(P, -9, -6, 9, 0, P1.plank[2]); PR.rect(P, -8, -5, 8, -1, P3.sand[1]); for (const [x, y] of [[-4, -3], [3, -2]]) P(x, y, P3.sand[3]); PR.rect(P, 4, -5, 6, -4, P1.red[0]); PR.rect(P, -6, -4, -5, -3, P1.scale[0]); },
  slide(P) { PR.rect(P, -8, -16, -8, 0, P1.plank[2]); PR.rect(P, -4, -16, -4, 0, P1.plank[2]); for (let y = -14; y < 0; y += 3) PR.rect(P, -8, y, -4, y, P1.plank[1]); PR.rect(P, -9, -17, -3, -16, P1.plank[0]); PR.line(P, -3, -16, 10, -1, P1.scale[0], 2); PR.line(P, -3, -15, 10, 0, P1.scale[2]); },
  maypole(P) { PR.rect(P, 0, -30, 0, 0, P1.white[1]); P(0, -31, P1.gold[0]); const C = [P1.red, P1.gold, P1.scale, P1.grass]; for (let k = 0; k < 4; k++) PR.line(P, 0, -29, -10 + k * 7, -6 + (k % 2) * 3, C[k][1]); PR.ell(P, 0, -28, 3, 1.5, () => P1.ivy[1]); },
  ball(P) { PR.ell(P, 0, -2, 2, 2, (x, y, a, b) => (a + b < 0 ? P1.red[0] : P1.white[0])); },
  readTree(P) { Q1.tree(P, 15); PR.rect(P, 6, -2, 9, -1, P1.red[1]); PR.rect(P, 7, -3, 8, -3, P1.white[0]); },   // дерево, у корней книжка
  bigSaw(P, r = 13, a = 0) {   // большой диск торцом к зрителю (вертикально), зубья по краю
    PR.ell(P, 0, -r, r, r, (x, y, aa, b) => { const d = Math.hypot(aa, b), an = Math.atan2(b, aa) + a; if (d > 0.9) return Math.floor(an / (Math.PI / 14)) % 2 ? P1.iron[2] : null; if (d > 0.82) return P1.iron[1]; if (d < 0.14) return P1.iron[2]; if (Math.abs(Math.sin((an) * 3)) < 0.06) return P1.iron[1]; return aa < -0.3 && b < -0.2 ? P1.white[0] : P1.iron[0]; });
  },
  halfLog(P, L = 22, flip = false) { for (let x = 0; x < L; x++) for (let y = -4; y <= 0; y++) P(flip ? -x : x, y, y === -4 ? P1.log[0] : y === -3 ? P1.straw[0] : P1.log[1 + (x % 7 === 0 ? 1 : 0)]); PR.ell(P, flip ? -L : L, -2, 1.5, 2.5, () => P1.straw[1]); },
  log(P, L = 24) { for (let x = 0; x < L; x++) for (let y = -6; y <= 0; y++) P(x, y, y === -6 ? P1.log[0] : y > -2 ? P1.log[3] : P1.log[1 + ((x * 3 + y) % 9 === 0 ? 1 : 0)]); PR.ell(P, L, -3, 2, 3.5, (x, y, a, b) => (a * a + b * b < 0.25 ? P1.log[2] : P1.straw[0])); },
  dust(P) { for (let k = 0; k < 26; k++) P(Math.round((bhash(k, 0, 1021) - 0.5) * 14), -Math.round(bhash(k, 1, 1022) * 3), P1.straw[k % 3]); },
  wedges(P) { for (const x of [-3, 0, 3]) { PR.rect(P, x, -3, x + 1, 0, P1.iron[1]); P(x, -4, P1.iron[0]); } PR.line(P, 6, 0, 10, -8, P1.plank[1]); PR.rect(P, 8, -10, 12, -8, P1.iron[2]); },
  rails(P, L = 26) { for (let x = 0; x <= L; x += 4) PR.rect(P, x, -1, x + 1, 1, P1.plank[2]); PR.rect(P, 0, -2, L, -2, P1.iron[1]); PR.rect(P, 0, 1, L, 1, P1.iron[1]); },
  cart(P) { PR.rect(P, -7, -9, 7, -3, P1.iron[2]); PR.rect(P, -7, -9, 7, -9, P1.iron[1]); for (const x of [-4, 4]) PR.ell(P, x, -2, 2, 2, () => P1.iron[2]); for (let k = 0; k < 5; k++) PR.ell(P, -4 + k * 2, -10, 2, 1.6, () => P1.stone[k % 2]); },
  tripod(P) { PR.line(P, -9, 0, 0, -28, P3.oak[1]); PR.line(P, 9, 0, 0, -28, P3.oak[2]); PR.line(P, 2, 2, 0, -28, P3.oak[1]); PR.rect(P, 0, -27, 0, -12, BP.rope[1]); PR.rect(P, -4, -12, 4, -6, P1.stone[1]); PR.rect(P, -4, -12, 4, -12, P1.stone[0]); },
  slabs(P) { for (let k = 0; k < 3; k++) { PR.rect(P, -6 + k * 4, -14 + k, -3 + k * 4, 0, P1.stone[k % 2]); PR.rect(P, -6 + k * 4, -14 + k, -6 + k * 4, 0, P1.stone[2]); } },
};

// =================== ШКОЛА: волшебный фахверк + башня, площадка ===================
function buildSchool(g, lv) {
  g.meta = { wins: [], play: {} };
  const R = STRS(lv, STRAW_H.sage, P1.slate);
  const Lo = { x0: 2, x1: 54, y0: 60, y1: 92, h: 13 }, Up = { x0: 0, x1: 56, y0: 56, y1: 92, z0: 13, h: 13 };
  box(g, Object.assign({ mat: m1Stone(P1.stone) }, Lo)); beam1(g, 0, 56, 56, 60, 12, 1, P3.oak);
  box(g, Object.assign({ mat: m1Plaster(P1.plasterC, { frame: true, bay: 12, braceX: true, beam: P3.oak }) }, Up));
  roofSag(g, Up, { axis: 'X', rise: 22, sag: 3, flare: 5, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plasterC, { frame: true, bay: 10, brace: false, beam: P3.oak }) });
  elem(g, 'S', Lo.y0, 22, 0, 12, 12, m1Door({ w: 12, h: 12, arch: true, col: P3.oak })); g.meta.doorPt = [28, Lo.y0, 0];
  for (const x of [6, 42]) elem(g, 'S', Lo.y0, x, 3, 8, 8, m1Window({ w: 8, h: 8, round: true, G: P3.crystal }));
  for (const x of [6, 22, 40]) elem(g, 'S', Up.y0, x, 17, 9, 8, m1Window({ w: 9, h: 8, arch: true, G: P3.crystal }));
  elem(g, 'S', Up.y0 - 0.3, 20, 30, 16, 7, m1Sprite(16, 7, P => { Q1.board(P, 'none', 16, 7); PR.rect(P, -4, -2, 3, 2, P1.red[1]); PR.rect(P, -3, -1, -1, 1, P1.white[0]); PR.rect(P, 0, -1, 2, 1, P1.white[0]); }));   // вывеска с раскрытой книгой
  // круглая башня-библиотека за домом справа
  const cx = 68, cy = 80, rr = 12;
  cyl(g, cx, cy, rr, 0, 34 + (lv >= 3 ? 6 : 0), m1Stone(P1.stoneW, 6, 4), 24);
  cone(g, cx, cy, rr + 4, 33 + (lv >= 3 ? 6 : 0), 22, R.mat, R.cut, 24, 3);
  for (const z of [10, 22]) elem(g, 'S', cy - rr + 1.2, 65, z, 6, 8, m1Window({ w: 6, h: 8, arch: true, G: P3.crystal }));
  elem(g, 'E', cx + rr - 1, cy - 3, 18, 6, 8, m1Window({ w: 6, h: 8, arch: true, G: P3.crystal }));
  g.sprite([cx, cy, 56 + (lv >= 3 ? 6 : 0)], P => (lv >= 3 ? (PR.line(P, -6, -2, 8, -12, P1.gold[2], 2), PR.rect(P, 7, -14, 9, -12, P1.gold[1])) : Q3.owl(P)));
  chimneyCrooked(g, 46, 80, Up.z0 + Up.h + 10, 12, { stone: true, w: 5, d: 5, lean: 2 });
  if (lv >= 2) { for (const x of [6, 22, 40]) g.sprite([x + 4.5, 55.5, 16], P => Q1.planter(P, 9), -0.5); g.sprite([2, 56, 26], P => Q3.banner(P)); }
  if (lv >= 3) { beam1(g, 16, 40, 50, 56, 13, 2, P1.plank); railing1(g, 16, 40, 50.5, 50.5, 15, 5); g.sprite([cx + rr, cy - 4, 40], P => Q1.pennant(P, 12, P3.violet)); }
  // дорожка от входа участка (x 48) к двери
  paveSand(g, 42, 54, 0, 46); paveSand(g, 22, 54, 46, 56);
  // площадка: классики, качели, дерево с читающим гномёнком
  g.sprite([16, 30, 0.3], P => QK.hopscotch(P), -0.1); g.meta.play.hop = [16, 22, 0];
  g.sprite([74, 30, 0], P => QK.swings(P)); g.meta.play.swing = [[71, 30, 7], [78, 30, 7]];
  g.sprite([86, 50, 0], P => QK.readTree(P)); g.meta.play.read = [80, 48, 0];
  g.sprite([60, 10, 0], P => QK.ball(P));
  if (lv >= 2) { g.sprite([34, 12, 0], P => QK.sandbox(P)); g.sprite([88, 12, 0], P => QK.seesaw(P)); g.meta.play.sand = [34, 10, 0]; g.meta.play.seesaw = [[78, 12, 3], [98, 12, 5]]; }
  if (lv >= 3) { g.sprite([6, 10, 0], P => QK.slide(P)); g.sprite([32, 44, 0], P => QK.maypole(P)); g.meta.play.slide = [10, 8, 0]; g.meta.play.pole = [32, 44, 0]; g.sprite([92, 36, 0], P => Q3.crystalLamp(P, 14)); }
  g.sprite([4, 50, 0], P => Q3.shroomPatch(P)); g.sprite([54, 40, 0], P => Q3.crystalLamp(P, 14));
  // угол справа от башни: ученический огород с травами, пугало и скворечник; выше уровнем — ульи и детский домик
  box(g, { x0: 82, x1: 95, y0: 58, y1: 92, h: 1.5, mat: m1Plank(P1.plank, 3), top: (u, v) => ((v | 0) % 6 < 1 ? P1.plank[1] : (u + v) % 5 < 1 ? bhex('#4e3a28') : bhex('#6a5236')) });
  for (let y = 61; y < 92; y += 6) g.sprite([88, y, 1.5], P => { for (let x = -5; x <= 5; x += 2) { const h = 2 + ((x + y) & 1); PR.rect(P, x, -h, x, 0, P1.grass[1 + ((x + y) & 1)]); if ((x + y) % 4 === 0) P(x, -h - 1, [P3.crystal[1], P1.gold[0], P1.red[0]][(x + y + 30) % 3]); } }, -0.2);
  g.sprite([92, 74, 1.5], P => { PR.rect(P, 0, -16, 0, 0, P3.oak[1]); PR.rect(P, -5, -12, 5, -12, P3.oak[1]); PR.rect(P, -2, -12, 2, -6, P1.red[1]); PR.ell(P, 0, -15, 2.5, 2.5, () => P1.straw[1]); PR.rect(P, -3, -18, 3, -17, P1.straw[3]); P(-1, -15, P1.ink); P(1, -15, P1.ink); });   // пугало
  g.sprite([84, 56, 0], P => { PR.rect(P, 0, -18, 0, 0, P3.oak[1]); PR.rect(P, -3, -24, 3, -18, P1.plank[1]); PR.rect(P, -4, -25, 4, -25, P1.tileR[1]); P(0, -21, P1.ink); });   // скворечник
  g.meta.play.garden = [88, 66, 1.5];
  if (lv >= 2) for (const y of [84, 90]) g.sprite([94, y, 1.5], P => { PR.rect(P, -3, -7, 3, 0, P1.straw[1]); for (let k = -6; k < 0; k += 2) PR.rect(P, -3, k, 3, k, P1.straw[3]); PR.rect(P, -4, -8, 4, -8, P1.plank[2]); P(0, -2, P1.ink); P(-6, -9, P1.gold[0]); P(5, -11, P1.gold[0]); });   // ульи с пчёлами
  if (lv >= 3) { box(g, { x0: 84, x1: 94, y0: 60, y1: 70, z0: 1.5, h: 8, mat: m1Plank(P1.plankB, 3), top: m1Flat(P1.plank[1]) }); roof(g, { x0: 84, x1: 94, y0: 60, y1: 70, z0: 1.5, h: 8 }, { type: 'gable', axis: 'X', rise: 6, ov: 2, mat: m1Tile2(P1.tileR), cut: m1Fascia, th: 1.5 }); elem(g, 'S', 60, 87, 1.5, 4, 6, m1Door({ w: 4, h: 6, col: P1.red })); }
}

// =================== ЛЕСОПИЛКА: маленький цех в углу, большая циркулярка ===================
// Диск — грань-круг в плоскости XZ (вдоль подачи бревна): в виде со входом сбоку он поворачивается вместе со станком.
function sawDisc(g, cx, y, cz, r) {
  const N = 32, pts = [];
  for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, rr = r + (i % 2 ? 0 : 1.3); pts.push([cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr]); }
  // материал считаем от центра диска: (du, dv) — смещение пикселя от центра в плоскости диска
  const disc = (du, dv) => { const d = Math.hypot(du, dv) / r, an = Math.atan2(dv, du); if (d > 0.93) return P1.iron[2]; if (d > 0.86) return P1.iron[0]; if (d < 0.13) return P1.iron[2]; if (d < 0.2) return P1.iron[1]; if (Math.abs(Math.sin(an * 3)) < 0.05 && d < 0.8) return P1.iron[1]; return du - dv < -r * 0.5 ? P1.white[0] : du + dv > r * 0.6 ? P1.iron[1] : P1.iron[0]; };
  for (const [P, U] of [[pts, [1, 0, 0]], [pts.slice().reverse(), [-1, 0, 0]]]) {
    const o = P[0], cu = (cx - o[0]) * U[0], cv = cz - o[2];
    g.face(P, U, [0, 0, 1], (u, v) => disc(u - cu, v - cv), { dz: -0.4 });
  }
}
// Бревно (или половинка) брусом вдоль X: кора по бокам, свежий срез на торцах
function logBox(g, x0, x1, y0, y1, z0, h, half = false) {
  const bark = (u, v, F) => P1.log[bcl(L1(F) + 1 + ((u | 0) % 7 === 0 ? 1 : 0) + (v < 1 ? 1 : 0), 3)];
  box(g, { x0, x1, y0, y1, z0, h, mat: bark, E: (u, v) => (Math.hypot(u - (y1 - y0) / 2, v - h / 2) < 1 ? P1.log[2] : P1.straw[(u + v) % 3 < 1 ? 1 : 0]), top: half ? (u, v) => P1.straw[((u | 0) % 6 === 0) ? 1 : 0] : (u, v) => P1.log[(u | 0) % 5 === 0 ? 1 : 0] });
}

function buildSaw(g, lv) {
  g.meta = { wins: [] };
  const R = STRS(lv, STRAW1.reed, P1.tileD);
  const M = { x0: 2, x1: 30, y0: 36, y1: 62, h: 14 };
  box(g, Object.assign({ mat: m1Logs(P1.log) }, M));
  roof(g, M, { type: 'gable', axis: 'Y', rise: 14, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plank, 4) });
  elem(g, 'S', M.y0, 9, 0, 12, 11, m1Door({ w: 12, h: 11, double: true, col: P1.plank })); g.meta.doorPt = [15, M.y0, 0];
  chimney1(g, 8, 52, M.h + 8, 8, { stone: true, w: 4, d: 4 });
  // станок: длинный стол на козлах, посередине — большой диск торцом к зрителю; бревно входит справа, половинки выходят слева
  const T = { x0: 40, x1: 90, y0: 26, y1: 34 };
  box(g, { x0: T.x0, x1: T.x1, y0: T.y0, y1: T.y1, h: 6, mat: m1Plank(P1.plank, 4, false), top: (u, v) => ((u | 0) % 12 === 0 ? P1.plank[2] : P1.plank[0]) });
  for (const x of [41, 64, 88]) for (const y of [26.5, 32.5]) post1(g, x, y, 0, 6, 1.2, P3.oak);
  const r = lv >= 3 ? 14 : 12;
  sawDisc(g, 65, 30, 6 + r * 0.55, r); g.meta.saw = [65, 30, 6 + r * 0.55]; g.meta.sawR = r;
  logBox(g, 69, 89, 27, 33, 6, 6); g.meta.logIn = [79, 30, 9];
  logBox(g, 44, 61, 25.5, 29, 6, 3.5, true); logBox(g, 44, 61, 31, 34.5, 6, 3.5, true); g.meta.halves = [52, 30, 8];
  g.sprite([65, 24, 0], P => QK.dust(P)); g.meta.dust = [65, 24, 0];
  // защитный кожух и ремённый привод от вала (на 2-м и 3-м уровне)
  if (lv >= 2) { g.sprite([65, 34, 6], P => { PR.rect(P, -3, -28, 3, -27, P1.iron[2]); PR.rect(P, -3, -27, -3, -20, P1.iron[2]); PR.rect(P, 3, -27, 3, -20, P1.iron[2]); }, -0.6); g.sprite([62, 40, 0], P => { PR.ell(P, 0, -8, 4, 4, () => P1.plank[2]); PR.line(P, 0, -12, 3, -30, P1.beam[2]); PR.line(P, 3, -12, 6, -30, P1.beam[2]); }); }
  // подача и выдача
  g.sprite([104, 16, 0], P => Q2.logStack(P, lv >= 2 ? 4 : 3, 5)); g.meta.logPile = [104, 16, 0];
  g.sprite([46, 14, 0], P => Q2.planks(P, lv >= 2 ? 6 : 4, 18)); g.meta.plankPile = [46, 14, 0];
  if (lv >= 2) g.sprite([24, 18, 0], P => Q2.planks(P, 5, 16));
  if (lv >= 3) { g.sprite([100, 46, 0], P => Q2.crane(P, 26, 12)); g.sprite([14, 24, 0], P => Q1.lantern(P)); }
  g.meta.workers = [[96, 26, 0], [36, 22, 0]];   // кто подаёт бревно и кто принимает доски
  groundYard(g, 32, 126, 4, 62);
  paveSand(g, 9, 21, 20, 36);
}

// =================== ДОМ ЛЕСОРУБА В ПНЕ: 4 новых ===================
const WOOD2_VARS = [
  { name: 'Л-1. Пень-великан на корнях-арках, дверь между корней, избушка-дозор на срезе', make(g, lv) {
    g.meta = {};
    stump2(g, 30, 40, 19, 20); roots(g, 30, 40, 19, [0.3, 1.2, 2.2, 3.0, 4.0, 5.1]);
    elem(g, 'S', 21.5, 24, 0, 11, 13, m1Door({ w: 11, h: 13, arch: true, knob: true, col: P1.plank })); g.meta.doorPt = [29.5, 21.5, 0];
    elem(g, 'S', 22, 14, 9, 6, 6, m1Window({ w: 6, h: 6, round: true })); elem(g, 'S', 22, 38, 11, 6, 6, m1Window({ w: 6, h: 6, round: true }));
    const H = { x0: 22, x1: 38, y0: 34, y1: 48, z0: 20, h: 8 }, R = STRS(lv, STRAW1.rye, P1.tileR);
    box(g, Object.assign({ mat: m1Plank(P1.plank, 3) }, H)); roof(g, H, { type: 'hip', axis: 'X', rise: 8, hipL: 8, ov: 2, mat: R.mat, cut: R.cut, th: R.th });
    elem(g, 'S', 34, 27, 23, 6, 4, m1Window({ w: 6, h: 4 }));
    g.sprite([56, 44, 0], P => Q2.logStack(P, 3, 4)); g.sprite([54, 20, 0], P => QS.axeBlock(P)); g.sprite([8, 14, 0], P => Q3.shroomPatch(P));
    if (lv >= 2) g.sprite([42, 16, 0], P => Q1.lantern(P));
  } },
  { name: 'Л-2. Пень с проросшим деревцем: крона над срезом, окна в коре, фонарь', make(g, lv) {
    g.meta = {};
    stump2(g, 30, 40, 17, 22); roots(g, 30, 40, 17, [0.6, 2.5, 3.6, 5.4]);
    cyl(g, 30, 42, 3, 22, 32, matBark2, 10);
    dome(g, 30, 42, 15, 30, 12 + (lv >= 3 ? 4 : 0), matLeaf, m1Flat(LEAF[3]), 20, 5, 1); dome(g, 20, 36, 8, 28, 7, matLeaf, m1Flat(LEAF[3]), 14, 4, 1);
    elem(g, 'S', 23.5, 25, 0, 10, 12, m1Door({ w: 10, h: 12, arch: true, col: P1.dark })); g.meta.doorPt = [30, 23.5, 0];
    for (const [a, z] of [[16, 10], [38, 12]]) elem(g, 'S', 24, a, z, 6, 7, m1Window({ w: 6, h: 7, arch: true }));
    g.sprite([42, 22, 0], P => Q1.streetLamp(P, 14)); g.sprite([56, 40, 0], P => Q1.logs(P)); g.sprite([54, 18, 0], P => QS.axeBlock(P));
    if (lv >= 2) g.sprite([8, 22, 0], P => Q1.bench(P, 10));
  } },
  { name: 'Л-3. Пень и дровяной сарай: навес с топорами и пилой, свежие спилы, козлы', make(g, lv) {
    g.meta = {};
    stump2(g, 22, 42, 16, 20); roots(g, 22, 42, 16, [0.5, 2.6, 4.2]);
    const R = STRS(lv, STRAW1.wheat, P1.tileD);
    dome(g, 22, 42, 19, 20, 9, R.mat, R.cut, 20, 4, 3);
    elem(g, 'S', 26.5, 16, 0, 10, 12, m1Door({ w: 10, h: 12, arch: true, col: P1.plank })); g.meta.doorPt = [21, 26.5, 0];
    elem(g, 'S', 27, 30, 9, 6, 6, m1Window({ w: 6, h: 6, round: true }));
    for (const [x, y] of [[42, 26], [62, 26], [42, 50], [62, 50]]) post1(g, x, y, 0, 13, 2, P3.oak);
    roof(g, { x0: 42, x1: 64, y0: 40, y1: 52, h: 13 }, { type: 'lean', down: 'S', rise: 4, ov: 2, mat: R.mat, cut: R.cut, th: 2 });
    g.sprite([52, 48, 0], P => Q2.logStack(P, 3, 4)); g.sprite([52, 30, 0], P => QS.sawhorse(P));
    g.sprite([53, 50.5, 9], P => { PR.line(P, -8, 0, -8, -7, P1.plank[1]); PR.rect(P, -10, -8, -7, -6, P1.iron[1]); PR.line(P, -2, 0, -2, -7, P1.plank[1]); PR.rect(P, -4, -8, -1, -6, P1.iron[1]); PR.rect(P, 3, -6, 12, -5, P1.iron[1]); for (let x = 4; x <= 12; x += 2) P(x, -4, P1.iron[2]); }, -0.5);
    for (const [x, y] of [[40, 12], [48, 8], [58, 14]]) g.sprite([x, y, 0], P => PR.ell(P, 0, -1, 3, 2, (xx, yy, a, b) => (a * a + b * b < 0.3 ? P1.log[0] : P1.log[1])));
    if (lv >= 3) g.sprite([8, 14, 0], P => Q1.planter(P, 9));
  } },
  { name: 'Л-4. Высокий полый пень: лестница по стволу, смотровая площадка с перилами и флажком', make(g, lv) {
    g.meta = {};
    stump2(g, 30, 42, 15, 32); roots(g, 30, 42, 15, [0.4, 1.8, 3.2, 4.6]);
    beam1(g, 14, 46, 26, 58, 32, 1.2, P1.plank);
    railing1(g, 14, 46, 26, 26, 33.2, 5); railing1(g, 46, 46, 26, 58, 33.2, 5); railing1(g, 14, 14, 26, 58, 33.2, 5);
    if (lv >= 2) { const R = STRS(lv, STRAW1.reed, P1.slate); for (const [x, y] of [[16, 28], [44, 28], [16, 56], [44, 56]]) post1(g, x, y, 33, 9, 1.5); roof(g, { x0: 16, x1: 46, y0: 28, y1: 58, z0: 33, h: 9 }, { type: 'hip', axis: 'X', rise: 9, hipL: 12, ov: 2, mat: R.mat, cut: R.cut, th: 2 }); }
    elem(g, 'S', 27.5, 25, 0, 10, 12, m1Door({ w: 10, h: 12, arch: true, col: P1.dark })); g.meta.doorPt = [30, 27.5, 0];
    for (const z of [12, 22]) elem(g, 'S', 28, 34, z, 5, 6, m1Window({ w: 5, h: 6, arch: true }));
    g.sprite([46, 30, 0], P => { for (let k = 0; k < 10; k++) PR.rect(P, -3, -k * 3 - 1, 2, -k * 3 - 1, P1.plank[k % 2]); PR.line(P, -4, 0, -4, -31, P1.plank[2]); PR.line(P, 3, 0, 3, -31, P1.plank[3]); });
    g.sprite([44, 56, 33.2], P => Q1.pennant(P, 12)); g.sprite([56, 46, 0], P => Q1.logs(P)); g.sprite([8, 18, 0], P => QS.axeBlock(P));
  } },
];

// =================== КАМЕНОЛОМНЯ: 4 новых ===================
const QUARRY2_VARS = [
  { name: 'К-1. Скальный выход с забоем: валуны, ступенчатый срез, сторожка, блоки и клинья', make(g, lv) {
    g.meta = {};
    boulder(g, 14, 52, 14, 18); boulder(g, 46, 54, 16, 22); boulder(g, 30, 60, 12, 16);
    box(g, { x0: 22, x1: 40, y0: 40, y1: 50, h: 12, mat: m1Stone(P1.stoneB, 7, 4), top: rockTop }); box(g, { x0: 22, x1: 40, y0: 34, y1: 40, h: 5, mat: m1Stone(P1.stoneB, 7, 4), top: m1Flat(P1.stoneB[0]) });
    const H = { x0: 48, x1: 62, y0: 18, y1: 30, h: 10 }, R = STRS(lv, STRAW_H.ash, P1.slate);
    box(g, Object.assign({ mat: m1Plank(P1.plank, 3) }, H)); roof(g, H, { type: 'gable', axis: 'Y', rise: 8, ov: 2, ovg: 2, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plank, 3) });
    elem(g, 'S', H.y0, 51, 0, 8, 9, m1Door({ w: 8, h: 9, col: P1.dark })); g.meta.doorPt = [55, H.y0, 0];
    g.sprite([24, 26, 0], P => QS.blocks(P)); g.sprite([34, 30, 0], P => QK.wedges(P)); g.sprite([10, 18, 0], P => QS.rocks(P, 6, P1.stoneB)); g.sprite([38, 12, 0], P => Q1.barrow(P));
    // передний план: каменотёс тешет блок на колоде (сам гном и сколы — анимация игры, inside.js)
    box(g, { x0: 40, x1: 48, y0: 12, y1: 18, h: 4, mat: m1Stone(P1.stone, 4, 3), top: m1Flat(P1.stone[0]) });
    g.meta.work = [36, 14, 0]; g.meta.block = [44, 15, 4];
    if (lv >= 2) g.sprite([8, 34, 0], P => QK.tripod(P));
  } },
  { name: 'К-2. Штольня в холме: деревянный портал, рельсы, вагонетка с камнем, фонари', make(g, lv) {
    g.meta = {};
    dome(g, 32, 70, 26, 0, 24, matRock, m1Flat(P1.stoneB[3]), 24, 6, 0.5);
    box(g, { x0: 20, x1: 44, y0: 34, y1: 48, h: 16, mat: matRock, top: rockTop });   // скальный лоб перед холмом — в нём портал
    elem(g, 'S', 34, 25, 0, 14, 13, (u, v) => (v > 11 || u < 2 || u > 11 ? P3.oak[1] : v > 10 ? P3.oak[0] : P1.ink));   // портал
    post1(g, 24, 32, 0, 13, 2, P3.oak); post1(g, 39, 32, 0, 13, 2, P3.oak); beam1(g, 23, 42, 32, 34, 13, 2, P3.oak);
    g.sprite([32, 20, 0.3], P => { for (let y = 0; y < 14; y += 3) PR.rect(P, -5, -y, 5, -y, P1.plank[2]); PR.rect(P, -4, -14, -4, 0, P1.iron[1]); PR.rect(P, 4, -14, 4, 0, P1.iron[1]); }, -0.1);
    g.sprite([32, 18, 0.3], P => QK.cart(P)); g.meta.doorPt = [32, 32, 0];
    g.sprite([22, 32, 12], P => Q1.lantern(P), -0.5); g.sprite([43, 32, 12], P => Q1.lantern(P), -0.5);
    g.sprite([50, 14, 0], P => QS.blocks(P)); g.sprite([12, 12, 0], P => QS.rocks(P, 6, P1.stoneB));
    if (lv >= 2) g.sprite([54, 30, 0], P => QK.slabs(P));
    if (lv >= 3) g.sprite([8, 30, 0], P => Q1.streetLamp(P, 14));
  } },
  { name: 'К-3. Двор каменотёса: расколотый валун, тренога с блоком, готовые плиты, верстак', make(g, lv) {
    g.meta = {};
    boulder(g, 20, 40, 11, 14); boulder(g, 36, 42, 10, 13);   // валун, расколотый надвое
    box(g, { x0: 27, x1: 29, y0: 30, y1: 52, h: 13, mat: m1Flat(P1.ink) });
    g.sprite([28, 28, 0], P => QK.wedges(P)); g.meta.work = [28, 24, 0];
    g.sprite([50, 30, 0], P => QK.tripod(P)); g.sprite([56, 52, 0], P => QK.slabs(P)); g.sprite([8, 54, 0], P => QK.slabs(P));
    const R = STRS(lv, STRAW1.olive, P1.tileR);
    for (const [x, y] of [[4, 8], [22, 8], [4, 20], [22, 20]]) post1(g, x, y, 0, 10, 2);
    roof(g, { x0: 4, x1: 24, y0: 8, y1: 22, h: 10 }, { type: 'lean', down: 'S', rise: 4, ov: 2, mat: R.mat, cut: R.cut, th: 2 });
    box(g, { x0: 8, x1: 20, y0: 12, y1: 16, h: 5, mat: m1Stone(P1.stone, 4, 3), top: m1Flat(P1.stone[0]) });
    g.sprite([14, 14, 5], P => QS.pick(P), -0.5); g.meta.doorPt = [14, 8, 0];
    g.sprite([40, 10, 0], P => QS.blocks(P)); g.sprite([56, 12, 0], P => Q1.barrow(P));
    if (lv >= 3) g.sprite([60, 34, 0], P => Q1.lantern(P));
  } },
  { name: 'К-4. Рунный карьер: яма в земле, кольцо стоячих камней, светящиеся жилы, кристаллы', make(g, lv) {
    g.meta = {};
    g.sprite([32, 38, 0.2], P => { PR.ell(P, 0, -6, 20, 10, (x, y, a, b) => { const d = a * a + b * b; return d > 0.8 ? P1.stoneB[2] : d > 0.55 ? P1.stoneB[3] : bhash(x, y, 1031) < 0.04 ? P3.rune[1] : P1.ink; }); for (let k = 0; k < 8; k++) { const x = Math.round(Math.cos(k) * 12), y = -6 + Math.round(Math.sin(k) * 5); P(x, y, P3.rune[k % 2]); } }, -0.1);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + 0.3; g.sprite([32 + Math.cos(a) * 24, 44 + Math.sin(a) * 18, 0], P => Q3.runeStone(P, 10 + (k % 3) * 2)); }
    boulder(g, 54, 56, 8, 10); boulder(g, 10, 58, 7, 9);
    g.sprite([14, 14, 0], P => QS.rocks(P, 6, P3.crystal)); g.sprite([52, 14, 0], P => QS.blocks(P)); g.sprite([32, 10, 0], P => Q3.crystalLamp(P, 12));
    g.meta.doorPt = [32, 28, 0]; g.meta.work = [32, 32, 0];
    if (lv >= 2) g.sprite([20, 30, 14], P => Q3.wisp(P), -2);
    if (lv >= 3) g.sprite([56, 32, 0], P => Q3.banner(P));
  } },
];

const BV1 = (make, title, w, h, top) => ({ w, h, top, vars: [1, 2, 3].map(lv => ({ name: `уровень ${lv}`, make: g => make(g, lv) })), title, bk: 1, ink: P1.ink });

// ======== bvar12.js (реквизит блока 1) ========
// Блок 1 (оставшиеся стартовые): колодец 2×2, лазарет 3×2, извозчик 3×2, торговый пост 3×3, загон для коз 3×2 —
// по 4 варианта на выбор. Правила: дом в углу, двор с делом, крыша по уровню (своя солома), ничего не наслаивается.

const STRAW_X = {
  moss: bramp(['#c2c88a', '#98a062', '#6e7a40', '#4a5428']),     // моховая
  rust: bramp(['#e4a670', '#c27c48', '#94582c', '#663a1a']),     // рыжая
  pale: bramp(['#f2ecc4', '#d4cc96', '#aaa06a', '#787044']),     // бледная
};
const QW = {
  bucket(P) { PR.rect(P, -2, -4, 2, 0, P1.plank[2]); PR.rect(P, -2, -4, 2, -4, P1.iron[1]); PR.rect(P, -2, -1, 2, -1, P1.iron[1]); PR.rect(P, -1, -3, 1, -3, P1.scale[0]); },
  trough(P, w = 12) { PR.rect(P, -w / 2, -4, w / 2, 0, P1.plank[2]); PR.rect(P, -w / 2 + 1, -4, w / 2 - 1, -3, P1.scale[1]); PR.rect(P, -w / 2, -4, w / 2, -4, P1.plank[0]); },
  cot(P) { PR.rect(P, -7, -4, 7, -2, P1.plank[2]); PR.rect(P, -6, -6, 6, -4, P1.white[0]); PR.rect(P, -6, -6, -3, -5, P1.white[1]); P(-7, -1, P1.plank[3]); P(7, -1, P1.plank[3]); },
  cauldron(P) { PR.ell(P, 0, -4, 6, 4, (x, y, a, b) => (b < -0.5 ? P1.grass[0] : P1.iron[2])); PR.rect(P, -5, 0, -4, 1, P1.iron[2]); PR.rect(P, 4, 0, 5, 1, P1.iron[2]); for (const [x, y] of [[-2, -10], [1, -13], [-1, -16]]) PR.ell(P, x, y, 2, 1.6, () => P1.smoke[1]); },
  rack(P) { PR.rect(P, -8, -14, -8, 0, P3.oak[1]); PR.rect(P, 8, -14, 8, 0, P3.oak[1]); PR.rect(P, -9, -14, 9, -14, P3.oak[2]); for (let x = -6; x <= 6; x += 3) { PR.rect(P, x, -13, x, -7, (x / 3 & 1) ? P1.grass[1] : P1.straw[1]); P(x, -6, P1.red[0]); } },
  cross(P) { PR.rect(P, 0, -20, 0, 0, P3.oak[1]); PR.rect(P, -5, -20, 5, -12, P1.white[0]); PR.rect(P, -1, -19, 1, -13, P1.red[1]); PR.rect(P, -4, -17, 4, -15, P1.red[1]); },
  horse(P, f = 1) { PR.rect(P, -8, -12, 6, -6, P1.log[1]); PR.rect(P, -8, -12, 6, -12, P1.log[0]); for (const x of [-7, -3, 2, 5]) PR.rect(P, x, -6, x, 0, P1.log[2]); PR.rect(P, 6 * f, -16, 9 * f, -11, P1.log[1]); PR.rect(P, 9 * f, -15, 11 * f, -13, P1.log[1]); P(10 * f, -15, P1.ink); PR.rect(P, 6 * f, -17, 7 * f, -12, P1.dark[3]); PR.rect(P, -9 * f, -11, -9 * f, -5, P1.dark[3]); },
  cart(P) { propCartPlain(P); },
  hitch(P) { PR.rect(P, -10, -6, 10, -5, P3.oak[1]); PR.rect(P, -10, -6, -10, 0, P3.oak[2]); PR.rect(P, 10, -6, 10, 0, P3.oak[2]); },
  horn(P) { PR.rect(P, 0, -18, 0, 0, P3.oak[1]); PR.rect(P, 1, -17, 11, -11, P1.plank[1]); PR.ell(P, 6, -14, 3, 2, (x, y, a) => (a < 0 ? P1.gold[1] : P1.gold[2])); P(9, -14, P1.gold[0]); },
  stall(P, A = P1.red) { PR.rect(P, -9, -16, -9, 0, P3.oak[1]); PR.rect(P, 9, -16, 9, 0, P3.oak[1]); for (let x = -10; x <= 10; x++) PR.rect(P, x, -18, x, -14, (Math.floor((x + 10) / 3) % 2 ? P1.white : A)[x > 6 ? 1 : 0]); PR.rect(P, -9, -6, 9, -4, P1.plank[1]); for (const [x, c] of [[-6, P1.red[0]], [-2, P1.gold[0]], [2, P1.grass[0]], [6, P1.scale[0]]]) PR.ell(P, x, -7, 1.6, 1.3, () => c); },
  tent(P, A = P1.red) { for (let y = -18; y <= 0; y++) { const hw = Math.round((y + 18) * 0.6); for (let x = -hw; x <= hw; x++) P(x, y, (Math.floor((x + 20) / 3) % 2 ? P1.white : A)[x > hw - 2 ? 1 : 0]); } PR.rect(P, -2, -6, 2, 0, P1.dark[3]); PR.rect(P, 0, -22, 0, -18, P3.oak[1]); P(1, -22, A[0]); P(2, -21, A[0]); },
  goat(P, f = 1, R = P1.white) { PR.ell(P, 0, -6, 5, 3, (x, y, a, b) => R[b < -0.3 ? 0 : a * f > 0.4 ? 2 : 1]); for (const x of [-3, -1, 2, 4]) PR.rect(P, x, -4, x, 0, R[2]); PR.rect(P, 4 * f, -10, 6 * f, -6, R[1]); P(6 * f, -11, P1.dark[2]); P(4 * f, -11, P1.dark[2]); P(6 * f, -5, R[2]); P(7 * f, -8, P1.ink); },
};
function propCartPlain(P) { PR.rect(P, -12, -9, 12, -4, P1.plank[2]); PR.rect(P, -12, -10, 12, -10, P1.plank[0]); PR.rect(P, 12, -7, 20, -7, P1.plank[3]); for (const x of [-7, 7]) PR.ell(P, x, -2, 3, 3, (xx, y, a, b) => (a * a + b * b > 0.5 ? P1.plank[3] : (Math.abs(a) < 0.2 || Math.abs(b) < 0.2) ? P1.plank[2] : null)); }
function rf(lv, S, T) { return STRS(lv, S, T); }
function lvlProps(g, lv, list2, list3) { if (lv >= 2) list2(); if (lv >= 3) list3(); }

// =================== КОЛОДЕЦ 2×2 ===================
const WELL_VARS = [
  { name: 'К1. Каменный колодец под двускатной крышей с воротом, корыто, лавка', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW_X.moss, P1.tileR);
    cyl(g, 32, 34, 9, 0, 8, m1Stone(P1.stoneW, 5, 3), 20);
    g.face(Array.from({ length: 16 }, (_, i) => [32 + Math.cos(i / 16 * 6.283) * 7.5, 34 + Math.sin(i / 16 * 6.283) * 7.5, 8.01]), [1, 0, 0], [0, 1, 0], (u, v) => ((u + v) % 7 < 1 ? P1.scale[2] : P1.scale[3]));
    for (const x of [23, 40]) post1(g, x, 33, 8, 12, 2, P3.oak);
    beam1(g, 24, 41, 33.5, 35, 16, 1.5, P1.plank);
    roof(g, { x0: 22, x1: 42, y0: 28, y1: 40, h: 20 }, { type: 'gable', axis: 'X', rise: 8, ov: 2, ovg: 2, mat: R.mat, cut: R.cut, th: R.th });
    g.sprite([32, 33, 10], P => QW.bucket(P), -0.5);
    g.sprite([48, 14, 0], P => QW.trough(P)); g.sprite([14, 16, 0], P => Q1.bench(P, 10)); g.meta.doorPt = [32, 25, 0];
    lvlProps(g, lv, () => g.sprite([8, 40, 0], P => Q1.planter(P, 9)), () => { g.sprite([52, 40, 0], P => Q1.lantern(P)); paveSand(g, 26, 38, 0, 25); });
  } },
  { name: 'К2. Колодец-башенка: круглый сруб под конусом, фонарь, вёдра', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW_X.pale, P1.slate);
    cyl(g, 32, 38, 11, 0, 14, m1Logs(P1.log), 22);
    cone(g, 32, 38, 15, 13, 14, R.mat, R.cut, 22, 2);
    elem(g, 'S', 27.5, 27, 2, 10, 9, m1Door({ w: 10, h: 9, col: P1.dark })); g.meta.doorPt = [32, 26, 0];
    g.sprite([18, 22, 0], P => QW.bucket(P)); g.sprite([22, 18, 0], P => QW.bucket(P)); g.sprite([46, 24, 0], P => Q1.streetLamp(P, 12));
    lvlProps(g, lv, () => g.sprite([48, 46, 0], P => QW.trough(P)), () => g.sprite([32, 38, 32], P => Q1.pennant(P, 8)));
  } },
  { name: 'К3. Колодец-журавль: длинный шест с противовесом, бадья, корыто для скота', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW_X.rust, P1.tileD);
    cyl(g, 22, 40, 7, 0, 6, m1Plank(P1.plank, 3), 18);
    post1(g, 40, 40, 0, 16, 2.5, P3.oak);
    g.sprite([41, 41, 16], P => { PR.line(P, -26, 14, 20, -10, P3.oak[1], 2); PR.rect(P, 18, -12, 22, -6, P1.stone[2]); PR.rect(P, -26, 14, -26, 22, BP.rope[1]); QW.bucket((x, y, c) => P(x - 26, y + 26, c)); }, -0.5);
    roof(g, { x0: 46, x1: 62, y0: 40, y1: 56, h: 9 }, { type: 'lean', down: 'S', rise: 4, ov: 2, mat: R.mat, cut: R.cut, th: 2 });
    for (const [x, y] of [[46, 40], [60, 40]]) post1(g, x, y, 0, 9, 2);
    g.sprite([30, 16, 0], P => QW.trough(P, 16)); g.meta.doorPt = [22, 32, 0];
    lvlProps(g, lv, () => g.sprite([54, 48, 0], P => Q1.barrel(P, 7, 9)), () => g.sprite([10, 18, 0], P => Q1.flowers(P, 8)));
  } },
  { name: 'К4. Волшебный родник: каменная чаша с бирюзовой водой, рунные камни, кристальные фонари', make(g, lv) {
    g.meta = {};
    cyl(g, 32, 36, 13, 0, 5, m1Stone(P1.stoneB, 5, 3), 24);
    g.face(Array.from({ length: 24 }, (_, i) => [32 + Math.cos(i / 24 * 6.283) * 11.5, 36 + Math.sin(i / 24 * 6.283) * 11.5, 5.01]), [1, 0, 0], [0, 1, 0], (u, v) => ((u * 3 + v) % 11 < 1 ? P3.rune[0] : (u + v) % 5 < 1 ? P3.rune[1] : P3.rune[2]));
    g.sprite([32, 36, 5], P => { PR.rect(P, -1, -10, 1, 0, P1.stone[1]); PR.ell(P, 0, -12, 3, 2, () => P3.rune[0]); for (let k = 0; k < 5; k++) P(Math.round(Math.sin(k) * 3), -14 - k * 2, P3.rune[k % 2]); }, -0.5);
    for (const a of [0.6, 2.4, 4.0, 5.4]) g.sprite([32 + Math.cos(a) * 22, 36 + Math.sin(a) * 18, 0], P => Q3.runeStone(P, 11));
    g.meta.doorPt = [32, 22, 0];
    lvlProps(g, lv, () => { g.sprite([10, 14, 0], P => Q3.crystalLamp(P, 13)); g.sprite([54, 14, 0], P => Q3.crystalLamp(P, 13)); }, () => { g.sprite([12, 52, 0], P => Q3.shroomPatch(P)); g.sprite([32, 20, 14], P => Q3.wisp(P), -2); });
  } },
];

// =================== ЛАЗАРЕТ 3×2 ===================
const INF_VARS = [
  { name: 'Л1. Белёный дом с красным крестом, веранда с койками под навесом', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW_X.pale, P1.tileR);
    const M = { x0: 2, x1: 46, y0: 32, y1: 62, h: 16 };
    box(g, Object.assign({ mat: m1Plaster(P1.plasterW || P1.plaster, { low: 4, stoneR: P1.stoneW }) }, M));
    roof(g, M, { type: 'gable', axis: 'X', rise: 16, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plaster) });
    elem(g, 'S', M.y0, 30, 0, 10, 12, m1Door({ w: 10, h: 12, arch: true, col: P1.red })); g.meta.doorPt = [35, M.y0, 0];
    elem(g, 'S', M.y0, 8, 4, 9, 8, m1Window({ w: 9, h: 8, sill: true }));
    for (const [x, y] of [[50, 12], [92, 12], [50, 34], [92, 34]]) post1(g, x, y, 0, 13, 2);
    roof(g, { x0: 50, x1: 94, y0: 12, y1: 36, h: 13 }, { type: 'lean', down: 'S', rise: 5, ov: 2, mat: m1Awning(P1.red, P1.white), cut: m1Flat(P1.red[1]), th: 1.5 });
    g.sprite([62, 26, 0], P => QW.cot(P)); g.sprite([82, 26, 0], P => QW.cot(P)); g.meta.cots = [[62, 26, 0], [82, 26, 0]];
    g.sprite([46, 30, 0], P => QW.cross(P)); g.sprite([22, 18, 0], P => QW.rack(P));
    lvlProps(g, lv, () => { g.sprite([72, 18, 0], P => QW.cot(P)); g.meta.cots.push([72, 18, 0]); }, () => { g.sprite([10, 12, 0], P => QW.cauldron(P)); g.sprite([94, 46, 0], P => Q1.planter(P, 9)); });
  } },
  { name: 'Л2. Каменная часовня-лечебница с аптекарским огородом и сушилкой трав', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW_X.moss, P1.slate);
    const M = { x0: 2, x1: 34, y0: 26, y1: 62, h: 18 };
    box(g, Object.assign({ mat: m1Stone(P1.stoneW, 6, 4) }, M));
    roof(g, M, { type: 'gable', axis: 'Y', rise: 20, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Stone(P1.stoneW, 6, 4) });
    elem(g, 'S', M.y0, 12, 0, 10, 13, m1Door({ w: 10, h: 13, arch: true, col: P1.plank })); g.meta.doorPt = [17, M.y0, 0];
    elem(g, 'S', M.y0, 14, 22, 6, 7, m1Window({ w: 6, h: 7, round: true, G: P3.crystal }));
    box(g, { x0: 40, x1: 94, y0: 30, y1: 60, h: 1.2, mat: m1Plank(P1.plank, 3), top: (u, v) => ((v | 0) % 6 < 1 ? P1.plank[1] : (u + v) % 5 < 1 ? bhex('#4e3a28') : bhex('#6a5236')) });
    for (let y = 33; y < 60; y += 6) g.sprite([67, y, 1.2], P => { for (let x = -24; x <= 24; x += 3) { const h = 2 + ((x + y) & 1); PR.rect(P, x, -h, x, 0, P1.grass[1 + ((x + y) & 1)]); if ((x + y) % 4 === 0) P(x, -h - 1, [P1.white[0], P3.crystal[1], P1.gold[0]][(x + y + 99) % 3]); } }, -0.2);
    g.sprite([60, 18, 0], P => QW.rack(P)); g.sprite([84, 18, 0], P => QW.rack(P)); g.meta.garden = [67, 44, 1.2];
    lvlProps(g, lv, () => g.sprite([44, 14, 0], P => QW.cauldron(P)), () => g.sprite([94, 14, 0], P => Q3.crystalLamp(P, 12)));
  } },
  { name: 'Л3. Длинный барак с шатром-лазаретом во дворе и котлом с отваром', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW_X.rust, P1.tileD);
    const M = { x0: 2, x1: 70, y0: 44, y1: 62, h: 13 };
    box(g, Object.assign({ mat: m1Logs(P1.log) }, M));
    roofSag(g, M, { axis: 'X', rise: 12, sag: 2, flare: 2, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plank, 4) });
    elem(g, 'S', M.y0, 30, 0, 10, 11, m1Door({ w: 10, h: 11, col: P1.dark })); g.meta.doorPt = [35, M.y0, 0];
    for (const x of [8, 52]) elem(g, 'S', M.y0, x, 4, 8, 7, m1Window({ w: 8, h: 7, frameR: P1.plank }));
    g.sprite([70, 22, 0], P => QW.tent(P, P1.red)); g.sprite([40, 20, 0], P => QW.cauldron(P)); g.sprite([14, 24, 0], P => QW.cot(P)); g.meta.cots = [[14, 24, 0]];
    lvlProps(g, lv, () => { g.sprite([88, 24, 0], P => QW.tent(P, P1.scale)); }, () => { g.sprite([24, 12, 0], P => QW.cot(P)); g.meta.cots.push([24, 12, 0]); g.sprite([92, 50, 0], P => QW.cross(P)); });
  } },
  { name: 'Л4. Целительская башенка: синие окна, рунный круг исцеления, грибы и огоньки', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW_H.sage, P1.scale);
    cyl(g, 18, 46, 13, 0, 26, m1Plaster(P1.plasterC), 24);
    cone(g, 18, 46, 17, 25, 18, R.mat, R.cut, 24, 3);
    elem(g, 'S', 33.6, 13, 0, 10, 13, m1Door({ w: 10, h: 13, arch: true, col: P3.oak })); g.meta.doorPt = [18, 33, 0];
    for (const z of [8, 17]) elem(g, 'S', 34, 6, z, 6, 7, m1Window({ w: 6, h: 7, arch: true, G: P3.crystal }));
    g.sprite([60, 30, 0.3], P => { for (let k = 0; k < 32; k++) { const a = k / 32 * 6.283; P(Math.round(Math.cos(a) * 16), Math.round(Math.sin(a) * 8), P3.rune[k % 3 ? 1 : 0]); } for (const [x, y] of [[0, -3], [-2, 0], [2, 0], [0, 3], [0, 0]]) P(x, y, P3.rune[0]); }, -0.1);
    g.sprite([60, 30, 0], P => QW.cot(P)); g.meta.cots = [[60, 30, 0]]; g.meta.circle = [60, 30, 0];
    g.sprite([90, 50, 0], P => Q3.shroomPatch(P)); g.sprite([36, 12, 0], P => Q3.crystalLamp(P, 13)); g.sprite([60, 40, 12], P => Q3.wisp(P), -2);
    lvlProps(g, lv, () => g.sprite([88, 14, 0], P => Q3.crystalLamp(P, 13)), () => g.sprite([86, 34, 0], P => Q3.runeStone(P, 12)));
  } },
];

// =================== ИЗВОЗЧИК 3×2 ===================
const STABLE_VARS = [
  { name: 'И1. Конюшня-сарай с воротами, коновязь, телега, кормушка', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW1.rye, P1.tileR);
    const M = { x0: 2, x1: 50, y0: 30, y1: 62, h: 15 };
    box(g, Object.assign({ mat: m1Plank(P1.plank, 4) }, M));
    roof(g, M, { type: 'gable', axis: 'Y', rise: 16, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plank, 4) });
    elem(g, 'S', M.y0, 14, 0, 18, 13, m1Door({ w: 18, h: 13, double: true, col: P1.plank })); g.meta.doorPt = [23, M.y0, 0];
    elem(g, 'S', M.y0, 21, 17, 6, 5, m1Window({ w: 6, h: 5, lit: false }));
    g.sprite([70, 34, 0], P => QW.hitch(P)); g.sprite([66, 33, 0], P => QW.horse(P, 1)); g.meta.horse = [66, 33, 0];
    g.sprite([72, 14, 0], P => QW.cart(P)); g.sprite([90, 46, 0], P => QW.trough(P));
    lvlProps(g, lv, () => g.sprite([92, 26, 0], P => Q2.sacks(P, 3)), () => { g.sprite([84, 34, 0], P => QW.horse(P, -1)); g.sprite([44, 18, 0], P => Q1.lantern(P)); });
  } },
  { name: 'И2. Каретный двор: дом извозчика в углу и длинный навес с телегами', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW_X.rust, P1.tileD);
    const H = { x0: 2, x1: 30, y0: 36, y1: 62, h: 14 };
    box(g, Object.assign({ mat: m1Plaster(P1.plaster, { frame: true, bay: 10, braceOdd: true }) }, H));
    roof(g, H, { type: 'gable', axis: 'Y', rise: 14, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plaster, { frame: true, bay: 8, brace: false }) });
    elem(g, 'S', H.y0, 10, 0, 9, 11, m1Door({ w: 9, h: 11, col: P1.dark })); g.meta.doorPt = [14, H.y0, 0];
    for (const [x, y] of [[36, 40], [64, 40], [92, 40], [36, 60], [92, 60]]) post1(g, x, y, 0, 13, 2, P3.oak);
    roof(g, { x0: 36, x1: 94, y0: 40, y1: 62, h: 13 }, { type: 'lean', down: 'S', rise: 6, ov: 2, mat: R.mat, cut: R.cut, th: R.th });
    g.sprite([52, 52, 0], P => QW.cart(P)); g.sprite([66, 20, 0], P => QW.horse(P, 1)); g.meta.horse = [66, 20, 0];
    lvlProps(g, lv, () => g.sprite([80, 52, 0], P => QW.cart(P)), () => g.sprite([20, 18, 0], P => QW.horn(P)));
  } },
  { name: 'И3. Конюшня с сеновалом под полувальмой, стог, поилка', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW1.wheat, P1.tileR);
    const M = { x0: 2, x1: 54, y0: 32, y1: 62, h: 18 };
    box(g, Object.assign({ mat: (u, v, F) => (v < 8 ? m1Stone(P1.stoneW)(u, v, F) : m1Plank(P1.plank, 4)(u, v, F)) }, M));
    roof(g, M, { type: 'half', axis: 'X', rise: 18, hipL: 10, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plank, 4) });
    elem(g, 'S', M.y0, 6, 0, 14, 12, m1Door({ w: 14, h: 12, double: true, col: P1.plank })); elem(g, 'S', M.y0, 32, 0, 14, 12, m1Door({ w: 14, h: 12, double: true, col: P1.plank })); g.meta.doorPt = [13, M.y0, 0];
    elem(g, 'S', M.y0, 22, 14, 10, 7, m1Door({ w: 10, h: 7, col: P1.plank }));
    g.sprite([76, 46, 0], P => Q1.hay(P, 9)); g.sprite([80, 16, 0], P => QW.trough(P, 16)); g.sprite([66, 22, 0], P => QW.horse(P, 1)); g.meta.horse = [66, 22, 0];
    lvlProps(g, lv, () => g.sprite([92, 30, 0], P => Q1.hay(P, 7)), () => g.sprite([92, 14, 0], P => QW.horse(P, -1)));
  } },
  { name: 'И4. Почтовая станция: вывеска с рожком, двор с двумя телегами и фонарями', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW_X.pale, P1.slate);
    const M = { x0: 2, x1: 40, y0: 36, y1: 62, h: 16 };
    box(g, Object.assign({ mat: m1Stone(P1.stoneW, 6, 4) }, M));
    roof(g, M, { type: 'hip', axis: 'X', rise: 12, hipL: 10, ov: 3, mat: R.mat, cut: R.cut, th: R.th });
    elem(g, 'S', M.y0, 14, 0, 10, 12, m1Door({ w: 10, h: 12, arch: true, col: P3.oak })); g.meta.doorPt = [19, M.y0, 0];
    for (const x of [4, 30]) elem(g, 'S', M.y0, x, 4, 7, 7, m1Window({ w: 7, h: 7 }));
    g.sprite([44, 30, 0], P => QW.horn(P)); g.sprite([62, 44, 0], P => QW.cart(P)); g.sprite([62, 20, 0], P => QW.cart(P));
    g.sprite([84, 30, 0], P => QW.horse(P, -1)); g.meta.horse = [84, 30, 0];
    paveSand(g, 44, 94, 8, 56);
    lvlProps(g, lv, () => { g.sprite([46, 10, 0], P => Q1.streetLamp(P, 13)); g.sprite([94, 10, 0], P => Q1.streetLamp(P, 13)); }, () => g.sprite([92, 52, 0], P => Q2.crates(P)));
  } },
];

// =================== ТОРГОВЫЙ ПОСТ 3×3 ===================
const TRADE_VARS = [
  { name: 'Т1. Лавка в углу и рыночная площадь с прилавками под полосатыми тентами', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW1.olive, P1.tileR);
    const M = { x0: 2, x1: 38, y0: 60, y1: 94, h: 16 };
    box(g, Object.assign({ mat: m1Plaster(P1.plaster, { frame: true, bay: 12, braceOdd: true, low: 4 }) }, M));
    roof(g, M, { type: 'gable', axis: 'X', rise: 16, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plaster, { frame: true, bay: 10, brace: false }) });
    elem(g, 'S', M.y0, 14, 0, 10, 12, m1Door({ w: 10, h: 12, col: P1.dark })); g.meta.doorPt = [19, M.y0, 0];
    elem(g, 'S', M.y0, 4, 4, 8, 7, m1Window({ w: 8, h: 7 }));
    paveSand(g, 40, 94, 6, 70);
    g.sprite([54, 40, 0], P => QW.stall(P, P1.red)); g.sprite([80, 40, 0], P => QW.stall(P, P1.scale)); g.meta.stalls = [[54, 36, 0], [80, 36, 0]];
    g.sprite([66, 18, 0], P => Q2.crates(P)); g.sprite([88, 16, 0], P => Q2.barrels(P)); g.sprite([22, 46, 0], P => Q2.scale(P));
    lvlProps(g, lv, () => { g.sprite([54, 62, 0], P => QW.stall(P, P1.grass)); g.meta.stalls.push([54, 58, 0]); }, () => { g.sprite([80, 62, 0], P => QW.stall(P, P1.gold)); g.meta.stalls.push([80, 58, 0]); bunting(g, [40, 70, 16], [94, 70, 16]); });
  } },
  { name: 'Т2. Фахверковая контора со складом-пристройкой, весы, бочки и ящики на пристани товаров', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW_X.rust, P1.slate);
    const M = { x0: 2, x1: 40, y0: 54, y1: 94, h: 20 }, A = { x0: 40, x1: 70, y0: 70, y1: 94, h: 12 };
    box(g, Object.assign({ mat: m1Plaster(P1.plasterC, { frame: true, bay: 12, braceX: true, beam: P3.oak }) }, M));
    roof(g, M, { type: 'gable', axis: 'Y', rise: 20, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plasterC, { frame: true, bay: 10, brace: false, beam: P3.oak }) });
    box(g, Object.assign({ mat: m1Plank(P1.plank, 4) }, A));
    roof(g, A, { type: 'lean', down: 'S', rise: 6, ov: 2, mat: R.mat, cut: R.cut, th: 2 });
    elem(g, 'S', M.y0, 14, 0, 10, 13, m1Door({ w: 10, h: 13, arch: true, col: P3.oak })); g.meta.doorPt = [19, M.y0, 0];
    elem(g, 'S', A.y0, 48, 0, 14, 10, m1Door({ w: 14, h: 10, double: true, col: P1.plank }));
    g.sprite([54, 40, 0], P => Q2.scale(P)); g.sprite([76, 30, 0], P => Q2.barrels(P)); g.sprite([82, 50, 0], P => Q2.crates(P)); g.sprite([30, 26, 0], P => Q2.sacks(P, 4));
    lvlProps(g, lv, () => g.sprite([66, 14, 0], P => QW.cart(P)), () => g.sprite([90, 14, 0], P => QW.stall(P, P1.scale)));
  } },
  { name: 'Т3. Ярмарка: шатёр торговца в углу, палатки и флажки на площади', make(g, lv) {
    g.meta = {};
    g.sprite([22, 80, 0], P => { QW.tent((x, y, c) => P(x * 1.6 | 0, y * 1.6 | 0, c), P1.violet || P1.red); });
    paveSand(g, 34, 94, 6, 70);
    g.sprite([52, 50, 0], P => QW.tent(P, P1.red)); g.sprite([80, 50, 0], P => QW.tent(P, P1.gold)); g.sprite([66, 22, 0], P => QW.stall(P, P1.grass));
    g.meta.doorPt = [22, 66, 0]; g.meta.stalls = [[52, 46, 0], [80, 46, 0], [66, 18, 0]];
    bunting(g, [34, 70, 16], [94, 70, 16]);
    lvlProps(g, lv, () => g.sprite([92, 22, 0], P => QW.stall(P, P1.scale)), () => { g.sprite([40, 22, 0], P => QW.stall(P, P1.red)); bunting(g, [34, 30, 14], [94, 30, 14]); });
  } },
  { name: 'Т4. Волшебная лавка: башенка с витриной кристаллов, вывеска-фонарь, рунный прилавок', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW_H.sage, P1.scale);
    const M = { x0: 2, x1: 34, y0: 62, y1: 94, h: 16 };
    box(g, Object.assign({ mat: m1Plaster(P1.plasterC, { frame: true, bay: 10, braceX: true, beam: P3.oak, low: 4 }) }, M));
    roofSag(g, M, { axis: 'X', rise: 16, sag: 2, flare: 4, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plasterC, { frame: true, bay: 8, brace: false, beam: P3.oak }) });
    cyl(g, 44, 82, 9, 0, 30, m1Stone(P1.stoneW, 5, 3), 20); cone(g, 44, 82, 12, 29, 16, R.mat, R.cut, 20, 2);
    elem(g, 'S', M.y0, 12, 0, 10, 12, m1Door({ w: 10, h: 12, arch: true, col: P3.oak })); g.meta.doorPt = [17, M.y0, 0];
    elem(g, 'S', M.y0, 3, 3, 8, 8, m1Window({ w: 8, h: 8, G: P3.crystal })); elem(g, 'S', 73.4, 41, 14, 6, 8, m1Window({ w: 6, h: 8, arch: true, G: P3.crystal }));
    g.sprite([64, 46, 0], P => { QW.stall(P, P3.violet); for (const x of [-6, -2, 2, 6]) { PR.rect(P, x, -10, x + 1, -7, P3.crystal[x & 1]); } }); g.meta.stalls = [[64, 42, 0]];
    g.sprite([36, 60, 0], P => Q3.crystalLamp(P, 14)); g.sprite([86, 20, 0], P => Q3.runeStone(P, 12)); g.sprite([60, 20, 0], P => QS.rocks(P, 5, P3.crystal));
    lvlProps(g, lv, () => g.sprite([90, 56, 0], P => Q3.shroomPatch(P)), () => { g.sprite([84, 42, 0], P => QW.stall(P, P1.scale)); g.meta.stalls.push([84, 38, 0]); g.sprite([66, 30, 14], P => Q3.wisp(P), -2); });
  } },
];

// =================== ЗАГОН ДЛЯ КОЗ 3×2 ===================
const GOAT_VARS = [
  { name: 'З1. Козлятник-сарайчик в углу, загон оградой, стог и кормушка', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW_X.moss, P1.tileR);
    const M = { x0: 2, x1: 30, y0: 40, y1: 62, h: 11 };
    box(g, Object.assign({ mat: m1Plank(P1.plank, 4) }, M));
    roof(g, M, { type: 'gable', axis: 'X', rise: 10, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plank, 4) });
    elem(g, 'S', M.y0, 10, 0, 9, 9, m1Door({ w: 9, h: 9, col: P1.plank })); g.meta.doorPt = [14, M.y0, 0];
    fence1(g, 34, 94, 6, 6); fence1(g, 94, 94, 6, 60); fence1(g, 34, 34, 6, 30);
    g.sprite([86, 50, 0], P => Q1.hay(P, 8)); g.sprite([48, 14, 0], P => QW.trough(P));
    g.meta.pen = [[40, 10], [90, 56]];
    for (const [x, y, f] of [[56, 32, 1], [72, 22, -1], [78, 40, 1]]) g.sprite([x, y, 0], P => QG(P, f));
    lvlProps(g, lv, () => g.sprite([20, 22, 0], P => QW.bucket(P)), () => g.sprite([12, 18, 0], P => Q1.bench(P, 10)));
  } },
  { name: 'З2. Каменный хлев и горка из валунов — козы лазают по камням', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW_X.pale, P1.slate);
    const M = { x0: 2, x1: 32, y0: 38, y1: 62, h: 12 };
    box(g, Object.assign({ mat: m1Stone(P1.stoneW, 6, 4) }, M));
    roof(g, M, { type: 'hip', axis: 'X', rise: 10, hipL: 8, ov: 3, mat: R.mat, cut: R.cut, th: R.th });
    elem(g, 'S', M.y0, 11, 0, 9, 9, m1Door({ w: 9, h: 9, arch: true, col: P1.plank })); g.meta.doorPt = [15, M.y0, 0];
    boulder(g, 64, 36, 12, 12); boulder(g, 80, 46, 9, 9); boulder(g, 54, 46, 7, 7);
    fence1(g, 36, 94, 4, 4); fence1(g, 94, 94, 4, 60);
    g.sprite([64, 36, 12], P => QG(P, 1), -0.5); g.sprite([80, 22, 0], P => QG(P, -1)); g.sprite([46, 18, 0], P => QW.trough(P));
    g.meta.pen = [[40, 8], [90, 58]];
    lvlProps(g, lv, () => g.sprite([80, 46, 9], P => QG(P, -1), -0.5), () => g.sprite([88, 14, 0], P => Q1.hay(P, 7)));
  } },
  { name: 'З3. Плетёный загон с навесом, доильная скамья, ведро и сыроварня-котёл', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW1.wheat, P1.tileD);
    for (const [x, y] of [[4, 40], [34, 40], [4, 60], [34, 60]]) post1(g, x, y, 0, 11, 2);
    roof(g, { x0: 4, x1: 36, y0: 40, y1: 62, h: 11 }, { type: 'lean', down: 'S', rise: 5, ov: 2, mat: R.mat, cut: R.cut, th: R.th });
    box(g, { x0: 4, x1: 36, y0: 58, y1: 62, h: 9, mat: m1Plank(P1.plank, 3) });
    g.sprite([18, 46, 0], P => Q1.bench(P, 8)); g.sprite([24, 46, 0], P => QW.bucket(P)); g.sprite([12, 20, 0], P => QW.cauldron(P)); g.meta.doorPt = [20, 40, 0];
    g.sprite([66, 34, 0], P => { for (let x = -28; x <= 28; x++) { P(x, -6 + ((x & 3) ? 0 : -1), P1.plank[1]); P(x, -3, P1.plank[2]); if (x % 7 === 0) PR.rect(P, x, -8, x, 0, P3.oak[1]); } }, -0.3);
    for (const [x, y, f] of [[56, 24, 1], [74, 18, -1], [84, 30, 1]]) g.sprite([x, y, 0], P => QG(P, f));
    g.meta.pen = [[40, 8], [92, 30]];
    lvlProps(g, lv, () => g.sprite([90, 50, 0], P => Q1.hay(P, 8)), () => g.sprite([60, 50, 0], P => QG(P, -1, P1.log)));
  } },
  { name: 'З4. Козий домик на сваях с трапом, высокая кормушка, качели-брёвна', make(g, lv) {
    g.meta = {}; const R = rf(lv, STRAW_X.rust, P1.scale);
    const H = { x0: 4, x1: 26, y0: 40, y1: 60, z0: 8, h: 9 };
    for (const [x, y] of [[5, 41], [23, 41], [5, 57], [23, 57]]) post1(g, x, y, 0, 8, 2, P3.oak);
    box(g, Object.assign({ mat: m1Plank(P1.plank, 3) }, H));
    roof(g, H, { type: 'gable', axis: 'X', rise: 8, ov: 2, ovg: 2, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plank, 3) });
    g.sprite([30, 36, 0], P => { for (let k = 0; k < 8; k++) PR.rect(P, -4 + k, -k - 1, 2 + k, -k - 1, P1.plank[k % 2]); }); g.meta.doorPt = [15, 38, 0];
    g.sprite([60, 44, 0], P => { PR.rect(P, -1, -14, 1, 0, P3.oak[1]); PR.rect(P, -8, -16, 8, -12, P1.plank[2]); PR.rect(P, -7, -17, 7, -16, P1.straw[1]); });
    g.sprite([80, 24, 0], P => { PR.line(P, -12, 0, 12, -4, P1.log[1], 3); PR.rect(P, -1, -3, 1, 0, P3.oak[2]); });
    fence1(g, 36, 94, 4, 4); fence1(g, 94, 94, 4, 60);
    for (const [x, y, f] of [[50, 26, 1], [72, 40, -1], [15, 50, 1]]) g.sprite([x, y, x < 30 ? 8 : 0], P => QG(P, f), x < 30 ? -0.5 : 0);
    g.meta.pen = [[40, 8], [90, 58]];
    lvlProps(g, lv, () => g.sprite([88, 50, 0], P => Q1.hay(P, 7)), () => g.sprite([44, 14, 0], P => QW.trough(P)));
  } },
];
function QG(P, f, R) { QW.goat(P, f, R); }


// ======== bvar13.js (колодец, извозчик, торговый пост, загон) ========
// Блок 1, вторая итерация по выбору владельца:
//  колодец — каменный под красной крышей, ровно (фронтон к зрителю), с дорожкой и чуть волшебной водой;
//  лазарет — от варианта 1 (дом в углу, котёл зельевара) + огород лечебных трав; 3 варианта;
//  извозчик — домик в углу, выгул-поле с загонами (лошади и телеги — игровые, анимация);
//  торговый пост — контора с пристройкой (вариант 2), спереди подъезжает торговая телега, торговец грузит;
//  загон для коз — сарай в углу и большой загон (козы — игровые, ходят по загону).

function herbBeds(g, x0, x1, y0, y1) {
  box(g, { x0, x1, y0, y1, h: 1.2, mat: m1Plank(P1.plank, 3), top: (u, v) => ((v | 0) % 6 < 1 ? P1.plank[1] : (u + v) % 5 < 1 ? bhex('#4e3a28') : bhex('#6a5236')) });
  for (let y = y0 + 3; y < y1; y += 6) g.sprite([(x0 + x1) / 2, y, 1.2], P => { const w = (x1 - x0) / 2 - 2; for (let x = -w; x <= w; x += 3) { const h = 2 + ((x + y) & 1); PR.rect(P, x, -h, x, 0, P1.grass[1 + ((x + y) & 1)]); if ((x + y) % 4 === 0) P(x, -h - 1, [P1.white[0], P3.crystal[1], P1.gold[0], P1.red[0]][((x + y) / 4 + 99 | 0) % 4]); } }, -0.2);
}

// =================== КОЛОДЕЦ ===================
function buildWell(g, lv) {
  g.meta = {};
  const R = STRS(lv, STRAW_X.moss, P1.tileR);
  paveSand(g, 26, 38, 0, 26);
  cyl(g, 32, 38, 10, 0, 8, m1Stone(P1.stoneW, 5, 3), 22);
  g.face(Array.from({ length: 20 }, (_, i) => [32 + Math.cos(i / 20 * 6.283) * 8.5, 38 + Math.sin(i / 20 * 6.283) * 8.5, 8.01]), [1, 0, 0], [0, 1, 0], (u, v) => ((u * 3 + v) % 13 < 1 ? P3.rune[0] : (u + v) % 6 < 1 ? P1.scale[1] : P1.scale[2]));
  for (const y of [32, 44]) { post1(g, 21, y, 8, 13, 2, P3.oak); post1(g, 41, y, 8, 13, 2, P3.oak); }
  beam1(g, 22, 42, 37.5, 39, 17, 1.5, P1.plank);
  roof(g, { x0: 20, x1: 44, y0: 30, y1: 47, h: 21 }, { type: 'gable', axis: 'Y', rise: 9, ov: 2, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plank, 3) });   // фронтон к зрителю — колодец стоит ровно
  g.sprite([32, 37, 10], P => QW.bucket(P), -0.5); g.sprite([22, 37, 15], P => { PR.rect(P, -3, -2, 3, 2, P1.plank[2]); PR.rect(P, -4, 0, -3, 0, P1.iron[1]); }, -0.5);   // ворот
  g.sprite([48, 18, 0], P => QW.trough(P)); g.sprite([14, 18, 0], P => Q1.bench(P, 10)); g.sprite([16, 30, 0], P => QW.bucket(P));
  g.meta.doorPt = [32, 26, 0]; g.meta.bucket = [32, 37, 10];
  if (lv >= 2) { g.sprite([8, 44, 0], P => Q1.planter(P, 9)); g.sprite([56, 44, 0], P => Q1.flowers(P, 8)); }
  if (lv >= 3) { g.sprite([52, 28, 0], P => Q1.lantern(P)); g.sprite([10, 52, 0], P => Q3.shroomPatch(P)); }
}

// =================== ЛАЗАРЕТ: три варианта от первого ===================
function infBase(g, lv, o) {
  g.meta = { cots: [] };
  const R = STRS(lv, o.straw, o.tile);
  const M = { x0: 2, x1: o.w, y0: 34, y1: 62, h: 16 };
  box(g, Object.assign({ mat: o.wall }, M));
  (o.sag ? roofSag : roof)(g, M, Object.assign({ type: 'gable', axis: 'X', rise: 16, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: o.gable }, o.sag ? { sag: 2, flare: 3 } : {}));
  elem(g, 'S', M.y0, o.w - 16, 0, 10, 12, m1Door({ w: 10, h: 12, arch: true, col: P1.red })); g.meta.doorPt = [o.w - 11, M.y0, 0];
  elem(g, 'S', M.y0, 6, 4, 9, 8, m1Window({ w: 9, h: 8, sill: true }));
  chimney1(g, 8, 50, M.h + 8, 10, { stone: true, w: 5, d: 5 });
  g.sprite([o.w + 2, 33, 0], P => QW.cross(P));
  g.sprite([14, 22, 0], P => QW.cauldron(P)); g.meta.cauldron = [14, 22, 0];   // зельевар варит отвар
  return M;
}
const INF2_VARS = [
  { name: 'ЛА. Белёный дом в углу, котёл зельевара, огород трав и навес с койками справа', make(g, lv) {
    infBase(g, lv, { w: 40, straw: STRAW_X.pale, tile: P1.tileR, wall: m1Plaster(P1.plasterW || P1.plaster, { low: 4, stoneR: P1.stoneW }), gable: m1Plaster(P1.plaster) });
    herbBeds(g, 4, 34, 4, 16); g.meta.garden = [19, 10, 1.2];
    for (const [x, y] of [[54, 14], [92, 14], [54, 36], [92, 36]]) post1(g, x, y, 0, 13, 2);
    roof(g, { x0: 54, x1: 94, y0: 14, y1: 38, h: 13 }, { type: 'lean', down: 'S', rise: 5, ov: 2, mat: m1Awning(P1.red, P1.white), cut: m1Flat(P1.red[1]), th: 1.5 });
    for (const [x, y] of [[64, 28], [84, 28]]) { g.sprite([x, y, 0], P => QW.cot(P)); g.meta.cots.push([x, y, 0]); }
    if (lv >= 2) { g.sprite([74, 20, 0], P => QW.cot(P)); g.meta.cots.push([74, 20, 0]); g.sprite([44, 18, 0], P => QW.rack(P)); }
    if (lv >= 3) { g.sprite([92, 50, 0], P => Q3.crystalLamp(P, 12)); g.sprite([48, 52, 0], P => Q1.planter(P, 9)); }
  } },
  { name: 'ЛБ. Фахверк в углу, котёл и сушилки трав, большой огород на всю площадку', make(g, lv) {
    infBase(g, lv, { w: 38, straw: STRAW_X.moss, tile: P1.tileD, wall: m1Plaster(P1.plaster, { frame: true, bay: 10, braceOdd: true, low: 4 }), gable: m1Plaster(P1.plaster, { frame: true, bay: 8, brace: false }), sag: true });
    herbBeds(g, 46, 94, 30, 60); g.meta.garden = [70, 44, 1.2];
    g.sprite([56, 20, 0], P => QW.rack(P)); g.sprite([82, 20, 0], P => QW.rack(P));
    g.sprite([34, 12, 0], P => QW.cot(P)); g.meta.cots.push([34, 12, 0]);
    if (lv >= 2) { g.sprite([70, 10, 0], P => QW.cot(P)); g.meta.cots.push([70, 10, 0]); }
    if (lv >= 3) { g.sprite([94, 10, 0], P => Q1.lantern(P)); g.sprite([4, 50, 0], P => Q3.shroomPatch(P)); }
  } },
  { name: 'ЛВ. Каменная лечебница в углу, теплица-навес с травами, котёл и колодец для отвара', make(g, lv) {
    infBase(g, lv, { w: 42, straw: STRAW_X.rust, tile: P1.slate, wall: m1Stone(P1.stoneW, 6, 4), gable: m1Stone(P1.stoneW, 6, 4) });
    for (const [x, y] of [[52, 34], [92, 34], [52, 60], [92, 60]]) post1(g, x, y, 0, 12, 2, P3.oak);
    roof(g, { x0: 52, x1: 94, y0: 34, y1: 62, h: 12 }, { type: 'gable', axis: 'X', rise: 6, ov: 2, ovg: 2, mat: (u, v, F) => ((u | 0) % 8 < 1 ? P3.oak[1] : P3.crystal[0]), cut: m1Flat(P3.oak[2]), th: 1 });   // стеклянная теплица
    herbBeds(g, 54, 92, 36, 60); g.meta.garden = [73, 48, 1.2];
    g.sprite([60, 16, 0], P => QW.cot(P)); g.sprite([82, 16, 0], P => QW.cot(P)); g.meta.cots.push([60, 16, 0], [82, 16, 0]);
    g.sprite([40, 14, 0], P => QW.bucket(P));
    if (lv >= 2) g.sprite([94, 24, 0], P => QW.rack(P));
    if (lv >= 3) g.sprite([4, 10, 0], P => Q3.crystalLamp(P, 12));
  } },
];

// =================== ИЗВОЗЧИК ===================
function buildStable(g, lv) {
  g.meta = {};
  const R = STRS(lv, STRAW_X.pale, P1.slate);
  const M = { x0: 2, x1: 30, y0: 40, y1: 62, h: 14 };
  box(g, Object.assign({ mat: m1Stone(P1.stoneW, 6, 4) }, M));
  roof(g, M, { type: 'hip', axis: 'X', rise: 11, hipL: 9, ov: 3, mat: R.mat, cut: R.cut, th: R.th });
  elem(g, 'S', M.y0, 12, 0, 9, 11, m1Door({ w: 9, h: 11, arch: true, col: P3.oak })); g.meta.doorPt = [16, M.y0, 0];
  elem(g, 'S', M.y0, 3, 4, 6, 6, m1Window({ w: 6, h: 6 }));
  g.sprite([32, 34, 0], P => QW.horn(P));
  // выгул: поле и два загона, где ходят лошади (игровые), у ворот — телега
  groundYard(g, 36, 94, 4, 62);
  fence1(g, 38, 92, 60, 60); fence1(g, 92, 92, 34, 60); fence1(g, 38, 38, 34, 60); fence1(g, 38, 60, 34, 34); fence1(g, 72, 92, 34, 34);
  fence1(g, 38, 92, 6, 6); fence1(g, 92, 92, 6, 28);
  g.sprite([86, 50, 0], P => QW.trough(P)); g.sprite([44, 50, 0], P => Q1.hay(P, 7));
  g.meta.pens = [[[42, 38], [88, 56]], [[42, 10], [88, 26]]];
  g.meta.cartSpot = [20, 18, 0];
  paveSand(g, 10, 34, 8, 40);
  if (lv >= 2) { g.sprite([86, 22, 0], P => QW.trough(P)); g.sprite([4, 18, 0], P => Q1.streetLamp(P, 12)); }
  if (lv >= 3) { g.sprite([46, 20, 0], P => Q1.hay(P, 6)); g.sprite([4, 34, 0], P => Q2.sacks(P, 3)); }
}

// =================== ТОРГОВЫЙ ПОСТ ===================
function buildTrade(g, lv) {
  g.meta = {};
  const R = STRS(lv, STRAW_X.rust, P1.slate);
  const M = { x0: 2, x1: 40, y0: 54, y1: 94, h: 20 }, A = { x0: 40, x1: 70, y0: 70, y1: 94, h: 12 };
  box(g, Object.assign({ mat: m1Plaster(P1.plasterC, { frame: true, bay: 12, braceX: true, beam: P3.oak }) }, M));
  roof(g, M, { type: 'gable', axis: 'Y', rise: 20, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plasterC, { frame: true, bay: 10, brace: false, beam: P3.oak }) });
  box(g, Object.assign({ mat: m1Plank(P1.plank, 4) }, A));
  roof(g, A, { type: 'lean', down: 'S', rise: 6, ov: 2, mat: R.mat, cut: R.cut, th: 2 });
  elem(g, 'S', M.y0, 14, 0, 10, 13, m1Door({ w: 10, h: 13, arch: true, col: P3.oak })); g.meta.doorPt = [19, M.y0, 0];
  elem(g, 'S', A.y0, 48, 0, 14, 10, m1Door({ w: 14, h: 10, double: true, col: P1.plank })); g.meta.annexDoor = [55, A.y0, 0];
  elem(g, 'S', M.y0, 4, 6, 7, 7, m1Window({ w: 7, h: 7 })); elem(g, 'S', M.y0, 28, 6, 7, 7, m1Window({ w: 7, h: 7 }));
  // площадка погрузки: дорога въезда, весы, товар; телегу и торговца рисует игра
  paveSand(g, 40, 94, 8, 66);
  g.sprite([46, 62, 0], P => Q2.scale(P)); g.sprite([88, 62, 0], P => Q2.crates(P)); g.sprite([30, 40, 0], P => Q2.sacks(P, 4)); g.sprite([88, 76, 0], P => Q2.barrels(P));
  g.meta.cartSpot = [68, 34, 0]; g.meta.loadFrom = [55, 66, 0];
  if (lv >= 2) { g.sprite([8, 40, 0], P => Q2.crates(P)); g.sprite([46, 16, 0], P => Q1.streetLamp(P, 13)); }
  if (lv >= 3) { g.sprite([24, 24, 0], P => QW.stall(P, P1.scale)); g.sprite([92, 16, 0], P => Q1.streetLamp(P, 13)); }
}

// =================== ЗАГОН ДЛЯ КОЗ ===================
function buildGoat(g, lv) {
  g.meta = {};
  const R = STRS(lv, STRAW_X.moss, P1.tileR);
  const M = { x0: 2, x1: 28, y0: 42, y1: 62, h: 11 };
  box(g, Object.assign({ mat: m1Plank(P1.plank, 4) }, M));
  roof(g, M, { type: 'gable', axis: 'X', rise: 10, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plank, 4) });
  elem(g, 'S', M.y0, 9, 0, 9, 9, m1Door({ w: 9, h: 9, col: P1.plank })); g.meta.doorPt = [13, M.y0, 0];
  groundYard(g, 32, 94, 4, 62);
  fence1(g, 32, 94, 4, 4); fence1(g, 94, 94, 4, 62); fence1(g, 32, 32, 4, 30); fence1(g, 32, 94, 62, 62);
  g.sprite([86, 54, 0], P => Q1.hay(P, 8)); g.sprite([46, 12, 0], P => QW.trough(P));
  g.meta.pen = [[38, 10], [88, 56]];
  if (lv >= 2) { g.sprite([18, 24, 0], P => QW.bucket(P)); g.sprite([62, 52, 0], P => Q1.hay(P, 6)); boulder(g, 70, 34, 6, 6); }
  if (lv >= 3) { g.sprite([10, 20, 0], P => Q1.bench(P, 10)); g.sprite([4, 34, 0], P => Q1.planter(P, 9)); }
}

const BL = (make, title, w, h, top) => ({ w, h, top, vars: [1, 2, 3].map(lv => ({ name: `уровень ${lv}`, make: g => make(g, lv) })), title, bk: 1, ink: P1.ink });

// ======== bvar14.js (лазарет) ========
// Лазарет (выбор владельца — центральный вариант «ЛБ»): фахверк в углу, большой огород лечебных трав,
// сушилки и детальный котёл зельевара на каменном очаге. Травы на грядках растут и срезаются в игре (inside.js),
// лекарь ходит: грядка → сушилка → котёл.

const QI = {
  hearth(P) {   // каменное кольцо очага, угли
    PR.ell(P, 0, -2, 11, 5, (x, y, a, b) => { const e = a * a + b * b; if (e > 0.6) return ((x + y) & 1) ? P1.stone[1] : P1.stone[2]; return e < 0.25 ? P1.red[(x + y) & 1] : P1.dark[3]; });
  },
  cauldron(P) {   // большой котёл на треноге: пузатый, с ободом, ручками и ложкой
    for (const [x0, x1] of [[-12, -7], [12, 7]]) PR.line(P, x0, 0, x1, -22, P3.oak[1], 2);
    PR.line(P, 0, 1, 0, -22, P3.oak[2], 2); PR.rect(P, -2, -23, 2, -22, P3.oak[0]);
    PR.rect(P, 0, -21, 0, -18, P1.iron[2]);
    PR.ell(P, 0, -10, 9, 8, (x, y, a, b) => { const l = a * -0.6 + b * -0.5; return l > 0.45 ? P1.iron[0] : l > -0.1 ? P1.iron[1] : P1.iron[2]; });
    PR.ell(P, 0, -16, 8, 2.6, (x, y, a, b) => (a * a + b * b > 0.6 ? P1.iron[0] : ((x * 3 + y) % 5 === 0 ? P1.ivy[0] : P1.ivy[1])));   // зелье
    PR.rect(P, -10, -13, -9, -11, P1.iron[2]); PR.rect(P, 9, -13, 10, -11, P1.iron[2]);
    PR.line(P, 3, -15, 9, -24, P1.plank[1]); PR.ell(P, 3, -15, 1.6, 1, () => P1.plank[2]);   // ложка
  },
  shelf(P) {   // полка со склянками у котла
    PR.rect(P, -8, -12, -8, 0, P3.oak[2]); PR.rect(P, 8, -12, 8, 0, P3.oak[2]); PR.rect(P, -9, -8, 9, -7, P1.plank[1]); PR.rect(P, -9, -13, 9, -12, P1.plank[1]);
    const C = [P1.red, P3.crystal, P1.ivy, P1.gold, P1.scale];
    for (let k = 0; k < 5; k++) { const x = -7 + k * 3.5 | 0; PR.rect(P, x, -11, x + 1, -9, C[k][1]); P(x, -12, P1.white[1]); }
    for (let k = 0; k < 4; k++) { const x = -6 + k * 4; PR.rect(P, x, -6, x + 2, -3, C[(k + 2) % 5][0]); P(x + 1, -7, P1.white[1]); }
  },
};
function buildInf(g, lv) {
  g.meta = { cots: [], beds: [] };
  const R = STRS(lv, STRAW_X.moss, P1.tileD);
  const M = { x0: 2, x1: 38, y0: 34, y1: 62, h: 16 };
  box(g, Object.assign({ mat: m1Plaster(P1.plaster, { frame: true, bay: 10, braceOdd: true, low: 4 }) }, M));
  roofSag(g, M, { axis: 'X', rise: 16, sag: 2, flare: 3, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plaster, { frame: true, bay: 8, brace: false }) });
  elem(g, 'S', M.y0, 22, 0, 10, 12, m1Door({ w: 10, h: 12, arch: true, col: P1.red })); g.meta.doorPt = [27, M.y0, 0];
  elem(g, 'S', M.y0, 6, 4, 9, 8, m1Window({ w: 9, h: 8, sill: true }));
  chimney1(g, 8, 50, M.h + 8, 10, { stone: true, w: 5, d: 5 });
  g.sprite([40, 33, 0], P => QW.cross(P));
  // огород: грядки без травы — травы рисует игра (растут и срезаются)
  const B = { x0: 46, x1: 94, y0: 26, y1: lv >= 2 ? 60 : 50 };
  box(g, { x0: B.x0, x1: B.x1, y0: B.y0, y1: B.y1, h: 1.2, mat: m1Plank(P1.plank, 3), top: (u, v) => ((v | 0) % 6 < 1 ? P1.plank[1] : (u + v) % 5 < 1 ? bhex('#4e3a28') : bhex('#6a5236')) });
  for (let y = B.y0 + 3; y < B.y1; y += 6) g.meta.beds.push([[B.x0 + 2, y, 1.2], [B.x1 - 2, y, 1.2]]);
  if (!g.dynPiles) for (const [a, b] of g.meta.beds) g.sprite([(a[0] + b[0]) / 2, a[1], 1.2], P => { const w = (b[0] - a[0]) / 2; for (let x = -w; x <= w; x += 3) { PR.rect(P, x, -3, x, 0, P1.grass[1 + (x & 1)]); if (x % 4 === 0) P(x, -4, P3.crystal[1]); } }, -0.2);
  // сушилки и котёл
  g.sprite([56, 18, 0], P => QW.rack(P)); g.meta.rack = [56, 16, 0];
  if (lv >= 2) g.sprite([80, 18, 0], P => QW.rack(P));
  g.sprite([20, 18, 0], P => QI.hearth(P)); g.sprite([20, 18, 0], P => QI.cauldron(P), -0.3); g.meta.cauldron = [20, 18, 0];
  g.sprite([38, 22, 0], P => QI.shelf(P));
  g.sprite([8, 8, 0], P => QW.cot(P)); g.meta.cots.push([8, 8, 0]);
  if (lv >= 2) { g.sprite([34, 8, 0], P => QW.cot(P)); g.meta.cots.push([34, 8, 0]); }
  if (lv >= 3) { g.sprite([94, 10, 0], P => Q1.lantern(P)); g.sprite([4, 50, 0], P => Q3.shroomPatch(P)); g.sprite([66, 8, 0], P => QW.cot(P)); g.meta.cots.push([66, 8, 0]); }
}

// ======== bvar15.js (реквизит блока 2) ========
// Блок 2 (еда), листы по 4 варианта: ферма 4×3, мельница 2×2, пекарня 2×2, хмельник 3×2, пивоварня 3×2,
// свинарник 4×3, бойня 2×2. Дом в углу, двор с делом, крыша по уровню (своя солома).

const STRAW_F = {
  amber: bramp(['#f0c070', '#d09a48', '#a4722c', '#74501a']),
  dusk: bramp(['#c8b48c', '#a08c66', '#786842', '#524628']),
  sun: bramp(['#f8e488', '#dcc25c', '#b49a3a', '#806c22']),
};
const QF = {
  wheat(P, w = 20, h = 6, ripe = 1) { for (let x = -w / 2; x <= w / 2; x++) { const hh = Math.round(h * (0.7 + 0.3 * bhash(x, 0, 1101)) * ripe); PR.rect(P, x, -hh, x, 0, ripe > 0.7 ? P1.straw[1 + (x & 1)] : P1.grass[1 + (x & 1)]); if (ripe > 0.7 && x % 2 === 0) P(x, -hh - 1, P1.straw[0]); } },
  hops(P, h = 22) { PR.rect(P, 0, -h, 0, 0, P3.oak[1]); for (let y = -h + 2; y < -2; y += 3) { P(-1 + (y & 1) * 2, y, P1.ivy[1]); P(y & 1 ? 1 : -1, y + 1, P1.ivy[2]); if (y % 6 === 0) PR.ell(P, 2, y, 1.4, 1.8, () => P1.grass[0]); } },
  sacksFlour(P) { for (const [x, y] of [[-5, 0], [1, 0], [-2, -5]]) PR.ell(P, x, y - 4, 3.5, 4, (xx, yy, a, b) => (b < -0.7 ? P1.white[2] : P1.white[a > 0.4 ? 1 : 0])); },
  oven(P) { PR.ell(P, 0, -6, 9, 7, (x, y, a, b) => (b > 0.6 ? null : P1.brick[a < -0.2 && b < -0.2 ? 0 : 1 + ((x + y) % 4 === 0 ? 1 : 0)])); PR.ell(P, 0, -3, 3.5, 3, (x, y, a, b) => (b > 0.4 ? null : P1.ink)); PR.ell(P, 0, -2, 2, 1.4, () => P1.red[0]); },
  loaves(P) { PR.rect(P, -9, -6, 9, -5, P1.plank[1]); PR.rect(P, -8, -4, -8, 0, P1.plank[3]); PR.rect(P, 8, -4, 8, 0, P1.plank[3]); for (let k = -6; k <= 6; k += 4) PR.ell(P, k, -8, 1.8, 1.3, (x, y, a, b) => (b < 0 ? P1.log[0] : P1.log[1])); },
  vat(P, r = 7) { PR.ell(P, 0, -r, r, r * 0.45, () => P1.gold[2]); for (let y = -r; y <= 0; y++) for (let x = -r; x <= r; x++) { const t = (x + r) / (2 * r); P(x, y, ((y + r) % 4 === 0) ? P1.iron[1] : P1.plank[t < 0.3 ? 0 : t < 0.7 ? 1 : 2]); } PR.ell(P, 0, -r, r - 1, r * 0.4, (x, y, a, b) => (a * a + b * b > 0.6 ? P1.plank[3] : (x + y) % 3 ? P1.gold[1] : P1.white[0])); },
  pig(P, f = 1) { PR.ell(P, 0, -4, 5, 3, (x, y, a, b) => (b < -0.3 ? bhex('#f4bcb0') : a * f > 0.3 ? bhex('#c88478') : bhex('#e4a094'))); for (const x of [-3, -1, 2, 4]) PR.rect(P, x, -2, x, 0, bhex('#c88478')); PR.rect(P, 4 * f, -6, 6 * f, -4, bhex('#e4a094')); P(6 * f, -5, bhex('#a86058')); P(4 * f, -7, bhex('#c88478')); P(-5 * f, -5, bhex('#c88478')); },
  mud(P, w = 22) { PR.ell(P, 0, -2, w / 2, 4, (x, y, a, b) => (bhash(x, y, 1102) < 0.15 ? bhex('#4e3a28') : bhex('#6a5236'))); },
  hooks(P) { PR.rect(P, -10, -18, 10, -17, P3.oak[1]); PR.rect(P, -10, -18, -10, 0, P3.oak[2]); PR.rect(P, 10, -18, 10, 0, P3.oak[2]); for (const x of [-6, 0, 6]) { PR.rect(P, x, -16, x, -14, P1.iron[1]); PR.ell(P, x, -10, 2, 4, (xx, y, a, b) => (b < -0.3 ? bhex('#c86858') : bhex('#9a3a2a'))); } },
  block(P) { PR.rect(P, -5, -6, 5, 0, P1.log[1]); PR.ell(P, 0, -6, 5, 1.6, () => P1.log[0]); PR.line(P, 2, -8, 6, -12, P1.iron[0]); PR.rect(P, -2, -7, 1, -7, bhex('#9a3a2a')); },
  sausages(P) { PR.rect(P, -9, -16, 9, -15, P3.oak[1]); for (let x = -8; x <= 8; x += 3) PR.ell(P, x, -12, 1.2, 3, () => bhex('#a83a2a')); },
};
function field(g, x0, x1, y0, y1, ripe = 1) {
  box(g, { x0, x1, y0, y1, h: 0.3, mat: m1Flat(bhex('#5a4430')), top: (u, v) => ((v | 0) % 5 < 1 ? bhex('#4e3a28') : bhex('#6a5236')) });
  if (!g.dynPiles) for (let y = y0 + 3; y < y1; y += 5) g.sprite([(x0 + x1) / 2, y, 0.3], P => QF.wheat(P, (x1 - x0) * 0.9, 6, ripe), -0.2);
  (g.meta.fields = g.meta.fields || []).push([[x0, y0], [x1, y1]]);
}
const H = (g, M, mat, R, gab, o = {}) => { box(g, Object.assign({ mat }, M)); (o.sag ? roofSag : roof)(g, M, Object.assign({ type: o.type || 'gable', axis: o.axis || 'X', rise: o.rise || 14, ov: 3, ovg: 3, hipL: o.hipL, mat: R.mat, cut: R.cut, th: R.th, gable: gab }, o.sag ? { sag: 2, flare: 3 } : {})); };
const D = (g, M, x, w = 10, h = 12, col = P1.plank) => { elem(g, 'S', M.y0, x, 0, w, h, m1Door({ w, h, arch: true, col })); g.meta.doorPt = [x + w / 2, M.y0, 0]; };
const Wn = (g, M, x, z = 4, w = 8, h = 7, o = {}) => elem(g, 'S', M.y0, x, z, w, h, m1Window(Object.assign({ w, h }, o)));

// =================== ФЕРМА 4×3 ===================
const FARM_VARS = [
  { name: 'Ф1. Изба в углу, большое поле пшеницы, пугало, стог', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.amber, P1.tileR), M = { x0: 2, x1: 34, y0: 62, y1: 94, h: 14 };
    H(g, M, m1Logs(P1.log), R, m1Plank(P1.plank, 4)); D(g, M, 12); Wn(g, M, 24);
    field(g, 40, 124, 8, lv >= 2 ? 88 : 60); g.sprite([82, 40, 0], P => { PR.rect(P, 0, -16, 0, 0, P3.oak[1]); PR.rect(P, -5, -12, 5, -12, P3.oak[1]); PR.rect(P, -2, -12, 2, -6, P1.red[1]); PR.ell(P, 0, -15, 2.5, 2.5, () => P1.straw[1]); PR.rect(P, -3, -18, 3, -17, P1.straw[3]); });
    g.sprite([14, 40, 0], P => Q1.hay(P, 9)); if (lv >= 3) g.sprite([20, 20, 0], P => QW.cart(P)); } },
  { name: 'Ф2. Амбар с ломаной крышей, грядки полосами, ветряной насос', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.sun, P1.tileD), M = { x0: 2, x1: 40, y0: 56, y1: 94, h: 16 };
    box(g, Object.assign({ mat: m1Plank(P1.red, 4) }, M)); roof(g, M, { type: 'gambrel', axis: 'Y', rise: 22, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.red, 4, false) }); D(g, M, 13, 14, 13);
    field(g, 46, 124, 8, 40); field(g, 46, 124, 48, lv >= 2 ? 90 : 70, 0.5);
    g.sprite([30, 30, 0], P => { PR.rect(P, 0, -26, 0, 0, P3.oak[1]); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; PR.line(P, 0, -26, Math.round(Math.cos(a) * 7), -26 + Math.round(Math.sin(a) * 7), P1.iron[1]); } }); if (lv >= 3) g.sprite([16, 18, 0], P => QW.trough(P)); } },
  { name: 'Ф3. Каменный хутор с двором-каре, огород, куры', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.dusk, P1.slate), M = { x0: 2, x1: 44, y0: 70, y1: 94, h: 14 }, S = { x0: 2, x1: 16, y0: 40, y1: 70, h: 10 };
    H(g, M, m1Stone(P1.stoneW, 6, 4), R, m1Stone(P1.stoneW, 6, 4)); H(g, S, m1Plank(P1.plank, 4), R, m1Plank(P1.plank, 4), { axis: 'Y' }); D(g, M, 18);
    field(g, 52, 124, 8, 86); herbBeds(g, 20, 44, 40, 62); g.sprite([30, 24, 0], P => HQ.hens(P)); g.sprite([12, 20, 0], P => HQ.hens(P)); if (lv >= 3) g.sprite([40, 14, 0], P => Q1.hay(P, 7)); } },
  { name: 'Ф4. Волшебная ферма: домик-гриб, поле с огоньками, рунные столбы-межи', make(g, lv) { g.meta = {};
    cyl(g, 18, 78, 12, 0, 14, m1Plaster(P1.plasterW || P1.plaster), 24); dome(g, 18, 78, 18, 13, 14, lv >= 3 ? matShroom(BP.shroom) : m1Straw3(STRAW_F.sun), m1Flat(BARK[3]), 24, 6, 3);
    elem(g, 'S', 66.4, 13, 0, 10, 11, m1RoundDoor({ w: 10, h: 11 })); g.meta.doorPt = [18, 66, 0];
    field(g, 40, 124, 8, 88); for (const [x, y] of [[40, 8], [124, 8], [40, 88], [124, 88]]) g.sprite([x, y, 0], P => Q3.runeStone(P, 10));
    g.sprite([80, 40, 14], P => Q3.wisp(P), -2); g.sprite([10, 30, 0], P => Q3.crystalLamp(P, 12)); if (lv >= 2) g.sprite([100, 60, 14], P => Q3.wisp(P), -2); } },
];

// =================== МЕЛЬНИЦА 2×2 (крылья рисует игра) ===================
const MILL_VARS = [
  { name: 'М1. Каменная башня-мельница под конусом, мешки муки', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.amber, P1.tileR);
    cyl(g, 30, 40, 13, 0, 40, m1Stone(P1.stoneW, 6, 4), 24); cone(g, 30, 40, 16, 39, 16, R.mat, R.cut, 24, 3);
    elem(g, 'S', 27.4, 25, 0, 10, 12, m1Door({ w: 10, h: 12, arch: true })); g.meta.doorPt = [30, 27, 0]; g.meta.hub = [30, 26, 46];
    g.sprite([50, 18, 0], P => QF.sacksFlour(P)); if (lv >= 2) g.sprite([12, 16, 0], P => QW.cart(P)); } },
  { name: 'М2. Деревянная мельница-козлы на столбах (поворачивается к ветру)', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.dusk, P1.tileD);
    post1(g, 29, 39, 0, 14, 4, P3.oak); const B = { x0: 18, x1: 42, y0: 30, y1: 50, z0: 14, h: 22 };
    box(g, Object.assign({ mat: m1Plank(P1.plank, 4) }, B)); roof(g, B, { type: 'gable', axis: 'Y', rise: 10, ov: 2, ovg: 2, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plank, 4) });
    g.sprite([30, 22, 0], P => { for (let k = 0; k < 10; k++) PR.rect(P, -3, -k * 2 - 1, 3, -k * 2 - 1, P1.plank[k % 2]); }); g.meta.doorPt = [30, 22, 0]; g.meta.hub = [30, 29, 30];
    g.sprite([50, 16, 0], P => QF.sacksFlour(P)); } },
  { name: 'М3. Белёная мельница с галереей вокруг и каменным амбаром', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.sun, P1.slate);
    cyl(g, 24, 42, 12, 0, 42, m1Plaster(P1.plasterW || P1.plaster, { low: 6, stoneR: P1.stoneW }), 24); cone(g, 24, 42, 15, 41, 14, R.mat, R.cut, 24, 3);
    beam1(g, 10, 38, 28, 30, 18, 1.2, P1.plank); g.meta.doorPt = [24, 30, 0]; elem(g, 'S', 30.4, 19, 0, 10, 12, m1Door({ w: 10, h: 12, arch: true })); g.meta.hub = [24, 29, 48];
    box(g, { x0: 40, x1: 62, y0: 40, y1: 60, h: 10, mat: m1Stone(P1.stoneW, 6, 4) }); roof(g, { x0: 40, x1: 62, y0: 40, y1: 60, h: 10 }, { type: 'gable', axis: 'X', rise: 8, ov: 2, ovg: 2, mat: R.mat, cut: R.cut, th: R.th }); g.sprite([50, 30, 0], P => QF.sacksFlour(P)); } },
  { name: 'М4. Водяная мельница: сруб у ручья с колесом и жёлобом', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.amber, P1.tileR), M = { x0: 4, x1: 36, y0: 30, y1: 58, h: 16 };
    H(g, M, m1Logs(P1.log), R, m1Plank(P1.plank, 4), { axis: 'Y', rise: 14 }); D(g, M, 13);
    g.sprite([44, 44, 0], P => QS.wheel(P, 13)); g.sprite([44, 22, 0], P => QS.water(P, 22)); g.sprite([18, 14, 0], P => QF.sacksFlour(P)); g.meta.wheel = [44, 44, 0]; } },
];

// =================== ПЕКАРНЯ 2×2 ===================
const BAKE_VARS = [
  { name: 'П1. Фахверковый домик с печью-куполом во дворе и столом с хлебами', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.sun, P1.tileR), M = { x0: 2, x1: 32, y0: 36, y1: 60, h: 14 };
    H(g, M, m1Plaster(P1.plaster, { frame: true, bay: 10, braceOdd: true, low: 4 }), R, m1Plaster(P1.plaster, { frame: true, bay: 8, brace: false })); D(g, M, 10); chimney1(g, 6, 50, M.h + 8, 8, { brick: true, w: 4, d: 4 });
    g.sprite([48, 34, 0], P => QF.oven(P)); g.meta.oven = [48, 31, 0]; g.sprite([30, 16, 0], P => QF.loaves(P)); if (lv >= 2) g.sprite([54, 14, 0], P => QF.sacksFlour(P)); } },
  { name: 'П2. Кирпичная пекарня с большой трубой, прилавок с караваями', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.dusk, P1.slate), M = { x0: 2, x1: 36, y0: 38, y1: 60, h: 15 };
    H(g, M, m1Brick(P1.brick), R, m1Brick(P1.brick), { type: 'hip', hipL: 10 }); D(g, M, 18); Wn(g, M, 4, 4, 9, 7); chimney1(g, 8, 46, M.h + 10, 16, { brick: true, w: 6, d: 6 });
    g.sprite([46, 30, 0], P => QW.stall(P, P1.gold)); g.sprite([18, 16, 0], P => QF.loaves(P)); } },
  { name: 'П3. Домик-каравай: круглый под соломой, печь сбоку, мешки муки', make(g, lv) { g.meta = {};
    cyl(g, 22, 44, 14, 0, 12, m1Plaster(P1.plaster), 24); dome(g, 22, 44, 18, 11, 12, m1Straw3(STRAW_F.amber), m1StrawCut(STRAW_F.amber), 24, 5, 3);
    elem(g, 'S', 30.6, 17, 0, 10, 10, m1RoundDoor({ w: 10, h: 10 })); g.meta.doorPt = [22, 30, 0];
    g.sprite([50, 40, 0], P => QF.oven(P)); g.meta.oven = [50, 37, 0]; g.sprite([48, 16, 0], P => QF.sacksFlour(P)); g.sprite([22, 14, 0], P => QF.loaves(P)); } },
  { name: 'П4. Каменная пекарня в скале с печью внутри (огонь в проёме), полки хлеба', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.sun, P1.tileD), M = { x0: 2, x1: 38, y0: 40, y1: 62, h: 14 };
    boulder(g, 50, 54, 10, 12); H(g, M, m1Stone(P1.stoneW, 6, 4), R, m1Stone(P1.stoneW, 6, 4)); D(g, M, 6);
    elem(g, 'S', M.y0, 22, 2, 10, 8, (u, v) => (v > 6 || u < 1 || u > 8 ? P1.brick[2] : v < 3 ? P1.red[0] : P1.ink)); g.meta.oven = [27, M.y0, 4];
    g.sprite([30, 20, 0], P => QF.loaves(P)); g.sprite([52, 22, 0], P => Q1.logs(P)); } },
];

// =================== ХМЕЛЬНИК 3×2 ===================
const HOP_VARS = [
  { name: 'Х1. Сушильня в углу и шпалеры хмеля рядами', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.dusk, P1.tileR), M = { x0: 2, x1: 28, y0: 40, y1: 62, h: 14 };
    H(g, M, m1Plank(P1.plank, 4), R, m1Plank(P1.plank, 4), { axis: 'Y', rise: 18 }); D(g, M, 8);
    for (let x = 40; x <= 90; x += 10) for (let y = 14; y <= (lv >= 2 ? 54 : 34); y += 20) g.sprite([x, y, 0], P => QF.hops(P)); } },
  { name: 'Х2. Хмелесушилка-башенка с конусом-вытяжкой (oast), шпалеры', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.amber, P1.tileD);
    cyl(g, 16, 46, 11, 0, 20, m1Brick(P1.brick), 20); cone(g, 16, 46, 13, 19, 18, R.mat, R.cut, 20, 2);
    elem(g, 'S', 35.6, 11, 0, 9, 11, m1Door({ w: 9, h: 11, col: P1.plank })); g.meta.doorPt = [16, 35, 0];
    for (let x = 40; x <= 90; x += 10) for (let y = 14; y <= 54; y += 20) g.sprite([x, y, 0], P => QF.hops(P)); } },
  { name: 'Х3. Длинный сарай-сушильня с открытой стороной и корзинами шишек', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.sun, P1.slate);
    for (const [x, y] of [[2, 40], [34, 40], [2, 60], [34, 60]]) post1(g, x, y, 0, 12, 2, P3.oak); roof(g, { x0: 2, x1: 36, y0: 40, y1: 62, h: 12 }, { type: 'gable', axis: 'X', rise: 9, ov: 2, ovg: 2, mat: R.mat, cut: R.cut, th: R.th });
    g.sprite([18, 50, 0], P => QW.rack(P)); g.meta.doorPt = [18, 40, 0]; for (let x = 46; x <= 90; x += 11) for (let y = 14; y <= 44; y += 15) g.sprite([x, y, 0], P => QF.hops(P, 18)); } },
  { name: 'Х4. Зелёный домик в углу, хмель вьётся по беседке-арке, бочка', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_X.moss, P1.tileR), M = { x0: 2, x1: 30, y0: 42, y1: 62, h: 13 };
    H(g, M, m1Plaster(P1.plasterC, { frame: true, bay: 10, beam: P3.oak }), R, m1Plaster(P1.plasterC), { sag: true }); D(g, M, 10);
    for (const x of [40, 60, 80]) { g.sprite([x, 30, 0], P => QF.hops(P, 24)); g.sprite([x + 10, 30, 0], P => QF.hops(P, 24)); } g.sprite([20, 20, 0], P => Q1.barrel(P)); } },
];

// =================== ПИВОВАРНЯ 3×2 ===================
const BREW_VARS = [
  { name: 'Б1. Каменная пивоварня в углу, во дворе чаны с суслом и бочки', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.amber, P1.tileR), M = { x0: 2, x1: 36, y0: 36, y1: 62, h: 16 };
    H(g, M, m1Stone(P1.stoneW, 6, 4), R, m1Stone(P1.stoneW, 6, 4)); D(g, M, 13); chimney1(g, 6, 50, M.h + 8, 12, { brick: true, w: 5, d: 5 });
    g.sprite([52, 30, 0], P => QF.vat(P)); g.sprite([74, 30, 0], P => QF.vat(P)); g.sprite([88, 52, 0], P => Q2.barrels(P)); g.meta.vats = [[52, 30, 0], [74, 30, 0]]; } },
  { name: 'Б2. Фахверк с медным котлом под навесом и пирамидой бочек', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.dusk, P1.tileD), M = { x0: 2, x1: 34, y0: 38, y1: 62, h: 15 };
    H(g, M, m1Plaster(P1.plaster, { frame: true, bay: 10, braceX: true }), R, m1Plaster(P1.plaster), { axis: 'Y', rise: 16 }); D(g, M, 11);
    for (const [x, y] of [[44, 16], [70, 16], [44, 40], [70, 40]]) post1(g, x, y, 0, 12, 2); roof(g, { x0: 44, x1: 72, y0: 16, y1: 42, h: 12 }, { type: 'lean', down: 'S', rise: 4, ov: 2, mat: R.mat, cut: R.cut, th: 2 });
    g.sprite([58, 30, 0], P => QI.cauldron(P)); g.sprite([86, 46, 0], P => Y1.kegs(P)); } },
  { name: 'Б3. Пивоварня-погреб: домик над подвалом, бочки скатывают по пандусу', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.sun, P1.slate), M = { x0: 2, x1: 34, y0: 40, y1: 62, h: 14 };
    H(g, M, m1Logs(P1.logD || P1.log), R, m1Plank(P1.plank, 4)); D(g, M, 12);
    box(g, { x0: 40, x1: 60, y0: 34, y1: 48, h: 4, mat: m1Stone(P1.stone, 5, 3), top: m1Flat(P1.ink) }); g.sprite([66, 30, 0], P => Q2.barrels(P)); g.sprite([84, 18, 0], P => Q2.barrels(P)); } },
  { name: 'Б4. Пивной сад: маленькая пивоварня, хмелевая арка, столы', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_X.rust, P1.tileR), M = { x0: 2, x1: 28, y0: 42, y1: 62, h: 13 };
    H(g, M, m1Brick(P1.brick), R, m1Brick(P1.brick)); D(g, M, 9); g.sprite([40, 40, 0], P => QF.vat(P));
    for (const x of [56, 80]) g.sprite([x, 20, 0], P => Q1.table(P, 14)); g.sprite([68, 44, 0], P => QF.hops(P, 24)); g.sprite([90, 44, 0], P => QF.hops(P, 24)); } },
];

// =================== СВИНАРНИК 4×3 ===================
const SWINE_VARS = [
  { name: 'С1. Сарай в углу, большой загон с лужей, корыто', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.dusk, P1.tileR), M = { x0: 2, x1: 34, y0: 62, y1: 94, h: 13 };
    H(g, M, m1Plank(P1.plank, 4), R, m1Plank(P1.plank, 4)); D(g, M, 12); fence1(g, 40, 124, 8, 8); fence1(g, 124, 124, 8, 88); fence1(g, 40, 40, 8, 88); fence1(g, 40, 124, 88, 88);
    g.sprite([80, 50, 0.2], P => QF.mud(P, 30)); g.sprite([60, 20, 0], P => QW.trough(P, 16)); for (const [x, y, f] of [[70, 40, 1], [92, 60, -1], [100, 30, 1]]) g.sprite([x, y, 0], P => QF.pig(P, f)); g.meta.pen = [[44, 12], [120, 84]]; } },
  { name: 'С2. Каменный хлев с загонами-отсеками и кормушками', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.sun, P1.slate), M = { x0: 2, x1: 50, y0: 66, y1: 94, h: 13 };
    H(g, M, m1Stone(P1.stoneW, 6, 4), R, m1Stone(P1.stoneW, 6, 4)); D(g, M, 20);
    for (const x of [40, 82, 124]) fence1(g, x, x, 8, 60); fence1(g, 40, 124, 8, 8); fence1(g, 40, 124, 60, 60);
    for (const [x, f] of [[60, 1], [100, -1]]) { g.sprite([x, 34, 0], P => QF.pig(P, f)); g.sprite([x, 14, 0], P => QW.trough(P)); } g.meta.pen = [[44, 12], [120, 56]]; } },
  { name: 'С3. Свиной хутор: изба, дубовая роща (жёлуди), грязевая лужа', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.amber, P1.tileD), M = { x0: 2, x1: 36, y0: 64, y1: 94, h: 14 };
    H(g, M, m1Logs(P1.log), R, m1Plank(P1.plank, 4), { sag: true }); D(g, M, 12);
    for (const [x, y] of [[100, 70], [116, 40]]) g.sprite([x, y, 0], P => Q1.tree(P, 14)); g.sprite([70, 40, 0.2], P => QF.mud(P, 26)); fence1(g, 40, 124, 6, 6);
    for (const [x, y, f] of [[60, 30, 1], [82, 50, -1], [96, 20, 1]]) g.sprite([x, y, 0], P => QF.pig(P, f)); g.meta.pen = [[44, 10], [120, 84]]; } },
  { name: 'С4. Свинарник на сваях над лужей, трап, коптильня рядом', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_X.rust, P1.tileR), Hs = { x0: 4, x1: 34, y0: 64, y1: 90, z0: 8, h: 10 };
    for (const [x, y] of [[5, 65], [31, 65], [5, 87], [31, 87]]) post1(g, x, y, 0, 8, 2, P3.oak); box(g, Object.assign({ mat: m1Plank(P1.plank, 3) }, Hs)); roof(g, Hs, { type: 'gable', axis: 'X', rise: 9, ov: 2, ovg: 2, mat: R.mat, cut: R.cut, th: R.th });
    g.sprite([18, 70, 0.2], P => QF.mud(P, 22)); g.sprite([38, 60, 0], P => { for (let k = 0; k < 8; k++) PR.rect(P, -4 + k, -k - 1, 2 + k, -k - 1, P1.plank[k % 2]); }); g.meta.doorPt = [19, 62, 0];
    fence1(g, 44, 124, 6, 6); fence1(g, 124, 124, 6, 70); for (const [x, y, f] of [[70, 30, 1], [96, 44, -1]]) g.sprite([x, y, 0], P => QF.pig(P, f)); g.meta.pen = [[48, 10], [120, 66]]; } },
];

// =================== БОЙНЯ 2×2 ===================
const BUTCH_VARS = [
  { name: 'Мя1. Каменная лавка с навесом, крюки с окороками, колода', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.dusk, P1.tileR), M = { x0: 2, x1: 34, y0: 38, y1: 60, h: 14 };
    H(g, M, m1Stone(P1.stoneW, 6, 4), R, m1Stone(P1.stoneW, 6, 4)); D(g, M, 12); g.sprite([48, 30, 0], P => QF.hooks(P)); g.sprite([30, 18, 0], P => QF.block(P)); } },
  { name: 'Мя2. Коптильня-башенка с дымом и колбасами под навесом', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.amber, P1.tileD);
    box(g, { x0: 4, x1: 22, y0: 40, y1: 58, h: 24, mat: m1Brick(P1.brick) }); roof(g, { x0: 4, x1: 22, y0: 40, y1: 58, h: 24 }, { type: 'pyr', axis: 'X', rise: 10, ov: 2, mat: R.mat, cut: R.cut, th: R.th }); g.meta.doorPt = [13, 40, 0]; elem(g, 'S', 40, 8, 0, 9, 11, m1Door({ w: 9, h: 11, col: P1.dark }));
    g.sprite([13, 49, 36], P => Q1.smoke(P), -2); g.sprite([40, 30, 0], P => QF.sausages(P)); g.sprite([46, 14, 0], P => QF.block(P)); } },
  { name: 'Мя3. Фахверковая мясная лавка с прилавком и вывеской-окороком', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.sun, P1.slate), M = { x0: 2, x1: 32, y0: 36, y1: 60, h: 16 };
    H(g, M, m1Plaster(P1.plaster, { frame: true, bay: 10, braceOdd: true, low: 4 }), R, m1Plaster(P1.plaster), { axis: 'Y', rise: 16 }); D(g, M, 11);
    g.sprite([46, 26, 0], P => QW.stall(P, P1.red)); g.sprite([16, 18, 0], P => QF.block(P)); g.sprite([50, 46, 0], P => QF.hooks(P)); } },
  { name: 'Мя4. Ледник-погреб в холме и разделочный навес', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_X.rust, P1.tileR);
    dome(g, 20, 48, 16, 0, 12, (u, v, F) => P1.grass[bcl(L1(F) + (bhash(u, v, 1103) < 0.3 ? 0 : 1), 2)], m1Flat(bhex('#4e6a2e')), 20, 5, 0.5);
    box(g, { x0: 12, x1: 28, y0: 30, y1: 36, h: 9, mat: m1Stone(P1.stoneW, 5, 3), top: m1Flat(P1.grass[1]) }); elem(g, 'S', 30, 16, 0, 8, 8, m1Door({ w: 8, h: 8, col: P1.plankB })); g.meta.doorPt = [20, 30, 0];
    for (const [x, y] of [[38, 16], [58, 16], [38, 34], [58, 34]]) post1(g, x, y, 0, 11, 2); roof(g, { x0: 38, x1: 60, y0: 16, y1: 36, h: 11 }, { type: 'lean', down: 'S', rise: 4, ov: 2, mat: R.mat, cut: R.cut, th: 2 });
    g.sprite([48, 30, 0], P => QF.hooks(P)); g.sprite([48, 20, 0], P => QF.block(P)); } },
];


// ======== bvar16.js (пекарня, хмельник, свинарник) ========
// Блок 2, вторая итерация по замечаниям владельца:
//  ферма — большое здание, без грядок (поля сажает игрок), пугало; 4 варианта;
//  пекарня — как П1 (солома, голубая окантовка), во всю ширину и в половину глубины, спереди большая печь, пекарь;
//  хмельник — сушильня-башенка + здание на половину участка, без хмеля (его сажают рядом);
//  пивоварня — большое здание с большим медным чаном; 4 варианта;
//  свинарник — здание во всю ширину сзади, спереди загон; 4 варианта;
//  бойня — дом во всю ширину, в половину глубины, на улице стенд с тушами и мясник за колодой; 3 варианта.

const COPPER = bramp(['#ffd2a0', '#e89a5c', '#b8683a', '#7c3e22']);
const BLUE_TRIM = bramp(['#a8c8f0', '#6a98d0', '#4a70a8', '#2e4a78']);
const matCopper = (u, v, F) => { const k = L1(F); let i = k + ((u | 0) % 9 < 1 ? 1 : 0); if (((v | 0) % 7) < 1) i += 1; if (bhash(u, v, 1201) < 0.05) i = 0; return p1(COPPER, i); };
function copperVat(g, cx, cy, r, h) {   // большой медный чан: тело, купол-крышка, труба, обод
  cyl(g, cx, cy, r + 1.5, 0, 3, m1Stone(P1.stone, 4, 3), 20);
  cyl(g, cx, cy, r, 3, 3 + h, matCopper, 24);
  dome(g, cx, cy, r, 3 + h, r * 0.6, matCopper, m1Flat(COPPER[3]), 24, 5, 1.2);
  cyl(g, cx + r * 0.3, cy, 1.4, 3 + h + r * 0.4, 3 + h + r * 0.6 + 10, matCopper, 10);
  box(g, { x0: cx + r * 0.3 - 1, x1: cx + r + 5, y0: cy - 1, y1: cy + 1, z0: 3 + h + r * 0.6 + 8, h: 2, mat: matCopper, top: matCopper });
  g.sprite([cx, cy - r, 3 + h * 0.5], P => { PR.rect(P, -2, -2, 2, 2, P1.iron[1]); P(0, 0, P1.iron[0]); }, -0.6);   // люк
}
const QB = {
  carcassStand(P) {   // перекладина на козлах, туши на крюках
    PR.rect(P, -14, -22, 14, -21, P3.oak[1]); for (const x of [-14, 14]) { PR.line(P, x - 3, 0, x, -22, P3.oak[2]); PR.line(P, x + 3, 0, x, -22, P3.oak[2]); }
    for (const x of [-9, -1, 7]) { PR.rect(P, x, -20, x, -18, P1.iron[1]); PR.ell(P, x, -12, 3, 6, (xx, y, a, b) => (Math.abs(a) < 0.25 ? bhex('#f0d8c8') : b < -0.4 ? bhex('#d47868') : bhex('#a8483a'))); }
  },
  bigOven(P, s = 1) {   // большая печь-купол из кирпича с трубой и устьем
    PR.ell(P, 0, -9 * s, 14 * s, 11 * s, (x, y, a, b) => (b > 0.75 ? null : P1.brick[(a < -0.3 && b < -0.2) ? 0 : (x + y * 2) % 7 === 0 ? 3 : 1 + (a > 0.4 ? 1 : 0)]));
    PR.rect(P, -16 * s, -2, 16 * s, 0, P1.stone[2]);
    PR.ell(P, 0, -5 * s, 5 * s, 5 * s, (x, y, a, b) => (b > 0.5 ? null : a * a + b * b > 0.7 ? P1.stone[1] : P1.ink));
    PR.rect(P, 6 * s, -24 * s, 9 * s, -14 * s, P1.brick[2]); PR.rect(P, 5 * s, -25 * s, 10 * s, -24 * s, P1.stone[1]);
  },
  peel(P) { PR.line(P, 0, 0, 10, -12, P1.plank[1]); PR.ell(P, 11, -13, 3, 1.6, () => P1.plank[0]); },
};

// =================== ФЕРМА: большой дом, без грядок ===================
const FARM2_VARS = [
  { name: 'Ф-1. Большой амбар с ломаной красной крышей, сеновал, пугало у края', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.sun, P1.tileD), M = { x0: 2, x1: 74, y0: 40, y1: 94, h: 20 };
    box(g, Object.assign({ mat: m1Plank(P1.red, 4) }, M)); roof(g, M, { type: 'gambrel', axis: 'Y', rise: 28, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.red, 4, false) });
    elem(g, 'S', M.y0, 26, 0, 22, 18, m1Door({ w: 22, h: 18, double: true, col: P1.plank })); g.meta.doorPt = [37, M.y0, 0]; elem(g, 'S', M.y0, 30, 26, 14, 9, m1Door({ w: 14, h: 9, col: P1.plank }));
    g.sprite([100, 40, 0], P => { PR.rect(P, 0, -16, 0, 0, P3.oak[1]); PR.rect(P, -5, -12, 5, -12, P3.oak[1]); PR.rect(P, -2, -12, 2, -6, P1.red[1]); PR.ell(P, 0, -15, 2.5, 2.5, () => P1.straw[1]); PR.rect(P, -3, -18, 3, -17, P1.straw[3]); });
    g.sprite([96, 70, 0], P => Q1.hay(P, 10)); g.sprite([16, 20, 0], P => QW.cart(P)); if (lv >= 2) g.sprite([112, 76, 0], P => Q1.hay(P, 8)); if (lv >= 3) g.sprite([60, 16, 0], P => QW.trough(P)); } },
  { name: 'Ф-2. Длинный фермерский дом с жилым концом и хлевом под одной крышей', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.amber, P1.tileR), M = { x0: 2, x1: 108, y0: 56, y1: 94, h: 16 };
    box(g, Object.assign({ mat: (u, v, F) => (u < 50 * BK ? m1Plaster(P1.plaster, { frame: true, bay: 12, braceOdd: true, low: 4 })(u, v, F) : m1Plank(P1.plank, 4)(u, v, F)) }, M));
    roofSag(g, M, { axis: 'X', rise: 20, sag: 3, flare: 4, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th + 1, gable: m1Plank(P1.plank, 4) });
    elem(g, 'S', M.y0, 20, 0, 10, 12, m1Door({ w: 10, h: 12, arch: true })); g.meta.doorPt = [25, M.y0, 0]; elem(g, 'S', M.y0, 66, 0, 18, 13, m1Door({ w: 18, h: 13, double: true, col: P1.plank }));
    elem(g, 'S', M.y0, 6, 4, 8, 7, m1Window({ w: 8, h: 7, sill: true })); elem(g, 'S', M.y0, 36, 4, 8, 7, m1Window({ w: 8, h: 7, sill: true }));
    chimney1(g, 10, 76, M.h + 10, 10, { stone: true, w: 5, d: 5 });
    g.sprite([116, 40, 0], P => { PR.rect(P, 0, -16, 0, 0, P3.oak[1]); PR.rect(P, -5, -12, 5, -12, P3.oak[1]); PR.rect(P, -2, -12, 2, -6, P1.scale[1]); PR.ell(P, 0, -15, 2.5, 2.5, () => P1.straw[1]); PR.rect(P, -3, -18, 3, -17, P1.straw[3]); });
    g.sprite([96, 30, 0], P => Q1.hay(P, 9)); g.sprite([40, 30, 0], P => HQ.hens(P)); if (lv >= 2) g.sprite([60, 24, 0], P => QW.cart(P)); if (lv >= 3) g.sprite([12, 30, 0], P => Q1.planter(P, 11)); } },
  { name: 'Ф-3. Каменный хутор: дом и зерновой амбар-башня, пугало', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.dusk, P1.slate), M = { x0: 2, x1: 70, y0: 54, y1: 94, h: 18 };
    box(g, Object.assign({ mat: m1Stone(P1.stoneW, 6, 4) }, M)); roof(g, M, { type: 'gable', axis: 'X', rise: 18, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Stone(P1.stoneW, 6, 4) });
    elem(g, 'S', M.y0, 30, 0, 12, 13, m1Door({ w: 12, h: 13, arch: true })); g.meta.doorPt = [36, M.y0, 0]; for (const x of [8, 52]) elem(g, 'S', M.y0, x, 5, 8, 8, m1Window({ w: 8, h: 8 }));
    cyl(g, 92, 74, 13, 0, 38, m1Plank(P1.plank, 4), 24); cone(g, 92, 74, 16, 37, 14, R.mat, R.cut, 24, 3);
    g.sprite([110, 30, 0], P => { PR.rect(P, 0, -16, 0, 0, P3.oak[1]); PR.rect(P, -5, -12, 5, -12, P3.oak[1]); PR.rect(P, -2, -12, 2, -6, P1.red[1]); PR.ell(P, 0, -15, 2.5, 2.5, () => P1.straw[1]); PR.rect(P, -3, -18, 3, -17, P1.straw[3]); });
    g.sprite([30, 24, 0], P => QF.sacksFlour(P)); if (lv >= 3) g.sprite([60, 20, 0], P => QW.cart(P)); } },
  { name: 'Ф-4. Г-образный фахверковый двор с навесом для инструмента', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_X.moss, P1.tileR), A = { x0: 2, x1: 80, y0: 66, y1: 94, h: 16 }, B = { x0: 2, x1: 30, y0: 30, y1: 66, h: 14 };
    box(g, Object.assign({ mat: m1Plaster(P1.plasterC, { frame: true, bay: 12, braceX: true, beam: P3.oak }) }, A)); box(g, Object.assign({ mat: m1Plank(P1.plank, 4) }, B));
    roof(g, A, { type: 'gable', axis: 'X', rise: 16, ov: 3, ovg: 4, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plasterC) }); roof(g, B, { type: 'gable', axis: 'Y', rise: 14, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plank, 4) });
    elem(g, 'S', A.y0, 46, 0, 10, 12, m1Door({ w: 10, h: 12, arch: true })); g.meta.doorPt = [51, A.y0, 0]; elem(g, 'S', B.y0, 8, 0, 14, 11, m1Door({ w: 14, h: 11, double: true, col: P1.plank }));
    for (const [x, y] of [[90, 60], [120, 60], [90, 80], [120, 80]]) post1(g, x, y, 0, 12, 2); roof(g, { x0: 90, x1: 122, y0: 60, y1: 82, h: 12 }, { type: 'lean', down: 'S', rise: 4, ov: 2, mat: R.mat, cut: R.cut, th: 2 });
    g.sprite([106, 70, 0], P => QW.cart(P)); g.sprite([110, 30, 0], P => { PR.rect(P, 0, -16, 0, 0, P3.oak[1]); PR.rect(P, -5, -12, 5, -12, P3.oak[1]); PR.rect(P, -2, -12, 2, -6, P1.red[1]); PR.ell(P, 0, -15, 2.5, 2.5, () => P1.straw[1]); PR.rect(P, -3, -18, 3, -17, P1.straw[3]); });
    g.sprite([60, 30, 0], P => HQ.hens(P)); if (lv >= 2) g.sprite([16, 16, 0], P => Q1.hay(P, 8)); } },
];

// =================== ПЕКАРНЯ 2×2: во всю ширину, в половину глубины, печь спереди ===================
function buildBakery(g, lv) {
  g.meta = {};
  const R = STRS(lv, STRAW_F.sun, P1.tileR), M = { x0: 0, x1: 64, y0: 32, y1: 62, h: 14 };
  box(g, Object.assign({ mat: m1Plaster(P1.plaster, { frame: true, bay: 10, braceOdd: true, low: 4, beam: BLUE_TRIM }) }, M));
  roof(g, M, { type: 'gable', axis: 'X', rise: 15, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plaster, { frame: true, bay: 8, brace: false, beam: BLUE_TRIM }) });
  elem(g, 'S', M.y0, 6, 0, 10, 12, m1Door({ w: 10, h: 12, arch: true, col: BLUE_TRIM })); g.meta.doorPt = [11, M.y0, 0];
  for (const x of [24, 46]) elem(g, 'S', M.y0, x, 4, 9, 7, m1Window({ w: 9, h: 7, sill: true, frameR: BLUE_TRIM }));
  chimney1(g, 52, 50, M.h + 8, 8, { brick: true, w: 4, d: 4 });
  g.sprite([32, 10, 0], P => QB.bigOven(P, lv >= 3 ? 1.15 : 1)); g.meta.oven = [32, 7, 0];   // печь отодвинута от дома
  g.sprite([54, 10, 0], P => QF.loaves(P)); g.sprite([10, 16, 0], P => Q1.logs(P));
  g.meta.baker = [12, 6, 0];   // пекарь сбоку от печи, не заслоняет устье
  if (lv >= 2) {   // ур. 2: стол для теста — подмастерье месит; мешки муки
    g.sprite([60, 26, 0], P => QF.sacksFlour(P));
    box(g, { x0: 42, x1: 54, y0: 20, y1: 26, h: 5, mat: m1Plank(P1.plank, 3), top: (u, v) => (u > 3 && u < 9 && v > 1 && v < 5 ? bhex('#f0e0c0') : P1.plank[0]) }); g.meta.knead = [48, 16, 0];
  }
  if (lv >= 3) { g.sprite([4, 28, 0], P => Q1.planter(P, 9)); g.sprite([58, 2, 0], P => QB.peel(P)); g.meta.buyer = [[60, 2, 0], [54, 6, 0]]; g.meta.cat = [6, 6, 0]; }   // ур. 3: покупатель за хлебом, кот у печного тепла
}

// =================== ХМЕЛЬНИК 3×2: сушильня-башенка + здание на половину, без хмеля ===================
function buildHop(g, lv) {
  g.meta = {};
  const R = STRS(lv, STRAW_F.amber, P1.tileD), M = { x0: 0, x1: 70, y0: 32, y1: 62, h: 15 };
  box(g, Object.assign({ mat: m1Plank(P1.plank, 4) }, M));
  roof(g, M, { type: 'gable', axis: 'X', rise: 15, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plank, 4) });
  elem(g, 'S', M.y0, 30, 0, 14, 12, m1Door({ w: 14, h: 12, double: true, col: P1.plank })); g.meta.doorPt = [37, M.y0, 0];
  elem(g, 'S', M.y0, 6, 4, 8, 7, m1Window({ w: 8, h: 7 })); elem(g, 'S', M.y0, 54, 4, 8, 7, m1Window({ w: 8, h: 7 }));
  cyl(g, 84, 46, 11, 0, 26, m1Brick(P1.brick), 22); cone(g, 84, 46, 13, 25, 20, R.mat, R.cut, 22, 2);
  g.sprite([84, 46, 46], P => { PR.rect(P, -2, -4, 2, 0, P1.white[1]); PR.line(P, 2, -2, 6, -6, P1.white[1]); }, -0.5);   // флюгер-вытяжка
  elem(g, 'S', 35.4, 80, 0, 8, 10, m1Door({ w: 8, h: 10, col: P1.dark }));
  g.sprite([22, 18, 0], P => QW.rack(P)); g.sprite([64, 18, 0], P => Q2.sacks(P, 3)); g.sprite([84, 18, 0], P => Q1.barrel(P));
  g.meta.vent = [84, 46, 50]; g.meta.racks = [[4, 14, 0]];   // дым сушильни; хмелевод развешивает шишки — сбоку от сушилки, не перед ней
  if (lv >= 2) { g.sprite([46, 14, 0], P => QW.rack(P)); g.meta.racks.push([28, 10, 0]); }
  if (lv >= 3) { g.sprite([70, 10, 0], P => QW.cart(P)); g.meta.cart = [70, 10, 0]; }
}

// =================== ПИВОВАРНЯ 3×2: большое здание, большой медный чан ===================
const BREW2_VARS = [
  { name: 'П-1. Каменная пивоварня во всю ширину, медный чан под открытым небом перед ней', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.amber, P1.tileR), M = { x0: 0, x1: 96, y0: 34, y1: 62, h: 16 };
    box(g, Object.assign({ mat: m1Stone(P1.stoneW, 6, 4) }, M)); roof(g, M, { type: 'gable', axis: 'X', rise: 15, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Stone(P1.stoneW, 6, 4) });
    elem(g, 'S', M.y0, 8, 0, 12, 12, m1Door({ w: 12, h: 12, arch: true })); g.meta.doorPt = [14, M.y0, 0]; for (const x of [30, 74]) elem(g, 'S', M.y0, x, 5, 8, 7, m1Window({ w: 8, h: 7 }));
    copperVat(g, 54, 18, 10, 10); g.meta.vat = [54, 18, 26]; g.sprite([80, 14, 0], P => Q2.barrels(P)); g.sprite([24, 16, 0], P => Q1.logs(P)); if (lv >= 3) g.sprite([92, 26, 0], P => Y1.kegs(P)); } },
  { name: 'П-2. Фахверковый цех с высокой башней-варницей, чан виден сквозь большие ворота', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.dusk, P1.tileD), M = { x0: 0, x1: 70, y0: 30, y1: 62, h: 18 };
    box(g, Object.assign({ mat: m1Plaster(P1.plaster, { frame: true, bay: 12, braceX: true, low: 4 }) }, M)); roof(g, M, { type: 'gable', axis: 'X', rise: 16, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plaster) });
    elem(g, 'S', M.y0, 10, 0, 10, 12, m1Door({ w: 10, h: 12, arch: true })); g.meta.doorPt = [15, M.y0, 0];
    box(g, { x0: 70, x1: 96, y0: 30, y1: 62, h: 30, mat: m1Brick(P1.brick) }); roof(g, { x0: 70, x1: 96, y0: 30, y1: 62, h: 30 }, { type: 'pyr', axis: 'X', rise: 12, ov: 2, mat: R.mat, cut: R.cut, th: R.th });
    copperVat(g, 46, 16, 9, 9); g.meta.vat = [46, 16, 22]; g.sprite([80, 14, 0], P => Y1.kegs(P)); if (lv >= 2) g.sprite([20, 16, 0], P => QF.vat(P)); } },
  { name: 'П-3. Пивной дом с медным чаном на каменном постаменте и трубой-змеевиком', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_X.rust, P1.slate), M = { x0: 0, x1: 96, y0: 36, y1: 62, h: 15 };
    box(g, Object.assign({ mat: m1Logs(P1.log) }, M)); roofSag(g, M, { axis: 'X', rise: 14, sag: 2, flare: 3, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th + 1, gable: m1Plank(P1.plank, 4) });
    elem(g, 'S', M.y0, 70, 0, 14, 12, m1Door({ w: 14, h: 12, double: true, col: P1.plank })); g.meta.doorPt = [77, M.y0, 0];
    box(g, { x0: 22, x1: 46, y0: 10, y1: 30, h: 5, mat: m1Stone(P1.stone, 5, 3), top: m1Flat(P1.stone[1]) }); copperVat(g, 34, 20, 10, 8); g.meta.vat = [34, 20, 28];
    g.sprite([54, 24, 0], P => { for (let k = 0; k < 4; k++) PR.ell(P, 0, -4 - k * 4, 5, 1.6, (x, y, a, b) => (b < 0 ? COPPER[1] : COPPER[2])); }); g.sprite([86, 16, 0], P => Q2.barrels(P)); } },
  { name: 'П-4. Волшебная пивоварня: медный чан с бирюзовым паром, руны, хмелевые гирлянды', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_H.sage, P1.scale), M = { x0: 0, x1: 96, y0: 36, y1: 62, h: 16 };
    box(g, Object.assign({ mat: m1Plaster(P1.plasterC, { frame: true, bay: 12, braceX: true, beam: P3.oak }) }, M)); roof(g, M, { type: 'gable', axis: 'X', rise: 15, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plasterC) });
    elem(g, 'S', M.y0, 42, 0, 12, 12, m1Door({ w: 12, h: 12, arch: true, col: P3.oak })); g.meta.doorPt = [48, M.y0, 0]; for (const x of [10, 76]) elem(g, 'S', M.y0, x, 5, 8, 8, m1Window({ w: 8, h: 8, round: true, G: P3.crystal }));
    copperVat(g, 24, 18, 10, 10); g.meta.vat = [24, 18, 26]; g.sprite([24, 18, 34], P => Q3.wisp(P), -2); g.sprite([70, 16, 0], P => Q3.runeStone(P, 11)); g.sprite([86, 22, 0], P => Q3.crystalLamp(P, 13)); } },
];

// =================== СВИНАРНИК 4×3: здание во всю ширину сзади, загон спереди ===================
function swineBase(g, lv, wall, R, gab, o = {}) {
  const M = { x0: 0, x1: 128, y0: 64, y1: 94, h: 13 };
  box(g, Object.assign({ mat: wall }, M)); (o.sag ? roofSag : roof)(g, M, Object.assign({ type: 'gable', axis: 'X', rise: 14, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: gab }, o.sag ? { sag: 3, flare: 4 } : {}));
  elem(g, 'S', M.y0, 8, 0, 10, 11, m1Door({ w: 10, h: 11, col: P1.plank })); g.meta.doorPt = [13, M.y0, 0];
  for (const x of [34, 64, 94]) elem(g, 'S', M.y0, x, 0, 12, 9, (u, v) => (v > 7 || u < 1 || u > 10 ? P1.beam[2] : P1.dark[3]));   // лазы в хлев
  fence1(g, 0, 128, 4, 4); fence1(g, 0, 0, 4, 62); fence1(g, 128, 128, 4, 62);
  g.meta.pen = [[8, 10], [120, 58]];
}
const SWINE2_VARS = [
  { name: 'С-1. Длинный дощатый хлев, загон с лужей и корытами', make(g, lv) { g.meta = {}; swineBase(g, lv, m1Plank(P1.plank, 4), STRS(lv, STRAW_F.dusk, P1.tileR), m1Plank(P1.plank, 4));
    g.sprite([70, 32, 0.2], P => QF.mud(P, 34)); for (const x of [30, 100]) g.sprite([x, 14, 0], P => QW.trough(P, 14)); } },
  { name: 'С-2. Каменный хлев под провисшей соломой, грязь, дубок с желудями', make(g, lv) { g.meta = {}; swineBase(g, lv, m1Stone(P1.stoneW, 6, 4), STRS(lv, STRAW_F.amber, P1.slate), m1Stone(P1.stoneW, 6, 4), { sag: true });
    g.sprite([50, 30, 0.2], P => QF.mud(P, 30)); g.sprite([108, 36, 0], P => Q1.tree(P, 12)); g.sprite([30, 12, 0], P => QW.trough(P, 14)); } },
  { name: 'С-3. Бревенчатый хлев с навесом-кормушкой вдоль фасада', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_X.rust, P1.tileD); swineBase(g, lv, m1Logs(P1.log), R, m1Plank(P1.plank, 4));
    for (const x of [24, 64, 104]) post1(g, x, 52, 0, 10, 2); roof(g, { x0: 20, x1: 108, y0: 52, y1: 64, h: 10 }, { type: 'lean', down: 'S', rise: 3, ov: 2, mat: R.mat, cut: R.cut, th: 2 });
    for (const x of [40, 80]) g.sprite([x, 56, 0], P => QW.trough(P, 18)); g.sprite([66, 24, 0.2], P => QF.mud(P, 28)); } },
  { name: 'С-4. Фахверковый свинарник с поросячьим домиком-будкой в загоне', make(g, lv) { g.meta = {}; swineBase(g, lv, m1Plaster(P1.plaster, { frame: true, bay: 12, braceOdd: true, low: 4 }), STRS(lv, STRAW_F.sun, P1.tileR), m1Plaster(P1.plaster));
    box(g, { x0: 92, x1: 112, y0: 20, y1: 36, h: 7, mat: m1Plank(P1.plank, 3) }); roof(g, { x0: 92, x1: 112, y0: 20, y1: 36, h: 7 }, { type: 'gable', axis: 'X', rise: 5, ov: 2, mat: m1Straw3(STRAW_F.sun), cut: m1StrawCut(STRAW_F.sun), th: 2 });
    g.sprite([46, 28, 0.2], P => QF.mud(P, 28)); g.sprite([24, 12, 0], P => QW.trough(P, 14));
    g.meta.trough = [24, 12, 0]; g.meta.mud = [46, 28, 0];
    if (lv >= 2) { g.sprite([70, 12, 0], P => QW.trough(P, 14)); g.meta.feed = [[13, 62, 0], [24, 16, 0], [70, 16, 0]]; }   // ур. 2: второе корыто, свинопас носит ведро
    if (lv >= 3) { g.sprite([116, 48, 0], P => Q1.tree(P, 10)); g.sprite([102, 36, 7], P => Q1.lantern(P), -0.5); g.meta.lamp = [102, 36, 6]; } } },   // ур. 3: дубок с желудями, фонарь у будки
];

// =================== БОЙНЯ 2×2: дом во всю ширину, в половину глубины; стенд с тушами ===================
const BUTCH2_VARS = [
  { name: 'М-1. Каменная бойня, стенд с тушами и колода мясника перед входом', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.dusk, P1.tileR), M = { x0: 0, x1: 64, y0: 32, y1: 62, h: 14 };
    box(g, Object.assign({ mat: m1Stone(P1.stoneW, 6, 4) }, M)); roof(g, M, { type: 'gable', axis: 'X', rise: 14, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Stone(P1.stoneW, 6, 4) });
    elem(g, 'S', M.y0, 6, 0, 10, 12, m1Door({ w: 10, h: 12, arch: true, col: P1.red })); g.meta.doorPt = [11, M.y0, 0]; elem(g, 'S', M.y0, 46, 4, 9, 7, m1Window({ w: 9, h: 7 }));
    g.sprite([42, 18, 0], P => QB.carcassStand(P)); g.sprite([20, 12, 0], P => QF.block(P)); g.meta.butcher = [26, 12, 0]; if (lv >= 2) g.sprite([56, 6, 0], P => QF.sausages(P)); } },
  { name: 'М-2. Фахверковая мясная лавка с коптильной трубой, туши под навесом', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_F.amber, P1.tileD), M = { x0: 0, x1: 64, y0: 34, y1: 62, h: 15 };
    box(g, Object.assign({ mat: m1Plaster(P1.plaster, { frame: true, bay: 10, braceOdd: true, low: 4 }) }, M)); roofSag(g, M, { axis: 'X', rise: 14, sag: 2, flare: 3, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plaster(P1.plaster) });
    elem(g, 'S', M.y0, 27, 0, 10, 12, m1Door({ w: 10, h: 12, arch: true })); g.meta.doorPt = [32, M.y0, 0]; chimney1(g, 6, 48, M.h + 8, 14, { brick: true, w: 6, d: 6 });
    for (const [x, y] of [[40, 14], [62, 14], [40, 30], [62, 30]]) post1(g, x, y, 0, 12, 2); roof(g, { x0: 40, x1: 64, y0: 14, y1: 32, h: 12 }, { type: 'lean', down: 'S', rise: 4, ov: 2, mat: R.mat, cut: R.cut, th: 2 });
    g.sprite([52, 24, 0], P => QB.carcassStand(P)); g.sprite([18, 14, 0], P => QF.block(P)); g.meta.butcher = [24, 14, 0]; } },
  { name: 'М-3. Бревенчатая бойня с ледником-погребом и прилавком на улице', make(g, lv) { g.meta = {}; const R = STRS(lv, STRAW_X.rust, P1.slate), M = { x0: 0, x1: 64, y0: 34, y1: 62, h: 14 };
    box(g, Object.assign({ mat: m1Logs(P1.log) }, M)); roof(g, M, { type: 'gable', axis: 'X', rise: 14, ov: 3, ovg: 3, mat: R.mat, cut: R.cut, th: R.th, gable: m1Plank(P1.plank, 4) });
    elem(g, 'S', M.y0, 6, 0, 10, 12, m1Door({ w: 10, h: 12, col: P1.dark })); g.meta.doorPt = [11, M.y0, 0]; elem(g, 'S', M.y0, 46, 0, 10, 8, m1Door({ w: 10, h: 8, col: P1.plankB }));
    g.sprite([44, 16, 0], P => QB.carcassStand(P)); g.sprite([20, 22, 0], P => QW.stall(P, P1.red)); g.sprite([20, 8, 0], P => QF.block(P)); g.meta.butcher = [26, 10, 0]; } },
];


// ======== bvar17.js (ферма, пивоварня, бойня) ========
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

QB.axeLog = P => {   // полено-чурбак с воткнутым топором
  PR.rect(P, -5, -5, 5, 0, P1.log[1]); PR.ell(P, 0, -5, 5, 2, (x, y, a, b) => (a * a + b * b < 0.3 ? P1.log[0] : P1.log[2]));
  PR.line(P, 1, -6, 6, -15, P1.plank[1]); PR.rect(P, -2, -8, 2, -6, P1.iron[1]); P(-2, -8, P1.iron[0]);
};
PILE_DRAW.hay = f => P => Q1.hay(P, 4 + Math.round(f * 5));                                // стог растёт с запасом сена
PILE_DRAW.beer = f => P => (f < 0.5 ? Q1.barrel(P, 5, 6) : Q1.barrel(P, 7, 9));            // бочонок → бочка

// проба растра ×3 на листе (в игре растр задаёт PX_FINE в px-runtime.js)

// ======== px-runtime.js ========
// Игровая часть пиксельных зданий (трактир, склад, дома): из модели собирает объект спрайта в формате buildingSprite
// (canvas/shadow/w/h/top/padx/…) и переводит точки модели (веранда, печь, окна, кучи груза…) в пиксели спрайта.
// Вклеивается в js/bldpx.js сборщиком build-runtime.js, внутри общей обёртки-IIFE.

// виды домов в игре: houseVar (0..7) → один из восьми пиксельных домов (нору заменили дом на сваях и дом в дубе)
const PX_HOUSES = [
  ...HOUSE_VARS.slice(0, 6).map((v, i) => (g, lv) => v.make(g, lv, i)),
  (g, lv) => HOUSE_ALT[0].make(g, lv, 4),   // дом на сваях: на 3-м уровне синяя черепица (как у варианта 4 в списке крыш)
  (g, lv) => HOUSE_ALT[2].make(g, lv, 6),   // дом в старом дубе
];
const PX_HOUSE_KINDS = PX_HOUSES.map((f, i) => i);
const PX_HOUSE_NAMES = ['Белёный коттедж', 'Высокий фахверк', 'Изба с крыльцом', 'Каменный домик', 'Круглый домик', 'Г-образный дом', 'Дом на сваях', 'Дом в старом дубе'];

const PX_FINE = 3;
const PX_FOOD = new Set(['farm', 'bakery', 'hopfarm', 'brewery', 'swine', 'butchery']);
function pxModel(type, g, d, lv, vr) {
  if (type === 'inn') { g.rot = 0; (d.rot ? buildInnProfile : buildInn)(g, lv, ROOF_LV[lv](STRAW1.olive)); return; }
  g.rot = d.rot ? 1 : 0;
  if (type === 'storehouse') { g.dynPiles = true; buildStore(g, lv, ROOF_ST[lv]()); return; }
  if (type === 'school') { buildSchool(g, lv); return; }
  if (type === 'sawmill') { buildSaw(g, lv); return; }
  if (type === 'woodcutter') { WOOD2_VARS[2].make(g, lv); return; }   // пень под соломенной шапкой с дровяным сараем
  if (type === 'quarry') { QUARRY2_VARS[0].make(g, lv); return; }     // скальный выход с забоем и сторожкой
  if (type === 'well') { g.rot = 0; buildWell(g, lv); return; }
  if (type === 'stable') { buildStable(g, lv); return; }
  if (type === 'tradepost') { buildTrade(g, lv); return; }
  if (type === 'goatpen') { buildGoat(g, lv); return; }
  if (type === 'infirmary') { g.dynPiles = true; buildInf(g, lv); return; }
  if (type === 'farm') { g.dynPiles = true; buildFarm(g, lv); return; }
  if (type === 'bakery') { buildBakery(g, lv); return; }
  if (type === 'hopfarm') { buildHop(g, lv); return; }
  if (type === 'brewery') { g.dynPiles = true; buildBrew(g, lv); return; }
  if (type === 'swine') { buildSwine(g, lv); return; }
  if (type === 'butchery') { buildButch(g, lv); return; }
  PX_HOUSES[vr](g, lv);
}

function pxBuild(type, rot, lv, vr) {
  const def = BUILDINGS[type], d = bDims(type, rot);
  const FW = d.w * TILE, FD = d.h * TILE, top = def.top + 34;
  const W = Math.ceil(FW + BPADX * 2 + FD * BSK), H = FD + top + BBOTTOM;
  BK = 1; FINE = PX_FINE;   // растр ×3 — как у гномов; узоры материалов в мировых пикселях
  const g = new BGrid(W * FINE, H * FINE, BPADX * FINE, (top + FD) * FINE);
  g.LD = type === 'inn' ? FD : def.h * TILE; g.noSmoke = true;
  pxModel(type, g, d, lv, vr);
  g.finish({ step: 1.6, ink: P1.ink });
  const M = g.meta || {};
  const scr = p => { const q = g.W3(p); return [g.sx(q[0], q[1]) / PX_FINE, g.sy(q[1], p[2] || 0) / PX_FINE]; };
  // окна → [cx, cy, w, h, round] (как WIN_REC у старых зданий); у повёрнутой модели сторона меняется
  const sideW = s => (g.rot ? { S: 'E', W: 'S', E: 'N', N: 'W' }[s] : s);
  const wins = [];
  for (const w of M.wins || []) {
    const ws = sideW(w.side);
    if (ws !== 'S' && ws !== 'E') continue;
    const c = w.side === 'S' || w.side === 'N' ? [w.a + w.w / 2, w.at, w.z + w.h / 2] : [w.at, w.a + w.w / 2, w.z + w.h / 2];
    const [x, y] = scr(c);
    wins.push([x, y, ws === 'S' ? w.w : Math.max(3, w.w * 0.5), w.h, w.round]);
  }
  const shadow = mkCanvas(W, H), sc = shadow.getContext('2d');
  sc.filter = 'blur(2px)'; sc.fillStyle = 'rgba(30,22,12,0.3)';
  const LW = g.rot ? def.w * TILE : FW, LD = g.rot ? def.h * TILE : FD;
  const corners = [[0, 0, 0], [LW, 0, 0], [LW, LD, 0], [0, LD, 0]].map(scr);
  sc.beginPath(); corners.forEach((p, i) => (i ? sc.lineTo(p[0] + 3, p[1] - 2) : sc.moveTo(p[0] + 3, p[1] - 2))); sc.closePath(); sc.fill();
  const opt = p => p && scr(p), arr = a => (a || []).map(scr);
  const spr = {
    canvas: pxUp(g.toCanvas(), 3 / PX_FINE), shadow, w: W, h: H, top, padx: BPADX, fw: FW, baseY: top + FD - 2, doorCx: BPADX + (d.dx + 0.5) * TILE,
    px: type, pxLv: lv, k1: true,
    chimneys: (g.chim || []).map(scr), wins, doorPt: opt(M.doorPt),
    perches: [scr([LW / 2, LD * 0.7, 40])],
  };
  if (type === 'inn') Object.assign(spr, {
    pxInn: lv, noDeck: true,
    porch: opt(M.porch), oven: opt(M.oven), bar: opt(M.bar),
    perches: d.rot ? [scr([35, 92, 57]), scr([12, 95, 58])] : [scr([33, 69, 63]), scr([114, 78, 44])],
    fire: opt(M.fire), spit: opt(M.spit), chop: opt(M.chop), darts: opt(M.darts), stage: opt(M.stage),
    seats: arr(M.seats), tables: arr(M.tables), pantry: arr(M.pantry), stock: arr(M.stock),
  });
  if (type === 'school') { spr.play = {}; for (const k in M.play || {}) spr.play[k] = Array.isArray(M.play[k][0]) ? M.play[k].map(scr) : scr(M.play[k]); }
  if (type === 'sawmill') Object.assign(spr, { saw: opt(M.saw), sawR: M.sawR, sawSide: !!g.rot, logIn: opt(M.logIn), halves: opt(M.halves), dust: opt(M.dust), workers: arr(M.workers) });
  if (type === 'woodcutter' || type === 'quarry') { spr.work = opt(M.work); spr.block = opt(M.block); }
  const rect = r => r && [scr([r[0][0], r[0][1], 0]), scr([r[1][0], r[1][1], 0])];
  if (type === 'goatpen') spr.penRect = rect(M.pen);
  if (type === 'stable') { spr.penRects = (M.pens || []).map(rect); spr.cartSpot = opt(M.cartSpot); }
  if (type === 'tradepost') { spr.cartSpot = opt(M.cartSpot); spr.loadFrom = opt(M.loadFrom); }
  if (type === 'well') spr.bucket = opt(M.bucket);
  if (type === 'infirmary') { spr.beds = (M.beds || []).map(([a, b]) => [scr(a), scr(b)]); spr.rack = opt(M.rack); spr.cauldron = opt(M.cauldron); spr.cots = arr(M.cots); }
  if (type === 'farm' || type === 'brewery') { spr.piles = {}; for (const k in M.piles || {}) spr.piles[k] = M.piles[k].map(scr); }
  if (PX_FOOD.has(type)) {   // точки анимаций двора (inside.js): одиночные [x,y,z] и списки точек → экранные координаты
    spr.pt = {};
    for (const k in M) { const v = M[k]; if (k === 'piles' || k === 'pen' || k === 'wins' || !Array.isArray(v) || !v.length) continue; spr.pt[k] = Array.isArray(v[0]) ? v.map(scr) : typeof v[0] === 'number' ? scr(v) : null; }
  }
  if (type === 'swine' && M.pen) {   // загон для игровых свиней (render.js drawPigs): углы в экранных координатах
    const [[x0, y0], [x1, y1]] = M.pen, q = [scr([x0, y0, 0]), scr([x1, y0, 0]), scr([x0, y1, 0])], cs = [...q, scr([x1, y1, 0])];
    spr.penQuad = q; spr.pen = [Math.min(...cs.map(p => p[0])), Math.min(...cs.map(p => p[1])), Math.max(...cs.map(p => p[0])), Math.max(...cs.map(p => p[1]))];
  }
  if (type === 'storehouse') {
    spr.piles = {}; for (const k in M.piles || {}) spr.piles[k] = M.piles[k].map(scr);
    spr.runes = arr(M.glow); spr.drop = arr(M.drop); spr.circle = opt(M.circle);
  }
  FINE = 1;
  return spr;
}

// ×3 ближайшим соседом: игра рисует здания со сглаживанием, а у холста ×3 пиксели остаются чёткими (как у прежних спрайтов)
function pxUp(src, k) { const cv = mkCanvas(src.width * k, src.height * k), c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(src, 0, 0, cv.width, cv.height); return cv; }

// зеркало для входа с запада (rot 2): старые поля отражает mirrorSprite, новые — здесь
function pxMirror(s) {
  const m = mirrorSprite(s, s.fw), W = s.w, pt = p => p && [W - p[0], p[1], ...p.slice(2)];
  for (const k of ['fire', 'spit', 'chop', 'darts', 'stage', 'circle', 'saw', 'logIn', 'halves', 'dust', 'work', 'block', 'cartSpot', 'loadFrom', 'bucket', 'rack', 'cauldron']) m[k] = pt(s[k]);
  for (const k of ['seats', 'tables', 'pantry', 'stock', 'runes', 'drop', 'workers']) m[k] = (s[k] || []).map(pt);
  const rr = r => r && [pt(r[0]), pt(r[1])];
  if (s.penRect) m.penRect = rr(s.penRect);
  if (s.beds) m.beds = s.beds.map(rr);
  if (s.cots) m.cots = s.cots.map(pt);
  if (s.penRects) m.penRects = s.penRects.map(rr);
  if (s.play) { m.play = {}; for (const k in s.play) m.play[k] = Array.isArray(s.play[k][0]) ? s.play[k].map(pt) : pt(s.play[k]); }
  if (s.piles) { m.piles = {}; for (const k in s.piles) m.piles[k] = s.piles[k].map(pt); }
  return m;
}

function pxSprite(type, rot, lv, vr = 0) {
  const d = bDims(type, rot), v = type === 'house' ? PX_HOUSE_KINDS[(vr >>> 0) % PX_HOUSE_KINDS.length] : 0;
  const key = type + ':px:' + d.rot + ':' + lv + ':' + v;
  if (SPR.buildings[key]) return SPR.buildings[key];
  const spr = d.rot === 2 ? pxMirror(pxSprite(type, 1, lv, vr)) : pxBuild(type, d.rot, lv, v);
  SPR.buildings[key] = spr;
  return spr;
}
const innPxSprite = (rot, lv) => pxSprite('inn', rot, lv);

// Картинка кучи груза для склада (в пикселях мира): kind — trunk/timber/stone/food/goods, f — заполнение 0..1 (4 ступени)
const PILE_CACHE = new Map();
function pxPile(kind, f) {
  const st = Math.max(1, Math.min(4, Math.ceil(f * 4))), key = kind + st;
  if (PILE_CACHE.has(key)) return PILE_CACHE.get(key);
  const S = 48, buf = new Map();
  PILE_DRAW[kind](st / 4)((x, y, c) => { if (c) buf.set(x + ',' + y, c); });
  const tmp = mkCanvas(S, S), tc = tmp.getContext('2d'), im = tc.createImageData(S, S), d = im.data;
  for (const [k, col] of buf) { const [x, y] = k.split(',').map(Number), X = x + S / 2, Y = y + S - 4; if (X < 0 || Y < 0 || X >= S || Y >= S) continue; const j = (Y * S + X) * 4; d[j] = col[0]; d[j + 1] = col[1]; d[j + 2] = col[2]; d[j + 3] = 255; }
  const out = [];   // обводка снаружи, как у зданий
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const j = (y * S + x) * 4; if (d[j + 3]) continue; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const X = x + a, Y = y + b; return X >= 0 && Y >= 0 && X < S && Y < S && d[(Y * S + X) * 4 + 3]; })) out.push(j); }
  for (const j of out) { d[j] = P1.ink[0]; d[j + 1] = P1.ink[1]; d[j + 2] = P1.ink[2]; d[j + 3] = 255; }
  tc.putImageData(im, 0, 0);
  const r = { cv: pxUp(tmp, 3), w: S, h: S, ax: S / 2, ay: S - 4 };
  PILE_CACHE.set(key, r);
  return r;
}

return { innPxSprite, pxSprite, pxPile, PX_HOUSE_NAMES };
})();
