'use strict';
// Животные мелким пикселем ×3 (решение владельца 23.10, тот же шаблон, что у нечисти): один пиксель арта —
// треть игрового пикселя, размер зверя на экране прежний. Механизм — PX_FINE и blitFine в pixel.js.
//  • почти все звери нарисованы заново ручным пиксель-артом в animalpx.js (метод Полудницы, fzPxKit);
//  • остальное векторное (совы, лошадь в телеге, олени упряжки) сводится в пиксель-арт втрое детальнее (afVec);
//  • карты-строки без своей перерисовки (улей, кротовина) — на мелкой сетке: контур скругляется, свет и обводка своим цветом;
//  • при PX_FINE = 1 (телефоны и слабые машины) те же новые модели, сведённые в ×1 (pxToCoarse) — память кадров как раньше.

// новые модели зверей показываются везде; на телефонах и слабых машинах (PX_FINE = 1) кадры ×3 сводятся в ×1 (pxToCoarse в animalpx.js)
const afFine = () => true;
// размер кадра в игровых пикселях (у мелкого кадра canvas в PX_FINE раз больше)
const afW = s => s.width / (s.fine || 1), afH = s => s.height / (s.fine || 1);
// нарисовать кадр в игровом размере (обычный — как раньше, мелкий — через blitFine)
function afBlit(c, s, x, y, w = afW(s), h = afH(s)) {
  if (s.fine > 1) blitFine(c, s, x, y, w, h); else c.drawImage(s, x, y, w, h);
}

// Кэш кадров с вытеснением самых давних по числу пикселей (мелкие кадры весят в PX_FINE² раз больше)
function afLru(maxPx) {
  const m = new Map();
  let px = 0;
  const size = v => { const cv = v && (v.cv || v); return cv && cv.width ? cv.width * cv.height : 0; };
  return {
    get(k) { const v = m.get(k); if (v !== undefined) { m.delete(k); m.set(k, v); } return v; },
    set(k, v) {
      if (m.has(k)) { px -= size(m.get(k)); m.delete(k); }
      m.set(k, v); px += size(v);
      while (px > maxPx && m.size > 1) { const k0 = m.keys().next().value; px -= size(m.get(k0)); m.delete(k0); }
      return v;
    },
    has(k) { return m.has(k); },
    get size() { return m.size; },
    get px() { return px; },
    clear() { m.clear(); px = 0; },
  };
}

// Векторный рисунок w×h (игровые пиксели, начало в ox, oy) → мелкий пиксель-арт с обводкой своим цветом
let AF_SCRATCH = null;
function afVec(w, h, ox, oy, draw, opts = {}) {
  const F = PX_FINE, S = 2 * F, W = Math.ceil(w * S), H = Math.ceil(h * S);
  if (!AF_SCRATCH || AF_SCRATCH.width < W || AF_SCRATCH.height < H) AF_SCRATCH = mkCanvas(Math.max(W, AF_SCRATCH ? AF_SCRATCH.width : 0), Math.max(H, AF_SCRATCH ? AF_SCRATCH.height : 0));
  let cv = AF_SCRATCH;
  if (cv.width !== W || cv.height !== H) cv = mkCanvas(W, H);     // toPixelArt берёт весь холст — нестандартный размер рисуем отдельно
  const c = cv.getContext('2d', { willReadFrequently: true });
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H);
  c.scale(S, S); c.translate(ox, oy); c.lineCap = 'round'; c.lineJoin = 'round';
  draw(c);
  c.setTransform(1, 0, 0, 1, 0, 0);
  const out = toPixelArt(cv, 2, Object.assign({ outline: true, outlineDark: 0.55, alphaCut: 100, clean: true, quant: afQuantHue }, opts));
  out.fine = F;
  return out;
}

// Ближайший цвет PAL того же оттенка: обычный подбор уводит рыжий мех в оливковый, а розовое — в бурое.
// Для насыщенных цветов ищем только среди цветов палитры с близким тоном; серые подбираются как обычно.
const AF_HUE = new Map();
function afHueOf(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return [0, 0];
  const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, d / (mx || 1)];
}
function afPalHue(r, g, b) {
  const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
  let i = AF_HUE.get(k);
  if (i !== undefined) return PAL[i];
  const [h, s] = afHueOf(r, g, b);
  i = palIndex(r, g, b);
  if (s > 0.28) {
    let bd = 1e9;
    PAL.forEach((p, j) => {
      const [ph, ps] = afHueOf(p[0], p[1], p[2]), dh = Math.min(Math.abs(ph - h), 360 - Math.abs(ph - h));
      if (ps < 0.18 || dh > 10) return;
      const dr = p[0] - r, dg = p[1] - g, db = p[2] - b, dd = dr * dr * 2 + dg * dg * 4 + db * db * 3;
      if (dd < bd) { bd = dd; i = j; }
    });
  }
  AF_HUE.set(k, i);
  return PAL[i];
}

