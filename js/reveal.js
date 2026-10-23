'use strict';
// Интерфейс по ходу игры: на старте новичок видит только нужное (строительство, меню, ресурсы, время),
// остальные кнопки и вкладки появляются по вехам, событиям и шагам обучения — с анимацией, коротким лорным
// пояснением и разовой подсветкой. Одинаково для ПК, портрета и обоих горизонтальных вариантов: прячем CSS-правилом
// «нет класса rv-<ключ> на body → display: none», поэтому годится и для кнопок, которые другие файлы создают позже.
//   Game.reveal = { ключ: true } — что уже открыто (пишется в сохранение, поле rv).
//   Старые сохранения (без rv): открыто по текущему прогрессу, после первых суток — всё; ничего не пропадает.
//   Кооп: условия считаются по общему состоянию (здания, стадии меню, веха цели) — хост двигает вехи, открывается у всех.
//   «Показать всё» (Меню → Настройки) — опытным: всё сразу, запоминается на устройстве (oldgold-showall).
// Обучение: если его подсветка (.tut-hl) попала на ещё скрытую кнопку — она открывается сразу.

const RV_LS = 'oldgold-showall';
const RV_QUIET_START = 4;           // первые секунды новой игры — без плашек (что положено, открывается молча)

const rvBuilt = t => Game.buildings.some(b => b.type === t && b.state === 'done' && !b.removed);
const rvTutAt = title => typeof Tut !== 'undefined' && Tut.on && typeof TUT_STEPS !== 'undefined' && TUT_STEPS.findIndex(s => s.title === title) <= Tut.i && TUT_STEPS.some(s => s.title === title);
const rvTutOff = () => typeof Tut === 'undefined' || !Tut.on;
const rvNights = () => typeof startNights === 'function' ? startNights() : 9;
const rvDay = () => typeof startDay === 'function' ? startDay() : 9;
const rvEvening = () => typeof isEveningNow === 'function' && isEveningNow();
const rvRank = () => Game.goal && typeof Game.goal.rank === 'number' ? Game.goal.rank : 0;

// Порядок — порядок появления в обычной партии. sel — что прячем; icon — значок в плашке (ui-иконка).
const REVEAL = [
  { k: 'goal', sel: '#goal-hud', icon: 'scroll', name: 'Цели деревни',
    lore: 'Староста развернул свиток с планами: цели деревни теперь всегда перед глазами.',
    when: () => rvTutOff() && (typeof tutSeen !== 'function' || tutSeen() || (Game.time || 0) > 40) || !rvTutOff() && Tut.i >= 7 },   // пока идёт обучение, цели — в его списке
  { k: 'overview', sel: '#tabs [data-tab="overview"]', icon: 'overview', name: 'Хозяйство',
    lore: 'Счетовод сел за стол: все беды деревни — в одном свитке. Читать его лучше сидя.',
    when: () => rvTutAt('Где что не так') || Game.unlocked.grain && Game.buildings.filter(b => !b.isRoad && b.state === 'done').length >= 8 },
  { k: 'hero', sel: '#hero-btn, #hero-card', icon: 'people', name: 'Герой',
    lore: 'Герой размял плечи и спросил, кого бить. Теперь им можно командовать.',
    when: () => rvTutAt('Ваш герой') || rvTutOff() && (Game.unlocked.grain || rvEvening() || rvNights() >= 1) },
  { k: 'abil', sel: '#ab-bar', icon: 'play', name: 'Способности',
    lore: 'Герой вспомнил пару приёмов: панель способностей — в углу экрана.',
    when: () => rvTutAt('Способности') || rvTutOff() && (rvEvening() || rvNights() >= 1) },
  { k: 'log', sel: '#tabs [data-tab="log"]', icon: 'quill', name: 'Журнал',
    lore: 'Летописец достал перо: всё, что случилось и где, теперь записано. Особенно то, что вы хотели бы забыть.',
    when: () => rvEvening() || rvNights() >= 1 },
  { k: 'store', sel: '#tabs [data-tab="store"]', icon: 'store', name: 'Запасы и запреты',
    lore: 'Кладовщик завёл амбарную книгу: теперь можно запретить складам принимать лишнее.',
    when: () => !!Game.unlocked.hops || rvBuilt('bakery') },
  { k: 'sub', sel: '#sub-btn', icon: 'broom', name: 'Субботник',
    lore: 'Нашлась метла! Раз в день, с утра, можно объявить субботник — деревня приберётся. Скрипя.',
    when: () => rvDay() >= 2 },
  { k: 'chron', sel: '[data-chron="open"]', icon: 'log', name: 'Летопись',
    lore: 'Пережили первую ночь — это надо записать. Летопись в меню: «Ещё».',
    when: () => rvNights() >= 1 && !rvEvening() },
  { k: 'prio', sel: '#tabs [data-tab="prio"]', icon: 'prio', name: 'Приоритеты',
    lore: 'Бригадир повесил доску: решайте, чем гномы заняты в первую очередь — едой, стройкой или дровами.',
    when: () => !!Game.unlocked.hops && (rvBuilt('brewery') || Game.units.length >= 18) || rvRank() >= 1 },
  { k: 'trade', sel: '#tabs [data-tab="trade"]', icon: 'trade', name: 'Торговля',
    lore: 'По дороге скрипит первый обоз: торговцы готовы менять товар на золото. И на слухи.',
    when: () => !!Game.unlocked.trade || rvBuilt('tradepost') },
  { k: 'council', sel: '#tabs [data-tab="council"]', icon: 'council', name: 'Совет деревни',
    lore: 'Старейшины собрались за длинным столом: теперь деревня принимает указы. И спорит о них до хрипоты.',
    when: () => typeof startOpen === 'function' ? startOpen('laws') && rvRank() >= 1 : rvRank() >= 1 },
  { k: 'photo', sel: '[data-photo="open"]', icon: 'scroll', name: 'Фото-режим',
    lore: 'Заезжий художник поставил мольберт: в меню «Ещё» появился фото-режим.',
    when: () => rvRank() >= 1 },
];

