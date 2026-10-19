'use strict';
// Торговля: Торговый пост, караваны с дороги за краем карты, обмен товаров на золото по плавающим ценам,
// события (грабители, редкий товар, сдвиги цен), вкладка «Торговля». Описание — в ТОРГОВЛЯ.md.
// Состояние — Game.trade (пишется в сохранение; в коопе его считает сервер, клиентам уходит зеркало mir.trade).
// Код подключается обёртками (step, resetGameState, serializeGame, applySave, updateUI), чужие файлы не трогает.
//
// Интерфейс для «Ярмарки» и «Врага»:
//   tradeQuote(good, 'sell'|'buy')  — текущая цена за штуку (sell — сколько заплатят нам, buy — сколько просят с нас);
//   tradeStoreTake(g, n) / tradeStoreGive(g, n) / tradeGold() — единый доступ к складам;
//   fairOn() (если есть) — на ярмарке караван приходит сразу, с большим запасом и выгоднее;
//   Game.foe.stage >= 3 — караваны ходят реже, грабители чаще (магические камни не торгуются вовсе).

const TR_BASE = {                // базовая цена, золота за штуку (≈ 1 золото на 20–30 с труда по цепочке)
  trunk: 0.5, timber: 1, stone: 1, wheat: 0.6, hay: 0.4, hops: 0.9, flour: 1.2, bread: 1.6, beer: 2.2, pig: 3, sausage: 3.2,
  hide: 1.6, leather: 2.6, leatherArmor: 6, goldore: 2.6, ironore: 2.2, iron: 4.2, sword: 12, bow: 9, dagger: 8, ironArmor: 16,
  mana: 5, staff: 14, mageArmor: 18, darkbeer: 3.6, steak: 4, croissant: 3, chicken: 2.2,
};
const TR_RARE = ['ironArmor', 'sword', 'staff', 'mageArmor', 'mana', 'darkbeer', 'steak'];
const TR_SELL = 0.72;            // нам платят столько от цены рынка
const TR_BUY = 1.38;             // с нас просят столько от цены рынка
const TR_RARE_K = 1.7;
const TR_MULT_MIN = 0.7, TR_MULT_MAX = 1.5;
const TR_STAY = 110;             // сколько стоит караван у поста, с
const TR_SPEED = 1.9;            // клеток в секунду
const TR_AMBUSH_T = 45;          // сколько у героя времени отбить грабителей, с
const TR_GROUPS = {
  farm:   { name: 'Хлебный обоз',        sells: ['bread', 'flour', 'wheat', 'hay', 'hops', 'beer', 'sausage', 'pig', 'croissant'], wants: ['timber', 'stone', 'trunk', 'leather', 'hide', 'goldore'], lvl: 0 },
  wander: { name: 'Бродячий торговец',   sells: ['hide', 'leather', 'stone', 'timber', 'beer', 'chicken', 'hops', 'steak'], wants: ['bread', 'wheat', 'beer', 'sausage', 'pig', 'flour'], lvl: 0 },
  smith:  { name: 'Железный караван',    sells: ['iron', 'ironore', 'sword', 'bow', 'dagger', 'leatherArmor', 'ironArmor'], wants: ['bread', 'beer', 'sausage', 'timber', 'leather', 'hide', 'trunk'], lvl: 1 },
  mage:   { name: 'Караван чародеев',    sells: ['mana', 'staff', 'mageArmor', 'darkbeer', 'steak', 'croissant'], wants: ['goldore', 'iron', 'leather', 'bread', 'beer', 'stone'], lvl: 2 },
};
const TR_EVENTS = [
  { id: 'famine', name: 'Неурожай в округе', goods: ['bread', 'flour', 'wheat', 'sausage', 'pig', 'beer'], f: 1.45, text: 'Неурожай в округе: еда дорожает' },
  { id: 'glut',   name: 'Урожайный год',     goods: ['bread', 'wheat', 'hay', 'hops', 'beer'], f: 0.65, text: 'Урожайный год: еда дешевеет' },
  { id: 'war',    name: 'Слухи о войне',     goods: ['sword', 'bow', 'dagger', 'ironArmor', 'leatherArmor', 'iron'], f: 1.4, text: 'Слухи о войне: оружие и доспехи в цене' },
  { id: 'boom',   name: 'Стройка в округе',  goods: ['timber', 'stone', 'trunk'], f: 1.4, text: 'Соседи строятся: доски и камень в цене' },
  { id: 'mages',  name: 'Мода на волшебство', goods: ['mana', 'staff', 'mageArmor', 'goldore'], f: 1.35, text: 'В моде волшебство: ману и посохи берут охотно' },
];
const TR_TIP_OK = ['Караван отбился от грабителей и дошёл целым', 'Дорога свободна', 'Колёса скрипят, но тащатся'];

// ---------- Состояние ----------

