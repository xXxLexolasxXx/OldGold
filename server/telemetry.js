'use strict';
// Анонимная статистика по согласию (POST /t), отчёты о проблемах (POST /report) и удаление по id (POST /t/forget).
// Клиент — js/telemetry.js. Хранение в папке данных сервера (на VPS /var/lib/oldgold):
//   telemetry/ГГГГ-ММ-ДД.jsonl — по строке на событие: время, случайный id установки, сессия, версия, телефон/ПК, экран и поля события;
//   reports/<номер>/report.json, shot.jpg, save.json — отчёты игроков.
// IP не пишется (живёт только в памяти для лимита запросов). Сводка: node tools/stats-report.js, отчёты: node tools/reports.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_T = 32 * 1024, MAX_REPORT = 10 * 1024 * 1024, MAX_DAY_FILE = 200 * 1024 * 1024, MAX_REPORTS = 3000;
const ID_RE = /^[a-z0-9]{12,32}$/, SID_RE = /^[a-z0-9]{6,16}$/, KEY_RE = /^[\w-]{1,24}$/;
const KINDS = new Set(['start', 'beat', 'build', 'vdeath', 'win', 'hdeath', 'end', 'err']);
const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').slice(0, n);
const num = (v, max) => { const x = Math.round(+v); return Number.isFinite(x) ? Math.max(0, Math.min(max, x)) : 0; };
const counts = (o, max = 30) => {
  const out = {};
  if (o && typeof o === 'object') for (const [k, v] of Object.entries(o).slice(0, max)) if (KEY_RE.test(k)) out[k] = num(v, 9999);
  return out;
};

// одно событие клиента → чистая запись (лишние поля отбрасываются)
function cleanEvent(e) {
  if (!e || typeof e !== 'object' || !KINDS.has(e.k)) return null;
  const r = { k: e.k, t: num(e.t, 864000), mode: e.mode === 'coop' ? 'coop' : 'solo' };
  const n = { fps: 240, day: 100000, pop: 10000, gt: 1e8, nights: 100000, maxPop: 10000, blds: 100000, lvl: 1000, play: 864000, e: 10000 };
  for (const [k, max] of Object.entries(n)) if (e[k] != null) r[k] = num(e[k], max);
  for (const [k, len] of [['cls', 20], ['ph', 12], ['why', 30], ['last', 40], ['m', 160], ['f', 80], ['ek', 10]]) if (e[k] != null) r[k] = str(e[k], len);
  if (e.b) r.b = counts(e.b);
  if (e.causes) r.causes = counts(e.causes, 12);
  return r;
}

