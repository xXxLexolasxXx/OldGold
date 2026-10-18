'use strict';
// Кладбище: когда нежить утаскивает гномов, на окраине само вырастает кладбище.
// Игрок его не строит: оно возводится само, кирпичик за кирпичиком, без работяг.
// Отсюда по ночам выходят призраки и поднимаются скелеты (см. ghosts.js, skeletons.js).

BUILDINGS.graveyard = {
  name: 'Кладбище', cat: 'Основа', w: 4, h: 3, top: 62, noRotate: true, hidden: true, cost: {},
  desc: 'Выросло само, там, где нечисти досталось больше всего гномов. Здесь по ночам поднимаются скелеты и выходят призраки. Чем больше потерь — тем больше нежити.',
};

MODELS.graveyard = function (m) {
  m.ground((c, mm) => {
    groundPoly(c, mm, [[2, 2], [126, 2], [126, 94], [2, 94]], 'rgba(48,42,34,0.8)');
    for (let k = 0; k < 40; k++) { const q = mm.at(rnd(6, 122), rnd(4, 90)); ellipse(c, q[0], q[1], rnd(1, 3), rnd(0.8, 1.6), k % 3 ? 'rgba(70,86,48,0.6)' : 'rgba(30,26,22,0.6)'); }
  });
  // склеп в глубине кладбища
  m.box({
    x0: 8, x1: 46, y0: 52, y1: 90, h: 24, wall: 'fieldstone', col: '#7e7c76', lowerStone: 6,
    roof: { type: 'gable', axis: 'Y', rise: 16, mat: 'shingle', col: '#3e3e48', ov: 3 },
    decor: { S: [{ t: 'door', at: 27, w: 12, h: 17, o: { square: true, col: '#1c120c' } }], E: [], W: [] },
    gable: { S: [{ t: 'win', at: 27, z: 4, w: 5, h: 6, o: { arch: true } }] },
  });
  // железная ограда с воротами у входа
  const gx = m.doorX;
  m.fence([[2, 94], [2, 2], [gx - 10, 2]], 9);
  m.fence([[gx + 10, 2], [126, 2], [126, 94]], 9);
  m.fence([[2, 94], [126, 94]], 9);
  // надгробия: кресты, плиты, круглые камни
  const stone = (c, x, y, kind, tilt) => {
    c.save(); c.translate(x, y); c.rotate(tilt);
    c.fillStyle = 'rgba(10,8,6,0.35)'; c.beginPath(); c.ellipse(1, 0, 6, 2, 0, 0, 7); c.fill();
    ellipse(c, 0, -0.5, 6, 2.4, '#4a4234');                                   // свежий холмик
    // камень плоскими пятнами: светлая левая грань, тёмная правая, без градиента
    c.fillStyle = '#9e9a8e'; c.strokeStyle = '#1e1a16'; c.lineWidth = 0.9;
    if (kind === 0) {
      c.beginPath(); c.moveTo(-3.4, -1); c.lineTo(-3.4, -11); c.quadraticCurveTo(0, -15, 3.4, -11); c.lineTo(3.4, -1); c.closePath(); c.fill();
      c.save(); c.clip(); c.fillStyle = '#c4c0b4'; c.fillRect(-3.4, -15, 2.2, 15); c.fillStyle = '#6c685e'; c.fillRect(1.4, -15, 2.2, 15); c.restore(); c.stroke();
      line(c, 0, -10, 0, -5, '#2a241c', 0.8); line(c, -1.8, -8, 1.8, -8, '#2a241c', 0.8);
    } else if (kind === 1) {
      c.fillRect(-1.2, -15, 2.4, 14); c.fillRect(-4.5, -12, 9, 2.4);
      c.fillStyle = '#c4c0b4'; c.fillRect(-1.2, -15, 0.8, 14); c.fillRect(-4.5, -12, 9, 0.7);
      c.fillStyle = '#6c685e'; c.fillRect(0.5, -15, 0.7, 14); c.fillRect(-4.5, -10.3, 9, 0.7);
      c.strokeRect(-1.2, -15, 2.4, 14); c.strokeRect(-4.5, -12, 9, 2.4);
    } else {
      c.beginPath(); c.moveTo(-4, -1); c.lineTo(-4, -8); c.lineTo(0, -12); c.lineTo(4, -8); c.lineTo(4, -1); c.closePath(); c.fill();
      c.save(); c.clip(); c.fillStyle = '#c4c0b4'; c.fillRect(-4, -12, 2.4, 12); c.fillStyle = '#6c685e'; c.fillRect(1.6, -12, 2.4, 12); c.restore(); c.stroke();
      line(c, -2, -6, 2, -6, '#2a241c', 0.7);
    }
    ellipse(c, -4, -1, 2, 1.1, 'rgba(60,84,40,0.8)');                          // мох у основания
    c.restore();
  };
  const spots = [[14, 22, 0, -0.06], [30, 18, 1, 0.05], [48, 26, 2, -0.04], [66, 14, 0, 0.07], [84, 24, 1, -0.05], [102, 16, 2, 0.04], [118, 28, 0, -0.07],
    [22, 40, 1, 0.06], [58, 42, 0, -0.04], [78, 46, 2, 0.05], [98, 38, 0, 0.0], [112, 52, 1, -0.06], [66, 66, 2, 0.04], [92, 70, 0, -0.05], [114, 78, 1, 0.05], [74, 86, 0, -0.04]];
  for (const [x, y, k, tl] of spots) m.prop((c, sx, sy) => stone(c, sx, sy, k, tl), x, y);
  // кривое мёртвое дерево и воронья свеча
  m.prop((c, x, y) => {
    c.strokeStyle = '#1a140e'; c.lineWidth = 2.6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x - 2, y - 14, x + 1, y - 26); c.stroke();
    c.lineWidth = 1.4; for (const [dx, dy, ex, ey] of [[0, -16, -9, -24], [1, -20, 9, -30], [0, -24, -5, -34], [1, -12, 8, -18]]) { c.beginPath(); c.moveTo(x + dx, y + dy); c.quadraticCurveTo(x + (dx + ex) / 2, y + dy - 3, x + ex, y + ey); c.stroke(); }
  }, 100, 60);
  m.prop((c, x, y) => { c.fillStyle = '#d8d0b0'; c.fillRect(x - 1.5, y - 6, 3, 6); c.fillStyle = '#ffd070'; c.beginPath(); c.ellipse(x, y - 8, 1.4, 2.4, 0, 0, 7); c.fill(); }, 54, 72);
};

