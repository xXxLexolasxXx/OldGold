'use strict';
// Нейтралы 2 (НЕЙТРАЛЫ_2.md): кадры новых народов леса — тролли (лесной, каменный, болотный), броненосец, гоблины
// (два облика), гномтавры (копейщик и лучник) — и их логова. Тот же конвейер, что у neutralart.js: вектор в 3×,
// сведение в пиксели, кэш naCache, кадры строятся лениво при первом показе.
// Кадры по КАДРЫ.md: покой 6, ходьба 8, бой 9, смерть 6, торжество 4 + получение удара 4 (h0…h3) — у всех нейтралов.
// Броненосец ещё: сворачивание 4 (cu), качение 8 (ro), разворот 4 (un), отскок 4 (bo).
// Подключается после neutralart.js и frostart.js.

NA_FRAMES.hurt4 = ['h0', 'h1', 'h2', 'h3'];
NA_FRAMES.curl = ['cu0', 'cu1', 'cu2', 'cu3'];
NA_FRAMES.roll = ['ro0', 'ro1', 'ro2', 'ro3', 'ro4', 'ro5', 'ro6', 'ro7'];
NA_FRAMES.uncurl = ['un0', 'un1', 'un2', 'un3'];
NA_FRAMES.bounce = ['bo0', 'bo1', 'bo2', 'bo3'];
NA_EXTRA.armad = ['curl', 'roll', 'uncurl', 'bounce'];

// позы, которых нет в общей таблице naPose
const NA2_POSE = {
  h0: { x: -2, rot: -0.1, hurt: 1, eye: 2, mouth: 0.5, wing: -1, a: -0.2 },        // вздрогнул
  h1: { x: -4, rot: -0.22, hurt: 0.8, eye: 2, mouth: 0.9, wing: 1, a: -0.4 },      // отшатнулся
  h2: { x: -3, y: 1, rot: -0.12, hurt: 0.45, eye: 2, sq: 0.94, wing: -1, a: -0.1 }, // просел
  h3: { x: -1, rot: -0.03, hurt: 0.15, eye: 1, wing: 0 },                            // выпрямился
};
for (let k = 0; k < 4; k++) {
  NA2_POSE['cu' + k] = { curl: (k + 1) / 4, eye: k < 2 ? 1 : 2, y: 0 };
  NA2_POSE['un' + k] = { curl: 1 - (k + 1) / 4, eye: k > 2 ? 1 : 2, spin: 0 };
  NA2_POSE['bo' + k] = { curl: 1, spin: -k * 0.5, x: -[2, 5, 7, 8][k], y: -[3, 6, 4, 0][k], hurt: k < 2 ? 0.8 : 0.2, bonk: k < 3 ? 1 - k * 0.3 : 0 };
}
for (let k = 0; k < 8; k++) NA2_POSE['ro' + k] = { curl: 1, spin: k / 8 * 6.2832, dust: 1 + (k % 2) };
{
  const _np = naPose;
  naPose = function (n) {
    const X = NA2_POSE[n];
    if (!X) return Object.assign({ curl: 0, spin: 0, dust: 0, bonk: 0 }, _np(n));
    return Object.assign(_np('__'), { curl: 0, spin: 0, dust: 0, bonk: 0 }, X);
  };
}

// =============== Тролли ===============
const NA2_TROLL = {
  troll:  { skin: '#6c9a56', skin2: '#4a7038', belly: '#a2bc80', hair: '#3e5a2c', cloth: '#6a4a2c', wpn: 'club', moss: '#5a8a38', nail: '#d8d0a0' },
  trollS: { skin: '#8c8c88', skin2: '#62625e', belly: '#acaaa0', hair: '#4a4a46', cloth: '#5a4a3a', wpn: 'rock', moss: '#7a9a5a', rock: '#8a7656', nail: '#c8c0a8' },
  trollB: { skin: '#5a8a80', skin2: '#3e6258', belly: '#86aa92', hair: '#2e4a3a', cloth: '#4a5a3a', wpn: 'snag', moss: '#6a9a3a', slime: '#9ad060', nail: '#c8d0a8' },
};

