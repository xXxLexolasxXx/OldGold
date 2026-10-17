'use strict';
// Камни в духе «Героев III»: не серые комки, а нарисованные скальные глыбы из
// нескольких валунов — грани, освещённые сверху-слева, трещины, мох и лишайник,
// трава у подножия и галька вокруг. Глыбы крупнее клетки и сдвинуты, поэтому
// соседние сливаются в россыпь. По мере добычи глыба уменьшается (три размера),
// от ударов кирки на ней проступают трещины.

const ROCK_VARIANTS = 6;
const ROCK_SIZES = {
  L: { w: 56, h: 46, chunks: [[0, -11, 16, 13], [-12, -4, 10, 8], [12, -3, 9, 7.5], [3, 1, 6, 4.5]] },
  M: { w: 44, h: 36, chunks: [[-2, -8, 12, 10], [9, -2, 7.5, 6], [-10, 0, 5, 4]] },
  S: { w: 32, h: 24, chunks: [[-4, -4, 6.5, 5.5], [5, -2, 5, 4], [-1, 2, 3, 2.4]] },
};
const ROCK_COL = { light: '#dccaa4', base: '#988870', mid: '#736655', dark: '#43392e', deep: '#231c15' };
const ROCK_SPR = {};

function rockSprite(size, variant) {
  const key = size + variant;
  if (ROCK_SPR[key]) return ROCK_SPR[key];
  const S = ROCK_SIZES[size], K = 2;                 // рисуем вдвое подробнее, чем клетка мира
  const cv = mkCanvas(S.w * K, S.h * K);
  const c = cv.getContext('2d');
  c.scale(K, K);
  c.lineJoin = 'round'; c.lineCap = 'round';
  srand = mulberry32(4100 + variant * 131 + size.charCodeAt(0) * 7);
  const cx = S.w / 2, by = S.h - 6;
  // мягкая тень-подложка
  for (let k = 0; k < 6; k++) {
    c.fillStyle = `rgba(18,14,8,${0.07})`;
    c.beginPath(); c.ellipse(cx + 2, by + 1, S.w * 0.42 - k * 1.6, 5 - k * 0.5, 0, 0, 7); c.fill();
  }
  // валуны: от дальних к ближним
  const chunks = S.chunks.map(([dx, dy, rx, ry]) => [cx + dx + rnd(-2, 2), by + dy + rnd(-1, 1), rx * rnd(0.88, 1.1), ry * rnd(0.88, 1.1)]);
  chunks.sort((a, b) => a[1] - b[1]);
  for (const ch of chunks) drawBoulder(c, ...ch);
  // трава и галька у подножия
  for (let k = 0; k < (size === 'S' ? 4 : 8); k++) {
    const x = cx + rnd(-S.w * 0.4, S.w * 0.4), y = by + rnd(-1, 2.5);
    tuftHoMM(c, x, y, rnd(2.5, 4.5));
  }
  for (let k = 0; k < (size === 'S' ? 4 : 7); k++) {
    const x = cx + rnd(-S.w * 0.45, S.w * 0.45), y = by + rnd(0, 3.5), r = rnd(0.8, 1.8);
    ellipse(c, x + 0.3, y + 0.4, r, r * 0.65, ROCK_COL.deep);
    ellipse(c, x, y, r, r * 0.65, srand() < 0.5 ? ROCK_COL.mid : ROCK_COL.base);
    ellipse(c, x - r * 0.3, y - r * 0.25, r * 0.45, r * 0.3, ROCK_COL.light);
  }
  ROCK_SPR[key] = cv;
  return cv;
}

