'use strict';
// Кампания, акт 1 «Праздник Первого Камня» (КАМПАНИЯ.md §3): Подгорье под горой Брюзгой, город уже построен.
// Канун праздника → Тан и «чихающая» гора → бочки пороха в Старом штреке → ночь: праздник и три волны гоблинов
// Шныря Порохового → взрыв, гора накреняется → утро, приходит Пим Чернилкин → решение Тана: уходим.
// Карта строится кодом (camp1Map) в формате редактора карт: tools/campaign/mkmaps.js выгружает её в maps/campaign/,
// там её можно открыть и поправить в «Редакторе карт».

const CAMP1 = {
  W: 128, H: 96, seed: 100100,
  start: [64, 52],             // площадь у склада
  mine: [64, 21],              // Старый штрек: вход в нишу в северной стене пещеры (зона осмотра)
  deep: [64, 15],              // ниша штрека: бочки и разведчики
  gate: [64, 90],              // Южные ворота: тоннель наружу
  ledge: [68, 14],             // край ниши штрека, где кричит Шнырь
  caches: [[24, 64], [104, 48], [46, 78]],   // три тайника Тана (★★★)
  tiltY: 26,                   // стены пещеры севернее — кренятся после взрыва
  // дыры в своде [x, y, радиус]: днём столбы солнца, под ними поля и деревья; последняя — выход тоннеля к Южным воротам
  shafts: [[38, 40, 4], [88, 40, 3.6], [56, 68, 4.2], [96, 62, 3], [28, 62, 3.2], [74, 52, 2.6], [64, 92, 5]],
  cracks: [[60, 26, 2.4], [70, 30, 2], [50, 32, 1.8]],   // после взрыва свод трескается
  stock: { wheat: 70, hops: 30, flour: 10, timber: 40, stone: 40, trunk: 40, bread: 14, sausage: 10, beer: 4, gold: 30, iron: 6 },
};

// ---------- Карта ----------

function camp1Noise(seed, cell) {
  const h = (x, y) => { let n = Math.imul(x * 374761393 + y * 668265263 + seed * 1442695041, 1274126177); n ^= n >>> 13; n = Math.imul(n, 1103515245); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  return (x, y) => {
    const fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy);
    let tx = fx - ix, ty = fy - iy;
    tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
    const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1);
    return a + (b - a) * tx + (c - a + (a - b + d - c) * tx) * ty;
  };
}

// Подгорье — огромная пещера внутри горы Брюзги: вокруг скала (стены), в северной стене — ниша Старого штрека,
// на юге — тоннель к Южным воротам, на востоке — подземное озеро. Деревья — только в столбах солнца
function camp1Map() {
  const { W, H } = CAMP1, m = meNew(W, H, 'cavern', 'Подгорье');
  m.seed = CAMP1.seed; m.nm = 'manual'; m.desc = 'Кампания, акт 1: город внутри горы Брюзги';
  const n1 = camp1Noise(11, 9), n2 = camp1Noise(22, 5);
  const rnd = mulberry32(CAMP1.seed);
  const at = (x, y) => y * W + x;
  const sunAt = (x, y, k = 1) => CAMP1.shafts.some(([sx, sy, r]) => Math.hypot(x - sx, (y - sy) * 1.2) <= r * k);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = at(x, y);
    const ex = (x - 64) / 54, ey = (y - 52) / 32, e = ex * ex + ey * ey + (n1(x, y) - 0.5) * 0.22 + (n2(x, y) - 0.5) * 0.1;
    m.t[i] = e < 1 ? 0 : 2;
    if (y > 80 && Math.abs(x - CAMP1.gate[0]) <= 2.5 + (n2(x, y) - 0.5)) m.t[i] = 0;          // тоннель к воротам
    const lx = (x - 100) / 6, ly = (y - 66) / 3.8;
    if (lx * lx + ly * ly < 1 + (n2(x, y) - 0.5) * 0.5) m.t[i] = 1;                               // подземное озеро
  }
  // ниша Старого штрека в северной стене
  const [mx, my] = CAMP1.deep;
  for (let y = my - 5; y <= my + 9; y++) for (let x = mx - 8; x <= mx + 8; x++) {
    const ex = (x - mx) / 6.5, ey = (y - my) / (y < my ? 3.6 : 5);
    if (ex * ex + ey * ey < 1 || y > my && Math.abs(x - mx) <= 2) m.t[at(x, y)] = 0;
  }
  // руда в стенах: у кромки пещеры и густо — у штрека
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = at(x, y);
    if (m.t[i] !== 2) continue;
    let near = 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && m.t[at(xx, yy)] === 0) near++; }
    if (near && rnd() < (Math.abs(x - mx) < 10 && y < 24 ? 0.35 : 0.1)) m.c[i] = 1;
  }
  // деревья растут только в столбах солнца у западной и восточной стен (там нет полей)
  for (const [sx, sy, r] of [CAMP1.shafts[4], CAMP1.shafts[3]]) {
    for (let y = Math.floor(sy - r - 1); y <= sy + r + 1; y++) for (let x = Math.floor(sx - r - 1); x <= sx + r + 1; x++) {
      const i = at(x, y);
      if (m.t[i] === 0 && Math.hypot(x - sx, (y - sy) * 1.2) <= r + 0.5 && rnd() < 0.5) m.o[i] = rnd() < 0.3 ? 2 : 1;
    }
  }
  // валуны у стен: для каменоломен
  for (const [cx, cy, r] of [[24, 42, 2.5], [102, 40, 2.5], [20, 56, 2.5], [88, 77, 2]]) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const i = at(x, y);
      if (m.t[i] === 0 && !sunAt(x, y) && Math.hypot(x - cx, y - cy) <= r && rnd() < 0.8) m.o[i] = 3;
    }
  }
  m.start = CAMP1.start.slice();
  return m;
}

