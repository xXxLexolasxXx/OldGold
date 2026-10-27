'use strict';
// Менеджер окон: «одно окно за раз» поверх уже существующих частей интерфейса (их код не переписываем).
// Места на экране и правила:
//   • Панель (ПК — левая колонка, телефон — шторка): Стройка | Здание | Деревня | Меню. На телефоне нижняя полоса —
//     четыре кнопки; шесть вкладок хозяйства (Запасы, Хозяйство, Журнал, Торговля, Приоритеты, Совет) собраны в «Деревню»
//     и переключаются строкой значков в шапке шторки. Стройка и Здание — вкладки одной шторки (шапка-переключатель).
//     ПК: в колонке тоже ОДНО окно — либо вкладка (стройка, журнал…), либо окно здания; сверху переключатель
//     «Стройка | Здание: …». Выбрали здание на карте — колонка показывает его, сняли выбор или нажали вкладку — вкладку.
//   • Окно поверх (полноэкранные окна, окна общей очереди notify.js): видно одно, самое новое; прежние ждут скрытыми
//     и возвращаются, когда новое закроют. Открылось окно — шторка телефона сворачивается и потом возвращается сама.
//     Окна обучения и лора ставятся в очередь Notify.modal(id, show, prio) из notify.js и помечаются data-nq-modal.
//   • Закреплённое: окно прав хоста (#cp-admin) не прячут другие окна; кнопка «♛ Права» — в верхней полосе (кооп, хост),
//     и пунктом в меню.
//   • «Назад» на Android и Esc закрывают верхнее: окно → шторку → выбор.
// Чистые функции (wmVillageTabs, wmStackHide) проверяет tests/winmgr-test.js без браузера.

const WM = { t: 0, stash: null, seen: new Map(), seq: 0, vtab: null, pc: 'tab', selId: null };
const WM_VILLAGE = [
  { k: 'store', name: 'Запасы' }, { k: 'overview', name: 'Хозяйство' }, { k: 'log', name: 'Журнал' },
  { k: 'trade', name: 'Торговля' }, { k: 'prio', name: 'Приоритеты' }, { k: 'council', name: 'Совет' },
];
const WM_VKEYS = new Set(WM_VILLAGE.map(v => v.k));
// окна-режимы во весь экран (меню, арена, забег, фото, редактор) — не «окна», их не прячем и не считаем
const WM_MODES = new Set(['app', 'loading', 'ver-badge', 'start-menu', 'ar-ui', 'run-ui', 'tavern-ui', 'ph-root', 'me-ed', 'tut-dim', 'tut-arrow', 'pc-pad-cur', 'ach-toasts', 'vt-sheet', 'wm-chip']);
const WM_PINNED = new Set(['cp-admin']);
const WM_DIALOG_IDS = ['whatsnew', 'goal-modal', 'dil-modal', 'daily-modal', 'lore-card', 'lore-book', 'prof-win', 'pc-win', 'hh-win', 'hh-ask',
  'gl-modal', 'chron', 'land-modal', 'save-file-win', 'tele-ask', 'cp-admin', 'cp-stats', 'cp-class', 'cp-lost', 'camp-dlg', 'guide', 'nq-journal', 'help', 'ask-yes', 'hero-name'];

// ---------- чистые функции ----------
// какие вкладки «Деревни» уже открыты игроку (reveal.js прячет вкладки до своих вех): r — { rvOn, all, open: Set }
function wmVillageTabs(r) {
  return WM_VILLAGE.filter(v => !r.rvOn || r.all || r.open.has(v.k)).map(v => v.k);
}
// стопка окон: list — [{ id, seq, pinned }] видимых окон; вернуть id тех, что надо спрятать (все, кроме самого нового и закреплённых)
function wmStackHide(list) {
  if (list.length < 2) return [];
  const top = list.reduce((a, b) => (b.seq > a.seq ? b : a));
  return list.filter(x => x !== top && !x.pinned).map(x => x.id);
}

if (typeof module !== 'undefined') module.exports = { wmVillageTabs, wmStackHide, WM_VILLAGE };

