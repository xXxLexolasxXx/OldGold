'use strict';
// Сохранение и загрузка в localStorage. Рельеф восстанавливается по зерну генерации,
// поверх кладутся объекты, дороги, здания и жители.

const SAVE_KEY = 'feod.save.';

function resetGameState() {
  Game.buildings = [];
  Game.units = [];
  Game.unitMap.clear();
  Game.smokers.clear();
  Game.piles.clear();
  Game.animals = [];
  Game.critters = []; Game.floaters = []; Game.owls = []; Game.falling = [];
  ROCKMINE.hp.clear(); ROCKMINE.mined.clear(); ROCKMINE.res.clear();
  Game.ents = []; Game.ghosts = []; Game.sub = null; Game.subDay = -1; Game.skels = []; Game.lostGnomes = 0; Game.gyNext = 0; Game.entNight = null; Game.wasNight = false; Game.log = []; Game.builtN = 0; Game.festival = null; Game.festNext = undefined; Game.festWish = false; Game.brawl = null; Game.brawlNext = undefined; Game.brawlN = 0;
  Game.bats = [];
  Game.crows = []; Game.frogs = []; Game.worms = []; Game.chests = null; Game.fairy = null; Game.flies = []; Game.mice = []; Game.badger = null; Game.squirrels = []; Game.peckers = []; Game.hills = []; Game.hedgehogs = []; Game.holes = []; Game.dirt = []; Game.faunaStat = {}; Game.flyNight = -1; resetFairy();
  beastsReset();
  if (typeof seaLifeReset === 'function') seaLifeReset();
  Game.fieldPlans = new Set(); Game.avenge = [];
  World.occ.fill(0);
  World.roadDirty = true;
  Game.roadSites.clear();
  Game.time = 0;
  if (typeof PF !== "undefined") PF.regT = -1e9;   // новый мир — области проходимости пересчитать
  Game.nextId = 1;
  Game.selected = null;
  Game.tool = null;
  Game.storeBlock = {};
  Game.produced = emptyGoods();
  Game.diff = Game.pendDiff || 'normal';
  Game.unlocked = allUnlocked();   // по умолчанию меню открыто целиком; новая игра закрывает его сама
}

// Ночные существа: хранятся только «где жили»; при загрузке встают заново (спящими / поднимающимися),
// а номер ночи сохраняется, чтобы вечер не вызвал нечисть повторно
function serializeNight() {
  const ents = (Game.ents || []).filter(e => e.state !== 'done' && e.state !== 'gone' && !e.dead && !e.burnT)
    .map(e => [e.water ? 'w' : e.rock ? 'r' : 't', e.i, e.hx, e.hy, e.wx ?? 0, e.wy ?? 0]);
  const skels = (Game.skels || []).filter(k => k.state !== 'dead' && k.state !== 'sink').map(k => [+k.hx.toFixed(1), +k.hy.toFixed(1)]);
  return { ni: Game.entNight, wn: !!Game.wasNight, ents, skels };
}

function applyNight(n) {
  if (!n) return;
  Game.entNight = n.ni ?? null; Game.wasNight = !!n.wn;
  for (const [k, i, hx, hy, wx, wy] of n.ents || []) {
    if (k === 'w') {
      Game.ents.push(newEnt({ water: true, o: {}, i, wx, wy, hx, hy, x: wx + 0.5, y: wy + 0.5 }));
      continue;
    }
    const o = World.obj[i];
    if (!o || o.t !== (k === 'r' ? 'stone' : 'tree') || o.awake) continue;
    o.awake = true; o.res = true;
    Game.ents.push(newEnt(k === 'r' ? { rock: true, i, o, hx, hy, x: hx + 0.5, y: hy + 0.5 } : { i, o, hx, hy, x: hx + 0.5, y: hy + 0.5 }));
  }
  Game.nightEntTotal = Game.ents.length;
  // призраки не сохраняются: ночью они проступают заново сами (старые сейвы с полем ghosts его игнорируют)
  Game.ghosts = [];
  if (Game.entNight != null && Game.entNight === nightIndex() && isNightNow() && !isDawnNow()) ghostsSpawn(1 + Math.floor(Math.random() * 3) + Math.floor((Game.lostGnomes || 0) / 2));
  for (const [x, y] of n.skels || []) skelRise(x, y, Math.random() * 2);
}

