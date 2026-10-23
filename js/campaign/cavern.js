'use strict';
// Подгорье: подземный биом и свет для актов кампании «под горой» (акт 1; КАМПАНИЯ.md).
// Биом 'cavern' в меню новой игры не выбирается (его нет в BIOME_ORDER), но годится для карт: пол пещеры — камень,
// утоптанная земля и тёсаные плиты, без травы; стены — тёмные массивы без снежных шапок; деревья бледные.
// Свет: вместо обычной ночи акт с полем cave рисует вечный полумрак. Через дыры в своде (shafts) днём падают столбы солнца —
// только в них растут поля и деревья; ночью дыры почти гаснут. Фонари на улицах и в руках гномов горят всегда,
// светятся подгорные грибы. Логика суток (isNightNow, набеги, сон) не меняется — меняется только картинка.

if (typeof BIOMES !== 'undefined') {
  BIOMES.cavern = Object.assign({}, BIOMES.mountain, { name: 'Подгорье', icon: '⛏', desc: 'город под горой: камень, полумрак и солнце сквозь дыры в своде', events: [], evP: 0 });
  BIOME_PAL.cavern = Object.assign({}, BIOME_PAL.mountain, {
    g0: [58, 54, 50], g1: [84, 78, 70], dry: [96, 88, 76], dryK: 0.3, dirtT: 0.5, dirt: [70, 58, 46], sand: [122, 110, 94], rk: [0.82, 0.8, 0.86],
    moss: [70, 76, 60], w0: [40, 70, 92], w1: [14, 30, 52], foam: [150, 170, 180], foamK: 0.5,
    tuft: ['rgba(40,36,32,0.85)', 'rgba(110,104,92,0.8)'], flower: 0, flCols: [],
  });
  MT_PAL_BIOME.cavern = [
    { lit: ['#7a7064', '#5a5248'], shade: ['#3a342e', '#18140f'], rim: '#9a8e7c' },
    { lit: ['#6e6a66', '#504c48'], shade: ['#34302e', '#141210'], rim: '#8e8a84' },
    { lit: ['#80705c', '#5e5040'], shade: ['#3c3026', '#18120c'], rim: '#a08a6c' },
    { lit: ['#666c74', '#4a4e56'], shade: ['#2e3238', '#121418'], rim: '#868e98' },
  ];
  TREE_TINT.cavern = (r, g, b, l) => [l * 0.82 + 10, l * 0.92 + 8, l * 0.7];
}

// виды земли пещеры (кисти и сборка — groundstyle.js/groundsets.js)
if (typeof gsMk === 'function' && typeof gsMakeSet === 'function') {
  const ST = GS_STONE, DT = GS_DIRT, D = gsDec;
  gsMk('c_floor', 'cavern', 'П1. Пол пещеры', 'Серый камень в трещинах, щебень и валуны; ни травинки.', {
    ramp: [ST[1], ST[2], ST[3], ST[4]], ticks: 9,
    p: [{ ramp: [DT[0], DT[1], DT[2]], cell: 58, thr: 0.68, lv: [0.4, 0.75], dep: true }],
    dec: [D('cracks', 9, '#1c1916', '#706960'), D('gravel', 8), D('pebbles', 0.12), D('boulders', 0.06, false)],
  });
  gsMk('c_slab', 'cavern', 'П2. Тёсаные плиты', 'Гномья мостовая: плиты со швами, стёртые сотней лет шагов.', {
    ramp: [ST[2], ST[3], ST[4], ST[5]], ticks: 8,
    p: [{ ramp: [ST[1], ST[2], ST[3]], ridge: 0.03, cell: 60, lv: [0.4, 0.75], dep: true }, { ramp: [ST[4], ST[5], ST[6]], cell: 34, thr: 0.7, lv: [0.45, 0.7] }],
    dec: [D('cracks', 7, '#1c1916', '#867e74'), D('gravel', 4), D('pebbles', 0.06)],
  });
  gsMk('c_soil', 'cavern', 'П3. Подгорная земля', 'Тёмная утоптанная земля, корни сверху и бледные грибы.', {
    ramp: [DT[0], DT[1], DT[2], DT[3]], ticks: 10,
    p: [{ ramp: [ST[1], ST[2], ST[3]], cell: 50, thr: 0.68, lv: [0.4, 0.75] }],
    dec: [D('mushrooms', 0.16), D('roots', 0.4, 8), D('dirtBits', 0.3), D('pebbles', 0.08)],
  });
  gsMk('c_crystal', 'cavern', 'П4. Кристальная россыпь', 'Камень с искрами самоцветной крошки — подарок жилы.', {
    ramp: [ST[1], ST[2], ST[3], ST[4]], ticks: 9,
    p: [{ ramp: ['#2a2452', '#3a3070', '#4a3e88'], cell: 36, thr: 0.74, lv: [0.4, 0.75], dep: true }],
    dec: [D('sparkle', 8), D('gravel', 6), D('pebbles', 0.1), D('cracks', 6, '#1c1916', '#5c564f')],
  });
  gsMakeSet('cavern', [['c_floor', 34], ['c_slab', 26], ['c_soil', 26], ['c_crystal', 14]]);
}

