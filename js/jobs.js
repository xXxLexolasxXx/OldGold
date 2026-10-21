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
  if (!st && !Game.buildings.some(b => b.isStore() && compAt(b.doorX, b.doorY) === comp)) {
    // кусок дороги без склада (недостроенная дорога, вход стройки, отрезанный сносом участок):
    // работы здесь не будет никогда — сойти с дороги и вернуться в сеть склада. Раньше трудяги
    // копились на таких обрывках и стояли до конца игры («свободно 19, а везти некому»).
    const home = nearestStore(u.x, u.y) || Game.buildings.find(b => b.isStore());
    if (home) {
      const hc = compAt(home.doorX, home.doorY);
      const spot = randomFreeNear(home.doorX, home.doorY, 1, 4, (xx, yy) => compAt(xx, yy) === hc && !World.door[idx(xx, yy)] && !World.occ[idx(xx, yy)]);
      if (spot) { yield { walk: spot, offroad: true }; return; }
    }
  }
  if (st && Math.hypot(u.x - st.doorX - 0.5, u.y - st.doorY - 0.5) > 5) {
    const spot = randomFreeNear(st.doorX, st.doorY, 1, 4,
      (xx, yy) => compAt(xx, yy) === comp && !World.door[idx(xx, yy)] && !World.occ[idx(xx, yy)]);
    if (spot) yield { walk: spot };
  }
  yield { wait: 1 + Math.random() * 1.5 };
}

function* eatGen(u, inn) {
  const food = isStoreB(inn) ? storeMeal(inn) : innFood(inn);
  if (!food) return;
  inn.reserved[food]++;
  u.eat = { inn, food, gen: u.proc };   // бронь видна аудиту (auditIncoming): брошенный обед не держит еду вечно
  const ok = yield { walk: [inn.doorX, inn.doorY] };
  if (inn.removed) { u.eat = null; return; }
  if (!ok) { inn.reserved[food]--; u.eat = null; u.nextEatTry = Game.time + 15; return; }
  const dry = isStoreB(inn);      // на складе — всухомятку, без пива и не досыта
  if (dry) while (storeInside(inn) >= storeCapOf(inn) && !inn.removed) yield { wait: 0.4 };
  if (inn.removed) return;
  yield { enter: inn };
  if (!dry) { u.dining = inn; u.diningFood = food; }   // сидит за столом на веранде (inside.js)
  yield { wait: dry ? 3 : 5 };
  u.eat = null;
  if (!inn.removed) {
    inn.reserved[food]--;
    inn.stock[food]--;
    if (food === 'wheat') floater(inn.doorX + 0.5, inn.doorY - 0.5, 'Каша из зерна…', '#e6c24a');
    u.food = food === 'wheat' ? 0.5 : dry ? 0.7 : food === 'chickenleg' ? 1.25 : food === 'steak' ? 1.3 : food === 'croissant' ? 1.1 : 1;     // курица и стейк сытнее всего
    if (!dry && inn.def.cozy) u.food += 0.08;                  // в трактире уровня 2 уютнее
    if (dry) { yield { leave: true }; return; }
    // к еде — кружка пива (тёмное насыщает вдвое, зато и пьянит вдвое), если есть
    const mug = (inn.stock.darkbeer - inn.reserved.darkbeer > 0 && (inn.stock.beer - inn.reserved.beer <= 0 || Math.random() < 0.5)) ? 'darkbeer' : 'beer';
    const fk = typeof folkBeerK === 'function' ? folkBeerK(u) : 1;   // гномки пьют втрое реже (folk.js)
    if (inn.stock[mug] - inn.reserved[mug] > 0 && Math.random() < 0.85 * fk) {
      yield { wait: 3 };
      if (!inn.removed && inn.stock[mug] > 0) {
        inn.stock[mug]--;
        const dark = mug === 'darkbeer';
        u.food = Math.min(dark ? 1.4 : 1.2, u.food + (dark ? 0.4 : 0.2));
        // захмелел: через несколько секунд пути свалится спать
        if (Math.random() < Math.min(0.95, DRUNK_CHANCE * (dark ? 2 : 1) * fk)) u.drunkAt = Game.time + 3 + Math.random() * 9;
      }
    }
  }
  yield { leave: true };
  u.dining = null; u.diningFood = null;
  if (Math.random() < 0.2) litter(u);                 // кости и огрызки — на землю
}

