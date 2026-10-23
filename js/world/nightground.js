'use strict';
// Ночная земля: тихая жуть на траве, снегу и болоте — из земли тянется костяная рука, плотоядный цветок кусает воздух,
// встаёт надгробие, в траве моргают глаза, по низинам ползёт туман. Всё стоит на клетках по сиду мира (в коопе у всех одинаково)
// и кадрируется по КАДРЫ.md: рука 6 кадров, цветок 6, надгробие 6 (подъём), глаза 4 (моргание), туман — медленный дрейф.
// Спрайты рисуются один раз в маленькие холсты и берутся из кэша; считаются только клетки в кадре, днём — ничего.
// Рисуется двумя проходами: ground (до объектов, ночь его притемняет) и glow (после ночного затемнения: глаза светятся, туман светлеет).

const NG_CYC = { tomb: 44, eyes: 12 };   // остальные циклы — в NG_CREEP
const NG_COLS = {
  meadow: { dk: '#281a40', pet: ['#7e58cc', '#4c3080', '#bea4f6'], mouth: ['#d0808e', '#7a3a4a'], eyes: ['#f6d458', '#e04a3a'], fog: '#8ea0b8', soil: ['#341f14', '#45291a', '#583522'], cap: null },
  forest: { dk: '#4a1614', pet: ['#c8583a', '#8c2c20', '#f0a070'], mouth: ['#d0808e', '#4a1614'], eyes: ['#f6d458', '#e07a50'], fog: '#8aa896', soil: ['#24170f', '#341f14', '#45291a'], cap: null },
  steppe: { dk: '#5a3a10', pet: ['#e4b434', '#a4701c', '#fff2a0'], mouth: ['#ac3e2a', '#4a1614'], eyes: ['#e04a3a', '#f6d458'], fog: '#bfae8a', soil: ['#583522', '#6e432a', '#875434'], cap: null },
  mountain: { dk: '#38245c', pet: ['#9c7ae6', '#6440a8', '#e2d6ff'], mouth: ['#d0808e', '#4c3080'], eyes: ['#76b2d4', '#f6d458'], fog: '#9aa6b6', soil: ['#3a3632', '#4a4540', '#5c564f'], cap: null },
  swamp: { dk: '#243520', pet: ['#73963e', '#3a5a2a', '#c8da84'], mouth: ['#ac3e2a', '#2e0e0e'], eyes: ['#8eab4c', '#e4b434'], fog: '#7f9a6a', soil: ['#141c12', '#1c2818', '#243520'], cap: null },
  winter: { dk: '#22486c', pet: ['#a6d2e6', '#5292bc', '#ffffff'], mouth: ['#7e58cc', '#281a40'], eyes: ['#76b2d4', '#d6eef6'], fog: '#c8d8ea', soil: ['#a6d2e6', '#d6eef6', '#f6f2ea'], cap: '#f6f2ea' },
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

// ---- мелкий пиксель: каждая тварь нарисована в NG_Q раз подробнее клетки мира, а ставится в прежнем размере ----
// Художники работают в «базовых» координатах (цветок 36×48, рука 19×30 …), а красят мелкие пиксели (¼ базового).
// Кисти: заливка по условию, эллипс, сужающийся отрезок. Тени — тона палитры с шахматным смешением, силуэт обводится сам.
const NG_Q = 4;
const NG_RGB = {}, NG_MIXC = {};
function ngRgb(h) { let v = NG_RGB[h]; if (!v) { const n = parseInt(h.slice(1, 7), 16); v = NG_RGB[h] = [n >> 16 & 255, n >> 8 & 255, n & 255]; } return v; }
function ngMix(a, b, k) {
  const key = a + b + k;
  let v = NG_MIXC[key];
  if (!v) { const A = ngRgb(a), B = ngRgb(b); v = NG_MIXC[key] = '#' + A.map((x, i) => Math.round(x + (B[i] - x) * k).toString(16).padStart(2, '0')).join(''); }
  return v;
}
const NG_BAYER = [0.125, 0.625, 0.875, 0.375];
function ngTone(pal, lit, fx, fy) {   // lit 0..1 → тон палитры (от тёмного к светлому), между тонами — шахматка
  const v = Math.max(0, Math.min(0.999, lit)) * (pal.length - 1), i = Math.floor(v);
  return pal[Math.min(pal.length - 1, i + (v - i > NG_BAYER[(fy & 1) * 2 + (fx & 1)] ? 1 : 0))];
}
function ngLit(nx, ny) {   // шар со светом сверху-слева: nx, ny — точка на круге −1..1
  const z = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  return Math.max(0, Math.min(1, 0.18 + 0.82 * (-0.5 * nx - 0.55 * ny + 0.67 * z)));
}
function ngNoise(fx, fy) { return (((fx * 73856093) ^ (fy * 19349663)) >>> 0) % 1000 / 1000; }
// ol — цвет обводки (по умолчанию почти чёрный; у тварей в стиле Полудницы — тёплый бурый); «мягкие» пиксели (пыльца) без обводки
function ngArt(key, w, h, fn, noOutline, ol = '#0a0610', olK = 0.72) {
  return ngSprite(key, w * NG_Q, h * NG_Q, (c, P, W, H) => {
    const Q = NG_Q, buf = new Array(W * H).fill(null), soft = new Uint8Array(W * H);
    const A = {
      Q,
      set(fx, fy, col) { if (col && fx >= 0 && fy >= 0 && fx < W && fy < H) buf[fy * W + fx] = col; },
      erase(test) { for (let fy = 0; fy < H; fy++) for (let fx = 0; fx < W; fx++) if (buf[fy * W + fx] && test((fx + 0.5) / Q, (fy + 0.5) / Q)) buf[fy * W + fx] = null; },
      fill(x0, y0, x1, y1, f, nosol) {
        const a = Math.max(0, Math.floor(x0 * Q)), b = Math.min(W - 1, Math.ceil(x1 * Q)), e = Math.max(0, Math.floor(y0 * Q)), d = Math.min(H - 1, Math.ceil(y1 * Q));
        for (let fy = e; fy <= d; fy++) for (let fx = a; fx <= b; fx++) { const col = f((fx + 0.5) / Q, (fy + 0.5) / Q, fx, fy); if (col) { buf[fy * W + fx] = col; soft[fy * W + fx] = nosol ? 1 : 0; } }
      },
      ellipse(cx, cy, rx, ry, f, nosol) {
        A.fill(cx - rx, cy - ry, cx + rx, cy + ry, (x, y, fx, fy) => { const nx = (x - cx) / rx, ny = (y - cy) / ry; return nx * nx + ny * ny <= 1 ? (typeof f === 'string' ? f : f(nx, ny, fx, fy)) : null; }, nosol);
      },
      seg(x0, y0, x1, y1, r0, r1, f, nosol) {   // f(t вдоль, nx, ny — смещение от оси в долях радиуса, fx, fy)
        const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-6, R = Math.max(r0, r1);
        A.fill(Math.min(x0, x1) - R, Math.min(y0, y1) - R, Math.max(x0, x1) + R, Math.max(y0, y1) + R, (x, y, fx, fy) => {
          const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / L2)), r = r0 + (r1 - r0) * t, ox = x - x0 - dx * t, oy = y - y0 - dy * t;
          if (ox * ox + oy * oy > r * r) return null;
          return typeof f === 'string' ? f : f(t, ox / r, oy / r, fx, fy);
        }, nosol);
      },
    };
    fn(A, w, h);
    if (!noOutline) {   // обводка силуэта: край темнеет к почти чёрному
      const edge = [];
      for (let fy = 0; fy < H; fy++) for (let fx = 0; fx < W; fx++) {
        const i = fy * W + fx;
        if (!buf[i] || soft[i]) continue;
        if (fx === 0 || fy === 0 || fx === W - 1 || fy === H - 1 || !buf[i - 1] || !buf[i + 1] || !buf[i - W] || !buf[i + W]) edge.push(i);
      }
      for (const i of edge) buf[i] = ngMix(buf[i], ol, olK);
    }
    const img = c.createImageData(W, H), d = img.data;
    for (let i = 0; i < buf.length; i++) if (buf[i]) { const v = ngRgb(buf[i]); d[i * 4] = v[0]; d[i * 4 + 1] = v[1]; d[i * 4 + 2] = v[2]; d[i * 4 + 3] = 255; }
    c.putImageData(img, 0, 0);
  });
}
// холмик земли у основания твари
function ngMoundA(A, set, cx, gy, w) {
  const K = ngCols(set).soil, KP = [ngMix(K[0], '#000000', 0.35), K[0], K[1], K[2]];
  A.ellipse(cx, gy + 1.6, w, 2.8, (nx, ny, fx, fy) => ny > 0.55 ? null : ngTone(KP, ngLit(nx * 0.8, ny) + (ngNoise(fx, fy) - 0.5) * 0.25, fx, fy));
  for (const [dx, dy, r] of [[-w + 1.2, 0.6, 0.6], [w - 1.5, 0.4, 0.5], [-1.5, -0.6, 0.45], [2.2, -0.3, 0.4]]) A.ellipse(cx + dx, gy + dy, r, r * 0.8, (nx, ny, fx, fy) => ngTone(KP, ngLit(nx, ny) + 0.15, fx, fy));
}
const NG_BONE = ['#4a443c', '#706960', '#9e958a', '#c8bfb0', '#e8e1d4', '#fbf8ee'];

// ---- рука скелета: 0 бугорок и кончики пальцев, 1 вылезает кулаком-когтем, 2 рука вверх, 3 и 4 качнулась влево/вправо, 5 сжала кулак ----
// Кости как в анатомии: лучевая и локтевая, косточки запястья, пястные, по три фаланги с суставами, большой палец сбоку.
const NG_HAND_SEQ = [0, 0, 1, 1, 2, 3, 4, 3, 4, 3, 5, 5, 2, 1, 0];   // шаг 0.35 с
const NG_HAND_F = [
  { L: 0, tilt: 0, curl: 1, sp: 0 }, { L: 6, tilt: 0, curl: 0.75, sp: 0.1 }, { L: 8, tilt: 0, curl: 0.05, sp: 0.3 },
  { L: 8, tilt: -1, curl: 0.1, sp: 0.5 }, { L: 8, tilt: 1, curl: 0.1, sp: 0.5 }, { L: 8, tilt: 0, curl: 1, sp: 0 },
];
function ngBoneSeg(A, x0, y0, x1, y1, r0, r1, knob) {
  A.seg(x0, y0, x1, y1, r0, r1, (t, nx, ny, fx, fy) => ngTone(NG_BONE, 0.62 - 0.42 * nx - 0.12 * ny, fx, fy));
  if (knob) A.ellipse(x1, y1, r1 * 1.35, r1 * 1.2, (nx, ny, fx, fy) => ngTone(NG_BONE, ngLit(nx, ny) + 0.1, fx, fy));
}
function ngHand(set, f) {
  return ngArt('hand_' + set + f, 19, 30, (A, W, H) => {
    const F = NG_HAND_F[f], cx = 9.5, gy = H - 2.6;
    if (f === 0) {
      for (const [dx, h] of [[-3, 1.2], [-1, 2], [1, 2.6], [3, 1.4]]) ngBoneSeg(A, cx + dx, gy + 1, cx + dx * 1.1, gy - h, 0.5, 0.42, true);
      ngMoundA(A, set, cx, gy, 6.6);
      return;
    }
    const wy = gy - F.L, hx = cx + F.tilt * 2;
    ngBoneSeg(A, cx - 1.1, gy + 1.5, hx - 1.1, wy + 0.4, 0.78, 0.62, false);   // лучевая
    ngBoneSeg(A, cx + 1.2, gy + 1.5, hx + 1.2, wy + 0.4, 0.66, 0.55, false);   // локтевая
    for (const [dx, dy, r] of [[-1.8, -0.3, 0.75], [-0.4, -0.6, 0.7], [1.0, -0.4, 0.7], [2.1, -0.2, 0.6], [-1.1, -1.4, 0.6], [0.4, -1.5, 0.62], [1.7, -1.3, 0.58]])   // запястье
      A.ellipse(hx + dx, wy + dy, r, r * 0.85, (nx, ny, fx, fy) => ngTone(NG_BONE, ngLit(nx, ny), fx, fy));
    const lens = [5, 7, 6, 4], my = wy - 1.7;
    for (let i = 0; i < 4; i++) {
      const fan = (i - 1.5) * F.sp, bx0 = hx + (i - 1.5) * 1.15, mx = bx0 + (i - 1.5) * 0.5 + fan * 0.9, myy = my - 3.2;
      ngBoneSeg(A, bx0, my, mx, myy, 0.5, 0.42, true);   // пястная кость
      const lenK = 1 - 0.78 * F.curl;
      let x = mx, y = myy, ang = -Math.PI / 2 + fan * 0.55;
      const segs = [0.45, 0.33, 0.22];
      for (let k = 0; k < 3; k++) {
        const L = Math.max(0.5, lens[i] * segs[k] * lenK * 1.05);
        ang += fan * 0.12 + (F.curl > 0.5 ? (i < 2 ? 0.5 : -0.5) * F.curl : 0);
        const nx2 = x + Math.cos(ang) * L, ny2 = y + Math.sin(ang) * L;
        ngBoneSeg(A, x, y, nx2, ny2, 0.5 - k * 0.06, 0.42 - k * 0.07, k < 2);
        x = nx2; y = ny2;
      }
      A.ellipse(x, y, 0.32, 0.32, NG_BONE[5]);   // кончик
    }
    // большой палец — сбоку наискось
    const tl = F.curl > 0.6 ? 1.2 : 2.4;
    ngBoneSeg(A, hx - 2.1, wy - 0.9, hx - 2.1 - tl * 0.6, wy - 0.9 - tl * 0.7, 0.45, 0.38, true);
    ngBoneSeg(A, hx - 2.1 - tl * 0.6, wy - 0.9 - tl * 0.7, hx - 2.1 - tl * 1.0, wy - 0.9 - tl * 1.35, 0.38, 0.3, false);
    ngMoundA(A, set, cx, gy, 6.6);
  });
}

