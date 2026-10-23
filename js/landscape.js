'use strict';
// Телефон боком: два варианта интерфейса (переключатель — меню «Интерфейс»).
//   А — узкая колонка с иконками слева, панели выезжают поверх карты;
//   Б — карта на весь экран, кнопка ☰ со вкладками и быстрые кнопки по краям.
// Включается по ориентации (resize / orientationchange / matchMedia), вариант хранится в localStorage.
// В портрете и на компьютере ничего не меняется. Вёрстка — css/landscape.css (body.mobile.land-a / land-b).

const LAND_KEY = 'oldgold-land-variant';
const Land = { on: false, variant: 'a' };

function landLoad() {
  try { const v = localStorage.getItem(LAND_KEY); if (v === 'a' || v === 'b') Land.variant = v; } catch (e) {}
}

// боком и невысокий экран (телефон); планшеты и компьютер остаются как были
function detectLand() {
  return typeof detectMobile === 'function' && detectMobile() && window.innerWidth > window.innerHeight && window.innerHeight <= 540;
}

function applyLand() {
  const on = detectLand();
  const cl = document.body.classList;
  const changed = on !== Land.on;
  Land.on = on;
  cl.toggle('land', on);
  cl.toggle('land-a', on && Land.variant === 'a');
  cl.toggle('land-b', on && Land.variant === 'b');
  if (!on || Land.variant !== 'b') cl.remove('land-tabs');
  if (changed) {
    // шторка и карточки пересчитываются под новую раскладку
    if (typeof mobileSheet === 'function') mobileSheet(null);
    if (typeof heroCardUpdate === 'function') { try { heroCardUpdate(); } catch (e) {} }
    if (typeof resize === 'function') setTimeout(resize, 50);
  }
  document.querySelectorAll('#land-modal .lm-opt').forEach(b => b.classList.toggle('active', b.dataset.land === Land.variant));
  // иконки своих кнопок (iconURL может появиться позже скрипта)
  if (typeof iconURL === 'function') document.querySelectorAll('#land-build img[data-icon], [data-land="open"] img[data-icon]').forEach(im => { if (!im.src) try { im.src = iconURL('ui', im.dataset.icon, 2); } catch (e) {} });
}

// Закрытие шторки в горизонтали — с анимацией: класс шторки держится, пока она плавно уезжает влево
{
  const _sheet = mobileSheet;
  let outT = 0;
  mobileSheet = function (kind) {
    const cl = document.body.classList;
    const open = cl.contains('sheet-tab') || cl.contains('sheet-info');
    clearTimeout(outT);
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (Land.on && !kind && open && !reduce) {
      if (cl.contains('land-out')) return;
      cl.add('land-out');
      outT = setTimeout(() => { cl.remove('land-out'); _sheet(null); }, 230);
      return;
    }
    cl.remove('land-out');
    _sheet(kind);
  };
}

function setLandVariant(v) {
  if (v !== 'a' && v !== 'b') return;
  Land.variant = v;
  try { localStorage.setItem(LAND_KEY, v); } catch (e) {}
  applyLand();
}

function landModal(show) {
  const m = document.getElementById('land-modal');
  if (m) m.classList.toggle('hidden', !show);
}

function initLand() {
  landLoad();
  const view = document.getElementById('view');

  // быстрые кнопки варианта Б (в А они скрыты стилями)
  const fab = document.createElement('button');
  fab.id = 'land-fab'; fab.title = 'Меню: строительство, склад, хозяйство…'; fab.textContent = '☰';
  const bld = document.createElement('button');
  bld.id = 'land-build'; bld.title = 'Строительство'; bld.innerHTML = '<img data-icon="build" alt="">';
  view.appendChild(fab); view.appendChild(bld);
  fab.onclick = () => { mobileSheet(null); document.body.classList.toggle('land-tabs'); };
  bld.onclick = () => { document.body.classList.remove('land-tabs'); mobileTab('build'); };
  // выбрали вкладку или тронули карту — список вкладок закрывается
  document.getElementById('tabs').addEventListener('click', () => document.body.classList.remove('land-tabs'));
  document.addEventListener('pointerdown', e => {
    if (document.body.classList.contains('land-tabs') && !e.target.closest('#tabs, #land-fab')) document.body.classList.remove('land-tabs');
  }, true);

  // меню «Интерфейс»
  const list = document.querySelector('#tab-menu .menu-list');
  if (list) {
    const b = document.createElement('button');
    b.dataset.land = 'open'; b.innerHTML = '<img data-icon="menu" alt="">Интерфейс (горизонтально)';
    list.appendChild(b);
    }
  const modal = document.createElement('div');
  modal.id = 'land-modal'; modal.className = 'hidden';
  modal.innerHTML = `<div class="lm-box"><h3>Интерфейс</h3>
    <p class="lm-note">Как выглядит игра, когда телефон повёрнут набок. В вертикальном положении ничего не меняется.</p>
    <div class="lm-opts">
      <button class="lm-opt" data-land="a"><b>А · Колонка слева</b><small>Узкая колонка иконок: строительство, склад, жители, хозяйство, журнал, меню. Панели выезжают поверх карты.</small></button>
      <button class="lm-opt" data-land="b"><b>Б · Карта на весь экран</b><small>Без колонки. Кнопка ☰ раскрывает вкладки, рядом кнопка «Строительство». Панели — шторки поверх карты.</small></button>
    </div>
    <button class="lm-close">Готово</button></div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => {
    const o = e.target.closest('.lm-opt');
    if (o) { setLandVariant(o.dataset.land); return; }
    if (e.target === modal || e.target.closest('.lm-close')) landModal(false);
  });
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-land="open"]');
    if (!t) return;
    if (typeof mobileSheet === 'function') mobileSheet(null);
    landModal(true);
  });

  window.addEventListener('resize', applyLand);
  window.addEventListener('orientationchange', () => setTimeout(applyLand, 120));
  try { matchMedia('(orientation: landscape)').addEventListener('change', () => setTimeout(applyLand, 60)); } catch (e) {}
  applyLand();
  // Mobile.on выставляется после загрузки игры — пересчитываем ещё раз
  setTimeout(applyLand, 600);
  setTimeout(applyLand, 2500);
}

initLand();