function trEnsure() {
  if (!Game.trade) Game.trade = { mult: {}, next: -1, car: null, traded: 0, sold: 0, bought: 0, inc: 0, exp: 0, ev: null, evNext: 0, n: 0, mT: 0, seq: 0, fairDone: -1 };
  return Game.trade;
}
const trServer = () => typeof coop !== 'undefined' && !!coop && !!coop.out;
const trMirror = () => typeof Coop !== 'undefined' && !!Coop.mirror;
function trSay(text) { if (trServer()) coop.out.push({ msg: { t: 'toast', text } }); else if (typeof toast === 'function') toast(text); }
function trLog(text, x, y) { if (typeof logEvent === 'function') logEvent('trade', text, x, y); }
const trRand = (a, b) => a + Math.random() * (b - a);
const trInt = (a, b) => Math.floor(trRand(a, b + 1));
function trPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function trShuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function tradePost() { return Game.buildings.find(b => b.type === 'tradepost' && b.state === 'done' && !b.removed) || null; }
function tradeLevel() { const T = Game.trade; return T ? Math.min(5, Math.floor(Math.sqrt((T.traded || 0) / 50))) : 0; }
const TR_RANKS = ['Лавочка', 'Торговый пост', 'Рынок', 'Торговый дом', 'Гильдия купцов', 'Вольный город'];
function tradeRank() { return TR_RANKS[tradeLevel()]; }

// ---------- Цены ----------

function trMult(g) {
  const T = trEnsure();
  let m = T.mult[g] == null ? 1 : T.mult[g];
  const e = T.ev;
  if (e && Game.time < e.until && e.goods.includes(g)) m *= e.f;
  return m;
}
// Цена за штуку. sell — сколько заплатят нам, buy — сколько просят с нас. k — наценка именно этого товара у купца.
function tradeQuote(g, side, k = 1) {
  const b = TR_BASE[g];
  if (b == null) return 0;
  const car = Game.trade && Game.trade.car;
  const fair = car && car.fair ? 0.92 : 1;
  const m = trMult(g);
  return side === 'sell' ? b * m * TR_SELL * k / fair : b * m * TR_BUY * k * fair;
}
const trFmt = v => (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10);

// ---------- Склады ----------

function tradeGold() { return tradeHave('gold'); }
function tradeHave(g) { let n = 0; for (const s of Game.buildings) if (s.isStore()) n += Math.max(0, s.offer(g)); return n; }
function tradeStoreTake(g, n) {
  let left = n;
  for (const s of Game.buildings) { if (!left) break; if (!s.isStore()) continue; const t = Math.min(left, Math.max(0, s.offer(g))); s.stock[g] -= t; left -= t; }
  return n - left;
}
function tradeStoreGive(g, n) {
  const p = tradePost();
  const stores = Game.buildings.filter(s => s.isStore());
  if (!stores.length || n <= 0) return 0;
  if (p) stores.sort((a, b) => Math.hypot(a.doorX - p.doorX, a.doorY - p.doorY) - Math.hypot(b.doorX - p.doorX, b.doorY - p.doorY));
  stores[0].stock[g] += n;
  return n;
}

// ---------- Караван ----------

function trEdgeCells(post) {
  const out = [];
  const W = MAP_W, H = MAP_H;
  for (let i = 0; i < 40; i++) {
    const side = i % 4, t = Math.floor(trRand(4, (side % 2 ? H : W) - 4));
    const x = side === 0 ? t : side === 1 ? W - 2 : side === 2 ? t : 1;
    const y = side === 0 ? 1 : side === 1 ? t : side === 2 ? H - 2 : t;
    if (inb(x, y) && isWalkable(x, y) && Math.hypot(x - post.doorX, y - post.doorY) > 24) out.push([x, y]);
  }
  return trShuffle(out);
}

function trRoute(post) {
  const gx = post.doorX, gy = post.doorY + 1;
  const goal = isWalkable(gx, gy) ? [gx, gy] : [post.doorX, post.doorY];
  for (const [sx, sy] of trEdgeCells(post).slice(0, 8)) {
    const p = findPath(sx, sy, goal[0], goal[1], false, 0, 14000, 0.9);
    if (p && p.length > 6) return [[sx, sy], ...p];
  }
  // пути нет (лес, вода) — караван идёт напрямик от края карты: гномам не жалко
  const cells = trEdgeCells(post);
  const [sx, sy] = cells.length ? cells[0] : [1, 1];
  const n = Math.max(8, Math.round(Math.hypot(goal[0] - sx, goal[1] - sy)));
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push([+(sx + (goal[0] - sx) * i / n).toFixed(2), +(sy + (goal[1] - sy) * i / n).toFixed(2)]);
  return pts;
}

function trMakeWares(kind, fair, rare) {
  const G = TR_GROUPS[kind], lvl = tradeLevel(), boost = fair ? 1.4 : 1;
  const sells = {}, wants = {};
  for (const g of trShuffle(G.sells).slice(0, 3 + (lvl >= 2 ? 1 : 0))) {
    const pricey = TR_BASE[g] >= 8;
    sells[g] = { n: Math.max(1, Math.round((pricey ? trInt(1, 3) : trInt(4, 12)) * boost)), k: TR_RARE.includes(g) && TR_BASE[g] >= 5 ? 1.25 : 1 };
  }
  if (rare) { sells[rare] = { n: trInt(1, 2), k: TR_RARE_K }; }
  // что покупает купец — в первую очередь то, что у нас лежит на складе
  const have = G.wants.filter(g => tradeHave(g) > 0);
  const pool = trShuffle(have).concat(trShuffle(G.wants.filter(g => !have.includes(g))));
  for (const g of pool.slice(0, 4)) wants[g] = { n: Math.round(trInt(8, 22) * boost), k: trRand(1, 1.18) };
  return { sells, wants };
}

