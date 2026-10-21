'use strict';
// Анонимная статистика «Помочь улучшить игру» и кнопка «Сообщить о проблеме».
// Подключается сразу после js/crashlog.js (чтобы журнал консоли копился с первых строк).
//  · Статистика ВКЛЮЧАЕТСЯ ТОЛЬКО С СОГЛАСИЯ: при первом запуске игра спрашивает, по умолчанию выключено,
//    переключатель — в боковом меню. Раз в минуту и на ключевых событиях уходит короткая запись (POST /t):
//    версия, телефон/ПК, экран, FPS, игровые сутки, жители, класс героя, одиночка/кооп, отчего погибла деревня/герой,
//    что строят, на каком экране закончили, ошибки. Id установки — случайный (feod.tid), с человеком не связан.
//    На localhost / file: / локальной сети ничего не отправляется.
//  · «Сообщить о проблеме»: строка от игрока + снимок экрана + последние 200 строк консоли и журнал сбоев,
//    версия, устройство, id и (по галочке) сохранение → POST /report. Это не статистика, а явное действие игрока.
//  · «Удалить мои данные»: POST /t/forget — сервер стирает записи и отчёты с этим id, у игрока id меняется.

// feod.consent: с 0.10.107 спрашиваем заново всех (в 0.10.102 статистика была включена без вопроса, старый ключ feod.tele не считается согласием)
const TELE_KEY = 'feod.consent', TELE_ID = 'feod.tid', TELE_Q = 'feod.telq';
const Tele = { lines: [], sid: '', t0: Date.now(), q: [], built: {}, errs: 0, errSent: 0, lastEv: '', hurt: '', deaths: {}, vdead: false, busy: false, next: 0, fails: 0 };

// ---- журнал консоли: последние 200 строк (для отчёта о проблеме; сам по себе никуда не уходит)
(function () {
  const keep = (lv, args) => {
    let s = '';
    try { s = Array.from(args, a => typeof a === 'string' ? a : a instanceof Error ? (a.stack || a.message) : JSON.stringify(a)).join(' '); } catch (e) { s = String(args[0]); }
    Tele.lines.push(new Date().toISOString().slice(11, 19) + ' ' + lv + ' ' + s.slice(0, 500));
    if (Tele.lines.length > 200) Tele.lines.splice(0, Tele.lines.length - 200);
  };
  for (const lv of ['log', 'info', 'warn', 'error']) {
    const orig = console[lv];
    if (typeof orig !== 'function') continue;
    console[lv] = function () { keep(lv, arguments); return orig.apply(console, arguments); };
  }
  // ошибки из журнала сбоев — тоже в консольный журнал и в счётчик статистики
  if (typeof crashNote === 'function') {
    const _cn = crashNote;
    crashNote = function (kind, msg, src, stack) {
      keep('ERR', [`[${kind}] ${msg} ${src || ''}`]);
      Tele.errs++;
      if (Tele.errSent < 3 && kind !== 'save') { Tele.errSent++; teleEvent('err', { ek: String(kind).slice(0, 10), m: typeof crashScrub === 'function' ? crashScrub(msg).slice(0, 160) : '', f: typeof crashScrub === 'function' ? crashScrub(src).slice(0, 80) : '' }); }
      return _cn(kind, msg, src, stack);
    };
  }
})();

function teleGet(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
function teleSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* хранилище недоступно */ } }
function teleRand(n) {
  const a = new Uint8Array(n); let s = '';
  try { crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < n; i++) a[i] = Math.random() * 256; }
  for (const x of a) s += (x % 36).toString(36);
  return s;
}
Tele.sid = teleRand(8);

// своя машина, локальная сеть или файл — разработка: статистику не шлём и не спрашиваем
function teleLocal() {
  const h = (typeof location !== 'undefined' && location.hostname) || '';
  return location.protocol === 'file:' || /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|0\.0\.0\.0|)$/.test(h) || /\.(localhost|local|test)$/.test(h)
    || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h);
}
function teleState() { const s = teleGet(TELE_KEY, null); return s && typeof s === 'object' ? s : { on: false, asked: 0 }; }
function teleOn() { return !teleLocal() && teleState().on === true; }
// игрок сам сказал «нет» — тогда и воронка с id (stats.js, POST /e) не отправляется
function teleDeclined() { const s = teleState(); return !!s.asked && s.on === false; }
function teleSetOn(on) {
  teleSet(TELE_KEY, { on: !!on, asked: Date.now() });
  if (on) teleEvent('start', teleSnap());
  teleMenuSync();
}
function teleId() {
  let id = teleGet(TELE_ID, '');
  if (!/^[a-z0-9]{12,32}$/.test(id)) { id = teleRand(16); teleSet(TELE_ID, id); }
  return id;
}

