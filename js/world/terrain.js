'use strict';
// Попиксельная отрисовка земли: рельеф с освещением, плавные переходы между
// травой, песком, водой и скалами, мелкий декор. Дороги — отдельный слой поверх.

const TEX = 512;

// Бесшовная value-noise текстура TEX×TEX, значения 0..1.
function makeTex(seed, freq, octaves) {
  const rng = mulberry32(seed);
  const out = new Float32Array(TEX * TEX);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const f = freq << o;
    const grid = new Float32Array(f * f);
    for (let i = 0; i < grid.length; i++) grid[i] = rng();
    const k = f / TEX;
    for (let y = 0; y < TEX; y++) {
      const gy = y * k, iy = gy | 0;
      let ty = gy - iy; ty = ty * ty * (3 - 2 * ty);
      const y0 = (iy % f) * f, y1 = ((iy + 1) % f) * f;
      for (let x = 0; x < TEX; x++) {
        const gx = x * k, ix = gx | 0;
        let tx = gx - ix; tx = tx * tx * (3 - 2 * tx);
        const x0 = ix % f, x1 = (ix + 1) % f;
        const a = grid[y0 + x0], b = grid[y0 + x1], c = grid[y1 + x0], d = grid[y1 + x1];
        const top = a + (b - a) * tx, bot = c + (d - c) * tx;
        out[y * TEX + x] += (top + (bot - top) * ty) * amp;
      }
    }
    total += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

// Земля — полосы холста по TBAND рядов клеток (одним куском карта 160×120 = 5120×3840 не влезла бы в iOS и съела бы 80 МБ дважды).
// Дороги — такие же полосы, но создаются лишь там, где дорога есть. Рисуются только полосы в кадре.
const TBAND = 8;
const TERR = { bands: [], rb: [], mini: null, ready: false, lazy: false, make: null, stash: [], restoring: [], gen: 0 };

function terrFree() {
  TERR.gen++; TERR.stash = []; TERR.restoring = [];
  TERR.job = null;   // недостроенные полосы прежнего мира больше не нужны
  // прежние холсты (новая игра, загрузка) отпускаем сразу: на iOS/Android память холстов освобождается не по GC
  for (const b of TERR.bands) if (b) b.cv.width = b.cv.height = 0;
  for (const b of TERR.rb) if (b) b.cv.width = b.cv.height = 0;
  TERR.bands = []; TERR.rb = [];
  if (TERR.mini) { TERR.mini.width = TERR.mini.height = 0; TERR.mini = null; }
}

// Земля и дороги в кадре: cam — {x,y}, vw/vh — размер кадра в мировых пикселях
function terrDraw(c, cam, vw, vh) {
  const n = Math.max(TERR.bands.length, TERR.job ? TERR.job.done.length : 0), BH = TBAND * TILE;
  for (let i = 0; i < n; i++) {
    if (i * BH + BH < cam.y - 2 || i * BH > cam.y + vh + 2) continue;
    if (!TERR.bands[i]) terrRunBand(i);   // полоса в кадре, а её ещё не успели построить — достраиваем сейчас
    const b = TERR.bands[i];
    if (!b) continue;
    c.drawImage(b.cv, 0, b.y0);
    const r = TERR.rb[i];
    if (r) c.drawImage(r.cv, 0, r.y0);
  }
}
function terrCanvasMB() {
  let px = 0;
  for (const b of TERR.bands) if (b) px += b.cv.width * b.cv.height;
  for (const b of TERR.rb) if (b) px += b.cv.width * b.cv.height;
  if (TERR.mini) px += TERR.mini.width * TERR.mini.height;
  return px * 4 / 1048576;
}

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function blurGrid(g, w, h, passes) {
  let src = g, dst = new Float32Array(g.length);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        s += src[yy * w + xx]; n++;
      }
      dst[y * w + x] = s / n;
    }
    [src, dst] = [dst, src];
  }
  return src;
}

// Поле по углам клеток: доля клеток данного типа среди четырёх соседних.
function cornerField(test) {
  const W = MAP_W + 1, H = MAP_H + 1;
  const f = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let s = 0;
    for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 0; dx++) {
      const tx = Math.min(MAP_W - 1, Math.max(0, x + dx)), ty = Math.min(MAP_H - 1, Math.max(0, y + dy));
      if (test(World.terrain[idx(tx, ty)])) s++;
    }
    f[y * W + x] = s / 4;
  }
  return f;
}

