// Проверка пиксельного трактира в настоящей игре: новая игра, трактир на уровнях 1–3 (и поворотах), едоки, запасы.
// node ingame.js [порт сервера, по умолчанию 8799] — сервер игры из этого worktree должен быть запущен.
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
  for (let i = 0; i < 8; i++) {   // дальше по шагам меню, пока не начнётся игра
    const started = await pg.evaluate(() => typeof Game !== 'undefined' && Game.buildings && Game.buildings.length > 0 && !document.querySelector('#start-menu:not([hidden])')?.offsetWidth);
    if (started) break;
    await pg.evaluate(() => { const b = [...document.querySelectorAll('#start-menu button, button')].find(b => b.offsetWidth && /Дальше|Спокойный|Начать|Играть|В путь/.test(b.textContent)); if (b) b.click(); });
    await pg.waitForTimeout(2500);
  }
  const vis = await pg.evaluate(() => !![...document.querySelectorAll('input')].find(x => x.offsetWidth && !x.id.startsWith('sm-')));
  if (vis) { await pg.keyboard.type('Тест'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(800); }
  for (let i = 0; i < 4; i++) { const hit = await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.offsetWidth && /В путь|Понятно|Закрыть|Пропустить/.test(b.textContent)); if (b) { b.click(); return true; } return false; }); if (!hit) break; await pg.waitForTimeout(800); }
  // спрайты: все уровни и повороты строятся без ошибок
  const sprInfo = await pg.evaluate(() => { const o = []; for (const lv of [1, 2, 3]) for (const r of [0, 1, 2]) { const s = buildingSprite('inn', r, lv); o.push(`L${lv}r${r} ${s.w}x${s.h} px=${s.pxInn} wins=${s.wins.length} ch=${s.chimneys.length}`); } return o; });
  console.log(sprInfo.join('\n'));
  const GIF = process.env.GIF === '1';
  for (const lv of (GIF ? [2, 3] : [1, 2, 3])) for (const rot of [0, 1]) {
    await pg.evaluate(([lv, rot]) => {
      let inn = Game.buildings.find(b => b.type === 'inn' && !b.removed);
      if (!inn || inn.rot !== rot) { if (inn) { Game.buildings.splice(Game.buildings.indexOf(inn), 1); } const c = Game.buildings.find(b => b.type === 'bonfire') || Game.buildings[0]; const px = c.x + 5, py = c.y, dd = bDims('inn', rot); for (let y = py - 1; y < py + dd.h + 1; y++) for (let x = px - 1; x < px + dd.w + 1; x++) if (inb(x, y)) World.obj[idx(x, y)] = 0;   // участок под стройку свободен, как в игре
        inn = placeBuilding('inn', px, py, true, rot); }
      inn.level = lv; inn.state = 'done';
      for (const k in inn.def.inputs) inn.stock[k] = Math.round(inn.def.inputs[k] * 0.7);
      // едоки: до 12 жителей садятся есть
      const folk = Game.units.filter(u => !u.dead && isPerson(u) && u.type !== 'hero').slice(0, 12);
      for (const u of folk) { u.dining = inn; u.inside = inn; u.diningFood = ['bread', 'sausage', 'steak', 'fish'][u.id % 4]; }
      window._inn = inn;
      R.cam.z = 3; if (typeof Tut !== 'undefined' && Tut) Tut.on = false;
      centerOn((inn.x + inn.w / 2) * TILE + 20, (inn.y + inn.h / 2) * TILE - 30);
    }, [lv, rot]);
    await pg.waitForTimeout(1500);
    await pg.evaluate(() => { R.cam.z = 3; centerOn((_inn.x + _inn.w / 2) * TILE - 40, (_inn.y + _inn.h / 2) * TILE - 10); });
    await pg.evaluate(() => { for (const el of document.querySelectorAll('div')) { const t = el.textContent || ''; const cs = getComputedStyle(el); if ((cs.position === 'fixed' || cs.position === 'absolute') && (/ОБУЧЕНИЕ|Обучение · /.test(t) || /^ЦЕЛИ/i.test(t.trim())) && el.offsetWidth < 900) el.style.display = 'none'; } });
    await pg.waitForTimeout(300);
    await pg.screenshot({ path: path.join(OUT, `inn-L${lv}-r${rot}.png`) });
    if (GIF) {
      const box = await pg.evaluate(() => { const s = buildingSprite('inn', _inn.rot, _inn.level), sc = camScale(); const ox = _inn.x * TILE - s.padx, oy = _inn.y * TILE - s.top; return { x: (ox - R.cam.x) * sc + R.canvas.getBoundingClientRect().left, y: (oy - R.cam.y) * sc + R.canvas.getBoundingClientRect().top, w: s.w * sc, h: s.h * sc }; });
      for (let f = 0; f < 18; f++) { await pg.screenshot({ path: path.join(OUT, `f-L${lv}-r${rot}-${String(f).padStart(2, '0')}.png`), clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.min(box.w, 1280 - box.x), height: Math.min(box.h, 800 - box.y) } }); await pg.waitForTimeout(120); }
    }
  }
  console.log(errs.length ? errs.slice(0, 10).join('\n') : 'ошибок нет');
  await br.close();
})();
