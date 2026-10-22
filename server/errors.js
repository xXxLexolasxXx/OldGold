'use strict';
// Анонимные отчёты об ошибках у игроков. Принимает POST /err от js/crashlog.js.
// Хранит только сводку по одинаковым ошибкам: текст, файл:строка, версии, браузеры/системы, фазы игры, счётчики.
// Ни IP, ни id клиента, ни ников не пишется (IP живёт только в памяти для лимита запросов).
// Посмотреть: /stats?key=… (раздел «Ошибки у игроков») или  node server/errors.js [папка данных] [--json]
const fs = require('fs');
const path = require('path');

const MAX_KEYS = 500, MAX_BODY = 4096, PER_MIN = 20;
const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').slice(0, n);   // без ESC/CSI: сводку читают в терминале

function createErrors(dir, log = () => {}) {
  const file = path.join(dir, 'errors.json');
  let db = { since: Date.now(), errs: {} };
  try { db = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { /* первый запуск */ }
  db.errs = db.errs || {}; db.since = db.since || Date.now();
  let dirty = false;
  const hits = new Map();

  function save() {
    if (!dirty) return;
    dirty = false;
    try { const t = file + '.tmp'; fs.writeFileSync(t, JSON.stringify(db)); fs.renameSync(t, file); } catch (e) { log('errors.json не сохранился:', e.message); }
  }
  setInterval(save, 30000).unref();

  function limited(ip) {
    const now = Date.now(), h = hits.get(ip);
    if (!h || now - h[0] > 60000) { hits.set(ip, [now, 1]); if (hits.size > 5000) hits.clear(); return false; }
    return ++h[1] > PER_MIN;
  }

  const bump = (o, k, max = 30) => { k = str(k, 40) || '?'; const has = Object.prototype.hasOwnProperty.call(o, k); if (k !== '__proto__' && (has || Object.keys(o).length < max)) o[k] = (has ? o[k] : 0) + 1; };

  function add(body) {
    let m; try { m = JSON.parse(body); } catch (e) { return false; }
    if (!m || typeof m !== 'object' || typeof m.m !== 'string' || !m.m) return false;
    const msg = str(m.m, 300), where = str(m.f, 120).replace(/^.*?(js\/)/, '$1'), kind = str(m.k, 10);
    const key = kind + '|' + msg + '|' + where;
    let e = db.errs[key];
    if (!e) {
      const keys = Object.keys(db.errs);
      if (keys.length >= MAX_KEYS) {   // вытесняем самую давнюю
        let old = keys[0];
        for (const k of keys) if (db.errs[k].last < db.errs[old].last) old = k;
        delete db.errs[old];
      }
      e = db.errs[key] = { k: kind, m: msg, f: where, n: 0, first: Date.now(), last: 0, v: {}, dev: {}, ph: {}, mob: 0, st: [] };
    }
    e.n++; e.last = Date.now();
    bump(e.v, m.v); bump(e.dev, str(m.br, 30) + ' / ' + str(m.os, 20)); bump(e.ph, m.ph, 10);
    if (m.mob) e.mob++;
    if (Array.isArray(m.st) && !e.st.length) e.st = m.st.slice(0, 5).map(s => str(s, 80));
    dirty = true;
    return true;
  }

  function handle(req, res, ip) {
    if (!/^\/err(\?|$)/.test(req.url || '')) return false;
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Cache-Control': 'no-store' };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return true; }
    if (req.method !== 'POST') { res.writeHead(405, cors); res.end(); return true; }
    if (limited(ip)) { res.writeHead(429, cors); res.end(); return true; }
    let body = '', big = false;
    req.on('data', ch => { if (big) return; body += ch; if (body.length > MAX_BODY) { big = true; res.writeHead(413, { ...cors, Connection: 'close' }); res.end(); } });
    req.on('end', () => { if (big) return; res.writeHead(add(body) ? 204 : 400, cors); res.end(); });
    return true;
  }

  function summary(days = 7) {
    const from = Date.now() - days * 86400000;
    const list = Object.values(db.errs).filter(e => e.last >= from).sort((a, b) => b.n - a.n);
    return {
      since: new Date(db.since).toISOString(), days, kinds: list.length, reports: list.reduce((a, e) => a + e.n, 0),
      top: list.slice(0, 20).map(e => ({ ...e, first: new Date(e.first).toISOString(), last: new Date(e.last).toISOString() })),
    };
  }

  function printSummary(x) {
    const top = o => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k} ×${n}`).join(', ');
    const L = [`=== Ошибки у игроков за ${x.days} дн.: ${x.reports} отчётов, ${x.kinds} разных ===`];
    for (const e of x.top) {
      L.push(`${String(e.n).padStart(5)}×  [${e.k}] ${e.m}`);
      L.push(`        ${e.f || '—'}${e.st.length ? '  ← ' + e.st.join(' ← ') : ''}`);
      L.push(`        версии: ${top(e.v)} · ${top(e.dev)} · фаза: ${top(e.ph)} · с телефона ${e.mob} · последний ${e.last.replace('T', ' ').slice(0, 16)}`);
    }
    if (!x.top.length) L.push('Ошибок не присылали.');
    return L.join('\n');
  }

  return { handle, add, summary, printSummary, save };
}

module.exports = { createErrors };

if (require.main === module) {
  const dir = process.argv.find((a, i) => i > 1 && !a.startsWith('--')) || process.env.OLDGOLD_DATA || '/var/lib/oldgold';
  const er = createErrors(dir, console.log), x = er.summary(+(process.argv.find(a => /^--days=/.test(a)) || '--days=7').split('=')[1]);
  console.log(process.argv.includes('--json') ? JSON.stringify(x, null, 2) : er.printSummary(x));
  process.exit(0);
}
