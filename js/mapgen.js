'use strict';
// Разнообразие карт: биомы (луга, лес, степь, горы, болото, зима), реки, озёра, горные хребты,
// размеры карты и случайные события местности (метель, паводок).
// Сейв хранит id биома (поле bi) и размер (mw, mh); сейвы без bi — «старая» карта без биома,
// она воссоздаётся ровно как раньше. Сервер кооп считает карту по сиду тем же кодом, клиенты рисуют.

const MAP_SIZES = {
  small:  { name: 'Малая',    w: 96,  h: 72,  desc: '96×72: тесно, быстро' },
  medium: { name: 'Средняя',  w: 128, h: 96,  desc: '128×96' },
  large:  { name: 'Большая',  w: 160, h: 120, desc: '160×120: простор' },
};
const MAP_SIZE_ORDER = ['small', 'medium', 'large'];

// wT — порог воды (шум ниже = вода), rT — порог скал (шум выше = скала), fT/fP — порог и шанс леса,
// sT — шанс одиночных деревьев, stT — порог каменных россыпей, crys — порог кристаллов на скалах,
// rivers/lakes/ranges — [мин, макс] рек, озёр и горных хребтов, ponds — болотные заводи, ore — жилы руды на скалах
const BIOMES = {
  meadow: {
    name: 'Луга', icon: '🌾', desc: 'зелёные холмы, реки и озёра — привычная земля',
    wT: 0.28, rT: 0.72, fT: 0.62, fP: 0.75, sT: 0.012, stT: 0.84, crys: 0.72,
    rivers: [1, 2], lakes: [2, 3], ranges: [0, 1], ponds: 0, ore: 0.05, events: ['flood'], evP: 0.4,
  },
  forest: {
    name: 'Дремучий лес', icon: '🌲', desc: 'густые чащи: дерева в избытке, поляны редки',
    wT: 0.24, rT: 0.76, fT: 0.40, fP: 0.88, sT: 0.02, stT: 0.86, crys: 0.72,
    rivers: [1, 2], lakes: [1, 2], ranges: [0, 0], ponds: 0, ore: 0.04, events: ['flood'], evP: 0.35,
  },
  steppe: {
    name: 'Степь', icon: '🏜', desc: 'ширь и ветер: мало леса, зато камня и места хватит',
    wT: 0.19, rT: 0.74, fT: 0.80, fP: 0.55, sT: 0.004, stT: 0.78, crys: 0.70,
    rivers: [1, 1], lakes: [1, 2], ranges: [1, 1], ponds: 0, ore: 0.07, events: ['flood'], evP: 0.25,
  },
  mountain: {
    name: 'Горы', icon: '⛰', desc: 'хребты и ущелья, много руды и кристаллов; ровных мест мало',
    wT: 0.22, rT: 0.63, fT: 0.68, fP: 0.7, sT: 0.01, stT: 0.80, crys: 0.60,
    rivers: [1, 1], lakes: [1, 1], ranges: [2, 3], ponds: 0, ore: 0.30, events: ['blizzard'], evP: 0.22,
  },
  swamp: {
    name: 'Болото', icon: '🐸', desc: 'трясина, заводи и кочки: мало сухой земли, дерево есть, камня мало',
    wT: 0.35, rT: 0.80, fT: 0.52, fP: 0.62, sT: 0.02, stT: 0.90, crys: 0.76,
    rivers: [0, 1], lakes: [3, 5], ranges: [0, 0], ponds: 0.78, ore: 0.03, events: ['flood'], evP: 0.5,
  },
  winter: {
    name: 'Зима', icon: '❄', desc: 'снег, лёд на озёрах и реках, метели',
    wT: 0.27, rT: 0.68, fT: 0.50, fP: 0.78, sT: 0.01, stT: 0.84, crys: 0.66,
    rivers: [1, 2], lakes: [2, 3], ranges: [1, 2], ponds: 0, ore: 0.14, events: ['blizzard'], evP: 0.6,
  },
  coast: {
    name: 'Побережье', icon: '🌊', desc: 'море у края земли: бухты, острова, пляжи с галькой, чайки и крабы',
    wT: 0.22, rT: 0.74, fT: 0.6, fP: 0.74, sT: 0.012, stT: 0.85, crys: 0.72,
    rivers: [1, 1], lakes: [1, 2], ranges: [0, 1], ponds: 0, ore: 0.05, sea: true, events: ['flood'], evP: 0.3,
  },
};
const BIOME_ORDER = ['meadow', 'forest', 'steppe', 'mountain', 'swamp', 'winter', 'coast'];

