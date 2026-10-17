'use strict';
// Убранство улиц. Когда дорога разрастается, вдоль неё сами появляются фонари,
// скамейки (на них отдыхают жители) и урны. Урны наполняются мусором; свободный
// работяга вытряхивает полную урну в мешок, а трудяги уносят мусор в большой костёр.

const STREET = { lamp: { gap: 3 }, bench: { gap: 7 }, bin: { gap: 8 }, bed: { gap: 2 }, crate: { gap: 4 }, magic: { gap: 12 }, fence: { gap: 1 } };   // фонари — часто, через три клетки
const BIN_FILL_TIME = 160;      // за сколько секунд урна наполняется
let streetT = 0, lastBinToast = -999;

function isStreetObj(o) { return !!(o && STREET[o.t]); }

function streetNear(x, y, r, t) {
  for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) {
    if (!inb(xx, yy)) continue;
    const o = World.obj[idx(xx, yy)];
    if (o && o.t === t && Math.hypot(xx - x, yy - y) <= r) return true;
  }
  return false;
}

// Свободная травка рядом с дорогой, не у входа в здание
function streetSpot(x, y) {
  if (!inb(x, y) || !isFreeGrass(x, y)) return false;
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const xx = x + dx, yy = y + dy;
    if (inb(xx, yy) && World.door[idx(xx, yy)]) return false;
  }
  return true;
}

// Новая клетка дороги — может, поставить рядом фонарь, скамейку или урну
function decorateRoad(x, y) {
  const spots = [[x, y + 1], [x, y - 1], [x + 1, y], [x - 1, y]].filter(([a, b]) => streetSpot(a, b));
  if (!spots.length) return;
  const [sx, sy] = spots[(Math.random() * spots.length) | 0];
  for (const t of ['lamp', 'bench', 'bin']) {
    if (streetNear(sx, sy, STREET[t].gap, t)) continue;
    if (t !== 'lamp' && Math.random() < 0.4) continue;
    const o = t === 'lamp' ? { t } : makeDecor(t);
    if (Game.time > 5) o.born = Game.time;                 // новые вырастают на глазах
    World.obj[idx(sx, sy)] = o;
    return;
  }
}

function decorateAllRoads() {
  for (let i = 0; i < N_TILES; i++) if (World.road[i] && !World.door[i]) decorateRoad(i % MAP_W, (i / MAP_W) | 0);
}

// ---------- Урны и уборка ----------

function streetTick(dt) {
  streetT += dt;
  if (streetT < 1) return;
  const step = streetT; streetT = 0;
  for (let i = 0; i < N_TILES; i++) {
    const o = World.obj[i];
    if (!o || o.t !== 'bin') continue;
    if (o.g < 1) o.g = Math.min(1, o.g + step / BIN_FILL_TIME * (0.6 + Math.random() * 0.8));
    else if (!o.res) callCleaner(i, o);
  }
  dispatchTrash();
  decorPlanTick(step);
  if (typeof subTick === 'function') subTick(step);
}

// Свободные работяги (и безработные жители) сами несут кучки мусора в костёр — курьеры заняты доставкой.
function dispatchTrash() {
  const fires = Game.buildings.filter(b => b.type === 'bonfire' && b.state === 'done' && !b.noDeliver && !b.removed);
  if (!fires.length) return;
  for (const p of Game.piles.values()) {
    if (p.removed) continue;
    const have = p.stock.trash - p.reserved.trash;
    if (have <= 0) continue;
    let fire = null, fd = 1e9;
    for (const f of fires) { const d = Math.abs(f.doorX - p.x) + Math.abs(f.doorY - p.y); if (f.demand('trash') > 0 && d < fd) { fd = d; fire = f; } }
    if (!fire) continue;
    const idle = Game.units.filter(u => !u.isCourier && u.idleFlag && !u.inside && !u.brk && !u.dead && isPerson(u) && canCarry(u, 'trash'));
    const u = takeNearest(idle, p.x, p.y);
    if (!u) continue;
    assignDelivery(u, p, fire, 'trash', Math.min(have, fire.demand('trash'), 2));
  }
}

