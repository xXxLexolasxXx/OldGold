'use strict';
// Отрисовка кадра: земля, объекты, здания, жители, эффекты, призраки построек.
// Пиксель-арт: целочисленный масштаб, без сглаживания.

const R = {
  canvas: null, ctx: null,
  cam: { x: 0, y: 0, z: 2 },
  hover: null,           // клетка под курсором [x, y]
  hoverPx: null,         // позиция курсора в экранных px
  roadDrag: null,        // клетки, выделенные протяжкой дороги
  clouds: [],
};

const ZOOMS = [1, 2, 3, 4];

// Сколько CSS-пикселей экрана приходится на пиксель мира (целое число физических пикселей).
function camScale() {
  const dpr = window.devicePixelRatio || 1;
  return Math.max(1, Math.round(R.cam.z * dpr)) / dpr;
}

function initRender(canvas) {
  R.canvas = canvas;
  R.ctx = canvas.getContext('2d');
  const r = mulberry32(4242);
  R.clouds = [];
  for (let k = 0; k < 7; k++) R.clouds.push({
    x: r() * MAP_W * TILE, y: r() * MAP_H * TILE,
    rx: 160 + r() * 220, ry: 90 + r() * 120, v: 6 + r() * 6,
  });
}

function hash(i) { return (Math.imul(i, 2654435761) >>> 0); }

// ---------- Объекты ----------

function drawTree(c, x, y, o, i) {
  const h = hash(i);
  const spr = SPR.trees[h % SPR.trees.length];
  const s = o.g >= 1 ? 1 : 0.35 + 0.55 * o.g;
  const bx = x * TILE + 16 + ((h >>> 4) % 7) - 3, by = y * TILE + 28 + ((h >>> 12) % 5) - 2;
  c.fillStyle = 'rgba(12,18,6,0.35)';
  c.beginPath(); c.ellipse(bx + 6 * s, by - 1, 16 * s, 6 * s, 0, 0, 7); c.fill();
  const w = Math.round(spr.width * s), hh = Math.round(spr.height * s);
  c.drawImage(spr, Math.round(bx - w / 2), Math.round(by - hh * (88 / 92)), w, hh);
}

function drawStoneObj(c, x, y, o, i) {
  const k = Math.max(1, Math.ceil(o.n / 1.6));
  const offs = [[3, 12], [12, 4], [14, 14], [0, 2], [8, 8], [16, 22]];
  for (let j = Math.min(k, offs.length) - 1; j >= 0; j--) {
    const [ox, oy] = offs[j];
    const px = x * TILE + ox - 4, py = y * TILE + oy - 6;
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath(); c.ellipse(px + 16, py + 17, 11, 4, 0, 0, 7); c.fill();
    c.drawImage(SPR.boulders[(i + j) % SPR.boulders.length], px, py);
  }
}

function drawStump(c, x, y) {
  const px = x * TILE + 12, py = y * TILE + 18;
  c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(px + 1, py + 4, 10, 2);
  c.fillStyle = '#24170f'; c.fillRect(px - 1, py, 10, 5);
  c.fillStyle = '#583522'; c.fillRect(px, py + 1, 8, 4);
  c.fillStyle = '#341f14'; c.fillRect(px + 5, py + 1, 3, 4);
  c.fillStyle = '#cc9a64'; c.fillRect(px, py - 1, 8, 2);
  c.fillStyle = '#a06840'; c.fillRect(px + 3, py - 1, 2, 1);
}

function fieldStage(g) {
  if (g < 0) return 0;
  if (g < 0.35) return 1;
  if (g < 1) return 2;
  return 3;
}

// ---------- Жители ----------

