'use strict';
// Ночная земля: тихая жуть на траве, снегу и болоте — из земли тянется костяная рука, плотоядный цветок кусает воздух,
// встаёт надгробие, в траве моргают глаза, по низинам ползёт туман. Всё стоит на клетках по сиду мира (в коопе у всех одинаково)
// и кадрируется по КАДРЫ.md: рука 6 кадров, цветок 6, надгробие 6 (подъём), глаза 4 (моргание), туман — медленный дрейф.
// Спрайты рисуются один раз в маленькие холсты и берутся из кэша; считаются только клетки в кадре, днём — ничего.
// Рисуется двумя проходами: ground (до объектов, ночь его притемняет) и glow (после ночного затемнения: глаза светятся, туман светлеет).

const NG_CYC = { hand: 16, flower: 10, tomb: 44, eyes: 12 };
const NG_COLS = {
  meadow: { pet: ['#7e58cc', '#4c3080', '#bea4f6'], mouth: ['#d0808e', '#7a3a4a'], eyes: ['#f6d458', '#e04a3a'], fog: '#8ea0b8', soil: ['#341f14', '#45291a', '#583522'], cap: null },
  forest: { pet: ['#c8583a', '#8c2c20', '#f0a070'], mouth: ['#d0808e', '#4a1614'], eyes: ['#f6d458', '#e07a50'], fog: '#8aa896', soil: ['#24170f', '#341f14', '#45291a'], cap: null },
  steppe: { pet: ['#e4b434', '#a4701c', '#fff2a0'], mouth: ['#ac3e2a', '#4a1614'], eyes: ['#e04a3a', '#f6d458'], fog: '#bfae8a', soil: ['#583522', '#6e432a', '#875434'], cap: null },
  mountain: { pet: ['#9c7ae6', '#6440a8', '#e2d6ff'], mouth: ['#d0808e', '#4c3080'], eyes: ['#76b2d4', '#f6d458'], fog: '#9aa6b6', soil: ['#3a3632', '#4a4540', '#5c564f'], cap: null },
  swamp: { pet: ['#73963e', '#3a5a2a', '#c8da84'], mouth: ['#ac3e2a', '#2e0e0e'], eyes: ['#8eab4c', '#e4b434'], fog: '#7f9a6a', soil: ['#141c12', '#1c2818', '#243520'], cap: null },
  winter: { pet: ['#a6d2e6', '#5292bc', '#ffffff'], mouth: ['#7e58cc', '#281a40'], eyes: ['#76b2d4', '#d6eef6'], fog: '#c8d8ea', soil: ['#a6d2e6', '#d6eef6', '#f6f2ea'], cap: '#f6f2ea' },
};
const NG_SPR = {};
function ngCols(set) { return NG_COLS[set] || NG_COLS.meadow; }
function ngSprite(key, w, h, fn) {
  let s = NG_SPR[key];
  if (s) return s;
  const cv = mkCanvas(w, h), c = cv.getContext('2d');
  const P = (x, y, col) => { if (x < 0 || y < 0 || x >= w || y >= h) return; c.fillStyle = col; c.fillRect(x | 0, y | 0, 1, 1); };
  fn(c, P, w, h);
  return (NG_SPR[key] = cv);
}
function ngFree() { for (const k of Object.keys(NG_SPR)) { NG_SPR[k].width = NG_SPR[k].height = 0; delete NG_SPR[k]; } }

