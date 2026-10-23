'use strict';
// Слуги Малгора в пиксель-арте: прислужник и рыцарь тьмы, ворон-разведчик, сам Малгор, костяной прислужник,
// пятеро стражей шпиля (огонь, лёд, кости, тени, голем) и ожившая глыба кампании.
// Раньше они рисовались прямоугольниками прямо на холсте; теперь — вектор → toPixelArt через общий
// конвейер нейтралов (naFrame, кадры naPose), поэтому получают и мелкий пиксель PX_FINE (pixel.js).
// Логика врагов не тронута: подменяются только функции рисования, свечения остаются векторными поверх.

const FOE_C = {
  ink: '#0e0a1e', void: '#07050f', robe: '#2a2452', robe2: '#1c1838', robe3: '#4a3e88', trim: '#6a5ab8',
  green: '#9cff66', green2: '#3a8a30', steel: '#c8c4e0', steel2: '#8a82a8', boot: '#161230',
};

// общая фигура латника: ноги, плащ, торс, наплечники; возвращает точки плеч и головы
function foeKnightBody(c, P, o) {
  const k = col => naK(P, col), sw = P.leg, B = o.big || 1;
  // плащ за спиной: рваный подол колышется на ходу
  if (o.cape) {
    const fl = sw * 1.4;
    poly(c, [[-4.6 * B, -19], [3 * B, -19], [2 * B, -6], [-1 * B - fl, -2], [-3 * B - fl, -4], [-5 * B - fl, -1.4], [-7 * B - fl, -5]], k(o.cape));
    poly(c, [[-4.6 * B, -19], [-1.6 * B, -19], [-3 * B - fl, -4], [-5 * B - fl, -1.4], [-7 * B - fl, -5]], k(shade(o.cape, -0.25)));
  }
  // ноги: поножи и сапоги
  if (!o.noLegs) for (const [sx, col] of [[-1, o.leg2], [1, o.leg]]) {
    const fx = sx * 1.8 * B + sx * sw * 2.6;
    naLimb(c, sx * 1.8 * B, -9, fx, -1.6, 2.4 * B, k(col));
    poly(c, [[fx - 1.6 * B, -2.6], [fx + 2.6 * B, -2.2], [fx + 2.8 * B, 0.2], [fx - 1.8 * B, 0.2]], k(o.boot || FOE_C.boot));
  }
  // торс: кираса со светлой гранью и поясом
  const tw = 4.6 * B, ty = -9.5, th = 10.5;
  poly(c, [[-tw, ty], [tw, ty], [tw + 0.8, ty - th + 1], [tw - 0.4, ty - th], [-tw + 0.4, ty - th], [-tw - 0.8, ty - th + 1]], k(o.body));
  poly(c, [[tw * 0.2, ty], [tw, ty], [tw + 0.8, ty - th + 1], [tw - 0.4, ty - th], [tw * 0.3, ty - th]], k(o.body2));
  c.strokeStyle = k(o.rim); c.lineWidth = 0.6;
  c.beginPath(); c.moveTo(-tw + 0.6, ty - th + 0.6); c.lineTo(tw - 0.6, ty - th + 0.6); c.stroke();
  if (o.belt) { c.fillStyle = k(o.belt); c.fillRect(-tw, ty - 1.6, tw * 2, 1.3); c.fillStyle = k(FOE_C.green); c.fillRect(-0.8, ty - 1.8, 1.6, 1.7); }
  // наплечники
  for (const [sx, col] of [[-1, o.body], [1, o.body2]]) {
    ellipse(c, sx * (tw + 0.4), ty - th + 1.2, 2.4 * B, 1.8 * B, k(col));
    c.fillStyle = k(o.rim); c.fillRect(sx * (tw + 0.4) - 1.4 * B, ty - th - 0.2, 2.6 * B, 0.6);
  }
  return { sh: [tw - 0.2, ty - th + 2.2], bsh: [-tw + 0.4, ty - th + 2.2], neck: [0, ty - th] };
}

// угол руки по позе: замах назад и вверх, удар вперёд, колдовство вверх
function foeArmAng(P) { return P.up > 0.5 ? -2.9 : P.a > 0 ? 0.8 + P.a * 0.8 : 0.4 + P.a * 1.3; }

// клинок из кулака по направлению ang
function foeBlade(c, P, hx, hy, ang, L, w, col, edge, glow) {
  const k = cc => naK(P, cc), [bx, by] = naDir(ang);
  poly(c, [[hx - by * w, hy + bx * w], [hx + bx * L, hy + by * L], [hx + by * w, hy - bx * w]], k(col));
  c.strokeStyle = k(edge); c.lineWidth = 0.55;
  c.beginPath(); c.moveTo(hx + by * w * 0.4, hy - bx * w * 0.4); c.lineTo(hx + bx * L * 0.96, hy + by * L * 0.96); c.stroke();
  if (glow && P.a > 0.5) { c.fillStyle = 'rgba(156,255,102,0.35)'; c.beginPath(); c.arc(hx + bx * L * 0.6, hy + by * L * 0.6, 3, 0, 7); c.fill(); }
  poly(c, [[hx - by * (w + 1.6), hy + bx * (w + 1.6)], [hx + by * (w + 1.6), hy - bx * (w + 1.6)], [hx + by * (w + 1.6) + bx, hy - bx * (w + 1.6) + by], [hx - by * (w + 1.6) + bx, hy + bx * (w + 1.6) + by]], k(FOE_C.trim));
}

// глаза-огоньки в прорези: пара ярких точек с ореолом
function foeEyeGlow(c, P, x, y, col, gap = 2.4, halo = 'rgba(156,255,102,0.35)') {
  if (P.eye >= 2) { c.strokeStyle = col; c.lineWidth = 0.5; c.beginPath(); c.moveTo(x - gap / 2 - 0.8, y); c.lineTo(x - gap / 2 + 0.6, y + 0.3); c.moveTo(x + gap / 2 - 0.6, y + 0.3); c.lineTo(x + gap / 2 + 0.8, y); c.stroke(); return; }
  c.fillStyle = halo; c.beginPath(); c.ellipse(x, y, gap + 1.2, 1.4, 0, 0, 7); c.fill();
  for (const ex of [x - gap / 2, x + gap / 2]) { ellipse(c, ex, y, 0.8, P.eye === 1 ? 0.5 : 0.65, col); c.fillStyle = '#ffffff'; c.fillRect(ex - 0.2, y - 0.4, 0.4, 0.4); }
}

function foePrep(c, P) { c.save(); c.translate(P.x * 0.6, P.y); c.rotate(P.rot); c.scale(1 / Math.sqrt(P.sq), P.sq); }

