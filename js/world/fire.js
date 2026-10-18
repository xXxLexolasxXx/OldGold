// Единый огонь игры: предрисованные пиксельные кадры пламени (5 кадров горения),
// рампа тёмно-красный → красный → оранжевый → жёлтый → почти белый (сдвиг оттенка: тени краснее, свет жёлтый),
// жёсткие края без сглаживания, целочисленный масштаб. Размеры: tiny (свеча), spark (искра/лампа),
// torch (факел, горящий гном), camp (костёр, зверь), blaze (большой пожар, нечисть, здание), bonfire (костёр-великан в центре большого костра, 9 кадров).
//   drawFire(ctx, x, y, size, time, seed, opts)   x,y — центр основания пламени
//   size: 'tiny'|'spark'|'torch'|'camp'|'blaze' или число — желаемая высота в px (подберётся размер и масштаб)
//   opts: { scale, glow (0..), sparks (шт), alpha, flip, h (желаемая высота), rgb (цвет свечения), magic (цвет-рампа) }
const FIRE_RAMP = ['#4a0e0e', '#9a1c14', '#d8421a', '#f27a1c', '#ffb02e', '#ffe066', '#fff6c8'];
const FIRE_MAGIC = {
  green:  ['#0a3a1c', '#157a3a', '#2fc060', '#66ea84', '#a6ffb4', '#d8ffd8', '#f4fff4'],
  violet: ['#2a1050', '#52248e', '#8a4ad0', '#b47cf0', '#d4a8ff', '#ece0ff', '#faf4ff'],
  blue:   ['#0c2250', '#1c4a9a', '#3a86e0', '#6ab8ff', '#a4dcff', '#d8f2ff', '#f4fbff'],
};
// размер → [ширина, высота, полуширина основания]
const FIRE_SIZES = { tiny: [3, 5, 1.4], spark: [5, 8, 2.3], torch: [9, 14, 3.9], camp: [15, 24, 6.4], blaze: [27, 42, 11.5], bonfire: [46, 64, 21] };
const FIRE_ORDER = ['tiny', 'spark', 'torch', 'camp', 'blaze'];
const FIRE_FRAMES = 5;
const FIRE_FRAMES_OF = { bonfire: 9 };   // у костра-великана кадров больше — язык плавнее
const fireFrames = size => FIRE_FRAMES_OF[size] || FIRE_FRAMES;
const FIRE_ATLAS = {};

function fireHash(a, b) { const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return n - Math.floor(n); }

function buildFireAtlas(size, ramp, cpu) {
  const [w, h, hw] = FIRE_SIZES[size], NF = fireFrames(size);
  const cv = document.createElement('canvas'); cv.width = w * NF; cv.height = h;
  const g = cv.getContext('2d', cpu ? { willReadFrequently: true } : undefined), img = g.createImageData(cv.width, h);
  const rgb = ramp.map(s => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)]);
  const cx = (w - 1) / 2, tongues = Math.max(1.2, hw / 2.6);
  for (let f = 0; f < NF; f++) {
    const ph = f / NF * Math.PI * 2;
    for (let x = 0; x < w; x++) {
      // колонка языка: высота — огибающая × несколько бегущих языков (петля идеально замкнута по всем кадрам)
      const sway = Math.sin(ph) * hw * 0.16;
      const u = (x - cx - sway) / (hw + 0.6);
      if (Math.abs(u) >= 1) continue;
      const big = hw > 14;                               // костёр-великан: широкий корпус и несколько языков разной высоты
      const env = Math.pow(1 - u * u, big ? 0.75 : 1.25);
      const k1 = 1.6 + hw * 0.16, k2 = 2.4 + hw * 0.2;
      const tg = big ? 0.66 + 0.3 * Math.sin(ph + u * 8.4) * (0.6 + 0.4 * Math.cos(2 * ph + u * 3)) + 0.16 * Math.sin(2 * ph - u * 12.5 + 1.3) + 0.08 * Math.cos(ph + u * 2)
        : 0.74 + 0.26 * Math.sin(ph + u * k1 * 1.9) * 0.9 + 0.14 * Math.sin(2 * ph - u * k2 * 1.6 + 1.3) + 0.1 * Math.cos(ph + u * 0.8);
      const flick = hw > 5 ? 1 : 0.96 + 0.04 * (fireHash(x, f) - 0.5) * 2;
      const hc = h * Math.max(0.1, Math.min(1, (0.14 + 0.86 * env) * tg * flick * 1.08));
      for (let y = 0; y < hc; y++) {
        const t = y / hc;                              // 0 у основания, 1 на кончике
        const edge = Math.abs(u);
        // основание: скруглённый «язычок» вместо ровного среза, нижний ряд рассыпан шахматкой
        const bh = Math.max(2, h * 0.17);
        if (y < bh) { const q = 1 - (bh - y - 0.5) / bh; if (edge > Math.sqrt(Math.max(0, 1 - (1 - q) * (1 - q))) * 0.98 + 0.02) continue; const dz = Math.min(4, Math.floor(bh)); if (y < dz) { const bayer = [[0, 2], [3, 1]][(x + f) & 1][y & 1]; if (bayer >= (y + 1) * 4 / (dz + 1) * (dz > 2 ? 1 : 0.8)) continue; } }
        // перекос верхушки в сторону качания, сужение к кончику
        const lean = sway * t * 1.3;
        if (t > 0.45 && Math.abs(u - lean / (hw + 0.6)) > (1 - t * (hw > 14 ? 0.12 : 0.55))) continue;
        let heat = (1 - t * 0.85) * (1 - edge * 0.95) + (fireHash(x * 3 + y, f + 7) - 0.5) * 0.1;
        const lv = Math.max(0, Math.min(6, Math.floor(heat * 7.4 + 0.6)));
        const px = x, py = h - 1 - y, o = (py * cv.width + f * w + px) * 4;
        const col = rgb[lv];
        img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
      }
    }
  }
  g.putImageData(img, 0, 0);
  return cv;
}

