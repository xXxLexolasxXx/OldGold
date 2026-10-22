'use strict';
// Оборона: рисование. Стены, ворота, баррикады, ловушки и факелы — пиксель-арт в тройном разрешении
// (как здания), кэшируются по виду; башня — модель в bmodels-стиле; дозорный и стражи — маленькие гномы на площадке.

const DFA = { cache: new Map(), lay: new Map(), M: 64, W: 96 };          // M — запас над клеткой в «пикселях арта» (их втрое больше мировых)
const DFC = {
  wood: ['#8a5a30', '#b87e48', '#5a3a1c', '#2a1a0c', '#c8a070'],     // база, свет, тень, контур, торец
  stone: ['#928d82', '#bdb7a8', '#68635a', '#34302a', '#a8a296'],
  iron: ['#3a3a44', '#7a7a8a', '#1e1e26'],
};
const dfr = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

function dfTri(c, x0, y0, x1, y1, x2, y2, col) { c.fillStyle = col; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineTo(x2, y2); c.closePath(); c.fill(); }

// Соседи, с которыми стена срастается: 1 — север, 2 — восток, 4 — юг, 8 — запад
function fortMask(x, y) {
  let m = 0;
  const n = (xx, yy) => { const o = fortAt(xx, yy); return !!o && fortIsWall(o); };
  if (n(x, y - 1)) m |= 1; if (n(x + 1, y)) m |= 2; if (n(x, y + 1)) m |= 4; if (n(x - 1, y)) m |= 8;
  return m;
}
// Стена прижата к кромке клетки, а не стоит посреди неё: вертикальный участок слева идёт по левой кромке,
// справа — по правой; горизонтальный сверху — по верхней, снизу — по нижней (дорога и проход внутри остаются свободными).
// Сторону выбираем по всей связной стене: клетки левее середины — влево, правее — вправо; посередине решает дорога рядом.
// Дорога и проход остаются свободными: сторона для середины — от дороги. Результат кэшируем (стена меняется редко).
function dfLayout(x, y) {
  const cells = [], seen = new Set([y * MAP_W + x]), q = [[x, y]];
  let minx = x, maxx = x, miny = y, maxy = y;
  while (q.length && cells.length < 400) {
    const [cx, cy] = q.pop();
    cells.push([cx, cy]);
    if (cx < minx) minx = cx; if (cx > maxx) maxx = cx; if (cy < miny) miny = cy; if (cy > maxy) maxy = cy;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy, k = ny * MAP_W + nx;
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H || seen.has(k)) continue;
      const o = fortAt(nx, ny);
      if (o && fortIsWall(o)) { seen.add(k); q.push([nx, ny]); }
    }
  }
  const road = (xx, yy) => xx >= 0 && yy >= 0 && xx < MAP_W && yy < MAP_H && World.road[idx(xx, yy)] ? 1 : 0;
  const colVote = {}, rowVote = {};
  for (const [cx, cy] of cells) { colVote[cx] = (colVote[cx] || 0) + road(cx - 1, cy) - road(cx + 1, cy); rowVote[cy] = (rowVote[cy] || 0) + road(cx, cy - 1) - road(cx, cy + 1); }
  const mx = (minx + maxx) / 2, my = (miny + maxy) / 2, now = performance.now(), single = cells.length === 1;
  for (const [cx, cy] of cells) {
    let sx = 0, sy = 0;
    if (!single) {
      sx = cx < mx ? 1 : cx > mx ? 2 : colVote[cx] > 0 ? 2 : 1;            // 1 — влево, 2 — вправо
      sy = cy < my ? 1 : cy > my ? 2 : rowVote[cy] > 0 ? 2 : 1;            // 1 — вверх, 2 — вниз
      if (miny === maxy && rowVote[cy] === 0) sy = 2;                       // одиночный ряд по умолчанию стоит у нижней кромки
    }
    DFA.lay.set(cy * MAP_W + cx, { mask: fortMask(cx, cy), sx, sy, t: now });
  }
}
function fortShift(x, y, mask) {
  const i = y * MAP_W + x, e = DFA.lay.get(i);
  if (e && e.mask === mask && performance.now() - e.t < 500) return e;
  dfLayout(x, y);
  return DFA.lay.get(i) || { sx: 0, sy: 0 };
}
// Прямоугольники плеч стены (в «пикселях арта» клетки 96×96) по соседям и прижатию; рисуются от дальнего к ближнему
function dfBoxes(mask) {
  const m = mask & 15, sx = (mask >> 4) & 3, sy = (mask >> 6) & 3, V = m & 5, H = m & 10;
  const xr = sx === 1 ? [0, 30] : sx === 2 ? [66, 96] : [33, 63], yr = sy === 1 ? [0, 30] : sy === 2 ? [66, 96] : [33, 63];
  const bs = [];
  if (!V && !H) bs.push({ x0: xr[0], x1: xr[1], y0: yr[0], y1: yr[1] });
  if (V) bs.push({ x0: xr[0], x1: xr[1], y0: m & 1 ? 0 : H ? yr[0] : 33, y1: m & 4 ? 96 : H ? yr[1] : 63 });
  if (H) bs.push({ x0: m & 8 ? 0 : V ? xr[0] : 33, x1: m & 2 ? 96 : V ? xr[1] : 63, y0: yr[0], y1: yr[1] });
  return bs.sort((a, b) => a.y1 - b.y1);
}
const dfDmg = o => { const q = o.hp / fortMax(o); return q > 0.66 ? 0 : q > 0.33 ? 1 : 2; };

