'use strict';
// Сказочные существа (первая партия). Звуков нет — только всплывающие надписи.
//  • ДОМОВОЙ живёт за печкой пекарни и мельницы. Вечером пекарь/мельник ставит блюдце молока (иногда «забывает»).
//    Накормленный ночью чинит здание и сам печёт/мелет; обиженный прячет инструмент (здание встаёт до починки) и роняет груз.
//    Виден редко: ночью из темноты светятся глаза, а раз в несколько минут мелькает силуэт.
//  • ЕДИНОРОГ выходит на берег у родника ясным вечером, лечит раненых поблизости, пугается тех, кто подошёл слишком близко.
//  • ДРАКОНЧИК живёт в горах, днём прилетает за золотом (кучки и склад), иногда поджигает поле. Герой может его приручить.
//  • ГРИФОН патрулирует горы и охраняет сокровище. Нейтрал: жителей только пугает, но герой и рекруты могут вызвать его на бой.
//  • САЛАМАНДРА селится у плавильни и оружейной; когда там топят, горит ярче и работа идёт на ~10% быстрее.
//  • ЗОЛОТАЯ РЫБКА изредка плещется у берега: поймавший герой получает выкуп золотом.
//  • ЗОЛОТОЙ ГУСЬ изредка ходит со стаей и раз в сутки несёт золотое яйцо, если стаю не обижать.
// Итоги идут в Game.faunaStat (fstat), состояние — в сохранение (поле fy). Спрайты собираются в коде из прямоугольников.

Game.fairy = null;

const FY_SEE = (x, y, x0, y0, x1, y1) => x >= x0 - 2 && x <= x1 + 2 && y >= y0 - 3 && y <= y1 + 3;
const fyDay = () => cycleAt(Game.time).k;
const fyHero = () => Game.units.find(u => u.type === 'hero' && !u.dead && !u.inside);
const fyR = (a, b) => a + Math.random() * (b - a);
const fyIsWater = (x, y) => inb(x, y) && World.terrain[idx(x, y)] === T_WATER;
const fyIsRock = (x, y) => inb(x, y) && World.terrain[idx(x, y)] === T_ROCK;
const fyFree = (x, y) => inb(x, y) && isWalkable(x, y) && !World.bmap[idx(x, y)] && !World.road[idx(x, y)];

function fyState() {
  if (!Game.fairy) Game.fairy = { bw: [], chk: new Set(), sal: [], salChk: new Set(), uni: null, uniDay: -1, uniRoll: -1, dr: null, gr: null, fish: null, end: null, gg: null, ggDay: -1, ggEgg: -1, t: 0, nests: false };
  return Game.fairy;
}
function fyBuilding(id) { return Game.buildings.find(b => b.id === id && !b.removed && b.state === 'done'); }

// шаг к цели; возвращает остаток расстояния
function fyMove(o, tx, ty, spd, dt) {
  const dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy);
  if (d < 0.001) return 0;
  const s = Math.min(d, spd * dt);
  o.x += dx / d * s; o.y += dy / d * s;
  if (Math.abs(dx) > 0.02) o.face = dx > 0 ? 1 : -1;
  return d - s;
}

// ---------- Спрайты ----------
const fyCache = new Map();
function fySpr(key, w, h, draw) {
  let cv = fyCache.get(key);
  if (cv) return cv;
  cv = mkCanvas(w, h);
  draw(cv.getContext('2d'));
  fyCache.set(key, cv);
  return cv;
}
// рисует спрайт с низом по центру в точке (px, py); flip — зеркально
function fyBlit(c, spr, px, py, face = 1, alpha = 1, scale = 1) {
  c.save();
  // при дробном масштабе «ближайший сосед» выкидывает строки и столбцы — чёрный контур рвётся в пунктир; тут сглаживаем
  c.imageSmoothingEnabled = scale !== 1;
  if (scale !== 1) c.imageSmoothingQuality = 'high';
  c.globalAlpha = alpha;
  c.translate(Math.round(px), Math.round(py));
  if (face < 0) c.scale(-1, 1);
  if (scale !== 1) c.scale(scale, scale);
  c.drawImage(spr, -Math.round(spr.width / 2), -spr.height);
  c.restore();
  c.imageSmoothingEnabled = R.smooth;
}
function fyShadow(c, px, py, rx, a = 0.3) {
  c.fillStyle = `rgba(10,8,4,${a})`; c.beginPath(); c.ellipse(px, py, rx, rx * 0.3, 0, 0, 7); c.fill();
}

// ---------- Растеризатор: эллипсы, толстые линии, многоугольники, обводка ----------
function fyE(c, cx, cy, rx, ry, col) {
  c.fillStyle = col;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
    if (dx * dx + dy * dy <= 1) c.fillRect(x, y, 1, 1);
  }
}
function fyL(c, x0, y0, x1, y1, w0, w1, col) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
  for (let i = 0; i <= n; i++) { const t = i / n, r = Math.max(0.5, (w0 + (w1 - w0) * t) / 2); fyE(c, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, r, col); }
}
function fyP(c, pts, col) {
  c.fillStyle = col;
  const ys = pts.map(p => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    const yy = y + 0.5, xs = [];
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if ((a[1] <= yy && b[1] > yy) || (b[1] <= yy && a[1] > yy)) xs.push(a[0] + (yy - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) c.fillRect(x, y, 1, 1);
  }
}
const fyD = (c, x, y, col) => { c.fillStyle = col; c.fillRect(Math.floor(x), Math.floor(y), 1, 1); };
// объём: тёмная форма, поверх чуть сдвинутая средняя и светлая
function fyE3(c, cx, cy, rx, ry, [d, m, l]) { fyE(c, cx, cy, rx, ry, d); fyE(c, cx - 0.5, cy - 0.6, rx - 0.7, ry - 0.8, m); if (l) fyE(c, cx - rx * 0.25, cy - ry * 0.4, rx * 0.5, ry * 0.4, l); }
function fyOutline(c, w, h, col) {
  const a = c.getImageData(0, 0, w, h).data, mark = [];
  const op = (x, y) => x >= 0 && y >= 0 && x < w && y < h && a[(y * w + x) * 4 + 3] > 100;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!op(x, y) && (op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1))) mark.push([x, y]);
  // getImageData читает без трансформации, а у спрайтов стоит c.translate(0, 7): без сброса контур съезжал вниз и рвался в пунктир
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = col;
  for (const [x, y] of mark) c.fillRect(x, y, 1, 1);
  c.restore();
}

// Кадры фей-зверей: fr 0/1 — опорные позы (как раньше), 10..17 — 8 кадров цикла, 20..25 — 6 кадров;
// промежуточные позы тянутся между опорными по косинусу (fyMix), кэш по номеру кадра
function fyK(fr) {
  if (fr < 2) return fr;
  const N = fr >= 20 ? 6 : 8, i = fr - (fr >= 20 ? 20 : 10);
  return (1 - Math.cos(i / N * Math.PI * 2)) / 2;
}
function fyMix(a, b, k) {
  if (typeof a === 'number') return a + (b - a) * k;
  if (Array.isArray(a)) return a.map((v, n) => fyMix(v, b[n], k));
  const o = {}; for (const n in a) o[n] = fyMix(a[n], b[n], k); return o;
}
const fyCyc8 = t => 10 + (Math.floor(t) & 7), fyCyc6 = t => 20 + (Math.floor(t) % 6);

function sprUnicorn(fr) {
  return fySpr('uni2' + fr, 48, 44, c => {
    c.translate(0, 7);
    const B = ['#b8aecc', '#f2eef8', '#ffffff'], F = ['#8e84a8', '#c8c0da'], P = '#e878b8', Pd = '#b04a8c', Pl = '#ffb0dc';
    const leg = (a, b, d, col, hoof) => {
      fyL(c, a[0], a[1], b[0], b[1], 4.6, 3.4, col[0]); fyL(c, b[0], b[1], d[0], d[1], 3.2, 2.4, col[0]);
      fyL(c, a[0] - 0.4, a[1], b[0] - 0.4, b[1], 3.4, 2.4, col[1]); fyL(c, b[0] - 0.4, b[1], d[0] - 0.4, d[1], 2.2, 1.6, col[1]);
      fyE(c, b[0], b[1], 1.7, 1.7, col[1]);
      fyL(c, d[0], d[1], d[0] + 0.3, d[1] + 1.6, 3, 3, hoof);
    };
    const L = fyMix({ fn: [[27, 23], [28, 29], [28, 34]], ff: [[23, 23], [22, 29], [20, 33]], hn: [[10, 24], [8, 29], [9, 34]], hf: [[14, 24], [16, 29], [17, 34]] }, { fn: [[27, 23], [31, 27], [30, 31]], ff: [[23, 23], [24, 29], [24, 34]], hn: [[10, 24], [7, 28], [5, 32]], hf: [[14, 24], [14, 29], [14, 34]] }
      , fyK(fr));   // кадр шага: позы ног тянутся одна в другую
    leg(...L.ff, F, '#5a4a6a'); leg(...L.hf, F, '#5a4a6a');
    // хвост
    fyL(c, 6, 15, 2, 19, 4.4, 3.4, Pd); fyL(c, 2, 19, 0, 26, 3.4, 3, Pd); fyL(c, 0, 26, 3, 32, 3, 1.2, Pd);
    fyL(c, 5.6, 15, 1.6, 19, 3, 2.4, P); fyL(c, 1.6, 19, -0.3, 26, 2.4, 2, P); fyL(c, -0.3, 26, 2.5, 31, 2, 0.8, Pl);
    // тело
    fyE(c, 18, 19.2, 12, 6.8, B[0]); fyE(c, 10, 20.2, 6.6, 6.6, B[0]); fyE(c, 26, 19.2, 6, 7.8, B[0]);
    fyE(c, 18, 18.4, 12, 6.2, B[1]); fyE(c, 10, 19.4, 6.2, 6, B[1]); fyE(c, 26, 18.4, 5.6, 7.2, B[1]);
    fyE(c, 18, 14.6, 8, 1.8, B[2]); fyE(c, 9, 15.5, 3, 2, B[2]);
    fyL(c, 12, 20, 14, 24, 1, 1, B[0]);
    leg(...L.hn, B, '#5a4a6a'); leg(...L.fn, B, '#5a4a6a');
    // шея и голова
    fyL(c, 25, 15, 32, 6, 9, 5.6, B[0]); fyL(c, 24.6, 14.6, 31.6, 5.6, 7.6, 4.4, B[1]);
    fyE(c, 35, 6.8, 4.8, 3.8, B[0]); fyE(c, 34.6, 6.4, 4.2, 3.3, B[1]);
    fyE(c, 39.5, 9.2, 3.4, 2.7, B[0]); fyE(c, 39.2, 8.9, 3, 2.3, '#f8e6f0'); fyE(c, 37, 10.3, 3, 1.5, '#e6d4e4');
    fyD(c, 41.5, 8.5, '#8a5a7a'); fyD(c, 41.5, 9.5, '#c88ab0'); fyL(c, 38, 11.6, 41, 11.6, 1, 1, '#a07090');
    fyE(c, 36.4, 5.6, 1.5, 1.7, '#3a1e60'); fyD(c, 36.1, 5.0, '#ffffff'); fyD(c, 37, 6.4, '#9a6ad8');
    fyL(c, 35, 3.3, 38, 4, 1, 1, '#c8b0d8');
    fyP(c, [[32.5, 3.5], [33, -1.2], [36, 3]], B[1]); fyP(c, [[33.4, 2.8], [33.5, 0.4], [35, 2.8]], '#f0a8cc');
    // грива и чёлка
    fyL(c, 31, 2.4, 29, 9, 3.4, 2.6, Pd); fyL(c, 28.6, 5, 24, 14, 3.8, 3, Pd); fyL(c, 26, 9, 21, 16, 3.4, 2, Pd);
    fyL(c, 30.6, 2, 28.6, 8.6, 2.2, 1.6, P); fyL(c, 28, 4.6, 23.6, 13.6, 2.6, 1.8, P); fyL(c, 25.6, 8.6, 20.6, 15.6, 2.2, 1.2, Pl);
    fyL(c, 34.5, 2.4, 36.4, 6.2, 2.6, 1.2, P);
    // рог: золотая спираль
    fyL(c, 37, 2.6, 44, -5, 2.8, 0.7, '#b8902c'); fyL(c, 36.8, 2.2, 43.4, -4.6, 1.8, 0.6, '#f4d460');
    for (const [x, y] of [[38.6, 0.6], [40.2, -1.2], [41.8, -3]]) fyD(c, x, y, '#a07818');
    fyOutline(c, 48, 44, '#3a2a54');
  });
}

