'use strict';
// Призрак-жнец — нежить 2-го уровня. Живёт в Game.ghosts (kind: 'reaper'), поэтому ходит теми же списками:
// сейв, кооп-зеркало, прорисовка поверх всего. От обычного призрака отличается:
//  · хлебом не задобрить и молитвой героя не изгнать;
//  · появляется не сразу: с 3-й ночи, к глубокой ночи, на окраине (а не из кладбища), поодиночке — больше потерь, больше жнецов;
//  · аура ужаса (гномы в 7 клетках бросают дела и бегут), гасит фонари (гном без света теряется в тумане),
//    а если герой подойдёт близко — косит его косой (в 2–3 раза больнее призрака).
// Рисунок: 9 кадров парения и 8 кадров взмаха косой, в той же манере, что и призрак (ghosts.js).

const REAPER_AURA = 7, REAPER_LANTERN = 4.5, REAPER_REACH = 3.2;
const REAPER_FRAMES = 9, REAPER_ATK_FRAMES = 8, REAPER_SC = 1.35;     // во столько раз крупнее призрака
const REAPER_CACHE = {};

function reapersWanted() {
  if (nightIndex() < 2) return 0;
  const lost = Game.lostGnomes || 0;
  if (lost < 3) return 0;
  return Math.min(3, 1 + Math.floor(lost / 10));
}

// вызывается на закате вместе с ghostsSpawn; жнец невидим, пока не наступит глубокая ночь
function reapersSpawn() {
  const gs = Game.ghosts || (Game.ghosts = []);
  let have = gs.filter(g => g.kind === 'reaper').length;
  const want = reapersWanted();
  if (want && have === 0 && want === 1 && Math.random() < 0.35) return;      // поначалу не каждую ночь
  let cx = 0, cy = 0, n = 0;
  for (const b of Game.buildings) if (b.type !== 'graveyard') { cx += b.x + b.w / 2; cy += b.y + b.h / 2; n++; }
  if (!n) return;
  cx /= n; cy /= n;
  while (have < want) {
    let x = MAP_W / 2, y = MAP_H / 2;
    for (let t = 0; t < 40; t++) {
      const a = Math.random() * Math.PI * 2, r = 22 + Math.random() * 8;
      x = Math.max(3, Math.min(MAP_W - 3, cx + Math.cos(a) * r)); y = Math.max(3, Math.min(MAP_H - 3, cy + Math.sin(a) * r * 0.8));
      if (Math.hypot(x - cx, y - cy) > 16) break;
    }
    gs.push({ kind: 'reaper', x, y, hx: x, hy: y, alpha: 0, ph: Math.random() * 9, face: 1, rev: false, appear: 0.95, fromGy: true,
      mode: 'drift', modeT: 0, tx: x, ty: y, retarget: 0, scan: 1 + Math.random(), sweepCD: 0 });
    have++;
  }
  logEvent('night', 'Из тумана на окраине потянуло могильным холодом: вышел жнец');
}

