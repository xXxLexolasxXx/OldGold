'use strict';
// Пиксель-арт скелетов: те же 4 вида (юг, восток, север; запад — зеркало), та же сверхвыборка и конвейер toPixelArt, что у гномов.
// Кадры: покой 6, ходьба 8, атака 9, удар по нему 4, смерть 9, захват 9 + шаг с ношей 4 (КАДРЫ.md).
// Кадры строятся лениво и лежат в кэше с вытеснением; внешность — 2 бита (цвет колпака, щит), считаются из дома скелета (ключи, не в сейве).
// Рисует drawSkeleton (skeletons.js вызывает skelDraw отсюда); без этого файла остаётся старое векторное рисование.

const SKA = { PS: 6, PART: 2, W: 52, H: 56, AX: 22, AY: 50, FR: { idle: 6, walk: 8, atk: 9, hit: 4, die: 9, grab: 13 }, ATK_DUR: 0.72, HIT_DUR: 0.2, DIE_DUR: 0.9, MAX: 700 };
// палитра общая с призраками и нечистью: тёплая кость, ржавчина, мох; зрачки — тот же зелёный, что у призраков (#6fe0b4)
const SKA_C = {
  bone: '#e4ddd2', bone2: '#b6ada0', bone3: '#867e74', ink: '#1e1b19', flash: '#f6f2ea',
  rust: ['#c8946a', '#a06840', '#6e432a'], iron: ['#9e958a', '#706960', '#4a4540'], wood: ['#875434', '#6e432a', '#45291a'],
  hat: [['#6c7a54', '#4a6e30', '#2f4a26'], ['#7a6a5a', '#583522', '#341f14']], eye: '#6fe0b4', eyeDim: '#2f8a6a',
};
const SKA_CACHE = new Map();
let SKA_SCRATCH = null;

// внешность: бит 0 — цвет колпака, бит 1 — щит. Берётся из дома скелета: после загрузки сейва тот же скелет выглядит так же
function skelLook(s) { return (Math.floor(s.hx * 7 + s.hy * 13) & 3) >>> 0; }

function skelSprite(s, view, pose, frame) {
  const look = skelLook(s);
  const key = `${look}|${view}|${pose}${frame}`;
  let e = SKA_CACHE.get(key);
  if (e) { SKA_CACHE.delete(key); SKA_CACHE.set(key, e); s._spr = e; return e; }
  const hasFb = !!s._spr;
  if (typeof spriteBudgetOk === 'function' && !spriteBudgetOk(hasFb)) return s._spr;
  const t0 = performance.now();
  if (!SKA_SCRATCH) SKA_SCRATCH = mkSprite(SKA.W, SKA.H, SKA.PS);
  const [cv, c] = SKA_SCRATCH;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
  c.setTransform(SKA.PS, 0, 0, SKA.PS, 0, 0); c.globalAlpha = 1;
  c.translate(SKA.AX, SKA.AY);
  const eyes = skelPaint(c, look, view, pose, frame);
  const out = toPixelArt(cv, SKA.PS / SKA.PART, { outline: true, outlineDark: 0.36, alphaCut: 105 });
  // огоньки в глазницах: ровные пиксели без квантования, мерцают по кадрам
  if (eyes) {
    const o = out.getContext('2d'), P = SKA.PART;
    for (const [ex, ey, lit] of eyes) {
      const X = Math.round((SKA.AX + ex) * P), Y = Math.round((SKA.AY + ey) * P);
      o.fillStyle = lit > 0.6 ? SKA_C.eye : SKA_C.eyeDim; o.fillRect(X, Y, 1, 1);
      if (lit > 0.9) { o.fillStyle = 'rgba(111,224,180,0.4)'; o.fillRect(X - 1, Y, 1, 1); o.fillRect(X + 1, Y, 1, 1); }
    }
  }
  e = { cv: out };
  if (SKA_CACHE.size >= SKA.MAX) SKA_CACHE.delete(SKA_CACHE.keys().next().value);
  SKA_CACHE.set(key, e);
  s._spr = e;
  if (typeof spriteSpent === 'function') spriteSpent(t0);
  return e;
}

