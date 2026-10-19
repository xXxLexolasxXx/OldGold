'use strict';
// Странные ночные существа, совсем не похожие на зверей. Открываются по ночам: 5-я — студень, 7-я — лампоглав,
// 10-я — часовой, 12-я — лента, 15-я — хоровод осколков (после 15-й приходят все пятеро).
// В первую ночь вида появляется один гарантированно (с записью в журнал); в любую ночь каждый вольный зверь
// с шансом 15–20 % подменяется одним из открытых странных существ: зверя на ночь убирают, на рассвете он возвращается.
// Существа безобидны, лишь пугают: глазеют, мигают, тикают. Второй формы нет; у каждого свой набор кадров.
// 18-я ночь — месяц с глазами на ножках.
// Звуков нет — только всплывающие надписи. Итоги идут в Game.faunaStat (oddJelly и т. д.); в сейв не пишутся.

const ST_KINDS = [
  { id: 'jelly',  name: 'студень',          night: 5,  speed: 0.8, fly: false, say: 'Бульк!' },
  { id: 'lamp',   name: 'лампоглав',        night: 7,  speed: 0.9, fly: false, say: 'Блим…' },
  { id: 'clock',  name: 'часовой',          night: 10, speed: 1.0, fly: true,  hover: 12, say: 'Тик-так' },
  { id: 'ribbon', name: 'лента',            night: 12, speed: 2.0, fly: true,  hover: 15, say: 'Шшш…' },
  { id: 'shards', name: 'хоровод осколков', night: 15, speed: 0.9, fly: true,  hover: 18, say: 'Динь…' },
  { id: 'moon',   name: 'месяц',            night: 18, speed: 1.0, fly: false, say: 'Лу-у-у…' },
];

const ST_PAL = {
  g: '#2f8a5c', G: '#6adaa0', w: '#f4f4e8', k: '#14141c', m: '#1e5a3c',
  f: '#2a2a32', y: '#ffe888', Y: '#f0b030', p: '#9a7a4a', c: '#b04a3a', C: '#3a2e58',
};
const ST_DIM = { ...ST_PAL, y: '#8a6a30', Y: '#6a4a20' };

// Студень: 6 кадров — стоит, дышит, присел, прыжок вверх, растянулся, шлёпнулся
const ST_JELLY = [
  ['....gggg....', '..ggGGGGgg..', '.ggGGGGGGgg.', '.gGwkGGwkGg.', 'ggGGGGGGGGgg', 'ggGGGGGGGGgg', '.mggggggggm.'],
  ['...gggggg...', '.ggGGGGGGgg.', 'ggGwkGGwkGgg', 'ggGGGGGGGGgg', 'ggGGGGGGGGgg', 'mggggggggggm'],
  ['.gggggggggg.', 'ggGwkGGwkGgg', 'ggGGGGGGGGgg', 'mggggggggggm'],
  ['.....gg.....', '...ggGGgg...', '..gGGGGGGg..', '..gGwkGwkg..', '..gGGGGGGg..', '..gGGGGGGg..', '...gGGGGg...', '....gggg....'],
  ['.....gg.....', '...ggGGgg...', '..gGGGGGGg..', '..gGwkGwkg..', '..gGGGGGGg..', '...gGGGGg...', '....gGGg....', '.....gg.....', '.....m......'],
  ['............', '.gggggggggg.', 'ggGGGGGGGGgg', 'gGwkGGGGwkGg', 'ggGGGGGGGGgg', 'mmggggggggmm'],
];
// Лампоглав: уличный фонарь с ручкой-кольцом и язычком пламени в стекле, на тонком шесте с руками-веточками и шарфом; четыре шага, мигание — тусклая палитра
const ST_LAMP_HEAD = ['....fff....', '...f...f...', '..fffffff..', '.ffyyyyyff.', '.fyyYYYyyf.', '.fyYYwYYyf.', '.fyyYYYyyf.', '.ffyyyyyff.', '..fffffff..'];
const ST_LAMP_ARMS = [['.....p.....', '..ppppppp..', '.p...p...p.', '.....p.....', '....ccc....', '.....p.....'], ['.....p.....', '..ppppppp..', '..p..p..p..', '.....p.....', '....ccc....', '.....p.....']];
const ST_LAMP_LEGS = [['....p.p....', '...pp.pp...'], ['.....p.....', '....p.p....'], ['....p.p....', '..pp...pp..'], ['.....p.....', '....p.p....']];

