'use strict';
// Зимний и осенний вид мира. Ничего не запекается в холсты рельефа и не раздувает память:
//  · снег — небольшой атлас плиток 32×32 (16 вариантов краёв × 3 узора), рисуется только на клетках в кадре;
//    у берега, скал и построек снег обрывается неровной кромкой, дороги притоптаны (снег слабее);
//  · лёд — такой же атлас поверх воды (белая кромка у берега, трещины, блики);
//  · деревья, поля и валуны получают «снежные» и «осенние» копии спрайтов (по одной на спрайт, один раз);
//  · метель и листопад считаются от времени формулой без состояния — ни частиц, ни массивов;
//  · холодный и тёплый оттенок кадра, значок сезона у часов.
// Данные берутся из Game.sea (season.js): snow, ice — плавные 0..1.

const SNOW_VARS = 3;
const SNOWTILE = { snow: {}, ice: {} };
const snowH = (a, b) => { const n = Math.sin(a * 127.1 + b * 311.7 + 74.7) * 43758.5453; return n - Math.floor(n); };

// edge: биты 1/2/4/8 — сверху/справа/снизу/слева «жёсткий» край (скала, здание), биты 16/32/64/128 — те же стороны, но там вода
function snowTileMake(edge, v, ice) {
  const cv = document.createElement('canvas'); cv.width = cv.height = TILE;
  const g = cv.getContext('2d'), img = g.createImageData(TILE, TILE), d = img.data;
  const wob = (k, t) => 1 + snowH(k * 9 + v, t * 3) * 2.4 + snowH(k * 5, t) * 1.5;   // глубина обрыва, px
  const wat = (k, t) => ice ? 0 : snowH(k * 7 + v, t * 3) * 1.1;                     // у воды снег почти до кромки, лёд заходит под берег
  const cut = (bit, k, t) => (edge & bit ? wob(k, t) : edge & (bit << 4) ? wat(k, t) : -99);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    let depth = 99, c0;
    if ((c0 = cut(1, 1, x)) > -99) depth = Math.min(depth, y - c0);
    if ((c0 = cut(4, 2, x)) > -99) depth = Math.min(depth, TILE - 1 - y - c0);
    if ((c0 = cut(8, 3, y)) > -99) depth = Math.min(depth, x - c0);
    if ((c0 = cut(2, 4, y)) > -99) depth = Math.min(depth, TILE - 1 - x - c0);
    if (depth < 0) continue;
    const h = snowH(x + v * 31, y + v * 17), h2 = snowH(x * 0.3 + v, y * 0.3 + 5);
    let r, gc, b;
    if (!ice) {
      // снег: белый с голубоватыми тенями и редкими искрами
      const sh = h2 < 0.3 ? 14 : h2 > 0.75 ? 0 : 6;
      r = 238 - sh; gc = 245 - sh * 0.7; b = 252 - sh * 0.3;
      if (h > 0.96) { r = gc = b = 255; } else if (h < 0.05) { r -= 14; gc -= 10; b -= 3; }
      if (depth < 1.2) { r -= 26; gc -= 14; b -= 4; }      // голубая тень на кромке
    } else {
      // лёд: бирюзовая глубина, светлые полосы, трещины
      const streak = Math.sin((x * 0.5 + y * 0.9 + v * 7) * 0.7) * 0.5 + 0.5;
      r = 150 + streak * 40 + h * 14; gc = 205 + streak * 30; b = 232 + streak * 14;
      if (h > 0.985) { r = gc = b = 255; }
      if (depth < 1.6) { r = 232; gc = 244; b = 252; }       // белая кромка замёрзшего берега
      else if (depth < 3) { r -= 14; gc -= 8; }
    }
    const o = (y * TILE + x) * 4;
    d[o] = r; d[o + 1] = gc; d[o + 2] = b; d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  if (ice) {   // трещины-ломаные
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1;
    g.beginPath();
    let px = snowH(v, 1) * TILE, py = snowH(v, 2) * TILE;
    g.moveTo(px, py);
    for (let k = 0; k < 4; k++) { px += (snowH(v + k, 3) - 0.5) * 18; py += (snowH(v + k, 4) - 0.35) * 14; g.lineTo(px, py); }
    g.stroke();
    g.strokeStyle = 'rgba(90,150,200,0.55)'; g.beginPath(); g.moveTo(px - 3, py + 1); g.lineTo(px + 6, py - 4); g.stroke();
  }
  return cv;
}
// плитки строятся по требованию (на карте встречается лишь десяток-другой сочетаний краёв)
function snowTile(e, v, ice) {
  const m = ice ? SNOWTILE.ice : SNOWTILE.snow, k = e * 4 + v;
  return m[k] || (m[k] = snowTileMake(e, v, ice));
}

