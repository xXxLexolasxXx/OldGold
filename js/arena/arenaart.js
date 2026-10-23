'use strict';
// Графика арены (АРЕНА.md, 14): песок с утоптанными кругами, борт из брёвен, трибуны с гномами-болельщиками,
// распорядитель Брюм с рупором на помосте, знамёна лиг, колонны и ящики Брюма, зоны, снаряды, телеграфы и бойцы.
// Всё своей рисовкой. Бойцы — те же гномы-герои из people.js (personSprite, наряд класса hero_<класс>),
// вспышки и свечения способностей — те же drawAbilBurst/drawAbilAura (herokit.js, heroult.js).
// Мир арены — в клетках ядра (arenasim.js), на холсте клетка = TILE пикселей, как в деревне.

const AR_LEAGUES = [['Опилки', '#c8a878'], ['Солома', '#e8c860'], ['Глина', '#b8643a'], ['Ржавое железо', '#9a5a3a'], ['Чугун', '#4a4a52'], ['Старое золото', '#d4a018']];
const AR_FAN_COATS = ['#8a1c22', '#2e5a7e', '#6e8e3a', '#8a6e4c', '#5a3a6a', '#c86a3a', '#3e6a5a', '#7a5432'];
const AR_WPN = { warrior: 'sword|wshield|1', barbarian: 'axe2||1', archer: 'bow||1', rogue: 'dagger|bdagger|1', mage: 'staff||1', druid: 'wstaff||1',
  priest: 'mace||1', paladin: 'sword|wshield|1', bard: 'rsword||1', monk: 'fists||1' };
const AR_RAD = 10.6;                      // до какого радиуса (клеток) рисуются трибуны
const AR_FS = 1.5;                        // бойцы крупнее болельщиков: на арене важнее читать позу и замах

// ---------- Статичный фон: трибуны, борт, песок (рисуется один раз) ----------
let AR_BG = null;
function arBgCanvas() {
  if (AR_BG) return AR_BG;
  const T = ARENA_TUNE, W = Math.ceil(AR_RAD * 2 * TILE), cv = mkCanvas(W, W), c = cv.getContext('2d');
  const cx = W / 2, cy = W / 2, R = T.R * TILE;
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  c.fillStyle = '#140d07'; c.fillRect(0, 0, W, W);
  // трибуны: ряды деревянных скамей по кругу, светлее к арене
  for (let k = 0; k < 4; k++) {
    const r0 = R + (0.75 + k * 0.78) * TILE;
    c.lineWidth = 0.62 * TILE;
    c.strokeStyle = ['#5a3a1c', '#4e3218', '#432a14', '#382210'][k];
    c.beginPath(); c.arc(cx, cy, r0, 0, 7); c.stroke();
    c.lineWidth = 2; c.strokeStyle = 'rgba(255,220,160,0.12)';
    c.beginPath(); c.arc(cx, cy, r0 - 0.3 * TILE, 0, 7); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,0.35)';
    c.beginPath(); c.arc(cx, cy, r0 + 0.3 * TILE, 0, 7); c.stroke();
  }
  // проходы между секторами
  for (let a = 0; a < 6; a++) {
    const an = a / 6 * Math.PI * 2 + 0.26;
    c.strokeStyle = '#1e140a'; c.lineWidth = 10;
    c.beginPath(); c.moveTo(cx + Math.cos(an) * (R + 12), cy + Math.sin(an) * (R + 12)); c.lineTo(cx + Math.cos(an) * AR_RAD * TILE, cy + Math.sin(an) * AR_RAD * TILE); c.stroke();
  }
  // песок
  const g = c.createRadialGradient(cx, cy - R * 0.2, R * 0.1, cx, cy, R);
  g.addColorStop(0, '#dcc08a'); g.addColorStop(0.7, '#cfae74'); g.addColorStop(1, '#b8945a');
  c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fill();
  for (let k = 0; k < 900; k++) {
    const a = rnd() * 7, r = Math.sqrt(rnd()) * R * 0.98;
    c.fillStyle = rnd() < 0.5 ? 'rgba(150,118,70,0.45)' : 'rgba(240,220,170,0.45)';
    c.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 2, 1);
  }
  // утоптанные круги и центр
  c.strokeStyle = 'rgba(140,108,62,0.35)'; c.lineWidth = 3;
  for (const k of [0.32, 0.62]) { c.beginPath(); c.arc(cx, cy, R * k, 0, 7); c.stroke(); }
  c.fillStyle = 'rgba(140,108,62,0.25)'; c.beginPath(); c.arc(cx, cy, 10, 0, 7); c.fill();
  // стартовые метки
  for (const s of [-1, 1]) { c.strokeStyle = 'rgba(120,90,50,0.5)'; c.lineWidth = 2; c.beginPath(); c.arc(cx + s * T.start * TILE, cy + 6, 9, 0, 7); c.stroke(); }
  // борт: брёвна по кругу
  const N = 64;
  for (let k = 0; k < N; k++) {
    const a = k / N * Math.PI * 2, x = cx + Math.cos(a) * (R + 7), y = cy + Math.sin(a) * (R + 7);
    c.fillStyle = k % 2 ? '#7a5028' : '#6a4420'; c.beginPath(); c.arc(x, y, 7.5, 0, 7); c.fill();
    c.fillStyle = '#a07040'; c.beginPath(); c.arc(x - 1.5, y - 2, 3, 0, 7); c.fill();
    c.fillStyle = '#3a2410'; c.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
  }
  // знамёна лиг на верхних трибунах
  AR_LEAGUES.forEach(([, col], i) => {
    const a = -Math.PI / 2 + (i - 2.5) * 0.2, r = R + 3.3 * TILE, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    c.fillStyle = '#3a2410'; c.fillRect(Math.round(x) - 1, Math.round(y) - 34, 2, 36);
    c.fillStyle = col; c.fillRect(Math.round(x) + 1, Math.round(y) - 33, 14, 18);
    c.beginPath(); c.moveTo(x + 1, y - 15); c.lineTo(x + 8, y - 10); c.lineTo(x + 15, y - 15); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(Math.round(x) + 1, Math.round(y) - 33, 14, 2);
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(Math.round(x) + 6, Math.round(y) - 29, 4, 8);
  });
  AR_BG = cv;
  return cv;
}

