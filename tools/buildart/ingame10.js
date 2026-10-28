// Соседство: по три здания вплотную (как в игре: ox = x·TILE − padx, oy = y·TILE − top), вход на юг и сбоку
const path = require('path'), fs = require('fs');
const { chromium } = require('D:/для игры/feod/tools/browsers/node_modules/playwright-core');
const OUT = path.join(__dirname, 'ingame'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const pg = await br.newPage();
  pg.on('pageerror', e => console.log('pageerror', e.message));
  await pg.goto('http://localhost:8799/index.html');
  await pg.waitForFunction(() => typeof pxSprite === 'function', null, { timeout: 150000 });
  await pg.waitForTimeout(1500);
  const url = await pg.evaluate((types) => {
    const rows = [];
    for (const t of types) for (const rot of [0, 1]) { const d = BUILDINGS[t], w = rot ? d.h : d.w; rows.push({ t, rot, w }); }
    const cv = document.createElement('canvas'), S = 3; cv.width = 900 * S; cv.height = rows.length * 140 * S;
    const c = cv.getContext('2d'); c.fillStyle = '#4a6a36'; c.fillRect(0, 0, cv.width, cv.height); c.scale(S, S); c.imageSmoothingEnabled = false;
    rows.forEach((r, i) => {
      const y0 = i * 140 + 110;
      for (let k = 0; k < 3; k++) {
        const s = buildingSprite(r.t, r.rot, 3, undefined, k * 3), bx = 40 + k * r.w * TILE, ox = bx - s.padx, oy = y0 - s.top;
        c.strokeStyle = 'rgba(255,255,0,.5)'; c.strokeRect(bx, y0, r.w * TILE, (r.rot ? BUILDINGS[r.t].w : BUILDINGS[r.t].h) * TILE);
        c.drawImage(s.canvas, ox, oy, s.w, s.h);
      }
    });
    return cv.toDataURL();
  }, (process.argv[2] || 'house,inn,farm,butchery').split(','));
  fs.writeFileSync(path.join(OUT, 'neighbours.png'), Buffer.from(url.split(',')[1], 'base64'));
  await br.close(); console.log('ok');
})();