// ---------- Ручные карты на мелкой сетке ----------
// Каждая клетка карты голосует за свой цвет с весом по расстоянию (гаусс), побеждает самый весомый:
// ступеньки диагоналей становятся ровной линией, углы скругляются, а одиночные клетки (глаз, коготь) остаются.
const AF_SIG2 = 2 * 0.5 * 0.5;
function afRowsData(rows, pal, F) {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length;
  const cols = [], key = {}, lab = new Int16Array(w * h).fill(-1);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ' || !pal[ch]) continue;
      if (key[ch] === undefined) { key[ch] = cols.length; cols.push(hexToRgb(pal[ch])); }
      lab[y * w + x] = key[ch];
    }
  });
  // одиночные клетки (глаз, ноздря, коготь — ни одного соседа того же цвета) голосуют цветом окружения,
  // а потом ставятся аккуратным квадратом 2×2 мелких: иначе скругление превращает точку в «крестик»
  const n4 = [[1, 0], [-1, 0], [0, 1], [0, -1]], lone = [];
  const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h ? lab[y * w + x] : -1;
  const vote = Int16Array.from(lab);
  if (F > 2) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const l = lab[y * w + x];
    if (l < 0 || n4.some(([dx, dy]) => at(x + dx, y + dy) === l)) continue;
    const cnt = {};
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const m = at(x + i, y + j); if ((i || j) && m >= 0) cnt[m] = (cnt[m] || 0) + (i && j ? 1 : 2); }
    const ks = Object.keys(cnt);
    if (!ks.length) continue;                                    // висящая точка — как есть
    vote[y * w + x] = +ks.reduce((a, b) => cnt[a] >= cnt[b] ? a : b);
    lone.push([x, y, l]);
  }
  const W = w * F, H = h * F, n = cols.length, out = new Int16Array(W * H).fill(-1), acc = new Float32Array(n + 1);
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
    const cx = (X + 0.5) / F - 0.5, cy = (Y + 0.5) / F - 0.5, ix = Math.round(cx), iy = Math.round(cy);
    acc.fill(0);
    for (let j = iy - 1; j <= iy + 1; j++) for (let i = ix - 1; i <= ix + 1; i++) {
      const l = i >= 0 && j >= 0 && i < w && j < h ? vote[j * w + i] : -1;
      const d2 = (i - cx) * (i - cx) + (j - cy) * (j - cy);
      acc[l < 0 ? n : l] += Math.exp(-d2 / AF_SIG2) * (l < 0 ? 0.92 : 1);   // фон чуть слабее: тонкие лапки не тают
    }
    let best = n, bw = acc[n];
    for (let k = 0; k < n; k++) if (acc[k] > bw) { bw = acc[k]; best = k; }
    // свой цвет клетки сильнее чужого непрозрачного соседа: внутренние пятна не расползаются
    const own = ix >= 0 && iy >= 0 && ix < w && iy < h ? vote[iy * w + ix] : -1;
    if (best !== n && own >= 0 && best !== own && acc[own] > bw * 0.82) best = own;
    out[Y * W + X] = best === n ? -1 : best;
  }
  for (const [x, y, l] of lone) for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) out[(y * F + j) * W + x * F + F - 2 + i] = l;   // в верхнем правом углу клетки: звери смотрят вправо
  return { W, H, out, cols };
}

// Свет и обводка на мелкой сетке: край тела — тот же цвет темнее (не чёрный), верхний ободок светлее, низ в тени
function afShadeFine(d, W, H, F, o = {}) {
  const src = new Uint8ClampedArray(d), A = i => src[i * 4 + 3] !== 0;
  const rim = o.rim ?? 0.62, lit = o.lit ?? 0.13, low = o.low ?? 0.86;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!A(i)) continue;
    const up = y > 0 && A(i - W), dn = y < H - 1 && A(i + W), lf = x > 0 && A(i - 1), rt = x < W - 1 && A(i + 1);
    let k = 1, add = 0;
    if (!up || !dn || !lf || !rt) k = rim;                                       // обводка своим цветом
    else if (y > 1 && !A(i - 2 * W)) add = lit;                                  // свет сверху: второй ряд от края
    else {
      let gap = 0;
      for (let s = 1; s <= F; s++) if (y + s >= H || !A(i + s * W)) { gap = s; break; }
      if (gap > 1) k = low;                                                      // нижние ряды — в тень
    }
    if (k === 1 && !add) continue;
    const o4 = i * 4, r = src[o4], g = src[o4 + 1], b = src[o4 + 2];
    const p = afSnap(r * k + (255 - r) * add, g * k + (255 - g) * add, b * k * (k < 1 ? 1.08 : 1) + (255 - b) * add * 0.8);
    d[o4] = p[0]; d[o4 + 1] = p[1]; d[o4 + 2] = p[2];
  }
}

