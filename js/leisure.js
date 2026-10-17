'use strict';
// Досуг без работы и деревенская живность.
// Скучающий гном (давно без дела) идёт: собирать грибы у деревьев, гоняться за бабочкой,
// копать золото в корнях (иногда находит самородок и несёт на склад), ловить курицу.
// Куры бродят по деревне. Гуси живут у воды, злее волков: гонятся за гномами и щиплют,
// а гномы удирают, размахивая руками. Работу досуг не задерживает — диспетчер
// забирает гнома, как только для него найдётся дело.

ANIMALS.chicken = { name: 'Курица', mood: 'farm', speed: 1.3, flee: 1.7 };
ANIMALS.goose = { name: 'Гусь', mood: 'angry', speed: 2.55, flee: 0 };

const LEISURE_IDLE = 6;        // сколько «пустых» циклов ожидания до досуга
let lastGooseToast = -99, lastGoldToast = -99;

// ---------- Всплывающие значки и надписи ----------

function floater(x, y, text, col = '#fff6d0', icon = null) {
  (Game.floaters = Game.floaters || []).push({ x, y, text, col, icon, t0: Game.time });
  if (text) sfxFloater(text, x, y);
}

function drawFloaters(c) {
  const list = Game.floaters || [];
  for (let i = list.length - 1; i >= 0; i--) {
    const f = list[i], age = Game.time - f.t0;
    if (age > 1.6) { list.splice(i, 1); continue; }
    const a = 1 - age / 1.6, px = f.x * TILE, py = f.y * TILE - age * 14;
    c.globalAlpha = a;
    if (f.icon) { c.save(); c.translate(px, py); c.scale(0.55, 0.55); drawLoad(c, f.icon); c.restore(); }
    if (f.text) {
      c.font = 'bold 7px serif'; c.textAlign = 'center';
      c.fillStyle = '#1a1210'; c.fillText(f.text, px + 0.6, py + 0.6);
      c.fillStyle = f.col; c.fillText(f.text, px, py);
      c.textAlign = 'start';
    }
    c.globalAlpha = 1;
  }
}

// ---------- Бабочки ----------

const BUTTERFLY_COLS = ['#f0d040', '#f4f4f6', '#e86a8a', '#8ab4f0', '#f09040'];

function spawnButterfly(x, y) {
  const b = { x, y, tx: x, ty: y, col: BUTTERFLY_COLS[(Math.random() * BUTTERFLY_COLS.length) | 0], ph: Math.random() * 6, life: 40, chaser: 0 };
  (Game.critters = Game.critters || []).push(b);
  return b;
}

function updateCritters(dt) {
  const list = Game.critters || [];
  for (let i = list.length - 1; i >= 0; i--) {
    const b = list[i];
    b.life -= dt; b.ph += dt * 14;
    if (b.life <= 0) { list.splice(i, 1); continue; }
    // порхает к цели зигзагом; ловец рядом — вспархивает подальше
    const ch = b.chaser && Game.unitMap.get(b.chaser);
    if (ch && Math.hypot(ch.x - b.x, ch.y - b.y) < 1.1) {
      const a = Math.random() * Math.PI * 2;
      b.tx = b.x + Math.cos(a) * (2 + Math.random() * 2); b.ty = b.y + Math.sin(a) * (2 + Math.random() * 2);
    } else if (Math.hypot(b.tx - b.x, b.ty - b.y) < 0.3) {
      b.tx = b.x + (Math.random() - 0.5) * 2; b.ty = b.y + (Math.random() - 0.5) * 2;
    }
    b.tx = Math.max(1, Math.min(MAP_W - 2, b.tx)); b.ty = Math.max(1, Math.min(MAP_H - 2, b.ty));
    const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy) || 1, sp = 1.8 * dt;
    b.x += dx / d * Math.min(sp, d) + Math.sin(b.ph * 0.3) * dt * 0.6;
    b.y += dy / d * Math.min(sp, d) + Math.cos(b.ph * 0.23) * dt * 0.6;
  }
  // пара бабочек всегда порхает над лугом у деревни
  if (list.filter(b => !b.chaser).length < 3 && Math.random() < dt * 0.2) {
    const s = wildSpot(4, false);
    if (s) spawnButterfly(s[0] + 0.5, s[1] + 0.5);
  }
}

function drawButterfly(c, b) {
  const px = b.x * TILE, py = b.y * TILE - 10 - Math.sin(b.ph * 0.5) * 2;
  const w = Math.abs(Math.sin(b.ph)) * 2.4 + 0.4;
  c.fillStyle = 'rgba(10,8,4,0.18)'; c.fillRect(px - 1, b.y * TILE + 2, 3, 1);
  c.fillStyle = b.col; c.fillRect(px - w - 0.5, py - 1, w, 2); c.fillRect(px + 0.5, py - 1, w, 2);
  c.fillStyle = '#2a1a10'; c.fillRect(px - 0.5, py - 1.5, 1, 3);
}

