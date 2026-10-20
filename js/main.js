'use strict';
// Запуск, игровой цикл и управление мышью/клавиатурой.

// Стартовая деревня: улица через поляну, склад, школа и трактир в случайных
// местах по обе стороны с зазорами, к каждому входу — дорожка. Ряд вдоль улицы
// оставлен свободным, чтобы её можно было расширить до двух полос.
function layoutStart(rng, cx, cy) {
  const sy = cy + Math.floor(rng() * 3) - 1;                  // улица чуть выше или ниже центра
  const taken = new Set();                                     // клетки зданий с отступом в 1
  const roads = [];
  // проходы к площадкам под рудник и кристаллы трогать нельзя
  const corridor = (x, y) => y < sy && ((x >= cx + 7 && x <= cx + 11) || (x >= cx - 12 && x <= cx - 8));
  const fits = (x0, y0, w, h) => {
    for (let y = y0 - 1; y <= y0 + h; y++) for (let x = x0 - 1; x <= x0 + w; x++) {
      if (taken.has(idx(x, y))) return false;
      if (y >= sy - 1 && y <= sy + 1) return false;            // улица и её вторая полоса
      if (corridor(x, y)) return false;
    }
    return true;
  };
  const placed = [];
  const types = ['storehouse', 'school', 'bonfire', 'inn'];   // школа и костёр — только к северу от улицы, не боком
  for (const type of types) {
    let best = null;
    const bfNorth = rng() < 0.5;                               // костёр: сторона выбирается один раз, если не вышло — другая
    for (let t = 0; t < 400 && !best; t++) {
      const wide = BUILDINGS[type].wideDoor;                  // склад — воротами прямо к улице
      const dbl = type === 'bonfire';                         // к костру — двойная дорога
      const front = (wide && type !== 'bonfire') || type === 'school';   // эти стоят к северу от улицы лицом к ней
      const north = type === 'bonfire' ? (t < 330 ? bfNorth : !bfNorth) : front || rng() < 0.6;   // костёр — то к северу, то к югу (входом вверх)
      const rot = type === 'bonfire' ? (north ? 0 : 3) : BUILDINGS[type].noRotate || front ? 0 : north ? (rng() < 0.3 ? 1 : 0) : 1;   // к югу от улицы — входом вбок
      const d = bDims(type, rot);
      const gap = 2 + Math.floor(rng() * 2);                  // 2–3 клетки от улицы
      const sweep = t % 46, off = ((sweep + 1) >> 1) * (sweep % 2 ? 1 : -1);   // места перебираем от центра поляны наружу: деревня кучная, улица короткая
      const x = t < 276 ? cx + off - (d.w >> 1) + Math.floor(rng() * 3) - 1 : cx - 20 + Math.floor(rng() * 38);
      const y = north ? sy - gap - d.h + (rot ? 1 : 0) : sy + gap;
      if (!fits(x, y, d.w, d.h)) continue;
      { const bad = checkPlacement(type, x, y, rot); if (bad && bad !== 'Мешают деревья, камни или поля') continue; }   // деревья на месте стройки просто срубаем
      const door = [x + d.dx, y + d.dy];
      // дорожка от входа (и от второй створки ворот) к улице: прямо по вертикали
      const path = [];
      const step = door[1] < sy ? 1 : -1;
      let ok = true;
      const cols = wide && !dbl ? [door[0], wideDoorTile(type, x, y, rot)[0]] : [door[0]];   // у костра одна полоса дороги, но два входа
      for (const col of cols) for (let yy = door[1] + step; yy !== sy; yy += step) {
        const i = idx(col, yy);
        if (World.bmap[i] || taken.has(i) || World.terrain[i] === T_WATER || World.terrain[i] === T_ROCK) { ok = false; break; }
        path.push([col, yy]);
      }
      if (ok) best = { type, x, y, rot, door, path };
    }
    if (!best) continue;
    const d = bDims(type, best.rot);
    for (let yy = best.y - 1; yy <= best.y + d.h; yy++) for (let xx = best.x - 1; xx <= best.x + d.w; xx++) taken.add(idx(xx, yy));
    for (let yy = best.y; yy <= best.y + d.h; yy++) for (let xx = best.x; xx < best.x + d.w; xx++) if (inb(xx, yy)) World.obj[idx(xx, yy)] = null;   // расчищаем площадку
    const pb = placeBuilding(type, best.x, best.y, true, best.rot);   // школа и костёр стоят с самого начала
    placed.push(pb);
    roads.push(...best.path);
  }
  // улица от крайнего входа до крайнего, с запасом
  const xs = placed.map(b => b.doorX);
  const x0 = Math.min(...xs) - 2, x1 = Math.max(...xs) + 3;   // улица — только от первой двери до последней
  for (let x = x0; x <= x1; x++) roads.push([x, sy]);
  for (const [x, y] of roads) {
    if (!inb(x, y)) continue;
    const i = idx(x, y);
    if (World.bmap[i]) continue;
    World.terrain[i] = World.terrain[i] === T_SAND ? T_SAND : T_GRASS;
    World.obj[i] = null;
    setRoad(x, y, true);
  }
  // вторая полоса свободна от деревьев и камней
  for (let x = x0; x <= x1; x++) if (inb(x, sy + 1) && !World.bmap[idx(x, sy + 1)]) World.obj[idx(x, sy + 1)] = null;
  return { sy, x0, x1, placed };
}