// ---- цветы в стилистике Полудницы (fairy2.js): тёплая бурая обводка, лепестки с жилками, зелёный сочный стебель, зубчатые листья ----
const NG_STEM = ['#14240f', '#22381a', '#2f4a26', '#3f6430', '#5e8e3c', '#8cc054'];
const NG_PETALS = [   // лепестки: глубина у основания, тень, тело, свет, кромка
  ['#2a1040', '#4a2a7a', '#6e44b0', '#9c74e0', '#cdb4ff'],   // фиолетовый
  ['#3e0806', '#7a1a10', '#b42a1a', '#e05a34', '#ff9a70'],   // красный
  ['#4e2a06', '#8a5410', '#c88a1a', '#eebc3a', '#fff0a0'],   // жёлтый
  ['#14280a', '#2a4a16', '#467a24', '#78aa3a', '#bee07a'],   // зелёный
  ['#5a2a3a', '#a06078', '#d898b2', '#f4cadb', '#ffffff'],   // бело-розовый
];
const NG_HEAT = ['#280f06', '#4e240e', '#7c4018', '#b26e26', '#d8a23c', '#eece7a', '#faeaba', '#fffce8'];   // зной Полудницы: от бурого до добела
const NG_PARCH = ['#5c3016', '#925c2e', '#c69258', '#e4c086', '#f6e0b0'];                                  // кожа-пергамент
const NG_FANG = ['#8a6a44', '#d8bc8a', '#f4e2b8', '#fffce8'];
const NG_WARM_OL = '#2a1406';
// лепесток-лодочка от (x0, y0) по направлению a длиной L, шириной wd: у основания тёмный, к кончику светлый, жилки, кончик с выемкой
function ngPetal(A, x0, y0, a, L, wd, pal, curl) {
  const ux = Math.cos(a), uy = Math.sin(a), R = L + wd;
  A.fill(x0 - R, y0 - R, x0 + R, y0 + R, (x, y, fx, fy) => {
    const dx = x - x0, dy = y - y0, t = (dx * ux + dy * uy) / L, s = dx * -uy + dy * ux;
    if (t < 0 || t > 1) return null;
    const half = wd * Math.sin(Math.PI * Math.min(1, Math.pow(t, 0.7) * 0.92 + 0.04)) * (t > 0.86 ? 1 - (t - 0.86) * 2.2 : 1);
    if (Math.abs(s) > half) return null;
    if (t > 0.9 && Math.abs(s) < half * 0.25) return null;                                  // выемка на кончике
    const q = s / (half || 1);
    if (Math.abs(q) < 0.12 && t < 0.8) return pal[1];                                       // жилка
    if (Math.abs(Math.abs(q) - 0.55) < 0.07 && t > 0.2 && t < 0.7) return pal[2];           // боковые жилки
    return ngTone(pal, 0.25 + t * 0.6 - q * 0.22 + (curl && t > 0.75 ? 0.25 : 0), fx, fy);  // загнутый кончик ловит свет
  });
}
// Растение под головой: трава у корня, S-образный стебель с шипами до (tx, ty), два зубчатых листа-серпа, два маленьких цветка
// на веточках и бутон с зубками в щёлке. Возвращает pt(k) — точку стебля (0 у земли, 1 у головы).
function ngPlant(A, W, H, PET, tx, ty, sw, ph) {
  const bx = W / 2, len = H - 0.6 - ty;
  for (let j = 0; j < 14; j++) { const gx = bx - 10 + j * 1.55, gh = 1.8 + (j * 7 % 5) * 0.5; A.seg(gx, H, gx + ((j & 1) ? 0.6 : -0.5), H - gh, 0.28, 0.06, j % 3 ? NG_STEM[2] : NG_STEM[3]); }
  const pt = (k) => [bx + (tx - bx) * k * k * (3 - 2 * k) + Math.sin(k * 6.283) * 1.2 + sw * k, H - 0.6 - len * k];
  for (let i = 0; i < 12; i++) { const [x0, y0] = pt(i / 12), [x1, y1] = pt((i + 1) / 12); A.seg(x0, y0, x1, y1, 1.35, 1.2, (t, nx, ny, fx, fy) => ngTone(NG_STEM, 0.62 - 0.5 * nx, fx, fy)); }
  for (const [k, s] of [[0.3, 1], [0.6, -1]]) { const [x, y] = pt(k); A.seg(x + s * 1.3, y, x + s * 2.7, y - 1.2, 0.4, 0.05, NG_STEM[1]); }   // шипы
  const leaf = (k, s, L, wd) => {   // широкий зубчатый лист, изогнут серпом, с жилками
    const [sx, sy] = pt(k), N = 18, pts = [];
    let x = sx + s * 0.8, y = sy, d = s > 0 ? -0.35 : Math.PI + 0.35;
    for (let i = 0; i <= N; i++) { pts.push([x, y]); d += -s * 0.07; x += Math.cos(d) * L / N; y += Math.sin(d) * L / N; }
    A.fill(sx - L - 2, sy - L - 2, sx + L + 2, sy + 3, (px, py, fx, fy) => {
      let best = 1e9, bi = 0;
      for (let i = 0; i <= N; i++) { const dd = (px - pts[i][0]) ** 2 + (py - pts[i][1]) ** 2; if (dd < best) { best = dd; bi = i; } }
      const t = bi / N, half = wd * Math.sin(Math.PI * Math.pow(t, 0.8)) * (1 + 0.18 * Math.sin(t * 40)), dist = Math.sqrt(best);   // зубчики по краю
      if (dist > half || t < 0.04) return null;
      const [ax, ay] = pts[Math.max(0, bi - 1)], [cx2, cy2] = pts[Math.min(N, bi + 1)], side = ((px - pts[bi][0]) * -(cy2 - ay) + (py - pts[bi][1]) * (cx2 - ax)) * s;
      if (dist < 0.18 && t < 0.92) return NG_STEM[2];
      if (Math.abs(((t * 6 + dist * 0.5) % 1) - 0.5) < 0.06 && dist > 0.3 && dist < half * 0.85) return NG_STEM[3];
      return ngTone(NG_STEM, 0.4 + (side > 0 ? 0.3 : -0.05) + (dist / half) * 0.15, fx, fy);
    });
  };
  leaf(0.16, -1, 8.5, 2.1); leaf(0.4, 1, 7.5, 1.9);
  const bloom = (k, s, dx, dy, r) => {   // маленький цветок на веточке: та же расцветка, в серединке пыльники
    const [sx, sy] = pt(k), cx = sx + s * dx + sw * 0.3, cy = sy - dy;
    A.seg(sx + s * 0.6, sy, cx - s * 0.4, cy + 0.8, 0.42, 0.34, (t, nx, ny, fx, fy) => ngTone(NG_STEM, 0.55 - nx * 0.4, fx, fy));
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + k * 3; ngPetal(A, cx + Math.cos(a) * 0.5, cy + Math.sin(a) * 0.5, a, r, r * 0.38, PET, false); }
    A.ellipse(cx, cy, r * 0.32, r * 0.32, (nx, ny, fx, fy) => ngTone([NG_HEAT[2], NG_HEAT[3], NG_HEAT[4], NG_HEAT[5]], ngLit(nx, ny), fx, fy));
  };
  bloom(0.5, -1, 6.4, 3.2, 2.3); bloom(0.27, 1, 7, 2, 2);
  {   // бутон: зелёные чашелистики сжаты, из щёлки торчат зубки
    const [sx, sy] = pt(0.62), ex = sx + 6.5 + sw * 0.4, ey = sy - 4.5;
    A.seg(sx + 0.6, sy, ex - 0.6, ey + 1.6, 0.5, 0.42, (t, nx, ny, fx, fy) => ngTone(NG_STEM, 0.55 - nx * 0.4, fx, fy));
    A.ellipse(ex, ey, 1.7, 2.3, (nx, ny, fx, fy) => {
      if (Math.abs(nx + ny * 0.25) < 0.1 && ny < 0.6) return NG_HEAT[0];
      if (Math.abs(nx + ny * 0.25) < 0.26 && ny > -0.5 && ny < 0.4 && (Math.floor((ny + 1) * 5) & 1)) return NG_HEAT[6];
      if (ny < -0.6) return ngTone(PET, 0.6 + nx * 0.2, fx, fy);
      return ngTone(NG_STEM, ngLit(nx, ny), fx, fy);
    });
  }
  return pt;
}