// Палитры земли для попиксельной отрисовки (meadow — прежние цвета)
const BIOME_PAL = {
  meadow:   { g0: [58, 110, 24], g1: [98, 160, 40], dry: [150, 152, 56], dryK: 0.35, dirtT: 0.66, dirt: [98, 84, 58], sand: [196, 172, 118], rk: [1, 1, 1], moss: [80, 100, 50], w0: [64, 128, 138], w1: [24, 68, 112], foam: [235, 242, 240], foamK: 1, tuft: ['rgba(46,78,22,0.85)', 'rgba(130,168,70,0.85)'], flower: 0.12, flCols: ['#f4e46a', '#f2f2f6', '#d47cc8', '#e86a4a', '#8ab4f0'] },
  forest:   { g0: [34, 78, 22], g1: [62, 118, 34], dry: [96, 110, 44], dryK: 0.3, dirtT: 0.68, dirt: [84, 70, 44], sand: [186, 164, 112], rk: [0.92, 0.95, 0.92], moss: [60, 96, 44], w0: [52, 112, 120], w1: [20, 58, 92], foam: [220, 232, 228], foamK: 0.8, tuft: ['rgba(26,56,16,0.9)', 'rgba(96,140,56,0.85)'], flower: 0.05, flCols: ['#f2f2f6', '#f4e46a', '#c874c0'] },
  steppe:   { g0: [150, 138, 60], g1: [196, 178, 86], dry: [176, 150, 70], dryK: 0.5, dirtT: 0.6, dirt: [128, 104, 66], sand: [214, 188, 128], rk: [1.08, 1.0, 0.9], moss: [140, 140, 70], w0: [70, 134, 140], w1: [30, 78, 112], foam: [240, 240, 232], foamK: 0.9, tuft: ['rgba(110,88,28,0.9)', 'rgba(222,200,108,0.9)'], flower: 0.035, flCols: ['#e86a4a', '#f4e46a', '#d0a0e8'] },
  mountain: { g0: [72, 98, 54], g1: [106, 128, 72], dry: [142, 138, 112], dryK: 0.5, dirtT: 0.6, dirt: [112, 104, 92], sand: [182, 166, 134], rk: [1.02, 1.0, 1.06], moss: [76, 98, 60], w0: [58, 118, 146], w1: [20, 62, 104], foam: [238, 244, 246], foamK: 1, tuft: ['rgba(48,70,34,0.9)', 'rgba(150,170,100,0.85)'], flower: 0.05, flCols: ['#f2f2f6', '#8ab4f0', '#d47cc8'] },
  swamp:    { g0: [42, 70, 30], g1: [70, 96, 40], dry: [92, 84, 40], dryK: 0.3, dirtT: 0.56, dirt: [56, 60, 34], sand: [122, 120, 78], rk: [0.9, 0.95, 0.9], moss: [66, 92, 46], w0: [64, 92, 70], w1: [30, 52, 46], foam: [128, 150, 82], foamK: 0.55, tuft: ['rgba(30,48,18,0.9)', 'rgba(110,138,58,0.85)'], flower: 0.02, flCols: ['#f2f2f6', '#f4e46a'] },
  coast:    { g0: [60, 112, 30], g1: [104, 164, 48], dry: [158, 156, 70], dryK: 0.4, dirtT: 0.66, dirt: [112, 96, 64], sand: [204, 180, 124], rk: [1, 0.98, 0.96], moss: [84, 104, 56], w0: [70, 150, 160], w1: [24, 66, 118], foam: [240, 250, 248], foamK: 1, tuft: ['rgba(48,82,24,0.85)', 'rgba(150,180,80,0.85)'], flower: 0.08, flCols: ['#f2f2f6', '#f4e46a', '#e8a0c8'] },
  winter:   { g0: [204, 226, 240], g1: [244, 250, 254], dry: [196, 220, 238], dryK: 0.25, dirtT: 0.93, dirt: [96, 90, 86], sand: [168, 188, 212], rk: [0.95, 1.0, 1.12], moss: [196, 212, 228], w0: [200, 222, 236], w1: [150, 188, 216], foam: [248, 252, 255], foamK: 0, ice: true, snow: true, tuft: ['rgba(96,116,140,0.9)', 'rgba(250,252,255,0.95)'], flower: 0, flCols: [] },
};

