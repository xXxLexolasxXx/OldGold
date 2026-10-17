'use strict';
// Нечисть ночи, часть вторая: водяные элементали, удары по зданиям и их ремонт,
// отпугивание нечисти большим костром. Деревья и камни — в night.js и rocks.js,
// у всех общая механика (Game.ents, состояния sleep → emerge → walk → fight/smash → …).

ENT_LOOK.water = { bark: '#4aa0d0', light: '#bfefff', dark: '#1a4a78', crown: ['#4aa8d8', '#d8f8ff'] };

// ---------- Водяные ----------

function spawnWaterEnts(people, want) {
  let made = 0;
  const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let tries = 0; tries < 1500 && made < want; tries++) {
    const u = people[(Math.random() * people.length) | 0];
    const a = Math.random() * Math.PI * 2, d = 5 + Math.random() * 14;
    const x = Math.round(u.x + Math.cos(a) * d), y = Math.round(u.y + Math.sin(a) * d);
    if (!inb(x, y) || World.terrain[idx(x, y)] !== T_WATER) continue;
    // берег рядом: вылезает из воды на сушу
    const land = nb.map(([dx, dy]) => [x + dx, y + dy]).find(([lx, ly]) => inb(lx, ly) && World.terrain[idx(lx, ly)] !== T_WATER && isWalkable(lx, ly) && !World.bmap[idx(lx, ly)] && !World.road[idx(lx, ly)]);
    if (!land) continue;
    if (nearBonfire(land[0], land[1], 12)) continue;
    if (Game.ents.some(e => Math.abs(e.hx - land[0]) + Math.abs(e.hy - land[1]) < 3)) continue;
    Game.ents.push(newEnt({ water: true, o: {}, i: idx(x, y), wx: x, wy: y, hx: land[0], hy: land[1], x: x + 0.5, y: y + 0.5 }));
    made++;
  }
}

// куда возвращается нечисть на рассвете: дерево и камень — на своё место, водяной — в воду
function entHomeXY(e) { return e.water ? [e.wx + 0.5, e.wy + 0.5] : [e.hx + 0.5, e.hy + 0.5]; }

function waterGeom(e) {
  const { bx, by } = entBase(e);
  let H = 40 * e.k;
  if (e.state === 'dying') H *= Math.max(0.06, 1 - e.t / 2.2);        // рассыпается в лужу
  return { bx, by, H };
}

function waterEntHand(e) {
  const g = waterGeom(e), reach = e.state === 'drag' && e.t < GRAB_REACH;
  return { x: g.bx + e.face * (reach ? 18 : 13), y: g.by - g.H * (reach ? 0.28 : 0.74) };
}

function waterEyeCenter(e) {
  const g = waterGeom(e);
  return { x: g.bx, y: g.by - g.H * 0.86 };
}

// Глаза спящего в озере: два голубых огонька над водой, круги и пузырьки; иногда моргают
function drawWaterEyes(c, e, a) {
  if (a <= 0.01) return;
  const px = e.wx * TILE + 16, py = e.wy * TILE + 18 + Math.sin(Game.time * 1.4 + e.i) * 1.2;
  const t = Game.time, blink = (t * 0.31 + e.i * 0.17) % 1 < 0.05;
  c.save(); c.globalAlpha = a;
  nightSprites();
  c.globalCompositeOperation = 'lighter';
  c.drawImage(NIGHT.eerie, px - 9, py - 6, 18, 12);
  c.globalCompositeOperation = 'source-over';
  c.strokeStyle = 'rgba(200,240,255,0.5)'; c.lineWidth = 0.7;
  const rr = 4 + (t * 3 + e.i) % 5;
  c.beginPath(); c.ellipse(px, py + 2, rr * 1.4, rr * 0.5, 0, 0, 7); c.stroke();
  c.fillStyle = '#0a2a40'; c.beginPath(); c.arc(px - 3, py, 2.2, 0, 7); c.arc(px + 3, py, 2.2, 0, 7); c.fill();
  if (!blink) { c.fillStyle = '#b8f4ff'; c.fillRect(px - 4, py - 0.8, 2, 1.8); c.fillRect(px + 2, py - 0.8, 2, 1.8); c.fillStyle = '#ffffff'; c.fillRect(px - 3.6, py - 0.6, 0.8, 0.8); c.fillRect(px + 2.4, py - 0.6, 0.8, 0.8); }
  c.restore();
}