// ---- плотоядный цветок (вид сбоку, как «чомпер»): голова — тугой бутон из лепестков-чешуй, две челюсти на шарнире у затылка ----
// Кадры: 0 и 1 — покой (голова чуть покачивается), 2, 3, 4 — пасть раскрывается в три шага (на 4 откинулся назад),
// 5 хлопнул (бросок вперёд), 6 и 7 — жуёт. Челюсти — не картинки, а формы: каждая точка берётся обратным поворотом вокруг шарнира,
// чешуйки нарисованы в координатах своей челюсти и поворачиваются вместе с ней; шарнир закрыт зелёными чашелистиками — стыка не видно.
// Смотрит вправо; влево — зеркалом вокруг основания стебля. Пять расцветок. Кусает без урона: гном только пугается (nightGroundTick).
const NG_FL_F = [   // th — подъём верхней челюсти, lo — опускание нижней (градусы); dx, dy — сдвиг головы; ch — щёки (глубина нижней челюсти)
  { th: 0, lo: 0, dx: 0, dy: 0, ch: 6.5 }, { th: 0, lo: 0, dx: 0, dy: -1, ch: 6.5 },
  { th: 10, lo: 3, dx: 0, dy: 0, ch: 6.5 }, { th: 22, lo: 7, dx: -0.5, dy: -0.5, ch: 6.5 }, { th: 36, lo: 12, dx: -1, dy: -1, ch: 6.5 },
  { th: 0, lo: 0, dx: 3, dy: 1, ch: 6.5 },
  { th: 0, lo: 0, dx: 1, dy: 1, ch: 8.5 }, { th: 9, lo: 3, dx: 0, dy: 0, ch: 7.5, food: true },
];
const NG_FL_N = NG_FL_F.length;
const NG_FL_W = 36, NG_FL_H = 48, NG_FL_HX = 13, NG_FL_HY = 21;
function ngFlower(v, f) {
  return ngArt('flower_' + v + '_' + f, NG_FL_W, NG_FL_H, (A, W, H) => {
    const PET = NG_PETALS[v], F = NG_FL_F[f], sx = NG_FL_HX + F.dx, sy = NG_FL_HY + F.dy, sw = F.dx * 0.25;
    const th = F.th * Math.PI / 180, lo = F.lo * Math.PI / 180, ct = Math.cos(th), st = Math.sin(th), cl = Math.cos(lo), sl = Math.sin(lo);
    const CX = 5, RX = 11, RU = 10.5, LX = 5.5, RXL = 10, RL = F.ch, open = F.th > 0.5, HX = -4.6, HY = 0.4;   // HX, HY — шарнир у затылка
    ngPlant(A, W, H, PET, sx - 2.5, sy + 6.2, sw, f * 0.35);
    // иглы зубов: место и длина; у передних длиннее
    const UT = [[2.6, 1.3], [4.4, 1.8], [6.3, 1.6], [8.2, 2.1], [10.2, 1.7], [12.3, 2.5], [14.2, 1.6]], LT = [[3.6, 1.2], [5.5, 1.5], [7.4, 1.4], [9.3, 1.7], [11.3, 1.5], [13.2, 1.9]];
    const fang = (lx, d, T) => { for (const [t, n] of T) { if (d < 0 || d >= n) continue; const hw = 0.62 * (1 - d / n), q = Math.abs(lx - t) / hw; if (q < 1) return q; } return -1; };
    const upL = (X, Y) => { const x = X - HX, y = Y - HY; return [x * ct - y * st + HX, x * st + y * ct + HY]; };
    const lwL = (X, Y) => { const x = X - HX, y = Y - HY; return [x * cl + y * sl + HX, -x * sl + y * cl + HY]; };
    // чешуйки-лепестки на челюсти: ряды по удалению от центра, столбцы по углу; кончики смотрят наружу, по краю силуэт зубчатый
    const scale = (nx, ny, fx, fy, upper) => {
      const rho = Math.sqrt(nx * nx + ny * ny), ang = Math.atan2(ny, nx), t = upper ? (ang + Math.PI) / Math.PI : ang / Math.PI;
      const rows = [[0, 0.42, 4], [0.42, 0.72, 7], [0.72, 1.02, 10]], ri = rho < 0.42 ? 0 : rho < 0.72 ? 1 : 2, [r0, r1, n] = rows[ri];
      const u = t * n + (ri & 1) * 0.5, cu = u - Math.floor(u), rv = (rho - r0) / (r1 - r0);
      const w = 0.5 * Math.sqrt(Math.max(0, 1 - Math.max(0, (rv - 0.5) / 0.5) ** 2));
      if (Math.abs(cu - 0.5) > w) return ri === 2 && rv > 0.62 ? null : PET[0];   // щель между чешуйками / зубчатый край
      if (Math.abs(cu - 0.5) < 0.05 && rv < 0.85) return PET[1];
      return ngTone(PET, 0.18 + rv * 0.35 + ngLit(nx * 0.9, upper ? ny : ny * 0.7) * 0.5 - Math.abs(cu - 0.5) * 0.4, fx, fy);
    };
    A.fill(sx - 10, sy - 23, sx + 23, sy + 15, (x, y, fx, fy) => {
      const X = x - sx, Y = y - sy, [ux, uy] = upL(X, Y), [lx, ly] = lwL(X, Y);
      let q = (open || ux > 9.5) && uy >= 0 && ux > 1.6 ? fang(ux, open ? uy : uy * 2, UT) : -1;   // у закрытого бутона спереди торчат кончики клыков
      if (q >= 0) return q > 0.7 ? NG_FANG[0] : ngTone(NG_FANG, 0.95 - uy * 0.3 - q * 0.3, fx, fy);
      q = open && ly < 0 && lx > 2.6 ? fang(lx, -ly, LT) : -1;
      if (q >= 0) return q > 0.7 ? NG_FANG[0] : ngTone(NG_FANG, 0.95 + ly * 0.3 - q * 0.3, fx, fy);
      if (uy < 0 && ((ux - CX) / RX) ** 2 + (uy / RU) ** 2 <= 1) {   // верхняя челюсть
        if (open ? ux > -1.5 && uy > -0.6 : ux > 6 && uy > -0.4) return open ? ngMix(PET[0], '#c04860', 0.55) : PET[1];   // губы смыкаются только спереди; у открытой пасти — десна
        return scale((ux - CX) / RX, uy / RU, fx, fy, true);
      }
      if (ly >= 0 && ((lx - LX) / RXL) ** 2 + (ly / RL) ** 2 <= 1) {   // нижняя челюсть
        if (open && ly < 0.6 && lx > -1.5) return ngMix(PET[0], '#c04860', 0.55);
        return scale((lx - LX) / RXL, ly / RL, fx, fy, false);
      }
      const ma = (Math.atan2(Y - HY, X - HX) + th) / (th + lo || 1), mr = Math.hypot(X - HX, Y - HY);
      if (open && X > HX && uy >= 0 && ly <= 0 && mr < 20 - 7 * Math.sin(Math.PI * Math.max(0, Math.min(1, ma)))) {   // нутро клином: язык снизу, глотка у шарнира
        if (F.food && (lx - 8) ** 2 + (ly + 2.2) ** 2 < 0.8) return ngTone(['#6a4020', '#a87040', '#d8a868'], 0.6, fx, fy);
        if (ly > -1.7 && lx < 12.5) return ly > -0.9 ? '#e07890' : '#c04860';
        return ngTone([NG_HEAT[0], '#3a0c14', '#6a1a24'], Math.min(1, (X - HX) / 13) * 0.95, fx, fy);
      }
      return null;
    });
    // слюна с переднего клыка, когда пасть распахнута
    if (F.th > 30) { const tx = sx + HX + (14.2 - HX) * ct + (1.6 - HY) * st, ty = sy + HY - (14.2 - HX) * st + (1.6 - HY) * ct; A.seg(tx, ty, tx + 0.2, ty + 2.2, 0.2, 0.32, '#e8b0b8', true); }
    // чашелистики поверх шарнира: прячут стык челюстей
    for (const [a, L, wd] of [[Math.PI * 0.95, 6.2, 1.5], [Math.PI * 1.18, 5.4, 1.3], [Math.PI * 0.72, 5.2, 1.3], [Math.PI * 1.4, 4.2, 1.1]]) ngPetal(A, sx + HX + 1.4, sy + HY + 0.6, a, L, wd, NG_STEM.slice(0, 5), false);
    A.ellipse(sx + HX + 1.2, sy + HY + 0.8, 1.8, 1.8, (nx, ny, fx, fy) => ngTone(NG_STEM, ngLit(nx, ny), fx, fy));
    // пыльца
    for (let j = 0; j < (F.dx > 2 ? 9 : 4); j++) { const a = j * 2.1 + f, r = 9 + (j * 5 % 6); A.ellipse(sx + 6 + Math.cos(a) * r, sy - 4 + Math.sin(a) * r * 0.6, 0.3, 0.3, j % 2 ? NG_HEAT[6] : NG_HEAT[5], true); }
  }, false, NG_WARM_OL, 0.78);
}

// ---- цветок-полудница: отдельная тварь. Сердцевина — лицо-череп Полудницы в трещинах от зноя: злые брови, глубокие глазницы с добела
// раскалёнными точками, безгубый оскал; при укусе челюсть отвисает в разинутую пасть с клыками. Вокруг два ряда лепестков с жилками,
// за ними чашелистики, по краю сердцевины тычинки с пыльцой; снизу зелёная завязь. Кадры — как у плотоядного цветка (0–7).
const NG_NOON_F = [
  { mo: 0, dy: 0, sw: 0, op: 0 }, { mo: 0, dy: -0.4, sw: 1, op: 0, blink: true },
  { mo: 1.6, dy: -0.3, sw: 0.5, op: 0.35 }, { mo: 3.2, dy: -0.8, sw: 0, op: 0.7 }, { mo: 5, dy: -1.3, sw: -0.5, op: 1, flare: true },
  { mo: 0, dy: 1.2, sw: 0, op: -0.5, snap: true },
  { mo: 0.9, dy: 0.5, sw: 0.4, op: 0.1 }, { mo: 0, dy: 0.2, sw: -0.4, op: 0, food: true },
];
function ngNoonFlower(v, f) {
  return ngArt('noonfl_' + v + '_' + f, 36, 48, (A, W, H) => {
    const F = NG_NOON_F[f], PET = NG_PETALS[v], ph = f * 0.35, K = NG_HEAT, S = NG_PARCH;
    const hx = 18 + F.sw * 0.6, hy = 15 + F.dy, FS = 0.72, jaw = 6.6 + F.mo * 0.9 + (F.snap ? -0.4 : 0);   // FS — лицо меньше, цветка больше
    ngPlant(A, W, H, PET, hx, hy + jaw * FS + 1.6, F.sw, ph);
    const op = F.op, spread = 1 + op * 0.14;
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + 0.2 + ph * 0.05; ngPetal(A, hx + Math.cos(a) * 3.4, hy + Math.sin(a) * 3.4, a, 9.6 * spread, 1.15, NG_STEM.slice(0, 5), false); }   // чашелистики
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2 + ph * 0.06 + F.sw * 0.03; ngPetal(A, hx + Math.cos(a) * 3.2, hy + Math.sin(a) * 3.2, a + Math.sin(i * 1.7) * 0.06, (8.2 + (i % 2) * 0.9) * spread, 2.35, PET, op > 0.5); }
    for (let i = 0; i < 14; i++) { const a = (i + 0.5) / 14 * Math.PI * 2 + ph * 0.06; ngPetal(A, hx + Math.cos(a) * 3.2, hy + Math.sin(a) * 3.2, a, (6 + (i % 3) * 0.35) * (1 + op * 0.08), 1.85, [PET[1], PET[2], PET[3], PET[4], PET[4]], false); }
    for (let i = 0; i < 18; i++) {   // тычинки по краю сердцевины
      const a = i / 18 * Math.PI * 2 + 0.1, r0 = 6.2 * FS, r1 = (7.4 + (i % 2) * 0.6 + op * 0.4) * FS + 0.4, k = Math.sin(a) > 0 ? jaw / 6.6 : 1;
      const x0 = hx + Math.cos(a) * r0, y0 = hy + Math.sin(a) * r0 * k, x1 = hx + Math.cos(a) * r1, y1 = hy + Math.sin(a) * r1 * k;
      A.seg(x0, y0, x1, y1, 0.12, 0.1, K[4], true); A.ellipse(x1, y1, 0.32, 0.32, i % 3 ? K[5] : K[6], true);
    }
    A.ellipse(hx, hy + jaw * FS - 0.2, 2.8, 2.1, (nx, ny, fx, fy) => ny < -0.3 ? null : ngTone(NG_STEM, ngLit(nx, ny * 0.8) * 0.9, fx, fy));   // завязь
    const inFace = (x, y) => { const dx = (x - hx) / 6.4, dy = (y - hy) / (y > hy ? jaw : 6.6); return dx * dx * (1 + Math.max(0, dy) * 0.8) + dy * dy <= 1; };
    A.fill(hx - 7 * FS, hy - 7 * FS, hx + 7 * FS, hy + (jaw + 0.5) * FS, (x0, y0, fx, fy) => {
      const x = hx + (x0 - hx) / FS, y = hy + (y0 - hy) / FS;
      if (!inFace(x, y)) return null;
      const ax = Math.abs(x - hx), ry = y - hy;
      for (const s of [-1, 1]) {   // глазницы с раскалённой точкой; при укусе разгорается
        const ex = hx + s * 2.5, ey = hy - 0.6, d = ((x - ex) / 1.75) ** 2 + ((y - ey) / 1.45) ** 2;
        if (d <= 1) {
          if (F.blink) return Math.abs(y - ey) < 0.25 ? S[0] : S[1];
          const g = Math.hypot(x - ex, y - ey + 0.1), hot = F.flare ? 0.75 : F.mo > 0 ? 0.6 : 0.45;
          return g < hot * 0.55 ? K[7] : g < hot ? K[5] : g < hot + 0.35 && ngNoise(fx, fy) > 0.4 ? K[2] : K[0];
        }
        if (d <= 1.4) return S[0];
        const by = hy - 2.6 - (s * (x - hx) - 1.2) * 0.42;   // бровь: внутренний край ниже — злоба
        if (s * (x - hx) > 0.6 && s * (x - hx) < 4.4 && Math.abs(y - by) < 0.32) return K[0];
      }
      if (ry > 1.4 && ry < 2.9 && ax < (ry - 1.3) * 0.55 + 0.1) return K[0];   // нос черепа
      const my = hy + 4.2;
      if (F.mo > 0.5) {   // разинутая пасть с клыками
        const mry = F.mo * 0.72, mcy = my + F.mo * 0.45, d = ((x - hx) / (3.3 + F.mo * 0.12)) ** 2 + ((y - mcy) / mry) ** 2;
        if (d <= 1) {
          const tt = y - (mcy - mry), bb = mcy + mry - y, k = (((x - hx + 4) / 0.9) % 1 + 1) % 1, longF = F.flare ? 1.5 : 0.9;
          if (ax < 3 && tt < (k < 0.5 ? longF : 0.45) && Math.abs(k - 0.25) < 0.22) return tt < 0.2 ? K[5] : K[6];
          if (ax < 2.8 && bb < (k > 0.5 ? longF * 0.8 : 0.4) && Math.abs(k - 0.75) < 0.22) return K[6];
          if (F.food && Math.hypot(x - hx - 0.6, y - mcy - 0.3) < 0.6) return '#6a3a1a';
          return d < 0.3 && F.mo > 3 ? '#6e1808' : K[0];
        }
        if (d <= 1.3) return S[0];
      } else {   // безгубый растянутый оскал до ушей
        const up = ax > 2.6 ? (ax - 2.6) * 0.55 : 0, yy = y + up;
        if (ax < 5 && yy > my - 0.55 && yy < my + 0.55) {
          if (Math.abs(yy - my) > 0.33) return K[0];
          return ax > 4.2 ? K[0] : (Math.floor((x - hx + 8) / 0.7) & 1) ? K[5] : K[6];
        }
      }
      if (Math.abs(x - (hx - 1.6 + Math.sin(y * 2.2) * 0.35)) < 0.12 && ry < -3.2) return S[1];   // трещины от зноя
      if (Math.abs(y - (hy + 1.6 + (x - hx - 4.5) * 0.6)) < 0.12 && x > hx + 3.8 && x < hx + 5.6) return S[1];
      const ch = ((ax - 4.1) / 1.3) ** 2 + ((ry - 3.1) / 1.6) ** 2;   // впалые щёки
      if (ch < 1) return ch < 0.45 ? S[0] : S[1];
      if (((ax - 3.6) / 1.2) ** 2 + ((ry - 0.9) / 0.8) ** 2 < 1) return S[4];   // скулы
      if (ax > 5.6) return ngMix(S[1], PET[1], 0.35);                           // край сердцевины уходит в цвет лепестков
      if (ax > 5.2) return S[1];
      return ngTone(S, 0.75 - ry / 14 - ax / 18 + (ngNoise(fx, fy) - 0.5) * 0.12, fx, fy);
    });
    for (let j = 0; j < (F.snap ? 10 : 6); j++) { const a = j * 2.1 + ph * 2, r = 11 + (j * 5 % 6); A.ellipse(hx + Math.cos(a) * r, hy + Math.sin(a) * r * 0.8 - 1, 0.3, 0.3, j % 2 ? K[6] : K[5], true); }   // пыльца
    if (F.food) for (const [dx, dy] of [[3.6, 6.2], [-3, 7]]) A.ellipse(hx + dx, hy + dy, 0.35, 0.3, '#8a5a2a', true);
  }, false, NG_WARM_OL, 0.78);
}

