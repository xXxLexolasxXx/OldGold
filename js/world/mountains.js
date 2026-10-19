'use strict';
// Горы и скалы в духе «Героев III»: не плоская серая заливка, а объёмные скальные
// массивы. Каждый — несколько граней: освещённая слева сверху, затенённая справа,
// между ними гребень; наслоения пород, трещины, зубцы вершины, мох на уступах,
// осыпь и валуны у подножия, тень на земле. Массивы ставятся по краям и в глубине
// скальных областей карты и рисуются вместе с остальными объектами по глубине:
// жители проходят перед горой, а вершины заслоняют то, что за ними.

const MT_SIZES = {
  S: { w: 78, h: 74, n: 4, k: 1, r: 1.35, base: 1.7 },
  M: { w: 118, h: 112, n: 6, k: 2, r: 2.1, base: 2.7 },
  L: { w: 160, h: 148, n: 8, k: 3, r: 2.8, base: 3.7 },
};
const MT_VARIANTS = 4;
const MT_PAL = [
  { lit: ['#e8d9b4', '#b9a884'], shade: ['#80745f', '#3a3228'], rim: '#fff2cc' },    // тёплый песчаник
  { lit: ['#dcd0b6', '#aaa088'], shade: ['#6c6a68', '#32303a'], rim: '#fff6dc' },    // серо-бурый
  { lit: ['#e4caa0', '#b48d62'], shade: ['#7c5c46', '#38281f'], rim: '#ffe6b8' },    // рыжеватый
  { lit: ['#d4d2c0', '#a2a08e'], shade: ['#66665e', '#2c2c2c'], rim: '#f4f4e4' },    // холодный гранит
];
const MT_SPR = {};
let MOUNTS = [];

function mtSprite(size, v) {
  const key = size + v;
  if (MT_SPR[key]) return MT_SPR[key];
  const S = MT_SIZES[size], P = MT_PAL[v % MT_PAL.length];
  const [cv, c] = mkSprite(S.w, S.h);
  const seed = 7000 + v * 97 + S.k * 13;
  srand = mulberry32(seed + 1);
  const base = S.h - 9, cx = S.w / 2;
  // тень на земле падает вправо-вниз
  for (let k = 0; k < 6; k++) {
    c.fillStyle = 'rgba(16,12,6,0.07)';
    c.beginPath(); c.ellipse(cx + S.w * 0.08, base + 3, S.w * 0.5 - k * 3, 8 - k, 0, 0, 7); c.fill();
  }
  // дальние отроги по бокам — меньше и тусклее
  if (S.k >= 2) {
    massif(c, P, cx - S.w * 0.3, base - 4, S.w * 0.52, S.h * 0.58, 4, seed + 11, 0.12);
    massif(c, P, cx + S.w * 0.3, base - 3, S.w * 0.46, S.h * 0.52, 4, seed + 12, 0.12);
  }
  massif(c, P, cx, base, S.w * 0.88, S.h - 12, S.n, seed, 0);
  // осыпь, валуны и трава у подножия
  for (let k = 0; k < S.w / 7; k++) {
    const x = cx + rnd(-S.w * 0.42, S.w * 0.42), y = base + rnd(-1, 4.5), r = rnd(0.8, 2.2);
    ellipse(c, x + 0.4, y + 0.5, r, r * 0.6, '#2c241a');
    ellipse(c, x, y, r, r * 0.62, srand() < 0.5 ? P.lit[1] : P.shade[0]);
    ellipse(c, x - r * 0.3, y - r * 0.25, r * 0.5, r * 0.3, P.lit[0]);
  }
  const nb = 2 + S.k;
  for (let k = 0; k < nb; k++) {
    const x = cx - S.w * 0.4 + (k + 0.5) / nb * S.w * 0.8 + rnd(-4, 4), y = base + rnd(0, 3.5);
    drawBoulder(c, x, y, rnd(4.5, 7 + S.k * 1.5), rnd(3.4, 5 + S.k));
  }
  for (let k = 0; k < S.w / 8; k++) tuftPebbles(c, rnd(cx - S.w * 0.46, cx + S.w * 0.46), base + rnd(0, 5), rnd(3, 6));
  grain(cv, 0.08, seed);
  const out = toPixelArt(cv, SS, { outline: true, outlineDark: 0.12, alphaCut: 100 });
  MT_SPR[key] = out;
  return out;
}

