'use strict';
// Журнал сбоев. Подключается ПЕРВЫМ скриптом, чтобы ловить и ошибки загрузки остальных файлов.
//  · window.onerror / unhandledrejection → запись в локальный журнал (localStorage feod.errlog)
//    и короткий анонимный отчёт на сервер (POST /err): текст ошибки, файл:строка, версия игры,
//    браузер/система одной строкой, фаза игры. Ни ника, ни id клиента, ни сохранений — только то, что нужно для починки.
//  · Сессии: при запуске смотрим, чем кончился прошлый запуск — закрыт штатно, выгружен в фоне,
//    оборвался на экране (обычно память) или после ошибки. Сводка — в журнале и на F3.
//  · crashCopyLog() — «Скопировать журнал» в меню: текст для отправки автору.

const CRASH_ERR = 'feod.errlog', CRASH_SESS = 'feod.sess', CRASH_EXITS = 'feod.exits';
const CrashLog = { sent: 0, seen: new Set(), lastSend: 0, off: false, prev: null, beat: 0 };

function crashGet(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
function crashSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* хранилище недоступно или полно */ } }
function crashVer() { return typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : '?'; }

// Где сейчас игрок: загрузка, стартовое меню, одиночная игра или кооператив
function crashPhase() {
  try {
    const shown = id => { const el = document.getElementById(id); return !!el && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none'; };
    if (shown('start-menu')) return 'menu';   // меню рисуется поверх заставки загрузки
    if (shown('loading')) return 'loading';
    if (typeof Coop !== 'undefined' && Coop.on) return 'coop';
    if (typeof Game !== 'undefined' && Game.time > 0) return 'game';
  } catch (e) { /* документ ещё не готов */ }
  return 'start';
}

// Браузер и система одной строкой, без лишних подробностей вроде модели телефона
function crashDevice() {
  const ua = navigator.userAgent || '';
  const br = (ua.match(/(Edg|OPR|YaBrowser|SamsungBrowser|Firefox|CriOS|FxiOS|Chrome|Version)\/(\d+)/) || [])
    .slice(1).join(' ').replace(/^Version/, 'Safari').replace(/^Edg/, 'Edge') || 'другой';
  const and = ua.match(/Android (\d+)/), ios = ua.match(/OS (\d+)_/);
  const os = and ? 'Android ' + and[1] : /iPhone|iPad|iPod/.test(ua) ? 'iOS' + (ios ? ' ' + ios[1] : '')
    : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'другая';
  const touch = (navigator.maxTouchPoints || 0) > 0;
  return { br, os, mob: touch && /Android|iPhone|iPad|Mobile/.test(ua) ? 1 : 0, mem: navigator.deviceMemory || 0 };
}

// Чистим текст ошибки: адреса и длинные числа (на случай, если в сообщение попало что-то личное)
function crashScrub(s) {
  return String(s || '').replace(/https?:\/\/[^\s)]+\/(js\/[^\s?):]+)/g, '$1').replace(/https?:\/\/\S+/g, '<url>')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '<email>').replace(/\d{7,}/g, '<n>').slice(0, 300);
}
function crashFrames(stack) {
  const out = [];
  for (const l of String(stack || '').split('\n')) {
    const m = l.match(/(js\/[\w\/.-]+\.js):(\d+)(?::(\d+))?/);
    if (m) out.push(`${m[1]}:${m[2]}`);
    if (out.length >= 5) break;
  }
  return out;
}

function crashNote(kind, msg, src, stack) {
  const e = { t: Date.now(), k: kind, m: crashScrub(msg), f: crashScrub(src || ''), st: crashFrames(stack), v: crashVer(), ph: crashPhase(),
    gt: typeof Game !== 'undefined' ? Math.round(Game.time || 0) : 0 };
  const log = crashGet(CRASH_ERR, []);
  log.push(e);
  crashSet(CRASH_ERR, log.slice(-30));
  if (CrashLog.upd) CrashLog.upd(c => { c.errs = (c.errs || 0) + 1; c.lastErr = Date.now(); });
  if (kind !== 'save') crashSend(e);
}

