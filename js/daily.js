'use strict';
// Ежедневный вызов: одна карта на день (сид и биом считаются от даты — у всех игроков в этот день одна и та же
// деревня), цель на 10–15 минут и итоговая сводка со сравнением со вчерашним результатом. Всё локально:
// результаты лежат в localStorage ('oldgold-daily'), сервер не нужен — когда он появится, «таблицу дня» можно
// будет добавить к уже готовой сводке.
//  • Цель (одна из четырёх: жители / хлеб / здания / доски) и её размер выбираются по дате, как и карта.
//  • Время вызова — 15 минут игрового времени (DAILY_LIMIT); цель раньше срока даёт бонус за остаток времени.
//  • Очки: жители, здания, хлеб и доски, ночи, минус потери; выполненная цель — +200 и бонус за скорость.
//  • Сводка выходит, когда цель выполнена, время вышло или гномов не осталось; после неё можно играть дальше.
//  • Состояние — Game.daily (пишется в сохранение). Лучший результат дня хранится отдельно от сохранения.
// Опирается на goal.js (goalStats, goalNew), startmenu.js (кнопка и запуск), chronicle.js (название деревни).

const DAILY_LIMIT = 900;           // 15 минут игрового времени
const DAILY_KEY = 'oldgold-daily';
const DAILY_BIOMES = ['meadow', 'forest', 'steppe', 'mountain', 'swamp'];
const DAILY_GOALS = [
  { k: 'pop',    t: 'Жителей',          min: 20, span: 7,  step: 1, stat: 'pop' },
  { k: 'bread',  t: 'Испечь хлеба',     min: 20, span: 31, step: 5, stat: 'bread' },
  { k: 'blds',   t: 'Построить зданий', min: 12, span: 5,  step: 1, stat: 'blds' },
  { k: 'timber', t: 'Напилить досок',   min: 40, span: 41, step: 5, stat: 'timber' },
];

const dailyMirror = () => typeof Coop !== 'undefined' && !!Coop.on;
const dyEsc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dyTime = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

// ---------- Дата → карта и цель (чистые функции, без Math.random) ----------

function dailyDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dailyShift(key, days) {
  const [y, m, d] = key.split('-').map(Number);
  return dailyDateKey(new Date(y, m - 1, d + days));
}
function dailyHash(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13;
  return h >>> 0;
}
function dailyFor(key) {
  const h = dailyHash(key), G = DAILY_GOALS[(h >>> 12) % DAILY_GOALS.length];
  const n = G.min + Math.floor(((h >>> 8) % G.span) / G.step) * G.step;
  return { key, seed: 1 + (h % 999999937), biome: DAILY_BIOMES[(h >>> 4) % DAILY_BIOMES.length], goal: { k: G.k, n } };
}
const dailyGoalDef = k => DAILY_GOALS.find(g => g.k === k) || DAILY_GOALS[0];

// ---------- Результаты (localStorage) ----------

function dailyLoad() {
  try { const o = JSON.parse(localStorage.getItem(DAILY_KEY) || '{}'); return o && o.days ? o : { days: {} }; } catch (e) { return { days: {} }; }
}
function dailyStore(o) {
  const keys = Object.keys(o.days).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - 40))) delete o.days[k];
  try { localStorage.setItem(DAILY_KEY, JSON.stringify(o)); } catch (e) { /* нет хранилища */ }
}

function dailyScore(S, goalDone, timeLeft) {
  const base = S.pop * 20 + S.blds * 10 + Math.floor(S.bread / 2) + Math.floor(S.timber / 2) + S.nights * 30 - S.lost * 25;
  return Math.max(0, Math.round(base + (goalDone ? 200 + Math.floor(Math.max(0, timeLeft) / 6) : 0)));
}

// ---------- Ход вызова ----------

function dailyProgress() {
  const D = Game.daily;
  if (!D) return null;
  const G = dailyGoalDef(D.goal.k), S = goalStats();
  return { cur: Math.min(D.goal.n, Math.floor(S[G.stat] || 0)), need: D.goal.n, S, G };
}

