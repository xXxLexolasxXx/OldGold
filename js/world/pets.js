'use strict';
// Питомцы и забавы.
// 1) Досуг: пять новых забав (блинчики по воде, венок из цветов, пляска, кувырки, рыбалка)
//    и редкий прыжок с крыши на параплане — приземляется за 15 клеток.
// 2) Кролики и утки: гном может погнаться за ними и (редко) поймать — зверёк становится ручным,
//    ходит за хозяином и носит мелкие посылки в склад. Их едят совы, таскают волки и лисы,
//    пугает нечисть. Хозяин бросается на обидчика: 50% убьёт его и вернёт питомца, 50% погибнет.
// Файл грузится после render.js и sfx*.js: часть функций подменяется обёртками.

ANIMALS.duck = { name: 'Утка', mood: 'duck', speed: 1.7, flee: 3 };

const PET_GOODS = ['gold', 'bread', 'sausage', 'croissant', 'flour'];    // что способна унести мелкая зверушка
const PET_NAME = { rabbit: 'кролик', duck: 'утка', goat: 'коза', fox: 'лиса', wolf: 'волчонок' };
const PET_ACC = { rabbit: 'кролика', duck: 'утку', goat: 'козу', fox: 'лису', wolf: 'волчонка' };
const PET_MAX = 6;
const RABBIT_CATCH = 0.4;     // шанс схватить кролика при каждом сближении
const DUCK_CATCH = 0.35;

let petInit = false;
const cellOf = a => [Math.floor(a.x), Math.floor(a.y)];
const petsOfOwner = (u, kind) => Game.animals.filter(a => a.owner === u.id && a.kind === kind).length;
const tameCount = kind => Game.animals.filter(a => a.owner && a.kind === kind).length;
const unitNm = u => UNIT_TYPES[u.type].name;

// ---------- Появление ----------

function spawnPets() {
  for (let f = 0; f < 2; f++) spawnDuckFlock();
}

// Утки плавают на озере, где поменьше шума: небольшая стайка из 2–3
function spawnDuckFlock() {
  const cx = MAP_W >> 1, cy = MAP_H >> 1;
  for (let k = 0; k < 400; k++) {
    const x = (Math.random() * MAP_W) | 0, y = (Math.random() * MAP_H) | 0;
    const d = Math.hypot(x - cx, y - cy);
    if (d < 9 || d > 30 || !isWaterAt(x, y)) continue;
    let shore = false, water = 0;
    for (let yy = y - 2; yy <= y + 2; yy++) for (let xx = x - 2; xx <= x + 2; xx++) {
      if (isWaterAt(xx, yy)) water++;
      else if (inb(xx, yy) && World.terrain[idx(xx, yy)] === T_SAND) shore = true;
    }
    if (!shore || water < 10) continue;
    const n = 2 + ((Math.random() * 2) | 0);
    for (let j = 0; j < n; j++) {
      const s = randomFreeNear(x, y, 0, 2, isWaterAt) || [x, y];
      const a = makeAnimal('duck', s[0], s[1]); a.home = [x, y]; a.swim = true; Game.animals.push(a);
    }
    return true;
  }
  return false;
}

function petsRespawn(cnt) {
  const wild = k => Game.animals.filter(a => a.kind === k && !a.owner).length;
  if (wild('duck') < 4) spawnDuckFlock();
  if (wild('rabbit') < 5) { const s = wildSpot(10, true); if (s) Game.animals.push(makeAnimal('rabbit', s[0], s[1])); }
}

const petLoot = a => {
  const p = [];
  if (a.owner) p.push('T');
  if (a.swim) p.push('swim');
  if (a.cargo) p.push('c:' + a.cargo);
  return p.length ? p.join(',') : null;
};

// ---------- Приручение ----------

function setTame(a, u) {
  a.owner = u.id; a.tamedBy = u.id; a.chasedBy = 0; a.hunted = null; a.path = null; a.state = 'follow';
  a.errCD = Game.time + 25 + Math.random() * 30; a.err = null; a.cargo = null;
  a.loot = petLoot(a);
  floater(a.x, a.y - 1, '♥', '#ff7a8a');
  floater(u.x, u.y - 1.4, 'Мой!', '#fff2a0');
  sfxUnit(u, 'hey');
  u.gest = 'wave'; u.gestUntil = Game.time + 2;
  logEvent('animal', `${unitNm(u)} приручил: ${PET_ACC[a.kind]}`, a.x, a.y);
  toast(`${unitNm(u)} поймал и приручил: ${PET_ACC[a.kind]}! Будет носить мелкие посылки`);
}

function releasePet(a) {
  if (a.cargo) dropPile(Math.floor(a.x), Math.floor(a.y), a.cargo, 1);
  a.owner = 0; a.tamedBy = 0; a.cargo = null; a.err = null; a.loot = null; a.path = null; a.state = 'wander';
}

// Поймали только того, кого ещё нет у хозяина, и не больше PET_MAX зверьков каждого вида
function canTame(u, kind) { return petsOfOwner(u, kind) < 1 && tameCount(kind) < PET_MAX; }

// ---------- Движение зверьков ----------

// Идти к точке: по суше — по тропе, на воде утка плывёт напрямик
function petMove(a, tx, ty, speed, dt) {
  const [cx, cy] = cellOf(a);
  if (a.kind === 'duck' && isWaterAt(cx, cy)) {
    a.path = null;
    gooseMove(a, tx, ty, speed * 0.7, dt);
    return;
  }
  if (a.think <= 0) { a.think = 0.6; animalGo(a, Math.floor(tx), Math.floor(ty)); }
  if (a.path) animalStep(a, dt, speed); else a.moving = false;
}

function petUpdate(a, dt) {
  if (a.owner) { tamePetUpdate(a, dt); return true; }
  if (a.state === 'petchase') return predatorPetChase(a, dt);
  if (a.stolenPet && a.state !== 'flee') { a.stolenPet = null; if (a.loot === 'pet') a.loot = null; }      // добежал до логова: питомец потерян
  if (a.kind === 'duck') { wildDuckUpdate(a, dt); return true; }
  if (a.kind === 'rabbit') return wildRabbitUpdate(a, dt);
  if (a.hunted) a.hunted = null;
  return false;
}

// Спугнуть: отбежать от точки по прямой на 3–4 клетки
function awayPoint(a, fx, fy, dist) {
  const dx = a.x - fx, dy = a.y - fy, d = Math.hypot(dx, dy) || 1;
  let ax = a.x + dx / d * dist + (Math.random() - 0.5) * 2, ay = a.y + dy / d * dist + (Math.random() - 0.5) * 2;
  ax = Math.max(1, Math.min(MAP_W - 2, ax)); ay = Math.max(1, Math.min(MAP_H - 2, ay));
  return [ax, ay];
}

