'use strict';
// Автотесты OldGold без браузера. Запуск:
//   npm test                    — быстрый прогон (smoke, ~1–2 минуты)
//   npm run test:long           — длинный прогон (несколько игровых часов на нескольких сидах)
//   node tests/run.js --only sim --seeds 7,8 --minutes 30   — выборочно
// Наборы: load (порядок и синтаксис скриптов), sim (инварианты симуляции), save (сохранение→загрузка),
// det (детерминизм: один сид — одно и то же состояние), coop (клиент кооператива не расходится с сервером).
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { spawnSync } = require('child_process');
const L = require('./lib/sim');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const LONG = argv.includes('--long');
const ONLY = arg('only', '').split(',').filter(Boolean);
const SEEDS = arg('seeds', LONG ? '11,22,33,44' : '11,22').split(',').map(Number);
const MINUTES = +arg('minutes', LONG ? 120 : 15);
const COOP_MIN = +arg('coop-minutes', LONG ? 60 : 8);
const STUCK_SEC = 240;            // идущий житель стоит на месте дольше — «застрял»
const LIMITS = { units: 400, buildings: 600, animals: 500, piles: 800, floaters: 600, log: 2000, ents: 300, ghosts: 200, skels: 300, critters: 500, roadSites: 2000, falling: 300 };

const results = [];
const t00 = Date.now();
function test(name, fn) {
  if (ONLY.length && !ONLY.some(o => name.startsWith(o))) return;
  const t0 = Date.now(), r = { name, fails: [], warns: [], info: [] };
  process.stdout.write(`▶ ${name} … `);
  try { fn(r); } catch (e) { r.fails.push('исключение: ' + String(e && e.stack || e).split('\n').slice(0, 6).join('\n    ')); }
  r.ms = Date.now() - t0;
  results.push(r);
  console.log(`${r.fails.length ? '✗ ПРОВАЛ' : r.warns.length ? '⚠ есть замечания' : '✓'} (${(r.ms / 1000).toFixed(1)} с)`);
  for (const m of r.info) console.log('    · ' + m);
  for (const m of r.warns) console.log('    ⚠ ' + m);
  for (const m of r.fails) console.log('    ✗ ' + m);
}