// ---------- DOM ----------
const wmHas = () => typeof document !== 'undefined' && document.body && document.getElementById;
const wmB = () => document.body.classList;
const wmSheet = () => { const b = wmB(); return b.contains('sheet-tab') ? 'tab' : b.contains('sheet-info') ? 'info' : null; };
const wmT = s => (typeof t === 'function' ? t(s) : s);

function wmRevealed() {
  const b = wmB(), open = new Set();
  for (const v of WM_VILLAGE) if (b.contains('rv-' + v.k)) open.add(v.k);
  return wmVillageTabs({ rvOn: b.contains('rv-on'), all: b.contains('rv-all'), open });
}

// селектор видимой кнопки вкладки (для подсветок обучения): на телефоне вкладки хозяйства живут в «Деревне»
function wmTabSel(name) {
  if (typeof Mobile !== 'undefined' && Mobile.on && WM_VKEYS.has(name)) {
    return UI.tab === name && wmSheet() === 'tab' ? `#wm-vtabs [data-wmv="${name}"]` : '#tabs [data-tab="village"]';
  }
  return `#tabs .tab-btn[data-tab="${name}"]`;
}

function wmIcon(el, kind, name) { try { el.src = iconURL(kind, name, 2); } catch (e) { /* без значка */ } }

function wmInitTabs() {
  const tabs = document.getElementById('tabs');
  if (!tabs || tabs.querySelector('[data-tab="village"]')) return;
  const mk = (tab, title, after) => {
    const b = document.createElement('button');
    b.className = 'tab-btn wm-m'; b.dataset.tab = tab; b.title = title;
    b.innerHTML = '<img alt=""><span class="wm-cap"></span><span class="badge hidden"></span>';
    b.querySelector('.wm-cap').textContent = wmT(title.split(':')[0]);
    after.after(b);
    return b;
  };
  const info = mk('info', 'Здание: окно выбранного здания', tabs.querySelector('[data-tab="build"]'));
  const vil = mk('village', 'Деревня: запасы, хозяйство, журнал, торговля, приоритеты, совет', tabs.querySelector('[data-tab="council"]'));
  try { info.querySelector('img').src = buildingIconURL('house'); } catch (e) { wmIcon(info.querySelector('img'), 'ui', 'store'); }
  wmIcon(vil.querySelector('img'), 'ui', 'overview');
  // подписи у четырёх кнопок телефона
  for (const [k, cap] of [['build', 'Стройка'], ['menu', 'Меню']]) {
    const b = tabs.querySelector(`[data-tab="${k}"]`);
    if (b && !b.querySelector('.wm-cap')) { const s = document.createElement('span'); s.className = 'wm-cap'; s.textContent = wmT(cap); b.appendChild(s); }
  }
  info.addEventListener('click', e => { e.stopImmediatePropagation(); wmOpenInfo(); }, true);
  vil.addEventListener('click', e => { e.stopImmediatePropagation(); wmOpenVillage(); }, true);
}

function wmOpenInfo() {
  const b = Game.selected && !Game.selected.removed ? Game.selected : null;
  if (!b) { toast(wmT('Коснитесь здания на карте — здесь откроется его окно')); return; }
  if (wmSheet() === 'info') { mobileSheet(null); return; }
  mobileSheet('info');
}

function wmOpenVillage(k) {
  const list = wmRevealed();
  if (!list.length) return;
  const hl = WM_VILLAGE.find(v => { const o = document.querySelector(`#tabs .tab-btn[data-tab="${v.k}"]`); return o && o.classList.contains('tut-hl'); });
  if (!k && wmSheet() === 'tab' && WM_VKEYS.has(UI.tab) && !hl) { mobileSheet(null); return; }
  k = k || (hl && hl.k) || (list.includes(WM.vtab) ? WM.vtab : list.includes('overview') ? 'overview' : list[0]);
  WM.vtab = k;
  openTab(k);
  mobileSheet('tab');
}

