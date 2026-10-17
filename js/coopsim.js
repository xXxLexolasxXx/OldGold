'use strict';
// Кооператив, серверная часть: выполняется ТОЛЬКО в Node (server/simhost.js), в браузер не подключается.
// Живёт внутри той же симуляции, что и одиночная игра: у каждого игрока свой герой (обычный Unit с u.owner),
// команды приходят строками JSON, снимки для клиентов уходят строками JSON.
// Наружу (в server.js) торчат функции coop*: Join, Leave, Cmd, UnitsPacket, WorldPacket, InitPacket, Drain, MeData, HeroData.

const COOP_CLASSES = {
  warrior:   { name: 'Воин',   hp: 120, col: '#c8503a', info: 'Крепкий боец в железе' },
  barbarian: { name: 'Варвар', hp: 140, col: '#b87a2a', info: 'Самый выносливый, меньше всех думает' },
  mage:      { name: 'Маг',    hp: 80,  col: '#6a8aea', info: 'Хрупкий, зато умный' },
  archer:    { name: 'Лучник', hp: 90,  col: '#6aaa4a', info: 'Меткий глаз и быстрые ноги' },
  druid:     { name: 'Друид',  hp: 100, col: '#4aa07a', info: 'Дружит с лесом и грибами' },
  rogue:     { name: 'Плут',   hp: 90,  col: '#8a6aaa', info: 'Всё, что плохо лежит, лежит хорошо' },
  monk:      { name: 'Монах',  hp: 110, col: '#d8b84a', info: 'Спокойствие и крепкие кулаки' },
  priest:    { name: 'Жрец',   hp: 100, col: '#e8e0c8', info: 'Лечит словом и пивом' },
};
const COOP_CHAT = [
  'Опять всё самому делать?',
  'Кто строил этот забор — тот пил.',
  'Дорогу бы сперва проложили, гении.',
  'Пиво кончилось. Цивилизация тоже.',
  'Я не ленюсь, я копирую силы для драмы.',
  'Отличный план. Жаль, что не мой.',
];
const COOP_INV = 10;
const COOP_DRUNK = 5, COOP_FALL = 1, COOP_STARS = 4;

const coop = {
  players: new Map(),         // ник -> герой (Unit)
  out: [],                    // события для рассылки: { to?, msg }
  shB: new Map(), shO: new Map(), shR: new Set(), shRS: '', shP: '',
  t: 0, lvT: 0,
};

// ---------- Герой игрока ----------

function coopBaseHp(clsKey, level) { return (COOP_CLASSES[clsKey] || COOP_CLASSES.warrior).hp + 8 * ((level || 1) - 1); }

function coopHome() {
  const st = Game.buildings.find(b => b.type === 'storehouse') || Game.buildings[0];
  if (!st) return [40, 30];
  return randomFreeNear(st.doorX, st.doorY + 2, 1, 3, (x, y) => isWalkable(x, y) && !World.door[idx(x, y)]) || [st.doorX, st.doorY + 1];
}

function coopSay(to, text) { coop.out.push({ to, msg: { t: 'toast', text } }); }

function coopJoin(name, dataJson) {
  const d = JSON.parse(dataJson);
  coopLeave(name);
  const cls = COOP_CLASSES[d.cls] ? d.cls : 'warrior';
  let x, y;
  if (d.x != null && isWalkable(Math.floor(d.x), Math.floor(d.y))) { x = Math.floor(d.x); y = Math.floor(d.y); }
  else [x, y] = coopHome();
  const u = spawnUnit('hero', x, y);
  u.smoker = false; u.owner = name;
  if (d.look != null) u.look = d.look;
  u.food = d.food != null ? d.food : 1;
  const level = d.level || 1;
  const H = heroDefaults({ name, level, cls: COOP_CLASSES[cls].name });
  H.clsKey = cls; H.owner = name;
  H.maxhp = coopBaseHp(cls, level);
  H.hp = d.hp > 0 ? Math.min(d.hp, H.maxhp) : H.maxhp;
  H.inv = Array.from({ length: COOP_INV }, (_, i) => (d.inv && d.inv[i]) || null);
  u.hero = H;
  coop.players.set(name, u);
  coop.out.push({ msg: { t: 'toast', text: `${name} (${H.cls}) вошёл в деревню` } });
  return u.id;
}

