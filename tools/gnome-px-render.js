// Рендер листа гномов: node tools/gnome-px-render.js [имя.png] → promo/ref/gnome-px-2026-10-27/
const path = require('path'), fs = require('fs');
const pw = require(path.join(__dirname, 'browsers', 'node_modules', 'playwright-core'));
(async () => {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
  const b = await pw.chromium.launch({ executablePath: exe, headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => console.log('LOG', m.text()));
  await p.goto(require('url').pathToFileURL(path.join(__dirname, 'gnome-px.html')).href);
  await p.waitForFunction('window.READY', null, { timeout: 30000 });
  console.log(await p.evaluate('window.ERR||""'));
  const out = path.join(__dirname, '..', 'promo', 'ref', 'gnome-px-2026-10-27'); fs.mkdirSync(out, { recursive: true });
  const b64 = await p.evaluate("document.getElementById('sheet').toDataURL('image/png').slice(22)");
  const f = path.join(out, process.argv[2] || 'sheet.png'); fs.writeFileSync(f, Buffer.from(b64, 'base64')); console.log(f);
  await b.close();
})();
