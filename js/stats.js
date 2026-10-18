'use strict';
// Анонимная статистика через GoatCounter (без cookie и личных данных).
// Каждое событие отправляется не больше одного раза за запуск игры.
// На localhost GoatCounter сам ничего не считает.

const Stats = { sent: new Set(), queue: [], playT: 0 };

function track(name, title) {
  if (Stats.sent.has(name)) return;
  Stats.sent.add(name);
  Stats.queue.push({ path: 'event/' + name, title: title || name, event: true });
  flushStats();
}

function flushStats() {
  if (/^(localhost|127\.0\.0\.1|\[::1\]|)$/.test(location.hostname)) { Stats.queue.length = 0; return; }   // у себя не считаем
  const gc = window.goatcounter;
  if (!gc || typeof gc.count !== 'function') return;   // скрипт ещё грузится
  while (Stats.queue.length) {
    try { gc.count(Stats.queue.shift()); } catch (e) { return; }
  }
}

const PLAY_MARKS = [[1, 'Играл минуту'], [5, 'Играл 5 минут'], [15, 'Играл 15 минут'], [30, 'Играл 30 минут'], [60, 'Играл час']];

// Вызывается из игрового цикла: считает только реальное время, когда игра идёт и вкладка открыта.
function statsTick(dt) {
  if (Stats.queue.length) flushStats();
  if (Game.paused || document.hidden) return;
  Stats.playT += dt;
  for (const [m, title] of PLAY_MARKS) if (Stats.playT >= m * 60) track(`play-${m}m`, title);
  if (Game.time > 5 && (isEveningNow() || isNightNow())) track('night-1', 'Дожил до первого вечера/ночи');
  if (isNightNow()) {
    track('night-seen', 'Дожил до первой ночи');
    if (isLongNight()) track('night-long', 'Дожил до первой долгой (5-й) ночи');
  }
  if (typeof graveyardOf === 'function' && graveyardOf()) track('graveyard', 'Построил кладбище');
}

// Возвращаемость: храним в браузере только даты первого и последнего захода, наружу уходит лишь «через сколько дней».
function statsReturn() {
  const day = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
  try {
    const raw = localStorage.getItem('oldgold-visit');
    const v = raw ? JSON.parse(raw) : { first: day(), last: day(), n: 0 };
    const d = day() - v.first;
    if (v.n > 0 && d >= 1) track(d === 1 ? 'return-d1' : d <= 7 ? 'return-d2-7' : 'return-d8plus', d === 1 ? 'Вернулся на следующий день' : d <= 7 ? 'Вернулся через 2–7 дней' : 'Вернулся через 8+ дней');
    if (v.n > 0) track('return-any', 'Вернулся (не первый заход)');
    v.n++; v.last = day();
    localStorage.setItem('oldgold-visit', JSON.stringify(v));
  } catch (e) { /* нет хранилища */ }
}

function statsStart() {
  statsReturn();
  track(Mobile.on ? 'start-mobile' : 'start-desktop', Mobile.on ? 'Запуск с телефона' : 'Запуск с компьютера');
}

// Первая потеря гнома (ники и имена не отправляем)
function statsLost() { track('lost-1', 'Потерял первого гнома'); }

function statsBuilt() {
  const own = Game.buildings.filter(b => b.state === 'done').length - 3;   // три стартовых не считаем
  if (own >= 1) track('built-1', 'Построил первое здание');
  if (own >= 5) track('built-5', 'Построил 5 зданий');
  if (own >= 10) track('built-10', 'Построил 10 зданий');
  if (own >= 20) track('built-20', 'Построил 20 зданий');
}
