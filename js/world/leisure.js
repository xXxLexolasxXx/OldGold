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
  const fl = Game.floaters || (Game.floaters = []);
  fl.push({ x, y, text, col, icon, t0: Game.time });
  if (fl.length > 120) fl.splice(0, fl.length - 120);   // убираются при отрисовке; без неё (вкладка в фоне) копились бы бесконечно
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
  if (!isNightNow() && !(typeof WX !== 'undefined' && WX.k > 0.3) && list.filter(b => !b.chaser).length < 10 && Math.random() < dt * 0.5) {
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
      const a = makeAnimal('goose', s[0], s[1]); a.home = [x, y]; a.lake = [x, y]; Game.animals.push(a);
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

// Гуси не маячат у склада: ни стайка, ни её прогулки не ближе этого радиуса к его двери
const GOOSE_STORE_R = 9;
function nearStorehouse(x, y, r) {
  for (const b of Game.buildings) if (b.type === 'storehouse' && !b.removed && Math.hypot(b.doorX - x, b.doorY - y) < r) return true;
  return false;
}

function updateGoose(a, dt, def) {
  if (gooseShooTick(a, dt, def)) return;      // прогон: трое гномов или герой (fauna.js)
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
    gooseMove(a, t.x, t.y, def.speed * (a.swim ? 0.7 : 1), dt);
    if (!a.moving && Math.hypot(t.x - a.x, t.y - a.y) > 0.75) { a.state = 'back'; return; }   // упёрся в скалу или дом
    if (Math.hypot(t.x - a.x, t.y - a.y) < 0.75 && Game.time >= (a.biteCD || 0)) {
      if (gooseBite(a, t)) return;
      a.biteCD = Game.time + 2.2;
      a.bites = (a.bites || 0) + 1;
      if (a.bites >= 3) { a.state = 'back'; a.calmUntil = Game.time + 14; }
    }
    if (Math.random() < dt * 0.9) floater(a.x, a.y - 1, 'Га-га!', '#ffffff');
    return;
  }
  if (a.state === 'flee') {      // гусь удирает с украденным к своему берегу
    if (gooseMove(a, home[0], home[1], def.speed * (Game.time < (a.fleeBoost || 0) ? 1.2 : 0.95), dt) || !a.moving) {
      a.state = 'wander'; a.loot = null; a.calmUntil = Game.time + 20; a.tgt = null;
    }
    return;
  }
  if (a.state === 'back') {
    if (gooseMove(a, home[0], home[1], def.speed * 0.6, dt) || !a.moving) { a.state = 'wander'; a.tgt = null; }
    return;
  }
  if (a.think <= 0) {
    a.think = 0.5;
    if (Game.time >= (a.calmUntil || 0)) {
      const p = startOpen('thieves') ? nearestPerson(a, 5.5, u => isPerson(u) && u.type !== 'carter' && !u.inside) : null;
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
  // бродит по берегу и суше неподалёку от своего берега
  if (a.tgt) { if (gooseMove(a, a.tgt[0], a.tgt[1], def.speed * (a.swim ? 0.25 : 0.4), dt) || !a.moving) a.tgt = null; return; }
  a.moving = false;
  a.wait -= dt;
  if (a.wait <= 0) {
    a.wait = 1.5 + Math.random() * 4;
    if (Math.random() < 0.2) {       // стайка понемногу подбирается к деревне, но не вплотную
      const cx = MAP_W >> 1, cy = MAP_H >> 1;
      if (Game.time >= (a.shyUntil || 0) && Math.hypot(a.home[0] - cx, a.home[1] - cy) > 14) {
        const nh = [Math.round(a.home[0] + Math.sign(cx - a.home[0])), Math.round(a.home[1] + Math.sign(cy - a.home[1]))];
        if (!nearStorehouse(nh[0], nh[1], GOOSE_STORE_R + 4)) a.home = nh;    // к складу стайка не подбирается
      }
    }
    if (a.lake && nearStorehouse(a.home[0], a.home[1], GOOSE_STORE_R + 2)) a.home = [a.lake[0], a.lake[1]];     // уже «прописалась» у склада — возвращается на озеро
    const t = randomFreeNear(a.home[0], a.home[1], 0, 7, (x, y) => gooseCanBe(x, y) && !World.door[idx(x, y)] && !nearStorehouse(x, y, GOOSE_STORE_R));
    if (t) a.tgt = [t[0] + 0.2 + Math.random() * 0.6, t[1] + 0.2 + Math.random() * 0.6];
  }
}

function gooseBite(a, u) {
  u.ouchUntil = Game.time + 2;
  floater(u.x, u.y - 1.4, 'Ай!', '#ffc8a0');
  if (!u.injury && Game.time >= (Game.injGapAt || 0) && Math.random() < 0.08) { Game.injGapAt = Game.time + INJURY_GAP; injure(u, 'leg'); u.injuryUntil = Game.time + 40; }   // общий с толчками лимит: щиплют часто, ранят редко
  let stole = false;
  if (u.carry && Math.random() < 0.45) {       // гусь вырывает груз и удирает с ним
    const g = u.carry;
    u.carryN = Math.max(0, (u.carryN || 1) - 1);
    if (!u.carryN) u.carry = null;
    a.loot = g; a.state = 'flee'; a.target = null; a.fleeBoost = 0; stole = true;
    logEvent('animal', `Гусь утащил «${GOODS[g].name}»`, a.x, a.y);
    toast(`Гусь утащил «${GOODS[g].name}»!`);
  }
  logEvent('animal', `Гуси щиплют: ${UNIT_TYPES[u.type].name.toLowerCase()}`, u.x, u.y);
  if (Game.time - lastGooseToast > 25) {
    lastGooseToast = Game.time;
    toast(`Гуси щиплют: ${UNIT_TYPES[u.type].name.toLowerCase()} удирает со всех ног!`);
  }
  scare(u, a);
  if (stole) dispatchHunters(a);
  return stole;
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
  const extra = leisureExtra(u);              // новые забавы, параплан и питомцы (pets.js)
  if (extra) { yield* extra; return; }
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
  b.chaser = u.id; b.life = 30; u.netUntil = Game.time + 6;
  for (let k = 0; k < 5 && b.life > 0; k++) {
    u.netUntil = Game.time + 6;   // с сачком в руке
    u.gest = ''; u.gestUntil = 0;
    const s = [Math.floor(b.x), Math.floor(b.y)];
    if (!inb(s[0], s[1]) || !isWalkable(s[0], s[1])) break;
    yield { walk: s, offroad: true };
  }
  b.chaser = 0;
  u.netUntil = 0;
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
        if (ok && !st.removed) { st.stock.chicken += 1; if (Math.random() < 0.12) triggerAvenge(u); }
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
  const spr = buildingSprite(b.type, b.rot || 0, b.level, undefined, b.hv || 0);
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
// мусор и куски курицы склад не принимает — такая находка пролежала бы на земле вечно
const OWL_GOODS = GOOD_KEYS.filter(g => !GOODS[g].noStore);
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
    if (o.state === 'grab') { owlGrabTick(o, dt); continue; }       // уносит добычу (grab.js)
    if (o.state === 'fly') {
      o.f = Math.min(1, o.f + dt * o.speed);
      const [ax, ay] = o.from, [bx, by] = o.to;
      const lift = Math.min(60, Math.hypot(bx - ax, by - ay) * 0.3);
      o.x = ax + (bx - ax) * o.f;
      o.y = ay + (by - ay) * o.f - Math.sin(o.f * Math.PI) * lift;
      o.face = bx > ax ? 1 : -1;
      if (o.f >= 1) {
        o.x = bx; o.y = by;
        if (o.hunt) { owlEat(o); continue; }
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
        o.item = Math.random() < OWL_ITEM_CHANCE ? OWL_GOODS[(Math.random() * OWL_GOODS.length) | 0] : null;
      } else if (o.item) { if (startOpen('owls')) owlDrop(o); else o.item = null; }     // взлетая, роняет вещь
      o.from = [o.x, o.y]; o.to = to; o.f = 0; o.goAway = away; o.state = 'fly';
      o.speed = 70 / Math.max(40, Math.hypot(to[0] - o.x, to[1] - o.y));
    }
    if (o.state === 'perch') {
      if (Math.random() < dt * 0.25) o.look = (Math.random() * 3 | 0) - 1;       // повернуть голову
      if (Math.random() < dt * 0.5) o.blink = 0.18;
      o.blink = Math.max(0, o.blink - dt);
      if (Math.random() < dt * 0.03) floater(o.x / TILE, o.y / TILE - 0.6, 'У-ху!', '#e8e0c8');
      const prey = owlCanTake(o, dt);
      if (prey) { owlTakes(o, prey); continue; }              // с третьей ночи — гном или зверь
      owlHunt(o, dt);
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
  // 0..2 — опорные позы (захват, grab.js); 10..17 — 8 кадров полётного взмаха
  const wa = frame >= 10 ? Math.cos((frame - 10) / 8 * Math.PI * 2) : 0;
  const lift = frame >= 10 ? (wa >= 0 ? -0.5 - 5 * wa : -0.5 - 4.1 * wa) : [-5.5, -0.5, 3.6][frame];
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
  const paint = c => { const r = mulberry32(fly ? 41 : 17); if (fly) drawOwlFlying(c, frame, r); else drawOwlPerched(c, look, blink, r); };
  if (afFine()) cv = afVec(W, H, fly ? OWLF_FX : OWL_FX, fly ? OWLF_FY : OWL_FY, paint);   // мелкий пиксель ×3 (animalart.js)
  else { const [c2, c] = mkSprite(W, H, OWL_SS); c.translate(fly ? OWLF_FX : OWL_FX, fly ? OWLF_FY : OWL_FY); paint(c); cv = c2; }
  OWL_CACHE.set(key, cv);
  return cv;
}

function drawOwls(c) {
  const prev = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  for (const o of Game.owls || []) {
    if (o.state === 'grab') { drawOwlGrab(c, o); continue; }
    if (o.state === 'away') continue;
    const x = o.x, y = o.y;
    if (o.state === 'fly') {
      // тень скользит по земле под совой
      const gy = o.to[1] + (o.from[1] - o.to[1]) * (1 - o.f) + 34;
      c.fillStyle = 'rgba(10,8,4,0.18)'; c.beginPath(); c.ellipse(x, gy, 8, 2, 0, 0, 7); c.fill();
      const fr = 10 + (Math.floor(o.ph * 20) & 7);   // 8 кадров взмаха
      const spr = owlSprite('fly', 0, 0, fr);
      c.save(); c.translate(x, y); if (o.face < 0) c.scale(-1, 1);
      if (o.item) { c.save(); c.translate(0, 6); c.scale(0.4, 0.4); drawLoad(c, o.item); c.restore(); }
      afBlit(c, spr, -OWLF_FX, -OWLF_FY, OWLF_W, OWLF_H);
      c.restore();
      continue;
    }
    // сидит на крыше; принесённую вещь держит в лапах
    if (o.item) { c.save(); c.translate(x + 0.5, y + 0.6); c.scale(0.38, 0.38); drawLoad(c, o.item); c.restore(); }
    const spr = owlSprite('perch', o.look, o.blink > 0, 0);
    afBlit(c, spr, x - OWL_FX, y - OWL_FY, OWL_W, OWL_H);
  }
  // вещи, которые сова выронила, — падают на землю
  for (const f of Game.falling || []) {
    c.save(); c.translate(f.x, f.y); c.rotate(f.rot); c.scale(0.45, 0.45); drawLoad(c, f.g); c.restore();
  }
  c.imageSmoothingEnabled = prev;
}

// ---------- Месть кур ----------
// Гном, отнёсший курицу в таверну, может поплатиться: куры сбегаются стаей, окружают его,
// заклёвывают и оттаскивают в сторонку (не насовсем; изредка — с ушибом ноги). Фазы: gather (сбегаются) → peck (клюют) → drag (тащат) → конец.

function triggerAvenge(u) {
  if (dif().noLoss) return;   // «Спокойный»: куры не мстят насмерть
  if (Game.avenge && Game.avenge.some(ev => ev.vid === u.id)) return;
  let hens = Game.animals.filter(a => a.kind === 'chicken' && !a.dead);
  // не хватает кур — набегают соседки с птичьего двора
  const st = storeB0();
  while (hens.length < 4 && st) {
    const s = randomFreeNear(Math.floor(u.x), Math.floor(u.y), 3, 8, (x, y) => isWalkable(x, y) && !World.road[idx(x, y)]);
    if (!s) break;
    const a = makeAnimal('chicken', s[0], s[1]); a.home = [st.doorX, st.doorY + 3]; Game.animals.push(a); hens.push(a);
  }
  hens.sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y));
  hens = hens.slice(0, 8);
  const a0 = Math.random() * Math.PI * 2;
  const ev = { vid: u.id, phase: 'gather', t: 0, hens, a0, dir: [Math.cos(a0 + 1), Math.sin(a0 + 1)], pk: 0 };
  hens.forEach((h, k) => { h.avenge = ev; h.slot = k; h.path = null; h.state = 'avenge'; });
  (Game.avenge = Game.avenge || []).push(ev);
  floater(u.x, u.y - 1.6, 'Куд-куда-кудах!', '#ffffff');
  sfxAt('cluck', u.x * TILE, u.y * TILE, 1.2);
}

function* peckedGen(u, ev) {
  while (!u.dead && (ev.phase === 'peck' || ev.phase === 'drag')) yield { wait: 0.25, anim: ev.phase === 'peck' ? 'freeze' : 'knocked' };
}

function avengeHen(a, dt) {
  const ev = a.avenge, u = ev && Game.unitMap.get(ev.vid);
  if (!ev || ev.phase === 'done' || !u || u.dead) { a.avenge = null; a.state = 'wander'; a.loot = null; return; }
  const R = ev.phase === 'gather' ? 1.0 : 0.95;
  const ang = ev.a0 + a.slot / ev.hens.length * Math.PI * 2;
  const tx = u.x + Math.cos(ang) * R, ty = u.y + Math.sin(ang) * R * 0.8;
  const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
  const sp = ev.phase === 'drag' ? 1.6 : 2.9;
  if (d > 0.12) {
    const s = Math.min(d, sp * dt); a.x += dx / d * s; a.y += dy / d * s; a.moving = true; a.phase += s * 5;
    if (Math.abs(dx) > 0.01) a.face = dx > 0 ? 1 : -1; a.loot = null;
  } else {
    a.moving = false; a.face = u.x > a.x ? 1 : -1;
    a.loot = ev.phase === 'peck' && (Math.floor(Game.time * 7 + a.id) & 1) ? 'peck' : null;   // клюёт
  }
}

function avengeTick(dt) {
  const list = Game.avenge;
  if (!list || !list.length) return;
  for (let i = list.length - 1; i >= 0; i--) {
    const ev = list[i], u = Game.unitMap.get(ev.vid);
    ev.t += dt;
    if (!u || u.dead) { ev.phase = 'done'; }
    else if (ev.phase === 'gather') {
      const near = ev.hens.filter(h => !h.dead && Math.hypot(h.x - u.x, h.y - u.y) < 1.5).length;
      if (near >= Math.min(3, ev.hens.length)) {
        ev.phase = 'peck'; ev.t = 0;
        if (u.carry) dropLoad(u);
        startBreak(u, 'pecked', null); u.proc = peckedGen(u, ev);
        floater(u.x, u.y - 1.4, 'Караул!', '#ffe0e0'); sfxUnit(u, 'ouch');
      } else if (ev.t > 25) ev.phase = 'done';
    } else if (ev.phase === 'peck') {
      ev.pk -= dt;
      if (ev.pk <= 0) {
        ev.pk = 0.55;
        floater(u.x + (Math.random() - 0.5), u.y - 1.1, ['Ай!', 'Не надо!', 'Кыш!', 'Ой-ой!'][Math.floor(Math.random() * 4)], '#ffd0d0');
        sfxAt('cluck', u.x * TILE, u.y * TILE, 0.9); sfxUnit(u, 'ouch');
        fxBurst(u.x * TILE, u.y * TILE - 8, 3, ['#ffffff', '#f0ece0'], 30, 26, 0.5, 1.4, 120);       // перья
      }
      if (ev.t > 5) { ev.phase = 'drag'; ev.t = 0; floater(u.x, u.y - 1.4, '…', '#e8e0c0'); }
    } else if (ev.phase === 'drag') {
      // гном лежит, куры волокут его за собой
      u.x += ev.dir[0] * 0.8 * dt; u.y += ev.dir[1] * 0.8 * dt;
      u.x = Math.max(1, Math.min(MAP_W - 2, u.x)); u.y = Math.max(1, Math.min(MAP_H - 2, u.y));
      if (ev.t > 3.6) {
        ev.phase = 'done';
        // оттащили в сторонку и бросили: гном встаёт и, ворча, возвращается к делу (раньше куры уносили его насовсем)
        floater(u.x, u.y - 1.2, 'Куд-кудах!', '#ffffff');
        if (!u.injury && Math.random() < 0.25) injure(u, 'leg');
        logEvent('animal', `Куры проучили: ${UNIT_TYPES[u.type].name.toLowerCase()} оттащен в кусты${u.injury ? ' и хромает' : ''}`, u.x, u.y);
      }
    }
    if (ev.phase === 'done') { list.splice(i, 1); for (const h of ev.hens) { if (h.avenge === ev) { h.avenge = null; h.state = 'wander'; h.loot = null; h.wait = 2; } } }
  }
}

// ---------- Лоси ----------
// Спокойно пасутся. Увидев гнома с грузом, подходят и требуют отдать: одни отдают
// (груз пропал), другие упрямятся — и получают рогами: отлетают, роняют груз, бывает хромают.

function updateMoose(a, dt, def) {
  if (a.state === 'charge') {
    const t = a.target;
    if (!t || t.dead || t.inside || !t.carry || Game.time > a.chargeUntil) { a.state = 'wander'; a.target = null; a.stealCD = Game.time + 30; return; }
    if (a.think <= 0) { a.think = 0.4; animalGo(a, Math.floor(t.x), Math.floor(t.y)); }
    animalStep(a, dt, def.speed);
    if (Math.hypot(t.x - a.x, t.y - a.y) < 1.0) {
      a.path = null; a.moving = false;
      const name = UNIT_TYPES[t.type].name;
      if (Math.random() < 0.4) {
        // отдал сам — лось съедает груз
        const g = dropLoad(t);
        if (g) { const p = Game.piles.get(idx(Math.floor(t.x), Math.floor(t.y))); void p; }
        floater(t.x, t.y - 1.3, 'Бери, бери!', '#ffe9a0');
        floater(a.x, a.y - 1.6, 'Хрум', '#e0d0a0');
        logEvent('animal', `${name} отдал груз лосю`, a.x, a.y);
        eatPileAt(Math.floor(t.x), Math.floor(t.y));
      } else {
        // не отдал — бодает
        floater(a.x, a.y - 1.6, 'Бдыщ!', '#ffd0a0');
        sfxAt('thud', a.x * TILE, a.y * TILE, 1.1);
        dropLoad(t);
        knockBack(t, a);
        if (Math.random() < 0.5) injure(t, 'leg');
        logEvent('animal', `Лось забодал: ${name.toLowerCase()}`, t.x, t.y);
        toast(`Лось забодал: ${name.toLowerCase()}!`);
      }
      a.stealCD = Game.time + 50 + Math.random() * 40;
      a.state = 'wander'; a.target = null;
      const s = wildSpot(12) || a.home; animalGo(a, s[0], s[1]); a.home = s;
    }
    return;
  }
  if (a.think <= 0) {
    a.think = 0.9;
    if (Game.time >= (a.stealCD || 0)) {
      const prey = nearestPerson(a, 6.5, u => !!u.carry && !u.brk);
      if (prey) { a.state = 'charge'; a.target = prey; a.chargeUntil = Game.time + 9; floater(a.x, a.y - 1.8, 'Му-уо!', '#e0d0a0'); }
    }
  }
  // иначе пасётся, как нейтральный зверь
  if (a.path) { animalStep(a, dt, def.speed * 0.45); return; }
  a.wait -= dt;
  if (a.wait <= 0) {
    a.wait = 3 + Math.random() * 7;
    const t = randomFreeNear(a.home[0], a.home[1], 0, 5, (x, y) => isWalkable(x, y) && !World.road[idx(x, y)]);
    if (t) animalGo(a, t[0], t[1]);
  }
}

// груз, брошенный на землю, съедает лось (кучка исчезает)
function eatPileAt(x, y) {
  const p = Game.piles.get(idx(x, y));
  if (!p) return;
  for (const g of GOOD_KEYS) p.stock[g] = 0;
  cleanupPile(p);
}

// ---------- Охота на воров ----------
// Волка или лису, убегающих с добычей, догоняют ближайшие гномы. Поймали — зверь убит:
// возвращается добыча и остаются шкуры для доспехов.

function dispatchHunters(a) {
  let n = 0;
  const cand = Game.units.filter(u => isPerson(u) && !u.inside && !u.dead && u.type !== 'carter' && !u.carry && interruptible(u) && Math.hypot(u.x - a.x, u.y - a.y) < 11)
    .sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y));
  for (const u of cand) {
    if (n >= 2) break;
    startBreak(u, 'hunt', null); u.proc = huntGen(u, a); n++;
  }
}

