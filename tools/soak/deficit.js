'use strict';
// Что заканчивается и когда: прогон «разумного» хозяйства (без хаоса soak-бота) на нескольких сидах по нескольку игровых лет.
//   node tools/soak/deficit.js --seed 1 --years 3        (один сид; несколько — запускайте параллельно)
// Раз в игровую минуту снимает: запасы на складах и в зданиях, кто стоит «нет товара» (need:X) — при пустых складах это дефицит,
// при полных — затор доставки; голодных и упавших, школу без золота, сено к зиме и падёж. Итог — tools/soak/deficit-<seed>.json
// и строка-сводка; таблицу по сидам собирает --sum (node tools/soak/deficit.js --sum 1,2,3,4,5).
const path = require('path');
const fs = require('fs');
const L = require(path.join(__dirname, '..', '..', 'tests', 'lib', 'sim'));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };

// Порядок стройки как у обычного игрока: дерево и камень → хлеб → мясо → пиво → золото для школы → железо → гильдия
const PLAN = ['woodcutter', 'sawmill', 'quarry', 'farm', 'woodcutter', 'mill', 'bakery', 'farm', 'swine', 'butchery', 'goldmine', 'metallurgist',
  'hopfarm', 'brewery', 'quarry', 'woodcutter', 'farm', 'storehouse', 'swine', 'tannery', 'ironmine', 'smeltery', 'weaponsmith', 'farm',
  'sawmill', 'bakery', 'mill', 'woodcutter', 'guild_warrior', 'armory', 'hopfarm', 'butchery'];
// что считаем: «еда в трактире» — отдельная строка
const TRACK = ['wheat', 'flour', 'bread', 'beer', 'hops', 'trunk', 'timber', 'stone', 'ironore', 'iron', 'goldore', 'gold', 'hay', 'pig', 'sausage', 'hide', 'leather', 'ash'];

// Внутри песочницы: доделки бота (поля, учёба) и снимок
const BOT2 = `(function () {
  // поля вокруг ферм — их закладывает игрок
  for (const b of Game.buildings) {
    if (b.state !== 'done' || !b.def.crops) continue;
    const crop = b.def.crops[0];
    let n = 0; for (let y = b.y - FARM_R; y <= b.doorY + FARM_R; y++) for (let x = b.x - FARM_R; x < b.x + b.w + FARM_R; x++) { if (!inb(x, y)) continue; const o = World.obj[idx(x, y)]; if (o && o.t === 'field' && (o.farm === b.id || o.plan)) n++; }
    for (let r = 1; r <= FARM_R && n < 8; r++) for (let y = b.y - r; y <= b.y + b.h + r && n < 8; y++) for (let x = b.x - r; x < b.x + b.w + r && n < 8; x++) {
      if (!inb(x, y) || World.road[idx(x, y)] || y === b.doorY + 1) continue;
      if (Game.buildings.some(o => x >= o.x - 1 && x <= o.x + o.w && y >= o.y - 1 && y <= o.y + o.h + 1)) continue;   // не душим двери и проходы
      if (!planField(x, y, crop)) n++;
    }
  }
  // учёба: работники в пустые здания, трудяги и работяги по размеру деревни
  const school = Game.buildings.find(b => b.type === 'school' && b.state === 'done');
  if (!school) return;
  const need = new Map();
  for (const b of Game.buildings) if (b.def.worker && !(b.worker && !b.worker.dead && b.worker.home === b)) need.set(b.def.worker, (need.get(b.def.worker) || 0) + 1);
  const free = {}; for (const u of Game.units) if (!u.home && !u.dead) free[u.type] = (free[u.type] || 0) + 1;
  const q = {}; for (const s of Game.buildings) { for (const t of s.queue || []) q[t] = (q[t] || 0) + 1; if (s.training) q[s.training.type] = (q[s.training.type] || 0) + 1; }
  const push = t => { if (school.queue.length < 8) { school.queue.push(t); q[t] = (q[t] || 0) + 1; } };
  for (const [t, n] of need) if (UNIT_TYPES[t] && !UNIT_TYPES[t].noTrain && (free[t] || 0) + (q[t] || 0) < n) push(t);
  const serfs = Game.units.filter(u => u.type === 'serf').length, builders = Game.units.filter(u => u.type === 'builder').length;
  if (serfs + (q.serf || 0) < 5 + Game.buildings.length * 0.5) push('serf');
  if (builders + (q.builder || 0) < 2 + Game.buildings.length * 0.12) push('builder');
})()`;