function sprDragon(fr) {
  return fySpr('dra2' + fr, 48, 42, c => {
    c.translate(0, 9);
    const G = ['#1f5a2c', '#4ca04a', '#8ad06a'], WM = '#2f8a58', WD = '#1c5a38', BN = '#164a28', CR = '#e8dcb8', BL = '#e2e69c', BD = '#b4c068';
    const wing = (dx, mem, bone) => {
      const S = [14 + dx, 10], T = fyMix([[3, 0], [9, -6], [17, -6]], [[2, 15], [7, 22], [14, 24]], fyK(fr));
      const T2 = T.map(([x, y]) => [x + dx, y]);
      const mid = [0, 1].map(i => [(T2[i][0] + T2[i + 1][0]) / 2 + (S[0] - (T2[i][0] + T2[i + 1][0]) / 2) * 0.28, (T2[i][1] + T2[i + 1][1]) / 2 + (S[1] - (T2[i][1] + T2[i + 1][1]) / 2) * 0.28]);
      fyP(c, [S, T2[0], mid[0], T2[1], mid[1], T2[2], [17 + dx, 9]], mem);
      for (const t of T2) fyL(c, S[0], S[1], t[0], t[1], 1.8, 1, bone);
    };
    wing(-3, WD, BN);
    // хвост
    fyL(c, 9, 16, 4, 20, 6, 4.4, G[0]); fyL(c, 4, 20, 2, 25, 4.4, 3, G[0]); fyL(c, 2, 25, 6, 29, 3, 1.4, G[0]);
    fyL(c, 8.6, 15.4, 3.6, 19.4, 4.6, 3.2, G[1]); fyL(c, 3.6, 19.4, 1.6, 24.4, 3.2, 2, G[1]); fyL(c, 1.6, 24.4, 5.6, 28.4, 2, 0.8, G[1]);
    fyP(c, [[5, 28], [9, 27.5], [9.5, 31], [6, 30.5]], G[2]);
    // задняя лапа
    fyL(c, 12, 21, 9, 26, 4.4, 3, G[0]); fyL(c, 11.6, 21, 8.6, 26, 3, 2, G[1]); fyE(c, 9, 27, 3, 1.4, G[0]); for (const x of [6.8, 8.6, 10.4]) fyD(c, x, 28, CR);
    // туловище
    fyE(c, 16, 17.4, 9, 6.4, G[0]); fyE(c, 15.6, 16.6, 8.4, 5.8, G[1]); fyE(c, 14, 14, 5, 1.6, G[2]);
    fyE(c, 17, 20.4, 6.6, 3.6, BD); fyE(c, 16.6, 20, 6.1, 3.1, BL);
    for (const x of [13, 15.5, 18, 20.5]) fyL(c, x, 17.6, x - 0.6, 22.6, 1, 1, BD);
    // шипы по хребту
    for (let i = 0; i < 6; i++) { const x = 9.5 + i * 2.5, y = 12.2 - Math.sin(i / 5 * Math.PI) * 0.6; fyP(c, [[x - 1.2, y + 1], [x, y - 3], [x + 1.2, y + 1]], G[2]); }
    // передняя лапа
    fyL(c, 20, 21, 22, 26, 4, 2.8, G[0]); fyL(c, 19.6, 21, 21.6, 26, 2.8, 1.8, G[1]); fyE(c, 22.6, 27, 3, 1.4, G[0]); for (const x of [20.6, 22.4, 24.2]) fyD(c, x, 28, CR);
    // шея и голова
    fyL(c, 21, 14, 27, 7, 6.8, 4.8, G[0]); fyL(c, 20.6, 13.6, 26.6, 6.6, 5.2, 3.6, G[1]); fyL(c, 21.5, 16, 26.5, 9.5, 2.6, 2.2, BL);
    fyE(c, 30, 6.2, 4.6, 3.8, G[0]); fyE(c, 29.6, 5.8, 4.1, 3.3, G[1]);
    fyE(c, 34.6, 7.6, 3.4, 2.4, G[0]); fyE(c, 34.2, 7.2, 3, 2, G[1]);
    fyE(c, 34, 9.8, 3.1, 1.2, G[0]); fyE(c, 33.6, 9.6, 2.7, 0.8, BL);
    for (const x of [33, 35.4]) fyD(c, x, 10.8, '#ffffff');
    fyD(c, 37.2, 6.6, '#14301a'); fyD(c, 37.2, 7.6, '#14301a');
    fyE(c, 30.4, 5.2, 1.9, 1.7, '#ffe04a'); fyD(c, 30.6, 4.6, '#14100a'); fyD(c, 30.6, 5.6, '#14100a'); fyL(c, 28.5, 3.2, 32.5, 4.3, 1.2, 1.2, G[0]);
    fyL(c, 27.5, 3.2, 23.5, -1, 2.8, 0.7, CR); fyL(c, 30.4, 2.6, 28, -2.4, 2.4, 0.7, CR);
    fyP(c, [[26.5, 7], [24, 8.5], [26.5, 9.5]], G[2]);
    wing(0, WM, BN);
    fyOutline(c, 48, 42, '#0f2a16');
  });
}

function sprGriffin(fr) {
  return fySpr('gri2' + fr, 62, 54, c => {
    c.translate(0, 7);
    const T = ['#9a6422', '#c8903e', '#eebb6a'], WH = ['#cfc2a0', '#f6f0e2', '#ffffff'], WB = ['#4e3018', '#7a4e26', '#a8743c'], YE = ['#b07a10', '#f0b830'], TL = '#e8c030', DK = '#3e2a14';
    const wing = (dx, dark) => {
      const sx = 22 + dx, sy = 19;
      const tips = fyMix([[2, 0], [6, -6], [12, -10], [19, -11], [26, -9]], [[0, 14], [2, 8], [6, 3], [12, 0], [19, -1]], fyK(fr));
      tips.forEach(([x, y]) => { fyL(c, sx - 3, sy - 1, x + dx, y, 4.6, 1.2, dark ? WB[0] : WB[1]); fyL(c, sx - 3, sy - 1.5, x + dx + 0.4, y, 2.4, 0.8, dark ? WB[1] : WB[2]); });
      fyE(c, sx - 3, sy - 1.5, 5.6, 3.6, dark ? WB[0] : WB[1]); fyE(c, sx - 3.4, sy - 2, 4.4, 2.6, dark ? WB[1] : WB[2]);
    };
    wing(-3, true);
    // хвост и дальняя задняя лапа
    fyL(c, 8, 26, 3, 31, 4, 3, T[0]); fyL(c, 3, 31, 4, 39, 3, 2.4, T[0]); fyE(c, 4, 41, 3.2, 3.4, DK); fyE(c, 3.6, 40.4, 2.4, 2.6, '#6a4420');
    fyL(c, 14, 31, 13, 38, 4, 3, T[0]); fyE(c, 14, 43, 3.6, 1.6, T[0]);
    // тело льва
    fyE(c, 20, 29.4, 11.5, 6.8, T[0]); fyE(c, 11, 30.4, 6.6, 6.6, T[0]); fyE(c, 28, 28.4, 6, 6.8, T[0]);
    fyE(c, 20, 28.6, 11, 6.2, T[1]); fyE(c, 11, 29.4, 6.2, 6.1, T[1]); fyE(c, 28, 27.6, 5.6, 6.2, T[1]);
    fyE(c, 19, 24.6, 8, 1.8, T[2]);
    // ближняя задняя лапа
    fyL(c, 10, 32, 8, 38, 5, 3.4, T[0]); fyL(c, 9.6, 32, 7.6, 38, 3.6, 2.4, T[1]); fyE(c, 9, 43, 4, 1.8, T[0]); fyE(c, 8.6, 42.6, 3.4, 1.4, T[1]);
    for (const x of [6.4, 8.6, 10.8]) fyD(c, x, 44, DK);
    // орлиная грудь, шея, голова
    fyL(c, 29, 24, 35, 15, 10, 8, WH[0]); fyL(c, 28.6, 23.6, 34.6, 14.6, 8.4, 6.4, WH[1]);
    for (const [x, y] of [[28, 26], [30.5, 25], [27, 22], [30, 21.5], [32.4, 18.6], [29.6, 18]]) fyL(c, x, y, x + 0.4, y + 2, 1, 1, WH[0]);
    fyE(c, 38, 12.4, 5.2, 4.8, WH[0]); fyE(c, 37.6, 12, 4.7, 4.3, WH[1]); fyE(c, 36.4, 10.2, 2.6, 1.4, WH[2]);
    fyP(c, [[41, 9], [49, 12], [49.6, 16], [47, 14.6], [44, 16.6], [42, 14.5], [41, 13]], YE[1]); fyP(c, [[41.6, 14], [46, 15.6], [43.4, 17], [41.4, 16]], YE[0]);
    fyD(c, 47.6, 13.4, '#6a4408'); fyD(c, 43.6, 11.4, '#6a4408');
    fyE(c, 39.4, 11.2, 1.7, 1.7, '#f08a1a'); fyD(c, 39.6, 11.2, '#14100a'); fyD(c, 39, 10.4, '#ffffff'); fyL(c, 37, 8.4, 41.6, 9.6, 1.3, 1.3, WB[1]);
    fyL(c, 34, 8.6, 31.6, 2.4, 3.2, 1, WH[1]); fyL(c, 36.6, 7.8, 36, 1.6, 2.8, 0.8, WH[0]);
    // передние лапы: орлиные
    fyL(c, 29, 31, 28, 38, 4, 2.8, YE[0]); fyL(c, 29, 30, 30.6, 38.4, 3.2, 2.6, YE[1]); fyE(c, 28.4, 31, 4, 3.4, WH[1]);
    for (const [x, y] of [[35.4, 40.4], [33.4, 42.4], [29, 41.6]]) { fyL(c, 31, 39, x, y, 2, 1.3, TL); fyD(c, x, y, DK); }
    wing(0, false);
    fyOutline(c, 62, 54, '#2a1a0a');
  });
}

const FISH_COL = {
  gold: { b: ['#c8902a', '#f4c840', '#fff0a0'], f: ['#e8782a', '#ffb04a'], e: '#fff6c0', o: '#6a4408' },
  red:  { b: ['#a02418', '#e0402e', '#ff9a7a'], f: ['#c02a1c', '#ff6a4a'], e: '#ffe0d0', o: '#5a1008' },
  blue: { b: ['#1e55a8', '#3a86e0', '#9ad4ff'], f: ['#2a6ac8', '#6ab4ff'], e: '#e0f4ff', o: '#0e2a5a' },
};
function sprFish(kind, fr) {
  return fySpr('fish2' + kind + fr, 28, 16, c => {
    const K = FISH_COL[kind] || FISH_COL.gold;
    c.translate(0, 1);
    const sw = fyMix(-1.8, 1.8, fyK(fr));
    fyP(c, [[9, 7], [1, 3 + sw], [2.4, 7], [1, 11 - sw]], K.f[0]); fyP(c, [[9, 7], [2.6, 4 + sw], [3.6, 7], [2.6, 10 - sw]], K.f[1]);
    fyP(c, [[11, 3.6], [14, -0.6], [19, 0.4], [20, 4]], K.f[0]); fyP(c, [[12, 3.6], [14.4, 0.6], [18, 1.2], [18.6, 4]], K.f[1]);
    fyP(c, [[13, 11], [15, 14.6], [18, 11.6]], K.f[0]);
    fyE(c, 15, 7.6, 9, 5, K.b[0]); fyE(c, 14.6, 7.1, 8.6, 4.5, K.b[1]); fyE(c, 15, 10.4, 6.6, 1.8, K.b[2]);
    for (let y = 5; y <= 10; y += 2) for (let x = 9 + ((y >> 1) & 1) * 1.5; x < 21; x += 3) { fyD(c, x, y, K.b[0]); fyD(c, x + 0.4, y - 1, K.b[2]); }
    fyL(c, 20, 4.8, 20.6, 10.6, 1, 1, K.b[0]);
    fyP(c, [[16, 9], [13.4, 12.8], [17.6, 11]], K.f[1]);
    fyE(c, 22.6, 6.4, 1.9, 1.9, K.e); fyE(c, 22.9, 6.6, 1, 1, '#14100a'); fyD(c, 22.6, 6, '#ffffff');
    fyD(c, 25, 8.4, K.b[0]);
    fyOutline(c, 28, 16, K.o);
  });
}

