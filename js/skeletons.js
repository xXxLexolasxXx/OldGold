'use strict';
// Скелеты: по ночам из кладбища поднимаются гномьи скелеты в рваных колпаках и с ржавыми мечами.
// Они бродят у своей могилы (в пределах клетки), а кто подойдёт близко — того рубят.
// Гном, павший от скелета, нередко встаёт скелетом сам. Призраки пугают и скелетов тоже.

const SKEL_SEE = 3.2, SKEL_LEASH = 5;

function skelCount() { return Math.min(8, 2 + Math.floor((Game.lostGnomes || 0) / 2)); }

function skeletonsSpawn() {
  const gy = graveyardOf();
  if (!gy) return;
  const sk = Game.skels || (Game.skels = []);
  for (let i = sk.length; i < skelCount(); i++) {
    // клетка у ограды кладбища, на которую можно встать
    let hx = -1, hy = -1;
    for (let tries = 0; tries < 30; tries++) {
      const side = (Math.random() * 3) | 0;
      const x = side === 0 ? gy.x - 1 : side === 1 ? gy.x + gy.w : gy.x + Math.floor(Math.random() * gy.w);
      const y = side === 2 ? gy.y + gy.h : gy.y + Math.floor(Math.random() * gy.h);
      if (inb(x, y) && isWalkable(x, y) && !World.bmap[idx(x, y)]) { hx = x; hy = y; break; }
    }
    if (hx < 0) continue;
    skelRise(hx + 0.5, hy + 0.5, 0.6 + Math.random() * 6);
  }
}

function skelRise(x, y, delay = 0) {
  const sk = Game.skels || (Game.skels = []);
  sk.push({ x, y, hx: x, hy: y, state: 'rise', t: -delay, face: Math.random() < 0.5 ? 1 : -1, phase: Math.random() * 6, k: 0, alpha: 1,
    goal: null, wait: 0, moving: false, foe: null, fighters: [], resolved: false, scan: Math.random(), atk: 0, scared: 0, seen: new Set() });
}

function skelMove(s, tx, ty, speed, dt) {
  const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy);
  s.moving = d > 0.03;
  if (!s.moving) return true;
  if (Math.abs(dx) > 0.02) s.face = dx > 0 ? 1 : -1;
  const step = speed * dt;
  s.phase += step * 8;
  if (step >= d) { s.x = tx; s.y = ty; return true; }
  s.x += dx / d * step; s.y += dy / d * step;
  return false;
}

