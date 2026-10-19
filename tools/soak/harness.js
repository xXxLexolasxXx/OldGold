// Выполняется ВНУТРИ vm-контекста игры (см. run.js). Определяет глобальный объект H.
var H = {
  seed: 0, rng: null, issues: new Map(), resSeen: new Map(), occSeen: new Map(), still: new Map(),
  workerBad: new Map(), stats: { placed: 0, roads: 0, removed: 0, upg: 0, trained: 0, fields: 0 }, maxUnits: 0,
};
H.report = function (key, text, sev) {
  const k = key;
  let r = H.issues.get(k);
  if (!r) { r = { key: k, sev: sev || 'warn', n: 0, first: Game.time, text }; H.issues.set(k, r); }
  r.n++; r.last = Game.time; r.text = text;
};
H.rnd = (n) => Math.floor(H.rng() * n);
H.pick = (a) => a.length ? a[H.rnd(a.length)] : null;

H.init = function (seed) {
  H.seed = seed;
  H.rng = mulberry32(seed ^ 0xabcdef);
  Math.random = mulberry32(seed ^ 0x1234567);   // детерминированный прогон
  setupStart(seed);
  unlockAll();
  for (const b of Game.buildings) b.hold = false;
  Game.stress = false;
};

// ---------- «Игрок»: строит, учит, сносит, улучшает, командует героем ----------
const AI_TYPES = ['woodcutter', 'quarry', 'sawmill', 'farm', 'mill', 'bakery', 'swine', 'butchery', 'hopfarm', 'brewery', 'goatpen', 'stable',
  'tannery', 'armory', 'goldmine', 'metallurgist', 'storehouse', 'inn', 'crystalmine', 'magiccircle', 'magicworkshop', 'ironmine', 'smeltery', 'weaponsmith',
  'guild_warrior', 'guild_archer', 'guild_rogue', 'guild_mage', 'woodcutter', 'quarry', 'farm', 'sawmill', 'bonfire'];

