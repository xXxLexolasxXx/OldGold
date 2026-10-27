'use strict';
// Здания как набор объёмов в 3D: короба со стенами и крышами, круглые башни,
// навесы, реквизит. Косая проекция: видны южные и восточные стены, поэтому
// здание можно развернуть входом на восток (rot = 1).
//
// Мир здания: X — на восток, Y — на север (вглубь), Z — вверх.
// Модели описываются в локальных координатах: x — вдоль фасада со входом,
// y — вглубь от фасада. При rot = 1 фасад смотрит на восток.

let SK = 0.5;   // насколько уходит вправо глубина (у свинарника с боковым поворотом 0: загон стоит ровно, а не наискось)
const DK = 0.78;  // насколько сжимается глубина

function P(g, X, Y, Z = 0) { return [g.ox + X + Y * SK, g.oy - Y * DK - Z]; }
function vsub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }

function toW(m, x, y) { return m.rot ? [m.LD - y, x] : [x, y]; }
function PL(m, x, y, z = 0) { const [X, Y] = toW(m, x, y); return P(m.g, X, Y, z); }

function boxW(m, b) {
  if (!m.rot) return { X0: b.x0, X1: b.x1, Y0: b.y0, Y1: b.y1 };
  return { X0: m.LD - b.y1, X1: m.LD - b.y0, Y0: b.x0, Y1: b.x1 };
}
// какая локальная сторона видна как южная / восточная стена
const VISF = [{ S: 'S', E: 'E' }, { S: 'W', E: 'S' }];
function axisW(m, a) { return m.rot ? (a === 'X' ? 'Y' : 'X') : a; }
function downW(m, d) { if (!m.rot) return d; return { S: 'E', E: 'N', N: 'W', W: 'S' }[d]; }

function hull(pts) {
  pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  up.pop(); lo.pop();
  return lo.concat(up);
}

// Тень на отдельный слой: свет с запада-юга, тень вправо-вверх.
function shadowOf(g, pts3) {
  const pts = [];
  for (const [X, Y, Z] of pts3) { pts.push(P(g, X, Y, 0)); pts.push(P(g, X + Z * 0.55, Y + Z * 0.18, 0)); }
  poly(g.sc, hull(pts), 'rgba(12,10,6,0.36)');
}

const SIGN_QUEUE = { list: [] };

// ================= Гномский стиль =================
// Модели описаны в духе K&M (штукатурка, фахверк, черепица). Здесь они
// переводятся в лесной гномский вид: бревенчатые стены на замшелом камне,
// крутые крыши из замшелой дранки или дёрна, круглые окна и двери, грибы у стен.

// стиль текущего здания (выбирается по типу): бревенчатая изба, белёный коттедж под
// соломой или светлый фахверковый дом под красной черепицей — как во второй деревне референсов
let BUILD_STYLE = 'logs', BUILD_TYPE = '', BUILD_LEVEL = 1;
let BUILD_ERA = 2;   // эпоха облика: 1 — солома и дерево, 2 — камень и дерево, 3 — дворцовый (камень, черепица, колонны, статуи)
const COTTAGE_TYPES = new Set(['inn', 'brewery', 'butchery', 'hopfarm', 'stable']);
const REDROOF_TYPES = new Set(['school', 'mill', 'sawmill', 'metallurgist', 'armory', 'magicworkshop', 'goatpen', 'swine']);
const DWARF_TYPES = new Set(['storehouse']);   // «Оплот»: приземистый каменный склад под холодным сланцем (трактир — тёплый коттедж под соломой)
// соломенная кровля на 1-м уровне (материал 'straw' — многоразовый, для других зданий достаточно добавить тип сюда)
const STRAW_TYPES = new Set(['inn', 'storehouse', 'school']);
const STRAW_COLS = ['#c8a455', '#c09c4e', '#cfae5e'];
// колокольни, шпили и башни остаются прежними; эпоха 3 (дворцовая) и 2-й уровень — тоже
function strawOk(q, r) { return BUILD_LEVEL === 1 && STRAW_TYPES.has(BUILD_TYPE) && r.type !== 'pyramid' && !r.h && !q.finial; }
function strawRoof(r, r0, h) {
  r.mat = 'straw'; r.col = STRAW_COLS[h % 3];
  r.rise = (r0.rise ?? 18) * 1.22;
  r.ov = (r0.ov ?? 4) + 2.6;
}
// Кровля читается по уровню здания: 1 — солома, 2 — дерево (дранка), 3 — черепица. Верно для всех зданий с достройкой,
// у которых есть обычная скатная крыша (колокольни, шпили и пирамиды остаются прежними); эпоха на кровлю не влияет.
function levelRoofOk(q, r) { const d = typeof BUILDINGS !== 'undefined' && BUILDINGS[BUILD_TYPE]; return !!(d && d.up) && r.type !== 'pyramid' && !r.h && !q.finial; }
const WOOD_ROOF = ['#8a6238', '#7e5a34', '#946a3e'], LEVEL_TILES = ['#b04a2c', '#a8432a', '#ba5532'];
function levelRoof(r, r0, h) {
  if (BUILD_LEVEL >= 3) { r.mat = 'tiles'; r.col = LEVEL_TILES[h % 3]; r.rise = (r0.rise ?? 18) * 1.2; r.ov = (r0.ov ?? 4) + 1.8; }
  else if (BUILD_LEVEL === 2) { r.mat = 'shingle'; r.col = WOOD_ROOF[h % 3]; r.rise = (r0.rise ?? 18) * 1.14; r.ov = (r0.ov ?? 4) + 2; }
  else strawRoof(r, r0, h);
}
const RED_TILES = ['#b04a2c', '#a8432a', '#ba5532'];
const RED_WALLS = ['#e6d4b0', '#ead9b8', '#dfcca6'];
function styleOf(type) { return DWARF_TYPES.has(type) ? 'dwarf' : COTTAGE_TYPES.has(type) ? 'cottage' : REDROOF_TYPES.has(type) ? 'red' : 'logs'; }

const LOG_COLS = ['#7a4e2c', '#84562e', '#6e4628', '#8a5e34'];

function gnomePart(p) {
  if (p._g) return p;
  const q = { ...p, _g: true, moss: true };
  const h = hashStr(`${p.x0},${p.y0},${p.h}`);
  const cottage = BUILD_STYLE === 'cottage', red = BUILD_STYLE === 'red', dwarf = BUILD_STYLE === 'dwarf';
  if (dwarf) {
    // Оплот: массивный бутовый камень, у высоких домов — тёплый фахверковый верх на каменном низу
    const tall = (q.h || 0) >= 40;
    if (tall) {
      q.wall = 'plaster'; q.col = ['#e2d2ac', '#dccba4', '#e6d8b6'][h % 3];
      q.frame = true; q.beam = '#3a2414'; q.gableWall = 'plaster'; q.gableCol = q.col; q.gableFrame = true;
      q.lowerStone = Math.max(q.lowerStone || 0, 22);
    } else {
      q.wall = 'fieldstone'; q.col = ['#9a907a', '#8e866f', '#a29882'][h % 3];
      q.frame = false; q.gableWall = 'fieldstone'; q.gableCol = q.col; q.beam = '#3a2414';
      q.lowerStone = 0;
    }
    q.stoneCol = '#8a806a';
    q.cottage = false;
  } else if (BUILD_TYPE === 'house') {
    // жилой дом: стены и ставни задаёт вариант (house.js) — не переодеваем, чтобы восемь видов не слились в один
  } else if ((q.wall === 'plaster' || q.wall === 'brick' || q.wall === 'plank' || q.wall === 'logs') && red) {
    // светлая штукатурка, тёмный фахверк, каменный цоколь
    q.wall = 'plaster'; q.col = RED_WALLS[h % 3];
    q.frame = true; q.beam = '#3e2416'; q.gableWall = 'plaster'; q.gableCol = q.col; q.gableFrame = true;
    q.lowerStone = Math.max(q.lowerStone || 0, 6);
    q.cottage = true;                                  // кирпичные трубы и белёные слуховые окна
  } else if ((q.wall === 'plaster' || q.wall === 'brick') && cottage) {
    // коттедж как на референсах: белёные стены, тёмный фахверк, толстая солома
    q.wall = 'plaster'; q.col = ['#ece2c8', '#e8dcc0', '#f0e6d0'][h % 3];
    q.frame = true; q.beam = '#3a2414'; q.gableWall = 'plaster'; q.gableCol = q.col;
    q.cottage = true;
  } else if (q.wall === 'plaster' || q.wall === 'brick') {
    q.wall = 'logs'; q.col = LOG_COLS[h % LOG_COLS.length];
    q.frame = false; q.gableWall = 'plank'; q.gableCol = shade(q.col, -0.08);
    q.beam = '#3a2414';
  } else if (q.wall === 'stone') {
    q.wall = 'fieldstone'; q.col = '#948e7c';
  } else if (q.wall === 'plank') q.col = q.col || '#7a5030';
  if (q.lowerStone) { q.lowerStone = Math.max(q.lowerStone, 7); q.stoneCol = '#8e8a78'; }
  if (q.roof) {
    const r = q.roof = { ...q.roof };
    if (strawOk(q, r)) strawRoof(r, { ...r }, h);   // солома: крутой скат, глубокий свес с неровной бахромой
    else if (dwarf) {
      // холодный серо-синий сланец, пологий и тяжёлый, с глубоким свесом — склад не спутать с тёплым трактиром
      r.mat = 'slate'; r.col = ['#6e6c68', '#666460', '#767472'][h % 3];
      r.rise = (r.rise ?? 18) * 0.8;
      r.ov = (r.ov ?? 4) + 2;
    } else if (red) {
      // тёплая красно-бурая черепица, ровный конёк, немного мха только у свеса
      r.mat = 'tiles'; r.col = RED_TILES[h % 3];
      r.rise = (r.rise ?? 18) * 1.15;
      r.ov = (r.ov ?? 4) + 1.6;
    } else if (cottage) {
      // толстая соломенная крыша, выше и с глубоким свесом
      r.mat = 'thatch'; r.col = BUILD_TYPE === 'inn' ? ['#d2b45c', '#c8aa52', '#dcbe66'][h % 3] : ['#8c7444', '#846c3e', '#947c4a'][h % 3];   // трактир — яркая золотая солома
      r.rise = (r.rise ?? 18) * 1.25;
      r.ov = (r.ov ?? 4) + 2.6;
    } else {
      if (r.mat === 'tiles' || r.mat === 'slate' || r.mat === 'shingle') {
        // маленькие постройки — под дёрном, большие — под замшелой дранкой
        r.mat = (q.x1 - q.x0) * (q.y1 - q.y0) < 1300 || (h >> 4) % 3 === 0 ? 'turf' : 'moss';
        r.col = r.mat === 'turf' ? '#5c8236' : '#7a5a36';
      } else if (r.mat === 'thatch') r.col = '#a8925a';
      r.rise = (r.rise ?? 18) * 1.12;
      r.ov = (r.ov ?? 4) + 1.2;
    }
  }
  if (BUILD_ERA !== 2) eraPart(q, p, h);
  else eraStonePlinth(q);
  if (q.roof && levelRoofOk(q, q.roof)) levelRoof(q.roof = { ...q.roof }, p.roof, h);
  return q;
}

// ---------- Эпохи облика ----------
// Эпоха 1 — деревня: бревенчатые и дощатые стены без камня, соломенные крыши.
// Эпоха 2 — как раньше, но с каменным цоколем и деревянной дранкой вместо красной черепицы.
// Эпоха 3 — дворцовый вид: светлый тёсаный камень, терракотовая черепица, колонны, статуи, знамёна (см. eraExtras).
const STRAW = ['#c9a95a', '#bf9f50', '#d3b564'];
const PALACE_WALLS = ['#d9d2bf', '#d2cab5', '#ddd6c4'];
const PALACE_TILES = ['#b6482a', '#ae4126', '#bd502e'];

function eraStonePlinth(q) {
  if (q.open || !q.wall || q.wall === 'fieldstone' || q.wall === 'stone') return;
  q.lowerStone = Math.max(q.lowerStone || 0, Math.min(9, (q.h || 20) * 0.4));
  q.stoneCol = q.stoneCol || '#8e8a78';
  const r = q.roof;
  if (r && r.mat === 'tiles') { r.mat = 'moss'; r.col = '#7a5a36'; r.rise = (r.rise ?? 18) * 0.92; }
}

function eraPart(q, p, h) {
  const r0 = p.roof;
  if (BUILD_ERA === 1) {
    if (!q.open && q.wall && BUILD_TYPE !== 'house') {
      const tall = (q.h || 0) >= 34 && h % 2 === 0;
      q.wall = tall ? 'plank' : 'logs'; q.col = tall ? '#7a5030' : LOG_COLS[h % LOG_COLS.length];
      q.frame = false; q.lowerStone = 0; q.beam = '#3a2414'; q.cottage = false;
      q.gableWall = 'plank'; q.gableCol = shade(q.col, -0.08); q.gableFrame = false;
    }
    if (r0) {
      const r = q.roof = { ...q.roof };
      if (BUILD_ERA === 1 && strawOk(q, r0)) strawRoof(r, r0, h);
      else { r.mat = 'thatch'; r.col = STRAW[h % 3]; r.rise = (r0.rise ?? 18) * 1.2; r.ov = (r0.ov ?? 4) + 2.4; }
    }
  } else if (BUILD_ERA === 3) {
    if (!q.open && q.wall && BUILD_TYPE !== 'house') {
      q.wall = 'stone'; q.col = PALACE_WALLS[h % 3]; q.frame = false; q.moss = false;
      q.lowerStone = 0; q.cottage = false; q.gableWall = 'stone'; q.gableCol = q.col; q.gableFrame = false;
    }
    if (r0) {
      const r = q.roof = { ...q.roof };
      r.mat = 'tiles'; r.col = PALACE_TILES[h % 3];
      r.rise = (r0.rise ?? 18) * 1.1; r.ov = (r0.ov ?? 4) + 1.5;
    }
  }
}

// Мох и плющ по низу стены, грибы и травка у фундамента (в координатах грани)
function wallMoss(c, L, H, ground) {
  if (ground) { groundTufts(c, L, H); return; }
  // мох у фундамента: цельная кайма с неровным верхом (ступеньками по 1/3 px) и кочками
  c.fillStyle = 'rgba(50,80,28,0.55)';
  for (let x = 0, k = 0; x < L; x += 1, k++) {
    const hgt = 2 + ((hsh(k, 1, 40) * 3) | 0) * PXU * 2 + (hsh(k >> 2, 2, 40) < 0.3 ? 1.4 : 0);
    c.fillRect(x, H - hgt, 1, hgt);
  }
  for (let k = 0, x = 2 + hsh(0, 3, 41) * 6; x < L - 2; x += 7 + hsh(k, 4, 41) * 9, k++) {
    const r = 1.4 + hsh(k, 5, 41) * 1.2;
    ellipse(c, x, H - 1.2, r, r * 0.7, GMOSS[1]); c.fillStyle = GMOSS[3]; c.fillRect(x - r * 0.4, H - 1.6 - r * 0.5, PXU * 2, PXU);
  }
  if (srand() < 0.45 && H > 16) {
    // плющ ползёт вверх: стебель и листья парами, без разброса размеров
    const x0 = rnd(4, Math.max(5, L - 4)), top = H - rnd(10, Math.min(H - 2, 30));
    for (let y = H, k = 0; y > top; y -= 1.2, k++) {
      const x = x0 + Math.sin(y * 0.5) * 2;
      c.fillStyle = '#2f4a26'; c.fillRect(x, y - 1.2, PXU, 1.2);
      if (k % 2) { const g = k % 4 === 1 ? GMOSS[2] : GMOSS[1]; c.fillStyle = g; c.fillRect(x - 1.4, y - 1, 1.2, 1); c.fillStyle = GMOSS[3]; c.fillRect(x - 1.4, y - 1, PXU, PXU); }
      else { c.fillStyle = GMOSS[2]; c.fillRect(x + 0.4, y - 1.4, 1.2, 1); }
    }
  }
}

function groundTufts(c, L, H) {
  for (let k = 0; k < L / 4; k++) {
    const x = rnd(0, L);
    for (let j = 0; j < 3; j++) line(c, x + j * 0.6, H + 1, x + j * 0.6 + rnd(-0.8, 0.8), H - rnd(1.4, 3), shade('#5c8236', rnd(-0.2, 0.25)), 0.45);
  }
  const n = 1 + ((srand() * 3) | 0);
  for (let k = 0; k < n; k++) {
    const x = rnd(3, Math.max(4, L - 3));
    mushroomProp(c, x, H + 1, rnd(0.7, 1.05), srand() < 0.6);
    if (srand() < 0.5) mushroomProp(c, x + rnd(1.8, 2.8), H + 1.2, rnd(0.5, 0.7), srand() < 0.6);
  }
  // цветник у стены, как в деревнях на референсах
  const fl = (srand() * 3) | 0;
  for (let k = 0; k < fl; k++) {
    const x = rnd(4, Math.max(5, L - 4)), col = ['#e86a9a', '#f4f0f6', '#f0d040', '#b080e0', '#e04a3a'][(srand() * 5) | 0];
    ellipse(c, x, H - 0.6, rnd(2.4, 3.6), rnd(1.6, 2.2), shade('#4a6e30', rnd(-0.15, 0.1)));
    for (let j = 0; j < 6; j++) {
      const fx = x + rnd(-2.8, 2.8), fy = H - 1 - rnd(0, 2.2);
      ellipse(c, fx, fy, 0.75, 0.75, col); ellipse(c, fx - 0.2, fy - 0.2, 0.3, 0.3, '#ffffff');
    }
  }
}

// Мягкий неровный край соломенной крыши: пучки соломы свисают со свеса
function strawFringe(c, m, p, w, H) {
  const r = p.roof, g = m.g, ov = r.ov ?? 4, rise = r.rise ?? 18, { X0, X1, Y0, Y1 } = w;
  const type = r.type || 'gable', R = rampOf(r.col);
  let a, b;
  if (type === 'gable') {
    if (axisW(m, r.axis || 'X') === 'X') { const z = H - ov * rise / ((Y1 - Y0) / 2); a = P(g, X0 - ov, Y0 - ov, z); b = P(g, X1 + ov, Y0 - ov, z); }
    else { const z = H - ov * rise / ((X1 - X0) / 2); a = P(g, X1 + ov, Y0 - ov, z); b = P(g, X1 + ov, Y1 + ov, z); }
  } else if (type === 'lean') {
    const d = downW(m, r.down || 'S');
    if (d === 'S') { a = P(g, X0 - ov, Y0 - ov, H); b = P(g, X1 + ov, Y0 - ov, H); }
    else if (d === 'E') { a = P(g, X1 + ov, Y0 - ov, H); b = P(g, X1 + ov, Y1 + ov, H); }
    else return;
  } else if (type === 'hip') {
    const z = H - ov * rise / Math.min((X1 - X0) / 2, (Y1 - Y0) / 2);
    a = P(g, X0 - ov, Y0 - ov, z); b = P(g, X1 + ov, Y0 - ov, z);
  } else return;
  // свисающие пряди: группы по 2–3 с разной длиной, тёмное тело и светлый срез на конце
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  let s = 0;
  for (let k = 0; s < len; k++) {
    const wd = 1 + ((hsh(k, 1, 35) * 2) | 0), dr = 1.2 + hsh(k, 2, 35) * 2.6, t = s / len;
    const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
    c.fillStyle = R[4]; c.fillRect(x - 0.5, y - 0.5, wd, dr + 0.5);
    c.fillStyle = R[3]; c.fillRect(x - 0.5, y - 0.5, wd, dr - 0.6);
    c.fillStyle = R[1]; c.fillRect(x - 0.5, y - 0.5, PXU * 2, dr - 1);
    if (dr > 2) { c.fillStyle = R[0]; c.fillRect(x - 0.5, y + dr - 0.8, wd, PXU * 2); }
    s += wd + (hsh(k, 3, 35) < 0.25 ? 1 : 0);
  }
}