function createTelemetry(dir, log = () => {}, events = null) {
  const tdir = path.join(dir, 'telemetry'), rdir = path.join(dir, 'reports');
  const hits = new Map();
  const day = () => new Date().toISOString().slice(0, 10);

  // статистика хранится не дольше 12 месяцев (см. PRIVACY.md)
  function prune() {
    const old = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
    try { for (const f of fs.readdirSync(tdir)) if (/^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f) && f.slice(0, 10) < old) fs.unlinkSync(path.join(tdir, f)); } catch (e) { /* папки ещё нет */ }
  }
  prune();
  setInterval(prune, 86400000).unref();

  // ведро на ip+канал: n запросов за окно ms; только в памяти
  function limited(key, n, ms) {
    const now = Date.now(), h = hits.get(key);
    if (!h || now - h[0] > ms) { hits.set(key, [now, 1]); if (hits.size > 10000) hits.clear(); return false; }
    return ++h[1] > n;
  }

  function addT(body) {
    let m; try { m = JSON.parse(body); } catch (e) { return false; }
    if (!m || !ID_RE.test(String(m.id)) || !SID_RE.test(String(m.s)) || !Array.isArray(m.ev)) return false;
    const head = { ts: Date.now(), id: m.id, s: m.s, v: str(m.v, 20), dev: m.dev === 'phone' ? 'phone' : 'pc', scr: /^\d{2,5}x\d{2,5}$/.test(m.scr) ? m.scr : '' };
    const lines = [];
    for (const e of m.ev.slice(0, 60)) { const c = cleanEvent(e); if (c) lines.push(JSON.stringify({ ...head, ...c })); }
    if (!lines.length) return false;
    fs.mkdirSync(tdir, { recursive: true });
    const f = path.join(tdir, day() + '.jsonl');
    try { if (fs.statSync(f).size > MAX_DAY_FILE) return true; } catch (e) { /* файла ещё нет */ }
    fs.appendFileSync(f, lines.join('\n') + '\n');
    return true;
  }

  function addReport(body) {
    let m; try { m = JSON.parse(body); } catch (e) { return null; }
    if (!m || typeof m !== 'object' || typeof m.text !== 'string' || !m.text.trim()) return null;
    fs.mkdirSync(rdir, { recursive: true });
    if (fs.readdirSync(rdir).length >= MAX_REPORTS) { log('отчётов слишком много, новый не принят'); return null; }
    const d = new Date(), n = d.toISOString().slice(2, 16).replace(/[-:T]/g, '').replace(/^(\d{6})/, '$1-') + '-' + crypto.randomBytes(2).toString('hex');
    const out = path.join(rdir, n);
    fs.mkdirSync(out);
    const snap = m.snap && typeof m.snap === 'object' ? cleanEvent({ ...m.snap, k: 'beat' }) : null;
    const rep = {
      n, ts: d.toISOString(), id: ID_RE.test(String(m.id)) ? m.id : '', v: str(m.v, 20), dev: m.dev === 'phone' ? 'phone' : 'pc', scr: str(m.scr, 12),
      br: str(m.br, 30), os: str(m.os, 20), mode: m.mode === 'coop' ? 'coop' : 'solo', text: String(m.text).slice(0, 1000), snap, last: str(m.last, 40),
      log: Array.isArray(m.log) ? m.log.slice(-200).map(l => String(l).slice(0, 500)) : [], crash: String(m.crash || '').slice(0, 20000),
    };
    const shot = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(m.shot || ''));
    if (shot) { fs.writeFileSync(path.join(out, 'shot.jpg'), Buffer.from(shot[1], 'base64')); rep.shot = true; }
    if (typeof m.save === 'string' && m.save.length > 2 && m.save.length < 8e6) {
      try { JSON.parse(m.save); fs.writeFileSync(path.join(out, 'save.json'), m.save); rep.save = true; } catch (e) { /* не сейв */ }
    }
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(rep, null, 1));
    log('новый отчёт о проблеме', n);
    return n;
  }

  // удалить всё по id установки: строки статистики, отчёты, запись воронки (/e)
  function forget(id, cid) {
    let lines = 0, reports = 0;
    if (ID_RE.test(String(id))) {
      const needle = `"id":"${id}"`;
      for (const f of fs.existsSync(tdir) ? fs.readdirSync(tdir).filter(x => x.endsWith('.jsonl')) : []) {
        const p = path.join(tdir, f), all = fs.readFileSync(p, 'utf8').split('\n');
        const keep = all.filter(l => !l.includes(needle));
        if (keep.length !== all.length) { lines += all.length - keep.length; fs.writeFileSync(p + '.tmp', keep.join('\n')); fs.renameSync(p + '.tmp', p); }
      }
      for (const r of fs.existsSync(rdir) ? fs.readdirSync(rdir) : []) {
        try {
          if (JSON.parse(fs.readFileSync(path.join(rdir, r, 'report.json'), 'utf8')).id === id) { fs.rmSync(path.join(rdir, r), { recursive: true, force: true }); reports++; }
        } catch (e) { /* битая папка — не трогаем */ }
      }
    }
    const funnel = events && cid ? events.forget(String(cid)) : false;
    log(`удаление по просьбе игрока: строк ${lines}, отчётов ${reports}${funnel ? ', воронка' : ''}`);
    return { lines, reports, funnel };
  }

  // обработчик HTTP; возвращает true, если запрос его
  function handle(req, res, ip) {
    const u = (req.url || '').split('?')[0];
    if (u !== '/t' && u !== '/t/forget' && u !== '/report') return false;
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Cache-Control': 'no-store' };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return true; }
    if (req.method !== 'POST') { res.writeHead(405, cors); res.end(); return true; }
    const lim = u === '/t' ? limited('t' + ip, 30, 60000) : u === '/report' ? limited('r' + ip, 5, 600000) : limited('f' + ip, 5, 600000);
    if (lim) { res.writeHead(429, cors); res.end(); return true; }
    const max = u === '/report' ? MAX_REPORT : MAX_T;
    const chunks = []; let size = 0, big = false;
    req.on('data', ch => { if (big) return; size += ch.length; if (size > max) { big = true; res.writeHead(413, cors); res.end(); req.destroy(); } else chunks.push(ch); });
    req.on('end', () => {
      if (big) return;
      const body = Buffer.concat(chunks).toString('utf8');
      try {
        if (u === '/t') { res.writeHead(addT(body) ? 204 : 400, cors); res.end(); return; }
        if (u === '/report') {
          const n = addReport(body);
          if (!n) { res.writeHead(400, cors); res.end(); return; }
          res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify({ n })); return;
        }
        let m; try { m = JSON.parse(body); } catch (e) { m = null; }
        if (!m || (!ID_RE.test(String(m.id)) && !m.cid)) { res.writeHead(400, cors); res.end(); return; }
        res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(forget(m.id, m.cid)));
      } catch (e) { log('статистика/отчёт:', e.message); res.writeHead(500, cors); res.end(); }
    });
    return true;
  }

  return { handle, addT, addReport, forget };
}

module.exports = { createTelemetry, cleanEvent };
