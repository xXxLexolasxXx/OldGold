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
  statsOwn(name);
}

// ---- Свой анонимный счётчик ----
// Локальная воронка (localStorage 'oldgold-funnel': событие → время первого достижения) копится всегда, даже офлайн.
// Очередь на отправку ('oldgold-pending') уходит на кооп-сервер POST /e вместе со случайным id клиента ('oldgold-cid').
// Id не связан ни с человеком, ни с ником; при сбое сети очередь ждёт следующей попытки, игра не тормозит (fetch с таймаутом).
const statsLocal = () => /^(localhost|127\.0\.0\.1|\[::1\]|)$/.test(location.hostname);
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* нет хранилища */ } };
Stats.cid = null; Stats.timer = 0; Stats.busy = false; Stats.next = 0; Stats.fails = 0;

function statsCid() {
  if (Stats.cid) return Stats.cid;
  let c = lsGet('oldgold-cid', '');
  if (!/^[a-z0-9]{8,32}$/.test(c)) {
    c = ''; const a = new Uint8Array(12);
    try { crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < 12; i++) a[i] = Math.random() * 256; }
    for (const x of a) c += (x % 36).toString(36);
    lsSet('oldgold-cid', c);
  }
  return Stats.cid = c;
}

function statsOwn(name) {
  name = String(name).toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 48);
  const f = lsGet('oldgold-funnel', {});
  if (!f[name]) { f[name] = Date.now(); lsSet('oldgold-funnel', f); }
  if (statsLocal()) return;
  const q = lsGet('oldgold-pending', []);
  if (!q.includes(name)) { q.push(name); lsSet('oldgold-pending', q.slice(-200)); }
  clearTimeout(Stats.timer);
  Stats.timer = setTimeout(statsSend, 4000);
}

function statsUrl() {
  const h = typeof coopDefaultServer === 'function' ? coopDefaultServer() : '';
  return h ? coopHttpUrl(h).replace(/\/+$/, '') + '/e' : '';
}

function statsSend(last) {
  if (statsLocal() || Stats.busy || Date.now() < Stats.next) return;
  if (typeof teleDeclined === 'function' && teleDeclined()) return;   // игрок отказался от статистики (js/telemetry.js)
  const q = lsGet('oldgold-pending', []), url = statsUrl();
  if (!q.length || !url) return;
  const body = JSON.stringify({ c: statsCid(), e: q.slice(0, 60) });
  if (last === true && navigator.sendBeacon) {   // закрытие вкладки: очередь не чистим, уйдёт ещё раз (сервер считает событие один раз)
    try { navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' })); } catch (e) { /* ничего */ }
    return;
  }
  Stats.busy = true;
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  const to = setTimeout(() => ac && ac.abort(), 5000);
  fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'text/plain' }, keepalive: true, signal: ac ? ac.signal : undefined })
    .then(r => {
      if (!r.ok && r.status !== 204) throw new Error(r.status);
      const sent = new Set(JSON.parse(body).e);
      lsSet('oldgold-pending', lsGet('oldgold-pending', []).filter(n => !sent.has(n)));
      Stats.fails = 0;
    })
    .catch(() => { Stats.fails++; Stats.next = Date.now() + Math.min(600000, 30000 * Stats.fails); })
    .finally(() => { clearTimeout(to); Stats.busy = false; });
}

window.addEventListener('pagehide', () => statsSend(true));
window.addEventListener('online', () => { Stats.next = 0; statsSend(); });
// из консоли: statsFunnel() — что игрок прошёл (локально)
function statsFunnel() { return lsGet('oldgold-funnel', {}); }

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
  if (!(Stats.tickN = ((Stats.tickN || 0) + 1) % 1800) && lsGet('oldgold-pending', []).length) statsSend();   // раз в ~минуту добиваем неотправленное
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