// Доставка n единиц товара. Курьеры ходят по дорогам; исключения — камень для
// строящейся дороги и товар, рассыпанный на земле: туда можно сойти с дороги.
// На складе курьер заходит внутрь — ворота не загорожены. Внутри не больше STORE_CAP.
const isStoreB = b => !!(b && b.isStore && b.isStore() && !b.isPile);
function storeCapOf(b) { return (b.def && b.def.storeCap) || STORE_CAP; }
function storeInside(b) { let n = 0; for (const x of Game.units) if (x.inside === b) n++; return n; }

function* storeVisit(u, b, t) {
  while (storeInside(b) >= storeCapOf(b) && !b.removed) yield { wait: 0.4 };
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
    if (!to.removed) to.incoming[g] = Math.max(0, to.incoming[g] - n);   // груз мог побывать «уронённым» — auditIncoming его уже вычел
    return;
  }
  if (isStoreB(from)) yield* storeVisit(u, from, 0.7);
  from.reserved[g] -= n;
  if (u.dlv) u.dlv.picked = true;     // бронь снята — дальше груз в руках
  const got = Math.max(0, Math.min(n, from.stock[g]));
  from.stock[g] -= got;
  if (got < n && !to.removed) to.incoming[g] -= n - got;
  n = got;
  if (u.dlv) u.dlv.n = n;
  if (from.isPile) cleanupPile(from);
  if (!n) return;
  if (!isStoreB(from)) yield { wait: 0.5 };
  u.carry = g; u.carryN = n;
  for (let tries = 0; tries < 3; tries++) {
    if (to.removed) {
      const comp = compAt(Math.floor(u.x), Math.floor(u.y));
      to = nearestStore(u.x, u.y, g, comp) || nearestStore(u.x, u.y, null, comp);
      if (u.dlv) u.dlv.to = to;
      if (!to) break;
      to.incoming[g] += n;
    }
    ok = yield { walk: [to.doorX, to.doorY], offroad: !!to.isRoad || !u.isCourier || siteOffNet(to) };   // не-курьеры (мусор в костёр, помощь) идут и без дороги
    // груз уронили при столкновении или утащил зверь
    if (!u.carry) { if (!to.removed) to.incoming[g] = Math.max(0, to.incoming[g] - n); return; }   // уже не в учёте «в пути» (auditIncoming) — не уходим в минус
    if (to.removed) continue;
    if (!ok) {
      // не дойти — несём на ближайший склад
      const st = nearestStore(u.x, u.y, null, compAt(Math.floor(u.x), Math.floor(u.y)));
      if (!st || st === to) break;
      to.incoming[g] = Math.max(0, to.incoming[g] - n);   // груз мог побывать «уронённым» — auditIncoming его уже вычел
      to = st;
      if (u.dlv) u.dlv.to = to;
      to.incoming[g] += n;
      continue;
    }
    if (isStoreB(to) && !to.upg) {
      // заносит внутрь и складывает
      while (storeInside(to) >= storeCapOf(to) && !to.removed) yield { wait: 0.4 };
      if (to.removed) continue;
      yield { enter: to };
      to.incoming[g] = Math.max(0, to.incoming[g] - n);   // груз мог побывать «уронённым» — auditIncoming его уже вычел
      to.stock[g] += Math.min(n, u.carryN || n); u.dlv = null;   // волк мог утащить часть груза
      u.carry = null; u.carryN = 0;
      gainXp(u, 1);
      yield { wait: 0.6 };
      yield { walk: [Math.floor(u.x), Math.floor(u.y)] };
      return;
    }
    to.incoming[g] = Math.max(0, to.incoming[g] - n);   // груз мог побывать «уронённым» — auditIncoming его уже вычел
    (to.upg && to.upg.cost[g] ? to.upg.stock : to.stock)[g] += Math.min(n, u.carryN || n); u.dlv = null;
    u.carry = null; u.carryN = 0;
    gainXp(u, 1);
    yield { wait: 0.4 };
    return;
  }
  if (to && !to.removed) to.incoming[g] = Math.max(0, to.incoming[g] - n);   // груз мог побывать «уронённым» — auditIncoming его уже вычел
  // некуда отнести — оставляем кучкой на земле, подберут позже
  dropPile(Math.floor(u.x), Math.floor(u.y), g, n);
  u.carry = null; u.carryN = 0;
}