// ---------- прислужник тьмы: пеший налётчик в рогатом шлеме, с зелёным клинком ----------
function drawThrall(c, P) {
  naShadow(c, 7);
  foePrep(c, P);
  const k = col => naK(P, col);
  naArm(c, -4, -17, 3.6, 3.4, P.up > 0.5 ? -2.6 : 0.2 - P.a * 0.4, 0.4, 1.9, k(FOE_C.robe2));       // дальняя рука
  const b = foeKnightBody(c, P, { leg: '#2a2452', leg2: '#1c1838', body: FOE_C.robe, body2: FOE_C.robe3, rim: '#7a6ac8', belt: FOE_C.green2, cape: '#15112c' });
  // шлем: округлый, с рожками и прорезью
  const hx = 0.4 + (P.a > 0.5 ? 0.8 : 0), hy = b.neck[1] - 4;
  ellipse(c, hx, hy, 3.8, 4, k(FOE_C.robe2));
  poly(c, [[hx - 3.8, hy], [hx + 3.8, hy], [hx + 3.4, hy + 3.4], [hx - 3.4, hy + 3.4]], k(FOE_C.robe2));
  c.fillStyle = k('#3a3066'); c.fillRect(hx - 3.2, hy - 3.4, 4.2, 0.8);
  c.fillStyle = FOE_C.void; c.fillRect(hx - 2.6, hy - 0.4, 5.6, 2);
  foeEyeGlow(c, P, hx + 0.4, hy + 0.5, FOE_C.green);
  for (const sx of [-1, 1]) {                                                                         // рожки
    const x0 = hx + sx * 3.2;
    poly(c, [[x0 - 0.9, hy - 1.6], [x0 + sx * 1.6, hy - 4.6], [x0 + sx * 1.2, hy - 7.4], [x0 + 0.9 * sx, hy - 2.2]], k(FOE_C.steel2));
  }
  // ближняя рука с клинком
  const [hx2, hy2, ang] = naArm(c, b.sh[0], b.sh[1], 3.8, 3.6, foeArmAng(P), -0.3, 2.1, k(FOE_C.robe3));
  ellipse(c, hx2, hy2, 1.3, 1.3, k('#463a82'));
  foeBlade(c, P, hx2, hy2, ang + 0.2, 11, 1, '#b8b4d0', FOE_C.green, true);
  c.restore();
}

// ---------- рыцарь тьмы: латы, плащ, гребень-плюмаж, двуручный клинок ----------
function drawKnight(c, P) {
  naShadow(c, 9);
  foePrep(c, P);
  const k = col => naK(P, col);
  naArm(c, -4.6, -18, 3.8, 3.6, P.up > 0.5 ? -2.6 : 0.3 - P.a * 0.5, 0.4, 2.2, k('#26204a'));
  const b = foeKnightBody(c, P, { big: 1.15, leg: '#34296a', leg2: '#221a48', body: '#34296a', body2: '#4a3e88', rim: '#8a7ae0', belt: FOE_C.green2, cape: '#15112c', boot: '#120e26' });
  // знак на кирасе — зелёная руна
  c.fillStyle = k(FOE_C.green); c.fillRect(-0.8, -15, 1.6, 2.6); c.fillRect(-1.6, -14.2, 3.2, 0.9);
  // топфхельм с гребнем
  const hx = 0.4 + (P.a > 0.5 ? 0.8 : 0), hy = b.neck[1] - 4.4;
  poly(c, [[hx - 3.8, hy - 3.4], [hx + 3.8, hy - 3.4], [hx + 4.2, hy + 3.8], [hx - 3.6, hy + 3.8]], k('#1c1838'));
  poly(c, [[hx + 0.8, hy - 3.4], [hx + 3.8, hy - 3.4], [hx + 4.2, hy + 3.8], [hx + 1.2, hy + 3.8]], k('#2c2458'));
  c.fillStyle = k('#8a7ae0'); c.fillRect(hx - 3.8, hy - 3.8, 7.6, 0.7);
  c.fillStyle = FOE_C.void; c.fillRect(hx - 1, hy - 0.4, 5, 1.3);
  foeEyeGlow(c, P, hx + 1.6, hy + 0.2, FOE_C.green, 2.2);
  for (let i = 0; i < 5; i++) {                                                                       // плюмаж
    const t = i / 4, sway = Math.sin(t * 3 + P.leg) * 0.8 - P.leg * 0.6;
    ellipse(c, hx - 0.6 - t * 3.6 + sway, hy - 4.6 - Math.sin(t * Math.PI) * 2.4, 1.5, 1.1, k(i % 2 ? '#7ad84a' : FOE_C.green));
  }
  const [hx2, hy2, ang] = naArm(c, b.sh[0], b.sh[1], 4.2, 4, foeArmAng(P), -0.3, 2.5, k('#4a3e88'));
  ellipse(c, hx2, hy2, 1.5, 1.5, k('#6a5ab8'));
  foeBlade(c, P, hx2, hy2, ang + 0.18, 15, 1.3, FOE_C.steel, FOE_C.green, true);
  c.restore();
}

// ---------- ворон-разведчик: чёрная птица с зелёным глазом ----------
function drawRaven(c, P) {
  const k = col => naK(P, col), up = P.wing;
  c.save(); c.translate(0, P.y * 0.5);
  // дальнее крыло
  poly(c, [[-1, -1], [-3 - up * 1.4, -5 - up * 4], [2, -2]], k('#1a1438'));
  // тело и хвост
  ellipse(c, 0, 0, 4.4, 2.4, k('#14102c'));
  poly(c, [[-3.6, -0.6], [-8, -1.6], [-8.4, 0.4], [-7.2, 1.4], [-3.4, 1]], k('#14102c'));
  c.fillStyle = k('#2a2252'); c.fillRect(-2.6, -1.8, 4.4, 0.6);
  // голова и клюв
  ellipse(c, 4, -1.6, 2.2, 2, k('#14102c'));
  poly(c, [[5.6, -2.2], [9, -1.2], [5.6, -0.6]], k('#8a82a8'));
  c.fillStyle = FOE_C.green; c.fillRect(4.4, -2.4, 0.9, 0.9); c.fillStyle = '#ffffff'; c.fillRect(4.6, -2.4, 0.4, 0.4);
  // ближнее крыло: перья веером, машет вверх-вниз
  const tip = -up * 6;
  poly(c, [[-2.4, -0.6], [-5.6, tip - 1], [-1, tip - 2.4], [2.6, tip], [2.4, -0.2]], k('#241c46'));
  c.strokeStyle = k('#3a3066'); c.lineWidth = 0.5;
  for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-0.5 + i, -0.5); c.lineTo(-4 + i * 2.4, tip - 1.4 + i * 0.3); c.stroke(); }
  // лапки
  c.fillStyle = k('#8a82a8'); c.fillRect(-0.4, 2, 0.5, 1.4); c.fillRect(1, 2, 0.5, 1.4);
  c.restore();
}