// Тролль: сгорбленная спина с горбом, бочкообразное тело, короткие кривые ноги и огромные ступни,
// длинные руки почти до земли, маленькая голова выдвинута вперёд — длинный нос-картошка, тяжёлая бровь, клыки снизу, уши.
// Облик: лесной — мох на горбу; каменный — каменные наросты и лишайник на спине; болотный — тина и водоросли.
function drawTroll(c, P, kind) {
  const T = NA2_TROLL[kind], k = col => naK(P, col);
  naShadow(c, 17);
  c.save();
  // лёжа (смерть) — приподнят, чтобы пузо и голова не уходили под землю
  c.translate(P.x, P.y - (P.rot < -0.5 ? 9 * Math.min(1, (-P.rot - 0.5) / 1) : 0));
  c.rotate(P.rot);
  c.scale(1, P.sq);
  const SK = k(T.skin), SK2 = k(T.skin2), SK3 = k(shade(T.skin, 0.16)), BL = k(T.belly), sw = P.leg, crouch = P.a < 0 ? -P.a * 2 : 0;
  // ноги: короткие, кривые (колено наружу), огромные ступни с когтями
  const leg = (hx, ph, col, near) => {
    const kx = hx + 2.4 + ph * 2.2, ky = -12 - Math.max(0, ph) * 1.2, fx = hx + 1 + ph * 4.4, fy = -1.6 - Math.max(0, ph) * 1.6;
    naLimb(c, hx, -24 + crouch, kx, ky, near ? 7.4 : 6.8, col);
    naLimb(c, kx, ky, fx, fy, near ? 6 : 5.4, col);
    ellipse(c, fx + 2.2, fy + 0.4, 5.6, 2.4, col);
    for (let n = 0; n < 3; n++) { c.fillStyle = k(T.nail); c.fillRect(fx + 5 + n * 0.2, fy - 1 + n * 1.1, 1.4, 0.9); }
  };
  leg(-5, -sw, SK2, false);
  // дальняя рука: висит почти до земли, кулак-кувалда
  const th2 = P.b > 0.5 ? -1.4 : P.up > 0.5 ? -2.7 : 0.18 - P.a * 0.25 + sw * 0.15;
  const [fx, fy] = naArm(c, -5, -47 + crouch, 14, 13, th2, P.b > 0.5 ? 1.7 : 0.25, 6.4, SK2);
  ellipse(c, fx, fy + 1, 4.4, 3.8, SK2);
  // туловище: широкие плечи, ровная чуть сутулая спина, бочка-пузо
  ellipse(c, 1, -45 + crouch, 13.5, 8.5, SK);
  ellipse(c, 2, -33 + crouch, 15, 15.5, SK);
  ellipse(c, -10.5, -36 + crouch, 4, 11, k(shade(T.skin, -0.12)));
  ellipse(c, 9, -26 + crouch, 8.4, 9.4, BL);
  ellipse(c, 8, -47 + crouch, 7, 4, SK3);
  c.strokeStyle = k(shade(T.belly, -0.25)); c.lineWidth = 0.7;
  for (const y of [-29, -24, -19.5]) { c.beginPath(); c.arc(9.5, y + crouch, 5.4, 0.5, 2.3); c.stroke(); }
  // набедренная повязка из шкуры, рваный край
  poly(c, [[-12, -22], [14, -21], [13, -14], [9, -11], [5, -14], [1, -10], [-3, -14], [-8, -11], [-12, -15]], k(T.cloth));
  c.fillStyle = k(shade(T.cloth, -0.3)); c.fillRect(-12, -22.6, 26, 1.6);
  leg(5, sw, SK, true);
  // облик: мох / каменные наросты / тина — на плечах и спине
  c.save(); c.translate(3, -3 + crouch); c.scale(0.78, 0.9);
  if (kind === 'troll') {
    poly(c, [[-19, -38], [-14, -48], [-4, -51], [6, -47], [12, -42], [6, -41], [0, -44], [-8, -43], [-14, -37]], k(T.moss));
    for (const [x, y, w] of [[-15, -42, 3], [-6, -48, 3.4], [4, -46, 2.6], [-10, -38, 2]]) { c.fillStyle = k(shade(T.moss, -0.3)); c.fillRect(x, y, w, 1.3); }
    for (const [x, y] of [[-12, -46], [0, -49]]) { ellipse(c, x, y, 1.4, 1, k('#c8483a')); c.fillStyle = '#f6ece0'; c.fillRect(x - 0.6, y - 0.6, 0.7, 0.6); }
  } else if (kind === 'trollS') {
    // каменные наросты: плоские валуны на горбу, трещины и рыжий лишайник
    for (const [x, y, r] of [[-14, -42, 4.4], [-6, -48, 5.2], [3, -46, 3.8], [-17, -33, 3.2]])
      naBlob(c, [[x - r, y + r * 0.5], [x - r * 0.7, y - r * 0.6], [x + r * 0.2, y - r], [x + r, y - r * 0.2], [x + r * 0.8, y + r * 0.6]], k(T.rock), 0.3, -0.34);
    c.strokeStyle = k('#4a4640'); c.lineWidth = 0.7;
    for (const [x0, y0, x1, y1] of [[-2, -32, 2, -26], [2, -26, 0, -21], [10, -36, 13, -31]]) { c.beginPath(); c.moveTo(x0, y0 + crouch); c.lineTo(x1, y1 + crouch); c.stroke(); }
    for (const [x, y] of [[-12, -45], [-4, -51], [5, -44], [-15, -30]]) ellipse(c, x, y, 1.6, 1, k('#c8a040'));
    for (const [x, y] of [[-8, -26], [12, -33]]) ellipse(c, x, y + crouch, 2, 1.2, k(T.moss));
  } else {
    poly(c, [[-19, -37], [-13, -47], [-3, -50], [7, -46], [12, -41], [5, -40], [-2, -43], [-10, -41], [-15, -36]], k(T.moss));
    for (const [x, l] of [[-16, 9], [-9, 13], [-1, 11], [6, 8]]) { c.strokeStyle = k('#4a7a2a'); c.lineWidth = 1; c.beginPath(); c.moveTo(x, -42); c.quadraticCurveTo(x + 1.4, -42 + l * 0.5, x + 0.4 + sw, -42 + l); c.stroke(); }
    for (const [x, y] of [[-10, -28], [9, -20], [14, -32]]) { c.fillStyle = k(T.slime); c.fillRect(x, y, 1.2, 2.6); }
  }
  // грива по загривку
  for (let n = 0; n < 4; n++) poly(c, [[2 + n * 2, -48], [-2 + n * 1.6, -54 - (n % 2) * 2], [5 + n * 2, -49]], k(T.hair));
  c.restore();
  // голова: маленькая, низко, вперёд
  const hx = 21 + (P.a > 0.5 ? 3 : 0) - (P.hurt > 0.5 ? 2.5 : 0), hy = -45 + crouch * 1.3 + (P.hurt > 0.5 ? 1.5 : 0) - (P.mouth > 0.9 ? 2 : 0);
  // толстая короткая шея уходит вперёд из плеч
  poly(c, [[7, -52 + crouch], [hx - 3, hy - 6], [hx - 2, hy + 5], [10, -38 + crouch]], SK);
  poly(c, [[7, -52 + crouch], [hx - 3, hy - 6], [hx - 4, hy - 3], [8, -48 + crouch]], SK3);
  // большое ухо-лопух
  poly(c, [[hx - 3, hy - 3], [hx - 11, hy - 9], [hx - 9, hy - 1], [hx - 4, hy + 2.4]], SK2);
  poly(c, [[hx - 4.4, hy - 2], [hx - 9.4, hy - 6.6], [hx - 7.8, hy - 1]], k(shade(T.skin, -0.22)));
  ellipse(c, hx, hy, 7.6, 6.8, SK);
  ellipse(c, hx - 2.6, hy + 0.8, 3.6, 5, SK2);
  // широкая челюсть с нижними клыками
  const jaw = P.mouth > 0.4 ? 2.4 * P.mouth : 0;
  poly(c, [[hx - 3, hy + 2], [hx + 7.4, hy + 2.6], [hx + 8.4, hy + 6 + jaw], [hx + 1, hy + 7.6 + jaw], [hx - 3.6, hy + 5]], SK);
  poly(c, [[hx - 3.6, hy + 5], [hx + 1, hy + 7.6 + jaw], [hx + 8.4, hy + 6 + jaw], [hx + 7.6, hy + 7.4 + jaw], [hx, hy + 8.6 + jaw]], SK2);
  c.fillStyle = '#3a1410'; c.fillRect(hx + 0.6, hy + 3.2, 7.4, 0.9 + jaw);
  poly(c, [[hx + 1.2, hy + 4 + jaw], [hx + 2.2, hy - 0.6], [hx + 3.2, hy + 4 + jaw]], '#f2ead0');
  poly(c, [[hx + 5.4, hy + 4 + jaw], [hx + 6.4, hy - 0.2], [hx + 7.4, hy + 4 + jaw]], '#f2ead0');
  // нос — длинный, свисающий картошкой
  poly(c, [[hx + 2.6, hy - 3.2], [hx + 8.4, hy - 2.2], [hx + 12.6, hy + 1.6], [hx + 12, hy + 4.2], [hx + 8, hy + 3], [hx + 4, hy + 0.8]], k(shade(T.skin, -0.06)));
  ellipse(c, hx + 11.6, hy + 2.8, 2.4, 2, k(shade(T.skin, -0.12)));
  poly(c, [[hx + 3, hy - 3], [hx + 8.4, hy - 2], [hx + 10, hy - 0.6], [hx + 5, hy - 1.4]], SK3);
  c.fillStyle = k(shade(T.skin, -0.45)); c.fillRect(hx + 10.8, hy + 4, 1.4, 0.9);
  // тяжёлая бровь и глазки-бусинки с белком
  ellipse(c, hx + 3.6, hy - 1.6, 1.6, 1.3, P.eye >= 2 ? SK2 : '#f0e8c0');
  naEye(c, hx + 4, hy - 1.6, P, kind === 'trollS' ? '#2a4a6a' : '#3a2a10', 0.8);
  poly(c, [[hx - 1.4, hy - 5.4], [hx + 6.6, hy - 4.2], [hx + 6.2, hy - 2.6], [hx - 1, hy - 3.4]], SK2);
  c.fillStyle = k(T.hair); c.fillRect(hx - 4.4, hy - 7, 5.4, 1.8); c.fillRect(hx - 2.4, hy - 8.4, 2.4, 1.6);
  // ближняя рука и оружие
  const th = naTheta(P);
  const [ax, ay, ang] = naArm(c, 8, -46 + crouch, 14, 13, th, P.up > 0.5 ? 0.2 : -0.35, 7, SK);
  ellipse(c, ax, ay, 4.6, 4, SK);
  for (let n = 0; n < 3; n++) { c.fillStyle = SK2; c.fillRect(ax - 1.6 + n * 1.6, ay - 3.4, 0.7, 2); }
  const [dx, dy] = naDir(ang + 0.15 + (P.up > 0.5 ? 0 : Math.max(0, 1 - Math.abs(P.a) * 1.4) * 0.15));
  if (T.wpn === 'club') {
    const L = 21;
    c.strokeStyle = k('#6a4a28'); c.lineWidth = 4.6; c.beginPath(); c.moveTo(ax - dx * 3, ay - dy * 3); c.lineTo(ax + dx * L, ay + dy * L); c.stroke();
    c.strokeStyle = k('#94703e'); c.lineWidth = 1.2; c.beginPath(); c.moveTo(ax - dx * 3 - 0.8, ay - dy * 3); c.lineTo(ax + dx * L - 0.8, ay + dy * L); c.stroke();
    ellipse(c, ax + dx * L, ay + dy * L, 5.2, 5, k('#6a4a28'));
    c.fillStyle = k('#94703e'); c.fillRect(ax + dx * L - 2.8, ay + dy * L - 2.8, 2.2, 1.6);
    naLimb(c, ax + dx * 13, ay + dy * 13, ax + dx * 13 + dy * 3.4, ay + dy * 13 - dx * 3.4, 1.4, k('#5a3c20'));
  } else if (T.wpn === 'rock') {
    const L = P.a > 0.5 ? 5 : 3.6, bx = ax + dx * L, by = ay + dy * L;
    naBlob(c, [[bx - 7, by - 1], [bx - 4, by - 7], [bx + 4, by - 7], [bx + 8, by], [bx + 4, by + 6], [bx - 5, by + 5]], k('#8a8478'), 0.28, -0.34);
    c.strokeStyle = k('#5a564e'); c.lineWidth = 0.6; c.beginPath(); c.moveTo(bx - 2, by - 5); c.lineTo(bx + 1, by + 1); c.stroke();
    ellipse(c, bx - 2.4, by - 4, 1.8, 1, k('#c8a040'));
  } else {
    const L = 19;
    c.strokeStyle = k('#4a3a26'); c.lineWidth = 3.8; c.beginPath(); c.moveTo(ax - dx * 2, ay - dy * 2);
    c.quadraticCurveTo(ax + dx * L * 0.5 + dy * 3, ay + dy * L * 0.5 - dx * 3, ax + dx * L, ay + dy * L); c.stroke();
    naLimb(c, ax + dx * L, ay + dy * L, ax + dx * (L + 3) - dy * 4, ay + dy * (L + 3) + dx * 4, 2.2, k('#4a3a26'));
    naLimb(c, ax + dx * L, ay + dy * L, ax + dx * (L + 4) + dy * 3, ay + dy * (L + 4) - dx * 3, 2, k('#4a3a26'));
    c.strokeStyle = k(T.slime); c.lineWidth = 0.9; c.beginPath(); c.moveTo(ax + dx * 11, ay + dy * 11); c.lineTo(ax + dx * 11 + 0.6, ay + dy * 11 + 4.4); c.stroke();
  }
  if (P.a > 0.6) { c.strokeStyle = 'rgba(255,255,230,0.75)'; c.lineWidth = 0.9; c.beginPath(); c.arc(ax, ay, 24, ang - 1.3, ang - 0.2); c.stroke(); }
  if (P.b > 0.5) { c.strokeStyle = 'rgba(220,230,200,0.85)'; c.lineWidth = 1; c.beginPath(); c.arc(16, -34, 10, -1.2, 1.2); c.stroke(); }
  if (P.mouth > 0.9) for (const [x, y] of [[hx + 13, hy - 1], [hx + 15, hy + 2.6], [hx + 14, hy + 5.4]]) { c.fillStyle = 'rgba(255,255,255,0.8)'; c.fillRect(x, y, 2.6, 0.9); }
  c.restore();
}


