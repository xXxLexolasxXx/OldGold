'use strict';
// Жизнь внутри и около зданий: силуэты работающих гномов в окнах, мерцающий свет изнутри,
// веранда трактира со столом и до 4 обедающими, гномка-официантка с подносом
// и навес над столом, раскрывающийся под дождём. Всё рисуется поверх спрайта здания,
// в сам спрайт (и сохранения) ничего не добавляется.

// стол растёт с уровнем трактира: 4 / 6 / 8 едоков (по половине на каждой скамье); на 3-м уровне две официантки
const INN_TABLE_W = [28, 42, 58];
const innLv = b => Math.max(1, Math.min(3, b.level || 1));
const innSeatsN = b => [4, 6, 8][innLv(b) - 1];
const innHalf = b => INN_TABLE_W[innLv(b) - 1] / 2 + 3;      // половина ширины веранды
function innSeats(b) {   // [dx, ряд (-1 дальний / 1 ближний)]
  const n = innSeatsN(b) / 2, step = n === 2 ? 16 : 14, out = [];
  for (let row = -1; row <= 1; row += 2) for (let i = 0; i < n; i++) out.push([Math.round((i - (n - 1) / 2) * step), row]);
  return out;
}

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
    case 'fish': ellipse(c, x, y - 0.8, 2.6, 0.9, '#8ab0c4'); c.fillStyle = '#4a5e74'; c.fillRect(x + 2.2, y - 1.4, 0.8, 1.2); break;
    case 'steak': ellipse(c, x, y - 0.8, 2.6, 1.4, '#8a3a24'); ellipse(c, x - 0.4, y - 1, 1.2, 0.5, '#b8583a'); break;
    case 'croissant': c.fillStyle = '#e0a03c'; c.beginPath(); c.arc(x, y - 0.4, 2, Math.PI, 0); c.fill(); c.fillStyle = '#b8742c'; c.fillRect(x - 1.8, y - 0.6, 3.6, 0.5); break;
    case 'sausage': c.fillStyle = '#b8503a'; c.fillRect(x - 2.4, y - 1.4, 4.8, 1.3); c.fillStyle = '#d87a5a'; c.fillRect(x - 2.4, y - 1.4, 4.8, 0.4); break;
    default: ellipse(c, x, y - 0.8, 2.4, 1.3, '#d0a060'); c.fillStyle = '#8a5a2a'; c.fillRect(x - 1, y - 1.4, 0.5, 0.5); c.fillRect(x + 0.4, y - 1.2, 0.5, 0.5);
  }
  ellipse(c, x, y, 3.2, 1, 'rgba(240,236,226,0.55)');
}

function innDeck(c, x, y, hw) {   // дощатая терраса под столом
  const x0 = x - hw, x1 = x + hw, y0 = y - 9, y1 = y + 8;
  c.fillStyle = 'rgba(12,10,6,0.28)'; c.fillRect(x0 + 2, y1 + 1, x1 - x0, 3);
  c.fillStyle = '#6a4424'; c.fillRect(x0, y1, x1 - x0, 3);
  c.fillStyle = '#b08450'; c.fillRect(x0, y0, x1 - x0, y1 - y0);
  for (let k = 0; k < (y1 - y0); k += 3) { c.fillStyle = (k / 3) % 2 ? '#a07844' : '#b88c58'; c.fillRect(x0, y0 + k, x1 - x0, 2); c.fillStyle = 'rgba(40,20,6,0.35)'; c.fillRect(x0, y0 + k + 2, x1 - x0, 1); }
  c.fillStyle = 'rgba(255,230,180,0.25)'; c.fillRect(x0, y0, x1 - x0, 1);
  c.fillStyle = '#4a2c14'; for (const dx of [x0 + 1, x1 - 3]) { c.fillRect(dx, y0 - 8, 2, y1 - y0 + 8); }                // угловые столбики
  c.fillStyle = '#6a4424'; c.fillRect(x0, y0 - 6, x1 - x0, 1.4); c.fillRect(x0, y0 - 2.4, x1 - x0, 1);               // задние перила
}

function innTable(c, x, y, w) {   // (x, y) — середина стола на земле, w — длина
  c.fillStyle = 'rgba(12,10,6,0.3)'; c.beginPath(); c.ellipse(x + 2, y + 1, w / 2 + 2, 3.5, 0, 0, 7); c.fill();
  c.fillStyle = '#3a2210';
  for (const dx of w > 40 ? [-w / 2 + 3, 0, w / 2 - 4] : [-w / 2 + 3, w / 2 - 4]) { c.fillRect(x + dx, y - 5, 2, 5); }
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

function innAwning(c, x, y, k, sc) {
  // навес на четырёх столбах раскатывается от задней кромки к передней; шире вместе со столом (sc)
  const top = y - 30, bw = 16 * sc, fw = 19 * sc, depth = 11;
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
  const hw = innHalf(b), tw = hw * 2 - 6, DS = innSeats(b), cap = DS.length;
  if (!spr.noDeck) innDeck(c, tx, ty, hw);   // у пиксельного трактира настил уже в спрайте
  innBench(c, tx, ty - 6, tw + 2);   // дальняя скамья
  // у пиксельного трактира дверь позади стола: официантка подходит к столу сзади и рисуется за едоками
  const waitBehind = !!spr.pxInn && !slapTick(b, diners.length);
  if (waitBehind) { drawWaitress(c, b, spr, tx, ty, ox, oy, diners.length, 0, hw); if (innLv(b) >= 3) drawWaitress(c, b, spr, tx, ty, ox, oy, diners.length, 1, hw); }
  const seat = (u, i) => {
    const [dx, row] = DS[i];
    const view = row < 0 ? 'S' : 'N';
    const opt = { gait: '', gest: 'eat', gf: gestCyc(t * 1.8 + u.id * 0.7) };
    const sp = personSprite({ type: u.type, look: u.look, carry: null, injury: u.injury }, view, 'idle', 0, opt);
    return { dx, row, sp, u };
  };
  // ближние места занимаем по очереди: новый едок садится на ту скамью, где меньше народу
  const seats = diners.slice(0, cap).map((u, i) => seat(u, i % 2 ? DS.length / 2 + (i >> 1) : i >> 1));
  for (const s of seats) (b._occ || (b._occ = [])).push([tx - ox + s.dx, ty - oy + (s.row < 0 ? 1 : 9)]);   // места за столом заняты — лишние едоки и двор их обходят
  for (const s of seats) if (s.row < 0) {
    c.drawImage(s.sp, tx + s.dx - PFX, ty + 1 - PFY, PW, PH);
  }
  innTable(c, tx, ty, tw);
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
  innBench(c, tx, ty + 7, tw + 2);   // ближняя скамья — поверх спин
  if (slapTick(b, diners.length)) drawSlapScene(c, b, spr, tx, ty, ox, oy);
  else if (!waitBehind) {
    drawWaitress(c, b, spr, tx, ty, ox, oy, diners.length, 0, hw);
    if (innLv(b) >= 3) drawWaitress(c, b, spr, tx, ty, ox, oy, diners.length, 1, hw);
  }
  if (b.awn > 0.02) innAwning(c, tx, ty, b.awn, hw / 17);
  c.imageSmoothingEnabled = R.smooth;
}

// Официантка выходит из трактира с подносом, идёт к столу, ставит еду и возвращается.
function drawWaitress(c, b, spr, tx, ty, ox, oy, guests, n, hw) {
  const t = Game.time, key = n ? '_wt2' : '_wt';
  let w = b[key];
  if (!w) w = b[key] = { st: 'in', t: n ? 2.5 : 0, x: 0, y: 0, last: t, f: 0, face: 1 };
  const dt = Math.min(0.1, Math.max(0, t - w.last)); w.last = t;
  const dp = spr.doorPt || [spr.doorCx, spr.baseY - 6];
  const dx = ox + dp[0], dy = oy + dp[1] + 4;
  const tgtX = spr.pxInn ? tx + (n ? 1 : -1) * Math.max(6, hw - 10) : n ? tx + hw + 4 : tx - hw - 4, tgtY = spr.pxInn ? ty - 12 : ty + 9;   // пиксельный трактир: за столом, со стороны дома
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
    if (guests > 0 && w.t <= 0) { w.st = 'out'; const fl = (INS_DINE.get(b) || []).map(u => u.diningFood).filter(Boolean); w.food = fl.length ? fl[Math.floor(Math.random() * fl.length)] : 'bread'; }
    else if (w.t <= 0) w.t = 1;
  } else if (w.st === 'out') {
    carry = 'tray:' + (w.food || 'bread');
    if (walkTo(tgtX, tgtY, 15)) { w.st = 'serve'; w.t = 2.2; }
  } else if (w.st === 'serve') {
    carry = 'tray:' + (w.food || 'bread'); pose = 'idle'; view = 'S';
    if (w.t <= 0) { w.st = 'back'; }
  } else {
    if (walkTo(dx, dy, 15)) { w.st = 'in'; w.t = 3 + Math.random() * 4; vis = false; }
  }
  if (!vis) return;
  if (w.st === 'serve') carry = w.t > 1 ? 'tray:' + (w.food || 'bread') : null;
  const sp = personSprite({ type: 'waitress', look: b.id * 37 + 5, carry }, view, pose, pose === 'walk' ? (Math.floor(w.f * 1.5) % WALK_FRAMES) : 0, {});
  const px = Math.round(w.x), py = Math.round(w.y);
  c.fillStyle = 'rgba(12,10,6,0.3)'; c.beginPath(); c.ellipse(px + 1, py, 5.5, 2, 0, 0, 7); c.fill();
  if (w.face < 0 && view === 'E') { c.save(); c.translate(px, py); c.scale(-1, 1); c.drawImage(sp, -PFX, -PFY, PW, PH); c.restore(); }
  else c.drawImage(sp, px - PFX, py - PFY, PW, PH);
}

