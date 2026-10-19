'use strict';
// Вторая партия живности (после fauna.js): мыши и барсук воруют муку, белки, дятлы, кроты, ежи.
//  • мыши днём и ночью таскают муку из мельницы, пекарни и склада — гнома рядом боятся, роняют добычу;
//  • барсук по вечерам подкапывается к складу и утаскивает мешок муки, герой или трое гномов его прогонят;
//  • белки бегают между деревьями, дятлы стучат по стволам, кроты подрывают лужайки, ежи сворачиваются в клубок.
// Всё рисуется строками-картами в пиксель-арте. Итоги пишутся в Game.faunaStat (идёт в сохранение).

const F2_PAL = {
  m: '#9a948a', M: '#6a645c', p: '#d8a0a0', k: '#14121a', F: '#f4f0e2', e: '#e8e2c4',
  b: '#8c8c96', B: '#56565e', W: '#f0ece0', n: '#25252c',
  o: '#c06a2c', O: '#8a4418', c: '#ecd0a8', t: '#d8884a',
  q: '#74523a', Q: '#3e2c1e', f: '#dcbc94', x: '#b08a58',
  v: '#403a48', V: '#605668', P: '#ecaaa8',
  D: '#7a5636', d: '#4e3622', L: '#9a7a52',
  r: '#d42c24', y: '#b0a078', a: '#2c2c36', s: '#ece8dc',
};
const F2_CACHE = {};
const f2sprite = (k, rows) => F2_CACHE[k] || (F2_CACHE[k] = faSprite(rows, F2_PAL));

// ---------- Карты ----------
const MOUSE_A = ['.......Mm.', '..mmmmmkp.', '.mmmmmmmm.', 'pmmmmmmmm.', '.p.mmmmm..', '...m..m...'];
const MOUSE_B = ['.......Mm.', '..mmmmmkp.', '.mmmmmmmm.', 'pmmmmmmmm.', '.p.mmmmm..', '..m....m..'];
const BADGER_A = [
  '.....................',
  '.............nn......',
  '....bbbbbbbbbWWWWn...',
  '..bbbbbbbbbbbbnnknn..',
  '.bbbbbbbbbbbbbWWWWWn.',
  'bbbbbbbbbbbbbbbbWWnnn',
  '.BBBBBBBBBBBBBBBBBn..',
  '..B.B.......B.B......',
  '..n.n.......n.n......',
];
const BADGER_B = BADGER_A.slice(0, 7).concat(['...B.B.....B.B........', '...n.n.....n.n........']);
const BADGER_DIG = [
  '.....................',
  '.....................',
  '.....................',
  '...bbbbbbbbb.........',
  '.bbbbbbbbbbbbWWWn....',
  'bbbbbbbbbbbbbnnknn...',
  'bbbbbbbbbbbbbbWWWWWn.',
  '.BBBBBBBBBBBBBBBWWnn.',
  '..B.B.......B.B.Bnn..',
  '..n.n.......n.n.n....',
];
const SQ_SIT = [
  '.oo.......o.o',
  'oOOo.....oooo',
  'oOOoo...okooo',
  'oOOooo.ooooc.',
  '.oOoooooccc..',
  '..ooooooccc..',
  '...ooooocc...',
  '...oOO.Ott...',
];
const SQ_RUN = [
  '...oo........',
  '..oOOo....o.o',
  '.oOOOoo..oooo',
  '.oOooooooookp',
  '..ooooooooo..',
  '...ooooooc...',
  '..OO..OO.....',
];
const SQ_RUN2 = [
  '....oo.......',
  '..ooOOo...o.o',
  '.oOOOoo..oooo',
  '.oOooooooookp',
  '..ooooooooo..',
  '...ooooooc...',
  '....OO..OO...',
];
const HEDGE = [
  '...qQqQqQq...',
  '..qQqQxQqQq..',
  '.qQxQqQqQxQq.',
  'qQqQqQxQqQqQq',
  'qQxQqQqQqQQff',
  '.QqQqQqQqffkf',
  '..qqqqqqqqfpf',
  '...f.f..f.f..',
];
const HEDGE_BALL = [
  '..qQqQxQqQq..',
  '.qQxQqQqQxQq.',
  'qQqQqQxQqQqQq',
  'QqQxQqQqQqxQq',
  'qQqQqQqQqQqQq',
  '.qQqQxQqQqQq.',
  '..QqQqQqQqQ..',
];
const MOLE_HEAD = ['..vv..', '.vVVv.', 'vVvvkv', 'vvvvvv', '.PPPP.', '..PP..'];
const MOLE_HEAD2 = ['..vv..', '.vVVv.', 'vVvvkv', 'vvvvvv', 'PPPPPP', '.PPPP.'];
const HILL = ['....DDDD....', '..DDLLLDDD..', '.DDLLLLLDDd.', 'DDDLLLLDDDdd', 'dDDDDDDDDddd', '.dddddddddd.'];
const PECKER_A = [
  '.rrr..',
  'rrrrr.',
  'raake.',
  'saaaay',
  'saaaa.',
  'saaaa.',
  'ssaaa.',
  'saaaa.',
  '.aaa..',
  '..aa..',
  '..ss..',
];
const PECKER_B = [
  '..rrr.',
  '.rrrr.',
  '.aakey',
  'saaaa.',
  'saaaa.',
  'saaaa.',
  'ssaaa.',
  'saaaa.',
  '.aaa..',
  '..aa..',
  '..ss..',
];

