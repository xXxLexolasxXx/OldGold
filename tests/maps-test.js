'use strict';
// Пользовательские карты без браузера: формат (сжатие, версия, отказ от мусора), проверка играбельности,
// запуск мира из карты, ручные логова, сохранение→загрузка с картой, правила цели.
// Запуск: node tests/maps-test.js
const { createHost } = require('../server/simhost');
const errs = [];
const h = createHost(m => errs.push(m));
const run = c => h.run(c);
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };

// карта 96×72: трава, озеро справа, горы сверху с рудой, лес слева, камни, два логова
run(`globalThis.mk = function () {
  const m = meNew(96, 72, 'meadow', 'Тест');
  const w = m.w;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (x > 70 && x < 90 && y > 20 && y < 50) m.t[i] = 1;
    if (y < 14) { m.t[i] = 2; if (x % 3 === 0 && y > 11) m.c[i] = 1; }
    if (x < 30 && y > 24 && y < 60 && (x * 7 + y * 3) % 5 < 3) m.o[i] = 1;
    if (x > 40 && x < 60 && y > 54 && y < 62 && (x + y) % 3 === 0) m.o[i] = 3;
  }
  m.start = [48, 36];
  m.lairs = [['boar', 15, 40], ['leshy', 20, 30]];
  m.rules = [{ k: 'pop', n: 1 }];
  m.title = 'Тестовая цель';
  return m;
};`);

console.log('формат');
ok(run('(function(){ const m = mk(), e = meEncode(m), r = meParse(JSON.parse(JSON.stringify(e))); return !r.err && r.map.w === 96 && r.map.t.every((v, i) => v === m.t[i]) && r.map.o.every((v, i) => v === m.o[i]) && r.map.c.every((v, i) => v === m.c[i]) && r.map.lairs.length === 2 && r.map.rules.length === 1; })()'), 'кодирование → разбор возвращает ту же карту');
ok(run('JSON.stringify(meEncode(mk())).length') < 40000, 'карта 96×72 в файле < 40 КБ: ' + run('JSON.stringify(meEncode(mk())).length'));
ok(run('meParse("не json").err') && run('meParse({}).err') && run('meParse({fmt:"oldgold-map",v:99,w:96,h:72}).err.includes("новой")'), 'мусор и будущая версия отклоняются с текстом');
ok(run('meParse(Object.assign(meEncode(mk()), { w: 999 })).err'), 'слишком большой размер отклоняется');
ok(run('meParse(Object.assign(meEncode(mk()), { ter: "g5" })).err'), 'слой неверной длины отклоняется');
ok(run('meParse(Object.assign(meEncode(mk()), { ter: "x9999999" })).err'), 'неизвестные буквы и гигантские счётчики отклоняются');
ok(run('(function(){ const e = meEncode(mk()); e.lairs.push(["dragon", 5, 5], ["boar", -3, 4], ["boar", 15, 40]); e.goal.rules.push({ k: "build", t: "__proto__" }, { k: "pop", n: 1e9 }); const r = meParse(e); return r.map.lairs.length === 2 && r.map.rules.length === 1; })()'), 'неизвестные логова, правила и дубли отбрасываются');
ok(run('meParse(Object.assign(meEncode(mk()), { name: "<b>x</b>\\n".repeat(30) })).map.name.length <= 40 && !meParse(Object.assign(meEncode(mk()), { name: "<b>" })).map.name.includes("<")'), 'имя очищено от разметки и обрезано');

console.log('проверка играбельности');
let v = JSON.parse(run('JSON.stringify(meValidate(mk()))'));
ok(!v.errors.length, 'тестовая карта играбельна' + (v.errors.length ? ': ' + v.errors.join('; ') : ''));
ok(JSON.parse(run('JSON.stringify(meValidate(Object.assign(mk(), { start: null })))')).errors.length === 1, 'без старта — ошибка');
ok(JSON.parse(run('JSON.stringify(meValidate((() => { const m = mk(); m.t.fill(0); m.o.fill(0); m.c.fill(0); return m; })()))')).errors.length >= 3, 'пустая трава: нет воды, дерева и камня');
ok(JSON.parse(run('JSON.stringify(meValidate((() => { const m = mk(); for (let i = 0; i < m.o.length; i++) if (m.o[i] === 1) m.o[i] = 0; return m; })()))')).errors.some(e => e.includes('дерев')), 'нет деревьев — ошибка');
ok(JSON.parse(run('JSON.stringify(meValidate((() => { const m = mk(); m.start = [3, 3]; return m; })()))')).errors.some(e => e.includes('краю')), 'старт у края — ошибка');

