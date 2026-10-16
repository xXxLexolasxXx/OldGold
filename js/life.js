'use strict';
// «Живые» жители: перекуры, пьяный сон, столкновения с травмами.
// Всё это нарочно ломает ровный поток конвейера и требует внимания игрока.

// ---------- Перерывы ----------
// Перерыв подменяет текущее поведение, а потом возвращает его как было.

function startBreak(u, kind, gen) {
  const saved = { proc: u.proc, action: u.action };
  if (saved.action && saved.action.walk) { saved.action.path = null; saved.action.i = 0; saved.action.block = 0; saved.action.squeeze = false; }
  u.brk = { kind, saved, until: 0 };
  u.proc = gen;
  u.action = null; u.anim = null; u.lastRes = undefined;
  // стоящий на дороге занимает клетку — другим придётся протискиваться
  if (u.isCourier) u.releaseOcc();
  const i = idx(Math.floor(u.x), Math.floor(u.y));
  if (World.road[i] && !World.occ[i]) { World.occ[i] = u.id; u.blockT = i; }
}

function endBreak(u) {
  const s = u.brk.saved;
  if (u.blockT >= 0 && World.occ[u.blockT] === u.id) World.occ[u.blockT] = 0;
  u.blockT = -1;
  if (u.brk.kind === 'smoke' || u.brk.kind === 'join') Game.smokers.delete(u);
  u.brk = null;
  u.proc = s.proc; u.action = s.action; u.anim = null; u.lastRes = undefined;
}

function* smokeGen(u, time) {
  u.brk.until = Game.time + time;
  Game.smokers.add(u);
  yield { wait: time, anim: 'smoke' };
}

function* joinGen(u, host) {
  // подойти к курящему и встать рядом
  const hx = Math.floor(host.x), hy = Math.floor(host.y);
  const spot = randomFreeNear(hx, hy, 1, 1.5, (x, y) => isWalkable(x, y) && !World.bmap[idx(x, y)]);
  if (spot) yield { walk: spot, offroad: true };
  if (!host.brk || (host.brk.kind !== 'smoke' && host.brk.kind !== 'join')) return;
  u.face = host.x > u.x ? 1 : -1;
  u.vdir = 'E';
  const i = idx(Math.floor(u.x), Math.floor(u.y));
  if (World.road[i] && !World.occ[i]) { World.occ[i] = u.id; u.blockT = i; }
  yield* smokeGen(u, JOIN_SMOKE_TIME);
}

function* sleepGen(u) {
  u.brk.until = Game.time + SLEEP_TIME;
  yield { wait: SLEEP_TIME, anim: 'sleep' };
}

function isPerson(u) { return !UNIT_TYPES[u.type].animal; }

// Можно ли сейчас прервать жителя: он снаружи и просто идёт или ждёт без работы.
function interruptible(u) {
  if (u.brk || u.inside || !isPerson(u)) return false;
  const a = u.action;
  if (!a) return true;
  if (a.walk) return true;
  if (a.wait !== undefined && !a.anim) return true;
  return false;
}

function lifeTick(u, dt) {
  if (u.injury && Game.time >= u.injuryUntil) { u.injury = null; }
  u.lifeT = (u.lifeT || 0) + dt;
  if (u.lifeT < 0.5) return;
  u.lifeT = 0;
  if (!interruptible(u)) return;
  // пьяный засыпает где стоит
  if (u.drunkAt && Game.time >= u.drunkAt) {
    u.drunkAt = 0;
    startBreak(u, 'sleep', null);
    u.proc = sleepGen(u);
    if (Math.random() < 0.3) toast(`${UNIT_TYPES[u.type].name} перебрал пива и уснул на дороге`);
    return;
  }
  if (!u.smoker || u.type === 'carter') return;
  // подсесть к курящим рядом
  if (Game.time >= u.nextJoin && Game.smokers.size) {
    let host = null, bd = JOIN_RADIUS;
    for (const s of Game.smokers) {
      if (s === u || !s.brk || s.brk.until - Game.time < JOIN_SMOKE_TIME * 0.6) continue;
      const d = Math.hypot(s.x - u.x, s.y - u.y);
      if (d < bd) { bd = d; host = s; }
    }
    if (host && Math.random() < 0.5) {
      u.nextJoin = Game.time + JOIN_CD;
      u.nextSmoke = Math.max(u.nextSmoke, Game.time + SMOKE_CD_MIN);
      startBreak(u, 'join', null);
      u.proc = joinGen(u, host);
      return;
    }
  }
  // сам решил покурить
  if (Game.time >= u.nextSmoke && Math.random() < 0.08) {
    u.nextSmoke = Game.time + SMOKE_CD_MIN + Math.random() * (SMOKE_CD_MAX - SMOKE_CD_MIN);
    startBreak(u, 'smoke', null);
    u.proc = smokeGen(u, SMOKE_TIME);
  }
}

// ---------- Столкновения и травмы ----------

const bumpCD = new Map();

function injure(u, part) {
  if (u.injury || !isPerson(u)) return;
  u.injury = part;
  u.injuryUntil = Game.time + INJURY_TIME;
}

function dropLoad(u) {
  if (!u.carry) return null;
  const g = u.carry, n = u.carryN || 1;
  dropPile(Math.floor(u.x), Math.floor(u.y), g, n);
  u.carry = null; u.carryN = 0;
  return g;
}

let lastBumpToast = -99;

function checkCollisions() {
  const grid = new Map();
  for (const u of Game.units) {
    if (u.inside) continue;
    const k = Math.floor(u.x) + Math.floor(u.y) * MAP_W;
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(u);
  }
  for (const u of Game.units) {
    if (u.inside || !(u.action && u.action.walk && u.action.path)) continue;
    const tx = Math.floor(u.x), ty = Math.floor(u.y);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const list = grid.get(tx + dx + (ty + dy) * MAP_W);
      if (!list) continue;
      for (const o of list) {
        if (o === u || o.id < u.id && o.action && o.action.walk) continue;   // пару считаем один раз
        if (Math.hypot(o.x - u.x, o.y - u.y) > 0.42) continue;
        const key = Math.min(u.id, o.id) * 100000 + Math.max(u.id, o.id);
        if ((bumpCD.get(key) || 0) > Game.time) continue;
        bumpCD.set(key, Game.time + 6);
        const carrier = u.carry ? u : o.carry ? o : null;
        if (!carrier) continue;
        const victim = carrier === u ? o : u;
        if (!isPerson(victim)) continue;
        let p = COLLIDE_CHANCE;
        if (u.action.squeeze || (o.action && o.action.squeeze)) p += 0.06;
        if (o.brk && o.brk.kind === 'sleep') p += 0.18;
        if (u.drunkAt || o.drunkAt) p += 0.06;
        if (HEAVY.has(carrier.carry)) p += 0.02;
        if (Math.random() > p) continue;
        const g = dropLoad(carrier);
        const part = Math.random() < 0.5 ? 'leg' : 'arm';
        injure(victim, part);
        if (Game.time - lastBumpToast > 8) {
          lastBumpToast = Game.time;
          toast(`Столкновение: ${UNIT_TYPES[carrier.type].name.toLowerCase()} уронил «${GOODS[g].name}», ${UNIT_TYPES[victim.type].name.toLowerCase()} ${part === 'leg' ? 'теперь хромает' : 'повредил руку'}`);
        }
      }
    }
  }
  if (bumpCD.size > 4000) for (const [k, t] of bumpCD) if (t < Game.time) bumpCD.delete(k);
}
