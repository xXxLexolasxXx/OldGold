'use strict';
// Варианты дневной земли (пиксель-арт, рампы тона из палитры игры, без шума и градиентов).
// groundPatch(id, tw, th, seed) -> холст tw×th клеток (по 32 px). Лист сравнения — ground.html.
// Сейчас это витрина вариантов; выбранный будет подключён в terrain.js (кисти base/decor — те же).

const GS_TILE = 32;
const GS_RGB = {};
function gsRgb(h) { return GS_RGB[h] || (GS_RGB[h] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]); }
function gsHash(x, y, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// Шум каждого вида земли бесшовно повторяется через GS_PER пикселей (как текстуры рельефа в terrain.js):
// вид считается один раз на плитку 512×512 и дальше берётся по таблице — построение полосы почти бесплатно.
const GS_PER = 512;
function gsVN(x, y, c, s) {
  const n = Math.max(1, Math.round(GS_PER / c)), k = n / GS_PER, gx = x * k, gy = y * k, ix = Math.floor(gx), iy = Math.floor(gy);
  let tx = gx - ix, ty = gy - iy; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
  const x0 = ((ix % n) + n) % n, y0 = ((iy % n) + n) % n, x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
  const a = gsHash(x0, y0, s), b = gsHash(x1, y0, s), c2 = gsHash(x0, y1, s), d = gsHash(x1, y1, s);
  return a + (b - a) * tx + (c2 - a) * ty + (a - b - c2 + d) * tx * ty;
}
const gsF = (x, y, c, s) => gsVN(x, y, c, s) * 0.65 + gsVN(x, y, c / 2, s + 9) * 0.35;
// Шум по всей карте без повтора — для расположения биомов (низкая частота, считается по сетке и интерполируется)
function gsVNW(x, y, c, s) {
  const gx = x / c, gy = y / c, ix = Math.floor(gx), iy = Math.floor(gy);
  let tx = gx - ix, ty = gy - iy; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
  const a = gsHash(ix, iy, s), b = gsHash(ix + 1, iy, s), c2 = gsHash(ix, iy + 1, s), d = gsHash(ix + 1, iy + 1, s);
  return a + (b - a) * tx + (c2 - a) * ty + (a - b - c2 + d) * tx * ty;
}
const gsFW = (x, y, c, s) => gsVNW(x, y, c, s) * 0.65 + gsVNW(x, y, c / 2, s + 9) * 0.35;

// Рампы тона (тёмный → светлый), все цвета — из PALETTE_HEX
const GS_GRASS = ['#243520', '#2f4a26', '#3a5a2a', '#4a6e30', '#5c8236', '#73963e', '#8eab4c', '#aac462', '#c8da84'];
const GS_DRY = ['#3a3a1c', '#57532a', '#7a7038', '#9c8e48', '#c0ae5c', '#ddd08a'];
const GS_DIRT = ['#341f14', '#45291a', '#583522', '#6e432a', '#875434', '#a06840', '#b8804e', '#cc9a64'];
const GS_STONE = ['#2c2825', '#3a3632', '#4a4540', '#5c564f', '#706960', '#867e74', '#9e958a', '#b6ada0'];

// Виды клеток поля
const K_GRASS = 0, K_DIRT = 1, K_PATH = 2, K_MOSS = 3, K_GLADE = 4, K_CRACK = 5, K_DAMP = 6, K_CLOVER = 7;
const GS_DEPR = new Set([K_DIRT, K_PATH, K_CRACK, K_DAMP]);   // «ямки»: тёмный край сверху-слева, светлая губа снизу-справа

const GROUND_VARIANTS = {
  meadow: {
    name: '1. Луговая мозаика', sub: 'Крупные пятна трёх-четырёх тонов, много штрихов-травинок, ромашки и колокольчики кучками.',
    ramp: [GS_GRASS[1], GS_GRASS[2], GS_GRASS[3], GS_GRASS[4], GS_GRASS[5], GS_GRASS[6]],
    field(x, y, s) {
      const t = gsF(x, y, 56, s) * 0.6 + gsF(x, y, 18, s + 1) * 0.4;
      return [K_GRASS, t < 0.33 ? 0 : t < 0.42 ? 1 : t < 0.52 ? 2 : t < 0.61 ? 3 : t < 0.70 ? 4 : 5];
    },
    ticks: 16,
    decor(S, tx, ty, r) { S.tufts(r, 0.7, 3); S.flowerPatch(r, 0.3, ['#f6d458', '#f6f2ea', '#8ab4f0', '#e86a4a'], 5, 9); S.daisies(r, 0.3); S.pebbles(r, 0.04); },
  },
  glades: {
    name: '2. Поляны и чаща', sub: 'Светлые стриженые поляны с мелкими цветами среди тёмной густой травы: клевер, папоротник, грибы по краю.',
    ramp: [GS_GRASS[1], GS_GRASS[2], GS_GRASS[3], GS_GRASS[4]],
    ramp2: [GS_GRASS[4], GS_GRASS[5], GS_GRASS[6], GS_GRASS[7]],
    field(x, y, s) {
      const g = gsF(x, y, 120, s + 2) + (gsVN(x, y, 7, s + 5) - 0.5) * 0.06;
      if (g > 0.6) { const t = gsF(x, y, 26, s + 3); return [K_GLADE, t < 0.4 ? 0 : t < 0.55 ? 1 : t < 0.68 ? 2 : 3]; }
      const t = gsF(x, y, 34, s + 4) * 0.7 + gsF(x, y, 12, s + 5) * 0.3;
      return [K_GRASS, t < 0.38 ? 0 : t < 0.5 ? 1 : t < 0.62 ? 2 : 3];
    },
    ticks: 12,
    decor(S, tx, ty, r) {
      const k = S.kc(tx, ty);
      if (k === K_GLADE) { S.tufts(r, 0.25, 1); S.flowerPatch(r, 0.3, ['#f6d458', '#f6f2ea', '#d47cc8'], 3, 5); S.daisies(r, 0.35); S.pebbles(r, 0.03); }
      else { S.tufts(r, 0.8, 3); S.clover(r, 0.4); S.ferns(r, 0.22); S.mushrooms(r, 0.07); S.pebbles(r, 0.02); }
    },
  },
  trails: {
    name: '3. Тропы и почва', sub: 'Спокойная трава, вытоптанные тропки-извилины, пятна голой земли с рваным краем, камешки на тропе.',
    ramp: [GS_GRASS[1], GS_GRASS[2], GS_GRASS[3], GS_GRASS[4], GS_GRASS[5]],
    field(x, y, s) {
      const wob = (gsVN(x, y, 11, s + 7) - 0.5) * 0.05;
      const pa = Math.abs(gsF(x, y, 170, s + 6) - 0.5 + wob), pb = Math.abs(gsF(x, y, 130, s + 8) - 0.5 + wob);
      if (pa < 0.02 || pb < 0.014) { const t = gsF(x, y, 9, s + 9); return [K_PATH, t < 0.35 ? 0 : t < 0.7 ? 1 : 2]; }
      const d = gsF(x, y, 62, s + 10) + (gsVN(x, y, 6, s + 11) - 0.5) * 0.09;
      if (d > 0.72) { const t = gsF(x, y, 10, s + 12); return [K_DIRT, t < 0.38 ? 0 : t < 0.72 ? 1 : 2]; }
      const t = gsF(x, y, 50, s) * 0.6 + gsF(x, y, 16, s + 1) * 0.4;
      return [K_GRASS, t < 0.38 ? 0 : t < 0.5 ? 1 : t < 0.62 ? 2 : t < 0.72 ? 3 : 4];
    },
    dirt: [GS_DIRT[2], GS_DIRT[3], GS_DIRT[4]], path: [GS_DIRT[3], GS_DIRT[4], GS_DIRT[5]],
    ticks: 11,
    decor(S, tx, ty, r) {
      S.tufts(r, 0.5, 3); S.flowerPatch(r, 0.07, ['#f6d458', '#f6f2ea'], 3, 5); S.pebbles(r, 0.05);
      S.dirtBits(r, 0.5);
    },
  },
  spring: {
    name: '4. Цветущий луг', sub: 'Светло-салатовая, весенняя: россыпь клевера, лютики, маки, васильки, ромашки; мелкие и яркие точки без шума.',
    ramp: [GS_GRASS[3], GS_GRASS[4], GS_GRASS[5], GS_GRASS[6], GS_GRASS[7]],
    field(x, y, s) {
      const t = gsF(x, y, 48, s + 14) * 0.65 + gsF(x, y, 15, s + 15) * 0.35;
      if (gsF(x, y, 40, s + 16) > 0.68) return [K_CLOVER, t < 0.5 ? 1 : 2];
      return [K_GRASS, t < 0.38 ? 0 : t < 0.5 ? 1 : t < 0.62 ? 2 : t < 0.74 ? 3 : 4];
    },
    ticks: 13,
    decor(S, tx, ty, r) {
      S.tufts(r, 0.4, 2); S.clover(r, 0.55);
      S.flowerPatch(r, 0.34, ['#f6d458', '#e86a4a', '#8ab4f0', '#f6f2ea', '#d47cc8', '#fff2a0'], 6, 9);
      S.daisies(r, 0.3); S.pebbles(r, 0.02);
    },
  },
  steppe: {
    name: '5. Сухая степь', sub: 'Выгоревшая охристая трава с зелёными прожилками, высокие сухие стебли, чертополох, растрескавшаяся земля, валуны.',
    ramp: [GS_DRY[1], GS_DRY[2], GS_DRY[3], GS_DRY[4], GS_DRY[5]],
    field(x, y, s) {
      const cr = gsF(x, y, 70, s + 20) + (gsVN(x, y, 6, s + 21) - 0.5) * 0.08;
      if (cr > 0.74) { const t = gsF(x, y, 9, s + 22); return [K_CRACK, t < 0.4 ? 0 : t < 0.75 ? 1 : 2]; }
      const t = gsF(x, y, 60, s + 23) * 0.6 + gsF(x, y, 17, s + 24) * 0.4;
      if (gsF(x, y, 90, s + 25) + (gsVN(x, y, 5, s + 26) - 0.5) * 0.12 > 0.64) { return [K_GRASS, -1 - (t < 0.45 ? 0 : t < 0.6 ? 1 : 2)]; }   // зелёные прожилки: отрицательный уровень → зелёная рампа
      return [K_GRASS, t < 0.34 ? 0 : t < 0.46 ? 1 : t < 0.58 ? 2 : t < 0.7 ? 3 : 4];
    },
    greens: [GS_GRASS[2], GS_GRASS[3], GS_GRASS[4]],
    dirt: [GS_DIRT[3], GS_DIRT[4], GS_DIRT[5]],
    ticks: 14,
    decor(S, tx, ty, r) { S.stalks(r, 0.6); S.thistles(r, 0.06); S.cracks(r); S.pebbles(r, 0.05); S.boulders(r, 0.025, false); S.tufts(r, 0.2, 2, true); },
  },
  mossy: {
    name: '6. Мшистая глушь', sub: 'Сумрачно-зелёная, сырая: мшистые пятна, тёмная влажная земля с корнями, валуны в моху, папоротник и грибы.',
    ramp: [GS_GRASS[0], GS_GRASS[1], GS_GRASS[2], GS_GRASS[3], GS_GRASS[4]],
    field(x, y, s) {
      const dm = gsF(x, y, 66, s + 30) + (gsVN(x, y, 6, s + 31) - 0.5) * 0.08;
      if (dm > 0.73) { const t = gsF(x, y, 9, s + 32); return [K_DAMP, t < 0.4 ? 0 : t < 0.78 ? 1 : 2]; }
      const m = gsF(x, y, 44, s + 33) + (gsVN(x, y, 5, s + 34) - 0.5) * 0.07;
      if (m > 0.6) { const t = gsF(x, y, 13, s + 35); return [K_MOSS, t < 0.45 ? 0 : t < 0.7 ? 1 : 2]; }
      const t = gsF(x, y, 52, s + 36) * 0.6 + gsF(x, y, 15, s + 37) * 0.4;
      return [K_GRASS, t < 0.36 ? 0 : t < 0.48 ? 1 : t < 0.6 ? 2 : t < 0.7 ? 3 : 4];
    },
    moss: [GS_GRASS[4], GS_GRASS[5], GS_GRASS[6]],
    dirt: [GS_DIRT[0], GS_DIRT[1], GS_DIRT[2]],
    ticks: 11,
    decor(S, tx, ty, r) { S.tufts(r, 0.45, 2); S.ferns(r, 0.3); S.mushrooms(r, 0.1); S.boulders(r, 0.05, true); S.roots(r, 0.4); S.pebbles(r, 0.04); S.flowerPatch(r, 0.04, ['#f6f2ea'], 2, 3); },
  },
};

// Итоговый цвет клетки поля с учётом рампы вида
function gsColor(V, k, l) {
  if (k === K_PATH) return V.path[l];
  if (k === K_DIRT || k === K_DAMP) return V.dirt[l];
  if (k === K_CRACK) return V.dirt[l];
  if (k === K_MOSS) return V.moss[l];
  if (k === K_GLADE) return V.ramp2[l];
  if (l < 0) return V.greens[-1 - l];
  return V.ramp[l];
}

// Все цвета рамп в одной таблице: поле хранит индекс цвета (1 байт), а не строку
const GS_RAMPS = [GS_GRASS, GS_DRY, GS_DIRT, GS_STONE];
const GS_HEXLIST = [], GS_HEXRGB = [];
const GS_HEXIDX = {};
function gsHexIdx(h) {
  let i = GS_HEXIDX[h];
  if (i === undefined) { i = GS_HEXIDX[h] = GS_HEXLIST.length; GS_HEXLIST.push(h); GS_HEXRGB.push(gsRgb(h)); }
  return i;
}
for (const rp of GS_RAMPS) for (const h of rp) gsHexIdx(h);
(function () {
  let n = 0;
  for (const id of Object.keys(GROUND_VARIANTS)) {
    const V = GROUND_VARIANTS[id]; V.id = id; V.idx = n++;
    for (const k of ['ramp', 'ramp2', 'greens', 'dirt', 'path', 'moss']) if (V[k]) for (const h of V[k]) gsHexIdx(h);
  }
})();

// Биом в точке карты: низкочастотный шум режет мир на области (≈15 клеток), у каждой свой вид земли.
// Пропорции: луг, поляны, тропы и мшистая глушь — основные; цветущий луг — реже; степь — небольшими пятнами.
function gsBiomeOf(v, steppe) {   // v — шум биомов, steppe — шум степных пятен (уже с рваным краем)
  if (steppe > 0.71) return GROUND_VARIANTS.steppe;
  return v < 0.43 ? GROUND_VARIANTS.meadow : v < 0.49 ? GROUND_VARIANTS.glades : v < 0.55 ? GROUND_VARIANTS.trails : v < 0.59 ? GROUND_VARIANTS.spring : GROUND_VARIANTS.mossy;
}
// Точное значение в одной точке (медленно — для редких запросов у края полосы)
function gsPick(x, y, s) {
  const rg = (gsVN(x & 511, y & 511, 9, s + 103) - 0.5) * 0.03;
  return gsBiomeOf(gsFW(x, y, 150, s + 101) + rg, gsFW(x, y, 380, s + 102) + rg);
}

// Запечённая плитка вида: тип клетки, тон и цвет с рельефом края (бесшовно, 512×512)
const GS_BAKE = { seed: -1, done: false, gen: null, rg: null };
function* gsBakeGen(seed) {
  const sd = seed * 131, N = GS_PER, list = GS_LIST();
  GS_BAKE.rg = new Float32Array(N * N);
  for (let y = 0; y < N; y++) { for (let x = 0; x < N; x++) GS_BAKE.rg[y * N + x] = (gsVN(x, y, 9, sd + 103) - 0.5) * 0.03; if ((y & 31) === 31) yield; }
  for (const V of list) {
    const K = V.bk = new Uint8Array(N * N), L = V.bl = new Int8Array(N * N), C = V.bc = new Uint8Array(N * N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) { const f = V.field(x, y, sd); K[y * N + x] = f[0]; L[y * N + x] = f[1]; }
      if ((y & 15) === 15) yield;
    }
    const at = (x, y) => ((y & (N - 1)) * N) + (x & (N - 1));
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const i = y * N + x, k = K[i];
        let l = L[i];
        const up = K[at(x, y - 1)], lf = K[at(x - 1, y)], dn = K[at(x, y + 1)], rt = K[at(x + 1, y)];
        if (GS_DEPR.has(k)) {
          if ((up !== k && !GS_DEPR.has(up)) || (lf !== k && !GS_DEPR.has(lf))) l = 0;
          else if ((dn !== k && !GS_DEPR.has(dn)) || (rt !== k && !GS_DEPR.has(rt))) l = Math.min(2, l + 1);
        } else if (k === K_GRASS && l >= 0) {
          if (GS_DEPR.has(dn) || GS_DEPR.has(rt)) l = Math.max(0, l - 1);          // тень травы над ямкой
          else if (GS_DEPR.has(up) || GS_DEPR.has(lf)) l = Math.min(V.ramp.length - 1, l + 1);   // светлая кромка снизу-справа
          else if (up === K_GLADE || lf === K_GLADE) l = 0;
        } else if (k === K_GLADE) {
          if (up !== K_GLADE || lf !== K_GLADE) l = 3;
          else if (dn !== K_GLADE || rt !== K_GLADE) l = Math.max(0, l - 1);
        }
        C[i] = gsHexIdx(gsColor(V, k, l));
      }
      if ((y & 31) === 31) yield;
    }
  }
}
// Плитки нужны раньше полосы: первый вызов запускает постройку, остальные ждут (генератор общий)
function* gsEnsureBake(seed) {
  if (GS_BAKE.seed !== seed) { GS_BAKE.seed = seed; GS_BAKE.done = false; GS_BAKE.gen = gsBakeGen(seed); }
  while (!GS_BAKE.done) { if (GS_BAKE.gen.next().done) GS_BAKE.done = true; else yield; }
}
// Выгрузка при смене мира
function gsFree() { for (const V of GS_LIST()) V.bk = V.bl = V.bc = null; GS_BAKE.seed = -1; GS_BAKE.done = false; GS_BAKE.gen = null; GS_BAKE.rg = null; }

