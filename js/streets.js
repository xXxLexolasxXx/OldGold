'use strict';
// Убранство улиц. Когда дорога разрастается, вдоль неё сами появляются фонари,
// скамейки (на них отдыхают жители) и урны. Урны наполняются мусором; свободный
// работяга вытряхивает полную урну в мешок, а трудяги уносят мусор в большой костёр.

const STREET = { lamp: { gap: 3 }, bench: { gap: 7 }, bin: { gap: 8 } };   // фонари — часто, через три клетки
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
    World.obj[idx(sx, sy)] = t === 'bin' ? { t, g: Math.random() * 0.3 } : { t };
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
    if (!o || o.t !== 'bench' || (o.sit && Game.unitMap.get(o.sit) && Game.unitMap.get(o.sit).benchAt === idx(xx, yy))) continue;
    const d = Math.hypot(xx - x, yy - y);
    if (d < bd) { bd = d; best = [xx, yy, o]; }
  }
  return best;
}

function* benchGen(u, bench) {
  const [x, y, o] = bench;
  o.sit = u.id;
  const ok = yield { walk: [x, y], offroad: true };
  if (!ok || World.obj[idx(x, y)] !== o) { o.sit = 0; return; }
  u.benchAt = idx(x, y);
  // посидеть, иногда закурить или помахать прохожим
  yield { wait: 6 + Math.random() * 8, anim: 'sit' };
  if (u.smoker && Math.random() < 0.5) yield { wait: 6, anim: 'smoke' };
  u.benchAt = -1;
  o.sit = 0;
}

// ---------- Рисование ----------

function drawStreetObj(c, x, y, o) {
  const px = x * TILE, py = y * TILE;
  if (o.t === 'lamp') {
    drawGothicLamp(c, px + 22, py + 24, hash(idx(x, y)) % 4, isEveningNow(), x * 3.1 + y);
  } else if (o.t === 'bench') {
    const bx = px + 6, by = py + 22;
    shadowAt(c, bx + 10, by + 1, 11, 2.4);
    c.fillStyle = '#45291a'; c.fillRect(bx + 1, by - 3, 2, 4); c.fillRect(bx + 17, by - 3, 2, 4);
    c.fillStyle = '#a06840'; rrect(c, bx, by - 5, 20, 2.6, 0.8); c.fill();
    c.fillStyle = '#cc9a64'; c.fillRect(bx, by - 5, 20, 0.7);
    c.fillStyle = '#875434'; rrect(c, bx, by - 10, 20, 2.2, 0.8); c.fill();   // спинка
    c.fillStyle = '#45291a'; c.fillRect(bx + 1, by - 10, 1.4, 6); c.fillRect(bx + 17.6, by - 10, 1.4, 6);
  } else if (o.t === 'bin') {
    const bx = px + 16, by = py + 24;
    shadowAt(c, bx + 1, by, 5);
    // плетёная урна-корзина
    c.fillStyle = lingrad(c, bx - 5, 0, bx + 5, 0, [[0, '#a06840'], [0.5, '#875434'], [1, '#583522']]);
    c.beginPath(); c.moveTo(bx - 5, by - 11); c.lineTo(bx + 5, by - 11); c.lineTo(bx + 4, by); c.lineTo(bx - 4, by); c.closePath(); c.fill();
    c.fillStyle = 'rgba(30,15,5,0.4)'; for (let k = 0; k < 4; k++) c.fillRect(bx - 4.6, by - 9 + k * 2.6, 9.2, 0.6);
    c.fillStyle = '#45291a'; c.fillRect(bx - 5.4, by - 12, 10.8, 1.4);
    // мусор торчит по мере наполнения
    const f = o.g || 0;
    if (f > 0.3) { ellipse(c, bx - 1.4, by - 12, 2.2, 1.2, '#9c8e48'); ellipse(c, bx + 2, by - 12.4, 1.6, 1, '#73963e'); }
    if (f > 0.65) { line(c, bx - 2, by - 12, bx - 4, by - 16, '#e0b882', 0.8); ellipse(c, bx + 0.6, by - 13.6, 2, 1.2, '#b6ada0'); }
    if (f >= 1) {
      // переполнена — кружат мухи
      for (let k = 0; k < 3; k++) {
        const a = Game.time * 6 + k * 2.1 + x;
        c.fillStyle = '#1a1210'; c.fillRect(Math.round(bx + Math.cos(a) * 5), Math.round(by - 17 + Math.sin(a * 1.3) * 2), 1, 1);
      }
    }
  }
}

