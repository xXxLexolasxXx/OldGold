'use strict';
// Субботник: команда раз в день, с утра. Кнопка в верхней панели. На сто секунд вся деревня
// бросает дела: гномы собирают мусор в большой костёр, высаживают клумбы и ставят оградки у дорожек.
// Звери становятся мирными и тоже носят мусор в костёр. В конце — отчёт и аплодисменты.

const SUB_LEN = 100, SUB_MORNING = 120;

function subState() {
  const cy = cycleAt(Game.time);
  if (Game.sub && Game.sub.active) return { ok: false, why: 'active', left: Math.max(0, Game.sub.until - Game.time) };
  if (isNightNow() || isEveningNow()) return { ok: false, why: 'Субботник — только днём, с утра' };
  if (Game.subDay === cy.k) return { ok: false, why: 'Сегодня субботник уже был. Завтра с утра — снова' };
  if (cy.p >= SUB_MORNING) return { ok: false, why: 'Утро прошло: субботник проводят с рассвета' };
  return { ok: true };
}

function subFire(x, y) {
  let best = null, bd = 1e9;
  for (const b of Game.buildings) {
    if (b.type !== 'bonfire' || b.state !== 'done' || b.removed) continue;
    const d = Math.hypot(b.doorX - x, b.doorY - y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

function nearestTrashPile(x, y, r) {
  let best = null, bd = r;
  for (const p of Game.piles.values()) {
    if (p.removed || p.stock.trash - p.reserved.trash <= 0) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

function startSubbotnik() {
  const st = subState();
  if (!st.ok) { if (st.why !== 'active') toast(st.why); return false; }
  const cy = cycleAt(Game.time);
  Game.subDay = cy.k;
  Game.sub = { active: true, t0: Game.time, until: Game.time + SUB_LEN, trash: 0, beds: 0, fences: 0, taken: new Set(), noFire: false };
  const people = Game.units.filter(u => isPerson(u) && u.type !== 'carter' && !u.dead);
  // деревня за день успела намусорить: разбросано по улицам
  const n = Math.max(12, Math.min(40, Math.round(10 + people.length * 1.1)));
  let made = 0;
  for (let k = 0; k < n * 12 && made < n; k++) {
    const i = (Math.random() * N_TILES) | 0;
    if (!World.road[i] || World.door[i]) continue;
    const x = i % MAP_W, y = (i / MAP_W) | 0;
    const spot = randomFreeNear(x, y, 0, 2, (xx, yy) => isWalkable(xx, yy) && !World.door[idx(xx, yy)] && !World.bmap[idx(xx, yy)]) || [x, y];
    if (!spot) continue;
    dropPile(spot[0], spot[1], 'trash', 1 + (Math.random() < 0.35 ? 1 : 0)); made++;
  }
  if (!subFire(0, 0)) Game.sub.noFire = true;
  toast(Game.sub.noFire ? 'Субботник! Но костра нет — мусор носить некуда, зато цветы посадим' : 'Субботник! Все — на уборку, зверям тоже велено вести себя прилично');
  logEvent('people', 'Объявлен субботник: деревня берётся за метлы');
  sfxAt('chime', MAP_W * TILE / 2, MAP_H * TILE / 2, 0.6);
  subButtonUpdate();
  return true;
}

function endSubbotnik() {
  const S = Game.sub;
  if (!S || !S.active) return;
  S.active = false;
  const msg = `Субботник окончен: убрано мусора — ${S.trash}, клумб — ${S.beds}, оградок — ${S.fences}`;
  toast(msg);
  logEvent('people', msg + (S.trash + S.beds + S.fences < 5 ? '. Негусто, но порыв засчитан' : '. Деревня сияет — ровно до первого перекура'));
  if (S.trash + S.beds + S.fences >= 3) applaud('Деревня довольна: чисто, красиво, пахнет цветами');
  subButtonUpdate();
}

function subTick(dt) {
  const S = Game.sub;
  if (S && S.active) {
    if (Game.time >= S.until || isNightNow() || isEveningNow()) endSubbotnik();
    else {
      S.asg = (S.asg || 0) - dt;
      if (S.asg <= 0) {
        S.asg = 1.5;
        for (const u of Game.units) {
          if (!isPerson(u) || u.type === 'carter' || u.hero || u.inside || u.dead || u.brk || !interruptible(u)) continue;
          startBreak(u, 'sub', null); u.proc = subGen(u);
        }
      }
    }
  }
  subButtonUpdate();
}

// ---------- Кнопка ----------
function subButtonUpdate() {
  const b = document.getElementById('sub-btn');
  if (!b) return;
  const st = subState();
  const label = b.querySelector('span');
  if (st.why === 'active') { label.textContent = `Субботник ${fmtTime(st.left)}`; b.classList.add('sub-on'); b.classList.remove('sub-ready'); b.title = 'Субботник идёт'; }
  else { label.textContent = 'Субботник'; b.classList.remove('sub-on'); b.classList.toggle('sub-ready', st.ok); b.title = st.ok ? 'Объявить субботник: все убирают мусор, сажают цветы, ставят оградки (раз в день, с утра)' : st.why; }
}

// ---------- Работа гнома ----------
function* subGen(u) {
  floater(u.x, u.y - 1, ['Субботник!', 'Чистота — залог здоровья!', 'Ну, поехали…', 'Метлу мне, метлу!'][(Math.random() * 4) | 0], '#d8f0a0');
  for (let guard = 0; Game.sub && Game.sub.active && !u.dead && guard < 60; guard++) {
    const S = Game.sub, fire = subFire(u.x, u.y);
    const pile = fire ? nearestTrashPile(u.x, u.y, 24) : null;
    const quotaB = Math.max(6, Math.ceil(Game.units.length * 0.9)), quotaF = 14;
    if (pile) { yield* subTrash(u, pile, fire); continue; }
    if (S.beds < quotaB && (S.fences >= quotaF || Math.random() < 0.65)) { yield* subPlant(u); continue; }
    if (S.fences < quotaF) { yield* subFence(u); continue; }
    yield { wait: 2 };
  }
  if (u.carry === 'trash') u.carry = null;
}

function* subTrash(u, pile, fire) {
  pile.reserved.trash++;
  u.subRes = { pile, gen: u.proc };   // бронь видна аудиту (auditIncoming)
  const ok = yield { walk: [pile.x, pile.y], offroad: true };
  if (!ok || pile.removed || pile.stock.trash < 1) { u.subRes = null; if (!pile.removed) pile.reserved.trash = Math.max(0, pile.reserved.trash - 1); yield { wait: 0.5 }; return; }
  yield { wait: 0.7, anim: 'forage' };
  u.subRes = null;
  pile.reserved.trash = Math.max(0, pile.reserved.trash - 1);
  if (pile.removed || pile.stock.trash < 1) return;
  pile.stock.trash--; cleanupPile(pile);
  u.carry = 'trash'; u.carryN = 1;
  const ok2 = yield { walk: [fire.doorX, fire.doorY] };
  if (ok2 && !fire.removed && u.carry) { fire.stock.trash++; if (Game.sub) Game.sub.trash++; }
  else if (u.carry) dropPile(Math.floor(u.x), Math.floor(u.y), 'trash', 1);
  u.carry = null; u.carryN = 0;
  yield { wait: 0.3 };
}

// свободное место у дороги неподалёку от гнома: [x, y, roadDx, roadDy]
function subSpot(u, r) {
  for (let k = 0; k < 40; k++) {
    const x = Math.floor(u.x + (Math.random() * 2 - 1) * r), y = Math.floor(u.y + (Math.random() * 2 - 1) * r);
    if (!inb(x, y) || !World.road[idx(x, y)] || World.door[idx(x, y)]) continue;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]].sort(() => Math.random() - 0.5)) {
      const sx = x + dx, sy = y + dy, key = idx(sx, sy);
      if (!streetSpot(sx, sy) || Game.sub.taken.has(key)) continue;
      return [sx, sy, -dx, -dy, key];
    }
  }
  return null;
}

function* subPlant(u) {
  const sp = farSpot(u.x, u.y, 12, 3.5, Game.sub.taken);   // клумбы — на отдалении от дороги и не кучей
  if (!sp) { yield { wait: 2 }; return; }
  const [x, y] = sp, key = idx(x, y);
  Game.sub.taken.add(key);
  const ok = yield { walk: [x, y], offroad: true };
  if (!ok || !isFreeGrass(x, y)) { Game.sub.taken.delete(key); yield { wait: 0.5 }; return; }
  u.vdir = 'E';
  yield { wait: 2.6, anim: 'dig' };
  if (!Game.sub || !isFreeGrass(x, y)) { Game.sub && Game.sub.taken.delete(key); return; }
  World.obj[key] = { t: 'bed', v: (Math.random() * 10) | 0, born: Game.time };
  Game.sub.beds++;
  fxBurst((x + 0.5) * TILE, (y + 0.9) * TILE, 10, ['#f08ac0', '#f0c840', '#ffffff', '#8ad0ff'], 35, 50, 0.9, 1.6, 40);
  floater(x + 0.5, y, ['Цветочки!', 'Красота!', 'Расти большой'][(Math.random() * 3) | 0], '#ffd0e8');
}

function* subFence(u) {
  const sp = subSpot(u, 14);
  if (!sp) { yield { wait: 2 }; return; }
  const [x, y, rdx, , key] = sp;
  Game.sub.taken.add(key);
  const ok = yield { walk: [x, y], offroad: true };
  if (!ok || !isFreeGrass(x, y)) { Game.sub.taken.delete(key); yield { wait: 0.5 }; return; }
  u.vdir = 'E';
  for (let k = 0; k < 3; k++) { yield { wait: HIT_TIME, anim: 'build' }; }
  if (!Game.sub || !isFreeGrass(x, y)) { Game.sub && Game.sub.taken.delete(key); return; }
  // вдоль дороги: дорога сверху/снизу — оградка горизонтальная, сбоку — вертикальная
  World.obj[key] = { t: 'fence', v: (Math.random() * 5) | 0, vert: rdx !== 0, born: Game.time };
  Game.sub.fences++;
  fxBurst((x + 0.5) * TILE, (y + 0.9) * TILE, 6, ['#d8b070', '#a0703a'], 30, 40, 0.6, 1.4, 200);
}

// ---------- Звери во время субботника ----------
// Возвращает true, если зверь занят субботником и обычное поведение пропускается.
function subAnimal(a, dt) {
  const S = Game.sub;
  if (!S || !S.active) { if (a.subSt) { a.subSt = null; a.subPile = null; if (a.loot === 'trash') a.loot = null; } return false; }
  if (a.dead || a.follow || a.tamedBy) return false;
  if (a.state === 'chase' || a.state === 'charge' || a.state === 'flee' || a.state === 'run' || a.target) { a.state = 'wander'; a.target = null; a.path = null; a.chaseUntil = 0; }
  if (!a.subSt) a.subSt = 'idle';
  const fire = subFire(a.x, a.y);
  if (a.subSt === 'idle') {
    a.moving = false; a.loot = null;
    if (fire && a.think <= 0) {
      a.think = 0.8 + Math.random() * 2;
      const p = nearestTrashPile(a.x, a.y, 16);
      if (p) { p.reserved.trash++; a.subPile = p; animalGo(a, p.x, p.y); if (a.path) a.subSt = 'toPile'; else p.reserved.trash = Math.max(0, p.reserved.trash - 1); }
    }
    return true;
  }
  if (a.subSt === 'toPile') {
    if (animalStep(a, dt, 1.9)) {
      const p = a.subPile; a.subPile = null;
      if (p && !p.removed && p.stock.trash > 0 && fire) {
        p.reserved.trash = Math.max(0, p.reserved.trash - 1); p.stock.trash--; cleanupPile(p);
        a.loot = 'trash'; animalGo(a, fire.doorX, fire.doorY); a.subSt = a.path ? 'toFire' : 'idle';
        if (a.subSt === 'idle') { dropPile(Math.floor(a.x), Math.floor(a.y), 'trash', 1); a.loot = null; }
      } else { if (p && !p.removed) p.reserved.trash = Math.max(0, p.reserved.trash - 1); a.subSt = 'idle'; }
    }
    return true;
  }
  if (a.subSt === 'toFire') {
    if (animalStep(a, dt, 1.9)) { if (fire && !fire.removed) { fire.stock.trash++; S.trash++; } a.loot = null; a.subSt = 'idle'; }
    return true;
  }
  a.subSt = 'idle';
  return true;
}

document.addEventListener('DOMContentLoaded', () => {
  const b = document.getElementById('sub-btn');
  if (b) b.addEventListener('click', () => { startSubbotnik(); subButtonUpdate(); });
});
