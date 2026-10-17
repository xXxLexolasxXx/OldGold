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

const TERR = { canvas: null, roads: null, rctx: null, mini: null, ready: false };

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

function buildTerrain(seed) {
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

  const PW = MAP_W * TILE, PH = MAP_H * TILE;
  const GRASS = new Uint8Array(PW * PH);
  const cv = mkCanvas(PW, PH);
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(PW, PH);
  const D = img.data;

  const bil = (f, i00, fx, fy) => {
    const a = f[i00], b = f[i00 + 1], c = f[i00 + W], d = f[i00 + W + 1];
    const top = a + (b - a) * fx, bot = c + (d - c) * fx;
    return top + (bot - top) * fy;
  };

  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
    const c00 = ty * W + tx;
    for (let py = 0; py < TILE; py++) {
      const fy = (py + 0.5) / TILE;
      const wy = ty * TILE + py;
      const rowT = (wy & (TEX - 1)) * TEX;
      for (let px = 0; px < TILE; px++) {
        const fx = (px + 0.5) / TILE;
        const wx = tx * TILE + px;
        const ti = rowT + (wx & (TEX - 1));
        const nA = tA[ti], nB = tB[ti], nC = tC[ti], nD = tD[ti];

        // трава
        const lush = smoothstep(0.3, 0.7, nA);
        // сочная «геройская» трава: насыщенная зелень с жёлтыми бликами
        let r = 58 + (98 - 58) * lush, g = 110 + (160 - 110) * lush, b = 24 + (40 - 24) * lush;
        const dry = smoothstep(0.62, 0.8, nC) * 0.35;
        r += (150 - r) * dry; g += (152 - g) * dry; b += (56 - b) * dry;
        const dark = smoothstep(0.35, 0.18, nC) * 0.4;
        r *= 1 - dark * 0.35; g *= 1 - dark * 0.25; b *= 1 - dark * 0.35;
        if (nD > 0.66) { const k = 0.78 + (1 - nD) * 0.4; r *= k; g *= k; b *= k; }
        else if (nD < 0.3) { r *= 1.08; g *= 1.1; b *= 1.04; }
        // пятна вытоптанной земли с тёмной каймой
        const dv = nA * 0.55 + nC * 0.45;
        const dirt = smoothstep(0.66, 0.69, dv);
        const rim = smoothstep(0.62, 0.66, dv) * (1 - dirt);
        if (rim > 0) { r *= 1 - rim * 0.35; g *= 1 - rim * 0.3; b *= 1 - rim * 0.35; }
        if (dirt > 0) {
          const dr = 98 + nB * 24, dg = 84 + nB * 20, db = 58 + nB * 14;
          r += (dr - r) * dirt; g += (dg - g) * dirt; b += (db - b) * dirt;
        }
        let grassMask = 1 - dirt;

        // песок / берег
        const sandW = smoothstep(0.32, 0.55, bil(fSand, c00, fx, fy) + (nC - 0.5) * 0.35);
        if (sandW > 0) {
          const sr = 196 + (nA - 0.5) * 30, sg = 172 + (nA - 0.5) * 26, sb = 118 + (nA - 0.5) * 20;
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
          rr *= bump * 0.8; rg *= bump * 0.8; rb *= bump * 0.8;     // под горами — тёмная скальная земля
          if (Math.abs(nD - 0.5) < 0.012 && nC > 0.5) { rr *= 0.6; rg *= 0.6; rb *= 0.6; }
          const moss = smoothstep(0.6, 0.75, nC) * (1 - smoothstep(0.6, 0.9, rockF)) * 0.5;
          rr += (80 - rr) * moss; rg += (100 - rg) * moss; rb += (50 - rb) * moss;
          r += (rr - r) * rockW; g += (rg - g) * rockW; b += (rb - b) * rockW;
          grassMask *= 1 - rockW;
        }

        // освещение рельефа
        const li = bil(light, c00, fx, fy);
        r *= li; g *= li; b *= li;

        // вода (поверх, без рельефного света)
        const waterF = bil(fWater, c00, fx, fy) + (nC - 0.5) * 0.28;
        const waterW = smoothstep(0.46, 0.56, waterF);
        if (waterW > 0) {
          grassMask *= 1 - waterW;
          const depth = smoothstep(0.45, 0.95, bil(fDeep, c00, fx, fy));
          let wr = 64 + (24 - 64) * depth, wg = 128 + (68 - 128) * depth, wb = 138 + (112 - 138) * depth;
          const wave = (nB - 0.5) * 14 + (nD > 0.7 ? 10 : 0);
          wr += wave * 0.6; wg += wave; wb += wave;
          r += (wr - r) * waterW; g += (wg - g) * waterW; b += (wb - b) * waterW;
        }
        // пена у берега
        const foam = smoothstep(0.42, 0.5, waterF) * (1 - smoothstep(0.5, 0.6, waterF));
        if (foam > 0) {
          const k = foam * (0.45 + nB * 0.4);
          r += (235 - r) * k; g += (242 - g) * k; b += (240 - b) * k;
        }

        // зерно
        const gr = 0.93 + nB * 0.14;
        const o = (wy * PW + wx) * 4;
        D[o] = r * gr; D[o + 1] = g * gr; D[o + 2] = b * gr; D[o + 3] = 255;
        GRASS[wy * PW + wx] = grassMask > 0.9 ? 1 : 0;
      }
    }
  }
  stampLeaves(D, PW, PH, seed, GRASS);
  ctx.putImageData(img, 0, 0);
  bakeDecor(ctx, seed);
  // палитра и дизеринг — пиксельный вид
  const q = ctx.getImageData(0, 0, PW, PH);
  quantizeData(q.data, PW, PH, 9);
  ctx.putImageData(q, 0, 0);
  TERR.canvas = cv;
  buildMountains(seed);

  TERR.roads = mkCanvas(PW, PH);
  TERR.rctx = TERR.roads.getContext('2d');
  TERR.ready = true;
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) drawRoadTile(x, y);

  TERR.mini = mkCanvas(MAP_W * 3, MAP_H * 3);
  TERR.mini.getContext('2d').drawImage(cv, 0, 0, MAP_W * 3, MAP_H * 3);
}

