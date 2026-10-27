'use strict';
// Эмуляция браузеров и слабых телефонов (Playwright). Запуск:
//   node tools/browsers/run.js [--engine chromium|webkit|firefox] [--profile имя] [--cpu N] [--quick 1]
// Движки webkit/firefox берутся из tools/browsers/pw (PLAYWRIGHT_BROWSERS_PATH), chromium — из установленного Chrome/Edge.
// Эмуляция ≠ реальное устройство: цифры CPU-замедления ориентировочные. Отчёт: БРАУЗЕРЫ_И_ПРОИЗВОДИТЕЛЬНОСТЬ.md
const path = require('path'), fs = require('fs'), http = require('http');
const ROOT = path.join(__dirname, '..', '..');
const OUT = process.env.BR_OUT || path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(__dirname, 'pw');
const pw = require('playwright-core');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ENGINE = arg('engine', 'chromium'), ONLY = arg('profile', ''), QUICK = arg('quick', '0') === '1';
const CPU = +arg('cpu', 0), PRIVATE = arg('private', '0') === '1', NOFILTER = arg('nofilter', '0') === '1';   // nofilter: как Safari — без ctx.filter

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
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

const PROFILES = [
  { name: 'desktop', viewport: { width: 1280, height: 720 }, dpr: 1, mobile: false, cpu: 1 },
  { name: 'iphone-se-portrait', viewport: { width: 375, height: 667 }, dpr: 2, mobile: true, cpu: 1 },
  { name: 'iphone-13-portrait', viewport: { width: 390, height: 844 }, dpr: 3, mobile: true, cpu: 1 },
  { name: 'iphone-13-landscape', viewport: { width: 844, height: 390 }, dpr: 3, mobile: true, cpu: 1 },
  { name: 'iphone-15pm-landscape', viewport: { width: 932, height: 430 }, dpr: 3, mobile: true, cpu: 1 },
  { name: 'android-mid-cpu4', viewport: { width: 393, height: 851 }, dpr: 2.75, mobile: true, cpu: 4 },
  { name: 'android-weak-cpu6', viewport: { width: 360, height: 740 }, dpr: 2, mobile: true, cpu: 6 },
  { name: 'android-weak-landscape-cpu6', viewport: { width: 740, height: 360 }, dpr: 2, mobile: true, cpu: 6 },
];

const sampler = `(ms) => new Promise(res => { const t = []; let last = performance.now(), end = last + ms;
  const f = now => { t.push(now - last); last = now; if (now < end) requestAnimationFrame(f); else res(t); }; requestAnimationFrame(f); })`;
function stats(t) {
  const a = t.slice(2).sort((x, y) => x - y); if (!a.length) return null;
  const sum = a.reduce((p, c) => p + c, 0), q = p => a[Math.min(a.length - 1, Math.floor(a.length * p))];
  return { fps: +(1000 * a.length / sum).toFixed(1), avg: +(sum / a.length).toFixed(1), p95: +q(0.95).toFixed(1), max: +a[a.length - 1].toFixed(1), over50: a.filter(x => x > 50).length };
}

async function launch() {
  if (ENGINE === 'chromium') {
    const exe = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'].find(f => f && fs.existsSync(f));
    return pw.chromium.launch({ executablePath: exe, headless: true, args: ['--enable-precise-memory-info', '--autoplay-policy=user-gesture-required'] });
  }
  return pw[ENGINE].launch({ headless: true });
}

