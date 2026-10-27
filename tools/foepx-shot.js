// Снимок листа слуг Малгора: node tools/foepx-shot.js [all|frames|big] [файл.png] [виды через запятую для big]
// Страницу tools/foepx-sheet.html собирает этот же скрипт из списка скриптов tools/pxfine-check.html (+ foepx.js).
const path = require('path'), fs = require('fs');
const { chromium } = require(process.env.PW_CORE || 'D:/для игры/feod/tools/browsers/node_modules/playwright-core');
const src = fs.readFileSync(path.join(__dirname, 'pxfine-check.html'), 'utf8'), files = JSON.parse(src.match(/const PXS_FILES = (\[.*?\]);/)[1]);
if (!files.includes('../js/world/foepx.js')) files.splice(files.indexOf('../js/world/foeart.js') + 1, 0, '../js/world/foepx.js');
fs.writeFileSync(path.join(__dirname, 'foepx-sheet.html'), `<!doctype html><meta charset=utf-8><title>…</title>
<body style="margin:0;background:#1d2e26"><canvas id=cv></canvas>
<script>
window.PXS_NOSTART = true;
const FILES = ${JSON.stringify(files)};
window.addEventListener('load', () => setTimeout(async () => {
  const load = src => new Promise(r => { const s = document.createElement('script'); s.src = src; s.onload = s.onerror = r; document.body.appendChild(s); });
  for (const f of FILES) await load(f);
  await load('foepx-sheet.js');
  try { foeSheet(new URLSearchParams(location.search).get('s') || 'all'); document.title = 'ready'; } catch (e) { document.title = 'fail ' + e.message; console.error(e.stack); }
}, 50));
</script>
`);
(async () => {
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--allow-file-access-from-files'] });
  const pg = await br.newPage();
  pg.on('pageerror', e => console.log('pageerror', e.message));
  pg.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && /foepx/.test(m.text()))) console.log(m.type(), m.text().slice(0, 400)); });
  const mode = process.argv[2] || 'all';
  await pg.goto('file:///' + path.resolve(__dirname, 'foepx-sheet.html').replace(/\\/g, '/') + '?s=' + mode + (process.argv[4] ? '&k=' + process.argv[4] : ''));
  await pg.waitForFunction(() => document.title.startsWith('ready') || document.title.startsWith('fail'), null, { timeout: 180000 });
  console.log(mode, await pg.title());
  const data = await pg.evaluate(() => document.getElementById('cv').toDataURL('image/png'));
  fs.writeFileSync(process.argv[3] || path.join(__dirname, 'check-foepx-' + mode + '.png'), Buffer.from(data.split(',')[1], 'base64'));
  await br.close();
})();