const MapOpt = { biome: null, custom: null };       // biome null — карта без биома (старые сейвы); custom — пользовательская карта (mapedit.js)
const biomeId = () => MapOpt.biome;
const biomeDef = () => (MapOpt.biome ? BIOMES[MapOpt.biome] || null : null);
const biomePal = () => BIOME_PAL[MapOpt.biome] || BIOME_PAL.meadow;
const isWinterMap = () => MapOpt.biome === 'winter';

// Сид из текста: цифры — как есть, слова — хэш строки
function mapSeedFrom(txt) {
  const s = String(txt == null ? '' : txt).trim();
  if (!s) return (Math.random() * 1e9) | 0;
  if (/^\d{1,9}$/.test(s)) return +s;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 1000000000;
}

// ---------- Реки, озёра, хребты ----------

// Вода/скала кругом
function mgDisc(ox, oy, rad, fn) {
  for (let y = Math.floor(oy - rad); y <= Math.ceil(oy + rad); y++)
    for (let x = Math.floor(ox - rad); x <= Math.ceil(ox + rad); x++)
      if (inb(x, y) && (x - ox) ** 2 + (y - oy) ** 2 <= rad * rad) fn(x, y, idx(x, y));
}

// Извилистая река через всю карту. Русло — сумма синусов; ширина плавает; в нескольких местах — броды (песчаные мели)
function mgRiver(R, cx, cy, wide) {
  const horiz = R() < 0.5;
  const L = horiz ? MAP_W : MAP_H, Wd = horiz ? MAP_H : MAP_W, cc = horiz ? cy : cx;
  const off = Math.min(26, Wd * 0.22);
  const base = cc + (R() < 0.5 ? -1 : 1) * (off - 2 + R() * 6);
  const A1 = 3 + R() * 5, A2 = 1 + R() * 2.5, f1 = 0.05 + R() * 0.05, f2 = 0.13 + R() * 0.08, p1 = R() * 6.28, p2 = R() * 6.28;
  const w0 = (wide ? 2.2 : 1.4) + R() * 0.9;
  const pos = [];
  for (let t = 0; t < L; t++) {
    const lat = base + Math.sin(t * f1 + p1) * A1 + Math.sin(t * f2 + p2) * A2;
    const w = w0 + Math.sin(t * 0.09 + p2) * 0.7 + (R() - 0.5) * 0.3;
    pos.push([lat, Math.max(1, w)]);
    const x = horiz ? t : lat, y = horiz ? lat : t;
    mgDisc(x, y, Math.max(1, w), (xx, yy, i) => { World.terrain[i] = T_WATER; });
  }
  // броды: каждые ~30 клеток, не рядом с центром карты
  const gap = 24 + (R() * 10 | 0);
  for (let t = 8 + (R() * 14 | 0); t < L - 4; t += gap + (R() * 8 | 0)) {
    const [lat, w] = pos[t];
    for (let dt = 0; dt < 3; dt++) {
      const [l2, w2] = pos[Math.min(L - 1, t + dt)];
      for (let d = -Math.ceil(w2) - 1; d <= Math.ceil(w2) + 1; d++) {
        const lc = Math.round(l2) + d, x = horiz ? t + dt : lc, y = horiz ? lc : t + dt;
        if (inb(x, y) && World.terrain[idx(x, y)] === T_WATER) World.terrain[idx(x, y)] = T_SAND;
      }
    }
  }
}

