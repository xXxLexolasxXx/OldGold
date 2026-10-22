'use strict';
// Рекордные забеги в Таверне отряда (КООП_ЗАБЕГ.md §2.3): ежедневный и недельный.
//  • Перед стартом игрок сам выбирает: «Попытка дня» (идёт в таблицу; одна в день на каждый вид) или «Тренировка».
//  • После попытки запись ввода уходит на сервер (POST /runs/submit), сервер переигрывает забег и сам считает очки.
//  • В таблицу попадает только тот, кто включил «Показывать меня в таблице» и ввёл ник; без этого ничего не отправляется,
//    а попытка ждёт до конца дня — можно включить и отправить позже. «Удалить мои рекорды» — POST /runs/forget.
//  • Свой id установки (не тот, что у статистики): og_run_board.id.

const RB_KEY = 'og_run_board';
const RB = { cache: {}, busy: false };

function rbState() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(RB_KEY)); } catch (e) { /* нет хранилища */ }
  s = s && typeof s === 'object' ? s : {};
  if (!/^[a-z0-9]{12,32}$/.test(s.id || '')) { s.id = ''; for (let i = 0; i < 16; i++) s.id += 'abcdefghijklmnopqrstuvwxyz0123456789'[(Math.random() * 36) | 0]; }
  return Object.assign({ on: false, nick: '', pending: {}, tries: {} }, s);
}
function rbSave(s) { try { localStorage.setItem(RB_KEY, JSON.stringify(s)); } catch (e) { /* нет хранилища */ } }
function rbUrl(p) { const h = typeof coopDefaultServer === 'function' ? coopDefaultServer() : ''; return h && typeof coopHttpUrl === 'function' ? coopHttpUrl(h).replace(/\/+$/, '') + p : ''; }
function rbPost(p, body) {
  const url = rbUrl(p);
  if (!url) return Promise.resolve({ err: 'нет сервера' });
  return fetch(url, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'text/plain' } })
    .then(r => r.status === 429 ? { err: 'слишком часто, попробуйте позже' } : r.json()).catch(() => ({ err: 'сервер недоступен' }));
}
const rbKind = d => (d.daily ? 'day' : 'week');
const rbKeyOf = kind => (kind === 'day' ? runDayKey() : rsWeekOf(runDayKey()));
const rbTryKey = kind => kind + ':' + runDayKey();

// ---------- выбор перед стартом ----------
function rbChoose(d) {
  const kind = rbKind(d), s = rbState(), used = !!s.tries[rbTryKey(kind)];
  const box = document.createElement('div');
  box.style.cssText = 'position:absolute;inset:0;z-index:6;background:#000b;display:flex;align-items:center;justify-content:center;padding:8px';
  const b = 'display:block;width:100%;margin:6px 0;padding:10px;background:#3a2410;color:#f1dfb0;border:2px solid #b8902c;border-radius:8px;cursor:pointer;text-align:left';
  box.innerHTML = `<div style="background:#2a1a0e;border:2px solid #b8902c;border-radius:8px;padding:14px;max-width:360px;width:100%;color:#f1dfb0">
    <div style="font-size:18px;font-weight:700;margin-bottom:4px">${d.name}</div>
    <small>У всех одинаковые этажи и одинаковый герой — без прокачки из мастерской.</small>
    <button data-rb="ranked" ${used ? 'disabled' : ''} style="${b};${used ? 'opacity:.5;cursor:default' : ''}"><b>Попытка дня</b><br><small>${used ? 'Сегодня уже была. Завтра — новая.' : 'Идёт в таблицу рекордов. Одна в день.'}</small></button>
    <button data-rb="train" style="${b}"><b>Тренировка</b><br><small>Сколько угодно раз, в таблицу не идёт.</small></button>
    <div style="text-align:right"><button data-rb="x" style="padding:6px 14px;background:#3a2410;color:#f1dfb0;border:1px solid #b8902c;border-radius:6px;cursor:pointer">Назад</button></div></div>`;
  Tav.el.appendChild(box);
  box.onclick = e => {
    const t = e.target.closest('[data-rb]'); if (!t || t.disabled) return;
    box.remove();
    if (t.dataset.rb === 'x') return;
    const ranked = t.dataset.rb === 'ranked';
    if (ranked) { const st = rbState(); st.tries[rbTryKey(kind)] = 1; for (const k of Object.keys(st.tries)) if (!k.endsWith(runDayKey())) delete st.tries[k]; rbSave(st); }   // попытка засчитана со старта: выход не даёт переиграть
    RSfx.play('ui'); tavernClose(); runStart(d, { ranked });
  };
}

// ---------- после забега ----------
function rbAfterRun(res) {
  if (!res || !res.ranked) return;
  const kind = res.day ? 'day' : 'week', s = rbState();
  s.pending[kind] = { key: res.day || res.week, rec: res.rec, score: res.score, day: runDayKey() };
  rbSave(s);
  if (s.on && s.nick) rbSend(kind);
}
function rbSend(kind) {
  const s = rbState(), p = s.pending[kind];
  if (!p || p.day !== runDayKey()) return Promise.resolve(null);
  return rbPost('/runs/submit', { id: s.id, nick: s.nick, show: true, kind, key: p.key, rec: p.rec }).then(r => {
    const st = rbState();
    if (r && (r.score != null || /уже засчитана/.test(r.err || ''))) { delete st.pending[kind]; rbSave(st); }
    if (r && r.top) RB.cache[kind] = r;
    try { toast(r && r.err ? 'Рекорд: ' + r.err : `Рекорд принят: ${r.score} очков, место ${r.me ? r.me.place : '—'}`); } catch (e) { /* без тоста */ }
    if (RB.el) rbDraw();
    return r;
  });
}