// ---------- 1. Загрузка
// отдельный скрипт-проверка: строки «✗ …» — провалы, «⚠ …» — замечания, остальное без отступа — сводка
const scriptTest = (name, file, args = [], ms = 180000) => test(name, r => {
  const p = spawnSync(process.execPath, [path.join(__dirname, file), ...args], { encoding: 'utf8', timeout: ms });
  const out = (p.stdout || '') + (p.stderr || '');
  for (const l of out.split('\n')) {
    if (/^\s*✗/.test(l)) r.fails.push(l.replace(/^\s*✗\s*/, ''));
    else if (/^\s*⚠/.test(l)) r.warns.push(l.replace(/^\s*⚠\s*/, ''));
    else if (/^(Проверка|Сервер:)/.test(l)) r.info.push(l);
  }
  if (p.status !== 0 && !r.fails.length) r.fails.push(out.trim().slice(0, 500) || 'код выхода ' + p.status);
});
scriptTest('load: скрипты, пути, синтаксис', 'check-load.js');
scriptTest('server: раздача файлов, /err, /e, /t, /report, /stats', 'server-test.js');
scriptTest('crashlog: причины вылетов, отчёты, лимиты', 'crashlog-test.js');
scriptTest('telemetry: статистика по согласию, отчёты о проблемах, удаление по id', 'telemetry-test.js');
scriptTest('neutrals2: ранги и новые народы леса, сейв', 'neutrals2-test.js');
scriptTest('wildlife: живность по биомам и дням, меньше фей, потолки на экран, сейв', 'wildlife-test.js');
scriptTest('frogfolk: жаболюды — поселения у воды, касты, прыжок, влажность, яд, зима, сейв', 'frogfolk-test.js');
scriptTest('raid: курган Курганного князя — вход по клику в одиночке и в коопе, подпись, причины, сейв', 'raid-test.js');
scriptTest('season: сезоны по 8 суток, старые сейвы, снег', 'season-test.js');
scriptTest('disaster: стихийные бедствия — знамения, виды на сидах, колодец, ремонт, море, сейв, кооп', 'disaster-test.js', [], 420000);
scriptTest('skate: коньки, возврат со льда на свой берег, герой катится по льду', 'skate-test.js');
scriptTest('prio: приоритеты работ, сохранение', 'prio-test.js');
scriptTest('workers: управление рабочими, пинок, маршруты, сохранение, кооп', 'workers-test.js');
scriptTest('unions: профсоюзы — советы по стройке и ремеслу, редкий показ, выключатель, сейв, кооп', 'unions-test.js');
scriptTest('guildbuild: достройка гильдии не трогает билд героя, переучивание только по кнопке, сейв', 'guildbuild-test.js');
scriptTest('law: указы деревни, сохранение', 'law-test.js');
scriptTest('nightfog: ночной туман не гуще потолка и редеет над деревней', 'nightfog-test.js');
scriptTest('sick: болезни и лазарет, сохранение', 'sick-test.js');
scriptTest('injury: травмы — частота, лазарет, лекарь, сводка, груз, куры', 'injury-test.js');
scriptTest('rsc: открытия, сохранение', 'rsc-test.js');
scriptTest('fam: семьи и поколения, сохранение', 'fam-test.js');
scriptTest('zemelka: ножички — партия гномов, болельщики, партия героя, сохранение', 'zemelka-test.js');
scriptTest('kids: детские игры, замки, приручение, трубка, взросление', 'kids-test.js');
scriptTest('sea: море, обитатели, рыбацкая хижина, кракен, шторм, сейв', 'sea-test.js');
scriptTest('folk: гномки и гномята — облик, пиво, «Бах!», не дерутся, сейв', 'folk-test.js');
scriptTest('durability: прочность снаряжения, ремонт, очередь доспехов, сейв', 'durability-test.js');
scriptTest('arms: оружейная рано, особое оружие гильдий, заточка, свойства 3 уровня, сейв', 'arms-test.js');
scriptTest('oath: Клятвы предков — 10 классов героя, задания по ролям, сохранение', 'oath-test.js');
scriptTest('spire: глава 6 — подъём к Чёрному шпилю: стражи, врата, башни, затмение, Малгор, победа', 'spire-test.js', [], 420000);
scriptTest('traitor: шпион Малгора — летописец Пим, письмо, простить/не прощать, удар в спину, падение, сейв, эпилог', 'traitor-test.js', [], 420000);
scriptTest('oathbal: баланс классов героя', 'oath-balance.js');
scriptTest('abil: способности классов, ресурс, лечение отдыхом, панель, миграция, кооп, баланс', 'abil-test.js');
scriptTest('icon: значки, названия и описания всех способностей, окно гильдии', 'icon-test.js');
scriptTest('tempo: кооп-пауза, скорость, приоритеты', 'tempo-test.js');
scriptTest('chronicle: летопись деревни', 'chronicle-test.js');
scriptTest('lore: фрагменты истории, главы, перевод', 'lore-test.js');
scriptTest('photo: фото-режим, рамки и фильтры', 'photo-test.js');
scriptTest('daily: вызов дня', 'daily-test.js');
scriptTest('maps: свои карты — формат, проверка, мир, сейв, цель', 'maps-test.js');
scriptTest('newworld: хост начинает мир на своей карте', 'newworld-test.js');
scriptTest('piles: мусор не копится, потолок кучек, подпись подбора', 'piles-test.js');
scriptTest('leprechaun: лепреконы у рудников, споры за слиток, лимиты золота, сейв', 'leprechaun-test.js');
scriptTest('trav: одинокие путники — смайлики, разговор, вор, разбойник, сохранение', 'trav-test.js');
scriptTest('wild: поселения диких гномов — число на картах, обмен, караван, купец, поединок, бунт, сейв', 'wild-test.js', [], 600000);
scriptTest('whatsnew: пропущенные обновления в окне «Что нового»', 'whatsnew-test.js');
scriptTest('house: жилые дома — виды, семьи, ночёвка, укрытие от нечисти, сейв, кооп, баланс', 'house-test.js');
scriptTest('late: стройка, логистика и школа в большой деревне', 'lategame-test.js', LONG ? [] : ['--no-big']);

