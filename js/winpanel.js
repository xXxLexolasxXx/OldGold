'use strict';
// Что показывает панель (ПК — левая колонка, телефон — шторка) — по слову владельца 27.10: «разгрузить экран».
//   • Стройка → список построек. Нажали постройку → список уходит, на его месте карточка: что это, цена, что даёт,
//     «Поставить» (взять в руку) и «← К списку». Во время обучения — как раньше, сразу в руку (шаги ждут именно этого).
//   • Задания: цели деревни (goal.js), задания дня (daily.js), задания и совет общей деревни (coopclient.js) больше не
//     висят на карте — их окна переезжают в панель, во вкладку «Задания». На телефоне на карте только строка-значок
//     «Цели 2/4 ▸», касание открывает вкладку. Поставили здание или стройку закрыли — панель показывает задания.
//   • Герой в походе: отошёл от деревни дальше WP_AWAY клеток — деревенская панель уходит, остаётся интерфейс героя:
//     способности по центру снизу, в колонке (на телефоне — плашкой сверху) здоровье, ресурс класса, сытость, раны,
//     рюкзак. Ближе WP_HOME клеток — деревня возвращается. Кнопка «⌂ Деревня» показывает её и в походе.
// Вызывается из js/winmgr.js: wpInit() при старте, wpSync() при каждом пересчёте. Чистая функция wpAwayNext — в тестах.

const WP = { card: null, placed: false, away: false, peek: false, hero: '', chip: '', sig: '' };
const WP_AWAY = 26, WP_HOME = 20;     // клеток до костра/склада: дальше — поход, ближе — снова деревня (с запасом, чтобы не мигало)

// чистая: включён ли режим похода. was — прежнее значение, d — расстояние до деревни в клетках (null — нет героя/деревни)
function wpAwayNext(was, d) {
  if (d == null) return false;
  return was ? d > WP_HOME : d > WP_AWAY;
}
if (typeof module !== 'undefined') module.exports = Object.assign(module.exports || {}, { wpAwayNext, WP_AWAY, WP_HOME });

const wpT = s => (typeof t === 'function' ? t(s) : s);
const wpMob = () => typeof Mobile !== 'undefined' && Mobile.on;

// ---------- карточка постройки ----------
function wpPick(type) {
  const fort = type.startsWith('fort:');
  const tool = fort ? { kind: 'fort', f: type.slice(5), type } : { kind: 'build', type, rot: BUILDINGS[type].noRotate || BUILDINGS[type].rots ? 0 : (UI.lastRot || 0) };
  // во время обучения шаги ждут, что постройка сразу в руке
  if (typeof Tut !== 'undefined' && Tut.on) { setTool(Game.tool && Game.tool.type === type ? null : tool); return; }
  WP.card = type;
  wpCardRender();
}
function wpPlace() {
  const type = WP.card;
  if (!type) return;
  if (type.startsWith('fort:')) setTool({ kind: 'fort', f: type.slice(5), type });
  else { const def = BUILDINGS[type]; setTool({ kind: 'build', type, rot: def.noRotate || def.rots ? 0 : (UI.lastRot || 0) }); }
}
function wpCardHTML(type) {
  if (type.startsWith('fort:')) {
    const f = type.slice(5), F = FORTS[f];
    return `<div class="ihead"><img class="bpic" src="${defIconURL(f)}" alt=""><div><h3>${F.name}</h3><span class="chip off">Оборона</span></div></div>`
      + '<div class="isec">Стоимость</div>' + costHTML(F.cost[0]) + `<div class="idesc">${(F.desc || []).join(' ')}</div>`;
  }
  return infoPreview(type);
}
function wpCardRender() {
  const tab = document.getElementById('tab-build');
  if (!tab) return;
  let card = document.getElementById('wp-card');
  if (!card) {
    card = document.createElement('div'); card.id = 'wp-card';
    tab.appendChild(card);
    card.addEventListener('click', e => {
      if (e.target.closest('[data-wp="back"]')) { WP.card = null; setTool(null); wpCardRender(); return; }
      if (e.target.closest('[data-wp="place"]')) wpPlace();
    });
  }
  tab.classList.toggle('wp-carded', !!WP.card);
  if (!WP.card) { card.innerHTML = ''; return; }
  const inHand = Game.tool && Game.tool.type === WP.card;
  card.innerHTML = `<div class="wp-cbar"><button data-wp="back">← ${wpT('К списку')}</button></div>`
    + `<div class="wp-cbody">${wpCardHTML(WP.card)}</div>`
    + `<button class="wp-place${inHand ? ' active' : ''}" data-wp="place">${inHand ? wpT('В руке — укажите место на карте') : wpT('Поставить')}</button>`;
}

