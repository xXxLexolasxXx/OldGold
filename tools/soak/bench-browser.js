// Замер отрисовки на большой деревне прямо в браузере. Вставить в консоль на странице игры (или выполнить через eval):
//   await (await fetch('/tools/soak/bench-browser.js')).text().then(eval); await BB.build(); BB.render()
// build() — бот harness.js строит деревню (~240 жителей, ~120 зданий) за 900 игровых секунд, кусками, не вешая вкладку;
// render() — время JS отрисовки на нескольких масштабах и раскладка по рисующим функциям (включительно).
window.BB = {
  async build(seed = 3, secs = 900) {
    const src = await (await fetch('/tools/soak/harness.js')).text();
    (0, eval)(src.replace('var H =', 'window.H ='));
    H.init(seed);   // Math.random остаётся с зерном — деревня одинаковая от прогона к прогону
    buildTerrain(Game.seed); updateMinimapBase();
    document.getElementById('loading').classList.add('hidden');
    if (typeof StartMenu !== 'undefined') StartMenu.open = false;
    Game.paused = true; Game.stress = true;   // без автосохранения тестовой деревни
    const grow = () => {
      for (const st of Game.buildings) if (st.isStore() && st.state === 'done') for (const g of GOOD_KEYS) if ((st.stock[g] || 0) < 60) st.stock[g] = 60;
      if (Game.buildings.length < 130) for (let i = 0; i < 3; i++) H.tryBuild();
      H.trainNeeded();
      const st = Game.buildings.find(b => b.type === 'storehouse');
      for (let i = 0; i < 6 && Game.units.length < 220 && st; i++) { const s = randomFreeNear(st.doorX, st.doorY + 1, 1, 8); if (s) spawnUnit('serf', s[0], s[1]); }
    };
    const n = Math.round(secs / SIM_DT);
    for (let i = 0; i < n; i++) {
      try { step(SIM_DT); } catch (e) { /* только скорость */ }
      if (i % 60 === 0) { try { grow(); } catch (e) { /* */ } }
      if (i % 600 === 0) await new Promise(r => setTimeout(r, 0));
    }
    resize(); BB.center();
    return { units: Game.units.length, bld: Game.buildings.length };
  },
  // одна и та же деревня для сравнения версий кода: build() → save(), после перезагрузки страницы — load()
  save() { return saveGame('bench'); },
  load() {
    if (typeof StartMenu !== 'undefined') StartMenu.open = false;
    if (!loadGame('bench')) return false;
    buildTerrain(Game.seed); updateMinimapBase();
    document.getElementById('loading').classList.add('hidden');
    Game.paused = true; Game.stress = true;
    resize(); BB.center();
    for (let i = 0; i < 40; i++) step(SIM_DT);   // звери и прочая несохраняемая живность успевают появиться
    return { units: Game.units.length, bld: Game.buildings.length, piles: Game.piles.size };
  },
  // Программный холст: в скрытой вкладке GPU-время «плавает» в разы, а здесь отрисовка синхронная и повторяемая.
  // ops() — сколько команд холста уходит за кадр (второй, от GPU не зависящий показатель)
  sw() { const cv = document.createElement('canvas'); cv.width = R.canvas.width; cv.height = R.canvas.height; R.ctx = cv.getContext('2d', { willReadFrequently: true }); },
  ops() {
    const c = R.ctx, P = CanvasRenderingContext2D.prototype, n = {}, keep = {};
    for (const k of ['fillRect', 'drawImage', 'fill', 'stroke', 'strokeRect', 'arc', 'ellipse', 'createLinearGradient', 'createRadialGradient', 'save', 'fillText']) {
      keep[k] = P[k]; P[k] = function () { n[k] = (n[k] || 0) + 1; return keep[k].apply(this, arguments); };
    }
    try { render(); } finally { for (const k in keep) P[k] = keep[k]; }
    n.total = Object.values(n).reduce((a, b) => a + b, 0);
    return n;
  },
  // полный замер на программном холсте: медиана кадра и число команд по масштабам
  full(zooms = [2, 1, 0.5]) {
    BB.sw();
    const o = {};
    for (const z of zooms) { BB.center(z); render(); render(); const m = BB.meas(8, () => render()); o['z' + z] = { med: m.med, avg: m.avg, ops: BB.ops().total }; }
    BB.center(2);
    return o;
  },
  // время создания всех спрайтов зданий заново (то, что делается при загрузке сохранения и в первых кадрах)
  sprites() {
    SPR.buildings = {};
    const s = performance.now();
    for (const t of Object.keys(BUILDINGS)) for (const rot of [0, 1]) for (const lv of [1, 2]) { try { buildingSprite(t, rot, lv); } catch (e) { /* не у всех есть поворот */ } }
    return Math.round(performance.now() - s);
  },
  center(z = 2) { const st = Game.buildings.find(b => b.type === 'storehouse'); R.cam.z = z; centerOn((st.x + 2) * TILE, (st.y + 2) * TILE); },
  meas(n, f) {
    const a = []; for (let i = 0; i < n; i++) { const s = performance.now(); f(); a.push(performance.now() - s); }
    a.sort((x, y) => x - y);
    return { avg: +(a.reduce((p, c) => p + c, 0) / n).toFixed(2), med: +a[n >> 1].toFixed(2), p95: +a[Math.floor(n * 0.95)].toFixed(2), max: +a[n - 1].toFixed(1) };
  },
  // раскладка: обёртки-таймеры на глобальные рисующие функции (внутренние вызовы учитываются и в родителе)
  split(n = 20) {
    const names = Object.getOwnPropertyNames(window).filter(k => /^(draw|terr|weatherDraw|festDraw|faunaDraw|fauna2Draw|beastsDraw|chestsDraw|fairyDraw|fairy2Draw|golemDraw|buildingSprite|unitSprite)/.test(k) && typeof window[k] === 'function');
    const T = {}, orig = {};
    for (const k of names) {
      const f = orig[k] = window[k];
      window[k] = function () { const s = performance.now(); try { return f.apply(this, arguments); } finally { T[k] = (T[k] || 0) + performance.now() - s; } };
    }
    try { for (let i = 0; i < n; i++) render(); } finally { for (const k of names) window[k] = orig[k]; }
    return Object.fromEntries(Object.entries(T).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => [k, +(v / n).toFixed(2)]));
  },
  render(zooms = [2, 1, 0.5]) {
    const out = {};
    for (const z of zooms) { BB.center(z); render(); out['z' + z] = BB.meas(20, () => render()); }
    BB.center(2);
    return out;
  },
};