function trSpawnCaravan(post) {
  const T = trEnsure(), lvl = tradeLevel();
  const fair = typeof fairOn === 'function' && fairOn();
  const kinds = Object.keys(TR_GROUPS).filter(k => TR_GROUPS[k].lvl <= lvl);
  let kind = trPick(kinds);
  if (T.n === 0) kind = 'farm';                                 // первый караван всегда хлебный: знакомство с торговлей
  const foe = Game.foe && Game.foe.stage >= 3;
  const r = Math.random();
  const robbers = !fair && T.n > 0 && r < (foe ? 0.35 : 0.2);
  const rare = !robbers && T.n > 0 && Math.random() < 0.22 + lvl * 0.04 ? trPick(TR_RARE) : null;
  const route = trRoute(post);
  const W = trMakeWares(kind, fair, rare);
  const car = {
    id: ++T.seq, kind, name: TR_GROUPS[kind].name, st: 'in', x: route[0][0] + 0.5, y: route[0][1] + 0.5, f: 1, pi: 0, route,
    stay: TR_STAY + lvl * 12 + (fair ? 40 : 0), sells: W.sells, wants: W.wants, rare, fair: !!fair,
    purse: Math.round((50 + lvl * 30 + Math.min(80, Game.units.length * 2)) * (fair ? 1.5 : 1)),
    amb: robbers ? { at: Math.floor(route.length * trRand(0.3, 0.5)), t: TR_AMBUSH_T, done: false } : null, robbed: false, ww: 0,
  };
  T.car = car;
  T.n++;
  trLog(`Караван «${car.name}» вышел на дорогу и скоро будет у поста`, post.doorX + 0.5, post.doorY);
  trSay(`Пыль на дороге: идёт караван «${car.name}»`);
  return car;
}

function trAfterCaravan(T) {
  const lvl = tradeLevel(), foe = Game.foe && Game.foe.stage >= 3;
  T.car = null;
  T.next = Game.time + (trRand(110, 180) - lvl * 10) * (foe ? 1.4 : 1);
}

function trHeroNear(car, r) {
  for (const u of Game.units) {
    if (u.dead) continue;
    if (u.type !== 'hero' && !(UNIT_TYPES[u.type] && UNIT_TYPES[u.type].recruit)) continue;
    if (Math.hypot(u.x - car.x, u.y - car.y) <= r) return true;
  }
  return false;
}

function trRobbed(car) {
  car.robbed = true;
  car.purse = Math.floor(car.purse * 0.5);
  for (const g in car.sells) { car.sells[g].n = Math.floor(car.sells[g].n * 0.4); if (car.sells[g].n <= 0) delete car.sells[g]; }
  car.rare = null;
  trLog(`Грабители опустошили караван «${car.name}» — он всё же дошёл, но с половиной товара`, car.x, car.y);
  trSay('Грабители разбили караван! Купец дошёл с остатками товара');
}

function trMoveCaravan(T, car, dt, post) {
  const route = car.route, dir = car.st === 'out' ? -1 : 1;
  let step = TR_SPEED * dt;
  while (step > 0) {
    const ni = car.pi + dir;
    if (ni < 0 || ni >= route.length) break;
    const tx = route[ni][0] + 0.5, ty = route[ni][1] + 0.5, d = Math.hypot(tx - car.x, ty - car.y);
    if (d <= step) { car.x = tx; car.y = ty; car.pi = ni; step -= d; } else { car.x += (tx - car.x) / d * step; car.y += (ty - car.y) / d * step; step = 0; }
    if (Math.abs(tx - car.x) > 0.01) car.f = tx > car.x ? 1 : -1;
    if (car.st === 'in' && car.amb && !car.amb.done && car.pi >= car.amb.at) { car.st = 'ambush'; return; }
  }
  if (car.st === 'in' && car.pi >= route.length - 1) {
    car.st = 'stay'; car.ww = 0;
    trLog(`Караван «${car.name}» встал у Торгового поста — обмен открыт`, post.doorX + 0.5, post.doorY);
    trSay(`Караван «${car.name}» у поста! Откройте вкладку «Торговля»`);
  } else if (car.st === 'out' && car.pi <= 0) trAfterCaravan(T);
}

function trPriceDrift(T) {
  for (const g in TR_BASE) {
    let m = T.mult[g] == null ? 1 : T.mult[g];
    m += (1 - m) * 0.14 + trRand(-0.07, 0.07);
    T.mult[g] = Math.max(TR_MULT_MIN, Math.min(TR_MULT_MAX, m));
  }
  if (T.ev && Game.time >= T.ev.until) { trLog(`Сдвиг цен кончился: «${T.ev.name}» позади`); T.ev = null; }
  if (!T.ev && Game.time >= T.evNext) {
    T.evNext = Game.time + trRand(500, 900);
    if (T.evNext > 0 && Math.random() < 0.7) {
      const e = trPick(TR_EVENTS);
      T.ev = { id: e.id, name: e.name, goods: e.goods, f: e.f, until: Game.time + trRand(240, 420), text: e.text };
      trLog(e.text); trSay(e.text);
    }
  }
}