// Озеро неправильной формы
function mgLake(R, cx, cy, small) {
  for (let tries = 0; tries < 20; tries++) {
    const rx = small ? 2 + R() * 2.5 : 4 + R() * 5, ry = small ? 1.6 + R() * 2 : 3 + R() * 4;
    const x = rx + 3 + R() * (MAP_W - 2 * rx - 6), y = ry + 3 + R() * (MAP_H - 2 * ry - 6);
    if (Math.hypot(x - cx, (y - cy) * 1.15) < 24 + rx) continue;
    const rot = R() * 3.14, a1 = 0.15 + R() * 0.15, a2 = 0.1 + R() * 0.12, p1 = R() * 6.28, p2 = R() * 6.28, n1 = 2 + (R() * 3 | 0), n2 = 4 + (R() * 3 | 0);
    const mr = Math.max(rx, ry) * 1.5;
    for (let yy = Math.floor(y - mr); yy <= Math.ceil(y + mr); yy++) for (let xx = Math.floor(x - mr); xx <= Math.ceil(x + mr); xx++) {
      if (!inb(xx, yy)) continue;
      const dx = xx - x, dy = yy - y;
      const ux = dx * Math.cos(rot) + dy * Math.sin(rot), uy = -dx * Math.sin(rot) + dy * Math.cos(rot);
      const th = Math.atan2(uy / ry, ux / rx);
      const k = 1 + a1 * Math.sin(n1 * th + p1) + a2 * Math.sin(n2 * th + p2);
      if ((ux / rx) ** 2 + (uy / ry) ** 2 <= k * k) World.terrain[idx(xx, yy)] = T_WATER;
    }
    return;
  }
}

// Горный хребет: извилистая цепь скал с проходами
function mgRange(R, cx, cy) {
  for (let tries = 0; tries < 20; tries++) {
    let x = 6 + R() * (MAP_W - 12), y = 6 + R() * (MAP_H - 12);
    if (Math.hypot(x - cx, (y - cy) * 1.15) < 30) continue;
    let h = R() * 6.28;
    const len = 26 + R() * 40;
    let passAt = 12 + R() * 10;
    for (let s = 0; s < len; s++) {
      h += (R() - 0.5) * 0.35;
      x += Math.cos(h); y += Math.sin(h) * 0.9;
      if (!inb(Math.round(x), Math.round(y))) break;
      if (Math.hypot(x - cx, (y - cy) * 1.15) < 22) continue;
      passAt--;
      if (passAt < 0 && passAt > -4) continue;      // проход между вершинами
      if (passAt <= -4) passAt = 14 + R() * 12;
      const rad = 1.8 + Math.sin(s * 0.22 + h) * 0.6 + R() * 0.8;
      mgDisc(x, y, rad, (xx, yy, i) => { if (World.terrain[i] !== T_WATER) World.terrain[i] = T_ROCK; });
    }
    return;
  }
}

// Заводи и кочки болота: мелкие лужицы по высокочастотному шуму
function mgPonds(R, thr) {
  const n1 = makeNoise(R, 5), n2 = makeNoise(R, 3);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const v = n1(x, y) * 0.65 + n2(x, y) * 0.35;
    if (v > thr && World.terrain[idx(x, y)] !== T_ROCK) World.terrain[idx(x, y)] = T_WATER;
  }
}