H.lineCells = function (a, b) {
  const cells = []; let x = a[0], y = a[1];
  const sx = Math.sign(b[0] - x), sy = Math.sign(b[1] - y);
  while (x !== b[0]) { x += sx; cells.push([x, y]); }
  while (y !== b[1]) { y += sy; cells.push([x, y]); }
  return cells;
};
H.connect = function (b) {
  // от входа к ближайшей дороге (не считая собственной двери)
  let best = null, bd = 1e9;
  const d0 = b.door2 && b.rot === 0 ? [b.doorX, b.doorY + 1] : b.rot === 3 ? [b.doorX, b.doorY - 1] : b.rot === 1 ? [b.doorX + 1, b.doorY] : b.rot === 2 ? [b.doorX - 1, b.doorY] : [b.doorX, b.doorY + 1];
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const i = idx(x, y);
    if (!World.road[i] || World.door[i]) continue;
    const d = Math.abs(x - d0[0]) + Math.abs(y - d0[1]);
    if (d < bd) { bd = d; best = [x, y]; }
  }
  if (!best || bd > 40) return 0;
  let n = 0;
  for (const [x, y] of [d0, ...H.lineCells(d0, best)]) if (placeRoadSite(x, y)) n++;
  // вторая попытка Г-образно наоборот
  if (n < bd / 2) { const alt = [[best[0], d0[1]], best]; let x = d0[0], y = d0[1]; for (const c of H.lineCells(d0, alt[0]).concat(H.lineCells(alt[0], best))) if (placeRoadSite(c[0], c[1])) n++; }
  H.stats.roads += n;
  return n;
};
H.tryBuild = function () {
  const type = H.pick(AI_TYPES);
  if (!BUILDINGS[type]) return;
  const anchor = H.pick(Game.buildings.filter(b => b.state === 'done')) || Game.buildings[0];
  if (!anchor) return;
  for (let t = 0; t < 40; t++) {
    const rot = BUILDINGS[type].noRotate ? 0 : BUILDINGS[type].rots ? H.pick(BUILDINGS[type].rots) : H.rnd(3);
    const x = anchor.x + H.rnd(31) - 15, y = anchor.y + H.rnd(25) - 12;
    const err = checkPlacement(type, x, y, rot);
    if (err && err !== 'Мешают деревья, камни или поля') continue;
    if (err) { const d = bDims(type, rot); for (let yy = y; yy < y + d.h; yy++) for (let xx = x; xx < x + d.w; xx++) if (inb(xx, yy) && World.obj[idx(xx, yy)] && World.obj[idx(xx, yy)].t !== 'field') World.obj[idx(xx, yy)] = null; if (checkPlacement(type, x, y, rot)) continue; }
    const b = placeBuilding(type, x, y, false, rot);
    H.stats.placed++;
    H.connect(b);
    if (b.def.crops) {   // поля вокруг фермы
      let nf = 0;
      for (let t2 = 0; t2 < 60 && nf < 7; t2++) {
        const fx = b.x + H.rnd(b.w + 8) - 4, fy = b.y + H.rnd(b.h + 8) - 4;
        if (!planField(fx, fy, b.def.crops[0])) nf++;
      }
      H.stats.fields += nf;
    }
    return b;
  }
};
H.trainNeeded = function () {
  const need = new Map();
  for (const b of Game.buildings) if (b.state !== 'done' && b.def.worker) need.set(b.def.worker, (need.get(b.def.worker) || 0) + 1);
  for (const b of Game.buildings) if (b.state === 'done' && b.def.worker && !(b.worker && !b.worker.dead && b.worker.home === b)) need.set(b.def.worker, (need.get(b.def.worker) || 0) + 1);
  const free = {}; for (const u of Game.units) if (!u.home && !u.dead && !u.teamOf) free[u.type] = (free[u.type] || 0) + 1;
  const queued = {}; for (const b of Game.buildings) for (const q of b.queue) queued[q] = (queued[q] || 0) + 1; for (const b of Game.buildings) if (b.training) queued[b.training.type] = (queued[b.training.type] || 0) + 1;
  for (const [t, n] of need) if ((free[t] || 0) + (queued[t] || 0) < n && UNIT_TYPES[t] && !UNIT_TYPES[t].noTrain) { queueTraining(t); H.stats.trained++; }
  const serfs = Game.units.filter(u => u.type === 'serf').length, builders = Game.units.filter(u => u.type === 'builder').length;
  if (serfs < 6 + Game.buildings.length * 0.6 && !(queued.serf > 1)) queueTraining('serf');
  if (builders < 3 + Game.buildings.length * 0.2 && !(queued.builder > 0)) queueTraining('builder');
};
H.act = function () {
  const r = H.rng();
  if (r < 0.35 && Game.buildings.length < 70) H.tryBuild();
  else if (r < 0.42) { const b = H.pick(Game.buildings.filter(x => x.state === 'done' && canUpgrade(x) && !x.upg)); if (b) { startUpgrade(b); H.stats.upg++; } }
  else if (r < 0.46) { const b = H.pick(Game.buildings.filter(x => !['storehouse', 'school', 'inn', 'bonfire'].includes(x.type) || Game.buildings.filter(y => y.type === x.type).length > 1)); if (b && Game.buildings.length > 6) { removeBuilding(b); H.stats.removed++; } }
  else if (r < 0.50) { const b = H.pick(Game.buildings.filter(x => x.state === 'done')); if (b) { b.paused = !b.paused; } }
  else if (r < 0.53) { const b = H.pick(Game.buildings.filter(x => x.state === 'done' && (x.def.inputs || x.isStore()))); if (b) toggleDeliver(b); }
  else if (r < 0.56) { const b = H.pick(Game.buildings.filter(x => x.state === 'done' && x.def.recipes)); if (b) { const i = H.rnd(b.recipeOn.length); b.recipeOn[i] = !b.recipeOn[i]; } }
  else if (r < 0.60) { const g = H.pick(GOOD_KEYS); Game.storeBlock[g] = !Game.storeBlock[g]; }
  else if (r < 0.64) { // снять случайный кусок дороги
    const roads = []; for (let i = 0; i < N_TILES; i++) if (World.road[i] && !World.door[i]) roads.push(i);
    const i = H.pick(roads); if (i != null && H.rng() < 0.5) setRoad(i % MAP_W, (i / MAP_W) | 0, false);
    const rs = H.pick([...Game.roadSites.values()]); if (rs && H.rng() < 0.3) removeRoadSite(rs);
  }
  else if (r < 0.72 && Game.hero && !Game.hero.dead) { // герой
    const h = Game.hero;
    if (H.rng() < 0.2) { const u = H.pick(Game.units.filter(x => heroCanJoin(x) && !x.teamOf)); if (u) joinTeam(h, u); }
    else if (H.rng() < 0.15) { for (const m of Game.units.filter(x => x.teamOf === h.id)) leaveTeam(m); }
    else { const a = H.pick(Game.buildings); const t = [a.x + H.rnd(21) - 10, a.y + H.rnd(21) - 10]; const c = resolveCmd(t); if (c) issueCmd(h, c); }
    if (H.rng() < 0.3) heroAbility(H.rng() < 0.5 ? 'dash' : 'cry');
  }
  else if (r < 0.76) { const b = H.pick(Game.buildings.filter(x => x.upg)); if (b) cancelUpgrade(b); }
  else if (r < 0.80) { const b = H.pick(Game.buildings.filter(x => x.def.guild && x.state === 'done')); if (b && typeof guildHire === 'function') { try { guildHire(b); } catch (e) { H.report('guildHire', 'guildHire: ' + e.message, 'err'); } } else if (b) b.hireQ = Math.min(recMaxOf(b), (b.hireQ || 0) + 1); }
  else if (r < 0.84) { const i = H.pick([...Game.fieldPlans]); if (i != null) removeField(i % MAP_W, (i / MAP_W) | 0); }
  H.trainNeeded();
  if (H.rng() < 0.3) { const st = Game.buildings.find(b => b.isStore()); if (st && st.stock.gold < 3) st.stock.gold += 5; }   // чтобы школа не вставала
};

