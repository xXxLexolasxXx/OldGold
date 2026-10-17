'use strict';
// Погода. Время от времени идёт дождь (днём и ночью): плавно начинается и стихает,
// небо темнеет, капают капли, шумит ливень. Гномы раскрывают зонтики цвета своей
// профессии, бегут на треть быстрее и чаще сталкиваются. На мокрой земле можно
// поскользнуться: полёт лицом вперёд, скольжение на животе, лежит, встаёт и закуривает,
// глядя в небо. А в сильный дождь бьёт молния: в землю или в существо — гнома,
// курицу, ходячее дерево, ходячий камень. Попавшего поджигает: гном бегает кругами,
// падает и катается по спине, пока не потушит огонь; курица может сгореть, дерево
// горит и валится, камень раскалывается.

const WX = { k: 0, target: 0, nextRain: 0, rainEnd: 0, nextBolt: 0, last: -1, ready: false,
  bolt: null, scorch: [], fires: [], snd: null, fxT: 0, sfxT: 0, rainDrops: 0 };

const wrnd = (a, b) => a + Math.random() * (b - a);
const frac01 = (s) => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// сила дождя 0..1
function rainAmt() { return WX.k; }
function isRaining() { return WX.k > 0.35; }

function weatherReset() {
  Object.assign(WX, { k: 0, target: 0, nextRain: Game.time + wrnd(100, 220), rainEnd: 0, nextBolt: 0, bolt: null, scorch: [], fires: [], ready: true });
}

function rainStart(len = wrnd(70, 140)) {
  if (!WX.ready) weatherReset();
  WX.target = 1; WX.rainEnd = Game.time + len;
  logEvent('weather', 'Начался дождь');
  if (Game.time - (WX.toastT || -99) > 60) { WX.toastT = Game.time; toast('Пошёл дождь: гномы раскрыли зонтики. Под ногами скользко!'); }
}

function weatherTick(dt) {
  if (!WX.ready || Game.time < WX.last - 0.5) weatherReset();
  WX.last = Game.time;
  if (WX.target === 0 && Game.time >= WX.nextRain) rainStart();
  else if (WX.target === 1 && Game.time >= WX.rainEnd) {
    WX.target = 0; WX.nextRain = Game.time + wrnd(150, 360);
    logEvent('weather', 'Дождь стихает');
  }
  const was = WX.k;
  WX.k = Math.max(0, Math.min(1, WX.k + Math.sign(WX.target - WX.k) * dt / (WX.target ? 10 : 14)));
  if (was > 0 && WX.k === 0) logEvent('weather', 'Дождь кончился');
  rainSound();
  if (WX.bolt && Game.time - WX.bolt.t0 > 1.2) WX.bolt = null;
  // молнии — только в разгар ливня
  if (WX.k > 0.6) {
    if (!WX.nextBolt) WX.nextBolt = Game.time + wrnd(5, 12);
    if (Game.time >= WX.nextBolt) { WX.nextBolt = Game.time + wrnd(9, 22); lightningStrike(); }
  } else WX.nextBolt = 0;
  if (WX.k > 0.2 || WX.target) rainSlipTick(dt);
  fireTick(dt);
  if (WX.scorch.length) WX.scorch = WX.scorch.filter(s => Game.time - s.t0 < 150);
}

// ---------- Гном под дождём ----------

function umbrellaCol(u) {
  const c = (OUTFIT[u.type] || OUTFIT.serf).cap;
  if (c === 'serf') return lookOf(u).serfCap;
  if (c === 'baker') return '#f4f0e6';
  if (c === 'wizard') return '#6a3a9a';
  return c;
}

