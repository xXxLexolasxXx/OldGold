'use strict';
// Ручной пиксель-арт: картинки собираются попиксельно — палитра подобрана вручную,
// детали (дверь, окно, трутовики, сучок, грибы, росток) нарисованы «штампами» из
// символов, светотень ствола — цветными полосами, как у пиксель-художника.
// Никаких градиентов, сглаживания и шума.

const STUMP_PAL = {
  K: '#24120a',                                                       // тёмный контур
  1: '#cf8a52', 2: '#ad6638', 3: '#8a4a2c', 4: '#6a3424', 5: '#4c2424', 6: '#341824',   // кора: тёплый свет → лиловатая тень
  W: '#f0c288', w: '#d29a60', r: '#a8683c',                            // срез и годичные кольца
  M: '#d4e88a', m: '#9cc44c', g: '#6a9a34', G: '#43682a', H: '#2c461c',  // мох и трава
  o: '#2a140a', p: '#a8703c', P: '#cc945a', n: '#5a3018', y: '#f4c848', // дверь
  u: '#2e7cc4', U: '#7ccaf2', i: '#f0fbff',                            // окошко
  f: '#e8b48c', F: '#fbe0bc', s: '#a8704a',                            // трутовики
  R: '#d83a22', O: '#fff2de', t: '#f2e2c8', T: '#c8b49a',              // мухомор
  v: '#5c8a2c', V: '#a6d858',                                          // росток
  S: '#9a9086', Q: '#6a625a',                                          // камни
};

// Штампы деталей: «.» — пусто
const STAMP = {
  door: [
    '....mmmmm....',
    '..mMmggGmmm..',
    '.mgKKKKKKKgm.',
    '.gKoPpPpPoKg.',
    'mgKPpPpPpPKgm',
    '.KoPpPpPpPoK.',
    '.KPpPpPpPpPK.',
    '.KPpPpPpPpPK.',
    '.KPnnnnnnnPK.',
    '.KPpPpPpPpPK.',
    '.KPpPpPpPyPK.',
    '.KPpPpPpPpPK.',
    '.KPpPpPpPpPK.',
    '.KPnnnnnnnPK.',
    '.KPpPpPpPpPK.',
    '.KPpPpPpPpPK.',
    'KKKKKKKKKKKKK',
    '.SSSSSSSSSSS.',
  ],
  window: [
    '..KKK..',
    '.KUUuK.',
    'KUiUuuK',
    'KUUKuuK',
    'KKKKKKK',
    'KuuKuuK',
    'KuuKuuK',
    '.KuKuK.',
    '..KKK..',
  ],
  shelf: [
    '..FFFFF..',
    '.FffffffF',
    'sssssssss',
  ],
  shelfSmall: [
    '.FFFF.',
    'Fffff.',
    'ssssss',
  ],
  branch: [
    '.....5555555',
    '..KKK4444444',
    '.KWwWK444443',
    'KWrwrWK33333',
    'KwrWrwK33333',
    'KWrwrWK44444',
    '.KWwWK444455',
    '..KKK5555555',
  ],
  mushroom: [
    '.RRRR.',
    'RORRRR',
    'RRRROR',
    'KKKKKK',
    '..tT..',
    '..tT..',
  ],
  mushroomSmall: [
    '.RR.',
    'RORR',
    '.tT.',
  ],
  sprout: [
    '.......VV...',
    '......V..V..',
    '.....V....V.',
    '.....V....v.',
    '......v..v..',
    '..MM...vv...',
    '.MmmM..v....',
    '..MmmM.v....',
    '....MMvv....',
    '.......v....',
    '.......v....',
  ],
  stone: [
    '.SSS.',
    'SSSSQ',
    '.QQQ.',
  ],
};

function pxGrid(W, H) {
  const g = Array.from({ length: H }, () => new Array(W).fill(null));
  return {
    W, H, g,
    set(x, y, c) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < W && y < H && c) g[y][x] = c; },
    get(x, y) { return x >= 0 && y >= 0 && x < W && y < H ? g[y][x] : null; },
    stamp(rows, x0, y0, pal) { rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== '.') this.set(x0 + x, y0 + y, pal[row[x]]); }); },
  };
}