function thatchFringe(c, m, p, w, H) {
  const r = p.roof;
  if (r && r.mat === 'straw') { strawFringe(c, m, p, w, H); return; }
  if (!r || r.mat !== 'thatch') return;
  const g = m.g, ov = r.ov ?? 4, rise = r.rise ?? 18;
  const { X0, X1, Y0, Y1 } = w;
  let a, b;
  if ((r.type || 'gable') === 'gable' && axisW(m, r.axis || 'X') === 'X') {
    const ovz = ov * rise / ((Y1 - Y0) / 2);
    a = P(g, X0 - ov, Y0 - ov, H - ovz); b = P(g, X1 + ov, Y0 - ov, H - ovz);
  } else if (r.type === 'hip' || r.type === 'pyramid') {
    const ovz = ov * rise / Math.min((X1 - X0) / 2, (Y1 - Y0) / 2);
    a = P(g, X0 - ov, Y0 - ov, H - ovz); b = P(g, X1 + ov, Y0 - ov, H - ovz);
  } else return;
  // ровный ряд пучков соломы: длины чередуются по узору, два оттенка — тень и свет
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), R = rampOf(r.col), pat = [2.4, 1.8, 2.8, 2.0, 2.2];
  for (let s = 0, k = 0; s < len; s += 2, k++) {
    const t = s / len, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
    const dr = pat[k % pat.length];
    c.fillStyle = R[4]; c.fillRect(x - 1, y - 0.5, 2, dr + 0.5);
    c.fillStyle = R[2]; c.fillRect(x - 1, y - 0.5, 1, dr - 0.3);
    c.fillStyle = R[0]; c.fillRect(x - 1, y - 0.5, PXU, dr - 1);
  }
}

// ================= Грани =================

function faceXform(c, g, face, w, ztop) {
  const tl = face === 'S' ? P(g, w.X0, w.Y0, ztop) : P(g, w.X1, w.Y0, ztop);
  if (face === 'S') c.transform(1, 0, 0, 1, tl[0], tl[1]);
  else c.transform(SK, -DK, 0, 1, tl[0], tl[1]);
}

function drawDecor(c, d, H) {
  const u = d.u;
  switch (d.t) {
    case 'door': {
      // гномская дверь: полукруглый верх, у одностворчатых — зелёная или красная краска
      const o = { ...(d.o || {}), square: false, gnome: true };
      if (!o.double && !o.col && !o.open) o.col = ['#4e7a34', '#8c3a22', '#5a7a3a'][Math.abs(Math.round(u)) % 3];
      door(c, u, H, d.w || 10, d.h || 16, o);
      break;
    }
    case 'win': {
      const o = { ...(d.o || {}) };
      if (!o.arch && (d.w || 6) <= 8) o.round = true;
      win(c, u - (d.w || 6) / 2, H - d.z - (d.h || 7), d.w || 6, d.h || 7, o);
      break;
    }
    case 'sign': break;   // вывески теперь ставятся на крышу над входом (см. drawBoxPart)
    case 'lantern': lantern(c, u, H - d.z); break;
    case 'shield': shield(c, u, H - d.z, d.col || '#8c2c20'); break;
    case 'hatch': c.fillStyle = '#120a06'; rrect(c, u - d.w / 2, H - d.z - d.h, d.w, d.h, 1.5); c.fill(); c.fillStyle = '#5a3a1e'; c.fillRect(u - d.w / 2 - 1, H - d.z - d.h - 1, d.w + 2, 1.2); break;
    case 'louver': {
      const x = u - d.w / 2, y = H - d.z - d.h;
      c.fillStyle = '#a49c90'; c.beginPath(); c.moveTo(x - 1.2, y + d.h); c.lineTo(x - 1.2, y + d.w / 2); c.arc(u, y + d.w / 2, d.w / 2 + 1.2, Math.PI, 0); c.lineTo(x + d.w + 1.2, y + d.h); c.fill();
      c.fillStyle = '#140c08'; c.beginPath(); c.moveTo(x, y + d.h); c.lineTo(x, y + d.w / 2); c.arc(u, y + d.w / 2, d.w / 2, Math.PI, 0); c.lineTo(x + d.w, y + d.h); c.fill();
      if (d.bell) {
        c.fillStyle = lingrad(c, u - 2.6, 0, u + 2.6, 0, [[0, '#f0c860'], [1, '#8a6018']]);
        c.beginPath(); c.moveTo(u - 3, y + d.h - 2); c.quadraticCurveTo(u - 2.6, y + d.h - 7.5, u, y + d.h - 8); c.quadraticCurveTo(u + 2.6, y + d.h - 7.5, u + 3, y + d.h - 2); c.closePath(); c.fill();
        c.fillStyle = '#5a3a1e'; c.fillRect(u - 4, y + d.h - 9, 8, 1);
      }
      c.fillStyle = '#7e766c'; c.fillRect(x - 1.6, y + d.h, d.w + 3.2, 1.4);
      break;
    }
    case 'clock': {
      const y = H - d.z;
      ellipse(c, u, y, 4, 4, '#3a3632'); ellipse(c, u, y, 3.3, 3.3, '#ece6d6');
      line(c, u, y, u, y - 2.4, '#1a1410', 0.5); line(c, u, y, u + 1.8, y + 0.6, '#1a1410', 0.5);
      break;
    }
    case 'forge': {
      const y = H - d.z;
      c.fillStyle = '#a49c90'; c.beginPath(); c.moveTo(u - d.w / 2 - 2, y); c.lineTo(u - d.w / 2 - 2, y - d.h + d.w / 2); c.arc(u, y - d.h + d.w / 2, d.w / 2 + 2, Math.PI, 0); c.lineTo(u + d.w / 2 + 2, y); c.fill();
      c.fillStyle = '#120806'; c.beginPath(); c.moveTo(u - d.w / 2, y); c.lineTo(u - d.w / 2, y - d.h + d.w / 2); c.arc(u, y - d.h + d.w / 2, d.w / 2, Math.PI, 0); c.lineTo(u + d.w / 2, y); c.fill();
      c.fillStyle = radgrad(c, u, y - 2, 1, d.w * 0.6, [[0, 'rgba(255,230,140,1)'], [0.5, 'rgba(255,120,30,0.8)'], [1, 'rgba(255,60,10,0)']]);
      c.beginPath(); c.ellipse(u, y - 1, d.w * 0.45, d.h * 0.32, 0, Math.PI, 0); c.fill();
      break;
    }
    case 'loft': {
      const x = u - d.w / 2, y = H - d.z - d.h;
      c.fillStyle = '#3a2414'; c.fillRect(x - 1, y - 1, d.w + 2, d.h + 2);
      c.fillStyle = '#120a06'; c.fillRect(x, y, d.w, d.h);
      c.fillStyle = '#e4c860'; c.beginPath(); c.moveTo(x, y + d.h); c.quadraticCurveTo(u, y + d.h * 0.35, x + d.w, y + d.h); c.fill();
      c.strokeStyle = '#a08030'; c.lineWidth = 0.4;
      for (let k = -d.w / 2 + 1; k < d.w / 2; k += 1.3) { c.beginPath(); c.moveTo(u + k, y + d.h); c.lineTo(u + k * 1.2, y + d.h + 2.4); c.stroke(); }
      c.fillStyle = '#4a2c14'; c.fillRect(u - 1, y - 7, 2, 6); c.fillRect(u - 1, y - 7, 9, 1.4);
      line(c, u + 7, y - 5.6, u + 7, y + 3, '#c8b890', 0.35);
      break;
    }
    case 'hoist': {
      const y = H - d.z;
      c.fillStyle = '#4a2c14'; c.fillRect(u - 1, y - 2, 12, 1.6);
      line(c, u + 10, y - 0.4, u + 10, y + 10, '#c8b890', 0.35);
      sack(c, u + 10, y + 16, '#d8c8a0', 0.7);
      break;
    }
    case 'antlers': {
      const y = H - d.z;
      for (const s of [-1, 1]) { line(c, u, y, u + s * 4, y - 4, '#ece2cc', 0.7); line(c, u + s * 2.5, y - 2.4, u + s * 2, y - 5, '#ece2cc', 0.5); line(c, u + s * 4, y - 4, u + s * 5.6, y - 4.4, '#ece2cc', 0.5); }
      ellipse(c, u, y + 0.6, 1.4, 1.8, '#ece2cc');
      break;
    }
    case 'vine': {
      for (let k = 0; k < 30; k++) ellipse(c, u + rnd(-d.w / 2, d.w / 2), H - rnd(0, d.h), rnd(0.8, 1.6), rnd(0.6, 1.2), shade('#4a6e30', rnd(-0.3, 0.2)));
      break;
    }
  }
}

function drawFace(c, g, face, w, z0, z1, spec, light, decor) {
  const L = face === 'S' ? w.X1 - w.X0 : w.Y1 - w.Y0, H = z1 - z0;
  if (L <= 0.5 || H <= 0.5) return;
  c.save();
  faceXform(c, g, face, w, z1);
  wallTex(c, spec.wall, 0, 0, L, H, spec.col);
  const ls = spec.lowerStone || 0;
  if (ls) { wallTex(c, 'stone', 0, H - ls, L, ls, spec.stoneCol || '#a49c90'); }
  if (spec.frame) timberFrame(c, 0, 0, L, H - (ls || 3.4), spec.beam || '#4a2c16', spec.floors || 1);
  if (ls) { c.fillStyle = spec.beam || '#3a2414'; c.fillRect(-0.5, H - ls - 2, L + 1, 2.2); c.fillStyle = 'rgba(255,230,190,0.25)'; c.fillRect(-0.5, H - ls - 2, L + 1, 0.4); }
  wallShade(c, 0, 0, L, H);
  if (z0 === 0 && !spec.noPlinth) plinth(c, 0, H, L);
  // угловые столбы; у бревенчатых стен — торцы брёвен «в обло»
  if (spec.wall === 'logs') {
    const top = z0 === 0 ? H - (ls || 3) : H;
    const ex = face === 'S' ? 0.6 : L - 0.6;
    for (let y = top; y > 1; y -= 4) {
      ellipse(c, ex, y - 2, 1.7, 2.1, '#5a3a1e');
      ellipse(c, ex, y - 2, 1.2, 1.6, '#c89a64');
      ellipse(c, ex, y - 2, 0.5, 0.6, '#8a5a32');
    }
  } else if (spec.frame || spec.wall === 'plank') {
    c.fillStyle = spec.beam || '#3a2414'; c.fillRect(0, 0, 1.6, H - (z0 === 0 ? 3 : 0)); c.fillRect(L - 1.6, 0, 1.6, H - (z0 === 0 ? 3 : 0));
  } else if (spec.wall === 'plaster' || spec.wall === 'brick') {
    for (let y = H - 4; y > 0; y -= 5) { c.fillStyle = shade('#b0a696', rnd(-0.1, 0.1)); c.fillRect(face === 'S' ? 0 : L - 3, y - 4, 3, 4); }
  }
  if (spec.moss && z0 === 0) wallMoss(c, L, H, false);
  for (const d of decor) drawDecor(c, d, H);
  if (light < 1) { c.fillStyle = `rgba(14,8,2,${1 - light})`; c.fillRect(-0.5, -0.5, L + 1, H + 0.5); }
  c.strokeStyle = 'rgba(20,10,4,0.6)'; c.lineWidth = 0.5; c.strokeRect(0, 0, L, H);
  // травка и грибы у фундамента — поверх тени, они на свету
  if (spec.moss && z0 === 0 && !spec.noPlinth) {
    c.save(); c.beginPath(); c.rect(-2, H - 12, L + 4, 16); c.clip();
    wallMoss(c, L, H, true);
    c.restore();
  }
  c.restore();
}

// Треугольник фронтона (shape: tri | up — низко слева, высоко справа | down — наоборот)
function drawGableFace(c, g, face, w, zE, rise, spec, light, decor, shape = 'tri') {
  const L = face === 'S' ? w.X1 - w.X0 : w.Y1 - w.Y0;
  if (L <= 0.5 || rise <= 0.5) return;
  c.save();
  faceXform(c, g, face, w, zE + rise);
  const tri = shape === 'tri' ? [[0, rise + 0.3], [L / 2, 0], [L, rise + 0.3]]
    : shape === 'up' ? [[0, rise + 0.3], [L, 0], [L, rise + 0.3]] : [[0, 0], [L, rise + 0.3], [0, rise + 0.3]];
  c.beginPath(); c.moveTo(...tri[0]); c.lineTo(...tri[1]); c.lineTo(...tri[2]); c.closePath(); c.clip();
  wallTex(c, spec.gableWall || spec.wall, 0, 0, L, rise + 0.5, spec.gableCol || spec.col);
  if (spec.frame || spec.gableFrame) {
    const b = spec.beam || '#4a2c16';
    if (shape === 'tri') {
      c.fillStyle = b; c.fillRect(L / 2 - 1, 0, 2, rise);
      line(c, L / 2, rise * 0.45, L * 0.18, rise, b, 1.5); line(c, L / 2, rise * 0.45, L * 0.82, rise, b, 1.5);
    }
    c.fillStyle = b; c.fillRect(0, rise - 1.6, L, 1.8);
  }
  for (const d of decor) drawDecor(c, d, rise);
  // фронтон под свесом: тень двумя ступенями, без градиента
  c.fillStyle = 'rgba(0,0,0,0.16)'; c.fillRect(0, 0, L, rise + 1);
  c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(0, 0, L, Math.min(rise, 3));
  if (light < 1) { c.fillStyle = `rgba(14,8,2,${1 - light})`; c.fillRect(0, 0, L, rise + 1); }
  c.restore();
}

// ================= Крыши =================

function roofZ(m, p, w, H, X, Y) {
  const r = p.roof; if (!r) return H;
  const ax = axisW(m, r.axis || 'X'), rise = r.rise ?? 18;
  if (r.type === 'lean') {
    const d = downW(m, r.down || 'S');
    const t = d === 'S' ? (Y - w.Y0) / (w.Y1 - w.Y0) : d === 'E' ? (w.X1 - X) / (w.X1 - w.X0) : d === 'W' ? (X - w.X0) / (w.X1 - w.X0) : (w.Y1 - Y) / (w.Y1 - w.Y0);
    return H + rise * Math.max(0, Math.min(1, t));
  }
  if (r.type === 'pyramid' || r.type === 'hip') {
    const ty = 1 - Math.abs(Y - (w.Y0 + w.Y1) / 2) / ((w.Y1 - w.Y0) / 2), tx = 1 - Math.abs(X - (w.X0 + w.X1) / 2) / ((w.X1 - w.X0) / 2);
    return H + rise * Math.max(0, Math.min(ty, r.type === 'pyramid' ? tx : 1));
  }
  if (ax === 'X') return H + rise * (1 - Math.abs(Y - (w.Y0 + w.Y1) / 2) / ((w.Y1 - w.Y0) / 2));
  return H + rise * (1 - Math.abs(X - (w.X0 + w.X1) / 2) / ((w.X1 - w.X0) / 2));
}

