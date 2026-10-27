// Дымовой тест: игра грузится, гномы рисуются, ошибок нет. node tools/gnome-smoke.js [порт]
const fs = require('fs');
const pw = require('D:/для игры/feod/tools/browsers/node_modules/playwright-core');
(async () => {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
  const b = await pw.chromium.launch({ executablePath: exe, headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:' + (process.argv[2] || 8799) + '/', { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  const ok = await p.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.offsetWidth && b.textContent.trim() === 'Понятно').map(b => b.click()).length);
  await p.waitForTimeout(600);
  await p.click('#start-menu [data-sm="new"]'); await p.waitForTimeout(600);
  await p.click('#start-menu [data-sm="mode-free"]'); await p.waitForTimeout(800);
  await p.click('#start-menu [data-sm="map-go"]'); await p.waitForTimeout(800);
  await p.click('#start-menu [data-sm="diff:normal"]'); await p.waitForTimeout(3000);
  await p.evaluate(() => { for (let i = 0; i < 1200; i++) step(0.05); });
  await p.waitForTimeout(2000);
  await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.offsetWidth && b.textContent.trim() === 'В путь'); if (b) b.click(); });
  await p.waitForTimeout(4000);
  console.log(await p.evaluate(() => ({ units: Game.units.length, part: PART })));
  await p.screenshot({ path: process.argv[3] || 'D:/wt-gnome/promo/ref/gnome-frames-2026-10-27/game.png' });
  console.log('ошибки:', errs.length ? errs.slice(0, 5) : 'нет');
  await b.close();
})();