// ---------- Готические фонари ----------
// Четыре вида, чтобы улица не была однообразной: шпиль, двойной, кронштейн, башенка.
// Чёрное кованое железо, стрельчатые проёмы, острые навершия; светят вечером и ночью.
const IRON = ['#14101a', '#2a2430', '#4a4452'];

function lampCage(c, x, y, w, h, lit, fl) {
  // стеклянный фонарь со стрельчатым верхом: железная рамка, внутри тёплое пламя
  c.fillStyle = IRON[0]; c.fillRect(x - w / 2 - 0.8, y - h, w + 1.6, h + 0.8);
  c.fillStyle = lit ? `rgb(255,${200 + fl},110)` : '#5c564c';
  c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x - w / 2, y - h * 0.55); c.quadraticCurveTo(x - w / 2, y - h * 0.95, x, y - h); c.quadraticCurveTo(x + w / 2, y - h * 0.95, x + w / 2, y - h * 0.55); c.lineTo(x + w / 2, y); c.closePath(); c.fill();
  c.fillStyle = IRON[0]; c.fillRect(x - 0.4, y - h, 0.8, h);                   // средник
  if (lit) { c.fillStyle = 'rgba(255,250,210,0.9)'; c.fillRect(x - 0.9, y - h * 0.62, 1.8, h * 0.3); }
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
  } else {
    // башенка: каменная колонна со стрельчатой нишей и шпилем-крокетами
    c.fillStyle = '#6e685e'; c.fillRect(bx - 3.4, by - 24, 6.8, 19);
    c.fillStyle = '#9a9488'; c.fillRect(bx - 3.4, by - 24, 1.6, 19);
    c.fillStyle = '#3e3a34'; c.fillRect(bx + 2, by - 24, 1.4, 19);
    for (let r = 0; r < 4; r++) { c.fillStyle = 'rgba(30,26,22,0.35)'; c.fillRect(bx - 3.4, by - 8 - r * 4.6, 6.8, 0.6); }
    // ниша-окно
    c.fillStyle = IRON[0]; c.beginPath(); c.moveTo(bx - 2.2, by - 14); c.lineTo(bx - 2.2, by - 19); c.quadraticCurveTo(bx - 2.2, by - 22.6, bx, by - 23.4); c.quadraticCurveTo(bx + 2.2, by - 22.6, bx + 2.2, by - 19); c.lineTo(bx + 2.2, by - 14); c.closePath(); c.fill();
    c.fillStyle = lit ? `rgb(255,${200 + fl},110)` : '#5c564c';
    c.beginPath(); c.moveTo(bx - 1.4, by - 14.8); c.lineTo(bx - 1.4, by - 19); c.quadraticCurveTo(bx - 1.4, by - 21.6, bx, by - 22.2); c.quadraticCurveTo(bx + 1.4, by - 21.6, bx + 1.4, by - 19); c.lineTo(bx + 1.4, by - 14.8); c.closePath(); c.fill();
    // шпиль с крокетами
    c.fillStyle = IRON[1]; c.beginPath(); c.moveTo(bx - 4.4, by - 24); c.lineTo(bx, by - 37); c.lineTo(bx + 4.4, by - 24); c.closePath(); c.fill();
    c.fillStyle = IRON[2]; c.beginPath(); c.moveTo(bx - 4.4, by - 24); c.lineTo(bx, by - 37); c.lineTo(bx - 0.8, by - 24); c.closePath(); c.fill();
    for (const [dy, s] of [[-27, 1.6], [-31, 1.1]]) for (const sd of [-1, 1]) ellipse(c, bx + sd * (2.6 - (dy + 27) * -0.2), by + dy, s * 0.55, s * 0.55, IRON[0]);
    ellipse(c, bx, by - 37.6, 0.9, 0.9, IRON[0]);
    glowAt(bx, by - 18, 15);
  }
}
