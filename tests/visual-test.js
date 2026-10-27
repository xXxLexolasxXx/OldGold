'use strict';
// Визуальные тесты OldGold: Playwright снимает ключевые экраны и сравнивает с эталонами. Запуск:
//   node tests/visual-test.js                 — сравнить с эталонами tests/visual/ref/*.png
//   node tests/visual-test.js --update        — переснять эталоны (после НАМЕРЕННЫХ изменений графики/интерфейса)
//   node tests/visual-test.js --only boss,snd — только кадры, в имени которых есть эти подстроки
//   node tests/visual-test.js --tol 0.3       — допуск: % отличающихся пикселей, при котором кадр ещё «тот же» (0.2)
//   node tests/visual-test.js --pix 60        — порог отличия одного пикселя, |dR|+|dG|+|dB| из 765 (40)
// Детерминизм: поддельные часы Playwright (Date, performance.now, таймеры, requestAnimationFrame) — время идёт
// только когда тест его двигает; Math.random с фиксированным зерном; CSS-анимации выключены при съёмке; чистое хранилище.
// Один браузер за раз, контексты закрываются после каждого размера (память). Подробнее: tests/visual/README.md
const path = require('path'), fs = require('fs'), http = require('http');
const ROOT = path.join(__dirname, '..');
const DIR = path.join(__dirname, 'visual'), REF = path.join(DIR, 'ref'), OUT = path.join(DIR, 'out');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const UPDATE = argv.includes('--update');
const ONLY = arg('only', '').split(',').filter(Boolean);
const TOL = +arg('tol', 0.2);
const PIX = +arg('pix', 40);
const SEED = 20261022, T0 = Date.UTC(2026, 0, 15, 12, 0, 0);
const HIDE = '#ver-badge{visibility:hidden!important} *{caret-color:transparent!important}';   // версия меняется каждое обновление

function loadPw() {
  for (const p of [path.join(ROOT, 'tools/browsers/node_modules/playwright-core'), 'playwright-core', 'playwright']) {
    try { return require(p); } catch (e) {}
  }
  console.error('Нет playwright-core. Установите: cd tools/browsers && npm ci');
  process.exit(2);
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
function serve() {
  return new Promise(res => {
    const s = http.createServer((q, r) => {
      let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p);
      if (p === '/__blank') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end('<!doctype html><body style="margin:0">'); }
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); }
      r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(f).pipe(r);
    }).listen(0, '127.0.0.1', () => res(s));
  });
}

// В страницу до всех скриптов: зерно Math.random, чистое хранилище, язык
function initScript({ seed, lang }) {
  let a = seed >>> 0;
  window.__vtReseed = n => { a = (seed + n * 7919) >>> 0; };   // пересев в контрольных точках сценария
  Math.random = function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  // счётчик загружающихся картинок (new Image() с data:/svg не видно в сетевых запросах) — ждём их между шагами часов
  window.__vtImg = 0;
  const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', { configurable: true, get() { return d.get.call(this); }, set(v) {
    if (!this.__vtw) { this.__vtw = true; window.__vtImg++; const done = () => { window.__vtImg--; this.__vtw = false; this.removeEventListener('load', done); this.removeEventListener('error', done); }; this.addEventListener('load', done); this.addEventListener('error', done); }
    d.set.call(this, v);
  } });
  try { localStorage.clear(); localStorage.setItem('og_lang', lang); } catch (e) {}
  window.__VISUAL_TEST__ = true;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const want = name => !ONLY.length || ONLY.some(o => name.includes(o));