// Состояние куска земли W×H пикселей, лежащего в мире со смещением (ox, oy).
// pick(wx, wy, sd) — вид земли в точке; mask (необяз.) — где рисовать мелочь (1 = трава).
function gsMakeState(biomeKind, W, H, ox, oy, seed, mask) {
  return { biomeKind, W, H, ox, oy, seed, sd: seed * 131, mask: mask || null, K: new Uint8Array(W * H), L: new Int8Array(W * H), B: new Uint8Array(W * H), col: new Uint8Array(W * H) };
}
const GS_LIST = () => Object.keys(GROUND_VARIANTS).map(k => GROUND_VARIANTS[k]);
// База полосы: биом в каждой точке (шум биомов по сетке 8 px + билинейная интерполяция), цвет — из запечённой плитки вида.
// biomeKind — вид (для витрины одного вида) или 'world'. Генератор: отдаёт управление после каждой строки.
function* gsBaseGen(st) {
  yield* gsEnsureBake(st.seed);
  const { W, H, ox, oy, K, L, B, col, sd } = st, N = GS_PER, M = N - 1, rg = GS_BAKE.rg;
  const fixed = st.biomeKind !== 'world' ? st.biomeKind : null;
  const G = 8, gw = Math.ceil(W / G) + 2, gh = Math.ceil(H / G) + 2;
  let g1 = null, g2 = null;
  if (!fixed) {   // шум биомов по узлам сетки полосы
    g1 = new Float32Array(gw * gh); g2 = new Float32Array(gw * gh);
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const wx = ox + i * G, wy = oy + j * G; g1[j * gw + i] = gsFW(wx, wy, 150, sd + 101); g2[j * gw + i] = gsFW(wx, wy, 380, sd + 102); }
  }
  for (let y = 0; y < H; y++) {
    const wy = y + oy, ty = (wy & M) * N;
    let j = 0, fy = 0;
    if (!fixed) { j = (y / G) | 0; fy = (y - j * G) / G; }
    for (let x = 0; x < W; x++) {
      const wx = x + ox, t = ty + (wx & M), i = y * W + x;
      let V = fixed;
      if (!V) {
        const ii = (x / G) | 0, fx = (x - ii * G) / G, o = j * gw + ii;
        const a = g1[o], b = g1[o + 1], c = g1[o + gw], d = g1[o + gw + 1], top = a + (b - a) * fx, v = top + (c + (d - c) * fx - top) * fy;
        const a2 = g2[o], b2 = g2[o + 1], c2 = g2[o + gw], d2 = g2[o + gw + 1], top2 = a2 + (b2 - a2) * fx, v2 = top2 + (c2 + (d2 - c2) * fx - top2) * fy;
        const r = rg[t];
        V = gsBiomeOf(v + r, v2 + r);
      }
      K[i] = V.bk[t]; L[i] = V.bl[t]; B[i] = V.idx; col[i] = V.bc[t];
    }
    yield;
  }
}
// Мелочь: травинки, цветы, камни, грибы… Генератор по рядам клеток. D — RGBA того же размера W×H.
// tx0..tx1, ty0..ty1 — клетки мира; tileOk(tx, ty) — можно ли в клетке (по умолчанию да).
function* gsDecorGen(st, D, tx0, tx1, ty0, ty1, tileOk) {
  const { W, H, ox, oy, K, B, col, sd, seed, mask } = st, N = GS_PER, M = N - 1;
  const pickAt = (wx, wy) => st.biomeKind !== 'world' ? st.biomeKind : gsPick(wx, wy, sd);
  const tAt = (wx, wy) => (wy & M) * N + (wx & M);
  const S = {
    W, H,
    k(x, y) { x |= 0; y |= 0; return (x < 0 || y < 0 || x >= W || y >= H) ? pickAt(x + ox, y + oy).bk[tAt(x + ox, y + oy)] : K[y * W + x]; },
    put(x, y, hex) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return; const c = GS_HEXRGB[gsHexIdx(hex)], o = (y * W + x) * 4; D[o] = c[0]; D[o + 1] = c[1]; D[o + 2] = c[2]; },
    base(x, y) {
      x |= 0; y |= 0;
      if (x < 0 || y < 0 || x >= W || y >= H) { const V = pickAt(x + ox, y + oy); return GS_HEXLIST[V.bc[tAt(x + ox, y + oy)]]; }
      return GS_HEXLIST[col[y * W + x]];
    },
    grassAt(x, y) {
      x |= 0; y |= 0;
      if (mask && x >= 0 && y >= 0 && x < W && y < H && !mask[y * W + x]) return false;
      const k = S.k(x, y); return k === K_GRASS || k === K_GLADE || k === K_CLOVER || k === K_MOSS;
    },
    shade(hex, d) { for (const rp of GS_RAMPS) { const i = rp.indexOf(hex); if (i >= 0) return rp[Math.max(0, Math.min(rp.length - 1, i + d))]; } return hex; },
    // --- мелочи ---
    tufts(r, p, maxN, dry) {
      const n = r() < p ? 1 + (r() * maxN | 0) : 0;
      for (let q = 0; q < n; q++) {
        const x = S.cx + 2 + (r() * 27 | 0), y = S.cy + 6 + (r() * 23 | 0);
        if (!S.grassAt(x, y)) continue;
        const b = S.base(x, y), lo = dry ? '#7a7038' : S.shade(b, -2), mid = dry ? '#c0ae5c' : S.shade(b, 1), hi = dry ? '#ddd08a' : S.shade(b, 3);
        const nb = 3 + (r() * 3 | 0);
        S.put(x + 1, y + 1, S.shade(b, -3));
        for (let i = 0; i < nb; i++) {
          const bx = x + i - (nb >> 1), h = 2 + (r() * 3 | 0), lean = r() < 0.4 ? -1 : r() < 0.5 ? 1 : 0;
          for (let j = 0; j < h; j++) S.put(bx + (j >= h - 1 ? lean : 0), y - j, j === h - 1 ? hi : j === 0 ? lo : mid);
        }
      }
    },
    flower(x, y, c) {
      if (!S.grassAt(x, y)) return;
      const lo = '#2f4a26', st = '#3a5a2a';
      S.put(x, y + 1, lo); S.put(x, y, st); S.put(x - 1, y, st);
      S.put(x, y - 1, st);
      S.put(x, y - 2, '#fff2a0');
      S.put(x - 1, y - 2, c); S.put(x + 1, y - 2, c); S.put(x, y - 3, c); S.put(x, y - 1, c);
    },
    flowerPatch(r, p, colors, nmin, nmax) {
      if (r() >= p) return;
      const c = colors[r() * colors.length | 0], fx = S.cx + 5 + r() * 22, fy = S.cy + 8 + r() * 18, n = nmin + (r() * (nmax - nmin + 1) | 0);
      for (let i = 0; i < n; i++) S.flower(fx + (r() - 0.5) * 11, fy + (r() - 0.5) * 8, r() < 0.2 ? colors[r() * colors.length | 0] : c);
    },
    daisies(r, p) {
      if (r() >= p) return;
      const n = 1 + (r() * 3 | 0);
      for (let i = 0; i < n; i++) {
        const x = S.cx + 3 + (r() * 26 | 0), y = S.cy + 4 + (r() * 24 | 0);
        if (!S.grassAt(x, y)) continue;
        S.put(x - 1, y, '#f6f2ea'); S.put(x + 1, y, '#f6f2ea'); S.put(x, y - 1, '#f6f2ea'); S.put(x, y + 1, '#cec6ba'); S.put(x, y, '#f6d458');
      }
    },
    clover(r, p) {
      if (r() >= p) return;
      const n = 2 + (r() * 4 | 0);
      for (let i = 0; i < n; i++) {
        const x = S.cx + 3 + (r() * 26 | 0), y = S.cy + 4 + (r() * 24 | 0);
        if (!S.grassAt(x, y)) continue;
        const b = S.base(x, y), hi = S.shade(b, 2), lo = S.shade(b, -2);
        S.put(x - 1, y, hi); S.put(x, y, hi); S.put(x + 1, y, hi); S.put(x, y - 1, hi); S.put(x - 1, y - 1, lo); S.put(x + 1, y - 1, lo); S.put(x, y + 1, lo);
        if (r() < 0.25) { S.put(x, y - 2, '#f6f2ea'); S.put(x + 1, y - 2, '#eeaab2'); }
      }
    },
    ferns(r, p) {
      if (r() >= p) return;
      const x = S.cx + 5 + (r() * 22 | 0), y = S.cy + 8 + (r() * 20 | 0);
      if (!S.grassAt(x, y)) return;
      const b = S.base(x, y), hi = S.shade(b, 3), md = S.shade(b, 1), lo = S.shade(b, -2);
      for (const dir of [-1, 0, 1]) {
        const len = dir === 0 ? 6 : 5;
        for (let j = 0; j < len; j++) {
          const bx = x + dir * Math.round(j * 0.7) + (dir ? 0 : 0), by = y - j + (dir ? Math.round(j * 0.25 * Math.abs(dir)) : 0);
          S.put(bx, by, j > len - 3 ? hi : md);
          if (j > 0 && j < len - 1) { S.put(bx - 1, by + 1, lo); S.put(bx + 1, by + 1, lo); if (j % 2) { S.put(bx - 1, by, md); S.put(bx + 1, by, md); } }
        }
      }
      S.put(x, y + 1, lo);
    },
    mushrooms(r, p) {
      if (r() >= p) return;
      const n = 1 + (r() * 2 | 0), x0 = S.cx + 5 + r() * 22, y0 = S.cy + 8 + r() * 18;
      for (let i = 0; i < n; i++) {
        const x = (x0 + i * 5) | 0, y = (y0 + (r() * 3 | 0)) | 0;
        if (!S.grassAt(x, y)) continue;
        S.put(x, y, '#e4ddd2'); S.put(x, y - 1, '#cec6ba'); S.put(x + 1, y, '#9e958a'); S.put(x + 1, y + 1, S.shade(S.base(x, y), -3));
        const cap = r() < 0.7 ? ['#c8583a', '#8c2c20', '#f6f2ea'] : ['#b8804e', '#875434', '#e0b882'];
        for (let dx = -1; dx <= 1; dx++) S.put(x + dx, y - 2, cap[0]);
        S.put(x - 2, y - 2 + 1 - 1, cap[1]); S.put(x + 2, y - 2, cap[1]); S.put(x - 1, y - 3, cap[0]); S.put(x, y - 3, cap[0]); S.put(x + 1, y - 3, cap[1]);
        S.put(x - 1, y - 2, cap[2]);
      }
    },
    pebbles(r, p) {
      const n = r() < p ? 1 + (r() * 2 | 0) : 0;
      for (let i = 0; i < n; i++) {
        const x = S.cx + 3 + (r() * 26 | 0), y = S.cy + 4 + (r() * 24 | 0), w = 2 + (r() * 3 | 0);
        S.put(x + w, y + 1, S.shade(S.base(x, y), -3));
        for (let dx = 0; dx < w; dx++) { S.put(x + dx, y, dx === 0 ? '#cec6ba' : '#9e958a'); S.put(x + dx + 0, y + 1, dx === w - 1 ? '#4a4540' : '#706960'); }
        S.put(x - 0, y - 1, '#b6ada0'); if (w > 2) S.put(x + 1, y - 1, '#9e958a');
      }
    },
    boulders(r, p, moss) {
      if (r() >= p) return;
      const w = 7 + (r() * 5 | 0), h = 4 + (r() * 3 | 0), x0 = S.cx + 4 + (r() * 16 | 0), y0 = S.cy + 8 + (r() * 16 | 0);
      if (!S.grassAt(x0, y0)) return;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const nx = (x - (w - 1) / 2) / (w / 2), ny = (y - (h - 1) / 2) / (h / 2);
        if (nx * nx + ny * ny > 1.05) continue;
        const lit = 0.5 - nx * 0.45 - ny * 0.55;   // свет сверху-слева
        let c = lit > 0.78 ? '#b6ada0' : lit > 0.55 ? '#9e958a' : lit > 0.3 ? '#706960' : lit > 0.1 ? '#5c564f' : '#3a3632';
        if (moss && ny < -0.15 && gsHash(x + x0, y + y0, 5) < 0.75) c = ny < -0.55 ? '#73963e' : '#4a6e30';
        S.put(x0 + x, y0 + y, c);
      }
      for (let x = 1; x < w; x++) S.put(x0 + x, y0 + h, '#243520');
      if (moss) { S.put(x0 + 1, y0 - 1, '#5c8236'); S.put(x0 + 2, y0 - 1, '#73963e'); }
    },
    stalks(r, p) {
      const n = r() < p ? 2 + (r() * 5 | 0) : 0;
      for (let i = 0; i < n; i++) {
        const x = S.cx + 2 + (r() * 28 | 0), y = S.cy + 7 + (r() * 22 | 0);
        if (S.k(x, y) !== K_GRASS) continue;
        const h = 6 + (r() * 5 | 0), lean = r() < 0.5 ? -1 : 1;
        for (let j = 0; j < h; j++) S.put(x + (j > h * 0.6 ? lean : 0), y - j, j === 0 ? '#57532a' : '#c0ae5c');
        S.put(x + lean, y - h, '#ddd08a'); S.put(x + lean, y - h - 1, '#c89226'); S.put(x + 2 * lean, y - h + 1, '#c0ae5c');
        S.put(x - lean, y - 3, '#9c8e48');
      }
    },
    thistles(r, p) {
      if (r() >= p) return;
      const x = S.cx + 5 + (r() * 22 | 0), y = S.cy + 9 + (r() * 18 | 0);
      if (S.k(x, y) !== K_GRASS) return;
      for (let j = 0; j < 5; j++) S.put(x, y - j, j ? '#4a6e30' : '#2f4a26');
      S.put(x - 1, y - 2, '#73963e'); S.put(x + 1, y - 3, '#73963e'); S.put(x - 1, y - 1, '#2f4a26');
      S.put(x - 1, y - 6, '#9c7ae6'); S.put(x, y - 6, '#7e58cc'); S.put(x + 1, y - 6, '#9c7ae6'); S.put(x, y - 5, '#4c3080'); S.put(x, y - 7, '#bea4f6');
    },
    cracks(r) {
      for (let q = 0; q < 6; q++) {
        let x = S.cx + (r() * 32 | 0), y = S.cy + (r() * 32 | 0);
        if (S.k(x, y) !== K_CRACK) continue;
        const len = 4 + (r() * 9 | 0);
        for (let j = 0; j < len; j++) {
          if (S.k(x, y) !== K_CRACK) break;
          S.put(x, y, '#341f14'); if (j % 3 === 0) S.put(x + 1, y + 1, '#a06840');
          const m = r(); if (m < 0.4) x++; else if (m < 0.7) y++; else if (m < 0.85) x--; else y--;
        }
      }
    },
    dirtBits(r, p) {
      for (let q = 0; q < 6; q++) {
        if (r() >= p) continue;
        const x = S.cx + (r() * 32 | 0), y = S.cy + (r() * 32 | 0), k = S.k(x, y);
        if (k !== K_PATH && k !== K_DIRT) continue;
        const m = r();
        if (m < 0.5) { S.put(x, y, '#cc9a64'); S.put(x + 1, y, '#b8804e'); S.put(x, y + 1, '#583522'); }       // камешек в земле
        else if (m < 0.8) { S.put(x, y, '#583522'); S.put(x + 1, y, '#583522'); }                                   // комочек
        else { S.put(x, y, '#9e958a'); S.put(x + 1, y, '#706960'); S.put(x, y - 1, '#b6ada0'); S.put(x + 1, y + 1, '#3a3632'); }  // серый кремень
      }
    },
    roots(r, p) {
      if (r() >= p) return;
      let x = S.cx + (r() * 32 | 0), y = S.cy + (r() * 32 | 0);
      if (S.k(x, y) !== K_DAMP) return;
      const len = 5 + (r() * 8 | 0), dir = r() < 0.5 ? 1 : -1;
      for (let j = 0; j < len; j++) {
        if (S.k(x, y) !== K_DAMP) break;
        S.put(x, y, '#6e432a'); S.put(x, y + 1, '#341f14'); S.put(x - dir, y - 1, j % 3 ? '#875434' : '#583522');
        x += dir; if (r() < 0.4) y += r() < 0.5 ? 1 : -1;
      }
    },
    // штрихи-травинки по всей земле: светлый пиксель над тёмным, цвета берутся с фона
    sprinkle(r, n) {
      for (let q = 0; q < n; q++) {
        const x = S.cx + (r() * 32 | 0), y = S.cy + 1 + (r() * 31 | 0), k = S.k(x, y);
        if (k === K_PATH || k === K_DIRT || k === K_CRACK || k === K_DAMP) continue;
        const b = S.base(x, y);
        S.put(x, y, S.shade(b, 2)); S.put(x, y + 1, S.shade(b, -2));
        if (r() < 0.35) S.put(x + 1, y - 1, S.shade(b, 1));
      }
    },
  };
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (tileOk && !tileOk(tx, ty)) continue;
      const r = mulberry32((((seed + 77) ^ Math.imul(ty * 4096 + tx + 1, 2654435761)) >>> 0));   // у каждой клетки свой генератор — рисунок один и тот же при любом порядке (кооп: по сиду)
      S.cx = tx * GS_TILE - ox; S.cy = ty * GS_TILE - oy;
      const V = pickAt(tx * GS_TILE + 16, ty * GS_TILE + 16);
      S.kc = () => S.k(S.cx + 16, S.cy + 16);
      S.sprinkle(r, V.ticks);
      V.decor(S, tx, ty, r);
    }
    yield;
  }
}