function teleUrl(p) {
  const h = typeof coopDefaultServer === 'function' ? coopDefaultServer() : '';
  return h && typeof coopHttpUrl === 'function' ? coopHttpUrl(h).replace(/\/+$/, '') + p : '';
}
function teleDev() {
  const d = typeof crashDevice === 'function' ? crashDevice() : { mob: 0, br: '', os: '' };
  const mob = (typeof Mobile !== 'undefined' && Mobile.on) || d.mob;
  return { dev: mob ? 'phone' : 'pc', scr: `${screen.width}x${screen.height}`, br: d.br, os: d.os };
}
function teleMode() { return typeof Coop !== 'undefined' && Coop.on ? 'coop' : 'solo'; }
function teleDay() {
  try { return typeof cycleAt === 'function' && typeof Game !== 'undefined' ? cycleAt(Game.time).k + 1 : 0; } catch (e) { return 0; }
}
function teleSnap() {
  const G = typeof Game !== 'undefined' ? Game : null, h = G && G.hero && G.hero.hero;
  let pop = 0;
  try { pop = typeof goalAlive === 'function' ? goalAlive() : (G ? G.units.length : 0); } catch (e) { /* мир ещё не создан */ }
  return {
    fps: typeof Fps !== 'undefined' && Fps.fps ? Math.round(Fps.fps) : 0, day: teleDay(), pop, gt: G ? Math.round(G.time || 0) : 0,
    cls: h ? String(h.cls || 'none').slice(0, 20) : '', ph: typeof crashPhase === 'function' ? crashPhase() : '',
  };
}

function teleEvent(k, data) {
  if (!teleOn()) return;
  Tele.q.push({ k, t: Math.round((Date.now() - Tele.t0) / 1000), mode: teleMode(), ...data });
  if (Tele.q.length > 60) Tele.q.splice(0, Tele.q.length - 60);
}

function teleBody(evs) {
  const d = teleDev();
  return JSON.stringify({ id: teleId(), s: Tele.sid, v: typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : '?', dev: d.dev, scr: d.scr, ev: evs });
}

// last — закрытие вкладки: уходит маяком вместе с отложенным
function teleFlush(last) {
  if (!teleOn()) { Tele.q.length = 0; return; }
  const url = teleUrl('/t');
  if (!url) return;
  const pend = teleGet(TELE_Q, []);
  const evs = (Array.isArray(pend) ? pend : []).concat(Tele.q).slice(-60);
  Tele.q.length = 0;
  if (!evs.length) return;
  const body = teleBody(evs);
  if (last === true) {
    let ok = false;
    try { ok = navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' })); } catch (e) { ok = false; }
    teleSet(TELE_Q, ok ? [] : evs.slice(-30));
    return;
  }
  if (Tele.busy || Date.now() < Tele.next) { teleSet(TELE_Q, evs.slice(-30)); return; }
  Tele.busy = true;
  teleSet(TELE_Q, []);
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  const to = setTimeout(() => ac && ac.abort(), 8000);
  fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'text/plain' }, keepalive: body.length < 60000, signal: ac ? ac.signal : undefined })
    .then(r => { if (!r.ok) throw new Error(r.status); Tele.fails = 0; })
    .catch(() => { Tele.fails++; Tele.next = Date.now() + Math.min(600000, 60000 * Tele.fails); teleSet(TELE_Q, evs.slice(-30)); })
    .finally(() => { clearTimeout(to); Tele.busy = false; });
}

// раз в минуту: короткий снимок (только когда идёт игра и вкладка на экране)
function teleBeat() {
  if (!teleOn() || document.hidden) return;
  const s = teleSnap();
  if (s.ph === 'game' || s.ph === 'coop') {
    teleEvent('beat', { ...s, b: Tele.built, e: Tele.errs });
    Tele.built = {}; Tele.errs = 0;
  }
  teleFlush();
}

