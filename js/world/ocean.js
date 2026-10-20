'use strict';
// Живая вода (МОРЕ.md). Земля (terrain.js) запекает воду рампой тонов своего водоёма: море, озеро, река, пруд, болото —
// глубина по расстоянию до берега, ступени тона с упорядоченным дизером, без шумов. Поверх каждый кадр:
//  • волны — атлас 8 кадров на вид × слой (мель / глубь) × 4 варианта, соседние кадры смешиваются по альфе;
//  • прибой — плитка на каждое сочетание 3×3 соседей (вода/суша): накат пены, мокрый песок, галька, рябь к берегу;
//  • днём блики солнца, в шторм барашки, в дождь круги от капель; ночью (поверх темноты) лунная дорожка и планктон;
//  • зимой волны гаснут под льдом snow.js (Game.sea.ice).
// Плитки строятся по требованию и кэшируются; на слабом устройстве и в эко-режиме — 4 кадра без смешения,
// без планктона и кругов. В сейв ничего не идёт: всё выводится из клеток карты.

const OC_KIND = ['', 'sea', 'lake', 'river', 'pond', 'swamp'];
const OC_SEA = 1, OC_LAKE = 2, OC_RIVER = 3, OC_POND = 4, OC_SWAMP = 5;
// рампы тона (от кромки к глубине), пена, блик
const OC_PAL = {
  sea:   { ramp: ['#6cccbe', '#3c9cb4', '#2a70a0', '#1c4a82', '#123066'], foam: '#f2faf6', foam2: '#bfe8e4', hi: '#d6f4ee', crest: '#4a9ec0', trough: '#163c70', wet: 'rgba(54,40,24,0.30)' },
  lake:  { ramp: ['#86d2c0', '#56a6b0', '#36789a', '#22507a'], foam: '#eef6f2', foam2: '#b8dcd8', hi: '#d0eee8', crest: '#68b2bc', trough: '#1c4670', wet: 'rgba(54,40,24,0.28)' },
  river: { ramp: ['#96dccc', '#68b6be', '#428aa6'], foam: '#f2faf8', foam2: '#c4e6e0', hi: '#e0f6f0', crest: '#82c8cc', trough: '#2e6c90', wet: 'rgba(54,40,24,0.26)' },
  pond:  { ramp: ['#8cc4a4', '#64988a', '#456e78'], foam: '#e2eee0', foam2: '#b0ccb8', hi: '#cce4d4', crest: '#7ab09c', trough: '#36586a', wet: 'rgba(50,40,24,0.26)' },
  swamp: { ramp: ['#9cae72', '#768a56', '#526242', '#34442e'], foam: '#c4cc96', foam2: '#9aa874', hi: '#c8d49c', crest: '#8a9c64', trough: '#2c3a28', wet: 'rgba(40,36,18,0.30)' },
};
const OC_RGB = {};
for (const k in OC_PAL) OC_RGB[k] = OC_PAL[k].ramp.map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const OC_BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const OC_FR = 8;                     // кадров волны и прибоя
const OC_FPS = 5;                    // кадров в секунду: петля 1,6 с

const OCN = { key: '', kind: null, dep: null, cdep: null, near: null, m9: null, waterN: 0, chk: 0, waves: new Map(), shore: new Map(), rings: [], ringT: 0, on: false };

const ocH = (a, b) => { const n = Math.sin(a * 127.1 + b * 311.7 + 74.7) * 43758.5453; return n - Math.floor(n); };
const ocEco = () => (typeof Fps !== 'undefined' && Fps.eco) || (typeof perfWeakDevice === 'function' && perfWeakDevice());

// Сумма водных клеток: меняется — карта перестроилась (новая игра, редактор, загрузка)
function ocTerrKey() {
  const T = World.terrain;
  let h = 0;
  for (let i = 0; i < T.length; i++) if (T[i] === T_WATER) h = (Math.imul(h, 31) + i) | 0;
  return MAP_W + 'x' + MAP_H + ':' + (MapOpt.biome || '-') + ':' + h;
}