// ---------- Сравнение картинок (в браузере: без зависимостей вроде pngjs) ----------
async function compare(cmpPage, refPng, curPng) {
  return cmpPage.evaluate(async ({ a, b, pix }) => {
    const load = s => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = 'data:image/png;base64,' + s; });
    const [A, B] = await Promise.all([load(a), load(b)]);
    if (A.width !== B.width || A.height !== B.height) return { size: [A.width, A.height, B.width, B.height] };
    const w = A.width, h = A.height, px = im => { const c = new OffscreenCanvas(w, h), x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, w, h); };
    const da = px(A).data, db = px(B).data;
    const out = new ImageData(w, h), o = out.data;
    let n = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let i = 0, p = 0; i < da.length; i += 4, p++) {
      const d = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) + Math.abs(da[i + 3] - db[i + 3]);
      if (d > pix) {
        n++; o[i] = 255; o[i + 1] = 0; o[i + 2] = 0; o[i + 3] = 255;
        const x = p % w, y = (p / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      } else { const g = (db[i] * 0.3 + db[i + 1] * 0.59 + db[i + 2] * 0.11) * 0.35 + 160; o[i] = o[i + 1] = o[i + 2] = g; o[i + 3] = 255; }
    }
    let diff = null;
    if (n) { const c = new OffscreenCanvas(w, h); c.getContext('2d').putImageData(out, 0, 0); const bl = await c.convertToBlob({ type: 'image/png' }); const r = new FileReader(); diff = await new Promise(ok => { r.onload = () => ok(String(r.result).split(',')[1]); r.readAsDataURL(bl); }); }
    return { n, total: w * h, box: n ? [x0, y0, x1, y1] : null, diff };
  }, { a: refPng.toString('base64'), b: curPng.toString('base64'), pix: PIX });
}

// ---------- Размеры ----------
const SIZES = [
  { id: 'desk', viewport: { width: 1280, height: 800 }, mobile: false },
  { id: 'port', viewport: { width: 390, height: 780 }, mobile: true },
  { id: 'land', viewport: { width: 844, height: 390 }, mobile: true },
];

// ---------- Сессия одной вкладки с поддельными часами ----------
async function openGame(browser, base, size, lang, errors) {
  const ctx = await browser.newContext({ viewport: size.viewport, deviceScaleFactor: 1, hasTouch: size.mobile, isMobile: size.mobile, locale: lang === 'en' ? 'en-GB' : 'ru-RU', timezoneId: 'Europe/Moscow', reducedMotion: 'reduce' });
  // часы ставим на весь контекст и ДО своего init-скрипта: иначе в новом документе они стартуют с дрейфом
  // в несколько миллисекунд, и первые таймеры игры попадают то до, то после кадра анимации
  await ctx.clock.install({ time: T0 });
  await ctx.clock.pauseAt(T0 + 1000);
  await ctx.addInitScript(initScript, { seed: SEED, lang });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`${size.id}/${lang}: ` + String(e.message).split('\n')[0]));
  // Часы стоят и идут только шагами STEP. После каждого шага ждём в реальном времени, пока
  // догрузятся файлы и картинки — тогда расписание поддельного времени не зависит от скорости машины.
  let inflight = 0;
  page.on('request', () => inflight++);
  page.on('requestfinished', () => inflight--);
  page.on('requestfailed', () => inflight--);
  const settle = async () => {
    for (let quiet = 0, t = 0; quiet < 3 && t < 15000; t += 15) {
      await sleep(15);
      const img = inflight > 0 ? 1 : await page.evaluate(() => window.__vtImg || 0).catch(() => 0);
      quiet = inflight > 0 || img > 0 ? 0 : quiet + 1;
    }
  };
  const STEP = 100;
  const S = {
    ctx, page, settle,
    reseed: n => page.evaluate(k => window.__vtReseed(k), n),
    adv: async ms => { for (let t = 0; t < ms; t += STEP) { await page.clock.runFor(Math.min(STEP, ms - t)); await settle(); } },
    // ждать условие: время идёт теми же шагами, что и adv, поэтому момент «дождались» одинаков в каждом прогоне
    async until(fn, what, maxMs = 60000, arg) {
      for (let t = 0; t < maxMs; t += STEP) {
        if (await page.evaluate(fn, arg).catch(() => false)) return;
        await page.clock.runFor(STEP); await settle();
      }
      throw new Error('не дождались: ' + what);
    },
    click: sel => page.evaluate(s => { const b = document.querySelector(s); if (!b) throw new Error('нет ' + s); b.click(); }, sel),
    clickText: re => page.evaluate(r => { const b = [...document.querySelectorAll('button')].find(x => x.offsetWidth && new RegExp(r).test(x.textContent)); if (b) b.click(); return !!b; }, re),
  };
  await page.goto(base + '?lang=' + lang, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts && document.fonts.ready); await settle();
  await S.until(() => { const b = document.querySelector('#start-menu [data-sm="new"]'); return b && b.offsetWidth > 0; }, 'стартовое меню', 120000);
  await S.reseed(1);
  await S.adv(3000);
  return S;
}

