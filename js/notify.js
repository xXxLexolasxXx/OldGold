'use strict';
// Единый менеджер оповещений и поэтапный вход в игру.
// Раньше каждая система показывала своё сразу: «Что нового» поверх меню, обучение, подсказка коопа,
// пачка тостов сервера, ачивки — всё в первые секунды и друг на друге. Теперь:
//  • одно окно за раз: следующий шаг ждёт, пока закроют текущее (nqBusy);
//  • тостов на экране не больше 2 (в «подробном» — 3), одинаковые склеиваются «×3», не больше 6 в минуту;
//    лишнее и мелкое уходит в «Журнал оповещений» (кнопка-свиток слева сверху и пункт в меню);
//  • «тишина» 20–25 с после входа и во время ночной тревоги: показываем только ответы на действия игрока и важное;
//  • вход по шагам: 1 — чистая карта, 2 — одна строка приветствия («пока вас не было: …»),
//    3 — «Что нового» (только при новой версии, коротко), 4 — задания дня одной строкой, 5 — обучение / подсказка коопа.
// Другие системы могут встать в общую очередь окон: Notify.modal(id, show, prio) — show() вызовется, когда экран свободен.
// Окно, которое должно держать очередь, помечается атрибутом data-nq-modal.

const Notify = {
  mode: 'calm',           // calm — спокойный (по умолчанию), full — подробный
  q: [],                  // тосты, ждущие места на экране
  achQ: [],               // ачивки, ждущие своей очереди
  achAt: 0,
  shown: [],              // когда показывали тосты (лимит в минуту)
  log: [],                // журнал: { at, text, kind, n, seen }
  unread: 0,
  held: 0,                // сколько отложили за «тишину» после входа
  heldTold: 0,
  quietUntil: 0,
  lastInput: 0,
  entry: null,            // шаги входа
  modals: [],             // чужие окна, ждущие очереди: { id, show, prio }
  rare: {},
  want: { tut: false, coopHint: false, news: false },
};

const NQ_KEY = 'oldgold.notify';
const NQ_BLOCK = '#hero-name, #cp-class, #cp-lost, #cp-admin, #cp-stats, #whatsnew, #goal-modal:not(.hidden), #prof-win:not(.hidden), #help:not(.hidden), #nq-journal, '
  + '#dil-modal:not(.hidden), #guide:not(.hidden), #daily-modal, #chron, #ha-editor, #hh-win, [data-nq-modal]';
// важное — показываем даже в «тишину»: связь, сохранение, исход игры
const NQ_URGENT = /Сервер|соединени|переподключ|не удалось|Мало памяти|Победа|Поражение|опустел|недоступн/i;
// мелочь, которая в спокойном режиме сразу уходит в журнал
const NQ_MINOR = /приходит в деревню|покидает деревню|получает титул|Герой ночи|приходит в себя у склада|падает без сил|Новинка:|Новые задания дня/i;