// ---------- Инварианты ----------
const fin = v => typeof v === 'number' && isFinite(v);
H.check = function () {
  const T = Game.time, out = H.report;
  if (!fin(T)) out('time-nan', 'Game.time не число', 'crit');
  for (const g of GOOD_KEYS) if (!fin(Game.produced[g])) out('produced-nan:' + g, 'Game.produced.' + g + ' = ' + Game.produced[g], 'crit');
  const ids = new Set();
  H.maxUnits = Math.max(H.maxUnits, Game.units.length);
  for (const u of Game.units) {
    if (ids.has(u.id)) out('dup-unit', 'дубликат жителя id ' + u.id, 'crit'); ids.add(u.id);
    if (!Game.unitMap.has(u.id) || Game.unitMap.get(u.id) !== u) out('unitmap', 'unitMap не совпадает с Game.units: ' + u.type + ' ' + u.id, 'err');
    if (u.dead) out('dead-in-units', 'мёртвый в Game.units: ' + u.type, 'err');
    if (!fin(u.x) || !fin(u.y)) out('unit-nan', 'NaN координаты у ' + u.type + ' ' + u.id, 'crit');
    else if (!inb(Math.floor(u.x), Math.floor(u.y))) out('unit-oob', 'житель за картой ' + u.type + ' ' + u.x.toFixed(1) + ',' + u.y.toFixed(1), 'err');
    if (!fin(u.food)) out('food-nan', 'food NaN у ' + u.type, 'err');
    if (u.home && (u.home.removed || !Game.buildings.includes(u.home))) out('home-removed', u.type + ' держит снесённый дом ' + u.home.type, 'err');
    if (u.inside && (u.inside.removed || !Game.buildings.includes(u.inside))) out('inside-removed', u.type + ' внутри снесённого ' + u.inside.type, 'err');
    if (u.job && u.job.removed) out('job-removed', u.type + ' держит снесённую стройку', 'warn');
    if (u.teamOf && !(Game.unitMap.get(u.teamOf) && !Game.unitMap.get(u.teamOf).dead)) out('team-orphan', u.type + ' в команде мёртвого героя', 'warn');
    if (u.carryN < 0 || (u.carry && !GOODS[u.carry] && u.carry !== 'mushroom' && u.carry !== 'tray')) out('carry-bad', 'странный груз ' + u.carry + ' x' + u.carryN, 'warn');
    if (u.dlv && u.dlv.from && u.dlv.from.removed && u.dlv.to && u.dlv.to.removed) out('dlv-removed', 'доставка между двумя снесёнными', 'warn');
    // зависшие
    const key = u.id, s = H.still.get(key);
    const sig = Math.round(u.x * 10) + ',' + Math.round(u.y * 10) + '|' + (u.inside ? 'in' : '') + (u.brk ? 'brk:' + u.brk.kind : '') + (u.action ? Object.keys(u.action)[0] : 'noact');
    if (!s || s.sig !== sig) H.still.set(key, { sig, t: T, type: u.type });
    else if (!u.inside && !(u.brk && (u.brk.kind === 'sleep' || u.brk.kind === 'faint')) && T - s.t > 240 && !s.rep) {
      s.rep = true;
      const a = u.action;
      out('stuck:' + u.type + ':' + sig.split('|')[1] + ':' + (a && a.wait !== undefined ? 'wait' + (a.anim || '') : a && a.walk ? 'walk' : 'none') + ':' + (u.home ? 'home=' + u.home.type : u.job ? 'job' : u.isCourier ? 'courier' : 'free'),
        `${u.type} ${u.id} стоит ${Math.round(T - s.t)}с на ${u.x.toFixed(1)},${u.y.toFixed(1)} action=${JSON.stringify(a && { ...a, path: a.path ? a.path.length : null })} brk=${u.brk && u.brk.kind} idle=${u.idleFlag} home=${u.home && u.home.type} job=${u.job && (u.job.type || 'road')} carry=${u.carry} food=${u.food && u.food.toFixed(2)} dlv=${!!u.dlv} eat=${!!u.eat} rep=${!!u.repairJob} fj=${u.fieldJob} hf=${u.helpField} cmd=${u.cmd && u.cmd.kind} team=${u.teamOf} rec=${!!u.rec} gm=${u.gm}`, 'err');
    }
  }
  for (const [id, s] of H.still) if (!Game.unitMap.has(id)) H.still.delete(id);
  for (const u of Game.smokers) if (u.dead || !Game.unitMap.has(u.id)) out('smokers-dead', 'в Game.smokers мёртвый', 'warn');
  const bids = new Set();
  for (const b of Game.buildings) {
    if (bids.has(b.id)) out('dup-bid', 'дубликат id здания ' + b.id, 'crit'); bids.add(b.id);
    if (b.removed) out('removed-in-list', 'снесённое в Game.buildings', 'err');
    for (const g of GOOD_KEYS) {
      if (!fin(b.stock[g]) || !fin(b.incoming[g]) || !fin(b.reserved[g])) out('bstock-nan', b.type + ' ' + g + ' NaN', 'crit');
      if (b.stock[g] < 0) out('stock-neg:' + b.type, b.type + ' stock.' + g + ' = ' + b.stock[g], 'err');
      if (b.incoming[g] < 0) out('incoming-neg', b.type + ' incoming.' + g + ' = ' + b.incoming[g], 'warn');
      if (b.reserved[g] < 0) out('reserved-neg', b.type + ' reserved.' + g + ' = ' + b.reserved[g], 'warn');
      if (b.reserved[g] > b.stock[g] + 0.001 && b.state === 'done') out('reserved-gt-stock', b.type + ' reserved.' + g + '=' + b.reserved[g] + ' > stock ' + b.stock[g], 'warn');
      if (b.upg && (b.upg.stock[g] < 0 || !fin(b.upg.stock[g]))) out('upg-stock', b.type + ' upg.stock.' + g + ' = ' + b.upg.stock[g], 'err');
      const cap = b.state === 'done' && !b.isStore() ? (b.def.inputs && b.def.inputs[g]) || (b.def.outputs && b.def.outputs[g]) : 0;
      if (cap && b.stock[g] > cap * 2 + 6) out('overflow:' + b.type + ':' + g, b.type + ' ' + g + ' = ' + b.stock[g] + ' при ёмкости ' + cap, 'warn');
    }
    if (b.worker) {
      const bad = b.worker.dead || !Game.unitMap.has(b.worker.id) || b.worker.home !== b;
      const n = bad ? (H.workerBad.get(b.id) || 0) + 1 : 0; H.workerBad.set(b.id, n);
      if (n >= 3) out('worker-bad', b.type + ' работник ' + (b.worker.dead ? 'мёртв' : !Game.unitMap.has(b.worker.id) ? 'удалён' : 'с другим домом') + ' уже ' + n + ' проверок', 'warn');
    }
    if (b.builder && (b.builder.dead || !Game.unitMap.has(b.builder.id))) out('builder-dead', b.type + ' строитель мёртв', 'warn');
    if (b.state !== 'done' && (!fin(b.hits) || b.hits > b.maxHits + 1)) out('hits', b.type + ' hits ' + b.hits + '/' + b.maxHits, 'warn');
    for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) if (!inb(xx, yy) || World.bmap[idx(xx, yy)] !== b.id) out('bmap-mismatch', b.type + ' bmap не совпадает', 'err');
    if (!World.door[idx(b.doorX, b.doorY)]) out('door-missing', b.type + ' нет флага двери', 'err');
  }
  let bmapOrphan = 0, doorOrphan = 0;
  for (let i = 0; i < N_TILES; i++) {
    if (World.bmap[i] && !bids.has(World.bmap[i])) bmapOrphan++;
    if (World.door[i] && !buildingAtDoor(i % MAP_W, (i / MAP_W) | 0)) doorOrphan++;
  }
  if (bmapOrphan) out('bmap-orphan', 'клеток bmap без здания: ' + bmapOrphan, 'err');
  if (doorOrphan) out('door-orphan', 'клеток двери без здания: ' + doorOrphan, 'err');
  for (const s of Game.roadSites.values()) { if (s.builder && (s.builder.dead || !Game.unitMap.has(s.builder.id))) out('rs-builder-dead', 'стройка дороги: строитель мёртв', 'warn'); if (s.removed) out('rs-removed', 'снесённая стройка дороги в списке', 'err'); if (!fin(s.dug) || !fin(s.pave)) out('rs-nan', 'NaN у стройки дороги', 'crit'); }
  for (const p of Game.piles.values()) { if (p.removed) out('pile-removed', 'removed-куча в списке', 'err'); for (const g of GOOD_KEYS) { if (p.stock[g] < 0 || !fin(p.stock[g])) out('pile-neg', 'куча ' + g + ' ' + p.stock[g], 'err'); } if (!GOOD_KEYS.some(g => p.stock[g] > 0 || p.reserved[g] > 0)) out('pile-empty', 'пустая куча висит', 'warn'); }
  // occ: клетки, занятые не существующими/далёкими
  let occLeak = 0;
  for (let i = 0; i < N_TILES; i++) {
    const id = World.occ[i]; if (!id) continue;
    const u = Game.unitMap.get(id);
    const far = u && !u.dead && (Math.abs(Math.floor(u.x) - i % MAP_W) > 2 || Math.abs(Math.floor(u.y) - ((i / MAP_W) | 0)) > 2);
    if (!u || u.dead || far || u.inside) { const n = (H.occSeen.get(i) || 0) + 1; H.occSeen.set(i, n); if (n === 4) { occLeak++; out('occ-leak', `occ[${i % MAP_W},${(i / MAP_W) | 0}] = ${id} (${!u ? 'нет такого' : u.dead ? 'мёртв' : u.inside ? 'внутри' : 'далеко: ' + u.type + ' ' + u.x.toFixed(1) + ',' + u.y.toFixed(1)}) уже 40с`, 'warn'); } }
    else H.occSeen.delete(i);
  }
  // бронь объектов (o.res) без живого претендента
  const claim = new Set();
  for (const u of Game.units) {
    if (u.dead) continue;
    const add = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inb(x + dx, y + dy)) claim.add(idx(x + dx, y + dy)); };
    add(Math.floor(u.x), Math.floor(u.y));
    if (u.action && u.action.walk) add(u.action.walk[0], u.action.walk[1]);
    if (u.cmd && u.cmd.i != null) claim.add(u.cmd.i);
    if (u.fieldJob >= 0) claim.add(u.fieldJob); if (u.helpField >= 0) claim.add(u.helpField);
  }
  for (let i = 0; i < N_TILES; i++) {
    const o = World.obj[i];
    if (!o || !o.res || o.awake) { H.resSeen.delete(i); continue; }
    if (claim.has(i)) { H.resSeen.delete(i); continue; }
    const n = (H.resSeen.get(i) || 0) + 1; H.resSeen.set(i, n);
    if (n === 9) out('res-leak:' + o.t, `${o.t} на ${i % MAP_W},${(i / MAP_W) | 0} забронирован (res) 90с без претендента (g=${o.g} n=${o.n} plan=${o.plan})`, 'err');
  }
  // рост коллекций
  const sizes = { fx: (Game.fx || []).length, floaters: (Game.floaters || []).length, fxTimers: (Game.fxTimers || []).length, log: (Game.log || []).length, piles: Game.piles.size, roadSites: Game.roadSites.size, animals: Game.animals.length, ents: (Game.ents || []).length, ghosts: (Game.ghosts || []).length, skels: (Game.skels || []).length, neutrals: (Game.neutrals || []).length, hfx: (Game.hfx || []).length, shots: typeof G !== 'undefined' ? G.shots.length : 0, smokers: Game.smokers.size, growing: World.growing.size, bump: typeof bumpCD !== 'undefined' ? bumpCD.size : 0, critters: (Game.critters || []).length, falling: (Game.falling || []).length, bats: (Game.bats || []).length, flies: (Game.flies || []).length, fieldPlans: Game.fieldPlans.size, chests: (Game.chests || []).length };
  for (const k in sizes) if (sizes[k] > 3000) out('grow:' + k, k + ' = ' + sizes[k], 'warn');
  if (typeof PF !== 'undefined' && PF.hF.length > 65536) out('pf-heap', 'куча A* выросла до ' + PF.hF.length, 'warn');
  return sizes;
};