// ---------- Малгор: высокий маг в индиговой мантии, капюшон, тень-борода, посох с кристаллом ----------
function malgorDraw(c, P, ph) {
  const k = col => naK(P, col), cast = P.cast > 0.1 || P.up > 0.5;
  foePrep(c, P);
  const eye = ph === 3 ? '#e8ffc8' : FOE_C.green;
  // мантия: высокая, расширяется книзу, подол рваными лоскутами
  const sway = P.leg * 1.2;
  poly(c, [[-5, -31], [5, -31], [7.6, -10], [9 + sway, -1], [-8 + sway, -1], [-7.4, -10]], k(FOE_C.robe));
  poly(c, [[1.4, -31], [5, -31], [7.6, -10], [9 + sway, -1], [3 + sway, -1]], k(FOE_C.robe3));
  for (let i = -3; i <= 3; i++) poly(c, [[i * 2.3 - 1.2 + sway, -1.4], [i * 2.3 + sway, 1.4 + (i & 1)], [i * 2.3 + 1.2 + sway, -1.4]], k('#15112c'));
  c.strokeStyle = k(FOE_C.green2); c.lineWidth = 1.2; c.beginPath(); c.moveTo(-0.4, -27); c.lineTo(0.4 + sway * 0.3, -6); c.stroke();
  c.fillStyle = k(FOE_C.trim); c.fillRect(-5.4, -31.4, 10.8, 1.1);
  // дальняя рука: на касте поднята с зелёным огнём
  const [fx, fy] = naArm(c, -4.4, -27, 4, 4, cast ? -2.6 : 0.25, cast ? 0.2 : 0.3, 2.4, k(FOE_C.robe2));
  if (cast) { c.fillStyle = 'rgba(156,255,102,0.55)'; c.beginPath(); c.arc(fx, fy - 1, 2.6, 0, 7); c.fill(); ellipse(c, fx, fy - 1, 1.1, 1.1, '#e8ffc8'); }
  // капюшон и лицо во тьме
  const hx = 0.4, hy = -35;
  poly(c, [[hx - 5.6, hy + 4], [hx - 4.6, hy - 4], [hx - 1, hy - 9], [hx + 1.4, hy - 11.6], [hx + 2.6, hy - 8], [hx + 5.4, hy - 3], [hx + 5.8, hy + 4]], k(FOE_C.robe2));
  poly(c, [[hx + 1.4, hy - 11.6], [hx + 2.6, hy - 8], [hx + 5.4, hy - 3], [hx + 5.8, hy + 4], [hx + 2.4, hy + 4]], k('#2a2252'));
  ellipse(c, hx + 0.6, hy, 3.6, 3.2, FOE_C.void);
  foeEyeGlow(c, P, hx + 1, hy - 0.4, eye, 2.6, ph === 3 ? 'rgba(232,255,200,0.4)' : 'rgba(156,255,102,0.35)');
  poly(c, [[hx - 1.6, hy + 2.6], [hx + 3, hy + 2.6], [hx + 1.6, hy + 8], [hx + 0.4, hy + 9], [hx - 0.8, hy + 6.4]], k('#3a3066'));   // борода-тень
  // посох с кристаллом: в ближней руке
  const sx = 8, lift = cast ? -4 : 0;
  c.strokeStyle = k('#3a2a52'); c.lineWidth = 1.5; c.beginPath(); c.moveTo(sx, -40 + lift); c.lineTo(sx + 0.6, 1 + lift * 0.2); c.stroke();
  c.strokeStyle = k('#5a4878'); c.lineWidth = 0.5; c.beginPath(); c.moveTo(sx + 0.5, -38 + lift); c.lineTo(sx + 1, 0); c.stroke();
  for (const sxx of [-1, 1]) poly(c, [[sx, -41 + lift], [sx + sxx * 2.6, -44 + lift], [sx + sxx * 1.4, -46 + lift]], k(FOE_C.trim));   // когти-оправа
  const cr = cast || ph === 3 ? '#e8ffc8' : '#c08cff', cr2 = cast || ph === 3 ? '#9cff66' : '#7e58cc';
  poly(c, [[sx, -50 + lift], [sx + 3.2, -45 + lift], [sx, -40.6 + lift], [sx - 3.2, -45 + lift]], cr2);
  poly(c, [[sx, -50 + lift], [sx + 3.2, -45 + lift], [sx, -45 + lift], [sx - 1.2, -47 + lift]], cr);
  c.fillStyle = '#ffffff'; c.fillRect(sx - 0.8, -47.6 + lift, 0.8, 0.8);
  naArm(c, 4.2, -27, 3.6, 3.4, 0.9, -0.9, 2.4, k(FOE_C.robe3));
  ellipse(c, sx + 0.2, -22 + lift * 0.5, 1.4, 1.6, k('#463a82'));
  c.restore();
}
const drawMalgor1 = (c, P) => malgorDraw(c, P, 1);
const drawMalgor3 = (c, P) => malgorDraw(c, P, 3);

// ---------- костяной прислужник: скелетик с ржавым клинком ----------
function drawBoneMinion(c, P) {
  naShadow(c, 5);
  foePrep(c, P);
  const k = col => naK(P, col), B1 = '#e8e0c8', B2 = '#b8b0a0', B3 = '#6a6458', sw = P.leg;
  naLimb(c, -1.2, -7, -1.6 - sw * 2, -0.6, 1, k(B2)); naLimb(c, 1.2, -7, 1.8 + sw * 2, -0.6, 1.1, k(B1));
  ellipse(c, -1.4, -7, 2, 1, k(B2));                                                                  // таз
  c.strokeStyle = k(B2); c.lineWidth = 1; c.beginPath(); c.moveTo(0, -7); c.lineTo(0, -13); c.stroke();
  for (let i = 0; i < 3; i++) { c.strokeStyle = k(i ? B2 : B1); c.lineWidth = 0.7; c.beginPath(); c.moveTo(-2.4 + i * 0.3, -12 + i * 1.6); c.quadraticCurveTo(0, -11 + i * 1.6, 2.4 - i * 0.3, -12 + i * 1.6); c.stroke(); }
  naArm(c, -1.8, -12.6, 2.6, 2.4, 0.3 - P.a * 0.3, 0.3, 0.8, k(B2));
  // череп
  const hx = 0.6, hy = -16;
  ellipse(c, hx, hy, 2.8, 2.6, k(B1)); poly(c, [[hx - 1.4, hy + 1.6], [hx + 2.6, hy + 1.6], [hx + 2, hy + 3.2], [hx - 0.8, hy + 3.2]], k(B2));
  ellipse(c, hx - 0.6, hy, 0.8, 0.8, FOE_C.void); ellipse(c, hx + 1.6, hy, 0.8, 0.8, FOE_C.void);
  if (P.eye < 2) { c.fillStyle = FOE_C.green; c.fillRect(hx - 0.8, hy - 0.2, 0.5, 0.5); c.fillRect(hx + 1.4, hy - 0.2, 0.5, 0.5); }
  c.fillStyle = k(B3); for (let i = 0; i < 3; i++) c.fillRect(hx - 0.8 + i * 1, hy + 2.2, 0.35, 0.8);
  const [hx2, hy2, ang] = naArm(c, 1.8, -12.6, 2.8, 2.6, foeArmAng(P), -0.3, 0.9, k(B1));
  foeBlade(c, P, hx2, hy2, ang + 0.2, 7, 0.7, '#b8b4a0', '#e8e0c8', false);
  c.restore();
}