// ---------- Деревянный частокол ----------
function dfWallWood(c, g, L, dmg, M, seed) {
  const Hh = 54, yb = g.y1 + M, yt = yb - Hh, P = DFC.wood;
  // тень на земле справа и спереди
  dfr(c, g.x0 + 3, yb - 3, g.x1 - g.x0 + 4, 6, 'rgba(10,8,4,0.3)');
  // торцы брёвен на верхней грани (там, где стена идёт вглубь)
  if (g.y0 < g.y1 - 30) {
    dfr(c, g.x0, g.y0 + M - Hh, g.x1 - g.x0, g.y1 - g.y0 - 0, '#6a4424');
    for (let yy = g.y1 + M - Hh - 5; yy > g.y0 + M - Hh - 5; yy -= 10)
      for (let xx = g.x0 + 6; xx < g.x1; xx += 12) {
        c.fillStyle = P[3]; c.beginPath(); c.ellipse(xx, yy, 6, 4.6, 0, 0, 7); c.fill();
        c.fillStyle = P[4]; c.beginPath(); c.ellipse(xx, yy, 5, 3.6, 0, 0, 7); c.fill();
        c.fillStyle = '#a07848'; c.beginPath(); c.ellipse(xx, yy, 2.4, 1.6, 0, 0, 7); c.fill();
        c.fillStyle = '#e8cc9c'; c.fillRect(xx - 3, yy - 3, 3, 1);
      }
  }
  // бревна лицом
  let k = 0;
  for (let x = g.x0; x < g.x1; x += 12, k++) {
    const w = Math.min(12, g.x1 - x), v = ((seed >> (k % 12)) & 3) * 2;
    dfr(c, x, yt - v, w, Hh + v, P[3]);
    dfr(c, x + 1, yt - v, w - 2, Hh + v - 1, P[0]);
    dfr(c, x + 1, yt - v, 3, Hh + v - 1, P[1]);
    dfr(c, x + w - 4, yt - v, 3, Hh + v - 1, P[2]);
    dfr(c, x + 5, yt + 14 + (k * 7 % 20), 3, 3, P[2]);                          // сучок
    // заострённая вершина
    dfTri(c, x, yt - v, x + w / 2, yt - v - 15, x + w, yt - v, P[3]);
    dfTri(c, x + 1, yt - v, x + w / 2, yt - v - 13, x + w - 1, yt - v, P[0]);
    dfTri(c, x + 1, yt - v, x + w / 2, yt - v - 13, x + w / 2, yt - v, P[1]);
  }
  // вязка поперёк
  dfr(c, g.x0, yt + 12, g.x1 - g.x0, 4, P[3]); dfr(c, g.x0, yt + 13, g.x1 - g.x0, 2, '#6a4a2a');
  if (L >= 2) {
    // каменный цоколь и железные скобы
    const S = DFC.stone;
    dfr(c, g.x0, yb - 15, g.x1 - g.x0, 15, S[3]);
    for (let x = g.x0, r = 0; x < g.x1; x += 16, r++) { dfr(c, x + 1, yb - 14, 14, 6, S[(r % 2) ? 0 : 4]); dfr(c, x + 1, yb - 14, 14, 1, S[1]); dfr(c, x + 7, yb - 7, 14, 6, S[(r % 2) ? 4 : 0]); dfr(c, x + 7, yb - 7, 14, 1, S[1]); }
    dfr(c, g.x0, yt + 28, g.x1 - g.x0, 5, DFC.iron[2]); dfr(c, g.x0, yt + 29, g.x1 - g.x0, 2, DFC.iron[0]);
    for (let x = g.x0 + 6; x < g.x1; x += 12) dfr(c, x, yt + 30, 2, 2, DFC.iron[1]);
  }
  dfWallDamage(c, g, dmg, yt, yb, 0, seed);
}

// ---------- Каменная стена ----------
function dfWallStone(c, g, L, dmg, M, seed) {
  const Hh = 54, yb = g.y1 + M, yt = yb - Hh, S = DFC.stone;
  dfr(c, g.x0 + 3, yb - 3, g.x1 - g.x0 + 4, 6, 'rgba(10,8,4,0.3)');
  // верхняя грань
  if (g.y1 - g.y0 > 0) {
    dfr(c, g.x0, g.y0 + M - Hh, g.x1 - g.x0, g.y1 - g.y0, S[3]);
    dfr(c, g.x0 + 1, g.y0 + M - Hh + 1, g.x1 - g.x0 - 2, g.y1 - g.y0 - 1, S[4]);
    dfr(c, g.x0 + 1, g.y0 + M - Hh + 1, g.x1 - g.x0 - 2, 2, S[1]);
    // швы плит
    for (let yy = g.y1 + M - Hh - 10; yy > g.y0 + M - Hh; yy -= 10) dfr(c, g.x0 + 1, yy, g.x1 - g.x0 - 2, 1, S[2]);
    dfr(c, g.x0 + 1, g.y1 + M - Hh - 2, g.x1 - g.x0 - 2, 2, S[1]);
  }
  // лицевая кладка
  dfr(c, g.x0, yt, g.x1 - g.x0, Hh, S[3]);
  let row = 0;
  for (let y = yb - 11; y > yt - 6; y -= 12, row++) {
    let x = g.x0 - (row % 2 ? 12 : 0);
    let k = 0;
    while (x < g.x1) {
      const w = 20 + (((seed >> (k + row)) & 3) * 4), x0 = Math.max(x, g.x0), x1 = Math.min(x + w, g.x1);
      if (x1 - x0 > 2) {
        const tone = ((hashStr(seed + ':' + row + ':' + k) >> 3) % 3);
        const col = tone === 0 ? S[0] : tone === 1 ? '#8a8578' : '#9e988c';
        dfr(c, x0 + 1, y, x1 - x0 - 2, 10, col);
        dfr(c, x0 + 1, y, x1 - x0 - 2, 2, S[1]);
        dfr(c, x0 + 1, y + 8, x1 - x0 - 2, 2, S[2]);
        if (tone === 2 && (k + row) % 3 === 0) dfr(c, x0 + 3, y + 5, 7, 3, '#5c7a3a');            // мох
      }
      x += w; k++;
    }
  }
  dfr(c, g.x1 - 3, yt, 3, Hh, 'rgba(10,8,4,0.25)');
  if (L >= 2) {
    // зубцы по лицевому краю
    for (let x = g.x0 + 4; x < g.x1 - 14; x += 32) {
      dfr(c, x, yt - 14, 20, 16, S[3]); dfr(c, x + 1, yt - 13, 18, 14, S[0]); dfr(c, x + 1, yt - 13, 18, 3, S[1]); dfr(c, x + 14, yt - 13, 5, 14, S[2]);
    }
    dfr(c, g.x0, yt - 2, g.x1 - g.x0, 3, S[1]);
    dfr(c, g.x0, yt + 36, g.x1 - g.x0, 4, S[3]); dfr(c, g.x0, yt + 36, g.x1 - g.x0, 1, S[1]);        // карниз
  }
  dfWallDamage(c, g, dmg, yt, yb, 1, seed);
}