const snowable = i => { const t = World.terrain[i]; return t === T_GRASS || t === T_SAND; };

function snowDrawGround(c, x0, y0, x1, y1) {
  const S = SEA();
  if (S.snow < 0.02 && S.ice < 0.02) return;
  const T = World.terrain, W = MAP_W, H = MAP_H;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * W + x, t = T[i];
    const v = (x * 7 + y * 13 + ((x * y) & 3)) % SNOW_VARS;
    if (t === T_WATER) {
      if (S.ice < 0.02) continue;
      const nw = j => T[j] !== T_WATER;
      const e = (y > 0 && nw(i - W) ? 1 : 0) | (x < W - 1 && nw(i + 1) ? 2 : 0) | (y < H - 1 && nw(i + W) ? 4 : 0) | (x > 0 && nw(i - 1) ? 8 : 0);
      c.globalAlpha = Math.min(1, S.ice) * 0.94;
      const m = typeof OCN !== 'undefined' && OCN.on && OCN.m9 ? OCN.m9[i] : 0;   // у берега — по скруглённой линии (ocean.js)
      const sn = S.snow > 0.5;   // сухой угол клетки воды — под снегом
      c.drawImage(m ? oceanIceTile(snowTile(0, v, true), sn ? snowTile(0, v, false) : null, m, true, 'w' + v + ':' + m + (sn ? 's' : '')) : snowTile(e << 4, v, true), x * TILE, y * TILE);
    } else if ((t === T_GRASS || t === T_SAND) && S.snow >= 0.02) {
      const ns = (j, bit) => (T[j] === T_WATER ? bit << 4 : !snowable(j) || World.bmap[j] !== 0 ? bit : 0);
      const e = (y > 0 ? ns(i - W, 1) : 0) | (x < W - 1 ? ns(i + 1, 2) : 0) | (y < H - 1 ? ns(i + W, 4) : 0) | (x > 0 ? ns(i - 1, 8) : 0);
      c.globalAlpha = Math.min(1, S.snow) * (World.road[i] ? 0.42 : 0.93);
      const m = typeof OCN !== 'undefined' && OCN.on && OCN.m9 && S.ice > 0.5 ? OCN.m9[i] : 0;
      c.drawImage(m ? oceanIceTile(snowTile(e & 15, v, false), snowTile(0, v, true), m, false, 'l' + (e & 15) + ':' + v + ':' + m) : snowTile(e, v, false), x * TILE, y * TILE);
    }
  }
  c.globalAlpha = 1;
}

// ---------- Сезонные копии спрайтов ----------

const SEAV = { mode: 'base', base: null, cache: {}, key: '' };

function seaRecolor(src, mode, seed) {
  const w = src.width, h = src.height, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4;
    if (!d[o + 3]) continue;
    let r = d[o], gr = d[o + 1], b = d[o + 2];
    const hh = snowH(x * 1.7 + seed, y * 1.3 + seed * 3), top = 1 - y / h;
    const greenish = gr > r * 1.05 && gr > b * 1.1;
    if (mode === 'au1' || mode === 'au2') {
      if (!greenish) continue;
      const k = hh * 0.7 + snowH(Math.floor(x / 5) + seed, Math.floor(y / 5)) * 0.6;   // пятнами
      const late = mode === 'au2';
      const th = late ? 0.25 : 0.62;
      if (k < th) continue;             // часть листвы ещё зелёная
      const l = (r + gr + b) / 3 / 120;
      const pal = late ? (k > 1.0 ? [200, 70, 28] : k > 0.7 ? [226, 120, 30] : [214, 168, 40]) : (k > 1.0 ? [226, 150, 36] : [208, 190, 54]);
      r = pal[0] * l; gr = pal[1] * l; b = pal[2] * l;
    } else if (mode === 'win') {
      // снег на кронах и камнях: сверху гуще, зелёные и серые светлые места белеют
      const lum = (r + gr + b) / 3;
      const brown = r > gr * 1.08 && r > b * 1.3;
      const p = (brown && top < 0.5 ? 0.15 : 0.9) * Math.pow(top, 0.7) + 0.12 + (seed >= 100 ? 0.0 : 0);
      if (hh < p && (greenish || (seed >= 100 && lum > 70) || lum > 150)) { const f = 0.25 + hh * 0.5; r = 236 - f * 20; gr = 243 - f * 18; b = 252 - f * 8; }
      else if (greenish) { r *= 0.85; gr *= 0.95; b *= 1.05; }
    } else if (mode === 'winf') {   // поле под снегом
      const p = 0.78;
      if (hh < p) { r = 236 - hh * 24; gr = 243 - hh * 20; b = 252 - hh * 10; }
      else { r *= 0.8; gr *= 0.85; b *= 0.9; }
    }
    d[o] = Math.max(0, Math.min(255, r)); d[o + 1] = Math.max(0, Math.min(255, gr)); d[o + 2] = Math.max(0, Math.min(255, b));
  }
  g.putImageData(img, 0, 0);
  return cv;
}

