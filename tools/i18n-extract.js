#!/usr/bin/env node
// Вытаскивает из исходников все русские пользовательские строки (литералы, шаблоны, склейки «a' + n + 'b»)
// и сравнивает со словарём js/i18n/en*.js.
//   node tools/i18n-extract.js            — отчёт: сколько строк, сколько без перевода
//   node tools/i18n-extract.js --missing  — печатает непереведённые (ключи для словаря)
//   node tools/i18n-extract.js --dump out.json — все записи {ru, files}
// Ключ словаря = русский исходник; динамические части заменены на {0} {1} …
const fs = require('fs'), path = require('path'), vm = require('vm');
const acorn = require('./vendor/acorn.js');
const ROOT = path.join(__dirname, '..');
const CYR = /[А-Яа-яЁё]/;
const SKIP_DIR = /^(node_modules|_before|promo|tools|tests|mobile|i18n|data|\.git|\.claude)$/;
function walk(d, o = []) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) { if (!SKIP_DIR.test(f)) walk(p, o); }
    else if (/\.(js|html)$/.test(f) && !/^(grab|neutrals|sheet|smoking)\.html$|^i18n\.js$/.test(f)) o.push(p);
  }
  return o;
}
const ENT = { nbsp: ' ', mdash: '—', ndash: '–', times: '×', laquo: '«', raquo: '»', amp: '&', lt: '<', gt: '>', hellip: '…', middot: '·', quot: '"', apos: "'", minus: '−', rarr: '→', larr: '←' };
function decode(s) { return s.replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&([a-z]+);/gi, (m, n) => ENT[n] != null ? ENT[n] : m); }

// возвращает массив частей: {s:'текст'} или {d:true} для динамики
function flatten(node, out) {
  if (node.type === 'Literal' && typeof node.value === 'string') out.push({ s: node.value });
  else if (node.type === 'TemplateLiteral') {
    node.quasis.forEach((q, i) => { out.push({ s: q.value.cooked != null ? q.value.cooked : q.value.raw }); if (i < node.expressions.length) out.push({ d: true }); });
  } else if (node.type === 'BinaryExpression' && node.operator === '+' && isStrChain(node)) { flatten(node.left, out); flatten(node.right, out); }
  else out.push({ d: true });
}
function isStrChain(n) {
  if (n.type === 'Literal') return typeof n.value === 'string';
  if (n.type === 'TemplateLiteral') return true;
  if (n.type === 'BinaryExpression' && n.operator === '+') return isStrChain(n.left) || isStrChain(n.right) || hasStrDeep(n);
  return false;
}
function hasStrDeep(n) {
  if (n.type === 'Literal') return typeof n.value === 'string';
  if (n.type === 'TemplateLiteral') return true;
  if (n.type === 'BinaryExpression' && n.operator === '+') return hasStrDeep(n.left) || hasStrDeep(n.right);
  return false;
}
function pieces(parts) {
  let k = 0, src = '';
  for (const p of parts) src += p.d ? '\u0001' + (k++) + '\u0002' : p.s;
  // ограничим вложенные нумерации: {0} {1} …
  src = src.replace(/\u0001(\d+)\u0002/g, '{$1}');
  return splitText(src);
}
function splitText(src, html = true) {
  const res = [];
  if (html) for (const m of src.matchAll(/<[^>]*>/g)) for (const a of m[0].matchAll(/\b(?:title|placeholder|alt|aria-label)="([^"]*)"/g)) { const t = decode(a[1]).replace(/\s+/g, ' ').trim(); if (CYR.test(t)) res.push(t); }
  const segs = html ? src.split(/<[^>]*>/) : [src];
  for (const seg of segs) for (const line of seg.split('\n')) {
    let t = decode(line).replace(/\s+/g, ' ').trim();
    if (CYR.test(t)) res.push(t);
  }
  return res;
}
function renumber(t) { let i = 0; return t.replace(/\{\d+\}/g, () => '{' + (i++) + '}'); }

