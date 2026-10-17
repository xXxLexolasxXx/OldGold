'use strict';
// Настраиваемая левая колонка (только на компьютере):
// ширина колонки — за правый край, высота окна здания — за разделитель,
// миникарта сворачивается, окно здания можно открепить и таскать по экрану.
// Всё запоминается в localStorage.

const LAYOUT_KEY = 'oldgold-layout';
const Layout = { panelW: 316, infoH: 0, mmFolded: false, mmBig: false, float: false, fx: 340, fy: 60, fw: 360, fh: 420 };

function loadLayout() {
  try { Object.assign(Layout, JSON.parse(localStorage.getItem(LAYOUT_KEY)) || {}); } catch (e) {}
}

function saveLayout() {
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(Layout)); } catch (e) {}
}

function applyLayout() {
  const panel = document.getElementById('panel'), wrap = document.getElementById('info-wrap');
  const cl = document.body.classList;
  if (Mobile.on) {
    // на телефоне своя вёрстка — ручные размеры убираем
    panel.style.width = ''; wrap.removeAttribute('style');
    cl.remove('info-float', 'mm-folded');
    return;
  }
  panel.style.width = Layout.panelW + 'px';
  cl.toggle('mm-folded', Layout.mmFolded);
  cl.toggle('mm-big', !!Layout.mmBig);
  { const b = document.getElementById('mm-size'); if (b) { b.textContent = Layout.mmBig ? '⤡' : '⤢'; b.title = Layout.mmBig ? 'Уменьшить миникарту' : 'Увеличить миникарту'; } }
  document.getElementById('mm-fold').textContent = Layout.mmFolded ? '▾' : '▴';
  cl.toggle('info-float', Layout.float);
  document.getElementById('info-pop').textContent = Layout.float ? '⇲' : '⧉';
  document.getElementById('info-pop').title = Layout.float ? 'Вернуть окно в колонку' : 'Открепить окно — его можно двигать и растягивать';
  if (Layout.float) {
    // не даём окну уехать за край экрана
    Layout.fw = Math.min(Layout.fw, innerWidth - 20); Layout.fh = Math.min(Layout.fh, innerHeight - 20);
    Layout.fx = Math.max(0, Math.min(innerWidth - Layout.fw, Layout.fx));
    Layout.fy = Math.max(0, Math.min(innerHeight - Layout.fh, Layout.fy));
    Object.assign(wrap.style, { left: Layout.fx + 'px', top: Layout.fy + 'px', width: Layout.fw + 'px', height: Layout.fh + 'px' });
  } else {
    wrap.style.left = wrap.style.top = wrap.style.width = '';
    wrap.style.height = Layout.infoH ? Layout.infoH + 'px' : '';
  }
}

// Перетаскивание с захватом указателя: onMove(dx, dy), onEnd()
function dragFrom(el, onStart, onMove, onEnd) {
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0 || Mobile.on) return;
    if (e.target.closest('button') && e.target !== el) return;
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    onStart();
    el.classList.add('drag');
    el.setPointerCapture(e.pointerId);
    const mv = ev => onMove(ev.clientX - sx, ev.clientY - sy);
    const up = () => {
      el.classList.remove('drag');
      el.removeEventListener('pointermove', mv);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      onEnd && onEnd();
      saveLayout();
    };
    el.addEventListener('pointermove', mv);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  });
}

function initLayout() {
  loadLayout();
  const panel = document.getElementById('panel'), wrap = document.getElementById('info-wrap');

  // ширина колонки
  let w0 = 0;
  dragFrom(document.getElementById('panel-resize'),
    () => { w0 = panel.offsetWidth; },
    dx => { Layout.panelW = Math.round(Math.max(250, Math.min(innerWidth * 0.6, 640, w0 + dx))); applyLayout(); });

  // высота окна здания (вкладки получают остальное)
  let h0 = 0;
  dragFrom(document.getElementById('split'),
    () => { h0 = wrap.offsetHeight; },
    (dx, dy) => {
      const tabs = document.getElementById('tab-area');
      const maxH = wrap.offsetHeight + tabs.offsetHeight - 90;     // вкладкам оставляем хотя бы 90 px
      Layout.infoH = Math.round(Math.max(110, Math.min(maxH, h0 - dy)));
      applyLayout();
    });

  // плавающее окно тянется за шапку
  let p0 = null;
  dragFrom(document.getElementById('info-bar'),
    () => { p0 = [Layout.fx, Layout.fy]; },
    (dx, dy) => { if (!Layout.float) return; Layout.fx = p0[0] + dx; Layout.fy = p0[1] + dy; applyLayout(); });

  // размер плавающего окна меняется уголком (CSS resize) — запоминаем
  new ResizeObserver(() => {
    if (!Layout.float || Mobile.on) return;
    Layout.fw = wrap.offsetWidth; Layout.fh = wrap.offsetHeight;
    saveLayout();
  }).observe(wrap);

  document.getElementById('info-pop').onclick = () => {
    Layout.float = !Layout.float;
    if (Layout.float && !localStorage.getItem(LAYOUT_KEY + '-moved')) {
      // первый раз — рядом с колонкой
      Layout.fx = panel.offsetWidth + 16; Layout.fy = 56;
      try { localStorage.setItem(LAYOUT_KEY + '-moved', '1'); } catch (e) {}
    }
    applyLayout(); saveLayout();
  };
  document.getElementById('mm-size').onclick = () => { Layout.mmBig = !Layout.mmBig; applyLayout(); saveLayout(); };
  document.getElementById('mm-fold').onclick = () => { Layout.mmFolded = !Layout.mmFolded; applyLayout(); saveLayout(); };

  // холст карты подстраивается под новую ширину колонки
  new ResizeObserver(() => resize()).observe(R.canvas);
  window.addEventListener('resize', applyLayout);
  applyLayout();
}