// Трещины и дыры по мере разрушения
function dfWallDamage(c, g, dmg, yt, yb, stone, seed) {
  if (!dmg) return;
  const r = mulberry32(seed + 77), w = g.x1 - g.x0, ink = '#1a1008';
  const crack = (x, y, n) => { let cx = x, cy = y; for (let k = 0; k < n; k++) { dfr(c, cx, cy, 2, 5, ink); cx += (r() < 0.5 ? -2 : 2); cy += 5; } };
  crack(g.x0 + 8 + r() * (w - 20), yt + 8, 6);
  if (dmg >= 2) {
    crack(g.x0 + 6 + r() * (w - 16), yt + 4, 8);
    const hx = g.x0 + 10 + r() * (w - 28);
    dfr(c, hx, yt + 14, 12, 16, ink); dfr(c, hx + 2, yt + 16, 8, 12, '#0e0804');
    for (let k = 0; k < 6; k++) dfr(c, g.x0 + r() * (w - 6), yb - 2 + r() * 4, 4 + r() * 4, 3 + r() * 3, stone ? '#7a756c' : '#6a4424');   // обломки у подножия
  }
}

// ---------- Ворота ----------
function dfGate(c, mask, o, M, seed) {
  const stone = o.m === 'stone', B = stone ? DFC.stone : DFC.wood, L = o.lv, open = !!o.open, dmg = dfDmg(o);
  const horiz = (mask & 10) || !(mask & 5);
  const wood = DFC.wood;
  // прижатие к кромке клетки — как у стены рядом (см. dfBoxes): весь проём сдвигается целиком
  const sx = (mask >> 4) & 3, sy = (mask >> 6) & 3;
  c.save();
  c.translate(horiz ? 0 : sx === 1 ? -33 : sx === 2 ? 33 : 0, horiz ? (sy === 1 ? -33 : sy === 2 ? 33 : 0) : 0);
  if (horiz) {
    const yb = 63 + M, Hp = 70, yt = yb - Hp;
    dfr(c, 0, yb - 3, 96, 8, 'rgba(10,8,4,0.3)');
    // столбы
    for (const x of [0, 82]) {
      dfr(c, x, yt, 14, Hp, B[3]); dfr(c, x + 1, yt + 1, 12, Hp - 1, B[0]); dfr(c, x + 1, yt + 1, 4, Hp - 1, B[1]); dfr(c, x + 9, yt + 1, 4, Hp - 1, B[2]);
      if (stone) for (let y = yt + 10; y < yb; y += 12) dfr(c, x + 1, y, 12, 1, B[2]);
      else for (let y = yt + 10; y < yb; y += 14) dfr(c, x + 1, y, 12, 2, B[3]);
      dfr(c, x - 2, yt - 4, 18, 6, B[3]); dfr(c, x - 1, yt - 3, 16, 4, B[1]);                         // шапка столба
    }
    // проём
    dfr(c, 14, yt + 20, 68, Hp - 20, '#120c06');
    // перемычка
    dfr(c, 0, yt + 12, 96, 12, B[3]); dfr(c, 1, yt + 13, 94, 10, B[0]); dfr(c, 1, yt + 13, 94, 3, B[1]); dfr(c, 1, yt + 20, 94, 3, B[2]);
    if (L >= 2) { for (let x = 12; x < 90; x += 14) { dfr(c, x, yt + 17, 4, 4, DFC.iron[1]); } dfr(c, 0, yt + 8, 96, 4, DFC.iron[2]); }
    if (!open) {
      // створки
      for (const [x0, x1] of [[14, 48], [48, 82]]) {
        dfr(c, x0, yt + 24, x1 - x0, Hp - 24, wood[3]);
        for (let x = x0 + 1; x < x1 - 1; x += 8) { dfr(c, x, yt + 25, 7, Hp - 25, wood[0]); dfr(c, x, yt + 25, 2, Hp - 25, wood[1]); dfr(c, x + 5, yt + 25, 2, Hp - 25, wood[2]); }
      }
      for (const y of [yt + 32, yb - 14]) { dfr(c, 14, y, 68, 5, DFC.iron[2]); dfr(c, 14, y + 1, 68, 2, DFC.iron[0]); for (let x = 20; x < 80; x += 12) dfr(c, x, y + 1, 2, 2, DFC.iron[1]); }
      dfr(c, 46, yt + 24, 4, Hp - 24, wood[3]);
      dfr(c, 40, yt + 44, 5, 5, DFC.iron[1]); dfr(c, 51, yt + 44, 5, 5, DFC.iron[1]);                  // кольца
    } else {
      // распахнуты внутрь: узкие створки по бокам, видна дорога
      dfTri(c, 14, yt + 24, 26, yt + 28, 26, yb - 4, wood[3]); dfTri(c, 14, yt + 24, 14, yb, 26, yb - 4, wood[3]);
      dfr(c, 15, yt + 27, 9, Hp - 32, wood[0]); dfr(c, 15, yt + 27, 3, Hp - 32, wood[1]);
      dfTri(c, 82, yt + 24, 70, yt + 28, 70, yb - 4, wood[3]); dfTri(c, 82, yt + 24, 82, yb, 70, yb - 4, wood[3]);
      dfr(c, 72, yt + 27, 9, Hp - 32, wood[0]); dfr(c, 78, yt + 27, 3, Hp - 32, wood[2]);
      dfr(c, 28, yb - 10, 40, 10, 'rgba(180,150,100,0.18)');
    }
    dfWallDamage(c, { x0: 0, x1: 96 }, dmg, yt + 10, yb, stone, seed);
  } else {
    // стена идёт с севера на юг: проход поперёк — виден боком
    const yb = 96 + M;
    const post = (y0, y1) => {
      const hb = 66, ybb = y1 + M, ytt = ybb - hb;
      dfr(c, 33, ytt, 30, hb, B[3]); dfr(c, 34, ytt + 1, 28, hb - 1, B[0]); dfr(c, 34, ytt + 1, 6, hb - 1, B[1]); dfr(c, 56, ytt + 1, 6, hb - 1, B[2]);
      dfr(c, 31, ytt - 5, 34, 7, B[3]); dfr(c, 32, ytt - 4, 32, 5, B[1]);
      if (stone) for (let y = ytt + 10; y < ybb; y += 12) dfr(c, 34, y, 28, 1, B[2]);
      else for (let y = ytt + 8; y < ybb; y += 16) dfr(c, 34, y, 28, 3, B[3]);
    };
    dfr(c, 36, yb - 3, 34, 6, 'rgba(10,8,4,0.3)');
    if (!open) {
      // створка перегораживает проход: доски поперёк
      dfr(c, 33, yb - 58, 30, 60, wood[3]);
      for (let y = yb - 56; y < yb - 4; y += 9) { dfr(c, 34, y, 28, 8, wood[0]); dfr(c, 34, y, 28, 2, wood[1]); dfr(c, 34, y + 6, 28, 2, wood[2]); }
      dfr(c, 38, yb - 44, 3, 36, DFC.iron[2]); dfr(c, 56, yb - 44, 3, 36, DFC.iron[2]);
      dfr(c, 45, yb - 30, 6, 6, DFC.iron[1]);
      post(0, 96);
    } else {
      post(0, 22); post(74, 96);
      dfr(c, 36, yb - 78 - 2, 26, 6, B[3]);                                                          // балка поверху между столбами
    }
  }
  c.restore();
}