// Шансы погони. Догнать трудно; догнав, чаще отбирают добычу, чем убивают зверя;
// разница уходит в побег зверя. У гуся две «жизни»: убить его труднее, чем волка и лису.
const HUNT_ODDS = {
  wolf:  { catch: 0.38, recover: 0.72, kill: 0.1,  bite: 0.1 },
  fox:   { catch: 0.42, recover: 0.72, kill: 0.12, bite: 0.07 },
  goose: { catch: 0.4, recover: 0.75, kill: 0.08, bite: 0.08 },
};

function* huntGen(u, a) {
  const odds = HUNT_ODDS[a.kind] || HUNT_ODDS.wolf;
  floater(u.x, u.y - 1.2, 'Держи вора!', '#ffd0a0');
  sfxUnit(u, 'grr');
  u.huntUntil = Game.time + 16;
  for (let k = 0; k < 30 && !a.dead && a.loot !== undefined; k++) {
    if (a.state !== 'flee' || Math.hypot(a.x - u.x, a.y - u.y) > 16) break;
    yield { walk: [Math.floor(a.x), Math.floor(a.y)], offroad: true };
    if (a.dead) break;
    if (Math.hypot(a.x - u.x, a.y - u.y) < 1.4) {
      if (Math.random() >= odds.catch) {                       // не догнал
        floater(u.x, u.y - 1.2, 'Увернулся!', '#ffe0e0');
        if (Math.random() < odds.bite) { injure(u, 'arm'); floater(u.x, u.y - 1.6, 'Укусил!', '#ffc0c0'); }
        if (Math.random() < 0.35) { a.fleeBoost = Game.time + 4; break; }   // зверь вырвался и ушёл
        yield { wait: 0.4 };
        continue;
      }
      // догнал: чаще отбирает добычу, реже убивает зверя
      const r = Math.random();
      if (r < odds.recover) { recoverLoot(a, u); u.huntUntil = 0; yield { wait: 1.2 }; return; }
      if (r < odds.recover + odds.kill && killPredator(a, u)) { u.huntUntil = 0; yield { wait: 1.4 }; return; }
      floater(u.x, u.y - 1.2, 'Вырвался!', '#ffe0e0');
      a.fleeBoost = Game.time + 4;
      break;
    }
  }
  u.huntUntil = 0;
  if (!a.dead) floater(u.x, u.y - 1.2, 'Ушёл…', '#e8e0c0');
  yield { wait: 1 };
}

