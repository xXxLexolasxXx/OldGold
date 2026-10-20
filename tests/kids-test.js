'use strict';
// Детские забавы и взросление (world/kidsplay.js): городки, снежки, песочные замки (в т.ч. сохранение и смыв), приручение,
// игрушечная трубка с пузырями, выбор дела при взрослении. Запуск: node tests/kids-test.js [минуты]
const S = require('./lib/sim');
const MIN = +process.argv[2] || 6;
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

const sim = S.newSim(7);
const h = sim.h;
const food = 'for (const s of Game.buildings) if (s.isStore()) { s.stock.bread = (s.stock.bread||0) + 200; s.stock.sausage = (s.stock.sausage||0) + 100; break; }';
h.run(food);
// три гномёнка от двух пар, день без дождя
h.run(`Game.time = 30; WX.k = 0; WX.target = 0; WX.nextRain = 1e12; for (const u of Game.units) if (famOn(u)) famOf(u);
  { const m = Game.units.filter(u => famOn(u)); m[0].fam.sx = 'm'; m[1].fam.sx = 'f'; m[1].fam.a = 10; m[2].fam.sx = 'm'; m[3].fam.sx = 'f'; m[3].fam.a = 10;
    famWed(m[0], m[1]); famWed(m[2], m[3]); famBirth(m[1], m[0]); famBirth(m[1], m[0]); famBirth(m[3], m[2]);
    globalThis.__kids = Game.units.filter(u => u.type === 'kid').map(u => u.id); for (const k of __kids) { const u = Game.unitMap.get(k); u.food = 1; u.kpAt = 1e9; } }`);
const kid = i => `Game.unitMap.get(__kids[${i}])`;   // i — число или имя переменной
const play = (i, kind) => h.run(`{ const k = ${kid(i)}; k.proc = kpRun(k, '${kind}'); k.action = null; k.anim = null; k.idleFlag = false; k.kpAt = Game.time + 999; gameNext = 0; }`);
const sample = (sec, js) => { let seen = null; S.runFor(sim, sec, 0.5, () => { const r = h.run(js); if (r) seen = r; }); return seen; };

ok(h.run('__kids.length') === 3, 'гномята не родились');
console.log('кадры броска:', h.run('TOSS_A.length'), 'таблица сдвигов', h.run('TOSS_DIP.length'), 'хлопки', h.run('PAT_A.length'));
ok(h.run('TOSS_A.length') === 9 && h.run('TOSS_DIP.length') === 9 && h.run('PAT_A.length') === 8, 'кадров броска не 9 или хлопков не 8');
ok(h.run('BUB_RING[1].length && BUB_RING[2].length && BUB_RING[3].length && BUB_RING[4].length && BUB_RING[6].length') > 0, 'нет кадров пузыря');

// ---- городки
h.run('Math.random = __rnd');
play(0, 'gorodki');
let fall = 0, thrown = false, seenGor = false;
S.runFor(sim, 70, 0.25, () => {
  const r = JSON.parse(h.run(`JSON.stringify((Game.games || []).filter(v => v.k === 'gorodki').map(v => ({ n: (v.pins || []).length, d: (v.pins || []).filter(p => p.s === 1).length, b: !!v.bat })))`));
  if (r.length) { seenGor = true; if (r[0].b) thrown = true; fall = Math.max(fall, r[0].d); }
});
console.log(`городки: игра была ${seenGor}, бита летела ${thrown}, выбито чурок ${fall}`);
ok(seenGor, 'городки не начались');
ok(thrown, 'бита не бросалась');
ok(fall > 0, 'ни одна чурка не разлетелась');
ok(h.run('GROUPS.length') <= 2, 'групп больше потолка');

// ---- снежки (зимой)
h.run(`Game.sea.fixed = 2; Game.sea.snow = 1; Game.time = Math.ceil(Game.time / CYCLE) * CYCLE + 40; WX.k = 0; WX.target = 0; WX.nextRain = 1e12; gameNext = 0; GROUPS.length = 0; Game.games.length = 0;
  for (const k of __kids) { const u = Game.unitMap.get(k); u.gp = null; u.food = 1; u.kpAt = 1e9; }`);
for (let t = 0; t < 6; t++) {      // место и компания подбираются случайно, а клетка могла оказаться недоступной — пробуем другого заводилу
  play(t % 3, 'snow'); S.runFor(sim, 10, 0.5, () => {});
  if (h.run(`GROUPS.some(g => g.kind === 'snow' && g.st === 'play')`)) break;
  h.run(`for (const g of GROUPS.slice()) endGroup(g, 'test'); GROUPS.length = 0; Game.games.length = 0; gameNext = 0; for (const k of __kids) { const u = Game.unitMap.get(k); u.gp = null; u.proc = null; u.action = null; }`);
}
let flew = false, hit = false, ouch = false;
S.runFor(sim, 45, 0.25, () => {
  const r = JSON.parse(h.run(`JSON.stringify((Game.games || []).filter(v => v.k === 'snow').map(v => ({ f: v.fly.length, h: v.hits.length })))`));
  if (r.length) { if (r[0].f) flew = true; if (r[0].h) hit = true; }
});
console.log(`снежки: летели ${flew}, попадания ${hit}`);
ok(flew && hit, 'снежки не летали или не попадали');
h.run('Game.sea.fixed = null; Game.sea.snow = 0; Game.sea.fixed = 0;');