function drawInside(c, b, spr, ox, oy) {
  insideScan();
  drawInsideLife(c, b, spr, ox, oy);
  if (spr.px === 'storehouse') drawStoreYard(c, b, spr, ox, oy);
  if (spr.px === 'school') drawSchoolYard(c, b, spr, ox, oy);
  if (spr.px === 'sawmill') drawSawYard(c, b, spr, ox, oy);
  if (spr.px === 'quarry') drawQuarryYard(c, b, spr, ox, oy);
  if (spr.px === 'goatpen' || spr.px === 'stable') drawPenAnimals(c, b, spr, ox, oy);
  if (spr.px === 'tradepost') drawTradeYard(c, b, spr, ox, oy);
  if (spr.px === 'infirmary') drawInfYard(c, b, spr, ox, oy);
  if (spr.pt) drawFoodYard(c, b, spr, ox, oy);
  if (b.type === 'inn') { if (spr.pxInn) drawInnYard(c, b, spr, ox, oy); drawInnPorch(c, b, spr, ox, oy); drawInnOven(c, b, spr, ox, oy); drawBarmaid(c, b, spr, ox, oy); if (spr.pxInn) drawInnExtraDiners(c, b, spr, ox, oy); }
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

// ---------- Эпизод у трактира: гном пристаёт к трактирщице и получает пощёчину ----------
// Чисто визуальная сценка поверх веранды (в сохранение не пишется): раз в 3–5 минут днём, когда на веранде никого нет.
// Раскадровка (12 к/с): 0–1.6 с гном с кружкой идёт от двери · 1.6–3.1 ухаживает (6 кадров ×3: подмигивает, тянется к руке, сердечки),
// она хмурится, «!», руки в бока · 3.1–3.5 замах (отвела руку назад, анти-кадр) · 3.5 смаз · 3.58 контакт (стоп-кадр, вспышка, звёздочки,
// отпечаток ладони, брызги пива) · дальше голова гнома отскакивает пружиной, он шатнулся, хватается за щёку, пар из ушей,
// разворачивается и понуро уходит; она уперла руки в бока, фыркает и уходит в дверь. Тест: ?slap=1 — запустить сразу.
const SLAP_T = 9.2;
const SLAP_DEBUG = typeof location !== 'undefined' && /[?&]slap=1/.test(location.search);

function slapTick(b, guests) {
  if (b._slap) { if (Game.time - b._slap.t0 > SLAP_T) b._slap = null; else return true; }
  if (b.state !== 'done' || guests > 0) return false;
  if (b._slapNext === undefined) b._slapNext = Game.time + (SLAP_DEBUG ? 1 : 60 + Math.random() * 120);
  if (Game.time < b._slapNext) return false;
  if (!SLAP_DEBUG && ((typeof isNightNow === 'function' && isNightNow()) || (typeof isEveningNow === 'function' && isEveningNow()) || isRaining() || Math.random() > 0.25)) { b._slapNext = Game.time + 20; return false; }
  if (b._wt && b._wt.st !== 'in') return false;                  // официантка занята — ждём
  b._slapN = (b._slapN || 0) + 1;
  b._slap = { t0: Game.time, look: (b.id * 29 + b._slapN * 17) | 0, fx: {} };
  b._slapNext = Game.time + (SLAP_DEBUG ? 4 : 180 + Math.random() * 120);
  return true;
}

// человечек по строкам: каждая строка сдвигается на целое число пикселей — «удар по голове» без размытия пикселей
function slapPerson(c, sp, x, y, flip, shear) {
  const ky = sp.height / PH;
  c.save(); c.translate(Math.round(x), Math.round(y));
  if (flip) c.scale(-1, 1);
  for (let r = 0; r < PH; r++) {
    const k = Math.max(0, (PFY - r) / PFY), off = Math.round(shear * k * k);
    c.drawImage(sp, 0, r * ky, sp.width, ky, -PFX + off, -PFY + r, PW, 1);
  }
  c.restore();
}

function slapPx(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); }
function slapHeart(c, x, y, a) {
  c.globalAlpha = a;
  const rows = ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..'];
  rows.forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === 'X') slapPx(c, x + i - 2, y + j, 1, 1, j === 0 && i === 1 ? '#ffb0c0' : j > 2 ? '#b8203c' : '#e8405a'); });
  c.globalAlpha = 1;
}
function slapStar(c, x, y) { slapPx(c, x - 1, y, 3, 1, '#ffd848'); slapPx(c, x, y - 1, 1, 3, '#ffd848'); slapPx(c, x, y, 1, 1, '#fff8d0'); }

// колпак отдельным спрайтом: разница между гномом в колпаке и без него (один раз на облик), центр — от ног
const SLAP_HATS = {};
function slapHatOf(type, look) {
  const key = type + look;
  if (SLAP_HATS[key]) return SLAP_HATS[key];
  const o = { gait: '', gest: '', gf: 0 }, u = { type, look, carry: null };
  const full = personSprite(u, 'E', 'idle', 0, o), w = full.width, h = full.height;
  const rd = cv => { const t = document.createElement('canvas'); t.width = w; t.height = h; const x = t.getContext('2d'); x.drawImage(cv, 0, 0); return x.getImageData(0, 0, w, h); };
  const A = rd(full);                                       // сразу копируем: личный холст спрайта могут переиспользовать
  const B = rd(personSprite(u, 'E', 'idle', 0, Object.assign({ nohat: true }, o))), cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const out = cv.getContext('2d').createImageData(w, h);
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let i = 0; i < w * h; i++) {
    const k = i * 4;
    if (A.data[k + 3] > 0 && (B.data[k + 3] === 0 || A.data[k] !== B.data[k] || A.data[k + 1] !== B.data[k + 1] || A.data[k + 2] !== B.data[k + 2])) {
      for (let q = 0; q < 4; q++) out.data[k + q] = A.data[k + q];
      const px = i % w, py = (i / w) | 0; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
  }
  cv.getContext('2d').putImageData(out, 0, 0);
  const kx = w / PW, ky = h / PH;
  const hat = { cv, cx: (x0 + x1) / 2 / kx - PFX, cy: (y0 + y1) / 2 / ky - PFY };
  // полёт: из головы назад-вверх, кувырок, приземление на траву и подскок
  hat.vx = -17; hat.vy = -38;
  hat.tl = (-hat.vy + Math.sqrt(hat.vy * hat.vy - 240 * (hat.cy + 2))) / 120;
  hat.land = hat.vx * hat.tl;
  return SLAP_HATS[key] = hat;
}
function slapHatDraw(c, hat, x, y, ang, flip) {
  c.save(); c.translate(Math.round(x), Math.round(y)); if (flip) c.scale(-1, 1); c.rotate(ang);
  c.drawImage(hat.cv, Math.round(-(PFX + hat.cx)), Math.round(-(PFY + hat.cy)), PW, PH);
  c.restore();
}