// ---------- вкладка «Задания» ----------
function wpInitTask() {
  const tabs = document.getElementById('tabs'), area = document.getElementById('tab-area');
  if (!tabs || !area || document.getElementById('tab-task')) return;
  const sec = document.createElement('section');
  sec.id = 'tab-task'; sec.className = 'tab';
  sec.innerHTML = '<div id="wp-task"></div><div id="wp-task-empty" class="tip muted"></div>';
  area.insertBefore(sec, area.firstChild);
  const b = document.createElement('button');
  b.className = 'tab-btn'; b.dataset.tab = 'task'; b.title = wpT('Задания: цели деревни, задания дня');
  b.innerHTML = '<img alt=""><span class="wm-cap"></span><span class="badge hidden">!</span>';
  b.querySelector('.wm-cap').textContent = wpT('Задания');
  try { b.querySelector('img').src = iconURL('ui', 'scroll', 2); } catch (e) { /* без значка */ }
  tabs.querySelector('[data-tab="build"]').after(b);
  b.addEventListener('click', () => { b.classList.remove('wp-new'); if (wpMob()) mobileTab('task'); else openTab('task'); });
  // строка-значок целей на карте (телефон): касание открывает вкладку
  const chip = document.createElement('button');
  chip.id = 'wp-chip';
  chip.addEventListener('click', e => { e.stopPropagation(); chip.classList.remove('wp-new'); mobileTab('task'); });
  (document.getElementById('view') || document.body).appendChild(chip);
}
// окна заданий живут в панели: переносим их узлы (их код ищет их по id и рисует как раньше)
function wpAdopt() {
  const box = document.getElementById('wp-task');
  if (!box) return;
  for (const id of ['goal-hud', 'daily-hud', 'cp-vil', 'cp-qs']) {
    const el = document.getElementById(id);
    if (el && el.parentNode !== box) box.appendChild(el);
  }
  if (typeof GoalUI !== 'undefined' && GoalUI.fold) { GoalUI.fold = false; GoalUI.hudHtml = null; if (typeof goalHudRender === 'function') goalHudRender(); }
  const empty = document.getElementById('wp-task-empty');
  const any = [...box.children].some(el => el.getClientRects().length && !el.classList.contains('hidden'));
  empty.textContent = any ? '' : wpT('Заданий пока нет. Стройте — цели деревни появятся здесь.');
}
// новое задание: на ПК — панель сама показывает задания (если ничего не строим и здание не выбрано), на телефоне — мигает значок
function wpNewTask() {
  for (const el of [document.querySelector('#tabs [data-tab="task"]'), document.getElementById('wp-chip')]) if (el) { el.classList.remove('wp-new'); void el.offsetWidth; el.classList.add('wp-new'); }
  if (!wpMob() && !Game.tool && !(Game.selected && !Game.selected.removed) && (UI.tab === 'build' ? !WP.card : true) && UI.tab !== 'menu') openTab('task');
}
function wpChip() {
  const chip = document.getElementById('wp-chip');
  if (!chip) return;
  const v = Game.goalView;
  let txt = '';
  // сценарий — цели главы (objs), свободная игра — шаги до следующей вехи (next.objs)
  const objs = v && (v.objs && v.objs.length ? v.objs : v.next && v.next.objs);
  if (objs && objs.length) {
    const ok = objs.filter(o => o.cur >= o.need).length;
    const name = v.objs && v.objs.length ? (typeof GOAL_RANKS !== 'undefined' && GOAL_RANKS[v.rank] ? GOAL_RANKS[v.rank].name : wpT('Цели')) : `${wpT('До')} «${v.next.name}»`;
    txt = `📜 ${name}: ${ok}/${objs.length} ▸`;
  }
  if (txt !== WP.chip) { WP.chip = txt; chip.textContent = txt; }
  chip.classList.toggle('wp-none', !txt);
}

