'use strict';
// Новая живность деревни:
//  • прогон гусей — три гнома рядом или герой одним подходом гонят стаю к дальнему озеру на несколько минут;
//  • вороны-воровки тащат блестящее из кучек на земле (золото, самоцветы, клинки), их можно спугнуть так же;
//  • лягушки и дождевые черви выползают в дождь, куры клюют червей;
//  • светлячки кружат над полянами тёмными ночами.
// Звери не сохраняются (как и остальная живность), а итоги записываются в Game.faunaStat — он идёт в сохранение.
// Спрайты — настоящий пиксель-арт: строки-карты в 1 пиксель мира, без сглаживания.

Game.faunaStat = Game.faunaStat || {};
const fstat = (k, n = 1) => { const s = Game.faunaStat || (Game.faunaStat = {}); s[k] = (s[k] || 0) + n; };

const FAUNA_SHINY = ['gold', 'goldore', 'magicstone', 'mana', 'sword', 'dagger'];
const FAUNA_ON = () => !(typeof Coop !== 'undefined' && Coop.on);     // у клиента совместной игры живность не рисуется

// ---------- Кто прогоняет ----------
// Герой — одним подходом; остальные — втроём и больше. Возвращает { hero, who, x, y } или null.
function shooersNear(x, y, r, need, heroR = r * 0.75) {
  let n = 0, hero = null, sx = 0, sy = 0;
  const who = [];
  for (const u of Game.units) {
    if (u.inside || u.dead || !isPerson(u) || u.type === 'carter') continue;
    const d = Math.hypot(u.x - x, u.y - y);
    if (u.type === 'hero' && d < heroR) hero = u;
    if (d < r) { n++; sx += u.x; sy += u.y; who.push(u); }
  }
  if (!hero && n < need) return null;
  if (!n) return { hero, who, x: hero.x, y: hero.y };
  return { hero, who, x: sx / n, y: sy / n };
}

function shooWave(s, text) {
  const list = s.hero ? [s.hero, ...s.who.filter(u => u !== s.hero)] : s.who;
  list.slice(0, 4).forEach((u, i) => {
    u.gest = 'wave'; u.gestUntil = Game.time + 2.6; u.gestFace = u.x > s.x ? 1 : -1;
    if (i === 0) floater(u.x, u.y - 1.4, text, '#fff2c0');
  });
}

// ---------- Гуси: прогон ----------
let lastShooLog = -99, lastShooToast = -99;

// Дальнее озеро: берег с водой, подальше от склада, поближе к самому гусю
function gooseLakeFor(a) {
  const cx = MAP_W >> 1, cy = MAP_H >> 1;
  let best = null, bd = 1e9;
  for (let k = 0; k < 360; k++) {
    const x = (Math.random() * MAP_W) | 0, y = (Math.random() * MAP_H) | 0;
    const d = Math.hypot(x - cx, y - cy);
    if (d < 17 || d > 32 || !isWaterAt(x, y)) continue;
    let shore = false, water = 0;
    for (let yy = y - 2; yy <= y + 2; yy++) for (let xx = x - 2; xx <= x + 2; xx++) {
      if (isWaterAt(xx, yy)) water++; else if (inb(xx, yy) && World.terrain[idx(xx, yy)] === T_SAND) shore = true;
    }
    if (!shore || water < 10) continue;
    const dg = Math.hypot(x - a.x, y - a.y);
    if (dg < bd) { bd = dg; best = [x, y]; }
  }
  if (best) return best;
  const dx = a.x - cx, dy = a.y - cy, d = Math.hypot(dx, dy) || 1;     // запасной вариант: просто подальше от центра
  const fx = Math.max(1, Math.min(MAP_W - 2, Math.round(a.x + dx / d * 12))), fy = Math.max(1, Math.min(MAP_H - 2, Math.round(a.y + dy / d * 12)));
  return gooseCanBe(fx, fy) ? [fx, fy] : [a.home[0], a.home[1]];
}