function drawSlapScene(c, b, spr, tx, ty, ox, oy) {
  const S = b._slap, el = Game.time - S.t0, fx = S.fx;
  const dp = spr.doorPt || [spr.doorCx, spr.baseY - 6], dx = ox + dp[0], dy = oy + dp[1] + 4;
  const sx = tx, sy = ty + 6, wx = sx + 7, gx0 = sx - 7;                 // сцена: гном слева, трактирщица справа
  const ease = k => k * k * (3 - 2 * k), clamp = k => Math.max(0, Math.min(1, k));
  const mk = (type, look, view, pose, frame, opt) => personSprite({ type, look, carry: null }, view, pose, frame, Object.assign({ gait: '', gest: '', gf: 0 }, opt || {}));
  const gl = S.look, wl = b.id * 37 + 5;
  const T_HIT = 3.583, e = el - T_HIT;                                   // e — время с контакта
  c.imageSmoothingEnabled = false;
  // ---- гном ----
  const hat = slapHatOf('serf', gl), nh = { nohat: true };
  let gx = gx0, gy = sy, gsp, gflip = false, gsh = 0, hatArm = false;
  const pickX = gx0 - 4 + hat.land + 5, tHat = 5.5, tPick = 6.3, tUp = 7.0, tOn = 7.5;   // где лежит колпак и когда его поднимают
  if (el < 1.6) {
    const p = ease(el / 1.6);
    gx = dx + (gx0 - dx) * p; gy = dy + (sy - dy) * p;
    gsp = mk('serf', gl, 'E', 'walk', Math.floor(el * 18) % WALK_FRAMES);
  } else if (el < T_HIT) {
    gsp = mk('serf', gl, 'E', 'idle', 0, { gest: 'flirt', gf: Math.floor((el - 1.6) * 12) % 6 });
    gsh = 1.2 + Math.sin(el * 4.5) * 1.3;                                // наваливается на стойку
  } else {
    gx = gx0 - (el > tHat ? 4 : 4 * (1 - Math.exp(-8 * e)));
    if (el < 3.95) gsp = mk('serf', gl, 'E', 'idle', 0, nh);
    else if (el < 5.2) gsp = mk('serf', gl, 'E', 'idle', 0, Object.assign({ gest: 'cheek', gf: Math.floor(el * 3) }, nh));
    else if (el < tHat) gsp = mk('serf', gl, 'S', 'idle', 0, Object.assign({ gest: 'cheek', gf: 0 }, nh));
    else if (el < tPick) {                                               // идёт к колпаку
      const p = ease((el - tHat) / (tPick - tHat));
      gx = gx0 - 4 + (pickX - (gx0 - 4)) * p; gflip = pickX < gx0 - 4;
      gsp = mk('serf', gl, 'E', 'walk', Math.floor(el * 13.5) % WALK_FRAMES, nh); gsh = 1.6;     // голова понурая
    } else if (el < tUp) {                                               // нагибается
      gx = pickX; gflip = pickX < gx0 - 4;
      gsp = mk('serf', gl, 'E', 'duck', 0, nh); gsh = 0;
    } else if (el < tOn) {                                               // несёт колпак к голове
      gx = pickX; gflip = pickX < gx0 - 4; hatArm = true;
      gsp = mk('serf', gl, 'E', 'idle', 0, Object.assign({ gest: 'hat', gf: 0 }, nh));
    } else {                                                             // колпак снова часть спрайта
      const p = ease(clamp((el - tOn) / 1.5));
      gx = pickX + (dx - pickX) * p; gy = sy + (dy - sy) * p; gflip = dx < pickX;
      gsp = mk('serf', gl, 'E', 'walk', Math.floor(el * 13.5) % WALK_FRAMES); gsh = 1;
    }
    if (el < 5.2) gsh = e < 0.17 ? -2 : -9 * Math.exp(-4.5 * (e - 0.17)) * Math.cos(12 * (e - 0.17)) + (el > 3.95 ? 1 : 0);
  }
  // ---- трактирщица ----
  let wX = wx, wY = sy, wsp, wflip = true, wsh = 0;
  if (el < 2.1) wsp = mk('waitress', wl, 'E', 'idle', 0);
  else if (el < 3.1) { wsp = mk('waitress', wl, 'E', 'idle', 0, { gest: 'hips' }); wsh = -1; }
  else if (el < 3.5) { wsp = mk('waitress', wl, 'E', 'idle', 0, { gest: 'wslap', gf: el < 3.2 ? 1 : 2 }); wsh = el < 3.2 ? -1 : -2.5; }
  else if (el < T_HIT) { wsp = mk('waitress', wl, 'E', 'idle', 0, { gest: 'wslap', gf: 3 }); wsh = 3; }
  else if (el < 3.75) { wsp = mk('waitress', wl, 'E', 'idle', 0, { gest: 'wslap', gf: 4 }); wsh = 3.5; }
  else if (el < 3.833) { wsp = mk('waitress', wl, 'E', 'idle', 0, { gest: 'wslap', gf: 5 }); wsh = 2; }
  else if (el < 6.0) { wsp = mk('waitress', wl, 'E', 'idle', 0, { gest: 'hips' }); wsh = -1 + Math.sin(el * 7) * 0.4; }   // фыркает
  else {
    const p = ease(clamp((el - 6.0) / 1.2));
    wX = wx + (dx - wx) * p; wY = sy + (dy - sy) * p; wflip = dx < wx;
    wsp = mk('waitress', wl, 'E', 'walk', Math.floor(el * 16.5) % WALK_FRAMES);
  }
  if (el > 3.3 && el < 3.9) wX -= el < 3.5 ? (el - 3.3) * 7.5 : el < 3.75 ? 3.2 : 3.2 * (3.9 - el) / 0.15;   // выпад вперёд на ударе
  const shadow = (x, y) => { c.fillStyle = 'rgba(12,10,6,0.3)'; c.beginPath(); c.ellipse(Math.round(x) + 1, Math.round(y), 5.5, 2, 0, 0, 7); c.fill(); };
  const gVis = el < 9, wVis = el < 7.2;
  if (gVis) { shadow(gx, gy); slapPerson(c, gsp, gx, gy, gflip, gsh); }
  if (wVis) { shadow(wX, wY); slapPerson(c, wsp, wX, wY, wflip, wsh); }
  if (e >= 0 && el < tOn) {                                              // колпак: слетел · кувыркается · упал · подскочил · лежит · в руке
    const hx0 = gx0 + hat.cx, hy0 = sy + hat.cy;
    if (e < hat.tl) slapHatDraw(c, hat, hx0 + hat.vx * e, hy0 + hat.vy * e + 60 * e * e, -e * 16, false);
    else if (el < tPick + 0.35) {
      const q = e - hat.tl, hop = q < 0.55 ? 4.5 * Math.abs(Math.sin(q * 8)) * Math.exp(-q * 4) : 0;
      slapHatDraw(c, hat, hx0 + hat.land, sy - 2 - hop, -hat.tl * 16, false);
      if (hop > 0.4) { c.fillStyle = 'rgba(200,190,150,0.5)'; c.fillRect(Math.round(hx0 + hat.land - 3), sy - 1, 1, 1); c.fillRect(Math.round(hx0 + hat.land + 4), sy - 1, 1, 1); }
    }
  }
  if (hatArm) {                                                          // поднял и несёт на голову: к концу ровно на место
    const p = ease(clamp((el - tUp) / (tOn - tUp))), dir = gflip ? -1 : 1;
    slapHatDraw(c, hat, gx + dir * (hat.cx * p + 3.5 * (1 - p)), gy + hat.cy * p + (-17) * (1 - p), (1 - p) * 0.9 * dir, gflip);
  }
  // ---- эффекты ----
  const hx = gx + 3.5, hy = gy - 16;                                     // щека гнома
  for (const t0 of [1.9, 2.45, 3.0]) {                                   // сердечки над головой ухажёра
    const a = el - t0;
    if (a > 0 && a < 1 && el < T_HIT) slapHeart(c, gx + 3 + Math.sin(a * 6 + t0) * 2.2, gy - 34 - a * 11, a > 0.7 ? 1 - (a - 0.7) / 0.3 : 1);
  }
  if (el > 2.2 && el < 2.9) { slapPx(c, wX - 1, wY - 40, 2, 5, '#e8501c'); slapPx(c, wX - 1, wY - 33, 2, 2, '#e8501c'); }   // «!»
  if (el > 2.9 && el < 3.5) { const q = Math.sin(el * 30) > 0 ? 1 : 0; slapPx(c, wX - 2 + q, wY - 25, 3, 1, '#d02818'); slapPx(c, wX - 1 + q, wY - 26, 1, 3, '#d02818'); }   // жилка на виске
  if (el >= 3.5 && el < T_HIT) {                                         // смаз: белая дуга ладони
    c.lineCap = 'round'; c.strokeStyle = '#ffffff';
    c.globalAlpha = 0.85; c.lineWidth = 2;
    c.beginPath(); c.moveTo(wX - 1, wY - 28); c.quadraticCurveTo(wX - 8, wY - 25, hx + 1, hy + 1); c.stroke();
    c.globalAlpha = 0.35; c.lineWidth = 4;
    c.beginPath(); c.moveTo(wX - 1, wY - 28); c.quadraticCurveTo(wX - 8, wY - 25, hx + 1, hy + 1); c.stroke();
    c.globalAlpha = 1;
  }
  if (e >= 0 && !fx.hit) {                                               // контакт: звук, реплики
    fx.hit = 1;
    const wxp = ox + hx, wyp = oy + hy;
    if (typeof sfxAt === 'function') { sfxAt('slap', wxp, wyp); sfxAt('thud', wxp, wyp); }
    if (typeof floater === 'function') {
      floater((ox + wX) / TILE, (oy + wY) / TILE - 2.4, ['Нахал!', 'Ах ты!', 'Не смей!'][S.look % 3], '#ffe9a0');
      if (typeof fxLater === 'function') fxLater(1.2, () => floater((ox + gx0) / TILE, (oy + sy) / TILE - 2.4, 'Ой…', '#d8d0c0'));
    }
  }
  if (e >= 0 && e < 0.25) {                                              // вспышка удара
    const r = 3 + e * 20; c.globalAlpha = 1 - e / 0.25;
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + 0.4; slapPx(c, hx + Math.cos(a) * r, hy + Math.sin(a) * r, 1, 1, k % 2 ? '#fff8d0' : '#ffd848'); slapPx(c, hx + Math.cos(a) * (r + 2), hy + Math.sin(a) * (r + 2), 1, 1, '#ffffff'); }
    c.globalAlpha = 1;
  }
  if (e >= 0 && e < 1.3 && gVis) {                                       // звёздочки по кругу над головой
    const hxc = gx + Math.round(gsh * 0.7), hyc = gy - 31;
    c.globalAlpha = e > 1 ? 1 - (e - 1) / 0.3 : 1;
    for (let k = 0; k < 3; k++) { const a = e * 7 + k * 2.09; slapStar(c, hxc + Math.cos(a) * 7, hyc + Math.sin(a) * 2.4); }
    c.globalAlpha = 1;
  }
  if (e >= 0 && el < 5.5 && gVis) {                                      // красный отпечаток ладони на щеке
    c.globalAlpha = el > 5 ? 1 - (el - 5) / 0.5 : 1;
    const px = hx + Math.round(gsh * 0.55) - 1, py = hy - 2;
    slapPx(c, px, py, 3, 4, '#e0584a'); for (const k of [0, 1, 2]) slapPx(c, px + k, py - 1 - (k === 1 ? 1 : 0), 1, 1, '#c8483c'); slapPx(c, px + 1, py + 1, 1, 2, '#f08878');
    c.globalAlpha = 1;
  }
  if (e >= 0 && e < 0.6) {                                               // пиво из кружки разлетается каплями
    for (let k = 0; k < 6; k++) slapPx(c, gx + 8 + (k - 2.5) * 14 * e, gy - 14 - Math.sin(Math.min(1, e / 0.6 + k * 0.05) * Math.PI) * 9 + e * e * 30, 1, 1, k % 2 ? '#e8b030' : '#fff4c8');
  }
  if (el > 4.1 && el < 5.2 && gVis) {                                    // пар из ушей: обида
    for (const sd of [-1, 1]) for (let k = 0; k < 2; k++) {
      const a = (el * 1.6 + k * 0.5 + (sd > 0 ? 0.25 : 0)) % 1;
      c.globalAlpha = 0.7 * (1 - a); slapPx(c, gx + sd * 5 - 1, gy - 24 - a * 9, 2 + (a > 0.5 ? 1 : 0), 2, '#f4f4f0'); c.globalAlpha = 1;
    }
  }
}

