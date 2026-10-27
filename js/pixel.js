'use strict';
// Пиксель-арт конвейер: ограниченная палитра, уменьшение 2×→1×, цветная обводка.

const PALETTE_HEX = [
  // зелень
  '#141c12', '#1c2818', '#243520', '#2f4a26', '#3a5a2a', '#4a6e30', '#5c8236', '#73963e', '#8eab4c', '#aac462', '#c8da84',
  // олива / сухая трава
  '#3a3a1c', '#57532a', '#7a7038', '#9c8e48', '#c0ae5c', '#ddd08a',
  // коричневые
  '#160e0a', '#24170f', '#341f14', '#45291a', '#583522', '#6e432a', '#875434', '#a06840', '#b8804e', '#cc9a64', '#e0b882', '#f0d6a8',
  // красные
  '#2e0e0e', '#4a1614', '#6a2018', '#8c2c20', '#ac3e2a', '#c8583a', '#e07a50', '#f0a070',
  // золото / охра
  '#5a3a10', '#7e5214', '#a4701c', '#c89226', '#e4b434', '#f6d458', '#fff2a0',
  // серые тёплые
  '#121010', '#1e1b19', '#2c2825', '#3a3632', '#4a4540', '#5c564f', '#706960', '#867e74', '#9e958a', '#b6ada0', '#cec6ba', '#e4ddd2', '#f6f2ea',
  // синие
  '#0c1624', '#12263c', '#1a3654', '#22486c', '#2c5c86', '#3a74a0', '#5292bc', '#76b2d4', '#a6d2e6', '#d6eef6',
  // фиолетовые
  '#1a1028', '#281a40', '#38245c', '#4c3080', '#6440a8', '#7e58cc', '#9c7ae6', '#bea4f6', '#e2d6ff',
  // кожа
  '#4a2a1c', '#6e4430', '#94603e', '#b47c56', '#d09c74', '#e8bc94', '#f6d8b8',
  // розовые
  '#7a3a4a', '#a85a6a', '#d0808e', '#eeaab2',
  '#ffffff',
];
const PAL = PALETTE_HEX.map(hexToRgb);

// LUT 32×32×32 -> индекс палитры
const PAL_LUT = (() => {
  const lut = new Uint8Array(32768);
  for (let r = 0; r < 32; r++) for (let g = 0; g < 32; g++) for (let b = 0; b < 32; b++) {
    const R = r * 8 + 4, G = g * 8 + 4, B = b * 8 + 4;
    let best = 0, bd = 1e9;
    for (let i = 0; i < PAL.length; i++) {
      const p = PAL[i];
      const dr = R - p[0], dg = G - p[1], db = B - p[2];
      const rm = (R + p[0]) / 2;
      const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
      if (d < bd) { bd = d; best = i; }
    }
    lut[(r << 10) | (g << 5) | b] = best;
  }
  return lut;
})();

function palIndex(r, g, b) {
  r = r < 0 ? 0 : r > 255 ? 255 : r;
  g = g < 0 ? 0 : g > 255 ? 255 : g;
  b = b < 0 ? 0 : b > 255 ? 255 : b;
  return PAL_LUT[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)];
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v / 16 - 0.47));

// Квантование массива RGBA на месте; dither — сила упорядоченного дизеринга.
function quantizeData(d, w, h, dither = 0, ox = 0, oy = 0) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4;
    if (d[o + 3] === 0) continue;
    const t = dither ? BAYER4[((y + oy) & 3) * 4 + ((x + ox) & 3)] * dither : 0;
    const p = PAL[palIndex(d[o] + t, d[o + 1] + t, d[o + 2] + t)];
    d[o] = p[0]; d[o + 1] = p[1]; d[o + 2] = p[2];
  }
}

// Мелкий пиксель нечисти (решение 23.10): кадр сводится в PX_FINE раз детальнее и рисуется в прежнем
// игровом размере. На телефонах и слабых машинах — 1 (как раньше): память кадров растёт в PX_FINE² раз.
const PX_FINE = (() => {
  try {
    if (navigator.deviceMemory && navigator.deviceMemory <= 4) return 1;
    if (window.matchMedia && matchMedia('(pointer: coarse)').matches) return 1;
  } catch (e) { /* без navigator — по умолчанию мелкий */ }
  return 3;
})();