const ST_CACHE = {};
function stSprite(key, make) { return ST_CACHE[key] || (ST_CACHE[key] = make()); }

function stClockSprite(f) {
  return stSprite('clock' + f, () => {
    const S = 19, cv = mkCanvas(S, S), c = cv.getContext('2d'), mid = 9;
    const px = (x, y, col) => { c.fillStyle = col; c.fillRect(x | 0, y | 0, 1, 1); };
    const rot = (f % 4) * Math.PI / 16;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = x - mid + 0.0, dy = y - mid + 0.0, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const tooth = Math.cos((a - rot) * 8) > 0.15;
      if (r <= 6.2) px(x, y, r > 5.2 ? '#5a4a2a' : '#eadfb4');
      else if (r <= (tooth ? 8.6 : 7.2) && r > 6.2) px(x, y, tooth ? '#c89a38' : '#8a6a28');
    }
    for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; px(mid + Math.round(Math.cos(a) * 4.2), mid + Math.round(Math.sin(a) * 4.2), '#5a4a2a'); }
    const ha = f * Math.PI / 4 - Math.PI / 2;                          // «минутная» стрелка прыгает на кадр
    for (let t = 0; t < 5; t++) px(mid + Math.round(Math.cos(ha) * t), mid + Math.round(Math.sin(ha) * t), '#1e1a14');
    const ha2 = f * Math.PI / 24;
    for (let t = 0; t < 3; t++) px(mid + Math.round(Math.cos(ha2) * t), mid + Math.round(Math.sin(ha2) * t), '#a02820');
    px(mid, mid, '#1e1a14');
    const blink = f === 3 || f === 7, ox = (f >> 1) & 1;               // глаза: моргают, зрачки косят то влево, то вправо
    for (const ex of [mid - 4, mid + 1]) {
      if (blink) { px(ex, mid - 2, '#1e1a14'); px(ex + 1, mid - 2, '#1e1a14'); continue; }
      for (let dy = -3; dy <= -2; dy++) for (let dx = 0; dx < 3; dx++) px(ex + dx, mid + dy, '#ffffff');
      px(ex + 1 + ox, mid - 3, '#14141c'); px(ex + 1 + ox, mid - 2, '#14141c');
    }
    return cv;
  });
}
function stRibbonSprite(f) {
  return stSprite('ribbon' + f, () => {
    const W = 30, H = 16, cv = mkCanvas(W, H), c = cv.getContext('2d');
    const px = (x, y, col) => { c.fillStyle = col; c.fillRect(x | 0, y | 0, 1, 1); };
    for (let x = 0; x < 26; x++) {
      const amp = 1.5 + x * 0.12, y = 8 + Math.sin(x * 0.45 - f * Math.PI / 4) * amp, th = x < 4 ? 1 : x > 22 ? 4 : 3;
      for (let t = 0; t < th; t++) px(x, Math.round(y) - 1 + t, (Math.floor(x / 3) & 1) ? '#f0d0e6' : '#c0306a');
    }
    const hy = Math.round(8 + Math.sin(25 * 0.45 - f * Math.PI / 4) * (1.5 + 25 * 0.12));
    for (let t = -2; t <= 3; t++) for (let u = 0; u < 4; u++) px(26 + u, hy + t, u === 3 && Math.abs(t) > 1 ? '#00000000' : '#9a2058');
    px(27, hy, '#ffffff'); px(28, hy, '#ffffff'); px(28, hy - 1, '#ffffff'); px(28, hy, '#14141c');
    return cv;
  });
}
function stShardSprite(f) {
  return stSprite('shards' + f, () => {
    const S = 26, cv = mkCanvas(S, S), c = cv.getContext('2d'), mid = 13;
    const px = (x, y, col) => { c.fillStyle = col; c.fillRect(x | 0, y | 0, 1, 1); };
    const base = f * (Math.PI * 2 / 5) / 8;
    for (let i = 0; i < 5; i++) {
      const a = base + i * Math.PI * 2 / 5, cx = mid + Math.cos(a) * 8.5, cy = mid + Math.sin(a) * 4.6, front = Math.sin(a) > 0;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) * 2 + Math.abs(dy) > 4) continue;
        px(Math.round(cx) + dx, Math.round(cy) + dy, dx < 0 ? (front ? '#d0f8ff' : '#80b8d0') : dx > 0 ? (front ? '#60b0e0' : '#406888') : (front ? '#98e4ff' : '#5a98b8'));
      }
    }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) px(mid + dx, mid + dy, Math.abs(dx) + Math.abs(dy) < 2 ? '#fff0ff' : '#e090f0');
    return cv;
  });
}
function stMoonSprite(f) {
  return stSprite('moon' + f, () => {
    const W = 18, H = 24, cv = mkCanvas(W, H), c = cv.getContext('2d'), cx = 8, cy = 8;
    const px = (x, y, col) => { c.fillStyle = col; c.fillRect(x | 0, y | 0, 1, 1); };
    const walk = f < 4 ? f : 0, blink = f >= 4, bob = (walk & 1) ? 1 : 0;
    for (let y = 0; y < 17; y++) for (let x = 0; x < W; x++) {
      const inO = Math.hypot(x - cx, y - cy) <= 7.4, inCut = Math.hypot(x - (cx + 5), y - cy) <= 5.7;
      if (inO && !inCut) { const edge = Math.hypot(x - cx, y - cy) > 6.3 || Math.hypot(x - (cx + 5), y - cy) < 6.7; px(x, y + bob, edge ? '#c9b866' : x < cx - 2 ? '#f4eaa6' : '#e8dc88'); }
    }
    for (const ey of [4, 9]) {
      if (blink) { px(2, ey + 1 + bob, '#3a3220'); px(3, ey + 1 + bob, '#3a3220'); px(4, ey + 1 + bob, '#3a3220'); continue; }
      for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) px(2 + dx, ey + dy + bob, '#ffffff');
      px(4, ey + 1 + bob, '#14141c'); px(4, ey + 2 + bob, '#14141c');
    }
    const legs = [[[5, 0], [9, 0]], [[6, -1], [9, 1]], [[5, 0], [9, 0]], [[4, 1], [9, -1]]][walk];     // ножки шагают: слегка разведены и поочерёдно поднимаются
    for (const [lx, dy] of legs) { const top = 16 + bob; for (let y = top; y < 21 + dy; y++) px(lx, y, '#6a5a30'); px(lx - 1, 21 + dy, '#3a3220'); px(lx, 21 + dy, '#3a3220'); px(lx + 1, 21 + dy, '#3a3220'); }
    return cv;
  });
}
function stLampSprite(f) {
  const dim = f >= 4, walk = f & 3, key = 'lamp' + f;
  return stSprite(key, () => faSprite([...ST_LAMP_HEAD, ...ST_LAMP_ARMS[walk & 1], ...ST_LAMP_LEGS[walk]], dim ? ST_DIM : ST_PAL));
}
function stJellySprite(f) { return stSprite('jelly' + f, () => faSprite(ST_JELLY[f], ST_PAL)); }

