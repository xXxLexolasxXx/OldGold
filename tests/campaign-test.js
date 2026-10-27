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
  const festSeen = { n: 0, on: 0, max: 0, night: false, inside: 0, mus: '' };
  let saved = null, lastI = -1, boomSeen = false, tiltMax = 0, minPeople = 999;
  for (let sec = 0; sec < 75 * 60; sec++) {
    try { h.run('for (let k = 0; k < 20; k++) step(0.05);'); h.run(BOT); } catch (e) { fail('исключение на ' + sec + ' с: ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')); break; }
    if (sec % 2) continue;
    const s = JSON.parse(h.run('JSON.stringify({ i: Game.camp.i, k: (campStepNow(Game.camp) || {}).k, over: Game.camp.over, tilt: Game.camp.tilt, boom: !!Game.camp.flags.boom, p: campPeople(), lbl: Game.camp.label, fest: festOn(), feast: Game.units.filter(u => !u.dead && u.brk && u.brk.kind === "feast").length, inside: Game.units.filter(u => !u.dead && isPerson(u) && u.inside).length, night: camp1Night(), mus: (function () { try { return typeof computeMood === "function" ? computeMood() : ""; } catch (e) { return "err"; } })() })'));
    if (s.i !== lastI) { seen.push(`${s.i}:${s.k}@${sec}`); lastI = s.i; }
    if (s.boom) boomSeen = true;
    if (s.lbl === 'Праздник Первого Камня') { festSeen.n++; if (s.fest) festSeen.on++; festSeen.max = Math.max(festSeen.max, s.feast); festSeen.night = festSeen.night || s.night; festSeen.inside = Math.max(festSeen.inside, s.inside); if (s.fest) festSeen.mus = s.mus; }
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
  console.log(`Проверка: праздник акта 1 — ${JSON.stringify(festSeen)}`);
  if (process.env.CAMP_ONLY1) process.exit(0);
  if (!festSeen.n || festSeen.on < festSeen.n * 0.8) fail('сценарный праздник акта 1 не начался или быстро погас: ' + JSON.stringify(festSeen));
  if (festSeen.max < 12) fail(`на праздник у костра вышло мало гномов (${festSeen.max})`);
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

// ---------- 1г. Устойчивость заданий (отзыв тестера 23.10): вожак волны акта 1, кузнец и завал акта 2 ----------
// (башня у ниши штрека — в main, tests/camp-tower-test.js)
{
  const { h, errors } = host(515);
  h.run('campStart(1); Game.heroAsk = false; for (let k = 0; k < 20; k++) step(0.05);');
  const a1 = JSON.parse(h.run(`(function () {
    const C = Game.camp, r = {};
    // волна с чемпионом: щит слабее, ◎ цели указывает на вожака
    camp1Wave(C, 2, true, 1);
    const ch = campFoes('w').find(N => N.k === 'goblinChamp');
    r.parry = ch && ch.parry;
    const S = CAMP_ACTS[1].steps.find(s => s.objs && s.objs[0].id === 'w2');
    const at = S.objs[0].at(C);
    r.at = !!(ch && at && Math.abs(at[0] - ch.x) <= 1 && Math.abs(at[1] - ch.y) <= 1);
    // вожак ранится: 30 ударов по 6 снимают заметно больше половины здоровья
    const hp0 = ch.hp; for (let k = 0; k < 30 && foeLive(ch); k++) foeHit(ch, campHero(), 6); r.dmg = hp0 - Math.max(0, ch.hp);
    // отставшие: отряд вдали от всех дольше срока — удирает
    const g = campFoe('goblin', 1.5, 1.5, 'zz', { hunt: true }); g.st = 'idle';
    campStragglers('zz', Game.time - 300, 240); r.strag = g.st;
    return JSON.stringify(r);
  })()`));
  if (a1.parry !== 0.1) fail('акт 1: щит чемпиона волны не ослаблен: ' + a1.parry);
  if (!a1.at) fail('акт 1: ◎ цели «отбить волну» не показывает на вожака');
  if (!(a1.dmg > 65)) fail('акт 1: по вожаку почти не проходит урон: ' + a1.dmg);
  if (a1.strag !== 'vanish') fail('отставший гоблин вдали от всех не удрал: ' + a1.strag);

  h.run(`localStorage.setItem('oldgold.campaign', JSON.stringify({ v: 1, done: { 1: { t: 1, stars: 2, alive: 36 } }, legacy: { a1: { alive: 36, key: 1, caches: 1 } }, last: 1 }))`);
  h.run('campStart(2); Game.heroAsk = false; for (let k = 0; k < 20; k++) step(0.05);');
  const a2 = JSON.parse(h.run(`(function () {
    const C = Game.camp, A = CAMP_ACTS[2], [vx, vy] = CAMP2.vaska, r = {}, hero = campHero();
    // случайных валунов у кузнеца нет (только «клетка» вокруг него)
    r.stray = 0;
    for (let y = vy - 5; y <= vy + 5; y++) for (let x = vx - 5; x <= vx + 5; x++) { const o = inb(x, y) && World.obj[idx(x, y)];
      if (o && o.t === 'stone' && Math.max(Math.abs(x - vx), Math.abs(y - vy)) > 2 && Math.hypot(x - vx, y - vy) < 6) r.stray++; }
    // глыбы разбиты, герой стоит у «клетки» снаружи (раньше нужно было встать ровно в проход)
    for (const N of campFoes('rock')) N.st = 'die';
    hero.inside = null; hero.x = vx + 0.5; hero.y = vy + 5; hero.path = null;
    A.tick(C, 0.05); r.vaska = !!C.flags.vaska;
    // завал у школы: разбили все валуны, кроме одного — засчитано
    const rub = C.flags.rubbleI || [];
    r.rub0 = rub.length; rub.slice(1).forEach(i => { World.obj[i] = null; });
    const S = A.steps.find(s => s.objs && s.objs.some(o => o.id === 'rubble')), o = S.objs.find(o => o.id === 'rubble');
    r.rubble = o.cur(C); r.rubAt = !!o.at(C);
    return JSON.stringify(r);
  })()`));
  if (a2.stray) fail(`акт 2: случайные валуны у кузнеца (${a2.stray}) — могут закрыть проход`);
  if (!a2.vaska) fail('акт 2: глыбы разбиты, герой у завала — а кузнец не вышел');
  if (a2.rub0 < 3) fail('акт 2: завал у школы не запомнил свои валуны: ' + a2.rub0);
  if (a2.rubble !== 1) fail('акт 2: завал с одним оставшимся валуном не засчитан');
  if (!a2.rubAt) fail('акт 2: у цели «завал у школы» нет метки ◎');
  const errs = errors.filter(e => !/предупрежд/i.test(e));
  if (errs.length) fail('устойчивость заданий, ошибки в логе: ' + errs.slice(0, 3).join(' | '));
  console.log(`Проверка: устойчивость заданий — урон по вожаку ${Math.round(a1.dmg)}, Васька ${a2.vaska ? 'вышел' : 'нет'}, завал ${a2.rub0} валунов`);
}

