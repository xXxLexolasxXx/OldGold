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
const ROCK_K = 2;                                   // рисуем вдвое подробнее клетки мира

function rockSprite(size, variant, body = false) {
  const key = size + variant + (body ? "B" : "");   // B — одна большая глыба: тело ходячего камня
  if (ROCK_SPR[key]) return ROCK_SPR[key];
  const S = ROCK_SIZES[size], K = 2;                 // рисуем вдвое подробнее, чем клетка мира
  let cv = mkCanvas(S.w * K, S.h * K);
  const c = cv.getContext('2d');
  c.scale(K, K);
  c.lineJoin = 'round'; c.lineCap = 'round';
  srand = mulberry32(4100 + variant * 131 + size.charCodeAt(0) * 7);
  const cx = S.w / 2, by = S.h - 6;
  // валуны: от дальних к ближним
  let chunks = S.chunks.map(([dx, dy, rx, ry]) => [cx + dx + rnd(-2, 2), by + dy + rnd(-1, 1), rx * rnd(0.88, 1.1), ry * rnd(0.88, 1.1)]);
  if (body) chunks = chunks.slice(0, 1);
  chunks.sort((a, b) => a[1] - b[1]);
  for (const ch of chunks) drawBoulder(c, ...ch, false);
  if (body) { cv = rockPixels(cv, S, rockShadow(S, cx, by, chunks)); ROCK_SPR[key] = cv; return cv; }
  // трава и галька у подножия
  for (let k = 0; k < (size === 'S' ? 4 : 8); k++) {
    const x = cx + rnd(-S.w * 0.4, S.w * 0.4), y = by + rnd(-1, 2.5);
    tuftPebbles(c, x, y, rnd(2.5, 4.5));
  }
  for (let k = 0; k < (size === 'S' ? 4 : 7); k++) {
    const x = cx + rnd(-S.w * 0.45, S.w * 0.45), y = by + rnd(0, 3.5), r = rnd(1.1, 1.9);
    ellipse(c, x, y, r, r * 0.65, srand() < 0.5 ? ROCK_COL.mid : ROCK_COL.base);
    ellipse(c, x - r * 0.3, y - r * 0.25, r * 0.45, r * 0.3, ROCK_COL.light);
  }
  cv = rockPixels(cv, S, rockShadow(S, cx, by, chunks));
  ROCK_SPR[key] = cv;
  return cv;
}

// Мягкая тень глыб на земле: отдельный слой, чтобы порог прозрачности пикселизации её не съел
function rockShadow(S, cx, by, chunks) {
  const cv = mkCanvas(S.w * ROCK_K, S.h * ROCK_K), c = cv.getContext('2d');
  c.scale(ROCK_K, ROCK_K);
  for (let k = 0; k < 6; k++) {
    c.fillStyle = 'rgba(18,14,8,0.07)';
    c.beginPath(); c.ellipse(cx + 2, by + 1, S.w * 0.42 - k * 1.6, 5 - k * 0.5, 0, 0, 7); c.fill();
  }
  c.fillStyle = 'rgba(20,15,8,0.35)';
  for (const [x, y, rx, ry] of chunks) { c.beginPath(); c.ellipse(x + rx * 0.25, y + ry * 0.48, rx * 1.02, ry * 0.32, 0, 0, 7); c.fill(); }
  return cv;
}

// Заготовка рисуется вдвое подробнее клетки и сводится в настоящие пиксели: одна цельная обводка по силуэту
// (а не штрих, который на ребре пикселя то темнеет, то бледнеет), ни одной одиночной тёмной точки.
// Тень (если есть) подкладывается мягко под пиксельный рисунок
function rockPixels(cv, S, shadow) {
  const art = toPixelArt(cv, ROCK_K, { outline: true, outlineDark: 0.3, alphaCut: 100, specks: 84 });
  // после обводки ещё раз: кончик травинки или крошка у контура могли остаться одиночными
  const ag = art.getContext('2d'), img = ag.getImageData(0, 0, art.width, art.height);
  dropSpecks(img.data, art.width, art.height, 84);
  ag.putImageData(img, 0, 0);
  if (!shadow) return art;
  const out = mkCanvas(art.width, art.height), g = out.getContext('2d');
  g.imageSmoothingEnabled = true; g.drawImage(shadow, 0, 0, art.width, art.height);
  g.imageSmoothingEnabled = false; g.drawImage(art, 0, 0);
  return out;
}