// Море у одного края карты: извилистый берег, бухты (море вдаётся в сушу) и мысы, острова, скалы-кекуры у мысов.
// Берег не ближе 26 клеток к старту. Сторона и форма — от сида (тот же R, что у рек)
function mgSea(R, cx, cy) {
  const side = (R() * 4) | 0;                    // 0 — юг, 1 — восток, 2 — север, 3 — запад
  const horiz = side === 0 || side === 2;
  const L = horiz ? MAP_W : MAP_H, D = horiz ? MAP_H : MAP_W;
  const cc = horiz ? cy : cx;
  const maxDepth = Math.max(10, D - cc - 26);    // сколько клеток от края можно отдать морю
  const base = Math.min(maxDepth - 4, D * 0.2 + R() * 4);
  const waves = [[0.04 + R() * 0.03, R() * 6.28, 3 + R() * 2], [0.11 + R() * 0.06, R() * 6.28, 1.4 + R()], [0.27 + R() * 0.1, R() * 6.28, 0.6]];
  const bays = [];
  for (let n = 2 + ((R() * 2) | 0); n > 0; n--) bays.push([R() * L, 4 + R() * 6, (R() < 0.7 ? 1 : -1) * (4 + R() * 6)]);   // центр, ширина, глубина (минус — мыс)
  const depthAt = t => {
    let d = base;
    for (const [f, p, a] of waves) d += Math.sin(t * f + p) * a;
    for (const [c0, w, a] of bays) d += a * Math.exp(-((t - c0) * (t - c0)) / (2 * w * w));
    return Math.max(3, Math.min(maxDepth, d));
  };
  const at = (t, d) => {                         // t — вдоль берега, d — от края карты вглубь
    if (side === 0) return [t, MAP_H - 1 - d];
    if (side === 2) return [t, d];
    if (side === 1) return [MAP_W - 1 - d, t];
    return [d, t];
  };
  const shore = [];
  for (let t = 0; t < L; t++) {
    const dd = depthAt(t);
    shore.push(dd);
    for (let d = 0; d < dd; d++) { const [x, y] = at(t, d); if (inb(x, y)) World.terrain[idx(x, y)] = T_WATER; }
  }
  // острова: подальше от берега, неровные
  for (let n = 1 + ((R() * 3) | 0), tries = 0; n > 0 && tries < 30; tries++) {
    const t = 6 + R() * (L - 12), dd = shore[Math.floor(t)];
    if (dd < 9) continue;
    const d = 2 + R() * (dd - 7), rad = 1.6 + R() * Math.min(4, (dd - 5) / 2.5);
    const [ox, oy] = at(t, d), p = R() * 6.28;
    for (let yy = Math.floor(oy - rad - 1); yy <= oy + rad + 1; yy++) for (let xx = Math.floor(ox - rad - 1); xx <= ox + rad + 1; xx++) {
      if (!inb(xx, yy)) continue;
      const a = Math.atan2(yy - oy, xx - ox), r = rad * (1 + 0.25 * Math.sin(a * 3 + p));
      if (Math.hypot(xx - ox, yy - oy) <= r) World.terrain[idx(xx, yy)] = R() < 0.06 && rad > 2.5 ? T_ROCK : T_GRASS;
    }
    n--;
  }
  // кекуры: одиночные скалы в воде у мысов (там сидят бакланы)
  for (let n = 2 + ((R() * 3) | 0); n > 0; n--) {
    const t = Math.floor(R() * L), [x, y] = at(t, Math.max(1, shore[t] - 1 - ((R() * 2) | 0)));
    if (inb(x, y)) World.terrain[idx(x, y)] = T_ROCK;
  }
}

// Пляж у моря шире обычного песка: 2–3 клетки, кое-где трава доходит до воды (после общего песка, genWorld)
function mgBeach(seed) {
  const bio = biomeDef();
  if (!bio || !bio.sea) return;
  const n = makeNoise(mulberry32((seed ^ 0x5EA5) >>> 0), 6);
  const W = MAP_W, H = MAP_H, T = World.terrain;
  const mark = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y);
    if (T[i] !== T_GRASS || World.obj[i]) continue;
    const r = n(x, y) > 0.55 ? 3 : n(x, y) > 0.3 ? 2 : 1;
    let near = false;
    for (let dy = -r; dy <= r && !near; dy++) for (let dx = -r; dx <= r; dx++) {
      const xx = x + dx, yy = y + dy;
      if (inb(xx, yy) && T[idx(xx, yy)] === T_WATER && (xx === 0 || yy === 0 || xx === W - 1 || yy === H - 1 || Math.hypot(dx, dy) <= r)) { near = true; break; }
    }
    if (near) mark.push(i);
  }
  for (const i of mark) T[i] = T_SAND;
}

