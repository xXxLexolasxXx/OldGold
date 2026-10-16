'use strict';
// Поведение жителей. Каждая работа — генератор, который выдаёт элементарные действия:
//   { walk: [x, y] }        -> true / false (дошёл / пути нет)
//   { wait: сек, anim }     -> true
//   { enter: здание }       -> true
//   { leave: true }         -> true

// Ближайшая клетка дороги (поиск по квадратам вокруг).
function nearestRoad(x, y, r = 12) {
  let best = null, bd = 1e9;
  for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) {
    if (!inb(xx, yy) || !World.road[idx(xx, yy)]) continue;
    const d = (xx - x) ** 2 + (yy - y) ** 2;
    if (d < bd) { bd = d; best = [xx, yy]; }
  }
  return best;
}

function* idleGen(u) {
  if (u.isCourier) { yield* courierIdle(u); return; }
  const anchor = nearestStore(u.x, u.y) ||
    Game.buildings.find(b => b.type === 'school' && b.state === 'done');
  if (anchor) {
    const d = Math.hypot(u.x - anchor.doorX - 0.5, u.y - anchor.doorY - 0.5);
    if (d > 5) {
      const spot = randomFreeNear(anchor.doorX, anchor.doorY + 2, 0, 3,
        (x, y) => isWalkable(x, y) && !World.door[idx(x, y)]);
      if (spot) yield { walk: spot };
    }
  }
  yield { wait: 1 + Math.random() * 2 };
}

// Курьер ждёт работы на дороге у склада своей сети, не загораживая входы.
function* courierIdle(u) {
  const x = Math.floor(u.x), y = Math.floor(u.y);
  if (!World.road[idx(x, y)]) {
    const r = nearestRoad(x, y);
    if (r) yield { walk: r };
    yield { wait: 0.5 };
    return;
  }
  const comp = compAt(x, y);
  const st = nearestStore(u.x, u.y, null, comp);
  if (st && Math.hypot(u.x - st.doorX - 0.5, u.y - st.doorY - 0.5) > 5) {
    const spot = randomFreeNear(st.doorX, st.doorY, 1, 4,
      (xx, yy) => compAt(xx, yy) === comp && !World.door[idx(xx, yy)] && !World.occ[idx(xx, yy)]);
    if (spot) yield { walk: spot };
  }
  yield { wait: 1 + Math.random() * 1.5 };
}

function* eatGen(u, inn) {
  const food = innFood(inn);
  if (!food) return;
  inn.reserved[food]++;
  const ok = yield { walk: [inn.doorX, inn.doorY] };
  if (inn.removed) return;
  if (!ok) { inn.reserved[food]--; u.nextEatTry = Game.time + 15; return; }
  yield { enter: inn };
  yield { wait: 5 };
  if (!inn.removed) {
    inn.reserved[food]--;
    inn.stock[food]--;
    u.food = 1;
  }
  yield { leave: true };
}

function* deliverGen(u, from, to, g) {
  let ok = yield { walk: [from.doorX, from.doorY] };
  if (from.removed || !ok) {
    if (!from.removed) from.reserved[g]--;
    if (!to.removed) to.incoming[g]--;
    return;
  }
  from.reserved[g]--;
  from.stock[g]--;
  yield { wait: 0.5 };
  u.carry = g;
  for (let tries = 0; tries < 3; tries++) {
    if (to.removed) {
      const comp = compAt(Math.floor(u.x), Math.floor(u.y));
      to = nearestStore(u.x, u.y, g, comp) || nearestStore(u.x, u.y, null, comp);
      if (!to) break;
      to.incoming[g]++;
    }
    ok = yield { walk: [to.doorX, to.doorY] };
    if (to.removed) continue;
    if (!ok) {
      // не дойти — несём на ближайший склад
      const st = nearestStore(u.x, u.y, null, compAt(Math.floor(u.x), Math.floor(u.y)));
      if (!st || st === to) break;
      to.incoming[g]--;
      to = st;
      to.incoming[g]++;
      continue;
    }
    to.incoming[g]--;
    to.stock[g]++;
    u.carry = null;
    yield { wait: 0.4 };
    return;
  }
  if (to && !to.removed) to.incoming[g]--;
  u.carry = null;   // товар потерян: некуда отнести
}

