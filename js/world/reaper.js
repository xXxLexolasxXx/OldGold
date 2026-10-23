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
const REAPER_HORNS = 3;       // три формы рогов: завитые бараньи, высокие бычьи с зазубринами, корона из шипов

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
      mode: 'drift', modeT: 0, tx: x, ty: y, retarget: 0, scan: 1 + Math.random(), sweepCD: 0, var: Math.floor(Math.random() * REAPER_HORNS) });
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
// fingers — набор пальцев [разворот, длина]; по умолчанию пять (жнец), у призрака GHOST_FINGERS: четыре, расставлены шире
function paintGhostPaw(c, hx, hy, ang, len0, boo, pk = 1, fingers = null) {
  // Костлявая бестелесная лапа: малая ладонь с сухожилиями, пальцы из двух фаланг с суставами, на концах — когти-серпы
  c.save(); c.translate(hx, hy); c.rotate(ang); c.scale(pk, pk);
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.fillStyle = 'rgba(185,238,228,0.2)'; c.strokeStyle = 'rgba(235,255,250,0.8)'; c.lineWidth = 0.6;
  c.beginPath(); c.ellipse(0.9, 0, 2.3, 1.9, 0, 0, 7); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(235,255,250,0.35)'; c.lineWidth = 0.4;                                    // сухожилия на тыле кисти
  for (let t = -1; t <= 1; t++) { c.beginPath(); c.moveTo(-1.3, t * 0.5); c.lineTo(2.3, t * 0.95); c.stroke(); }
  fingers = fingers || [[-1.5, 0.85], [-0.5, 1], [0.5, 1], [1.5, 0.9], [-2.7, 0.55]];                     // [разворот, длина]; последний — большой палец
  for (const [j, fl] of fingers) {
    const thumb = j < -2;
    const a0 = (thumb ? -1.2 : j * 0.66) + (boo ? j * 0.14 : 0), curl = (boo ? 0.62 : 0.46);
    const x0 = 2.4, y0 = thumb ? -1.5 : j * 1.25;
    const l1 = 2.5 * fl, l2 = 2.2 * fl;
    const x1 = x0 + Math.cos(a0) * l1, y1 = y0 + Math.sin(a0) * l1, a1 = a0 + curl * 0.55;
    const x2 = x1 + Math.cos(a1) * l2, y2 = y1 + Math.sin(a1) * l2, a2 = a1 + curl;
    // плоть-дымка и кость пальца
    c.strokeStyle = 'rgba(160,235,215,0.16)'; c.lineWidth = 1.7;
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    c.strokeStyle = 'rgba(232,255,248,0.9)'; c.lineWidth = 0.65;
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    // суставы: узелки на сгибах
    c.fillStyle = 'rgba(30,70,70,0.7)'; c.strokeStyle = 'rgba(240,255,250,0.95)'; c.lineWidth = 0.4;
    for (const [jx, jy, jr] of [[x0, y0, 0.62], [x1, y1, 0.55], [x2, y2, 0.45]]) { c.beginPath(); c.arc(jx, jy, jr, 0, 7); c.fill(); c.stroke(); }
    // коготь-серп: сильно изогнутый полумесяц, сужающийся в иглу, с бликом по выпуклой кромке
    const cl = len0 * (thumb ? 0.5 : 0.62) * (0.8 + fl * 0.2), sweep = 2.0 + (boo ? 0.25 : 0), r = cl / sweep, th0 = a2 - Math.PI / 2;
    const cx = x2 - r * Math.cos(th0), cy = y2 - r * Math.sin(th0), M = 9;
    c.fillStyle = 'rgba(247,255,252,0.97)'; c.beginPath();
    for (let m = 0; m <= M; m++) { const t = m / M, th = th0 + t * sweep, rr = r + 0.62 * Math.pow(1 - t, 0.7); c[m ? 'lineTo' : 'moveTo'](cx + Math.cos(th) * rr, cy + Math.sin(th) * rr); }
    for (let m = M; m >= 0; m--) { const t = m / M, th = th0 + t * sweep, rr = r - 0.62 * Math.pow(1 - t, 0.7); c.lineTo(cx + Math.cos(th) * rr, cy + Math.sin(th) * rr); }
    c.closePath(); c.fill();
    c.strokeStyle = 'rgba(40,90,95,0.55)'; c.lineWidth = 0.3; c.beginPath();
    for (let m = 1; m <= M - 1; m++) { const t = m / M, th = th0 + t * sweep; c[m > 1 ? 'lineTo' : 'moveTo'](cx + Math.cos(th) * (r - 0.15), cy + Math.sin(th) * (r - 0.15)); }
    c.stroke();
  }
  c.restore();
}