// Гном отнял добычу, зверь убежал налегке
function recoverLoot(a, u) {
  const x = Math.floor(a.x), y = Math.floor(a.y);
  if (a.loot) dropPile(x, y, a.loot, 1);
  a.loot = null; a.state = a.kind === 'goose' ? 'back' : 'wander'; a.path = null; a.calmUntil = Game.time + 15;
  a.stealCD = Math.max(a.stealCD || 0, Game.time + 30);
  floater(u.x, u.y - 1.3, 'Отобрал!', '#fff2a0');
  sfxUnit(u, 'hey');
  u.gest = 'fist'; u.gestUntil = Game.time + 2;
  logEvent('animal', `${UNIT_TYPES[u.type].name} отобрал добычу у: ${ANIMALS[a.kind].name.toLowerCase()}`, a.x, a.y);
}

function killPredator(a, u) {
  const need = { goose: 2, wolf: 3, fox: 2 }[a.kind] || 1;     // звери живучи: волка надо ударить удачно трижды, лису и гуся — дважды
  if (need > 1) {
    a.hp = (a.hp || need) - 1;
    if (a.hp > 0) { floater(a.x, a.y - 0.8, a.kind === 'goose' ? 'Га-а!' : 'Р-р!', '#ffffff'); return false; }
  }
  const x = Math.floor(a.x), y = Math.floor(a.y);
  const name = ANIMALS[a.kind].name;
  if (a.loot) dropPile(x, y, a.loot, 1);                 // добыча возвращается
  dropPile(x, y, 'hide', a.kind === 'wolf' ? 2 : 1);      // шкуры — на доспехи
  fxBurst(a.x * TILE, a.y * TILE - 6, 10, ['#e8d0a0', '#a08060', '#7a6a50'], 55, 40, 0.7, 2, 160);
  floater(u.x, u.y - 1.3, 'Попался!', '#fff2a0');
  floater(a.x, a.y - 0.8, 'Шкура!', '#e0c080');
  sfxUnit(u, 'hey');
  u.gest = 'fist'; u.gestUntil = Game.time + 2;
  logEvent('animal', `${UNIT_TYPES[u.type].name} убил: ${name.toLowerCase()}. Остались шкуры`, a.x, a.y);
  toast(`${UNIT_TYPES[u.type].name} догнал и убил: ${name.toLowerCase()} — остались шкуры`);
  removeAnimal(a);
  return true;
}

