'use strict';
// Кнопка «Сообщить о проблеме» и «Удалить мои данные» (боковое меню).
// Подключается сразу после js/crashlog.js (чтобы журнал консоли копился с первых строк).
//  · «Сообщить о проблеме»: строка от игрока + снимок экрана + последние 200 строк консоли и журнал сбоев,
//    версия, устройство, случайный id установки (feod.tid, с человеком не связан) и (по галочке) сохранение → POST /report.
//    Только по нажатию игрока; сам по себе журнал никуда не уходит.
//  · «Удалить мои данные»: POST /t/forget — сервер стирает отчёты с этим id и запись воронки /e, у игрока id меняется.

const TELE_ID = 'feod.tid';
const Tele = { lines: [], lastEv: '' };

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
  // ошибки из журнала сбоев — тоже в консольный журнал
  if (typeof crashNote === 'function') {
    const _cn = crashNote;
    crashNote = function (kind, msg, src, stack) {
      keep('ERR', [`[${kind}] ${msg} ${src || ''}`]);
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
  if (!confirm('Удалить на сервере отчёты и счётчик этапов с этого устройства? Id установки сменится.')) return;
  const url = teleUrl('/t/forget'), id = teleId();
  let cid = '';
  try { cid = JSON.parse(localStorage.getItem('oldgold-cid') || '""'); } catch (e) { /* нет */ }
  const done = ok => {
    if (!ok) { if (typeof toast === 'function') toast('Не удалось связаться с сервером — попробуйте позже'); return; }
    try { localStorage.removeItem(TELE_ID); localStorage.removeItem('oldgold-cid'); localStorage.removeItem('oldgold-pending'); } catch (e) { /* ничего */ }
    if (typeof toast === 'function') toast('Готово: данные с этого устройства удалены');
  };
  if (!url) return done(true);
  fetch(url, { method: 'POST', body: JSON.stringify({ id, cid }), headers: { 'Content-Type': 'text/plain' } }).then(r => done(r.ok)).catch(() => done(false));
}

// ---- кнопки в боковом меню
function teleMenu() {
  const list = document.querySelector('#tab-menu .menu-list');
  if (!list || document.getElementById('tele-rep-btn')) return;
  const mk = (id, text, title, fn) => { const b = document.createElement('button'); b.id = id; b.title = title; b.innerHTML = '<span></span>'; b.querySelector('span').textContent = text; b.onclick = fn; return b; };
  const after = document.getElementById('crashlog-btn') || list.lastElementChild;
  const rep = mk('tele-rep-btn', 'Сообщить о проблеме', 'Отправить автору описание, снимок экрана и журнал (по желанию — сохранение)', teleReport);
  const del = mk('tele-del-btn', 'Удалить мои данные', 'Стереть на сервере отчёты с этого устройства', teleForget);
  if (after && after.parentElement === list) { after.insertAdjacentElement('afterend', rep); rep.insertAdjacentElement('afterend', del); }
  else { list.appendChild(rep); list.appendChild(del); }
}

window.addEventListener('load', () => {
  if (typeof track === 'function') {   // последнее действие игрока — в отчёт
    const _t = track;
    track = function (name, title) { Tele.lastEv = String(name).slice(0, 40); return _t(name, title); };
  }
  if (typeof startGame === 'function') {
    const _s = startGame;
    startGame = function () { const r = _s.apply(this, arguments); teleMenu(); return r; };
  }
});