// шапка шторки: переключатель Стройка/Здание, строка вкладок деревни или заголовок
function wmInitHead() {
  const panel = document.getElementById('panel'), close = document.getElementById('sheet-close');
  if (!panel || document.getElementById('wm-head')) return;
  const h = document.createElement('div');
  h.id = 'wm-head';
  h.innerHTML = `<div id="wm-seg"><button data-wms="build"><img alt=""><span></span></button><button data-wms="info"><img alt=""><span></span></button></div>`
    + `<div id="wm-vtabs"></div><div id="wm-title"></div>`;
  const area = document.getElementById('tab-area');
  panel.insertBefore(h, area || (close ? close.nextSibling : panel.firstChild));   // ПК: под вкладками, над окном
  // крестик — прежний #sheet-close (на него ссылается обучение): в портрете он стоит в правом углу шапки
  if (close) { close.setAttribute('aria-label', wmT('Свернуть')); close.title = wmT('Свернуть'); close.textContent = '✕'; }
  wmIcon(h.querySelector('[data-wms="build"] img'), 'ui', 'build');
  h.querySelector('[data-wms="build"] span').textContent = wmT('Стройка');
  const vt = h.querySelector('#wm-vtabs');
  for (const v of WM_VILLAGE) {
    const b = document.createElement('button');
    b.dataset.wmv = v.k; b.title = wmT(v.name);
    const orig = document.querySelector(`#tabs .tab-btn[data-tab="${v.k}"] img`);
    b.innerHTML = `<img alt="" src="${orig ? orig.src : ''}"><span></span>`;
    b.querySelector('span').textContent = wmT(v.name);
    vt.appendChild(b);
  }
  h.addEventListener('click', e => {
    const s = e.target.closest('[data-wms]');
    if (s) {
      const mob = typeof Mobile !== 'undefined' && Mobile.on;
      if (!mob) {   // ПК: переключаем, что показывает колонка
        if (s.dataset.wms === 'build') WM.pc = 'tab';
        else if (Game.selected && !Game.selected.removed) WM.pc = 'info';
        else toast(wmT('Кликните здание на карте — здесь откроется его окно'));
        wmSync();
        return;
      }
      if (s.dataset.wms === 'build') { if (UI.tab !== 'build') openTab('build'); mobileSheet('tab'); }
      else wmOpenInfo();
      return;
    }
    const v = e.target.closest('[data-wmv]');
    if (v) { WM.vtab = v.dataset.wmv; openTab(v.dataset.wmv); mobileSheet('tab'); }
  });
}

// ---------- окна поверх ----------
function wmShown(el) {
  if (!el || !el.isConnected) return false;
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || +cs.opacity === 0) return false;
  if (cs.visibility === 'hidden' && !el.classList.contains('wm-wait')) return false;
  return el.classList.contains('wm-wait') || el.getClientRects().length > 0;
}

function wmDialogs() {
  const W = window.innerWidth, H = window.innerHeight, out = new Set();
  for (const el of document.body.children) {
    if (WM_MODES.has(el.id) || /^(SCRIPT|STYLE|LINK)$/.test(el.tagName)) continue;
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' || cs.pointerEvents === 'none') continue;
    if (!wmShown(el)) continue;
    const r = el.getBoundingClientRect();
    if (el.classList.contains('wm-wait') || (r.width >= W * 0.8 && r.height >= H * 0.8)) out.add(el);
  }
  for (const el of document.querySelectorAll('[data-nq-modal]')) if (!WM_MODES.has(el.id) && wmShown(el)) out.add(el);
  for (const id of WM_DIALOG_IDS) { const el = document.getElementById(id); if (el && wmShown(el) && !el.classList.contains('hidden')) out.add(el); }
  // окно внутри другого окна — одно окно
  return [...out].filter(el => ![...out].some(o => o !== el && o.contains(el)));
}

