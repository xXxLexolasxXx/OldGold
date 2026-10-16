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
  Game.critters = []; Game.floaters = []; Game.owls = [];
  World.occ.fill(0);
  World.roadDirty = true;
  Game.roadSites.clear();
  Game.time = 0;
  Game.nextId = 1;
  Game.selected = null;
  Game.tool = null;
  Game.storeBlock = {};
  Game.produced = emptyGoods();
}

function serializeGame() {
  const obj = [];
  for (let i = 0; i < N_TILES; i++) {
    const o = World.obj[i];
    if (o) obj.push([i, o.t, o.g ?? 0, o.n ?? (o.ash ? 1 : 0), o.farm ?? 0, o.crop || '']);
  }
  const road = [];
  for (let i = 0; i < N_TILES; i++) if (World.road[i]) road.push(i);
  const nz = o => { const r = {}; for (const k in o) if (o[k]) r[k] = o[k]; return r; };
  return {
    v: 2, seed: Game.seed, time: Game.time, nextId: Game.nextId, speed: Game.speed,
    storeBlock: Game.storeBlock, produced: nz(Game.produced),
    cam: { x: R.cam.x, y: R.cam.y, z: R.cam.z },
    obj, road,
    buildings: Game.buildings.map(b => ({
      id: b.id, type: b.type, x: b.x, y: b.y, rot: b.rot || 0, state: b.state, stock: nz(b.stock),
      used: b.used, usedOf: nz(b.usedOf), hits: b.hits, queue: b.queue, training: b.training,
      paused: b.paused, recipeOn: b.recipeOn, recipeIdx: b.recipeIdx, pigs: b.pigs, crops: b.crops,
    })),
    roadSites: [...Game.roadSites.values()].map(s => ({ x: s.x, y: s.y, stone: s.stock.stone, dug: s.dug })),
    units: Game.units.map(u => ({
      type: u.type, x: u.x, y: u.y, food: u.food, look: u.look, home: u.home ? u.home.id : 0,
      homePen: u.homePen || 0, homeStable: u.homeStable || 0, smoker: u.smoker,
    })),
  };
}

function applySave(s) {
  resetGameState();
  Game.seed = s.seed;
  genWorld(s.seed);
  World.obj.fill(null);
  World.growing.clear();
  for (const [i, t, g, n, farm, crop] of s.obj) {
    const o = { t };
    if (t === 'tree' || t === 'field' || t === 'stump' || t === 'bin') o.g = g;
    if (t === 'stone') o.n = n;
    if (t === 'field') { o.farm = farm; o.crop = crop || 'wheat'; o.ash = n === 1; }
    World.obj[i] = o;
    if ((t === 'tree' && g < 1) || (t === 'field' && g >= 0 && g < 1) || t === 'stump') World.growing.add(i);
  }
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
    b.queue = d.queue || [];
    b.training = d.training || null;
    b.paused = !!d.paused;
    if (d.recipeOn && d.recipeOn.length === b.recipeOn.length) b.recipeOn = d.recipeOn;
    b.recipeIdx = d.recipeIdx || 0;
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
    const u = new Unit(d.type, 0, 0);
    u.x = d.x; u.y = d.y; u.food = d.food; u.look = d.look;
    u.homePen = d.homePen || 0; u.homeStable = d.homeStable || 0;
    if (d.smoker !== undefined) u.smoker = d.smoker;
    const home = byId.get(d.home);
    if (home) { u.home = home; home.worker = u; }
    Game.units.push(u);
    Game.unitMap.set(u.id, u);
  }
  Game.time = s.time;
  Game.nextId = Math.max(s.nextId, Game.nextId);
  Game.storeBlock = s.storeBlock || {};
  Object.assign(Game.produced, s.produced || {});
  if (s.cam) { R.cam.x = s.cam.x; R.cam.y = s.cam.y; R.cam.z = ZOOMS.includes(s.cam.z) ? s.cam.z : 2; }
  buildTerrain(s.seed);
  spawnAnimals();
  updateMinimapBase();
}

function saveGame(slot = 'manual') {
  try {
    const data = JSON.stringify(serializeGame());
    localStorage.setItem(SAVE_KEY + slot, data);
    localStorage.setItem(SAVE_KEY + slot + '.meta', JSON.stringify({ at: Date.now(), time: Game.time, people: Game.units.length }));
    return true;
  } catch (e) {
    console.warn('save failed', e);
    return false;
  }
}

function loadGame(slot = 'manual') {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY + slot)); } catch (e) { s = null; }
  if (!s || s.v !== 2) return false;
  applySave(s);
  return true;
}

function saveMeta(slot) {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY + slot + '.meta')); } catch (e) { return null; }
}
