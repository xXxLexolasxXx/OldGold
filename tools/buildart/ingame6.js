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
  const info = await pg.evaluate(() => { const o = []; for (const t of ['storehouse', 'house', 'school', 'sawmill', 'woodcutter', 'quarry']) for (const lv of [1, 2, 3]) for (const r of [0, 1, 2]) for (const v of (t === 'house' ? [0, 1, 2, 3, 4, 5, 6, 7] : [0])) { const s = buildingSprite(t, r, lv, undefined, v); if (!s.px) o.push('НЕ px ' + t + lv + r + v); } return o.length ? o : ['все спрайты пиксельные']; });
  console.log(info.join('\n'));
  const hide = () => pg.evaluate(() => { for (const el of document.querySelectorAll('div')) { const t = el.textContent || '', cs = getComputedStyle(el); if ((cs.position === 'fixed' || cs.position === 'absolute') && (/ОБУЧЕНИЕ|Обучение · /.test(t) || /^ЦЕЛИ/i.test(t.trim())) && el.offsetWidth < 900) el.style.display = 'none'; } });
  // поляна: убираем всё в прямоугольнике и ставим здания
  const scene = async (setup, name) => {
    await pg.evaluate(setup);
    await pg.waitForTimeout(1200); await hide(); await pg.waitForTimeout(200);
    await pg.screenshot({ path: path.join(OUT, name) });
    // крупно каждое здание по его рамке (зум 3)
    const types = await pg.evaluate(() => (window._shotB || []).map((b, i) => i));
    for (const i of types) {
      const box = await pg.evaluate(i => { const b = window._shotB[i]; R.cam.z = 3; const s = buildingSprite(b.type, b.rot || 0, b.level); centerOn((b.x + b.w / 2) * TILE, (b.y + b.h / 2) * TILE - 20); const sc = camScale(), r = R.canvas.getBoundingClientRect(); const ox = b.x * TILE - s.padx, oy = b.y * TILE - s.top; return { x: (ox - R.cam.x) * sc + r.left, y: (oy - R.cam.y) * sc + r.top, w: s.w * sc, h: s.h * sc, t: b.type + (b.rot ? '-side' : '') }; }, i);
      await pg.waitForTimeout(500);
      const x = Math.max(0, box.x), y = Math.max(0, box.y);
      await pg.screenshot({ path: path.join(OUT, name.replace('.png', '') + '-' + box.t + '.png'), clip: { x, y, width: Math.min(box.w, 1280 - x), height: Math.min(box.h, 800 - y) } });
    }
  };
  const prep = `
    const c = Game.buildings.find(b => b.type === 'bonfire') || Game.buildings[0];
    const X0 = c.x + 4, Y0 = c.y - 2;
    for (const b of Game.buildings.filter(b => b.x >= X0 - 1 && b.x < X0 + 24 && b.y >= Y0 - 1 && b.y < Y0 + 12 && b !== c)) Game.buildings.splice(Game.buildings.indexOf(b), 1);
    for (let y = Y0 - 2; y < Y0 + 14; y++) for (let x = X0 - 2; x < X0 + 26; x++) if (inb(x, y)) { World.obj[idx(x, y)] = 0; }
  `;
  for (const lv of [1, 3]) {
    await scene(new Function(prep + `
      const L = ${lv}, mk = (t, x, y, r) => { const o = placeBuilding(t, X0 + x, Y0 + y, true, r || 0); o.level = L; o.state = 'done'; o.working = true; return o; };
      const w = mk('infirmary', 0, 0), s = mk('infirmary', 4, 0, 1);
      window._shotB = [w, s];
      R.cam.z = 2; centerOn((X0 + 7) * TILE, (Y0 + 2) * TILE);
    `), `inf-L${lv}.png`);
  }
  const names = await pg.evaluate(() => Game.buildings.filter(b => b.type === 'house').map(b => b.hv).join(','));
  console.log('вид домов (hv):', names);
  console.log(errs.length ? errs.slice(0, 10).join('\n') : 'ошибок нет');
  await br.close();
})();
