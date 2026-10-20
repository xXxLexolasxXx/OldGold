'use strict';
// Распределение работы: курьеры возят товары по дорогам, строители идут на стройки, рабочие — в свои здания.

function mdist(ax, ay, bx, by) { return Math.abs(ax - bx) + Math.abs(ay - by); }

function takeNearest(list, x, y) {
  let bi = -1, bd = 1e9;
  for (let i = 0; i < list.length; i++) {
    const d = mdist(list[i].x, list[i].y, x, y);
    if (d < bd) { bd = d; bi = i; }
  }
  return bi < 0 ? null : list.splice(bi, 1)[0];
}

function assignDelivery(u, from, to, g, n = 1) {
  from.reserved[g] += n;
  to.incoming[g] += n;
  u.idleFlag = false; u.idleStreak = 0;
  u.action = null; u.anim = null;
  // трудяга помнит, что и куда несёт — по этому пересчитывается «в пути»
  const gen = (function* () { try { yield* deliverGen(u, from, to, g, n); } finally { u.dlv = null; } })();
  u.dlv = { from, to, g, n, gen };
  u.proc = gen;
}

// Самопроверка: «в пути» у каждого получателя = сумма того, что реально несут к нему.
// Если какая-то доставка оборвалась и не вычла своё, здание не застрянет в ожидании.
// Так же и бронь в зданиях: = ещё не забранные доставки + обеды в пути. Брошенное задание
// (гном погиб, его дом снесли, работу перехватили) больше не держит товар «занятым» навсегда.
function auditIncoming() {
  const holders = [...Game.buildings, ...Game.roadSites.values(), ...Game.piles.values()];
  for (const h of holders) if (h.incoming) for (const g of GOOD_KEYS) h.incoming[g] = 0;
  const resv = new Map();
  const book = (h, g, n) => { if (!h || h.removed || !h.reserved) return; let m = resv.get(h); if (!m) resv.set(h, m = {}); m[g] = (m[g] || 0) + n; };
  const live = (u, gen) => u.proc === gen || (u.brk && u.brk.saved && u.brk.saved.proc === gen);
  for (const u of Game.units) {
    const e = u.eat;
    if (e) { if (live(u, e.gen) && !u.dead) book(e.inn, e.food, 1); else u.eat = null; }
    const sr = u.subRes;   // субботник: мусор из кучки
    if (sr) { if (live(u, sr.gen) && !u.dead) book(sr.pile, 'trash', 1); else u.subRes = null; }
    const d = u.dlv;
    if (!d) continue;
    if (!live(u, d.gen)) { u.dlv = null; continue; }
    if (d.to && !d.to.removed && d.to.incoming) d.to.incoming[d.g] += d.n;
    if (!d.picked) book(d.from, d.g, d.n);
  }
  // звери тоже берут из кучек: на субботнике носят мусор, питомцы подбирают находки
  for (const a of Game.animals) {
    if (a.dead) continue;
    if (a.subSt === 'toPile' && a.subPile) book(a.subPile, 'trash', 1);
    if (a.err && a.err.st === 'toPile' && a.err.pile) book(a.err.pile, a.err.g, 1);
  }
  for (const h of [...Game.buildings, ...Game.piles.values()]) {
    const m = resv.get(h);
    for (const g of GOOD_KEYS) h.reserved[g] = m ? m[g] || 0 : 0;
    if (h.isPile && !m) cleanupPile(h);   // забытая бронь держала опустевшую кучку на земле
  }
}

// Тяжёлое не унести с травмой руки
const HEAVY = new Set(['trunk', 'stone', 'timber', 'pig', 'goldore', 'leatherArmor']);

// трудяга с выслугой носит 2 и 3 предмета (уровни 2 и 3)
function carryCap(u) { return u.type === 'serf' ? unitLevel(u) : (CARRY_CAP[u.type] || 1); }
function canCarry(u, g) { return !(u.injury === 'arm' && HEAVY.has(g)); }