// Кромка у края силуэта: снизу и справа — тёмный контур, сверху-слева — без контура (свет)
function selOutline(G, dark, rimLight) {
  const add = [];
  for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) {
    if (G.g[y][x]) continue;
    const r = G.get(x - 1, y), l = G.get(x + 1, y), u = G.get(x, y + 1), d = G.get(x, y - 1);
    if (r || u) add.push([x, y, dark]);          // пусто справа/снизу от фигуры — контур
    else if ((l || d) && rimLight) add.push([x, y, rimLight]);
  }
  for (const [x, y, c] of add) G.set(x, y, c);
}

// ---------- Мельница ----------
// 56×112 пикселей мира, основание в точке (28, 104), ось крыльев в MILL_HUB.

const MILL_W = 56, MILL_H = 112, MILL_AX = 28, MILL_AY = 104, MILL_HUB = [28, 30];

const MILL_PAL = {
  K: '#24120a',
  a: '#d4cab4', b: '#bfb59e', c: '#a89d85', d: '#90856f', e: '#72695a', f: '#554d41',   // бутовый камень башни: свет → тень
  A: '#b8b0a2', B: '#9a9286', C: '#7c746a', D: '#5e5850', N: '#3e3a34',                // камень цоколя
  r: '#8a6038', s: '#74502e', t: '#60421f', u: '#4c3219', v: '#3a250f', w: '#27180a',   // тёмная дранка колпака
  o: '#2a140a', p: '#a8703c', P: '#cc945a', n: '#5a3018', y: '#f4c848',                // дверь
  L: '#ffe9a0', l: '#f0b050', h: '#7a4a1e',                                           // тёплое окошко
  M: '#d4e88a', m: '#9cc44c', g: '#6a9a34', G: '#43682a', H: '#2c461c',               // мох, трава
  k: '#6e4a2a', j: '#8e6438', i: '#b88a50',                                           // доски галереи
  F: '#f0ece0', E: '#d8ccb0', X: '#e6c24a',                                           // мешки
  R: '#e86a9a', W: '#f4f0f6', Y: '#f0d040',                                           // цветы
};

const MILL_STAMP = {
  door: [
    '..KKKKK..',
    '.KoPpPoK.',
    'KoPpPpPoK',
    'KPpPpPpPK',
    'KPnnnnnPK',
    'KPpPpPpPK',
    'KPpPpPyPK',
    'KPpPpPpPK',
    'KPnnnnnPK',
    'KPpPpPpPK',
    'KPpPpPpPK',
    'KKKKKKKKK',
  ],
  window: [
    '.KKK.',
    'KlLlK',
    'KLLLK',
    'KKhKK',
    'KlhlK',
    'KlhlK',
    'KKKKK',
  ],
  sack: [
    '.EE.',
    'FFFE',
    'FFFE',
    'FFEE',
  ],
  sackGold: [
    '.EE.',
    'XXXE',
    'XXXE',
    'XXEE',
  ],
};