// ---------- параметры позы по (поза, кадр) ----------
const _sm = x => x * x * (3 - 2 * x);
function skelParams(pose, i) {
  const TAU = Math.PI * 2;
  const P = { cw: 0, lean: 0, bob: 0, sw: 0, mv: 0, ang: -1.1, jaw: 0.6, hdx: 0, hdy: 0, sink: 0, armB: 0, flash: 0, adv: 0, gp: null, eyeLit: 0.8, shake: 0 };
  if (pose === 'idle') {
    const ph = i / 6 * TAU;
    P.bob = Math.sin(ph) * 0.5; P.armB = Math.sin(ph + 1) * 0.9; P.ang = -1.1 + Math.sin(ph) * 0.1; P.hdx = Math.sin(ph + 0.8) * 0.5; P.lean = Math.sin(ph) * 0.3;
    P.eyeLit = i % 3 === 0 ? 1 : i % 3 === 1 ? 0.7 : 0.4;
  } else if (pose === 'walk') {
    const ph = i / 8 * TAU, sw = Math.sin(ph);
    P.mv = 1; P.sw = sw; P.cw = Math.cos(ph); P.bob = -Math.abs(sw) * 0.8; P.ang = -0.9 + sw * 0.2; P.armB = -sw * 3; P.hdx = Math.sin(ph * 2) * 0.3; P.eyeLit = i % 2 ? 1 : 0.65;
  } else if (pose === 'atk') {
    const k = i / 8;
    P.eyeLit = 1;
    if (k < 0.33) { const u = _sm(k / 0.33); P.ang = -1.1 - 1.2 * u; P.lean = -1.2 * u; P.armB = -1.5 * u; P.jaw = 0.6 + 1.2 * u; }
    else if (k < 0.67) { const u = _sm((k - 0.33) / 0.34); P.ang = -2.3 + 3.0 * u; P.lean = -1.2 + 4.4 * u; P.adv = 2.2 * u; P.armB = -1.5 + 3 * u; P.jaw = 2.2; }
    else { const u = _sm((k - 0.67) / 0.33); P.ang = 0.7 - 1.6 * u; P.lean = 3.2 * (1 - u); P.adv = 2.2 * (1 - u); P.armB = 1.5 * (1 - u); P.jaw = 2.2 - 1.6 * u; }
  } else if (pose === 'hit') {
    P.lean = [-1.2, -3, -2, -0.6][i]; P.hdx = [-1, -2.2, -1.2, -0.3][i]; P.hdy = [0, 0.6, 0.3, 0][i]; P.jaw = [1.6, 2.6, 1.6, 0.8][i];
    P.flash = [1, 0.7, 0.2, 0][i]; P.ang = [-1.3, -1.6, -1.4, -1.2][i]; P.shake = [0.8, -0.8, 0.4, 0][i]; P.armB = [-1, -2, -1, 0][i]; P.eyeLit = 0.3;
  } else if (pose === 'die') {
    P.sink = [0, 3, 6.5][Math.min(2, i)]; P.lean = -i * 1.8; P.hdx = -i * 1.2; P.hdy = i * 1.6; P.ang = -1.1 + i * 0.9; P.jaw = 3; P.armB = -i * 1.5; P.eyeLit = 0.5 - i * 0.2; P.flash = i === 0 ? 0.5 : 0;
  } else if (pose === 'grab') {
    const gp = skPoseAt(i);
    P.gp = gp; P.lean = gp.lean; P.jaw = 1.2 + gp.k * 1.4; P.eyeLit = 1;      // челюсть сжимается вместе с пальцами
    if (i >= 9) { const q = i - 9, ph = q / 4 * Math.PI * 2, sw = Math.sin(ph) * 0.8; P.mv = 1; P.sw = sw; P.cw = Math.cos(ph); P.bob = -Math.abs(sw) * 0.8; }
  }
  return P;
}