function f2draw(c, key, rows, x, y, face = 1, lift = 0, shadow = true) {
  const spr = f2sprite(key, rows), w = spr.width, h = spr.height;
  if (shadow) { c.fillStyle = 'rgba(10,8,4,0.28)'; c.beginPath(); c.ellipse(x, y, Math.max(3, w * 0.38), 1.6, 0, 0, 7); c.fill(); }
  c.imageSmoothingEnabled = false;
  c.save(); c.translate(Math.round(x), Math.round(y - h - lift + 1));
  if (face < 0) c.scale(-1, 1);
  c.drawImage(spr, -Math.round(w / 2), 0);
  c.restore();
  c.imageSmoothingEnabled = R.smooth;
}

// Прямой шаг к точке без поиска пути; false — упёрся
function f2move(o, tx, ty, speed, dt) {
  const dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy);
  if (d < 0.06) { o.moving = false; return true; }
  const s = Math.min(d, speed * dt), nx = o.x + dx / d * s, ny = o.y + dy / d * s;
  const cx = Math.floor(nx), cy = Math.floor(ny);
  if (!inb(cx, cy) || World.bmap[idx(cx, cy)] && !(o.pass && World.door[idx(cx, cy)]) || World.terrain[idx(cx, cy)] === T_ROCK || World.terrain[idx(cx, cy)] === T_WATER) { o.moving = false; return false; }
  o.x = nx; o.y = ny; o.moving = true; o.ph = (o.ph || 0) + s * 5;
  if (Math.abs(dx) > 0.01) o.face = dx > 0 ? 1 : -1;
  return s >= d;
}

// Здания, где есть мука
function flourPlaces() {
  const out = [];
  for (const b of Game.buildings) {
    if (b.state !== 'done' || b.removed || !b.stock) continue;
    const n = b.stock.flour - (b.reserved ? b.reserved.flour : 0);
    if (n >= 1 && (b.type === 'mill' || b.type === 'bakery' || b.type === 'storehouse')) out.push(b);
  }
  return out;
}

let lastMouseToast = -99, lastMouseLog = -99, lastBadgerToast = -99;

