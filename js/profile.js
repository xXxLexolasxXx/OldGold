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
  { id: 'blds10',   name: 'Градостроитель по ошибке', desc: 'Пятнадцать своих зданий. Как-то само получилось.', st: 'built', need: 15 },
  { id: 'blds25',   name: 'Мэр, которого никто не выбирал', desc: 'Сорок зданий. Налогов, правда, никто не платит.', st: 'built', need: 40 },
  { id: 'lvl2',     name: 'Надстроили — не остановишь', desc: 'Здание достроено до второго уровня. Фундамент нервно хмыкнул.', ev: /достроено до уровня 2/ },
  { id: 'timber100', name: 'Лесоруб, лесорубу волк', desc: 'Напилено 300 досок. Белки подали коллективный иск.', prod: ['timber', 300] },
  { id: 'timber1000', name: 'Лес закончился, а вы нет', desc: 'Две тысячи досок. Горизонт стал заметно просторнее.', prod: ['timber', 2000], secret: true },
  { id: 'stone100', name: 'Камень на камне', desc: 'Добыто 300 камня. Дорожное строительство — страшная сила.', prod: ['stone', 300] },
  { id: 'gold50',   name: 'Золотая лихорадка (лёгкая форма)', desc: 'Выработано 150 золота. Тратить будем на всё подряд, как обычно.', prod: ['gold', 150] },
  { id: 'bread50',  name: 'Хлеб всему голова', desc: 'Испечено 200 хлебов. Диета отложена на неопределённый срок.', prod: ['bread', 200] },
  { id: 'pop25',    name: 'Уже не секта', desc: 'В деревне 40 жителей. Собрание наконец похоже на собрание.', pop: 40 },
  { id: 'pop50',    name: 'Тесновато, но весело', desc: '80 жителей. Каждый знает всё про каждого, и это проблема.', pop: 80 },
  { id: 'school',   name: 'Высшее без образования', desc: 'Школа выпустила первого ученика. Диплом, разумеется, нарисован углём.', ev: /^Школа выпустила/ },
  { id: 'dawn',     name: 'Пережил ночь, ура', desc: 'Дожили до первого рассвета. Тьма оставила отзыв в одну звезду.', ev: /^Рассвет/ },
  { id: 'dawn5',    name: 'Ночной сторож по найму', desc: 'Десять ночей пережито. Привычка спать вполглаза закрепилась навсегда.', st: 'nights', need: 10 },
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
  { id: 'time30',   name: 'Засел всерьёз', desc: '45 минут в игре. Настоящая жизнь подождёт — она всё равно скучнее.', time: 2700 },
  { id: 'time60',   name: 'Час жизни гномьего мира', desc: 'Два часа в игре. Чай давно остыл, а гномы ещё нет.', time: 7200, secret: true },
  { id: 'wheat500', name: 'Колос к колосу', desc: 'Собрано 500 зерна. Мельница уже просит выходной.', prod: ['wheat', 500] },
  { id: 'wheat3000', name: 'Житница с запасом', desc: 'Три тысячи зерна. Мыши открыли филиал.', prod: ['wheat', 3000] },
  { id: 'flour300', name: 'Мучной туман', desc: 'Смолото 300 муки. Все в деревне слегка белёсые.', prod: ['flour', 300] },
  { id: 'bread1000', name: 'Пекарь-стахановец', desc: 'Тысяча хлебов. Подозрительно много для гномов на диете.', prod: ['bread', 1000], secret: true },
  { id: 'beer150', name: 'Пенная пятилетка', desc: 'Сварено 150 кружек пива. Трактир гудит, как улей.', prod: ['beer', 150] },
  { id: 'darkbeer60', name: 'Тёмная сторона бочки', desc: 'Сварено 60 тёмного пива. Утром будет трудно, зато вечером легко.', prod: ['darkbeer', 60] },
  { id: 'sausage120', name: 'Колбасный цех', desc: '120 колбас. Свиньи всё поняли и ушли в оппозицию.', prod: ['sausage', 120] },
  { id: 'steak60', name: 'Стейк средней прожарки', desc: '60 стейков. Повар требует, чтобы его называли шефом.', prod: ['steak', 60] },
  { id: 'croissant60', name: 'Французский акцент', desc: '60 круассанов. Гномы тянут «р» и задирают нос.', prod: ['croissant', 60] },
  { id: 'goldore150', name: 'Жила нашлась', desc: 'Добыто 150 золотой руды. Кирки ноют в унисон.', prod: ['goldore', 150] },
  { id: 'gold600', name: 'Дракону не отдадим', desc: 'Выработано 600 золота. Казначей спит с калькулятором.', prod: ['gold', 600] },
  { id: 'stone1500', name: 'Горная болезнь', desc: 'Добыто 1500 камня. Скалы смотрят с укором.', prod: ['stone', 1500] },
  { id: 'leather100', name: 'Кожаная философия', desc: '100 кож. Шкуры кончились раньше, чем идеи.', prod: ['leather', 100] },
  { id: 'iron100', name: 'Железная воля', desc: '100 железных слитков. Печь не гасла с понедельника.', prod: ['iron', 100] },
  { id: 'sword30', name: 'Остро-умно', desc: 'Выкованы 30 мечей. Осталось найти, кому ими махать.', prod: ['sword', 30] },
  { id: 'bow30', name: 'Тетива натянута', desc: '30 луков. Мишени в страхе подали заявления на увольнение.', prod: ['bow', 30] },
  { id: 'ironarmor20', name: 'Консервы на ножках', desc: '20 железных доспехов. Ходить громко, прятаться бесполезно.', prod: ['ironArmor', 20] },
  { id: 'mana40', name: 'Банка за банкой', desc: '40 банок маны. Маги перестали жаловаться на усталость.', prod: ['mana', 40] },
  { id: 'pop100', name: 'Гномий мегаполис', desc: '100 жителей. Очередь в трактир видна из космоса.', pop: 100 },
  { id: 'pop150', name: 'Столица всея леса', desc: '150 жителей. Здесь уже есть свой бюрократ.', pop: 150, secret: true },
  { id: 'blds70', name: 'Стройка века (одна из)', desc: 'Семьдесят зданий. Дороги скоро закончатся, потом и карта.', st: 'built', need: 70 },
  { id: 'blds120', name: 'Сам себе Рим', desc: 'Сто двадцать зданий. Рим тоже строился не за день, но вы быстрее.', st: 'built', need: 120, secret: true },
  { id: 'dawn20', name: 'Ночной дозор', desc: 'Двадцать ночей пережито. Синяки под глазами стали частью облика.', st: 'nights', need: 20 },
  { id: 'dawn50', name: 'Сова с бородой', desc: 'Пятьдесят ночей. Солнце уже здоровается по имени.', st: 'nights', need: 50, secret: true },
  { id: 'loss30', name: 'Горький опыт', desc: 'Тридцать погибших. Кладбище расширяют, а вы всё строите.', die: 30, secret: true },
  { id: 'grad10', name: 'Выпускной бал', desc: 'Школа выпустила 10 учеников. Дипломы всё ещё угольные.', st: 'grad', need: 10 },
  { id: 'grad40', name: 'Кузница кадров', desc: '40 выпускников. Директор школы требует памятник.', st: 'grad', need: 40 },
  { id: 'bump10', name: 'Часы пик', desc: '10 столкновений на дорогах. Трудяги, конечно, ни при чём.', st: 'bumps', need: 10 },
  { id: 'ghost3', name: 'Охотник за привидениями', desc: 'Три призрака отправлены на покой. Или в отпуск — кто их разберёт.', st: 'ghosts', need: 3 },
  { id: 'guild', name: 'Диплом мастера', desc: 'Герой обучился в гильдии. Теперь с гордостью смотрит в зеркало.', ev: /обучился в гильдии/ },
  { id: 'chief', name: 'Кто тут главный', desc: 'Гном возглавил здание. Список подчинённых — один гном и ворчание.', ev: /возглавил/ },
  { id: 'goat', name: 'Козья тропа', desc: 'Пастух приручил козу. Коза считает, что приручили пастуха.', ev: /приручил козу/ },
  { id: 'carter', name: 'Извозчик на постой', desc: 'Из конюшни выехал первый извозчик. Дороги вздохнули.', ev: /^Из конюшни выехал/ },
  { id: 'starve', name: 'Обед по расписанию', desc: 'Гном упал от голода. Расписание существовало только в мечтах.', ev: /упал от голода/ },
  { id: 'time5h', name: 'Дом, милый дом', desc: 'Пять часов в игре. Гномы считают вас членом семьи.', time: 18000, secret: true },
];
const ACH_BY = Object.fromEntries(ACHS.map(a => [a.id, a]));

