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
  const z = C.objs && C.objs.find(o => o.z && o.cur < o.need);
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
  // завал у школы (акт 2): игрок разбивает валуны героем — бот убирает по валуну раз в 4 с
  const rb = C.objs && C.objs.find(o => o.t.includes('завал') && o.cur < o.need);
  if (rb && C.flags.school && Game.time - (Game.__botRb || 0) > 4) {
    Game.__botRb = Game.time;
    const [sx, sy] = C.flags.school;
    for (let y = sy - 5; y <= sy + 5; y++) for (let x = sx - 5; x <= sx + 5; x++) { const o = inb(x, y) && World.obj[idx(x, y)]; if (o && o.t === 'stone' && Math.hypot(x - sx, y - sy) <= 4.5) { World.obj[idx(x, y)] = null; y = 1e9; break; } }
  }
  // стройка по сценарию (акт 3): площадка нужного здания у лагеря, дорогу к складу бот кладёт сразу
  const BT = { 'Поставить дома': 'house', 'Дом лесоруба': 'woodcutter', 'Ферма': 'farm', 'Пекарня': 'bakery', 'Свой колодец': 'well' };
  for (const o of (C.act === 3 && C.objs) || []) {
    const t = BT[o.t];
    if (!t || o.cur >= o.need) continue;
    const have = Game.buildings.filter(b => b.type === t && !b.removed && !b.foreign).length;
    if (have >= o.need) continue;
    const k = Game.__botK = (Game.__botK || 0) + 1;
    camp1Place(t, CAMP3.start[0] + Math.round(Math.cos(k) * 8), CAMP3.start[1] + Math.round(Math.sin(k) * 7), camp1Net(), false);
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

// ---------- 1б. Акт 2 «Гора ложится» целиком (наследие акта 1: 36 гномов) ----------
{
  const { h, errors } = host(777);
  const t0 = Date.now();
  h.run(`localStorage.setItem('oldgold.campaign', JSON.stringify({ v: 1, done: { 1: { t: 1, stars: 2, alive: 36 } }, legacy: { a1: { alive: 36, key: 1, caches: 1 } }, last: 1 }))`);
  h.run('campStart(2); Game.heroAsk = false;');
  const info = JSON.parse(h.run('JSON.stringify({ p: campPeople(), rubble: Game.camp.flags.rubble0, rocks: campFoes("rock").length, open: campIsOpen(2), b: Game.buildings.length })'));
  console.log(`Проверка: акт 2 — жителей ${info.p}, зданий ${info.b}, валунов у школы ${info.rubble}, глыб ${info.rocks}`);
  if (info.p > 38 || info.p < 30) fail(`в акт 2 пришло не столько гномов, сколько спаслось в акте 1 (36): ${info.p}`);
  if (!info.rubble || info.rocks !== 3) fail('нет завала у школы или глыб у кузнеца');
  const seen = [];
  let lastI = -1, waveMax = 0, over = null;
  for (let sec = 0; sec < 40 * 60; sec++) {
    try { h.run('for (let k = 0; k < 20; k++) step(0.05);'); h.run(BOT); } catch (e) { fail('акт 2, исключение на ' + sec + ' с: ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')); break; }
    if (sec % 2) continue;
    const s = JSON.parse(h.run('JSON.stringify({ i: Game.camp.i, k: (campStepNow(Game.camp) || {}).k, over: Game.camp.over, wave: Game.camp.flags.wave ? Game.camp.flags.wave.y : 0 })'));
    if (s.i !== lastI) { seen.push(`${s.i}:${s.k}@${sec}`); lastI = s.i; }
    waveMax = Math.max(waveMax, s.wave);
    if (s.over) { over = s.over; break; }
  }
  const end = JSON.parse(h.run('JSON.stringify({ i: Game.camp.i, n: CAMP_ACTS[2].steps.length, f: { vaska: Game.camp.flags.vaska, saved: Game.camp.flags.saved, buried: Game.camp.flags.buried || 0, missed: Game.camp.flags.missed || [] }, prog: campProg(), open3: campIsOpen(3), objs: Game.camp.objs })'));
  console.log('Проверка: акт 2, шаги ' + seen.join(' '));
  if (!over) fail(`акт 2 не закончился за 40 минут: шаг ${end.i} из ${end.n}; цели ${JSON.stringify(end.objs)}`);
  else {
    console.log(`Проверка: акт 2 — итог «${over.res}» на ${Math.round(over.stats.t / 60)} мин, дошли ${end.f.saved}, засыпало ${end.f.buried}, Васька ${end.f.vaska ? 'спасён' : 'нет'}, не успели: ${end.f.missed.join(', ') || '—'}`);
    if (over.res !== 'win') fail('акт 2 не пройден: ' + over.why);
    else {
      if (!end.prog.legacy.a2) fail('наследие акта 2 не записано');
      if (!end.open3) fail('после акта 2 не открылся акт 3');
    }
  }
  if (waveMax < 80) {   // бот мог вывести всех раньше волны (зависит от сдвига генератора случайных) — тогда это не провал
    const msg = 'волна обвала не прошла город (y ' + waveMax.toFixed(0) + ')';
    if (over && over.res === 'win' && !end.f.buried) warn(msg); else fail(msg);
  }
  if (!end.f.vaska) warn('кузнеца Ваську не откопали');
  const errs = errors.filter(e => !/предупрежд/i.test(e));
  if (errs.length) fail('акт 2, ошибки в логе: ' + errs.slice(0, 3).join(' | '));
  console.log(`Проверка: прогон акта 2 — ${((Date.now() - t0) / 1000).toFixed(0)} с`);
}

