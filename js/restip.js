'use strict';
// Подсказка по иконке ресурса: название, сколько есть / нужно, где производится и куда идёт.
// Телефон: тап по иконке (в складе, карточках зданий, строке стройки, рецептах, окнах) или долгое нажатие по строке.
// Компьютер: наведение мыши. Иконки помечает gi() атрибутом data-g.

const RTip = { el: null, g: null, timer: 0, hideT: 0, hold: 0, suppress: 0 };

const rtpName = g => (GOODS[g] && GOODS[g].name) || g;
const rtpEsc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

// кто выпускает / расходует / строится из товара g (по описанию зданий)
function rtpWhere(g) {
  const make = new Set(), use = new Set(), build = new Set();
  for (const k in BUILDINGS) {
    const d = BUILDINGS[k];
    if (!d || !d.name) continue;
    if (d.noMenu && k !== 'school') continue;
    let mk = false, us = false;
    for (const r of d.recipes || []) { if (r.out && r.out[g]) mk = true; if (r.in && r.in[g]) us = true; }
    if (d.outputs && d.outputs[g] && !(d.recipes && d.recipes.length)) mk = true;
    if (d.inputs && d.inputs[g] && !(d.recipes && d.recipes.length) && k !== 'storehouse') us = true;
    if (mk) make.add(d.name);
    if (us) use.add(d.name);
    if (d.cost && d.cost[g]) build.add(d.name);
  }
  return { make: [...make], use: [...use], build: [...build] };
}

function rtpList(arr, n = 4) {
  if (!arr.length) return '';
  return rtpEsc(arr.slice(0, n).join(', ')) + (arr.length > n ? ` и ещё ${arr.length - n}` : '');
}

function rtpHTML(g, need) {
  const gd = GOODS[g];
  if (!gd) return '';
  let have = null;
  try { if (typeof Game !== 'undefined' && Game.buildings && typeof totals === 'function') have = totals()[g]; } catch (e) { have = null; }
  const w = rtpWhere(g);
  let h = `<div class="rt-head"><img src="${iconURL('good', g, 3)}" alt=""><div><b>${rtpEsc(gd.name)}</b><i>${rtpEsc(gd.group || '')}</i></div></div>`;
  if (need != null && have != null) h += `<div class="rt-row ${have >= need ? 'ok' : 'bad'}">Нужно: <b>${need}</b> · на складе: <b>${have}</b></div>`;
  else if (have != null) h += `<div class="rt-row">На складе: <b>${have}</b></div>`;
  if (w.make.length) h += `<div class="rt-row">Производят: ${rtpList(w.make)}</div>`;
  else h += '<div class="rt-row dim">Не производится: добывают в мире или привозят</div>';
  if (w.use.length) h += `<div class="rt-row">Идёт в: ${rtpList(w.use)}</div>`;
  if (w.build.length) h += `<div class="rt-row">Для стройки: ${rtpList(w.build, 3)}</div>`;
  return h;
}

function rtpHide() {
  clearTimeout(RTip.timer); clearTimeout(RTip.hideT);
  RTip.g = null;
  if (RTip.el) RTip.el.classList.add('hidden');
}

function rtpShow(img, touch) {
  const g = img && img.dataset && img.dataset.g;
  if (!g || !GOODS[g]) return;
  let need = null;
  const cost = img.closest('.cost');
  if (cost) { const m = (img.parentNode.textContent || '').match(/(\d+)\s*$/); if (m) need = +m[1]; }
  if (!RTip.el) {
    RTip.el = document.createElement('div');
    RTip.el.id = 'restip';
    document.body.appendChild(RTip.el);
  }
  const el = RTip.el;
  el.innerHTML = rtpHTML(g, need) + (touch && img.closest('[data-block]') ? '<div class="rt-row dim">Нажмите на число — запретить складам брать</div>' : '');
  el.classList.remove('hidden');
  RTip.g = g;
  const r = img.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight;
  const w = el.offsetWidth, h = el.offsetHeight;
  let x = Math.min(Math.max(6, r.left + r.width / 2 - w / 2), W - w - 6);
  let y = r.top - h - 8;
  if (y < 6) y = Math.min(r.bottom + 8, H - h - 6);
  el.style.left = x + 'px'; el.style.top = Math.max(6, y) + 'px';
  clearTimeout(RTip.hideT);
  if (touch) RTip.hideT = setTimeout(rtpHide, 4500);
}

const rtpIcon = t => t && t.closest ? t.closest('img[data-g]') : null;

// компьютер: наведение
document.addEventListener('pointerover', e => {
  if (e.pointerType !== 'mouse') return;
  const img = rtpIcon(e.target);
  if (!img) return;
  clearTimeout(RTip.timer);
  RTip.timer = setTimeout(() => rtpShow(img, false), 220);
}, true);
document.addEventListener('pointerout', e => {
  if (e.pointerType !== 'mouse' || !rtpIcon(e.target)) return;
  rtpHide();
}, true);

// телефон: долгое нажатие по иконке или по строке с иконкой
document.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse') { rtpHide(); return; }
  const was = RTip.g;
  if (!rtpIcon(e.target) || !was) { if (!(e.target.closest && e.target.closest('#restip'))) rtpHide(); }
  const row = e.target.closest && e.target.closest('.slot, .res-row, .recipe, .stat-row, .cost span, .bal-row');
  const img = rtpIcon(e.target) || (row && row.querySelector('img[data-g]'));
  if (!img) return;
  clearTimeout(RTip.hold);
  const sx = e.clientX, sy = e.clientY;
  RTip.mv = ev => { if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 10) rtpCancel(); };
  document.addEventListener('pointermove', RTip.mv, true);
  RTip.hold = setTimeout(() => { RTip.suppress = performance.now() + 900; rtpShow(img, true); }, 450);
}, true);
function rtpCancel() { clearTimeout(RTip.hold); if (RTip.mv) document.removeEventListener('pointermove', RTip.mv, true); RTip.mv = null; }
document.addEventListener('pointerup', rtpCancel, true);
document.addEventListener('pointercancel', rtpCancel, true);
document.addEventListener('scroll', () => { if (RTip.g) rtpHide(); }, true);

// после долгого нажатия отпускание не должно «нажимать» кнопку; обычный тап по иконке — показывает подсказку
document.addEventListener('click', e => {
  if (performance.now() < RTip.suppress) { e.stopPropagation(); e.preventDefault(); return; }
  const img = rtpIcon(e.target);
  if (!img || e.pointerType === 'mouse' || !(e.pointerType || document.body.classList.contains('mobile'))) return;
  if (img.closest('#res-sum')) return;   // верхняя плашка ресурсов раскрывает список; подсказка — долгим нажатием
  e.stopPropagation(); e.preventDefault();
  rtpShow(img, true);
}, true);
document.addEventListener('contextmenu', e => { if (rtpIcon(e.target)) e.preventDefault(); }, true);
