// Проверка пиксельного склада и домов в настоящей игре: склад на уровнях 1–3 с запасами, восемь домов (вход на юг и на восток).
// node ingame2.js [порт] — сервер игры из этого worktree должен быть запущен.
const path = require('path'), fs = require('fs');
const { chromium } = require('D:/для игры/feod/tools/browsers/node_modules/playwright-core');
const PORT = process.argv[2] || 8799, OUT = path.join(__dirname, 'ingame');
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const pg = await br.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  pg.on('pageerror', e => errs.push('pageerror ' + e.message));
  pg.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  await pg.goto(`http://localhost:${PORT}/index.html`);
  await pg.waitForFunction(() => typeof StartMenu !== 'undefined' && document.querySelector('#start-menu [data-sm="new"]') && document.querySelector('#start-menu [data-sm="new"]').offsetWidth > 0, null, { timeout: 150000 });
  await pg.waitForTimeout(1500);
  await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.offsetWidth && b.textContent.trim() === 'Понятно'); if (b) b.click(); });
  await pg.click('#start-menu [data-sm="new"]'); await pg.waitForTimeout(600);
  await pg.click('#start-menu [data-sm="mode-free"]'); await pg.waitForTimeout(3500);
  for (let i = 0; i < 8; i++) {
    const started = await pg.evaluate(() => typeof Game !== 'undefined' && Game.buildings && Game.buildings.length > 0 && !document.querySelector('#start-menu:not([hidden])')?.offsetWidth);
    if (started) break;
    await pg.evaluate(() => { const b = [...document.querySelectorAll('#start-menu button, button')].find(b => b.offsetWidth && /Дальше|Спокойный|Начать|Играть|В путь/.test(b.textContent)); if (b) b.click(); });
    await pg.waitForTimeout(2500);
  }
  for (let i = 0; i < 4; i++) { const hit = await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.offsetWidth && /В путь|Понятно|Закрыть|Пропустить/.test(b.textContent)); if (b) { b.click(); return true; } return false; }); if (!hit) break; await pg.waitForTimeout(800); }
  const info = await pg.evaluate(() => { const o = []; for (const t of ['storehouse', 'house']) for (const lv of [1, 2, 3]) for (const r of [0, 1, 2]) for (const v of (t === 'house' ? [0, 1, 2, 3, 4, 5, 6, 7] : [0])) { const s = buildingSprite(t, r, lv, undefined, v); if (!s.px) o.push('НЕ px ' + t + lv + r + v); } return o.length ? o : ['все спрайты пиксельные']; });
  console.log(info.join('\n'));
  const hide = () => pg.evaluate(() => { for (const el of document.querySelectorAll('div')) { const t = el.textContent || '', cs = getComputedStyle(el); if ((cs.position === 'fixed' || cs.position === 'absolute') && (/ОБУЧЕНИЕ|Обучение · /.test(t) || /^ЦЕЛИ/i.test(t.trim())) && el.offsetWidth < 900) el.style.display = 'none'; } });
  // поляна: убираем всё в прямоугольнике и ставим здания
  const scene = async (setup, name) => {
    await pg.evaluate(setup);
    await pg.waitForTimeout(1200); await hide(); await pg.waitForTimeout(200);
    await pg.screenshot({ path: path.join(OUT, name) });
  };
  const prep = `
    const c = Game.buildings.find(b => b.type === 'bonfire') || Game.buildings[0];
    const X0 = c.x + 4, Y0 = c.y - 2;
    for (const b of Game.buildings.filter(b => b.x >= X0 - 1 && b.x < X0 + 24 && b.y >= Y0 - 1 && b.y < Y0 + 12 && b !== c)) Game.buildings.splice(Game.buildings.indexOf(b), 1);
    for (let y = Y0 - 2; y < Y0 + 14; y++) for (let x = X0 - 2; x < X0 + 26; x++) if (inb(x, y)) { World.obj[idx(x, y)] = 0; }
  `;
  for (const lv of [1, 2, 3]) {
    await scene(new Function(prep + `
      const s = placeBuilding('storehouse', X0, Y0, true, 0); s.level = ${lv}; s.state = 'done';
      const fill = ${[0.3, 0.7, 1][lv - 1]};
      Object.assign(s.stock, { trunk: Math.round(40 * fill), timber: Math.round(40 * fill), stone: Math.round(30 * fill), bread: Math.round(30 * fill), wheat: Math.round(20 * fill), iron: Math.round(20 * fill) });
      const s2 = placeBuilding('storehouse', X0 + 6, Y0 + 1, true, 1); s2.level = ${lv}; s2.state = 'done'; Object.assign(s2.stock, s.stock);
      R.cam.z = 2; centerOn((X0 + 5) * TILE, (Y0 + 2) * TILE);
    `), `store-L${lv}.png`);
  }
  for (const lv of [1, 3]) {
    await scene(new Function(prep + `
      for (let k = 0; k < 8; k++) { const h = placeBuilding('house', X0 + (k % 4) * 3, Y0 + Math.floor(k / 4) * 3, true, k >= 4 ? 1 : 0); h.level = ${lv}; h.state = 'done'; h._vr = k; }
      R.cam.z = 2; centerOn((X0 + 6) * TILE, (Y0 + 3) * TILE);
    `), `houses-L${lv}.png`);
  }
  const icons = await pg.evaluate(() => { Game.unlocked = Game.unlocked || {}; Game.unlocked.home = true; for (const u of UNLOCKS) for (const it of u.items) if (it === 'house') Game.unlocked[u.id] = true; const seen = new Set(); for (let k = 0; k < 12; k++) { UI.shown = null; UI.cat = BUILD_CATS.findIndex(c => buildTypesIn(c).includes('house')); renderBuildMenu(); const im = document.querySelector('.bbtn[data-type="house"] img'); if (im) seen.add(im.src.length + ':' + im.src.slice(-40)); } return seen.size; });
  console.log('разных иконок дома за 12 открытий:', icons);
  const names = await pg.evaluate(() => Game.buildings.filter(b => b.type === 'house').map(b => b.hv).join(','));
  console.log('вид домов (hv):', names);
  console.log(errs.length ? errs.slice(0, 10).join('\n') : 'ошибок нет');
  await br.close();
})();
