'use strict';
// Статистика реальных игроков кооператива: кто заходил, сколько раз, сколько играл, пик онлайна.
// Хранится в папке данных сервера (stats.json), в репозиторий не попадает.
// Ни паролей, ни IP здесь нет: адрес превращается в хэш с солью этого сервера — видно только «с скольких сетей заходил».
//
// Посмотреть на сервере:  node /opt/oldgold/server/stats.js   (папка данных — OLDGOLD_DATA или /var/lib/oldgold)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const day = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);

function createStats(dataDir, log = () => {}) {
  const FILE = path.join(dataDir, 'stats.json');
  let s;
  try { s = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { s = null; }
  if (!s || typeof s !== 'object') s = {};
  s.salt = s.salt || crypto.randomBytes(16).toString('hex');
  s.since = s.since || Date.now();
  s.players = s.players || {};      // ключ ника -> { nick, cls, first, last, logins, seconds, nets: [хэши], vers: {} }
  s.days = s.days || {};            // 'ГГГГ-ММ-ДД' -> { logins, players: [ключи], seconds, peak }
  s.peak = s.peak || { n: 0, at: 0 };
  s.vers = s.vers || {};            // версия клиента -> входов
  s.server = s.server || {};        // версия сервера -> время первого запуска с ней

  const online = new Map();         // ключ -> { at, conns }
  let dirty = false;

  const netHash = ip => crypto.createHash('sha256').update(s.salt + '|' + String(ip || '')).digest('hex').slice(0, 12);
  const dayRec = d => (s.days[d] = s.days[d] || { logins: 0, players: [], seconds: 0, peak: 0 });

  function serverVersion(ver) {
    if (ver && !s.server[ver]) { s.server[ver] = Date.now(); dirty = true; }
  }

  function join(key, nick, info = {}) {
    const now = Date.now(), d = dayRec(day(now));
    const p = s.players[key] = s.players[key] || { nick, first: now, logins: 0, seconds: 0, nets: [], vers: {} };
    p.nick = nick; p.last = now; p.logins++;
    if (info.cls) p.cls = info.cls;
    if (info.ip) { const h = netHash(info.ip); if (!p.nets.includes(h)) { p.nets.push(h); if (p.nets.length > 20) p.nets.shift(); } }
    const v = String(info.ver || '?').slice(0, 40);
    p.vers[v] = (p.vers[v] || 0) + 1;
    s.vers[v] = (s.vers[v] || 0) + 1;
    if (info.from) { p.from = String(info.from).slice(0, 80); }
    d.logins++;
    if (!d.players.includes(key)) d.players.push(key);
    const o = online.get(key);
    if (o) o.conns++; else online.set(key, { at: now, conns: 1 });
    const n = online.size;
    if (n > s.peak.n) s.peak = { n, at: now };
    if (n > d.peak) d.peak = n;
    dirty = true;
  }

  // время в игре начисляем по дням, в которые оно прошло
  function addTime(key, from, to) {
    const p = s.players[key];
    if (!p || to <= from) return;
    p.seconds += Math.round((to - from) / 1000);
    for (let t = from; t < to;) {
      const end = Math.min(to, Date.parse(day(t) + 'T00:00:00Z') + 86400000);
      dayRec(day(t)).seconds += Math.round((end - t) / 1000);
      t = end;
    }
    dirty = true;
  }

  function leave(key) {
    const o = online.get(key);
    if (!o) return;
    if (--o.conns > 0) return;
    online.delete(key);
    const now = Date.now();
    addTime(key, o.at, now);
    if (s.players[key]) s.players[key].last = now;
  }

  function save(force) {
    // кто сейчас в игре — начисляем накопившееся время, чтобы при падении сервера оно не пропало
    const now = Date.now();
    for (const [key, o] of online) { addTime(key, o.at, now); o.at = now; }
    s.onlineNow = [...online.keys()];
    if (!dirty && !force) return;
    try {
      const tmp = FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(s));
      fs.renameSync(tmp, FILE);
      dirty = false;
    } catch (e) { log('статистика не сохранилась:', e.message); }
  }

  return { join, leave, save, serverVersion, summary: () => summary(s, [...online.keys()]), raw: () => s };
}