// ---------- Город: что стоит в Подгорье к празднику ----------
// [тип, якорь x, якорь y] — ищем ближайшее к якорю место, ставим готовым и тянем дорогу к сети

const CAMP1_TOWN = [
  ['library', 64, 44], ['well', 60, 58], ['house', 52, 48], ['house', 76, 48], ['house', 48, 56], ['house', 80, 56],
  ['house', 62, 62], ['house', 72, 64], ['bakery', 70, 58], ['mill', 76, 60], ['brewery', 52, 44], ['hopfarm', 56, 68],
  ['farm', 38, 40], ['farm', 88, 40], ['woodcutter', 30, 66], ['sawmill', 40, 62], ['quarry', 26, 44],
  ['quarry', 100, 43], ['infirmary', 84, 50], ['watchtower', 96, 56], ['watchtower', 34, 66], ['watchtower', 64, 80], ['swine', 86, 66],
  ['butchery', 80, 64], ['ironmine', 46, 26], ['smeltery', 48, 34], ['weaponsmith', 82, 34], ['tannery', 92, 50], ['guild_warrior', 74, 38],
  ['house', 44, 70], ['house', 90, 72], ['house', 54, 76], ['house', 70, 74], ['well', 80, 70], ['goatpen', 46, 50],
];

function camp1Net() {
  const hub = Game.buildings.find(b => b.type === 'storehouse');
  const net = new Set(), q = [idx(hub.doorX, hub.doorY)];
  net.add(q[0]);
  while (q.length) {
    const i = q.pop(), x = i % MAP_W, y = (i / MAP_W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!inb(nx, ny)) continue;
      const j = idx(nx, ny);
      if (!net.has(j) && World.road[j]) { net.add(j); q.push(j); }
    }
  }
  return net;
}

// дорога от входа здания до ближайшей клетки сети (поиск в ширину по клеткам, где можно мостить)
function camp1Road(b, net) {
  const sx = b.doorX, sy = b.doorY + 1;
  if (!inb(sx, sy)) return false;
  const s0 = idx(sx, sy);
  if (net.has(s0)) return true;
  const prev = new Map([[s0, -1]]), queue = [s0];
  let goal = -1;
  for (let h = 0; h < queue.length && goal < 0 && h < 4000; h++) {
    const p = queue[h], px = p % MAP_W, py = (p / MAP_W) | 0;
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
      const nx = px + dx, ny = py + dy;
      if (!inb(nx, ny)) continue;
      const j = idx(nx, ny);
      if (prev.has(j)) continue;
      if (net.has(j)) { prev.set(j, p); goal = j; break; }
      if (!canPlaceRoad(nx, ny)) continue;
      prev.set(j, p); queue.push(j);
    }
  }
  if (goal < 0) return false;
  for (let j = goal >= 0 ? prev.get(goal) : s0; j >= 0; j = prev.get(j)) {
    const x = j % MAP_W, y = (j / MAP_W) | 0;
    if (!World.road[j]) setRoad(x, y, true);
    net.add(j);
  }
  return goal >= 0;
}

