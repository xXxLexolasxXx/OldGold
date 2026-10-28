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
  const info = await pg.evaluate(() => { const o = []; for (const t of ['farm', 'bakery', 'hopfarm', 'brewery', 'swine', 'butchery']) for (const lv of [1, 2, 3]) for (const r of [0, 1, 2]) for (const v of (t === 'house' ? [0, 1, 2, 3, 4, 5, 6, 7] : [0])) { const s = buildingSprite(t, r, lv, undefined, v); if (!s.px) o.push('НЕ px ' + t + lv + r + v); } return o.length ? o : ['все спрайты пиксельные']; });
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
    let X0 = c.x + 4, Y0 = c.y - 2, best = 1e9;
    for (let y = 8; y < MAP_H - 22; y += 2) for (let x = 8; x < MAP_W - 36; x += 2) {   // чистая поляна 26×12: без воды, скал и зданий, поближе к костру
      let bad = 0; for (let j = -6; j < 19 && bad < 1e6; j++) for (let i = -6; i < 33; i++) { const q = idx(x + i, y + j); const inner = j >= -1 && j < 13 && i >= -1 && i < 27; if (!inner) { if (World.terrain[q] === T_ROCK) { bad = 1e6; break; } continue; } if (World.terrain[q] === T_WATER || World.terrain[q] === T_ROCK || World.bmap[q]) { bad = 1e6; break; } if (World.road[q]) bad += 1; }
      const sc = bad + Math.hypot(x - c.x, y - c.y) * 0.3; if (sc < best) { best = sc; X0 = x; Y0 = y; }
    }
    window._X0 = X0; window._Y0 = Y0;
    for (let y = Y0 - 1; y < Y0 + 13; y++) for (let x = X0 - 1; x < X0 + 27; x++) if (inb(x, y)) { World.obj[idx(x, y)] = 0; World.road[idx(x, y)] = 0; }
  `;
  // сцена: трактир с жизнью и по три дома вплотную (вход на юг и сбоку); игра идёт
  await pg.evaluate(new Function(prep + `
    const mk = (t, x, y, r) => { const o = placeBuilding(t, X0 + x, Y0 + y, true, r || 0); o.level = 3; o.state = 'done'; o.working = true; return o; };
    const inn = Game.buildings.find(b => b.type === 'inn');
    const hs = [mk('house', 0, 0), mk('house', 2, 0), mk('house', 4, 0), mk('house', 0, 4, 1), mk('house', 2, 4, 1), mk('house', 4, 4, 1), mk('farm', 7, 0, 1), mk('brewery', 11, 0, 1), mk('butchery', 14, 0, 1)];
    window._inn = inn; window._hs = hs;
  `));
  await pg.evaluate(() => { Game.speed = 4; });
  await pg.waitForTimeout(15000);
  await pg.evaluate(() => { const b = window._inn; if (b) { R.cam.z = 3; centerOn((b.x + b.w / 2) * TILE, (b.y + b.h / 2) * TILE); } });
  await pg.waitForTimeout(800); await hide();
  await pg.screenshot({ path: path.join(OUT, 'scene-inn.png') });
  await pg.evaluate(() => { R.cam.z = 2; centerOn((window._X0 + 8) * TILE, (window._Y0 + 4) * TILE); });
  await pg.waitForTimeout(800); await hide();
  await pg.screenshot({ path: path.join(OUT, 'scene-houses.png') });
  console.log(await pg.evaluate(() => JSON.stringify(window._hs.map(b => [b.type, b.x, b.y, b.w, b.h, b.rot]))));
  const names = await pg.evaluate(() => Game.buildings.filter(b => b.type === 'house').map(b => b.hv).join(','));
  console.log('вид домов (hv):', names);
  console.log(errs.length ? errs.slice(0, 10).join('\n') : 'ошибок нет');
  await br.close();
})();
