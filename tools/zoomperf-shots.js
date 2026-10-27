// Снимки кадра на сейве при разных масштабах (игра на паузе, без интерфейса) — сравнить картинку двух версий.
// node tools/zoomperf-shots.js <save.json> <порт> <папка>   (CLEAR=1 — без ночи и тумана)
const fs = require('fs'), path = require('path');
const { chromium } = require('D:/для игры/feod/tools/browsers/node_modules/playwright-core');
const [SAVE, PORT, OUT] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const raw = fs.readFileSync(SAVE, 'utf8');
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const pg = await br.newPage({ viewport: { width: 1920, height: 1080 } });
  await pg.addInitScript(([raw]) => { try { if (!sessionStorage.getItem('zp')) { localStorage.clear(); localStorage.setItem('feod.save.manual', raw); localStorage.setItem('feod.save.manual.meta', JSON.stringify({ at: Date.now(), time: 6000, people: 34 })); localStorage.setItem('feod.eco', '0'); sessionStorage.setItem('zp', '1'); } } catch (e) { } }, [raw]);
  await pg.goto(`http://localhost:${PORT}/index.html`);
  await pg.waitForFunction(() => { const b = document.querySelector('#start-menu [data-sm="continue"]'); return b && b.offsetWidth > 0 && !b.disabled; }, null, { timeout: 150000 });
  await pg.waitForTimeout(800);
  await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.offsetWidth && b.textContent.trim() === 'Понятно'); if (b) b.click(); });
  await pg.click('#start-menu [data-sm="continue"]');
  await pg.waitForFunction(() => Game.buildings.length > 0 && !document.querySelector('#start-menu')?.offsetWidth, null, { timeout: 60000 });
  await pg.evaluate(() => { Game.paused = true; });
  // CLEAR=1: без ночи, тумана, облаков и меток обучения — виден сам мир (в обеих версиях одинаково)
  if (process.env.CLEAR === '1') await pg.evaluate(() => { for (const n of ['drawNight', 'drawDusk', 'campFogDraw', 'nightGroundGlow', 'drawNightFx', 'drawClouds', 'drawFireflies', 'oceanGlow', 'drawTutMarks', 'drawWeather', 'drawStatusIcons']) if (typeof window[n] === 'function') window[n] = function () { }; });
  await pg.waitForTimeout(1500);
  // интерфейс прячем: сравниваем только мир
  await pg.evaluate(() => { for (const el of document.body.children) if (el !== R.canvas && !el.contains(R.canvas)) el.style.visibility = 'hidden'; let p = R.canvas.parentElement; while (p && p !== document.body) { for (const s of p.children) if (s !== R.canvas && !s.contains(R.canvas)) s.style.visibility = 'hidden'; p = p.parentElement; } });
  for (const z of [0.5, 1, 2]) {
    await pg.evaluate(z => { R.cam.z = z; const b = Game.buildings.find(b => b.type === 'bonfire') || Game.buildings[0]; centerOn((b.x + 2) * TILE, (b.y + 2) * TILE); }, z);
    await pg.waitForTimeout(6000);   // на паузе кэши (ряды, вода, кадры гномов) успевают достроиться
    await pg.screenshot({ path: path.join(OUT, `z${z}.png`) });
  }
  await br.close();
})().catch(e => { console.error(e); process.exit(1); });