// ---------- Мыши ----------
function miceTick(dt) {
  const mice = Game.mice || (Game.mice = []);
  Game.mouseT = (Game.mouseT || 0) - dt;
  if (Game.mouseT <= 0) {
    Game.mouseT = 14 + Math.random() * 18;
    const places = flourPlaces();
    if (places.length && mice.length < 4 && !isRaining()) {
      const b = places[(Math.random() * places.length) | 0];
      const hole = randomFreeNear(b.doorX, b.doorY, 3, 6, (x, y) => isWalkable(x, y) && !World.road[idx(x, y)] && !World.bmap[idx(x, y)]);
      if (hole) mice.push({ x: hole[0] + 0.5, y: hole[1] + 0.5, hx: hole[0] + 0.5, hy: hole[1] + 0.5, b, state: 'in', t: 0, face: 1, ph: Math.random() * 9, carry: false, pass: true, moving: true });
    }
  }
  for (let i = mice.length - 1; i >= 0; i--) {
    const m = mice[i];
    m.sc = (m.sc || 0) - dt;
    if (m.state !== 'out' && m.state !== 'flee' && m.sc <= 0) {         // гном рядом — удирает
      m.sc = 0.25;
      if (nearestPerson(m, m.state === 'steal' ? 1.1 : 1.7, u => isPerson(u) && u.type !== 'carter')) {
        m.state = 'flee'; floater(m.x, m.y - 0.5, 'Пи!', '#e8e0d0'); faunaSfx('mouseRustle', m.x, m.y, 1, 0.1);
      }
    }
    if (m.state === 'in') {
      const b = m.b;
      if (b.removed) { mice.splice(i, 1); continue; }
      if (f2move(m, b.doorX + 0.5, b.doorY + 0.7, 1.9, dt) || Math.hypot(m.x - b.doorX - 0.5, m.y - b.doorY - 0.7) < 0.25) { m.state = 'steal'; m.t = 0; m.moving = false; }
      else if (!m.moving) { m.state = 'out'; }
    } else if (m.state === 'steal') {
      m.t += dt;
      if (Math.random() < dt * 1.8) faunaSfx('mouseGnaw', m.x, m.y);
      if (m.t > 1.4) {
        const b = m.b;
        if (!b.removed && b.stock.flour - b.reserved.flour >= 1) {
          b.stock.flour--; m.carry = true; fstat('mouse');
          if (Game.time - lastMouseLog > 40) { lastMouseLog = Game.time; logEvent('animal', `Мыши растаскивают муку: ${BUILDINGS[b.type].name.toLowerCase()}`, m.x, m.y); }
          if (Game.time - lastMouseToast > 150) { lastMouseToast = Game.time; toast(`Мыши воруют муку: ${BUILDINGS[b.type].name.toLowerCase()}!`); }
        }
        m.state = 'out';
      }
    } else if (m.state === 'out' || m.state === 'flee') {
      if (m.state === 'flee' && m.carry) {      // уронила мешочек
        m.carry = false; dropPile(Math.floor(m.x), Math.floor(m.y), 'flour', 1);
      }
      const sp = m.state === 'flee' ? 3 : 2.3;
      if (f2move(m, m.hx, m.hy, sp, dt) || !m.moving) mice.splice(i, 1);
    }
  }
}
function drawMouse(c, m) {
  const px = m.x * TILE, py = m.y * TILE + 3;
  if (m.moving) { const i = Math.floor(m.ph * 3) % 6; f2draw(c, 'mouseW' + i, gaitRows(MOUSE_A, 1, 6, i), px, py, m.face, 0); }   // 6 кадров семенящего шага
  else f2draw(c, 'mouseA', MOUSE_A, px, py, m.face, 0);
  if (m.carry) { c.fillStyle = F2_PAL.F; c.fillRect(Math.round(px) + m.face * 4 - 1, Math.round(py) - 8, 3, 3); c.fillStyle = F2_PAL.M; c.fillRect(Math.round(px) + m.face * 4 - 1, Math.round(py) - 8, 3, 1); }
}

