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
  const gc = window.goatcounter;
  if (!gc || typeof gc.count !== 'function') return;   // скрипт ещё грузится
  while (Stats.queue.length) {
    try { gc.count(Stats.queue.shift()); } catch (e) { return; }
  }
}

const PLAY_MARKS = [[5, 'Играл 5 минут'], [15, 'Играл 15 минут'], [30, 'Играл 30 минут'], [60, 'Играл час']];

// Вызывается из игрового цикла: считает только реальное время, когда игра идёт и вкладка открыта.
function statsTick(dt) {
  if (Stats.queue.length) flushStats();
  if (Game.paused || document.hidden) return;
  Stats.playT += dt;
  for (const [m, title] of PLAY_MARKS) if (Stats.playT >= m * 60) track(`play-${m}m`, title);
}

function statsStart() {
  track(Mobile.on ? 'start-mobile' : 'start-desktop', Mobile.on ? 'Запуск с телефона' : 'Запуск с компьютера');
}

function statsBuilt() {
  const own = Game.buildings.filter(b => b.state === 'done').length - 3;   // три стартовых не считаем
  if (own >= 1) track('built-1', 'Построил первое здание');
  if (own >= 5) track('built-5', 'Построил 5 зданий');
  if (own >= 10) track('built-10', 'Построил 10 зданий');
  if (own >= 20) track('built-20', 'Построил 20 зданий');
}
