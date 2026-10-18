'use strict';
// Локальный профиль игрока: имя, три слота сохранений на профиль и ачивки с ехидными подписями.
// Всё лежит в localStorage (сервера у игры нет). Старые сохранения «manual» и «auto» остаются
// как есть и показаны в окне отдельными строками. Хранилище устроено так, чтобы позже
// его можно было заменить облачным: весь обмен идёт через profLoad / profSave / slotKey.

const PROF_KEY = 'feod.profiles';
const PROF_SLOTS = 3;
let Prof = null;   // { cur: id, list: { id: { name, created, ach: { achId: время }, st: { счётчики } } } }

function profLoad() {
  let p = null;
  try { p = JSON.parse(localStorage.getItem(PROF_KEY)); } catch (e) { p = null; }
  if (!p || !p.list || !p.list[p.cur]) {
    p = { cur: 'p1', list: { p1: { name: 'Безымянный гном', created: Date.now(), ach: {}, st: {} } } };
  }
  Prof = p;
}
function profSave() { try { localStorage.setItem(PROF_KEY, JSON.stringify(Prof)); } catch (e) { /* нет доступа к хранилищу */ } }
function profCur() { if (!Prof) profLoad(); return Prof.list[Prof.cur]; }
function slotKey(n, id = Prof.cur) { return `${id}_${n}`; }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- Ачивки ----------
// ev — регулярка по тексту записи журнала; chk — проверка состояния игры раз в секунду;
// st/need — счётчик профиля, secret — название скрыто, пока не получена.