// Отправка: не чаще раза в 10 с, не больше 5 за запуск и 20 в сутки, одинаковые — один раз
function crashSend(e) {
  try {
    if (CrashLog.off || /^(localhost|127\.0\.0\.1|\[::1\]|)$/.test(location.hostname) || location.protocol === 'file:') return;
    const key = e.m + '|' + e.f;
    if (CrashLog.seen.has(key) || CrashLog.sent >= 5 || Date.now() - CrashLog.lastSend < 10000) return;
    const day = new Date().toISOString().slice(0, 10), q = crashGet('feod.errsent', { d: day, n: 0 });
    if (q.d !== day) { q.d = day; q.n = 0; }
    if (q.n >= 20) return;
    const host = typeof coopDefaultServer === 'function' ? coopDefaultServer() : '';
    if (!host || typeof coopHttpUrl !== 'function') return;
    const url = coopHttpUrl(host).replace(/\/+$/, '') + '/err';
    CrashLog.seen.add(key); CrashLog.sent++; CrashLog.lastSend = Date.now(); q.n++; crashSet('feod.errsent', q);
    const d = crashDevice();
    const body = JSON.stringify({ v: e.v, k: e.k, m: e.m, f: e.f, st: e.st, ph: e.ph, gt: e.gt, br: d.br, os: d.os, mob: d.mob, mem: d.mem });
    fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'text/plain' }, keepalive: true })
      .then(r => { if (r.status === 404) CrashLog.off = true; })   // сервер без приёма отчётов — больше не стучимся
      .catch(() => { /* нет сети — не страшно */ });
  } catch (x) { /* отчёт об ошибке не должен сам ронять игру */ }
}

window.addEventListener('error', ev => {
  if (!ev) return;
  // ошибка загрузки ресурса (скрипт, картинка): у события нет message, есть target
  if (!ev.message && ev.target && ev.target !== window) {
    const t = ev.target, src = t.src || t.href || '';
    if (src) crashNote('load', 'не загрузился ' + (t.tagName || '').toLowerCase(), src);
    return;
  }
  crashNote('error', ev.message, (ev.filename || '') + ':' + (ev.lineno || 0) + ':' + (ev.colno || 0), ev.error && ev.error.stack);
}, true);
window.addEventListener('unhandledrejection', ev => {
  const r = ev && ev.reason;
  crashNote('reject', r && r.message || String(r), '', r && r.stack);
});

// ---------- Сессии: чем кончился прошлый запуск ----------
// vis — видна ли вкладка; closed — штатный уход (pagehide); beat — последний «пульс» (раз в 10 с, пока видна)
function crashLastMem(diag) { const l = (diag && diag.last) || []; return l[l.length - 1] || {}; }
// Почему оборвался запуск p (запись сессии без closed): фон, ошибка, память или неизвестно
function crashClassify(p, diag) {
  const h = crashLastMem(diag);
  if (p.vis === 'hidden') return 'bg';                                              // выгружена, пока была в фоне
  if (p.lastErr && p.beat && p.lastErr >= p.beat - 15000) return 'error';            // оборвалась вскоре после ошибки
  if ((h.heap && h.lim && h.heap > h.lim * 0.6) || (h.cvMB || 0) > 250) return 'memory';   // памяти было впритык
  return 'unknown';                                                                  // на экране без явной причины (чаще всего тоже память)
}
{
  // у каждой вкладки своя запись (несколько открытых вкладок не считаются вылетами друг друга)
  const me = Math.random().toString(36).slice(2, 10);
  const all = () => { const a = crashGet(CRASH_SESS, {}); return a && typeof a === 'object' && !a.start ? a : {}; };   // старый формат (одна запись) — выбрасываем
  // разбор чужих записей: закрытые удаляем, замолчавшие дольше 12 с — оборванные запуски
  const reap = () => {
    const a = all(), now = Date.now(), diag = crashGet('feod.diag', null);
    let ch = false;
    for (const id in a) {
      if (id === me) continue;
      const p = a[id];
      if (p.closed) { delete a[id]; ch = true; continue; }
      if (now - (p.beat || 0) < 12000) continue;   // соседняя живая вкладка (или только что упавшая — посмотрим ещё раз позже)
      const reason = crashClassify(p, diag), h = crashLastMem(diag);
      const exits = crashGet(CRASH_EXITS, []);
      exits.push({ t: p.beat || p.start, r: reason, ph: p.ph, v: p.v, min: Math.round(((p.beat || p.start) - p.start) / 60000), errs: p.errs || 0, heap: h.heap || null, lim: h.lim || null });
      crashSet(CRASH_EXITS, exits.slice(-20));
      CrashLog.prev = reason;
      delete a[id]; ch = true;
    }
    if (ch) crashSet(CRASH_SESS, a);
  };
  const s = { start: Date.now(), beat: Date.now(), vis: 'visible', closed: false, ph: 'start', v: '?', errs: 0 };
  { const a = all(); a[me] = s; crashSet(CRASH_SESS, a); }
  reap();
  setTimeout(reap, 15000);
  const upd = f => { const a = all(); const c = a[me] || s; f(c); a[me] = c; crashSet(CRASH_SESS, a); };
  CrashLog.upd = upd;
  setInterval(() => { if (document.visibilityState !== 'hidden') upd(c => { c.beat = Date.now(); c.ph = crashPhase(); c.v = crashVer(); }); }, 10000);
  document.addEventListener('visibilitychange', () => upd(c => { c.vis = document.visibilityState; c.beat = Date.now(); c.ph = crashPhase(); }));
  window.addEventListener('pagehide', () => upd(c => { c.closed = true; c.beat = Date.now(); }));
  window.addEventListener('pageshow', ev => { if (ev.persisted) upd(c => { c.closed = false; c.vis = 'visible'; c.beat = Date.now(); }); });
}