function drawUnit(c, u) {
  const px = Math.round(u.x * TILE), py = Math.round(u.y * TILE + 6);
  const a = u.action;
  const moving = a && a.walk && a.path && !(a.block > 0 && !a.squeeze);
  let pose = 'idle', frame = 0, view = u.vdir || 'S';
  if (moving) { pose = 'walk'; frame = Math.floor(u.walkPhase / 1.1) & 7; }
  else if (u.anim === 'duck') pose = 'duck';
  else if (u.anim && ANIM_TOOL[u.anim]) { pose = 'work'; view = 'E'; frame = { anim: u.anim, f: Math.floor(Game.time * 5 + u.id) & 3 }; }
  c.fillStyle = 'rgba(10,8,4,0.32)';
  c.beginPath(); c.ellipse(px + 1.5, py - 0.2, 5.5, 2, 0, 0, 7); c.fill();
  const spr = personSprite(u, view, pose, frame);
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  if (view === 'E' && u.face < 0) {
    c.save(); c.translate(px, 0); c.scale(-1, 1);
    c.drawImage(spr, -PFX, py - PFY, PW, PH);
    c.restore();
  } else c.drawImage(spr, px - PFX, py - PFY, PW, PH);
  c.imageSmoothingEnabled = false;
  if (u.food <= 0) {
    c.fillStyle = '#160e0a'; c.fillRect(px + 4, py - 36, 4, 8);
    c.fillStyle = '#e04030'; c.fillRect(px + 5, py - 35, 2, 4); c.fillRect(px + 5, py - 30, 2, 1);
  }
}

// ---------- Животные ----------

const PIG_SPR = [];
function pigSprite(f) {
  if (PIG_SPR[f]) return PIG_SPR[f];
  const cv = mkCanvas(14, 10), c = cv.getContext('2d');
  px(c, 2, 2, 9, 5, '#eeaab2'); px(c, 3, 1, 7, 1, '#eeaab2'); px(c, 2, 6, 9, 1, '#d0808e');
  px(c, 10, 3, 3, 3, '#d0808e'); px(c, 12, 4, 1, 1, '#7a3a4a'); px(c, 9, 1, 2, 2, '#d0808e');
  px(c, 9, 3, 1, 1, '#160e0a'); px(c, 1, 2, 1, 2, '#d0808e');
  const l = f ? 1 : 0;
  px(c, 3 + l, 7, 2, 2, '#a85a6a'); px(c, 8 - l, 7, 2, 2, '#a85a6a');
  finishPixel(cv, true);
  PIG_SPR[f] = cv;
  return cv;
}