// ---------- Барсук ----------
function badgerTick(dt) {
  const bd = Game.badger || (Game.badger = { state: 'away', t: 40 + Math.random() * 60, x: 0, y: 0, face: 1, ph: 0, path: null, pi: 0, moving: false, carry: 0 });
  bd.ph += dt * 3;
  const n = nightAmt();
  if (bd.state === 'away') {
    bd.t -= dt;
    if (bd.t > 0) return;
    const places = n > 0.25 ? flourPlaces() : [];
    if (!places.length || Game.buildings.filter(b => b.state === 'done').length < 3) { bd.t = 20; return; }
    const b = places[(Math.random() * places.length) | 0];
    const cx = MAP_W >> 1, cy = MAP_H >> 1, a = Math.atan2(b.doorY - cy, b.doorX - cx) + (Math.random() - 0.5);
    const s = randomFreeNear(Math.round(b.doorX + Math.cos(a) * 20), Math.round(b.doorY + Math.sin(a) * 20), 0, 5, (x, y) => isWalkable(x, y)) || wildSpot(16);
    if (!s) { bd.t = 30; return; }
    Object.assign(bd, { state: 'go', x: s[0] + 0.5, y: s[1] + 0.5, b, path: null, carry: 0, home: s, dig: 0 });
    animalGo(bd, b.doorX, b.doorY + 1);
    return;
  }
  // спугнуть: герой или трое гномов
  bd.sc = (bd.sc || 0) - dt;
  if (bd.sc <= 0 && bd.state !== 'flee') {
    bd.sc = 0.3;
    const s = shooersNear(bd.x, bd.y, 4, 3, 3.2);
    if (s) {
      shooWave(s, 'Кыш!'); floater(bd.x, bd.y - 1, 'Фр-р!', '#e0e0e0'); faunaSfx('badgerSnort', bd.x, bd.y, 1, 0.5);
      if (bd.carry) { dropPile(Math.floor(bd.x), Math.floor(bd.y), 'flour', bd.carry); bd.carry = 0; }
      bd.state = 'flee'; fstat('badgerShoo'); animalGo(bd, bd.home[0], bd.home[1]);
    }
  }
  if (bd.state === 'go') {
    if (animalStep(bd, dt, 1.9) || !bd.path) {
      bd.state = 'dig'; bd.dig = 0; bd.moving = false;
      (Game.holes || (Game.holes = [])).push({ x: bd.x, y: bd.y + 0.2, t0: Game.time });
      if (Game.holes.length > 8) Game.holes.shift();
    }
  } else if (bd.state === 'dig') {
    bd.dig += dt;
    if (Math.random() < dt * 2.2) faunaSfx('badgerDig', bd.x, bd.y);
    if (Math.random() < dt * 6) (Game.dirt || (Game.dirt = [])).push({ x: bd.x + bd.face * 0.3, y: bd.y, vx: (Math.random() - 0.5) * 1.4, vy: -1.6 - Math.random(), z: 0.3, t: 0 });
    if (bd.dig > 3.4) {
      const b = bd.b;
      const have = !b.removed ? Math.floor(b.stock.flour - b.reserved.flour) : 0;
      const take = Math.min(3, have);
      if (take > 0) {
        b.stock.flour -= take; bd.carry = take; fstat('badger');
        logEvent('animal', `Барсук подкопался и утащил муку: ${BUILDINGS[b.type].name.toLowerCase()}`, bd.x, bd.y);
        if (Game.time - lastBadgerToast > 120) { lastBadgerToast = Game.time; toast('Барсук подкопался и утащил муку! Прогоните его героем или втроём'); }
      }
      bd.state = 'flee'; animalGo(bd, bd.home[0], bd.home[1]);
    }
  } else if (bd.state === 'flee') {
    if (animalStep(bd, dt, 2.6) || !bd.path) { bd.state = 'away'; bd.t = 140 + Math.random() * 140; bd.carry = 0; bd.moving = false; }
  }
}
function drawBadger(c, bd) {
  if (bd.state === 'away') return;
  const px = bd.x * TILE, py = bd.y * TILE + 4;
  if (bd.state === 'dig') f2draw(c, 'badgerD', BADGER_DIG, px, py, bd.face, 0);
  else if (bd.moving) { const i = Math.floor(bd.ph * 3) % 6; f2draw(c, 'badgerW' + i, gaitRows(BADGER_A, 2, 6, i), px, py, bd.face, 0); }
  else f2draw(c, 'badgerA', BADGER_A, px, py, bd.face, 0);
  if (bd.carry) { c.fillStyle = F2_PAL.F; c.fillRect(Math.round(px) + bd.face * 8 - 2, Math.round(py) - 11, 5, 4); c.fillStyle = F2_PAL.M; c.fillRect(Math.round(px) + bd.face * 8 - 2, Math.round(py) - 11, 5, 1); }
}
function drawHole(c, h) {
  const age = Game.time - h.t0; if (age > 200) return;
  const a = Math.min(1, (200 - age) / 60);
  c.globalAlpha = a; c.fillStyle = F2_PAL.d; c.beginPath(); c.ellipse(h.x * TILE, h.y * TILE + 4, 6, 2.6, 0, 0, 7); c.fill();
  c.fillStyle = F2_PAL.L; c.fillRect(Math.round(h.x * TILE) - 6, Math.round(h.y * TILE) + 1, 3, 2); c.fillRect(Math.round(h.x * TILE) + 4, Math.round(h.y * TILE) + 2, 3, 2);
  c.globalAlpha = 1;
}