// ---------- пятеро стражей шпиля ----------
const FOE_GUARD = {
  fire:   { body: '#5a2a1a', body2: '#8a3c22', rim: '#ff9a3a', leg: '#4a2214', leg2: '#3a1a10', head: '#2a1410', eye: '#ffe070', glow: 'rgba(255,170,60,0.4)' },
  ice:    { body: '#3a5a7a', body2: '#5a86aa', rim: '#cfefff', leg: '#2e4c6a', leg2: '#24384e', head: '#24384e', eye: '#e8ffff', glow: 'rgba(200,240,255,0.4)' },
  bone:   { body: '#6a6458', body2: '#8e8676', rim: '#e8e0c8', leg: '#5a5448', leg2: '#46423a', head: '#e8e0c8', eye: '#9cff66', glow: 'rgba(156,255,102,0.35)' },
  shadow: { body: '#16102c', body2: '#2a1e52', rim: '#b07cff', leg: '#120c24', leg2: '#0a0818', head: '#0a0818', eye: '#d8b8ff', glow: 'rgba(200,160,255,0.4)' },
  golem:  { body: '#4a4458', body2: '#6a6280', rim: '#c08cff', leg: '#3e3a4c', leg2: '#302c3c', head: '#3a3448', eye: '#c08cff', glow: 'rgba(192,140,255,0.4)' },
};
function drawGuardKind(gk) {
  return (c, P) => {
    const G = FOE_GUARD[gk], k = col => naK(P, col), t = P.leg + P.y;
    naShadow(c, gk === 'golem' ? 10 : 8);
    foePrep(c, P);
    if (gk === 'shadow') {                                                                            // тень: вместо ног — рваный дымный подол
      for (let i = -3; i <= 3; i++) poly(c, [[i * 1.8 - 1.2, -9], [i * 1.8 + Math.sin(i + t) * 0.8, 0.6 - (i & 1) * 1.6], [i * 1.8 + 1.2, -9]], k(i & 1 ? G.leg : G.leg2));
    }
    naArm(c, -4.4, -17, 3.8, 3.6, P.up > 0.5 || P.cast > 0.1 ? -2.7 : 0.3 - P.a * 0.4, 0.4, gk === 'golem' ? 3.2 : 2.2, k(G.leg2));
    const b = foeKnightBody(c, P, { big: gk === 'golem' ? 1.3 : 1.05, noLegs: gk === 'shadow', leg: G.leg, leg2: G.leg2, boot: shade(G.leg2, -0.3), body: G.body, body2: G.body2, rim: G.rim });
    // приметы стихии на торсе
    if (gk === 'fire') { c.strokeStyle = k('#ff7a2a'); c.lineWidth = 0.6; c.beginPath(); c.moveTo(-3, -18); c.lineTo(-1, -14); c.lineTo(-2.6, -11); c.moveTo(2, -17); c.lineTo(3.4, -13); c.stroke(); }
    if (gk === 'ice') { for (const [x, y] of [[-2.6, -16], [2.4, -13], [-0.6, -11.6]]) poly(c, [[x, y - 1.6], [x + 1, y], [x, y + 1.6], [x - 1, y]], k('#e8ffff')); }
    if (gk === 'bone') for (let i = 0; i < 3; i++) { c.strokeStyle = k(G.rim); c.lineWidth = 0.7; c.beginPath(); c.moveTo(-3.4, -17 + i * 2.2); c.quadraticCurveTo(0, -16 + i * 2.2, 3.4, -17 + i * 2.2); c.stroke(); }
    if (gk === 'golem') { c.fillStyle = k(G.rim); for (const [x, y, s] of [[-1.4, -16, 2.6], [-4.4, -12, 1.4], [3.4, -18.4, 1.4]]) c.fillRect(x, y, s, s); }
    // голова
    const hx = 0.4 + (P.a > 0.5 ? 0.8 : 0), hy = b.neck[1] - 4;
    if (gk === 'bone') {                                                                              // череп с рогами
      ellipse(c, hx, hy, 3.6, 3.4, k(G.head)); poly(c, [[hx - 2, hy + 2], [hx + 3, hy + 2], [hx + 2.4, hy + 4.4], [hx - 1.2, hy + 4.4]], k('#c8c0a8'));
      ellipse(c, hx - 0.8, hy, 1.1, 1.1, FOE_C.void); ellipse(c, hx + 1.8, hy, 1.1, 1.1, FOE_C.void);
      foeEyeGlow(c, P, hx + 0.5, hy, G.eye, 2.6);
      for (const sx of [-1, 1]) poly(c, [[hx + sx * 2.6, hy - 1.6], [hx + sx * 5, hy - 4], [hx + sx * 4.4, hy - 6.6], [hx + sx * 3.4, hy - 3]], k(G.rim));
    } else if (gk === 'shadow') {                                                                     // капюшон и пустота
      poly(c, [[hx - 4.4, hy + 3.4], [hx - 3.6, hy - 2.6], [hx, hy - 6], [hx + 3.6, hy - 2.6], [hx + 4.4, hy + 3.4]], k(G.body2));
      ellipse(c, hx + 0.4, hy + 0.6, 2.8, 2.6, FOE_C.void);
      foeEyeGlow(c, P, hx + 0.6, hy + 0.4, G.eye, 2.2, 'rgba(200,160,255,0.4)');
    } else {
      poly(c, [[hx - 3.8, hy - 3.2], [hx + 3.8, hy - 3.2], [hx + 4, hy + 3.6], [hx - 3.6, hy + 3.6]], k(G.head));
      c.fillStyle = k(G.rim); c.fillRect(hx - 3.8, hy - 3.6, 7.6, 0.7);
      c.fillStyle = FOE_C.void; c.fillRect(hx - 1.6, hy - 0.2, 5, 1.3);
      foeEyeGlow(c, P, hx + 0.8, hy + 0.4, G.eye, 2.2, G.glow);
      if (gk === 'fire') for (let i = 0; i < 4; i++) {                                                 // пламенный венец
        const fx = hx - 3 + i * 2, fh = 3 + ((i + Math.round(t * 3)) & 1) * 1.6;
        poly(c, [[fx - 1, hy - 3.4], [fx + 0.2, hy - 3.4 - fh], [fx + 1.1, hy - 3.4]], i & 1 ? '#ffd070' : '#ff7a2a');
      }
      if (gk === 'ice') for (const [dx, h] of [[-2.8, 3.4], [0, 5], [2.8, 3.4]]) poly(c, [[hx + dx - 1, hy - 3.4], [hx + dx, hy - 3.4 - h], [hx + dx + 1, hy - 3.4]], k('#e8ffff'));
      if (gk === 'golem') { c.fillStyle = k(G.body2); c.fillRect(hx - 4.6, hy - 1.4, 9.2, 2); }
    }
    // ближняя рука и оружие стихии
    const [hx2, hy2, ang] = naArm(c, b.sh[0], b.sh[1], 4, 3.8, P.cast > 0.1 ? -2.4 : foeArmAng(P), -0.3, gk === 'golem' ? 3.4 : 2.3, k(G.body2));
    if (gk === 'fire') {                                                                              // факел-булава
      const [bx, by] = naDir(ang + 0.15);
      naLimb(c, hx2, hy2, hx2 + bx * 9, hy2 + by * 9, 1.2, k('#3a2a20'));
      ellipse(c, hx2 + bx * 10, hy2 + by * 10, 2.2, 2.2, '#ff9a3a'); ellipse(c, hx2 + bx * 10.4, hy2 + by * 10.4, 1.2, 1.2, '#ffe070');
    } else if (gk === 'ice') foeBlade(c, P, hx2, hy2, ang + 0.15, 13, 1, '#cfefff', '#ffffff', false);
    else if (gk === 'bone') {                                                                         // костяная палица
      const [bx, by] = naDir(ang + 0.15);
      naLimb(c, hx2, hy2, hx2 + bx * 10, hy2 + by * 10, 1.3, k('#e8e0c8'));
      ellipse(c, hx2 + bx * 10.6, hy2 + by * 10.6, 2, 1.6, k('#f0ead0'));
    } else if (gk === 'shadow') foeBlade(c, P, hx2, hy2, ang + 0.15, 9, 0.7, '#b07cff', '#d8b8ff', false);
    else { ellipse(c, hx2, hy2, 3, 2.8, k(G.body)); ellipse(c, hx2 + 0.8, hy2 - 0.6, 1.8, 1.6, k(G.body2)); c.fillStyle = k(G.rim); c.fillRect(hx2 - 0.6, hy2 - 0.6, 1.2, 1.2); }
    if (P.cast > 0.1) { c.fillStyle = G.glow; c.beginPath(); c.arc(hx2, hy2, 3.4, 0, 7); c.fill(); }
    c.restore();
  };
}

// ---------- ожившая глыба (кампания): валун на ножках-обломках с горящими глазами ----------
function drawRockling(c, P) {
  naShadow(c, 7);
  foePrep(c, P);
  const k = col => naK(P, col), sw = P.leg;
  for (const [sx, col] of [[-1, '#4a4440'], [1, '#5a524c']]) poly(c, [[sx * 4 - 1.6 + sw * sx * 1.6, -4], [sx * 4 + 1.6 + sw * sx * 1.6, -4], [sx * 4 + 1.8 + sw * sx * 2.4, 0], [sx * 4 - 1.8 + sw * sx * 2.4, 0]], k(col));
  const lean = P.a * 1.6;
  poly(c, [[-7, -4], [-8, -10], [-5, -15.4], [1 + lean, -16.4], [6.6 + lean, -13], [8 + lean, -7], [6, -3.4]], k('#6a625a'));
  poly(c, [[1 + lean, -16.4], [6.6 + lean, -13], [8 + lean, -7], [6, -3.4], [2, -3.6], [3 + lean, -12]], k('#7e766c'));
  poly(c, [[-7, -4], [-8, -10], [-5.6, -9], [-4, -4]], k('#4e4842'));
  c.strokeStyle = k('#3a3430'); c.lineWidth = 0.7; c.beginPath(); c.moveTo(-1 + lean, -15.6); c.lineTo(1 + lean, -11); c.lineTo(-0.6, -7); c.stroke();   // трещина
  for (const ex of [2.4, 5.2]) { ellipse(c, ex + lean, -10.4, 1, 0.8, P.eye >= 2 ? '#7a4a20' : '#ffb040'); if (P.eye < 2) { c.fillStyle = '#fff2a0'; c.fillRect(ex + lean - 0.3, -10.8, 0.5, 0.5); } }
  c.restore();
}

