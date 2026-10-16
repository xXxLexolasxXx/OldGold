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

function assignDelivery(u, from, to, g) {
  from.reserved[g]++;
  to.incoming[g]++;
  u.idleFlag = false;
  u.action = null; u.anim = null;
  u.proc = deliverGen(u, from, to, g);
}

// Курьеры ездят только по дорогам: всё распределяется внутри одной дорожной сети.
function dispatchSerfs() {
  updateRoadComps();
  const idleAll = Game.units.filter(u => u.type === 'serf' && u.idleFlag && !u.inside);
  if (!idleAll.length) return;
  // свободные курьеры по сетям
  const idleBy = new Map();
  for (const u of idleAll) {
    const c = compNear(Math.floor(u.x), Math.floor(u.y));
    if (!c) continue;
    if (!idleBy.has(c)) idleBy.set(c, []);
    idleBy.get(c).push(u);
  }
  if (!idleBy.size) return;
  const depots = Game.buildings;
  const compOf = new Map();
  for (const b of depots) compOf.set(b, compAt(b.doorX, b.doorY));
  for (const s of Game.roadSites.values()) compOf.set(s, compNear(s.x, s.y));

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
    for (let k = 0; k < r.n && idle.length; k++) {
      let src = null, sd = 1e9;
      for (const o of depots) {
        if (o === r.d || compOf.get(o) !== r.comp || o.offer(r.g) <= 0) continue;
        const dd = mdist(o.doorX, o.doorY, r.d.doorX, r.d.doorY);
        if (dd < sd) { sd = dd; src = o; }
      }
      if (!src) break;
      assignDelivery(takeNearest(idle, src.doorX, src.doorY), src, r.d, r.g);
    }
  }

  // Готовую продукцию — на ближайший склад той же сети
  for (const b of depots) {
    if (b.state !== 'done' || b.isStore() || !b.def.outputs) continue;
    const comp = compOf.get(b), idle = idleBy.get(comp);
    if (!idle) continue;
    for (const g in b.def.outputs) {
      let n = b.offer(g);
      while (n-- > 0 && idle.length) {
        const st = nearestStore(b.doorX, b.doorY, g, comp);
        if (!st) break;
        assignDelivery(takeNearest(idle, b.doorX, b.doorY), b, st, g);
      }
    }
  }
}

function dispatchBuilders() {
  const idle = Game.units.filter(u => u.type === 'builder' && u.idleFlag && !u.inside);
  if (!idle.length) return;
  const sites = [
    ...Game.buildings.filter(b => b.state !== 'done' && !b.builder),
    ...[...Game.roadSites.values()].filter(s => !s.builder && s.stock.stone + s.incoming.stone > 0),
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