// частые мелкие события: не чаще раза в 5 минут реальных (не игровых) на каждый вид, остальные — в журнал (одинаковые склеиваются «×N»).
// Банши — раз за ночь. Важное (поход, зима, голод, золото школы, герой, нечисть, победа) сюда не попадает. «Гусей прогнали» тоже остаётся.
const NQ_RARE_MS = 5 * 60 * 1000;
const NQ_RARE = [
  { key: 'banshee', re: /Банши/, night: true },
  { key: 'pest', re: /Лиса|Барсук|Цапл|Мыши воруют|Ворона стащила|Стая ворон|Гусь утащил|Гуси щиплют|Куры отомстили|ручного|Сова уронила|Лось забодал|утащил[аои]? «|стащил/i },
  { key: 'flavor', re: /Кот \(|аист|птенцы|Светлячки|улей|единорог|плещется|корнях дерева|поймал курицу|Среди гусей|Дракончик|золотой гусь/i },
];
const NQ_KEEP = /поход|Зим|Осень|Весна|голод|голодают|школ.*золот|золот.*школ|Малгор|Победа|Поражение|стужей|погиб/i;   // висят дольше
function nqRare(text) {
  if (NQ_KEEP.test(text) && !/Банши/.test(text)) return null;
  for (const r of NQ_RARE) if (r.re.test(text)) return r;
  return null;
}
function nqRareHold(text) {   // true — этот вид уже был недавно, показывать не надо
  const r = nqRare(text);
  if (!r) return false;
  const t = nqNow();
  const night = r.night && typeof Game !== 'undefined' && Game.entNight != null ? 'n' + Game.entNight : null;
  const last = Notify.rare[r.key];
  if (last && (night ? last.night === night : t - last.t < NQ_RARE_MS * (r.night ? 2 : 1))) return true;
  Notify.rare[r.key] = { t, night };
  return false;
}

try { if (localStorage.getItem(NQ_KEY) === 'full') Notify.mode = 'full'; } catch (e) { /* нет хранилища — спокойный */ }

const nqNow = () => performance.now();
const nqFull = () => Notify.mode === 'full';
const nqVisible = el => !!(el && el.getClientRects().length);

// на экране окно, которое нельзя перекрывать (или ещё открыто стартовое меню)
function nqBusy() {
  if (typeof StartMenu !== 'undefined' && StartMenu.open) return true;
  const ld = document.getElementById('loading');
  if (ld && !ld.classList.contains('hidden')) return true;
  if (document.body && document.body.classList && document.body.classList.contains('ui-place')) return true;   // на телефоне в руке здание (js/uilayers.js): окна ждут, пока не поставит или не отменит
  for (const el of document.querySelectorAll(NQ_BLOCK)) if (nqVisible(el)) return true;
  return false;
}
// идёт обучение (развёрнутое окно) — ачивки и прочее подождут
function nqTutBusy() { return typeof Tut !== 'undefined' && Tut.on; }
// ночная тревога: нечисть на улицах
function nqAlarm() { try { return typeof festThreat === 'function' && festThreat(); } catch (e) { return false; } }

// ---------- Журнал ----------

// важное в журнале: тревоги, ночь, исход игры, закреплённые подсказки (pins.js)
const nqImp = (text, kind) => kind === 'imp' || kind === 'night' || kind === 'pin' || NQ_URGENT.test(text);
// повторы склеиваются, даже если между ними были другие записи и числа в тексте другие («Пало 2» и «Пало 3»)
const nqKey = text => String(text).replace(/\d+/g, '#');
function nqJournal(text, kind, n = 1, seen = false, target = null) {
  const key = nqKey(text), now = Date.now();
  let same = -1;
  for (let i = Notify.log.length - 1; i >= Math.max(0, Notify.log.length - 12); i--) if (Notify.log[i].key === key && now - Notify.log[i].at < 300000) { same = i; break; }
  if (same >= 0) {
    const last = Notify.log.splice(same, 1)[0];
    Notify.log.push(last);
    last.n += n; last.at = now; last.text = text; if (target) last.target = target;
    if (!seen && last.seen) { last.seen = false; Notify.unread++; }
  } else {
    Notify.log.push({ at: now, text, key, kind, n, seen, target, imp: nqImp(text, kind) });
    if (!seen) Notify.unread++;
    if (Notify.log.length > 120) { const x = Notify.log.shift(); if (!x.seen) Notify.unread--; }
  }
  nqPill();
}

function nqPill() {
  let p = document.getElementById('nq-pill');
  const n = Notify.unread;
  if (!n || !Notify.entry || Notify.entry.step < 2 || nqNow() < Notify.quietUntil && !Notify.heldTold) { if (p) p.classList.add('hidden'); return; }
  if (!p) {
    p = document.createElement('button');
    p.id = 'nq-pill'; p.title = 'Журнал оповещений';
    p.onclick = () => nqJournalOpen();
    (document.getElementById('view') || document.body).appendChild(p);
  }
  p.textContent = '✉ ' + (n > 99 ? '99+' : n);
  p.classList.remove('hidden');
}

function nqAgo(t) {
  const s = Math.max(0, (Date.now() - t) / 1000 | 0);
  return s < 60 ? 'только что' : s < 3600 ? (s / 60 | 0) + ' мин назад' : (s / 3600 | 0) + ' ч назад';
}

function nqJournalOpen() {
  if (typeof Mobile !== 'undefined' && Mobile.on && typeof mobileSheet === 'function') mobileSheet(null);
  let el = document.getElementById('nq-journal');
  if (el) el.remove();
  el = document.createElement('div');
  el.id = 'nq-journal';
  const esc = s => String(s).replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
  const f = Notify.jf || 'all', list = Notify.log.slice().reverse();
  const shown = list.filter(x => f === 'all' || (f === 'imp') === !!x.imp);
  const rows = shown.map(x => {
    const go = x.target && !x.target.removed;
    return `<li class="${x.seen ? '' : 'new'} ${x.kind || ''}${x.imp ? ' imp' : ''}${go ? ' go' : ''}" data-i="${Notify.log.indexOf(x)}"><span>${x.imp ? '❗ ' : ''}${esc(x.text)}${x.n > 1 ? ` <b>×${x.n}</b>` : ''}${go ? ' <u>▸ к месту</u>' : ''}</span><i>${nqAgo(x.at)}</i></li>`;
  }).join('');
  const nImp = list.filter(x => x.imp).length;
  el.innerHTML = `<div class="nq-head"><b>Журнал оповещений</b><button data-nq="close" title="Закрыть">✕</button></div>
    <div class="nq-mode">Режим: <button data-nq="mode">${nqFull() ? 'подробный' : 'спокойный'}</button></div>
    <div class="nq-filt">${[['imp', `Важное (${nImp})`], ['all', 'Всё'], ['minor', 'Мелочи']].map(([k, t]) => `<button data-nq="f" data-f="${k}" class="${f === k ? 'on' : ''}">${t}</button>`).join('')}</div>
    ${rows ? `<ul>${rows}</ul>` : `<p>${f === 'imp' ? 'Ничего важного.' : 'Пока тихо.'}</p>`}`;
  el.addEventListener('click', e => {
    const li = e.target.closest('li.go');
    if (li) { const x = Notify.log[+li.dataset.i]; if (x && x.target && !x.target.removed && typeof focusBuilding === 'function') { el.remove(); focusBuilding(x.target); } return; }
    const b = e.target.closest('[data-nq]');
    if (!b) return;
    if (b.dataset.nq === 'f') { Notify.jf = b.dataset.f; nqJournalOpen(); return; }
    if (b.dataset.nq === 'close') el.remove();
    if (b.dataset.nq === 'mode') { nqSetMode(nqFull() ? 'calm' : 'full'); b.textContent = nqFull() ? 'подробный' : 'спокойный'; }
  });
  document.body.appendChild(el);
  for (const x of Notify.log) x.seen = true;
  Notify.unread = 0; Notify.heldTold = 0;
  nqPill();
}

function nqSetMode(m) {
  Notify.mode = m === 'full' ? 'full' : 'calm';
  try { localStorage.setItem(NQ_KEY, Notify.mode); } catch (e) { /* не сохранится — не беда */ }
  document.body.classList.toggle('nq-calm', !nqFull());
  const b = document.querySelector('#tab-menu [data-nq="mode"] span');
  if (b) b.textContent = nqFull() ? 'подробный' : 'спокойный';
}

// ---------- Тосты ----------

const nqToastRaw = toast;
const nqBox = () => document.getElementById('toasts');
const nqLive = () => { const b = nqBox(); return b ? [...b.children].filter(el => !el.classList.contains('burn')) : []; };

// показать в обход очереди (приветствие, итог «пока вас не было»); onClick — своё действие по нажатию
function nqShow(text, kind, onClick, target) {
  nqToastRaw(text, target || null, kind);
  const el = nqBox() && nqBox().lastElementChild;
  if (el) {
    el.dataset.nq = text; el.dataset.n = '1';
    if (onClick) { el.classList.add('link'); el.onclick = () => { onClick(); toastClose(el); }; }
  }
  Notify.shown.push(nqNow());
  return el;
}

function nqRateOk() {
  const t = nqNow();
  Notify.shown = Notify.shown.filter(x => t - x < 60000);
  return Notify.shown.length < (nqFull() ? 20 : 6);
}

toast = function (text, target, kind) {
  text = String(text == null ? '' : text);
  if (!text) return;
  const k = kind || (typeof toastKind === 'function' ? toastKind(text) : '');
  const t = nqNow();
  // такой же уже висит — прибавляем счётчик
  const vis = nqLive().find(el => el.dataset.nq === text);
  if (vis) { const n = +vis.dataset.n + 1; vis.dataset.n = n; vis.textContent = text + ' ×' + n; nqJournal(text, k, 1, true, target); return; }
  const wait = Notify.q.find(x => x.text === text);
  if (wait) { wait.n++; return; }
  // ответ на действие игрока (нажал — и сразу «Сюда не пройти») показываем всегда
  const urgent = t - Notify.lastInput < 1500 || NQ_URGENT.test(text);
  if (!urgent) {
    if (t < Notify.quietUntil || !Notify.entry || Notify.entry.step < 2) { Notify.held++; nqJournal(text, k, 1, false, target); return; }   // вход ещё не начался (меню, мир не пришёл) — тоже ждём
    if (!nqFull() && NQ_MINOR.test(text)) { nqJournal(text, k, 1, false, target); return; }
    if (!nqFull() && nqRareHold(text)) { nqJournal(text, k, 1, false, target); return; }
    if (nqAlarm() && k !== 'night' && k !== 'imp') { nqJournal(text, k, 1, false, target); return; }
  }
  const item = { text, target, kind: k, at: t, n: 1, urgent };
  if (urgent) Notify.q.unshift(item); else Notify.q.push(item);
  nqPump();
};

// идут шаги входа (и пара секунд после последнего) — обычные тосты не встревают между ними
function nqEntering(t) { const E = Notify.entry; return !!E && (E.step <= 5 || t < (E.doneAt || 0) + 4000); }

function nqPump() {
  const t = nqNow();
  // слишком долго ждали — в журнал, не показываем устаревшее
  Notify.q = Notify.q.filter(x => {
    if (!x.urgent && t - x.at > 20000) { nqJournal(x.text, x.kind, x.n, false, x.target); return false; }
    return true;
  });
  const max = nqFull() ? 3 : 2;
  const now = nqLive();
  let live = now.length;
  // ответ на действие игрока не ждёт: старый тост сгорает раньше срока
  if (Notify.q.length && Notify.q[0].urgent && live >= max) { toastClose(now[0]); live--; }
  while (Notify.q.length && live < max) {
    const x = Notify.q[0];
    if (!x.urgent && (!nqRateOk() || t < Notify.quietUntil || nqBusy() || nqEntering(t))) break;   // под открытым окном тосты не видны — ждут
    Notify.q.shift();
    const el = nqShow(x.n > 1 ? x.text + ' ×' + x.n : x.text, x.kind, x.onClick || null, x.target);
    if (el) { el.dataset.nq = x.text; el.dataset.n = x.n; }
    nqJournal(x.text, x.kind, x.n, true, x.target);
    live++;
  }
  nqAchPump();
}

// ---------- Ачивки ----------

const nqAchRaw = typeof achToast === 'function' ? achToast : null;
if (nqAchRaw) achToast = function (a) { if (a) Notify.achQ.push(a); nqAchPump(); };

function nqAchPump() {
  if (!nqAchRaw || !Notify.achQ.length) return;
  const t = nqNow();
  if (t < Notify.quietUntil || (Notify.entry && Notify.entry.step <= 5) || nqBusy() || nqTutBusy()) return;
  if (t - Notify.achAt < (nqFull() ? 4000 : 9000)) return;
  const box = document.getElementById('ach-toasts');
  if (box && box.childElementCount) return;
  Notify.achAt = t;
  const a = Notify.achQ.shift();
  nqAchRaw(a);
  nqJournal('Достижение: ' + a.name, 'imp', 1, true);
  // накопилось много (например, после обучения) — остальные одной строкой, они уже в профиле
  if (!nqFull() && Notify.achQ.length > 1) {
    const rest = Notify.achQ.splice(0);
    for (const r of rest) nqJournal('Достижение: ' + r.name, 'imp');
    nqShow(`Ещё достижений: ${rest.length} — смотрите в профиле`, 'imp', () => { if (typeof profOpen === 'function') profOpen('ach'); });
  }
}

// ---------- Окна других систем ----------

// Notify.modal('decree', () => openDecree(), 2): окно покажется, когда экран свободен и вход закончен.
// prio: меньше — раньше (0 — срочное, 5 — по умолчанию).
Notify.modal = function (id, show, prio = 5) {
  if (Notify.modals.some(m => m.id === id)) return;
  Notify.modals.push({ id, show, prio });
  Notify.modals.sort((a, b) => a.prio - b.prio);
};
Notify.busy = nqBusy;
Notify.toast = (text, kind) => toast(text, null, kind);
Notify.journal = nqJournalOpen;
Notify.note = (text, kind, target) => nqJournal(text, kind, 1, false, target);
// совет с действием по нажатию (профсоюзы, unions.js): ждёт в общей очереди, как обычный тост, но мимо фильтров мелочи
Notify.offer = function (text, onClick, kind) {
  text = String(text || '');
  if (!text || Notify.q.some(x => x.text === text)) return;
  Notify.q.push({ text, target: null, kind: kind || 'imp', at: nqNow(), n: 1, urgent: false, onClick });
  nqPump();
};

function nqModalPump() {
  if (!Notify.modals.length || nqBusy()) return;
  const E = Notify.entry;
  if (E && E.step <= 5 && Notify.modals[0].prio > 0) return;   // сначала вход по шагам
  if (nqTutBusy() && Notify.modals[0].prio > 1) return;
  const m = Notify.modals.shift();
  try { m.show(); } catch (e) { console.error(e); }
}

// Окно уже стоит в очереди: пока идёт вход, открыто другое окно или развёрнуто обучение — ждём
function nqHoldModal() {
  const E = Notify.entry;
  if (E && E.step <= 5) return true;
  if (nqBusy()) return true;
  return nqTutBusy() && !!Tut.el && !Tut.el.classList.contains('min');
}

// дилеммы (dilemma.js): вопрос дня не выскакивает поверх входа и других окон; в одиночной игре у него нет таймера
if (typeof dilUiSync === 'function') {
  const raw = dilUiSync;
  dilUiSync = function () {
    if (typeof DilUI !== 'undefined' && !DilUI.open && typeof Game !== 'undefined' && Game.dil && (Game.dil.cur || Game.dil.last) && nqHoldModal()) return;
    raw();
  };
}
// советы новичку (guide.js): не во время входа и окон, и не чаще раза в 45 с (в подробном режиме — 15 с)
if (typeof hintsAllowed === 'function') {
  const raw = hintsAllowed;
  hintsAllowed = function () {
    if (!raw()) return false;
    if (typeof Guide !== 'undefined' && Guide.cur) return true;   // уже показанный совет пусть доживёт свои секунды
    return !nqHoldModal() && nqNow() - (Notify.hintAt || 0) > (nqFull() ? 15000 : 45000);
  };
}
if (typeof hintShow === 'function') {
  const raw = hintShow;
  hintShow = function (id) { Notify.hintAt = nqNow(); raw(id); };
}

// ---------- «Что нового» ----------

const nqNewsRaw = typeof whatsNewShow === 'function' ? whatsNewShow : null;
const nqSeenVersion = () => { try { return localStorage.getItem('oldgold.seenVersion'); } catch (e) { return null; } };
if (nqNewsRaw) {
  // автопоказ при загрузке отменяем — он станет шагом 3 входа; ?whatsnew=1 и пункт меню показывают сразу и целиком
  whatsNewShow = function (force) { if (force) nqNewsRaw(force); else Notify.want.news = true; };
}

function nqNewsShort() {
  if (!nqNewsRaw || typeof GAME_VERSION === 'undefined') return false;
  const seen = nqSeenVersion();
  if (seen === GAME_VERSION) return false;
  if (!seen) {   // совсем новый игрок: ему «что нового» не нужно — запоминаем версию молча
    try { localStorage.setItem('oldgold.seenVersion', GAME_VERSION); } catch (e) { /* ничего */ }
    return false;
  }
  nqNewsRaw(false);
  const el = document.getElementById('whatsnew');
  if (!el) return false;
  el.classList.add('nq-short');
  const box = el.querySelector('.wn-box');
  const cur = box.querySelector('.wn-cur');
  const lis = [...cur.querySelectorAll('li')];
  lis.forEach((li, i) => { if (i >= 3) li.classList.add('nq-more'); });
  cur.querySelectorAll('ul').forEach(ul => { if (!ul.querySelector('li:not(.nq-more)')) { ul.classList.add('nq-more'); const h = ul.previousElementSibling; if (h && h.tagName === 'H3') h.classList.add('nq-more'); } });
  const btn = box.querySelector('.wn-ok');
  btn.textContent = 'Дальше';
  // «Подробнее»: раскрывает всю запись и пропущенные версии (свёрнутые по одной), внизу — «Все обновления»
  const miss = box.querySelectorAll('.wn-miss details').length;
  if (lis.length > 3 || miss) {
    const more = document.createElement('a');
    more.className = 'nq-all'; more.href = '#'; more.textContent = t(miss ? 'Подробнее и пропущенные версии ({0}) ▸' : 'Подробнее ▸', miss);
    more.onclick = e => { e.preventDefault(); el.classList.remove('nq-short'); more.remove(); };
    btn.before(more);
  }
  return true;
}

// ---------- Поэтапный вход ----------

function nqTutSeen() { try { return localStorage.getItem('oldgold-tut') === 'done'; } catch (e) { return false; } }

// автозапуск обучения и подсказки коопа — теперь последний шаг входа
if (typeof tutWhenFree === 'function') tutWhenFree = function () { Notify.want.tut = true; };
const nqCoopHintRaw = typeof coopHint === 'function' ? coopHint : null;
if (nqCoopHintRaw) coopHint = function () { Notify.want.coopHint = true; };

function nqEnter(key) {
  const coop = key === 'coop';
  const back = nqTutSeen() || !!nqSeenVersion();
  const t = nqNow();
  Notify.entry = { key, coop, back, step: 1, next: t + (back ? 1500 : 2500) };
  Notify.quietUntil = t + (nqFull() ? 8000 : back ? 20000 : 25000);
  Notify.held = 0; Notify.heldTold = 0;
  // шаг 1: чистая карта — на телефоне панель целей свёрнута в строку
  if (!nqFull() && typeof Mobile !== 'undefined' && Mobile.on && typeof GoalUI !== 'undefined') { GoalUI.fold = true; GoalUI.hudHtml = null; }
  document.body.classList.toggle('nq-calm', !nqFull());
}

function nqPeople() { return Game.units ? Game.units.filter(u => !u.dead && typeof isPerson === 'function' && isPerson(u)).length : 0; }

function nqGreet(E) {
  const tell = () => nqJournalOpen();
  if (E.coop) {
    const online = new Set(Game.units.filter(u => u.owner).map(u => u.owner)).size;
    const held = Notify.unread;
    nqShow(`Общая деревня · в сети: ${online || 1}` + (held ? ` · пока вас не было: ${held} ${nqWord(held)} ▸` : ''), 'coop', held ? tell : null);
    Notify.heldTold = held;
    return true;
  }
  if (!E.back || (Game.time || 0) < 30) return false;   // новичка и новую карту встречают окно имени героя, заставка и обучение
  nqShow(`С возвращением! Жителей в деревне: ${nqPeople()}`, '', null);
  return true;
}
const nqWord = n => (n % 10 === 1 && n % 100 !== 11 ? 'событие' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'события' : 'событий');

function nqQuestLine(E) {
  if (E.coop && typeof Coop !== 'undefined') {
    const x = Coop.qx, v = Coop.me && Coop.me.vil;
    const parts = [];
    if (x && x.q && x.q.length) parts.push(`задания дня ${x.q.filter(q => q.d).length}/${x.q.length}`);
    if (v && v.q && !v.q.done) parts.push(`заказ деревни: «${v.q.g}» ${v.q.have}/${v.q.need}`);
    if (!parts.length) return false;
    nqShow('Сегодня: ' + parts.join(' · '), 'coop', null);
    return true;
  }
  if (!E.back || (Notify.want.tut && !nqTutSeen())) return false;   // впереди обучение — оно само расскажет, что делать
  const v = Game.goalView, o = v && v.objs && v.objs.find(o => o.cur < o.need);
  if (!o) return false;
  nqShow(`Цель: ${o.t}${o.need > 1 ? ` (${o.cur}/${o.need})` : ''}`, '', null);
  return true;
}

function nqSteps() {
  const E = Notify.entry;
  if (!E || E.step > 5) return;
  const t = nqNow();
  // пока открыто окно (имя героя, выбор класса, заставка главы) — ждём, а после него ещё короткая пауза
  if (nqBusy()) { E.next = Math.max(E.next, t + (E.back ? 700 : 1200)); return; }
  if (t < E.next) return;
  const gap = E.back ? 1600 : 2600;
  E.step++;
  let did = false;
  if (E.step === 2) did = nqGreet(E);
  else if (E.step === 3) { Notify.want.news = false; did = nqNewsShort(); }
  else if (E.step === 4) did = nqQuestLine(E);
  else if (E.step === 5) {
    if (!E.coop && Notify.want.tut && typeof tutStart === 'function' && !nqTutSeen()) { Notify.want.tut = false; tutStart(); did = true; }
    if (E.coop && Notify.want.coopHint && nqCoopHintRaw) { Notify.want.coopHint = false; nqCoopHintRaw(); did = true; }
    // общая деревня: новичку — короткое обучение без стройки (только на его экране), после подсказки коопа
    if (E.coop && Notify.want.tut && typeof tutStart === 'function' && !nqTutSeen()) {
      Notify.want.tut = false;
      setTimeout(() => { if (!nqTutSeen() && !Tut.on && typeof Coop !== 'undefined' && Coop.on) tutStart('coop'); }, did ? 5000 : 0);
      did = true;
    }
    E.step = 6; E.doneAt = t + (did ? 2000 : 0);
  }
  E.next = t + (did ? gap : 150);
}

// конец «тишины»: что отложили и ещё не рассказали — одной строкой
function nqQuietEnd() {
  if (!Notify.entry || nqNow() < Notify.quietUntil || Notify.quietDone === Notify.quietUntil || nqEntering(nqNow() - 1500) || nqBusy() || nqLive().length) return;
  Notify.quietDone = Notify.quietUntil;
  const more = Notify.unread - Notify.heldTold;
  if (more > 0) nqShow(`Пока вы осматривались: ${more} ${nqWord(more)} — в журнале ▸`, Notify.entry.coop ? 'coop' : '', nqJournalOpen);
  Notify.heldTold = Notify.unread;
  nqPill();
}

function nqWatch() {
  const menu = (typeof StartMenu !== 'undefined' && StartMenu.open) || (() => { const ld = document.getElementById('loading'); return ld && !ld.classList.contains('hidden'); })();
  if (menu) { if (Notify.entry && Notify.entry.step > 5) Notify.entry = null; return; }
  if (!Game.units || !Game.units.length) return;
  const key = typeof Coop !== 'undefined' && Coop.on ? 'coop' : 'solo';
  if (!Notify.entry || Notify.entry.key !== key) nqEnter(key);
}

function nqTick() {
  try {
    nqWatch();
    nqSteps();
    nqQuietEnd();
    nqPump();
    nqModalPump();
    if (Notify.unread) nqPill();
    // телефон: пока развёрнуто окно обучения, панель целей под ним не торчит
    document.body.classList.toggle('nq-tut', nqTutBusy() && !!Tut.el && !Tut.el.classList.contains('min'));
    // задержанное «Что нового» (например, вход был до загрузки страницы) — после шагов входа
    if (Notify.want.news && Notify.entry && Notify.entry.step > 5) { Notify.want.news = false; if (!nqBusy()) nqNewsShort(); }
  } catch (e) { if (!nqTick.err) { nqTick.err = 1; console.error(e); } }
}

// ---------- Настройки в меню ----------

function nqMenu() {
  const list = document.querySelector('#tab-menu .menu-list');
  if (!list || list.querySelector('[data-nq]')) return;
  list.insertAdjacentHTML('beforeend',
    `<button data-nq="mode"><img data-icon="scroll" alt="">Оповещения: <span>${nqFull() ? 'подробный' : 'спокойный'}</span></button>` +
    '<button data-nq="log"><img data-icon="scroll" alt="">Журнал оповещений</button>' +
    '<button data-nq="news"><img data-icon="scroll" alt="">Что нового (журнал изменений)</button>');
  list.querySelectorAll('[data-nq] img[data-icon]').forEach(im => { try { im.src = iconURL('ui', im.dataset.icon, 2); } catch (e) { /* без иконки */ } });
  list.addEventListener('click', e => {
    const b = e.target.closest('[data-nq]');
    if (!b) return;
    const k = b.dataset.nq;
    if (k === 'mode') { nqSetMode(nqFull() ? 'calm' : 'full'); nqShow(nqFull() ? 'Оповещения: подробно — показываем всё' : 'Оповещения: спокойно — мелочи уходят в журнал', '', null); }
    if (k === 'log') nqJournalOpen();
    if (k === 'news' && nqNewsRaw) { if (typeof Mobile !== 'undefined' && Mobile.on && typeof mobileSheet === 'function') mobileSheet(null); nqNewsRaw('all'); }
  });
}

{
  const css = document.createElement('style');
  css.textContent = `
  #nq-pill{position:absolute;left:8px;top:52px;z-index:17;padding:3px 9px;font:13px Kurale,Georgia,serif;color:#2a1608;cursor:pointer;
    background:linear-gradient(#f1dfb2,#d9bd84);border:1px solid #6a3c12;border-radius:3px;box-shadow:0 2px 6px rgba(0,0,0,.5)}
  #nq-pill.hidden{display:none}
  body.mobile #nq-pill{top:calc(48px + env(safe-area-inset-top));left:auto;right:8px;min-height:32px;min-width:44px}
  #nq-journal{position:fixed;left:50%;top:56px;transform:translateX(-50%);z-index:9000;width:min(440px,94vw);max-height:min(60vh,520px);display:flex;flex-direction:column;
    color:#e9dcc0;font-family:Kurale,Georgia,serif;background:linear-gradient(rgba(0,0,0,.3),rgba(0,0,0,.5)),var(--wood-tex,none),#2a1e14;border:2px solid #0a0705;
    box-shadow:inset 0 0 0 1px var(--gold,#c9a24a),0 6px 24px rgba(0,0,0,.8)}
  #nq-journal .nq-head{display:flex;align-items:center;justify-content:space-between;padding:8px 10px 4px 14px;color:var(--gold-hi,#ffd877);font-size:17px}
  #nq-journal .nq-head button{min-width:38px;min-height:38px;font-size:18px;background:none;border:1px solid #6a5028;color:#f0dca0;cursor:pointer}
  #nq-journal .nq-mode{padding:0 14px 6px;font-size:13px;opacity:.9}
  #nq-journal .nq-mode button{font:inherit;color:#ffd877;background:none;border:0;border-bottom:1px dashed #c9a24a;cursor:pointer;padding:0}
  #nq-journal ul{margin:0;padding:0 10px 10px 14px;list-style:none;overflow:auto;font-size:13.5px;line-height:1.35}
  #nq-journal li{display:flex;justify-content:space-between;gap:10px;padding:4px 0;border-bottom:1px solid rgba(201,162,74,.18)}
  #nq-journal li.new span{color:#fff2c8}#nq-journal li.coop span{color:#a8e0c0}#nq-journal li.night span{color:#c0b4ec}
  #nq-journal li i{font-style:normal;font-size:11px;opacity:.6;white-space:nowrap}
  #nq-journal p{padding:0 14px 12px;margin:0;opacity:.7}
  #nq-journal .nq-filt{display:flex;gap:6px;padding:0 14px 8px}
  #nq-journal .nq-filt button{font:13px Kurale,Georgia,serif;color:#f0dca0;background:rgba(0,0,0,.25);border:1px solid #6a5028;padding:3px 9px;cursor:pointer;min-height:30px}
  #nq-journal .nq-filt button.on{background:#c9a24a;color:#2a1608;border-color:#ffd877}
  #nq-journal li.imp span{color:#ffcf9a}#nq-journal li.go{cursor:pointer}#nq-journal li.go:hover span{text-decoration:underline}
  #nq-journal li u{text-decoration:none;color:#ffd877;font-size:12px;white-space:nowrap}
  #whatsnew.nq-short{background:rgba(0,0,0,.35)}
  #whatsnew.nq-short .wn-box{max-height:62vh}
  #whatsnew.nq-short .nq-more,#whatsnew.nq-short .wn-rest{display:none}
  #whatsnew.nq-short li{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
  #whatsnew.nq-short ul{padding-left:4px}#whatsnew.nq-short li::before{content:'✦ ';color:#c9a24a}
  #whatsnew .nq-all{display:block;text-align:center;margin:12px 0 0;color:#ffd877;font-size:13px}
  #whatsnew .wn-box>button{position:sticky;bottom:0;box-shadow:0 0 0 100vmax #22180f;clip-path:inset(-10px -100vmax -6px -100vmax)}
  body.mobile #whatsnew.nq-short{align-items:flex-start;padding-top:64px}
  body.mobile #whatsnew button{min-height:44px}
  /* телефон, спокойный режим: задания и заказ — по одной строке, нажатие раскрывает */
  body.mobile.nq-calm #cp-qs:not(.nq-open)>div:not(:first-of-type){display:none}
  body.mobile.nq-calm #cp-qs:not(.nq-open) h4::after{content:' ▸';opacity:.7}
  body.mobile.nq-calm #cp-qs h4{cursor:pointer}
  body.mobile.nq-calm #cp-vil:not(.nq-open)>div+div{display:none}
  body.mobile.nq-calm #cp-vil{pointer-events:auto;cursor:pointer}
  body.mobile.nq-calm #cp-log>div:nth-last-child(n+3){display:none}
  body.mobile.nq-tut #goal-hud{visibility:hidden}`;
  document.head.appendChild(css);
}

// нажатие или клавиша — следующий тост в течение полутора секунд считается ответом и показывается сразу
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => { Notify.lastInput = nqNow(); }, true);
document.addEventListener('click', e => {
  const q = e.target.closest('#cp-qs h4, #cp-vil');
  if (q) (q.id === 'cp-vil' ? q : q.closest('#cp-qs')).classList.toggle('nq-open');
});

{
  const _start = startGame;
  startGame = function () { _start(); nqMenu(); document.body.classList.toggle('nq-calm', !nqFull()); };
}
setInterval(nqTick, 250);
