// Собирает js/i18n/en-*.js из снимка src-ru.txt и переводов tools/i18n/en/*.txt (строка в строку).
// Формат переводов: «##### файл» и столько же строк, сколько в снимке. Проверяет число строк и плейсхолдеры {n}.
const fs = require('fs'), path = require('path');
const D = __dirname;
function sections(txt) { const m = new Map(); let cur = null; for (const l of txt.split('\n')) { if (l.startsWith('##### ')) { cur = l.slice(6).trim(); m.set(cur, []); } else if (cur && l !== '') m.get(cur).push(l); } return m; }
const src = sections(fs.readFileSync(D + '/src-ru.txt', 'utf8'));
const en = new Map();
for (const f of fs.readdirSync(D + '/en').sort()) if (/\.txt$/.test(f)) for (const [k, v] of sections(fs.readFileSync(D + '/en/' + f, 'utf8'))) en.set(k, v);
const group = f => /^js\/(world|guide)|^js\/(life|pets)/.test(f) ? 'en-world' : /^js\/(hero|guilds)/.test(f) ? 'en-hero' : /^(js\/(coop|sound|perf|stats|smoking|stress|jobs|layout|mobile|main|render|save|loading|flask|entities|events)|server|manifest)/.test(f) ? 'en-misc' : 'en-ui';
const out = { 'en-ui': {}, 'en-world': {}, 'en-hero': {}, 'en-misc': {} };
let bad = 0, done = 0, todo = [];
const ph = s => (s.match(/\{\d+\}/g) || []).sort().join(',');
for (const [f, ru] of src) {
  const e = en.get(f);
  if (!e) { todo.push(f); continue; }
  if (e.length !== ru.length) { console.error(`! ${f}: ru ${ru.length} / en ${e.length}`); bad++; continue; }
  ru.forEach((r, i) => {
    const key = JSON.parse(r), val = e[i];
    const kp = new Set(key.match(/{d+}/g) || []); if ((val.match(/{d+}/g) || []).some(p => !kp.has(p))) { console.error(`! плейсхолдеры ${f}#${i + 1}: ${key} => ${val}`); bad++; return; }
    const g = out[group(f)]; if (!(key in g)) g[key] = val; done++;
  });
}
if (!bad) {
  fs.mkdirSync(D + '/../../js/i18n', { recursive: true });
  for (const g in out) {
    const body = Object.entries(out[g]).map(([k, v]) => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(v) + ',').join('\n');
    fs.writeFileSync(D + '/../../js/i18n/' + g + '.js', `// Сгенерировано tools/i18n/build.js из tools/i18n/en/*.txt — правьте переводы там.\nI18N.add('en', {\n${body}\n});\n`);
  }
}
console.log(`строк переведено: ${done}, ошибок: ${bad}, секций без перевода: ${todo.length}`); if (todo.length) console.log(todo.join(' '));
