'use strict';
// Жизнь внутри и около зданий: силуэты работающих гномов в окнах, мерцающий свет изнутри,
// веранда трактира со столом и до 4 обедающими, гномка-официантка с подносом
// и навес над столом, раскрывающийся под дождём. Всё рисуется поверх спрайта здания,
// в сам спрайт (и сохранения) ничего не добавляется.

const DINE_SEATS = [   // [dx, ряд (-1 дальний / 1 ближний)]
  [-8, -1], [8, -1], [-8, 1], [8, 1],
];

let INS_STAMP = '', INS_CNT = new Map(), INS_DINE = new Map();
function insideScan() {
  const stamp = Game.time + ':' + Game.units.length;
  if (stamp === INS_STAMP) return;
  INS_STAMP = stamp; INS_CNT = new Map(); INS_DINE = new Map();
  for (const u of Game.units) {
    const b = u.inside;
    if (!b) continue;
    INS_CNT.set(b, (INS_CNT.get(b) || 0) + 1);
    if (u.dining === b) { let l = INS_DINE.get(b); if (!l) INS_DINE.set(b, l = []); l.push(u); }
  }
}

// какой инструмент у работника (по типу здания)
const INSIDE_TOOL = {
  metallurgist: 'hammer', armory: 'hammer', sawmill: 'saw', carpenter: 'saw', mill: 'ladle', bakery: 'ladle', brewery: 'ladle',
  butchery: 'knife', magicworkshop: 'wand', hopfarm: 'ladle', swine: 'ladle',
};

function drawInsideLife(c, b, spr, ox, oy) {
  const wins = spr.wins;
  if (!wins || !wins.length) return;
  const occ = INS_CNT.get(b) || 0;
  if (!b.working && occ === 0) return;
  if (b.type === 'inn') return;                        // в трактире гости сидят на веранде
  const n = Math.min(wins.length, Math.max(1, b.working ? 1 + (occ > 1 ? 1 : 0) : Math.min(occ, 2)));
  const order = wins.map((w, i) => i).sort((p, q) => ((p * 7 + b.id * 13) % 17) - ((q * 7 + b.id * 13) % 17) || p - q);
  const t = Game.time, tool = INSIDE_TOOL[b.type] || 'hammer';
  let shown = 0;
  for (const i of order) {
    const [wx, wy, ww, wh, round] = wins[i];
    if (ww < 5) continue;
    if (shown++ >= n) break;
    const x = ox + wx, y = oy + wy, ph = i * 1.7 + b.id;
    c.save();
    c.beginPath();
    if (round) c.arc(x, y, Math.min(ww, wh) / 2, 0, Math.PI * 2); else c.rect(x - ww / 2, y - wh / 2, ww, wh);
    c.clip();
    // тёплый свет очага/лампы с лёгким мерцанием
    c.fillStyle = `rgba(255,${190 + Math.sin(t * 9 + ph) * 18 | 0},96,0.92)`;
    c.fillRect(x - ww / 2, y - wh / 2, ww, wh);
    // силуэт гнома: колпак, голова, плечи; ходит туда-сюда и машет инструментом
    const sx = x + Math.sin(t * 0.9 + ph) * ww * 0.16;
    const hy = y - wh * 0.05, bob = Math.abs(Math.sin(t * 6 + ph)) * 0.6;
    c.fillStyle = '#1f1008';
    c.fillRect(Math.round(sx - 1.6), Math.round(hy + 1 - bob * 0.3), 3.2, 3.4 + wh);            // тело
    c.beginPath(); c.arc(sx, hy + 0.2 - bob * 0.3, 1.5, 0, Math.PI * 2); c.fill();                // голова
    c.beginPath(); c.moveTo(sx - 1.7, hy - 0.4 - bob * 0.3); c.lineTo(sx + 0.6, hy - 3.4 - bob * 0.3); c.lineTo(sx + 1.8, hy - 0.4 - bob * 0.3); c.fill();   // колпак
    const sw = Math.sin(t * (tool === 'saw' ? 7 : tool === 'ladle' ? 3 : 8) + ph);
    let ax, ay;
    if (tool === 'saw') { ax = sx + 2.2 + sw * 1.6; ay = hy + 2.6; }
    else if (tool === 'ladle') { ax = sx + 1.6 + Math.cos(t * 3 + ph) * 1.4; ay = hy + 3 + Math.sin(t * 3 + ph) * 0.8; }
    else { ax = sx + 2 + Math.max(0, sw) * 1.2; ay = hy + 0.6 + (1 - Math.max(0, sw)) * 2.6; }
    c.strokeStyle = '#1f1008'; c.lineWidth = 1; c.beginPath(); c.moveTo(sx + 0.8, hy + 2.4); c.lineTo(ax, ay); c.stroke();
    c.fillStyle = tool === 'ladle' ? '#7a4a22' : '#6a6a72';
    c.fillRect(Math.round(ax - 0.7), Math.round(ay - 0.7), 1.6, 1.6);
    if (tool === 'hammer' && sw > 0.9) { c.fillStyle = '#fff2a0'; c.fillRect(Math.round(ax + 1), Math.round(ay + 1), 1, 1); }   // искорка при ударе
    c.restore();
  }
}