// Лор к стадиям меню строительства (вместо сухого «Открыто в меню»)
const REVEAL_STAGE = {
  res: ['Ресурсы', 'Бригадир разложил чертежи: лес, камень, доски и большой костёр.'],
  grain: ['Зерно и хлеб', 'Мельник приехал с мешком зерна: можно сеять пшеницу, молоть муку и печь хлеб. А ещё — второй трактир и склад.'],
  hops: ['Хмель и пиво', 'Старый пивовар показал, где растёт хмель: открыты хмельник, поле хмеля и пивоварня.'],
  pigs: ['Свиньи и мясо', 'Кто-то привёл свинью. Свинья привела идею: свинарник и бойня.'],
  base: ['Хозяйство', 'Козы и лошади согласились работать за сено: загон и конюшня.'],
  craft: ['Ремесло', 'Со шкурами надо что-то делать: дубильня и мастерская доспехов.'],
  metal: ['Плавка золота', 'Деревня подросла — и сразу захотела золота: золотой рудник и плавильщик.'],
  magic: ['Магия', 'В скалах мерцают кристаллы: шахта, магический круг и мастерская.'],
  iron: ['Железо и оружие', 'Под скалой нашли руду: рудник, плавильня и оружейная.'],
  guilds: ['Гильдии', 'В деревню потянулись мастера-наставники: гильдии воинов, лучников, плутов и магов.'],
  def: ['Оборона', 'Пережили первую ночь — лесничий предлагает частокол, факелы и дозорную башню.'],
  trade: ['Торговый пост', 'Пахнет выгодой: можно поставить торговый пост, к нему потянутся караваны.'],
  med: ['Лазарет', 'После пива нужны зелья: открыт лазарет.'],
  lib: ['Читальня', 'Нашёлся гном, который умеет читать. Один. Открыта читальня.'],
};

const RV = { css: null, queue: [], noteEl: null, noteT: 0, quietUntil: 0, all: false };

function rvShowAll() { try { return localStorage.getItem(RV_LS) === '1'; } catch (e) { return false; } }

// CSS: пока нет rv-<ключ> на body — элемент скрыт. Правила действуют только в игре (body.rv-on), не в главном меню.
function rvStyle() {
  if (RV.css) return;
  const rules = [];
  for (const r of REVEAL) for (const s of r.sel.split(','))
    rules.push(`body.rv-on:not(.rv-all):not(.rv-${r.k}) ${s.trim()} { display: none !important; }`);
  RV.css = document.createElement('style');
  RV.css.id = 'rv-css';
  RV.css.textContent = rules.join('\n');
  document.head.appendChild(RV.css);
}

function rvApply() {
  const b = document.body;
  RV.all = rvShowAll();
  b.classList.toggle('rv-all', RV.all);
  for (const r of REVEAL) b.classList.toggle('rv-' + r.k, !!(Game.reveal && Game.reveal[r.k]));
  rvCount();
  const btn = document.querySelector('[data-reveal="all"]');
  if (btn) btn.querySelector('.rv-st').textContent = RV.all ? 'вкл' : 'выкл';
}

// сколько вкладок видно — портретная панель вкладок растягивает их на всю ширину без дыр
function rvCount() {
  const tabs = document.getElementById('tabs');
  if (!tabs) return;
  const n = [...tabs.querySelectorAll('.tab-btn')].filter(b => getComputedStyle(b).display !== 'none').length;
  tabs.style.setProperty('--rv-n', Math.max(1, n));
}

function rvOpen(r, quiet) {
  if (!Game.reveal || Game.reveal[r.k]) return;
  Game.reveal[r.k] = true;
  rvApply();
  if (quiet || RV.all) return;
  // разовая подсветка: вспышка при появлении и мягкое свечение до первого нажатия
  for (const s of r.sel.split(',')) for (const el of document.querySelectorAll(s.trim())) {
    el.classList.add('rv-new');
    const off = () => el.classList.remove('rv-new');
    el.addEventListener('click', off, { once: true });
    setTimeout(off, 14000);
  }
  rvNote(r.name, r.lore, r.icon);
}