// ---- рука скелета: 0 бугорок и пальцы, 1 полруки, 2 рука вверх, 3 и 4 качнулась влево/вправо, 5 кулак ----
const NG_HAND_SEQ = [0, 0, 1, 1, 2, 3, 4, 3, 4, 3, 5, 5, 2, 1, 0];   // шаг 0.35 с
function ngHand(set, f) {
  return ngSprite('hand_' + set + f, 13, 22, (c, P, W, H) => {
    const K = ngCols(set).soil, L = [2, 7, 13, 13, 13, 12][f], tilt = [0, 0, 0, -1, 1, 0][f];
    // холмик
    for (let x = 1; x <= 11; x++) P(x, H - 1, K[0]);
    for (let x = 2; x <= 10; x++) P(x, H - 2, x < 6 ? K[2] : K[1]);
    for (let x = 4; x <= 8; x++) P(x, H - 3, x < 6 ? K[2] : K[1]);
    P(1, H - 2, K[1]); P(11, H - 2, K[0]); P(3, H - 3, K[1]); P(9, H - 3, K[0]);
    const top = H - 3 - L;
    for (let j = 0; j < L; j++) {
      const y = H - 3 - j, xo = Math.round(tilt * (j / Math.max(1, L)) * 3);
      P(5 + xo, y, '#e4ddd2'); P(6 + xo, y, j % 5 === 2 ? '#e4ddd2' : '#b6ada0'); P(7 + xo, y, '#706960');
      if (j % 5 === 2 && j > 1) { P(4 + xo, y, '#b6ada0'); P(8 + xo, y, '#706960'); }   // сустав
    }
    const hx = 6 + Math.round(tilt * 3);
    if (f === 0) { P(5, H - 4, '#e4ddd2'); P(7, H - 5, '#e4ddd2'); P(7, H - 4, '#b6ada0'); P(6, H - 4, '#cec6ba'); return; }
    if (f === 5) {
      for (let y = 0; y < 3; y++) for (let x = -2; x <= 2; x++) P(hx + x, top + y - 1, y === 2 ? '#706960' : x === -2 ? '#e4ddd2' : '#b6ada0');
      P(hx - 1, top - 1, '#f6f2ea'); P(hx + 1, top - 1, '#e4ddd2'); P(hx - 3, top, '#cec6ba');
      return;
    }
    // ладонь
    for (let x = -2; x <= 2; x++) { P(hx + x, top, x < 0 ? '#e4ddd2' : '#b6ada0'); P(hx + x, top - 1, x < 0 ? '#f6f2ea' : '#cec6ba'); }
    const fing = f === 1 ? [[-2, 1], [0, 2], [2, 1]] : [[-2, 3], [0, 4], [2, 3]];
    for (const [dx, h] of fing) {
      for (let j = 1; j <= h; j++) P(hx + dx + (j === h ? Math.sign(dx) : 0), top - 1 - j, j === h ? '#f6f2ea' : '#e4ddd2');
    }
    P(hx - 3, top - 1, '#e4ddd2'); P(hx - 4, top - 2, '#f6f2ea');   // большой палец
  });
}