function drawUmbrella(c, u, px, py, face, pose, lying) {
  const open = Math.max(0, Math.min(1, (WX.k - 0.1) / 0.2));
  if (open <= 0 || lying || u.inside || pose === 'work' || u.anim === 'burn' || (u.burn && u.burn.stage)) return;
  const side = face || 1, col = umbrellaCol(u), dark = shade(col, -0.5), light = shade(col, 0.3);
  const sway = (pose === 'walk' ? Math.sin(u.walkPhase * 0.55) * 0.8 : 0);
  const cx = px + side * 2 + sway, by = py - 38 + (1 - open) * 8, rx = 11.5 * open, ry = 6 * open;
  const hx = px + side * 5;
  // ручка
  c.strokeStyle = '#2a1a0e'; c.lineWidth = 0.9; c.lineCap = 'round';
  c.beginPath(); c.moveTo(cx, by); c.lineTo(cx, by + 6); c.moveTo(hx, py - 17);
  c.lineTo(cx, by + 6); c.stroke();
  c.lineCap = 'butt';
  // купол с фестонами
  c.beginPath();
  c.moveTo(cx - rx, by);
  c.quadraticCurveTo(cx - rx * 0.9, by - ry * 1.9, cx, by - ry * 1.9);
  c.quadraticCurveTo(cx + rx * 0.9, by - ry * 1.9, cx + rx, by);
  const sc = 4;
  for (let k = 0; k < sc; k++) {
    const x1 = cx + rx - (k + 1) * rx * 2 / sc, xm = cx + rx - (k + 0.5) * rx * 2 / sc;
    c.quadraticCurveTo(xm, by + 2.2 * open, x1, by);
  }
  c.closePath();
  c.fillStyle = col; c.fill();
  c.strokeStyle = dark; c.lineWidth = 0.9; c.stroke();
  // спицы и блик
  c.strokeStyle = shade(col, -0.25); c.lineWidth = 0.5;
  c.beginPath();
  for (const t of [-0.55, 0, 0.55]) { c.moveTo(cx, by - ry * 1.85); c.lineTo(cx + rx * t * 1.7, by); }
  c.stroke();
  c.fillStyle = light; c.globalAlpha = 0.5;
  c.beginPath(); c.ellipse(cx - rx * 0.35, by - ry * 1.05, rx * 0.22, ry * 0.3, -0.5, 0, 7); c.fill();
  c.globalAlpha = 1;
  c.fillStyle = dark; c.fillRect(Math.round(cx) - 0.5, Math.round(by - ry * 1.9) - 2, 1, 2.2);
}

// Шанс скользнуть на мокрой земле — у тех, кто сейчас идёт
function rainSlipTick(dt) {
  WX.slipT = (WX.slipT || 0) + dt;
  if (WX.slipT < 0.5) return;
  WX.slipT = 0;
  if (WX.k < 0.45) return;
  for (const u of Game.units) {
    if (u.dead || u.inside || !isPerson(u) || u.type === 'carter' || u.brk) continue;
    const a = u.action;
    if (!(a && a.walk && a.path && a.path[a.i])) continue;
    if (Game.time < (u.slipCD || 0) || Math.random() > 0.0016 * WX.k) continue;
    slipUp(u);
    return;
  }
}

function slipUp(u) {
  const a = u.action;
  const nx = a.path[a.i][0] + 0.5 - u.x, ny = a.path[a.i][1] + 0.5 - u.y, d = Math.hypot(nx, ny);
  let dx = d > 0.05 ? nx / d : (u.face || 1), dy = d > 0.05 ? ny / d : 0;
  // вперёд на клетку, потом ещё на клетку — пока там можно стоять
  const step = (x, y) => {
    let L = 1;
    while (L > 0.15 && !isWalkable(Math.floor(x + dx * L), Math.floor(y + dy * L))) L -= 0.3;
    return Math.max(0, L);
  };
  const L1 = step(u.x, u.y), L2 = step(u.x + dx * L1, u.y + dy * L1);
  u.slipCD = Game.time + 60;
  if (Math.abs(dx) > 0.2) u.face = dx > 0 ? 1 : -1;
  lanternFall(u);
  startBreak(u, 'slip', null);
  u.proc = slipGen(u, [dx * L1, dy * L1], [dx * L2, dy * L2]);
  logEvent('weather', `${UNIT_TYPES[u.type].name} поскользнулся на мокрой земле и растянулся`, u.x, u.y);
}

function* slipGen(u, d1, d2) {
  u.brk.until = Game.time + 12;
  floater(u.x, u.y - 1, 'Ай!', '#e0f0ff');
  u.slip = { d: d1 };
  yield { wait: 0.45, anim: 'slipfly' };           // летит лицом вперёд
  u.x += d1[0]; u.y += d1[1];
  fxBurst(u.x * TILE, u.y * TILE + 4, 8, ['#9ab0c8', '#c8d8e8', '#7a8a9a'], 40, 24, 0.5, 2, 60);   // брызги
  u.slip = { d: d2 };
  yield { wait: 0.75, anim: 'slide' };             // скользит на животе
  u.x += d2[0]; u.y += d2[1];
  u.slip = null;
  yield { wait: 1.3, anim: 'slipLie' };            // лежит
  if (Math.random() < 0.6) floater(u.x, u.y - 1, ['Фу-у…', 'Мокро!', 'Ох…'][Math.floor(Math.random() * 3)], '#e0f0ff');
  yield { wait: 0.6, anim: 'getup' };              // поднимается
  u.face = u.face || 1; u.vdir = 'E';
  yield { wait: 4.5, anim: 'smokeup' };            // закуривает, глядя в небо
  if (Math.random() < 0.5) floater(u.x, u.y - 1, 'Хорошо пошло…', '#fff2a0');
}