// ---------- Пиксельный трактир (bldpx.js): двор, запасы на полках, едоки за дальними столами ----------
// Костёр с вертелом, завсегдатаи на брёвнах, гном у колоды, метатель дротиков, музыкант на сцене —
// декоративная жизнь двора, её больше на каждом уровне. Запасы на полках кухни полнеют и пустеют по b.stock.

const INN_YARD_REG = [0, 1, 2, 3];          // завсегдатаев у костра по уровню (больше — толпа у огня)
function innFolk(b, k) { return { type: 'farmer', look: (b.id * 97 + k * 31) >>> 0, carry: null }; }
const YARD_K = 0.78;   // гномы во дворах зданий чуть мельче: рядом с пиксельными домами в полный рост они выглядят великанами
function drawFolk(c, u, x, y, view, pose, frame, opt, flip) {
  const sp = personSprite(u, view, pose, frame, opt || {}), k = YARD_K;
  if (flip) { c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(-k, k); c.drawImage(sp, -PFX, -PFY, PW, PH); c.restore(); }
  else c.drawImage(sp, x - PFX * k, y - PFY * k, PW * k, PH * k);
}

// место во дворе свободно? фигурки гномов ~12×24 мировых px: не ставим вторую ближе, чем на 11 по x и 9 по y (иначе куча)
function yardFree(b, x, y) {
  const L = b._occ || (b._occ = []);
  for (const [px, py] of L) if (Math.abs(px - x) < 9 && Math.abs(py - y) < 8) return false;
  L.push([x, y]); return true;
}

function drawInnYard(c, b, spr, ox, oy) {
  if (b.state !== 'done') return;
  const t = Game.time, lv = spr.pxInn;
  b._occ = [];   // занятые места двора на этот кадр
  c.imageSmoothingEnabled = false;
  // запасы на полках кухни: доля заполнения склада трактира → сколько слотов занято
  const inp = b.def.inputs || {}, keys = Object.keys(inp).filter(k => k !== 'beer' && k !== 'darkbeer');
  let have = 0, cap = 0; for (const k of keys) { have += Math.min(inp[k], (b.stock && b.stock[k]) || 0); cap += inp[k]; }
  const fill = cap ? have / cap : 0, slots = spr.pantry || [];
  const order = keys.filter(k => b.stock && b.stock[k] > 0);
  for (let i = 0; i < Math.min(slots.length, Math.ceil(fill * slots.length)); i++) {
    const [x, y] = slots[i], food = order.length ? order[i % order.length] : 'bread';
    innFoodSprite(c, food === 'chicken' ? 'chickenleg' : food, ox + x, oy + y);
  }
  const beer = ((b.stock && b.stock.beer) || 0) + ((b.stock && b.stock.darkbeer) || 0);
  if (beer > 0 && spr.stock) for (let i = 0; i < Math.min(spr.stock.length, Math.ceil(beer / 4)); i++) {   // бочонки пива на поддоне у входа
    const [x, y] = spr.stock[i], X = Math.round(ox + x), Y = Math.round(oy + y);
    c.fillStyle = '#50361e'; c.fillRect(X - 3, Y - 7, 6, 7); c.fillStyle = '#9a6c42'; c.fillRect(X - 2, Y - 7, 4, 7); c.fillStyle = '#64646e'; c.fillRect(X - 3, Y - 5, 6, 1); c.fillRect(X - 3, Y - 2, 6, 1);
  }
  // костёр и вертел
  if (spr.fire) {
    const [x, y] = spr.fire;
    glow(c, ox + x, oy + y - 3, 22, '255,140,40', 0.22 + Math.sin(t * 7 + b.id) * 0.04);
    drawFire(c, ox + x, oy + y, 'tiny', t, b.id + 11, { glow: 0 });
  }
  if (spr.spit) {   // тушка поворачивается: блик бежит по боку, капает жир
    const [x, y] = spr.spit, X = ox + x, Y = oy + y, ph = (t * 1.3) % 1;
    c.fillStyle = '#ffe8a0'; c.fillRect(Math.round(X - 4 + ph * 8), Math.round(Y - 1), 1, 1);
    if (ph < 0.1) { c.fillStyle = '#ffd060'; c.fillRect(Math.round(X), Math.round(Y + 3 + ph * 30), 1, 1); }
  }
  // завсегдатаи у костра: сидят, пьют, хлопают
  const reg = Math.min(INN_YARD_REG[lv] || 0, (spr.seats || []).length), fx = spr.fire ? spr.fire[0] : 0, fy = spr.fire ? spr.fire[1] : 0;
  for (let k = 0; k < reg; k++) {
    const [x, y] = spr.seats[k], cyc = (t * 0.5 + k * 1.7 + b.id) % 6;
    if (!yardFree(b, x, y + 2)) continue;
    const gest = cyc < 1.4 ? 'drink' : cyc < 2.2 ? 'clap' : '';
    // сидят на чурбаках: ноги прячем, фигура ниже на 4 px
    c.save(); c.beginPath(); c.rect(ox + x - 14, oy + y - 40, 28, 41); c.clip();
    drawFolk(c, innFolk(b, k), ox + x, oy + y + 5, y < fy ? 'S' : 'N', 'idle', 0, { gest, gf: gestCyc(t * 1.6 + k) }, x > fx);
    c.restore();
  }
  // колка дров
  if (spr.chop && yardFree(b, spr.chop[0] + 5, spr.chop[1] + 1)) { const [x, y] = spr.chop; drawFolk(c, innFolk(b, 7), ox + x + 5, oy + y + 1, 'E', 'work', { anim: 'chop', f: Math.floor(t * 8 + b.id) % 8 }, {}, true); }
  // дротики: бросок, полёт к мишени
  if (spr.darts && lv >= 2 && yardFree(b, spr.darts[0] - 18, spr.darts[1] + 20)) {
    const [x, y] = spr.darts, sx = ox + x - 18, sy = oy + y + 20, cyc = (t * 0.6 + b.id) % 3;
    drawFolk(c, innFolk(b, 8), sx, sy, 'E', 'idle', 0, { gest: cyc < 0.5 ? 'chest' : '', gf: gestCyc(t * 2) });
    if (cyc > 0.5 && cyc < 0.9) { const f = (cyc - 0.5) / 0.4; c.fillStyle = '#3c3c44'; c.fillRect(Math.round(sx + 4 + f * 14), Math.round(sy - 18 - Math.sin(f * Math.PI) * 4 - f * 2), 2, 1); }
  }
  // музыкант на сцене (3-й уровень): притопывает, ноты всплывают
  if (spr.stage && lv >= 3 && yardFree(b, spr.stage[0], spr.stage[1])) {
    const [x, y] = spr.stage;
    drawFolk(c, innFolk(b, 9), ox + x, oy + y, 'S', 'idle', Math.floor(t * 8) % 6, { gest: 'clap', gf: gestCyc(t * 3) });
    for (let n = 0; n < 2; n++) { const f = (t * 0.7 + n * 0.5) % 1; c.globalAlpha = 1 - f; c.fillStyle = '#2a1a24'; c.fillRect(Math.round(ox + x + 6 + f * 6 + n * 3), Math.round(oy + y - 30 - f * 12), 2, 2); c.fillRect(Math.round(ox + x + 7 + f * 6 + n * 3), Math.round(oy + y - 34 - f * 12), 1, 4); c.globalAlpha = 1; }
  }
  c.imageSmoothingEnabled = R.smooth;
}