// Подобрать перевозчика под партию: большой партии — телегу, средней — козу, иначе курьера.
function pickCarrier(idle, x, y, g, amount) {
  const ok = idle.filter(u => canCarry(u, g));
  if (!ok.length) return null;
  const pref = amount >= 3 ? ['carter', 'goat', 'serf'] : amount >= 2 ? ['goat', 'serf', 'carter'] : ['serf', 'goat', 'carter'];
  if (Game.prio) pref.sort((a, b) => prioLv('jobs', prioJobKey(b)) - prioLv('jobs', prioJobKey(a)));   // «Высокий» перевозчик — первым (порядок при равных не меняется)
  for (const t of pref) {
    let list = ok.filter(u => u.type === t);
    if (!list.length) continue;
    // на большую партию — сперва трудяги с выслугой, которые унесут больше за раз
    if (t === 'serf' && amount >= 2) { const big = list.filter(u => carryCap(u) >= Math.min(3, amount)); if (big.length) list = big; }
    const u = takeNearest(list, x, y);
    idle.splice(idle.indexOf(u), 1);
    return u;
  }
  return null;
}

// Курьеры ездят только по дорогам: всё распределяется внутри одной дорожной сети.
// вне очереди — только то, что идёт на еду: в мельницу, пекарню, свинарник, бойню, трактир
const isFoodProducer = b => b.type === 'farm' || FOOD_DEST.has(b.type);
const FOOD_DEST = new Set(['mill', 'bakery', 'swine', 'butchery', 'inn']);
const FOOD_CHAIN = new Set(['wheat', 'flour', 'bread', 'sausage', 'pig', 'hay', 'chicken']);

