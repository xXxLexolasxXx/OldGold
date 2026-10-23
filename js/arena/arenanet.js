'use strict';
// Арена онлайн — клиент (АРЕНА.md, этап 3). Подключается после arena.js и работает по сокету общей деревни (Coop.ws).
// Бой считает сервер (server/arena.js). Клиент получает ВХОДЫ обоих игроков по тактам (кадры, 10 раз в секунду)
// и крутит то же ядро arenasim.js; раз в секунду приходит полный снимок — по хэшу видно расхождение и оно гасится.
// Свой ввод уходит на сервер 20 раз в секунду и применяется на такте сервера: между нажатием и движением на экране
// проходит время связи плюс буфер в два такта (около 100–150 мс) — предсказания движения нет, зато бой у обоих игроков один и тот же.
// Очередь: подбор по Эло; через 20 секунд без соперника предлагается бот (кнопкой, с отсчётом 10 с). Вызов друга — по коду.

const ArenaNet = { st: null, board: null, wait: null, code: '', err: '', end: null, snap: null, pause: 0, sendT: 0, lastIn: null, lastInAt: 0, botT: 0 };
const AN_BUF = 2;   // сколько кадров держим запаса перед шагом (глушит дрожание связи)

const arNetAvail = () => typeof Coop !== 'undefined' && !!Coop.on && !!Coop.ws && Coop.ws.readyState === 1;
function arNetSend(o) { if (arNetAvail()) coopSend(Object.assign({ t: 'arena' }, o)); }
function arNetHello() { ArenaNet.err = ''; if (arNetAvail()) arNetSend({ a: 'hello' }); }
const arLeagueName = i => (typeof AR_LEAGUES !== 'undefined' && AR_LEAGUES[i] ? AR_LEAGUES[i][0] : '');
const arLeagueCol = i => (typeof AR_LEAGUES !== 'undefined' && AR_LEAGUES[i] ? AR_LEAGUES[i][1] : '#e8dcc0');

// ---------- Экран арены: онлайн-блок ----------
function arNetLobbyHtml() {
  const me = ArenaNet.st && ArenaNet.st.me, ok = arNetAvail();
  const lg = me ? `<span class="ar-lg" style="--c:${arLeagueCol(me.lg)}">${arEsc(t('Лига «{0}»', t(arLeagueName(me.lg))))}</span> · ${t('рейтинг {0}', me.elo)} · ${t('боёв {0}, побед {1}', me.games, me.wins)}` : t('Рейтинг появится после первого боя');
  const dis = ok ? '' : ' disabled';
  return `<h3>${t('Онлайн')}</h3>
    <div class="ar-info">${ok ? lg : t('Онлайн-бои идут в общей деревне: войдите в неё через меню (Общая деревня), потом откройте арену.')}</div>
    <div class="ar-soon on"><button data-ar="onq"${dis}>${t('Рейтинговый бой')}</button><button data-ar="oinv"${dis}>${t('Вызвать друга')}</button>
      <input id="ar-code" maxlength="6" inputmode="numeric" placeholder="${t('Код вызова')}"${dis}><button data-ar="oacc"${dis}>${t('Принять')}</button>
      <button data-ar="obrd"${dis}>${t('Таблица и лиги')}</button></div>
    ${ArenaNet.err ? `<div class="ar-note pot">${arEsc(ArenaNet.err)}</div>` : ''}`;
}
function arNetClick(k, v, b) {
  const cls = Arena.cls;
  if (k === 'onq') { ArenaNet.err = ''; arNetSend({ a: 'queue', cls }); }
  else if (k === 'oinv') { ArenaNet.err = ''; arNetSend({ a: 'invite', cls }); }
  else if (k === 'oacc') { const c = Arena.el.querySelector('#ar-code'); ArenaNet.err = ''; arNetSend({ a: 'accept', code: c ? c.value : '', cls }); }
  else if (k === 'obrd') { ArenaNet.board = null; arNetSend({ a: 'board' }); arNetScreen('board'); }
  else if (k === 'oleave') { arNetLeave(); arLobby(); }
  else if (k === 'obot') { arNetLeave(); arStart(false); }
  else if (k === 'oforget') { if (b.dataset.sure) { arNetSend({ a: 'forget' }); setTimeout(() => arNetSend({ a: 'board' }), 200); } else { b.dataset.sure = '1'; b.textContent = t('Точно удалить рейтинг и историю боёв? Нажмите ещё раз'); } }
  else if (k === 'ohide') { arNetSend({ a: 'hide', on: !(ArenaNet.board && ArenaNet.board.me && ArenaNet.board.me.hide) }); setTimeout(() => arNetSend({ a: 'board' }), 200); }
  void v;
}
function arNetLeave(quiet) {
  if (!arNetAvail()) return;
  if (ArenaNet.wait || ArenaNet.code) arNetSend({ a: 'leave' });
  ArenaNet.wait = null; ArenaNet.code = ''; ArenaNet.botT = 0;
  void quiet;
}
// «Ещё бой»: снова в очередь с тем же классом (рейтинговый) — или вызов остаётся за игроками
function arNetAgain() { Arena.net = null; arLobby(); arNetSend({ a: 'queue', cls: Arena.cls }); }