function drawRoof(c, m, p, w, H, gDecor) {
  const r = p.roof; if (!r) return;
  const g = m.g, ov = r.ov ?? 4, rise = r.rise ?? 18, mat = r.mat, col = r.col;
  const type = r.type || 'gable', beam = p.beam || '#4a2c16';
  const { X0, X1, Y0, Y1 } = w;
  if (type === 'gable') {
    const ax = axisW(m, r.axis || 'X');
    if (ax === 'X') {
      const Ym = (Y0 + Y1) / 2, ovz = ov * rise / ((Y1 - Y0) / 2);
      drawGableFace(c, g, 'E', w, H, rise, p, 0.66, gDecor.E);
      const nP = P(g, X0 - ov, Y1 + ov, H - ovz);
      plane(c, nP, vsub(P(g, X0 - ov, Ym, H + rise), nP), vsub(P(g, X1 + ov, Y1 + ov, H - ovz), nP), mat, col, 1.15);
      const sP = P(g, X0 - ov, Y0 - ov, H - ovz);
      plane(c, sP, vsub(P(g, X0 - ov, Ym, H + rise), sP), vsub(P(g, X1 + ov, Y0 - ov, H - ovz), sP), mat, col, 1.0);
      ridgeCap(c, ...P(g, X0 - ov, Ym, H + rise), ...P(g, X1 + ov, Ym, H + rise), mat, col);
      bargeBoard(c, [P(g, X1 + ov, Y0 - ov, H - ovz), P(g, X1 + ov, Ym, H + rise + 0.6), P(g, X1 + ov, Y1 + ov, H - ovz)], beam);
      line(c, ...P(g, X0 - ov, Y0 - ov, H - ovz), ...P(g, X0 - ov, Ym, H + rise), 'rgba(255,240,210,0.35)', 0.6);
      line(c, ...P(g, X0 - ov, Y0 - ov, H - ovz + 0.3), ...P(g, X1 + ov, Y0 - ov, H - ovz + 0.3), 'rgba(15,8,2,0.7)', 0.9);
    } else {
      const Xm = (X0 + X1) / 2, ovz = ov * rise / ((X1 - X0) / 2);
      drawGableFace(c, g, 'S', w, H, rise, p, 1.0, gDecor.S);
      const wP = P(g, X0 - ov, Y0 - ov, H - ovz);
      plane(c, wP, vsub(P(g, Xm, Y0 - ov, H + rise), wP), vsub(P(g, X0 - ov, Y1 + ov, H - ovz), wP), mat, col, 1.1);
      const eP = P(g, X1 + ov, Y0 - ov, H - ovz);
      plane(c, eP, vsub(P(g, Xm, Y0 - ov, H + rise), eP), vsub(P(g, X1 + ov, Y1 + ov, H - ovz), eP), mat, col, 0.7);
      ridgeCap(c, ...P(g, Xm, Y0 - ov, H + rise), ...P(g, Xm, Y1 + ov, H + rise), mat, col);
      bargeBoard(c, [P(g, X0 - ov, Y0 - ov, H - ovz), P(g, Xm, Y0 - ov, H + rise + 0.6), P(g, X1 + ov, Y0 - ov, H - ovz)], beam);
      line(c, ...P(g, X1 + ov, Y0 - ov, H - ovz), ...P(g, X1 + ov, Y1 + ov, H - ovz), 'rgba(15,8,2,0.6)', 0.8);
    }
  } else if (type === 'hip' || type === 'pyramid') {
    const ax = axisW(m, r.axis || 'X');
    const Xm = (X0 + X1) / 2, Ym = (Y0 + Y1) / 2;
    const hx = (X1 - X0) / 2, hy = (Y1 - Y0) / 2;
    const ovz = ov * rise / Math.min(hx, hy);
    let rA, rB;   // концы конька
    if (type === 'pyramid') { rA = [Xm, Ym]; rB = [Xm, Ym]; }
    else if (ax === 'X') { const ri = Math.min(hy, hx - 1); rA = [X0 + ri, Ym]; rB = [X1 - ri, Ym]; }
    else { const ri = Math.min(hx, hy - 1); rA = [Xm, Y0 + ri]; rB = [Xm, Y1 - ri]; }
    const z = H - ovz, zt = H + rise;
    const c00 = P(g, X0 - ov, Y0 - ov, z), c10 = P(g, X1 + ov, Y0 - ov, z), c01 = P(g, X0 - ov, Y1 + ov, z), c11 = P(g, X1 + ov, Y1 + ov, z);
    const RA = P(g, rA[0], rA[1], zt), RB = P(g, rB[0], rB[1], zt);
    const xAxis = type === 'pyramid' || ax === 'X';
    // север, запад, восток, юг
    const north = xAxis ? [c01, c11, RB, RA] : [c01, c11, RB];
    const south = xAxis ? [c00, c10, RB, RA] : [c00, c10, RA];
    const west = xAxis ? [c00, c01, RA] : [c00, c01, RB, RA];
    const east = xAxis ? [c10, c11, RB] : [c10, c11, RB, RA];
    plane(c, c01, vsub(P(g, X0 - ov, Ym, zt), c01), vsub(c11, c01), mat, col, 1.15, north);
    plane(c, c00, vsub(P(g, Xm, Y0 - ov, zt), c00), vsub(c01, c00), mat, col, 1.1, west);
    plane(c, c10, vsub(P(g, Xm, Y0 - ov, zt), c10), vsub(c11, c10), mat, col, 0.7, east);
    plane(c, c00, vsub(P(g, X0 - ov, Ym, zt), c00), vsub(c10, c00), mat, col, 1.0, south);
    const hipCol = 'rgba(20,10,4,0.5)';
    line(c, ...c00, ...RA, 'rgba(255,240,210,0.35)', 0.7); line(c, ...c10, ...(xAxis ? RB : RA), hipCol, 0.7);
    line(c, ...c11, ...RB, hipCol, 0.6);
    if (type !== 'pyramid') ridgeCap(c, ...RA, ...RB, mat, col);
    line(c, ...c00, ...c10, 'rgba(15,8,2,0.7)', 0.9);
    if (p.finial) {
      const [fx, fy] = RA;
      c.fillStyle = '#c89226'; c.fillRect(fx - 0.4, fy - 10, 0.8, 10); c.fillRect(fx - 2.4, fy - 7.5, 4.8, 0.7);
      poly(c, [[fx, fy - 13], [fx + 4, fy - 11.5], [fx, fy - 10]], '#c89226');
    }
  } else if (type === 'lean') {
    const d = downW(m, r.down || 'S');
    if (d === 'S') {
      drawGableFace(c, g, 'E', w, H, rise, p, 0.66, [], 'up');
      const s0 = P(g, X0 - ov, Y0 - ov, H);
      plane(c, s0, vsub(P(g, X0 - ov, Y1 + 0.5, H + rise), s0), vsub(P(g, X1 + ov, Y0 - ov, H), s0), mat, col, 1.05);
      line(c, ...s0, ...P(g, X1 + ov, Y0 - ov, H), 'rgba(15,8,2,0.7)', 0.9);
      line(c, ...P(g, X1 + ov, Y0 - ov, H), ...P(g, X1 + ov, Y1 + 0.5, H + rise), 'rgba(15,8,2,0.6)', 0.8);
    } else if (d === 'E') {
      drawGableFace(c, g, 'S', w, H, rise, p, 1.0, [], 'down');
      const e0 = P(g, X1 + ov, Y0 - ov, H);
      plane(c, e0, vsub(P(g, X0 - 0.5, Y0 - ov, H + rise), e0), vsub(P(g, X1 + ov, Y1 + ov, H), e0), mat, col, 0.85);
      line(c, ...P(g, X0 - 0.5, Y0 - ov, H + rise), ...e0, 'rgba(15,8,2,0.7)', 0.9);
    } else if (d === 'W') {
      drawGableFace(c, g, 'S', w, H, rise, p, 1.0, [], 'up');
      drawFace(c, g, 'E', w, H, H + rise, p, 0.66, []);
      const w0 = P(g, X0 - ov, Y0 - ov, H);
      plane(c, w0, vsub(P(g, X1 + 0.5, Y0 - ov, H + rise), w0), vsub(P(g, X0 - ov, Y1 + ov, H), w0), mat, col, 1.1);
    } else {
      drawFace(c, g, 'S', w, H, H + rise, p, 1.0, []);
      const n0 = P(g, X0 - ov, Y1 + ov, H);
      plane(c, n0, vsub(P(g, X0 - ov, Y0 - 0.5, H + rise), n0), vsub(P(g, X1 + ov, Y1 + ov, H), n0), mat, col, 1.15);
    }
  }
}

// ================= Части =================

function decorFor(m, p, w, worldFace, gable = false) {
  const lf = VISF[m.rot][worldFace];
  const src = gable ? (p.gable || {}) : (p.decor || {});
  const out = [];
  for (const d0 of (src[lf] || [])) {
    const d = { ...d0 };
    let at = d.at;
    if (d.main) at = m.doorX + (d.shift || 0) * (m.rot ? -1 : 1);
    const lp = lf === 'S' || lf === 'N' ? [at, lf === 'S' ? p.y0 : p.y1] : [lf === 'W' ? p.x0 : p.x1, at];
    const [X, Y] = toW(m, lp[0], lp[1]);
    d.u = worldFace === 'S' ? X - w.X0 : Y - w.Y0;
    d.face = worldFace;
    out.push(d);
  }
  return out;
}

function drawBoxPart(c, m, p) {
  p = gnomePart(p);
  const g = m.g, w = boxW(m, p), z0 = p.z0 || 0, H = z0 + p.h;
  if (!p.noShadow) {
    const rz = H + (p.roof ? (p.roof.rise || 18) * 0.7 : 0);
    shadowOf(g, [[w.X0, w.Y0, rz], [w.X1, w.Y0, rz], [w.X0, w.Y1, rz], [w.X1, w.Y1, rz]]);
  }
  if (p.open) {
    // открытый навес: тёмное нутро, задняя стенка, столбы
    const back = P(g, w.X0, w.Y1, H), fr = P(g, w.X0, w.Y0, 0);
    if (!p.canopy) poly(c, [P(g, w.X0, w.Y0, 0), P(g, w.X1, w.Y0, 0), P(g, w.X1, w.Y1, 0), P(g, w.X1, w.Y1, H), P(g, w.X0, w.Y1, H), P(g, w.X0, w.Y0, H)],
      lingrad(c, 0, back[1], 0, fr[1], [[0, '#100804'], [1, '#2a1a0e']]));
    else poly(c, [P(g, w.X0, w.Y0, 0), P(g, w.X1, w.Y0, 0), P(g, w.X1, w.Y1, 0), P(g, w.X0, w.Y1, 0)], 'rgba(40,25,12,0.35)');
    if (p.inside) p.inside(c, m);
    const posts = [[w.X0, w.Y0], [w.X1, w.Y0], [w.X1, w.Y1]];
    if (w.X1 - w.X0 > 30) posts.push([(w.X0 + w.X1) / 2, w.Y0]);
    if (w.Y1 - w.Y0 > 30) posts.push([w.X1, (w.Y0 + w.Y1) / 2]);
    for (const [X, Y] of posts) {
      const a = P(g, X, Y, 0), b = P(g, X, Y, H);
      if (BUILD_ERA === 3 && p.canopy) { palaceColumn(c, a[0], a[1], b[1]); continue; }   // навес-портик: колонны вместо столбов
      c.fillStyle = lingrad(c, a[0] - 1.3, 0, a[0] + 1.3, 0, [[0, '#9a6a38'], [1, '#3e2410']]);
      c.fillRect(a[0] - 1.3, b[1], 2.6, a[1] - b[1]);
    }
    c.fillStyle = '#4a2c14';
    poly(c, [P(g, w.X0, w.Y0, H), P(g, w.X1, w.Y0, H), P(g, w.X1, w.Y0, H - 2), P(g, w.X0, w.Y0, H - 2)], '#4a2c14');
  } else {
    drawFace(c, g, 'E', w, z0, H, p, 0.66, decorFor(m, p, w, 'E'));
    drawFace(c, g, 'S', w, z0, H, p, 1.0, decorFor(m, p, w, 'S'));
  }
  drawRoof(c, m, p, w, H, { S: decorFor(m, p, w, 'S', true), E: decorFor(m, p, w, 'E', true) });
  thatchFringe(c, m, p, w, H);
  // столб с вывеской — отдельно перед фасадом, сбоку от входа
  const md = (p.decor && p.decor.S || []).find(d => d.t === 'door' && d.main);
  if (md && m.sign && !m.signPlaced) {
    m.signPlaced = true;
    const dc = m.doorX + (md.shift || 0), half = (md.w || 10) / 2;
    // в ту сторону, где больше места по фасаду
    const side = dc + half + 26 < m.LW ? 1 : -1;
    const lx = dc + side * (half + 11), ly = p.y0 - 5;
    const [sx, sy] = PL(m, lx, ly, 0);
    // при повороте входом вбок «дальше от двери» на экране — это вверх-вправо; кронштейн смотрим наружу
    SIGN_QUEUE.list.push({ x: sx, y: sy, kind: m.sign, dir: m.rot ? 1 : side });
  }
  // трубы
  for (const ch of (p.chimneys || [])) {
    const [X, Y] = toW(m, ch.x, ch.y);
    const cw = ch.w || 5, zb = roofZ(m, p, w, H, X + cw / 2, Y + cw / 2) - 1, zt = zb + ch.h;
    const cwB = { X0: X, X1: X + cw, Y0: Y, Y1: Y + cw };
    // гномьи трубы — бутовый камень, у белёных коттеджей — красный кирпич, как на референсах
    const spec = p.cottage ? { wall: 'brick', col: '#a8442c', noPlinth: true } : { wall: 'fieldstone', col: '#8e8a78', noPlinth: true };
    drawFace(c, g, 'E', cwB, zb, zt, spec, 0.66, []);
    drawFace(c, g, 'S', cwB, zb, zt, spec, 1.0, []);
    poly(c, [P(g, X - 0.6, Y - 0.6, zt), P(g, X + cw + 0.6, Y - 0.6, zt), P(g, X + cw + 0.6, Y + cw + 0.6, zt), P(g, X - 0.6, Y + cw + 0.6, zt)], '#4a4440', 'rgba(15,10,6,0.7)', 0.5);
    poly(c, [P(g, X + 0.8, Y + 0.8, zt), P(g, X + cw - 0.8, Y + 0.8, zt), P(g, X + cw - 0.8, Y + cw - 0.8, zt), P(g, X + 0.8, Y + cw - 0.8, zt)], '#100c0a');
    const sp = P(g, X + cw / 2, Y + cw / 2, zt + 1);
    (g.spr.chimneys = g.spr.chimneys || []).push(sp);
  }
  // слуховые окна на переднем скате
  for (const dm of (p.dormers || [])) {
    const hd = (p.y1 - p.y0) / 2, rise = p.roof.rise;
    const yd = p.y0 + hd * 0.22;
    const zr = H + rise * ((yd - p.y0) / hd);
    drawBoxPart(c, m, {
      x0: dm.x - dm.w / 2, x1: dm.x + dm.w / 2, y0: yd, y1: p.y0 + hd * 0.95, z0: zr - 1.5, h: dm.h,
      wall: p.cottage ? 'plaster' : 'plank', col: p.cottage ? p.col : '#7a5030', frame: !!p.cottage, noPlinth: true, noShadow: true, beam: p.beam,
      decor: { S: [dm.loft ? { t: 'loft', at: dm.x, z: 0.5, w: dm.w - 5, h: dm.h - 2.5 } : { t: 'win', at: dm.x, z: 1.5, w: dm.w - 6, h: dm.h - 4, o: dm.o || {} }] },
      roof: { type: 'gable', axis: 'Y', rise: dm.w * 0.5, mat: p.roof.mat, col: p.roof.col, ov: 1.6 }, _g: true,
    });
  }
}

function drawTowerPart(c, m, p) {
  if (BUILD_ERA !== 2) {   // эпохи: башня — деревянная под соломой / светлый камень под черепицей (цвета, форма та же)
    const h = hashStr(BUILD_TYPE + (p.x | 0));
    p = { ...p, col: BUILD_ERA === 1 ? '#8a6238' : PALACE_WALLS[h % 3] };
    if (p.roof) p.roof = { ...p.roof, col: BUILD_ERA === 1 ? STRAW[h % 3] : PALACE_TILES[h % 3] };
  }
  const g = m.g;
  const [X, Y] = toW(m, p.x, p.y);
  const r = p.r, z0 = p.z0 || 0, H = z0 + p.h;
  const N = 40;
  const ring = (rr, z) => { const a = []; for (let k = 0; k < N; k++) { const t = k / N * Math.PI * 2; a.push(P(g, X + Math.cos(t) * rr, Y + Math.sin(t) * rr, z)); } return a; };
  shadowOf(g, [[X - r, Y - r, H + 20], [X + r, Y - r, H + 20], [X - r, Y + r, H + 20], [X + r, Y + r, H + 20]]);
  const sil = hull([...ring(r, z0), ...ring(r * (p.taper || 1), H)]);
  const [bx0, by0] = [Math.min(...sil.map(q => q[0])), Math.min(...sil.map(q => q[1]))];
  const [bx1, by1] = [Math.max(...sil.map(q => q[0])), Math.max(...sil.map(q => q[1]))];
  clipPoly(c, sil, () => {
    const TR = rampOf(p.col);
    c.fillStyle = TR[5]; c.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
    // ряды камней по передней дуге; оттенок камня — по полосе света на цилиндре (4 ступени)
    for (let z = z0, row = 0; z < H; z += 4.4, row++) {
      const rr = r * (1 - (1 - (p.taper || 1)) * (z - z0) / p.h);
      let k = 0;
      for (let t = Math.PI * 0.95 + (row % 2) * 0.12; t < Math.PI * 2.05; t += 0.24, k++) {
        const a = P(g, X + Math.cos(t) * rr, Y + Math.sin(t) * rr, z + 4.1);
        const b = P(g, X + Math.cos(t + 0.22) * rr, Y + Math.sin(t + 0.22) * rr, z + 0.3);
        const u = ((a[0] + b[0]) / 2 - bx0) / (bx1 - bx0);
        const band = u < 0.2 ? 1 : u < 0.5 ? 2 : u < 0.78 ? 3 : 4;
        const n = hsh(k, row, 44), vr = n < 0.18 ? -1 : n > 0.86 ? 1 : 0;
        rrect(c, Math.min(a[0], b[0]), a[1], Math.abs(b[0] - a[0]) + 0.4, b[1] - a[1], 0.8);
        c.fillStyle = TR[Math.max(0, Math.min(5, band + vr))]; c.fill();
        c.fillStyle = TR[Math.max(0, band - 2)]; c.fillRect(Math.min(a[0], b[0]) + 0.6, a[1] + 0.2, Math.abs(b[0] - a[0]) - 1, PXU);
      }
    }
    c.fillStyle = 'rgba(40,25,10,0.3)'; c.fillRect(bx0, by1 - 3, bx1 - bx0, 3);
  });
  poly(c, sil, null, 'rgba(20,10,4,0.65)', 0.6);
  // украшения на стене башни: угол a в градусах от фасада (0 — юг, 90 — восток)
  for (const d of (p.decor || [])) {
    const a = ((d.a || 0) + (m.rot ? 90 : 0)) * Math.PI / 180;
    const rr = r * (1 - (1 - (p.taper || 1)) * (d.z || 0) / p.h);
    const [sx, sy] = P(g, X + Math.sin(a) * rr, Y - Math.cos(a) * rr, (d.z || 0));
    const sq = Math.max(0.35, Math.cos(a - 0.4));
    c.save(); c.translate(sx, sy); c.scale(sq, 1);
    if (d.t === 'door') door(c, 0, 0, d.w || 9, d.h || 15, d.o || {});
    else if (d.t === 'win') win(c, -(d.w || 6) / 2, -(d.h || 8), d.w || 6, d.h || 8, d.o || {});
    c.restore();
  }
  if (p.gallery) {
    const gz = p.gallery;
    const pts = []; for (let k = 0; k <= 20; k++) { const t = Math.PI + k / 20 * Math.PI; pts.push(P(g, X + Math.cos(t) * (r + 3), Y + Math.sin(t) * (r + 3), gz)); }
    c.strokeStyle = '#4a2c14'; c.lineWidth = 1.6; c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(...q) : c.moveTo(...q)); c.stroke();
    for (let k = 0; k <= 20; k += 2) { const q = pts[k]; line(c, q[0], q[1], q[0], q[1] - 4.5, '#5a3a1e', 0.6); }
    c.strokeStyle = '#6e4a2a'; c.lineWidth = 0.7; c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q[0], q[1] - 4.5) : c.moveTo(q[0], q[1] - 4.5)); c.stroke();
  }
  // коническая крыша
  if (p.roof) {
    const rr = r * (p.taper || 1) + (p.roof.ov ?? 4), apex = P(g, X, Y, H + p.roof.h);
    const base = ring(rr, H - 1.5);
    const cone = hull([...base, apex]);
    clipPoly(c, cone, () => {
      // конус: клинья четырёх ступеней света (свет слева), ряды черепицы — тонкие дуги
      const CR = rampOf(p.roof.col);
      for (let k = 0; k < N; k++) {
        const q = base[k], t = k / N * Math.PI * 2;
        const lit = 0.5 - Math.cos(t + 0.5) * 0.5;
        const idx = lit > 0.8 ? 1 : lit > 0.55 ? 2 : lit > 0.3 ? 3 : 4;
        c.strokeStyle = CR[idx + (k % 5 === 0 ? 1 : 0)]; c.lineWidth = 3.6;
        c.beginPath(); c.moveTo(...apex); c.lineTo(...q); c.stroke();
      }
      for (let f = 0.15; f < 1; f += 0.09) {
        c.strokeStyle = CR[5]; c.lineWidth = 0.45;
        c.beginPath();
        for (let k = N / 2 - 2; k <= N; k++) { const q = base[k % N]; const x = apex[0] + (q[0] - apex[0]) * f, y = apex[1] + (q[1] - apex[1]) * f; k === N / 2 - 2 ? c.moveTo(x, y) : c.lineTo(x, y); }
        c.stroke();
        c.strokeStyle = CR[1]; c.lineWidth = PXU;
        c.beginPath();
        for (let k = N / 2 - 2; k <= N * 0.72; k++) { const q = base[k % N]; const x = apex[0] + (q[0] - apex[0]) * (f - 0.012), y = apex[1] + (q[1] - apex[1]) * (f - 0.012); k === N / 2 - 2 ? c.moveTo(x, y) : c.lineTo(x, y); }
        c.stroke();
      }
    });
    poly(c, cone, null, 'rgba(15,8,4,0.7)', 0.7);
    if (p.finial === 'crystal') crystal(c, apex[0], apex[1] + 1, 0.9);
    else if (p.finial) { c.fillStyle = '#c89226'; c.fillRect(apex[0] - 0.4, apex[1] - 8, 0.8, 8); ellipse(c, apex[0], apex[1] - 8, 1.2, 1.2, '#f6d458'); }
  }
}

