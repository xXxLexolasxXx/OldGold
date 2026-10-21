'use strict';
// Жаболюды, часть 2 (ЖАБОЛЮДЫ.md): роскошная свайная деревня (несколько домов и тронный зал, мостки по болоту, фонарики, тотемы,
// загон улиток) и дикие малыши — болотная улитка-тяжеловоз, мотылёк-фонарик, водяной тритон (по одному бродят по карте,
// жаболюды берут их в кабалу — frogwild.js). Подключается после frogart.js: переопределяет ftVillage и размер логова.

NA_FRAMES.hurt4 = NA_FRAMES.hurt4 || ['h0', 'h1', 'h2', 'h3'];
NA_LAIR.ftvil = { name: 'Свайная деревня жаболюдов', w: 256, h: 168, ax: 128, ay: 100 };

function ftBridge(c, pts, dead, f) {
  // мостки из досок на сваях: ломаная pts; перила с верёвкой и фонариками на столбах
  const wood = dead ? '#5a4a34' : '#7a5a34', plank = dead ? '#6a5a40' : '#9a7444';
  for (let n = 0; n < pts.length - 1; n++) {
    const [x0, y0] = pts[n], [x1, y1] = pts[n + 1], d = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / d, uy = (y1 - y0) / d;
    naLimb(c, x0, y0, x1, y1, 4.6, wood);
    for (let t = 1.5; t < d; t += 3.2) { const x = x0 + ux * t, y = y0 + uy * t; naLimb(c, x - uy * 2.5, y + ux * 2.5, x + uy * 2.5, y - ux * 2.5, 1.1, plank); }
    if (dead && n % 2) continue;
    for (let t = 0; t <= d; t += 10) { const x = x0 + ux * t, y = y0 + uy * t; naLimb(c, x, y + 2, x, y + 8, 1.5, wood); }
  }
  if (!dead) for (let n = 0; n < pts.length; n++) {
    const [x, y] = pts[n];
    naLimb(c, x, y - 1, x, y - 7, 1.1, wood);
    if (n % 2 === 0) { ellipse(c, x, y - 8.4, 1.5, 1.8, f ? '#fff0a0' : '#ffd860'); c.save(); c.globalCompositeOperation = 'lighter'; ellipse(c, x, y - 8.4, 4.4, 4.4, `rgba(255,220,110,${f ? 0.2 : 0.14})`); c.restore(); }
    if (n) { c.strokeStyle = '#b09060'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(pts[n - 1][0], pts[n - 1][1] - 6); c.quadraticCurveTo((pts[n - 1][0] + x) / 2, (pts[n - 1][1] + y) / 2 - 3.5, x, y - 6); c.stroke(); }
  }
}

function ftHut(c, x, y, s, col, dead, f, lit) {
  const SW = dead ? '#5a4a34' : '#7a5a34';
  for (const dx of [-9, -3, 3, 9]) naLimb(c, x + dx * s, y - 1 * s, x + dx * s, y + 11 * s, 1.6 * s, SW);
  c.fillStyle = dead ? '#4a3a24' : '#5a4228'; c.fillRect(x - 13 * s, y - 2 * s, 26 * s, 2.8 * s);
  naBlob(c, [[x - 10 * s, y - 2 * s], [x - 10 * s, y - 14 * s], [x + 10 * s, y - 14 * s], [x + 10 * s, y - 2 * s]], dead ? '#7a6a4a' : '#a88a5a', 0.2, -0.3);
  naBlob(c, [[x - 15 * s, y - 13 * s], [x - 10 * s, y - 21 * s], [x - 2 * s, y - 28 * s], [x + 2 * s, y - 28 * s], [x + 10 * s, y - 21 * s], [x + 15 * s, y - 13 * s]], dead ? '#8a8458' : col, 0.3, -0.34);
  c.strokeStyle = dead ? '#6a643e' : shade(col, -0.3); c.lineWidth = 0.7 * s;
  for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(x + i * 3.8 * s, y - 13.4 * s); c.lineTo(x + i * 1.3 * s, y - 27 * s); c.stroke(); }
  if (dead) poly(c, [[x - 3 * s, y - 2 * s], [x - 3 * s, y - 9 * s], [x + 3 * s, y - 9 * s], [x + 3 * s, y - 2 * s]], '#1a120a');
  else { ellipse(c, x, y - 7 * s, 3.4 * s, 4 * s, '#1c120a'); ellipse(c, x, y - 6.6 * s, 2 * s, 2.4 * s, f ? '#ffd870' : '#f0c050'); }
  if (!dead && lit) for (const dx of [-7, 7]) ellipse(c, x + dx * s, y - 9 * s, 1.5 * s, 1.5 * s, f ? '#ffe090' : '#f0c060');
}