if (typeof NA_SPEC !== 'undefined') {
// ---------- регистрация видов: те же кадры, что у нейтралов ----------
Object.assign(NA_SPEC, {
  fThrall:   { name: 'Прислужник тьмы', w: 52, h: 48, ax: 22, ay: 40, sc: 1 },
  fKnight:   { name: 'Рыцарь тьмы', w: 72, h: 66, ax: 30, ay: 56, sc: 1.25 },
  fRaven:    { name: 'Ворон-разведчик', w: 28, h: 26, ax: 13, ay: 14, sc: 1 },
  fMalgor1:  { name: 'Малгор', w: 56, h: 72, ax: 24, ay: 64, sc: 1.1 },
  fMalgor3:  { name: 'Малгор', w: 56, h: 72, ax: 24, ay: 64, sc: 1.1 },
  fBone:     { name: 'Костяной прислужник', w: 34, h: 32, ax: 14, ay: 26, sc: 1 },
  fRock:     { name: 'Ожившая глыба', w: 34, h: 28, ax: 16, ay: 22, sc: 1 },
});
Object.assign(NA_DRAW, { fThrall: drawThrall, fKnight: drawKnight, fRaven: drawRaven, fMalgor1: drawMalgor1, fMalgor3: drawMalgor3, fBone: drawBoneMinion, fRock: drawRockling });
for (const gk of Object.keys(FOE_GUARD)) {
  const gs = gk === 'golem' ? 1.5 : 1.25;
  NA_SPEC['fG_' + gk] = { name: 'Страж', w: Math.round(56 * gs), h: Math.round(52 * gs), ax: Math.round(24 * gs), ay: Math.round(44 * gs), sc: gs };
  NA_DRAW['fG_' + gk] = drawGuardKind(gk);
}

// кадр по состоянию налётчика (enemy.js): погоня — шаг, атака — замах/удар/возврат, иначе — покой
function foeFrameOf(N) {
  if (N.st === 'die' || N.st === 'vanish') return 'ready';         // падение и растворение даёт сам enemy.js
  if (N.st === 'atk' && N.atkT !== undefined) return N.atkT < 0.24 ? 'windup' : N.atkT < 0.36 ? 'strike' : N.atkT < 0.7 ? 'recover' : 'ready';
  if (N.st === 'chase') return 'w' + (Math.floor((N.ph || 0) * 4) & 7);
  return 'i' + (Math.floor(Game.time * 5 + (N.id || 0)) % 6);
}
// кадр по анимации стража (guards.js gdFrame)
function foeGuardFrame(an, f) {
  if (an === 'walk') return 'w' + (f & 7);
  if (an === 'atk') return f < 3 ? 'windup' : f < 6 ? 'strike' : f < 8 ? 'recover' : 'ready';
  if (an === 'cast') return 'c' + Math.min(5, f);
  if (an === 'hurt') return 'hurt';
  if (an === 'die') return 'ready';
  return 'i' + (f % 6);
}
function foeBlit(c, kind, fr, s = 1) {
  const sp = naFrame(kind, fr);
  if (s !== 1) { c.save(); c.scale(s, s); blitFine(c, sp.cv, -sp.ax, -sp.ay); c.restore(); }
  else blitFine(c, sp.cv, -sp.ax, -sp.ay);
}

// ---------- подмена рисования (enemy.js, guards.js и act2.js грузятся раньше) ----------
foeDrawThrall = function (c, N, big) { foeBlit(c, 'fThrall', foeFrameOf(N), big ? 1.35 : 1); };
foeDrawKnight = function (c, N) { foeBlit(c, 'fKnight', foeFrameOf(N)); };
foeDrawRaven = function (c, N) {
  const y = -18 + Math.sin((N.ph || 0) * 0.5) * 1.5;
  c.save(); c.translate(0, y); foeBlit(c, 'fRaven', (Math.floor(N.ph || 0) & 1) ? 'i1' : 'i4'); c.restore();
};
foeDrawMalgor = function (c, N) {
    const t = Game.time, hov = Math.sin(t * 2.2) * 1.6, cast = N.castT > 0, ph = N.phase || N.fz || 1;
    c.save(); c.translate(0, -6 + hov);
    foeBlit(c, ph === 3 ? 'fMalgor3' : 'fMalgor1', cast ? 'c3' : 'i' + (Math.floor(t * 4) % 6));
    c.restore();
    // свечение кристалла — как раньше, векторное
    c.save(); c.globalCompositeOperation = 'lighter';
    const sx = 9, g = c.createRadialGradient(sx, -56 + hov - (cast ? 4 : 0), 0, sx, -56 + hov, cast ? 30 : 18);
    g.addColorStop(0, `rgba(${ph === 3 ? '150,255,100' : '170,90,255'},${cast ? 0.7 : 0.4})`); g.addColorStop(1, 'rgba(170,90,255,0)');
    c.fillStyle = g; c.fillRect(sx - 30, -96 + hov, 62, 62);
    c.restore();
};
if (typeof gdDrawGuard === 'function') {
  gdDrawGuard = function (c, N) {
    const k = N.gk || (FSPEC[N.k] && FSPEC[N.k].gk), G = GD_KINDS[k], [an, f] = gdFrame(N), S = k === 'golem' ? 1.5 : 1.25;
    c.save();
    if (an === 'die') c.globalAlpha *= Math.max(0, 1 - f / 9);
    if (N.veil) c.globalAlpha *= 0.45;
    foeBlit(c, 'fG_' + k, foeGuardFrame(an, f));
    c.restore();
    // сияние стихии и уязвимость — как раньше
    c.save(); c.globalCompositeOperation = 'lighter';
    const rr = an === 'cast' ? 26 : 16, g = c.createRadialGradient(0, -22 * S, 0, 0, -22 * S, rr);
    g.addColorStop(0, `rgba(${G.hue},${an === 'cast' ? 0.45 : 0.22})`); g.addColorStop(1, `rgba(${G.hue},0)`);
    c.fillStyle = g; c.fillRect(-rr, -22 * S - rr, rr * 2, rr * 2);
    if (N.vul || N.vulT > Game.time) { c.strokeStyle = 'rgba(255,224,112,0.7)'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(0, 0, 10 * S, 3 * S, 0, 0, 7); c.stroke(); }
    c.restore();
  };
  gdDrawBone = function (c, N) {
    const [an, f] = gdFrame(N);
    c.save();
    if (an === 'die') { c.globalAlpha *= Math.max(0, 1 - f / 9); c.translate(0, f * 0.6); }
    foeBlit(c, 'fBone', foeGuardFrame(an, f));
    c.restore();
  };
}
if (typeof camp2DrawRockling === 'function') {
  camp2DrawRockling = function (c, N) { foeBlit(c, 'fRock', foeFrameOf(N)); };
}
}

// ---------- Эхо павших (echoart.js) под мелкий пиксель: тот же облик, нарисованный плавно ----------
// Геометрия и позы — как в ecPaint (прямоугольники заменены формами), свечение — вектором при рисовании.