// Сачок: длинная палка с обручем и сетчатым мешком; при ловле взмахивает
function drawNet(c, u, px, py, face, moving) {
  const near = Game.critters && Game.critters.some(b => b.chaser === u.id && Math.hypot(b.x - u.x, b.y - u.y) < 1.8);
  const sw = Math.sin(Game.time * (near ? 11 : 5) + u.id) * (near ? 0.9 : moving ? 0.5 : 0.25);
  const hx = px + face * 4.2, hy = py - 12;
  const tx = hx + face * (7 + sw * 6), ty = hy - 12 - Math.abs(sw) * 2;
  c.save();
  c.lineCap = 'round';
  c.strokeStyle = '#6e4428'; c.lineWidth = 1; c.beginPath(); c.moveTo(hx, hy + 2); c.lineTo(tx, ty); c.stroke();
  const ox = tx + face * 1.2, oy = ty - 2.2;
  // мешок из сетки под обручем
  c.fillStyle = 'rgba(244,244,255,0.32)';
  c.beginPath(); c.moveTo(ox - 4.4, oy); c.quadraticCurveTo(ox - 3.6, oy + 8, ox, oy + 8.6); c.quadraticCurveTo(ox + 3.6, oy + 8, ox + 4.4, oy); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(230,230,245,0.55)'; c.lineWidth = 0.4;
  for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(ox + k * 1.8, oy); c.lineTo(ox + k * 0.7, oy + 8); c.stroke(); }
  for (let k = 1; k <= 3; k++) { c.beginPath(); c.moveTo(ox - 4 + k * 0.4, oy + k * 2.2); c.lineTo(ox + 4 - k * 0.4, oy + k * 2.2); c.stroke(); }
  c.strokeStyle = '#3a2414'; c.lineWidth = 0.9; c.beginPath(); c.ellipse(ox, oy, 4.4, 1.9, 0, 0, Math.PI * 2); c.stroke();   // обруч
  c.restore();
}