async function runProfile(browser, base, p) {
  const res = { profile: p.name, engine: ENGINE, cpu: CPU || p.cpu, private: PRIVATE, steps: {}, errors: [], warns: [], failedReq: [] };
  const ctxOpts = { viewport: p.viewport, deviceScaleFactor: p.dpr, hasTouch: p.mobile };
  if (ENGINE !== 'firefox') ctxOpts.isMobile = p.mobile;
  const ctx = await browser.newContext(ctxOpts);
  if (PRIVATE) await ctx.addInitScript(() => {   // как приватный режим Safari: хранилище бросает при записи
    const boom = () => { throw new DOMException('The quota has been exceeded.', 'QuotaExceededError'); };
    Storage.prototype.setItem = boom;
    try { Object.defineProperty(window, 'indexedDB', { get() { return undefined; } }); } catch (e) {}
  });
  if (NOFILTER) await ctx.addInitScript(() => { try { delete CanvasRenderingContext2D.prototype.filter; } catch (e) {} });
  const page = await ctx.newPage();
  page.on('pageerror', e => res.errors.push('pageerror: ' + String(e.stack || e.message).split('\n').slice(0, 3).join(' | ')));
  page.on('console', m => { if (m.type() === 'error') res.errors.push('console: ' + m.text().slice(0, 300)); else if (m.type() === 'warning') res.warns.push(m.text().slice(0, 200)); });
  page.on('requestfailed', r => res.failedReq.push(r.url().replace(base, '/') + ' ' + (r.failure() || {}).errorText));
  page.on('response', r => { if (r.status() >= 400) res.failedReq.push(r.status() + ' ' + r.url().replace(base, '/')); });
  const cpu = CPU || p.cpu;
  if (cpu > 1 && ENGINE === 'chromium') { const c = await ctx.newCDPSession(page); await c.send('Emulation.setCPUThrottlingRate', { rate: cpu }); }
  const tag = `${ENGINE}-${p.name}${PRIVATE ? '-priv' : ''}${NOFILTER ? '-nofilter' : ''}`;
  const shot = async n => { try { await page.screenshot({ path: path.join(OUT, `${tag}-${n}.png`) }); } catch (e) {} };
  const step = async (name, fn) => { const t = Date.now(); try { res.steps[name] = Object.assign({ ok: true }, await fn()); } catch (e) { res.steps[name] = { ok: false, err: String(e.message).split('\n')[0] }; } res.steps[name].ms = Date.now() - t; };

  await step('load', async () => {
    const t = Date.now();
    await page.goto(base, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof StartMenu !== 'undefined' && document.querySelector('#start-menu [data-sm="new"]') && document.querySelector('#start-menu [data-sm="new"]').offsetWidth > 0, null, { timeout: 150000 });
    const loadMs = Date.now() - t;
    await page.waitForTimeout(2500);
    await shot('1-menu');
    return { loadMs };
  });
  await step('menu-overflow', async () => page.evaluate(() => {
    const bad = []; const vw = innerWidth, vh = innerHeight;
    document.querySelectorAll('#start-menu button').forEach(b => { const r = b.getBoundingClientRect(); if (r.width && (r.right > vw + 1 || r.bottom > vh + 1 || r.left < -1 || r.top < -1)) bad.push(b.dataset.sm + ':' + [r.left, r.top, r.right, r.bottom].map(Math.round)); });
    return { ok: !bad.length, bad, scrollW: document.documentElement.scrollWidth, vw };
  }));
  await step('menu-idle-fps', async () => ({ fps: stats(await page.evaluate(`(${sampler})(4000)`)) }));
  await step('new-game', async () => {
    // «Что нового» (показывается при первом запуске) закрываем — заодно проверка, что окно закрывается тапом
    const wn = await page.$('.whatsnew button, #whatsnew button, [class*=whatsnew] button');
    const wnTxt = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.offsetWidth && b.textContent.trim() === 'Понятно').length);
    if (wnTxt) { await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.offsetWidth && b.textContent.trim() === 'Понятно').click()); await page.waitForTimeout(700); }
    await page.click('#start-menu [data-sm="new"]'); await page.waitForTimeout(600); await shot('2-mode');
    await page.click('#start-menu [data-sm="mode-free"]'); await page.waitForTimeout(600);
    if (await page.$('#start-menu [data-sm="map-go"]')) { await shot('2b-map'); await page.click('#start-menu [data-sm="map-go"]'); await page.waitForTimeout(600); }
    if (await page.$('#start-menu [data-sm="diff:normal"]')) { await shot('2c-diff'); await page.click('#start-menu [data-sm="diff:normal"]'); }
    await page.waitForTimeout(3500); await shot('3-after-new');
    return { buildings: await page.evaluate(() => Game.buildings.length), units: await page.evaluate(() => Game.units.length) };
  });
  await step('hero-name', async () => {
    const vis = await page.evaluate(() => { const i = [...document.querySelectorAll('input')].find(x => x.offsetWidth && !x.id.startsWith('sm-')); return !!i; });
    if (vis) { await shot('3b-hero'); await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.offsetWidth && /В путь/.test(x.textContent)); if (b) b.click(); }); await page.waitForTimeout(1200); }
    // подсказки обучения могут перекрыть экран — закрываем тапом по «Понятно/Дальше/Пропустить», если есть
    await page.waitForTimeout(500);
    await shot('4-game'); return { dialog: vis };
  });
  await step('game-fps', async () => {
    const t = stats(await page.evaluate(`(${sampler})(${QUICK ? 4000 : 8000})`));
    const f = await page.evaluate(() => ({ eco: Fps.eco, dpr: devicePixelRatio, cv: [R.canvas.width, R.canvas.height] }));
    return { fps: t, ...f };
  });
  await step('sim-cost', async () => page.evaluate(() => {
    const t = performance.now(); for (let i = 0; i < 200; i++) step(0.05); const ms = (performance.now() - t) / 200;
    return { stepMs: +ms.toFixed(2), units: Game.units.length, buildings: Game.buildings.length };
  }));
  await step('tap-and-drag', async () => {
    const c = page.viewportSize(); const x = c.width / 2, y = c.height / 2;
    if (p.mobile) { await page.touchscreen.tap(x, y); await page.touchscreen.tap(x + 40, y + 20); } else { await page.mouse.click(x, y); }
    await page.waitForTimeout(500);
    const cam = () => page.evaluate(() => ({ x: Math.round(R.cam.x), y: Math.round(R.cam.y) }));
    const c0 = await cam();
    if (p.mobile && ENGINE === 'chromium') {   // настоящий жест пальцем через CDP
      const c = await ctx.newCDPSession(page);
      await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let i = 1; i <= 8; i++) await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - i * 10, y: y - i * 5 }] });
      await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else { await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x - 80, y - 40, { steps: 6 }); await page.mouse.up(); }
    await page.waitForTimeout(300);
    return { cam0: c0, cam1: await cam() };
  });
  await step('audio', async () => {
    await page.mouse.click(10, 10); await page.waitForTimeout(800);
    return page.evaluate(() => ({ hasAC: typeof (window.AudioContext || window.webkitAudioContext) !== 'undefined' }));
  });
  const BIG = path.join(OUT, 'big.json');   // большая деревня: node tools/gen-golden-save.js --out tools/browsers/out/big.json --seed 7 --minutes 150 --size medium --raw
  if (fs.existsSync(BIG)) {
    const text = fs.readFileSync(BIG, 'utf8');
    await step('big-load', async () => {
      const r = await page.evaluate(t => { const t0 = performance.now(); let err = null; try { err = loadSaveText(t); } catch (e) { err = String(e.message); } return { err: err || null, ms: Math.round(performance.now() - t0), units: Game.units.length, buildings: Game.buildings.length }; }, text);
      await page.waitForTimeout(3000); await shot('5-big');
      return r;
    });
    await step('big-fps', async () => ({ fps: stats(await page.evaluate(`(${sampler})(${QUICK ? 4000 : 8000})`)), heap: await page.evaluate(() => performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null) }));
    await step('big-sim', async () => page.evaluate(() => { const t = performance.now(); for (let i = 0; i < 200; i++) step(0.05); return { stepMs: +((performance.now() - t) / 200).toFixed(2), units: Game.units.length, buildings: Game.buildings.length }; }));
    await step('big-css-filter-off', async () => {   // A/B: фильтр saturate/contrast на холсте (CSS) — дорого ли
      const st = await page.addStyleTag({ content: '#game{filter:none !important}' });
      const f = stats(await page.evaluate(`(${sampler})(${QUICK ? 4000 : 8000})`));
      await st.evaluate(e => e.remove());
      return { fps: f };
    });
  }
  await step('save-load', async () => page.evaluate(() => {
    let e1 = null; try { saveGame('manual'); } catch (e) { e1 = String(e.message); }
    const b = Game.buildings.length, u = Game.units.length;
    let ok = null, e2 = null; try { ok = loadGame('manual'); } catch (e) { e2 = String(e.message); }
    return { saveErr: e1, loadErr: e2, loadRet: ok, b0: b, b1: Game.buildings.length, u0: u, u1: Game.units.length };
  }));
  await step('pwa', async () => {
    const mf = await page.evaluate(async () => { const l = document.querySelector('link[rel=manifest]'); if (!l) return null; const r = await fetch(l.href); return r.ok ? await r.json() : null; });
    return { manifest: !!mf, name: mf && mf.name, icons: mf && (mf.icons || []).length, display: mf && mf.display, appleTouchIcon: await page.evaluate(() => !!document.querySelector('link[rel=apple-touch-icon]')), viewportMeta: await page.evaluate(() => (document.querySelector('meta[name=viewport]') || {}).content) };
  });
  if (!QUICK) await step('mem-30min', async () => {
    const out = [];
    for (let k = 0; k < 6; k++) {
      await page.evaluate(() => { for (let i = 0; i < 6000; i++) step(0.05); });   // 300 игровых секунд за проход
      await page.waitForTimeout(1500);
      out.push(await page.evaluate(() => ({ t: Math.round(Game.time), heap: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null, units: Game.units.length })));
    }
    return { samples: out, fps: stats(await page.evaluate(`(${sampler})(3000)`)) };
  });
  res.errors = [...new Set(res.errors)].slice(0, 12); res.warns = [...new Set(res.warns)].slice(0, 5); res.failedReq = [...new Set(res.failedReq)].slice(0, 8);
  await ctx.close();
  return res;
}