// положение и поворот тела для особых поз (скольжение, горение)
function weatherPose(u) {
  const an = u.anim, a = u.action;
  if (!an) return null;
  const p = a && a.T ? 1 - Math.max(0, a.t) / a.T : 0, f = u.face || 1, Q = Math.PI / 2;
  const sl = u.slip ? u.slip.d : null;
  switch (an) {
    case 'slipfly': return { pose: 'idle', dx: sl[0] * TILE * p, dy: sl[1] * TILE * p, rot: f * p * Q * 0.95, lift: Math.sin(p * Math.PI) * 9, off: 0, lying: false };
    case 'slide': return { pose: 'idle', dx: sl[0] * TILE * p, dy: sl[1] * TILE * p, rot: f * Q, lift: 0, off: 2, lying: true, belly: true };
    case 'slipLie': return { pose: 'idle', dx: 0, dy: 0, rot: f * Q, lift: 0, off: 2, lying: true, belly: true };
    case 'getup': return { pose: 'idle', dx: 0, dy: 0, rot: f * Q * (1 - p * p), lift: Math.sin(p * Math.PI) * 2.5, off: 2 * (1 - p), lying: p < 0.4, belly: true };
    case 'smokeup': return { pose: 'smoke', dx: 0, dy: 0, rot: -0.17 * f, lift: 0, off: 0, lying: false };
    case 'burnfall': return { pose: 'idle', dx: 0, dy: 0, rot: -f * Q * p, lift: Math.sin(p * Math.PI) * 4, off: 2 * p, lying: p > 0.6 };
    // катится «колбаской»: лежит вдоль экрана и крутится вокруг своей оси (спина → живот → спина), понемногу уезжая вглубь
    case 'roll': { const ra = Game.time * 7.5 + u.id; return { pose: 'idle', dx: 0, dy: Math.sin(ra * 0.25) * 6, rot: f * Q, rollA: ra, lift: 0, off: 2, lying: true }; }
    case 'burnout': return { pose: 'idle', dx: 0, dy: 0, rot: -f * Q, lift: 0, off: 2, lying: true };
  }
  return null;
}

// ---------- Молния ----------

function lightningStrike() {
  const [vx0, vy0, vx1, vy1] = viewTiles();
  const onScreen = (x, y) => x > vx0 && x < vx1 && y > vy0 && y < vy1;
  const cands = [];
  const add = (kind, o, x, y) => { const w = onScreen(x, y) ? 4 : 1; for (let k = 0; k < w; k++) cands.push({ kind, o, x, y }); };
  for (const u of Game.units) if (!u.dead && !u.inside && isPerson(u) && u.type !== 'carter' && !(u.burn && u.burn.stage)) add('unit', u, u.x, u.y);
  for (const a of Game.animals) if (a.kind === 'chicken' && !a.dead && !a.burn) add('hen', a, a.x, a.y);
  for (const e of Game.ents || []) if (e.k > 0.5 && !e.burnT && ['walk', 'fight', 'return'].includes(e.state)) { add('ent', e, e.x, e.y); add('ent', e, e.x, e.y); }
  // каждая третья молния — просто в землю
  let t = Math.random() < 0.3 || !cands.length ? null : cands[(Math.random() * cands.length) | 0];
  if (!t) {
    // в землю: чаще на виду, иначе возле деревни
    let x, y;
    if (Math.random() < 0.7) { x = wrnd(vx0 + 1, vx1 - 1); y = wrnd(vy0 + 1, vy1 - 1); }
    else { const u = Game.units[(Math.random() * Game.units.length) | 0]; x = (u ? u.x : MAP_W / 2) + wrnd(-12, 12); y = (u ? u.y : MAP_H / 2) + wrnd(-12, 12); }
    x = Math.max(1, Math.min(MAP_W - 2, x)); y = Math.max(1, Math.min(MAP_H - 2, y));
    t = { kind: 'ground', x, y };
  }
  makeBolt(t.x * TILE, t.y * TILE + 2);
  switch (t.kind) {
    case 'unit': igniteUnit(t.o); break;
    case 'hen': igniteHen(t.o); break;
    case 'ent': strikeEnt(t.o); break;
    default: groundStrike(t.x, t.y);
  }
  // звук: гром запаздывает тем больше, чем дальше от центра экрана
  const cx = (vx0 + vx1) / 2, cy = (vy0 + vy1) / 2;
  sfxThunder(Math.min(1.6, 0.12 + Math.hypot(t.x - cx, t.y - cy) * 0.035));
}

function viewTiles() {
  const s = camScale(), W = R.canvas ? R.canvas.clientWidth : 800, H = R.canvas ? R.canvas.clientHeight : 600;
  return [R.cam.x / TILE, R.cam.y / TILE, (R.cam.x + W / s) / TILE, (R.cam.y + H / s) / TILE];
}