// Цвет к общей палитре PAL, если в ней есть близкий; иначе свой (холодные серые цапли и голубизна ворон
// в PAL не попадают — палитра увела бы их в бурое). Набор цветов кадра всё равно маленький: основа × 3 тона.
function afSnap(r, g, b) {
  const p = PAL[palIndex(r, g, b)], dr = p[0] - r, dg = p[1] - g, db = p[2] - b;
  return dr * dr * 2 + dg * dg * 4 + db * db * 3 < 900 ? p : [Math.round(r), Math.round(g), Math.round(b)];
}

function afRowsCanvas(rows, pal, o = {}) {
  const F = PX_FINE, { W, H, out, cols } = afRowsData(rows, pal, F);
  const cv = mkCanvas(W, H), c = cv.getContext('2d'), img = c.createImageData(W, H), d = img.data;
  for (let i = 0; i < W * H; i++) {
    const l = out[i];
    if (l < 0) continue;
    const p = afSnap(cols[l][0], cols[l][1], cols[l][2]);
    d[i * 4] = p[0]; d[i * 4 + 1] = p[1]; d[i * 4 + 2] = p[2]; d[i * 4 + 3] = 255;
  }
  if (o.shade !== false) afShadeFine(d, W, H, F, o);
  if (o.onData) o.onData(d, W, H, F);
  c.putImageData(img, 0, 0);
  cv.fine = F;
  return cv;
}

// Замена faSprite для животных: при мелком пикселе — ручная перерисовка (если есть) или карта на мелкой сетке
function afSprite(rows, pal, name) {
  if (!afFine()) return faSprite(rows, pal);
  if (name) for (const [re, fn] of AF_HAND_LIST) if (re.test(name)) { const s = fn(rows, pal, name); if (s) return s; break; }
  return afRowsCanvas(rows, pal);
}

// Процедурный пиксельный кадр (вороны и аисты в полёте): фигуры заданы формулами в клетках 1×.
// fn(px, each): px(x, y, col) — закрасить целую игровую клетку; each(cb) — пройти по всем клеткам
// (при мелком пикселе — по мелким, в тех же координатах: целое число = центр игровой клетки), cb(x, y) → цвет | null.
function afProc(W, H, fn, o = {}) {
  const F = afFine() ? PX_FINE : 1, cv = mkCanvas(W * F, H * F), c = cv.getContext('2d');
  const px = (x, y, col) => { c.fillStyle = col; c.fillRect((x | 0) * F, (y | 0) * F, F, F); };
  const each = cb => {
    for (let Y = 0; Y < H * F; Y++) for (let X = 0; X < W * F; X++) {
      const col = cb((X + 0.5) / F - 0.5, (Y + 0.5) / F - 0.5);
      if (col) { c.fillStyle = col; c.fillRect(X, Y, 1, 1); }
    }
  };
  fn(px, each);
  if (F > 1) {
    const img = c.getImageData(0, 0, cv.width, cv.height);
    for (let i = 0; i < img.data.length; i += 4) if (img.data[i + 3]) { const p = afSnap(img.data[i], img.data[i + 1], img.data[i + 2]); img.data[i] = p[0]; img.data[i + 1] = p[1]; img.data[i + 2] = p[2]; }
    if (o.shade !== false) afShadeFine(img.data, cv.width, cv.height, F, o);
    c.putImageData(img, 0, 0);
    cv.fine = F;
  }
  return cv;
}

// ---------- Ручная перерисовка (animalpx.js) ----------
// фаза шага из ключа кадра: «…W3» / «…w3» из N кадров → 0..1, иначе null
const afPh = (key, N) => { const m = /[wW](\d+)$/.exec(key); return m ? (+m[1] % N) / N : null; };

const AF_HAND_LIST = [];
const afHand = (re, fn) => AF_HAND_LIST.unshift([re, fn]);   // поздняя регистрация главнее
// в PAL нет близкого тона (насыщенный тёмно-рыжий мех) — свой цвет, огрублённый до ступеней по 16: тонов всё равно немного
function afQuantHue(d, W, H) {
  for (let o = 0; o < W * H * 4; o += 4) if (d[o + 3]) {
    const r = d[o], g = d[o + 1], b = d[o + 2], p = afPalHue(r, g, b), dr = p[0] - r, dg = p[1] - g, db = p[2] - b;
    if (dr * dr * 2 + dg * dg * 4 + db * db * 3 < 1500) { d[o] = p[0]; d[o + 1] = p[1]; d[o + 2] = p[2]; }
    else { d[o] = (r >> 4) * 16 + 8; d[o + 1] = (g >> 4) * 16 + 8; d[o + 2] = (b >> 4) * 16 + 8; }
  }
}