// ---------- 1в. Акт 3 «Гости и рыба» (наследие акта 2: 22 гнома, Васька; дуэль принята) ----------
{
  const { h, errors } = host(303);
  const t0 = Date.now();
  h.run(`localStorage.setItem('oldgold.campaign', JSON.stringify({ v: 1, done: { 1: { stars: 2 }, 2: { stars: 2 } }, legacy: { a1: { alive: 36 }, a2: { saved: 22, bread: 30, vaska: true } }, last: 2 }))`);
  h.run('Game.__campPick = { duel: 0, comb: 0, songs: 0 }; campStart(3); Game.heroAsk = false;');
  const info = JSON.parse(h.run('JSON.stringify({ p: campPeople(), krem: Game.buildings.filter(b => b.foreign).length, ours: Game.buildings.filter(b => !b.foreign).length, vaska: Game.units.some(u => u.cname === "Васька") })'));
  console.log(`Проверка: акт 3 — беглецов ${info.p}, домов Кремнёвки ${info.krem}, наших зданий ${info.ours}, Васька ${info.vaska ? 'с нами' : 'нет'}`);
  if (info.p < 21 || info.p > 25) fail(`в акт 3 пришло не столько гномов, сколько дошло в акте 2 (22+Васька): ${info.p}`);
  if (info.krem < 9) fail('Кремнёвка построена не полностью: ' + info.krem);
  if (!info.vaska) fail('кузнец Васька из наследия акта 2 не пришёл');
  const seen = [];
  let lastI = -1, over = null, workAbroad = 0;
  for (let sec = 0; sec < 60 * 60; sec++) {
    try { h.run('for (let k = 0; k < 20; k++) step(0.05);'); h.run(BOT); } catch (e) { fail('акт 3, исключение на ' + sec + ' с: ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')); break; }
    if (sec % 2) continue;
    const s = JSON.parse(h.run('JSON.stringify({ i: Game.camp.i, k: (campStepNow(Game.camp) || {}).k, over: Game.camp.over, abroad: Game.units.filter(u => !u.dead && u.home && u.home.foreign).length })'));
    if (s.i !== lastI) { seen.push(`${s.i}:${s.k}@${sec}`); lastI = s.i; }
    workAbroad = Math.max(workAbroad, s.abroad);
    if (s.over) { over = s.over; break; }
  }
  const end = JSON.parse(h.run('JSON.stringify({ i: Game.camp.i, n: CAMP_ACTS[3].steps.length, f: { resp: Game.camp.flags.resp, duelWon: Game.camp.flags.duelWon, choices: Game.camp.flags.choices }, prog: campProg(), objs: Game.camp.objs })'));
  console.log('Проверка: акт 3, шаги ' + seen.join(' '));
  if (!over) fail(`акт 3 не закончился за 60 минут: шаг ${end.i} из ${end.n}; цели ${JSON.stringify(end.objs)}`);
  else {
    console.log(`Проверка: акт 3 — итог «${over.res}» на ${Math.round(over.stats.t / 60)} мин, уважение ${end.f.resp}, дуэль ${end.f.duelWon ? 'выиграна' : 'нет'}, выборы ${JSON.stringify(end.f.choices)}`);
    if (over.res !== 'win') fail('акт 3 не пройден: ' + over.why);
    else if (!end.prog.legacy.a3) fail('наследие акта 3 не записано');
  }
  if (workAbroad) fail(`наши работники ушли работать в Кремнёвку: ${workAbroad}`);
  if (!end.f.duelWon) fail('дуэль с Кремнем не состоялась');
  const errs = errors.filter(e => !/предупрежд/i.test(e));
  if (errs.length) fail('акт 3, ошибки в логе: ' + errs.slice(0, 3).join(' | '));
  console.log(`Проверка: прогон акта 3 — ${((Date.now() - t0) / 1000).toFixed(0)} с`);
}