// ---- надгробие: 0..5 — всё выше из земли; закруглённый камень, вырезанный крест и строки, трещина, мох ----
const NG_TOMB_VIS = [3, 6, 9, 12, 15, 16];
const NG_STONE = ['#3a3632', '#4a4540', '#706960', '#8a8278', '#9e958a', '#b6ada0', '#d0c8bc'];
function ngTomb(set, f) {
  return ngArt('tomb_' + set + f, 16, 20, (A, W, H) => {
    const C = ngCols(set), vis = NG_TOMB_VIS[f], cx = 8, w = 5.3, bottom = H - 2, top = bottom - vis;
    A.fill(cx - w, top, cx + w, bottom, (x, y, fx, fy) => {
      const dx = (x - cx) / w, ry = y - (top + w);
      if (ry < 0 && dx * dx + (ry / w) ** 2 > 1) return null;
      const r = y - top;
      if (C.cap && r < 1.6 && Math.abs(dx) < 0.95) return ngTone(['#d6eef6', '#f6f2ea', '#ffffff'], 0.8 - dx * 0.4, fx, fy);
      // вырезы: крест и две строки «надписи», у выреза светлая нижняя кромка
      const cut = (xx, yy) => (Math.abs(xx - cx) < 0.5 && yy > top + 2.8 && yy < top + 8.6) || (Math.abs(yy - (top + 4.8)) < 0.45 && Math.abs(xx - cx) < 2.1)
        || ((Math.abs(yy - (top + 10.6)) < 0.32 || Math.abs(yy - (top + 12.4)) < 0.32) && Math.abs(xx - cx) < 3 && Math.sin(xx * 5.3) > -0.4);
      if (cut(x, y)) return NG_STONE[0];
      if (cut(x - 0.25, y - 0.25)) return NG_STONE[6];
      if (Math.abs(x - (cx + 2.3 + Math.sin(y * 1.7) * 0.6)) < 0.18 && r > 1 && r < 7) return NG_STONE[1];   // трещина
      if (!C.cap && r > 9 && dx < -0.45 && ngNoise(fx >> 1, fy >> 1) > 0.55) return ngTone(['#2f4a26', '#4a6e30', '#73963e'], ngNoise(fx, fy), fx, fy);   // мох
      return ngTone(NG_STONE, 0.66 - dx * 0.32 - (r < 1.2 ? -0.2 : 0) + (ngNoise(fx, fy) - 0.5) * 0.18, fx, fy);
    });
    ngMoundA(A, set, cx, bottom + 0.6, w + 2.2);
    if (f < 5) for (const [dx, dy] of [[-w - 1.5, -0.8], [w + 1.6, -1.4], [-1, -3 - f]]) A.ellipse(cx + dx, bottom + dy, 0.5, 0.4, ngCols(set).soil[2]);
  });
}

// ---- череп из земли: 0 макушка, 1 лоб, 2 до глазниц, 3 целиком, 4 челюсть отвисла (огоньки разгораются), 5 челюсть чуть приоткрыта ----
// Не шар: вытянутый свод со сжатыми висками, тяжёлые надбровья над угловатыми злыми глазницами, острые скулы и впалые щёки,
// длинные кривые жёлтые зубы (пары не хватает), трещины, скол на темени, земля в порах. Голова чуть склонена набок.
const NG_SKULL_SEQ = [0, 1, 2, 3, 3, 4, 3, 4, 3, 5, 4, 3, 2, 1, 0];   // шаг 0.4 с
const NG_SKULL_V = [4, 8, 11, 16, 16, 16];
const NG_SKULL_JAW = [0, 0, 0, 0, 2.8, 1.1];
const NG_OLDBONE = ['#1e1a16', '#3a322a', '#5e5446', '#8a7e6a', '#b4a68c', '#d8ccb2', '#f0e8d4'];
function ngSkull(set, f) {
  return ngArt('skull_' + set + f, 19, 30, (A, W, H) => {
    const cx = 9.5, gy = H - 2.6, y0 = gy - NG_SKULL_V[f] + 1.2, jaw = NG_SKULL_JAW[f], ember = f >= 3;
    const tilt = -0.12, pcx = cx, pcy = y0 + 8, ctl = Math.cos(tilt), stl = Math.sin(tilt);
    const dark = '#0a0706';
    const TEETH = [[-3.6, 2.2, 0], [-2.55, 2.5, 0], [-1.5, 2.1, 1], [-0.5, 0, 0], [0.5, 2.6, 0], [1.55, 1.4, 1], [2.6, 2.3, 0], [3.6, 1.9, 0]];   // x, длина (0 — выпал), 1 — сколот
    const LOWT = [[-2.6, 1.3], [-1.55, 1.5], [-0.5, 1.4], [0.5, 1.6], [1.55, 0], [2.6, 1.3]];
    A.fill(cx - 8, y0 - 1, cx + 8, gy + 4, (wx, wy, fx, fy) => {
      // поворот головы набок: берём точку в «прямых» координатах черепа
      const x0 = wx - pcx, yy0 = wy - pcy, x = pcx + x0 * ctl + yy0 * stl, y = pcy - x0 * stl + yy0 * ctl, dx = x - cx, r = y - y0;
      // свод: яйцо, у висков (r 5.5..8.5) сужается
      const temple = r > 5 && r < 9 ? Math.sin((r - 5) / 4 * Math.PI) * 0.9 : 0;
      const halfW = r < 0 ? -1 : r < 6 ? 5.9 * Math.sqrt(Math.max(0, 1 - ((r - 5.6) / 5.8) ** 2)) : 5.9 - temple;
      const cran = r >= 0 && r <= 9 && Math.abs(dx) <= halfW;
      const cheek = r >= 7.4 && r <= 9.2 && Math.abs(dx) <= 5.6 - Math.abs(r - 8.2) * 0.9;     // скулы торчат в стороны
      const maxW = 4.1 - Math.max(0, r - 9.2) * 0.35, maxil = r > 8.5 && r <= 10.4 && Math.abs(dx) <= maxW;
      // верхние зубы: длинные, разной длины, щели между ними
      let tooth = null;
      if (r > 10.2 && r < 13.2) for (const [tx, len, chip] of TEETH) { if (len && Math.abs(dx - tx) < 0.44 - (r - 10.2) / len * 0.18 && r < 10.2 + len) tooth = [r - 10.2, len, chip]; }
      const jy = y0 + 12.4 + jaw, jr = y - jy;   // нижняя челюсть: U-образная, узкая
      const jawW = 3.9 - Math.max(0, jr) * 0.45, mand = jr >= 0 && jr <= 3.4 && Math.abs(dx) <= jawW;
      let ltooth = null;
      if (jr > -1.7 && jr < 0) for (const [tx, len] of LOWT) if (len && Math.abs(dx - tx) < 0.4 && -jr < len) ltooth = -jr / len;
      const gap = r > 10.2 && y < jy && Math.abs(dx) < 3.9 && !tooth && !ltooth;
      if (!cran && !cheek && !maxil && !tooth && !mand && !ltooth && !gap) return null;
      if (tooth || ltooth) {   // зубы: жёлтые, к кончику светлее, сколотые — с тёмной кромкой
        const k = tooth ? tooth[0] / tooth[1] : 1 - ltooth;
        if (tooth && tooth[2] && k > 0.75) return NG_OLDBONE[2];
        return ngTone(['#5a4a30', '#8a7650', '#c0aa78', '#e0d0a4', '#f4ead0'], 0.35 + k * 0.55 - Math.abs(dx % 1.05) * 0.1, fx, fy);
      }
      if (gap) {   // пасть: тьма, в глубине красный отсвет
        if (jaw > 1.5 && Math.abs(dx) < 1.6 && r > 11.4) return ngTone(['#1a0404', '#5a0c0a', '#a01810'], 1 - Math.abs(dx) / 1.6, fx, fy);
        return dark;
      }
      // глазницы: угловатые, внутренний край ниже — злой взгляд; в глубине огонёк
      for (const s of [-1, 1]) {
        const ex = dx - s * 2.45, ey = r - 5.9, topEdge = -1.25 + s * ex * 0.55;   // верхняя кромка наклонена к переносице
        const inS = ey > topEdge && ex * ex / 3.3 + ey * ey / 2.6 <= 1;
        if (inS) {
          if (ember) {
            const g = (ex - s * 0.15) ** 2 + (ey - 0.25) ** 2;
            const hot = f === 4 ? 1 : f === 5 ? 0.75 : 0.5;
            if (g < 0.12 * hot) return '#fff0c0';
            if (g < 0.32 * hot) return '#ff7a40';
            if (g < 0.7 * hot) return '#d02818';
            if (g < 1.3 * hot) return '#5a0c08';
          }
          return dark;
        }
        if (ey > topEdge - 0.45 && ey <= topEdge && Math.abs(ex) < 1.6) return NG_OLDBONE[1];   // тень под надбровьем
        if (ey > topEdge - 0.9 && ey <= topEdge - 0.45 && Math.abs(ex) < 1.5) return ngTone(NG_OLDBONE, 0.85, fx, fy);   // гребень надбровья — светлый
      }
      // нос: вытянутый перевёрнутый клин с перегородкой
      if (r > 7.6 && r < 10 && Math.abs(dx) < (r - 7.5) * 0.48 + 0.15) return Math.abs(dx) < 0.12 && r > 8.6 ? NG_OLDBONE[2] : dark;
      // трещины и скол на темени
      if (Math.abs(dx - (1.6 + Math.sin(r * 2.4) * 0.4)) < 0.12 && r > 0.6 && r < 3.2) return dark;
      if (Math.abs(dx + 3.4 + (r - 6) * 0.25) < 0.14 && r > 6.4 && r < 9.8) return dark;
      if ((dx + 2.6) ** 2 + (r - 1.2) ** 2 < 1.1) return (dx + 2.4) ** 2 + (r - 1.4) ** 2 < 0.55 ? dark : NG_OLDBONE[1];
      if (mand && !cran && !maxil) return ngTone(NG_OLDBONE, ngLit(dx / 4 * 0.8, 0.35 + jr / 3.4 * 0.6) * 0.9, fx, fy);
      // свет и тени: виски и впалые щёки темнее, скулы светлее, в порах земля
      let lit = ngLit(dx / 6.2, (r - 5) / 6.5);
      if (temple > 0.3 && Math.abs(dx) > halfW - 1.3) lit -= 0.35;
      if (r > 9.1 && r < 10.4 && Math.abs(dx) > 2.4) lit -= 0.4;
      if (cheek && Math.abs(dx) > 3.6) lit += 0.15;
      const n = ngNoise(fx, fy);
      if (n > 0.93) return ngMix(ngCols(set).soil[1], '#000000', 0.2);
      return ngTone(NG_OLDBONE, lit * 0.95 + (n - 0.5) * 0.12, fx, fy);
    });
    A.erase((x, y) => y > gy + 0.4);
    ngMoundA(A, set, cx, gy, 7);
  });
}