function tradeTick(dt) {
  const T = Game.trade;
  const post = tradePost();
  if (!T && !post) return;
  trEnsure();
  const t = Game.trade;
  t.mT = (t.mT || 0) + dt;
  if (t.mT >= 60) { t.mT = 0; trPriceDrift(t); }
  if (!post) {                                    // пост снесли — караван разворачивается и уходит
    if (t.car && t.car.st !== 'out') { t.car.st = 'out'; }
    if (t.car) trMoveCaravan(t, t.car, dt, { doorX: 0, doorY: 0 });
    return;
  }
  if (t.next < 0) { t.next = Game.time + trRand(50, 80); t.evNext = Game.time + 400; }
  const car = t.car;
  if (!car) {
    const fair = typeof fairOn === 'function' && fairOn();
    if (fair && t.fairDone !== (Game.fair && Game.fair.id)) { t.fairDone = Game.fair && Game.fair.id; t.next = Math.min(t.next, Game.time + 20); }
    if (Game.time >= t.next && !isNightNow() && !isEveningNow()) trSpawnCaravan(post);
    return;
  }
  if (car.st === 'in' || car.st === 'out') trMoveCaravan(t, car, dt, post);
  else if (car.st === 'ambush') {
    car.amb.t -= dt;
    if (trHeroNear(car, 8)) {
      car.amb.done = true; car.st = 'in';
      car.purse += 25; if (!car.rare && Math.random() < 0.6) { const g = trPick(TR_RARE); car.sells[g] = { n: 1, k: 1.15 }; car.rare = g; }
      t.traded += 30;
      trLog('Грабителей прогнали! Купец благодарен: прибавил в кошель и достал редкость', car.x, car.y);
      trSay('Грабителей разогнали! Купец в благодарность открыл особый товар');
    } else if (car.amb.t <= 0) { car.amb.done = true; car.st = 'in'; trRobbed(car); }
  } else if (car.st === 'stay') {
    car.ww += dt; car.stay -= dt;
    if (car.stay <= 0 || isEveningNow()) {
      car.st = 'out';
      trLog(`Караван «${car.name}» собрался и уехал по дороге за край карты`, post.doorX + 0.5, post.doorY);
    }
  }
}

// ---------- Сделки ----------

// side 'sell' — мы продаём купцу, 'buy' — мы покупаем у купца. Возвращает {ok, text}.
function tradeDo(side, g, n) {
  const T = Game.trade, car = T && T.car;
  n = Math.floor(n);
  if (!car || car.st !== 'stay') return { ok: false, text: 'Каравана у поста нет' };
  if (!(n > 0) || TR_BASE[g] == null) return { ok: false, text: 'Нечего менять' };
  if (side === 'sell') {
    const w = car.wants[g];
    if (!w) return { ok: false, text: 'Этот купец такое не берёт' };
    n = Math.min(n, w.n, tradeHave(g));
    if (n <= 0) return { ok: false, text: `На складе нет: ${GOODS[g].name}` };
    let total = 0, done = 0;
    for (let i = 0; i < n; i++) {
      const p = tradeQuote(g, 'sell', w.k);
      if (total + p > car.purse + 0.5) break;
      total += p; done++;
      T.mult[g] = Math.max(0.6, (T.mult[g] == null ? 1 : T.mult[g]) - 0.012);
    }
    if (!done) return { ok: false, text: 'У купца не хватает денег' };
    const gold = Math.max(1, Math.round(total));
    tradeStoreTake(g, done);
    tradeStoreGive('gold', gold);
    car.purse = Math.max(0, car.purse - gold); w.n -= done; if (w.n <= 0) delete car.wants[g];
    T.sold += done; T.inc += gold; T.traded += gold; T.seq2 = (T.seq2 || 0) + 1;
    return { ok: true, text: `Продано: ${GOODS[g].name} ×${done} за ${gold} зол.`, gold, done };
  }
  const s = car.sells[g];
  if (!s) return { ok: false, text: 'У купца этого нет' };
  n = Math.min(n, s.n);
  let total = 0, done = 0;
  const have = tradeGold();
  for (let i = 0; i < n; i++) {
    const p = tradeQuote(g, 'buy', s.k);
    if (Math.ceil(total + p) > have) break;
    total += p; done++;
    T.mult[g] = Math.min(TR_MULT_MAX + 0.1, (T.mult[g] == null ? 1 : T.mult[g]) + 0.015);
  }
  if (!done) return { ok: false, text: 'Не хватает золота на складе' };
  const gold = Math.max(1, Math.ceil(total));
  tradeStoreTake('gold', gold);
  tradeStoreGive(g, done);
  car.purse += gold; s.n -= done; if (s.n <= 0) delete car.sells[g];
  T.bought += done; T.exp += gold; T.traded += gold;
  return { ok: true, text: `Куплено: ${GOODS[g].name} ×${done} за ${gold} зол.`, gold, done };
}

