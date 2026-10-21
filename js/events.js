'use strict';
// Журнал событий: что случилось в деревне и где. Всплывающие сообщения быстро исчезают
// и для частых событий показываются не всегда, а здесь записано всё. Клик по записи
// показывает место на карте.

const LOG_MAX = 300;
const LOG_KINDS = {
  build:   { icon: 'build', name: 'Стройка' },
  animal:  { icon: 'log_animal', name: 'Животные' },
  owl:     { icon: 'log_owl', name: 'Совы' },
  crow:    { icon: 'log_crow', name: 'Вороны' },
  bump:    { icon: 'log_gossip', name: 'Дрязги' },
  food:    { icon: 'log_food', name: 'Еда' },
  night:   { icon: 'log_night', name: 'Ночь' },
  weather: { icon: 'log_gossip', name: 'Дрязги' },
  tree:    { icon: 'log_tree', name: 'Нечисть' },
  gold:    { icon: 'log_gold', name: 'Находки' },
  people:  { icon: 'people', name: 'Жители' },
  deliver: { icon: 'store', name: 'Доставки' },
  festival: { icon: 'log_gossip', name: 'Праздник' },
};
const LOG_FILTERS = [
  ['all', 'Все', 'log_all'], ['gossip', 'Дрязги', 'log_gossip'], ['night', 'Ночь', 'log_night'], ['life', 'Бытовуха', 'people'],
];
// Что куда входит: бытовуха — стройка, жители, еда, находки, доставки; дрязги — звери, столкновения, погода
const LOG_GROUP = { owl: 'gossip', crow: 'gossip', animal: 'gossip', bump: 'gossip', weather: 'gossip', festival: 'gossip', tree: 'night', build: 'life', people: 'life', food: 'life', gold: 'life', deliver: 'life' };
// Язвительные приписки: подбираются по виду события, стабильно для каждой записи
const LOG_SARC = {
  build:   ['Ну наконец-то, а то уже крыши не хватало.', 'Архитектор плачет от счастья. Или от чего-то ещё.', 'Стоит криво, зато своё.', 'Прораб заявляет, что так и задумано.'],
  people:  ['Жизнь налаживается — ну, у кого-то.', 'Подвиг, достойный минуты молчания.', 'Население в шоке, но делает вид.'],
  food:    ['Гномы едят, как будто завтра не будет. Завтра будет.', 'Диета отложена на неопределённый срок.', 'Кухня довольна собой.'],
  gold:    ['Нашлось — значит, кто-то уже потерял.', 'Золото любит тех, кто не ищет. Ага.'],
  deliver: ['Трудяги трудятся, начальство наблюдает.', 'Доставка прошла почти без потерь морали.'],
  animal:  ['Природа напоминает, кто тут главный. Не вы.', 'Зверьё не читало договор о ненападении.', 'Волк сыт, гном научен, мешок утерян.'],
  owl:     ['Сова ничего не знает, но смотрит осуждающе.', 'Птица умнее половины деревни.'],
  crow:    ['Блестит — значит, моё. Философия вороны.', 'Золото любит тех, кто его уносит. Ворона в курсе.', 'Охрана склада: два гнома и одна нервная курица.'],
  bump:    ['Дорога слишком узкая для двух гномов и двух эго.', 'Извинений не последовало. Колено тоже.', 'Налетели друг на друга — классика жанра.'],
  weather: ['Небеса снова вспомнили о гномах.', 'Погода: «так надо». Зонтики: «мы предупреждали».', 'Природа в очередной раз проверила крыши на честность.'],
  night:   ['Страшно? Так и должно быть.', 'Тьма пришла без приглашения, как обычно.', 'Хороший вечер, чтобы лежать под одеялом и не отсвечивать.'],
  tree:    ['Лес объявил войну. Ожидаемо.', 'Деревья давно копили обиды. Дождались.', 'Топор всегда лучше диалога. Но не всегда.'],
};
function logSarc(e) {
  if (e.n > 1 && e.id % 3) return '';             // не к каждой записи — иначе утомит
  if (e.id % 3 === 1) return '';
  const p = LOG_SARC[e.kind];
  return p ? p[(e.id * 7) % p.length] : '';
}

