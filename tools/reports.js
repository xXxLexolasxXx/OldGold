'use strict';
// Отчёты игроков «Сообщить о проблеме» (js/telemetry.js → POST /report → <данные>/reports/<номер>/).
//   node tools/reports.js [папка данных]                 — список последних 30 (номер, время, версия, устройство, текст)
//   node tools/reports.js [папка данных] --all           — весь список
//   node tools/reports.js [папка данных] <номер>         — отчёт целиком: текст, устройство, журнал, пути к снимку и сейву
//   node tools/reports.js [папка данных] <номер> --log   — плюс все 200 строк консоли
// Номер можно писать частично (последние символы). Папка по умолчанию — $OLDGOLD_DATA или /var/lib/oldgold.
// Снимок забрать к себе: scp root@сервер:/var/lib/oldgold/reports/<номер>/shot.jpg .
const fs = require('fs');
const path = require('path');
// текст отчёта написал игрок: ESC-последовательности и прочие управляющие символы не пускаем в терминал
const tty = s => String(s).replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, '␀');

function list(dir) {
  const rdir = path.join(dir, 'reports');
  if (!fs.existsSync(rdir)) return [];
  const out = [];
  for (const n of fs.readdirSync(rdir).sort().reverse()) {
    try { out.push({ dir: path.join(rdir, n), ...JSON.parse(fs.readFileSync(path.join(rdir, n, 'report.json'), 'utf8')) }); } catch (e) { /* не отчёт */ }
  }
  return out;
}

function line(r) {
  return tty(`${r.n}  ${String(r.ts || '').replace('T', ' ').slice(0, 16)}  ${String(r.v).padEnd(8)} ${r.dev === 'phone' ? 'тел' : 'ПК '} ${r.mode === 'coop' ? 'кооп' : '    '} ${r.shot ? '📷' : '  '}${r.save ? '💾' : '  '}  ${String(r.text).replace(/\s+/g, ' ').slice(0, 90)}`);
}

function show(r, full) {
  const L = [`Отчёт ${r.n} · ${r.ts}`, `Версия ${r.v} · ${r.dev === 'phone' ? 'телефон' : 'компьютер'} ${r.scr} · ${r.br} / ${r.os} · ${r.mode === 'coop' ? 'кооператив' : 'одиночка'} · id ${r.id || '—'}`,
    '', 'Игрок пишет:', '  ' + String(r.text).split('\n').join('\n  '), ''];
  if (r.snap) L.push(`В момент отправки: экран ${r.snap.ph || '?'}, сутки ${r.snap.day ?? '?'}, жителей ${r.snap.pop ?? '?'}, ${r.snap.fps ?? '?'} к/с, герой ${r.snap.cls || '—'}, игровое время ${Math.round((r.snap.gt || 0) / 60)} мин; последнее событие: ${r.last || '—'}`);
  L.push(`Снимок: ${r.shot ? path.join(r.dir, 'shot.jpg') : 'нет'}`, `Сохранение: ${r.save ? path.join(r.dir, 'save.json') : 'нет'}`, '');
  if (r.crash) L.push('--- Журнал сбоев ---', r.crash, '');
  const log = r.log || [];
  L.push(`--- Консоль (${full ? 'все' : 'последние 30 из'} ${log.length} строк${full ? '' : '; --log — все'}) ---`, ...(full ? log : log.slice(-30)));
  return tty(L.join('\n'));
}

module.exports = { list, line, show };

if (require.main === module) {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  let dir = process.env.OLDGOLD_DATA || '/var/lib/oldgold', num = '';
  for (const a of args) if (fs.existsSync(path.join(a, 'reports')) || fs.existsSync(path.join(a, 'world.json'))) dir = a; else num = a;
  const all = list(dir);
  if (!num) {
    if (!all.length) { console.log('Отчётов пока нет (' + path.join(dir, 'reports') + ')'); process.exit(0); }
    console.log(`Отчётов: ${all.length}${process.argv.includes('--all') ? '' : ', показаны последние 30'}`);
    for (const r of process.argv.includes('--all') ? all : all.slice(0, 30)) console.log(line(r));
    process.exit(0);
  }
  const r = all.find(x => x.n === num) || all.find(x => x.n.endsWith(num));
  if (!r) { console.log('Нет отчёта ' + num); process.exit(1); }
  console.log(show(r, process.argv.includes('--log')));
}
