'use strict';
// Карта: рельеф, дороги, объекты (деревья, камни, поля), генерация и рост.

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

let N_TILES = MAP_W * MAP_H;

const World = {
  terrain: new Uint8Array(N_TILES),
  road: new Uint8Array(N_TILES),
  bmap: new Int32Array(N_TILES),   // id здания на клетке фундамента
  door: new Uint8Array(N_TILES),   // 1 — клетка входа в здание
  obj: new Array(N_TILES).fill(null),
  crystal: new Uint8Array(N_TILES), // 1 — скала с жилой магических кристаллов
  noise: new Float32Array(N_TILES),
  growing: new Set(),              // индексы клеток, где что-то растёт
  occ: new Int32Array(N_TILES),    // id курьера, занявшего клетку дороги
  roadComp: new Int32Array(N_TILES), // номер связной дорожной сети (0 — не дорога)
  roadDirty: true,
};

// Смена размера карты: пересоздаёт все массивы по клеткам (вызывать до genWorld и только при новом размере).
function setMapSize(w, h) {
  if (w === MAP_W && h === MAP_H && World.terrain.length === w * h) return;
  MAP_W = w; MAP_H = h; N_TILES = w * h;
  World.terrain = new Uint8Array(N_TILES);
  World.road = new Uint8Array(N_TILES);
  World.bmap = new Int32Array(N_TILES);
  World.door = new Uint8Array(N_TILES);
  World.obj = new Array(N_TILES).fill(null);
  World.crystal = new Uint8Array(N_TILES);
  World.noise = new Float32Array(N_TILES);
  World.occ = new Int32Array(N_TILES);
  World.roadComp = new Int32Array(N_TILES);
  World.growing.clear();
  World.roadDirty = true;
  if (typeof pfResize === 'function') pfResize();
}
const mapIsLegacy = () => MAP_W === MAP_LEGACY_W && MAP_H === MAP_LEGACY_H;

// Разметка связных дорожных сетей (8-связность: дороги соединяются и по диагонали).
function updateRoadComps() {
  if (!World.roadDirty) return;
  World.roadDirty = false;
  const comp = World.roadComp;
  comp.fill(0);
  let id = 0;
  for (let s = 0; s < N_TILES; s++) {
    if (!World.road[s] || comp[s]) continue;
    id++;
    const q = [s];
    comp[s] = id;
    for (let k = 0; k < q.length; k++) {
      const c = q[k], x = c % MAP_W, y = (c / MAP_W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
        const ni = ny * MAP_W + nx;
        if (!World.road[ni] || comp[ni]) continue;
        if (dx && dy && !isWalkable(x + dx, y) && !isWalkable(x, y + dy)) continue;
        comp[ni] = id;
        q.push(ni);
      }
    }
  }
}

function compAt(x, y) {
  updateRoadComps();
  return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H ? World.roadComp[y * MAP_W + x] : 0;
}

// Сеть, к которой примыкает клетка (для строящейся дороги — сеть соседа).
function compNear(x, y) {
  const own = compAt(x, y);
  if (own) return own;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const c = compAt(x + dx, y + dy); if (c) return c; }
  return 0;
}

function idx(x, y) { return y * MAP_W + x; }
function inb(x, y) { return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H; }

function makeNoise(rng, cell) {
  const gw = Math.ceil(MAP_W / cell) + 2, gh = Math.ceil(MAP_H / cell) + 2;
  const g = new Float32Array(gw * gh);
  for (let i = 0; i < g.length; i++) g[i] = rng();
  return (x, y) => {
    const fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy);
    let tx = fx - ix, ty = fy - iy;
    tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
    const a = g[iy * gw + ix], b = g[iy * gw + ix + 1];
    const c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
    const top = a + (b - a) * tx, bot = c + (d - c) * tx;
    return top + (bot - top) * ty;
  };
}

function setTree(i, g) {
  World.obj[i] = { t: 'tree', g };
  if (g < 1) World.growing.add(i);
}

function setStone(i, n) {
  World.obj[i] = { t: 'stone', n };
}