// Кисть призрака 1 ур.: четыре растопыренных пальца (узкие основания, разведённые кончики), одинаковый изгиб и когти
function paintGhostHand(c, hx, hy, ang, len0, boo, pk = 1) {
  // Костлявая бестелесная лапа: малая ладонь с сухожилиями, пальцы из двух фаланг с суставами, на концах — когти-серпы
  c.save(); c.translate(hx, hy); c.rotate(ang); c.scale(pk, pk);
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.fillStyle = 'rgba(185,238,228,0.2)'; c.strokeStyle = 'rgba(235,255,250,0.8)'; c.lineWidth = 0.6;
  c.beginPath(); c.ellipse(0.9, 0, 2.3, 1.9, 0, 0, 7); c.fill(); c.stroke();
  // четыре растопыренных пальца: основания сближены, кончики разведены равномерно; изгиб и когти у всех одинаковые
  const curl = boo ? 0.5 : 0.38;
  for (const [j, fl] of [[-1.5, 0.9], [-0.5, 1], [0.5, 1], [1.5, 0.9]]) {                           // [номер от оси, длина]
    const x0 = 2.4, y0 = j * 0.8, l1 = 2.6 * fl, l2 = 2.3 * fl, a0 = j * 0.3;
    const x1 = x0 + Math.cos(a0) * l1, y1 = y0 + Math.sin(a0) * l1, a1 = a0 + curl * 0.5;
    const x2 = x1 + Math.cos(a1) * l2, y2 = y1 + Math.sin(a1) * l2, a2 = a1 + curl * 0.5;
    c.strokeStyle = 'rgba(160,235,215,0.16)'; c.lineWidth = 1.7;
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    c.strokeStyle = 'rgba(232,255,248,0.9)'; c.lineWidth = 0.65;
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    // коготь-серп: полумесяц, сужающийся в иглу
    const cl = len0 * 0.36 * (0.8 + fl * 0.2), sweep = 1.3 + (boo ? 0.2 : 0), r = cl / sweep, th0 = a2 - Math.PI / 2;
    const cx = x2 - r * Math.cos(th0), cy = y2 - r * Math.sin(th0), M = 9;
    c.fillStyle = 'rgba(247,255,252,0.97)'; c.beginPath();
    for (let m = 0; m <= M; m++) { const t = m / M, th = th0 + t * sweep, rr = r + 0.62 * Math.pow(1 - t, 0.7); c[m ? 'lineTo' : 'moveTo'](cx + Math.cos(th) * rr, cy + Math.sin(th) * rr); }
    for (let m = M; m >= 0; m--) { const t = m / M, th = th0 + t * sweep, rr = r - 0.62 * Math.pow(1 - t, 0.7); c.lineTo(cx + Math.cos(th) * rr, cy + Math.sin(th) * rr); }
    c.closePath(); c.fill();
  }
  c.restore();
}