// ---------- рисование ----------
// c — контекст сверхвыборки, начало координат у ног скелета, y вверх = минус. Возвращает глазницы [[x, y, яркость]…].
function skelPaint(c, look, view, pose, frame) {
  const C = SKA_C, P = skelParams(pose, frame), hatC = C.hat[look & 1], shield = !!(look & 2);
  const BONE = P.flash ? C.flash : C.bone, BONE2 = C.bone2, INK = C.ink;
  c.lineCap = 'round'; c.lineJoin = 'round';
  if (pose === 'die' && frame >= 3) { skelPile(c, look, (frame - 2) / 6); return null; }
  c.translate(P.adv + P.shake, 0);
  const lean = P.lean, S = view === 'E' ? 1 : 0;
  const bone = (x1, y1, x2, y2, w = 1.8) => { c.strokeStyle = INK; c.lineWidth = w + 1.2; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.strokeStyle = BONE; c.lineWidth = w; c.stroke(); };
  const joint = (x, y, r) => { c.fillStyle = INK; c.beginPath(); c.arc(x, y, r + 0.6, 0, 7); c.fill(); c.fillStyle = BONE; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); };
  const hipY = -12.5 + P.sink, torsoDy = P.bob + P.sink;
  // ноги: бедро + голень, шагают попеременно, коленные суставы-шарики
  const legs = [-1, 1];
  if (view === 'N') legs.reverse();
  for (const side of legs) {
    const ph = P.mv ? P.sw * side : 0, sl = P.mv ? Math.max(0, P.cw * side) : 0, lift = Math.max(0, ph) + sl * 0.8;
    let kx, ky, fx, fy;
    if (view === 'E') {
      kx = side * 1.8 + ph * 2.4; fx = side * 2.4 + ph * 3.6; fy = Math.max(-0.5, 0 - Math.max(0, -ph) * 2.4) - sl * 1.2;
    } else {
      kx = side * 2.4 + side * P.sink * 0.35; fx = side * 2.8; fy = -lift * 2.6;
    }
    ky = (hipY + fy) / 2 - lift * 1.4; if (view === 'E') ky = -7.4 + Math.abs(ph) * -0.8 - sl * 1.2 + P.sink * 0.5;
    if (view === 'E') kx += P.sink * 0.45;
    bone(side * 1.4, hipY, kx, ky, 1.9); bone(kx, ky, fx, fy, 1.7);
    joint(kx, ky, 1.5);
    if (view === 'E') bone(fx, fy, fx + 2.8, fy, 1.5);
    else { c.fillStyle = INK; c.beginPath(); c.ellipse(fx, fy, 2.2, 1.2, 0, 0, 7); c.fill(); c.fillStyle = BONE; c.beginPath(); c.ellipse(fx, fy - 0.1, 1.6, 0.7, 0, 0, 7); c.fill(); }
  }
  c.save(); c.translate(0, torsoDy);
  // таз и позвоночник
  const pel = hipY - torsoDy;
  c.fillStyle = BONE; c.strokeStyle = INK; c.lineWidth = 0.9;
  c.beginPath(); c.ellipse(0, pel, view === 'E' ? 3.8 : 4.6, 2, 0, 0, 7); c.fill(); c.stroke();
  const sx = lean * 0.5;
  bone(0, pel - 0.5, sx, -22, 1.6);
  // рёбра
  const rib = (y, w, cx) => { c.strokeStyle = INK; c.lineWidth = 2.4; c.beginPath(); c.ellipse(cx, y, w, 1.5, 0, 0, Math.PI); c.stroke(); c.strokeStyle = BONE; c.lineWidth = 1.2; c.beginPath(); c.ellipse(cx, y, w, 1.5, 0, 0, Math.PI); c.stroke(); };
  if (view === 'N') {
    // со спины: позвоночник и дуги рёбер вниз-наружу
    for (let r = 0; r < 3; r++) { const y = -15.2 - r * 2.4, w = 4.6 - r * 0.3; c.strokeStyle = INK; c.lineWidth = 2.2; c.beginPath(); c.moveTo(sx - w, y + 1); c.quadraticCurveTo(sx, y - 1.6, sx + w, y + 1); c.stroke(); c.strokeStyle = BONE; c.lineWidth = 1.1; c.stroke(); }
    bone(sx, -13.5, sx, -22, 1.5);
    for (let r = 0; r < 4; r++) joint(sx, -14 - r * 2.2, 0.9);
  } else {
    const rx = view === 'E' ? lean * 0.4 : sx;
    for (let r = 0; r < 3; r++) rib(-15.2 - r * 2.4, (view === 'E' ? 4.4 : 5.2) - r * 0.3, rx);
    if (view === 'S') bone(sx, -13.5, sx, -21, 1.0);
  }
  bone(view === 'E' ? -5 : -5.6, -22, view === 'E' ? 5 : 5.6, -22, 1.8);              // ключицы
  const sh = (side) => [side * (view === 'E' ? 5 : 5.6) + (view === 'E' ? 0 : lean * 0.3), -22];
  // задняя рука: костлявая, болтается; в южном/северном виде — слева, держит щит
  const atkSwing = P.armB;
  const bsw = view === 'E' ? (P.mv ? -P.sw * 3 : P.armB) : P.armB;
  const gp = P.gp;
  const swordArm = () => {
    const [ax, ay] = sh(1);
    let hx = ax + 4 + Math.cos(P.ang - 0.7) * 2, hy = ay + 6 + Math.sin(P.ang - 0.7) * 3, ang = P.ang;
    if (view !== 'E') { hx = ax + 2.4 + Math.sin(ang * 0.5) * 0.5 + (pose === 'atk' ? 0 : 0); hy = -11.6 + Math.sin(ang) * 0.6; }
    if (gp) {
      const gx = gp.h[0], gy = gp.h[1], ex = (ax + gx) / 2 - 1, ey = (ay + gy) / 2 + 3.5;
      bone(ax, ay, ex, ey, 1.5); bone(ex, ey, gx, gy, 1.4); joint(ex, ey, 1.1);
      hx = -6; hy = -20; ang = 2.35;
    } else if (view === 'E') { bone(ax, ay, ax + 3.4, ay + 4.4, 1.5); bone(ax + 3.4, ay + 4.4, hx + 1, hy, 1.4); joint(ax + 3.4, ay + 4.4, 1.1); }
    else { const ex = ax + 2.2, ey = -16.4; bone(ax, ay, ex, ey, 1.5); bone(ex, ey, hx, hy, 1.4); joint(ex, ey, 1.1); }
    skelSword(c, hx + (view === 'E' ? 1 : 0.4), hy, view === 'E' ? ang : -1.0 + (ang + 1.1) * 0.6 + (view === 'N' ? 0.1 : 0), look, view);
  };
  const backArm = () => {
    const [ax, ay] = sh(-1);
    if (view === 'E') { bone(ax, ay, -6.5 + bsw * 0.4, -16, 1.5); bone(-6.5 + bsw * 0.4, -16, -6 + bsw, -10.5, 1.4); joint(-6.5 + bsw * 0.4, -16, 1.1); }
    else {
      const ex = ax - 1.8 + bsw * 0.2, ey = -16.6, hx = ex - 0.6, hy = -11.5 + Math.abs(bsw) * 0.3;
      bone(ax, ay, ex, ey, 1.5); bone(ex, ey, hx, hy, 1.4); joint(ex, ey, 1.1);
      if (shield) skelShield(c, hx - 1.4, hy - 3.6, 4.7, view === 'N');
    }
  };
  if (view === 'E') {
    backArm();
    if (shield) skelShield(c, 0.4, -14.6, 0, false);               // с ребра: узкий диск у корпуса
    swordArm();
  } else if (view === 'N') { swordArm(); backArm(); }
  else { backArm(); swordArm(); }
  c.restore();
  // череп
  const hy2 = -27.5 + P.sink * 0.6 + P.bob + P.hdy + lean * 0.2, hx2 = lean * 0.8 + P.hdx;
  const eyes = skelHead(c, view, hx2, hy2, P, look, hatC);
  return eyes;
}