// ---- плотоядный цветок: 0 бутон, 1 бутон качнулся, 2 раскрывается, 3 пасть открыта, 4 укус, 5 жуёт ----
const NG_FL_SX = [0, 1, 0, 0, 0, 0];
function ngFlower(set, f) {
  return ngSprite('flower_' + set + f, 18, 24, (c, P, W, H) => {
    const C = ngCols(set), [p0, p1, p2] = C.pet, [m0, m1] = C.mouth, sx = NG_FL_SX[f], cx = 9;
    // стебель
    for (let j = 0; j < 11; j++) {
      const x = cx + Math.round(sx * j / 11 + Math.sin(j * 0.55) * 0.9), y = H - 1 - j;
      P(x, y, '#2f4a26'); P(x + 1, y, j % 3 ? '#4a6e30' : '#3a5a2a');
    }
    // листья
    for (let i = 0; i < 4; i++) { P(cx - 2 - i, H - 5 + (i > 1 ? 1 : 0), i < 3 ? '#4a6e30' : '#73963e'); P(cx + 3 + i, H - 7 + (i > 1 ? 1 : 0), i < 3 ? '#4a6e30' : '#73963e'); }
    P(cx - 1, H - 4, '#2f4a26'); P(cx + 2, H - 6, '#2f4a26');
    const hy = H - 14 + (f === 4 || f === 5 ? 1 : 0), hx = cx + sx;
    const gap = [0, 0, 2, 6, 1, 0][f], rx = 5, ry = 4;
    const half = (up) => {   // половина пасти: полудиск
      for (let dy = 1; dy <= ry; dy++) {
        const w = Math.floor(rx * Math.sqrt(1 - Math.pow((dy - 0.5) / ry, 2)) + 0.4);
        const y = up ? hy - (gap >> 1) - dy : hy + ((gap + 1) >> 1) + dy - 1;
        for (let x = -w; x <= w; x++) P(hx + x, y, (dy === ry || Math.abs(x) === w) ? p1 : x < -1 && dy > 1 ? p2 : p0);
        if (dy > 1 && dy < ry && (dy % 2 === 0)) P(hx + (dy % 4 === 0 ? 1 : -1), y, p1);   // прожилки
      }
    };
    if (gap > 1) {   // нутро
      for (let y = -(gap >> 1); y < ((gap + 1) >> 1); y++) for (let x = -rx + 1; x <= rx - 1; x++) P(hx + x, hy + y, y === -(gap >> 1) ? m1 : m0);
      for (let x = -rx + 2; x <= rx - 2; x += 2) { P(hx + x, hy - (gap >> 1), '#ffffff'); P(hx + x + 1, hy + ((gap + 1) >> 1) - 1, '#f6f2ea'); }   // зубы
      P(hx, hy, '#c8583a');   // язычок
    }
    half(true); half(false);
    if (f === 4) for (let x = -rx + 1; x <= rx - 1; x++) P(hx + x, hy, x % 2 ? '#ffffff' : p1);   // зубы сошлись
    if (f === 5) { P(hx + rx - 1, hy + 1, p0); P(hx + rx, hy + 2, p1); P(hx - rx, hy - 1, p1); }
    // чашелистики
    P(hx - 3, hy + ry + 1, '#3a5a2a'); P(hx + 3, hy + ry + 1, '#3a5a2a'); P(hx - 2, hy + ry + 2, '#2f4a26'); P(hx + 2, hy + ry + 2, '#2f4a26'); P(hx, hy + ry + 1, '#4a6e30');
    if (f < 2) { P(hx, hy - ry - 1, p1); P(hx, hy - ry, p0); }   // острый кончик бутона
  });
}

// ---- надгробие: 0..5 — всё выше из земли ----
const NG_TOMB_VIS = [3, 6, 9, 12, 15, 16];
function ngTomb(set, f) {
  return ngSprite('tomb_' + set + f, 16, 20, (c, P, W, H) => {
    const C = ngCols(set), K = C.soil, vis = NG_TOMB_VIS[f], cx = 8, w = 5, bottom = H - 2;   // нижний край над землёй
    for (let r = 0; r < vis; r++) {   // сверху вниз: сначала показывается верх
      const y = bottom - vis + 1 + r;
      const rw = r < 1 ? w - 3 : r < 2 ? w - 2 : r < 3 ? w - 1 : w;
      for (let x = -rw; x <= rw; x++) {
        let col = x < -rw + 1 ? '#b6ada0' : x > rw - 1 ? '#5c564f' : r < 2 ? '#b6ada0' : '#9e958a';
        if (r === 0 && x < 0) col = '#cec6ba';
        P(cx + x, y, col);
      }
      if (C.cap && r < 2) for (let x = -rw; x <= rw; x++) P(cx + x, y, r === 0 ? '#ffffff' : '#f6f2ea');
      if (r === 5 || r === 6) P(cx - 1 + (r === 5 ? 0 : 0), y, '#4a4540');   // крест
      if (r === 7) { P(cx - 2, y, '#4a4540'); P(cx - 1, y, '#4a4540'); P(cx, y, '#4a4540'); P(cx + 1, y, '#4a4540'); }
      if (r === 9 || r === 11) { P(cx - 2, y, '#706960'); P(cx - 1, y, '#706960'); P(cx + 1, y, '#706960'); }   // «RIP»
      if (r > 10 && !C.cap && (r * 7 + f) % 3 === 0) P(cx - w + 1, y, '#4a6e30');   // мох
    }
    // земля вокруг основания
    for (let x = -w - 2; x <= w + 2; x++) P(cx + x, bottom + 1, K[0]);
    for (let x = -w - 1; x <= w + 1; x++) P(cx + x, bottom, x < 0 ? K[2] : K[1]);
    if (f < 5) { P(cx - w - 2, bottom - 1, K[1]); P(cx + w + 2, bottom - 2, K[2]); P(cx - w - 1, bottom - 2, K[2]); P(cx + w + 1, bottom - 1, K[1]); P(cx - 1, bottom - 4 - f, K[2]); }
  });
}