// Один валун: неровный многогранник, свет сверху-слева, ребро делит его на светлую и теневую грани
function drawBoulder(c, x, y, rx, ry, shadow = true) {
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
  if (shadow) {
    c.fillStyle = 'rgba(20,15,8,0.35)';
    c.beginPath(); c.ellipse(x + rx * 0.25, y + ry * 0.48, rx * 1.02, ry * 0.32, 0, 0, 7); c.fill();
  }
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
    if (px < x + rx * 0.2 && py < y + ry * 0.1) { if (!started) { c.moveTo(px + 0.9, py + 0.9); started = true; } else c.lineTo(px + 0.9, py + 0.9);  }   // кант внутри обводки, не рвёт её
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
function tuftPebbles(c, x, y, h) {
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

// ---------- Ходячие камни ----------
// Паукообразная глыба: шесть суставчатых ног и восемь глаз. Вечером лежит обычным
// камнем, только глаза светятся и перемигиваются; ночью встаёт на ноги и бегает.

ENT_LOOK.rock = { bark: ROCK_COL.base, light: ROCK_COL.light, dark: ROCK_COL.dark, crown: [ROCK_COL.mid, ROCK_COL.light] };

function spawnRockEnts(want) {
  const people = Game.units.filter(u => isPerson(u));
  if (!people.length) return;
  let made = 0;
  for (let tries = 0; tries < 900 && made < want; tries++) {
    const u = people[(Math.random() * people.length) | 0];
    const a = Math.random() * Math.PI * 2, d = 4 + Math.random() * 14;
    const x = Math.round(u.x + Math.cos(a) * d), y = Math.round(u.y + Math.sin(a) * d);
    if (!inb(x, y)) continue;
    const i = idx(x, y), o = World.obj[i];
    if (!o || o.t !== 'stone' || o.n < 2 || o.res || o.awake) continue;
    if (nearBonfire(x, y, BONFIRE_NOSPAWN)) continue;
    if (Game.ents.some(e => Math.abs(e.hx - x) + Math.abs(e.hy - y) < 3)) continue;
    o.awake = true; o.res = true;
    Game.ents.push(newEnt({ rock: true, i, o, hx: x, hy: y, x: x + 0.5, y: y + 0.5 }));
    made++;
  }
}

function rockEntGeom(e) {
  const h = hash(e.i);
  const size = rockSizeOf(e.o.n), S = ROCK_SIZES[size];
  const { bx, by } = entBase(e);
  let lift = 13 * e.k;
  if (e.state === 'dying') lift *= Math.max(0, 1 - Math.max(0, e.t - 0.9) / 1.1);   // ноги подгибаются
  return { h, size, S, bx, by, lift, top: by - lift };
}

// 8 глаз: верхний ряд — четыре мелких, нижний — два крупных в центре и два по краям
const ROCK_EYES = [[-6, 0, 1], [-2, -1, 1], [2, -1, 1], [6, 0, 1], [-7, 3, 1], [-2.5, 3, 2], [2.5, 3, 2], [7, 3, 1]];
function rockEyeCenter(e) {
  const g = rockEntGeom(e);
  return { x: g.bx, y: g.top - g.S.h * 0.3 };
}

// Моргание: 0 — глаз открыт, 1 — закрыт. Веко опускается и поднимается плавно (0.28 с),
// глаз не «выключается». Вечером — спокойная волна по всем глазам, ночью — очень редко и
// только один глаз за раз.
function rockBlink(e, k, t) {
  const DUR = 0.28;
  const prof = u => (u < 0 || u > 1 ? 0 : Math.sin(u * Math.PI));
  if (nightAmt() < 0.6) {
    const P = 2.1, ph = (t + e.i * 0.37) % P - k * 0.16;               // волна бежит от глаза к глазу, моргают часто
    return prof((ph < 0 ? ph + P : ph) / DUR);
  }
  const P = 3, n = Math.floor((t + e.i * 1.3) / P);                      // моргает почаще
  const who = (n * 5 + e.i) % ROCK_EYES.length;                           // какой глаз моргнёт в этот раз
  return (k === who || n % 3 === 0) ? prof(((t + e.i * 1.3) % P) / DUR) : 0;    // раз в три раза — все глаза разом
}

function drawRockEyes(c, e, a) {
  if (a <= 0.01) return;
  const p = rockEyeCenter(e), t = Game.time;
  c.save();
  c.globalAlpha = a;
  nightSprites();
  c.globalCompositeOperation = 'lighter';
  c.drawImage(NIGHT.eerie, p.x - 12, p.y - 6, 24, 14);
  c.globalCompositeOperation = 'source-over';
  ROCK_EYES.forEach(([dx, dy, s], k) => {
    const x = p.x + dx * (e.face < 0 ? -1 : 1) + s / 2, y = p.y + dy + s / 2 - 0.5;
    const b = rockBlink(e, k, t), h = Math.max(0.15, 1 - b);               // высота открытой части глаза
    c.fillStyle = '#140a05'; c.beginPath(); c.arc(x, y, s * 0.8 + 0.5, 0, 7); c.fill();            // глазная ямка
    c.fillStyle = '#ff6a50'; c.beginPath(); c.ellipse(x, y, s * 0.62 + 0.2, (s * 0.62 + 0.2) * h, 0, 0, 7); c.fill();   // светящийся глаз
    if (h > 0.5) { c.fillStyle = '#e6fff2'; c.fillRect(x - 0.5, y - 0.6 * h, 1, 1); }
    if (b > 0.05) { c.fillStyle = '#3a342c'; c.fillRect(x - s * 0.8 - 0.2, y - s * 0.8 - 0.4, s * 1.6 + 0.4, (s * 0.8 + 0.4) * Math.min(1, b * 1.1)); }   // каменное веко сверху
  });
  c.restore();
}

// где «рука» — поднятая передняя лапа, которой держит гнома
function rockEntHand(e) {
  const g = rockEntGeom(e);
  const reach = e.state === 'drag' && e.t < GRAB_REACH;
  return { x: g.bx + e.face * g.S.w * (reach ? 0.75 : 0.62), y: reach ? g.by - 6 : g.top - 4 };   // в клешне
}

function rockLeg(c, ax, ay, kx, ky, fx, fy) {
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const [col, w, o] of [[ROCK_COL.dark, 3.4, 0], [ROCK_COL.mid, 1.8, -0.4], [ROCK_COL.light, 0.6, -0.8]]) {
    c.strokeStyle = col; c.lineWidth = w;
    c.beginPath(); c.moveTo(ax + o, ay + o); c.lineTo(kx + o, ky + o); c.lineTo(fx + o * 0.5, fy); c.stroke();
  }
  // сустав и коготь
  ellipse(c, kx, ky, 2, 1.7, ROCK_COL.dark); ellipse(c, kx - 0.4, ky - 0.4, 1.3, 1.1, ROCK_COL.base);
  c.strokeStyle = ROCK_COL.dark; c.lineWidth = 1;
  c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx + (fx > ax ? 1.6 : -1.6), fy + 1.2); c.stroke();
}