// Едоки сверх мест у главного стола садятся за столы веранды и двора
function drawInnExtraDiners(c, b, spr, ox, oy) {
  const diners = (INS_DINE.get(b) || []).slice(innSeats(b).length);
  if (!diners.length || !(spr.tables || []).length) return;
  const t = Game.time, seats = [];
  for (const [x, y] of spr.tables) seats.push([x - 10, y, 'E'], [x + 10, y, 'W']);   // по краям стола, лицом к нему: вплотную вчетвером — куча
  c.imageSmoothingEnabled = false;
  const list = diners.slice(0, seats.length).map((u, i) => ({ u, s: seats[i] })).sort((p, q) => p.s[1] - q.s[1]);
  for (const { u, s } of list) {
    const [x, y, face] = s;
    if (!yardFree(b, x, y + 3)) continue;
    drawFolk(c, { type: u.type, look: u.look, carry: null, injury: u.injury }, ox + x, oy + y + 3, face, 'idle', 0, { gest: 'eat', gf: gestCyc(t * 1.8 + u.id * 0.7) });
  }
  c.imageSmoothingEnabled = R.smooth;
}

// ---------- Пиксельный склад (bldpx.js): кучи груза по запасам, мерцание рун и кристаллов ----------
const STORE_PILE_CAP = 15;   // столько единиц товара — одна полная куча
function storePileAmount(b, kind) {
  const st = b.stock || {};
  if (kind === 'trunk' || kind === 'timber' || kind === 'stone') return st[kind] || 0;
  let n = 0;
  for (const g in st) {
    if (g === 'trunk' || g === 'timber' || g === 'stone' || !GOODS[g]) continue;
    const food = GOODS[g].group === 'Еда';
    if ((kind === 'food') === food) n += st[g] || 0;
  }
  return n;
}
function drawStoreYard(c, b, spr, ox, oy) {
  if (b.state !== 'done') return;
  const t = Game.time;
  c.imageSmoothingEnabled = false;
  for (const kind in spr.piles || {}) {
    const spots = spr.piles[kind], total = storePileAmount(b, kind) / STORE_PILE_CAP;
    for (let i = 0; i < spots.length; i++) {
      const f = Math.max(0, Math.min(1, total - i));        // кучи заполняются по очереди
      if (f <= 0) continue;
      const P = pxPile(kind, f), [x, y] = spots[i];
      c.drawImage(P.cv, Math.round(ox + x - P.ax), Math.round(oy + y - P.ay), P.w, P.h);
    }
  }
  for (const [x, y] of spr.runes || []) glow(c, ox + x, oy + y - 4, 9, '140,240,220', 0.22 + Math.sin(t * 2.3 + x) * 0.08);
  if (spr.circle) glow(c, ox + spr.circle[0], oy + spr.circle[1], 16, '120,230,210', 0.16 + Math.sin(t * 1.6) * 0.06);
  c.imageSmoothingEnabled = R.smooth;
}

// ---------- Пиксельная школа (bldpx.js): гномята на площадке ----------
// Днём во дворе играют гномята: прыгают по классикам, качаются на качелях, читают под деревом;
// на 2-м уровне — песочница и качели-балансир, на 3-м — горка и майское дерево. Ночью двор пуст.
function kidFolk(b, k) { return { type: 'kid', look: (b.id * 131 + k * 47) >>> 0, carry: null }; }
// гномёнок мельче взрослого (×0.7), ноги — в точке (x, y)
function drawKid(c, b, k, x, y, view, pose, frame, opt) {
  const sp = personSprite(kidFolk(b, k), view, pose, frame, opt || {}), s = 0.55;   // дети мельче взрослых во дворе (YARD_K)
  c.drawImage(sp, Math.round(x - PFX * s), Math.round(y - PFY * s), Math.round(PW * s), Math.round(PH * s));
}
function drawSchoolYard(c, b, spr, ox, oy) {
  if (b.state !== 'done' || !spr.play || (typeof isNightNow === 'function' && isNightNow())) return;
  const t = Game.time, P = spr.play, lv = spr.pxLv || 1, X = p => ox + p[0], Y = p => oy + p[1];
  c.imageSmoothingEnabled = false;
  // 1-й уровень: классики, качели, чтение под деревом
  if (P.hop) { const ph = (t * 0.6 + b.id) % 1, jump = Math.abs(Math.sin(ph * Math.PI * 4)) * 2; drawKid(c, b, 0, X(P.hop), Y(P.hop) + 6 - ph * 12 - jump, 'N', 'idle', 0); }
  if (P.swing) { const s = P.swing[0], a = Math.sin(t * 2.4); drawKid(c, b, 1, X(s) + a * 2, Y(s) - Math.abs(a) * 1.5, 'S', 'idle', 0, { gest: 'clap', gf: gestCyc(t) }); }
  if (P.read) drawKid(c, b, 3, X(P.read), Y(P.read), 'S', 'idle', Math.floor(t * 2) % 6, { gest: 'eat', gf: 10 });
  // 2-й: песочница и огородик
  if (lv >= 2 && P.sand) drawKid(c, b, 4, X(P.sand), Y(P.sand), 'S', 'work', { anim: 'pat', f: Math.floor(t * 8) % 8 });
  if (lv >= 2 && P.garden) drawKid(c, b, 11, X(P.garden), Y(P.garden), 'S', 'work', { anim: 'dig', f: Math.floor(t * 6) % 8 });
  // 3-й: качели-балансир, горка, второй на качелях
  if (lv >= 3 && P.seesaw) P.seesaw.forEach((s, k) => { const a = Math.sin(t * 2) * (k ? -1 : 1) * 2; drawKid(c, b, 5 + k, X(s), Y(s) - a, k ? 'W' : 'E', 'idle', 0); });
  if (lv >= 3 && P.slide) { const ph = (t * 0.5 + b.id) % 1; drawKid(c, b, 7, X(P.slide) + ph * 12, Y(P.slide) - 12 + ph * 12, 'E', 'idle', 0); }
  if (lv >= 3 && P.swing && P.swing[1]) { const s = P.swing[1], a = Math.sin(t * 2.4 + 1.3); drawKid(c, b, 2, X(s) + a * 2, Y(s) - Math.abs(a) * 1.5, 'S', 'idle', 0); }
  c.imageSmoothingEnabled = R.smooth;
}

// ---------- Пиксельная лесопилка (bldpx.js): диск крутится, бревно идёт на пилу, летят опилки, рабочие у станка ----------
function drawSawYard(c, b, spr, ox, oy) {
  if (b.state !== 'done' || !spr.saw) return;
  const t = Game.time, on = !!b.working, [sx, sy] = spr.saw, X = ox + sx, Y = oy + sy, r = spr.sawR || 12;
  c.imageSmoothingEnabled = false;
  if (on && !spr.sawSide) {   // блики на зубьях бегут по кругу — диск крутится
    for (let k = 0; k < 6; k++) { const a = t * 14 + k * Math.PI / 3; c.fillStyle = '#ffffff'; c.fillRect(Math.round(X + Math.cos(a) * (r - 1)), Math.round(Y - Math.sin(a) * (r - 1)), 1, 1); }
  }
  if (on) for (let k = 0; k < 8; k++) {   // опилки веером
    const f = (t * 3 + k / 8) % 1, dir = spr.sawSide ? -1 : 1;
    c.fillStyle = ['#e8c868', '#c8a448', '#f2e0a0'][k % 3];
    c.fillRect(Math.round(X - dir * f * 10 + Math.sin(k * 3.1) * 3), Math.round(Y + 2 - Math.sin(f * Math.PI) * 6 + f * 6), 1, 1);
  }
  const w = spr.workers || [];
  if (w[0]) drawFolk(c, { type: 'woodcutter', look: b.id * 53 + 1 }, ox + w[0][0], oy + w[0][1], 'W', on ? 'work' : 'idle', on ? { anim: 'build', f: Math.floor(t * 6) % 8 } : 0, {});   // подаёт бревно
  if (w[1]) drawFolk(c, { type: 'woodcutter', look: b.id * 53 + 2 }, ox + w[1][0], oy + w[1][1], 'E', on ? 'work' : 'idle', on ? { anim: 'chop', f: Math.floor(t * 5 + 3) % 8 } : 0, {});   // принимает доски
  c.imageSmoothingEnabled = R.smooth;
}

