'use strict';
// Таблица рекордов забегов (КООП_ЗАБЕГ.md §2.3): ежедневный и недельный забег.
// Игрок присылает НЕ очки, а запись ввода; сервер сам строит условия дня (rsRankedOpts) и переигрывает забег
// ядром js/run/runsim.js — очки считаются здесь, подделать их с клиента нельзя.
// В таблицу попадает только тот, кто сам включил «Показывать меня в таблице» (иначе ничего не храним).
// Одна рекордная попытка в день на установку и вид забега. «Удалить мои рекорды» — POST /runs/forget.
// Хранение: <DATA>/runboard.json — дни старше 14 суток и недели старше 8 удаляются.
const fs = require('fs');
const path = require('path');
const RS = require('../js/run/runsim.js');

const ID_RE = /^[a-z0-9]{12,32}$/;
const MAX_BODY = 400000;          // запись ввода за 40 минут игры — с большим запасом
const TOP = 20;
// простой фильтр ников: части слов, которые не пустим в общую таблицу
const BAD = ['хуй', 'хуе', 'хуё', 'пизд', 'еба', 'ёба', 'ебл', 'бля', 'сука', 'суки', 'пидор', 'пидр', 'мудак', 'гандон', 'шлюх', 'нацист', 'гитлер', 'fuck', 'shit', 'bitch', 'cunt', 'nigg', 'fag', 'whore', 'hitler', 'nazi'];

function cleanNick(s) {
  const n = String(s || '').replace(/\s+/g, ' ').trim();
  if (n.length < 2 || n.length > 16 || !/^[\p{L}\p{N} _.\-]+$/u.test(n)) return null;
  const low = n.toLowerCase().replace(/[ _.\-]/g, '').replace(/0/g, 'o').replace(/3/g, 'з').replace(/@/g, 'a');
  return BAD.some(b => low.includes(b)) ? null : n;
}
const dayKey = ms => new Date(ms).toISOString().slice(0, 10);