function drawRockEnt(c, e) {
  const g = rockEntGeom(e), { S, bx, by, top } = g;
  const k = e.k;
  c.save();
  c.globalAlpha = e.alpha;
  if (e.hitT && Game.time - e.hitT < 0.25) c.translate(Math.round(Math.sin(Game.time * 80) * 2), 0);
  if (e.state === 'dying' && e.t < 1) c.translate(Math.round(Math.sin(e.t * 40) * 1.5), 0);
  // тень
  c.fillStyle = 'rgba(14,10,6,0.35)';
  c.beginPath(); c.ellipse(bx + 2, by, S.w * 0.45, 5, 0, 0, 7); c.fill();
  // шесть ног: тройками, как у паука; на ходу тройки шагают попеременно
  if (k > 0.02) {
    const atk = e.state === 'fight' && e.atk ? Game.time - e.atk : 9;
    for (const side of [-1, 1]) for (let j = 0; j < 3; j++) {
      const grp = (j + (side > 0 ? 1 : 0)) % 2;
      const sw = e.moving ? Math.sin(e.phase * 1.6 + grp * Math.PI) : 0;
      // ноги растут из-под глыбы веером: передняя, средняя, задняя; колени высоко и широко
      const ax = bx + side * (S.w * 0.12 + j * 2), ay = top - 5 + j;
      let fx = ax + side * (S.w * 0.34 + j * 5) * (0.35 + 0.65 * k) + sw * 3.5, fy = by + (j - 1) * 2.5 - Math.max(0, sw) * 3;
      let kx = ax + side * (S.w * 0.2 + j * 3) * (0.4 + 0.6 * k), ky = ay - (8 + j * 2) * k - 2;
      const front = side === e.face && j === 0;
      // передняя лапа: тянется к гному, держит его или колет в бою
      if (front && atk < 0.8) { const up = atk < 0.35; fx = bx + side * S.w * (up ? 0.35 : 0.6); fy = up ? top - 22 : by - 2; kx = (ax + fx) / 2 + side * 4; ky = Math.min(ay, fy) - 8; }
      rockLeg(c, ax, ay, kx, ky, fx, fy);
    }
  }
  // сама глыба — тем же рисунком, что и обычные камни
  const spr = rockSprite(g.size, g.h % ROCK_VARIANTS, true);   // тело — одна большая глыба
  const sc = 0.82 + ((g.h >>> 21) % 30) / 100;
  const tilt = e.moving ? Math.sin(e.phase * 1.6) * 0.04 : e.state === 'fight' ? Math.sin(e.t * 9) * 0.05 : 0;
  c.save();
  c.imageSmoothingEnabled = true;
  c.translate(bx, top); c.rotate(tilt);
  c.scale((g.h >>> 13) & 1 ? -sc : sc, sc);
  c.drawImage(spr, -S.w / 2, -(S.h - 6), S.w, S.h);
  c.restore();
  c.imageSmoothingEnabled = R.smooth;
  // трещины, пока погибает
  if (e.state === 'dying') {
    c.strokeStyle = 'rgba(28,20,12,0.9)'; c.lineWidth = 1;
    const r = mulberry32(e.i);
    for (let n = 0; n < 4; n++) {
      let px = bx + (r() - 0.5) * S.w * 0.4, py = top - S.h * 0.5;
      c.beginPath(); c.moveTo(px, py);
      for (let s = 0; s < Math.min(5, e.t * 4); s++) { px += (r() - 0.5) * 6; py += 2 + r() * 3; c.lineTo(px, py); }
      c.stroke();
    }
  }
  if (k > 0.3) drawRockClaws(c, e, g);   // крабьи клешни спереди
  // глаза (кроме погибшего)
  if (!(e.state === 'dying' && e.t > 0.5)) drawRockEyes(c, e, Math.min(1, 0.3 + nightAmt()));
  c.restore();
  if (e.state === 'drag' && (e.victim || e.vsnap)) drawVictim(c, e);
}