function ecxWeapon(c, w, acc) {
  // система руки: (0,0) — кисть, клинок/древко уходит вверх по −y
  const M = '#e8f8ff', W = '#c8b090', line = (x0, y0, x1, y1, lw, col) => { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
  switch (w) {
    case 'sword': poly(c, [[-1.6, 0.4], [2.6, 0.4], [2.6, 1.6], [-1.6, 1.6]], acc); poly(c, [[0, 0], [0, -11.4], [1, -13.4], [2, -11.4], [2, 0]], M); line(1, -1, 1, -11, 0.4, '#a8c0d8'); break;
    case 'axe': line(0.5, 2, 0.5, -12, 1, W); poly(c, [[1, -12], [4.6, -13.6], [5.4, -9], [4.6, -6.4], [1, -7.6]], M); break;
    case 'dagger': poly(c, [[0, 0], [0.5, -6.4], [1, 0]], M); poly(c, [[-1.2, 0], [2.2, 0], [2.2, 1], [-1.2, 1]], acc); break;
    case 'bow': c.strokeStyle = W; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-2, -10); c.quadraticCurveTo(-5.4, 0, -2, 10); c.stroke(); line(-2, -10, -2, 10, 0.35, 'rgba(255,255,255,0.8)'); break;
    case 'staff': line(0.5, 6, 0.5, -16, 1, W); ellipse(c, 0.5, -17.6, 1.7, 1.7, acc); ellipse(c, 0.1, -18, 0.6, 0.6, '#ffffff'); break;
    case 'mace': line(0.5, 2, 0.5, -8, 1, W); ellipse(c, 0.5, -9.6, 1.8, 1.8, M); for (const [dx, dy] of [[-1.8, 0], [1.8, 0], [0, -1.8]]) poly(c, [[0.5 + dx * 0.8 - 0.4, -9.6 + dy * 0.8], [0.5 + dx * 1.4, -9.6 + dy * 1.4], [0.5 + dx * 0.8 + 0.4, -9.6 + dy * 0.8]], M); break;
    case 'lute': line(0.5, -2, 0.5, -10, 1, '#a07040'); ellipse(c, 0.5, -0.4, 2.8, 2.6, '#c89060'); ellipse(c, 0.5, -0.6, 0.7, 0.7, 'rgba(40,30,70,0.8)'); break;
    case 'hammer': line(0.5, 2, 0.5, -8, 1, W); poly(c, [[-2, -10.2], [3, -10.2], [3, -7.4], [-2, -7.4]], M); break;
    case 'pick': line(0.5, 2, 0.5, -9, 1, W); c.strokeStyle = M; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-4.4, -7.4); c.quadraticCurveTo(0.5, -11, 5.4, -7.4); c.stroke(); break;
    case 'saw': poly(c, [[-0.4, -1.6], [2, -1.6], [2, 1.2], [-0.4, 1.2]], W); poly(c, [[-1, -11], [3, -11], [3, -2], [-1, -2]], M); for (let i = 0; i < 4; i++) poly(c, [[3, -10.6 + i * 2], [4, -10 + i * 2], [3, -9.4 + i * 2]], M); break;
    case 'scythe': line(0.5, 4, 0.5, -14, 1, W); c.fillStyle = M; c.beginPath(); c.moveTo(0.5, -14.6); c.quadraticCurveTo(-4, -16.4, -6.6, -13.2); c.quadraticCurveTo(-3.6, -14.6, 0.5, -13.4); c.fill(); break;
    case 'pitch': line(0.5, 4, 0.5, -14, 1, W); line(-1, -14.6, 2, -14.6, 0.8, M); for (const x of [-1, 0.5, 2]) line(x, -14.6, x, -18, 0.6, M); break;
    case 'tongs': line(0.2, 1, 0.2, -9, 0.7, M); line(2.2, 1, 2.2, -9, 0.7, M); ellipse(c, 1.2, -10, 1.6, 1.1, '#ff9a50'); break;
    case 'cleaver': line(0.5, 1, 0.5, -2, 1, W); poly(c, [[-1, -2], [4, -2], [4, -7.4], [0.4, -8.2], [-1, -7]], M); break;
    case 'pin': poly(c, [[-1.2, -7], [2.2, -7], [2.2, 2], [-1.2, 2]], '#e8d8b8'); line(0.5, -7, 0.5, -9, 0.9, W); break;
    case 'mug': poly(c, [[-2, -4], [3, -4], [2.8, 1], [-1.8, 1]], '#d8a858'); ellipse(c, 0.5, -4.4, 2.6, 0.9, '#ffffff'); c.strokeStyle = '#d8a858'; c.lineWidth = 0.8; c.beginPath(); c.arc(3.2, -1.6, 1.4, -1.4, 1.4); c.stroke(); break;
    case 'sack': ellipse(c, 0, -1.6, 3, 3.6, '#e8e0c8'); poly(c, [[-1, -5.6], [1, -5.6], [0.8, -4.4], [-0.8, -4.4]], W); break;
    case 'whip': c.strokeStyle = W; c.lineWidth = 0.8; c.beginPath(); c.moveTo(0.5, 1); c.lineTo(0.5, -5); c.quadraticCurveTo(3, -8, 6, -5.6); c.stroke(); break;
    case 'lamp': line(0.5, 0, 0.5, 3, 0.7, '#8a8a9a'); poly(c, [[-2, 3], [3, 3], [2.4, 9], [-1.4, 9]], '#8a8a9a'); ellipse(c, 0.5, 6, 1.4, 2, '#fff0a0'); break;
    default: ellipse(c, 0.5, -0.4, 1.6, 1.5, 'rgba(255,255,255,0.85)');                 // кулак
  }
}