// ---------- 1в. Акт 3 «Гости и рыба» (наследие акта 2: 22 гнома, Васька; дуэль принята) ----------
{
  const { h, errors } = host(303);
  const t0 = Date.now();
  h.run(`localStorage.setItem('oldgold.campaign', JSON.stringify({ v: 1, done: { 1: { stars: 2 }, 2: { stars: 2 } }, legacy: { a1: { alive: 36 }, a2: { saved: 22, bread: 30, vaska: true } }, last: 2 }))`);
  // панель строительства перерисована уже с открытым меню (иначе на ней одна вкладка «Ресурсы» — домов не поставить)
  h.run('Game.__menuOk = 0; const __rbm = renderBuildMenu; renderBuildMenu = function () { Game.__menuOk = !!(Game.unlocked.home && Game.unlocked.def); return __rbm.apply(this, arguments); };');
  h.run('Game.__campPick = { duel: 0, comb: 0, songs: 0 }; campStart(3); Game.heroAsk = false;');
  if (h.run('Game.__menuOk') !== true) fail('акт 3: после старта акта панель строительства не перерисована с открытым меню — нет вкладки «Основа»');
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
  const end = JSON.parse(h.run('JSON.stringify({ i: Game.camp.i, n: CAMP_ACTS[4].steps.length, f: { fires: Game.camp.flags.fires, found: Game.camp.flags.found, fled: Game.camp.flags.kingFled, traps: Game.camp.flags.traps || {}, duel: Game.camp.flags.duelDone }, prog: campProg(), open5: campIsOpen(5), objs: Game.camp.objs })'));
  console.log('Проверка: акт 4, шаги ' + seen.join(' '));
  if (!over) fail(`акт 4 не закончился за 60 минут: шаг ${end.i} из ${end.n}; цели ${JSON.stringify(end.objs)}`);
  else {
    console.log(`Проверка: акт 4 — итог «${over.res}» на ${Math.round(over.stats.t / 60)} мин, дошли ${over.stats.alive}, костров ${(end.f.fires || []).length}, находок ${end.f.found}, король ${king ? 'приходил' : 'не приходил'}, у черты встали ${haltedAtBorder}`);
    if (over.res !== 'win') fail('акт 4 не пройден: ' + over.why);
    else if (!end.prog.legacy.a4 || !end.open5) fail('наследие акта 4 не записано или сценарий не открылся');
  }
  if (minX > h.run('CAMP4.border')) fail('колонна не дошла до межевого камня');
  if (!king) fail('король Шнырь так и не вышел на бой');
  if (Object.keys(end.f.traps).length < 4) fail('ловушки тролля на дороге не все сняты или сработали: ' + JSON.stringify(end.f.traps));
  if (!end.f.duel) fail('поединок с Чемпионом второй ночью не состоялся');
  else console.log('Проверка: акт 4 — ловушки ' + JSON.stringify(end.f.traps) + ', поединок состоялся');
  if (!haltedAtBorder) fail('погоня не остановилась у межевого камня');
  // ловушки, которые никто не снял: яма (хлеб, травма), сеть (тролль из засады), обвал (камни на дороге)
  const th = JSON.parse(h.run(`JSON.stringify((() => {
    const C = Game.camp, s = Game.buildings.find(b => b.type === 'storehouse' && !b.removed), b0 = s.stock.bread || 0;
    const ppl = camp4Ppl().slice(0, 3);
    for (const u of ppl) { u.injury = null; u.march = 1; }
    C.flags.traps = {};
    for (let i = 0; i < CAMP4_TRAPS.length; i++) camp4TrapHit(C, camp4Trap(i), ppl);
    let stones = 0; const t = camp4Trap(2);
    for (let y = t.y - 3; y <= t.y + 3; y++) for (let x = t.x - 3; x <= t.x + 3; x++) { const o = World.obj[idx(x, y)]; if (o && o.t === 'stone') stones++; }
    return { bread: b0 - (s.stock.bread || 0), hurt: ppl.filter(u => u.injury).length, troll: campFoes('trap').filter(N => N.k === 'campTroll').length, stones };
  })())`));
  if (th.bread < 6 || !th.hurt || !th.troll || !th.stones) fail('ловушки тролля срабатывают не так: ' + JSON.stringify(th));
  else console.log('Проверка: акт 4 — сработавшие ловушки: ' + JSON.stringify(th));
  // акт 5: сценарий на новой карте, наследие кампании
  h.run('campStart(5); Game.heroAsk = false;');
  const sc = JSON.parse(h.run('JSON.stringify({ camp: !!Game.camp, mode: Game.goal && Game.goal.mode, foe: !!(Game.foe && !Game.foe.camp), leg: Game.campLeg, vaska: Game.units.some(u => u.cname === "Васька"), iron: Game.buildings.find(b => b.type === "storehouse").stock.iron, custom: !!MapOpt.custom })'));
  console.log(`Проверка: акт 5 — сценарий «${sc.mode}», Малгор ${sc.foe ? 'настоящий' : 'нет'}, наследие ${JSON.stringify(sc.leg)}`);
  if (sc.camp || sc.custom) fail('сценарий запустился как акт кампании');
  if (sc.mode !== 'scenario') fail('акт 5 — не сценарий «Тишина дороже золота»');
  if (!sc.foe) fail('в сценарии нет настоящего Малгора');
  if (!sc.leg || !sc.vaska || !(sc.iron >= 6)) fail('наследие кампании не перешло в сценарий (Васька, железо)');
  // голем с наследием: руны собраны — просыпается (реплики идут окном кампании, без интерфейса — молча) и идёт ломать
  try {
    const gw = h.run('glEnsure(); for (const r of Game.glq.runes) r.got = 1; Game.golem ? String(glWake()) : "нет голема"');
    if (gw === 'false') fail('голем с тремя рунами не проснулся');
    console.log('Проверка: акт 5 — голем проснулся: ' + gw + ', реплик ' + h.run('Object.values(CAMP_ACTS[5].talk).flat().length'));
  } catch (e) { fail('акт 5, голем: ' + String(e).split('\n')[0]); }
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

// ---------- 2б. Облик героя переходит между актами и в сценарий (campProg().hero, Game.campLeg.hero, сейв cleg) ----------
{
  const { h, errors } = host(13);
  h.run('campStart(1); Game.heroAsk = false;');
  h.run('const H = campHero().hero; H.name = "Борин"; H.app = [2, 3, 4, 1, 0, 1, 0, 5, 0, 6, 0, -1]; H.clsKey = "warrior"; H.mastery = 2;');
  h.run('campFinish(Game.camp, "win", "")');
  h.run('campStart(2); Game.heroAsk = true;');   // heroAsk снова поднимет сам запуск акта — проверяем, что он не нужен
  const a2 = JSON.parse(h.run('JSON.stringify({ H: campHero().hero, ask: Game.heroAsk })'));
  if (a2.H.name !== 'Борин' || !a2.H.app || a2.H.app[1] !== 3 || a2.H.app[9] !== 6 || a2.H.clsKey !== 'warrior' || a2.H.mastery !== 2) fail('облик героя не перешёл в акт 2: ' + JSON.stringify(a2.H));
  h.run('campFinish(Game.camp, "win", "")');
  h.run('campStart(5); Game.heroAsk = false;');
  const a5 = JSON.parse(h.run('JSON.stringify({ H: campHero().hero, leg: Game.campLeg, ser: serializeGame().cleg })'));
  if (a5.H.name !== 'Борин' || !a5.H.app || a5.H.app[7] !== 5 || a5.H.clsKey !== 'warrior') fail('облик героя не перешёл в сценарий: ' + JSON.stringify(a5.H));
  if (!a5.leg || !a5.leg.hero || a5.leg.hero.clsKey !== 'warrior' || !a5.ser || !a5.ser.hero) fail('облик героя не попал в Game.campLeg / cleg');
  // сейв старой версии: cleg без hero и вовсе без cleg грузится
  h.run('const old = serializeGame(); delete old.cleg.hero; applySave(JSON.parse(JSON.stringify(old))); const o2 = serializeGame(); delete o2.cleg; applySave(JSON.parse(JSON.stringify(o2)));');
  if (h.run('Game.campLeg') !== null && h.run('!!Game.campLeg')) fail('сейв без cleg оставил наследие');
  const errs = errors.filter(e => !/предупрежд/i.test(e));
  if (errs.length) fail('перенос облика, ошибки в логе: ' + errs.slice(0, 3).join(' | '));
  else console.log('Проверка: облик героя (имя, цвета, класс) — акт 1 → 2 → сценарий, сейв cleg');
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
    for (const L of Object.values(A.talk || {})) for (const l of L) out.add(l[1]);
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
  // строки, которые код собирает на лету (итоги, тосты, подписи): ключи-шаблоны с {0}
  const dyn = ['Тайник Тана ({0} из 3): старый кошель с монетами и записка «на чёрный день».', 'Ключ Тана у героя; с вами уходят {0} гномов.',
    'Праздник Первого Камня! Все бросили дела: песни, пляски и пиво у костра', 'Васька', 'до перевала дошли {0} гномов; хлеба в дорогу — {1}.',
    'до перевала дошли {0} гномов, с ними кузнец Васька; хлеба в дорогу — {1}.', 'до Долины дошли {0} гномов — их и припасы обоза ждёт сценарий «Тишина дороже золота».',
    '{0} уважения', 'Подгорье', 'Наследие: {0}', 'Акт {0}: {1} ▸', 'Продолжить кампанию', 'Кампания'];
  texts.push(...dyn);
  const miss = texts.filter(t => t && !dict[t] && !['Грум Ворчун', 'Бабушка Ягла', 'Пим Чернилкин', 'Малгор', 'Герой'].includes(t));
  // реальный переводчик (js/i18n.js + все словари): итоги со числами и дополнение Грума в дилемме шпиона
  for (const f of require('fs').readdirSync(require('path').join(__dirname, '../js/i18n'))) if (/^en.*\.js$/.test(f)) require('vm').runInContext(require('fs').readFileSync(require('path').join(__dirname, '../js/i18n', f), 'utf8'), h.ctx);
  const live = JSON.parse(h.run(`(function () {
    const p = campProg(); p.done[1] = { t: 1, stars: 1 }; campProgSave(p);
    const e = DIL_BY_ID.malgor_spy, d0 = e.d;
    dilOpen(e); const d1 = e.d; e.d = d0; if (Game.dil) Game.dil.cur = null;
    const C = { flags: { saved: 32, breadOut: 30, vaska: true, resp: 3, found: [1, 2] } };
    return JSON.stringify([d1, CAMP_ACTS[2].legacyText(C), CAMP_ACTS[3].legacyText(C), CAMP_ACTS[1].legacyText(C), CAMP_ACTS[4].legacyText(C), 'Тайник Тана (2 из 3): старый кошель с монетами и записка «на чёрный день».', '+2 уважения'].map(s => [s, I18N.tr(s)]));
  })()`));
  if (!/Подгорье/.test(live[0][0])) fail('в дилемме шпиона нет реплики Грума о Подгорье');
  for (const [ru, en] of live) if (/[А-Яа-яЁё]/.test(en)) miss.push(ru.slice(0, 60) + ' → ' + en.slice(0, 60));
  if (miss.length) fail(`нет английского перевода (${miss.length}): ` + miss.slice(0, 4).join(' | '));
  else console.log(`Проверка: перевод актов — ${texts.length} строк`);
}

console.log(`Сводка: ${fails.length ? 'провалов ' + fails.length : 'OK'}${warns.length ? ', замечаний ' + warns.length : ''}`);
process.exit(fails.length ? 1 : 0);