function serializeGame() {
  const obj = [];
  for (let i = 0; i < N_TILES; i++) {
    const o = World.obj[i];
    if (o && o.t !== 'fort') obj.push([i, o.t, o.g ?? 0, o.n ?? (o.plan ? 2 : o.ash ? 1 : 0), o.farm ?? 0, o.crop || '', o.v, o.vert ? 1 : 0, o.b !== undefined ? Math.round(o.b * 10) / 10 : undefined, o.bd]);
  }
  const road = [];
  for (let i = 0; i < N_TILES; i++) if (World.road[i]) road.push(i);
  const nz = o => { const r = {}; for (const k in o) if (o[k]) r[k] = o[k]; return r; };
  return {
    v: 2, sv: SAVE_REV, gv: typeof GAME_VERSION === 'undefined' ? undefined : GAME_VERSION, df: Game.diff, mw: MAP_W, mh: MAP_H, bi: MapOpt.biome || undefined, seed: Game.seed, time: Game.time, nextId: Game.nextId, speed: Game.speed,   // sv/gv — ревизия формата и версия игры в начале файла: saveRawGv читает их, не разбирая весь текст
    storeBlock: Game.storeBlock, unlocked: Object.keys(Game.unlocked), lost: Game.lostGnomes || 0, ch: serializeChests(), fy: serializeFairy1(), f2: serializeFairy(), fs: Game.faunaStat && Object.keys(Game.faunaStat).length ? Game.faunaStat : undefined, be: serializeBeasts(), sl: typeof serializeSeaLife === 'function' ? serializeSeaLife() : undefined, produced: nz(Game.produced),
    cam: { x: R.cam.x, y: R.cam.y, z: R.cam.z },
    obj, road, dfn: defSave(),
    mined: [...ROCKMINE.mined], rockHp: [...ROCKMINE.hp],
    buildings: Game.buildings.map(b => serializeBuilding(b)),
    pets: Game.animals.filter(a => a.owner && !a.dead).map(a => [a.kind, +a.x.toFixed(2), +a.y.toFixed(2), Game.units.findIndex(u => u.id === a.owner)]).filter(p => p[3] >= 0),
    night: serializeNight(), fest: serializeFestival(), brawl: serializeBrawl(),
    roadSites: [...Game.roadSites.values()].map(s => ({ x: s.x, y: s.y, stone: s.stock.stone, dug: s.dug })),
    piles: savePiles(),   // кучи на земле и груз в руках — раньше пропадали при сохранении
    units: Game.units.map(u => ({
      type: u.type, x: u.x, y: u.y, food: u.food, look: u.look, home: u.home ? u.home.id : 0,
      homePen: u.homePen || 0, homeStable: u.homeStable || 0, smoker: u.smoker, xp: u.xp || undefined,
      h: u.hero || undefined, tm: u.teamOf && Game.units.some(x => x.id === u.teamOf) ? Game.units.findIndex(x => x.id === u.teamOf) : undefined,   // герой и его напарник; напарник того, кого уже нет в списке, не пишется как -1 (иначе сейв после загрузки отличался)
    })),
  };
}

// Одно здание — отдельно, чтобы кооп-сервер собирал пакет мира без полного serializeGame
function serializeBuilding(b) {
  const nz = o => { const r = {}; for (const k in o) if (o[k]) r[k] = o[k]; return r; };
  return {
    id: b.id, type: b.type, x: b.x, y: b.y, rot: b.rot || 0, state: b.state, stock: nz(b.stock),
    used: b.used, usedOf: nz(b.usedOf), hits: b.hits, queue: b.queue, training: b.training,
    level: b.level || 1, upg: b.upg ? { used: nz(b.upg.used), stock: nz(b.upg.stock), usedN: b.upg.usedN, hits: b.upg.hits } : null, paused: b.paused, hold: b.hold || undefined, noDeliver: !!b.noDeliver, dmg: b.dmg || 0, recipeOn: b.recipeOn, orders: b.orders && b.orders.length ? b.orders : undefined, recipeIdx: b.recipeIdx, pigs: b.pigs, crops: b.crops, hireReq: b.hireReq || undefined,
  };
}