// ---- щупальца с глазом: три тонких фиолетовых отростка извиваются из земли; на самом длинном — глаз, он мигает ----
const NG_TENT_SEQ = [0, 1, 2, 3, 4, 3, 4, 5, 4, 3, 4, 5, 3, 2, 1, 0];   // шаг 0.38 с
const NG_TENT_L = [3, 9, 15, 21, 21, 21];
const NG_TENTC = ['#140e20', '#2a2040', '#4a3a6a', '#6a5890', '#9a88c0', '#c4b4e0'];
function ngTentacle(set, f) {
  return ngArt('tent_' + set + f, 19, 30, (A, W, H) => {
    const ey = ngCols(set).eyes, gy = H - 2.6, L = NG_TENT_L[f], ph = f * 1.9;
    const one = (bx, len, amp, p0, eye) => {
      const n = Math.max(2, Math.round(len * 1.5)), pts = [];
      for (let j = 0; j <= n; j++) { const k = j / n, yy = gy + 0.8 - len * k; pts.push([bx + Math.sin(k * len * 0.38 + p0 + ph) * amp * Math.min(1, k * 1.6), yy]); }
      for (let j = 0; j < n; j++) {
        const k0 = j / n, k1 = (j + 1) / n, r0 = 1.25 - k0 * 0.85, r1 = 1.25 - k1 * 0.85;
        A.seg(pts[j][0], pts[j][1], pts[j + 1][0], pts[j + 1][1], r0, r1, (t, nx, ny, fx, fy) => {
          const along = (k0 + (k1 - k0) * t) * len;
          if (nx > 0.3 && (along % 1.7) < 0.55 && along > 1) return nx > 0.7 ? NG_TENTC[3] : '#b89ccc';   // присоски
          return ngTone(NG_TENTC, 0.6 - 0.5 * nx, fx, fy);
        });
      }
      if (eye && len > 12) {   // глаз на конце: белок с прожилками, радужка, щель зрачка
        const [ex, eyy0] = pts[n], cy = eyy0 - 2.2;
        A.ellipse(ex, cy, 2.5, 2.3, (nx, ny, fx, fy) => {
          if (f === 5) return Math.abs(ny) < 0.12 ? NG_TENTC[0] : ngTone(NG_TENTC, ngLit(nx, ny), fx, fy);   // веко закрыто
          const rr = nx * nx + ny * ny, ix = nx * 2.5, iy = ny * 2.3;
          if (ix * ix + iy * iy < 1.7) {
            if (Math.abs(ix) < 0.32 && Math.abs(iy) < 1.15) return '#0c0c14';
            if ((ix + 0.5) ** 2 + (iy + 0.6) ** 2 < 0.1) return '#ffffff';
            return ix * ix + iy * iy > 1.1 ? ey[1] : ey[0];
          }
          if (rr > 0.55 && Math.abs(Math.sin(Math.atan2(ny, nx) * 5)) < 0.12) return '#b02020';   // прожилки
          return ngTone(['#a89c80', '#d8d0b0', '#ece4c8', '#fbf8e8'], ngLit(nx, ny), fx, fy);
        });
      }
    };
    one(6, L * 0.7, 2.2, 0.8, false);
    one(12.5, L * 0.55, 2.4, 3.1, false);
    one(9.5, L, 2.6, 0, true);
    A.erase((x, y) => y > gy + 1);
    ngMoundA(A, set, 9.5, gy, 7);
  });
}

// ---- паук из норы: из чёрной дыры высовываются суставчатые лапы, потом тело с гроздью красных глаз и красной меткой; лапы перебирают и прячутся ----
// 0 кончики двух лап, 1 четыре лапы, 2 все лапы и тело, 3 и 4 перебирает лапами (в 4 моргнул), 5 прячется
const NG_SPIDER_SEQ = [0, 1, 2, 3, 4, 3, 4, 2, 3, 4, 5, 1, 0];   // шаг 0.35 с
const NG_SPIDER_EXT = [0.35, 0.65, 1, 1, 1, 0.6];
const NG_CHITIN = ['#08060a', '#140e12', '#2c2028', '#4e3c48', '#7a6070', '#a88ca0'];
function ngSpider(set, f) {
  return ngArt('spider_' + set + f, 33, 22, (A, W, H) => {
    const K = ngCols(set).soil, cx = 16.5, gy = H - 4, ext = NG_SPIDER_EXT[f];
    // нора: земляной вал и чёрный провал
    A.ellipse(cx, gy + 0.9, 8, 3.2, (nx, ny, fx, fy) => ngTone([ngMix(K[0], '#000000', 0.3), K[0], K[1], K[2]], ngLit(nx, ny) + (ngNoise(fx, fy) - 0.5) * 0.3, fx, fy));
    A.ellipse(cx, gy + 0.5, 5.6, 2, (nx, ny) => ny < -0.4 ? '#140c08' : '#040303');
    const leg = (x0, y0, x1, y1, x2, y2, back) => {
      const pal = back ? NG_CHITIN.slice(0, 4) : NG_CHITIN;
      A.seg(x0, y0, x1, y1, 0.55, 0.45, (t, nx, ny, fx, fy) => ngTone(pal, 0.55 - 0.45 * nx - 0.3 * ny, fx, fy));
      A.seg(x1, y1, x2, y2, 0.42, 0.18, (t, nx, ny, fx, fy) => ngTone(pal, 0.5 - 0.45 * nx, fx, fy));
      A.ellipse(x1, y1, 0.6, 0.55, (nx, ny, fx, fy) => ngTone(pal, ngLit(nx, ny), fx, fy));
      for (const t of [0.35, 0.7]) { const hx = x0 + (x1 - x0) * t, hy = y0 + (y1 - y0) * t; A.seg(hx, hy, hx + (x1 - x0 > 0 ? 0.5 : -0.5), hy - 0.7, 0.12, 0.06, NG_CHITIN[4]); }   // волоски
    };
    const n = f === 0 ? 1 : f === 1 ? 2 : 4, KX = [3, 5, 7, 6], KY = [-7, -8, -7, -5], TX = [2, 3, 4, 5];
    const legs = (back) => {
      for (let i = n - 1; i >= 0; i--) {
        if ((i >= 2) !== back) continue;
        for (const s of [-1, 1]) {
          const tap = (f === 3 && (i + (s > 0 ? 1 : 0)) % 2) || (f === 4 && (i + (s > 0 ? 0 : 1)) % 2) ? 1 : 0;
          const rx = cx + s * (1.8 + (i > 1 ? 0.8 : 0)), ry = gy - 1.6;
          const kx = rx + s * KX[i] * ext, ky = ry + KY[i] * ext - tap;
          const tx = kx + s * TX[i] * ext, ty = ky + (gy + 1.2 - ky) * ext - tap * 2;
          leg(rx, ry, kx, ky, tx, ty, back);
        }
      }
    };
    legs(true);
    if (f >= 2 && f <= 4) {   // брюшко с красной меткой, голова, глаза
      A.ellipse(cx, gy - 1.1, 4.4, 3.1, (nx, ny, fx, fy) => {
        if (Math.abs(nx) < 0.22 - Math.abs(ny + 0.35) * 0.5 + 0.12 && ny < 0.1 && ny > -0.85) return '#c81e14';   // «песочные часы»
        return ngTone(NG_CHITIN, ngLit(nx, ny) * 0.9, fx, fy);
      });
      A.ellipse(cx, gy - 3.6, 2.7, 2, (nx, ny, fx, fy) => ngTone(NG_CHITIN, ngLit(nx, ny), fx, fy));
      const blink = f === 4;
      for (const [ex, eyy, r] of [[-0.9, -4.1, 0.55], [0.9, -4.1, 0.55], [-2, -3.4, 0.32], [2, -3.4, 0.32], [-0.4, -5, 0.28], [0.4, -5, 0.28]]) {
        if (blink && r > 0.5) { A.ellipse(cx + ex, gy + eyy, r, 0.18, '#3a0c0a'); continue; }
        A.ellipse(cx + ex, gy + eyy, r, r, (nx, ny) => (nx + 0.35) ** 2 + (ny + 0.35) ** 2 < 0.12 ? '#ffd0c0' : ny > 0.3 ? '#a01810' : '#ff3a2a');
      }
    }
    legs(false);
  });
}