function ftVillage(c, dead, f) {
  const WT = dead ? '#6a6a50' : '#3f7a78', WT2 = dead ? '#55553e' : '#2e5e60';
  // берег, ил, большой пруд
  c.fillStyle = dead ? '#5a5238' : '#4a5a30'; c.beginPath(); c.ellipse(0, 10, 122, 34, 0, 0, 7); c.fill();
  c.fillStyle = dead ? '#4a4a34' : '#7a6a44'; c.beginPath(); c.ellipse(0, 11, 112, 29, 0, 0, 7); c.fill();
  c.fillStyle = WT; c.beginPath(); c.ellipse(0, 11, 104, 25, 0, 0, 7); c.fill();
  c.fillStyle = WT2; c.beginPath(); c.ellipse(8, 14, 84, 16, 0, 0, 7); c.fill();
  if (dead) {
    c.strokeStyle = '#3a3a28'; c.lineWidth = 0.8;
    for (const [x0, y0, x1, y1] of [[-80, 8, -50, 14], [-50, 14, -20, 8], [-20, 8, 10, 15], [10, 15, 40, 9], [40, 9, 78, 14], [-30, 14, -34, 24], [20, 15, 26, 25]]) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
  } else {
    c.strokeStyle = 'rgba(200,240,235,0.5)'; c.lineWidth = 0.7;
    for (const [x, y, w] of [[-60, 10 + f * 0.8, 8], [-20, 20 - f * 0.8, 9], [30, 16 + f * 0.6, 8], [72, 12 - f * 0.6, 6], [0, 26, 7], [-86, 16, 5]]) { c.beginPath(); c.ellipse(x, y, w, w * 0.28, 0, 0, 7); c.stroke(); }
    for (const [x, y, w, fl] of [[-92, 12, 5, 1], [-48, 24, 4.6, 0], [-8, 28, 5.4, 1], [34, 26, 4.6, 0], [66, 24, 5, 1], [96, 14, 4, 0], [-70, 20, 3.6, 0], [56, 6, 3.6, 0]]) {
      ellipse(c, x, y, w, w * 0.4, '#4aa040'); poly(c, [[x, y], [x + w, y - 0.6], [x + w, y + 0.8]], WT2);
      if (fl) { for (let n = 0; n < 5; n++) { const a = n / 5 * 6.28; ellipse(c, x + Math.cos(a) * 1.7, y - 1.6 + Math.sin(a) * 0.9, 1.1, 0.8, '#f8b8d8'); } ellipse(c, x, y - 1.6, 0.9, 0.7, '#ffe070'); }
    }
  }
  // мостки: от тронного зала к боковым домам, к пристани и тотему
  ftBridge(c, [[0, -6], [-18, -2], [-34, 2]], dead, f);
  ftBridge(c, [[0, -6], [20, -1], [42, 0]], dead, f);
  ftBridge(c, [[-38, 6], [-58, 12], [-78, 14]], dead, f);
  ftBridge(c, [[46, 5], [64, 12], [82, 14]], dead, f);
  ftBridge(c, [[0, -2], [-2, 10], [2, 22], [0, 32]], dead, f);
  ftBridge(c, [[-34, 8], [-40, 22], [-46, 30]], dead, f);
  ftHut(c, -34, 2, 0.95, dead ? '#8a8458' : '#c8b060', dead, f, 1);
  ftHut(c, 42, 0, 0.95, dead ? '#8a8458' : '#b86a48', dead, f, 1);
  ftHut(c, -80, 16, 0.8, dead ? '#8a8458' : '#8aa860', dead, f, 0);
  ftHut(c, 84, 16, 0.8, dead ? '#8a8458' : '#c8b060', dead, f, 0);
  // тронный зал: большой, с бивнями на коньке и знаменем
  {
    const x = 0, y = -12, SW = dead ? '#5a4a34' : '#7a5a34';
    for (const dx of [-16, -8, 0, 8, 16]) naLimb(c, x + dx, y, x + dx, y + 16, 2.2, SW);
    c.fillStyle = dead ? '#4a3a24' : '#5a4228'; c.fillRect(x - 24, y - 2, 48, 4);
    naBlob(c, [[x - 18, y - 2], [x - 18, y - 22], [x + 18, y - 22], [x + 18, y - 2]], dead ? '#7a6a4a' : '#b89a64', 0.2, -0.3);
    naBlob(c, [[x - 30, y - 21], [x - 20, y - 36], [x - 6, y - 50], [x + 6, y - 50], [x + 20, y - 36], [x + 30, y - 21]], dead ? '#8a8458' : '#6a8a4a', 0.3, -0.34);
    c.strokeStyle = dead ? '#6a643e' : '#3e5a2a'; c.lineWidth = 1; for (let i = -4; i <= 4; i++) { c.beginPath(); c.moveTo(x + i * 6.4, y - 21.4); c.lineTo(x + i * 1.5, y - 49); c.stroke(); }
    if (!dead) {
      poly(c, [[x - 3, y - 2], [x - 3, y - 14], [x, y - 17], [x + 3, y - 14], [x + 3, y - 2]], '#1c120a');
      ellipse(c, x, y - 9, 2.6, 4, f ? '#ffd870' : '#f0c050');
      for (const sgn of [-1, 1]) { c.strokeStyle = '#f2ead0'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(x + sgn * 4, y - 49); c.quadraticCurveTo(x + sgn * 14, y - 56, x + sgn * 11, y - 66); c.stroke(); }
      naLimb(c, x, y - 50, x, y - 70, 1.4, '#5a3c20');
      poly(c, [[x, y - 70], [x + 15 + f * 2, y - 67 + f], [x + 11, y - 63], [x + 16 + f * 2, y - 59 + f], [x, y - 58]], '#c04aa0');
      c.fillStyle = '#ffd040'; c.fillRect(x + 4, y - 66, 2.4, 2.4);
      for (const dx of [-12, 12]) ellipse(c, x + dx, y - 10, 1.6, 1.6, f ? '#ffe090' : '#f0c060');
    } else poly(c, [[x - 3, y - 2], [x - 3, y - 10], [x + 3, y - 10], [x + 3, y - 2]], '#1a120a');
  }
  // тотемы с черепом жабы
  for (const [tx, ty, hh] of [[0, 32, 30], [-62, 6, 22], [100, 24, 24]]) {
    naLimb(c, tx, ty, tx, ty - hh, 3, dead ? '#5a4a34' : '#6a4a2a'); naLimb(c, tx - 1, ty, tx - 1, ty - hh, 0.8, dead ? '#7a6a4a' : '#9a7040');
    ellipse(c, tx, ty - hh - 1, 5, 4, dead ? '#b8b09a' : '#e6dcc0');
    c.fillStyle = '#1a120a'; c.fillRect(tx - 3, ty - hh - 3, 2.2, 2.6); c.fillRect(tx + 1, ty - hh - 3, 2.2, 2.6);
    if (!dead) for (const [i, col] of ['#c04aa0', '#5a7ae0', '#ffd040', '#38c8e8'].entries()) { c.strokeStyle = col; c.lineWidth = 1.3; c.beginPath(); c.moveTo(tx - 4 + i * 2.6, ty - hh - 4); c.quadraticCurveTo(tx - 7 + i * 4.6, ty - hh - 12 + (i % 2) * 2, tx - 8 + i * 5.4 + f * (i % 2 ? 1 : -1), ty - hh - 9 + (i % 2) * 4); c.stroke(); }
  }
  // загон улиток справа спереди, сушилка слева, долблёная лодка
  c.strokeStyle = dead ? '#6a5a40' : '#8a6a3a'; c.lineWidth = 1.6;
  for (const [x0, y0, x1, y1] of [[78, 26, 120, 26], [120, 26, 124, 40], [124, 40, 80, 42], [78, 26, 78, 42]]) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
  for (const [x, y] of [[78, 26], [100, 26], [120, 26], [124, 40], [100, 41], [78, 42]]) naLimb(c, x, y, x, y - 7, 1.6, dead ? '#5a4a34' : '#6a4a2a');
  naLimb(c, -100, 30, -100, 12, 1.3, '#6a4a2a'); naLimb(c, -86, 30, -86, 12, 1.3, '#6a4a2a'); naLimb(c, -101, 13, -85, 13, 1.3, '#6a4a2a');
  if (!dead) for (const [x, col] of [[-97, '#a88a62'], [-93, '#8a6a48'], [-89, '#b89a6a']]) poly(c, [[x - 1.8, 14], [x + 1.8, 14], [x + 1.4, 22], [x, 24], [x - 1.2, 22]], col);
  poly(c, [[20, 30], [48, 30], [44, 35], [24, 35]], dead ? '#5a4a34' : '#7a5230');
  naLimb(c, 24, 30, 46, 30, 1, dead ? '#7a6a4a' : '#a07848');
  for (const [x, y, h] of [[-112, 14, 22], [-106, 22, 15], [112, 10, 20], [108, 22, 16], [-70, 36, 12], [64, 38, 13], [30, 38, 10]]) {
    c.strokeStyle = dead ? '#8a8458' : '#5a8a3a'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 1, y - h * 0.6, x + 0.4 + f * 0.8, y - h); c.stroke();
    if (!dead) { c.fillStyle = '#6a4228'; c.fillRect(x + f * 0.8 - 0.6, y - h - 0.2, 1.6, 3.6); }
  }
  if (!dead) {
    naSparks(c, [[-60, -34, f], [60, -30, 2 + f], [-20, -52, 4], [26, -58, 1 + f], [88, -10, 3], [-96, -2, 5]], f * 1.3, 'rgba(190,255,150,A)');
    naPuff(c, 36 + f * 2, -46 - f * 2, 2, 'rgba(210,220,210,A)', 0.2);
  } else {
    naLimb(c, 30, 20, 44, 18, 1.2, '#e8e0c8'); naLimb(c, -50, 22, -42, 24, 1.2, '#e8e0c8');
    ellipse(c, 14, 22, 2.4, 1.8, '#d8d0b8');
  }
}