// Ачивки выдаются не чаще одной за ACH_GAP секунд игрового времени, остальные ждут очереди,
// чтобы они не сыпались пачкой (особенно при загрузке большой деревни).
const ACH_GAP = 240;
const AchQ = { next: 0, q: [] };

function achGet(id) {
  const p = profCur();
  if (!ACH_BY[id] || p.ach[id]) return;
  const now = typeof Game !== 'undefined' && Game.time || 0;
  if (AchQ.next > now + ACH_GAP) AchQ.next = 0;   // загрузили более раннюю игру
  if (now < AchQ.next) { if (!AchQ.q.includes(id)) AchQ.q.push(id); return; }
  AchQ.next = now + ACH_GAP;
  AchQ.q = AchQ.q.filter(x => x !== id);
  p.ach[id] = Date.now();
  profSave();
  track('ach-first', 'Получил первую ачивку'); track('ach-' + id, 'Ачивка: ' + ACH_BY[id].name);
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
  if (/^Школа выпустила/.test(text)) { p.st.grad = (p.st.grad || 0) + 1; profSave(); }
  if (/^Столкновение/.test(text)) { p.st.bumps = (p.st.bumps || 0) + 1; profSave(); }
  if (/(отпустил|прогнал) призрака/.test(text)) { p.st.ghosts = (p.st.ghosts || 0) + 1; profSave(); }
  for (const a of ACHS) if (a.ev && !p.ach[a.id] && a.ev.test(text)) achGet(a.id);
  for (const a of ACHS) if (a.st && !p.ach[a.id] && (p.st[a.st] || 0) >= a.need) achGet(a.id);
}

function achPoll() {
  if (typeof Game === 'undefined' || !Game.units || !Game.units.length || Game.stress) return;
  if (typeof StartMenu !== 'undefined' && StartMenu.open) return;
  const p = profCur();
  if (AchQ.q.length && Game.time >= AchQ.next) { const id = AchQ.q.shift(); if (!p.ach[id]) achGet(id); }
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
      statsLost();
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
  track('profile-open', 'Открыл «Профиль и ачивки»');
  if (profTab === 'ach') track('ach-open', 'Открыл список ачивок');
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
