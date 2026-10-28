// Трактир с полным залом: чистый рендер здание + двор (drawInside) ×3, уровни 1–3, вход на юг и сбоку
const path = require('path'), fs = require('fs');
const { chromium } = require('D:/для игры/feod/tools/browsers/node_modules/playwright-core');
const OUT = path.join(__dirname, 'ingame', 'inn'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const pg = await br.newPage({ viewport: { width: 1280, height: 800 } });
  pg.on('pageerror', e => console.log('pageerror', e.message));
  await pg.goto('http://localhost:8799/index.html');
  await pg.waitForFunction(() => typeof pxSprite === 'function' && typeof drawInside === 'function', null, { timeout: 150000 });
  await pg.waitForTimeout(2000);
  const shots = await pg.evaluate((N) => {
    const out = {}, B0 = Game.buildings[0] || { };
    const d = BUILDINGS.inn, types = ['serf', 'woodcutter', 'farmer', 'baker', 'miner', 'brewer', 'butcher', 'stonemason', 'carpenter', 'herder', 'serf', 'farmer', 'miner', 'baker', 'serf', 'brewer'];
    for (const lv of [1, 2, 3]) for (const rot of [0, 1]) {
      const b = Object.assign(typeof Building === 'function' ? Object.create(Building.prototype) : {}, { id: 9, type: 'inn', def: d, rot, level: lv, state: 'done', working: true, x: 0, y: 0, w: rot ? d.h : d.w, h: rot ? d.w : d.h, stock: { bread: 10, sausage: 6, beer: 8 } });
      const diners = types.slice(0, N).map((tp, i) => ({ id: 100 + i, type: tp, look: i * 37 + 5, diningFood: ['bread', 'sausage', 'beer'][i % 3] }));
      const spr = buildingSprite('inn', rot, lv, undefined, 0);
      Game.time = 5.5;
      insideScan(); INS_DINE.set(b, diners); INS_CNT.set(b, N);
      const cv = document.createElement('canvas'); cv.width = spr.w * 3; cv.height = spr.h * 3; const c = cv.getContext('2d');
      c.fillStyle = '#4a6a36'; c.fillRect(0, 0, cv.width, cv.height); c.scale(3, 3); c.imageSmoothingEnabled = false;
      c.drawImage(spr.shadow, 0, 0, spr.w, spr.h); c.drawImage(spr.canvas, 0, 0, spr.w, spr.h);
      try { drawInside(c, b, spr, 0, 0); } catch (e) { out.err = (out.err || '') + e.message + ' | '; }
      out[`inn-L${lv}-r${rot}`] = cv.toDataURL();
    }
    return out;
  }, +(process.argv[2] || 12));
  if (shots.err) console.log('ОШИБКИ', shots.err); delete shots.err;
  for (const k in shots) fs.writeFileSync(path.join(OUT, k + '.png'), Buffer.from(shots[k].split(',')[1], 'base64'));
  console.log('ok', Object.keys(shots).length);
  await br.close();
})();