function sprBabyDragon(fr) {
  return fySpr('bdra' + fr, 38, 34, c => {
    c.translate(0, 4);
    const G = ['#2a7a3a', '#5cbc58', '#a6e68a'], CR = '#f0e6c4', BL = '#f4eeb0', BD = '#cfc884';
    const wing = (dx, mem, bone) => {
      const S = [11 + dx, 16], T = fyMix([[4, 5], [9, 1], [15, 4]], [[3, 22], [7, 27], [13, 27]], fyK(fr));
      const T2 = T.map(([x, y]) => [x + dx, y]);
      fyP(c, [S, T2[0], [(T2[0][0] + T2[1][0]) / 2 + 1.5, (T2[0][1] + T2[1][1]) / 2 + fyMix(2, -1.5, fyK(fr))], T2[1], [(T2[1][0] + T2[2][0]) / 2, (T2[1][1] + T2[2][1]) / 2 + fyMix(2, -1.5, fyK(fr))], T2[2], [14 + dx, 17]], mem);
      for (const t of T2) fyL(c, S[0], S[1], t[0], t[1], 1.4, 0.8, bone);
    };
    wing(-2, '#2a7a4e', '#1c5a38');
    // хвост
    fyL(c, 9, 23, 4, 25, 5.4, 4, G[0]); fyL(c, 4, 25, 2, 29, 4, 2.6, G[0]); fyL(c, 2, 29, 6, 31, 2.6, 1.2, G[0]);
    fyL(c, 8.6, 22.6, 3.6, 24.6, 4, 2.8, G[1]); fyL(c, 3.6, 24.6, 1.6, 28.6, 2.8, 1.6, G[1]);
    fyP(c, [[5.4, 30.6], [8.6, 29.6], [8.8, 32.6]], G[2]);
    // лапки
    fyL(c, 11, 26, 10.6, 29.4, 4.2, 3.4, G[0]); fyE(c, 10.6, 30.2, 3, 1.4, G[0]); fyL(c, 19, 26, 19.6, 29.4, 4.2, 3.4, G[0]); fyE(c, 20, 30.2, 3, 1.4, G[0]);
    for (const x of [9, 10.6, 12.2, 18.4, 20, 21.6]) fyD(c, x, 31, CR);
    // круглое тело и пузо
    fyE(c, 15, 21, 8.6, 7, G[0]); fyE(c, 14.6, 20.4, 8, 6.4, G[1]); fyE(c, 12.5, 16.6, 4.5, 1.6, G[2]);
    fyE(c, 16, 23, 5.6, 4.4, BD); fyE(c, 15.6, 22.6, 5.1, 3.9, BL);
    for (const y of [21, 23.4]) fyL(c, 12.4, y, 18.8, y, 1, 1, BD);
    for (let i = 0; i < 4; i++) { const x = 9 + i * 2.6; fyP(c, [[x - 1, 14.6], [x, 11.6], [x + 1, 14.6]], G[2]); }
    // голова: большая, милая
    fyE(c, 21, 15, 4, 4.4, G[0]);
    fyE(c, 24.5, 11.6, 8, 7, G[0]); fyE(c, 24.1, 11.2, 7.5, 6.5, G[1]); fyE(c, 22, 7.6, 3.4, 1.4, G[2]);
    fyE(c, 31, 14, 4.2, 3.4, G[0]); fyE(c, 30.7, 13.6, 3.8, 3, G[1]); fyE(c, 30, 16.2, 4, 1.4, BL);
    fyD(c, 34, 12.4, '#14301a'); fyD(c, 34, 13.4, '#14301a'); fyL(c, 29, 16.6, 33.6, 16.6, 1, 1, '#1c4a26');
    fyE(c, 25.6, 10.2, 3, 3.3, '#ffffff'); fyE(c, 25.8, 10.2, 2.4, 2.8, '#ffe04a'); fyE(c, 26.4, 10.6, 1.3, 1.9, '#14100a'); fyD(c, 25.4, 9.2, '#ffffff');
    fyE(c, 22, 14.4, 1.6, 1, '#f09a8a');
    fyL(c, 21.6, 5.6, 19.4, 0.4, 3, 0.8, CR); fyL(c, 27, 4.6, 28.6, -0.4, 2.8, 0.8, CR);
    wing(1, '#3e9e66', '#1c5a38');
    fyOutline(c, 38, 34, '#10301a');
  });
}

function sprBrownie() {
  return fySpr('brw3', 30, 40, c => {
    c.translate(1, 3);
    const SK = ['#c88a64', '#eab08a', '#f8d0b0'], HR = ['#8a3a12', '#b8541c', '#e07a30'], SH = ['#4e6a98', '#7a9ac8', '#a6c0e8'], TR = ['#4a3018', '#6a4a2a'], LP = ['#8a6a38', '#c8a860'];
    // лапти с оборками
    for (const x of [10, 19]) { fyE(c, x, 36, 4.2, 2, LP[0]); fyE(c, x - 0.2, 35.6, 3.8, 1.6, LP[1]); fyL(c, x - 2.6, 34.4, x + 2.6, 34.4, 1, 1, LP[0]); for (const dx of [-2, 0, 2]) fyD(c, x + dx, 36, LP[0]); }
    // штаны
    fyL(c, 11.6, 28, 10.6, 34, 5.2, 4.4, TR[0]); fyL(c, 18.4, 28, 19.4, 34, 5.2, 4.4, TR[0]); fyL(c, 11.2, 28, 10.2, 34, 3.4, 2.8, TR[1]); fyL(c, 18, 28, 19, 34, 3.4, 2.8, TR[1]);
    // рубаха с заплаткой и пояс
    fyE3(c, 15, 24, 8.4, 7.4, SH); fyP(c, [[16, 22], [20.4, 22], [20.4, 26], [16, 26]], '#c8a050'); fyL(c, 16, 24, 20.4, 24, 1, 1, '#8a6a30'); fyL(c, 8.6, 27.4, 21.4, 27.4, 2.6, 2.6, '#b03a2a'); fyD(c, 15, 27, '#f0c040');
    // руки
    fyL(c, 8, 20, 5, 26.6, 4.2, 3.6, SH[0]); fyL(c, 7.6, 20, 4.6, 26.6, 3, 2.6, SH[1]); fyE(c, 4.6, 28, 2.1, 2, SK[1]);
    fyL(c, 22, 20, 25, 26.6, 4.2, 3.6, SH[0]); fyE(c, 25.4, 28, 2.1, 2, SK[1]);
    // голова: кожа, уши, нос
    fyE(c, 7.4, 13.6, 2, 2.6, SK[0]); fyE(c, 7.6, 13.6, 1.2, 1.8, '#e09878'); fyE(c, 22.6, 13.6, 2, 2.6, SK[0]); fyE(c, 22.4, 13.6, 1.2, 1.8, '#e09878');
    fyE3(c, 15, 13, 7.8, 7.2, SK);
    // рыжие вихры и борода
    fyE(c, 15, 7.6, 8.2, 4.6, HR[0]); fyE(c, 14.6, 7.2, 7.6, 4.1, HR[1]);
    fyL(c, 9.4, 5, 7, -0.4, 3, 0.9, HR[0]); fyL(c, 13.6, 4, 13.4, -2.4, 3.2, 0.9, HR[1]); fyL(c, 18, 5, 21, 0.2, 3, 0.9, HR[0]); fyL(c, 11.6, 4.4, 10.6, 0.6, 2, 0.6, HR[2]);
    fyL(c, 8, 9, 8.4, 13, 2.4, 1.2, HR[0]); fyL(c, 22, 9, 21.6, 13, 2.4, 1.2, HR[0]);
    fyE(c, 15, 19.4, 6.4, 3.8, HR[0]); fyE(c, 14.6, 19, 5.9, 3.3, HR[1]); for (const x of [11, 13.4, 15.8, 18.2]) fyL(c, x, 20, x - 0.2, 22.8, 1.6, 0.8, HR[2]);
    fyL(c, 11.6, 16.6, 18.4, 16.6, 2.2, 2.2, HR[1]);
    // лицо
    fyE(c, 11.8, 11.6, 1.9, 2.1, '#ffffff'); fyE(c, 18.2, 11.6, 1.9, 2.1, '#ffffff'); fyE(c, 12.2, 12, 1, 1.3, '#2a3a1a'); fyE(c, 18.6, 12, 1, 1.3, '#2a3a1a'); fyD(c, 11.8, 11.2, '#ffffff'); fyD(c, 18.2, 11.2, '#ffffff');
    fyL(c, 9.6, 9, 13.4, 9.4, 1.2, 1.2, HR[0]); fyL(c, 16.6, 9.4, 20.4, 9, 1.2, 1.2, HR[0]);
    fyE(c, 15, 14.4, 2.6, 2.3, '#d88a6c'); fyE(c, 14.8, 14, 2.3, 1.9, '#f0a888'); fyD(c, 14, 13.2, '#ffe0cc');
    fyE(c, 9.8, 15, 1.4, 1, '#f09a8a'); fyE(c, 20.2, 15, 1.4, 1, '#f09a8a');
    fyOutline(c, 30, 40, '#2a1a0e');
  });
}

function sprSalamander(fr) {
  return fySpr('sal3' + fr, 64, 34, c => {
    c.translate(0, 3);
    const K = ['#0c0a08', '#221c18', '#3c322a'], Y = ['#e89a10', '#ffd23a', '#fff08a'];
    const foot = (x, y, d) => { fyL(c, x, y, x + 1 * d, y + 3.4, 4, 3.2, K[0]); fyL(c, x - 0.4, y, x + 0.6 * d, y + 3.4, 2.6, 2, K[1]); fyE(c, x + 1.6 * d, y + 5, 3.6, 1.4, K[0]); for (const t of [-1.8, -0.6, 0.6, 1.8]) fyL(c, x + 1.6 * d + t * 1.1, y + 5.4, x + 1.6 * d + t * 1.5, y + 6.6, 1, 1, K[0]); };
    // дальние ноги
    foot(fyMix(40, 38, fyK(fr)), 20, 1); foot(fyMix(15, 17, fyK(fr)), 20, -1);
    // хвост: длинный, к кончику тлеет
    fyL(c, 14, 17, 6, 20.6, 10, 6.4, K[0]); fyL(c, 6, 20.6, 2.6, 26, 6.4, 4, K[0]); fyL(c, 2.6, 26, 8, 30, 4, 1.6, K[0]);
    fyL(c, 13.6, 16.4, 5.6, 20, 8, 5, K[1]); fyL(c, 5.6, 20, 2.2, 25.4, 5, 2.8, K[1]);
    for (const [x, y] of [[9.4, 19], [4.4, 23], [4.6, 27.4]]) fyE(c, x, y, 1.5, 1.1, Y[1]);
    fyP(c, [[6.4, 30.6], [8.4, 26], [10.4, 29.4], [12.4, 26.6], [12, 32.4], [7, 33]], '#ff7a20'); fyP(c, [[8, 32], [9.8, 28.6], [11, 32]], '#ffe060');
    // туловище: приземистое, блестящее
    fyE(c, 28, 17, 17, 6.8, K[0]); fyE(c, 27.6, 16.4, 16.4, 6.2, K[1]); fyL(c, 14, 13.4, 40, 12.6, 1.6, 1.6, K[2]);
    fyE(c, 29, 21, 13, 2.4, '#3a2e26');
    // жёлтые пятна по спине и бокам
    for (const [x, y, rx, ry] of [[15, 14, 2.4, 1.6], [20, 12.6, 3, 1.8], [26, 13, 2.2, 1.6], [31, 12.4, 3.2, 1.8], [37, 13.4, 2.4, 1.6], [18, 17.6, 1.6, 1.2], [24, 18, 2, 1.4], [30, 18.4, 1.6, 1.2], [35, 17.6, 2.2, 1.4], [12, 17, 1.4, 1]]) { fyE(c, x, y, rx, ry, Y[0]); fyE(c, x - 0.3, y - 0.3, rx - 0.6, ry - 0.5, Y[1]); }
    // голова: широкая и плоская, навыкате глаза, жёлто-оранжевые железы
    fyE(c, 47, 16.4, 9, 5.4, K[0]); fyE(c, 46.6, 16, 8.5, 4.9, K[1]); fyE(c, 54, 18, 5, 3.4, K[1]); fyL(c, 50, 20.6, 58, 20.4, 1.2, 1.2, '#6a4a32');
    fyE(c, 40.4, 12.6, 4.4, 2.4, '#ff7a20'); fyE(c, 40.2, 12.4, 3.8, 1.9, Y[1]); fyE(c, 45.5, 12.6, 3, 1.6, Y[0]);
    fyE(c, 47, 11.4, 3, 3, K[0]); fyE(c, 47, 11.2, 2.6, 2.6, '#ffc020'); fyE(c, 47.4, 11.4, 1.2, 2, '#0a0806'); fyD(c, 46.4, 10.2, '#ffffff');
    fyD(c, 58, 16.4, '#4a3a2e'); fyD(c, 58, 17.4, '#4a3a2e');
    for (const x of [48, 50.6, 53.2]) fyD(c, x, 12.2, Y[0]);
    // ближние ноги
    foot(fyMix(36, 34, fyK(fr)), 21, 1); foot(fyMix(19, 21, fyK(fr)), 21, -1);
    fyOutline(c, 64, 34, '#3a1408');
  });
}

const FISHN_COL = {
  amber: { b: ['#a8501a', '#e8842a', '#ffd49a'], f: ['#c0622a', '#ffa860'], e: '#fff0d0', o: '#4a2008' },
  pink:  { b: ['#982a62', '#e0589a', '#ffb4da'], f: ['#b8386e', '#ff82bc'], e: '#ffe8f4', o: '#4a1030' },
  teal:  { b: ['#0e6a62', '#22b8a8', '#a0f0e0'], f: ['#1a8a80', '#58d8c8'], e: '#e0fff8', o: '#08302c' },
};
// узкая рыбка: плещется в воде для красоты
function sprFishN(kind, fr) {
  return fySpr('fishn' + kind + fr, 34, 14, c => {
    const K = FISHN_COL[kind] || FISHN_COL.teal;
    c.translate(0, 1);
    const sw = fyMix(-1.6, 1.6, fyK(fr));
    fyP(c, [[10, 6], [1, 2 + sw], [3, 6], [1, 10 - sw]], K.f[0]); fyP(c, [[10, 6], [2.6, 3.4 + sw], [4, 6], [2.6, 8.6 - sw]], K.f[1]);
    fyP(c, [[13, 3.4], [17, 0.4], [22, 1.4], [23, 3.6]], K.f[0]);
    fyP(c, [[16, 8.6], [14, 11.8], [19, 9.4]], K.f[0]);
    fyE(c, 18, 6, 12, 3.4, K.b[0]); fyE(c, 17.6, 5.6, 11.6, 3, K.b[1]); fyE(c, 18, 7.8, 9.6, 1.2, K.b[2]);
    for (let x = 11; x < 27; x += 2.6) fyD(c, x, 5.2, K.b[0]);
    fyL(c, 24, 3.6, 24.4, 8.4, 1, 1, K.b[0]);
    fyE(c, 27.6, 5.2, 1.6, 1.6, K.e); fyE(c, 27.9, 5.4, 0.8, 0.8, '#14100a'); fyD(c, 27.4, 4.8, '#ffffff');
    fyOutline(c, 34, 14, K.o);
  });
}