// ---------- Болельщики ----------
function arFansMake(seed) {
  const T = ARENA_TUNE, fans = [];
  let s = seed >>> 0 || 1;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const n = 30;
  for (let k = 0; k < n; k++) {
    const row = k % 3, a = (k / n) * Math.PI * 2 + rnd() * 0.12 - Math.PI / 2 + 0.11;
    if (Math.abs(Math.cos(a + Math.PI / 2)) < 0.17 && Math.sin(a) < 0) continue;      // наверху — помост Брюма
    const r = T.R + 1.0 + row * 0.8 + rnd() * 0.2;
    fans.push({ x: T.cx + Math.cos(a) * r, y: T.cy + Math.sin(a) * r + 0.2, cap: HA_CAP_COLS[(rnd() * HA_CAP_COLS.length) | 0], coat: AR_FAN_COATS[(rnd() * AR_FAN_COATS.length) | 0],
      beard: HA_BEARD_COLS[(rnd() * HA_BEARD_COLS.length) | 0], ph: rnd() * 7, st: 'sit', stT: 0, drink: rnd() < 0.3 });
  }
  return fans;
}
// реакция трибун: cheer — вскочить и махать, gasp — ахнуть, boo — свистеть, mug — кружки в воздух, laugh — смех
function arFansReact(fans, kind, now, share) {
  for (const f of fans) if (Math.random() < (share || 1)) { f.st = kind; f.stT = now + 1.2 + Math.random() * 1.2; }
}
function arDrawFan(c, f, t) {
  const st = f.stT > t ? f.st : 'sit';
  const x = Math.round(f.x * TILE), bob = st === 'cheer' || st === 'mug' ? -Math.abs(Math.sin(t * 9 + f.ph)) * 6 - 3 : st === 'laugh' ? Math.sin(t * 20 + f.ph) * 1.2 : 0;
  const y = Math.round(f.y * TILE + bob);
  c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x - 6, Math.round(f.y * TILE) + 3, 12, 3);
  c.fillStyle = f.coat; c.fillRect(x - 5, y - 9, 10, 11);                 // тело
  c.fillStyle = '#e4b08a'; c.fillRect(x - 4, y - 17, 8, 7);              // лицо
  c.fillStyle = f.beard; c.fillRect(x - 4, y - 12, 8, 6); c.fillRect(x - 3, y - 6, 6, 2);
  c.fillStyle = '#1a1008'; c.fillRect(x - 2, y - 15, 1, 1); c.fillRect(x + 1, y - 15, 1, 1);
  if (st === 'gasp' || st === 'laugh') { c.fillStyle = '#3a1008'; c.fillRect(x - 1, y - 11, 2, 2); }
  c.fillStyle = f.cap; c.fillRect(x - 5, y - 20, 10, 4); c.fillRect(x - 3, y - 23, 6, 3); c.fillRect(x - 1, y - 25, 3, 2);
  // руки: вверх — радуется, ко рту — свистит, кружка — пьёт
  c.fillStyle = '#e4b08a';
  if (st === 'cheer' || st === 'mug') {
    const w = Math.sin(t * 14 + f.ph) * 2;
    c.fillRect(x - 8, y - 18 + w, 3, 8); c.fillRect(x + 5, y - 18 - w, 3, 8);
    if (st === 'mug') { c.fillStyle = '#d8d0c0'; c.fillRect(x + 5, y - 24 - w, 5, 6); c.fillStyle = '#f4ecd0'; c.fillRect(x + 5, y - 25 - w, 5, 2); }
  } else if (st === 'boo') { c.fillRect(x + 2, y - 12, 3, 3); if (Math.sin(t * 30) > 0) { c.fillStyle = '#fff'; c.fillRect(x + 6, y - 15, 2, 1); } }
  else if (f.drink && Math.sin(t * 0.7 + f.ph) > 0.6) { c.fillStyle = '#d8d0c0'; c.fillRect(x + 3, y - 13, 4, 5); c.fillStyle = '#f4ecd0'; c.fillRect(x + 3, y - 14, 4, 1); }
  else { c.fillRect(x - 6, y - 6, 2, 4); c.fillRect(x + 4, y - 6, 2, 4); }
}

