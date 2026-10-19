'use strict';
// Собирает папку www/ для обёрток (Electron, Capacitor): копия игры с минификацией js/css.
// Использование: node build-www.js <папка-назначения> [--keep-analytics] [--no-minify]
// Игра — набор обычных <script> без модулей, поэтому каждый файл минифицируется отдельно (имена верхнего уровня esbuild не трогает).
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const out = path.resolve(process.argv[2] || path.join(__dirname, 'www'));
const keepStats = process.argv.includes('--keep-analytics');
const minify = !process.argv.includes('--no-minify');
let esbuild = null;
try { esbuild = require('esbuild'); } catch (e) { console.warn('esbuild не найден — без минификации'); }

fs.rmSync(out, { recursive: true, force: true });
const copy = (rel) => {
  const src = path.join(ROOT, rel), dst = path.join(out, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  const ext = path.extname(rel);
  if (esbuild && minify && (ext === '.js' || ext === '.css')) {
    const code = esbuild.transformSync(fs.readFileSync(src, 'utf8'), { loader: ext.slice(1), minify: true, legalComments: 'none' }).code;
    fs.writeFileSync(dst, code);
  } else fs.copyFileSync(src, dst);
};
const walk = (rel) => {
  for (const f of fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true })) {
    const r = path.join(rel, f.name);
    if (f.isDirectory()) walk(r); else copy(r);
  }
};
for (const d of ['js', 'css', 'fonts', 'icons']) if (fs.existsSync(path.join(ROOT, d))) walk(d);
for (const f of ['favicon.svg', 'manifest.webmanifest', 'privacy.html']) if (fs.existsSync(path.join(ROOT, f))) copy(f);

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
if (!keepStats) html = html.replace(/<script[^>]*goatcounter[^>]*><\/script>\s*/g, '');   // в магазинных сборках внешних запросов статистики нет
html = html.replace(/<script src="js\/pwa\.js"><\/script>\s*/, '');                       // офлайн и так: файлы локальные
fs.writeFileSync(path.join(out, 'index.html'), html);

let n = 0, bytes = 0;
(function count(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) count(p); else { n++; bytes += fs.statSync(p).size; } } })(out);
console.log(`www: ${n} файлов, ${(bytes / 1048576).toFixed(2)} МБ → ${out}`);
