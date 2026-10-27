'use strict';
// Курганный князь в пиксель-арте: король-скелет втрое выше обычного скелета, крупнее голема.
// Тот же конвейер, что у гномов и скелетов (skelart.js): рисование с сверхвыборкой → toPixelArt, кадры лениво в кэше.
// Фазы I–III меняют вид: I — выцветший, глаза почти погасли; II — трещины с холодным светом, глаза разгораются; III — «Ярость»: нагрудник
// расколот, синее пламя из груди, глаза белые, клинок светится. Логика босса (raid.js) не тронута: хитбокс, шкала, подписи те же,
// только выше. Кадры берутся из N.fr: по 12 — i, w, a (атака), r (рёв), d, v; по 6 — h (рана), p (парирование); и одиночные позы.

const KP = { PS: 6, PART: PX_FINE > 1 ? 3 : 2,      // PART — пикселей арта на игровой (мелкий пиксель — 3)
  W: 140, H: 128, AX: 68, AY: 120, MAX: 96, TOP: 112 };
const KP_C = {
  bone: '#e4ddd2', bone2: '#b6ada0', bone3: '#867e74', ink: '#1e1b19', flash: '#f6f2ea',
  iron: ['#9e958a', '#706960', '#4a4540'], rust: ['#c8946a', '#a06840', '#6e432a'], gold: ['#e4b434', '#a4701c', '#7e5214'],
  cape: [['#3a3a7a', '#2c2a5a', '#1c1a3e'], ['#33306a', '#26204a', '#161232'], ['#4e2850', '#3a1c3e', '#220e28']],
  eye: [['#3fa0e8', '#d6f4ff', 'rgba(90,190,255,0.45)'], ['#8ee05a', '#efffb8', 'rgba(150,230,90,0.45)'], ['#ff2a1c', '#ffd8a0', 'rgba(255,60,40,0.5)']], // I голубые, II мертвенно-зелёные, III красные
  glow: '#6ad0ff', blade: ['#f6fbff', '#a6d2e6', '#5292bc', '#22486c'],
};
const KP_CACHE = new Map();
let KP_SCRATCH = null;

function kpPhaseOf(N) { const F = typeof Game !== 'undefined' && Game.raid && Game.raid.f; return F && F.nid === N.id && F.ph ? Math.min(3, F.ph) : 1; }

function kpKey(kind, n) {
  const TAU = Math.PI * 2;
  const P = { lean: 0, bob: 0, sw: 0, cw: 0, mv: 0, hand: [17, -52], ang: -1.15, bhand: [-13, -50], jaw: 1, hdx: 0, hdy: 0, flare: 0, flash: 0, sink: 0, adv: 0, sway: 0, tilt: 0 };
  P.sway = Math.sin(n / KP_N * TAU);
  if (kind === 'i') { P.bob = Math.sin(n / KP_N * TAU) * 1.2; P.hdx = Math.sin(n / KP_N * TAU + 1) * 0.8; P.bhand = [-13 + P.sway * 1.2, -50 + P.sway]; P.ang = -1.15 + P.sway * 0.05; P.flare = n % 4 === 0 ? 0.4 : 0; }
  else if (kind === 'w') { const ph = n / KP_N * TAU; P.mv = 1; P.sw = Math.sin(ph); P.cw = Math.cos(ph); P.bob = -Math.abs(P.sw) * 1.6; P.sway = P.sw; P.ang = -1.05 + P.sw * 0.1; P.bhand = [-13 - P.sw * 4, -50 + Math.abs(P.sw)]; P.hand = [17 + P.sw * 2, -52]; }
  else if (kind === 'ready' || kind === 'step') { P.lean = 1.5; P.hand = [21, -50]; P.ang = -0.8; P.bhand = [-14, -52]; }
  else if (kind === 'windup') { P.lean = -3; P.hand = [6, -90]; P.ang = -2.45; P.bhand = [-18, -78]; P.hdx = -2; P.jaw = 3; }
  else if (kind === 'strike') { P.lean = 4.5; P.adv = 5; P.hand = [31, -48]; P.ang = 0.55; P.bhand = [-8, -56]; P.jaw = 3.5; P.hdy = 2; }
  else if (kind === 'recover') { P.lean = 2; P.adv = 2; P.hand = [24, -50]; P.ang = -0.45; P.bhand = [-12, -52]; P.jaw = 2; }
  else if (kind === 'roar') { P.lean = -2.5; P.hand = [23, -86]; P.ang = -1.9; P.bhand = [-22, -88]; P.jaw = 6; P.hdx = -2.5; P.hdy = -2; P.flare = 1; }
  else if (kind === 'hurt' || kind === 'stagger') { P.lean = -5; P.hand = [13, -46]; P.ang = -0.9; P.bhand = [-16, -58]; P.jaw = 4; P.hdx = -3; P.flash = 1; P.flare = 0.6; }
  else if (kind === 'd') { const k = n / (KP_N - 1); P.sink = k * 20; P.lean = -k * 7; P.hdy = k * 12; P.hdx = -k * 4; P.hand = [15 + k * 6, -52 + k * 16]; P.ang = -1.15 + k * 2.5; P.bhand = [-13 - k * 3, -50 + k * 14]; P.jaw = 2 + k * 3; P.tilt = k * 0.5; }
  else if (kind === 'v') { const w = Math.round(Math.sin(n / KP_N * 2 * TAU) * 30) / 10; P.hand = [21, -88 + w]; P.ang = -1.7 + w * 0.05; P.bhand = [-20, -86 - w]; P.jaw = 4; P.flare = 1; P.bob = w * 0.3; }
  return P;
}
// 12 кадров (КАДРЫ.md): покой, шаг, гибель, торжество — формулами; атака, рёв, рана, парирование — смешением ключевых поз
const KP_N = 12;
function kpMix(A, B, t) {
  const o = {};
  for (const k in A) o[k] = Array.isArray(A[k]) ? A[k].map((v, i) => v + (B[k][i] - v) * t) : A[k] + (B[k] - A[k]) * t;
  return o;
}
function kpParams(fr) {
  const kind = fr.replace(/\d+$/, ''), n = +fr.slice(kind.length) || 0, K = q => kpKey(q, 0), sm = x => x * x * (3 - 2 * x);
  if (kind === 'a') {          // как naPoseTable: стойка → замах 0,22 → удар 0,30 → возврат 0,44 → стойка 0,56
    const AK = [[0, 'ready'], [0.22, 'windup'], [0.3, 'strike'], [0.44, 'recover'], [0.56, 'ready']], u = (n + 0.5) / KP_N * 0.56;
    let i = 0; while (i < AK.length - 2 && u > AK[i + 1][0]) i++;
    return kpMix(K(AK[i][1]), K(AK[i + 1][1]), sm(Math.max(0, Math.min(1, (u - AK[i][0]) / (AK[i + 1][0] - AK[i][0])))));
  }
  if (kind === 'h' || kind === 'p') {   // рана и парирование — 6 кадров: рывок, пик, дрожь, просел, выпрямляется
    const c = [0.7, 1, 0.85, 0.6, 0.32, 0.1][Math.min(5, n)], P = kpMix(K('ready'), K('hurt'), kind === 'p' ? c * 0.45 : c);
    P.flash = kind === 'h' && c > 0.5 ? 1 : 0; P.hdx += n === 2 ? 1 : 0;
    return P;
  }
  if (kind === 'r') { const c = [0, 0.35, 0.7, 1, 1, 1, 1, 1, 0.8, 0.55, 0.3, 0.1][Math.min(11, n)], P = kpMix(K('ready'), K('roar'), c); P.jaw += n >= 4 && n <= 7 ? (n % 2) * 1.5 : 0; P.flare = c; return P; }
  return kpKey(kind, n);
}