function millArt() {
  if (millArt.cv) return millArt.cv;
  const P = MILL_PAL, G = pxGrid(MILL_W, MILL_H), cx = MILL_AX;
  const lerp = (a, b, t) => a + (b - a) * t;
  // холмик травы у основания
  for (let y = 98; y <= 109; y++) for (let x = 2; x < 54; x++) {
    const e = ((x - cx) / 26) ** 2 + ((y - 104) / 5.5) ** 2;
    if (e > 1) continue;
    const t = (y - 98) / 11, side = (x - cx) / 26;
    let col = t < 0.3 ? P.m : t < 0.6 ? P.g : P.G;
    if (side < -0.4 && t < 0.4) col = P.M;
    if (side > 0.5 && col === P.g) col = P.G;
    G.set(x, y, col);
  }
  // ствол башни: сужается кверху; полосы света по цилиндру
  const halfAt = y => Math.round(y > 86 ? lerp(17, 19, (y - 86) / 16) : lerp(12, 17, (y - 36) / 50));
  const plaster = [P.a, P.b, P.c, P.d, P.e, P.f], stone = [P.A, P.A, P.B, P.C, P.D, P.N];
  for (let y = 36; y <= 102; y++) {
    const hw = halfAt(y), L = cx - hw, Rr = cx + hw;
    const isBase = y >= 86;
    for (let x = L; x <= Rr; x++) {
      const t = (x - L) / (Rr - L);
      const k = t < 0.12 ? 0 : t < 0.3 ? 1 : t < 0.55 ? 2 : t < 0.75 ? 3 : t < 0.9 ? 4 : 5;
      if (isBase) {
        // каменный цоколь: ряды камней со сдвигом, тёмные швы
        const row = Math.floor((y - 86) / 3), off = row % 2 ? 2 : 0;
        const seamV = (x + off) % 5 === 0, seamH = (y - 86) % 3 === 2;
        G.set(x, y, seamV || seamH ? P.N : stone[k]);
      } else {
        // кладка: ряды камней со сдвигом и тёмными швами
        const row = Math.floor((y - 36) / 4), off = row % 2 ? 3 : 0;
        const seamV = (x + off) % 6 === 0, seamH = (y - 36) % 4 === 3;
        G.set(x, y, seamH ? plaster[Math.min(5, k + 2)] : seamV ? plaster[Math.min(5, k + 1)] : plaster[k]);
      }
    }
  }
  // кое-где из-под штукатурки видны камни — следы времени
  for (const [x0, y0, w, h] of [[17, 58, 5, 4], [33, 74, 4, 3], [20, 46, 3, 3], [31, 54, 3, 2]]) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const base = G.get(x, y); if (!base) continue;
      G.set(x, y, (x + y) % 3 === 0 ? P.C : x < cx ? P.A : P.B);
    }
  }
  // мох у основания цоколя
  const mh = [3, 4, 2, 5, 3, 2, 4, 3, 1, 2, 3, 2, 1, 2, 3, 4, 2, 3, 2, 1, 2, 3, 2, 1, 3, 2, 4, 3, 2, 3, 2, 1, 2, 3, 2, 2, 3, 1];
  for (let i = 0; i < mh.length; i++) for (let k = 0; k < mh[i]; k++) { const x = 9 + i, y = 101 - k; if (G.get(x, y)) G.set(x, y, k === mh[i] - 1 ? P.M : P.m); }
  // деревянная галерея с перилами вокруг башни
  for (let x = cx - 17; x <= cx + 17; x++) {
    G.set(x, 38, P.i); G.set(x, 39, x < cx + 8 ? P.j : P.k); G.set(x, 40, P.k);
    if (x % 3 === 0) for (let y = 33; y < 38; y++) G.set(x, y, x < cx ? P.j : P.k);   // стойки перил
    G.set(x, 33, P.i); G.set(x, 34, P.k);
  }
  for (const x of [cx - 15, cx - 7, cx + 1, cx + 9]) { G.set(x, 41, P.k); G.set(x + 1, 42, P.k); }   // подкосы
  // колпак из красной черепицы: конус с волнистым краем и рядами черепицы
  const tiles = [P.r, P.s, P.t, P.u, P.v, P.w];
  for (let y = 6; y <= 33; y++) {
    const hw = Math.round(lerp(1, 19, (y - 6) / 27)), L = cx - hw, Rr = cx + hw;
    for (let x = L; x <= Rr; x++) {
      const t = hw ? (x - L) / (Rr - L) : 0.3;
      let k = t < 0.15 ? 0 : t < 0.35 ? 1 : t < 0.6 ? 2 : t < 0.8 ? 3 : t < 0.93 ? 4 : 5;
      if ((y - 6) % 4 === 3) k = Math.min(5, k + 1);                 // нижняя кромка ряда черепицы
      if ((y - 6) % 4 === 0 && (x + y) % 4 === 0) k = Math.max(0, k - 1);   // блик на выпуклой черепице
      G.set(x, y, tiles[k]);
    }
  }
  for (let x = cx - 19; x <= cx + 19; x++) if ((x - cx) % 3 === 0) G.set(x, 34, P.w);   // зубчатый свес
  // шпиль с флажком
  for (let y = 0; y < 6; y++) G.set(cx, y, P.k);
  G.set(cx + 1, 0, '#4aa05a'); G.set(cx + 2, 0, '#4aa05a'); G.set(cx + 1, 1, '#2f7a40');   // зелёный вымпел
  // окна и дверь — дверь правее центра, над клеткой входа
  G.stamp(MILL_STAMP.window, cx - 8, 46, P);
  G.stamp(MILL_STAMP.window, cx + 3, 64, P);
  G.stamp(MILL_STAMP.window, cx - 10, 72, P);
  G.stamp(MILL_STAMP.door, cx + 1, 90, P);
  // мешки с мукой и зерном у входа, цветы на холмике
  G.stamp(MILL_STAMP.sack, cx - 16, 97, P);
  G.stamp(MILL_STAMP.sackGold, cx - 12, 98, P);
  G.stamp(MILL_STAMP.sack, cx + 12, 98, P);
  for (const [x, y, col] of [[6, 104, P.R], [8, 102, P.W], [46, 103, P.Y], [49, 105, P.R], [4, 106, P.Y], [51, 101, P.W]]) { G.set(x, y, col); G.set(x, y + 1, P.G); }
  selOutline(G, P.K, '#5a3a20');
  const cv = mkCanvas(MILL_W, MILL_H), c = cv.getContext('2d');
  for (let y = 0; y < MILL_H; y++) for (let x = 0; x < MILL_W; x++) { const col = G.g[y][x]; if (col) { c.fillStyle = col; c.fillRect(x, y, 1, 1); } }
  millArt.cv = cv;
  millArt.perches = [[cx, 1], [cx - 10, 24], [cx + 10, 24]];
  return cv;
}