function chaserOf(a) {
  if (!a.chasedBy) return null;
  const u = Game.unitMap.get(a.chasedBy);
  if (!u || u.dead || u.inside || Game.time > (a.chaseEnd || 0)) { a.chasedBy = 0; return null; }
  return u;
}

// Дикий кролик: убегает от хищника и от гнома, который за ним гонится; сблизился — шанс, что поймали
function wildRabbitUpdate(a, dt) {
  const pr = a.hunted;
  if (pr) {
    if (pr.dead || pr.state !== 'petchase' || pr.prey !== a) { a.hunted = null; return false; }
    a.loot = null;
    if (a.think <= 0) { a.think = 0.35; const [ax, ay] = awayPoint(a, pr.x, pr.y, 4); animalGo(a, Math.round(ax), Math.round(ay)); }
    if (a.path) animalStep(a, dt, 3.3); else a.moving = false;
    return true;
  }
  const u = chaserOf(a);
  if (!u) return false;
  const d = Math.hypot(u.x - a.x, u.y - a.y);
  if (d < 1.5 && Game.time >= (a.catchCD || 0)) {
    a.catchCD = Game.time + 1.3;
    if (Math.random() < RABBIT_CATCH && canTame(u, 'rabbit')) { setTame(a, u); return true; }
    floater(a.x, a.y - 0.8, 'Увернулся!', '#ffe0e0');
    a.dodge = Game.time + 0.5;
  }
  if (d < 2.4 && a.think <= 0) {
    a.think = 0.7;
    const [ax, ay] = awayPoint(a, u.x, u.y, 3);
    if (isWalkable(Math.round(ax), Math.round(ay))) animalGo(a, Math.round(ax), Math.round(ay));
  }
  if (a.path) animalStep(a, dt, 2.7); else a.moving = false;
  return true;
}

// Дикая утка: плавает у берега, при приближении гнома или хищника уплывает/убегает
function wildDuckUpdate(a, dt) {
  const [cx, cy] = cellOf(a);
  a.swim = isWaterAt(cx, cy);
  a.loot = petLoot(a);
  const def = ANIMALS.duck;
  const pr = a.hunted;
  if (pr && (pr.dead || pr.state !== 'petchase' || pr.prey !== a)) a.hunted = null;
  const u = chaserOf(a);
  let fx = null, fy = null, sp = def.speed * 1.5;
  if (a.hunted) { fx = a.hunted.x; fy = a.hunted.y; sp = def.speed * 2; }
  else if (u) {
    const d = Math.hypot(u.x - a.x, u.y - a.y);
    if (d < 1.5 && Game.time >= (a.catchCD || 0)) {
      a.catchCD = Game.time + 1.4;
      if (Math.random() < DUCK_CATCH && canTame(u, 'duck')) { setTame(a, u); return; }
      floater(a.x, a.y - 0.8, 'Кря!', '#ffffff');
    }
    if (d < 2.6) { fx = u.x; fy = u.y; sp = def.speed * 1.4; }
  } else if (a.think <= 0) {
    a.think = 0.6;
    const p = nearestPerson(a, 3, q => isPerson(q) && q.type !== 'carter');
    if (p && Game.time >= (a.calmUntil || 0)) { a.scareFrom = [p.x, p.y]; a.scareUntil = Game.time + 1.6; }
  }
  if (fx === null && a.scareUntil > Game.time && a.scareFrom) { fx = a.scareFrom[0]; fy = a.scareFrom[1]; sp = def.speed * 1.3; }
  if (fx !== null) {
    const [ax, ay] = awayPoint(a, fx, fy, 3);
    if (!gooseMove(a, ax, ay, sp * (a.swim ? 0.8 : 1), dt) && !a.moving) {
      const [bx, by] = awayPoint(a, fx, fy, -3);
      gooseMove(a, bx, by, sp * 0.6, dt);
    }
    if (Math.random() < dt * 0.5) floater(a.x, a.y - 0.9, 'Кря!', '#ffffff');
    return;
  }
  if (a.tgt) { if (gooseMove(a, a.tgt[0], a.tgt[1], def.speed * (a.swim ? 0.28 : 0.45), dt) || !a.moving) a.tgt = null; return; }
  a.moving = false;
  a.wait -= dt;
  if (a.wait <= 0) {
    a.wait = 2 + Math.random() * 5;
    const t = randomFreeNear(a.home[0], a.home[1], 0, 6, (x, y) => gooseCanBe(x, y) && !World.door[idx(x, y)]);
    if (t) a.tgt = [t[0] + 0.2 + Math.random() * 0.6, t[1] + 0.2 + Math.random() * 0.6];
    if (Math.random() < 0.15) floater(a.x, a.y - 0.9, 'Кря!', '#ffffff');
  }
}

// ---------- Ручной питомец ----------

function tamePetUpdate(a, dt) {
  const u = Game.unitMap.get(a.owner);
  if (!u || u.dead) { releasePet(a); return; }
  const [cx, cy] = cellOf(a);
  a.swim = a.kind === 'duck' && isWaterAt(cx, cy);
  a.loot = petLoot(a);
  if (a.hunted) {
    const pr = a.hunted;
    if (pr.dead || pr.state !== 'petchase' || pr.prey !== a) a.hunted = null;
    else { petMove(a, u.x, u.y, 3.6, dt); return; }       // убегает к хозяину
  }
  if (a.err) { petErrand(a, u, dt); return; }
  if (Game.time >= (a.errCD || 0) && a.think <= 0 && !a.swim && !u.inside && !isNightNow()) { a.think = 0.5; startErrand(a, u); if (a.err) return; }
  // за хозяином
  let tx = u.x, ty = u.y;
  if (u.inside) { tx = u.inside.doorX + 0.5; ty = u.inside.doorY + 0.5; }
  const d = Math.hypot(tx - a.x, ty - a.y);
  if (d > 28) { const s = randomFreeNear(Math.floor(tx), Math.floor(ty), 1, 3, (x, y) => isWalkable(x, y)); if (s) { a.x = s[0] + 0.5; a.y = s[1] + 0.5; a.path = null; } return; }
  if (d > 1.6) {
    petMove(a, tx, ty, 1.9 + Math.min(2, Math.max(0, d - 2) * 0.45), dt);
  } else {
    a.path = null; a.moving = false;
    if (Math.abs(tx - a.x) > 0.2) a.face = tx > a.x ? 1 : -1;
    // рядом с хозяином изредка подпрыгивает на месте
    if (a.kind === 'rabbit' && Math.random() < dt * 0.4) { a.moving = true; a.phase += 1; }
  }
}