function gooseShoo(a, s) {
  const lake = a.lake && Math.hypot(a.lake[0] - a.x, a.lake[1] - a.y) > 9 ? a.lake : gooseLakeFor(a);
  const shy = Game.time + 210 + Math.random() * 120;           // 3,5–5,5 минуты без возврата
  let n = 0;
  for (const g of Game.animals) {
    if (g.kind !== 'goose' || g.loot || Math.hypot(g.x - a.x, g.y - a.y) > 7) continue;
    g.state = 'shoo'; g.shooUntil = Game.time + 16; g.shooFails = 0;
    g.lake = lake; g.home = [lake[0], lake[1]];
    g.shyUntil = shy; g.calmUntil = shy; g.tgt = null; g.target = null; g.bites = 0;
    g.fromX = s.x; g.fromY = s.y;
    n++;
  }
  if (!n) return;
  shooWave(s, 'Кыш!');
  floater(a.x, a.y - 1, 'Га-га!', '#ffffff'); faunaSfx('gooseFlap', a.x, a.y, 1, 0.25);
  if (Game.time - lastShooLog > 20) {
    lastShooLog = Game.time; fstat('shoo');
    logEvent('animal', s.hero ? 'Герой одним видом прогнал гусей' : 'Гномы всем миром прогнали гусей', a.x, a.y);
  }
  if (Game.time - lastShooToast > 90) {
    lastShooToast = Game.time;
    toast(s.hero ? 'Герой прогнал гусей — надолго притихнут' : 'Гномы собрались и прогнали гусей — надолго притихнут');
  }
}

// Вызывается из updateGoose. true — гусь занят прогоном и остальную логику пропускает
function gooseShooTick(a, dt, def) {
  if (a.state !== 'shoo') {
    a.shooT = (a.shooT || 0) - dt;
    if (a.shooT > 0 || a.loot || a.state === 'flee') return false;
    a.shooT = 0.4;
    const s = shooersNear(a.x, a.y, 4.2, 3, 3.4);
    if (!s) return false;
    gooseShoo(a, s);
  }
  a.swim = isWaterAt(Math.floor(a.x), Math.floor(a.y));
  const L = a.lake || a.home;
  const ok = gooseMove(a, L[0] + 0.5, L[1] + 0.5, def.speed * 1.35 * (a.swim ? 0.75 : 1), dt);
  if (!ok && !a.moving) {      // упёрся — пробует отбежать прямо от пугавших
    a.shooFails = (a.shooFails || 0) + 1;
    const dx = a.x - (a.fromX || a.x), dy = a.y - (a.fromY || a.y), d = Math.hypot(dx, dy) || 1;
    if (a.shooFails > 4) { a.state = 'back'; return true; }
    gooseMove(a, a.x + dx / d * 2 + (Math.random() - 0.5) * 2, a.y + dy / d * 2 + (Math.random() - 0.5) * 2, def.speed * 1.2, dt);
  }
  if (ok || Game.time > a.shooUntil) { a.state = 'back'; a.tgt = null; }
  return true;
}

// ---------- Пиксель-арт спрайты ----------
const FA_PAL = {
  k: '#26262f', h: '#4a4a62', m: '#181820', b: '#cfae58', B: '#8a7030', e: '#e8e2c4', l: '#7a6444',
  g: '#4a8a34', G: '#8cc654', d: '#2c5a24', y: '#e8d048', w: '#1a1810', r: '#d89aa0', R: '#a8606c',
};

// Походка по готовому кадру: из рядов спрайта «стоит» делает i-й из N кадров шага. Нижние legN рядов — ноги:
// задняя пара (левая половина) и передняя (правая) качаются навстречу, на проходе корпус приподнимается на пиксель.
function gaitRows(rows, legN, N, i) {
  const w = Math.max(...rows.map(r => r.length)), body = rows.slice(0, rows.length - legN), legs = rows.slice(rows.length - legN).map(r => r.padEnd(w, '.'));
  const sn = Math.sin(i / N * Math.PI * 2), sh = Math.round(sn * 1.4), mid = w >> 1;
  const mv = (r, k) => k > 0 ? '.'.repeat(k) + r.slice(0, r.length - k) : k < 0 ? r.slice(-k) + '.'.repeat(-k) : r;
  const lg = legs.map(r => mv(r.slice(0, mid), sh) + mv(r.slice(mid), -sh));
  const lift = sh === 0 && Math.abs(sn) < 0.3;
  return lift ? body.concat([body[body.length - 1]], lg) : body.concat(lg);
}