// ---------- Куры и гуси ----------

function spawnFarmyard() {
  const st = Game.buildings.find(b => b.type === 'storehouse') || Game.buildings[0];
  if (st) for (let k = 0; k < 5; k++) {
    const s = randomFreeNear(st.doorX, st.doorY + 2, 1, 6, (x, y) => isWalkable(x, y) && !World.road[idx(x, y)]);
    if (s) { const a = makeAnimal('chicken', s[0], s[1]); a.home = [st.doorX, st.doorY + 3]; Game.animals.push(a); }
  }
  for (let f = 0; f < 2; f++) spawnGeeseFlock();
}

// Стайка гусей на берегу, не у самой деревни
// Стайка гусей плавает на озере у берега. Гусь умеет и плавать, и ходить:
// движется напрямик, огибать нужно только скалы и дома.
const isWaterAt = (x, y) => inb(x, y) && World.terrain[idx(x, y)] === T_WATER;
const gooseCanBe = (x, y) => inb(x, y) && World.terrain[idx(x, y)] !== T_ROCK && !World.bmap[idx(x, y)];

function spawnGeeseFlock() {
  const cx = MAP_W >> 1, cy = MAP_H >> 1;
  for (let k = 0; k < 400; k++) {
    const x = (Math.random() * MAP_W) | 0, y = (Math.random() * MAP_H) | 0;
    const d = Math.hypot(x - cx, y - cy);
    if (d < 10 || d > 28 || !isWaterAt(x, y)) continue;
    // вода рядом с берегом и достаточно места вокруг для плавания
    let shore = false, water = 0;
    for (let yy = y - 2; yy <= y + 2; yy++) for (let xx = x - 2; xx <= x + 2; xx++) {
      if (isWaterAt(xx, yy)) water++;
      else if (inb(xx, yy) && World.terrain[idx(xx, yy)] === T_SAND) shore = true;
    }
    if (!shore || water < 12) continue;
    const n = 3 + ((Math.random() * 2) | 0);
    for (let j = 0; j < n; j++) {
      const s = randomFreeNear(x, y, 0, 2, isWaterAt) || [x, y];
      const a = makeAnimal('goose', s[0], s[1]); a.home = [x, y]; Game.animals.push(a);
    }
    return true;
  }
  return false;
}

// Шаг гуся напрямик к точке; false — упёрся в скалу или дом
function gooseMove(a, tx, ty, speed, dt) {
  const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
  if (d < 0.05) { a.moving = false; return true; }
  const s = Math.min(d, speed * dt), nx = a.x + dx / d * s, ny = a.y + dy / d * s;
  if (!gooseCanBe(Math.floor(nx), Math.floor(ny))) { a.moving = false; return false; }
  a.x = nx; a.y = ny; a.moving = true;
  a.phase += s * (isWaterAt(Math.floor(a.x), Math.floor(a.y)) ? 2.5 : 5);
  if (Math.abs(dx) > 0.01) a.face = dx > 0 ? 1 : -1;
  return s >= d;
}

function updateGoose(a, dt, def) {
  a.swim = isWaterAt(Math.floor(a.x), Math.floor(a.y));
  const home = [a.home[0] + 0.5, a.home[1] + 0.5];
  if (a.state === 'chase') {
    const t = Game.unitMap.get(a.target);
    const far = Math.hypot(a.x - home[0], a.y - home[1]) > 15;
    if (!t || t.inside || Game.time > a.chaseUntil || far) {
      a.state = 'back'; a.calmUntil = Game.time + 8 + Math.random() * 8;
      return;
    }
    // по воде плывёт медленнее, по суше бежит
    if (!gooseMove(a, t.x, t.y, def.speed * (a.swim ? 0.7 : 1), dt)) { a.state = 'back'; return; }
    if (Math.hypot(t.x - a.x, t.y - a.y) < 0.75 && Game.time >= (a.biteCD || 0)) {
      gooseBite(a, t);
      a.biteCD = Game.time + 2.2;
      a.bites = (a.bites || 0) + 1;
      if (a.bites >= 3) { a.state = 'back'; a.calmUntil = Game.time + 14; }
    }
    if (Math.random() < dt * 0.9) floater(a.x, a.y - 1, 'Га-га!', '#ffffff');
    return;
  }
  if (a.state === 'back') {
    if (gooseMove(a, home[0], home[1], def.speed * 0.6, dt) || !a.moving) { a.state = 'wander'; a.tgt = null; }
    return;
  }
  if (a.think <= 0) {
    a.think = 0.5;
    if (Game.time >= (a.calmUntil || 0)) {
      const p = nearestPerson(a, 5.5, u => isPerson(u) && u.type !== 'carter' && !u.inside);
      if (p) {
        // вся стайка бросается на одного
        for (const g of Game.animals) {
          if (g.kind !== 'goose' || g.state === 'chase' || Math.hypot(g.x - a.x, g.y - a.y) > 4) continue;
          g.state = 'chase'; g.target = p.id; g.chaseUntil = Game.time + 8 + Math.random() * 3; g.bites = 0; g.think = 0;
        }
        scare(p, a);
        return;
      }
    }
  }
  // плавает по озеру неподалёку от своего берега
  if (a.tgt) { if (gooseMove(a, a.tgt[0], a.tgt[1], def.speed * 0.25, dt) || !a.moving) a.tgt = null; return; }
  a.moving = false;
  a.wait -= dt;
  if (a.wait <= 0) {
    a.wait = 1.5 + Math.random() * 4;
    const t = randomFreeNear(a.home[0], a.home[1], 0, 3.5, isWaterAt);
    if (t) a.tgt = [t[0] + 0.2 + Math.random() * 0.6, t[1] + 0.2 + Math.random() * 0.6];
  }
}