function makeBolt(x, y) {
  const top = R.cam.y - 40, pts = [[x + wrnd(-30, 30), top]];
  const n = 11;
  for (let k = 1; k < n; k++) {
    const q = k / n;
    pts.push([x + (pts[0][0] - x) * (1 - q) + wrnd(-16, 16) * (1 - q * 0.5), top + (y - top) * q]);
  }
  pts.push([x, y]);
  const br = [];
  for (let b = 0; b < 3; b++) {
    const i = 2 + ((Math.random() * (n - 4)) | 0), s = pts[i], dir = Math.random() < 0.5 ? -1 : 1, seg = [s];
    for (let k = 1; k <= 4; k++) seg.push([s[0] + dir * k * wrnd(8, 14), s[1] + k * wrnd(10, 18)]);
    br.push(seg);
  }
  WX.bolt = { t0: Game.time, wall: performance.now(), x, y, pts, br };
  // яркая вспышка в месте удара
  fxBurst(x, y, 16, ['#ffffff', '#cfe0ff', '#fff6a0'], 120, 60, 0.35, 1.6, 200);
}

function groundStrike(x, y) {
  addScorch(x, y, 1);
  fxBurst(x * TILE, y * TILE, 20, ['#6a5a44', '#8a7a60', '#3a3028'], 70, 70, 0.8, 2.6, 300);   // земля летит
  if (Math.random() < 0.6) WX.fires.push({ x, y, t0: Game.time, life: wrnd(3, 6) });
  floater(x, y - 0.6, 'Бабах!', '#cfe0ff');
  // кто стоит рядом — отлетает от удара
  for (const u of Game.units) {
    if (u.dead || u.inside || !isPerson(u) || u.type === 'carter') continue;
    if (Math.hypot(u.x - x, u.y - y) < 1.8) { sfxUnit(u, 'ouch'); knockBack(u, { x, y }); }
  }
  logEvent('weather', 'Молния ударила в землю', x, y);
}

function addScorch(x, y, r) {
  WX.scorch.push({ x, y, r, t0: Game.time, a: Math.random() * 3 });
  if (WX.scorch.length > 40) WX.scorch.shift();
}

// ---------- Поджог ----------

function igniteUnit(u) {
  if (u.brk) endBreak(u);
  const nm = UNIT_TYPES[u.type].name;
  dropLoad(u);
  lanternFall(u);
  startBreak(u, 'burn', null);
  u.burn = { stage: 'run', t0: Game.time };
  u.proc = burnGen(u);
  addScorch(u.x, u.y, 0.8);
  floater(u.x, u.y - 1.2, 'Горю!', '#ffb060');
  logEvent('weather', `Молния ударила в гнома: ${nm.toLowerCase()} загорелся`, u.x, u.y);
  toast(`Молния попала в гнома! ${nm} горит`);
}

function* burnGen(u) {
  u.brk.until = Game.time + 20;
  u.gest = 'panic'; u.gestUntil = Game.time + 30; u.gestFace = 1;
  u.panicUntil = Game.time + 30;
  // бегает кругами вокруг места удара
  const cx = Math.floor(u.x), cy = Math.floor(u.y);
  const ring = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1]];
  let said = 0;
  for (const [ox, oy] of ring) {
    const x = cx + ox, y = cy + oy;
    if (!isWalkable(x, y)) continue;
    yield { walk: [x, y], offroad: true };
    if (said++ % 3 === 1) floater(u.x, u.y - 1, ['А-а-а!', 'Горю!', 'Тушите!', 'Спасите!'][said % 4], '#ffd0b0');
  }
  u.panicUntil = 0; u.gest = ''; u.gestUntil = 0;
  u.burn.stage = 'fall';
  yield { wait: 0.5, anim: 'burnfall' };           // падает на спину
  u.burn.stage = 'roll';
  floater(u.x, u.y - 1, 'Катаюсь!', '#ffd0b0');
  yield { wait: 3.4, anim: 'roll' };               // катается, сбивая пламя
  u.burn.stage = 'out';
  if (isRaining() && Math.random() < 0.5) floater(u.x, u.y - 1, 'Дождь помог!', '#cfe8ff');
  sfxAt('hiss', u.x * TILE, u.y * TILE);
  fxBurst(u.x * TILE, u.y * TILE - 4, 14, ['rgba(200,200,200,0.6)', 'rgba(150,150,150,0.5)'], 14, 18, 1.8, 3.6, -16);
  yield { wait: 1.8, anim: 'burnout' };            // лежит, дымится
  u.burn.stage = 'up';
  yield { wait: 0.6, anim: 'getup' };
  const ouch = Math.random() < 0.6;
  if (ouch) injure(u, Math.random() < 0.5 ? 'arm' : 'leg');
  floater(u.x, u.y - 1, ouch ? 'Обгорел…' : 'Фух!', '#fff2a0');
  logEvent('weather', `${UNIT_TYPES[u.type].name} потушил себя и встал${ouch ? ', обгорел' : ''}`, u.x, u.y);
  u.burn = null;
}