function reaperTick(g, dt) {
  if (g.atkT > 0) { ghostStrikeTick(g, dt); return; }
  // дрейф: бродит по окраине, а завидев одинокого гнома, медленно плывёт к нему
  if (g.retarget <= 0 || Math.hypot(g.tx - g.x, g.ty - g.y) < 0.7) {
    g.tx = Math.max(2, Math.min(MAP_W - 2, g.hx + (Math.random() - 0.5) * 20)); g.ty = Math.max(2, Math.min(MAP_H - 2, g.hy + (Math.random() - 0.5) * 16));
    g.retarget = 5 + Math.random() * 6;
    if (Math.random() < 0.45) { let best = null, bd = 16; for (const u of Game.units) if (!u.inside && !u.dead && isPerson(u) && u.type !== 'carter') { const d = Math.hypot(u.x - g.x, u.y - g.y); if (d < bd) { bd = d; best = u; } } if (best) { g.tx = best.x; g.ty = best.y; g.hx += (best.x - g.hx) * 0.2; g.hy += (best.y - g.hy) * 0.2; } }
  }
  const dx = g.tx - g.x, dy = g.ty - g.y, d = Math.hypot(dx, dy) || 1;
  g.x += dx / d * 0.65 * dt; g.y += dy / d * 0.65 * dt; g.face = dx >= 0 ? 1 : -1;
  if (g.alpha < 0.4 || g.mode === 'leave') return;
  g.scan -= dt;
  if (g.scan > 0) return;
  g.scan = 1;
  const H = Game.hero;
  if (H && !H.dead && H.hero && !H.inside && (g.sweepCD || 0) < Game.time && Math.hypot(H.x - g.x, H.y - g.y) < REAPER_REACH) {
    g.sweepCD = Game.time + 6; ghostStrike(g, H); return;
  }
  for (const u of Game.units) {
    if (u.inside || u.dead || !isPerson(u) || u.hero || u.type === 'carter') continue;
    const d2 = Math.hypot(u.x - g.x, u.y - g.y);
    if (d2 > REAPER_AURA) continue;
    if (d2 < REAPER_LANTERN && u.lantern && !u.brk && Math.random() < 0.25) { lanternFall(u); floater(u.x, u.y - 1.4, 'Свет гаснет…', '#bfe0ff'); continue; }
    if ((u.ghostCD || 0) > Game.time || !interruptible(u)) continue;
    u.ghostCD = Game.time + 45;
    floater(u.x, u.y - 1.2, 'Жнец!', '#c8d8ff');
    startBreak(u, 'flee', null); u.proc = fleeGen(u);
    if (g.mode === 'drift') { g.mode = 'boo'; g.modeT = 2; sfxAt('wail', g.x * TILE, g.y * TILE, 1.2); }
  }
}

// ---------- Рисунок ----------

// Зловещий капюшон-колпак: высокий, с загнутым кончиком, рваным краем над бровями и костяными шипами. Рисуется поверх черепа.
function paintGhostHood(c, tip, sn) {
  const g0 = c.createRadialGradient(0, -3, 1, 0, -3, 7); g0.addColorStop(0, 'rgba(0,10,12,0.7)'); g0.addColorStop(1, 'rgba(0,10,12,0)');
  c.fillStyle = g0; c.beginPath(); c.ellipse(0, -3, 7, 4.5, 0, 0, 7); c.fill();
  // костяные рога у основания
  c.fillStyle = '#dbe9e1';
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 6.6, -7); c.quadraticCurveTo(s * 11.5, -9 + sn(1, s) * 0.6, s * 12.6, -17.5); c.quadraticCurveTo(s * 9.2, -11.5, s * 4.8, -9.4); c.closePath(); c.fill(); }
  const hood = c.createLinearGradient(0, -30, 0, 2); hood.addColorStop(0, '#324d52'); hood.addColorStop(0.5, '#142428'); hood.addColorStop(1, '#0a1618');
  c.fillStyle = hood; c.beginPath(); c.moveTo(-8.6, 1);
  c.quadraticCurveTo(-10.4, -10, -4.6, -18); c.quadraticCurveTo(-0.5 + tip * 0.3, -24, 4 + tip * 0.6, -30);
  c.quadraticCurveTo(11 + tip, -30.5, 10 + tip, -23); c.quadraticCurveTo(8 + tip * 0.6, -25, 5.6, -21);
  c.quadraticCurveTo(10.4, -11, 8.6, 1);
  const hem = [[6.6, -3.2], [4.8, -0.6], [2.6, -4.8], [0, -1.8], [-2.6, -4.8], [-4.8, -0.6], [-6.6, -3.2]];
  for (const [x, y] of hem) c.lineTo(x, y);
  c.closePath(); c.fill();
  // рваная дыра и отблеск по кромке
  c.fillStyle = 'rgba(0,0,0,0.9)'; c.beginPath(); c.ellipse(-3.2, -15, 1.1, 2.1, 0.4, 0, 7); c.fill();
  c.strokeStyle = 'rgba(170,235,225,0.55)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(-8.6, -2); c.quadraticCurveTo(-10.4, -10, -4.6, -18); c.quadraticCurveTo(-0.5 + tip * 0.3, -24, 4 + tip * 0.6, -30); c.stroke();
}