const entries = new Map();
function add(t, file, line) {
  t = renumber(t);
  let e = entries.get(t); if (!e) entries.set(t, e = { ru: t, files: new Set() });
  e.files.add(file + ':' + line);
}
function visit(node, file, parentChain) {
  if (!node || typeof node.type !== 'string') return;
  const isChain = node.type === 'BinaryExpression' && node.operator === '+' && hasStrDeep(node);
  if (isChain && !parentChain) {
    const parts = []; flatten(node, parts);
    for (const t of pieces(parts)) add(t, file, node.loc.start.line);
    // вложенные не-строковые операнды обходим отдельно
    collectDyn(node, file);
    return;
  }
  if (node.type === 'TemplateLiteral') {
    const parts = []; flatten(node, parts);
    for (const t of pieces(parts)) add(t, file, node.loc.start.line);
    node.expressions.forEach(e => visit(e, file, false));
    return;
  }
  if (node.type === 'Literal' && typeof node.value === 'string') {
    for (const t of splitText(node.value)) add(t, file, node.loc.start.line);
    return;
  }
  if (node.type === 'Property' && node.key && node.key.type === 'Literal') { /* ключи-строки тоже могут быть текстом, но чаще id */ }
  for (const k in node) {
    if (k === 'loc' || k === 'type') continue;
    const v = node[k];
    if (Array.isArray(v)) v.forEach(c => c && typeof c.type === 'string' && visit(c, file, false));
    else if (v && typeof v.type === 'string') visit(v, file, false);
  }
}
function collectDyn(chain, file) {
  const stack = [chain];
  while (stack.length) {
    const n = stack.pop();
    if (n.type === 'BinaryExpression' && n.operator === '+' && hasStrDeep(n)) { stack.push(n.left, n.right); }
    else if (n.type === 'Literal') { /* уже в склейке */ }
    else if (n.type === 'TemplateLiteral') { n.expressions.forEach(e => visit(e, file, false)); }
    else visit(n, file, false);
  }
}

function scanHtml(file, src) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  // инлайн-скрипты
  const noScript = src.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (m, code, off) => {
    if (code.trim()) try { parseJs(code, rel + '#inline'); } catch (e) { console.error('parse', rel, e.message); }
    return '';
  });
  const body = noScript.replace(/<style\b[\s\S]*?<\/style>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  for (const m of body.matchAll(/\b(?:title|placeholder|alt|aria-label|content)="([^"]*)"/g)) for (const t of splitText(m[1], false)) add(t, rel, 0);
  for (const t of splitText(body.replace(/<[^>]*>/g, '\n'), false)) add(t, rel, 0);
}
function parseJs(code, rel) {
  const ast = acorn.parse(code, { ecmaVersion: 'latest', allowHashBang: true, locations: true, sourceType: 'script', allowReturnOutsideFunction: true });
  visit(ast, rel, false);
}

function scanAll() {
  entries.clear();
  for (const f of walk(ROOT)) {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    const src = fs.readFileSync(f, 'utf8');
    if (f.endsWith('.html')) { scanHtml(f, src); continue; }
    try { parseJs(src, rel); } catch (e) { console.error('! не разобран', rel, e.message); }
  }
  return [...entries.values()];
}

function loadDict() {
  const dir = path.join(ROOT, 'js', 'i18n');
  const dict = {};
  if (!fs.existsSync(dir)) return dict;
  for (const f of fs.readdirSync(dir)) {
    if (!/^en.*\.js$/.test(f)) continue;
    const sandbox = { I18N: { add(lang, o) { if (lang === 'en') Object.assign(dict, o); } } };
    sandbox.window = sandbox;
    vm.runInNewContext(fs.readFileSync(path.join(dir, f), 'utf8'), sandbox);
  }
  return dict;
}

module.exports = { scanAll, loadDict };
if (require.main === module) {
  const all = scanAll(), dict = loadDict();
  const missing = all.filter(e => !(e.ru in dict));
  const stale = Object.keys(dict).filter(k => !all.some(e => e.ru === k));
  const a = process.argv.slice(2);
  if (a[0] === '--dump') fs.writeFileSync(a[1], JSON.stringify(all.map(e => ({ ru: e.ru, files: [...e.files].slice(0, 3) })), null, 1));
  else if (a[0] === '--missing') {
    const byFile = {};
    for (const e of missing) { const f = [...e.files][0].split(':')[0]; (byFile[f] = byFile[f] || []).push(e.ru); }
    for (const f in byFile) { console.log('\n// ' + f); byFile[f].forEach(t => console.log(JSON.stringify(t))); }
  }
  console.log(`\nстрок: ${all.length}, в словаре: ${all.length - missing.length}, без перевода: ${missing.length}, лишних в словаре: ${stale.length}`);
  if (a[0] === '--stale') stale.forEach(k => console.log(JSON.stringify(k)));
}