// ---------- Трактир: веранда, стол, обедающие, официантка, навес ----------

function innFoodSprite(c, food, x, y) {
  switch (food) {
    case 'chickenleg': ellipse(c, x, y - 1, 2.2, 1.5, '#c8803a'); c.fillStyle = '#f6f2ea'; c.fillRect(x + 1.6, y - 0.4, 2.4, 0.9); break;
    case 'steak': ellipse(c, x, y - 0.8, 2.6, 1.4, '#8a3a24'); ellipse(c, x - 0.4, y - 1, 1.2, 0.5, '#b8583a'); break;
    case 'croissant': c.fillStyle = '#e0a03c'; c.beginPath(); c.arc(x, y - 0.4, 2, Math.PI, 0); c.fill(); c.fillStyle = '#b8742c'; c.fillRect(x - 1.8, y - 0.6, 3.6, 0.5); break;
    case 'sausage': c.fillStyle = '#b8503a'; c.fillRect(x - 2.4, y - 1.4, 4.8, 1.3); c.fillStyle = '#d87a5a'; c.fillRect(x - 2.4, y - 1.4, 4.8, 0.4); break;
    default: ellipse(c, x, y - 0.8, 2.4, 1.3, '#d0a060'); c.fillStyle = '#8a5a2a'; c.fillRect(x - 1, y - 1.4, 0.5, 0.5); c.fillRect(x + 0.4, y - 1.2, 0.5, 0.5);
  }
  ellipse(c, x, y, 3.2, 1, 'rgba(240,236,226,0.55)');
}

function innDeck(c, x, y) {   // дощатая терраса под столом
  const x0 = x - 17, x1 = x + 17, y0 = y - 9, y1 = y + 8;
  c.fillStyle = 'rgba(12,10,6,0.28)'; c.fillRect(x0 + 2, y1 + 1, x1 - x0, 3);
  c.fillStyle = '#6a4424'; c.fillRect(x0, y1, x1 - x0, 3);
  c.fillStyle = '#b08450'; c.fillRect(x0, y0, x1 - x0, y1 - y0);
  for (let k = 0; k < (y1 - y0); k += 3) { c.fillStyle = (k / 3) % 2 ? '#a07844' : '#b88c58'; c.fillRect(x0, y0 + k, x1 - x0, 2); c.fillStyle = 'rgba(40,20,6,0.35)'; c.fillRect(x0, y0 + k + 2, x1 - x0, 1); }
  c.fillStyle = 'rgba(255,230,180,0.25)'; c.fillRect(x0, y0, x1 - x0, 1);
  c.fillStyle = '#4a2c14'; for (const dx of [x0 + 1, x1 - 3]) { c.fillRect(dx, y0 - 8, 2, y1 - y0 + 8); }                // угловые столбики
  c.fillStyle = '#6a4424'; c.fillRect(x0, y0 - 6, x1 - x0, 1.4); c.fillRect(x0, y0 - 2.4, x1 - x0, 1);               // задние перила
}

