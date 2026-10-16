'use strict';
// Состояние игры, здания, дорожные стройки и жители.

const Game = {
  time: 0,
  speed: 1,
  paused: false,
  buildings: [],
  units: [],
  unitMap: new Map(),     // id -> житель
  roadSites: new Map(),   // индекс клетки -> RoadSite
  piles: new Map(),       // индекс клетки -> Pile (уроненный груз)
  animals: [],            // дикие звери
  smokers: new Set(),     // кто сейчас курит
  nextId: 1,
  selected: null,
  tool: null,             // { kind: 'build', type } | { kind: 'road' } | { kind: 'erase' }
  dispatchT: 0,
  growT: 0,
  seed: 0,
  storeBlock: {},         // товар -> true: склады его не принимают
  produced: null,         // сколько всего произведено каждого товара
};

function emptyGoods() {
  const o = {};
  for (const g of GOOD_KEYS) o[g] = 0;
  return o;
}
Game.produced = emptyGoods();

// ---------- Рецепты ----------

function recipeCanRun(b, r) {
  for (const g in r.in) if (b.stock[g] < r.in[g]) return false;
  for (const g in r.out) if (b.stock[g] + r.out[g] > b.def.outputs[g]) return false;
  return true;
}

// Следующий включённый рецепт, который можно выполнить (по кругу).
function pickRecipe(b) {
  const rs = b.def.recipes;
  if (!rs) return null;
  for (let k = 0; k < rs.length; k++) {
    const i = (b.recipeIdx + k) % rs.length;
    if (b.recipeOn[i] && recipeCanRun(b, rs[i])) { b.recipeIdx = (i + 1) % rs.length; return rs[i]; }
  }
  return null;
}

function recipeConsume(b, r) { for (const g in r.in) b.stock[g] -= r.in[g]; }

function recipeProduce(b, r) {
  for (const g in r.out) { b.stock[g] += r.out[g]; Game.produced[g] += r.out[g]; }
}

class Building {
  constructor(type, x, y, done, rot = 0) {
    this.id = Game.nextId++;
    this.type = type;
    this.def = BUILDINGS[type];
    this.x = x; this.y = y;
    const d = bDims(type, rot);
    this.rot = d.rot;              // 0 — вход на юг, 1 — вход на восток
    this.w = d.w; this.h = d.h;
    this.doorX = x + d.dx;
    this.doorY = y + d.dy;
    this.state = done ? 'done' : 'site';   // site -> build -> done
    this.stock = emptyGoods();
    this.incoming = emptyGoods();
    this.reserved = emptyGoods();
    this.usedOf = emptyGoods();
    this.used = 0;
    this.total = Object.values(this.def.cost).reduce((a, b) => a + b, 0);
    this.hits = 0;                                         // удары молота строителя
    this.maxHits = SITE_HITS + this.total * HITS_PER_UNIT;
    this.builder = null;
    this.worker = null;
    this.removed = false;
    this.queue = [];
    this.training = null;
    this.working = false;
    this.anim = 0;
    this.paused = false;
    this.recipeOn = (this.def.recipes || []).map(() => true);
    this.recipeIdx = 0;
    this.autoJob = null;     // текущий цикл здания без рабочего
    this.pigs = [];          // свинарник: стадии подрастающих свиней (1 или 2 трети)
    this.crops = {};                           // ферма: что сеять
    for (const c of (this.def.crops || [])) this.crops[c] = true;
  }

  get progress() { return this.state === 'done' ? 1 : this.hits / this.maxHits; }
  // доля «собранного» здания без разметки площадки
  get buildFrac() { return this.state === 'done' ? 1 : Math.max(0, (this.hits - SITE_HITS) / (this.maxHits - SITE_HITS)); }

  // Нужен ли товар хоть одному включённому рецепту
  wantsInput(g) {
    const rs = this.def.recipes;
    if (!rs) return true;
    return rs.some((r, i) => this.recipeOn[i] && r.in[g]);
  }

  // Что мешает работать (для подсказок и значков над зданием)
  // Вход связан дорогой с каким-нибудь складом?
  roadLinked() {
    const comp = compAt(this.doorX, this.doorY);
    if (!comp) return false;
    return Game.buildings.some(b => b.isStore() && compAt(b.doorX, b.doorY) === comp);
  }

