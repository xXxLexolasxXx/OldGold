'use strict';
// Кооп-пакет: декор от игроков, Совет выбирает новый район, передача предметов (give) с очередью посылок,
// групповые квесты «Эстафета» и «Передать хлеб». Сервер-симуляция с двумя игроками и клиент-зеркало первого.
// Запуск: node tests/coopkit-test.js
const fs = require('fs');
const path = require('path');
const S = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

const srv = S.newSim(41, { coop: true });
const R = js => srv.h.run(js);
R(`coopJoin('Ая', JSON.stringify({ cls: 'warrior' })); coopJoin('Бо', JSON.stringify({ cls: 'mage' }))`);
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const files = [...html.matchAll(/<script[^>]*\ssrc="js\/([\w\/-]+)\.js"/g)].map(m => m[1]).filter(f => !['loading', 'perf'].includes(f));
const cli = S.newSim(1041, { files });
cli.h.run('unlockAll = typeof unlockAll === "function" ? unlockAll : function () {}; coopInitHud = function () {}; coopInitControls = function () {}; coopRefreshHud = function () {}; coopVilHud = function () {}; coopQuestHud = function () {}; coopSaveCopy = function () {};');
cli.h.ctx.__m = R(`coopInitPacket(coop.players.get('Ая').id)`);
cli.h.run('coopApplyInit(JSON.parse(__m))');
R('coopWorldPacket()');
function sync() {
  const w = R('coopWorldPacket()');
  if (w) { cli.h.ctx.__m = w; cli.h.run('coopHandle(JSON.parse(__m))'); }
  cli.h.ctx.__m = R('coopUnitsPacket()'); cli.h.run('coopHandle(JSON.parse(__m))');
}
const cmd = (who, o, admin) => R(`coopCmd(${JSON.stringify(who)}, ${JSON.stringify(JSON.stringify(o))}, ${!!admin})`);
const drain = () => JSON.parse(R('coopDrain()'));
const toasts = (who) => drain().filter(e => e.msg.t === 'toast' && (!who || e.to === who || !e.to)).map(e => e.msg.text);
const wait = s => S.stepN(srv, Math.round(s / 0.05));
// поставить героя на клетку (по умолчанию — у склада) и остановить
R(`function __tp(n, x, y) { const u = coop.players.get(n); heroStopUnit(u); u.cmd = null; u.x = x + 0.5; u.y = y + 0.5; }
   function __home(n, dx) { const st = Game.buildings.find(b => b.type === 'storehouse'); const c = randomFreeNear(st.doorX + (dx || 0), st.doorY + 3, 0, 4, (x, y) => isWalkable(x, y) && !World.door[idx(x, y)]); __tp(n, c[0], c[1]); return c; }`);
wait(2); drain();