// Бестелесная лапа с большими когтями (как у призрака, но крупнее)
function paintGhostPaw(c, hx, hy, ang, len0, boo) {
  c.save(); c.translate(hx, hy); c.rotate(ang);
  c.fillStyle = 'rgba(190,240,230,0.2)'; c.strokeStyle = 'rgba(235,255,250,0.85)'; c.lineWidth = 0.7;
  c.beginPath(); c.ellipse(1.1, 0, 2.4, 1.9, 0, 0, 7); c.fill(); c.stroke();
  for (let j = -1.5; j <= 1.5; j++) {
    const a2 = j * 0.36 + (boo ? j * 0.12 : 0), len = len0 - Math.abs(j) * 1.1, bx = 2.6, by = j * 1.0, tx = bx + Math.cos(a2) * len, ty = by + Math.sin(a2) * len + 1.3;
    c.fillStyle = 'rgba(244,255,251,0.95)';
    c.beginPath(); c.moveTo(bx, by - 0.5); c.quadraticCurveTo((bx + tx) / 2, (by + ty) / 2 - 0.9, tx, ty); c.quadraticCurveTo((bx + tx) / 2 - 0.2, (by + ty) / 2 + 0.6, bx, by + 0.5); c.closePath(); c.fill();
  }
  c.restore();
}

function reaperSprite(mood, i) {
  const key = mood + i;
  let cv = REAPER_CACHE[key];
  if (cv) return cv;
  cv = REAPER_CACHE[key] = document.createElement('canvas');
  const W = Math.round(GHOST_W * REAPER_SC), H = Math.round(GHOST_H * REAPER_SC);
  cv.width = W * GHOST_SS; cv.height = H * GHOST_SS;
  const c = cv.getContext('2d');
  c.scale(GHOST_SS * REAPER_SC, GHOST_SS * REAPER_SC); c.translate(GHOST_OX, GHOST_OY);
  const atk = mood === 'atk';
  paintReaper(c, atk ? 0 : i / REAPER_FRAMES, mood, atk ? i / (REAPER_ATK_FRAMES - 1) : 0);
  return cv;
}