  problem() {
    if (this.state !== 'done') return this.roadLinked() ? null : 'noroad';
    if (this.paused) return 'paused';
    if (!this.isStore() && !this.roadLinked()) return 'noroad';
    if (this.def.worker && !(this.worker && this.worker.home === this)) return 'noworker';
    if (this.type === 'swine') {
      if (this.stock.pig >= this.def.outputs.pig) return 'full';
      if (this.stock.hay < 1) return 'need:hay';
      return null;
    }
    if (this.def.crops && !this.def.crops.some(c => this.crops[c])) return 'paused';
    if (this.type === 'stable') {
      const n = Game.units.filter(x => x.type === 'carter' && x.homeStable === this.id).length;
      if (n < 3 && this.stock.hay < 3) return 'need:hay';
      if (n < 3 && this.stock.wheat < 2) return 'need:wheat';
    }
    const rs = this.def.recipes;
    if (rs && rs.length && !rs.some((r, i) => this.recipeOn[i] && recipeCanRun(this, r))) {
      const full = rs.every(r => Object.keys(r.out).some(g => this.stock[g] + r.out[g] > this.def.outputs[g]));
      if (full) return 'full';
      for (const r of rs) for (const g in r.in) if (this.stock[g] < r.in[g]) return 'need:' + g;
    }
    return null;
  }

  isStore() { return this.type === 'storehouse' && this.state === 'done'; }

  offer(g) {
    if (this.state !== 'done') return 0;
    if (this.isStore() || (this.def.outputs && this.def.outputs[g] != null))
      return this.stock[g] - this.reserved[g];
    return 0;
  }

  demand(g) {
    if (this.state !== 'done') {
      const need = (this.def.cost[g] || 0) - this.usedOf[g] - this.stock[g] - this.incoming[g];
      return Math.max(0, need);
    }
    if (this.isStore() || !this.def.inputs) return 0;
    const cap = this.def.inputs[g];
    if (!cap || !this.wantsInput(g)) return 0;
    return Math.max(0, cap - this.stock[g] - this.incoming[g]);
  }

  update(dt) {
    if (this.state !== 'done') return;
    if (this.def.auto) {
      if (!this.autoJob && !this.paused) {
        const r = pickRecipe(this);
        if (r) { recipeConsume(this, r); this.autoJob = { r, t: r.time }; }
      }
      if (this.autoJob) {
        this.working = true;
        this.autoJob.t -= dt;
        if (this.autoJob.t <= 0) { recipeProduce(this, this.autoJob.r); this.autoJob = null; }
      } else this.working = false;
    }
    if (this.type === 'school') {
      if (!this.training && this.queue.length && this.stock.gold >= 1) {
        this.stock.gold--;
        this.training = { type: this.queue.shift(), t: 0 };
      }
      if (this.training) {
        this.training.t += dt;
        if (this.training.t >= TRAIN_TIME) {
          spawnUnit(this.training.type, this.doorX, this.doorY);
          this.training = null;
        }
      }
    }
    this.anim += dt * (this.working ? 3 : 0.25);
  }
}

class RoadSite {
  constructor(x, y) {
    this.id = Game.nextId++;
    this.isRoad = true;
    this.x = x; this.y = y;
    this.doorX = x; this.doorY = y;
    this.stock = emptyGoods();
    this.incoming = emptyGoods();
    this.reserved = emptyGoods();
    this.builder = null;
    this.removed = false;
  }
  offer() { return 0; }
  demand(g) {
    if (g !== 'stone') return 0;
    return Math.max(0, ROAD_STONE - this.stock.stone - this.incoming.stone);
  }
}

// ---------- Кучки товара на земле ----------
// Появляются, когда груз уронили при столкновении. Курьеры подбирают и уносят на склад.

class Pile {
  constructor(x, y) {
    this.id = Game.nextId++;
    this.isPile = true;
    this.x = x; this.y = y;
    this.doorX = x; this.doorY = y;
    this.stock = emptyGoods();
    this.reserved = emptyGoods();
    this.incoming = emptyGoods();
    this.removed = false;
  }
  offer(g) { return this.stock[g] - this.reserved[g]; }
  demand() { return 0; }
  isStore() { return false; }
}