// ---------- Баррикада ----------
function dfBarricade(c, L, dmg, M, seed) {
  const yb = 76 + M, P = DFC.wood;
  dfr(c, 14, yb - 2, 70, 7, 'rgba(10,8,4,0.3)');
  const log = (x0, y0, x1, y1, th) => {
    c.save(); c.lineCap = 'butt';
    c.strokeStyle = P[3]; c.lineWidth = th + 2; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    c.strokeStyle = P[0]; c.lineWidth = th; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    c.strokeStyle = P[1]; c.lineWidth = 2; c.beginPath(); c.moveTo(x0, y0 - th / 3); c.lineTo(x1, y1 - th / 3); c.stroke();
    c.restore();
    dfTri(c, x1, y1 - th / 2 - 1, x1 + (x1 > x0 ? 10 : -10), y1 - 4, x1, y1 + th / 2 + 1, P[4]);
    dfTri(c, x0, y0 - th / 2 - 1, x0 + (x0 > x1 ? 10 : -10), y0 - 4, x0, y0 + th / 2 + 1, P[4]);
  };
  const broke = dmg >= 2;
  log(14, yb - 6, 82, yb - 44, 9);
  if (!broke) log(82, yb - 6, 14, yb - 44, 9);
  log(10, yb - 22, 86, yb - 28, 8);
  if (L >= 2) {
    for (let x = 22; x < 80; x += 12) { dfTri(c, x, yb - 24, x + 3, yb - 40, x + 6, yb - 24, DFC.iron[1]); dfTri(c, x, yb - 24, x + 3, yb - 36, x + 3, yb - 24, DFC.iron[2]); }
    for (const x of [8, 66]) { dfr(c, x + 1, yb - 12, 24, 12, '#6a5a3a'); dfr(c, x + 3, yb - 14, 20, 4, '#a8946a'); dfr(c, x + 3, yb - 14, 20, 1, '#cdb88a'); dfr(c, x + 4, yb - 6, 16, 2, '#5a4a2c'); }
  }
  dfr(c, 44, yb - 28, 8, 6, '#a0885a'); dfr(c, 44, yb - 28, 8, 1, '#c8b080');                          // верёвка
}