// ---------- Брюм: распорядитель с рупором на помосте ----------
function arDrawBrum(c, t, talk, mood) {
  const T = ARENA_TUNE, x = Math.round(T.cx * TILE), y = Math.round((T.cy - T.R - 1.25) * TILE);
  // помост
  c.fillStyle = '#4a2c14'; c.fillRect(x - 22, y + 2, 44, 12); c.fillStyle = '#6a4420'; c.fillRect(x - 22, y + 2, 44, 3);
  c.fillStyle = '#2a1a0c'; c.fillRect(x - 20, y + 14, 4, 8); c.fillRect(x + 16, y + 14, 4, 8);
  c.fillStyle = '#c89226'; c.fillRect(x - 22, y + 7, 44, 2);
  const bob = talk ? Math.sin(t * 16) * 0.8 : Math.sin(t * 2) * 0.4, b = Math.round(bob);
  // толстый гном в бордовом камзоле, золотая цепь
  c.fillStyle = '#6e1c22'; c.fillRect(x - 9, y - 14 + b, 18, 16);
  c.fillStyle = '#d4a018'; c.fillRect(x - 6, y - 12 + b, 12, 1); c.fillRect(x - 1, y - 11 + b, 2, 3);
  c.fillStyle = '#e8b890'; c.fillRect(x - 6, y - 25 + b, 12, 10);
  c.fillStyle = '#ece6cc'; c.fillRect(x - 7, y - 18 + b, 14, 9); c.fillRect(x - 5, y - 9 + b, 10, 3);
  c.fillStyle = '#1a1008'; c.fillRect(x - 3, y - 22 + b, 2, 2); c.fillRect(x + 1, y - 22 + b, 2, 2);
  // цилиндр
  c.fillStyle = '#2a2a30'; c.fillRect(x - 8, y - 27 + b, 16, 3); c.fillRect(x - 5, y - 37 + b, 10, 10);
  c.fillStyle = '#c83a28'; c.fillRect(x - 5, y - 30 + b, 10, 2);
  // рупор у рта или рука вверх (mood: win — поднимает руку победителя, scratch — чешет затылок)
  c.fillStyle = '#e8b890';
  if (mood === 'win') { c.fillRect(x + 8, y - 34 + b, 3, 14); }
  else if (mood === 'scratch') { c.fillRect(x - 10, y - 30 + b, 3, 8); }
  c.fillStyle = '#c8a050';
  const mx = x + 7, my = y - 18 + b + (talk ? Math.round(Math.sin(t * 12)) : 0);
  c.beginPath(); c.moveTo(mx, my - 2); c.lineTo(mx + 12, my - 6); c.lineTo(mx + 12, my + 5); c.lineTo(mx, my + 2); c.fill();
  c.fillStyle = '#8a6a28'; c.fillRect(mx + 11, my - 6, 2, 11);
  if (talk) for (let k = 0; k < 3; k++) { const q = (t * 2 + k / 3) % 1; c.strokeStyle = `rgba(255,240,200,${0.7 * (1 - q)})`; c.lineWidth = 1; c.beginPath(); c.arc(mx + 13, my, 4 + q * 10, -0.7, 0.7); c.stroke(); }
}