function igniteHen(a) {
  a.burn = { t: 0, die: Math.random() < 0.6, dir: Math.random() * 6.28, turn: 0, cl: 0 };
  addScorch(a.x, a.y, 0.6);
  floater(a.x, a.y - 0.8, 'Ко-ко-ко!', '#ffd8a0');
  logEvent('weather', 'Молния ударила в курицу, она загорелась', a.x, a.y);
}

// вызывается из updateAnimal вместо обычного поведения
function burnHenStep(a, dt) {
  const b = a.burn;
  b.t += dt; b.turn -= dt; b.cl -= dt;
  if (b.turn <= 0) { b.turn = wrnd(0.25, 0.6); b.dir += wrnd(-2, 2); }
  const nx = a.x + Math.cos(b.dir) * 3.2 * dt, ny = a.y + Math.sin(b.dir) * 3.2 * dt;
  if (isWalkable(Math.floor(nx), Math.floor(ny))) { a.x = nx; a.y = ny; } else b.dir += 2.4;
  a.face = Math.cos(b.dir) >= 0 ? 1 : -1; a.moving = true; a.phase += dt * 20; a.path = null;
  if (b.cl <= 0) { b.cl = 0.5; floater(a.x, a.y - 0.8, 'Ко-ко!', '#ffd8a0'); }
  if (b.t > 4.2) {
    a.burn = null; a.moving = false; a.wait = 2;
    if (b.die) {
      addScorch(a.x, a.y, 0.5);
      fxBurst(a.x * TILE, a.y * TILE, 18, ['#f4f0e6', '#d8d0c0', '#3a3430'], 40, 40, 1.2, 2, 80);   // перья и пепел
      floater(a.x, a.y - 0.8, 'Сгорела…', '#ffb060');
      logEvent('weather', 'Курица сгорела от молнии', a.x, a.y);
      removeAnimal(a);
    } else {
      sfxAt('hiss', a.x * TILE, a.y * TILE);
      floater(a.x, a.y - 0.8, 'Уф!', '#cfe8ff');
      logEvent('weather', 'Курица погасла и осталась жива', a.x, a.y);
    }
  }
}

function strikeEnt(e) {
  const nm = entName(e).toLowerCase();
  if (e.rock) {
    // камень раскалывается
    e.state = 'dying'; e.t = 0; e.foe = null; e.moving = false; e.fallDir = 1;
    fxBurst(e.x * TILE, e.y * TILE - 10, 24, ['#fff6c0', '#ffd860', '#c8c8d0'], 130, 60, 0.6, 1.8, 300);
    floater(e.x, e.y - 1.8, 'Крак!', '#cfe0ff');
    logEvent('weather', `Молния расколола ${nm}`, e.x, e.y);
    toast('Молния расколола ходячий камень!');
  } else {
    e.burnT = Game.time;
    floater(e.x, e.y - 3, 'Горит!', '#ffb060');
    logEvent('weather', `Молния подожгла: ${nm}`, e.x, e.y);
    toast('Молния подожгла ходячее дерево!');
  }
  addScorch(e.x, e.y, 1);
}

// ---------- Огонь: частицы, ущерб, звук ----------