// ---------- Пиксельная каменоломня (bldpx.js): на переднем плане каменотёс тешет блок, летят сколы ----------
function drawQuarryYard(c, b, spr, ox, oy) {
  if (b.state !== 'done' || !spr.work) return;
  const t = Game.time, on = !!b.working, [wx, wy] = spr.work, f = Math.floor(t * 7 + b.id) % 8;
  c.imageSmoothingEnabled = false;
  drawFolk(c, { type: 'stonemason', look: b.id * 61 + 3 }, ox + wx, oy + wy, 'E', on ? 'work' : 'idle', on ? { anim: 'mine', f } : 0, {});
  if (on && spr.block && f >= 4) {   // удар: сколы и пыль от блока
    const [bx, by] = spr.block;
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI + (f - 4) * 0.3, r = (f - 3) * 2; c.fillStyle = k % 2 ? '#c6c9bf' : '#8792a4'; c.fillRect(Math.round(ox + bx - 4 + Math.cos(a) * r), Math.round(oy + by - 6 - Math.sin(a) * r), 1, 1); }
  }
  c.imageSmoothingEnabled = R.smooth;
}

// ---------- Загон для коз и выгул извозчика (bldpx.js): игровые козы и лошади бродят в загонах ----------
// Козы — те же, что в лесу (creatures 'goat'), лошади — та же, что в упряжке. Каждая ходит к случайной точке
// внутри своего загона, стоит, щиплет траву. Состояние — в b._pen (не в сейве).
function drawPenAnimals(c, b, spr, ox, oy) {
  if (b.state !== 'done') return;
  const goats = spr.px === 'goatpen', lv = spr.pxLv || 1;
  const rects = goats ? (spr.penRect ? [spr.penRect] : []) : (spr.penRects || []);
  if (!rects.length) return;
  const n = goats ? [2, 4, 6][lv - 1] : [1, 2, 3][lv - 1], kind = goats ? 'goat' : 'horse', t = Game.time;
  let A = b._pen;
  if (!A || A.length !== n) {
    A = b._pen = [];
    for (let k = 0; k < n; k++) { const r = rects[k % rects.length]; A.push({ r, x: r[0][0] + (r[1][0] - r[0][0]) * ((k * 0.37 + 0.2) % 1), y: r[0][1] + (r[1][1] - r[0][1]) * ((k * 0.61 + 0.3) % 1), tx: 0, ty: 0, wait: k * 1.3, face: k % 2 ? -1 : 1, ph: 0, last: t }); }
  }
  c.imageSmoothingEnabled = false;
  for (const a of A.slice().sort((p, q) => p.y - q.y)) {
    const dt = Math.min(0.1, Math.max(0, t - a.last)); a.last = t;
    let moving = false;
    if (a.wait > 0) a.wait -= dt;
    else {
      if (!a.tx) { const [p0, p1] = a.r; a.tx = p0[0] + 8 + Math.random() * Math.max(1, p1[0] - p0[0] - 16); a.ty = p0[1] + 6 + Math.random() * Math.max(1, p1[1] - p0[1] - 10); }
      const ex = a.tx - a.x, ey = a.ty - a.y, d = Math.hypot(ex, ey), v = goats ? 6 : 8;
      if (d < 1) { a.tx = 0; a.wait = 2 + Math.random() * 5; }
      else { const s = Math.min(d, v * dt); a.x += ex / d * s; a.y += ey / d * s; a.ph += dt * 6; moving = true; if (Math.abs(ex) > 0.3) a.face = ex > 0 ? 1 : -1; }
    }
    drawCreatureAt(c, kind, ox + a.x, oy + a.y, a.face, moving, a.ph);
  }
  if (!goats && spr.cartSpot) drawCreatureAt(c, 'cart', ox + spr.cartSpot[0], oy + spr.cartSpot[1], 1, false, 0, null, 0);   // телега у дома извозчика
  c.imageSmoothingEnabled = R.smooth;
}

// ---------- Торговый пост (bldpx.js): торговая телега подъезжает, торговец грузит товар из пристройки ----------
function drawTradeYard(c, b, spr, ox, oy) {
  if (b.state !== 'done' || !spr.cartSpot) return;
  const t = Game.time + b.id * 3, cyc = t % 24, [cx, cy] = spr.cartSpot, [lx, ly] = spr.loadFrom || [cx - 12, cy + 30];
  c.imageSmoothingEnabled = false;
  // 0–4 с: телега въезжает справа; 4–18: стоит, торговец носит ящики; 18–24: уезжает влево
  let x = cx, moving = false;
  if (cyc < 4) { x = cx + (4 - cyc) * 14; moving = true; } else if (cyc > 18) { x = cx - (cyc - 18) * 14; moving = true; }
  const n = cyc < 4 ? 0 : Math.min(4, Math.floor((cyc - 4) / 3));
  drawCreatureAt(c, 'cart', ox + x, oy + cy, cyc > 18 ? -1 : -1, moving, t * 6, n ? 'crate' : null, n);
  if (cyc >= 4 && cyc <= 18) {   // торговец ходит от пристройки к телеге с ящиком
    const ph = ((cyc - 4) % 3) / 3, go = ph < 0.5, f = go ? ph * 2 : (1 - ph) * 2;
    const px = lx + (cx - 6 - lx) * f, py = ly + (cy + 4 - ly) * f;
    drawFolk(c, { type: 'serf', look: b.id * 71 + 9, carry: go ? 'crate' : null }, ox + px, oy + py, go ? (cx > lx ? 'E' : 'W') : (cx > lx ? 'W' : 'E'), 'walk', Math.floor(t * 9) & 7, {});
  }
  c.imageSmoothingEnabled = R.smooth;
}