function dispatchSerfs() {
  updateRoadComps();
  const idleAll = Game.units.filter(u => u.isCourier && u.idleFlag && !u.inside && !u.brk && prioJobLv(u) !== 0);
  if (!idleAll.length) return;
  // свободные перевозчики по сетям
  const idleBy = new Map();
  for (const u of idleAll) {
    const c = compNear(Math.floor(u.x), Math.floor(u.y));
    if (!c) continue;
    if (!idleBy.has(c)) idleBy.set(c, []);
    idleBy.get(c).push(u);
  }
  if (!idleBy.size) return;
  const storeComp = (x, y) => { const st = nearestStore(x, y); return st ? compAt(st.doorX, st.doorY) : 0; };
  // сети, где есть склад: только там есть откуда брать камень и кому нести
  const withStore = new Set(Game.buildings.filter(b => b.isStore()).map(b => compAt(b.doorX, b.doorY)));
  const servedComp = (x, y) => { const c = compNear(x, y); return c && withStore.has(c) ? c : storeComp(x, y); };
  const depots = [...Game.buildings, ...Game.piles.values()];
  const compOf = new Map();
  for (const b of Game.buildings) compOf.set(b, compAt(b.doorX, b.doorY));
  // кучки и стройки дорог могут лежать в стороне или примыкать к оторванному куску
  // дороги без склада — тогда их обслуживает сеть ближайшего склада (носят по бездорожью)
  for (const p of Game.piles.values()) compOf.set(p, servedComp(p.x, p.y));
  for (const s of Game.roadSites.values()) compOf.set(s, servedComp(s.x, s.y));

  // пищевой цех, у которого склад почти полон, разгружаем раньше всего — иначе он встанет
  const nearlyFull = b => Object.entries(b.def.outputs).some(([g, cap]) => b.offer(g) >= cap * 0.7);
  let nfDone = false;
  const collectNearlyFull = () => { if (nfDone) return; nfDone = true; collectOutputs(b => !b.isPile && b.state === 'done' && isFoodProducer(b) && !!b.def.outputs && nearlyFull(b)); };

  const reqs = [];
  for (const [d, comp] of compOf) {
    if (!comp || !idleBy.has(comp)) continue;
    if (prioBlocked(d)) continue;      // адресат выключен во вкладке «Приоритеты»
    for (const g of GOOD_KEYS) {
      const n = d.demand(g);
      // еда — в первую очередь: голодная деревня встаёт целиком
      // золото в школу, где ждут ученики, — тоже вне очереди: иначе курьеры заняты едой, золото лежит на складе,
      // учёба стоит, и деревня не восполняет потери (замер tools/soak/deficit.js: школа стояла ~95 % игры)
      const school = g === 'gold' && d.type === 'school' && d.state === 'done' && (d.queue.length || d.training);
      if (n > 0) reqs.push({ d, g, n, comp, pri: (d.upg ? 0 : school ? -1 : FOOD_CHAIN.has(g) && FOOD_DEST.has(d.type) && d.state === 'done' ? (d.type === 'inn' ? -2 : -1) : d.isRoad ? 2 : (d.state !== 'done' ? 0 : 1)) - prioScore(d), r: Math.random() });
    }
  }
  reqs.sort((a, b) => a.pri - b.pri || a.r - b.r);

  let foodOut = false;
  for (const r of reqs) {
    // еда в трактир — самое первое, иначе ферма с полным амбаром забирает всех курьеров, а деревня голодает
    if (r.pri >= 0) collectNearlyFull();          // заявки трактира и пищевых цехов — раньше разгрузки полных ферм
    // после еды для трактира и цехов — урожай и еду с ферм, мельницы, пекарни, бойни,
    // свинарника: иначе склад здания забивается и работа встаёт
    if (!foodOut && r.pri >= 0) { foodOut = true; collectOutputs(b => !b.isPile && isFoodProducer(b)); }
    const idle = idleBy.get(r.comp);
    let need = r.n;
    while (need > 0 && idle.length) {
      let src = null, sd = 1e9;
      for (const o of depots) {
        if ((o === r.d && !(r.d.upg && r.d.isStore())) || compOf.get(o) !== r.comp || o.offer(r.g) <= 0) continue;
        // сперва забираем у мастерской — иначе она встанет с полным складом, а склад опустеет
        const dd = mdist(o.doorX, o.doorY, r.d.doorX, r.d.doorY) + (o.isPile || !o.isStore() ? 0 : 25);
        if (dd < sd) { sd = dd; src = o; }
      }
      if (!src) break;
      const avail = src.offer(r.g);
      const u = pickCarrier(idle, src.doorX, src.doorY, r.g, Math.min(need, avail));
      if (!u) break;
      const n = Math.min(need, avail, carryCap(u));
      assignDelivery(u, src, r.d, r.g, n);
      need -= n;
    }
  }

  collectNearlyFull();
  if (!foodOut) collectOutputs(b => !b.isPile && isFoodProducer(b));
  // рассыпанное по земле (в том числе зерно и хлеб) — раньше, чем продукция неспешных мастерских
  collectOutputs(b => b.isPile);
  collectOutputs(b => !b.isPile && !isFoodProducer(b));

  // Готовую продукцию и рассыпанное — на ближайший склад той же сети
  function collectOutputs(pred) {
    for (const b of depots) {
      if (!pred(b)) continue;
      const isP = b.isPile;
      if (!isP && (b.state !== 'done' || b.isStore() || !b.def.outputs)) continue;
      const comp = compOf.get(b), idle = idleBy.get(comp);
      if (!idle || !idle.length) continue;
      const goods = isP ? GOOD_KEYS : Object.keys(b.def.outputs);
      let taken = 0;                                           // на одно здание — не больше 3 перевозчиков за раз (диспетчер идёт каждые 0.4 с)
      for (const g of goods) {
        let left = b.offer(g);
        while (left > 0 && idle.length && taken < 3) {
          const st = nearestStore(b.doorX, b.doorY, g, comp);
          if (!st) break;
          const u = pickCarrier(idle, b.doorX, b.doorY, g, left);
          if (!u) break;
          const n = Math.min(left, carryCap(u));
          assignDelivery(u, b, st, g, n);
          left -= n; taken++;
        }
      }
    }
  }
}

