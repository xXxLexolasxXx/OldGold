// Замер на «телефоне»: экран 386×837 @3, сенсор, Android Chrome, процессор замедлен в CPU раз (по умолчанию 4).
// Видеокарта — настоящая с ПК (её не замедлить), поэтому смотрим прежде всего время процессора: render и шаг.
// node tools/mobileperf.js <save.json> <порт> [<порт> ...]   окружение: CPU=4, WARM=10000, Z=как в игре, LAPS=2
const fs = require('fs');
const { chromium } = require('D:/для игры/feod/tools/browsers/node_modules/playwright-core');
const SAVE = process.argv[2], PORTS = process.argv.slice(3);
const CPU = +(process.env.CPU || 4), WARM = +(process.env.WARM || 10000), LAPS = +(process.env.LAPS || 2);
const UA = 'Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36';
async function measure(br, port) {
  const raw = fs.readFileSync(SAVE, 'utf8');
  const ctx = await br.newContext({ viewport: { width: 386, height: 837 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: UA });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(([raw]) => { try { if (!sessionStorage.getItem('zp')) { localStorage.clear(); localStorage.setItem('feod.save.manual', raw); localStorage.setItem('feod.save.manual.meta', JSON.stringify({ at: Date.now(), time: 6000, people: 34 })); sessionStorage.setItem('zp', '1'); } } catch (e) { } }, [raw]);
  await pg.goto(`http://localhost:${port}/index.html`);
  await pg.waitForFunction(() => { const b = document.querySelector('#start-menu [data-sm="continue"]'); return b && b.offsetWidth > 0 && !b.disabled; }, null, { timeout: 200000 });
  await pg.waitForTimeout(800);
  await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.offsetWidth && b.textContent.trim() === 'Понятно'); if (b) b.click(); });
  await pg.evaluate(() => document.querySelector('#start-menu [data-sm="continue"]').click());
  await pg.waitForFunction(() => Game.buildings.length > 0 && !document.querySelector('#start-menu')?.offsetWidth, null, { timeout: 90000 });
  const cdp = await ctx.newCDPSession(pg);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await pg.evaluate(z => { Game.speed = 1; if (z) R.cam.z = +z; const b = Game.buildings.find(b => b.type === 'bonfire') || Game.buildings[0]; centerOn((b.x + 2) * TILE, (b.y + 2) * TILE); }, process.env.Z || '');
  await pg.waitForTimeout(WARM);
  if (process.env.PROF) {   // PROF=файл: профиль процессора 5 с, своё время и цепочки вызовов самых тяжёлых
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 }); await cdp.send('Profiler.start');
    await pg.waitForTimeout(5000);
    const { profile } = await cdp.send('Profiler.stop');
    fs.writeFileSync(process.env.PROF, JSON.stringify(profile));
    const byId = new Map(profile.nodes.map(n => [n.id, n])), par = new Map();
    for (const n of profile.nodes) for (const c of n.children || []) par.set(c, n.id);
    const self = {}, chain = {};
    for (let i = 0; i < profile.samples.length; i++) {
      const n = byId.get(profile.samples[i]), cf = n.callFrame, dt = profile.timeDeltas[i] || 0;
      const k = (cf.functionName || '(anon)') + ' ' + cf.url.split('/').pop() + ':' + (cf.lineNumber + 1);
      self[k] = (self[k] || 0) + dt;
      let q = par.get(n.id), ch = [];
      while (q && ch.length < 5) { const m = byId.get(q).callFrame; ch.push((m.functionName || '?') + '@' + m.url.split('/').pop() + ':' + (m.lineNumber + 1)); q = par.get(q); }
      const ck = k + ' < ' + ch.join(' < '); chain[ck] = (chain[ck] || 0) + dt;
    }
    const tot = Object.values(self).reduce((a, b) => a + b, 0);
    console.log('--- своё время');
    for (const [k, v] of Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 18)) console.log((v / tot * 100).toFixed(1).padStart(5) + '% ' + k);
    console.log('--- цепочки');
    for (const [k, v] of Object.entries(chain).sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log((v / tot * 100).toFixed(1).padStart(5) + '% ' + k);
  }
  if (process.env.LAYERS) {
    const L = await pg.evaluate(async () => {
      const names = ['terrDraw', 'drawWaterSparkles', 'nightGroundDraw', 'drawBuilding', 'drawUnit', 'drawCreatureAt', 'drawTree', 'drawRock', 'drawMountain', 'drawStreetObj', 'drawPile', 'drawCrystalTile', 'drawEnt',
        'weatherDrawList', 'festDrawList', 'faunaDrawList', 'fauna2DrawList', 'beastsDrawList', 'seaLifeDrawList', 'chestsDrawList', 'fairyDrawList', 'fairy2DrawList', 'drawSkeletons', 'defDrawList', 'golemDrawList', 'tradeDrawList',
        'drawGamesAir', 'drawOwls', 'drawBats', 'drawGhosts', 'drawFloaters', 'drawClouds', 'drawDusk', 'drawNight', 'nightGroundGlow', 'oceanGlow', 'drawNightFx', 'drawFireflies', 'drawWeather', 'campFogDraw', 'drawStatusIcons', 'drawOverlay',
        'drawMinimap', 'updateMinimapBase', 'updateUI', 'sfxTick', 'musicTick', 'step', 'render', 'spriteQueueRun', 'rowcPush', 'hpBarsDraw', 'drawHpBars', 'snowDraw', 'drawSnow', 'naFrame', 'fzLive', 'wildSprite', 'neuDraw', 'fzDrawHi', 'blitFine', 'personSprite', 'creatureSprite', 'entSprite', 'ghostPxFrame', 'reaperPxFrame', 'toPixelArt', 'pxSprite', 'buildingSprite', 'beDraw', 'fyBlit'];
      const T = {}, N = {}, MX = {}, saved = {};
      for (const n of names) { const f = window[n]; if (typeof f !== 'function') continue; saved[n] = f; window[n] = function () { const t = performance.now(); try { return f.apply(this, arguments); } finally { const d = performance.now() - t; T[n] = (T[n] || 0) + d; N[n] = (N[n] || 0) + 1; if (d > (MX[n] || 0)) MX[n] = d; } }; }
      let fr = 0; const t0 = performance.now();
      await new Promise(res => { const f = () => { fr++; if (performance.now() - t0 < 6000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
      for (const n in saved) window[n] = saved[n];
      return { fr, rows: Object.keys(T).map(n => [n, +(T[n] / fr).toFixed(2), Math.round(N[n] / fr), Math.round(MX[n])]).sort((a, b) => b[1] - a[1]) };
    });
    console.log('--- слои, мс за кадр (кадров ' + L.fr + ' за 6 с), вызовов за кадр');
    if (process.env.BYMAX) L.rows.sort((a, b) => b[3] - a[3]);
    for (const [n, ms, c, mx] of L.rows.slice(0, 26)) console.log('  ' + n.padEnd(20) + String(ms).padStart(7) + '  ×' + c + '  макс ' + mx);
  }
  const r = await pg.evaluate(async () => {
    // время render и шага симуляции — обёрткой (на месте, без чтения пикселей)
    const acc = { r: [], s: [] };
    const rr = window.render; window.render = function () { const t = performance.now(); try { return rr.apply(this, arguments); } finally { acc.r.push(performance.now() - t); } };
    const stepName = ['simStep', 'step', 'update', 'tick'].find(n => typeof window[n] === 'function');
    const ss = window[stepName]; if (ss) window[stepName] = function () { const t = performance.now(); try { return ss.apply(this, arguments); } finally { acc.s.push(performance.now() - t); } };
    const iv = []; let last = performance.now(); const t0 = last;
    await new Promise(res => { const f = () => { const n = performance.now(); iv.push(n - last); last = n; if (n - t0 < 6000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    window.render = rr; if (ss) window[stepName] = ss;
    const med = a => { if (!a.length) return 0; a = a.slice().sort((x, y) => x - y); return +a[a.length >> 1].toFixed(1); };
    const p90 = a => { if (!a.length) return 0; a = a.slice().sort((x, y) => x - y); return +a[Math.floor(a.length * 0.9)].toFixed(1); };
    const sum = a => a.reduce((x, y) => x + y, 0);
    return { fps: +(iv.length / 6).toFixed(1), worst: Math.round(Math.max(...iv)), render: med(acc.r), render90: p90(acc.r), stepPerSec: Math.round(sum(acc.s) / 6), stepName, z: R.cam.z, dev: +devScale().toFixed(2), eco: Fps.eco, canvas: R.canvas.width + 'x' + R.canvas.height, fine: typeof PX_FINE !== 'undefined' ? PX_FINE : '?', units: Game.units.length, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : 0 };
  });
  await ctx.close();
  return { ...r, errs: errs.length };
}
(async () => {
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  for (let lap = 0; lap < LAPS; lap++) for (const p of PORTS) {
    const r = await measure(br, p);
    console.log(`порт ${p} круг ${lap + 1}: ${r.fps} к/с, худший ${r.worst} мс, render ${r.render} (p90 ${r.render90}) мс, шаг ${r.stepPerSec} мс/с [${r.stepName}] | z=${r.z} dev=${r.dev} eco=${r.eco} холст ${r.canvas} fine=${r.fine} жит ${r.units} куча ${r.heap} МБ ошибок ${r.errs}`);
  }
  await br.close();
})().catch(e => { console.error(e); process.exit(1); });