// Груз в руках после загрузки лежит кучкой там, где его несли: задания доставки не сохраняются
function savePiles() {
  const m = new Map();
  const add = (x, y, g, n) => {
    if (!GOODS[g] || !(n > 0) || !inb(x, y)) return;
    const k = idx(x, y);
    if (!m.has(k)) m.set(k, [x, y, {}]);
    const st = m.get(k)[2]; st[g] = (st[g] || 0) + n;
  };
  for (const p of Game.piles.values()) if (!p.removed) for (const g of GOOD_KEYS) add(p.x, p.y, g, p.stock[g]);
  for (const u of Game.units) if (u.carry && !u.dead) add(Math.floor(u.x), Math.floor(u.y), u.carry, u.carryN || 1);
  return [...m.values()];
}

function applySave(s) {
  MapOpt.biome = s.bi && BIOMES[s.bi] ? s.bi : null;   // сейвы без биома — прежняя карта
  MAPEV.cur = null; MAPEV.low = null;
  setMapSize(s.mw || MAP_LEGACY_W, s.mh || MAP_LEGACY_H);   // сохранения без размера — старая карта 96×72
  resetGameState();
  Game.seed = s.seed;
  Game.diff = diffKey(s.df);   // старые сохранения без сложности — «Обычный» (прежний баланс)
  genWorld(s.seed);
  for (const i of s.mined || []) { World.terrain[i] = T_GRASS; World.crystal[i] = 0; ROCKMINE.mined.add(i); }
  for (const [i, n] of s.rockHp || []) ROCKMINE.hp.set(i, n);
  World.obj.fill(null);
  World.growing.clear();
  for (const [i, t, g, n, farm, crop, dv, dvert, db, dbd] of s.obj) {
    const o = { t };
    if (t === 'tree' || t === 'field' || t === 'stump' || t === 'bin') o.g = g;
    if (t === 'stone') o.n = n;
    if (dv !== undefined && dv !== null) o.v = dv;
    if (dvert) o.vert = true;
    if (t === 'sandc' && Number.isFinite(db)) { o.b = db; o.bd = Number.isFinite(dbd) ? dbd : 8; }   // песочный замок: когда заложен и сколько строился
    if (t === 'field') { o.farm = farm; o.crop = !crop || crop === 'hay' ? 'wheat' : crop; o.ash = n === 1; o.plan = n === 2; if (o.plan) Game.fieldPlans.add(i); }
    World.obj[i] = o;
    if ((t === 'tree' && g < 1) || (t === 'field' && g >= 0 && g < 1) || t === 'stump') World.growing.add(i);
  }
  defLoad(s.dfn);
  World.road.fill(0);
  for (const i of s.road) World.road[i] = 1;
  World.roadDirty = true;

  const byId = new Map();
  for (const d of s.buildings) {
    const b = new Building(d.type, d.x, d.y, d.state === 'done', d.rot || 0);
    b.id = d.id;
    b.state = d.state;
    Object.assign(b.stock, d.stock);
    Object.assign(b.usedOf, d.usedOf);
    b.used = d.used;
    b.hits = d.hits ?? (b.state === 'done' ? b.maxHits : SITE_HITS + d.used * HITS_PER_UNIT);
    b.queue = (d.queue || []).map(q => (UNIT_TYPES[q] && UNIT_TYPES[q].legacy) || q);
    b.training = d.training || null;
    b.paused = !!d.paused;
    if (d.hold) b.hold = true;
    b.noDeliver = !!d.noDeliver; b.dmg = d.dmg || 0;
    b.hireReq = d.hireReq ? 1 : 0;
    if (b.type === 'graveyard' && b.state !== 'done') { b.selfBuild = true; b.maxHits = SITE_HITS + GY_BUILD_HITS; b.total = 1; }
    if (d.level >= 2 && b.def.up) { upgradeBuilding(b, true); if (d.level >= 3 && b.def.up3) upgradeBuilding(b, true); }
    if (d.upg && canUpgrade(b)) { startUpgrade(b); Object.assign(b.upg.used, d.upg.used); Object.assign(b.upg.stock, d.upg.stock); b.upg.usedN = d.upg.usedN; b.upg.hits = d.upg.hits; }
    if (d.recipeOn && d.recipeOn.length === b.recipeOn.length) b.recipeOn = d.recipeOn;
    b.recipeIdx = d.recipeIdx || 0;
    if (Array.isArray(d.orders)) b.orders = d.orders.filter(o => o && Number.isInteger(o.i) && o.n > 0);
    if (d.pigs) b.pigs = d.pigs;
    if (d.crops) b.crops = d.crops;
    for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) World.bmap[idx(xx, yy)] = b.id;
    World.door[idx(b.doorX, b.doorY)] = 1;
    if (b.door2) World.door[idx(b.door2[0], b.door2[1])] = 1;
    Game.buildings.push(b);
    byId.set(b.id, b);
  }
  for (const r of s.roadSites) {
    const rs = new RoadSite(r.x, r.y);
    rs.stock.stone = r.stone || 0;
    rs.dug = r.dug || 0;
    Game.roadSites.set(idx(r.x, r.y), rs);
  }
  for (const d of s.units) {
    // слитые профессии: старые жители переходят в новые (хмелевод → пахарь и т.д.)
    const home0 = byId.get(d.home);
    let ty = d.type;
    if (UNIT_TYPES[ty] && UNIT_TYPES[ty].legacy) ty = UNIT_TYPES[ty].legacy;
    if (ty === 'tanner' && home0 && home0.type === 'tannery') ty = 'breeder';
    const u = new Unit(ty, 0, 0);
    u.x = d.x; u.y = d.y; u.food = d.food; u.look = d.look;
    u.homePen = d.homePen || 0; u.homeStable = d.homeStable || 0; u.xp = d.xp || 0;   // старые сохранения: выслуги нет
    if (d.smoker !== undefined) u.smoker = d.smoker;
    const home = byId.get(d.home);
    if (home) { u.home = home; home.worker = u; }
    if (d.h) { u.hero = d.h; if (u.type === 'hero') { Game.hero = u; u.smoker = false; } }
    Game.units.push(u);
    Game.unitMap.set(u.id, u);
  }
  s.units.forEach((d, k) => { if (d.tm >= 0 && Game.units[d.tm]) Game.units[k].teamOf = Game.units[d.tm].id; });
  Game.time = s.time;
  if (typeof defGatesSync === 'function') defGatesSync();   // ворота «Авто» — по времени суток сейва (defLoad шёл ещё при нулевом времени)
  Game.nextId = Math.max(s.nextId, Game.nextId);
  Game.storeBlock = s.storeBlock || {};
  Game.unlocked = s.unlocked ? Object.fromEntries(s.unlocked.map(k => [k, true])) : allUnlocked();   // старые сохранения — всё открыто
  UI.shown = null; renderBuildMenu();
  Game.lostGnomes = s.lost || 0;
  Game.faunaStat = s.fs || {};
  if (s.ch) loadChests(s.ch);
  loadFairy1(s.fy);
  loadFairy(s.f2);
  Object.assign(Game.produced, s.produced || {});
  if (s.cam) { R.cam.x = s.cam.x; R.cam.y = s.cam.y; R.cam.z = ZOOMS.includes(s.cam.z) ? s.cam.z : 2; }
  buildTerrain(s.seed);
  spawnAnimals();
  for (const [kind, x, y, ui] of s.pets || []) {
    const u = Game.units[ui];
    if (!u || !ANIMALS[kind]) continue;
    const a = makeAnimal(kind, Math.floor(x), Math.floor(y));
    a.x = x; a.y = y;
    if (kind === 'duck' && isWaterAt(Math.floor(x), Math.floor(y))) a.swim = true;
    a.owner = u.id; a.tamedBy = u.id; a.state = 'follow'; a.errCD = Game.time + 25 + Math.random() * 30; a.loot = petLoot(a);
    Game.animals.push(a);
  }
  for (const [x, y, st] of s.piles || []) if (inb(x, y)) for (const g in st) if (GOODS[g] && st[g] > 0) dropPile(x, y, g, st[g]);
  applyBeasts(s.be);
  if (typeof applySeaLife === 'function') applySeaLife(s.sl);
  applyNight(s.night);
  applyFestival(s.fest);
  applyBrawl(s.brawl);
  updateMinimapBase();
}