// ---------- Свет под горой ----------

const caveAct = () => { const A = typeof campAct === 'function' ? campAct() : null; return A && A.cave ? A : null; };

if (typeof lampsOn === 'function') {
  const _lo = lampsOn;
  lampsOn = function () { return caveAct() ? true : _lo(); };
  const _ll = lanternLit;
  lanternLit = function (u) { return caveAct() ? !!u.lantern : _ll(u); };
}

const CAVE = { cv: null, ctx: null, motes: null };

// дыры в своде (клетки): [x, y, радиус]; днём — солнце, ночью — бледная луна
function caveShafts() { const A = caveAct(); return A ? A.cave.shafts(Game.camp) : []; }
function caveSunAmt() { return 1 - nightAmt() * 0.85; }

function drawCave(c, x0, y0, x1, y1) {
  nightSprites();
  const n = nightAmt(), sun = caveSunAmt();
  const cam = R.cam, z = devScale(), vw = R.canvas.width / z, vh = R.canvas.height / z, S = 4;
  const ox = Math.floor(cam.x / S) * S - S, oy = Math.floor(cam.y / S) * S - S;
  const w = Math.ceil(vw / S) + 3, h = Math.ceil(vh / S) + 3;
  if (!CAVE.cv) { CAVE.cv = document.createElement('canvas'); CAVE.ctx = CAVE.cv.getContext('2d'); }
  if (CAVE.cv.width !== w || CAVE.cv.height !== h) { CAVE.cv.width = w; CAVE.cv.height = h; }
  const l = CAVE.ctx;
  l.setTransform(1, 0, 0, 1, 0, 0); l.globalCompositeOperation = 'source-over'; l.globalAlpha = 1;
  l.clearRect(0, 0, w, h);
  l.setTransform(1 / S, 0, 0, 1 / S, -ox / S, -oy / S);
  l.fillStyle = `rgba(10,8,16,${0.5 + 0.34 * n})`;
  l.fillRect(ox, oy, w * S, h * S);
  l.globalCompositeOperation = 'destination-out';
  const shafts = caveShafts();
  for (const [sx, sy, sr] of shafts) {
    const r = sr * TILE * 1.7, x = (sx + 0.5) * TILE, y = (sy + 0.5) * TILE;
    l.globalAlpha = 0.25 + 0.75 * sun;
    l.drawImage(NIGHT.hole, x - r, y - r * 0.8, r * 2, r * 1.6);
    l.drawImage(NIGHT.hole, x - r * 0.7, y - r * 0.55, r * 1.4, r * 1.1);
  }
  const lights = nightLights(x0, y0, x1, y1);
  for (const [x, y, r, a] of lights) {
    const fl = 1 + Math.sin(Game.time * 7 + x * 0.3) * 0.04;
    l.globalAlpha = Math.min(1, a * 1.15);
    l.drawImage(NIGHT.hole, x - r * fl * 1.2, y - r * fl * 1.2, r * 2.4 * fl, r * 2.4 * fl);
  }
  for (const m of caveShrooms()) if (m[0] > x0 - 2 && m[0] < x1 + 2 && m[1] > y0 - 2 && m[1] < y1 + 2) {
    l.globalAlpha = 0.5; l.drawImage(NIGHT.hole, m[0] * TILE - 22, m[1] * TILE - 18, 44, 36);
  }
  l.globalCompositeOperation = 'source-over'; l.globalAlpha = 1;
  c.save();
  c.imageSmoothingEnabled = true;
  c.drawImage(CAVE.cv, ox, oy, w * S, h * S);
  // столбы света (caveBeam): пятно на полу, объёмный луч из волокон, пылинки
  c.globalCompositeOperation = 'lighter';
  for (const s of shafts) {
    if (s[0] < x0 - 10 || s[0] > x1 + 10 || s[1] < y0 - 4 || s[1] > y1 + 16) continue;
    caveBeam(c, s, sun);
  }
  // ореолы фонарей и костров
  for (const [x, y, r, a, kind] of lights) {
    c.globalAlpha = (kind === 'ent' ? 0.3 : 0.2) * a;
    c.drawImage(kind === 'ent' ? NIGHT.eerie : NIGHT.warm, x - r * 0.7, y - r * 0.7, r * 1.4, r * 1.4);
  }
  c.restore();
  c.imageSmoothingEnabled = R.smooth;
}