console.log('мир из карты');
run('Math.random = (function(){ let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();');
run('globalThis.cm = mk(); setupStart(4242, { custom: cm }); Game.heroAsk = false;');
ok(run('MAP_W === 96 && MAP_H === 72 && MapOpt.custom === cm'), 'размер и карта взяты из файла');
ok(run('World.terrain[idx(80, 30)] === T_WATER && World.terrain[idx(10, 5)] === T_ROCK'), 'вода и скалы на местах');
ok(run('World.crystal[idx(3, 12)] === 1'), 'руда на месте');
ok(run('(() => { let n = 0; for (let y = 27; y <= 45; y++) for (let x = 39; x <= 57; x++) { const o = World.obj[idx(x, y)]; if (o && (o.t === "tree" || o.t === "stone") && Math.hypot(x - 48, y - 36) <= 9) n++; } return n; })()') === 0, 'поляна вокруг старта очищена');
ok(run('Game.buildings.some(b => b.type === "storehouse") && Game.units.length >= 10'), 'деревня построена на старте');
ok(run('Game.lairs.length === 2 && Game.lairs.every(l => l.alive > 0)') && !run('Game.lairs.some(l => l.k === "pixie")'), 'ровно два логова автора, фей не добавлено');
run('Game.goal = null; goalNew("scenario");');
ok(run('Game.goal.mode === "free" && Game.goal.custom.rules.length === 1'), 'цель карты: свободная игра с правилами');
run('Game.goalView = goalMakeView();');
ok(run('Game.goalView.custom && Game.goalView.objs.length === 1 && Game.goalView.chName === "Тестовая цель"'), 'панель целей показывает правила карты');

console.log('сохранение');
const saved = run('JSON.stringify(serializeGame())');
ok(saved.length < 3e6, 'сейв ' + (saved.length / 1000 | 0) + ' КБ');
ok(JSON.parse(saved).cm && JSON.parse(saved).cm.fmt === 'oldgold-map', 'карта лежит в сохранении (cm)');
h.ctx.__s = saved;
run('setupStart(5); applySave(JSON.parse(__s));');
ok(run('MapOpt.custom && MapOpt.custom.name === "Тест" && MAP_W === 96 && World.terrain[idx(80, 30)] === T_WATER'), 'после загрузки мир тот же');
ok(run('Game.lairs.length === 2 && Game.goal.custom.rules.length === 1'), 'логова и цель сохранились');
run('setupStart(6)');
ok(run('MapOpt.custom === null && MAP_W === 160'), 'обычная игра после своей карты не затронута');
h.ctx.__s = saved;
run('applySave(JSON.parse(__s));');

console.log('прогон 6 минут и победа');
let cnt = 0;
for (let i = 0; i < 6 * 60 * 20; i++) { try { h.ctx.step(0.05); } catch (e) { if (cnt++ < 3) errs.push('шаг: ' + e.message); } }
ok(run('Game.time') > 300, 'игра идёт');
ok(run('Game.goal.over && Game.goal.over.res === "win"'), 'правило «1 житель» выполнено → победа');
ok(!errs.length, 'ошибок нет' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));

console.log('автоматические логова');
run('globalThis.cm2 = mk(); cm2.nm = "auto"; setupStart(77, { custom: cm2 });');
ok(run('Game.lairs.length >= 3'), 'режим «случайные логова» расставляет логова сам: ' + run('Game.lairs.length'));

console.log(fails.length ? `\nПРОВАЛ: ${fails.length}` : '\nOK');
process.exit(fails.length ? 1 : 0);