function fireTick(dt) {
  WX.fxT += dt;
  const puff = WX.fxT > 0.09; if (puff) WX.fxT = 0;
  WX.sfxT += dt;
  const crack = WX.sfxT > 0.7; if (crack) WX.sfxT = 0;
  const burning = (x, y, lvl) => {
    if (!puff) return;
    if (Math.random() < lvl) fxBurst(x, y, 1, ['#ffcc50', '#ff8a30', '#ffe890'], 10, 24, 0.7, 1.4, -30);
    if (Math.random() < lvl * 0.7) fxBurst(x, y - 8, 1, ['rgba(70,66,62,0.55)', 'rgba(110,106,100,0.45)'], 6, 12, 1.7, 3.2, -14);
    if (crack && Math.random() < 0.5) sfxAt('crackle', x, y, 0.6);
  };
  for (const u of Game.units) {
    if (u.dead) continue;
    // перерыв сбили (отбросило, спугнули): горение кончается вместе с ним
    if (u.burn && !(u.brk && u.brk.kind === 'burn')) { u.burn = null; u.panicUntil = 0; if (u.gest === 'panic') u.gestUntil = 0; }
    if (u.slip && !(u.brk && u.brk.kind === 'slip')) u.slip = null;
    if (u.burn && u.burn.stage) { const l = burnLevel(u); if (l > 0.05) burning(u.x * TILE, u.y * TILE - (u.anim === 'roll' ? 4 : 14), l); else if (puff && u.burn.stage === 'out') fxBurst(u.x * TILE, u.y * TILE - 6, 1, ['rgba(150,150,150,0.45)'], 5, 10, 1.6, 3, -12); }
    // скользит — из-под тела брызги
    if (u.anim === 'slide' && puff) fxBurst(u.x * TILE + (u.slip ? u.slip.d[0] * TILE * (1 - Math.max(0, u.action.t) / u.action.T) : 0), u.y * TILE + 4, 1, ['#9ab0c8', '#c8d8e8'], 30, 14, 0.4, 1.6, 90);
  }
  for (const a of Game.animals) if (a.burn) burning(a.x * TILE, a.y * TILE - 2, 1);
  for (const e of Game.ents || []) if (e.burnT) {
    const { bx, by } = entBase(e);
    burning(bx + wrnd(-10, 10), by - wrnd(20, 60), 1);
    if (Game.time - e.burnT > 5.5 && e.state !== 'dying' && e.state !== 'gone') {
      e.state = 'dying'; e.t = 0; e.foe = null; e.moving = false; e.fallDir = e.face || 1;
      logEvent('weather', `${entName(e)} сгорело и рухнуло`, e.x, e.y);
    }
  }
  for (let i = WX.fires.length - 1; i >= 0; i--) {
    const f = WX.fires[i], age = Game.time - f.t0;
    if (age > f.life || (isRaining() && Math.random() < dt * 0.6)) { WX.fires.splice(i, 1); continue; }
    burning(f.x * TILE, f.y * TILE, 0.7 * (1 - age / f.life));
  }
}

function burnLevel(u) {
  const s = u.burn && u.burn.stage, a = u.action;
  if (s === 'run' || s === 'fall') return 1;
  if (s === 'roll') return a && a.T ? 0.12 + 0.88 * Math.max(0, a.t) / a.T : 0.5;
  return 0;
}

// ---------- Рисование ----------

function drawFlames(c, x, y, w, h, level, seed) {
  if (level <= 0.03) return;
  const t = performance.now() / 1000;
  glow(c, x, y - h * 0.5, Math.max(w, h) * 1.4, '255,150,50', 0.35 * level);
  const n = 3 + Math.round(level * 2);
  const layers = [['#d8421a', 1], ['#ff9a24', 0.72], ['#ffe27a', 0.42]];
  for (const [col, sc] of layers) {
    c.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const fx = x + (i / (n - 1) - 0.5) * w * (1.2 - 0.3 * sc);
      const fh = h * sc * level * (0.55 + 0.45 * Math.abs(Math.sin(t * 9 + seed + i * 1.9))) * (i === (n >> 1) ? 1.15 : 0.85);
      const hw = Math.max(1, (w / n) * 0.9 * sc + 0.6), lean = Math.sin(t * 6 + seed + i * 2.3) * 1.6;
      c.beginPath();
      c.moveTo(fx - hw, y);
      c.quadraticCurveTo(fx - hw * 0.6 + lean * 0.3, y - fh * 0.55, fx + lean, y - fh);
      c.quadraticCurveTo(fx + hw * 0.6 + lean * 0.3, y - fh * 0.55, fx + hw, y);
      c.closePath(); c.fill();
    }
  }
}