// ---------- 2. Симуляция: инварианты
function simRun(seed, minutes, r, opts = {}) {
  const sim = L.newSim(seed);
  const start = L.inspect(sim);
  const hist = [];
  const stuckSeen = new Map();
  L.runFor(sim, minutes * 60, 30, k => {
    if (k % 2 === 0) L.botTurn(sim);
    const c = L.checkInvariants(sim, `сид ${seed}, ${Math.round(sim.h.run('Game.time') / 60)} мин`);
    for (const p of c.problems) if (r.fails.length < 12) r.fails.push(p);
    for (const k2 in LIMITS) if (c.r.n[k2] > LIMITS[k2]) { const m = `сид ${seed}: ${k2} = ${c.r.n[k2]} больше предела ${LIMITS[k2]}`; if (!r.fails.includes(m)) r.fails.push(m); }
    for (const [type, id, sec, x, y] of c.r.stuck) if (sec > STUCK_SEC && !stuckSeen.has(id)) stuckSeen.set(id, `${type}#${id} стоит ${sec} с у (${x},${y})`);
    hist.push(c.r.n);
    if (c.problems.length) throw new Error('инвариант нарушен — дальше не считаем');
  });
  for (const e of sim.errors) r.fails.push(`сид ${seed}: ${e}`);
  for (const s of stuckSeen.values()) r.fails.push(`сид ${seed}: застрял ${s}`);
  // «растёт без границы»: во второй половине прогона коллекция продолжает расти почти линейно
  const end = L.inspect(sim), mid = hist[Math.floor(hist.length / 2)] || end.n;
  for (const k of Object.keys(LIMITS)) {
    const a = mid[k] || 0, b = end.n[k] || 0, q = hist[Math.floor(hist.length * 3 / 4)] ? hist[Math.floor(hist.length * 3 / 4)][k] : b;
    if (k === 'log') continue;      // журнал ограничен LOG_MAX (events.js) и на время прогона просто копится; предел проверяет LIMITS
    if (b > 60 && b > a * 2 && q > a && b > q) r.warns.push(`сид ${seed}: ${k} растёт: ${a} → ${q} → ${b}`);
  }
  // товары: в деревне не может оказаться больше, чем было + произведено (запас на подарки, сундуки и находки)
  for (const g in end.goods) {
    const have = end.goods[g], was = start.goods[g] || 0, made = end.produced[g] || 0;
    if (have > was + made + 40) r.warns.push(`сид ${seed}: товара ${g} ${have}, а было ${was} и произведено ${made}`);
  }
  r.info.push(`сид ${seed}: ${minutes} мин игры — жителей ${start.n.units}→${end.n.units}, зданий ${end.n.buildings}, потерь ${sim.h.run('Game.lostGnomes || 0')}, сделано: ` +
    (Object.entries(end.produced).filter(e => e[1] && e[0] !== 'ash').map(e => e[0] + ' ' + e[1]).join(', ') || 'ничего'));
  return sim;
}
const sims = {};
for (const seed of SEEDS) test(`sim: сид ${seed}, ${MINUTES} мин`, r => { sims[seed] = simRun(seed, MINUTES, r); });