// Мусорит каждый: огрызки и окурки остаются там, где стоит гном
function litter(u, n = 1) {
  if (u.inside || u.dead) return;
  dropPile(Math.floor(u.x), Math.floor(u.y), 'trash', n);
}

// Ближайший свободный работяга идёт вытряхивать урну
function callCleaner(i, o) {
  const x = i % MAP_W, y = (i / MAP_W) | 0;
  const idle = Game.units.filter(u => u.type === 'builder' && u.idleFlag && !u.inside && !u.brk);
  const u = takeNearest(idle, x, y);
  if (!u) return;
  o.res = u.id;
  u.idleFlag = false; u.idleStreak = 0;
  u.action = null; u.anim = null;
  u.proc = emptyBinGen(u, x, y, o);
}

function* emptyBinGen(u, x, y, o) {
  const ok = yield { walk: [x, y], offroad: true };
  if (!ok || World.obj[idx(x, y)] !== o) { o.res = 0; return; }
  u.face = 1; u.vdir = 'E';
  yield { wait: 1.2, anim: 'forage' };
  yield { wait: 1.2, anim: 'forage' };
  if (World.obj[idx(x, y)] === o) {
    o.g = 0;
    // мешок с мусором ставим у дороги — трудяги унесут в костёр
    const r = nearestRoad(x, y, 2);
    const p = r && !World.door[idx(r[0], r[1])] ? r : [x, y];
    dropPile(p[0], p[1], 'trash', 2);
    if (!Game.buildings.some(b => b.type === 'bonfire') && Game.time - lastBinToast > 120) {
      lastBinToast = Game.time;
      toast('Мусор копится у дорог — постройте большой костёр, трудяги снесут его туда');
    }
  }
  o.res = 0;
}

// ---------- Скамейки ----------

function freeBench(u, r) {
  const x = Math.floor(u.x), y = Math.floor(u.y);
  let best = null, bd = r;
  for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) {
    if (!inb(xx, yy)) continue;
    const o = World.obj[idx(xx, yy)];
    if (!o || o.t !== 'bench' || (o.sitN || 0) >= benchSeats(o)) continue;
    const d = Math.hypot(xx - x, yy - y);
    if (d < bd) { bd = d; best = [xx, yy, o]; }
  }
  return best;
}

function* benchGen(u, bench) {
  const [x, y, o] = bench;
  o.sitN = (o.sitN || 0) + 1;
  const ok = yield { walk: [x, y], offroad: true };
  if (!ok || World.obj[idx(x, y)] !== o) { o.sitN = Math.max(0, (o.sitN || 1) - 1); return; }
  u.benchAt = idx(x, y);
  // посидеть, иногда закурить или помахать прохожим
  yield { wait: 6 + Math.random() * 8, anim: 'sit' };
  if (u.smoker && Math.random() < 0.5) yield { wait: 6, anim: 'smoke' };
  u.benchAt = -1;
  o.sitN = Math.max(0, (o.sitN || 1) - 1);
}

// ---------- Рисование ----------

function drawStreetObj(c, x, y, o) {
  const px = x * TILE, py = y * TILE;
  if (o.t === 'lamp') {
    const age = o.born !== undefined ? Game.time - o.born : 99;
    if (age < 0) return;
    if (age < GROW_T) { const k = age / GROW_T; c.save(); c.beginPath(); c.rect(px - 10, py + 30 - 50 * k, TILE + 20, 50 * k + 4); c.clip(); c.translate(0, (1 - k) * 6); drawGothicLamp(c, px + 22, py + 24, hash(idx(x, y)) % 7, false, 0); c.restore(); return; }
    drawGothicLamp(c, px + 22, py + 24, hash(idx(x, y)) % 7, isEveningNow(), x * 3.1 + y);
    const m = decorMorph(o, x, y);
    if (m) drawMorph(c, m, px, py, o, Math.min(1, (nightAmt() - 0.35) * 3));
  } else drawDecorObj(c, x, y, o);
}

