'use strict';
// Сводка анонимной статистики (js/telemetry.js → POST /t → <данные>/telemetry/*.jsonl).
// Запуск на сервере:  node tools/stats-report.js [папка данных] [--days=14] [--json]
// По умолчанию папка — $OLDGOLD_DATA или /var/lib/oldgold.
// Что показывает: сколько установок и партий, медианное время партии, телефоны/ПК, FPS, где умирают деревни и герои,
// что строят, где бросают (последний экран/событие перед закрытием), частые ошибки по версиям (+ сводка /err).
const fs = require('fs');
const path = require('path');

function load(dir, days) {
  const tdir = path.join(dir, 'telemetry'), from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const out = [];
  if (!fs.existsSync(tdir)) return out;
  for (const f of fs.readdirSync(tdir).filter(x => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(x) && x.slice(0, 10) >= from).sort()) {
    for (const l of fs.readFileSync(path.join(tdir, f), 'utf8').split('\n')) {
      if (!l) continue;
      try { out.push(JSON.parse(l)); } catch (e) { /* битая строка */ }
    }
  }
  return out;
}

const median = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const inc = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
const top = (o, n = 10) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);

function summarize(rows, dir) {
  const ids = new Set(), sess = new Map(), dev = {}, ver = {}, fps = { phone: [], pc: [] }, modes = {};
  const vdeath = [], vcause = {}, vday = {}, hdeath = {}, built = {}, quit = {}, quitEv = {}, errs = {}, cls = {};
  let wins = 0;
  for (const r of rows) {
    ids.add(r.id);
    let s = sess.get(r.s);
    if (!s) sess.set(r.s, s = { id: r.id, v: r.v, dev: r.dev, play: 0, gt: 0, day: 0, last: null, end: null });
    s.play = Math.max(s.play, r.play || r.t || 0); s.gt = Math.max(s.gt, r.gt || 0); s.day = Math.max(s.day, r.day || 0); s.last = r;
    if (r.k === 'end') s.end = r;
    if (r.k === 'start') { inc(dev, r.dev); inc(ver, r.v); inc(modes, r.mode); }
    if (r.k === 'beat') {
      if (r.fps) fps[r.dev === 'phone' ? 'phone' : 'pc'].push(r.fps);
      for (const [b, n] of Object.entries(r.b || {})) inc(built, b, n);
      if (r.cls) s.cls = r.cls;
    }
    if (r.k === 'vdeath') { vdeath.push(r); inc(vday, r.day <= 3 ? '1–3' : r.day <= 7 ? '4–7' : r.day <= 15 ? '8–15' : r.day <= 30 ? '16–30' : '31+'); for (const [c, n] of Object.entries(r.causes || {})) inc(vcause, c, n); }
    if (r.k === 'win') wins++;
    if (r.k === 'hdeath') inc(hdeath, r.why || 'unknown');
    if (r.k === 'err') inc(errs, `${r.v} · [${r.ek || '?'}] ${r.m || ''} ${r.f || ''}`.trim());
  }
  const S = [...sess.values()];
  for (const s of S) { if (s.cls) inc(cls, s.cls); const e = s.end || s.last; if (e) { inc(quit, `${e.ph || '?'} · сутки ${e.day || 0}`); if (e.last) inc(quitEv, e.last); } }
  let solo = null;
  try { solo = require('../server/errors').createErrors(dir).summary(); } catch (e) { /* нет errors.json */ }
  return {
    installs: ids.size, sessions: S.length, medianPlayMin: +(median(S.map(s => s.play)) / 60).toFixed(1), medianGameDays: median(S.map(s => s.day)),
    devices: dev, versions: ver, modes, fpsMedian: { phone: median(fps.phone), pc: median(fps.pc) }, heroClasses: cls,
    villageDeaths: vdeath.length, wins, villageDeathDays: vday, villageDeathCauses: vcause, medianDeathDay: median(vdeath.map(v => v.day || 0)),
    heroDeaths: hdeath, built: top(built, 15), quitWhere: top(quit, 10), quitLastEvent: top(quitEv, 10), errors: top(errs, 15),
    serverErrors: solo ? solo.top.slice(0, 10).map(e => ({ n: e.n, m: e.m, f: e.f, v: e.v })) : [],
  };
}

const CAUSE = { starve: 'голод', skeleton: 'скелеты', fog: 'туман', chickens: 'куры', cold: 'холод', night: 'ночью (прочее)', other: 'днём (прочее)' };
function print(x, days) {
  const kv = o => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ') || '—';
  const L = [`=== Статистика по согласию за ${days} дн. ===`,
    `Установок (случайных id): ${x.installs}, партий (запусков): ${x.sessions}`,
    `Медианное время партии: ${x.medianPlayMin} мин, игровых суток: ${x.medianGameDays}`,
    `Устройства: ${kv(x.devices)} · режим: ${kv(x.modes)} · версии: ${kv(x.versions)}`,
    `FPS медиана: телефон ${x.fpsMedian.phone || '—'}, ПК ${x.fpsMedian.pc || '—'}`,
    `Классы героя: ${kv(x.heroClasses)}`, '',
    `Деревни погибли: ${x.villageDeaths} (побед: ${x.wins}), медиана — на ${x.medianDeathDay} сутки`,
    `  по суткам: ${kv(x.villageDeathDays)}`,
    `  отчего гибли жители: ${Object.entries(x.villageDeathCauses).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${CAUSE[k] || k} ${n}`).join(', ') || '—'}`,
    `Герой повержен: ${kv(x.heroDeaths)}`, '',
    'Что строят: ' + (x.built.map(([k, n]) => `${k} ${n}`).join(', ') || '—'), '',
    'Где закончили партию (экран · сутки):', ...x.quitWhere.map(([k, n]) => `  ${String(n).padStart(5)}  ${k}`),
    'Последнее событие перед выходом:', ...x.quitLastEvent.map(([k, n]) => `  ${String(n).padStart(5)}  ${k}`), '',
    'Частые ошибки (по версиям, из статистики):', ...(x.errors.length ? x.errors.map(([k, n]) => `  ${String(n).padStart(5)}×  ${k}`) : ['  —']),
  ];
  if (x.serverErrors.length) L.push('Ошибки из /err (все игроки, без id):', ...x.serverErrors.map(e => `  ${String(e.n).padStart(5)}×  ${e.m}  ${e.f}  версии: ${Object.keys(e.v).slice(0, 3).join(', ')}`));
  return L.join('\n');
}

module.exports = { load, summarize, print };

if (require.main === module) {
  const dir = process.argv.find((a, i) => i > 1 && !a.startsWith('--')) || process.env.OLDGOLD_DATA || '/var/lib/oldgold';
  const days = +((process.argv.find(a => /^--days=\d+$/.test(a)) || '--days=14').split('=')[1]);
  const x = summarize(load(dir, days), dir);
  console.log(process.argv.includes('--json') ? JSON.stringify(x, null, 2) : print(x, days));
}