function camp1Place(type, ax, ay, net, done = true) {
  if (!BUILDINGS[type]) return null;
  for (let r = 0; r < 14; r++) for (let k = 0; k < Math.max(1, r * 8); k++) {
    const a = k / Math.max(1, r * 8) * Math.PI * 2;
    const x = Math.round(ax + Math.cos(a) * r), y = Math.round(ay + Math.sin(a) * r * 0.8);
    if (!inb(x, y) || checkPlacement(type, x, y, 0)) continue;
    const dd = bDims(type, 0);
    // зазор: вокруг здания ни других зданий, ни чужих входов — улицы остаются проходимыми
    let ok = true;
    for (let yy = y - 1; yy <= y + dd.h && ok; yy++) for (let xx = x - 1; xx <= x + dd.w && ok; xx++) if (inb(xx, yy) && World.bmap[idx(xx, yy)]) ok = false;
    if (!ok || !inb(x + dd.dx, y + dd.dy + 1) || !canPlaceRoad(x + dd.dx, y + dd.dy + 1) && !World.road[idx(x + dd.dx, y + dd.dy + 1)]) continue;
    const b = placeBuilding(type, x, y, done, 0);
    if (!camp1Road(b, net)) { removeBuilding(b); continue; }
    return b;
  }
  return null;
}

function camp1Town(C) {
  const net = camp1Net();
  const placed = [];
  for (const [type, ax, ay] of CAMP1_TOWN) {
    const b = camp1Place(type, ax, ay, net);
    if (b) placed.push(b);
  }
  // работники для всех мастерских, лишние трудяги и строители — город живёт давно
  for (const b of Game.buildings) {
    const w = b.def.worker;
    if (!w || !UNIT_TYPES[w]) continue;
    const s = randomFreeNear(b.doorX, b.doorY + 1, 0, 4) || [b.doorX, b.doorY + 1];
    spawnUnit(w, s[0], s[1]);
  }
  const [sx, sy] = CAMP1.start;
  for (const [t, n] of [['serf', 12], ['builder', 2]]) for (let k = 0; k < n; k++) {
    const s = randomFreeNear(sx, sy + 2, 1, 8);
    if (s) spawnUnit(t, s[0], s[1]);
  }
  // склад к празднику: зерно и хмель на пиво, мука на хлеб, стройматериалы на башню
  const store = Game.buildings.find(b => b.type === 'storehouse');
  Object.assign(store.stock, CAMP1.stock);
  if (typeof decorateAllRoads === 'function') decorateAllRoads();
  // пивовар и пекарь уже взялись за праздник: в мастерских — первая закладка
  for (const b of placed) if (b.type === 'brewery') Object.assign(b.stock, { wheat: 5, hops: 5 }); else if (b.type === 'bakery') b.stock.flour = 6;
  // поля в столбах солнца у ферм и хмельника — уже зеленеют и зреют
  const rnd = mulberry32(CAMP1.seed ^ 0xF1E1D);
  for (const b of placed) {
    if (!b.def.crops) continue;
    const crop = b.def.crops[0];
    const sh = CAMP1.shafts.reduce((p, q) => Math.hypot(q[0] - b.x, q[1] - b.y) < Math.hypot(p[0] - b.x, p[1] - b.y) ? q : p);
    let n = 0;
    for (let y = Math.floor(sh[1] - sh[2]); y <= sh[1] + sh[2] && n < 6; y++) for (let x = Math.floor(sh[0] - sh[2]); x <= sh[0] + sh[2] && n < 6; x++) {
      if (Math.hypot(x - sh[0], (y - sh[1]) * 1.2) > sh[2] || Math.abs(x - b.doorX) > 6 || Math.abs(y - b.doorY) > 6 || !isFreeGrass(x, y)) continue;
      World.obj[idx(x, y)] = { t: 'field', g: 0.35 + rnd() * 0.6, crop, farm: b.id };
      n++;
    }
  }
  // светящиеся грибы: в тёмных углах пещеры, подальше от дорог и солнца
  C.flags.shrooms = [];
  for (let tries = 0; tries < 2000 && C.flags.shrooms.length < 46; tries++) {
    const x = 12 + (rnd() * (MAP_W - 24) | 0), y = 18 + (rnd() * (MAP_H - 30) | 0), i = idx(x, y);
    if (World.terrain[i] !== T_GRASS || World.obj[i] || World.road[i] || World.bmap[i]) continue;
    if (CAMP1.shafts.some(([sx, sy, r]) => Math.hypot(x - sx, y - sy) < r + 3)) continue;
    let wall = false;
    for (let dy = -2; dy <= 2 && !wall; dy++) for (let dx = -2; dx <= 2; dx++) if (inb(x + dx, y + dy) && World.terrain[idx(x + dx, y + dy)] === T_ROCK) { wall = true; break; }
    if (!wall && rnd() < 0.8) continue;   // больше всего — у стен
    C.flags.shrooms.push([x + 0.5, y + 0.8, (rnd() * 3) | 0]);
  }
  C.flags.town = placed.length;
  const hall = placed.find(b => b.type === 'library');
  C.flags.hall = hall ? [hall.doorX, hall.doorY + 1] : [sx, sy - 2];
}