function wmStack() {
  const list = wmDialogs();
  for (const el of list) if (!WM.seen.has(el)) WM.seen.set(el, ++WM.seq);
  for (const el of [...WM.seen.keys()]) if (!list.includes(el)) { WM.seen.delete(el); el.classList.remove('wm-wait'); }
  const items = list.map(el => ({ id: el, seq: WM.seen.get(el), pinned: WM_PINNED.has(el.id) }));
  const hide = new Set(wmStackHide(items));
  for (const el of list) el.classList.toggle('wm-wait', hide.has(el));
  return list.length > 0;
}

// плашки на карте (обучение, подсказка коопа, «Новое: …»): тоже по одной — новая прячет прежние, пока её не закроют.
// Обучение в свёрнутом виде (.min) — маленькая полоска, её не трогаем.
const WM_FLOAT = '#tut:not(.hidden):not(.min), #cp-hint, .rv-note:not(.out), #fair-panel';
const WM_FSEEN = new Map();
let wmFSeq = 0;
function wmFloatStack(modal) {
  const list = [...document.querySelectorAll(WM_FLOAT)].filter(wmShown);
  for (const el of list) if (!WM_FSEEN.has(el)) WM_FSEEN.set(el, ++wmFSeq);
  for (const el of [...WM_FSEEN.keys()]) if (!list.includes(el)) { WM_FSEEN.delete(el); el.classList.remove('wm-wait'); }
  // открыта шторка (портрет) или окно поверх — плашки ждут все, кроме обучения (оно подсказывает, что нажать в шторке)
  const park = modal || (typeof Mobile !== 'undefined' && Mobile.on && !wmB().contains('land') && !!wmSheet());
  // панель, которую открыл сам игрок (ярмарка), главнее плашек, что пришли сами: она не прячется под ними
  const hide = new Set(wmStackHide(list.map(el => ({ id: el, seq: el.id === 'fair-panel' ? Infinity : WM_FSEEN.get(el) }))));
  for (const el of list) el.classList.toggle('wm-wait', hide.has(el) || (park && el.id !== 'tut'));
  // обучение при открытой шторке телефона — сворачиваем в полоску (как при касании карты, mobile.js), не поверх шторки
  const tut = list.find(el => el.id === 'tut');
  if (tut && park && !modal) tut.classList.add('min');
}

// закрыть верхнее окно: его крестик / «Закрыть» / Esc
const WM_CLOSE_RE = /^\s*(✕|×|x|Закрыть|Понятно|Назад|Отмена|Позже|Не сейчас|Close|Back|Cancel|OK|Ок)\s*$/i;
function wmCloseTop() {
  const list = wmDialogs().filter(el => !el.classList.contains('wm-wait'));
  if (!list.length) return false;
  const top = list.reduce((a, b) => ((WM.seen.get(b) || 0) > (WM.seen.get(a) || 0) ? b : a));
  const btn = top.querySelector('[data-close], .wm-x, .x, .cp-x, .hc-x, [data-act="close"]')
    || [...top.querySelectorAll('button')].find(b => b.offsetWidth && WM_CLOSE_RE.test(b.textContent));
  if (btn) btn.click();
  else window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
  return true;
}

// «Назад» (Android) и общий выход: окно → шторка → инструмент → выбор
function wmBack() {
  if (wmCloseTop()) return true;
  if (typeof Game !== 'undefined' && Game.tool) { setTool(null); return true; }
  if (typeof Mobile !== 'undefined' && Mobile.on && wmSheet()) { mobileSheet(null); return true; }
  if (typeof Game !== 'undefined' && (Game.selUnit || Game.selected)) { Game.selUnit = null; Game.selected = null; updateUI(true); return true; }
  return false;
}