// ---- гнилая рука зомби: зелёная плоть, рваный рукав, раны, тёмные ногти, у одного пальца торчит кость. Кадры как у костяной руки ----
const NG_ZOMBIE_SEQ = [0, 0, 1, 1, 2, 3, 4, 3, 4, 5, 5, 2, 1, 0];   // шаг 0.38 с
const NG_FLESH = ['#1e2a14', '#33441f', '#4c6232', '#6e8a4c', '#8aa462', '#b4c88a'];
function ngZombie(set, f) {
  return ngArt('zombie_' + set + f, 19, 30, (A, W, H) => {
    const F = NG_HAND_F[f], cx = 9.5, gy = H - 2.6;
    const flesh = (t, nx, ny, fx, fy) => ngTone(NG_FLESH, 0.62 - 0.48 * nx + (ngNoise(fx >> 1, fy >> 1) - 0.5) * 0.2, fx, fy);
    const nail = (x, y, r) => A.ellipse(x, y, r, r * 0.9, (nx, ny) => ny < -0.2 ? '#5a4438' : '#2a1c18');
    if (f === 0) {
      for (const [dx, h] of [[-3, 1.4], [-1, 2.2], [1, 2.6], [3, 1.6]]) { A.seg(cx + dx, gy + 1, cx + dx, gy - h, 0.62, 0.55, flesh); nail(cx + dx, gy - h, 0.5); }
      ngMoundA(A, set, cx, gy, 6.6);
      return;
    }
    const wy = gy - F.L, hx = cx + F.tilt * 2;
    A.seg(cx, gy + 1.5, hx, wy + 0.5, 2.25, 1.95, flesh);   // предплечье
    A.ellipse(cx + (hx - cx) * 0.45 + 0.6, gy - F.L * 0.45, 0.9, 0.7, (nx, ny) => nx * nx + ny * ny < 0.35 ? '#8a2a20' : '#4a1410');   // рана
    A.seg(cx + (hx - cx) * 0.45 + 0.4, gy - F.L * 0.45 - 0.2, cx + (hx - cx) * 0.45 + 1.4, gy - F.L * 0.45 - 1, 0.25, 0.18, NG_BONE[4]);   // кость из раны
    A.ellipse(hx, wy - 1.4, 2.9, 2.1, (nx, ny, fx, fy) => ngTone(NG_FLESH, ngLit(nx, ny), fx, fy));   // ладонь
    const lens = [4.6, 6, 5.4, 3.8];
    for (let i = 0; i < 4; i++) {
      const fan = (i - 1.5) * F.sp, x0 = hx + (i - 1.5) * 1.3, y0 = wy - 2.6, L = lens[i] * (1 - 0.66 * F.curl);
      const ang = -Math.PI / 2 + fan * 0.5 + (F.curl > 0.5 ? (i < 2 ? 0.6 : -0.6) * F.curl : 0);
      const x1 = x0 + Math.cos(ang) * L, y1 = y0 + Math.sin(ang) * L;
      A.seg(x0, y0, x1, y1, 0.66, 0.52, (t, nx, ny, fx, fy) => (i === 2 && t > 0.42 && t < 0.62 && F.curl < 0.5) ? ngTone(NG_BONE, 0.7 - nx * 0.3, fx, fy) : flesh(t, nx, ny, fx, fy));
      nail(x1, y1, 0.5);
    }
    const tl = F.curl > 0.6 ? 1.6 : 3;
    A.seg(hx - 2.4, wy - 1, hx - 2.4 - tl * 0.6, wy - 1 - tl * 0.75, 0.6, 0.5, flesh); nail(hx - 2.4 - tl * 0.6, wy - 1 - tl * 0.75, 0.45);   // большой палец
    // рваный рукав у земли
    A.fill(cx - 4, gy - 4.5, cx + 4, gy + 1.5, (x, y, fx, fy) => {
      const top = gy - 3.4 + Math.sin(x * 2.6) * 0.7 + Math.sin(x * 5.3) * 0.3, hw = 3.4 + (y - top) * 0.12;
      if (y < top || Math.abs(x - cx - (hx - cx) * 0.1) > hw) return null;
      return ngTone(['#1e140c', '#2e1e14', '#4a3424', '#6a5038'], 0.6 - (x - cx) / hw * 0.4 + (Math.sin(x * 4 + y) * 0.1), fx, fy);
    });
    ngMoundA(A, set, cx, gy, 6.6);
  });
}

// ---- гроб из земли: вылезает косо; крышка отъезжает, из щели смотрят красные глаза, высовываются костлявые пальцы — и хлоп! ----
// Кадры: 0 и 1 вылезает, 2 стоит закрытый, 3 крышка дрогнула, 4 щель и глаза, 5 пальцы на краю, 6 захлопнулся (пыль)
const NG_COFFIN_SEQ = [0, 1, 2, 2, 3, 4, 4, 5, 5, 4, 6, 2, 2, 1, 0];   // шаг 0.4 с
const NG_COFFIN_OX = [0, 0, 0, 1, 3, 4, 0], NG_COFFIN_VIS = [7, 13, 18, 18, 18, 18, 18];
const NG_WOOD = ['#2a1a10', '#3a2616', '#523822', '#6a4a30', '#8a6440', '#a87c50'];
function ngCoffin(set, f) {
  return ngArt('coffin_' + set + f, 24, 26, (A, W, H) => {
    const cx = 10, gy = H - 2.6, ox = NG_COFFIN_OX[f], top = gy - NG_COFFIN_VIS[f];
    const hw = (r) => r <= 5 ? 2.2 + r * 0.6 : 5.2 - (r - 5) * 2.8 / 13;   // шестигранник: плоская голова, острые плечи, сужение к ногам
    const lean = (r) => (18 - r) * 0.07;
    // ящик: тёмное нутро, справа боковая стенка
    A.fill(cx - 7, top - 0.3, cx + 10, gy + 1, (x, y, fx, fy) => {
      const r = y - top, w = hw(r), dx = x - cx - lean(r);
      if (r < 0 || r > 18) return null;
      if (dx >= -w - 0.5 && dx <= w + 0.5) return ngTone(['#040202', '#0a0606', '#160c0a'], 0.3 + r / 30, fx, fy);
      if (dx > w + 0.5 && dx <= w + 1.9) return ngTone(NG_WOOD, 0.25 + (Math.sin(y * 3.1) * 0.08), fx, fy);
      return null;
    });
    if (ox >= 3) {   // в щели: красные глаза
      const r = 5.2, gx = cx + lean(r) - hw(r) + 1.1;
      for (const ex of [gx, gx + 1.7]) A.ellipse(ex, top + r, 0.55, 0.45, (nx, ny) => nx * nx + ny * ny < 0.3 ? (f === 5 ? '#ffd0a0' : '#ff7050') : (f === 5 ? '#ff3a2a' : '#b82018'));
    }
    // крышка, сдвинута на ox: доски с волокнами, фаска, вырезанный крест, латунные ручки
    A.fill(cx - 7, top - 0.3, cx + 14, gy + 1, (x, y, fx, fy) => {
      const r = y - top, w = hw(r), dx = x - cx - lean(r) - ox;
      if (r < 0 || r > 18 || Math.abs(dx) > w) return null;
      if (Math.abs(dx) < 0.45 && r > 2.6 && r < 10.5) return '#24160c';
      if (Math.abs(r - 5) < 0.42 && Math.abs(dx) < 2.2) return '#24160c';
      if (Math.abs(dx - 0.3) < 0.45 && r > 2.6 && r < 10.5 || Math.abs(r - 4.7) < 0.42 && Math.abs(dx - 0.3) < 2.2) return NG_WOOD[5];
      const edge = w - Math.abs(dx);
      const grain = Math.sin(x * 1.3 + Math.sin(y * 0.7) * 2.2) * 0.12 + (ngNoise(fx >> 1, fy) - 0.5) * 0.12;
      return ngTone(NG_WOOD, (edge < 0.5 ? (dx < 0 ? 0.95 : 0.15) : 0.62 - dx / w * 0.2) + grain, fx, fy);
    });
    for (const s of [-1, 1]) A.ellipse(cx + lean(7) + ox + s * (hw(7) - 0.5), top + 7, 0.45, 0.55, (nx, ny) => nx * nx + ny * ny < 0.3 ? '#f0d890' : '#a07830');
    if (f === 5) for (const rr of [8, 10, 12]) {   // костлявые пальцы на краю крышки
      const lx = cx + lean(rr) + ox - hw(rr);
      ngBoneSeg(A, lx - 1.6, top + rr, lx + 0.2, top + rr - 0.2, 0.38, 0.32, true);
      ngBoneSeg(A, lx + 0.2, top + rr - 0.2, lx + 1, top + rr + 0.4, 0.32, 0.26, false);
    }
    if (f === 6) for (const [dx, dy, r] of [[-8, -2, 0.6], [-9, -4, 0.45], [9, -3, 0.55], [10.5, -5, 0.4], [-7, -6, 0.35], [8, -1, 0.5]]) A.ellipse(cx + dx, gy + dy, r, r, ngCols(set).soil[2]);   // хлоп! — пыль
    A.erase((x, y) => y > gy + 0.4);
    ngMoundA(A, set, cx + 1, gy, 9);
  });
}

// ---- поганки с глазами: три гриба растут из земли, на ножках открываются жёлтые глаза и косятся по сторонам ----
const NG_SHROOM_SEQ = [0, 1, 2, 3, 3, 4, 3, 4, 5, 3, 2, 1, 0];   // шаг 0.42 с
const NG_SHROOM_G = [0.25, 0.6, 1, 1, 1, 1];
function ngShrooms(set, f) {
  return ngArt('shroom_' + set + f, 23, 20, (A, W, H) => {
    const gy = H - 2.4, g = NG_SHROOM_G[f];
    const CAP = ['#3a0a12', '#5a1420', '#9a2a30', '#d0504a', '#f07a6a'], STEM = ['#6c6250', '#8c8068', '#cbbfa6', '#ece2cc', '#fbf6ea'];
    const one = (x0, hFull, r) => {
      const h = Math.max(0.8, hFull * g), rr = Math.max(1, r * Math.min(1, g + 0.2)), sw = Math.max(0.6, rr * 0.36);
      A.seg(x0, gy + 0.8, x0, gy - h, sw * 1.1, sw, (t, nx, ny, fx, fy) => ngTone(STEM, 0.65 - 0.45 * nx, fx, fy));   // ножка
      if (h > 4) A.fill(x0 - sw * 1.3, gy - h * 0.72 - 0.3, x0 + sw * 1.3, gy - h * 0.72 + 0.4, (x, y, fx, fy) => ngTone(STEM, 0.3 - (x - x0) * 0.1, fx, fy));   // юбочка
      if (h > 4 && f >= 2) {   // глаз на ножке
        const ex = x0, ey = gy - h * 0.5, look = f === 4 ? 0.35 : -0.25;
        if (f === 2 || f === 5) A.seg(ex - 0.9, ey, ex + 0.9, ey, 0.16, 0.16, STEM[0]);
        else A.ellipse(ex, ey, 1.05, 0.72, (nx, ny) => Math.abs(nx - look) < 0.2 && Math.abs(ny) < 0.9 ? '#0c0c14' : (nx + 0.4) ** 2 + (ny + 0.4) ** 2 < 0.1 ? '#fffbe0' : ny > 0.35 ? '#c89a30' : '#f6d458');
      }
      const ty = gy - h;
      A.fill(x0 - rr - 0.3, ty - rr * 0.85, x0 + rr + 0.3, ty + 0.6, (x, y, fx, fy) => {   // шляпка-купол с пятнами и пластинками снизу
        const nx = (x - x0) / (rr + 0.3), ny = (y - ty) / (rr * 0.85);
        if (y > ty) return y < ty + 0.6 && Math.abs(nx) < 0.92 ? (Math.sin(x * 9) > 0.3 ? '#b8a888' : '#e6d6bc') : null;
        if (nx * nx + ny * ny > 1) return null;
        for (const [sx2, sy2, sr] of [[-0.5, -0.45, 0.2], [0.25, -0.7, 0.16], [0.6, -0.25, 0.14], [-0.1, -0.2, 0.12]]) if ((nx - sx2) ** 2 + ((ny - sy2) * 0.8) ** 2 < sr * sr) return ngTone(['#d8cbb4', '#f4ead8', '#ffffff'], 0.7 - nx * 0.4, fx, fy);
        return ngTone(CAP, ngLit(nx * 0.9, ny * 0.9 + 0.1), fx, fy);
      });
    };
    one(17, 6, 3.2); one(5.5, 9, 4); one(11.5, 12, 5);
    A.fill(0.5, gy - 0.2, 22.5, H, (x, y, fx, fy) => {   // земля
      if (y < gy + Math.sin(x * 1.3) * 0.4) return null;
      const K = ngCols(set).soil;
      return ngTone([ngMix(K[0], '#000000', 0.3), K[0], K[1], K[2]], 0.6 - (y - gy) * 0.2 + (ngNoise(fx, fy) - 0.5) * 0.4, fx, fy);
    });
  });
}