// Взмах крыла: i-й из N кадров по косинусу между тремя опорными позами (вверх, ровно, вниз) — их точки тянутся друг к другу
function flapPose(up, mid, down, i, N) {
  const a = Math.cos(i / N * Math.PI * 2), [A, B] = a >= 0 ? [mid, up] : [mid, down], k = Math.abs(a);
  return A.map((p, n) => Array.isArray(p) ? p.map((v, m) => Math.round(v + (B[n][m] - v) * k)) : Math.round(p + (B[n] - p) * k));
}
function faSprite(rows, pal = FA_PAL) {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length;
  const cv = mkCanvas(w, h), c = cv.getContext('2d');
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ' || !pal[ch]) continue;
      c.fillStyle = pal[ch]; c.fillRect(x, y, 1, 1);
    }
  });
  return cv;
}

// Ворона стоя (смотрит вправо) и два шага
const CROW_STAND = [
  '.........kkkk.....',
  '........kkkkkk....',
  '........kkekkkbb..',
  '........kkkkkkbBB.',
  '.......hkkkkkkB...',
  '..kk..hkkkkkkk....',
  '.kkkkhhkkkkkkk....',
  'kkkkkkhhkkkkkk....',
  'kkkkkkkkkkkkkk....',
  '.kkkkkkkmmkkk.....',
  '..kkkkkkkkkkk.....',
];
const CROW_LEGS = [
  ['......l...l.....', '......l...l.....'],
  ['.....l.....l....', '.....ll....ll...'],
  ['.......l.l......', '......ll.ll.....'],
];
// В полёте крылья собираются из пикселей: тело + голова + клюв и крыло, поднятое или опущенное
function crowFlySprite(frame) {
  const W = 22, H = 15, cv = mkCanvas(W, H), c = cv.getContext('2d');
  const px = (x, y, col) => { c.fillStyle = col; c.fillRect(x | 0, y | 0, 1, 1); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {          // тело — вытянутый овал
    const ex = (x - 10) / 5.6, ey = (y - 8) / 2.6;
    if (ex * ex + ey * ey <= 1) px(x, y, ey > 0.3 ? FA_PAL.m : FA_PAL.k);
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {          // голова
    const ex = (x - 16) / 2.5, ey = (y - 6.5) / 2.2;
    if (ex * ex + ey * ey <= 1) px(x, y, FA_PAL.k);
  }
  px(17, 6, FA_PAL.e); px(18, 7, FA_PAL.b); px(19, 7, FA_PAL.b); px(20, 8, FA_PAL.B); px(18, 8, FA_PAL.B);
  for (let x = 1; x < 6; x++) { px(x, 8, FA_PAL.k); if (x < 4) px(x, 9, FA_PAL.m); }     // хвост
  // крыло: треугольник от плеча к концу
  const tri = (ax, ay, bx, by, cx2, cy2, col) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d1 = (x - bx) * (ay - by) - (ax - bx) * (y - by);
      const d2 = (x - cx2) * (by - cy2) - (bx - cx2) * (y - cy2);
      const d3 = (x - ax) * (cy2 - ay) - (cx2 - ax) * (y - ay);
      if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) px(x, y, col);
    }
  };
  const quad = (p, q, r, t, col) => { tri(...p, ...q, ...r, col); tri(...p, ...r, ...t, col); };
  const W6 = flapPose([[7, 8], [15, 8], [14, 1], [4, 2]], [[6, 8], [15, 8], [15, 6], [2, 6]], [[7, 8], [15, 8], [13, 14], [4, 13]], frame, 12);
  const H6 = flapPose([8, 7, 13, 7, 8, 3], [8, 7, 13, 7, 6, 7], [8, 9, 13, 9, 8, 12], frame, 12);
  quad(...W6, FA_PAL.k); tri(...H6, FA_PAL.h);       // крыло: вверх → ровно → вниз, 8 кадров
  return cv;
}
const FA_CACHE = {};
function crowSprite(kind) {
  if (FA_CACHE[kind]) return FA_CACHE[kind];
  let cv;
  if (kind[0] === 'w') cv = faSprite(gaitRows([...CROW_STAND, ...CROW_LEGS[0]], 2, 12, +kind.slice(1)));   // шаг по земле: 12 кадров
  else if (kind.startsWith('s')) {                 // s0..s2 — стоя, ноги в разных позах
    const legs = CROW_LEGS[+kind[1]];
    cv = faSprite([...CROW_STAND, ...legs]);
  } else cv = crowFlySprite(+kind[1]);        // f0..f2
  return FA_CACHE[kind] = cv;
}