// Работяга 2–3 уровня сам берёт со склада недостающий материал (1 или 2 единицы) и несёт на стройку.
// force — стройка стоит без материала и никто его не везёт (все трудяги заняты): тогда за единицей
// сходит и новичок, а не стоит у колышков.
function* fetchForSiteGen(u, s, force) {
  const want = Math.max(force ? 1 : 0, unitLevel(u) - 1);
  if (want <= 0 || u.carry || u.injury === 'arm') return false;
  const comp = s.isRoad ? 0 : compAt(s.doorX, s.doorY);   // камень к дороге носят и по траве (как трудяги)
  // чего не хватает: дороге — камень, зданию — доски, камень, брёвна
  let g = null, n = 0;
  for (const k of (s.isRoad ? ['stone'] : ['timber', 'stone', 'trunk'])) {
    const need = s.demand(k);
    if (need > 0) { g = k; n = Math.min(want, need); break; }
  }
  if (!g) return false;
  const st = storeHaving(u.x, u.y, g, comp);
  if (!st) return false;
  n = Math.min(n, st.offer(g));
  st.reserved[g] += n; s.incoming[g] += n;
  u.dlv = { from: st, to: s, g, n, gen: u.proc };   // чтобы учёт «в пути» видел эту ношу
  let ok = yield { walk: [st.doorX, st.doorY] };
  if (!ok || st.removed) { if (!st.removed) st.reserved[g] -= n; if (!s.removed) s.incoming[g] -= n; u.dlv = null; return false; }
  yield* storeVisit(u, st, 0.7);
  st.reserved[g] -= n;
  if (u.dlv) u.dlv.picked = true;
  const got = Math.max(0, Math.min(n, st.stock[g]));
  st.stock[g] -= got;
  if (got < n && !s.removed) s.incoming[g] -= n - got;
  n = got;
  if (u.dlv) u.dlv.n = n;
  if (!n) { u.dlv = null; return false; }
  u.carry = g; u.carryN = n;
  ok = yield { walk: [s.doorX, s.doorY] };
  const have = u.carry ? Math.min(n, u.carryN || n) : 0;   // по дороге могли уронить или отобрать
  if (!s.removed) s.incoming[g] -= n;
  u.dlv = null;
  u.carry = null; u.carryN = 0;
  if (!have) return false;
  if (!ok || s.removed) { dropPile(Math.floor(u.x), Math.floor(u.y), g, have); return false; }
  (s.upg && s.state === 'done' ? s.upg.stock : s.stock)[g] += have;
  yield { wait: 0.4 };
  return true;
}

