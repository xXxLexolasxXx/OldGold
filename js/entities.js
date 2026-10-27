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
  if (!b.def.burn) for (const g in r.out) if (b.stock[g] + r.out[g] > b.def.outputs[g]) return false;
  return true;
}

// Еды вдоволь: пекарня и бойня не начинают новую партию, если этой еды на складах и в трактирах уже ~12 обедов на жителя
// (с запасом на зиму). Иначе склад копил по 1000+ хлеба, а курьеры весь день вывозили его из цехов — и стройки
// неделями ждали камень на последнюю клетку дороги (замер tools/soak/deficit.js, ДЕФИЦИТЫ.md). Зерно тем временем копится на складе.
const FOOD_ENOUGH_PER = 12, FOOD_ENOUGH_MIN = 80;
let foodEnoughT = -1, foodEnoughC = null;
function foodStocked() {
  if (foodEnoughC && Math.abs(Game.time - foodEnoughT) < 2) return foodEnoughC;
  const c = {};
  for (const x of Game.buildings) if (x.state === 'done' && !x.removed && (x.type === 'inn' || x.isStore())) for (const g of FOODS) c[g] = (c[g] || 0) + (x.stock[g] || 0);
  let ppl = 0; for (const u of Game.units) if (!u.dead && !u.noFood && isPerson(u)) ppl++;
  c.cap = Math.max(FOOD_ENOUGH_MIN, ppl * FOOD_ENOUGH_PER);
  foodEnoughT = Game.time; foodEnoughC = c;
  return c;
}
function foodEnough(b) {
  const rs = b.def.recipes;
  if (!rs || b.def.auto) return false;
  const outs = new Set();
  for (const r of rs) for (const g in r.out) if (FOODS.includes(g)) outs.add(g);
  if (!outs.size) return false;
  const c = foodStocked();
  for (const g of outs) if ((c[g] || 0) < c.cap) return false;
  return true;
}

// Следующий включённый рецепт, который можно выполнить (по кругу).
function pickRecipe(b) {
  const rs = b.def.recipes;
  if (!rs) return null;
  if (foodEnough(b)) return null;
  for (let k = 0; k < rs.length; k++) {
    const i = (b.recipeIdx + k) % rs.length;
    if (b.recipeOn[i] && recipeCanRun(b, rs[i])) { b.recipeIdx = (i + 1) % rs.length; return rs[i]; }
  }
  return null;
}

function recipeConsume(b, r) { for (const g in r.in) b.stock[g] -= r.in[g]; }

function recipeProduce(b, r) {
  for (const g in r.out) { b.stock[g] += r.out[g]; Game.produced[g] += r.out[g]; if (b.def.burn && b.stock[g] > b.def.outputs[g]) b.stock[g] = b.def.outputs[g]; }   // костёр: лишний пепел развеивается ветром
}

class Building {
  constructor(type, x, y, done, rot = 0) {
    this.id = Game.nextId++;
    this.type = type;
    this.def = BUILDINGS[type];
    this.x = x; this.y = y;
    const d = bDims(type, rot);
    this.rot = d.rot;              // 0 — вход на юг, 1 — на восток, 2 — на запад
    this.w = d.w; this.h = d.h;
    this.doorX = x + d.dx;
    this.doorY = y + d.dy;
    // широкие ворота (склад): второй проход рядом, чтобы курьеры заходили по двое
    this.door2 = this.def.wideDoor ? wideDoorTile(type, x, y, d.rot) : null;
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
    if (this.selfBuild) return null;
    if (this.state !== 'done') return this.roadLinked() ? null : 'noroad';
    if (this.paused || prioOff(this)) return 'paused';
    if (this.dmg >= 0.5) return 'damaged';                 // повреждено нечистью — пока не починят, не работает
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
    if (rs && rs.length && foodEnough(this)) return 'enough';
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
    if (g === 'trunk' && this.isStore() && typeof seaWoodHold === 'function') return Math.max(0, this.stock[g] - this.reserved[g] - seaWoodHold());   // зимний запас дров не уходит на лесопилку и стройку (season.js)
    if (this.isStore() || (this.def.outputs && this.def.outputs[g] != null))
      return this.stock[g] - this.reserved[g];
    return 0;
  }