// =============== Дикие малыши: улитка-тяжеловоз, мотылёк-фонарик, водяной тритон ===============
// Кадры: покой 6 (i0…i5), ходьба/полёт 8 (w0…w7), испуг 4 (h0…h3: прячется, сжимается), радость освобождения 4 (v0…v3).
function drawSnail(c, P) {
  const k = col => naK(P, col), SKN = k('#8fa070'), SKN2 = k('#6a7e52'), SH = k('#a8743c'), SH2 = k('#6e4624');
  naShadow(c, 12);
  c.save(); c.translate(P.x * 0.5, P.y * 0.5); c.rotate(P.rot * 0.5);
  const hide = P.hurt > 0.4, up = P.up > 0.5, st = hide ? 0 : 1, w = Math.sin((P.leg || 0) * 1.6) * 1.2;
  poly(c, [[-14, -0.4], [-11, -4.6], [-3, -5.4 + w * 0.3], [6, -5], [11 + st * 2, -6 - st * 2.4], [14 + st * 2, -3], [12, -0.4]], SKN);
  poly(c, [[-14, -0.4], [12, -0.4], [11, -2], [-12, -2.4]], SKN2);
  c.fillStyle = 'rgba(190,230,200,0.5)'; c.fillRect(-16, -0.6, 6, 0.8);
  if (!hide) {
    const hx = 13, hy = -6 - (up ? 3 : 0);
    ellipse(c, hx + 1.2, hy + 1, 3.6, 3, SKN);
    for (const [dx, a] of [[0.4, 0], [2.6, 1]]) {
      const sway = Math.sin(P.y * 4 + a * 2 + P.wing * 1.4) * 1.1;
      naLimb(c, hx + dx, hy, hx + dx + 1.8 + sway, hy - 5.6 - (up ? 2 : 0), 0.9, SKN2); ellipse(c, hx + dx + 1.8 + sway, hy - 6 - (up ? 2 : 0), 1.1, 1.1, '#1a1a10');
    }
    c.fillStyle = '#2a2018'; c.fillRect(hx + 3.6, hy + 1.2, 1.2, 0.7);
  }
  const sx = hide ? 3 : -3, sy = hide ? -9 : -11;
  ellipse(c, sx, sy, 10, 8.6, SH); ellipse(c, sx - 1.2, sy + 1.4, 7.2, 6.4, SH2);
  c.strokeStyle = k('#c8905a'); c.lineWidth = 0.9; c.beginPath(); c.arc(sx, sy, 6.4, 0.4, 5.6); c.arc(sx, sy, 3.6, 5.2, 0.8, true); c.stroke();
  ellipse(c, sx - 3.4, sy - 6.4, 4.4, 1.9, k('#5a9a38')); ellipse(c, sx + 2, sy - 7, 2.6, 1.3, k('#7ab848'));
  c.restore();
}
NA_SPEC.snail = { name: 'Болотная улитка-тяжеловоз', w: 60, h: 44, ax: 28, ay: 36, sc: 1.2 };
NA_DRAW.snail = drawSnail;

