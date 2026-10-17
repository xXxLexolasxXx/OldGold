'use strict';
// Тестовая карта «Нагрузка»: ровная поляна, сетка широких дорог (по 2 полосы),
// все виды зданий много раз, на каждое — работник, плюс толпа трудяг и работяг.
// Нужна, чтобы посмотреть, как игра держит большой город. Запуск — из меню.

function stressMap() {
  const seed = 777;
  resetGameState();
  Game.seed = seed;
  genWorld(seed);
  // поляна: трава везде, сверху скальная гряда с золотом и кристаллами, внизу лес, справа внизу озеро
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const i = idx(x, y);
    let t = T_GRASS;
    if (y <= 3) t = T_ROCK;
    if (x > 70 && y > 58 && Math.hypot(x - 84, y - 66) < 9) t = T_WATER;
    World.terrain[i] = t;
    World.crystal[i] = y === 3 && x > 48 ? 1 : 0;
    World.obj[i] = null;
    World.road[i] = 0; World.bmap[i] = 0; World.door[i] = 0;
  }
  // берег — песок
  for (let y = 1; y < MAP_H - 1; y++) for (let x = 1; x < MAP_W - 1; x++) {
    if (World.terrain[idx(x, y)] !== T_GRASS) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (World.terrain[idx(x + dx, y + dy)] === T_WATER) World.terrain[idx(x, y)] = T_SAND;
  }
  // лес и камни внизу — для дровосеков и каменотёсов
  const r = mulberry32(seed);
  for (let y = 62; y < MAP_H; y++) for (let x = 0; x < 70; x++) if (r() < 0.55) setTree(idx(x, y), 1);
  for (let x = 0; x < 70; x += 3) setStone(idx(x, 60), 6);

  // сетка широких дорог
  const rows = [7, 17, 27, 37, 47, 57], cols = [2, 18, 34, 50, 66, 82];
  for (const ry of rows) for (let x = 2; x < MAP_W - 2; x++) { setRoad(x, ry, true); setRoad(x, ry + 1, true); }
  for (const cx of cols) for (let y = 7; y <= 58; y++) { if (y < MAP_H) { setRoad(cx, y, true); setRoad(cx + 1, y, true); } }

  // здания: верхний ряд — рудники и шахты под скалой, дальше все типы по кругу
  const types = BUILD_ORDER.filter(t => t !== 'goldmine' && t !== 'crystalmine');
  let ti = 0;
  const place = (type, x, y) => {
    const d = bDims(type, 0);
    for (let yy = y; yy < y + d.h; yy++) for (let xx = x; xx < x + d.w; xx++) {
      const i = idx(xx, yy);
      if (World.bmap[i] || World.road[i] || World.terrain[i] !== T_GRASS) return null;
    }
    return placeBuilding(type, x, y, true, 0);
  };
  for (let bi = 0; bi < cols.length - 1; bi++) {
    // под скалой: рудник и шахта
    const x0 = cols[bi] + 3;
    place(bi % 2 ? 'crystalmine' : 'goldmine', x0, 4);
    place('storehouse', x0 + 5, 4);
    for (const ry of rows.slice(1)) {
      // кварталы над каждой дорогой: дома входом на дорогу, между домами клетка зазора
      let x = cols[bi] + 3;
      while (x < cols[bi + 1] - 1) {
        let placed = null;
        for (let k = 0; k < types.length && !placed; k++) {
          const type = types[(ti + k) % types.length], d = bDims(type, 0);
          if (x + d.w > cols[bi + 1] - 1 || d.h > 7) continue;
          placed = place(type, x, ry - d.h);
          if (placed) { ti = (ti + k + 1) % types.length; x += d.w + 1; }
        }
        if (!placed) x++;
      }
    }
  }

  // склады набиты всем, чем можно
  for (const b of Game.buildings) if (b.type === 'storehouse') for (const g of GOOD_KEYS) if (!GOODS[g].noStore) b.stock[g] = 80;
  for (const b of Game.buildings) if (b.type === 'inn') { b.stock.bread = 10; b.stock.sausage = 10; b.stock.beer = 10; b.stock.chicken = 4; }

  // жители: на каждое здание с работой — свой работник, плюс толпа
  const spawnNear = (type, x, y) => { const s = randomFreeNear(x, y, 0, 3, (xx, yy) => World.road[idx(xx, yy)] === 1) || [x, y]; spawnUnit(type, s[0], s[1]); };
  for (const b of Game.buildings) if (b.def.worker) spawnNear(b.def.worker, b.doorX, b.doorY + 1);
  for (let k = 0; k < 110; k++) { const ry = rows[k % rows.length], x = 4 + (k * 7) % (MAP_W - 8); spawnNear('serf', x, ry); }
  for (let k = 0; k < 24; k++) { const ry = rows[k % rows.length]; spawnNear('builder', 6 + k * 3, ry + 1); }
  for (const u of Game.units) u.food = 0.6 + Math.random() * 0.4;

  // немного стройки дорог, урны и фонари вдоль улиц, звери
  for (let x = 4; x < 30; x++) placeRoadSite(x, 60);
  decorateAllRoads();
  spawnAnimals();
  Game.stress = true;
  buildTerrain(seed);
  updateMinimapBase();
  centerOn(40 * TILE, 30 * TILE);
  updateUI(true);
  toast(`Тестовая карта: ${Game.buildings.length} зданий, ${Game.units.length} жителей`);
}

// ---------- Деревня «через час игры» ----------
// Обычная карта: вокруг стартовой деревни расставляются почти все постройки,
// к каждой ведётся дорога, работникам — свои дома, затем игра сама проматывает час.

