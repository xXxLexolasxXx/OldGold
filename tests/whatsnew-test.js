'use strict';
// Окно «Что нового» без браузера: какие версии игрок видит, пропустив обновления.
//  · игрок с версией X видит версии между X и текущей (от новых к старым, не больше 10), новичок — только текущую;
//  · «мелкие правки» и повторы пунктов не дублируются; ?whatsnew=1 (force) как раньше; «Все обновления» — вся история.
// Запуск: node tests/whatsnew-test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };

function page(seen) {
  const store = seen ? { 'oldgold.seenVersion': seen } : {};
  const nodes = {};
  const mk = id => ({ id, innerHTML: '', hidden: false, textContent: '', firstChild: null, classList: { remove() {}, add() {} }, remove() {}, addEventListener() {} });
  const el = mk('whatsnew');
  el.querySelector = sel => nodes[sel] || (nodes[sel] = mk(sel));
  const ctx = {
    console, Math, Date, Object, Array, String, Set, JSON, RegExp,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    location: { search: '' },
    window: { addEventListener() {} },
    document: { getElementById: id => (id === 'whatsnew-css' ? {} : null), createElement: () => el, head: { appendChild() {} }, body: { appendChild() {} }, addEventListener() {} },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'changelog.js'), 'utf8') + '\n;this.CHANGELOG = CHANGELOG; this.show = whatsNewShow; this.missed = whatsNewMissed; this.groups = whatsNewGroups; this.GV = GAME_VERSION;', ctx);
  return { ctx, el, nodes, store };
}
const heads = html => (html.match(/<summary>([^<]*)<\/summary>/g) || []).map(s => s.replace(/<\/?summary>/g, '').split(' · ')[0]);

const P = page(null), CL = P.ctx.CHANGELOG;
check(CL.length > 14, 'в журнале слишком мало записей для теста');
check(P.ctx.GV === CL[0].v, 'GAME_VERSION не первая запись');
// версии свежих записей уникальны и строго растут по числам (после 0.11.99 идёт 0.12.0, а не 0.11.100; строкой «0.12.0» < «0.9.2» — нельзя)
{
  const num = v => v.split('.').map(Number);
  const cmp = (a, b) => { const x = num(a), y = num(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
  const bad = [];
  for (let i = 0; i + 1 < Math.min(CL.length, 40); i++) if (cmp(CL[i].v, CL[i + 1].v) <= 0) bad.push(CL[i + 1].v + '→' + CL[i].v);
  check(!bad.length, 'версии не растут/повторяются: ' + bad.join(', '));
  check(cmp('0.12.0', '0.11.99') > 0 && cmp('0.12.1', '0.12.0') > 0, 'сравнение версий');
  check(cmp('0.13.0', '0.12.99') > 0, 'сравнение версий через границу');
  const big = CL.slice(0, 40).filter(e => num(e.v)[2] >= 100).map(e => e.v);
  check(!big.length, 'патч не бывает больше 99 — после x.y.99 идёт x.(y+1).0: ' + big.join(', '));
}

// игрок видел версию CL[4] → пропустил записи 1..3
{
  const p = page(CL[4].v);
  p.ctx.show(false);
  const h = heads(p.el.innerHTML);
  check(h.length >= 1 && h.every(v => CL.slice(1, 4).some(e => e.v === v)), 'пропущенные версии: ждали из 1..3, получили ' + h.join(','));
  check(p.el.innerHTML.includes('Версия ' + CL[0].v), 'нет текущей версии сверху');
  check(!p.el.innerHTML.includes(CL[4].v + ' ·'), 'показана уже виденная версия');
  check(p.el.innerHTML.includes('Пока вас не было'), 'нет раздела «Пока вас не было»');
  check(/<details><summary>/.test(p.el.innerHTML) && !/<details open/.test(p.el.innerHTML), 'версии должны быть свёрнуты');
  const order = h.map(v => CL.findIndex(e => e.v === v));
  check(order.every((x, i) => !i || x > order[i - 1]), 'порядок не от новых к старым');
}
// далеко отставший: не больше 10 версий, остальное — в «Все обновления»
{
  const p = page(CL[CL.length - 1].v);
  p.ctx.show(false);
  const h = heads(p.el.innerHTML);
  check(h.length <= 10 && h.length >= 5, 'глубина пропущенных: ' + h.length);
  check(/и ещё версий: /.test(p.el.innerHTML) || P.ctx.missed(CL[CL.length - 1].v).length <= 10, 'нет пометки об остальных версиях');
  check(!/мелких правок/.test(p.el.innerHTML.split('wn-miss')[1] || ''), 'мелкие правки попали в пропущенные');
}
// новичок и неизвестная версия: только текущая
for (const [name, seen] of [['новичок', null], ['неизвестная версия', '0.0.1']]) {
  const p = page(seen);
  p.ctx.show(false);
  check(heads(p.el.innerHTML).length === 0 && !p.el.innerHTML.includes('Пока вас не было'), name + ': должна быть только текущая запись');
  check(p.el.innerHTML.includes('Версия ' + CL[0].v), name + ': нет текущей записи');
}
// версия уже виденная: без force окна нет, с force (?whatsnew=1) — текущая запись
{
  const p = page(CL[0].v);
  p.ctx.show(false);
  check(p.el.innerHTML === '', 'при виденной версии окно не должно строиться');
  p.ctx.show(true);
  check(p.el.innerHTML.includes('Версия ' + CL[0].v) && heads(p.el.innerHTML).length === 0, 'force: текущая запись без пропущенных');
  const q = page(CL[0].v);
  q.ctx.show('all');
  const hist = q.nodes['.wn-hist'].innerHTML;
  check(heads(hist).length > 10, 'полная история пуста: ' + heads(hist).length);
  check(heads(hist)[0] !== CL[0].v, 'в истории дублируется текущая версия');
}
// дедупликация
{
  const E = (v, news, fixes = []) => ({ v, date: '2026-01-01', title: 't' + v, news, fixes });
  const g = P.ctx.groups([E('2', ['Тот же пункт.', 'Новый'], ['и ещё несколько мелких правок.']), E('1', ['Тот же пункт', 'Старый'], ['И ещё несколько мелких правок'])]);
  check(g.length === 2 && g[0].news.length === 2 && g[0].fixes.length === 0, 'мелкие правки не убраны');
  check(g[1].news.length === 1 && g[1].news[0] === 'Старый', 'повтор пункта не склеен');
  const g2 = P.ctx.groups([E('1', ['А'])], ['а']);
  check(g2.length === 0, 'пункт текущей записи повторён в пропущенных');
}

console.log('Проверка «Что нового»: записей ' + CL.length);
if (fails.length) { for (const f of fails) console.log('✗ ' + f); process.exit(1); }
console.log('ok');
