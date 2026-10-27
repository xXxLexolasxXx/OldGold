'use strict';
// Жаболюды / жаболюды (ЖАБОЛЮДЫ.md): кадры четырёх каст и свайная деревня у воды.
// Тот же конвейер, что у neutralart.js/neutralart2.js: вектор в 3× → пиксели, кэш naCache, кадры строятся лениво.
// Кадры по КАДРЫ.md: покой 6, ходьба 8, прыжок 8, бой 9, удар по нему 4, смерть 6, торжество 4, сон 2;
// синие — ещё метание/трубка 6 (t0…t5), фиолетовые и вождь — колдовство 6 (c0…c5).
// Образ — собственный рисунок: приземистый жаболюд, длинные трёхпалые лапы, золотые глаза, плащ-капюшон, перья у бедра.
// Подключается после neutralart2.js.

NA_FRAMES.jump = ['j0', 'j1', 'j2', 'j3', 'j4', 'j5', 'j6', 'j7'];
NA_FRAMES.throwd = ['t0', 't1', 't2', 't3', 't4', 't5'];
NA_EXTRA.ftG = ['jump', 'sleep'];
NA_EXTRA.ftB = ['jump', 'throwd', 'sleep'];
NA_EXTRA.ftP = ['jump', 'cast', 'sleep'];
NA_EXTRA.ftK = ['jump', 'cast', 'sleep'];
NA_EXTRA.ftR = ['jump', 'cast', 'sleep'];
NA_EXTRA.ftQ = ['jump', 'cast', 'sleep'];
NA_EXTRA.ftZ = ['jump', 'sleep'];

// новые позы: присед (crouch), растяжение в воздухе (air), трубка у рта (pipe), горловой мешок (sac)
const FT_POSE = {
  j0: { crouch: 0.55, eye: 0, a: -0.2 },
  j1: { crouch: 1, y: 0.5, rot: -0.1, eye: 1, a: -0.5, sac: 0.3 },
  j2: { air: 0.55, crouch: 0.2, y: -6, rot: 0.12, eye: 1, a: 0.3 },
  j3: { air: 1, y: -13, rot: 0.1, eye: 0, a: 0.5 },
  j4: { air: 1, y: -17, rot: 0.16, eye: 0, a: 0.4 },
  j5: { air: 0.7, y: -10, rot: 0.3, eye: 1, a: 0.2 },
  j6: { crouch: 0.95, y: 0.6, rot: 0.06, eye: 2, a: 0, sac: 0.2 },
  j7: { crouch: 0.4, eye: 0, a: 0 },
  t0: { pipe: 0.25, a: -0.5, eye: 1, sac: 0.2 },
  t1: { pipe: 0.8, a: -0.3, eye: 1, sac: 0.65, x: -1 },
  t2: { pipe: 1, a: -0.1, eye: 1, sac: 1, x: -1, mouth: 0.1 },
  t3: { pipe: 1, a: 0.6, eye: 1, sac: 0.15, x: 1, rot: 0.06, mouth: 0.1, puff: 1 },
  t4: { pipe: 0.6, a: 0.3, eye: 0, sac: 0.3, x: 1 },
  t5: { pipe: 0.15, a: 0.05, eye: 0, sac: 0.2 },
};
{
  const _np = naPose;
  naPose = function (n) {
    const X = FT_POSE[n];
    if (!X) return _np(n);
    return Object.assign(_np('__'), { crouch: 0, air: 0, pipe: 0, puff: 0, sac: -1 }, X);
  };
}

const FT_PAL = {
  G: { skin: '#8c9c3e', skin2: '#667a2c', belly: '#ecdcaa', belly2: '#cdbb84', cloak: '#6a4430', cloak2: '#472c1f', eye: '#f0b830', mark: '#f6f8ea', fe: ['#c04aa0', '#e8789a', '#5a7ae0'] },
  B: { skin: '#4f9aa6', skin2: '#33707e', belly: '#d6ecd8', belly2: '#a8cdb4', cloak: '#3a5a78', cloak2: '#28405a', eye: '#ffd848', mark: '#e8fbff', fe: ['#38c8e8', '#2a78d8', '#a0f0e0'] },
  P: { skin: '#8a68b0', skin2: '#664890', belly: '#e8d4ee', belly2: '#c4a8d0', cloak: '#4e2e62', cloak2: '#341e44', eye: '#f6d040', mark: '#f4ecff', fe: ['#f070d0', '#a050e8', '#58b8f0'] },
  R: { skin: '#c4573a', skin2: '#8a3424', belly: '#f2d4a4', belly2: '#d4a878', cloak: '#6a2a1a', cloak2: '#42180e', eye: '#ffe040', mark: '#ffd88a', fe: ['#ff5a2a', '#ffa030', '#ffe060'] },
  Q: { skin: '#2f8a52', skin2: '#1f6038', belly: '#eaf2b8', belly2: '#c0d088', cloak: '#5a2a8a', cloak2: '#3a1a5a', eye: '#ff5a3a', mark: '#fff6c0', fe: ['#ffd040', '#c04aa0', '#38c8e8'] },
  // Жабьен (кампания): болотно-оливковый, бурый плащ-капюшон, синее и розовое перо
  Z: { skin: '#8a9a3c', skin2: '#62742a', belly: '#eedcb4', belly2: '#ccb486', cloak: '#5e3a26', cloak2: '#3c2418', eye: '#f2b428', mark: '#f4f6ea', fe: ['#3a8ad8', '#c04aa0', '#e8789a'] },
  K: { skin: '#c4aa3a', skin2: '#8e7a22', belly: '#f6ebb2', belly2: '#d8c680', cloak: '#9a2e22', cloak2: '#6a1e18', eye: '#ff8a28', mark: '#fffbe0', fe: ['#ffd040', '#e84a38', '#fff0a0'] },
};

const ftLerp = (a, b, t) => a + (b - a) * t;