// Команда игрока: в одиночной игре исполняем сами, у клиента кооп-сервера — отправляем серверу
function tradeCmd(side, g, n) {
  if (trMirror()) { coopSend({ t: 'trade', side, g, n }); return; }
  const r = tradeDo(side, g, n);
  if (typeof toast === 'function') toast(r.text);
  if (r.ok && typeof updateUI === 'function') updateUI(true);
}

// ---------- Зеркало для кооп-клиентов ----------

function tradeMirrorOut() {
  const T = Game.trade;
  if (!T) return null;
  const o = { mult: T.mult, next: T.next, traded: T.traded, sold: T.sold, bought: T.bought, inc: T.inc, exp: T.exp, ev: T.ev, n: T.n, car: null };
  const c = T.car;
  if (c) o.car = { id: c.id, kind: c.kind, name: c.name, st: c.st, x: c.x, y: c.y, f: c.f, stay: c.stay, sells: c.sells, wants: c.wants, rare: c.rare, fair: c.fair, purse: c.purse, robbed: c.robbed, amb: c.amb ? { t: c.amb.t, done: c.amb.done } : null };
  return o;
}
function tradeMirrorIn(m) {
  if (!m) { Game.trade = null; return; }
  const prev = Game.trade;
  Game.trade = Object.assign(prev || {}, m);
  if (m.car && prev && prev.car && prev.car.id === m.car.id) Game.trade.car = Object.assign(prev.car, m.car);
  if (Game.trade.car && Game.trade.car.x != null) { const v = TRVIS; if (v.id !== Game.trade.car.id) { v.id = Game.trade.car.id; v.x = Game.trade.car.x; v.y = Game.trade.car.y; } }
}
const TRVIS = { id: 0, x: 0, y: 0, ph: 0 };

// ---------- Подключение к игре ----------

if (typeof BUILDINGS !== 'undefined' && !BUILDINGS.tradepost) {
  BUILDINGS.tradepost = {
    name: 'Торговый пост', cat: 'Основа', w: 3, h: 3, top: 62, cost: { timber: 8, stone: 6 }, wideDoor: true,
    desc: 'Сюда по дороге из-за края карты приходят караваны. Меняйте излишки на золото, берите чужое по честной цене. Нужен склад с золотом.',
  };
  BUILD_ORDER.push('tradepost');
  UNLOCKS.push({ id: 'trade', items: ['tradepost'], after: ['bakery'] });
  if (typeof DESCS !== 'undefined') DESCS.tradepost = [BUILDINGS.tradepost.desc, BUILDINGS.tradepost.desc];
  if (typeof SIGN_OF !== 'undefined') SIGN_OF.tradepost = 'coin';
}
if (typeof LOG_KINDS !== 'undefined') { LOG_KINDS.trade = { icon: 'trade', name: 'Торговля' }; LOG_GROUP.trade = 'life'; }
if (typeof ICON_GRIDS !== 'undefined') {
  ICON_GRIDS.ui.trade = { pal: { o: '#4a2c10', g: '#ffd24a', G: '#c8901c', s: '#fff4b0', b: '#8a5a30', B: '#b8844e', r: '#8a2a20' }, rows: [
    '................',
    '......oooo......',
    '.....obBBbo.....',
    '......orro......',
    '.....obBBbo.....',
    '....obBBBBbo....',
    '...obBBBBBBbo.oo',
    '...obBBggBBbooGo',
    '...obBBgsgBbogso',
    '...obBBGGGBboGGo',
    '...obBBBBBBbo.oo',
    '....obBBBBbo.oGo',
    '.....obbbbo..ogo',
    '......oooo...ooo',
    '................',
    '................'] };
}
if (typeof signIcon === 'function') {
  const _si = signIcon;
  signIcon = function (c, cx, cy, kind) {
    if (kind === 'coin') {
      ellipse(c, cx, cy, 3.6, 3.6, '#7a5410'); ellipse(c, cx, cy, 3, 3, '#ffd24a'); ellipse(c, cx - 0.6, cy - 0.6, 1.2, 1.2, '#fff4b0');
      c.fillStyle = '#9a6a14'; c.fillRect(cx - 0.4, cy - 1.8, 0.8, 3.6);
    } else _si(c, cx, cy, kind);
  };
}
if (typeof MODELS !== 'undefined') {
  MODELS.tradepost = function (m) {
    m.box({
      x0: 6, x1: 66, y0: 24, y1: 62, h: 22, wall: 'plank', col: '#8a6238', beam: '#3a2414', lowerStone: 6,
      roof: { type: 'gable', axis: 'X', rise: 18, mat: 'tiles', col: '#a8402c', ov: 6 },
      decor: {
        S: [{ t: 'door', main: true, w: 16, h: 18, o: { double: true, braces: true, square: true, col: '#6a4424' } },
          { t: 'hatch', at: 14, z: 9, w: 9, h: 7 }, { t: 'hatch', at: 52, z: 9, w: 9, h: 7 }],
        E: [{ t: 'win', at: 30, z: 10, w: 6, h: 6 }], W: [],
      },
      dormers: [{ x: 26, w: 13, h: 9, o: { lit: true } }],
    });
    m.prop((c, x, y) => cart(c, x, y, null), 78, 8);
    m.prop((c, x, y) => barrel(c, x, y), 72, 54);
    m.prop((c, x, y) => crate(c, x, y), 84, 52);
    m.prop((c, x, y) => sack(c, x, y, '#e6c24a'), 3, 66);
    m.prop((c, x, y) => sack(c, x, y, '#a8c060'), 11, 68);
    m.prop((c, x, y) => lantern(c, x, y), 2, 28);
  };
}