function createRunboard(dir, log = () => {}, now = () => Date.now()) {
  const file = path.join(dir, 'runboard.json');
  let db = { day: {}, week: {}, tries: {} };
  try { if (fs.existsSync(file)) db = Object.assign(db, JSON.parse(fs.readFileSync(file, 'utf8'))); } catch (e) { log('таблица забегов: файл испорчен, начинаю заново', e.message); }
  let dirty = false;
  const save = () => { if (!dirty) return; dirty = false; try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file + '.tmp', JSON.stringify(db)); fs.renameSync(file + '.tmp', file); } catch (e) { log('таблица забегов: не сохранилась', e.message); } };
  const timer = setInterval(save, 15000); if (timer.unref) timer.unref();
  const hits = new Map();
  function limited(key, n, ms) {
    const t = now(), a = (hits.get(key) || []).filter(x => t - x < ms);
    a.push(t); hits.set(key, a);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || t - v[v.length - 1] > ms) hits.delete(k);
    return a.length > n;
  }
  function prune() {
    const today = dayKey(now()), wk = RS.rsWeekOf(today);
    for (const k of Object.keys(db.day)) if ((Date.parse(today) - Date.parse(k)) / 86400000 > 14) delete db.day[k];
    for (const k of Object.keys(db.week)) if (wk - +k > 8) delete db.week[k];
    const yest = dayKey(Date.parse(today) - 86400000);
    for (const k of Object.keys(db.tries)) if (!k.endsWith(today) && !k.endsWith(yest)) delete db.tries[k];
  }
  // какие ключи сейчас принимаются: сегодня (и вчера в первые 30 минут нового дня — забег мог начаться до полуночи)
  function validKey(kind, key) {
    const t = now(), today = dayKey(t), late = dayKey(t - 30 * 60000);
    if (kind === 'day') return key === today || key === late;
    if (kind === 'week') return +key === RS.rsWeekOf(today) || +key === RS.rsWeekOf(late);
    return false;
  }
  function board(kind, key, id) {
    const list = ((kind === 'day' ? db.day : db.week)[key]) || [];
    const top = list.slice(0, TOP).map((e, i) => ({ place: i + 1, nick: e.nick, score: e.score, floors: e.floors, win: e.win, me: !!id && e.id === id }));
    const mi = id ? list.findIndex(e => e.id === id) : -1;
    return { kind, key, top, total: list.length, me: mi >= 0 ? { place: mi + 1, score: list[mi].score } : null };
  }
  // приём рекорда: {id, nick, show, kind, key, rec}
  function submit(m) {
    if (!m || !ID_RE.test(String(m.id)) || (m.kind !== 'day' && m.kind !== 'week')) return { err: 'кривой запрос' };
    const key = m.kind === 'day' ? String(m.key) : String(m.key | 0);
    if (!validKey(m.kind, key)) return { err: 'этот день уже закрыт' };
    if (!Array.isArray(m.rec) || m.rec.length > 60000) return { err: 'кривая запись' };
    const tk = `${m.kind}:${m.id}:${dayKey(now())}`;
    if (db.tries[tk]) return { err: 'попытка на сегодня уже засчитана' };
    const t0 = Date.now(), r = RS.rsReplay(RS.rsRankedOpts(m.kind, key), m.rec), ms = Date.now() - t0;
    if (r.err) { log(`таблица забегов: запись не принята (${r.err}), ${ms} мс`); return { err: 'запись не сошлась: ' + r.err }; }
    db.tries[tk] = 1; dirty = true;
    const res = { score: r.score, floors: r.S.floor + (r.S.over.win ? 1 : 0), win: r.S.over.win };
    const nick = m.show ? cleanNick(m.nick) : null;
    if (m.show && !nick) return Object.assign(res, { err: 'ник не подходит: 2–16 букв и цифр, без ругательств' });
    if (nick) {
      const tab = m.kind === 'day' ? db.day : db.week, list = tab[key] || (tab[key] = []);
      const old = list.findIndex(e => e.id === m.id);
      if (old < 0 || list[old].score < res.score) {
        if (old >= 0) list.splice(old, 1);
        list.push({ id: m.id, nick, score: res.score, floors: res.floors, win: res.win, at: now() });
        list.sort((a, b) => b.score - a.score || a.at - b.at);
        if (list.length > 500) list.length = 500;
      } else list[old].nick = nick;
      prune();
    }
    return Object.assign(res, board(m.kind, key, m.id));
  }
  function forget(id) {
    if (!ID_RE.test(String(id))) return 0;
    let n = 0;
    for (const tab of [db.day, db.week]) for (const k of Object.keys(tab)) { const L = tab[k], b = L.length; tab[k] = L.filter(e => e.id !== id); n += b - tab[k].length; }
    for (const k of Object.keys(db.tries)) if (k.includes(':' + id + ':')) delete db.tries[k];
    dirty = true; save();
    log(`таблица забегов: удалено по просьбе игрока ${n} записей`);
    return n;
  }

  function handle(req, res, ip) {
    const u = (req.url || '').split('?')[0];
    if (u !== '/runs/submit' && u !== '/runs/board' && u !== '/runs/forget') return false;
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Cache-Control': 'no-store' };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return true; }
    if (req.method !== 'POST') { res.writeHead(405, cors); res.end(); return true; }
    const lim = u === '/runs/submit' ? limited('s' + ip, 20, 86400000) || limited('S' + ip, 6, 600000) : u === '/runs/board' ? limited('b' + ip, 60, 60000) : limited('f' + ip, 5, 600000);
    if (lim) { res.writeHead(429, cors); res.end(); return true; }
    const chunks = []; let size = 0, big = false;
    req.on('data', ch => { size += ch.length; if (big) { if (size > MAX_BODY * 4) req.destroy(); return; } if (size > MAX_BODY) { big = true; chunks.length = 0; res.writeHead(413, cors); res.end(); } else chunks.push(ch); });   // остаток тела дочитываем вхолостую: обрыв не даёт клиенту увидеть 413
    req.on('end', () => {
      if (big) return;
      let m = null; try { m = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { /* не JSON */ }
      const out = o => { res.writeHead(o && o.err && !o.score && o.score !== 0 ? 400 : 200, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
      try {
        if (!m || typeof m !== 'object') return out({ err: 'кривой запрос' });
        if (u === '/runs/submit') return out(submit(m));
        if (u === '/runs/forget') return out({ removed: forget(m.id) });
        const kind = m.kind === 'week' ? 'week' : 'day', key = kind === 'day' ? (/^\d{4}-\d\d-\d\d$/.test(m.key) ? m.key : dayKey(now())) : String((m.key | 0) || RS.rsWeekOf(dayKey(now())));
        return out(board(kind, key, ID_RE.test(String(m.id)) ? m.id : null));
      } catch (e) { log('таблица забегов:', e.message); res.writeHead(500, cors); res.end(); }
    });
    return true;
  }

  return { handle, submit, board, forget, save, cleanNick, stop: () => { clearInterval(timer); save(); } };
}

module.exports = { createRunboard, cleanNick };
