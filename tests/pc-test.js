'use strict';
// Управление для ПК (js/pccontrols.js): сочетания клавиш, переназначение со сменой местами, занятые клавиши,
// «прослойка» подмены кодов, способности героя, сохранение, битые данные в localStorage.
// Запуск: node tests/pc-test.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };
const eq = (a, b, m) => ok(a === b, `${m}: ждали ${JSON.stringify(b)}, получили ${JSON.stringify(a)}`);

function load(stored) {
  const ls = { og_pc_controls: stored };
  const ctx = {
    t: (k, ...a) => k.replace(/\{(\d+)\}/g, (m, i) => a[i]),
    localStorage: { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); } },
    ABIL_KEYS: ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'], ABIL_KEYN: ['1', '2', '3', '4', '5', '6'],
    console,
  };
  vm.createContext(ctx);
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'pccontrols.js'), 'utf8');
  vm.runInContext(src + '\n;this.X = { PC, PC_ACTS, pcCombo, pcName, pcAssign, pcRebuild, pcResetAll, pcLoad, pcOwner };', ctx);
  ctx.X.pcLoad(); ctx.X.pcRebuild();
  return { X: ctx.X, ctx, ls };
}

// 1. умолчания и названия
{
  const { X, ctx } = load(undefined);
  eq(X.PC.binds.pause, 'Space', 'пауза по умолчанию');
  eq(X.pcName('Ctrl+KeyS'), 'Ctrl+S', 'название сочетания');
  eq(X.pcName('ArrowLeft'), '←', 'название стрелки');
  eq(X.pcName('Shift+Digit1'), 'Shift+1', 'название Shift+1');
  eq(X.pcCombo({ code: 'KeyW', ctrlKey: false, altKey: false, shiftKey: true }), 'Shift+KeyW', 'сочетание из события');
  eq(X.pcCombo({ code: 'ShiftLeft', shiftKey: true }), '', 'одна лишь Shift — не сочетание');
  const seen = new Set();
  for (const a of X.PC_ACTS) { ok(!seen.has(a.def), 'умолчания не пересекаются: ' + a.def + ' у ' + a.id); seen.add(a.def); }
  eq(ctx.ABIL_KEYS.join(), 'Digit1,Digit2,Digit3,Digit4,Digit5,Digit6', 'способности: клавиши по умолчанию');
}

// 2. переназначение и обмен
{
  const { X, ctx, ls } = load(undefined);
  eq(X.pcAssign('pause', 'KeyV'), '«Перекат героя» получило прежнюю клавишу этого действия', 'обмен клавишами');
  eq(X.PC.binds.pause, 'KeyV', 'пауза на V');
  eq(X.PC.binds.roll, 'Space', 'перекат получил пробел');
  eq(X.PC.byCombo.KeyV, 'pause', 'таблица поиска');
  ok(JSON.parse(ls.og_pc_controls).binds.pause === 'KeyV', 'сохранено в localStorage');
  // свободная клавиша: старая отдана → «проглатывается»
  eq(X.pcAssign('road', 'KeyG'), '', 'свободная клавиша без сообщений');
  ok(X.PC.swallow.KeyR === 'road', 'старая клавиша R «проглатывается»');
  // назад
  X.pcAssign('road', 'KeyR');
  ok(!X.PC.swallow.KeyR, 'после возврата R не проглатывается');
  // запрещённое
  ok(X.pcAssign('road', 'Escape') !== '', 'Esc занят игрой');
  ok(X.pcAssign('road', 'F5') !== '', 'F5 занят игрой');
  ok(X.pcAssign('road', 'Ctrl+KeyG') !== '' && X.PC.binds.road === 'KeyR', 'Ctrl+G для дороги не принимается');
  ok(X.pcAssign('save', 'Ctrl+KeyG') === '' && X.PC.binds.save === 'Ctrl+KeyG', 'Ctrl+G для «Сохранить» можно');
  ok(X.pcAssign('nope', 'KeyG') !== '', 'нет такого действия');
  // способности героя
  X.pcAssign('ab1', 'KeyZ');
  eq(ctx.ABIL_KEYS[0], 'KeyZ', 'способность 1 → Z');
  eq(ctx.ABIL_KEYN[0], 'Z', 'подпись способности 1');
  X.pcResetAll();
  eq(ctx.ABIL_KEYS[0], 'Digit1', 'сброс вернул цифры');
  eq(X.PC.binds.pause, 'Space', 'сброс вернул пробел');
  ok(Object.keys(X.PC.swallow).length === 0, 'после сброса ничего не проглатывается');
}

// 3. битые данные
for (const bad of ['{', 'null', '{"binds":{"pause":"<b>x</b>","road":5},"opt":{"ui":99}}', '{"opt":{"ui":"abc"}}']) {
  const { X } = load(bad);
  eq(X.PC.binds.pause, 'Space', 'битое сохранение: пауза по умолчанию (' + bad.slice(0, 12) + ')');
  ok(X.PC.opt.ui >= 0.8 && X.PC.opt.ui <= 1.5, 'масштаб в пределах 80–150%');
}
// 4. сохранённые привязки подхватываются
{
  const { X, ctx } = load('{"binds":{"ab2":"KeyX","camU":"KeyI"},"opt":{"ui":1.25,"edge":true}}');
  eq(X.PC.binds.ab2, 'KeyX', 'привязка прочитана');
  eq(X.PC.opt.ui, 1.25, 'масштаб прочитан');
  eq(X.PC.opt.edge, true, 'край экрана прочитан');
  eq(ctx.ABIL_KEYS[1], 'KeyX', 'клавиши способностей применены при загрузке');
}

console.log(fails.length ? `✗ провалов: ${fails.length}` : '✓ управление для ПК: всё в порядке');
process.exit(fails.length ? 1 : 0);
