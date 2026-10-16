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
  u.idleFlag = false;
  u.action = null; u.anim = null;
  u.proc = deliverGen(u, from, to, g, n);
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
  const depots = [...Game.buildings, ...Game.piles.values()];
  const compOf = new Map();
  for (const b of Game.buildings) compOf.set(b, compAt(b.doorX, b.doorY));
  // кучки и стройки дорог могут лежать в стороне от дороги — обслуживает ближайшая сеть
  for (const p of Game.piles.values()) compOf.set(p, compNear(p.x, p.y) || storeComp(p.x, p.y));
  for (const s of Game.roadSites.values()) compOf.set(s, compNear(s.x, s.y) || storeComp(s.x, s.y));

  const reqs = [];
  for (const [d, comp] of compOf) {
    if (!comp || !idleBy.has(comp)) continue;
    for (const g of GOOD_KEYS) {
      const n = d.demand(g);
      if (n > 0) reqs.push({ d, g, n, comp, pri: d.isRoad ? 2 : (d.state !== 'done' ? 0 : 1), r: Math.random() });
    }
  }
  reqs.sort((a, b) => a.pri - b.pri || a.r - b.r);

  for (const r of reqs) {
    const idle = idleBy.get(r.comp);
    let need = r.n;
    while (need > 0 && idle.length) {
      let src = null, sd = 1e9;
      for (const o of depots) {
        if (o === r.d || compOf.get(o) !== r.comp || o.offer(r.g) <= 0) continue;
        const dd = mdist(o.doorX, o.doorY, r.d.doorX, r.d.doorY);
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

  // Готовую продукцию и рассыпанное — на ближайший склад той же сети
  for (const b of depots) {
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

function dispatchBuilders() {
  const idle = Game.units.filter(u => u.type === 'builder' && u.idleFlag && !u.inside);
  if (!idle.length) return;
  const sites = [
    ...Game.buildings.filter(b => b.state !== 'done' && !b.builder),
    // дорогу можно копать сразу, а мостить — когда камень на месте или в пути
    ...[...Game.roadSites.values()].filter(s => !s.builder && (s.dug < 1 || s.stock.stone + s.incoming.stone > 0)),
  ];
  for (const s of sites) {
    const u = takeNearest(idle, s.doorX, s.doorY);
    if (!u) return;
    s.builder = u;
    u.job = s;
    u.idleFlag = false;
    u.proc = null; u.action = null; u.anim = null;
  }
}

function dispatchWorkers() {
  for (const b of Game.buildings) {
    if (b.state !== 'done' || !b.def.worker || (b.worker && !b.worker.dead && b.worker.home === b)) continue;
    b.worker = null;
    const idle = Game.units.filter(u => u.type === b.def.worker && !u.home && !u.inside);
    const u = takeNearest(idle, b.doorX, b.doorY);
    if (!u) continue;
    u.home = b;
    b.worker = u;
    u.idleFlag = false;
    u.proc = null; u.action = null; u.anim = null;
  }
}

function dispatchAll() {
  dispatchWorkers();
  dispatchBuilders();
  dispatchSerfs();
}