function drawFence(c, m, pts, h = 6) {
  const g = m.g;
  for (let s = 0; s < pts.length - 1; s++) {
    const [a, b] = [pts[s], pts[s + 1]];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(len / 5));
    const rail = z => { const p0 = PL(m, a[0], a[1], z), p1 = PL(m, b[0], b[1], z); line(c, ...p0, ...p1, '#6e4a2c', 0.9); line(c, p0[0], p0[1] - 0.3, p1[0], p1[1] - 0.3, 'rgba(255,230,190,0.3)', 0.3); };
    rail(h * 0.35); rail(h * 0.75);
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
      const q = PL(m, x, y, 0);
      c.fillStyle = '#4a2c14'; c.fillRect(q[0] - 0.65, q[1] - h, 1.3, h + 0.5);
      c.fillStyle = '#8a6040'; c.fillRect(q[0] - 0.65, q[1] - h, 0.45, h + 0.5);
    }
  }
}

// ================= Конструктор модели =================

function newModel(g) {
  const m = { g, rot: g.rot, LW: g.LW, LD: g.LD, doorX: g.doorLX, parts: [], sign: SIGN_OF[g.type] };
  const key = (x, y) => toW(m, x, y)[1];
  m.box = o => m.parts.push({ kind: 'box', p: o, key: Math.min(key(o.x0, o.y0), key(o.x1, o.y0), key(o.x0, o.y1)), kx: toW(m, o.x0, o.y0)[0] });
  m.tower = o => m.parts.push({ kind: 'tower', p: o, key: key(o.x, o.y) - o.r, kx: toW(m, o.x, o.y)[0] });
  m.prop = (fn, x, y) => m.parts.push({ kind: 'prop', fn, x, y, key: key(x, y) - 0.01, kx: toW(m, x, y)[0] });
  m.fence = (pts, h) => m.parts.push({ kind: 'fence', pts, h, key: Math.min(...pts.map(q => key(q[0], q[1]))) - 0.02, kx: 0 });
  m.ground = fn => m.parts.push({ kind: 'ground', fn, key: 1e9, kx: 0 });
  m.custom = (fn, x = 0, y = 0) => m.parts.push({ kind: 'custom', fn, key: key(x, y), kx: toW(m, x, y)[0] });
  // локальная точка на земле -> экран
  m.at = (x, y, z = 0) => PL(m, x, y, z);
  return m;
}

function renderModel(c, m) {
  m.parts.sort((a, b) => b.key - a.key || a.kx - b.kx);
  for (const part of m.parts) {
    if (part.kind === 'ground' || part.kind === 'custom') part.fn(c, m);
    else if (part.kind === 'box') drawBoxPart(c, m, part.p);
    else if (part.kind === 'tower') drawTowerPart(c, m, part.p);
    else if (part.kind === 'fence') drawFence(c, m, part.pts, part.h);
    else if (part.kind === 'prop') { const [sx, sy] = PL(m, part.x, part.y); part.fn(c, sx, sy); }
  }
}

// Пятно земли по локальному многоугольнику
function groundPoly(c, m, pts, fill) { poly(c, pts.map(q => PL(m, q[0], q[1], 0)), fill); }

// ================= Модели зданий =================

const PLASTER = '#e8dcc0', BEAM = '#4a2c16', TERRA = '#b05a32';

