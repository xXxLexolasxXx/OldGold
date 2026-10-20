'use strict';
// Управление рабочими (js/workers.js): без назначений экономика прежняя; лимит, закрепление, маршрут курьера,
// пинок с кулдауном, «почему стоит», «Перенос ресурсов», сохранение, кооп-команда.
// Запуск: node tests/workers-test.js [минуты]
const S = require('./lib/sim');
const MIN = +process.argv[2] || 6;
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

function run(label, setup, opts = {}) {
  const sim = S.newSim(opts.seed || 7, opts);
  if (setup) sim.h.run(setup);
  S.runFor(sim, (opts.min || MIN) * 60, 10, k => { if (k % 3 === 0) S.botTurn(sim); if (opts.each) sim.h.run(opts.each); });
  const r = S.inspect(sim);
  const p = r.produced;
  console.log(`${label.padEnd(26)} зданий ${r.n.buildings}, жителей ${r.n.units}, брёвна ${p.trunk | 0}, доски ${p.timber | 0}, хлеб ${p.bread | 0}, камень ${p.stone | 0}, ошибок ${sim.errors.length}`);
  ok(!sim.errors.length, `${label}: исключения: ${sim.errors.slice(0, 2).join(' | ')}`);
  for (const pr of S.checkInvariants(sim, label).problems) ok(false, pr);
  return { sim, r, p };
}

// 1) автоматика по умолчанию не меняется: явное «Авто» у переноса == пусто
const base = run('без назначений');
const auto = run('перенос «Авто» явно', 'prioSet("tasks","haul",2)');
ok(JSON.stringify(auto.p) === JSON.stringify(base.p), '«Перенос ресурсов: Авто» меняет экономику');
run('перенос «Высокий»', 'prioSet("tasks","haul",3)');
run('перенос «Выкл»', 'prioSet("tasks","haul",0)');

// 2) лимит: работяг на работе 0 — стройка стоит
const noB = run('работяг на работе: 0', 'wkSetCap("builder", 0)');
ok(noB.r.n.buildings <= base.r.n.buildings, 'лимит работяг 0: зданий не больше, чем с автоматикой');
// трудяг не больше 1 одновременно
const capS = run('трудяг на работе: 1', 'wkSetCap("serf", 1); Game.__mx = 0;', { each: 'Game.__mx = Math.max(Game.__mx, Game.units.filter(u => u.type === "serf" && !u.idleFlag && !u.dead && !u.eat && !u.brk && u.dlv).length)' });
ok(capS.sim.h.run('Game.__mx') <= 1, 'лимит трудяг 1 нарушен: одновременно везли ' + capS.sim.h.run('Game.__mx'));