// ---------- Препятствия ----------
function arDrawObs(c, o) {
  const x = Math.round(o.x * TILE), y = Math.round(o.y * TILE), r = o.r * TILE;
  c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(x + 3, y + r * 0.6, r * 1.1, r * 0.45, 0, 0, 7); c.fill();
  if (o.k === 'col') {
    // каменная колонна: ствол с бороздами, капитель
    const h = 54, w = Math.round(r * 1.6);
    const g = c.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    g.addColorStop(0, '#8a8478'); g.addColorStop(0.4, '#c4bcaa'); g.addColorStop(1, '#6a645a');
    c.fillStyle = g; c.fillRect(x - w / 2, y - h, w, h + 4);
    c.fillStyle = 'rgba(0,0,0,0.18)'; for (const k of [-0.25, 0.1, 0.35]) c.fillRect(Math.round(x + k * w), y - h + 4, 1, h - 4);
    c.fillStyle = '#a49a88'; c.fillRect(x - w / 2 - 3, y - h - 5, w + 6, 6); c.fillRect(x - w / 2 - 3, y - 2, w + 6, 6);
    c.fillStyle = '#d8d0bc'; c.fillRect(x - w / 2 - 3, y - h - 5, w + 6, 1);
    c.fillStyle = 'rgba(60,100,40,0.5)'; c.fillRect(x - w / 2, y - 12, 4, 10);          // мох у подножия
  } else {
    // ящик Брюма: доски, железные углы, клеймо — кружка
    const s = Math.round(r * 2);
    c.fillStyle = '#8a5a2a'; c.fillRect(x - s / 2, y - s, s, s);
    c.fillStyle = '#a8702e'; c.fillRect(x - s / 2, y - s, s, 4);
    c.fillStyle = '#5a3a1a'; for (const k of [0.33, 0.66]) c.fillRect(x - s / 2, Math.round(y - s + s * k), s, 1);
    c.strokeStyle = '#3a2410'; c.lineWidth = 1; c.strokeRect(x - s / 2 + 0.5, y - s + 0.5, s - 1, s - 1);
    c.fillStyle = '#7a8088'; for (const [dx, dy] of [[0, 0], [s - 4, 0], [0, s - 4], [s - 4, s - 4]]) c.fillRect(x - s / 2 + dx, y - s + dy, 4, 4);
    c.fillStyle = '#d8c48a'; c.fillRect(x - 4, y - s / 2 - 4, 6, 7); c.fillRect(x + 2, y - s / 2 - 2, 2, 3);
  }
}