function gooseBite(a, u) {
  u.ouchUntil = Game.time + 2;
  floater(u.x, u.y - 1.4, 'Ай!', '#ffc8a0');
  if (!u.injury && Math.random() < 0.4) { injure(u, 'leg'); u.injuryUntil = Game.time + 40; }
  if (u.carry && Math.random() < 0.35) dropLoad(u);
  logEvent('animal', `Гуси щиплют: ${UNIT_TYPES[u.type].name.toLowerCase()}`, u.x, u.y);
  if (Game.time - lastGooseToast > 25) {
    lastGooseToast = Game.time;
    toast(`Гуси щиплют: ${UNIT_TYPES[u.type].name.toLowerCase()} удирает со всех ног!`);
  }
  scare(u, a);
}

// Гнома гонят — он бросает всё (если может) и удирает, размахивая руками
function scare(u, a) {
  if (u.brk && u.brk.kind === 'flee') return;
  if (!interruptible(u) && !(u.brk && (u.brk.kind === 'smoke' || u.brk.kind === 'join'))) return;
  if (u.brk) endBreak(u);
  startBreak(u, 'flee', null);
  u.proc = fleeGen(u, a);
}

function* fleeGen(u, a) {
  u.fleeUntil = Game.time + 5;
  u.gest = 'wave'; u.gestUntil = Game.time + 5; u.gestFace = u.x > a.x ? -1 : 1;
  for (let k = 0; k < 2; k++) {
    const dx = u.x - a.x, dy = u.y - a.y, d = Math.hypot(dx, dy) || 1;
    const tx = Math.round(u.x + dx / d * 4), ty = Math.round(u.y + dy / d * 4);
    const s = randomFreeNear(tx, ty, 0, 2, (x, y) => isWalkable(x, y) && !World.door[idx(x, y)]);
    if (!s) break;
    yield { walk: s, offroad: true };
  }
  u.fleeUntil = 0;
  yield { wait: 0.6, anim: 'duck' };     // отдышаться
}

// ---------- Досуг ----------

function* leisureGen(u) {
  u.nextLeisure = Game.time + 25 + Math.random() * 45;
  u.idleStreak = 0;
  const x = Math.floor(u.x), y = Math.floor(u.y);
  const tree = findObjNear(x, y, 15, o => o.t === 'tree' && o.g >= 1);
  const hen = nearestAnimal(u.x, u.y, 12, a => a.kind === 'chicken');
  const bench = freeBench(u, 12);
  const opts = ['butterfly'];
  if (tree) opts.push('mushrooms', 'mushrooms', 'gold');
  if (hen) opts.push('chicken', 'chicken');
  if (bench) opts.push('bench', 'bench', 'bench');
  const what = opts[(Math.random() * opts.length) | 0];
  if (what === 'bench') yield* benchGen(u, bench);
  else if (what === 'mushrooms') yield* mushroomsGen(u, tree);
  else if (what === 'gold') yield* rootGoldGen(u, tree);
  else if (what === 'chicken') yield* chickenGen(u, hen);
  else yield* butterflyGen(u);
}

// подойти к клетке рядом с деревом
function* toTree(u, tree) {
  const s = randomFreeNear(tree.x, tree.y, 1, 1.5, (xx, yy) => isWalkable(xx, yy) && !World.door[idx(xx, yy)]);
  if (!s) return false;
  const ok = yield { walk: s, offroad: true };
  if (ok) { u.face = tree.x + 0.5 > u.x ? 1 : -1; u.vdir = 'E'; }
  return ok;
}

function* mushroomsGen(u, tree) {
  if (!(yield* toTree(u, tree))) return;
  const n = 2 + ((Math.random() * 3) | 0);
  for (let k = 0; k < n; k++) {
    yield { wait: 1.1, anim: 'forage' };
    if (Math.random() < 0.7) {
      floater(u.x, u.y - 0.8, null, null, 'mushroom');
      u.food = Math.min(1, u.food + 0.03);       // грибок в рот
    }
    yield { wait: 0.4 };
  }
}