function genWorld(seed) {
  if (MapOpt.custom) return meGenWorld(seed);   // карта игрока: рельеф и деревья берутся из неё (mapedit.js)
  const rng = mulberry32(seed);
  const nWater = makeNoise(rng, 16), nWater2 = makeNoise(rng, 6);
  const nRock = makeNoise(rng, 12), nRock2 = makeNoise(rng, 5);
  const nForest = makeNoise(rng, 9), nStone = makeNoise(rng, 4);
  const nTint = makeNoise(rng, 7);
  const cx = MAP_W >> 1, cy = MAP_H >> 1;
  const bio = biomeDef();          // null — карта без биома: старые сохранения должны воссоздаваться ровно как раньше
  const legacy = !bio && mapIsLegacy();
  const wT = bio ? bio.wT : 0.28, rT = bio ? bio.rT : 0.7, fT = bio ? bio.fT : 0.6, fP = bio ? bio.fP : 0.75, sT = bio ? bio.sT : 0.012, stT = bio ? bio.stT : 0.84, crT = bio ? bio.crys : 0.72;
  const farK = (x, y) => Math.max(0, Math.min(1, (Math.hypot(x - cx, (y - cy) * 1.2) - 20) / 28));

  World.obj.fill(null);
  World.growing.clear();
  World.road.fill(0); World.bmap.fill(0); World.door.fill(0);

  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const i = idx(x, y);
    World.noise[i] = nTint(x, y) * 0.85 + rng() * 0.15;   // плавный оттенок без «шахматки»
    const w = nWater(x, y) * 0.7 + nWater2(x, y) * 0.3;
    const r = nRock(x, y) * 0.7 + nRock2(x, y) * 0.3;
    const far = legacy ? 0 : farK(x, y);   // в новых краях карты больше озёр и гор
    let t = T_GRASS;
    if (w < wT + far * 0.05) t = T_WATER;
    else if (r > rT - far * 0.05) t = T_ROCK;
    World.terrain[i] = t;
  }

  if (bio) genBiomeFeatures(seed, cx, cy);   // реки, озёра, хребты, заводи

  // Стартовая поляна и гарантированные ресурсы рядом с ней
  const disc = (ox, oy, rad, fn) => {
    for (let y = Math.floor(oy - rad); y <= oy + rad; y++)
      for (let x = Math.floor(ox - rad); x <= ox + rad; x++)
        if (inb(x, y) && (x - ox) ** 2 + (y - oy) ** 2 <= rad * rad) fn(x, y, idx(x, y));
  };
  disc(cx, cy, 13, (x, y, i) => { World.terrain[i] = T_GRASS; });
  disc(cx + 9, cy - 14, 3.6, (x, y, i) => { World.terrain[i] = T_ROCK; });
  // площадка под золотой рудник у подножия скалы и проход к ней
  disc(cx + 9, cy - 9, 3, (x, y, i) => { if (World.terrain[i] !== T_ROCK) World.terrain[i] = T_GRASS; });
  for (let y = cy - 9; y <= cy; y++) for (let x = cx + 7; x <= cx + 11; x++)
    if (World.terrain[idx(x, y)] !== T_ROCK) World.terrain[idx(x, y)] = T_GRASS;
  // скала с магическими кристаллами по другую сторону
  disc(cx - 10, cy - 14, 3.2, (x, y, i) => { World.terrain[i] = T_ROCK; });
  disc(cx - 10, cy - 9, 2.8, (x, y, i) => { if (World.terrain[i] !== T_ROCK) World.terrain[i] = T_GRASS; });
  for (let y = cy - 9; y <= cy; y++) for (let x = cx - 12; x <= cx - 8; x++)
    if (World.terrain[idx(x, y)] !== T_ROCK) World.terrain[idx(x, y)] = T_GRASS;

  // Жилы кристаллов: нижний край скал (там, где можно поставить шахту)
  World.crystal.fill(0);
  const nCrys = makeNoise(rng, 6);
  for (let y = 0; y < MAP_H - 1; y++) for (let x = 0; x < MAP_W; x++) {
    const i = idx(x, y);
    if (World.terrain[i] !== T_ROCK || World.terrain[idx(x, y + 1)] === T_ROCK) continue;
    const nearStart = Math.abs(x - (cx - 10)) <= 3 && y >= cy - 13 && y <= cy - 10;
    if (nearStart || nCrys(x, y) > (legacy ? 0.72 : crT - farK(x, y) * 0.06)) World.crystal[i] = 1;
  }

  // Песок по берегам
  const sand = [];
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (World.terrain[idx(x, y)] !== T_GRASS) continue;
    let nearWater = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
      if (inb(x + dx, y + dy) && World.terrain[idx(x + dx, y + dy)] === T_WATER) nearWater = true;
    if (nearWater) sand.push(idx(x, y));
  }
  for (const i of sand) World.terrain[i] = T_SAND;
  if (bio && bio.sea) mgBeach(seed);   // широкие пляжи у моря (mapgen.js)

  // Леса и камни
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const i = idx(x, y);
    if (World.terrain[i] !== T_GRASS) continue;
    const startDist = Math.hypot(x - cx, y - cy);
    if (startDist < 9) continue;
    let nearRock = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
      if (inb(x + dx, y + dy) && World.terrain[idx(x + dx, y + dy)] === T_ROCK) nearRock = true;
    const fk = legacy ? 0 : farK(x, y);
    if (nearRock && nStone(x, y) > 0.55 && rng() < 0.5) setStone(i, 4 + (rng() * 4 | 0));
    else if (nStone(x, y) > stT - fk * 0.04 && rng() < 0.5) setStone(i, 3 + (rng() * 4 | 0));
    else if (nForest(x, y) > fT - fk * 0.1 && rng() < fP + fk * 0.12) setTree(i, rng() < 0.12 ? rng() * 0.9 : 1);
    else if (rng() < sT) setTree(i, 1);
  }

  disc(cx - 15, cy + 3, 5, (x, y, i) => {
    World.terrain[i] = T_GRASS;
    if (rng() < 0.65) setTree(i, 1); else World.obj[i] = null;
  });
  disc(cx + 12, cy + 7, 2.3, (x, y, i) => {
    World.terrain[i] = T_GRASS;
    setStone(i, 6);
  });
  disc(cx + 9, cy - 9, 3, (x, y, i) => { World.obj[i] = null; });
  for (let y = cy - 9; y <= cy; y++) for (let x = cx + 7; x <= cx + 11; x++) World.obj[idx(x, y)] = null;
  disc(cx - 10, cy - 9, 2.8, (x, y, i) => { World.obj[i] = null; });
  for (let y = cy - 9; y <= cy; y++) for (let x = cx - 12; x <= cx - 8; x++) World.obj[idx(x, y)] = null;
  return { cx, cy };
}