// Сводка без хэшей и соли — её видят хосты и владелец ключа
function summary(s, onlineKeys = []) {
  const now = Date.now(), today = day(now);
  const players = Object.entries(s.players || {}).map(([key, p]) => ({
    nick: p.nick, cls: p.cls || null, logins: p.logins, hours: +(p.seconds / 3600).toFixed(2),
    first: new Date(p.first).toISOString(), last: p.last ? new Date(p.last).toISOString() : null,
    nets: (p.nets || []).length, vers: p.vers, from: p.from || null, online: onlineKeys.includes(key),
  })).sort((a, b) => (b.last || '').localeCompare(a.last || ''));
  const days = Object.keys(s.days || {}).sort().reverse().slice(0, 30).map(d => ({
    day: d, logins: s.days[d].logins, players: s.days[d].players.length, hours: +(s.days[d].seconds / 3600).toFixed(2), peak: s.days[d].peak,
  }));
  const week = Object.keys(s.days || {}).filter(d => now - Date.parse(d) < 7 * 86400000);
  return {
    since: new Date(s.since || now).toISOString(),
    players: players.length,
    onlineNow: onlineKeys.length,
    today: s.days && s.days[today] ? { logins: s.days[today].logins, players: s.days[today].players.length } : { logins: 0, players: 0 },
    activeWeek: new Set(week.flatMap(d => s.days[d].players)).size,
    totalHours: +(players.reduce((a, p) => a + p.hours, 0)).toFixed(2),
    peak: { n: (s.peak || {}).n || 0, at: (s.peak || {}).at ? new Date(s.peak.at).toISOString() : null },
    clientVersions: s.vers || {},
    serverVersions: Object.fromEntries(Object.entries(s.server || {}).map(([v, t]) => [v, new Date(t).toISOString()])),
    days, list: players,
  };
}

// Текстом для терминала
function printSummary(x) {
  const out = [];
  out.push(`Статистика OldGold с ${x.since.slice(0, 10)}`);
  out.push(`Игроков всего: ${x.players} · за неделю: ${x.activeWeek} · сегодня: ${x.today.players} (входов ${x.today.logins}) · сейчас в игре: ${x.onlineNow}`);
  out.push(`Пик онлайна: ${x.peak.n}${x.peak.at ? ' (' + x.peak.at.replace('T', ' ').slice(0, 16) + ' UTC)' : ''} · всего наиграно: ${x.totalHours} ч`);
  out.push('Версии клиента: ' + (Object.entries(x.clientVersions).map(([v, n]) => `${v} ×${n}`).join(', ') || '—'));
  out.push('', 'День        входов игроков  часов  пик');
  for (const d of x.days) out.push(`${d.day}  ${String(d.logins).padStart(6)} ${String(d.players).padStart(7)} ${String(d.hours).padStart(6)} ${String(d.peak).padStart(4)}`);
  out.push('', 'Игрок             входов   часов  последний вход     сетей');
  for (const p of x.list) out.push(`${(p.online ? '● ' : '  ') + p.nick.padEnd(16)} ${String(p.logins).padStart(6)} ${String(p.hours).padStart(7)}  ${(p.last || '').replace('T', ' ').slice(0, 16)}  ${String(p.nets).padStart(5)}`);
  return out.join('\n');
}

module.exports = { createStats, summary, printSummary };

if (require.main === module) {
  const dir = process.env.OLDGOLD_DATA || (fs.existsSync('/var/lib/oldgold') ? '/var/lib/oldgold' : path.join(__dirname, 'data'));
  let s;
  try { s = JSON.parse(fs.readFileSync(path.join(dir, 'stats.json'), 'utf8')); } catch (e) { console.log('Статистики ещё нет в', dir); process.exit(0); }
  const x = summary(s, s.onlineNow || []);   // «сейчас в игре» — на момент последнего сохранения (раз в 30 с)
  console.log(process.argv.includes('--json') ? JSON.stringify(x, null, 2) : printSummary(x));
}