// Лягушка: 7 кадров — сидит, моргает, квакает (горловой пузырь), присела, толчок, полёт, приземление
const FROG_FR = {
  sit:    ['..gg...gg..', '.gwyg.gwyg.', '.ggggggggg.', 'dggGGGGGggd', 'ddgGGGGGgdd', 'd.gggggggd.', 'dd.......dd'],
  blink:  ['..gg...gg..', '.gkkg.gkkg.', '.ggggggggg.', 'dggGGGGGggd', 'ddgGGGGGgdd', 'd.gggggggd.', 'dd.......dd'],
  croak:  ['..gg...gg..', '.gwyg.gwyg.', '.ggggggggg.', 'dgqqqqqqqgd', 'ddgqqqqqgdd', 'd.gggggggd.', 'dd.......dd'],
  crouch: ['..gg...gg..', '.gwyg.gwyg.', '.ggggggggg.', 'dggGGGGGggd', 'dddggggggdd'],
  launch: ['.....gg.gg.', '....gwygwyg', '.d.ggggggg.', 'dddgGGGGgg.', '.ddgggggg..', '..d.......'],
  air:    ['......gg.gg.', '.....gwygwyg', 'dd.ggggggggg', 'dddgGGGGGGg.', '.ddggggggg..', '..d..d......'],
  land:   ['..gg...gg..', '.gwyg.gwyg.', '.ggggggggg.', 'dggGGGGGggd', 'ddggggggddd', '.ddd...ddd.'],
};
function frogFrame(f) {
  if (f.hop > 0) {
    const k = f.hop;
    return k < 0.12 ? 'crouch' : k < 0.3 ? 'launch' : k < 0.7 ? 'air' : k < 0.88 ? 'land' : 'crouch';
  }
  const t = (f.ph + f.id) % 7;
  if (t > 5.2 && t < 6.2) return 'croak';
  if ((f.ph * 1.3 + f.id) % 4 < 0.16) return 'blink';
  return 'sit';
}
function frogSprite(name) {
  const k = 'frog_' + name;
  return FA_CACHE[k] || (FA_CACHE[k] = faSprite(FROG_FR[name], { ...FA_PAL, q: '#d8f090' }));
}

// ---------- Вороны ----------
let lastCrowToast = -99, lastCrowLog = -99;

function crowTargetPile() {
  const taken = new Set(Game.crows.filter(c => c.pile).map(c => c.pile));
  for (const p of Game.piles.values()) {
    if (p.removed || taken.has(p)) continue;
    const g = FAUNA_SHINY.find(k => p.stock[k] - p.reserved[k] > 0);
    if (g) return p;
  }
  return null;
}

function crowSpawn(c) {
  const cx = MAP_W >> 1, cy = MAP_H >> 1;
  const pile = crowTargetPile();
  let tx, ty;
  if (pile) { tx = pile.x + 0.5; ty = pile.y + 0.5; c.pile = pile; }
  else {
    const spot = randomFreeNear(cx + ((Math.random() - 0.5) * 16 | 0), cy + ((Math.random() - 0.5) * 12 | 0), 0, 5, (x, y) => isWalkable(x, y) && !World.bmap[idx(x, y)]);
    if (!spot) { c.t = 20; return; }
    tx = spot[0] + 0.5; ty = spot[1] + 0.5; c.pile = null;
  }
  const ang = Math.random() * Math.PI * 2;
  c.x = tx + Math.cos(ang) * 26; c.y = ty + Math.sin(ang) * 20; c.z = 60;
  c.tx = tx; c.ty = ty; c.state = 'in'; c.item = null; c.ph = Math.random() * 10;
}