function coopHeroData(name) {
  const u = coop.players.get(name);
  if (!u) return null;
  const H = u.hero;
  return JSON.stringify({ cls: H.clsKey, level: H.level, hp: Math.round(H.hp), inv: H.inv, x: u.x, y: u.y, food: u.food, look: u.look });
}

function coopLeave(name) {
  const u = coop.players.get(name);
  if (!u) return null;
  const data = coopHeroData(name);
  coop.players.delete(name);
  coopKill(u);
  return data;
}

function coopKill(u) {
  heroStopUnit(u);
  u.dead = true;
  u.releaseOcc();
  Game.smokers.delete(u);
  purgeDead();
}

function coopDropHeroes() {
  for (const u of Game.units.slice()) if (u.type === 'hero') { u.dead = true; u.proc = null; u.releaseOcc(); }
  purgeDead();
  coop.players.clear();
  Game.hero = null;
}

// ---------- Инвентарь ----------

function coopAddItem(H, key, n = 1) {
  for (const s of H.inv) if (s && s.k === key && s.n < 20) { s.n += n; return true; }
  const i = H.inv.findIndex(s => !s);
  if (i < 0) return false;
  H.inv[i] = { k: key, n };
  return true;
}

function coopUseItem(u, slot) {
  const H = u.hero, s = H.inv[slot];
  if (!s) return;
  const fv = { bread: 0.45, sausage: 0.55, chickenleg: 0.6, steak: 0.65, croissant: 0.5 }[s.k];
  if (!fv) { coopSay(H.owner, 'Это не съесть'); return; }
  s.n--; if (s.n <= 0) H.inv[slot] = null;
  u.food = Math.min(1.3, u.food + fv);
  H.hp = Math.min(H.maxhp, H.hp + H.maxhp * 0.1);
  floater(u.x, u.y - 1.6, 'Ням', '#ffe8a0');
}

// ---------- Таверна и пиво ----------

function* tavernGen(u, c) {
  const inn = c.b, H = u.hero;
  if (!inn || inn.removed) return;
  const ok = yield { walk: [inn.doorX, inn.doorY] };
  if (!ok || inn.removed) return;
  const food = innFood(inn);
  if (!food) { floater(u.x, u.y - 1.6, 'Еды нет', '#e8a070'); coopSay(H.owner, 'В трактире нет еды'); return; }
  yield { enter: inn };
  yield { wait: 3.5 };
  if (!inn.removed && inn.stock[food] > 0) {
    inn.stock[food]--;
    if (u.food >= 0.85 && coopAddItem(H, food, 1)) floater(u.x, u.y - 1.6, 'Взял с собой', '#ffe8a0');
    else u.food = Math.max(u.food, Math.min(1.3, u.food + (food === 'chickenleg' ? 0.6 : food === 'steak' ? 0.65 : 0.45)));
    H.hp = Math.min(H.maxhp, H.hp + H.maxhp * 0.15);
  }
  if (Math.random() < 0.4) {
    yield { wait: 2 };
    if (!inn.removed) {
      if (inn.stock.beer > 0) inn.stock.beer--;
      u.food = Math.min(1.3, u.food + 0.15);
      H.drunkUntil = Game.time + COOP_DRUNK;
      H.drunkNext = Game.time;
      floater(u.x, u.y - 1.6, 'Ик!', '#ffe070');
    }
  }
  yield { leave: true };
}