function sprEnder(carry) {
  const W = carry ? 76 : 40, H = carry ? 100 : 62, ox = carry ? 18 : 0, oy = carry ? 38 : 0;
  return fySpr('end2' + carry, W, H, c => {
    const B = ['#0c0912', '#1c1526', '#2c2240'], EY = '#d060ff', EC = '#f4d0ff';
    if (carry) {
      // большое дерево, выкорчеванное с корнем: ствол, раскидистая крона, корни с землёй
      const TX = 50;
      fyL(c, TX, 78, TX, 40, 7, 5.4, '#4a2e14'); fyL(c, TX - 1.2, 78, TX - 1.2, 40, 3.4, 2.4, '#7a4e26');
      for (const [x, y, rx, ry] of [[TX - 14, 40, 13, 10], [TX + 14, 40, 13, 10], [TX, 30, 20, 14]]) fyE(c, x, y, rx, ry, '#154a1e');
      for (const [x, y, rx, ry] of [[TX - 14, 38, 12, 9], [TX + 14, 38, 12, 9], [TX, 28, 19, 13], [TX - 6, 14, 12, 9], [TX + 7, 15, 11, 8]]) fyE3(c, x, y, rx, ry, ['#1c5a24', '#2f8a38', '#6cc04a']);
      for (const [x, y] of [[TX - 8, 12], [TX + 2, 8], [TX + 12, 18], [TX - 20, 34], [TX + 18, 34], [TX - 2, 26], [TX + 8, 30]]) { fyD(c, x, y, '#a8e878'); fyD(c, x + 1, y, '#a8e878'); }
      fyL(c, TX - 2, 52, TX - 9, 44, 2.4, 1, '#4a2e14'); fyL(c, TX + 2, 50, TX + 9, 43, 2.4, 1, '#4a2e14');
      fyE(c, TX, 80, 9, 4.4, '#3a2410'); fyE(c, TX - 0.6, 79.4, 8, 3.6, '#5a3a1c');
      for (const [x1, x2] of [[TX - 3, TX - 10], [TX + 3, TX + 10], [TX, TX + 1]]) fyL(c, x1, 80, x2, 87, 3, 1, '#3a2410');
      for (const x of [TX - 9, TX + 8, TX - 2]) fyD(c, x, 88, '#5a3a1c');
    }
    c.translate(ox, oy);
    fyL(c, 13.6, 36, 12.4, 58, 3.6, 2.8, B[0]); fyL(c, 19, 36, 20.4, 58, 3.6, 2.8, B[0]); fyL(c, 13.2, 36, 12, 58, 2.2, 1.6, B[1]); fyL(c, 18.6, 36, 20, 58, 2.2, 1.6, B[1]);
    fyE(c, 12.4, 59, 2.8, 1.2, B[0]); fyE(c, 21, 59, 2.8, 1.2, B[0]);
    fyP(c, [[11.5, 15.5], [21.5, 15.5], [20.5, 37], [12.5, 37]], B[0]); fyP(c, [[12.4, 16.4], [20.6, 16.4], [19.8, 36], [13.2, 36]], B[1]); fyP(c, [[12.6, 17], [14.4, 17], [14, 35], [13.6, 35]], B[2]);
    fyL(c, 16.5, 12, 16.5, 17, 4.4, 4.4, B[0]);
    fyP(c, [[10.5, 3], [22.5, 3], [23, 13.4], [10, 13.4]], B[0]); fyP(c, [[11.4, 3.8], [21.6, 3.8], [22, 12.6], [11, 12.6]], B[1]); fyP(c, [[11.6, 4], [20, 4], [20, 5.2], [11.6, 5.2]], B[2]);
    fyP(c, [[11.4, 8], [15.6, 8], [15.6, 10.6], [11.4, 10.6]], EY); fyP(c, [[17.4, 8], [21.8, 8], [21.8, 10.6], [17.4, 10.6]], EY);
    fyP(c, [[12.4, 8.6], [14.6, 8.6], [14.6, 10], [12.4, 10]], EC); fyP(c, [[18.4, 8.6], [20.8, 8.6], [20.8, 10], [18.4, 10]], EC);
    if (carry) {
      fyL(c, 21, 18, 32, 20, 3, 2.4, B[0]); fyL(c, 20.6, 17.6, 32, 19.6, 1.8, 1.4, B[1]); fyL(c, 11.4, 18, 32, 26, 3, 2.4, B[0]); fyE(c, 33, 20, 1.8, 1.8, B[0]); fyE(c, 33, 26, 1.8, 1.8, B[0]);
    } else {
      fyL(c, 11.4, 17.6, 7, 40, 3, 2, B[0]); fyL(c, 21.6, 17.6, 26, 40, 3, 2, B[0]); fyL(c, 11, 17.6, 6.6, 40, 1.8, 1.2, B[1]);
      fyE(c, 6.8, 41, 1.8, 1.6, B[0]); fyE(c, 26.2, 41, 1.8, 1.6, B[0]);
    }
    c.translate(-ox, -oy);
    fyOutline(c, W, H, '#4a2a6a');
  });
}

function sprBowl(full) {
  return fySpr('bowl' + full, 8, 4, c => {
    R_(c, 0, 1, 8, 1, '#8a8a98'); R_(c, 1, 2, 6, 2, '#6a6a7a'); R_(c, 1, 1, 6, 1, full ? '#fffdf4' : '#4a4a58'); R_(c, 2, 0, 3, 1, full ? '#fffdf4' : 'rgba(0,0,0,0)');
  });
}
function sprGoose(fr) {
  return fySpr('gg' + fr, 20, 18, c => {
    const q = '#f4cc40', Q = '#c8982a', e = '#fff2a0', o = '#e8782a';
    R_(c, 2, 7, 11, 6, q); R_(c, 0, 6, 4, 3, q); R_(c, 3, 7, 9, 1, e); R_(c, 3, 12, 10, 1, Q); R_(c, 5, 9, 5, 2, Q);        // тело, хвост, крыло
    R_(c, 11, 2, 3, 7, q); R_(c, 11, 2, 1, 7, e); R_(c, 12, 0, 4, 3, q); R_(c, 15, 1, 4, 2, o); R_(c, 14, 1, 1, 1, '#1a1208');
    { const q = fyK(fr), m = (a, b) => Math.round(fyMix(a, b, q)); R_(c, m(6, 5), 13, 1, 4, o); R_(c, m(8, 9), 13, 1, 4, o); R_(c, m(5, 4), 16, 3, 1, o); R_(c, m(7, 8), 16, 3, 1, o); };
  });
}
function sprEgg() { return fySpr('egg', 5, 6, c => { R_(c, 1, 0, 3, 1, '#f4cc40'); R_(c, 0, 1, 5, 4, '#f4cc40'); R_(c, 1, 5, 3, 1, '#c8982a'); R_(c, 1, 1, 1, 2, '#fff6c0'); }); }

// ---------- Домовой ----------
function fyDoor(b) { return [b.doorX + 0.5, b.doorY + 0.5]; }

function brownieTick(dt, F) {
  F.bT = (F.bT || 0) - dt;
  if (F.bT <= 0) {
    F.bT = 6;
    for (const b of Game.buildings) {
      if (b.state !== 'done' || b.removed || (b.type !== 'bakery' && b.type !== 'mill') || F.chk.has(b.id)) continue;
      F.chk.add(b.id);
      if (F.bw.length < 3 && Math.random() < 0.4) F.bw.push({ bid: b.id, milk: -1, dec: -1, prank: -1, logK: -1, tt: 0, act: 15, pk: 0, nextPk: fyR(30, 90), ph: Math.random() * 9 });
    }
  }
  const nt = nightAmt(), k = nightIndex(), ev = isEveningNow(), deep = nt > 0.5 && !isDawnNow();
  for (let i = F.bw.length - 1; i >= 0; i--) {
    const br = F.bw[i], b = fyBuilding(br.bid);
    if (!b) { F.bw.splice(i, 1); continue; }
    br.ph += dt;
    if (br.pk > 0) br.pk -= dt;
    br.tt += dt;
    if (br.tt < 1) continue;
    br.tt = 0;
    const [dx, dy] = fyDoor(b), who = b.type === 'bakery' ? 'Пекарь' : 'Мельник';
    // вечером решает, ставить ли блюдце
    if (ev && br.dec !== k && b.worker && !b.worker.dead) {
      br.dec = k;
      if (Math.random() < 0.8) {
        br.milk = k; floater(dx + 0.7, dy - 0.2, 'Блюдце!', '#f4f0e0'); fstat('hMilk');
        logEvent('animal', `${who} поставил блюдце молока домовому`, dx, dy);
      } else logEvent('animal', `${who} забыл про блюдце молока для домового`, dx, dy);
    }
    if (!deep) continue;
    br.nextPk -= 1;
    if (br.nextPk <= 0) { br.nextPk = fyR(70, 150); br.pk = 5; }
    br.act -= 1;
    if (br.act > 0) continue;
    br.act = fyR(22, 40);
    const fed = br.milk === k;
    if (fed) {
      let did = null;
      if (b.dmg > 0.02) { b.dmg = Math.max(0, b.dmg - 0.18); did = 'починил'; fstat('hFix'); }
      else if (b.type === 'bakery' && b.stock.flour >= 1 && b.stock.bread + 3 <= b.def.outputs.bread) { b.stock.flour--; b.stock.bread += 3; Game.produced.bread += 3; did = 'испёк хлеб в'; fstat('hBake'); }
      else if (b.type === 'mill' && b.stock.wheat >= 1 && b.stock.flour + 1 <= b.def.outputs.flour) { b.stock.wheat--; b.stock.flour++; Game.produced.flour++; did = 'смолол муку в'; fstat('hBake'); }
      if (did) {
        floater(dx, dy - 0.8, did === 'починил' ? 'Тук-тук!' : 'Хлебушек!', '#ffe9b0'); br.pk = Math.max(br.pk, 2.5);
        if (br.logK !== k) { br.logK = k; logEvent('animal', `Домовой за ночь ${did === 'починил' ? 'починил здание' : did + ' ' + (b.type === 'bakery' ? 'пекарне' : 'мельнице')}`, dx, dy); }
      }
    } else if (br.prank !== k && Math.random() < 0.5) {
      br.prank = k; fstat('hPrank');
      const w = b.worker;
      if (w && w.carry && !w.dead) { const g = dropLoad(w); floater(w.x, w.y - 1.3, 'Ой!', '#ffc8a0'); if (g) logEvent('animal', `Домовой подставил подножку: ${UNIT_TYPES[w.type].name.toLowerCase()} уронил груз`, w.x, w.y); }
      if (b.dmg < 0.5) { b.dmg = 0.52; floater(dx, dy - 0.8, 'Хи-хи!', '#c8b0ff'); logEvent('animal', `Домовой спрятал инструмент: ${b.def.name.toLowerCase()} стоит, пока не найдут`, dx, dy); toast(`Домовой обиделся без молока и спрятал инструмент: ${b.def.name.toLowerCase()}`); }
    }
  }
}

function brownieDraw(list, c, F, x0, y0, x1, y1) {
  const nt = nightAmt(), k = nightIndex();
  for (const br of F.bw) {
    const b = fyBuilding(br.bid);
    if (!b || !FY_SEE(b.doorX, b.doorY, x0, y0, x1, y1)) continue;
    const [dx, dy] = fyDoor(b);
    if (isEveningNow() && br.milk === k) list.push([dy + 0.3, () => fyBlit(c, sprBowl(1), (dx + 0.75) * TILE, (dy + 0.1) * TILE + 6)]);
    if (nt < 0.3) continue;
    list.push([dy + 0.35, () => {
      const a = Math.min(1, (nt - 0.3) * 2);
      if (br.pk > 0) {                                    // мелькнул силуэт
        const f = Math.min(1, br.pk / 1.2, (5 - br.pk) / 0.8 + 0.01);
        fyBlit(c, sprBrownie(), (dx - 0.8) * TILE, (dy + 0.25) * TILE, 1, 0.82 * Math.max(0, Math.min(1, f)) * a);
      } else if (Math.sin(br.ph * 0.7) > -0.2) {          // только глаза в темноте у печки
        const ex = Math.round((dx - 0.9) * TILE), ey = Math.round((dy - 0.5) * TILE), bl = Math.sin(br.ph * 2.3) > 0.93;
        if (!bl) { c.fillStyle = `rgba(250,226,70,${0.9 * a})`; c.fillRect(ex, ey, 2, 1); c.fillRect(ex + 5, ey, 2, 1); c.fillStyle = `rgba(250,226,70,${0.18 * a})`; c.fillRect(ex - 1, ey - 1, 4, 3); c.fillRect(ex + 4, ey - 1, 4, 3); }
      }
    }]);
  }
}