// Нарисовать кадр с пометкой cv.fine в игровом размере. Пока на пиксель мира меньше физических
// пикселей, чем деталей в кадре, — сглаживаем, иначе мелкий пиксель рябит при уменьшении.
function blitFine(c, cv, x, y, w = cv.width / (cv.fine || 1), h = cv.height / (cv.fine || 1)) {
  const f = cv.fine || 1;
  if (f === 1) { c.drawImage(cv, x, y, w, h); return; }
  const sm = c.imageSmoothingEnabled, dev = typeof devScale === 'function' ? devScale() : 1;
  c.imageSmoothingEnabled = PX_FINE > 1 && dev < f;
  c.drawImage(cv, x, y, w, h);
  c.imageSmoothingEnabled = sm;
}

// Канвас со сверхвыборкой SS -> пиксельный 1× канвас.
// opts: outline (bool), alphaCut (порог), keepAlpha (для теней)
function toPixelArt(src, scale, opts = {}) {
  const W = Math.round(src.width / scale), H = Math.round(src.height / scale);
  const sd = src.getContext('2d').getImageData(0, 0, src.width, src.height).data;
  const out = mkCanvas(W, H);
  const oc = out.getContext('2d', opts.cpu ? { willReadFrequently: true } : undefined);
  const img = oc.createImageData(W, H);
  const d = img.data;
  const sw = src.width;
  const n = scale * scale;
  // настройки читаем один раз: цикл идёт по сотням тысяч пикселей
  const punch = opts.punch, hue = opts.hueShift, keepAlpha = opts.keepAlpha, cut = opts.alphaCut ?? 110;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let yy = 0; yy < scale; yy++) {
      let o = ((y * scale + yy) * sw + x * scale) * 4;
      for (let xx = 0; xx < scale; xx++, o += 4) {
        const al = sd[o + 3];
        r += sd[o] * al; g += sd[o + 1] * al; b += sd[o + 2] * al; a += al;
      }
    }
    const o = (y * W + x) * 4;
    if (a > 0) {
      let R = r / a, G = g / a, B = b / a;
      if (punch) {
        // сочнее и контрастнее: тянем от серого и от середины яркости
        const l = R * 0.3 + G * 0.59 + B * 0.11, s = punch;
        R = l + (R - l) * (1 + s * 0.9); G = l + (G - l) * (1 + s * 0.9); B = l + (B - l) * (1 + s * 0.9);
        R = 128 + (R - 128) * (1 + s * 0.5); G = 128 + (G - 128) * (1 + s * 0.5); B = 128 + (B - 128) * (1 + s * 0.5);
      }
      if (hue) {
        // как рисует художник: тени холоднее (в сине-лиловое), свет теплее (в золото)
        const l = R * 0.3 + G * 0.59 + B * 0.11, t = (l - 120) / 120, k = hue;
        if (t < 0) { R += t * 14 * k; G += t * 6 * k; B -= t * 16 * k; }
        else { R += t * 16 * k; G += t * 8 * k; B -= t * 14 * k; }
      }
      d[o] = R; d[o + 1] = G; d[o + 2] = B;
    }
    const alpha = a / n;
    if (keepAlpha) d[o + 3] = alpha;
    else d[o + 3] = alpha >= cut ? 255 : 0;
  }
  if (!opts.keepAlpha) {
    quantizeData(d, W, H, opts.dither || 0);
    if (opts.clean) cleanOrphans(d, W, H);
    if (opts.ink) inkData(d, W, H, opts.ink);
    if (opts.specks) dropSpecks(d, W, H, opts.specks === true ? 70 : opts.specks);   // только камни и скалы: чужие спрайты не трогаем
    if (opts.outline !== false) outlineData(d, W, H, opts.outlineDark ?? 0.42);
    if (opts.onData) opts.onData(d, W, H);      // пиксели уже в памяти — дёшево разобрать на месте
  }
  oc.putImageData(img, 0, 0);
  return out;
}

// Внутренние контуры: на резком перепаде яркости тёмная сторона становится почти чёрной
// линией — так читаются стыки крыши и стен, края окон, дверей, балок.
function inkData(d, W, H, thr) {
  const lum = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) lum[i] = d[i * 4 + 3] ? d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11 : -1;
  const mark = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x, l = lum[i];
    if (l < 0 || l < 26) continue;
    // четыре соседа без временного массива на каждый пиксель
    let j = i - 1;
    if (lum[j] >= 0 && lum[j] - l > thr) { mark[i] = 1; continue; }
    j = i + 1;
    if (lum[j] >= 0 && lum[j] - l > thr) { mark[i] = 1; continue; }
    j = i - W;
    if (lum[j] >= 0 && lum[j] - l > thr) { mark[i] = 1; continue; }
    j = i + W;
    if (lum[j] >= 0 && lum[j] - l > thr) mark[i] = 1;
  }
  for (let i = 0; i < W * H; i++) if (mark[i]) {
    // тёмная линия своего цвета, с лиловым оттенком — не мёртвый чёрный
    const o = i * 4;
    d[o] = d[o] * 0.3 + 10; d[o + 1] = d[o + 1] * 0.24 + 4; d[o + 2] = d[o + 2] * 0.3 + 14;
  }
}