// Посылка: подобрать мелкий товар с земли возле себя и отнести в склад
function startErrand(a, u) {
  let best = null, bd = 13;
  for (const p of Game.piles.values()) {
    if (p.removed) continue;
    const d = Math.hypot(p.x + 0.5 - a.x, p.y + 0.5 - a.y);
    if (d >= bd) continue;
    const g = PET_GOODS.find(k => p.stock[k] - p.reserved[k] > 0);
    if (g) { bd = d; best = { p, g }; }
  }
  a.errCD = Game.time + 45 + Math.random() * 40;
  if (!best) return;
  best.p.reserved[best.g]++;
  animalGo(a, best.p.x, best.p.y);
  if (!a.path && bd > 1) { best.p.reserved[best.g] = Math.max(0, best.p.reserved[best.g] - 1); return; }
  a.err = { st: 'toPile', pile: best.p, g: best.g, until: Game.time + 40 };
}

function abortErrand(a) {
  const e = a.err;
  if (e && e.st === 'toPile' && e.pile && !e.pile.removed) e.pile.reserved[e.g] = Math.max(0, e.pile.reserved[e.g] - 1);
  if (a.cargo) dropPile(Math.floor(a.x), Math.floor(a.y), a.cargo, 1);
  a.cargo = null; a.err = null; a.path = null;
}

function petErrand(a, u, dt) {
  const e = a.err;
  if (Game.time > e.until || u.dead) { abortErrand(a); return; }
  const arrived = animalStep(a, dt, 2.6);
  if (e.st === 'toPile') {
    if (!arrived && a.path) return;
    const p = e.pile;
    p.reserved[e.g] = Math.max(0, p.reserved[e.g] - 1);
    if (!p.removed && p.stock[e.g] > 0 && Math.hypot(p.x + 0.5 - a.x, p.y + 0.5 - a.y) < 1.6) {
      p.stock[e.g]--; cleanupPile(p);
      a.cargo = e.g;
      const st = nearestStore(a.x, a.y, e.g);
      if (st) { a.err = { st: 'toStore', store: st, g: e.g, until: Game.time + 45 }; animalGo(a, st.doorX, st.doorY); if (a.path) return; }
    }
    abortErrand(a);
    return;
  }
  if (!arrived && a.path) return;
  const st = e.store;
  if (st && !st.removed && Math.hypot(st.doorX + 0.5 - a.x, st.doorY + 0.5 - a.y) < 2) {
    st.stock[e.g]++;
    floater(a.x, a.y - 1, null, null, e.g);
    sfxAt('chime', a.x * TILE, a.y * TILE, 0.5);
    if (Math.random() < 0.3) logEvent('animal', `${PET_NAME[a.kind][0].toUpperCase() + PET_NAME[a.kind].slice(1)} принёс на склад: ${GOODS[e.g].name.toLowerCase()}`, a.x, a.y);
    a.cargo = null; a.err = null;
  } else abortErrand(a);
}

// ---------- Хищники ----------

function petsTick(dt) {
  if (!petInit) { petInit = true; if (typeof FLOAT_SFX !== 'undefined') FLOAT_SFX['Кря!'] = 'cluck'; }
  petsTick.t = (petsTick.t || 0) - dt;
  if (petsTick.t > 0) return;
  petsTick.t = 0.7;
  const night = isNightNow();
  // волки и лисы выбирают кролика или утку
  for (const a of Game.animals) {
    if (a.dead || a.owner || (a.kind !== 'wolf' && a.kind !== 'fox') || a.state === 'petchase' || a.state === 'flee' || a.state === 'chase' || a.loot || a.calm > Game.time) continue;   // calm: его приручают — замер и смотрит
    if (Game.time < (a.petCD || 0)) continue;
    const prey = nearestAnimal(a.x, a.y, a.kind === 'wolf' ? 7 : 8, p => (p.kind === 'rabbit' || p.kind === 'duck') && !p.dead && !p.hunted && !isWaterAt(Math.floor(p.x), Math.floor(p.y)));
    if (!prey) continue;
    // рядом с хозяином трогать зверька страшнее
    let guard = 1;
    if (prey.owner) { const o = Game.unitMap.get(prey.owner); if (o && !o.inside && Math.hypot(o.x - prey.x, o.y - prey.y) < 3.5) guard = 0.35; }
    if (Math.random() > 0.4 * guard * (night ? 1.3 : 1)) { a.petCD = Game.time + 6; continue; }
    a.state = 'petchase'; a.prey = prey; prey.hunted = a; a.petUntil = Game.time + 10; a.think = 0;
  }
  // совы пикируют на кроликов
  for (const o of Game.owls || []) {
    if (o.state !== 'perch' || o.hunt || (o.rabCD || 0) > Game.time) continue;
    o.rabCD = Game.time + 5;
    let best = null, bd = 230;
    for (const r of Game.animals) {
      if (r.kind !== 'rabbit' || r.dead || r.hunted) continue;
      const d = Math.hypot(r.x * TILE - o.x, r.y * TILE - 8 - o.y);
      if (d < bd) { bd = d; best = r; }
    }
    if (!best) continue;
    let p = best.owner ? 0.08 : 0.2;
    if (best.owner) { const h = Game.unitMap.get(best.owner); if (h && !h.inside && Math.hypot(h.x - best.x, h.y - best.y) < 3) p *= 0.3; }
    if (Math.random() > p) continue;
    o.back = [o.x, o.y, o.ground];
    o.from = [o.x, o.y]; o.to = [best.x * TILE, best.y * TILE - 8, best.y * TILE]; o.f = 0;
    o.hunt = { rab: best, x: best.x, y: best.y, col: '#9a8a74' };
    o.goAway = false; o.state = 'fly'; o.speed = 1.7; o.item = null;
  }
  // скелеты нападают на ручных зверьков
  for (const s of Game.skels || []) {
    if (s.dead || s.state !== 'roam' || s.k < 1) continue;
    for (const a of Game.animals) {
      if (!a.owner || a.dead || Math.hypot(a.x - s.x, a.y - s.y) > 1.6 || Math.random() > 0.22) continue;
      petKilled(a, s, 'скелет');
      break;
    }
  }
}

// Охота: хищник гонится за зверьком; настиг — зверёк потерян, хозяин мстит
function predatorPetChase(a, dt) {
  const p = a.prey, def = ANIMALS[a.kind];
  if (!p || p.dead || Game.time > a.petUntil) {
    a.state = 'wander'; a.prey = null; a.path = null; a.petCD = Game.time + 20;
    if (p) p.hunted = null;
    return true;
  }
  if (a.think <= 0) { a.think = 0.35; animalGo(a, Math.floor(p.x), Math.floor(p.y)); }
  if (a.path) animalStep(a, dt, def.speed * 1.45); else a.moving = false;
  if (Math.hypot(p.x - a.x, p.y - a.y) < 0.75) {
    const chance = p.kind === 'rabbit' ? 0.6 : 0.42;
    if (Math.random() < chance) petTaken(a, p);
    else {
      floater(p.x, p.y - 0.8, p.kind === 'duck' ? 'Кря!' : '!', '#ffffff');
      p.hunted = null; a.prey = null; a.state = 'wander'; a.petCD = Game.time + 28; a.path = null;
    }
  }
  return true;
}