function crowStep(c, dt) {
  c.ph += dt;
  if (c.state === 'away') {
    c.t -= dt;
    if (c.t > 0) return;
    if (isNightNow() || isRaining()) { c.t = 15; return; }
    crowSpawn(c);
    return;
  }
  if (c.state === 'in' || c.state === 'out') {
    const to = c.state === 'in' ? [c.tx, c.ty] : [c.ex, c.ey];
    const dx = to[0] - c.x, dy = to[1] - c.y, d = Math.hypot(dx, dy);
    const sp = c.state === 'in' ? 4.2 : 5.2;
    if (c.state === 'in') {
      c.z = Math.min(c.z, d * 12);
      if (d < 0.3) { c.x = c.tx; c.y = c.ty; c.z = 0; c.state = 'land'; c.t = 0; c.peck = 0; c.wait = 0; return; }
    } else {
      c.z = Math.min(70, c.z + dt * 26);
      if (d < 1.5 || Math.hypot(c.x - (MAP_W >> 1), c.y - (MAP_H >> 1)) > 42) { c.state = 'away'; c.t = 50 + Math.random() * 70; c.item = null; return; }
    }
    const s = Math.min(d, sp * dt);
    c.x += dx / d * s; c.y += dy / d * s;
    c.face = dx > 0 ? 1 : -1;
    return;
  }
  // на земле
  c.z = 0;
  c.sc = (c.sc || 0) - dt;
  if (c.sc <= 0) {          // спугнуть: герой подошёл или рядом трое гномов
    c.sc = 0.3;
    const s = shooersNear(c.x, c.y, 3.6, 3, 3);
    if (s) {
      floater(c.x, c.y - 1.2, 'Кар!', '#d8d8f0'); faunaSfx('cawRasp', c.x, c.y, 1, 0.3);
      shooWave(s, 'Кыш!');
      fstat('crowShoo');
      crowLeave(c);
      return;
    }
  }
  if (c.pile) {
    const p = c.pile;
    const g = !p.removed && FAUNA_SHINY.find(k => p.stock[k] - p.reserved[k] > 0);
    if (!g) { c.pile = null; crowLeave(c); return; }
    c.peck += dt;
    if (c.peck > 1.6) {
      p.stock[g]--; cleanupPile(p);
      c.item = g; c.pile = null;
      fstat('crow');
      logEvent('crow', `Ворона стащила блестящее: ${GOODS[g].name.toLowerCase()}`, c.x, c.y);
      floater(c.x, c.y - 1.2, 'Кар!', '#d8d8f0');
      if (Game.time - lastCrowToast > 60) { lastCrowToast = Game.time; toast(`Ворона стащила блестящее: ${GOODS[g].name.toLowerCase()}! Прогоняйте их — героем или втроём`); }
      crowLeave(c);
    }
    return;
  }
  // просто гуляет по деревне и клюёт землю
  c.t += dt;
  c.wait -= dt;
  c.walking = false;
  if (c.wait <= 0 && !c.go) { c.wait = 1.2 + Math.random() * 2.5; const t = randomFreeNear(Math.floor(c.x), Math.floor(c.y), 1, 2, (x, y) => isWalkable(x, y) && !World.bmap[idx(x, y)]); if (t) c.go = [t[0] + 0.5, t[1] + 0.5]; }
  if (c.go) {
    const dx = c.go[0] - c.x, dy = c.go[1] - c.y, d = Math.hypot(dx, dy);
    if (d < 0.08) c.go = null;
    else { const s = Math.min(d, 1.1 * dt); c.x += dx / d * s; c.y += dy / d * s; c.face = dx > 0 ? 1 : -1; c.walking = true; }
  }
  if (c.t > 22 + (c.ph % 7)) crowLeave(c);
}

function crowLeave(c) {
  const ang = Math.random() * Math.PI * 2;
  c.state = 'out'; c.go = null;
  c.ex = c.x + Math.cos(ang) * 50; c.ey = c.y + Math.sin(ang) * 40;
  c.z = 4;
  faunaSfx('wingFlap', c.x, c.y);
}

function crowsTick(dt) {
  const crows = Game.crows || (Game.crows = []);
  const done = Game.buildings.filter(b => b.state === 'done').length;
  while (crows.length < 2 && done >= 3) crows.push({ x: 0, y: 0, z: 0, state: 'away', t: 25 + crows.length * 30 + Math.random() * 40, face: 1, ph: 0, item: null, pile: null });
  for (const c of crows) crowStep(c, dt);
}

function drawCrow(c, cr) {
  const px = cr.x * TILE, py = cr.y * TILE + 4;
  const air = cr.state === 'in' || cr.state === 'out';
  c.fillStyle = 'rgba(10,8,4,' + (air ? 0.16 : 0.3) + ')';
  c.beginPath(); c.ellipse(px, py, air ? 6 : 6.5, 2, 0, 0, 7); c.fill();
  let spr;
  if (air) spr = crowSprite('f' + (Math.floor(cr.ph * 27) % 12));
  else spr = (cr.walking ? crowSprite('w' + (Math.floor(cr.ph * 21) % 12)) : crowSprite('s0'));
  const w = spr.width, h = spr.height;
  const lift = air ? cr.z : (cr.peck > 0 && (Math.floor(cr.ph * 6) & 1) ? -1 : 0);
  const y0 = air ? py - cr.z - h * 0.62 : py - h + 1;
  c.imageSmoothingEnabled = false;
  c.save(); c.translate(Math.round(px), Math.round(y0 - (air ? 0 : lift)));
  if (cr.face < 0) c.scale(-1, 1);
  c.drawImage(spr, -Math.round(w / 2), 0);
  c.restore();
  if (air && cr.item) { c.save(); c.translate(px + cr.face * 7, py - cr.z + 1); c.scale(0.3, 0.3); drawLoad(c, cr.item); c.restore(); }
  c.imageSmoothingEnabled = R.smooth;
}

