'use strict';
// Цепочки заданий героя: клик по стройке → склад (взять нужное, не больше рюкзака) → стройка (выложить) →
// строит → излишки обратно на склад → закурить → фляжка. Клик по мастерской с готовой продукцией —
// отнести её на склад.

const HERO_PACK = 10;                       // сколько единиц материалов влезает в рюкзак за раз
const BUILD_GOODS = ['trunk', 'timber', 'stone'];

function heroLoadN(u) { let n = 0; if (u.hload) for (const g in u.hload) n += u.hload[g]; return n; }
function heroLoadSync(u) {
  const keys = u.hload ? Object.keys(u.hload).filter(g => u.hload[g] > 0) : [];
  u.carry = keys[0] || null; u.carryN = keys.length ? heroLoadN(u) : 0;
  if (!keys.length) u.hload = null;
}
// выбросить рюкзачный груз кучкой (при прерывании)
function heroDropLoad(u) {
  if (!u.hload) return;
  for (const g in u.hload) if (u.hload[g] > 0) dropPile(Math.floor(u.x), Math.floor(u.y), g, u.hload[g]);
  u.hload = null; u.carry = null; u.carryN = 0;
}

// ближайший склад, где реально есть товар
function storeWith(u, g) {
  let best = null, bd = 1e9;
  for (const b of Game.buildings) {
    if (!b.isStore() || b.removed || b.noDeliver || b.offer(g) <= 0) continue;
    const d = Math.abs(b.doorX - u.x) + Math.abs(b.doorY - u.y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

function* heroFetchFor(u, s) {
  for (const g of BUILD_GOODS) {
    const need = Math.min(HERO_PACK - heroLoadN(u), s.demand ? s.demand(g) : 0);
    if (need <= 0) continue;
    const st = storeWith(u, g);
    if (!st) continue;
    const ok = yield { walk: [st.doorX, st.doorY] };
    if (!ok || st.removed) continue;
    yield { enter: st };
    const take = Math.max(0, Math.min(need, st.offer(g)));
    if (take > 0) { st.stock[g] -= take; u.hload = u.hload || {}; u.hload[g] = (u.hload[g] || 0) + take; heroLoadSync(u); }
    yield { wait: 0.5 };
    yield { walk: [Math.floor(u.x), Math.floor(u.y)] };
  }
}

function* heroUnloadAt(u, s) {
  if (!u.hload) return;
  const ok = yield { walk: [s.doorX, s.doorY], offroad: !!s.isRoad };
  if (!ok || s.removed || !u.hload) return;
  const stk = s.upg ? s.upg.stock : s.stock;
  yield { wait: 0.5, anim: 'duck' };
  for (const g of BUILD_GOODS) {
    const have = u.hload && u.hload[g] || 0;
    if (!have) continue;
    const raw = Math.max(0, (s.demand(g) || 0) + (s.incoming ? s.incoming[g] || 0 : 0));   // сколько ещё нужно в целом
    const put = Math.min(have, raw);
    if (put > 0) { stk[g] += put; u.hload[g] -= put; }
  }
  heroLoadSync(u);
}

// излишки обратно на склад
function* heroReturnLoad(u) {
  if (!u.hload) return;
  for (const g of Object.keys(u.hload)) {
    const n = u.hload && u.hload[g];
    if (!(n > 0)) continue;
    const st = nearestStore(u.x, u.y, g);
    if (!st) { dropPile(Math.floor(u.x), Math.floor(u.y), g, n); u.hload[g] = 0; continue; }
    const ok = yield { walk: [st.doorX, st.doorY] };
    if (!u.hload) return;
    if (ok && !st.removed && st.isStore()) {
      yield { enter: st };
      st.stock[g] += n; u.hload[g] = 0;
      yield { wait: 0.5 };
      yield { walk: [Math.floor(u.x), Math.floor(u.y)] };
    } else { dropPile(Math.floor(u.x), Math.floor(u.y), g, n); u.hload[g] = 0; }
  }
  heroLoadSync(u);
}

function* heroBuildChain(u, s) {
  yield* heroFetchFor(u, s);
  if (u.hload) yield* heroUnloadAt(u, s);
  yield* heroBuild(u, s);
  const built = s.isRoad ? (isRoadAt(s.x, s.y) && !Game.roadSites.has(idx(s.x, s.y)))
    : (!s.removed && s.state === 'done' && !s.upg);
  if (u.hload) yield* heroReturnLoad(u);
  if (built) {
    if (u.type === 'hero') yield { wait: 2.6, anim: 'smoke' };    // закурить
    yield* flaskGen(u);
  }
}

function isRoadAt(x, y) { return !!World.road[idx(x, y)]; }

// Отнести продукцию мастерской (доски с лесопилки и т.д.) на склад
function* heroHaul(u, c) {
  const b = c.b;
  const ok = yield { walk: [b.doorX, b.doorY] };
  if (!ok || b.removed) return;
  const outs = b.def.outputs ? Object.keys(b.def.outputs) : [];
  const g = outs.find(k => b.offer(k) > 0);
  if (!g) { floater(u.x, u.y - 1.4, 'Нечего нести', '#e8a070'); return; }
  const n = Math.min(HERO_PACK, b.offer(g));
  b.stock[g] -= n;
  yield { wait: 0.6, anim: 'duck' };
  u.hload = { [g]: n }; heroLoadSync(u);
  yield* heroReturnLoad(u);
}