// ---- игровые события: стройка, гибель жителей, деревни и героя, последнее действие игрока
function teleHooks() {
  if (typeof track === 'function') {
    const _t = track;
    track = function (name, title) { Tele.lastEv = String(name).slice(0, 40); return _t(name, title); };
  }
  if (typeof placeBuilding === 'function') {
    const _pb = placeBuilding;
    placeBuilding = function (type, x, y, done, rot) {
      const b = _pb.apply(this, arguments);
      if (!done && typeof Game !== 'undefined' && Game.time > 0 && b) {
        const k = String(type).slice(0, 24);
        if (Object.keys(Tele.built).length < 30 || Tele.built[k]) Tele.built[k] = (Tele.built[k] || 0) + 1;
      }
      return b;
    };
  }
  if (typeof logEvent === 'function') {
    const _le = logEvent;
    logEvent = function (kind, text) { if (/утащил|погиб|умер|убит|замёрз|отомстили/i.test(String(text))) Tele.lastDeath = { text: String(text), t: Game.time }; return _le.apply(this, arguments); };
  }
  if (typeof removeUnit === 'function') {
    const _rm = removeUnit;
    removeUnit = function (u) {
      const was = u && u.dead;
      _rm.apply(this, arguments);
      try {
        if (u && !was && u.dead && typeof isPerson === 'function' && isPerson(u) && u.type !== 'carter' && u.type !== 'hero') {
          const d = Tele.lastDeath && Math.abs(Game.time - Tele.lastDeath.t) < 2 ? Tele.lastDeath.text : '';
          const c = u.food <= 0 && !u.noFood ? 'starve' : /скелет/i.test(d) ? 'skeleton' : /туман/i.test(d) ? 'fog' : /кур/i.test(d) ? 'chickens'
            : /мороз|замёрз/i.test(d) ? 'cold' : (typeof isNightNow === 'function' && isNightNow()) ? 'night' : 'other';
          Tele.deaths[c] = (Tele.deaths[c] || 0) + 1;
        }
      } catch (e) { /* статистика не должна ломать игру */ }
    };
  }
  if (typeof hlHurt === 'function') {
    const _h = hlHurt;
    hlHurt = function (u, n, why) { if (why) Tele.hurt = String(why === true ? 'event' : why).slice(0, 30); return _h.apply(this, arguments); };
  }
  if (typeof hlDown === 'function') {
    const _d = hlDown;
    hlDown = function (u) {
      try { const H = u && u.hero; teleEvent('hdeath', { why: Tele.hurt || 'unknown', day: teleDay(), lvl: H ? H.level || 0 : 0, cls: H ? String(H.cls || 'none') : '' }); } catch (e) { /* ничего */ }
      return _d.apply(this, arguments);
    };
  }
  if (typeof goalFinish === 'function') {
    const _gf = goalFinish;
    goalFinish = function (res) {
      try {
        const S = typeof goalStats === 'function' ? goalStats() : {};
        teleEvent(res === 'win' ? 'win' : 'vdeath', { day: teleDay(), nights: S.nights || 0, maxPop: S.maxPop || 0, blds: S.blds || 0, causes: Tele.deaths, gt: Math.round(Game.time || 0) });
        teleFlush();
      } catch (e) { /* ничего */ }
      return _gf.apply(this, arguments);
    };
  }
}

// ---- согласие: маленькая карточка при первом запуске (один раз)
function teleAsk() {
  if (teleLocal() || teleState().asked || document.getElementById('tele-ask')) return;
  const box = document.createElement('div');
  box.id = 'tele-ask';
  box.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:100000;max-width:min(440px,calc(100vw - 32px));padding:12px 14px;background:#2a1e14;color:#f3e6c8;border:2px solid #a8743a;border-radius:8px;font:14px/1.4 sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.5)';
  box.innerHTML = '<b>Помочь улучшить игру?</b><div style="margin:6px 0 10px">Игра будет раз в минуту отправлять короткую анонимную сводку: версия, телефон или компьютер, кадры в секунду, сутки, жители, ошибки. '
    + 'Без ника, имени и сохранений. Выключить можно в меню в любой момент.</div>'
    + '<div style="display:flex;gap:8px;justify-content:flex-end"><button data-a="no" style="padding:6px 12px">Нет, спасибо</button><button data-a="yes" style="padding:6px 12px;font-weight:bold">Да, помогу</button></div>';
  box.onclick = e => {
    const a = e.target && e.target.getAttribute && e.target.getAttribute('data-a');
    if (!a) return;
    teleSetOn(a === 'yes');
    box.remove();
    if (typeof toast === 'function') toast(a === 'yes' ? 'Спасибо! Статистику можно выключить в меню' : 'Хорошо, ничего не отправляем');
  };
  document.body.appendChild(box);
}