// ---------- Единорог ----------
function uniFindSpot() {
  const cx = MAP_W >> 1, cy = MAP_H >> 1;
  for (let t = 0; t < 300; t++) {
    const x = (Math.random() * MAP_W) | 0, y = (Math.random() * MAP_H) | 0;
    if (!fyIsWater(x, y) || Math.hypot(x - cx, y - cy) < 7) continue;
    for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const lx = x + ax * 2, ly = y + ay * 2;
      if (fyFree(lx, ly) && fyFree(x + ax, y + ay)) return [lx, ly];
    }
  }
  return null;
}
let lastUniToast = -99;

function unicornTick(dt, F) {
  let u = F.uni;
  if (!u) {
    F.uT = (F.uT || 0) - dt;
    if (F.uT > 0) return;
    F.uT = 5;
    const k = nightIndex(), nt = nightAmt();
    if (k < 1 || F.uniRoll === k || !isEveningNow() || nt < 0.03 || nt > 0.32 || isRaining() || isDawnNow()) return;
    F.uniRoll = k;
    const hurt = Game.units.some(x => x.injury && isPerson(x));
    if (Math.random() > (hurt ? 0.5 : 0.22)) return;
    const s = uniFindSpot();
    if (!s) return;
    F.uni = u = { x: s[0] + 0.5, y: s[1] + 0.5, face: 1, st: 'graze', t: 0, life: 75, ph: 0, heal: 0, mv: false, tg: null };
    fstat('uniSeen');
    logEvent('animal', 'У родника на вечерней поляне появился единорог', u.x, u.y);
    if (Game.time - lastUniToast > 120) { lastUniToast = Game.time; toast('На поляне у родника показался единорог — не пугайте его, он лечит раненых'); }
    floater(u.x, u.y - 1.6, 'Тсс…', '#e8d8ff');
    return;
  }
  u.ph += dt; u.t += dt;
  const hero = fyHero();
  const close = nearestPerson(u, 2.3, p => isPerson(p) && p.type !== 'carter');
  const nearHero = hero && Math.hypot(hero.x - u.x, hero.y - u.y) < 3.2;
  if (u.st !== 'flee' && u.st !== 'gone' && (close || nearHero)) {
    u.st = 'flee'; u.t = 0; u.fa = Math.atan2(u.y - (close || hero).y, u.x - (close || hero).x);
    floater(u.x, u.y - 1.6, 'Иго-го!', '#ffd0f0'); fstat('uniScare');
    logEvent('animal', 'Единорог испугался и ускакал', u.x, u.y);
    fxBurst(u.x * TILE, u.y * TILE - 14, 12, ['#f8e8ff', '#ffc0e8', '#c8d8ff'], 70, 40, 0.6, 1.6, 40);
  }
  if (u.st === 'flee') {
    const nx = u.x + Math.cos(u.fa) * 6 * dt, ny = u.y + Math.sin(u.fa) * 6 * dt;
    if (inb(nx | 0, ny | 0) && !fyIsWater(nx | 0, ny | 0) && !World.bmap[idx(nx | 0, ny | 0)]) { u.x = nx; u.y = ny; } else u.fa += 1.2;
    u.face = Math.cos(u.fa) > 0 ? 1 : -1; u.mv = true;
    if (u.t > 3.5) F.uni = null;
    return;
  }
  u.life -= dt;
  if (u.life <= 0) { fxBurst(u.x * TILE, u.y * TILE - 14, 14, ['#f8e8ff', '#ffc0e8', '#fff2a0'], 60, 50, 0.9, 1.6, 20); logEvent('animal', 'Единорог растворился в вечернем свете', u.x, u.y); F.uni = null; return; }
  // ближайший раненый (или герой с ранами)
  let tg = null, bd = 16;
  for (const p of Game.units) {
    if (p.dead || p.inside || !isPerson(p)) continue;
    const need = p.injury || (p.hero && p.hero.hp < p.hero.maxhp * 0.8);
    if (!need) continue;
    const d = Math.hypot(p.x - u.x, p.y - u.y);
    if (d < bd) { bd = d; tg = p; }
  }
  u.mv = false;
  if (tg && bd > 4.2) {      // подходит на расстояние, не вплотную
    const d = Math.hypot(tg.x - u.x, tg.y - u.y);
    const tx = tg.x + (u.x - tg.x) / d * 3.6, ty = tg.y + (u.y - tg.y) / d * 3.6;
    const ox = u.x, oy = u.y;
    fyMove(u, tx, ty, 1.7, dt);
    if (!inb(u.x | 0, u.y | 0) || fyIsWater(u.x | 0, u.y | 0) || World.bmap[idx(u.x | 0, u.y | 0)]) { u.x = ox; u.y = oy; } else u.mv = true;
  }
  if (tg && bd <= 4.4) {
    u.heal += dt;
    if (u.heal > 2.2) {
      u.heal = 0;
      if (tg.injury) { tg.injury = null; tg.injuryUntil = 0; }
      if (tg.hero) tg.hero.hp = Math.min(tg.hero.maxhp, tg.hero.hp + tg.hero.maxhp * 0.2);
      floater(tg.x, tg.y - 1.4, 'Здоров!', '#a0ffb0'); fstat('uniHeal');
      fxBurst(tg.x * TILE, tg.y * TILE - 10, 12, ['#f8e8ff', '#a0ffb0', '#fff2a0'], 40, 50, 0.9, 1.6, -20);
      logEvent('animal', `Единорог вылечил: ${tg.hero ? tg.hero.name : UNIT_TYPES[tg.type].name.toLowerCase()}`, tg.x, tg.y);
    }
  } else u.heal = 0;
}

function unicornDraw(list, c, F, x0, y0, x1, y1) {
  const u = F.uni;
  if (!u || !FY_SEE(u.x, u.y, x0, y0, x1, y1)) return;
  list.push([u.y + 0.1, () => {
    const px = u.x * TILE, py = u.y * TILE + 4, fr = u.mv ? fyCyc8(u.ph * (u.st === 'flee' ? 10 : 4) * 4) : 0;
    const a = u.life < 3 && u.st !== 'flee' ? Math.max(0, u.life / 3) : 1;
    fyShadow(c, px, py, 11);
    const rear = u.st === 'flee' && Math.floor(u.t * 9) % 6 === 0 ? 1 : 0;
    fyBlit(c, sprUnicorn(fr), px, py - (u.st === 'flee' ? Math.abs(Math.sin(u.ph * 9)) * 3 : 0) - rear, u.face, a);
    // мерцание
    if ((Math.floor(u.ph * 7) % 3) === 0) { c.fillStyle = 'rgba(255,255,255,0.85)'; c.fillRect(Math.round(px + Math.sin(u.ph * 3) * 12), Math.round(py - 14 + Math.cos(u.ph * 4) * 8), 1, 1); }
  }]);
}

// ---------- Гнёзда: дракончик и грифон ----------
function fyNests(F) {
  if (F.nests) return;
  F.nests = true;
  const cx = MAP_W >> 1, cy = MAP_H >> 1, cands = [];
  for (let y = 2; y < MAP_H - 2; y++) for (let x = 2; x < MAP_W - 2; x++) {
    if (!fyIsRock(x, y) || Math.hypot(x - cx, y - cy) < 12) continue;
    let d = 0;
    for (let yy = -2; yy <= 2; yy++) for (let xx = -2; xx <= 2; xx++) if (fyIsRock(x + xx, y + yy)) d++;
    if (d >= 14) cands.push([x, y]);
  }
  F.rocks = cands;
  const pick = (far) => { for (let t = 0; t < 40 && cands.length; t++) { const q = cands[(Math.random() * cands.length) | 0]; if (!far || Math.hypot(q[0] - far[0], q[1] - far[1]) > 8) return q; } return cands[0] || null; };
  if (!F.dr) { const q = F.drSaved || pick(); if (q) F.dr = { nx: q[0], ny: q[1], x: q[0] + 0.5, y: q[1] + 0.5, z: 0, st: 'nest', t: fyR(240, 400), tamed: !!(F.drSaved && F.drSaved[2]), stage: (F.drSaved && F.drSaved[3]) || 0, raids: (F.drSaved && F.drSaved[4]) || 0, loot: 0, face: 1, ph: 0, pet: 120, tx: 0, ty: 0, src: null }; }
  if (!F.gr) { const q = F.grSaved || pick(F.dr ? [F.dr.nx, F.dr.ny] : null); if (q) F.gr = { nx: q[0], ny: q[1], x: q[0] + 0.5, y: q[1] + 0.5, z: 8, tr: q[2] != null ? q[2] : (4 + (Math.random() * 6 | 0)), hp: 70, st: 'patrol', t: 0, face: 1, ph: 0, wx: q[0], wy: q[1], duel: 0, cd: 0, resp: q[3] || 0, seen: 0 }; if (F.gr.resp > 0) { F.gr.st = 'gone'; F.gr.z = 0; } }
}

// ---------- Дракончик и дракон ----------
// Малыш (stage 0) таскает по 1–3 золота и редко поджигает поле; после шести удачных набегов (или даров герою) вырастает
// во взрослого дракона (stage 1): уносит по 3–6 золота и поджигает поля чаще.
const dragName = d => (d.stage ? 'Дракон' : 'Дракончик');
function dragGrow(d) {
  d.raids++;
  if (!d.stage && d.raids >= 6) {
    d.stage = 1;
    fxBurst(d.x * TILE, d.y * TILE - d.z, 30, ['#8ad06a', '#4ca04a', '#fff2a0', '#ffffff'], 90, 70, 1, 2, 60);
    floater(d.x, d.y - 2, 'Р-рав!', '#c8ffb0'); fstat('dragGrow');
    logEvent('animal', 'Дракончик вырос в настоящего дракона!', d.x, d.y); toast('Дракончик вырос в настоящего дракона!');
  }
}
function dragonTarget() {
  const fromPile = Game.piles && [...Game.piles.values()].find(p => !p.removed && p.stock.gold - p.reserved.gold > 0);
  if (fromPile) return { x: fromPile.x + 0.5, y: fromPile.y + 0.5, pile: fromPile };
  const st = Game.buildings.find(b => b.isStore() && b.stock.gold - b.reserved.gold >= 3);
  if (st) return { x: st.doorX + 0.5, y: st.doorY + 0.5, store: st };
  return null;
}
function dragonFire(F, d) {
  let best = null, bd = 14;
  for (let t = 0; t < 400; t++) {
    const x = (d.x + (Math.random() - 0.5) * 24) | 0, y = (d.y + (Math.random() - 0.5) * 24) | 0;
    if (!inb(x, y)) continue;
    const o = World.obj[idx(x, y)];
    if (o && o.t === 'field' && !o.plan) { const dd = Math.hypot(x - d.x, y - d.y); if (dd < bd) { bd = dd; best = [x, y, o]; } }
  }
  return best;
}
let lastDragToast = -99;