// ---------- Лягушки и черви ----------
let lastRainFrogLog = -999;

function frogSpot() {
  for (let k = 0; k < 80; k++) {
    const x = (Math.random() * MAP_W) | 0, y = (Math.random() * MAP_H) | 0;
    if (isWaterAt(x, y) || !isWalkable(x, y) || World.bmap[idx(x, y)] || World.road[idx(x, y)]) continue;
    if (!(isWaterAt(x + 1, y) || isWaterAt(x - 1, y) || isWaterAt(x, y + 1) || isWaterAt(x, y - 1) || isWaterAt(x + 2, y) || isWaterAt(x - 2, y))) continue;
    return [x, y];
  }
  return null;
}

function nearestWater(f) {
  let best = null, bd = 1e9;
  for (let dy = -9; dy <= 9; dy++) for (let dx = -9; dx <= 9; dx++) {
    const x = Math.floor(f.x) + dx, y = Math.floor(f.y) + dy;
    if (!isWaterAt(x, y)) continue;
    const d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = [x + 0.5, y + 0.5]; }
  }
  return best;
}

function frogsTick(dt) {
  const frogs = Game.frogs || (Game.frogs = []), worms = Game.worms || (Game.worms = []);
  const rain = isRaining(), heavy = rainAmt() > 0.5;
  Game.frogSpawnT = (Game.frogSpawnT || 0) - dt;
  if (heavy && Game.frogSpawnT <= 0) {
    Game.frogSpawnT = 3 + Math.random() * 3;
    if (frogs.length < 7) {
      const s = frogSpot();
      if (s) {
        frogs.push({ x: s[0] + 0.5, y: s[1] + 0.5, t: 1 + Math.random() * 2, hop: 0, id: Math.random() * 7, face: Math.random() < 0.5 ? 1 : -1, fx: 0, fy: 0, tx: 0, ty: 0, home: false, ph: Math.random() * 9 });
        if (Game.time - lastRainFrogLog > 500) { lastRainFrogLog = Game.time; fstat('frog'); logEvent('animal', 'С дождём к воде выбрались лягушки', s[0], s[1]); }
      }
    }
    if (worms.length < 10) {
      let t = null;
      for (let k = 0; k < 40 && !t; k++) { const i = (Math.random() * N_TILES) | 0; if (World.road[i] && !World.bmap[i]) t = [i % MAP_W, (i / MAP_W) | 0]; }
      if (!t) t = randomFreeNear(MAP_W >> 1, MAP_H >> 1, 3, 14, (x, y) => isWalkable(x, y) && !World.bmap[idx(x, y)]);
      if (t) worms.push({ x: t[0] + 0.15 + Math.random() * 0.7, y: t[1] + 0.3 + Math.random() * 0.5, age: 0, ph: Math.random() * 9 });
    }
  }
  for (let i = frogs.length - 1; i >= 0; i--) {
    const f = frogs[i];
    f.ph += dt;
    if (!rain) f.home = true;                                   // дождь кончился — домой, в воду
    if (f.hop > 0) {
      f.hop += dt * 2.4;
      const k = Math.min(1, f.hop - 0);
      f.x = f.fx + (f.tx - f.fx) * k; f.y = f.fy + (f.ty - f.fy) * k;
      if (f.hop >= 1) { f.hop = 0; f.t = f.home ? 0.15 : 0.8 + Math.random() * 3; if (isWaterAt(Math.floor(f.x), Math.floor(f.y))) { faunaSfx('splash', f.x, f.y); frogs.splice(i, 1); continue; } }
      continue;
    }
    f.t -= dt;
    if (f.t > 0) continue;
    let dx, dy;
    const near = nearestPerson(f, 1.6, u => isPerson(u));
    if (f.home) { const w = nearestWater(f); if (!w) { frogs.splice(i, 1); continue; } dx = w[0] - f.x; dy = w[1] - f.y; }
    else if (near) { dx = f.x - near.x; dy = f.y - near.y; }
    else { const a = Math.random() * Math.PI * 2; dx = Math.cos(a); dy = Math.sin(a); }
    const d = Math.hypot(dx, dy) || 1, step = Math.min(d, 0.6 + Math.random() * 0.6);
    const nx = f.x + dx / d * step, ny = f.y + dy / d * step;
    const wet = isWaterAt(Math.floor(nx), Math.floor(ny));
    if (inb(Math.floor(nx), Math.floor(ny)) && !World.bmap[idx(Math.floor(nx), Math.floor(ny))] && (wet || isWalkable(Math.floor(nx), Math.floor(ny)))) {
      f.fx = f.x; f.fy = f.y; f.tx = nx; f.ty = ny; f.hop = 0.001; faunaSfx('frogHop', f.x, f.y); if (Math.abs(dx) > 0.05) f.face = dx > 0 ? 1 : -1;
      if (Math.random() < 0.12) floater(f.x, f.y - 0.7, 'Ква!', '#cfe8a0');
    } else f.t = 0.5;
  }
  for (let i = worms.length - 1; i >= 0; i--) {
    const w = worms[i];
    w.ph += dt; w.age += dt;
    if (Math.random() < dt * 0.06) faunaSfx('wormSlither', w.x, w.y);
    if (!rain && w.age > 12 + (w.ph * 7 % 12)) { worms.splice(i, 1); continue; }     // подсохли и уползли
    const hen = nearestAnimal(w.x, w.y, 0.8, a => a.kind === 'chicken');
    if (hen) { floater(w.x, w.y - 0.6, 'Ам!', '#ffd8d8'); fstat('worm'); worms.splice(i, 1); }
  }
}

