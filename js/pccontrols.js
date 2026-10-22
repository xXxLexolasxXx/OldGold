'use strict';
// Управление для компьютера (Steam/сайт): окно «Управление» (F1) с переназначением клавиш, подсказки по наведению,
// прокрутка у края экрана, масштаб интерфейса 80–150%, полный экран, базовый геймпад.
// На телефоне ничего не делает (там своё управление в mobile.js). Настройки хранятся в localStorage.
//
// Переназначение устроено «прослойкой»: пока клавиша привязана по умолчанию, события идут как раньше. Если игрок
// назначил действию другую клавишу, мы на лету подменяем событие на прежний код (старые обработчики в main.js,
// guilds.js, photo.js и т. д. продолжают слушать «свои» коды и ничего о подмене не знают).
// Способности героя 1–6 — отдельно: ABIL_KEYS / ABIL_KEYN из herokit.js.

const PC_LS = 'og_pc_controls';
const PC = {
  binds: {},                           // id → сочетание ('KeyW', 'Ctrl+KeyS', 'Shift+Tab')
  opt: { ui: 1, tips: true, edge: false, pad: true },
  byCombo: {}, swallow: {}, down: {},
  cap: null,                           // id действия, которому сейчас ждём клавишу
  win: null,
};

// ---------- Действия ----------
// legacy — код, который уже слушает игра; run — новое действие; abil — слот способности героя (индекс в ABIL_KEYS);
// hold — зажимаемая (камера: Shift не мешает); mods — разрешены Ctrl/Alt/Shift в привязке
const PC_GROUPS = [['time', 'Время'], ['cam', 'Камера'], ['build', 'Строительство'], ['bld', 'Здания'], ['hero', 'Герой'], ['panel', 'Панели'], ['misc', 'Прочее']];
const PC_ACTS = [
  { id: 'pause', g: 'time', name: 'Пауза', def: 'Space', legacy: 'Space' },
  { id: 'spd1', g: 'time', name: 'Скорость ×1', def: 'Shift+Digit1', legacy: 'Shift+Digit1', mods: 1 },
  { id: 'spd2', g: 'time', name: 'Скорость ×2', def: 'Shift+Digit2', legacy: 'Shift+Digit2', mods: 1 },
  { id: 'spd3', g: 'time', name: 'Скорость ×3', def: 'Shift+Digit3', legacy: 'Shift+Digit3', mods: 1 },
  { id: 'camU', g: 'cam', name: 'Камера вверх', def: 'KeyW', legacy: 'KeyW', hold: 1 },
  { id: 'camD', g: 'cam', name: 'Камера вниз', def: 'KeyS', legacy: 'KeyS', hold: 1 },
  { id: 'camL', g: 'cam', name: 'Камера влево', def: 'KeyA', legacy: 'KeyA', hold: 1 },
  { id: 'camR', g: 'cam', name: 'Камера вправо', def: 'KeyD', legacy: 'KeyD', hold: 1 },
  { id: 'camU2', g: 'cam', name: 'Камера вверх (запасная)', def: 'ArrowUp', legacy: 'ArrowUp', hold: 1 },
  { id: 'camD2', g: 'cam', name: 'Камера вниз (запасная)', def: 'ArrowDown', legacy: 'ArrowDown', hold: 1 },
  { id: 'camL2', g: 'cam', name: 'Камера влево (запасная)', def: 'ArrowLeft', legacy: 'ArrowLeft', hold: 1 },
  { id: 'camR2', g: 'cam', name: 'Камера вправо (запасная)', def: 'ArrowRight', legacy: 'ArrowRight', hold: 1 },
  { id: 'zoomIn', g: 'cam', name: 'Приблизить', def: 'Equal', legacy: 'Equal' },
  { id: 'zoomOut', g: 'cam', name: 'Отдалить', def: 'Minus', legacy: 'Minus' },
  { id: 'road', g: 'build', name: 'Дорога', def: 'KeyR', legacy: 'KeyR' },
  { id: 'rotate', g: 'build', name: 'Повернуть здание', def: 'KeyT', legacy: 'KeyT' },
  { id: 'erase', g: 'build', name: 'Снос', def: 'Delete', legacy: 'Delete' },
  { id: 'prevB', g: 'bld', name: 'Предыдущее здание', def: 'BracketLeft', legacy: 'BracketLeft' },
  { id: 'nextB', g: 'bld', name: 'Следующее здание', def: 'BracketRight', legacy: 'BracketRight' },
  { id: 'bPause', g: 'bld', name: 'Пауза здания', def: 'KeyP', legacy: 'KeyP' },
  { id: 'bDeliver', g: 'bld', name: 'Закрыть/открыть доставки', def: 'KeyB', legacy: 'KeyB' },
  { id: 'hero', g: 'hero', name: 'Выбрать героя / справка', def: 'KeyH', legacy: 'KeyH' },
  { id: 'roll', g: 'hero', name: 'Перекат героя', def: 'KeyV', legacy: 'KeyV' },
  { id: 'strike', g: 'hero', name: 'Атака героя', def: 'KeyQ', legacy: 'KeyQ' },
  { id: 'trap', g: 'hero', name: 'Поставить капкан', def: 'KeyN', legacy: 'KeyN' },
  { id: 'stakes', g: 'hero', name: 'Поставить колья', def: 'KeyM', legacy: 'KeyM' },
  { id: 'lamp', g: 'hero', name: 'Поставить фонарь', def: 'KeyJ', legacy: 'KeyJ' },
  { id: 'ab1', g: 'hero', name: 'Способность 1', def: 'Digit1', abil: 0 },
  { id: 'ab2', g: 'hero', name: 'Способность 2', def: 'Digit2', abil: 1 },
  { id: 'ab3', g: 'hero', name: 'Способность 3', def: 'Digit3', abil: 2 },
  { id: 'ab4', g: 'hero', name: 'Способность 4', def: 'Digit4', abil: 3 },
  { id: 'ab5', g: 'hero', name: 'Способность 5', def: 'Digit5', abil: 4 },
  { id: 'ab6', g: 'hero', name: 'Ульта', def: 'Digit6', abil: 5 },
  { id: 'tabN', g: 'panel', name: 'Следующая вкладка панели', def: 'Tab', mods: 1, run: () => pcTab(1) },
  { id: 'tabP', g: 'panel', name: 'Предыдущая вкладка', def: 'Shift+Tab', mods: 1, run: () => pcTab(-1) },
  { id: 'pStore', g: 'panel', name: 'Запасы', def: 'KeyU', run: () => pcOpenTab('store') },
  { id: 'pOver', g: 'panel', name: 'Хозяйство', def: 'KeyO', run: () => pcOpenTab('overview') },
  { id: 'pLog', g: 'panel', name: 'Журнал событий', def: 'KeyY', run: () => pcOpenTab('log') },
  { id: 'chron', g: 'misc', name: 'Летопись', def: 'KeyL', legacy: 'KeyL' },
  { id: 'photo', g: 'misc', name: 'Фото-режим', def: 'KeyK', legacy: 'KeyK' },
  { id: 'save', g: 'misc', name: 'Сохранить', def: 'Ctrl+KeyS', legacy: 'Ctrl+KeyS', mods: 1 },
  { id: 'load', g: 'misc', name: 'Загрузить', def: 'F9', legacy: 'F9' },
  { id: 'help', g: 'misc', name: 'Окно «Управление»', def: 'F1', run: () => pcToggle() },
  { id: 'full', g: 'misc', name: 'Полный экран', def: 'F10', run: () => pcFullscreen() },
];
const PC_ACT = {};
for (const a of PC_ACTS) PC_ACT[a.id] = a;
// Клавиши, которые игра занимает сама и не переназначает (показываем в окне и не даём занять)
const PC_FIXED = [
  ['Escape', 'Отмена, закрыть окно, снять выбор'], ['Digit1', '1–5: разделы строительства (когда не заняты способностями)'],
  ['F3', 'Показатели производительности'], ['F5', 'Перезагрузка'], ['F11', 'Полный экран (Steam-версия)'], ['F12', 'Консоль разработчика'],
];
const PC_RESERVED = new Set(['Escape', 'F3', 'F5', 'F11', 'F12', 'Enter', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'ContextMenu']);

