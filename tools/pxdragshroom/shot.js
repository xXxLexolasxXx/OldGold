const path = require('path'), fs = require('fs');
const { chromium } = require('D:/для игры/feod/tools/browsers/node_modules/playwright-core');
(async () => {
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--allow-file-access-from-files'] });
  const pg = await br.newPage();
  pg.on('pageerror', e => console.log('pageerror', e.message));
  pg.on('console', m => console.log(m.type(), m.text()));
  await pg.goto('file:///' + path.resolve(__dirname, process.argv[3] || 'sheet.html').split(path.sep).join('/'));
  await pg.waitForFunction(() => document.title !== '…', null, { timeout: 60000 });
  console.log(await pg.title());
  const data = await pg.evaluate(() => document.getElementById('cv').toDataURL('image/png'));
  fs.writeFileSync(process.argv[2] || path.join(__dirname, 'sheet.png'), Buffer.from(data.split(',')[1], 'base64'));
  await br.close();
})();