// падение: свой набор поз (общие d0…d5 откидывают тело слишком далеко за границы кадра)
const FT_DEAD = {
  d0: { x: -2, rot: -0.2, hurt: 1, eye: 2, mouth: 0.6 },
  d1: { x: -3, rot: -0.55, hurt: 0.7, eye: 3, a: -0.4 },
  d2: { x: -4, y: 0, rot: -0.95, hurt: 0.4, eye: 3, a: -0.2 },
  d3: { x: -5, y: 0, rot: -1.2, eye: 3, dead: 1, crouch: 0.4, a: 0 },
  d4: { x: -5, y: 0, rot: -1.2, eye: 3, dead: 1, crouch: 0.4, a: 0, fade: 0.45 },
  d5: { x: -5, y: 0, rot: -1.2, eye: 3, dead: 1, crouch: 0.4, a: 0, fade: 0.85 },
};

function drawFrogfolk(c, P, caste, fr) {
  if (FT_DEAD[fr]) P = Object.assign({}, P, FT_DEAD[fr]);
  const T = FT_PAL[caste], k = col => naK(P, col), sleep = !!P.sleep;
  const cr = sleep ? 1 : (P.crouch || 0), air = P.air || 0, sw = sleep ? 0 : P.leg;
  const SK = k(T.skin), SK2 = k(T.skin2), BL = k(T.belly), BL2 = k(T.belly2), CL = k(T.cloak), CL2 = k(T.cloak2);
  const hood = caste === 'G' || caste === 'P' || caste === 'R' || caste === 'Z';
  const ZB = caste === 'Z';
  naShadow(c, air > 0.3 ? 10 : 14);
  c.save();
  c.translate(sleep ? 0 : P.x, sleep ? 0 : P.y);
  if (!sleep) c.rotate(P.rot);
  c.scale(1, P.sq);
  const dy = cr * 3.2;          // присед опускает корпус
  // ---------- дальняя рука и дальняя нога ----------
  const hand = (x, y, col, ground) => {
    ellipse(c, x, y, 2.2, 1.4, col);
    for (const [fx, fy] of [[2.6, 0.6], [2.2, -0.6], [1.6, 1.4]]) naLimb(c, x, y, x + fx + (ground ? 1.2 : 0.4), y + fy, 0.9, col);
  };
  const leg = (xo, near, ph) => {
    const col = near ? SK : SK2, hx = -5 + xo, hy = -10 + dy * 0.55, lift = Math.max(0, ph) * 2.4;
    const kx = ftLerp(hx + 7, hx - 6, air), ky = ftLerp(hy + 0.6, hy + 0.5, air);
    const ax = ftLerp(hx + 0.5 + ph * 3.2, hx - 13, air), ay = ftLerp(-1.9 - lift - cr * 0.3, hy + 3.4, air);
    naLimb(c, hx, hy, kx, ky, 5.4, col);
    ellipse(c, (hx + kx) / 2, (hy + ky) / 2, 4.6, 3.2, col);
    naLimb(c, kx, ky, ax, ay, 3, col);
    if (ZB) { naLimb(c, ftLerp(kx, ax, 0.3), ftLerp(ky, ay, 0.3), ftLerp(kx, ax, 0.72), ftLerp(ky, ay, 0.72), 3.5, near ? CL : CL2); c.strokeStyle = k('#c8a878'); c.lineWidth = 0.45; c.beginPath(); c.moveTo(ftLerp(kx, ax, 0.5) - 1.6, ftLerp(ky, ay, 0.5) - 0.4); c.lineTo(ftLerp(kx, ax, 0.5) + 1.6, ftLerp(ky, ay, 0.5) + 0.4); c.stroke(); }
    // стопа с тремя перепончатыми пальцами
    const fx = ax + ftLerp(5.2, -1, air), fy = ay + ftLerp(0.4, 3.6, air);
    poly(c, [[ax, ay - 0.6], [fx, fy - 1.1], [fx + 1, fy + 0.2], [fx, fy + 1.1], [ax, ay + 1.3]], near ? shade(T.skin, -0.12) : shade(T.skin2, -0.1));
    for (const o of [-1.1, 0, 1.1]) naLimb(c, ax, ay + o * 0.3, fx + 0.8, fy + o, 0.8, col);
  };
  leg(-3, false, -sw);
  const sx = 3.2 + (P.x > 0 ? 0.4 : 0), sy = -17 + dy;      // плечо
  // дальняя рука опирается на длинные пальцы
  {
    const gx = 7 + sw * 1.6, gy = -1.3 - Math.max(0, -sw) * 1.4;
    if (air > 0.3 || P.up > 0.5) { naLimb(c, sx - 2, sy, sx + 5, sy + 3 - air * 6, 2.6, SK2); naLimb(c, sx + 5, sy + 3 - air * 6, sx + 10, sy + 1 - air * 8, 2.2, SK2); hand(sx + 10, sy + 1 - air * 8, SK2, false); }
    else { naLimb(c, sx - 2, sy, sx + 2.4, sy + (gy - sy) * 0.55, 2.6, SK2); naLimb(c, sx + 2.4, sy + (gy - sy) * 0.55, gx, gy, 2.2, SK2); hand(gx, gy, SK2, true); }
  }
  // Жабьен носит за спиной кривую палку с бусинами на шнурке
  if (ZB && !P.dead) {
    naLimb(c, 3, -11 + dy, -7, -36 + dy, 1.3, k('#5a3a22'));
    naLimb(c, -7, -36 + dy, -9.4, -39 + dy, 0.9, k('#5a3a22'));
    c.strokeStyle = k('#c8a878'); c.lineWidth = 0.5; c.beginPath(); c.moveTo(-5.6, -32.4 + dy); c.lineTo(-3.4, -28 + dy + P.wing * 0.3); c.stroke();
    ellipse(c, -3.4, -27.4 + dy + P.wing * 0.3, 0.9, 0.9, k('#2a2a2a')); ellipse(c, -2.4, -26.6 + dy + P.wing * 0.3, 0.8, 0.8, k('#2a2a2a'));
  }
  // ---------- плащ-хвост позади ----------
  if (caste !== 'B' && !P.dead) {
    const wv = P.wing * 0.8;
    const tail = (caste === 'K' || caste === 'Q')
      ? [[-1, -24 + dy], [-8, -23 + dy], [-17, -15 + dy + wv], [-19, -7 + wv], [-14, -3], [-11, -8], [-6, -4], [-3, -12]]
      : [[-2, -25 + dy], [-9, -24 + dy], [-18, -17 + dy + wv], [-21, -9 + wv], [-16, -5], [-13, -9], [-9, -2], [-6, -9], [-3, -12]];
    naBlob(c, tail, CL, 0.2, -0.3);
    c.strokeStyle = CL2; c.lineWidth = 0.9;
    for (const [x0, y0, x1, y1] of [[-8, -20, -14, -9], [-11, -18, -17, -8]]) { c.beginPath(); c.moveTo(x0, y0 + dy * 0.5); c.lineTo(x1, y1); c.stroke(); }
    if (caste === 'K' || caste === 'Q') { c.fillStyle = k('#ffd040'); c.fillRect(-19, -8.4 + P.wing * 0.8, 5, 1.2); }
  }
  // ---------- торс ----------
  const tl = 0.12 + cr * 0.12;
  c.save(); c.translate(0, -13 + dy); c.rotate(tl);
  ellipse(c, 0, 0, 9.6, 8.6, SK);
  ellipse(c, -3, 2, 6.8, 6, SK2);
  ellipse(c, 3.6, 1.6, 5, 6, BL);
  ellipse(c, 4, 3.4, 3.2, 3.2, BL2);
  // племенные знаки: белая руна на груди
  c.strokeStyle = k(T.mark); c.lineWidth = 0.8;
  c.beginPath(); c.moveTo(2.4, -1.6); c.lineTo(4, 0.6); c.lineTo(5.6, -1.6); c.moveTo(4, 0.6); c.lineTo(4, 3.4); c.stroke();
  c.restore();
  // набедренная повязка из шкур с рваным краем и рунами
  poly(c, [[-5.6, -10 + dy * 0.6], [6.4, -10 + dy * 0.6], [7, -4], [5, -5.4], [3.4, -2.6], [1.4, -5.4], [-0.6, -2.4], [-2.4, -5.2], [-4.6, -3], [-6.2, -5]], caste === 'B' ? CL : k('#5a4030'));
  c.fillStyle = k(shade('#5a4030', -0.3)); c.fillRect(-5.8, -10.4 + dy * 0.6, 12.6, 1.2);
  c.strokeStyle = k(T.mark); c.lineWidth = 0.5; c.beginPath(); c.moveTo(0.6, -8); c.lineTo(1.6, -6); c.lineTo(2.6, -8); c.stroke();
  // перья у бедра
  for (const [i, col] of T.fe.entries()) {
    const sway = Math.sin(i + (P.leg || 0) * 1.6) * 1.1;
    c.strokeStyle = k(col); c.lineWidth = 1.1; c.beginPath(); c.moveTo(-1 + i * 1.8, -9.6 + dy * 0.5); c.quadraticCurveTo(-1.4 + i * 1.8 + sway, -5, -1.2 + i * 1.8 + sway * 1.5, -1.8 - (i % 2)); c.stroke();
  }
  // ---------- голова ----------
  const hx = 9.4 + (P.a > 0.5 && caste !== 'P' ? 1.2 : 0) - (P.hurt > 0.5 ? 1.4 : 0), hy = -22.4 + dy * 0.8 + (P.hurt > 0.5 ? 1 : 0) + (cr > 0.8 && sleep ? 1.6 : 0);
  const mo = P.mouth || 0, pipe = P.pipe || 0;
  const sac = P.sac >= 0 ? P.sac : Math.min(1, mo * 0.9 + (P.y < -0.5 ? 0.15 : 0));
  // горловой мешок под челюстью
  ellipse(c, hx + 1.4, hy + 3.6, 4.4 + sac * 3, 2.6 + sac * 3, BL);
  if (sac > 0.45) { c.strokeStyle = k(shade(T.belly, -0.2)); c.lineWidth = 0.5; c.beginPath(); c.arc(hx + 1.4, hy + 3.6, 4.2 + sac * 2.4, 0.4, 2.6); c.stroke(); }
  // голова: широкая, плоская, с бугром-глазом
  ellipse(c, hx, hy, 8.2, 4.9, SK);
  ellipse(c, hx - 2, hy + 1, 5.4, 3.6, SK2);
  ellipse(c, hx + 2.6, hy + 2.2, 6.6, 2.4, BL);                  // кремовая губа/подбородок
  // нижняя челюсть открывается
  const jaw = mo > 0.35 ? 1.2 + mo * 2.6 : 0;
  if (jaw) { poly(c, [[hx - 1, hy + 1.6], [hx + 8.8, hy + 1.2], [hx + 8, hy + 1.6 + jaw], [hx, hy + 2.8 + jaw]], '#3a1a1a'); ellipse(c, hx + 4, hy + 2.4 + jaw * 0.7, 4, 1.1, '#e0707a'); ellipse(c, hx + 3.6, hy + 3.6 + jaw, 6.2, 1.8, BL); }
  else { c.strokeStyle = '#2a1a0a'; c.lineWidth = 0.55; c.beginPath(); c.moveTo(hx - 1, hy + 2); c.quadraticCurveTo(hx + 5, hy + 3, hx + 9.4, hy + 1.6); c.stroke(); }
  ellipse(c, hx + 8.4, hy - 0.2, 0.55, 0.45, '#2a1a0a');         // ноздря
  // золотой глаз с вертикальным зрачком
  const ex = hx + 1.8, ey = hy - 3.5;
  ellipse(c, ex, ey, 3.1, 3, SK);
  if (P.eye === 2) { c.strokeStyle = '#1a0f0a'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(ex - 2, ey + 0.4); c.quadraticCurveTo(ex, ey + 1.6, ex + 2.2, ey + 0.4); c.stroke(); }
  else if (P.eye === 3) naEye(c, ex, ey, P);
  else {
    ellipse(c, ex, ey, 2.3, 2.2, k(T.eye));
    c.fillStyle = '#1a0f0a'; c.fillRect(ex + 0.1 - 0.35, ey - 1.5, 0.75, 3);
    c.fillStyle = 'rgba(255,255,240,0.85)'; c.fillRect(ex - 1.2, ey - 1.4, 0.8, 0.8);
    if (P.eye === 1) { c.strokeStyle = SK2; c.lineWidth = 1.1; c.beginPath(); c.moveTo(ex - 2.8, ey - 2.2); c.lineTo(ex + 2.6, ey - 0.6); c.stroke(); }
  }
  // знаки на щеке и кольца-серьги
  c.strokeStyle = k(T.mark); c.lineWidth = 0.55;
  for (const [x0, y0, x1, y1] of [[hx - 3.6, hy - 0.6, hx - 1.6, hy + 1.4], [hx - 2.6, hy - 1.4, hx - 0.8, hy + 0.6]]) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
  if (ZB && !jaw) for (const fx of [3.4, 6]) poly(c, [[hx + fx - 0.6, hy + 2.4], [hx + fx + 0.6, hy + 2.3], [hx + fx + 0.1, hy + 4.4]], k('#efe6cc'));       // клычки из-под губы
  if (caste === 'G' || caste === 'P' || ZB) for (let i = 0; i < 3; i++) { c.strokeStyle = k('#d8c070'); c.lineWidth = 0.5; c.beginPath(); c.arc(hx + 0.4 + i * 1.5, hy + 3.2 - i * 0.2, 0.8, 0, 7); c.stroke(); }
  // ---------- головной убор по касте ----------
  if (hood) {
    naBlob(c, [[hx - 12, hy + 7], [hx - 11, hy - 2], [hx - 6, hy - 8], [hx + 1, hy - 9.4], [hx + 7.4, hy - 7.4], [hx + 9.6, hy - 5], [hx + 5.4, hy - 5.6], [hx - 0.4, hy - 5], [hx - 4.4, hy - 1], [hx - 6, hy + 3]], CL, 0.08, -0.3);
    c.strokeStyle = CL2; c.lineWidth = 0.8; c.beginPath(); c.moveTo(hx - 6, hy - 7); c.quadraticCurveTo(hx - 2, hy - 5, hx + 0.4, hy - 8); c.stroke();
    poly(c, [[hx - 12, hy + 4], [hx - 15, hy + 9 + P.wing * 0.6], [hx - 13, hy + 7], [hx - 11, hy + 11], [hx - 9.4, hy + 6]], CL2);       // лохмотья
    if (caste === 'P' || caste === 'R') { c.strokeStyle = k(caste === 'P' ? '#7ad8ff' : '#ffb040'); c.lineWidth = 0.7; c.beginPath(); c.moveTo(hx - 9, hy - 3); c.quadraticCurveTo(hx - 12, hy + 2, hx - 11, hy + 6); c.stroke(); }
  } else if (caste === 'B') {
    c.fillStyle = k('#3a5a78'); c.fillRect(hx - 5.6, hy - 5.6, 11, 1.6);
    for (const [i, col] of T.fe.entries()) {
      const a = -2.4 + i * 0.28 + P.wing * 0.05;
      c.strokeStyle = k(col); c.lineWidth = 1.3; c.beginPath(); c.moveTo(hx - 3.6 + i * 0.6, hy - 5.4); c.quadraticCurveTo(hx - 7 + Math.cos(a) * 4, hy - 9 + i, hx - 8 + Math.cos(a) * 7, hy - 8.4 + i * 2.2); c.stroke();
    }
  } else {
    const kingC = caste === 'Q';
    for (let i = 0; i < 5; i++) {
      const x = hx - 5.4 + i * 2.7;
      poly(c, [[x - 1.2, hy - 5.2], [x, hy - 9.4 - (i % 2) * 1.6 - (kingC ? 3 + (i === 2 ? 2 : 0) : 0)], [x + 1.2, hy - 5.2]], k('#ffd040'));
      if (kingC) ellipse(c, x, hy - 9.6 - (i % 2) * 1.6 - (i === 2 ? 2 : 0) , 0.8, 0.8, k(['#e84a38', '#38c8e8', '#7ad830', '#38c8e8', '#e84a38'][i]));
    }
    c.fillStyle = k('#c8901a'); c.fillRect(hx - 6, hy - 5.6, 12.4, 1.4);
    ellipse(c, hx + 1, hy - 5.6, 0.9, 0.9, '#e84a38');
  }
  // ---------- ближняя рука и оружие ----------
  const r0 = [sx + 9, sy + 6], wnd = [sx - 3.5, sy + 1], str = [sx + 14, sy - 0.5];
  let H;
  if (air > 0.3) H = [sx + 6, sy - 2 - air * 4];
  else if (P.up > 0.5) H = [sx + 4, sy - 14 + (1 - P.up) * 6];
  else if (P.b > 0.5) H = [sx + 8, sy - 2.5];
  else if (P.cast > 0 && (caste === 'P' || caste === 'K' || caste === 'R' || caste === 'Q')) H = [sx + 8 + P.cast * 2, sy - 7 - P.cast * 5];
  else if (pipe > 0) H = [hx + 5 - pipe * 1, hy + 4 + (1 - pipe) * 4];
  else if (P.a < 0) H = [ftLerp(r0[0], wnd[0], -P.a), ftLerp(r0[1], wnd[1], -P.a)];
  else H = [ftLerp(r0[0], str[0], Math.min(1, P.a)), ftLerp(r0[1], str[1], Math.min(1, P.a))];
  const el = [(sx + H[0]) / 2 - 0.5, (sy + H[1]) / 2 + 2.2];
  naLimb(c, sx, sy, el[0], el[1], 2.8, SK); naLimb(c, el[0], el[1], H[0], H[1], 2.4, SK);
  if (ZB) naLimb(c, ftLerp(el[0], H[0], 0.25), ftLerp(el[1], H[1], 0.25), ftLerp(el[0], H[0], 0.7), ftLerp(el[1], H[1], 0.7), 2.9, CL);
  hand(H[0], H[1], SK, false);
  // оружие: угол φ (0 → вперёд, π/2 → вниз)
  let phi;
  if (air > 0.3) phi = -0.6;
  else if (P.up > 0.5) phi = -1.35;
  else if (P.b > 0.5) phi = -1.9;
  else if (P.a < 0) phi = ftLerp(-1.25, (caste === 'P' || caste === 'R') ? -2.5 : -0.4, -P.a);
  else phi = ftLerp(-1.25, (caste === 'P' || caste === 'R') ? 0.25 : 0.06, Math.min(1, P.a));
  const dx = Math.cos(phi), dyv = Math.sin(phi), px = -dyv, py = dx;
  const W = (a, b2) => [H[0] + dx * a, H[1] + dyv * a];
  if (caste === 'G' || caste === 'K' || caste === 'Q') {
    const L0 = caste === 'Q' ? -14 : caste === 'K' ? -10 : -9, L1 = caste === 'Q' ? 22 : caste === 'K' ? 17 : 14;
    const b0 = W(L0), b1 = W(L1);
    naLimb(c, b0[0], b0[1], b1[0], b1[1], caste === 'Q' ? 1.9 : caste === 'K' ? 1.5 : 1.3, k(caste === 'Q' ? '#4a3220' : '#7a5632'));
    if (caste === 'G') {
      const t = W(L1 + 6);
      poly(c, [[b1[0] + px * 1.5, b1[1] + py * 1.5], [t[0], t[1]], [b1[0] - px * 1.5, b1[1] - py * 1.5], [b1[0] - dx * 1.4, b1[1] - dyv * 1.4]], k('#b8b4a0'));
      c.fillStyle = k('#7ad830'); const dr = P.a > 0.5 ? 1.8 : 0.9; c.fillRect(t[0] - 0.5, t[1] + dr, 1, 1.4);
      for (const o of [-3, 0]) { const q = W(L1 - 3 + o); c.strokeStyle = k('#c04aa0'); c.lineWidth = 0.9; c.beginPath(); c.moveTo(q[0], q[1]); c.lineTo(q[0] + px * 2 - dx, q[1] + py * 2 - dyv); c.stroke(); }
    } else if (caste === 'Q') {      // королевская алебарда: серп-лезвие, зубцы, светящийся самоцвет
      const t = W(L1 + 9), m1 = W(L1 + 2), m2 = W(L1 - 3);
      poly(c, [[m2[0] + px * 1.4, m2[1] + py * 1.4], [m1[0] + px * 6, m1[1] + py * 6], [t[0] + px * 3.4, t[1] + py * 3.4], [t[0], t[1]], [m1[0] + px * 1.2, m1[1] + py * 1.2]], k('#d8dce8'));
      poly(c, [[m2[0] - px * 1.4, m2[1] - py * 1.4], [m1[0] - px * 4.4, m1[1] - py * 4.4], [m1[0] - px * 1.2, m1[1] - py * 1.2]], k('#aab0c4'));
      naLimb(c, t[0], t[1], W(L1 + 14)[0], W(L1 + 14)[1], 1.3, k('#ffd040'));
      naLimb(c, b1[0] + px * 3, b1[1] + py * 3, b1[0] - px * 3, b1[1] - py * 3, 1.2, k('#ffd040'));
      const gem = W(L1 - 4), gl = P.cast > 0 ? P.cast : 0.3;
      ellipse(c, gem[0], gem[1], 1.6, 1.6, k('#7ae8a0'));
      c.save(); c.globalCompositeOperation = 'lighter'; ellipse(c, gem[0], gem[1], 3 + gl * 5, 3 + gl * 5, `rgba(120,255,170,${0.15 + gl * 0.4})`); c.restore();
      const q = W(L1 - 8); for (const [i, col] of T.fe.entries()) { c.strokeStyle = k(col); c.lineWidth = 1.1; c.beginPath(); c.moveTo(q[0], q[1]); c.lineTo(q[0] + px * (i - 1) * 2.4 - dx * 2, q[1] + py * (i - 1) * 2.4 - dyv * 2 + 3); c.stroke(); }
    } else {      // тройной наконечник с золотом
      const t = W(L1 + 7), tl2 = W(L1 + 3.6);
      for (const o of [-2.2, 0, 2.2]) naLimb(c, b1[0] + px * o * 0.6, b1[1] + py * o * 0.6, (o ? tl2[0] : t[0]) + px * o, (o ? tl2[1] : t[1]) + py * o, 1, k('#ffd040'));
      naLimb(c, b1[0] + px * 2.2, b1[1] + py * 2.2, b1[0] - px * 2.2, b1[1] - py * 2.2, 1, k('#c8901a'));
      const q = W(L1 - 3); for (const [i, col] of T.fe.entries()) { c.strokeStyle = k(col); c.lineWidth = 1; c.beginPath(); c.moveTo(q[0], q[1]); c.lineTo(q[0] + px * (i - 1) * 2 - dx * 2, q[1] + py * (i - 1) * 2 - dyv * 2 + 2); c.stroke(); }
    }
    if (P.a > 0.6) { c.strokeStyle = 'rgba(255,255,230,0.75)'; c.lineWidth = 0.8; const q = W(L1 + 9); c.beginPath(); c.moveTo(q[0] - 2, q[1] - 5); c.lineTo(q[0] + 4, q[1] - 4); c.moveTo(q[0] - 2, q[1] + 5); c.lineTo(q[0] + 4, q[1] + 4); c.stroke(); }
  } else if (caste === 'B') {
    // духовая трубка на спине и дротик в руке; у рта — в кадрах t0…t5
    if (pipe > 0) {
      const mx = hx + 8.4, my = hy + 2.4, len = 14;
      naLimb(c, mx - 2, my, mx + len, my - 0.4, 1.6, k('#a88a52')); naLimb(c, mx - 2, my - 0.5, mx + len, my - 0.9, 0.5, k('#d8c488'));
      c.fillStyle = k('#5a3a20'); c.fillRect(mx + 3, my - 1.2, 1, 2.2); c.fillRect(mx + 8, my - 1.2, 1, 2.2);
      if (P.puff) { for (const [x, y, r] of [[mx + len + 2, my - 0.6, 1.6], [mx + len + 5, my - 1.4, 1.2], [mx + len + 7.4, my - 0.4, 0.8]]) { c.fillStyle = 'rgba(210,235,215,0.7)'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); } naLimb(c, mx + len + 1, my - 0.6, mx + len + 9, my - 0.9, 0.7, k('#7ad830')); }
    } else {
      naLimb(c, -8, -24 + dy, 6, -21 + dy, 1.4, k('#a88a52'));            // трубка за спиной
      const t = W(8), b0 = W(-4);
      naLimb(c, b0[0], b0[1], t[0], t[1], 0.8, k('#c8b484'));
      poly(c, [[t[0] + px * 0.9, t[1] + py * 0.9], [t[0] + dx * 3.6, t[1] + dyv * 3.6], [t[0] - px * 0.9, t[1] - py * 0.9]], k('#7ad830'));
      if (P.a > 0.8) { c.strokeStyle = 'rgba(255,255,230,0.7)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(t[0] + 4, t[1] - 3); c.lineTo(t[0] + 10, t[1] - 2.4); c.moveTo(t[0] + 4, t[1] + 3); c.lineTo(t[0] + 10, t[1] + 2.4); c.stroke(); }
    }
  } else {
    // посох с кривым набалдашником из переплетённого дерева, бусины и перья — как у шамана на рисунке
    const b0 = W(-15), b1 = W(19);
    naLimb(c, b0[0], b0[1], b1[0], b1[1], 1.7, k('#6a4430'));
    naLimb(c, b0[0] - 0.5, b0[1], b1[0] - 0.5, b1[1], 0.6, k('#9a6a44'));
    const qx = b1[0], qy = b1[1];
    c.strokeStyle = k('#5a3624'); c.lineWidth = 1.9; c.beginPath(); c.moveTo(qx, qy); c.bezierCurveTo(qx + px * 4 + dx * 3, qy + py * 4 + dyv * 3, qx + px * 5 + dx * 7, qy + py * 5 + dyv * 7, qx + px * 1.2 + dx * 7, qy + py * 1.2 + dyv * 7); c.stroke();
    c.beginPath(); c.arc(qx + dx * 4 + px * 1.6, qy + dyv * 4 + py * 1.6, 1.8, 0, 6); c.stroke();
    for (const [i, col] of T.fe.entries()) { c.strokeStyle = k(col); c.lineWidth = 0.9; const q = W(11 - i * 2.2); c.beginPath(); c.moveTo(q[0], q[1]); c.lineTo(q[0] - px * 2.2 + dx * 0.4, q[1] - py * 2.2 + 3.6 + i); c.stroke(); }
    for (const o of [6, 8.4]) { const q = W(o); ellipse(c, q[0] + px * 1.4, q[1] + py * 1.4, 0.8, 0.8, k('#e8e0c8')); }
    if (ZB) {          // у Жабьена посох простой, без колдовского огня; обмотка у кулака
      naLimb(c, W(-2)[0], W(-2)[1], W(3)[0], W(3)[1], 2.6, CL);
      if (P.a > 0.5) { c.strokeStyle = 'rgba(255,255,230,0.75)'; c.lineWidth = 0.8; c.beginPath(); c.arc(H[0], H[1], 20, phi - 1.3, phi - 0.2); c.stroke(); }
    } else {
    const gx = qx + dx * 5, gy = qy + dyv * 5;
    const el = caste === 'R' ? '255,140,40' : '110,200,255', hot = caste === 'R' ? '255,230,120' : '230,250,255';
    const gl = P.cast > 0 ? P.cast : (P.a > 0.3 ? 0.5 : 0.18);
    c.save(); c.globalCompositeOperation = 'lighter';
    ellipse(c, gx, gy, 2.4 + gl * 5, 2.4 + gl * 5, `rgba(${el},${0.18 + gl * 0.45})`);
    ellipse(c, gx, gy, 1.5, 1.5, `rgba(${hot},0.9)`);
    if (caste === 'R') { for (const [i, o] of [[0, -4], [1, 0], [2, 3]]) poly(c, [[gx + o - 1.2, gy - 1], [gx + o, gy - 4.5 - gl * 4 - i], [gx + o + 1.2, gy - 1]], `rgba(255,${120 + i * 40},30,${0.4 + gl * 0.4})`); }
    else if (gl > 0.25) { c.strokeStyle = `rgba(${hot},0.9)`; c.lineWidth = 0.7; for (let z = 0; z < 3; z++) { const a = z * 2.1 + gl * 4; c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx + Math.cos(a) * 4, gy + Math.sin(a) * 4 - 1); c.lineTo(gx + Math.cos(a + 0.5) * 7, gy + Math.sin(a + 0.5) * 6 - 1); c.stroke(); } }
    c.restore();
    if (P.a > 0.5 && !P.cast) { c.strokeStyle = 'rgba(255,255,230,0.75)'; c.lineWidth = 0.8; c.beginPath(); c.arc(H[0], H[1], 20, phi - 1.3, phi - 0.2); c.stroke(); }
    }
  }
  leg(2, true, sw);
  if (caste === 'Q' && P.cast > 0) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let r = 0; r < 3; r++) { c.strokeStyle = `rgba(140,255,170,${0.5 * P.cast * (1 - r * 0.25)})`; c.lineWidth = 1; c.beginPath(); c.ellipse(2, -10, 14 + r * 6 + P.cast * 6, 6 + r * 2.4 + P.cast * 2, 0, 0, 7); c.stroke(); }
    c.restore();
  }
  // яд-капли и знаки поверх кожи у шаманов светятся
  if ((caste === 'P' || caste === 'R') && !P.dead) {
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(${caste === 'R' ? '255,190,90' : '150,220,255'},${0.25 + (P.cast || 0) * 0.5})`;
    c.fillRect(hx - 3.6, hy - 0.8, 1.2, 2.4); c.fillRect(hx - 2.2, hy - 1.6, 1.2, 2.4); c.restore();
  }
  // парирование: подставил копьё/посох
  if (P.b > 0.5) { c.strokeStyle = 'rgba(220,230,200,0.85)'; c.lineWidth = 1; c.beginPath(); c.arc(H[0] + 2, H[1] - 6, 9, -1.2, 1.2); c.stroke(); }
  // сон: пузырёк Z
  if (sleep) {
    const zo = P.sleep === 2 ? -3 : 0;
    c.strokeStyle = 'rgba(235,245,255,0.95)'; c.lineWidth = 0.9;
    for (const [i, s] of [[0, 2], [1, 3]]) { const zx = hx + 7 + i * 5, zy = hy - 9 - i * 5 + zo * (i ? 0.5 : 1); c.beginPath(); c.moveTo(zx - s, zy - s); c.lineTo(zx + s, zy - s); c.lineTo(zx - s, zy + s); c.lineTo(zx + s, zy + s); c.stroke(); }
  }
  // рёв: брызги слюны, вспышка
  if (P.mouth > 0.9) for (const [x, y] of [[hx + 11, hy - 1], [hx + 12.6, hy + 1.8]]) { c.fillStyle = 'rgba(255,255,255,0.8)'; c.fillRect(x, y, 2, 0.8); }
  c.restore();
}

NA_SPEC.ftG = { name: 'Жаболюд-копейщик', w: 116, h: 84, ax: 44, ay: 66, sc: 1.2 };
NA_SPEC.ftB = { name: 'Жаболюд-охотник', w: 116, h: 84, ax: 44, ay: 66, sc: 1.2 };
NA_SPEC.ftP = { name: 'Жаболюд-громовик', w: 116, h: 96, ax: 44, ay: 80, sc: 1.22 };
NA_SPEC.ftR = { name: 'Жаболюд-огнемаг', w: 116, h: 96, ax: 44, ay: 80, sc: 1.22 };
NA_SPEC.ftQ = { name: 'Король жаболюдов', w: 190, h: 150, ax: 74, ay: 128, sc: 1.85 };
NA_SPEC.ftK = { name: 'Вождь жаболюдов', w: 128, h: 92, ax: 48, ay: 74, sc: 1.4 };
NA_DRAW.ftG = (c, P, f) => drawFrogfolk(c, P, 'G', f);
NA_DRAW.ftB = (c, P, f) => drawFrogfolk(c, P, 'B', f);
NA_DRAW.ftP = (c, P, f) => drawFrogfolk(c, P, 'P', f);
NA_DRAW.ftR = (c, P, f) => drawFrogfolk(c, P, 'R', f);
NA_DRAW.ftQ = (c, P, f) => drawFrogfolk(c, P, 'Q', f);
NA_DRAW.ftK = (c, P, f) => drawFrogfolk(c, P, 'K', f);
NA_SPEC.ftZ = { name: 'Жабьен', w: 94, h: 66, ax: 44, ay: 54, sc: 1.24 };   // при мелком пикселе — ручной пиксель (campaign/zhabpx.js)
NA_DRAW.ftZ = (c, P, f) => drawFrogfolk(c, P, 'Z', f);

// =============== Свайная деревня у воды ===============
NA_LAIR.ftvil = { name: 'Свайная деревня жаболюдов', w: 140, h: 100, ax: 70, ay: 60 };
{
  const _lair = naLairDraw;
  naLairDraw = function (c, kind, v) {
    if (kind !== 'ftvil') return _lair(c, kind, v);
    ftVillage(c, v === 'd', v === '1' ? 1 : 0);
  };
}

function ftVillage(c, dead, f) {
  // берег и пруд (у настоящей воды деревня и стоит, но пруд нарисован сам — на любой карте)
  c.fillStyle = dead ? '#5a5238' : '#4a5a30'; c.beginPath(); c.ellipse(0, 4, 58, 15, 0, 0, 7); c.fill();
  const WT = dead ? '#6a6a50' : '#3f7a78', WT2 = dead ? '#55553e' : '#2e5e60';
  c.fillStyle = dead ? '#4a4a34' : '#7a6a44'; c.beginPath(); c.ellipse(0, 7, 50, 12.4, 0, 0, 7); c.fill();         // илистый берег
  c.fillStyle = WT; c.beginPath(); c.ellipse(0, 7, 45, 10.4, 0, 0, 7); c.fill();
  c.fillStyle = WT2; c.beginPath(); c.ellipse(5, 9, 34, 6.4, 0, 0, 7); c.fill();
  if (dead) {                                  // пруд пересох: трещины ила
    c.strokeStyle = '#3a3a28'; c.lineWidth = 0.7;
    for (const [x0, y0, x1, y1] of [[-30, 6, -14, 10], [-14, 10, 2, 7], [2, 7, 16, 11], [16, 11, 34, 8], [-6, 10, -8, 15]]) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
  } else {
    c.strokeStyle = 'rgba(200,240,235,0.55)'; c.lineWidth = 0.7;
    for (const [x, y, w] of [[-24, 5 + f * 0.8, 6], [8, 11 - f * 0.8, 7], [28, 7 + f * 0.6, 5], [-8, 8, 4]]) { c.beginPath(); c.ellipse(x, y, w, w * 0.28, 0, 0, 7); c.stroke(); }
    // кувшинки
    for (const [x, y, w, fl] of [[-34, 8, 5, 1], [-16, 13, 4.4, 0], [20, 13, 5.4, 1], [36, 6, 4, 0], [2, 4, 3.6, 0]]) {
      ellipse(c, x, y, w, w * 0.4, dead ? '#6a7a3a' : '#4aa040'); poly(c, [[x, y], [x + w, y - 0.6], [x + w, y + 0.8]], WT2);
      if (fl && !dead) { for (let n = 0; n < 5; n++) { const a = n / 5 * 6.28; ellipse(c, x + Math.cos(a) * 1.7, y - 1.6 + Math.sin(a) * 0.9, 1.1, 0.8, '#f8b8d8'); } ellipse(c, x, y - 1.6, 0.9, 0.7, '#ffe070'); }
    }
  }
  // хижина на сваях: круглая крыша из тростника
  const hut = (x, y, s, col) => {
    const SW = dead ? '#5a4a34' : '#7a5a34';
    for (const dx of [-8, -3, 3, 8]) naLimb(c, x + dx * s, y - 1 * s, x + dx * s, y + 11 * s, 1.5 * s, SW);       // сваи
    c.fillStyle = dead ? '#4a3a24' : '#5a4228'; c.fillRect(x - 12 * s, y - 2 * s, 24 * s, 2.6 * s);                // помост
    naBlob(c, [[x - 10 * s, y - 2 * s], [x - 10 * s, y - 14 * s], [x + 10 * s, y - 14 * s], [x + 10 * s, y - 2 * s]], dead ? '#7a6a4a' : '#a88a5a', 0.2, -0.3);
    naBlob(c, [[x - 14 * s, y - 13 * s], [x - 9 * s, y - 20 * s], [x - 2 * s, y - 26 * s], [x + 2 * s, y - 26 * s], [x + 9 * s, y - 20 * s], [x + 14 * s, y - 13 * s]], dead ? '#8a8458' : col, 0.3, -0.34);
    c.strokeStyle = dead ? '#6a643e' : shade(col, -0.3); c.lineWidth = 0.7 * s; for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(x + i * 3.6 * s, y - 13.4 * s); c.lineTo(x + i * 1.3 * s, y - 25 * s); c.stroke(); }
    if (dead) poly(c, [[x - 3 * s, y - 2 * s], [x - 3 * s, y - 9 * s], [x + 3 * s, y - 9 * s], [x + 3 * s, y - 2 * s]], '#1a120a');
    else { ellipse(c, x, y - 7 * s, 3.4 * s, 4 * s, '#1c120a'); ellipse(c, x, y - 6.6 * s, 2 * s, 2.4 * s, f ? '#ffd870' : '#f0c050'); }       // тёплое окно-вход
    // мостки к берегу
    c.fillStyle = dead ? '#4a3a24' : '#6a4a2a'; c.fillRect(x + 11 * s, y - 1 * s, 8 * s, 1.8 * s);
  };
  hut(-26, -2, 1, dead ? '#8a8458' : '#c8b060');
  hut(26, -4, 0.86, dead ? '#8a8458' : '#8aa860');
  // тотем с черепом жабы и яркими перьями
  const tx = 2, ty = 12;
  naLimb(c, tx, ty, tx, ty - 32, 3, dead ? '#5a4a34' : '#6a4a2a'); naLimb(c, tx - 1, ty, tx - 1, ty - 32, 0.8, dead ? '#7a6a4a' : '#9a7040');
  ellipse(c, tx, ty - 33, 5, 4, dead ? '#b8b09a' : '#e6dcc0');
  c.fillStyle = '#1a120a'; c.fillRect(tx - 3, ty - 35, 2.2, 2.6); c.fillRect(tx + 1, ty - 35, 2.2, 2.6); c.fillRect(tx - 1, ty - 31.4, 2, 1);
  if (!dead) for (const [i, col] of ['#c04aa0', '#5a7ae0', '#ffd040', '#38c8e8'].entries()) { c.strokeStyle = col; c.lineWidth = 1.3; c.beginPath(); c.moveTo(tx - 4 + i * 2.6, ty - 36); c.quadraticCurveTo(tx - 7 + i * 4.6, ty - 44 + (i % 2) * 2, tx - 8 + i * 5.4 + f * (i % 2 ? 1 : -1), ty - 41 + (i % 2) * 4); c.stroke(); }
  // камыш и рогоз
  for (const [x, y, h] of [[-46, 8, 18], [-42, 12, 13], [44, 10, 16], [48, 6, 20], [-6, 16, 10], [14, 17, 9]]) {
    c.strokeStyle = dead ? '#8a8458' : '#5a8a3a'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 1, y - h * 0.6, x + 0.4 + f * 0.8, y - h); c.stroke();
    if (!dead) { c.fillStyle = '#6a4228'; c.fillRect(x + f * 0.8 - 0.6, y - h - 0.2, 1.6, 3.6); }
  }
  // сушилка со шкурками и связка перьев; свечение светлячков
  if (!dead) {
    naLimb(c, -50, 4, -50, -8, 1.2, '#6a4a2a'); naLimb(c, -40, 4, -40, -8, 1.2, '#6a4a2a'); naLimb(c, -51, -7, -39, -7, 1.2, '#6a4a2a');
    for (const [x, col] of [[-48, '#a88a62'], [-44, '#8a6a48'], [-41.6, '#b89a6a']]) poly(c, [[x - 1.6, -6.4], [x + 1.6, -6.4], [x + 1.2, 0], [x, 1.6], [x - 1.2, 0]], col);
    naSparks(c, [[-14, -16, f], [18, -22, 2 + f], [34, -10, 4], [-34, -22, 1]], f * 1.3, 'rgba(190,255,150,A)');
    naPuff(c, 26 + f * 2, -34 - f * 2, 2, 'rgba(210,220,210,A)', 0.2);
  } else {
    naLimb(c, 20, 14, 30, 12, 1.2, '#e8e0c8'); naLimb(c, -36, 15, -30, 16, 1.2, '#e8e0c8');
    ellipse(c, 12, 13, 2.2, 1.7, '#d8d0b8');
  }
}
