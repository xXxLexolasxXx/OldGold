'use strict';
// Файл общего мира коопа (world.json): загрузка с миграцией, копии и откат. Вынесено из server.js ради теста
// (tests/save-test.js): после обновления игры мир должен подниматься, а при поломке — откатываться к копии, а не пропадать.
//
// Файлы в папке данных:
//   world.json             — текущий мир (запись через .tmp и переименование)
//   world.json.bak         — предыдущая запись (30 секунд назад)
//   world-snap-<время>.json— снимки раз в SNAP_EVERY (хранятся SNAP_KEEP последних): откат, если состояние испортилось «тихо»
//   world-pre-<версия>.json— мир ровно такой, каким его оставила прошлая версия игры, до первой загрузки новой (откат обновления)
//   world-broken-<время>.json — файл, который не удалось прочитать (не стирается и не затирается новым миром)
const fs = require('fs');
const path = require('path');

const SNAP_EVERY = 30 * 60 * 1000;
const SNAP_KEEP = 8;

function createWorldIO({ host, dir, file, log = () => {} }) {
  const WORLD = file || path.join(dir, 'world.json');
  const base = path.basename(WORLD, '.json');
  const run = code => host.run(code);
  let lastSnap = 0;

  const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');
  const snaps = () => fs.readdirSync(dir).filter(f => f.startsWith(base + '-snap-') && f.endsWith('.json')).sort().reverse().map(f => path.join(dir, f));
  const gvOf = text => { const m = /"gv":"([^"]*)"/.exec(text.slice(0, 160)) || /"gv":"([^"]*)"/.exec(text.slice(-200)); return m ? m[1] : '?'; };   // версия, записавшая файл
  const current = () => { try { return run('typeof GAME_VERSION === "undefined" ? "?" : GAME_VERSION'); } catch (e) { return '?'; } };

  // Применяет текст мира; возвращает текст ошибки или null
  function apply(text) {
    host.ctx.__saveText = text;
    try {
      const err = run('loadSaveText(__saveText)');
      if (!err) run('coopDropHeroes(); coopInitUnlocks();');
      return err;
    } catch (e) { return 'исключение: ' + (e && e.message || e); }
    finally { host.ctx.__saveText = null; }
  }

  // Кандидаты по порядку: основной файл, его копия, снимки (свежие первыми), копии «до обновления» (свежие первыми)
  function candidates() {
    const pre = fs.readdirSync(dir).filter(f => f.startsWith(base + '-pre-') && f.endsWith('.json')).map(f => path.join(dir, f))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    return [WORLD, WORLD + '.bak', ...snaps(), ...pre];
  }

  // { ok, from, migratedFrom, fatal } — fatal: 'newer', если мир записан более новой игрой (сервер откатили назад):
  // такой мир нельзя ни читать, ни затирать, пусть хозяин решает
  function load() {
    const out = { ok: false, from: null, migratedFrom: null, fatal: null, tried: [] };
    for (const f of candidates()) {
      if (!fs.existsSync(f)) continue;
      let text;
      try { text = fs.readFileSync(f, 'utf8'); } catch (e) { out.tried.push([path.basename(f), 'не читается: ' + e.message]); continue; }
      const gv = gvOf(text), now = current();
      const err = apply(text);
      if (!err) {
        out.ok = true; out.from = path.basename(f);
        // копия «до обновления»: файл записан другой версией игры — откладываем его как есть, пока новая версия его не перезаписала
        // (apply файл не меняет, так что копия остаётся точной и после успешной загрузки)
        if (f === WORLD && gv !== now) {
          const pre = path.join(dir, `${base}-pre-${gv.replace(/[^\w.-]/g, '_')}.json`);
          try { if (!fs.existsSync(pre)) { fs.copyFileSync(f, pre); log('мир записан версией', gv, '— копия до обновления:', path.basename(pre)); } } catch (e) { log('копия до обновления не вышла:', e.message); }
          out.migratedFrom = gv;
        }
        if (f !== WORLD) log('основной мир не прочитан, поднят из', path.basename(f));
        return out;
      }
      out.tried.push([path.basename(f), err]);
      log('не вышло прочитать', path.basename(f) + ':', err);
      if (/более новой версии/.test(err)) { out.fatal = 'newer'; return out; }
      // нечитаемый основной файл сохраняем для разбора: запись нового мира его иначе затёрла бы
      if (f === WORLD) { try { fs.copyFileSync(f, path.join(dir, `${base}-broken-${stamp()}.json`)); } catch (e) { /* не страшно */ } }
    }
    return out;
  }

  // Запись: .tmp → переименование, предыдущий файл в .bak, раз в SNAP_EVERY — снимок
  function write(text) {
    const tmp = WORLD + '.tmp';
    fs.writeFileSync(tmp, text);
    if (fs.existsSync(WORLD)) fs.copyFileSync(WORLD, WORLD + '.bak');
    fs.renameSync(tmp, WORLD);
    const t = Date.now();
    if (t - lastSnap >= SNAP_EVERY) {
      lastSnap = t;
      try {
        fs.copyFileSync(WORLD, path.join(dir, `${base}-snap-${stamp()}.json`));
        for (const old of snaps().slice(SNAP_KEEP)) fs.unlinkSync(old);
      } catch (e) { log('снимок мира не вышел:', e.message); }
    }
  }

  return { load, write, candidates, WORLD };
}

module.exports = { createWorldIO, SNAP_EVERY, SNAP_KEEP };
