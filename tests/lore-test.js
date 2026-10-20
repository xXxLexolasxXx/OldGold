'use strict';
// Лор (js/lore.js): фрагменты целы, главы 1–6 как в СЮЖЕТ.md, у каждого есть условие, реплики и запись,
// сцен обучения 8–12, английский словарь покрывает весь текст. Запуск: node tests/lore-test.js
const path = require('path');
const ROOT = path.join(__dirname, '..');
const fails = [];
const dict = {};
global.I18N = { add: (l, o) => Object.assign(dict, o) };
require(path.join(ROOT, 'js/i18n/en-lore.js'));
const { LORE_CHAPTERS, LORE_FRAGS, LORE_WHO } = require(path.join(ROOT, 'js/lore.js'));

if (LORE_CHAPTERS.length !== 6) fails.push('глав не 6: ' + LORE_CHAPTERS.length);
const ids = new Set();
for (const f of LORE_FRAGS) {
  if (ids.has(f.id)) fails.push('повтор id ' + f.id);
  ids.add(f.id);
  if (!(f.ch >= 1 && f.ch <= 6)) fails.push(f.id + ': глава ' + f.ch);
  if (typeof f.when !== 'function') fails.push(f.id + ': нет условия');
  if (!f.lines || !f.lines.length || f.lines.length > 3) fails.push(f.id + ': реплик ' + (f.lines || []).length + ' (нужно 1–3)');
  for (const [who, text] of f.lines || []) {
    if (!LORE_WHO[who]) fails.push(f.id + ': неизвестный голос ' + who);
    if (text.length > 220) fails.push(f.id + ': реплика длиннее 220 знаков — не «полотно» ли?');
  }
  for (const s of [f.title, f.entry, f.hint, ...LORE_CHAPTERS, ...(f.lines || []).map(l => l[1])]) if (s && !(s in dict)) fails.push('нет перевода: ' + s.slice(0, 60));
}
const tut = LORE_FRAGS.filter(f => f.tut).length;
if (tut < 8 || tut > 12) fails.push('сцен обучения ' + tut + ' (нужно 8–12)');
for (let c = 1; c <= 6; c++) if (!LORE_FRAGS.some(f => f.ch === c)) fails.push('в главе ' + c + ' нет фрагментов');

for (const m of [...new Set(fails)]) console.log('✗ ' + m);
console.log(fails.length ? '' : `Лор: ${LORE_FRAGS.length} фрагментов, ${tut} сцен обучения, 6 глав, перевод полный — ок`);
process.exit(fails.length ? 1 : 0);