function* rootGoldGen(u, tree) {
  if (!(yield* toTree(u, tree))) return;
  for (let k = 0; k < 5; k++) yield { wait: HIT_TIME * 1.4, anim: 'dig' };
  if (Math.random() > 0.18) {
    u.gest = 'scratch'; u.gestUntil = Game.time + 1.6;       // пусто — чешет затылок
    yield { wait: 1.6 };
    return;
  }
  // нашёл самородок — несёт на склад, по дороге его уже не перебивают
  floater(u.x, u.y - 1.2, 'Золото!', '#f6d458', 'gold');
  logEvent('gold', `${UNIT_TYPES[u.type].name} нашёл золото в корнях дерева`, u.x, u.y);
  if (Game.time - lastGoldToast > 30) { lastGoldToast = Game.time; toast(`${UNIT_TYPES[u.type].name} нашёл золото в корнях дерева!`); }
  u.idleFlag = false;
  u.carry = 'gold'; u.carryN = 1;
  const st = nearestStore(u.x, u.y, 'gold') || nearestStore(u.x, u.y);
  if (!st) { dropPile(Math.floor(u.x), Math.floor(u.y), 'gold', 1); u.carry = null; return; }
  const ok = yield { walk: [st.doorX, st.doorY], offroad: true };
  if (!u.carry) return;
  if (ok && !st.removed) st.stock.gold += 1;
  else dropPile(Math.floor(u.x), Math.floor(u.y), 'gold', 1);
  u.carry = null; u.carryN = 0;
}

function* butterflyGen(u) {
  const b = spawnButterfly(u.x + (Math.random() - 0.5) * 4, u.y + (Math.random() - 0.5) * 4);
  b.chaser = u.id; b.life = 30;
  for (let k = 0; k < 5 && b.life > 0; k++) {
    u.gest = 'stretch'; u.gestUntil = Game.time + 3;
    const s = [Math.floor(b.x), Math.floor(b.y)];
    if (!inb(s[0], s[1]) || !isWalkable(s[0], s[1])) break;
    yield { walk: s, offroad: true };
  }
  b.chaser = 0;
  u.gest = Math.random() < 0.5 ? 'wave' : 'scratch'; u.gestUntil = Game.time + 1.5;   // упорхнула
  yield { wait: 1.2 };
}

const CHICKEN_CATCH = 0.22;     // шанс схватить курицу, если догнал вплотную

function* chickenGen(u, hen) {
  for (let k = 0; k < 5 && !hen.dead; k++) {
    u.gest = 'wave'; u.gestUntil = Game.time + 3;
    yield { walk: [Math.floor(hen.x), Math.floor(hen.y)], offroad: true };
    if (Math.random() < 0.3) floater(hen.x, hen.y - 0.8, 'Ко-ко!', '#ffffff');
    if (!hen.dead && Math.hypot(hen.x - u.x, hen.y - u.y) < 1.3 && Math.random() < CHICKEN_CATCH) {
      // поймал! тушку — на склад, оттуда трудяги отнесут в трактир
      removeAnimal(hen);
      floater(u.x, u.y - 1.2, 'Поймал!', '#fff2a0');
      sfxUnit(u, 'cluck');
      logEvent('food', `${UNIT_TYPES[u.type].name} поймал курицу`, u.x, u.y);
      if (Game.time - lastHenToast > 40) { lastHenToast = Game.time; toast(`${UNIT_TYPES[u.type].name} поймал курицу — тушку отнесут в трактир`); }
      u.idleFlag = false;
      u.carry = 'chicken'; u.carryN = 1;
      const st = nearestStore(u.x, u.y, 'chicken');
      const ok = st && (yield { walk: [st.doorX, st.doorY], offroad: true });
      if (u.carry) {
        if (ok && !st.removed) st.stock.chicken += 1;
        else dropPile(Math.floor(u.x), Math.floor(u.y), 'chicken', 1);
        u.carry = null; u.carryN = 0;
      }
      return;
    }
  }
  // упорхнула — чешет затылок
  u.gest = 'scratch'; u.gestUntil = Game.time + 1.6;
  yield { wait: 1.4 };
}
let lastHenToast = -999;

// ---------- Совы ----------
// Садятся на коньки крыш и трубы, моргают, вертят головой, ухают,
// посидев — перелетают на другой дом или улетают в лес и возвращаются.

const OWL_COUNT = 4;

// Точки на верхнем крае крыши здания (в мировых пикселях): считаются один раз
// при создании спрайта здания (roofTopPoints), здесь только переводятся на карту
function roofPerches(b) {
  const spr = buildingSprite(b.type, b.rot || 0);
  if (!spr.perches) spr.perches = [];
  const ox = b.x * TILE - spr.padx, oy = b.y * TILE - spr.top;
  const ground = (b.y + b.h) * TILE + 10;                 // куда упадёт выроненная вещь — перед фасадом
  return spr.perches.map(([x, y]) => [ox + x, oy + y + 1, ground]);
}