// ---------- Экраны: ожидание, вызов, таблица ----------
function arNetScreen(scr) {
  Arena.scr = scr; Arena.S = null;
  const P = Arena.el.querySelector('#ar-panel');
  for (const id of ['#ar-hud', '#ar-sur', '#ar-joy', '#ar-bar']) Arena.el.querySelector(id).classList.add('hidden');
  P.className = 'ar-lobby';
  arNetScreenRender();
}
function arNetScreenRender() {
  if (!Arena.el) return;
  const P = Arena.el.querySelector('#ar-panel'), scr = Arena.scr;
  if (scr === 'queue') {
    const w = ArenaNet.wait || { s: 0, n: 1, w: 100 };
    let tail = t('Окно подбора по рейтингу: ±{0}. В очереди: {1}.', w.w, w.n);
    if (ArenaNet.botT) tail = t('Соперника нет. Бот-дуэлянт выйдет через {0} с — рейтинг в этом бою не меняется.', Math.max(0, Math.ceil(ArenaNet.botT - performance.now() / 1000)));
    P.innerHTML = `<div class="ar-card small"><h2>${t('Ищем соперника…')}</h2><div class="ar-score">${w.s} ${t('с')}</div>
      <div class="ar-note">${arEsc(tail)}</div>
      <div class="ar-go"><button class="ar-b sec" data-ar="oleave">${t('Отмена')}</button>${ArenaNet.botT ? `<button class="ar-b" data-ar="obot">${t('Бот сейчас')}</button>` : ''}</div></div>`;
  } else if (scr === 'invite') {
    P.innerHTML = `<div class="ar-card small"><h2>${t('Вызов друга')}</h2><div class="ar-score">${arEsc(ArenaNet.code)}</div>
      <div class="ar-note">${t('Назовите код другу: он вводит его на экране арены и жмёт «Принять». Код живёт 10 минут. Бой дружеский — рейтинг не меняется.')}</div>
      <div class="ar-go"><button class="ar-b sec" data-ar="oleave">${t('Отмена')}</button></div></div>`;
  } else if (scr === 'board') {
    const B = ArenaNet.board;
    const rows = B ? B.top.map((r, i) => `<tr><td>${i + 1}</td><td><b>${arEsc(r.nick)}</b></td><td style="color:${arLeagueCol(r.lg)}">${arEsc(t(arLeagueName(r.lg)))}</td><td>${r.elo}</td><td>${r.wins}/${r.games}</td><td style="color:${arClsCol(r.cls)}">${r.cls ? arEsc(arClsName(r.cls)) : ''}</td></tr>`).join('') : '';
    const mine = B && B.me ? `${t('Вы: рейтинг {0}, лига «{1}»', B.me.elo, t(arLeagueName(B.me.lg)))}${B.place ? ' · ' + t('место {0}', B.place) : ''}` : '';
    P.innerHTML = `<div class="ar-card"><div class="ar-top"><h2>${t('Таблица лидеров')}</h2><button class="ar-x" data-ar="oleave" title="${t('Назад')}">✕</button></div>
      <div class="ar-sub">${arEsc(mine)}</div>
      ${B ? (B.top.length ? `<table class="ar-tab"><tr><th>#</th><th>${t('Ник')}</th><th>${t('Лига')}</th><th>${t('Рейтинг')}</th><th>${t('Победы')}</th><th>${t('Любимый класс')}</th></tr>${rows}</table>` : `<div class="ar-note">${t('Пока никто не сыграл рейтинговый бой. Займите первое место.')}</div>`) : `<div class="ar-note">${t('Загрузка…')}</div>`}
      <div class="ar-go"><button class="ar-b sec" data-ar="ohide">${B && B.me && B.me.hide ? t('Показывать меня в таблице') : t('Не показывать меня в таблице')}</button></div>
      <div class="ar-keys">${t('Таблица публична: ник, лига и рейтинг видны всем игрокам. Скрыть себя можно кнопкой выше.')} <button class="ar-lnk" data-ar="oforget">${t('Удалить мои данные арены')}</button></div></div>`;
  }
}

// ---------- Сообщения сервера (из coopHandle: case 'arena') ----------
function arenaNetIn(m) {
  const N = ArenaNet;
  switch (m.a) {
    case 'state': N.st = m; if (Arena.on && Arena.scr === 'lobby') arLobbyRender(); break;
    case 'err': N.err = String(m.msg || ''); N.wait = null; if (Arena.on && (Arena.scr === 'queue' || Arena.scr === 'invite')) arLobby(); else if (Arena.on && Arena.scr === 'lobby') arLobbyRender(); break;
    case 'queued': if (!Arena.on) arenaOpen('net'); N.err = ''; N.wait = { s: 0, n: m.n, w: 100 }; N.botT = 0; arNetScreen('queue'); break;
    case 'wait': {
      N.wait = m;
      if (m.bot && !N.botT) N.botT = performance.now() / 1000 + 10;
      if (Arena.on && Arena.scr === 'queue') arNetScreenRender();
      break;
    }
    case 'invite': N.code = m.code; arNetScreen('invite'); break;
    case 'left': N.wait = null; N.code = ''; break;
    case 'board': N.board = m; if (Arena.on && Arena.scr === 'board') arNetScreenRender(); break;
    case 'go': arNetStart(m); break;
    case 'f': if (Arena.net) for (const f of m.f) Arena.net.q.push(f); break;
    case 's': if (Arena.net) Arena.net.snap = m.s; break;
    case 'pause': if (Arena.net) { Arena.net.pause = performance.now() / 1000 + m.left; Arena.net.pauseWho = m.who; } break;
    case 'resume': if (Arena.net) Arena.net.pause = 0; break;
    case 'end': arNetEnd(m); break;
  }
}

// ---------- Бой ----------
const arNetUnpack = v => (v ? { mx: v[0] / 100, my: v[1] / 100, cast: v[2], roll: v[3], aim: v[4] || v[5] ? [v[4] / 10, v[5] / 10] : null } : null);
function arNetStart(m) {
  if (m.proto !== ARENA_PROTO || m.tune !== ARENA_TUNE.v) { ArenaNet.err = t('Версия арены на сервере другая: обновите страницу.'); if (Arena.on) arLobby(); return; }
  if (!Arena.on) arenaOpen('net');
  if (!Arena.el) return;
  const rejoin = !!Arena.net && Arena.scr === 'fight';
  Arena.mi = m.me; Arena.cls = m.cls[m.me]; Arena.foe = m.cls[1 - m.me];
  Arena.S = JSON.parse(JSON.stringify(m.snap));
  Arena.net = { q: [], snap: null, nm: m.nm.slice(), rated: !!m.rated, hold: true, end: null, pause: 0, pauseWho: -1, sendT: 0, last: null, lastAt: 0 };
  ArenaNet.wait = null; ArenaNet.code = ''; ArenaNet.botT = 0; ArenaNet.end = null;
  Arena.prev = Arena.S.f.map(F => [F.x, F.y]);
  Arena.acc = 0; Arena.cast = -1; Arena.roll = 0; Arena.pops = []; Arena.fx = []; Arena.burst = [null, null]; Arena.seenOver = false; Arena.endT = 0; Arena.ct = Arena.S.T;
  Arena.surT = 0; Arena.pot = -1;
  const hash = String(m.nm[1 - m.me] || '').split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const me = arMyLook(Arena.cls), foe = { type: OUTFIT['hero_' + Arena.foe] ? 'hero_' + Arena.foe : 'hero', look: 3 + (hash % 40), sx: '', carry: null };
  Arena.holders = m.me === 0 ? [me, foe] : [foe, me];
  Arena.scr = 'fight';
  const P = Arena.el.querySelector('#ar-panel'); P.innerHTML = ''; P.className = '';
  for (const id of ['#ar-hud', '#ar-sur', '#ar-bar', '#ar-brum']) Arena.el.querySelector(id).classList.remove('hidden');
  Arena.el.querySelector('#ar-joy').classList.toggle('hidden', !Arena.touch);
  Arena.el.querySelector('#ar-sur').textContent = t('Сдаться');
  arBarBuild(); arHud(true);
  if (!rejoin) {
    arBrumSay(arPick(AR_BRUM.intro, `${arName(0)} (${arClsName(Arena.S.f[0].cls)})`, `${arName(1)} (${arClsName(Arena.S.f[1].cls)})`));
    arFansReact(Arena.fans, 'cheer', Arena.ct, 0.6); ASfx.play('crowd', 0.8);
  }
}
// шаг ядра по кадрам с сервера; ввод игрока уходит на сервер 20 раз в секунду
function arNetPump(dt) {
  const N = Arena.net, T = ARENA_TUNE;
  if (!N || !Arena.S) return;
  const now = performance.now() / 1000;
  // вход
  N.sendT += dt;
  if (Arena.scr === 'fight') {
    while (N.sendT >= T.dt) {
      N.sendT -= T.dt;
      const inp = arInput();
      const key = `${inp.mx.toFixed(2)},${inp.my.toFixed(2)}`;
      if (inp.cast >= 0 || inp.roll || key !== N.last || now - N.lastAt > 0.2) {
        arNetSend({ a: 'in', mx: +inp.mx.toFixed(2), my: +inp.my.toFixed(2), cast: inp.cast, roll: inp.roll });
        N.last = key; N.lastAt = now;
      }
    }
  } else N.sendT = 0;
  // пауза соперника
  const msg = Arena.el.querySelector('#ar-msg');
  if (N.pause) {
    const left = Math.max(0, Math.ceil(N.pause - now));
    msg.textContent = N.pauseWho === Arena.mi ? t('Связь потеряна…') : t('Соперник потерял связь: {0}', left);
    Arena.prev = Arena.S.f.map(F => [F.x, F.y]);
    return;
  }
  // шаги: накопитель по 20 Гц, при запасе кадров больше шести — ускоряем, при пустой очереди ждём AN_BUF кадров
  if (N.hold) { if (N.q.length >= AN_BUF) N.hold = false; else { Arena.acc = 0; return; } }
  // отстали (вкладка была в фоне, связь «дёрнулась»): сильно — перематываем тихо, без звуков и надписей; чуть — идём быстрее
  if (N.q.length > 40) {
    let S = Arena.S;
    while (N.q.length > 8) { const f = N.q.shift(); if (f[0] !== S.tick + 1) { if (f[0] <= S.tick) continue; N.q.unshift(f); break; } arenaStep(S, [arNetUnpack(f[1]), arNetUnpack(f[2])]); }
    S.ev = []; Arena.prev = S.f.map(F => [F.x, F.y]); Arena.pops = []; Arena.fx = []; Arena.acc = 0;
  }
  Arena.acc += dt * (N.q.length > 6 ? Math.min(4, 1 + (N.q.length - 6) / 6) : 1);
  let n = 0;
  while (Arena.acc >= T.dt && n < 6) {
    let S = Arena.S;
    // сверка со снимком сервера: на том же такте хэш обязан совпасть, иначе берём снимок
    if (N.snap) {
      if (N.snap.tick === S.tick) { if (arenaHash(N.snap) !== arenaHash(S)) { Arena.S = S = JSON.parse(JSON.stringify(N.snap)); N.resync = (N.resync || 0) + 1; } N.snap = null; }
      else if (N.snap.tick < S.tick) N.snap = null;
      else if (N.q.length && N.q[0][0] > S.tick + 1) { Arena.S = S = JSON.parse(JSON.stringify(N.snap)); N.snap = null; N.resync = (N.resync || 0) + 1; }
    }
    while (N.q.length && N.q[0][0] <= S.tick) N.q.shift();
    if (!N.q.length) { N.hold = true; Arena.acc = 0; break; }
    const f = N.q.shift();
    if (f[0] !== S.tick + 1) { N.q.unshift(f); N.hold = true; break; }
    Arena.prev = S.f.map(F => [F.x, F.y]);
    arenaStep(S, [arNetUnpack(f[1]), arNetUnpack(f[2])]);
    arEvents(S);
    Arena.acc -= T.dt; n++;
  }
  if (n >= 6) Arena.acc = 0;
}
function arNetEnd(m) {
  const N = Arena.net; ArenaNet.end = m;
  if (ArenaNet.st) ArenaNet.st.me = m.me || ArenaNet.st.me;
  if (!Arena.on || !N || !Arena.S) return;
  if (Arena.scr === 'result') { arResult(); return; }   // итог пришёл позже, чем кончился бой на экране
  const S = Arena.S;
  // техническое поражение, отмена или сдача: ядро само до конца не доиграет — ставим итог
  if (S.phase !== 'over' && m.w >= 0) {
    S.winner = m.w; S.phase = 'over'; S.score = (m.score || S.score).slice(); if (m.sur >= 0) S.sur = m.sur;
    N.q.length = 0;
    arEvents(Object.assign(S, { ev: [{ k: 'won', w: m.w, sur: m.sur >= 0 ? 1 : 0 }] }));
  } else if (m.w < 0 || m.cancel) {
    ArenaNet.err = t('Бой прерван, рейтинг не тронут.');
    Arena.net = null; arLobby();
  }
}
function arNetResultHtml(won) {
  const m = ArenaNet.end;
  if (!m) return `<div class="ar-note">${t('Считаем итог…')}</div>`;
  const me = m.me || {}, lg = arLeagueName(me.lg);
  let line = '';
  if (m.rated) line = `<div class="ar-note ${won ? '' : 'pot'}"><b>${t('Рейтинг')}: ${me.elo} (${m.d > 0 ? '+' : ''}${m.d})</b> · ${t('лига «{0}»', t(lg))}</div>`;
  else if (!Arena.net.rated) line = `<div class="ar-note">${t('Дружеский бой: рейтинг не меняется.')}</div>`;
  else if (m.why === 'pair') line = `<div class="ar-note">${t('С этим соперником уже три рейтинговых боя за час: этот — дружеский.')}</div>`;
  else if (m.why === 'fast') line = `<div class="ar-note">${t('Сдача в начале боя рейтинг не двигает.')}</div>`;
  else if (m.why === 'ip') line = `<div class="ar-note">${t('Бой двух окон с одного адреса рейтинг не двигает.')}</div>`;
  const tech = m.tech ? `<div class="ar-note">${won ? t('Соперник не вернулся: техническая победа.') : t('Вы не вернулись вовремя: техническое поражение.')}</div>` : '';
  return line + tech + (won ? '' : `<div class="ar-note pot">${t('Вам вручён Позорный горшок: носить один бой.')}</div>`);
}
// отсчёт бота в очереди (экран ожидания обновляется раз в секунду)
setInterval(() => {
  if (typeof Arena === 'undefined' || !Arena.on || Arena.scr !== 'queue') return;
  if (ArenaNet.botT && performance.now() / 1000 >= ArenaNet.botT) { arNetClick('obot'); return; }
  if (ArenaNet.botT) arNetScreenRender();
}, 500);