// ---------- 1. Декор ----------
{
  const spot = JSON.parse(R(`JSON.stringify(randomFreeNear(Game.buildings.find(b => b.type === 'storehouse').doorX, Game.buildings.find(b => b.type === 'storehouse').doorY + 6, 2, 9))`));
  R(`__tp('Ая', ${spot[0]}, ${spot[1] + 1})`);
  cmd('Ая', { t: 'decor', k: 'statue', x: spot[0], y: spot[1] });
  ok(R(`(World.obj[idx(${spot[0]}, ${spot[1]})] || {}).t`) === 'statue', 'статуя не поставилась');
  ok(R(`(World.obj[idx(${spot[0]}, ${spot[1]})] || {}).by`) === 'Ая', 'у статуи нет подписи автора');
  wait(0.3);
  cmd('Ая', { t: 'decor', k: 'nope', x: spot[0] + 1, y: spot[1] });
  cmd('Ая', { t: 'decor', k: 'constructor', x: spot[0] + 1, y: spot[1] });
  ok(R(`!World.obj[idx(${spot[0] + 1}, ${spot[1]})] || !!World.obj[idx(${spot[0] + 1}, ${spot[1]})].t && World.obj[idx(${spot[0] + 1}, ${spot[1]})].t !== 'nope'`), 'принят несуществующий вид декора');
  // на занятую клетку и на дорогу — нельзя
  wait(0.3); drain();
  cmd('Ая', { t: 'decor', k: 'flag', x: spot[0], y: spot[1] });
  ok(R(`World.obj[idx(${spot[0]}, ${spot[1]})].t`) === 'statue', 'декор поставился поверх другого');
  ok(toasts('Ая').some(t => /свободная трава/.test(t)), 'нет объяснения, почему нельзя поставить');
  // чужой декор: Бо убрать не может, ни undecor, ни сносом; хост может
  wait(0.3);
  cmd('Бо', { t: 'undecor', x: spot[0], y: spot[1] });
  cmd('Бо', { t: 'erase', cells: [[spot[0], spot[1]]] });
  ok(R(`(World.obj[idx(${spot[0]}, ${spot[1]})] || {}).t`) === 'statue', 'чужой декор убран не автором');
  ok(toasts('Бо').some(t => /только автор или хост/.test(t)), 'не сказали, что чужое убирает автор или хост');
  // красота: гном рядом со статуей получает причину «decor»
  const beauty = R(`(() => { const u = Game.units.find(u => isPerson(u) && !u.owner && u.type !== 'hero' && !u.dead); if (!u) return -1; u.x = ${spot[0]} + 1.5; u.y = ${spot[1]} + 0.5; const s = mdSurround(u); return s.beauty; })()`);
  ok(beauty >= 2, `красота рядом со статуей не считается (${beauty})`);
  ok(R('vdMood(2)') > 0, 'красота не даёт настроения');
  // клиент видит декор с автором
  sync();
  ok(cli.h.run(`(World.obj[idx(${spot[0]}, ${spot[1]})] || {}).by`) === 'Ая', 'клиент не видит автора декора');
  // лимит на игрока
  const placed = R(`(() => { let n = 0; for (let k = 0; k < 400 && n < 20; k++) { const c = randomFreeNear(${spot[0]}, ${spot[1]}, 2, 14); if (!c) break; coop.actAt.delete('Ая'); coopCmd('Ая', JSON.stringify({ t: 'decor', k: 'bed', x: c[0], y: c[1] }), false); if (World.obj[idx(c[0], c[1])] && World.obj[idx(c[0], c[1])].by === 'Ая') n++; } return vdCount('Ая').mine; })()`);
  ok(placed === 15, `лимит декора на игрока не держится: ${placed}`);
  // право decor выключено — нельзя
  R(`coopSetPerms(JSON.stringify({ decor: false })); coop.actAt.clear()`);
  drain();
  const free = JSON.parse(R(`JSON.stringify(randomFreeNear(${spot[0]}, ${spot[1]}, 3, 14))`));
  cmd('Бо', { t: 'decor', k: 'flag', x: free[0], y: free[1] });
  ok(!R(`World.obj[idx(${free[0]}, ${free[1]})]`), 'декор поставлен без права decor');
  ok(toasts('Бо').some(t => /Хост запретил/.test(t)), 'нет сообщения о запрете декора');
  cmd('Бо', { t: 'decor', k: 'flag', x: free[0], y: free[1] }, true);
  ok(R(`(World.obj[idx(${free[0]}, ${free[1]})] || {}).t`) === 'flag', 'хост не может ставить декор при запрете');
  R(`coopSetPerms(JSON.stringify({ decor: true }))`);
  // сохранение: автор и новые виды переживают сейв
  const save = R('JSON.stringify(serializeGame())');
  srv.h.ctx.__s = save;
  R(`applySave(JSON.parse(__s))`);
  ok(R(`(World.obj[idx(${spot[0]}, ${spot[1]})] || {}).by`) === 'Ая' && R(`(World.obj[idx(${free[0]}, ${free[1]})] || {}).t`) === 'flag', 'декор или автор не пережили сохранение');
  // хост убирает чужое
  cmd('Ая', { t: 'undecor', x: free[0], y: free[1] }, true);
  ok(!R(`World.obj[idx(${free[0]}, ${free[1]})]`), 'хост не смог убрать чужой декор');
  console.log(`декор: статуя, лимит ${placed}/15, красота ${beauty}`);
}