function pickPerch(owl) {
  const homes = Game.buildings.filter(b => b.state === 'done' && b.type !== 'magiccircle' && b.type !== 'bonfire');
  if (!homes.length) return null;
  for (let t = 0; t < 6; t++) {
    const b = homes[(Math.random() * homes.length) | 0];
    const ps = roofPerches(b);
    if (!ps.length) continue;
    const p = ps[(Math.random() * ps.length) | 0];
    if (Game.owls.some(o => o !== owl && o.to && Math.hypot(o.to[0] - p[0], o.to[1] - p[1]) < 8)) continue;
    return p;
  }
  return null;
}

const OWL_ITEM_CHANCE = 0.4;
let lastOwlToast = -999;

// Вещь выскальзывает из когтей и летит вниз с крыши
function owlDrop(o) {
  const g = o.item; o.item = null;
  (Game.falling = Game.falling || []).push({ x: o.x, y: o.y, vy: -30, vx: (Math.random() - 0.5) * 30, rot: 0, vr: (Math.random() - 0.5) * 9, g, ground: o.ground || o.y + 40 });
  logEvent('owl', `Сова уронила с крыши: ${GOODS[g].name.toLowerCase()}`, o.x / TILE, (o.ground || o.y + 40) / TILE);
  if (Game.time - lastOwlToast > 45) { lastOwlToast = Game.time; toast(`Сова уронила с крыши: ${GOODS[g].name.toLowerCase()}! Трудяги подберут`); }
}

function updateFalling(dt) {
  const list = Game.falling || [];
  for (let i = list.length - 1; i >= 0; i--) {
    const f = list[i];
    f.vy += 320 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt;
    if (f.y < f.ground) continue;
    // упала: кучка на земле (или рядом, если там дом), пыль от удара
    list.splice(i, 1);
    const tx = Math.floor(f.x / TILE), ty = Math.floor(f.ground / TILE);
    dropPile(Math.max(0, Math.min(MAP_W - 1, tx)), Math.max(0, Math.min(MAP_H - 1, ty)), f.g, 1);
    floater(f.x / TILE, f.ground / TILE - 0.3, 'Бух!', '#d8c8a0');
  }
}

function forestPoint() {
  const s = wildSpot(14, true);
  return s ? [s[0] * TILE + 16, s[1] * TILE - 10] : [Math.random() * MAP_W * TILE, -40];
}

function updateOwls(dt) {
  Game.owls = Game.owls || [];
  if (Game.buildings.filter(b => b.state === 'done').length < 2) return;
  while (Game.owls.length < OWL_COUNT) {
    const p = forestPoint();
    Game.owls.push({ x: p[0], y: p[1], from: p, to: null, state: 'away', t: Math.random() * 20, ph: Math.random() * 10, look: 0, blink: 0 });
  }
  for (const o of Game.owls) {
    o.ph += dt;
    o.t -= dt;
    if (o.state === 'fly') {
      o.f = Math.min(1, o.f + dt * o.speed);
      const [ax, ay] = o.from, [bx, by] = o.to;
      const lift = Math.min(60, Math.hypot(bx - ax, by - ay) * 0.3);
      o.x = ax + (bx - ax) * o.f;
      o.y = ay + (by - ay) * o.f - Math.sin(o.f * Math.PI) * lift;
      o.face = bx > ax ? 1 : -1;
      if (o.f >= 1) {
        o.x = bx; o.y = by;
        if (o.goAway) { o.state = 'away'; o.t = 15 + Math.random() * 30; }
        else {
          o.state = 'perch'; o.t = 14 + Math.random() * 30; o.ground = o.to[2];
          if (o.item) floater(o.x / TILE, o.y / TILE - 0.9, `${GOODS[o.item].name}?`, '#fff2a0');
        }
      }
    } else if (o.t <= 0) {
      // пора лететь: чаще на другую крышу, иногда в лес
      const away = o.state === 'perch' && Math.random() < 0.3;
      const to = away ? forestPoint() : pickPerch(o);
      if (!to) { o.t = 5; continue; }
      if (o.state === 'away') {
        // из леса сова нередко несёт находку — что угодно
        o.item = Math.random() < OWL_ITEM_CHANCE ? GOOD_KEYS[(Math.random() * GOOD_KEYS.length) | 0] : null;
      } else if (o.item) owlDrop(o);                     // взлетая, роняет вещь
      o.from = [o.x, o.y]; o.to = to; o.f = 0; o.goAway = away; o.state = 'fly';
      o.speed = 70 / Math.max(40, Math.hypot(to[0] - o.x, to[1] - o.y));
    }
    if (o.state === 'perch') {
      if (Math.random() < dt * 0.25) o.look = (Math.random() * 3 | 0) - 1;       // повернуть голову
      if (Math.random() < dt * 0.5) o.blink = 0.18;
      o.blink = Math.max(0, o.blink - dt);
      if (Math.random() < dt * 0.03) floater(o.x / TILE, o.y / TILE - 0.6, 'У-ху!', '#e8e0c8');
    }
  }
}

