'use strict';
// Кооп после ПЕРЕЗАПУСКА сервера: мир с руной голема уходит на диск (world.json), новый сервер читает его
// JSON.parse'ом в основной области Node (loadSaveText), а игра и coopPlain живут в отдельной области vm.
// Баг 23.10 (f65d410): простые объекты «из чужой области» считались непростыми и уходили клиентам как null —
// клиент падал в golemDrawList на каждом кадре и не рисовал ни зданий, ни жителей. Аудит 0.11.33 этого не поймал,
// потому что сервер в тестах никогда не читал мир с диска. Здесь — путь «сохранить → новый хост → загрузить с диска → клиент».
const fs = require('fs');
const os = require('os');
const path = require('path');
const L = require('./lib/sim');
const { createWorldIO } = require('../server/worldio');

const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };
const quiet = sim => { sim.h.ctx.console = { ...console, warn() {}, error() {}, log() {} }; return sim; };

// поля зеркала coopMirror (js/coop/coopsim.js), которые приходят из coopPlain; массивы внутри не должны содержать null
const FIELDS = ['glq', 'golem', 'sub', 'foe', 'sp'];
const nulls = (v, p, out, d = 0) => {
  if (d > 6 || !v || typeof v !== 'object') return out;
  if (Array.isArray(v)) v.forEach((x, i) => { if (x === null || x === undefined) out.push(`${p}[${i}]`); else nulls(x, `${p}[${i}]`, out, d + 1); });
  else for (const k in v) nulls(v[k], p + '.' + k, out, d + 1);
  return out;
};

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oldgold-restart-'));
try {
  // 1. Первый запуск сервера: свежий мир, руны голема на месте, часть найдена, голем есть, сохраняем на диск
  const a = quiet(L.newSim(77, { coop: true }));
  a.h.run(`coopJoin('бот1', JSON.stringify({ cls: 'warrior' }))`);
  const runes = a.h.run('Game.glq && Game.glq.runes.length');
  ok(runes >= 3, `в новом мире рун голема ${runes}, ждали ≥ 3`);
  a.h.run('Game.glq.runes[0].got = true; Game.glq.known = true;');
  L.stepN(a, 200);
  const io1 = createWorldIO({ host: a.h, dir, file: path.join(dir, 'world.json'), log() {} });
  io1.write(a.h.run('JSON.stringify(serializeGame())'));
  ok(fs.existsSync(path.join(dir, 'world.json')), 'world.json не записан');

  // 2. «Перезапуск»: новый хост (новая область vm), мир читается с диска
  const b = quiet(L.newSim(78, { coop: true }));
  const io2 = createWorldIO({ host: b.h, dir, file: path.join(dir, 'world.json'), log() {} });
  const r = io2.load();
  ok(r.ok, 'мир не загрузился с диска: ' + JSON.stringify(r.tried));
  if (r.ok) {
    ok(b.h.run('Game.glq && Game.glq.runes.length') === runes, 'руны голема потерялись при загрузке');
    b.h.run(`coopJoin('бот1', JSON.stringify({ cls: 'warrior' }))`);
    L.stepN(b, 100);

    // 3. Зеркало на сервере: ни одной руны-null
    const mir = JSON.parse(b.h.run('JSON.stringify(coopMirror())'));
    for (const f of FIELDS) { const n = nulls(mir[f], f, []); ok(!n.length, `зеркало сервера после перезапуска: null в ${n.slice(0, 4).join(', ')}`); }
    ok(mir.glq && mir.glq.runes.every(x => x && typeof x.x === 'number'), 'руны в зеркале пустые или без координат');

    // 4. Клиент по пакетам нового сервера; render и golemDrawList не падают несколько кадров
    const cli = (() => {
      const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
      const files = [...html.matchAll(/<script[^>]*\ssrc="js\/([\w\/-]+)\.js"/g)].map(m => m[1]).filter(f => !['loading', 'perf'].includes(f));
      const c = L.newSim(1078, { files });
      c.h.run('coopInitHud = function () {}; coopInitControls = function () {}; coopRefreshHud = function () {}; coopVilHud = function () {}; coopQuestHud = function () {}; coopSaveCopy = function () {};');
      return quiet(c);
    })();
    const uid = b.h.run(`coop.players.get('бот1').id`);
    cli.h.ctx.__m = b.h.run(`coopInitPacket(${uid})`);
    cli.h.run('coopApplyInit(JSON.parse(__m))');
    b.h.run('coopWorldPacket()');
    for (let i = 1; i <= 120; i++) {
      L.stepN(b, 1);
      try { cli.h.run('coopStep(0.05)'); } catch (e) { fails.push('coopStep клиента: ' + e.message); break; }
      if (i % 4 === 0) { cli.h.ctx.__m = b.h.run('coopUnitsPacket()'); try { cli.h.run('coopHandle(JSON.parse(__m))'); } catch (e) { fails.push('пакет u: ' + e.message); break; } }
      if (i % 10 === 0) { const w = b.h.run('coopWorldPacket()'); if (w) { cli.h.ctx.__m = w; try { cli.h.run('coopHandle(JSON.parse(__m))'); } catch (e) { fails.push('пакет w: ' + e.message); break; } } }
    }
    for (const f of FIELDS) { const n = nulls(JSON.parse(cli.h.run(`JSON.stringify(Game.${f} === undefined ? null : Game.${f})`)), 'Game.' + f, []); ok(!n.length, `у клиента Game.${f}: null в ${n.slice(0, 4).join(', ')}`); }
    ok(cli.h.run('Game.glq && Game.glq.runes.length') === runes, 'клиент получил другое число рун');
    // отрисовка: golemDrawList (путь render; сам render в хосте без canvas не запустить) с заглушкой холста; несколько кадров
    try {
      cli.h.run(`(function () {
        const c = new Proxy(function () {}, { get: (t, k) => k === 'canvas' ? { width: 800, height: 600 } : c, apply: () => c, set: () => true });
        for (let k = 0; k < 5; k++) { const list = []; golemDrawList(list, c, 0, 0, Game.W || 400, Game.H || 400); for (const e of list) e[1](); }
      })()`);
    } catch (e) { fails.push('golemDrawList у клиента: ' + e.message); }
    if (cli.errors.length) fails.push('ошибки хоста клиента: ' + cli.errors.slice(0, 3).join(' | '));
  }
} finally { fs.rmSync(dir, { recursive: true, force: true }); }

console.log(`Проверка кооп-перезапуска: ${fails.length ? 'ПРОВАЛ' : 'ок'}`);
for (const f of fails) console.log('✗ ' + f);
process.exit(fails.length ? 1 : 0);