// ---------- 2. Передача предметов ----------
{
  R(`coop.actAt.clear(); for (const n of ['Ая', 'Бо']) coop.players.get(n).hero.inv.fill(null); coopAddItem(coop.players.get('Ая').hero, 'sausage', 3)`);
  R(`__home('Ая', 0); __tp('Бо', 3, 3)`);
  drain();
  cmd('Ая', { t: 'give', to: 'Бо', slot: 0, n: 2 });
  ok(R(`coop.players.get('Бо').hero.inv.filter(Boolean).length`) === 0, 'передача сработала издалека');
  ok(toasts('Ая').some(t => /Подойди/.test(t)), 'нет подсказки «подойди ближе»');
  const c = JSON.parse(R(`JSON.stringify(__home('Ая', 0))`));
  R(`__tp('Бо', ${c[0]}, ${c[1]})`);
  wait(1);
  cmd('Ая', { t: 'give', to: 'Бо', slot: 0, n: 2 });
  ok(R(`JSON.stringify(coop.players.get('Бо').hero.inv[0])`) === '{"k":"sausage","n":2}', 'предмет не передан: ' + R(`JSON.stringify(coop.players.get('Бо').hero.inv[0])`));
  ok(R(`coop.players.get('Ая').hero.inv[0].n`) === 1, 'у отдавшего не убавилось');
  // антиспам: вторая передача сразу же не проходит
  cmd('Ая', { t: 'give', to: 'Бо', slot: 0, n: 1 });
  ok(R(`coop.players.get('Ая').hero.inv[0] && coop.players.get('Ая').hero.inv[0].n`) === 1, 'антиспам передач не работает');
  // мусор в команде — без падений и без эффекта
  for (const bad of [{ t: 'give', to: 'Бо', slot: -1 }, { t: 'give', to: 'Бо', slot: 99 }, { t: 'give', to: 'Ая', slot: 0 }, { t: 'give', to: '__proto__', slot: 0 }, { t: 'give', to: 7, slot: '0' }, { t: 'give', to: 'Бо', slot: 0, n: -5 }]) { wait(1); cmd('Ая', bad); }
  ok(R(`coop.players.get('Ая').hero.inv[0] && coop.players.get('Ая').hero.inv[0].n`) === 1, 'кривая команда give что-то изменила');
  // рюкзак полон — посылка ждёт в очереди и приходит, когда место освободилось
  R(`(() => { const H = coop.players.get('Бо').hero; for (let i = 0; i < H.inv.length; i++) H.inv[i] = { k: 'stone', n: 20 }; })()`);
  wait(1);
  cmd('Ая', { t: 'give', to: 'Бо', slot: 0, n: 1 });
  ok(R(`(coop.vil.gq['Бо'] || []).length`) === 1, 'посылка не встала в очередь при полном рюкзаке');
  R(`coop.players.get('Бо').hero.inv[3] = null`);
  wait(1.5);
  ok(!R(`coop.vil.gq['Бо']`) && R(`JSON.stringify(coop.players.get('Бо').hero.inv[3])`) === '{"k":"sausage","n":1}', 'посылка из очереди не пришла');
  ok(R(`JSON.parse(coopStateGet()).gq !== undefined`), 'очередь посылок не сохраняется в состоянии деревни');
}

