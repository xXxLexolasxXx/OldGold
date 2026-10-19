'use strict';
// Фото-режим: прячет интерфейс, камера двигается свободно (тяните карту, колесо/щипок — масштаб),
// на кадр накладываются фильтр и рамка с подписью «название деревни · сутки N», снимок уходит в PNG
// (на телефоне — «Поделиться», на компьютере — скачивание). Ничего тяжёлого: фильтры — несколько заливок
// режимами смешивания (в превью — div'ы с mix-blend-mode, в снимке — те же слои через globalCompositeOperation),
// рамка и подпись рисуются обычным 2D-холстом один раз на кадр превью/снимка, а не каждый кадр игры.
// Вход: кнопка в меню или клавиша K, выход: Esc, K или кнопка «Выйти». Работает и в коопе (камера у каждого своя).

const PH_KEY = 'oldgold-photo';
const PH_FRAMES = [['none', 'Без рамки'], ['parch', 'Пергамент'], ['wood', 'Дерево'], ['double', 'Двойная'], ['cinema', 'Кино']];
// слои фильтра: m — режим смешивания, c — цвет или 'vig' (виньетка)
const PH_FILTERS = {
  none:   ['Обычный', []],
  warm:   ['Тёплый', [{ m: 'soft-light', c: 'rgba(255,170,70,0.55)' }, { m: 'multiply', c: 'rgb(255,238,208)' }]],
  cold:   ['Холодный', [{ m: 'soft-light', c: 'rgba(70,120,255,0.55)' }]],
  sunset: ['Закат', [{ m: 'soft-light', c: 'rgba(255,96,40,0.65)' }, { m: 'multiply', c: 'rgb(255,216,176)' }, { m: 'normal', c: 'vig' }]],
  sepia:  ['Сепия', [{ m: 'saturation', c: 'rgb(0,0,0)' }, { m: 'multiply', c: 'rgb(210,172,118)' }]],
  bw:     ['Чёрно-белый', [{ m: 'saturation', c: 'rgb(0,0,0)' }, { m: 'normal', c: 'vig' }]],
  old:    ['Старина', [{ m: 'saturation', c: 'rgba(0,0,0,0.5)' }, { m: 'multiply', c: 'rgb(238,218,170)' }, { m: 'normal', c: 'vig' }]],
};
const PH_VIG0 = 0.45, PH_VIG_A = 0.6;   // где начинается виньетка (доля радиуса) и её тёмность

const Photo = { on: false, frame: 'parch', filter: 'none', caption: true, pause: true, wasPaused: false, wasSpeed: 1, zoom: null, tid: 0, drag: null, shot: 0 };

function phLoad() {
  try {
    const s = JSON.parse(localStorage.getItem(PH_KEY) || '{}');
    if (PH_FRAMES.some(f => f[0] === s.frame)) Photo.frame = s.frame;
    if (PH_FILTERS[s.filter]) Photo.filter = s.filter;
    if (typeof s.caption === 'boolean') Photo.caption = s.caption;
    if (typeof s.pause === 'boolean') Photo.pause = s.pause;
  } catch (e) { /* нет хранилища */ }
}
function phSave() { try { localStorage.setItem(PH_KEY, JSON.stringify({ frame: Photo.frame, filter: Photo.filter, caption: Photo.caption, pause: Photo.pause })); } catch (e) { /* нет хранилища */ } }

function phCaptionText() {
  const name = typeof villageName === 'function' ? villageName() : 'OldGold';
  const d = typeof chronDay === 'function' ? chronDay() : Math.floor(Game.time / 240) + 1;
  return `«${name}» · сутки ${d}`;
}

// ---------- Рамка и подпись: рисуются на холст (превью и снимок) ----------
function phBand(w, h, f) { return f === 'parch' || f === 'wood' ? Math.round(Math.min(w, h) * 0.05) : 0; }