// ---------- Сохранение: туда-обратно ----------
H.strip = function (s) {
  // то, что по замыслу не совпадает после загрузки
  const c = JSON.parse(JSON.stringify(s));
  delete c.cam;
  return c;
};
H.diff = function (a, b, path, out, depth) {
  if (out.length > 40) return;
  if (a === b) return;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') { if (!(typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-6)) out.push(path + ': ' + JSON.stringify(a) + ' → ' + JSON.stringify(b)); return; }
  if (Array.isArray(a) !== Array.isArray(b)) { out.push(path + ': тип'); return; }
  if (Array.isArray(a)) { if (a.length !== b.length) { out.push(path + ': длина ' + a.length + ' → ' + b.length); } for (let i = 0; i < Math.min(a.length, b.length); i++) H.diff(a[i], b[i], path + '[' + i + ']', out, depth + 1); return; }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) { if (a[k] === undefined && b[k] === undefined) continue; if ((a[k] === undefined || a[k] === null || a[k] === 0 || a[k] === false) && (b[k] === undefined || b[k] === null || b[k] === 0 || b[k] === false)) continue; H.diff(a[k], b[k], path + '.' + k, out, depth + 1); }
};
H.roundTrip = function (tag) {
  const t0 = Date.now();
  const s1 = serializeGame();
  const j1 = JSON.stringify(s1);
  const t1 = Date.now();
  let s2;
  try { applySave(JSON.parse(j1)); } catch (e) { H.report('load-throw', 'applySave бросил: ' + e.stack.split('\n').slice(0, 3).join(' | '), 'crit'); return null; }
  const t2 = Date.now();
  s2 = serializeGame();
  const d = []; H.diff(H.strip(s1), H.strip(s2), '', d, 0);
  const filt = d.filter(x => !/^\.(units\[\d+\]\.(x|y)$|nextId$|golem\.)/.test(x.split(':')[0]));   // nextId растёт при загрузке (конструкторы), голем может переехать — не ошибки
  if (filt.length) H.report('roundtrip:' + tag, `сейв (${tag}) после загрузки отличается: ` + filt.slice(0, 12).join(' ; '), 'err');
  H.still.clear(); H.resSeen.clear(); H.occSeen.clear();
  return { bytes: j1.length, serMs: t1 - t0, loadMs: t2 - t1, diffs: filt.length };
};