if (typeof step === 'function') {
  const _step = step;
  step = function (dt) { _step(dt); if (!trMirror()) tradeTick(dt); };
  const _rgs = resetGameState;
  resetGameState = function () { _rgs(); Game.trade = null; };
  const _sg = serializeGame;
  serializeGame = function () { const s = _sg(); if (Game.trade) s.trade = Game.trade; return s; };
  const _as = applySave;
  applySave = function (s) { _as(s); Game.trade = s.trade || null; if (Game.trade && Game.trade.car && !Game.trade.car.route) Game.trade.car = null; };
}

// ---------- Рисунок каравана ----------

function trDrawGnome(c, x, y, f, body, hat, walk, bob) {
  const b = bob || 0;
  c.fillStyle = '#2a1c10'; c.fillRect(x - 3 + (walk ? 1 : 0), y - 3, 2, 3); c.fillRect(x + 1 - (walk ? 1 : 0), y - 3, 2, 3);
  c.fillStyle = body; c.fillRect(x - 3, y - 9 + b, 6, 7);
  c.fillStyle = '#e8b890'; c.fillRect(x - 2, y - 13 + b, 4, 4);
  c.fillStyle = '#f0ece0'; c.fillRect(x - 2, y - 10 + b, 4, 3);
  c.fillStyle = hat; c.fillRect(x - 3, y - 15 + b, 6, 3); c.fillRect(x - 2, y - 17 + b, 4, 2);
  c.fillStyle = '#1a1208'; c.fillRect(x + (f > 0 ? 0 : -2), y - 12 + b, 1, 1);
}
function trDrawMule(c, x, y, f, ph) {
  const s = f > 0 ? 1 : -1, leg = Math.sin(ph) * 1.6;
  c.fillStyle = 'rgba(10,8,4,0.32)'; c.beginPath(); c.ellipse(x, y, 12, 3.5, 0, 0, 7); c.fill();
  c.fillStyle = '#4a3a2c';
  c.fillRect(x - 6 * s - 1, y - 7, 2, 7 + leg * 0.2); c.fillRect(x + 4 * s - 1, y - 7, 2, 7 - leg * 0.2);
  c.fillStyle = '#7a6552'; c.fillRect(x - 8, y - 13, 16, 7);
  c.fillStyle = '#8c765f'; c.fillRect(x - 8, y - 13, 16, 2);
  c.fillStyle = '#7a6552'; c.fillRect(x + 6 * s - (s < 0 ? 4 : 0), y - 17, 4, 7); c.fillRect(x + 8 * s - (s < 0 ? 5 : 0), y - 17, 5, 4);
  c.fillStyle = '#4a3a2c'; c.fillRect(x + 8 * s - (s < 0 ? 2 : 0), y - 20, 1.5, 4);
  c.fillStyle = '#b8452c'; c.fillRect(x - 5, y - 13, 6, 2);                 // попона
  c.fillStyle = '#e8d8a0'; c.fillRect(x + 11 * s - 0.5, y - 15, 1, 1);
}
function trDrawCart(c, x, y, f, loaded, ph) {
  const s = f > 0 ? -1 : 1, cx = x + s * 17;
  c.fillStyle = 'rgba(10,8,4,0.3)'; c.beginPath(); c.ellipse(cx, y, 13, 3.5, 0, 0, 7); c.fill();
  c.fillStyle = '#6a4424'; c.fillRect(cx - 11, y - 11, 22, 7);
  c.fillStyle = '#8a5a30'; c.fillRect(cx - 11, y - 11, 22, 2);
  if (loaded) {                                                                  // парусиновый верх
    c.fillStyle = '#e8dcc0'; c.beginPath(); c.moveTo(cx - 10, y - 11); c.quadraticCurveTo(cx, y - 25, cx + 10, y - 11); c.closePath(); c.fill();
    c.fillStyle = '#b8452c'; for (let k = -6; k <= 6; k += 6) c.fillRect(cx + k - 1, y - 20 + Math.abs(k) * 0.3, 2, 9 - Math.abs(k) * 0.3);
  }
  c.fillStyle = '#2a1c10';
  for (const wx of [-7, 7]) { c.beginPath(); c.arc(cx + wx, y - 3, 4.2, 0, 7); c.fill(); }
  c.fillStyle = '#9a7a4a';
  for (const wx of [-7, 7]) { c.save(); c.translate(cx + wx, y - 3); c.rotate(ph * 0.6 * -s); c.fillRect(-0.5, -3.4, 1, 6.8); c.fillRect(-3.4, -0.5, 6.8, 1); c.restore(); }
  c.fillStyle = '#6a4424'; c.fillRect(Math.min(x, cx) + (s < 0 ? 4 : 2), y - 8, 12, 1.4);                     // дышло
}
function trDrawRobber(c, x, y, f, t, flee) {
  const sw = flee ? Math.sin(t * 14) * 1.5 : 0;
  c.fillStyle = 'rgba(10,8,4,0.3)'; c.beginPath(); c.ellipse(x, y, 5, 1.8, 0, 0, 7); c.fill();
  c.fillStyle = '#1e1e26'; c.fillRect(x - 3, y - 9, 6, 7); c.fillRect(x - 3 + sw, y - 3, 2, 3); c.fillRect(x + 1 - sw, y - 3, 2, 3);
  c.fillStyle = '#c8a078'; c.fillRect(x - 2, y - 13, 4, 4);
  c.fillStyle = '#12121a'; c.fillRect(x - 2, y - 12, 4, 2);                                   // маска
  c.fillStyle = '#8a1c22'; c.fillRect(x - 3, y - 15, 6, 2);                                   // косынка
  c.fillStyle = '#6a4a2a'; c.fillRect(x + 3 * f, y - 12 - (flee ? 0 : Math.sin(t * 6) * 2), 2, 8);   // дубина
}

