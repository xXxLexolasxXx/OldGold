'use strict';
// Профсоюзы (js/unions.js): советы по постройкам и ремеслу осмысленны в сценариях и на нескольких сидах,
// действия ссылаются на живые здания и открытые постройки, показ редкий и выключаемый, сохранение, кооп.
// Запуск: node tests/unions-test.js [минуты]
const S = require('./lib/sim');
const MIN = +process.argv[2] || 20;
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };
const J = (sim, code) => JSON.parse(sim.h.run(`JSON.stringify((() => { ${code} })())`));
const PLACE = `function placeAny(type, done) {
    const hub = Game.buildings.find(b => b.type === 'storehouse');
    for (let rr = 3; rr < 26; rr++) for (let k = 0; k < 24; k++) {
      const x = Math.round(hub.doorX + Math.cos(k * 0.5) * rr * 1.6), y = Math.round(hub.doorY + Math.sin(k * 0.5) * rr);
      if (inb(x, y) && !checkPlacement(type, x, y, 0)) { return placeBuilding(type, x, y, !!done, 0); }
    }
    throw new Error('нет места для ' + type);
  }`;
// советы пересчитываются раз в 10 с и должны продержаться две проверки
const adv = sim => { sim.h.run('unT = -1e9; unTick(); unT = -1e9; unTick();'); return J(sim, 'return Game.un.adv;'); };
const ids = l => l.map(a => a.id);

// проверка любого списка: не больше 3, без повторов, действие ведёт к живому зданию / открытой постройке
function sane(sim, label, a) {
  for (const k of ['w', 'c']) {
    const L = a[k] || [];
    ok(L.length <= 3, `${label}: советов ${k} больше трёх: ${ids(L)}`);
    ok(new Set(ids(L)).size === L.length, `${label}: повторы в советах ${k}: ${ids(L)}`);
    for (const x of L) {
      const bad = J(sim, `const a = ${JSON.stringify(x.act)}; if (!a) return '';
        if (a.k === 'build') return BUILDINGS[a.type] && unOpen(a.type) ? '' : 'закрытая постройка ' + a.type;
        if (a.id != null && !Game.buildings.some(b => b.id === a.id && !b.removed)) return 'нет здания ' + a.id;
        if (a.k === 'train' && !UNIT_TYPES[a.type]) return 'нет профессии ' + a.type;
        return '';`);
      ok(!bad, `${label}: совет ${x.id} — ${bad}`);
      ok(!/\{\d\}/.test(J(sim, `return unText(${JSON.stringify(x)});`)), `${label}: в тексте совета ${x.id} остался {N}`);
    }
  }
}

// 1) прогоны на сидах: профсоюзы собираются, советы держатся в рамках и не ломают игру
for (const seed of [7, 11, 22]) {
  const sim = S.newSim(seed);
  const seen = { w: new Set(), c: new Set() };
  S.runFor(sim, MIN * 60, 10, k => {
    if (k % 3 === 0) S.botTurn(sim);
    if (k % 6 === 5) { const a = J(sim, 'return Game.un ? Game.un.adv : { w: [], c: [] };'); sane(sim, 'сид ' + seed, a); for (const x of a.w) seen.w.add(x.id); for (const x of a.c) seen.c.add(x.id); }
  });
  ok(!sim.errors.length, `сид ${seed}: исключения: ${sim.errors.slice(0, 2).join(' | ')}`);
  console.log(`сид ${seed}: трудяги ${[...seen.w].join(', ') || '—'}; мастера ${[...seen.c].join(', ') || '—'}`);
}