// Ревизия формата сохранения (поле sv; поле v = 2 остаётся ради старых клиентов и сервера).
// Поменял формат — подними SAVE_REV и допиши миграцию: SAVE_MIGRATIONS[n] переводит сейв из ревизии n в n + 1.
// ВАЖНО: сейв новой ревизии старый клиент (вкладка со старой версией игры) не прочтёт, поэтому ревизию поднимаем
// только когда без этого никак; добавление необязательных полей миграции не требует (applySave берёт значения по умолчанию).
// tests/save-test.js грузит все сейвы из tests/saves/ (по одному на версию игры) — после изменения формата добавь свежий.
const SAVE_REV = 1;
const SAVE_MIGRATIONS = [
  s => s,   // 0 → 1: сейвы до появления ревизии, формат тот же
];
function migrateSave(s, rev = SAVE_REV, steps = SAVE_MIGRATIONS) {
  let r = s.sv | 0;
  if (r > rev) throw new Error(`сохранение из более новой версии игры (формат ${r}, игра понимает до ${rev})`);
  while (r < rev) { s = steps[r](s) || s; r++; s.sv = r; }
  return s;
}
const SAVE_BACKUP_EVERY = 180000;   // копия автосейва обновляется не чаще раза в 3 минуты: если свежий сейв окажется битым, назад откатываемся недалеко
// Потолки: сейв больше этих чисел — не наш (мусор, чужой файл, разросшаяся ошибка); лучше понятный отказ, чем зависшая вкладка
const SAVE_MAX = { bytes: 48e6, units: 20000, buildings: 6000, side: 400000 };