function skeletonsTick(dt) {
  const sk = Game.skels;
  if (!sk || !sk.length) return;
  const night = isNightNow() || isEveningNow();
  for (let i = sk.length - 1; i >= 0; i--) {
    const s = sk[i];
    s.t += dt; s.moving = false;
    if (s.scared > 0) s.scared -= dt;
    // рассвет: уходят обратно в землю
    if (!night && s.state !== 'sink' && s.state !== 'dead' && s.state !== 'fight') { s.state = 'sink'; s.t = 0; }
    switch (s.state) {
      case 'rise':
        if (s.t < 0) { s.k = 0; break; }
        if (!s.dug) { s.dug = true; fxBurst(s.x * TILE, s.y * TILE + 8, 14, ['#4a4234', '#2a241c', '#7a7468'], 45, 55, 0.9, 2, 220); sfxAt('creak', s.x * TILE, s.y * TILE, 0.9); }
        s.k = Math.min(1, s.t / 1.8);
        if (s.t >= 1.8) { s.state = 'roam'; s.t = 0; s.wait = 1; }
        break;
      case 'roam': {
        if (s.scared > 0) break;
        if (s.wait > 0) { s.wait -= dt; break; }
        if (!s.goal) s.goal = [s.hx + (Math.random() * 2 - 1) * 1, s.hy + (Math.random() * 2 - 1) * 1];      // бродит в пределах одной клетки
        if (skelMove(s, s.goal[0], s.goal[1], 0.45, dt)) { s.goal = null; s.wait = 1 + Math.random() * 2.5; }
        break;
      }
      case 'fight': {
        const alive = s.fighters.filter(f => !f.dead && f.brk && f.brk.kind === 'fight');
        if (!alive.length) { if (s.t > 1) { s.state = 'roam'; s.fighters = []; s.resolved = false; s.t = 0; s.goal = null; } break; }
        // подходит к первому бойцу
        const f = alive[0];
        if (Math.hypot(f.x - s.x, f.y - s.y) > 1.1 && !s.resolved) skelMove(s, f.x - Math.sign(f.x - s.x) * 0.9, f.y, 0.9, dt);
        else s.face = f.x > s.x ? 1 : -1;
        if (s.t > 30 && !s.resolved) skelResolve(s);
        break;
      }
      case 'dead':
        if (s.t > 3.2) { sk.splice(i, 1); continue; }
        break;
      case 'sink':
        s.k = Math.max(0, 1 - s.t / 1.6);
        if (s.t >= 1.6) { sk.splice(i, 1); continue; }
        break;
    }
    if (s.state === 'roam' || s.state === 'rise') { /* ничего: гуляет у могилы */ }
    // дозор: гном подошёл — реакция
    if (s.state === 'roam' && s.k >= 1) {
      s.scan -= dt;
      if (s.scan <= 0) {
        s.scan = 0.5;
        if (nearBonfire(s.x, s.y, 7)) { s.state = 'sink'; s.t = 0; continue; }       // у большого костра скелеты не держатся
        for (const u of Game.units) {
          if (u.inside || u.dead || !isPerson(u) || u.type === 'carter' || s.seen.has(u.id)) continue;
          if (Math.hypot(u.x - s.x, u.y - s.y) > SKEL_SEE || Math.hypot(u.x - s.hx, u.y - s.hy) > SKEL_LEASH) continue;
          if (!interruptible(u) && !(u.brk && u.brk.kind === 'lost')) continue;
          skelReact(s, u);
          break;
        }
      }
    }
    // присоединяются к уже идущей драке
    if (s.state === 'fight' && !s.resolved && s.fighters.length < 5) {
      for (const u of Game.units) {
        if (u.inside || u.dead || !isPerson(u) || u.type === 'carter' || s.seen.has(u.id) || !interruptible(u)) continue;
        if (Math.hypot(u.x - s.x, u.y - s.y) > 4) continue;
        s.seen.add(u.id);
        if (Math.random() < 0.7) { s.fighters.push(u); startBreak(u, 'fight', null); u.proc = skelFightGen(u, s); }
        else { startBreak(u, 'flee', null); u.proc = fleeGen(u); }
        break;
      }
    }
  }
}

function skelReact(s, u) {
  s.seen.add(u.id);
  if (u.brk && u.brk.kind === 'lost') endBreak(u);
  let friends = 0;
  for (const o of Game.units) if (o !== u && !o.dead && !o.inside && isPerson(o) && Math.hypot(o.x - u.x, o.y - u.y) < 5) friends++;
  const r = Math.random(), pFreeze = friends ? 0.1 : 0.3, pFlee = friends ? 0.3 : 0.65;
  floater(u.x, u.y - 1, 'Скелет!', '#e8e8d0');
  if (r < pFreeze) { startBreak(u, 'freeze', null); u.proc = freezeGen(u); }
  else if (r < pFlee) { startBreak(u, 'flee', null); u.proc = fleeGen(u); }
  else {
    s.state = 'fight'; s.t = 0; s.fighters = [u]; s.resolved = false; s.goal = null;
    startBreak(u, 'fight', null); u.proc = skelFightGen(u, s);
  }
}