// ---- глаза в траве: шесть пород. 0 миндалевидные с вертикальным зрачком (первые), 1 один большой, 2 три глаза, 3 паучьи россыпью, 4 круглые совиные, 5 узкие щёлки.
// Кадры у всех: 0 открыты, 1 прищур, 2 закрыты ----
const NG_EYE_N = 6;
function ngEyeVar(ph) { return ph < 0.3 ? 0 : 1 + Math.min(NG_EYE_N - 2, Math.floor((ph - 0.3) / 0.7 * (NG_EYE_N - 1))); }
const NG_EYE_SZ = [[20, 10], [15, 13], [18, 12], [24, 8], [20, 12], [22, 7]];
function ngEyes(set, f, vr) {
  vr = vr | 0;
  const sz = NG_EYE_SZ[vr];
  return ngArt('eyes_' + set + f + '_' + vr, sz[0], sz[1], (A, W, H) => {
    const E0 = ngCols(set).eyes, E = vr === 5 ? [E0[1], E0[0]] : E0, pupil = '#0c0c14';
    const lid = ngMix(E[1], '#000000', 0.45);
    // миндаль: полуширина a, полувысота b, наклон sl (злой — внешний уголок выше); pup — форма зрачка
    const almond = (cx, cy, a, b, sl, pup) => {
      if (f === 2) { A.seg(cx - a, cy + sl * a * 0.3, cx + a, cy - sl * a * 0.3, 0.22, 0.22, lid); return; }
      const bb = f === 1 ? b * 0.42 : b;
      A.fill(cx - a, cy - b - 1, cx + a, cy + b + 1, (x, y, fx, fy) => {
        const nx = (x - cx) / a, yc = cy - sl * (x - cx) * 0.3, ny = (y - yc) / bb;
        if (Math.abs(nx) > 1 || Math.abs(ny) > Math.pow(1 - nx * nx, 0.7)) return null;
        if (pup === 'slit' && Math.abs(x - cx) < 0.32 + (1 - Math.abs(ny)) * 0.1) return pupil;
        if (pup === 'round' && (x - cx) ** 2 + (y - yc) ** 2 < (bb * 0.55) ** 2) return pupil;
        if ((x - cx + a * 0.35) ** 2 + (y - yc + bb * 0.4) ** 2 < 0.09) return '#ffffff';
        return ngTone([E[1], ngMix(E[1], E[0], 0.5), E[0], ngMix(E[0], '#ffffff', 0.35)], 0.85 - ny * 0.45, fx, fy);
      });
    };
    if (vr === 0) { almond(5, 3.6, 2.7, 1.4, 1, 'slit'); almond(14, 3.6, 2.7, 1.4, -1, 'slit'); }
    else if (vr === 1) {   // один большой: белок с прожилками, радужка, щель
      const cx = 7.5, cy = 6.3;
      if (f === 2) A.seg(cx - 5.5, cy, cx + 5.5, cy, 0.3, 0.3, lid);
      else {
        const b = f === 1 ? 1.5 : 3.6;
        A.fill(cx - 6, cy - b - 0.5, cx + 6, cy + b + 0.5, (x, y, fx, fy) => {
          const nx = (x - cx) / 5.8, ny = (y - cy) / b;
          if (Math.abs(nx) > 1 || Math.abs(ny) > Math.pow(1 - nx * nx, 0.65)) return null;
          const d = Math.hypot(x - cx, y - cy);
          if (d < 2.4) {
            if (Math.abs(x - cx) < 0.45 && Math.abs(y - cy) < 2.1) return pupil;
            if ((x - cx + 0.9) ** 2 + (y - cy + 0.9) ** 2 < 0.2) return '#ffffff';
            return ngTone([E[1], E[0], ngMix(E[0], '#ffffff', 0.3)], 1 - d / 2.4, fx, fy);
          }
          if (Math.abs(Math.sin(Math.atan2(y - cy, x - cx) * 6 + d)) < 0.1 && d > 3) return '#b02020';
          return ngTone(['#9a9078', '#d8d0b0', '#ece4c4'], 0.9 - Math.abs(ny) * 0.6, fx, fy);
        });
      }
    } else if (vr === 2) { almond(4, 8.2, 1.9, 1.25, 0.5, 'round'); almond(14, 8.2, 1.9, 1.25, -0.5, 'round'); almond(9, 3.6, 2.1, 1.4, 0, 'round'); }
    else if (vr === 3) {   // паучьи: россыпь бусин разного размера
      for (const [x, y, r] of [[3, 4, 0.9], [7, 2.4, 0.5], [10.5, 4, 0.95], [13.5, 3, 0.5], [17.5, 4.2, 0.85], [21, 2.5, 0.45], [5, 6, 0.4], [15.5, 6, 0.4]]) {
        if (f === 2) { if (r > 0.8) A.seg(x - r, y, x + r, y, 0.15, 0.15, lid); continue; }
        A.ellipse(x, y, r, f === 1 ? r * 0.5 : r, (nx, ny) => (nx + 0.35) ** 2 + (ny + 0.35) ** 2 < 0.1 ? '#ffffff' : ny > 0.3 ? E[1] : E[0]);
      }
    } else if (vr === 4) {   // круглые совиные, большие зрачки, перья-брови
      for (const cx of [5, 15]) {
        const cy = 6.5;
        A.seg(cx - 3, cy - 3.9, cx + 3, cy - 3.2 + (cx < 10 ? 0.8 : -0.8) * 0, 0.35, 0.35, lid);
        if (f === 2) { A.seg(cx - 2.8, cy, cx + 2.8, cy, 0.28, 0.28, lid); continue; }
        A.ellipse(cx, cy, 3, f === 1 ? 1.3 : 3, (nx, ny, fx, fy) => {
          const d = Math.hypot(nx, ny);
          if (d < 0.5) return (nx + 0.18) ** 2 + (ny + 0.22) ** 2 < 0.02 ? '#ffffff' : pupil;
          if (d > 0.86) return lid;
          return ngTone([E[1], E[0], ngMix(E[0], '#ffffff', 0.3)], 1 - d, fx, fy);
        });
      }
    } else { almond(5.5, 3, 4.5, 0.75, 1.3, 'slit'); almond(16.5, 3, 4.5, 0.75, -1.3, 'slit'); }
    for (let i = 0; i < 9; i++) {   // травинки прикрывают нижний край
      const x = (i * 2.4 + 0.8) * W / 21, h = 1.6 + (i % 3) * 0.7, lean = (i % 2 ? 0.5 : -0.4);
      A.seg(x, H, x + lean, H - h, 0.32, 0.08, i % 2 ? '#0c140c' : '#141c12');
    }
  });
}
function ngGlow(set) {
  return ngSprite('eglow_' + set, 30, 16, (c) => {
    const g = c.createRadialGradient(15, 8, 0, 15, 8, 13); const e = ngCols(set).eyes[0];
    g.addColorStop(0, e + 'aa'); g.addColorStop(1, e + '00'); c.fillStyle = g; c.fillRect(0, 0, 30, 16);
  });
}