function petTaken(a, p) {
  const rec = { kind: p.kind, owner: p.owner, x: p.x, y: p.y };
  const nm = ANIMALS[a.kind].name, f = a.kind === 'fox' ? 'а' : '';
  removeAnimal(p);
  a.prey = null;
  a.stolenPet = rec; a.loot = 'pet'; a.state = 'flee'; a.fleeBoost = 0; a.target = null;
  a.stealCD = Game.time + 55; a.petCD = Game.time + 40;
  const s = wildSpot(18) || a.home; animalGo(a, s[0], s[1]); a.home = s;
  fxBurst(a.x * TILE, a.y * TILE - 6, 8, ['#c8b898', '#9a8a74', '#e8e0d0'], 45, 35, 0.6, 1.8, 150);
  logEvent('animal', `${nm} утащил${f}: ${PET_ACC[rec.kind]}${rec.owner ? ' (ручного)' : ''}`, a.x, a.y);
  if (rec.owner || rec.kind === 'duck') toast(`${nm} утащил${f} ${rec.owner ? 'ручного ' : ''}${PET_ACC[rec.kind]}!`);
  if (rec.owner) startPetAvenge(rec, a);
  if (rec.kind === 'duck') dispatchHunters(a);            // утку можно отбить
}

// Зверька убила нечисть (на месте)
function petKilled(p, enemy, who) {
  const rec = { kind: p.kind, owner: p.owner, x: p.x, y: p.y };
  removeAnimal(p);
  fxBurst(p.x * TILE, p.y * TILE - 6, 8, ['#d8d8c8', '#9a8a74'], 45, 35, 0.6, 1.8, 150);
  floater(p.x, p.y - 1, '!', '#ff6040');
  logEvent('animal', `${who[0].toUpperCase() + who.slice(1)} напал на ручного: ${PET_ACC[rec.kind]}`, p.x, p.y);
  toast(`${who[0].toUpperCase() + who.slice(1)} напал на ручного: ${PET_ACC[rec.kind]}!`);
  if (rec.owner) startPetAvenge(rec, enemy);
}

// Вернуть зверька (отбили или хозяин одолел обидчика)
function restorePet(rec, x, y, text) {
  const a = makeAnimal(rec.kind, Math.floor(x), Math.floor(y));
  a.x = x; a.y = y; a.home = [Math.floor(x), Math.floor(y)];
  const o = rec.owner && Game.unitMap.get(rec.owner);
  if (o && !o.dead) { a.owner = o.id; a.tamedBy = o.id; a.state = 'follow'; a.errCD = Game.time + 40; a.loot = 'T'; }
  Game.animals.push(a);
  floater(x, y - 1, text || 'Отбили!', '#fff2a0');
  floater(x, y - 1.5, '♥', '#ff7a8a');
  return a;
}

// Обёртки: отобранный у зверя питомец возвращается живым
const _recoverLoot = recoverLoot;
recoverLoot = function (a, u) {
  const sp = a.stolenPet;
  if (sp) { a.stolenPet = null; a.loot = null; }
  _recoverLoot(a, u);
  if (sp) { a.loot = null; restorePet(sp, a.x + 0.3, a.y, 'Отбили!'); }
};
const _killPredator = killPredator;
killPredator = function (a, u) {
  const sp = a.stolenPet;
  if (sp && a.loot === 'pet') a.loot = null;
  const ok = _killPredator(a, u);
  if (!ok && sp) a.loot = 'pet';
  if (ok && sp) restorePet(sp, a.x + 0.3, a.y, 'Отбили!');
  return ok;
};
// унёсший питомца хищник, сменив состояние, считается ушедшим с добычей

// ---------- Месть хозяина ----------

function startPetAvenge(rec, enemy) {
  const u = Game.unitMap.get(rec.owner);
  if (!u || u.dead || u.inside || !isPerson(u)) return;
  if (Math.hypot(u.x - enemy.x, u.y - enemy.y) > 30) return;
  if (!interruptible(u) && !(u.brk && (u.brk.kind === 'smoke' || u.brk.kind === 'join' || u.brk.kind === 'flee' || u.brk.kind === 'freeze'))) return;
  if (u.brk) endBreak(u);
  startBreak(u, 'avenge', null);
  u.proc = petAvengeGen(u, enemy, rec);
}

const enemyGone = e => e.dead || (e.state === 'dead' || e.state === 'sink') || (e.kind && !Game.animals.includes(e));

function* petAvengeGen(u, enemy, rec) {
  floater(u.x, u.y - 1.3, rec.kind === 'duck' ? 'Мою утку!' : 'Моего кролика!', '#ffb0a0');
  sfxUnit(u, 'grr');
  u.huntUntil = Game.time + 24;
  u.gest = 'fist'; u.gestUntil = Game.time + 1.5;
  let reached = false;
  for (let k = 0; k < 30 && !enemyGone(enemy); k++) {
    yield { walk: [Math.floor(enemy.x), Math.floor(enemy.y)], offroad: true };
    if (enemyGone(enemy) || Math.hypot(enemy.x - u.x, enemy.y - u.y) > 26) break;
    if (Math.hypot(enemy.x - u.x, enemy.y - u.y) < 1.5) { reached = true; break; }
  }
  u.huntUntil = 0;
  if (!reached || enemyGone(enemy)) {
    if (!enemyGone(enemy)) floater(u.x, u.y - 1.2, 'Ушёл…', '#e8e0c0');
    yield { wait: 1 };
    return;
  }
  u.face = enemy.x > u.x ? 1 : -1; u.vdir = 'E';
  for (let k = 0; k < 3; k++) {
    yield { wait: 0.7, anim: 'chop' };
    fxBurst(enemy.x * TILE, enemy.y * TILE - 8, 6, ['#fff2a0', '#ffffff', '#e8a060'], 55, 40, 0.4, 1.4, 200);
    sfxAt('thud', enemy.x * TILE, enemy.y * TILE, 0.8);
  }
  if (enemyGone(enemy)) return;
  const petName = PET_NAME[rec.kind];
  if (Math.random() < 0.5 || dif().noLoss) {
    // победил
    if (enemy.kind) {
      const name = ANIMALS[enemy.kind].name, x = Math.floor(enemy.x), y = Math.floor(enemy.y);
      enemy.stolenPet = null; enemy.loot = null;
      dropPile(x, y, 'hide', enemy.kind === 'wolf' ? 2 : 1);
      fxBurst(enemy.x * TILE, enemy.y * TILE - 6, 10, ['#e8d0a0', '#a08060', '#7a6a50'], 55, 40, 0.7, 2, 160);
      removeAnimal(enemy);
      logEvent('animal', `${unitNm(u)} отомстил за ${PET_ACC[rec.kind]}: убил ${name.toLowerCase()}`, u.x, u.y);
      toast(`${unitNm(u)} догнал и убил: ${name.toLowerCase()} — ${petName} спасён`);
    } else {
      enemy.state = 'dead'; enemy.t = 0; enemy.moving = false;
      sfxAt('rattle', enemy.x * TILE, enemy.y * TILE, 1.3);
      fxBurst(enemy.x * TILE, enemy.y * TILE - 10, 22, ['#e6dfc8', '#c8c0a4', '#8a6a3a'], 80, 50, 1.2, 2.2, 260);
      floater(enemy.x, enemy.y - 1.6, 'Клац…', '#e8e8d0');
      logEvent('animal', `${unitNm(u)} рассыпал скелета в кости за ${PET_ACC[rec.kind]}`, u.x, u.y);
      toast(`${unitNm(u)} рассыпал скелета в кости — ${petName} спасён`);
    }
    restorePet(rec, enemy.x, enemy.y, 'Спасён!');
    floater(u.x, u.y - 1.3, 'Получил!', '#fff2a0');
    sfxUnit(u, 'hey');
    u.gest = 'fist'; u.gestUntil = Game.time + 2.2;
    yield { wait: 1.6 };
  } else {
    // погиб в схватке
    floater(u.x, u.y - 1.2, '!', '#ff6040');
    fxBurst(u.x * TILE, u.y * TILE - 8, 12, ['#ffc0c0', '#a02818'], 50, 40, 0.7, 1.8, 180);
    sfxAt('thud', u.x * TILE, u.y * TILE, 1);
    const nm = unitNm(u), vx = u.x, vy = u.y;
    toast(`${nm} погиб, защищая ${PET_ACC[rec.kind]}`);
    logEvent('animal', `${nm} погиб, защищая ${PET_ACC[rec.kind]}`, vx, vy);
    removeUnit(u);
    if (enemy.kind) { enemy.stolenPet = null; enemy.loot = null; }
  }
}