function tradeDrawList(list, c, x0, y0, x1, y1) {
  const T = Game.trade, car = T && T.car;
  if (!car || car.x == null) return;
  const mirror = trMirror();
  if (mirror) { const v = TRVIS; v.x += (car.x - v.x) * 0.2; v.y += (car.y - v.y) * 0.2; }
  const px = (mirror ? TRVIS.x : car.x), py = (mirror ? TRVIS.y : car.y);
  if (px < x0 - 3 || px > x1 + 3 || py < y0 - 3 || py > y1 + 4) return;
  const moving = car.st === 'in' || car.st === 'out';
  const ph = moving ? Game.time * 7 : 0;
  list.push([py + 0.3 + (car.st === 'stay' ? 1.6 : 0), () => {   // у поста стоит поверх соседних зданий, чтобы не прятаться за складом
    const X = Math.round(px * TILE), Y = Math.round(py * TILE + 6), f = car.f || 1;
    c.save();
    trDrawCart(c, X, Y, f, true, ph);
    trDrawMule(c, X, Y, f, ph);
    trDrawGnome(c, X + (car.st === 'stay' ? -f * 4 : -f * 0), Y + 7, f, '#3a5a82', '#b8452c', moving && Math.sin(ph) > 0, 0);
    if (car.st === 'stay') {
      const bob = Math.sin(Game.time * 3) * 2;
      c.drawImage(iconCanvas('good', 'gold'), X - 9, Y - 52 + bob, 18, 18);
    }
    if (car.st === 'ambush') {
      for (let k = 0; k < 3; k++) trDrawRobber(c, X + (k - 1) * 14 + 24 * f, Y + 4 + (k % 2) * 6, -f, Game.time + k, false);
      c.fillStyle = '#e03a2a'; c.font = 'bold 16px sans-serif'; c.textAlign = 'center'; c.fillText('!', X, Y - 40 + Math.sin(Game.time * 8) * 2);
    }
    c.restore();
  }]);
}

// ---------- Вкладка «Торговля» ----------

const TRUI = { open: {} };
const trEsc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const trIcon = g => (typeof gi === 'function' ? gi(g) : '');
function trTrend(g) {
  const m = trMult(g);
  const d = Math.round((m - 1) * 100);
  if (Math.abs(d) < 4) return '<span class="tr-flat">•</span>';
  return d > 0 ? `<span class="tr-up">▲${d}%</span>` : `<span class="tr-dn">▼${-d}%</span>`;
}