function drawMoth(c, P) {
  const k = col => naK(P, col), up = P.up > 0.5;
  naShadow(c, 7);
  c.save(); c.translate(P.x * 0.4, P.y * 0.4 - 18);
  const fl = P.wing;
  for (const [a0, col, col2, sc] of [[0.18, '#7a9a4c', '#a8c878', 0.85], [-0.12, '#98c060', '#d0ec98', 1]]) {
    c.save(); c.translate(0, 0.6); c.rotate(1.15 + a0 - (fl + 1) * 0.5 - (P.up > 0.5 ? 0.3 : 0)); c.scale(sc, sc);
    ellipse(c, -9, 0, 11.5, 5.4, k(col)); ellipse(c, -9.6, 0.4, 8.2, 3.4, k(col2));
    c.strokeStyle = k('#5a7a34'); c.lineWidth = 0.5; c.beginPath(); c.moveTo(-1, 0); c.lineTo(-17, -1.4); c.moveTo(-3, 0); c.lineTo(-15, 2); c.stroke();
    ellipse(c, -13, 0, 2, 1.8, k('#8a4a9a')); ellipse(c, -13, 0, 0.8, 0.8, '#f4eaff');
    c.restore();
  }
  ellipse(c, 1, 1.4, 3.4, 2.6, k('#d8d4b0'));
  ellipse(c, 6, 0, 2.6, 2.4, k('#e8e4c8'));
  ellipse(c, 7.2, -0.4, 0.8, 0.8, '#1a1a10');
  c.strokeStyle = k('#8a8458'); c.lineWidth = 0.7;
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(7, -1.4); c.quadraticCurveTo(10, -5 - s, 12, -4 + s * 1.5); c.stroke(); }
  ellipse(c, -4.4, 3.6, 3.2, 2.6, k('#d8ff70'));                      // брюшко-фонарик
  c.save(); c.globalCompositeOperation = 'lighter';
  ellipse(c, -4.4, 3.6, 8, 7, `rgba(210,255,110,${0.2 + Math.abs(fl) * 0.08 + (up ? 0.1 : 0)})`); ellipse(c, -4.4, 3.6, 3.4, 3, 'rgba(255,255,200,0.8)');
  c.restore();
  c.restore();
}
NA_SPEC.moth = { name: 'Мотылёк-фонарик', w: 64, h: 62, ax: 30, ay: 48, sc: 1.2 };
NA_DRAW.moth = drawMoth;