// 3) маршрут курьера и закрепление работяги — на сыгранной деревне
{
  const sim = S.newSim(11);
  S.runFor(sim, 5 * 60, 10, k => { if (k % 3 === 0) S.botTurn(sim); });
  const h = sim.h;
  h.run(`Game.__log = [];
    const _ad = assignDelivery; assignDelivery = function (u, f, t, g, n) { Game.__log.push([u.id, f.id, t.isStore && t.isStore() ? 'store' : t.id]); return _ad(u, f, t, g, n); };`);
  const src = h.run('(Game.buildings.find(b => b.state === "done" && b.type === "woodcutter") || Game.buildings.find(b => b.state === "done" && b.def.outputs && !b.isStore()) || {}).id');
  ok(src, 'нет мастерской для маршрута');
  const sid = h.run(`(() => { const u = Game.units.find(u => u.type === "serf" && !u.dead); return wkSetPin(u, { from: ${src}, to: "store" }) ? u.id : 0; })()`);
  ok(sid, 'маршрут курьеру не задался');
  // остальные трудяги отдыхают — иначе брёвна у лесоруба разбирают раньше, и маршрут нечего проверить
  h.run(`for (const u of Game.units) if (u.type === "serf" && u.id !== ${sid}) wkSetPin(u, { off: 1 });`);
  ok(!h.run(`wkSetPin(Game.unitMap.get(${sid}), { from: 999999, to: "store" })`), 'маршрут из несуществующего здания принят');
  ok(!h.run(`wkSetPin(Game.unitMap.get(${sid}), { from: ${src}, to: "store", x: 1 })`), 'маршрут с мусорным полем принят');
  // работяга — за новой стройкой
  const site = h.run(`(() => { const hub = Game.buildings.find(b => b.isStore()); for (let r = 4; r < 20; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = hub.x + dx, y = hub.y + dy; if (!checkPlacement("woodcutter", x, y)) { const b = placeBuilding("woodcutter", x, y); if (b) return b.id; } } return 0; })()`);
  const bid = site ? h.run(`(() => { const u = Game.units.find(u => u.type === "builder" && !u.dead); return wkSetPin(u, { b: ${site} }) ? u.id : 0; })()`) : 0;
  if (site) ok(bid, 'работяга не закрепился за стройкой');
  else console.log('  ⚠ не нашлось места для стройки — закрепление работяги не проверено');
  // брёвна у источника — чтобы маршруту было что возить
  h.run(`{ const b = Game.buildings.find(b => b.id === ${src}); const g = Object.keys(b.def.outputs)[0]; b.stock[g] = b.def.outputs[g]; }`);
  S.runFor(sim, 20, 2);                // закреплённый донёс то, что было в руках
  h.run('Game.__jobs = new Set();');
  S.runFor(sim, 3 * 60, 2, () => h.run(bid ? `{ const u = Game.unitMap.get(${bid}); if (u && u.job) Game.__jobs.add(u.job.id); }` : '0'));
  const mine = h.run(`JSON.stringify(Game.__log.filter(l => l[0] === ${sid}))`);
  const ls = JSON.parse(mine);
  ok(ls.every(l => l[1] === src && l[2] === 'store'), 'курьер с маршрутом вёз не по маршруту: ' + mine.slice(0, 200));
  ok(ls.length > 0, 'курьер с маршрутом ничего не отвёз');
  ok(JSON.parse(h.run(`JSON.stringify(Game.__log.filter(l => Game.unitMap.get(l[0]) && Game.unitMap.get(l[0]).type === "serf" && l[0] !== ${sid}))`)).length === 0, 'трудяги «Отдыхать» всё равно возили');
  console.log(`маршрут: доставок по маршруту ${ls.length}, всего доставок ${h.run('Game.__log.length')}`);
  if (bid) { const js = JSON.parse(h.run('JSON.stringify([...Game.__jobs])')); ok(js.every(j => j === site), 'закреплённый работяга строил чужое: ' + js); }
  // пинок
  h.run('for (const u of Game.units) u.kickAt = undefined; Game.hero.kickCD = 0;');
  const idle = h.run('(Game.units.find(u => wkKickable(u) && u.idleFlag) || {}).id');
  if (idle) {
    ok(h.run(`wkKick(Game.hero, Game.unitMap.get(${idle}))`) === '', 'пинок праздного не сработал');
    ok(h.run(`Game.unitMap.get(${idle}).kickUntil > Game.time`), 'пнутый не получил «бодрость»');
    h.run('Game.hero.kickCD = 0');
    ok(/не отошёл/.test(h.run(`wkKick(Game.hero, Game.unitMap.get(${idle}))`)), 'нет кулдауна пинка того же гнома');
  } else console.log('  ⚠ праздных нет — пинок не проверен');
  const busy = h.run('(Game.units.find(u => u.dlv && !u.brk && wkSelectable(u)) || {}).id');
  if (busy) ok(/при деле/.test(h.run(`wkKick(Game.hero, Game.unitMap.get(${busy}))`)), 'пинок занятого должен отказать');
  // почему стоит: у всех праздных рабочих есть причина
  h.run('wkWhyAll()');
  const silent = h.run('Game.units.filter(u => u.idleFlag && !u.dead && wkSelectable(u) && !u.why && !u.brk).length');
  ok(silent === 0, `праздные без причины: ${silent}`);
  const sample = h.run('JSON.stringify([...new Set(Game.units.filter(u => u.why).map(u => u.why))].slice(0, 6))');
  console.log('причины: ' + sample);
  // сохранение
  h.run('wkSetCap("serf", 3)');
  const save = JSON.parse(h.run('JSON.stringify(serializeGame())'));
  ok(save.wk && save.wk.cap.serf === 3 && save.wk.pins.length >= 1, 'назначения не попали в сохранение');
  save.wk.pins.push([0, { evil: 1 }]); save.wk.cap.hero = 5;
  h.ctx.__s = save; h.run('applySave(__s)');
  ok(h.run('wkCap("serf")') === 3 && h.run('Game.wk.cap.hero') === undefined, 'лимиты не восстановились или принят мусор');
  ok(h.run('Game.units.filter(u => u.wk && u.wk.from != null).length') >= 1, 'маршрут не восстановился из сохранения');
  ok(h.run('!!(Game.units[0] && Game.units[0].wk && Game.units[0].wk.evil)') === false, 'мусорное назначение попало в игру');
  h.run('wkReset()');
  ok(!('wk' in JSON.parse(h.run('JSON.stringify(serializeGame())'))), 'пустые назначения не должны писаться в сохранение');
  ok(!sim.errors.length, 'исключения: ' + sim.errors.slice(0, 2).join(' | '));
}

// 4) кооп: команда через сервер, поля для клиентов
{
  const sim = S.newSim(5, { coop: true });
  S.stepN(sim, 40);
  const h = sim.h;
  ok(h.run('COOP_UNIT_EX.includes("why") && COOP_UNIT_EX.includes("wk")'), 'поля рабочих не уходят клиентам');
  h.run('coop.out.length = 0');
  h.run(`coopCmd("хост", JSON.stringify({ t: "wk", a: "cap", job: "serf", v: 2 }), true)`);
  ok(h.run('wkCap("serf")') === 2, 'кооп: лимит не применился');
  ok(h.run('coop.out.some(o => o.msg && o.msg.t === "wk" && o.msg.cap.serf === 2)'), 'кооп: лимит не разослан');
  h.run('coop.perms.manage = false');
  h.run(`coopCmd("гость", JSON.stringify({ t: "wk", a: "cap", job: "serf", v: 0 }), false)`);
  ok(h.run('wkCap("serf")') === 2, 'кооп: гость без права «manage» поменял лимит');
  const uid = h.run('(Game.units.find(u => u.type === "builder") || {}).id');
  h.run(`coopCmd("хост", JSON.stringify({ t: "wk", a: "pin", id: ${uid}, p: { off: 1 } }), true)`);
  ok(h.run(`!!Game.unitMap.get(${uid}).wk`), 'кооп: «отдыхать» не применилось');
  h.run(`coopCmd("хост", JSON.stringify({ t: "wk", a: "kick", id: ${uid} }), true)`);
  S.stepN(sim, 40);
  ok(!sim.errors.length, 'кооп: исключения: ' + sim.errors.slice(0, 2).join(' | '));
}

console.log(fails.length ? `\nПровалено: ${fails.length}` : '\nРабочие: OK');
process.exit(fails.length ? 1 : 0);