function innTable(c, x, y) {   // (x, y) — середина стола на земле
  const w = 28;
  c.fillStyle = 'rgba(12,10,6,0.3)'; c.beginPath(); c.ellipse(x + 2, y + 1, w / 2 + 2, 3.5, 0, 0, 7); c.fill();
  c.fillStyle = '#3a2210';
  for (const dx of [-w / 2 + 3, w / 2 - 4]) { c.fillRect(x + dx, y - 5, 2, 5); }
  // столешница: клетчатая красно-белая скатерть
  c.fillStyle = '#a9743f'; c.fillRect(x - w / 2, y - 9, w, 5);
  c.fillStyle = '#6a4424'; c.fillRect(x - w / 2, y - 4.2, w, 1.4);
  for (let k = 0; k < w; k += 4) { c.fillStyle = (k >> 2) % 2 ? '#f0e6d0' : '#c8402e'; c.fillRect(x - w / 2 + k, y - 9, 4, 1.8); c.fillStyle = (k >> 2) % 2 ? '#c8402e' : '#f0e6d0'; c.fillRect(x - w / 2 + k, y - 7.2, 4, 1.8); }
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x - w / 2, y - 9, w, 0.5);
}

function innBench(c, x, y, w) {
  c.fillStyle = 'rgba(12,10,6,0.25)'; c.fillRect(x - w / 2 + 1, y + 1, w, 1.5);
  c.fillStyle = '#7a4e2c'; c.fillRect(x - w / 2, y - 3.2, w, 2.6); c.fillStyle = '#9a6a3c'; c.fillRect(x - w / 2, y - 3.2, w, 0.8);
  c.fillStyle = '#3a2210'; c.fillRect(x - w / 2 + 2, y - 0.8, 1.6, 2.4); c.fillRect(x + w / 2 - 3.6, y - 0.8, 1.6, 2.4);
}

function innAwning(c, x, y, k) {
  // навес на четырёх столбах раскатывается от задней кромки к передней
  const top = y - 30, bw = 16, fw = 19, depth = 11;
  c.globalAlpha = Math.min(1, k * 2);
  c.fillStyle = '#5a3a1e';
  for (const [dx, h0, ph] of [[-bw + 3, top + 2, y - 10], [bw - 3, top + 2, y - 10], [-fw + 3, top + depth, y + 4], [fw - 3, top + depth, y + 4]]) c.fillRect(x + dx - 0.7, h0, 1.6, ph - h0);
  c.globalAlpha = 1;
  const front = top + depth * k, fwk = bw + (fw - bw) * k;
  // полотнище в красно-кремовую полоску
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a0 = i / n, a1 = (i + 1) / n;
    c.fillStyle = i % 2 ? '#f0e6cc' : '#b8402c';
    c.beginPath();
    c.moveTo(x - bw + a0 * 2 * bw, top); c.lineTo(x - bw + a1 * 2 * bw, top);
    c.lineTo(x - fwk + a1 * 2 * fwk, front); c.lineTo(x - fwk + a0 * 2 * fwk, front); c.closePath(); c.fill();
    // свисающий фестон
    if (k > 0.85) {
      const fx0 = x - fwk + a0 * 2 * fwk, fx1 = x - fwk + a1 * 2 * fwk;
      c.beginPath(); c.moveTo(fx0, front); c.lineTo(fx1, front); c.lineTo((fx0 + fx1) / 2, front + 4); c.closePath(); c.fill();
    }
  }
  c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(x - fwk, front - 0.8, fwk * 2, 0.8);
  c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(x - bw, top, bw * 2, 0.8);
}

