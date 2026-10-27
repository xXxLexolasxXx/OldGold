// Снимает лист животных «было/стало» в PNG: node tools/animals-shot.js [выход.png] [z]
// «Было» — код из папки AF_BASE (по умолчанию D:/wt-animals-base, origin/main), «стало» — эта папка.
// Нужен playwright-core (tools/browsers/node_modules рабочей папки) и установленный Chrome.
const path = require('path'), fs = require('fs');
const PW = process.env.PW_CORE || 'D:/для игры/feod/tools/browsers/node_modules/playwright-core';
const { chromium } = require(PW);
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = process.argv[2] || path.resolve(__dirname, 'animals-fine.png'), Z = +(process.argv[3] || 3);
const HERE = path.resolve(__dirname, '..'), BASE = process.env.AF_BASE || 'D:/wt-animals-base';
const files = root => [...fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m => m[1]).filter(s => !/^https?:/.test(s));
const rel = p => path.relative(__dirname, p).replace(/\\/g, '/');

(async () => {
  const br = await chromium.launch({ executablePath: CHROME, args: ['--allow-file-access-from-files'] });
  const shots = [];
  for (const [name, root] of [['было', BASE], ['стало', HERE]]) {
    const pg = await br.newPage();
    pg.on('pageerror', e => console.log(name, 'pageerror', e.message));
    await pg.addInitScript(f => { window.AF_FILES = f; }, files(root));
    await pg.goto('file:///' + path.resolve(__dirname, 'animals-fine.html').replace(/\\/g, '/') + '?z=' + Z + '&root=' + encodeURIComponent(rel(root)));
    await pg.waitForFunction(() => /^(ready|fail)/.test(document.title), null, { timeout: 180000 });
    console.log(name, await pg.title());
    shots.push([name, await pg.evaluate(() => document.getElementById('cv').toDataURL('image/png'))]);
    await pg.close();
  }
  // склейка: «было» сверху, «стало» снизу
  const pg = await br.newPage();
  const data = await pg.evaluate(async S => {
    const im = await Promise.all(S.map(([, u]) => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = u; })));
    const cv = document.createElement('canvas'); cv.width = im[0].width; cv.height = im[0].height * 2 + 60;
    const c = cv.getContext('2d'); c.fillStyle = '#1a2216'; c.fillRect(0, 0, cv.width, cv.height);
    c.font = 'bold 22px sans-serif'; c.fillStyle = '#f0e8c0';
    S.forEach(([n], k) => { c.fillText(n === 'было' ? 'БЫЛО (origin/main)' : 'СТАЛО (мелкий пиксель ×3)', 12, 24 + k * (im[0].height + 30)); c.drawImage(im[k], 0, 30 + k * (im[0].height + 30)); });
    return cv.toDataURL('image/png');
  }, shots);
  fs.writeFileSync(OUT, Buffer.from(data.split(',')[1], 'base64'));
  console.log('записано', OUT);
  await br.close();
})();
