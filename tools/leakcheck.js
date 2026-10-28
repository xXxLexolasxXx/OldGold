// Долгая партия в браузере: игра на ×3, раз в 30 с — куча, кэши спрайтов и списки. Растёт без предела — утечка.
// node tools/leakcheck.js <save.json> <порт> [минут=6]   (окружение MOBILE=1 — экран телефона)
const fs = require('fs');
const { chromium } = require('D:/для игры/feod/tools/browsers/node_modules/playwright-core');
const [SAVE, PORT, MIN = 6] = process.argv.slice(2);
(async () => {
  const raw = fs.readFileSync(SAVE, 'utf8');
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--js-flags=--expose-gc', '--enable-precise-memory-info'] });
  const ctx = await br.newContext(process.env.MOBILE ? { viewport: { width: 386, height: 837 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1600, height: 900 } });
  const pg = await ctx.newPage();
  await pg.addInitScript(([raw]) => { if (!sessionStorage.getItem('zp')) { localStorage.clear(); localStorage.setItem('feod.save.manual', raw); localStorage.setItem('feod.save.manual.meta', '{"time":1}'); sessionStorage.setItem('zp', '1'); } }, [raw]);
  await pg.goto(`http://localhost:${PORT}/index.html`);
  await pg.waitForFunction(() => { const b = document.querySelector('#start-menu [data-sm="continue"]'); return b && b.offsetWidth > 0 && !b.disabled; }, null, { timeout: 200000 });
  await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.offsetWidth && b.textContent.trim() === 'Понятно'); if (b) b.click(); document.querySelector('#start-menu [data-sm="continue"]').click(); });
  await pg.waitForFunction(() => Game.buildings.length > 0, null, { timeout: 90000 });
  await pg.evaluate(() => { Game.speed = 3; });
  const t0 = Date.now();
  console.log('мин  игра  куча МБ  холсты МБ  гномы  нейтр  FZ   ряды  жит  всплыв  журнал  кучки  призр');
  while (Date.now() - t0 < MIN * 60000) {
    await pg.waitForTimeout(30000);
    const s = await pg.evaluate(() => {
      // окна-вопросы (дилемма, совет, обучение) ставят игру на паузу — закрываем, как сделал бы игрок
      for (const el of document.querySelectorAll('button')) if (el.offsetWidth && /^(Понятно|Закрыть|Пропустить|Позже|Хорошо|Ок|OK|Принять|Далее)/.test(el.textContent.trim())) { el.click(); break; }
      Game.paused = false; Game.speed = 3;
      if (window.gc) window.gc();
      // камера ходит по карте: так в кадр попадает новое и кэши набираются, как у игрока
      const b = Game.buildings[(Math.random() * Game.buildings.length) | 0]; if (b) centerOn((b.x + Math.random() * 20 - 10) * TILE, (b.y + Math.random() * 20 - 10) * TILE);
      R.cam.z = [0.5, 1, 2][(Math.random() * 3) | 0];
      return [Math.round(Game.time / 60), Math.round(performance.memory.usedJSHeapSize / 1048576), Math.round(perfCanvasMB()), PEOPLE_CACHE.size, naCache.size, Object.keys(FZ_CVC).length + (typeof FZ_PX !== 'undefined' ? '/' + Math.round(FZ_PX * 4 / 1048576) : ''), ROWC.map.size, Game.units.length, (Game.floaters || []).length, (Game.log || []).length, Game.piles.size, (Game.ghosts || []).length];
    });
    console.log(((Date.now() - t0) / 60000).toFixed(1).padStart(4) + '  ' + s.map(v => String(v).padStart(6)).join(' '));
  }
  await br.close();
})().catch(e => { console.error(e); process.exit(1); });
