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
function spawnGeeseFlock() {
  const cx = MAP_W >> 1, cy = MAP_H >> 1;
  for (let k = 0; k < 300; k++) {
    const x = (Math.random() * MAP_W) | 0, y = (Math.random() * MAP_H) | 0;
    const d = Math.hypot(x - cx, y - cy);
    if (d < 10 || d > 26 || World.terrain[idx(x, y)] !== T_SAND || !isWalkable(x, y)) continue;
    const n = 3 + ((Math.random() * 2) | 0);
    for (let j = 0; j < n; j++) {
      const s = randomFreeNear(x, y, 0, 2, (xx, yy) => isWalkable(xx, yy)) || [x, y];
      const a = makeAnimal('goose', s[0], s[1]); a.home = [x, y]; Game.animals.push(a);
    }
    return true;
  }
  return false;
}

function updateGoose(a, dt, def) {
  if (a.state === 'chase') {
    const t = Game.unitMap.get(a.target);
    const far = Math.hypot(a.x - a.home[0], a.y - a.home[1]) > 15;
    if (!t || t.inside || Game.time > a.chaseUntil || far) {
      a.state = 'back'; a.calmUntil = Game.time + 8 + Math.random() * 8;
      animalGo(a, a.home[0], a.home[1]);
      return;
    }
    if (a.think <= 0) { a.think = 0.35; animalGo(a, Math.floor(t.x), Math.floor(t.y)); }
    animalStep(a, dt, def.speed);
    if (Math.hypot(t.x - a.x, t.y - a.y) < 0.75 && Game.time >= (a.biteCD || 0)) {
      gooseBite(a, t);
      a.biteCD = Game.time + 2.2;
      a.bites = (a.bites || 0) + 1;
      if (a.bites >= 3) { a.state = 'back'; a.calmUntil = Game.time + 14; animalGo(a, a.home[0], a.home[1]); }
    }
    if (Math.random() < dt * 0.9) floater(a.x, a.y - 1, 'Га-га!', '#ffffff');
    return;
  }
  if (a.state === 'back') { if (animalStep(a, dt, def.speed * 0.7)) a.state = 'wander'; return; }
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
  if (a.path) { animalStep(a, dt, def.speed * 0.4); return; }
  a.wait -= dt;
  if (a.wait <= 0) {
    a.wait = 2 + Math.random() * 5;
    const t = randomFreeNear(a.home[0], a.home[1], 0, 3, (x, y) => isWalkable(x, y) && !World.road[idx(x, y)]);
    if (t) animalGo(a, t[0], t[1]);
  }
}