// Если среди стартовых зданий не нашлось места костру или школе — подыскиваем место отдельно:
// к северу от улицы, вход на юг (не боком), к нему дорога до улицы (у костра — на обе створки).
function addStartBuilding(lay, type) {
  const { sy } = lay, d = bDims(type, 0), wide = !!BUILDINGS[type].wideDoor;
  const blocked = (x, y) => Game.buildings.some(b => x >= b.x - 1 && x <= b.x + b.w && y >= b.y - 1 && y <= b.y + b.h);
  // места перебираем от середины улицы наружу — новое здание встаёт рядом с остальными, а не на краю поляны
  const mid = (lay.x0 + lay.x1) >> 1, xsNear = [];
  for (let x = lay.x0 - 16; x <= lay.x1 + 16; x++) xsNear.push(x);
  xsNear.sort((p, q) => Math.abs(p - mid) - Math.abs(q - mid));
  for (let gap = 2; gap <= 7; gap++) for (const x of xsNear) {
    const y = sy - gap - d.h;
    let ok = true;
    for (let yy = y - 1; yy <= sy && ok; yy++) for (let xx = x - 1; xx <= x + d.w + 1 && ok; xx++) if (!inb(xx, yy) || (yy < sy && blocked(xx, yy)) || (World.terrain[idx(xx, yy)] !== T_GRASS && !(yy >= sy - 1 && World.terrain[idx(xx, yy)] === T_SAND))) ok = false;
    if (!ok) continue;
    const bad = checkPlacement(type, x, y, 0);
    if (bad && bad !== 'Мешают деревья, камни или поля') continue;
    for (let yy = y; yy < y + d.h; yy++) for (let xx = x; xx < x + d.w; xx++) World.obj[idx(xx, yy)] = null;
    const b = placeBuilding(type, x, y, true, 0);
    const cols = wide && b.door2 && type !== 'bonfire' ? [b.doorX, b.door2[0]] : [b.doorX];   // у костра одна полоса
    for (let yy = b.doorY + 1; yy <= sy; yy++) for (const xx of cols) { if (World.bmap[idx(xx, yy)]) continue; World.obj[idx(xx, yy)] = null; setRoad(xx, yy, true); }
    // улица дотягивается до новой двери, чтобы она была связана со складом
    { const lo = Math.min(lay.x0, ...cols) - 1, hi = Math.max(lay.x1, ...cols) + 1; for (let xx = lo; xx <= hi; xx++) { if (!inb(xx, sy) || World.bmap[idx(xx, sy)]) continue; World.obj[idx(xx, sy)] = null; setRoad(xx, sy, true); } lay.x0 = lo; lay.x1 = hi; }
    lay.placed.push(b);
    return b;
  }
  // нет места к северу — для трактира и костра пробуем к югу от улицы, входом вбок (на восток)
  if (type === 'inn' || type === 'bonfire') {
    const d1 = bDims(type, 1);
    for (let gap = 2; gap <= 7; gap++) for (const x of xsNear) {
      const y = sy + gap;
      let ok = true;
      for (let yy = sy; yy <= y + d1.h + 1 && ok; yy++) for (let xx = x - 1; xx <= x + d1.w + 1 && ok; xx++) if (!inb(xx, yy) || blocked(xx, yy) || (yy > sy + 1 && World.terrain[idx(xx, yy)] !== T_GRASS)) ok = false;
      if (!ok) continue;
      const bad = checkPlacement(type, x, y, 1);
      if (bad && bad !== 'Мешают деревья, камни или поля') continue;
      for (let yy = y; yy < y + d1.h; yy++) for (let xx = x; xx < x + d1.w; xx++) World.obj[idx(xx, yy)] = null;
      const b = placeBuilding(type, x, y, true, 1);
      const top = Math.min(b.doorY, b.door2 ? b.door2[1] : b.doorY);
      for (let yy = sy + 1; yy < top; yy++) { if (World.bmap[idx(b.doorX, yy)]) continue; World.obj[idx(b.doorX, yy)] = null; setRoad(b.doorX, yy, true); }
      { const lo = Math.min(lay.x0, b.doorX) - 1, hi = Math.max(lay.x1, b.doorX) + 1; for (let xx = lo; xx <= hi; xx++) { if (!inb(xx, sy) || World.bmap[idx(xx, sy)]) continue; World.obj[idx(xx, sy)] = null; setRoad(xx, sy, true); } lay.x0 = lo; lay.x1 = hi; }
      lay.placed.push(b);
      return b;
    }
  }
  return null;
}
// Сносим дороги неудачной раскладки вместе с их изображением на земле (иначе остаются «лишние» кусочки)
function clearStartRoads() {
  for (let i = 0; i < N_TILES; i++) if (World.road[i]) setRoad(i % MAP_W, (i / MAP_W) | 0, false);
}