// ---------- Ловушки ----------
function dfPit(c, o, M, seed) {
  const yb = 54 + M, L = o.lv, r = mulberry32(seed);
  c.fillStyle = '#4a3220'; c.beginPath(); c.ellipse(48, yb, 38, 19, 0, 0, 7); c.fill();
  c.fillStyle = '#8a6a44'; c.beginPath(); c.ellipse(48, yb - 2, 36, 17, 0, 0, 7); c.fill();
  c.fillStyle = '#6a4a2a'; c.beginPath(); c.ellipse(48, yb, 32, 15, 0, 0, 7); c.fill();
  c.fillStyle = '#150d07'; c.beginPath(); c.ellipse(48, yb + 1, 27, 12, 0, 0, 7); c.fill();
  if (L >= 2) for (let k = 0; k < 7; k++) { const x = 28 + k * 6.5, h = 7 + (k * 5 % 4); dfTri(c, x - 2, yb + 8, x, yb + 8 - h, x + 2, yb + 8, '#d8c090'); }
  // хворост поверх, неплотно
  const sticks = o.hp > 1 ? 5 : 3;
  for (let k = 0; k < sticks; k++) { const a = r() * 3.1, x = 48 + (r() - 0.5) * 26, y = yb + (r() - 0.5) * 10; c.strokeStyle = k % 2 ? '#7a5a30' : '#5a3a1c'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - Math.cos(a) * 14, y - Math.sin(a) * 5); c.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 5); c.stroke(); }
  for (let k = 0; k < 6; k++) dfr(c, 24 + r() * 48, yb - 10 + r() * 20, 4, 3, k % 2 ? '#4a6e30' : '#6a8a3a');            // листья
}
function dfSpike(c, o, M, seed) {
  const yb = 66 + M, L = o.lv;
  dfr(c, 14, yb - 14, 70, 22, 'rgba(10,8,4,0.3)');
  dfr(c, 14, yb - 22, 68, 24, '#34302a'); dfr(c, 15, yb - 21, 66, 22, '#68635a'); dfr(c, 15, yb - 21, 66, 3, '#928d82');
  const col = L >= 2 ? '#c4c4d4' : '#b8a888', dk = L >= 2 ? '#6a6a7a' : '#6a5a40', hh = L >= 2 ? 22 : 17;
  for (let row = 0; row < 3; row++) for (let k = 0; k < 6; k++) {
    const x = 20 + k * 10 + (row % 2) * 5, y = yb - 16 + row * 6;
    dfTri(c, x, y + 4, x + 3, y - hh + row * 2, x + 6, y + 4, dk); dfTri(c, x, y + 4, x + 3, y - hh + row * 2, x + 3, y + 4, col);
  }
}
function dfFireTrap(c, o, M, seed) {
  const yb = 56 + M, L = o.lv;
  c.fillStyle = '#34302a'; c.beginPath(); c.ellipse(48, yb, 34, 18, 0, 0, 7); c.fill();
  c.fillStyle = '#928d82'; c.beginPath(); c.ellipse(48, yb - 2, 33, 16, 0, 0, 7); c.fill();
  c.fillStyle = '#68635a'; c.beginPath(); c.ellipse(48, yb, 28, 13, 0, 0, 7); c.fill();
  c.fillStyle = '#1c120c'; c.beginPath(); c.ellipse(48, yb, 22, 10, 0, 0, 7); c.fill();
  for (let k = 0; k < 9; k++) dfr(c, 34 + (k * 17 % 28), yb - 6 + (k * 7 % 12), 3, 2, k % 3 ? '#a03a1a' : '#e07a2a');
  // руны по кольцу
  for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28; dfr(c, 48 + Math.cos(a) * 26 - 1, yb - 1 + Math.sin(a) * 12, 3, 3, L >= 2 ? '#ffb040' : '#c06a2a'); }
}
function dfTorch(c, o, M, seed) {
  const yb = 66 + M, L = o.lv;
  dfr(c, 36, yb - 2, 26, 6, 'rgba(10,8,4,0.3)');
  if (L >= 2) {
    const S = DFC.stone;
    dfTri(c, 36, yb, 42, yb - 30, 56, yb - 30, S[3]); dfTri(c, 62, yb, 56, yb - 30, 42, yb - 30, S[3]);
    dfr(c, 38, yb - 6, 22, 6, S[3]); dfr(c, 39, yb - 5, 20, 4, S[0]); dfr(c, 39, yb - 5, 20, 1, S[1]);
    dfr(c, 44, yb - 28, 10, 24, S[0]); dfr(c, 44, yb - 28, 3, 24, S[1]); dfr(c, 51, yb - 28, 3, 24, S[2]);
    dfTri(c, 34, yb - 44, 42, yb - 28, 56, yb - 28, DFC.iron[2]); dfTri(c, 64, yb - 44, 56, yb - 28, 42, yb - 28, DFC.iron[2]);
    dfr(c, 34, yb - 46, 30, 4, DFC.iron[0]); dfr(c, 36, yb - 45, 26, 1, DFC.iron[1]);
    dfr(c, 38, yb - 44, 22, 5, '#2a1c12');
  } else {
    dfr(c, 44, yb - 52, 8, 54, DFC.wood[3]); dfr(c, 45, yb - 52, 6, 54, DFC.wood[0]); dfr(c, 45, yb - 52, 2, 54, DFC.wood[1]); dfr(c, 49, yb - 52, 2, 54, DFC.wood[2]);
    dfr(c, 40, yb - 60, 16, 14, '#2a1c12'); dfr(c, 41, yb - 59, 14, 12, '#5a3a20'); dfr(c, 41, yb - 59, 14, 3, '#7a5430');
    dfr(c, 40, yb - 53, 16, 3, DFC.iron[2]);
    dfr(c, 38, yb - 6, 20, 6, '#68635a'); dfr(c, 39, yb - 5, 18, 4, '#928d82');                         // камни у подножия
  }
}

// ---------- Кэш спрайтов ----------
function fortSprite(o, mask) {
  const dmg = FORTS[o.f].hp ? dfDmg(o) : 0;
  const gk = o.f === 'gate' ? `${o.m}${o.open ? 'o' : 'c'}` : '';
  const trapHp = FORTS[o.f].trap ? (o.hp > 1 ? 1 : 0) : 0;
  const key = `${o.f}|${o.lv}|${mask}|${dmg}|${gk}|${trapHp}`;
  let s = DFA.cache.get(key);
  if (s) return s;
  const cv = mkCanvas(DFA.W, 96 + DFA.M), c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  const M = DFA.M, seed = hashStr(key) >>> 0;
  switch (o.f) {
    case 'wall_wood': case 'wall_stone': {
      const bs = dfBoxes(mask);
      bs.forEach((g, k) => (o.f === 'wall_wood' ? dfWallWood : dfWallStone)(c, g, o.lv, k === bs.length - 1 ? dmg : 0, M, seed));
      break;
    }
    case 'gate': dfGate(c, mask, o, M, seed); break;
    case 'barricade': dfBarricade(c, o.lv, dmg, M, seed); break;
    case 'pit': dfPit(c, o, M, seed); break;
    case 'spike': dfSpike(c, o, M, seed); break;
    case 'fire': dfFireTrap(c, o, M, seed); break;
    case 'torch': dfTorch(c, o, M, seed); break;
  }
  s = { cv };
  DFA.cache.set(key, s);
  return s;
}

// Мировая клетка (x, y) <- спрайт: клетка в нижней части холста, запас M над ней
function drawFort(c, x, y, o) {
  const px = x * TILE, py = y * TILE, k = TILE / DFA.W;
  let mask = fortIsWall(o) ? fortMask(x, y) : 0;
  if (fortIsWall(o)) { const sh = fortShift(x, y, mask); mask |= sh.sx << 4 | sh.sy << 6; }
  // закрытые ворота открываются перед жителем: проходят все, кроме нечисти
  let sp = o;
  if (o.f === 'gate' && !o.open && o.bt === undefined) {
    for (const u of Game.units) if (!u.inside && !u.dead && Math.abs(u.x - x - 0.5) < 1.4 && Math.abs(u.y - y - 0.5) < 1.4) { sp = Object.assign({}, o, { open: true }); break; }
  }
  const s = fortSprite(sp, mask);
  const sm = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = false;
  const done = o.bt === undefined;
  if (!done) {
    // стройка: проявляется снизу вверх, вокруг леса
    const q = Math.max(0.08, o.bt), H = s.cv.height;
    c.save(); c.beginPath(); c.rect(px - 2, py - DFA.M * k + H * k * (1 - q), TILE + 4, H * k * q + 2); c.clip();
    c.globalAlpha = 0.9; c.drawImage(s.cv, px, py - DFA.M * k, TILE, H * k);
    c.restore();
    c.globalAlpha = 1;
    dfScaffold(c, px, py, q, o);
  } else {
    c.drawImage(s.cv, px, py - DFA.M * k, TILE, s.cv.height * k);
    if (o.up !== undefined) dfScaffold(c, px, py, 0.35 + 0.5 * o.up, o);
  }
  c.imageSmoothingEnabled = sm;
  // живые огни
  if (done) {
    const t = Game.time, seed = x * 7 + y * 13;
    if (o.f === 'torch') {
      const fy = py + (o.lv >= 2 ? 14 : 12) + 4;
      drawFire(c, px + 16, fy + (o.lv >= 2 ? 3 : 2), o.lv >= 2 ? 'torch' : 'spark', t, seed, { glow: nightAmt() > 0.2 ? 0.5 : 0 });
    } else if (o.f === 'fire') {
      const hot = o.flash !== undefined && Game.time - o.flash < 1.6 && Game.time >= o.flash;
      if (hot) drawFire(c, px + 16, py + 22, o.lv >= 2 ? 'blaze' : 'camp', t, seed, { glow: 1 });
      else if (nightAmt() > 0.3) drawFire(c, px + 16, py + 22, 'tiny', t, seed, { glow: 0 });
    }
  }
}

