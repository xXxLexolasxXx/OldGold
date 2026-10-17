'use strict';
// Экран загрузки: ночной лес, большой костёр, девять гномов разных ремёсел
// стоят вокруг, взявшись за руки, а вдали парят призраки и летучие мыши.
// Самодостаточный файл: грузится первым, анимируется, пока тяжёлые скрипты ещё
// скачиваются, и гаснет вместе с экраном загрузки. Рисуется в полном разрешении
// экрана (с учётом devicePixelRatio), объёмно: градиенты, обводка, отсветы огня.

(function () {
  const cv = document.getElementById('load-cv');
  if (!cv) return;
  // Сцена рисуется в крошечный холст (lo) и потом укрупняется без сглаживания: палитра + дизеринг = пиксель-арт
  const vctx = cv.getContext('2d');
  const lo = document.createElement('canvas'), ctx = lo.getContext('2d', { willReadFrequently: true });
  let W = 0, H = 0, DPR = 1, Z = 4, PSc = 4;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const OUT = '#1a0f08';

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    Z = Math.max(1, Math.round(Math.max(2, Math.round(H / 190)) * DPR)); PSc = Z / DPR;
    lo.width = Math.ceil(cv.width / Z); lo.height = Math.ceil(cv.height / Z);
  }
  window.addEventListener('resize', resize);
  resize();
  // линии не тоньше одного пикселя картинки — иначе обводка тает при укрупнении
  const lwd = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'lineWidth');
  Object.defineProperty(ctx, 'lineWidth', { get() { return lwd.get.call(this); }, set(v) { lwd.set.call(this, Math.max(v, PSc * 0.95)); } });

  // Палитра ночного костра: рампы со сдвигом оттенка (тени — лиловые и синие, свет — жёлтый)
  const PAL = '12163a 161a44 221c4c 301f58 462a62 623a68 82485e 6a4a7a 2e2438 442c3c 070a1c 0e1330 1a1840 2a2050 3e2a60 5a3466 7a4260 9c5658 0a1210 10201a 18301f 244a26 36662e 4c8438 1a1410 3a1c14 5c2a1c 8a3e24 b85a2c d88438 f0b048 ffd878 fff0b0 fffbe8 4a141c 7a1c24 b02a2a d84a34 1c2e50 2e5a7e 4a8aa8 8ac0d0 3a5a28 6e8e3a a0b84c 3a2a6a 5a3a82 8a64b0 3a322c 5e544a 8a8070 b8ae98 e0d8c0 f4f0e4 f2c8a0 e4b08a c88a62 3a8a7a 80d8b8 4a3220 7a5230 a8783a e8a850'.split(' ').map(h => { const n = parseInt(h, 16); return [n >> 16, (n >> 8) & 255, n & 255]; });
  const LUT = new Int16Array(32768).fill(-1), BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function nearest(r, g, b) {
    const key = (r >> 3) << 10 | (g >> 3) << 5 | (b >> 3);
    if (LUT[key] >= 0) return LUT[key];
    const R = (r >> 3 << 3) + 4, G = (g >> 3 << 3) + 4, B = (b >> 3 << 3) + 4;
    let best = 0, bd = 1e9;
    for (let i = 0; i < PAL.length; i++) { const p = PAL[i], dr = p[0] - R, dg = p[1] - G, db = p[2] - B, rm = (p[0] + R) / 2; const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db; if (d < bd) { bd = d; best = i; } }
    return LUT[key] = best;
  }
  const qcv = document.createElement('canvas');
  function present() {
    const w = lo.width, h = lo.height;
    const img = ctx.getImageData(0, 0, w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, dz = (BAY[(y & 3) * 4 + (x & 3)] - 7.5) * 0.45;
      const p = PAL[nearest(Math.max(0, Math.min(255, d[o] + dz)), Math.max(0, Math.min(255, d[o + 1] + dz)), Math.max(0, Math.min(255, d[o + 2] + dz)))];
      d[o] = p[0]; d[o + 1] = p[1]; d[o + 2] = p[2]; d[o + 3] = 255;
    }
    qcv.width = w; qcv.height = h; qcv.getContext('2d').putImageData(img, 0, 0);
    vctx.imageSmoothingEnabled = false; vctx.setTransform(1, 0, 0, 1, 0, 0);
    vctx.drawImage(qcv, 0, 0, w * Z, h * Z);
  }

  // ---------- гномы ----------
  const CREW = [
    { hat: '#e0a822', coat: '#6e1c22', beard: '#ece6cc', tool: 'hammer', name: 'builder' },
    { hat: '#c83a28', coat: '#2e5a7e', beard: '#d8d0c0', tool: 'axe', name: 'woodcutter' },
    { hat: '#2e4a7a', coat: '#5e5448', beard: '#b8a888', tool: 'candle', name: 'miner' },
    { hat: '#f0d040', coat: '#6e8e3a', beard: '#c8823a', tool: 'straw', name: 'farmer' },
    { hat: '#f4f0e4', coat: '#c86a3a', beard: '#eae0b0', tool: 'chef', name: 'baker' },
    { hat: '#c8862a', coat: '#5a3a6a', beard: '#9a7a52', tool: 'mug', name: 'brewer' },
    { hat: '#4a3a8a', coat: '#3a2a6a', beard: '#e8e8f0', tool: 'wizard', name: 'enchanter' },
    { hat: '#3a4a6a', coat: '#7a2a2a', beard: '#6a5a40', tool: 'helmet', name: 'armorer' },
    { hat: '#d4a018', coat: '#8a1c22', beard: '#f0e8c8', tool: 'crown', name: 'hero' },
  ];
  const SKIN = ['#f2c8a0', '#e4b08a', '#d8a078'];

  function shade(hex, k) {   // k>0 светлее, k<0 темнее
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const f = k > 0 ? 255 : 0, a = Math.abs(k);
    r = Math.round(r + (f - r) * a); g = Math.round(g + (f - g) * a); b = Math.round(b + (f - b) * a);
    return `rgb(${r},${g},${b})`;
  }

  // свет огня падает слева или справа — по положению гнома
  function bodyGrad(x0, x1, col, lit) {   // lit: +1 свет справа, -1 слева
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    const a = lit > 0 ? x1 : x0, b = lit > 0 ? x0 : x1;
    void a; void b;
    if (lit > 0) { g.addColorStop(0, shade(col, -0.45)); g.addColorStop(0.55, col); g.addColorStop(1, shade(col, 0.3)); }
    else { g.addColorStop(0, shade(col, 0.3)); g.addColorStop(0.45, col); g.addColorStop(1, shade(col, -0.45)); }
    return g;
  }

  function stroke(w) { ctx.lineWidth = w; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; }

  // Один гном: (x, y) — ступни, k — масштаб, view: 'front' | 'back', lit — откуда свет, sway — раскачивание
  function drawGnome(g, x, y, k, view, lit, sway, look) {
    const skin = SKIN[look % 3];
    ctx.save();
    ctx.translate(x, y); ctx.scale(k, k);
    // тень на земле
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath(); ctx.ellipse(0, 2, 26, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(sway * 0.03);
    stroke(2.2);
    // сапоги
    for (const s of [-1, 1]) {
      ctx.fillStyle = bodyGrad(-9, 9, '#4a2e18', lit);
      ctx.beginPath(); ctx.roundRect(s * 7 - 7, -14, 14, 14, 5); ctx.fill(); ctx.stroke();
    }
    // куртка
    ctx.fillStyle = bodyGrad(-22, 22, g.coat, lit);
    ctx.beginPath();
    ctx.moveTo(-17, -14); ctx.quadraticCurveTo(-24, -34, -15, -56); ctx.lineTo(15, -56);
    ctx.quadraticCurveTo(24, -34, 17, -14); ctx.closePath(); ctx.fill(); ctx.stroke();
    // пояс
    ctx.fillStyle = '#3a2412'; ctx.fillRect(-18, -32, 36, 5); ctx.strokeRect(-18, -32, 36, 5);
    ctx.fillStyle = '#e8c850'; ctx.fillRect(-3, -33, 6, 7);
    if (view === 'back') {
      ctx.strokeStyle = shade(g.coat, -0.35); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(0, -56); ctx.lineTo(0, -32); ctx.stroke(); stroke(2.2);
    } else {
      ctx.fillStyle = shade(g.coat, -0.25);
      for (const dy of [-46, -39]) { ctx.beginPath(); ctx.arc(0, dy, 1.6, 0, 7); ctx.fill(); }   // пуговицы
    }
    // орудие на поясе / за спиной
    toolBelt(g.tool, view);
    // голова
    const hy = -68;
    if (view === 'front') {
      // борода: окладистая, до пояса
      ctx.fillStyle = bodyGrad(-17, 17, g.beard, lit);
      ctx.beginPath();
      ctx.moveTo(-15, hy + 2); ctx.quadraticCurveTo(-22, -40, -7, -33);
      ctx.quadraticCurveTo(0, -28, 7, -33); ctx.quadraticCurveTo(22, -40, 15, hy + 2);
      ctx.quadraticCurveTo(0, hy + 14, -15, hy + 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = shade(g.beard, -0.25); ctx.lineWidth = 1;
      for (const dx of [-8, 0, 8]) { ctx.beginPath(); ctx.moveTo(dx, hy + 8); ctx.quadraticCurveTo(dx + 2, -46, dx, -36); ctx.stroke(); }
      stroke(2.2);
    } else {
      ctx.fillStyle = bodyGrad(-17, 17, g.beard, lit);   // борода сзади выглядывает по бокам
      ctx.beginPath(); ctx.ellipse(-14, hy + 10, 5, 12, 0.2, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(14, hy + 10, 5, 12, -0.2, 0, 7); ctx.fill(); ctx.stroke();
    }
    // уши
    ctx.fillStyle = bodyGrad(-20, 20, skin, lit);
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(s * 12, hy - 2); ctx.lineTo(s * 27, hy - 12); ctx.lineTo(s * 13, hy + 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // голова
    const hg = ctx.createRadialGradient(lit * 5, hy - 5, 2, 0, hy, 18);
    hg.addColorStop(0, shade(skin, 0.25)); hg.addColorStop(0.7, skin); hg.addColorStop(1, shade(skin, -0.35));
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(0, hy, 14.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (view === 'front') {
      // нос-картошка, щёки, глаза, усы
      ctx.fillStyle = shade(skin, -0.12);
      ctx.beginPath(); ctx.ellipse(0, hy + 3, 5, 4.4, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = shade('#e08070', 0.1); const ga0 = ctx.globalAlpha; ctx.globalAlpha = ga0 * 0.45;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 9, hy + 5, 3.4, 0, 7); ctx.fill(); }
      ctx.globalAlpha = ga0;
      ctx.fillStyle = '#10100c';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 5.6, hy - 3.5, 1.9, 2.5, 0, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#fff'; for (const s of [-1, 1]) ctx.fillRect(s * 5.6 - 0.5 + lit, hy - 5, 1.3, 1.3);
      ctx.fillStyle = bodyGrad(-12, 12, g.beard, lit);
      ctx.beginPath(); ctx.ellipse(-5, hy + 8, 5.5, 3, 0.25, 0, 7); ctx.ellipse(5, hy + 8, 5.5, 3, -0.25, 0, 7); ctx.fill();
      // густые брови
      ctx.strokeStyle = shade(g.beard, -0.2); ctx.lineWidth = 2.2;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 2.5, hy - 8); ctx.lineTo(s * 9, hy - 7.5); ctx.stroke(); }
      stroke(2.2);
    } else {
      ctx.fillStyle = shade(g.beard, -0.15);   // затылок: волосы
      ctx.beginPath(); ctx.arc(0, hy + 1, 13, 0.1, Math.PI - 0.1); ctx.fill();
    }
    hat(g, view, hy, lit);
    ctx.restore();
  }

  function toolBelt(t, view) {
    ctx.save();
    if (t === 'hammer') { ctx.fillStyle = '#6a4424'; ctx.fillRect(-21, -30, 4, 18); ctx.fillStyle = '#8a8a92'; ctx.fillRect(-24, -34, 10, 6); ctx.strokeRect(-24, -34, 10, 6); }
    else if (t === 'axe') { ctx.fillStyle = '#6a4424'; ctx.fillRect(-21, -34, 3.4, 22); ctx.fillStyle = '#b8bcc0'; ctx.beginPath(); ctx.moveTo(-18, -34); ctx.lineTo(-8, -38); ctx.lineTo(-10, -26); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    else if (t === 'mug') { ctx.fillStyle = '#c89a4a'; ctx.beginPath(); ctx.roundRect(-26, -30, 9, 11, 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#f4f0e0'; ctx.fillRect(-26, -32, 9, 3); }
    else if (t === 'candle' || t === 'straw' || t === 'chef' || t === 'wizard' || t === 'helmet' || t === 'crown') { /* на шапке */ }
    ctx.restore();
    void view;
  }

  function hat(g, view, hy, lit) {
    ctx.save();
    const tip = g.tool === 'wizard' ? 54 : 40;
    const bend = g.tool === 'wizard' ? 10 : 22;
    const fillHat = bodyGrad(-18, 18, g.hat, lit);
    if (g.tool === 'straw') {   // соломенная шляпа с полями
      ctx.fillStyle = bodyGrad(-30, 30, '#e4c658', lit);
      ctx.beginPath(); ctx.ellipse(0, hy - 8, 30, 8, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-14, hy - 10); ctx.quadraticCurveTo(-12, hy - 34, 0, hy - 36); ctx.quadraticCurveTo(12, hy - 34, 14, hy - 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#8a3a22'; ctx.fillRect(-14, hy - 15, 28, 4);
    } else if (g.tool === 'chef') {   // поварской колпак
      ctx.fillStyle = bodyGrad(-18, 18, '#f4f0e4', lit);
      ctx.beginPath(); ctx.roundRect(-12, hy - 20, 24, 14, 3); ctx.fill(); ctx.stroke();
      for (const [dx, dy, r] of [[-9, -30, 8], [0, -36, 10], [9, -30, 8]]) { ctx.beginPath(); ctx.arc(dx, hy + dy + 6, r, 0, 7); ctx.fill(); ctx.stroke(); }
    } else if (g.tool === 'helmet') {   // стальной шлем с гребнем
      ctx.fillStyle = bodyGrad(-18, 18, '#9a9ea8', lit);
      ctx.beginPath(); ctx.moveTo(-15, hy - 5); ctx.quadraticCurveTo(-16, hy - 30, 0, hy - 32); ctx.quadraticCurveTo(16, hy - 30, 15, hy - 5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#7a2a2a'; ctx.beginPath(); ctx.moveTo(-3, hy - 32); ctx.quadraticCurveTo(0, hy - 46, 3, hy - 32); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#6a6e78'; ctx.fillRect(-16, hy - 9, 32, 4);
    } else {
      // колпак-конус с загнутым кончиком
      ctx.fillStyle = fillHat;
      ctx.beginPath();
      ctx.moveTo(-16, hy - 6); ctx.quadraticCurveTo(-12, hy - tip * 0.7, 2, hy - tip);
      ctx.quadraticCurveTo(bend * 0.9, hy - tip - 4, bend, hy - tip + 10);
      ctx.quadraticCurveTo(8, hy - tip * 0.45, 16, hy - 6);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, hy - 6, 18, 5, 0, 0, 7); ctx.fillStyle = shade(g.hat, -0.15); ctx.fill(); ctx.stroke();
      if (g.tool === 'wizard') {
        ctx.fillStyle = '#f0e090';
        for (const [dx, dy] of [[-3, -22], [4, -34], [-6, -40]]) { ctx.beginPath(); ctx.arc(dx, hy + dy, 1.8, 0, 7); ctx.fill(); }
      }
      if (g.tool === 'candle') {   // свеча на колпаке шахтёра
        ctx.fillStyle = '#f4ecd0'; ctx.fillRect(-3, hy - 16, 5, 9); ctx.strokeRect(-3, hy - 16, 5, 9);
        const fl = 1 + Math.sin(performance.now() / 90) * 0.15;
        ctx.fillStyle = '#ffd860'; ctx.beginPath(); ctx.ellipse(0, hy - 21, 2.6, 5 * fl, 0, 0, 7); ctx.fill();
      }
      if (g.tool === 'crown') {   // золотая тесьма героя и перо
        ctx.fillStyle = '#ffd860'; ctx.fillRect(-15, hy - 10, 30, 3.5);
        ctx.fillStyle = '#e8e0c0'; ctx.beginPath(); ctx.moveTo(8, hy - 12); ctx.quadraticCurveTo(22, hy - 26, 18, hy - 40); ctx.quadraticCurveTo(12, hy - 28, 8, hy - 12); ctx.fill(); ctx.stroke();
      }
    }
    void view;
    ctx.restore();
  }

  // Руки, сцепленные с соседями: из плеч к общей точке над землёй
  function drawArm(x0, y0, x1, y1, k, col) {
    ctx.save();
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + 6 * k;
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUT; ctx.lineWidth = 11 * k;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my + 8 * k, x1, y1); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 7.6 * k;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my + 8 * k, x1, y1); ctx.stroke();
    ctx.restore();
  }
  function drawHand(x, y, k) {
    ctx.fillStyle = '#e4b08a'; ctx.strokeStyle = OUT; ctx.lineWidth = 2 * k;
    ctx.beginPath(); ctx.arc(x, y, 5.2 * k, 0, 7); ctx.fill(); ctx.stroke();
  }

  // ---------- нечисть вдали ----------
  const flyers = [];
  for (let i = 0; i < 4; i++) flyers.push({ kind: 'ghost', x: rnd(0, 1), y: rnd(0.12, 0.34), s: rnd(0.7, 1.15), v: rnd(0.006, 0.014) * (Math.random() < 0.5 ? -1 : 1), ph: rnd(0, 7) });
  for (let i = 0; i < 6; i++) flyers.push({ kind: 'bat', x: rnd(0, 1), y: rnd(0.08, 0.3), s: rnd(0.6, 1), v: rnd(0.03, 0.06) * (Math.random() < 0.5 ? -1 : 1), ph: rnd(0, 7) });
  for (let i = 0; i < 3; i++) flyers.push({ kind: 'wisp', x: rnd(0, 1), y: rnd(0.3, 0.5), s: 1, v: rnd(0.01, 0.02), ph: rnd(0, 7) });

  function drawGhost(f, t) {
    const sz = Math.min(W, H) * 0.075 * f.s, x = f.x * W, y = f.y * H + Math.sin(t * 0.9 + f.ph) * 10;
    const dir = f.v > 0 ? 1 : -1;
    ctx.save(); ctx.translate(x, y); ctx.scale(dir * sz / 40, sz / 40);
    ctx.globalAlpha = 0.5;
    const g = ctx.createLinearGradient(0, -40, 0, 50);
    g.addColorStop(0, 'rgba(220,235,255,0.95)'); g.addColorStop(1, 'rgba(130,160,210,0.05)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-26, 40);
    ctx.quadraticCurveTo(-34, -10, -16, -34); ctx.quadraticCurveTo(0, -48, 16, -34); ctx.quadraticCurveTo(34, -10, 26, 40);
    for (let i = 0; i < 5; i++) { const px = 26 - i * 13, w = Math.sin(t * 3 + i + f.ph) * 7; ctx.quadraticCurveTo(px - 6.5, 58 + w, px - 13, 40 + w * 0.3); }
    ctx.closePath(); ctx.fill();
    // руки-клочья
    ctx.beginPath(); ctx.moveTo(-24, -4); ctx.quadraticCurveTo(-46, 8 + Math.sin(t * 2 + f.ph) * 8, -40, 24); ctx.quadraticCurveTo(-34, 8, -22, 8); ctx.fill();
    ctx.beginPath(); ctx.moveTo(24, -4); ctx.quadraticCurveTo(46, 4 + Math.sin(t * 2.2 + f.ph) * 8, 42, 22); ctx.quadraticCurveTo(34, 6, 22, 8); ctx.fill();
    // чёрные глазницы и пасть
    ctx.globalAlpha = 0.85; ctx.fillStyle = '#0a0c18';
    ctx.beginPath(); ctx.ellipse(-8, -16, 4.6, 7, 0.15, 0, 7); ctx.ellipse(8, -16, 4.6, 7, -0.15, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 0, 5, 8 + Math.sin(t * 4 + f.ph) * 2, 0, 0, 7); ctx.fill();
    ctx.restore();
  }

  function drawBat(f, t) {
    const sz = Math.min(W, H) * 0.028 * f.s, x = f.x * W, y = f.y * H + Math.sin(t * 2 + f.ph) * 14;
    const flap = Math.sin(t * 14 + f.ph);
    ctx.save(); ctx.translate(x, y); ctx.scale(f.v > 0 ? 1 : -1, 1); ctx.scale(sz / 20, sz / 20);
    ctx.fillStyle = '#0d0a12';
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(s * 14, -16 * flap - 4, s * 30, -4 * flap);
      ctx.quadraticCurveTo(s * 24, 6, s * 18, 4); ctx.quadraticCurveTo(s * 12, 10, s * 7, 4); ctx.quadraticCurveTo(s * 3, 8, 0, 6);
      ctx.fill();
    }
    ctx.beginPath(); ctx.ellipse(0, 2, 5, 7, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(-3, -11); ctx.lineTo(0, -5); ctx.lineTo(3, -11); ctx.lineTo(4, -4); ctx.fill();
    ctx.fillStyle = '#ff6040'; ctx.fillRect(-3, -2, 1.6, 1.6); ctx.fillRect(1.6, -2, 1.6, 1.6);
    ctx.restore();
  }

  function drawWisp(f, t) {
    const x = f.x * W, y = f.y * H + Math.sin(t * 1.4 + f.ph) * 18, r = Math.min(W, H) * 0.012;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 6);
    g.addColorStop(0, 'rgba(160,255,200,0.9)'); g.addColorStop(0.25, 'rgba(90,220,160,0.35)'); g.addColorStop(1, 'rgba(60,180,140,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 6, 0, 7); ctx.fill();
  }

  // ---------- фон ----------
  const stars = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random() * 0.5, r: rnd(0.4, 1.4), p: rnd(0, 7) }));
  const trees = Array.from({ length: 34 }, () => ({ x: Math.random(), h: rnd(0.12, 0.3), w: rnd(0.025, 0.05), layer: Math.random() }));
  const sparks = [];
  const tufts = Array.from({ length: 120 }, () => ({ x: Math.random(), y: rnd(0.6, 1), h: rnd(4, 10) }));

  function drawBackground(t) {
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.62);
    sky.addColorStop(0, '#0a0d24'); sky.addColorStop(0.55, '#2a1c4a'); sky.addColorStop(1, '#6a3a4a');
    ctx.fillStyle = sky; ctx.fillRect(0, -240, W, H + 480);
    for (const s of stars) {
      ctx.globalAlpha = 0.45 + 0.4 * Math.sin(t * 1.5 + s.p);
      ctx.fillStyle = '#fff6d8'; ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // луна
    const mx = W * 0.78, my = H * 0.16, mr = Math.min(W, H) * 0.07;
    const mg = ctx.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 4);
    mg.addColorStop(0, 'rgba(255,240,200,0.35)'); mg.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, mr * 4, 0, 7); ctx.fill();
    const mm = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr);
    mm.addColorStop(0, '#fffbe8'); mm.addColorStop(1, '#e0d090');
    ctx.fillStyle = mm; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(160,140,90,0.3)';
    for (const [dx, dy, r] of [[-0.3, -0.1, 0.18], [0.25, 0.25, 0.22], [0.1, -0.4, 0.12]]) { ctx.beginPath(); ctx.arc(mx + dx * mr, my + dy * mr, r * mr, 0, 7); ctx.fill(); }
    // холмы и далёкий лес слоями
    const hill = (yb, amp, col, ph) => {
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 10) ctx.lineTo(x, H * yb + Math.sin(x / W * 5 + ph) * amp * H + Math.sin(x / W * 13 + ph) * amp * H * 0.3);
      ctx.lineTo(W, H); ctx.fill();
    };
    hill(0.52, 0.03, '#1d1838', 1); hill(0.58, 0.035, '#16162e', 3);
    for (const tr of trees.filter(q => q.layer < 0.55)) pine(tr.x * W, H * 0.6, tr.h * H * 0.8, tr.w * W * 0.8, '#10132a');
    hill(0.63, 0.03, '#10182a', 5);
    for (const tr of trees.filter(q => q.layer >= 0.55)) pine(tr.x * W, H * 0.68, tr.h * H, tr.w * W, '#0a1420');
    // земля
    const gr = ctx.createLinearGradient(0, H * 0.66, 0, H);
    gr.addColorStop(0, '#1c2a1a'); gr.addColorStop(1, '#0c140c');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(0, H * 0.7);
    for (let x = 0; x <= W; x += 12) ctx.lineTo(x, H * 0.7 + Math.sin(x / W * 7) * 0.008 * H);
    ctx.lineTo(W, H + 240); ctx.lineTo(0, H + 240); ctx.fill();
  }
  function pine(x, yb, h, w, col) {
    ctx.fillStyle = col; ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const y0 = yb - h * (i / 4), y1 = yb - h * ((i + 1.15) / 4), ww = w * (1 - i * 0.2);
      ctx.moveTo(x - ww, y0); ctx.lineTo(x, y1); ctx.lineTo(x + ww, y0); ctx.closePath();
    }
    ctx.fill(); ctx.fillRect(x - w * 0.08, yb, w * 0.16, h * 0.05);
  }

  // ---------- костёр ----------
  function drawFireBase(cx, cy, s) {
    // обложенный камнями круг и кострище
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2, rx = 46 * s, ry = 15 * s;
      const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
      const g = ctx.createRadialGradient(x - 2 * s, y - 3 * s, 1, x, y, 9 * s);
      g.addColorStop(0, '#8a8478'); g.addColorStop(1, '#3a362e');
      ctx.fillStyle = g; ctx.strokeStyle = OUT; ctx.lineWidth = 1.6 * s;
      ctx.beginPath(); ctx.ellipse(x, y, 8 * s, 5.6 * s, 0, 0, 7); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = '#1a0e08'; ctx.beginPath(); ctx.ellipse(cx, cy, 38 * s, 11 * s, 0, 0, 7); ctx.fill();
    // поленья
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.6 * s;
    for (const [a, c1] of [[-0.35, '#6a4424'], [0.35, '#7a5230'], [0, '#5a3a1e']]) {
      ctx.save(); ctx.translate(cx, cy - 2 * s); ctx.rotate(a);
      ctx.fillStyle = c1; ctx.beginPath(); ctx.roundRect(-30 * s, -5 * s, 60 * s, 10 * s, 5 * s); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8a050'; ctx.beginPath(); ctx.ellipse(30 * s, 0, 3 * s, 5 * s, 0, 0, 7); ctx.fill();
      ctx.restore();
    }
  }
  function drawFlames(cx, cy, s, t) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const layers = [[1, 'rgba(255,90,20,0.55)', 46], [0.78, 'rgba(255,160,40,0.7)', 40], [0.5, 'rgba(255,230,120,0.85)', 30], [0.26, 'rgba(255,255,230,0.9)', 18]];
    for (const [sc, col, w] of layers) {
      for (let i = 0; i < 7; i++) {
        const ph = i * 1.7 + sc * 3, fl = Math.sin(t * 6 + ph), fl2 = Math.sin(t * 9.3 + ph * 1.3);
        const bx = cx + (i - 3) * (w / 4) * s * 0.55, h = (70 + 30 * fl + 14 * fl2) * s * sc * (1 - Math.abs(i - 3) * 0.14);
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(bx - w * 0.2 * s, cy - 6 * s);
        ctx.quadraticCurveTo(bx - w * 0.25 * s + fl * 4, cy - h * 0.55, bx + fl2 * 7 * s, cy - h);
        ctx.quadraticCurveTo(bx + w * 0.25 * s + fl * 4, cy - h * 0.55, bx + w * 0.2 * s, cy - 6 * s);
        ctx.fill();
      }
    }
    ctx.restore();
  }
  function emitSparks(cx, cy, s, dt) {
    if (Math.random() < dt * 40) sparks.push({ x: cx + rnd(-20, 20) * s, y: cy - 20 * s, vx: rnd(-18, 18) * s, vy: rnd(-90, -40) * s, life: 0, max: rnd(1.2, 2.6), r: rnd(1, 2.6) });
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i]; p.life += dt; p.x += (p.vx + Math.sin(p.life * 4 + i) * 12) * dt; p.y += p.vy * dt; p.vy *= 0.995;
      if (p.life > p.max) sparks.splice(i, 1);
    }
  }
  function drawSparks() {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const p of sparks) {
      const a = 1 - p.life / p.max;
      ctx.fillStyle = `rgba(255,${Math.round(150 + 90 * a)},60,${a})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.5 + a * 0.5), 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  // ---------- гномы-работяги по краям: вышли, сделали дело, растворились ----------
  let U = 1;
  const stage = { actors: [], next: 1.2, flash: 0, fx: [] };
  const rr = (a, b) => a + Math.random() * (b - a);

  function drawHen(x, y, s, dir, ph, peck) {
    ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 1, 12, 3.5, 0, 0, 7); ctx.fill();
    const leg = Math.sin(ph) * 3;
    ctx.strokeStyle = '#d8902a'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-2, -8); ctx.lineTo(-2 + leg, 0); ctx.moveTo(3, -8); ctx.lineTo(3 - leg, 0); ctx.stroke();
    stroke(1.6);
    const g = ctx.createRadialGradient(-3, -16, 2, 0, -12, 16); g.addColorStop(0, '#fff8ec'); g.addColorStop(1, '#c8b8a0');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -12, 11, 8.5, -0.1, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e8d8c0'; ctx.beginPath(); ctx.moveTo(-9, -16); ctx.quadraticCurveTo(-18, -22, -14, -10); ctx.quadraticCurveTo(-11, -12, -9, -10); ctx.fill(); ctx.stroke();
    const hy = peck ? -9 + Math.sin(ph * 2) * 3 : -21, hx = peck ? 13 : 9;
    ctx.fillStyle = '#fff8ec'; ctx.beginPath(); ctx.arc(hx, hy, 5, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e8a030'; ctx.beginPath(); ctx.moveTo(hx + 4, hy - 1.5); ctx.lineTo(hx + 10, hy + 0.5); ctx.lineTo(hx + 4, hy + 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d83a2a'; ctx.beginPath(); ctx.arc(hx - 1, hy - 5, 2.4, 0, 7); ctx.arc(hx + 2, hy - 4.4, 1.8, 0, 7); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(hx + 1.5, hy - 1, 0.9, 0, 7); ctx.fill();
    ctx.restore();
  }

  // руки в координатах гнома (ступни в 0,0, плечи на высоте -50)
  function hands(l, r, col) {
    if (l) { drawArm(-13, -50, l[0], l[1], 1, col); drawHand(l[0], l[1], 1); }
    if (r) { drawArm(13, -50, r[0], r[1], 1, col); drawHand(r[0], r[1], 1); }
  }
  const sline = (x0, y0, x1, y1, w, col) => {
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUT; ctx.lineWidth = w + 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  };
  // облачко частиц в мировых координатах
  const puff = (x, y, col, n, up) => { for (let i = 0; i < n; i++) stage.fx.push({ x, y, vx: rr(-25, 25), vy: -rr(up * 0.4, up), life: 0, max: rr(0.6, 1.3), r: rr(2, 5), col }); };
  // точка в локальных координатах гнома -> мир
  const wp = (a, lx, ly) => [a.x + lx * a.k * a.dir, a.y + ly * a.k];

  // Сценки: draw(a, s, g) рисует орудие и руки в координатах гнома
  const SKITS = {
    dig: { dur: 6, draw(a, s, g) {
      const p = (s * 0.9) % 1;
      const up = p < 0.55 ? Math.sin(p / 0.55 * Math.PI * 0.5) : Math.max(0, 1 - (p - 0.55) / 0.15);
      const bx = 34, by = -26 * up, tx = bx - 8, ty = by - 52;
      sline(bx, by, tx, ty, 3.2, '#8a6030');
      ctx.fillStyle = '#a0a8b0'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(bx - 6, by - 2); ctx.lineTo(bx + 6, by - 2); ctx.lineTo(bx + 4, by + 9); ctx.lineTo(bx - 4, by + 9); ctx.closePath(); ctx.fill(); ctx.stroke();
      hands([tx + 3, ty + 16], [tx + 1, ty + 5], g.coat);
      const k = Math.floor(s * 0.9);
      if (a.k2 !== k && p > 0.6) { a.k2 = k; a.cnt = (a.cnt || 0) + 1; const [wx, wy] = wp(a, 34, 0); puff(wx, wy, '#8a6a3a', 6, 60); }
      const m = Math.min(a.cnt || 0, 5);
      ctx.fillStyle = '#1a0e06'; ctx.beginPath(); ctx.ellipse(34, 1, 9, 3, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#5a3c20'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(56, 0, 6 + m * 3, 2 + m * 1.8, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
    } },
    sow: { dur: 6, draw(a, s, g) {
      const p = (s * 1.2) % 1, sw = Math.sin(p * Math.PI);
      ctx.fillStyle = '#c8b070'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(-16, -30, 8, 10, 0.2, 0, 7); ctx.fill(); ctx.stroke();
      hands([-14, -34], [8 + sw * 30, -44 + sw * 6], g.coat);
      const k = Math.floor(s * 1.2);
      if (a.k2 !== k) { a.k2 = k; a.seeds = a.seeds || []; for (let i = 0; i < 5; i++) a.seeds.push({ x: rr(32, 70), g: 0 }); }
      for (const sd of a.seeds || []) {
        sd.g = Math.min(1, sd.g + 0.01); const h = sd.g * 14;
        ctx.strokeStyle = '#4a8a22'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sd.x, 0); ctx.lineTo(sd.x, -h); ctx.stroke();
        if (sd.g > 0.5) { ctx.fillStyle = '#e8c850'; ctx.beginPath(); ctx.ellipse(sd.x, -h - 2, 1.6, 3.4, 0, 0, 7); ctx.fill(); }
      }
    } },
    chop: { dur: 6, draw(a, s, g) {
      ctx.fillStyle = '#7a5230'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.roundRect(34, -16, 22, 16, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c8a070'; ctx.beginPath(); ctx.ellipse(45, -16, 11, 4, 0, 0, 7); ctx.fill(); ctx.stroke();
      const p = (s * 1.1) % 1, sw = p < 0.6 ? p / 0.6 : 1 - (p - 0.6) / 0.4;   // замах медленно, удар быстро
      const hx = 16, hy = -48, ang = -2.1 + (1 - sw) * 1.9;
      const ax = hx + Math.cos(ang) * 38, ay = hy + Math.sin(ang) * 38 * -1 * -1;
      sline(hx, hy, ax, ay, 3, '#7a5230');
      ctx.fillStyle = '#b8bcc0'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(ax, ay, 6, 0, 7); ctx.fill(); ctx.stroke();
      hands([hx - 2, hy + 4], [hx + 4, hy + 2], g.coat);
      const k = Math.floor(s * 1.1);
      if (a.k2 !== k && p > 0.92) { a.k2 = k; const [wx, wy] = wp(a, 45, -16); puff(wx, wy, '#e8c890', 5, 50); }
    } },
    hammer: { dur: 6, draw(a, s, g) {
      ctx.fillStyle = '#4a4a54'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(24, -22); ctx.lineTo(56, -22); ctx.lineTo(50, -14); ctx.lineTo(46, -8); ctx.lineTo(50, 0); ctx.lineTo(30, 0); ctx.lineTo(34, -8); ctx.lineTo(30, -14); ctx.closePath(); ctx.fill(); ctx.stroke();
      const p = (s * 1.6) % 1, heat = 0.5 + 0.5 * Math.sin(s * 3);
      ctx.fillStyle = `rgba(255,${Math.round(110 + 80 * heat)},40,0.95)`; ctx.beginPath(); ctx.roundRect(32, -27, 14, 5, 2); ctx.fill();
      const up = p < 0.5 ? Math.sin(p / 0.5 * Math.PI * 0.5) : 1 - (p - 0.5) / 0.5;
      const hx = 20 + up * 4, hy = -52 - up * 14, hd = hy - 8 + (1 - up) * 18;
      sline(hx, hy, hx + 14, hd, 3, '#6a4424');
      ctx.fillStyle = '#7a7a84'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.roundRect(hx + 9, hd - 6, 12, 9, 2); ctx.fill(); ctx.stroke();
      hands([hx - 2, hy + 2], [hx + 4, hy + 4], g.coat);
      const k = Math.floor(s * 1.6);
      if (a.k2 !== k && p > 0.55) { a.k2 = k; const [wx, wy] = wp(a, 38, -26); puff(wx, wy, '#ffc050', 7, 80); }
    } },
    mine: { dur: 6, draw(a, s, g) {
      ctx.fillStyle = '#7a7a84'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(36, 0); ctx.lineTo(40, -26); ctx.lineTo(54, -34); ctx.lineTo(68, -22); ctx.lineTo(66, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8c840'; for (const [x, y] of [[50, -20], [58, -12], [46, -8]]) { ctx.beginPath(); ctx.arc(x, y, 2 + Math.sin(s * 5 + x) * 0.6, 0, 7); ctx.fill(); }
      const p = (s * 1.3) % 1, up = p < 0.6 ? p / 0.6 : 1 - (p - 0.6) / 0.4;
      const hx = 14, hy = -52, ax = hx + 26, ay = hy - 8 + (1 - up) * 26 - 14 * up;
      sline(hx, hy, ax, ay, 3, '#6a4424');
      ctx.strokeStyle = '#9a9ea8'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(ax - 2, ay - 9); ctx.quadraticCurveTo(ax + 10, ay - 2, ax + 3, ay + 11); ctx.stroke();
      hands([hx - 3, hy + 3], [hx + 4, hy + 2], g.coat);
      const k = Math.floor(s * 1.3);
      if (a.k2 !== k && p > 0.95) { a.k2 = k; const [wx, wy] = wp(a, 44, -22); puff(wx, wy, '#fff0a0', 7, 80); }
    } },
    pipe: { dur: 6.5, draw(a, s, g) {
      ctx.fillStyle = '#7a5230'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.roundRect(-40, -14, 22, 14, 3); ctx.fill(); ctx.stroke();
      hands([-6, -42], [12, -48 + Math.sin(s * 1.8) * 4], g.coat);
      sline(8, -52, 20, -56, 2.6, '#5a3a1e'); ctx.fillStyle = '#4a2e18'; ctx.beginPath(); ctx.roundRect(18, -64, 7, 10, 2); ctx.fill();
      if (Math.floor(s * 2) !== a.k2) { a.k2 = Math.floor(s * 2); const [wx, wy] = wp(a, 22, -66); puff(wx, wy, 'rgba(210,210,220,0.8)', 2, 36); }
      const fa = s * 4.5;   // муха кружит у головы
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(Math.cos(fa) * 20, -78 + Math.sin(fa * 1.3) * 10, 1.6, 0, 7); ctx.fill();
    } },
    drunk: { dur: 7, draw(a, s, g) {
      a.rot = (s < 3.5 ? Math.sin(s * 2.4) * 0.14 * (s / 3.5) : Math.min(1.5, (s - 3.5) * 1.6)) * a.dir;
      ctx.fillStyle = '#c89a4a'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.roundRect(14, -62, 11, 14, 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f4f0e0'; ctx.fillRect(14, -65, 11, 4);
      hands([-2, -34], [16, -52], g.coat);
    } },
    wizard: { dur: 6, draw(a, s, g) {
      const lx = 26, ly = -62 + Math.sin(s * 2) * 4;
      sline(lx - 6, ly + 14, lx - 8, -2, 3, '#7a5a8a');
      hands([-4, -40], [lx - 6, ly + 10], g.coat);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const og = ctx.createRadialGradient(lx + 10, ly - 8, 0, lx + 10, ly - 8, 22); og.addColorStop(0, 'rgba(200,160,255,0.9)'); og.addColorStop(1, 'rgba(120,80,255,0)');
      ctx.fillStyle = og; ctx.beginPath(); ctx.arc(lx + 10, ly - 8, 22, 0, 7); ctx.fill();
      for (let i = 0; i < 8; i++) { const an = s * 3 + i * 0.8, r = 10 + i * 2.5; ctx.fillStyle = `rgba(255,${180 + i * 8},255,${0.9 - i * 0.08})`; ctx.beginPath(); ctx.arc(lx + 10 + Math.cos(an) * r, ly - 8 + Math.sin(an) * r * 0.6, 1.8, 0, 7); ctx.fill(); }
      ctx.restore();
    } },
    tree: { dur: 7, draw(a, s, g) {
      const grow = Math.max(0, Math.min(1, (s - 1.6) / 3.6)), dig = s < 1.6;
      hands(dig ? [18 + Math.sin(s * 6) * 4, -30] : [14, -44], dig ? [22, -26] : [24 + Math.sin(s * 4) * 6, -64], g.coat);
      ctx.fillStyle = '#5a3c20'; ctx.beginPath(); ctx.ellipse(46, 0, 12, 3, 0, Math.PI, 0); ctx.fill();
      if (!dig) {
        const h = 6 + grow * 56; sline(46, 0, 46, -h, 2 + grow * 4, '#6a4424');
        ctx.fillStyle = '#4a8a2a'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.6;
        const cr = 4 + grow * 20;
        for (const [dx, dy, r] of [[0, 0, 1], [-0.7, 0.5, 0.8], [0.7, 0.5, 0.8], [0, -0.7, 0.8]]) { ctx.beginPath(); ctx.arc(46 + dx * cr, -h - 2 + dy * cr * 0.8, cr * r, 0, 7); ctx.fill(); ctx.stroke(); }
      }
    } },
    hen: { dur: 7, draw(a, s, g) {
      const panic = s > 1.4 ? Math.sin(s * 14) : 0;
      hands([-14 + panic * 4, -70 - Math.abs(panic) * 8], [14 - panic * 4, -70 - Math.abs(panic) * 8], g.coat);
      if (s > 1.2) {
        ctx.save(); ctx.scale(a.dir, 1); ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = OUT; ctx.lineWidth = 3.5;
        const ty = -112 - Math.abs(panic) * 3; ctx.strokeText('Ай-яй!', 0, ty); ctx.fillText('Ай-яй!', 0, ty); ctx.restore();
      }
    } },
    zap: { dur: 7, draw(a, s, g) {
      const t0 = 2.2;
      hands([-12, -34], [18, -46 + (s < t0 ? Math.sin(s * 5) * 5 : 0)], g.coat);
      if (s > t0 && !a.zapped) { a.zapped = true; stage.flash = 0.55; a.bolt = 0.3; const [wx, wy] = wp(a, 0, -80); puff(wx, wy, '#555', 10, 60); }
      if (s > t0 + 0.2 && s < t0 + 4) {
        ctx.fillStyle = 'rgba(60,60,60,0.5)';
        for (let i = 0; i < 3; i++) { const py = -96 - ((s * 30 + i * 18) % 50); ctx.beginPath(); ctx.arc(Math.sin(s * 3 + i) * 7, py, 5 + i, 0, 7); ctx.fill(); }
      }
      if (s > t0 + 0.3) { ctx.fillStyle = '#ffe070'; for (let i = 0; i < 3; i++) { const an = s * 6 + i * 2.1; ctx.beginPath(); ctx.arc(Math.cos(an) * 16, -112 + Math.sin(an) * 4, 2, 0, 7); ctx.fill(); } }
    } },
  };

  function newActor(side) {
    const types = Object.keys(SKITS).filter(k => !stage.actors.some(a => a.type === k));
    const type = types[(Math.random() * types.length) | 0];
    const tall = H > W * 1.05;                 // телефон в портрете: ряд на дальней поляне между заголовком и костром
    const k = U * (tall ? 1.0 : 1.5) * rr(0.92, 1.08);
    const zone = tall ? [W * 0.1, W * 0.9] : side < 0 ? [W * 0.03, W * 0.095] : [W * 0.905, W * 0.97];
    const x = rr(zone[0], zone[1]);
    const y = tall ? H * rr(0.575, 0.62) : H * rr(0.83, 0.9);
    const g = CREW[(Math.random() * CREW.length) | 0];
    const fromX = x < W / 2 ? -70 : W + 70;
    return { type, g, k, x: fromX, y, dir: x > fromX ? 1 : -1, look: (Math.random() * 99) | 0, state: 'enter', t: 0, s: 0, alpha: 1, fromX, toX: x, rot: 0, bolt: 0, ph: Math.random() * 7, drag: 0 };
  }

  window.loadingSpawn = (type, side) => { const a = newActor(side || -1); a.type = type; stage.actors.push(a); };
  function stageUpdate(dt) {
    stage.next -= dt;
    const cap = H > W * 1.05 ? 2 : 4;
    if (stage.next <= 0 && stage.actors.length < cap) {
      const left = stage.actors.filter(a => a.toX < W / 2).length;
      stage.actors.push(newActor(left <= stage.actors.length - left ? -1 : 1));
      stage.next = rr(1.2, 2.8);
    }
    for (const a of stage.actors) {
      a.t += dt;
      if (a.state === 'enter') {
        const p = Math.min(1, a.t / 1.5);
        a.x = a.fromX + (a.toX - a.fromX) * (1 - (1 - p) * (1 - p));
        if (p >= 1) { a.state = 'act'; a.s = 0; a.dir = a.toX > W / 2 ? -1 : 1; }
      } else if (a.state === 'act') {
        a.s += dt;
        if (a.type === 'hen') {
          if (a.s > 1.5) { a.drag += dt; a.x += (a.toX < W / 2 ? -1 : 1) * Math.min(300, a.drag * 160) * dt; }
          if (a.x < -110 || a.x > W + 110 || a.s > 10) a.state = 'gone';
        } else if (a.s >= SKITS[a.type].dur) {
          a.state = 'fade'; a.t = 0;
          const [wx, wy] = wp(a, 0, -40); puff(wx, wy, 'rgba(255,230,150,0.9)', 14, 70);
        }
      } else if (a.state === 'fade') {
        a.alpha = Math.max(0, 1 - a.t / 1.1);
        if (Math.random() < dt * 30) { const [wx, wy] = wp(a, rr(-14, 14), -rr(10, 90)); puff(wx, wy, 'rgba(255,230,150,0.9)', 1, 60); }
        if (a.alpha <= 0) a.state = 'gone';
      }
    }
    stage.actors = stage.actors.filter(a => a.state !== 'gone');
    for (let i = stage.fx.length - 1; i >= 0; i--) { const p = stage.fx[i]; p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 30 * dt; if (p.life > p.max) stage.fx.splice(i, 1); }
    stage.flash = Math.max(0, stage.flash - dt * 1.8);
  }

  function drawStage() {
    const list = stage.actors.slice().sort((p, q) => p.y - q.y);
    for (const a of list) {
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.globalAlpha = a.alpha;
      // курицы налетают с обеих сторон, клюют и тащат гнома за бороду и колпак
      if (a.type === 'hen' && a.state !== 'enter') {
        for (let i = 0; i < 2; i++) {
          const sgn = i ? 1 : -1, fl = sgn * 36 * a.k, p = Math.min(1, a.s / 1.4);
          const x = fl + sgn * (1 - p) * (a.x < W / 2 ? 260 : 260) * (1 - p) * 0 + sgn * (1 - p) * 240;
          drawHen(x, 2, a.k * 0.9, -sgn, a.s * 12 + i * 1.7, p >= 1);
        }
      }
      ctx.save();
      ctx.scale(a.dir, 1);
      ctx.translate(0, a.state === 'enter' ? -Math.abs(Math.sin(a.t * 9)) * 3 * a.k : 0);
      if (a.rot) ctx.rotate(a.rot * a.dir);
      const xray = a.type === 'zap' && a.s > 2.2 && a.s < 2.45, charred = a.type === 'zap' && a.s >= 2.45;
      if (xray) ctx.filter = 'invert(1) contrast(1.4)'; else if (charred) ctx.filter = 'brightness(0.28) sepia(0.8)';
      const lit = (a.toX < W / 2 ? 1 : -1) * a.dir;
      drawGnome(a.g, 0, 0, a.k, 'front', lit, a.state === 'enter' ? Math.sin(a.t * 9) * 2 : Math.sin(a.t * 2 + a.ph), a.look);
      ctx.filter = 'none';
      ctx.save(); ctx.scale(a.k, a.k);
      if (a.state === 'enter') hands([-8, -32 + Math.sin(a.t * 9) * 3], [8, -32 - Math.sin(a.t * 9) * 3], a.g.coat);
      else SKITS[a.type].draw(a, a.s, a.g);
      ctx.restore();
      if (a.type === 'drunk' && a.s > 3.4) {
        ctx.save(); ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#e8e0ff'; ctx.strokeStyle = OUT; ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) { const zy = -60 * a.k - ((a.s * 18 + i * 14) % 42), zx = 30 + i * 9; ctx.strokeText('z', zx, zy); ctx.fillText('z', zx, zy); }
        ctx.restore();
      }
      ctx.restore();
      ctx.restore();
      if (a.bolt > 0) {   // молния с неба в гнома
        a.bolt -= 0.016;
        ctx.save(); ctx.strokeStyle = '#fff'; ctx.shadowColor = '#bcd8ff'; ctx.shadowBlur = 5; ctx.lineWidth = 3.4; ctx.beginPath();
        let bx = a.x + rr(-6, 6), by = -260; ctx.moveTo(bx, by);
        while (by < a.y - 84 * a.k) { by += 34; bx += rr(-22, 22); ctx.lineTo(bx, by); }
        ctx.lineTo(a.x, a.y - 84 * a.k); ctx.stroke(); ctx.restore();
      }
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const p of stage.fx) {
      const al = Math.max(0, 1 - p.life / p.max);
      ctx.globalAlpha = al; ctx.fillStyle = p.col;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.6 + al * 0.6), 0, 7); ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ---------- кадр ----------
  let last = performance.now(), running = true, T0 = last, lift = 0;
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = (now - T0) / 1000;
    ctx.setTransform(1 / PSc, 0, 0, 1 / PSc, 0, 0);
    ctx.clearRect(0, 0, W + PSc, H + PSc);
    const menu = document.getElementById("loading").classList.contains("with-menu");
    const sm = document.getElementById("start-menu"), mh = menu && sm ? sm.offsetHeight : 0;
    lift += ((menu ? Math.max(0, Math.min(H * 0.42, mh * (H > W ? 1.02 : 0.85) - H * 0.02)) : 0) - lift) * Math.min(1, dt * 4);
    ctx.translate(0, -lift);
    drawBackground(t);
    // летающая нечисть — вдали, тусклая, под дымкой
    for (const f of flyers) {
      f.x += f.v * dt; if (f.x > 1.1) f.x = -0.1; if (f.x < -0.1) f.x = 1.1;
      if (f.kind === 'ghost') drawGhost(f, t); else if (f.kind === 'bat') drawBat(f, t); else drawWisp(f, t);
    }
    // дымка над землёй
    const fog = ctx.createLinearGradient(0, H * 0.55, 0, H * 0.75);
    fog.addColorStop(0, 'rgba(90,80,120,0)'); fog.addColorStop(0.5, 'rgba(110,100,140,0.18)'); fog.addColorStop(1, 'rgba(90,80,120,0)');
    ctx.fillStyle = fog; ctx.fillRect(0, H * 0.55, W, H * 0.2);

    const u = Math.min(W, H * 1.45) / 1000 * (1 - lift / H * 0.8);
    U = u;
    const cx = W / 2, cy = H * 0.76, S = u * 2.5;
    const flick = 0.85 + 0.15 * Math.sin(t * 11) * Math.sin(t * 7.3);
    // отсвет огня на земле
    const gl = ctx.createRadialGradient(cx, cy, 10, cx, cy, 420 * u * 1.6);
    gl.addColorStop(0, `rgba(255,170,70,${0.55 * flick})`); gl.addColorStop(0.4, `rgba(255,110,40,${0.2 * flick})`); gl.addColorStop(1, 'rgba(255,90,30,0)');
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.38); ctx.translate(-cx, -cy);
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(cx, cy, 420 * u * 1.6, 0, 7); ctx.fill(); ctx.restore();
    // травинки
    ctx.strokeStyle = '#243a22'; ctx.lineWidth = 1.2;
    for (const g of tufts) { const x = g.x * W, y = H * 0.7 + (g.y - 0.6) * H * 0.75; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(t + x) * 2, y - g.h); ctx.stroke(); }

    stageUpdate(dt); drawStage();
    // гномы по эллипсу: сзади огня — лицом к нам, спереди — спиной
    const N = CREW.length, rx = 205 * u * 1.7, ry = 58 * u * 1.7;
    const ring = [];
    for (let i = 0; i < N; i++) {
      const a = Math.PI / 2 + Math.PI / N + i / N * Math.PI * 2 + Math.sin(t * 0.15) * 0.04;
      const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry + 6 * u;
      ring.push({ i, a, x, y, k: u * 1.9 * (0.78 + 0.34 * ((Math.sin(a) + 1) / 2)), g: CREW[i] });
    }
    ring.sort((p, q) => p.y - q.y);
    drawFireBase(cx, cy, S);
    const back = ring.filter(p => p.y < cy), front = ring.filter(p => p.y >= cy);
    const pos = new Map(ring.map(p => [p.i, p]));
    const sway = i => Math.sin(t * 1.6 + i * 0.9);
    const shoulder = p => ({ x: p.x + Math.sin(sway(p.i) * 0.03) * 0, y: p.y - 48 * p.k });
    const arms = [];
    // руки: от каждого плеча к середине между соседями
    for (let i = 0; i < N; i++) {
      const p = pos.get(i), q = pos.get((i + 1) % N);
      const hx = (p.x + q.x) / 2, hy2 = (p.y + q.y) / 2 - 24 * (p.k + q.k) / 2 + Math.sin(t * 1.6 + i) * 2;
      arms.push({ p, q, hx, hy: hy2 });
    }
    const drawRing = list => {
      for (const p of list) {
        const view = Math.sin(p.a) > 0 ? 'back' : 'front';
        const lit = p.x < cx ? 1 : -1;
        drawGnome(p.g, p.x, p.y, p.k, view, lit, sway(p.i), p.i);
        // руки, исходящие из этого гнома (к обоим соседям)
        for (const ar of arms) {
          if (ar.p === p || ar.q === p) {
            const sh = shoulder(p);
            drawArm(sh.x + (ar.p === p ? 1 : -1) * 12 * p.k * (p.x < cx ? 1 : 1) * 0 + (ar.hx > p.x ? 13 : -13) * p.k, sh.y, ar.hx, ar.hy, p.k, shade(p.g.coat, -0.05));
            drawHand(ar.hx, ar.hy, p.k);
          }
        }
      }
    };
    drawRing(back);
    // пламя между задними и передними — задние закрыты огнём лишь частично
    // пиксельное пламя из js/fire.js: большой язык по центру, два малых по бокам, искры
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    const fx = cx / PSc, fy = (cy - lift) / PSc - 2, fh = 96 * S / PSc;
    drawFire(ctx, fx - 9 * S / PSc * 2.2, fy, 'camp', t, 1, { h: fh * 0.62, glow: 0 });
    drawFire(ctx, fx + 10 * S / PSc * 2.2, fy, 'camp', t, 4, { h: fh * 0.55, glow: 0 });
    drawFire(ctx, fx, fy + 1, 'blaze', t, 2, { h: fh, glow: 0, sparks: 16 });
    ctx.restore();
    drawRing(front);
    // тёплая засветка поверх всей сцены
    ctx.save(); ctx.globalCompositeOperation = 'soft-light';
    const wl = ctx.createRadialGradient(cx, cy - 40 * u, 20, cx, cy - 40 * u, Math.max(W, H) * 0.7);
    wl.addColorStop(0, `rgba(255,150,60,${0.5 * flick})`); wl.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = wl; ctx.fillRect(0, 0, W, H); ctx.restore();
    // виньетка
    ctx.translate(0, lift);
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    if (stage.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.8, stage.flash)})`; ctx.fillRect(0, 0, W, H); }
    present();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // перестаём рисовать, когда экран загрузки скрыт
  const box = document.getElementById('loading');
  window.loadingStop = () => { running = false; };
  new MutationObserver(() => { if (box.classList.contains('hidden')) setTimeout(() => { running = false; }, 900); }).observe(box, { attributes: true, attributeFilter: ['class'] });
})();