function drawFrog(c, f) {
  const px = f.x * TILE, py = f.y * TILE + 3;
  const arc = f.hop > 0.1 ? Math.sin(Math.min(1, f.hop) * Math.PI) * 9 : 0;
  c.fillStyle = 'rgba(10,8,4,0.28)';
  c.beginPath(); c.ellipse(px, py, 4.5 - arc * 0.2, 1.6, 0, 0, 7); c.fill();
  const spr = frogSprite(frogFrame(f)), w = spr.width, h = spr.height;
  c.imageSmoothingEnabled = false;
  c.save(); c.translate(Math.round(px), Math.round(py - h - arc + 1));
  if (f.face < 0) c.scale(-1, 1);
  c.drawImage(spr, -Math.round(w / 2), 0);
  c.restore();
  c.imageSmoothingEnabled = R.smooth;
}

function drawWorm(c, w) {
  const px = Math.round(w.x * TILE), py = Math.round(w.y * TILE);
  c.fillStyle = 'rgba(10,8,4,0.22)'; c.fillRect(px - 3, py + 2, 7, 1);
  for (let i = 0; i < 7; i++) {
    const wob = Math.round(Math.sin(w.ph * 5 + i * 0.9) * 1.1);
    c.fillStyle = i % 2 ? FA_PAL.R : FA_PAL.r;
    c.fillRect(px - 3 + i, py + wob, 1, 2);
  }
  c.fillStyle = '#f0b8b8'; c.fillRect(px + 2, py + Math.round(Math.sin(w.ph * 5 + 5.4) * 1.1), 1, 1);
}

// ---------- Светлячки ----------
// Кружат над кладбищем и над деревьями-«нечистью», пока те спят. Когда дерево проснулось — рой разлетается.
function fireflySources() {
  const out = [];
  const gy = graveyardOf();
  if (gy) out.push({ key: gy, x: gy.x + gy.w / 2, y: gy.y + gy.h / 2 + 0.3, n: 12, r: 2.4 });
  for (const e of Game.ents || []) if (e.state === 'sleep' && !e.water && !e.dead) {
    const [x, y] = entHomeXY(e);
    out.push({ key: e, x, y: y - 0.2, n: 7, r: 1.3 });
  }
  return out;
}

