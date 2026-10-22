'use strict';
// Общие помощники тестов: запуск симуляции в simhost, «бот-игрок», инварианты, отпечаток состояния.
const { createHost } = require('../../server/simhost');

const MIN = 60;   // игровая минута в секундах игрового времени

// Детерминированный генератор: Math.random в песочнице подменяется, иначе два прогона не сравнить
function mulberry(seed) {
  let s = (seed ^ 0x9e3779b9) >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function newSim(seed, opts = {}) {
  const errors = [];
  const h = createHost(m => errors.push(m), { files: opts.files });
  const rnd = mulberry(seed);
  h.run('Math'); // убеждаемся, что контекст жив
  h.ctx.__rnd = rnd;
  h.run('Math.random = __rnd');
  // одиночная игра — с героем, как у игрока; кооп-сервер — без него (герои приходят с игроками)
  h.run(`setupStart(${seed}); Game.heroAsk = false; if (${!!opts.coop} && typeof coopDropHeroes === "function") { coopDropHeroes(); coopInitUnlocks(); } for (const b of Game.buildings) b.hold = false; Game.unlocked = allUnlocked(); if (Game.dz && !${!!opts.disasters}) Game.dz.freq = 0;`);   // стихийные бедствия (disasters.js) в сценарных тестах выключены: их проверяет disaster-test.js
  return { h, errors, seed, coop: !!opts.coop, rnd };
}

// Шаги с перехватом исключений (как главный цикл сервера: ошибка шага не роняет процесс, но мы её считаем)
function stepN(sim, n) {
  const { h, errors } = sim;
  for (let i = 0; i < n; i++) {
    try {
      h.ctx.step(0.05);
      if (sim.coop) h.run('coopTick(0.05)');
    } catch (e) {
      const key = String(e && e.stack || e).split('\n').slice(0, 3).join(' | ');
      if (!sim.seenErr) sim.seenErr = new Set();
      if (!sim.seenErr.has(key)) { sim.seenErr.add(key); errors.push(`шаг ${Math.round(h.run('Game.time'))}с: ${key}`); }
      if (errors.length > 20) throw new Error('слишком много исключений:\n' + errors.join('\n'));
    }
  }
}
function runFor(sim, seconds, every, cb) {
  const per = Math.round(every / 0.05), total = Math.ceil(seconds / every);
  for (let k = 0; k < total; k++) { stepN(sim, per); cb && cb(k); }
}

// ---- Бот-игрок: строит набор хозяйственных зданий вокруг склада и тянет к ним дороги
const PLAN = ["woodcutter", "sawmill", "farm", "quarry", "mill", "bakery", "woodcutter", "swine", "farm", "brewery", "hopfarm", "goatpen", "quarry"];
const BOT = `(function () {
  const hub = Game.buildings.find(b => b.type === 'storehouse');
  if (!hub) return 'нет склада';
  Game.__bot = Game.__bot || { i: 0, fails: 0 };
  const bot = Game.__bot;
  const plan = __PLAN__;
  // потери восполняем учёбой в школе, как сделал бы игрок
  const people = Game.units.filter(u => !u.dead && isPerson(u)).length, school = Game.buildings.find(b => b.type === 'school' && b.state === 'done');
  if (people < 16 && school && school.queue.length < 2) queueTraining(['serf', 'builder', 'serf', 'woodcutter', 'farmer'][(bot.q = (bot.q || 0) + 1) % 5]);
  if (bot.i >= plan.length) return 'готово';
  if (Game.buildings.some(b => b.state !== 'done' && b.type !== 'graveyard') || Game.roadSites.size) return 'ждём стройку';
  const net = new Set(); const q = [idx(hub.doorX, hub.doorY)];
  net.add(q[0]);
  while (q.length) {
    const i = q.pop(), x = i % MAP_W, y = (i / MAP_W) | 0;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny); if (!net.has(j) && (World.road[j] || Game.roadSites.has(j))) { net.add(j); q.push(j); } }
  }
  const type = plan[bot.i];
  const cx = hub.doorX, cy = hub.doorY;
  let best = null;
  for (let r = 3; r < 26 && !best; r++) for (let a = 0; a < 24 && !best; a++) {
    const x = Math.round(cx + Math.cos(a * 0.2618 + bot.i) * r * 1.4), y = Math.round(cy + Math.sin(a * 0.2618 + bot.i) * r);
    if (!inb(x, y) || checkPlacement(type, x, y, 0)) continue;
    const dd = bDims(type, 0), sx = x + dd.dx, sy = y + dd.dy;
    const prev = new Map(); const queue = [[sx, sy]]; prev.set(idx(sx, sy), -1); let goal = -1;
    const blocked = new Set(); for (let yy = y; yy < y + dd.h; yy++) for (let xx = x; xx < x + dd.w; xx++) blocked.add(idx(xx, yy));
    if (net.has(idx(sx, sy))) goal = idx(sx, sy);
    for (let h = 0; h < queue.length && goal < 0 && h < 2500; h++) {
      const [px, py] = queue[h];
      for (const [dx, dy] of [[0,1],[1,0],[-1,0],[0,-1]]) {
        const nx = px + dx, ny = py + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny);
        if (prev.has(j) || blocked.has(j)) continue;
        if (net.has(j)) { prev.set(j, idx(px, py)); goal = j; break; }
        if (!canPlaceRoad(nx, ny)) continue;
        prev.set(j, idx(px, py)); queue.push([nx, ny]);
      }
    }
    if (goal >= 0) best = { x, y, goal, prev };
  }
  if (!best) { bot.fails++; if (bot.fails > 3) { bot.i++; bot.fails = 0; } return 'нет места: ' + type; }
  placeBuilding(type, best.x, best.y, false, 0);
  let j = best.goal; while (j >= 0) { const x = j % MAP_W, y = (j / MAP_W) | 0; if (!net.has(j)) placeRoadSite(x, y); j = best.prev.get(j); }
  bot.i++; bot.fails = 0;
  return 'построил ' + type;
})()`;
function botTurn(sim, plan) { return sim.h.run(BOT.replace('__PLAN__', JSON.stringify(plan || PLAN))); }
// Заложить одно здание с дорогой до сети склада, не дожидаясь других строек (для сценарных тестов)
function botPlace(sim, type) {
  sim.h.run('Game.__bot = { i: 0, fails: 0 }');
  return sim.h.run(BOT.replace('__PLAN__', JSON.stringify([type])).replace(/if \(Game\.buildings\.some[^\n]*ждём стройку';/, ''));
}

// ---- Инварианты
const INV = `(function () {
  const r = { nan: [], neg: [], goods: {}, dup: 0 };
  const chk = (what, v) => { if (typeof v !== 'number' || !isFinite(v)) r.nan.push(what + '=' + v); };
  for (const u of Game.units) {
    chk('unit ' + u.type + '#' + u.id + '.x', u.x); chk('unit ' + u.type + '#' + u.id + '.y', u.y);
    if (!u.noFood) chk('unit ' + u.type + '#' + u.id + '.food', u.food);
    if (u.x < -1 || u.y < -1 || u.x > MAP_W + 1 || u.y > MAP_H + 1) r.nan.push('вне карты ' + u.type + '#' + u.id + ' ' + u.x + ',' + u.y);
  }
  const ids = new Set(); for (const u of Game.units) { if (ids.has(u.id)) r.dup++; ids.add(u.id); }
  for (const b of Game.buildings) {
    for (const g of GOOD_KEYS) {
      for (const k of ['stock', 'incoming', 'reserved']) { const v = b[k][g]; chk(b.type + '#' + b.id + '.' + k + '.' + g, v); if (v < -1e-9) r.neg.push(b.type + '#' + b.id + '.' + k + '.' + g + '=' + v); }
      r.goods[g] = (r.goods[g] || 0) + b.stock[g];
    }
    chk(b.type + '#' + b.id + '.hits', b.hits);
  }
  for (const g of GOOD_KEYS) { chk('produced.' + g, Game.produced[g]); if (Game.produced[g] < 0) r.neg.push('produced.' + g); }
  chk('Game.time', Game.time);
  for (const p of Game.piles.values()) if (!p.removed) for (const g of GOOD_KEYS) { chk('pile.' + g, p.stock[g]); if (p.stock[g] < 0) r.neg.push('pile.' + g + '=' + p.stock[g]); r.goods[g] = (r.goods[g] || 0) + p.stock[g]; }
  for (const u of Game.units) if (u.carry && !u.dead) r.goods[u.carry] = (r.goods[u.carry] || 0) + (u.carryN || 1);
  r.n = { units: Game.units.length, buildings: Game.buildings.length, animals: Game.animals.length, piles: Game.piles.size,
    floaters: (Game.floaters || []).length, log: (Game.log || []).length, ents: (Game.ents || []).length, ghosts: (Game.ghosts || []).length, skels: (Game.skels || []).length,
    critters: (Game.critters || []).length, roadSites: Game.roadSites.size, falling: (Game.falling || []).length };
  r.t = Game.time; r.produced = Object.assign({}, Game.produced);
  // застревание: идущий (walk) житель, не сдвинувшийся с места
  Game.__pos = Game.__pos || new Map();
  r.stuck = [];
  for (const u of Game.units) {
    const a = u.action, walking = a && a.walk && !u.inside && !u.dead && !(u.pauseUntil > Game.time) && !u.brk;
    const p = Game.__pos.get(u.id);
    if (walking && p && Math.abs(p.x - u.x) < 0.02 && Math.abs(p.y - u.y) < 0.02) { if (Game.time - p.t > 0) r.stuck.push([u.type, u.id, Math.round(Game.time - p.t), Math.round(u.x), Math.round(u.y)]); }
    else Game.__pos.set(u.id, { x: u.x, y: u.y, t: Game.time });
  }
  return JSON.stringify(r);
})()`;
function inspect(sim) { return JSON.parse(sim.h.run(INV)); }
function checkInvariants(sim, label) {
  const r = inspect(sim), problems = [];
  if (r.nan.length) problems.push(`${label}: нечисловые значения (${r.nan.length}): ${r.nan.slice(0, 5).join('; ')}`);
  if (r.neg.length) problems.push(`${label}: отрицательные количества: ${r.neg.slice(0, 5).join('; ')}`);
  if (r.dup) problems.push(`${label}: повторяющиеся id жителей: ${r.dup}`);
  return { problems, r };
}

// Отпечаток состояния: хэш сериализации
function fingerprint(sim) {
  const s = sim.h.run('JSON.stringify(serializeGame())');
  let hsh = 2166136261;
  for (let i = 0; i < s.length; i++) { hsh ^= s.charCodeAt(i); hsh = Math.imul(hsh, 16777619) >>> 0; }
  return { hash: hsh.toString(16), size: s.length, text: s };
}

module.exports = { newSim, stepN, runFor, botTurn, botPlace, inspect, checkInvariants, fingerprint, mulberry, MIN };