// ---- «Сообщить о проблеме»
function teleShot() {
  try {
    const cv = document.getElementById('game');
    if (!cv || !cv.width) return '';
    const k = Math.min(1, 1280 / cv.width), c = document.createElement('canvas');
    c.width = Math.round(cv.width * k); c.height = Math.round(cv.height * k);
    c.getContext('2d').drawImage(cv, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.72);
  } catch (e) { return ''; }
}

function teleReportBody(text, withSave, shot) {
  const d = teleDev();
  let save = '';
  if (withSave && teleMode() === 'solo' && typeof serializeGame === 'function') {
    try { save = JSON.stringify(serializeGame()); } catch (e) { save = ''; }
    if (save.length > 6e6) save = '';
  }
  return JSON.stringify({
    id: teleId(), v: typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : '?', dev: d.dev, scr: d.scr, br: d.br, os: d.os, mode: teleMode(),
    text: String(text || '').slice(0, 1000), snap: teleSnap(), last: Tele.lastEv,
    log: Tele.lines.slice(-200), crash: typeof crashLogText === 'function' ? (() => { try { return crashLogText(); } catch (e) { return ''; } })() : '',
    shot: shot === undefined ? teleShot() : shot, save,
  });
}

function teleReport() {
  if (document.getElementById('tele-rep')) return;
  const wasPaused = typeof Game !== 'undefined' && Game.paused;
  const shot = teleShot();   // снимаем до того, как окно закроет игру
  const box = document.createElement('div');
  box.id = 'tele-rep';
  box.style.cssText = 'position:fixed;inset:0;z-index:100001;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55)';
  box.innerHTML = '<div style="width:min(480px,calc(100vw - 32px));padding:14px;background:#2a1e14;color:#f3e6c8;border:2px solid #a8743a;border-radius:8px;font:14px/1.4 sans-serif">'
    + '<b>Сообщить о проблеме</b><div class="small" style="margin:4px 0 8px;opacity:.85">Что случилось? Вместе с текстом уйдут снимок экрана, журнал ошибок и консоли, версия и устройство. Без ника и пароля.</div>'
    + '<textarea id="tele-rep-t" maxlength="1000" rows="3" style="width:100%;box-sizing:border-box;font:14px sans-serif" placeholder="Например: гномы перестали носить камень"></textarea>'
    + (shot ? `<img src="${shot}" alt="" style="display:block;max-width:100%;max-height:120px;margin:8px auto;border:1px solid #a8743a">` : '')
    + `<label style="display:flex;gap:6px;align-items:center;margin:6px 0"><input type="checkbox" id="tele-rep-s"${teleMode() === 'solo' ? '' : ' disabled'}> Приложить сохранение (поможет повторить)</label>`
    + '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px"><button data-a="x" style="padding:6px 12px">Отмена</button><button data-a="send" style="padding:6px 12px;font-weight:bold">Отправить</button></div></div>';
  if (typeof Game !== 'undefined') Game.paused = true;
  const close = () => { box.remove(); if (typeof Game !== 'undefined') Game.paused = wasPaused; };
  box.onclick = e => {
    const a = e.target && e.target.getAttribute && e.target.getAttribute('data-a');
    if (e.target === box || a === 'x') return close();
    if (a !== 'send') return;
    const text = document.getElementById('tele-rep-t').value.trim();
    if (!text) { document.getElementById('tele-rep-t').focus(); return; }
    e.target.disabled = true; e.target.textContent = 'Отправляю…';
    teleSendReport(text, document.getElementById('tele-rep-s').checked, shot).then(msg => { close(); if (typeof toast === 'function') toast(msg); });
  };
  document.body.appendChild(box);
  setTimeout(() => { const t = document.getElementById('tele-rep-t'); if (t) t.focus(); }, 50);
}

