'use strict';
// Меню игры. Сверху всегда под рукой: «Сохранить» и «Загрузить» в один ряд, «Автосохранение» и «Справка».
// Ниже две раскрывающиеся группы — «Настройки» и «Ещё» (открыта только одна), в самом низу «Выйти в главное меню».
// Кнопки сюда добавляют разные файлы (profile, perf, notify, landscape, startmenu…) и в разное время, поэтому
// раскладываем их по группам сами и следим за новыми: что не узнали — уходит в «Ещё». Обработчики кликов
// не трогаем — кнопки остаются внутри .menu-list, делегирование работает как раньше.
// Порядок верхнего уровня задаёт CSS (order), а не перестановка узлов — так наблюдатель не зацикливается.

const MENU_QUICK = '[data-menu="save"], [data-menu="load"]';   // ряд из двух кнопок
const MENU_TOP = '[data-menu="loadauto"], [data-guide], [data-menu="mainmenu"]';   // всегда на виду
const MENU_GROUPS = [
  { k: 'set', icon: 'menu', name: 'Настройки', sel: '[data-menu="lang"], [data-pc], [data-land="open"], [data-nq="mode"], #dz-btn, #eco-btn, #tele-btn' },
  { k: 'more', icon: 'scroll', name: 'Ещё', sel: '*' },
];

function menuGroupsSort() {
  const list = document.querySelector('#tab-menu .menu-list');
  if (!list) return;
  if (!list.querySelector(':scope > .mg-quick')) {
    const q = document.createElement('div');
    q.className = 'mg-quick';
    list.prepend(q);
    for (const g of MENU_GROUPS) {
      const d = document.createElement('div');
      d.className = 'mg'; d.dataset.mg = g.k;
      d.innerHTML = `<button class="mg-h"><img data-icon="${g.icon}" alt="">${g.name}<span class="mg-n"></span><span class="mg-arr">▸</span></button><div class="mg-wrap"><div class="mg-body"></div></div>`;
      list.appendChild(d);
      try { d.querySelector('img').src = iconURL('ui', g.icon, 2); } catch (e) { /* без иконки */ }
    }
  }
  const quick = list.querySelector(':scope > .mg-quick');
  for (const el of [...list.children]) {
    if (el.classList.contains('mg') || el === quick || el.matches(MENU_TOP)) continue;
    if (el.matches(MENU_QUICK)) { quick.appendChild(el); continue; }
    const g = MENU_GROUPS.find(x => x.sel === '*' || el.matches(x.sel));
    list.querySelector(`.mg[data-mg="${g.k}"] .mg-body`).appendChild(el);
  }
  for (const d of list.querySelectorAll(':scope > .mg')) {
    const n = [...d.querySelectorAll('.mg-body > *')].filter(b => getComputedStyle(b).display !== 'none').length;
    d.querySelector('.mg-n').textContent = n ? n : '';
    d.classList.toggle('hidden', !n);
  }
}

function initMenuGroups() {
  const list = document.querySelector('#tab-menu .menu-list');
  if (!list) return;
  list.addEventListener('click', e => {
    const h = e.target.closest('.mg-h');
    if (!h) return;
    const d = h.parentElement, open = !d.classList.contains('open');
    for (const x of list.querySelectorAll('.mg.open')) x.classList.remove('open');
    d.classList.toggle('open', open);
  });
  // новые кнопки от других файлов — сразу по группам
  let busy = false;
  new MutationObserver(() => {
    if (busy) return;
    busy = true;
    try { menuGroupsSort(); } finally { busy = false; }
  }).observe(list, { childList: true });
  menuGroupsSort();
  // при каждом новом открытии меню группы свёрнуты
  document.querySelectorAll('#tabs [data-tab="menu"]').forEach(b => b.addEventListener('click', () => {
    for (const x of list.querySelectorAll('.mg.open')) x.classList.remove('open');
  }));
}

{
  const _s = startGame;
  startGame = function () { _s(); menuGroupsSort(); };
}
initMenuGroups();