{
  const _rc = runCmd;
  runCmd = function* (u, c) {
    if (c.kind === 'tavern') yield* tavernGen(u, c);
    else yield* _rc(u, c);
  };
  const _we = Unit.prototype.wantsEat;
  Unit.prototype.wantsEat = function () { return this.owner ? false : _we.call(this); };   // игрок кормит героя сам
}

// ---------- Команды игрока ----------

function coopGo(u, x, y) {
  const H = u.hero;
  if (H.stunUntil > Game.time) return;
  if (H.drunkUntil > Game.time) { x += Math.floor(Math.random() * 7) - 3; y += Math.floor(Math.random() * 7) - 3; }   // пьяному не до точности
  if (!inb(x, y)) return;
  const b = buildingAt([x, y]);
  let c;
  if (b && !b.isRoad && b.type === 'inn' && b.state === 'done' && !b.upg) c = { kind: 'tavern', b, tx: b.doorX, ty: b.doorY, label: 'Поесть' };
  else c = resolveCmd([x, y]);
  if (!c) { coopSay(H.owner, 'Сюда не пройти'); return; }
  issueCmd(u, c);
}

const coopInt = v => Number.isInteger(v);

function coopCmd(name, msgJson) {
  let m;
  try { m = JSON.parse(msgJson); } catch (e) { return; }
  const u = coop.players.get(name);
  switch (m.t) {
    case 'go': if (u && coopInt(m.x) && coopInt(m.y)) coopGo(u, m.x, m.y); break;
    case 'use': if (u && coopInt(m.slot) && m.slot >= 0 && m.slot < COOP_INV) coopUseItem(u, m.slot); break;
    case 'drop': if (u && coopInt(m.slot) && u.hero.inv[m.slot]) u.hero.inv[m.slot] = null; break;
    case 'chat': {
      const text = COOP_CHAT[m.i];
      if (!text) break;
      coop.out.push({ msg: { t: 'chat', from: name, text, uid: u ? u.id : 0 } });
      break;
    }
    case 'build': {
      if (!BUILDINGS[m.type] || !coopInt(m.x) || !coopInt(m.y)) break;
      const rot = m.rot === 1 || m.rot === 2 ? m.rot : 0;
      const err = checkPlacement(m.type, m.x, m.y, rot);
      if (err) { coopSay(name, err); break; }
      placeBuilding(m.type, m.x, m.y, false, rot);
      break;
    }
    case 'road': {
      if (!Array.isArray(m.cells)) break;
      for (const c of m.cells.slice(0, 300)) if (Array.isArray(c) && coopInt(c[0]) && coopInt(c[1])) placeRoadSite(c[0], c[1]);
      break;
    }
    case 'erase': {
      if (!Array.isArray(m.cells)) break;
      for (const c of m.cells.slice(0, 60)) if (Array.isArray(c) && coopInt(c[0]) && coopInt(c[1])) eraseAt([c[0], c[1]]);
      break;
    }
  }
}

// ---------- Такт игроков ----------

function coopRespawn(u) {
  const H = u.hero;
  heroStopUnit(u);
  u.dead = false; u.brk = null; u.burn = null; u.injury = null; u.anim = null;
  const [x, y] = coopHome();
  u.x = x + 0.5; u.y = y + 0.5; u.food = Math.max(u.food, 0.6);
  H.hp = Math.round(H.maxhp * 0.5);
  H.drunkUntil = 0; H.stunUntil = 0;
  coop.out.push({ msg: { t: 'toast', text: `${H.owner} очнулся у склада — деревня не пускает так просто` } });
}

