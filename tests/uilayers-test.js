'use strict';
// Слои интерфейса без браузера (js/uilayers.js + css/uilayers.css):
//  · режимы: загрузка/меню — ui-loading; телефон со зданием в руке — ui-place; окно поверх игры — ui-modal;
//  · при открытой панели размещения панель способностей, карточка героя и значок версии скрыты, панель ✓ ↻ ✕ выше всех игровых;
//  · на загрузке кнопки скорости нет: она внутри #app, а #app скрыт с самого первого кадра (класс в index.html).
// Запуск: node tests/uilayers-test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };

// ---- маленький DOM: элементы с классами, body, getComputedStyle
function cl(init) {
  const s = new Set(init);
  return { contains: k => s.has(k), add: (...k) => k.forEach(x => s.add(x)), remove: (...k) => k.forEach(x => s.delete(x)), toggle: (k, on) => { if (on === undefined) on = !s.has(k); if (on) s.add(k); else s.delete(k); return on; }, list: () => [...s] };
}
function page({ loading, leaving, mobile, land, mtool, sheet, modal }) {
  const els = {
    loading: { id: 'loading', classList: cl(loading ? (leaving ? ['leaving'] : []) : ['hidden']) },
    mtool: { id: 'mtool', classList: cl(mtool ? [] : ['hidden']) },
  };
  const kids = [{ id: 'app', tagName: 'DIV' }, els.loading];
  if (modal) kids.push({ id: 'whatsnew', tagName: 'DIV', css: { position: 'fixed', display: 'flex', visibility: 'visible', pointerEvents: 'auto', opacity: '1' }, rect: { width: 390, height: 780 } });
  kids.push({ id: 'lore-fx', tagName: 'DIV', css: { position: 'fixed', display: 'block', visibility: 'visible', pointerEvents: 'none', opacity: '1' }, rect: { width: 390, height: 780 } });
  const body = { classList: cl([...(mobile ? ['mobile'] : []), ...(land ? ['land'] : []), ...(sheet ? ['sheet-info'] : [])]), children: kids, style: { setProperty() {} } };
  const ctx = {
    console, Math, Set, Object, JSON,
    window: { innerWidth: 390, innerHeight: 780, addEventListener() {} },
    document: { body, readyState: 'loading', getElementById: id => els[id] || null, querySelectorAll: () => [] },
    getComputedStyle: el => el.css || { position: 'static', display: 'block', visibility: 'visible', pointerEvents: 'auto', opacity: '1' },
  };
  for (const k of kids) k.getBoundingClientRect = () => k.rect || { width: 0, height: 0 };
  vm.createContext(ctx);
  vm.runInContext(read('js/uilayers.js') + '\n;this.sync = uiLayersSync; this.modes = uiLayersModes;', ctx);
  ctx.sync();
  return body.classList;
}
const has = (b, k) => b.contains(k);

{ const b = page({ loading: true, mobile: true, mtool: true });
  check(has(b, 'ui-loading') && !has(b, 'ui-place'), 'заставка: ждали только ui-loading, получили ' + b.list().join(' ')); }
{ const b = page({ loading: true, leaving: true, mobile: true });
  check(!has(b, 'ui-loading'), 'заставка уходит (leaving) — интерфейс уже должен показываться'); }
{ const b = page({ mobile: true, mtool: true });
  check(has(b, 'ui-place') && !has(b, 'ui-modal'), 'телефон со зданием в руке: нет ui-place'); }
{ const b = page({ mobile: false, mtool: true });
  check(!has(b, 'ui-place'), 'ПК: панели размещения нет — ui-place не нужен'); }
{ const b = page({ mobile: true, sheet: true });
  check(has(b, 'ui-modal'), 'портрет, окно здания в шторке: нет ui-modal'); }
{ const b = page({ mobile: true, land: true, sheet: true });
  check(!has(b, 'ui-modal'), 'горизонталь: шторка сбоку и не накрывает способности — ui-modal не нужен'); }
{ const b = page({ loading: true, modal: true });
  check(has(b, 'ui-modal') && has(b, 'ui-loading'), 'окно поверх меню (выбор класса в коопе): нет ui-modal — значок версии лезет на окно'); }
{ const b = page({ modal: true });
  check(has(b, 'ui-modal'), '«Что нового» поверх игры: нет ui-modal'); }
{ const b = page({});
  check(!has(b, 'ui-modal') && !has(b, 'ui-place') && !has(b, 'ui-loading'), 'обычная игра: лишние режимы ' + b.list().join(' ') + ' (эффект без касаний не считается окном)'); }

// ---- CSS: что прячется в каком режиме и порядок слоёв
const css = read('css/uilayers.css').replace(/\/\*[\s\S]*?\*\//g, '');
const rule = sel => { const m = css.split('}').find(r => r.split('{')[0].includes(sel)); return m ? m.split('{')[1] : ''; };
check(/visibility:\s*hidden/.test(rule('body.ui-loading #app')), 'загрузка: #app (полоса со скоростью, герой, стройка) не скрыт');
const place = rule('body.ui-place :is(');
for (const id of ['#ab-bar', '#hero-card', '#ver-badge']) check(css.includes('body.ui-place :is(') && css.split('body.ui-place :is(')[1].split(')')[0].includes(id), `стройка: ${id} не скрыт`);
check(/display:\s*none\s*!important/.test(place), 'стройка: скрытие без !important — перебьют стили, которые панели вешают сами');
check(/display:\s*none/.test(rule('body.ui-modal :is(')), 'окно поверх игры: способности не скрыты');
const zPlace = +(css.match(/--z-place:\s*(\d+)/) || [])[1];
const abZ = +(read('js/heroabil.js').match(/#ab-bar\{position:absolute;[^}]*z-index:(\d+)/) || [])[1];
const topZ = +(read('css/style.css').match(/#topbar \{ z-index: (\d+)/) || [])[1];
check(zPlace > abZ && zPlace > topZ, `слой панели размещения (${zPlace}) не выше способностей (${abZ}) и верхней полосы (${topZ})`);
check(/#mtool:not\(\.hidden\)\s*\{\s*z-index:\s*var\(--z-place\)\s*!important/.test(css), 'панель размещения не на слое --z-place');
check(!/top:/.test(rule('body.ui-loading #ver-badge')) && /bottom:/.test(rule('body.ui-loading #ver-badge')), 'значок версии на заставке должен быть внизу (не на логотипе)');
check(!read('js/changelog.js').includes('ver-badge-css'), 'место значка версии снова задаётся в changelog.js — держим в css/uilayers.css');

// ---- index.html: класс с первого кадра, кнопка скорости внутри #app, файлы подключены
const html = read('index.html');
check(/<body class="[^"]*\bui-loading\b/.test(html), 'index.html: <body> без класса ui-loading — «×1» мигнёт до первого скрипта');
const iApp = html.indexOf('<div id="app">'), iSpeed = html.indexOf('id="speed-cur"'), iLoad = html.indexOf('<div id="loading"');
check(iApp >= 0 && iApp < iSpeed && iSpeed < iLoad, 'кнопка скорости вне #app — заставка её не спрячет');
check(html.includes('href="css/uilayers.css"') && html.includes('src="js/uilayers.js"'), 'index.html: слои не подключены');

if (fails.length) { for (const f of fails) console.log('✗ ' + f); process.exit(1); }
console.log('Проверка слоёв интерфейса: режимы, CSS и index.html в порядке.');