// ---------- Белки ----------
function treeSpot(cx, cy, r) {
  for (let k = 0; k < 50; k++) {
    const x = Math.round(cx + (Math.random() - 0.5) * 2 * r), y = Math.round(cy + (Math.random() - 0.5) * 2 * r);
    if (!inb(x, y)) continue;
    const o = World.obj[idx(x, y)];
    if (o && o.t === 'tree' && o.g >= 1) return [x, y];
  }
  return null;
}
function squirrelsTick(dt) {
  const sq = Game.squirrels || (Game.squirrels = []);
  const day = nightAmt() < 0.3 && !isRaining();
  Game.sqT = (Game.sqT || 0) - dt;
  if (Game.sqT <= 0) {
    Game.sqT = 12 + Math.random() * 14;
    if (day && sq.length < 3 && Game.buildings.filter(b => b.state === 'done').length >= 2) {
      const t = treeSpot(MAP_W >> 1, MAP_H >> 1, 18);
      if (t) sq.push({ x: t[0] + 0.5, y: t[1] + 0.85, state: 'sit', t: 1.5, face: 1, ph: 0, moving: false, tree: t, life: 90 + Math.random() * 120 });
    }
  }
  for (let i = sq.length - 1; i >= 0; i--) {
    const s = sq[i];
    s.t -= dt; s.life -= dt; s.ph += dt;
    if (s.state !== 'hide' && s.state !== 'flee') {
      s.sc = (s.sc || 0) - dt;
      if (s.sc <= 0) { s.sc = 0.3; if (nearestPerson(s, 2, u => isPerson(u))) { s.state = 'flee'; s.moving = true; faunaSfx('squirrelChatter', s.x, s.y); faunaSfx('barkRustle', s.x, s.y, 1, 0.4); } }
    }
    if (!day && s.state !== 'hide') s.state = 'flee';
    if (s.state === 'flee') {
      const to = s.tree;
      if (f2move(s, to[0] + 0.5, to[1] + 0.85, 3.4, dt) || !s.moving) { s.state = 'hide'; s.t = 2 + Math.random() * 3; }
      continue;
    }
    if (s.state === 'hide') {
      if (s.life <= 0 || !day) { sq.splice(i, 1); continue; }
      if (s.t <= 0) { s.state = 'sit'; s.t = 2 + Math.random() * 3; }
      continue;
    }
    if (s.state === 'sit') {
      s.moving = false;
      if (Math.random() < dt * 0.15) faunaSfx('squirrelCrack', s.x, s.y);
      if (s.t <= 0) {
        if (s.life <= 0) { s.state = 'flee'; continue; }
        const nt = treeSpot(s.tree[0], s.tree[1], 9);
        if (nt && (nt[0] !== s.tree[0] || nt[1] !== s.tree[1])) { s.dest = nt; s.state = 'run'; faunaSfx('barkRustle', s.x, s.y); } else s.t = 2;
      }
    } else if (s.state === 'run') {
      const d = s.dest;
      if (f2move(s, d[0] + 0.5, d[1] + 0.85, 2.3, dt)) { s.tree = d; s.state = Math.random() < 0.5 ? 'hide' : 'sit'; s.t = 2 + Math.random() * 4; s.moving = false; }
      else if (!s.moving) { s.state = 'sit'; s.t = 1.5; }
    }
  }
}
function drawSquirrel(c, s) {
  if (s.state === 'hide') return;
  const px = s.x * TILE, py = s.y * TILE + 2;
  if (s.moving) { const i = Math.floor(s.ph * 24) % 6; f2draw(c, 'sqW' + i, gaitRows(i < 3 ? SQ_RUN : SQ_RUN2, 1, 6, i), px, py, s.face, [0, 1, 2, 2, 1, 0][i]); }   // скачет: 6 кадров, дуга прыжка
  else f2draw(c, 'sqS', SQ_SIT, px, py, s.face, 0);
}