// Вызывается из genWorld до стартовой поляны. R — отдельный генератор: основной поток случайных чисел не сдвигается
function genBiomeFeatures(seed, cx, cy) {
  const bio = biomeDef();
  if (!bio) return;
  const R = mulberry32((seed ^ 0xB10E5) >>> 0);
  const pick = ([a, b]) => a + ((R() * (b - a + 1)) | 0);
  const k = Math.max(0.7, Math.sqrt(MAP_W * MAP_H / (160 * 120)));   // на малой карте рек и озёр меньше
  const wide = MapOpt.biome === 'swamp' || MapOpt.biome === 'steppe';
  if (bio.sea) mgSea(R, cx, cy);
  if (bio.ponds) mgPonds(R, bio.ponds);
  for (let n = pick(bio.rivers); n > 0; n--) mgRiver(R, cx, cy, wide);
  for (let n = Math.round(pick(bio.lakes) * k); n > 0; n--) mgLake(R, cx, cy, MapOpt.biome === 'swamp');
  for (let n = Math.round(pick(bio.ranges) * k); n > 0; n--) mgRange(R, cx, cy);
}

// ---------- События местности: метель и паводок ----------
// Расписание — чистая функция сида и времени: сервер и клиенты видят одно и то же без обмена пакетами.

const MAPEV = { cur: null, low: null, key: '' };
const MAPEV_WIN = 540;

function mapEvAt(t) {
  const bio = biomeDef();
  if (!bio || !bio.events.length || typeof Game === 'undefined') return null;
  const w = Math.floor(t / MAPEV_WIN);
  if (w < 1) return null;                                     // первые минуты — без событий
  const h = salt => mulberry32(((Game.seed | 0) * 31 + w * 7919 + salt * 104729) >>> 0)();
  if (h(1) > bio.evP) return null;
  const t0 = w * MAPEV_WIN + 60 + h(2) * (MAPEV_WIN - 260), dur = 100 + h(3) * 60;
  if (t < t0 || t >= t0 + dur) return null;
  const kind = bio.events[Math.floor(h(4) * bio.events.length)];
  return { kind, t0, t1: t0 + dur, w, k: Math.max(0, Math.min(1, (t - t0) / 10, (t0 + dur - t) / 12)) };
}

// Клетки пойменной полосы: песок/мели рядом с водой (их заливает паводок)
function mapEvLow() {
  const key = Game.seed + ':' + MapOpt.biome + ':' + MAP_W;
  if (MAPEV.low && MAPEV.key === key) return MAPEV.low;
  const low = [];
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const t = World.terrain[idx(x, y)];
    if (t !== T_SAND) continue;
    let near = false;
    for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++)
      if (inb(x + dx, y + dy) && World.terrain[idx(x + dx, y + dy)] === T_WATER) { near = true; break; }
    if (near) low.push(idx(x, y));
  }
  MAPEV.low = low; MAPEV.key = key;
  return low;
}

// Раз в тик симуляции: начало и конец события, дождь/снегопад под него
function mapEvTick() {
  const ev = startOpen('flood') ? mapEvAt(Game.time) : null;
  const was = MAPEV.cur;
  MAPEV.cur = ev;
  MAPEV.k = ev ? ev.k : 0;
  if (ev && (!was || was.w !== ev.w)) {
    if (ev.kind === 'blizzard') { logEvent('weather', 'Началась метель'); toast('❄ Метель! Снег валит стеной, на улицах скользко — гномы жмутся к домам.'); }
    else { logEvent('weather', 'Паводок'); toast('🌊 Паводок: река вышла из берегов, броды затоплены. Переждите — вода скоро сойдёт.'); }
    if (typeof WX !== 'undefined' && typeof rainStart === 'function' && WX.target === 0) rainStart(ev.t1 - Game.time);
  } else if (!ev && was) {
    logEvent('weather', was.kind === 'blizzard' ? 'Метель утихла' : 'Вода сошла');
  }
}

