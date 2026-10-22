'use strict';
// Кампания (js/campaign.js, КАМПАНИЯ.md): акт 1 «Праздник Первого Камня» проходится ботом от заставки до итога.
// Бот делает то, что сделал бы игрок: ведёт героя в зоны целей, ставит стройплощадку башни у штрека, помогает
// добить гоблинов (задержавшихся дольше 25 с), остальное — сама игра (пивоварня, пекарня, строители, башни, ночь).
// Проверяется: шаги идут по порядку, взрыв и крен горы, сохранение посреди акта → загрузка → тот же шаг,
// итог «победа», прогресс и наследие в localStorage, акт 2 открыт; поражение при гибели жителей.
// Строки «✗ …» — провалы, «⚠ …» — замечания (формат tests/run.js).
const { createHost } = require('../server/simhost');

const fails = [], warns = [];
const fail = m => { fails.push(m); console.log('✗ ' + m); };
const warn = m => { warns.push(m); console.log('⚠ ' + m); };

function host(seed) {
  const errors = [];
  const h = createHost(m => errors.push(m));
  h.ctx.__seed = seed;
  h.run('Math.random = (() => { let s = __seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })()');
  return { h, errors };
}

const BOT = `(function () {
  const C = Game.camp; if (!C || C.over) return;
  const hero = campHero();
  // герой — в зону невыполненной цели (как клик игрока по карте: идёт сам, если путь есть; застрял — переносим)
  const z = C.objs && C.objs.find(o => o.z && o.cur < o.need && o.t.startsWith('Герой'));
  if (hero && z) {
    Game.__botZ = Game.__botZ || { key: '', t: 0 };
    const key = z.z.join(',');
    if (Game.__botZ.key !== key) { Game.__botZ = { key, t: Game.time }; const c = resolveCmd([z.z[0], z.z[1]]); if (c) issueCmd(hero, c); }
    if (Game.time - Game.__botZ.t > 40) { hero.x = z.z[0] + 0.5; hero.y = z.z[1] + 0.5; hero.path = null; }
  }
  // башня у штрека: стройплощадка (строители достроят сами)
  const tw = C.objs && C.objs.find(o => o.t.includes('башню') && o.cur < o.need);
  if (tw && !Game.__botTower) {
    for (let r = 4; r < 12 && !Game.__botTower; r++) for (let a = 0; a < 16 && !Game.__botTower; a++) {
      const x = Math.round(CAMP1.mine[0] + Math.cos(a * 0.39) * r), y = Math.round(CAMP1.mine[1] + 6 + Math.abs(Math.sin(a * 0.39)) * r * 0.6);
      if (inb(x, y) && !checkPlacement('watchtower', x, y, 0)) { Game.__botTower = placeBuilding('watchtower', x, y, false, 0); }
    }
  }
  // гоблины: дерущихся дольше 25 с бот «добивает» героем (иначе прогон слишком зависит от случайных стычек)
  for (const N of Game.raiders) {
    if (N.st === 'die' || N.st === 'vanish' || !N.ctag) continue;
    N.__seen = N.__seen || Game.time;
    if (Game.time - N.__seen > 25) foeKill(N, hero);
  }
})()`;