// opts: { biome, size } — биом карты (по умолчанию луга) и размер из MAP_SIZES (по умолчанию большая)
function setupStart(seed, opts = {}) {
  resetGameState();
  Game.seed = seed;
  Game.stress = false;
  MapOpt.custom = opts.custom || null;   // карта игрока (mapedit.js): биом и размер берутся из неё
  MapOpt.biome = MapOpt.custom ? MapOpt.custom.biome : BIOMES[opts.biome] ? opts.biome : 'meadow';
  MAPEV.cur = null; MAPEV.low = null;
  const sz = MapOpt.custom ? { w: MapOpt.custom.w, h: MapOpt.custom.h } : MAP_SIZES[opts.size] || MAP_SIZES.large;
  setMapSize(sz.w, sz.h);
  const { cx, cy } = genWorld(seed);
  const rng = mulberry32(seed ^ 0x5eed);
  // нужны склад, школа и костёр с двойной дорогой: если не вышло — пробуем ещё несколько раскладок
  const full = l => ['storehouse', 'school', 'bonfire', 'inn'].every(t => l.placed.some(b => b.type === t));
  // из нескольких пробных раскладок берём самую кучную (короткая улица — деревня не растягивается по горизонтали)
  const tryLay = a => layoutStart(mulberry32(((seed ^ 0x5eed) + a * 7919) >>> 0), cx, cy);
  let bestA = -1, bestW = 1e9;
  for (let a = 0; a < 8; a++) {
    const l = tryLay(a);
    const w = l.x1 - l.x0 + (l.placed.length < 4 ? 100 : 0);
    if (full(l) && w < bestW) { bestW = w; bestA = a; }
    for (const b of l.placed) removeBuilding(b);
    clearStartRoads();
  }
  let lay = bestA >= 0 ? tryLay(bestA) : layoutStart(rng, cx, cy);
  for (let attempt = 0; attempt < 12 && !full(lay); attempt++) {
    for (const b of lay.placed) removeBuilding(b);
    clearStartRoads();
    lay = layoutStart(rng, cx, cy);
  }
  if (lay.placed.length >= 2) for (const t of ['school', 'inn', 'bonfire']) if (!lay.placed.some(b => b.type === t)) addStartBuilding(lay, t);
  if (lay.placed.length < 3) {
    // не нашлось места — запасная прежняя раскладка
    for (const b of lay.placed) removeBuilding(b);
    clearStartRoads();
    // каждое здание — на ближайшее подходящее место (не на воду и не на песок), а не вслепую по сетке
    for (const [type, px] of [['storehouse', cx - 9], ['school', cx - 4], ['inn', cx]]) {
      let done = false;
      for (let r = 0; r < 14 && !done; r++) for (let k = 0; k < 8 && !done; k++) {
        const x = px + Math.round(Math.cos(k * 0.785) * r), y = cy - 3 - Math.abs(Math.round(Math.sin(k * 0.785) * r));
        const bad = checkPlacement(type, x, y, 0);
        if (bad && bad !== 'Мешают деревья, камни или поля') continue;
        for (let yy = y; yy < y + BUILDINGS[type].h; yy++) for (let xx = x; xx < x + BUILDINGS[type].w; xx++) World.obj[idx(xx, yy)] = null;
        placeBuilding(type, x, y, true); done = true;
      }
    }
    for (let x = cx - 10; x <= cx + 5; x++) setRoad(x, cy, true);
    lay = { sy: cy, x0: cx - 10, x1: cx + 5 };
  }
  Game.unlocked = {};              // меню строительства открывается постепенно
  UI.shown = null;
  if (tutSeen()) releaseStart();   // обучение уже проходили — школу достраивают сразу
  renderBuildMenu();
  const store = Game.buildings.find(b => b.type === 'storehouse');
  Object.assign(store.stock, DIFF_STOCK);

  const { sy, x0, x1 } = lay;
  const start = { serf: 8, builder: 4, woodcutter: 1, carpenter: 1, stonemason: 1, farmer: 1 };
  for (const [type, n] of Object.entries(start))
    for (let k = 0; k < n; k++) {
      if (type === 'serf') spawnUnit(type, x0 + 1 + Math.floor(k * (x1 - x0 - 2) / n), sy);   // курьеры — на улице
      else {
        const s = randomFreeNear((x0 + x1) >> 1, sy + 2, 1, 5) || [(x0 + x1) >> 1, sy + 1];
        spawnUnit(type, s[0], s[1]);
      }
    }

  diffApplyStart(Game.diff);   // припасы и трудяги под выбранную сложность
  decorateAllRoads();          // фонари, скамейки и урны вдоль стартовых улиц
  spawnAnimals();
  centerOn(((x0 + x1) / 2) * TILE, (sy - 2) * TILE);
}