function skelSword(c, hx, hy, ang, look, view) {
  const C = SKA_C, INK = C.ink;
  c.save(); c.translate(hx, hy); c.rotate(ang);
  // клинок: ржавый, щербатый, в тёмной обводке
  c.fillStyle = INK; c.beginPath(); c.moveTo(-1.4, -1.7); c.lineTo(15.5, -1.9); c.lineTo(17.4, 0); c.lineTo(15.5, 1.9); c.lineTo(-1.4, 1.7); c.closePath(); c.fill();
  const rg = c.createLinearGradient(0, -1.4, 0, 1.4); rg.addColorStop(0, C.rust[0]); rg.addColorStop(0.5, C.rust[1]); rg.addColorStop(1, C.rust[2]);
  c.fillStyle = rg; c.beginPath(); c.moveTo(0, -1.1); c.lineTo(15, -1.2); c.lineTo(16.4, 0); c.lineTo(15, 1.2); c.lineTo(0, 1.1); c.closePath(); c.fill();
  c.fillStyle = INK; for (const x of [4, 8.4, 12]) { c.beginPath(); c.moveTo(x, -1.2); c.lineTo(x + 0.9, -0.2); c.lineTo(x + 1.8, -1.2); c.fill(); }
  c.fillStyle = '#c0501a'; for (const x of [3, 7, 11.5]) c.fillRect(x, 0.2, 1.3, 0.7);
  c.fillStyle = INK; c.fillRect(-2.6, -3, 2.4, 6); c.fillStyle = C.wood[1]; c.fillRect(-2.2, -2.6, 1.6, 5.2);
  c.restore();
}