function seaVariantsOf(list, mode, base, seedAdd) {
  const key = base + mode;
  if (!SEAV.cache[key]) SEAV.cache[key] = list.map((s, i) => seaRecolor(s, mode, i * 11 + seedAdd));
  return SEAV.cache[key];
}

// какой набор спрайтов нужен сейчас
function seaVisMode() {
  const S = SEA();
  if (S.snow > 0.35) return 'win';
  if (seaIdx() === 1) { const p = seaProgress(); return p < 0.12 ? 'base' : p < 0.55 ? 'au1' : 'au2'; }
  if (seaIdx() === 2) return 'au2';            // ранний снег ещё не лёг: листва уже облетела
  return 'base';
}
function seaApplySprites() {
  const mode = seaVisMode();
  if (mode === SEAV.mode || !SPR.trees.length) return;
  if (!SEAV.base) {
    SEAV.base = { trees: SPR.trees.slice(), boulders: SPR.boulders.slice(), fields: {} };
    for (const k in SPR.fields) SEAV.base.fields[k] = SPR.fields[k].slice();
  }
  SEAV.mode = mode;
  const B = SEAV.base;
  SPR.trees = mode === 'base' ? B.trees.slice() : seaVariantsOf(B.trees, mode === 'au2' ? 'au2' : mode, 'T', 0);
  SPR.boulders = mode === 'win' ? seaVariantsOf(B.boulders, 'win', 'B', 100) : B.boulders.slice();
  for (const k in B.fields) SPR.fields[k] = mode === 'win' ? seaVariantsOf(B.fields[k], 'winf', 'F' + k, 50) : B.fields[k].slice();
}

// ---------- Метель и листопад ----------

function snowFall(c) {
  const S = SEA();
  if (S.fall < 0.03 && !(S.snow > 0.1 && S.fall > 0.01)) return;
  const z = devScale(), vw = R.canvas.width / z, vh = R.canvas.height / z, cam = R.cam, t = Game.time;
  const n = Math.round(30 + 190 * Math.min(1, S.fall));
  c.fillStyle = '#ffffff';
  const wind = 14 + S.fall * 26;
  for (let i = 0; i < n; i++) {
    const a = snowH(i, 1), b = snowH(i, 2), sp = 24 + b * 26 + S.fall * 16;
    const fx = ((a * (vw + 80) + t * wind * (0.6 + b * 0.5) + Math.sin(t * 0.9 + i) * 8) % (vw + 80)) - 40;
    const fy = ((snowH(i, 3) * vh + t * sp) % (vh + 20)) - 10;
    const s = b > 0.7 ? 2 : 1;
    c.globalAlpha = 0.55 + b * 0.4;
    c.fillRect(Math.round(cam.x + fx), Math.round(cam.y + fy), s, s);
  }
  c.globalAlpha = 1;
}
function leafFall(c) {
  const S = SEA();
  if (seaIdx() !== 1) return;
  const p = Math.min(1, seaProgress() * 3), z = devScale(), vw = R.canvas.width / z, vh = R.canvas.height / z, cam = R.cam, t = Game.time;
  const n = Math.round(26 * p), cols = ['#d6a02a', '#d8661c', '#b8321c', '#e0c040'];
  for (let i = 0; i < n; i++) {
    const a = snowH(i, 5), b = snowH(i, 6), sp = 10 + b * 12;
    const fx = ((a * (vw + 60) + t * (8 + b * 10) + Math.sin(t * 1.3 + i * 2) * 14) % (vw + 60)) - 30;
    const fy = ((snowH(i, 7) * vh + t * sp) % (vh + 20)) - 10;
    c.fillStyle = cols[i & 3];
    const rot = Math.floor(t * 2 + i) & 1;
    c.fillRect(Math.round(cam.x + fx), Math.round(cam.y + fy), rot ? 3 : 2, rot ? 2 : 3);
  }
}
function seaTint(c) {
  const S = SEA(), z = devScale(), vw = R.canvas.width / z, vh = R.canvas.height / z, cam = R.cam;
  let col = null, a = 0;
  if (S.snow > 0.02) { col = '150,190,245'; a = 0.1 * S.snow; }
  else if (seaIdx() === 1) { col = '255,150,40'; a = 0.07 * Math.min(1, seaProgress() * 2.5); }
  if (!col || a < 0.004) return;
  c.fillStyle = `rgba(${col},${a.toFixed(3)})`;
  c.fillRect(cam.x - 2, cam.y - 2, vw + 4, vh + 4);
}

// ---------- Подключение к отрисовке ----------

