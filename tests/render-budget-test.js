'use strict';
// Бюджет отрисовки в браузере (Playwright, как visual-test): экран телефона 386×837@3, процессор замедлен в 4 раза.
// Меряет в «единицах машины» (время делится на эталонную числовую петлю в той же странице, ×10 мс):
//  • сборку тяжёлых кадров нечисти ×3 — тролль, призрак (на телефоне 0.11.71 они строились по секунде прямо в кадре);
//  • процессорное время render() на сейве при обычном масштабе и при отдалении.
// Новая фича, которая утяжелит кадр или арт, уронит тест, а не fps у тестеров.
// Запуск: node tests/render-budget-test.js [--report]   (npm run test:render; нужен tools/browsers: cd tools/browsers && npm ci)
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib');
const ROOT = path.join(__dirname, '..');
const REPORT = process.argv.includes('--report');
// Пороги в единицах машины (замер 28.10, CPU ×4: тролль 150–180, призрак 95–115, render z=1 ~11, z=0.5 ~18; запас ×2.
// До оптимизации 0.11.89 тролль был ~1010, призрак ~210 — такие цифры тест ловит)
const BUDGET = { troll: 350, ghost: 230, render1: 25, render05: 40 };
const SAVE = path.join(__dirname, 'saves', 'v0.11.9-solo-meadow-s12.json.gz');

function loadPw() {
  for (const p of [process.env.PW_CORE, path.join(ROOT, 'tools/browsers/node_modules/playwright-core'), 'playwright-core', 'playwright'].filter(Boolean)) { try { return require(p); } catch (e) { /* следующий */ } }
  console.error('Нет playwright-core. Установите: cd tools/browsers && npm ci'); process.exit(2);
}
function chromePath() {
  for (const p of ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']) if (fs.existsSync(p)) return p;
  return undefined;   // встроенный браузер playwright, если поставлен
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
function serve() {
  return new Promise(res => {
    const s = http.createServer((q, r) => {
      let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); }
      r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
    }).listen(0, '127.0.0.1', () => res(s));
  });
}

(async () => {
  const { chromium } = loadPw();
  const srv = await serve(), port = srv.address().port;
  const raw = zlib.gunzipSync(fs.readFileSync(SAVE)).toString('utf8');
  const br = await chromium.launch({ executablePath: chromePath() });
  const ctx = await br.newContext({ viewport: { width: 386, height: 837 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(([raw]) => { try { localStorage.clear(); localStorage.setItem('feod.save.manual', raw); localStorage.setItem('feod.save.manual.meta', '{"time":1}'); } catch (e) { /* без хранилища */ } }, [raw]);
  await pg.goto(`http://127.0.0.1:${port}/index.html`);
  await pg.waitForFunction(() => { const b = document.querySelector('#start-menu [data-sm="continue"]'); return b && b.offsetWidth > 0 && !b.disabled; }, null, { timeout: 200000 });
  await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.offsetWidth && b.textContent.trim() === 'Понятно'); if (b) b.click(); document.querySelector('#start-menu [data-sm="continue"]').click(); });
  await pg.waitForFunction(() => typeof Game !== 'undefined' && Game.buildings.length > 0, null, { timeout: 120000 });
  // после загрузки меню ещё может показать окна (что нового, обучение) — закрываем, пока игра не пойдёт
  for (let i = 0; i < 20 && await pg.evaluate(() => StartMenu.open); i++) {
    await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.offsetWidth && /^(Понятно|Закрыть|Продолжить|Пропустить|В путь|Играть)/.test(b.textContent.trim())); if (b) b.click(); });
    await pg.waitForTimeout(700);
  }
  if (process.env.DBG) console.log(await pg.evaluate(() => [StartMenu.open, [...document.querySelectorAll('button')].filter(b => b.offsetWidth).map(b => b.textContent.trim().slice(0, 20)).join(' | ')]));
  const cdp = await ctx.newCDPSession(pg);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await pg.waitForTimeout(4000);
  const m = await pg.evaluate(async () => {
    const calib = () => { const a = new Float64Array(4096); let best = 1e9; for (let r = 0; r < 5; r++) { const t = performance.now(); let s = 0; for (let k = 0; k < 600; k++) for (let i = 0; i < 4096; i++) { a[i] = a[i] * 0.999 + Math.sqrt(i + k); s += a[i]; } best = Math.min(best, performance.now() - t); if (!isFinite(s)) throw new Error('эталон'); } return best; };
    const med = a => a.sort((x, y) => x - y)[a.length >> 1];
    const c0 = calib();
    // тяжёлые кадры: по 4 разных кадра, каждый — заново (без кэша)
    const troll = [], ghost = [];
    for (const fr of ['i3', 'w5', 'a4', 'h2']) { const S = NA_SPEC.troll, P = naPose(fr); P.pal = S.pal || null; const t = performance.now(); naPxFrame('troll', S, P, fr); troll.push(performance.now() - t); }
    for (const [v, md, f] of [['A', 'idle', 5], ['B', 'boo', 7], ['A', 'atk', 3], ['B', 'flee', 9]]) { delete FZ_CVC['gh' + v + md + f]; const t = performance.now(); ghostPxSprite(v, md, f, ''); ghost.push(performance.now() - t); }
    // render на сейве: прогрев, потом медиана по кадрам
    const rnd = async z => {
      R.cam.z = z; const b = Game.buildings.find(b => b.type === 'storehouse') || Game.buildings[0]; centerOn((b.x + 2) * TILE, (b.y + 2) * TILE);
      for (let i = 0; i < 40; i++) await new Promise(r => requestAnimationFrame(r));
      const a = []; for (let i = 0; i < 15; i++) { await new Promise(r => requestAnimationFrame(r)); const t = performance.now(); render(); a.push(performance.now() - t); }
      return med(a);
    };
    Game.paused = true;
    const r1 = await rnd(1), r05 = await rnd(0.5);
    const cal = Math.min(c0, calib()), u = ms => +(ms / cal * 10).toFixed(2);
    return { cal: +cal.toFixed(1), troll: u(med(troll)), ghost: u(med(ghost)), render1: u(r1), render05: u(r05), ms: { troll: Math.round(med(troll)), ghost: Math.round(med(ghost)), r1: +r1.toFixed(1), r05: +r05.toFixed(1) } };
  });
  await br.close(); srv.close();
  console.log(`Проверка: эталон ${m.cal} мс; тролль ${m.troll} ед. (${m.ms.troll} мс), призрак ${m.ghost} (${m.ms.ghost} мс), render z=1 ${m.render1} (${m.ms.r1} мс), z=0.5 ${m.render05} (${m.ms.r05} мс)`);
  const fails = [];
  if (!REPORT) for (const k of Object.keys(BUDGET)) if (m[k] > BUDGET[k]) fails.push(`${k}: ${m[k]} > ${BUDGET[k]} ед. машины`);
  if (errs.length) fails.push('ошибки страницы: ' + errs.slice(0, 3).join(' | '));
  for (const f of fails) console.log('  ✗ ' + f);
  console.log(fails.length ? `Проверка: провалов ${fails.length}` : 'Проверка: бюджет отрисовки — в порядке');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
