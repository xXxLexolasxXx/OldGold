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
    if (nearBonfire(land[0], land[1], BONFIRE_NOSPAWN)) continue;
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

// Рука водяного при захвате: 9 кадров g0…g8 (замах струёй, бросок, тянется, обхватывает, сжимает, подъём, поднял, разворот)
// кисть [x вперёд, y] в системе тела (до масштаба по высоте); дальше — несёт (кадры 9…12)
const WATER_ARM = [[3, -53], [15, -46], [23, -33], [27, -22], [27, -19], [26, -25], [25, -32], [22, -38], [20, -36]];
function waterGrabHand(e) {
  const gi = grabIdx(e.t);
  if (gi < 9) return WATER_ARM[gi];
  return [20, -36 + Math.sin(e.phase * 0.9) * 1.2];
}
function waterEntHand(e) {
  const g = waterGeom(e);
  if (e.state === 'drag') { const h = waterGrabHand(e); return { x: g.bx + e.face * h[0], y: g.by + h[1] * g.H / 40 }; }
  return { x: g.bx + e.face * 13, y: g.by - g.H * 0.74 };
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
  if (!blink) { c.fillStyle = '#b8ffc8'; c.fillRect(px - 4, py - 0.8, 2, 1.8); c.fillRect(px + 2, py - 0.8, 2, 1.8); c.fillStyle = '#ffffff'; c.fillRect(px - 3.6, py - 0.6, 0.8, 0.8); c.fillRect(px + 2.4, py - 0.6, 0.8, 0.8); }
  c.restore();
}