// ---------- Готические фонари ----------
// Семь видов, чтобы улица не была однообразной: шпиль, двойной, кронштейн, кованый,
// стрельчатая свеча, канделябр и горгулья с фонарём.
// Чёрное кованое железо, стрельчатые проёмы, острые навершия; светят вечером и ночью.
const IRON = ['#14101a', '#2a2430', '#4a4452'];

function lampCage(c, x, y, w, h, lit, fl) {
  // стеклянный фонарь со стрельчатым верхом: железная рамка, внутри тёплое пламя
  c.fillStyle = IRON[0]; c.fillRect(x - w / 2 - 0.8, y - h, w + 1.6, h + 0.8);
  c.fillStyle = lit ? '#7a3412' : '#5c564c';
  c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x - w / 2, y - h * 0.55); c.quadraticCurveTo(x - w / 2, y - h * 0.95, x, y - h); c.quadraticCurveTo(x + w / 2, y - h * 0.95, x + w / 2, y - h * 0.55); c.lineTo(x + w / 2, y); c.closePath(); c.fill();
  c.fillStyle = IRON[0]; c.fillRect(x - 0.4, y - h, 0.8, h);                   // средник
  if (lit) drawFire(c, x, y - 0.6, h > 8 ? 'spark' : 'tiny', Game.time, x * 0.37, { glow: 0 });
  // островерхая крыша с навершием
  c.fillStyle = IRON[1]; c.beginPath(); c.moveTo(x - w / 2 - 1.6, y - h); c.lineTo(x, y - h - w * 1.1); c.lineTo(x + w / 2 + 1.6, y - h); c.closePath(); c.fill();
  c.fillStyle = IRON[2]; c.beginPath(); c.moveTo(x - w / 2 - 1.6, y - h); c.lineTo(x, y - h - w * 1.1); c.lineTo(x - 0.5, y - h); c.closePath(); c.fill();
  c.fillStyle = IRON[0]; c.fillRect(x - 0.4, y - h - w * 1.1 - 2, 0.8, 2.4);
  ellipse(c, x, y - h - w * 1.1 - 2.2, 0.9, 0.9, IRON[0]);
}