function newGame(opts) {
  Game.pendDiff = Game.diff;   // «Новая карта» — тот же режим игры
  const seed = opts && opts.seed != null ? opts.seed : (Math.random() * 1e9) | 0;
  setupStart(seed, opts);
  buildTerrain(seed);
  updateMinimapBase();
  updateUI(true);
}

function step(dt) {
  Game.time += dt;
  for (const u of Game.units) u.update(dt);
  for (const b of Game.buildings) b.update(dt);
  Game.growT += dt;
  if (Game.growT >= 1) { updateGrowth(Game.growT); Game.growT = 0; }
  updateAnimals(dt);
  nightTick(dt);
  festivalTick(dt);
  brawlTick(dt);
  weatherTick(dt);
  updateCritters(dt);
  streetTick(dt);
  gamesTick(dt);
  updateOwls(dt);
  faunaTick(dt);
  fauna2Tick(dt);
  beastsTick(dt);
  chestsTick(dt);
  fairyTick(dt);
  fairy2Tick(dt);
  updateFalling(dt);
  sfxTick(dt);
  Game.bumpT = (Game.bumpT || 0) + dt;
  if (Game.bumpT >= 0.25) { checkCollisions(); Game.bumpT = 0; }
  Game.dispatchT += dt;
  if (Game.dispatchT >= 0.4) { dispatchAll(); Game.dispatchT = 0; }
}

// ---------- Камера ----------

function resize() {
  const dpr = screenDPR();
  // поворот телефона / смена размера окна: на месте остаётся точка в центре экрана, а не левый верхний угол
  const s = camScale(), ow = R.vw, oh = R.vh;
  R.canvas.width = Math.round(R.canvas.clientWidth * dpr);
  R.canvas.height = Math.round(R.canvas.clientHeight * dpr);
  R.vw = R.canvas.clientWidth; R.vh = R.canvas.clientHeight;
  if (ow && oh && R.vw && R.vh && isFinite(R.cam.x) && (ow !== R.vw || oh !== R.vh)) {
    R.cam.x += (ow - R.vw) / 2 / s;
    R.cam.y += (oh - R.vh) / 2 / s;
  }
  clampCam();
}

function viewSize() {
  const s = camScale();
  return [R.canvas.clientWidth / s, R.canvas.clientHeight / s];
}