function* buildGen(u, s) {
  const ok = yield { walk: [s.doorX, s.doorY] };
  if (!ok) {
    if (s.builder === u) s.builder = null;
    u.job = null;
    yield { wait: 3 };
    return;
  }
  while (!s.removed && u.job === s) {
    if (u.wantsEat() && findInn(u)) break;
    if (s.isRoad) {
      if (s.stock.stone >= ROAD_STONE) {
        yield { wait: 2, anim: 'build' };
        if (!s.removed) completeRoad(s);
        break;
      }
      yield { wait: 1 };
      continue;
    }
    if (s.state === 'site') {
      yield { wait: 3, anim: 'build' };
      if (!s.removed) s.state = 'build';
      continue;
    }
    const g = ['timber', 'stone'].find(k => s.stock[k] > 0);
    if (g) {
      yield { wait: 2.2, anim: 'build' };
      if (s.removed) break;
      s.stock[g]--; s.usedOf[g]++; s.used++;
      if (s.used >= s.total) { finishBuilding(s); break; }
    } else {
      yield { wait: 1 };
    }
  }
  if (s.builder === u) s.builder = null;
  if (u.job === s) u.job = null;
}

function* goHome(u, b) {
  const ok = yield { walk: [b.doorX, b.doorY] };
  if (!ok || b.removed) return false;
  yield { enter: b };
  return true;
}

function* workerGen(u, b) {
  if (u.inside !== b) {
    const ok = yield* goHome(u, b);
    if (!ok) { yield { wait: 3 }; return; }
  }
  while (!b.removed && u.home === b) {
    if (u.wantsEat()) {
      if (findInn(u)) { yield { leave: true }; return; }
      u.nextEatTry = Game.time + 15;
    }
    if (b.paused) { yield { wait: 1 }; continue; }
    const work = WORK[b.type] || recipeWork;
    yield* work(u, b);
    if (u.inside !== b && !b.removed && u.home === b) {
      const ok = yield* goHome(u, b);
      if (!ok) { yield { wait: 3 }; return; }
    }
  }
}

function outFull(b, g) { return b.stock[g] >= b.def.outputs[g]; }

function* recipeWork(u, b) {
  const r = pickRecipe(b);
  if (!r) { yield { wait: 2 }; return; }
  recipeConsume(b, r);
  b.working = true;
  yield { wait: r.time, anim: 'work' };
  b.working = false;
  if (b.removed) return;
  recipeProduce(b, r);
}

function gather(b, g) { b.stock[g]++; Game.produced[g]++; }

function* woodcutterWork(u, b) {
  const R = 9;
  if (!outFull(b, 'trunk')) {
    const t = findObjNear(b.doorX, b.doorY, R, o => o.t === 'tree' && o.g >= 1 && !o.res);
    if (t) {
      t.o.res = true;
      const ok = yield { walk: [t.x, t.y] };
      if (!ok) { t.o.res = false; yield { wait: 2 }; return; }
      yield { wait: 4.5, anim: 'chop' };
      const i = idx(t.x, t.y);
      if (World.obj[i] === t.o) {
        World.obj[i] = { t: 'stump', g: 0 };
        World.growing.add(i);
        u.carry = 'trunk';
      }
      if (!(yield* goHome(u, b))) return;
      if (u.carry) { gather(b, 'trunk'); u.carry = null; }
      yield { wait: 1 };
      return;
    }
  }
  let trees = 0;
  for (let y = b.doorY - R; y <= b.doorY + R; y++) for (let x = b.doorX - R; x <= b.doorX + R; x++) {
    if (!inb(x, y)) continue;
    const o = World.obj[idx(x, y)];
    if (o && o.t === 'tree') trees++;
  }
  if (trees < 16) {
    const spot = randomFreeNear(b.doorX, b.doorY, 3, R - 2);
    if (spot) {
      const ok = yield { walk: spot };
      if (!ok) { yield { wait: 2 }; return; }
      yield { wait: 2.5, anim: 'dig' };
      if (isFreeGrass(spot[0], spot[1])) setTree(idx(spot[0], spot[1]), 0);
      return;
    }
  }
  yield { wait: 3 };
}