// круглый щит: wood + ржавый железный обод; edge — вид с ребра (E), иначе анфас с умбоном
function skelShield(c, x, y, r, back) {
  const C = SKA_C, INK = C.ink;
  if (!r) {
    c.fillStyle = INK; c.beginPath(); c.ellipse(x + 1.4, y, 2.6, 5.4, 0, 0, 7); c.fill();
    c.fillStyle = C.wood[1]; c.beginPath(); c.ellipse(x + 1.4, y, 1.7, 4.6, 0, 0, 7); c.fill();
    c.fillStyle = C.rust[1]; c.fillRect(x + 0.6, y - 4.4, 1.6, 0.9); c.fillRect(x + 0.6, y + 3.4, 1.6, 0.9);
    return;
  }
  c.fillStyle = INK; c.beginPath(); c.arc(x, y, r + 0.7, 0, 7); c.fill();
  c.fillStyle = C.iron[1]; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();                        // обод
  c.fillStyle = back ? C.wood[2] : C.wood[1]; c.beginPath(); c.arc(x, y, r - 1.1, 0, 7); c.fill();
  if (back) return;
  c.strokeStyle = C.wood[2]; c.lineWidth = 0.6; c.beginPath(); c.moveTo(x - r + 1.2, y); c.lineTo(x + r - 1.2, y); c.moveTo(x, y - r + 1.2); c.lineTo(x, y + r - 1.2); c.stroke();
  c.fillStyle = C.iron[0]; c.beginPath(); c.arc(x, y, 1.3, 0, 7); c.fill();                       // умбон
  c.fillStyle = C.rust[1]; c.fillRect(x - r + 0.6, y + 1.2, 1.6, 1.2); c.fillRect(x + 1.4, y - r + 0.4, 1.8, 1);   // ржавые пятна
  c.fillStyle = INK; c.beginPath(); c.moveTo(x + r - 0.6, y - 2); c.lineTo(x + r - 2.2, y - 1); c.lineTo(x + r - 0.6, y - 0.2); c.fill();   // щербина обода
}