// ---------- Сова ----------

const _owlEat = owlEat;
owlEat = function (o) {
  const h = o.hunt;
  if (!h || !h.rab) { _owlEat(o); return; }
  o.hunt = null;
  const r = h.rab;
  if (!r.dead && Math.hypot(r.x * TILE - o.x, r.y * TILE - 8 - o.y) < 36) {
    const owner = r.owner && Game.unitMap.get(r.owner);
    removeAnimal(r);
    floater(o.x / TILE, o.y / TILE - 0.6, 'Ам!', '#fff2a0');
    fxBurst(o.x, o.y, 8, ['#e8d8b0', '#a08860', '#9a8a74'], 34, 20, 0.5, 1.4, 80);
    logEvent('owl', `Сова поймала ${r.owner ? 'ручного ' : ''}${PET_ACC.rabbit}`, o.x / TILE, o.y / TILE);
    if (owner) {
      toast(`Сова унесла ручного кролика у ${unitNm(owner).toLowerCase()}`);
      owner.gest = 'fist'; owner.gestUntil = Game.time + 2.5; owner.gestFace = o.x / TILE > owner.x ? 1 : -1;
      floater(owner.x, owner.y - 1.3, 'Кыш, пернатая!', '#ffb0a0');
    }
  } else floater(o.x / TILE, o.y / TILE - 0.6, 'Мимо!', '#e8e0c0');
  o.from = [o.x, o.y]; o.to = o.back; o.f = 0; o.speed = 1.1; o.goAway = false; o.state = 'fly';
};

// ---------- Досуг: выбор ----------

function leisureExtra(u) {
  const day = !isNightNow() && !isEveningNow() && !(typeof WX !== 'undefined' && WX.k > 0.3);
  if (day && Math.random() < 0.07) { const plan = planGlide(u); if (plan) return glideGen(u, plan); }
  if (Math.random() > 0.6) return null;
  const opts = ['dance', 'flip'];
  const x = Math.floor(u.x), y = Math.floor(u.y);
  const shore = day ? findShore(x, y, 16) : null;
  if (shore) opts.push('stones', 'stones', 'fish', 'fish');
  if (day) opts.push('flowers', 'flowers');
  const rab = day && canTame(u, 'rabbit') ? nearestAnimal(u.x, u.y, 14, a => a.kind === 'rabbit' && !a.owner && !a.dead && !a.hunted) : null;
  const duck = day && canTame(u, 'duck') ? nearestAnimal(u.x, u.y, 18, a => a.kind === 'duck' && !a.owner && !a.dead && !a.hunted) : null;
  if (rab) opts.push('rabbit', 'rabbit', 'rabbit', 'rabbit', 'rabbit');
  if (duck) opts.push('duck', 'duck', 'duck', 'duck');
  const what = opts[(Math.random() * opts.length) | 0];
  switch (what) {
    case 'dance': return danceGen(u);
    case 'flip': return flipGen(u);
    case 'flowers': return flowersGen(u);
    case 'stones': return stonesGen(u, shore);
    case 'fish': return fishGen(u, shore);
    case 'rabbit': return chasePetGen(u, rab);
    case 'duck': return chasePetGen(u, duck);
  }
  return null;
}

// Берег: клетка, где можно стоять, и соседняя вода (направление броска)
function findShore(x, y, r) {
  const cands = [];
  for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) {
    if (!inb(xx, yy) || !isWalkable(xx, yy) || World.road[idx(xx, yy)] || World.door[idx(xx, yy)] || World.bmap[idx(xx, yy)]) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!isWaterAt(xx + dx, yy + dy)) continue;
      let n = 0;
      while (n < 8 && isWaterAt(xx + dx * (n + 1), yy + dy * (n + 1))) n++;
      if (n >= 3) cands.push({ stand: [xx, yy], dir: [dx, dy], water: n, d: Math.hypot(xx - x, yy - y) });
    }
  }
  if (!cands.length) return null;
  cands.sort((p, q) => p.d - q.d);
  return cands[(Math.random() * Math.min(5, cands.length)) | 0];
}

// ---------- Новые забавы ----------

function* danceGen(u) {
  u.fun = { k: 'dance', t0: Game.time, until: Game.time + 6 };
  floater(u.x, u.y - 1.4, 'Тра-ля-ля!', '#ffd0f0');
  for (let k = 0; k < 9; k++) {
    u.face = -u.face;
    if (k % 3 === 0) floater(u.x + (k % 2 ? 0.5 : -0.5), u.y - 1.6, '♪', '#fff2a0');
    yield { wait: 0.5 };
  }
  u.fun = null;
}

function* flipGen(u) {
  const n = 2 + ((Math.random() * 2) | 0);
  u.fun = { k: 'flip', t0: Game.time, until: Game.time + 0.85 * n + 0.2 };
  floater(u.x, u.y - 1.4, 'Смотри!', '#fff2a0');
  yield { wait: 0.5 };
  u.fun.t0 = Game.time;
  for (let k = 0; k < n; k++) yield { wait: 0.85 };
  u.fun = null;
  if (Math.random() < 0.25) {            // не вышло: приземлился на пятую точку
    floater(u.x, u.y - 1.2, 'Бух!', '#d8c8a0');
    u.ouchUntil = Game.time + 1.6;
    yield { wait: 1.3, anim: 'knocked' };
  } else {
    u.gest = 'wave'; u.gestUntil = Game.time + 1.6; floater(u.x, u.y - 1.3, 'Опа!', '#fff2a0');
    yield { wait: 1.2 };
  }
}