function dispatchBuilders() {
  // строитель, записанный за стройкой, мог уйти в напарники героя, погибнуть или взяться за другое —
  // тогда стройка навсегда «занята» и её больше никто не берёт
  const gone = u => u.dead || u.teamOf || !Game.unitMap.has(u.id);
  for (const s of Game.roadSites.values()) if (s.builder && (gone(s.builder) || s.builder.job !== s)) s.builder = null;
  for (const b of Game.buildings) {
    if (b.builder && b.state !== 'done' && (gone(b.builder) || b.builder.job !== b)) b.builder = null;
    if (b.upg && b.upg.builder && (gone(b.upg.builder) || b.upg.builder.job !== b)) b.upg.builder = null;
  }
  // на перерыве (перекур, сон, испуг) не трогаем: иначе proc обнуляется, а brk остаётся — гном до конца стройки
  // «непрерываем» (не ест, не пугается, не ходит на праздник), клетка перекура занята, а после стройки он
  // продолжает прерванное перекуром дело, как будто ничего не было
  const idle = Game.units.filter(u => u.type === 'builder' && u.idleFlag && !u.inside && !u.teamOf && !u.dead && !u.brk && prioJobLv(u) !== 0);
  dispatchRepairs(idle);
  if (!idle.length) return;
  const sites = [
    // стройка без материала и без доставки в пути подождёт: работяга без дела там только стоит
    ...Game.buildings.filter(b => b.state !== 'done' && !b.builder && !b.selfBuild && !b.hold &&
      (b.state === 'site' || ['trunk', 'timber', 'stone'].some(k => b.stock[k] > 0 || b.incoming[k] > 0 ||
        (b.demand(k) > 0 && (nearestStore(b.doorX, b.doorY, k, compAt(b.doorX, b.doorY))?.offer(k) > 0))))),   // опытный работяга донесёт сам
    ...Game.buildings.filter(b => b.upg && !b.upg.builder),
    // дорогу можно копать сразу, а мостить — когда камень на месте или в пути
    ...[...Game.roadSites.values()].filter(s => !s.builder && (s.dug < 1 || s.stock.stone + s.incoming.stone > 0)),
  ].filter(s => !prioBlocked(s));
  if (Game.prio) sites.sort((a, b) => prioScore(b) - prioScore(a));      // «Высокий» приоритет — первым в очереди на работяг
  for (const s of sites) {
    const u = takeNearest(idle, s.doorX, s.doorY);
    if (!u) return;
    if (s.upg && s.state === 'done') s.upg.builder = u; else s.builder = u;
    u.job = s;
    u.idleFlag = false; u.idleStreak = 0;
    u.proc = null; u.action = null; u.anim = null;
  }
  // оставшиеся без дела работяги вскапывают заложенные поля (бесплатно)
  if (idle.length && Game.fieldPlans && Game.fieldPlans.size && prioLv('tasks', 'food') !== 0) {
    for (const i of [...Game.fieldPlans]) {
      const o = World.obj[i];
      if (!o || o.t !== 'field' || !o.plan) { Game.fieldPlans.delete(i); continue; }
      if (o.res) continue;
      const x = i % MAP_W, y = (i / MAP_W) | 0;
      const u = takeNearest(idle, x, y);
      if (!u) break;
      o.res = true;
      u.fieldJob = i;
      u.idleFlag = false; u.idleStreak = 0;
      u.proc = null; u.action = null; u.anim = null;
    }
  }
  // ещё свободные — помогают фермерам убирать созревшие поля
  if (idle.length) {
    for (const b of Game.buildings) {
      if (b.state !== 'done' || !idle.length || !b.def.crops || prioOff(b)) continue;
      for (const f of farmFields(b)) {
        if (f.o.g < 1 || f.o.res || outFull(b, f.o.crop)) continue;

        const u = takeNearest(idle, f.x, f.y);
        if (!u) break;
        f.o.res = true;
        u.helpField = idx(f.x, f.y);
        u.idleFlag = false; u.idleStreak = 0;
        u.proc = null; u.action = null; u.anim = null;
      }
    }
  }
}

// Повреждённое здание чинит любой свободный гном (не только работяга): сначала свободные работяги,
// потом все, кто остался без дела (без дома-работы, не курьер, не герой и не напарник).
function dispatchRepairs(idleBuilders) {
  let todo = null;
  for (const b of Game.buildings) {
    if (b.repairer && (b.repairer.dead || (b.repairer.repairJob !== b && !(b.repairer.proc && b.repairer.repairBusy === b)))) b.repairer = null;   // чинивший погиб или передумал
    if (b.dmg > 0.05 && !b.repairer && !b.removed) (todo || (todo = [])).push(b);
  }
  if (!todo) return;
  const free = Game.units.filter(u => u.idleFlag && !u.inside && !u.dead && !u.brk && u.type !== 'builder' && !u.isCourier &&
    u.type !== 'hero' && !u.teamOf && !UNIT_TYPES[u.type].animal && !u.home && u.type !== 'carter');
  for (const b of todo) {
    const u = takeNearest(idleBuilders, b.doorX, b.doorY) || takeNearest(free, b.doorX, b.doorY);
    if (!u) break;
    b.repairer = u; u.repairJob = b;
    u.idleFlag = false; u.idleStreak = 0;
    u.proc = null; u.action = null; u.anim = null;
  }
}