// Постепенная постройка земли. Раньше вся карта (≈20 млн пикселей) считалась одним куском при запуске:
// 2–4 с на ПК и до 25 с на слабом телефоне висел неподвижный экран загрузки. Теперь каждая полоса —
// генератор, который отдаёт управление после каждой строки пикселей; пока открыто меню (или идёт игра),
// полосы достраиваются по ~4 мс за кадр, начиная с ближайших к камере, а полоса, попавшая в кадр, — сразу.
function terrRunBand(bi) {
  const j = TERR.job;
  if (!j || TERR.bands[bi]) return;
  if (TERR.lazy && j.done[bi] && terrRestore(bi)) return;   // выгруженная полоса лежит сжатой — распаковывается за пару кадров
  if (j.done[bi]) { if (!TERR.lazy) return; j.done[bi] = false; j.gens[bi] = null; }   // экономный режим: полоса была выгружена — строим заново
  const g = j.gens[bi] || (j.gens[bi] = j.make(bi));
  while (!g.next().done);
  terrBandDone(j, bi);
}
function terrBandDone(j, bi) {
  if (j.done[bi]) return;
  j.done[bi] = true; j.gens[bi] = null;
  if (--j.left <= 0 && TERR.job === j && !TERR.lazy) TERR.job = null;
}
// Полосы кадра: [первая, последняя] с запасом m полос; нужны, чтобы в экономном режиме держать в памяти только их
function terrWindow(m) {
  const BH = TBAND * TILE;
  if (typeof R === 'undefined' || !R.cam || !R.canvas || !R.canvas.clientHeight) return [0, 1e9];
  const vh = R.canvas.clientHeight / camScale();
  return [Math.floor(R.cam.y / BH) - m, Math.floor((R.cam.y + vh) / BH) + m];
}
// Выгрузка полосы: рисунок сжимается в PNG (≈1 МБ вместо 5 МБ холста) — вернуть его дешевле, чем считать заново
function terrFreeBand(i, stash) {
  const b = TERR.bands[i], r = TERR.rb[i];
  if (b) {
    if (stash && b.cv.toBlob) { const g = TERR.gen; b.cv.toBlob(bl => { if (bl && g === TERR.gen) TERR.stash[i] = bl; }, 'image/png'); }
    b.cv.width = b.cv.height = 0;
  }
  if (r) r.cv.width = r.cv.height = 0;
  TERR.bands[i] = null; TERR.rb[i] = null;
}
function terrRestore(i) {
  const bl = TERR.stash[i];
  if (!bl || typeof createImageBitmap !== 'function') return false;
  if (TERR.restoring[i]) return true;
  TERR.restoring[i] = true;
  const g = TERR.gen;
  createImageBitmap(bl).then(bm => {
    if (g !== TERR.gen) { bm.close(); return; }
    const y0 = i * TBAND * TILE, bh = (Math.min(MAP_H, (i + 1) * TBAND) - i * TBAND) * TILE;
    const cv = mkCanvas(MAP_W * TILE, bh);
    cv.getContext('2d').drawImage(bm, 0, 0); bm.close();
    TERR.bands[i] = { cv, y0, h: bh };
    for (let y = i * TBAND; y < Math.min(MAP_H, (i + 1) * TBAND); y++) for (let x = 0; x < MAP_W; x++) drawRoadTile(x, y);
    TERR.restoring[i] = false;
  }, () => { TERR.restoring[i] = false; TERR.stash[i] = null; });
  return true;
}
// Экономный режим (слабый телефон, нехватка памяти): земля карты 160×120 — это 80 МБ холстов и столько же дорог,
// поэтому в памяти остаются полосы кадра ±1, остальные выгружаются и строятся заново, когда камера подходит
function terrSetLazy(on) {
  if (TERR.lazy === !!on) return;
  TERR.lazy = !!on;
  if (!TERR.ready || !TERR.make) return;
  const n = TERR.bands.length;
  if (!TERR.job) TERR.job = { make: TERR.make, gens: new Array(n).fill(null), done: new Array(n).fill(true), left: 0 };
  const j = TERR.job;
  if (!on) for (let i = 0; i < n; i++) if (!TERR.bands[i] && j.done[i]) { j.done[i] = false; j.gens[i] = null; j.left++; }   // обычный режим: возвращаем выгруженные полосы
  terrKick();
}
function terrStep(budget) {
  const j = TERR.job;
  if (!j) return;
  const t0 = performance.now();
  if (TERR.lazy) {      // выгружаем то, что ушло из кадра больше чем на 2 полосы
    const [w0, w1] = terrWindow(2);
    for (let i = 0; i < j.done.length; i++) if (TERR.bands[i] && (i < w0 || i > w1)) { terrFreeBand(i, true); j.done[i] = true; j.gens[i] = null; }
  }
  const [v0, v1] = TERR.lazy ? terrWindow(1) : [0, 1e9];
  let cb = 0;
  if (typeof R !== 'undefined' && R.cam && R.canvas && R.canvas.clientHeight) cb = Math.floor((R.cam.y + R.canvas.clientHeight / camScale() / 2) / (TBAND * TILE));
  const want = i => (!j.done[i] || (TERR.lazy && !TERR.bands[i])) && (!TERR.lazy || !j.done[i] || (i >= v0 && i <= v1));
  while (TERR.job === j && performance.now() - t0 < budget) {
    let bi = -1, bd = 1e9;
    for (let i = 0; i < j.done.length; i++) if (want(i) && Math.abs(i - cb) < bd) { bd = Math.abs(i - cb); bi = i; }
    if (bi < 0) break;
    if (j.done[bi]) { if (terrRestore(bi)) break; j.done[bi] = false; j.gens[bi] = null; }
    const g = j.gens[bi] || (j.gens[bi] = j.make(bi));
    while (performance.now() - t0 < budget) if (g.next().done) { terrBandDone(j, bi); break; }
  }
}
function terrKick() {
  if (TERR.kick || typeof requestAnimationFrame !== 'function') return;
  TERR.kick = true;
  requestAnimationFrame(function tick() {
    if (!TERR.job) { TERR.kick = false; return; }
    terrStep(4);
    requestAnimationFrame(tick);
  });
}