// ---- глаза в траве: 0 открыты, 1 прищур, 2 закрыты ----
function ngEyes(set, f) {
  return ngSprite('eyes_' + set + f, 14, 9, (c, P, W, H) => {
    const E = ngCols(set).eyes;
    // тёмный куст
    const bush = ['#0c140c', '#141c12'];
    for (let x = 1; x <= 12; x++) { const h = 3 + ((x * 5) % 3) + (x > 3 && x < 10 ? 1 : 0); for (let y = 0; y < h; y++) P(x, H - 1 - y, y > 3 ? bush[1] : bush[0]); }
    if (f === 2) { P(4, 4, E[1]); P(8, 4, E[1]); return; }
    P(4, 4, E[0]); P(5, 4, E[0]); P(8, 4, E[0]); P(9, 4, E[0]);
    if (f === 0) { P(4, 5, E[0]); P(5, 5, E[1]); P(8, 5, E[0]); P(9, 5, E[1]); P(4, 3, E[1]); P(8, 3, E[1]); }
  });
}
function ngGlow(set) {
  return ngSprite('eglow_' + set, 24, 14, (c) => {
    const g = c.createRadialGradient(12, 7, 0, 12, 7, 11); const e = ngCols(set).eyes[0];
    g.addColorStop(0, e + 'aa'); g.addColorStop(1, e + '00'); c.fillStyle = g; c.fillRect(0, 0, 24, 14);
  });
}
// ---- туман: пиксельное пятно из трёх ступеней прозрачности ----
function ngFog(set, v) {
  return ngSprite('fog_' + set + v, 112, 32, (c, P, W, H) => {
    const col = ngCols(set).fog, o = v * 9;
    c.fillStyle = col;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const nx = (x - W / 2) / (W / 2 - 2), ny = (y - H / 2) / (H / 2 - 2);
      let d = nx * nx + ny * ny + 0.18 * Math.sin((x + o) * 0.21) * Math.sin(y * 0.4 + o) ;
      if (d > 1) continue;
      const a = d < 0.35 ? 0.5 : d < 0.7 ? 0.32 : (((x + y) & 1) ? 0 : 0.16);
      if (!a) continue;
      c.globalAlpha = a; c.fillRect(x, y, 1, 1);
    }
    c.globalAlpha = 1;
  });
}