function ecxPaint(c, V, an, f) {
  const lt = 'rgba(255,255,255,0.45)';
  if (V.wisp) {                                                                          // «Огонёк Лампы»: язычок пламени с глазками
    const bob = an === 'hov' ? Math.sin(f / 9 * 6.283) * 2 : 0, h = [10, 12, 13, 12, 11, 10, 12, 13, 11][an === 'hov' ? f : 0];
    c.fillStyle = '#ffaa3c'; c.beginPath(); c.moveTo(-4.4, -10 + bob); c.quadraticCurveTo(-4.8, -10 - h * 0.6 + bob, 0, -12 - h + bob); c.quadraticCurveTo(4.8, -10 - h * 0.6 + bob, 4.4, -10 + bob); c.quadraticCurveTo(0, -6 + bob, -4.4, -10 + bob); c.fill();
    c.fillStyle = '#ffd070'; c.beginPath(); c.moveTo(-2.8, -10 + bob); c.quadraticCurveTo(-2.6, -9 - h * 0.6 + bob, 0, -10 - h + bob); c.quadraticCurveTo(2.6, -9 - h * 0.6 + bob, 2.8, -10 + bob); c.quadraticCurveTo(0, -7.6 + bob, -2.8, -10 + bob); c.fill();
    ellipse(c, -1.4, -15 + bob, 0.6, 0.9, '#3a1a40'); ellipse(c, 1.6, -15 + bob, 0.6, 0.9, '#3a1a40');
    if (an === 'atk' && f >= 3 && f <= 5) { c.fillStyle = '#fff4c0'; c.beginPath(); c.moveTo(4, -19 + bob); c.lineTo(13, -19.6 + bob); c.lineTo(4, -17.6 + bob); c.fill(); }
    return;
  }
  const H = !!V.hero, col = V.col, dk = shade(col.replace(/rgb\((\d+),(\d+),(\d+)\)/, (m, r, g, b) => '#' + [r, g, b].map(v => (+v).toString(16).padStart(2, '0')).join('')), -0.22);
  const bob = an === 'hov' ? Math.sin(f / 9 * 6.283) * 1.5 : an === 'hurt' ? [1, 2, 1, 0][f] : 0;
  const lean = an === 'atk' ? [0, -1, -1, -2, 1, 2, 2, 1][f] : an === 'hurt' ? -[1, 2, 1, 0][f] : 0;
  const arm = an === 'atk' ? [-0.5, -1.3, -2.1, -2.5, -0.5, 0.9, 1.3, 0.5][f] : -0.35 + (an === 'hov' ? Math.sin(f / 9 * 6.283 + 1) * 0.12 : 0);
  c.save();
  c.translate(lean, -4 + bob);
  // хвост: дымный язык вместо ног
  const tw = an === 'hov' ? f : an === 'atk' ? f + 2 : 3, tip = Math.sin((tw + 6) / 9 * 6.283) * 3;
  c.fillStyle = col; c.beginPath(); c.moveTo(-4.6, -4.4); c.quadraticCurveTo(-3.6 + tip * 0.3, 2, tip, 4.6); c.quadraticCurveTo(3 + tip * 0.3, 1.4, 4.6, -4.4); c.closePath(); c.fill();
  c.strokeStyle = dk; c.lineWidth = 0.5; c.beginPath(); c.moveTo(1.6, -3.4); c.quadraticCurveTo(1 + tip * 0.3, 0.6, tip * 0.8, 3.4); c.stroke();
  // тело: балахон шире к подолу; у героя — плащ цвета класса за спиной
  const bodyH = H ? 13 : 10, bodyY = -4 - bodyH, sw = H ? 6 : 5;
  if (H) poly(c, [[-sw - 0.6, bodyY + 1], [sw + 0.6, bodyY + 1], [sw + 1.6, bodyY + bodyH + 1], [sw - 1, bodyY + bodyH + 3], [-sw + 1, bodyY + bodyH + 2], [-sw - 1.8, bodyY + bodyH + 3.4]], V.acc);
  poly(c, [[-sw + 0.4, bodyY], [sw - 0.4, bodyY], [sw + 1.6, bodyY + bodyH], [-sw - 1.6, bodyY + bodyH]], col);
  poly(c, [[-sw + 0.4, bodyY], [-sw + 2.2, bodyY], [-sw + 0.4, bodyY + bodyH], [-sw - 1.6, bodyY + bodyH]], lt);
  poly(c, [[sw * 0.3, bodyY], [sw - 0.4, bodyY], [sw + 1.6, bodyY + bodyH], [sw * 0.4, bodyY + bodyH]], dk);
  c.strokeStyle = 'rgba(60,40,110,0.6)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-sw - 1, bodyY + bodyH - 2.6); c.lineTo(sw + 1, bodyY + bodyH - 2.6); c.stroke();   // пояс
  naLimb(c, -sw + 0.4, bodyY + 2, -sw - 1.2, bodyY + (H ? 9 : 8), 1.6, dk); ellipse(c, -sw - 1.2, bodyY + (H ? 9.6 : 8.6), 1.1, 1.1, 'rgba(255,255,255,0.85)');   // вторая рука
  if (V.shield) { poly(c, [[-sw - 5, bodyY + 3], [-sw + 1, bodyY + 3], [-sw + 0.6, bodyY + 8], [-sw - 2, bodyY + 11], [-sw - 4.6, bodyY + 8]], '#e8f0ff'); const a2 = V.acc || V.cap; c.fillStyle = a2; c.fillRect(-sw - 3, bodyY + 4, 1.6, 5); c.fillRect(-sw - 4, bodyY + 5.8, 3.6, 1.2); }
  // голова: круглое лицо, пустые глазницы с искрой, борода клином
  const hy = bodyY - 7;
  ellipse(c, 0, hy + 3.4, 4.2, 3.8, col); ellipse(c, -0.8, hy + 2, 2.6, 1.6, lt);
  for (const ex of [-1.8, 1.8]) { ellipse(c, ex, hy + 2.9, 1.2, 1.15, '#2a1a40'); c.fillStyle = '#ffffff'; c.fillRect(ex - 0.2, hy + 2.3, 0.6, 0.6); }
  if (V.mask) poly(c, [[-4.2, hy + 4], [4.2, hy + 4], [4, hy + 6], [-4, hy + 6]], '#3a2a50');
  else { c.fillStyle = '#f0ecff'; c.beginPath(); c.moveTo(-4.2, hy + 5); c.quadraticCurveTo(-4, hy + 9.6, 0, hy + (H ? 13 : 12)); c.quadraticCurveTo(4, hy + 9.6, 4.2, hy + 5); c.quadraticCurveTo(0, hy + 6.4, -4.2, hy + 5); c.fill(); c.strokeStyle = '#c8c0e8'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(-1.4, hy + 7); c.lineTo(-0.6, hy + 10); c.moveTo(1.4, hy + 7); c.lineTo(0.6, hy + 10); c.stroke(); }
  // убор
  const hd = V.head, a = V.acc;
  if (H) {
    if (hd === 'helm') { c.fillStyle = '#e0e8f0'; c.beginPath(); c.ellipse(0, hy + 0.6, 5.2, 3.8, 0, Math.PI, 0); c.fill(); poly(c, [[-5.2, hy + 0.6], [-4.2, hy + 0.6], [-4.4, hy + 5], [-5.2, hy + 5]], '#e0e8f0'); poly(c, [[4.2, hy + 0.6], [5.2, hy + 0.6], [5.2, hy + 5], [4.4, hy + 5]], '#e0e8f0'); poly(c, [[-0.4, hy + 0.6], [0.4, hy + 0.6], [0.4, hy + 4.4], [-0.4, hy + 4.4]], '#e0e8f0'); ellipse(c, -1.6, hy - 1.6, 2, 0.6, '#ffffff'); ellipse(c, 0, hy - 3.6, 1, 1.4, a); }
    else if (hd === 'horns') { poly(c, [[-4, hy - 1.6], [4, hy - 1.6], [4, hy + 1], [-4, hy + 1]], '#c8b090'); for (const s of [-1, 1]) { c.strokeStyle = '#f0ecd8'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(s * 3.6, hy - 0.6); c.quadraticCurveTo(s * 7.4, hy - 1.4, s * 7.6, hy - 6.4); c.stroke(); } }
    else if (hd === 'hood') { c.fillStyle = a; c.beginPath(); c.moveTo(-5.2, hy + 6); c.lineTo(-5, hy - 0.4); c.quadraticCurveTo(-4, hy - 4.6, 0, hy - 4.6); c.quadraticCurveTo(4, hy - 4.6, 5, hy - 0.4); c.lineTo(5.2, hy + 6); c.lineTo(3.4, hy + 6); c.quadraticCurveTo(3.6, hy, 0, hy - 0.6); c.quadraticCurveTo(-3.6, hy, -3.4, hy + 6); c.fill(); }
    else if (hd === 'band') { c.strokeStyle = a; c.lineWidth = 1; c.beginPath(); c.moveTo(-4.2, hy + 0.8); c.lineTo(4.2, hy + 0.8); c.quadraticCurveTo(5.6, hy + 1.6, 5.6, hy + 3.4); c.stroke(); }
    else if (hd === 'feather') { c.fillStyle = a; c.beginPath(); c.ellipse(0, hy - 0.4, 5.4, 1.4, 0, 0, 7); c.fill(); c.beginPath(); c.ellipse(0, hy - 1.8, 3.2, 2, 0, Math.PI, 0); c.fill(); c.strokeStyle = '#ffffff'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(2.6, hy - 2.6); c.quadraticCurveTo(4.6, hy - 6, 3.6, hy - 9.4); c.stroke(); }
    else if (hd === 'wizard') { c.fillStyle = a; c.beginPath(); c.ellipse(0, hy, 6, 1.4, 0, 0, 7); c.fill(); c.beginPath(); c.moveTo(-4, hy); c.quadraticCurveTo(-1, hy - 6, 2.4, hy - 10.6); c.quadraticCurveTo(4.6, hy - 11.4, 4.6, hy - 10); c.quadraticCurveTo(3, hy - 6, 4, hy); c.fill(); ellipse(c, -0.6, hy - 3.4, 0.6, 0.6, '#fff0a0'); }
    else if (hd === 'antler') { poly(c, [[-4, hy - 0.8], [4, hy - 0.8], [4, hy + 1], [-4, hy + 1]], '#7ac88a'); for (const s of [-1, 1]) { c.strokeStyle = '#e8d8b8'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(s * 3.2, hy - 0.4); c.lineTo(s * 5.6, hy - 6); c.moveTo(s * 4.8, hy - 4); c.lineTo(s * 7.6, hy - 5); c.stroke(); } }
    else if (hd === 'mitre') { c.fillStyle = '#f4f0e0'; c.beginPath(); c.moveTo(-3.2, hy); c.lineTo(-3, hy - 4.6); c.quadraticCurveTo(-1, hy - 6.4, 0, hy - 7.6); c.quadraticCurveTo(1, hy - 6.4, 3, hy - 4.6); c.lineTo(3.2, hy); c.fill(); poly(c, [[-0.5, hy - 5], [0.5, hy - 5], [0.5, hy - 0.4], [-0.5, hy - 0.4]], a); poly(c, [[-1.6, hy - 3.2], [1.6, hy - 3.2], [1.6, hy - 2.4], [-1.6, hy - 2.4]], a); }
    if (V.halo) { c.strokeStyle = 'rgba(255,240,160,0.95)'; c.lineWidth = 0.8; c.beginPath(); c.ellipse(0, hy - (hd === 'mitre' ? 9 : 6), 5.6, 1.7, 0, 0, 7); c.stroke(); }
  } else {
    const cp = V.cap;
    if (cp === 'toque') { poly(c, [[-4, hy - 2], [4, hy - 2], [4, hy + 0.4], [-4, hy + 0.4]], '#ffffff'); for (const x of [-3, 0, 3]) ellipse(c, x, hy - 4.6, 2.4, 2.4, '#ffffff'); }
    else if (cp === 'wizard') { c.fillStyle = '#5a4aa8'; c.beginPath(); c.ellipse(0, hy, 5.2, 1.3, 0, 0, 7); c.fill(); c.beginPath(); c.moveTo(-3.4, hy); c.quadraticCurveTo(-0.4, hy - 6, 2.2, hy - 9.6); c.quadraticCurveTo(2.4, hy - 4, 3.4, hy); c.fill(); ellipse(c, 0.4, hy - 2.6, 0.55, 0.55, '#fff0a0'); }
    else {                                                                                // гномий колпак цвета профессии: свисает набок
      c.fillStyle = cp; c.beginPath(); c.moveTo(-5, hy + 1); c.quadraticCurveTo(-4.4, hy - 5, 0.6, hy - 7.6); c.quadraticCurveTo(4.6, hy - 9, 5.8, hy - 5.4); c.quadraticCurveTo(4.6, hy - 6.6, 3, hy - 5.4); c.quadraticCurveTo(4.6, hy - 2, 5, hy + 1); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(-5, hy + 0.6); c.lineTo(5, hy + 0.6); c.stroke();
      if (V.candle) { poly(c, [[0, hy - 10], [1.6, hy - 10], [1.6, hy - 7.4], [0, hy - 7.4]], '#f4f0e0'); ellipse(c, 0.8, hy - 11.4 - (f & 1) * 0.6, 0.8, 1.3, '#ffd070'); }
    }
  }
  // рука с оружием или инструментом
  c.save(); c.translate(sw - 0.4, bodyY + 2); c.rotate(arm);
  naLimb(c, 0.8, 0, 0.8, H ? 6.6 : 5.6, 1.7, col);
  c.translate(1, H ? 7 : 6); c.rotate(an === 'atk' ? 1.2 : 0.3 - arm);
  ecxWeapon(c, V.wpn, V.acc || V.cap);
  c.restore();
  // след удара
  if (an === 'atk' && f >= 4 && f <= 6) {
    c.strokeStyle = `rgba(255,255,255,${0.95 - (f - 4) * 0.2})`; c.lineWidth = 1.4;
    c.beginPath(); c.arc(sw, bodyY + 2, H ? 15 : 12, -1.9, -1.9 + (f - 3) * 0.9); c.stroke();
  }
  c.restore();
}