function* buildGen(u, s) {
  if (!s.removed && u.job === s) yield* fetchForSiteGen(u, s);
  const ok = yield { walk: [s.doorX, s.doorY] };
  if (!ok) {
    if (s.builder === u) s.builder = null;
    u.job = null;
    yield { wait: 3 };
    return;
  }
  let builtIt = false, idleT = 0;
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
        if (!s.removed) { completeRoad(s); builtIt = true; }
        break;
      }
      // камня нет и никто не везёт (трудяги заняты) — принести самому: дорога часто держит целую стройку
      if (s.incoming.stone <= 0 && (yield* fetchForSiteGen(u, s, true))) continue;
      // камня ещё нет — не стоим без дела, вернёмся, когда привезут
      break;
    }
    if (s.state === 'site') {
      // разметка: три удара по колышкам
      for (let k = 0; k < SITE_HITS && !s.removed; k++) { yield { wait: HIT_TIME, anim: 'build' }; s.hits++; s.lastHit = Game.time; }
      if (!s.removed) s.state = 'build';
      continue;
    }
    const g = ['trunk', 'timber', 'stone'].find(k => s.stock[k] > 0);
    if (g) {
      // каждая единица материала — несколько ударов молота, каждый добавляет кусочек здания
      s.stock[g]--; s.usedOf[g]++; s.used++;
      for (let k = 0; k < HITS_PER_UNIT && !s.removed; k++) { yield { wait: HIT_TIME, anim: 'build' }; s.hits++; s.lastHit = Game.time; }
      if (s.removed) break;
      if (s.used >= s.total) { finishBuilding(s); builtIt = true; break; }
      idleT = 0;
    } else {
      // материала нет и никто его не везёт (трудяги заняты) — сходить на склад самому, а не стоять
      if (!['trunk', 'timber', 'stone'].some(k => s.incoming[k] > 0) && idleT >= 2 && (yield* fetchForSiteGen(u, s, true))) { idleT = 0; continue; }
      // материал не везут (стройку отрезало от дорог, на складе пусто) — не держим её вечно:
      // отходим, и диспетчер даст работу на другой стройке, а сюда вернёт, когда будет что класть
      if (!['trunk', 'timber', 'stone'].some(k => s.incoming[k] > 0) && (idleT += 1) > 20) break;
      yield { wait: 1 };
    }
  }
  if (s.builder === u) s.builder = null;
  if (u.job === s) u.job = null;
  if (builtIt) gainXp(u, s.isRoad ? 1 : 3);   // выслуга: дорога 1, здание 3
  // закончили стройку: достают фляжки (дорога — реже, чтобы не мельтешило)
  if (builtIt && !u.dead && u.type !== 'hero' && !u.teamOf && Math.random() < (s.isRoad ? 0.25 : 0.8)) yield* flaskGen(u);
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
    if (typeof injWants === 'function' && (injWants(u) || injCalled(u))) { yield { leave: true }; return; }   // травма или вызов к раненому (sickness.js)
    if (b.paused || prioOff(b) || b.dmg >= 0.5 || b.upg) { yield { wait: 1 }; continue; }
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

function gather(b, g) { const n = b.def.gatherMult || 1; b.stock[g] += n; Game.produced[g] += n; }

function* woodcutterWork(u, b) {
  const R = 9;
  // бревно от срубленного ходячего дерева — забрать в первую очередь, обтесать и унести
  const lg = !outFull(b, 'trunk') && findObjNear(b.doorX, b.doorY, R + 5, o => o.t === 'log' && !o.res);
  if (lg) {
    lg.o.res = true;
    const ok = yield { walk: [lg.x, lg.y] };
    if (!ok) { lg.o.res = false; yield { wait: 2 }; return; }
    yield { wait: 2, anim: 'chop' };
    const i = idx(lg.x, lg.y);
    if (World.obj[i] === lg.o) { World.obj[i] = null; u.carry = 'trunk'; }
    if (!(yield* goHome(u, b))) return;
    if (u.carry) { gather(b, 'trunk'); u.carry = null; }
    return;
  }
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

// ---------- Долбление горы ----------
// Когда вокруг каменоломни не осталось глыб, каменотёс скалывает саму гору: у каждой клетки скалы
// свой запас кусков; выработанная клетка рушится — на её месте ровная земля с грудой щебня.
const ROCKMINE = { hp: new Map(), mined: new Set(), res: new Set() };
const ROCK_FACE_HP = 60, ROCK_FACE_R = 10;

function rockFaceOpen(x, y) {
  if (!inb(x, y)) return null;
  const i = idx(x, y);
  if (World.terrain[i] !== T_ROCK || World.crystal[i] || ROCKMINE.res.has(i)) return null;
  if (inb(x, y + 1) && (World.bmap[idx(x, y + 1)] || World.door[idx(x, y + 1)])) return null;   // под скалой стоит рудник — не трогаем
  return i;
}

// ближайшая клетка скалы с подходом: { x, y, spot }
function findRockFace(b) {
  let best = null, bd = 1e9;
  for (let y = b.doorY - ROCK_FACE_R; y <= b.doorY + ROCK_FACE_R; y++) for (let x = b.doorX - ROCK_FACE_R; x <= b.doorX + ROCK_FACE_R; x++) {
    if (rockFaceOpen(x, y) === null) continue;
    const dd = (x - b.doorX) ** 2 + (y - b.doorY) ** 2;
    if (dd > ROCK_FACE_R * ROCK_FACE_R || dd >= bd) continue;
    for (const [dx, dy] of DIRS) if (isWalkable(x + dx, y + dy)) { bd = dd; best = { x, y, spot: [x + dx, y + dy] }; break; }
  }
  return best;
}

function rockFaceNear(x, y, r) {
  for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++)
    if (inb(xx, yy) && World.terrain[idx(xx, yy)] === T_ROCK && !World.crystal[idx(xx, yy)] && (xx - x) ** 2 + (yy - y) ** 2 <= r * r) return true;
  return false;
}