// стартовое меню → свободная игра → обычная сложность → имя героя по умолчанию
async function startFree(S) {
  await S.reseed(2);
  await S.click('#start-menu [data-sm="new"]'); await S.adv(1500);
  await S.until(() => document.querySelector('#start-menu [data-sm="mode-free"]'), 'выбор режима');
  await S.click('#start-menu [data-sm="mode-free"]'); await S.adv(1500);
  if (await S.page.$('#start-menu [data-sm="map-go"]')) { await S.click('#start-menu [data-sm="map-go"]'); await S.adv(1500); }
  if (await S.page.$('#start-menu [data-sm="diff:normal"]')) { await S.click('#start-menu [data-sm="diff:normal"]'); await S.adv(1500); }
  await S.adv(4000);
  if (await S.clickText('В путь|Set off|On the road|Go')) await S.adv(2000);
  await S.until(() => typeof Game !== 'undefined' && Game.units && Game.units.length > 0 && document.getElementById('loading').classList.contains('hidden'), 'начало игры');
  await S.adv(5000);
}

// убрать всплывающие тосты (их время показа зависит от того, сколько прошло с начала)
const calm = S => S.page.evaluate(() => { document.querySelectorAll('#toasts .toast, #ach-toasts > *').forEach(t => t.remove()); });
// закрыть обучение и сюжетные вставки: кадр game-* показывает их как новичку, остальные кадры — без них
const clean = S => S.page.evaluate(() => {
  if (typeof tutClose === 'function' && typeof Tut !== 'undefined' && Tut.on) tutClose(false);
  for (let i = 0; i < 5 && typeof GoalUI !== 'undefined' && GoalUI.open; i++) goalCloseCut();
  document.querySelectorAll('#toasts .toast, #ach-toasts > *').forEach(t => t.remove());
});