function weatherDrawList(list, c, x0, y0, x1, y1) {
  for (const s of WX.scorch) {
    if (s.x < x0 - 2 || s.x > x1 + 2 || s.y < y0 - 2 || s.y > y1 + 2) continue;
    list.push([s.y - 0.4, () => {
      const a = Math.max(0, 1 - Math.max(0, Game.time - s.t0 - 60) / 90);
      c.save(); c.globalAlpha = 0.45 * a; c.fillStyle = '#1c1612';
      c.beginPath(); c.ellipse(s.x * TILE, s.y * TILE + 3, 9 * s.r, 4.4 * s.r, 0, 0, 7); c.fill();
      c.globalAlpha = 0.3 * a; c.fillStyle = '#0a0806';
      c.beginPath(); c.ellipse(s.x * TILE, s.y * TILE + 3, 5 * s.r, 2.4 * s.r, 0, 0, 7); c.fill();
      c.restore();
    }]);
  }
  for (const f of WX.fires) {
    if (f.x < x0 - 1 || f.x > x1 + 1 || f.y < y0 - 1 || f.y > y1 + 1) continue;
    list.push([f.y + 0.3, () => drawFlames(c, f.x * TILE, f.y * TILE + 4, 12, 15, 0.9 * (1 - (Game.time - f.t0) / f.life), f.x * 7)]);
  }
  for (const u of Game.units) {
    if (!(u.burn && u.burn.stage) || u.inside || u.x < x0 - 1 || u.x > x1 + 1 || u.y < y0 - 1 || u.y > y1 + 2) continue;
    const lvl = burnLevel(u);
    if (lvl <= 0.03) continue;
    list.push([u.y + 0.3, () => {
      const px = u.x * TILE + (u.anim === 'roll' ? Math.sin(Game.time * 4.5 + u.id) * 5 : 0), py = u.y * TILE + 6;
      if (u.anim === 'roll' || u.anim === 'burnfall') drawFlames(c, px, py - 2, 22, 16, lvl, u.id);
      else drawFlames(c, px, py - 9, 16, 26, lvl, u.id);
    }]);
  }
  for (const a of Game.animals) {
    if (!a.burn || a.x < x0 - 1 || a.x > x1 + 1 || a.y < y0 - 1 || a.y > y1 + 2) continue;
    list.push([a.y + 0.3, () => drawFlames(c, a.x * TILE, a.y * TILE + 4, 9, 13, 1, a.id)]);
  }
  for (const e of Game.ents || []) {
    if (!e.burnT || e.x < x0 - 3 || e.x > x1 + 3 || e.y < y0 - 1 || e.y > y1 + 4) continue;
    list.push([e.y + 0.3, () => {
      const { bx, by } = entBase(e), lv = e.state === 'dying' ? Math.max(0, 1 - e.t / 2) : 1;
      drawFlames(c, bx, by - 10, 28, 30, lv, e.i);
      drawFlames(c, bx - 8, by - 50, 24, 30, lv, e.i + 3);
      drawFlames(c, bx + 9, by - 60, 18, 26, lv, e.i + 5);
    }]);
  }
}

// Свет: горящие и вспышка молнии
function weatherLights(L, x0, y0, x1, y1) {
  for (const u of Game.units) {
    if (u.burn && u.burn.stage && !u.inside) { const l = burnLevel(u); if (l > 0.05) L.push([u.x * TILE, u.y * TILE - 8, 64, 0.9 * l]); }
  }
  for (const a of Game.animals) if (a.burn) L.push([a.x * TILE, a.y * TILE - 4, 34, 0.8]);
  for (const e of Game.ents || []) if (e.burnT && e.state !== 'gone') { const { bx, by } = entBase(e); L.push([bx, by - 40, 90, 0.95]); }
  for (const f of WX.fires) L.push([f.x * TILE, f.y * TILE, 40, 0.6]);
  if (WX.bolt && performance.now() - WX.bolt.wall < 400) L.push([WX.bolt.x, WX.bolt.y - 10, 220, 1]);
}

// Дождь, затемнение, молния — поверх всего
function drawWeather(c) {
  const k = WX.k;
  const cam = R.cam, z = devScale();
  const vw = R.canvas.width / z, vh = R.canvas.height / z;
  const now = performance.now() / 1000;
  if (k > 0.01) {
    c.fillStyle = `rgba(20,32,52,${0.22 * k})`;                  // тучи
    c.fillRect(cam.x - 4, cam.y - 4, vw + 8, vh + 8);
    c.save();
    c.lineCap = 'butt';
    const area = vw * vh, base = Math.min(900, area / 240);
    for (const [layer, len, spd, alpha, lw] of [[0, 5, 260, 0.28, 0.8], [1, 8, 420, 0.45, 1]]) {
      const n = Math.round(base * k * (layer ? 0.55 : 0.8));
      c.strokeStyle = `rgba(190,208,235,${alpha * Math.min(1, k * 1.4)})`; c.lineWidth = lw;
      c.beginPath();
      for (let i = 0; i < n; i++) {
        const sx = frac01(i * 0.731 + layer * 17), sy = frac01(i * 1.337 + 3 + layer * 5);
        const y = ((sy * vh + now * spd) % (vh + 20)) - 10;
        const x = (sx * (vw + 40) - 20 - y * 0.18 + vw * 4) % (vw + 40) - 10;
        c.moveTo(cam.x + x, cam.y + y); c.lineTo(cam.x + x - len * 0.18, cam.y + y + len);
      }
      c.stroke();
    }
    // круги от капель на земле
    c.lineWidth = 0.6;
    const ns = Math.round(base * k * 0.16);
    for (let j = 0; j < ns; j++) {
      const q = now * 1.9 + frac01(j * 3.1), cyc = Math.floor(q), p = q - cyc;
      const x = cam.x + frac01(j * 7.7 + cyc * 1.3) * vw, y = cam.y + frac01(j * 4.9 + cyc * 2.1 + 9) * vh;
      c.strokeStyle = `rgba(210,225,245,${0.45 * (1 - p) * k})`;
      c.beginPath(); c.ellipse(x, y, 0.8 + p * 3.2, 0.4 + p * 1.4, 0, 0, 7); c.stroke();
    }
    c.restore();
  }
  const b = WX.bolt;
  if (b) {
    const age = (performance.now() - b.wall) / 1000;
    if (age < 0.5) {
      const fade = Math.max(0, 1 - age / 0.5), flick = age < 0.12 || (age > 0.18 && age < 0.3) ? 1 : 0.45;
      c.save();
      c.lineJoin = 'round'; c.lineCap = 'round';
      const path = (pts) => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke(); };
      c.globalAlpha = fade * flick * 0.45; c.strokeStyle = '#8fb0ff'; c.lineWidth = 6; path(b.pts);
      c.lineWidth = 3; for (const s of b.br) path(s);
      c.globalAlpha = fade * flick; c.strokeStyle = '#f4f8ff'; c.lineWidth = 2; path(b.pts);
      c.lineWidth = 1; for (const s of b.br) path(s);
      glow(c, b.x, b.y, 46, '200,220,255', 0.8 * fade * flick);
      c.restore();
      c.fillStyle = `rgba(226,233,255,${0.62 * fade * flick})`;     // вспышка на весь экран
      c.fillRect(cam.x - 4, cam.y - 4, vw + 8, vh + 8);
    }
  }
}

