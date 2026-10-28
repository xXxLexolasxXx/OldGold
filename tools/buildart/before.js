// снимок текущих спрайтов зданий (до) — через настоящую игру
const path = require('path'), fs = require('fs');
const { chromium } = require('D:/для игры/feod/tools/browsers/node_modules/playwright-core');
const types = (process.argv[2] || 'storehouse,inn,house,well,school,infirmary,carrier,tradepost,goatpen,woodcutter,quarry,sawmill').split(',');
(async () => {
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const pg = await br.newPage();
  pg.on('pageerror', e => console.log('pageerror', e.message));
  await pg.goto('http://localhost:8799/index.html');
  await pg.waitForTimeout(6000);
  const res = await pg.evaluate((types) => {
    const out = {};
    for (const t of types) if (typeof PX_TYPES !== 'undefined') PX_TYPES.delete(t);   // «было» — старый рисунок
    for (const t of types) { try { if (!BUILDINGS[t]) { out[t] = 'нет'; continue; } const s = buildingSprite(t, 0, 1); out[t] = { url: s.canvas.toDataURL(), w: s.canvas.width, h: s.canvas.height, sw: s.w, sh: s.h }; } catch (e) { out[t] = 'ERR ' + e.message; } }
    out._all = Object.keys(BUILDINGS).join(',');
    return out;
  }, types);
  fs.mkdirSync(path.join(__dirname, 'before'), { recursive: true });
  for (const t of types) { const r = res[t]; if (typeof r === 'string') { console.log(t, r); continue; } console.log(t, r.w, r.h, r.sw, r.sh); fs.writeFileSync(path.join(__dirname, 'before', t + '.png'), Buffer.from(r.url.split(',')[1], 'base64')); }
  console.log(res._all);
  await br.close();
})();
