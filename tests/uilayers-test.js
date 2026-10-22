'use strict';
// Слои интерфейса без браузера (js/uilayers.js + css/uilayers.css):
//  · режимы: загрузка/меню — ui-loading; телефон со зданием в руке — ui-place; окно поверх игры — ui-modal;
//  · при открытой панели размещения панель способностей, карточка героя и значок версии скрыты, панель ✓ ↻ ✕ выше всех игровых;
//  · на загрузке кнопки скорости нет: она внутри #app, а #app скрыт с самого первого кадра (класс в index.html).
//  · музыка на заставке: один выключатель (кнопка-нота) с первого кадра, не на логотипе; «♪» игры — только в игре.
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

// ---- окно босса (Курганный князь) не под панелью способностей
check(/body\.mobile\.ui-ab #raid-hud \{ bottom: calc\(var\(--ui-ab-top/.test(css) && /body\.ui-ab:not\(\.mobile\) #raid-hud/.test(css), 'окно Курганного князя не отодвигается от панели способностей');

// ---- раскрытое меню верхней полосы выше окна обучения (шаг «Первая ночь»: «Ускорьте время»)
const tutZ = +(read('css/tutorial.css').match(/#tut \{[^}]*z-index: (\d+)/) || [])[1];
const ddZ = +(css.match(/#topbar:has\(\.dd\.open\)\s*\{\s*z-index:\s*(\d+)/) || [])[1];
check(ddZ > tutZ, `раскрытое меню скорости (${ddZ}) не выше окна обучения (${tutZ}) — ×2 ×3 не нажать`);
for (const f of fs.readdirSync(path.join(ROOT, 'css')).filter(f => f !== 'uilayers.css' && f !== 'style.css'))
  check(!/#topbar:has\(\.dd\.open\)\s*\{\s*z-index/.test(read('css/' + f)), `css/${f}: z-index раскрытой верхней полосы задаётся не в uilayers.css`);

// ---- музыка на заставке: один выключатель с первого кадра, «♪» игры внутри скрытого #app, логотип ниже кнопки на телефоне
const iSnd = html.indexOf('id="dd-snd"');
check(iApp < iSnd && iSnd < iLoad, '«♪» верхней полосы вне #app — на заставке будет второй выключатель музыки');
const sm = read('js/startmenu.js'), st = read('css/style.css');
check((sm.match(/mb\.id = 'sm-music'/g) || []).length === 1, 'кнопка-нота меню создаётся не в одном месте — дубль');
check(/^if \([^\n]*\) try \{ smMusicBtnInit\(\); \}/m.test(sm), 'кнопка-нота создаётся только после постройки мира — выскакивает вспышкой');
check(!/#loading:not\(\.with-menu\) #sm-music \{ display: none/.test(st), 'кнопка-нота спрятана на заставке и выскакивает при открытии меню');
check(/@media \(max-width: 700px\) \{ #loading \.load-title \{ top: max\(5vh, calc\(48px/.test(st), 'телефон: логотип не опущен под кнопку-ноту — перекрываются');
check(/function musicLoadPrefs[\s\S]*feod\.menuMusic/.test(read('js/sound/music.js')), 'выключенная музыка меню не запоминается (feod.menuMusic)');

if (fails.length) { for (const f of fails) console.log('✗ ' + f); process.exit(1); }
console.log('Проверка слоёв интерфейса: режимы, CSS и index.html в порядке.');