function* flowersGen(u) {
  const s = randomFreeNear(Math.floor(u.x), Math.floor(u.y), 2, 9, (x, y) => isWalkable(x, y) && World.terrain[idx(x, y)] === T_GRASS && !World.road[idx(x, y)] && !World.door[idx(x, y)]);
  if (!s) return;
  if (!(yield { walk: s, offroad: true })) return;
  const n = 2 + ((Math.random() * 2) | 0);
  for (let k = 0; k < n; k++) { yield { wait: 1.1, anim: 'forage' }; fxBurst(u.x * TILE, u.y * TILE - 4, 3, ['#ff90c0', '#fff2a0', '#a0d8ff'], 18, 18, 0.5, 1.2, 60); }
  u.flower = { until: Game.time + 120, col: ['#ff7aa8', '#ffe060', '#8ac8ff', '#ffffff'][(Math.random() * 4) | 0] };
  floater(u.x, u.y - 1.3, 'Цветочек!', '#ffc0e0');
  u.gest = 'wave'; u.gestUntil = Game.time + 1.4;
  yield { wait: 1.3 };
}

function* toShore(u, shore) {
  const ok = yield { walk: shore.stand, offroad: true };
  if (!ok) return false;
  u.face = shore.dir[0] ? shore.dir[0] : u.face; u.vdir = 'E';
  return true;
}

function* stonesGen(u, shore) {
  if (!(yield* toShore(u, shore))) return;
  const throws = 2 + ((Math.random() * 2) | 0);
  const [sx, sy] = shore.stand, [dx, dy] = shore.dir;
  for (let t = 0; t < throws; t++) {
    yield { wait: 0.6, anim: 'duck' };
    u.gest = 'wave'; u.gestUntil = Game.time + 0.7; u.gestFace = u.face;
    yield { wait: 0.45 };
    const hops = Math.min(shore.water, 2 + ((Math.random() * 5) | 0));
    for (let h = 1; h <= hops; h++) {
      const wx = sx + 0.5 + dx * (h + 0.4), wy = sy + 0.5 + dy * (h + 0.4);
      fxLater(0.16 * h, () => {
        fxBurst(wx * TILE, wy * TILE, 7, ['#ffffff', '#c8e4f8', '#8ac0e8'], 22, 28, 0.45, 1.3, 120);
        sfxAt('chime', wx * TILE, wy * TILE, 0.25);
      });
    }
    yield { wait: 0.16 * hops + 0.5 };
    floater(u.x, u.y - 1.3, hops >= 6 ? `${hops} раз! Рекорд!` : `${hops} раз`, '#c8e8ff');
    if (hops >= 6) { u.gest = 'fist'; u.gestUntil = Game.time + 1.5; sfxUnit(u, 'hey'); }
    yield { wait: 0.8 };
  }
}

function* fishGen(u, shore) {
  if (!(yield* toShore(u, shore))) return;
  const [sx, sy] = shore.stand, [dx, dy] = shore.dir;
  const n = Math.min(shore.water, 3);
  const wx = sx + 0.5 + dx * (n - 0.3), wy = sy + 0.5 + dy * (n - 0.3);
  const total = 7 + Math.random() * 6;
  u.fun = { k: 'rod', t0: Game.time, until: Game.time + total + 3, wx, wy, bite: 0 };
  const bite = total * (0.55 + Math.random() * 0.3);
  const t0 = Game.time;
  while (Game.time - t0 < total) {
    if (!u.fun) return;                                // досуг прервали (игры гномов, драка) и вернули старый генератор
    if (!u.fun.bite && Game.time - t0 > bite) { u.fun.bite = Game.time + 1.4; floater(u.x, u.y - 1.3, '!', '#ffe060'); }
    yield { wait: 0.4 };
  }
  if (!u.fun) return;
  const got = Math.random() < 0.6 && !u.fun.stolen;   // цапля могла стащить улов (beasts.js)
  fxBurst(wx * TILE, wy * TILE, 9, ['#ffffff', '#c8e4f8', '#8ac0e8'], 30, 38, 0.5, 1.4, 150);
  if (got) {
    floater(u.x, u.y - 1.3, 'Рыбка!', '#c8f0ff');
    u.food = Math.min(1.1, u.food + 0.12);
    u.gest = 'fist'; u.gestUntil = Game.time + 1.8; sfxUnit(u, 'hey');
    logEvent('people', `${unitNm(u)} поймал рыбку и съел`, u.x, u.y);
  } else {
    floater(u.x, u.y - 1.3, 'Сорвалась…', '#e8e0c0');
    u.gest = 'scratch'; u.gestUntil = Game.time + 1.6;
  }
  u.fun = null;
  yield { wait: 1.6 };
}

// Погоня за кроликом или уткой: шанс поймать невелик, но пойманный становится ручным
function* chasePetGen(u, pet) {
  pet.chasedBy = u.id; pet.chaseEnd = Game.time + 45;
  u.gest = ''; u.gestUntil = 0;
  for (let k = 0; k < 15 && !pet.dead && !pet.owner && pet.chasedBy === u.id; k++) {
    if (k === 0) floater(u.x, u.y - 1.2, pet.kind === 'duck' ? 'Иди сюда, утя!' : 'Кролик, стой!', '#ffe8c0');
    u.huntUntil = Game.time + 3;
    const s = [Math.floor(pet.x), Math.floor(pet.y)];
    if (!inb(s[0], s[1]) || !isWalkable(s[0], s[1])) break;
    yield { walk: s, offroad: true };
  }
  u.huntUntil = 0;
  if (pet.chasedBy === u.id) pet.chasedBy = 0;
  if (pet.owner === u.id) { yield { wait: 1.4 }; return; }
  u.gest = Math.random() < 0.5 ? 'wave' : 'scratch'; u.gestUntil = Game.time + 1.6;
  floater(u.x, u.y - 1.2, 'Убежал…', '#e8e0c0');
  yield { wait: 1.4 };
}

// ---------- Параплан ----------

