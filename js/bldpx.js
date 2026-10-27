'use strict';
// СОБРАНО АВТОМАТИЧЕСКИ из tools/buildart (node tools/buildart/build-runtime.js) — правьте исходники там.
// Пиксельный трактир ×1 (1 px арта = 1 мировой px): растеризатор граней, материалы, модель по уровням, адаптер к buildingSprite.
const innPxSprite = (() => {
// ======== bpx.js ========
// Пиксельный растеризатор зданий OldGold, шаг пикселя ×3 (как у нечисти: 1 мировой px = 3 px сетки).
// Здание — набор граней в 3D (мир: X на восток, Y на север, Z вверх; та же косая проекция, что в bmodels.js).
// Каждая грань растеризуется по экранным пикселям с z-буфером; цвет пикселя считает материал по
// координатам (u, v) на грани — так получаются чистые жёсткие пиксели, как при ручной работе.
// В конце — обводка по маске твёрдых пикселей и тёмные линии на стыках граней (дальняя грань темнеет у ближней).

let BK = 3; const BSK = 0.5, BDK = 0.78;
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
  sx(X, Y) { return this.ox + (X + Y * BSK) * BK; }
  sy(Y, Z) { return this.oy - (Y * BDK + Z) * BK; }
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
    const Mu = [(Uw[0] + Uw[1] * BSK) * BK, -(Uw[1] * BDK + Uw[2]) * BK];
    const Mv = [(Vw[0] + Vw[1] * BSK) * BK, -(Vw[1] * BDK + Vw[2]) * BK];
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
        const c = mat(a * BK, b * BK, F);
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
    draw((x, y, c) => c && this.put(bx + x, by + y, c, z, fid), bx, by);
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
const p1 = (R, i, n = 3) => R[i < 0 ? 0 : i > n ? n : i];
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
      if (inB) return p1(B, 1 + k);
    }
    let i = k;
    if (bhash(u, v, 212) < 0.04) i += 1;
    if (F.h && v > F.h - 3) i += 1;
    return p1(R, i);
  };
}
function m1Logs(R) { return (u, v, F) => { const vv = ((v % 4) + 4) % 4, k = L1(F); let i = vv === 0 ? 3 : vv === 1 ? 2 : vv === 2 ? 1 : 0; if (vv === 3 && bhash(Math.floor(u / 5), Math.floor(v / 4), 213) < 0.2) i = 1; if (F.h && v > F.h - 3) i += 1; return p1(R, i + (vv === 0 ? 0 : k)); }; }
function m1Plank(R, pw = 4, ver = true) { return (u, v, F) => { const a = ver ? u : v, aa = ((a % pw) + pw) % pw, k = L1(F); if (aa === 0) return p1(R, 3); const h = bhash(Math.floor(a / pw), 0, 214); let i = h < 0.3 ? 0 : h < 0.85 ? 1 : 2; if (F.h && v > F.h - 3) i += 1; return p1(R, i + k); }; }
function m1Brick(R) { return (u, v, F) => { const row = Math.floor(v / 3), st = row % 2 ? 3 : 0, uu = (((u + st) % 6) + 6) % 6, vv = ((v % 3) + 3) % 3, k = L1(F); if (uu === 0 || vv === 0) return p1(R, 3); const h = bhash(Math.floor((u + st) / 6), row, 215); return p1(R, (h < 0.25 ? 0 : h < 0.8 ? 1 : 2) + k); }; }
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
    const k = L1(F), L = F.L, t = v / L, c = Math.floor(u / 2), h = bhash(c, 0, 271);
    if (v > L) { const len = 1 + (bhash(c, 1, 272) * 2 | 0); if (v > L + len) return null; return p1(R, 3); }
    // базовый тон по положению на скате, с дизерингом между зонами
    let i = t + (bdith(u, v) - 0.5) * 0.35 < 0.22 ? 0 : t + (bdith(u, v) - 0.5) * 0.35 < 0.62 ? 1 : 2;
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

// ======== inn-runtime.js ========
// Игровая часть пиксельного трактира: из модели buildInn собирает объект спрайта в формате buildingSprite
// (canvas/shadow/w/h/top/padx/…) и переводит точки модели (веранда, печь, бар, окна, двор) в пиксели спрайта.
// Этот кусок вклеивается в js/bldpx.js сборщиком build-runtime.js, внутри общей обёртки-IIFE.