// Свинья: size 1/3, 2/3 или 3/3 взрослой.
const PIG_CACHE = {};
function pigSpriteHR(stage, f) {
  const key = stage + '_' + f;
  if (PIG_CACHE[key]) return PIG_CACHE[key];
  const s = [0.55, 0.75, 1][stage - 1];
  const [cv, c] = mkSprite(24, 16, 3);
  c.translate(12, 13); c.scale(s, s);
  const body = '#eaa8a8', dark = '#c07878';
  const leg = f ? 1 : -1;
  for (const [lx, d] of [[-5, leg], [-2, -leg], [3, leg], [6, -leg]]) { c.fillStyle = dark; c.fillRect(lx + d * 0.5, -2, 1.6, 3); c.fillStyle = '#5a3030'; c.fillRect(lx + d * 0.5, 0.6, 1.6, 0.7); }
  c.fillStyle = lingrad(c, 0, -10, 0, -1, [[0, '#f6c8c4'], [0.5, body], [1, dark]]);
  c.beginPath(); c.ellipse(0, -5, 8.5, 4.6, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = body; c.beginPath(); c.ellipse(7.5, -6, 3.6, 3.3, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#d88a8a'; c.beginPath(); c.ellipse(10.6, -5.4, 1.4, 1.6, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#7a3a3a'; c.fillRect(10.6, -6, 0.5, 0.5); c.fillRect(10.6, -4.8, 0.5, 0.5);
  c.fillStyle = '#1a0a0a'; c.fillRect(8.4, -7.4, 0.8, 0.8);
  c.fillStyle = dark; c.beginPath(); c.moveTo(6, -8.6); c.lineTo(7.6, -11); c.lineTo(8.6, -8.4); c.fill();
  c.strokeStyle = dark; c.lineWidth = 0.6; c.beginPath(); c.moveTo(-8.4, -6); c.quadraticCurveTo(-10.5, -8, -9, -9); c.stroke();
  c.fillStyle = 'rgba(110,70,40,0.35)'; c.beginPath(); c.ellipse(-2, -2.4, 4, 1.4, 0, 0, Math.PI * 2); c.fill();
  PIG_CACHE[key] = cv;
  return cv;
}

function drawPigs(c, b, spr, ox, oy) {
  const [x0, y0, x1, y1] = spr.pen;
  const pigs = [];
  for (let k = 0; k < b.stock.pig; k++) pigs.push(3);
  for (const s of b.pigs) pigs.push(s);
  pigs.forEach((stage, k) => {
    const t = Game.time * 0.22 + k * 2.3 + b.id;
    const fx = (Math.sin(t) * 0.5 + 0.5), fy = (Math.cos(t * 0.7 + k * 1.7) * 0.5 + 0.5);
    const x = ox + x0 + fx * (x1 - x0 - 24), y = oy + y0 + fy * (y1 - y0 - 14);
    const dir = Math.cos(t) >= 0 ? 1 : -1;
    const moving = Math.abs(Math.cos(t)) > 0.25;
    const s = pigSpriteHR(stage, moving ? Math.floor(Game.time * 5 + k) & 1 : 0);
    c.fillStyle = 'rgba(10,8,4,0.3)';
    c.beginPath(); c.ellipse(x + 13, y + 13, 7 * [0.55, 0.75, 1][stage - 1], 2, 0, 0, 7); c.fill();
    if (dir < 0) { c.save(); c.translate(x + 24, y); c.scale(-1, 1); c.drawImage(s, 0, 0, 24, 16); c.restore(); }
    else c.drawImage(s, x, y, 24, 16);
  });
}

// ---------- Здания ----------

function drawBuilding(c, b, ghost) {
  const spr = buildingSprite(b.type, b.rot || 0);
  const ox = b.x * TILE - spr.padx, oy = b.y * TILE - spr.top;
  const fx = b.x * TILE, fy = b.y * TILE, fw = b.w * TILE, fh = b.h * TILE;
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  if (!ghost && b.state !== 'done') {
    drawSite(c, b, spr, ox, oy, fx, fy, fw, fh);
    c.imageSmoothingEnabled = false;
    return;
  }
  c.drawImage(spr.shadow, ox, oy, spr.w, spr.h);
  c.drawImage(spr.canvas, ox, oy, spr.w, spr.h);
  const t = Game.time;
  if (b.type === 'mill' && spr.hub) drawSails(c, ox + spr.hub[0], oy + spr.hub[1], b.anim);
  if (spr.pen && b.stock) drawPigs(c, b, spr, ox, oy);
  c.imageSmoothingEnabled = false;
  if (spr.chimneys && (b.working || b.type === 'inn' || b.type === 'farm' || ghost))
    for (const [sx, sy] of spr.chimneys) drawSmoke(c, ox + sx, oy + sy, b.id + sx, b.working ? 1 : 0.5);
  if (spr.glow && (b.working || b.type === 'crystalmine')) {
    const gx = ox + spr.glow[0], gy = oy + spr.glow[1];
    const a = (b.working ? 0.35 : 0.2) + 0.12 * Math.sin(t * 7) + 0.08 * Math.sin(t * 19);
    glow(c, gx, gy, 18, spr.glowColor || '255,160,60', a);
  }
  if (spr.circle) {
    const [cx, cy] = spr.circle;
    const pulse = 0.5 + 0.5 * Math.sin(t * (b.working ? 3 : 1));
    glow(c, ox + cx, oy + cy, b.working ? 46 : 26, '150,100,255', (b.working ? 0.32 : 0.14) + pulse * 0.12);
    if (b.working) {
      for (let k = 0; k < 10; k++) {
        const p = (t * 0.5 + k / 10) % 1;
        const a = k / 10 * Math.PI * 2 + t * 0.4;
        const sx = ox + cx + Math.cos(a) * 30 * (1 - p), sy = oy + cy + 14 + Math.sin(a) * 22 * (1 - p) - p * 26;
        c.fillStyle = k % 2 ? '#bea4f6' : '#e2d6ff';
        c.globalAlpha = 1 - p;
        c.fillRect(Math.round(sx), Math.round(sy), 2, 2);
      }
      c.globalAlpha = 1;
    }
  }
  if (spr.cauldron && b.working) {
    const [cx, cy] = spr.cauldron;
    glow(c, ox + cx, oy + cy, 12, '140,90,255', 0.3);
    for (let k = 0; k < 4; k++) {
      const p = (t * 0.8 + k / 4) % 1;
      c.globalAlpha = 1 - p;
      c.fillStyle = '#9c7ae6';
      c.fillRect(Math.round(ox + cx - 3 + k * 2 + Math.sin(p * 6 + k) * 1.5), Math.round(oy + cy - 2 - p * 12), 2, 2);
    }
    c.globalAlpha = 1;
  }
}

function glow(c, x, y, r, rgb, a) {
  const g = c.createRadialGradient(x, y, 1, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
}

function drawSite(c, b, spr, ox, oy, fx, fy, fw, fh) {
  c.fillStyle = '#45291a'; c.fillRect(fx + 1, fy + 1, fw - 2, fh - 2);
  c.fillStyle = '#875434'; c.fillRect(fx + 2, fy + 2, fw - 4, fh - 4);
  const r = mulberry32(b.id);
  for (let k = 0; k < fw * fh / 30; k++) {
    c.fillStyle = r() < 0.5 ? '#6e432a' : '#a06840';
    c.fillRect(fx + 2 + ((r() * (fw - 6)) | 0), fy + 2 + ((r() * (fh - 6)) | 0), 2, 1);
  }
  for (const [sx, sy] of [[fx + 3, fy + 3], [fx + fw - 5, fy + 3], [fx + 3, fy + fh - 5], [fx + fw - 5, fy + fh - 5]]) {
    c.fillStyle = '#583522'; c.fillRect(sx, sy - 6, 2, 7);
    c.fillStyle = '#e0b882'; c.fillRect(sx, sy - 6, 2, 1);
  }
  c.fillStyle = '#e4ddd2';
  c.fillRect(fx + 4, fy + 3, fw - 8, 1); c.fillRect(fx + 4, fy + fh - 4, fw - 8, 1);
  if (b.state === 'build') {
    const p = b.progress;
    const visible = Math.max(2, Math.round((spr.h - 8) * p + 8));
    const sy = spr.h - visible;
    const k = spr.canvas.width / spr.w;
    c.drawImage(spr.canvas, 0, sy * k, spr.canvas.width, visible * k, ox, oy + sy, spr.w, visible);
    const topY = oy + sy;
    for (let k = 0; k <= b.w; k++) {
      const lx = Math.round(fx + 2 + k * (fw - 6) / b.w);
      c.fillStyle = '#583522'; c.fillRect(lx, Math.min(fy + fh - 10, topY - 4), 2, fy + fh - Math.min(fy + fh - 10, topY - 4));
      c.fillStyle = '#a06840'; c.fillRect(lx, Math.min(fy + fh - 10, topY - 4), 1, fy + fh - Math.min(fy + fh - 10, topY - 4));
    }
    for (let ly = fy + fh - 12; ly > topY - 2; ly -= 12) {
      c.fillStyle = '#45291a'; c.fillRect(fx, ly + 2, fw, 1);
      c.fillStyle = '#cc9a64'; c.fillRect(fx, ly, fw, 2);
    }
  }
  let mx = fx + 4;
  const my = fy + fh - 3;
  for (let k = 0; k < b.stock.timber; k++, mx += 6) {
    c.fillStyle = '#583522'; c.fillRect(mx - 1, my - 5, 7, 6);
    c.fillStyle = '#cc9a64'; c.fillRect(mx, my - 4, 5, 4);
    c.fillStyle = '#a06840'; c.fillRect(mx, my - 2, 5, 1);
  }
  for (let k = 0; k < b.stock.stone; k++, mx += 6) {
    c.fillStyle = '#3a3632'; c.fillRect(mx - 1, my - 5, 7, 6);
    c.fillStyle = '#9e958a'; c.fillRect(mx, my - 4, 5, 4);
    c.fillStyle = '#cec6ba'; c.fillRect(mx, my - 4, 5, 1);
  }
}

function drawSails(c, x, y, a) {
  c.save();
  c.translate(x, y);
  c.rotate(a);
  for (let k = 0; k < 4; k++) {
    c.rotate(Math.PI / 2);
    c.fillStyle = '#24170f'; c.fillRect(-1.5, 0, 3, 34);
    c.fillStyle = '#583522'; c.fillRect(-1, 0, 2, 33);
    c.fillStyle = '#341f14'; c.fillRect(0.5, 6, 9.5, 27);
    c.fillStyle = '#e4ddd2'; c.fillRect(1.5, 7, 7.5, 25);
    c.fillStyle = '#b6ada0'; c.fillRect(5, 7, 4, 25);
    c.fillStyle = '#583522';
    for (let s = 11; s < 32; s += 4) c.fillRect(1.5, s, 7.5, 1);
    c.fillRect(4.5, 7, 1, 25);
  }
  c.fillStyle = '#24170f'; c.fillRect(-3, -3, 6, 6);
  c.fillStyle = '#875434'; c.fillRect(-2, -2, 3, 3);
  c.restore();
}

function drawSmoke(c, x, y, seed, amount) {
  for (let k = 0; k < 6; k++) {
    const t = (Game.time * 0.35 + k / 6 + seed * 0.13) % 1;
    const px = x + Math.sin(t * 4 + seed) * 3 + t * 14, py = y - t * 38;
    const r = Math.round(2 + t * 6);
    c.globalAlpha = 0.55 * (1 - t) * amount;
    c.fillStyle = '#b6ada0';
    c.fillRect(Math.round(px - r), Math.round(py - r + 1), r * 2, r * 2 - 2);
    c.fillRect(Math.round(px - r + 1), Math.round(py - r), r * 2 - 2, r * 2);
    c.fillStyle = '#e4ddd2';
    c.fillRect(Math.round(px - r + 1), Math.round(py - r + 1), r, r);
  }
  c.globalAlpha = 1;
}

// ---------- Эффекты ----------

function drawWaterSparkles(c, x0, y0, x1, y1) {
  const t = Game.time;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = idx(x, y);
    const ter = World.terrain[i];
    if (ter === T_WATER) {
      const h = hash(i + 99);
      for (let k = 0; k < 2; k++) {
        const hh = h >>> (k * 8);
        const s = Math.sin(t * (0.8 + (hh % 7) / 10) + (hh % 628) / 100);
        if (s < 0.7) continue;
        const sx = x * TILE + (hh % 24) + 4, sy = y * TILE + ((hh >>> 5) % 26) + 3;
        c.fillStyle = s > 0.9 ? '#d6eef6' : '#76b2d4';
        c.fillRect(sx - 2, sy, 5, 1);
        if (s > 0.9) c.fillRect(sx, sy - 1, 1, 1);
      }
    } else if (ter === T_ROCK && World.crystal[i]) {
      const h = hash(i + 7);
      const s = Math.sin(t * 2 + (h % 628) / 100);
      glow(c, x * TILE + 16, y * TILE + 22, 16, '150,100,255', 0.12 + 0.06 * s);
      if (s > 0.8) {
        const sx = x * TILE + 6 + (h % 20), sy = y * TILE + 10 + ((h >>> 6) % 14);
        c.fillStyle = '#ffffff';
        c.fillRect(sx, sy - 1, 1, 3); c.fillRect(sx - 1, sy, 3, 1);
      }
    }
  }
}

function drawClouds(c) {
  const W = MAP_W * TILE;
  for (const cl of R.clouds) {
    const x = ((cl.x + Game.time * cl.v) % (W + 800)) - 400, y = cl.y;
    c.save();
    c.translate(x, y);
    c.scale(1, cl.ry / cl.rx);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, cl.rx);
    g.addColorStop(0, 'rgba(20,30,50,0.16)');
    g.addColorStop(0.6, 'rgba(20,30,50,0.08)');
    g.addColorStop(1, 'rgba(20,30,50,0)');
    c.fillStyle = g;
    c.fillRect(-cl.rx, -cl.rx, cl.rx * 2, cl.rx * 2);
    c.restore();
  }
}

// Значки проблем над зданиями
function drawStatusIcons(c, x0, y0, x1, y1) {
  for (const b of Game.buildings) {
    if (b.x + b.w < x0 || b.x > x1 || b.y > y1 || b.y < y0 - 3) continue;
    let icon = null;
    if (b.state !== 'done') {
      if (b.problem() === 'noroad') icon = ['ui', 'road'];
      else if (!b.builder) icon = ['ui', 'noworker'];
    } else {
      const p = b.problem();
      if (!p) continue;
      if (p === 'noroad') icon = ['ui', 'road'];
      else if (p === 'paused') icon = ['ui', 'pause'];
      else if (p === 'noworker') icon = ['ui', 'noworker'];
      else if (p === 'full') icon = ['ui', 'full'];
      else if (p.startsWith('need:')) icon = ['good', p.slice(5)];
    }
    if (!icon) continue;
    const bob = Math.round(Math.sin(Game.time * 3 + b.id) * 1.5);
    const ix = b.x * TILE + Math.round(b.w * TILE / 2) - 11, iy = b.y * TILE - 34 + bob;
    c.fillStyle = '#160e0a'; c.fillRect(ix, iy, 22, 22);
    c.fillStyle = icon[1] === 'pause' ? '#45291a' : '#6a2018'; c.fillRect(ix + 1, iy + 1, 20, 20);
    c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(ix + 1, iy + 1, 20, 1);
    c.fillStyle = '#160e0a'; c.fillRect(ix + 9, iy + 22, 4, 2); c.fillRect(ix + 10, iy + 24, 2, 1);
    c.drawImage(iconCanvas(icon[0], icon[1]), ix + 2, iy + 2);
  }
}

// ---------- Кадр ----------

function render() {
  const { ctx: c, cam, canvas } = R;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#100c08';
  c.fillRect(0, 0, canvas.width, canvas.height);
  const dpr = window.devicePixelRatio || 1;
  const z = Math.max(1, Math.round(cam.z * dpr));
  c.setTransform(z, 0, 0, z, -Math.round(cam.x * z), -Math.round(cam.y * z));
  c.imageSmoothingEnabled = false;
  c.drawImage(TERR.canvas, 0, 0);
  c.drawImage(TERR.roads, 0, 0);

  const vw = canvas.width / z, vh = canvas.height / z;
  const x0 = Math.max(0, Math.floor(cam.x / TILE) - 2), y0 = Math.max(0, Math.floor(cam.y / TILE) - 1);
  const x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + vw) / TILE) + 2), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + vh) / TILE) + 4);

  drawWaterSparkles(c, x0, y0, x1, y1);

  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const o = World.obj[idx(x, y)];
    if (o && o.t === 'field') c.drawImage(SPR.fields[o.crop || 'wheat'][fieldStage(o.g)], x * TILE, y * TILE);
  }
  for (const s of Game.roadSites.values()) {
    const px = s.x * TILE, py = s.y * TILE;
    const has = s.stock.stone > 0;
    c.fillStyle = has ? '#875434' : 'rgba(135,84,52,0.45)';
    c.fillRect(px + 7, py + 7, 18, 18);
    c.fillStyle = '#f0d6a8';
    for (let k = 0; k < 18; k += 4) {
      c.fillRect(px + 7 + k, py + 7, 2, 1); c.fillRect(px + 7 + k, py + 24, 2, 1);
      c.fillRect(px + 7, py + 7 + k, 1, 2); c.fillRect(px + 24, py + 7 + k, 1, 2);
    }
    if (has) { c.fillStyle = '#9e958a'; c.fillRect(px + 13, py + 13, 6, 5); c.fillStyle = '#cec6ba'; c.fillRect(px + 13, py + 13, 6, 1); }
  }

  const list = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = idx(x, y), o = World.obj[i];
    if (!o) continue;
    if (o.t === 'tree') list.push([y + 0.9, () => drawTree(c, x, y, o, i)]);
    else if (o.t === 'stone') list.push([y + 0.8, () => drawStoneObj(c, x, y, o, i)]);
    else if (o.t === 'stump') list.push([y + 0.7, () => drawStump(c, x, y)]);
  }
  for (const b of Game.buildings) {
    if (b.x + b.w < x0 - 2 || b.x > x1 + 2 || b.y > y1 + 2 || b.y + b.h < y0 - 2) continue;
    list.push([b.y + b.h - 0.05, () => drawBuilding(c, b, false)]);
  }
  for (const u of Game.units) {
    if (u.inside) continue;
    if (u.x < x0 - 1 || u.x > x1 + 1 || u.y < y0 - 1 || u.y > y1 + 2) continue;
    list.push([u.y + 0.2, () => drawUnit(c, u)]);
  }
  list.sort((a, b) => a[0] - b[0]);
  for (const [, fn] of list) fn();

  drawClouds(c);
  drawStatusIcons(c, x0, y0, x1, y1);
  drawOverlay(c);
}