// Виды водоёмов, глубина (Чебышёв до суши, 1 — у берега), прибрежные маски. force — пересчитать сейчас (при запекании земли)
function oceanPrep(force) {
  if (typeof World === 'undefined' || !World.terrain) return null;
  if (!force && OCN.kind && ++OCN.chk % 150) return OCN.on ? OCN : null;
  const key = ocTerrKey();
  if (OCN.kind && key === OCN.key) return OCN.on ? OCN : null;
  OCN.key = key;
  const W = MAP_W, H = MAP_H, N = W * H, T = World.terrain;
  const isW = i => T[i] === T_WATER;
  const kind = new Uint8Array(N), dep = new Uint8Array(N), near = new Uint8Array(N), m9 = new Uint16Array(N);
  // глубина: волна от берега; за краем карты — вода (море уходит за горизонт)
  let q = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!isW(i)) continue;
    let land = false;
    for (let dy = -1; dy <= 1 && !land; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < W && yy < H && !isW(yy * W + xx)) { land = true; break; }
    }
    if (land) { dep[i] = 1; q.push(i); }
  }
  for (let d = 2; d <= 7 && q.length; d++) {
    const nq = [];
    for (const i of q) {
      const x = i % W, y = (i / W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx;
        if (isW(j) && !dep[j]) { dep[j] = d; nq.push(j); }
      }
    }
    q = nq;
  }
  for (let i = 0; i < N; i++) if (isW(i) && !dep[i]) dep[i] = 7;
  // связные водоёмы → вид
  const coast = MapOpt.biome === 'coast', swamp = MapOpt.biome === 'swamp';
  const seen = new Uint8Array(N);
  let waterN = 0;
  for (let s = 0; s < N; s++) {
    if (!isW(s) || seen[s]) continue;
    const comp = [s]; seen[s] = 1;
    let edge = false, narrow = 0;
    for (let k = 0; k < comp.length; k++) {
      const i = comp[k], x = i % W, y = (i / W) | 0;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) edge = true;
      if (dep[i] <= 2) narrow++;
      if (x > 0 && isW(i - 1) && !seen[i - 1]) { seen[i - 1] = 1; comp.push(i - 1); }
      if (x < W - 1 && isW(i + 1) && !seen[i + 1]) { seen[i + 1] = 1; comp.push(i + 1); }
      if (y > 0 && isW(i - W) && !seen[i - W]) { seen[i - W] = 1; comp.push(i - W); }
      if (y < H - 1 && isW(i + W) && !seen[i + W]) { seen[i + W] = 1; comp.push(i + W); }
    }
    const n = comp.length;
    waterN += n;
    const k = edge && n >= (coast ? 150 : 1200) ? OC_SEA : swamp ? OC_SWAMP : n >= 25 ? (narrow / n > 0.86 ? OC_RIVER : OC_LAKE) : OC_POND;
    for (const i of comp) kind[i] = k;
  }
  // суша у воды: вид ближнего водоёма; маска 3×3 (бит — вода; за краем — как ближняя клетка, так же, как запекает земля)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    let m = 0, any = false, all = true, nk = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = Math.min(W - 1, Math.max(0, x + dx)), yy = Math.min(H - 1, Math.max(0, y + dy)), j = yy * W + xx;
      if (isW(j)) { m |= 1 << ((dy + 1) * 3 + dx + 1); any = true; if (!nk || kind[j] === OC_SEA) nk = kind[j]; } else all = false;
    }
    if (!isW(i)) near[i] = nk;
    if (any && !all) m9[i] = m | 512 | (T[i] === T_SAND ? 1024 : 0);
  }
  // глубина в углах клеток (для запекания рампы)
  const CW = W + 1, cdep = new Float32Array(CW * (H + 1));
  for (let y = 0; y <= H; y++) for (let x = 0; x <= W; x++) {
    let s = 0;
    for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 0; dx++) {
      const xx = Math.min(W - 1, Math.max(0, x + dx)), yy = Math.min(H - 1, Math.max(0, y + dy));
      s += dep[yy * W + xx];
    }
    cdep[y * CW + x] = s / 4;
  }
  Object.assign(OCN, { kind, dep, near, m9, cdep, waterN, on: waterN > 0 });
  return OCN.on ? OCN : null;
}