function buildTerrain(seed) {
  terrFree();
  TERR.ready = false;
  biomeSpritesApply();   // деревья и валуны под биом карты
  TERR.lazy = (typeof perfWeakDevice === 'function' && perfWeakDevice()) || (typeof Fps !== 'undefined' && !!Fps.eco);
  const W = MAP_W + 1, H = MAP_H + 1;
  const tA = makeTex(seed + 1, 4, 4);    // крупные пятна
  const tB = makeTex(seed + 2, 128, 2);  // зерно
  const tC = makeTex(seed + 3, 16, 3);   // средние детали, края
  const tD = makeTex(seed + 4, 64, 2);   // травинки, трещины

  const fWater = cornerField(t => t === T_WATER);
  const fRock = cornerField(t => t === T_ROCK);
  const fSand = cornerField(t => t === T_SAND || t === T_WATER);
  const fDeep = blurGrid(fWater, W, H, 3);

  // Высоты: мягкие холмы, скалы поднимаются, вода опускается
  const hills = makeNoise(mulberry32(seed + 5), 10);
  let hgt = new Float32Array(W * H);
  const rockMass = blurGrid(fRock, W, H, 2);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    hgt[i] = hills(x, y) * 1.2 + rockMass[i] * 3.2 + fRock[i] * 1.2 - fDeep[i] * 0.8;
  }
  hgt = blurGrid(hgt, W, H, 1);

  // Освещение по углам (свет сверху-слева)
  const L = [-0.55, -0.7, 0.62], ll = Math.hypot(...L);
  const Lx = L[0] / ll, Ly = L[1] / ll, Lz = L[2] / ll;
  const light = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const hx0 = hgt[y * W + Math.max(0, x - 1)], hx1 = hgt[y * W + Math.min(W - 1, x + 1)];
    const hy0 = hgt[Math.max(0, y - 1) * W + x], hy1 = hgt[Math.min(H - 1, y + 1) * W + x];
    const nx = (hx0 - hx1) * 0.9, ny = (hy0 - hy1) * 0.9, nz = 1;
    const nl = Math.hypot(nx, ny, nz);
    const d = (nx * Lx + ny * Ly + nz * Lz) / nl;
    light[y * W + x] = Math.max(0.5, Math.min(1.45, 1 + (d - Lz) * 1.6));
  }

  const PW = MAP_W * TILE;
  const P = biomePal();   // цвета земли выбранного биома (луга — прежние)
  const iceW = !!P.ice;

  const bil = (f, i00, fx, fy) => {
    const a = f[i00], b = f[i00 + 1], c = f[i00 + W], d = f[i00 + W + 1];
    const top = a + (b - a) * fx, bot = c + (d - c) * fx;
    return top + (bot - top) * fy;
  };

  const nBands = Math.ceil(MAP_H / TBAND);
  TERR.mini = mkCanvas(MAP_W * 3, MAP_H * 3);
  const mctx = TERR.mini.getContext('2d');
  const bandGen = function* (bi) {
  const bty0 = bi * TBAND, bty1 = Math.min(MAP_H, bty0 + TBAND), y0px = bty0 * TILE, bh = (bty1 - bty0) * TILE;
  const GRASS = new Uint8Array(PW * bh);
  const cv = mkCanvas(PW, bh);
  const ctx = cv.getContext('2d');
  let img = ctx.createImageData(PW, bh);
  let D = img.data;
  for (let ty = bty0; ty < bty1; ty++) for (let py = 0; py < TILE; py++) {   // построчно: можно прерваться после каждой строки
    const fy = (py + 0.5) / TILE;
    const wy = ty * TILE + py;
    const rowT = (wy & (TEX - 1)) * TEX;
    for (let tx = 0; tx < MAP_W; tx++) {
      const c00 = ty * W + tx;
      for (let px = 0; px < TILE; px++) {
        const fx = (px + 0.5) / TILE;
        const wx = tx * TILE + px;
        const ti = rowT + (wx & (TEX - 1));
        const nA = tA[ti], nB = tB[ti], nC = tC[ti], nD = tD[ti];

        // трава
        const lush = smoothstep(0.3, 0.7, nA);
        // сочная «геройская» трава: насыщенная зелень с жёлтыми бликами
        let r = P.g0[0] + (P.g1[0] - P.g0[0]) * lush, g = P.g0[1] + (P.g1[1] - P.g0[1]) * lush, b = P.g0[2] + (P.g1[2] - P.g0[2]) * lush;
        const dry = smoothstep(0.62, 0.8, nC) * P.dryK;
        r += (P.dry[0] - r) * dry; g += (P.dry[1] - g) * dry; b += (P.dry[2] - b) * dry;
        const dark = smoothstep(0.35, 0.18, nC) * 0.4;
        r *= 1 - dark * 0.35; g *= 1 - dark * 0.25; b *= 1 - dark * 0.35;
        if (nD > 0.66) { const k = 0.78 + (1 - nD) * 0.4; r *= k; g *= k; b *= k; }
        else if (nD < 0.3) { r *= 1.08; g *= 1.1; b *= 1.04; }
        // пятна вытоптанной земли с тёмной каймой
        const dv = nA * 0.55 + nC * 0.45;
        const dirt = smoothstep(P.dirtT, P.dirtT + 0.03, dv);
        const rim = smoothstep(P.dirtT - 0.04, P.dirtT, dv) * (1 - dirt);
        if (rim > 0) { r *= 1 - rim * 0.35; g *= 1 - rim * 0.3; b *= 1 - rim * 0.35; }
        if (dirt > 0) {
          const dr = P.dirt[0] + nB * 24, dg = P.dirt[1] + nB * 20, db = P.dirt[2] + nB * 14;
          r += (dr - r) * dirt; g += (dg - g) * dirt; b += (db - b) * dirt;
        }
        let grassMask = 1 - dirt;

        // песок / берег
        const sandW = smoothstep(0.32, 0.55, bil(fSand, c00, fx, fy) + (nC - 0.5) * 0.35);
        if (sandW > 0) {
          const sr = P.sand[0] + (nA - 0.5) * 30, sg = P.sand[1] + (nA - 0.5) * 26, sb = P.sand[2] + (nA - 0.5) * 20;
          r += (sr - r) * sandW; g += (sg - g) * sandW; b += (sb - b) * sandW;
          grassMask *= 1 - sandW;
        }

        // скалы
        const rockF = bil(fRock, c00, fx, fy);
        const rockW = smoothstep(0.38, 0.6, rockF + (nC - 0.5) * 0.45);
        if (rockW > 0) {
          const base = 0.55 + nA * 0.45;
          let rr = 118 * base + 36, rg = 108 * base + 34, rb = 96 * base + 30;
          // рельеф камня: «бамп» по двум масштабам шума, свет сверху-слева
          const xl = (wx - 2) & (TEX - 1), xr = (wx + 2) & (TEX - 1);
          const yu = ((wy - 2) & (TEX - 1)) * TEX, yd = ((wy + 2) & (TEX - 1)) * TEX;
          const col = wx & (TEX - 1);
          const gx = (tC[rowT + xr] - tC[rowT + xl]) * 3 + (tD[rowT + xr] - tD[rowT + xl]) * 1.2;
          const gy = (tC[yd + col] - tC[yu + col]) * 3 + (tD[yd + col] - tD[yu + col]) * 1.2;
          const bump = Math.max(0.55, Math.min(1.5, 1 + (0.55 * gx + 0.7 * gy) * 2.2));
          rr *= bump * 0.8 * P.rk[0]; rg *= bump * 0.8 * P.rk[1]; rb *= bump * 0.8 * P.rk[2];     // под горами — тёмная скальная земля
          if (Math.abs(nD - 0.5) < 0.012 && nC > 0.5) { rr *= 0.6; rg *= 0.6; rb *= 0.6; }
          const moss = smoothstep(0.6, 0.75, nC) * (1 - smoothstep(0.6, 0.9, rockF)) * 0.5;
          rr += (P.moss[0] - rr) * moss; rg += (P.moss[1] - rg) * moss; rb += (P.moss[2] - rb) * moss;
          if (P.snow) { const sn = smoothstep(0.42, 0.62, nA * 0.5 + nC * 0.5) * 0.85; rr += (236 - rr) * sn; rg += (242 - rg) * sn; rb += (250 - rb) * sn; }   // снег лежит на уступах
          r += (rr - r) * rockW; g += (rg - g) * rockW; b += (rb - b) * rockW;
          grassMask *= 1 - rockW;
        }

        // освещение рельефа
        const li = bil(light, c00, fx, fy);
        if (P.snow) { const k = 1 + (li - 1) * 0.4; r *= k * (li < 1 ? 0.96 : 1); g *= k; b *= k * (li < 1 ? 1.05 : 1); }   // тени на снегу — голубоватые, а не серо-бурые
        else { r *= li; g *= li; b *= li; }

        // вода (поверх, без рельефного света)
        const waterF = bil(fWater, c00, fx, fy) + (nC - 0.5) * 0.28;
        const waterW = smoothstep(0.46, 0.56, waterF);
        if (waterW > 0) {
          grassMask *= 1 - waterW;
          const depth = smoothstep(0.45, 0.95, bil(fDeep, c00, fx, fy));
          let wr = P.w0[0] + (P.w1[0] - P.w0[0]) * depth, wg = P.w0[1] + (P.w1[1] - P.w0[1]) * depth, wb = P.w0[2] + (P.w1[2] - P.w0[2]) * depth;
          const wave = (nB - 0.5) * 14 + (nD > 0.7 ? 10 : 0);
          wr += wave * 0.6; wg += wave; wb += wave;
          if (iceW) {   // лёд: светлые блики и тёмные трещины
            if (Math.abs(nD - 0.5) < 0.014 || Math.abs(nC - 0.5) < 0.008) { wr *= 0.55; wg *= 0.62; wb *= 0.75; }
            else if (nA > 0.52 && nB > 0.6) { wr += 40; wg += 36; wb += 28; }
          }
          r += (wr - r) * waterW; g += (wg - g) * waterW; b += (wb - b) * waterW;
        }
        // пена у берега
        const foam = smoothstep(0.42, 0.5, waterF) * (1 - smoothstep(0.5, 0.6, waterF));
        if (foam > 0) {
          const k = foam * (0.45 + nB * 0.4);
          r += (P.foam[0] - r) * k * P.foamK; g += (P.foam[1] - g) * k * P.foamK; b += (P.foam[2] - b) * k * P.foamK;
        }

        // зерно
        const gr = P.snow ? 0.97 + nB * 0.06 : 0.93 + nB * 0.14;
        const o = ((wy - y0px) * PW + wx) * 4;
        D[o] = r * gr; D[o + 1] = g * gr; D[o + 2] = b * gr; D[o + 3] = 255;
        GRASS[(wy - y0px) * PW + wx] = grassMask > 0.9 ? 1 : 0;
      }
    }
    yield;   // строка пикселей (5120 px): на медленном телефоне это ~5 мс — кусок не должен выходить за бюджет кадра
  }
  yield* stampLeavesGen(D, PW, bh, seed + bi * 977, GRASS);
  ctx.putImageData(img, 0, 0);
  img = null; D = null;
  yield;
  // кусты и цветы соседних рядов заходят в полосу; у каждой клетки свой генератор — можно по ряду за раз
  for (let y = Math.max(0, bty0 - 1); y < Math.min(MAP_H, bty1 + 1); y++) {
    ctx.save(); ctx.translate(0, -y0px);
    bakeDecor(ctx, seed, y, y + 1);
    ctx.restore();
    yield;
  }
  // палитра и дизеринг — пиксельный вид (рисунок дизера зависит от координат: полоса кратна 4 пикселям)
  const q = ctx.getImageData(0, 0, PW, bh);
  for (let r0 = 0; r0 < bh; r0 += 4) {   // по 4 строки: рисунок дизера тот же, он считается от координат
    const rows = Math.min(4, bh - r0);
    quantizeData(q.data.subarray(r0 * PW * 4, (r0 + rows) * PW * 4), PW, rows, P.snow ? 3 : 9, 0, y0px + r0);   // снег — почти без дизеринга, иначе рябит
    yield;
  }
  ctx.putImageData(q, 0, 0);
  TERR.bands[bi] = { cv, y0: y0px, h: bh };
  mctx.drawImage(cv, 0, bty0 * 3, MAP_W * 3, (bty1 - bty0) * 3);
  if (TERR.lazy) { const [w0, w1] = terrWindow(1); if (bi < w0 || bi > w1) { terrFreeBand(bi, true); return; } }   // миникарта уже нарисована — полоса вне кадра не нужна
  for (let y = bty0; y < bty1; y++) for (let x = 0; x < MAP_W; x++) drawRoadTile(x, y);   // дороги этой полосы
  };
  buildMountains(seed);

  TERR.ready = true;
  TERR.bands = new Array(nBands).fill(null);
  TERR.make = bandGen;
  TERR.job = { make: bandGen, gens: new Array(nBands).fill(null), done: new Array(nBands).fill(false), left: nBands };
  terrKick();
}