function* skelFightGen(u, s) {
  floater(u.x, u.y - 1, ['За бороду!', 'Ржавую железку — в утиль!', 'Ложись обратно!'][Math.floor(Math.random() * 3)], '#ffd0a0');
  sfxUnit(u, 'grr');
  const side = s.fighters.indexOf(u) % 2 ? 1 : -1;
  const tx = Math.floor(s.x + side * 0.9), ty = Math.floor(s.y);
  if (isWalkable(tx, ty) && Math.hypot(s.x - u.x, s.y - u.y) > 1.3) yield { walk: [tx, ty], offroad: true };
  if (s.state !== 'fight') { u.fighting = null; return; }
  const faceOff = () => { u.face = s.x > u.x ? 1 : -1; u.vdir = 'E'; };
  u.fighting = s;
  for (let k = 0; k < 3; k++) {
    faceOff();
    yield { wait: 0.9, anim: 'chop' };
    if (s.state !== 'fight') { u.fighting = null; return; }
    sfxAt('rattle', s.x * TILE, s.y * TILE, 0.9);
    fxBurst(s.x * TILE, s.y * TILE - 14, 6, ['#e6dfc8', '#c8c0a4', '#8a6a3a'], 55, 40, 0.5, 1.4, 240);
    s.atk = Game.time;
    yield { wait: 0.35 };
    yield { wait: 0.45, anim: 'duck' };
  }
  if (s.state === 'fight' && !s.resolved && s.fighters[0] === u) {
    faceOff();
    yield { wait: 0.9, anim: 'chop' };
    skelResolve(s);
  }
  u.fighting = null;
  for (let k = 0; k < 30 && s.state === 'fight'; k++) yield { wait: 0.3 };
  if (u.dead) return;
  if (s.state === 'dead') {
    yield { wait: 1.8 };
    if (u.dead) return;
    u.gest = 'fist'; u.gestUntil = Game.time + 2.5;
    floater(u.x, u.y - 1.2, ['Ура!', 'Лежи смирно!', 'Кости — в землю!'][Math.floor(Math.random() * 3)], '#fff2a0');
    sfxUnit(u, 'hey');
    yield { wait: 2.2 };
  } else if (s.escaped === u) {
    yield { wait: 1.5, anim: 'knocked' };
    floater(u.x, u.y - 1.2, 'Жив…', '#e8e0c0');
    yield { wait: 1 };
  }
}

// Один гном чаще проигрывает; вдвоём-втроём скелета обычно рассыпают в кости.
function skelResolve(s) {
  const fs = s.fighters.filter(u => !u.dead && u.brk && u.brk.kind === 'fight');
  s.resolved = true;
  if (!fs.length) { s.state = 'roam'; s.fighters = []; return; }
  const n = fs.length, r = Math.random();
  let outcome;
  if (n === 1) outcome = r < 0.45 ? 'win' : r < 0.7 ? 'escape' : 'lose';
  else outcome = r < 0.04 ? 'wipe' : r < 0.04 + 0.96 * Math.min(0.92, 0.4 + 0.2 * n) ? 'win' : 'lose';
  if (outcome === 'win') {
    s.state = 'dead'; s.t = 0; s.moving = false;
    sfxAt('rattle', s.x * TILE, s.y * TILE, 1.3);
    fxBurst(s.x * TILE, s.y * TILE - 10, 24, ['#e6dfc8', '#c8c0a4', '#8a6a3a', '#5a6a4a'], 80, 50, 1.2, 2.2, 260);
    floater(s.x, s.y - 1.6, 'Клац…', '#e8e8d0');
    logEvent('tree', `${n > 1 ? 'Гномы вместе' : UNIT_TYPES[fs[0].type].name} рассыпали скелета в кости`, s.x, s.y);
  } else if (outcome === 'escape') {
    s.escaped = fs[0]; knockBack(fs[0], s); injure(fs[0], 'arm');
    s.state = 'roam'; s.fighters = []; s.resolved = false; s.t = 0; s.atk = Game.time;
    logEvent('tree', `${UNIT_TYPES[fs[0].type].name} ушёл от скелета живым`, s.x, s.y);
  } else {
    // скелет рубит одного ржавым мечом; остальных, если выжили, отбрасывает
    const v = fs[0];
    floater(v.x, v.y - 1.2, '!', '#ff6040');
    fxBurst(v.x * TILE, v.y * TILE - 8, 12, ['#ffc0c0', '#a02818'], 50, 40, 0.7, 1.8, 180);
    sfxAt('thud', v.x * TILE, v.y * TILE, 1);
    toast(`Скелет зарубил: ${UNIT_TYPES[v.type].name}`);
    logEvent('tree', `Скелет зарубил: ${UNIT_TYPES[v.type].name}`, v.x, v.y);
    const vx = v.x, vy = v.y;
    removeUnit(v);
    for (const o of fs.slice(1)) {
      if (outcome === 'wipe') { floater(o.x, o.y - 1, '!', '#ff6040'); removeUnit(o); }
      else { s.escaped = o; knockBack(o, s); injure(o, Math.random() < 0.5 ? 'leg' : 'arm'); }
    }
    // павший гном нередко встаёт скелетом
    if (Math.random() < 0.55) fxLater(2.5, () => { skelRise(vx, vy, 0); logEvent('tree', 'Павший гном встал скелетом', vx, vy); });
    s.state = 'roam'; s.fighters = []; s.resolved = false; s.t = 0; s.goal = null;
  }
}