function firefliesTick(dt) {
  const fl = Game.flies || (Game.flies = []);
  const n = nightAmt();
  Game.flyT = (Game.flyT || 0) - dt;
  if (n < 0.1 || rainAmt() > 0.6) { fl.length = 0; return; }
  for (const f of fl) { f.a += f.w * dt; f.ph += dt; }
  if (Game.flyT > 0) return;
  Game.flyT = 2;
  if (fl.length && Math.random() < 0.4) { const f = fl[(Math.random() * fl.length) | 0]; faunaSfx('firefly', f.cx, f.cy); }
  if (n < 0.3) return;
  const src = fireflySources(), keys = new Set(src.map(s => s.key));
  for (let i = fl.length - 1; i >= 0; i--) if (!keys.has(fl[i].key)) fl.splice(i, 1);      // дерево проснулось или кладбище снесено
  const have = new Set(fl.map(f => f.key));
  let made = null;
  for (const s of src) {
    if (have.has(s.key)) continue;
    made = made || s;
    for (let k = 0; k < s.n; k++) fl.push({ key: s.key, cx: s.x, cy: s.y, r: 0.4 + Math.random() * s.r, a: Math.random() * 6.28, w: 0.25 + Math.random() * 0.5, z: 5 + Math.random() * 16, zw: 0.5 + Math.random() * 1.2, ph: Math.random() * 9, bl: 0.9 + Math.random() * 1.6 });
  }
  if (made && Game.flyNight !== nightIndex()) {
    Game.flyNight = nightIndex();
    fstat('fireflies');
    logEvent('night', 'Над кладбищем и спящими деревьями замерцали светлячки', made.x, made.y);
    if (Game.time - (Game.flyToast || -999) > 400) { Game.flyToast = Game.time; toast('Светлячки собрались там, где ночью проснётся нечисть'); }
  }
}

function drawFireflies(c) {
  const fl = Game.flies;
  if (!fl || !fl.length) return;
  const vis = Math.max(0, Math.min(1, (nightAmt() - 0.15) / 0.4));
  if (vis <= 0.02) return;
  const prevOp = c.globalCompositeOperation;
  for (const f of fl) {
    const x = (f.cx + Math.cos(f.a) * f.r + Math.sin(f.ph * 0.7) * 0.3) * TILE, y = (f.cy + Math.sin(f.a * 1.3) * f.r * 0.6) * TILE - f.z - Math.sin(f.ph * f.zw) * 3;
    const k = Math.max(0, Math.sin(f.ph * f.bl)) ** 0.6 * vis;
    if (k < 0.05) continue;
    const X = Math.round(x), Y = Math.round(y);
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = k * 0.16; c.fillStyle = '#d8f060'; c.fillRect(X - 3, Y - 2, 7, 5); c.fillRect(X - 2, Y - 3, 5, 7);     // круглое свечение из прямоугольников
    c.globalAlpha = k * 0.36; c.fillRect(X - 2, Y - 1, 5, 3); c.fillRect(X - 1, Y - 2, 3, 5);
    c.globalAlpha = k * 0.85; c.fillStyle = '#f2ff9a'; c.fillRect(X - 1, Y, 3, 1); c.fillRect(X, Y - 1, 1, 3);
    c.globalCompositeOperation = prevOp;
    c.globalAlpha = k; c.fillStyle = '#ffffe0'; c.fillRect(X, Y, 1, 1);
  }
  c.globalAlpha = 1; c.globalCompositeOperation = prevOp;
}

// ---------- Общий ход и отрисовка ----------
function faunaTick(dt) {
  if (!FAUNA_ON()) return;
  if (startOpen('critters')) crowsTick(dt);
  frogsTick(dt);
  firefliesTick(dt);
}

function faunaDrawList(list, c, x0, y0, x1, y1) {
  if (!FAUNA_ON()) return;
  for (const w of Game.worms || []) if (w.x >= x0 - 1 && w.x <= x1 + 1 && w.y >= y0 - 1 && w.y <= y1 + 2) list.push([w.y - 0.1, () => drawWorm(c, w)]);
  for (const f of Game.frogs || []) if (f.x >= x0 - 1 && f.x <= x1 + 1 && f.y >= y0 - 1 && f.y <= y1 + 2) list.push([f.y + 0.1, () => drawFrog(c, f)]);
  for (const cr of Game.crows || []) {
    if (cr.state === 'away' || cr.x < x0 - 2 || cr.x > x1 + 2 || cr.y < y0 - 3 || cr.y > y1 + 3) continue;
    list.push([cr.state === 'in' || cr.state === 'out' ? cr.y + 1.5 : cr.y + 0.15, () => drawCrow(c, cr)]);
  }
}

// Возгласы по всплывающим надписям
if (typeof FLOAT_SFX !== 'undefined') Object.assign(FLOAT_SFX, { 'Кар!': 'honk', 'Ква!': 'cluck' });