// ---------- Листы спрайтов (рисуем в отдельный холст поверх страницы) ----------
function drawSheet(kind) {
  const old = document.getElementById('vt-sheet'); if (old) old.remove();
  const cells = [];
  if (kind === 'ghost') for (const m of ['idle', 'calm', 'boo', 'atk', 'grab', 'carry']) for (const f of [0, 3, 6]) cells.push([m + f, () => ghostSprite(m, f)]);
  if (kind === 'reaper') for (const v of [0, 1, 2]) for (const m of ['idle', 'boo', 'atk']) for (const f of [0, 4]) cells.push([m + f + 'v' + v, () => reaperSprite(m, f, v)]);
  if (kind === 'golem') for (const v of ['S', 'E', 'N']) for (const [p, f] of [['idle', 0], ['walk', 2], ['walk', 5], ['wave', 6], ['pound', 6], ['flex', 6]]) cells.push([v + p + f, () => golemSprite(v, p, f, true)]);
  if (kind === 'skeleton') {
    for (const [st, mv, face, k] of [['idle', 0, 1, 1], ['idle', 0, -1, 1], ['walk', 1, 1, 1], ['fight', 0, 1, 1], ['rise', 0, 1, 0.5], ['dead', 0, 1, 1]])
      cells.push([st + face, c => { const s = { x: 1.5, y: 2.2, state: st, t: st === 'dead' ? 0.8 : 0, face, phase: 1.3, k, alpha: 1, moving: !!mv, scared: 0, seen: new Set() }; c.save(); c.translate(24 - 1.5 * TILE, 50 - (2.2 * TILE + 6)); drawSkeleton(c, s); c.restore(); }, 48, 56]);
  }
  const SC = kind === 'skeleton' ? 3 : 2, COLS = 6;
  const imgs = cells.map(([n, fn, w, h]) => {
    if (w) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d'); fn(c); return [n, cv]; }
    let im = null; try { im = fn(); } catch (e) { console.error('спрайт ' + n + ': ' + e.message); }
    return [n, im];
  });
  const cw = Math.max(...imgs.map(([, i]) => i ? i.width : 1)), ch = Math.max(...imgs.map(([, i]) => i ? i.height : 1));
  const rows = Math.ceil(imgs.length / COLS);
  // лист целиком влезает в 1280×800: целый масштаб, если получается, иначе дробный (без сглаживания)
  const fit = Math.min(SC, (1280 - 8 * COLS) / (cw * COLS), (800 - 8 * rows) / (ch * rows)), k = fit >= 1 ? Math.floor(fit) : fit;
  const cv = document.createElement('canvas'); cv.id = 'vt-sheet';
  cv.width = Math.ceil(COLS * (cw * k + 8)); cv.height = Math.ceil(rows * (ch * k + 8));
  cv.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;image-rendering:pixelated;background:#3c5a2a';
  const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.fillStyle = '#3c5a2a'; c.fillRect(0, 0, cv.width, cv.height);
  imgs.forEach(([, im], i) => {
    const x = Math.round((i % COLS) * (cw * k + 8) + 4), y = Math.round(Math.floor(i / COLS) * (ch * k + 8) + 4);
    c.fillStyle = (i + Math.floor(i / COLS)) & 1 ? '#45663a' : '#4f7442'; c.fillRect(x, y, Math.round(cw * k), Math.round(ch * k));
    if (im) c.drawImage(im, Math.round(x + (cw - im.width) * k / 2), Math.round(y + (ch - im.height) * k), Math.round(im.width * k), Math.round(im.height * k));
    else { c.strokeStyle = '#f0f'; c.lineWidth = 3; c.strokeRect(x, y, cw * k, ch * k); }
  });
  document.body.appendChild(cv);
  return [cv.width, cv.height, imgs.filter(([, im]) => !im).map(([n]) => n)];
}

// ---------- Сценарий ----------
// каждый кадр: имя → функция, которая готовит экран и возвращает опции снимка (clip/element) или null — снять весь экран
function scenes(size, lang) {
  const L = [];
  const add = (name, fn) => L.push([name, fn]);
  const sfx = lang === 'en' ? '-en' : '';
  add('menu-' + size.id + sfx, async () => null);
  add('game-' + size.id + sfx, async S => { await startFree(S); await calm(S); return null; });
  if (lang === 'en') {
    if (size.id === 'desk') add('building-desk-en', async S => { await clean(S); await openBuilding(S, 'hire'); return null; });
    return L;
  }
  add('panel-' + size.id, async S => {
    await clean(S); await S.adv(1000);
    if (size.mobile) { await S.page.evaluate(() => mobileTab('build')); await S.adv(800); await calm(S); return null; }
    await calm(S); return { element: '#panel' };
  });
  add('building-' + size.id, async S => { await openBuilding(S, 'plain'); return null; });
  add('hire-' + size.id, async S => { await openBuilding(S, 'hire'); return null; });
  add('sound-' + size.id, async S => {
    await S.page.evaluate(() => { if (typeof mobileSheet === 'function' && document.body.classList.contains('mobile')) mobileSheet(null); selectBuilding(null); document.querySelectorAll('.dd').forEach(d => d.classList.remove('open')); document.getElementById('dd-snd').classList.add('open'); });
    await S.adv(600); await calm(S); return null;
  });
  add('boss-' + size.id, async S => {
    await clean(S);
    await S.page.evaluate(() => {
      document.querySelectorAll('.dd').forEach(d => d.classList.remove('open'));
      selectBuilding(null);
      let k = 0; while (!isNightNow() && k++ < 100000) Game.time += 5;   // князь встаёт только ночью
      const site = Game.raid && Game.raid.site, h = Game.units.find(u => u.hero) || Game.units[0];
      const x = site ? site.x : Math.round(h.x) + 3, y = site ? site.y + 2 : Math.round(h.y) + 1;
      const N = raidStart('kurgan', x, y);
      if (!N) throw new Error('raidStart не запустил бой: ' + JSON.stringify({ kinds: Object.keys(RAID_KINDS), f: !!(Game.raid && Game.raid.f) }));
      for (const u of Game.units) if (u.hero) { u.x = x + 2.5; u.y = y + 1.5; }   // герои рядом — иначе бой сразу кончается
      centerOn(x * TILE, (y - 1.5) * TILE);
    });
    await S.adv(2500); await clean(S); return null;
  });
  add('malgor-' + size.id, async S => {
    await S.page.evaluate(() => {
      if (Game.raid && Game.raid.f) raidEnd('test');
      goalOpenCut({ seq: 999, kind: 'chapter', lines: [['mrak', 'Шум. Опять шум. Вы, гномы, когда-нибудь копаете молча?']] });
    });
    await S.adv(800); await calm(S); return null;
  });
  if (size.id === 'desk') for (const k of ['ghost', 'reaper', 'skeleton', 'golem'])
    add('sprite-' + k, async S => {
      const [w, h, miss] = await S.page.evaluate(drawSheet, k);
      if (miss.length) throw new Error('не нарисовались спрайты: ' + miss.join(', '));
      return { clip: { x: 0, y: 0, width: Math.min(w, 1280), height: Math.min(h, 800) } }; });
  return L;
}

