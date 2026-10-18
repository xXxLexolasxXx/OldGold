'use strict';
// Захват гнома нечистью — общее для всех видов: пальцы поверх жертвы, рисование схваченного гнома,
// и свои анимации «забирания» у скелета, призрака и летучей мыши (у дерева и водяного кадры — в night.js / nechist.js).
// У каждого вида не меньше 9 кадров захвата: потянулся → схватил → сжал → поднял → унёс (+ 4 кадра ходьбы/полёта с ношей).
// Камень (rocks.js) устроен по-старому и здесь не трогается.

// конец каждого кадра g0..g8 (с) для дерева и водяного: подшаг и замах, рука тянется, хватает, сжимает, поднимает, разворот
const GRAB_T = [0.2, 0.4, 0.65, 0.9, 1.1, 1.3, 1.5, 1.7, 2.1];
// после последнего кадра — кадры «несёт» (индексы 9…12)
function grabIdx(t, T = GRAB_T) { for (let i = 0; i < T.length; i++) if (t < T[i]) return i; return T.length; }
const smooth01 = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

// снимок гнома для рисования, пока самого гнома уже нет в Game.units (и для зеркала кооператива)
function snapVictim(u) { return { id: u.id, type: u.type, look: u.look, xp: u.xp }; }

// линия по целым пикселям (пиксель-арт без сглаживания)
function pxLine(c, x0, y0, x1, y1, w) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, o = Math.floor(w / 2);
  let err = dx + dy;
  for (let n = 0; n < 200; n++) {
    c.fillRect(x0 - o, y0 - o, w, w);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

// Пальцы, обхватывающие гнома поперёк: k=0 — растопыренная кисть, k=1 — сжатые когтистые пальцы с просветами
// (не сплошной кулак: между пальцами виден гном). f — в какую сторону от ладони обхват; pal: {out, fill, hi}
function drawGrip(c, hx, hy, f, k, pal, S = 1) {
  const thick = S >= 1.2, ow = 4, fw = 2, fingers = [];
  for (let i = 0; i < 3; i++) {
    const o = i - 1;
    const aOpen = o * 0.75 - 0.15, aClosed = o * 0.16 + 0.12;
    const a1 = aOpen + (aClosed - aOpen) * k, a2 = a1 + 0.4 + 1.5 * k;
    const l1 = (5.6 + (i === 1 ? 1 : -0.4)) * S, l2 = (4 + (i === 1 ? 0.6 : -0.3)) * S;
    const x0 = hx - f * 1.5 * S, y0 = hy + o * 4.6 * S;
    const x1 = x0 + f * Math.cos(a1) * l1, y1 = y0 + Math.sin(a1) * l1;
    const x2 = x1 + f * Math.cos(a2) * l2, y2 = y1 + Math.sin(a2) * l2;
    fingers.push([x0, y0, x1, y1, x2, y2]);
  }
  c.save();
  c.fillStyle = pal.out;
  if (thick) for (const q of fingers) { pxLine(c, q[0], q[1], q[2], q[3], ow); pxLine(c, q[2], q[3], q[4], q[5], ow - 1); c.fillRect(Math.round(q[0]) - 2, Math.round(q[1]) - 2, 4, 4); }
  else for (const q of fingers) { pxLine(c, q[0], q[1] + 1, q[2], q[3] + 1, 1); pxLine(c, q[2], q[3] + 1, q[4], q[5] + 1, 1); }   // тонкие пальцы: тень снизу вместо обводки
  c.fillStyle = pal.fill;
  for (const q of fingers) { pxLine(c, q[0], q[1], q[2], q[3], thick ? fw : 1); pxLine(c, q[2], q[3], q[4], q[5], thick ? fw - 1 : 1); if (thick) c.fillRect(Math.round(q[0]) - 1, Math.round(q[1]) - 1, 2, 2); }
  c.fillStyle = pal.hi;                                     // блик на суставах и острия когтей
  for (const q of fingers) { c.fillRect(Math.round(q[2]), Math.round(q[3]) - 1, 1, 1); c.fillRect(Math.round(q[4]), Math.round(q[5]), 1, 1); }
  c.restore();
}

// Схваченный гном: pivot — центр тела (в 14 px над ступнями), rot — поворот, held — уже в руке (машет и вырывается)
function drawGrabbed(c, v, px, py, rot, held, alpha = 1) {
  const opt = { gait: '', gest: 'panic', gf: Math.floor(Game.time * (held ? 10 : 6) + v.id) & 1 };
  const spr = held ? personSprite(v, 'S', 'walk', Math.floor(Game.time * 16) & 7, opt) : personSprite(v, 'S', 'idle', 0, opt);
  c.save();
  if (alpha < 1) c.globalAlpha *= alpha;
  const shake = held ? 0 : (Math.floor(Game.time * 30) & 1 ? 0.8 : -0.8);       // до хвата — трясётся от ужаса
  c.translate(Math.round(px + shake), Math.round(py));
  c.rotate(rot + (held ? Math.sin(Game.time * 9 + v.id) * 0.28 : 0));
  c.drawImage(spr, -PFX, -PFY + 14, PW, PH);
  c.restore();
}

function grabScream(who, x, y, dt) {
  if ((who.scream = (who.scream || 0) - dt) > 0) return;
  who.scream = 0.8 + Math.random() * 0.5;
  floater(x, y, ['А-а-а!', 'Помогите!', 'Пусти!', 'Мама!', 'Бородой клянусь!'][Math.floor(Math.random() * 5)], '#ffc0c0');
}

// ====================== СКЕЛЕТ ======================
// Костлявая рука вытягивается, хватает гнома за пояс, сжимает фаланги, поднимает над головой и закидывает на плечо, как мешок; несёт к могиле.
const SK_T = [0.15, 0.3, 0.5, 0.7, 0.9, 1.15, 1.45, 1.8, 2.1];
// h — кисть в системе скелета (x вперёд, y вверх = минус), lean — наклон корпуса, k — сжатие пальцев,
// held — гном в руке, pv — центр гнома относительно кисти, rot — поворот гнома (вперёд головой — вверх)
const SK_POSE = [
  { h: [-3, -32], lean: -1.8, k: 0, held: 0, nm: 'замах назад' },
  { h: [8, -29], lean: 0.6, k: 0, held: 0, nm: 'бросок вперёд' },
  { h: [15, -23], lean: 1.6, k: 0, held: 0, nm: 'тянется' },
  { h: [17, -16], lean: 2.4, k: 0.55, held: 0, nm: 'пальцы на поясе' },
  { h: [17, -16], lean: 2.4, k: 1, held: 1, pv: [2, 1], rot: 0, nm: 'схватил' },
  { h: [16, -24], lean: 1.6, k: 1, held: 1, pv: [2, 1], rot: 0.12, nm: 'отрывает от земли' },
  { h: [13, -34], lean: 0.2, k: 1, held: 1, pv: [1, 2], rot: -0.1, nm: 'поднял' },
  { h: [7, -38], lean: -1.2, k: 1, held: 1, pv: [-2, -3], rot: -0.7, nm: 'заносит' },
  { h: [2, -25], lean: -0.5, k: 1, held: 1, pv: [-5, -3], rot: -1.35, behind: 1, nm: 'на плечо' },
];
const SK_CARRY_SW = [0.05, 0, -0.05, 0];
// i: 0…8 захват, 9…12 — шаг с ношей на плече
function skPoseAt(i) {
  if (i < 9) return SK_POSE[i];
  const q = i - 9;
  return { h: [2, -25 + (q % 2 ? 0.8 : 0)], lean: -0.5, k: 1, held: 1, pv: [-5, -3], rot: -1.35 + SK_CARRY_SW[q], behind: 1, nm: 'несёт ' + (q + 1) };
}
function skGrabIndex(s) {
  if (s._gi !== undefined) return s._gi;
  if (s.state === 'sink' && s.vsnap) return 9 + (Math.floor(s.phase / 1.12) & 3);
  if (s.state !== 'grab') return -1;
  const i = grabIdx(s.t, SK_T);
  return i < 9 ? i : 9 + (Math.floor(s.phase / 1.12) & 3);
}

function skTakes(s, u) {
  s.state = 'grab'; s.t = 0; s.fighters = []; s.resolved = false; s.goal = null; s.foe = null; s.moving = false;
  s.vsnap = snapVictim(u); s.vx0 = u.x; s.vy0 = u.y; s.face = u.x >= s.x ? 1 : -1; s.scream = 0; s.sayV = false;
  floater(u.x, u.y - 1.2, '!', '#ff6040');
  fxBurst(u.x * TILE, u.y * TILE - 8, 8, ['#e6dfc8', '#c8c0a4', '#a02818'], 40, 40, 0.6, 1.6, 180);
  sfxAt('rattle', s.x * TILE, s.y * TILE, 1);
  toast(`Скелет утащил в могилу: ${UNIT_TYPES[u.type].name}`);
  logEvent('tree', `Скелет утащил в могилу: ${UNIT_TYPES[u.type].name}`, u.x, u.y);
  removeUnit(u);
}

function skGrabTick(s, dt) {
  const f = s.face;
  if (s.t < 0.3) { skelMove(s, s.vx0 - f * 0.47, s.vy0, 1.8, dt); s.face = f; }
  else if (s.t < SK_T[8]) s.moving = false;
  else {
    if (!s.sayV) { s.sayV = true; floater(s.x, s.y - 2.2, 'Не в могилу!..', '#ffc0c0'); sfxAt('rattle', s.x * TILE, s.y * TILE, 0.8); }
    const near = Math.hypot(s.hx - s.x, s.hy - s.y) < 0.15;
    if (!near) skelMove(s, s.hx, s.hy, 0.55, dt); else s.moving = false;
    if (near || s.t > 12) {
      floater(s.x, s.y - 1.6, 'Клац.', '#e8e8d0');
      sfxAt('thud', s.x * TILE, s.y * TILE, 1);
      fxBurst(s.x * TILE, s.y * TILE + 2, 16, ['#4a4234', '#2a241c', '#7a7468'], 45, 50, 0.9, 2, 220);
      if (Math.random() < 0.55) { const vx = s.x, vy = s.y; fxLater(2.5, () => { skelRise(vx, vy, 0); logEvent('tree', 'Павший гном встал скелетом', vx, vy); }); }
      s.state = 'sink'; s.t = 0;                                   // вместе с добычей уходит под землю
    }
  }
  if (s.t > SK_T[2]) { grabScream(s, s.x + f * 0.5, s.y - 1.4, dt); }
}

// гном на плече / в руке скелета и пальцы поверх; вызывается после основного рисунка в мировых координатах
function skDrawVictim(c, s, px, py, f, gi, pose, k, part) {
  const v = s.vsnap, h = pose.h;
  const hx = px + f * h[0], hy = py + h[1];
  const dy = (1 - k) * 8;
  c.save();
  if (k < 1) c.globalAlpha *= Math.max(0, k);
  if (part !== 'grip') {
    if (pose.held) drawGrabbed(c, v, hx + f * pose.pv[0], hy + pose.pv[1] + dy, f * pose.rot, true);
    else drawGrabbed(c, v, s.vx0 * TILE, s.vy0 * TILE + 6 - 14, 0, false);
  }
  if (part !== 'body') drawGrip(c, hx, hy + dy, f, pose.k, SK_PAL, 0.9);
  c.restore();
  if (part !== 'grip' && !pose.held && gi >= 0) { c.fillStyle = '#ff6040'; c.font = 'bold 9px serif'; c.fillText('!', Math.round(s.vx0 * TILE) - 1, Math.round(s.vy0 * TILE) - 28); }
}
const SK_PAL = { out: '#17120c', fill: '#e4ddc6', hi: '#fffbe8' };

// ====================== ПРИЗРАК ======================
// Призрак падает на гнома, обеими призрачными руками хватает его за плечи, сжимает когти, подымает и уплывает с ним в туман.
const GH_T = [0.2, 0.4, 0.65, 0.9, 1.1, 1.3, 1.55, 1.85, 2.3];
// hf — дальняя рука, hn — ближняя (в системе спрайта призрака, голова в 0,0; x вперёд, y вниз)
const GH_POSE = [
  { hf: [8, -22], hn: [-10, -22], lean: -3, k: 0, held: 0, nm: 'воздел руки' },
  { hf: [17, -10], hn: [3, -17], lean: 3, k: 0, held: 0, nm: 'бросок' },
  { hf: [21, 0], hn: [11, -4], lean: 6, k: 0, held: 0, nm: 'тянется' },
  { hf: [22, 8], hn: [11, 5], lean: 7, k: 0.5, held: 0, nm: 'когти вокруг гнома' },
  { hf: [22, 8], hn: [11, 6], lean: 7, k: 1, held: 1, nm: 'схватил' },
  { hf: [22, 2], hn: [11, 0], lean: 5, k: 1, held: 1, nm: 'отрывает от земли' },
  { hf: [22, -8], hn: [11, -9], lean: 2, k: 1, held: 1, nm: 'поднял' },
  { hf: [18, -3], hn: [8, -4], lean: -2, k: 1, held: 1, nm: 'прижимает' },
  { hf: [16, 2], hn: [6, 1], lean: -3, k: 1, held: 1, nm: 'уносит' },
];
function ghPoseAt(i) { return GH_POSE[Math.max(0, Math.min(8, i))]; }
function ghGrabIndex(g) {
  if (g._gi !== undefined) return g._gi;
  const i = grabIdx(g.gt || 0, GH_T);
  return i < 9 ? i : 9 + (Math.floor((g.gt || 0) * 8) & 3);
}
const GH_PAL = { out: 'rgba(24,60,64,0.95)', fill: '#dff4ea', hi: '#ffffff' };

function ghCanTake(g, u) {
  if (u.hero || u.type === 'carter' || (g.grabCD || 0) > Game.time || nightDiff() < 1.25) return false;
  if (!interruptible(u) && !(u.brk && u.brk.kind === 'lost')) return false;
  if (nearBonfire(u.x, u.y, BONFIRE_SAFE)) return false;
  for (const o of Game.units) if (o !== u && !o.dead && !o.inside && isPerson(o) && Math.hypot(o.x - u.x, o.y - u.y) < 5) return false;   // в одиночку — боязливее
  return Math.random() < 0.012 * nightDiff() * (u.brk && u.brk.kind === 'lost' ? 3 : 1);
}

function ghTakes(g, u) {
  if (u.brk && u.brk.kind === 'lost') endBreak(u);
  g.mode = 'grab'; g.modeT = 999; g.gt = 0; g.grabCD = Game.time + 150; g.atkT = 0;
  g.vsnap = snapVictim(u); g.vx0 = u.x; g.vy0 = u.y; g.face = u.x >= g.x ? 1 : -1; g.scream = 0; g.sayV = false;
  g.t = 0;
  floater(u.x, u.y - 1.2, '!', '#ff6040');
  sfxAt('wail', g.x * TILE, g.y * TILE, 1.2);
  toast(`Призрак унёс в туман: ${UNIT_TYPES[u.type].name}`);
  logEvent('tree', `Призрак унёс в туман: ${UNIT_TYPES[u.type].name}`, u.x, u.y);
  removeUnit(u);
}

function ghGrabTick(g, dt) {
  g.gt += dt; g.t = g.gt;
  const f = g.face;
  if (g.gt < 0.5) { // подлетает на расстояние хвата
    const tx = g.vx0 - f * 0.51, ty = g.vy0 + 0.03, dx = tx - g.x, dy = ty - g.y, d = Math.hypot(dx, dy);
    if (d > 0.02) { const st = Math.min(d, 3 * dt); g.x += dx / d * st; g.y += dy / d * st; }
    g.face = f;
  } else if (g.gt >= GH_T[8]) {
    // с добычей плывёт прочь, растворяясь в тумане
    if (!g.sayV) { g.sayV = true; floater(g.x, g.y - 2.4, 'А надо было раньше…', '#ffc0c0'); }
    g.x += (g.gdir || (g.gdir = (g.x > MAP_W / 2 ? 1 : -1))) * 0.75 * dt; g.y -= 0.18 * dt;
    g.alpha = Math.max(0, g.alpha - dt * 0.28);
    if (g.alpha <= 0.02 || g.gt > 9) g.mode = 'leave';
  }
  if (g.gt > GH_T[3]) grabScream(g, g.x + f * 0.6, g.y - 1.6, dt);
}

// гном и когти внутри перевёрнутой системы призрака (после его спрайта); c уже сдвинут в центр головы и отражён по лицу
function ghDrawVictim(c, g, gi, alpha, px, py) {
  const p = ghPoseAt(gi), v = g.vsnap;
  const mx = (p.hf[0] + p.hn[0]) / 2, my = (p.hf[1] + p.hn[1]) / 2 + 1;
  c.save();
  c.globalAlpha = alpha;
  if (p.held) drawGrabbed(c, v, mx, my, 0, true);
  else {
    // гном ещё на земле (в системе призрака: ближе к нему по x, ниже по y)
    const gx = (g.vx0 * TILE - px) * (g.face < 0 ? -1 : 1), gy = g.vy0 * TILE + 6 - 14 - py;
    drawGrabbed(c, v, gx, gy, 0, false);
    c.fillStyle = '#ff6040'; c.font = 'bold 9px serif'; c.fillText('!', Math.round(gx) - 1, Math.round(gy) - 20);
  }
  drawGrip(c, p.hn[0], p.hn[1], 1, p.k, GH_PAL, 0.7);          // ближняя рука обхватывает спереди, дальняя видна из-за гнома
  c.restore();
}

// ====================== ЛЕТУЧАЯ МЫШЬ ======================
// Мышь высматривает одинокого гнома, пикирует, вцепляется когтистыми лапами в плечи, бьёт крыльями и уносит ввысь.
const BT_T = [0.3, 0.6, 0.95, 1.25, 1.5, 1.7, 2.1, 2.5, 3.0];
// w — полуразмах, up — подъём концов крыла, tilt — наклон носом вниз, tal — выпуск лап, k — сжатие когтей, S — размер
const BT_POSE = [
  { w: 7, up: 3, tilt: 0, tal: 0, k: 0, S: 1.5, nm: 'кружит' },
  { w: 6, up: 1, tilt: 0.25, tal: 0, k: 0, S: 1.8, nm: 'высмотрел' },
  { w: 3.4, up: -3, tilt: 0.9, tal: 0, k: 0, S: 2.1, nm: 'пике' },
  { w: 5.6, up: -1, tilt: 0.5, tal: 0.6, k: 0, S: 2.3, nm: 'выходит из пике' },
  { w: 8, up: 0, tilt: 0.15, tal: 1, k: 0, S: 2.4, nm: 'лапы вперёд' },
  { w: 8.5, up: 4, tilt: 0, tal: 1, k: 1, S: 2.4, nm: 'вцепилась' },
  { w: 8.5, up: -4, tilt: 0, tal: 1, k: 1, S: 2.4, nm: 'взмах, отрыв' },
  { w: 8.5, up: 4, tilt: 0, tal: 1, k: 1, S: 2.4, nm: 'вверх' },
  { w: 8.5, up: -4, tilt: -0.05, tal: 1, k: 1, S: 2.4, nm: 'набирает высоту' },
];
const BT_CARRY = [[4, 0.12], [-1, 0], [-4, -0.1], [1, 0]];
function btPoseAt(i) {
  if (i < 9) return BT_POSE[i];
  const q = BT_CARRY[(i - 9) & 3];
  return { w: 8.5, up: q[0], tilt: q[1], tal: 1, k: 1, S: 2.4, nm: 'уносит ' + (i - 8) };
}
function btGrabIndex(b) {
  if (b._gi !== undefined) return b._gi;
  const i = grabIdx(b.gt || 0, BT_T);
  return i < 9 ? i : 9 + (Math.floor((b.gt || 0) * 9) & 3);
}
const btTalonY = p => (2 + 2.6 * p.tal) * p.S;
const BT_PAL = { out: '#0c0910', fill: '#3a3248', hi: '#e8d8ff' };

function batCanTake(b, u) {
  if (b.state === 'grab' || b.leave || u.hero || (b.grabCD || 0) > Game.time || nightDiff() < 1.25) return false;
  if (!interruptible(u)) return false;
  if (nearBonfire(u.x, u.y, BONFIRE_SAFE)) return false;
  for (const o of Game.units) if (o !== u && !o.dead && !o.inside && isPerson(o) && Math.hypot(o.x - u.x, o.y - u.y) < 5) return false;
  return Math.random() < 0.09 * Math.min(2, nightDiff());
}

function batTakes(b, u) {
  b.state = 'grab'; b.gt = 0; b.grabCD = Game.time + 200; b.z0 = b.z; b.x0 = b.x; b.y0 = b.y;
  b.vsnap = snapVictim(u); b.vx0 = u.x; b.vy0 = u.y; b.scream = 0; b.t = 0; b.sayV = false; b.valpha = 1;
  floater(u.x, u.y - 1.2, '!', '#ff6040');
  sfxAt('squeak', b.x * TILE, b.y * TILE, 1.3);
  toast(`Летучая мышь унесла в туман: ${UNIT_TYPES[u.type].name}`);
  logEvent('tree', `Летучая мышь унесла в туман: ${UNIT_TYPES[u.type].name}`, u.x, u.y);
  removeUnit(u);
}

// возвращает true, когда мышь пора убрать
function batGrabTick(b, dt) {
  b.gt += dt; b.t = b.gt;
  const p5 = btPoseAt(5);
  const gy = b.vy0 * TILE + 6;                                           // ступни гнома
  const zGrab = b.vy0 * TILE - ((gy - 14) - 9 - btTalonY(p5));          // высота тела при хвате: лапы на плечах
  const T4 = BT_T[4];
  if (b.gt < T4) {
    const q = smooth01(b.gt / T4);
    b.x = b.x0 + (b.vx0 - b.x0) * q; b.y = b.y0 + (b.vy0 - b.y0) * q; b.z = b.z0 + (zGrab - b.z0) * q;
    b.face = b.vx0 >= b.x0 ? 1 : -1;
  } else if (b.gt < BT_T[5]) { b.x = b.vx0; b.y = b.vy0; b.z = zGrab; }
  else if (b.gt < BT_T[8]) { const q = (b.gt - BT_T[5]) / (BT_T[8] - BT_T[5]); b.x = b.vx0 + b.face * 0.15 * q; b.y = b.vy0 - 0.2 * q; b.z = zGrab + 34 * q * q; }
  else {
    if (!b.sayV) { b.sayV = true; floater(b.x, b.y - 3, 'А надо было шапку покрепче…', '#ffc0c0'); }
    b.x += b.face * 1.7 * dt; b.y -= 0.6 * dt; b.z += 9 * dt;
    b.valpha = Math.max(0, 1 - (b.gt - BT_T[8] - 1.2) / 2.2);
  }
  if (b.gt > BT_T[4]) b.ph += dt * 6;                                    // тяжёлые взмахи (общий ph крутится в batsTick)
  if (b.gt > BT_T[4]) grabScream(b, b.x, b.y - 2.6, dt);
  return b.gt > 8 || b.x < -4 || b.y < -6 || b.x > MAP_W + 4;
}

// крылатый силуэт мыши в масштабе S
function drawBatShape(c, x, y, S, w, up, tilt, tal, k, dir) {
  c.save(); c.translate(x, y); c.rotate(tilt * dir); c.scale(S, S);
  c.fillStyle = '#16121c';
  for (const s of [-1, 1]) {
    c.beginPath(); c.moveTo(s * 1, 0);
    c.lineTo(s * w, -2 - up);
    c.lineTo(s * (w - 1.8), 1 - up * 0.4);
    c.lineTo(s * (w - 3.4), 0.4);
    c.lineTo(s * (w - 5), 2.2);
    c.closePath(); c.fill();
    if (S > 1.4) { c.strokeStyle = '#3a3050'; c.lineWidth = 0.3; c.beginPath(); c.moveTo(s * 1, 0); c.lineTo(s * (w - 1.8), 1 - up * 0.4); c.moveTo(s * 1, 0); c.lineTo(s * (w - 3.4), 0.4); c.stroke(); }
  }
  if (tal > 0) {                                                         // задние лапы с крючками-когтями
    c.strokeStyle = '#16121c'; c.lineWidth = 0.75;
    for (const s of [-1, 1]) {
      const ty = 2 + 2.6 * tal, tx = s * (0.9 + (1 - k) * 1.1);
      c.beginPath(); c.moveTo(s * 0.7, 1.4); c.lineTo(tx, ty); c.lineTo(tx - s * (0.2 + k * 0.8), ty + 0.9 + (1 - k) * 0.4); c.stroke();
    }
  }
  c.fillStyle = '#16121c';
  c.fillRect(-1, -1, 2, 3); c.fillRect(-1, -2.6, 2, 1.8);
  c.fillRect(-1.4, -3.6, 0.8, 1.2); c.fillRect(0.6, -3.6, 0.8, 1.2);
  c.fillStyle = '#ff8060'; c.fillRect(-0.8, -2.2, 0.5, 0.5); c.fillRect(0.3, -2.2, 0.5, 0.5);
  if (S > 1.8) { c.fillStyle = '#e8e0d0'; c.fillRect(-0.7, -1, 0.35, 0.7); c.fillRect(0.35, -1, 0.35, 0.7); }   // клыки
  c.restore();
}

function drawBatGrab(c, b) {
  const gi = btGrabIndex(b), p = btPoseAt(gi), v = b.vsnap;
  const px = Math.round(b.x * TILE), py = Math.round(b.y * TILE - b.z), dir = b.face < 0 ? -1 : 1;
  const wob = gi >= 9 ? 0 : 0;
  c.fillStyle = 'rgba(10,8,4,0.2)'; c.beginPath(); c.ellipse(px, b.y * TILE + 2, 4 * Math.min(2, p.S), 1.2 * p.S, 0, 0, 7); c.fill();
  const hold = gi >= 5;
  const pvx = hold ? px : b.vx0 * TILE, pvy = hold ? py + btTalonY(p) + 9 : b.vy0 * TILE + 6 - 14;
  // мышь за гномом: гном под лапами
  if (v && (b.valpha === undefined || b.valpha > 0.01)) {
    c.save(); c.globalAlpha *= b.valpha === undefined ? 1 : b.valpha;
    drawGrabbed(c, v, pvx + wob, pvy, hold ? Math.sin(Game.time * 5 + v.id) * 0.1 : 0, hold);
    c.restore();
  }
  drawBatShape(c, px, py, p.S, p.w, p.up, p.tilt, p.tal, p.k, dir);
  if (hold && v) {                                                       // когти на плечах (пальцы поверх гнома)
    c.save(); c.globalAlpha *= b.valpha === undefined ? 1 : b.valpha;
    drawGrip(c, pvx - 5, pvy - 9, 1, p.k, BT_PAL, 0.55); drawGrip(c, pvx + 5, pvy - 9, -1, p.k, BT_PAL, 0.55);
    c.restore();
  } else if (v && gi >= 3) {
    c.fillStyle = '#ff6040'; c.font = 'bold 9px serif'; c.fillText('!', Math.round(b.vx0 * TILE) - 1, Math.round(b.vy0 * TILE) - 28);
  }
}

// ====================== СОВА ======================
// С третьей ночи сова с крыши высматривает добычу — гнома или зверя: пикирует, вцепляется когтями, бьёт крыльями и уносит в лес.
const OW_T = [0.35, 0.7, 1.0, 1.25, 1.45, 1.65, 2.0, 2.4, 3.0];
// spr: perch — сидячий спрайт, иначе кадр полёта fr (0 вверх, 1 ровно, 2 вниз); S — размер, tilt — наклон носом вниз, tal — выпуск лап, k — сжатие когтей
const OW_POSE = [
  { spr: 'perch', S: 1.1, tilt: 0, tal: 0, k: 0, nm: 'высмотрела' },
  { fr: 0, S: 1.1, tilt: -0.1, tal: 0, k: 0, nm: 'расправила крылья' },
  { fr: 1, S: 1.2, tilt: 0.8, tal: 0, k: 0, nm: 'пикирует' },
  { fr: 1, S: 1.3, tilt: 0.4, tal: 0.6, k: 0, nm: 'тормозит' },
  { fr: 0, S: 1.4, tilt: 0.1, tal: 1, k: 0, nm: 'когти вперёд' },
  { fr: 0, S: 1.4, tilt: 0, tal: 1, k: 1, nm: 'вцепилась' },
  { fr: 2, S: 1.4, tilt: 0, tal: 1, k: 1, nm: 'взмах, отрыв' },
  { fr: 0, S: 1.4, tilt: 0, tal: 1, k: 1, nm: 'вверх' },
  { fr: 2, S: 1.4, tilt: -0.05, tal: 1, k: 1, nm: 'набирает высоту' },
];
const OW_CARRY = [[1, 0.08], [0, 0], [2, -0.08], [0, 0]];
function owPoseAt(i) {
  if (i < 9) return OW_POSE[i];
  const q = OW_CARRY[(i - 9) & 3];
  return { fr: q[0], S: 1.4, tilt: q[1], tal: 1, k: 1, nm: 'уносит ' + (i - 8) };
}
function owGrabIndex(o) {
  if (o._gi !== undefined) return o._gi;
  const i = grabIdx(o.gt || 0, OW_T);
  return i < 9 ? i : 9 + (Math.floor((o.gt || 0) * 8) & 3);
}
const owTalonY = p => 5.5 * p.S * (0.4 + 0.6 * p.tal);
const OW_PAL = { out: '#2a1a0c', fill: '#e8d090', hi: '#fffbe0' };

function owlCanTake(o, dt) {
  o.scanT = (o.scanT || 0) - dt;
  if (o.scanT > 0) return null;
  o.scanT = 1;
  if (nightIndex() + 1 < 3 || !isNightNow() || (o.grabCD || 0) > Game.time || Math.random() > 0.08) return null;
  const c = [];
  for (const u of Game.units) {
    if (u.inside || u.dead || u.hero || !isPerson(u) || u.type === 'carter') continue;
    if (Math.hypot(u.x * TILE - o.x, u.y * TILE - o.y) > 9 * TILE || nearBonfire(u.x, u.y, BONFIRE_SAFE)) continue;
    c.push({ u });
  }
  for (const a of Game.animals || []) if (!a.dead && Math.hypot(a.x * TILE - o.x, a.y * TILE - o.y) < 9 * TILE && !nearBonfire(a.x, a.y, BONFIRE_SAFE)) c.push({ a });
  return c.length ? c[(Math.random() * c.length) | 0] : null;
}

function owlTakes(o, p) {
  o.state = 'grab'; o.gt = 0; o.x0 = o.x; o.y0 = o.y; o.grabCD = Game.time + 150; o.item = null; o.hunt = null;
  o.scream = 0; o.sayV = false; o.vsnap = null; o.pkind = null; o.valpha = 1;
  if (p.u) {
    const u = p.u;
    o.vsnap = snapVictim(u); o.vx0 = u.x; o.vy0 = u.y;
    toast(`Сова унесла в лес: ${UNIT_TYPES[u.type].name}`);
    logEvent('owl', `Сова унесла в лес: ${UNIT_TYPES[u.type].name}`, u.x, u.y);
    floater(u.x, u.y - 1.2, '!', '#ff6040');
    removeUnit(u);
  } else {
    const a = p.a, nm = ANIMALS[a.kind] ? ANIMALS[a.kind].name.toLowerCase() : a.kind;
    o.pkind = a.kind; o.pface = a.face; o.vx0 = a.x; o.vy0 = a.y;
    toast(`Сова унесла в лес: ${nm}`);
    logEvent('owl', `Сова унесла в лес: ${nm}`, a.x, a.y);
    removeAnimal(a);
  }
  o.face = o.vx0 * TILE >= o.x ? 1 : -1;
  o.fdir = o.x0 > MAP_W * TILE / 2 ? 1 : -1;
  sfxAt('squeak', o.x, o.y, 1.2);
}

// когда сова скрылась из виду, она снова «в лесу» (state away)
function owlGrabTick(o, dt) {
  o.gt += dt;
  const p5 = owPoseAt(5), gy = o.vy0 * TILE + 6, hang = o.vsnap ? 14 : 8;
  const bx = o.vx0 * TILE, by = (gy - hang) - 9 - owTalonY(p5);          // тело при хвате: когти на плечах
  const T4 = OW_T[4];
  if (o.gt < T4) {
    const q = smooth01(o.gt / T4);
    o.x = o.x0 + (bx - o.x0) * q; o.y = o.y0 + (by - o.y0) * q - Math.sin(q * Math.PI) * 14;
    o.face = bx >= o.x0 ? 1 : -1;
  } else if (o.gt < OW_T[5]) { o.x = bx; o.y = by; }
  else if (o.gt < OW_T[8]) { const q = (o.gt - OW_T[5]) / (OW_T[8] - OW_T[5]); o.x = bx + o.fdir * 6 * q; o.y = by - 26 * q * q; o.face = o.fdir; }
  else {
    if (!o.sayV) { o.sayV = true; floater(o.x / TILE, o.y / TILE - 1.4, 'У-ху-у…', '#e8e0c8'); }
    o.x += o.fdir * 30 * dt; o.y -= 22 * dt; o.valpha = Math.max(0, 1 - (o.gt - OW_T[8] - 1.2) / 2);
    o.face = o.fdir;
  }
  o.ph += dt;
  if (o.vsnap && o.gt > OW_T[3]) grabScream(o, o.x / TILE, o.y / TILE - 1.6, dt);
  if (o.gt > 8) { o.state = 'away'; o.t = 25 + Math.random() * 20; o.vsnap = null; o.pkind = null; o.valpha = 1; o.from = [o.x, o.y]; o.to = null; }
}

function drawOwlGrab(c, o) {
  const gi = owGrabIndex(o), p = owPoseAt(gi), dir = o.face < 0 ? -1 : 1, hang = o.vsnap ? 14 : 8;
  const hold = gi >= 5, al = o.valpha === undefined ? 1 : o.valpha, tal = owTalonY(p);
  const gx = o.vx0 * TILE, gy = o.vy0 * TILE + 6;
  const pvx = hold ? o.x : gx, py2 = hold ? o.y + tal + 9 : gy - hang;
  c.save(); c.globalAlpha *= al;
  c.fillStyle = 'rgba(10,8,4,0.2)'; c.beginPath(); c.ellipse(hold ? o.x : gx, gy, 8, 2, 0, 0, 7); c.fill();
  if (o.vsnap) drawGrabbed(c, o.vsnap, pvx, py2, hold ? Math.sin(Game.time * 5 + o.vsnap.id) * 0.1 : 0, hold);
  else if (o.pkind) { c.save(); c.translate(pvx, py2 + 8); c.scale(0.8, 0.8); drawCreatureAt(c, o.pkind, 0, 0, o.pface || 1, hold, Game.time * 6, null); c.restore(); }
  c.imageSmoothingEnabled = true;
  c.save(); c.translate(o.x, o.y); c.rotate(p.tilt * dir); if (dir < 0) c.scale(-1, 1);
  if (p.spr === 'perch') c.drawImage(owlSprite('perch', 0, false, 0), -OWL_FX * p.S, -OWL_FY * p.S + 6, OWL_W * p.S, OWL_H * p.S);
  else c.drawImage(owlSprite('fly', 0, 0, p.fr), -OWLF_FX * p.S, -OWLF_FY * p.S, OWLF_W * p.S, OWLF_H * p.S);
  c.restore();
  c.imageSmoothingEnabled = false;
  if (hold) { drawGrip(c, pvx - 4, py2 - 9, 1, p.k, OW_PAL, 0.6); drawGrip(c, pvx + 4, py2 - 9, -1, p.k, OW_PAL, 0.6); }
  else if (p.tal > 0) { c.strokeStyle = '#e8d090'; c.lineWidth = 1; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(o.x + s * 1.5, o.y + 3 * p.S); c.lineTo(o.x + s * 2.5, o.y + tal); c.stroke(); } }
  if (!hold && o.vsnap && gi >= 2) { c.fillStyle = '#ff6040'; c.font = 'bold 9px serif'; c.fillText('!', Math.round(gx) - 1, Math.round(gy) - 32); }
  c.restore();
}