// Мелкие «листовые» пучки травы, как в Stoneshard: светлый верх, тёмная тень снизу.
const LEAF_STAMPS = [
  [[1, 0, 1.32], [2, 0, 1.22], [0, 1, 1.15], [1, 1, 1.05], [2, 1, 1.0], [3, 1, 0.86], [1, 2, 0.68], [2, 2, 0.7]],
  [[0, 0, 1.28], [2, 0, 1.28], [0, 1, 1.05], [1, 1, 1.12], [2, 1, 0.92], [1, 2, 0.66]],
  [[0, 0, 1.25], [1, 0, 1.15], [0, 1, 0.95], [1, 1, 0.8], [0, 2, 0.68]],
  [[0, 0, 0.7], [1, 0, 0.74], [2, 0, 0.78], [1, 1, 0.82]],
  [[1, 0, 1.35], [0, 1, 1.18], [1, 1, 1.2], [2, 1, 1.1], [0, 2, 0.75], [1, 2, 0.72], [2, 2, 0.75]],
];

function stampLeaves(D, PW, PH, seed, GRASS) { const g = stampLeavesGen(D, PW, PH, seed, GRASS); while (!g.next().done); }
function* stampLeavesGen(D, PW, PH, seed, GRASS) {
  const r = mulberry32(seed + 31);
  const n = (PW * PH / 22) | 0;
  for (let k = 0; k < n; k++) {
    if ((k & 2047) === 2047) yield;
    const x = (r() * (PW - 4)) | 0, y = (r() * (PH - 3)) | 0;
    if (!GRASS[y * PW + x]) continue;
    const st = LEAF_STAMPS[(r() * LEAF_STAMPS.length) | 0];
    const tint = r() < 0.15 ? 1.08 : 1;
    for (const [dx, dy, f] of st) {
      const p = (y + dy) * PW + x + dx;
      if (!GRASS[p]) continue;
      const o = p * 4, ff = f * tint;
      D[o] = D[o] * ff; D[o + 1] = D[o + 1] * ff * (f > 1 ? 1.03 : 1); D[o + 2] = D[o + 2] * ff;
    }
  }
}