// Тело водяного: прозрачная колышущаяся фигура, руки-струи, свечащиеся глаза
function drawWaterEnt(c, e) {
  const { bx, by, H } = waterGeom(e), k = e.k, t = Game.time;
  c.save();
  c.globalAlpha = e.alpha;
  // лужа и круги у ног
  c.fillStyle = 'rgba(40,110,160,0.4)'; c.beginPath(); c.ellipse(bx, by, 16 * k + 3, 5, 0, 0, 7); c.fill();
  c.strokeStyle = 'rgba(210,245,255,0.55)'; c.lineWidth = 0.7;
  for (let r = 0; r < 2; r++) { const q = (t * 0.9 + r * 0.5 + e.i * 0.1) % 1; c.globalAlpha = e.alpha * (1 - q) * 0.8; c.beginPath(); c.ellipse(bx, by, 8 + q * 14, 2.4 + q * 4, 0, 0, 7); c.stroke(); }
  c.globalAlpha = e.alpha * 0.9;
  if (k > 0.02 && H > 1) {
    const sway = e.moving ? Math.sin(e.phase * 0.9) * 2 : Math.sin(t * 2 + e.i) * 0.8;
    // корпус: волнистая юбка-хвост снизу, узкая талия, широкие плечи
    const half = y => { const u = y / H; return (u < 0.15 ? 12 - u * 20 : u < 0.55 ? 9 - (u - 0.15) * 6 : 6.6 + (u - 0.55) * 7) + Math.sin(t * 3.2 + y * 0.4 + e.phase) * 1.3 * (1 - u); };
    const pts = [];
    for (let y = 0; y <= H; y += 3) pts.push([bx + sway * (y / H) - half(y), by - y]);
    for (let y = H; y >= 0; y -= 3) pts.push([bx + sway * (y / H) + half(y), by - y]);
    const g = c.createLinearGradient(0, by - H, 0, by);
    g.addColorStop(0, 'rgba(190,240,255,0.92)'); g.addColorStop(0.5, 'rgba(90,180,225,0.82)'); g.addColorStop(1, 'rgba(36,110,170,0.78)');
    c.fillStyle = g; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(220,250,255,0.7)'; c.lineWidth = 0.8; c.stroke();
    // внутри — завитки течения и пузыри
    c.strokeStyle = 'rgba(230,252,255,0.45)'; c.lineWidth = 0.7;
    for (let j = 0; j < 4; j++) { const yy = by - H * (0.15 + j * 0.2), ph = t * 2 + j * 1.7 + e.i; c.beginPath(); c.moveTo(bx - 6 + sway, yy); c.quadraticCurveTo(bx + Math.sin(ph) * 4 + sway, yy - 3, bx + 6 + sway, yy + Math.cos(ph) * 1.5); c.stroke(); }
    for (let j = 0; j < 5; j++) { const q = (t * 0.7 + j * 0.37 + e.i * 0.1) % 1; c.fillStyle = `rgba(240,252,255,${0.7 * (1 - q)})`; c.beginPath(); c.arc(bx + Math.sin(j * 2.1 + e.i) * 5 + sway * 0.5, by - H * (0.1 + q * 0.7), 0.9 + (j % 2) * 0.5, 0, 7); c.fill(); }
    // голова
    const hx = bx + sway, hy = by - H * 0.86;
    c.fillStyle = 'rgba(200,244,255,0.95)'; c.beginPath(); c.arc(hx, hy, 6, 0, 7); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 0.8; c.stroke();
    // острый гребень-капля на макушке
    c.fillStyle = 'rgba(190,240,255,0.9)'; c.beginPath(); c.moveTo(hx - 2.6, hy - 5); c.quadraticCurveTo(hx, hy - 13, hx + 2.6, hy - 5); c.fill();
    // глаза светятся, во время боя и захвата — яростнее
    const rage = e.state === 'fight' || e.state === 'smash' || e.state === 'drag';
    c.fillStyle = '#0a2a40'; c.beginPath(); c.ellipse(hx - 2.6, hy - 0.6, 2.2, 1.7, 0, 0, 7); c.ellipse(hx + 2.6, hy - 0.6, 2.2, 1.7, 0, 0, 7); c.fill();
    c.fillStyle = rage ? '#ffffff' : '#b8f4ff'; c.fillRect(hx - 3.6, hy - 1.2, 2, 1.4); c.fillRect(hx + 1.6, hy - 1.2, 2, 1.4);
    c.fillStyle = '#0a2a40'; c.beginPath(); c.ellipse(hx, hy + 3.4, 2.2, rage ? 1.8 : 1, 0, 0, 7); c.fill();
    // руки-струи: плечо → локоть → кисть, на конце три «пальца»-капли
    const shY = by - H * 0.62, atk = e.atk ? t - e.atk : 9;
    for (const side of [-1, 1]) {
      let ex = side * 9, ey = 5, hx2 = side * 10, hy2 = 15;                                   // руки опущены
      if (e.moving) { const s = Math.sin(e.phase * 0.9 + (side > 0 ? Math.PI : 0)); hx2 += s * 3; hy2 += s * 2; }
      if (e.state === 'fight' || e.state === 'smash') {
        if (atk < 0.35) { ex = side * 8; ey = -7; hx2 = side * 6; hy2 = -17; } else if (atk < 0.8) { ex = side * 12; ey = 2; hx2 = side * 16; hy2 = 12; }
      }
      if (e.state === 'drag' && side === e.face) { if (e.t < GRAB_REACH) { ex = side * 12; ey = 7; hx2 = side * 19; hy2 = 16; } else { ex = side * 11; ey = -2; hx2 = side * 15; hy2 = -8; } }
      c.lineCap = 'round';
      for (const [col, w] of [['rgba(40,120,180,0.85)', 5], ['rgba(120,205,240,0.85)', 3.4], ['rgba(225,250,255,0.7)', 1.2]]) {
        c.strokeStyle = col; c.lineWidth = w;
        c.beginPath(); c.moveTo(bx + sway + side * 6, shY); c.quadraticCurveTo(bx + sway + ex, shY + ey, bx + sway + hx2, shY + hy2); c.stroke();
      }
      for (const f of [-0.7, 0, 0.7]) { c.fillStyle = 'rgba(190,240,255,0.9)'; c.beginPath(); c.ellipse(bx + sway + hx2 + Math.sin(f) * 3, shY + hy2 + Math.cos(f) * 2.4, 1.2, 1.9, f, 0, 7); c.fill(); }
      // с рук капает
      const q = (t * 1.6 + side) % 1; c.fillStyle = `rgba(200,240,255,${0.8 * (1 - q)})`; c.fillRect(bx + sway + hx2, shY + hy2 + 3 + q * 8, 1.2, 1.8);
    }
  }
  c.restore();
  if (e.state === 'drag' && e.victim) drawVictim(c, e);
}