// ---------- Лазарет (bldpx.js): травы растут на грядках, лекарь срезает, сушит и варит зелье ----------
// Каждый пучок растёт ~40 с от ростка до цветка; лекарь обходит грядку — срезанное начинает расти заново.
// Цикл лекаря 18 с: грядка (срезает) → сушилка (развешивает) → котёл (мешает). Котёл всегда булькает, под ним огонь.
function drawInfYard(c, b, spr, ox, oy) {
  if (b.state !== 'done' || !spr.beds) return;
  const t = Game.time + b.id * 7, PL = ['#7cb444', '#548c30', '#386420'], FL = ['#c6a8ff', '#f8f4ea', '#ffd864', '#e04c40'];
  c.imageSmoothingEnabled = false;
  const cyc = t % 18, bedI = Math.floor(t / 18) % spr.beds.length;
  spr.beds.forEach(([a, e], bi) => {
    const n = Math.max(1, Math.floor((e[0] - a[0]) / 4));
    for (let k = 0; k <= n; k++) {
      const x = a[0] + (e[0] - a[0]) * k / n, y = a[1] + (e[1] - a[1]) * k / n;
      const cut = bi === bedI && cyc < 6 && k <= n * cyc / 6 ? (cyc - 6 * k / n) : 99;   // срезано в этом обходе — растёт с нуля
      const g = Math.min(1, ((t * 0.025 + k * 0.17 + bi * 0.31) % 1.3) * (cut < 99 ? 0 : 1) + (cut < 99 ? Math.min(1, cut * 0.05) : 0));
      const h = Math.round(1 + g * 4), X = Math.round(ox + x), Y = Math.round(oy + y);
      c.fillStyle = PL[(k + bi) % 3]; c.fillRect(X, Y - h, 1, h); if (g > 0.4) { c.fillRect(X - 1, Y - h + 1, 1, 1); c.fillRect(X + 1, Y - h + 2, 1, 1); }
      if (g > 0.85) { c.fillStyle = FL[(k + bi) % 4]; c.fillRect(X, Y - h - 1, 1, 1); }
    }
  });
  // котёл: огонь под ним, пузыри и пар
  if (spr.cauldron) {
    const [cx, cy] = spr.cauldron, X = ox + cx, Y = oy + cy;
    drawFire(c, X, Y - 1, 'tiny', t, b.id + 5, { glow: 0 });
    for (let k = 0; k < 4; k++) { const p = (t * 1.2 + k / 4) % 1; c.fillStyle = p < 0.7 ? '#a4d85c' : '#d8ffb0'; c.fillRect(Math.round(X - 5 + k * 3 + Math.sin(k * 2) * 1), Math.round(Y - 16 - p * 3), 1, 1); }
    for (let k = 0; k < 3; k++) { const p = (t * 0.35 + k / 3) % 1; c.globalAlpha = 0.55 * (1 - p); c.fillStyle = '#d8f0c8'; c.fillRect(Math.round(X - 2 + Math.sin(p * 6 + k) * 3), Math.round(Y - 20 - p * 16), 3, 2); }
    c.globalAlpha = 1;
  }
  // лекарь
  const bed = spr.beds[bedI], rack = spr.rack, cau = spr.cauldron;
  let px, py, pose = 'walk', fr = Math.floor(t * 9) & 7, view = 'E', opt = {};
  const lerp = (p, q, f) => [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
  if (cyc < 6) { [px, py] = lerp(bed[0], bed[1], cyc / 6); py += 3; pose = 'work'; fr = { anim: 'reap', f: Math.floor(t * 8) % 8 }; }
  else if (cyc < 8) { [px, py] = lerp([bed[1][0], bed[1][1] + 3], [rack[0], rack[1] + 4], (cyc - 6) / 2); view = rack[0] < bed[1][0] ? 'W' : 'E'; }
  else if (cyc < 11) { [px, py] = [rack[0] + 4, rack[1] + 4]; pose = 'idle'; fr = 0; opt = { gest: 'stretch', gf: gestCyc(t) }; view = 'S'; }
  else if (cyc < 13) { [px, py] = lerp([rack[0] + 4, rack[1] + 4], [cau[0] + 10, cau[1] + 2], (cyc - 11) / 2); view = 'W'; }
  else if (cyc < 17) { [px, py] = [cau[0] + 10, cau[1] + 2]; pose = 'work'; fr = { anim: 'dig', f: Math.floor(t * 5) % 8 }; view = 'W'; }
  else { [px, py] = lerp([cau[0] + 10, cau[1] + 2], [bed[0][0], bed[0][1] + 3], cyc - 17); }
  drawFolk(c, { type: 'healer', look: b.id * 83 + 4, carry: cyc >= 6 && cyc < 8 ? 'hay' : null }, ox + px, oy + py, view, pose, fr, opt);
  c.imageSmoothingEnabled = R.smooth;
}

// ---------- Блок еды (bldpx.js): ферма, пекарня, хмельник, пивоварня, свинарник, бойня ----------
// Точки двора — spr.pt (из модели); кучи — spr.piles: стога сена у фермы и бочки у пивоварни растут с запасом.
// Чем выше уровень, тем больше народу и дел во дворе: ур. 2 — подмастерье, ур. 3 — ещё и гости/звери.
const pxLerp = (p, q, f) => [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
function drawPxPiles(c, b, spr, ox, oy) {
  for (const kind in spr.piles || {}) {
    const spots = spr.piles[kind], cap = (b.def.outputs && b.def.outputs[kind]) || 1;
    const total = Math.min(1, ((b.stock && b.stock[kind]) || 0) / cap) * spots.length;
    for (let i = 0; i < spots.length; i++) {
      const f = Math.max(0, Math.min(1, total - i));   // места заполняются по очереди
      if (f <= 0) continue;
      const P = pxPile(kind, f), [x, y] = spots[i];
      c.drawImage(P.cv, Math.round(ox + x - P.ax), Math.round(oy + y - P.ay), P.w, P.h);
    }
  }
}
// ходок туда-обратно: путь a→q за go с, работа на месте wk с (поза work/anim), обратно; ноша только по пути туда
function pxShuttle(t, a, q, go, wk, anim, carry) {
  const T = go * 2 + wk * 2, u = t % T, work = () => (anim ? { pose: 'work', fr: { anim, f: Math.floor(t * 7) % 8 } } : { pose: 'idle', fr: 0 });
  if (u < go) return { p: pxLerp(a, q, u / go), view: q[0] >= a[0] ? 'E' : 'W', pose: 'walk', fr: Math.floor(t * 9) & 7, carry };
  if (u < go + wk) return Object.assign({ p: q, view: 'S' }, work());
  if (u < go * 2 + wk) return { p: pxLerp(q, a, (u - go - wk) / go), view: a[0] >= q[0] ? 'E' : 'W', pose: 'walk', fr: Math.floor(t * 9) & 7 };
  return Object.assign({ p: a, view: 'S' }, work());
}
function pxFolk(c, type, look, s, ox, oy, opt) { drawFolk(c, { type, look, carry: s.carry || null }, ox + s.p[0], oy + s.p[1], s.view, s.pose, s.fr, opt || {}); }
function pxSmoke(c, X, Y, t, n, col) {
  for (let k = 0; k < n; k++) { const p = (t * 0.3 + k / n) % 1; c.globalAlpha = 0.5 * (1 - p); c.fillStyle = col || '#d8d4cc'; c.fillRect(Math.round(X - 1 + Math.sin(p * 5 + k) * 2 + p * 4), Math.round(Y - p * 18), 2 + Math.round(p * 2), 2); }
  c.globalAlpha = 1;
}
function pxLamp(c, P, ox, oy) { if (P.lamp) glow(c, ox + P.lamp[0], oy + P.lamp[1], 12, '255,210,120', 0.2); }
function drawFoodYard(c, b, spr, ox, oy) {
  if (b.state !== 'done' || !spr.pt) return;
  const P = spr.pt, t = Game.time + b.id * 5, on = !!b.working;
  c.imageSmoothingEnabled = false;
  drawPxPiles(c, b, spr, ox, oy);
  if (spr.px === 'farm') {
    if (P.hens) for (let k = 0; k < 3; k++) {   // куры бродят и клюют
      const u = Math.sin(t * 0.21 + k * 2.1) * 0.5 + 0.5, [x, y] = pxLerp(P.hens[0], P.hens[1], u), peck = Math.sin(t * 1.7 + k) > 0.3;
      drawCreatureAt(c, 'chicken', ox + x + k * 5, oy + y + (k % 2) * 3, Math.cos(t * 0.21 + k * 2.1) > 0 ? 1 : -1, !peck, t * 6 + k, peck ? 'peck' : null);
    }
    if (P.horse) drawCreatureAt(c, 'horse', ox + P.horse[0], oy + P.horse[1], -1, false, t * 2);
    if (P.farmer) pxFolk(c, 'farmer', b.id * 41 + 1, pxShuttle(t, P.farmer[0], P.farmer[1], 4, 3, 'dig', 'hay'), ox, oy);   // носит сено в сенник, ворошит вилами
    if (P.hand) pxFolk(c, 'farmer', b.id * 41 + 9, pxShuttle(t + 6, P.hand[0], P.hand[1], 5, 2, 'reap', 'wheat'), ox, oy);
  }
  if (spr.px === 'bakery') {
    if (P.oven) {
      const X = ox + P.oven[0], Y = oy + P.oven[1];
      glow(c, X, Y - 5, 10, '255,150,60', 0.28 + Math.sin(t * 7) * 0.06);   // жар в устье печи
      drawFire(c, X, Y - 2, 'tiny', t, b.id + 3, { glow: 0 });
      pxSmoke(c, X + 8, Y - 26, t, 4);
    }
    if (P.baker) drawFolk(c, { type: 'baker', look: b.id * 53 + 2 }, ox + P.baker[0], oy + P.baker[1], 'E', 'work', { anim: 'dig', f: Math.floor(t * 5) % 8 }, {});   // сажает хлеб лопатой
    if (P.knead) drawFolk(c, { type: 'baker', look: b.id * 53 + 7 }, ox + P.knead[0], oy + P.knead[1], 'N', 'work', { anim: 'pat', f: Math.floor(t * 6) % 8 }, {});   // месит тесто
    if (P.buyer) { const s = pxShuttle(t * 0.8 + 2.5, P.buyer[1], P.buyer[0], 3, 2, null, null); if (s.pose === 'walk' && s.view === (P.buyer[0][0] >= P.buyer[1][0] ? 'W' : 'E')) s.carry = 'bread'; pxFolk(c, 'serf', b.id * 17 + 5, s, ox, oy); }   // покупатель уходит с хлебом
    if (P.cat) {   // кот греется у печи, кончик хвоста дёргается
      const X = Math.round(ox + P.cat[0]), Y = Math.round(oy + P.cat[1]), w = Math.sin(t * 2) > 0.6 ? 1 : 0;
      c.fillStyle = '#3a2a22'; c.fillRect(X - 3, Y - 2, 6, 2); c.fillRect(X + 2, Y - 3, 2, 1); c.fillStyle = '#d88a3a'; c.fillRect(X - 2, Y - 2, 4, 1);
      c.fillStyle = '#3a2a22'; c.fillRect(X - 4 - w, Y - 1 - w, 1, 1);
    }
  }
  if (spr.px === 'hopfarm') {
    if (P.vent) pxSmoke(c, ox + P.vent[0], oy + P.vent[1], t, 5, '#e8ecd8');   // сушильня курится
    if (P.racks) P.racks.forEach((r, i) => drawFolk(c, { type: 'hopgrower', look: b.id * 29 + i }, ox + r[0], oy + r[1], 'E', 'work', { anim: i ? 'pat' : 'reap', f: Math.floor(t * 6 + i * 3) % 8 }, {}));   // развешивают шишки
  }
  if (spr.px === 'brewery') {
    if (P.vat) {   // чан кипит: жар под постаментом и пар
      const X = ox + P.vat[0], Y = oy + P.vat[1];
      glow(c, X, Y + 18, 9, '255,140,50', 0.22 + Math.sin(t * 6) * 0.05);
      for (let k = 0; k < 3; k++) { const p = (t * 0.32 + k / 3) % 1; c.globalAlpha = 0.6 * (1 - p); c.fillStyle = '#f0ece0'; c.fillRect(Math.round(X + 4 + Math.sin(p * 6 + k) * 3), Math.round(Y - 10 - p * 18), 3, 2); }
      c.globalAlpha = 1;
    }
    if (P.brewer) drawFolk(c, { type: 'brewer', look: b.id * 37 + 3 }, ox + P.brewer[0], oy + P.brewer[1], 'E', on ? 'work' : 'idle', on ? { anim: 'dig', f: Math.floor(t * 4) % 8 } : 0, {});   // мешает сусло
    if (P.roll) {   // подмастерье катит бочку из ворот к помосту
      const s = pxShuttle(t, P.roll[0], P.roll[1], 4, 1.5, null, null);
      if (t % 11 < 4) { const X = Math.round(ox + s.p[0] - 7), Y = Math.round(oy + s.p[1]), ph = Math.floor(t * 8) % 3; c.fillStyle = '#7a4e2c'; c.fillRect(X - 3, Y - 5, 6, 5); c.fillStyle = '#4a4e58'; c.fillRect(X - 3 + ph * 2, Y - 5, 1, 5); }
      pxFolk(c, 'brewer', b.id * 37 + 8, s, ox, oy);
    }
    if (P.taster) drawFolk(c, { type: 'serf', look: b.id * 13 + 6 }, ox + P.taster[0], oy + P.taster[1], 'S', 'idle', 0, { gest: 'drink', gf: gestCyc(t) });   // гость пробует пиво
    pxLamp(c, P, ox, oy);
  }
  if (spr.px === 'swine') {
    if (P.mud) for (let k = 0; k < 3; k++) { const p = (t * 0.7 + k / 3) % 1; if (p < 0.3) { c.fillStyle = '#5a3e26'; c.fillRect(Math.round(ox + P.mud[0] - 8 + k * 7), Math.round(oy + P.mud[1] - 2 - Math.sin(p / 0.3 * Math.PI) * 4), 1, 1); } }   // брызги грязи
    if (P.feed) {   // свинопас носит корм от хлева к корытам
      const path = P.feed, n = path.length - 1, u = (t % 16) / 16, back = u >= 0.5, k = Math.min(n - 1, Math.floor(((u * 2) % 1) * n)), f = (((u * 2) % 1) * n) % 1;
      const a = back ? path[n - k] : path[k], q = back ? path[n - k - 1] : path[k + 1], stop = f > 0.7 && !back, p = stop ? q : pxLerp(a, q, f / 0.7);
      drawFolk(c, { type: 'herder', look: b.id * 19 + 2, carry: back ? null : 'hay' }, ox + p[0], oy + p[1], q[0] >= a[0] ? 'E' : 'W', stop ? 'work' : 'walk', stop ? { anim: 'pat', f: Math.floor(t * 7) % 8 } : Math.floor(t * 9) & 7, {});
    }
    pxLamp(c, P, ox, oy);
  }
  if (spr.px === 'butchery') {
    const f = Math.floor(t * 7) % 8;
    if (P.butcher) drawFolk(c, { type: 'butcher', look: b.id * 47 + 1 }, ox + P.butcher[0], oy + P.butcher[1], 'W', 'work', { anim: 'chop', f }, {});   // рубит мясо на пне
    if (P.block && f >= 4 && f <= 6) for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI + f * 0.4, r = (f - 3) * 1.6; c.fillStyle = k % 2 ? '#c84a3a' : '#f0d8c8'; c.fillRect(Math.round(ox + P.block[0] + Math.cos(a) * r), Math.round(oy + P.block[1] - Math.sin(a) * r), 1, 1); }
    if (P.smoke) pxSmoke(c, ox + P.smoke[0], oy + P.smoke[1], t, 5, '#c8c4bc');   // коптильня
    if (P.carry) pxFolk(c, 'serf', b.id * 11 + 4, pxShuttle(t, P.carry[0], P.carry[1], 3.5, 1.5, null, 'sausage'), ox, oy);   // подмастерье носит мясо в лавку
    if (P.dog) {   // пёс ждёт обрезки, виляет хвостом
      const X = Math.round(ox + P.dog[0]), Y = Math.round(oy + P.dog[1]), w = Math.floor(t * 8) & 1;
      c.fillStyle = '#7a5434'; c.fillRect(X - 4, Y - 4, 7, 3); c.fillRect(X + 2, Y - 6, 3, 3); c.fillRect(X - 4, Y - 1, 1, 1); c.fillRect(X + 2, Y - 1, 1, 1);
      c.fillStyle = '#4a321e'; c.fillRect(X + 4, Y - 5, 1, 1); c.fillRect(X - 5 - w, Y - 5 - (1 - w), 1, 2);
    }
    pxLamp(c, P, ox, oy);
  }
  if (/mine$/.test(spr.px)) {
    const f = Math.floor(t * 7) % 8;
    if (P.cart) {   // вагонетка: выезжает из штольни к зрителю, стоит (разгрузка), возвращается; рядом её толкает шахтёр
      const T = 14, u = (t % T) / T, k = u < 0.4 ? u / 0.4 : u < 0.55 ? 1 : u < 0.95 ? 1 - (u - 0.55) / 0.4 : 0;
      const [x0, y0] = P.cart[0], [x1, y1] = P.cart[1], x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k, C = pxCart(spr.cartLoad || 'gold');
      const moving = (u < 0.4) || (u >= 0.55 && u < 0.95), out = u < 0.55;
      // толкающий идёт за вагонеткой: на выезде он дальше от зрителя (рисуем до неё), на въезде — ближе (после)
      const push = () => drawFolk(c, { type: 'miner', look: b.id * 71 + 2 }, ox + x + 1, oy + y + (out ? -7 : 9), out ? 'S' : 'N', moving ? 'walk' : 'idle', Math.floor(t * 9) & 7, {});
      if (out) push();
      c.drawImage(C.cv, Math.round((ox + x - C.ax) * 3) / 3, Math.round((oy + y - C.ay) * 3) / 3, C.w, C.h);
      if (!out) push();
    }
    if (P.miner && on) drawFolk(c, { type: 'miner', look: b.id * 71 + 5 }, ox + P.miner[0] + 14, oy + P.miner[1] + 3, 'W', 'work', { anim: 'mine', f }, {});   // долбит скалу сбоку от устья, не на рельсах
    if (P.wheel) {   // водяное колесо: брызги стекают с лопастей
      for (let k = 0; k < 4; k++) { const p = (t * 1.4 + k / 4) % 1; c.fillStyle = '#a8d8ff'; c.fillRect(Math.round(ox + P.wheel[0] - 6 + k * 4), Math.round(oy + P.wheel[1] + p * 12), 1, 1); }
    }
    if (P.panner) drawFolk(c, { type: 'miner', look: b.id * 71 + 9 }, ox + P.panner[0], oy + P.panner[1], 'N', 'work', { anim: 'pat', f }, {});   // моет золото в лотке
    if (P.kiln) { glow(c, ox + P.kiln[0], oy + P.kiln[1] - 3, 12, '255,140,40', 0.3 + Math.sin(t * 6) * 0.08); drawFire(c, ox + P.kiln[0], oy + P.kiln[1], 'tiny', t, b.id + 7, { glow: 0 }); }
    if (P.smoke) pxSmoke(c, ox + P.smoke[0], oy + P.smoke[1], t, 6, '#8a8690');
    if (P.stoker) drawFolk(c, { type: 'miner', look: b.id * 71 + 13 }, ox + P.stoker[0], oy + P.stoker[1], 'E', 'work', { anim: 'dig', f: Math.floor(t * 5) % 8 }, {});   // подбрасывает руду в печь
    if (P.pulley) { const a = t * 2.5, X = ox + P.pulley[0], Y = oy + P.pulley[1]; c.strokeStyle = 'rgba(200,200,210,0.8)'; c.lineWidth = 0.6; c.beginPath(); for (let k = 0; k < 3; k++) { const an = a + k * Math.PI / 3; c.moveTo(X - Math.cos(an) * 6, Y - Math.sin(an) * 6); c.lineTo(X + Math.cos(an) * 6, Y + Math.sin(an) * 6); } c.stroke(); }   // колесо копра вращается
    if (P.glow) P.glow.forEach(([x, y], i) => glow(c, ox + x, oy + y, 14, i % 2 ? '120,240,220' : '190,150,255', 0.18 + Math.sin(t * 1.8 + i * 1.3) * 0.08));   // друзы мерцают
    if (P.sorter) drawFolk(c, { type: 'miner', look: b.id * 71 + 17 }, ox + P.sorter[0], oy + P.sorter[1], 'N', 'work', { anim: 'pat', f }, {});   // сортирует кристаллы
  }
  c.imageSmoothingEnabled = R.smooth;
}
