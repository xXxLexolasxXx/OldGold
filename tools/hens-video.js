// Видео мести кур: новая партия, гном на чистой поляне в 7 клетках от птичьего двора, куры догоняют и пинают.
// Пишется webm через playwright, потом ffmpeg режет по холсту и делает mp4.
const { chromium } = require('D:/для игры/feod/tools/browsers/node_modules/playwright-core');
const { execFileSync } = require('child_process'), fs = require('fs'), path = require('path');
const OUT = __dirname.replace(/\\/g, '/'), URL = process.env.URL || 'http://localhost:8974/';
const FF = 'C:/Users/Тема/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
const W = 1280, H = 800, Z = +(process.env.Z || 4);
(async () => {
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const vdir = OUT + '/vid'; fs.rmSync(vdir, { recursive: true, force: true });
  fs.mkdirSync(vdir, { recursive: true });
  const ctx = await br.newContext({ viewport: { width: W, height: H } });
  const pg = await ctx.newPage(), errs = [];
  // кадры — скринкастом через CDP (без ffmpeg самого playwright), в vid/f00001.png…
  const cdp = await ctx.newCDPSession(pg); let nf = 0, tFirst = 0, tLast = 0, rec = false;
  cdp.on('Page.screencastFrame', async e => { if (rec) { nf++; if (!tFirst) tFirst = e.metadata.timestamp; tLast = e.metadata.timestamp; fs.writeFileSync(`${vdir}/f${String(nf).padStart(5, '0')}.png`, Buffer.from(e.data, 'base64')); } await cdp.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {}); });
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(URL); await pg.waitForTimeout(2500);
  const click = async t => { await pg.getByText(t, { exact: true }).first().click({ timeout: 8000 }).catch(() => console.log('нет кнопки', t)); await pg.waitForTimeout(700); };
  await click('Новая игра'); await click('Свободная игра'); await click('Малая'); await click('Дальше'); await click('Обычный');
  await pg.waitForTimeout(2500); await click('В путь'); await pg.waitForTimeout(2000);
  for (let k = 0; k < 4; k++) { const b = pg.getByText('Пропустить', { exact: true }); const n = await b.count(); for (let i = 0; i < n; i++) await b.nth(i).click({ timeout: 1000 }).catch(() => {}); await pg.waitForTimeout(300); }
  const info = await pg.evaluate((Z) => {
    // чистая поляна: трава, в радиусе 4 нет домов, деревьев, камней, дорог и воды; в 6–9 клетках от кур двора
    const hens = Game.animals.filter(a => a.kind === 'chicken'), hx = hens.reduce((s, a) => s + a.x, 0) / hens.length, hy = hens.reduce((s, a) => s + a.y, 0) / hens.length;
    let best = null, bd = 1e9;
    const big = o => o && (o.t === 'tree' || o.t === 'stone' || o.t === 'fort' || o.t === 'sandc');
    for (let pass = 0; pass < 2 && !best; pass++) for (let y = 4; y < MAP_H - 4; y++) for (let x = 4; x < MAP_W - 4; x++) {
      const d = Math.hypot(x - hx, y - hy); if (d < 5 || d > 10) continue;
      let ok = true, bad = 0;
      for (let j = -3; j <= 3 && ok; j++) for (let i = -3; i <= 3 && ok; i++) { const q = idx(x + i, y + j); if (World.bmap[q] || World.terrain[q] === T_WATER || World.terrain[q] === T_ROCK) ok = false; else if (!isWalkable(x + i, y + j) || big(World.obj[q]) || World.road[q]) bad++; }
      if (!ok || (pass === 0 && bad)) continue;
      // коридор побега: гном удирает от кур ещё на 6 клеток — там тоже должно быть чисто
      const fx = (x - hx) / d, fy = (y - hy) / d; let cor = 0;
      for (let s = 1; s <= 7 && ok; s++) for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const px = Math.round(x + fx * s) + i, py = Math.round(y + fy * s) + j; if (!inb(px, py)) { ok = false; break; } const q = idx(px, py); if (World.bmap[q] || World.terrain[q] === T_WATER || World.terrain[q] === T_ROCK) ok = false; else if (!isWalkable(px, py) || big(World.obj[q]) || World.road[q]) cor++; }
      if (!ok || (pass === 0 && cor)) continue;
      const sc = Math.abs(d - 7.5) + bad * 0.5 + cor * 0.3; if (sc < bd) { bd = sc; best = [x, y]; }
    }
    if (!best) return 'нет поляны';
    { const d = Math.hypot(best[0] - hx, best[1] - hy), fx = (best[0] - hx) / d, fy = (best[1] - hy) / d;            // для демо: расчистить деревья и камни на поляне и в коридоре
      for (let s = 0; s <= 7; s++) for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) { const px = Math.round(best[0] + fx * s) + i, py = Math.round(best[1] + fy * s) + j; if (inb(px, py) && big(World.obj[idx(px, py)])) World.obj[idx(px, py)] = null; } }
    const u = Game.units.find(u => !u.inside && !u.dead && isPerson(u) && u.type !== 'hero' && u.type !== 'carter' && u.type !== 'kid');
    u.path = null; u.proc = null; u.action = null; u.brk = null; u.x = best[0] + 0.5; u.y = best[1] + 0.5; u.carry = null;
    // спрятать всё, кроме холста игры: панели, виньетку, обучение, всплывающие окна (и дальше — каждый тик)
    window.__hide = () => { let el = R.canvas; while (el && el !== document.body) { for (const s of el.parentElement.children) if (s !== el && s.style.display !== 'none') s.style.display = 'none'; el = el.parentElement; } };
    window.__hide();
    R.cam.z = Z; Game.speed = 1; window.__v = u; window.__hc = [hx, hy];
    triggerAvenge(u);
    return JSON.stringify({ spot: best, hens: hens.length, hc: [hx | 0, hy | 0], type: u.type });
  }, Z);
  console.log(info);
  await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1, maxWidth: W, maxHeight: H }); rec = true;
  const t0 = Date.now(); let last = '', rect = null;
  while (Date.now() - t0 < 45000) {
    const st = await pg.evaluate(() => {
      const ev = (Game.avenge || [])[0], u = window.__v, cv = R.canvas, d = screenDPR();
      // камера: на сбегании — между курами и гномом, дальше — за гномом (середина полёта при пинке)
      const hs = Game.animals.filter(a => a.avenge), hx = hs.length ? hs.reduce((s, a) => s + a.x, 0) / hs.length : u.x, hy = hs.length ? hs.reduce((s, a) => s + a.y, 0) / hs.length : u.y;
      const ux = u.knock ? u.knock.x0 + u.knock.dx * 0.5 : u.x, uy = u.knock ? u.knock.y0 + u.knock.dy * 0.5 : u.y;
      const k = ev && ev.phase === 'gather' ? 0.5 : 1, cx = ux * k + hx * (1 - k), cy = uy * k + hy * (1 - k);
      const tx = cx * TILE - cv.width / (R.cam.z * d) / 2, ty = cy * TILE - cv.height / (R.cam.z * d) / 2;
      if (!window.__camOk) { R.cam.x = tx; R.cam.y = ty; window.__camOk = 1; } else { R.cam.x += (tx - R.cam.x) * 0.2; R.cam.y += (ty - R.cam.y) * 0.2; }
      window.__hide();
      const r = cv.getBoundingClientRect();
      return JSON.stringify({ ph: ev ? ev.phase : 'none', inj: u.injury, rect: [r.left, r.top, r.width, r.height] });
    });
    const o = JSON.parse(st); rect = o.rect;
    if (st.slice(0, 30) !== last.slice(0, 30)) { last = st; console.log((Date.now() - t0) / 1000 | 0, o.ph, o.inj); }
    if (o.ph === 'none' && o.inj && Date.now() - t0 > 6000) { await pg.waitForTimeout(3500); break; }
    await pg.waitForTimeout(40);
  }
  rec = false; await cdp.send('Page.stopScreencast').catch(() => {});
  const fps = Math.max(5, Math.round(nf / Math.max(0.5, tLast - tFirst)));
  console.log('ошибки:', errs.length, errs.slice(0, 3).join(' | '), 'кадров', nf, 'fps', fps);
  await ctx.close(); await br.close();
  // обрезка: окно 900×640 по центру холста, mp4 для Telegram
  const cx = Math.round(rect[0] + rect[2] / 2), cy = Math.round(rect[1] + rect[3] / 2), cw = 900, ch = 640;
  const x0 = Math.max(0, Math.min(W - cw, cx - cw / 2)), y0 = Math.max(0, Math.min(H - ch, cy - ch / 2));
  execFileSync(FF, ['-y', '-ss', '0.6', '-framerate', String(fps), '-i', path.join(vdir, 'f%05d.png'), '-vf', `crop=${cw}:${ch}:${x0}:${y0}`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-r', '30', '-an', OUT + '/kury-mest.mp4'], { stdio: ['ignore', 'ignore', 'inherit'] });
  console.log('mp4 готов');
})();
