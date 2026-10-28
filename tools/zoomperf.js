// Замер отрисовки при отдалении камеры на сейве: время render() по зумам, разбивка по слоям, профиль CPU.
// node tools/zoomperf.js <save.json> [порт=8811] [выходная папка] — сервер игры из этого worktree должен быть запущен.
// Параметры окружения: SHOT=1 — снимки кадра на каждом зуме, PROF=1 — профиль CPU на минимальном зуме.
const path = require('path'), fs = require('fs');
const { chromium } = require('D:/для игры/feod/tools/browsers/node_modules/playwright-core');
const SAVE = process.argv[2], PORT = process.argv[3] || 8811, OUT = process.argv[4] || path.join(__dirname, 'zoomperf-out');
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const raw = fs.readFileSync(SAVE, 'utf8');
  const meta = JSON.stringify({ at: Date.now(), time: 6000, people: 34, df: 'normal', gv: '0.11.45' });
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-gpu', '--ignore-gpu-blocklist'] });
  const pg = await br.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = [];
  pg.on('pageerror', e => errs.push('pageerror ' + e.message));
  await pg.addInitScript(([raw, meta]) => { try { if (!sessionStorage.getItem('zp')) { localStorage.clear(); localStorage.setItem('feod.save.manual', raw); localStorage.setItem('feod.save.manual.meta', meta); localStorage.setItem('feod.eco', '0'); sessionStorage.setItem('zp', '1'); } } catch (e) { } }, [raw, meta]);
  await pg.goto(`http://localhost:${PORT}/index.html`);
  await pg.waitForFunction(() => { const b = document.querySelector('#start-menu [data-sm="continue"]'); return b && b.offsetWidth > 0 && !b.disabled; }, null, { timeout: 150000 });
  await pg.waitForTimeout(1000);
  await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.offsetWidth && b.textContent.trim() === 'Понятно'); if (b) b.click(); });
  await pg.click('#start-menu [data-sm="continue"]');
  await pg.waitForFunction(() => typeof Game !== 'undefined' && Game.buildings.length > 0 && !document.querySelector('#start-menu')?.offsetWidth, null, { timeout: 60000 });
  await pg.waitForTimeout(2500);
  for (let i = 0; i < 4; i++) { const hit = await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.offsetWidth && /Понятно|Закрыть|Пропустить|Продолжить/.test(b.textContent)); if (b) { b.click(); return true; } return false; }); if (!hit) break; await pg.waitForTimeout(500); }
  const info = await pg.evaluate(() => ({ units: Game.units.length, bld: Game.buildings.length, map: MAP_W + 'x' + MAP_H, dpr: devicePixelRatio, canvas: R.canvas.width + 'x' + R.canvas.height, eco: Fps.eco, ents: (Game.ents || []).length }));
  console.log(JSON.stringify(info));
  // разбивка: оборачиваем крупные функции кадра счётчиком времени
  await pg.evaluate(() => {
    window.ZP = { t: {}, n: {} };
    const wrap = name => { const f = window[name]; if (typeof f !== 'function') return; window[name] = function () { const t = performance.now(); try { return f.apply(this, arguments); } finally { const d = performance.now() - t; ZP.t[name] = (ZP.t[name] || 0) + d; ZP.n[name] = (ZP.n[name] || 0) + 1; } }; };
    for (const n of ['terrDraw', 'drawWaterSparkles', 'nightGroundDraw', 'drawTree', 'drawRock', 'drawMountain', 'drawBuilding', 'drawUnit', 'drawCreatureAt', 'drawPile', 'drawStreetObj', 'drawStump', 'drawLog', 'drawCrystalTile', 'drawEnt', 'drawFort',
      'weatherDrawList', 'festDrawList', 'faunaDrawList', 'fauna2DrawList', 'beastsDrawList', 'seaLifeDrawList', 'chestsDrawList', 'fairyDrawList', 'fairy2DrawList', 'drawSkeletons', 'defDrawList', 'golemDrawList', 'tradeDrawList',
      'drawGamesAir', 'drawOwls', 'drawBats', 'drawGhosts', 'drawFloaters', 'drawClouds', 'drawDusk', 'drawNight', 'nightGroundGlow', 'oceanGlow', 'drawNightFx', 'drawFireflies', 'drawWeather', 'campFogDraw', 'drawStatusIcons', 'drawOverlay', 'drawGamesGround', 'drawRoadSite',
      'drawMinimap', 'drawMinimapUnits', 'step', 'tick', 'update'])
      wrap(n);
  });
  const res = {};
  for (const z of [2, 1, 0.5]) {
    await pg.evaluate(z => { R.cam.z = z; const b = Game.buildings.find(b => b.type === 'bonfire') || Game.buildings[0]; centerOn((b.x + 2) * TILE, (b.y + 2) * TILE); }, z);
    await pg.waitForTimeout(1500);
    const r = await pg.evaluate(async () => {
      ZP.t = {}; ZP.n = {};
      // время одного render() отдельно (синхронно, без шага симуляции) + реальные кадры за 3 с
      const rt = [];
      for (let k = 0; k < 20; k++) { const t = performance.now(); render(); rt.push(performance.now() - t); }
      const parts = Object.entries(ZP.t).map(([k, v]) => [k, +(v / 20).toFixed(2), Math.round(ZP.n[k] / 20)]).sort((a, b) => b[1] - a[1]).slice(0, 18);
      ZP.t = {}; ZP.n = {};
      let fr = 0; const t0 = performance.now();
      await new Promise(res => { const f = () => { fr++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
      rt.sort((a, b) => a - b);
      return { renderMedian: +rt[10].toFixed(1), renderMin: +rt[0].toFixed(1), fps: +(fr / 3).toFixed(1), parts, view: Math.round(R.canvas.width / devScale() / TILE) + 'x' + Math.round(R.canvas.height / devScale() / TILE) + ' клеток' };
    });
    res[z] = r;
    console.log(`z=${z}: render ${r.renderMedian} мс (мин ${r.renderMin}), fps ${r.fps}, вид ${r.view}`);
    for (const p of r.parts) console.log(`   ${p[0].padEnd(18)} ${String(p[1]).padStart(7)} мс  ×${p[2]}`);
    if (process.env.SHOT === '1') await pg.screenshot({ path: path.join(OUT, `z${z}.png`) });
  }
  if (process.env.PROF === '1') {
    const cdp = await pg.context().newCDPSession(pg);
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
    await pg.evaluate(() => { R.cam.z = 0.5; });
    await cdp.send('Profiler.start');
    await pg.evaluate(() => { for (let k = 0; k < 30; k++) render(); });
    const { profile } = await cdp.send('Profiler.stop');
    // самостоятельное время по функциям
    const self = {}, byId = new Map(profile.nodes.map(n => [n.id, n]));
    const dt = profile.timeDeltas; const cnt = {};
    for (let i = 0; i < profile.samples.length; i++) cnt[profile.samples[i]] = (cnt[profile.samples[i]] || 0) + (dt[i] || 0);
    for (const [id, us] of Object.entries(cnt)) { const n = byId.get(+id), cf = n.callFrame; const k = `${cf.functionName || '(anon)'} ${cf.url.split('/').pop()}:${cf.lineNumber + 1}`; self[k] = (self[k] || 0) + us; }
    const tot = Object.values(self).reduce((a, b) => a + b, 0);
    console.log('профиль z=0.5, 30 кадров, своё время:');
    for (const [k, us] of Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(`   ${(us / 1000 / 30).toFixed(2).padStart(7)} мс/кадр ${(us / tot * 100).toFixed(1).padStart(5)}%  ${k}`);
    fs.writeFileSync(path.join(OUT, 'z05.cpuprofile'), JSON.stringify(profile));
  }
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ info, res }, null, 1));
  console.log(errs.length ? errs.slice(0, 10).join('\n') : 'ошибок нет');
  await br.close();
})().catch(e => { console.error(e); process.exit(1); });
