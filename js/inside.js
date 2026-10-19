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
  if (slapTick(b, diners.length)) drawSlapScene(c, b, spr, tx, ty, ox, oy);
  else drawWaitress(c, b, spr, tx, ty, ox, oy, diners.length);
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
    gsp = mk('serf', gl, 'E', 'walk', Math.floor(el * 12) % 8);
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
      gsp = mk('serf', gl, 'E', 'walk', Math.floor(el * 9) % 8, nh); gsh = 1.6;     // голова понурая
    } else if (el < tUp) {                                               // нагибается
      gx = pickX; gflip = pickX < gx0 - 4;
      gsp = mk('serf', gl, 'E', 'duck', 0, nh); gsh = 0;
    } else if (el < tOn) {                                               // несёт колпак к голове
      gx = pickX; gflip = pickX < gx0 - 4; hatArm = true;
      gsp = mk('serf', gl, 'E', 'idle', 0, Object.assign({ gest: 'hat', gf: 0 }, nh));
    } else {                                                             // колпак снова часть спрайта
      const p = ease(clamp((el - tOn) / 1.5));
      gx = pickX + (dx - pickX) * p; gy = sy + (dy - sy) * p; gflip = dx < pickX;
      gsp = mk('serf', gl, 'E', 'walk', Math.floor(el * 9) % 8); gsh = 1;
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
    wsp = mk('waitress', wl, 'E', 'walk', Math.floor(el * 11) % 8);
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