// ---------- Сцена: бочки, вожак, тайники ----------

function camp1Kegs(C) {
  const [dx, dy] = CAMP1.deep;
  C.flags.kegs = [[dx - 3, dy - 0.5], [dx + 3, dy - 0.8], [dx - 1.6, dy + 1.4], [dx + 1.8, dy + 1.2], [dx, dy - 1.8]];
}

function camp1DrawKeg(c, k, t, lit) {
  const x = Math.round(k[0] * TILE + 16), y = Math.round(k[1] * TILE + 22);
  c.fillStyle = 'rgba(10,8,4,0.3)'; c.beginPath(); c.ellipse(x, y + 1, 8, 2.5, 0, 0, 7); c.fill();
  c.fillStyle = '#6a4424'; c.fillRect(x - 7, y - 16, 14, 16);
  c.fillStyle = '#845a30'; c.fillRect(x - 6, y - 16, 4, 16);
  c.fillStyle = '#3a2a1a'; c.fillRect(x - 7, y - 13, 14, 2); c.fillRect(x - 7, y - 5, 14, 2);
  c.fillStyle = '#a8d060'; c.fillRect(x - 3, y - 11, 6, 4);           // гоблинское клеймо
  c.fillStyle = '#24300e'; c.fillRect(x - 1, y - 10, 2, 2);
  c.strokeStyle = '#2a2018'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 2, y - 16); c.quadraticCurveTo(x + 6, y - 22, x + 3, y - 25); c.stroke();
  if (lit) {
    const f = (t * 8 + k[0]) % 4 | 0, sp = [[0, 0], [1, -1], [-1, -1], [1, 1]][f];
    c.fillStyle = '#fff2a0'; c.fillRect(x + 2 + sp[0], y - 27 + sp[1], 2, 2);
    c.fillStyle = '#ff9030'; c.fillRect(x + 3 - sp[1], y - 26 - sp[0], 1, 1);
  }
}

function camp1DrawShnyr(c, p) {
  if (typeof naFrame !== 'function') return;
  const t = Game.time, x = Math.round(p[0] * TILE + 16), y = Math.round(p[1] * TILE + 26);
  const ph = t % 3.2, fr = ph < 0.3 ? 'windup' : ph < 0.5 ? 'strike' : ph < 0.8 ? 'recover' : 'i' + ((t * 5) % 6 | 0);
  const sp = naFrame('shnyrKing', fr);
  c.save(); c.translate(x, y); c.scale(-1, 1); c.drawImage(sp.cv, -sp.ax, -sp.ay); c.restore();
  // искры фитиля на скипетре
  c.fillStyle = (t * 9 | 0) % 2 ? '#fff2a0' : '#ff9030';
  c.fillRect(x - 22 + Math.round(Math.sin(t * 17) * 2), y - 52 + Math.round(Math.cos(t * 13) * 2), 2, 2);
}

function camp1Draw(list, c, x0, y0, x1, y1) {
  const C = Game.camp, t = Game.time;
  for (const k of C.flags.kegs || []) if (k[0] > x0 - 2 && k[0] < x1 + 2 && k[1] > y0 - 2 && k[1] < y1 + 2) list.push([k[1] + 0.7, () => camp1DrawKeg(c, k, t, !!C.flags.lit)]);
  const s = C.flags.shnyr;
  if (s && s[0] > x0 - 3 && s[0] < x1 + 3 && s[1] > y0 - 3 && s[1] < y1 + 3) list.push([s[1] + 0.9, () => camp1DrawShnyr(c, s)]);
  for (const m of C.flags.shrooms || []) if (m[0] > x0 - 1 && m[0] < x1 + 1 && m[1] > y0 - 1 && m[1] < y1 + 2) list.push([m[1], () => caveDrawShroom(c, m)]);
  // Тан у своего чертога (пока Подгорье не ушло), Пим — у склада после прихода
  const hall = C.flags.hall;
  if (hall && hall[0] > x0 - 2 && hall[0] < x1 + 2 && hall[1] > y0 - 2 && hall[1] < y1 + 3) list.push([hall[1] + 0.95, () => campDrawNpc(c, 'tan', hall[0] + 1.6, hall[1] + 0.2)]);
  const pim = C.flags.pim;
  if (pim && pim[0] > x0 - 2 && pim[0] < x1 + 2 && pim[1] > y0 - 2 && pim[1] < y1 + 3) list.push([pim[1] + 0.95, () => campDrawNpc(c, 'pim', pim[0], pim[1])]);
}