const MODELS = {
  storehouse(m) {
    // главный амбар с воротами, люк сеновала и подъёмник
    m.box({
      x0: 36, x1: 124, y0: 8, y1: 64, h: 34, wall: 'plaster', col: '#e6d8b8', frame: true, lowerStone: 10, beam: BEAM,
      roof: { type: 'gable', axis: 'X', rise: 30, mat: 'tiles', col: TERRA, ov: 5 },
      decor: {
        // широкие ворота на две створки — по одной на каждую клетку входа
        S: [{ t: 'door', main: true, shift: -16, w: 40, h: 26, o: { double: true, braces: true, square: true, col: '#7a4a24' } },
          { t: 'win', at: 110, z: 15, w: 6, h: 8, o: { shutter: '#5a3a1e' } },
          { t: 'lantern', at: 96, z: 24 }],
        E: [{ t: 'win', at: 22, z: 15, w: 6, h: 8 }, { t: 'win', at: 48, z: 15, w: 6, h: 8 }],
        W: [{ t: 'win', at: 24, z: 15, w: 6, h: 8 }, { t: 'win', at: 48, z: 15, w: 6, h: 8 }],
      },
      gable: { E: [{ t: 'win', at: 36, z: 5, w: 6, h: 7, o: { arch: true } }] },
      dormers: [{ x: 80, w: 17, h: 12, loft: true }],
    });
    // Г-образное крыло
    m.box({
      x0: 2, x1: 38, y0: 36, y1: 92, h: 28, wall: 'plaster', col: '#e2d4b4', frame: true, lowerStone: 8, beam: BEAM,
      roof: { type: 'gable', axis: 'Y', rise: 22, mat: 'tiles', col: '#a8522e', ov: 4 },
      decor: { S: [{ t: 'win', at: 20, z: 10, w: 7, h: 8, o: { shutter: '#3e5a7a', flowers: true } }], W: [{ t: 'win', at: 64, z: 10, w: 6, h: 8 }], E: [{ t: 'win', at: 70, z: 10 }] },
      gable: { S: [{ t: 'win', at: 20, z: 5, w: 5, h: 6, o: { arch: true } }] },
      chimneys: [{ x: 26, y: 70, h: 12, kind: 'stone', w: 5 }],
    });
    // открытый навес с ящиками
    m.box({
      x0: 4, x1: 36, y0: 8, y1: 34, h: 20, open: true,
      roof: { type: 'lean', down: 'S', rise: 8, mat: 'shingle', col: '#7a5434', ov: 3 },
      inside: (c, mm) => { const a = mm.at(10, 24); crate(c, a[0], a[1], 8, '#8a6030'); const b = mm.at(20, 26); barrel(c, b[0], b[1], 0.9); const d = mm.at(28, 20); sack(c, d[0], d[1]); },
    });
    m.prop((c, x, y) => barrel(c, x, y), 64, 4);
    m.prop((c, x, y) => barrel(c, x, y, 0.85), 70, 2);
    m.prop((c, x, y) => crate(c, x, y, 7), 100, 3);
    m.prop((c, x, y) => crate(c, x, y, 6), 108, 1);
    m.prop((c, x, y) => sack(c, x, y, '#c8b890'), 118, 2);
    m.prop((c, x, y) => sack(c, x, y), 14, 4);
    m.prop((c, x, y) => cart(c, x - 8, y, '#d8c8a0'), 22, -6);
    // склад вросся в скалу: валуны по бокам и за спиной, знамёна у ворот
    dwarfRocks(m, [[16, 94, 13, 10], [118, 86, 12, 9], [78, 92, 12, 9]]);
    m.prop((c, x, y) => hoistCrane(c, x, y), 128, 6);                                   // подъёмная стрела с ящиком — сразу видно: склад
    m.prop((c, x, y) => { crate(c, x, y, 8, '#8a6030'); crate(c, x + 9, y + 1, 7); crate(c, x + 4, y - 7, 6.5); }, 46, -3);
    m.prop((c, x, y) => { sack(c, x, y, '#c8b890'); sack(c, x + 6, y + 1); sack(c, x + 3, y - 5, '#d8c8a0'); }, 108, -3);
  },

  school(m) {
    m.box({
      x0: 4, x1: 74, y0: 10, y1: 68, h: 50, wall: 'plaster', col: '#ece2c6', frame: true, floors: 2, lowerStone: 6, beam: BEAM,
      roof: { type: 'gable', axis: 'X', rise: 26, mat: 'slate', col: '#56606e', ov: 5 },
      decor: {
        S: [{ t: 'door', main: true, w: 12, h: 19, o: { frame: 'stone' } },
          { t: 'win', at: 18, z: 8, w: 7, h: 10, o: { shutter: '#3e6a8a', flowers: true } }, { t: 'win', at: 64, z: 8, w: 7, h: 10, o: { shutter: '#3e6a8a', flowers: true } },
          { t: 'win', at: 18, z: 31, w: 7, h: 9, o: { shutter: '#3e6a8a' } }, { t: 'win', at: 40, z: 31, w: 7, h: 9, o: { shutter: '#3e6a8a' } }, { t: 'win', at: 62, z: 31, w: 7, h: 9, o: { shutter: '#3e6a8a' } },
          { t: 'sign', at: 30, z: 23, kind: 'book' }],
        E: [{ t: 'win', at: 24, z: 8, w: 7, h: 10 }, { t: 'win', at: 48, z: 8, w: 7, h: 10 }, { t: 'win', at: 24, z: 31, w: 7, h: 9 }, { t: 'win', at: 48, z: 31, w: 7, h: 9 }],
        W: [{ t: 'win', at: 24, z: 8, w: 7, h: 10 }, { t: 'win', at: 48, z: 31, w: 7, h: 9 }],
      },
      gable: { E: [{ t: 'win', at: 39, z: 6, w: 6, h: 7, o: { arch: true } }] },
      dormers: [{ x: 40, w: 13, h: 9 }],
      chimneys: [{ x: 10, y: 50, h: 12, kind: 'brick' }],
    });
    // каменная колокольня
    m.box({
      x0: 72, x1: 94, y0: 22, y1: 46, h: 74, wall: 'stone', col: '#b4aa9a', finial: true,
      roof: { type: 'pyramid', rise: 24, mat: 'slate', col: '#56606e', ov: 3 },
      decor: {
        S: [{ t: 'louver', at: 83, z: 58, w: 9, h: 12, bell: true }, { t: 'clock', at: 83, z: 46 }, { t: 'win', at: 83, z: 24, w: 4, h: 9, o: { arch: true, stone: true } }],
        E: [{ t: 'louver', at: 34, z: 58, w: 9, h: 12, bell: true }, { t: 'win', at: 34, z: 30, w: 4, h: 9, o: { arch: true, stone: true } }],
        W: [{ t: 'louver', at: 34, z: 58, w: 9, h: 12, bell: true }],
      },
    });
    // крыльцо под навесом
    m.box({ x0: 36, x1: 60, y0: 2, y1: 10, h: 21, open: true, canopy: true, noShadow: true, roof: { type: 'lean', down: 'S', rise: 6, mat: 'slate', col: '#56606e', ov: 2 } });
    m.prop((c, x, y) => bench(c, x, y, 14), 8, 2);
    m.prop((c, x, y) => bench(c, x, y, 14), 62, 2);
    m.fence([[0, -2], [0, 30]]);
  },

  inn(m) {
    m.box({
      x0: 6, x1: 98, y0: 12, y1: 64, h: 46, wall: 'plaster', col: '#efe2c2', frame: true, lowerStone: 20, beam: BEAM,
      roof: { type: 'gable', axis: 'X', rise: 30, mat: 'tiles', col: '#b8582e', ov: 6 },
      decor: {
        S: [{ t: 'door', main: true, shift: -16, w: 36, h: 22, o: { frame: 'stone', double: true } },
          { t: 'win', at: 18, z: 6, w: 8, h: 9, o: { lit: true, stone: true } }, { t: 'win', at: 38, z: 6, w: 8, h: 9, o: { lit: true, stone: true } }, { t: 'win', at: 92, z: 6, w: 8, h: 9, o: { lit: true, stone: true } },
          { t: 'win', at: 18, z: 28, w: 8, h: 9, o: { lit: true, shutter: '#6a2a1a', flowers: true } }, { t: 'win', at: 40, z: 28, w: 8, h: 9, o: { lit: true, shutter: '#6a2a1a', flowers: true } },
          { t: 'win', at: 62, z: 28, w: 8, h: 9, o: { lit: true, shutter: '#6a2a1a' } }, { t: 'win', at: 88, z: 28, w: 8, h: 9, o: { lit: true, shutter: '#6a2a1a' } },
          { t: 'sign', at: 62, z: 24, kind: 'mug' }, { t: 'lantern', at: 88, z: 21 }],
        E: [{ t: 'win', at: 26, z: 6, w: 7, h: 9, o: { lit: true, stone: true } }, { t: 'win', at: 26, z: 28, w: 7, h: 9, o: { lit: true } }, { t: 'win', at: 50, z: 28, w: 7, h: 9, o: { lit: true } }],
        W: [{ t: 'win', at: 26, z: 28, w: 7, h: 9, o: { lit: true } }, { t: 'win', at: 50, z: 6, w: 7, h: 9, o: { lit: true, stone: true } }],
      },
      gable: { E: [{ t: 'win', at: 38, z: 6, w: 6, h: 7, o: { lit: true, arch: true } }] },
      dormers: [{ x: 26, w: 13, h: 10, o: { lit: true } }, { x: 52, w: 13, h: 10, o: { lit: true } }],
      chimneys: [{ x: 14, y: 52, h: 16, kind: 'stone', w: 6 }, { x: 86, y: 30, h: 13, kind: 'brick', w: 5 }],
    });
    // боковое крыло: открытый первый этаж (веранда, сбоку печь), на втором — бар, где хозяйничает бармен
    m.box({
      x0: 96, x1: 126, y0: 22, y1: 92, h: 20, open: true, noShadow: true,
      inside: (c, mm) => innOven(c, ...mm.at(119, 56)),
    });
    m.box({
      x0: 96, x1: 126, y0: 22, y1: 92, z0: 20, h: 22, wall: 'plaster', col: '#eadcb8', frame: true, beam: BEAM,
      roof: { type: 'gable', axis: 'Y', rise: 22, mat: 'tiles', col: '#ac522c', ov: 4 },
      decor: { S: [{ t: 'win', at: 111, z: 5, w: 10, h: 11, o: { lit: true, shutter: '#6a2a1a', flowers: true } }],
        E: [{ t: 'win', at: 38, z: 5, w: 10, h: 11, o: { lit: true, shutter: '#6a2a1a', flowers: true } }, { t: 'win', at: 70, z: 5, w: 7, h: 9, o: { lit: true } }], W: [] },
      gable: { S: [{ t: 'win', at: 111, z: 3, w: 5, h: 6, o: { arch: true, lit: true } }] },
      chimneys: [{ x: 108, y: 76, h: 10, kind: 'brick' }],
    });
    // веранда перед открытым этажом — строго в пределах участка, дорогу не трогает
    m.g.spr.porch = m.at(111, 10);   // здесь рисуется стол с обедающими (inside.js)
    m.g.spr.oven = m.at(119, 56, 5);          // печь: огонь в топке (inside.js)
    if (!m.rot) m.g.spr.bar = m.at(52, 17.72, 57.25);   // окно мансарды — здесь хозяйничает бармен (рисует inside.js)
    // веранда под навесом у входа
    m.box({ x0: 8, x1: 46, y0: 4, y1: 12, h: 22, open: true, canopy: true, noShadow: true, roof: { type: 'lean', down: 'S', rise: 6, mat: 'shingle', col: '#7a5434', ov: 2 } });
    // полукруглые ступени у входа
    m.prop((c, x, y) => { for (let k = 2; k >= 0; k--) { ellipse(c, x, y + 1 + k * 0.6, 9 - k * 2, 3.4 - k * 0.8, shade('#a49c90', -k * 0.08)); ellipse(c, x, y + 0.4 + k * 0.6, 9 - k * 2, 3 - k * 0.8, shade('#c8bfb2', -k * 0.08)); } }, m.doorX - 16, 11);
    m.g.spr.doorPt = m.at(m.doorX, 10);
    m.prop((c, x, y) => barrel(c, x, y), 3, 20);
    m.prop((c, x, y) => barrel(c, x, y, 0.8), 3, 11);
    m.prop((c, x, y) => crate(c, x, y, 6), 3, 3);
    m.prop((c, x, y) => innMugSign(c, x, y), 92, 4);                                    // огромная кружка на кронштейне — вывеска трактира
    m.prop((c, x, y) => { for (const k of [0, 1, 2]) { c.fillStyle = k % 2 ? '#f0e6d0' : '#b8442a'; c.fillRect(x - 15 + k * 10, y - 1, 10, 4); } }, m.doorX, 1);   // полосатый коврик у двери
  },

  woodcutter(m) {
    // дом лесоруба — в огромном старом пне, как на референсе
    // ручной пиксель-арт накладывается поверх уже готового спрайта (см. buildingSprite)
    m.custom(c => {
      // ровно по центру участка (а не по косой проекции, как у прямоугольных домов)
      const x = Math.round(m.g.fx + m.g.fw / 2), y = Math.round(m.g.fy + m.g.fh - 6);
      shadowAt(c, x + 6, y + 4, 30, 9);
      m.g.spr.handArt = { art: woodcutterArt, x, y, ax: WC_AX, ay: WC_AY };
      if (m.sign) SIGN_QUEUE.list.push({ x: x - 34, y: y + 4, kind: m.sign, dir: -1 });   // вывеска слева, дверь справа
      (m.g.spr.chimneys = m.g.spr.chimneys || []).push([x + 10, y - 62]);
    }, 40, 12);
    m.prop((c, x, y) => logPile(c, x, y, 2, 9), 60, 2);
  },

  sawmill(m) {
    m.box({
      x0: 30, x1: 72, y0: 8, y1: 52, h: 26, wall: 'plaster', col: '#e2d2aa', frame: true, beam: BEAM,
      roof: { type: 'gable', axis: 'Y', rise: 20, mat: 'tiles', col: '#a0482e', ov: 4 },
      decor: { S: [{ t: 'door', main: true, w: 10, h: 16, o: { square: true } }, { t: 'win', at: 63, z: 10, w: 6, h: 7, o: { shutter: '#5a3a1e' } }], E: [{ t: 'win', at: 30, z: 10, w: 6, h: 7 }], W: [{ t: 'win', at: 30, z: 10 }] },
      gable: { S: [{ t: 'win', at: 51, z: 6, w: 5, h: 6 }] },
    });
    m.box({
      x0: 0, x1: 30, y0: 6, y1: 44, h: 22, open: true,
      roof: { type: 'lean', down: 'S', rise: 8, mat: 'shingle', col: '#7a5434', ov: 3 },
      inside: (c, mm) => { const a = mm.at(6, 22); sawHorse(c, a[0], a[1], true); },
    });
    m.prop((c, x, y) => logPile(c, x, y, 3, 12), 80, 18);
    m.prop((c, x, y) => plankStack(c, x, y, 20, 6), 74, 2);
    m.prop((c, x, y) => { ellipse(c, x, y, 7, 2.2, '#d8b070'); ellipse(c, x - 1, y - 0.4, 4, 1.2, '#ecca88'); }, 14, 2);
  },

  quarry(m) {
    // ручной пиксель-арт (pixelart3.js): скальный уступ, журавль-кран, каменная сторожка
    m.custom(c => {
      const g = m.g, x = Math.round(g.fx + g.fw / 2), y = Math.round(g.fy + g.fh - 6);
      shadowAt(c, x + 6, y + 4, 38, 9);
      g.spr.handArt = { art: quarryArt, x, y, ax: QR_AX, ay: QR_AY };
      g.spr.chimneys = [[x - QR_AX + 58, y - QR_AY + 24]];
    }, 32, 10);
  },

  goldmine(m) { m.custom(c => drawMineBody(c, m.g, false), 0, 60); },
  crystalmine(m) { m.custom(c => drawMineBody(c, m.g, true), 0, 60); },

  metallurgist(m) {
    m.box({
      x0: 2, x1: 58, y0: 10, y1: 52, h: 28, wall: 'stone', col: '#968e82',
      roof: { type: 'gable', axis: 'X', rise: 20, mat: 'slate', col: '#3e4248', ov: 4 },
      decor: { S: [{ t: 'door', main: true, w: 10, h: 17, o: { frame: 'stone' } }, { t: 'win', at: 16, z: 10, w: 7, h: 8, o: { lit: true, stone: true } }], E: [], W: [{ t: 'win', at: 30, z: 10, w: 6, h: 8, o: { stone: true } }] },
      gable: { E: [{ t: 'win', at: 31, z: 5, w: 5, h: 6, o: { arch: true } }] },
    });
    m.box({
      x0: 58, x1: 92, y0: 12, y1: 46, h: 32, wall: 'stone', col: '#857e72',
      roof: { type: 'lean', down: 'S', rise: 10, mat: 'slate', col: '#3e4248', ov: 3 },
      decor: { S: [{ t: 'forge', at: 75, z: 0, w: 14, h: 16 }], E: [{ t: 'win', at: 29, z: 12, w: 5, h: 7, o: { lit: true } }], W: [] },
      chimneys: [{ x: 70, y: 32, h: 36, kind: 'stone', w: 9 }],
    });
    m.g.spr.glow = PL(m, 75, 12, 5);
    m.prop((c, x, y) => anvil(c, x, y), 30, 2);
    m.prop((c, x, y) => logPile(c, x, y, 2, 9), 2, 2);
    m.prop((c, x, y) => { poly(c, [[x, y - 2], [x + 10, y - 5], [x + 10, y + 1]], '#6e4a2a', '#2e1a0a', 0.5); }, 90, 6);
    m.prop((c, x, y) => { for (let k = 0; k < 3; k++) { c.fillStyle = k % 2 ? '#c89226' : '#f6d458'; c.fillRect(x + k * 3.2, y - 1.6, 2.8, 1.6); } }, 46, 2);
  },

  farm(m) {
    m.box({
      x0: 46, x1: 118, y0: 6, y1: 82, h: 32, wall: 'plank', col: '#9a3e2a', beam: '#3a2414',
      roof: { type: 'gable', axis: 'Y', rise: 32, mat: 'thatch', col: '#c09a48', ov: 5 }, gableWall: 'plank', gableCol: '#8e3826',
      decor: {
        S: [{ t: 'door', main: true, w: 24, h: 25, o: { double: true, braces: true, square: true, col: '#8e3a26' } }],
        E: [{ t: 'win', at: 28, z: 14, w: 6, h: 6 }, { t: 'win', at: 56, z: 14, w: 6, h: 6 }], W: [{ t: 'win', at: 40, z: 14, w: 6, h: 6 }],
      },
      gable: { S: [{ t: 'loft', at: 82, z: 6, w: 13, h: 11 }] },
    });
    m.box({
      x0: 2, x1: 44, y0: 26, y1: 70, h: 24, wall: 'plaster', col: '#ecdcb6', frame: true, beam: BEAM,
      roof: { type: 'gable', axis: 'X', rise: 17, mat: 'thatch', col: '#b8913e', ov: 4 },
      decor: { S: [{ t: 'door', at: 14, w: 7, h: 13, o: { square: true } }, { t: 'win', at: 31, z: 9, w: 7, h: 7, o: { shutter: '#3e6a3a', flowers: true } }], E: [{ t: 'win', at: 22, z: 9, w: 6, h: 7 }], W: [{ t: 'win', at: 22, z: 9 }] },
      chimneys: [{ x: 32, y: 50, h: 10, kind: 'stone', w: 4 }],
    });
    m.prop((c, x, y) => hayBale(c, x, y), 124, 30);
    m.prop((c, x, y) => hayBale(c, x, y, 0.8), 128, 18);
    m.prop((c, x, y) => well(c, x, y), 22, 6);
    m.prop((c, x, y) => cart(c, x, y, '#e6c24a'), 100, -4);
    m.prop((c, x, y) => hen(c, x, y), 50, 0); m.prop((c, x, y) => hen(c, x, y, '#a86a3a'), 56, -2); m.prop((c, x, y) => hen(c, x, y), 40, -1);
    m.fence([[0, 22], [0, -2], [12, -2]]);
  },

  mill(m) {
    // мельница нарисована вручную по пикселям (pixelart.js), крылья — готовыми кадрами
    m.custom(c => {
      const x = Math.round(m.g.fx + m.g.fw / 2), y = Math.round(m.g.fy + m.g.fh - 4);
      shadowAt(c, x + 8, y + 3, 24, 7);
      m.g.spr.handArt = { art: millArt, x, y, ax: MILL_AX, ay: MILL_AY };
      m.g.spr.hub = [x - MILL_AX + MILL_HUB[0], y - MILL_AY + MILL_HUB[1]];
      if (m.sign) SIGN_QUEUE.list.push({ x: x - 26, y: y + 4, kind: m.sign, dir: -1 });
    }, 32, 12);
    m.prop((c, x, y) => cart(c, x, y, '#e6c24a'), 58, -6);
  },

  bakery(m) {
    // гномья пекарня в духе Оплота: каменный дом в скале, печь-купол сбоку
    m.custom(c => {
      const g = m.g, x = Math.round(g.fx + g.fw / 2), y = Math.round(g.fy + g.fh - 6);
      shadowAt(c, x + 6, y + 4, 36, 10);
      g.spr.handArt = { art: bakeryArt, x, y, ax: BK_AX, ay: BK_AY };
      g.spr.chimneys = [[x - BK_AX + 53, y - BK_AY + 1], [x - BK_AX + 88, y - BK_AY + 50]];
      g.spr.glow = [x - BK_AX + BK_OVEN[0], y - BK_AY + BK_OVEN[1] - 5];
      if (m.sign) SIGN_QUEUE.list.push({ x: x - 30, y: y + 2, kind: m.sign, dir: -1 });
    }, 32, 12);
  },

  swine(m) {
    if (m.rot) { swineSide(m); return; }
    // хлев вдоль задней стороны
    m.box({
      x0: 6, x1: 122, y0: 58, y1: 92, h: 20, wall: 'plank', col: '#7a5434', beam: '#3a2414',
      roof: { type: 'gable', axis: 'X', rise: 15, mat: 'thatch', col: '#a8883e', ov: 4 },
      decor: { S: [{ t: 'hatch', at: 30, z: 2, w: 10, h: 10 }, { t: 'hatch', at: 64, z: 2, w: 10, h: 10 }, { t: 'hatch', at: 98, z: 2, w: 10, h: 10 }], E: [{ t: 'hatch', at: 75, z: 4, w: 8, h: 8 }], W: [] },
    });
    // загон: грязь, лужи, кормушки
    m.ground((c, mm) => {
      groundPoly(c, mm, [[2, 2], [126, 2], [126, 58], [2, 58]], '#6a4a2a');
      for (let k = 0; k < 50; k++) { const q = mm.at(rnd(6, 122), rnd(4, 56)); ellipse(c, q[0], q[1], rnd(1.5, 5), rnd(1, 2.5), srand() < 0.5 ? '#553a20' : '#866038'); }
      for (const [x, y] of [[24, 14], [96, 40]]) { const q = mm.at(x, y); ellipse(c, q[0], q[1], 9, 3, '#3e3026'); ellipse(c, q[0] - 1, q[1] - 0.8, 5, 1.2, 'rgba(160,190,210,0.55)'); }
    });
    m.prop((c, x, y) => trough(c, x, y, 18, '#b8b060'), 44, 40);
    m.prop((c, x, y) => trough(c, x, y, 14, '#c8c070'), 86, 16);
    m.prop((c, x, y) => hayBale(c, x, y), 124, 62);
    const gx = m.doorX;
    m.fence([[2, 58], [2, 2], [gx - 8, 2]]);
    m.fence([[gx + 8, 2], [126, 2], [126, 58]]);
    m.prop((c, x, y) => { c.fillStyle = '#6e4a2c'; c.fillRect(x - 8, y - 5, 16, 1); c.fillRect(x - 8, y - 2.5, 16, 1); line(c, x - 8, y - 1, x + 8, y - 5, '#6e4a2c', 0.8); }, gx, 2);
    const cs = [[8, 8], [120, 8], [120, 54], [8, 54]].map(q => PL(m, q[0], q[1]));
    m.g.spr.pen = [Math.min(...cs.map(q => q[0])), Math.min(...cs.map(q => q[1])), Math.max(...cs.map(q => q[0])), Math.max(...cs.map(q => q[1]))];
    m.g.spr.penQuad = [PL(m, 8, 8), PL(m, 120, 8), PL(m, 8, 54)];
  },

  butchery(m) {
    m.box({
      x0: 22, x1: 62, y0: 12, y1: 52, h: 28, wall: 'plaster', col: '#e8dcc0', frame: true, beam: BEAM,
      roof: { type: 'gable', axis: 'Y', rise: 19, mat: 'tiles', col: '#8c3a2a', ov: 4 },
      decor: { S: [{ t: 'door', main: true, w: 9, h: 16, o: { square: true } }, { t: 'win', at: 31, z: 10, w: 7, h: 8, o: { shutter: '#6a2a1a' } }, { t: 'sign', at: 30, z: 22, kind: 'ham' }], E: [{ t: 'win', at: 30, z: 10, w: 6, h: 8 }], W: [] },
      gable: { S: [{ t: 'win', at: 42, z: 5, w: 5, h: 6 }] },
    });
    m.box({
      x0: 0, x1: 22, y0: 10, y1: 34, h: 22, open: true,
      roof: { type: 'lean', down: 'S', rise: 6, mat: 'shingle', col: '#6a4a2a', ov: 3 },
      inside: (c, mm) => { const a = mm.at(2, 16, 19), b = mm.at(20, 16, 19); line(c, a[0], a[1], b[0], b[1], '#4a2c14', 1); for (let k = 0; k < 3; k++) { const q = mm.at(5 + k * 6, 16, 19); hangingMeat(c, q[0], q[1]); } const s = mm.at(3, 18, 12); sausageString(c, s[0], s[1], 6); },
    });
    m.prop((c, x, y) => choppingBlock(c, x, y, 'cleaver'), 34, 2);
    m.prop((c, x, y) => barrel(c, x, y, 0.9), 62, 4);
  },

  tannery(m) {
    // ручной пиксель-арт (pixelart3.js): тёплый фахверковый дом, сушилка со шкурами, чаны
    m.custom(c => {
      const g = m.g, x = Math.round(g.fx + g.fw / 2), y = Math.round(g.fy + g.fh - 6);
      shadowAt(c, x + 6, y + 4, 44, 9);
      g.spr.handArt = { art: tanneryArt, x, y, ax: TN_AX, ay: TN_AY };
      g.spr.chimneys = [[x - TN_AX + 72, y - TN_AY + 4]];
    }, 52, 10);
  },

  armory(m) {
    m.box({
      x0: 16, x1: 80, y0: 10, y1: 52, h: 30, wall: 'stone', col: '#968e82',
      roof: { type: 'gable', axis: 'X', rise: 22, mat: 'slate', col: '#3c4048', ov: 4 },
      decor: {
        S: [{ t: 'door', main: true, w: 10, h: 17, o: { frame: 'stone' } }, { t: 'win', at: 28, z: 11, w: 7, h: 8, o: { stone: true, lit: true } }, { t: 'win', at: 70, z: 11, w: 7, h: 8, o: { stone: true } },
          { t: 'shield', at: 36, z: 22, col: '#8c2c20' }, { t: 'shield', at: 62, z: 22, col: '#22486c' }, { t: 'sign', at: 52, z: 25, kind: 'anvil' }],
        E: [{ t: 'win', at: 30, z: 11, w: 6, h: 8, o: { stone: true } }], W: [],
      },
      gable: { E: [{ t: 'win', at: 31, z: 5, w: 5, h: 6, o: { arch: true } }] },
      chimneys: [{ x: 66, y: 38, h: 13, kind: 'stone' }],
    });
    m.prop((c, x, y) => armorStand(c, x, y, 'leather'), 6, 4);
    m.prop((c, x, y) => armorStand(c, x, y, 'leather'), 12, 10);
    m.prop((c, x, y) => armorStand(c, x, y, 'leather'), 88, 6);
    m.prop((c, x, y) => anvil(c, x, y), 84, 24);
    m.prop((c, x, y) => crate(c, x, y, 6, '#6a4a2a'), 2, 18);
  },

  hopfarm(m) {
    // жилой домик хмелевода
    m.box({
      x0: 2, x1: 44, y0: 12, y1: 50, h: 24, wall: 'plaster', col: '#ecdcb6', frame: true, beam: BEAM,
      roof: { type: 'gable', axis: 'X', rise: 17, mat: 'tiles', col: '#a85232', ov: 4 },
      decor: { S: [{ t: 'door', main: true, w: 8, h: 14, o: { square: true } }, { t: 'win', at: 12, z: 9, w: 6, h: 7, o: { shutter: '#3e6a3a', flowers: true } }], E: [], W: [{ t: 'win', at: 30, z: 9 }] },
      chimneys: [{ x: 10, y: 36, h: 9, kind: 'brick', w: 4 }],
    });
    // сушильная башня (как английские хмелесушилки): кирпичный круг и конус с белым колпаком
    m.tower({
      x: 70, y: 32, r: 15, h: 34, col: '#b8643c',
      roof: { h: 44, mat: 'tiles', col: '#a85232', ov: 3 }, finial: true,
      decor: [{ t: 'win', a: 0, z: 14, w: 5, h: 7, o: { arch: true } }, { t: 'door', a: 40, z: 0, w: 7, h: 12, o: { square: true } }],
    });
    m.custom((c, mm) => {
      // белый колпак-вытяжка на вершине
      const [x, y] = mm.at(70, 32, 34 + 44);
      c.fillStyle = '#f0ece2'; c.beginPath(); c.moveTo(x - 4, y + 7); c.lineTo(x + 4, y + 7); c.lineTo(x + 3, y - 2); c.quadraticCurveTo(x + 7, y - 3, x + 6, y + 1); c.lineTo(x + 3, y + 1); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(40,30,20,0.6)'; c.lineWidth = 0.5; c.stroke();
    }, 70, 10);
    m.prop((c, x, y) => sack(c, x, y, '#a8c060'), 50, 4);
    m.prop((c, x, y) => basket(c, x, y, '#9ac050'), 58, 2);
    m.prop((c, x, y) => { for (let k = 0; k < 4; k++) { line(c, x + k * 3, y, x + k * 3 + 1, y - 14, '#6a4424', 0.7); } }, 88, 6);
  },

  brewery(m) {
    m.box({
      x0: 2, x1: 66, y0: 10, y1: 52, h: 30, wall: 'stone', col: '#a49c90',
      roof: { type: 'gable', axis: 'X', rise: 22, mat: 'tiles', col: '#9a4a2c', ov: 4 },
      decor: {
        S: [{ t: 'door', main: true, w: 12, h: 18, o: { frame: 'stone', double: true } }, { t: 'win', at: 14, z: 11, w: 7, h: 8, o: { lit: true, stone: true } }, { t: 'win', at: 62, z: 11, w: 6, h: 8, o: { stone: true } },
          { t: 'sign', at: 22, z: 25, kind: 'barrel' }],
        E: [{ t: 'win', at: 30, z: 11, w: 6, h: 8, o: { lit: true } }], W: [{ t: 'win', at: 30, z: 11 }],
      },
      dormers: [{ x: 30, w: 12, h: 9, loft: true }],
      chimneys: [{ x: 52, y: 36, h: 14, kind: 'brick', w: 6 }],
    });
    // открытый навес с медным варочным котлом
    m.box({
      x0: 66, x1: 94, y0: 12, y1: 44, h: 24, open: true,
      roof: { type: 'lean', down: 'S', rise: 8, mat: 'shingle', col: '#6a4a2a', ov: 3 },
      inside: (c, mm) => {
        const [x, y] = mm.at(80, 24);
        ellipse(c, x, y + 1, 8, 2.5, 'rgba(0,0,0,0.35)');
        c.fillStyle = '#5a5048'; c.fillRect(x - 7, y - 4, 14, 5);
        c.fillStyle = 'rgba(255,140,40,0.85)'; c.fillRect(x - 4, y - 2.5, 8, 2);
        c.fillStyle = lingrad(c, x - 7, 0, x + 7, 0, [[0, '#e8a060'], [0.4, '#c06a30'], [1, '#6a3010']]);
        c.beginPath(); c.ellipse(x, y - 9, 7, 6, 0, 0, Math.PI); c.lineTo(x - 7, y - 9); c.fill();
        ellipse(c, x, y - 9, 7, 2.2, '#8a4a20'); ellipse(c, x, y - 9, 5.6, 1.6, '#c8902c');
        c.fillStyle = '#c06a30'; c.fillRect(x - 1.5, y - 22, 3, 13);
      },
    });
    m.g.spr.glow = PL(m, 80, 12, 4);
    m.prop((c, x, y) => barrel(c, x, y), 6, 4);
    m.prop((c, x, y) => barrel(c, x, y, 0.9), 13, 2);
    m.prop((c, x, y) => barrel(c, x, y, 0.85), 9, -2);
    m.prop((c, x, y) => sack(c, x, y, '#e6c24a'), 68, 4);
    m.prop((c, x, y) => sack(c, x, y, '#a8c060'), 76, 2);
  },

  goatpen(m) {
    m.box({
      x0: 4, x1: 46, y0: 26, y1: 58, h: 18, wall: 'plank', col: '#8a6a40', beam: '#3a2414',
      roof: { type: 'gable', axis: 'X', rise: 13, mat: 'thatch', col: '#b0903e', ov: 4 },
      decor: { S: [{ t: 'door', at: 25, w: 9, h: 12, o: { square: true, braces: true } }], E: [{ t: 'hatch', at: 42, z: 4, w: 6, h: 6 }], W: [] },
    });
    m.ground((c, mm) => {
      groundPoly(c, mm, [[2, 2], [94, 2], [94, 62], [2, 62]], 'rgba(120,96,56,0.55)');
      for (let k = 0; k < 30; k++) { const q = mm.at(rnd(6, 90), rnd(4, 60)); ellipse(c, q[0], q[1], rnd(1, 3), rnd(0.8, 1.6), 'rgba(80,110,40,0.6)'); }
    });
    const gx = m.doorX;
    m.fence([[2, 62], [2, 2], [gx - 8, 2]], 7);
    m.fence([[gx + 8, 2], [94, 2], [94, 62]], 7);
    m.prop((c, x, y) => trough(c, x, y, 14, '#b8b060'), 64, 30);
    m.prop((c, x, y) => hayBale(c, x, y, 0.8), 80, 48);
    m.prop((c, x, y) => { line(c, x, y, x + 2, y - 16, '#6a4424', 0.9); c.strokeStyle = '#6a4424'; c.lineWidth = 0.9; c.beginPath(); c.arc(x + 3.6, y - 16, 1.6, Math.PI, 0); c.stroke(); }, 54, 6);
  },

  stable(m) {
    m.box({
      x0: 2, x1: 82, y0: 14, y1: 56, h: 26, wall: 'plank', col: '#7a5434', beam: '#3a2414', lowerStone: 8,
      roof: { type: 'gable', axis: 'X', rise: 20, mat: 'thatch', col: '#b8913e', ov: 5 },
      decor: {
        S: [{ t: 'door', main: true, w: 16, h: 20, o: { double: true, braces: true, square: true, col: '#6a4424' } },
          { t: 'hatch', at: 14, z: 10, w: 9, h: 7 }, { t: 'hatch', at: 30, z: 10, w: 9, h: 7 }, { t: 'hatch', at: 72, z: 10, w: 9, h: 7 }],
        E: [{ t: 'win', at: 34, z: 12, w: 6, h: 6 }], W: [],
      },
      dormers: [{ x: 22, w: 13, h: 9, loft: true }],
    });
    m.prop((c, x, y) => cart(c, x, y, null), 84, 6);
    m.prop((c, x, y) => trough(c, x, y, 16, '#b8b060'), 6, 2);
    m.prop((c, x, y) => hayBale(c, x, y), 90, 40);
    m.prop((c, x, y) => sack(c, x, y, '#e6c24a'), 60, 2);
    m.fence([[86, 20], [94, 20], [94, 50]]);
  },

  magiccircle(m) { m.custom(c => drawMagicCircle(c, m.g), 0, 60); },

  bonfire(m) {
    m.custom(c => {
      const g = m.g, cx = Math.round(g.fx + g.fw / 2), cy = Math.round(g.fy + g.fh / 2 + 10);
      shadowAt(c, cx, cy + 8, 46, 17);
      const s = [1, 1.2, 1.4][Math.max(1, Math.min(3, m.lv || 1)) - 1];   // костёр 2-го и 3-го уровня — чаша крупнее
      g.spr.handArt = { art: bonfireArt, x: cx, y: cy, ax: BF_AX, ay: BF_AY, s };
      g.spr.fire = [cx + (BF_FIRE[0] - BF_AX) * s, cy + (BF_FIRE[1] - BF_AY) * s];
      (g.spr.chimneys = g.spr.chimneys || []).push([cx, cy - 70]);
    }, 0, 60);
  },

  magicworkshop(m) {
    m.box({
      x0: 0, x1: 28, y0: 20, y1: 56, h: 22, wall: 'plaster', col: '#d8ccb0', frame: true, beam: '#38245c',
      roof: { type: 'gable', axis: 'Y', rise: 14, mat: 'slate', col: '#4c3080', ov: 3 },
      decor: { S: [{ t: 'win', at: 14, z: 8, w: 6, h: 7, o: { magic: true, shutter: '#38245c' } }], E: [], W: [] },
    });
    m.tower({
      x: 44, y: 34, r: 17, h: 84, taper: 0.9, col: '#a49c90', finial: 'crystal',
      roof: { h: 40, mat: 'slate', col: '#4c3080', ov: 4 },
      decor: [{ t: 'door', a: 14, z: 0, w: 9, h: 15, o: { frame: 'stone', col: '#4c3080' } },
        { t: 'win', a: -4, z: 30, w: 6, h: 10, o: { magic: true, arch: true, stone: true } }, { t: 'win', a: 24, z: 56, w: 6, h: 10, o: { magic: true, arch: true, stone: true } },
        { t: 'win', a: 70, z: 44, w: 5, h: 9, o: { magic: true, arch: true, stone: true } }],
    });
    m.prop((c, x, y) => potionShelf(c, x - 6, y), 2, 4);
    m.prop((c, x, y) => cauldron(c, x, y), 24, 2);
    m.g.spr.cauldron = PL(m, 24, 2, 5);
  },
};