// выделить здание: plain — жилой дом (без найма), hire — мастерская с работником
async function openBuilding(S, kind) {
  const ok = await S.page.evaluate(k => {
    document.querySelectorAll('.dd').forEach(d => d.classList.remove('open'));
    const done = b => b && !b.site && (b.done === undefined || b.done) && !(b.progress < 1);
    const list = Game.buildings.filter(done);
    // в начале игры мастерских нет — ставим готовый дом лесоруба по спирали от героя (зерно фиксировано — место то же)
    if (k === 'hire' && !list.some(b => b.def && b.def.worker)) {
      const h = Game.units.find(u => u.hero) || Game.units[0], hx = Math.round(h.x), hy = Math.round(h.y);
      outer: for (let r = 2; r < 30; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (!checkPlacement('woodcutter', hx + dx, hy + dy)) { list.push(placeBuilding('woodcutter', hx + dx, hy + dy, true)); break outer; }
      }
    }
    const b = k === 'hire' ? list.find(b => b.def && b.def.worker) : list.find(b => b.def && !b.def.worker && /house|дом/i.test(b.type + ' ' + b.def.name)) || list.find(b => b.def && !b.def.worker);
    if (!b) return false;
    centerOn((b.x + (b.def.w || 2) / 2) * TILE, (b.y + (b.def.h || 2) / 2) * TILE);
    selectBuilding(b);
    return b.type;
  }, kind);
  if (!ok) throw new Error('нет подходящего здания: ' + kind);
  await S.adv(800);
  // окно найма — прокрутить панель здания к блоку «Работник»
  if (kind === 'hire') await S.page.evaluate(() => { const h = [...document.querySelectorAll('.isec')].find(e => e.offsetParent && /Работник|Worker/.test(e.textContent)); if (h) h.scrollIntoView({ block: 'start' }); });
  await S.adv(300); await calm(S);
}