// ---------- Дятлы ----------
function peckersTick(dt) {
  const pk = Game.peckers || (Game.peckers = []);
  const day = nightAmt() < 0.3 && !isRaining();
  Game.pkT = (Game.pkT || 0) - dt;
  if (Game.pkT <= 0) {
    Game.pkT = 20 + Math.random() * 25;
    if (day && pk.length < 2 && Game.buildings.filter(b => b.state === 'done').length >= 2) {
      const t = treeSpot(MAP_W >> 1, MAP_H >> 1, 17);
      if (t) pk.push({ tree: t, state: 'peck', t: 8 + Math.random() * 14, ph: Math.random() * 9, face: Math.random() < 0.5 ? 1 : -1, life: 100 + Math.random() * 100, a: 0 });
    }
  }
  for (let i = pk.length - 1; i >= 0; i--) {
    const p = pk[i];
    p.t -= dt; p.life -= dt; p.ph += dt;
    if (!day) { pk.splice(i, 1); continue; }
    if (p.state === 'peck') {
      if (Math.random() < dt * 0.35) floater(p.tree[0] + 0.5, p.tree[1] - 0.6, 'Тук-тук!', '#e8d8b0');
      p.dr = (p.dr || 0) - dt;
      if (p.dr <= 0) { p.dr = 1.2 + Math.random() * 2.4; faunaSfx('peckDrum', p.tree[0] + 0.5, p.tree[1]); }
      const near = nearestPerson({ x: p.tree[0] + 0.5, y: p.tree[1] + 0.5 }, 2.2, u => isPerson(u));
      if (p.t <= 0 || near) { p.state = 'gone'; p.t = 3 + Math.random() * 4; faunaSfx('peckWhistle', p.tree[0] + 0.5, p.tree[1]); }
    } else {
      if (p.life <= 0) { pk.splice(i, 1); continue; }
      if (p.t <= 0) { const nt = treeSpot(p.tree[0], p.tree[1], 8); if (nt) p.tree = nt; p.state = 'peck'; p.t = 8 + Math.random() * 14; p.face = Math.random() < 0.5 ? 1 : -1; }
    }
  }
}
function drawPecker(c, p) {
  if (p.state !== 'peck') return;
  const f = Math.floor(p.ph * 7) & 1;
  const x = (p.tree[0] + 0.5) * TILE + p.face * 4, y = (p.tree[1] + 0.5) * TILE;
  f2draw(c, f ? 'pkB' : 'pkA', f ? PECKER_B : PECKER_A, x, y - 3, p.face, 8, false);
}