// ---------- Самовозведение ----------

const GY_BUILD_HITS = 18, GY_STEP = 2.2;

function graveyardTick(dt) {
  const lost = Game.lostGnomes || 0;
  let gy = Game.buildings.find(b => b.type === 'graveyard' && !b.removed);
  if (!gy) {
    if (lost < 1 || Game.time < (Game.gyNext || 0) || !Game.units.length) return;
    gy = spawnGraveyard();
    if (!gy) { Game.gyNext = Game.time + 60; return; }
    Game.gyNext = Game.time + 400;
  }
  if (gy.state === 'build') {
    gy.gyT = (gy.gyT || 0) + dt;
    if (gy.gyT >= GY_STEP) {
      gy.gyT = 0; gy.hits++; gy.lastHit = Game.time;
      if (gy.hits % 3 === 0) fxBurst((gy.x + gy.w / 2 + (Math.random() - 0.5) * gy.w) * TILE, (gy.y + gy.h) * TILE, 8, ['#4a4234', '#2a241c', '#7a7468'], 40, 40, 0.8, 2, 200);
      if (gy.hits >= gy.maxHits) {
        gy.state = 'done'; gy.stock = emptyGoods(); gy._site = null;
        toast('Тихо, без единого стука, на окраине выросло кладбище…', gy);
        logEvent('night', 'На окраине само выросло кладбище', gy.x + gy.w / 2, gy.y + gy.h / 2);
        sfxAt('creak', (gy.x + gy.w / 2) * TILE, (gy.y + gy.h / 2) * TILE, 1.2);
      }
    }
  }
}

function spawnGraveyard() {
  let cx = 0, cy = 0, n = 0;
  for (const b of Game.buildings) if (b.type !== 'graveyard') { cx += b.x + b.w / 2; cy += b.y + b.h / 2; n++; }
  if (!n) return null;
  cx /= n; cy /= n;
  for (let tries = 0; tries < 300; tries++) {
    const a = Math.random() * Math.PI * 2, r = 9 + Math.random() * 9 + tries * 0.03;
    const x = Math.round(cx + Math.cos(a) * r - 2), y = Math.round(cy + Math.sin(a) * r * 0.8 - 1);
    if (checkPlacement('graveyard', x, y, 0)) continue;
    const gy = placeBuilding('graveyard', x, y, false, 0);
    gy.selfBuild = true; gy.state = 'build'; gy.hits = SITE_HITS; gy.maxHits = SITE_HITS + GY_BUILD_HITS; gy.total = 1;
    toast('На окраине из земли начало расти кладбище…', gy);
    logEvent('night', 'На окраине из земли начало расти кладбище', x + 2, y + 1);
    return gy;
  }
  return null;
}

function graveyardOf() { return Game.buildings.find(b => b.type === 'graveyard' && b.state === 'done' && !b.removed) || null; }

// Рисование растущего кладбища: без лесов и колышков — просто проступает из земли
function drawSelfBuild(c, b) {
  const spr = buildingSprite(b.type, b.rot || 0, 1);
  const fb = { buildFrac: (b.hits - SITE_HITS) / (b.maxHits - SITE_HITS), _site: b._site };
  const S = siteState(fb, spr);
  b._site = fb._site;
  const ox = b.x * TILE - spr.padx, oy = b.y * TILE - spr.top;
  c.imageSmoothingEnabled = true;
  c.globalAlpha = Math.min(1, fb.buildFrac * 1.5);
  c.drawImage(spr.shadow, ox, oy, spr.w, spr.h);
  c.globalAlpha = 1;
  c.drawImage(S.cv, ox, oy, spr.w, spr.h);
  const k = spr.canvas.width / spr.w;
  for (const p of S.pops) {
    const age = Game.time - p.t;
    if (age > 0.6) continue;
    const cl = p.cl, x = ox + cl.x / k, y = oy + cl.y / k, s = cl.s / k;
    if (age < 0.3) { c.fillStyle = `rgba(150,255,200,${0.4 * (1 - age / 0.3)})`; c.fillRect(x, y, s, s); }
  }
  c.imageSmoothingEnabled = R.smooth;
}