// ---------- 3. Сохранение → загрузка
function diffObj(a, b, p = '', out = []) {
  if (out.length >= 12) return out;
  if (a === b) return out;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') {
    if (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-6) return out;
    out.push(`${p || '(корень)'}: ${JSON.stringify(a)?.slice(0, 80)} ≠ ${JSON.stringify(b)?.slice(0, 80)}`); return out;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) diffObj(a[k], b[k], p ? p + '.' + k : k, out);
  return out;
}
test('save: сохранение → загрузка даёт то же состояние', r => {
  const src = sims[SEEDS[0]] || simRun(SEEDS[0], 5, { fails: [], warns: [], info: [] });
  const t1 = src.h.run('JSON.stringify(serializeGame())');
  const dst = L.newSim(999);
  dst.h.ctx.__t = t1;
  const err = dst.h.run('loadSaveText(__t)');
  if (err) { r.fails.push('загрузка не удалась: ' + err); return; }
  const t2 = dst.h.run('JSON.stringify(serializeGame())');
  const o1 = JSON.parse(t1), o2 = JSON.parse(t2);
  // счётчик id после загрузки может уйти вперёд (заново рождаются звери и т.п.), но не назад
  if (o2.nextId < o1.nextId) r.fails.push(`nextId после загрузки меньше: ${o2.nextId} < ${o1.nextId}`);
  delete o1.nextId; delete o2.nextId;
  const d = diffObj(o1, o2);
  if (d.length) r.fails.push('после загрузки отличается:\n      ' + d.join('\n      '));
  r.info.push(`сейв ${(t1.length / 1024).toFixed(0)} КБ, ${JSON.parse(t1).buildings.length} зданий, ${JSON.parse(t1).units.length} жителей`);
  // загруженный мир должен жить дальше
  L.stepN(dst, 2400);
  for (const e of dst.errors) r.fails.push('после загрузки: ' + e);
  const c = L.checkInvariants(dst, 'после загрузки');
  r.fails.push(...c.problems);
  // битые сейвы: игра не падает и честно сообщает
  const bad = L.newSim(5);
  bad.h.ctx.console = { ...console, warn() {} };   // ожидаемые предупреждения о битом сейве не засоряют отчёт
  for (const [name, text] of [['обрезанный', t1.slice(0, t1.length >> 1)], ['мусор', '{"v":2}'], ['из будущего', JSON.stringify({ ...JSON.parse(t1), sv: 999 })]]) {
    bad.h.ctx.__t = text;
    let e;
    try { e = bad.h.run('loadSaveText(__t)'); } catch (x) { e = null; r.fails.push(`битый сейв (${name}) уронил загрузку: ${x.message}`); }
    if (!e) r.fails.push(`битый сейв (${name}) принят как нормальный`);
  }
  // loadGame с битым сейвом и резервной копией: должна подняться копия
  bad.h.run(`localStorage.setItem(SAVE_KEY + 'auto', '{"v":2,'); localStorage.setItem(SAVE_KEY + 'auto.bak', __t0)`.replace('__t0', JSON.stringify(t1)));
  const ok = bad.h.run(`loadGame('auto')`);
  if (!ok || bad.h.run('Game.buildings.length') !== JSON.parse(t1).buildings.length) r.fails.push('резервная копия автосейва не подхватилась');
  if (!/резервная копия/.test(bad.h.run('saveBrokenNotice.last || ""'))) r.fails.push('игрок не получил сообщения о битом сейве');
});

// ---------- 4. Детерминизм
test('det: один сид — одинаковое состояние', r => {
  const run = () => { const s = L.newSim(77); L.runFor(s, 300, 30, k => { if (k % 2 === 0) L.botTurn(s); }); return L.fingerprint(s); };
  const a = run(), b = run();
  if (a.hash !== b.hash) {
    const d = diffObj(JSON.parse(a.text), JSON.parse(b.text));
    r.warns.push('два прогона одного сида разошлись (где-то случайность не через Math.random или зависимость от реального времени):\n      ' + d.slice(0, 6).join('\n      '));
  } else r.info.push(`отпечаток ${a.hash}, ${(a.size / 1024).toFixed(0)} КБ`);
});