const ACHS = [
  { id: 'wolf',     name: 'Волк сыт, гном научен', desc: 'Волк отобрал у гнома груз. Первое знакомство с дикой природой прошло как обычно.', ev: /^Волк утащил/ },
  { id: 'fox',      name: 'Рыжая налоговая', desc: 'Лиса уволокла груз. Хитрость против тупого упрямства: счёт 1:0.', ev: /^Лиса утащила/ },
  { id: 'loss1',    name: 'Первая потеря', desc: 'Погиб первый гном. Поселение обязательно запомнит его… недели две.', die: 1 },
  { id: 'loss5',    name: 'Статистика не врёт', desc: 'Пять погибших. Кладбище уже присматривается к вам как к постоянному клиенту.', die: 5 },
  { id: 'loss15',   name: 'Кадровая текучка', desc: 'Пятнадцать погибших. Дело не в климате — дело в начальстве.', die: 15, secret: true },
  { id: 'first',    name: 'Раз-два, сколотили', desc: 'Построено первое своё здание. Стоит криво, зато в отчёте.', st: 'built', need: 1 },
  { id: 'blds10',   name: 'Градостроитель по ошибке', desc: 'Десять своих зданий. Как-то само получилось.', st: 'built', need: 10 },
  { id: 'blds25',   name: 'Мэр, которого никто не выбирал', desc: 'Двадцать пять зданий. Налогов, правда, никто не платит.', st: 'built', need: 25 },
  { id: 'lvl2',     name: 'Надстроили — не остановишь', desc: 'Здание достроено до второго уровня. Фундамент нервно хмыкнул.', ev: /достроено до уровня 2/ },
  { id: 'timber100', name: 'Лесоруб, лесорубу волк', desc: 'Добыто 100 брёвен. Белки подали коллективный иск.', prod: ['timber', 100] },
  { id: 'timber1000', name: 'Лес закончился, а вы нет', desc: 'Тысяча брёвен. Горизонт стал заметно просторнее.', prod: ['timber', 1000], secret: true },
  { id: 'stone100', name: 'Камень на камне', desc: 'Добыто 100 камня. Дорожное строительство — страшная сила.', prod: ['stone', 100] },
  { id: 'gold50',   name: 'Золотая лихорадка (лёгкая форма)', desc: 'Выработано 50 золота. Тратить будем на всё подряд, как обычно.', prod: ['gold', 50] },
  { id: 'bread50',  name: 'Хлеб всему голова', desc: 'Испечено 50 хлебов. Диета отложена на неопределённый срок.', prod: ['bread', 50] },
  { id: 'pop25',    name: 'Уже не секта', desc: 'В деревне 25 жителей. Собрание наконец похоже на собрание.', pop: 25 },
  { id: 'pop50',    name: 'Тесновато, но весело', desc: '50 жителей. Каждый знает всё про каждого, и это проблема.', pop: 50 },
  { id: 'school',   name: 'Высшее без образования', desc: 'Школа выпустила первого ученика. Диплом, разумеется, нарисован углём.', ev: /^Школа выпустила/ },
  { id: 'dawn',     name: 'Пережил ночь, ура', desc: 'Дожили до первого рассвета. Тьма оставила отзыв в одну звезду.', ev: /^Рассвет/ },
  { id: 'dawn5',    name: 'Ночной сторож по найму', desc: 'Пять ночей пережито. Привычка спать вполглаза закрепилась навсегда.', st: 'nights', need: 5 },
  { id: 'lamp',     name: 'Экономия на освещении', desc: 'Гном упал и разбил фонарь. Теперь у него два повода для темноты.', ev: /разбил фонарь/ },
  { id: 'fog',      name: 'Налево от здравого смысла', desc: 'Гном заблудился в тумане посреди собственной деревни. Талант.', ev: /заблудился в тумане/ },
  { id: 'beer',     name: 'Кто не работает — тот не падает', desc: 'Гном перебрал пива и уснул на ходу. Рабочий день удался.', ev: /перебрал пива/ },
  { id: 'ghostfood', name: 'Угостил призрака', desc: 'Призраку выдали хлеб. Он не голоден — просто вежливо взял.', ev: /угостил призрака хлебом/ },
  { id: 'entwin',   name: 'Дровосек поневоле', desc: 'Гном одолел нечисть. Лес запомнит. Лес очень злопамятный.', ev: /одолел: / },
  { id: 'entlose',  name: 'Деревья тоже умеют', desc: 'Нечисть утащила гнома в туман. Обещал вернуться к ужину.', ev: /в туман: / },
  { id: 'wipe',     name: 'Героев тут не любят', desc: 'Нечисть перебила всех нападавших. Тактическое «ура» было преждевременным.', ev: /^Нечисть перебила всех/, secret: true },
  { id: 'skelrise', name: 'Из могилы — в бригаду', desc: 'Павший гном встал скелетом. Работает без обеда, ради чего и вставал.', ev: /встал скелетом/ },
  { id: 'gy',       name: 'Недвижимость с видом на вечность', desc: 'На окраине само выросло кладбище. Агентство недвижимости в восторге.', ev: /кладбище/ },
  { id: 'subbot',   name: 'Метла — оружие труда', desc: 'Объявлен субботник. Добровольно-принудительно, как все лучшие традиции.', ev: /^Объявлен субботник/ },
  { id: 'bench',    name: 'Сидел на лавочке во время нашествия', desc: 'Пока нечисть бродила по деревне, один гном спокойно сидел на скамейке. Кто-то явно знает больше остальных.', bench: true, secret: true },
  { id: 'hero',     name: 'Профессиональный герой', desc: 'Герой достиг нового уровня. Теперь он ещё громче рассказывает об этом в таверне.', ev: /достиг уровня/ },
  { id: 'time30',   name: 'Засел всерьёз', desc: '30 минут в игре. Настоящая жизнь подождёт — она всё равно скучнее.', time: 1800 },
  { id: 'time60',   name: 'Час жизни гномьего мира', desc: 'Час в игре. Чай давно остыл, а гномы ещё нет.', time: 3600, secret: true },
];
const ACH_BY = Object.fromEntries(ACHS.map(a => [a.id, a]));

function achGet(id) {
  const p = profCur();
  if (!ACH_BY[id] || p.ach[id]) return;
  p.ach[id] = Date.now();
  profSave();
  achToast(ACH_BY[id]);
  if (UI && UI.tab !== undefined) profRefresh();
}