function skeletonLights(L, x0, y0, x1, y1) {
  for (const s of Game.skels || []) if (s.k > 0.2 && s.state !== 'dead' && s.x > x0 - 3 && s.x < x1 + 3 && s.y > y0 - 3 && s.y < y1 + 3)
    L.push([s.x * TILE, s.y * TILE - 10, 34, 0.35 * s.k, 'ent']);
}

// ---------- Рисование ----------

function drawSkeletons(list, c, x0, y0, x1, y1) {
  for (const s of Game.skels || []) {
    if (s.t < 0 && s.state === 'rise') continue;
    if (s.x < x0 - 2 || s.x > x1 + 2 || s.y < y0 - 2 || s.y > y1 + 3) continue;
    list.push([s.y + 0.1, () => drawSkeleton(c, s)]);
  }
}

function drawSkeleton(c, s) {
  const t = Game.time, f = s.face < 0 ? -1 : 1;
  const px = Math.round(s.x * TILE), py = Math.round(s.y * TILE + 6);
  const BONE = '#e4ddc6', BONE2 = '#b8b096', INK = '#17120c';
  const moving = s.moving, sw = moving ? Math.sin(s.phase * 1.4) : 0;
  const dead = s.state === 'dead', fight = s.state === 'fight';
  const k = dead ? 1 : s.k;
  c.save();
  c.fillStyle = 'rgba(10,8,4,0.35)'; c.beginPath(); c.ellipse(px, py, 8 * k + 1, 2.4, 0, 0, 7); c.fill();
  if (dead) {
    // рассыпается: кости по земле, череп катится, колпак набок, меч воткнут
    const q = Math.min(1, s.t / 0.6);
    c.translate(px, py); c.scale(f, 1);
    c.globalAlpha = s.t > 2.4 ? Math.max(0, 1 - (s.t - 2.4) / 0.8) : 1;
    c.strokeStyle = BONE; c.lineWidth = 1.6; c.lineCap = 'round';
    for (const [x1, y1, x2, y2] of [[-9, -1, -3, -2], [3, 0, 10, -1.4], [-6, 1, 4, 1.4], [-2, -3, 6, -3.6], [1, 2, -7, 2.4]]) { c.beginPath(); c.moveTo(x1, y1 * q); c.lineTo(x2, y2 * q); c.stroke(); }
    c.fillStyle = BONE; c.beginPath(); c.arc(8 - q * 3, -2 - (1 - q) * 14, 4.2, 0, 7); c.fill(); c.fillStyle = INK; c.fillRect(6.4 - q * 3, -3.4 - (1 - q) * 14, 1.6, 1.8); c.fillRect(9 - q * 3, -3.4 - (1 - q) * 14, 1.6, 1.8);
    c.fillStyle = '#4e5c40'; c.beginPath(); c.moveTo(-12, -1); c.lineTo(-7, -5); c.lineTo(-5, 0); c.fill();
    c.fillStyle = '#8a5a32'; c.fillRect(-4, -9, 1.6, 9); c.fillRect(-6, -9, 5.6, 1.4);
    c.restore();
    return;
  }
  c.translate(px, py);
  // из земли: клип по высоте
  if (k < 1) { c.beginPath(); c.rect(-16, -42 * k, 32, 44 * k + 2); c.clip(); }
  c.translate(0, (1 - k) * 8);
  c.scale(f, 1);
  c.lineCap = 'round'; c.lineJoin = 'round';
  if (s.scared > 0) c.translate(Math.sin(t * 50) * 0.8, 0);
  const lean = fight ? 1.5 : 0, bob = moving ? Math.abs(Math.sin(s.phase * 1.4)) * 0.8 : Math.sin(t * 2 + s.phase) * 0.4;
  c.translate(0, -bob);
  const bone = (x1, y1, x2, y2, w = 1.8) => { c.strokeStyle = INK; c.lineWidth = w + 1.2; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.strokeStyle = BONE; c.lineWidth = w; c.stroke(); };
  // ноги: бедро + голень, шагают попеременно, коленные суставы-шарики
  for (const side of [-1, 1]) {
    const ph = moving ? sw * side : 0;
    const kx = side * 1.8 + ph * 2.4, ky = -7.4 + Math.abs(ph) * -0.8, fx = side * 2.4 + ph * 3.6, fy = Math.max(-0.5, 0 - Math.max(0, -ph) * 2.4);
    bone(side * 1.4, -12.5, kx, ky, 1.9); bone(kx, ky, fx, fy, 1.7);
    c.fillStyle = BONE; c.beginPath(); c.arc(kx, ky, 1.5, 0, 7); c.fill();
    bone(fx, fy, fx + 2.8, fy, 1.5);                                                // ступня
  }
  // таз и позвоночник
  c.fillStyle = BONE; c.strokeStyle = INK; c.lineWidth = 0.9;
  c.beginPath(); c.ellipse(0, -12.6, 3.8, 2, 0, 0, 7); c.fill(); c.stroke();
  bone(0, -13, lean * 0.5, -22, 1.6);
  // рёбра
  for (let i = 0; i < 3; i++) { const y = -15.2 - i * 2.4, w = 4.4 - i * 0.3; c.strokeStyle = INK; c.lineWidth = 2.4; c.beginPath(); c.ellipse(lean * 0.4, y, w, 1.5, 0, 0, Math.PI); c.stroke(); c.strokeStyle = BONE; c.lineWidth = 1.2; c.beginPath(); c.ellipse(lean * 0.4, y, w, 1.5, 0, 0, Math.PI); c.stroke(); }
  bone(-5, -22, 5, -22, 1.8);                                                       // ключицы
  // задняя рука: костлявая, болтается
  const bsw = moving ? -sw * 3 : Math.sin(t * 1.5 + s.phase) * 0.8;
  bone(-5, -22, -6.5 + bsw * 0.4, -16, 1.5); bone(-6.5 + bsw * 0.4, -16, -6 + bsw, -10.5, 1.4);
  // передняя рука с ржавым мечом
  const atk = t - s.atk;
  let ang = -1.1 + Math.sin(t * 2 + s.phase) * 0.06;                                // меч наготове
  if (moving) ang = -0.9 + sw * 0.2;
  if (fight) ang = atk < 0.35 ? -2.3 : atk < 0.8 ? 0.7 : -0.9;                     // замах — удар — стойка
  if (s.scared > 0) ang = -2.6;
  const ax = 5, ay = -22, hx = ax + 4 + Math.cos(ang - 0.7) * 2, hy = ay + 6 + Math.sin(ang - 0.7) * 3;
  bone(ax, ay, ax + 3.4, ay + 4.4, 1.5); bone(ax + 3.4, ay + 4.4, hx + 1, hy, 1.4);
  c.save(); c.translate(hx + 1, hy); c.rotate(ang);
  // клинок: ржавый, щербатый, в тёмной обводке
  c.fillStyle = INK; c.beginPath(); c.moveTo(-1.4, -1.7); c.lineTo(15.5, -1.9); c.lineTo(17.4, 0); c.lineTo(15.5, 1.9); c.lineTo(-1.4, 1.7); c.closePath(); c.fill();
  const rg = c.createLinearGradient(0, -1.4, 0, 1.4); rg.addColorStop(0, '#c8946a'); rg.addColorStop(0.5, '#8a5a34'); rg.addColorStop(1, '#5a3a20');
  c.fillStyle = rg; c.beginPath(); c.moveTo(0, -1.1); c.lineTo(15, -1.2); c.lineTo(16.4, 0); c.lineTo(15, 1.2); c.lineTo(0, 1.1); c.closePath(); c.fill();
  c.fillStyle = INK; for (const x of [4, 8.4, 12]) { c.beginPath(); c.moveTo(x, -1.2); c.lineTo(x + 0.9, -0.2); c.lineTo(x + 1.8, -1.2); c.fill(); }   // щербины
  c.fillStyle = '#c0501a'; for (const x of [3, 7, 11.5]) c.fillRect(x, 0.2, 1.3, 0.7);                                                                  // ржавые пятна
  c.fillStyle = INK; c.fillRect(-2.6, -3, 2.4, 6); c.fillStyle = '#6a4a2a'; c.fillRect(-2.2, -2.6, 1.6, 5.2);                                            // гарда
  c.restore();
  // череп: впалые глазницы с тусклым зелёным огоньком, зубы
  const hy2 = -27.5 + lean * 0.2, hx2 = lean * 0.8 + (s.scared > 0 ? 0 : Math.sin(t * 1.3 + s.phase) * 0.4);
  c.fillStyle = INK; c.beginPath(); c.arc(hx2, hy2, 5.4, 0, 7); c.fill();
  c.fillStyle = BONE; c.beginPath(); c.arc(hx2, hy2, 4.5, 0, 7); c.fill();
  c.fillStyle = BONE2; c.beginPath(); c.arc(hx2 - 1.6, hy2 + 1.2, 3.2, 0, 7); c.fill();
  c.fillStyle = BONE; c.beginPath(); c.arc(hx2 - 0.6, hy2 - 0.4, 3.6, 0, 7); c.fill();
  c.fillStyle = INK; c.beginPath(); c.ellipse(hx2 - 1.7, hy2 - 0.4, 1.4, 1.8, 0.2, 0, 7); c.ellipse(hx2 + 1.9, hy2 - 0.4, 1.4, 1.8, -0.2, 0, 7); c.fill();
  c.fillStyle = '#8dff9c'; c.fillRect(hx2 - 2, hy2 - 0.8, 0.9, 0.9); c.fillRect(hx2 + 1.6, hy2 - 0.8, 0.9, 0.9);
  c.fillStyle = INK; c.beginPath(); c.moveTo(hx2 + 0.1, hy2 + 0.8); c.lineTo(hx2 + 0.9, hy2 + 2); c.lineTo(hx2 - 0.7, hy2 + 2); c.fill();
  const jaw = fight && atk < 0.5 ? 2.2 : 0.6;                                        // челюсть щёлкает при ударе
  c.fillStyle = INK; c.fillRect(hx2 - 3, hy2 + 2.6, 6.2, 1.2 + jaw);
  c.fillStyle = BONE; for (let i = 0; i < 4; i++) c.fillRect(hx2 - 2.6 + i * 1.5, hy2 + 2.6, 1, 1.4);
  // рваный гномий колпак, свисающий кончик с дырой
  c.fillStyle = INK; c.beginPath(); c.moveTo(hx2 - 6.4, hy2 - 2.4); c.quadraticCurveTo(hx2 - 3, hy2 - 11, hx2 + 2, hy2 - 17); c.quadraticCurveTo(hx2 + 6.2, hy2 - 15, hx2 + 8, hy2 - 11); c.lineTo(hx2 + 6.2, hy2 - 3); c.lineTo(hx2 + 3, hy2 - 4.4); c.lineTo(hx2, hy2 - 2.8); c.lineTo(hx2 - 3, hy2 - 4.2); c.closePath(); c.fill();
  const hg = c.createLinearGradient(hx2 - 6, 0, hx2 + 6, 0); hg.addColorStop(0, '#6c7a54'); hg.addColorStop(1, '#3e4a32');
  c.fillStyle = hg; c.beginPath(); c.moveTo(hx2 - 5.4, hy2 - 3); c.quadraticCurveTo(hx2 - 2.4, hy2 - 10.4, hx2 + 2.2, hy2 - 15.6); c.quadraticCurveTo(hx2 + 5.2, hy2 - 14, hx2 + 6.8, hy2 - 10.6); c.lineTo(hx2 + 5.4, hy2 - 3.8); c.lineTo(hx2 + 3, hy2 - 5); c.lineTo(hx2, hy2 - 3.6); c.lineTo(hx2 - 3, hy2 - 4.8); c.closePath(); c.fill();
  c.fillStyle = INK; c.beginPath(); c.ellipse(hx2 + 0.6, hy2 - 9, 1.1, 1.6, 0.4, 0, 7); c.fill();                       // дыра в колпаке
  c.fillStyle = '#2e3624'; c.fillRect(hx2 - 6, hy2 - 3.6, 12.2, 1.6);                                                    // обтрёпанный край
  // клочья бороды-паутины
  c.strokeStyle = 'rgba(210,204,180,0.7)'; c.lineWidth = 0.7;
  for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(hx2 + i * 1.2, hy2 + 4); c.quadraticCurveTo(hx2 + i * 1.6 + Math.sin(t * 2 + i) * 0.8, hy2 + 7, hx2 + i * 1.3, hy2 + 9.4); c.stroke(); }
  c.restore();
}