// Запасной вид для типов, у которых ещё нет своей модели (новые здания добавляются в config.js раньше, чем рисуются):
// приземистый каменный дом с дверью под черепицей. Игра стартует, а здание сразу видно на карте.
function modelPlaceholder(m) {
  m.box({
    x0: 6, x1: 6 + Math.max(40, m.LW - 12), y0: 10, y1: 10 + Math.max(36, m.LD - 20), h: 26, wall: 'stone', col: '#968e82',
    roof: { type: 'gable', axis: 'X', rise: 20, mat: 'slate', col: '#6e6c68', ov: 4 },
    decor: { S: [{ t: 'door', main: true, w: 10, h: 17, o: { frame: 'stone' } }, { t: 'win', at: 14, z: 10, w: 7, h: 8, o: { lit: true, stone: true } }], E: [], W: [] },
  });
}

// ================= Спрайт здания =================

function bDims(type, rot) {
  const def = BUILDINGS[type];
  if (def.noRotate || (def.rots && !def.rots.includes(rot))) rot = 0;
  if (rot === 3) return { w: def.w, h: def.h, rot, doorLX: (Math.floor(def.w / 2) + 0.5) * TILE, dx: Math.floor(def.w / 2), dy: -1 };   // вход на север (костёр)
  const w = rot ? def.h : def.w, h = rot ? def.w : def.h;
  const doorLX = rot ? (def.w - 1 - Math.floor(def.w / 2) + 0.5) * TILE : (Math.floor(def.w / 2) + 0.5) * TILE;
  const dx = rot === 2 ? -1 : rot ? w : Math.floor(def.w / 2);   // rot 2 — вход на запад
  const dy = rot ? Math.floor(def.w / 2) : h;
  return { w, h, rot, doorLX, dx, dy };
}

function hashStr(s) { let h = 7; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 2654435761); return h >>> 0; }

// ---------- Хоббитская нора в холме ----------
// Травяной холм, в склоне — каменная арка и круглая дверь с ручкой посередине,
// круглые окошки с цветочными ящиками, каменная труба торчит из травы.
function drawHillHouse(c, m, x0, x1, y0, y1, doorCol = '#3e6a2c') {
  const cxL = (x0 + x1) / 2, cyL = (y0 + y1) / 2;
  const [sx, sy] = PL(m, cxL, cyL, 0);
  const rx = (x1 - x0) / 2 + (y1 - y0) * 0.22, H = 26 + (x1 - x0) * 0.08;
  const groundY = sy + (y1 - y0) * 0.36;
  shadowAt(c, sx + 8, groundY + 2, rx + 6, 8);
  // купол холма
  const hill = new Path2D();
  hill.moveTo(sx - rx - 6, groundY);
  hill.bezierCurveTo(sx - rx, groundY - H * 1.1, sx - rx * 0.3, groundY - H * 1.35, sx + rx * 0.1, groundY - H * 1.3);
  hill.bezierCurveTo(sx + rx * 0.6, groundY - H * 1.25, sx + rx + 2, groundY - H * 0.9, sx + rx + 8, groundY);
  hill.quadraticCurveTo(sx, groundY + 8, sx - rx - 6, groundY);
  c.fillStyle = radgrad(c, sx - rx * 0.4, groundY - H * 1.1, 4, rx * 1.6, [[0, '#a8c462'], [0.45, '#73963e'], [1, '#3a5a2a']]);
  c.fill(hill);
  c.save(); c.clip(hill);
  for (let k = 0; k < (x1 - x0) * 2.2; k++) {
    const x = sx - rx + srand() * rx * 2, y = groundY - srand() * H * 1.3;
    line(c, x, y, x + rnd(-0.8, 0.8), y - rnd(1.4, 2.8), shade('#5c8236', rnd(-0.25, 0.3)), 0.6);
  }
  for (let k = 0; k < (x1 - x0) * 0.5; k++) {
    const x = sx - rx * 0.8 + srand() * rx * 1.6, y = groundY - H * (0.4 + srand() * 0.8);
    ellipse(c, x, y, 0.8, 0.8, ['#f4f0f6', '#f0d040', '#e86a9a', '#b080e0'][(srand() * 4) | 0]);
  }
  c.fillStyle = lingrad(c, sx + rx * 0.2, 0, sx + rx + 8, 0, [[0, 'rgba(30,20,40,0)'], [1, 'rgba(30,20,40,0.35)']]);
  c.fillRect(sx - rx - 8, groundY - H * 1.5, rx * 2 + 20, H * 1.6);
  c.restore();
  // каменная труба из склона
  const tx = sx + rx * 0.45, ty = groundY - H * 1.12;
  wallTex(c, 'fieldstone', tx - 3, ty - 10, 6, 11, '#8e8a78');
  c.fillStyle = '#4a4540'; c.fillRect(tx - 3.6, ty - 11, 7.2, 1.6);
  c.fillStyle = '#100c0a'; c.fillRect(tx - 2.4, ty - 11, 4.8, 0.8);
  (m.g.spr.chimneys = m.g.spr.chimneys || []).push([tx, ty - 12]);
  // дверь в склоне: каменная арка, круглая дверь, ручка посередине
  const [dx, dy0] = PL(m, m.doorX, y0 + 2, 0);
  const dy = Math.min(dy0, groundY) - 8.5, R = 8;
  ellipse(c, dx, dy, R + 3.6, R + 3.6, '#5c564f');
  for (let k = 0; k < 12; k++) {
    const a = k / 12 * Math.PI * 2;
    ellipse(c, dx + Math.cos(a) * (R + 1.9), dy + Math.sin(a) * (R + 1.9), 2.2, 1.7, shade('#9e958a', rnd(-0.15, 0.15)));
  }
  c.fillStyle = radgrad(c, dx - 2, dy - 2, 1, R, [[0, shade(doorCol, 0.25)], [1, shade(doorCol, -0.3)]]);
  c.beginPath(); c.arc(dx, dy, R, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(20,30,10,0.55)'; c.lineWidth = 0.5;
  for (let k = -3; k <= 3; k++) { const x = dx + k * 2.2; const hh = Math.sqrt(Math.max(0, R * R - (x - dx) ** 2)); c.beginPath(); c.moveTo(x, dy - hh); c.lineTo(x, dy + hh); c.stroke(); }
  ellipse(c, dx, dy, 1.3, 1.3, '#d8a840'); ellipse(c, dx - 0.4, dy - 0.4, 0.5, 0.5, '#fff2a0');
  c.fillStyle = '#7e766c'; c.fillRect(dx - R - 2, dy + R + 1.4, R * 2 + 4, 1.8);
  // круглые окошки по сторонам с цветочными ящиками
  for (const s of [-1, 1]) {
    const wx = dx + s * (R + 11), wy = dy - 1;
    if (Math.abs(wx - sx) > rx - 4) continue;
    ellipse(c, wx, wy, 4.8, 4.8, '#5c564f');
    roundWin(c, wx, wy, 3.4, { lit: true, flowers: true });
  }
  // дорожка из плоских камней от двери
  for (let k = 1; k <= 3; k++) ellipse(c, dx + (k % 2 ? 1.5 : -1.5), dy + R + 3 + k * 3.2, 3, 1.3, shade('#9e958a', rnd(-0.1, 0.1)));
  if (m.sign) SIGN_QUEUE.list.push({ x: dx + R + 6, y: dy + R + 4, kind: m.sign, dir: 1 });
}

// ---------- Домик в пне ----------
// Своя перерисовка по мотивам референса: широкий пень на моховом холме, зубчатый
// обломанный верх с высоким зубцом справа, срезанный сучок слева, арочная дверь
// под нависающим мхом, голубое окошко, трутовики, вьющийся росток, мухомор.
function drawStumpHouse(c, m) {
  const [cx, cy] = PL(m, 40, 30, 0);          // центр основания ствола на земле
  const R = 20, RY = 10, Ht = 44;
  const top = cy - Ht;
  const BARK = ['#a8643a', '#8a4c2a', '#6e3a22', '#52281a', '#3a1c12'];
  shadowAt(c, cx + 5, cy + 5, 32, 9);
  // моховой холм: неровный край, травинки, тёмные камушки и корни
  const mound = new Path2D();
  mound.moveTo(cx - R - 18, cy + 6);
  mound.quadraticCurveTo(cx - R - 12, cy - 6, cx - R + 2, cy - 8);
  mound.lineTo(cx + R - 2, cy - 8);
  mound.quadraticCurveTo(cx + R + 14, cy - 5, cx + R + 22, cy + 7);
  mound.quadraticCurveTo(cx, cy + RY + 10, cx - R - 18, cy + 6);
  c.fillStyle = lingrad(c, 0, cy - 8, 0, cy + 16, [[0, '#8eab4c'], [0.5, '#5c8236'], [1, '#3a5a2a']]);
  c.fill(mound);
  c.save(); c.clip(mound);
  for (let k = 0; k < 70; k++) { const x = cx - R - 18 + srand() * (R * 2 + 40), y = cy - 8 + srand() * 22; ellipse(c, x, y, rnd(1, 2.4), rnd(0.8, 1.6), shade(GMOSS[(srand() * 4) | 0], rnd(-0.1, 0.25))); }
  c.restore();
  for (let k = 0; k < 16; k++) { const x = cx - R - 14 + srand() * (R * 2 + 30), y = cy + 2 + srand() * 10; line(c, x, y, x + rnd(-1, 1), y - rnd(2, 4), '#a8c462', 0.6); }
  for (const [dx, dy] of [[-28, 8], [-6, 13], [18, 10], [26, 4]]) { ellipse(c, cx + dx, cy + dy, 2.4, 1.4, '#3a2418'); ellipse(c, cx + dx - 0.6, cy + dy - 0.5, 1, 0.6, '#6e432a'); }
  // корни расходятся по холму
  for (const [a, l] of [[-2.8, 14], [-0.3, 12], [2.9, 10]]) {
    const ex = cx + Math.cos(a) * (R + l), ey = cy + Math.abs(Math.sin(a)) * 6 + 4;
    c.fillStyle = BARK[3];
    c.beginPath(); c.moveTo(cx + Math.cos(a) * (R - 4), cy - 6); c.quadraticCurveTo(ex, ey - 7, ex, ey); c.quadraticCurveTo(ex - Math.sign(Math.cos(a)) * 3, ey - 1, cx + Math.cos(a) * (R - 8), cy + 2); c.closePath(); c.fill();
  }
  // ствол: снизу шире, кверху чуть сужается; зубчатый обломанный верх
  const trunk = new Path2D();
  trunk.moveTo(cx - R - 3, cy - 2);
  trunk.bezierCurveTo(cx - R + 1, cy - Ht * 0.35, cx - R + 2, cy - Ht * 0.7, cx - R + 4, top + 10);
  for (const [dx, dy] of [[-R + 6, 6], [-11, 8], [-8, 0], [-3, 5], [1, -2], [5, 3], [8, -5], [10, -10], [13, -9], [15, -2], [R - 3, 3]]) trunk.lineTo(cx + dx, top + dy);
  trunk.bezierCurveTo(cx + R - 1, cy - Ht * 0.6, cx + R + 1, cy - Ht * 0.3, cx + R + 3, cy - 2);
  trunk.quadraticCurveTo(cx, cy + 6, cx - R - 3, cy - 2);
  c.fillStyle = lingrad(c, cx - R, 0, cx + R, 0, [[0, BARK[0]], [0.3, BARK[1]], [0.65, BARK[2]], [1, BARK[4]]]);
  c.fill(trunk);
  c.save(); c.clip(trunk);
  // глубокие борозды коры и светлые гребни
  for (let k = 0; k < 14; k++) {
    const x = cx - R + 2 + k * (R * 2 - 4) / 13 + rnd(-1, 1), w = rnd(-1.5, 1.5);
    c.strokeStyle = BARK[4]; c.lineWidth = rnd(0.9, 1.5);
    c.beginPath(); c.moveTo(x, cy + 2); c.bezierCurveTo(x + w, cy - Ht * 0.3, x - w, cy - Ht * 0.65, x + w * 0.5, top - 4); c.stroke();
    c.strokeStyle = k < 6 ? 'rgba(220,150,100,0.35)' : 'rgba(150,90,60,0.2)'; c.lineWidth = 0.6;
    c.beginPath(); c.moveTo(x + 1.6, cy); c.bezierCurveTo(x + 1.6 + w, cy - Ht * 0.3, x + 1.6 - w, cy - Ht * 0.65, x + 1.6, top); c.stroke();
  }
  // тёплый отсвет по левому краю и холодная тень справа
  c.fillStyle = lingrad(c, cx - R - 3, 0, cx - R + 6, 0, [[0, 'rgba(240,170,110,0.45)'], [1, 'rgba(240,170,110,0)']]); c.fillRect(cx - R - 3, top - 20, 10, Ht + 30);
  c.fillStyle = lingrad(c, cx + R - 8, 0, cx + R + 3, 0, [[0, 'rgba(40,20,40,0)'], [1, 'rgba(40,20,40,0.45)']]); c.fillRect(cx + R - 8, top - 20, 12, Ht + 30);
  // мох стекает с верхнего края и по низу ствола
  for (let k = 0; k < 30; k++) { const x = cx - R + srand() * R * 2, y = top + rnd(2, 8) + (x > cx + 6 ? 4 : 0); ellipse(c, x, y, rnd(1.4, 3), rnd(1, 2), shade(GMOSS[(srand() * 4) | 0], rnd(0, 0.2))); }
  for (let k = 0; k < 34; k++) { const x = cx - R + srand() * R * 2, y = cy - Math.pow(srand(), 2) * 12; ellipse(c, x, y, rnd(1.2, 2.6), rnd(0.8, 1.8), shade(GMOSS[(srand() * 4) | 0], rnd(-0.1, 0.2))); }
  c.restore();
  // срез сверху: светлая древесина с кольцами за зубцами
  c.save(); c.beginPath(); c.ellipse(cx - 1, top + 6, R - 7, 4.2, 0, 0, Math.PI * 2); c.clip();
  c.fillStyle = '#d0a070'; c.fillRect(cx - R, top, R * 2, 12);
  c.strokeStyle = 'rgba(140,80,40,0.55)'; c.lineWidth = 0.45;
  for (let rr = 2; rr < R - 7; rr += 2.2) { c.beginPath(); c.ellipse(cx - 1, top + 6, rr, rr * 0.3, 0, 0, Math.PI * 2); c.stroke(); }
  c.restore();
  ellipse(c, cx - 8, top + 6, 3.4, 1.4, '#73963e'); ellipse(c, cx + 4, top + 7, 2.6, 1.2, '#8eab4c');
  // срезанный сучок слева, торец с кольцами
  c.fillStyle = BARK[2]; c.beginPath(); c.moveTo(cx - R + 2, top + 16); c.lineTo(cx - R - 7, top + 13); c.lineTo(cx - R - 7, top + 21); c.lineTo(cx - R + 2, top + 22); c.fill();
  ellipse(c, cx - R - 7, top + 17, 2.6, 4, '#c89060'); ellipse(c, cx - R - 7, top + 17, 1.6, 2.6, '#a8703e'); ellipse(c, cx - R - 7, top + 17, 0.6, 1, '#7a4a28');
  // вьющийся росток на верхушке
  c.strokeStyle = '#5c8236'; c.lineWidth = 0.9;
  c.beginPath(); c.moveTo(cx + 9, top - 8); c.bezierCurveTo(cx + 8, top - 18, cx + 14, top - 20, cx + 16, top - 16); c.stroke();
  c.beginPath(); c.moveTo(cx + 11, top - 17); c.bezierCurveTo(cx + 7, top - 22, cx + 4, top - 20, cx + 5, top - 17); c.stroke();
  ellipse(c, cx + 16.4, top - 17.6, 1.4, 0.9, '#8eab4c'); ellipse(c, cx + 5, top - 16.6, 1.2, 0.8, '#73963e');
  // трутовики «этажеркой» посередине
  for (const [dx, dy, s] of [[3, -24, 1.1], [1, -20, 1.3], [4, -16, 0.9]]) {
    c.fillStyle = '#e0b088'; c.beginPath(); c.ellipse(cx + dx, cy + dy, 4 * s, 1.7 * s, 0, Math.PI, 0); c.fill();
    c.fillStyle = '#b8805a'; c.fillRect(cx + dx - 4 * s, cy + dy - 0.2, 8 * s, 0.8);
    c.fillStyle = '#f4d0a8'; c.fillRect(cx + dx - 2.5 * s, cy + dy - 1.2 * s, 3 * s, 0.5);
  }
  // арочная дверь левее центра, мох нависает над аркой
  const [dx0, dy0] = PL(m, m.doorX, 18, 0);
  const dx = Math.min(dx0, cx - 4), dy = Math.min(dy0, cy - 2);
  c.fillStyle = '#2a1408'; c.beginPath(); c.moveTo(dx - 7.4, dy); c.lineTo(dx - 7.4, dy - 12); c.arc(dx, dy - 12, 7.4, Math.PI, 0); c.lineTo(dx + 7.4, dy); c.closePath(); c.fill();
  c.save(); c.beginPath(); c.moveTo(dx - 6, dy); c.lineTo(dx - 6, dy - 12); c.arc(dx, dy - 12, 6, Math.PI, 0); c.lineTo(dx + 6, dy); c.closePath(); c.clip();
  c.fillStyle = lingrad(c, dx - 6, 0, dx + 6, 0, [[0, '#c8a070'], [1, '#8a6040']]); c.fillRect(dx - 6, dy - 19, 12, 19);
  for (let x = dx - 6 + 2.4; x < dx + 6; x += 2.4) { c.fillStyle = 'rgba(60,30,12,0.55)'; c.fillRect(x, dy - 19, 0.5, 19); }
  c.fillStyle = '#5a4030'; c.fillRect(dx - 6, dy - 13, 12, 0.8); c.fillRect(dx - 6, dy - 5, 12, 0.8);
  c.restore();
  ellipse(c, dx + 3.6, dy - 8, 0.7, 0.7, '#e0b040');
  for (let a = Math.PI * 1.05; a < Math.PI * 1.95; a += 0.2) ellipse(c, dx + Math.cos(a) * 8, dy - 12 + Math.sin(a) * 8, rnd(1.6, 2.6), rnd(1.2, 1.8), shade(GMOSS[(srand() * 4) | 0], rnd(0, 0.2)));
  c.fillStyle = '#7e766c'; c.fillRect(dx - 7, dy - 0.4, 14, 1.6);
  // голубое окошко справа: тёмная рама, светящееся стекло
  const wx = cx + 12, wy = cy - 26;
  c.fillStyle = '#2a1408'; rrect(c, wx - 3, wy - 4.4, 6, 8.4, 2.4); c.fill();
  c.fillStyle = radgrad(c, wx, wy, 0.4, 4, [[0, '#d6f2ff'], [0.5, '#60b8e8'], [1, '#2c6ca0']]); rrect(c, wx - 2.1, wy - 3.4, 4.2, 6.6, 1.8); c.fill();
  c.fillStyle = '#2a1408'; c.fillRect(wx - 0.3, wy - 3.4, 0.6, 6.6); c.fillRect(wx - 2.1, wy - 0.4, 4.2, 0.6);
  glow(c, wx, wy, 6, '120,200,255', 0.25);
  // мухоморы на холме спереди
  mushroomProp(c, cx - 15, cy + 9, 1.3, true); mushroomProp(c, cx + 20, cy + 8, 0.8, false); mushroomProp(c, cx - 11, cy + 11, 0.7, true);
  // столб с вывеской (топор) у входа
  if (m.sign) SIGN_QUEUE.list.push({ x: cx + R + 10, y: cy + 4, kind: m.sign, dir: 1 });
  // дым — из дупла среди зубцов
  (m.g.spr.chimneys = m.g.spr.chimneys || []).push([cx - 2, top + 2]);
}

// Верхние точки силуэта крыши (куда садятся совы), в мировых пикселях спрайта
function roofTopPoints(d, W, k) {
  const H = d.length / 4 / W, tops = [];
  for (let x = Math.floor(W * 0.2); x < W * 0.8; x += k * 2) {
    for (let y = 0; y < H * 0.7; y++) if (d[(y * W + x) * 4 + 3]) { tops.push([x / k, y / k]); break; }
  }
  tops.sort((a, b) => a[1] - b[1]);
  const pick = [];
  for (const p of tops) { if (pick.every(q => Math.abs(q[0] - p[0]) > 10)) pick.push(p); if (pick.length >= 4) break; }
  return pick;
}

// Вход на запад: зеркало восточного варианта (в нашей проекции видны только
// южная и восточная стены, поэтому западный фасад показываем отражением).
function mirrorSprite(s, FW) {
  const flip = src => {
    const cv = mkCanvas(src.width, src.height), c = cv.getContext('2d');
    c.translate(src.width, 0); c.scale(-1, 1); c.drawImage(src, 0, 0);
    return cv;
  };
  const W = s.w, pt = p => p && [W - p[0], p[1]];
  const m = { ...s, canvas: flip(s.canvas), shadow: flip(s.shadow), padx: W - s.padx - FW, doorCx: W - s.doorCx };
  if (s.chimneys) m.chimneys = s.chimneys.map(pt);
  if (s.wins) m.wins = s.wins.map(w => [W - w[0], ...w.slice(1)]);
  if (s.porch) m.porch = pt(s.porch);
  if (s.doorPt) m.doorPt = pt(s.doorPt);

  for (const k of ['hub', 'glow', 'fire', 'circle', 'cauldron', 'oven', 'bar']) if (s[k]) m[k] = pt(s[k]);
  if (s.pen) m.pen = [W - s.pen[2], s.pen[1], W - s.pen[0], s.pen[3]];
  if (s.penQuad) m.penQuad = s.penQuad.map(pt);
  if (s.perches) m.perches = s.perches.map(pt);
  return m;
}

// ---------- Эпоха 3: колонны, портик, статуи, знамёна ----------
function palaceColumn(c, sx, sy0, sy1) {
  const w = 2.7;
  shadowAt(c, sx + 1.2, sy0, 4);
  c.fillStyle = lingrad(c, sx - w, 0, sx + w, 0, [[0, '#f4efe0'], [0.5, '#d9d1bb'], [1, '#8f8777']]);
  c.fillRect(sx - w, sy1, w * 2, sy0 - sy1);
  c.fillStyle = 'rgba(70,60,44,0.35)';
  for (const f of [-1.1, 0.5, 1.7]) c.fillRect(sx + f, sy1 + 2, 0.45, sy0 - sy1 - 3.6);   // каннелюры
  c.fillStyle = '#cfc7b2'; c.fillRect(sx - w - 1, sy0 - 1.8, w * 2 + 2, 1.8);               // база
  c.fillStyle = '#efe8d4'; c.fillRect(sx - w - 1, sy0 - 1.8, w * 2 + 2, PXU);
  c.fillStyle = '#e2dac4'; c.fillRect(sx - w - 1.4, sy1, w * 2 + 2.8, 2);                   // капитель
  c.fillStyle = '#f8f2e2'; c.fillRect(sx - w - 1.4, sy1, w * 2 + 2.8, PXU);
  c.fillStyle = '#a89f8a'; c.fillRect(sx - w - 1.4, sy1 + 1.7, w * 2 + 2.8, 0.5);
}

// гном-страж из белого камня на постаменте: шлем, борода, секира; kind 0 — секира справа, 1 — молот и щит
function palaceStatue(c, sx, sy, kind) {
  shadowAt(c, sx + 1.5, sy, 6);
  const px = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(sx + x, sy + y, w, h); };
  const LT = '#f1ecdd', MD = '#d3cbb6', DK = '#948b78', GD = '#e0b440';
  // постамент
  px(-5, -8, 10, 8, MD); px(-5, -8, 4, 8, LT); px(2, -8, 3, 8, DK);
  px(-6, -9.4, 12, 1.6, LT); px(-6, -1.2, 12, 1.2, DK); px(-5, -5, 10, 0.5, DK);
  const y = -9.4;
  // ноги, плащ, туловище
  px(-3, y - 4, 2.4, 4, MD); px(0.6, y - 4, 2.4, 4, DK);
  px(-3.6, y - 12, 7.2, 8.4, MD); px(-3.6, y - 12, 2.6, 8.4, LT); px(1.8, y - 12, 1.8, 8.4, DK);
  px(-3.6, y - 6.4, 7.2, 1, GD);                                      // пояс
  // голова: шлем с гребнем, лицо, борода
  px(-2.4, y - 17.6, 4.8, 2.4, LT); px(-0.4, y - 19.4, 0.9, 2, GD);   // шлем и гребень
  px(-1.8, y - 15.6, 3.6, 2, '#e8d6b8');                              // лицо
  px(-2.4, y - 14, 4.8, 3.6, LT); px(1, y - 14, 1.4, 3.6, MD);       // борода
  // руки и оружие
  if (kind === 0) {
    px(3.6, y - 11, 1.6, 1.8, MD); px(4.2, y - 21, 0.9, 16, '#8a6a3a');
    px(2.6, y - 21, 2.6, 4, DK); px(2.2, y - 20.4, 1.4, 3, LT);        // лезвие секиры
    px(-5.4, y - 10.6, 1.8, 4.6, DK);
  } else {
    px(-6.2, y - 12, 3.4, 5.6, GD); px(-5.6, y - 11.4, 2.2, 4.4, '#b88a24');   // щит
    px(3.6, y - 11, 1.6, 1.8, MD); px(4.2, y - 18, 1.1, 12, '#8a6a3a'); px(3, y - 19.6, 3.6, 2.6, DK);   // молот
  }
}