function planGlide(u) {
  const bs = Game.buildings.filter(b => b.state === 'done' && b.type !== 'magiccircle' && b.type !== 'bonfire' && Math.hypot(b.doorX - u.x, b.doorY - u.y) < 24)
    .sort(() => Math.random() - 0.5);
  for (const b of bs.slice(0, 6)) {
    const ps = roofPerches(b);
    if (!ps.length) continue;
    const p = ps[(Math.random() * ps.length) | 0];
    const gx = Math.floor(p[0] / TILE), gy = Math.floor(p[2] / TILE);
    let stand = [gx, gy];
    if (!isWalkable(gx, gy) || World.bmap[idx(gx, gy)]) stand = [b.doorX, b.doorY];
    const bx = p[0] / TILE, by = (p[2] - 10) / TILE + 0.5;            // земля под коньком
    const a0 = Math.random() * Math.PI * 2;
    for (let k = 0; k < 36; k++) {
      const ang = a0 + k * 0.5, dist = 15 + (Math.random() - 0.5);
      const lx = Math.round(bx + Math.cos(ang) * dist), ly = Math.round(by + Math.sin(ang) * dist);
      if (!inb(lx, ly) || !isWalkable(lx, ly) || World.bmap[idx(lx, ly)] || World.door[idx(lx, ly)] || World.terrain[idx(lx, ly)] === T_WATER) continue;
      return { b, perch: p, stand, land: [lx, ly], sx: bx, sy: by };
    }
  }
  return null;
}

const GLIDE_COLS = [['#e04a3a', '#f4e8d0'], ['#3a8ae0', '#f4e8d0'], ['#e0b030', '#c04a2a'], ['#4ab060', '#f4e8d0'], ['#a050d0', '#f0d8f0']];

function* glideGen(u, plan) {
  const { perch, stand, land } = plan;
  const H0 = Math.max(26, perch[2] - perch[1] - 6);        // высота конька над землёй, px
  u.idleFlag = false;
  if (!(yield { walk: stand, offroad: true })) return;
  if (Game.time < (u.pauseUntil || 0)) yield { wait: 0.3 };
  const col = GLIDE_COLS[(Math.random() * GLIDE_COLS.length) | 0];
  const ladderX = perch[0] - u.x * TILE;                          // сдвиг лестницы относительно гнома, px
  const gl = u.glide = { ph: 'climb', t0: Game.time, lift: 0, ox: 0, col, open: 0, lad: { x: perch[0], y0: perch[1] + 3, y1: u.y * TILE + 6 }, H0 };
  floater(u.x, u.y - 1.4, 'Я полетаю!', '#d8f0ff');
  u.gest = ''; u.gestUntil = 0;
  // лезет по приставной лестнице на крышу
  const T1 = 2.4;
  for (;;) {
    const p = Math.min(1, (Game.time - gl.t0) / T1);
    gl.lift = H0 * p; gl.ox = ladderX * Math.min(1, p * 3);
    if (p >= 1) break;
    yield { wait: 0.05 };
  }
  // на коньке: достаёт и раскрывает купол
  gl.ph = 'open'; gl.t0 = Game.time;
  sfxUnit(u, 'hey');
  for (;;) {
    const p = Math.min(1, (Game.time - gl.t0) / 1.3);
    gl.open = p;
    if (p >= 1) break;
    yield { wait: 0.05 };
  }
  yield { wait: 0.5 };
  // прыжок и полёт: спуск по пологой кривой к точке за 15 клеток
  gl.ph = 'fly'; gl.t0 = Game.time; gl.lad = null;
  const gx0 = perch[0] / TILE, gy0 = u.y;
  const gx1 = land[0] + 0.5, gy1 = land[1] + 0.5;
  const T2 = 5.6;
  u.face = gx1 > gx0 ? 1 : -1;
  floater(u.x, u.y - 2, 'Э-ге-гей!', '#fff2a0');
  for (;;) {
    const p = Math.min(1, (Game.time - gl.t0) / T2);
    gl.s = p;
    gl.lift = H0 * Math.pow(1 - p, 1.25) + Math.sin(p * Math.PI) * 7;
    gl.ox = 0;
    u.x = gx0 + (gx1 - gx0) * p; u.y = gy0 + (gy1 - gy0) * p;
    u.face = gx1 > gx0 ? 1 : -1;
    if (p >= 1) break;
    yield { wait: 0.05 };
  }
  u.x = gx1; u.y = gy1;
  gl.ph = 'land'; gl.t0 = Game.time; gl.lift = 0;
  sfxAt('thud', u.x * TILE, u.y * TILE, 0.6);
  fxBurst(u.x * TILE, u.y * TILE + 4, 8, ['#d8c8a0', '#b8a880'], 30, 20, 0.6, 1.6, 100);
  logEvent('people', `${unitNm(u)} спрыгнул с крыши на параплане и приземлился за 15 клеток`, u.x, u.y);
  if (Math.random() < 0.1) {                     // неудачное приземление
    floater(u.x, u.y - 1.2, 'Бух!', '#d8c8a0');
    u.ouchUntil = Game.time + 2.2;
    if (Math.random() < 0.5) injure(u, 'leg');
    yield { wait: 1.6, anim: 'knocked' };
  } else {
    floater(u.x, u.y - 1.3, 'Ура! Ещё раз!', '#fff2a0');
    u.gest = 'fist'; u.gestUntil = Game.time + 2; sfxUnit(u, 'hey');
    yield { wait: 1.2 };
  }
  yield { wait: 1.6 };                           // сворачивает купол
  u.glide = null;
}

// ---------- Рисование ----------

