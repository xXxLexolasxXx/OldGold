'use strict';
// Журнал событий: что случилось в деревне и где. Всплывающие сообщения быстро исчезают
// и для частых событий показываются не всегда, а здесь записано всё. Клик по записи
// показывает место на карте.

const LOG_MAX = 300;
const LOG_KINDS = {
  build:   { icon: 'build', name: 'Стройка' },
  animal:  { icon: 'log_animal', name: 'Животные' },
  owl:     { icon: 'log_owl', name: 'Совы' },
  bump:    { icon: 'log_gossip', name: 'Дрязги' },
  food:    { icon: 'log_food', name: 'Еда' },
  night:   { icon: 'log_night', name: 'Ночь' },
  weather: { icon: 'log_gossip', name: 'Дрязги' },
  tree:    { icon: 'log_tree', name: 'Нечисть' },
  gold:    { icon: 'log_gold', name: 'Находки' },
  people:  { icon: 'people', name: 'Жители' },
  deliver: { icon: 'store', name: 'Доставки' },
};
const LOG_FILTERS = [
  ['all', 'Все', 'log_all'], ['build', 'Стройка', 'build'], ['animal', 'Животные', 'log_animal'], ['night', 'Ночь', 'log_night'],
  ['food', 'Еда', 'log_food'], ['people', 'Жители', 'people'], ['gossip', 'Дрязги', 'log_gossip'],
];
const LOG_GROUP = { owl: 'animal', tree: 'night', gold: 'people', deliver: 'build', bump: 'gossip', weather: 'gossip' };

function logEvent(kind, text, x, y) {
  const log = Game.log || (Game.log = []);
  const last = log[log.length - 1];
  // одинаковое подряд за короткое время — одной строкой «×N»
  if (last && last.text === text && Game.time - last.t < 20) {
    last.n++; last.t = Game.time;
    if (x !== undefined) { last.x = x; last.y = y; }
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
    h += `<div class="log-row${go ? ' click' : ''}"${go}><span class="log-t">${fmtTime(e.t)}</span><span class="log-i">${ui(k.icon)}</span><span class="log-x">${e.text}${e.n > 1 ? ` <b>×${e.n}</b>` : ''}</span></div>`;
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