// ---------- Столб солнца: объёмный луч ----------
// Луч в своих единицах (r — радиус дыры): пол — y = 0, свод — y = −BEAM_H; сверху уже, к полу шире, наклонён (солнце слева сверху).
// Тело луча и волокна света запекаются один раз в два варианта (A и B) и медленно перетекают друг в друга — свет «дышит».
// Поверх — пятно на полу (тёплое ядро и отсвет), а в объёме луча плавают пылинки: в середине ярче, у краёв гаснут.
const BEAM_H = 4.6, BEAM_LEAN = 0.16, BEAM_W = 1.35, BEAM_PX = 40;   // высота, наклон, полуширина спрайта (в r), пикселей на r
const beamHW = v => 0.4 + (1 - v / -BEAM_H) * 0.72;                  // полуширина луча на высоте v (v ≤ 0)

function caveBeamSpr(k) {
  const key = 'beam' + k;
  if (CAVE[key]) return CAVE[key];
  const W = Math.round(BEAM_W * 2 * BEAM_PX), H = Math.round((BEAM_H + 0.3) * BEAM_PX);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d'), rnd = mulberry32(0xBEA4 + k * 977);
  c.translate(W / 2, BEAM_H * BEAM_PX); c.scale(BEAM_PX, BEAM_PX);
  const ray = (u0, u1, a, end) => {                   // волокно: полоса от свода к полу, расходится вместе с лучом
    const g = c.createLinearGradient(0, -BEAM_H, 0, 0);
    g.addColorStop(0, 'rgba(255,246,220,0)'); g.addColorStop(0.12, `rgba(255,246,220,${a})`);
    g.addColorStop(end, `rgba(255,236,196,${a * 0.7})`); g.addColorStop(Math.min(1, end + 0.12), 'rgba(255,236,196,0)');
    c.fillStyle = g;
    const t = beamHW(-BEAM_H), b = beamHW(0);
    c.beginPath(); c.moveTo(u0 * t, -BEAM_H); c.lineTo(u1 * t, -BEAM_H); c.lineTo(u1 * b, 0); c.lineTo(u0 * b, 0); c.closePath(); c.fill();
  };
  c.globalCompositeOperation = 'lighter';
  if ('filter' in c) c.filter = 'blur(1.5px)';
  // тело: мягкая середина, края тают; книзу чуть плотнее
  for (let i = 0; i < 7; i++) { const w = 1 - i * 0.13; ray(-w, w, 0.035 + i * 0.008, 0.86); }
  // волокна: узкие и широкие, разной длины и силы
  for (let i = 0; i < 16; i++) {
    const u = (rnd() * 2 - 1) * 0.85, w = 0.03 + rnd() * 0.12;
    ray(u - w, u + w, 0.07 + rnd() * 0.2, 0.45 + rnd() * 0.45);
  }
  if ('filter' in c) c.filter = 'none';
  return (CAVE[key] = cv);
}
// пятно света на полу: тёплое ядро, мягкий край
function caveBeamPool() {
  if (CAVE.pool) return CAVE.pool;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c = cv.getContext('2d'), g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,248,226,0.95)'); g.addColorStop(0.35, 'rgba(255,236,190,0.7)'); g.addColorStop(0.7, 'rgba(255,214,150,0.25)'); g.addColorStop(1, 'rgba(255,200,130,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  return (CAVE.pool = cv);
}
function caveBeam(c, s, sun) {
  const [sx, sy, sr] = s, x = (sx + 0.5) * TILE, y = (sy + 0.5) * TILE, r = sr * TILE, t = Game.time;
  const amp = 0.08 + 0.92 * sun;                                            // ночью — бледный лунный столб
  // пол: широкий отсвет и яркое пятно под лучом
  c.globalAlpha = 0.12 * amp; c.drawImage(NIGHT.warm, x - r * 1.9, y - r * 1.25, r * 3.8, r * 2.5);
  const P = caveBeamPool();
  c.globalAlpha = 0.26 * amp; c.drawImage(P, x - r * 1.2, y - r * 0.68, r * 2.4, r * 1.36);
  c.globalAlpha = 0.16 * amp; c.drawImage(P, x - r * 0.6, y - r * 0.34, r * 1.2, r * 0.68);
  // луч: два запечённых варианта перетекают друг в друга
  c.save();
  c.translate(x, y); c.transform(1, 0, BEAM_LEAN, 1, 0, 0); c.scale(r, r);
  const A = caveBeamSpr(0), B = caveBeamSpr(1), w = BEAM_W * 2, h = BEAM_H + 0.3, k = 0.5 + 0.5 * Math.sin(t * 0.35 + sx * 1.7);
  c.globalAlpha = (0.36 + 0.22 * k) * amp; c.drawImage(A, -BEAM_W, -BEAM_H, w, h);
  c.globalAlpha = (0.36 + 0.22 * (1 - k)) * amp; c.drawImage(B, -BEAM_W, -BEAM_H, w, h);
  // пылинки: медленно кружат в объёме луча; в середине ярче, у краёв и под сводом гаснут, иногда вспыхивают
  const px = 1 / r;
  for (let i = 0; i < 30; i++) {
    const f = (i * 0.618 + t * 0.011 * (1 + (i % 3) * 0.5)) % 1, v = -BEAM_H * 0.92 * (1 - f) - 0.05;
    const u = Math.sin(i * 12.9898) * 0.8 + Math.sin(t * 0.3 + i) * 0.12, d = Math.abs(u);
    const tw = 0.35 + 0.65 * Math.max(0, Math.sin(t * 1.3 + i * 2.1)), edge = Math.min(1, f * 6, (1 - f) * 8);
    const a = tw * edge * (1 - d * 0.75) * amp;
    if (a < 0.05) continue;
    const big = i % 6 === 0 ? 2 : 1;
    c.globalAlpha = Math.min(1, a);
    c.fillStyle = i % 4 ? '#fff4d6' : '#ffffff';
    c.fillRect(u * beamHW(v), v, big * px, big * px);
  }
  c.restore();
  c.globalAlpha = 1;
}