// Один валун: неровный многогранник, свет сверху-слева, ребро делит его на светлую и теневую грани
function drawBoulder(c, x, y, rx, ry) {
  const n = 10, pts = [];
  const a0 = rnd(0, 0.6);
  for (let k = 0; k < n; k++) {
    const a = a0 + k / n * Math.PI * 2;
    const r = rnd(0.78, 1.04);
    let px = x + Math.cos(a) * rx * r, py = y + Math.sin(a) * ry * r;
    if (py > y + ry * 0.45) py = y + ry * 0.45 + (py - y - ry * 0.45) * 0.25;   // плоское основание
    if (py < y) py -= ry * 0.18 * (1 - Math.abs(Math.cos(a)));                    // приподнятая макушка
    pts.push([px, py]);
  }
  // тень от валуна на земле
  c.fillStyle = 'rgba(20,15,8,0.35)';
  c.beginPath(); c.ellipse(x + rx * 0.25, y + ry * 0.48, rx * 1.02, ry * 0.32, 0, 0, 7); c.fill();
  poly(c, pts, lingrad(c, x - rx, y - ry, x + rx, y + ry, [[0, ROCK_COL.light], [0.38, ROCK_COL.base], [0.75, ROCK_COL.mid], [1, ROCK_COL.dark]]));
  clipPoly(c, pts, () => {
    // ребро от макушки вниз — правая грань в тени
    const peak = pts.reduce((m, p) => (p[1] < m[1] ? p : m), pts[0]);
    const rx0 = peak[0] + rnd(-1, 2);
    c.fillStyle = 'rgba(34,24,14,0.42)';
    c.beginPath(); c.moveTo(rx0, peak[1] - 2);
    c.lineTo(rx0 + rx * 0.25, y + ry * 0.1); c.lineTo(rx0 + rx * 0.15, y + ry); c.lineTo(x + rx * 1.3, y + ry); c.lineTo(x + rx * 1.3, peak[1] - 3);
    c.closePath(); c.fill();
    // светлая верхняя площадка
    c.fillStyle = 'rgba(255,246,220,0.22)';
    c.beginPath(); c.ellipse(x - rx * 0.25, y - ry * 0.55, rx * 0.6, ry * 0.32, -0.25, 0, 7); c.fill();
    // зернистость камня
    for (let k = 0; k < rx * ry * 0.5; k++) {
      const px = x + rnd(-rx, rx), py = y + rnd(-ry, ry);
      c.fillStyle = srand() < 0.5 ? 'rgba(255,248,230,0.25)' : 'rgba(30,22,14,0.22)';
      c.fillRect(px, py, 0.6, 0.6);
    }
    // трещины: тёмная щель и светлый край под ней
    for (let k = 0; k < (rx > 8 ? 3 : 1); k++) {
      let px = x + rnd(-rx * 0.6, rx * 0.5), py = y + rnd(-ry * 0.6, 0);
      c.beginPath(); c.moveTo(px, py);
      const seg = [];
      for (let s = 0; s < 3; s++) { px += rnd(-2, 3); py += rnd(1.5, 3.5); seg.push([px, py]); c.lineTo(px, py); }
      c.strokeStyle = 'rgba(30,22,14,0.75)'; c.lineWidth = 0.6; c.stroke();
      c.beginPath(); c.moveTo(seg[0][0] + 0.5, seg[0][1] + 0.5); for (const [sx, sy] of seg) c.lineTo(sx + 0.5, sy + 0.5);
      c.strokeStyle = 'rgba(255,240,210,0.3)'; c.lineWidth = 0.4; c.stroke();
    }
    // затенение у земли
    c.fillStyle = lingrad(c, 0, y + ry * 0.05, 0, y + ry * 0.6, [[0, 'rgba(30,22,14,0)'], [1, 'rgba(30,22,14,0.45)']]);
    c.fillRect(x - rx * 1.3, y - ry, rx * 2.6, ry * 2);
  });
  // контур и светлый кант сверху-слева
  c.strokeStyle = ROCK_COL.deep; c.lineWidth = 0.7;
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts) c.lineTo(p[0], p[1]); c.closePath(); c.stroke();
  c.strokeStyle = 'rgba(255,248,228,0.6)'; c.lineWidth = 0.5;
  c.beginPath();
  let started = false;
  for (const [px, py] of pts) {
    if (px < x + rx * 0.2 && py < y + ry * 0.1) { if (!started) { c.moveTo(px + 0.4, py + 0.4); started = true; } else c.lineTo(px + 0.4, py + 0.4); }
  }
  c.stroke();
  // мох на макушке и пятна лишайника
  if (rx > 6 && srand() < 0.45) {
    const mx = x - rx * rnd(0.1, 0.4), my = y - ry * rnd(0.5, 0.75);
    for (let k = 0; k < 5; k++) {
      const ex = mx + rnd(-rx * 0.35, rx * 0.35), ey = my + rnd(-1, 1.2), r = rnd(1.2, 2.4);
      ellipse(c, ex + 0.3, ey + 0.5, r, r * 0.55, '#33461a');
      ellipse(c, ex, ey, r * 0.9, r * 0.5, srand() < 0.5 ? '#5a7428' : '#6e8a30');
    }
  }
  for (let k = 0; k < rx * 0.6; k++) {
    c.fillStyle = srand() < 0.6 ? 'rgba(214,190,90,0.7)' : 'rgba(200,120,60,0.6)';
    c.beginPath(); c.arc(x + rnd(-rx * 0.7, rx * 0.5), y + rnd(-ry * 0.5, ry * 0.2), rnd(0.4, 0.9), 0, 7); c.fill();
  }
}