// ---------- Кроты ----------
function molesTick(dt) {
  const hills = Game.hills || (Game.hills = []);
  Game.molT = (Game.molT || 0) - dt;
  if (Game.molT <= 0) {
    Game.molT = 25 + Math.random() * 30;
    if (hills.length < 6 && !isRaining() && Game.buildings.filter(b => b.state === 'done').length >= 2) {
      const cx = (MAP_W >> 1) + ((Math.random() - 0.5) * 24 | 0), cy = (MAP_H >> 1) + ((Math.random() - 0.5) * 18 | 0);
      const s = randomFreeNear(cx, cy, 0, 4, (x, y) => isFreeGrass(x, y) && !World.road[idx(x, y)] && !World.bmap[idx(x, y)]);
      if (s) {
        const dir = Math.random() * 6.28, n = 1 + ((Math.random() * 3) | 0);
        for (let k = 0; k < n; k++) {
          const x = s[0] + 0.5 + Math.cos(dir) * k * 1.1, y = s[1] + 0.5 + Math.sin(dir) * k * 0.8;
          if (isFreeGrass(Math.floor(x), Math.floor(y))) hills.push({ x, y, t0: Game.time + k * 2, life: 140 + Math.random() * 100, up: 4 + Math.random() * 8, ph: Math.random() * 9 });
        }
        if (!Game.moleLog || Game.time - Game.moleLog > 600) { Game.moleLog = Game.time; fstat('mole'); logEvent('animal', 'Крот перепахал лужайку: кучки земли', s[0], s[1]); }
      }
    }
  }
  for (let i = hills.length - 1; i >= 0; i--) {
    const h = hills[i];
    if (Game.time - h.t0 > h.life) { hills.splice(i, 1); continue; }
    const wasUp = h.up > 0;
    h.up -= dt;
    if (wasUp && h.up <= 0) { faunaSfx('moleRustle', h.x, h.y); faunaSfx('molePeep', h.x, h.y, 1, 0.35); }
    if (h.up <= -1.8) h.up = 5 + Math.random() * 9;
    if (h.up < 0 && nearestPerson(h, 1.8, u => isPerson(u))) h.up = 3 + Math.random() * 4;    // спрятался
  }
}
function drawHill(c, h) {
  const age = Game.time - h.t0; if (age < 0) return;
  const grow = Math.min(1, age / 1.5), fade = Math.min(1, (h.life - age) / 20);
  const px = h.x * TILE, py = h.y * TILE + 3;
  c.globalAlpha = fade;
  const spr = f2sprite('hill', HILL);
  c.imageSmoothingEnabled = false;
  c.drawImage(spr, Math.round(px - spr.width / 2), Math.round(py - spr.height * grow), spr.width, Math.max(1, Math.round(spr.height * grow)));
  if (h.up < 0 && grow >= 1) {                 // кротик выглядывает из кучки
    const m = (Math.floor(h.ph + age * 2) & 1) ? MOLE_HEAD : MOLE_HEAD2;
    const ms = f2sprite(m === MOLE_HEAD ? 'mole1' : 'mole2', m);
    const rise = Math.min(1, -h.up * 2) * ms.height;
    c.save(); c.beginPath(); c.rect(px - 8, py - 22, 16, 22 - 2); c.clip();
    c.drawImage(ms, Math.round(px - ms.width / 2), Math.round(py - 4 - rise));
    c.restore();
  }
  c.globalAlpha = 1; c.imageSmoothingEnabled = R.smooth;
}