function drawCrystalCluster(c, x, y, r) {
  const n = 2 + (r() * 3 | 0);
  for (let k = 0; k < n; k++) {
    const cx = x + (r() - 0.5) * 14, s = 0.6 + r() * 0.7, h = 9 * s, w = 2.4 * s;
    c.fillStyle = 'rgba(30,16,50,0.45)';
    c.beginPath(); c.ellipse(cx + 2, y + 1, w + 2, 1.5, 0, 0, 7); c.fill();
    c.fillStyle = '#6440a8';
    c.beginPath(); c.moveTo(cx - w, y); c.lineTo(cx - w * 0.8, y - h * 0.7); c.lineTo(cx, y - h); c.lineTo(cx + w * 0.8, y - h * 0.7); c.lineTo(cx + w, y); c.closePath(); c.fill();
    c.fillStyle = '#bea4f6';
    c.beginPath(); c.moveTo(cx - w * 0.8, y - h * 0.7); c.lineTo(cx, y - h); c.lineTo(cx, y); c.lineTo(cx - w, y); c.closePath(); c.fill();
    c.fillStyle = '#e2d6ff'; c.fillRect(cx - 1, y - h * 0.8, 1, h * 0.4);
  }
}

// Кустики травы, цветы, камушки, камыш у воды — запекаются в землю.
function bakeDecor(c, seed, ya = 0, yb = MAP_H) {
  const P = biomePal(), bio = biomeDef(), swamp = MapOpt.biome === 'swamp';
  for (let y = ya; y < yb; y++) for (let x = 0; x < MAP_W; x++) {
    const r = mulberry32(((seed + 77) ^ Math.imul(y * MAP_W + x + 1, 2654435761)) >>> 0);   // у каждой клетки свой генератор — рисунок не зависит от порядка полос
    const t = World.terrain[idx(x, y)];
    const px = x * TILE, py = y * TILE;
    if (t === T_GRASS) {
      const tufts = r() < 0.55 ? 1 + (r() * 3 | 0) : 0;
      for (let k = 0; k < tufts; k++) drawTuft(c, px + 3 + r() * 26, py + 6 + r() * 24, r, P.tuft);
      const fl = r();
      if (fl < P.flower) {
        const col = P.flCols[r() * P.flCols.length | 0];
        const fx = px + 4 + r() * 22, fy = py + 4 + r() * 22;
        for (let k = 0; k < 4 + r() * 5; k++) {
          c.fillStyle = 'rgba(40,70,20,0.6)';
          const ax = fx + (r() - 0.5) * 9, ay = fy + (r() - 0.5) * 7;
          c.fillRect(ax, ay + 1, 1, 2);
          c.fillStyle = col;
          c.fillRect(ax - 0.5, ay - 0.5, 2, 2);
        }
      }
      if (r() < 0.05) drawPebble(c, px + 6 + r() * 20, py + 6 + r() * 20, 1.5 + r() * 2, r);
      if (swamp && r() < 0.22) drawReeds(c, px + 4 + r() * 24, py + 10 + r() * 18, r);   // камыш и рогоз на кочках
    } else if (t === T_SAND) {
      let nearWater = false;
      for (const [dx, dy] of DIRS) if (inb(x + dx, y + dy) && World.terrain[idx(x + dx, y + dy)] === T_WATER) nearWater = true;
      if (nearWater && r() < 0.5) {
        const rx = px + 4 + r() * 24, ry = py + 10 + r() * 18;
        for (let k = 0; k < 6; k++) {
          const sx = rx + (r() - 0.5) * 10, h = 6 + r() * 8;
          c.strokeStyle = k % 2 ? '#4a6a2a' : '#6a8a3a'; c.lineWidth = 1;
          c.beginPath(); c.moveTo(sx, ry); c.quadraticCurveTo(sx + 1, ry - h / 2, sx + (r() - 0.5) * 4, ry - h); c.stroke();
          if (r() < 0.3) { c.fillStyle = '#5a3a1e'; c.fillRect(sx - 1, ry - h - 3, 2, 4); }
        }
      }
      if (r() < 0.15) drawPebble(c, px + 6 + r() * 20, py + 6 + r() * 20, 1.2 + r() * 1.5, r);
    } else if (t === T_ROCK) {
      if (r() < 0.35) drawPebble(c, px + 6 + r() * 20, py + 6 + r() * 20, 2 + r() * 3, r);
      if (bio && r() < bio.ore && y + 1 < MAP_H && World.terrain[idx(x, y + 1)] !== T_ROCK) drawOre(c, px + 6 + r() * 20, py + 14 + r() * 14, r);   // жилы руды у подножия скал
      if (false && World.crystal[idx(x, y)]) {   // кристаллы рисуются объектами поверх гор (см. render)
        drawCrystalCluster(c, px + 16, py + 26, r);
        if (r() < 0.7) drawCrystalCluster(c, px + 8 + r() * 16, py + 14, r);
      }
    }
  }
}