// открылось окно — шторка сворачивается (плашка внизу), закрылось — возвращается
function wmSheetPark(modal) {
  if (typeof Mobile === 'undefined' || !Mobile.on) { WM.stash = null; return; }
  const chip = document.getElementById('wm-chip');
  if (modal && wmSheet() && !WM.stash) {
    WM.stash = { kind: wmSheet(), tab: UI.tab };
    mobileSheet(null);
  } else if (!modal && WM.stash) {
    const s = WM.stash; WM.stash = null;
    if (!wmSheet() && !Game.tool && !(s.kind === 'info' && !(Game.selected && !Game.selected.removed))) { if (s.kind === 'tab' && UI.tab !== s.tab) openTab(s.tab); mobileSheet(s.kind); }
  }
  if (chip) {
    const on = !!WM.stash;
    chip.classList.toggle('on', on);
    if (on) chip.textContent = wmT(WM.stash.kind === 'info' ? '⌂ Окно здания свёрнуто — вернётся после окна' : UI.tab === 'build' || WM.stash.tab === 'build' ? '⚒ Стройка свёрнута — вернётся после окна' : '☰ Шторка свёрнута — вернётся после окна');
  }
}

// ---------- окно задания (цели деревни, goal.js) ----------
// Новое задание (сменилась веха, глава или список целей) — свёрнутое окно само раскрывается и подсвечивается на
// WM_GOAL_MS, потом сворачивается обратно. Пока в руке здание/дорога или открыта шторка — сворачивается сразу
// (задание и стройка не вместе). Касание по раскрытому окну — оставить открытым.
const WM_GOAL_MS = 12000;
function wmGoalSig(v) { return v ? [v.rank, v.ch, v.custom ? 1 : 0, (v.objs || []).map(o => o.t).join('|')].join('#') : ''; }
function wmGoalTick(busy) {
  if (typeof GoalUI === 'undefined' || !GoalUI.hud || typeof goalHudRender !== 'function') return;
  const sig = wmGoalSig(Game.goalView), now = performance.now(), hud = GoalUI.hud;
  if (!hud.dataset.wm) {
    hud.dataset.wm = '1';
    hud.addEventListener('click', e => { if (WM.gAuto && !e.target.closest('[data-gh="fold"]')) { WM.gAuto = 0; hud.classList.remove('wm-gh-new'); } }, true);
  }
  const fold = on => { if (GoalUI.fold !== on) { GoalUI.fold = on; GoalUI.hudHtml = null; goalHudRender(); } };
  if (WM.gSig == null || !sig) { WM.gSig = sig; return; }
  if (sig !== WM.gSig) {
    WM.gSig = sig;
    if (GoalUI.fold && !busy) { WM.gAuto = now; fold(false); }
    hud.classList.remove('wm-gh-new'); void hud.offsetWidth; hud.classList.add('wm-gh-new');
    clearTimeout(WM.gT); WM.gT = setTimeout(() => hud.classList.remove('wm-gh-new'), 2600);
  }
  if (WM.gAuto && (busy || now - WM.gAuto > WM_GOAL_MS)) { WM.gAuto = 0; fold(true); }
}

// ---------- кнопка «♛ Права» (кооп, хост) ----------
function wmAdminBtn() {
  const host = typeof Coop !== 'undefined' && Coop.on && Coop.host && typeof coopAdminOpen === 'function';
  let b = document.getElementById('wm-admin');
  const mi = document.querySelector('#tab-menu [data-wm="admin"]');
  if (!host) { if (b) b.remove(); if (mi) mi.remove(); return; }
  // и пунктом в меню — на виду, не в «Ещё»
  if (!mi) {
    const list = document.querySelector('#tab-menu .menu-list');
    if (list) {
      const m = document.createElement('button');
      m.dataset.wm = 'admin'; m.className = 'wm-admin-mi';
      m.innerHTML = `<span class="wm-crown">♛</span>${wmT('Права игроков (хост)')}`;
      m.addEventListener('click', e => { e.stopPropagation(); coopAdminOpen(); });
      list.prepend(m);
    }
  }
  if (b) return;
  const bar = document.getElementById('topbar');
  if (!bar) return;
  b = document.createElement('button');
  b.id = 'wm-admin'; b.title = wmT('Права игроков: что можно гостям (только хост)');
  b.innerHTML = `♛<span>${wmT('Права')}</span>`;
  b.addEventListener('click', e => { e.stopPropagation(); coopAdminOpen(); });
  bar.appendChild(b);
}

