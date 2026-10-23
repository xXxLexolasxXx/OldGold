// Снимает листы выбора стиля нечисти в PNG: node tools/pxstyle-shot.js [лист...]
// Нужен playwright-core (лежит в tools/browsers/node_modules рабочей папки) и установленный Chrome.
const path = require('path'), fs = require('fs');
const PW = process.env.PW_CORE || 'D:/для игры/feod/tools/browsers/node_modules/playwright-core';
const { chromium } = require(PW);
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sheets = process.argv.slice(2).length ? process.argv.slice(2) : ['undead', 'forest', 'big'];
(async () => {
  const br = await chromium.launch({ executablePath: CHROME, args: ['--allow-file-access-from-files'] });
  const pg = await br.newPage();
  pg.on('pageerror', e => console.log('pageerror', e.message));
  pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log(m.type(), m.text()); });
  for (const s of sheets) {
    const page = process.env.PXS_PAGE || 'pxstyle.html';
    const url = 'file:///' + path.resolve(__dirname, page).replace(/\\/g, '/') + '?s=' + s + (process.env.PXS_Q || '');
    await pg.goto(url);
    await pg.waitForFunction(() => document.title.startsWith('ready') || document.title.startsWith('fail'), null, { timeout: 120000 });
    console.log(s, await pg.title());
    const data = await pg.evaluate(() => document.getElementById('cv').toDataURL('image/png'));
    const buf = Buffer.from(data.split(',')[1], 'base64');
    for (const dir of process.env.PXS_PAGE ? ['.'] : ['../promo/ref/nechist-style-2026-10-23', '.']) {
      const d = path.resolve(__dirname, dir); fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(path.join(d, (process.env.PXS_PAGE ? 'check-' : 'nechist-') + s + '.png'), buf);
      if (process.env.PXS_PAGE) break;
    }
  }
  await br.close();
})();
