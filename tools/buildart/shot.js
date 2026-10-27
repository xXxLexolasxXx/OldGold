// снимок листа вариантов: node shot.js out.png [query] — query как в sheet.html (type=inn&scale=1&rots=0)
const path = require('path'), fs = require('fs');
const { chromium } = require('D:/для игры/feod/tools/browsers/node_modules/playwright-core');
(async () => {
  const out = process.argv[2] || path.join(__dirname, 'sheet.png'), query = process.argv[3] || '';
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--allow-file-access-from-files'] });
  const pg = await br.newPage({ viewport: { width: 2400, height: 1200 } });
  pg.on('pageerror', e => console.log('pageerror', e.message));
  pg.on('console', m => { if (m.type() === 'error') console.log('console', m.text()); });
  await pg.goto('file:///' + path.resolve(__dirname, 'sheet.html').split(path.sep).join('/') + (query ? '?' + query : ''));
  await pg.waitForFunction(() => document.title === 'ok', null, { timeout: 120000 });
  await pg.waitForTimeout(300);
  await pg.screenshot({ path: out, fullPage: true });
  if (process.argv[4]) {
    const pngs = await pg.evaluate(() => window.PNGS);
    fs.mkdirSync(process.argv[4], { recursive: true });
    for (const k in pngs) fs.writeFileSync(path.join(process.argv[4], k + '.png'), Buffer.from(pngs[k].split(',')[1], 'base64'));
  }
  await br.close();
  console.log('saved', out);
})();
