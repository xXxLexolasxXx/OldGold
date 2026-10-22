'use strict';
// Анонимный счётчик событий одиночной игры (воронка). Принимает POST /e от клиента.
// Хранит: случайный id клиента (из localStorage игрока, не связан с человеком), дни первого достижения
// каждого события и дни заходов. IP, ники, имена — не пишутся (IP живёт только в памяти для лимита запросов).
const fs = require('fs');
const path = require('path');

// порядок воронки для сводки («a|b» — достаточно любого из событий)
const FUNNEL = ['start-desktop|start-mobile', 'menu-new|menu-continue', 'tut-start', 'tut-step-02', 'tut-step-05', 'tut-step-08', 'tut-step-12', 'tut-step-15', 'tut2-step-02', 'tut2-step-05', 'tut2-step-08', 'tut2-step-10', 'tut2-step-12', 'tut-done',
  'place-1', 'built-1', 'built-5', 'built-10', 'night-1', 'night-seen', 'night-long', 'lost-1', 'graveyard', 'profile-open', 'ach-first', 'coop-join', 'play-5m', 'play-15m', 'play-30m', 'play-60m'];
const MAX_CLIENTS = 300000, MAX_NAMES = 400, MAX_BODY = 4096;
const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,47}$/, CID_RE = /^[a-z0-9]{8,32}$/;

function createEvents(dir, log) {
  const file = path.join(dir, 'events.json');
  let db = { clients: {}, names: {} };
  try { db = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { /* первый запуск */ }
  db.clients = db.clients || {}; db.names = db.names || {};
  let dirty = false, nClients = Object.keys(db.clients).length;
  const day = () => Math.floor(Date.now() / 86400000);
  const hits = new Map();   // ip -> [начало окна, счётчик]; только в памяти

  function save() {
    if (!dirty) return;
    dirty = false;
    try { const t = file + '.tmp'; fs.writeFileSync(t, JSON.stringify(db)); fs.renameSync(t, file); } catch (e) { log('events.json не сохранился:', e.message); }
  }
  setInterval(save, 30000).unref();

  function limited(ip) {
    const now = Date.now(), h = hits.get(ip);
    if (!h || now - h[0] > 60000) { hits.set(ip, [now, 1]); if (hits.size > 5000) hits.clear(); return false; }
    return ++h[1] > 60;
  }

  function add(body) {
    let m; try { m = JSON.parse(body); } catch (e) { return false; }
    if (!m || !CID_RE.test(String(m.c)) || !Array.isArray(m.e)) return false;
    let c = db.clients[m.c];
    if (!c) { if (nClients >= MAX_CLIENTS) return false; c = db.clients[m.c] = { f: day(), d: [], ev: {} }; nClients++; }
    const d = day();
    if (!c.d.includes(d)) { c.d.push(d); if (c.d.length > 60) c.d.shift(); }
    for (const n of m.e.slice(0, 60)) {
      if (typeof n !== 'string' || !NAME_RE.test(n) || c.ev[n]) continue;
      if (!db.names[n] && Object.keys(db.names).length >= MAX_NAMES) continue;
      c.ev[n] = d; db.names[n] = (db.names[n] || 0) + 1;
    }
    dirty = true;
    return true;
  }

  // удалить клиента по просьбе игрока («Удалить мои данные»), счётчики событий уменьшаются
  function forget(cid) {
    const c = CID_RE.test(cid) && db.clients[cid];
    if (!c) return false;
    for (const n of Object.keys(c.ev)) if (db.names[n] > 0) db.names[n]--;
    delete db.clients[cid]; nClients--; dirty = true; save();
    return true;
  }

  // обработчик HTTP; возвращает true, если запрос его
  function handle(req, res, ip) {
    if (!/^\/e(\?|$)/.test(req.url || '')) return false;
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Cache-Control': 'no-store' };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return true; }
    if (req.method !== 'POST') { res.writeHead(405, cors); res.end(); return true; }
    if (limited(ip)) { res.writeHead(429, cors); res.end(); return true; }
    let body = '', big = false;
    req.on('data', ch => { if (big) return; body += ch; if (body.length > MAX_BODY) { big = true; res.writeHead(413, { ...cors, Connection: 'close' }); res.end(); } });
    req.on('end', () => { if (big) return; res.writeHead(add(body) ? 204 : 400, cors); res.end(); });
    return true;
  }

  function summary() {
    const ids = Object.keys(db.clients), total = ids.length, today = day(), C = i => db.clients[i];
    const uniq = alt => { const l = alt.split('|'); return ids.filter(i => l.some(n => C(i).ev[n])).length; };
    const funnel = FUNNEL.map(a => { const n = uniq(a); return { event: a, clients: n, pct: total ? Math.round(n / total * 1000) / 10 : 0 }; });
    const old = ids.filter(i => C(i).f < today), d1 = old.filter(i => C(i).d.includes(C(i).f + 1)).length;
    const w = ids.filter(i => C(i).f <= today - 7), d7 = w.filter(i => C(i).d.some(x => x > C(i).f && x <= C(i).f + 7)).length;
    const perDay = {};
    for (const i of ids) perDay[C(i).f] = (perDay[C(i).f] || 0) + 1;
    const days = Object.keys(perDay).sort((a, b) => a - b).slice(-14).map(k => ({ day: new Date(k * 86400000).toISOString().slice(0, 10), newClients: perDay[k] }));
    const others = Object.keys(db.names).filter(n => !FUNNEL.some(a => a.split('|').includes(n))).sort().map(n => ({ event: n, clients: db.names[n] }));
    return { clients: total, today: ids.filter(i => C(i).d.includes(today)).length, retention: { d1Base: old.length, d1, d7Base: w.length, d7 }, funnel, days, others };
  }

  function printSummary(x) {
    const r = x.retention, pc = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
    const L = ['=== Воронка одиночной игры (анонимные клиенты) ===', `Клиентов всего: ${x.clients}, сегодня заходили: ${x.today}`,
      `Вернулись на следующий день: ${r.d1}/${r.d1Base} (${pc(r.d1, r.d1Base)}), в течение недели: ${r.d7}/${r.d7Base} (${pc(r.d7, r.d7Base)})`, ''];
    for (const f of x.funnel) L.push(`${f.event.padEnd(28)} ${String(f.clients).padStart(6)}  ${String(f.pct).padStart(5)}%  ${'█'.repeat(Math.round(f.pct / 4))}`);
    if (x.others.length) L.push('', 'Прочие события (клиентов): ' + x.others.map(o => o.event + ' ' + o.clients).join(', '));
    if (x.days.length) L.push('', 'Новые клиенты по дням: ' + x.days.map(d => d.day.slice(5) + ' ' + d.newClients).join(', '));
    return L.join('\n');
  }

  return { handle, summary, printSummary, save, forget };
}

module.exports = { createEvents };

if (require.main === module) {   // node server/events.js [папка данных] [--json]
  const dir = process.argv.find((a, i) => i > 1 && !a.startsWith('--')) || process.env.OLDGOLD_DATA || '/var/lib/oldgold';
  const ev = createEvents(dir, console.log), x = ev.summary();
  console.log(process.argv.includes('--json') ? JSON.stringify(x, null, 2) : ev.printSummary(x));
  process.exit(0);
}
