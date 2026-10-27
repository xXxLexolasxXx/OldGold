// Ролик для согласования призрака: node tools/pxghost/video.js out.mp4 — снимает anim.html покадрово (24 к/с, 12 с) и собирает ffmpeg.
const path = require('path'), fs = require('fs'), os = require('os'), { execFileSync } = require('child_process');
const { chromium } = require('D:/для игры/feod/tools/browsers/node_modules/playwright-core');
(async () => {
  const out = path.resolve(process.argv[2] || 'ghost.mp4'), FPS = 24, DUR = 12;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghvid-'));
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--allow-file-access-from-files'] });
  const pg = await br.newPage();
  pg.on('pageerror', e => console.log('pageerror', e.message));
  await pg.goto('file:///' + path.resolve(__dirname, 'anim.html').split(path.sep).join('/'));
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