// ---------- Запекание рампы в землю ----------
// Цвет воды в точке мира: ступень рампы по глубине (ординарный дизер 4×4). out — [r,g,b]; false — не вода этого слоя
function oceanBakeColor(tx, ty, fx, fy, wx, wy, out) {
  const O = OCN;
  if (!O.on) return false;
  const i = ty * MAP_W + tx;
  const k = O.kind[i] || O.near[i] || OC_LAKE;
  const C = O.cdep, CW = MAP_W + 1, c00 = ty * CW + tx;
  const top = C[c00] + (C[c00 + 1] - C[c00]) * fx, bot = C[c00 + CW] + (C[c00 + CW + 1] - C[c00 + CW]) * fx;
  const d = top + (bot - top) * fy;
  const ramp = OC_RGB[OC_KIND[k]], n = ramp.length - 1;
  const pos = Math.max(0, Math.min(n, (d - 0.55) * (k === OC_SEA ? 0.95 : k === OC_LAKE ? 1.1 : 1.4)));
  const i0 = Math.floor(pos), t = pos - i0;
  const c = ramp[Math.min(n, i0 + (t > OC_BAYER[(wy & 3) * 4 + (wx & 3)] ? 1 : 0))];
  out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
  return true;
}

// Квантование полосы земли под палитру игры, кроме пикселей чистой воды (метка — альфа 254): у воды своя рампа
function ocQuantize(d, w, h, dither, oy) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4, al = d[o + 3];
    if (al === 0) continue;
    if (al === 254) { d[o + 3] = 255; continue; }
    const t = dither ? BAYER4[((y + oy) & 3) * 4 + (x & 3)] * dither : 0;
    const p = PAL[palIndex(d[o] + t, d[o + 1] + t, d[o + 2] + t)];
    d[o] = p[0]; d[o + 1] = p[1]; d[o + 2] = p[2];
  }
}

// ---------- Плитки волн: 8 кадров в ряд (256×32) ----------
function ocWaveStrip(k, layer, v) {
  const key = k * 100 + layer * 10 + v;
  let cv = OCN.waves.get(key);
  if (cv) return cv;
  cv = mkCanvas(TILE * OC_FR, TILE);
  const g = cv.getContext('2d'), P = OC_PAL[OC_KIND[k]], ramp = P.ramp;
  const n = layer === 2 ? 2 + (v & 1) : 1 + (v >> 1);
  const crest = layer === 2 ? P.crest : ramp[0], trough = layer === 2 ? P.trough : ramp[Math.min(ramp.length - 1, 2)];
  for (let f = 0; f < OC_FR; f++) {
    const a = f / OC_FR * Math.PI * 2;
    for (let j = 0; j < n; j++) {
      const L = 6 + Math.floor(ocH(v + j * 5, 9) * 6), ph = ocH(j * 3 + v, 2) * 6.28;
      const bx = 3 + Math.floor(ocH(v * 7 + j, k + layer) * (TILE - L - 8)), by = 3 + Math.floor((j + ocH(j, v * 3 + layer)) / n * 25);
      const x = bx + Math.round(Math.sin(a + ph) * 2), len = L + Math.round(Math.cos(a + ph) * 2);
      if (len < 2) continue;
      g.fillStyle = crest;                                         // гребень
      g.fillRect(f * TILE + x + 1, by, len - 2, 1);
      g.fillRect(f * TILE + x, by + 1, len, 1);
      g.fillStyle = trough;                                        // тень под гребнем
      g.fillRect(f * TILE + x + 1, by + 2, len - 1, 1);
      if (len >= 6 && j === 0) { g.fillStyle = P.hi; g.fillRect(f * TILE + x + 2, by, 2, 1); }   // искра на самом высоком гребне
    }
  }
  OCN.waves.set(key, cv);
  return cv;
}