function drawOverlay(c) {
  const sel = Game.selected;
  const ant = (x, y, w, h, col) => {
    const off = Math.floor(Game.time * 10) % 6;
    c.fillStyle = col;
    for (let k = -off; k < w; k += 6) { c.fillRect(x + Math.max(0, k), y, Math.min(3, w - k), 1); c.fillRect(x + Math.max(0, k), y + h - 1, Math.min(3, w - k), 1); }
    for (let k = -off; k < h; k += 6) { c.fillRect(x, y + Math.max(0, k), 1, Math.min(3, h - k)); c.fillRect(x + w - 1, y + Math.max(0, k), 1, Math.min(3, h - k)); }
  };
  if (sel && !sel.removed) {
    if (sel.isRoad) ant(sel.x * TILE + 2, sel.y * TILE + 2, TILE - 4, TILE - 4, '#f6d458');
    else ant(sel.x * TILE, sel.y * TILE, sel.w * TILE, sel.h * TILE, '#f6d458');
  }
  const tool = Game.tool, h = R.hover;
  if (!tool && h && inb(h[0], h[1])) {
    const id = World.bmap[idx(h[0], h[1])];
    const hb = id && Game.buildings.find(b => b.id === id);
    if (hb && hb !== sel) ant(hb.x * TILE, hb.y * TILE, hb.w * TILE, hb.h * TILE, 'rgba(255,255,255,0.6)');
  }
  if (!tool || !h) return;
  if (tool.kind === 'build') {
    const d = bDims(tool.type, tool.rot || 0);
    const bx = h[0] - Math.floor(d.w / 2), by = h[1] - d.h + 1;
    const err = checkPlacement(tool.type, bx, by, d.rot);
    c.fillStyle = err ? 'rgba(220,40,30,0.35)' : 'rgba(60,220,80,0.3)';
    c.fillRect(bx * TILE, by * TILE, d.w * TILE, d.h * TILE);
    c.globalAlpha = 0.7;
    drawBuilding(c, { type: tool.type, rot: d.rot, x: bx, y: by, w: d.w, h: d.h, doorX: bx + d.dx, doorY: by + d.dy, state: 'done', anim: 0, id: 0, stock: emptyGoods(), pigs: [] }, true);
    c.globalAlpha = 1;
    ant((bx + d.dx) * TILE + 2, (by + d.dy) * TILE + 2, TILE - 4, TILE - 4, err ? '#ff5040' : '#60ff80');
  } else if (tool.kind === 'road') {
    const cells = R.roadDrag || [h];
    for (const [x, y] of cells) {
      c.fillStyle = canPlaceRoad(x, y) ? 'rgba(255,230,160,0.5)' : 'rgba(220,40,30,0.4)';
      c.fillRect(x * TILE + 6, y * TILE + 6, 20, 20);
    }
  } else if (tool.kind === 'erase') {
    c.fillStyle = '#e04030';
    for (let k = 0; k < 18; k++) {
      c.fillRect(h[0] * TILE + 7 + k, h[1] * TILE + 7 + k, 2, 2);
      c.fillRect(h[0] * TILE + 24 - k, h[1] * TILE + 7 + k, 2, 2);
    }
  }
}

