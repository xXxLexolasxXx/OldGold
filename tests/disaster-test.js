'use strict';
// Стихийные бедствия: знамение и удар, не в первые сутки, каждый вид на сидах (деревня выживает: склад цел, гномы живы,
// разрушено не больше лимита), колодец спасает поля от засухи, ремонт стоит материалов, сейв, кооп-зеркало, море без ocean.js.
// Запуск: node tests/disaster-test.js [сиды через запятую]   (печатает ✗, код выхода 1 при провале)
const L = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };
const SEEDS = (process.argv[2] || '11,22,33').split(',').map(Number);
const J = (h, c) => JSON.parse(h.run('JSON.stringify((function(){' + c + '})())'));

// подождать, пока бедствие отгремит (с запасом), шагами по секунде
function waitDone(sim, maxSec) {
  for (let s = 0; s < maxSec; s++) { L.stepN(sim, 20); if (!sim.h.run('!!(Game.dz.cur || Game.dz.pend)')) return s; }
  return -1;
}
// утро: событие не наложится на ночь
const MORNING = 'while (!(cycleAt(Game.time).p < 30 && cycleAt(Game.time).k >= 2)) Game.time += 5; Game.dz.next = Game.time + 1e6;';
const snap = h => J(h, `const hub = dzHub(); return { b: Game.buildings.filter(b => !b.removed).length, hub: !!hub && !hub.removed,
  ppl: Game.units.filter(u => !u.dead && isPerson(u)).length, rs: Game.roadSites.size,
  ids: Game.buildings.map(b => b.id), dmg: Math.max(0, ...Game.buildings.map(b => b.dmg || 0)) };`);

let totals = { fire: 0, quake: 0, wind: 0, blight: 0, typhoon: 0 };
for (const seed of SEEDS) {
  const sim = L.newSim(seed), h = sim.h;
  h.run('Game.dz.freq = 0');   // своё расписание выключено: бедствия вызываем сами
  // деревня побольше: бот строит хозяйство
  for (let k = 0; k < 40; k++) { L.botTurn(sim); L.stepN(sim, 600); }
  h.run(MORNING + 'Game.diff = "normal";');

  // не в первые сутки: сутки 0–1 — даже при «часто» знамений нет
  if (seed === SEEDS[0]) {
    const t0 = h.run('Game.time');
    h.run('Game.time = 30; Game.dz.next = 0; Game.dz.freq = 3;');
    L.stepN(sim, 600);
    ok(!h.run('!!Game.dz.pend') && h.run('cycleAt(Game.time).k') < 2, `сид ${seed}: знамение в первые сутки`);
    h.run(`Game.time = ${t0}; Game.dz.pend = null; Game.dz.cur = null; Game.dz.freq = 0;` + MORNING);
  }

  // поля для засухи и пожара: засеваем свободную траву вокруг ферм
  h.run(`for (const f of Game.buildings.filter(b => b.type === 'farm')) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const x = f.doorX + dx, y = f.doorY + 2 + dy; if (isFreeGrass(x, y)) { World.obj[idx(x, y)] = { t: 'field', g: 0.3, crop: 'wheat', farm: 0 }; World.growing.add(idx(x, y)); } }`);

  for (const k of ['fire', 'quake', 'wind', 'blight']) {
    if (k === 'blight') h.run('seaSet(0); SEA().off += Math.floor(SEA().len * 0.6); Game.dz.yb = -1;');
    const before = snap(h);
    const p = J(h, `const p = dzForce('${k}'); return p ? { x: p.x, y: p.y } : null`);
    if (!p) { console.log(`  · сид ${seed}: ${k} — нет подходящего места, пропуск`); continue; }
    totals[k]++;
    const sec = waitDone(sim, 240);
    ok(sec >= 0, `сид ${seed}: ${k} не закончился за 240 с`);
    const after = snap(h);
    ok(after.hub, `сид ${seed}: ${k} уничтожил склад`);
    ok(after.ppl >= before.ppl - 1, `сид ${seed}: ${k} — жителей стало ${after.ppl} из ${before.ppl}`);
    ok(after.b >= before.b - 1, `сид ${seed}: ${k} разрушил больше одного здания: ${before.b} → ${after.b}`);
    ok(after.dmg <= 0.95 + 1e-9, `сид ${seed}: ${k} — урон здания ${after.dmg}`);
    const info = J(h, `return { log: Game.log.slice(-3).map(e => e.text), fix: Game.buildings.filter(b => b.dzFix).length, stumps: World.obj.filter(o => o && o.t === 'stump').length,
      bl: Game.dz.bl.length, fields: World.obj.filter(o => o && o.t === 'field' && !o.plan).length }`);
    console.log(`  · сид ${seed}: ${k} — ${sec} с, зданий ${before.b}→${after.b}, жителей ${before.ppl}→${after.ppl}, ремонт ${info.fix}, дорог в стройке ${before.rs}→${after.rs}`);
    if (k === 'quake') ok(info.fix > 0 || after.rs > before.rs, `сид ${seed}: землетрясение ничего не тронуло`);
    if (k === 'blight') {
      ok(info.bl > 0, `сид ${seed}: засуха не погубила ни одного поля`);
      ok(info.bl <= Math.ceil(info.fields * 0.45) + 1, `сид ${seed}: погибло слишком много полей: ${info.bl} из ${info.fields}`);
    }
    h.run(MORNING);
  }
  // само по расписанию: «часто», двое суток — хотя бы одно бедствие, деревня стоит
  if (seed === SEEDS[0]) {
    const b0 = snap(h), n0 = h.run('Game.dz.n');
    h.run('Game.dz.freq = 3; Game.dz.next = Game.time; Game.dz.last = "";');
    for (let k = 0; k < 2 * 565 / 30; k++) { L.botTurn(sim); L.stepN(sim, 600); }
    const b1 = snap(h), n1 = h.run('Game.dz.n');
    console.log(`  · сид ${seed}: двое суток «часто» — бедствий ${n1 - n0}, зданий ${b0.b}→${b1.b}, жителей ${b0.ppl}→${b1.ppl}`);
    ok(n1 > n0, `сид ${seed}: за двое суток на «часто» не случилось ни одного бедствия`);
    ok(b1.hub && b1.b >= b0.b - 2 && b1.ppl >= Math.floor(b0.ppl * 0.7), `сид ${seed}: деревня пострадала слишком сильно: ${JSON.stringify([b0.b, b1.b, b0.ppl, b1.ppl])}`);
  }
  ok(!sim.errors.length, `сид ${seed}: исключения: ${sim.errors.slice(0, 3).join(' | ')}`);
  const inv = L.checkInvariants(sim, `сид ${seed}`);
  for (const pr of inv.problems) ok(false, pr);
}
ok(totals.fire + totals.quake + totals.wind + totals.blight >= SEEDS.length * 3, 'мало бедствий удалось вызвать: ' + JSON.stringify(totals));