{
  const _dws = drawWaterSparkles;
  drawWaterSparkles = function (c, x0, y0, x1, y1) {
    seaApplySprites();
    _dws(c, x0, y0, x1, y1);
    snowDrawGround(c, x0, y0, x1, y1);
  };
  const _dw = drawWeather;
  drawWeather = function (c) {
    _dw(c);
    seaTint(c);
    snowFall(c);
    leafFall(c);
    seaChip();
  };
  const _ui = updateUI;
  updateUI = function (f) { _ui(f); seaChip(); };
}

// ---------- Значок сезона у часов ----------

const SEA_GLYPH = ['☀', '🍂', '❄', '🌱'];
function seaChipText() {
  const S = SEA(), i = seaIdx(), d = seaDayIn() + 1;
  if (S.fixed != null) return SEA_GLYPH[i] + ' ' + SEA_NAMES[i];            // постоянный сезон биома — счётчик суток не нужен
  return SEA_GLYPH[i] + ' ' + SEA_NAMES[i] + (document.body.classList.contains('mobile') ? ` ${d}/${S.len}` : ` · день ${d} из ${S.len}`);
}
function seaChipTip() {
  const S = SEA(), i = seaIdx(), h = i === 1 || i === 2 ? (isMirror() ? S.hay : seaHayInfo()) : null;
  let tip = `${SEA_NAMES[i]}: день ${seaDayIn() + 1} из ${S.len}.` + (S.fixed == null ? ` Смена сезона через ${S.len - seaDayIn()} сут.` : '');
  if (i === 0) tip += ' Всё растёт. Осенью пора делать заготовки.';
  if (i === 1) tip += ' Осень: заготовь сено и зерно, зимой ничего не растёт.';
  if (i === 2) tip += ' Зима: снег, лёд, ничего не растёт; свиньи и звери едят сено.';
  if (i === 3) tip += ' Весна: снег тает, всё оживает.';
  if (h && h.need) tip += ` Сено: ${h.have} из ~${h.need} нужных.`;
  return tip;
}
function seaChip() {
  const el = document.getElementById('clock');
  if (!el || !Game.sea) return;
  const sec = Math.floor(Game.time), mm = String(Math.floor(sec / 60)).padStart(2, '0'), ss = String(sec % 60).padStart(2, '0');
  const txt = `${isNightNow() ? '☾' : isEveningNow() ? '◐' : '☀'} ${mm}:${ss} · ${seaChipText()}`;
  if (el.textContent !== txt) el.textContent = txt;
  if (Game.time - (seaChip.tt || -9) > 3) { seaChip.tt = Game.time; el.title = seaChipTip(); }
}

// ---------- Снежные шапки гор ----------
// Копия спрайта горы со снегом выше линии снега; линия опускается к зиме и поднимается к лету.
// Пять уровней, строятся лениво при первом показе и кэшируются (≤ 12 спрайтов × 5).

const MT_CAP = {};
const MT_CAP_LEVELS = [0.13, 0.22, 0.32, 0.43, 0.54];
function mtCapSprite(size, v, lv) {
  const key = size + v + '_' + lv;
  if (MT_CAP[key]) return MT_CAP[key];
  const src = mtSprite(size, v), w = src.width, h = src.height, frac = MT_CAP_LEVELS[lv];
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, w, h), d = img.data, seed = size.charCodeAt(0) * 31 + v * 7;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (!d[o + 3]) continue;
      const edge = frac * h * (0.8 + snowH(Math.floor(x / 3) + seed, 3) * 0.4) + (snowH(x + seed, y) - 0.5) * 3;
      if (y > edge) continue;
      const lum = (d[o] + d[o + 1] + d[o + 2]) / 3;
      if (lum < 45) continue;                                    // контур остаётся тёмным
      const lit = lum > 120;
      d[o] = lit ? 244 - (255 - lum) * 0.1 : 188 + lum * 0.25; d[o + 1] = lit ? 248 - (255 - lum) * 0.08 : 204 + lum * 0.22; d[o + 2] = lit ? 255 : 230 + lum * 0.1;
    }
  }
  g.putImageData(img, 0, 0);
  return (MT_CAP[key] = cv);
}
function mtCapLevel() {
  const S = SEA(), i = seaIdx();
  let l = S.snow * 4;
  if (i === 1) l = Math.max(l, Math.min(1, seaProgress() * 2));
  if (i === 3 && S.snow < 0.3) l = Math.max(l, 1);
  return Math.max(0, Math.min(4, Math.round(l)));
}
{
  const _dm = drawMountain;
  drawMountain = function (c, m) {
    const S = MT_SIZES[m.size], spr = mtCapSprite(m.size, m.v, mtCapLevel());
    c.drawImage(spr, Math.round(m.x - S.w / 2), Math.round(m.y - (S.h - 9)), S.w, S.h);
  };
}
