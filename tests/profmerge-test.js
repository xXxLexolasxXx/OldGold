'use strict';
// Слитые профессии (ПРОФЕССИИ_СЛИЯНИЕ.md): кузнец = металлург + бронник, лесничий = лесоруб + плотник,
// пастух = пастух-конюх + свинопас; дубильня отошла мяснику. Запуск: node tests/profmerge-test.js [игровых минут, по умолчанию 3]
//  1. каждый золотой сейв (одиночка и мир коопа) грузится: нет жителей старых профессий, у каждого здания рабочий
//     нужной профессии, в очереди и обучении школы нет старых ключей; игра идёт без исключений;
//  2. сейв с заранее подложенными старыми типами (плотник, бронник-armorer, свинопас в дубильне и в свинарнике,
//     обучение плотника, приоритет свинопаса) переводится правильно;
//  3. школа: старым профессиям не учат, у каждого обучаемого типа есть английское имя, в описаниях зданий нет исчезнувших профессий.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const L = require('./lib/sim');

const MIN = +process.argv[2] || 3;
const SAVES = path.join(__dirname, 'saves');
const fails = [];
let section = '';
const ok = (c, m) => { if (!c) { fails.push(`${section}: ${m}`); console.log(`  ✗ ${section}: ${m}`); } };
const quiet = sim => { sim.h.ctx.console = { ...console, warn() {}, error() {}, log() {} }; return sim; };
const GONE = ['carpenter', 'tanner', 'armorer', 'breeder', 'miller', 'hopgrower', 'stableman'];

const CHECK = `JSON.stringify((() => {
  const bad = [];
  for (const u of Game.units) if (!u.dead && UNIT_TYPES[u.type] && UNIT_TYPES[u.type].legacy) bad.push('житель ' + u.type);
  for (const b of Game.buildings) {
    if (b.worker && !b.worker.dead && b.worker.home === b && b.def.worker && b.worker.type !== b.def.worker && b.worker.type !== 'hero')
      bad.push(b.type + ': рабочий ' + b.worker.type + ' вместо ' + b.def.worker);
    for (const q of b.queue || []) if (UNIT_TYPES[q] && UNIT_TYPES[q].legacy) bad.push(b.type + ': в очереди ' + q);
    if (b.training && UNIT_TYPES[b.training.type] && UNIT_TYPES[b.training.type].legacy) bad.push(b.type + ': учится ' + b.training.type);
  }
  return bad;
})())`;

// ---------- 1. Золотые сейвы
const files = fs.readdirSync(SAVES).filter(f => /\.json(\.gz)?$/.test(f)).sort();
let legacySeen = 0;
for (const f of files) {
  section = f.replace(/\.json(\.gz)?$/, '');
  const raw = fs.readFileSync(path.join(SAVES, f));
  const text = /\.gz$/.test(f) ? zlib.gunzipSync(raw).toString('utf8') : raw.toString('utf8');
  const src = JSON.parse(text);
  const old = src.units.filter(u => GONE.includes(u.type)).length;
  legacySeen += old;
  const coop = /-coop-/.test(f);
  const sim = quiet(L.newSim(4242, { coop }));
  sim.h.ctx.__t = text;
  const err = sim.h.run('loadSaveText(__t)');
  ok(!err, `не загрузился: ${err}`);
  if (err) continue;
  ok(sim.h.run('Game.units.length') === src.units.length, 'число жителей изменилось');
  const bad = JSON.parse(sim.h.run(CHECK));
  ok(!bad.length, `после загрузки: ${bad.slice(0, 4).join('; ')}`);
  L.runFor(sim, MIN * 60, 10);
  ok(!sim.errors.length, `исключения за ${MIN} мин: ${sim.errors.slice(0, 2).join(' | ')}`);
  const bad2 = JSON.parse(sim.h.run(CHECK));
  ok(!bad2.length, `после ${MIN} мин: ${bad2.slice(0, 4).join('; ')}`);
  console.log(`  ✓ ${f}: старых профессий было ${old}`);
}
section = 'библиотека';
ok(legacySeen > 0, 'ни в одном золотом сейве нет старых профессий — проверять нечего');