function palaceFlag(c, x, y, col, h = 30) {
  shadowAt(c, x + 1, y, 2);
  c.fillStyle = '#d8b050'; c.fillRect(x - 0.6, y - h, 1.2, h);
  ellipse(c, x, y - h - 0.6, 1.4, 1.4, GD_FLAG);
  c.fillStyle = lingrad(c, x, 0, x + 12, 0, [[0, shade(col, 0.22)], [1, shade(col, -0.3)]]);
  c.beginPath(); c.moveTo(x + 0.6, y - h + 1.5); c.lineTo(x + 12.6, y - h + 2.6); c.lineTo(x + 9.6, y - h + 6.4); c.lineTo(x + 12.4, y - h + 10.4); c.lineTo(x + 0.6, y - h + 9.6); c.closePath(); c.fill();
  c.fillStyle = GD_FLAG; c.fillRect(x + 2.4, y - h + 4.2, 4.6, 1);
}
const GD_FLAG = '#f0cc60';
const PALACE_FLAGS = ['#8a1e2a', '#1e3f8a', '#2c6a3a', '#6a2a8a'];

function eraExtras(m, era) {
  if (era < 3) return;
  let part = null, pa = 0;
  for (const q of m.parts) {
    const p = q.p;
    if (q.kind !== 'box' || p.open || p.canopy || !p.decor || !p.decor.S) continue;
    const a = (p.x1 - p.x0) * (p.y1 - p.y0);
    if (a > pa && p.decor.S.some(d => d.t === 'door' && d.main)) { part = q; pa = a; }
  }
  const side = (x, kind, y) => { if (x > 5 && x < m.LW - 5) m.custom((c, mm) => { const [sx, sy] = mm.at(x, y, 0); palaceStatue(c, sx, sy, kind); }, x, y - 0.1); };
  if (!part) {
    // здание без «главного короба» (домик в скале и т. п.): только стражи у входа
    side(m.doorX - 24, 0, 5); side(m.doorX + 24, 1, 5);
    return;
  }
  const p = part.p, md = p.decor.S.find(d => d.t === 'door' && d.main);
  const dc = m.doorX + (md.shift || 0) * (m.rot ? -1 : 1), half = (md.w || 10) / 2;
  const H = (p.z0 || 0) + p.h;
  const hs = hashStr(BUILD_TYPE + 'palace');
  const xa = Math.max(p.x0 + 1, dc - half - 9), xb = Math.min(p.x1 - 1, dc + half + 9);
  const yf = Math.max(1.5, p.y0 - 5);
  const porch = m.parts.find(q => q.kind === 'box' && q.p.open && q.p.canopy && q.p.x0 <= dc && q.p.x1 >= dc && q.p.y1 <= p.y0 + 1);
  if (porch) {
    // крыльцо-навес уже есть: оно само станет портиком (см. drawBoxPart), по бокам — стражи
    side(porch.p.x0 - 13, 0, porch.p.y0 + 3); side(porch.p.x1 + 13, 1, porch.p.y0 + 3);
  } else if (xb - xa >= 22 && H >= 16 && p.y0 - yf >= 2) {
    // портик: две колонны, антаблемент и фронтон
    const zc = H - 6;
    for (const x of [xa + 3, xb - 3]) m.custom((c, mm) => { const [sx, sy0] = mm.at(x, yf + 1, 0), [, sy1] = mm.at(x, yf + 1, zc); palaceColumn(c, sx, sy0, sy1); }, x, yf);
    m.box({ x0: xa, x1: xb, y0: yf - 1.5, y1: p.y0, z0: zc, h: 6, wall: 'stone', col: '#e4dcc6', _g: true, noShadow: true, noPlinth: true,
      roof: { type: 'gable', axis: 'X', rise: 8, mat: 'tiles', col: PALACE_TILES[hs % 3], ov: 1.6 } });
    side(xa - 10, 0, yf + 3); side(xb + 10, 1, yf + 3);
  } else {
    side(dc - half - 14, 0, 3); side(dc + half + 14, 1, 3);
  }
  // знамя на коньке главной крыши
  const w = boxW(m, p), cx = (p.x0 + p.x1) / 2, cy = (p.y0 + p.y1) / 2, [X, Y] = toW(m, cx, cy);
  m.custom((c, mm) => { const [sx, sy] = P(mm.g, X, Y, roofZ(mm, p, w, H, X, Y) - 1); palaceFlag(c, sx, sy, PALACE_FLAGS[(hs >> 3) % 4], Math.max(10, Math.min(28, sy - 4))); }, cx, p.y0 - 0.2);
}

// vr — вариант облика (жилые дома: 8 видов, см. house.js); у остальных зданий 0
function buildingSpriteBase(type, rot = 0, level = 1, era = buildingEra(type, level), vr = 0) {
  const d = bDims(type, rot);
  if (d.rot === 3) return buildingSpriteBase(type, 0, level, era, vr);   // костёр симметричен — тот же спрайт
  const key = type + ':' + d.rot + (level >= 3 ? ':U3' : level === 2 ? ':U' : '') + (vr ? '~v' + vr : '') + '#e' + era;
  if (SPR.buildings[key]) return SPR.buildings[key];
  if (d.rot === 2) {
    SPR.buildings[key] = mirrorSprite(buildingSpriteBase(type, 1, level, era, vr), d.w * TILE);
    return SPR.buildings[key];
  }
  srand = mulberry32(hashStr(type));
  const def = BUILDINGS[type];
  const FW = d.w * TILE, FD = d.h * TILE, top = (def.top || 60) + (level >= 2 ? UP_EXTRA : 0);
  SK = type === 'swine' && d.rot ? 0 : 0.5;
  const W = Math.ceil(FW + BPADX * 2 + FD * SK), H = FD + top + BBOTTOM;
  const [cv, c] = mkSprite(W, H, BS);
  const [scv, sc] = mkSprite(W, H, BS);
  const spr = { canvas: cv, shadow: scv, w: W, h: H, top, padx: BPADX, chimneys: null, hub: null, glow: null, fw: FW, baseY: top + FD - 2, doorCx: BPADX + (d.dx + 0.5) * TILE };
  const g = {
    type, ox: BPADX, oy: top + FD, rot: d.rot, LW: def.w * TILE, LD: def.h * TILE, doorLX: d.doorLX,
    // для построек, нарисованных в экранных координатах
    fx: BPADX, fy: top, fw: FW, fh: FD, w: d.w, h: d.h, base: top + FD - 2, back: top + 8,
    doorCx: BPADX + (d.dx + 0.5) * TILE,
    spr, sc,
  };
  if (type !== 'magiccircle') {
    sc.fillStyle = radgrad(sc, BPADX + FW / 2, g.oy - 4, 4, Math.max(FW, FD) * 0.75, [[0, 'rgba(96,70,40,0.5)'], [0.7, 'rgba(96,70,40,0.22)'], [1, 'rgba(96,70,40,0)']]);
    sc.fillRect(0, top - 10, W, FD + BBOTTOM + 10);
  }
  const m = newModel(g);
  m.lv = level; m.vr = vr;
  (MODELS[type] || modelPlaceholder)(m);
  if (level >= 2) spr.tall = upgradeModel(m);
  BUILD_ERA = era;
  eraExtras(m, era);
  SIGN_QUEUE.list = [];
  BUILD_STYLE = styleOf(type); BUILD_TYPE = type; BUILD_LEVEL = level;
  WIN_REC = [];
  renderModel(c, m);
  spr.wins = WIN_REC; WIN_REC = null;
  BUILD_STYLE = 'logs'; BUILD_TYPE = ''; BUILD_LEVEL = 1; BUILD_ERA = 2;
  SK = 0.5;
  for (const s of SIGN_QUEUE.list) postSign(c, s.x, s.y, s.kind, s.dir);
  SIGN_QUEUE.list = [];
  // без зерна: шумовая рябь выдаёт машину, у художника — цельные пятна цвета
  // пиксель-арт ×3: палитра, чёрная внешняя обводка и тёмные линии на стыках деталей
  spr.canvas = toPixelArt(cv, BS / 3, { outline: true, outlineDark: 0.18, alphaCut: 100, punch: 0.14, hueShift: 1, clean: true, ink: 62, onData: (d, PWd) => { spr.perches = roofTopPoints(d, PWd, 3); } });
  // ручной пиксель-арт — поверх, без автоматической обработки: каждый пиксель как нарисован
  if (spr.handArt) {
    const h = spr.handArt, art = h.art(), k = spr.canvas.width / spr.w, s = h.s || 1;
    const oc = spr.canvas.getContext('2d');
    oc.imageSmoothingEnabled = false;
    oc.drawImage(art, Math.round((h.x - h.ax * s) * k), Math.round((h.y - h.ay * s) * k), Math.round(art.width * k * s), Math.round(art.height * k * s));
    spr.perches = (h.art.perches || []).map(([px, py]) => [h.x + (px - h.ax) * s, h.y + (py - h.ay) * s]);
    delete spr.handArt;
  }
  // тень размытая — хватает обычного разрешения (в 36 раз меньше видеопамяти, чем было)
  const blurred = mkCanvas(W, H);
  const bc = blurred.getContext('2d');
  blurDraw(bc, scv, W, H, 1.4);
  spr.shadow = blurred;
  SPR.buildings[key] = spr;
  return spr;
}