// Крылья мельницы: решётка из реек, парусина на клетках. Заранее рисуется набор
// кадров поворота (крылья симметричны — хватает четверти оборота), каждый — пиксель-арт.
const SAIL_FRAMES = 16, SAIL_SIZE = 96;
function sailFrame(i) {
  sailFrame.cache = sailFrame.cache || [];
  if (sailFrame.cache[i]) return sailFrame.cache[i];
  const S = 4, [cv, c] = mkSprite(SAIL_SIZE, SAIL_SIZE, S);
  c.translate(SAIL_SIZE / 2, SAIL_SIZE / 2);
  c.rotate(i / SAIL_FRAMES * Math.PI / 2);
  for (let k = 0; k < 4; k++) {
    c.rotate(Math.PI / 2);
    // махина-рея
    c.fillStyle = '#4a2c16'; c.fillRect(-1.6, 3, 3.2, 42);
    c.fillStyle = '#8a5a30'; c.fillRect(-1.6, 3, 1.2, 42);
    // решётка: рамка с одной стороны от реи
    const x0 = 1.6, w = 10, y0 = 9, y1 = 44;
    c.fillStyle = '#efe4c8'; c.fillRect(x0, y0, w, y1 - y0);                  // парусина
    c.fillStyle = 'rgba(160,140,100,0.45)'; c.fillRect(x0 + w * 0.55, y0, w * 0.45, y1 - y0);
    c.fillStyle = '#5a3a1e';
    for (let y = y0; y <= y1; y += 5) c.fillRect(x0, y, w, 1.1);              // поперечные рейки
    c.fillRect(x0 + w - 1.1, y0, 1.1, y1 - y0); c.fillRect(x0 + w * 0.5, y0, 0.9, y1 - y0);
  }
  c.fillStyle = '#3a2414'; c.beginPath(); c.arc(0, 0, 4, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#8a5a30'; c.beginPath(); c.arc(-0.8, -0.8, 1.8, 0, Math.PI * 2); c.fill();
  const out = toPixelArt(cv, S, { outline: true, outlineDark: 0.25, alphaCut: 90 });
  sailFrame.cache[i] = out;
  return out;
}

// ---------- Пень ----------
// 60×66 пикселей мира, основание ствола в точке (30, 56).

const STUMP_W = 60, STUMP_H = 66, STUMP_AX = 30, STUMP_AY = 56;

function stumpArt() {
  if (stumpArt.cv) return stumpArt.cv;
  const P = STUMP_PAL, G = pxGrid(STUMP_W, STUMP_H);
  const lerp = (a, b, t) => a + (b - a) * t;
  // ---- холм: эллипс с полосами травы, неровный верх из травинок
  const mx = 30, my = 57, mrx = 29, mry = 8;
  for (let y = my - mry; y <= my + mry; y++) for (let x = mx - mrx; x <= mx + mrx; x++) {
    const e = ((x - mx) / mrx) ** 2 + ((y - my) / mry) ** 2;
    if (e > 1) continue;
    const t = (y - (my - mry)) / (mry * 2);
    const side = (x - mx) / mrx;                       // справа темнее
    let c = t < 0.22 ? P.m : t < 0.5 ? P.g : t < 0.78 ? P.G : P.H;
    if (side > 0.45 && c === P.m) c = P.g;
    if (side > 0.55 && c === P.g) c = P.G;
    if (side < -0.5 && t < 0.4) c = P.M;
    G.set(x, y, c);
  }
  // травинки по верхнему краю холма — рука художника: разные высоты
  const blades = [[4, 2], [7, 3], [9, 1], [13, 2], [46, 2], [49, 3], [52, 1], [55, 2], [2, 1], [57, 1]];
  for (const [x, h] of blades) {
    const top = my - Math.round(mry * Math.sqrt(Math.max(0, 1 - ((x - mx) / mrx) ** 2)));
    for (let k = 1; k <= h; k++) G.set(x, top - k, k === h ? P.M : P.m);
  }
  // ---- ствол: края слегка расширяются книзу, полосы света по цилиндру
  const topEdge = {};
  const tops = [[10, 15], [11, 14], [12, 14], [13, 12], [14, 12], [15, 12], [16, 13], [17, 13], [18, 10], [19, 10], [20, 10],
    [21, 12], [22, 12], [23, 9], [24, 9], [25, 9], [26, 11], [27, 11], [28, 11], [29, 8], [30, 8], [31, 8], [32, 10], [33, 10],
    [34, 6], [35, 5], [36, 4], [37, 3], [38, 3], [39, 5], [40, 7], [41, 10], [42, 11], [43, 11], [44, 13], [45, 14], [46, 15], [47, 16]];
  for (const [x, y] of tops) topEdge[x] = y;
  const leftAt = y => Math.round(y < 30 ? lerp(10, 9, (y - 14) / 16) : y < 46 ? lerp(9, 7, (y - 30) / 16) : lerp(7, 4, (y - 46) / 7));
  const rightAt = y => Math.round(y < 30 ? lerp(47, 48, (y - 14) / 16) : y < 46 ? lerp(48, 50, (y - 30) / 16) : lerp(50, 54, (y - 46) / 7));
  const ramp = [P[1], P[2], P[3], P[4], P[5], P[6]];
  const grooves = [13, 17, 22, 27, 32, 37, 42, 46];
  const wig = [0, 0, 1, 1, 0, 0, -1, -1];
  for (let y = 3; y <= 54; y++) {
    const L = leftAt(Math.max(y, 14)), Rr = rightAt(Math.max(y, 14));
    for (let x = L; x <= Rr; x++) {
      const te = topEdge[x] ?? (x < 10 ? 16 : 17);
      if (y < te) continue;
      if (y > 52 && (x - mx) ** 2 / (mrx * mrx) + (y - my) ** 2 / (mry * mry) < 1) continue;   // низ прячется в холм
      const t = (x - L) / (Rr - L);
      let k = t < 0.1 ? 0 : t < 0.26 ? 1 : t < 0.52 ? 2 : t < 0.76 ? 3 : t < 0.92 ? 4 : 5;
      G.set(x, y, ramp[k]);
    }
    // борозды коры с бликом слева от борозды на светлой стороне
    for (let gi = 0; gi < grooves.length; gi++) {
      const gx = grooves[gi] + wig[(y + gi * 3) & 7];
      const te = topEdge[gx] ?? 17;
      if (y < te + 2 || y > 52 || gx <= L || gx >= Rr) continue;
      const t = (gx - L) / (Rr - L), base = t < 0.26 ? 1 : t < 0.52 ? 2 : t < 0.76 ? 3 : 4;
      G.set(gx, y, ramp[Math.min(5, base + 2)]);
      if (t < 0.55 && y % 3 !== 0) G.set(gx - 1, y, ramp[Math.max(0, base - 1)]);
    }
  }
  // ---- срез сверху: светлая древесина с кольцами, видна между зубцами
  const ex = 27, ey = 13, erx = 12, ery = 3;
  for (let y = ey - ery; y <= ey + ery; y++) for (let x = ex - erx; x <= ex + erx; x++) {
    const e = ((x - ex) / erx) ** 2 + ((y - ey) / ery) ** 2;
    if (e > 1 || y < (topEdge[x] ?? 99)) continue;
    G.set(x, y, e > 0.75 ? P.w : (e > 0.42 && e < 0.55) || (e > 0.12 && e < 0.2) ? P.r : P.W);
  }
  // мох шапкой по зубчатому краю: свет на левых гранях
  for (const [x, y] of tops) {
    if (x > 44) continue;
    G.set(x, y, x < 30 ? P.M : P.m);
    if ((x * 7) % 3 !== 0) G.set(x, y + 1, x < 26 ? P.m : P.g);
  }
  // мох у основания ствола, неровной каймой
  const mossHeights = [6, 7, 5, 8, 9, 6, 5, 4, 6, 5, 3, 4, 5, 6, 4, 3, 2, 4, 5, 3, 2, 3, 4, 5, 6, 4, 3, 5, 6, 7, 5, 4, 6, 5, 3, 4, 2, 3, 5, 4, 3, 2, 3];
  for (let i = 0; i < mossHeights.length; i++) {
    const x = 6 + i, h = mossHeights[i];
    for (let k = 0; k < h; k++) {
      const y = 52 - k;
      if (!G.get(x, y)) continue;
      G.set(x, y, k === h - 1 ? P.M : k > h - 3 ? P.m : P.g);
    }
  }
  // мох свисает с правого бока клочками
  for (const [x, y, h] of [[44, 24, 4], [45, 25, 3], [46, 30, 3], [43, 35, 2], [47, 40, 4]]) for (let k = 0; k < h; k++) G.set(x, y + k, k === 0 ? P.m : P.g);
  // ---- корни по холму
  for (const [x0, y0, dir] of [[8, 50, -1], [50, 50, 1], [22, 54, -1], [40, 54, 1]]) {
    for (let k = 0; k < 6; k++) {
      const x = x0 + dir * k, y = y0 + (k >> 1);
      G.set(x, y, k < 2 ? P[3] : P[4]); G.set(x, y + 1, P[5]);
      if (k < 3) G.set(x, y - 1, P[2]);
    }
  }
  // ---- детали
  G.stamp(STAMP.branch, -1, 19, P);                     // срезанный сучок слева
  G.stamp(STAMP.sprout, 31, -1, P);                     // вьющийся росток на верхушке
  G.stamp(STAMP.shelf, 21, 25, P);                      // трутовики «этажеркой»
  G.stamp(STAMP.shelf, 24, 29, P);
  G.stamp(STAMP.shelfSmall, 20, 33, P);
  G.stamp(STAMP.window, 12, 27, P);                     // голубое окошко слева
  G.stamp(STAMP.door, 34, 36, P);                       // арочная дверь правее центра — над клеткой входа
  G.stamp(STAMP.mushroom, 3, 52, P);                    // мухоморы и камушки на холме
  G.stamp(STAMP.mushroomSmall, 10, 57, P);
  G.stamp(STAMP.mushroomSmall, 47, 54, P);
  G.stamp(STAMP.stone, 52, 57, P);
  G.stamp(STAMP.stone, 33, 60, P);
  // отсвет голубого окошка на коре
  for (const [x, y] of [[11, 29], [11, 30], [19, 30], [19, 31]]) G.set(x, y, '#9a7a70');
  // контур: тёмный снизу-справа, светлая кромка сверху-слева — объём «рукой»
  selOutline(G, P.K, '#5a2a1c');
  // ---- в картинку
  const cv = mkCanvas(STUMP_W, STUMP_H), c = cv.getContext('2d');
  for (let y = 0; y < STUMP_H; y++) for (let x = 0; x < STUMP_W; x++) { const col = G.g[y][x]; if (col) { c.fillStyle = col; c.fillRect(x, y, 1, 1); } }
  stumpArt.cv = cv;
  stumpArt.perches = [[37.5, 2], [29.5, 7], [17, 9]];  // зубцы, куда садятся совы
  return cv;
}