// Водяной — грозный водяной великан: плотное тело из тёмной воды с чёткой обводкой, текущие
// внутри струи, широкая клыкастая пасть, горящие злые глаза, гребень из острых водяных шипов,
// две мощные руки с когтями. Вместо ног — водоворот-подол, на ходу он тянется шлейфом.
function drawWaterEnt(c, e) {
  const { bx, by, H } = waterGeom(e), k = e.k, t = Game.time;
  if (k < 0.3) drawWaterEyes(c, e, e.alpha * (1 - k / 0.3) * Math.min(1, nightAmt() * 4));   // спящий в озере: глаза над водой
  const rage = e.state === 'fight' || e.state === 'smash' || e.state === 'drag';
  const sp = rage ? 5.5 : e.moving ? 4.4 : 2.6;
  const OUT = '#0a2744';
  c.save();
  c.globalAlpha = e.alpha;
  // лужа и круги
  c.fillStyle = 'rgba(30,95,150,0.5)'; c.beginPath(); c.ellipse(bx, by, 19 * k + 3, 5.8, 0, 0, 7); c.fill();
  c.strokeStyle = 'rgba(210,245,255,0.6)'; c.lineWidth = 0.8;
  for (let r = 0; r < 3; r++) { const q = (t * 0.9 + r * 0.33 + e.i * 0.1) % 1; c.globalAlpha = e.alpha * (1 - q) * 0.85; c.beginPath(); c.ellipse(bx, by, 9 + q * 17, 2.6 + q * 4.6, 0, 0, 7); c.stroke(); }
  c.globalAlpha = e.alpha;
  if (k > 0.02 && H > 1) {
    const f = e.face < 0 ? -1 : 1;
    const atk = e.atk ? t - e.atk : 9;
    c.translate(bx, by); c.scale(f, H / 40);
    const lean = e.moving ? 2.2 : 0, wob = (a, b) => Math.sin(t * sp + a) * b;
    c.lineJoin = 'round'; c.lineCap = 'round';
    const bodyG = c.createLinearGradient(0, -44, 0, 2);
    bodyG.addColorStop(0, '#d6f6ff'); bodyG.addColorStop(0.28, '#7cc8ee'); bodyG.addColorStop(0.7, '#2f86c2'); bodyG.addColorStop(1, '#154f86');
    // руки: толстая тёмная обводка, внутри светлая вода, на конце когти
    const arm = (sx, sy, hx, hy, back) => {
      const ex = (sx + hx) / 2 + (back ? -4 : 4), ey = (sy + hy) / 2 + 6;
      for (const [col, w] of [[OUT, 9.4], [back ? '#2a78b4' : '#4aa6dc', 6.6]]) {
        c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(ex, ey, hx, hy); c.stroke();
      }
      c.strokeStyle = 'rgba(235,252,255,0.75)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(sx - 1, sy - 1); c.quadraticCurveTo(ex - 1.4, ey - 1, hx - 1, hy - 1); c.stroke();
      // когти: три острых шипа веером в сторону кисти
      const ang = Math.atan2(hy - ey, hx - ex);
      for (const da of [-0.7, 0, 0.7]) {
        const a = ang + da, px1 = Math.cos(a + 1.57), py1 = Math.sin(a + 1.57);
        c.fillStyle = OUT; c.beginPath(); c.moveTo(hx + px1 * 2.6, hy + py1 * 2.6); c.lineTo(hx + Math.cos(a) * 7.5, hy + Math.sin(a) * 7.5); c.lineTo(hx - px1 * 2.6, hy - py1 * 2.6); c.fill();
        c.fillStyle = '#e8fbff'; c.beginPath(); c.moveTo(hx + px1 * 1.5, hy + py1 * 1.5); c.lineTo(hx + Math.cos(a) * 6.2, hy + Math.sin(a) * 6.2); c.lineTo(hx - px1 * 1.5, hy - py1 * 1.5); c.fill();
      }
      for (let j = 0; j < 3; j++) { const q = (t * 2.2 + j * 0.33 + sx) % 1; c.fillStyle = `rgba(215,245,255,${0.9 * (1 - q)})`; c.beginPath(); c.arc(hx + Math.sin(j * 3 + t * 5) * 2.4, hy + 3 + q * 11, 1.3 - q * 0.6, 0, 7); c.fill(); }
    };
    // цели рук в локальных координатах (вперёд = +x)
    const swing = e.moving ? Math.sin(e.phase * 0.9) : Math.sin(t * 1.6 + e.i) * 0.4;
    let fh = [19, -8 + swing * 3], bh = [-19, -9 - swing * 3];
    if (e.moving) { fh = [17 + swing * 5, -10 + swing * 4]; bh = [-17 - swing * 5, -10 - swing * 4]; }
    if (e.state === 'fight' || e.state === 'smash') {
      if (atk < 0.35) { fh = [9, -50]; bh = [-12, -40]; } else if (atk < 0.8) { fh = [24, -2]; bh = [-14, -16]; }
      else { fh = [20, -22 + wob(0, 3)]; bh = [-17, -14 + wob(2, 3)]; }
    }
    if (e.state === 'drag') fh = waterGrabHand(e);
    arm(-11, -28, bh[0], bh[1], true);
    // тело: плотная масса воды, подол из волн
    c.beginPath();
    c.moveTo(-14, 0);
    for (let i = 0; i <= 8; i++) c.lineTo(-14 + i * 3.5, Math.sin(t * sp * 1.1 + i * 1.3) * 1.6 - (i % 2 ? 2.4 : 0) - lean * (i / 8));
    c.quadraticCurveTo(17 + wob(1, 1.2), -10, 14 + lean, -21);
    c.quadraticCurveTo(18 + wob(2, 1.2), -28, 13, -32);
    c.quadraticCurveTo(12, -41, 2, -42);
    c.quadraticCurveTo(-10, -42, -12, -32);
    c.quadraticCurveTo(-18 + wob(3, 1.2), -28, -14, -21);
    c.quadraticCurveTo(-18 + wob(4, 1.2), -10, -14, 0);
    c.closePath();
    c.fillStyle = bodyG; c.fill();
    c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
    // течения внутри: тёмные и светлые струи снизу вверх
    c.save(); c.clip();
    for (let s = 0; s < 5; s++) {
      const x0 = -10 + s * 5;
      c.strokeStyle = s % 2 ? 'rgba(15,70,130,0.55)' : 'rgba(200,245,255,0.5)'; c.lineWidth = 1.6;
      c.beginPath();
      for (let y = 0; y >= -38; y -= 3) { const x = x0 + Math.sin(y * 0.28 - t * sp + s * 1.7) * 2.6; y === 0 ? c.moveTo(x, y) : c.lineTo(x, y); }
      c.stroke();
    }
    c.fillStyle = 'rgba(240,253,255,0.8)';
    for (let j = 0; j < 8; j++) { const q = (t * (0.5 + (j % 3) * 0.13) + j * 0.29 + e.i * 0.05) % 1; c.beginPath(); c.arc(-9 + (j * 5.3) % 18 + Math.sin(q * 9 + j) * 1.4, -q * 38, 0.7 + (j % 3) * 0.4, 0, 7); c.fill(); }
    c.restore();
    c.strokeStyle = 'rgba(245,253,255,0.85)'; c.lineWidth = 1.2;                         // блик вдоль левой кромки
    c.beginPath(); c.moveTo(-12, -26); c.quadraticCurveTo(-14, -16, -11, -6); c.stroke();
    for (let i = 0; i < 7; i++) { c.fillStyle = 'rgba(240,253,255,0.9)'; c.beginPath(); c.arc(-12 + i * 4 + Math.sin(t * 3 + i) * 0.8, -1 + Math.sin(t * sp * 1.1 + i * 1.3) * 1.5, 1.5, 0, 7); c.fill(); }   // пена по подолу
    // гребень из шипов
    c.fillStyle = OUT;
    for (const [x, h, w] of [[-7, 9, 3.4], [0, 12, 4], [7, 8, 3.2], [-3, 6, 2.4], [4, 5, 2.4]]) {
      const hh = h + wob(x, 1.6);
      c.beginPath(); c.moveTo(x - w, -39); c.lineTo(x + wob(x * 2, 1), -41 - hh); c.lineTo(x + w, -39); c.fill();
    }
    c.fillStyle = '#c4f2ff';
    for (const [x, h, w] of [[-7, 9, 2], [0, 12, 2.6], [7, 8, 2]]) { c.beginPath(); c.moveTo(x - w, -39.4); c.lineTo(x, -40 - h * 0.85); c.lineTo(x + w, -39.4); c.fill(); }
    // лицо: злые светящиеся глаза и клыкастая пасть
    const eyes = [[-3.4, -35], [5.4, -35.6]];
    c.globalCompositeOperation = 'lighter';
    for (const [ex, ey] of eyes) { const gl = c.createRadialGradient(ex, ey, 0, ex, ey, 7); gl.addColorStop(0, 'rgba(150,255,170,0.55)'); gl.addColorStop(1, 'rgba(150,255,170,0)'); c.fillStyle = gl; c.beginPath(); c.arc(ex, ey, 7, 0, 7); c.fill(); }
    c.globalCompositeOperation = 'source-over';
    eyes.forEach(([ex, ey], ei) => {
      const sl = ei ? 1 : -1;
      c.fillStyle = OUT; c.beginPath(); c.moveTo(ex - 3.6, ey - 0.4 + sl * 1.6); c.lineTo(ex + 3.6, ey - 0.4 - sl * 1.6); c.lineTo(ex + 3.2, ey + 2.4); c.lineTo(ex - 3.2, ey + 2.4); c.closePath(); c.fill();   // сердитая бровь
      c.fillStyle = rage ? '#ffffff' : '#c4ffd0'; c.beginPath(); c.moveTo(ex - 3, ey + 0.6 + sl * 0.8); c.lineTo(ex + 3, ey + 0.6 - sl * 0.8); c.lineTo(ex + 2.4, ey + 2); c.lineTo(ex - 2.4, ey + 2); c.closePath(); c.fill();
      c.fillStyle = '#05182c'; c.fillRect(ex - 0.4, ey + 0.6, 0.9, 1.4);                          // щель зрачка
    });
    const open = rage ? 7 : 3.4 + Math.sin(t * 2.4 + e.i) * 0.8, my = -28.5, mw = rage ? 9 : 7.5;
    c.fillStyle = '#04141f'; c.beginPath();
    c.moveTo(1 - mw, my); for (let i = 0; i <= 6; i++) c.lineTo(1 - mw + i * mw / 3, my + (i % 2 ? 0 : 1.2));
    for (let i = 6; i >= 0; i--) c.lineTo(1 - mw + i * mw / 3, my + open + (i % 2 ? 1.2 : 0));
    c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 1; c.stroke();
    c.fillStyle = '#f2fdff';
    for (let i = 0; i < 6; i++) { const x = 1 - mw + 1.2 + i * (mw * 2 - 2.4) / 5; c.beginPath(); c.moveTo(x - 1, my + 0.4); c.lineTo(x, my + 3.2); c.lineTo(x + 1, my + 0.4); c.fill(); if (open > 4) { c.beginPath(); c.moveTo(x - 0.9, my + open); c.lineTo(x, my + open - 2.6); c.lineTo(x + 0.9, my + open); c.fill(); } }
    if (rage) { c.fillStyle = 'rgba(190,240,255,0.8)'; c.beginPath(); c.moveTo(0, my + open); c.lineTo(0.8, my + open + 5 + ((t * 6) % 1) * 2); c.lineTo(1.6, my + open); c.fill(); }
    arm(12, -29, fh[0], fh[1], false);
    // шлейф брызг на ходу
    if (e.moving) for (let j = 0; j < 5; j++) { const q = (t * 2.4 + j * 0.2) % 1; c.fillStyle = `rgba(215,245,255,${0.85 * (1 - q)})`; c.beginPath(); c.arc(-12 - q * 12, -2 - Math.sin(q * 3 + j) * 4 - q * 5, 1.6 - q, 0, 7); c.fill(); }
  }
  c.restore();
  if (e.state === 'drag' && (e.victim || e.vsnap)) drawVictim(c, e);
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
  if (!nearBonfire(e.x, e.y, BONFIRE_SAFE)) return false;
  if (e.state === 'sleep') { e.state = 'done'; if (e.o) { e.o.awake = false; e.o.res = false; } return true; }
  if (e.state === 'fight') return false;                    // уж ввязалась — не отступает
  if (!e.scared) { e.scared = true; floater(e.x, e.y - 2, 'Огонь!', '#ffb060'); sfxAt('hic', e.x * TILE, e.y * TILE, 0.6); }
  e.target = null; e.goal = null; e.state = 'return'; e.t = 0;
  return false;
}