function drawGothicLamp(c, bx, by, v, lit, ph) {
  shadowAt(c, bx + 1, by, 4);
  const fl = Math.round(Math.sin(Game.time * 6 + ph) * 18);
  const glowAt = (x, y, r) => { if (lit) glow(c, x, y, r, '255,196,100', 0.26 + 0.06 * Math.sin(Game.time * 5 + ph)); };
  // каменный цоколь для всех
  c.fillStyle = '#5a554e'; c.fillRect(bx - 3, by - 3, 6, 3);
  c.fillStyle = '#8e887c'; c.fillRect(bx - 3, by - 3, 6, 1);
  c.fillStyle = '#3e3a34'; c.fillRect(bx - 2.2, by - 5.5, 4.4, 2.6);
  if (v === 0) {
    // шпиль: тонкий столб с кольцами, одна высокая лампа
    c.fillStyle = IRON[1]; c.fillRect(bx - 0.9, by - 30, 1.8, 25);
    c.fillStyle = IRON[2]; c.fillRect(bx - 0.9, by - 30, 0.6, 25);
    for (const yy of [-10, -17, -24]) { c.fillStyle = IRON[0]; c.fillRect(bx - 2, by + yy, 4, 1.2); }
    lampCage(c, bx, by - 30, 5.6, 9, lit, fl);
    glowAt(bx, by - 35, 17);
  } else if (v === 1) {
    // двойной: две лампы на витых рожках
    c.fillStyle = IRON[1]; c.fillRect(bx - 0.9, by - 24, 1.8, 19);
    c.strokeStyle = IRON[0]; c.lineWidth = 1.2; c.lineCap = 'round';
    for (const s of [-1, 1]) {
      c.beginPath(); c.moveTo(bx, by - 21); c.quadraticCurveTo(bx + s * 8, by - 21, bx + s * 8, by - 27); c.stroke();
      c.beginPath(); c.moveTo(bx + s * 4, by - 21.8); c.quadraticCurveTo(bx + s * 5, by - 25, bx + s * 2.6, by - 26); c.stroke();   // завиток
      lampCage(c, bx + s * 8, by - 27, 4.4, 7, lit, fl);
      glowAt(bx + s * 8, by - 31, 13);
    }
  } else if (v === 2) {
    // кронштейн: высокий столб, изогнутая консоль с подвесной лампой на цепи
    c.fillStyle = IRON[1]; c.fillRect(bx - 1, by - 34, 2, 29);
    c.fillStyle = IRON[2]; c.fillRect(bx - 1, by - 34, 0.7, 29);
    c.strokeStyle = IRON[0]; c.lineWidth = 1.3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(bx, by - 31); c.quadraticCurveTo(bx + 4, by - 38, bx + 11, by - 34); c.stroke();
    c.beginPath(); c.moveTo(bx, by - 26); c.lineTo(bx + 7, by - 33); c.stroke();                                   // подкос
    c.strokeStyle = IRON[1]; c.lineWidth = 0.5; c.beginPath(); c.moveTo(bx + 11, by - 34); c.lineTo(bx + 11, by - 31); c.stroke();   // цепь
    lampCage(c, bx + 11, by - 23, 5, 8, lit, fl);
    glowAt(bx + 11, by - 28, 15);
    ellipse(c, bx, by - 36, 1.3, 1.3, IRON[0]);
  } else if (v === 3) {
    // кованый: витой столб, завитки-волюты и фонарь-колокол с лилией на навершии
    c.fillStyle = IRON[1]; c.fillRect(bx - 0.8, by - 26, 1.6, 21);
    c.strokeStyle = IRON[2]; c.lineWidth = 0.7;                       // витая оплётка столба
    for (let yy = by - 6; yy > by - 26; yy -= 2.6) { c.beginPath(); c.moveTo(bx - 1.4, yy); c.lineTo(bx + 1.4, yy - 1.6); c.stroke(); }
    c.strokeStyle = IRON[0]; c.lineWidth = 1.1; c.lineCap = 'round';
    for (const s of [-1, 1]) {                                          // волюты у основания и под лампой
      c.beginPath(); c.moveTo(bx, by - 7); c.quadraticCurveTo(bx + s * 6, by - 8, bx + s * 5, by - 13); c.quadraticCurveTo(bx + s * 4, by - 16, bx + s * 2, by - 14.6); c.stroke();
      c.beginPath(); c.moveTo(bx, by - 24); c.quadraticCurveTo(bx + s * 5, by - 24, bx + s * 4.6, by - 28); c.stroke();
    }
    // лампа-колокол: широкий стеклянный фонарь с шестью гранями и кольцом
    const lx = bx, ly = by - 27;
    c.fillStyle = IRON[0]; c.beginPath(); c.moveTo(lx - 5.2, ly); c.lineTo(lx - 3.6, ly - 8); c.lineTo(lx + 3.6, ly - 8); c.lineTo(lx + 5.2, ly); c.closePath(); c.fill();
    c.fillStyle = lit ? `rgb(255,${200 + fl},110)` : '#5c564c';
    c.beginPath(); c.moveTo(lx - 4.2, ly - 0.8); c.lineTo(lx - 2.9, ly - 7.2); c.lineTo(lx + 2.9, ly - 7.2); c.lineTo(lx + 4.2, ly - 0.8); c.closePath(); c.fill();
    c.fillStyle = IRON[0]; for (const dx of [-1.4, 1.4]) c.fillRect(lx + dx - 0.25, ly - 7.2, 0.5, 6.4);
    if (lit) { c.fillStyle = 'rgba(255,250,210,0.9)'; c.fillRect(lx - 1, ly - 5.4, 2, 2.6); }
    // колоколообразная крыша и кольцо-подвес
    c.fillStyle = IRON[1]; c.beginPath(); c.moveTo(lx - 5.6, ly - 8); c.quadraticCurveTo(lx - 4.2, ly - 12, lx, ly - 14); c.quadraticCurveTo(lx + 4.2, ly - 12, lx + 5.6, ly - 8); c.closePath(); c.fill();
    c.fillStyle = IRON[2]; c.beginPath(); c.moveTo(lx - 5.6, ly - 8); c.quadraticCurveTo(lx - 4.2, ly - 12, lx, ly - 14); c.lineTo(lx - 0.6, ly - 8); c.closePath(); c.fill();
    c.strokeStyle = IRON[0]; c.lineWidth = 0.8; c.beginPath(); c.arc(lx, ly - 15.4, 1.4, 0, Math.PI * 2); c.stroke();
    // лилия на навершии
    c.fillStyle = IRON[0]; c.beginPath(); c.moveTo(lx, ly - 21); c.quadraticCurveTo(lx + 2.2, ly - 18.6, lx, ly - 16.6); c.quadraticCurveTo(lx - 2.2, ly - 18.6, lx, ly - 21); c.fill();
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(lx, ly - 17.2); c.quadraticCurveTo(lx + s * 3.2, ly - 18.2, lx + s * 2.6, ly - 20.4); c.lineWidth = 0.8; c.stroke(); }
    glowAt(bx, by - 31, 16);
  } else if (v === 4) {
    // стрельчатая свеча: высокая узкая лампа-ланцет на столбе с опорными дугами, крест на вершине
    c.fillStyle = IRON[1]; c.fillRect(bx - 1.1, by - 22, 2.2, 17);
    c.fillStyle = IRON[2]; c.fillRect(bx - 1.1, by - 22, 0.7, 17);
    c.strokeStyle = IRON[0]; c.lineWidth = 1; c.lineCap = 'round';
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(bx + s * 1, by - 8); c.quadraticCurveTo(bx + s * 6, by - 11, bx + s * 4.6, by - 21); c.stroke(); }   // арочные подпорки
    c.fillStyle = IRON[0]; c.beginPath(); c.moveTo(bx - 3.4, by - 22); c.lineTo(bx - 3.4, by - 34); c.quadraticCurveTo(bx - 3.4, by - 40, bx, by - 43); c.quadraticCurveTo(bx + 3.4, by - 40, bx + 3.4, by - 34); c.lineTo(bx + 3.4, by - 22); c.closePath(); c.fill();
    c.fillStyle = lit ? `rgb(255,${196 + fl},100)` : '#5c564c';
    c.beginPath(); c.moveTo(bx - 2.3, by - 23); c.lineTo(bx - 2.3, by - 34); c.quadraticCurveTo(bx - 2.3, by - 38.6, bx, by - 41); c.quadraticCurveTo(bx + 2.3, by - 38.6, bx + 2.3, by - 34); c.lineTo(bx + 2.3, by - 23); c.closePath(); c.fill();
    c.fillStyle = IRON[0]; c.fillRect(bx - 0.3, by - 40, 0.6, 17); c.fillRect(bx - 2.4, by - 31, 4.8, 0.6);          // переплёт
    if (lit) { c.fillStyle = 'rgba(255,248,205,0.9)'; c.fillRect(bx - 0.9, by - 36, 1.8, 5); }
    c.fillRect(bx - 0.3, by - 47, 0.6, 4.6); c.fillRect(bx - 1.8, by - 45.4, 3.6, 0.6);                              // крест
    glowAt(bx, by - 33, 19);
  } else if (v === 5) {
    // канделябр: столб с короной из пяти свечей-огоньков под стеклянными колпачками
    c.fillStyle = IRON[1]; c.fillRect(bx - 0.9, by - 21, 1.8, 16);
    c.strokeStyle = IRON[0]; c.lineWidth = 1; c.lineCap = 'round';
    c.beginPath(); c.moveTo(bx, by - 21); c.quadraticCurveTo(bx - 7, by - 22, bx - 8, by - 28); c.stroke();
    c.beginPath(); c.moveTo(bx, by - 21); c.quadraticCurveTo(bx + 7, by - 22, bx + 8, by - 28); c.stroke();
    c.beginPath(); c.moveTo(bx, by - 21); c.quadraticCurveTo(bx - 3.2, by - 25, bx - 3.6, by - 30); c.stroke();
    c.beginPath(); c.moveTo(bx, by - 21); c.quadraticCurveTo(bx + 3.2, by - 25, bx + 3.6, by - 30); c.stroke();
    c.beginPath(); c.moveTo(bx, by - 21); c.lineTo(bx, by - 32); c.stroke();
    for (const [dx, dy] of [[-8, -28], [8, -28], [-3.6, -30], [3.6, -30], [0, -32]]) {
      // чашечка, свеча, колпачок и пламя
      c.fillStyle = IRON[0]; c.fillRect(bx + dx - 1.8, by + dy, 3.6, 1);
      c.fillStyle = '#e8dcc0'; c.fillRect(bx + dx - 0.8, by + dy - 3.2, 1.6, 3.2);
      if (lit) drawFire(c, bx + dx, by + dy - 3.2, 'tiny', Game.time, dx * 1.3 + ph, { glow: 0 });
      else { c.fillStyle = '#6a645a'; c.beginPath(); c.ellipse(bx + dx, by + dy - 4.4, 0.9, 1.7, 0, 0, 7); c.fill(); }
      c.strokeStyle = 'rgba(170,190,210,0.45)'; c.lineWidth = 0.5; c.beginPath(); c.arc(bx + dx, by + dy - 3.8, 2, Math.PI, 0); c.stroke();
    }
    ellipse(c, bx, by - 21, 1.6, 1.6, IRON[0]);
    glowAt(bx, by - 30, 20);
  } else {
    // горгулья: на столбе сидит каменный зверёк с крыльями и держит фонарь на цепи в когтях
    c.fillStyle = '#6e685e'; c.fillRect(bx - 2.2, by - 22, 4.4, 17);
    c.fillStyle = '#9a9488'; c.fillRect(bx - 2.2, by - 22, 1.2, 17);
    c.fillStyle = '#3e3a34'; c.fillRect(bx + 1.2, by - 22, 1, 17);
    c.fillStyle = '#5a554e'; c.fillRect(bx - 3.4, by - 24, 6.8, 2.2);                                  // капитель
    c.fillStyle = '#4a463f';                                                                            // сама горгулья
    c.beginPath(); c.moveTo(bx - 3, by - 24); c.quadraticCurveTo(bx - 4, by - 30, bx - 1.6, by - 31); c.lineTo(bx + 1.8, by - 31); c.quadraticCurveTo(bx + 4, by - 30, bx + 3, by - 24); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(bx - 2.6, by - 28); c.lineTo(bx - 9, by - 34); c.lineTo(bx - 6.6, by - 27); c.closePath(); c.fill();           // крылья
    c.beginPath(); c.moveTo(bx + 2.6, by - 28); c.lineTo(bx + 9, by - 34); c.lineTo(bx + 6.6, by - 27); c.closePath(); c.fill();
    c.fillStyle = '#6e685e'; c.beginPath(); c.moveTo(bx - 2.6, by - 28); c.lineTo(bx - 8.2, by - 33.2); c.lineTo(bx - 6.4, by - 28); c.closePath(); c.fill();
    ellipse(c, bx, by - 33, 2.6, 2.2, '#5a554e');                                                       // голова
    c.fillStyle = '#4a463f'; c.beginPath(); c.moveTo(bx - 2.2, by - 34.4); c.lineTo(bx - 3.2, by - 37.4); c.lineTo(bx - 0.8, by - 35); c.fill(); c.beginPath(); c.moveTo(bx + 2.2, by - 34.4); c.lineTo(bx + 3.2, by - 37.4); c.lineTo(bx + 0.8, by - 35); c.fill();   // рожки
    c.fillStyle = lit ? '#ffc060' : '#2a2620'; c.fillRect(bx - 1.6, by - 33.4, 1, 0.9); c.fillRect(bx + 0.6, by - 33.4, 1, 0.9);   // глаза светятся
    c.strokeStyle = IRON[0]; c.lineWidth = 0.6; c.beginPath(); c.moveTo(bx + 4.2, by - 25); c.lineTo(bx + 5.6, by - 20); c.stroke();      // цепь
    lampCage(c, bx + 5.6, by - 11, 4.4, 7, lit, fl);
    glowAt(bx + 5.6, by - 16, 16);
  }
}