function dragonTick(dt, F) {
  const d = F.dr;
  if (!d) return;
  d.ph += dt;
  const hero = fyHero();
  if (d.tamed) {        // приручён: кружит у героя и носит золотишко
    d.st = 'pet'; d.z = 22 + Math.sin(d.ph * 2) * 3;
    const hx = hero ? hero.x : MAP_W / 2, hy = hero ? hero.y : MAP_H / 2;
    const tx = hx - 1.6 + Math.cos(d.ph * 0.8) * 0.8, ty = hy - 0.8 + Math.sin(d.ph * 0.8) * 0.5;
    fyMove(d, tx, ty, Math.max(2.2, Math.hypot(tx - d.x, ty - d.y) * 1.2), dt);
    d.pet -= dt;
    if (d.pet <= 0 && hero) {
      d.pet = fyR(110, 190);
      const n = d.stage ? 2 + (Math.random() * 3 | 0) : 1 + (Math.random() * 3 | 0);
      dropPile(Math.floor(hero.x), Math.floor(hero.y) + 1, 'gold', n); dragGrow(d);
      floater(d.x, d.y - 1.4, 'Блям!', '#ffd700'); fstat('dragPetGold', n);
      logEvent('gold', `Ручной ${dragName(d).toLowerCase()} принёс герою золото ×${n}`, d.x, d.y);
    }
    return;
  }
  if (d.st === 'nest') {
    d.z = 0; d.x = d.nx + 0.5; d.y = d.ny + 0.5;
    d.t -= dt;
    if (d.t > 0) return;
    const done = Game.buildings.filter(b => b.state === 'done').length;
    if (done < 4 || nightAmt() > 0.05 || isRaining()) { d.t = 15; return; }
    const tg = dragonTarget();
    if (!tg) { d.t = 25; return; }
    d.tx = tg.x; d.ty = tg.y; d.src = tg; d.st = 'out'; d.z = 4; d.t = 0;
    return;
  }
  if (d.st === 'out') {
    d.z = Math.min(28, d.z + dt * 14);
    const rest = fyMove(d, d.tx, d.ty, 3.4, dt);
    if (nightAmt() > 0.2) { d.st = 'back'; return; }
    if (rest < 0.25) { d.st = 'land'; d.t = 0; }
    return;
  }
  if (d.st === 'land') {
    d.z = Math.max(0, d.z - dt * 30);
    if (d.z > 0) return;
    d.t += dt;
    const s = shooersNear(d.x, d.y, 3.6, 3, 3);
    if (s) {      // прогнали или герой подошёл
      if (s.hero && !d.triedTame && Math.random() < 0.5) {
        d.tamed = true; d.pet = 90; d.st = 'pet';
        floater(d.x, d.y - 1.6, 'Ур-р!', '#c8ffb0');
        logEvent('animal', `Герой приручил существо: ${dragName(d).toLowerCase()}!`, d.x, d.y); toast(`Герой приручил: ${dragName(d).toLowerCase()}! Теперь он носит золото`); fstat('dragTame');
        return;
      }
      d.triedTame = true;
      if (d.loot) { dropPile(Math.floor(d.x), Math.floor(d.y), 'gold', d.loot); d.loot = 0; }
      floater(d.x, d.y - 1.4, 'Хр-р!', '#ffb080'); shooWave(s, 'Брысь!'); fstat('dragShoo');
      d.st = 'back'; return;
    }
    if (d.t > 1.4 && !d.loot) {
      const src = d.src;
      let n = d.stage ? 3 + (Math.random() * 4 | 0) : 1 + (Math.random() * 3 | 0);
      if (src && src.pile && !src.pile.removed) { n = Math.min(n, src.pile.stock.gold - src.pile.reserved.gold); src.pile.stock.gold -= n; cleanupPile(src.pile); }
      else if (src && src.store && !src.store.removed) { n = Math.min(n, src.store.stock.gold - src.store.reserved.gold); if (n > 0) src.store.stock.gold -= n; }
      else n = 0;
      if (n > 0) {
        d.loot = n; fstat('dragRaid'); fstat('dragGold', n); dragGrow(d);
        floater(d.x, d.y - 1.4, 'Хр-р!', '#ffb080');
        logEvent('gold', `${dragName(d)} утащил золото ×${n}`, d.x, d.y);
        if (Game.time - lastDragToast > 90) { lastDragToast = Game.time; toast(`${dragName(d)} украл золото ×${n}! Герой может его прогнать или приручить`); }
      }
      d.triedTame = d.triedTame || false;
      d.st = Math.random() < (d.stage ? 0.4 : 0.15) ? 'fire' : 'back'; d.t = 0;
      if (d.st === 'fire') { d.fire = dragonFire(F, d); if (!d.fire) d.st = 'back'; }
    }
    return;
  }
  if (d.st === 'fire') {      // летит к полю и дышит огнём
    d.z = Math.min(16, d.z + dt * 20);
    const [fx, fy, o] = d.fire;
    const rest = fyMove(d, fx + 0.5, fy + 0.5, 3, dt);
    if (rest < 0.3) {
      if (World.obj[idx(fx, fy)] === o) {
        o.g = 0; o.ash = false;
        if (typeof WX !== 'undefined' && WX.fires) WX.fires.push({ x: fx + 0.5, y: fy + 0.5, t0: Game.time, life: fyR(4, 7) });
        fxBurst((fx + 0.5) * TILE, (fy + 0.5) * TILE, 18, ['#ffcc50', '#ff8a30', '#ffe890'], 80, 50, 0.8, 2, -10);
        floater(fx + 0.5, fy - 0.4, 'Фр-р-р!', '#ffa060'); fstat('dragFire');
        logEvent('weather', `${dragName(d)} подпалил поле`, fx + 0.5, fy + 0.5);
        toast(`${dragName(d)} подпалил поле!`);
      }
      d.st = 'back'; d.fire = null;
    }
    return;
  }
  if (d.st === 'back') {
    d.z = Math.min(30, d.z + dt * 16);
    const rest = fyMove(d, d.nx + 0.5, d.ny + 0.5, 4, dt);
    if (rest < 0.4) { d.st = 'nest'; d.t = fyR(180, 360); d.z = 0; d.loot = 0; d.triedTame = false; }
  }
}

function dragonDraw(list, c, F, x0, y0, x1, y1) {
  const d = F.dr;
  if (!d || !FY_SEE(d.x, d.y, x0, y0, x1, y1)) return;
  list.push([d.y + 0.15, () => {
    const px = d.x * TILE, py = d.y * TILE + 4, air = d.z > 1;
    fyShadow(c, px, py, air ? 7 : 9, air ? 0.16 : 0.3);
    if (d.st === 'nest') {      // спит свернувшись на камне, из ноздри дымок
      fyBlit(c, d.stage ? sprDragon(1) : sprBabyDragon(1), px, py, 1, 1, d.stage ? 0.8 : 1);
      if (Math.floor(d.ph * 1.5) % 4 === 0) { c.fillStyle = 'rgba(200,200,200,0.5)'; c.fillRect(Math.round(px + 11), Math.round(py - 18 - (d.ph * 6) % 6), 2, 2); }
      return;
    }
    fyBlit(c, d.stage ? sprDragon(air ? fyCyc8(d.ph * 32) : 1) : sprBabyDragon(air ? fyCyc8(d.ph * 36) : 1), px, py - d.z, d.face || 1, 1, d.stage ? 0.85 : 1);
    if (d.loot && air) { c.save(); c.translate(px + (d.face || 1) * 6, py - d.z + 2); c.scale(0.3, 0.3); drawLoad(c, 'gold'); c.restore(); }
    if (d.st === 'fire' && d.fire) {     // струя огня
      const dir = d.face || 1;
      for (let k = 0; k < 5; k++) { c.fillStyle = k % 2 ? '#ffd860' : '#ff8a30'; c.fillRect(Math.round(px + dir * (10 + k * 3)), Math.round(py - d.z - 8 + k * 2 + Math.sin(d.ph * 20 + k) * 1.5), 3, 3); }
    }
  }]);
}

// ---------- Грифон ----------
function griffinTick(dt, F) {
  const g = F.gr;
  if (!g) return;
  g.ph += dt; g.cd -= dt;
  if (g.st === 'gone') {
    g.resp -= dt;
    if (g.resp <= 0) { g.st = 'patrol'; g.hp = 70; g.tr = 4 + (Math.random() * 6 | 0); g.x = g.nx + 0.5; g.y = g.ny + 0.5; g.z = 8; g.wx = g.nx; g.wy = g.ny; }
    return;
  }
  // кто у гнезда
  const near = Game.units.filter(u => !u.dead && !u.inside && isPerson(u) && u.type !== 'carter' && Math.hypot(u.x - (g.nx + 0.5), u.y - (g.ny + 0.5)) < 4.2);
  const fighter = near.find(u => (u.hero || u.rec) && Math.hypot(u.x - (g.nx + 0.5), u.y - (g.ny + 0.5)) < 2.6 && typeof neuUnitOut === 'function' && !neuUnitOut(u));
  if (fighter) { g.st = 'duel'; g.foe = fighter.id; }
  else if (g.st === 'duel') { g.st = 'patrol'; g.foe = 0; }
  if (g.st === 'duel') {
    const foe = Game.unitMap.get(g.foe);
    if (!foe || neuUnitOut(foe)) { g.st = 'patrol'; return; }
    g.z = 4; fyMove(g, foe.x - 0.9 * (foe.x > g.x ? 1 : -1), foe.y, 2.5, dt);
    g.face = foe.x > g.x ? 1 : -1;
    g.duel += dt;
    if (g.duel > 1.3) {
      g.duel = 0;
      if (!g.seen) { g.seen = 1; fstat('grifFight'); logEvent('animal', 'Грифон бросился защищать сокровище', g.x, g.y); toast('Грифон защищает своё сокровище!'); }
      neuHurtUnit(foe, 3 + Math.random() * 3); floater(foe.x, foe.y - 1.6, 'Крр-ряу!', '#ffd8a0');
      const dmg = neuDamageOf(foe) * (0.7 + Math.random() * 0.5);
      g.hp -= dmg; floater(g.x, g.y - 2, '−' + Math.round(dmg), '#ffffff');
      if (g.hp <= 0) {
        g.st = 'gone'; g.resp = 600 + Math.random() * 300; g.z = 0;
        dropPile(Math.floor(foe.x), Math.floor(foe.y), 'gold', g.tr);
        dropPile(Math.floor(foe.x), Math.floor(foe.y), 'magicstone', 1);
        fstat('grifWin'); logEvent('gold', `${foe.hero ? foe.hero.name : 'Рекрут'} одолел грифона: сокровище золото ×${g.tr}`, g.x, g.y);
        toast(`Грифон улетел, бросив сокровище: золото ×${g.tr}`);
        floater(g.x, g.y - 1.6, 'Блям!', '#ffd700');
      }
    }
    return;
  }
  if (g.hp < 70) g.hp = Math.min(70, g.hp + dt * 2);
  // гражданских, подошедших к гнезду, пугает
  if (g.cd <= 0) {
    const civ = near.find(u => !u.hero && !u.rec);
    if (civ) {
      g.cd = 25; floater(g.x, g.y - 2, 'Крр!', '#ffd8a0'); scare(civ, g); fstat('grifScare');
      if (Math.random() < 0.3) injure(civ, 'leg');
      logEvent('animal', 'Грифон прогнал гнома от своего гнезда', civ.x, civ.y);
    }
  }
  // патруль: облетает горы и окрестности, иногда садится на гнездо
  g.z = 14 + Math.sin(g.ph * 1.3) * 3;
  g.t -= dt;
  if (g.t <= 0 || Math.hypot(g.wx - g.x, g.wy - g.y) < 0.8) {
    g.t = fyR(12, 28);
    const roll = Math.random();
    if (roll < 0.3) { g.wx = g.nx + 0.5; g.wy = g.ny + 0.5; g.rest = fyR(8, 18); }
    else if (F.rocks && F.rocks.length && roll < 0.75) { const q = F.rocks[(Math.random() * F.rocks.length) | 0]; g.wx = q[0] + 0.5; g.wy = q[1] + 0.5; }
    else { g.wx = Math.max(2, Math.min(MAP_W - 3, g.nx + fyR(-26, 26))); g.wy = Math.max(2, Math.min(MAP_H - 3, g.ny + fyR(-20, 20))); }
  }
  if (g.rest > 0 && Math.hypot(g.nx + 0.5 - g.x, g.ny + 0.5 - g.y) < 0.7) { g.rest -= dt; g.z = 0; return; }
  fyMove(g, g.wx, g.wy, 3.2, dt);
}

function griffinDraw(list, c, F, x0, y0, x1, y1) {
  const g = F.gr;
  if (!g) return;
  if (FY_SEE(g.nx, g.ny, x0, y0, x1, y1) && g.st !== 'gone') {       // сокровище в гнезде
    list.push([g.ny + 0.05, () => { const px = (g.nx + 0.5) * TILE, py = (g.ny + 0.5) * TILE + 6; c.fillStyle = 'rgba(40,24,8,0.55)'; c.beginPath(); c.ellipse(px, py, 11, 4, 0, 0, 7); c.fill(); for (let i = 0; i < Math.min(5, g.tr); i++) { c.save(); c.translate(px - 8 + i * 4, py - 2 - (i & 1)); c.scale(0.4, 0.4); drawLoad(c, 'gold'); c.restore(); } if (Math.floor(Game.time * 2) % 3 === 0) { c.fillStyle = '#fff6b0'; c.fillRect(Math.round(px + Math.sin(Game.time) * 8), Math.round(py - 6), 1, 1); } }]);
  }
  if (g.st === 'gone' || !FY_SEE(g.x, g.y, x0, y0, x1, y1)) return;
  list.push([g.y + 0.3, () => {
    const px = g.x * TILE, py = g.y * TILE + 4, air = g.z > 1;
    fyShadow(c, px, py, air ? 8 : 12, air ? 0.16 : 0.3);
    fyBlit(c, sprGriffin(air || g.st === 'duel' ? fyCyc8(g.ph * 16) : 1), px, py - g.z, g.face, 1, 1, 0.8);
  }]);
}