function dailyFinish(res) {
  const D = Game.daily;
  if (!D || D.over) return;
  const P = dailyProgress(), done = res === 'goal';
  const left = Math.max(0, DAILY_LIMIT - Game.time);
  const score = dailyScore(P.S, done, left);
  D.over = { res, t: Math.round(Game.time), score, pop: P.S.pop, blds: P.S.blds, bread: Math.floor(P.S.bread), timber: Math.floor(P.S.timber), lost: P.S.lost, nights: P.S.nights, cur: P.cur };
  const store = dailyLoad(), prev = store.days[D.key];
  const rec = { score, done: done || (prev && prev.done) ? 1 : 0, t: done ? D.over.t : (prev && prev.t) || undefined, pop: P.S.pop, blds: P.S.blds, lost: P.S.lost, nights: P.S.nights, goal: D.goal, tries: ((prev && prev.tries) || 0) + 1 };
  if (prev && prev.score > score) { rec.score = prev.score; rec.pop = prev.pop; rec.blds = prev.blds; rec.lost = prev.lost; rec.nights = prev.nights; }
  if (done && prev && prev.done && prev.t < rec.t) rec.t = prev.t;
  store.days[D.key] = rec;
  dailyStore(store);
  D.over.best = rec.score;
  if (typeof logEvent === 'function') logEvent('goal', done ? `Вызов дня выполнен: ${dyTime(D.over.t)}, очков ${score}` : `Вызов дня окончен: очков ${score}`);
  dailyOpenSummary();
}

function dailyTick(dt) {
  const D = Game.daily;
  if (!D || D.over || dailyMirror()) return;
  D.acc = (D.acc || 0) + dt;
  if (D.acc < 1) return;
  D.acc = 0;
  const P = dailyProgress();
  if (P.cur >= P.need) dailyFinish('goal');
  else if (Game.time >= DAILY_LIMIT) dailyFinish('time');
  else if (Game.time > 30 && P.S.pop === 0) dailyFinish('dead');
}

// ---------- Запуск ----------

function dailyStart() {
  if (dailyMirror()) return;
  const D = dailyFor(dailyDateKey());
  if (dailyStart.busy) return;
  dailyStart.busy = true;
  const inMenu = typeof StartMenu !== 'undefined' && StartMenu.open;
  const msg = document.querySelector('#start-menu [data-sm="daily"] small');
  if (msg) msg.textContent = 'Создаём карту дня…';
  setTimeout(() => {
    try {
      Game.pendDiff = 'normal';
      setupStart(D.seed, { biome: D.biome, size: 'small' });
      buildTerrain(D.seed);
      updateMinimapBase();
      diffApplyStart('normal');
      goalNew('free');
      Game.daily = { key: D.key, seed: D.seed, biome: D.biome, goal: D.goal, over: null };
      dailyHud();
      updateUI(true);
      const askName = () => { if (Game.heroAsk) { Game.heroAsk = false; askHeroName(); } };
      if (inMenu) smClose(askName); else { setSpeed(1); askName(); }
    } catch (e) { console.error(e); if (typeof toast === 'function') toast('Не вышло создать карту дня'); }
    dailyStart.busy = false;
    dailyMenuRefresh();
  }, 30);
}

// ---------- Окна ----------

function dailyHudEl() {
  let el = document.getElementById('daily-hud');
  if (!el) {
    el = document.createElement('div');
    el.id = 'daily-hud';
    el.className = 'hidden';
    (document.getElementById('view') || document.body).appendChild(el);
    el.addEventListener('click', e => { if (e.target.closest('[data-dy=sum]')) dailyOpenSummary(); });
  }
  return el;
}