// череп с колпаком; возвращает глазницы для огоньков
function skelHead(c, view, hx2, hy2, P, look, hatC) {
  const C = SKA_C, INK = C.ink, BONE = P.flash ? C.flash : C.bone, BONE2 = C.bone2, jaw = P.jaw;
  const e = view === 'E', back = view === 'N';
  c.fillStyle = INK; c.beginPath(); c.arc(hx2, hy2, 5.4, 0, 7); c.fill();
  c.fillStyle = BONE; c.beginPath(); c.arc(hx2, hy2, 4.5, 0, 7); c.fill();
  if (e) { c.fillStyle = BONE2; c.beginPath(); c.arc(hx2 - 1.6, hy2 + 1.2, 3.2, 0, 7); c.fill(); c.fillStyle = BONE; c.beginPath(); c.arc(hx2 - 0.6, hy2 - 0.4, 3.6, 0, 7); c.fill(); }
  else { c.fillStyle = BONE2; c.beginPath(); c.ellipse(hx2 + 1.8, hy2 + 1.4, 2.4, 3, 0, 0, 7); c.fill(); c.fillStyle = BONE; c.beginPath(); c.arc(hx2 - 0.5, hy2 - 0.3, 3.7, 0, 7); c.fill(); }
  const eyes = [];
  if (!back) {
    c.fillStyle = INK;
    if (e) { c.beginPath(); c.ellipse(hx2 - 1.7, hy2 - 0.4, 1.4, 1.8, 0.2, 0, 7); c.ellipse(hx2 + 1.9, hy2 - 0.4, 1.4, 1.8, -0.2, 0, 7); c.fill(); eyes.push([hx2 - 2, hy2 - 0.8, P.eyeLit], [hx2 + 1.8, hy2 - 0.8, P.eyeLit]); }
    else { c.beginPath(); c.ellipse(hx2 - 1.9, hy2 - 0.4, 1.5, 1.9, 0.2, 0, 7); c.ellipse(hx2 + 1.9, hy2 - 0.4, 1.5, 1.9, -0.2, 0, 7); c.fill(); eyes.push([hx2 - 2.2, hy2 - 0.8, P.eyeLit], [hx2 + 1.6, hy2 - 0.8, P.eyeLit]); }
    c.fillStyle = INK; c.beginPath(); c.moveTo(hx2 + 0.1, hy2 + 0.8); c.lineTo(hx2 + 0.9, hy2 + 2); c.lineTo(hx2 - 0.7, hy2 + 2); c.fill();
    c.fillStyle = INK; c.fillRect(hx2 - 3, hy2 + 2.6, 6.2, 1.2 + jaw);
    c.fillStyle = BONE; for (let i = 0; i < 4; i++) c.fillRect(hx2 - 2.6 + i * 1.5, hy2 + 2.6, 1, 1.4);
    if (jaw > 1.5) { c.fillStyle = BONE2; c.fillRect(hx2 - 2.4, hy2 + 3.8 + jaw - 0.8, 5, 1); }       // нижняя челюсть отвисает
  } else {
    c.strokeStyle = BONE2; c.lineWidth = 0.6; c.beginPath(); c.moveTo(hx2, hy2 - 3.4); c.lineTo(hx2 + 0.8, hy2 + 0.4); c.lineTo(hx2 - 0.4, hy2 + 3.4); c.stroke();
    c.fillStyle = BONE2; c.fillRect(hx2 - 2.6, hy2 + 3.2, 5.4, 1.2);
  }
  // рваный гномий колпак, свисающий кончик с дырой
  c.fillStyle = INK; c.beginPath(); c.moveTo(hx2 - 6.4, hy2 - 2.4); c.quadraticCurveTo(hx2 - 3, hy2 - 11, hx2 + 2, hy2 - 17); c.quadraticCurveTo(hx2 + 6.2, hy2 - 15, hx2 + 8, hy2 - 11); c.lineTo(hx2 + 6.2, hy2 - 3); c.lineTo(hx2 + 3, hy2 - 4.4); c.lineTo(hx2, hy2 - 2.8); c.lineTo(hx2 - 3, hy2 - 4.2); c.closePath(); c.fill();
  const hg = c.createLinearGradient(hx2 - 6, 0, hx2 + 6, 0); hg.addColorStop(0, hatC[0]); hg.addColorStop(1, hatC[1]);
  c.fillStyle = hg; c.beginPath(); c.moveTo(hx2 - 5.4, hy2 - 3); c.quadraticCurveTo(hx2 - 2.4, hy2 - 10.4, hx2 + 2.2, hy2 - 15.6); c.quadraticCurveTo(hx2 + 5.2, hy2 - 14, hx2 + 6.8, hy2 - 10.6); c.lineTo(hx2 + 5.4, hy2 - 3.8); c.lineTo(hx2 + 3, hy2 - 5); c.lineTo(hx2, hy2 - 3.6); c.lineTo(hx2 - 3, hy2 - 4.8); c.closePath(); c.fill();
  c.fillStyle = INK; c.beginPath(); c.ellipse(hx2 + 0.6, hy2 - 9, 1.1, 1.6, 0.4, 0, 7); c.fill();                 // дыра в колпаке
  c.fillStyle = hatC[2]; c.fillRect(hx2 - 6, hy2 - 3.6, 12.2, 1.6);                                              // обтрёпанный край
  // клочья бороды-паутины
  if (!back) {
    c.strokeStyle = 'rgba(206,198,186,0.8)'; c.lineWidth = 0.7;
    for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(hx2 + i * 1.2, hy2 + 4 + jaw * 0.5); c.quadraticCurveTo(hx2 + i * 1.6 + P.hdx * 0.2, hy2 + 7 + jaw * 0.5, hx2 + i * 1.3, hy2 + 9.4 + jaw * 0.5); c.stroke(); }
  }
  return eyes;
}