function rockFaceHit(x, y, u, last) {
  const hx = (u.x + (x + 0.5 - u.x) * 0.6) * TILE, hy = (u.y + (y + 0.5 - u.y) * 0.6) * TILE - 6;
  fxBurst(hx, hy, last ? 10 : 6, ['#fff6c0', '#ffd860', '#ffb040'], 110, 50, 0.3, 1.1, 320);
  fxBurst(hx, hy, last ? 14 : 5, [ROCK_COL.base, ROCK_COL.mid, ROCK_COL.light, ROCK_COL.dark], 70, 60, 0.75, last ? 2.6 : 1.8, 300);
  fxBurst(hx, hy + 4, last ? 8 : 3, ['rgba(200,186,160,0.55)', 'rgba(170,156,130,0.5)'], 18, 14, 1.1, 3.5, -12);
  if (last) sfxAt('thud', x * TILE, y * TILE, 0.6);
}

// клетка выработана: гора рассыпается
function crumbleRock(x, y) {
  const i = idx(x, y);
  ROCKMINE.hp.delete(i);
  ROCKMINE.mined.add(i);
  World.terrain[i] = T_GRASS;
  World.crystal[i] = 0;
  if (!World.obj[i]) setStone(i, 2);
  for (let k = 0; k < 3; k++) fxBurst((x + 0.5) * TILE, (y + 0.7) * TILE, 16, [ROCK_COL.base, ROCK_COL.mid, ROCK_COL.light, 'rgba(200,186,160,0.6)'], 90, 60, 1.0, 3, 200);
  floater(x + 0.5, y - 0.2, 'Гора поддалась!', '#e8dcc0');
  toast('Каменотёсы источили кусок горы — он осыпался грудой щебня');
  sfxAt('thud', x * TILE, y * TILE, 1);
  buildMountains(Game.seed);       // горы пересобираются по новой карте скал
  PF.regT = -1e9;                  // проходимость изменилась
}