function dailyHud() {
  const el = dailyHudEl(), D = Game.daily;
  if (!D || (typeof StartMenu !== 'undefined' && StartMenu.open)) { el.classList.add('hidden'); return; }
  const P = dailyProgress(), ok = P.cur >= P.need, left = Math.max(0, DAILY_LIMIT - Game.time);
  const label = `${D.key.slice(8)}.${D.key.slice(5, 7)}`;
  const html = `<div class="dy-h">Вызов дня · ${label}${D.over ? ' <button data-dy="sum" title="Показать итог">итог</button>' : ''}</div>
    <div class="dy-g${ok ? ' ok' : ''}">${dyEsc(P.G.t)}: <b>${P.cur}/${P.need}</b></div>
    <div class="dy-t">${D.over ? `Очков: <b>${D.over.score}</b>` : `Осталось <b>${dyTime(left)}</b>`}</div>`;
  if (el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = html; }
  el.classList.remove('hidden');
}

function dailyCompare(key, score) {
  const days = dailyLoad().days, y = days[dailyShift(key, -1)];
  let streak = 0, k = key;
  while (days[k]) { streak++; k = dailyShift(k, -1); }
  let cmp;
  if (!y) cmp = 'Вчера вы не играли — сравнивать пока не с чем. Планка поставлена.';
  else if (score > y.score) cmp = `Вчера: <b>${y.score}</b> — сегодня лучше на <b>${score - y.score}</b>. Прогресс налицо.`;
  else if (score < y.score) cmp = `Вчера: <b>${y.score}</b> — сегодня хуже на <b>${y.score - score}</b>. Вчерашний вы были бодрее.`;
  else cmp = `Вчера: <b>${y.score}</b> — ровно столько же. Стабильность — признак мастерства.`;
  const week = [];
  for (let i = 6; i >= 0; i--) { const d = days[dailyShift(key, -i)]; week.push(d ? d.score : 0); }
  return { cmp, streak, week };
}

function dailyShareText() {
  const D = Game.daily, O = D && D.over;
  if (!O) return '';
  const G = dailyGoalDef(D.goal.k), name = typeof villageName === 'function' ? villageName() : '';
  const C = dailyCompare(D.key, O.best);
  return `OldGold — Вызов дня ${D.key.slice(8)}.${D.key.slice(5, 7)}${name ? ` («${name}»)` : ''}\n${G.t}: ${O.cur}/${D.goal.n}${O.res === 'goal' ? ` — выполнено за ${dyTime(O.t)}` : ''}\nОчки: ${O.score}${O.best > O.score ? ` (лучший за день — ${O.best})` : ''}\n` + C.cmp.replace(/<[^>]+>/g, '');
}

function dailyOpenSummary() {
  const D = Game.daily, O = D && D.over;
  if (!O) return;
  let el = document.getElementById('daily-modal');
  if (!el) {
    el = document.createElement('div');
    el.id = 'daily-modal';
    el.className = 'hidden';
    document.body.appendChild(el);
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-dy]');
      if (!b) return;
      if (b.dataset.dy === 'close') { el.classList.add('hidden'); if (Game.dailyWasPaused === false && !(Game.goal && Game.goal.over && Game.goal.over.res === 'lose')) setSpeed(Game.speed || 1); }
      if (b.dataset.dy === 'share') dailyShare();
    });
  }
  const G = dailyGoalDef(D.goal.k), win = O.res === 'goal', C = dailyCompare(D.key, O.best);
  const title = win ? 'Вызов дня выполнен' : O.res === 'dead' ? 'Деревня опустела' : 'Время вышло';
  const row = (k, v) => `<div><span>${k}</span><b>${v}</b></div>`;
  const max = Math.max(1, ...C.week);
  const bars = C.week.map((v, i) => `<i class="${i === 6 ? 'today' : ''}" style="height:${Math.max(4, Math.round(40 * v / max))}px" title="${v ? v + ' очков' : 'не играли'}"></i>`).join('');
  el.innerHTML = `<div class="dy-card ${win ? 'win' : 'lose'}"><h2>${title}</h2>
    <div class="dy-goal">${dyEsc(G.t)}: <b>${O.cur}/${D.goal.n}</b>${win ? ` — за ${dyTime(O.t)}` : ''}</div>
    <div class="dy-score">${O.score}<small>очков</small></div>
    <div class="dy-stats">${row('Жителей', O.pop)}${row('Зданий', O.blds)}${row('Ночей пережито', O.nights)}${row('Потеряно гномов', O.lost)}${row('Хлеба испечено', O.bread)}${row('Досок напилено', O.timber)}</div>
    <div class="dy-cmp">${C.cmp}</div>
    <div class="dy-week"><div class="dy-bars">${bars}</div><div class="dy-sub">7 дней · серия: <b>${C.streak}</b>${O.best > O.score ? ` · лучший за сегодня: <b>${O.best}</b>` : ''}</div></div>
    <div class="dy-btns"><button data-dy="share">Поделиться</button><button data-dy="close" class="primary">Играть дальше</button></div></div>`;
  Game.dailyWasPaused = !!Game.paused;
  if (!Game.paused) setSpeed(0);
  el.classList.remove('hidden');
}