// Проверка и уборка разобранного сейва перед применением: неизвестные здания и жители (из будущей версии, удалённые
// из игры) пропускаются, а не роняют всю загрузку; координаты вне карты и нечисла отбрасываются. Возвращает список замечаний.
function saveSanitize(s) {
  const notes = [];
  const fin = v => typeof v === 'number' && isFinite(v);
  const mw = s.mw === undefined ? MAP_LEGACY_W : s.mw, mh = s.mh === undefined ? MAP_LEGACY_H : s.mh;
  if (!(Number.isInteger(mw) && Number.isInteger(mh) && mw >= 16 && mh >= 16 && mw * mh <= 512 * 512)) throw new Error('в сохранении неверный размер карты');
  if (!fin(s.seed)) throw new Error('в сохранении нет зерна карты');
  const nt = mw * mh, inMap = (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < mw && y < mh;
  if (s.obj.length > nt || s.units.length > SAVE_MAX.units || s.buildings.length > SAVE_MAX.buildings) throw new Error(`сохранение слишком большое (${s.buildings.length} зданий, ${s.units.length} жителей)`);
  if (!fin(s.time) || s.time < 0) { s.time = 0; notes.push('время игры'); }
  if (!fin(s.nextId) || s.nextId < 1) s.nextId = 1;
  for (const k of ['mined', 'rockHp', 'piles', 'pets', 'roadSites', 'road', 'unlocked']) {
    if (s[k] === undefined) continue;
    if (!Array.isArray(s[k]) || s[k].length > SAVE_MAX.side) { delete s[k]; notes.push(k); }
  }
  s.road = (s.road || []).filter(i => Number.isInteger(i) && i >= 0 && i < nt);
  s.roadSites = (s.roadSites || []).filter(r => r && inMap(r.x, r.y));
  if (s.mined) s.mined = s.mined.filter(i => Number.isInteger(i) && i >= 0 && i < nt);
  if (s.rockHp) s.rockHp = s.rockHp.filter(p => Array.isArray(p) && Number.isInteger(p[0]) && p[0] >= 0 && p[0] < nt && fin(p[1]));
  if (s.piles) s.piles = s.piles.filter(p => Array.isArray(p) && inMap(p[0], p[1]) && p[2] && typeof p[2] === 'object');
  const n0 = s.obj.length;
  s.obj = s.obj.filter(o => Array.isArray(o) && Number.isInteger(o[0]) && o[0] >= 0 && o[0] < nt && typeof o[1] === 'string');
  if (s.obj.length < n0) notes.push(`${n0 - s.obj.length} объектов карты`);
  const ids = new Set(), nb = s.buildings.length;
  s.buildings = s.buildings.filter(d => {
    const ok = d && typeof d === 'object' && BUILDINGS[d.type] && inMap(d.x, d.y) && Number.isInteger(d.id) && d.id > 0 && !ids.has(d.id) && typeof d.state === 'string';
    if (ok) { ids.add(d.id); if (!d.stock || typeof d.stock !== 'object') d.stock = {}; if (!d.usedOf || typeof d.usedOf !== 'object') d.usedOf = {}; if (!fin(d.used)) d.used = 0; }
    return ok;
  });
  if (s.buildings.length < nb) notes.push(`${nb - s.buildings.length} зданий неизвестного вида`);
  // жители: индексы в списке используют питомцы и напарники героя, поэтому после вычёркивания перенумеровываем
  const remap = new Array(s.units.length).fill(-1), units = [];
  s.units.forEach((d, i) => {
    if (d && typeof d === 'object' && UNIT_TYPES[d.type] && fin(d.x) && fin(d.y) && d.x > -2 && d.y > -2 && d.x < mw + 2 && d.y < mh + 2) { remap[i] = units.length; units.push(d); }
  });
  if (units.length < s.units.length) notes.push(`${s.units.length - units.length} жителей неизвестного вида`);
  for (const d of units) {
    if (!fin(d.food)) d.food = 100;
    if (d.tm >= 0) d.tm = remap[d.tm] >= 0 ? remap[d.tm] : undefined;
  }
  s.units = units;
  if (s.pets) s.pets = s.pets.filter(p => Array.isArray(p) && fin(p[1]) && fin(p[2]) && remap[p[3]] >= 0).map(p => [p[0], p[1], p[2], remap[p[3]]]);
  return notes;
}

function saveRawGv(raw) {   // версия игры, записавшая сейв: поле gv в начале файла (с 0.10.111) или в конце (прежние), весь текст разбирать не нужно
  const m = /"gv":"([^"]*)"/.exec(raw.slice(0, 160)) || /"gv":"([^"]*)"/.exec(raw.slice(-200));
  return m ? m[1] : null;
}

function saveStore(key, data) {   // запись с попыткой освободить место: сначала отложенный битый файл, потом копии
  try { localStorage.setItem(key, data); return true; } catch (e) { /* ниже */ }
  for (const suf of ['.broken', '.bak', '.pre']) {
    for (const slot of ['auto', 'manual']) {
      const k = SAVE_KEY + slot + suf;
      if (k === key) continue;
      try { if (localStorage.getItem(k) === null) continue; localStorage.removeItem(k); localStorage.removeItem(k + '.meta'); } catch (x) { continue; }
      try { localStorage.setItem(key, data); return true; } catch (x) { /* ещё мало места */ }
    }
  }
  return false;
}

function saveGame(slot = 'manual') {
  try {
    const obj = serializeGame();
    obj.sv = SAVE_REV;
    if (typeof GAME_VERSION !== 'undefined') obj.gv = GAME_VERSION;
    const data = JSON.stringify(obj);
    if (slot === 'auto') saveBackup(slot);
    if (!saveStore(SAVE_KEY + slot, data)) throw new Error('нет места в хранилище браузера');
    localStorage.setItem(SAVE_KEY + slot + '.meta', JSON.stringify({ at: Date.now(), time: Game.time, people: Game.units.length, df: Game.diff, gv: obj.gv }));
    return true;
  } catch (e) {
    console.warn('save failed', e);
    if (slot === 'auto' && typeof toast === 'function' && (!saveGame.warnT || Date.now() - saveGame.warnT > 120000)) { saveGame.warnT = Date.now(); toast('Автосохранение не удалось: нет места в браузере. Скачайте сохранение файлом (меню → «Файл сохранения»)'); }
    return false;
  }
}

// Резервная копия предыдущего автосейва (slot.bak): перед записью нового старый копируется, если копия устарела.
// Не хватило места — копию удаляем, основной сейв важнее.
function saveBackup(slot) {
  try {
    const meta = saveMeta(slot + '.bak');
    if (meta && Date.now() - meta.at < SAVE_BACKUP_EVERY) return;
    const cur = localStorage.getItem(SAVE_KEY + slot);
    if (!cur) return;
    try { JSON.parse(cur); } catch (e) { return; }   // битый сейв в копию не кладём
    localStorage.setItem(SAVE_KEY + slot + '.bak', cur);
    localStorage.setItem(SAVE_KEY + slot + '.bak.meta', localStorage.getItem(SAVE_KEY + slot + '.meta') || JSON.stringify({ at: Date.now() }));
  } catch (e) {
    try { localStorage.removeItem(SAVE_KEY + slot + '.bak'); localStorage.removeItem(SAVE_KEY + slot + '.bak.meta'); } catch (x) { /* ничего */ }
  }
}

// Копия «до обновления» (slot.pre): первая загрузка сейва, записанного другой версией игры, откладывает его файл как есть.
// Новая версия потом перезапишет автосейв своим форматом; если что-то пойдёт не так, старый файл остался.
// Одна копия на слот (самая свежая из старых версий); gv в .pre.meta — чтобы не копировать заново при каждой загрузке.
function savePreBackup(slot, raw) {
  if (typeof GAME_VERSION === 'undefined' || /\.(bak|pre|broken)$/.test(slot)) return false;
  try {
    const gv = saveRawGv(raw) || '?';
    if (gv === GAME_VERSION) return false;
    const m = saveMeta(slot + '.pre');
    if (m && m.gv === gv) return false;
    if (!saveStore(SAVE_KEY + slot + '.pre', raw)) return false;
    localStorage.setItem(SAVE_KEY + slot + '.pre.meta', JSON.stringify({ at: Date.now(), gv, to: GAME_VERSION }));
    return true;
  } catch (e) { return false; }
}

// Безопасная загрузка: битый или непонятный сейв не должен оставлять полупустой мир и чёрный экран.
// При ошибке пробуем резервные копии (автосохранение минутной давности, затем «до обновления»), а если и они не годятся —
// начинаем новую игру и честно говорим об этом; повреждённый файл откладывается и его можно скачать из окна сообщения.
function loadGame(slot = 'manual') {
  const get = k => { try { return localStorage.getItem(SAVE_KEY + k); } catch (e) { return null; } };
  const raw = get(slot);
  if (!raw) return false;
  savePreBackup(slot, raw);
  const err = loadSaveText(raw);
  if (!err) {
    const n = loadSaveText.notes;
    if (n && n.length) saveBrokenNotice(`Сохранение загружено, но часть данных пришлось пропустить: ${n.join(', ')}.`, null);
    return true;
  }
  console.warn('сохранение ' + slot + ' не загрузилось:', err);
  if (typeof crashNote === 'function') crashNote('save', slot + ': ' + err);
  if (!/\.(bak|pre)$/.test(slot)) {
    for (const [suf, what] of [['.bak', 'резервная копия'], ['.pre', 'копия до обновления']]) {
      const b = get(slot + suf);
      if (b && !loadSaveText(b)) {
        saveBrokenNotice(`Сохранение повреждено (${err}). Загружена ${what} — до нескольких минут игры могли пропасть.`, raw);
        return true;
      }
    }
  }
  // битый текст откладываем в сторону (если хватит места): автосейв новой игры его иначе затрёт, а по нему можно найти причину
  try { localStorage.setItem(SAVE_KEY + slot + '.broken', raw); } catch (e) { /* нет места — не страшно */ }
  try { newGame(); } catch (e) { console.warn('newGame после битого сейва', e); }
  saveBrokenNotice(`Не удалось загрузить сохранение: ${err}. Начата новая игра, повреждённый файл отложен в сторону.`, raw);
  return false;
}

// Разбор и применение текста сейва; возвращает текст ошибки или null. Пропущенное при уборке — в loadSaveText.notes
function loadSaveText(raw) {
  loadSaveText.notes = [];
  if (typeof raw !== 'string') return 'неизвестный формат';
  if (raw.length > SAVE_MAX.bytes) return `файл слишком большой (${Math.round(raw.length / 1e6)} МБ) — это не сохранение игры`;
  let s;
  try { s = JSON.parse(raw); } catch (e) { return 'файл повреждён (обрезан или испорчен)'; }
  if (!s || typeof s !== 'object' || s.v !== 2 || !Array.isArray(s.obj) || !Array.isArray(s.buildings) || !Array.isArray(s.units)) return 'неизвестный формат';
  try { s = migrateSave(s); } catch (e) { return e.message; }
  try { loadSaveText.notes = saveSanitize(s); } catch (e) { return e.message; }
  try { applySave(s); } catch (e) { return 'ошибка при разборе: ' + (e && e.message || e); }
  if (!Game.buildings.length) return 'в сохранении нет ни одного здания';
  return null;
}

// Проверка файла сейва без применения (для импорта): текст ошибки или null
function saveCheckText(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return 'файл пустой';
  if (raw.length > SAVE_MAX.bytes) return `файл слишком большой (${Math.round(raw.length / 1e6)} МБ) — это не сохранение игры`;
  let s;
  try { s = JSON.parse(raw); } catch (e) { return 'файл повреждён (обрезан или испорчен)'; }
  if (!s || typeof s !== 'object' || s.v !== 2 || !Array.isArray(s.obj) || !Array.isArray(s.buildings) || !Array.isArray(s.units)) return 'это не файл сохранения OldGold';
  try { s = migrateSave(s); saveSanitize(s); } catch (e) { return e.message; }
  if (!s.buildings.length) return 'в сохранении нет ни одного здания';
  return null;
}

// Импорт файла в ячейку: проверка, копия прежнего содержимого в slot.bak, запись. Саму игру не трогает — дальше «Продолжить»/«Загрузить»
function saveImportText(raw, slot = 'manual') {
  const err = saveCheckText(raw);
  if (err) return { ok: false, msg: err };
  const s = JSON.parse(raw);
  try {
    const cur = localStorage.getItem(SAVE_KEY + slot);
    if (cur && cur !== raw) { localStorage.setItem(SAVE_KEY + slot + '.bak', cur); localStorage.setItem(SAVE_KEY + slot + '.bak.meta', localStorage.getItem(SAVE_KEY + slot + '.meta') || JSON.stringify({ at: Date.now() })); }
  } catch (e) { /* копия не вышла — не мешаем */ }
  if (!saveStore(SAVE_KEY + slot, raw)) return { ok: false, msg: 'в браузере нет места для этого сохранения' };
  try { localStorage.setItem(SAVE_KEY + slot + '.meta', JSON.stringify({ at: Date.now(), time: s.time, people: s.units.length, df: s.df, gv: s.gv })); } catch (e) { /* ничего */ }
  return { ok: true, msg: `Загружено из файла (игра ${s.gv || 'старая'}, ${Math.floor((s.time || 0) / 60)} мин, ${s.units.length} жителей)` };
}

// Скачать текст файлом; на телефоне — через «Поделиться», если браузер умеет отдавать файлы
function saveDownload(name, text) {
  try {
    if (typeof File === 'function' && navigator.canShare && navigator.share) {
      const f = new File([text], name, { type: 'application/json' });
      if (navigator.canShare({ files: [f] })) { navigator.share({ files: [f], title: name }).catch(() => {}); return true; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return true;
  } catch (e) { return false; }
}
function saveExport(slot = 'auto') {
  let raw = null;
  try { raw = localStorage.getItem(SAVE_KEY + slot); } catch (e) { /* ничего */ }
  if (!raw) return false;
  const gv = saveRawGv(raw) || 'old', m = saveMeta(slot);
  return saveDownload(`oldgold-${slot}-${gv}${m && m.time ? '-' + Math.floor(m.time / 60) + 'min' : ''}.json`, raw);
}

function saveBrokenNotice(text, raw) {
  saveBrokenNotice.last = text;
  if (typeof toast === 'function') toast(text);
  try {
    if (typeof document === 'undefined' || !document.body || !document.createElement) return;
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:50%;top:20%;transform:translateX(-50%);z-index:100001;max-width:440px;padding:16px 18px;background:#2a1e14;color:#f3e6c8;border:2px solid #a8743a;border-radius:8px;font:14px/1.45 sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.6)';
    el.textContent = text;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;justify-content:center;margin-top:12px;flex-wrap:wrap';
    const mk = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.style.cssText = 'padding:6px 14px'; b.onclick = fn; row.appendChild(b); };
    if (raw) mk('Скачать файл сейва', () => saveDownload('oldgold-broken-save.json', raw));
    mk('Понятно', () => el.remove());
    el.appendChild(row);
    document.body.appendChild(el);
  } catch (e) { /* без окна обойдёмся тостом */ }
}

function saveMeta(slot) {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY + slot + '.meta')); } catch (e) { return null; }
}
