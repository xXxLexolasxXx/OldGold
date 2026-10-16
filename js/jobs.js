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
  // заскучал без дела — досуг: грибы, бабочки, золото в корнях, курица
  u.idleStreak = (u.idleStreak || 0) + 1;
  if (u.type !== 'goat' && u.type !== 'carter' && u.idleStreak > LEISURE_IDLE && Game.time >= (u.nextLeisure || 0) && Math.random() < 0.3) {
    yield* leisureGen(u);
    return;
  }
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
    // к еде — кружка пива, если есть
    if (inn.stock.beer - inn.reserved.beer > 0 && Math.random() < 0.65) {
      yield { wait: 3 };
      if (!inn.removed && inn.stock.beer > 0) {
        inn.stock.beer--;
        u.food = Math.min(1.2, u.food + 0.2);
        // захмелел: через несколько секунд пути свалится спать
        if (Math.random() < DRUNK_CHANCE) u.drunkAt = Game.time + 3 + Math.random() * 9;
      }
    }
  }
  yield { leave: true };
}

// Доставка n единиц товара. Курьеры ходят по дорогам; исключения — камень для
// строящейся дороги и товар, рассыпанный на земле: туда можно сойти с дороги.
// На складе курьер заходит внутрь — ворота не загорожены. Внутри не больше STORE_CAP.
const isStoreB = b => !!(b && b.isStore && b.isStore() && !b.isPile);
function storeInside(b) { let n = 0; for (const x of Game.units) if (x.inside === b) n++; return n; }

function* storeVisit(u, b, t) {
  while (storeInside(b) >= STORE_CAP && !b.removed) yield { wait: 0.4 };
  if (b.removed) return;
  yield { enter: b };
  yield { wait: t };
  // выходим той же створкой
  yield { walk: [Math.floor(u.x), Math.floor(u.y)] };
}

