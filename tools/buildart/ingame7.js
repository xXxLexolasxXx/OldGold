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
  // чистый рендер: здание + двор (drawInside/drawPigs) на отдельном холсте ×3, два момента анимации
  await pg.evaluate(t => { window._TYPES = t; }, process.env.TYPES || 'farm,swine,brewery,hopfarm,bakery,butchery');
  const shots = await pg.evaluate(() => {
    const out = {}, B0 = Game.buildings[0];
    for (const type of window._TYPES.split(',')) for (const lv of [1, 2, 3]) for (const rot of [0, 1]) {
      const d = BUILDINGS[type], b = Object.assign(Object.create(Object.getPrototypeOf(B0)), { id: 7, type, def: d, rot, level: lv, state: 'done', working: true, x: 0, y: 0, w: rot ? d.h : d.w, h: rot ? d.w : d.h, stock: {}, pigs: [] });
      for (const g in d.outputs || {}) b.stock[g] = Math.round(d.outputs[g] * [0.4, 0.7, 1][lv - 1]);
      for (const g in d.inputs || {}) b.stock[g] = d.inputs[g];
      if (type === 'swine') { b.stock.pig = lv; b.pigs = [1, 2, 3].slice(0, lv + 1); }
      const spr = buildingSprite(type, rot, lv, undefined, 0);
      for (const T of [3.3, 9.7]) {
        Game.time = T;
        const cv = document.createElement('canvas'); cv.width = spr.w * 3; cv.height = spr.h * 3; const c = cv.getContext('2d');
        c.fillStyle = '#4a6a36'; c.fillRect(0, 0, cv.width, cv.height); c.scale(3, 3); c.imageSmoothingEnabled = false;
        c.drawImage(spr.shadow, 0, 0, spr.w, spr.h); c.drawImage(spr.canvas, 0, 0, spr.w, spr.h);
        if (spr.pen) drawPigs(c, b, spr, 0, 0);
        try { drawFoodYard(c, b, spr, 0, 0); } catch (e) { out.err = (out.err || '') + type + ': ' + e.message + ' | '; }
        out[`${type}-L${lv}-r${rot}-t${T}`] = cv.toDataURL();
      }
    }
    return out;
  });
  if (shots.err) console.log('ОШИБКИ:', shots.err); delete shots.err;
  fs.mkdirSync(path.join(OUT, 'food'), { recursive: true });
  for (const k in shots) fs.writeFileSync(path.join(OUT, 'food', k + '.png'), Buffer.from(shots[k].split(',')[1], 'base64'));
  const names = await pg.evaluate(() => Game.buildings.filter(b => b.type === 'house').map(b => b.hv).join(','));
  console.log('вид домов (hv):', names);
  console.log(errs.length ? errs.slice(0, 10).join('\n') : 'ошибок нет');
  await br.close();
})();