function clampCam() {
  if (!isFinite(R.cam.x)) R.cam.x = 0;    // скрытая вкладка с нулевым холстом не должна ломать камеру
  if (!isFinite(R.cam.y)) R.cam.y = 0;
  const [vw, vh] = viewSize();
  R.cam.x = Math.max(-TILE * 2, Math.min(MAP_W * TILE - vw + TILE * 2, R.cam.x));
  R.cam.y = Math.max(-TILE * 3, Math.min(MAP_H * TILE - vh + TILE * 2, R.cam.y));
}

function centerOn(wx, wy) {
  const [vw, vh] = viewSize();
  R.cam.x = wx - vw / 2;
  R.cam.y = wy - vh / 2;
  clampCam();
}

function screenToWorld(sx, sy) {
  const s = camScale();
  return [R.cam.x + sx / s, R.cam.y + sy / s];
}

function screenToTile(sx, sy) {
  const [wx, wy] = screenToWorld(sx, sy);
  return [Math.floor(wx / TILE), Math.floor(wy / TILE)];
}

function setZoom(z, sx, sy) {
  const [wx, wy] = screenToWorld(sx, sy);
  R.cam.z = z;
  const s = camScale();
  R.cam.x = wx - sx / s;
  R.cam.y = wy - sy / s;
  clampCam();
}

// Шаг масштаба: dir +1 ближе, −1 дальше; без точки — к центру экрана
function zoomStep(dir, sx, sy) {
  if (sx === undefined) { sx = R.canvas.clientWidth / 2; sy = R.canvas.clientHeight / 2; }
  let k = ZOOMS.indexOf(R.cam.z);
  if (k < 0) k = ZOOMS.indexOf(2);
  const nk = Math.max(0, Math.min(ZOOMS.length - 1, k + dir));
  if (nk !== k) setZoom(ZOOMS[nk], sx, sy);
}

// ---------- Ввод ----------

const Input = { keys: new Set(), pan: null, leftDown: false, roadStart: null, lastEraseTile: null };

function lineCells(a, b) {
  // Почти вдоль оси — Г-образная линия (сначала по горизонтали, затем по вертикали);
  // ближе к 45° — сначала косой участок по диагонали, остаток прямо
  const cells = [];
  const sx = Math.sign(b[0] - a[0]), sy = Math.sign(b[1] - a[1]);
  const ax = Math.abs(b[0] - a[0]), ay = Math.abs(b[1] - a[1]);
  let x = a[0], y = a[1];
  cells.push([x, y]);
  if (Math.min(ax, ay) > Math.max(ax, ay) * 0.4) {
    while (x !== b[0] && y !== b[1]) { x += sx; y += sy; cells.push([x, y]); }
  }
  while (x !== b[0]) { x += sx; cells.push([x, y]); }
  while (y !== b[1]) { y += sy; cells.push([x, y]); }
  return cells;
}

function buildingAt(t) {
  if (!inb(t[0], t[1])) return null;
  const i = idx(t[0], t[1]);
  const id = World.bmap[i];
  if (id) return Game.buildings.find(b => b.id === id) || null;
  if (World.door[i]) return buildingAtDoor(t[0], t[1]);
  return null;
}

function selectBuilding(b) {
  Game.selected = b;
  if (Mobile.on) mobileSheet(b ? 'info' : null);
  updateUI(true);
}

// Протянутая дорога. Занятые клетки (дерево, камень, вода, дом) раньше пропускались молча — дорога
// выходила с дырой, и здание за ней «не соединялось», хотя дорогу вроде построили
function placeRoadDrag(cells) {
  let n = 0, gap = 0;
  for (const [x, y] of cells) {
    const has = inb(x, y) && (World.road[idx(x, y)] || Game.roadSites.has(idx(x, y)));
    if (placeRoadSite(x, y)) n++;
    else if (!has && !(inb(x, y) && World.door[idx(x, y)])) gap++;
  }
  if (!n && cells.length) toast('Здесь нельзя проложить дорогу');
  else if (gap) toast(`Дорога с разрывом: ${gap} кл. не проложено (дерево, камень, вода или дом) — по ней не пройдут. Обведите помеху или уберите её`);
  return n;
}

