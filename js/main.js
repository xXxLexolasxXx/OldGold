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
  const types = ['storehouse', 'school', 'inn'].sort(() => rng() - 0.5);
  for (const type of types) {
    let best = null;
    for (let t = 0; t < 400 && !best; t++) {
      const wide = BUILDINGS[type].wideDoor;                  // склад — воротами прямо к улице
      const north = wide || rng() < 0.6;
      const rot = BUILDINGS[type].noRotate || wide ? 0 : north ? (rng() < 0.3 ? 1 : 0) : 1;   // к югу от улицы — входом вбок
      const d = bDims(type, rot);
      const gap = 2 + Math.floor(rng() * 3);                  // 2–4 клетки от улицы
      const x = cx - 11 + Math.floor(rng() * 20);
      const y = north ? sy - gap - d.h + (rot ? 1 : 0) : sy + gap;
      if (!fits(x, y, d.w, d.h)) continue;
      if (checkPlacement(type, x, y, rot)) continue;
      const door = [x + d.dx, y + d.dy];
      // дорожка от входа (и от второй створки ворот) к улице: прямо по вертикали
      const path = [];
      const step = door[1] < sy ? 1 : -1;
      let ok = true;
      const cols = wide ? [door[0], wideDoorTile(type, x, y, rot)[0]] : [door[0]];
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
    placed.push(placeBuilding(type, best.x, best.y, true, best.rot));
    roads.push(...best.path);
  }
  // улица от крайнего входа до крайнего, с запасом
  const xs = placed.map(b => b.doorX);
  const x0 = Math.min(cx - 9, ...xs) - 2, x1 = Math.max(cx + 4, ...xs) + 2;
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

function setupStart(seed) {
  resetGameState();
  Game.seed = seed;
  const { cx, cy } = genWorld(seed);
  const rng = mulberry32(seed ^ 0x5eed);
  let lay = layoutStart(rng, cx, cy);
  if (lay.placed.length < 3) {
    // не нашлось места — запасная прежняя раскладка
    for (const b of lay.placed) removeBuilding(b);
    World.road.fill(0);
    placeBuilding('storehouse', cx - 9, cy - 3, true);
    placeBuilding('school', cx - 4, cy - 3, true);
    placeBuilding('inn', cx, cy - 3, true);
    for (let x = cx - 10; x <= cx + 5; x++) setRoad(x, cy, true);
    lay = { sy: cy, x0: cx - 10, x1: cx + 5 };
  }
  const store = Game.buildings.find(b => b.type === 'storehouse');
  Object.assign(store.stock, { timber: 30, stone: 35, bread: 20, gold: 30, trunk: 4 });

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

  decorateAllRoads();          // фонари, скамейки и урны вдоль стартовых улиц
  spawnAnimals();
  centerOn(((x0 + x1) / 2) * TILE, (sy - 2) * TILE);
}

function newGame() {
  const seed = (Math.random() * 1e9) | 0;
  setupStart(seed);
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
  updateCritters(dt);
  streetTick(dt);
  Game.bumpT = (Game.bumpT || 0) + dt;
  if (Game.bumpT >= 0.25) { checkCollisions(); Game.bumpT = 0; }
  Game.dispatchT += dt;
  if (Game.dispatchT >= 0.4) { dispatchAll(); Game.dispatchT = 0; }
}

// ---------- Камера ----------

function resize() {
  const dpr = screenDPR();
  R.canvas.width = Math.round(R.canvas.clientWidth * dpr);
  R.canvas.height = Math.round(R.canvas.clientHeight * dpr);
  clampCam();
}

function viewSize() {
  const s = camScale();
  return [R.canvas.clientWidth / s, R.canvas.clientHeight / s];
}

function clampCam() {
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
  // Г-образная линия: сначала по горизонтали, затем по вертикали
  const cells = [];
  const sx = Math.sign(b[0] - a[0]), sy = Math.sign(b[1] - a[1]);
  let x = a[0], y = a[1];
  cells.push([x, y]);
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

function onLeftClickTile(t) {
  const tool = Game.tool;
  if (tool && tool.kind === 'build') {
    const d = bDims(tool.type, tool.rot || 0);
    const bx = t[0] - Math.floor(d.w / 2), by = t[1] - d.h + 1;
    const err = checkPlacement(tool.type, bx, by, d.rot);
    if (err) { toast(err); return; }
    placeBuilding(tool.type, bx, by, false, d.rot);
    track('place-1', 'Заложил первое здание');
    if (!Input.keys.has('Shift')) setTool(null);
    return;
  }
  if (tool && tool.kind === 'erase') { eraseAt(t); return; }
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
    onLeftClickTile(t);
  });

  window.addEventListener('mousemove', e => {
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
    Input.leftDown = false;
    if (Game.tool && Game.tool.kind === 'road' && R.roadDrag) {
      let n = 0;
      for (const [x, y] of R.roadDrag) if (placeRoadSite(x, y)) n++;
      if (!n && R.roadDrag.length) toast('Здесь нельзя проложить дорогу');
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
    if (e.code === 'Space') { e.preventDefault(); setSpeed(Game.paused ? Game.speed : 0); }
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
    const dig = e.code.match(/^Digit([1-5])$/);
    if (dig && !e.ctrlKey) openBuildCat(+dig[1] - 1);
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

// Повернуть строящееся здание: вход на юг или на восток
function rotateTool() {
  const t = Game.tool;
  if (!t || t.kind !== 'build') return;
  if (BUILDINGS[t.type].noRotate) { toast('Это здание не поворачивается'); return; }
  t.rot = t.rot ? 0 : 1;
  UI.lastRot = t.rot;
  toast(t.rot ? 'Вход сбоку (на восток)' : 'Вход спереди (на юг)');
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
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  scrollByKeys(dt);
  statsTick(dt);
  if (!Game.paused) {
    acc += dt * Game.speed;
    let steps = 0;
    while (acc >= SIM_DT && steps < 40) { step(SIM_DT); acc -= SIM_DT; steps++; }
    if (steps >= 40) acc = 0;
    autoT += dt;
    if (autoT > 120) { autoT = 0; saveGame('auto'); }
  }
  render();
  uiT += dt; miniT += dt;
  if (uiT > 0.25) { updateUI(); uiT = 0; }
  if (miniT > 1) { updateMinimapBase(); miniT = 0; }
  drawMinimap();
  requestAnimationFrame(frame);
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
  initMusic();
  updateMinimapBase();
  updateUI(true);
  requestAnimationFrame(frame);
}