// побеждённый камень рассыпается обратно в обычную глыбу там, где упал
function rockEntRest(e) {
  const home = e.i, tx = Math.floor(e.x), ty = Math.floor(e.y);
  const ti = inb(tx, ty) ? idx(tx, ty) : -1;
  e.o.awake = false; e.o.res = false; e.o.dmg = 0;
  if (ti >= 0 && ti !== home && !World.obj[ti] && !World.road[ti] && !World.bmap[ti] && isWalkable(tx, ty)) {
    if (World.obj[home] === e.o) World.obj[home] = null;
    World.obj[ti] = e.o;
  }
}


// Клешни — это те самые две передние глыбы: каждая расколота на две челюсти,
// верхняя распахивается на «шарнире» у тела и щёлкает
const CLAW_SPR = {};
function clawJaw(size, variant, k, up) {
  const key = size + variant + k + (up ? 'u' : 'l');
  if (CLAW_SPR[key]) return CLAW_SPR[key];
  const [, , rx0, ry0] = ROCK_SIZES[size].chunks[k];
  const rx = rx0 * 1.15, ry = ry0 * 1.15, K = ROCK_K, W = Math.ceil(rx * 2 + 6), H = Math.ceil(ry * 2 + 6);
  let cv = mkCanvas(W * K, H * K); const c = cv.getContext('2d');
  c.scale(K, K); c.lineJoin = 'round';
  const cx = W / 2, cy = H / 2;
  // челюсть: половина глыбы с зубчатым краем-прикусом
  const half = [[0, up ? 0 : cy + 0.4], [W, up ? 0 : cy + 0.4]];
  const bite = [];
  for (let t = 0; t <= 8; t++) bite.push([W - t * W / 8, cy + (up ? 1 : -0.4) + (t % 2 ? (up ? 1.4 : -1.4) : 0)]);
  const clip = up ? [half[0], half[1], ...bite] : [[0, cy - 0.6], ...bite.slice().reverse().map(([x, y]) => [x, y]), [W, H], [0, H]];
  srand = mulberry32(5300 + variant * 31 + k * 7 + size.charCodeAt(0));
  clipPoly(c, clip, () => drawBoulder(c, cx, cy, rx, ry, false));
  // тёмная пасть по линии прикуса
  // только поверх самой челюсти (source-atop): иначе линия торчит чёрными полосками за её края
  c.globalCompositeOperation = 'source-atop';
  c.strokeStyle = 'rgba(35,28,21,0.85)'; c.lineWidth = 0.7;
  c.beginPath(); bite.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
  c.globalCompositeOperation = 'source-over';
  cv = rockPixels(cv, null, null);
  CLAW_SPR[key] = { cv, W, H, hx: cx - rx * 0.7, hy: cy };   // шарнир — у заднего края
  return CLAW_SPR[key];
}

