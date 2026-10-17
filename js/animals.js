'use strict';
// Дикие звери. Нейтральные (олени, кролики) пасутся и убегают от людей.
// Добрые (дикие козы) — пастух может их приручить, ручная коза возит по 2 груза.
// Злые (волки) подкрадываются к тем, кто несёт груз, и утаскивают его.

const ANIMALS = {
  deer:   { name: 'Олень',     mood: 'neutral', speed: 1.7, flee: 2.5 },
  rabbit: { name: 'Кролик',    mood: 'neutral', speed: 2.3, flee: 2.0 },
  goat:   { name: 'Дикая коза', mood: 'good',   speed: 1.3, flee: 0 },
  wolf:   { name: 'Волк',      mood: 'evil',    speed: 2.2, flee: 0 },
  fox:    { name: 'Лиса',      mood: 'evil',    speed: 2.5, flee: 0 },
  elk:    { name: 'Лось',      mood: 'moose',   speed: 2.3, flee: 0 },
};

let animalId = 1;

function makeAnimal(kind, x, y) {
  return {
    id: animalId++, kind, x: x + 0.5, y: y + 0.5, home: [x, y],
    path: null, pi: 0, wait: Math.random() * 3, face: Math.random() < 0.5 ? 1 : -1, phase: Math.random() * 10,
    moving: false, state: 'wander', target: null, stealCD: 0, loot: null, tamedBy: 0, follow: 0, calm: 0, dead: false,
  };
}

function removeAnimal(a) {
  a.dead = true;
  Game.animals = Game.animals.filter(o => o !== a);
}

function nearestAnimal(x, y, r, test) {
  let best = null, bd = r;
  for (const a of Game.animals) {
    if (!test(a)) continue;
    const d = Math.hypot(a.x - x, a.y - y);
    if (d < bd) { bd = d; best = a; }
  }
  return best;
}

// Место для зверя: трава у леса, подальше от поселения.
function wildSpot(minDist, nearForest = true) {
  const cx = MAP_W >> 1, cy = MAP_H >> 1;
  for (let k = 0; k < 400; k++) {
    const x = (Math.random() * MAP_W) | 0, y = (Math.random() * MAP_H) | 0;
    if (Math.hypot(x - cx, y - cy) < minDist || !isWalkable(x, y)) continue;
    const i = idx(x, y);
    if (World.road[i] || World.terrain[i] === T_SAND) continue;
    if (nearForest && !findObjNear(x, y, 3, o => o.t === 'tree')) continue;
    return [x, y];
  }
  return null;
}

function spawnAnimals() {
  Game.animals = [];
  const add = (kind, n, minDist) => { for (let k = 0; k < n; k++) { const s = wildSpot(minDist, kind !== 'goat'); if (s) Game.animals.push(makeAnimal(kind, s[0], s[1])); } };
  add('deer', 7, 14);
  add('rabbit', 9, 10);
  add('goat', 6, 12);
  add('wolf', 3, 17);
  add('fox', 4, 14);
  add('elk', 3, 16);
  spawnFarmyard();
}

function animalGo(a, x, y) {
  const p = findPath(Math.floor(a.x), Math.floor(a.y), x, y);
  a.path = p && p.length ? p : null;
  a.pi = 0;
}

function animalStep(a, dt, speed) {
  if (!a.path) { a.moving = false; return true; }
  const [px, py] = a.path[a.pi];
  const tx = px + 0.5, ty = py + 0.5, dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
  const s = speed * dt;
  a.moving = true;
  a.phase += s * 5;
  if (Math.abs(dx) > 0.01) a.face = dx > 0 ? 1 : -1;
  if (s >= d) { a.x = tx; a.y = ty; a.pi++; if (a.pi >= a.path.length) { a.path = null; a.moving = false; return true; } }
  else { a.x += dx / d * s; a.y += dy / d * s; }
  return false;
}

function nearestPerson(a, r, test = () => true) {
  let best = null, bd = r;
  for (const u of Game.units) {
    if (u.inside || !test(u)) continue;
    const d = Math.hypot(u.x - a.x, u.y - a.y);
    if (d < bd) { bd = d; best = u; }
  }
  return best;
}