// ---------- Взрыв ----------

function camp1Boom(C) {
  const [mx, my] = CAMP1.mine;
  C.vfx = { t: Game.time, dur: 7, amp: 10, x: mx, y: my };
  if (C.flags.boom) return;              // загрузились посреди катсцены: гора уже взорвана
  C.flags.kegs = []; C.flags.lit = 0; C.flags.shnyr = null; C.flags.boom = 1;
  for (let k = 0; k < 6; k++) fxBurst((mx + (Math.random() - 0.5) * 8) * TILE, (my + (Math.random() - 0.5) * 5) * TILE, 40, ['#fff2a0', '#ff9030', '#c04a20', '#5a4a3a', '#8a7a6a'], 160, 120, 1.6, 3.4, 120);
  if (typeof sfxAt === 'function') { sfxAt('dzRumble', mx * TILE, my * TILE, 1.6); sfxAt('thud', mx * TILE, my * TILE, 1.5); }
  // гоблины Шныря убегают в штрек и гибнут под обвалом
  for (const N of campFoes('w')) { N.st = 'vanish'; N.vt = 0; }
  // обломки: валуны на свободной земле северного квартала (не на дорогах, зданиях и жителях)
  const busy = new Set(Game.units.filter(u => !u.dead).map(u => idx(Math.floor(u.x), Math.floor(u.y))));
  let rocks = 0;
  for (let tries = 0; tries < 900 && rocks < 46; tries++) {
    const a = Math.random() * Math.PI, r = 3 + Math.random() * 15;
    const x = Math.round(mx + Math.cos(a) * r * 1.5), y = Math.round(my + 6 + Math.sin(a) * r);
    if (!inb(x, y)) continue;
    const i = idx(x, y);
    if (World.terrain[i] !== T_GRASS || World.bmap[i] || World.road[i] || World.obj[i] || busy.has(i)) continue;
    setStone(i, 2 + (Math.random() * 3 | 0)); rocks++;
  }
  // здания под горой: трещины (ремонт за материалы), два ближних дома рушатся до основания
  const near = Game.buildings.filter(b => !b.removed && b.type !== 'storehouse' && Math.hypot(b.x + b.w / 2 - mx, b.y + b.h / 2 - my) < 22)
    .sort((p, q) => Math.hypot(p.x - mx, p.y - my) - Math.hypot(q.x - mx, q.y - my));
  let razed = 0;
  for (const b of near) {
    if (razed < 2 && (b.type === 'house' || b.type === 'watchtower') && !Game.units.some(u => !u.dead && u.inside && u.home === b)) {
      fxBurst((b.x + b.w / 2) * TILE, (b.y + b.h / 2) * TILE, 30, ['#8a7a6a', '#5a4a3a', '#c8b898'], 90, 80, 1.2, 3, 160);
      removeBuilding(b); razed++;
      continue;
    }
    b.dmg = Math.min(0.85, (b.dmg || 0) + 0.35 + Math.random() * 0.3); b.dzFix = 1;
  }
  C.flags.razed = razed;
  logEvent('night', 'Взрыв под горой Брюзгой: штрек обрушен, гора накренилась', mx, my);
}

// ---------- Сценарий ----------

const CAMP1_TILT = 0.12;        // крен горы после взрыва, радианы

const camp1Wave = (C, n, fromGate, champs = 0) => {
  const [mx, my] = CAMP1.mine, [gx, gy] = CAMP1.gate;
  C.flags.wave = (C.flags.wave || 0) + 1;
  C.flags.waveT = Game.time;
  for (let k = 0; k < n; k++) {
    const g = fromGate && k % 2;
    const x = (g ? gx : mx) + (Math.random() - 0.5) * 3, y = (g ? gy - 2 : my + 2) + (Math.random() - 0.5) * 2;
    campFoe('goblin', x, y, 'w', { delay: k * 0.8, hunt: true });
  }
  for (let k = 0; k < champs; k++) campFoe('goblinChamp', mx + (k ? 2 : -2), my + 3, 'w', { delay: 2 + k, hunt: true });
  if (typeof sfxAt === 'function') sfxAt('goblinCry', mx * TILE, my * TILE, 1);
};
const camp1WaveLeft = () => campFoes('w').length;
const camp1Night = () => isNightNow() || isEveningNow();