if (typeof ecSprite === 'function') {
  const _ecSprite = ecSprite;
  ecSprite = function (V, an, f) {
    if (PX_FINE <= 1) return _ecSprite(V, an, f);
    const key = V.key + '|' + an + '|' + f;
    let cv = EC_CACHE.get(key);
    if (cv) return cv;
    cv = nxFine(EC_W, EC_H, EC_OX, EC_OY, c => {
      if (an === 'in') {                         // встаёт из земли снизу вверх
        const k = (f + 1) / 6;
        c.save(); c.beginPath(); c.rect(-EC_OX, -EC_OY, EC_W, EC_OY + 1); c.clip();
        c.translate(0, (1 - k) * 30); ecxPaint(c, V, 'hov', 0); c.restore();
      } else if (an === 'out') {                 // тает: поднимается и рассыпается
        c.save(); c.translate(0, -f * 2); ecxPaint(c, V, 'hov', f); c.restore();
        nxDissolve(c, -EC_OX, -EC_OY, EC_W, EC_H, 31 + f, 0.8 + f * 0.9);
      } else ecxPaint(c, V, an, f);
    }, { outlineDark: 0.6 });
    if (an === 'hurt') { const o = cv.getContext('2d'); o.globalCompositeOperation = 'source-atop'; o.fillStyle = `rgba(255,255,255,${[0.75, 0.5, 0.3, 0.1][f]})`; o.fillRect(0, 0, cv.width, cv.height); }
    if (EC_CACHE.size >= EC_CACHE_MAX) EC_CACHE.delete(EC_CACHE.keys().next().value);
    EC_CACHE.set(key, cv);
    return cv;
  };
  gdDrawEcho = function (c, N) {
    const L = N.look || {}, V = N._ecV && N._ecV.src === L ? N._ecV : (N._ecV = Object.assign(ecLook(L), { src: L }));
    const [an, f] = ecFrame(N), spr = ecSprite(V, an, f);
    c.save();
    c.globalAlpha *= an === 'out' ? 0.85 : 0.8;
    if (spr.fine > 1) {                          // мягкое свечение вокруг — поверх пиксельной фигуры не рисуется, только ореол
      const top = V.hero ? -36 : -30, colr = V.wisp ? 'rgb(255,214,120)' : V.col, g = c.createRadialGradient(0, top + 12, 0, 0, top + 12, 18);
      g.addColorStop(0, colr.replace('rgb', 'rgba').replace(')', ',0.3)')); g.addColorStop(1, colr.replace('rgb', 'rgba').replace(')', ',0)'));
      c.fillStyle = g; c.fillRect(-20, top - 6, 40, 40);
    }
    blitFine(c, spr, -EC_OX, -EC_OY, EC_W, EC_H);
    c.restore();
    if (N.ename && an !== 'out') {
      c.save();
      const m = c.getTransform && c.getTransform();
      if (m && m.a < 0) c.scale(-1, 1);
      c.font = '8px sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(220,200,255,0.9)'; c.fillText(N.ename, 0, V.hero ? -44 : -38);
      c.restore();
    }
  };
}