function phDrawFrame(c, w, h, f, caption, cap) {
  const m = Math.min(w, h), t = phBand(w, h, f);
  const fs = Math.max(12, Math.round(m * 0.036));
  c.save();
  c.textBaseline = 'middle';
  if (f === 'cinema') {
    const bar = Math.round(h * 0.09);
    c.fillStyle = '#000'; c.fillRect(0, 0, w, bar); c.fillRect(0, h - bar, w, bar);
  } else if (f === 'parch' || f === 'wood') {
    const bot = caption ? Math.round(t + fs * 1.5) : t;
    const a = f === 'parch' ? ['#efdfae', '#d6bd80'] : ['#6a4a2a', '#3e2a16'];
    const g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, a[0]); g.addColorStop(1, a[1]);
    c.fillStyle = g;
    c.fillRect(0, 0, w, t); c.fillRect(0, 0, t, h); c.fillRect(w - t, 0, t, h); c.fillRect(0, h - bot, w, bot);
    c.strokeStyle = f === 'parch' ? '#5a3a1a' : '#1a0f06'; c.lineWidth = Math.max(2, m * 0.004);
    c.strokeRect(t, t, w - 2 * t, h - t - bot);
    if (f === 'wood') {   // «доски»: тонкие тёмные полосы вдоль рамки
      c.strokeStyle = 'rgba(20,10,0,0.35)'; c.lineWidth = 1;
      for (let i = 1; i < 3; i++) { const o = t * i / 3; c.strokeRect(o, o, w - 2 * o, h - 2 * o); }
    }
    if (caption) {
      c.fillStyle = f === 'parch' ? '#3a2a14' : '#f2dca0';
      c.font = `italic ${fs}px Georgia, 'Times New Roman', serif`;
      c.textAlign = 'center';
      c.fillText(cap, w / 2, h - bot / 2 + t * 0.15);
    }
  } else if (f === 'double') {
    const o = Math.round(m * 0.025);
    c.strokeStyle = '#f0d27a'; c.lineWidth = Math.max(2, m * 0.004);
    c.strokeRect(o, o, w - 2 * o, h - 2 * o);
    c.lineWidth = Math.max(1, m * 0.0018);
    c.strokeRect(o * 1.6, o * 1.6, w - 3.2 * o, h - 3.2 * o);
  }
  // подпись поверх картинки, если рамки-полосы нет
  if (caption && f !== 'parch' && f !== 'wood') {
    const bar = f === 'cinema' ? Math.round(h * 0.09) : 0, o = f === 'double' ? Math.round(m * 0.05) : Math.round(m * 0.03);
    c.font = `italic ${fs}px Georgia, 'Times New Roman', serif`;
    c.textAlign = 'left';
    c.lineWidth = Math.max(3, fs * 0.2); c.strokeStyle = 'rgba(20,10,0,0.85)'; c.lineJoin = 'round';
    c.strokeText(cap, o, h - bar - o); c.fillStyle = '#fff1c8'; c.fillText(cap, o, h - bar - o);
  }
  // тихая подпись игры: пригодится, когда снимок разойдётся по сети
  c.font = `bold ${Math.max(10, Math.round(fs * 0.55))}px Georgia, serif`;
  c.textAlign = 'right';
  const wmY = f === 'cinema' ? h - Math.round(h * 0.09) / 2 : h - (f === 'parch' || f === 'wood' ? (caption ? Math.round(t + fs * 1.5) : t) / 2 : m * 0.03);
  c.fillStyle = f === 'parch' ? 'rgba(58,42,20,0.7)' : 'rgba(255,241,200,0.75)';
  c.fillText('OldGold', w - Math.max(10, t + m * 0.012, m * 0.02), wmY);
  c.restore();
}