// ---------- 3. Эстафета ----------
{
  R(`for (const n of ['Ая', 'Бо']) coop.players.get(n).hero.inv.fill(null); coop.rq = null; coop.relayDay = -1; coop.breadDay = coopDayIx(); coop.rqNext = 0`);
  // дождаться дневного окна квеста
  let started = false;
  for (let i = 0; i < 2400 && !started; i++) { wait(1); started = R('!!(coop.rq && coop.rq.kind === "relay")'); if (!started) R('coop.rqNext = 0; coop.relayDay = -1; coop.breadDay = coopDayIx()'); }
  ok(started, 'эстафета не началась');
  if (started) {
    const chain = JSON.parse(R('JSON.stringify(coop.rq.chain)'));
    const [a, b] = chain;
    ok(R(`coopInvHas(coop.players.get(${JSON.stringify(a)}).hero, 'baton')`), 'у первого нет палочки');
    const info = JSON.parse(R(`JSON.stringify(coopQuestInfo(${JSON.stringify(a)}).r)`));
    ok(info && info.t === 'Эстафета' && info.me === 1 && info.pts.length === 1, 'клиенту не уходит информация об эстафете');
    // палочку нельзя отдать «не тому» — тут таких нет; отдаём следующему рядом
    const c = JSON.parse(R(`JSON.stringify(__home(${JSON.stringify(a)}, 0))`));
    R(`__tp(${JSON.stringify(b)}, ${c[0]}, ${c[1]})`);
    R('coop.actAt.clear()');
    const slot = R(`coop.players.get(${JSON.stringify(a)}).hero.inv.findIndex(s => s && s.k === 'baton')`);
    cmd(a, { t: 'give', to: b, slot });
    ok(R('coop.rq && coop.rq.holder') === b, 'палочка не перешла по цепочке');
    // последний несёт к складу
    R(`(() => { const st = Game.buildings.find(b => b.type === 'storehouse'); __tp(${JSON.stringify(b)}, st.doorX, st.doorY + 1); })()`);
    const xp0 = R(`coop.players.get(${JSON.stringify(a)}).hero.xp + coop.players.get(${JSON.stringify(a)}).hero.level * 1000`);
    drain();
    wait(1.5);
    ok(!R('coop.rq'), 'эстафета не завершилась у склада');
    ok(toasts().some(t => /Эстафета пройдена/.test(t)), 'нет сообщения об успехе эстафеты');
    ok(R(`coop.players.get(${JSON.stringify(a)}).hero.xp + coop.players.get(${JSON.stringify(a)}).hero.level * 1000`) > xp0, 'за эстафету нет опыта');
    ok(!R(`coopInvHas(coop.players.get(${JSON.stringify(b)}).hero, 'baton')`), 'палочка осталась в рюкзаке после конца');
    // срыв по времени и подчистка палочки у вернувшегося
    R(`coop.relayDay = -1; coop.rq = null; coop.rqNext = 0`);
    wait(1.5);
    if (R('!!(coop.rq && coop.rq.kind === "relay")')) {
      const h = R('coop.rq.holder');
      const data = R(`coopLeave(${JSON.stringify(h)})`);
      wait(1.5);
      ok(!R('coop.rq'), 'эстафета не сорвалась, когда несущий ушёл');
      srv.h.ctx.__d = data;
      R(`coopJoin(${JSON.stringify(h)}, __d)`);
      ok(!R(`coopInvHas(coop.players.get(${JSON.stringify(h)}).hero, 'baton')`), 'после перезахода в рюкзаке осталась палочка сорванной эстафеты');
    } else fails.push('вторая эстафета не началась — срыв не проверен');
  }
}

// ---------- 4. Передать хлеб ----------
{
  R(`for (const n of ['Ая', 'Бо']) coop.players.get(n).hero.inv.fill(null); coop.rq = null; coop.relayDay = coopDayIx(); coop.breadDay = -1; coop.rqNext = 0;
     Game.buildings.find(b => b.type === 'storehouse').stock.bread += 10`);
  const bread0 = R(`Game.buildings.filter(b => b.isStore()).reduce((n, b) => n + b.stock.bread, 0)`);
  let started = false;
  for (let i = 0; i < 2400 && !started; i++) { wait(1); started = R('!!(coop.rq && coop.rq.kind === "bread")'); if (!started) R('coop.rqNext = 0; coop.breadDay = -1; coop.relayDay = coopDayIx()'); }
  ok(started, '«Передать хлеб» не началось');
  if (started) {
    ok(R(`Game.buildings.filter(b => b.isStore()).reduce((n, b) => n + b.stock.bread, 0)`) <= bread0 - 4, 'хлеб не взят со склада');
    const h = R('coop.rq.holder'), o = h === 'Ая' ? 'Бо' : 'Ая';
    const slow = R(`(() => { const u = coop.players.get(${JSON.stringify(h)}), v = teamSpeedMul(u); const s = u.hero.inv.findIndex(x => x && x.k === 'cargo'); const it = u.hero.inv[s]; u.hero.inv[s] = null; const w = teamSpeedMul(u); u.hero.inv[s] = it; return v / w; })()`);
    ok(Math.abs(slow - 0.8) < 0.01, `с грузом герой не медленнее (${slow})`);
    const c = JSON.parse(R(`JSON.stringify(__home(${JSON.stringify(h)}, 0))`));
    R(`__tp(${JSON.stringify(o)}, ${c[0]}, ${c[1]}); coop.actAt.clear()`);
    const slot = R(`coop.players.get(${JSON.stringify(h)}).hero.inv.findIndex(s => s && s.k === 'cargo')`);
    cmd(h, { t: 'give', to: o, slot });
    ok(R('coop.rq.holder') === o, 'груз не передан напарнику');
    const gold0 = R(`Game.buildings.filter(b => b.isStore()).reduce((n, b) => n + (b.stock.gold || 0), 0)`);
    R(`__tp(${JSON.stringify(o)}, coop.rq.x, coop.rq.y)`);
    drain();
    wait(1.5);
    ok(!R('coop.rq'), 'груз не доставлен у метки');
    ok(toasts().some(t => /Хлеб довезли/.test(t)), 'нет сообщения о доставке хлеба');
    ok(R(`Game.buildings.filter(b => b.isStore()).reduce((n, b) => n + (b.stock.gold || 0), 0)`) > gold0, 'за доставку нет золота');
  }
}