// ---------- Существа ----------

function stStart(S) {
  const n = nightIndex() + 1;
  const open = ST_KINDS.map((k, i) => i).filter(i => ST_KINDS[i].night <= n);
  if (!open.length) return;
  const chance = 0.15 + Math.random() * 0.05;
  let repl = 0;
  const put = (a, list) => {
    const k = open[(Math.random() * open.length) | 0];
    S.list.push(stNew(k, a.x, a.y));
    S.hidden.push({ a, list }); repl++;
  };
  for (const a of Game.animals.slice()) {
    if (!ANIMALS[a.kind] || a.owner || a.hunted || a.chasedBy || a.loot || a.dead || a.state === 'flee' || a.stolenPet) continue;
    if (Math.random() < chance) { Game.animals.splice(Game.animals.indexOf(a), 1); put(a, 'animals'); }
  }
  for (const b of (Game.boars || []).slice()) if (Math.random() < chance) { Game.boars.splice(Game.boars.indexOf(b), 1); put(b, 'boars'); }
  if (repl) {
    fstat('oddRepl', repl);
    logEvent('night', `Этой ночью часть зверей подменили странные существа: ${repl}`, MAP_W >> 1, MAP_H >> 1);
  }
  // премьера нового вида
  const nw = ST_KINDS.findIndex(k => k.night === n);
  if (nw >= 0 && !S.list.some(c => c.k === nw)) {
    const s = wildSpot(14, false) || [(MAP_W >> 1) + 16, MAP_H >> 1];
    S.list.push(stNew(nw, s[0] + 0.5, s[1] + 0.5));
  }
  if (nw >= 0) {
    logEvent('night', `Ночь ${n}: в деревню забрело нечто странное — ${ST_KINDS[nw].name}`, MAP_W >> 1, MAP_H >> 1);
    toast(`Ночь ${n}: появилось странное существо — ${ST_KINDS[nw].name}`);
  }
}
function stNew(k, x, y) {
  return { k, x, y, hx: x, hy: y, ph: Math.random() * 9, face: Math.random() < 0.5 ? 1 : -1, state: 'idle', t: 1 + Math.random() * 3, go: null, hop: 0, fl: 0, moving: false, said: 0 };
}
function stEnd(S) {
  for (const h of S.hidden) {
    if (h.list === 'boars') (Game.boars || (Game.boars = [])).push(h.a); else Game.animals.push(h.a);
  }
  S.hidden = []; S.list = [];
}