// ---------- Звук ----------

// Шум ливня: зациклённый шум через фильтры; громкость следует за силой дождя
function rainSound() {
  const ctx = Sfx.ctx;
  if (!ctx || !Sfx.on) { if (WX.snd && ctx) WX.snd.g.gain.setTargetAtTime(0, ctx.currentTime, 0.1); return; }
  if (WX.k < 0.01) {
    if (WX.snd) { try { WX.snd.src.stop(); WX.snd.src2.stop(); } catch (e) { /* уже остановлен */ } WX.snd = null; }
    return;
  }
  if (!WX.snd) {
    const g = ctx.createGain(); g.gain.value = 0;
    const mk = (type, f, q) => {
      const src = ctx.createBufferSource(); src.buffer = Sfx.noise; src.loop = true;
      src.playbackRate.value = f > 1000 ? 1 : 0.6;
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const gg = ctx.createGain(); gg.gain.value = f > 1000 ? 0.5 : 0.8;
      src.connect(fl); fl.connect(gg); gg.connect(g); src.start(0, Math.random() * 0.5);
      return src;
    };
    const src = mk('bandpass', 3800, 0.5), src2 = mk('lowpass', 520, 0.7);
    g.connect(Sfx.out);
    WX.snd = { g, src, src2 };
  }
  WX.snd.g.gain.setTargetAtTime(0.16 * WX.k, ctx.currentTime, 0.4);
}

function sfxThunder(delay = 0.3) {
  if (!Sfx.ctx || !Sfx.on) return;
  const o = Sfx.out, t = Sfx.ctx.currentTime + 0.02 + delay;
  noiseHit(o, 'highpass', 2200, 900, 0.8, t, 0.28, 0.9, 0.002);              // треск
  noiseHit(o, 'lowpass', 520, 80, 0.9, t + 0.05, 3.0, 1.0, 0.15);            // раскат
  noiseHit(o, 'lowpass', 300, 50, 0.7, t + 1.0, 2.4, 0.7, 0.25);
  tone(o, 'sine', 80, 30, t + 0.05, 2.0, 0.45, 0.1);
}

Object.assign(SFX, {
  slipfly: (d, t) => { gnomeVoice(d, t, [[420, 900, 0.12], [900, 520, 0.22]], 0.55, 1200); noiseHit(d, 'bandpass', 1200, 400, 1, t + 0.05, 0.3, 0.3, 0.05); },
  slide: (d, t) => { noiseHit(d, 'lowpass', 900, 250, 0.8, t, 0.7, 0.45, 0.08); tone(d, 'sine', 120, 70, t + 0.02, 0.2, 0.3); },
  slipLie: (d, t) => { tone(d, 'sine', 130, 55, t, 0.18, 0.45); noiseHit(d, 'lowpass', 600, 200, 1, t, 0.2, 0.35); },
  crackle: (d, t) => { for (let k = 0; k < 4; k++) noiseHit(d, 'highpass', 2500 + Math.random() * 2000, 2000, 1, t + k * 0.06 + Math.random() * 0.04, 0.025, 0.2); },
  hiss: (d, t) => noiseHit(d, 'highpass', 4000, 6500, 0.8, t, 0.9, 0.3, 0.15),
});
Object.assign(ANIM_SFX, { smokeup: 'smoke', roll: 'crackle' });
Object.assign(FLOAT_SFX, { 'Горю!': 'scream', 'А-а-а!': 'scream', 'Бабах!': 'thud', 'Ко-ко-ко!': 'cluck', 'Крак!': 'thud' });