function updateGrowth(dt) {
  for (const i of World.growing) {
    const o = World.obj[i];
    if (!o) { World.growing.delete(i); continue; }
    if (o.t === 'tree') {
      o.g = Math.min(1, o.g + dt / 150);
      if (o.g >= 1) World.growing.delete(i);
    } else if (o.t === 'field') {
      if (o.g >= 0 && o.g < 1) o.g = Math.min(1, o.g + dt / (o.ash ? 38 : 65));   // с пеплом растёт быстрее
      if (o.g >= 1 || o.g < 0) World.growing.delete(i);
    } else if (o.t === 'stump') {
      o.g += dt;
      if (o.g > 25) { World.obj[i] = null; World.growing.delete(i); }
    } else {
      World.growing.delete(i);
    }
  }
}

// ---------- Возобновление ресурсов ----------
// Все ручки баланса здесь. Сутки ≈ 565 с, сезон — 8 суток. Природа «делает ход» раз в every с:
// у каждой готовой каменоломни может вырасти глыба, у каждого дома лесоруба — саженец (до потолка в округе).
// Растёт только на свободной траве, не вплотную к зданиям, входам, дорогам и полям. Скалы (клетки гор) не отрастают.
const REGROW = {
  every: 6,                    // с между ходами природы (ход — пара сотен клеток вокруг здания, дёшево)
  margin: 1,                   // не ближе стольких клеток к зданию, входу, дороге, стройке дороги, полю
  // глыбы — вокруг каменоломен
  stoneR: 10,                  // радиус от входа каменоломни (там каменотёс ищет в первую очередь)
  stoneCap: 5,                 // столько глыб держит округа одной каменоломни, больше не вырастает
  stoneChance: 0.05,           // шанс новой глыбы за ход: в среднем раз в 2 минуты, ~4–5 за сутки
  stoneN: [2, 4],              // запас новой глыбы, кусков (на старте карты у глыб 3–7)
  // деревья — вокруг домов лесоруба (лесничий сам досаживает до 16 в 9 клетках; природа добавляет поверх)
  treeR: 11,                   // радиус от входа дома лесоруба
  treeCap: 20,                 // деревьев любого роста в округе — дальше не растёт
  treeChance: [0.06, 0.03, 0, 0.15],   // шанс саженца за ход: лето, осень, зима, весна
  springBurst: 4,              // в первый ход весны сразу столько саженцев у каждого дома лесоруба
  winterKeep: 5,               // зимой лесоруб не рубит последние столько взрослых деревьев у своего дома
  // скалы: каменотёс скалывает клетку горы по куску; выработанная осыпается щебнем и не отрастает
  rockHp: 60,                  // кусков камня в одной клетке скалы
};
const RG = { t: 0, sea: -1 };

// клетка годится под новую глыбу/саженец; глыба ещё и не должна запирать проход (все 8 соседей проходимы)
function regrowSpotOk(x, y, stone) {
  if (!isFreeGrass(x, y)) return false;
  const m = REGROW.margin;
  for (let yy = y - m; yy <= y + m; yy++) for (let xx = x - m; xx <= x + m; xx++) {
    if (!inb(xx, yy)) continue;
    const i = idx(xx, yy), o = World.obj[i];
    if (World.bmap[i] || World.door[i] || World.road[i] || Game.roadSites.has(i)) return false;
    if (o && (o.t === 'field' || (typeof isStreetObj === 'function' && isStreetObj(o)))) return false;
    if (stone && (xx !== x || yy !== y) && !isWalkable(xx, yy)) return false;
  }
  for (const u of Game.units) if (!u.dead && Math.floor(u.x) === x && Math.floor(u.y) === y) return false;
  return true;
}

