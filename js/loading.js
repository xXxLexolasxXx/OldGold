'use strict';
// Экран загрузки: ночной лес, большой костёр, девять гномов разных ремёсел
// стоят вокруг, взявшись за руки, а вдали парят призраки и летучие мыши.
// Самодостаточный файл: грузится первым, анимируется, пока тяжёлые скрипты ещё
// скачиваются, и гаснет вместе с экраном загрузки. Рисуется в полном разрешении
// экрана (с учётом devicePixelRatio), объёмно: градиенты, обводка, отсветы огня.

(function () {
  const cv = document.getElementById('load-cv');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, DPR = 1;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const OUT = '#1a0f08';

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  }
  window.addEventListener('resize', resize);
  resize();

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
      ctx.fillStyle = shade('#e08070', 0.1); ctx.globalAlpha = 0.45;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 9, hy + 5, 3.4, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
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
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
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
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
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

  // ---------- кадр ----------
  let last = performance.now(), running = true, T0 = last;
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = (now - T0) / 1000;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
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

    const u = Math.min(W, H * 1.45) / 1000;           // масштаб сцены
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

    // гномы по эллипсу: сзади огня — лицом к нам, спереди — спиной
    const N = CREW.length, rx = 255 * u * 1.7, ry = 70 * u * 1.7;
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
    emitSparks(cx, cy, S, dt);
    drawFlames(cx, cy - 4 * S, S, t);
    drawSparks();
    drawRing(front);
    // тёплая засветка поверх всей сцены
    ctx.save(); ctx.globalCompositeOperation = 'soft-light';
    const wl = ctx.createRadialGradient(cx, cy - 40 * u, 20, cx, cy - 40 * u, Math.max(W, H) * 0.7);
    wl.addColorStop(0, `rgba(255,150,60,${0.5 * flick})`); wl.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = wl; ctx.fillRect(0, 0, W, H); ctx.restore();
    // виньетка
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // перестаём рисовать, когда экран загрузки скрыт
  const box = document.getElementById('loading');
  window.loadingStop = () => { running = false; };
  new MutationObserver(() => { if (box.classList.contains('hidden')) setTimeout(() => { running = false; }, 900); }).observe(box, { attributes: true, attributeFilter: ['class'] });
})();