// ---------- Саламандра ----------
function salamanderTick(dt, F) {
  F.sT = (F.sT || 0) - dt;
  if (F.sT <= 0) {
    F.sT = 6;
    for (const b of Game.buildings) {
      if (b.state !== 'done' || b.removed || F.salChk.has(b.id) || !['metallurgist', 'smeltery', 'weaponsmith'].includes(b.type)) continue;
      F.salChk.add(b.id);
      if (Math.random() < 0.55) F.sal.push({ bid: b.id, acc: 0, was: false, ph: Math.random() * 9, bright: 0 });
    }
  }
  for (let i = F.sal.length - 1; i >= 0; i--) {
    const s = F.sal[i], b = fyBuilding(s.bid);
    if (!b) { F.sal.splice(i, 1); continue; }
    s.ph += dt;
    const on = !!b.working;
    s.bright += ((on ? 1 : 0.25) - s.bright) * Math.min(1, dt * 2);
    if (on) {
      // рецепт идёт ~на 10% быстрее: накопили 10 рабочих долей — получаем лишнюю порцию
      const rs = b.def.recipes, r = rs && rs[(b.recipeIdx + rs.length - 1) % rs.length];
      if (r) {
        s.acc += dt;
        if (s.acc >= r.time * 10) {
          s.acc = 0;
          const g = Object.keys(r.out)[0];
          if (b.stock[g] + r.out[g] <= b.def.outputs[g]) { b.stock[g] += r.out[g]; Game.produced[g] += r.out[g]; floater(b.doorX + 0.5, b.doorY - 0.4, 'Ф-ф-фых!', '#ffb060'); fstat('salBoost'); logEvent('gold', `Саламандра раздула огонь: ${b.def.name.toLowerCase()} сделала лишнее`, b.doorX, b.doorY); }
        }
      }
      if (!s.was) { s.was = true; if (Math.random() < 0.5) floater(b.doorX + 1.3, b.doorY, 'Ш-ш…', '#ff9a50'); }
    } else s.was = false;
  }
}

function salamanderDraw(list, c, F, x0, y0, x1, y1) {
  for (const s of F.sal) {
    const b = fyBuilding(s.bid);
    if (!b || !FY_SEE(b.doorX, b.doorY, x0, y0, x1, y1)) continue;
    const sx = b.doorX + 0.5 + (b.rot === 2 ? -1.1 : 1.1), sy = b.doorY + 0.55;
    list.push([sy + 0.1, () => {
      const px = sx * TILE, py = sy * TILE + 3, k = s.bright, fl = 0.75 + Math.sin(s.ph * 11) * 0.12 + Math.sin(s.ph * 17) * 0.08;
      c.save(); c.globalCompositeOperation = 'lighter';
      const gr = c.createRadialGradient(px, py - 6, 1, px, py - 6, 22 + 18 * k);
      gr.addColorStop(0, `rgba(255,150,40,${(0.18 + 0.4 * k) * fl})`); gr.addColorStop(1, 'rgba(255,100,20,0)');
      c.fillStyle = gr; c.fillRect(px - 48, py - 54, 96, 96);
      c.restore();
      fyBlit(c, sprSalamander(k > 0.6 ? fyCyc8(s.ph * 20) : 0), px, py, 1, 1, 0.9);
      if (k > 0.6 && (Math.floor(s.ph * 8) & 3) === 0) { c.fillStyle = '#ffd860'; c.fillRect(Math.round(px - 5 + Math.sin(s.ph * 9) * 5), Math.round(py - 12 - (s.ph * 14) % 8), 1, 2); }
    }]);
  }
}


// ---------- Резвящиеся рыбки (для красоты): плещутся и выпрыгивают из воды ----------
const FISHY_KINDS = ['amber', 'pink', 'teal'];
function fishyTick(dt, F) {
  const L = F.fishy || (F.fishy = []);
  F.fyT = (F.fyT || 0) - dt;
  if (F.fyT <= 0) {
    F.fyT = 5;
    if (L.length < 9) {
      for (let t = 0; t < 80; t++) {
        const x = (Math.random() * MAP_W) | 0, y = (Math.random() * MAP_H) | 0;
        if (!fyIsWater(x, y)) continue;
        let w = 0;
        for (let yy = y - 2; yy <= y + 2; yy++) for (let xx = x - 2; xx <= x + 2; xx++) if (fyIsWater(xx, yy)) w++;
        if (w < 21) continue;
        L.push({ x: x + 0.5, y: y + 0.5, ax: x + 0.5, ay: y + 0.5, tx: x + 0.5, ty: y + 0.5, face: Math.random() < 0.5 ? 1 : -1, ph: Math.random() * 9, kind: FISHY_KINDS[(Math.random() * 3) | 0], st: 'swim', jt: fyR(2, 14), jp: 0, hh: 0 });
        break;
      }
    }
  }
  const day = nightAmt() < 0.6;
  for (const f of L) {
    f.ph += dt;
    if (f.st === 'jump') {
      f.jp += dt;
      f.x += f.face * 1.9 * dt;
      f.hh = Math.sin(Math.min(1, f.jp / 0.85) * Math.PI) * 17;
      if (f.jp >= 0.85) { f.st = 'swim'; f.hh = 0; fxBurst(f.x * TILE, f.y * TILE, 8, ['#e8f6ff', '#ffffff', '#a0d0f0'], 36, 40, 0.5, 1.4, 200); if (!fyIsWater(f.x | 0, f.y | 0)) { f.x = f.ax; f.y = f.ay; } }
      continue;
    }
    if (Math.hypot(f.tx - f.x, f.ty - f.y) < 0.2) {
      for (let t = 0; t < 8; t++) { const x = f.ax + fyR(-3, 3), y = f.ay + fyR(-3, 3); if (fyIsWater(x | 0, y | 0)) { f.tx = x; f.ty = y; break; } }
    } else {
      const ox = f.x, oy = f.y; fyMove(f, f.tx, f.ty, 0.9, dt);
      if (!fyIsWater(f.x | 0, f.y | 0)) { f.x = ox; f.y = oy; f.tx = f.x; f.ty = f.y; }
    }
    f.jt -= dt;
    if (f.jt <= 0 && day) {
      f.jt = fyR(7, 22);
      if (fyIsWater((f.x + f.face * 1.9) | 0, f.y | 0) && fyIsWater((f.x + f.face * 0.9) | 0, f.y | 0)) { f.st = 'jump'; f.jp = 0; fxBurst(f.x * TILE, f.y * TILE, 6, ['#e8f6ff', '#ffffff', '#a0d0f0'], 30, 36, 0.5, 1.4, 200); }
    }
  }
}
function fishyDraw(list, c, F, x0, y0, x1, y1) {
  for (const f of F.fishy || []) {
    if (!FY_SEE(f.x, f.y, x0, y0, x1, y1) || (nightAmt() > 0.8 && f.st !== 'jump')) continue;
    list.push([f.y + (f.st === 'jump' ? 0.3 : -0.2), () => {
      const px = f.x * TILE, py = f.y * TILE + 2, jump = f.st === 'jump', fr = fyCyc6(f.ph * (jump ? 12 : 5) * 3);
      if (!jump) {
        c.strokeStyle = 'rgba(220,240,255,0.35)'; c.beginPath(); c.ellipse(px, py + 1, 8 + (f.ph * 3) % 3, 2.6, 0, 0, 7); c.stroke();
        fyBlit(c, sprFishN(f.kind, fr), px, py + 3, f.face, 0.5, 0.75);
      } else {
        fyShadow(c, px, py + 3, 5, 0.12);
        const tilt = (f.jp / 0.85 - 0.5) * 1.1 * f.face;
        c.save(); c.translate(Math.round(px), Math.round(py - f.hh)); c.rotate(tilt); c.imageSmoothingEnabled = false;
        if (f.face < 0) c.scale(-1, 1);
        const spr = sprFishN(f.kind, fr); c.drawImage(spr, -Math.round(spr.width / 2), -spr.height + 6);
        c.restore(); c.imageSmoothingEnabled = R.smooth;
      }
    }]);
  }
}

// ---------- Золотая рыбка ----------
let lastFishToast = -99;
const FISH_NAME = { gold: 'золотая', red: 'красная', blue: 'синяя' };
const FISH_REWARD = { gold: ['gold', 4, 8], red: ['mana', 1, 2], blue: ['magicstone', 1, 2] };   // чем откупаются
function fishTick(dt, F) {
  let f = F.fish;
  if (!f) {
    F.fT = (F.fT || 0) - dt;
    if (F.fT > 0) return;
    F.fT = 30;
    if (nightAmt() > 0.1 || isRaining() || Math.random() > 0.07) return;
    const cx = MAP_W >> 1, cy = MAP_H >> 1;
    for (let t = 0; t < 300; t++) {
      const x = (Math.random() * MAP_W) | 0, y = (Math.random() * MAP_H) | 0;
      if (!fyIsWater(x, y) || Math.hypot(x - cx, y - cy) > 34) continue;
      let shore = false;
      for (const [ax, ay] of DIRS) { const sx = x + ax, sy = y + ay; if (inb(sx, sy) && !fyIsWater(sx, sy) && isWalkable(sx, sy)) shore = true; }
      if (!shore) continue;
      F.fish = f = { x: x + 0.5, y: y + 0.5, ax: x + 0.5, ay: y + 0.5, tx: x + 0.5, ty: y + 0.5, face: 1, ph: 0, life: 240, st: 'swim', jt: 0, kind: ['gold', 'gold', 'red', 'blue'][(Math.random() * 4) | 0] };
      logEvent('animal', `В озере мелькнула ${FISH_NAME[f.kind]} рыбка`, f.x, f.y); fstat('fishSeen');
      if (Game.time - lastFishToast > 200) { lastFishToast = Game.time; toast(`В озере плещется ${FISH_NAME[f.kind]} рыбка — герой может её поймать`); }
      return;
    }
    return;
  }
  f.ph += dt;
  if (f.st === 'caught') { f.jt -= dt; if (f.jt <= 0) F.fish = null; return; }
  f.life -= dt;
  if (f.life <= 0) { F.fish = null; return; }
  if (Math.hypot(f.tx - f.x, f.ty - f.y) < 0.15) {
    for (let t = 0; t < 8; t++) {
      const x = f.ax + fyR(-2.5, 2.5), y = f.ay + fyR(-2.5, 2.5);
      if (fyIsWater(x | 0, y | 0)) { f.tx = x; f.ty = y; break; }
    }
  } else {
    const ox = f.x, oy = f.y; fyMove(f, f.tx, f.ty, 1.2, dt);
    if (!fyIsWater(f.x | 0, f.y | 0)) { f.x = ox; f.y = oy; f.tx = f.x; f.ty = f.y; }
  }
  if (Math.floor(f.ph) % 7 === 3 && f.jt <= 0) { f.jt = 0.6; fxBurst(f.x * TILE, f.y * TILE, 6, ['#d8f0ff', '#ffffff'], 30, 40, 0.5, 1.2, 160); }
  else f.jt = Math.max(0, f.jt - dt);
  // герой на берегу
  const hero = fyHero();
  if (hero && Math.hypot(hero.x - f.x, hero.y - f.y) < 3.2) {
    f.st = 'caught'; f.jt = 2;
    const rw = FISH_REWARD[f.kind], n = rw[1] + ((Math.random() * (rw[2] - rw[1] + 1)) | 0);
    floater(f.x, f.y - 1.4, 'Отпусти — откуплюсь!', '#fff2a0');
    const s = randomFreeNear(Math.floor(hero.x), Math.floor(hero.y), 0, 2, (x, y) => isWalkable(x, y)) || [Math.floor(hero.x), Math.floor(hero.y)];
    dropPile(s[0], s[1], rw[0], n);
    fstat('fishCaught'); fstat('fish' + f.kind, n);
    const what = `${GOODS[rw[0]].name.toLowerCase()} ×${n}`;
    logEvent('gold', `Герой поймал ${FISH_NAME[f.kind]} рыбку и получил выкуп: ${what}`, f.x, f.y);
    toast(`Герой поймал ${FISH_NAME[f.kind]} рыбку! Выкуп: ${what}`);
    fxBurst(f.x * TILE, f.y * TILE, 16, f.kind === 'gold' ? ['#fff2a0', '#ffd700', '#ffffff'] : f.kind === 'red' ? ['#ffb0a0', '#ff5a40', '#ffffff'] : ['#a0d0ff', '#4a90ff', '#ffffff'], 80, 70, 0.8, 1.6, 200);
  }
}
function fishDraw(list, c, F, x0, y0, x1, y1) {
  const f = F.fish;
  if (!f || !FY_SEE(f.x, f.y, x0, y0, x1, y1)) return;
  list.push([f.y, () => {
    const px = f.x * TILE, py = f.y * TILE + 2, up = f.st === 'caught' ? Math.sin(Math.min(1, (2 - f.jt) / 1.2) * Math.PI) * 14 : (f.jt > 0 ? Math.sin(f.jt / 0.6 * Math.PI) * 6 : 0);
    c.strokeStyle = 'rgba(220,240,255,0.45)'; c.beginPath(); c.ellipse(px, py + 2, 9 + (f.ph * 4) % 4, 3 + ((f.ph * 4) % 4) * 0.3, 0, 0, 7); c.stroke();
    fyBlit(c, sprFish(f.kind, fyCyc6(f.ph * 18)), px, py - up + 3, f.face, f.st === 'caught' ? Math.max(0, f.jt / 1) : 0.92, 0.8);
  }]);
}