function achToast(a) {
  const box = document.getElementById('ach-toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'ach-toast';
  el.innerHTML = `<div class="ach-cup">★</div><div><small>Достижение получено</small><b>${esc(a.name)}</b><span>${esc(a.desc)}</span></div>`;
  el.onclick = () => profOpen('ach');
  box.appendChild(el);
  while (box.childElementCount > 3) box.firstChild.remove();
  setTimeout(() => el.remove(), 6500);
  try { if (typeof sfxApplause === 'function' && !Game.paused) sfxApplause(0.4); } catch (e) { /* звук не обязателен */ }
}

function achOnLog(text) {
  if (typeof text !== 'string') return;
  const p = profCur();
  if (/^Построено: /.test(text)) { p.st.built = (p.st.built || 0) + 1; profSave(); }
  if (/^Рассвет/.test(text)) { p.st.nights = (p.st.nights || 0) + 1; profSave(); }
  for (const a of ACHS) if (a.ev && !p.ach[a.id] && a.ev.test(text)) achGet(a.id);
  for (const a of ACHS) if (a.st && !p.ach[a.id] && (p.st[a.st] || 0) >= a.need) achGet(a.id);
}

function achPoll() {
  if (typeof Game === 'undefined' || !Game.units || !Game.units.length || Game.stress) return;
  if (typeof StartMenu !== 'undefined' && StartMenu.open) return;
  const p = profCur();
  const pop = Game.units.filter(u => isPerson(u) && !u.dead).length;
  let bench = false;
  if (!p.ach.bench && typeof isNightNow === 'function' && isNightNow() && ((Game.ents || []).length || (Game.skels || []).length))
    bench = Game.units.some(u => !u.dead && u.benchAt >= 0 && isPerson(u));
  for (const a of ACHS) {
    if (p.ach[a.id]) continue;
    if (a.prod && (Game.produced[a.prod[0]] || 0) >= a.prod[1]) achGet(a.id);
    else if (a.pop && pop >= a.pop) achGet(a.id);
    else if (a.time && Game.time >= a.time) achGet(a.id);
    else if (a.bench && bench) achGet(a.id);
  }
}

// гибель считаем по настоящим смертям, а не по счётчику из сохранения
{
  const _rm = removeUnit;
  removeUnit = function (u) {
    const was = u.dead;
    _rm(u);
    if (!was && u.dead && isPerson(u) && u.type !== 'carter') {
      const p = profCur();
      p.st.lost = (p.st.lost || 0) + 1; profSave();
      for (const a of ACHS) if (a.die && !p.ach[a.id] && p.st.lost >= a.die) achGet(a.id);
    }
  };
  const _log = logEvent;
  logEvent = function (kind, text, x, y) { _log(kind, text, x, y); try { achOnLog(text); } catch (e) { console.warn(e); } };
}

// ---------- Окно профиля ----------

let profTab = 'saves';
let profMsg = '';

function profOpen(tab) {
  profLoad_ensure();
  profTab = tab || profTab;
  document.getElementById('prof-win').classList.remove('hidden');
  profRefresh();
}
function profLoad_ensure() { if (!Prof) profLoad(); }
function profClose() { document.getElementById('prof-win').classList.add('hidden'); }

function slotLine(label, key, opts) {
  const m = saveMeta(key);
  const info = m ? `${new Date(m.at).toLocaleString('ru-RU')} · ${Math.floor(m.time / 60)} мин · ${m.people} жит.` : 'пусто';
  return `<div class="prof-slot${m ? '' : ' empty'}"><div class="ps-t"><b>${label}</b><small>${info}</small></div>` +
    `<div class="ps-b">${opts.save ? `<button data-pa="save" data-k="${key}">Сохранить</button>` : ''}` +
    `<button data-pa="load" data-k="${key}"${m ? '' : ' disabled'}>Загрузить</button>` +
    `${opts.del ? `<button data-pa="del" data-k="${key}"${m ? '' : ' disabled'} title="Удалить сохранение">✕</button>` : ''}</div></div>`;
}

function profRefresh() {
  const win = document.getElementById('prof-win');
  if (!win || win.classList.contains('hidden')) return;
  profLoad_ensure();
  const p = profCur();
  const got = ACHS.filter(a => p.ach[a.id]).length;
  let h = `<div class="prof-head"><h3>Игрок: ${esc(p.name)}</h3><button data-pa="close" title="Закрыть">✕</button></div>` +
    `<div class="prof-tabs"><button data-pt="saves" class="${profTab === 'saves' ? 'active' : ''}">Сохранения</button>` +
    `<button data-pt="ach" class="${profTab === 'ach' ? 'active' : ''}">Ачивки ${got}/${ACHS.length}</button>` +
    `<button data-pt="who" class="${profTab === 'who' ? 'active' : ''}">Игроки</button></div>`;
  if (profMsg) h += `<div class="prof-msg">${esc(profMsg)}</div>`;
  if (profTab === 'saves') {
    h += '<div class="prof-sec">Слоты игрока</div>';
    for (let n = 1; n <= PROF_SLOTS; n++) h += slotLine('Слот ' + n, slotKey(n), { save: true, del: true });
    h += '<div class="prof-sec">Общие (старые) сохранения</div>';
    h += slotLine('Ручное', 'manual', { save: true, del: false }) + slotLine('Автосохранение', 'auto', { save: false, del: false });
  } else if (profTab === 'ach') {
    h += '<div class="ach-list">';
    for (const a of ACHS) {
      const at = p.ach[a.id], hide = !at && a.secret;
      h += `<div class="ach-row${at ? ' got' : ''}"><div class="ach-cup">${at ? '★' : '☆'}</div><div><b>${hide ? '??? Секретная ачивка' : esc(a.name)}</b><span>${hide ? 'Описание откроется, когда вы сделаете то, чего делать не стоило.' : esc(a.desc)}</span>${at ? `<small>${new Date(at).toLocaleDateString('ru-RU')}</small>` : ''}</div></div>`;
    }
    h += '</div>';
  } else {
    h += '<div class="prof-sec">Текущий игрок</div>' +
      `<div class="prof-row"><input id="prof-name" maxlength="20" value="${esc(p.name)}" autocomplete="off"><button data-pa="rename">Переименовать</button></div>` +
      '<div class="prof-sec">Все игроки</div><div class="prof-players">' +
      Object.entries(Prof.list).map(([id, q]) => `<button data-pa="switch" data-k="${id}" class="${id === Prof.cur ? 'active' : ''}">${esc(q.name)}<small>${Object.keys(q.ach).length}/${ACHS.length}</small></button>`).join('') + '</div>' +
      `<div class="prof-row"><input id="prof-new" maxlength="20" placeholder="Имя нового игрока" autocomplete="off"><button data-pa="create">Создать</button></div>` +
      '<div class="prof-sec">Перенос на другое устройство</div>' +
      '<div class="prof-row"><button data-pa="export">Скачать профиль</button><button data-pa="import">Загрузить из файла</button></div>' +
      (Object.keys(Prof.list).length > 1 ? '<div class="prof-row"><button data-pa="delp" class="danger">Удалить игрока «' + esc(p.name) + '» со всеми слотами</button></div>' : '') +
      '<p class="prof-note">Профили и сохранения хранятся в этом браузере. Очистка данных сайта сотрёт и их — на этот случай есть выгрузка в файл.</p>';
  }
  win.querySelector('.prof-body').innerHTML = h;
}

function profCheckName(name, skipId) {
  name = name.trim().slice(0, 20);
  if (!name) { profMsg = 'Имя не может быть пустым'; return null; }
  if (Object.entries(Prof.list).some(([id, q]) => id !== skipId && q.name.toLowerCase() === name.toLowerCase())) { profMsg = 'Такой игрок уже есть'; return null; }
  return name;
}

function profLoadSlot(key) {
  const run = () => { if (loadGame(key)) { updateUI(true); toast('Игра загружена'); profClose(); } else { profMsg = 'Не удалось загрузить'; profRefresh(); } };
  if (typeof StartMenu !== 'undefined' && StartMenu.open) smClose(run); else run();
}

function profAction(a, k) {
  const win = document.getElementById('prof-win');
  profMsg = '';
  if (a === 'close') return profClose();
  if (a === 'save') {
    if (typeof StartMenu !== 'undefined' && StartMenu.open) profMsg = 'Сохранять можно только во время игры';
    else if (saveMeta(k) && !confirm('Перезаписать это сохранение?')) return;
    else profMsg = saveGame(k) ? 'Сохранено' : 'Не удалось сохранить: нет места или доступа к хранилищу';
  } else if (a === 'load') {
    if (Game.units && Game.units.length && !(typeof StartMenu !== 'undefined' && StartMenu.open) && !confirm('Загрузить сохранение? Несохранённый прогресс пропадёт.')) return;
    return profLoadSlot(k);
  } else if (a === 'del') {
    if (!confirm('Удалить это сохранение насовсем?')) return;
    try { localStorage.removeItem(SAVE_KEY + k); localStorage.removeItem(SAVE_KEY + k + '.meta'); } catch (e) { /* ничего */ }
  } else if (a === 'rename') {
    const n = profCheckName(win.querySelector('#prof-name').value, Prof.cur);
    if (n) { profCur().name = n; profSave(); profMsg = 'Готово'; profBtnLabel(); }
  } else if (a === 'create') {
    const n = profCheckName(win.querySelector('#prof-new').value);
    if (n) {
      let i = 1; while (Prof.list['p' + i]) i++;
      Prof.list['p' + i] = { name: n, created: Date.now(), ach: {}, st: {} };
      Prof.cur = 'p' + i; profSave(); profMsg = `Игрок «${n}» создан`; profBtnLabel();
    }
  } else if (a === 'switch') {
    if (Prof.list[k]) { Prof.cur = k; profSave(); profMsg = `Играет: ${profCur().name}`; profBtnLabel(); }
  } else if (a === 'delp') {
    if (Object.keys(Prof.list).length < 2 || !confirm(`Удалить игрока «${profCur().name}», его слоты и ачивки насовсем?`)) return;
    for (let n = 1; n <= PROF_SLOTS; n++) { const key = slotKey(n); try { localStorage.removeItem(SAVE_KEY + key); localStorage.removeItem(SAVE_KEY + key + '.meta'); } catch (e) { /* ничего */ } }
    delete Prof.list[Prof.cur]; Prof.cur = Object.keys(Prof.list)[0]; profSave(); profBtnLabel();
  } else if (a === 'export') {
    return profExport();
  } else if (a === 'import') {
    return win.querySelector('#prof-file').click();
  }
  profRefresh();
}

function profExport() {
  const p = profCur(), slots = {};
  for (let n = 1; n <= PROF_SLOTS; n++) {
    const key = slotKey(n);
    try { const d = localStorage.getItem(SAVE_KEY + key); if (d) slots[n] = { data: d, meta: localStorage.getItem(SAVE_KEY + key + '.meta') }; } catch (e) { /* пропускаем */ }
  }
  const blob = new Blob([JSON.stringify({ feodProfile: 1, profile: p, slots })], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `oldgold-${p.name.replace(/[^\wа-яё-]+/gi, '_')}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function profImport(file) {
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const o = JSON.parse(rd.result);
      if (!o || o.feodProfile !== 1 || !o.profile || typeof o.profile.name !== 'string') throw new Error('bad');
      let name = String(o.profile.name).slice(0, 20) || 'Импорт';
      while (Object.values(Prof.list).some(q => q.name.toLowerCase() === name.toLowerCase())) name = name.slice(0, 17) + ' +';
      let i = 1; while (Prof.list['p' + i]) i++;
      const id = 'p' + i;
      Prof.list[id] = { name, created: o.profile.created || Date.now(), ach: o.profile.ach && typeof o.profile.ach === 'object' ? o.profile.ach : {}, st: o.profile.st && typeof o.profile.st === 'object' ? o.profile.st : {} };
      for (const n in o.slots || {}) {
        if (!(n >= 1 && n <= PROF_SLOTS)) continue;
        const s = o.slots[n];
        JSON.parse(s.data);   // не принимаем мусор
        localStorage.setItem(SAVE_KEY + slotKey(n, id), s.data);
        if (s.meta) localStorage.setItem(SAVE_KEY + slotKey(n, id) + '.meta', s.meta);
      }
      Prof.cur = id; profSave(); profBtnLabel();
      profMsg = `Игрок «${name}» загружен из файла`;
    } catch (e) { profMsg = 'Файл не похож на профиль OldGold'; }
    profRefresh();
  };
  rd.readAsText(file);
}

function profBtnLabel() {
  const b = document.querySelector('#start-menu [data-sm="profile"] small');
  if (b) b.textContent = profCur().name;
  const m = document.querySelector('[data-menu="profile"] span');
  if (m) m.textContent = profCur().name;
}

function initProfile() {
  if (document.getElementById('prof-win')) return;
  profLoad_ensure();
  const win = document.createElement('div');
  win.id = 'prof-win'; win.className = 'hidden';
  win.innerHTML = '<div class="prof-box"><div class="prof-body"></div><input type="file" id="prof-file" accept=".json,application/json" hidden></div>';
  document.body.appendChild(win);
  const tbox = document.createElement('div');
  tbox.id = 'ach-toasts';
  document.body.appendChild(tbox);
  win.addEventListener('click', e => {
    if (e.target === win) return profClose();
    const t = e.target.closest('[data-pt]');
    if (t) { profTab = t.dataset.pt; profMsg = ''; return profRefresh(); }
    const b = e.target.closest('[data-pa]');
    if (b && !b.disabled) profAction(b.dataset.pa, b.dataset.k);
  });
  win.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') profClose();
    if (e.key === 'Enter' && e.target.id === 'prof-name') profAction('rename');
    if (e.key === 'Enter' && e.target.id === 'prof-new') profAction('create');
  });
  win.querySelector('#prof-file').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) profImport(f); });

  // кнопки в боковом меню и на стартовом экране
  const list = document.querySelector('#tab-menu .menu-list');
  if (list && !list.querySelector('[data-menu="profile"]')) {
    list.insertAdjacentHTML('afterbegin',
      '<button data-menu="profile"><img data-icon="scroll" alt="">Игрок и слоты: <span></span></button>' +
      '<button data-menu="ach"><img data-icon="scroll" alt="">Ачивки</button>');
    list.querySelectorAll('img[data-icon]').forEach(im => { im.src = iconURL('ui', im.dataset.icon, 2); });
  }
  document.querySelector('#tab-menu').addEventListener('click', e => {
    const t = e.target.closest('[data-menu]');
    if (!t) return;
    if (t.dataset.menu === 'profile') { if (Mobile.on) mobileSheet(null); profOpen('saves'); }
    if (t.dataset.menu === 'ach') { if (Mobile.on) mobileSheet(null); profOpen('ach'); }
  });
  const root = document.getElementById('start-menu');
  if (root && !root.querySelector('[data-sm="profile"]')) {
    const main = root.querySelector('[data-panel="main"]');
    main.querySelector('[data-sm="help"]').insertAdjacentHTML('beforebegin', '<button class="sm-btn" data-sm="profile"><b>Игрок и ачивки</b><small></small></button>');
  }
  profBtnLabel();
  setInterval(achPoll, 1000);
}

{
  const _start = startGame;
  startGame = function () { _start(); initProfile(); if (typeof smRender === 'function') smRender(); };
  const _act = smAction;
  smAction = function (a) { if (a === 'profile') { profOpen('saves'); return; } _act(a); };
}
