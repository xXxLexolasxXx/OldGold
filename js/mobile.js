'use strict';
// Телефон: шторка вместо левой колонки и сенсорное управление картой.
// Один палец — тянуть карту (или вести дорогу / сносить), два — щипок для масштаба,
// касание — выбрать здание; со зданием в руке первое касание показывает место,
// второе (или ✓) — ставит.

const Mobile = { on: false, touchTool: null };

function detectMobile() {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 560;
  return small || (coarse && window.innerWidth < 1100);
}

function applyMobile() {
  const on = detectMobile();
  if (on === Mobile.on) return;
  Mobile.on = on;
  document.body.classList.toggle('mobile', on);
  if (!on) document.body.classList.remove('sheet-tab', 'sheet-info', 'show-mm');
  mobileTool(Game.tool);
}

// Шторка: 'tab' — содержимое вкладки, 'info' — окно здания, null — свернуть.
function mobileSheet(kind) {
  if (!Mobile.on) return;
  const cl = document.body.classList;
  cl.toggle('sheet-tab', kind === 'tab');
  cl.toggle('sheet-info', kind === 'info');
  document.querySelectorAll('#tabs .tab-btn').forEach(b => b.classList.toggle('active', kind === 'tab' && b.dataset.tab === UI.tab));
  if (kind) cl.remove('show-mm');
  // размер карты не меняется — шторка лежит поверх
}

function mobileTab(name) {
  if (document.body.classList.contains('sheet-tab') && UI.tab === name) { mobileSheet(null); return; }
  openTab(name);
  mobileSheet('tab');
}

// Подсказка внизу, пока в руке инструмент
function mobileTool(tool) {
  const bar = document.getElementById('mtool');
  if (!bar) return;
  if (!Mobile.on || !tool) { bar.classList.add('hidden'); return; }
  mobileSheet(null);
  const text = document.getElementById('mtool-text');
  const build = tool.kind === 'build';
  if (build) text.textContent = `${BUILDINGS[tool.type].name}: коснитесь места`;
  else if (tool.kind === 'road') text.textContent = 'Дорога: ведите пальцем';
  else text.textContent = 'Снос: коснитесь';
  document.getElementById('mtool-ok').style.display = build ? '' : 'none';
  document.getElementById('mtool-rot').style.display = build && !BUILDINGS[tool.type].noRotate ? '' : 'none';
  bar.classList.remove('hidden');
  if (build) R.hover = null;
}

function initMobile() {
  applyMobile();
  window.addEventListener('resize', applyMobile);
  document.getElementById('sheet-close').onclick = () => mobileSheet(null);
  document.getElementById('mm-btn').onclick = () => {
    document.body.classList.toggle('show-mm');
    if (document.body.classList.contains('show-mm')) mobileSheet(null);
  };
  document.getElementById('mtool-x').onclick = () => setTool(null);
  document.getElementById('mtool-rot').onclick = () => rotateTool();
  document.getElementById('mtool-ok').onclick = () => {
    if (R.hover) onLeftClickTile(R.hover);
    else toast('Сначала коснитесь места на карте');
  };
  initTouch();
  // первый запуск на телефоне — сразу показать, как управлять
  if (Mobile.on) {
    let seen = false;
    try { seen = localStorage.getItem('oldgold-mhelp') === '1'; localStorage.setItem('oldgold-mhelp', '1'); } catch (e) {}
    if (!seen) document.getElementById('help').classList.remove('hidden');
  }
}

// ---------- Касания ----------

