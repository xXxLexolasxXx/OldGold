'use strict';
// Проверка загрузки игры без браузера: все файлы из index.html на месте, синтаксис js чистый,
// нет дубликатов и «осиротевших» файлов, список simhost совпадает с index.html, а сами файлы
// реально грузятся друг за другом в нужном порядке (ReferenceError на верхнем уровне = сломанный порядок).
// Запуск: node tests/check-load.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const errors = [], warns = [];
const err = m => errors.push(m), warn = m => warns.push(m);
const exists = p => fs.existsSync(path.join(ROOT, p));

// ---- 1. index.html: скрипты, стили, картинки
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m => m[1]).filter(s => !/^https?:/.test(s));
const seen = new Set();
for (const s of scripts) {
  const clean = s.split('?')[0];
  if (seen.has(clean)) err(`index.html: скрипт подключён дважды: ${clean}`);
  seen.add(clean);
  if (!exists(clean)) err(`index.html: файла нет (404): ${clean}`);
}
for (const m of html.matchAll(/<(?:link|img|source)\b[^>]*\b(?:href|src)="([^"#]+)"/g)) {
  const u = m[1];
  if (/^(https?:|data:|\/\/|mailto:)/.test(u)) continue;
  if (!exists(u.split('?')[0])) err(`index.html: ресурс не найден: ${u}`);
}
// манифест
try {
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  for (const ic of man.icons || []) if (!/^(https?:|data:)/.test(ic.src) && !exists(ic.src)) err(`manifest: иконки нет: ${ic.src}`);
} catch (e) { err('manifest.webmanifest: ' + e.message); }

// ---- 2. Синтаксис всех js (в т.ч. не подключённых)
const allJs = [];
(function walk(d) {
  for (const f of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
    const rel = path.posix.join(d, f.name);
    if (f.isDirectory()) walk(rel); else if (f.name.endsWith('.js')) allJs.push(rel);
  }
})('js');
allJs.push(...fs.readdirSync(path.join(ROOT, 'server')).filter(f => f.endsWith('.js')).map(f => 'server/' + f));
for (const f of allJs) {
  try { execFileSync(process.execPath, ['--check', path.join(ROOT, f)], { stdio: 'pipe' }); }
  catch (e) { err(`синтаксис ${f}: ` + String(e.stderr || e.message).split('\n').slice(0, 5).join(' | ')); }
}

// ---- 3. Осиротевшие js и ссылки на старые пути
for (const f of allJs.filter(f => f.startsWith('js/'))) if (!seen.has(f) && f !== 'js/coop/coopsim.js' && !f.startsWith('js/i18n/')) warn(`файл не подключён в index.html: ${f}`);
for (const f of allJs.filter(f => f.startsWith('js/'))) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of src.matchAll(/['"`](js\/[\w\/.-]+\.js)['"`]/g)) if (!exists(m[1])) err(`${f}: ссылка на несуществующий файл ${m[1]}`);
}

// ---- 4. simhost: список совпадает с index.html (без пропусков меню/звука) и всё реально грузится
let FILES = [];
try {
  const host = require('../server/simhost');
  FILES = host.FILES;
  for (const f of FILES) if (!exists(`js/${f}.js`)) err(`simhost: файла нет: js/${f}.js`);
  const order = scripts.map(s => s.replace(/^js\//, '').replace(/\.js.*$/, ''));
  let last = -1;
  for (const f of FILES.filter(x => x !== 'coop/coopsim')) {
    const i = order.indexOf(f);
    if (i < 0) err(`simhost: ${f} нет в index.html`);
    else { if (i < last) err(`simhost: порядок отличается от index.html на ${f}`); last = i; }
  }
  host.createHost(m => err('simhost загрузка: ' + m));
} catch (e) { err('simhost не загрузился: ' + (e && e.stack || e).toString().split('\n').slice(0, 4).join(' | ')); }

// ---- 5. Серверные файлы раздачи не должны ссылаться на отсутствующее
if (!exists('server/server.js')) err('нет server/server.js');

console.log(`Проверка загрузки: ${scripts.length} скриптов в index.html, ${allJs.length} js-файлов проверено, в симуляции ${FILES.length}.`);
for (const w of warns) console.log('  ⚠ ' + w);
for (const e of errors) console.log('  ✗ ' + e);
console.log(errors.length ? `ОШИБОК: ${errors.length}` : 'OK');
process.exit(errors.length ? 1 : 0);