function kpSprite(fr, ph) {
  const key = ph + '|' + fr;
  let e = KP_CACHE.get(key);
  if (e) { KP_CACHE.delete(key); KP_CACHE.set(key, e); KP._last = e; return e; }
  if (typeof spriteBudgetOk === 'function' && !spriteBudgetOk(!!KP._last)) return KP._last;
  const t0 = performance.now();
  if (!KP_SCRATCH) KP_SCRATCH = mkScratch(KP.W, KP.H, KP.PS);
  const [cv, c] = KP_SCRATCH;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
  c.setTransform(KP.PS, 0, 0, KP.PS, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  c.translate(KP.AX, KP.AY);
  const marks = kpPaint(c, fr, ph);
  const out = toPixelArt(cv, KP.PS / KP.PART, { outline: true, outlineDark: 0.36, alphaCut: 105 });
  out.fine = KP.PART;
  // огни в глазницах и камни короны — ровные светящиеся пиксели без квантования
  const o = out.getContext('2d'), P2 = KP.PART;
  for (const m of marks) {
    if (m.eye) { kpEye(o, Math.round((KP.AX + m.x) * P2), Math.round((KP.AY + m.y) * P2), m.side, m.col, m.big); continue; }
    const [x, y, col, w] = m; o.fillStyle = col; o.fillRect(Math.round((KP.AX + x) * P2), Math.round((KP.AY + y) * P2), w || 2, w || 2);
  }
  e = { cv: out };
  if (KP_CACHE.size >= KP.MAX) KP_CACHE.delete(KP_CACHE.keys().next().value);
  KP_CACHE.set(key, e);
  KP._last = e;
  if (typeof spriteSpent === 'function') spriteSpent(t0);
  return e;
}

// глаз пикселями арта: круглый горящий зрачок (злость даёт надбровье над ним), раскалённая сердцевина и тлеющий ореол
const KP_EYE = [['.###.', '#####', '#####', '#####', '.###.'], ['..###..', '.#####.', '#######', '#######', '#######', '.#####.', '..###..']];
function kpEye(o, cx, cy, side, col, big) {
  const rows = KP_EYE[big ? 1 : 0], w = rows[0].length, h = rows.length, x0 = cx - (w >> 1), y0 = cy - (h >> 1);
  const px = (x, y, c) => { o.fillStyle = c; o.fillRect(x0 + x, y0 + y, 1, 1); };
  for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) if ((rows[y] || '')[x] !== '#' && [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([ox, oy]) => (rows[y + oy] || '')[x + ox] === '#')) px(x, y, col[2]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (rows[y][x] === '#') px(x, y, col[0]);
  const m = w >> 1; px(m, h >> 1, col[1]); px(m - 1, h >> 1, col[1]); px(m, (h >> 1) - 1, col[1]); if (big) { px(m + 1, h >> 1, col[1]); px(m + 1, (h >> 1) - 1, col[1]); }
}

// c — контекст сверхвыборки, ноги в (0,0), вверх = минус, князь смотрит вправо. Возвращает [[x, y, цвет, размер]…] светящихся точек.
function kpPaint(c, fr, ph) {
  const C = KP_C, P = kpParams(fr), INK = C.ink, BONE = P.flash ? C.flash : C.bone, BONE2 = C.bone2, cape = C.cape[ph - 1];
  const marks = [], lean = P.lean, sk = P.sink;
  c.lineCap = 'round'; c.lineJoin = 'round';
  const bone = (x1, y1, x2, y2, w, col) => { c.strokeStyle = INK; c.lineWidth = w + 2; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.strokeStyle = col || BONE; c.lineWidth = w; c.stroke(); };
  const joint = (x, y, r) => { c.fillStyle = INK; c.beginPath(); c.arc(x, y, r + 1, 0, 7); c.fill(); c.fillStyle = BONE; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); };
  const poly = (pts, fill, line) => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); if (line) { c.strokeStyle = INK; c.lineWidth = line; c.stroke(); } c.fillStyle = fill; c.fill(); };
  c.translate(P.adv, 0);
  const hipY = -38 + sk * 0.9, shY = -68 + sk * 0.8 + P.bob;
  // ---- плащ: рваный, тянется назад, края шевелятся
  {
    const sx = -7 + lean * 0.4, sy = shY + 2, W0 = 17, H0 = -2;
    const sw = P.sway * 2.4 + P.mv * -P.sw * 3, tear = [0, 5, 2, 8, 3, 7, 1, 6, 4];
    const top = [[sx + 3, sy], [sx - W0 * 0.55, sy + 6]];
    const hem = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8, hx = sx - W0 * 0.55 - 8 - t * 14 + sw * (0.4 + t) + (i % 2 ? -2 : 0), hy = H0 - tear[i] + (1 - t) * 3 + (t > 0.5 ? 0 : 0); hem.push([hx, hy]); }
    const pts = [[sx + 4, sy], ...hem.map((p, i) => [p[0] + 14 + i * 0.6, p[1] + (i % 2 ? 0 : 0)]), [sx - W0 * 0.7 - 10 + sw * 0.2, sy + 24]];
    c.beginPath(); c.moveTo(sx + 3, sy);
    c.lineTo(sx - 22 + sw * 0.2, sy + 18);
    for (let i = 0; i <= 8; i++) { const t = i / 8; c.lineTo(sx - 28 + t * 34 + sw * (1 - t) * 0.9 + (i % 2 ? 0 : -1.5), H0 - tear[i] + (i % 2 ? 0 : 3)); }
    c.lineTo(sx + 6, sy + 8); c.closePath();
    c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
    const g = c.createLinearGradient(sx - 28, 0, sx + 6, 0); g.addColorStop(0, cape[2]); g.addColorStop(0.55, cape[1]); g.addColorStop(1, cape[0]);
    c.fillStyle = g; c.fill();
    c.strokeStyle = cape[2]; c.lineWidth = 1.2;
    for (const k of [0.25, 0.5, 0.75]) { c.beginPath(); c.moveTo(sx - 4 - k * 14, sy + 8); c.quadraticCurveTo(sx - 10 - k * 18 + sw * 0.5, (sy + H0) / 2, sx - 14 - k * 16 + sw, H0 - 4); c.stroke(); }
    c.fillStyle = INK; for (const [hx, hy] of [[-20, -20], [-14, -32], [-24, -40]]) { c.beginPath(); c.ellipse(sx + hx * 0.7 + 4, hy + 3, 1.6, 2.4, 0.4, 0, 7); c.fill(); }
  }
  // ---- ноги: толстые кости, ржавые наголенники, тяжёлые сапоги
  for (const side of [-1, 1]) {
    const ph2 = P.mv ? P.sw * side : 0, lift = Math.max(0, -ph2) * 5 + (P.mv ? Math.max(0, P.cw * side) * 3.4 : 0);
    const fx = side * 4.5 + ph2 * 10, fy = -lift;
    let kx = side * 3.5 + ph2 * 6 + 3 + sk * 0.4, ky = -20 - Math.abs(ph2) * 1.6 + sk * 0.5 - lift * 0.5;
    const hx = side * 4.5, hy = hipY;
    bone(hx, hy, kx, ky, 6); bone(kx, ky, fx, fy - 4, 5.2);
    joint(kx, ky, 3.6);
    // наголенник
    const mx = (kx + fx) / 2, my = (ky + fy - 4) / 2 + 2;
    poly([[mx - 3.6, my - 5], [mx + 3.8, my - 5], [mx + 3.2, my + 4], [mx - 3, my + 4]], C.iron[1], 1.4);
    c.fillStyle = C.iron[0]; c.fillRect(mx - 3, my - 4, 6, 1.4); c.fillStyle = C.rust[1]; c.fillRect(mx - 1.5, my, 2.4, 1.6);
    // сапог: костяная стопа в железном носке
    poly([[fx - 4, fy - 5], [fx + 5, fy - 5], [fx + 12, fy - 1.5], [fx + 12, fy + 0.5], [fx - 4, fy + 0.5]], INK, 0);
    poly([[fx - 3, fy - 4], [fx + 4.5, fy - 4], [fx + 10.5, fy - 1.4], [fx + 10.5, fy], [fx - 3, fy]], C.iron[1], 0);
    c.fillStyle = C.iron[0]; c.fillRect(fx + 6, fy - 2.6, 4.4, 1.2); c.fillStyle = C.rust[2]; c.fillRect(fx - 3, fy - 1, 6, 1);
  }
  // ---- таз, ремень и лохмотья мантии спереди
  c.fillStyle = INK; c.beginPath(); c.ellipse(0, hipY - 1, 11, 6, 0, 0, 7); c.fill();
  c.fillStyle = BONE; c.beginPath(); c.ellipse(0, hipY - 1.5, 9.6, 4.8, 0, 0, 7); c.fill();
  c.fillStyle = BONE2; c.beginPath(); c.ellipse(-3, hipY + 0.4, 5, 2.4, 0, 0, 7); c.fill();
  c.fillStyle = INK; c.fillRect(-11.5, hipY - 7, 23, 5.4); c.fillStyle = C.rust[2]; c.fillRect(-10.6, hipY - 6.2, 21.2, 3.8);
  c.fillStyle = C.gold[1]; c.fillRect(-2.6, hipY - 6.6, 5.2, 4.6); c.fillStyle = C.gold[0]; c.fillRect(-1.6, hipY - 5.6, 3.2, 2.4);          // пряжка
  for (const sx2 of [-8.6, 8.6]) { c.strokeStyle = INK; c.lineWidth = 1.2; c.beginPath(); c.moveTo(sx2, hipY - 3); c.lineTo(sx2, hipY + 1.4); c.stroke(); c.fillStyle = INK; c.beginPath(); c.arc(sx2, hipY + 4.4, 3.8, 0, 7); c.fill(); c.fillStyle = BONE; c.beginPath(); c.arc(sx2, hipY + 4, 2.9, 0, 7); c.fill(); c.fillStyle = INK; c.fillRect(sx2 - 2, hipY + 3, 1.6, 1.6); c.fillRect(sx2 + 0.4, hipY + 3, 1.6, 1.6); }
  for (const [dx, len] of [[-8, 9], [-3, 12], [3, 8], [8, 11]]) {
    const sw2 = Math.sin(P.sway * 1 + dx) * 1.2 + P.mv * P.sw * dx * 0.1;
    c.beginPath(); c.moveTo(dx - 2.4, hipY - 2); c.lineTo(dx + 2.4, hipY - 2); c.lineTo(dx + 1.6 + sw2, hipY + len); c.lineTo(dx - 0.2 + sw2, hipY + len - 3); c.lineTo(dx - 1.6 + sw2, hipY + len); c.closePath();
    c.fillStyle = cape[1]; c.strokeStyle = INK; c.lineWidth = 1; c.stroke(); c.fill();
  }
  // ---- позвоночник, рёбра, нагрудник из кости
  const cx = lean * 0.5, ribY = [-46, -50, -54, -58, -62];
  c.save(); c.translate(0, P.bob + sk * 0.85);
  bone(0, hipY - 7 - (P.bob + sk * 0.85), cx, shY + 4 - (P.bob + sk * 0.85), 4.4);
  for (let i = 0; i < 5; i++) {
    const y = ribY[i] + 0, w = 11.5 - i * 0.7;
    c.strokeStyle = INK; c.lineWidth = 5.4; c.beginPath(); c.ellipse(cx, y, w, 3.4, 0, 0, Math.PI); c.stroke();
    c.strokeStyle = i % 2 ? BONE2 : BONE; c.lineWidth = 3; c.beginPath(); c.ellipse(cx, y, w, 3.4, 0, 0, Math.PI); c.stroke();
  }
  // тёмная пустота в груди и огонь души (фаза III — пламя наружу)
  const core = ph === 3 ? 1 : ph === 2 ? 0.55 : 0.25;
  c.fillStyle = 'rgba(6,16,26,0.9)'; c.beginPath(); c.ellipse(cx + 1, -53, 6.2, 8.5, 0, 0, 7); c.fill();
  c.save(); c.globalCompositeOperation = 'lighter'; const gr = c.createRadialGradient(cx + 1, -53, 0, cx + 1, -53, 8 + core * 4); gr.addColorStop(0, `rgba(190,240,255,${0.35 + core * 0.5})`); gr.addColorStop(1, 'rgba(60,150,220,0)'); c.fillStyle = gr; c.beginPath(); c.arc(cx + 1, -53, 12, 0, 7); c.fill(); c.restore();
  // костяные пластины поверх рёбер: перекрывающиеся полосы, клёпки
  const plate = (y, w, h, col) => { c.fillStyle = INK; c.fillRect(cx - w / 2 - 1.2, y - 1.2, w + 2.4, h + 2.4); c.fillStyle = col; c.fillRect(cx - w / 2, y, w, h); };
  if (ph < 3) { plate(-64, 21, 5.4, BONE2); plate(-58.6, 18, 5, BONE); plate(-53.6, 15, 4.6, BONE2); plate(-49, 13, 4, BONE); }
  else { plate(-64, 21, 5.4, BONE2); plate(-58.6, 8, 5, BONE); plate(-49, 13, 4, BONE2); for (const [x, y] of [[-9, -58.6], [4, -58.6]]) { c.fillStyle = INK; c.beginPath(); c.moveTo(cx + x, y); c.lineTo(cx + x + 6, y + 0.6); c.lineTo(cx + x + 2, y + 5.4); c.lineTo(cx + x - 1, y + 4.2); c.fill(); } }
  c.fillStyle = C.rust[1]; for (const [x, y] of [[-9, -62], [9, -62], [-7, -48], [7, -48]]) c.fillRect(cx + x, y, 1.8, 1.8);
  c.fillStyle = C.iron[2]; c.fillRect(cx - 0.8, -64, 1.6, 20);                                    // стык пластин
  if (ph >= 2) {                                                                                  // трещины с холодным светом
    c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(106,208,255,${0.6 + core * 0.3})`; c.lineWidth = 1.1;
    for (const pts of [[[-6, -63], [-3, -58], [-5, -54], [-2, -50]], [[6, -62], [3, -57], [6, -53]], ph === 3 ? [[-2, -49], [1, -44], [-1, -40]] : [[0, -49], [-2, -45]]]) { c.beginPath(); c.moveTo(cx + pts[0][0], pts[0][1]); for (const q of pts.slice(1)) c.lineTo(cx + q[0], q[1]); c.stroke(); }
    c.restore();
  }
  c.restore();
  // ---- задняя рука
  const shx = 8 + lean * 0.4, bx = -8 + lean * 0.4;
  {
    const bh = P.bhand, bs = [bx, shY + 3], ex = (bs[0] + bh[0]) / 2 - 3, ey = (bs[1] + bh[1]) / 2 + 3;
    bone(bs[0], bs[1], ex, ey, 5); bone(ex, ey, bh[0], bh[1] + sk * 0.5, 4.4); joint(ex, ey, 2.8);
    // перчатка-кулак: железные когти (в фазе III — синее пламя на ладони)
    poly([[bh[0] - 3, bh[1] - 3], [bh[0] + 3.4, bh[1] - 3], [bh[0] + 3.4, bh[1] + 4], [bh[0] - 3, bh[1] + 4]], C.iron[1], 1.4);
    c.fillStyle = C.iron[0]; c.fillRect(bh[0] - 2.4, bh[1] - 2.4, 5, 1.4);
    if (ph === 3) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(120,220,255,0.7)'; c.beginPath(); c.ellipse(bh[0] + 0.4, bh[1] - 6, 2.6, 5 + P.sway, 0, 0, 7); c.fill(); c.restore(); }
  }
  // ---- наплечники: железные купола с костяными шипами
  for (const [px, big] of [[-9 + lean * 0.4, 0], [shx, 1]]) {
    const y = shY - 1, w = 9.5 + big * 0.8;
    c.fillStyle = INK; c.beginPath(); c.ellipse(px, y, w + 1.4, 7.4, 0, Math.PI, 0); c.lineTo(px + w + 1.4, y + 3); c.lineTo(px - w - 1.4, y + 3); c.fill();
    c.fillStyle = C.iron[1]; c.beginPath(); c.ellipse(px, y, w, 6.2, 0, Math.PI, 0); c.lineTo(px + w, y + 2); c.lineTo(px - w, y + 2); c.fill();
    c.fillStyle = C.iron[0]; c.beginPath(); c.ellipse(px - 1, y - 1.6, w * 0.7, 3.2, 0, Math.PI, 0); c.fill();
    c.fillStyle = C.rust[1]; c.fillRect(px + 2, y - 3, 3, 2); c.fillRect(px - 6, y - 1, 2, 2);
    for (const [dx, h] of [[-5, 8], [0, 11], [5, 8]]) { c.fillStyle = INK; c.beginPath(); c.moveTo(px + dx - 2.8, y - 4.4); c.lineTo(px + dx + 0.4, y - 4.4 - h); c.lineTo(px + dx + 2.8, y - 4.4); c.fill(); c.fillStyle = BONE; c.beginPath(); c.moveTo(px + dx - 1.6, y - 4.4); c.lineTo(px + dx + 0.3, y - 3.4 - h); c.lineTo(px + dx + 1.8, y - 4.4); c.fill(); }
  }
  // высокий рваный воротник мантии за головой
  { const bx0 = 3 + lean * 0.9 + P.hdx; c.beginPath(); c.moveTo(-16 + lean * 0.5, shY + 4); for (const [x, y] of [[-17, -86], [-11, -80], [-9, -94], [-3, -84], [2, -98], [8, -86]]) c.lineTo(bx0 + x + 2, y + sk * 0.8 + P.bob); c.lineTo(10 + lean * 0.5, shY + 4); c.closePath(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke(); c.fillStyle = cape[1]; c.fill(); }
  // ---- голова: череп с провалами, клыки, кривая корона
  const hx = 3 + lean * 0.9 + P.hdx, hy = -81 + sk * 0.8 + P.bob + P.hdy, jaw = P.jaw;
  bone(cx - 1, shY + 5, hx - 4.5, hy + 7, 4.2);                                                     // шея: к затылку, не под челюсть
  
  c.save(); c.translate(hx, hy); c.rotate(P.tilt - 0.04 + P.hdy * 0.01);
  c.fillStyle = INK; c.beginPath(); c.ellipse(0, 0, 11.4, 10.4, 0, 0, 7); c.fill();
  c.fillStyle = BONE; c.beginPath(); c.ellipse(0, 0, 10.2, 9.2, 0, 0, 7); c.fill();
  c.fillStyle = BONE2; c.beginPath(); c.ellipse(-3.4, 2.4, 6.4, 6.4, 0, 0, 7); c.fill(); c.fillStyle = BONE; c.beginPath(); c.ellipse(-1.2, -1.2, 7.6, 7.2, 0, 0, 7); c.fill();
  c.strokeStyle = C.bone3; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-1, -8.4); c.lineTo(1, -4.4); c.lineTo(-0.6, -2); c.stroke();                // трещина на черепе
  // глазницы: две тёмные ямы, злой наклон
  c.fillStyle = INK;
  c.beginPath(); c.moveTo(-8, -5.4); c.lineTo(-1.6, -1.2); c.lineTo(-2.2, 4.8); c.quadraticCurveTo(-5.6, 6.2, -8, 1.6); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(2.2, -1.4); c.lineTo(10.4, -5.8); c.lineTo(10.2, 1.8); c.quadraticCurveTo(6, 6.2, 2.6, 4.4); c.closePath(); c.fill();
  // тяжёлые надбровья: костяные козырьки злым изломом над провалами
  c.fillStyle = BONE2; c.beginPath(); c.moveTo(-9.2, -7); c.lineTo(-1, -2.6); c.lineTo(-1.2, -1); c.lineTo(-8.4, -4.4); c.closePath(); c.fill(); c.beginPath(); c.moveTo(11.6, -8); c.lineTo(1.8, -2.8); c.lineTo(2, -1.2); c.lineTo(11, -5.4); c.closePath(); c.fill();
  c.strokeStyle = INK; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-8.6, -7); c.lineTo(-1, -2.6); c.moveTo(11, -8); c.lineTo(1.8, -2.8); c.stroke();
  // нос и пасть
  c.beginPath(); c.moveTo(0.8, 3.6); c.lineTo(-0.6, 7); c.lineTo(2.8, 7); c.fill();
  c.fillStyle = INK; c.fillRect(-5.6, 7.4, 14, 2.4 + jaw);
  c.fillStyle = BONE; for (let i = 0; i < 6; i++) { const th = i === 1 || i === 4 ? 6 : 3.4; c.beginPath(); c.moveTo(-5.2 + i * 2.3, 7.4); c.lineTo(-4.2 + i * 2.3, 7.4 + th); c.lineTo(-3.2 + i * 2.3, 7.4); c.fill(); }
  if (jaw > 2) { c.fillStyle = BONE2; c.fillRect(-4.8, 9.8 + jaw - 0.6, 11, 2.2); c.fillStyle = INK; c.fillRect(-4.8, 11.8 + jaw - 0.6, 11, 0.8); }
  else { c.fillStyle = BONE2; c.fillRect(-4.8, 9.6, 11, 2.4); c.fillStyle = BONE; for (let i = 0; i < 5; i++) c.fillRect(-4.2 + i * 2.3, 9.6, 1.1, 1.8); }
  // корона: кривая, ржавое золото, один зубец сломан
  c.save(); c.translate(0.6, -8.4); c.rotate(-0.2);
  c.fillStyle = INK; c.beginPath(); c.rect(-11, -3, 22, 7.4); c.fill();
  const cg = c.createLinearGradient(-10, 0, 10, 0); cg.addColorStop(0, C.gold[0]); cg.addColorStop(0.55, C.gold[1]); cg.addColorStop(1, C.gold[2]);
  c.fillStyle = cg; c.fillRect(-10, -2, 20, 5.2); c.fillStyle = C.gold[0]; c.fillRect(-10, -2, 20, 1.2);
  c.fillStyle = C.rust[1]; c.fillRect(-4, 0, 3, 1.6); c.fillRect(5, -1, 2, 1.4);                               // ржавчина
  for (const [dx, h, br] of [[-9, 10, 0], [-4, 16, 0], [1.4, 7, 1], [6, 17, 0], [10, 9, 0]]) {
    const tip = br ? 4 : h;
    c.fillStyle = INK; c.beginPath(); c.moveTo(dx - 3, -2); c.lineTo(dx + (br ? 1.4 : 0.4), -2 - tip - 1.6); c.lineTo(dx + 3, -2); c.fill();
    c.fillStyle = C.gold[1]; c.beginPath(); c.moveTo(dx - 2, -2); c.lineTo(dx + (br ? 1.2 : 0.4), -1.6 - tip); c.lineTo(dx + 2, -2); c.fill();
    c.fillStyle = C.gold[0]; c.beginPath(); c.moveTo(dx - 2, -2); c.lineTo(dx + (br ? 1.2 : 0.4), -1.6 - tip); c.lineTo(dx - 0.4, -2); c.fill();
  }
  c.restore();
  c.restore();
  // свет в глазницах (после поворота головы пересчитываем точку, поворот мал)
  const ec = C.eye[ph - 1], ex = (x, y) => [hx + x * Math.cos(P.tilt - 0.04) - y * Math.sin(P.tilt - 0.04), hy + x * Math.sin(P.tilt - 0.04) + y * Math.cos(P.tilt - 0.04)];
  const e1 = ex(-4.8, 0.2), e2 = ex(6.4, -0.4);
  marks.push({ eye: 1, x: e1[0], y: e1[1], side: -1, col: ec, big: ph === 3 || P.flare > 0.9 }, { eye: 1, x: e2[0], y: e2[1], side: 1, col: ec, big: ph === 3 || P.flare > 0.9 });
  const cg2 = ex(0.6 - 1, -8.4 - 0.6); marks.push([cg2[0] + 2, cg2[1] - 0.6, ec[0], 2]);                       // камень на короне
  // ---- меч: зазубренный клинок из холодной стали, светящиеся руны; хват — за рукоять, ладонь на ней
  const hd = [P.hand[0] + lean * 0.3, P.hand[1] + sk * 0.5 + P.bob], sa = [shx + 3, shY + 3];
  const ex2 = (sa[0] + hd[0]) / 2 - 2, ey2 = (sa[1] + hd[1]) / 2 + 5;
  bone(sa[0], sa[1], ex2, ey2, 5.4); bone(ex2, ey2, hd[0], hd[1], 4.6); joint(ex2, ey2, 3);
  const gw = [0.55, 0.8, 1][ph - 1], cs = Math.cos(P.ang), sn2 = Math.sin(P.ang), org = [hd[0] + cs * 6, hd[1] + sn2 * 6];
  const wp = (l, w) => [org[0] + cs * l - sn2 * w, org[1] + sn2 * l + cs * w];       // точка клинка: l — вдоль, w — поперёк
  c.save(); c.translate(org[0], org[1]); c.rotate(P.ang);
  c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(90,190,255,${0.16 * gw})`; c.lineWidth = 15; c.beginPath(); c.moveTo(4, 0); c.lineTo(58, 0); c.stroke(); c.lineWidth = 8; c.strokeStyle = `rgba(150,230,255,${0.2 * gw})`; c.stroke(); c.restore();
  // клинок: широкий у гарды, к концу сужается и загибается; нижняя кромка зазубрена
  const blade = (e) => { c.beginPath(); c.moveTo(0, -5.8 - e); c.lineTo(40, -5 - e); c.quadraticCurveTo(54, -4 - e, 64 + e, -3.6 + e * 0.2); c.lineTo(46, 3 + e); for (let k = 0; k < 4; k++) { c.lineTo(38 - k * 10, 3.6 + e + 2.4); c.lineTo(34 - k * 10, 5.6 + e); } c.lineTo(0, 5.8 + e); c.closePath(); };
  blade(1.1); c.fillStyle = INK; c.fill();
  const bg = c.createLinearGradient(0, -6, 0, 6); bg.addColorStop(0, C.blade[0]); bg.addColorStop(0.35, C.blade[1]); bg.addColorStop(0.75, C.blade[2]); bg.addColorStop(1, C.blade[3]);
  blade(0); c.fillStyle = bg; c.fill();
  c.fillStyle = C.blade[3]; c.fillRect(2, -0.8, 46, 1.6);                                          // дол
  c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(190,245,255,${0.55 + 0.4 * gw})`; c.lineWidth = 1.3; c.beginPath(); c.moveTo(3, 0); c.lineTo(52, 0); c.stroke(); c.restore();
  c.fillStyle = C.blade[0]; c.fillRect(2, -5, 38, 1.1); c.fillStyle = '#ffffff'; c.fillRect(46, -3.6, 12, 0.9);   // блик по лезвию
  c.restore();
  for (let k = 0; k < 4; k++) { const q = wp(9 + k * 9, 0); marks.push([q[0] - 1, q[1] - 1, ph === 1 ? '#8ae0ff' : '#ffffff', ph === 3 ? 3 : 2]); }   // руны
  c.save(); c.translate(org[0], org[1]); c.rotate(P.ang);
  // гарда: чёрная сталь с изогнутыми рогами и камнем
  c.fillStyle = INK; c.beginPath(); c.moveTo(-5, -13); c.quadraticCurveTo(-1, -9, 2, -6); c.lineTo(2, 6); c.quadraticCurveTo(-1, 9, -5, 13); c.lineTo(-3, 5); c.lineTo(-3, -5); c.closePath(); c.fill();
  c.fillStyle = C.iron[2]; c.beginPath(); c.moveTo(-4, -11.6); c.quadraticCurveTo(-0.6, -8.4, 1, -5.4); c.lineTo(1, 5.4); c.quadraticCurveTo(-0.6, 8.4, -4, 11.6); c.lineTo(-2.4, 4.6); c.lineTo(-2.4, -4.6); c.closePath(); c.fill();
  c.fillStyle = C.gold[0]; c.fillRect(-2.2, -4, 1.4, 8);
  c.fillStyle = INK; c.fillRect(-16, -2.8, 12, 5.6); c.fillStyle = '#2a2430'; c.fillRect(-15, -1.8, 10.4, 3.6);          // рукоять в кожаной обмотке
  c.fillStyle = C.gold[1]; for (const x of [-14, -10.4, -6.8]) c.fillRect(x, -2, 1.2, 4);
  c.fillStyle = INK; c.beginPath(); c.arc(-18, 0, 4.4, 0, 7); c.fill(); c.fillStyle = C.blade[1]; c.beginPath(); c.arc(-18, 0, 3.2, 0, 7); c.fill();        // навершие-кристалл
  c.restore();
  { const g1 = wp(-1.4, 0), g2 = wp(-18, 0); marks.push([g1[0] - 1, g1[1] - 1, '#ffffff', 2], [g2[0] - 1, g2[1] - 1, '#ffffff', 2]); }
  // костяная ладонь на рукояти
  c.fillStyle = INK; c.beginPath(); c.arc(hd[0], hd[1], 4.6, 0, 7); c.fill(); c.fillStyle = BONE; c.beginPath(); c.arc(hd[0], hd[1], 3.4, 0, 7); c.fill();
  c.strokeStyle = INK; c.lineWidth = 0.9; const dx = Math.cos(P.ang), dy = Math.sin(P.ang);
  for (const o of [-1.6, 0.4, 2.2]) { c.beginPath(); c.moveTo(hd[0] - dy * o - dx * 1.4, hd[1] + dx * o - dy * 1.4); c.lineTo(hd[0] - dy * o + dx * 1.4, hd[1] + dx * o + dy * 1.4); c.stroke(); }
  return marks;
}

// ---- в игре: спрайт + холодное свечение под ногами и клубы тумана; хитбокс и шкалу здоровья считает raid.js
function kpDraw(c, N) {
  const t = Game.time, dead = N.st === 'die';
  const al = dead ? Math.max(0, Math.min(1, 1 - (N.dt - 0.6) / 2.6)) : 1;
  if (al <= 0) return;
  const ph = kpPhaseOf(N), px = Math.round(N.x * TILE), py = Math.round(N.y * TILE + 6);
  const fr = N.fr || 'i0';
  const spr = kpSprite(/^(i|w|d|v|a|r)(\d|1[01])$|^[hp][0-5]$|^(ready|step|windup|strike|recover|roar|hurt|stagger)$/.test(fr) ? fr : 'i0', ph);
  if (!spr) return;
  c.save();
  c.globalAlpha = al;
  c.fillStyle = 'rgba(10,8,4,0.38)'; c.beginPath(); c.ellipse(px, py + 1, 26, 8, 0, 0, 7); c.fill();
  // холодная дымка у ног: растёт с фазой
  c.save(); c.globalCompositeOperation = 'lighter';
  c.fillStyle = `rgba(80,180,255,${0.14 + 0.05 * ph + 0.06 * Math.sin(t * 4)})`; c.beginPath(); c.ellipse(px, py, 34, 11, 0, 0, 7); c.fill();
  if (!dead) for (let k = 0; k < 5; k++) { const q = (t * 0.45 + k * 0.2) % 1, wx = px + Math.sin(q * 6 + k * 2.1) * 20, wy = py - q * 22; c.fillStyle = `rgba(150,225,255,${0.22 * (1 - q)})`; c.beginPath(); c.arc(wx, wy, 3 + q * 4, 0, 7); c.fill(); }
  c.restore();
  const sink = dead ? Math.min(20, N.dt * 8) : 0;
  c.translate(px, py + sink);
  if (N.face < 0) c.scale(-1, 1);
  blitFine(c, spr.cv, -KP.AX, -KP.AY, KP.W, KP.H);
  c.restore();
  if (!dead) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 4; k++) { const a = t * 1.1 + k * 1.57; c.fillStyle = 'rgba(150,230,255,0.85)'; c.fillRect(Math.round(px + Math.cos(a) * 30), Math.round(py - 48 + Math.sin(a * 1.4) * 22), 2, 2); }
    c.restore();
  }
}