function drawRockClaws(c, e, g) {
  const { S, bx, top } = g, v = g.h % ROCK_VARIANTS;
  const f = e.face < 0 ? -1 : 1;
  const atk = e.state === 'fight' && e.atk ? Game.time - e.atk : 9;
  for (const k of [1, 2]) {
    const side = (k === 1 ? -1 : 1) * f;                       // одна клешня слева спереди, другая справа
    let cx = bx + side * S.w * 0.33, cy = top - 3 + k;
    let open = 0.25 + Math.max(0, Math.sin(Game.time * 2.6 + k * 2 + e.i)) * 0.35;   // лениво пощёлкивает
    if (e.state === 'fight') { open = 0.15 + Math.abs(Math.sin(Game.time * 12 + k)) * 0.75; cy -= atk < 0.35 ? 8 : 0; cx += atk >= 0.35 && atk < 0.8 ? side * 5 : 0; }
    const holding = e.state === 'drag' && side === f;
    if (holding) { const h = rockEntHand(e); cx = h.x; cy = h.y; open = e.t < GRAB_REACH ? 0.85 : 0.1; }
    const lo = clawJaw(g.size, v, k, false), up = clawJaw(g.size, v, k, true);
    // короткий каменный сустав к телу
    ellipse(c, (cx + bx + side * S.w * 0.18) / 2, cy + 1, 3, 2.4, ROCK_COL.dark);
    ellipse(c, (cx + bx + side * S.w * 0.18) / 2 - 0.4, cy + 0.6, 2.2, 1.7, ROCK_COL.mid);
    c.save();
    c.imageSmoothingEnabled = true;
    c.translate(cx, cy); c.scale(side, 1);                     // пасть смотрит наружу
    c.drawImage(lo.cv, -lo.W / 2, -lo.H / 2, lo.W, lo.H);
    c.translate(up.hx - up.W / 2, up.hy - up.H / 2); c.rotate(-open);
    c.drawImage(up.cv, -up.hx, -up.hy, up.W, up.H);
    c.restore();
  }
  c.imageSmoothingEnabled = R.smooth;
}