// 2) сценарии: на чистой деревне — понятная причина и понятный совет
{
  const sim = S.newSim(7);
  S.runFor(sim, 4 * 60, 10, k => { if (k % 3 === 0) S.botTurn(sim); });
  // профсоюз собирается только с опытным трудягой
  sim.h.run('for (const u of Game.units) if (u.type === "serf" || u.type === "builder") u.xp = 0;');
  ok(!J(sim, 'return unHasWorkers();'), 'профсоюз без опытных трудяг не должен собираться');
  sim.h.run('Game.units.find(u => u.type === "serf" && !u.dead).xp = 50;');
  ok(J(sim, 'return unHasWorkers();'), 'профсоюз с опытным трудягой не собрался');

  // нет камня, а стройки ждут — каменоломня
  const a1 = J(sim, `${PLACE}
    for (const b of Game.buildings) if (b.isStore()) b.stock.stone = 0;
    for (const p of Game.piles.values()) p.stock.stone = 0;
    for (const b of Game.buildings) if (b.def.outputs && b.def.outputs.stone) b.stock.stone = 0;
    placeAny('storehouse'); placeAny('inn');
    unT = -1e9; unTick(); unT = -1e9; unTick();
    return Game.un.adv.w;`);
  const st = a1.find(a => a.id === 'mat:stone');
  ok(st && st.act && st.act.type === 'quarry', 'нет камня при стройках — нет совета «каменоломня»: ' + ids(a1));

  // выученные пахари без фермы — ферма
  const a2 = J(sim, `for (let i = 0; i < 3; i++) { const h = Game.buildings.find(b => b.isStore()); spawnUnit('farmer', h.doorX + 0.5, h.doorY + 1.5); }
    for (const b of Game.buildings.filter(b => b.type === 'farm')) removeBuilding(b);
    Game.un.streak = {}; unT = -1e9; unTick(); unT = -1e9; unTick();
    return Game.un.adv.w.concat(unPick(unBuildAdvice(), Game.un.adv.w));`);
  const fm = a2.find(a => a.id === 'idle:farmer');
  ok(fm && fm.act.type === 'farm', 'пахари без фермы — нет совета «ферма»: ' + ids(a2));
  sane(sim, 'сценарий постройки', adv(sim));

  // раненые и лазарет с кожей — перевязки; оружие для гильдии — заказ/постройка
  const c1 = J(sim, `${PLACE}
    const inf = placeAny('infirmary', true); inf.stock.leather = 4;
    for (const b of Game.buildings) if (b.type === 'infirmary') b.recipeOn = b.def.recipes.map(() => true);
    const ppl = Game.units.filter(u => isPerson(u) && !u.dead && u.type !== 'hero').slice(0, 3);
    for (const u of ppl) u.injury = 'leg';
    // два мастера (лекарь и пекарь) — цех собрался
    const h = Game.buildings.find(b => b.isStore());
    const doc = spawnUnit('healer', h.doorX + 0.5, h.doorY + 1.5); doc.home = inf; inf.worker = doc;
    const bak = placeAny('bakery', true), bk = spawnUnit('baker', h.doorX + 0.5, h.doorY + 1.5); bk.home = bak; bak.worker = bk;
    return { has: unHasCrafters(), adv: unCraftAdvice().map(a => ({ id: a.id, act: a.act, text: unText(a) })) };`);
  ok(c1.has, 'цех мастеров не собрался при двух мастерах');
  const bd = c1.adv.find(a => /bandage$/.test(a.id));
  ok(bd, 'раненые есть, перевязок нет — цех молчит: ' + JSON.stringify(c1.adv.map(a => a.id)));
  ok(!bd || /ранен/.test(bd.text), 'в совете про перевязки нет числа раненых: ' + (bd && bd.text));

  const c2 = J(sim, `${PLACE}
    const g = placeAny('guild_warrior', true); for (const k in g.stock) g.stock[k] = 0;
    for (const b of Game.buildings) if (b.isStore()) { b.stock.sword = 0; b.stock.iron = 0; }
    return unCraftAdvice().filter(a => /sword$/.test(a.id)).map(a => ({ id: a.id, act: a.act }));`);
  ok(c2.length && (c2[0].act.k === 'build' || c2[0].act.k === 'focus'), 'гильдии нужны мечи — нет совета про оружейную или железо: ' + JSON.stringify(c2));

  // осень, еды мало — «печём впрок»
  const c3 = J(sim, `if (!Game.sea) return null; const S = Game.sea; S.fixed = null;
    const day = typeof seaDay === 'function' ? seaDay() : 0;
    // в середину осени: сдвигаем отсчёт так, чтобы seaIdx() === 1
    const len = S.len; let tries = 0; while (seaIdx() !== 1 && tries++ < 40) Game.time += CYCLE * len / 4;
    for (const b of Game.buildings) for (const f of ['bread', 'sausage', 'wheat', 'flour', 'chicken', 'croissant', 'steak']) b.stock[f] = 0;
    return { idx: seaIdx(), adv: unCraftAdvice().map(a => a.id) };`);
  if (c3) ok(c3.idx !== 1 || c3.adv.includes('winter'), 'осень, еды нет — цех не советует запасать: ' + JSON.stringify(c3));

  // 3) показ: редко, не в первые минуты, выключается
  const show = J(sim, `const calls = [];
    Notify.entry = { step: 9 }; Notify.offer = (t, f) => calls.push(t);
    Game.un.adv = { w: [{ id: 'x1', text: 'Совет {0}', args: [1], act: { k: 'build', type: 'quarry' } }, { id: 'x2', text: 'Ещё', args: [], act: { k: 'build', type: 'quarry' } }], c: [{ id: 'y1', text: 'Цех', args: [], act: { k: 'build', type: 'quarry' } }] };
    Game.un.seen = {}; Game.un.next = 0; UN.nextReal = 0;
    const t0 = Game.time; Game.time = 60; unShowTick(); const early = calls.length; Game.time = Math.max(t0, UN_START + 5);
    for (let i = 0; i < 5; i++) unShowTick();
    const once = calls.length;
    UN.nextReal = 0; Game.time += 30; unShowTick(); const tooSoonGame = calls.length;
    UN.nextReal = 0; Game.time += UN_EVERY * 60; unShowTick(); const second = calls.slice();
    unSetOn(false); UN.nextReal = 0; Game.time += UN_EVERY * 60; unShowTick(); const off = calls.length; unSetOn(true);
    Notify.entry.step = 2; UN.nextReal = 0; Game.time += UN_EVERY * 60; unShowTick(); const entering = calls.length;
    return { early, once, tooSoonGame, second, off, entering, seen: Game.un.seen };`);
  ok(show.early === 0, 'совет в первые минуты игры (новичку на старте)');
  ok(show.once === 1, `за один раз должно быть одно оповещение, а их ${show.once}`);
  ok(show.tooSoonGame === 1, 'второй совет раньше, чем через ' + 'UN_EVERY минут игры');
  ok(show.second.length === 2 && /Цех/.test(show.second[1]), 'второй совет должен быть от другого профсоюза: ' + show.second.join(' | '));
  ok(show.off === 2, 'выключенные советы всё равно показываются');
  ok(show.entering === 2, 'совет во время входа в игру');

  // 4) сохранение: какие советы звучали — помнится
  const sv = J(sim, `const s = JSON.parse(JSON.stringify(serializeGame())); applySave(s); return { seen: Game.un.seen, next: Game.un.next, has: !!s.un };`);
  ok(sv.has && sv.seen.x1 === show.seen.x1 && sv.next > 0, 'сохранение не помнит прозвучавшие советы: ' + JSON.stringify(sv));
  sim.h.run('applySave(Object.assign(JSON.parse(JSON.stringify(serializeGame())), { un: { seen: { a: "x", b: 5 }, next: "z" } }))');
  ok(J(sim, 'return Game.un.seen;').a === undefined && J(sim, 'return Game.un.seen;').b === 5, 'мусор в сохранении профсоюзов принят');
  ok(!sim.errors.length, 'сценарии: исключения: ' + sim.errors.slice(0, 2).join(' | '));
}

// 5) кооп: сервер считает и рассылает снимок советов
{
  const sim = S.newSim(5, { coop: true });
  S.runFor(sim, 5 * 60, 10, k => { if (k % 3 === 0) S.botTurn(sim); });
  sim.h.run('coop.out.length = 0; unSent = "-"; unT = -1e9; unTick();');
  ok(sim.h.run('coop.out.some(o => o.msg && o.msg.t === "un" && Array.isArray(o.msg.w) && Array.isArray(o.msg.c))'), 'кооп: советы не разосланы клиентам');
  sim.h.run('coop.out.length = 0; unT = -1e9; unTick();');
  ok(!sim.h.run('coop.out.some(o => o.msg && o.msg.t === "un")'), 'кооп: тот же снимок рассылается повторно без нужды');
  ok(!sim.errors.length, 'кооп: исключения: ' + sim.errors.slice(0, 2).join(' | '));
}

console.log(fails.length ? `Провалов: ${fails.length}` : 'Проверка профсоюзов: всё в порядке');
process.exit(fails.length ? 1 : 0);