function* quarryWork(u, b) {
  if (outFull(b, 'stone')) { yield { wait: 3 }; return; }
  const s = findObjNear(b.doorX, b.doorY, 10, o => o.t === 'stone' && o.n > 0 && !o.res);
  if (!s) { yield { wait: 4 }; return; }
  // Встать рядом с глыбой
  let spot = null, bd = 1e9;
  for (const [dx, dy] of DIRS) {
    const x = s.x + dx, y = s.y + dy;
    if (!isWalkable(x, y)) continue;
    const d = Math.hypot(x - b.doorX, y - b.doorY);
    if (d < bd) { bd = d; spot = [x, y]; }
  }
  if (!spot) { yield { wait: 3 }; return; }
  s.o.res = true;
  const ok = yield { walk: spot };
  if (!ok) { s.o.res = false; yield { wait: 2 }; return; }
  u.face = s.x + 0.5 > u.x ? 1 : -1;
  yield { wait: 5, anim: 'mine' };
  s.o.res = false;
  const i = idx(s.x, s.y);
  if (World.obj[i] === s.o) {
    s.o.n--;
    if (s.o.n <= 0) World.obj[i] = null;
    u.carry = 'stone';
  }
  if (!(yield* goHome(u, b))) return;
  if (u.carry) { gather(b, 'stone'); u.carry = null; }
  yield { wait: 1 };
}

const FARM_R = 5, FARM_FIELDS = 9;

function farmFields(b) {
  const fields = [];
  for (let y = b.y - FARM_R; y <= b.doorY + FARM_R; y++) for (let x = b.x - FARM_R; x < b.x + b.w + FARM_R; x++) {
    if (!inb(x, y)) continue;
    const o = World.obj[idx(x, y)];
    if (o && o.t === 'field' && o.farm === b.id) fields.push({ x, y, o });
  }
  return fields;
}

// Что сеять: включённая культура, под которую сейчас меньше всего полей.
function pickCrop(b, fields) {
  const on = FARM_CROPS.filter(c => b.crops[c]);
  if (!on.length) return null;
  const cnt = c => fields.filter(f => f.o.crop === c && f.o.g >= 0).length;
  on.sort((a, z) => cnt(a) - cnt(z));
  return on[0];
}

function* farmWork(u, b) {
  const fields = farmFields(b);
  const ripe = fields.find(f => f.o.g >= 1 && !f.o.res && !outFull(b, f.o.crop));
  const bare = fields.find(f => f.o.g < 0 && !f.o.res);
  const crop = pickCrop(b, fields);
  const target = ripe || (crop && bare);
  if (target) {
    target.o.res = true;
    const ok = yield { walk: [target.x, target.y] };
    target.o.res = false;
    if (!ok) { yield { wait: 2 }; return; }
    if (target === ripe) {
      yield { wait: 4, anim: 'reap' };
      if (World.obj[idx(target.x, target.y)] === target.o) {
        target.o.g = -1;
        u.carry = target.o.crop;
      }
      if (!(yield* goHome(u, b))) return;
      if (u.carry) { gather(b, u.carry); u.carry = null; }
    } else {
      yield { wait: 3, anim: 'dig' };
      if (World.obj[idx(target.x, target.y)] === target.o) {
        target.o.g = 0;
        target.o.crop = crop;
        World.growing.add(idx(target.x, target.y));
      }
    }
    return;
  }
  if (crop && fields.length < FARM_FIELDS) {
    const spot = randomFreeNear(b.doorX, b.y + 1, 2, FARM_R);
    if (spot) {
      const ok = yield { walk: spot };
      if (!ok) { yield { wait: 2 }; return; }
      yield { wait: 3, anim: 'dig' };
      if (isFreeGrass(spot[0], spot[1])) {
        const i = idx(spot[0], spot[1]);
        World.obj[i] = { t: 'field', g: 0, farm: b.id, crop };
        World.growing.add(i);
      }
      return;
    }
  }
  yield { wait: 3 };
}

// Свинарник: каждая охапка сена — все подрастающие свиньи растут на треть,
// появляется новый поросёнок; выросшая (3/3) свинья ждёт отправки на бойню.
function* swineWork(u, b) {
  if (b.stock.hay < 1 || b.stock.pig >= b.def.outputs.pig) { yield { wait: 2 }; return; }
  b.stock.hay--;
  b.working = true;
  yield { wait: 7, anim: 'work' };
  b.working = false;
  if (b.removed) return;
  feedPigs(b);
}

function feedPigs(b) {
  const next = [];
  for (const s of b.pigs) {
    if (s + 1 >= 3) { b.stock.pig++; Game.produced.pig++; } else next.push(s + 1);
  }
  next.push(1);
  b.pigs = next;
}

const WORK = {
  woodcutter: woodcutterWork,
  quarry: quarryWork,
  farm: farmWork,
  swine: swineWork,
};