function dfScaffold(c, px, py, q, o) {
  c.save();
  c.strokeStyle = '#d8c090'; c.lineWidth = 1.2;
  const top = py + 24 - 22 * Math.max(q, 0.4);
  c.beginPath();
  c.moveTo(px + 2, py + 28); c.lineTo(px + 2, top); c.moveTo(px + 30, py + 28); c.lineTo(px + 30, top);
  c.moveTo(px + 2, py + 17); c.lineTo(px + 30, py + 17);
  if (q > 0.5) { c.moveTo(px + 2, py + 8); c.lineTo(px + 30, py + 8); }
  c.stroke();
  c.fillStyle = 'rgba(120,90,50,0.8)'; c.fillRect(px + 4, py + 17, 24, 1.4);
  c.restore();
}

// Иконка для меню: короткий кусок стены, ворота между двумя секциями и т. п.
function defIconURL(f) {
  if (DFA.icons && DFA.icons[f]) return DFA.icons[f];
  DFA.icons = DFA.icons || {};
  const F = FORTS[f], wallish = F.blk || f === 'gate';
  const tiles = wallish ? 3 : 1;
  const W = DFA.W, H = 96 + DFA.M;
  const cv = mkCanvas(W * tiles, H), c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  const mk = (ff, extra) => Object.assign({ t: 'fort', f: ff, lv: 1, hp: 999, bt: undefined }, extra || {});
  const wf = f === 'gate' ? 'wall_wood' : f;
  const cells = wallish ? (f === 'gate' ? [[wf, 2], [f, 10], [wf, 8]] : [[f, 2], [f, 10], [f, 8]]) : [[f, 0]];
  cells.forEach(([ff, mask], i) => {
    const o = mk(ff, ff === 'gate' ? { m: 'wood', open: true, mode: 'auto' } : null);
    o.hp = FORTS[ff].hp ? FORTS[ff].hp[0] : FORTS[ff].charges[0];
    c.drawImage(fortSprite(o, mask).cv, i * W, 0);
  });
  // обрезать пустые поля
  const d = c.getImageData(0, 0, cv.width, cv.height).data;
  let x0 = cv.width, y0 = cv.height, x1 = 0, y1 = 0;
  for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (d[(y * cv.width + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const w = x1 - x0 + 1, h = y1 - y0 + 1, k = Math.min(144 / w, 100 / h, 1.4);
  const ic = mkCanvas(144, 108), ci = ic.getContext('2d');
  ci.imageSmoothingEnabled = k < 1;
  ci.drawImage(cv, x0, y0, w, h, (144 - w * k) / 2, 106 - h * k, w * k, h * k);
  if (f === 'torch') { /* огонь на иконке не рисуем */ }
  return (DFA.icons[f] = ic.toDataURL());
}

// ================= Башня: модель в стиле зданий =================

Object.assign(MODELS, {
  watchtower(m) {
    const L2 = m.lv === 2, H = TOWER_H[L2 ? 1 : 0], r = TOWER_R, tp = 0.88;
    m.ground((c, mm) => {
      groundPoly(c, mm, [[2, 2], [62, 2], [62, 62], [2, 62]], 'rgba(90,76,52,0.35)');
      for (const [x, y] of [[8, 8], [56, 10], [10, 56]]) { const q = mm.at(x, y); ellipse(c, q[0], q[1], 5, 1.8, 'rgba(60,54,40,0.5)'); }
    });
    // каменный ствол с дверью, шире у основания
    m.tower({
      x: 32, y: 32, r, h: H, taper: tp, col: L2 ? '#aaa28e' : '#9a9484',
      roof: L2 ? null : { h: TOWER_ROOF, mat: 'tiles', col: '#a05a38', ov: 4 }, finial: L2 ? null : true,
      gallery: TOWER_GZ[0] + 4 + (L2 ? 14 : 0),
      decor: [{ t: 'door', a: -12, z: 0, w: 10, h: 17, o: { frame: 'stone', col: '#3a2414' } },
        { t: 'win', a: 38, z: L2 ? 30 : 26, w: 4, h: 9, o: { arch: true, stone: true } }, { t: 'win', a: -52, z: L2 ? 40 : 34, w: 4, h: 9, o: { arch: true, stone: true, lit: true } }],
    });
    if (L2) {
      // зубчатая площадка: плиты внутри, зубцы по передней дуге (рисуется поверх ствола — ключ мал)
      m.custom((c, mm) => {
        const ring = (rr, z) => { const a = []; for (let k = 0; k < 40; k++) { const t = k / 40 * Math.PI * 2; a.push(mm.at(32 + Math.cos(t) * rr, 32 + Math.sin(t) * rr, z)); } return a; };
        const rr = r * tp + 1.5;
        poly(c, ring(rr, H), '#4e4a58', 'rgba(15,10,6,0.7)', 0.6);
        poly(c, ring(rr - 3, H - 1), '#8a806c');
        poly(c, ring(rr - 3, H - 1), null, 'rgba(30,20,10,0.4)', 0.4);
        for (let k = 0; k < 16; k++) {
          const t = Math.PI * 0.6 + k * 0.33;
          if (Math.sin(t) > 0.25) continue;
          const a = mm.at(32 + Math.cos(t) * (rr - 1), 32 + Math.sin(t) * (rr - 1), H), b = mm.at(32 + Math.cos(t) * (rr - 1), 32 + Math.sin(t) * (rr - 1), H + 9);
          c.fillStyle = '#4a4650'; c.fillRect(a[0] - 2.6, b[1] - 0.6, 5.2, a[1] - b[1] + 0.6);
          c.fillStyle = '#9a96a4'; c.fillRect(a[0] - 2, b[1], 4, a[1] - b[1]);
          c.fillStyle = '#c8c4d0'; c.fillRect(a[0] - 2, b[1], 4, 1.4); c.fillStyle = '#6e6a78'; c.fillRect(a[0] + 0.6, b[1] + 1.4, 1.4, a[1] - b[1] - 1.4);
        }
      }, 32, 4);
    }
    // дрова и бочка у входа
    m.prop((c, x, y) => logPile(c, x, y, 2, 7), 5, 6);
    m.prop((c, x, y) => { c.fillStyle = '#2a1a0c'; c.fillRect(x - 3.6, y - 7.6, 7.2, 8); c.fillStyle = '#5a3a1c'; c.fillRect(x - 3, y - 7, 6, 7); c.fillStyle = '#8a6a44'; c.fillRect(x - 3, y - 7, 2, 7); c.fillStyle = '#3a3a44'; c.fillRect(x - 3, y - 5, 6, 1); c.fillRect(x - 3, y - 2, 6, 1); }, 58, 6);
  },
});
NO_GREEN.add('watchtower');

// ================= Башня: дозорный, стражи, маяк =================

// Маленький гном на площадке. kind: sent | archer | warrior
function defMiniGnome(c, x, y, kind, face, t, aim) {
  x = Math.round(x); y = Math.round(y);
  const hat = kind === 'archer' ? '#3a7a2a' : kind === 'warrior' ? '#7a7a88' : '#b03a2e';
  const tun = kind === 'archer' ? '#4a6a3a' : kind === 'warrior' ? '#5a5a66' : '#7a4a2a';
  const bob = Math.round(Math.sin(t * 2 + x) * 0.6);
  y += bob;
  c.fillStyle = 'rgba(10,8,4,0.3)'; c.fillRect(x - 3, y, 7, 1);
  c.fillStyle = '#2a1a0c'; c.fillRect(x - 3, y - 7, 6, 7);                    // контур тела
  c.fillStyle = tun; c.fillRect(x - 2, y - 6, 4, 5);
  c.fillStyle = '#3a2a1a'; c.fillRect(x - 2, y - 3, 4, 1);                    // пояс
  c.fillStyle = '#e8b890'; c.fillRect(x - 2, y - 10, 4, 4);                   // лицо
  c.fillStyle = '#ece6d8'; c.fillRect(x - 2, y - 7, 4, 3); c.fillRect(x - 1, y - 4, 2, 1);   // борода
  c.fillStyle = '#e8b890'; c.fillRect(x - 1 + face, y - 9, 1, 1);
  c.fillStyle = '#1a1008'; c.fillRect(x + face - (face > 0 ? 0 : 1), y - 9, 1, 1);
  if (kind === 'warrior') {
    c.fillStyle = hat; c.fillRect(x - 3, y - 13, 6, 3); c.fillStyle = '#b0b0bc'; c.fillRect(x - 3, y - 13, 6, 1); c.fillRect(x - 1, y - 14, 2, 1);
    c.fillStyle = '#6a4a2a'; c.fillRect(x + face * 4 - (face > 0 ? 0 : 1), y - 16, 1, 15);                     // копьё
    c.fillStyle = '#d0d0dc'; c.fillRect(x + face * 4 - (face > 0 ? 0 : 1), y - 18, 1, 3);
  } else {
    c.fillStyle = '#2a1a0c'; c.fillRect(x - 3, y - 11, 6, 2);
    c.fillStyle = hat; c.fillRect(x - 3, y - 11, 6, 1.5); c.fillRect(x - 2, y - 13, 4, 2); c.fillRect(x - 1 + face, y - 15, 2, 2); c.fillRect(x + face, y - 16, 1, 1);
    if (kind === 'archer' && !aim) { c.strokeStyle = '#8a5a30'; c.lineWidth = 1; c.beginPath(); c.arc(x + face * 4, y - 6, 4, face > 0 ? -1.2 : Math.PI - 1.2, face > 0 ? 1.2 : Math.PI + 1.2); c.stroke(); }
    if (kind === 'sent') { c.fillStyle = '#c8a050'; c.fillRect(x + face * 3 - (face > 0 ? 0 : 3), y - 7, 3, 1); }              // подзорная труба
  }
  if (aim) { c.strokeStyle = '#8a5a30'; c.lineWidth = 1; c.beginPath(); c.arc(x + face * 4, y - 6, 4, face > 0 ? -1.2 : Math.PI - 1.2, face > 0 ? 1.2 : Math.PI + 1.2); c.stroke(); }
}

// Слоты на передней дуге площадки (индекс 0 — дозорный)
function defSlot(b, n) {
  const L2 = (b.level || 1) >= 2, gz = TOWER_GZ[L2 ? 1 : 0], r = L2 ? TOWER_R * 0.88 - 3 : TOWER_R + 1;
  const ang = Math.PI * 1.5 + [0, -0.62, 0.62, 1.2][n % 4] * (L2 ? 1 : 0.8);
  const X = 32 + Math.cos(ang) * r, Y = 32 + Math.sin(ang) * r;
  return [b.x * TILE + X + Y * 0.5, b.y * TILE + 64 - Y * 0.78 - gz];
}

function defTowerDraw(c, b) {
  const T = DEF.towers.get(b.id) || (Game.dtowers || []).find(q => q.b === b.id);
  const t = Game.time, L2 = (b.level || 1) >= 2;
  const alert = T && t - T.al < 8 && t >= T.al;
  const act = T && t - T.act < 0.6 && t >= T.act;
  // дозорный
  const sx = defSlot(b, 0);
  defMiniGnome(c, sx[0], sx[1], 'sent', 1, t, act);
  if (T) T.g.forEach((g, i) => { const p = defSlot(b, i + 1); defMiniGnome(c, p[0], p[1], g.c, i % 2 ? 1 : -1, t + i, act); });
  // огонь на вершине: ночью и при тревоге — маяк
  const ax = b.x * TILE + 32 + 16, ay = b.y * TILE + 64 - 0.78 * 32 - (L2 ? TOWER_H[1] + 6 : TOWER_H[0] + TOWER_ROOF + 6);
  if (alert || nightAmt() > 0.25 || isEveningNow()) {
    drawFire(c, ax, ay + (L2 ? 2 : 3), alert ? 'camp' : 'spark', t, b.id, { glow: alert ? 1.4 : 0.7 });
  }
  if (alert) {
    c.fillStyle = '#e04030'; c.fillRect(Math.round(sx[0]) - 1, Math.round(sx[1]) - 28, 3, 7); c.fillRect(Math.round(sx[0]) - 1, Math.round(sx[1]) - 19, 3, 3);
  }
}

// ================= Стрелы =================

function defShotsDraw(c) {
  for (const s of Game.dshots || []) {
    const q = (Game.time - s.born) / s.dur;
    if (q < 0 || q > 1) continue;
    const x = (s.x + (s.gx - s.x) * q) * TILE, y = (s.y + (s.gy - s.y) * q) * TILE - Math.sin(q * Math.PI) * 10;
    const dx = (s.gx - s.x) * TILE, dy = (s.gy - s.y) * TILE - Math.cos(q * Math.PI) * 10, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
    const len = s.k === 'spear' ? 9 : 6;
    c.strokeStyle = s.k === 'spear' ? '#8a6a3a' : '#e8d8b0'; c.lineWidth = s.k === 'spear' ? 1.6 : 1;
    c.beginPath(); c.moveTo(x - ux * len, y - uy * len); c.lineTo(x, y); c.stroke();
    c.fillStyle = '#d8d8e4'; c.fillRect(Math.round(x + ux * 1) - 1, Math.round(y + uy * 1) - 1, 2, 2);
  }
}

// Подключаем к кадру: башни и стрелы идут в общий список по глубине
function defDrawList(list, c, x0, y0, x1, y1) {
  for (const b of Game.buildings) {
    if (b.type !== 'watchtower' || b.state !== 'done') continue;
    if (b.x + b.w < x0 - 2 || b.x > x1 + 2 || b.y > y1 + 3 || b.y + b.h < y0 - 4) continue;
    list.push([b.y + b.h - 0.04, () => defTowerDraw(c, b)]);
  }
  if (Game.dshots && Game.dshots.length) list.push([y1 + 5, () => defShotsDraw(c)]);
}

// ================= Свет =================

if (typeof nightLights === 'function') {
  const _nl = nightLights;
  nightLights = function (x0, y0, x1, y1) {
    const L = _nl(x0, y0, x1, y1);
    for (let y = Math.max(0, y0 - 2); y <= Math.min(MAP_H - 1, y1 + 2); y++) for (let x = Math.max(0, x0 - 2); x <= Math.min(MAP_W - 1, x1 + 2); x++) {
      const o = World.obj[idx(x, y)];
      if (!o || o.t !== 'fort' || o.bt !== undefined) continue;
      if (o.f === 'torch') L.push([x * TILE + 16, y * TILE + 4, o.lv >= 2 ? 82 : 58, o.lv >= 2 ? 0.62 : 0.5]);
      else if (o.f === 'fire') {
        const hot = o.flash !== undefined && Game.time - o.flash < 2 && Game.time >= o.flash;
        L.push([x * TILE + 16, y * TILE + 14, hot ? 96 : 22, hot ? 0.9 : 0.25]);
      }
    }
    for (const b of Game.buildings) {
      if (b.type !== 'watchtower' || b.state !== 'done' || b.x + b.w < x0 - 6 || b.x > x1 + 6 || b.y + b.h < y0 - 8 || b.y > y1 + 6) continue;
      const T = (Game.dtowers || []).find(q => q.b === b.id), alert = T && Game.time - T.al < 8 && Game.time >= T.al;
      L.push([(b.x + 1.1) * TILE, b.y * TILE - 6, alert ? 128 : 74, alert ? 0.95 : 0.6]);
    }
    return L;
  };
}

// ================= Подсветка при выборе места =================

function defPreview(c, h) {
  const tool = Game.tool;
  if (!tool || tool.kind !== 'fort') return;
  const F = FORTS[tool.f];
  const cells = F.noMulti ? [R.fortDrag ? R.fortDrag[0] : h] : R.fortDrag || [h];
  const total = {}, placed = [];
  let n = 0;
  for (const [x, y] of cells) {
    const px = x * TILE, py = y * TILE;
    let err = defCheck(tool.f, x, y, true);
    if (!err && tool.f === 'torch' && placed.some(([a, b]) => Math.abs(a - x) < 2 && Math.abs(b - y) < 2)) err = 'близко';   // факелы через клетку
    if (!err) {
      for (const g in F.cost[0]) total[g] = (total[g] || 0) + F.cost[0][g];
      const lack = defHave(total);
      if (lack) err = defNeedText(lack);
    }
    c.fillStyle = err ? 'rgba(220,40,30,0.38)' : 'rgba(60,220,80,0.32)';
    c.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
    if (!err) {
      n++; placed.push([x, y]);
      const o = { t: 'fort', f: tool.f, lv: 1, hp: F.hp ? F.hp[0] : F.charges[0], m: 'wood', open: true };
      const sm = c.imageSmoothingEnabled; c.imageSmoothingEnabled = false;
      c.globalAlpha = 0.6;
      c.drawImage(fortSprite(o, 0).cv, px, py - DFA.M * TILE / DFA.W, TILE, (96 + DFA.M) * TILE / DFA.W);
      c.globalAlpha = 1; c.imageSmoothingEnabled = sm;
    }
    c.strokeStyle = err ? '#ff5040' : '#60ff80'; c.lineWidth = 1; c.strokeRect(px + 1.5, py + 1.5, TILE - 3, TILE - 3);
  }
  if (h && n) {
    const txt = `${F.name}${n > 1 ? ' ×' + n : ''}: ` + Object.entries(total).map(([g, q]) => q + ' ' + (GOOD_RU[g] || g)).join(', ');
    c.font = '11px sans-serif';
    const w = c.measureText(txt).width + 10, px = h[0] * TILE + 4, py = h[1] * TILE - 22;
    c.fillStyle = 'rgba(20,14,8,0.85)'; c.fillRect(px, py, w, 16);
    c.fillStyle = '#f0e0b8'; c.fillText(txt, px + 5, py + 12);
  }
}