function initTouch() {
  const cv = R.canvas;
  const T = { mode: null, sx: 0, sy: 0, cx: 0, cy: 0, moved: false, tile: null, pinch: null };
  const local = t => { const r = cv.getBoundingClientRect(); return [t.clientX - r.left, t.clientY - r.top]; };
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  const startPinch = e => {
    const a = local(e.touches[0]), b = local(e.touches[1]);
    const m = mid(a, b);
    T.mode = 'pinch';
    T.pinch = { d: dist(a, b), z: R.cam.z, w: screenToWorld(m[0], m[1]) };
    R.roadDrag = null; Input.roadStart = null;
  };

  cv.addEventListener('touchstart', e => {
    e.preventDefault();
    if (e.touches.length >= 2) { startPinch(e); return; }
    const p = local(e.touches[0]);
    const t = screenToTile(p[0], p[1]);
    Object.assign(T, { sx: p[0], sy: p[1], cx: R.cam.x, cy: R.cam.y, moved: false, tile: t, mode: 'one' });
    const tool = Game.tool;
    if (tool && tool.kind === 'road') { T.mode = 'road'; Input.roadStart = t; R.roadDrag = [t]; R.hover = t; }
    else if (tool && tool.kind === 'erase') { T.mode = 'erase'; Input.lastEraseTile = t.join(); }
  }, { passive: false });

  cv.addEventListener('touchmove', e => {
    e.preventDefault();
    if (T.mode === 'pinch' && e.touches.length >= 2) {
      const a = local(e.touches[0]), b = local(e.touches[1]);
      const m = mid(a, b);
      // масштаб ступенями: ближайший из ZOOMS к начальному × растяжение пальцев
      const want = T.pinch.z * dist(a, b) / T.pinch.d;
      let best = ZOOMS[0];
      for (const z of ZOOMS) if (Math.abs(Math.log(z / want)) < Math.abs(Math.log(best / want))) best = z;
      R.cam.z = best;
      const s = camScale();
      R.cam.x = T.pinch.w[0] - m[0] / s;
      R.cam.y = T.pinch.w[1] - m[1] / s;
      clampCam();
      return;
    }
    if (!T.mode || T.mode === 'pinch') return;
    const p = local(e.touches[0]);
    const dx = p[0] - T.sx, dy = p[1] - T.sy;
    if (Math.abs(dx) + Math.abs(dy) > 10) T.moved = true;
    const t = screenToTile(p[0], p[1]);
    if (T.mode === 'road') { R.roadDrag = lineCells(Input.roadStart, t); R.hover = t; return; }
    if (T.mode === 'erase') {
      if (T.moved && t.join() !== Input.lastEraseTile) {
        Input.lastEraseTile = t.join();
        if (inb(t[0], t[1]) && !World.bmap[idx(t[0], t[1])]) eraseAt(t);
      }
      return;
    }
    if (T.moved) {
      const s = camScale();
      R.cam.x = T.cx - dx / s;
      R.cam.y = T.cy - dy / s;
      clampCam();
    }
  }, { passive: false });

  const end = e => {
    e.preventDefault();
    if (e.touches.length >= 2) { startPinch(e); return; }
    if (e.touches.length === 1) {
      // после щипка остался один палец — продолжаем просто тянуть карту
      const p = local(e.touches[0]);
      Object.assign(T, { sx: p[0], sy: p[1], cx: R.cam.x, cy: R.cam.y, moved: true, mode: 'one' });
      return;
    }
    const mode = T.mode;
    T.mode = null;
    if (mode === 'road' && R.roadDrag) {
      let n = 0;
      for (const [x, y] of R.roadDrag) if (placeRoadSite(x, y)) n++;
      if (!n && R.roadDrag.length) toast('Здесь нельзя проложить дорогу');
      R.roadDrag = null; Input.roadStart = null;
      return;
    }
    if (mode === 'erase' && !T.moved) { eraseAt(T.tile); return; }
    if (mode === 'one' && !T.moved) tapTile(T.tile);
  };
  cv.addEventListener('touchend', end, { passive: false });
  cv.addEventListener('touchcancel', end, { passive: false });
}

function tapTile(t) {
  const tool = Game.tool;
  if (tool && tool.kind === 'build') {
    // первое касание — примерка, второе в то же место — постройка
    if (R.hover && R.hover[0] === t[0] && R.hover[1] === t[1]) onLeftClickTile(t);
    else R.hover = t;
    return;
  }
  R.hover = null;
  onLeftClickTile(t);
}