function drawNewt(c, P) {
  const k = col => naK(P, col), BK = k('#4a6a34'), BK2 = k('#324a24'), BL = k('#ff9a30'), SP = k('#1c2a14'), hide = P.hurt > 0.4, up = P.up > 0.5;
  naShadow(c, 13);
  c.save(); c.translate(P.x * 0.5, P.y * 0.5);
  const ph = P.leg || 0, cur = hide ? 1.8 : 0.9;
  const seg = [];
  for (let i = 0; i < 8; i++) seg.push([13 - i * 3.6, -3.4 + Math.sin(i * 0.9 + ph * 1.8) * cur + (up ? -Math.max(0, 3 - i) * 1.2 : 0)]);
  const leg = (x, y, p, col) => { naLimb(c, x, y, x + p * 2.2 + 1.4, y + 3.8 - Math.max(0, p) * 1.2, 1.5, col); naLimb(c, x + p * 2.2 + 1.4, y + 3.8 - Math.max(0, p) * 1.2, x + p * 2.2 + 3.4, y + 4.2 - Math.max(0, p) * 1.2, 1.1, col); };
  leg(seg[2][0], seg[2][1] + 1, -ph, BK2); leg(seg[5][0], seg[5][1] + 1, ph, BK2);
  for (let i = 0; i < 7; i++) { const [x0, y0] = seg[i], [x1, y1] = seg[i + 1], w = i < 5 ? 5.4 - i * 0.4 : 3.2 - (i - 5) * 0.9; naLimb(c, x0, y0, x1, y1, w, BK); naLimb(c, x0, y0 + w * 0.22, x1, y1 + w * 0.22, w * 0.55, BL); }
  for (const i of [1, 3, 5]) ellipse(c, seg[i][0], seg[i][1] - 1.4, 0.8, 0.8, SP);
  c.strokeStyle = k('#ff7a20'); c.lineWidth = 0.9; c.beginPath(); c.moveTo(seg[4][0], seg[4][1] - 3); for (let i = 5; i < 8; i++) c.lineTo(seg[i][0], seg[i][1] - 2.4 - (8 - i)); c.stroke();
  leg(seg[2][0] + 2, seg[2][1] + 1.4, ph, BK); leg(seg[5][0] + 2, seg[5][1] + 1.4, -ph, BK);
  const [hx, hy] = seg[0];
  ellipse(c, hx + 2.2, hy - 0.4, 4.6, 3.4, BK); ellipse(c, hx + 2.4, hy + 1.4, 3.6, 1.6, BL);
  ellipse(c, hx + 3.2, hy - 1.8, 1, 1, '#1a1a10'); c.fillStyle = '#2a2018'; c.fillRect(hx + 5.4, hy + 0.2, 1, 0.6);
  c.strokeStyle = k('#e8484a'); c.lineWidth = 0.6;
  for (const d of [-1, 0, 1]) { c.beginPath(); c.moveTo(hx - 0.6, hy - 1); c.lineTo(hx - 3.2, hy - 3.4 + d * 1.6 + (up ? -1.4 : 0)); c.stroke(); }
  c.restore();
}
NA_SPEC.newt = { name: 'Водяной тритон', w: 64, h: 40, ax: 28, ay: 32, sc: 1.2 };
NA_DRAW.newt = drawNewt;