function dropPile(x, y, g, n) {
  if (!g || n <= 0) return null;
  if (!isWalkable(x, y)) {
    const near = randomFreeNear(x, y, 0, 2, (xx, yy) => isWalkable(xx, yy));
    if (!near) return null;
    [x, y] = near;
  }
  const i = idx(x, y);
  let p = Game.piles.get(i);
  if (!p || p.removed) { p = new Pile(x, y); Game.piles.set(i, p); }
  p.stock[g] += n;
  return p;
}

function cleanupPile(p) {
  for (const g of GOOD_KEYS) if (p.stock[g] > 0 || p.reserved[g] > 0) return;
  p.removed = true;
  Game.piles.delete(idx(p.x, p.y));
}

// ---------- Размещение и удаление ----------

function setRoad(x, y, v) {
  World.road[idx(x, y)] = v ? 1 : 0;
  World.roadDirty = true;
  if (typeof redrawTilesAround === 'function') redrawTilesAround(x, y);
}

// Возвращает null, если можно строить, иначе текст причины.
function checkPlacement(type, x, y, rot = 0) {
  const def0 = BUILDINGS[type];
  const dd = bDims(type, rot);
  const def = { ...def0, w: dd.w, h: dd.h, dx: dd.dx, dy: dd.dy };
  for (let yy = y; yy < y + def.h; yy++) for (let xx = x; xx < x + def.w; xx++) {
    if (!inb(xx, yy)) return 'За краем карты';
    const i = idx(xx, yy);
    if (World.terrain[i] !== T_GRASS) return 'Строить можно только на траве';
    if (World.bmap[i] || World.door[i]) return 'Место занято';
    if (World.road[i] || Game.roadSites.has(i)) return 'Мешает дорога';
    if (World.obj[i]) return 'Мешают деревья, камни или поля';
  }
  const dx = x + def.dx, dy = y + def.dy;
  if (!inb(dx, dy)) return 'Вход за краем карты';
  const di = idx(dx, dy);
  const dt = World.terrain[di];
  if (dt !== T_GRASS && dt !== T_SAND) return 'Перед входом нужна свободная земля';
  if (World.bmap[di] || World.door[di]) return 'Вход загорожен';
  const dobj = World.obj[di];
  if (dobj && dobj.t !== 'stump') return 'Вход загорожен';

  if (def.need === 'stone') {
    if (!findObjNear(dx, dy, 10, o => o.t === 'stone')) return 'Рядом нет камня';
  }
  if (def.need === 'rock') {
    let ok = false;
    for (let xx = x; xx < x + def.w; xx++)
      if (inb(xx, y - 1) && World.terrain[idx(xx, y - 1)] === T_ROCK) ok = true;
    if (!ok) return 'Рудник ставят вплотную под скалой';
  }
  if (def.need === 'crystal') {
    let ok = false;
    for (let xx = x; xx < x + def.w; xx++)
      if (inb(xx, y - 1) && World.crystal[idx(xx, y - 1)]) ok = true;
    if (!ok) return 'Нужна скала с фиолетовыми кристаллами прямо над шахтой';
  }
  if (blocksPassage(def, x, y)) return 'Перекроет проход к другим зданиям';
  return null;
}

// Не отрежет ли новое здание чей-то вход от остальных (проверка заливкой).
function blocksPassage(def, x, y) {
  const hub = Game.buildings.find(b => b.isStore()) || Game.buildings[0];
  if (!hub) return false;
  const cells = [];
  for (let yy = y; yy < y + def.h; yy++) for (let xx = x; xx < x + def.w; xx++) {
    const i = idx(xx, yy);
    cells.push(i);
    World.bmap[i] = -1;
  }
  const st = floodFrom(hub.doorX, hub.doorY);
  let bad = !reachedIn(st, x + def.dx, y + def.dy);
  for (const b of Game.buildings) if (!bad && !reachedIn(st, b.doorX, b.doorY)) {
    // вход, который и раньше был недоступен, не считаем
    for (const i of cells) World.bmap[i] = 0;
    const st0 = floodFrom(hub.doorX, hub.doorY);
    const before = reachedIn(st0, b.doorX, b.doorY);
    for (const i of cells) World.bmap[i] = -1;
    if (before) bad = true;
  }
  for (const i of cells) World.bmap[i] = 0;
  return bad;
}