function drawInnPorch(c, b, spr, ox, oy) {
  const p = spr.porch;
  if (!p) return;
  const tx = Math.round(ox + p[0]), ty = Math.round(oy + p[1]);
  const t = Game.time, diners = INS_DINE.get(b) || [];
  // навес под дождём
  const want = isRaining() ? 1 : 0;
  const dt = Math.min(0.1, Math.max(0, t - (b._awnT === undefined ? t : b._awnT)));
  b._awnT = t;
  b.awn = Math.max(0, Math.min(1, (b.awn || 0) + Math.sign(want - (b.awn || 0)) * dt * 0.7));
  c.imageSmoothingEnabled = false;
  innDeck(c, tx, ty);
  innBench(c, tx, ty - 6, 30);   // дальняя скамья
  const seat = (u, i) => {
    const [dx, row] = DINE_SEATS[i];
    const view = row < 0 ? 'S' : 'N';
    const opt = { gait: '', gest: 'eat', gf: gestCyc(t * 1.8 + u.id * 0.7) };
    const sp = personSprite({ type: u.type, look: u.look, carry: null, injury: u.injury }, view, 'idle', 0, opt);
    return { dx, row, sp, u };
  };
  const seats = diners.slice(0, 4).map((u, i) => seat(u, i));
  for (const s of seats) if (s.row < 0) {
    c.drawImage(s.sp, tx + s.dx - PFX, ty + 1 - PFY, PW, PH);
  }
  innTable(c, tx, ty);
  for (const s of seats) {
    // еда на столе перед каждым
    const fx = tx + s.dx, fy = ty - (s.row < 0 ? 7.2 : 5.2);
    if (s.u.diningFood) innFoodSprite(c, s.u.diningFood, fx, fy);
  }
  if (!seats.length) {
    innFoodSprite(c, 'bread', tx - 6, ty - 6.6);
    c.fillStyle = '#d8a840'; c.fillRect(tx + 6, ty - 10.6, 2.2, 3); c.fillStyle = '#fffbe8'; c.fillRect(tx + 6, ty - 11, 2.2, 0.9);
  }
  for (const s of seats) if (s.row > 0) {
    const sy = ty + 9;
    c.save(); c.beginPath(); c.rect(tx + s.dx - 14, sy - 50, 28, 50 - 4); c.clip();   // ноги скрыты скамьёй
    c.drawImage(s.sp, tx + s.dx - PFX, sy - PFY, PW, PH);
    c.restore();
  }
  innBench(c, tx, ty + 7, 30);   // ближняя скамья — поверх спин
  drawWaitress(c, b, spr, tx, ty, ox, oy, diners.length);
  if (b.awn > 0.02) innAwning(c, tx, ty, b.awn);
  c.imageSmoothingEnabled = R.smooth;
}

// Официантка выходит из трактира с подносом, идёт к столу, ставит еду и возвращается.
function drawWaitress(c, b, spr, tx, ty, ox, oy, guests) {
  const t = Game.time;
  let w = b._wt;
  if (!w) w = b._wt = { st: 'in', t: 0, x: 0, y: 0, last: t, f: 0, face: 1 };
  const dt = Math.min(0.1, Math.max(0, t - w.last)); w.last = t;
  const dp = spr.doorPt || [spr.doorCx, spr.baseY - 6];
  const dx = ox + dp[0], dy = oy + dp[1] + 4;
  const tgtX = tx - 21, tgtY = ty + 9;
  w.t -= dt;
  const walkTo = (X, Y, v) => {
    const ex = X - w.x, ey = Y - w.y, d = Math.hypot(ex, ey);
    if (d < 1) return true;
    const s = Math.min(d, v * dt);
    w.x += ex / d * s; w.y += ey / d * s; w.f += dt * 9;
    if (Math.abs(ex) > 0.5) w.face = ex > 0 ? 1 : -1;
    return false;
  };
  let pose = 'walk', carry = null, vis = true, view = 'E';
  if (w.st === 'in') {
    vis = false; w.x = dx; w.y = dy;
    if (guests > 0 && w.t <= 0) { w.st = 'out'; }
    else if (w.t <= 0) w.t = 1;
  } else if (w.st === 'out') {
    carry = 'tray';
    if (walkTo(tgtX, tgtY, 15)) { w.st = 'serve'; w.t = 2.2; }
  } else if (w.st === 'serve') {
    carry = 'tray'; pose = 'idle'; view = 'S';
    if (w.t <= 0) { w.st = 'back'; }
  } else {
    if (walkTo(dx, dy, 15)) { w.st = 'in'; w.t = 3 + Math.random() * 4; vis = false; }
  }
  if (!vis) return;
  if (w.st === 'serve') carry = w.t > 1 ? 'tray' : null;
  const sp = personSprite({ type: 'waitress', look: b.id * 37 + 5, carry }, view, pose, pose === 'walk' ? (Math.floor(w.f) & 7) : 0, {});
  const px = Math.round(w.x), py = Math.round(w.y);
  c.fillStyle = 'rgba(12,10,6,0.3)'; c.beginPath(); c.ellipse(px + 1, py, 5.5, 2, 0, 0, 7); c.fill();
  if (w.face < 0 && view === 'E') { c.save(); c.translate(px, py); c.scale(-1, 1); c.drawImage(sp, -PFX, -PFY, PW, PH); c.restore(); }
  else c.drawImage(sp, px - PFX, py - PFY, PW, PH);
}