function onLeftClickTile(t) {
  const tool = Game.tool;
  if (tool && tool.kind === 'build') {
    const d = bDims(tool.type, tool.rot || 0);
    const bx = t[0] - Math.floor(d.w / 2), by = t[1] - d.h + 1;
    const err = checkPlacement(tool.type, bx, by, d.rot);
    if (err) { toast(err + (/скал|кристалл/.test(err) ? mineSpotHint(tool.type, bx, by) : '')); return; }
    placeBuilding(tool.type, bx, by, false, d.rot);
    track('place-1', 'Заложил первое здание');
    if (!Input.keys.has('Shift')) setTool(null);
    return;
  }
  if (tool && tool.kind === 'erase') { eraseAt(t); return; }
  if (tool && tool.kind === 'field') { fieldStroke(t, true); return; }
  if (tool && tool.kind === 'fort') { defToolClick(t); return; }
  if (!tool && defClickTile(t)) return;
  const b = buildingAt(t);
  selectBuilding(b || (inb(t[0], t[1]) ? Game.roadSites.get(idx(t[0], t[1])) || null : null));
}

function eraseAt(t) {
  if (!inb(t[0], t[1])) return;
  const i = idx(t[0], t[1]);
  const rs = Game.roadSites.get(i);
  if (rs) { removeRoadSite(rs); return; }
  const id = World.bmap[i];
  if (id) {
    const b = Game.buildings.find(o => o.id === id);
    if (b && (b.state !== 'done' || confirm(`Снести «${b.def.name}»?`))) removeBuilding(b);
    return;
  }
  if (removeField(t[0], t[1])) return;                              // убрать поле
  if (fortAt(t[0], t[1])) { defEraseAct(t); return; }              // стена, ворота, ловушка, факел
  if (isStreetObj(World.obj[i])) { World.obj[i] = null; return; }   // убрать фонарь, скамейку или урну
  if (World.road[i] && !World.door[i]) setRoad(t[0], t[1], false);
}

