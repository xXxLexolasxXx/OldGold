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
  G.stamp(STAMP.shelf, 23, 25, P);                      // трутовики «этажеркой»
  G.stamp(STAMP.shelf, 20, 29, P);
  G.stamp(STAMP.shelfSmall, 26, 33, P);
  G.stamp(STAMP.window, 36, 24, P);                     // голубое окошко справа
  G.stamp(STAMP.door, 11, 36, P);                       // арочная дверь левее центра
  G.stamp(STAMP.mushroom, 3, 52, P);                    // мухоморы и камушки на холме
  G.stamp(STAMP.mushroomSmall, 10, 57, P);
  G.stamp(STAMP.mushroomSmall, 47, 54, P);
  G.stamp(STAMP.stone, 52, 57, P);
  G.stamp(STAMP.stone, 33, 60, P);
  // отсвет голубого окошка на коре
  for (const [x, y] of [[35, 26], [35, 27], [43, 27], [43, 28]]) G.set(x, y, '#7a7088');
  // контур: тёмный снизу-справа, светлая кромка сверху-слева — объём «рукой»
  selOutline(G, P.K, null);
  // ---- в картинку
  const cv = mkCanvas(STUMP_W, STUMP_H), c = cv.getContext('2d');
  for (let y = 0; y < STUMP_H; y++) for (let x = 0; x < STUMP_W; x++) { const col = G.g[y][x]; if (col) { c.fillStyle = col; c.fillRect(x, y, 1, 1); } }
  stumpArt.cv = cv;
  stumpArt.perches = [[37.5, 2], [29.5, 7], [17, 9]];  // зубцы, куда садятся совы
  return cv;
}