// ---------- Сочетания ----------
function pcCombo(e) {
  const c = e.code;
  if (!c || /^(Shift|Control|Alt|Meta)(Left|Right)$/.test(c)) return '';
  return (e.ctrlKey ? 'Ctrl+' : '') + (e.altKey ? 'Alt+' : '') + (e.shiftKey ? 'Shift+' : '') + c;
}
function pcSplit(combo) {
  const p = combo.split('+'), code = p.pop();
  return { code, ctrl: p.includes('Ctrl'), alt: p.includes('Alt'), shift: p.includes('Shift') };
}
const PC_KEYNAME = { Space: 'Пробел', Delete: 'Del', Backspace: '⌫', Escape: 'Esc', Equal: '=', Minus: '−', BracketLeft: '[', BracketRight: ']', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backquote: '`', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', Enter: 'Enter', Tab: 'Tab', Home: 'Home', End: 'End', PageUp: 'PgUp', PageDown: 'PgDn', Insert: 'Ins' };
function pcCodeName(code) {
  if (PC_KEYNAME[code]) return PC_KEYNAME[code];
  let m = code.match(/^Key([A-Z])$/); if (m) return m[1];
  m = code.match(/^Digit(\d)$/); if (m) return m[1];
  m = code.match(/^Numpad(.+)$/); if (m) return 'Num ' + ({ Add: '+', Subtract: '−', Multiply: '×', Divide: '/', Decimal: '.', Enter: 'Enter' }[m[1]] || m[1]);
  return code;
}
function pcName(combo) {
  if (!combo) return '—';
  const s = pcSplit(combo);
  return (s.ctrl ? 'Ctrl+' : '') + (s.alt ? 'Alt+' : '') + (s.shift ? 'Shift+' : '') + pcCodeName(s.code);
}
function pcKeyChar(code) {
  let m = code.match(/^Key([A-Z])$/); if (m) return m[1].toLowerCase();
  m = code.match(/^Digit(\d)$/); if (m) return m[1];
  return { Space: ' ', Escape: 'Escape', Delete: 'Delete', Tab: 'Tab', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', Equal: '=', Minus: '-', BracketLeft: '[', BracketRight: ']' }[code] || code;
}

// ---------- Привязки ----------
function pcLoad() {
  try {
    const d = JSON.parse(localStorage.getItem(PC_LS) || '{}');
    if (d.opt) Object.assign(PC.opt, d.opt);
    PC.binds = {};
    for (const a of PC_ACTS) { const c = d.binds && d.binds[a.id]; PC.binds[a.id] = typeof c === 'string' && /^[A-Za-z0-9+]+$/.test(c) ? c : a.def; }
  } catch (e) { PC.binds = {}; for (const a of PC_ACTS) PC.binds[a.id] = a.def; }
  PC.opt.ui = Math.max(0.8, Math.min(1.5, +PC.opt.ui || 1));
}
function pcSave() {
  const b = {};
  for (const a of PC_ACTS) if (PC.binds[a.id] !== a.def) b[a.id] = PC.binds[a.id];
  try { localStorage.setItem(PC_LS, JSON.stringify({ binds: b, opt: PC.opt })); } catch (e) { /* приватный режим */ }
}
// пересобрать таблицы быстрого поиска и подставить клавиши способностей героя
function pcRebuild() {
  PC.byCombo = {}; PC.swallow = {};
  for (const a of PC_ACTS) {
    const c = PC.binds[a.id];
    if (!c || a.abil !== undefined) continue;
    PC.byCombo[c] = a.id;
  }
  for (const a of PC_ACTS) {
    if (!a.legacy) continue;
    if (PC.binds[a.id] !== a.legacy && !PC.byCombo[a.legacy]) PC.swallow[a.legacy] = a.id;
  }
  if (typeof ABIL_KEYS !== 'undefined' && typeof ABIL_KEYN !== 'undefined') {
    for (const a of PC_ACTS) if (a.abil !== undefined) {
      const s = pcSplit(PC.binds[a.id] || a.def);
      ABIL_KEYS[a.abil] = s.code; ABIL_KEYN[a.abil] = pcCodeName(s.code);
    }
  }
}
// занято ли сочетание: id другого действия или текст про клавишу игры
function pcOwner(combo, except) {
  for (const a of PC_ACTS) if (a.id !== except && PC.binds[a.id] === combo) return a;
  const code = pcSplit(combo).code;
  if (PC_RESERVED.has(code)) return { name: 'занято игрой', fixed: true };
  return null;
}
// назначить; при конфликте действия меняются клавишами. Возвращает текст для игрока или '' при успехе
function pcAssign(id, combo) {
  const A = PC_ACT[id], s = pcSplit(combo);
  if (!A) return 'Нет такого действия';
  if (PC_RESERVED.has(s.code)) return 'Эта клавиша занята игрой';
  if (!A.mods && (s.ctrl || s.alt || s.shift)) return 'Для этого действия Ctrl/Alt/Shift не нужны — нажмите клавишу без них';
  const other = pcOwner(combo, id);
  if (other) {
    if (other.fixed) return 'Эта клавиша занята игрой';
    const os = pcSplit(PC.binds[id] || A.def);
    if (!other.mods && (os.ctrl || os.alt || os.shift)) return t('«{0}» нельзя назначить с Ctrl/Alt/Shift', t(other.name));
    PC.binds[other.id] = PC.binds[id];
  }
  PC.binds[id] = combo;
  pcRebuild(); pcSave();
  return other ? t('«{0}» получило прежнюю клавишу этого действия', t(other.name)) : '';
}
function pcResetAll() { for (const a of PC_ACTS) PC.binds[a.id] = a.def; pcRebuild(); pcSave(); }

// ---------- Подмена событий ----------
function pcSynth(type, legacy, from) {
  const s = pcSplit(legacy);
  const ev = new KeyboardEvent(type, { code: s.code, key: pcKeyChar(s.code), ctrlKey: s.ctrl, altKey: s.alt, shiftKey: s.shift, bubbles: true, cancelable: true, repeat: !!(from && from.repeat) });
  Object.defineProperty(ev, '__pc', { value: true });
  (from && from.target && from.target.dispatchEvent ? from.target : document.body).dispatchEvent(ev);
}
const pcTyping = e => { const t0 = e.target; return !!(t0 && (/^(INPUT|TEXTAREA|SELECT)$/.test(t0.tagName) || t0.isContentEditable)); };
function pcBusy() {
  return (typeof Run !== 'undefined' && Run.on) || (typeof Photo !== 'undefined' && Photo.on) || (typeof MEUI !== 'undefined' && MEUI.E)
    || (typeof StartMenu !== 'undefined' && StartMenu.open) || (typeof Mobile !== 'undefined' && Mobile.on);
}
function pcKeyDown(e) {
  if (e.__pc) return;
  if (PC.cap) { pcCapture(e); return; }
  if (pcTyping(e)) return;
  const combo = pcCombo(e);
  if (!combo) return;
  if (PC.win && e.code === 'Escape') { pcClose(); e.preventDefault(); e.stopImmediatePropagation(); PC.down[e.code] = null; return; }
  if (pcBusy() && combo !== PC.binds.help) return;
  let id = PC.byCombo[combo], hit = combo;
  if (!id && e.shiftKey) {                       // Shift ускоряет камеру: «Shift+W» — это тоже «W»
    const c2 = combo.replace('Shift+', '');
    if (PC.byCombo[c2] && PC_ACT[PC.byCombo[c2]].hold) { id = PC.byCombo[c2]; hit = c2; }
  }
  if (id) {
    const A = PC_ACT[id];
    if (A.run) {
      e.preventDefault(); e.stopImmediatePropagation(); PC.down[e.code] = null;
      if (!e.repeat) A.run();
      return;
    }
    if (A.abil !== undefined) return;            // способности героя слушает herokit.js по ABIL_KEYS
    if (A.legacy !== hit) {                      // клавиша переназначена — выдаём игре прежний код
      e.preventDefault(); e.stopImmediatePropagation();
      PC.down[e.code] = A.legacy;
      pcSynth('keydown', A.hold && e.shiftKey ? 'Shift+' + A.legacy : A.legacy, e);
    }
    return;
  }
  if (PC.swallow[combo] || (e.shiftKey && PC.swallow[combo.replace('Shift+', '')] && PC_ACT[PC.swallow[combo.replace('Shift+', '')]].hold)) {
    e.preventDefault(); e.stopImmediatePropagation(); PC.down[e.code] = null;      // старая клавиша отдана другому действию
  }
}
function pcKeyUp(e) {
  if (e.__pc || !(e.code in PC.down)) return;
  const lg = PC.down[e.code];
  delete PC.down[e.code];
  e.stopImmediatePropagation();
  if (lg) pcSynth('keyup', lg.replace(/^(Ctrl\+|Alt\+|Shift\+)+/, ''), e);
}

// ---------- Окно «Управление» ----------
const pcEsc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function pcCapture(e) {
  e.preventDefault(); e.stopImmediatePropagation();
  if (e.repeat) return;
  const id = PC.cap;
  if (e.code === 'Escape') { PC.cap = null; pcRender(); return; }
  const combo = pcCombo(e);
  if (!combo) return;                            // одна лишь Shift/Ctrl — ждём основную клавишу
  PC.cap = null;
  const msg = pcAssign(id, combo);
  if (msg) PC.msg = msg; else PC.msg = '';
  pcRender();
}
function pcOpen() {
  if (PC.win) return;
  if (typeof Mobile !== 'undefined' && Mobile.on) return;
  pcStyle();
  const w = document.createElement('div');
  w.id = 'pc-win';
  w.addEventListener('click', pcClick);
  w.addEventListener('input', pcInput);
  w.addEventListener('change', pcInput);
  document.body.appendChild(w);
  PC.win = w; PC.msg = '';
  pcRender();
}
function pcClose() { if (PC.win) { PC.win.remove(); PC.win = null; PC.cap = null; } }
function pcToggle() { if (PC.win) pcClose(); else pcOpen(); }

function pcRender() {
  const w = PC.win;
  if (!w) return;
  const sc = w.querySelector('.pcw-body') ? w.querySelector('.pcw-body').scrollTop : 0;
  let rows = '';
  for (const [g, gn] of PC_GROUPS) {
    const list = PC_ACTS.filter(a => a.g === g);
    rows += `<h4>${pcEsc(t(gn))}</h4>`;
    for (const a of list) {
      const cur = PC.binds[a.id], waiting = PC.cap === a.id, changed = cur !== a.def;
      rows += `<div class="pcw-row${changed ? ' ch' : ''}"><span>${pcEsc(t(a.name))}</span>`
        + `<button class="pcw-key${waiting ? ' wait' : ''}" data-pc-key="${a.id}">${waiting ? pcEsc(t('нажмите клавишу…')) : pcEsc(pcName(cur))}</button>`
        + `<button class="pcw-rs" data-pc-reset="${a.id}" title="${pcEsc(t('Вернуть: {0}', pcName(a.def)))}" ${changed ? '' : 'disabled'}>↺</button></div>`;
    }
  }
  const pct = Math.round(PC.opt.ui * 100), nat = typeof window !== 'undefined' && window.OldGoldNative;
  w.innerHTML = `<div class="pcw-box"><div class="pcw-head"><b>${pcEsc(t('Управление'))}</b><button class="pcw-x" data-pc-close title="Esc">✕</button></div>`
    + `<div class="pcw-body">`
    + (PC.msg ? `<div class="pcw-msg">${pcEsc(PC.msg)}</div>` : '')
    + `<div class="pcw-cols"><div>`
    + `<h3>${pcEsc(t('Интерфейс'))}</h3>`
    + `<label class="pcw-opt">${pcEsc(t('Масштаб интерфейса'))}: <b>${pct}%</b><input type="range" min="80" max="150" step="5" value="${pct}" data-pc-ui></label>`
    + `<label class="pcw-chk"><input type="checkbox" data-pc-opt="tips" ${PC.opt.tips ? 'checked' : ''}> ${pcEsc(t('Подсказки при наведении на здания и жителей'))}</label>`
    + `<label class="pcw-chk"><input type="checkbox" data-pc-opt="edge" ${PC.opt.edge ? 'checked' : ''}> ${pcEsc(t('Прокрутка карты у края окна'))}</label>`
    + `<label class="pcw-chk"><input type="checkbox" data-pc-opt="pad" ${PC.opt.pad ? 'checked' : ''}> ${pcEsc(t('Геймпад'))}</label>`
    + `<div class="pcw-btns"><button data-pc-full>${pcEsc(t(nat ? 'Полный экран / окно' : 'Полный экран'))}</button><button data-pc-all>${pcEsc(t('Сбросить всё'))}</button></div>`
    + `<h3>${pcEsc(t('Мышь'))}</h3><ul class="pcw-ul">`
    + [`Левая кнопка: выбрать, поставить здание, вести дорогу`, `Правая кнопка (без движения): отмена; с движением — перетаскивание карты`, `Средняя кнопка: перетаскивание карты`, `Колесо: масштаб к курсору`, `Shift + клик: строить несколько`, `Наведение: подсказка о здании или жителе`].map(s => `<li>${pcEsc(t(s))}</li>`).join('')
    + `</ul><h3>${pcEsc(t('Геймпад'))}</h3><ul class="pcw-ul">`
    + [`Левый стик: карта; правый стик: курсор`, `A: клик; B: отмена`, `X: пауза; Y: к герою`, `LB / RB: вкладки панели; LT / RT: масштаб`, `Крестовина: способности 1–4; нажатие стиков: 5 и ульта`, `Start: это окно`].map(s => `<li>${pcEsc(t(s))}</li>`).join('')
    + `</ul><h3>${pcEsc(t('Занято игрой'))}</h3><ul class="pcw-ul"><li>${PC_FIXED.map(f => `<kbd>${pcEsc(pcName(f[0]))}</kbd> ${pcEsc(t(f[1]))}`).join('</li><li>')}</li></ul>`
    + `</div><div><h3>${pcEsc(t('Клавиатура'))}</h3><div class="pcw-hint">${pcEsc(t('Нажмите на клавишу в списке, затем на новую. Если она занята, действия поменяются местами.'))}</div>${rows}</div></div>`
    + `</div></div>`;
  const b = w.querySelector('.pcw-body'); if (b) b.scrollTop = sc;
}
function pcClick(e) {
  const el = e.target.closest('[data-pc-key],[data-pc-reset],[data-pc-close],[data-pc-all],[data-pc-full]');
  if (e.target.classList && e.target.classList.contains('pcw-box') === false && e.target === PC.win) { pcClose(); return; }
  if (!el) return;
  if (el.hasAttribute('data-pc-close')) { pcClose(); return; }
  if (el.dataset.pcKey) { PC.cap = PC.cap === el.dataset.pcKey ? null : el.dataset.pcKey; PC.msg = ''; pcRender(); return; }
  if (el.dataset.pcReset) { const a = PC_ACT[el.dataset.pcReset]; PC.msg = pcAssign(a.id, a.def); pcRender(); return; }
  if (el.hasAttribute('data-pc-all')) { pcResetAll(); PC.msg = t('Клавиши возвращены'); pcRender(); return; }
  if (el.hasAttribute('data-pc-full')) { pcFullscreen(); }
}
function pcInput(e) {
  const el = e.target;
  if (el.hasAttribute('data-pc-ui')) {
    PC.opt.ui = +el.value / 100; pcApplyUI();
    if (e.type === 'change') { pcSave(); pcRender(); } else { const b = el.parentNode.querySelector('b'); if (b) b.textContent = el.value + '%'; }
  } else if (el.dataset.pcOpt) {
    PC.opt[el.dataset.pcOpt] = !!el.checked; pcSave(); pcTipHide();
  }
}

// ---------- Масштаб интерфейса ----------
// Steam-версия: масштаб страницы целиком (webFrame). Сайт: увеличиваем боковую панель и верхнюю строку.
function pcApplyUI() {
  const f = PC.opt.ui, N = typeof window !== 'undefined' && window.OldGoldNative;
  if (N && N.setZoom) { try { N.setZoom(f); } catch (e) { /* без моста */ } return; }
  document.documentElement.style.setProperty('--pc-ui', String(f));
  document.documentElement.style.setProperty('--pc-ui-top', String(Math.min(f, 1.25)));   // верхняя строка при сильном увеличении не помещается — предел 125%
  document.body.classList.toggle('pc-scaled', Math.abs(f - 1) > 0.01);
}

// ---------- Полный экран ----------
function pcFullscreen() {
  const N = typeof window !== 'undefined' && window.OldGoldNative;
  if (N && N.fullscreen) { try { N.fullscreen(); } catch (e) { /* без моста */ } return; }
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  } catch (e) { /* браузер не разрешил */ }
}

// ---------- Панели ----------
function pcOpenTab(name) { if (typeof openTab === 'function' && document.getElementById('tab-' + name)) openTab(name); }
function pcTab(dir) {
  const bs = [...document.querySelectorAll('#tabs .tab-btn')].filter(b => b.offsetParent);
  if (!bs.length) return;
  let k = bs.findIndex(b => b.classList.contains('active'));
  k = (k + dir + bs.length) % bs.length;
  if (typeof openTab === 'function') openTab(bs[k].dataset.tab);
}

// ---------- Подсказки при наведении ----------
const PCTip = { el: null, timer: 0, x: 0, y: 0, shown: false };
function pcTipHide() { clearTimeout(PCTip.timer); if (PCTip.el) PCTip.el.style.display = 'none'; PCTip.shown = false; }
function pcTipText() {
  if (typeof R === 'undefined' || !R.hover || typeof Game === 'undefined' || typeof camScale !== 'function') return '';
  const [tx, ty] = R.hover, s = camScale();
  const wx = R.cam.x + PCTip.px / s, wy = R.cam.y + PCTip.py / s;     // мировые пиксели под курсором
  let best = null, bd = 0.85;
  for (const u of Game.units || []) {
    if (u.inside || u.dead) continue;
    const d = Math.hypot(u.x * TILE - wx, (u.y * TILE - 6) - wy) / TILE;
    if (d < bd) { bd = d; best = u; }
  }
  if (best) {
    const T = UNIT_TYPES[best.type] || {}, h = best.type === 'hero' && best.hero;
    if (h) return `<b>${pcEsc(h.name || t('Герой'))}</b><br><span>${pcEsc(t('Герой, уровень {0}', h.level || 1))}</span>`;
    let lv = ''; try { if (typeof unitLevel === 'function' && (best.type === 'serf' || best.type === 'builder')) lv = t(', уровень {0}', unitLevel(best)); } catch (e) { /* без уровня */ }
    return `<b>${pcEsc(T.name || best.type)}</b>${lv ? `<br><span>${pcEsc(lv.replace(/^, /, ''))}</span>` : ''}`;
  }
  const b = typeof buildingAt === 'function' ? buildingAt([tx, ty]) : null;
  if (b && b.def) {
    const st = b.state && b.state !== 'done' ? t('строится') : b.paused ? t('на паузе') : '';
    const lv = b.level > 1 ? t('уровень {0}', b.level) : '';
    return `<b>${pcEsc(b.def.name)}</b>${st || lv ? `<br><span>${pcEsc([lv, st].filter(Boolean).join(' · '))}</span>` : ''}`;
  }
  return '';
}
function pcTipShow() {
  if (!PC.opt.tips || PC.win || Input.pan || Input.leftDown || (typeof Game !== 'undefined' && Game.tool)) return;
  let html = '';
  try { html = pcTipText(); } catch (e) { html = ''; }
  if (!html) return;
  if (!PCTip.el) { PCTip.el = document.createElement('div'); PCTip.el.id = 'pc-tip'; document.body.appendChild(PCTip.el); }
  PCTip.el.innerHTML = html;
  PCTip.el.style.display = 'block';
  const r = PCTip.el.getBoundingClientRect();
  PCTip.el.style.left = Math.min(PCTip.x + 14, window.innerWidth - r.width - 6) + 'px';
  PCTip.el.style.top = Math.min(PCTip.y + 18, window.innerHeight - r.height - 6) + 'px';
  PCTip.shown = true;
}
function pcMouseMove(e) {
  PC.mx = e.clientX; PC.my = e.clientY;
  if (e.isTrusted) pcPadHide();
  if (typeof Mobile !== 'undefined' && Mobile.on) return;
  const cv = typeof R !== 'undefined' && R.canvas;
  if (!cv || e.target !== cv) { if (PCTip.shown || PCTip.timer) pcTipHide(); return; }
  const rect = cv.getBoundingClientRect();
  PCTip.x = e.clientX; PCTip.y = e.clientY; PCTip.px = e.clientX - rect.left; PCTip.py = e.clientY - rect.top;
  if (PCTip.shown) pcTipHide();
  clearTimeout(PCTip.timer);
  if (PC.opt.tips) PCTip.timer = setTimeout(pcTipShow, 450);
}

// ---------- Прокрутка у края окна ----------
function pcEdgeTick(dt) {
  if (!PC.opt.edge || PC.mx === undefined || typeof R === 'undefined' || !R.canvas || PC.win || (typeof Mobile !== 'undefined' && Mobile.on)) return;
  if (!document.hasFocus() || typeof Input !== 'undefined' && (Input.pan || Input.leftDown)) return;
  const W = window.innerWidth, H = window.innerHeight, E = 8, sp = 700 * dt / camScale() * 0.8;
  let dx = 0, dy = 0;
  if (PC.mx <= E) dx = -1; else if (PC.mx >= W - E - 1) dx = 1;
  if (PC.my <= E) dy = -1; else if (PC.my >= H - E - 1) dy = 1;
  if (dx || dy) { R.cam.x += dx * sp; R.cam.y += dy * sp; clampCam(); }
}

// ---------- Геймпад ----------
const PCPad = { cx: 0, cy: 0, on: false, prev: [], last: 0, el: null, hold: 0, zT: 0 };
function pcPads() { try { return (navigator.getGamepads ? [...navigator.getGamepads()] : []).filter(Boolean); } catch (e) { return []; } }
function pcPadCursor() {
  if (!PCPad.el) {
    PCPad.el = document.createElement('div'); PCPad.el.id = 'pc-pad-cur';
    document.body.appendChild(PCPad.el);
  }
  return PCPad.el;
}
function pcPadHide() { PCPad.on = false; if (PCPad.el) PCPad.el.style.display = 'none'; }
function pcPadShow() {
  const el = pcPadCursor();
  if (!PCPad.on) {
    PCPad.on = true;
    if (!PCPad.cx && !PCPad.cy) { PCPad.cx = window.innerWidth * 0.6; PCPad.cy = window.innerHeight * 0.5; }
  }
  el.style.display = 'block';
  el.style.left = PCPad.cx + 'px'; el.style.top = PCPad.cy + 'px';
}
function pcMouseAt(type, x, y, btn) {
  const el = type === 'mouseup' ? window : (document.elementFromPoint(x, y) || document.body);
  const ev = new MouseEvent(type, { clientX: x, clientY: y, button: btn || 0, buttons: type === 'mouseup' || type === 'mousemove' ? 0 : 1, bubbles: true, cancelable: true, view: window });
  el.dispatchEvent(ev);
}
function pcPadPress(i) {
  const x = PCPad.cx, y = PCPad.cy;
  const hero = typeof Game !== 'undefined' && Game.hero;
  const abil = n => { if (hero && typeof heroUseAbility === 'function') { const k = typeof abIdxByKey === 'function' ? abIdxByKey(hero.hero, n) : n; if (k >= 0) heroUseAbility(k); } };
  if (i === 0) {                                   // A: клик там, где курсор
    const el = document.elementFromPoint(x, y);
    if (el && R.canvas && el === R.canvas) { pcMouseAt('mousemove', x, y); pcMouseAt('mousedown', x, y, 0); PCPad.holdCv = true; }
    else if (el && el.click) { el.click(); if (el.focus && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) el.focus(); }
  } else if (i === 1) {                            // B: отмена
    if (PC.win) pcClose();
    else if (typeof Game !== 'undefined' && Game.tool && typeof setTool === 'function') setTool(null);
    else if (typeof Game !== 'undefined' && Game.selected && typeof selectBuilding === 'function') selectBuilding(null);
    else if (typeof Game !== 'undefined' && Game.selUnit) { Game.selUnit = null; if (typeof updateUI === 'function') updateUI(true); }
  } else if (i === 2) { if (typeof togglePause === 'function') togglePause(); }
  else if (i === 3) { if (typeof selectHero === 'function' && hero) selectHero(true); }
  else if (i === 4) pcTab(-1);
  else if (i === 5) pcTab(1);
  else if (i === 8) { if (hero) centerOn(hero.x * TILE, hero.y * TILE); }
  else if (i === 9) pcToggle();
  else if (i === 12) abil(0);
  else if (i === 13) abil(2);
  else if (i === 14) abil(3);
  else if (i === 15) abil(1);
  else if (i === 10) abil(4);
  else if (i === 11) abil(5);
}
function pcPadTick(dt) {
  if (!PC.opt.pad || typeof R === 'undefined' || !R.canvas) return;
  const ps = pcPads();
  if (!ps.length) { if (PCPad.on) pcPadHide(); return; }
  const p = ps[0], dz = v => (Math.abs(v) < 0.22 ? 0 : (v - Math.sign(v) * 0.22) / 0.78);
  const B = i => !!(p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.5));
  const lx = dz(p.axes[0] || 0), ly = dz(p.axes[1] || 0), rx = dz(p.axes[2] || 0), ry = dz(p.axes[3] || 0);
  let active = !!(lx || ly || rx || ry);
  for (let i = 0; i < p.buttons.length; i++) {
    const now = B(i);
    if (now && !PCPad.prev[i] && i !== 6 && i !== 7) { active = true; if (pcPadOwnsInput()) pcPadPress(i); }
    if (!now && PCPad.prev[i] && i === 0 && PCPad.holdCv) { PCPad.holdCv = false; pcMouseAt('mouseup', PCPad.cx, PCPad.cy, 0); }
    PCPad.prev[i] = now;
  }
  if (!active && !B(6) && !B(7)) { if (PCPad.on && performance.now() - PCPad.last > 6000) pcPadHide(); return; }
  PCPad.last = performance.now();
  if (!pcPadOwnsInput()) return;
  pcPadShow();
  if (lx || ly) {                                   // левый стик — карта
    const sp = 760 * dt / camScale();
    R.cam.x += lx * sp; R.cam.y += ly * sp; clampCam();
  }
  if (rx || ry) {                                   // правый стик — курсор
    const sp = 900 * dt;
    PCPad.cx = Math.max(0, Math.min(window.innerWidth - 1, PCPad.cx + rx * sp));
    PCPad.cy = Math.max(0, Math.min(window.innerHeight - 1, PCPad.cy + ry * sp));
    pcPadShow();
    pcMouseAt('mousemove', PCPad.cx, PCPad.cy);
  }
  PCPad.zT -= dt;                                   // триггеры — масштаб
  if ((B(6) || B(7)) && PCPad.zT <= 0) { PCPad.zT = 0.28; zoomStep(B(7) ? 1 : -1, window.innerWidth / 2 - R.canvas.getBoundingClientRect().left, window.innerHeight / 2); }
}
function pcPadOwnsInput() { return !(typeof StartMenu !== 'undefined' && StartMenu.open) && !(typeof Mobile !== 'undefined' && Mobile.on); }

