// Картинки «было → стало» для поста («стало» — только 3-й уровень, по просьбе владельца): старый спрайт (tools/buildart/before/*.png, снят до переделки) и новый из игры.
// node beforeafter.js [порт] → promo/posts/buildings-*.png
const path = require('path'), fs = require('fs');
const { chromium } = require('D:/для игры/feod/tools/browsers/node_modules/playwright-core');
const PORT = process.argv[2] || 8799, OUT = path.join(__dirname, '../../promo/posts');
fs.mkdirSync(OUT, { recursive: true });
const b64 = f => 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'before', f)).toString('base64');
(async () => {
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const pg = await br.newPage({ viewport: { width: 3600, height: 1400 } });
  await pg.goto(`http://localhost:${PORT}/index.html`);
  await pg.waitForFunction(() => typeof pxSprite === 'function' && typeof BUILDINGS !== 'undefined' && BUILDINGS.house, null, { timeout: 150000 });
  await pg.waitForTimeout(1500);
  const after = await pg.evaluate(() => {
    const o = {};
    const crop = cv => { const c = cv.getContext('2d'), d = c.getImageData(0, 0, cv.width, cv.height).data; let x0 = cv.width, y0 = cv.height, x1 = 0, y1 = 0; for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (d[(y * cv.width + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } const o2 = document.createElement('canvas'); o2.width = x1 - x0 + 1; o2.height = y1 - y0 + 1; o2.getContext('2d').drawImage(cv, -x0, -y0); return o2; };
    const buildingSprite0 = buildingSprite; const bs = (...a) => ({ canvas: crop(buildingSprite0(...a).canvas) });
    for (const t of ['inn', 'storehouse', 'school', 'sawmill', 'woodcutter', 'quarry', 'well', 'stable', 'tradepost', 'goatpen', 'infirmary', 'farm', 'bakery', 'hopfarm', 'brewery', 'swine', 'butchery']) for (const lv of [1, 2, 3]) o[t + lv] = bs(t, 0, lv).canvas.toDataURL();
    for (let v = 0; v < 8; v++) o['house' + v] = bs('house', 0, 3, undefined, v).canvas.toDataURL();
    return o;
  });
  const card = (title, before, afters, file) => `
    <div style="background:#2b3a22;padding:28px 34px;font-family:Georgia,serif;color:#f3e6c4;width:max-content">
      <div style="font-size:44px;font-weight:bold;margin-bottom:14px">${title}</div>
      <div style="display:flex;align-items:flex-end;gap:30px">
        ${before ? `<div style="text-align:center"><div style="font-size:30px;opacity:.75">было</div><img class="cr" src="${before}" style="image-rendering:pixelated"></div>
        <div style="font-size:80px;padding-bottom:110px">→</div>` : ''}
        <div style="text-align:center"><div style="font-size:30px;color:#ffd86a">стало</div>
          <div style="display:flex;gap:18px;align-items:flex-end">${afters.map(a => `<img class="cr" src="${a}" style="image-rendering:pixelated">`).join('')}</div></div>
      </div></div>`;
  // «стало» — все три уровня (просьба владельца 28.10)
  const L3 = t => [1, 2, 3].map(lv => after[t + lv]);
  const shots = [
    ['Трактир', b64('inn.png'), L3('inn'), 'buildings-inn.png'],
    ['Склад', b64('storehouse.png'), L3('storehouse'), 'buildings-store.png'],
    ['Дом', b64('house.png'), [0, 1, 2, 3].map(v => after['house' + v]), 'buildings-houses-a.png'],
    ['Ещё дома', null, [4, 5, 6, 7].map(v => after['house' + v]), 'buildings-houses-b.png'],
    ...[['Школа', 'school'], ['Лесопилка', 'sawmill'], ['Дом лесоруба', 'woodcutter'], ['Каменоломня', 'quarry'], ['Колодец', 'well'], ['Извозчик', 'stable'], ['Торговый пост', 'tradepost'], ['Загон для коз', 'goatpen'], ['Лазарет', 'infirmary'],
      ['Ферма', 'farm'], ['Пекарня', 'bakery'], ['Хмельник', 'hopfarm'], ['Пивоварня', 'brewery'], ['Свинарник', 'swine'], ['Бойня', 'butchery']].map(([n, t]) => [n, b64(t + '.png'), L3(t), `buildings-${t}.png`]),
  ];
  for (const [t, b, a, f] of shots) {
    await pg.setContent(`<body style="margin:0;background:#2b3a22">${card(t, b, a, f)}</body>`);
    await pg.waitForTimeout(300);
    // старые картинки тоже обрезаем по прозрачному краю; всё в одном масштабе (×0.66 от холста ×3 = ×2 мира)
    await pg.evaluate(async () => { for (const im of document.querySelectorAll('img.cr')) { await im.decode(); const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0; for (let y = 0; y < c.height; y++) for (let xx = 0; xx < c.width; xx++) if (d[(y * c.width + xx) * 4 + 3] > 0) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; } const o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1; o.getContext('2d').drawImage(c, -x0, -y0); im.src = o.toDataURL(); await im.decode(); im.style.width = o.width + 'px'; } });
    await pg.waitForTimeout(300);
    const el = await pg.$('body > div');
    await el.screenshot({ path: path.join(OUT, f) });
    console.log('saved', f);
  }
  await br.close();
})();
