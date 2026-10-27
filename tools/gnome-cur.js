// Рендер текущего гнома для листа сравнения: node tools/gnome-cur.js
const path = require('path'), fs = require('fs');
const pw = require(path.join(__dirname, 'browsers', 'node_modules', 'playwright-core'));
(async () => {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
  const b = await pw.chromium.launch({ executablePath: exe, headless: true });
  const p = await b.newPage();
  p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => console.log('LOG', m.text()));
  await p.goto(require('url').pathToFileURL(path.join(__dirname, 'gnome-cur.html')).href);
  await p.waitForTimeout(1500);
  console.log(await p.evaluate('window.RES'));
  await b.close();
})();