// кучка костей: p 0..1, кости и череп падают на землю, колпак набок, меч воткнут
function skelPile(c, look, p) {
  const C = SKA_C, INK = C.ink, BONE = C.bone, q = _sm(Math.min(1, p)), fall = (1 - q) * 9;
  c.strokeStyle = BONE; c.lineWidth = 1.6; c.lineCap = 'round';
  for (const [x1, y1, x2, y2] of [[-9, -1, -3, -2], [3, 0, 10, -1.4], [-6, 1, 4, 1.4], [-2, -3, 6, -3.6], [1, 2, -7, 2.4]]) { c.strokeStyle = INK; c.lineWidth = 2.6; c.beginPath(); c.moveTo(x1, y1 * q - fall); c.lineTo(x2, y2 * q - fall); c.stroke(); c.strokeStyle = BONE; c.lineWidth = 1.5; c.stroke(); }
  // рёбра: остатки грудной клетки
  c.strokeStyle = C.bone2; c.lineWidth = 1; for (let r = 0; r < 2; r++) { c.beginPath(); c.ellipse(-1 + r * 2, -2.6 * q - r * 0.8, 3.2, 1.2, 0, Math.PI, 0); c.stroke(); }
  const sx = 8 - q * 3, sy = -2 - (1 - q) * 14;
  c.fillStyle = INK; c.beginPath(); c.arc(sx, sy, 5, 0, 7); c.fill();
  c.fillStyle = BONE; c.beginPath(); c.arc(sx, sy, 4.2, 0, 7); c.fill();
  c.fillStyle = INK; c.fillRect(sx - 1.6, sy - 1.4, 1.6, 1.8); c.fillRect(sx + 1, sy - 1.4, 1.6, 1.8);
  c.fillStyle = C.hat[look & 1][1]; c.beginPath(); c.moveTo(-12, -1); c.lineTo(-7, -5 * q); c.lineTo(-5, 0); c.fill();
  c.fillStyle = INK; c.fillRect(-4.6, -9.6 * q - 0.3, 2.6, 9.6 * q + 0.6); c.fillRect(-6.6, -9.6 * q - 0.3, 6.6, 2);
  c.fillStyle = C.rust[1]; c.fillRect(-4.2, -9.3 * q, 1.8, 9.3 * q); c.fillStyle = C.wood[1]; c.fillRect(-6.2, -9.3 * q, 5.8, 1.4);
}