// ---------- 1. Акт 1 целиком ----------
{
  const { h, errors } = host(4242);
  const t0 = Date.now();
  h.run('campStart(1); Game.heroAsk = false;');
  const info = JSON.parse(h.run('JSON.stringify({ b: Game.buildings.length, town: Game.camp.flags.town, p: campPeople(), foe: !!(Game.foe && Game.foe.camp), w: MAP_W, h: MAP_H, custom: !!MapOpt.custom })'));
  console.log(`Проверка: город ${info.b} зданий (по сценарию ${info.town}), жителей ${info.p}, карта ${info.w}×${info.h}`);
  if (info.town < 28) fail(`город построен не полностью: ${info.town} зданий по сценарию из 36`);
  if (info.p < 30) fail(`жителей в Подгорье мало: ${info.p}`);
  if (!info.foe) fail('Малгор в кампании должен быть заглушкой (Game.foe.camp)');
  if (!info.custom) fail('мир акта строится не по карте (MapOpt.custom)');
  const seen = [];
  let saved = null, lastI = -1, boomSeen = false, tiltMax = 0, minPeople = 999;
  for (let sec = 0; sec < 75 * 60; sec++) {
    try { h.run('for (let k = 0; k < 20; k++) step(0.05);'); h.run(BOT); } catch (e) { fail('исключение на ' + sec + ' с: ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')); break; }
    if (sec % 2) continue;
    const s = JSON.parse(h.run('JSON.stringify({ i: Game.camp.i, k: (campStepNow(Game.camp) || {}).k, over: Game.camp.over, tilt: Game.camp.tilt, boom: !!Game.camp.flags.boom, p: campPeople(), lbl: Game.camp.label })'));
    if (s.i !== lastI) { seen.push(`${s.i}:${s.k}@${sec}`); lastI = s.i; }
    if (s.boom) boomSeen = true;
    tiltMax = Math.max(tiltMax, s.tilt);
    minPeople = Math.min(minPeople, s.p);
    // сохранение посреди акта (после первой контрольной точки, до ночи) → загрузка: тот же шаг и флаги
    if (!saved && s.i >= 6 && s.k === 'goal') {
      saved = h.run('JSON.stringify(serializeGame())');
      const back = JSON.parse(h.run(`(function () { const a = Game.camp.i, f = JSON.stringify(Game.camp.flags.hall); applySave(JSON.parse(${JSON.stringify(saved)})); return JSON.stringify({ a, b: Game.camp && Game.camp.i, same: JSON.stringify(Game.camp && Game.camp.flags.hall) === f, foe: !!(Game.foe && Game.foe.camp), raiders: Game.raiders.filter(N => N.k === 'malgor').length, custom: !!MapOpt.custom }); })()`));
      if (back.a !== back.b || !back.same) fail(`сохранение кампании: после загрузки шаг ${back.b} вместо ${back.a}`);
      if (!back.foe || back.raiders) fail('после загрузки в кампании ожил Малгор');
      if (!back.custom) fail('после загрузки потерялась карта акта');
    }
    if (s.over) {
      console.log(`Проверка: итог «${s.over.res}» на ${Math.round(sec / 60)} мин игрового времени (${s.over.why || 'без причины'}), звёзд ${s.over.stars}, жителей ${s.over.stats.alive}`);
      if (s.over.res !== 'win') fail('акт 1 не пройден: ' + s.over.why);
      break;
    }
  }
  if (process.env.CAMP_DEBUG) console.log(h.run(`JSON.stringify({ objs: Game.camp.objs, prod: Game.produced, st: Game.buildings.find(b => b.type === 'storehouse').stock, brew: Game.buildings.filter(b => b.type === 'brewery' || b.type === 'bakery' || b.type === 'mill').map(b => [b.type, b.worker && b.worker.type, JSON.stringify(b.stock), b.paused, b.dmg]), sc: campFoes('scout').map(N => [N.st, N.x.toFixed(1), N.y.toFixed(1), N.hold]) })`));
  const end = JSON.parse(h.run('JSON.stringify({ over: Game.camp.over, i: Game.camp.i, n: CAMP_ACTS[1].steps.length, prog: campProg(), open2: campIsOpen(2), stones: World.obj.filter(o => o && o.t === "stone").length })'));
  console.log('Проверка: шаги ' + seen.join(' '));
  if (!end.over) fail(`акт 1 не закончился за 75 минут: застрял на шаге ${end.i} из ${end.n} (${seen.slice(-3).join(' ')})`);
  if (!boomSeen) fail('взрыва не было (flags.boom)');
  if (tiltMax < 0.05) fail('гора не накренилась (tilt ' + tiltMax + ')');
  if (end.over && end.over.res === 'win') {
    if (!end.prog.done[1]) fail('прогресс кампании не записан (done[1])');
    if (!end.prog.legacy || !end.prog.legacy.a1) fail('наследие акта 1 не записано');
    if (!end.open2) fail('после акта 1 не открылся акт 2');
  }
  if (!saved) fail('сохранение посреди акта не проверено (до шага 6 не дошли)');
  if (minPeople < 20) warn(`в нападении погибло много гномов: осталось ${minPeople}`);
  const errs = errors.filter(e => !/предупрежд/i.test(e));
  if (errs.length) fail('ошибки в логе: ' + errs.slice(0, 3).join(' | '));
  console.log(`Проверка: прогон акта 1 — ${((Date.now() - t0) / 1000).toFixed(0)} с`);
}

// ---------- 2. Поражение: жители гибнут ----------
{
  const { h } = host(7);
  h.run('campStart(1); Game.heroAsk = false;');
  h.run('for (let k = 0; k < 40; k++) step(0.05);');
  h.run('for (const u of Game.units.filter(u => isPerson(u) && u.type !== "hero").slice(0, campPeople() - 6)) removeUnit(u);');
  h.run('for (let k = 0; k < 60; k++) step(0.05);');
  const o = JSON.parse(h.run('JSON.stringify(Game.camp.over)'));
  if (!o || o.res !== 'lose') fail('поражение не сработало, когда жителей осталось 6');
  else console.log('Проверка: поражение — «' + o.why + '»');
}

// ---------- 3. Вне кампании ничего не меняется ----------
{
  const { h } = host(11);
  h.run('setupStart(11); for (let k = 0; k < 100; k++) step(0.05);');
  const r = JSON.parse(h.run('JSON.stringify({ camp: Game.camp, foe: !!(Game.foe && !Game.foe.camp), s: !!serializeGame().camp })'));
  if (r.camp || r.s) fail('обычная игра получила состояние кампании');
  if (!r.foe) fail('в обычной игре пропал настоящий Малгор');
}

// ---------- 4. Перевод: все реплики, цели и подсказки акта 1 есть в js/i18n/en-campaign.js ----------
{
  const { h } = host(3);
  const dict = {};
  h.ctx.__en = dict;
  require('vm').runInContext(require('fs').readFileSync(require('path').join(__dirname, '../js/i18n/en-campaign.js'), 'utf8').replace("I18N.add('en',", '__enAdd('), Object.assign(h.ctx, { __enAdd: o => Object.assign(dict, o) }));
  const texts = JSON.parse(h.run(`JSON.stringify((function () {
    const out = new Set(), A = CAMP_ACTS[1];
    out.add(A.name); out.add(A.outro);
    for (const S of A.steps) {
      for (const l of S.lines || []) out.add(l[1]);
      for (const o of S.objs || []) out.add(o.t);
      if (S.hint) out.add(S.hint); if (S.label) out.add(S.label);
    }
    for (const k in CAMP_WHO) if (CAMP_WHO[k].name) out.add(CAMP_WHO[k].name);
    return [...out];
  })())`));
  const miss = texts.filter(t => !dict[t] && !['Грум Ворчун', 'Бабушка Ягла', 'Пим Чернилкин', 'Малгор', 'Герой'].includes(t));
  if (miss.length) fail(`нет английского перевода (${miss.length}): ` + miss.slice(0, 4).join(' | '));
  else console.log(`Проверка: перевод акта 1 — ${texts.length} строк`);
}

console.log(`Сводка: ${fails.length ? 'провалов ' + fails.length : 'OK'}${warns.length ? ', замечаний ' + warns.length : ''}`);
process.exit(fails.length ? 1 : 0);