function drawTuft(c, x, y, r, cols = ['rgba(46,78,22,0.85)', 'rgba(130,168,70,0.85)']) {
  const n = 4 + (r() * 4 | 0);
  for (let k = 0; k < n; k++) {
    const a = -Math.PI / 2 + (r() - 0.5) * 1.4, h = 3 + r() * 4;
    c.strokeStyle = r() < 0.5 ? cols[0] : cols[1];
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * h, y + Math.sin(a) * h); c.stroke();
  }
}

// Камыш с бурыми початками (болото)
function drawReeds(c, rx, ry, r) {
  for (let k = 0; k < 5; k++) {
    const sx = rx + (r() - 0.5) * 9, h = 6 + r() * 8;
    c.strokeStyle = k % 2 ? '#3e5a24' : '#587c32'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(sx, ry); c.quadraticCurveTo(sx + 1, ry - h / 2, sx + (r() - 0.5) * 4, ry - h); c.stroke();
    if (r() < 0.35) { c.fillStyle = '#5a3a1e'; c.fillRect(sx - 1, ry - h - 3, 2, 4); }
  }
}

// Самородки в скале: золото (жёлтые крапины) или железо (ржавые с блеском)
function drawOre(c, x, y, r) {
  const gold = r() < 0.55, n = 2 + (r() * 3 | 0);
  for (let k = 0; k < n; k++) {
    const ox = x + (r() - 0.5) * 8, oy = y + (r() - 0.5) * 5, s = 1 + r() * 1.4;
    c.fillStyle = gold ? '#a4701c' : '#5a3a2e'; c.fillRect(ox, oy + 1, s + 1, s);
    c.fillStyle = gold ? '#f6d458' : '#a06a52'; c.fillRect(ox, oy, s + 1, s);
    c.fillStyle = gold ? '#fff2a0' : '#d8b8a8'; c.fillRect(ox, oy, 1, 1);
  }
}