// cpu — атлас в программном холсте: для рисования на холст, который потом читают попиксельно
// (заставка). Копирование с холста видеокарты на такой холст каждый раз вычитывает пиксели с GPU (~2 мс).
const FIRE_ATLAS_CPU = {};
function fireAtlas(size, magic, cpu) {
  const key = size + (magic || ''), A = cpu ? FIRE_ATLAS_CPU : FIRE_ATLAS;
  return A[key] || (A[key] = buildFireAtlas(size, magic ? FIRE_MAGIC[magic] : FIRE_RAMP, cpu));
}

// подобрать размер и целочисленный масштаб под желаемую высоту
function fireSizeFor(h) {
  let best = 'tiny', sc = 1;
  for (const s of FIRE_ORDER) { if (FIRE_SIZES[s][1] <= h * 1.12) best = s; }
  sc = Math.max(1, Math.round(h / FIRE_SIZES[best][1]));
  if (sc > 2 && best !== 'blaze') sc = 2;
  return [best, sc];
}

function drawFire(c, x, y, size, time, seed, opts) {
  opts = opts || {};
  let sz = size, sc = opts.scale || 1;
  if (typeof size === 'number' || opts.h) { [sz, sc] = fireSizeFor(opts.h || size); if (opts.scale) sc = opts.scale; }
  const [w, h] = FIRE_SIZES[sz];
  const NF = fireFrames(sz), f = Math.floor(time * 9 + (seed || 0) * 1.7) % NF, fi = f < 0 ? f + NF : f;
  const atlas = fireAtlas(sz, opts.magic, opts.cpu);
  const dw = w * sc, dh = h * sc, gl = opts.glow === undefined ? 1 : opts.glow;
  if (gl > 0 && typeof glow === 'function') {
    const r = Math.max(dw, dh) * 1.9 + 4, fl = 1 + 0.12 * Math.sin(time * 11 + (seed || 0));
    glow(c, x, y - dh * 0.45, r, opts.rgb || (opts.magic ? '140,255,170' : '255,140,50'), Math.min(0.5, 0.3 * gl * fl));
  }
  c.save();
  c.imageSmoothingEnabled = false;
  if (opts.alpha !== undefined) c.globalAlpha = opts.alpha;
  const dx = Math.round(x - dw / 2), dy = Math.round(y - dh + sc);
  if (opts.flip || ((seed || 0) & 1)) { c.translate(dx + dw, dy); c.scale(-1, 1); c.drawImage(atlas, fi * w, 0, w, h, 0, 0, dw, dh); }
  else c.drawImage(atlas, fi * w, 0, w, h, dx, dy, dw, dh);
  c.restore();
  const n = opts.sparks | 0;
  if (n > 0) {
    const ramp = opts.magic ? FIRE_MAGIC[opts.magic] : FIRE_RAMP;
    for (let k = 0; k < n; k++) {
      const p = (time * 0.7 + k / n + (seed || 0) * 0.137) % 1, a = 1 - p;
      const px = Math.round(x + Math.sin(k * 3.1 + time * 1.6 + (seed || 0)) * (dw * 0.3 + dw * 0.5 * p));
      const py = Math.round(y - dh * 0.6 - p * dh * 1.1);
      c.globalAlpha = (opts.alpha === undefined ? 1 : opts.alpha) * Math.min(1, a * 1.6);
      c.fillStyle = ramp[a > 0.6 ? 5 : a > 0.3 ? 4 : 3];
      c.fillRect(px, py, sc > 1 || k % 3 === 0 ? 2 : 1, sc > 1 || k % 3 === 0 ? 2 : 1);
    }
    c.globalAlpha = 1;
  }
}