// ---------- 5. Новый район: голосование Совета, бонус, зеркало, сохранение ----------
{
  R(`distDone = () => 99; Game.dist = null; coop.cn = null; coop.cnDay = -1`);
  const opts = JSON.parse(R('JSON.stringify(distScan())'));
  ok(opts.length >= 2 && new Set(opts.map(o => o.k)).size === opts.length, 'мест для района меньше двух или виды повторяются: ' + JSON.stringify(opts));
  console.log('места района: ' + opts.map(o => o.l).join('; '));
  let open = false;
  for (let i = 0; i < 2400 && !open; i++) { wait(1); open = R('!!(coop.cn && coop.cn.kind === "district")'); if (!open && R('!!coop.cn')) R('coop.cn = null; coop.cnDay = -1'); }
  ok(open, 'Совет не начал голосование за район');
  if (open) {
    const q = JSON.parse(R(`JSON.stringify(coopQuestInfo('Ая').c)`));
    ok(q.pts && q.pts.length === q.o.length, 'клиенту не уходят места района для подсветки');
    cmd('Ая', { t: 'vote', i: 0 }); cmd('Бо', { t: 'vote', i: 0 });
    wait(1.5);
    ok(R('!!Game.dist'), 'по итогам голосования район не выбран');
    const d = JSON.parse(R('JSON.stringify(Game.dist)'));
    // бонус: здание своего ремесла внутри района работает быстрее
    const k = R(`(() => { const t = DIST_KINDS[Game.dist.k].b.find(t => BUILDINGS[t]); const fake = { type: t, x: Game.dist.x - 1, y: Game.dist.y - 1, w: 2, h: 2, removed: false }; const out = { ...fake, x: Game.dist.x + 30, y: Game.dist.y + 30 }; return [distWork({ home: fake }), distWork({ home: out })]; })()`);
    ok(k[0] > 1.2 && k[1] === 1, 'бонус района не действует: ' + JSON.stringify(k));
    sync();
    ok(cli.h.run('JSON.stringify(Game.dist)') === JSON.stringify(d), 'клиент не видит выбранный район: ' + cli.h.run('JSON.stringify(Game.dist)'));
    srv.h.ctx.__s = R('JSON.stringify(serializeGame())');
    R('Game.dist = null; applySave(JSON.parse(__s))');
    ok(R('JSON.stringify(Game.dist)') === JSON.stringify(d), 'район не пережил сохранение');
  }
}

// ---------- 6. Одиночная игра: решает игрок ----------
{
  const solo = S.newSim(77, { files });
  const r = js => solo.h.run(js);
  r('distDone = () => 99; Game.dist = null; Game.distOffer = null; distTick()');
  const n = r('Game.distOffer ? Game.distOffer.opts.length : 0');
  ok(n >= 2, 'в одиночной игре не предложены места района');
  if (n >= 2) {
    r(`UI.tab = 'council'; distClick('pick:1')`);
    ok(r('!!Game.dist && !Game.distOffer'), 'выбор игрока в одиночке не сработал');
    ok(/строится здесь/.test(r('distHTML()')), 'часть «Новый район» во вкладке «Совет» пустая');
  }
  for (const e of solo.errors) ok(false, 'одиночка: ' + e);
}

for (const e of srv.errors) ok(false, 'сервер: ' + e);
for (const e of cli.errors) ok(false, 'клиент: ' + e);
console.log(fails.length ? `Проверка кооп-пакета: провалов ${fails.length}` : 'Проверка кооп-пакета: декор, район, передача, эстафета, хлеб — всё в порядке');
process.exit(fails.length ? 1 : 0);