// Демонический рог: изогнутый конус с рёбрами, чёрно-багровый у основания, раскалённый к кончику.
// pts — три точки кривой [основание, изгиб, кончик], w — толщина у основания; s = ±1 — сторона
function reaperHorn(c, pts, w, s, boo) {
  const HS = 0.68, b0 = pts[0];                                    // рога невысокие: всё ужато к основанию
  pts = pts.map(q => [b0[0] + (q[0] - b0[0]) * HS, b0[1] + (q[1] - b0[1]) * HS]); w *= 0.9;
  const N = 28, P = [], W = [], K = pts.length - 1;
  const cr = (p0, p1, p2, p3, t) => [0, 1].map(i => 0.5 * (2 * p1[i] + (p2[i] - p0[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t * t + (3 * p1[i] - p0[i] - 3 * p2[i] + p3[i]) * t * t * t));
  for (let n = 0; n <= N; n++) {
    const t = n / N, u = 1 - t, f = Math.min(K - 1e-6, t * K), i = Math.floor(f);          // кривая Катмулла–Рома через точки: рог может виться как угодно
    P.push(cr(pts[Math.max(0, i - 1)], pts[i], pts[i + 1], pts[Math.min(K, i + 2)], f - i));
    W.push((w * Math.pow(u, 0.8) + 0.15) * (1 + 0.34 * Math.sin(n * 1.3 + w) * (n > 1 && n < N - 1 ? 1 : 0)) + (n % 5 === 3 ? 0.45 * u : 0));   // бугры и наросты вдоль рога
  }
  const edge = (side) => P.map((q, n) => {
    const a = P[Math.max(0, n - 1)], b = P[Math.min(N, n + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
    return [q[0] - dy / d * W[n] * side, q[1] + dx / d * W[n] * side];
  });
  const L = edge(1), R = edge(-1);
  const gr = c.createLinearGradient(pts[0][0], pts[0][1], pts[2][0], pts[2][1]);
  gr.addColorStop(0, '#120808'); gr.addColorStop(0.55, '#4a1a12'); gr.addColorStop(0.9, boo ? '#ff5a2a' : '#d9733a'); gr.addColorStop(1, '#ffd9a0');
  c.fillStyle = gr; c.beginPath(); c.moveTo(L[0][0], L[0][1]);
  for (const q of L) c.lineTo(q[0], q[1]);
  for (let n = N; n >= 0; n--) c.lineTo(R[n][0], R[n][1]);
  c.closePath(); c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 0.5;                                          // поперечные рёбра
  for (let n = 2; n < N - 2; n += 2) { c.beginPath(); c.moveTo(L[n][0], L[n][1]); c.lineTo(R[n][0], R[n][1]); c.stroke(); }
  c.strokeStyle = 'rgba(255,170,110,0.55)'; c.lineWidth = 0.45; c.beginPath();                    // блик по выпуклой стороне
  for (let n = 1; n < N; n++) c[n > 1 ? 'lineTo' : 'moveTo'](L[n][0], L[n][1]);
  c.stroke();
  const g = c.createRadialGradient(P[N][0], P[N][1], 0, P[N][0], P[N][1], 3); g.addColorStop(0, boo ? 'rgba(255,90,50,0.7)' : 'rgba(255,170,90,0.55)'); g.addColorStop(1, 'rgba(255,120,60,0)');
  c.fillStyle = g; c.beginPath(); c.arc(P[N][0], P[N][1], 3, 0, 7); c.fill();
}

function reaperHorns(c, v, sn, boo) {
  const sw = sn(1, 0.7) * 0.5;
  for (const s of [-1, 1]) {
    const H = pts => reaperHorn(c, pts.map(([x, y]) => [s * x, y]), pts.w || 2.3, s, boo);
    if (v === 1) {            // один рог, извивающийся вверх змейкой
      const q = [[7, -13], [12.5, -17.5], [6.5, -22], [12, -27], [7, -32 + sw], [10, -36]]; q.w = 2.2; H(q);
    } else if (v === 2) {     // один рог: уходит вбок и закручивается над головой внутрь, как баранья спираль вверх
      const q = [[7, -13], [13, -16], [17, -23], [14, -30], [8, -31], [6, -26], [9, -24 + sw]]; q.w = 2.3; H(q);
    } else {                  // завитые бараньи: широкая дуга назад-вниз и тугой закрут к щеке
      const q = [[8, -13], [16, -19 + sw], [22, -14], [21, -6], [15, -2], [11, -5], [12.5, -8]]; q.w = 2.6; H(q);
    }
  }
}

function reaperSprite(mood, i, v = 0) {
  const key = mood + i + 'v' + v;
  let cv = REAPER_CACHE[key];
  if (cv) return cv;
  cv = document.createElement('canvas');
  const W = Math.round(GHOST_W * REAPER_SC), H = Math.round(GHOST_H * REAPER_SC), S = ghFineSS();
  cv.width = W * S; cv.height = H * S;
  const c = cv.getContext('2d');
  c.scale(S * REAPER_SC, S * REAPER_SC); c.translate(GHOST_OX, GHOST_OY);
  const atk = mood === 'atk';
  paintReaper(c, atk ? 0 : i / REAPER_FRAMES, mood, atk ? i / (REAPER_ATK_FRAMES - 1) : 0, v);
  return (REAPER_CACHE[key] = ghFinePx(cv));
}

function paintReaper(c, p, mood, k, v = 0) {
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
  // голова: чёрный рогатый шлем с наличниками; рога демонические, трёх форм (v)
  c.save(); c.translate(lean * 0.7, atk ? 1.5 * strike - wind : 0);
  reaperHorns(c, v, sn, boo);
  c.save(); c.translate(0.5, 3); c.scale(0.82, 0.82); c.translate(-0.5, -3);      // шлем поменьше, рога прежнего размера
  const steel = c.createLinearGradient(0, -19, 0, 9); steel.addColorStop(0, '#4a5a64'); steel.addColorStop(0.45, '#1c262c'); steel.addColorStop(1, '#070b0e');
  c.fillStyle = steel; c.beginPath(); c.moveTo(-10.4, 5);
  c.quadraticCurveTo(-12.4, -8, -6.4, -15.4); c.quadraticCurveTo(0.5, -20, 7.4, -15.4); c.quadraticCurveTo(13, -8, 11.4, 5);
  c.lineTo(8.4, 9.2); c.lineTo(5.4, 4.8); c.lineTo(0.5, 7.4); c.lineTo(-4.4, 4.8); c.lineTo(-7.4, 9.2); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.75)'; c.lineWidth = 0.9;                                          // гребень и бровной обод
  c.beginPath(); c.moveTo(0.5, -19.6); c.lineTo(0.5, -11); c.stroke();
  c.strokeStyle = 'rgba(170,205,220,0.6)'; c.lineWidth = 0.8;                                      // блик по кромке
  c.beginPath(); c.moveTo(-10.4, 4); c.quadraticCurveTo(-12.4, -8, -6.4, -15.4); c.quadraticCurveTo(0.5, -20, 7.4, -15.4); c.stroke();
  c.fillStyle = 'rgba(200,225,235,0.8)'; for (const sx of [-8.6, 9.6]) { c.beginPath(); c.arc(sx, -6, 0.55, 0, 7); c.fill(); }   // заклёпки
  // чёрный провал лица
  // вырез шлема: широкая прорезь с нахмуренной бровью — глаза открыты, видна пустота и кость
  c.fillStyle = '#000'; c.beginPath(); c.moveTo(-8.4, -9.8); c.lineTo(-1.4, -6.2); c.lineTo(0.5, -7.4); c.lineTo(2.4, -6.2); c.lineTo(9.4, -9.8);
  c.lineTo(8.6, -1); c.lineTo(6, 5.8); c.lineTo(0.5, 8); c.lineTo(-5, 5.8); c.lineTo(-7.6, -1); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(170,205,220,0.5)'; c.lineWidth = 0.6; c.stroke();                         // обод выреза
  // череп в глубине шлема: тусклая кость, провалы глазниц, ряд зубов
  c.fillStyle = 'rgba(205,222,214,0.30)'; c.beginPath(); c.ellipse(0.5, -2.6, 4.6, 5.6, 0, 0, 7); c.fill();
  c.fillStyle = 'rgba(205,222,214,0.22)'; c.fillRect(-2.6, 3.2, 6.2, 2.6);
  c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 0.5; for (let q = -2; q <= 3; q++) { c.beginPath(); c.moveTo(q + 0.5, 3.2); c.lineTo(q + 0.5, 5.8); c.stroke(); }
  c.fillStyle = 'rgba(0,0,0,0.85)'; c.beginPath(); c.moveTo(0.5, -0.4); c.lineTo(-0.3, 1.8); c.lineTo(1.3, 1.8); c.closePath(); c.fill();
  const eyeCol = boo ? '#ff3a1c' : '#6fe0b4', gz = sn(1, 0.4) * 0.6;
  for (const e of [-1, 1]) {
    const ex = e * 3.6 + gz + 0.5, ey = -3.2;
    g = c.createRadialGradient(ex, ey, 0, ex, ey, 7); g.addColorStop(0, eyeCol); g.addColorStop(0.3, boo ? 'rgba(255,60,30,0.5)' : 'rgba(150,255,200,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(ex, ey, 7, 0, 7); c.fill();
    c.fillStyle = eyeCol; c.beginPath(); c.moveTo(ex - 2.6 * e, ey - 0.4); c.lineTo(ex + 2.8 * e, ey - 2.2); c.lineTo(ex + 1.8 * e, ey + 1.6); c.closePath(); c.fill();      // злой раскос
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(ex + 0.2 * e, ey - 0.3, 1.1, 0.7, e * -0.35, 0, 7); c.fill();
  }
  if (atk) { c.fillStyle = 'rgba(255,90,60,0.7)'; c.beginPath(); c.ellipse(0.5, 4.4, 2.6, 0.7 + 2.2 * Math.max(wind * 0.5, strike), 0, 0, 7); c.fill(); }
  c.restore();
  c.restore();
}
