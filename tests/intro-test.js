'use strict';
// «Новое в деревне» (js/intro.js): у каждой открывающейся ветки стройки есть лорное введение,
// карточка выбирается по открытой стадии, уже построенное засчитывается молча, события-поводы
// (первый больной → лазарет) напоминают об открытой, но не построенной ветке, строка «Дальше» ведёт к следующей.
// Запуск: node tests/intro-test.js
const L = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };

const sim = L.newSim(5);
const run = s => sim.h.run(s);
const J = s => JSON.parse(run(`JSON.stringify(${s})`));

// ---- 1. Данные: стадии и здания настоящие, рассказчики известны, моря нет (не выкатываем)
const stages = J(`UNLOCKS.map(u => ({ id: u.id, items: u.items, after: !!u.after }))`);
const intros = J(`INTROS.concat(INTRO_NUDGES).map(x => ({ id: x.id || x.stage, stage: x.stage, go: x.go, keys: x.keys, who: x.lines.map(l => l[0]), n: x.lines.length }))`);
const who = J(`Object.keys(LORE_WHO)`);
for (const x of intros) {
  const st = stages.find(s => s.id === x.stage);
  ok(st, `${x.id}: нет стадии ${x.stage}`);
  ok(run(`!!BUILDINGS[${JSON.stringify(x.go)}]`), `${x.id}: нет здания ${x.go}`);
  if (st) for (const k of x.keys || [x.go]) ok(st.items.includes(k), `${x.id}: ${k} не из стадии ${x.stage}`);
  ok(x.n >= 2 && x.who.every(w => who.includes(w)), `${x.id}: реплик меньше двух или неизвестный рассказчик`);
}
for (const s of stages) if (s.after && !['fish'].includes(s.id)) ok(intros.some(x => x.id === s.id), 'у ветки нет лорного введения: ' + s.id);
ok(!intros.some(x => x.stage === 'fish'), 'введение к рыбалке (море не выкатываем)');

// ---- 2. Новый мир: открыта только стартовая стадия — рассказывать нечего
// в симуляции открыто всё — закрываем ветки, как в новой игре
run(`for (const u of UNLOCKS) if (u.after) Game.unlocked[u.id] = false; Game.intro = {}; introSilent(); Tut.on = false;`);
ok(run(`introPick()`) === null, 'карточка в самом начале: ' + run(`JSON.stringify(introPick())`));

// ---- 3. Открылся лазарет — карточка; дальше — подсказка про следующую ветку
run(`Game.unlocked.med = true;`);
ok(run(`(introPick() || {}).key`) === 'med', 'открылся лазарет, а карточки нет: ' + run(`JSON.stringify(introPick())`));
const next = run(`introNext()`);
ok(/^Дальше — «.+»: .+\.$/.test(next), 'строка «Дальше» пустая или странная: ' + next);
// при обучении — ждёт
run(`Tut.on = true;`); ok(run(`introBusy()`), 'карточка во время обучения'); run(`Tut.on = false;`);
// уже поставили лазарет — рассказывать поздно, засчитано молча
run(`Game.buildings.push({ type: 'infirmary', state: 'site', removed: false });`);
ok(run(`introPick()`) === null && run(`Game.intro.med`) === 1, 'карточка про уже поставленный лазарет');
run(`Game.buildings.pop(); delete Game.intro["n:sick"];`);   // (с лазаретом и напоминание засчиталось молча)

// ---- 4. Повод: первый больной, а лазарета так и нет — напоминание (один раз)
run(`Game.med = Game.med || { st: {} }; Game.med.st = Object.assign(Game.med.st || {}, { sick: 0 });`);
ok(run(`introPick()`) === null, 'напоминание про лазарет без больных');
run(`Game.med.st.sick = 1;`);
ok(run(`(introPick() || {}).key`) === "n:sick", "первый больной не напомнил про лазарет");
run(`Game.intro['n:sick'] = 1;`);
ok(run(`introPick()`) === null, 'напоминание про лазарет повторилось');

// ---- 5. Старое сохранение: всё, что уже открыто, — без карточек
run(`Game.intro = {}; for (const u of UNLOCKS) Game.unlocked[u.id] = true; introSilent();`);
const left = J(`(() => { const r = []; let p; while ((p = introPick())) { r.push(p.key); Game.intro[p.key] = 1; } return r; })()`).filter(k => !k.startsWith('n:'));
ok(!left.length, 'старое сохранение пересказывает открытые ветки: ' + left.join(','));

// ---- 6. Порядок «Дальше»: в начале игры следующая ветка — хлеб
run(`Game.intro = {}; for (const u of UNLOCKS) if (u.after) Game.unlocked[u.id] = false;`);
const n0 = run(`introNext()`);
ok(/«(Хлеб|Свой угол|Оборона)»/.test(n0), 'в начале «Дальше» ведёт не к первой ветке: ' + n0);

// ---- 7. Перевод: реплики, заголовки и подписи карточек есть в английском
const dict = {};
global.I18N = { add: (l, o) => Object.assign(dict, o) };
for (const fl of require('fs').readdirSync(require('path').join(__dirname, '../js/i18n'))) require(require('path').join(__dirname, '../js/i18n', fl));
const strs = J(`INTROS.concat(INTRO_NUDGES).flatMap(x => [x.title, ...x.lines.map(l => l[1])])`).concat(['Новое в деревне', 'Показать на стройке', 'Дальше — «{0}»: {1}.', 'постройте: {0}']);
for (const k of strs) ok(dict[k], 'нет перевода: ' + k);

for (const e of sim.errors) fails.push('исключение в симуляции: ' + e);
for (const m of [...new Set(fails)]) console.log('✗ ' + m);
console.log(fails.length ? '' : `«Новое в деревне»: ${intros.length} введений, выбор по стадии, молчаливый зачёт, повод «первый больной», «Дальше» — ок`);
process.exit(fails.length ? 1 : 0);