function logEvent(kind, text, x, y) {
  const log = Game.log || (Game.log = []);
  const last = log[log.length - 1];
  // одинаковое подряд за короткое время — одной строкой «×N»
  // и то же самое, что было среди последних записей полминуты-минуту назад (фонари и туман ночью, лисы с кроликами)
  let same = last && last.text === text && Game.time - last.t < 20 ? last : null;
  if (!same) for (let i = log.length - 1; i >= 0 && i >= log.length - 6; i--) if (log[i].text === text && Game.time - log[i].t < 90) { same = log[i]; break; }
  if (same) {
    same.n++; same.t = Game.time;
    if (x !== undefined) { same.x = x; same.y = y; }
  } else {
    log.push({ id: (Game.logId = (Game.logId || 0) + 1), t: Game.time, kind, text, x, y, n: 1 });
    if (log.length > LOG_MAX) log.shift();
  }
  UI.logUnread = (UI.logUnread || 0) + (UI.tab === 'log' ? 0 : 1);
}

function fmtTime(t) {
  const s = Math.floor(t);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function logHTML() {
  const f = UI.logFilter || 'all';
  let h = '<div class="log-filters">' + LOG_FILTERS.map(([k, n, ic]) => `<button data-logf="${k}" class="${k === f ? 'active' : ''}" title="${n}">${ui(ic)}${n}</button>`).join('') + '</div>';
  const list = (Game.log || []).filter(e => f === 'all' || e.kind === f || LOG_GROUP[e.kind] === f);
  if (!list.length) return h + '<div class="muted small">Пока ничего не случилось.</div>';
  h += '<div class="log-list">';
  for (let i = list.length - 1; i >= 0 && i >= list.length - 120; i--) {
    const e = list[i], k = LOG_KINDS[e.kind] || { icon: 'log_all' };
    const go = e.x !== undefined ? ` data-logx="${e.x}" data-logy="${e.y}" title="Показать на карте"` : '';
    h += `<div class="log-row${go ? ' click' : ''}"${go}><span class="log-t">${fmtTime(e.t)}</span><span class="log-i">${ui(k.icon)}</span><span class="log-x">${e.text}${e.n > 1 ? ` <b>×${e.n}</b>` : ''}${logSarc(e) ? `<i class="log-s">${logSarc(e)}</i>` : ''}</span></div>`;
  }
  return h + '</div>';
}

// Метка на карте после клика по записи
function drawLogMark(c) {
  const m = UI.logMark;
  if (!m) return;
  const p = (performance.now() - m.at) / 1000;
  if (p > 3) { UI.logMark = null; return; }
  const r = 10 + (p * 30) % 18;
  c.strokeStyle = `rgba(246,212,88,${1 - ((p * 30) % 18) / 18})`;
  c.lineWidth = 2;
  c.beginPath(); c.arc(m.x * TILE, m.y * TILE, r, 0, 7); c.stroke();
}

// Вся деревня хлопает: кто на улице и не лежит, не заблудился и не дерётся
const CHEERS = ['Ура!', 'Браво!', 'Хо-хо!', 'Молодцы!'];
function applaud(text) {
  let n = 0;
  for (const u of Game.units) {
    if (!isPerson(u) || u.inside || u.dead || u.type === 'carter') continue;
    if (u.brk && u.brk.kind !== 'smoke' && u.brk.kind !== 'join') continue;
    u.gest = 'clap'; u.gestUntil = Game.time + 2.6 + Math.random() * 1.4;
    if (n++ < 8 && Math.random() < 0.5) floater(u.x, u.y - 1.2, CHEERS[n % CHEERS.length], '#fff2a0');
  }
  if (!Game.paused) sfxApplause(Math.min(1, 0.3 + n / 15));
  if (text) logEvent('people', text);
}