// ---------- Пекарня в духе гномьих домов Оплота ----------
// Каменный дом, вросший в скалу: валуны за спиной, тёмная тесовая крыша во мху,
// круглая дубовая дверь в каменной арке, высокая труба, глиняная печь-купол
// с огнём сбоку, мешки муки, хлеба на полке и дровница.
function drawDwarfBakery(c, m) {
  const x = Math.round(m.g.fx + m.g.fw / 2), y = Math.round(m.g.fy + m.g.fh - 6);
  shadowAt(c, x + 6, y + 4, 36, 10);
  // скала за домом
  drawBoulder(c, x - 24, y - 16, 15, 13);
  drawBoulder(c, x + 18, y - 22, 17, 15);
  drawBoulder(c, x - 6, y - 34, 13, 10);
  // боковая (восточная) стена — в тени
  const side = [[x + 14, y], [x + 22, y - 5], [x + 22, y - 30], [x + 14, y - 26]];
  clipPoly(c, side, () => { wallTex(c, 'fieldstone', x + 13, y - 32, 10, 33, '#7a6e5c'); c.fillStyle = 'rgba(20,14,8,0.35)'; c.fillRect(x + 13, y - 32, 10, 33); });
  // фасад из бутового камня
  wallTex(c, 'fieldstone', x - 20, y - 26, 34, 26, '#a49680');
  c.fillStyle = lingrad(c, 0, y - 26, 0, y, [[0, 'rgba(20,14,8,0.35)'], [0.3, 'rgba(20,14,8,0)'], [1, 'rgba(20,14,8,0.25)']]);
  c.fillRect(x - 20, y - 26, 34, 26);
  // цоколь из крупных валунов
  for (let k = 0; k < 7; k++) { const bx = x - 19 + k * 5.3; ellipse(c, bx, y - 1, 3.2, 2, '#5a5044'); ellipse(c, bx - 0.5, y - 1.6, 2.4, 1.3, '#8e826e'); }
  // крыша: тёмный тёс с моховыми пятнами
  const roofF = [[x - 25, y - 23], [x + 18, y - 23], [x + 10, y - 47], [x - 15, y - 47]];
  const roofS = [[x + 18, y - 23], [x + 27, y - 28], [x + 17, y - 50], [x + 10, y - 47]];
  poly(c, roofS, '#3e2818');
  poly(c, roofF, lingrad(c, 0, y - 47, 0, y - 23, [[0, '#6a4a2e'], [1, '#4a3020']]));
  clipPoly(c, roofF, () => {
    for (let r = 0; r < 7; r++) {
      const ry = y - 25 - r * 3.4;
      c.strokeStyle = 'rgba(25,15,8,0.6)'; c.lineWidth = 0.6;
      c.beginPath(); c.moveTo(x - 26, ry); c.lineTo(x + 20, ry); c.stroke();
      for (let k = 0; k < 14; k++) { const sx = x - 25 + k * 3.4 + (r % 2) * 1.7; line(c, sx, ry, sx, ry - 3.2, 'rgba(25,15,8,0.45)', 0.4); }
    }
    for (let k = 0; k < 9; k++) ellipse(c, x - 18 + srand() * 30, y - 44 + srand() * 18, rnd(2, 4), rnd(1.2, 2.2), shade(GMOSS[(srand() * 4) | 0], rnd(-0.1, 0.2)));
  });
  line(c, x - 25, y - 23, x + 18, y - 23, '#2a1a0e', 1.2);           // свес
  c.fillStyle = 'rgba(15,10,5,0.4)'; c.fillRect(x - 20, y - 22, 34, 2.5);   // тень под свесом
  // высокая каменная труба
  wallTex(c, 'fieldstone', x + 2, y - 62, 7, 18, '#8e8270');
  c.fillStyle = '#4a4036'; c.fillRect(x + 1.2, y - 63.5, 8.6, 2);
  c.fillStyle = '#100c0a'; c.fillRect(x + 2.6, y - 63.5, 5.8, 0.9);
  (m.g.spr.chimneys = m.g.spr.chimneys || []).push([x + 5.5, y - 65]);
  // круглая дверь в каменной арке
  const dx = x - 3, dy = y - 9, R = 8;
  ellipse(c, dx, dy, R + 3.6, R + 3.6, '#4e463a');
  for (let k = 0; k < 11; k++) {
    const a = Math.PI + k / 10 * Math.PI;
    ellipse(c, dx + Math.cos(a) * (R + 2), dy + Math.sin(a) * (R + 2), 2.4, 1.8, shade('#a89a82', rnd(-0.15, 0.12)));
  }
  c.save(); c.beginPath(); c.arc(dx, dy, R, Math.PI, 0); c.lineTo(dx + R, y); c.lineTo(dx - R, y); c.closePath(); c.clip();
  c.fillStyle = lingrad(c, dx - R, 0, dx + R, 0, [[0, '#8a5a30'], [1, '#4a2c16']]); c.fillRect(dx - R, dy - R, R * 2, R * 2);
  for (let k = -3; k <= 3; k++) line(c, dx + k * 2.3, dy - R, dx + k * 2.3, y, 'rgba(30,16,6,0.55)', 0.45);
  for (const by of [dy - 3, dy + 4]) { c.fillStyle = '#2e2a28'; c.fillRect(dx - R, by, R * 2, 1.3); for (let k = -2; k <= 2; k++) ellipse(c, dx + k * 3.2, by + 0.6, 0.45, 0.45, '#8a8278'); }
  c.restore();
  c.strokeStyle = '#c8a040'; c.lineWidth = 0.7; c.beginPath(); c.arc(dx + 3.6, dy + 1.4, 1.3, 0, 7); c.stroke();   // кольцо-колотушка
  // круглое окно с тёплым светом и полка с караваями
  ellipse(c, x - 14, y - 15, 4.8, 4.8, '#4e463a');
  roundWin(c, x - 14, y - 15, 3.4, { lit: true });
  c.fillStyle = '#5a3a1c'; c.fillRect(x - 19, y - 9.5, 10, 1.3);
  for (let k = 0; k < 3; k++) { ellipse(c, x - 17 + k * 3.2, y - 10.6, 1.5, 1.1, '#b8783a'); ellipse(c, x - 17.4 + k * 3.2, y - 11.1, 0.7, 0.4, '#e8b870'); }
  // глиняная печь-купол сбоку, в жерле огонь
  const ox = x + 25, oy = y + 1;
  shadowAt(c, ox + 3, oy + 1, 13, 4);
  c.fillStyle = lingrad(c, ox - 12, 0, ox + 12, 0, [[0, '#e0a070'], [0.5, '#b8683e'], [1, '#6e321a']]);
  c.beginPath(); c.ellipse(ox, oy - 1, 12, 13, 0, Math.PI, 0); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(70,26,8,0.45)'; c.lineWidth = 0.4;
  for (let k = 1; k < 5; k++) { c.beginPath(); c.ellipse(ox, oy - 1, 12, 13 - k * 2.6, 0, Math.PI, 0); c.stroke(); }
  c.fillStyle = '#1a0a06'; c.beginPath(); c.ellipse(ox - 1, oy, 4.6, 5.6, 0, Math.PI, 0); c.fill();
  c.fillStyle = radgrad(c, ox - 1, oy - 1, 0.5, 4.5, [[0, '#fff0a0'], [0.5, '#ff9a30'], [1, 'rgba(200,60,10,0.2)']]);
  c.beginPath(); c.ellipse(ox - 1, oy, 3.4, 3.6, 0, Math.PI, 0); c.fill();
  drawFire(c, ox - 1, oy, 'spark', 0, 2, { glow: 0 });
  wallTex(c, 'brick', ox + 3, oy - 19, 4, 8, '#9a4e34');
  c.fillStyle = '#3e3630'; c.fillRect(ox + 2.4, oy - 20, 5.2, 1.4);
  (m.g.spr.chimneys = m.g.spr.chimneys || []).push([ox + 5, oy - 21]);
  // мешки муки у двери, дровница у печи, лопата для хлеба
  sack(c, x - 24, y + 3, '#ece2cc', 1.05); sack(c, x - 18.5, y + 4, '#e2d6bc', 0.9);
  logPile(c, x + 31, y + 6, 2, 7);
  line(c, x + 13, y + 1, x + 16, y - 16, '#8a5a30', 1);
  ellipse(c, x + 12.6, y + 1.6, 2.2, 1.2, '#a06a3a');
  if (m.sign) SIGN_QUEUE.list.push({ x: x - 30, y: y + 2, kind: m.sign, dir: -1 });
}

// ---------- Мелочи Оплота ----------
// знамя на древке: бархатное полотнище с золотой каймой и рунным знаком
function dwarfBanner(c, x, y, col = '#2f6a3a', h = 34) {
  shadowAt(c, x + 1, y, 3);
  c.fillStyle = '#4a2c14'; c.fillRect(x - 0.7, y - h, 1.4, h);
  c.fillStyle = '#c8a040'; ellipse(c, x, y - h - 0.6, 1.5, 1.5, '#c8a040');
  c.fillRect(x - 6.5, y - h + 1.5, 13, 1);
  c.fillStyle = lingrad(c, x - 5, 0, x + 5, 0, [[0, shade(col, 0.2)], [1, shade(col, -0.3)]]);
  c.beginPath(); c.moveTo(x - 5.5, y - h + 2.5); c.lineTo(x + 5.5, y - h + 2.5); c.lineTo(x + 5.5, y - h + 17); c.lineTo(x, y - h + 13.5); c.lineTo(x - 5.5, y - h + 17); c.closePath(); c.fill();
  c.strokeStyle = '#d8b050'; c.lineWidth = 0.6;
  c.beginPath(); c.moveTo(x - 5, y - h + 3); c.lineTo(x + 5, y - h + 3); c.lineTo(x + 5, y - h + 15.6); c.lineTo(x, y - h + 12.4); c.lineTo(x - 5, y - h + 15.6); c.closePath(); c.stroke();
  // руна-молот
  c.fillStyle = '#f0d070'; c.fillRect(x - 0.5, y - h + 5, 1, 6); c.fillRect(x - 2.4, y - h + 5, 4.8, 1.6);
}
// подъёмная стрела склада: столб, вынос с блоком, верёвка и ящик на крюке
function hoistCrane(c, x, y) {
  shadowAt(c, x + 2, y, 5);
  c.fillStyle = lingrad(c, x - 2, 0, x + 2, 0, [[0, '#8a5a30'], [1, '#3e2410']]); c.fillRect(x - 2, y - 46, 4, 46);
  line(c, x, y - 40, x - 20, y - 44, '#6a4422', 2.6);                    // стрела
  line(c, x, y - 30, x - 14, y - 43, '#4a2c14', 1.4);                    // подкос
  ellipse(c, x - 20, y - 43.4, 2.2, 2.2, '#3a3632'); ellipse(c, x - 20, y - 43.4, 0.9, 0.9, '#9e958a');   // блок
  line(c, x - 20, y - 42, x - 20, y - 24, '#d8c8a0', 0.7);               // верёвка
  c.strokeStyle = '#3a3632'; c.lineWidth = 0.8; c.beginPath(); c.arc(x - 20, y - 23, 1.6, 0, Math.PI); c.stroke();
  crate(c, x - 20, y - 14, 9, '#a07038');
  ellipse(c, x, y + 0.5, 3.6, 1.5, '#8e877c');
}
// печь на первом этаже трактира: кирпичный свод с тёмной топкой (огонь живой — рисуется в inside.js), труба уходит в потолок
function innOven(c, x, y) {
  shadowAt(c, x + 2, y + 1, 9);
  c.fillStyle = '#6a3a28'; c.fillRect(x - 9, y - 15, 18, 15);                                   // кирпичное тело
  for (let r = 0; r < 5; r++) for (let q = 0; q < 6; q++) { c.fillStyle = (q + r) % 3 ? '#8a4a32' : '#7a4028'; c.fillRect(x - 9 + q * 3 + (r % 2) * 1.5, y - 15 + r * 3, 2.6, 2.4); }
  c.fillStyle = '#3a2620'; c.fillRect(x - 10, y - 2, 20, 2.4);                                  // цоколь
  c.fillStyle = '#2a1a14'; c.beginPath(); c.moveTo(x - 4.5, y - 3); c.lineTo(x - 4.5, y - 8); c.quadraticCurveTo(x, y - 13, x + 4.5, y - 8); c.lineTo(x + 4.5, y - 3); c.closePath(); c.fill();   // зев топки
  c.fillStyle = '#c8581c'; c.fillRect(x - 3, y - 5, 6, 2);                                      // угли
  c.fillStyle = '#4a4440'; c.fillRect(x - 3, y - 22, 6, 8); c.fillStyle = '#6a625a'; c.fillRect(x - 3, y - 22, 2, 8);   // труба
  c.fillStyle = '#9a9488'; c.fillRect(x - 11, y - 15.8, 22, 1.6);                              // плита сверху
}
// вывеска трактира: большая янтарная кружка с пеной, подвешенная на кованом кронштейне над улицей
function innMugSign(c, x, y) {
  const H = 50, top = y - H, mx = x + 14, my = top + 11;
  shadowAt(c, x + 1, y, 5);
  c.fillStyle = lingrad(c, x - 1.6, 0, x + 1.6, 0, [[0, '#9a6a38'], [0.5, '#7a4e2a'], [1, '#3e2410']]); c.fillRect(x - 1.6, top, 3.2, H);
  c.fillStyle = '#5a3a1e'; c.fillRect(x - 2.2, top - 1, 4.4, 1.6);
  line(c, x + 1, top + 1, mx + 4, top + 1, '#2a2624', 1.1); line(c, x + 1, top + 9, mx - 2, top + 1.4, '#2a2624', 0.8);   // кронштейн и подкос
  for (const k of [-4, 4]) line(c, mx + k, top + 1.4, mx + k * 0.9, my - 6, '#3a3632', 0.5);                         // цепочки
  c.fillStyle = lingrad(c, mx - 7, 0, mx + 7, 0, [[0, '#f0c050'], [0.55, '#d89a28'], [1, '#8a5a14']]); c.fillRect(mx - 7, my - 5, 14, 17);   // кружка
  c.strokeStyle = '#4a2c0c'; c.lineWidth = 0.8; c.strokeRect(mx - 7, my - 5, 14, 17);
  for (const k of [-2.5, 2.5]) line(c, mx + k, my - 4, mx + k, my + 11, 'rgba(60,30,6,0.5)', 0.6);
  c.fillStyle = '#6a4a14'; c.fillRect(mx - 7, my + 0.5, 14, 1); c.fillRect(mx - 7, my + 8, 14, 1);
  c.strokeStyle = '#d89a28'; c.lineWidth = 2.2; c.beginPath(); c.arc(mx + 8.4, my + 4, 4.2, -1.45, 1.45); c.stroke();    // ручка
  c.strokeStyle = '#4a2c0c'; c.lineWidth = 0.7; c.beginPath(); c.arc(mx + 8.4, my + 4, 5.3, -1.45, 1.45); c.stroke();
  for (const [dx, r] of [[-4.6, 3.2], [-0.8, 3.8], [3.6, 3.2]]) ellipse(c, mx + dx, my - 5.2, r, r * 0.85, '#fffbe8');   // пена
  ellipse(c, mx + 6, my - 6.8, 1.6, 1.4, '#fffbe8'); ellipse(c, mx - 6.2, my - 4.4, 1.5, 1.3, '#f0e6c8');
  c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(mx - 5.6, my - 3, 1.4, 12);
}
// валун-соседство: дом вросся в скалу
function dwarfRocks(m, list) {
  for (const [x, y, rx, ry] of list) m.prop((c, sx, sy) => drawBoulder(c, sx, sy, rx, ry), x, y);
}

// Свинарник при боковом повороте: хлев тянется вдоль оси X (горизонтально, а не по диагонали
// глубины), загон лежит перед ним; ворота загона — на стороне входа. Свиньи ходят строго
// внутри четырёхугольника загона и не попадают на крышу.
function swineSide(m) {
  m.box({
    x0: 92, x1: 126, y0: 4, y1: 92, h: 20, wall: 'plank', col: '#7a5434', beam: '#3a2414',
    roof: { type: 'gable', axis: 'Y', rise: 15, mat: 'thatch', col: '#a8883e', ov: 4 },
    decor: { W: [{ t: 'hatch', at: 22, z: 2, w: 10, h: 10 }, { t: 'hatch', at: 48, z: 2, w: 10, h: 10 }, { t: 'hatch', at: 74, z: 2, w: 10, h: 10 }], S: [], E: [] },
  });
  m.ground((c, mm) => {
    groundPoly(c, mm, [[2, 2], [90, 2], [90, 94], [2, 94]], '#6a4a2a');
    for (let k = 0; k < 50; k++) { const q = mm.at(rnd(6, 86), rnd(6, 90)); ellipse(c, q[0], q[1], rnd(1.5, 5), rnd(1, 2.5), srand() < 0.5 ? '#553a20' : '#866038'); }
    for (const [x, y] of [[26, 22], [60, 72]]) { const q = mm.at(x, y); ellipse(c, q[0], q[1], 9, 3, '#3e3026'); ellipse(c, q[0] - 1, q[1] - 0.8, 5, 1.2, 'rgba(160,190,210,0.55)'); }
  });
  m.prop((c, x, y) => trough(c, x, y, 16, '#b8b060'), 44, 70);
  m.prop((c, x, y) => trough(c, x, y, 14, '#c8c070'), 70, 24);
  m.prop((c, x, y) => hayBale(c, x, y), 84, 86);
  const gx = m.doorX;
  m.fence([[gx + 8, 2], [90, 2]]);
  m.fence([[2, 2], [gx - 8, 2]]);
  m.fence([[2, 2], [2, 94], [90, 94]]);
  m.prop((c, x, y) => { c.fillStyle = '#6e4a2c'; c.fillRect(x - 8, y - 5, 16, 1); c.fillRect(x - 8, y - 2.5, 16, 1); line(c, x - 8, y - 1, x + 8, y - 5, '#6e4a2c', 0.8); }, gx, 2);
  m.g.spr.penQuad = [PL(m, 10, 10), PL(m, 84, 10), PL(m, 10, 88)];
  m.g.spr.pen = [0, 0, 0, 0];
}