// =============== Броненосец ===============
function drawArmad(c, P) {
  const k = col => naK(P, col), SH = k('#a88a62'), SH2 = k('#7a6244'), SH3 = k('#c8ac80'), SKN = k('#d2a888'), SKN2 = k('#a87e62');
  const ball = P.curl >= 0.5;
  naShadow(c, ball ? 12 : 15);
  c.save();
  c.translate(P.x, P.y);
  if (P.dead) { c.translate(0, -12); c.scale(1, -1); c.translate(0, 12); }      // на спине, лапки вверх
  else if (!ball) c.rotate(P.rot * 0.4);
  if (ball) {
    // шар: радиус растёт со сворачиванием; полосы панциря вращаются, блик — нет
    const r = 9 + P.curl * 3.4, cy = -r - 0.5;
    if (P.dust) for (const [x, y, rr] of [[-r - 4, -2, 2.6], [-r - 8, -3.6, 2], [-r - 11, -1.6, 1.5]]) { c.fillStyle = `rgba(200,180,140,${0.45 - rr * 0.06 + P.dust * 0.08})`; c.beginPath(); c.arc(x - P.dust, y, rr, 0, 7); c.fill(); }
    if (P.curl < 0.9) { naLimb(c, -5, cy + r * 0.7, -6, -1, 2.4, SKN2); naLimb(c, 5, cy + r * 0.7, 6, -1, 2.4, SKN); }   // лапки ещё торчат
    c.save(); c.translate(0, cy);
    ellipse(c, 0, 0, r, r, SH);
    c.save(); c.rotate(P.spin || 0);
    c.strokeStyle = SH2; c.lineWidth = 1.3;
    for (let b = -2; b <= 2; b++) { c.beginPath(); c.ellipse(b * r * 0.32, 0, r * (0.36 - Math.abs(b) * 0.06), r * 0.98, 0, -1.5, 1.5); c.stroke(); }
    c.fillStyle = SH3; for (let b = -2; b <= 2; b++) for (const yy of [-0.55, 0, 0.55]) c.fillRect(b * r * 0.32 - 0.6, yy * r - 0.6, 1.3, 1.3);
    // хвостик и мордочка, спрятанные в шар — видны как полоска
    c.fillStyle = SKN2; c.fillRect(r * 0.55, -1, r * 0.4, 2);
    c.restore();
    c.fillStyle = 'rgba(255,245,220,0.35)'; c.beginPath(); c.ellipse(-r * 0.35, -r * 0.4, r * 0.4, r * 0.25, -0.5, 0, 7); c.fill();    // блик
    c.fillStyle = 'rgba(40,24,10,0.25)'; c.beginPath(); c.ellipse(r * 0.3, r * 0.42, r * 0.6, r * 0.3, 0.3, 0, 7); c.fill();
    c.restore();
    if (P.bonk) {   // отскок: звёздочки и линии удара спереди
      for (let s = 0; s < 3; s++) { const a = s * 2.1 + P.bonk * 3, x = Math.cos(a) * 9, y = cy - r - 3 + Math.sin(a) * 2.4; c.fillStyle = '#fff2a0'; c.fillRect(x - 1.2, y - 0.4, 2.4, 0.8); c.fillRect(x - 0.4, y - 1.2, 0.8, 2.4); }
      c.strokeStyle = `rgba(255,255,230,${0.9 * P.bonk})`; c.lineWidth = 0.8;
      for (const yy of [-6, 0, 6]) { c.beginPath(); c.moveTo(r + 3, cy + yy); c.lineTo(r + 7, cy + yy * 1.4); c.stroke(); }
    }
    c.restore();
    return;
  }
  const sw = P.leg, tuck = P.curl * 2;          // начало сворачивания: голова и хвост подбираются
  const lunge = P.a > 0 ? P.a : 0;
  const leg = (x, ph, near) => {
    naLimb(c, x, -6, x + ph * 2.2, -0.6, 2.8, near ? SKN : SKN2);
    for (let n = 0; n < 3; n++) { c.fillStyle = '#3a2a1a'; c.fillRect(x + ph * 2.2 + n * 0.9 - 0.6, -0.4, 0.6, 1); }
  };
  leg(-9, -sw, false); leg(6, sw, false);
  // хвост
  poly(c, [[-15, -8], [-24 + tuck * 3, -4 - tuck], [-25 + tuck * 3, -2.6 - tuck], [-15, -5]], SH2);
  for (let n = 0; n < 3; n++) { c.fillStyle = SH3; c.fillRect(-18 - n * 2.4 + tuck, -6 + n * 0.6, 1, 1.6); }
  // панцирь-купол с поперечными поясами
  const dome = [[-17, -5], [-16, -12], [-10, -19], [0, -21.5], [9, -19], [14, -12], [15, -5]];
  naBlob(c, dome, SH, 0.24, -0.3);
  c.strokeStyle = SH2; c.lineWidth = 1.2;
  for (let b = -2; b <= 2; b++) { const x = b * 4.6; c.beginPath(); c.moveTo(x - 1.4, -5); c.quadraticCurveTo(x - 0.6, -15, x + 0.2, -20.6 + Math.abs(b) * 1.4); c.stroke(); }
  c.fillStyle = SH3; for (let b = -2; b <= 2; b++) for (const y of [-8, -13, -17]) c.fillRect(b * 4.6 + 1, y + Math.abs(b) * 0.4, 1.3, 1.2);
  c.fillStyle = SH2; c.fillRect(-17, -6, 32, 1.6);
  // голова: длинное рыло, уши-ложки
  const hx = 15 + lunge * 4 - tuck * 3, hy = -9 + lunge * 1.6 + tuck * 2 + (P.hurt > 0.5 ? 1 : 0);
  poly(c, [[hx - 3, hy - 4], [hx + 2, hy - 5], [hx + 9, hy - 1], [hx + 12, hy + 1], [hx + 9, hy + 2.4], [hx - 2, hy + 3]], SKN);
  poly(c, [[hx - 3, hy + 0.4], [hx + 9, hy + 2.4], [hx - 2, hy + 3]], SKN2);
  poly(c, [[hx - 1, hy - 3], [hx + 0.6, hy - 8.4], [hx + 2.6, hy - 3.6]], SKN2);              // ухо
  poly(c, [[hx - 3, hy - 4], [hx + 2, hy - 5], [hx + 4, hy - 2], [hx - 2, hy - 1]], SH);        // щиток на лбу
  ellipse(c, hx + 11.6, hy + 0.8, 1, 0.9, '#3a2418');
  naEye(c, hx + 3.6, hy - 1.6, P, '#1a0f0a', 0.75);
  if (P.mouth > 0.4) { c.fillStyle = '#6a2a2a'; c.fillRect(hx + 5, hy + 1.8, 5, 1.2 * P.mouth); for (const x of [6, 8]) { c.fillStyle = '#fff'; c.fillRect(hx + x, hy + 1.8, 0.8, 0.8); } }
  leg(-5, sw, true); leg(10 - tuck, -sw, true);
  if (P.b > 0.5) { c.strokeStyle = 'rgba(230,220,190,0.9)'; c.lineWidth = 1; c.beginPath(); c.arc(0, -12, 13, -1.6, 0.4); c.stroke(); }   // парирование: подставил панцирь
  if (lunge > 0.6) { c.strokeStyle = 'rgba(255,255,230,0.7)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(hx + 14, hy - 3); c.lineTo(hx + 18, hy - 4); c.moveTo(hx + 14, hy + 3); c.lineTo(hx + 18, hy + 4); c.stroke(); }
  c.restore();
}

// =============== Гоблины ===============
// облик 0 — с ножом и в капюшоне, облик 1 — с копьецом и в шлеме-котелке; выбирается по id при рисовании
function drawGoblin(c, P, alt) {
  const k = col => naK(P, col), SK = k(alt ? '#86b04a' : '#7aa848'), SK2 = k(alt ? '#5e8434' : '#567e32'), CL = k(alt ? '#7a5a3a' : '#6a4a6a'), CL2 = k(alt ? '#5a4028' : '#4a3048');
  naShadow(c, 6);
  c.save();
  c.translate(P.x, P.y);
  c.rotate(P.rot);
  c.scale(1, P.sq);
  const sw = P.leg;
  // тонкие кривые ножки, большие ступни
  naLimb(c, -1.4, -8, -2 - sw * 2.2, -0.8, 1.4, SK2); naLimb(c, 1.4, -8, 2 + sw * 2.2, -0.8, 1.5, SK);
  ellipse(c, -1.6 - sw * 2.2, -0.6, 1.8, 0.7, SK2); ellipse(c, 2.8 + sw * 2.2, -0.6, 1.9, 0.7, SK);
  // дальняя ручка
  naArm(c, -2.6, -14, 3.6, 3.4, P.up > 0.5 ? -2.7 : 0.3 + P.b * 0.4, 0.3, 1.2, SK2);
  // рваная рубаха, сгорбленная спина
  poly(c, [[-4, -15], [3, -15.4], [4.6, -11], [4, -7.4], [2.4, -8.4], [0.6, -7], [-1.4, -8.4], [-3.6, -7.2], [-4.8, -11]], CL);
  poly(c, [[-4, -15], [-1, -15.2], [-1.4, -8.4], [-3.6, -7.2], [-4.8, -11]], CL2);
  c.fillStyle = k('#3a2a1a'); c.fillRect(-4.4, -10.4, 9, 0.9);                                     // поясок
  // голова: крупная, длинный нос, уши-лопасти
  const hx = 1.6 + (P.a > 0.5 ? 1 : 0), hy = -18.6 + (P.hurt > 0.5 ? 0.6 : 0);
  poly(c, [[hx - 2.4, hy - 0.6], [hx - 8.4, hy - 3.6 - (P.eye === 1 ? 1 : 0)], [hx - 2.6, hy + 1.4]], SK2);       // ухо
  ellipse(c, hx, hy, 3.4, 3.1, SK);
  ellipse(c, hx - 1, hy + 0.4, 2, 2.6, SK2);
  poly(c, [[hx + 2, hy - 0.6], [hx + 7, hy + 1.6], [hx + 2.2, hy + 1.4]], SK);                                       // нос
  if (alt) { poly(c, [[hx - 3.8, hy - 1.2], [hx - 3, hy - 4.2], [hx + 3, hy - 4.4], [hx + 3.8, hy - 1.2]], k('#8a8a92')); c.fillStyle = k('#5a5a62'); c.fillRect(hx - 4, hy - 1.6, 8, 0.9); }
  else poly(c, [[hx - 4, hy + 1.6], [hx - 3.6, hy - 3.4], [hx + 1, hy - 4.4], [hx + 2.6, hy - 2.4], [hx + 0.4, hy - 2.6], [hx - 2, hy + 1]], CL2);   // капюшон
  ellipse(c, hx + 1.4, hy - 0.6, 1, 0.9, P.eye >= 2 ? SK2 : '#ffe040');
  if (P.eye < 2) { c.fillStyle = '#1a0f0a'; c.fillRect(hx + 1.6, hy - 1, 0.6, 0.8); } else naEye(c, hx + 1.4, hy - 0.6, P);
  if (P.mouth > 0.3) { c.fillStyle = '#4a1a1a'; c.fillRect(hx + 0.6, hy + 1.6, 2.6, 0.6 + P.mouth); c.fillStyle = '#fff'; c.fillRect(hx + 1, hy + 1.6, 0.6, 0.6); c.fillRect(hx + 2.4, hy + 1.6, 0.6, 0.6); }
  else { c.fillStyle = '#2a1a0a'; c.fillRect(hx + 0.8, hy + 1.6, 2, 0.5); }
  // ближняя ручка с оружием
  const th = naTheta(P);
  const [ax, ay, ang] = naArm(c, 2, -14, 3.8, 3.6, th, -0.4, 1.3, SK);
  const [dx, dy] = naDir(ang + 0.15);
  if (alt) {       // копьецо
    naLimb(c, ax - dx * 5, ay - dy * 5, ax + dx * 9, ay + dy * 9, 0.9, k('#7a5a34'));
    poly(c, [[ax + dx * 9 - dy * 1.2, ay + dy * 9 + dx * 1.2], [ax + dx * 12.6, ay + dy * 12.6], [ax + dx * 9 + dy * 1.2, ay + dy * 9 - dx * 1.2]], k('#c8c8d0'));
  } else {         // зазубренный нож
    poly(c, [[ax - dy * 0.8, ay + dx * 0.8], [ax + dx * 5.6, ay + dy * 5.6], [ax + dx * 4 + dy * 0.8, ay + dy * 4 - dx * 0.8], [ax + dy * 0.8, ay - dx * 0.8]], k('#c0c0c8'));
    c.fillStyle = k('#5a3a20'); c.fillRect(ax - 0.8, ay - 0.8, 1.6, 1.6);
  }
  if (P.a > 0.6) { c.strokeStyle = 'rgba(255,255,230,0.7)'; c.lineWidth = 0.5; c.beginPath(); c.arc(ax, ay, 8, ang - 1.2, ang - 0.2); c.stroke(); }
  if (P.b > 0.5) { c.strokeStyle = 'rgba(220,230,200,0.85)'; c.lineWidth = 0.6; c.beginPath(); c.arc(4, -13, 4.6, -1.2, 1.2); c.stroke(); }
  c.restore();
}

// =============== Гномтавры ===============
// низ — коренастый пони, туловище — бородатый гном. Копейщик колет с наскока, лучник натягивает лук (замах) и стреляет (удар)
function drawGnomtaur(c, P, bow) {
  const k = col => naK(P, col), HC = k(bow ? '#8a6a48' : '#6a5038'), HC2 = k(bow ? '#644a30' : '#4a3626'), MN = k('#2a1e16');
  const SK = k('#e8b890'), SK2 = k('#c08a68'), BR = k(bow ? '#d8d0c0' : '#c86a2a'), LT = k(bow ? '#4a6a3a' : '#6a4a3a'), LT2 = k(bow ? '#344e2a' : '#4a3428');
  naShadow(c, 13);
  c.save();
  c.translate(P.x, P.y);
  if (P.up > 0.5) { c.translate(-8, 0); c.rotate(-0.3 * P.up); c.translate(8, 0); }          // торжество: на дыбы
  if (P.dead) { c.translate(0, -2); c.rotate(-0.12); }
  else c.rotate(P.rot * 0.45);
  c.scale(1, P.sq);
  const sw = P.dead ? 0 : P.leg, lunge = !bow && P.a > 0 ? P.a : 0, dead = P.dead;
  // ноги пони: дальняя пара, потом корпус, потом ближняя
  const leg = (x, ph, near, front) => {
    if (dead) { naLimb(c, x, -6, x + (front ? 5 : -5), -1, 2.4, near ? HC : HC2); return; }
    const lift = Math.max(0, ph) * 2.4;
    naLimb(c, x, -10, x + ph * 2.6 + (front ? lunge * 2 : 0), -5 - lift * 0.4, 2.8, near ? HC : HC2);
    naLimb(c, x + ph * 2.6 + (front ? lunge * 2 : 0), -5 - lift * 0.4, x + ph * 3 + (front ? lunge * 3 : 0), -0.6 - lift, 2.3, near ? HC : HC2);
    ellipse(c, x + ph * 3 + (front ? lunge * 3 : 0), -0.6 - lift, 1.6, 0.9, MN);
  };
  leg(-10, -sw, false, false); leg(5, sw, false, true);
  // хвост
  const tw = P.wing || 0;
  poly(c, [[-14, -16], [-20, -14 + tw], [-21, -7 + tw * 1.4], [-18, -9], [-15, -12]], MN);
  // конский корпус (короткий, бочкой) и попона
  ellipse(c, -3, -13.5, 12.5, 6.2, HC);
  ellipse(c, -4, -11, 10, 3.4, HC2);
  poly(c, [[-9, -19.2], [3, -19.4], [4, -12], [-1, -10], [-8, -10.6]], k(bow ? '#3a6a8a' : '#8a3a3a'));
  c.fillStyle = k('#e8c850'); c.fillRect(-8.4, -11.6, 12, 0.9);
  // гномий торс поверх конской груди
  const tx = 7 + lunge * 2.4 - (P.hurt > 0.5 ? 1.4 : 0), ty = -17;
  poly(c, [[tx - 4, ty + 2], [tx + 4, ty + 2], [tx + 4.6, ty - 6], [tx + 2.6, ty - 10.6], [tx - 2.6, ty - 10.6], [tx - 4.6, ty - 6]], LT);
  poly(c, [[tx - 4, ty + 2], [tx - 0.6, ty + 2], [tx - 1, ty - 10.6], [tx - 2.6, ty - 10.6], [tx - 4.6, ty - 6]], LT2);
  c.fillStyle = k('#5a3a20'); c.fillRect(tx - 4.4, ty - 2, 9, 1.2);
  // дальняя рука: у лучника держит лук перед собой
  let bx = 0, by = 0;
  if (bow) {
    const aim = P.up > 0.5 ? -2.6 : 1.45 + P.b * 0.3 - (P.dead ? 1 : 0);
    [bx, by] = naArm(c, tx - 1.6, ty - 9, 4, 3.8, aim, 0.05, 1.5, SK2);
  } else naArm(c, tx - 2, ty - 9, 4, 3.8, P.up > 0.5 ? -2.7 : 0.6 + P.b * 0.5, 0.4, 1.5, SK2);
  // голова: борода, нос-картошка, шлем (копейщик) или повязка с пером (лучник)
  const hx = tx + 0.6 + (P.a > 0.5 ? 0.8 : 0), hy = ty - 14 + (P.hurt > 0.5 ? 0.8 : 0);
  ellipse(c, hx, hy, 3.4, 3.4, SK);
  poly(c, [[hx - 2.6, hy + 0.6], [hx + 3.6, hy + 0.4], [hx + 3, hy + 5.4], [hx + 0.6, hy + 7.4 + (P.mouth > 0.5 ? 1 : 0)], [hx - 2, hy + 5]], BR);
  ellipse(c, hx + 3.2, hy + 0.4, 1.4, 1.2, SK2);
  if (bow) { c.fillStyle = k('#3a6a8a'); c.fillRect(hx - 3.4, hy - 2.6, 6.8, 1.4); poly(c, [[hx - 3, hy - 2.4], [hx - 7, hy - 7], [hx - 5.6, hy - 2]], k('#e8e0c8')); }
  else { poly(c, [[hx - 3.8, hy - 1], [hx - 3, hy - 4.6], [hx + 3, hy - 4.6], [hx + 3.8, hy - 1]], k('#9a9aa4')); poly(c, [[hx - 0.6, hy - 4.6], [hx, hy - 7.4], [hx + 0.6, hy - 4.6]], k('#9a9aa4')); }
  naEye(c, hx + 1.4, hy - 0.8, P, '#1a0f0a', 0.7);
  if (P.mouth > 0.5) { c.fillStyle = '#5a1a1a'; c.fillRect(hx + 0.6, hy + 2.4, 2, 1); }
  // ближняя рука и оружие
  if (bow) {
    // лук: дуга перед собой у кисти дальней руки; тетиву тянет ближняя рука — на замахе к уху, на выстреле отпущена
    const pull = P.a < 0 ? -P.a : P.a > 0.5 ? 0 : 0.3;
    c.strokeStyle = k('#7a4a20'); c.lineWidth = 1.2; c.beginPath(); c.moveTo(bx - 1, by - 7); c.quadraticCurveTo(bx + 3.6, by, bx - 1, by + 7); c.stroke();
    const sx = bx - 1 - pull * 6, sy = by;
    c.strokeStyle = '#e8e0c8'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(bx - 1, by - 7); c.lineTo(sx, sy); c.lineTo(bx - 1, by + 7); c.stroke();
    naArm(c, tx + 2, ty - 9, 3.4, 3, P.up > 0.5 ? -2.8 : 1.6 + pull * 0.6, -1.2 - pull * 0.4, 1.5, SK);
    if (pull > 0.1 && !P.dead) { naLimb(c, sx, sy, bx + 6, by, 0.6, k('#c8a070')); poly(c, [[bx + 6, by - 1], [bx + 8.2, by], [bx + 6, by + 1]], k('#d0d0d8')); }
    if (P.a > 0.5) { c.strokeStyle = 'rgba(255,255,230,0.7)'; c.lineWidth = 0.5; for (const yy of [-2, 2]) { c.beginPath(); c.moveTo(bx + 6, by + yy); c.lineTo(bx + 14, by + yy * 0.4); c.stroke(); } }
  } else {
    const th = P.up > 0.5 ? -2.8 : P.a < 0 ? 0.9 + P.a * 1.8 : 1.4 + P.a * 0.15;
    const [ax, ay, ang] = naArm(c, tx + 2, ty - 9, 4, 3.8, th, -0.3, 1.6, SK);
    const [dx, dy] = P.a > 0 ? [1, 0.06] : naDir(ang + 0.35);
    naLimb(c, ax - dx * 9, ay - dy * 9, ax + dx * 13, ay + dy * 13, 1.1, k('#8a6038'));
    poly(c, [[ax + dx * 13 - dy * 1.6, ay + dy * 13 + dx * 1.6], [ax + dx * 18, ay + dy * 18], [ax + dx * 13 + dy * 1.6, ay + dy * 13 - dx * 1.6]], k('#d8d8e0'));
    c.fillStyle = k('#c83a3a'); c.fillRect(ax + dx * 12 - 0.8, ay + dy * 12, 1.6, 2);
    if (lunge > 0.6) { c.strokeStyle = 'rgba(255,255,230,0.75)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(ax + dx * 20, ay - 3); c.lineTo(ax + dx * 25, ay - 3.4); c.moveTo(ax + dx * 20, ay + 3); c.lineTo(ax + dx * 25, ay + 3.4); c.stroke(); }
  }
  leg(-6, sw, true, false); leg(9, -sw, true, true);
  if (P.b > 0.5) { c.strokeStyle = 'rgba(220,230,200,0.85)'; c.lineWidth = 0.8; c.beginPath(); c.arc(tx + 6, ty - 6, 7, -1.2, 1.2); c.stroke(); }
  c.restore();
}

NA_SPEC.troll = { name: 'Лесной тролль', w: 200, h: 144, ax: 100, ay: 132, sc: 1.28 };
NA_SPEC.trollS = { name: 'Каменный тролль', w: 200, h: 144, ax: 100, ay: 132, sc: 1.32 };
NA_SPEC.trollB = { name: 'Болотный тролль', w: 200, h: 144, ax: 100, ay: 132, sc: 1.24 };
NA_SPEC.armad = { name: 'Броненосец', w: 100, h: 64, ax: 48, ay: 54, sc: 1.2 };
NA_SPEC.goblin = { name: 'Гоблин', w: 60, h: 56, ax: 28, ay: 48, sc: 1.15 };
NA_SPEC.goblinB = { name: 'Гоблин с копьецом', w: 60, h: 56, ax: 28, ay: 48, sc: 1.15 };
NA_SPEC.gtSpear = { name: 'Гномтавр-копейщик', w: 110, h: 84, ax: 50, ay: 74, sc: 1.2 };
NA_SPEC.gtBow = { name: 'Гномтавр-лучник', w: 110, h: 84, ax: 50, ay: 74, sc: 1.2 };
NA_DRAW.troll = (c, P) => drawTroll(c, P, 'troll');
NA_DRAW.trollS = (c, P) => drawTroll(c, P, 'trollS');
NA_DRAW.trollB = (c, P) => drawTroll(c, P, 'trollB');
NA_DRAW.armad = drawArmad;
NA_DRAW.goblin = (c, P) => drawGoblin(c, P, 0);
NA_DRAW.goblinB = (c, P) => drawGoblin(c, P, 1);
NA_DRAW.gtSpear = (c, P) => drawGnomtaur(c, P, false);
NA_DRAW.gtBow = (c, P) => drawGnomtaur(c, P, true);

// ---------- Логова ----------
NA_LAIR.troll = { name: 'Нора тролля', w: 108, h: 84, ax: 54, ay: 64 };
NA_LAIR.trollS = { name: 'Каменная нора тролля', w: 108, h: 84, ax: 54, ay: 64 };
NA_LAIR.trollB = { name: 'Топкая нора тролля', w: 108, h: 84, ax: 54, ay: 64 };
NA_LAIR.armad = { name: 'Нора броненосца', w: 92, h: 56, ax: 46, ay: 40 };
NA_LAIR.goblin = { name: 'Гоблинский лагерь', w: 112, h: 76, ax: 56, ay: 52 };
NA_LAIR.gnomtaur = { name: 'Стойбище гномтавров', w: 112, h: 92, ax: 56, ay: 70 };

{
  const _lair = naLairDraw;
  naLairDraw = function (c, kind, v) {
    if (!NA2_LAIR_DRAW[kind]) return _lair(c, kind, v);
    NA2_LAIR_DRAW[kind](c, v === 'd', v === '1' ? 1 : 0, kind);
  };
}

function na2TrollLair(c, dead, f, kind) {
  const T = NA2_TROLL[kind];
  const RK = kind === 'trollS' ? '#8a8a86' : kind === 'trollB' ? '#5a6a5a' : '#7a6a56', GR = kind === 'trollB' ? '#3e5a44' : '#4a4430';
  c.fillStyle = GR; c.beginPath(); c.ellipse(0, 2, 40, 9, 0, 0, 7); c.fill();
  if (kind === 'trollB') { c.fillStyle = 'rgba(70,110,90,0.8)'; c.beginPath(); c.ellipse(-14, 5, 16, 4, 0, 0, 7); c.fill(); c.fillStyle = 'rgba(160,210,190,0.5)'; c.fillRect(-22, 4, 6, 0.8); }
  // каменный горб-холм с тёмным зевом
  naBlob(c, [[-38, 2], [-34, -16], [-22, -34], [-4, -44], [14, -40], [30, -26], [38, -8], [40, 2]], dead ? shade(RK, -0.15) : RK, 0.26, -0.34);
  naBlob(c, [[-14, 2], [-15, -14], [-8, -24], [4, -25], [12, -16], [13, 2]], '#120c08', 0.04, -0.2);
  if (!dead) {
    const ec = f ? '#ffe070' : '#e8c040';
    ellipse(c, -3, -13, 1.6, 1.1, ec); ellipse(c, 4, -13, 1.6, 1.1, ec);       // глаза из темноты
    c.save(); c.globalCompositeOperation = 'lighter'; ellipse(c, 0.5, -13, 9, 4, `rgba(240,200,80,${f ? 0.16 : 0.1})`); c.restore();
  }
  // мох / каменные глыбы с лишайником / тина на холме
  if (kind === 'trollS') for (const [x, y, s] of [[-24, -26, 1.4], [18, -34, 1.8], [30, -14, 1.1]]) {
    naBlob(c, [[x - 4 * s, y + 2], [x - 3 * s, y - 2.6 * s], [x + 0.6 * s, y - 4 * s], [x + 4 * s, y - 1.6 * s], [x + 3.4 * s, y + 2]], dead ? '#6a6660' : T.rock, 0.3, -0.34);
    if (!dead) ellipse(c, x - s, y - 2 * s, 1.6 * s, 0.9 * s, '#c8a040');
  }
  else naBlob(c, [[-30, -20], [-18, -36], [-2, -44], [14, -40], [26, -28], [10, -32], [-6, -36], [-20, -28]], dead ? '#6a6a3a' : T.moss, 0.28, -0.3);
  // кости и черепа у входа, дубина у стены
  for (const [x, y, a] of [[-24, 4, 0.2], [18, 5, -0.4], [26, 2, 0.6]]) { naLimb(c, x - Math.cos(a) * 4, y - Math.sin(a) * 1.4, x + Math.cos(a) * 4, y + Math.sin(a) * 1.4, 1.6, '#e8e0c8'); ellipse(c, x - Math.cos(a) * 4, y - Math.sin(a) * 1.4, 1.3, 1.3, '#e8e0c8'); ellipse(c, x + Math.cos(a) * 4, y + Math.sin(a) * 1.4, 1.3, 1.3, '#e8e0c8'); }
  ellipse(c, 30, -3, 3.4, 3.2, '#e6dcc0'); c.fillStyle = '#1a120a'; c.fillRect(28.6, -4, 1.2, 1.4); c.fillRect(31, -4, 1.2, 1.4);
  if (!dead) { naLimb(c, -30, 2, -26, -18, 3.4, '#6a4a28'); ellipse(c, -26, -19, 4, 3.8, '#6a4a28'); }
  else naLimb(c, -34, 2, -14, 4, 3, '#5a4a38');
  // дымок из логова (тролль дышит)
  if (!dead) { naPuff(c, 2 + f * 2, -28 - f * 2, 2.4, 'rgba(220,220,225,A)', 0.35); naPuff(c, 4 + f * 3, -33 - f * 3, 1.8, 'rgba(220,220,225,A)', 0.22); }
}

function na2ArmadLair(c, dead, f) {
  c.fillStyle = dead ? '#6a6450' : '#8a7454'; c.beginPath(); c.ellipse(0, 1, 36, 10, 0, 0, 7); c.fill();
  naBlob(c, [[-30, 2], [-22, -10], [-6, -16], [10, -15], [24, -8], [32, 2]], dead ? '#7a7058' : '#a88a5c', 0.3, -0.3);
  naBlob(c, [[-6, 2], [-7, -6], [-2, -10], [5, -9], [8, -4], [7, 2]], '#1c120a', 0.04, -0.2);
  // разрытая земля и следы лап
  for (const [x, y, r] of [[-20, 4, 2.4], [-14, 6, 1.6], [16, 5, 2], [24, 6, 1.4], [10, 7, 1.2]]) ellipse(c, x, y, r, r * 0.6, dead ? '#6a6048' : '#7a6040');
  c.fillStyle = '#4a3a24'; for (const [x, y] of [[-30, 7], [-26, 8.4], [28, 7], [32, 8]]) for (let n = 0; n < 3; n++) c.fillRect(x + n * 0.9, y, 0.6, 1.2);
  // сухие травинки и сброшенная пластинка панциря
  c.strokeStyle = dead ? '#8a8458' : '#c8b060'; c.lineWidth = 0.8; for (const [x, y] of [[-26, 1], [-18, -2], [20, -1], [28, 2]]) { c.beginPath(); c.moveTo(x, y); c.lineTo(x - 1, y - 5); c.moveTo(x, y); c.lineTo(x + 2, y - 4); c.stroke(); }
  poly(c, [[14, 6], [19, 3.6], [23, 6], [19, 7.6]], '#c8ac80'); c.strokeStyle = '#7a6244'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(16, 5.4); c.lineTo(21, 5.4); c.stroke();
  if (!dead) { ellipse(c, -1, -4, 1.2, 0.9, f ? '#fff0a0' : '#f0d040'); ellipse(c, 3, -4, 1.2, 0.9, f ? '#fff0a0' : '#f0d040'); naPuff(c, 1 + f * 3, -14 - f * 2, 2, 'rgba(210,190,150,A)', 0.3); }
}

function na2GoblinLair(c, dead, f) {
  c.fillStyle = dead ? '#55503e' : '#5a4a32'; c.beginPath(); c.ellipse(0, 1, 46, 12, 0, 0, 7); c.fill();
  const tent = (x, w, h, col) => {
    naBlob(c, [[x - w, 2], [x - w * 0.4, -h * 0.7], [x, -h], [x + w * 0.4, -h * 0.7], [x + w, 2]], dead ? shade(col, -0.2) : col, 0.24, -0.34);
    poly(c, [[x - 2.6, 2], [x - 1, -h * 0.45], [x + 1, -h * 0.45], [x + 2.6, 2]], '#140c06');
    for (const s of [-1, 1]) naLimb(c, x + s * 1, -h + 1, x + s * 4, -h - 5, 1, '#5a3c20');            // жерди торчат над шатром
    c.fillStyle = shade(col, -0.35); for (const [dx, dy] of [[-w * 0.5, -h * 0.3], [w * 0.3, -h * 0.5]]) c.fillRect(x + dx, dy, 3, 2.4);   // заплатки
  };
  if (!dead) { tent(-22, 15, 26, '#8a6a48'); tent(18, 13, 22, '#7a6a52'); }
  else { naLimb(c, -34, 2, -10, -6, 1.6, '#6a5c48'); naLimb(c, -30, 2, -14, 0, 1.4, '#6a5c48'); poly(c, [[-36, 3], [-8, 3], [-14, -3], [-30, -2]], '#6a5a44'); naLimb(c, 8, 2, 28, -2, 1.4, '#6a5c48'); }
  // костёр в середине
  for (let n = 0; n < 6; n++) { const a = n / 6 * 6.283; ellipse(c, Math.cos(a) * 5, 5 + Math.sin(a) * 1.8, 1.6, 1.1, '#7a7468'); }
  naLimb(c, -3, 6, 3, 4, 1.4, '#3a2414'); naLimb(c, -3, 4, 3, 6, 1.4, '#3a2414');
  if (!dead) {
    poly(c, [[-2.6, 5], [0, -3 - f * 2], [2.6, 5]], '#ff8a20'); poly(c, [[-1.2, 5], [0.4, -0.4 - f], [1.4, 5]], '#ffe070');
    c.save(); c.globalCompositeOperation = 'lighter'; ellipse(c, 0, 1, 10, 6, `rgba(255,140,40,${f ? 0.22 : 0.15})`); c.restore();
    naPuff(c, 1 + f * 2, -8 - f * 3, 2, 'rgba(120,110,100,A)', 0.4); naPuff(c, 3 - f, -14 - f * 2, 2.6, 'rgba(120,110,100,A)', 0.25);
  }
  // тотем с черепом и мешки добычи
  naLimb(c, 38, 4, 38, -24, 1.8, '#5a3c20'); ellipse(c, 38, -26, 3, 2.8, dead ? '#b8b09a' : '#e6dcc0'); c.fillStyle = '#1a120a'; c.fillRect(36.6, -27, 1.2, 1.4); c.fillRect(39, -27, 1.2, 1.4);
  for (const [dx, col] of [[-3, '#c83a2a'], [3, '#e8c850']]) naLimb(c, 38, -20, 38 + dx, -14 + (f ? 1 : 0), 0.7, dead ? '#7a7060' : col);   // ленточки на тотеме
  naBlob(c, [[-42, 6], [-41, 0], [-37, -2], [-34, 1], [-34, 6]], '#a08a5a', 0.24, -0.3); naBlob(c, [[26, 8], [27, 3], [31, 2], [33, 5], [32, 8]], '#8a7a4a', 0.24, -0.3);
  c.fillStyle = '#e8c850'; if (!dead) { c.fillRect(-38.6, -1.4, 1.2, 1); c.fillRect(29.6, 2, 1.2, 1); }
  // брошенные кости
  naLimb(c, 10, 9, 16, 7, 1.2, '#e8e0c8'); naLimb(c, -14, 9, -9, 10, 1.2, '#e8e0c8');
}

function na2GnomtaurLair(c, dead, f) {
  c.fillStyle = dead ? '#55553e' : '#5a6a3a'; c.beginPath(); c.ellipse(0, 1, 46, 12, 0, 0, 7); c.fill();
  // большой круглый шатёр с флагом
  const TC = dead ? '#9a8a70' : '#c8a870', TC2 = dead ? '#7a6a52' : '#9a7a4a';
  if (!dead) {
    naBlob(c, [[-26, 2], [-26, -20], [-14, -36], [0, -44], [14, -36], [26, -20], [26, 2]], TC, 0.26, -0.32);
    c.strokeStyle = TC2; c.lineWidth = 1; for (const x of [-16, -6, 6, 16]) { c.beginPath(); c.moveTo(x, 2); c.quadraticCurveTo(x * 0.6, -26, 0, -44); c.stroke(); }
    c.fillStyle = '#3a6a8a'; c.fillRect(-26, -16, 52, 2.4); c.fillStyle = '#c83a3a'; for (let x = -24; x < 26; x += 6) c.fillRect(x, -15.4, 2, 1.2);
    poly(c, [[-5, 2], [-5, -12], [0, -16], [5, -12], [5, 2]], '#1c120a');
    naLimb(c, 0, -44, 0, -60, 1, '#5a3c20');
    poly(c, [[0, -60], [12 + f * 2, -57 + f], [0, -53]], '#c83a3a'); c.fillStyle = '#e8c850'; c.fillRect(3, -58, 2, 2);
  } else {
    naLimb(c, -24, 2, 22, -6, 1.6, '#6a5c48'); poly(c, [[-26, 3], [20, 3], [12, -6], [-18, -4]], TC2); naLimb(c, 0, 2, -6, -20, 1, '#5a3c20');
  }
  // коновязь, сено, колчан стрел и копья в козлах
  naLimb(c, 32, 4, 32, -12, 1.6, '#6a4a28'); naLimb(c, 44, 4, 44, -12, 1.6, '#6a4a28'); naLimb(c, 30, -10, 46, -10, 1.4, '#6a4a28');
  naBlob(c, [[30, 8], [32, 2], [38, 0], [44, 2], [46, 8]], dead ? '#8a8458' : '#d8c060', 0.3, -0.3);
  c.strokeStyle = dead ? '#6a6440' : '#a89040'; c.lineWidth = 0.6; for (const x of [34, 38, 42]) { c.beginPath(); c.moveTo(x, 3); c.lineTo(x + 1, 7); c.stroke(); }
  for (const [x, a] of [[-38, -0.3], [-34, 0.25], [-36, 0]]) { naLimb(c, x, 5, x + a * 14, -18, 0.9, '#8a6038'); if (!dead) poly(c, [[x + a * 14 - 1.2, -17], [x + a * 14 + a * 3, -22], [x + a * 14 + 1.2, -17]], '#d8d8e0'); }
  naBlob(c, [[-28, 6], [-29, -4], [-26, -6], [-24, -4], [-25, 6]], '#7a4a28', 0.24, -0.3);
  if (!dead) for (const x of [-28, -26.6, -25.4]) { naLimb(c, x, -5, x, -9, 0.4, '#c8a070'); c.fillStyle = '#e8e0c8'; c.fillRect(x - 0.6, -10, 1.2, 1.2); }
  // следы копыт и костерок
  c.fillStyle = dead ? '#3a3628' : '#3a3020'; for (const [x, y] of [[-14, 8], [-8, 9.4], [6, 8.6], [14, 9.6], [20, 8]]) { c.beginPath(); c.arc(x, y, 1, 0.3, 2.8); c.fill(); }
  if (!dead) { naSparks(c, [[-12, -30, f], [14, -34, 2 + f], [2, -50, 4]], f * 1.3, 'rgba(255,230,150,A)'); }
}

const NA2_LAIR_DRAW = { troll: na2TrollLair, trollS: na2TrollLair, trollB: na2TrollLair, armad: na2ArmadLair, goblin: na2GoblinLair, gnomtaur: na2GnomtaurLair };