// вырастить до n штук t ('stone' | 'tree') в круге R у входа здания, если их там меньше cap
function regrowAt(b, t, R, cap, n) {
  const cx = b.doorX, cy = b.doorY, free = [];
  let have = 0;
  for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) {
    if (!inb(x, y)) continue;
    const d2 = (x - cx) ** 2 + (y - cy) ** 2;
    if (d2 > R * R) continue;
    const i = idx(x, y), o = World.obj[i];
    if (o) { if (o.t === t) have++; }
    else if (d2 >= 9 && World.terrain[i] === T_GRASS) free.push(i);
  }
  n = Math.min(n, cap - have);
  let made = 0;
  for (let k = 0; k < 12 * n && made < n && free.length; k++) {
    const j = Math.random() * free.length | 0, i = free[j];
    free[j] = free[free.length - 1]; free.pop();
    const x = i % MAP_W, y = (i / MAP_W) | 0;
    if (!regrowSpotOk(x, y, t === 'stone')) continue;
    if (t === 'stone') {
      const [a, z] = REGROW.stoneN;
      setStone(i, a + (Math.random() * (z - a + 1) | 0));
      if (typeof PF !== 'undefined') PF.regT = -1e9;   // глыба непроходима
    } else setTree(i, 0);
    made++;
  }
  return made;
}

function regrowTick(dt) {
  RG.t += dt;
  if (RG.t < REGROW.every) return;
  RG.t = 0;
  if (Game.camp || Game.stress) return;   // в кампании цели считают глыбы поштучно; стресс-карта — замеры
  // для деревьев зима длится, пока лежит снег (season.js seaFrozen); весна — первый ход после схода снега
  const si = typeof seaIdx !== 'function' ? 0 : seaFrozen() ? 2 : seaIdx();
  const spring = si === 3 && RG.sea >= 0 && RG.sea !== 3;
  RG.sea = si;
  for (const b of Game.buildings) {
    if (b.state !== 'done' || b.removed) continue;
    if (b.type === 'quarry') {
      if (Math.random() < REGROW.stoneChance) regrowAt(b, 'stone', REGROW.stoneR, REGROW.stoneCap, 1);
    } else if (b.type === 'woodcutter') {
      const n = spring ? REGROW.springBurst : Math.random() < REGROW.treeChance[si] ? 1 : 0;
      if (n) regrowAt(b, 'tree', REGROW.treeR, REGROW.treeCap, n);
    }
  }
}

// зимой лесоруб оставляет у дома последние REGROW.winterKeep взрослых деревьев
function regrowWinterSpare(b, R) {
  if (typeof isWinter !== 'function' || !isWinter()) return false;
  let n = 0;
  for (let y = b.doorY - R; y <= b.doorY + R; y++) for (let x = b.doorX - R; x <= b.doorX + R; x++) {
    if (!inb(x, y) || (x - b.doorX) ** 2 + (y - b.doorY) ** 2 > R * R) continue;
    const o = World.obj[idx(x, y)];
    if (o && o.t === 'tree' && o.g >= 1 && !o.awake && ++n > REGROW.winterKeep) return false;
  }
  return true;
}

// Найти ближайший объект, подходящий под условие, в квадрате радиуса r.
function findObjNear(cx, cy, r, test) {
  let best = null, bd = 1e9;
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    if (!inb(x, y)) continue;
    const o = World.obj[idx(x, y)];
    if (!o || !test(o)) continue;
    const d = (x - cx) ** 2 + (y - cy) ** 2;
    if (d <= r * r && d < bd) { bd = d; best = { x, y, o }; }
  }
  return best;
}

// Свободная травяная клетка (для посадки дерева или поля).
function isFreeGrass(x, y) {
  if (!inb(x, y)) return false;
  const i = idx(x, y);
  return World.terrain[i] === T_GRASS && !World.obj[i] && !World.road[i] &&
    !World.bmap[i] && !World.door[i] && !Game.roadSites.has(i);
}

function randomFreeNear(cx, cy, rMin, rMax, test = isFreeGrass) {
  const cands = [];
  for (let y = cy - rMax; y <= cy + rMax; y++) for (let x = cx - rMax; x <= cx + rMax; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d >= rMin && d <= rMax && test(x, y)) cands.push([x, y]);
  }
  if (!cands.length) return null;
  return cands[Math.random() * cands.length | 0];
}