  demand(g) {
    if (this.state !== 'done') {
      const need = (this.def.cost[g] || 0) - this.usedOf[g] - this.stock[g] - this.incoming[g];
      return Math.max(0, need);
    }
    // достройка: везут материалы; школа при этом учит дальше — золото ей нужно и во время достройки
    if (this.upg && !(this.type === 'school' && !this.upg.cost[g])) return Math.max(0, (this.upg.cost[g] || 0) - this.upg.used[g] - this.upg.stock[g] - this.incoming[g]);
    if (this.noDeliver || this.isStore() || !this.def.inputs) return 0;   // закрыто для доставок
    if (g === 'trunk' && this.type === 'sawmill' && typeof seaWoodLow === 'function' && seaWoodLow()) return 0;   // дров на зиму мало — брёвна копим для печей, а не пилим (season.js)
    const cap = this.def.inputs[g];
    if (!cap || !this.wantsInput(g)) return 0;
    return Math.max(0, cap - this.stock[g] - this.incoming[g]);
  }

  update(dt) {
    if (this.state !== 'done') return;
    if (this.upg && this.type !== 'school') { this.working = false; return; }          // идёт достройка — производство стоит (школа учит: иначе застрявшая достройка запирала всю деревню без новых жителей)
    if (this.def.auto) {
      if (!this.autoJob && !this.paused && !prioOff(this)) {
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
      if (!this.training && this.queue.length) schoolGoldFirst(this);
      if (!this.training && this.queue.length && this.stock.gold < 1 && this.incoming.gold <= 0) schoolStuck(this, dt);
      else { this.goldWait = 0; if (this.stock.gold >= 1) this.goldHint = false; }
      if (!this.training && this.queue.length && this.stock.gold >= 1) {
        this.stock.gold--;
        this.training = { type: this.queue.shift(), t: 0 };
      }
      if (this.training) {
        this.training.t += dt;
        if (this.training.t >= TRAIN_TIME * (this.def.trainMult || 1)) {
          const nu = spawnUnit(this.training.type, this.doorX, this.doorY);
          if (typeof hireOnGraduate === 'function') hireOnGraduate(nu);   // выпускник, которого ждёт здание, — сразу туда (hire.js)
          logEvent('people', `Школа выпустила: ${UNIT_TYPES[this.training.type].name}`, this.doorX + 0.5, this.doorY);
          this.training = null;
        }
      }
    }
    this.anim += dt * (this.working ? 3 : 0.25);
  }
}

// Защита от «мёртвой хватки» школы: очередь есть, золото не идёт.
// Нет ни одного перевозчика — слиток со склада той же дороги берёт сам учитель (иначе некому привезти,
// а научить перевозчика нечем). Золота нет вообще и перевозчиков нет — трудягу учат в долг,
// чтобы деревня могла хотя бы возить. И одна понятная подсказка вместо молчаливого «Ждём золото».
// Кого не хватает золотой цепочке: рудник или плавильня без работника, и такого гнома нет ни свободным, ни в учёбе.
// Без шахтёра и металлурга золото не появится, а без золота их не выучить: деревня, у которой ночью утащили шахтёра,
// теряла школу навсегда (замер tools/soak/deficit.js — сиды 1, 2, 4 вымирали к 96-м суткам, ДЕФИЦИТЫ.md).
function goldChainNeed() {
  for (const t of ['goldmine', 'metallurgist']) {
    const w = BUILDINGS[t].worker;
    if (!Game.buildings.some(b => b.type === t && b.state === 'done' && !b.removed && !(b.worker && !b.worker.dead && b.worker.home === b))) continue;
    if (Game.units.some(u => u.type === w && !u.dead && !u.home)) continue;
    if (Game.buildings.some(s => s.type === 'school' && s.training && s.training.type === w)) continue;
    return w;
  }
  return null;
}
// шахтёр и металлург для пустых рудника и плавильни — первыми в очереди: последний слиток не уходит на трудягу
function schoolGoldFirst(b) {
  const w = goldChainNeed();
  if (!w) return;
  const i = b.queue.indexOf(w);
  if (i > 0) { b.queue.splice(i, 1); b.queue.unshift(w); }
}
function schoolStuck(b, dt) {
  b.goldWait = (b.goldWait || 0) + dt;
  if (b.goldWait < 8) return;
  // золота нет нигде, а рудник или плавильня пустует — шахтёра / металлурга учат в долг, первым в очереди
  const gw = goldAnywhere() <= 0 && goldChainNeed();
  if (gw) {
    const i = b.queue.indexOf(gw);
    if (i < 0) b.queue.unshift(gw); else if (i > 0) { b.queue.splice(i, 1); b.queue.unshift(gw); }
    b.stock.gold++; b.goldWait = 0;
    toast(gw === 'miner' ? 'Школа выучит шахтёра в долг: без него золота не будет' : 'Школа выучит металлурга в долг: без него золота не будет', b);
    return;
  }
  const carriers = Game.units.some(u => u.isCourier && !u.dead && !u.teamOf);
  if (!carriers) {
    const st = storeHaving(b.doorX, b.doorY, 'gold', compAt(b.doorX, b.doorY));
    if (st) { st.stock.gold--; b.stock.gold++; b.goldWait = 0; return; }
    if (goldAnywhere() <= 0) {
      const i = b.queue.indexOf('serf');
      if (i < 0) b.queue.unshift('serf'); else if (i > 0) { b.queue.splice(i, 1); b.queue.unshift('serf'); }
      b.stock.gold++; b.goldWait = 0;
      toast('Школа выучит трудягу в долг: золота нет, а возить некому');
      return;
    }
  }
  if (b.goldWait > 25 && !b.goldHint && goldAnywhere() <= 0) {
    b.goldHint = true;
    toast('Школа стоит: золота нет нигде. Нужен золотой рудник у скалы и плавильня — или очистите очередь в школе', b);
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
    this.dug = 0;      // 0..1 — выкопано (бесплатно)
    this.pave = 0;     // 0..1 — уложено камня
    this.lastHit = -9;
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
    this.ageAt = {};       // когда лёг «неходовой» груз (мусор, куски курицы): склад его не берёт, такие кучки со временем убираются
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
  if (GOODS[g].noStore && !p.ageAt[g]) p.ageAt[g] = Game.time;
  return p;
}

function cleanupPile(p) {
  for (const g of GOOD_KEYS) if (p.stock[g] > 0 || p.reserved[g] > 0) return;
  p.removed = true;
  Game.piles.delete(idx(p.x, p.y));
}

// ---------- Размещение и удаление ----------

function wideDoorTile(type, x, y, rot) {
  const d = bDims(type, rot);
  return d.rot && d.rot !== 3 ? [x + d.dx, y + d.dy - 1] : [x + d.dx - 1, y + d.dy];
}

// Здание по клетке входа (основной или второй створки ворот)
function buildingAtDoor(x, y) {
  return Game.buildings.find(b => (b.doorX === x && b.doorY === y) || (b.door2 && b.door2[0] === x && b.door2[1] === y)) || null;
}

function setRoad(x, y, v) {
  World.road[idx(x, y)] = v ? 1 : 0;
  World.roadDirty = true;
  if (typeof redrawTilesAround === 'function') redrawTilesAround(x, y);
}

// Возвращает null, если можно строить, иначе текст причины.
// Где можно поставить рудник или шахту кристаллов: все места на карте (левый верхний угол), без
// дорогой проверки «не перекроет ли проход». Кэш на 2 секунды игры — для подсветки и подсказки.
const MINE_SPOTS = { type: null, t: -99, list: [] };
function mineSpots(type) {
  const need = BUILDINGS[type] && BUILDINGS[type].need;
  if (need !== 'rock' && need !== 'crystal') return [];
  if (MINE_SPOTS.type === type && Game.time - MINE_SPOTS.t < 2 && Game.time >= MINE_SPOTS.t) return MINE_SPOTS.list;
  const list = [], d = bDims(type, 0);
  for (let y = 1; y < MAP_H - d.h; y++) for (let x = 0; x <= MAP_W - d.w; x++) {
    let edge = false;   // быстрый отсев: над крышей должна быть скала (или кристалл)
    for (let xx = x; xx < x + d.w && !edge; xx++) { const i = idx(xx, y - 1); edge = need === 'crystal' ? !!World.crystal[i] : World.terrain[i] === T_ROCK; }
    if (edge && !checkPlacement(type, x, y, 0, true)) list.push([x, y]);
  }
  MINE_SPOTS.type = type; MINE_SPOTS.t = Game.time; MINE_SPOTS.list = list;
  return list;
}
// «Нет скалы здесь — ближайшее место там»: текст с расстоянием и сторонами света
function mineSpotHint(type, x, y) {
  let best = null, bd = 1e9;
  for (const s of mineSpots(type)) { const d = Math.hypot(s[0] - x, s[1] - y); if (d < bd) { bd = d; best = s; } }
  if (!best) return ' Подходящих мест на карте не осталось.';
  const dx = best[0] - x, dy = best[1] - y;
  const dir = (dy < -2 ? 'север' : dy > 2 ? 'юг' : '') + (Math.abs(dx) > 2 ? (dy < -2 || dy > 2 ? 'о-' : '') + (dx > 0 ? 'восток' : 'запад') : '');
  return bd < 1.5 ? '' : ` Ближайшее место — в ${Math.round(bd)} кл.${dir ? ' на ' + dir : ''}; подходящие места подсвечены.`;
}

function checkPlacement(type, x, y, rot = 0, quick = false) {
  const def0 = BUILDINGS[type];
  const dd = bDims(type, rot);
  const def = { ...def0, w: dd.w, h: dd.h, dx: dd.dx, dy: dd.dy };
  let treeBlock = false;   // деревья — самая «мягкая» помеха: вода, песок и чужие стены важнее, их проверяем по всем клеткам раньше
  for (let yy = y; yy < y + def.h; yy++) for (let xx = x; xx < x + def.w; xx++) {
    if (!inb(xx, yy)) return 'За краем карты';
    const i = idx(xx, yy);
    if (World.terrain[i] !== T_GRASS) return 'Строить можно только на траве';
    if (World.bmap[i] || World.door[i]) return 'Место занято';
    if (World.road[i] || Game.roadSites.has(i)) return 'Мешает дорога';
    if (World.obj[i] && !isStreetObj(World.obj[i])) treeBlock = true;
  }
  const dx = x + def.dx, dy = y + def.dy;
  if (!inb(dx, dy)) return 'Вход за краем карты';
  const di = idx(dx, dy);
  const dt = World.terrain[di];
  if (dt !== T_GRASS && dt !== T_SAND) return 'Перед входом нужна свободная земля';
  if (World.bmap[di] || World.door[di]) return 'Вход загорожен';
  const dobj = World.obj[di];
  if (dobj && dobj.t !== 'stump' && !isStreetObj(dobj)) return 'Вход загорожен';
  if (def0.wideDoor) {
    const [ex, ey] = wideDoorTile(type, x, y, dd.rot);
    if (!inb(ex, ey)) return 'Ворота за краем карты';
    const ei = idx(ex, ey), et = World.terrain[ei];
    if ((et !== T_GRASS && et !== T_SAND) || World.bmap[ei] || World.door[ei] || (World.obj[ei] && World.obj[ei].t !== 'stump')) return 'Перед воротами нужна свободная земля';
  }

  if (def.need === 'stone') {
    if (!findObjNear(dx, dy, 10, o => o.t === 'stone') && !rockFaceNear(dx, dy, 10)) return 'Рядом нет камня или скалы';
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
  if (treeBlock) return 'Мешают деревья, камни или поля';
  if (!quick && blocksPassage(def, x, y)) return 'Перекроет проход к другим зданиям';
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
  for (let yy = y; yy < y + b.h; yy++) for (let xx = x; xx < x + b.w; xx++) {
    const i = idx(xx, yy);
    World.bmap[i] = b.id;
    if (isStreetObj(World.obj[i])) World.obj[i] = null;   // уличное убранство уступает место дому
  }
  // кучка груза под фундаментом переезжает на соседнюю клетку: иначе диспетчер без конца шлёт к ней
  // курьеров, которым туда не дойти, а сам груз лежит под домом до загрузки сохранения
  for (let yy = y; yy < y + b.h; yy++) for (let xx = x; xx < x + b.w; xx++) {
    const p = Game.piles.get(idx(xx, yy));
    if (!p || p.removed) continue;
    p.removed = true; Game.piles.delete(idx(xx, yy));
    for (const g of GOOD_KEYS) if (p.stock[g] > 0) dropPile(xx, yy, g, p.stock[g]);
  }
  const di = idx(b.doorX, b.doorY);
  World.door[di] = 1;
  World.obj[di] = null;
  const rs = Game.roadSites.get(di);
  if (rs) removeRoadSite(rs);
  setRoad(b.doorX, b.doorY, true);
  if (b.door2) {
    const ei = idx(b.door2[0], b.door2[1]);
    World.door[ei] = 1; World.obj[ei] = null;
    const rs2 = Game.roadSites.get(ei);
    if (rs2) removeRoadSite(rs2);
    setRoad(b.door2[0], b.door2[1], true);
    // перед обеими створками — по клетке дороги, чтобы заходили с двух клеток сразу
    const fx1 = b.rot === 2 ? -1 : 1;
    const front = b.rot === 3 ? [[b.doorX, b.doorY - 1], [b.door2[0], b.door2[1] - 1]] : b.rot ? [[b.doorX + fx1, b.doorY], [b.door2[0] + fx1, b.door2[1]]] : [[b.doorX, b.doorY + 1], [b.door2[0], b.door2[1] + 1]];
    for (const [fx, fy] of front) {
      if (!canPlaceRoad(fx, fy)) continue;
      if (done) { World.obj[idx(fx, fy)] = null; setRoad(fx, fy, true); }
      else placeRoadSite(fx, fy);
    }
  }
  Game.buildings.push(b);
  PF.regT = -1e9;              // карта проходимости изменилась — пересчитать области
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
  if (b.door2) World.door[idx(b.door2[0], b.door2[1])] = 0;
  Game.buildings = Game.buildings.filter(o => o !== b);
  PF.regT = -1e9;
  for (const u of Game.units) {
    if (u.inside === b) { u.inside = null; u.x = b.doorX + 0.5; u.y = b.doorY + 0.5; }
    if (u.home === b) { u.home = null; freeUnit(u); u.x = b.doorX + 0.5; u.y = b.doorY + 0.5; }
    if (u.job === b) { u.job = null; freeUnit(u); }
  }
  if (b.type === 'farm') {
    for (let i = 0; i < N_TILES; i++) {
      const o = World.obj[i];
      if (o && o.t === 'field' && o.farm === b.id) o.farm = 0;   // поля остаются, пока их не снесёт игрок
    }
  }
  if (Game.selected === b) Game.selected = null;
}

function finishBuilding(b) {
  b.state = 'done';
  b.stock = emptyGoods();
  b.builder = null;
  logEvent('build', `Построено: ${b.def.name}`, b.doorX + 0.5, b.doorY);
  toast(`Построено: ${b.def.name}`, b);
  statsBuilt();
  // каждое третье достроенное здание — вся деревня аплодирует
  Game.builtN = (Game.builtN || 0) + 1;
  if (Game.builtN % 3 === 0) applaud(`Деревня аплодирует: построено уже ${Game.builtN}!`);
}

function canPlaceRoad(x, y) {
  if (!inb(x, y)) return false;
  const i = idx(x, y), t = World.terrain[i];
  if (t !== T_GRASS && t !== T_SAND) return false;
  if (World.road[i] || World.bmap[i] || Game.roadSites.has(i)) return false;
  const o = World.obj[i];
  return !o || o.t === 'stump' || isStreetObj(o);   // скамейку или фонарь дорога просто сдвинет
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
  decorateRoad(s.x, s.y);      // фонарь, скамейка или урна вдоль новой дороги
}

// Ближайший склад; если указан товар — только тот, что его принимает.
function nearestStore(x, y, g, comp = 0) {
  if (g && (Game.storeBlock[g] || GOODS[g].noStore)) return null;   // мусор на склад не берут — только в костёр
  let best = null, bd = 1e9;
  for (const b of Game.buildings) {
    if (!b.isStore() || b.noDeliver) continue;
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
  if (best) return best;
  // в трактире пусто — перекусить всухомятку на складе (не досыта, зато не упадёт); нет и хлеба — каша из зерна
  for (const b of Game.buildings) {
    if (!b.isStore() || b.isPile || b.state !== 'done' || !storeMeal(b)) continue;
    const d = Math.abs(b.doorX - u.x) + Math.abs(b.doorY - u.y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

// Склад кормит всухомятку: готовой едой, а если её нет — кашей из зерна. Раньше в первые сутки, пока нет мельницы
// и пекарни, деревня падала от голода при полном амбаре зерна (и ослабевших ночью утаскивала нечисть).
// Зерно в кашу — втрое хуже, чем через мельницу и пекарню (1 зерно → 3 хлеба), так что цепочка хлеба по-прежнему нужна.
function storeMeal(b) { return innFood(b) || (b.stock.wheat - b.reserved.wheat > 0 ? 'wheat' : null); }
function innFood(b) {
  // трактирщик разделывает тушку курицы на 4 куска, когда кончились готовые
  if (b.type === 'inn' && b.stock.chickenleg - b.reserved.chickenleg <= 0 && b.stock.chicken > 0) { b.stock.chicken--; b.stock.chickenleg += 4; }
  return FOODS.find(g => b.stock[g] - b.reserved[g] > 0) || null;
}

// ---------- Жители ----------

// Прокачка трудяг и работяг. Уровень считается по выслуге (xp): трудяге капает за каждую
// доставку, работяге — за стройку (здание 3, дорога 1). Уровень 2 и 3: трудяга носит
// 2 и 3 предмета за раз, работяга сам берёт со склада 1 и 2 материала на стройку.
const LEVEL_XP = { serf: [0, 12, 40], builder: [0, 9, 30] };
function unitLevel(u) {
  const t = LEVEL_XP[u.type];
  if (!t) return 1;
  const xp = u.xp || 0;
  return xp >= t[2] ? 3 : xp >= t[1] ? 2 : 1;
}
// Доля пути до следующего уровня (0..1); на 3-м уровне всегда 1
function levelProgress(u) {
  const t = LEVEL_XP[u.type];
  if (!t) return 1;
  const L = unitLevel(u), xp = u.xp || 0;
  if (L >= 3) return 1;
  return Math.min(1, (xp - t[L - 1]) / (t[L] - t[L - 1]));
}
const LEVEL_UP_TEXT = {
  serf: ['', 'дорос до 2-го уровня: теперь таскает по две штуки и жалуется вдвое громче', 'дорос до 3-го уровня: три предмета за раз и взгляд человека, который видел всё'],
  builder: ['', 'дорос до 2-го уровня: сам прихватывает со склада материал, чтобы не ждать трудяг', 'дорос до 3-го уровня: тащит на стройку по два материала, строит и поучает'],
};
// Начислить выслугу и сообщить, если дорос до нового уровня
function gainXp(u, n) {
  if (!LEVEL_XP[u.type]) return;
  const before = unitLevel(u);
  u.xp = (u.xp || 0) + n;
  const after = unitLevel(u);
  if (after > before) {
    const msg = `${UNIT_TYPES[u.type].name} ${LEVEL_UP_TEXT[u.type][after - 1]}`;
    logEvent('people', msg, u.x, u.y);
    // мягкий старт: в первые двое суток всплывашка — только про первое повышение каждого звания, остальные в журнале
    const key = u.type + after, seen = Game.lvToast || (Game.lvToast = {});
    if (typeof toast === 'function' && (!seen[key] || startOpen('lvToast'))) toast(msg);
    seen[key] = 1;
  }
}

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
    this.xp = 0;            // выслуга: трудяги — доставки, работяги — стройки (см. unitLevel)
    // привычки и состояние
    this.smoker = Math.random() < 0.7;
    this.nextSmoke = Game.time + SMOKE_CD_MIN + Math.random() * (SMOKE_CD_MAX - SMOKE_CD_MIN);
    this.nextJoin = 0;
    this.brk = null;        // текущий перерыв: перекур, сон
    this.injury = null;     // 'leg' | 'arm' | 'both' (рука и нога сразу — после куриной мести)
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
    if (this.type === 'hero') return heroThink(this);                              // герой: свои команды (hero.js)
    if (this.teamOf) { const g = teamThink(this); if (g) return g; }               // напарник героя
    if (this.isCourier) { this.idleFlag = true; return idleGen(this); }
    if (this.repairJob) { this.idleFlag = false; return repairGen(this, this.repairJob); }   // чинит любой свободный гном
    if (this.type === 'builder') {
      if (this.fieldJob >= 0) { this.idleFlag = false; return fieldDigGen(this, this.fieldJob); }
      if (this.helpField >= 0) { this.idleFlag = false; return helpHarvestGen(this, this.helpField); }
      if (this.repairJob) { this.idleFlag = false; return repairGen(this, this.repairJob); }
      if (this.job && !this.job.removed) { this.idleFlag = false; return this.job.upg ? upgradeGen(this, this.job) : buildGen(this, this.job); }
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
    if (this.dead) return;
    if (!this.noFood) this.food = Math.max(0, this.food - dt / (FOOD_TIME * dif().food));
    lifeTick(this, dt);
    if (this.isCourier && !(this.action && this.action.walk)) this.releaseOcc();
    if (this.action) {
      const r = this.stepAction(this.mdMul ? dt * this.mdMul : dt);   // настроение (mood.js): бодрый делает и ходит быстрее, хмурый медленнее
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
    if (a.walk && this.pauseUntil > Game.time) return undefined;   // замер (дал пять, чокается)
    if (a.walk) {
      const courier = this.isCourier;
      const sx = Math.floor(this.x), sy = Math.floor(this.y);
      // выход из здания: пригибаемся в дверях
      if (this.inside && !a.ducked) {
        const b = this.inside;
        a.ducked = true; a.dk = 0.3; this.inside = null; this.anim = 'duck';
        this.vdir = b.rot === 3 ? 'N' : b.rot ? 'E' : 'S'; this.face = b.rot === 2 ? -1 : 1;
      }
      if (a.dk > 0) { a.dk -= dt; if (a.dk > 0) return undefined; this.anim = null; }
      if (!a.path) {
        this.inside = null;
        // курьер на дороге ходит только по дорогам; сошедший с неё сначала возвращается
        const onRoad = courier && World.road[idx(sx, sy)] && !a.offroad;
        // к широким воротам — в свободную или менее загруженную створку
        if (!a.gate) {
          a.gate = true;
          // выходящий из склада идёт «на свою клетку» — створку не переназначаем, иначе он выходил через другие ворота
          const gb = a.walk[0] === sx && a.walk[1] === sy ? null : buildingAtDoor(a.walk[0], a.walk[1]);
          if (gb && gb.door2) a.walk = pickGate(gb, this.id);
        }
        a.path = findPath(sx, sy, a.walk[0], a.walk[1], onRoad, courier ? this.id : 0);
        a.i = 0; a.block = 0; a.replanned = false; a.squeeze = false;
        if (!a.path) return false;
        if (courier) { this.releaseOcc(); this.occT = idx(sx, sy); if (!World.occ[this.occT]) World.occ[this.occT] = this.id; }
      }
      if (a.i >= a.path.length) { if (courier) this.releaseOcc(); return true; }
      const [px, py] = a.path[a.i];
      const ni = idx(px, py);
      if (courier && World.road[ni] && this.resT !== ni && !a.squeeze && !(World.obj[ni] && World.obj[ni].t === 'hop')) {   // на классиках проходят сквозь друг друга
        const o = World.occ[ni];
        if (o && o !== this.id) {
          a.block += dt;
          const other = Game.unitMap.get(o);
          // встречный: забронировал нашу клетку или сам стоит перед ней (застрявший брони не ставит —
          // раньше такие пары упирались лбами по 3 с, и почти половину пути курьеры простаивали)
          const oa = other && other.action, onext = oa && oa.walk && oa.path && oa.path[oa.i];
          const headOn = !!(oa && oa.walk && (other.resT === this.occT || (onext && idx(onext[0], onext[1]) === this.occT)));
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
      let speed = onRoad ? 2.2 : 1.35;      // гномы коротконогие — ходят неспешно
      if (this.type === 'carter') speed = onRoad ? 2.5 : 1.55;
      if (this.type === 'goat') speed = onRoad ? 2.15 : 1.7;
      if (a.squeeze) speed *= 0.4;
      if (this.food <= 0 && !this.noFood) speed *= 0.5;
      if (injLeg(this.injury)) speed *= 0.55;
      if (this.hangUntil > Game.time) speed *= 0.75;     // похмелье после праздника
      if (this.pzUntil > Game.time || this.fgUntil > Game.time) speed *= 0.65;     // яд жаболюдов и их болотный туман (frogs.js)
      if (this.fleeUntil > Game.time) speed *= 1.7;     // удирает от гусей
      speed *= daySpeedMul();                            // днём бодрее, ночью медленнее
      if (WX.k > 0 && !this.isCourier) speed *= 1 + 0.3 * WX.k;   // под дождём спешат
      if (this.boostUntil > Game.time) speed *= 1.15;     // после «дай пять» — бодрее на пару секунд
      if (this.huntUntil > Game.time) speed *= 1.6;        // погоня за вором
      if (this.brk && this.brk.kind === 'lost') speed *= 0.6;   // бредёт наугад в тумане
      if (this.panicUntil > Game.time) speed *= 2;      // удирает от ходячего дерева
      if (this.type === 'hero' || this.teamOf) speed *= teamSpeedMul(this);   // герой и напарник — одинаково быстрые
      const step = speed * dt;
      this.walkPhase += step * 6;
      if (Math.abs(dx) > 0.01) this.face = dx > 0 ? 1 : -1;
      this.vdir = Math.abs(dy) > Math.abs(dx) * 1.2 ? (dy > 0 ? 'S' : 'N') : 'E';
      if (step >= dist) {
        this.x = tx; this.y = ty; a.i++;
        // ушёл с клетки, где начался перерыв (бежит от гуся, прячется от дождя), — она больше не занята
        if (this.blockT >= 0 && this.blockT !== ni) { if (World.occ[this.blockT] === this.id) World.occ[this.blockT] = 0; this.blockT = -1; }
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
        a.t = a.wait * (this.food <= 0 && !this.noFood ? 1.6 : 1) * (injArm(this.injury) && a.anim ? 1.5 : 1);
        if (a.anim && (this.type === 'hero' || this.teamOf)) a.t /= teamWorkMul(this);
        a.T = a.t;                              // полная длительность — для фаз замаха и удара
        this.anim = a.anim || null;
        // звук инструмента — в момент удара, а не замаха
        if (a.anim && ANIM_TOOL[a.anim]) { const n = Math.max(1, Math.round(a.t / 0.9)); for (let k = 0; k < n; k++) sfxUnit(this, a.anim, (k + 0.55) * a.t / n); }
        else if (a.anim) sfxUnit(this, a.anim);
      }
      a.t -= dt;
      if (a.t <= 0) { this.anim = null; return true; }
      return undefined;
    }
    if (a.enter) {
      // вход: короткое пригибание лицом к двери
      if (a.dt === undefined) {
        a.dt = 0.35; this.anim = 'duck';
        if (a.enter.rot === 3) this.vdir = 'S'; else if (a.enter.rot) { this.vdir = 'E'; this.face = a.enter.rot === 2 ? 1 : -1; } else this.vdir = 'N';
      }
      a.dt -= dt;
      if (a.dt > 0) return undefined;
      this.anim = null;
      this.inside = a.enter;
      if (this.isCourier) this.releaseOcc();   // внутри здания клетку у входа не держим
      if (this.blockT >= 0) { if (World.occ[this.blockT] === this.id) World.occ[this.blockT] = 0; this.blockT = -1; }
      // вошедший через вторую створку и выйдет через неё
      const d2 = a.enter.door2, viaGate2 = d2 && Math.floor(this.x) === d2[0] && Math.floor(this.y) === d2[1];
      this.x = (viaGate2 ? d2[0] : a.enter.doorX) + 0.5; this.y = (viaGate2 ? d2[1] : a.enter.doorY) + 0.5;
      return true;
    }
    if (a.leave) { this.inside = null; return true; }
    return true;
  }
}

// Выбор створки: сколько курьеров уже идёт к каждой и занята ли она прямо сейчас
function pickGate(b, selfId) {
  const gates = [[b.doorX, b.doorY], b.door2];
  let best = gates[0], bs = 1e9;
  for (const g of gates) {
    const i = idx(g[0], g[1]);
    let s = World.occ[i] && World.occ[i] !== selfId ? 2 : 0;
    for (const u of Game.units) {
      const w = u.action && u.action.walk;
      if (u.id !== selfId && w && w[0] === g[0] && w[1] === g[1]) s++;
    }
    s += Math.random() * 0.5;
    if (s < bs) { bs = s; best = g; }
  }
  return best.slice();
}

function spawnUnit(type, x, y) {
  const u = new Unit(type, x, y);
  Game.units.push(u);
  Game.unitMap.set(u.id, u);
  return u;
}