const SNAP = `(function () {
  const T = ${JSON.stringify(TRACK)};
  const st = {}, all = {}, need = {}, lag = {};
  for (const g of T) { st[g] = 0; all[g] = 0; }
  for (const b of Game.buildings) {
    if (b.state !== 'done') continue;
    for (const g of T) { all[g] += b.stock[g] || 0; if (b.isStore()) st[g] += Math.max(0, (b.stock[g] || 0) - (b.reserved[g] || 0)); }
  }
  for (const p of Game.piles.values()) for (const g of T) { all[g] += p.stock[g] || 0; st[g] += Math.max(0, (p.stock[g] || 0) - (p.reserved[g] || 0)); }
  const prob = {};
  for (const b of Game.buildings) {
    if (b.state !== 'done') continue;
    const p = b.problem();
    if (p) prob[p] = (prob[p] || 0) + 1;
    if (p && p.startsWith('need:')) { const g = p.slice(5); (st[g] > 0 ? lag : need)[g] = ((st[g] > 0 ? lag : need)[g] || 0) + 1; }
  }
  const ppl = Game.units.filter(u => !u.dead && isPerson(u));
  const inn = Game.buildings.filter(b => b.type === 'inn' && b.state === 'done');
  const food = ['bread', 'sausage', 'chicken', 'croissant', 'steak'];
  const innFood = inn.reduce((a, b) => a + food.reduce((s, g) => s + (b.stock[g] || 0), 0), 0);
  const innBeer = inn.reduce((a, b) => a + (b.stock.beer || 0), 0);
  const storeFood = food.reduce((s, g) => s + Game.buildings.filter(b => b.isStore()).reduce((a, b) => a + (b.stock[g] || 0), 0), 0);
  const school = Game.buildings.filter(b => b.type === 'school' && b.state === 'done');
  const schoolGold = school.some(b => (b.queue.length || b.training) && b.stock.gold < 1 && !b.training);
  const H = seaHayInfo();
  return JSON.stringify({ t: Math.round(Game.time), day: seaDay(), sea: seaIdx(), st, all, need, lag, prob,
    ppl: ppl.length, hungry: ppl.filter(u => !u.noFood && u.food < HUNGRY).length, starving: ppl.filter(u => !u.noFood && u.food <= 0).length,
    innFood, innBeer, storeFood, schoolGold, schoolQ: school.reduce((a, b) => a + b.queue.length, 0),
    hayNeed: H.need, hayHave: H.have, pigs: Game.buildings.reduce((a, b) => a + seaHerd(b), 0), pigsLost: SEA().pigsLost,
    faint: Game.log.filter(l => /упал от голода/.test(l.text || l.msg || '')).length, bld: Game.buildings.length,
    produced: Object.fromEntries(T.map(g => [g, Math.round(Game.produced[g] || 0)])) });
})()`;

function runSeed(seed, years) {
  const sim = L.newSim(seed);
  const len = sim.h.run('SEA().len');
  const target = len * 4 * years;
  const samples = [];
  const t0 = Date.now();
  let k = 0;
  while (true) {
    L.stepN(sim, 200);                         // 10 игровых секунд
    if (++k % 6) continue;                     // раз в игровую минуту
    L.botTurn(sim, PLAN);
    sim.h.run(BOT2);
    const s = JSON.parse(sim.h.run(SNAP));
    samples.push(s);
    if (k % 360 === 0) console.error(`seed ${seed}: день ${s.day}/${target}, жителей ${s.ppl}, зданий ${s.bld}, ${((Date.now() - t0) / 1000) | 0} с`);
    if (s.day >= target) break;
  }
  return { seed, years, len, wall: ((Date.now() - t0) / 1000) | 0, errors: sim.errors.slice(0, 10), samples };
}