function drawPebble(c, x, y, s, r) {
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.beginPath(); c.ellipse(x + 1, y + 1, s * 1.2, s * 0.8, 0, 0, 7); c.fill();
  const v = 140 + r() * 50 | 0;
  c.fillStyle = `rgb(${v},${v - 4},${v - 10})`;
  c.beginPath(); c.ellipse(x, y, s * 1.2, s * 0.8, 0, 0, 7); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.35)';
  c.beginPath(); c.ellipse(x - s * 0.4, y - s * 0.3, s * 0.5, s * 0.3, 0, 0, 7); c.fill();
}

// ---------- Дороги ----------

function isRoadAt(x, y) { return inb(x, y) && World.road[idx(x, y)]; }

// Диагональные связки, проходящие через клетку: пары дорог, соседних только по
// диагонали (обе боковые клетки — не дорога). Лента идёт от центра к центру.
function diagBands(x, y) {
  const out = [];
  const diagOnly = (ax, ay, bx, by) => isRoadAt(ax, ay) && isRoadAt(bx, by) && !isRoadAt(ax, by) && !isRoadAt(bx, ay);
  for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    if (diagOnly(x, y, x + dx, y + dy)) out.push([x, y, x + dx, y + dy]);              // эта клетка — конец ленты
    if (diagOnly(x + dx, y, x, y + dy)) out.push([x + dx, y, x, y + dy]);    // лента идёт через угол клетки
  }
  return out;
}

// Многоугольник в текущий путь всегда по часовой стрелке — как круг и прямоугольники:
// иначе при заливке «нулевым правилом» пересечения вырезают дыры
function pathPolyCW(c, pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
  if (a < 0) pts = pts.slice().reverse();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath();
}

// Скосы на поворотах: в квадрате 2×2 три клетки дороги — значит, дорога поворачивает
// в угловой клетке; внутренний угол поворота заливаем треугольником под 45°.
// Скос задевает все четыре клетки квадрата, поэтому собираем их со всех квадратов вокруг.
function roadChamfers(x, y) {
  const out = [];
  for (let by = y - 1; by <= y; by++) for (let bx = x - 1; bx <= x; bx++) {
    const cells = [[bx, by], [bx + 1, by], [bx, by + 1], [bx + 1, by + 1]];
    const miss = cells.filter(([a, b]) => !isRoadAt(a, b));
    if (miss.length !== 1) continue;
    const [mx, my] = miss[0];
    const cxx = bx * 2 + 1 - mx, cyy = by * 2 + 1 - my;   // угловая клетка — напротив пустой
    out.push([cxx, cyy, Math.sign(mx - cxx), Math.sign(my - cyy)]);
  }
  return out;
}

// Восьмиугольник вместо круга: внешний угол поворота и тупик тоже скошены, а не скруглены
function octPath(c, cx, cy, w) {
  const k = w * 0.586;
  pathPolyCW(c, [[cx - w + k, cy - w], [cx + w - k, cy - w], [cx + w, cy - w + k], [cx + w, cy + w - k],
    [cx + w - k, cy + w], [cx - w + k, cy + w], [cx - w, cy + w - k], [cx - w, cy - w + k]]);
}

function roadShape(c, x, y, px, py, grow, bands, chamfers) {
  const cx = px + TILE / 2, cy = py + TILE / 2, w = 11.5 + grow;
  c.beginPath();
  for (const [ux, uy, sx, sy] of chamfers || []) {
    const qx = (ux + 0.5) * TILE + sx * w, qy = (uy + 0.5) * TILE + sy * w, k = 12 + grow;
    pathPolyCW(c, [[qx - sx * 1, qy - sy * 1], [qx + sx * k, qy - sy * 1], [qx - sx * 1, qy + sy * k]]);
  }
  if (World.road[idx(x, y)]) {
    octPath(c, cx, cy, w);
    if (isRoadAt(x - 1, y)) c.rect(px, cy - w, TILE / 2, w * 2);
    if (isRoadAt(x + 1, y)) c.rect(cx, cy - w, TILE / 2, w * 2);
    if (isRoadAt(x, y - 1)) c.rect(cx - w, py, w * 2, TILE / 2);
    if (isRoadAt(x, y + 1)) c.rect(cx - w, cy, w * 2, TILE / 2);
    // широкая дорога: заполняем углы между соседними полосами
    for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      if (isRoadAt(x + dx, y) && isRoadAt(x, y + dy) && isRoadAt(x + dx, y + dy))
        c.rect(dx > 0 ? cx : px, dy > 0 ? cy : py, TILE / 2, TILE / 2);
    }
  }
  // диагональ: повёрнутая полоса от центра одной клетки к центру другой
  for (const [ax, ay, bx, by] of bands) {
    const x0 = (ax + 0.5) * TILE, y0 = (ay + 0.5) * TILE, x1 = (bx + 0.5) * TILE, y1 = (by + 0.5) * TILE;
    const L = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / L * w, ny = (x1 - x0) / L * w;
    pathPolyCW(c, [[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]]);
  }
}