// ---------- Зоны и снаряды ----------
function arRingFill(c, x, y, r, rgb, a, dash) {
  c.save();
  c.fillStyle = `rgba(${rgb},${a * 0.35})`; c.beginPath(); c.arc(x * TILE, y * TILE, r * TILE, 0, 7); c.fill();
  c.strokeStyle = `rgba(${rgb},${Math.min(1, a + 0.2)})`; c.lineWidth = 2; if (dash) c.setLineDash([6, 4]);
  c.beginPath(); c.arc(x * TILE, y * TILE, r * TILE, 0, 7); c.stroke();
  c.restore();
}
function arDrawZone(c, z, t, mine) {
  const left = z.t1 - t, a = Math.max(0, Math.min(1, left / 0.8)) * Math.min(1, (t - z.t0) / 0.3 + 0.3);
  if (z.k === 'trap') {
    // капкан соперника виден бледнее — но виден (честно: телеграфы читаются)
    c.save(); c.globalAlpha = mine ? 1 : 0.55;
    if (typeof abDrawZone === 'function') abDrawZone(c, { k: 'trap', x: z.x, y: z.y }, t);
    c.restore();
  } else if (z.k === 'roots') {
    arRingFill(c, z.x, z.y, z.r, '90,170,60', 0.35 * a, true);
    for (let k = 0; k < 14; k++) { const an = k / 14 * 6.28, rr = z.r * TILE * (0.3 + 0.6 * ((k * 0.618) % 1)); c.fillStyle = `rgba(110,80,40,${0.8 * a})`; c.fillRect(Math.round(z.x * TILE + Math.cos(an) * rr), Math.round(z.y * TILE + Math.sin(an) * rr), 3, 2); }
  } else if (z.k === 'holy' || z.k === 'sun' || z.k === 'grove') {
    if (typeof abDrawZone === 'function') abDrawZone(c, { k: z.k, x: z.x, y: z.y, r: z.r, s: z.t0, until: z.t1 }, t);
    if (z.k === 'grove' || z.k === 'sun') arRingFill(c, z.x, z.y, z.r, z.k === 'grove' ? '110,230,90' : '255,226,120', 0.12 * a, true);
  } else if (z.k === 'rain') {
    const pre = z.nt > t && z.n === 0;
    arRingFill(c, z.x, z.y, z.r, '255,80,50', (pre ? 0.6 + 0.3 * Math.sin(t * 20) : 0.35) * a, true);
  } else if (z.k === 'meteor') {
    arRingFill(c, z.x, z.y, 1.4, '255,140,50', 0.25 * a, true);
    for (const M of z.marks || []) {
      const p = 1 - Math.max(0, (M.t - t) / ARENA_TUNE.ab.ult_mage.fall);
      arRingFill(c, M.x, M.y, ARENA_TUNE.ab.ult_mage.hitR * (0.5 + 0.5 * p), '255,90,30', 0.5 * p + 0.2, true);
      const hx = M.x * TILE - (1 - p) * 60, hy = M.y * TILE - (1 - p) * 140;
      c.fillStyle = 'rgba(255,170,60,0.9)'; c.beginPath(); c.arc(hx, hy, 6, 0, 7); c.fill();
      c.fillStyle = '#fff6d0'; c.beginPath(); c.arc(hx, hy, 3, 0, 7); c.fill();
    }
  }
}
const AR_SHOT_COL = { arrow: '#e8e0d0', bolt: '#b090ff', thorn: '#8ae070', fire: '#ff9a30', frost: '#9ee0ff' };
// dx, dy — куда летит (к цели): по ним рисуется древко стрелы
function arDrawShot(c, p, t, dx, dy) {
  if (p.delay > 0) return;
  const x = p.x * TILE, y = p.y * TILE - 16, col = AR_SHOT_COL[p.kind] || '#fff';
  if (p.kind === 'arrow') {
    const L = Math.sqrt(dx * dx + dy * dy) || 1;
    c.strokeStyle = '#a06840'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - dx / L * 12, y - dy / L * 12); c.lineTo(x, y); c.stroke();
    c.fillStyle = '#dcdcd4'; c.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
    if (p.sure) { c.fillStyle = 'rgba(255,90,80,0.8)'; c.fillRect(Math.round(x - dx / L * 12) - 1, Math.round(y - dy / L * 12) - 1, 3, 3); }
    return;
  }
  const r = p.kind === 'fire' ? 6 : p.kind === 'frost' ? 5 : 4;
  if (typeof glow === 'function') glow(c, x, y, r * 3, hexRgbStr(col), 0.55);
  c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x - 1, y - 1, r * 0.4, 0, 7); c.fill();
}