function dailyShare() {
  const t = dailyShareText();
  try {
    if (navigator.share) { navigator.share({ title: 'OldGold — Вызов дня', text: t }).catch(() => {}); return; }
    if (navigator.clipboard) { navigator.clipboard.writeText(t).then(() => toast('Результат скопирован')).catch(() => toast('Не удалось скопировать')); return; }
  } catch (e) { /* нет доступа */ }
  toast('Не удалось скопировать');
}

// ---------- Меню ----------

function dailyMenuRefresh() {
  const sm = document.querySelector('#start-menu [data-sm="daily"] small');
  if (!sm) return;
  const key = dailyDateKey(), D = dailyFor(key), r = dailyLoad().days[key], G = dailyGoalDef(D.goal.k);
  sm.textContent = r ? `сегодня: ${r.score} очков${r.done ? ', цель выполнена' : ''} — попробовать ещё` : `${G.t.toLowerCase()} ${D.goal.n}, 15 минут, карта одна на всех`;
}

// ---------- Подключение ----------
{
  const _step = step;
  step = function (dt) { _step(dt); try { dailyTick(dt); } catch (e) { console.error(e); } };
  const _rgs = resetGameState;
  resetGameState = function () { _rgs(); Game.daily = null; };
  const _sg = serializeGame;
  serializeGame = function () { const s = _sg(); if (Game.daily) { const o = Object.assign({}, Game.daily); delete o.acc; s.daily = o; } return s; };
  const _as = applySave;
  applySave = function (s) {
    _as(s);
    Game.daily = s.daily && s.daily.goal && s.daily.key ? s.daily : null;
    if (typeof document !== 'undefined' && document.getElementById) { try { dailyHud(); } catch (e) { /* без интерфейса */ } }
  };
  if (typeof smAction === 'function') {
    const _act = smAction;
    smAction = function (a) { if (a === 'daily') { dailyStart(); return; } _act(a); };
    const _init = initStartMenu;
    initStartMenu = function () {
      _init();
      const main = document.querySelector('#start-menu [data-panel="main"]'), nb = main && main.querySelector('[data-sm="new"]');
      if (main && nb && !main.querySelector('[data-sm="daily"]')) {
        const b = document.createElement('button');
        b.className = 'sm-btn'; b.dataset.sm = 'daily';
        b.innerHTML = '<b>Вызов дня</b><small></small>';
        nb.insertAdjacentElement('afterend', b);
      }
      dailyMenuRefresh();
    };
  }
}

window.Daily = { for: dailyFor, key: dailyDateKey, start: dailyStart, score: dailyScore, progress: dailyProgress, finish: dailyFinish, limit: DAILY_LIMIT };

window.addEventListener('load', () => {
  setInterval(() => { try { dailyHud(); } catch (e) { /* без интерфейса */ } }, 500);
  document.addEventListener('click', e => {
    if (e.target.closest && e.target.closest('[data-daily]')) {
      if (Game.daily && !Game.daily.over && !confirm('Начать вызов дня заново? Несохранённый прогресс пропадёт.')) return;
      if (!Game.daily && !confirm('Начать вызов дня? Текущая деревня закроется — сохраните её заранее.')) return;
      if (typeof Mobile !== 'undefined' && Mobile.on && typeof mobileSheet === 'function') mobileSheet(null);
      dailyStart();
    }
  });
});