// ---------- Главный цикл ----------
(async () => {
  const pw = loadPw();
  fs.mkdirSync(REF, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (f.endsWith('.png')) fs.unlinkSync(path.join(OUT, f));
  const srv = await serve(), base = `http://127.0.0.1:${srv.address().port}/`;
  const exe = process.env.VT_CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(fs.existsSync);
  const browser = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--force-color-profile=srgb', '--font-render-hinting=none', '--disable-lcd-text', '--disable-gpu', '--autoplay-policy=user-gesture-required', '--mute-audio'] });
  const cmpCtx = await browser.newContext(); const cmp = await cmpCtx.newPage(); await cmp.goto(base + '__blank');
  const errors = [], res = [];
  const t00 = Date.now();
  const plan = [];
  for (const size of SIZES) plan.push([size, 'ru']);
  plan.push([SIZES[0], 'en'], [SIZES[1], 'en']);
  for (const [size, lang] of plan) {
    const L = scenes(size, lang);
    // сценарий идёт подряд в одной вкладке; если ни один кадр не нужен (--only) — пропускаем размер целиком
    const lastWanted = L.reduce((m, [n], i) => want(n) ? i : m, -1);
    if (lastWanted < 0) continue;
    let S = null;
    try {
      S = await openGame(browser, base, size, lang, errors);
      for (let i = 0; i <= lastWanted; i++) {
        const [name, fn] = L[i];
        process.stdout.write(`▶ ${name} … `);
        const t0 = Date.now();
        let opt;
        try { await S.reseed(10 + i); opt = await fn(S); } catch (e) { console.log('✗ сценарий: ' + String(e.message).split('\n')[0]); res.push({ name, fail: 'сценарий: ' + e.message }); continue; }
        if (!want(name)) { console.log('пропуск'); continue; }
        const shotOpt = { animations: 'disabled', caret: 'hide', style: HIDE, scale: 'css' };
        let png;
        if (opt && opt.element) png = await S.page.locator(opt.element).first().screenshot(shotOpt);
        else png = await S.page.screenshot(Object.assign(shotOpt, opt && opt.clip ? { clip: opt.clip } : {}));
        const ref = path.join(REF, name + '.png');
        const ms = ((Date.now() - t0) / 1000).toFixed(1);
        if (UPDATE || !fs.existsSync(ref)) {
          fs.writeFileSync(ref, png);
          console.log(`${UPDATE ? '★ эталон обновлён' : '★ эталона не было — записан'} (${ms} с)`);
          res.push({ name, created: true });
          continue;
        }
        const r = await compare(cmp, fs.readFileSync(ref), png);
        if (r.size) {
          fs.writeFileSync(path.join(OUT, name + '.png'), png);
          console.log(`✗ размер ${r.size[0]}×${r.size[1]} → ${r.size[2]}×${r.size[3]}`);
          res.push({ name, fail: 'другой размер' }); continue;
        }
        const pct = 100 * r.n / r.total;
        if (r.n) { fs.writeFileSync(path.join(OUT, name + '.png'), png); fs.writeFileSync(path.join(OUT, name + '.diff.png'), Buffer.from(r.diff, 'base64')); }
        if (pct > TOL) { console.log(`✗ отличается ${pct.toFixed(2)}% (${r.n} пикс., область ${r.box.join(',')}) (${ms} с)`); res.push({ name, fail: pct.toFixed(2) + '%' }); }
        else { console.log(`✓ ${r.n ? pct.toFixed(3) + '%' : 'совпадает'} (${ms} с)`); res.push({ name, ok: true }); }
      }
    } catch (e) {
      console.log('✗ ' + size.id + '/' + lang + ': ' + String(e.message).split('\n')[0]);
      res.push({ name: size.id + '/' + lang, fail: e.message });
    } finally { if (S) await S.ctx.close(); }
  }
  await browser.close(); srv.close();
  const fails = res.filter(r => r.fail), made = res.filter(r => r.created);
  console.log(`\nКадров: ${res.length}, совпало: ${res.filter(r => r.ok).length}, записано эталонов: ${made.length}, провалов: ${fails.length} (${((Date.now() - t00) / 1000).toFixed(0)} с)`);
  if (errors.length) { console.log('Ошибки страницы:'); for (const e of [...new Set(errors)].slice(0, 20)) console.log('  ! ' + e); }
  if (fails.length) console.log(`Различия: ${path.relative(ROOT, OUT)}/<кадр>.diff.png (красное — отличия), <кадр>.png — как сейчас. Если изменение намеренное: node tests/visual-test.js --update --only <кадр>`);
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