function initInput() {
  const cv = R.canvas;
  cv.addEventListener('contextmenu', e => e.preventDefault());

  cv.addEventListener('mousedown', e => {
    const t = screenToTile(e.offsetX, e.offsetY);
    if (e.button === 2 || e.button === 1) {
      Input.pan = { x: e.clientX, y: e.clientY, cx: R.cam.x, cy: R.cam.y, moved: false };
      return;
    }
    if (e.button !== 0) return;
    Input.leftDown = true;
    if (Game.tool && Game.tool.kind === 'road') {
      Input.roadStart = t;
      R.roadDrag = [t];
      return;
    }
    if (Game.tool && Game.tool.kind === 'erase') Input.lastEraseTile = t.join();
    if (defToolDown(t)) return;
    onLeftClickTile(t);
  });

  window.addEventListener('mousemove', e => {
    // телефон: после тапа по кнопке браузер шлёт «мышиное» движение туда же — призрак здания не должен прыгать к кнопке
    if (typeof Mobile !== 'undefined' && Mobile.on && e.target !== cv) return;
    if (Input.pan) {
      const dx = e.clientX - Input.pan.x, dy = e.clientY - Input.pan.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) Input.pan.moved = true;
      const s = camScale();
      R.cam.x = Input.pan.cx - dx / s;
      R.cam.y = Input.pan.cy - dy / s;
      clampCam();
    }
    const rect = cv.getBoundingClientRect();
    const inside = e.clientX >= rect.left && e.clientX < rect.right && e.clientY >= rect.top && e.clientY < rect.bottom;
    R.hover = inside ? screenToTile(e.clientX - rect.left, e.clientY - rect.top) : null;
    R.hoverPx = inside ? [e.clientX - rect.left, e.clientY - rect.top] : null;
    if (Input.leftDown && R.hover && Game.tool) {
      if (Game.tool.kind === 'road' && Input.roadStart) R.roadDrag = lineCells(Input.roadStart, R.hover);
      if (Game.tool.kind === 'field') fieldStroke(R.hover, false);
      if (Game.tool.kind === 'fort') defToolMove(R.hover);
      if (Game.tool.kind === 'erase' && R.hover.join() !== Input.lastEraseTile) {
        Input.lastEraseTile = R.hover.join();
        const i = inb(R.hover[0], R.hover[1]) ? idx(R.hover[0], R.hover[1]) : -1;
        if (i >= 0 && !World.bmap[i]) eraseAt(R.hover);
      }
    }
  });

  window.addEventListener('mouseup', e => {
    if ((e.button === 2 || e.button === 1) && Input.pan) {
      const moved = Input.pan.moved;
      Input.pan = null;
      if (!moved && e.button === 2) {
        if (Game.tool) setTool(null); else selectBuilding(null);
      }
      return;
    }
    if (e.button !== 0) return;
    Input.leftDown = false; Input.fieldMode = null; Input.lastFieldTile = null;
    if (Input.fortStart) defToolUp();
    if (Game.tool && Game.tool.kind === 'road' && R.roadDrag) {
      // одиночный клик по готовой дороге или стройке дороги — убрать её (быстрее, чем «Снести»)
      const only = R.roadDrag.length === 1 ? R.roadDrag[0] : null;
      if (only && inb(only[0], only[1]) && (World.road[idx(only[0], only[1])] || Game.roadSites.has(idx(only[0], only[1])))) {
        eraseAt(only); R.roadDrag = null; Input.roadStart = null; Input.fieldMode = null; return;
      }
      placeRoadDrag(R.roadDrag);
      R.roadDrag = null;
      Input.roadStart = null;
    }
  });

  document.getElementById('zoom-in').onclick = () => zoomStep(1);
  document.getElementById('zoom-out').onclick = () => zoomStep(-1);

  // колесо мыши — шаг за щелчок; тачпад шлёт много мелких событий — копим до порога
  let wheelAcc = 0;
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const d = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
    wheelAcc += d;
    if (Math.abs(wheelAcc) < 50) return;
    zoomStep(wheelAcc < 0 ? 1 : -1, e.offsetX, e.offsetY);
    wheelAcc = 0;
  }, { passive: false });

  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    Input.keys.add(e.key === 'Shift' ? 'Shift' : e.code);
    if (e.code === 'Escape') { setTool(null); selectBuilding(null); }
    if (e.code === 'Space') { e.preventDefault(); togglePause(); }
    const spd = (e.shiftKey && e.code.match(/^Digit([1-4])$/)) || e.code.match(/^Numpad([1-4])$/);   // Shift+1…4 и цифры справа: ×0,5 / ×1 / ×2 / ×3
    if (spd) { e.preventDefault(); pickSpeed(+spd[1] - 1); }
    if (e.code === 'KeyR') setTool(Game.tool && Game.tool.kind === 'road' ? null : { kind: 'road' });
    if (e.code === 'KeyT') rotateTool();
    if (e.code === 'Equal' || e.code === 'NumpadAdd') zoomStep(1);
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') zoomStep(-1);
    if (e.code === 'Delete') setTool({ kind: 'erase' });
    if (e.code === 'KeyS' && e.ctrlKey) { e.preventDefault(); if (saveGame('manual')) toast('Игра сохранена'); }
    if (e.code === 'F9') { e.preventDefault(); if (loadGame('manual')) { toast('Игра загружена'); updateUI(true); } }
    if (e.code === 'BracketLeft' && Game.selected && !Game.selected.isRoad) cycleBuilding(-1);
    if (e.code === 'BracketRight' && Game.selected && !Game.selected.isRoad) cycleBuilding(1);
    if (e.code === 'KeyP' && Game.selected && Game.selected.state === 'done') { Game.selected.paused = !Game.selected.paused; updateUI(true); }
    if (e.code === 'KeyB' && Game.selected && !Game.selected.isRoad && Game.selected.state === 'done' && (Game.selected.def.inputs || Game.selected.isStore())) { toggleDeliver(Game.selected); updateUI(true); }
    const dig = e.code.match(/^Digit([1-5])$/);
    if (dig && !e.ctrlKey && !e.shiftKey) openBuildCat(visibleCats()[+dig[1] - 1]);
  });
  window.addEventListener('keyup', e => Input.keys.delete(e.key === 'Shift' ? 'Shift' : e.code));
  window.addEventListener('blur', () => Input.keys.clear());
  window.addEventListener('resize', resize);

  // миникарта: клик/перетаскивание переносит камеру
  const mm = document.getElementById('minimap');
  const mmMove = e => {
    const r = mm.getBoundingClientRect();
    centerOn((e.clientX - r.left) / r.width * MAP_W * TILE, (e.clientY - r.top) / r.height * MAP_H * TILE);
  };
  mm.addEventListener('pointerdown', e => {
    e.preventDefault();
    mmMove(e);
    const mv = ev => mmMove(ev);
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  });
}