function coopTick(dt) {
  coop.t += dt;
  const now = Game.time;
  for (const [name, u] of coop.players) {
    const H = u.hero;
    if (u.dead || !Game.unitMap.has(u.id)) {
      // героя убила беда (нечисть, ночь) — возвращаем
      const data = JSON.parse(coopHeroData(name));
      coop.players.delete(name);
      coopJoin(name, JSON.stringify({ ...data, hp: 0, x: null }));
      const nu = coop.players.get(name);
      if (nu) { nu.hero.hp = Math.round(nu.hero.maxhp * 0.5); coop.out.push({ msg: { t: 'toast', text: `${name} погиб и вернулся к складу` } }); }
      continue;
    }
    u.nextJoin = 1e9;
    // пьяная походка: управление сбито, шаги в случайные стороны
    if (H.drunkUntil > now && now >= H.drunkNext && !u.inside) {
      H.drunkNext = now + 0.6;
      if (Math.random() < 0.8) {
        const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 2;
        const tx = Math.floor(u.x + Math.cos(a) * r), ty = Math.floor(u.y + Math.sin(a) * r);
        if (isWalkable(tx, ty) && !World.door[idx(tx, ty)]) issueCmd(u, { kind: 'move', x: tx, y: ty, tx, ty, label: '' });
      }
    }
    if (H.drunkUntil && now >= H.drunkUntil) {
      H.drunkUntil = 0;
      heroStopUnit(u);
      H.stunUntil = now + COOP_FALL;
      u.proc = (function* () { yield { wait: COOP_FALL, anim: 'knocked' }; u.ouchUntil = Game.time + COOP_STARS; })();
      u.action = null;
    }
    if (H.stunUntil > now && u.cmd) u.cmd = null;
    // здоровье: беды деревни
    if (u.food <= 0) H.hp -= 0.5 * dt;
    else if (H.hp < H.maxhp && u.food > 0.25 && !(u.burn && u.burn.stage)) H.hp = Math.min(H.maxhp, H.hp + 0.4 * dt);
    if (u.burn && u.burn.stage) H.hp -= 6 * dt;
    if (u.injury && u.injury !== H.seenInj) H.hp -= 8;
    H.seenInj = u.injury || null;
    const fly = u.anim === 'fly';
    if (fly && !H.seenFly) H.hp -= 5;
    H.seenFly = fly;
    if (H.hp <= 0) coopRespawn(u);
  }
  coop.lvT += dt;
  if (coop.lvT >= 2) {
    coop.lvT = 0;
    const L = heroLevelAt(heroTownScore());
    for (const u of coop.players.values()) if (L > u.hero.level) { u.hero.level = L; u.hero.maxhp = coopBaseHp(u.hero.clsKey, L); }
  }
}

{
  const _st = step;
  step = function (dt) { _st(dt); coopTick(dt); };
  heroTick = function () { };       // возрождение героев — у coopTick; общего героя нет
  ensureHero = function () { return false; };
  const _fl = floater;
  floater = function (x, y, text, col, icon) {
    _fl(x, y, text, col, icon);
    if (text && coop.out.length < 200) coop.out.push({ msg: { t: 'fl', x: +x.toFixed(2), y: +y.toFixed(2), text, col } });
  };
  const _ts = toast;
  toast = function (text, target) { _ts(text, target); if (text && coop.out.length < 200) coop.out.push({ msg: { t: 'toast', text: String(text) } }); };
}

// ---------- Снимки ----------

const r2 = v => Math.round(v * 100) / 100;

function coopUnitsPacket() {
  const us = [], now = Game.time;
  for (const u of Game.units) {
    if (u.dead) continue;
    const a = u.action;
    const o = { i: u.id, t: u.type, x: r2(u.x), y: r2(u.y), f: u.face, v: u.vdir, lk: u.look, fd: r2(u.food) };
    if (u.anim) o.a = u.anim;
    if (a && a.walk && a.path && !(a.block > 0 && !a.squeeze)) o.m = 1;
    if (a && a.T) { o.at = r2(a.t); o.aT = r2(a.T); }
    if (u.carry) { o.c = u.carry; o.n = u.carryN || 1; }
    if (u.inside) o.in = u.inside.id;
    if (u.injury) o.inj = u.injury;
    if (u.drunkAt || (u.hero && u.hero.drunkUntil > now)) o.dr = 1;
    if (u.ouchUntil > now) o.ou = 1;
    if (u.owner) o.ow = u.owner;
    if (u.hero && u.owner) { o.hp = Math.round(u.hero.hp); o.mhp = u.hero.maxhp; o.cl = u.hero.clsKey; o.lv = u.hero.level; }
    us.push(o);
  }
  const an = [];
  for (const a of Game.animals) if (!a.dead) an.push({ i: a.id, k: a.kind, x: r2(a.x), y: r2(a.y), f: a.face, m: a.moving ? 1 : 0, p: r2(a.phase), l: a.loot || undefined, s: a.state });
  return JSON.stringify({ t: 'u', time: r2(now), units: us, animals: an });
}