// ---------- герой в походе ----------
function wpHeroDist() {
  const h = Game.hero;
  if (!h || h.dead || h.inside) return null;
  const base = (Game.buildings || []).filter(b => !b.removed && (b.type === 'bonfire' || b.type === 'storehouse'));
  if (!base.length) return null;
  return Math.min(...base.map(b => Math.hypot(b.x + b.w / 2 - h.x, b.y + b.h / 2 - h.y)));
}
function wpBar(cls, label, cur, max, col) {
  const p = max > 0 ? Math.max(0, Math.min(100, Math.round(100 * cur / max))) : 0;
  return `<div class="wp-bar ${cls}"><span>${label}</span><div><i style="width:${p}%;background:${col}"></i><b>${Math.round(cur)}/${Math.round(max)}</b></div></div>`;
}
function wpHeroHTML() {
  const h = Game.hero, H = h && h.hero;
  if (!H) return '';
  let x = `<div class="wp-hh"><img src="${typeof portraitURL === 'function' ? portraitURL('hero', h.look) : ''}" alt=""><div><b>${H.name || wpT('Герой')}</b><small>${H.clsKey && typeof GCLS !== 'undefined' && GCLS[H.clsKey] ? GCLS[H.clsKey].name : wpT('Герой')} · ${wpT('ур.')} ${H.level || 1}</small></div>`
    + `<button data-wp="peek" title="${wpT('Показать деревню')}">⌂ ${wpT('Деревня')}</button></div>`;
  if (H.maxhp) { const r = H.hp / H.maxhp; x += wpBar('hp', wpT('Здоровье'), H.hp, H.maxhp, r > 0.5 ? '#5ac04a' : r > 0.25 ? '#e0b030' : '#e04a3a'); }
  const rk = typeof abResKind === 'function' ? abResKind(H) : null;
  if (rk && typeof ABIL_RES !== 'undefined') {
    const mir = typeof kitMirror === 'function' && kitMirror();
    const rv = mir ? (h.rs || 0) : abResGet(H), rm = mir ? (h.rsm || abResMax(H)) : abResMax(H);
    x += wpBar('mp', ABIL_RES[rk].name, rv, rm, ABIL_RES[rk].col);
  }
  if (typeof h.food === 'number') x += wpBar('food', wpT('Сытость'), Math.min(100, h.food * 100), 100, h.food > 0.5 ? '#d8a040' : h.food > 0.2 ? '#c87830' : '#c8402a');
  if (h.injury) x += `<div class="wp-row warn">⚕ ${wpT('Ранен')}: ${typeof h.injury === 'string' ? h.injury : (h.injury.n || h.injury.k || wpT('рана'))}</div>`;
  const inv = (H.inv || []).filter(Boolean);
  if (inv.length) {
    const nm = k => (typeof hlName === 'function' ? hlName(k) : (GOODS[k] ? GOODS[k].name : k));
    x += `<div class="isec">${wpT('Рюкзак')}</div><div class="wp-inv">` + inv.map(s => {
      let ic = ''; try { if (GOODS[s.k]) ic = `<img src="${iconURL('good', s.k, 2)}" alt="">`; } catch (e) { /* без значка */ }
      return `<span title="${nm(s.k)}">${ic || `<em>${nm(s.k)}</em>`}<b>${s.n}</b></span>`;
    }).join('') + '</div>';
  }
  return x;
}
function wpHeroPanel(on) {
  let el = document.getElementById('wp-hero');
  if (!el) {
    el = document.createElement('div'); el.id = 'wp-hero';
    const panel = document.getElementById('panel');
    if (!panel) return;
    panel.appendChild(el);
    el.addEventListener('click', e => { if (e.target.closest('[data-wp="peek"]')) { WP.peek = true; wpSync(); } });
  }
  if (!on) return;
  const html = wpHeroHTML();
  if (html !== WP.hero) { WP.hero = html; el.innerHTML = html; }
}