// Повернуть строящееся здание по кругу: вход на юг → на восток → на запад
function rotateTool() {
  const t = Game.tool;
  if (!t || t.kind !== 'build') return;
  if (BUILDINGS[t.type].noRotate) { toast('Это здание не поворачивается'); return; }
  const rs = BUILDINGS[t.type].rots;
  if (rs) { t.rot = rs[(rs.indexOf(t.rot || 0) + 1) % rs.length]; toast(t.rot === 3 ? 'Вход сзади (на север)' : 'Вход спереди (на юг)'); return; }
  t.rot = ((t.rot || 0) + 1) % 3;
  UI.lastRot = t.rot;
  toast(['Вход спереди (на юг)', 'Вход справа (на восток)', 'Вход слева (на запад)'][t.rot]);
}

// Перейти к следующему зданию того же типа
function cycleBuilding(dir) {
  const cur = Game.selected;
  const list = Game.buildings.filter(b => b.type === cur.type);
  if (list.length < 2) return;
  const k = list.indexOf(cur);
  const nb = list[(k + dir + list.length) % list.length];
  selectBuilding(nb);
  centerOn((nb.x + nb.w / 2) * TILE, (nb.y + nb.h / 2) * TILE);
}

function scrollByKeys(dt) {
  const k = Input.keys, sp = 700 * dt / camScale();
  if (k.has('KeyA') || k.has('ArrowLeft')) R.cam.x -= sp;
  if (k.has('KeyD') || k.has('ArrowRight')) R.cam.x += sp;
  if (k.has('KeyW') || k.has('ArrowUp')) R.cam.y -= sp;
  if ((k.has('KeyS') && !k.has('ControlLeft')) || k.has('ArrowDown')) R.cam.y += sp;
  clampCam();
}

// ---------- Цикл ----------

let lastT = performance.now(), acc = 0, uiT = 0, miniT = 0, autoT = 0;

function frame(now) {
  requestAnimationFrame(frame);   // сразу: исключение ниже не должно навсегда останавливать цикл (чёрный экран/зависание)
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  scrollByKeys(dt);
  statsTick(dt);
  const s0 = performance.now();
  if (!Game.paused) {
    acc += dt * Game.speed;
    let steps = 0;
    // ошибка в одном шаге не должна замораживать всю игру
    while (acc >= SIM_DT && steps < 40) { try { step(SIM_DT); } catch (e) { if (!frame.errT || Game.time - frame.errT > 5) { console.error(e); frame.errT = Game.time; } } acc -= SIM_DT; steps++; }
    if (steps >= 40) acc = 0;
    autoT += dt;
    if (autoT > 30 && !Game.stress) { autoT = 0; saveGame('auto'); }   // автосохранение каждые 30 секунд; тестовую карту не сохраняем
  }
  try {
    perfFrame(dt * 1000, performance.now() - s0);
    render();
    uiT += dt; miniT += dt;
    if (uiT > 0.25) { updateUI(); uiT = 0; }
    if (miniT > 1) { updateMinimapBase(); miniT = 0; }
    drawMinimap();
  } catch (e) { if (!frame.errR || now - frame.errR > 5000) { console.error(e); frame.errR = now; } }
}

window.addEventListener('load', () => {
  // даём браузеру показать экран загрузки, затем строим мир
  setTimeout(startGame, 30);
});

function startGame() {
  const canvas = document.getElementById('game');
  initSprites();
  initRender(canvas);
  initMinimap(document.getElementById('minimap'));
  resize();
  const seed = (Math.random() * 1e9) | 0;
  setupStart(seed);
  buildTerrain(seed);
  document.getElementById('loading').classList.add('hidden');
  initUI();
  initInput();
  initMobile();
  initLayout();
  resize();
  statsStart();
  initTutorial();
  initMusic();
  initSfx();
  updateMinimapBase();
  updateUI(true);
  requestAnimationFrame(frame);
}

// Телефонный браузер может внезапно закрыть вкладку: сохраняемся при сворачивании и закрытии
{
  const saveOnLeave = () => {
    if (Game.stress || !Game.units || !Game.units.length) return;
    if (typeof StartMenu !== 'undefined' && StartMenu.open) return;       // не затираем автосохранение, пока на заставке
    saveGame('auto');
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveOnLeave(); });
  window.addEventListener('pagehide', saveOnLeave);
}
