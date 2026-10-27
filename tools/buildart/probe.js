const { chromium } = require('D:/для игры/feod/tools/browsers/node_modules/playwright-core');
(async () => {
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const pg = await br.newPage();
  pg.on('pageerror', e => console.log('pageerror', e.message));
  pg.on('console', m => { if (m.type() === 'error') console.log('console', m.text()); });
  await pg.goto('http://localhost:8799/index.html');
  await pg.waitForTimeout(25000);
  console.log(await pg.evaluate(() => { const t0 = performance.now(); const s = typeof pxSprite === 'function' ? pxSprite('farm', 0, 3, 0) : null; return [typeof pxSprite, Math.round(performance.now() - t0), !!document.querySelector('#start-menu [data-sm="new"]')]; }));
  await br.close();
})();