// сдулся: на земле остаётся мокрое пятно, пока не высохнет
function entWaterRest(e) {
  (Game.puddles = Game.puddles || []).push({ x: e.x, y: e.y, t: Game.time });
}

function drawPuddles(c) {
  const list = Game.puddles;
  if (!list || !list.length) return;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i], age = Game.time - p.t;
    if (age > 40) { list.splice(i, 1); continue; }
    c.fillStyle = `rgba(50,120,170,${0.45 * (1 - age / 40)})`;
    c.beginPath(); c.ellipse(p.x * TILE, p.y * TILE + 12, 13, 4.5, 0, 0, 7); c.fill();
  }
}

// ---------- Костёр отпугивает ----------

function entBonfireRepel(e) {
  if (e.state === 'done' || e.state === 'gone' || e.state === 'dying' || e.state === 'return' || e.state === 'root' || e.state === 'drag') return false;
  if (!nearBonfire(e.x, e.y, 9)) return false;
  if (e.state === 'sleep') { e.state = 'done'; if (e.o) { e.o.awake = false; e.o.res = false; } return true; }
  if (e.state === 'fight') return false;                    // уж ввязалась — не отступает
  if (!e.scared) { e.scared = true; floater(e.x, e.y - 2, 'Огонь!', '#ffb060'); sfxAt('hic', e.x * TILE, e.y * TILE, 0.6); }
  e.target = null; e.goal = null; e.state = 'return'; e.t = 0;
  return false;
}

// ---------- Удары по зданиям ----------