function placeBuilding(type, x, y, done = false, rot = 0) {
  const b = new Building(type, x, y, done, rot);
  for (let yy = y; yy < y + b.h; yy++) for (let xx = x; xx < x + b.w; xx++)
    World.bmap[idx(xx, yy)] = b.id;
  const di = idx(b.doorX, b.doorY);
  World.door[di] = 1;
  World.obj[di] = null;
  const rs = Game.roadSites.get(di);
  if (rs) removeRoadSite(rs);
  setRoad(b.doorX, b.doorY, true);
  Game.buildings.push(b);
  return b;
}

function freeUnit(u) {
  u.proc = null; u.action = null; u.anim = null; u.inside = null;
  if (u.carry) u.carry = null;
}

function removeBuilding(b) {
  if (b.removed) return;
  b.removed = true;
  for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++)
    World.bmap[idx(xx, yy)] = 0;
  World.door[idx(b.doorX, b.doorY)] = 0;
  Game.buildings = Game.buildings.filter(o => o !== b);
  for (const u of Game.units) {
    if (u.inside === b) { u.inside = null; u.x = b.doorX + 0.5; u.y = b.doorY + 0.5; }
    if (u.home === b) { u.home = null; freeUnit(u); u.x = b.doorX + 0.5; u.y = b.doorY + 0.5; }
    if (u.job === b) { u.job = null; freeUnit(u); }
  }
  if (b.type === 'farm') {
    for (let i = 0; i < N_TILES; i++) {
      const o = World.obj[i];
      if (o && o.t === 'field' && o.farm === b.id) World.obj[i] = null;
    }
  }
  if (Game.selected === b) Game.selected = null;
}

function finishBuilding(b) {
  b.state = 'done';
  b.stock = emptyGoods();
  b.builder = null;
  toast(`Построено: ${b.def.name}`, b);
}

function canPlaceRoad(x, y) {
  if (!inb(x, y)) return false;
  const i = idx(x, y), t = World.terrain[i];
  if (t !== T_GRASS && t !== T_SAND) return false;
  if (World.road[i] || World.bmap[i] || Game.roadSites.has(i)) return false;
  const o = World.obj[i];
  return !o || o.t === 'stump';
}

function placeRoadSite(x, y) {
  if (!canPlaceRoad(x, y)) return null;
  const s = new RoadSite(x, y);
  Game.roadSites.set(idx(x, y), s);
  return s;
}

function removeRoadSite(s) {
  s.removed = true;
  Game.roadSites.delete(idx(s.x, s.y));
  if (s.builder) { s.builder.job = null; freeUnit(s.builder); s.builder = null; }
}

function completeRoad(s) {
  removeRoadSite(s);
  World.obj[idx(s.x, s.y)] = null;
  setRoad(s.x, s.y, true);
}