// ---------- в игре ----------
// вид по движению: юг / восток (запад — зеркало) / север; в покое остаётся последний, по умолчанию — на нас
function skelView(s) {
  if (s._lx !== undefined) {
    const dx = s.x - s._lx, dy = s.y - s._ly;
    if (dx * dx + dy * dy > 4e-6) s._v = Math.abs(dy) > Math.abs(dx) * 1.2 ? (dy < 0 ? 'N' : 'S') : 'E';
  }
  s._lx = s.x; s._ly = s.y;
  return s._v || 'S';
}

function skelFrameOf(s, view) {
  const t = Game.time, st = s.state;
  if (st === 'dead') return ['die', Math.min(SKA.FR.die - 1, Math.floor(s.t / SKA.DIE_DUR * SKA.FR.die)), 'E'];
  const gi = typeof skGrabIndex === 'function' ? skGrabIndex(s) : -1;
  if (gi >= 0) return ['grab', gi, 'E'];
  const sinceHit = t - (s.hitT || -9);
  if (sinceHit >= 0 && sinceHit < SKA.HIT_DUR) return ['hit', Math.min(3, Math.floor(sinceHit / SKA.HIT_DUR * 4)), 'E'];
  const atk = t - (s.atk || -9);
  if (st === 'fight' || atk < SKA.ATK_DUR) {
    if (atk >= 0 && atk < SKA.ATK_DUR) return ['atk', Math.min(8, Math.floor(atk / SKA.ATK_DUR * 9)), 'E'];
    if (st === 'fight') return ['idle', ((Math.floor((t * 2 + s.phase) / 6.2832 * 6) % 6) + 6) % 6, 'E'];
  }
  if (s.scared > 0) return ['atk', 3, 'E'];            // меч над головой, дрожит
  if (s.moving) return ['walk', ((Math.floor(s.phase * 1.4 / 6.2832 * 8) % 8) + 8) % 8, view];
  return ['idle', ((Math.floor((t * 2 + s.phase) / 6.2832 * 6) % 6) + 6) % 6, view];
}

function skelDraw(c, s) {
  const view0 = skelView(s);
  const [pose, frame, view] = skelFrameOf(s, view0);
  const spr = skelSprite(s, view, pose, frame);
  if (!spr) return;
  const f = s.face < 0 ? -1 : 1, dead = s.state === 'dead';
  const px = Math.round(s.x * TILE), py = Math.round(s.y * TILE + 6);
  const k = dead ? 1 : s.k;
  const gi = typeof skGrabIndex === 'function' ? skGrabIndex(s) : -1, gp = gi >= 0 ? skPoseAt(gi) : null;
  c.save();
  c.fillStyle = 'rgba(10,8,4,0.35)'; c.beginPath(); c.ellipse(px, py, (dead ? 9 : 8 * k + 1), 2.4, 0, 0, 7); c.fill();
  if (dead && s.t > 2.4) c.globalAlpha = Math.max(0, 1 - (s.t - 2.4) / 0.8);
  if (gp && gp.behind && s.vsnap) skDrawVictim(c, s, px, py, f, gi, gp, k, 'body');
  c.translate(px, py);
  if (k < 1) { c.beginPath(); c.rect(-22, -42 * k, 52, 44 * k + 2); c.clip(); c.translate(0, (1 - k) * 8); }
  if (s.scared > 0) c.translate(Math.round(Math.sin(Game.time * 50) * 0.8), 0);
  if (view === 'E' && f < 0) c.scale(-1, 1);
  c.imageSmoothingEnabled = false;
  c.drawImage(spr.cv, -SKA.AX, -SKA.AY, SKA.W, SKA.H);
  c.restore();
  if (gp && s.vsnap) skDrawVictim(c, s, px, py, f, gi, gp, k, gp.behind ? 'grip' : undefined);
}