function coopInitPacket(uid) {
  const s = serializeGame();
  s.units = [];
  return JSON.stringify({ t: 'init', world: s, uid, time: Game.time, nextId: Game.nextId });
}

// Разница мира с прошлой рассылкой: здания, объекты на клетках, дороги, стройки дорог, груды
function coopWorldPacket() {
  const s = serializeGame();
  const out = { t: 'w', time: r2(Game.time), nextId: Game.nextId };
  // здания
  const nb = new Map(), up = [];
  for (const d of s.buildings) {
    const b = Game.buildings.find(x => x.id === d.id);
    d.wk = b && b.working ? 1 : 0; d.an = b ? r2(b.anim || 0) : 0;
    const sig = JSON.stringify(d);
    nb.set(d.id, sig);
    if (coop.shB.get(d.id) !== sig) up.push(d);
  }
  const rm = [];
  for (const id of coop.shB.keys()) if (!nb.has(id)) rm.push(id);
  coop.shB = nb;
  if (up.length) out.b = up;
  if (rm.length) out.bx = rm;
  // объекты
  const no = new Map(), oc = [];
  for (const t of s.obj) {
    const sig = t.join(',');
    no.set(t[0], sig);
    if (coop.shO.get(t[0]) !== sig) oc.push(t);
  }
  const ox = [];
  for (const i of coop.shO.keys()) if (!no.has(i)) ox.push(i);
  coop.shO = no;
  if (oc.length) out.o = oc;
  if (ox.length) out.ox = ox;
  // дороги
  const nr = new Set(s.road), ra = [], rx = [];
  for (const i of nr) if (!coop.shR.has(i)) ra.push(i);
  for (const i of coop.shR) if (!nr.has(i)) rx.push(i);
  coop.shR = nr;
  if (ra.length) out.r = ra;
  if (rx.length) out.rx = rx;
  // стройки дорог и груды: целиком, если изменились
  const rs = [...Game.roadSites.values()].map(q => ({ x: q.x, y: q.y, st: q.stock.stone || 0, dg: r2(q.dug || 0), pv: r2(q.pave || 0) }));
  const rsj = JSON.stringify(rs);
  if (rsj !== coop.shRS) { coop.shRS = rsj; out.rs = rs; }
  const pl = [...Game.piles.values()].filter(p => !p.removed).map(p => { const st = {}; for (const g of GOOD_KEYS) if (p.stock[g] > 0) st[g] = p.stock[g]; return { x: p.x, y: p.y, st }; });
  const plj = JSON.stringify(pl);
  if (plj !== coop.shP) { coop.shP = plj; out.pl = pl; }
  return out.b || out.bx || out.o || out.ox || out.r || out.rx || out.rs || out.pl ? JSON.stringify(out) : null;
}

function coopMeData(name) {
  const u = coop.players.get(name);
  if (!u) return null;
  const H = u.hero;
  return JSON.stringify({ t: 'me', uid: u.id, cls: H.clsKey, clsName: H.cls, level: H.level, hp: Math.round(H.hp), mhp: H.maxhp, inv: H.inv, food: r2(u.food) });
}

function coopDrain() {
  const o = coop.out;
  coop.out = [];
  return JSON.stringify(o);
}

function coopMeta() {
  return JSON.stringify({ classes: COOP_CLASSES, chat: COOP_CHAT });
}