const CRASH_REASONS = { bg: 'выгружена в фоне', memory: 'нехватка памяти', error: 'после ошибки', unknown: 'оборвалась на экране' };
function crashSummary() {
  const exits = crashGet(CRASH_EXITS, []), by = {};
  for (const x of exits) by[x.r] = (by[x.r] || 0) + 1;
  return { exits: exits.length, by, errors: crashGet(CRASH_ERR, []).length, text: Object.entries(by).map(([r, n]) => `${CRASH_REASONS[r] || r} ${n}`).join(' · ') || 'не было' };
}

// Текст журнала для отправки автору (ни ников, ни сохранений)
function crashLogText() {
  const d = crashDevice(), sum = crashSummary(), L = [];
  const iso = t => t ? new Date(t).toISOString().replace('T', ' ').slice(0, 16) : '—';
  L.push(`OldGold ${crashVer()} · ${d.br} · ${d.os} · ${d.mob ? 'телефон' : 'компьютер'} · память устройства ${d.mem || '?'} ГБ · экран ${screen.width}×${screen.height} @${(window.devicePixelRatio || 1).toFixed(2)}`);
  L.push(`Сейчас: ${crashPhase()}${typeof Game !== 'undefined' ? `, игровое время ${Math.round((Game.time || 0) / 60)} мин, жителей ${(Game.units || []).length}, зданий ${(Game.buildings || []).length}` : ''}${typeof Fps !== 'undefined' ? `, ${Fps.fps.toFixed(0)} кадр/с, ${Fps.eco ? 'экономная' : 'обычная'} графика` : ''}`);
  L.push(`Прерванные запуски: ${sum.exits} (${sum.text})`);
  for (const x of crashGet(CRASH_EXITS, []).slice(-10)) L.push(`  ${iso(x.t)}  ${CRASH_REASONS[x.r] || x.r}, фаза ${x.ph}, версия ${x.v}, шло ${x.min} мин, ошибок ${x.errs}${x.heap ? `, куча ${x.heap}/${x.lim} МБ` : ''}`);
  L.push(`Ошибки (последние ${Math.min(15, sum.errors)} из ${sum.errors}):`);
  for (const e of crashGet(CRASH_ERR, []).slice(-15)) L.push(`  ${iso(e.t)}  [${e.k}] ${e.m}  ${e.f}${e.st && e.st.length ? '  ← ' + e.st.join(' ← ') : ''}  (${e.ph}, ${e.v})`);
  const diag = crashGet('feod.diag', null);
  if (diag && diag.last) {
    L.push('Память (последние замеры): ' + diag.last.slice(-6).map(m => `${m.t}с: куча ${m.heap ?? '—'}/${m.lim ?? '—'} МБ, холсты ${m.cvMB} МБ, ${m.fps} к/с`).join('; '));
  }
  try {
    let saves = 0;
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('feod.save.')) saves += (localStorage.getItem(k) || '').length; }
    L.push(`Сохранения: ${(saves / 1024).toFixed(0)} КБ в браузере`);
  } catch (e) { /* ничего */ }
  return L.join('\n');
}

function crashCopyLog() {
  const text = crashLogText();
  const done = ok => { if (typeof toast === 'function') toast(ok ? 'Журнал скопирован — вставьте его в сообщение автору' : 'Не вышло скопировать: выделите текст и скопируйте вручную'); };
  const fallback = () => {
    // окно с текстом: на телефонах без доступа к буферу его можно выделить пальцем
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:8% 6%;z-index:100001;display:flex;flex-direction:column;gap:8px;padding:12px;background:#2a1e14;border:2px solid #a8743a;border-radius:8px';
    const ta = document.createElement('textarea');
    ta.value = text; ta.readOnly = true;
    ta.style.cssText = 'flex:1;font:11px/1.35 Consolas,monospace;background:#1a120c;color:#f3e6c8;border:1px solid #5a4128';
    const b = document.createElement('button');
    b.textContent = 'Закрыть'; b.onclick = () => box.remove();
    box.append(ta, b); document.body.appendChild(box);
    ta.focus(); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { /* старый способ недоступен */ }
    done(ok);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => done(true), fallback);
  else fallback();
  return text;
}
window.crashLogText = crashLogText;