// ---------- Золотой гусь ----------
function goldGooseTick(dt, F) {
  let g = F.gg;
  const geese = Game.animals.filter(a => a.kind === 'goose' && !a.dead);
  if (!g) {
    F.gT = (F.gT || 0) - dt;
    if (F.gT > 0) return;
    F.gT = 20;
    if (!geese.length || (F.ggSaved == null && Math.random() > 0.03)) return;
    const a = geese[(Math.random() * geese.length) | 0];
    F.gg = g = { x: a.x + 0.5, y: a.y + 0.5, face: 1, ph: 0, mv: false, a, egg: F.ggSaved != null ? F.ggSaved : -1, upset: -1, wait: 3 };
    F.ggSaved = null;
    logEvent('animal', 'Среди гусей замечен золотой гусь', g.x, g.y); fstat('ggSeen');
    toast('Среди гусей ходит золотой гусь — не обижайте стаю, и он будет нести золотые яйца');
    return;
  }
  g.ph += dt;
  if (!g.a || g.a.dead || !Game.animals.includes(g.a)) {
    g.a = geese[0];
    if (!g.a) { F.gg = null; return; }
  }
  const k = fyDay();
  // обидели стаю: кто-то из гусей убегает/прогнан или трое гномов рядом
  if (g.a.state === 'shoo' || g.a.shooUntil > Game.time) { if (g.upset !== k) { g.upset = k; floater(g.x, g.y - 1.6, 'Га-а!', '#ffd0a0'); logEvent('animal', 'Золотого гуся обидели — яйца сегодня не будет', g.x, g.y); } }
  const ox = g.x, oy = g.y, d = Math.hypot(g.a.x - g.x, g.a.y - g.y);
  g.mv = false;
  if (d > 1.6) {
    fyMove(g, g.a.x, g.a.y, Math.min(2.6, 1 + d * 0.5), dt);
    if (!gooseCanBe(g.x | 0, g.y | 0)) { g.x = ox; g.y = oy; } else g.mv = true;
  }
  if (g.egg !== k && g.upset !== k) {
    g.wait -= dt;
    if (g.wait <= 0 && !g.mv && nightAmt() < 0.5) {
      g.egg = k; g.wait = 3;
      dropPile(Math.floor(g.x), Math.floor(g.y), 'gold', 2);
      floater(g.x, g.y - 1.4, 'Блям!', '#ffd700'); fstat('goldEgg');
      logEvent('gold', 'Золотой гусь снёс золотое яйцо (золото ×2)', g.x, g.y);
      fxBurst(g.x * TILE, g.y * TILE - 6, 10, ['#fff2a0', '#ffd700'], 40, 40, 0.7, 1.4, 200);
    }
  }
}
function goldGooseDraw(list, c, F, x0, y0, x1, y1) {
  const g = F.gg;
  if (!g || !FY_SEE(g.x, g.y, x0, y0, x1, y1)) return;
  list.push([g.y + 0.15, () => {
    const px = g.x * TILE, py = g.y * TILE + 4;
    fyShadow(c, px, py, 8);
    fyBlit(c, sprGoose(g.mv ? fyCyc6(g.ph * 18) : 0), px, py, g.face, 1, 1, 0.9);
    if ((Math.floor(g.ph * 6) % 5) === 0) { c.fillStyle = '#fffbd0'; c.fillRect(Math.round(px + Math.sin(g.ph * 5) * 8), Math.round(py - 12 + Math.cos(g.ph * 3) * 5), 1, 1); }
  }]);
}


// ---------- Долговяз (эндермен) ----------
// Нейтральный: бродит по лесам, никого не трогает, но подходить к нему не стоит — исчезает. Время от времени
// выкапывает дерево, несёт его и либо сажает в другом месте, либо уносит с собой навсегда.
let lastEndToast = -99;
function endBlink(e, why) {
  fxBurst(e.x * TILE, e.y * TILE - 24, 22, ['#d060ff', '#8a30c8', '#f4d0ff', '#2a1040'], 70, 70, 0.8, 1.8, -10);
  if (why) floater(e.x, e.y - 2.6, why, '#d8a0ff');
}
function endermanTick(dt, F) {
  let e = F.end;
  if (!e) {
    F.eT = (F.eT || 0) - dt;
    if (F.eT > 0) return;
    F.eT = 25;
    if (Game.time < 200 || Math.random() > 0.3) return;
    const q = wildSpot(14, true);
    if (!q) return;
    F.end = e = { x: q[0] + 0.5, y: q[1] + 0.5, face: 1, st: 'roam', t: fyR(10, 25), ph: 0, tree: null, mv: false, go: null, tg: null, dest: null };
    endBlink(e);
    fstat('endSeen');
    logEvent('animal', 'В лесу показался долговязый тёмный силуэт с фиолетовыми глазами', e.x, e.y);
    return;
  }
  e.ph += dt; e.mv = false;
  const scared = nearestPerson(e, 2.8, p => isPerson(p) && p.type !== 'carter');
  if (scared && e.st !== 'dig') {      // подошли слишком близко: растворяется и появляется подальше
    const q = wildSpot(14, true);
    endBlink(e, 'Вжух!');
    if (q) { e.x = q[0] + 0.5; e.y = q[1] + 0.5; endBlink(e); }
    e.go = null;
    return;
  }
  if (e.st === 'roam') {
    e.t -= dt;
    if (!e.go || Math.hypot(e.go[0] - e.x, e.go[1] - e.y) < 0.2) {
      const t = randomFreeNear(Math.floor(e.x), Math.floor(e.y), 2, 6, (x, y) => fyFree(x, y));
      e.go = t ? [t[0] + 0.5, t[1] + 0.5] : null;
    }
    if (e.go) { const ox = e.x, oy = e.y; fyMove(e, e.go[0], e.go[1], 1.1, dt); if (!fyFree(e.x | 0, e.y | 0)) { e.x = ox; e.y = oy; e.go = null; } else e.mv = true; }
    if (e.t <= 0) {
      const tr = treeSpot(e.x, e.y, 14);
      if (tr) { e.tg = tr; e.st = 'goto'; e.go = null; } else e.t = fyR(10, 20);
    }
  } else if (e.st === 'goto') {
    const [tx, ty] = e.tg, o = World.obj[idx(tx, ty)];
    if (!o || o.t !== 'tree' || o.g < 1) { e.st = 'roam'; e.t = 8; return; }
    const ox = e.x, oy = e.y, rest = fyMove(e, tx + 0.5, ty + 1.3, 1.5, dt);
    if (!inb(e.x | 0, e.y | 0) || World.bmap[idx(e.x | 0, e.y | 0)] || fyIsWater(e.x | 0, e.y | 0)) { e.x = ox; e.y = oy; e.st = 'roam'; e.t = 10; return; }
    e.mv = true;
    if (rest < 0.2) { e.st = 'dig'; e.t = 3; e.face = 1; floater(e.x, e.y - 2.6, 'Хрусть…', '#d8a0ff'); }
  } else if (e.st === 'dig') {
    e.t -= dt;
    if (Math.floor(e.ph * 6) % 2 === 0) fxBurst(e.tg[0] * TILE + 16 + fyR(-6, 6), (e.tg[1] + 1) * TILE - 4, 1, ['#6a4a2a', '#4a3018'], 40, 40, 0.6, 1.6, 240);
    if (e.t <= 0) {
      const i = idx(e.tg[0], e.tg[1]), o = World.obj[i];
      if (o && o.t === 'tree' && o.g >= 1) {
        World.obj[i] = { t: 'stump', g: 0 }; World.growing.add(i);
        e.tree = o; e.st = 'carry'; e.t = fyR(9, 16);
        const q = wildSpot(10, true); e.dest = q ? [q[0] + 0.5, q[1] + 0.5] : null;
        fstat('endTree');
        logEvent('animal', 'Долговяз выкопал дерево и понёс его с собой', e.tg[0] + 0.5, e.tg[1] + 0.5);
        if (Game.time - lastEndToast > 150) { lastEndToast = Game.time; toast('Тёмный долговяз выкопал дерево и унёс его с собой'); }
      } else { e.st = 'roam'; e.t = 10; }
    }
  } else if (e.st === 'carry') {
    e.t -= dt;
    if (e.dest) {
      const ox = e.x, oy = e.y; fyMove(e, e.dest[0], e.dest[1], 1.7, dt);
      if (!inb(e.x | 0, e.y | 0) || World.bmap[idx(e.x | 0, e.y | 0)] || fyIsWater(e.x | 0, e.y | 0)) { e.x = ox; e.y = oy; e.dest = null; } else e.mv = true;
    }
    if (e.t <= 0 || (e.dest && Math.hypot(e.dest[0] - e.x, e.dest[1] - e.y) < 0.3)) {
      endBlink(e, 'Вжух!');
      if (Math.random() < 0.3) {         // уносит дерево навсегда
        F.end = null; F.eT = fyR(240, 420);
        logEvent('animal', 'Долговяз исчез вместе с деревом', e.x, e.y);
        return;
      }
      const q = wildSpot(14, true);
      if (q) { e.x = q[0] + 0.5; e.y = q[1] + 0.5; }
      const s = randomFreeNear(Math.floor(e.x), Math.floor(e.y), 0, 3, (x, y) => fyFree(x, y) && !World.obj[idx(x, y)]);
      if (s) { setTree(idx(s[0], s[1]), 0.4); logEvent('animal', 'Долговяз посадил дерево на новом месте', s[0] + 0.5, s[1] + 0.5); fstat('endPlant'); }
      e.tree = null; e.st = 'roam'; e.t = fyR(60, 140); e.go = null;
      endBlink(e);
    }
  }
}
function endermanDraw(list, c, F, x0, y0, x1, y1) {
  const e = F.end;
  if (!e || !FY_SEE(e.x, e.y, x0, y0, x1, y1)) return;
  list.push([e.y + 0.2, () => {
    const px = e.x * TILE, py = e.y * TILE + 4;
    fyShadow(c, px, py, 8, 0.28);
    const bob = e.mv ? Math.abs(Math.sin(e.ph * 6)) * 1.4 : 0;
    fyBlit(c, sprEnder(e.st === 'carry' ? 1 : 0), px, py - bob, e.face, 1, 0.82);
    if (Math.floor(e.ph * 9) % 4 === 0) { c.fillStyle = 'rgba(208,96,255,0.8)'; c.fillRect(Math.round(px + fyR(-9, 9)), Math.round(py - fyR(6, 48)), 1, 1); }
  }]);
}

// ---------- Общий тик и рисование ----------
function fairyTick(dt) {
  if (!FAUNA_ON() || !Game.buildings || !Game.buildings.length || !startOpen('fairy')) return;
  const F = fyState();
  fyNests(F);
  brownieTick(dt, F);
  unicornTick(dt, F);
  dragonTick(dt, F);
  griffinTick(dt, F);
  salamanderTick(dt, F);
  fishTick(dt, F);
  fishyTick(dt, F);
  goldGooseTick(dt, F);
  endermanTick(dt, F);
}

function fairyDrawList(list, c, x0, y0, x1, y1) {
  if (!FAUNA_ON() || !Game.fairy) return;
  const F = Game.fairy;
  brownieDraw(list, c, F, x0, y0, x1, y1);
  unicornDraw(list, c, F, x0, y0, x1, y1);
  dragonDraw(list, c, F, x0, y0, x1, y1);
  griffinDraw(list, c, F, x0, y0, x1, y1);
  salamanderDraw(list, c, F, x0, y0, x1, y1);
  fishDraw(list, c, F, x0, y0, x1, y1);
  fishyDraw(list, c, F, x0, y0, x1, y1);
  goldGooseDraw(list, c, F, x0, y0, x1, y1);
  endermanDraw(list, c, F, x0, y0, x1, y1);
}

// ---------- Сохранение ----------
function serializeFairy1() {
  const F = Game.fairy;
  if (!F) return undefined;
  const o = {
    b: F.bw.map(b => [b.bid, b.milk, b.dec, b.prank]), bc: [...F.chk],
    s: F.sal.map(s => s.bid), sc: [...F.salChk],
  };
  if (F.dr) o.d = [F.dr.nx, F.dr.ny, F.dr.tamed ? 1 : 0, F.dr.stage || 0, F.dr.raids || 0];
  if (F.gr) o.g = [F.gr.nx, F.gr.ny, F.gr.tr, F.gr.st === 'gone' ? Math.round(F.gr.resp) : 0];
  if (F.gg) o.e = F.gg.egg;
  // дракончик, грифон и яйцо после загрузки встают не сразу — до этого их сохранённые данные не должны теряться
  if (!o.d && F.drSaved) o.d = F.drSaved;
  if (!o.g && F.grSaved) o.g = F.grSaved;
  if (o.e == null && F.ggSaved != null) o.e = F.ggSaved;
  return o;
}
function loadFairy1(o) {
  Game.fairy = null;
  if (!o) return;
  const F = fyState();
  for (const [bid, milk, dec, prank] of o.b || []) F.bw.push({ bid, milk, dec, prank, logK: -1, tt: 0, act: 15, pk: 0, nextPk: fyR(30, 90), ph: Math.random() * 9 });
  for (const id of o.bc || []) F.chk.add(id);
  for (const bid of o.s || []) F.sal.push({ bid, acc: 0, was: false, ph: Math.random() * 9, bright: 0 });
  for (const id of o.sc || []) F.salChk.add(id);
  if (o.d) F.drSaved = o.d;
  if (o.g) F.grSaved = o.g;
  if (o.e != null) F.ggSaved = o.e;
}