// ---------- общий пересчёт (из wmSync) ----------
function wpSync() {
  if (typeof document === 'undefined' || !document.body) return;
  const b = document.body.classList;
  wpAdopt();
  wpChip();
  // поставили здание (или стройку закрыли) — карточка уходит, панель показывает задания
  if (WP.placed && !(Game.tool && Game.tool.kind === 'build')) {
    WP.placed = false; WP.card = null; wpCardRender();
    if (!wpMob() && !(Game.selected && !Game.selected.removed)) openTab('task');
  }
  if (WP.card && UI.tab !== 'build') { WP.card = null; wpCardRender(); }
  const inHand = !!(WP.card && Game.tool && Game.tool.type === WP.card), btn = document.querySelector('#wp-card .wp-place');
  if (btn && btn.classList.contains('active') !== inHand) wpCardRender();
  // поход
  const loading = b.contains('ui-loading');
  const was = WP.away;
  // во время обучения поход не включаем: его стрелки показывают на вкладки и кнопки деревни
  const tut = typeof Tut !== 'undefined' && Tut.on;
  WP.away = !loading && !tut && wpAwayNext(WP.away, wpHeroDist());
  if (!WP.away) WP.peek = false;
  const away = WP.away && !WP.peek;
  if (away && !was && wpMob() && typeof mobileSheet === 'function') mobileSheet(null);
  b.toggle('wp-away', away);
  wpHeroPanel(away);
}

function wpInit() {
  wpInitTask();
  wpCardRender();
  // постановка здания из руки (одиночка — placeBuilding, кооп — она же шлёт просьбу серверу)
  const _pb = placeBuilding;
  placeBuilding = function (...a) { const r = _pb.apply(this, a); if (Game.tool && Game.tool.kind === 'build') WP.placed = true; return r; };
  // смена раздела стройки — снова список
  const _obc = openBuildCat;
  openBuildCat = function (k) { WP.card = null; _obc(k); wpCardRender(); };
  // на ПК по умолчанию — задания (если вкладка уже открыта игроку)
  if (!wpMob() && UI.tab === 'build' && !(typeof Tut !== 'undefined' && Tut.on)) {
    const tb = document.querySelector('#tabs [data-tab="task"]');
    if (tb && getComputedStyle(tb).display !== 'none') openTab('task');
  }
}

if (typeof I18N !== 'undefined' && I18N.add) I18N.add('en', {
  'К списку': 'Back to list', 'Поставить': 'Place', 'В руке — укажите место на карте': 'In hand: pick a spot on the map',
  'Задания': 'Tasks', 'До': 'To', 'Задания: цели деревни, задания дня': 'Tasks: village goals, daily tasks', 'Цели': 'Goals',
  'Заданий пока нет. Стройте — цели деревни появятся здесь.': 'No tasks yet. Keep building: village goals will appear here.',
  'Показать деревню': 'Show the village', 'Здоровье': 'Health', 'Сытость': 'Fullness', 'Ранен': 'Wounded', 'рана': 'wound', 'Рюкзак': 'Backpack', 'ур.': 'lv.',
});