// пучок травы, как на картах «Героев»: несколько изогнутых травинок с тёмным низом
function tuftHoMM(c, x, y, h) {
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + rnd(-0.7, 0.7);
    c.strokeStyle = k < 2 ? '#3a5a18' : srand() < 0.5 ? '#6a9a2c' : '#8ab83a';
    c.lineWidth = 0.7;
    c.beginPath(); c.moveTo(x + rnd(-1, 1), y);
    c.quadraticCurveTo(x + Math.cos(a) * h * 0.5, y + Math.sin(a) * h * 0.6, x + Math.cos(a) * h, y + Math.sin(a) * h);
    c.stroke();
  }
}

function rockSizeOf(n) { return n >= 5 ? 'L' : n >= 3 ? 'M' : 'S'; }

function drawRock(c, x, y, o, i) {
  const h = hash(i);
  // не сеткой: у каждой клетки свой масштаб, сдвиг и иногда размер на ступень меньше
  let size = rockSizeOf(o.n);
  if (((h >>> 17) % 3) === 0) size = size === 'L' ? 'M' : 'S';
  const S = ROCK_SIZES[size];
  const spr = rockSprite(size, h % ROCK_VARIANTS);
  const sc = 0.82 + ((h >>> 21) % 30) / 100;
  let bx = x * TILE + 16 + ((h >>> 5) % 15) - 7, by = y * TILE + 26 + ((h >>> 9) % 11) - 5;
  if (o.hitT && Game.time - o.hitT < 0.18) bx += (Math.floor(Game.time * 60) & 1) ? 1 : -1;   // вздрагивает от удара
  const flip = (h >>> 13) & 1;
  c.save();
  c.imageSmoothingEnabled = true;
  c.translate(Math.round(bx), Math.round(by));
  c.scale(flip ? -sc : sc, sc);
  c.drawImage(spr, -S.w / 2, -(S.h - 6), S.w, S.h);
  c.restore();
  c.imageSmoothingEnabled = R.smooth;
  // свежие трещины от кирки
  if (o.dmg > 0) {
    const r = mulberry32(i * 7 + o.n);
    c.strokeStyle = 'rgba(28,20,12,0.85)'; c.lineWidth = 0.8;
    const n = 1 + Math.floor(o.dmg * 4);
    for (let k = 0; k < n; k++) {
      let px = bx + (r() - 0.5) * S.w * 0.4, py = by - S.h * 0.45 + r() * 6;
      c.beginPath(); c.moveTo(px, py);
      for (let s = 0; s < 2 + o.dmg * 3; s++) { px += (r() - 0.5) * 5; py += 1.5 + r() * 2.5; c.lineTo(px, py); }
      c.stroke();
    }
  }
}

// ---------- Удары кирки ----------

// отложенные эффекты (момент удара внутри замаха)
function fxLater(dt, fn) { (Game.fxTimers = Game.fxTimers || []).push({ at: Game.time + dt, fn }); }
function fxTimersTick() {
  const t = Game.fxTimers;
  if (!t || !t.length) return;
  const due = t.filter(x => Game.time >= x.at);
  if (!due.length) return;
  Game.fxTimers = t.filter(x => Game.time < x.at);
  for (const x of due) x.fn();
}

// кирка бьёт в камень: искры, осколки, пыль; камень вздрагивает и трескается
function rockHit(tx, ty, o, u, last) {
  if (World.obj[idx(tx, ty)] !== o) return;
  o.hitT = Game.time;
  o.dmg = Math.min(1, (o.dmg || 0) + 0.22);
  const hx = (u.x + (tx + 0.5 - u.x) * 0.55) * TILE, hy = (u.y + (ty + 0.5 - u.y) * 0.55) * TILE - 6;
  fxBurst(hx, hy, last ? 10 : 6, ['#fff6c0', '#ffd860', '#ffb040'], 110, 50, 0.3, 1.1, 320);            // искры
  fxBurst(hx, hy, last ? 14 : 5, [ROCK_COL.base, ROCK_COL.mid, ROCK_COL.light, ROCK_COL.dark], 70, 60, 0.75, last ? 2.6 : 1.8, 300);   // осколки
  fxBurst(hx, hy + 4, last ? 8 : 3, ['rgba(200,186,160,0.55)', 'rgba(170,156,130,0.5)'], 18, 14, 1.1, 3.5, -12);  // пыль
  if (last) { floater(tx + 0.5, ty - 0.2, 'Крак!', '#e8dcc0'); sfxAt('thud', tx * TILE, ty * TILE, 0.8); }
}