// Ближайший склад; если указан товар — только тот, что его принимает.
function nearestStore(x, y, g, comp = 0) {
  if (g && Game.storeBlock[g]) return null;
  let best = null, bd = 1e9;
  for (const b of Game.buildings) {
    if (!b.isStore()) continue;
    if (comp && compAt(b.doorX, b.doorY) !== comp) continue;
    const d = Math.abs(b.doorX - x) + Math.abs(b.doorY - y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

function findInn(u) {
  let best = null, bd = 1e9;
  for (const b of Game.buildings) {
    if (b.type !== 'inn' || b.state !== 'done') continue;
    if (!innFood(b)) continue;
    const d = Math.abs(b.doorX - u.x) + Math.abs(b.doorY - u.y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

function innFood(b) {
  return FOODS.find(g => b.stock[g] - b.reserved[g] > 0) || null;
}

// ---------- Жители ----------

class Unit {
  constructor(type, x, y) {
    this.id = Game.nextId++;
    this.type = type;
    this.look = (Math.random() * 1000) | 0;   // внешность: кожа, волосы, борода
    this.x = x + 0.5; this.y = y + 0.5;
    this.food = 0.75 + Math.random() * 0.25;
    this.nextEatTry = 0;
    this.home = null;       // рабочее здание
    this.job = null;        // стройка (для строителя)
    this.proc = null;       // генератор поведения
    this.action = null;     // текущее элементарное действие
    this.lastRes = undefined;
    this.carry = null;
    this.inside = null;
    this.idleFlag = false;
    this.anim = null;
    this.walkPhase = Math.random() * 10;
    this.face = 1;
    this.vdir = 'S';        // вид: S — к нам, N — спиной, E — боком
    this.occT = -1;         // занятая клетка дороги
    this.resT = -1;         // забронированная следующая клетка
    this.blockT = -1;       // клетка, занятая на время перерыва
    this.carryN = 0;        // сколько единиц груза несёт
    // привычки и состояние
    this.smoker = Math.random() < 0.7;
    this.nextSmoke = Game.time + SMOKE_CD_MIN + Math.random() * (SMOKE_CD_MAX - SMOKE_CD_MIN);
    this.nextJoin = 0;
    this.brk = null;        // текущий перерыв: перекур, сон
    this.injury = null;     // 'leg' | 'arm'
    this.injuryUntil = 0;
    this.drunkAt = 0;
  }

  get noFood() { return !!UNIT_TYPES[this.type].animal || this.type === 'carter'; }

  wantsEat() { return !this.noFood && this.food < HUNGRY && Game.time >= this.nextEatTry; }

  think() {
    if (this.wantsEat()) {
      const inn = findInn(this);
      if (inn) { this.idleFlag = false; return eatGen(this, inn); }
      this.nextEatTry = Game.time + 15;
    }
    if (this.isCourier) { this.idleFlag = true; return idleGen(this); }
    if (this.type === 'builder') {
      if (this.job && !this.job.removed) { this.idleFlag = false; return buildGen(this, this.job); }
      this.job = null;
      this.idleFlag = true;
      return idleGen(this);
    }
    if (this.home && !this.home.removed) { this.idleFlag = false; return workerGen(this, this.home); }
    this.home = null;
    this.idleFlag = true;
    return idleGen(this);
  }

  get isCourier() { return this.type === 'serf' || this.type === 'goat' || this.type === 'carter'; }

  releaseOcc() {
    if (this.occT >= 0 && World.occ[this.occT] === this.id) World.occ[this.occT] = 0;
    if (this.resT >= 0 && World.occ[this.resT] === this.id) World.occ[this.resT] = 0;
    this.occT = -1; this.resT = -1;
  }

  update(dt) {
    if (!this.noFood) this.food = Math.max(0, this.food - dt / FOOD_TIME);
    lifeTick(this, dt);
    if (this.isCourier && !(this.action && this.action.walk)) this.releaseOcc();
    if (this.action) {
      const r = this.stepAction(dt);
      if (r === undefined) return;
      this.lastRes = r;
      this.action = null;
    }
    if (!this.proc) {
      this.proc = this.think();
      this.lastRes = undefined;
      if (!this.proc) return;
    }
    const n = this.proc.next(this.lastRes);
    this.lastRes = undefined;
    if (n.done) {
      if (this.brk) endBreak(this);   // перерыв кончился — продолжаем прерванное дело
      else this.proc = null;
      return;
    }
    this.action = n.value;
  }

  stepAction(dt) {
    const a = this.action;
    if (a.walk) {
      const courier = this.isCourier;
      const sx = Math.floor(this.x), sy = Math.floor(this.y);
      // выход из здания: пригибаемся в дверях
      if (this.inside && !a.ducked) {
        const b = this.inside;
        a.ducked = true; a.dk = 0.3; this.inside = null; this.anim = 'duck';
        this.vdir = b.rot ? 'E' : 'S'; this.face = 1;
      }
      if (a.dk > 0) { a.dk -= dt; if (a.dk > 0) return undefined; this.anim = null; }
      if (!a.path) {
        this.inside = null;
        // курьер на дороге ходит только по дорогам; сошедший с неё сначала возвращается
        const onRoad = courier && World.road[idx(sx, sy)] && !a.offroad;
        a.path = findPath(sx, sy, a.walk[0], a.walk[1], onRoad, courier ? this.id : 0);
        a.i = 0; a.block = 0; a.replanned = false; a.squeeze = false;
        if (!a.path) return false;
        if (courier) { this.releaseOcc(); this.occT = idx(sx, sy); if (!World.occ[this.occT]) World.occ[this.occT] = this.id; }
      }
      if (a.i >= a.path.length) { if (courier) this.releaseOcc(); return true; }
      const [px, py] = a.path[a.i];
      const ni = idx(px, py);
      if (courier && World.road[ni] && this.resT !== ni && !a.squeeze) {
        const o = World.occ[ni];
        if (o && o !== this.id) {
          a.block += dt;
          const other = Game.unitMap.get(o);
          const headOn = other && other.action && other.action.walk && other.resT === this.occT;
          if (a.block > 0.6 && !a.replanned) {
            a.replanned = true;
            const np = findPath(sx, sy, a.walk[0], a.walk[1], World.road[idx(sx, sy)] === 1 && !a.offroad, this.id);
            if (np && np.length && idx(np[0][0], np[0][1]) !== ni) { a.path = np; a.i = 0; a.block = 0; return undefined; }
          }
          // на узкой дороге встречные протискиваются, затор дольше 3 с — проходим насквозь
          if ((headOn && a.block > 0.4) || a.block > 3) a.squeeze = true;
          else { this.vdir = this.vdir || 'S'; return undefined; }
        } else {
          World.occ[ni] = this.id;
          this.resT = ni;
        }
      }
      const tx = px + 0.5, ty = py + 0.5;
      const dx = tx - this.x, dy = ty - this.y;
      const dist = Math.hypot(dx, dy);
      const onRoad = World.road[idx(sx, sy)];
      let speed = onRoad ? 2.6 : 1.6;
      if (this.type === 'carter') speed = onRoad ? 2.9 : 1.8;
      if (this.type === 'goat') speed = onRoad ? 2.5 : 2.0;
      if (a.squeeze) speed *= 0.4;
      if (this.food <= 0 && !this.noFood) speed *= 0.5;
      if (this.injury === 'leg') speed *= 0.55;
      const step = speed * dt;
      this.walkPhase += step * 6;
      if (Math.abs(dx) > 0.01) this.face = dx > 0 ? 1 : -1;
      this.vdir = Math.abs(dy) > Math.abs(dx) * 1.2 ? (dy > 0 ? 'S' : 'N') : 'E';
      if (step >= dist) {
        this.x = tx; this.y = ty; a.i++;
        if (courier) {
          if (this.occT >= 0 && World.occ[this.occT] === this.id) World.occ[this.occT] = 0;
          this.occT = ni; this.resT = -1;
          if (!World.occ[ni]) World.occ[ni] = this.id;
          a.squeeze = false; a.block = 0; a.replanned = false;
        }
        if (a.i >= a.path.length) { if (courier) this.releaseOcc(); return true; }
      } else {
        this.x += dx / dist * step; this.y += dy / dist * step;
      }
      return undefined;
    }
    if (a.wait !== undefined) {
      if (a.t === undefined) {
        a.t = a.wait * (this.food <= 0 && !this.noFood ? 1.6 : 1) * (this.injury === 'arm' && a.anim ? 1.5 : 1);
        this.anim = a.anim || null;
      }
      a.t -= dt;
      if (a.t <= 0) { this.anim = null; return true; }
      return undefined;
    }
    if (a.enter) {
      // вход: короткое пригибание лицом к двери
      if (a.dt === undefined) {
        a.dt = 0.35; this.anim = 'duck';
        if (a.enter.rot) { this.vdir = 'E'; this.face = -1; } else this.vdir = 'N';
      }
      a.dt -= dt;
      if (a.dt > 0) return undefined;
      this.anim = null;
      this.inside = a.enter;
      this.x = a.enter.doorX + 0.5; this.y = a.enter.doorY + 0.5;
      return true;
    }
    if (a.leave) { this.inside = null; return true; }
    return true;
  }
}

function spawnUnit(type, x, y) {
  const u = new Unit(type, x, y);
  Game.units.push(u);
  Game.unitMap.set(u.id, u);
  return u;
}