function dispatchWorkers() {
  const bs = Game.prio ? [...Game.buildings].sort((a, b) => prioScore(b) - prioScore(a)) : Game.buildings;   // «Высокий» цех получает свободного гнома первым
  for (const b of bs) {
    if (b.state !== 'done' || !b.def.worker || (b.worker && !b.worker.dead && b.worker.home === b)) continue;
    if (prioOff(b)) continue;      // выключен во вкладке «Приоритеты» — нового рабочего не ставим
    b.worker = null;
    // у здания «потерялась» запись о работнике, а сам гном за ним числится — возвращаем запись, а не ищем замену
    const mine = Game.units.find(u => u.home === b && !u.dead && !u.teamOf && u.type !== 'hero');
    if (mine) { b.worker = mine; continue; }
    const idle = Game.units.filter(u => u.type === b.def.worker && !u.home && !u.inside && !u.teamOf && !u.brk);   // не с перерыва (см. dispatchBuilders)
    const u = takeNearest(idle, b.doorX, b.doorY);
    if (!u) continue;
    u.home = b;
    b.worker = u;
    u.idleFlag = false; u.idleStreak = 0;
    u.proc = null; u.action = null; u.anim = null;
  }
}

// Бронь объектов на карте (o.res у деревьев, глыб, полей, брёвен, урн; ROCKMINE.res у скалы) снимает тот, кто её
// поставил, — но не если он погиб, его дом снесли или диспетчер дал ему другое дело (proc просто обнуляют).
// Такая бронь висела вечно: лесоруб обходил «занятое» дерево, каменотёс — глыбу. Раз в ~25 с проверяем:
// у брони нет претендента (никто не стоит рядом, не идёт туда, не держит её в приказе) три проверки подряд — снимаем.
const resStale = new Map();   // индекс клетки -> сколько проверок подряд без претендента
function auditReserved() {
  const claim = new Set();
  const mark = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inb(x + dx, y + dy)) claim.add(idx(x + dx, y + dy)); };
  for (const u of Game.units) {
    if (u.dead) continue;
    mark(Math.floor(u.x), Math.floor(u.y));
    for (const a of [u.action, u.brk && u.brk.saved && u.brk.saved.action]) if (a && a.walk) mark(a.walk[0], a.walk[1]);
    if (u.cmd && u.cmd.i != null) claim.add(u.cmd.i);
    if (u.fieldJob >= 0) claim.add(u.fieldJob);
    if (u.helpField >= 0) claim.add(u.helpField);
  }
  const stale = i => { if (claim.has(i)) { resStale.delete(i); return false; } const n = (resStale.get(i) || 0) + 1; if (n >= 3) { resStale.delete(i); return true; } resStale.set(i, n); return false; };
  for (const i of [...resStale.keys()]) { const o = World.obj[i]; if (!(o && o.res) && !ROCKMINE.res.has(i)) resStale.delete(i); }
  for (let i = 0; i < N_TILES; i++) {
    const o = World.obj[i];
    if (!o || !o.res || o.awake) continue;          // awake — ожившее дерево ночи, его бронь снимает nightTick
    if (stale(i)) o.res = false;
  }
  for (const i of [...ROCKMINE.res]) if (stale(i)) ROCKMINE.res.delete(i);
}

let auditT = 0, resT = 0;
function dispatchAll() {
  if ((auditT += 1) >= 8) { auditT = 0; auditIncoming(); if ((resT += 1) >= 8) { resT = 0; auditReserved(); } }      // раз в ~3 с; бронь объектов — раз в ~25 с
  dispatchWorkers();
  dispatchBuilders();
  dispatchSerfs();
}