// Поверх мира: метель — белая пелена и косые полосы снега; паводок — вода на пойме
function drawMapEvent(c) {
  const ev = MAPEV.cur;
  if (!ev || !(MAPEV.k > 0.01)) return;
  const k = MAPEV.k, cam = R.cam, z = devScale();
  const vw = R.canvas.width / z, vh = R.canvas.height / z;
  const now = performance.now() / 1000;
  if (ev.kind === 'blizzard') {
    c.fillStyle = `rgba(222,232,244,${0.34 * k})`;
    c.fillRect(cam.x - 4, cam.y - 4, vw + 8, vh + 8);
    c.save();
    c.lineCap = 'round';
    const n = Math.round(Math.min(520, vw * vh / 700) * k);
    for (const [layer, len, spd, alpha, lw] of [[0, 14, 520, 0.55, 1], [1, 24, 760, 0.8, 1.4]]) {
      c.strokeStyle = `rgba(255,255,255,${alpha * Math.min(1, k * 1.3)})`; c.lineWidth = lw;
      c.beginPath();
      const m = Math.round(n * (layer ? 0.45 : 0.7));
      for (let i = 0; i < m; i++) {
        const sx = frac01(i * 0.617 + layer * 11), sy = frac01(i * 1.913 + 5 + layer * 3);
        const x = ((sx * (vw + 120) - now * spd * 0.9) % (vw + 120) + vw + 120) % (vw + 120) - 40;
        const y = ((sy * vh + now * spd * 0.28) % (vh + 20)) - 10;
        c.moveTo(cam.x + x, cam.y + y); c.lineTo(cam.x + x - len, cam.y + y + len * 0.3);
      }
      c.stroke();
    }
    c.restore();
  } else {
    const low = mapEvLow(), x0 = Math.floor(cam.x / TILE) - 1, x1 = Math.ceil((cam.x + vw) / TILE) + 1, y0 = Math.floor(cam.y / TILE) - 1, y1 = Math.ceil((cam.y + vh) / TILE) + 1;
    c.save();
    for (const i of low) {
      const x = i % MAP_W, y = (i / MAP_W) | 0;
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      const px = x * TILE, py = y * TILE, wv = Math.sin(now * 1.6 + x * 0.8 + y * 0.5);
      c.fillStyle = `rgba(52,112,150,${0.55 * k})`; c.fillRect(px, py, TILE, TILE);
      c.fillStyle = `rgba(190,224,240,${(0.16 + 0.1 * wv) * k})`;
      c.fillRect(px + 3, py + 8 + wv * 2, TILE - 8, 2); c.fillRect(px + 9, py + 20 - wv * 2, TILE - 12, 2);
    }
    c.restore();
  }
}

// ---------- Спрайты природы под биом ----------
// Деревья и валуны перекрашиваются из своих же спрайтов (и снова сводятся к палитре игры): снег на ветвях, сухая степь, тёмная чаща, болотная ржа.

function mgTint(src, fn) {
  const cv = mkCanvas(src.width, src.height), c = cv.getContext('2d');
  c.drawImage(src, 0, 0);
  const im = c.getImageData(0, 0, cv.width, cv.height);
  fn(im.data, cv.width, cv.height);
  quantizeData(im.data, cv.width, cv.height, 0);
  c.putImageData(im, 0, 0);
  return cv;
}

const TREE_TINT = {
  forest: (r, g, b, l) => [l * 0.62, l * 0.92, l * 0.6],
  steppe: (r, g, b, l) => [l * 1.12 + 22, l * 1.0 + 12, l * 0.42],
  mountain: (r, g, b, l) => [l * 0.78, l * 0.95, l * 0.88],
  swamp: (r, g, b, l) => [l * 0.82 + 4, l * 0.86 + 4, l * 0.5],
};

function mgTintTrees(src, bio) {
  return mgTint(src, (d, w, h) => {
    const a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[(y * w + x) * 4 + 3]);
    const out = new Uint8ClampedArray(d);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (d[o + 3] < 100) continue;
      const r = d[o], g = d[o + 1], b = d[o + 2], l = (r + g + b) / 3;
      const leaf = g > r * 1.02 && g > b * 1.05;
      if (bio === 'winter') {
        let nr = r, ng = g, nb = b;
        if (leaf) { nr = l * 0.5; ng = l * 0.78; nb = l * 0.72; }
        const top = a(x, y - 1) < 100 || a(x, y - 2) < 100;
        if ((leaf || top) && y < h * 0.8 && (top || (l > 90 && ((x * 7 + y * 13) % 5) < 2))) { const sh = ((x + y) & 1) ? 0 : 1; nr = sh ? 186 : 240; ng = sh ? 204 : 246; nb = sh ? 226 : 253; }
        out[o] = nr; out[o + 1] = ng; out[o + 2] = nb;
      } else if (leaf && TREE_TINT[bio]) {
        const [nr, ng, nb] = TREE_TINT[bio](r, g, b, l);
        out[o] = nr; out[o + 1] = ng; out[o + 2] = nb;
      }
    }
    d.set(out);
  });
}