// Сводка по одному прогону: по каждому товару — минут дефицита (потребитель ждёт, на складах пусто), минут затора (на складе есть, а не довезли),
// первый раз (сутки), по сезонам; голод, школа без золота, зимний корм
function summarize(r) {
  const S = r.samples, out = { seed: r.seed, goods: {}, food: {}, school: {}, winter: [] };
  const SEA = ['лето', 'осень', 'зима', 'весна'];
  for (const s of S) {
    for (const [g, n] of Object.entries(s.need)) { const o = out.goods[g] || (out.goods[g] = { def: 0, lag: 0, first: null, bySea: [0, 0, 0, 0], maxBlocked: 0 }); o.def++; o.bySea[s.sea]++; o.maxBlocked = Math.max(o.maxBlocked, n); if (o.first == null) o.first = s.day; }
    for (const [g] of Object.entries(s.lag)) { const o = out.goods[g] || (out.goods[g] = { def: 0, lag: 0, first: null, bySea: [0, 0, 0, 0], maxBlocked: 0 }); o.lag++; }
    if (s.innFood === 0 && s.hungry > 0) { out.food.noFood = (out.food.noFood || 0) + 1; out.food.first = out.food.first == null ? s.day : out.food.first; out.food.bySea = out.food.bySea || [0, 0, 0, 0]; out.food.bySea[s.sea]++; }
    if (s.innFood === 0 && s.storeFood > 0 && s.hungry > 0) out.food.lag = (out.food.lag || 0) + 1;
    if (s.schoolGold) { out.school.noGold = (out.school.noGold || 0) + 1; if (out.school.first == null) out.school.first = s.day; }
    out.food.maxHungry = Math.max(out.food.maxHungry || 0, s.hungry);
    out.food.maxStarving = Math.max(out.food.maxStarving || 0, s.starving);
  }
  // зимы: сено к началу, падёж, люди в начале и в конце
  let w = null;
  for (const s of S) {
    if (s.sea === 2 && !w) w = { y: Math.floor(s.day / (r.len * 4)) + 1, hayNeed: s.hayNeed, hayHave: s.hayHave, pigs0: s.pigs, lost0: s.pigsLost, ppl0: s.ppl, faint0: s.faint, hungryMax: 0, noFood: 0 };
    if (w && s.sea === 2) { w.hungryMax = Math.max(w.hungryMax, s.hungry); if (s.innFood === 0 && s.hungry) w.noFood++; }
    if (w && s.sea !== 2) { w.pigsLost = s.pigsLost - w.lost0; w.ppl1 = s.ppl; w.faints = s.faint - w.faint0; delete w.lost0; delete w.faint0; out.winter.push(w); w = null; }
  }
  const last = S[S.length - 1];
  out.end = { day: last.day, ppl: last.ppl, bld: last.bld, produced: last.produced, st: last.st };
  out.minutes = S.length;
  out.seaNames = SEA;
  return out;
}

function table(sums) {
  const goods = new Set(); for (const s of sums) for (const g in s.goods) goods.add(g);
  const lines = ['| товар | дефицит, мин (сред. по сидам) | затор доставки, мин | впервые, сутки | лето/осень/зима/весна |', '|---|---|---|---|---|'];
  const avg = f => (sums.reduce((a, s) => a + f(s), 0) / sums.length);
  for (const g of [...goods].sort((a, b) => avg(s => (s.goods[b] || {}).def || 0) - avg(s => (s.goods[a] || {}).def || 0))) {
    const firsts = sums.map(s => s.goods[g] && s.goods[g].first).filter(x => x != null);
    const bs = [0, 1, 2, 3].map(i => Math.round(avg(s => s.goods[g] ? s.goods[g].bySea[i] : 0)));
    lines.push(`| ${g} | ${Math.round(avg(s => (s.goods[g] || {}).def || 0))} | ${Math.round(avg(s => (s.goods[g] || {}).lag || 0))} | ${firsts.length ? Math.min(...firsts) + '–' + Math.max(...firsts) : '—'} | ${bs.join(' / ')} |`);
  }
  lines.push(`| еда в трактире (голодные есть, трактир пуст) | ${Math.round(avg(s => s.food.noFood || 0))} | ${Math.round(avg(s => s.food.lag || 0))} | ${sums.map(s => s.food.first).filter(x => x != null).join(', ') || '—'} | ${[0, 1, 2, 3].map(i => Math.round(avg(s => s.food.bySea ? s.food.bySea[i] : 0))).join(' / ')} |`);
  lines.push(`| золото для школы (очередь стоит) | ${Math.round(avg(s => s.school.noGold || 0))} | — | ${sums.map(s => s.school.first).filter(x => x != null).join(', ') || '—'} | — |`);
  return lines.join('\n');
}

if (arg('sum')) {
  const sums = arg('sum').split(',').map(s => summarize(JSON.parse(fs.readFileSync(path.join(__dirname, `deficit-${s}.json`), 'utf8'))));
  console.log(table(sums));
  for (const s of sums) console.log(`\nseed ${s.seed}: конец — сутки ${s.end.day}, жителей ${s.end.ppl}, зданий ${s.end.bld}; зимы: ` + s.winter.map(w => `г${w.y}: сено ${w.hayHave}/${w.hayNeed}, свиней ${w.pigs0}, пало ${w.pigsLost}, жителей ${w.ppl0}→${w.ppl1}, голодных max ${w.hungryMax}, трактир пуст ${w.noFood} мин, обмороков ${w.faints}`).join('; '));
} else {
  const seed = +arg('seed', 1), years = +arg('years', 3);
  const r = runSeed(seed, years);
  fs.writeFileSync(path.join(__dirname, `deficit-${seed}.json`), JSON.stringify(r));
  const s = summarize(r);
  console.log(`seed ${seed}: ${r.wall} с, ошибок ${r.errors.length}`); for (const e of r.errors) console.log('  ✗ ' + e);
  console.log(table([s]));
}