// ---------- 5. Кооператив: клиент по пакетам сервера видит тот же мир
function loadClient(seed) {
  // клиент — тот же порядок, что в index.html, кроме заставки загрузки и счётчика кадров
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const files = [...html.matchAll(/<script[^>]*\ssrc="js\/([\w\/-]+)\.js"/g)].map(m => m[1]).filter(f => !['loading', 'perf'].includes(f));
  const c = L.newSim(seed + 1000, { files });
  c.h.run('unlockAll = typeof unlockAll === "function" ? unlockAll : function () {}; coopInitHud = function () {}; coopInitControls = function () {}; coopRefreshHud = function () {}; coopVilHud = function () {}; coopQuestHud = function () {}; coopSaveCopy = function () {};');
  return c;
}
const COOP_DIGEST = `JSON.stringify({
  roads: [...World.road.keys()].filter(i => World.road[i]).join(','),
  b: Game.buildings.map(b => [b.id, b.type, b.x, b.y, b.state, b.level || 1].join(':')).sort().join(' '),
  objs: World.obj.reduce((a, o, i) => o ? a + 1 : a, 0),
  objT: World.obj.reduce((a, o) => (o && (a[o.t] = (a[o.t] || 0) + 1), a), {}),
  rs: [...Game.roadSites.keys()].sort((a, b) => a - b).join(','),
  piles: [...Game.piles.values()].filter(p => !p.removed).length,
})`;
test(`coop: клиент не расходится с сервером, ${COOP_MIN} мин`, r => {
  const seed = 31;
  const srv = L.newSim(seed, { coop: true });
  srv.h.run(`coopJoin('бот1', JSON.stringify({ cls: 'warrior' })); coopJoin('бот2', JSON.stringify({ cls: 'mage' }))`);
  const cli = loadClient(seed);
  const uid = srv.h.run(`coop.players.get('бот1').id`);
  cli.h.ctx.__m = srv.h.run(`coopInitPacket(${uid})`);
  cli.h.run('coopApplyInit(JSON.parse(__m))');
  srv.h.run('coopWorldPacket()');   // первая дельта после init — базовая
  let mism = 0;
  const steps = COOP_MIN * 60 / 0.05;
  for (let i = 1; i <= steps; i++) {
    L.stepN(srv, 1);
    try { cli.h.run('coopStep(0.05)'); } catch (e) { r.fails.push('coopStep клиента: ' + e.message); break; }
    if (i % 4 === 0) { cli.h.ctx.__m = srv.h.run('coopUnitsPacket()'); try { cli.h.run('coopHandle(JSON.parse(__m))'); } catch (e) { r.fails.push('пакет u: ' + e.message); break; } }
    if (i % 10 === 0) { const w = srv.h.run('coopWorldPacket()'); if (w) { cli.h.ctx.__m = w; try { cli.h.run('coopHandle(JSON.parse(__m))'); } catch (e) { r.fails.push('пакет w: ' + e.message); break; } } }
    // сверка — сразу после рассылки пакетов этого шага (i кратно 4 и 10), до новых команд
    if (i % 1200 === 0) {
      const a = JSON.parse(srv.h.run(COOP_DIGEST)), b = JSON.parse(cli.h.run(COOP_DIGEST));
      const d = diffObj(a, b);
      if (d.length && mism++ < 3) r.fails.push(`${Math.round(i * 0.05 / 60)} мин: клиент видит другое:\n      ` + d.slice(0, 5).join('\n      '));
      const nu = srv.h.run('Game.units.filter(u => !u.dead).length'), cu = cli.h.run('Game.units.length');
      if (nu !== cu && mism++ < 3) r.fails.push(`${Math.round(i * 0.05 / 60)} мин: жителей на сервере ${nu}, у клиента ${cu}`);
    }
    if (i % 600 === 0) {
      srv.h.run(`coopCmd('бот1', JSON.stringify({ t: 'go', x: Math.floor(coop.players.get('бот1').x) + ${(i / 600) % 5 - 2}, y: Math.floor(coop.players.get('бот1').y) + 1 }), true)`);
      L.botTurn(srv);
    }
  }
  // настроение: клиент просит данные гнома (mpick) — сервер присылает число, потребности и причины только для него
  {
    const gid = srv.h.run('(Game.units.find(u => mdOn(u) && u.md) || {}).id');
    if (gid) {
      srv.h.run(`coopCmd('бот1', JSON.stringify({ t: 'mpick', id: ${gid} }), true)`);
      L.stepN(srv, 60);
      cli.h.ctx.__m = srv.h.run('coopUnitsPacket()'); cli.h.run('coopHandle(JSON.parse(__m))');
      const d = cli.h.run(`(function () { const u = Game.unitMap.get(${gid}); return u && u.mdr && mdCardData(u) ? JSON.stringify(mdCardData(u)) : ''; })()`);
      if (!d) r.fails.push('настроение: клиент не получил данные выбранного гнома (mdr)');
      else { const o = JSON.parse(d); if (!(o.m >= 0 && o.m <= 100) || o.n.length !== 7 || !o.r.length) r.fails.push('настроение: данные гнома у клиента неполные: ' + d); }
      const html = cli.h.run(`mdCardHTML(Game.unitMap.get(${gid}))`);
      if (!/Потребности/.test(html)) r.fails.push('настроение: карточка гнома у клиента пустая');
    }
  }
  for (const e of srv.errors) r.fails.push('сервер: ' + e);
  for (const e of cli.errors) r.fails.push('клиент: ' + e);
  const c = L.checkInvariants(srv, 'кооп-сервер');
  r.fails.push(...c.problems);
  r.info.push(`героев ${srv.h.run('coop.players.size')}, зданий ${c.r.n.buildings}, жителей ${c.r.n.units}`);
});

// ---------- Итог
const fails = results.filter(r => r.fails.length), warns = results.filter(r => r.warns.length);
console.log(`\n${results.length} проверок за ${((Date.now() - t00) / 1000).toFixed(0)} с: ` +
  `${results.length - fails.length} прошло, ${fails.length} провалено${warns.length ? `, с замечаниями ${warns.length}` : ''}.`);
if (argv.includes('--json')) fs.writeFileSync(arg('json'), JSON.stringify(results, null, 2));
process.exit(fails.length ? 1 : 0);