// Мелкие «листовые» пучки травы, как в Stoneshard: светлый верх, тёмная тень снизу.
const LEAF_STAMPS = [
  [[1, 0, 1.32], [2, 0, 1.22], [0, 1, 1.15], [1, 1, 1.05], [2, 1, 1.0], [3, 1, 0.86], [1, 2, 0.68], [2, 2, 0.7]],
  [[0, 0, 1.28], [2, 0, 1.28], [0, 1, 1.05], [1, 1, 1.12], [2, 1, 0.92], [1, 2, 0.66]],
  [[0, 0, 1.25], [1, 0, 1.15], [0, 1, 0.95], [1, 1, 0.8], [0, 2, 0.68]],
  [[0, 0, 0.7], [1, 0, 0.74], [2, 0, 0.78], [1, 1, 0.82]],
  [[1, 0, 1.35], [0, 1, 1.18], [1, 1, 1.2], [2, 1, 1.1], [0, 2, 0.75], [1, 2, 0.72], [2, 2, 0.75]],
];

function stampLeaves(D, PW, PH, seed, GRASS) {
  const r = mulberry32(seed + 31);
  const n = (PW * PH / 22) | 0;
  for (let k = 0; k < n; k++) {
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
function bakeDecor(c, seed) {
  const r = mulberry32(seed + 77);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const t = World.terrain[idx(x, y)];
    const px = x * TILE, py = y * TILE;
    if (t === T_GRASS) {
      const tufts = r() < 0.55 ? 1 + (r() * 3 | 0) : 0;
      for (let k = 0; k < tufts; k++) drawTuft(c, px + 3 + r() * 26, py + 6 + r() * 24, r);
      if (r() < 0.12) {
        const col = ['#f4e46a', '#f2f2f6', '#d47cc8', '#e86a4a', '#8ab4f0'][r() * 5 | 0];
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
      if (false && World.crystal[idx(x, y)]) {   // кристаллы рисуются объектами поверх гор (см. render)
        drawCrystalCluster(c, px + 16, py + 26, r);
        if (r() < 0.7) drawCrystalCluster(c, px + 8 + r() * 16, py + 14, r);
      }
    }
  }
}

function drawTuft(c, x, y, r) {
  const n = 4 + (r() * 4 | 0);
  for (let k = 0; k < n; k++) {
    const a = -Math.PI / 2 + (r() - 0.5) * 1.4, h = 3 + r() * 4;
    c.strokeStyle = r() < 0.5 ? 'rgba(46,78,22,0.85)' : 'rgba(130,168,70,0.85)';
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * h, y + Math.sin(a) * h); c.stroke();
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

function roadShape(c, x, y, px, py, grow, bands) {
  const cx = px + TILE / 2, cy = py + TILE / 2, w = 11.5 + grow;
  c.beginPath();
  if (World.road[idx(x, y)]) {
    c.arc(cx, cy, w, 0, Math.PI * 2);
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
    c.moveTo(x0 + nx, y0 + ny); c.lineTo(x1 + nx, y1 + ny); c.lineTo(x1 - nx, y1 - ny); c.lineTo(x0 - nx, y0 - ny); c.closePath();
  }
}

function drawRoadTile(x, y) {
  if (!TERR.ready) return;
  const c = TERR.rctx, px = x * TILE, py = y * TILE;
  c.clearRect(px, py, TILE, TILE);
  const bands = diagBands(x, y);
  if (!World.road[idx(x, y)] && !bands.length) return;
  const r = mulberry32(idx(x, y) * 131 + 7);
  c.save();
  c.beginPath(); c.rect(px, py, TILE, TILE); c.clip();
  void r;
  // бордюр из тёмного камня и сплошная мостовая
  roadShape(c, x, y, px, py, 2, bands);
  c.fillStyle = 'rgba(40,34,28,0.55)'; c.fill();
  roadShape(c, x, y, px, py, 0, bands);
  c.fillStyle = '#4a4540'; c.fill();
  roadShape(c, x, y, px, py, 0, bands);
  c.clip();
  paveCobbles(c, px - 4, py - 4, TILE + 8, TILE + 8, 1);
  c.restore();
  // пиксельный вид: жёсткий край и палитра
  const img = c.getImageData(px, py, TILE, TILE);
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 100 ? 255 : 0;
  quantizeData(d, TILE, TILE, 8, px, py);
  c.putImageData(img, px, py);
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