// светящиеся подгорные грибы: где — решает акт (Game.camp.flags.shrooms), рисуются в общем списке по глубине
function caveShrooms() { const C = Game.camp; return C && C.flags.shrooms || []; }
function caveDrawShroom(c, m) {
  const x = Math.round(m[0] * TILE), y = Math.round(m[1] * TILE), t = Game.time, k = m[2] || 0;
  const cols = [['#7ae0d0', '#2a8a80'], ['#b08aff', '#5a3aa8'], ['#e0f080', '#7a9a2a']][k % 3];
  for (let i = 0; i < 3; i++) {
    const dx = [-4, 2, 6][i], hgt = [5, 8, 4][i], w = [3, 4, 2.5][i];
    c.fillStyle = '#d8d0c0'; c.fillRect(x + dx, y - hgt, 1, hgt);
    c.fillStyle = cols[1]; c.beginPath(); c.ellipse(x + dx + 0.5, y - hgt, w, w * 0.6, 0, Math.PI, 0); c.fill();
    c.fillStyle = cols[0]; c.fillRect(x + dx - 1, y - hgt - w * 0.4, 2, 1);
  }
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.35 + Math.sin(t * 1.6 + m[0]) * 0.12;
  if (typeof NIGHT !== 'undefined' && NIGHT.eerie) c.drawImage(NIGHT.eerie, x - 12, y - 18, 26, 22);
  c.restore();
}

if (typeof drawNight === 'function') {
  const _dn = drawNight;
  drawNight = function (c, x0, y0, x1, y1) { if (caveAct()) drawCave(c, x0, y0, x1, y1); else _dn(c, x0, y0, x1, y1); };
}
if (typeof drawDusk === 'function') {
  const _dd = drawDusk;
  drawDusk = function (c) { if (!caveAct()) _dd(c); };   // закат под горой не виден
}