// ---------- общий пересчёт ----------
function wmSync() {
  if (!wmHas()) return;
  const b = wmB(), mob = typeof Mobile !== 'undefined' && Mobile.on;
  const modal = wmStack();
  wmSheetPark(modal);
  const s2 = wmSheet();
  wmFloatStack(modal);
  b.toggle('wm-sheet', !!s2);
  b.toggle('wm-tool', !!Game.tool);
  wmGoalTick(!!Game.tool || (mob && !!s2) || modal);
  // ПК: одно окно в колонке. Новый выбор здания — показываем его; выбор сняли — вкладку
  const pcOne = !mob && !b.contains('info-float');
  const selB = Game.selected && !Game.selected.removed ? Game.selected : null, selId = selB ? selB.id : null;
  if (selId !== WM.selId) { WM.selId = selId; WM.pc = selId != null ? 'info' : 'tab'; }
  if (!selB) WM.pc = 'tab';
  b.toggle('wm-pc-tab', pcOne && WM.pc === 'tab');
  b.toggle('wm-pc-info', pcOne && WM.pc === 'info');
  // шапка шторки (телефон) / колонки (ПК)
  const head = document.getElementById('wm-head');
  if (head) {
    const mode = pcOne ? 'seg' : !mob || !s2 ? '' : s2 === 'info' || UI.tab === 'build' ? 'seg' : WM_VKEYS.has(UI.tab) ? 'vil' : 'title';
    head.dataset.mode = mode;
    const sel = selB;
    const sb = head.querySelector('[data-wms="build"]'), si = head.querySelector('[data-wms="info"]');
    sb.classList.toggle('active', pcOne ? WM.pc === 'tab' : s2 === 'tab');
    si.classList.toggle('active', pcOne ? WM.pc === 'info' : s2 === 'info');
    // ПК: левая кнопка — открытая вкладка (Стройка, Журнал…), её значок
    const tb = document.querySelector(`#tabs .tab-btn[data-tab="${UI.tab}"]`);
    const tn = pcOne && tb ? wmT((tb.title || '').split(':')[0].replace(/\s*\(.*$/, '')) || wmT('Стройка') : wmT('Стройка');
    const ts = sb.querySelector('span'); if (ts.textContent !== (UI.tab === 'build' ? wmT('Стройка') : tn)) ts.textContent = UI.tab === 'build' ? wmT('Стройка') : tn;
    const ti = sb.querySelector('img'), tsrc = pcOne && tb && UI.tab !== 'build' ? tb.querySelector('img').src : '';
    if ((ti.dataset.t || '') !== tsrc) { ti.dataset.t = tsrc; if (tsrc) ti.src = tsrc; else wmIcon(ti, 'ui', 'build'); }
    si.classList.toggle('off', !sel);
    const nm = sel ? (sel.def && sel.def.name) || wmT('Здание') : wmT('Здание');
    const sp = si.querySelector('span'); if (sp.textContent !== nm) sp.textContent = nm;
    const im = si.querySelector('img'), key = sel ? sel.type : 'house';
    if (im.dataset.k !== key) { im.dataset.k = key; try { im.src = buildingIconURL(key); } catch (e) { /* без значка */ } }
    if (mode === 'vil') {
      const open = new Set(wmRevealed());
      for (const v of head.querySelectorAll('[data-wmv]')) { v.hidden = !open.has(v.dataset.wmv); v.classList.toggle('active', v.dataset.wmv === UI.tab); }
    }
    if (mode === 'title') { const tt = head.querySelector('#wm-title'), want = UI.tab === 'menu' ? wmT('Меню') : ''; if (tt.textContent !== want) tt.textContent = want; }
  }
  // кнопки телефона: «Деревня» видна, если открыта хоть одна её вкладка; значки и подсветки — с исходных вкладок
  const vil = document.querySelector('#tabs [data-tab="village"]');
  if (vil) {
    const list = wmRevealed();
    vil.classList.toggle('wm-none', !list.length);
    vil.classList.toggle('active', mob && s2 === 'tab' && WM_VKEYS.has(UI.tab));
    let n = 0, dot = false, hl = false, fresh = false;
    for (const v of WM_VILLAGE) {
      const o = document.querySelector(`#tabs .tab-btn[data-tab="${v.k}"]`);
      if (!o) continue;
      hl = hl || o.classList.contains('tut-hl'); fresh = fresh || o.classList.contains('rv-new');
      const bd = o.querySelector('.badge');
      if (bd && !bd.classList.contains('hidden') && list.includes(v.k)) { const x = parseInt(bd.textContent, 10); if (x > 0) n += x; else dot = true; }
    }
    const bd = vil.querySelector('.badge'), txt = n ? (n > 99 ? '99+' : String(n)) : dot ? '●' : '';
    if (bd.textContent !== txt) bd.textContent = txt;
    bd.classList.toggle('hidden', !txt);
    vil.classList.toggle('wm-hl', hl); vil.classList.toggle('rv-new', fresh);
    // значки на вкладках шапки
    for (const v of document.querySelectorAll('#wm-vtabs [data-wmv]')) {
      const o = document.querySelector(`#tabs .tab-btn[data-tab="${v.dataset.wmv}"] .badge`);
      v.classList.toggle('dot', !!o && !o.classList.contains('hidden'));
      const ho = document.querySelector(`#tabs .tab-btn[data-tab="${v.dataset.wmv}"]`);
      v.classList.toggle('wm-hl', !!ho && ho.classList.contains('tut-hl'));
    }
  }
  const info = document.querySelector('#tabs [data-tab="info"]');
  if (info) {
    const sel = Game.selected && !Game.selected.removed;
    info.classList.toggle('active', mob && s2 === 'info');
    info.classList.toggle('dim', !sel);
  }
  if (mob && s2 === 'tab' && UI.tab === 'build') document.querySelector('#tabs [data-tab="build"]')?.classList.add('active');
  if (typeof rvCount === 'function') rvCount();   // сколько кнопок в нижней полосе — для раскладки без дыр
  wmAdminBtn();
}

// ---------- подписи значков на телефоне: долгое нажатие показывает title (как у нижних вкладок, ui.js tabTipsInit) ----------
const WM_TIP_SEL = '#topbar button, #hero-btn, #nq-pill, #fair-chip, #wm-vtabs button, #wm-seg button';
function wmTipsInit() {
  let tip = null, timer = 0, hideT = 0, held = false;
  const hide = () => { clearTimeout(timer); clearTimeout(hideT); if (tip) tip.classList.remove('on'); };
  const show = el => {
    tip = tip || document.getElementById('tab-tip');
    if (!tip) { tip = document.createElement('div'); tip.id = 'tab-tip'; document.body.appendChild(tip); }
    const s = el.title || el.getAttribute('aria-label') || '', i = s.indexOf(':');
    if (!s) return;
    tip.textContent = '';
    const b = document.createElement('b'); b.textContent = i > 0 ? s.slice(0, i) : s; tip.appendChild(b);
    if (i > 0) { const m = document.createElement('span'); m.textContent = s.slice(i + 1).trim(); tip.appendChild(m); }
    tip.classList.add('on');
    const r = el.getBoundingClientRect(), t = tip.getBoundingClientRect(), W = window.innerWidth;
    tip.style.left = Math.min(Math.max(6, r.left + r.width / 2 - t.width / 2), W - t.width - 6) + 'px';
    tip.style.top = (r.bottom + 8 + t.height < window.innerHeight ? r.bottom + 8 : r.top - t.height - 8) + 'px';
  };
  document.addEventListener('pointerdown', e => {
    const el = e.pointerType !== 'mouse' && e.target.closest && e.target.closest(WM_TIP_SEL);
    held = false;
    if (!el) return;
    hide();
    timer = setTimeout(() => { held = true; show(el); }, 420);
  }, true);
  const up = () => { clearTimeout(timer); if (held) hideT = setTimeout(hide, 1600); };
  document.addEventListener('pointerup', up, true);
  document.addEventListener('pointercancel', up, true);
  // отпустили после подписи — кнопку не нажимаем
  document.addEventListener('click', e => { if (held && e.target.closest && e.target.closest(WM_TIP_SEL)) { held = false; e.stopPropagation(); e.preventDefault(); } }, true);
}

function initWinMgr() {
  if (!wmHas() || WM.init) return;
  WM.init = true;
  wmInitTabs();
  wmInitHead();
  wmTipsInit();
  if (!document.getElementById('wm-chip')) { const c = document.createElement('div'); c.id = 'wm-chip'; document.body.appendChild(c); }
  // пересчёт сразу после смены вкладки или шторки и 4 раза в секунду (окна, которые прячутся стилем)
  const _ms = mobileSheet;
  mobileSheet = function (kind) { _ms(kind); if (kind) WM.stash = null; try { wmSync(); } catch (e) { /* интерфейс ещё не готов */ } };
  const _ot = openTab;
  openTab = function (name) { _ot(name); WM.pc = 'tab'; try { wmSync(); } catch (e) { /* интерфейс ещё не готов */ } };
  window.addEventListener('keydown', e => {
    if (e.code !== 'Escape' || e.defaultPrevented) return;
    if (typeof Mobile !== 'undefined' && Mobile.on && wmSheet() && !wmDialogs().length) mobileSheet(null);
  });
  // смена режима на <body> (вход в общую деревню, шторка, окно) — сразу, не дожидаясь кадра (в фоне кадров нет)
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    Promise.resolve().then(() => { queued = false; try { wmSync(); } catch (e) { /* интерфейс ещё не готов */ } });
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  const loop = t => {
    if (t - WM.t > 250) { WM.t = t; try { wmSync(); } catch (e) { /* интерфейс ещё не готов */ } }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.getElementById && !(typeof coop !== 'undefined' && coop.players)) {
  window.wmBack = wmBack;
  window.wmTabSel = wmTabSel;
  const _sg = startGame;
  startGame = function () { _sg(); try { initWinMgr(); wmSync(); } catch (e) { console.error(e); } };
}

// переводы новых подписей (остальные — в js/i18n/en*.js)
if (typeof I18N !== 'undefined' && I18N.add) I18N.add('en', {
  'Здание': 'Building', 'Кликните здание на карте — здесь откроется его окно': 'Click a building on the map: its window opens here', 'Здание: окно выбранного здания': 'Building: the selected building\'s window',
  'Деревня: запасы, хозяйство, журнал, торговля, приоритеты, совет': 'Village: stores, estate, log, trade, priorities, council',
  'Запасы': 'Stores', 'Хозяйство': 'Estate', 'Журнал': 'Log', 'Торговля': 'Trade', 'Приоритеты': 'Priorities', 'Совет': 'Council', 'Свернуть': 'Collapse',
  'Коснитесь здания на карте — здесь откроется его окно': 'Tap a building on the map: its window opens here',
  '⚒ Стройка свёрнута — вернётся после окна': '⚒ Build panel folded: back after this window',
  '⌂ Окно здания свёрнуто — вернётся после окна': '⌂ Building window folded: back after this window',
  '☰ Шторка свёрнута — вернётся после окна': '☰ Panel folded: back after this window',
  'Права игроков: что можно гостям (только хост)': 'Player permissions: what guests may do (host only)', 'Права игроков (хост)': 'Player permissions (host)',
  'Поле хмеля': 'Hop field', 'бесплатно': 'free', '1 доска за клетку': '1 plank per tile', 'Стены': 'Walls', 'Ловушки': 'Traps', 'Свет и башни': 'Light and towers',
  'Фонарь': 'Lantern', 'Ещё действия': 'More actions',
  'Поставить капкан под ноги: первый враг в нём оглушён и открыт для удара': 'Set a trap at your feet: the first foe in it is stunned and open to blows',
  'Вбить колья: рвут и замедляют всех, кто на них налез': 'Drive in stakes: they tear and slow anyone who climbs onto them',
  'Боевой фонарь: светит вокруг, нечисть в его свете слабее': 'Battle lantern: lights the area, the unclean are weaker in its light',
});