// Твари из земли: цикл (с), раскадровка, шаг кадра (с), художник. Вне раскадровки тварь под землёй — показываются по очереди.
const NG_CREEP = {
  1: { cyc: 16, seq: NG_HAND_SEQ, step: 0.35, art: ngHand }, 5: { cyc: 18, seq: NG_SKULL_SEQ, step: 0.4, art: ngSkull },
  6: { cyc: 14, seq: NG_TENT_SEQ, step: 0.38, art: ngTentacle }, 7: { cyc: 20, seq: NG_SPIDER_SEQ, step: 0.35, art: ngSpider },
  8: { cyc: 17, seq: NG_ZOMBIE_SEQ, step: 0.38, art: ngZombie }, 9: { cyc: 19, seq: NG_COFFIN_SEQ, step: 0.4, art: ngCoffin },
  10: { cyc: 19, seq: NG_SHROOM_SEQ, step: 0.42, art: ngShrooms },
};

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
// Мир режется на квадраты; в каждом квадрате вид стоит не больше раза и только в середине квадрата, поэтому между двумя
// экземплярами одного вида не меньше 8 клеток (цветок), 10 (плита и все твари), 12 (цветок-полудница) и 4 (глаза).
// Разные виды не жмутся друг к другу: из двух ближе 4 клеток остаётся один (ngPrio).
// Вся жуть держится окраин: клетка годится, только если в 2 клетках вокруг нет построек и дорог.
// На экране 32×20 клеток выходит 3–5 цветков, 4–7 тварей разных видов и 4–7 пар глаз; твари показываются по очереди, не все разом.
const NG_SPOT = {
  1: { S: 15, m: 5, p: 0.26, salt: 41 }, 2: { S: 12, m: 4, p: 0.55, salt: 53 }, 3: { S: 14, m: 5, p: 0.3, salt: 67 }, 4: { S: 8, m: 2, p: 0.45, salt: 7 },
  5: { S: 15, m: 5, p: 0.24, salt: 79 }, 6: { S: 15, m: 5, p: 0.24, salt: 91 }, 7: { S: 15, m: 5, p: 0.24, salt: 103 },
  8: { S: 15, m: 5, p: 0.24, salt: 113 }, 9: { S: 15, m: 5, p: 0.24, salt: 127 }, 10: { S: 15, m: 5, p: 0.24, salt: 139 },
  11: { S: 18, m: 6, p: 0.28, salt: 151 },   // цветок-полудница — реже всех
};
const NG_ORDER = [2, 3, 1, 5, 6, 7, 8, 9, 10, 11, 4];   // все виды, что стоят по квадратам
function ngTileOk(tx, ty) {
  if (tx < 2 || ty < 2 || tx >= MAP_W - 2 || ty >= MAP_H - 2) return false;
  const i = ty * MAP_W + tx;
  if (World.terrain[i] !== T_GRASS || World.obj[i]) return false;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const j = i + dy * MAP_W + dx; if (World.bmap[j] || World.road[j]) return false; }
  return true;
}
// клетка вида kind в квадрате (cx, cy) или null; ok — годится ли клетка (в игре — ngTileOk)
function ngSpotRaw(kind, cx, cy, seed, ok) {
  const D = NG_SPOT[kind];
  if (gsHash(cx, cy, seed + D.salt) >= D.p) return null;
  const span = D.S - 2 * D.m + 1;
  for (let k = 0; k < 6; k++) {   // если выбранная клетка занята, пробуем другие в той же середине квадрата
    const tx = cx * D.S + D.m + Math.floor(gsHash(cx, cy, seed + D.salt + 1 + k * 2) * span), ty = cy * D.S + D.m + Math.floor(gsHash(cx, cy, seed + D.salt + 2 + k * 2) * span);
    if (!ok || ok(tx, ty)) return { tx, ty, cx, cy };
  }
  return null;
}
// с проверкой соседей других видов; в игре ответы кэшируются на 3 с (постройки меняются редко)
const NG_SPOT_C = new Map();
let ngSpotStamp = -1, ngSpotSeed = null;
function ngSpot(kind, cx, cy, seed, ok) {
  const live = ok === ngTileOk && typeof Game !== 'undefined';
  if (live) {
    const now = Game.time || 0;
    if (ngSpotSeed !== seed || now < ngSpotStamp || now - ngSpotStamp > 3) { NG_SPOT_C.clear(); ngSpotStamp = now; ngSpotSeed = seed; }
    const key = kind + ':' + cx + ':' + cy, hit = NG_SPOT_C.get(key);
    if (hit !== undefined) return hit;
    const r = ngSpotFull(kind, cx, cy, seed, ok);
    NG_SPOT_C.set(key, r);
    return r;
  }
  return ngSpotFull(kind, cx, cy, seed, ok);
}
// кто уступает при соседстве: цветок не уступает никому, глаза — всем, твари между собой — по жребию клетки
function ngPrio(kind, sp, seed) { return kind === 2 ? 3 : kind === 4 ? -1 : gsHash(sp.tx, sp.ty, seed + 211) + kind * 1e-4; }
function ngSpotFull(kind, cx, cy, seed, ok) {
  const sp = ngSpotRaw(kind, cx, cy, seed, ok);
  if (!sp) return null;
  const pr = ngPrio(kind, sp, seed);
  for (const k of NG_ORDER) {
    if (k === kind) continue;
    const S = NG_SPOT[k].S;
    for (let qy = Math.floor((sp.ty - 4) / S); qy <= Math.floor((sp.ty + 4) / S); qy++) for (let qx = Math.floor((sp.tx - 4) / S); qx <= Math.floor((sp.tx + 4) / S); qx++) {
      const o = ngSpotRaw(k, qx, qy, seed, ok);
      if (o && Math.abs(o.tx - sp.tx) < 4 && Math.abs(o.ty - sp.ty) < 4 && ngPrio(k, o, seed) > pr) return null;
    }
  }
  return sp;
}
// расцветка цветка по квадрату: соседние квадраты (включая диагонали) всегда разного цвета
function ngFlowerVar(cx, cy, seed) { return (((cx + 2 * cy + Math.floor(gsHash(0, 0, seed + 101) * 5)) % 5) + 5) % 5; }
function ngSpots(kind, x0, y0, x1, y1, seed, ok, fn) {
  const S = NG_SPOT[kind].S;
  for (let cy = Math.floor(y0 / S); cy <= Math.floor((y1 + 1) / S); cy++) for (let cx = Math.floor(x0 / S); cx <= Math.floor(x1 / S); cx++) {
    const sp = ngSpot(kind, cx, cy, seed, ok);
    if (sp && sp.tx >= x0 && sp.tx <= x1 && sp.ty >= y0 && sp.ty <= y1 + 1) fn(sp);
  }
}
function ngPose(kind, u) {   // кадр по времени цикла u (с); -1 — не видно
  const C = NG_CREEP[kind];
  if (C) { if (u >= C.seq.length * C.step) return -1; return C.seq[Math.floor(u / C.step)]; }
  if (kind === 3) { if (u < 16 || u >= 37.5) return -1; if (u < 17.5) return Math.min(5, Math.floor((u - 16) / 0.25)); if (u < 36) return 5; return Math.max(0, 5 - Math.floor((u - 36) / 0.25)); }
  return 0;
}
// Цветок живёт по жертве: гном или зверь ближе NG_FL_REACH клеток — приоткрыл пасть, распахнул, хлопнул, пожевал и отдыхает.
// Это состояние только для глаз (не сохраняется): рядом никого — просто покачивается. Испуг гнома — в nightGroundTick.
const NG_FL_REACH = 2.6, NG_FL_REST = 4;
const NG_FL = new Map();
function ngPreyNear(fx, fy) {
  let best = null, bd = NG_FL_REACH * NG_FL_REACH;
  const scan = (list) => { if (!list) return; for (let i = 0; i < list.length; i++) { const u = list[i]; if (!u || u.dead || u.inside || u.removed || u.x == null) continue; const d = (u.x - fx) * (u.x - fx) + (u.y - fy) * (u.y - fy); if (d < bd) { bd = d; best = u; } } };
  scan(Game.units); scan(Game.animals);
  return best;
}
function ngFlowerPose(st, t, fx, fy, ph) {   // -> кадр, face (1 вправо, -1 влево)
  const age = t - st.t0;
  if (age >= 0 && age < 3.7) {
    if (age < 0.14) return 2; if (age < 0.3) return 3; if (age < 0.88) return 4; if (age < 1.03) return 5;
    return (Math.floor((age - 1.03) / 0.28) & 1) ? 7 : 6;
  }
  if (t >= st.next && t >= st.t0 + 3.7 + NG_FL_REST) {
    st.next = t + 0.3;
    const p = ngPreyNear(fx, fy);
    if (p) { st.t0 = t; st.face = p.x < fx ? -1 : 1; return 2; }
  }
  return (Math.floor(t * 0.7 + ph * 7) & 1);
}
// одна клетка: картинка и положение (px, py — низ спрайта)
function ngDrawTile(c, kind, set, tx, ty, seed, t, al, glowPass, v) {
  const ph = gsHash(tx, ty, seed + 11), { px, py } = ngPlaceXY(tx, ty, seed);
  if (kind === 2 || kind === 11) {
    if (glowPass) return;
    const key = kind * 1e7 + ty * MAP_W + tx;
    let st = NG_FL.get(key); if (!st) { st = { t0: -99, next: 0, face: ph < 0.5 ? 1 : -1 }; NG_FL.set(key, st); }
    const f = ngFlowerPose(st, t, px / TILE, py / TILE, ph), s = (kind === 11 ? ngNoonFlower : ngFlower)(v | 0, f);
    c.globalAlpha = al;
    const sw = s.width / NG_Q, sh = s.height / NG_Q;
    if (st.face < 0) { c.save(); c.translate(Math.round(px), 0); c.scale(-1, 1); c.drawImage(s, -sw / 2, Math.round(py - sh + 2), sw, sh); c.restore(); }
    else c.drawImage(s, Math.round(px - sw / 2), Math.round(py - sh + 2), sw, sh);
    c.globalAlpha = 1;
  } else if (kind === 3 || NG_CREEP[kind]) {
    if (glowPass) return;
    const C = NG_CREEP[kind], cyc = C ? C.cyc : NG_CYC.tomb, f = ngPose(kind, (t + ph * cyc) % cyc);
    if (f < 0) return;
    const s = C ? C.art(set, f) : ngTomb(set, f);
    const sw = s.width / NG_Q, sh = s.height / NG_Q;
    c.globalAlpha = al; c.drawImage(s, Math.round(px - sw / 2), Math.round(py - sh + 2), sw, sh); c.globalAlpha = 1;
  } else if (kind === 4 && glowPass) {
    const u = (t + ph * NG_CYC.eyes) % NG_CYC.eyes;
    if (u > 7.5) return;
    const k = Math.floor(u * 4), fade = Math.min(1, u * 2, (7.5 - u) * 2);
    const f = (k % 13 === 5) ? 2 : (k % 13 === 4 || k % 13 === 6) ? 1 : 0;
    const s = ngEyes(set, f, ngEyeVar(gsHash(tx, ty, seed + 19))), dx = Math.round(Math.sin(u * 0.8 + ph * 6) * 1);
    const sw = s.width / NG_Q, sh = s.height / NG_Q, x = Math.round(px - sw / 2), y = Math.round(py - sh + 1);
    c.globalAlpha = al * fade; c.drawImage(s, x, y, sw, sh);
    if (f === 0) { c.globalAlpha = al * fade * 0.5; c.globalCompositeOperation = 'lighter'; c.drawImage(ngGlow(set), x + Math.round(sw / 2) - 15 + dx, y + Math.round(sh / 2) - 8); c.globalCompositeOperation = 'source-over'; }
    c.globalAlpha = 1;
  }
}
// где на клетке стоит экземпляр (px, py — низ спрайта в пикселях мира)
function ngPlaceXY(tx, ty, seed) { return { px: tx * TILE + 6 + gsHash(tx, ty, seed + 13) * 20, py: ty * TILE + 12 + gsHash(tx, ty, seed + 17) * 16 }; }

// ---- укус цветка (симуляция: одиночная игра и сервер коопа; клиент коопа step не крутит, анимацию видит сам) ----
// Урона нет. Гном ночью подошёл к цветку ближе NG_BITE клетки — цветок цапает, гном вскрикивает и бежит
// к своему зданию, а если его нет — к ближайшему костру. Цапнутый гном NG_BITE_CD секунд к цветам не пугается.
const NG_BITE = 1.4, NG_BITE_CD = 90, NG_BITE_SAY = ['Ай! Кусается!', 'Цветок цапнул!', 'Мамочки!', 'Он живой!'];
let ngTickT = 0;
function nightGroundTick(dt) {
  ngTickT += dt;
  if (ngTickT < 0.5) return;
  ngTickT = 0;
  if (nightAmt() < 0.55) return;
  const seed = Game.seed | 0;
  for (const u of Game.units) {
    if (u.dead || u.inside || !isPerson(u) || u.type === 'carter' || (u.ngBiteCD || 0) > Game.time || !interruptible(u)) continue;
    let bit = null;
    for (const k of [2, 11]) {   // плотоядный цветок и цветок-полудница
      const S = NG_SPOT[k].S;
      for (let cy = Math.floor((u.y - 2) / S); cy <= Math.floor((u.y + 2) / S) && !bit; cy++) for (let cx = Math.floor((u.x - 2) / S); cx <= Math.floor((u.x + 2) / S) && !bit; cx++) {
        const sp = ngSpot(k, cx, cy, seed, ngTileOk);
        if (!sp) continue;
        const p = ngPlaceXY(sp.tx, sp.ty, seed), fx = p.px / TILE, fy = p.py / TILE;
        if (Math.hypot(u.x - fx, u.y - fy) < NG_BITE) bit = { x: fx, y: fy };
      }
    }
    if (bit) ngBite(u, bit.x, bit.y);
  }
}
function ngBite(u, fx, fy) {
  u.ngBiteCD = Game.time + NG_BITE_CD;
  floater(u.x, u.y - 1.3, NG_BITE_SAY[(u.id | 0) % NG_BITE_SAY.length], '#ffc0d0');
  if (u.brk) endBreak(u);
  startBreak(u, 'flee', null);
  u.proc = ngFleeGen(u, fx, fy);
}
function* ngFleeGen(u, fx, fy) {
  u.fleeUntil = Game.time + 8;
  u.gest = 'wave'; u.gestUntil = Game.time + 3; u.gestFace = u.x > fx ? -1 : 1;
  yield { wait: 0.4, anim: 'duck' };   // отпрянул
  let b = u.home && !u.home.removed && u.home.doorX != null ? u.home : null;
  if (!b) {
    let bd = Infinity;
    for (const o of Game.buildings) if (o.type === 'bonfire' && !o.removed) { const d = Math.hypot(o.doorX - u.x, o.doorY - u.y); if (d < bd) { bd = d; b = o; } }
  }
  const walkOk = (x, y) => isWalkable(x, y) && !World.door[idx(x, y)];
  const s = b && Math.hypot(b.doorX - u.x, b.doorY - u.y) < 60 ? randomFreeNear(b.doorX, b.doorY + 1, 0, 2, walkOk) : null;
  if (s) yield { walk: s, offroad: true };
  else {   // бежать некуда — просто подальше от цветка
    const dx = u.x - fx, dy = u.y - fy, d = Math.hypot(dx, dy) || 1;
    const t = randomFreeNear(Math.round(u.x + dx / d * 6), Math.round(u.y + dy / d * 6), 0, 2, walkOk);
    if (t) yield { walk: t, offroad: true };
  }
  u.fleeUntil = 0;
  yield { wait: 1, anim: 'duck' };     // отдышаться
}
function ngSetNow() { return (typeof MapOpt !== 'undefined' && MapOpt.biome) || 'meadow'; }
function ngAlpha() { const a = nightAmt(); return a < 0.55 ? 0 : Math.min(1, (a - 0.55) * 4); }

// Первый проход (до объектов): плиты, твари, цветы
function nightGroundDraw(c, x0, y0, x1, y1) {
  const al = ngAlpha();
  if (!al) return;
  const set = ngSetNow(), seed = Game.seed | 0, t = Game.time;
  for (const k of [3, 1, 5, 6, 7, 8, 9, 10, 11, 2]) ngSpots(k, x0, y0, x1, y1, seed, ngTileOk, (sp) => ngDrawTile(c, k, set, sp.tx, sp.ty, seed, t, al, false, k === 2 || k === 11 ? ngFlowerVar(sp.cx, sp.cy, seed) : 0));
}
// Второй проход (после затемнения): глаза и туман
const NG_FOG_CH = 6;
function nightGroundGlow(c, x0, y0, x1, y1) {
  const al = ngAlpha();
  if (!al || (typeof Fps !== 'undefined' && Fps.eco)) return;
  const set = ngSetNow(), seed = Game.seed | 0, t = Game.time;
  ngSpots(4, x0, y0, x1, y1, seed, ngTileOk, (sp) => ngDrawTile(c, 4, set, sp.tx, sp.ty, seed, t, al, true));
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