function pickSmashTarget(e) {
  let best = null, bd = 8;
  for (const b of Game.buildings) {
    if (b.state !== 'done' || b.type === 'bonfire' || b.removed) continue;
    if (nearBonfire(b.x + b.w / 2, b.y + b.h / 2, 9)) continue;
    const d = Math.hypot(b.x + b.w / 2 - e.x, b.y + b.h / 2 - e.y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

// клетка у стены здания со стороны нечисти
function smashSpot(e, b) {
  const gx = Math.max(b.x - 0.9, Math.min(b.x + b.w + 0.9, e.x));
  const gy = Math.max(b.y - 0.4, Math.min(b.y + b.h + 0.9, e.y));
  return [gx, gy];
}

function buildingHit(e, b) {
  const rate = e.rock ? 0.1 : e.water ? 0.06 : 0.08;
  const before = b.dmg || 0;
  b.dmg = Math.min(0.95, before + rate);
  const px = (b.x + b.w / 2 + (Math.random() - 0.5) * b.w * 0.6) * TILE, py = (b.y + b.h - 0.2) * TILE - 6;
  fxBurst(px, py, 9, ['#8a7a60', '#6a5a44', '#c8a070', '#4a3a28'], 70, 50, 0.7, 2.2, 240);
  sfxAt('thud', px, py, 0.9);
  if (before < 0.5 && b.dmg >= 0.5) {
    floater(b.x + b.w / 2, b.y, 'Трещит!', '#ffb060');
    toast(`${b.def.name} повреждён нечистью — нужен ремонт`, b);
    logEvent('night', `${b.def.name} повреждён нечистью`, b.doorX + 0.5, b.doorY);
  }
}

// Работяга чинит повреждённое здание
function* repairGen(u, b) {
  u.repairJob = null;
  if (!b || b.removed || !(b.dmg > 0)) { if (b) b.repairer = null; return; }
  const ok = yield { walk: [b.doorX, b.doorY], offroad: true };
  if (!ok || b.removed) { b.repairer = null; yield { wait: 2 }; return; }
  while (!b.removed && b.dmg > 0) {
    u.face = b.x + b.w / 2 > u.x ? 1 : -1; u.vdir = 'E';
    fxLater(0.5, () => {
      const px = (b.doorX + 0.5) * TILE, py = (b.doorY - 0.2) * TILE - 8;
      fxBurst(px + (Math.random() - 0.5) * 30, py, 5, ['#d8b070', '#a0703a', '#e8cc90'], 50, 40, 0.5, 1.6, 260);
      sfxAt('build', px, py, 0.8);
    });
    yield { wait: 1, anim: 'build' };
    b.dmg = Math.max(0, (b.dmg || 0) - 0.12);
  }
  b.dmg = 0; b.repairer = null;
  if (!b.removed) { floater(b.x + b.w / 2, b.y, 'Починено', '#c8e080'); logEvent('build', `${b.def.name} починен`, b.doorX + 0.5, b.doorY); }
}

// следы повреждений на здании: сажа, трещины и дымок
function drawDamage(c, b, ox, oy, spr) {
  const d = b.dmg || 0;
  if (d <= 0.02) return;
  const r = mulberry32(b.id * 977 + 3);
  const W = b.w * TILE, H = spr.h - 10;
  c.save();
  c.globalAlpha = Math.min(0.9, 0.25 + d);
  const n = Math.round(4 + d * 14);
  for (let k = 0; k < n; k++) {
    let x = ox + 12 + r() * (spr.w - 24), y = oy + spr.h * (0.35 + r() * 0.5);
    c.strokeStyle = 'rgba(20,14,8,0.85)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x, y);
    for (let s = 0; s < 3; s++) { x += (r() - 0.5) * 7; y += 3 + r() * 5; c.lineTo(x, y); }
    c.stroke();
  }
  for (let k = 0; k < 3 + d * 6; k++) { c.fillStyle = 'rgba(30,24,20,0.28)'; c.beginPath(); c.ellipse(ox + 14 + r() * (spr.w - 28), oy + spr.h * (0.4 + r() * 0.5), 4 + r() * 6, 2 + r() * 3, 0, 0, 7); c.fill(); }
  c.restore();
  void W; void H;
  if (d >= 0.5) {
    // из повреждённого здания идёт дымок
    for (let k = 0; k < 3; k++) {
      const p = (Game.time * 0.35 + k / 3 + b.id * 0.13) % 1;
      c.fillStyle = `rgba(90,86,80,${0.5 * (1 - p)})`;
      c.beginPath(); c.arc(ox + spr.w * 0.5 + Math.sin(p * 5 + k) * 6, oy + spr.h * 0.3 - p * 26, 2 + p * 4, 0, 7); c.fill();
    }
  }
}

// ---------- Летучие мыши ----------
// С вечера стайка мышей кружит над деревней; пролетевшая у самой головы гнома пугает его
// ненадолго (взмах руками, возглас). На рассвете улетают.

function batsTick(dt) {
  const bats = Game.bats || (Game.bats = []);
  const dark = nightAmt();
  const cx = Game.units.length ? Game.units.reduce((s, u) => s + u.x, 0) / Game.units.length : MAP_W / 2;
  const cy = Game.units.length ? Game.units.reduce((s, u) => s + u.y, 0) / Game.units.length : MAP_H / 2;
  // прилетают с вечера
  if (dark > 0.3 && bats.length < 8 && Math.random() < dt * 0.8) {
    const a = Math.random() * Math.PI * 2;
    bats.push({ x: cx + Math.cos(a) * 24, y: cy + Math.sin(a) * 18, z: 28 + Math.random() * 20, tx: cx, ty: cy, ph: Math.random() * 9, spd: 2.4 + Math.random() * 1.2, retarget: 0, leave: false, cd: 0 });
  }
  for (let i = bats.length - 1; i >= 0; i--) {
    const b = bats[i];
    b.ph += dt * 16; b.retarget -= dt;
    if (dark < 0.12) b.leave = true;
    if (b.leave) { b.tx = b.x + (b.x > cx ? 30 : -30); b.ty = b.y + (b.y > cy ? 20 : -20); if (b.x < -3 || b.y < -3 || b.x > MAP_W + 3 || b.y > MAP_H + 3) { bats.splice(i, 1); continue; } }
    else if (b.retarget <= 0 || Math.hypot(b.tx - b.x, b.ty - b.y) < 1) {
      // новая точка кружения: у жилья или у людей
      const u = Game.units.length ? Game.units[(Math.random() * Game.units.length) | 0] : null;
      b.tx = (u ? u.x : cx) + (Math.random() - 0.5) * 8; b.ty = (u ? u.y : cy) + (Math.random() - 0.5) * 6; b.retarget = 2 + Math.random() * 3;
    }
    const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy) || 1;
    // порывистый зигзаг, как у настоящих мышей
    const wob = Math.sin(b.ph * 0.31) * 1.6;
    b.x += (dx / d * b.spd + -dy / d * wob) * dt; b.y += (dy / d * b.spd + dx / d * wob) * dt;
    b.z = Math.max(20, Math.min(52, b.z + Math.sin(b.ph * 0.21) * 8 * dt));
    b.face = dx >= 0 ? 1 : -1;
    // пугает гномов внизу
    b.cd -= dt;
    if (b.cd <= 0 && !b.leave) {
      b.cd = 0.4;
      for (const u of Game.units) {
        if (u.inside || u.dead || !isPerson(u) || (u.batCD || 0) > Game.time) continue;
        if (Math.hypot(u.x - b.x, u.y - b.y) < 1.7) {
          u.batCD = Game.time + 25;
          gesture(u, 'panic', 1.3, b.x);
          floater(u.x, u.y - 1.2, ['Летучая мышь!', 'Брысь!', 'Ай, над головой!'][Math.floor(Math.random() * 3)], '#e8e0f0');
          sfxAt('squeak', b.x * TILE, b.y * TILE, 0.9);
          break;
        }
      }
    }
  }
}

function drawBats(c) {
  const bats = Game.bats;
  if (!bats || !bats.length) return;
  for (const b of bats) {
    const px = Math.round(b.x * TILE), py = Math.round(b.y * TILE - b.z);
    const flap = Math.sin(b.ph), w = 5 + Math.abs(flap) * 2.5, up = flap * 3.2;
    c.fillStyle = 'rgba(10,8,4,0.2)'; c.beginPath(); c.ellipse(px, b.y * TILE + 2, 4, 1.2, 0, 0, 7); c.fill();
    c.fillStyle = '#16121c';
    // крылья: перепончатые «зонтики» с зубчатым краем
    for (const s of [-1, 1]) {
      c.beginPath(); c.moveTo(px + s * 1, py);
      c.lineTo(px + s * w, py - 2 - up);
      c.lineTo(px + s * (w - 1.8), py + 1 - up * 0.4);
      c.lineTo(px + s * (w - 3.4), py + 0.4);
      c.lineTo(px + s * (w - 5), py + 2.2);
      c.closePath(); c.fill();
    }
    c.fillRect(px - 1, py - 1, 2, 3);                                 // тело
    c.fillRect(px - 1, py - 2.6, 2, 1.8);                             // голова
    c.fillRect(px - 1.4, py - 3.6, 0.8, 1.2); c.fillRect(px + 0.6, py - 3.6, 0.8, 1.2);   // ушки
    c.fillStyle = '#ff8060'; c.fillRect(px - 0.8, py - 2.2, 0.5, 0.5); c.fillRect(px + 0.3, py - 2.2, 0.5, 0.5);   // красные глазки
  }
}