function stTick(dt) {
  const S = Game.strange || (Game.strange = { list: [], hidden: [], night: -1 });
  const n = nightAmt();
  if (n > 0.5 && S.night !== nightIndex() && startOpen('strange')) { S.night = nightIndex(); stStart(S); }
  if (n < 0.08 && (S.list.length || S.hidden.length)) stEnd(S);
  for (const c of S.list) {
    const K = ST_KINDS[c.k];
    c.ph += dt; c.t -= dt; c.said -= dt;
    const p = nearestPerson(c, c.k === 3 ? 4 : 3, u => isPerson(u) && !u.dead && u.type !== 'carter');
    if (p && c.said <= 0) {
      c.said = 7 + Math.random() * 6; floater(c.x, c.y - 1.4 - (K.hover || 0) / TILE, K.say, '#d8ccff'); fstat('odd' + K.id);
      if (c.k === 1) c.fl = 0.6;
      if (!S.seen) S.seen = {};
      if (!S.seen[c.k]) { S.seen[c.k] = 1; logEvent('night', `Гном столкнулся со странным существом: ${K.name}`, c.x, c.y); }
    }
    if (c.fl > 0) c.fl -= dt;
    if (p) c.face = p.x > c.x ? 1 : -1;
    const can = K.fly ? ((x, y) => inb(x, y)) : beLand;
    if (c.k === 3 && p) {                                             // лента шарахается от гнома
      const dx = c.x - p.x, dy = c.y - p.y, d = Math.hypot(dx, dy) || 1;
      beStep(c, c.x + dx / d * 3, c.y + dy / d * 3, K.speed * 1.8, dt, can); continue;
    }
    if (c.k === 0) {                                                  // студень скачет: присел, взлетел, шлёпнулся
      if (c.go) {
        c.hop += dt;
        const q = c.hop;
        if (q > 0.3 && q < 0.7) beStep(c, c.go[0], c.go[1], K.speed * 3.2, dt, can);
        if (q > 1.1) { c.hop = 0; if (Math.hypot(c.go[0] - c.x, c.go[1] - c.y) < 0.3) { c.go = null; c.t = 1.5 + Math.random() * 3; } }
      } else if (c.t <= 0) {
        const t = randomFreeNear(Math.floor(c.hx), Math.floor(c.hy), 0, 6, (x, y) => beLand(x, y) && isWalkable(x, y));
        if (t) { c.go = [t[0] + 0.5, t[1] + 0.5]; c.hop = 0; } else c.t = 2;
      }
      continue;
    }
    if (c.go) { if (beStep(c, c.go[0], c.go[1], K.speed, dt, can) || !c.moving) { c.go = null; c.t = 1 + Math.random() * 3; c.moving = false; } }
    else if (c.t <= 0) {
      const r = K.fly ? 8 : 5, tx = c.hx + (Math.random() * 2 - 1) * r, ty = c.hy + (Math.random() * 2 - 1) * r;
      if (inb(Math.floor(tx), Math.floor(ty)) && (K.fly || beLand(Math.floor(tx), Math.floor(ty)))) c.go = [tx, ty]; else c.t = 1;
    }
  }
}