// ---------- Плитки прибоя: 8 кадров в ряд ----------
// w — доля воды в точке (билинейно по углам из маски 3×3, как запекает земля): 0.5 — линия берега
function ocShoreStrip(k, m) {
  const key = k * 4096 + m;
  let cv = OCN.shore.get(key);
  if (cv) return cv;
  cv = mkCanvas(TILE * OC_FR, TILE);
  const g = cv.getContext('2d'), img = g.createImageData(TILE * OC_FR, TILE), D = img.data;
  const P = OC_PAL[OC_KIND[k]], sand = !!(m & 1024);
  const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const FOAM = rgb(P.foam), FOAM2 = rgb(P.foam2), HI = rgb(P.hi), RIM = OC_RGB[OC_KIND[k]][0];
  const PEB = [[138, 132, 120], [176, 168, 152], [104, 98, 90]];
  const wet = P.wet.match(/[\d.]+/g).map(Number);
  const b = (dx, dy) => (m >> ((dy + 1) * 3 + dx + 1)) & 1;
  const c0 = (b(-1, -1) + b(0, -1) + b(-1, 0) + b(0, 0)) / 4, c1 = (b(0, -1) + b(1, -1) + b(0, 0) + b(1, 0)) / 4;
  const c2 = (b(-1, 0) + b(0, 0) + b(-1, 1) + b(0, 1)) / 4, c3 = (b(0, 0) + b(1, 0) + b(0, 1) + b(1, 1)) / 4;
  const put = (o, c, a = 255) => { D[o] = c[0]; D[o + 1] = c[1]; D[o + 2] = c[2]; D[o + 3] = a; };
  for (let py = 0; py < TILE; py++) for (let px = 0; px < TILE; px++) {
    const fx = (px + 0.5) / TILE, fy = (py + 0.5) / TILE;
    const w = (c0 + (c1 - c0) * fx) * (1 - fy) + (c2 + (c3 - c2) * fx) * fy + (ocH(px * 3 + (m & 511), py) - 0.5) * 0.05;
    const hh = ocH(px + m * 0.37, py * 1.7);
    const peb = sand && w > 0.27 && w < 0.43 && hh < 0.05;      // галька на сухом песке — во всех кадрах
    for (let f = 0; f < OC_FR; f++) {
      const o = (py * TILE * OC_FR + f * TILE + px) * 4;
      const s = 0.5 + 0.5 * Math.sin(f / OC_FR * Math.PI * 2);   // накат 0..1
      const front = 0.48 - 0.08 * s;                              // кромка пены заходит на песок и отступает
      if (w >= front && w < front + 0.045) { put(o, FOAM); continue; }
      if (w >= front + 0.045 && w < front + 0.09) { if (hh < 0.55) put(o, FOAM2); continue; }
      if (w >= 0.56 && w < 0.95) {                                 // рябь бежит к берегу: светлые штрихи
        const r = (w * 7 + f / OC_FR) % 1;
        if (r < 0.1 && hh > 0.25) put(o, w < 0.68 ? HI : RIM);
        continue;
      }
      if (w < front && w > front - 0.05 - 0.06 * (1 - s) && sand) { put(o, [wet[0], wet[1], wet[2]], Math.round(wet[3] * 255)); continue; }   // мокрый песок за отступившей волной
      if (peb) put(o, PEB[Math.floor(hh * 60) % 3]);
    }
  }
  g.putImageData(img, 0, 0);
  if (sand) {   // блик сверху у камешков
    for (let py = 1; py < TILE; py++) for (let px = 0; px < TILE; px++) {
      const o = (py * TILE * OC_FR + px) * 4;
      if (D[o + 3] === 255 && D[o] === PEB[0][0] && D[o + 1] === PEB[0][1] && ocH(px, py) < 0.5) { g.fillStyle = '#d4ccbc'; for (let f = 0; f < OC_FR; f++) g.fillRect(f * TILE + px, py - 1, 1, 1); }
    }
  }
  OCN.shore.set(key, cv);
  return cv;
}