function innPxBuild(rot, lv) {
  const def = BUILDINGS.inn, d = bDims('inn', rot);
  const FW = d.w * TILE, FD = d.h * TILE, top = def.top + 34;
  const W = Math.ceil(FW + BPADX * 2 + FD * BSK), H = FD + top + BBOTTOM;
  BK = 1;
  const g = new BGrid(W, H, BPADX, top + FD);
  g.rot = 0; g.LD = FD; g.noSmoke = true;   // вход на восток — своя ровная компоновка 3×4, а не поворот модели
  (d.rot ? buildInnTall : buildInn)(g, lv, ROOF_LV[lv](STRAW1.olive));
  g.finish({ step: 1.6, ink: P1.ink });
  const M = g.meta;
  const scr = p => { const q = g.W3(p); return [g.sx(q[0], q[1]), g.sy(q[1], p[2] || 0)]; };
  // окна → [cx, cy, w, h, round] в пикселях спрайта (как WIN_REC у старых зданий)
  const sideW = s => s;
  const wins = [];
  for (const w of M.wins) {
    const ws = sideW(w.side);
    if (ws !== 'S' && ws !== 'E') continue;
    const c = w.side === 'S' || w.side === 'N' ? [w.a + w.w / 2, w.at, w.z + w.h / 2] : [w.at, w.a + w.w / 2, w.z + w.h / 2];
    const [x, y] = scr(c);
    wins.push([x, y, ws === 'S' ? w.w : Math.max(3, w.w * 0.5), w.h, w.round]);
  }
  const shadow = mkCanvas(W, H), sc = shadow.getContext('2d');
  sc.filter = 'blur(2px)'; sc.fillStyle = 'rgba(30,22,12,0.32)';
  const corners = [[0, 0, 0], [FW, 0, 0], [FW, FD, 0], [0, FD, 0]].map(scr);
  sc.beginPath(); corners.forEach((p, i) => (i ? sc.lineTo(p[0] + 3, p[1] - 2) : sc.moveTo(p[0] + 3, p[1] - 2))); sc.closePath(); sc.fill();
  const spr = {
    canvas: innPxUp(g.toCanvas(), 3), shadow, w: W, h: H, top, padx: BPADX, fw: FW, baseY: top + FD - 2, doorCx: BPADX + (d.dx + 0.5) * TILE,
    pxInn: lv, noDeck: true, k1: true,
    chimneys: (g.chim || []).map(scr), wins,
    porch: scr(M.porch), oven: scr(M.oven), bar: scr(M.bar), doorPt: scr(M.doorPt),
    perches: d.rot ? [scr([30, 99, 63]), scr([78, 113, 42])] : [scr([33, 69, 63]), scr([114, 78, 44])],
    fire: M.fire && scr(M.fire), spit: M.spit && scr(M.spit), chop: M.chop && scr(M.chop), darts: M.darts && scr(M.darts), stage: M.stage && scr(M.stage),
    seats: (M.seats || []).map(scr), tables: (M.tables || []).map(scr), pantry: (M.pantry || []).map(scr), stock: (M.stock || []).map(scr),
    feast: (M.feast || []).map(p => [...scr(p), p[3]]),
  };
  return spr;
}

// ×3 ближайшим соседом: игра рисует здания со сглаживанием, а у холста ×3 пиксели остаются чёткими (как у прежних спрайтов)
function innPxUp(src, k) { const cv = mkCanvas(src.width * k, src.height * k), c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(src, 0, 0, cv.width, cv.height); return cv; }

// зеркало для входа с запада (rot 2): старые поля отражает mirrorSprite, новые — здесь
function innPxMirror(s) {
  const m = mirrorSprite(s, s.fw), W = s.w, pt = p => p && [W - p[0], p[1], ...p.slice(2)];
  for (const k of ['fire', 'spit', 'chop', 'darts', 'stage']) m[k] = pt(s[k]);
  for (const k of ['seats', 'tables', 'pantry', 'stock', 'feast']) m[k] = (s[k] || []).map(pt);
  return m;
}

function innPxSprite(rot, lv) {
  const d = bDims('inn', rot), key = 'inn:px:' + d.rot + ':' + lv;
  if (SPR.buildings[key]) return SPR.buildings[key];
  const spr = d.rot === 2 ? innPxMirror(innPxSprite(1, lv)) : innPxBuild(d.rot, lv);
  SPR.buildings[key] = spr;
  return spr;
}

return innPxSprite;
})();