// ---------- 1г. Акт 4 «Игра не стоит свеч» и переход в сценарий (акт 5) с наследием ----------
{
  const { h, errors } = host(404);
  const t0 = Date.now();
  h.run(`localStorage.setItem('oldgold.campaign', JSON.stringify({ v: 1, done: { 1: { stars: 2 }, 2: { stars: 2 }, 3: { stars: 2 } }, legacy: { a1: { alive: 36 }, a2: { saved: 24, bread: 30, vaska: true }, a3: { resp: 4, gift: { bread: 20, stone: 20, trade: 1 } } }, last: 3 }))`);
  h.run('campStart(4); Game.heroAsk = false;');
  const info = JSON.parse(h.run('JSON.stringify({ p: campPeople(), bread: campStock("bread"), vaska: Game.units.some(u => u.cname === "Васька"), w: MAP_W })'));
  console.log(`Проверка: акт 4 — в колонне ${info.p}, хлеба ${info.bread}, Васька ${info.vaska ? 'с нами' : 'нет'}, карта ${info.w} в ширину`);
  if (info.p < 23 || info.p > 27) fail(`в акт 4 пришло не столько гномов, сколько в наследии (24+Васька): ${info.p}`);
  if (info.bread < 40) fail('дар Кремнёвки (хлеб) не попал в обоз');
  const seen = [];
  let lastI = -1, over = null, minX = 999, king = false, haltedAtBorder = 0;
  for (let sec = 0; sec < 60 * 60; sec++) {
    try { h.run('for (let k = 0; k < 20; k++) step(0.05);'); h.run(BOT); } catch (e) { fail('акт 4, исключение на ' + sec + ' с: ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')); break; }
    if (sec % 2) continue;
    const s = JSON.parse(h.run('JSON.stringify({ i: Game.camp.i, k: (campStepNow(Game.camp) || {}).k, over: Game.camp.over, x: Math.min(...camp4Ppl().map(u => u.x)), king: campFoes("chase").some(N => N.k === "shnyr"), halt: campFoes("chase").filter(N => N.halt).length })'));
    if (s.i !== lastI) { seen.push(`${s.i}:${s.k}@${sec}`); lastI = s.i; }
    minX = Math.min(minX, s.x); king = king || s.king; haltedAtBorder = Math.max(haltedAtBorder, s.halt);
    if (s.over) { over = s.over; break; }
  }
  const end = JSON.parse(h.run('JSON.stringify({ i: Game.camp.i, n: CAMP_ACTS[4].steps.length, f: { fires: Game.camp.flags.fires, found: Game.camp.flags.found, fled: Game.camp.flags.kingFled }, prog: campProg(), open5: campIsOpen(5), objs: Game.camp.objs })'));
  console.log('Проверка: акт 4, шаги ' + seen.join(' '));
  if (!over) fail(`акт 4 не закончился за 60 минут: шаг ${end.i} из ${end.n}; цели ${JSON.stringify(end.objs)}`);
  else {
    console.log(`Проверка: акт 4 — итог «${over.res}» на ${Math.round(over.stats.t / 60)} мин, дошли ${over.stats.alive}, костров ${(end.f.fires || []).length}, находок ${end.f.found}, король ${king ? 'приходил' : 'не приходил'}, у черты встали ${haltedAtBorder}`);
    if (over.res !== 'win') fail('акт 4 не пройден: ' + over.why);
    else if (!end.prog.legacy.a4 || !end.open5) fail('наследие акта 4 не записано или сценарий не открылся');
  }
  if (minX > h.run('CAMP4.border')) fail('колонна не дошла до межевого камня');
  if (!king) fail('король Шнырь так и не вышел на бой');
  if (!haltedAtBorder) fail('погоня не остановилась у межевого камня');
  // акт 5: сценарий на новой карте, наследие кампании
  h.run('campStart(5); Game.heroAsk = false;');
  const sc = JSON.parse(h.run('JSON.stringify({ camp: !!Game.camp, mode: Game.goal && Game.goal.mode, foe: !!(Game.foe && !Game.foe.camp), leg: Game.campLeg, vaska: Game.units.some(u => u.cname === "Васька"), iron: Game.buildings.find(b => b.type === "storehouse").stock.iron, custom: !!MapOpt.custom })'));
  console.log(`Проверка: акт 5 — сценарий «${sc.mode}», Малгор ${sc.foe ? 'настоящий' : 'нет'}, наследие ${JSON.stringify(sc.leg)}`);
  if (sc.camp || sc.custom) fail('сценарий запустился как акт кампании');
  if (sc.mode !== 'scenario') fail('акт 5 — не сценарий «Тишина дороже золота»');
  if (!sc.foe) fail('в сценарии нет настоящего Малгора');
  if (!sc.leg || !sc.vaska || !(sc.iron >= 6)) fail('наследие кампании не перешло в сценарий (Васька, железо)');
  h.run('for (let k = 0; k < 400; k++) step(0.05);');
  const errs = errors.filter(e => !/предупрежд/i.test(e));
  if (errs.length) fail('акты 4–5, ошибки в логе: ' + errs.slice(0, 3).join(' | '));
  console.log(`Проверка: прогон акта 4 — ${((Date.now() - t0) / 1000).toFixed(0)} с`);
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
    const out = new Set();
    for (const A of Object.values(CAMP_ACTS)) {
    out.add(A.name); out.add(A.outro);
    for (const S of A.steps) {
      for (const l of S.lines || []) out.add(l[1]);
      for (const o of S.objs || []) out.add(o.t);
      if (S.hint) out.add(S.hint); if (S.label) out.add(S.label);
      if (S.k === 'choice') { out.add(S.t); out.add(S.text); for (const o of S.opts) { out.add(o.t); if (o.out) out.add(o.out); } }
    }
    }
    for (const k in CAMP_WHO) if (CAMP_WHO[k].name) out.add(CAMP_WHO[k].name);
    return [...out];
  })())`));
  const miss = texts.filter(t => t && !dict[t] && !['Грум Ворчун', 'Бабушка Ягла', 'Пим Чернилкин', 'Малгор', 'Герой'].includes(t));
  if (miss.length) fail(`нет английского перевода (${miss.length}): ` + miss.slice(0, 4).join(' | '));
  else console.log(`Проверка: перевод актов — ${texts.length} строк`);
}

console.log(`Сводка: ${fails.length ? 'провалов ' + fails.length : 'OK'}${warns.length ? ', замечаний ' + warns.length : ''}`);
process.exit(fails.length ? 1 : 0);