(async () => {
  const srv = await serve(); const base = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await launch();
  const all = [];
  for (const p of PROFILES) {
    if (ONLY && !p.name.includes(ONLY)) continue;
    process.stderr.write(`>> ${ENGINE} ${p.name}\n`);
    try { const r = await runProfile(browser, base, p); all.push(r); console.log(JSON.stringify(r)); } catch (e) { all.push({ profile: p.name, fatal: String(e.message), errors: ['pageerror: профиль упал: ' + String(e.message)] }); console.log(JSON.stringify({ profile: p.name, fatal: String(e.message) })); }
  }
  fs.writeFileSync(path.join(OUT, `results-${ENGINE}${PRIVATE ? '-priv' : ''}.json`), JSON.stringify(all, null, 1));
  await browser.close(); srv.close();
  // --strict 1 (CI): код выхода 1, если профиль упал, на странице было исключение (pageerror) или не прошёл ключевой шаг
  if (arg('strict', '0') === '1') {
    const KEY = ['load', 'new-game', 'save-load'];
    const why = r => [...(r.errors || []).filter(e => e.startsWith('pageerror')),
      ...KEY.filter(k => r.steps && r.steps[k] && !r.steps[k].ok).map(k => `шаг ${k}: ${r.steps[k].err}`)];
    const bad = all.length ? all.filter(r => why(r).length) : [{ profile: '(ни одного профиля)', errors: ['pageerror: не запустился'] }];
    for (const r of bad) console.error(`✗ ${r.profile}: ${why(r).join(' | ')}`);
    if (bad.length) process.exit(1);
  }
})();