// слои фильтра в снимок
function phDrawFilter(c, w, h, key) {
  for (const L of PH_FILTERS[key][1]) {
    c.save();
    c.globalCompositeOperation = L.m;
    if (L.c === 'vig') {
      const R0 = Math.hypot(w, h) / 2, g = c.createRadialGradient(w / 2, h / 2, R0 * PH_VIG0, w / 2, h / 2, R0);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${PH_VIG_A})`);
      c.fillStyle = g;
    } else c.fillStyle = L.c;
    c.fillRect(0, 0, w, h);
    c.restore();
  }
}

// ---------- Снимок ----------
function phRender() {
  const src = R.canvas, w = src.width, h = src.height;
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const c = out.getContext('2d');
  c.drawImage(src, 0, 0);
  phDrawFilter(c, w, h, Photo.filter);
  phDrawFrame(c, w, h, Photo.frame, Photo.caption, phCaptionText());
  return out;
}

function phMsg(text) {
  const el = document.getElementById('ph-msg');
  if (!el) return;
  el.textContent = text; el.classList.add('on');
  clearTimeout(phMsg.t); phMsg.t = setTimeout(() => el.classList.remove('on'), 3200);
}

function phFileName() {
  const n = (typeof villageName === 'function' ? villageName() : 'oldgold').replace(/[^\wа-яё]+/gi, '_');
  return `OldGold_${n}_${Photo.shot}.png`;
}

function phShoot() {
  Photo.shot++;
  const fl = document.getElementById('ph-flash');
  if (fl) { fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go'); }
  let cv;
  try { cv = phRender(); } catch (e) { console.error(e); phMsg('Не удалось сделать снимок'); return; }
  cv.toBlob(async blob => {
    if (!blob) { phMsg('Не удалось сделать снимок'); return; }
    const name = phFileName();
    try {
      const file = new File([blob], name, { type: 'image/png' });
      const touch = (typeof Mobile !== 'undefined' && Mobile.on) || (navigator.maxTouchPoints > 0 && /Android|iPhone|iPad/i.test(navigator.userAgent));
      if (touch && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'OldGold', text: phCaptionText() });
        return;
      }
    } catch (e) { if (e && e.name === 'AbortError') return; /* нет «Поделиться» — просто скачиваем */ }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    phMsg('Снимок сохранён: ' + name);
  }, 'image/png');
}

// ---------- Экран ----------
function phChips(list, cur, attr) {
  return list.map(([k, n]) => `<button class="ph-chip${k === cur ? ' on' : ''}" data-${attr}="${k}">${n}</button>`).join('');
}

function phUiHTML() {
  const coop = typeof Coop !== 'undefined' && Coop.on;
  return `<div class="ph-row ph-scroll" id="ph-frames">${phChips(PH_FRAMES, Photo.frame, 'phf')}</div>
    <div class="ph-row ph-scroll" id="ph-filters">${phChips(Object.entries(PH_FILTERS).map(([k, v]) => [k, v[0]]), Photo.filter, 'phx')}</div>
    <div class="ph-row"><button class="ph-chip${Photo.caption ? ' on' : ''}" data-phc="cap">Подпись</button>${coop ? '' : `<button class="ph-chip${Photo.pause ? ' on' : ''}" data-phc="pause">Пауза</button>`}
      <button class="ph-chip" data-phc="fold" title="Свернуть панель">▾</button><button class="ph-snap" data-phc="snap" title="Сделать снимок (Пробел)">📷 Снимок</button><button class="ph-chip" data-phc="exit" title="Выйти (Esc)">Выйти</button></div>`;
}

function phSyncPreview() {
  const fx = document.getElementById('ph-fx'), ov = document.getElementById('ph-ov');
  if (!fx || !ov) return;
  fx.innerHTML = PH_FILTERS[Photo.filter][1].map(L => {
    const bg = L.c === 'vig' ? `radial-gradient(circle farthest-corner at 50% 50%, rgba(0,0,0,0) ${PH_VIG0 * 100}%, rgba(0,0,0,${PH_VIG_A}) 100%)` : L.c;
    return `<i style="mix-blend-mode:${L.m};background:${bg}"></i>`;
  }).join('');
  const dpr = typeof screenDPR === 'function' ? screenDPR() : 1;
  const w = Math.round(ov.clientWidth * dpr), h = Math.round(ov.clientHeight * dpr);
  if (ov.width !== w || ov.height !== h) { ov.width = w; ov.height = h; }
  const c = ov.getContext('2d');
  c.clearRect(0, 0, w, h);
  phDrawFrame(c, w, h, Photo.frame, Photo.caption, phCaptionText());
  const ui = document.getElementById('ph-ui');
  if (ui) {
    ui.querySelectorAll('[data-phf]').forEach(b => b.classList.toggle('on', b.dataset.phf === Photo.frame));
    ui.querySelectorAll('[data-phx]').forEach(b => b.classList.toggle('on', b.dataset.phx === Photo.filter));
    const cp = ui.querySelector('[data-phc=cap]'); if (cp) cp.classList.toggle('on', Photo.caption);
    const pz = ui.querySelector('[data-phc=pause]'); if (pz) pz.classList.toggle('on', Photo.pause);
  }
}

function phTick() {
  // интерфейс спрятан: выделения и подсветки не нужны, они бы попали в кадр
  Game.selected = null; Game.selUnit = null; Game.tool = null; R.hover = null; R.hoverPx = null;
}

function phApplyPause() {
  const coop = typeof Coop !== 'undefined' && Coop.on;
  if (coop || typeof setSpeed !== 'function') return;
  if (Photo.pause) setSpeed(0); else setSpeed(Photo.wasPaused ? 0 : Photo.wasSpeed || 1);
}

function phOpen() {
  if (Photo.on || (typeof StartMenu !== 'undefined' && StartMenu.open)) return;
  phLoad();
  Photo.on = true; Photo.wasPaused = !!Game.paused; Photo.wasSpeed = Game.speed || 1;
  if (typeof Mobile !== 'undefined' && Mobile.on && typeof mobileSheet === 'function') mobileSheet(null);
  let root = document.getElementById('ph-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'ph-root';
    root.innerHTML = `<div id="ph-fx"></div><canvas id="ph-ov"></canvas><div id="ph-flash"></div><div id="ph-msg"></div><div id="ph-ui"></div>`;
    (document.getElementById('view') || document.body).appendChild(root);
    root.addEventListener('click', phClick);
  }
  document.body.classList.add('photo');
  root.classList.remove('hidden');
  document.getElementById('ph-ui').innerHTML = phUiHTML();
  phApplyPause();
  requestAnimationFrame(() => { if (typeof resize === 'function') resize(); phSyncPreview(); });
  Photo.tid = setInterval(phTick, 120);
  phMsg(typeof Mobile !== 'undefined' && Mobile.on ? 'Фото-режим: тяните карту, щипок — масштаб' : 'Фото-режим: тяните карту, колесо — масштаб. Выход — Esc');
}

function phClose() {
  if (!Photo.on) return;
  Photo.on = false;
  clearInterval(Photo.tid);
  document.body.classList.remove('photo');
  const root = document.getElementById('ph-root');
  if (root) root.classList.add('hidden');
  if (typeof Coop === 'undefined' || !Coop.on) { if (typeof setSpeed === 'function') setSpeed(Photo.wasPaused ? 0 : Photo.wasSpeed || 1); }
  requestAnimationFrame(() => { if (typeof resize === 'function') resize(); });
  if (typeof updateUI === 'function') updateUI(true);
}

function phClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;
  if (d.phf) Photo.frame = d.phf;
  else if (d.phx) Photo.filter = d.phx;
  else if (d.phc === 'cap') Photo.caption = !Photo.caption;
  else if (d.phc === 'pause') { Photo.pause = !Photo.pause; phApplyPause(); }
  else if (d.phc === 'fold') { const u = document.getElementById('ph-ui'); u.classList.toggle('fold'); b.textContent = u.classList.contains('fold') ? '▴' : '▾'; return; }
  else if (d.phc === 'snap') { phShoot(); return; }
  else if (d.phc === 'exit') { phClose(); return; }
  phSave();
  phSyncPreview();
}

// Перетаскивание карты левой кнопкой (интерфейс скрыт, выбирать на карте нечего)
function phMouse(e) {
  if (!Photo.on) return;
  if (e.type === 'mousedown') {
    if (e.button !== 0 || e.target !== R.canvas) return;
    e.stopImmediatePropagation(); e.preventDefault();
    Photo.drag = { x: e.clientX, y: e.clientY, cx: R.cam.x, cy: R.cam.y };
  } else if (e.type === 'mousemove' && Photo.drag) {
    const s = camScale();
    R.cam.x = Photo.drag.cx - (e.clientX - Photo.drag.x) / s;
    R.cam.y = Photo.drag.cy - (e.clientY - Photo.drag.y) / s;
    clampCam();
  } else if (e.type === 'mouseup') Photo.drag = null;
}

window.Photo = Object.assign(Photo, { open: phOpen, close: phClose, render: phRender });

window.addEventListener('load', () => {
  phLoad();
  window.addEventListener('mousedown', phMouse, true);
  window.addEventListener('mousemove', phMouse, true);
  window.addEventListener('mouseup', phMouse, true);
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-photo]')) { if (typeof Mobile !== 'undefined' && Mobile.on && typeof mobileSheet === 'function') mobileSheet(null); phOpen(); } });
  window.addEventListener('resize', () => { if (Photo.on) setTimeout(phSyncPreview, 50); });
  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'KeyK') { if (Photo.on) phClose(); else phOpen(); }
    else if (Photo.on && e.code === 'Escape') { phClose(); e.stopImmediatePropagation(); }
    else if (Photo.on && e.code === 'Space') { e.preventDefault(); e.stopImmediatePropagation(); phShoot(); }
  }, true);
});