CAMP_ACTS[1] = {
  id: 1, name: 'Праздник Первого Камня', seed: CAMP1.seed, stock: CAMP1.stock,
  cave: { shafts: C => (C.flags.boom ? CAMP1.shafts.concat(CAMP1.cracks) : CAMP1.shafts) }, map: camp1Map, tiltY: CAMP1.tiltY, tiltX: CAMP1.mine[0],
  outro: 'Гора стоит — пока. Завтра Подгорье уходит. Тан уйдёт последним.',
  setup(C) {
    camp1Town(C);
    camp1Kegs(C);
    C.flags.lost0 = Game.lostGnomes || 0;
    C.flags.b0 = campProduced('beer'); C.flags.h0 = campProduced('bread');   // пиво и хлеб к празднику считаются с начала акта
    C.flags.pop0 = campPeople();
    const h = campHero();
    if (h) { const s = randomFreeNear(CAMP1.start[0] + 2, CAMP1.start[1] + 2, 0, 5) || CAMP1.start; h.x = s[0] + 0.5; h.y = s[1] + 0.5; }
  },
  onLoad(C) { if (C.flags.boom) C.flags.kegs = []; },
  tick(C) {
    C.lost = Math.max(0, (Game.lostGnomes || 0) - (C.flags.lost0 || 0));
    // волна застряла (гоблин забрёл в лес и не выходит) — через 4 минуты остатки удирают в штрек
    if (C.flags.waveT && Game.time - C.flags.waveT > 240 && camp1WaveLeft()) {
      for (const N of campFoes('w')) { N.st = 'vanish'; N.vt = 0; }
      campSay('Остатки гоблинов удрали в штрек.');
    }
    // тайники Тана: герой проходит рядом — находка (★★★)
    const h = campHero();
    if (!h) return;
    C.flags.found = C.flags.found || [];
    CAMP1.caches.forEach((p, i) => {
      if (C.flags.found.includes(i) || Math.hypot(h.x - p[0] - 0.5, h.y - p[1] - 0.5) > 1.6) return;
      C.flags.found.push(i);
      const store = Game.buildings.find(b => b.type === 'storehouse' && !b.removed);
      if (store) store.stock.gold = (store.stock.gold || 0) + 5;
      floater(h.x, h.y - 2, 'Тайник Тана! +5 золота', '#ffe080');
      campSay(`Тайник Тана (${C.flags.found.length} из 3): старый кошель с монетами и записка «на чёрный день».`);
    });
  },
  fail(C) {
    if (!Game.buildings.some(b => b.type === 'storehouse' && !b.removed)) return 'Склад Подгорья разрушен — без припасов в дорогу не выйти.';
    if (campPeople() < 10) return 'Гномов осталось слишком мало: Подгорью некому уходить.';
    return null;
  },
  stars(C, S) { return 1 + (S.alive >= 25 ? 1 : 0) + ((C.flags.found || []).length >= 3 ? 1 : 0); },
  legacy(C, S) { return { a1: { alive: S.alive, key: 1, caches: (C.flags.found || []).length } }; },
  legacyText(C) { return 'Ключ Тана у героя; с вами уходят ' + campPeople() + ' гномов.'; },
  draw: camp1Draw,
  steps: [
    { k: 'cut', pause: true, cam: [64, 40], label: 'Канун праздника', lines: [
      ['note', 'Подгорье. Сто лет внутри горы Брюзги. Завтра — праздник Первого Камня.'],
      ['note', 'Солнце сюда заглядывает только через продухи в своде. Под ними и растёт всё, что растёт: хлеб, хмель и пара упрямых ёлок.'],
      ['tan', 'Сто лет Подгорью! Сто лет под одной горой, и ни разу она на нас не упала.'],
      ['grum', 'Сто лет — не повод. Горы не умеют считать.'],
      ['yagla', 'Грум, сегодня праздник. Ворчать будешь завтра.'],
      ['grum', 'Завтра у меня тоже расписано.'],
    ] },
    { k: 'goal', label: 'Канун праздника', hint: 'Выберите героя (кнопка слева внизу или H) и кликните по месту на земле.',
      objs: [{ id: 'tan', t: 'Герой: зайти к Тану в чертог', zone: C => C.flags.hall.concat(2.4) }] },
    { k: 'say', lines: [
      ['tan', 'А, правнук Фонарщика! Ночью гора чихала. Три раза. Гора у нас старая, но не простуженная.'],
      ['tan', 'Сходи в Старый штрек, глянь. А мы пока сварим пива к празднику. Много пива. Сто лет — круглая дата.'],
      ['grum', 'Если гора чихает, я бы не ходил к ней в нос. Но я прораб, мне можно бояться.'],
    ] },
    { k: 'check' },
    { k: 'do', fn(C) { if (C.flags.b0 == null) { C.flags.b0 = campProduced('beer'); C.flags.h0 = campProduced('bread'); } } },
    { k: 'goal', label: 'Шорох в штреке', hint: 'Штрек — ниша в северной стене пещеры (кнопка ◎ покажет).',
      objs: [{ id: 'mine', t: 'Герой: осмотреть Старый штрек', zone: CAMP1.mine.concat(2.6) }] },
    // разведчики сидят в глубине штрека над бочками; после реплик бросаются в драку
    { k: 'do', fn(C) {
      const [dx, dy] = CAMP1.deep;
      if (!C.flags.scouts) for (let k = 0; k < 3; k++) campFoe('goblin', dx - 1.5 + k * 1.5, dy + 0.5, 'scout', { hold: true });
      C.flags.scouts = 1;
    } },
    { k: 'cut', pause: true, cam: CAMP1.deep, lines: [
      ['grum', 'Бочки. С фитилями. Под горой. Кто-то очень хочет, чтобы мы переехали.'],
      ['gob', 'Это не порох! Это… сахар. Очень злой сахар.'],
      ['grum', 'Сахар не шипит. Бей их, правнук!'],
    ] },
    { k: 'goal', label: 'Шорох в штреке', hint: 'Кликните по гоблину героем, чтобы напасть. Пиво варит пивоварня из зерна и хмеля со склада, хлеб пекут мельница и пекарня.',
      init(C) { if (!campFoes('scout').length && !C.flags.scoutsDone) { const [dx, dy] = CAMP1.deep; for (let k = 0; k < 3; k++) campFoe('goblin', dx - 1.5 + k * 1.5, dy + 0.5, 'scout', { hold: true }); } },
      objs: [
        { id: 'scouts', t: 'Победить гоблинов-разведчиков', need: 3, cur: C => (C.flags.scoutsDone ? 3 : 3 - campFoes('scout').length) },
        { id: 'beer', t: 'Сварить пива к празднику', need: 6, cur: C => campProduced('beer') - C.flags.b0 },
        { id: 'bread', t: 'Испечь хлеба', need: 10, cur: C => campProduced('bread') - C.flags.h0 },
      ],
      during(C) {
        const h = campHero();
        for (const N of campFoes('scout')) if (N.hold && h && Math.hypot(h.x - N.x, h.y - N.y) < 7) { N.hold = 0; N.tg = h.id; N.prov = Game.time; }
        if (!campFoes('scout').length) C.flags.scoutsDone = 1;
      } },
    { k: 'say', lines: [
      ['tan', 'Гоблины? Под моей горой? В мой праздник?! Это… это неуважение к дате!'],
      ['grum', 'Это неуважение к горе. Ставлю башню у штрека, а праздник — как стемнеет. Гоблины тоже любят темноту, так что гостей будет больше.'],
    ] },
    { k: 'goal', label: 'Тревога', hint: 'Башня — меню «Оборона». Стройматериалы на складе есть.',
      objs: [{ id: 'tower', t: 'Поставить сторожевую башню у штрека', at: CAMP1.mine,
        cur: () => Game.buildings.some(b => b.type === 'watchtower' && b.state === 'done' && !b.removed && Math.hypot(b.x - CAMP1.mine[0], b.y - CAMP1.mine[1]) < 14 && b.y > CAMP1.mine[1]) ? 1 : 0 }] },
    { k: 'wait', label: 'Канун праздника', until: () => camp1Night() },
    { k: 'say', lines: [
      ['yagla', 'Спать, спать! Завтра праздник, а у кого борода не расчёсана — тот моет посуду.'],
      ['grum', 'Я свою расчёсывал в прошлом году. Хватит.'],
    ] },
    { k: 'wait', label: 'Ночь перед праздником', until: () => !camp1Night() },
    { k: 'wait', label: 'День праздника: ждём вечера', until: () => camp1Night() },
    { k: 'say', fx(C) { if (typeof festCanStart === 'function' && typeof festivalStart === 'function' && festCanStart()) festivalStart('Праздник Первого Камня', 1); }, lines: [
      ['yagla', 'Сто лет назад наши прадеды положили первый камень. Сегодня — споём!'],
      ['tan', 'За гору! Чтоб стояла ещё сто!'],
      ['grum', 'Не говори под руку. Особенно горе.'],
    ] },
    { k: 'check' },
    { k: 'do', fn(C) { C.flags.shnyr = CAMP1.ledge.slice(); C.flags.lit = 1; camp1Wave(C, 4, false); } },
    { k: 'cut', cam: [66, 22], label: 'Нападение', lines: [
      ['shnyr', 'Эй, бородатые! С праздником! Подарок уже под горой — осталось развернуть!'],
      ['grum', 'Гоблины! Все к большому костру, у огня они не держатся! Герой — к штреку!'],
    ] },
    { k: 'goal', label: 'Нападение', hint: 'Жители прячутся у большого костра и в домах. Башни стреляют сами.',
      objs: [{ id: 'w1', t: 'Отбить первую волну гоблинов', need: 1, cur: () => camp1WaveLeft() ? 0 : 1 }] },
    { k: 'do', fn(C) { camp1Wave(C, 6, true, 1); } },
    { k: 'say', lines: [['grum', 'Ещё лезут! И с юга тоже — от ворот! Они нас окружают. Вежливо, по-гоблински.']] },
    { k: 'goal', label: 'Нападение', objs: [{ id: 'w2', t: 'Отбить вторую волну (штрек и Южные ворота)', need: 1, cur: () => camp1WaveLeft() ? 0 : 1 }] },
    { k: 'do', fn(C) { camp1Wave(C, 8, true, 2); } },
    { k: 'say', lines: [['shnyr', 'Не нравится наш праздник? А у нас ещё фейерверк есть!']] },
    { k: 'goal', label: 'Нападение', objs: [{ id: 'w3', t: 'Отбить третью волну', need: 1, cur: () => camp1WaveLeft() ? 0 : 1 }] },
    { k: 'cut', cam: [66, 22], lines: [
      ['shnyr', 'Ладно, по-хорошему не хотите. БАБАХ!'],
      ['grum', 'Он сказал «бабах»? Все от горы! БЫСТРО!'],
    ] },
    { k: 'cut', cam: [64, 24], min: 6, label: 'Бабах', fx: camp1Boom,
      during(C, s) { C.tilt = Math.min(CAMP1_TILT, s.t / 5 * CAMP1_TILT); },
      lines: [
        ['note', 'Гора вздрогнула, охнула и… накренилась.'],
        ['grum', 'Гора… накренилась.'],
        ['yagla', 'Как ты после праздника.'],
        ['grum', 'Я хотя бы потом выпрямляюсь.'],
      ] },
    { k: 'goal', label: 'Утро после', hint: 'Валуны у штрека уберут каменотёсы; трещины в домах починят строители.',
      init(C) { C.tilt = CAMP1_TILT; },
      objs: [
        { id: 'dawn', t: 'Дожить до рассвета', cur: () => camp1Night() ? 0 : 1 },
        { id: 'store', t: 'Герой: прийти к складу', zone: () => { const s = Game.buildings.find(b => b.type === 'storehouse' && !b.removed); return s ? [s.doorX, s.doorY + 1, 2.4] : CAMP1.start.concat(3); } },
      ] },
    { k: 'say', fx(C) { const st = Game.buildings.find(b => b.type === 'storehouse' && !b.removed); C.flags.pim = st ? [st.doorX + 2.5, st.doorY + 1.4] : CAMP1.start.slice(); }, lines: [
      ['pim', 'Пим Чернилкин, летописец! Шёл мимо, с чернилами. Совпадение. Уже записал ваш праздник — по слухам.'],
      ['grum', 'Праздник был вчера. Слухи у тебя быстрые.'],
      ['pim', 'Профессия такая! Можно я с вами? Летописи нужна история, а у вас её сейчас — хоть отбавляй.'],
    ] },
    { k: 'cut', pause: true, cam: [64, 44], lines: [
      ['tan', 'Гора стоит. Пока. Завтра уходим — все. Таны уходят последними.'],
      ['grum', 'А куда?'],
      ['tan', 'Это ты мне скажи. Ты у нас прораб.'],
      ['grum', 'Прораб строит. Уводить — работа старосты.'],
      ['tan', 'Вот и поздравляю. С повышением, староста Грум.'],
    ] },
    { k: 'end' },
  ],
};