const VILLAGE_PLAN = ['woodcutter', 'woodcutter', 'quarry', 'sawmill', 'farm', 'farm', 'mill', 'bakery', 'swine', 'butchery',
  'hopfarm', 'brewery', 'bonfire', 'goatpen', 'stable', 'tannery', 'armory', 'goldmine', 'metallurgist', 'crystalmine',
  'magiccircle', 'magicworkshop', 'storehouse', 'inn'];

// Дорога от входа к ближайшей дороге сети склада
function linkToRoads(b) {
  updateRoadComps();
  const st = Game.buildings.find(s => s.isStore());
  const sc = st && compAt(st.doorX, st.doorY);
  let best = null, bd = 1e9;
  for (let i = 0; i < N_TILES; i++) {
    if (!World.road[i] || World.door[i]) continue;
    const x = i % MAP_W, y = (i / MAP_W) | 0;
    if (compAt(x, y) !== sc) continue;
    const d = Math.abs(x - b.doorX) + Math.abs(y - b.doorY);
    if (d < bd) { bd = d; best = [x, y]; }
  }
  if (!best) return false;
  const path = findPath(b.doorX, b.doorY, best[0], best[1]);
  if (!path) return false;
  for (const [x, y] of path) {
    const i = idx(x, y);
    if (World.road[i] || World.bmap[i]) continue;
    World.obj[i] = null;
    setRoad(x, y, true);
  }
  World.roadDirty = true;
  return true;
}

function placeNear(type, cx, cy) {
  for (let r = 3; r < 26; r++) {
    for (let k = 0; k < r * 8; k++) {
      const a = k / (r * 8) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r * 0.8);
      for (const rot of BUILDINGS[type].noRotate ? [0] : [0, 1, 2]) {
        if (checkPlacement(type, x, y, rot)) continue;
        const b = placeBuilding(type, x, y, true, rot);
        if (linkToRoads(b)) return b;
        removeBuilding(b);
      }
    }
  }
  return null;
}

function villageAfterHour() {
  const seed = (Math.random() * 1e9) | 0;
  setupStart(seed);
  const st = Game.buildings.find(b => b.isStore());
  const cx = st.doorX + 4, cy = st.doorY;
  for (const type of VILLAGE_PLAN) {
    const b = placeNear(type, cx, cy);
    if (b && b.def.worker) spawnUnit(b.def.worker, b.doorX, b.doorY);
  }
  for (let k = 0; k < 24; k++) spawnUnit('serf', st.doorX + (k % 6) - 3, st.doorY + 1 + (k > 11 ? 1 : 0));
  for (let k = 0; k < 3; k++) spawnUnit('builder', st.doorX + k, st.doorY + 2);
  Object.assign(st.stock, { timber: 70, stone: 70, gold: 60, bread: 90, sausage: 50, beer: 20, wheat: 20, hay: 20, trunk: 10, leather: 4, flour: 10 });
  decorateAllRoads();
  spawnAnimals();
  buildTerrain(seed);
  updateMinimapBase();
  updateUI(true);
  // проматываем час жизни кусками, не замораживая страницу
  const total = 60 * 60 / SIM_DT;
  let done = 0, lastPct = -1;
  const wasPaused = Game.paused; Game.paused = true;
  const chunk = () => {
    const n = Math.min(1500, total - done);
    for (let k = 0; k < n; k++) { try { step(SIM_DT); } catch (e) { console.error(e); } }
    done += n;
    const pct = Math.floor(done / total * 100);
    if (pct >= lastPct + 20) { lastPct = pct; toast(`Деревня живёт без тебя: ${pct}% часа`); }
    if (done < total) setTimeout(chunk, 0);
    else {
      Game.paused = wasPaused;
      updateMinimapBase(); updateUI(true);
      centerOn((st.doorX + 3) * TILE, st.doorY * TILE);
      toast(`Прошёл час: ${Game.buildings.length} построек, ${Game.units.length} жителей`);
    }
  };
  centerOn((st.doorX + 3) * TILE, st.doorY * TILE);
  setTimeout(chunk, 50);
}

// ---------- Счётчик нагрузки ----------

const Perf = { frames: [], steps: [], last: 0, el: null };

function perfFrame(frameMs, stepMs) {
  Perf.frames.push(frameMs); Perf.steps.push(stepMs);
  if (Perf.frames.length > 60) { Perf.frames.shift(); Perf.steps.shift(); }
  if (!Game.stress && !location.search.includes('perf')) { if (Perf.el) Perf.el.style.display = 'none'; return; }
  const now = performance.now();
  if (now - Perf.last < 500) return;
  Perf.last = now;
  if (!Perf.el) {
    Perf.el = document.createElement('div');
    Perf.el.style.cssText = 'position:absolute;left:8px;bottom:8px;z-index:3;font:12px Consolas,monospace;color:#f6d458;background:rgba(10,7,5,0.75);padding:4px 8px;border:1px solid #5a4128;pointer-events:none';
    document.getElementById('view').appendChild(Perf.el);
  }
  const avg = a => a.reduce((s, v) => s + v, 0) / a.length;
  const f = avg(Perf.frames);
  Perf.el.style.display = '';
  Perf.el.textContent = `${Math.round(1000 / f)} кадр/с · кадр ${f.toFixed(1)} мс · симуляция ${avg(Perf.steps).toFixed(1)} мс · жителей ${Game.units.length} · зданий ${Game.buildings.length}`;
}