// ---------- окно «Рекорды» ----------
function rbOpen() {
  const box = document.createElement('div');
  box.style.cssText = 'position:absolute;inset:0;z-index:6;background:#000b;display:flex;align-items:center;justify-content:center;padding:8px;overflow:auto';
  Tav.el.appendChild(box);
  RB.el = box; RB.tab = RB.tab || 'day'; RB.note = '';
  box.onclick = e => {
    const t = e.target.closest('[data-rb]'); if (!t) return;
    const a = t.dataset.rb, s = rbState();
    if (a === 'x') { box.remove(); RB.el = null; return; }
    if (a === 'day' || a === 'week') { RB.tab = a; rbLoad(); }
    if (a === 'on') {
      const nick = (box.querySelector('#rb-nick').value || '').trim();
      if (!s.on && nick.length < 2) { box.querySelector('#rb-note').textContent = 'Сначала впишите ник (2–16 букв).'; return; }
      s.on = !s.on; s.nick = nick || s.nick; rbSave(s); rbDraw();
      if (s.on) for (const k of ['day', 'week']) if (s.pending[k]) rbSend(k);
    }
    if (a === 'send') rbSend(t.dataset.k);
    if (a === 'forget' && confirm('Удалить все мои записи из таблицы рекордов на сервере?')) {
      rbPost('/runs/forget', { id: s.id }).then(r => {
        const st = rbState(); st.on = false; st.id = ''; rbSave(st);   // новый id: старые записи ни с чем не связаны
        RB.cache = {}; RB.note = r && r.removed != null ? `Удалено записей: ${r.removed}` : 'Сервер недоступен — попробуйте позже';
        rbLoad();
      });
    }
  };
  box.addEventListener('change', e => { if (e.target.id === 'rb-nick') { const s = rbState(); s.nick = e.target.value.trim().slice(0, 16); rbSave(s); } });
  rbDraw(); rbLoad();
}
function rbLoad() {
  const kind = RB.tab, s = rbState();
  rbPost('/runs/board', { kind, key: rbKeyOf(kind), id: s.on ? s.id : '' }).then(r => { RB.cache[kind] = r; if (RB.el) rbDraw(); });
  if (RB.el) rbDraw();
}
function rbEsc(t) { return String(t).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]); }
function rbDraw() {
  const box = RB.el; if (!box) return;
  const s = rbState(), kind = RB.tab, r = RB.cache[kind], btn = 'padding:5px 10px;background:#3a2410;color:#f1dfb0;border:1px solid #b8902c;border-radius:6px;cursor:pointer';
  const tab = k => `<button data-rb="${k}" style="${btn};${kind === k ? 'background:#6a4a1a' : ''}">${k === 'day' ? 'Сегодня' : 'Неделя'}</button>`;
  let list;
  if (!r) list = '<p style="opacity:.7">Загружаю…</p>';
  else if (r.err) list = `<p style="opacity:.8">${rbEsc(r.err)}</p>`;
  else if (!r.top.length) list = '<p style="opacity:.8">Пока пусто. Будьте первым!</p>';
  else list = '<table style="width:100%;border-collapse:collapse;font-size:14px">' + r.top.map(e => `<tr style="${e.me ? 'color:#ffd84a;font-weight:700' : ''}"><td style="width:28px">${e.place}</td><td>${rbEsc(e.nick)}</td><td style="text-align:right">${e.win ? '👑 ' : ''}${e.floors} эт.</td><td style="text-align:right;width:64px">${e.score}</td></tr>`).join('') + '</table>'
    + (r.me && r.me.place > r.top.length ? `<p>Ваше место: ${r.me.place} из ${r.total} (${r.me.score})</p>` : '');
  const pend = ['day', 'week'].filter(k => s.pending[k] && s.pending[k].day === runDayKey());
  box.innerHTML = `<div style="background:#2a1a0e;border:2px solid #b8902c;border-radius:8px;padding:14px;max-width:440px;width:100%;color:#f1dfb0">
    <div style="font-size:18px;font-weight:700;margin-bottom:6px">Рекорды забегов</div>
    <div style="display:flex;gap:6px;margin-bottom:8px">${tab('day')}${tab('week')}</div>
    ${list}
    <hr style="border:0;border-top:1px solid #6a4a1a;margin:10px 0">
    <label style="display:block;font-size:13px;margin-bottom:4px">Ник в таблице: <input id="rb-nick" maxlength="16" value="${rbEsc(s.nick)}" style="width:150px;background:#1a0f08;color:#f1dfb0;border:1px solid #b8902c;border-radius:4px;padding:3px 6px"></label>
    <button data-rb="on" style="${btn}">${s.on ? '✓ Показываю себя в таблице — выключить' : 'Показывать меня в таблице'}</button>
    ${pend.map(k => `<button data-rb="send" data-k="${k}" style="${btn};margin-left:4px" ${s.on ? '' : 'disabled'}>Отправить попытку (${k === 'day' ? 'день' : 'неделя'}: ${s.pending[k].score})</button>`).join('')}
    <p style="font-size:12px;opacity:.8;margin:6px 0">В таблицу уходят только ник и очки — и только если вы сами включили показ. Сервер сам переигрывает забег по записи нажатий, поэтому накрутить очки нельзя.</p>
    <div id="rb-note" style="font-size:12px;min-height:14px;color:#ffd0a0">${rbEsc(RB.note || '')}</div>
    <div style="display:flex;justify-content:space-between;margin-top:6px"><button data-rb="forget" style="${btn};font-size:12px">Удалить мои рекорды</button><button data-rb="x" style="${btn}">Закрыть</button></div></div>`;
}