// ---------- Стили ----------
function pcStyle() {
  if (document.getElementById('pc-style')) return;
  const st = document.createElement('style');
  st.id = 'pc-style';
  st.textContent = `#pc-win{position:fixed;inset:0;z-index:3000;background:rgba(10,6,2,.66);display:flex;align-items:center;justify-content:center;font-size:14px}
#pc-win .pcw-box{width:min(980px,94vw);max-height:90vh;display:flex;flex-direction:column;background:#241a0e;border:2px solid #8a6a28;border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,.7);color:#e8d9b4}
#pc-win .pcw-head{display:flex;align-items:center;justify-content:space-between;padding:8px 14px;border-bottom:1px solid #5a4620;font-size:18px;color:#f6d458}
#pc-win .pcw-x{background:none;border:0;color:#e8d9b4;font-size:18px;cursor:pointer;padding:2px 8px}
#pc-win .pcw-body{padding:10px 14px 14px;overflow-y:auto}
#pc-win .pcw-cols{display:grid;grid-template-columns:minmax(260px,1fr) minmax(300px,1.2fr);gap:20px}
@media (max-width:760px){#pc-win .pcw-cols{grid-template-columns:1fr}}
#pc-win h3{margin:10px 0 6px;font-size:15px;color:#f6d458}#pc-win h3:first-child{margin-top:0}
#pc-win h4{margin:12px 0 4px;font-size:13px;color:#c8a85a;border-bottom:1px solid #4a3a1c}
#pc-win .pcw-hint{font-size:12px;opacity:.75;margin-bottom:4px}
#pc-win .pcw-row{display:flex;align-items:center;gap:6px;padding:2px 0}#pc-win .pcw-row>span{flex:1;min-width:0}
#pc-win .pcw-row.ch>span{color:#ffe9a8}
#pc-win .pcw-key{min-width:92px;padding:3px 8px;background:#3a2c14;color:#ffe9a8;border:1px solid #8a6a28;border-radius:4px;cursor:pointer;font:inherit;font-weight:bold}
#pc-win .pcw-key:hover{background:#4e3a1a}#pc-win .pcw-key.wait{background:#6a4a10;border-color:#f6d458;animation:pcw-b .8s infinite alternate}
@keyframes pcw-b{to{box-shadow:0 0 8px #f6d458}}
#pc-win .pcw-rs{padding:2px 7px;background:none;border:1px solid #5a4620;border-radius:4px;color:#e8d9b4;cursor:pointer}#pc-win .pcw-rs:disabled{opacity:.25;cursor:default}
#pc-win .pcw-msg{padding:5px 8px;margin-bottom:8px;background:#3a2c14;border:1px solid #8a6a28;border-radius:4px;color:#ffe9a8}
#pc-win .pcw-opt{display:block;margin:6px 0}#pc-win .pcw-opt input{display:block;width:100%}
#pc-win .pcw-chk{display:block;margin:4px 0;cursor:pointer}
#pc-win .pcw-btns{display:flex;gap:8px;margin:8px 0}#pc-win .pcw-btns button{flex:1;padding:5px 8px;background:#3a2c14;color:#e8d9b4;border:1px solid #8a6a28;border-radius:4px;cursor:pointer;font:inherit}
#pc-win .pcw-ul{margin:0;padding-left:18px;font-size:13px}#pc-win kbd{background:#3a2c14;border:1px solid #6a5028;border-radius:3px;padding:0 4px}
#pc-tip{position:fixed;display:none;z-index:2500;pointer-events:none;max-width:240px;padding:4px 8px;background:rgba(24,16,8,.94);border:1px solid #8a6a28;border-radius:4px;color:#f0e2bc;font-size:12px;line-height:1.35}
#pc-tip b{color:#f6d458}#pc-tip span{opacity:.85}
#pc-pad-cur{position:fixed;display:none;z-index:3500;width:18px;height:18px;margin:-9px 0 0 -9px;border:2px solid #f6d458;border-radius:50%;box-shadow:0 0 0 2px rgba(0,0,0,.7),0 0 8px rgba(246,212,88,.8);pointer-events:none}
#pc-pad-cur::after{content:"";position:absolute;left:6px;top:6px;width:6px;height:6px;border-radius:50%;background:#f6d458}
body.mobile #pc-win,body.mobile [data-pc]{display:none!important}
body.pc-scaled #panel{zoom:var(--pc-ui)}body.pc-scaled #topbar{zoom:var(--pc-ui-top)}body.pc-scaled #hero-card{zoom:var(--pc-ui-top)}`;
  document.head.appendChild(st);
}

// ---------- Запуск ----------
if (typeof window !== 'undefined' && window.addEventListener && typeof document !== 'undefined') {
  pcLoad(); pcRebuild();
  window.addEventListener('keydown', pcKeyDown, true);
  window.addEventListener('keyup', pcKeyUp, true);
  window.addEventListener('blur', () => { PC.down = {}; });
  window.addEventListener('mousemove', pcMouseMove);
  document.addEventListener('pointerdown', pcTipHide, true);
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-pc="open"]')) pcOpen(); });
  {
    const _start = startGame;
    startGame = function () {
      _start();
      pcStyle(); pcLoad(); pcRebuild(); pcApplyUI();
      let last = performance.now();
      const loop = now => {
        requestAnimationFrame(loop);
        const dt = Math.min(0.1, (now - last) / 1000); last = now;
        try { pcPadTick(dt); pcEdgeTick(dt); } catch (e) { /* не ломаем цикл игры */ }
      };
      requestAnimationFrame(loop);
    };
  }
}