// Плашка «Новое»: заголовок и одна лорная строчка; по очереди, касание закрывает
function rvNote(name, lore, icon) {
  RV.queue.push({ name, lore, icon });
  if (!RV.noteEl) rvNext();
}
function rvNext() {
  const n = RV.queue.shift();
  if (!n) { RV.noteEl = null; return; }
  const view = document.getElementById('view') || document.body;
  const el = document.createElement('div');
  el.className = 'rv-note';
  let ic = '';
  try { ic = `<img src="${iconURL('ui', n.icon || 'scroll', 2)}" alt="">`; } catch (e) { /* без значка */ }
  el.innerHTML = `${ic}<div><div class="rv-h">${typeof t === 'function' ? t('Новое: {0}', n.name) : 'Новое: ' + n.name}</div><div class="rv-t">${n.lore}</div></div>`;
  el.onclick = () => rvClose(el);
  view.appendChild(el);
  RV.noteEl = el;
  clearTimeout(RV.noteT);
  RV.noteT = setTimeout(() => rvClose(el), document.body.classList.contains('mobile') ? 8000 : 6500);
}
function rvClose(el) {
  if (!el || el.classList.contains('out')) return;
  el.classList.add('out');
  setTimeout(() => { el.remove(); if (RV.noteEl === el) { RV.noteEl = null; setTimeout(rvNext, 250); } }, 300);
}

function rvInGame() { return !(typeof StartMenu !== 'undefined' && StartMenu.open) && Game.buildings && Game.buildings.length > 0; }

function rvTick() {
  const b = document.body;
  b.classList.toggle('rv-on', rvInGame());
  if (!rvInGame()) return;
  let quiet = (Game.time || 0) < RV.quietUntil;
  // кооп-клиент, загрузка без данных: первый проход молча — открываем всё, что уже положено по прогрессу
  if (!Game.reveal) { Game.reveal = {}; quiet = true; if (Game.revealOld && (Game.time || 0) > 570) { for (const r of REVEAL) Game.reveal[r.k] = true; rvApply(); } }
  for (const r of REVEAL) {
    if (Game.reveal[r.k]) continue;
    let ok = false;
    try { ok = !!r.when(); } catch (e) { ok = false; }
    if (ok) rvOpen(r, quiet);
  }
  // обучение подсветило скрытую кнопку — показать её
  for (const el of document.querySelectorAll('.tut-hl')) {
    const r = REVEAL.find(x => !Game.reveal[x.k] && el.matches(x.sel));
    if (r) rvOpen(r, false);
  }
  Game.revealOld = false;
  rvCount();
}

function rvToggleAll() {
  const on = !rvShowAll();
  try { localStorage.setItem(RV_LS, on ? '1' : '0'); } catch (e) { /* без хранилища — только до перезагрузки */ }
  RV.all = on;
  rvApply();
  if (on) for (const el of document.querySelectorAll('.rv-new')) el.classList.remove('rv-new');
  if (typeof toast === 'function') toast(on ? 'Показано всё: все кнопки и вкладки сразу' : 'Кнопки снова появляются по ходу игры');
}

function rvMenuButton() {
  const list = document.querySelector('#tab-menu .menu-list');
  if (!list || list.querySelector('[data-reveal="all"]')) return;
  const b = document.createElement('button');
  b.dataset.reveal = 'all';
  b.title = 'Для опытных: все кнопки и вкладки сразу, без постепенного появления';
  let ic = '';
  try { ic = `<img src="${iconURL('ui', 'menu', 2)}" alt="">`; } catch (e) { /* без значка */ }
  b.innerHTML = `${ic}Показать всё сразу: <span class="rv-st">выкл</span>`;
  b.onclick = e => { e.stopPropagation(); rvToggleAll(); };
  list.appendChild(b);
}

// ---------- Подключение: новая игра, сохранение, загрузка, стадии меню ----------
{
  const _rgs = resetGameState;
  resetGameState = function () { _rgs(); Game.reveal = null; };
  const _sg = serializeGame;
  serializeGame = function () { const s = _sg(); if (Game.reveal) s.rv = Object.keys(Game.reveal); return s; };
  const _as = applySave;
  applySave = function (s) {
    _as(s);
    if (Array.isArray(s.rv)) Game.reveal = Object.fromEntries(s.rv.map(k => [k, true]));
    else { Game.reveal = null; Game.revealOld = true; }   // старое сохранение: откроем по прогрессу (rvTick)
    RV.quietUntil = (Game.time || 0) + 1;
    rvApply();
  };
  const _ng = newGame;
  newGame = function (...a) { _ng(...a); Game.reveal = {}; Game.revealOld = false; RV.quietUntil = (Game.time || 0) + RV_QUIET_START; rvApply(); };
  const _us = unlockStage;
  unlockStage = function (id, quiet) {
    const had = Game.unlocked && Game.unlocked[id], lore = REVEAL_STAGE[id];
    _us(id, quiet || !!lore);
    if (!had && !quiet && lore && Game.unlocked[id] && !RV.all) rvNote(lore[0], lore[1], 'build');
  };
}

rvStyle();
rvMenuButton();
rvApply();
setInterval(rvTick, 400);