// Чистка «пыли»: одиночный пиксель между двумя одинаковыми соседями принимает их цвет —
// пятна становятся цельными, как у пиксель-художника, а не шумом
function cleanOrphans(d, W, H) {
  const src = new Uint8ClampedArray(d);
  const same = (a, b) => src[a] === src[b] && src[a + 1] === src[b + 1] && src[a + 2] === src[b + 2] && src[a + 3] && src[b + 3];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const o = (y * W + x) * 4;
    if (!src[o + 3]) continue;
    const l = o - 4, r = o + 4, u = o - W * 4, dn = o + W * 4;
    let s = -1;
    if (same(l, r) && !same(o, l)) s = l;
    else if (same(u, dn) && !same(o, u)) s = u;
    if (s >= 0) { d[o] = src[s]; d[o + 1] = src[s + 1]; d[o + 2] = src[s + 2]; }
  }
}

// Чистка «мусорных» точек в готовых пикселях (RGBA). Опирается только на соседей, поэтому годится и для
// спрайтов, нарисованных уже в 1×, и для 2×-заготовок камней. Что делает:
//  • пиксель без единого непрозрачного соседа (8 сторон) — висящая точка, стирается;
//  • тёмный пиксель (яркость < thr) без тёмных соседей — «чёрная точка» на теле: красится цветом соседей.
// Лежащие вдоль контура тёмные пиксели считаются тёмными соседями друг друга, поэтому цельная обводка не страдает.
function pixLum(d, o) { return d[o] * 0.3 + d[o + 1] * 0.59 + d[o + 2] * 0.11; }
function dropSpecks(d, W, H, thr = 70) {
  const src = new Uint8ClampedArray(d), n8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  let changed = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4;
    if (!src[o + 3]) continue;
    let solid = 0, dark = 0, r = 0, g = 0, b = 0, k = 0;
    for (const [dx, dy] of n8) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const p = (yy * W + xx) * 4;
      if (!src[p + 3]) continue;
      solid++;
      if (pixLum(src, p) < thr) dark++;
      else { r += src[p]; g += src[p + 1]; b += src[p + 2]; k++; }
    }
    if (!solid) { d[o + 3] = 0; changed++; continue; }
    if (dark === 0 && k && pixLum(src, o) < thr) { d[o] = r / k; d[o + 1] = g / k; d[o + 2] = b / k; changed++; }
  }
  return changed;
}

// Число «мусорных» точек (то же правило, ничего не меняет) — для тестов и листа аудита
function countSpecks(d, W, H, thr = 70) {
  const c = new Uint8ClampedArray(d);
  return dropSpecks(c, W, H, thr);
}

// Цветная обводка: прозрачный пиксель рядом с непрозрачным становится тёмным оттенком соседа.
function outlineData(d, W, H, dark) {
  const src = new Uint8ClampedArray(d);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4;
    if (src[o + 3] !== 0) continue;
    // первый непрозрачный сосед: снизу, сверху, справа, слева (без временных массивов на каждый пиксель)
    let p = -1;
    if (y + 1 < H && src[o + W * 4 + 3] !== 0) p = o + W * 4;
    else if (y > 0 && src[o - W * 4 + 3] !== 0) p = o - W * 4;
    else if (x + 1 < W && src[o + 7] !== 0) p = o + 4;
    else if (x > 0 && src[o - 1] !== 0) p = o - 4;
    if (p < 0) continue;
    const nr = src[p], ng = src[p + 1], nb = src[p + 2];
    const pi = PAL[palIndex(nr * dark, ng * dark, nb * dark * 1.1)];
    d[o] = pi[0]; d[o + 1] = pi[1]; d[o + 2] = pi[2]; d[o + 3] = 255;
  }
}

// Пиксельная отрисовка прямо в 1×: прямоугольник и линия Брезенхэма.
function px(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x | 0, y | 0, w | 0, h | 0); }

function pline(c, x0, y0, x1, y1, col, w = 1) {
  x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
  c.fillStyle = col;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    c.fillRect(x0, y0, w, w);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

// Обводка и квантование уже пиксельного 1× канваса.
function finishPixel(cv, outline = true) {
  const c = cv.getContext('2d');
  const img = c.getImageData(0, 0, cv.width, cv.height);
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 110 ? 255 : 0;
  quantizeData(d, cv.width, cv.height, 0);
  if (outline) outlineData(d, cv.width, cv.height, 0.4);
  c.putImageData(img, 0, 0);
  return cv;
}
