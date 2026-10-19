'use strict';
// Приёмник для tools/site-export.html: отдаёт репозиторий статикой и принимает PNG/JSON спрайтов сайта.
// Запуск: node tools/site-export-server.js, затем открыть http://localhost:8791/tools/site-export.html
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'site');
const TYPES = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (req.method === 'POST' && u.startsWith('/save/')) {
    const dest = path.resolve(OUT, u.slice(6));
    if (!dest.startsWith(OUT + path.sep)) { res.writeHead(400); return res.end(); }
    const chunks = []; req.on('data', d => chunks.push(d));
    req.on('end', () => { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, Buffer.concat(chunks)); res.writeHead(200); res.end('ok'); });
    return;
  }
  const f = path.resolve(ROOT, '.' + u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(8791, '127.0.0.1', () => console.log('http://localhost:8791/tools/site-export.html'));
