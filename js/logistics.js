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
function auditIncoming() {
  const holders = [...Game.buildings, ...Game.roadSites.values(), ...Game.piles.values()];
  for (const h of holders) if (h.incoming) for (const g of GOOD_KEYS) h.incoming[g] = 0;
  for (const u of Game.units) {
    const d = u.dlv;
    if (!d) continue;
    const alive = u.proc === d.gen || (u.brk && u.brk.saved && u.brk.saved.proc === d.gen);
    if (!alive) { u.dlv = null; continue; }
    if (d.to && !d.to.removed && d.to.incoming) d.to.incoming[d.g] += d.n;
  }
}

// Тяжёлое не унести с травмой руки
const HEAVY = new Set(['trunk', 'stone', 'timber', 'pig', 'goldore', 'leatherArmor']);

function carryCap(u) { return CARRY_CAP[u.type] || 1; }
function canCarry(u, g) { return !(u.injury === 'arm' && HEAVY.has(g)); }

// Подобрать перевозчика под партию: большой партии — телегу, средней — козу, иначе курьера.
function pickCarrier(idle, x, y, g, amount) {
  const ok = idle.filter(u => canCarry(u, g));
  if (!ok.length) return null;
  const pref = amount >= 3 ? ['carter', 'goat', 'serf'] : amount >= 2 ? ['goat', 'serf', 'carter'] : ['serf', 'goat', 'carter'];
  for (const t of pref) {
    const list = ok.filter(u => u.type === t);
    if (!list.length) continue;
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
  const idleAll = Game.units.filter(u => u.isCourier && u.idleFlag && !u.inside && !u.brk);
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
  collectOutputs(b => !b.isPile && b.state === 'done' && isFoodProducer(b) && !!b.def.outputs && nearlyFull(b));

  const reqs = [];
  for (const [d, comp] of compOf) {
    if (!comp || !idleBy.has(comp)) continue;
    for (const g of GOOD_KEYS) {
      const n = d.demand(g);
      // еда — в первую очередь: голодная деревня встаёт целиком
      if (n > 0) reqs.push({ d, g, n, comp, pri: d.upg ? 0 : FOOD_CHAIN.has(g) && FOOD_DEST.has(d.type) && d.state === 'done' ? (d.type === 'inn' ? -2 : -1) : d.isRoad ? 2 : (d.state !== 'done' ? 0 : 1), r: Math.random() });
    }
  }
  reqs.sort((a, b) => a.pri - b.pri || a.r - b.r);

  let foodOut = false;
  for (const r of reqs) {
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

  if (!foodOut) collectOutputs(b => !b.isPile && isFoodProducer(b));
  // остальную продукцию и рассыпанное — после заявок
  collectOutputs(b => b.isPile || !isFoodProducer(b));

  // Готовую продукцию и рассыпанное — на ближайший склад той же сети
  function collectOutputs(pred) {
    for (const b of depots) {
      if (!pred(b)) continue;
      const isP = b.isPile;
      if (!isP && (b.state !== 'done' || b.isStore() || !b.def.outputs)) continue;
      const comp = compOf.get(b), idle = idleBy.get(comp);
      if (!idle || !idle.length) continue;
      const goods = isP ? GOOD_KEYS : Object.keys(b.def.outputs);
      for (const g of goods) {
        let left = b.offer(g);
        while (left > 0 && idle.length) {
          const st = nearestStore(b.doorX, b.doorY, g, comp);
          if (!st) break;
          const u = pickCarrier(idle, b.doorX, b.doorY, g, left);
          if (!u) break;
          const n = Math.min(left, carryCap(u));
          assignDelivery(u, b, st, g, n);
          left -= n;
        }
      }
    }
  }
}

function dispatchBuilders() {
  const idle = Game.units.filter(u => u.type === 'builder' && u.idleFlag && !u.inside);
  if (!idle.length) return;
  const sites = [
    ...Game.buildings.filter(b => b.state !== 'done' && !b.builder && !b.selfBuild && !b.hold),
    ...Game.buildings.filter(b => b.upg && !b.upg.builder),
    // дорогу можно копать сразу, а мостить — когда камень на месте или в пути
    ...[...Game.roadSites.values()].filter(s => !s.builder && (s.dug < 1 || s.stock.stone + s.incoming.stone > 0)),
  ];
  for (const s of sites) {
    const u = takeNearest(idle, s.doorX, s.doorY);
    if (!u) return;
    if (s.upg && s.state === 'done') s.upg.builder = u; else s.builder = u;
    u.job = s;
    u.idleFlag = false; u.idleStreak = 0;
    u.proc = null; u.action = null; u.anim = null;
  }
  // повреждённые нечистью здания чинят свободные работяги
  if (idle.length) {
    for (const b of Game.buildings) {
      if (!(b.dmg > 0.05) || b.repairer || b.removed) continue;
      const u = takeNearest(idle, b.doorX, b.doorY);
      if (!u) break;
      b.repairer = u; u.repairJob = b;
      u.idleFlag = false; u.idleStreak = 0;
      u.proc = null; u.action = null; u.anim = null;
    }
  }
  // оставшиеся без дела работяги вскапывают заложенные поля (бесплатно)
  if (idle.length && Game.fieldPlans && Game.fieldPlans.size) {
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
      if (b.state !== 'done' || !idle.length || !b.def.crops) continue;
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

function dispatchWorkers() {
  for (const b of Game.buildings) {
    if (b.state !== 'done' || !b.def.worker || (b.worker && !b.worker.dead && b.worker.home === b)) continue;
    b.worker = null;
    const idle = Game.units.filter(u => u.type === b.def.worker && !u.home && !u.inside && !u.teamOf);
    const u = takeNearest(idle, b.doorX, b.doorY);
    if (!u) continue;
    u.home = b;
    b.worker = u;
    u.idleFlag = false; u.idleStreak = 0;
    u.proc = null; u.action = null; u.anim = null;
  }
}

let auditT = 0;
function dispatchAll() {
  if ((auditT += 1) >= 8) { auditT = 0; auditIncoming(); }      // раз в ~3 с
  dispatchWorkers();
  dispatchBuilders();
  dispatchSerfs();
}