function mgSnowCap(src) {
  return mgTint(src, (d, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (d[o + 3] < 100) continue;
      const above = y === 0 ? 0 : d[((y - 1) * w + x) * 4 + 3];
      if (above < 100 || (y < h * 0.4 && ((x * 5 + y * 9) % 4) < 2)) { d[o] = 240; d[o + 1] = 246; d[o + 2] = 253; }
    }
  });
}

// Подменяет SPR.trees / SPR.boulders под текущий биом (вызывается при каждой постройке земли)
function biomeSpritesApply() {
  if (typeof SPR === 'undefined' || !SPR.trees || !SPR.trees.length) return;
  if (!SPR.treesBase) { SPR.treesBase = SPR.trees; SPR.bouldersBase = SPR.boulders; SPR.byBio = {}; }
  const id = MapOpt.biome;
  if (!id || id === 'meadow') { SPR.trees = SPR.treesBase; SPR.boulders = SPR.bouldersBase; return; }
  if (!SPR.byBio[id]) {
    SPR.byBio[id] = {
      trees: SPR.treesBase.map(t => mgTintTrees(t, id)),
      boulders: id === 'winter' ? SPR.bouldersBase.map(mgSnowCap) : SPR.bouldersBase,
    };
  }
  SPR.trees = SPR.byBio[id].trees; SPR.boulders = SPR.byBio[id].boulders;
}

// Палитры гор по биому (по умолчанию — прежние)
const MT_PAL_BIOME = {
  winter: [
    { lit: ['#f4f8ff', '#cfe0f0'], shade: ['#8496b0', '#3c465c'], rim: '#ffffff' },
    { lit: ['#eaf2fc', '#bcd0e6'], shade: ['#76889f', '#343e52'], rim: '#ffffff' },
    { lit: ['#f0f4fa', '#c4d2e2'], shade: ['#8090a6', '#3a4256'], rim: '#ffffff' },
    { lit: ['#e4eef8', '#b0c6de'], shade: ['#6c7e98', '#2e384c'], rim: '#f6faff' },
  ],
  mountain: [
    { lit: ['#d8d4cc', '#a8a49a'], shade: ['#66625c', '#2c2a28'], rim: '#f2eee6' },
    { lit: ['#cfd0cc', '#9c9e9a'], shade: ['#5c5e5c', '#262828'], rim: '#eceeea' },
    { lit: ['#dcc8aa', '#ae9270'], shade: ['#705a44', '#2e241c'], rim: '#f6e4c4' },
    { lit: ['#c4ccd6', '#8e98a6'], shade: ['#565e6c', '#222830'], rim: '#e6eef8' },
  ],
  steppe: [
    { lit: ['#efdcae', '#c9ae78'], shade: ['#8a7048', '#40301c'], rim: '#fff0c4' },
    { lit: ['#e8cf9c', '#bd9c64'], shade: ['#7c6038', '#382a16'], rim: '#ffe8b4' },
    { lit: ['#e4c8a0', '#b8905c'], shade: ['#72543a', '#34241a'], rim: '#ffe2b0' },
    { lit: ['#dcd0b4', '#ae9f80'], shade: ['#6c6048', '#2e2a1e'], rim: '#f4ead0' },
  ],
  swamp: [
    { lit: ['#b4b890', '#8a8e68'], shade: ['#585c40', '#262a1c'], rim: '#dcdcb0' },
    { lit: ['#acb08c', '#82865e'], shade: ['#4e5238', '#22261a'], rim: '#d4d4a8' },
    { lit: ['#b8b494', '#8c8868'], shade: ['#5a5640', '#282418'], rim: '#dcd8b4' },
    { lit: ['#a4ac8c', '#7c8462'], shade: ['#4a5238', '#20261a'], rim: '#ccd4a8' },
  ],
};