// ---------- Сова: реалистичный спрайт ----------
// Рисуется со сверхвыборкой и кэшируется по позе: сидит (взгляд влево/прямо/вправо,
// моргает) или летит (три положения крыльев). Неясыть: бурая с рыжиной, полосатая
// грудка, светлый лицевой диск с тёмной каймой, оранжевые глаза, пучки-«ушки».

const OWL_SS = 6;
const OWL_CACHE = new Map();
const OWL_W = 16, OWL_H = 20, OWL_FX = 8, OWL_FY = 19;       // сидящая: размер и точка лап
const OWLF_W = 34, OWLF_H = 20, OWLF_FX = 17, OWLF_FY = 11;  // летящая: центр тела

function owlFeathers(c, x, y, w, h, base, n, r) {
  // мелкая рябь перьев: дужки светлее и темнее основы
  for (let k = 0; k < n; k++) {
    const fx = x + r() * w, fy = y + r() * h;
    c.strokeStyle = r() < 0.5 ? shade(base, 0.25) : shade(base, -0.35);
    c.lineWidth = 0.18;
    c.beginPath(); c.arc(fx, fy, 0.5 + r() * 0.5, 0.2, Math.PI - 0.2); c.stroke();
  }
}

function drawOwlPerched(c, look, blink, r) {
  const L = look * 0.9;
  // хвост
  c.fillStyle = '#4a2e18'; c.beginPath(); c.moveTo(-2.2, -3); c.lineTo(2.2, -3); c.lineTo(1.4, 0.4); c.lineTo(-1.4, 0.4); c.closePath(); c.fill();
  // тело-капля
  c.fillStyle = radgrad(c, -1.2, -8, 0.5, 7.5, [[0, '#b88a58'], [0.6, '#8a5e36'], [1, '#4a2e18']]);
  c.beginPath(); c.moveTo(0, -13); c.bezierCurveTo(5.4, -13, 5.6, -4, 3.2, -1.4); c.quadraticCurveTo(0, 0.4, -3.2, -1.4); c.bezierCurveTo(-5.6, -4, -5.4, -13, 0, -13); c.fill();
  // светлая грудка с продольными пестринами и поперечной рябью
  c.fillStyle = radgrad(c, 0, -7, 0.4, 4, [[0, '#ecd6ac'], [1, '#c8a070']]);
  c.beginPath(); c.ellipse(0, -6.6, 2.7, 4.6, 0, 0, Math.PI * 2); c.fill();
  for (let k = 0; k < 14; k++) {
    const sx = -2 + r() * 4, sy = -10.4 + r() * 7.4;
    c.strokeStyle = 'rgba(74,46,24,0.85)'; c.lineWidth = 0.32;
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + (r() - 0.5) * 0.3, sy + 0.9 + r() * 0.6); c.stroke();
    c.strokeStyle = 'rgba(120,80,40,0.5)'; c.lineWidth = 0.15;
    c.beginPath(); c.moveTo(sx - 0.5, sy + 0.4); c.lineTo(sx + 0.5, sy + 0.4); c.stroke();
  }
  // сложенные крылья: тёмные, со светлыми пятнышками кроющих и кромками маховых
  for (const s of [-1, 1]) {
    c.fillStyle = lingrad(c, s * 4.6, 0, s * 1.8, 0, [[0, '#3e2412'], [1, '#7a5030']]);
    c.beginPath(); c.moveTo(s * 2, -11); c.bezierCurveTo(s * 5.2, -10, s * 5.4, -4, s * 3.4, -0.6); c.lineTo(s * 2.2, -1.6); c.bezierCurveTo(s * 2.8, -5, s * 2.6, -8, s * 2, -11); c.fill();
    for (let k = 0; k < 5; k++) ellipse(c, s * (3.2 + r() * 1.2), -9.6 + k * 1.6, 0.35, 0.28, '#e0c89a');
    c.strokeStyle = 'rgba(20,10,4,0.6)'; c.lineWidth = 0.18;
    for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(s * 2.4, -4 + k * 1); c.quadraticCurveTo(s * 3.8, -3 + k, s * 3.6, -1.8 + k * 0.4); c.stroke(); }
  }
  owlFeathers(c, -4.5, -12.5, 9, 11, '#8a5e36', 40, r);
  // голова
  c.save(); c.translate(L * 0.35, 0); c.rotate(look * 0.06);
  c.fillStyle = radgrad(c, -1, -16.6, 0.5, 6, [[0, '#a87a4a'], [1, '#5a3a20']]);
  c.beginPath(); c.ellipse(0, -15.6, 4.9, 4.2, 0, 0, Math.PI * 2); c.fill();
  // перьевые «ушки»
  for (const s of [-1, 1]) {
    c.fillStyle = '#5a3a20';
    c.beginPath(); c.moveTo(s * 2.4, -18.6); c.quadraticCurveTo(s * 3.6, -21.6, s * 4.2, -22); c.quadraticCurveTo(s * 4, -19.6, s * 3.8, -18); c.closePath(); c.fill();
    c.strokeStyle = '#2e1a0c'; c.lineWidth = 0.2; c.beginPath(); c.moveTo(s * 2.8, -18.6); c.lineTo(s * 3.9, -21.6); c.stroke();
  }
  // лицевой диск: два светлых круга, радиальные пёрышки, тёмная кайма
  for (const s of [-1, 1]) {
    const dx = s * 1.75 + L * 0.25;
    c.fillStyle = '#3e2412'; c.beginPath(); c.ellipse(dx, -15.2, 2.35, 2.55, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = radgrad(c, dx, -15.2, 0.3, 2.3, [[0, '#7a5434'], [0.45, '#c8a478'], [1, '#d8b88a']]);
    c.beginPath(); c.ellipse(dx, -15.2, 2.1, 2.3, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(90,58,30,0.55)'; c.lineWidth = 0.14;
    for (let a = 0; a < Math.PI * 2; a += 0.35) { c.beginPath(); c.moveTo(dx + Math.cos(a) * 1.2, -15.2 + Math.sin(a) * 1.3); c.lineTo(dx + Math.cos(a) * 2.1, -15.2 + Math.sin(a) * 2.3); c.stroke(); }
    // глаз
    if (blink) {
      c.fillStyle = '#8a6440'; c.beginPath(); c.ellipse(dx, -15.3, 1.05, 0.95, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#2e1a0c'; c.lineWidth = 0.3; c.beginPath(); c.moveTo(dx - 0.9, -15.2); c.quadraticCurveTo(dx, -14.7, dx + 0.9, -15.2); c.stroke();
    } else {
      c.fillStyle = '#1a0e06'; c.beginPath(); c.ellipse(dx, -15.3, 1.1, 1.05, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = radgrad(c, dx, -15.3, 0.2, 0.95, [[0, '#ffd060'], [1, '#e07818']]);
      c.beginPath(); c.ellipse(dx, -15.3, 0.92, 0.88, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#0a0604'; c.beginPath(); c.ellipse(dx + look * 0.15, -15.3, 0.5, 0.52, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.ellipse(dx - 0.3, -15.65, 0.18, 0.16, 0, 0, Math.PI * 2); c.fill();
    }
  }
  // светлые «брови» и клюв
  c.strokeStyle = '#f0dcb4'; c.lineWidth = 0.35;
  c.beginPath(); c.moveTo(-2.4 + L * 0.25, -17.2); c.quadraticCurveTo(L * 0.25, -16.4, 2.4 + L * 0.25, -17.2); c.stroke();
  c.fillStyle = '#6a6460'; c.beginPath(); c.moveTo(-0.5 + L * 0.3, -14.6); c.lineTo(0.5 + L * 0.3, -14.6); c.quadraticCurveTo(0.3 + L * 0.3, -13, L * 0.3, -12.8); c.quadraticCurveTo(-0.3 + L * 0.3, -13, -0.5 + L * 0.3, -14.6); c.fill();
  c.fillStyle = '#c8b860'; c.fillRect(-0.2 + L * 0.3, -14.5, 0.3, 0.6);
  owlFeathers(c, -4.4, -19.4, 8.8, 3.6, '#7a5030', 14, r);
  c.restore();
  // лапы с когтями держат конёк
  for (const s of [-1, 1]) {
    c.fillStyle = '#e8d090'; c.beginPath(); c.ellipse(s * 1.3, -0.4, 0.9, 0.6, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#2a1a10'; c.lineWidth = 0.25;
    for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(s * 1.3 + k * 0.5, -0.1); c.quadraticCurveTo(s * 1.3 + k * 0.7, 0.5, s * 1.3 + k * 0.6, 0.9); c.stroke(); }
  }
}

function drawOwlFlying(c, frame, r) {
  // крылья: 0 — вверху, 1 — горизонтально, 2 — внизу
  const lift = [-5.5, -0.5, 3.6][frame];
  for (const s of [-1, 1]) {
    c.fillStyle = lingrad(c, 0, -3, 0, 4, [[0, '#9a6c40'], [1, '#5a3a20']]);
    c.beginPath();
    c.moveTo(s * 2, -1.6);
    c.bezierCurveTo(s * 7, -3 + lift * 0.6, s * 12, -2 + lift, s * 16, lift + 0.6);
    // «пальцы» маховых перьев на концах
    for (let k = 0; k < 4; k++) c.lineTo(s * (15.4 - k * 1.3), lift + 2.2 + k * 0.5);
    c.bezierCurveTo(s * 9, 2.2 + lift * 0.4, s * 5, 2.6, s * 2, 2);
    c.closePath(); c.fill();
    // поперечные полосы на маховых и светлые пятна на кроющих
    c.strokeStyle = 'rgba(40,22,10,0.6)'; c.lineWidth = 0.35;
    for (let k = 1; k < 5; k++) {
      const t = k / 5;
      c.beginPath(); c.moveTo(s * (2 + 13 * t), -1.2 + lift * t); c.lineTo(s * (2.6 + 12.4 * t), 1.6 + lift * t * 0.8); c.stroke();
    }
    for (let k = 0; k < 6; k++) ellipse(c, s * (3 + r() * 6), -0.6 + lift * 0.2 + r() * 1.4, 0.4, 0.3, '#e0c89a');
  }
  // тело и голова
  c.fillStyle = radgrad(c, 0, -1, 0.5, 4, [[0, '#c89a68'], [1, '#6e4a2c']]);
  c.beginPath(); c.ellipse(0, 0.4, 2.6, 4, 0, 0, Math.PI * 2); c.fill();
  for (let k = 0; k < 6; k++) { c.strokeStyle = 'rgba(74,46,24,0.8)'; c.lineWidth = 0.28; const y = -1.6 + k * 0.9; c.beginPath(); c.moveTo(-1.2, y); c.lineTo(1.2, y); c.stroke(); }
  c.fillStyle = '#8a6440'; c.beginPath(); c.ellipse(0, -3.4, 2.6, 2.2, 0, 0, Math.PI * 2); c.fill();
  for (const s of [-1, 1]) {
    c.fillStyle = '#d0ae80'; c.beginPath(); c.ellipse(s * 1.1, -3.3, 1.15, 1.25, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e07818'; c.beginPath(); c.ellipse(s * 1.1, -3.3, 0.55, 0.55, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#0a0604'; c.fillRect(s * 1.1 - 0.2, -3.5, 0.4, 0.4);
  }
  c.fillStyle = '#6a6460'; c.beginPath(); c.moveTo(-0.3, -2.6); c.lineTo(0.3, -2.6); c.lineTo(0, -1.6); c.fill();
  // поджатые лапы
  c.fillStyle = '#e8d090'; c.fillRect(-1.2, 4, 0.8, 0.9); c.fillRect(0.4, 4, 0.8, 0.9);
}

function owlSprite(kind, look, blink, frame) {
  const key = kind === 'fly' ? 'f' + frame : `p${look}${blink ? 1 : 0}`;
  let cv = OWL_CACHE.get(key);
  if (cv) return cv;
  const fly = kind === 'fly';
  const W = fly ? OWLF_W : OWL_W, H = fly ? OWLF_H : OWL_H;
  const [c2, c] = mkSprite(W, H, OWL_SS);
  c.translate(fly ? OWLF_FX : OWL_FX, fly ? OWLF_FY : OWL_FY);
  const r = mulberry32(fly ? 41 : 17);
  if (fly) drawOwlFlying(c, frame, r); else drawOwlPerched(c, look, blink, r);
  OWL_CACHE.set(key, c2);
  return c2;
}

function drawOwls(c) {
  const prev = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  for (const o of Game.owls || []) {
    if (o.state === 'away') continue;
    const x = o.x, y = o.y;
    if (o.state === 'fly') {
      // тень скользит по земле под совой
      const gy = o.to[1] + (o.from[1] - o.to[1]) * (1 - o.f) + 34;
      c.fillStyle = 'rgba(10,8,4,0.18)'; c.beginPath(); c.ellipse(x, gy, 8, 2, 0, 0, 7); c.fill();
      const fr = [0, 1, 2, 1][Math.floor(o.ph * 10) & 3];
      const spr = owlSprite('fly', 0, 0, fr);
      c.save(); c.translate(x, y); if (o.face < 0) c.scale(-1, 1);
      if (o.item) { c.save(); c.translate(0, 6); c.scale(0.4, 0.4); drawLoad(c, o.item); c.restore(); }
      c.drawImage(spr, -OWLF_FX, -OWLF_FY, OWLF_W, OWLF_H);
      c.restore();
      continue;
    }
    // сидит на крыше; принесённую вещь держит в лапах
    if (o.item) { c.save(); c.translate(x + 0.5, y + 0.6); c.scale(0.38, 0.38); drawLoad(c, o.item); c.restore(); }
    const spr = owlSprite('perch', o.look, o.blink > 0, 0);
    c.drawImage(spr, x - OWL_FX, y - OWL_FY, OWL_W, OWL_H);
  }
  // вещи, которые сова выронила, — падают на землю
  for (const f of Game.falling || []) {
    c.save(); c.translate(f.x, f.y); c.rotate(f.rot); c.scale(0.45, 0.45); drawLoad(c, f.g); c.restore();
  }
  c.imageSmoothingEnabled = prev;
}