// Сова иногда ловит бабочку: с крыши пикирует на неё, глотает и возвращается на место
function owlHunt(o, dt) {
  o.huntT = (o.huntT || 0) - dt;
  if (o.huntT > 0) return;
  o.huntT = 1.2;
  const list = Game.critters;
  if (!list || !list.length || Math.random() > 0.4) return;
  let best = null, bd = 150;
  for (const b of list) {
    const d = Math.hypot(b.x * TILE - o.x, b.y * TILE - 10 - o.y);
    if (d < bd) { bd = d; best = b; }
  }
  if (!best) return;
  o.back = [o.x, o.y, o.ground];
  o.from = [o.x, o.y]; o.to = [best.x * TILE, best.y * TILE - 10, best.y * TILE]; o.f = 0; o.hunt = best;
  o.goAway = false; o.state = 'fly'; o.speed = 1.6; o.item = null;
}

function owlEat(o) {
  const b = o.hunt, list = Game.critters || [];
  o.hunt = null;
  const i = list.indexOf(b);
  if (i >= 0 && Math.hypot(b.x * TILE - o.x, b.y * TILE - 10 - o.y) < 40) {
    list.splice(i, 1);
    floater(o.x / TILE, o.y / TILE - 0.6, 'Ам!', '#fff2a0');
    fxBurst(o.x, o.y, 6, ['#e8d8b0', '#a08860', b.col], 30, 20, 0.5, 1.4, 80);
  }
  // назад на свой насест
  o.from = [o.x, o.y]; o.to = o.back; o.f = 0; o.speed = 1.1; o.goAway = false; o.state = 'fly';
}