// ---------- Удары по зданиям ----------

function pickSmashTarget(e) {
  let best = null, bd = 8 + 2 * (Math.min(4, nightDiff()) - 1);   // с каждой ночью высматривает здания дальше
  for (const b of Game.buildings) {
    if (b.state !== 'done' || b.type === 'bonfire' || b.removed) continue;
    if (nearBonfire(b.x + b.w / 2, b.y + b.h / 2, BONFIRE_SAFE)) continue;
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
  const rate = (e.rock ? 0.1 : e.water ? 0.06 : 0.08) * (0.75 + 0.25 * Math.min(4, nightDiff()));   // поздние ночи бьют сильнее
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

// Чинит повреждённое здание любой свободный гном
function* repairGen(u, b) {
  u.repairBusy = b;
  try { yield* repairBody(u, b); } finally { if (u.repairBusy === b) u.repairBusy = null; }
}
function* repairBody(u, b) {
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
// С вечера две-три мыши (не больше трёх — чтобы не мельтешили) кружат над деревней; пролетевшая у самой головы гнома пугает его
// ненадолго (взмах руками, возглас). На рассвете улетают. Прогнать мышь можно (haunts.js): она улетает, а не гибнет.

function batsTick(dt) {
  const bats = Game.bats || (Game.bats = []);
  const dark = nightAmt();
  const cx = Game.units.length ? Game.units.reduce((s, u) => s + u.x, 0) / Game.units.length : MAP_W / 2;
  const cy = Game.units.length ? Game.units.reduce((s, u) => s + u.y, 0) / Game.units.length : MAP_H / 2;
  // прилетают с вечера
  // (гнёзда, сезон и глубина ночи — в haunts.js; прогнанная стая возвращается не сразу)
  if (dark > 0.3 && bats.length < batCap() && batOpen() && Math.random() < dt * batRate() && startOpen('bats')) {
    const sp = batSpawnPoint(cx, cy);
    bats.push({ x: sp.x, y: sp.y, z: 28 + Math.random() * 20, tx: cx, ty: cy, ph: Math.random() * 9, spd: 2.4 + Math.random() * 1.2, retarget: 0, leave: false, cd: 0 });
  }
  for (let i = bats.length - 1; i >= 0; i--) {
    const b = bats[i];
    b.ph += dt * 16; b.retarget -= dt;
    if (b.state === 'grab') { if (batGrabTick(b, dt)) bats.splice(i, 1); continue; }     // уносит гнома
    if (dark < 0.12) b.leave = true;
    if (b.leave) { b.tx = b.x + (b.x > cx ? 30 : -30); b.ty = b.y + (b.y > cy ? 20 : -20); if (b.x < -3 || b.y < -3 || b.x > MAP_W + 3 || b.y > MAP_H + 3) { bats.splice(i, 1); continue; } }
    else if (b.retarget <= 0 || Math.hypot(b.tx - b.x, b.ty - b.y) < 1) {
      // новая точка кружения: у жилья или у людей
      const u = Game.units.length ? Game.units[(Math.random() * Game.units.length) | 0] : null;
      b.tx = (u ? u.x : cx) + (Math.random() - 0.5) * 8; b.ty = (u ? u.y : cy) + (Math.random() - 0.5) * 6; b.retarget = 2 + Math.random() * 3;
    }
    if (!b.leave) batAvoidLight(b);                                       // свет костра и фонарей мышь облетает
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
          if (batSafe(u)) continue;                                       // у костра, под фонарём, с фонарём в руке — не тронет
          u.batCD = Game.time + 25;
          if (batShooTry(b, u)) break;                                   // страж или смелый гном гонит мышь сам
          if (batCanTake(b, u)) { batTakes(b, u); break; }               // редко: пикирует и уносит одинокого гнома
          gesture(u, 'panic', 1.3, b.x);
          batHint();
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
    if (b.state === 'grab') { drawBatGrab(c, b); continue; }
    const px = Math.round(b.x * TILE), py = Math.round(b.y * TILE - b.z);
    if (typeof onScreen === 'function' && !onScreen(px, py, 48)) continue;
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