// ---------- колодец, ремонт, море, сейв, кооп ----------
{
  const sim = L.newSim(5), h = sim.h;
  h.run('Game.dz.freq = 0');
  for (let k = 0; k < 20; k++) { L.botTurn(sim); L.stepN(sim, 600); }
  h.run(MORNING);
  // колодец у фермы: поля рядом не сохнут
  const w = J(h, `const f = Game.buildings.find(b => b.type === 'farm') || dzHub();
    let w = null;
    for (let r = 3; r < 14 && !w; r++) for (let a = 0; a < 16 && !w; a++) { const x = Math.round(f.doorX + Math.cos(a * 0.4) * r), y = Math.round(f.doorY + Math.sin(a * 0.4) * r); if (inb(x, y) && !checkPlacement('well', x, y, 0)) w = placeBuilding('well', x, y, true, 0); }
    if (!w) return null;
    let n = 0;
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const x = w.doorX + dx, y = w.doorY + dy; if (isFreeGrass(x, y)) { World.obj[idx(x, y)] = { t: 'field', g: 0.3, crop: 'wheat', farm: 0 }; n++; } }
    // и поля вдали от колодца
    const hub = dzHub(); let far = 0;
    for (let r = 4; r < 30 && far < 20; r++) for (let a = 0; a < 24 && far < 20; a++) { const x = Math.round(hub.doorX + Math.cos(a * 0.26) * r), y = Math.round(hub.doorY + Math.sin(a * 0.26) * r);
      if (isFreeGrass(x, y) && !dzWellNear(x + 0.5, y + 0.5, [w])) { World.obj[idx(x, y)] = { t: 'field', g: 0.3, crop: 'wheat', farm: 0 }; far++; } }
    return { x: w.doorX, y: w.doorY, n, far, done: w.state };`);
  ok(w && w.n > 4, 'колодец не поставился: ' + JSON.stringify(w));
  if (w) {
    h.run('seaSet(0); SEA().off += Math.floor(SEA().len * 0.6); Game.dz.yb = -1; Game.diff = "survival";');
    const p = J(h, `const p = dzForce('blight'); return p && p.v`);
    ok(p === 'd', 'засуха не началась: ' + p);
    L.stepN(sim, 60);
    const r = J(h, `let near = 0, nearBl = 0; for (let i = 0; i < N_TILES; i++) { const o = World.obj[i]; if (!o || o.t !== 'field') continue; const x = i % MAP_W, y = (i / MAP_W) | 0; if (dzWellNear(x + 0.5, y + 0.5)) { near++; if (o.bl) nearBl++; } } return { near, nearBl, all: Game.dz.bl.length };`);
    ok(r.near > 0 && r.nearBl === 0, 'колодец не уберёг поля от засухи: ' + JSON.stringify(r));
    ok(r.all > 0, 'засуха (выживание) не погубила ни одного поля вдали от колодца');
    // поле стоит пожухшим: не растёт
    L.stepN(sim, 400);
    ok(J(h, 'return Game.dz.bl.every(i => World.obj[i].g === 0)'), 'погибшее поле продолжает расти');
    // сейв: погибшие поля, частота, знамение, отметка ремонта
    h.run(`{ Game.dz.freq = 1; const b = Game.buildings.find(b => b.type !== 'storehouse' && b.type !== 'well' && b.state === 'done'); b.dmg = 0.5; b.dzFix = 1; Game.__fixId = b.id; }`);
    h.run(`Game.dz.cur = null; Game.dz.pend = { k: 'quake', x: 10, y: 10, r: 7, at: Game.time + 30, t0: Game.time };`);
    const blBefore = h.run('Game.dz.bl.length');
    h.run('__sv = JSON.parse(JSON.stringify(serializeGame())); applySave(__sv);');
    const s = J(h, 'return { f: Game.dz.freq, bl: Game.dz.bl.length, p: Game.dz.pend && Game.dz.pend.k, at: Game.dz.pend && Math.round(Game.dz.pend.at - Game.time), fix: Game.buildings.find(b => b.id === Game.__fixId).dzFix }');
    ok(s.f === 1 && s.bl === blBefore && s.p === 'quake' && s.at >= 29 && s.at <= 31 && s.fix === 1, 'сейв бедствий не восстановился: ' + JSON.stringify(s));
    // старый сейв без dz: бедствие не сразу
    h.run('delete __sv.dz; applySave(__sv);');
    ok(h.run('Game.dz.next - Game.time') > 300 && !h.run('Game.dz.pend'), 'старый сейв: бедствие сразу после загрузки');
    // ремонт после стихии стоит материалов: без досок и камня не чинят, с ними — чинят и тратят
    h.run(`{ const b = Game.buildings.find(b => b.id === Game.__fixId); b.dmg = 0.5; b.dzFix = 1;
      Game.__mat = {}; for (const s of dzStores()) { Game.__mat[s.id] = [s.stock.timber, s.stock.stone, s.stock.trunk]; s.stock.timber = 0; s.stock.stone = 0; s.stock.trunk = 0; } }`);
    h.run('Game.__paid = 0; { const _p = dzPay; dzPay = function (c) { Game.__paid++; return _p(c); }; }');
    L.stepN(sim, 1200);
    // домовой (fairy1.js) может подлатать даром — это его дело; ремонт гномами после стихии без материалов не начинается
    ok(h.run('Game.__paid') === 0 && h.run('Game.buildings.find(b => b.id === Game.__fixId).dzFix') === 1, 'ремонт после стихии начался без материалов');
    h.run(`{ for (const s of dzStores()) { const m = Game.__mat[s.id] || [20, 20, 5]; s.stock.timber = Math.max(10, m[0]); s.stock.stone = Math.max(10, m[1]); s.stock.trunk = Math.max(4, m[2]); } }`);
    h.run('Game.buildings.find(b => b.id === Game.__fixId).dmg = 0.5');
    L.stepN(sim, 4800);
    const fixed = J(h, 'const b = Game.buildings.find(b => b.id === Game.__fixId); return [b.dmg, b.dzFix]');
    ok(fixed[0] < 0.5 && !fixed[1], 'после подвоза материалов здание не чинится: ' + JSON.stringify(fixed));
    ok(h.run('Game.__paid') >= 1, 'ремонт не потратил материалы');
  }
  // море без ocean.js: вода у края карты (биом «Побережье») распознаётся, тайфун бьёт только дома у воды, ядро цело
  const ty = J(h, `const T0 = World.terrain.slice(); MapOpt.biome = 'coast'; DZS.key = '';
    // берег у самого западного дома вне ядра: вода от края карты до него
    const hub = dzHub(), b = Game.buildings.filter(o => o.state === 'done' && !dzCore(o) && o.x - 2 < hub.x - 8 && o.x > 6).sort((p, q) => p.x - q.x)[0];
    if (!b) return { ok1: true, b: null, p: false, T0: [] };
    const sx = b.x - 2;
    const keep = new Set(); for (const o of Game.buildings) for (let y = o.y - 1; y <= o.y + o.h; y++) for (let x = o.x - 1; x <= o.x + o.w; x++) keep.add(idx(x, y));
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < sx; x++) if (!keep.has(idx(x, y))) World.terrain[idx(x, y)] = T_WATER;
    const sd = dzSeaPrep(); const ok1 = !!sd && dzSeaDistB(b, sd) > 0;
    const p = dzForce('typhoon');
    return { ok1, b: b && b.id, p: !!p, T0: Array.from(T0) };`);
  ok(ty.ok1, 'вода у края карты не распознана как море');
  if (ty.p) {
    h.run('Game.dz.quick = false');
    waitDone(sim, 120);
    const r = J(h, `const b = Game.buildings.find(b => b.id === ${ty.b}); const hub = dzHub(); return { b: b ? b.dmg : 'снесён', hub: hub.dmg || 0, core: Game.buildings.filter(o => dzCore(o) && o.dmg > 0 && o.dzFix).length,
      log: Game.log.slice(-8).map(e => e.text).find(t => /^Тайфун/.test(t) && /повреждено|разрушено|полей|дороги/.test(t)) || '' };`);
    ok(r.b === 'снесён' || r.b > 0 || !!r.log, 'тайфун не тронул дом у воды: ' + JSON.stringify(r));
    ok(r.core === 0, 'тайфун задел ядро деревни: ' + JSON.stringify(r));
  } else console.log('  · тайфун: нет места у воды, пропуск');
  h.ctx.__T0 = ty.T0; h.run('for (let i = 0; i < __T0.length; i++) World.terrain[i] = __T0[i]; MapOpt.biome = null; DZS.key = "";');
  // кооп: зеркало бедствий едет внутри сезонного
  h.run(`Game.dz.pend = { k: 'wind', x: 5, y: 6, ex: 30, ey: 30, at: Game.time + 20, t0: Game.time }; Game.dz.cur = null;`);
  const m = J(h, 'return seaMirrorOut()');
  ok(m && m.dz && m.dz.p && m.dz.p.k === 'wind', 'в зеркале сезона нет бедствий: ' + JSON.stringify(m && m.dz));
  h.run('Game.dz.pend = null'); h.ctx.__m = m; h.run('seaMirrorIn(__m)');
  ok(h.run('Game.dz.pend && Game.dz.pend.k') === 'wind', 'зеркало бедствий не принимается клиентом');
  ok(!sim.errors.length, 'исключения: ' + sim.errors.slice(0, 3).join(' | '));
}

// ---------- кооп-сервер: бедствие считает сервер ----------
{
  const sim = L.newSim(7, { coop: true }), h = sim.h;
  h.run('Game.dz.freq = 0');
  for (let k = 0; k < 10; k++) { L.botTurn(sim); L.stepN(sim, 600); }
  h.run(MORNING);
  const p = J(h, `const p = dzForce('quake'); return p && p.k`);
  ok(p === 'quake', 'кооп: землетрясение не началось');
  waitDone(sim, 30);
  ok(!sim.errors.length, 'кооп: исключения: ' + sim.errors.slice(0, 3).join(' | '));
}

console.log(`Проверка бедствий: ${fails.length ? 'провалов ' + fails.length : 'всё в порядке'}; вызвано ${JSON.stringify(totals)}`);
process.exit(fails.length ? 1 : 0);