// ---------- Ёжики ----------
function hedgehogsTick(dt) {
  const hh = Game.hedgehogs || (Game.hedgehogs = []);
  const n = nightAmt();
  const dusk = (n > 0.12 && n < 0.9) || (n >= 0.9 && Math.random() < 0.002 * dt * 60);
  Game.hgT = (Game.hgT || 0) - dt;
  if (Game.hgT <= 0) {
    Game.hgT = 20 + Math.random() * 20;
    if (n > 0.1 && hh.length < 2 && !isRaining() && Game.buildings.filter(b => b.state === 'done').length >= 2) {
      const s = randomFreeNear((MAP_W >> 1) + ((Math.random() - 0.5) * 30 | 0), (MAP_H >> 1) + ((Math.random() - 0.5) * 22 | 0), 0, 5, (x, y) => isFreeGrass(x, y) && !World.bmap[idx(x, y)]);
      if (s) hh.push({ x: s[0] + 0.5, y: s[1] + 0.5, face: 1, ph: 0, moving: false, state: 'walk', t: 0, wait: 1, go: null, ball: 0 });
    }
  }
  for (let i = hh.length - 1; i >= 0; i--) {
    const h = hh[i];
    h.t += dt;
    if (nightAmt() < 0.05 && h.state !== 'ball') { hh.splice(i, 1); continue; }
    if (h.ball > 0) { h.ball -= dt; h.moving = false; continue; }
    if (nearestPerson(h, 2.3, u => isPerson(u))) { h.ball = 5 + Math.random() * 3; h.moving = false; faunaSfx('hogSpines', h.x, h.y, 1, 0.15); if (Math.random() < 0.4) floater(h.x, h.y - 0.7, 'Фыр!', '#e8e0d0'); continue; }
    h.wait -= dt;
    if (!h.go && h.wait <= 0) { h.wait = 2 + Math.random() * 5; const t = randomFreeNear(Math.floor(h.x), Math.floor(h.y), 1, 3, (x, y) => isFreeGrass(x, y) && !World.bmap[idx(x, y)]); if (t) h.go = [t[0] + 0.5, t[1] + 0.5]; }
    if (h.go) { if (f2move(h, h.go[0], h.go[1], 0.55, dt) || !h.moving) h.go = null; } else h.moving = false;
    if (h.t > 240) h.state = 'old';
    if (h.state === 'old' && !h.ball) { hh.splice(i, 1); }
  }
}
function drawHedgehog(c, h) {
  const px = h.x * TILE, py = h.y * TILE + 3;
  if (h.ball > 0) f2draw(c, 'hgBall', HEDGE_BALL, px, py, h.face, 0);
  else if (h.moving) { const i = Math.floor(h.ph * 2) % 4; f2draw(c, 'hgW' + i, gaitRows(HEDGE, 1, 4, i), px, py, h.face, 0); }   // топочет: 4 кадра
  else f2draw(c, 'hg', HEDGE, px, py, h.face, 0);
}

// ---------- Брызги земли, общий ход и отрисовка ----------
function dirtTick(dt) {
  const d = Game.dirt; if (!d || !d.length) return;
  for (let i = d.length - 1; i >= 0; i--) {
    const p = d[i]; p.t += dt; p.x += p.vx * dt; p.vy += 7 * dt; p.z -= p.vy * dt;
    if (p.z <= 0 || p.t > 1) d.splice(i, 1);
  }
}

function fauna2Tick(dt) {
  if (!FAUNA_ON() || !startOpen('critters')) return;
  miceTick(dt); badgerTick(dt); squirrelsTick(dt); peckersTick(dt); molesTick(dt); hedgehogsTick(dt); dirtTick(dt);
}

function fauna2DrawList(list, c, x0, y0, x1, y1) {
  if (!FAUNA_ON()) return;
  const vis = (x, y) => x >= x0 - 1 && x <= x1 + 1 && y >= y0 - 2 && y <= y1 + 2;
  for (const h of Game.holes || []) if (vis(h.x, h.y)) list.push([h.y - 0.3, () => drawHole(c, h)]);
  for (const h of Game.hills || []) if (vis(h.x, h.y)) list.push([h.y - 0.05, () => drawHill(c, h)]);
  for (const m of Game.mice || []) if (vis(m.x, m.y)) list.push([m.y + 0.05, () => drawMouse(c, m)]);
  for (const h of Game.hedgehogs || []) if (vis(h.x, h.y)) list.push([h.y + 0.05, () => drawHedgehog(c, h)]);
  for (const s of Game.squirrels || []) if (vis(s.x, s.y)) list.push([s.y + 0.1, () => drawSquirrel(c, s)]);
  for (const p of Game.peckers || []) if (p.state === 'peck' && vis(p.tree[0], p.tree[1])) list.push([p.tree[1] + 1.05, () => drawPecker(c, p)]);
  const bd = Game.badger;
  if (bd && bd.state !== 'away' && vis(bd.x, bd.y)) list.push([bd.y + 0.1, () => drawBadger(c, bd)]);
  for (const p of Game.dirt || []) if (vis(p.x, p.y)) list.push([p.y + 0.5, () => { c.fillStyle = F2_PAL.D; c.fillRect(Math.round(p.x * TILE), Math.round(p.y * TILE - p.z * 8), 2, 2); }]);
}
