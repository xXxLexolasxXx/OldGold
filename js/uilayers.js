'use strict';
// Слои интерфейса и «режимы экрана» — одно место вместо точечных z-index по разным файлам.
// Порядок слоёв и что прячется в каком режиме — css/uilayers.css. Здесь — только режим на <body>:
//   ui-loading — заставка «Создаём мир…» и стартовое меню: игровой интерфейс (полоса со скоростью, герой, стройка) скрыт.
//                Класс стоит на <body> прямо в index.html, поэтому «×1» не мигает даже до первого скрипта;
//   ui-place   — на телефоне в руке здание/дорога/поле/снос: панель размещения (✓ ↻ ✕) поверх всего игрового,
//                панель способностей, карточка героя и значок версии свёрнуты и не ловят касания;
//   ui-modal   — поверх игры окно: шторка в портрете (окно здания, вкладка), «Что нового», выбор героя,
//                любое полноэкранное окно — панель способностей, подсказки, баннер паузы и значок версии убраны;
//   ui-ab      — панель способностей на экране: подсказки и баннер паузы отодвинуты от неё.
// Пересчёт — сразу при смене инструмента (mobileTool), по изменениям <body>/#loading/#mtool и дважды в секунду
// на случай окон, которые прячутся стилем. На сервере и в тестах без DOM файл ничего не делает.

const UIL = { t: 0, abw: '', abt: '' };
const UIL_SKIP = new Set(['app', 'loading', 'ver-badge']);

// режимы из состояния (чистая функция — её проверяет tests/uilayers-test.js)
function uiLayersModes(s) {
  const loading = !!s.loading;
  return {
    'ui-loading': loading,
    'ui-place': !loading && !!s.place,
    'ui-modal': !!s.modal || (!loading && !!s.sheet),   // окно поверх меню (выбор класса в коопе) — тоже окно
  };
}

// полноэкранное окно, которое ловит касания: прямой потомок <body> поверх всей страницы
function uiModalOpen() {
  const W = window.innerWidth, H = window.innerHeight;
  for (const el of document.body.children) {
    if (UIL_SKIP.has(el.id) || /^(SCRIPT|STYLE|LINK)$/.test(el.tagName)) continue;
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden' || cs.pointerEvents === 'none' || +cs.opacity === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width >= W * 0.8 && r.height >= H * 0.8) return true;
  }
  // окна общей очереди (notify.js) помечены data-nq-modal — карточка воспоминания и др., даже не во весь экран
  for (const el of document.querySelectorAll('[data-nq-modal]')) if (el.getClientRects().length) return true;
  return false;
}

function uiLayersRead() {
  const b = document.body.classList, ld = document.getElementById('loading'), mt = document.getElementById('mtool');
  return {
    loading: !!ld && !ld.classList.contains('hidden') && !ld.classList.contains('leaving'),
    place: b.contains('mobile') && !!mt && !mt.classList.contains('hidden'),
    sheet: b.contains('mobile') && !b.contains('land') && (b.contains('sheet-info') || b.contains('sheet-tab')),
    modal: uiModalOpen(),
  };
}

function uiLayersSync() {
  if (typeof document === 'undefined' || !document.body) return;
  const m = uiLayersModes(uiLayersRead()), b = document.body.classList;
  for (const k in m) if (b.contains(k) !== m[k]) b.toggle(k, m[k]);
  // панель способностей на экране: подсказки и баннер паузы уходят из-под неё (ПК — вбок, телефон — выше).
  // --ui-ab-w — от правого края карты до левого края панели, --ui-ab-top — от низа карты до верха панели
  const ab = document.getElementById('ab-bar'), view = document.getElementById('view');
  const on = !!ab && !!view && !m['ui-loading'] && !m['ui-place'] && !m['ui-modal'] && !ab.classList.contains('hidden') && getComputedStyle(ab).display !== 'none';
  if (b.contains('ui-ab') !== on) b.toggle('ui-ab', on);
  if (on) {
    const r = ab.getBoundingClientRect(), v = view.getBoundingClientRect();
    const w = Math.ceil(v.right - r.left) + 'px', top = Math.ceil(v.bottom - r.top) + 'px';
    if (UIL.abw !== w) { UIL.abw = w; document.body.style.setProperty('--ui-ab-w', w); }
    if (UIL.abt !== top) { UIL.abt = top; document.body.style.setProperty('--ui-ab-top', top); }
  }
}

function initUiLayers() {
  uiLayersSync();
  const mo = new MutationObserver(uiLayersSync);
  mo.observe(document.body, { childList: true, attributes: true, attributeFilter: ['class'] });
  for (const id of ['loading', 'mtool']) { const el = document.getElementById(id); if (el) mo.observe(el, { attributes: true, attributeFilter: ['class'] }); }
  const loop = t => {
    if (t - UIL.t > 500) { UIL.t = t; try { uiLayersSync(); } catch (e) { /* интерфейс ещё не готов */ } }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

if (typeof document !== 'undefined' && typeof window !== 'undefined' && window.addEventListener && typeof MutationObserver !== 'undefined') {
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', initUiLayers);
  else initUiLayers();
}