function tradeHTML() {
  const T = Game.trade, post = tradePost();
  const gold = tradeGold();
  let h = `<div class="tr-head"><div class="tr-gold">${trIcon('gold')}<b>${gold}</b><span class="muted small">золота на складах</span></div><div class="tr-rank">${trEsc(tradeRank())}<span class="muted small"> · оборот ${T ? Math.round(T.traded) : 0}</span></div></div>`;
  if (!post) {
    return h + `<div class="tr-card"><b>Торговых путей пока нет.</b><div class="muted small">Постройте «Торговый пост» (вкладка «Основа»). Караваны придут по дороге из-за края карты и будут менять товары на золото. Цены у купцов плавают: продавайте излишки, пока дорого.</div></div>` + trMarketHTML();
  }
  const car = T && T.car;
  if (T && T.ev && Game.time < T.ev.until) h += `<div class="tr-event">${trEsc(T.ev.text)} · ещё ~${Math.max(1, Math.round((T.ev.until - Game.time) / 60))} мин</div>`;
  if (!car) {
    const left = Math.max(0, Math.round(((T ? T.next : 0) - Game.time)));
    const night = isNightNow() || isEveningNow();
    h += `<div class="tr-card"><b>Караван в пути</b><div class="muted small">${T && T.next < 0 ? 'Первый караван скоро выйдет на дорогу' : night ? 'Ночью по дорогам не ходят — караван придёт утром' : `Следующий примерно через ${left} с (${Math.max(1, Math.round(left / 60))} мин)`}</div>
      <div class="muted small">Тем временем накопите товаров: купцы берут то, что лежит на складе. Нужен склад с золотом для покупок.</div></div>`;
    return h + trMarketHTML();
  }
  const where = car.st === 'in' ? 'идёт к посту' : car.st === 'out' ? 'уезжает' : car.st === 'ambush' ? 'ЗАСАДА!' : `стоит ещё ${Math.max(1, Math.round(car.stay))} с`;
  h += `<div class="tr-card tr-car ${car.st}"><div class="tr-ct"><b>${trEsc(car.name)}</b>${car.fair ? ' <span class="tr-fair">ярмарка</span>' : ''}<span class="tr-where">${where}</span></div>
    <div class="muted small">Кошель купца: <b>${Math.round(car.purse)}</b> зол.${car.robbed ? ' · его ограбили' : ''}</div>
    ${car.st === 'ambush' ? `<div class="tr-warn">На караван напали грабители! Отправьте героя или бойцов гильдии к повозке — у них ~${Math.max(1, Math.round(car.amb ? car.amb.t : 0))} с. <button data-tr="focus">Показать на карте</button></div>` : ''}
    ${car.st === 'in' || car.st === 'out' ? '<button data-tr="focus">Показать на карте</button>' : ''}</div>`;
  if (car.st !== 'stay') return h + trMarketHTML();
  h += '<div class="group-title">Купец продаёт</div>';
  const sk = Object.keys(car.sells);
  if (!sk.length) h += '<div class="muted small">Прилавок пуст.</div>';
  for (const g of sk) {
    const s = car.sells[g], p = tradeQuote(g, 'buy', s.k), rare = s.k >= 1.6 || (car.rare === g);
    h += `<div class="tr-row${rare ? ' rare' : ''}"><div class="tr-g">${trIcon(g)}<div><div>${GOODS[g].name}${rare ? ' <span class="tr-star">редкость</span>' : ''}</div><div class="muted small">осталось ${s.n} · ${trTrend(g)}</div></div></div>
      <div class="tr-p">${trFmt(p)}<small>зол.</small></div><div class="tr-b"><button data-tr="buy:${g}:1">+1</button><button data-tr="buy:${g}:5"${s.n < 2 ? ' disabled' : ''}>+5</button></div></div>`;
  }
  h += '<div class="group-title">Купец покупает</div>';
  const wk = Object.keys(car.wants);
  if (!wk.length) h += '<div class="muted small">Ему больше ничего не нужно.</div>';
  for (const g of wk) {
    const w = car.wants[g], have = tradeHave(g), p = tradeQuote(g, 'sell', w.k);
    h += `<div class="tr-row sell${have ? '' : ' zero'}"><div class="tr-g">${trIcon(g)}<div><div>${GOODS[g].name}</div><div class="muted small">нужно ${w.n} · у вас ${have} · ${trTrend(g)}</div></div></div>
      <div class="tr-p">${trFmt(p)}<small>зол.</small></div><div class="tr-b"><button data-tr="sell:${g}:1"${have < 1 ? ' disabled' : ''}>−1</button><button data-tr="sell:${g}:5"${have < 2 ? ' disabled' : ''}>−5</button><button data-tr="sell:${g}:999"${have < 1 ? ' disabled' : ''}>все</button></div></div>`;
  }
  return h + `<div class="muted small tr-note">Склады не пустеют до нуля сами: купец берёт только то, что у вас реально лежит свободным.</div>` + trMarketHTML();
}

function trMarketHTML() {
  const open = TRUI.open.market;
  let h = `<div class="group-title click" data-tr="fold:market">Цены на рынке ${open ? '▾' : '▸'}</div>`;
  if (!open) return h;
  h += '<div class="tr-mkt">';
  for (const g of Object.keys(TR_BASE)) h += `<div class="tr-m">${trIcon(g)}<span>${trFmt(tradeQuote(g, 'sell'))}–${trFmt(tradeQuote(g, 'buy'))}</span>${trTrend(g)}</div>`;
  return h + '</div><div class="muted small">Слева — сколько заплатят вам, справа — сколько попросят с вас. Магические камни не торгуются.</div>';
}

function tradeUiClick(e) {
  const b = e.target.closest('[data-tr]');
  if (!b || b.disabled) return;
  const [a, g, n] = b.dataset.tr.split(':');
  if (a === 'buy' || a === 'sell') { tradeCmd(a, g, +n); return; }
  if (a === 'fold') { TRUI.open[g] = !TRUI.open[g]; updateUI(true); return; }
  if (a === 'focus') { const c = Game.trade && Game.trade.car; if (c && typeof centerOn === 'function') centerOn(c.x * TILE, c.y * TILE); }
}

if (typeof document !== 'undefined' && typeof updateUI === 'function' && !trServer() && document.getElementById && document.getElementById('tab-trade')) {
  const _uu = updateUI;
  updateUI = function (force) {
    _uu(force);
    const sec = document.getElementById('trade-list');
    if (UI.tab === 'trade' && sec) setHTML('trade-list', tradeHTML());
    const bd = document.getElementById('trade-badge');
    if (bd) { const car = Game.trade && Game.trade.car; bd.classList.toggle('hidden', !(car && (car.st === 'stay' || car.st === 'ambush'))); bd.textContent = car && car.st === 'ambush' ? '!' : '●'; }
  };
  const sec = document.getElementById('trade-list');
  if (sec) sec.addEventListener('click', tradeUiClick);
}