// Рисует гнома со сдвигом вверх и поворотом; тень остаётся на земле
function drawUnitXform(c, u, lift, rot, ox, shadowK) {
  const px = Math.round(u.x * TILE), py = Math.round(u.y * TILE + 6);
  c.fillStyle = `rgba(10,8,4,${0.32 * shadowK})`;
  c.beginPath(); c.ellipse(px + 1.5, py - 0.2, 5.5 * (0.6 + 0.4 * shadowK), 2 * (0.6 + 0.4 * shadowK), 0, 0, 7); c.fill();
  let first = true;
  const pr = new Proxy(c, {
    get(t, k) {
      if (k === 'ellipse' && first) { first = false; return () => {}; }
      const v = t[k]; return typeof v === 'function' ? v.bind(t) : v;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
  c.save();
  c.translate(px + ox, py - lift - 10); c.rotate(rot); c.translate(-px, 10 - py + 0);
  c.translate(0, 0);
  _drawUnitBase(pr, u);
  c.restore();
}

function drawCanopy(c, cx, cy, w, h, cols, open, sag) {
  // купол-парафойл: дуга из ячеек двух цветов
  const W = w * (0.35 + 0.65 * open), Hh = h * open;
  const n = 7;
  c.save();
  for (let i = 0; i < n; i++) {
    const a0 = -1 + 2 * i / n, a1 = -1 + 2 * (i + 1) / n;
    const x0 = cx + a0 * W / 2, x1 = cx + a1 * W / 2;
    const y0 = cy - Math.sqrt(Math.max(0, 1 - a0 * a0)) * Hh + Math.abs(a0) * sag, y1 = cy - Math.sqrt(Math.max(0, 1 - a1 * a1)) * Hh + Math.abs(a1) * sag;
    c.fillStyle = cols[i & 1];
    c.beginPath(); c.moveTo(x0, cy + Math.abs(a0) * sag + 1); c.lineTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2, Math.min(y0, y1) - 1.6 * open, x1, y1); c.lineTo(x1, cy + Math.abs(a1) * sag + 1); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(30,15,5,0.6)'; c.lineWidth = 0.4; c.stroke();
  }
  c.restore();
}

function drawGliderUnit(c, u) {
  const g = u.glide;
  if (Game.time > g.t0 + 40) { u.glide = null; _drawUnitBase(c, u); return; }
  const px = Math.round(u.x * TILE), py = Math.round(u.y * TILE + 6);
  // приставная лестница к коньку
  if (g.lad) {
    const L = g.lad;
    c.strokeStyle = '#6a4424'; c.lineWidth = 1.1;
    c.beginPath(); c.moveTo(L.x - 3, L.y0); c.lineTo(L.x - 3, L.y1); c.moveTo(L.x + 3, L.y0); c.lineTo(L.x + 3, L.y1); c.stroke();
    c.lineWidth = 0.9; c.strokeStyle = '#8a5c32';
    for (let y = L.y1 - 4; y > L.y0; y -= 4.5) { c.beginPath(); c.moveTo(L.x - 3, y); c.lineTo(L.x + 3, y); c.stroke(); }
  }
  const t = Game.time - g.t0;
  const lift = g.lift, flying = g.ph === 'fly';
  const sway = flying ? Math.sin(Game.time * 2.6) * 0.07 : 0;
  const shK = flying ? Math.max(0.3, 1 - lift / 60) : 1;
  drawUnitXform(c, u, lift, sway, g.ox, shK);
  const cx = px + g.ox, top = py - lift;
  if (g.ph === 'open') {
    // купол вытягивается из-за спины и раскрывается над головой
    drawCanopy(c, cx - u.face * (1 - g.open) * 10, top - 42 - g.open * 4, 30, 7, g.col, g.open, 3);
  } else if (flying) {
    const ripple = Math.sin(Game.time * 3.4) * 0.8;
    // стропы к рукам
    c.strokeStyle = 'rgba(40,30,20,0.7)'; c.lineWidth = 0.4;
    for (const [dx, k] of [[-12, -1], [-6, -0.5], [6, 0.5], [12, 1]]) { c.beginPath(); c.moveTo(cx + dx, top - 45 + Math.abs(k) * 3); c.lineTo(cx + (k > 0 ? 2 : -2), top - 21); c.stroke(); }
    drawCanopy(c, cx, top - 45 + ripple, 30, 8, g.col, 1, 3);
    // тень купола на земле
    c.fillStyle = 'rgba(10,8,4,0.18)'; c.beginPath(); c.ellipse(px, py + 1, 12 * shK + 2, 3 * shK + 1, 0, 0, 7); c.fill();
  } else if (g.ph === 'land') {
    // купол оседает позади гнома
    const p = Math.min(1, t / 1.6);
    c.globalAlpha = 1;
    drawCanopy(c, px - u.face * (6 + p * 8), py - 18 * (1 - p) - 2, 30, 8 * (1 - p) + 0.5, g.col, Math.max(0.15, 1 - p), 2 + p * 4);
  } else if (g.ph === 'climb') {
    // купол свёрнут в мешок за плечами
    ellipse(c, cx - u.face * 3, top - 17, 3.4, 4.6, '#b09a70');
  }
}

const _drawUnitBase = drawUnit;
drawUnit = function (c, u) {
  if (u.glide) { drawGliderUnit(c, u); return; }
  const f = u.fun;
  if (f && f.until > Game.time) {
    const t = Game.time - f.t0;
    if (f.k === 'dance') { drawUnitXform(c, u, Math.abs(Math.sin(t * 9)) * 3.2, Math.sin(t * 4.5) * 0.16, 0, 1); drawFlower(c, u); return; }
    if (f.k === 'flip') {
      const p = Math.max(0, t) / 0.85 % 1, fp = Math.max(0, t) >= 0 && t < 99 ? p : 0;
      drawUnitXform(c, u, Math.sin(fp * Math.PI) * 11, -fp * Math.PI * 2 * (u.face || 1), 0, 1);
      return;
    }
    if (f.k === 'rod') { _drawUnitBase(c, u); drawFlower(c, u); drawRod(c, u, f); return; }
  }
  _drawUnitBase(c, u);
  drawFlower(c, u);
};

// Венок-цветок на колпаке
function drawFlower(c, u) {
  if (!u.flower || u.flower.until < Game.time || u.inside) return;
  const px = Math.round(u.x * TILE), py = Math.round(u.y * TILE + 6);
  const col = u.flower.col, fx = px + 3.2, fy = py - 33.5;
  c.fillStyle = col;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) c.fillRect(Math.round(fx + dx * 1.2), Math.round(fy + dy * 1.2), 1, 1);
  c.fillStyle = '#fff2a0'; c.fillRect(Math.round(fx), Math.round(fy), 1, 1);
  c.fillStyle = '#3a8a3a'; c.fillRect(Math.round(fx) - 1, Math.round(fy) + 2, 2, 1);
}

// Удочка: прут над плечом, леска к воде, поплавок
function drawRod(c, u, f) {
  const px = Math.round(u.x * TILE), py = Math.round(u.y * TILE + 6);
  const dir = f.wx > u.x ? 1 : f.wx < u.x ? -1 : (u.face || 1);
  const hx = px + dir * 4, hy = py - 14;
  const tx = hx + dir * 11, ty = hy - 14;
  c.save(); c.lineCap = 'round';
  c.strokeStyle = '#7a5230'; c.lineWidth = 1; c.beginPath(); c.moveTo(hx, hy + 1); c.quadraticCurveTo(hx + dir * 6, hy - 8, tx, ty); c.stroke();
  const bx = f.wx * TILE, by = f.wy * TILE + 3 + (f.bite > Game.time ? Math.abs(Math.sin(Game.time * 14)) * 1.5 : Math.sin(Game.time * 2) * 0.3);
  c.strokeStyle = 'rgba(235,235,235,0.75)'; c.lineWidth = 0.35;
  c.beginPath(); c.moveTo(tx, ty); c.quadraticCurveTo((tx + bx) / 2, Math.max(ty, by) + 4, bx, by); c.stroke();
  c.strokeStyle = 'rgba(235,245,255,0.55)'; c.lineWidth = 0.4;
  c.beginPath(); c.ellipse(bx, by + 0.8, 3 + (f.bite > Game.time ? 1.5 : 0), 1.1, 0, 0, 7); c.stroke();
  c.fillStyle = '#e04030'; c.beginPath(); c.arc(bx, by, 1.2, 0, 7); c.fill();
  c.fillStyle = '#ffffff'; c.fillRect(Math.round(bx) - 1, Math.round(by), 2, 1);
  c.restore();
}