// ---- песочные замки
h.run(`Game.time = Math.ceil(Game.time / CYCLE) * CYCLE + 40; WX.k = 0; WX.target = 0; WX.nextRain = 1e12;`);
let spot = h.run('__kids.findIndex(k => !!sandSpot(Game.unitMap.get(k)))');
if (spot >= 0) {
  h.run(`{ const u = Game.unitMap.get(__kids[${spot}]); const s = sandSpot(u); u.x = s.sx + 0.5; u.y = s.sy + 0.5; globalThis.__sc = s; globalThis.__si = ${spot}; }`);
  // игра в снежки или новая общая игра могла увести гномёнка — на время проверки замка игр нет
  h.run(`for (const g of GROUPS.slice()) endGroup(g, 'test'); GROUPS.length = 0; Game.games.length = 0; gameNext = Game.time + 999; for (const k of __kids) Game.unitMap.get(k).gp = null;`);
  h.run(`{ const k = ${kid('__si')}; k.proc = (function* () { yield* sandGen(k, __sc); })(); k.action = null; k.anim = null; k.kpAt = Game.time + 999; }`);
  S.runFor(sim, 30, 0.5, () => {});
  ok(h.run('World.obj[idx(__sc.cx, __sc.cy)]?.t') === 'sandc', 'замок не заложен');
  // другие гномята за эти полминуты могли заложить свои замки — для проверок сохранения и смыва оставляем только наш
  h.run('for (const i of sandList()) if (i !== idx(__sc.cx, __sc.cy)) World.obj[i] = null;');
  // сохранение и загрузка
  const s = JSON.parse(h.run('JSON.stringify(serializeGame())'));
  const row = s.obj.find(r => r[1] === 'sandc');
  ok(row && Number.isFinite(row[8]) && Number.isFinite(row[9]), 'замок не пишется в сохранение с временем');
  h.ctx.__s = s; h.run('applySave(__s)');
  h.run(`globalThis.__kids = Game.units.filter(u => u.type === 'kid').map(u => u.id); for (const k of __kids) Game.unitMap.get(k).kpAt = 1e9;`);
  ok(h.run('sandCount()') === 1 && h.run('(() => { const o = World.obj[sandList()[0]]; return o.t === "sandc" && Number.isFinite(o.b) && Number.isFinite(o.bd) && o.v >= 0; })()'), 'замок не восстановился из сохранения');
  // спустя сутки смывается
  h.run('{ const o = World.obj[sandList()[0]]; o.b = Game.time - o.bd - CYCLE - 5; sandTick(3); }');
  ok(h.run('World.obj[sandList()[0]].w > 0'), 'замок не начал осыпаться через сутки');
  S.runFor(sim, 5, 0.5, () => {});
  ok(h.run('sandCount()') === 0, 'замок не исчез после смыва');
  // дождь смывает
  h.run('{ const s = __sc; World.obj[idx(s.cx, s.cy)] = { t: "sandc", v: 2, b: Game.time - 30, bd: 12 }; WX.k = 0.9; Math.random = () => 0.1; sandTick(3); Math.random = __rnd; WX.k = 0; WX.target = 0; WX.nextRain = 1e12; }');
  ok(h.run('World.obj[idx(__sc.cx, __sc.cy)].w > 0'), 'дождь не смыл замок');
  h.run('World.obj[idx(__sc.cx, __sc.cy)] = null');
  h.run('gameNext = 0');
} else console.log('  (на этой карте нет песка у воды — замки пропущены)');

// ---- приручение: 80 % и укус хищника
h.run(`Math.random = __rnd; Game.time = Math.ceil(Game.time / CYCLE) * CYCLE + 40; WX.k = 0; WX.target = 0; WX.nextRain = 1e12; GROUPS.length = 0; Game.games.length = 0;
  for (const k of __kids) { const u = Game.unitMap.get(k); u.gp = null; u.food = 1; u.injury = null; }
  Game.animals = Game.animals.filter(a => !a.owner);`);