// ---------- 2. Подложенные старые типы
section = 'подлог';
{
  const sim = quiet(L.newSim(7));
  L.runFor(sim, 60, 10);
  const text = sim.h.run(`(() => {
    const s = serializeGame();
    const at = (type) => { const i = s.buildings.findIndex(b => b.type === type); return i; };
    const add = (type, bt) => {
      let i = at(bt);
      if (i < 0) { const st = s.buildings[0]; s.buildings.push({ ...st, id: 900000 + s.buildings.length, type: bt, state: 'done', queue: [], training: null, stock: {}, usedOf: {}, pigs: undefined }); i = s.buildings.length - 1; }
      const b = s.buildings[i];
      const u = { ...s.units[0], type, home: b.id, h: undefined, tm: -1 };
      s.units.push(u);
    };
    add('carpenter', 'sawmill'); add('armorer', 'armory'); add('tanner', 'armory');
    add('breeder', 'tannery'); add('breeder', 'swine'); add('stableman', 'stable');
    s.units.push({ ...s.units[0], type: 'carpenter', home: undefined, h: undefined, tm: -1 });
    s.units.push({ ...s.units[0], type: 'armorer', home: undefined, h: undefined, tm: -1 });
    const sc = s.buildings.find(b => b.type === 'school');
    if (sc) { sc.queue = ['carpenter', 'tanner', 'breeder', 'serf']; sc.training = { type: 'armorer', t: 3 }; }
    s.pr = { jobs: { breeder: 0, carpenter: 3, smelter: 1 }, tasks: {} };
    return JSON.stringify(s);
  })()`);
  const s2 = quiet(L.newSim(8));
  s2.h.ctx.__t = text;
  const err = s2.h.run('loadSaveText(__t)');
  ok(!err, `не загрузился: ${err}`);
  if (!err) {
    const got = JSON.parse(s2.h.run(`JSON.stringify(Game.units.slice(-8).map(u => [u.type, u.home ? u.home.type : null]))`));
    const want = [['woodcutter', 'sawmill'], ['smelter', 'armory'], ['smelter', 'armory'], ['butcher', 'tannery'], ['herder', 'swine'], ['herder', 'stable'], ['woodcutter', null], ['smelter', null]];
    ok(JSON.stringify(got) === JSON.stringify(want), `типы: ${JSON.stringify(got)}`);
    const sc = JSON.parse(s2.h.run(`JSON.stringify((() => { const b = Game.buildings.find(b => b.type === 'school'); return b ? { q: b.queue, t: b.training && b.training.type } : null; })())`));
    if (sc) ok(JSON.stringify(sc) === JSON.stringify({ q: ['woodcutter', 'smelter', 'herder', 'serf'], t: 'smelter' }), `школа: ${JSON.stringify(sc)}`);
    // ручные приоритеты из старого сейва (поле pr) больше не читаются и не пишутся обратно
    ok(s2.h.run('Game.prio === undefined && !("pr" in serializeGame())'), 'старые приоритеты из сейва не проигнорированы');
    L.runFor(s2, 60, 10);
    ok(!s2.errors.length, `исключения: ${s2.errors.slice(0, 2).join(' | ')}`);
  }
  console.log('  ✓ подложенные старые профессии переведены');
}

// ---------- 3. Школа, имена, описания
section = 'школа';
{
  const sim = quiet(L.newSim(3));
  const keys = JSON.parse(sim.h.run('JSON.stringify(UNIT_KEYS)'));
  for (const k of GONE) ok(!keys.includes(k), `школа ещё учит ${k}`);
  for (const k of ['woodcutter', 'smelter', 'herder', 'butcher']) ok(keys.includes(k), `школа не учит ${k}`);
  const names = JSON.parse(sim.h.run('JSON.stringify(UNIT_KEYS.map(k => UNIT_TYPES[k].name))'));
  ok(JSON.stringify(['Лесничий', 'Кузнец', 'Пастух'].filter(n => !names.includes(n))) === '[]', `имена: ${names.join(', ')}`);
  const en = fs.readdirSync(path.join(__dirname, '../js/i18n')).map(f => fs.readFileSync(path.join(__dirname, '../js/i18n', f), 'utf8')).join('\n');
  for (const n of names) ok(en.includes(`"${n}":`) || en.includes(`'${n}':`), `нет английского имени для «${n}»`);
  const w = JSON.parse(sim.h.run(`JSON.stringify(Object.fromEntries(Object.entries(BUILDINGS).filter(([k, d]) => d.worker).map(([k, d]) => [k, d.worker])))`));
  for (const [b, t] of [['sawmill', 'woodcutter'], ['armory', 'smelter'], ['weaponsmith', 'smelter'], ['swine', 'herder'], ['tannery', 'butcher'], ['stable', 'herder']])
    ok(w[b] === t, `${b}: рабочий ${w[b]}, ждали ${t}`);
  const desc = sim.h.run(`Object.values(BUILDINGS).map(d => d.desc || '').join(' ')`);
  for (const word of ['Плотник', 'плотник', 'Металлург', 'металлург', 'Бронник', 'бронник', 'Свинопас', 'свинопас', 'Конюх', 'конюх', 'Лесоруб ', 'лесоруб '])
    ok(!desc.includes(word), `в описаниях зданий осталось «${word.trim()}»`);
}

if (fails.length) { console.log(`\nПРОВАЛ: ${fails.length}`); process.exit(1); }
console.log('\nСлияние профессий: всё в порядке');
process.exit(0);   // открытые таймеры симуляции держат процесс — иначе run.js ждёт до таймаута