function* quarryWork(u, b) {
  if (outFull(b, 'stone')) { yield { wait: 3 }; return; }
  const s = findObjNear(b.doorX, b.doorY, 10, o => o.t === 'stone' && o.n > 0 && !o.res);
  if (!s) {
    const f = findRockFace(b);
    if (!f) { yield { wait: 4 }; return; }
    const fi = idx(f.x, f.y);
    ROCKMINE.res.add(fi);
    const ok = yield { walk: f.spot };
    if (!ok) { ROCKMINE.res.delete(fi); yield { wait: 2 }; return; }
    for (let k = 0; k < 5; k++) {
      u.face = f.x + 0.5 > u.x ? 1 : -1; u.vdir = 'E';
      fxLater(0.52, () => rockFaceHit(f.x, f.y, u, k === 4));
      yield { wait: 1, anim: 'mine' };
    }
    ROCKMINE.res.delete(fi);
    if (World.terrain[fi] === T_ROCK) {
      const left = (ROCKMINE.hp.get(fi) ?? ROCK_FACE_HP) - 1;
      ROCKMINE.hp.set(fi, left);
      if (left <= 0) crumbleRock(f.x, f.y);
      u.carry = 'stone';
      yield { wait: 0.5, anim: 'duck' };
    }
    if (!(yield* goHome(u, b))) return;
    if (u.carry) { gather(b, 'stone'); u.carry = null; }
    yield { wait: 1 };
    return;
  }
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
  // пять ударов киркой: искры и осколки, камень трескается; последним откалывается кусок
  const HITS = 5;
  for (let k = 0; k < HITS; k++) {
    u.face = s.x + 0.5 > u.x ? 1 : -1; u.vdir = 'E';
    fxLater(0.52, () => rockHit(s.x, s.y, s.o, u, k === HITS - 1));   // в момент удара внутри замаха
    yield { wait: 1, anim: 'mine' };
    if (World.obj[idx(s.x, s.y)] !== s.o) break;
  }
  s.o.res = false;
  const i = idx(s.x, s.y);
  if (World.obj[i] === s.o) {
    s.o.n--;
    s.o.dmg = 0;
    if (s.o.n <= 0) World.obj[i] = null;
    u.carry = 'stone';
    yield { wait: 0.5, anim: 'duck' };          // нагнулся, поднял отколотый кусок
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

// Бесхозные поля игрока рядом с фермой переходят под её присмотр, если культура подходит
function claimFields(b, fields) {
  const crops = b.def.crops || [];
  for (let y = b.y - FARM_R; y <= b.doorY + FARM_R && fields.length < FARM_FIELDS; y++) for (let x = b.x - FARM_R; x < b.x + b.w + FARM_R && fields.length < FARM_FIELDS; x++) {
    if (!inb(x, y)) continue;
    const o = World.obj[idx(x, y)];
    if (o && o.t === 'field' && !o.plan && !o.farm && crops.includes(o.crop)) { o.farm = b.id; fields.push({ x, y, o }); }
  }
}

// ---------- Поля: разбивает игрок, копает работяга ----------

// Заложить поле. Пшеница и сено — бесплатно, хмель — одна доска на подвесы.
function planField(x, y, crop) {
  if (!isFreeGrass(x, y)) return 'Здесь нельзя разбить поле';
  if (crop === 'hops') {
    const st = Game.buildings.find(b => b.isStore() && b.stock.timber > 0);
    if (!st) return 'Для хмеля нужна доска на подвесы — на складе её нет';
    st.stock.timber--;
  }
  const i = idx(x, y);
  World.obj[i] = { t: 'field', g: -1, crop, farm: 0, plan: true };
  (Game.fieldPlans || (Game.fieldPlans = new Set())).add(i);
  return null;
}

function removeField(x, y) {
  if (!inb(x, y)) return false;
  const i = idx(x, y), o = World.obj[i];
  if (!o || o.t !== 'field') return false;
  // не вскопанное поле хмеля — доска возвращается на склад
  if (o.plan && o.crop === 'hops') { const st = Game.buildings.find(b => b.isStore()); if (st) st.stock.timber++; }
  World.obj[i] = null; World.growing.delete(i);
  if (Game.fieldPlans) Game.fieldPlans.delete(i);
  return true;
}

// Работяга готовит заложенное поле. Пшеница: лопата, комья земли, борозды проступают рядами.
// Хмель: молоток, щепки, шесты вбиваются по одному и затягиваются бечёвкой.
function* fieldDigGen(u, i) {
  const o = World.obj[i], x = i % MAP_W, y = (i / MAP_W) | 0;
  u.fieldJob = -1;
  if (!o || o.t !== 'field' || !o.plan) { if (o) o.res = false; return; }
  const ok = yield { walk: [x, y], offroad: true };
  if (!ok || World.obj[i] !== o) { o.res = false; yield { wait: 2 }; return; }
  const hop = o.crop === 'hops', hits = hop ? 6 : 4;
  u.vdir = 'E';
  for (let k = 0; k < hits; k++) {
    u.face = x + 0.5 > u.x ? 1 : -1;
    fxLater(hop ? 0.34 : 0.52, () => fieldWorkFx(x, y, o, hop, k));
    yield { wait: hop ? 0.8 : 1, anim: hop ? 'build' : 'dig' };
    if (World.obj[i] !== o) return;
    o.prog = (k + 1) / hits;
  }
  o.plan = false; o.res = false; o.g = -1; o.prog = 1;
  if (Game.fieldPlans) Game.fieldPlans.delete(i);
  if (hop) floater(x + 0.5, y, 'Шесты стоят', '#c8e080'); else floater(x + 0.5, y, 'Вспахано', '#e8c070');
}

// эффекты удара при подготовке поля
function fieldWorkFx(x, y, o, hop, k) {
  if (World.obj[idx(x, y)] !== o) return;
  const px = (x + 0.5) * TILE, py = (y + 0.55) * TILE;
  if (hop) {
    fxBurst(px + (k % 3 - 1) * 8, py - 4, 7, ['#d8b070', '#a0703a', '#e8cc90'], 60, 45, 0.5, 1.6, 280);   // щепки
    sfxAt('build', px, py, 0.7);
  } else {
    fxBurst(px + rnd0(-8, 8), py + 2, 9, ['#7a5230', '#5a3a20', '#9a7450', '#3e2812'], 55, 40, 0.6, 2.2, 260);  // комья земли
    sfxAt('dig', px, py, 0.7);
  }
}
const rnd0 = (a, b) => a + Math.random() * (b - a);

// эффекты жатвы: пшеница — золотые стебли и полова, хмель — зелёные шишки сыплются в корзину
function harvestFx(x, y, crop) {
  const px = (x + 0.5) * TILE, py = (y + 0.5) * TILE;
  if (crop === 'hops') {
    fxBurst(px, py - 12, 7, ['#a8d860', '#c8e880', '#7aae3a'], 38, 62, 0.9, 2.4, 240);
    fxBurst(px, py - 4, 3, ['#5a8a2a', '#3e6a1e'], 22, 18, 0.7, 1.4, 120);
  } else {
    fxBurst(px, py - 4, 11, ['#f0d060', '#d8b040', '#e8c850', '#c89a30'], 55, 38, 0.8, 1.6, 150);
    fxBurst(px, py - 2, 5, ['#fff0a0', '#e0d0a0'], 28, 24, 1.1, 1.2, 30);
  }
}

// Что сеять: включённая культура, под которую сейчас меньше всего полей.
function pickCrop(b, fields) {
  const on = (b.def.crops || []).filter(c => b.crops[c]);
  if (!on.length) return null;
  const cnt = c => fields.filter(f => f.o.crop === c && f.o.g >= 0).length;
  on.sort((a, z) => cnt(a) - cnt(z));
  return on[0];
}

// Пепел из костра при посеве: поле растёт быстрее и даёт двойной урожай
function fertilize(b, o) {
  if (b.stock.ash > 0) { b.stock.ash--; o.ash = true; }
}

function* farmWork(u, b) {
  const fields = farmFields(b);
  claimFields(b, fields);                                   // поля игрока рядом переходят под присмотр фермы
  const ripe = fields.find(f => f.o.g >= 1 && !f.o.res && !outFull(b, f.o.crop));
  // сеем только то, что включено в окне фермы; культура у каждого поля своя — как заложил игрок
  const bare = fields.find(f => f.o.g < 0 && !f.o.plan && !f.o.res && b.crops[f.o.crop]);
  const target = ripe || bare;
  if (target) {
    target.o.res = true;
    const ok = yield { walk: [target.x, target.y] };
    target.o.res = false;
    if (!ok) { yield { wait: 2 }; return; }
    if (target === ripe) {
      const hopCrop = target.o.crop === 'hops';
      for (let k = 0; k < 4; k++) fxLater(0.45 + k * 0.95, () => harvestFx(target.x, target.y, target.o.crop));
      yield { wait: 4, anim: hopCrop ? 'hoppick' : 'reap' };
      let extra = false;
      if (World.obj[idx(target.x, target.y)] === target.o) {
        target.o.g = -1;
        u.carry = target.o.crop;
        extra = !!target.o.ash; target.o.ash = false;     // удобренное поле — двойной урожай
      }
      if (!(yield* goHome(u, b))) return;
      if (u.carry) {
        // с поля — 3 снопа, с удобренного пеплом — 5
        const n = extra ? 5 : 3;
        const crop = u.carry;
        for (let k = 0; k < n; k++) if (k === 0 || !outFull(b, crop)) gather(b, crop);
        // солома и ботва — сено: с пшеницы больше, с хмеля меньше
        const hay = (crop === 'hops' ? 1 : extra ? 3 : 2) + (typeof seaHayBonus === 'function' ? seaHayBonus(crop) : 0);   // осенью солому вяжут в снопы на зиму
        for (let k = 0; k < hay; k++) if (!outFull(b, 'hay')) gather(b, 'hay');
        u.carry = null;
      }
    } else {
      yield { wait: 3, anim: 'dig' };
      if (World.obj[idx(target.x, target.y)] === target.o) {
        target.o.g = 0;
        fertilize(b, target.o);
        World.growing.add(idx(target.x, target.y));
      }
    }
    return;
  }
  yield { wait: 3 };
}

// Свинарник: каждая охапка сена — все подрастающие свиньи растут на треть,
// появляется новый поросёнок; выросшая (3/3) свинья ждёт отправки на бойню.
function* swineWork(u, b) {
  // осенью и зимой, пока сена на зиму не хватает, свиней не разводят — сено копится на корм (season.js)
  if (b.stock.hay < 1 || b.stock.pig >= b.def.outputs.pig || (typeof seaHoldHay === 'function' && seaHoldHay())) { yield { wait: 2 }; return; }
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
  logEvent('animal', 'Пастух приручил козу — она будет возить грузы', b.doorX + 0.5, b.doorY);
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
  logEvent('people', 'Из конюшни выехал извозчик с телегой', b.doorX + 0.5, b.doorY);
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

// ---------- Инструмент «поле» ----------
const FIELD_NAMES = { wheat: 'Поле пшеницы', hay: 'Поле сена', hops: 'Поле хмеля' };

// Мазок инструмента: первая клетка решает режим — по пустой закладываем поля, по полю — убираем
function fieldStroke(t, first) {
  const tool = Game.tool;
  if (!tool || tool.kind !== 'field' || !inb(t[0], t[1])) return;
  const key = t.join();
  if (!first && key === Input.lastFieldTile) return;
  Input.lastFieldTile = key;
  const o = World.obj[idx(t[0], t[1])];
  if (first) Input.fieldMode = o && o.t === 'field' ? 'del' : 'add';
  if (Input.fieldMode === 'del') { removeField(t[0], t[1]); return; }
  if (Input.fieldMode === 'add') { const err = planField(t[0], t[1], tool.crop); if (err && first) toast(err); }
}

// Свободный работяга помогает фермерам: жнёт созревшее поле и сам несёт урожай на ферму.
function* helpHarvestGen(u, i) {
  const o = World.obj[i], x = i % MAP_W, y = (i / MAP_W) | 0;
  u.helpField = -1;
  const b = o && o.t === 'field' && o.farm ? Game.buildings.find(q => q.id === o.farm) : null;
  if (!b || b.removed || o.g < 1) { if (o) o.res = false; return; }
  const ok = yield { walk: [x, y], offroad: true };
  if (!ok || World.obj[i] !== o || o.g < 1) { if (World.obj[i] === o) o.res = false; return; }
  const hopCrop = o.crop === 'hops';
  u.vdir = 'E'; u.face = x + 0.5 > u.x ? 1 : -1;
  for (let k = 0; k < 4; k++) fxLater(0.45 + k * 0.95, () => harvestFx(x, y, o.crop));
  yield { wait: 4, anim: hopCrop ? 'hoppick' : 'reap' };
  let extra = false;
  if (World.obj[i] !== o) return;
  o.g = -1; o.res = false;
  extra = !!o.ash; o.ash = false;
  const crop = o.crop;
  u.carry = crop; u.carryN = 1;
  const ok2 = yield { walk: [b.doorX, b.doorY] };
  if (b.removed || !ok2 || !u.carry) { if (u.carry) dropPile(Math.floor(u.x), Math.floor(u.y), crop, 1); u.carry = null; return; }
  const n = extra ? 5 : 3;
  for (let k = 0; k < n; k++) if (k === 0 || !outFull(b, crop)) gather(b, crop);
  const hay = (crop === 'hops' ? 1 : extra ? 3 : 2) + (typeof seaHayBonus === 'function' ? seaHayBonus(crop) : 0);   // осенью солому вяжут в снопы на зиму
  for (let k = 0; k < hay; k++) if (!outFull(b, 'hay')) gather(b, 'hay');
  u.carry = null; u.carryN = 0;
  floater(b.doorX + 0.5, b.doorY - 0.5, 'Помог с урожаем', '#e8d890');
  yield { wait: 0.5 };
}