// ---------- Телеграф тяжёлого удара: красный клин на земле ----------
function arDrawWedge(c, F, t) {
  const sw = F.swing, T = ARENA_TUNE;
  if (!sw) return;
  const p = Math.max(0, Math.min(1, (t - sw.t0) / (sw.t1 - sw.t0)));
  const x = F.x * TILE, y = F.y * TILE + 4, r = sw.r * TILE, a0 = Math.atan2(sw.uy, sw.ux), da = Math.acos(T.heavyCos);
  c.save();
  c.fillStyle = `rgba(255,50,30,${0.12 + 0.12 * p})`;
  c.beginPath(); c.moveTo(x, y); c.arc(x, y, r, a0 - da, a0 + da); c.closePath(); c.fill();
  c.fillStyle = `rgba(255,60,30,${0.25 + 0.3 * p})`;
  c.beginPath(); c.moveTo(x, y); c.arc(x, y, r * p, a0 - da, a0 + da); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,90,60,0.95)'; c.lineWidth = 2; c.setLineDash([5, 3]);
  c.beginPath(); c.moveTo(x, y); c.arc(x, y, r, a0 - da, a0 + da); c.closePath(); c.stroke();
  c.restore();
}

// ---------- Боец ----------
// h — держатель спрайта (personSprite хранит в нём последний кадр); look — облик; pot — «позорный горшок» на голове
function arDrawFighter(c, A, F, x, y, t, holder, me) {
  const S = A.S, T = ARENA_TUNE, now = S.T;
  const st = F.st, dead = F.dead;
  const inv = st.invis > now;
  if (inv && !me) return;                                        // невидимого соперника не видно (только пыль)
  const px = Math.round(x * TILE), py = Math.round(y * TILE + 6);
  // кольцо под ногами: своё — синее, соперник — красное
  c.save();
  c.strokeStyle = me ? 'rgba(110,180,255,0.85)' : 'rgba(255,90,70,0.85)'; c.lineWidth = 2;
  c.beginPath(); c.ellipse(px, py - 2, 16, 6.5, 0, 0, 7); c.stroke();
  c.fillStyle = 'rgba(10,8,4,0.3)'; c.beginPath(); c.ellipse(px + 1, py - 1, 11, 4, 0, 0, 7); c.fill();
  c.restore();
  // кадр: ходьба, удар, каст, получил, стойка; у победителя раунда — победная
  let pose = 'fight', frame = 'ready', view = 'E';
  const moving = Math.sqrt(F.vx * F.vx + F.vy * F.vy) > 0.4 && !F.swing;
  const an = F.anim, ae = an ? now - an.t : 9;
  if (S.phase === 'end' && S.lastW === F.i || S.phase === 'over' && S.winner === F.i) frame = Math.floor(t * 4) % 2 ? 'win1' : 'win0';
  else if (F.swing) frame = 'windup';
  else if (an && an.k === 'atk' && ae < 0.36) frame = ae < 0.1 ? 'windup' : ae < 0.22 ? 'strike' : 'follow';
  else if (an && an.k === 'cast' && ae < 0.55) frame = 'c' + Math.min(5, Math.floor(ae / 0.55 * 6));
  else if (st.stun > now || st.ice > now || (an && an.k === 'hurt' && ae < 0.25)) frame = 'hurt';
  else if (moving) { pose = 'walk'; frame = Math.floor((A.walk[F.i] || 0)) & 7; }
  const spr = typeof personSprite === 'function' ? personSprite(holder, view, pose, frame, { wpn: AR_WPN[F.cls] }) : null;
  const face = F.face || 1;
  c.save();
  c.imageSmoothingEnabled = false;
  if (inv) c.globalAlpha = 0.35 + 0.08 * Math.sin(t * 6);
  if (F.st.inv > now && F.roll && !F.roll.leap) c.globalAlpha *= 0.85;
  c.translate(px, py);
  if (dead) { c.translate(0, -2); c.rotate(-Math.PI / 2 * face); }
  else if (F.roll && !F.roll.leap) { const p = Math.min(1, (now - F.roll.t0) / T.rollMove); c.translate(0, -8); c.rotate(p * Math.PI * 2 * (F.roll.dx >= 0 ? 1 : -1)); c.translate(0, 8); }
  else if (F.roll && F.roll.leap) c.translate(0, -Math.sin(Math.min(1, (now - F.roll.t0) / 0.25) * Math.PI) * 10);
  c.scale(AR_FS, AR_FS);
  if (F.buf.ult_barbarian > now || F.buf.wild > now) c.scale(1.14, 1.14);
  if (face < 0) c.scale(-1, 1);
  if (spr) c.drawImage(spr, -PFX, -PFY, PW, PH);
  else { c.fillStyle = '#c8402a'; c.fillRect(-5, -24, 10, 24); }
  c.restore();
  // «позорный горшок» проигравшему прошлый матч
  if (A.pot === F.i && !dead) {
    const hx = px + face * 1, hy = py - 56;
    c.fillStyle = '#9a5a2a'; c.fillRect(hx - 10, hy - 3, 20, 12); c.fillStyle = '#b8743a'; c.fillRect(hx - 12, hy - 5, 24, 4);
    c.fillStyle = '#6a3a1a'; c.fillRect(hx - 10, hy + 7, 20, 2); c.fillStyle = '#e8d0a0'; c.fillRect(hx - 5, hy, 3, 3);
  }
  // звёздочки над оглушённым, лёд, путы
  if (st.stun > now && typeof abDrawStars === 'function') abDrawStars(c, px, py - 60, t);
  if (st.ice > now) { c.fillStyle = 'rgba(160,220,255,0.45)'; c.fillRect(px - 13, py - 52, 26, 52); c.strokeStyle = 'rgba(230,248,255,0.9)'; c.lineWidth = 1; c.strokeRect(px - 13.5, py - 52.5, 27, 53); }
  if (st.root > now) { c.strokeStyle = '#5a9a3a'; c.lineWidth = 2; for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(px - 8 + k * 8, py); c.quadraticCurveTo(px - 4 + k * 4, py - 10, px - 6 + k * 6, py - 14); c.stroke(); } }
  if (st.open > now) { const s = 13 + Math.sin(t * 9) * 2; c.strokeStyle = '#ffd040'; c.lineWidth = 1.5; c.beginPath(); c.arc(px, py - 27, s, 0, 7); c.stroke(); }
  if (F.st.block > now || F.buf.ult_warrior > now) { c.strokeStyle = 'rgba(140,190,255,0.7)'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(px, py - 24, 26, 32, 0, 0, 7); c.stroke(); }
  if (st.ward > now) { c.strokeStyle = 'rgba(255,240,160,0.8)'; c.lineWidth = 1; c.beginPath(); c.ellipse(px, py - 24, 21, 28, 0, 0, 7); c.stroke(); }
}

// значки статусов словами над головой (читаемость важнее экономии места, 14.4)
const AR_ST_WORD = [['stun', 'Оглушён', '#ffe070'], ['ice', 'Во льду', '#9ee0ff'], ['root', 'В путах', '#8ae070'], ['sil', 'Молчит', '#d8a0ff'], ['slow', 'Замедлен', '#9ec8ff'],
  ['blind', 'Ослеплён', '#fff2a0'], ['open', 'Открыт!', '#ffd040'], ['burn', 'Горит', '#ff9a40'], ['bleed', 'Кровь', '#ff6a5a']];
function arStWords(S, F) {
  const out = [];
  for (const [k, w, col] of AR_ST_WORD) if (F.st[k] > S.T) out.push([t(w) + ' ' + (F.st[k] - S.T).toFixed(1), col]);
  return out;
}