function teleSendReport(text, withSave, shot) {
  const url = teleUrl('/report');
  if (!url) return Promise.resolve('Сервер для отчётов не настроен');
  const body = teleReportBody(text, withSave, shot);
  return fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'text/plain' } })
    .then(r => r.ok ? r.json().then(j => `Отчёт отправлен, номер ${j.n}. Спасибо!`) : r.status === 429 ? 'Слишком часто — попробуйте через несколько минут' : 'Отчёт не принят (' + r.status + ')')
    .catch(() => 'Не удалось отправить: нет связи с сервером');
}

// ---- «Удалить мои данные»
function teleForget() {
  if (!confirm('Удалить со стороны сервера всю статистику и отчёты с этого устройства? Статистика выключится, id установки сменится.')) return;
  const url = teleUrl('/t/forget'), id = teleId();
  let cid = '';
  try { cid = JSON.parse(localStorage.getItem('oldgold-cid') || '""'); } catch (e) { /* нет */ }
  const done = ok => {
    if (!ok) { if (typeof toast === 'function') toast('Не удалось связаться с сервером — попробуйте позже'); return; }
    try { localStorage.removeItem(TELE_ID); localStorage.removeItem(TELE_Q); localStorage.removeItem('oldgold-cid'); localStorage.removeItem('oldgold-pending'); } catch (e) { /* ничего */ }
    teleSet(TELE_KEY, { on: false, asked: Date.now() });
    teleMenuSync();
    if (typeof toast === 'function') toast('Готово: данные с этого устройства удалены, статистика выключена');
  };
  if (!url) return done(true);
  fetch(url, { method: 'POST', body: JSON.stringify({ id, cid }), headers: { 'Content-Type': 'text/plain' } }).then(r => done(r.ok)).catch(() => done(false));
}

// ---- кнопки в боковом меню
function teleMenuSync() {
  const b = document.getElementById('tele-btn');
  if (b) b.querySelector('span').textContent = teleLocal() ? 'Статистика: не на локальной' : teleOn() ? 'Помогать статистикой: да' : 'Помогать статистикой: нет';
}
function teleMenu() {
  const list = document.querySelector('#tab-menu .menu-list');
  if (!list || document.getElementById('tele-rep-btn')) return;
  const mk = (id, text, title, fn) => { const b = document.createElement('button'); b.id = id; b.title = title; b.innerHTML = '<span></span>'; b.querySelector('span').textContent = text; b.onclick = fn; return b; };
  const after = document.getElementById('crashlog-btn') || list.lastElementChild;
  const rep = mk('tele-rep-btn', 'Сообщить о проблеме', 'Отправить автору описание, снимок экрана и журнал (по желанию — сохранение)', teleReport);
  const tog = mk('tele-btn', '', 'Анонимная статистика для улучшения игры (без ника и сохранений)', () => { if (!teleLocal()) teleSetOn(!teleOn()); });
  const del = mk('tele-del-btn', 'Удалить мои данные', 'Стереть на сервере статистику и отчёты с этого устройства', teleForget);
  if (after && after.parentElement === list) { after.insertAdjacentElement('afterend', rep); rep.insertAdjacentElement('afterend', tog); tog.insertAdjacentElement('afterend', del); }
  else { list.appendChild(rep); list.appendChild(tog); list.appendChild(del); }
  teleMenuSync();
}

window.addEventListener('load', () => {
  teleHooks();
  if (typeof startGame === 'function') {
    const _s = startGame;
    startGame = function () {
      const r = _s.apply(this, arguments);
      teleMenu();
      setTimeout(teleAsk, 4000);
      if (teleOn() && !Tele.started) { Tele.started = true; teleEvent('start', teleSnap()); }
      return r;
    };
  }
  setInterval(teleBeat, 60000);
});
window.addEventListener('pagehide', () => {
  if (!teleOn()) return;
  const s = teleSnap();
  teleEvent('end', { ph: s.ph, day: s.day, pop: s.pop, gt: s.gt, last: Tele.lastEv, play: Math.round((Date.now() - Tele.t0) / 1000) });
  teleFlush(true);
});