// Сглаженная маска дороги вокруг клетки: фигуры клетки и её соседей (3×3) рисуются в мировых координатах,
// размываются и обрезаются по порогу — выпуклые и вогнутые углы становятся круглыми, прямые края не сдвигаются.
// cobbles=true — внутри булыжник цвета мостовой; null — тёмный бордюр.
const ROAD_M = 10;
let roadScratch = null;
function roadMaskCanvas(x, y, grow, cobbles) {
  const S = TILE + ROAD_M * 2;
  if (!roadScratch) roadScratch = [mkCanvas(S, S), mkCanvas(S, S)];
  const [a, b] = roadScratch, ca = a.getContext('2d', { willReadFrequently: true }), cb = b.getContext('2d', { willReadFrequently: true });
  const ox = x * TILE - ROAD_M, oy = y * TILE - ROAD_M;
  ca.setTransform(1, 0, 0, 1, 0, 0); ca.clearRect(0, 0, S, S);
  ca.translate(-ox, -oy);
  for (let ny = y - 1; ny <= y + 1; ny++) for (let nx = x - 1; nx <= x + 1; nx++) {
    if (!inb(nx, ny)) continue;
    const bands = diagBands(nx, ny), chamf = roadChamfers(nx, ny);
    if (!World.road[idx(nx, ny)] && !bands.length && !chamf.length) continue;
    roadShape(ca, nx, ny, nx * TILE, ny * TILE, grow, bands, chamf);
    ca.fillStyle = '#000'; ca.fill();
  }
  ca.setTransform(1, 0, 0, 1, 0, 0);
  cb.setTransform(1, 0, 0, 1, 0, 0); cb.clearRect(0, 0, S, S);
  cb.filter = 'blur(3.5px)'; cb.drawImage(a, 0, 0); cb.filter = 'none';
  const img = cb.getImageData(0, 0, S, S), d = img.data, col = cobbles ? [74, 69, 64] : [40, 34, 28];
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] >= 128) { d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = cobbles ? 255 : 140; } else d[i + 3] = 0;
  }
  cb.putImageData(img, 0, 0);
  if (cobbles) {
    ca.clearRect(0, 0, S, S);
    ca.save(); ca.translate(-ox, -oy); paveCobbles(ca, ox, oy, S, S, 1); ca.restore();
    ca.globalCompositeOperation = 'destination-in'; ca.drawImage(b, 0, 0); ca.globalCompositeOperation = 'source-over';
    return a;
  }
  return b;
}

function drawRoadTile(x, y) {
  if (!TERR.ready) return;
  const px = x * TILE, py = y * TILE, bi = Math.floor(y / TBAND);
  if (!TERR.bands[bi]) return;   // полоса ещё строится — её дороги нарисуются, когда она будет готова
  const bands = diagBands(x, y), chamf = roadChamfers(x, y);
  const has = World.road[idx(x, y)] || bands.length || chamf.length;
  let rb = TERR.rb[bi];
  if (!rb) {
    if (!has) return;
    const b = TERR.bands[bi];
    rb = TERR.rb[bi] = { cv: mkCanvas(b.cv.width, b.h), y0: b.y0 };
  }
  const c = rb.cv.getContext('2d', { willReadFrequently: true }), ly = py - rb.y0;
  c.save(); c.translate(0, -rb.y0);   // рисуем в мировых координатах: булыжник и фаски без швов между полосами
  c.clearRect(px, py, TILE, TILE);
  if (!has) { c.restore(); return; }
  const r = mulberry32(idx(x, y) * 131 + 7);
  // бордюр из тёмного камня и сплошная мостовая; контуры сглажены (см. roadMaskCanvas): повороты и диагональные стыки скруглены
  c.save();
  c.beginPath(); c.rect(px, py, TILE, TILE); c.clip();
  void r;
  c.drawImage(roadMaskCanvas(x, y, 2, null), px - ROAD_M, py - ROAD_M);
  c.drawImage(roadMaskCanvas(x, y, 0, true), px - ROAD_M, py - ROAD_M);
  c.restore();
  c.restore();
  // пиксельный вид: жёсткий край и палитра
  const img = c.getImageData(px, ly, TILE, TILE);
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 100 ? 255 : 0;
  quantizeData(d, TILE, TILE, 8, px, py);
  c.putImageData(img, px, ly);
}

// Булыжная мостовая в мировых координатах — без швов между клетками.
// part (0..1) — сколько рядов уже уложено сверху вниз (для анимации укладки).
function paveCobbles(c, x0, y0, w, h, part = 1) {
  const RH = 5, CW = 6;
  const yLim = y0 + h * part;
  for (let ry = Math.floor(y0 / RH); ry * RH < y0 + h; ry++) {
    const y = ry * RH;
    if (y > yLim) break;
    const off = (ry & 1) * (CW / 2);
    for (let cx = Math.floor((x0 - off) / CW) - 1; cx * CW + off < x0 + w; cx++) {
      const x = cx * CW + off;
      const hsh = Math.imul(cx * 73856093 ^ ry * 19349663, 2654435761) >>> 0;
      const v = 128 + (hsh % 46), wj = (hsh >> 8) % 3 * 0.4;
      const warm = (hsh >> 12) % 5 === 0 ? 10 : 0;
      c.fillStyle = `rgb(${v + warm},${v - 3},${v - 10 - warm})`;
      rrect(c, x + 0.6, y + 0.6, CW - 1.2 - wj, RH - 1.2, 1.6); c.fill();
      c.fillStyle = 'rgba(255,250,235,0.32)'; c.fillRect(x + 1.4, y + 0.9, CW - 3.4 - wj, 0.8);
      c.fillStyle = 'rgba(20,16,12,0.35)'; c.fillRect(x + 1.2, y + RH - 1.5, CW - 2.6 - wj, 0.7);
      if ((hsh >> 16) % 23 === 0) { c.fillStyle = 'rgba(80,110,40,0.7)'; c.fillRect(x - 0.4, y + RH - 1.2, 1.4, 1); }   // травинка в шве
    }
  }
}

function redrawTilesAround(x, y) {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
    if (inb(x + dx, y + dy)) drawRoadTile(x + dx, y + dy);
}