// Маска клетки по линии берега (та же доля воды w, что у прибоя): inv — суша
function ocMask(m, inv) {
  const key = (m & 511) * 2 + (inv ? 1 : 0);
  const M = OCN.masks || (OCN.masks = new Map());
  let cv = M.get(key);
  if (cv) return cv;
  cv = mkCanvas(TILE, TILE);
  const g = cv.getContext('2d'), img = g.createImageData(TILE, TILE), D = img.data;
  const b = (dx, dy) => (m >> ((dy + 1) * 3 + dx + 1)) & 1;
  const c0 = (b(-1, -1) + b(0, -1) + b(-1, 0) + b(0, 0)) / 4, c1 = (b(0, -1) + b(1, -1) + b(0, 0) + b(1, 0)) / 4;
  const c2 = (b(-1, 0) + b(0, 0) + b(-1, 1) + b(0, 1)) / 4, c3 = (b(0, 0) + b(1, 0) + b(0, 1) + b(1, 1)) / 4;
  for (let py = 0; py < TILE; py++) for (let px = 0; px < TILE; px++) {
    const fx = (px + 0.5) / TILE, fy = (py + 0.5) / TILE;
    const w = (c0 + (c1 - c0) * fx) * (1 - fy) + (c2 + (c3 - c2) * fx) * fy + (ocH(px * 3 + (m & 511), py) - 0.5) * 0.05;
    if ((w >= 0.5) !== !!inv) D[(py * TILE + px) * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  M.set(key, cv);
  return cv;
}
// Зимой у берега: лёд и снег по скруглённой линии берега, а не квадратами клеток (snow.js).
// own — плитка этой клетки (лёд для воды, снег для суши) по её части линии, other — плитка другой части (или null)
function oceanIceTile(own, other, m, water, key) {
  const C = OCN.iceT || (OCN.iceT = new Map());
  let cv = C.get(key);
  if (cv) return cv;
  cv = mkCanvas(TILE, TILE);
  const g = cv.getContext('2d');
  g.drawImage(own, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(ocMask(m, !water), 0, 0);
  if (other) {
    const t2 = mkCanvas(TILE, TILE), g2 = t2.getContext('2d');
    g2.drawImage(other, 0, 0); g2.globalCompositeOperation = 'destination-in'; g2.drawImage(ocMask(m, water), 0, 0);
    g.globalCompositeOperation = 'destination-over'; g.drawImage(t2, 0, 0);
  }
  C.set(key, cv);
  return cv;
}

function ocMemMB() {
  return (OCN.waves.size + OCN.shore.size) * TILE * TILE * OC_FR * 4 / 1048576;
}

// Ветер: сильный дождь — шторм над морем (волны быстрее и выше, барашки)
const oceanStorm = () => (typeof WX !== 'undefined' ? Math.max(0, (WX.k - 0.55) / 0.45) : 0);

// ---------- Слой воды за кадр (до льда и снега) ----------
function oceanDraw(c, x0, y0, x1, y1) {
  const O = oceanPrep();
  if (!O) return;
  const ice = typeof SEA === 'function' ? Math.min(1, SEA().ice || 0) : 0;
  const vis = 1 - ice;
  if (vis < 0.03) return;
  const eco = ocEco(), storm = oceanStorm();
  const ft = Game.time * OC_FPS * (1 + storm * 0.9);
  const nF = eco ? 4 : OC_FR, step = OC_FR / nF;
  const fi = Math.floor(ft / step), a = eco ? 0 : ft / step - fi;
  const f0 = (fi % nF) * step, f1 = ((fi + 1) % nF) * step;
  const W = MAP_W, kind = O.kind, dep = O.dep, m9 = O.m9;
  const night = typeof nightAmt === 'function' ? nightAmt() : 0;
  const ga = c.globalAlpha;
  const blit = (cv, x, y, wA) => {
    if (a < 0.08 || eco) { c.globalAlpha = wA; c.drawImage(cv, f0 * TILE, 0, TILE, TILE, x, y, TILE, TILE); return; }
    if (a > 0.92) { c.globalAlpha = wA; c.drawImage(cv, f1 * TILE, 0, TILE, TILE, x, y, TILE, TILE); return; }
    c.globalAlpha = wA * (1 - a); c.drawImage(cv, f0 * TILE, 0, TILE, TILE, x, y, TILE, TILE);
    c.globalAlpha = wA * a; c.drawImage(cv, f1 * TILE, 0, TILE, TILE, x, y, TILE, TILE);
  };
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * W + x, k = kind[i], m = m9[i];
    if (k && dep[i] >= 2) {
      const layer = dep[i] >= 4 && k !== OC_RIVER && k !== OC_POND ? 2 : 1;
      blit(ocWaveStrip(k, layer, (x * 7 + y * 13) & 3), x * TILE, y * TILE, vis * (k === OC_SWAMP ? 0.6 : 0.9));
    }
    if (m && !(eco && ((x + y) & 1) && !k)) blit(ocShoreStrip(k || O.near[i] || OC_LAKE, m), x * TILE, y * TILE, vis);
  }
  c.globalAlpha = ga;
  // блики солнца (днём), барашки (в шторм)
  const t = Game.time, day = 1 - night;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * W + x;
    if (!kind[i] || dep[i] < 2 || kind[i] === OC_SWAMP) continue;
    const h = hash(i + 991);
    if (day > 0.3) {
      const s = Math.sin(t * (0.9 + (h % 7) / 9) + (h % 628) / 100);
      if (s > 0.86) {
        const sx = x * TILE + 4 + (h % 22), sy = y * TILE + 4 + ((h >>> 6) % 22);
        c.fillStyle = s > 0.96 ? '#ffffff' : '#e8f6f2';
        c.fillRect(sx - 1, sy, 3, 1);
        if (s > 0.96) { c.fillRect(sx, sy - 1, 1, 3); }
      }
    }
    if (storm > 0.1 && dep[i] >= 3 && vis > 0.5) {
      const s = Math.sin(t * 2.4 + (h % 628) / 100);
      if (s > 1 - storm * 0.35) {
        const sx = x * TILE + 3 + ((h >>> 3) % 20), sy = y * TILE + 6 + ((h >>> 9) % 20);
        c.fillStyle = '#f4faf8'; c.fillRect(sx, sy, 5, 1); c.fillRect(sx + 1, sy - 1, 3, 1);
        c.fillStyle = '#bcd8dc'; c.fillRect(sx + 1, sy + 1, 4, 1);
      }
    }
  }
  // круги от капель
  if (!eco && typeof WX !== 'undefined' && WX.k > 0.15 && vis > 0.3) {
    const now = performance.now(), dt = Math.min(0.1, (now - (OCN.lastT || now)) / 1000); OCN.lastT = now;
    OCN.ringT += dt * WX.k * 26 * (Game.paused ? 0 : 1);
    for (let n = 0; n < 6 && OCN.ringT >= 1; n++) {
      OCN.ringT -= 1;
      const x = x0 + ((Math.random() * (x1 - x0 + 1)) | 0), y = y0 + ((Math.random() * (y1 - y0 + 1)) | 0);
      if (kind[y * W + x] && OCN.rings.length < 60) OCN.rings.push({ x: x * TILE + 3 + Math.random() * 26, y: y * TILE + 3 + Math.random() * 26, t0: Game.time });
    }
  } else OCN.ringT = 0;
  for (let j = OCN.rings.length - 1; j >= 0; j--) {
    const r = OCN.rings[j], k = (Game.time - r.t0) / 0.7;
    if (k >= 1 || k < 0) { OCN.rings.splice(j, 1); continue; }
    const rad = 1 + Math.floor(k * 4), rx = Math.round(r.x), ry = Math.round(r.y);
    c.fillStyle = k < 0.5 ? '#d6eef0' : '#8cc0cc';
    c.fillRect(rx - rad, ry, 1, 1); c.fillRect(rx + rad, ry, 1, 1);
    c.fillRect(rx - rad + 1, ry - 1, rad * 2 - 1, 1); c.fillRect(rx - rad + 1, ry + 1, rad * 2 - 1, 1);
    if (k < 0.2) c.fillRect(rx, ry - 2, 1, 1);
  }
}

// ---------- Ночью, поверх темноты: лунная дорожка и светящийся планктон ----------
function oceanGlow(c, x0, y0, x1, y1) {
  const O = OCN.on ? OCN : null;
  if (!O || typeof nightAmt !== 'function') return;
  const night = nightAmt();
  if (night < 0.35) return;
  const ice = typeof SEA === 'function' ? Math.min(1, SEA().ice || 0) : 0;
  if (ice > 0.9) return;
  const k0 = (night - 0.35) / 0.65 * (1 - ice), t = Game.time, W = MAP_W;
  const z = devScale(), vw = R.canvas.width / z;
  const cyc = cycleAt(t), mp = Math.max(0, Math.min(1, (cyc.p - NIGHT_START) / Math.max(1, cyc.nl)));
  const moonX = R.cam.x + vw * (0.2 + 0.6 * mp);                  // луна идёт по небу — дорожка вслед за ней
  const eco = ocEco(), ga = c.globalAlpha;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * W + x, kd = O.kind[i];
    if (!kd || kd === OC_SWAMP) continue;
    const h = hash(i + 4441);
    // лунная дорожка: дробные блики в полосе под луной
    const cx = x * TILE + 16, band = 34 + ((h >>> 4) % 22);
    if (O.dep[i] >= 2 && Math.abs(cx - moonX) < band) {
      for (let q = 0; q < 2; q++) {
        const hq = h >>> (q * 9);
        const s = Math.sin(t * (1.3 + (hq % 5) / 6) + (hq % 628) / 100);
        if (s < 0.25) continue;
        const sx = x * TILE + (hq % 26) + 3, sy = y * TILE + ((hq >>> 5) % 26) + 3;
        c.globalAlpha = k0 * (0.45 + 0.5 * s);
        c.fillStyle = s > 0.85 ? '#f4f6ff' : '#b8c8ec';
        c.fillRect(sx - 2, sy, 5, 1);
      }
    }
    // планктон у берега — море и озеро
    if (!eco && (kd === OC_SEA || kd === OC_LAKE) && O.dep[i] <= 3 && (h & 7) < 3) {
      const s = Math.sin(t * 1.7 + (h % 628) / 100);
      if (s > 0.1) {
        const sx = x * TILE + (h % 28) + 2, sy = y * TILE + ((h >>> 7) % 28) + 2;
        c.globalAlpha = k0 * s * 0.3; c.fillStyle = '#4ae0d0'; c.fillRect(sx - 1, sy - 1, 3, 3);
        c.globalAlpha = k0 * s * 0.9; c.fillStyle = '#a8fff0'; c.fillRect(sx, sy, 1, 1);
        if ((h & 16) && s > 0.6) c.fillRect(sx + 4, sy + 2, 1, 1);
      }
    }
  }
  c.globalAlpha = ga;
}

// Куда смотрит камера: сколько видно береговых клеток каждого вида (для прибоя в звуке)
function oceanShoreView() {
  const O = OCN.on ? OCN : null;
  if (!O || !R.canvas) return null;
  const z = devScale(), cam = R.cam;
  const x0 = Math.max(0, Math.floor(cam.x / TILE)), y0 = Math.max(0, Math.floor(cam.y / TILE));
  const x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + R.canvas.width / z) / TILE)), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + R.canvas.height / z) / TILE));
  let sea = 0, calm = 0, water = 0, sx = 0, n = 0;
  for (let y = y0; y <= y1; y += 2) for (let x = x0; x <= x1; x += 2) {
    const i = y * MAP_W + x;
    if (O.kind[i]) water++;
    if (O.dep[i] === 1) { if (O.kind[i] === OC_SEA) sea++; else calm++; sx += x; n++; }
  }
  const tot = Math.max(1, ((x1 - x0) >> 1) * ((y1 - y0) >> 1));
  return { sea: sea / tot, calm: calm / tot, water: water / tot, cx: n ? (sx / n + 0.5) * TILE : cam.x, cy: (y0 + y1) / 2 * TILE };
}
