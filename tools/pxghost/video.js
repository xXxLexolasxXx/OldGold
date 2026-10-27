// Ролик для согласования призрака: node tools/pxghost/video.js out.mp4 [страница.html] [к/с] — снимает страницу покадрово (12 с) и собирает ffmpeg.
// anim.html (по умолчанию, 24 к/с) — шаги 6/8/12 и облики A/B/C; steps.html (30 к/с) — шаги 12/16/20/24/30.
const path = require('path'), fs = require('fs'), os = require('os'), { execFileSync } = require('child_process');
const { chromium } = require('D:/для игры/feod/tools/browsers/node_modules/playwright-core');
(async () => {
  const out = path.resolve(process.argv[2] || 'ghost.mp4'), FPS = +process.argv[4] || 24, DUR = 12;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghvid-'));
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--allow-file-access-from-files'] });
  const pg = await br.newPage();
  pg.on('pageerror', e => console.log('pageerror', e.message));
  await pg.goto('file:///' + path.resolve(__dirname, process.argv[3] || 'anim.html').split(path.sep).join('/'));
  await pg.waitForFunction(() => document.title !== '…', null, { timeout: 120000 });
  console.log(await pg.title());
  for (let i = 0; i < FPS * DUR; i++) {
    const data = await pg.evaluate(t => { frameAt(t); return document.getElementById('cv').toDataURL('image/png'); }, i / FPS);
    fs.writeFileSync(path.join(dir, `f${String(i).padStart(4, '0')}.png`), Buffer.from(data.split(',')[1], 'base64'));
  }
  await br.close();
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', out]);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('ok', out);
})();