// Один скальный массив: силуэт, грани, пласты, трещины, мох
function massif(c, P, cx, base, w, h, n, seed, haze) {
  const r = mulberry32(seed), rr = (a, b) => a + r() * (b - a);
  const hw = w / 2, peakX = cx + rr(-w * 0.1, w * 0.1), peakY = base - h;
  const lerp = (a, b, t) => a + (b - a) * t;
  // силуэт: зубчатые склоны с уступами, сужающиеся к вершине
  const left = [], right = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n, e = Math.pow(t, 0.82);
    const jx = k && k < n ? rr(-w * 0.035, w * 0.035) : 0, jy = k && k < n ? rr(-h * 0.04, h * 0.04) : 0;
    left.push([lerp(cx - hw, peakX, t) + jx + (k % 2 ? -w * 0.025 : 0), lerp(base, peakY, e) + jy]);
    const t2 = k / n, e2 = Math.pow(t2, 0.95);
    right.push([lerp(cx + hw, peakX, t2) - jx * 0.8 + (k % 2 ? w * 0.02 : 0), lerp(base, peakY, e2) - jy * 0.8]);
  }
  left[n] = right[n] = [peakX, peakY];
  const sil = [...left, ...right.slice(0, n).reverse(), [cx + hw + 2, base + 3], [cx - hw - 2, base + 3]];
  c.save();
  c.beginPath(); c.moveTo(sil[0][0], sil[0][1]); for (const p of sil) c.lineTo(p[0], p[1]); c.closePath();
  c.clip();
  // освещённая грань
  c.fillStyle = lingrad(c, cx - hw, peakY, cx + hw * 0.4, base, [[0, P.lit[0]], [1, P.lit[1]]]);
  c.fillRect(cx - hw - 4, peakY - 4, w + 8, h + 12);
  // теневая грань справа от гребня
  const ridge = [[peakX, peakY]];
  for (let k = 1; k <= 4; k++) { const t = k / 4; ridge.push([peakX + w * rr(0.02, 0.15) * t + rr(-3, 3), peakY + (base - peakY) * t]); }
  const shadePoly = [...ridge, [cx + hw + 12, base + 12], [cx + hw + 12, peakY - 12], [peakX, peakY - 12]];
  c.fillStyle = lingrad(c, peakX, peakY, cx + hw, base, [[0, P.shade[0]], [1, P.shade[1]]]);
  c.beginPath(); c.moveTo(shadePoly[0][0], shadePoly[0][1]); for (const p of shadePoly) c.lineTo(p[0], p[1]); c.closePath(); c.fill();
  // вторичные рёбра: в освещённой части — светлая полоса и тёмная складка, в тени — тонкие блики
  const creases = Math.max(3, n);
  for (let k = 0; k < creases; k++) {
    const onLeft = k % 3 !== 2;
    const src = onLeft ? left : right;
    const i = 1 + Math.floor(r() * (n - 1));
    const [sx, sy] = src[i];
    const ex = sx + (onLeft ? rr(-w * 0.02, w * 0.14) : rr(-w * 0.1, w * 0.04)), ey = base + 6;
    const bw = rr(w * 0.04, w * 0.1);
    c.fillStyle = onLeft ? 'rgba(255,244,214,0.2)' : 'rgba(255,230,190,0.07)';
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.lineTo(ex + bw, ey); c.lineTo(sx + bw * 0.5, sy + 3); c.closePath(); c.fill();
    c.fillStyle = onLeft ? 'rgba(40,28,16,0.3)' : 'rgba(10,8,12,0.28)';
    c.beginPath(); c.moveTo(sx + bw * 0.5, sy + 3); c.lineTo(ex + bw, ey); c.lineTo(ex + bw + bw * 0.45, ey); c.lineTo(sx + bw * 0.9, sy + 5); c.closePath(); c.fill();
  }
  // пласты породы: изогнутые полосы поперёк
  for (let y = peakY + h * 0.18; y < base; y += rr(5.5, 8.5)) {
    const ph = rr(0, 6);
    c.strokeStyle = 'rgba(36,26,14,0.2)'; c.lineWidth = 0.8;
    c.beginPath();
    for (let x = cx - hw - 4; x <= cx + hw + 4; x += 6) { const yy = y + Math.sin(x * 0.09 + ph) * 1.6 + (x - peakX) * 0.04; x === cx - hw - 4 ? c.moveTo(x, yy) : c.lineTo(x, yy); }
    c.stroke();
    c.strokeStyle = 'rgba(255,244,214,0.09)'; c.lineWidth = 0.6;
    c.beginPath();
    for (let x = cx - hw - 4; x <= cx + hw + 4; x += 6) { const yy = y + 1.2 + Math.sin(x * 0.09 + ph) * 1.6 + (x - peakX) * 0.04; x === cx - hw - 4 ? c.moveTo(x, yy) : c.lineTo(x, yy); }
    c.stroke();
  }
  // трещины
  for (let k = 0; k < n; k++) {
    let x = rr(cx - hw * 0.7, cx + hw * 0.5), y = rr(peakY + h * 0.25, base - h * 0.2);
    c.strokeStyle = 'rgba(24,17,9,0.55)'; c.lineWidth = 0.6;
    c.beginPath(); c.moveTo(x, y);
    for (let s = 0; s < 4; s++) { x += rr(-2.5, 2.5); y += rr(2, 5); c.lineTo(x, y); }
    c.stroke();
  }
  // зерно камня
  for (let k = 0; k < w * h / 55; k++) {
    c.fillStyle = r() < 0.5 ? 'rgba(255,246,222,0.2)' : 'rgba(26,18,10,0.2)';
    c.fillRect(rr(cx - hw, cx + hw), rr(peakY, base), 0.7, 0.7);
  }
  // затенение у земли и блик по левому краю вершины
  c.fillStyle = lingrad(c, 0, base - h * 0.22, 0, base + 3, [[0, 'rgba(20,14,8,0)'], [1, 'rgba(20,14,8,0.5)']]);
  c.fillRect(cx - hw - 4, base - h * 0.22, w + 8, h * 0.22 + 6);
  if (haze) { c.fillStyle = `rgba(80,96,120,${haze})`; c.fillRect(cx - hw - 4, peakY - 4, w + 8, h + 10); }
  c.restore();
  // кромка света по левому склону и тёмная по правому
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.strokeStyle = P.rim; c.globalAlpha = 0.65 - (haze ? 0.3 : 0); c.lineWidth = 1.1;
  c.beginPath(); left.forEach(([x, y], i) => (i ? c.lineTo(x + 0.5, y + 0.5) : c.moveTo(x + 0.5, y + 0.5))); c.stroke();
  c.globalAlpha = 1;
  c.strokeStyle = 'rgba(18,12,6,0.7)'; c.lineWidth = 0.8;
  c.beginPath(); right.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
  // мох и кустики на уступах нижней трети
  if (!haze) {
    for (let k = 0; k < n * 2; k++) {
      const x = rr(cx - hw * 0.75, cx + hw * 0.75), y = rr(base - h * 0.24, base - 3), rx = rr(2, 5);
      ellipse(c, x + 0.4, y + 0.6, rx, rx * 0.5, '#2c441a');
      ellipse(c, x, y, rx * 0.9, rx * 0.46, GMOSS[(r() * 4) | 0]);
      ellipse(c, x - rx * 0.25, y - rx * 0.2, rx * 0.4, rx * 0.2, '#98b84a');
    }
  }
}