function drawInside(c, b, spr, ox, oy) {
  insideScan();
  drawInsideLife(c, b, spr, ox, oy);
  if (b.type === 'inn') { drawInnPorch(c, b, spr, ox, oy); drawInnOven(c, b, spr, ox, oy); drawBarmaid(c, b, spr, ox, oy); }
}

// Огонь в печи на первом этаже трактира: живое пламя в топке и тёплый отсвет
function drawInnOven(c, b, spr, ox, oy) {
  const o = spr.oven;
  if (!o || b.state !== 'done') return;
  const x = Math.round(ox + o[0]), y = Math.round(oy + o[1]);
  glow(c, x, y - 3, 24, '255,140,40', 0.2 + Math.sin(Game.time * 7 + b.id) * 0.04);
  drawFire(c, x, y - 2, 'tiny', Game.time, b.id + 3, { glow: 0 });
}

// Бармен: в окне второго этажа хозяйничает женщина — протирает кружку, потом наливает из бочонка
function drawBarmaid(c, b, spr, ox, oy) {
  const o = spr.bar;
  if (!o || b.state !== 'done') return;
  const ww = 10, wh = 9, x = Math.round(ox + o[0]), y = Math.round(oy + o[1]);   // виртуальное окно 10×9, в мансарде сжато до 7×6
  const t = Game.time + b.id * 1.9, cyc = t % 6;
  c.save();
  c.translate(x, y); c.scale(0.7, 0.7); c.translate(-x, -y);
  c.beginPath(); c.rect(x - ww / 2, y - wh / 2, ww, wh); c.clip();
  c.fillStyle = `rgba(255,${196 + Math.sin(t * 8) * 14 | 0},110,0.95)`; c.fillRect(x - ww / 2, y - wh / 2, ww, wh);
  const sway = Math.sin(t * 1.3) * 0.8, hx = x - 0.5 + sway, hy = y - 2 - Math.abs(Math.sin(t * 2.2)) * 0.2;
  const pour = cyc > 3.6 && cyc < 5;
  c.fillStyle = '#5a2a2e'; c.fillRect(Math.round(hx - 3.2), Math.round(hy + 2.2), 6.4, 9);          // платье и плечи
  c.fillStyle = '#e8d2b0'; c.fillRect(Math.round(hx - 1.4), Math.round(hy + 2.2), 2.8, 1.4);        // вырез
  c.fillStyle = '#e8b890'; c.beginPath(); c.arc(hx, hy, 2.1, 0, Math.PI * 2); c.fill();             // лицо
  c.fillStyle = '#b8402c'; c.beginPath(); c.arc(hx, hy - 0.7, 2.3, Math.PI, 0); c.fill();           // косынка
  c.fillStyle = '#7a4a22'; c.fillRect(Math.round(hx - 2.9), Math.round(hy - 0.2), 1, 3.2);          // коса
  c.fillStyle = '#2a1a10'; c.fillRect(Math.round(hx - 0.9), Math.round(hy + 0.2), 0.7, 0.7); c.fillRect(Math.round(hx + 0.6), Math.round(hy + 0.2), 0.7, 0.7);
  const ax = hx + 2.2 + (pour ? 1.6 : Math.sin(t * 6) * 1.1), ay = hy + 5.4 + (pour ? -1 : Math.cos(t * 6) * 0.5);
  c.strokeStyle = '#5a2a2e'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(hx + 2.4, hy + 3); c.lineTo(ax, ay); c.stroke();
  c.fillStyle = '#e8b890'; c.fillRect(Math.round(ax - 0.6), Math.round(ay - 0.6), 1.4, 1.4);
  c.fillStyle = '#d8a840'; c.fillRect(Math.round(ax - 0.4), Math.round(ay + 0.6), 2.6, 2.8);        // кружка
  c.fillStyle = '#fffbe8'; c.fillRect(Math.round(ax - 0.4), Math.round(ay + 0.4), 2.6, 0.8);
  if (pour) { c.fillStyle = '#e8b030'; c.fillRect(Math.round(ax + 1), Math.round(ay - 3), 0.8, 3.4); }
  c.restore();
}