// ---------- Миникарта ----------

const MINI = { canvas: null, ctx: null, base: null };

function initMinimap(canvas) {
  MINI.canvas = canvas;
  MINI.ctx = canvas.getContext('2d');
  MINI.base = mkCanvas(MAP_W * 3, MAP_H * 3);
}

function updateMinimapBase() {
  const c = MINI.base.getContext('2d');
  c.drawImage(TERR.mini, 0, 0);
  for (let i = 0; i < N_TILES; i++) {
    const x = (i % MAP_W) * 3, y = ((i / MAP_W) | 0) * 3, o = World.obj[i];
    if (World.road[i]) { c.fillStyle = '#cc9a64'; c.fillRect(x, y, 3, 3); }
    if (World.crystal[i]) { c.fillStyle = '#9c7ae6'; c.fillRect(x + 1, y + 1, 2, 2); }
    if (o) {
      if (o.t === 'tree') { c.fillStyle = o.g >= 1 ? '#1c2818' : '#3a5a2a'; c.fillRect(x, y, 3, 3); }
      else if (o.t === 'stone') { c.fillStyle = '#cec6ba'; c.fillRect(x + 1, y + 1, 2, 2); }
      else if (o.t === 'field') { c.fillStyle = '#c89226'; c.fillRect(x, y, 3, 3); }
    }
  }
  for (const b of Game.buildings) {
    c.fillStyle = '#160e0a'; c.fillRect(b.x * 3 - 1, b.y * 3 - 1, b.w * 3 + 2, b.h * 3 + 2);
    c.fillStyle = b.state === 'done' ? '#e07a50' : '#cc9a64';
    c.fillRect(b.x * 3, b.y * 3, b.w * 3, b.h * 3);
  }
}

function drawMinimap() {
  const c = MINI.ctx, cv = MINI.canvas;
  c.imageSmoothingEnabled = false;
  c.drawImage(MINI.base, 0, 0, cv.width, cv.height);
  const sx = cv.width / (MAP_W * TILE), sy = cv.height / (MAP_H * TILE);
  const s = camScale();
  c.strokeStyle = '#f6f2ea'; c.lineWidth = 2;
  c.strokeRect(R.cam.x * sx, R.cam.y * sy, R.canvas.clientWidth / s * sx, R.canvas.clientHeight / s * sy);
}