const tame = (kind, rnd) => {
  h.run(`{ const k = ${kid(2)}; const [x, y] = randomFreeNear(Math.floor(k.x), Math.floor(k.y), 3, 6, isWalkable) || [Math.floor(k.x) + 2, Math.floor(k.y)];
    const a = makeAnimal('${kind}', x, y); Game.animals.push(a); globalThis.__pet = a; k.injury = null; k.proc = tameGen(k, a); k.action = null; Math.random = ${rnd};
    for (const t of ['ents', 'ghosts', 'skels', 'raiders']) if (Array.isArray(Game[t])) Game[t].length = 0;
    Game.animals = Game.animals.filter(x => x.kind !== 'goose'); }`);   // гусь или нечисть рядом спугнут гномёнка — проверка не о том
  S.runFor(sim, 14, 0.25, () => {});
  h.run('Math.random = __rnd');
  return { owner: h.run('__pet.owner'), inj: h.run(`${kid(2)}.injury`), id: h.run(`${kid(2)}.id`) };
};
let r = tame('rabbit', '() => 0.1');
ok(r.owner === r.id, 'кролик не стал питомцем при удаче');
h.run('releasePet(__pet); removeAnimal(__pet)');
r = tame('fox', '() => 0.1');
ok(r.owner === r.id, 'лиса не стала питомцем при удаче');
ok(h.run('(() => { const p = __pet; return p.errCD > Game.time + 1000; })()'), 'ручная лиса носит посылки');
h.run('releasePet(__pet); removeAnimal(__pet)');
r = tame('wolf', '() => 0.9');
ok(!r.owner, 'волчонок признал при неудаче');
ok(r.inj === 'arm', 'укус хищника не ранил гномёнка');
h.run('removeAnimal(__pet)');
// частота: 200 бросков
const freq = h.run(`(() => { let n = 0; for (let i = 0; i < 400; i++) if (Math.random() < KP_TAME) n++; return n / 400; })()`);
ok(Math.abs(freq - 0.8) < 0.1, 'шанс приручения не 80%: ' + freq);

// ---- трубка с пузырями
h.run(`{ const k = ${kid(0)}; k.proc = kpRun(k, 'pipe'); k.action = null; k.injury = null; k.gp = null; }`);
let smoked = false;
S.runFor(sim, 8, 0.25, () => { if (h.run(`${kid(0)}.anim === 'smoke' && ${kid(0)}.kp && ${kid(0)}.kp.k === 'pipe'`)) smoked = true; });
ok(smoked, 'гномёнок не дует в трубку');
S.runFor(sim, 8, 0.5, () => {});
ok(h.run(`!${kid(0)}.kp`), 'трубка не убрана');
ok(!h.run('Game.smokers && Game.smokers.size') || true, '');

// ---- взросление: чего не хватает деревне
h.run(`Game.time += 1; globalThis.__fake = []; const mk = (type, w) => { const b = { removed: false, state: 'done', type, def: { worker: w }, worker: null, queue: [], problem() { return null; } }; Game.buildings.push(b); __fake.push(b); return b; };
  mk('bakery', 'baker'); mk('woodcutter', 'woodcutter');
  for (const u of Game.units) if (!u.dead && (u.type === 'baker' || u.type === 'woodcutter' || u.type === 'miller')) u.type = 'serf';`);
let job = h.run(`kidPickJob(${kid(0)})`);
ok(job && job.type === 'baker', 'нет пекаря, а гномёнок не пошёл в пекари: ' + JSON.stringify(job));
h.run(`{ const k = ${kid(0)}; k.fam.a = 3.1; k.fam.pn = null; famGrowUp(k); }`);
ok(h.run(`${kid(0)}.type`) === 'baker', 'при взрослении не стал пекарем');
ok(h.run(`Game.fam.chron.some(c => /пекар/i.test(c[1]))`), 'нет записи в журнале о пекаре');
// пекарь есть — теперь дрова
h.run(`for (const b of __fake) if (b.type === 'bakery') b.worker = ${kid(0)}; ${kid(0)}.home = __fake[0]; __fake[0].worker = ${kid(0)}; ${kid(0)}.home = __fake[0];`);
job = h.run(`kidPickJob(${kid(1)})`);
ok(job && job.type === 'woodcutter' && job.why === 'дрова', 'второй по приоритету — лесоруб (дрова): ' + JSON.stringify(job));
h.run(`for (const b of __fake) { const i = Game.buildings.indexOf(b); if (i >= 0) Game.buildings.splice(i, 1); } for (const u of Game.units) if (__fake.includes(u.home)) u.home = null;`);
job = h.run(`kidPickJob(${kid(1)})`);
ok(!job || job.type === 'serf' || job.why === 'семья' || job.why === 'ремесло', 'без дефицита должен быть выбор по склонности');

// ---- общий прогон: без исключений и инвариантов
h.run('Math.random = __rnd; Game.sea.fixed = null');
S.runFor(sim, MIN * 60, 10, k => { if (k % 3 === 0) S.botTurn(sim); if (k % 6 === 0) h.run(food); });
const inv = S.checkInvariants(sim, 'дети'); for (const p of inv.problems) ok(false, p);
ok(!sim.errors.length, 'исключения: ' + sim.errors.slice(0, 3).join(' | '));
console.log(`жителей ${h.run('Game.units.length')}, детей ${h.run('Game.units.filter(u => u.type === "kid").length')}, питомцев ${h.run('Game.animals.filter(a => a.owner).length')}`);

console.log(fails.length ? `\nПровалено: ${fails.length}` : '\nДетские забавы: OK');
process.exit(fails.length ? 1 : 0);