function* deliverGen(u, from, to, g, n = 1) {
  let ok = yield { walk: [from.doorX, from.doorY], offroad: !!from.isPile };
  if (from.removed || !ok) {
    if (!from.removed) from.reserved[g] -= n;
    if (!to.removed) to.incoming[g] -= n;
    return;
  }
  if (isStoreB(from)) yield* storeVisit(u, from, 0.7);
  from.reserved[g] -= n;
  const got = Math.max(0, Math.min(n, from.stock[g]));
  from.stock[g] -= got;
  if (got < n && !to.removed) to.incoming[g] -= n - got;
  n = got;
  if (from.isPile) cleanupPile(from);
  if (!n) return;
  if (!isStoreB(from)) yield { wait: 0.5 };
  u.carry = g; u.carryN = n;
  for (let tries = 0; tries < 3; tries++) {
    if (to.removed) {
      const comp = compAt(Math.floor(u.x), Math.floor(u.y));
      to = nearestStore(u.x, u.y, g, comp) || nearestStore(u.x, u.y, null, comp);
      if (!to) break;
      to.incoming[g] += n;
    }
    ok = yield { walk: [to.doorX, to.doorY], offroad: !!to.isRoad };
    // груз уронили при столкновении или утащил зверь
    if (!u.carry) { if (!to.removed) to.incoming[g] -= n; return; }
    if (to.removed) continue;
    if (!ok) {
      // не дойти — несём на ближайший склад
      const st = nearestStore(u.x, u.y, null, compAt(Math.floor(u.x), Math.floor(u.y)));
      if (!st || st === to) break;
      to.incoming[g] -= n;
      to = st;
      to.incoming[g] += n;
      continue;
    }
    if (isStoreB(to)) {
      // заносит внутрь и складывает
      while (storeInside(to) >= STORE_CAP && !to.removed) yield { wait: 0.4 };
      if (to.removed) continue;
      yield { enter: to };
      to.incoming[g] -= n;
      to.stock[g] += n;
      u.carry = null; u.carryN = 0;
      yield { wait: 0.6 };
      yield { walk: [Math.floor(u.x), Math.floor(u.y)] };
      return;
    }
    to.incoming[g] -= n;
    to.stock[g] += n;
    u.carry = null; u.carryN = 0;
    yield { wait: 0.4 };
    return;
  }
  if (to && !to.removed) to.incoming[g] -= n;
  // некуда отнести — оставляем кучкой на земле, подберут позже
  dropPile(Math.floor(u.x), Math.floor(u.y), g, n);
  u.carry = null; u.carryN = 0;
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
      // 1) копает корыто под дорогу — бесплатно
      if (s.dug < 1) {
        for (let k = Math.round(s.dug * ROAD_DIG_HITS); k < ROAD_DIG_HITS && !s.removed; k++) {
          yield { wait: HIT_TIME * 1.3, anim: 'dig' };
          s.dug = (k + 1) / ROAD_DIG_HITS; s.lastHit = Game.time;
        }
        continue;
      }
      // 2) стучит по земле, выкладывая булыжник — уже за камень
      if (s.stock.stone >= ROAD_STONE) {
        for (let k = 0; k < ROAD_PAVE_HITS && !s.removed; k++) {
          yield { wait: HIT_TIME, anim: 'build' };
          s.pave = (k + 1) / ROAD_PAVE_HITS; s.lastHit = Game.time;
        }
        if (!s.removed) completeRoad(s);
        break;
      }
      // камня ещё нет — не стоим без дела, вернёмся, когда привезут
      break;
    }
    if (s.state === 'site') {
      // разметка: три удара по колышкам
      for (let k = 0; k < SITE_HITS && !s.removed; k++) { yield { wait: HIT_TIME, anim: 'build' }; s.hits++; s.lastHit = Game.time; }
      if (!s.removed) s.state = 'build';
      continue;
    }
    const g = ['timber', 'stone'].find(k => s.stock[k] > 0);
    if (g) {
      // каждая единица материала — несколько ударов молота, каждый добавляет кусочек здания
      s.stock[g]--; s.usedOf[g]++; s.used++;
      for (let k = 0; k < HITS_PER_UNIT && !s.removed; k++) { yield { wait: HIT_TIME, anim: 'build' }; s.hits++; s.lastHit = Game.time; }
      if (s.removed) break;
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
  const on = (b.def.crops || []).filter(c => b.crops[c]);
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

// Пастух: идёт к ближайшей дикой козе, приручает её, и коза становится вьючной.
function* goatpenWork(u, b) {
  const mine = Game.units.filter(x => x.type === 'goat' && x.homePen === b.id).length;
  if (mine >= 3) { yield { wait: 4 }; return; }
  const goat = nearestAnimal(b.doorX, b.doorY, 22, a => a.kind === 'goat' && !a.tamedBy && !a.dead);
  if (!goat) { yield { wait: 5 }; return; }
  goat.tamedBy = u.id;
  const ok = yield { walk: [Math.floor(goat.x), Math.floor(goat.y)], offroad: true };
  if (!ok || goat.dead) { goat.tamedBy = 0; yield { wait: 2 }; return; }
  goat.calm = Game.time + 10;
  u.face = goat.x > u.x ? 1 : -1;
  yield { wait: 4, anim: 'tame' };
  if (goat.dead) return;
  // коза идёт за пастухом в загон
  goat.follow = u.id;
  if (!(yield* goHome(u, b))) { goat.follow = 0; goat.tamedBy = 0; return; }
  removeAnimal(goat);
  const g = spawnUnit('goat', b.doorX, b.doorY);
  g.homePen = b.id;
  toast('Пастух приручил козу — она будет возить грузы', b);
  yield { wait: 2 };
}

// Конюшня: растит лошадь на сене и зерне, затем выезжает извозчик с телегой.
function* stableWork(u, b) {
  const mine = Game.units.filter(x => x.type === 'carter' && x.homeStable === b.id).length;
  if (mine >= 3 || b.stock.hay < 3 || b.stock.wheat < 2) { yield { wait: 3 }; return; }
  b.stock.hay -= 3; b.stock.wheat -= 2;
  b.working = true;
  yield { wait: 25, anim: 'work' };
  b.working = false;
  if (b.removed) return;
  const c = spawnUnit('carter', b.doorX, b.doorY);
  c.homeStable = b.id;
  toast('Из конюшни выехал извозчик с телегой', b);
}

const WORK = {
  woodcutter: woodcutterWork,
  quarry: quarryWork,
  farm: farmWork,
  hopfarm: farmWork,
  swine: swineWork,
  goatpen: goatpenWork,
  stable: stableWork,
};