// Витрина: заплатка tw×th клеток одного вида (лист ground.html)
function groundPatch(id, tw, th, seed = 1) {
  const V = GROUND_VARIANTS[id], W = tw * GS_TILE, H = th * GS_TILE;
  const cv = mkCanvas(W, H), ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), D = img.data;
  const st = gsMakeState(V, W, H, 0, 0, seed);
  const bg = gsBaseGen(st); while (!bg.next().done);
  for (let i = 0; i < W * H; i++) { const c = GS_HEXRGB[st.col[i]]; D[i * 4] = c[0]; D[i * 4 + 1] = c[1]; D[i * 4 + 2] = c[2]; D[i * 4 + 3] = 255; }
  const dg = gsDecorGen(st, D, 0, tw - 1, 0, th - 1); while (!dg.next().done);
  ctx.putImageData(img, 0, 0);
  return cv;
}
// Карта биомов: заплатка из нескольких биомов (для листа и проверки)
function groundPatchBiomes(tw, th, seed = 1) {
  const W = tw * GS_TILE, H = th * GS_TILE;
  const cv = mkCanvas(W, H), ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), D = img.data;
  const st = gsMakeState('world', W, H, 0, 0, seed);
  const bg = gsBaseGen(st); while (!bg.next().done);
  for (let i = 0; i < W * H; i++) { const c = GS_HEXRGB[st.col[i]]; D[i * 4] = c[0]; D[i * 4 + 1] = c[1]; D[i * 4 + 2] = c[2]; D[i * 4 + 3] = 255; }
  const dg = gsDecorGen(st, D, 0, tw - 1, 0, th - 1); while (!dg.next().done);
  ctx.putImageData(img, 0, 0);
  return cv;
}