// ---- что стоит на клетке и в какой момент ----
function ngKindAt(tx, ty, seed) {
  const h = gsHash(tx, ty, seed + 7);
  return h < 0.013 ? 1 : h < 0.033 ? 2 : h < 0.042 ? 3 : h < 0.09 ? 4 : 0;   // рука, цветок, плита, глаза
}
function ngTileOk(tx, ty) {
  const i = ty * MAP_W + tx;
  return World.terrain[i] === T_GRASS && !World.road[i] && !World.bmap[i] && !World.obj[i];
}
function ngPose(kind, u) {   // кадр по времени цикла u (с); -1 — не видно
  if (kind === 1) { if (u >= NG_HAND_SEQ.length * 0.35) return -1; return NG_HAND_SEQ[Math.floor(u / 0.35)]; }
  if (kind === 2) { if (u < 6) return (Math.floor(u / 0.5) & 1); if (u < 6.6) return 2; if (u < 7.8) return 3; if (u < 8.1) return 4; if (u < 8.7) return 5; return 0; }
  if (kind === 3) { if (u < 16 || u >= 37.5) return -1; if (u < 17.5) return Math.min(5, Math.floor((u - 16) / 0.25)); if (u < 36) return 5; return Math.max(0, 5 - Math.floor((u - 36) / 0.25)); }
  return 0;
}
// одна клетка: картинка и положение (px, py — низ спрайта)
function ngDrawTile(c, kind, set, tx, ty, seed, t, al, glowPass) {
  const ph = gsHash(tx, ty, seed + 11), px = tx * TILE + 6 + gsHash(tx, ty, seed + 13) * 20, py = ty * TILE + 12 + gsHash(tx, ty, seed + 17) * 16;
  if (kind === 1 || kind === 2 || kind === 3) {
    if (glowPass) return;
    const cyc = kind === 1 ? NG_CYC.hand : kind === 2 ? NG_CYC.flower : NG_CYC.tomb, f = ngPose(kind, (t + ph * cyc) % cyc);
    if (f < 0) return;
    const s = kind === 1 ? ngHand(set, f) : kind === 2 ? ngFlower(set, f) : ngTomb(set, f);
    c.globalAlpha = al; c.drawImage(s, Math.round(px - s.width / 2), Math.round(py - s.height + 2)); c.globalAlpha = 1;
  } else if (kind === 4 && glowPass) {
    const u = (t + ph * NG_CYC.eyes) % NG_CYC.eyes;
    if (u > 7.5) return;
    const k = Math.floor(u * 4), fade = Math.min(1, u * 2, (7.5 - u) * 2);
    const f = (k % 13 === 5) ? 2 : (k % 13 === 4 || k % 13 === 6) ? 1 : 0;
    const s = ngEyes(set, f), dx = Math.round(Math.sin(u * 0.8 + ph * 6) * 1);
    const x = Math.round(px - 7), y = Math.round(py - 9);
    c.globalAlpha = al * fade; c.drawImage(s, x, y);
    if (f === 0) { c.globalAlpha = al * fade * 0.5; c.globalCompositeOperation = 'lighter'; c.drawImage(ngGlow(set), x - 5 + dx, y - 3); c.globalCompositeOperation = 'source-over'; }
    c.globalAlpha = 1;
  }
}
function ngSetNow() { return (typeof MapOpt !== 'undefined' && MapOpt.biome) || 'meadow'; }
function ngAlpha() { const a = nightAmt(); return a < 0.55 ? 0 : Math.min(1, (a - 0.55) * 4); }

// Первый проход (до объектов): рука, цветок, плита
function nightGroundDraw(c, x0, y0, x1, y1) {
  const al = ngAlpha();
  if (!al) return;
  const set = ngSetNow(), seed = Game.seed | 0, t = Game.time;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const k = ngKindAt(tx, ty, seed);
    if (k < 1 || k > 3 || !ngTileOk(tx, ty)) continue;
    ngDrawTile(c, k, set, tx, ty, seed, t, al, false);
  }
}
// Второй проход (после затемнения): глаза и туман
const NG_FOG_CH = 6;
function nightGroundGlow(c, x0, y0, x1, y1) {
  const al = ngAlpha();
  if (!al || (typeof Fps !== 'undefined' && Fps.eco)) return;
  const set = ngSetNow(), seed = Game.seed | 0, t = Game.time;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (ngKindAt(tx, ty, seed) !== 4 || !ngTileOk(tx, ty)) continue;
    ngDrawTile(c, 4, set, tx, ty, seed, t, al, true);
  }
  // туман: в каждом квадрате NG_FOG_CH клеток — пятно с вероятностью 0.4, оно медленно дрейфует
  const cx0 = Math.floor(x0 / NG_FOG_CH) - 1, cx1 = Math.floor(x1 / NG_FOG_CH) + 1, cy0 = Math.floor(y0 / NG_FOG_CH) - 1, cy1 = Math.floor(y1 / NG_FOG_CH) + 1;
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
    if (gsHash(cx, cy, seed + 23) > 0.4) continue;
    const ph = gsHash(cx, cy, seed + 29) * 6.283, s = ngFog(set, (cx + cy) & 1);
    const x = cx * NG_FOG_CH * TILE + gsHash(cx, cy, seed + 31) * 100 + Math.sin(t * 0.05 + ph) * 26 - 56;
    const y = cy * NG_FOG_CH * TILE + gsHash(cx, cy, seed + 37) * 130 + Math.sin(t * 0.032 + ph * 1.7) * 7;
    c.globalAlpha = al * 0.34 * (0.65 + 0.35 * Math.sin(t * 0.17 + ph));
    c.drawImage(s, Math.round(x), Math.round(y));
  }
  c.globalAlpha = 1;
}