function gooseBite(a, u) {
  u.ouchUntil = Game.time + 2;
  floater(u.x, u.y - 1.4, 'Ай!', '#ffc8a0');
  if (!u.injury && Math.random() < 0.4) { injure(u, 'leg'); u.injuryUntil = Game.time + 40; }
  if (u.carry && Math.random() < 0.35) dropLoad(u);
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

function* chickenGen(u, hen) {
  for (let k = 0; k < 5 && !hen.dead; k++) {
    u.gest = 'wave'; u.gestUntil = Game.time + 3;
    yield { walk: [Math.floor(hen.x), Math.floor(hen.y)], offroad: true };
    if (Math.random() < 0.3) floater(hen.x, hen.y - 0.8, 'Ко-ко!', '#ffffff');
  }
  // поймать курицу не выйдет — она всегда шустрее
  u.gest = 'scratch'; u.gestUntil = Game.time + 1.6;
  yield { wait: 1.4 };
}

// ---------- Совы ----------
// Садятся на коньки крыш и трубы, моргают, вертят головой, ухают,
// посидев — перелетают на другой дом или улетают в лес и возвращаются.

const OWL_COUNT = 4;

// Точки на верхнем крае крыши здания (в мировых пикселях), считаются по спрайту один раз
function roofPerches(b) {
  const spr = buildingSprite(b.type, b.rot || 0);
  if (!spr.perches) {
    const cv = spr.canvas, k = cv.width / spr.w;
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    const tops = [];
    for (let x = Math.floor(cv.width * 0.2); x < cv.width * 0.8; x += Math.max(1, Math.floor(k * 2))) {
      for (let y = 0; y < cv.height * 0.7; y++) if (d[(y * cv.width + x) * 4 + 3]) { tops.push([x / k, y / k]); break; }
    }
    tops.sort((a, b) => a[1] - b[1]);
    // самые высокие точки, но не слишком близко друг к другу
    const pick = [];
    for (const p of tops) { if (pick.every(q => Math.abs(q[0] - p[0]) > 10)) pick.push(p); if (pick.length >= 4) break; }
    spr.perches = pick;
  }
  const ox = b.x * TILE - spr.padx, oy = b.y * TILE - spr.top;
  return spr.perches.map(([x, y]) => [ox + x, oy + y + 1]);
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
        else { o.state = 'perch'; o.t = 14 + Math.random() * 30; }
      }
    } else if (o.t <= 0) {
      // пора лететь: чаще на другую крышу, иногда в лес
      const away = o.state === 'perch' && Math.random() < 0.3;
      const to = away ? forestPoint() : pickPerch(o);
      if (!to) { o.t = 5; continue; }
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

function drawOwls(c) {
  for (const o of Game.owls || []) {
    if (o.state === 'away') continue;
    const x = Math.round(o.x), y = Math.round(o.y);
    if (o.state === 'fly') {
      // в полёте: крылья машут, тень скользит по земле
      const w = Math.sin(o.ph * 14) * 4;
      c.fillStyle = 'rgba(10,8,4,0.2)'; c.beginPath(); c.ellipse(x, o.to[1] + (o.from[1] - o.to[1]) * (1 - o.f) + 30, 4, 1.4, 0, 0, 7); c.fill();
      c.fillStyle = '#6e4a2c';
      c.beginPath(); c.moveTo(x - 1, y); c.quadraticCurveTo(x - 6, y - 4 - w, x - 11, y - 1 - w); c.lineTo(x - 2, y + 2); c.fill();
      c.beginPath(); c.moveTo(x + 1, y); c.quadraticCurveTo(x + 6, y - 4 - w, x + 11, y - 1 - w); c.lineTo(x + 2, y + 2); c.fill();
      ellipse(c, x, y, 3, 4, '#7a5a3a'); ellipse(c, x, y + 0.6, 1.8, 2.6, '#c8a878');
      ellipse(c, x + (o.face || 1) * 0.8, y - 3.6, 2.8, 2.4, '#7a5a3a');
      c.fillStyle = '#f0c040'; c.fillRect(x - 2 + (o.face || 1), y - 4.4, 1.4, 1.4); c.fillRect(x + 0.6 + (o.face || 1), y - 4.4, 1.4, 1.4);
      continue;
    }
    // сидит на крыше
    const hx = x + o.look * 0.8;
    c.fillStyle = '#1a1210'; c.beginPath(); c.ellipse(x, y - 4.5, 4.2, 5.4, 0, 0, 7); c.fill();          // тёмный контур
    ellipse(c, x, y - 4.5, 3.6, 4.8, '#7a5a3a');
    ellipse(c, x, y - 3.6, 2.4, 3.2, '#d8b888');
    c.fillStyle = '#7a5a3a'; for (let k = 0; k < 4; k++) c.fillRect(x - 1.6 + (k % 2) * 2, y - 5 + k * 1.2, 0.8, 0.6);   // крапинки на грудке
    ellipse(c, x - 3.2, y - 4.2, 1.2, 3, '#5a3a22'); ellipse(c, x + 3.2, y - 4.2, 1.2, 3, '#5a3a22');                  // крылья
    // голова с ушками-пучками
    c.fillStyle = '#1a1210'; c.beginPath(); c.ellipse(hx, y - 10.4, 4, 3.4, 0, 0, 7); c.fill();
    ellipse(c, hx, y - 10.4, 3.4, 2.9, '#8a6440');
    poly(c, [[hx - 3.2, y - 12], [hx - 3.4, y - 15], [hx - 1.6, y - 12.8]], '#6e4a2c', '#1a1210', 0.4);
    poly(c, [[hx + 3.2, y - 12], [hx + 3.4, y - 15], [hx + 1.6, y - 12.8]], '#6e4a2c', '#1a1210', 0.4);
    ellipse(c, hx - 1.4, y - 10.4, 1.4, 1.3, '#e8d8b0'); ellipse(c, hx + 1.4, y - 10.4, 1.4, 1.3, '#e8d8b0');           // лицевой диск
    if (o.blink > 0) { c.fillStyle = '#3a2414'; c.fillRect(hx - 2.4, y - 10.6, 2, 0.6); c.fillRect(hx + 0.4, y - 10.6, 2, 0.6); }
    else {
      ellipse(c, hx - 1.4, y - 10.4, 0.95, 0.95, '#f6c030'); ellipse(c, hx + 1.4, y - 10.4, 0.95, 0.95, '#f6c030');
      c.fillStyle = '#120a06'; c.fillRect(hx - 1.6 + o.look * 0.3, y - 10.7, 0.6, 0.7); c.fillRect(hx + 1.2 + o.look * 0.3, y - 10.7, 0.6, 0.7);
    }
    poly(c, [[hx - 0.5, y - 9.6], [hx + 0.5, y - 9.6], [hx, y - 8.6]], '#d8a040');
    c.fillStyle = '#e0a030'; c.fillRect(x - 1.6, y - 0.4, 1, 0.8); c.fillRect(x + 0.6, y - 0.4, 1, 0.8);              // лапки
  }
}