// ---------- Расстановка по карте ----------

function buildMountains(seed) {
  MOUNTS = [];
  const rng = mulberry32((seed ^ 0x7a11) >>> 0);
  const rock = (x, y) => inb(x, y) && World.terrain[idx(x, y)] === T_ROCK;
  const cands = [];
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (!rock(x, y)) continue;
    let d = 0;
    for (let yy = -2; yy <= 2; yy++) for (let xx = -2; xx <= 2; xx++) if (rock(x + xx, y + yy)) d++;
    cands.push({ x, y, d, r: rng() });
  }
  // с юга на север: сначала передний край, потом задние ряды
  cands.sort((a, b) => b.y - a.y || a.r - b.r);
  for (const t of cands) {
    const size = t.d >= 21 ? 'L' : t.d >= 12 ? 'M' : 'S';
    const S = MT_SIZES[size];
    const px = (t.x + 0.5) * TILE + (rng() - 0.5) * 12, py = (t.y + 1) * TILE - 3 + (rng() - 0.5) * 8;
    let ok = true;
    for (const m of MOUNTS) {
      const dx = (m.x - px) / TILE, dy = (m.y - py) / TILE * 1.4;
      const lim = Math.max(S.r, MT_SIZES[m.size].r) * 0.92;
      if (dx * dx + dy * dy < lim * lim) { ok = false; break; }
    }
    if (ok) MOUNTS.push({ x: px, y: py, size, v: (rng() * MT_VARIANTS) | 0 });
  }
  MOUNTS.sort((a, b) => a.y - b.y);
  for (const m of MOUNTS) mtSprite(m.size, m.v);
}

function drawMountain(c, m) {
  const S = MT_SIZES[m.size], spr = mtSprite(m.size, m.v);
  c.drawImage(spr, Math.round(m.x - S.w / 2), Math.round(m.y - (S.h - 9)), S.w, S.h);
}

// кристаллы на скале рисуются поверх гор — они нужны для постройки шахты
function drawCrystalTile(c, x, y, i) {
  const r = mulberry32(i * 31 + 7), px = x * TILE, py = y * TILE;
  drawCrystalCluster(c, px + 16, py + 26, r);
  if (r() < 0.7) drawCrystalCluster(c, px + 8 + r() * 16, py + 14, r);
}