function stFrame(c) {
  if (c.k === 0) {
    if (!c.go) return (Math.floor(c.ph * 0.9) & 1) ? 1 : 0;
    const q = c.hop;
    return q < 0.3 ? 2 : q < 0.5 ? 3 : q < 0.7 ? 4 : q < 0.85 ? 5 : 2;
  }
  if (c.k === 1) return c.fl > 0 ? 4 + (Math.floor(c.ph * 14) & 1) : (c.moving ? Math.floor(c.ph * 2.2) & 3 : 0);
  if (c.k === 2) return Math.floor(c.ph * 4) & 7;
  if (c.k === 3) return Math.floor(c.ph * 9) & 7;
  if (c.k === 5) return (Math.floor(c.ph * 0.7) % 5 === 4 && !c.moving) ? 4 + (Math.floor(c.ph * 6) & 1) : (c.moving ? Math.floor(c.ph * 3) & 3 : 0);
  return Math.floor(c.ph * 6) & 7;
}
function stDraw(c, o) {
  const K = ST_KINDS[o.k], vis = Math.max(0, Math.min(1, (nightAmt() - 0.12) / 0.3));
  if (vis <= 0.02) return;
  const f = stFrame(o), px = o.x * TILE, py = o.y * TILE + 3;
  const lift = K.fly ? K.hover + Math.sin(o.ph * 2) * 2 : 0;
  c.globalAlpha = vis;
  c.fillStyle = 'rgba(10,8,4,' + (0.28 - (K.fly ? 0.12 : 0)) + ')'; c.beginPath(); c.ellipse(px, py, K.fly ? 6 : 5, 1.8, 0, 0, 7); c.fill();
  const spr = o.k === 0 ? stJellySprite(f) : o.k === 1 ? stLampSprite(f) : o.k === 2 ? stClockSprite(f) : o.k === 3 ? stRibbonSprite(f) : o.k === 5 ? stMoonSprite(f) : stShardSprite(f);
  const w = spr.width, h = spr.height;
  const glow = o.k === 1 ? [255, 220, 120, o.fl > 0 ? 0.08 : 0.22, 18, -h + 6] : o.k === 4 ? [140, 220, 255, 0.2, 18, -h / 2] : o.k === 2 ? [255, 210, 120, 0.1, 12, -h / 2] : o.k === 5 ? [255, 244, 170, 0.16, 16, -h / 2] : null;
  if (glow) {
    const prev = c.globalCompositeOperation; c.globalCompositeOperation = 'lighter';
    for (let r = 3; r >= 1; r--) { c.fillStyle = `rgba(${glow[0]},${glow[1]},${glow[2]},${glow[3] * vis / r})`; const R2 = glow[4] * (4 - r) / 3; c.beginPath(); c.ellipse(px, py - lift + glow[5], R2, R2 * 0.8, 0, 0, 7); c.fill(); }
    c.globalCompositeOperation = prev; c.globalAlpha = vis;
  }
  c.imageSmoothingEnabled = false;
  c.save(); c.translate(Math.round(px), Math.round(py - h - lift + 1));
  if (o.face < 0 && o.k !== 4 && o.k !== 2) c.scale(-1, 1);
  c.drawImage(spr, -Math.round(w / 2), 0);
  c.restore();
  c.imageSmoothingEnabled = R.smooth; c.globalAlpha = 1;
}
function stDrawList(list, c, x0, y0, x1, y1) {
  const S = Game.strange;
  if (!S) return;
  for (const o of S.list) if (o.x >= x0 - 2 && o.x <= x1 + 2 && o.y >= y0 - 3 && o.y <= y1 + 3) list.push([o.y + (ST_KINDS[o.k].fly ? 1.2 : 0.1), () => stDraw(c, o)]);
}