function updateAnimal(a, dt) {
  const def = ANIMALS[a.kind];
  a.think = (a.think || 0) - dt;
  if (a.burn) { burnHenStep(a, dt); return; }   // подожжённая молнией курица мечется
  if (a.avenge) { avengeHen(a, dt); return; }       // куры мстят за товарища

  // коза идёт за пастухом
  if (a.follow) {
    const f = Game.unitMap.get(a.follow);
    if (!f || f.inside) { a.follow = 0; a.tamedBy = 0; return; }
    const d = Math.hypot(f.x - a.x, f.y - a.y);
    if (d > 1.2 && a.think <= 0) { a.think = 0.6; animalGo(a, Math.floor(f.x), Math.floor(f.y)); }
    if (d > 1.0) animalStep(a, dt, 1.9); else a.moving = false;
    return;
  }
  if (a.calm > Game.time) { a.moving = false; return; }
  if (def.mood === 'angry') { updateGoose(a, dt, def); return; }

  if (def.mood === 'moose') { updateMoose(a, dt, def); return; }

  // волк и лиса: охота за грузом
  if (def.mood === 'evil') {
    if (a.state === 'flee') {
      if (animalStep(a, dt, a.loot ? (a.kind === 'fox' ? 2.3 : 2.1) : 2.5)) { a.state = 'wander'; a.loot = null; }
      return;
    }
    if (a.think <= 0) {
      a.think = 0.8;
      if (Game.time >= a.stealCD) {
        const prey = nearestPerson(a, a.kind === 'fox' ? 7 : 9, u => !!u.carry);
        const pile = !prey ? [...Game.piles.values()].find(p => Math.hypot(p.x - a.x, p.y - a.y) < 9) : null;
        a.target = prey || pile;
        if (a.target) { a.state = 'chase'; animalGo(a, Math.floor(a.target.x), Math.floor(a.target.y)); }
        else if (a.state === 'chase') a.state = 'wander';
      }
    }
    if (a.state === 'chase' && a.target) {
      animalStep(a, dt, def.speed);
      const t = a.target;
      if (Math.hypot(t.x + (t.isPile ? 0.5 : 0) - a.x, t.y + (t.isPile ? 0.5 : 0) - a.y) < 0.6) {
        let g = null;
        if (t.isPile) {
          g = GOOD_KEYS.find(k => t.stock[k] - t.reserved[k] > 0);
          if (g) { t.stock[g]--; cleanupPile(t); }
        } else if (t.carry) {
          g = t.carry;
          t.carryN = Math.max(0, (t.carryN || 1) - 1);
          if (!t.carryN) t.carry = null;
        }
        if (g) {
          a.loot = g;
          logEvent('animal', `${def.name} утащил${a.kind === 'fox' ? 'а' : ''} «${GOODS[g].name}»`, a.x, a.y);
          toast(`${def.name} утащил${a.kind === 'fox' ? 'а' : ''} «${GOODS[g].name}»!`);
          dispatchHunters(a);
        }
        a.stealCD = Game.time + (a.kind === 'fox' ? 50 : 70) + Math.random() * 40;
        a.state = 'flee'; a.target = null;
        const s = wildSpot(18) || a.home;
        animalGo(a, s[0], s[1]);
        a.home = s;
      }
      return;
    }
  }

  // нейтральные убегают от людей
  if (def.flee && a.think <= 0) {
    const p = nearestPerson(a, def.flee);
    if (p) {
      const ax = Math.round(a.x + (a.x - p.x) * 3), ay = Math.round(a.y + (a.y - p.y) * 3);
      if (inb(ax, ay) && isWalkable(ax, ay)) { animalGo(a, ax, ay); a.think = 1.5; a.state = 'run'; }
    }
  }
  if (a.state === 'run') { if (animalStep(a, dt, def.speed * 1.6)) a.state = 'wander'; return; }

  // спокойно пасётся
  if (a.path) { animalStep(a, dt, def.speed * 0.5); return; }
  a.wait -= dt;
  if (a.wait <= 0) {
    a.wait = 2 + Math.random() * 6;
    // волки рыщут шире и постепенно подбираются к поселению
    if (def.mood === 'evil' && Math.random() < 0.25) {
      const cx = MAP_W >> 1, cy = MAP_H >> 1;
      // подходят к поселению, но логово не ближе 11 клеток от центра
      if (Math.hypot(a.home[0] - cx, a.home[1] - cy) > 13)
        a.home = [Math.round(a.home[0] + Math.sign(cx - a.home[0]) * 2), Math.round(a.home[1] + Math.sign(cy - a.home[1]) * 2)];
      else if (Math.hypot(a.home[0] - cx, a.home[1] - cy) < 11) { const s = wildSpot(16); if (s) a.home = s; }
    }
    const t = randomFreeNear(a.home[0], a.home[1], 0, def.mood === 'evil' ? 7 : 5, (x, y) => isWalkable(x, y) && !World.road[idx(x, y)]);
    if (t) animalGo(a, t[0], t[1]);
  }
}

let respawnT = 0;
function updateAnimals(dt) {
  for (const a of Game.animals.slice()) updateAnimal(a, dt);
  avengeTick(dt);
  respawnT += dt;
  if (respawnT > 45) {
    respawnT = 0;
    const cnt = k => Game.animals.filter(a => a.kind === k).length;
    const add = (k, d) => { const s = wildSpot(d, k !== 'goat'); if (s) Game.animals.push(makeAnimal(k, s[0], s[1])); };
    if (cnt('goat') < 4) add('goat', 14);
    if (cnt('deer') < 5) add('deer', 14);
    if (cnt('rabbit') < 6) add('rabbit', 10);
    if (cnt('wolf') < 3 && Math.random() < 0.4) add('wolf', 24);
    if (cnt('fox') < 3 && Math.random() < 0.5) add('fox', 20);
    if (cnt('elk') < 2 && Math.random() < 0.4) add('elk', 20);
    if (cnt('goose') < 4) spawnGeeseFlock();
    if (cnt('chicken') < 3) {
      const st = Game.buildings.find(b => b.type === 'storehouse');
      const s = st && randomFreeNear(st.doorX, st.doorY + 2, 1, 6, (x, y) => isWalkable(x, y) && !World.road[idx(x, y)]);
      if (s) { const a = makeAnimal('chicken', s[0], s[1]); a.home = [st.doorX, st.doorY + 3]; Game.animals.push(a); }
    }
  }
}