function paintReaper(c, p, mood, k) {
  const atk = mood === 'atk', boo = mood === 'boo' || atk;
  const TAU = Math.PI * 2, sn = (m, o = 0) => Math.sin(p * TAU * m + o);
  const sm = x => x * x * (3 - 2 * x);
  const wind = atk ? sm(Math.min(1, k / 0.35)) : 0, strike = atk ? sm(Math.max(0, Math.min(1, (k - 0.35) / 0.25))) : 0, recoil = atk ? sm(Math.max(0, (k - 0.6) / 0.4)) : 0;
  const lean = atk ? (-3 * wind + 8 * strike) * (1 - recoil) : 0;
  c.lineJoin = 'round'; c.lineCap = 'round';
  // длинная чёрная ряса-хвост, тающая зерном
  const tailLen = 46, N = 22, L = [], R = [];
  for (let n = 0; n <= N; n++) {
    const t = n / N, y = -3 + t * tailLen;
    const hw = 11.5 * Math.pow(1 - t, 0.7) + 0.6 + (t > 0.3 ? Math.sin(t * 37 + (n % 3) * 1.9 + p * TAU) * 1.5 * t : 0);
    const cx = lean * (1 - t) * 0.9 + sn(1, -t * 5) * (1.4 + t * 8);
    L.push([cx - hw, y]); R.push([cx + hw, y]);
  }
  const body = () => { c.beginPath(); c.moveTo(L[0][0], L[0][1]); for (const q of L) c.lineTo(q[0], q[1]); for (let n = R.length - 1; n >= 0; n--) c.lineTo(R[n][0], R[n][1]); c.closePath(); };
  let g = c.createLinearGradient(0, -8, 0, 42);
  g.addColorStop(0, 'rgba(20,34,42,0.97)'); g.addColorStop(0.45, 'rgba(34,62,76,0.82)'); g.addColorStop(0.8, 'rgba(50,90,110,0.38)'); g.addColorStop(1, 'rgba(60,110,130,0)');
  c.fillStyle = g; body(); c.fill();
  c.save(); body(); c.clip();
  // холодный свет по краям рясы, чтобы чёрное не терялось в ночи
  c.strokeStyle = 'rgba(150,225,235,0.5)'; c.lineWidth = 1.2; body(); c.stroke();
  let sd = (Math.floor(p * REAPER_FRAMES) * 197 + Math.floor(k * 7) * 29 + 11) % 2147483647;
  const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  c.globalCompositeOperation = 'destination-out';
  for (let n = 0; n < 480; n++) {
    const t = 0.22 + rnd() * 0.78, i = Math.min(N, Math.floor(t * N)), y = -3 + t * tailLen;
    if (rnd() > Math.pow(t, 1.4) * 1.05) continue;
    const x = L[i][0] + rnd() * (R[i][0] - L[i][0]) * 1.3 - 1, z = 0.5 + rnd() * 1.4;
    c.fillStyle = `rgba(0,0,0,${0.55 + rnd() * 0.45})`; c.fillRect(x, y, z, z);
  }
  c.globalCompositeOperation = 'source-over';
  c.restore();
  for (let n = 0; n < 24; n++) {
    const t = 0.35 + rnd() * 0.75, i = Math.min(N, Math.floor(t * N)), y = -3 + t * tailLen + rnd() * 4;
    const x = L[i][0] + (rnd() * 1.6 - 0.3) * (R[i][0] - L[i][0]) + sn(1, n) * 1.5, z = 0.5 + rnd() * 1;
    c.fillStyle = `rgba(150,${200 + rnd() * 40 | 0},225,${(0.5 - (t - 0.35) * 0.35) * (0.4 + rnd() * 0.6)})`; c.fillRect(x, y, z, z);
  }
  // коса Смерти: длинное чёрное древко с набалдашником, на верхушке — оковка и длинное тонкое лезвие-серп, загнутое вниз; кромка с внутренней стороны
  const gx = 6 + lean * 0.5, gy = 2 + sn(1, 1) * 0.8;
  const th = atk ? (-1.15 * wind + (1.15 + 1.2) * strike) * (1 - recoil) + 0.2 * recoil : 0.12 + sn(1, 0.5) * 0.05;
  c.save(); c.translate(gx, gy); c.rotate(th);
  c.strokeStyle = '#050607'; c.lineWidth = 2.8; c.beginPath(); c.moveTo(0, 25); c.lineTo(0, -27); c.stroke();
  c.strokeStyle = '#8a7a66'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, 25); c.quadraticCurveTo(-0.6, 0, 0, -27); c.stroke();
  c.fillStyle = '#1b1b1d'; c.beginPath(); c.arc(0, 25.5, 1.6, 0, 7); c.fill();                     // набалдашник
  c.fillStyle = '#23262a'; c.fillRect(-1.9, -28.5, 3.8, 3.4);                                           // оковка
  // лезвие: узкий серп, спинка тёмная, режущая кромка светлая
  c.fillStyle = '#141a1e'; c.beginPath(); c.moveTo(-1, -27.5); c.quadraticCurveTo(13, -36.5, 23.5, -20.5); c.lineTo(24.4, -14.5); c.quadraticCurveTo(21.8, -22, 14, -26.5); c.quadraticCurveTo(7, -29, 1.5, -25.5); c.closePath(); c.fill();
  const bl = c.createLinearGradient(2, -26, 24, -15); bl.addColorStop(0, '#9fb6c0'); bl.addColorStop(0.6, '#e6f4fa'); bl.addColorStop(1, '#ffffff');
  c.strokeStyle = bl; c.lineWidth = 1; c.beginPath(); c.moveTo(1.5, -25.6); c.quadraticCurveTo(7, -29, 14, -26.5); c.quadraticCurveTo(21.8, -22, 24.4, -14.5); c.stroke();
  c.fillStyle = 'rgba(190,230,245,0.35)'; c.beginPath(); c.moveTo(14, -26.5); c.quadraticCurveTo(21.8, -22, 24.4, -14.5); c.lineTo(23, -19); c.closePath(); c.fill();
  c.restore();
  // руки: тонкие контуры из дымки, одна на косе, вторая тянется следом
  const hands = [[gx, gy], [gx - 7 - (atk ? 2 * strike : 0), gy + 10 + sn(1, 2) * 1.2]];
  hands.forEach(([hx, hy], idx) => {
    const sx = (idx ? -6 : 6) + lean * 0.5, sy = 0, mx = (sx + hx) / 2, my = (sy + hy) / 2 + 4;
    const ag = c.createLinearGradient(sx, sy, hx, hy); ag.addColorStop(0, 'rgba(120,180,200,0.45)'); ag.addColorStop(0.5, 'rgba(120,190,205,0.08)'); ag.addColorStop(1, 'rgba(225,255,248,0.6)');
    c.strokeStyle = ag; c.lineWidth = 0.7;
    for (const o of [-1.2, 1.2]) { c.beginPath(); c.moveTo(sx, sy + o); c.quadraticCurveTo(mx, my + o * 1.4, hx, hy + o * 0.5); c.stroke(); }
    paintGhostPaw(c, hx, hy, Math.atan2(hy - my, hx - mx) + (idx ? 0.2 : 0.5), 10.5 + (atk ? strike * 2.6 : 0), boo);
  });
  // голова: капюшон Смерти — просторный, ниспадающий складками, без рогов; в глубине тени проглядывает череп
  c.save(); c.translate(lean * 0.7, atk ? 1.5 * strike - wind : 0);
  const tip = sn(1, 0.6) * 1.2 + lean * 0.3;
  const hood = c.createLinearGradient(0, -27, 0, 6); hood.addColorStop(0, '#1b2a2e'); hood.addColorStop(0.5, '#0a1114'); hood.addColorStop(1, '#030607');
  c.fillStyle = hood; c.beginPath(); c.moveTo(-11, 6);
  c.quadraticCurveTo(-14.5, -6, -8, -19); c.quadraticCurveTo(-2, -28, 5 + tip, -23.5); c.quadraticCurveTo(7.5 + tip, -21, 7 + tip * 0.6, -18);
  c.quadraticCurveTo(14, -10, 11.5, 6); c.quadraticCurveTo(0, 10, -11, 6); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 0.9;
  for (const [x0, x1] of [[-9.5, -11.8], [9, 12]]) { c.beginPath(); c.moveTo(x0, -10); c.quadraticCurveTo(x0 + (x1 - x0) * 0.4, -2, x1, 5); c.stroke(); }     // складки
  c.strokeStyle = 'rgba(150,215,225,0.5)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-11, 5); c.quadraticCurveTo(-14.5, -6, -8, -19); c.quadraticCurveTo(-2, -28, 5 + tip, -23.5); c.stroke();
  // чёрный провал лица
  c.fillStyle = '#000'; c.beginPath(); c.ellipse(0.5, -2.4, 6.6, 8.8, 0, 0, 7); c.fill();
  // череп в глубине капюшона: тусклая кость, провалы глазниц, ряд зубов
  c.fillStyle = 'rgba(205,222,214,0.30)'; c.beginPath(); c.ellipse(0.5, -2.6, 4.6, 5.6, 0, 0, 7); c.fill();
  c.fillStyle = 'rgba(205,222,214,0.22)'; c.fillRect(-2.6, 3.2, 6.2, 2.6);
  c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 0.5; for (let q = -2; q <= 3; q++) { c.beginPath(); c.moveTo(q + 0.5, 3.2); c.lineTo(q + 0.5, 5.8); c.stroke(); }
  c.fillStyle = 'rgba(0,0,0,0.85)'; c.beginPath(); c.moveTo(0.5, -0.4); c.lineTo(-0.3, 1.8); c.lineTo(1.3, 1.8); c.closePath(); c.fill();
  const eyeCol = boo ? '#ff3a1c' : '#6fe0b4', gz = sn(1, 0.4) * 0.6;
  for (const e of [-1, 1]) {
    const ex = e * 3 + gz + 0.5, ey = -3.6;
    g = c.createRadialGradient(ex, ey, 0, ex, ey, 5.2); g.addColorStop(0, eyeCol); g.addColorStop(0.35, boo ? 'rgba(255,60,30,0.35)' : 'rgba(150,255,200,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(ex, ey, 5.2, 0, 7); c.fill();
    c.fillStyle = eyeCol; c.beginPath(); c.moveTo(ex - 1.8 * e, ey - 0.6); c.lineTo(ex + 2.0 * e, ey - 1.6); c.lineTo(ex + 1.2 * e, ey + 1.2); c.closePath(); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(ex, ey - 0.1, 0.5, 0, 7); c.fill();
  }
  if (atk) { c.fillStyle = 'rgba(255,90,60,0.7)'; c.beginPath(); c.ellipse(0.5, 4.4, 2.6, 0.7 + 2.2 * Math.max(wind * 0.5, strike), 0, 0, 7); c.fill(); }
  c.restore();
}
