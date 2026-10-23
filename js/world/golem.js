'use strict';
// Каменный голем: в начале каждой игры на карте появляется огромное существо — 3 клетки в ширину,
// 2 в высоту. Пока неуязвим и неатакуем (это не юнит: гномы, звери и нечисть его не замечают):
// неторопливо бродит рядом с городом, иногда останавливается, поворачивается к нам и размахивает
// руками или бьёт себя кулаками в грудь.
// Рисуется из угловатых валунов с мхом, трещинами, янтарными глазами и золотой руной на груди;
// три вида (спереди, сбоку, со спины), походка 8 кадров, дыхание 4, два жеста по 12 кадров.
// Кадры строятся лениво в 6× и уменьшаются до арта (как люди в people.js), обводка и тень — в том же стиле.
// Положение хранится в сохранении (поле golem), старые сохранения получают голема при загрузке.

const GL_W = 176, GL_H = 128, GL_AX = 88, GL_AY = 116;      // холст в пикселях мира; опорная точка — центр ступней
const GL_ST = { hi: '#b4afa2', mid: '#8a8579', lo: '#5e5951', ink: '#26221f' };
const GL_MOSS = ['#3e6a22', '#4a6e30', '#5c8236', '#73963e'];
// мох по временам года (индексы seaIdx: 0 лето, 1 осень, 2 зима, 3 весна): летом гуще, осенью жухлый, зимой иней
const GL_MOSS_SEA = [['#2f7a1c', '#3f8f24', '#55a82c', '#7ac03a'], ['#8a5a1e', '#a8661c', '#b8802a', '#7a4a1a'], ['#b6d0e4', '#d4e6f2', '#9ab8d2', '#eef6fb'], ['#3e6a22', '#4a6e30', '#5c8236', '#73963e']];
let GL_SEA = 3, GL_DORM = false, GL_LOOK = '';
const GL_GOLD = '#e4b434', GL_EYE = '#ffb02e', GL_EYE2 = '#fff2a0';
const GL_FRAMES = { walk: 8, idle: 4, wave: 12, pound: 12, look: 12, stomp: 12, stretch: 12, scratch: 12, flex: 12 };
const GL_EMOTES = [['wave', 2.6, 2], ['pound', 3.2, 2], ['look', 3.6, 3], ['stomp', 2.4, 2], ['stretch', 3.4, 2], ['scratch', 3, 2], ['flex', 2.8, 2]];   // имя, длительность с, вес
const GL_CACHE = new Map();
let GL_SCRATCH = null, GL_QUEUE = null;

// ---------- Камень ----------

// Угловатый валун: градиент, свет сверху-слева, тень снизу-справа, контур, по желанию трещина и мох
function gBlob(c, x, y, rx, ry, seed, o = {}) {
  const rng = mulberry32(seed * 7919 + 11), n = o.n || 9, pts = [], tone = o.tone || 0;
  for (let k = 0; k < n; k++) {
    const a = (k + (rng() - 0.5) * 0.5) / n * Math.PI * 2, r = 0.84 + rng() * 0.28;
    pts.push([x + Math.cos(a) * rx * r, y + Math.sin(a) * ry * r, a]);
  }
  poly(c, pts, lingrad(c, x - rx, y - ry, x + rx * 0.8, y + ry, [[0, shade(GL_ST.hi, tone)], [0.5, shade(GL_ST.mid, tone)], [1, shade(GL_ST.lo, tone)]]));
  const lit = pts.filter(p => p[2] > Math.PI * 1.02 && p[2] < Math.PI * 1.72);
  if (lit.length > 1) poly(c, [[x - rx * 0.08, y - ry * 0.12], ...lit], rgba(GL_ST.hi, 0.45));
  const dk = pts.filter(p => p[2] > Math.PI * 0.05 && p[2] < Math.PI * 0.78);
  if (dk.length > 1) poly(c, [[x + rx * 0.1, y + ry * 0.1], ...dk], rgba(GL_ST.ink, 0.3));
  poly(c, pts, null, rgba(GL_ST.ink, 0.9), 0.9);
  if (o.crack) {
    let cx = x + (rng() - 0.5) * rx * 0.8, cy = y - ry * 0.3;
    c.strokeStyle = rgba(GL_ST.ink, 0.85); c.lineWidth = 0.7; c.beginPath(); c.moveTo(cx, cy);
    for (let k = 0; k < 3; k++) { cx += (rng() - 0.5) * rx * 0.6; cy += ry * 0.34; c.lineTo(cx, cy); }
    c.stroke();
  }
  if (o.moss) {
    for (let k = 0; k < o.moss; k++) {
      const a = Math.PI * (1.1 + rng() * 0.55), r = 0.62 + rng() * 0.2;
      ellipse(c, x + Math.cos(a) * rx * r, y + Math.sin(a) * ry * r, 2.4 + rng() * 3.4, 1.4 + rng() * 1.8, GL_MOSS[(rng() * 4) | 0]);
    }
  }
}

// Конечность из цепочки валунов поверх тёмной жилы
function gLimb(c, x0, y0, x1, y1, r0, r1, seed, tone, mo = 4) {
  c.lineCap = 'round'; line(c, x0, y0, x1, y1, shade(GL_ST.lo, tone), (r0 + r1) * 0.7); c.lineCap = 'butt';   // жила уже кладки — край рисуют сами валуны
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  for (let i = 0; i <= 5; i++) {
    const t = i / 5, r = r0 + (r1 - r0) * t, off = (i & 1 ? 1 : -1) * r * 0.1;   // валуны вразбежку — кладка до самого края
    gBlob(c, x0 + dx * t + nx * off, y0 + dy * t + ny * off, r * (i & 1 ? 1.02 : 1.1), r * (i & 1 ? 1.08 : 0.98), seed + i * 3, { tone: tone + (i & 1 ? 0.03 : -0.02), n: 8, crack: i === 2, moss: Math.ceil((mo + (i & 1)) * 0.6) });
  }
}

// ---------- Поза по кадру ----------

function golemPose(view, pose, f) {
  const P = { up: 0, sx: 0, head: { dx: 0, dy: 0 }, mouth: 0, br: 0, rune: 0.5, feet: [{ x: 0, y: 0 }, { x: 0, y: 0 }], arms: [{ th: 0.2, sw: 0, b: -0.25 }, { th: 0.2, sw: 0, b: -0.25 }], shake: 0 };
  const E = view === 'E';
  if (pose === 'walk') {
    const ph = f / 8 * Math.PI * 2, s = Math.sin(ph), cs = Math.cos(ph);
    P.up = Math.abs(cs) * 3.2; P.sx = s * (E ? 0.8 : 2); P.br = cs * 0.5;
    if (E) { P.feet[0] = { x: -s * 11, y: Math.max(0, -cs) * 7 }; P.feet[1] = { x: s * 11, y: Math.max(0, cs) * 7 }; }
    else { P.feet[0] = { x: 0, y: Math.max(0, -cs) * 6 }; P.feet[1] = { x: 0, y: Math.max(0, cs) * 6 }; }
    P.arms[0] = { th: 0.2 + Math.abs(s) * 0.06, sw: s * 0.42, b: -0.28 };
    P.arms[1] = { th: 0.2 + Math.abs(s) * 0.06, sw: -s * 0.42, b: -0.28 };
    P.head.dy = Math.abs(cs) * 0.8; P.rune = 0.45 + 0.2 * s;
  } else if (pose === 'idle') {
    const b = Math.sin(f / 4 * Math.PI * 2);
    P.br = b; P.up = b * 0.5; P.head.dy = -b * 0.5;
    P.arms[0] = { th: 0.2 + b * 0.04, sw: 0.05, b: -0.28 }; P.arms[1] = { th: 0.2 - b * 0.04, sw: -0.05, b: -0.28 };
    P.rune = 0.5 + 0.35 * b;
  } else if (pose === 'wave') {
    const t = f / 12, e = t < 0.2 ? t / 0.2 : t > 0.8 ? (1 - t) / 0.2 : 1, ee = e * e * (3 - 2 * e);
    const w = Math.sin(t * Math.PI * 4);
    P.arms[0] = { th: 0.2 + ee * (2.2 + 0.42 * w), sw: 0, b: ee * 0.25 - (1 - ee) * 0.28 };
    P.arms[1] = { th: 0.2 + ee * (2.2 - 0.42 * w), sw: 0, b: ee * 0.25 - (1 - ee) * 0.28 };
    P.sx = ee * w * 2.2; P.up = ee * (1.5 + 1.5 * Math.abs(w)); P.mouth = ee; P.head.dy = -ee * 2.5; P.br = ee;
    P.rune = 0.5 + 0.5 * ee; P.shake = ee;
  } else if (pose === 'pound') {
    const t = f / 12, e = t < 0.12 ? t / 0.12 : t > 0.88 ? (1 - t) / 0.12 : 1, ee = e * e * (3 - 2 * e);
    const hit = k => { const q = (t * 3 + k * 0.5) % 1; return q < 0.35 ? q / 0.35 : 1 - (q - 0.35) / 0.65; };   // 1 — кулак на груди
    for (let i = 0; i < 2; i++) {
      const h = hit(i) * ee;
      P.arms[i] = { th: 0.2 + ee * 0.65, sw: 0, b: -0.28 + (-1.55 - 0.1 * h - 0.1 + 0.28) * ee * (0.45 + 0.55 * h) };
    }
    P.sx = (hit(0) - hit(1)) * 1.5 * ee; P.up = ee * (hit(0) + hit(1)) * 1.4; P.mouth = ee * 0.5; P.head.dy = -ee * 1.2;
    P.rune = 0.35 + 0.65 * Math.max(hit(0), hit(1)) * ee; P.br = ee * 0.8;
  } else golemPoseMore(P, pose, f);
  return P;
}

// Остальные жесты: огляделся, топнул, потянулся, почесал голову, показал силу
function golemPoseMore(P, pose, f) {
  const t = f / 12, e = t < 0.18 ? t / 0.18 : t > 0.82 ? (1 - t) / 0.18 : 1, ee = e * e * (3 - 2 * e);
  if (pose === 'look') {                      // медленно озирается: голова влево-вправо, корпус чуть доворачивается
    const w = Math.sin(t * Math.PI * 2);
    P.head.dx = w * 8; P.sx = w * 1.6; P.head.dy = Math.abs(w) * 0.8; P.br = 0.3; P.rune = 0.5 + 0.2 * w;
    P.arms[0] = { th: 0.2 - w * 0.05, sw: 0, b: -0.28 }; P.arms[1] = { th: 0.2 + w * 0.05, sw: 0, b: -0.28 };
  } else if (pose === 'stomp') {              // двойной топот: нога вверх — и вниз всем весом
    const k = Math.floor(t * 2) % 2, u = (t * 2) % 1;
    const lift = u < 0.55 ? Math.sin(u / 0.55 * Math.PI / 2) : Math.max(0, 1 - (u - 0.55) / 0.12);
    P.feet[k] = { x: 0, y: lift * 15 };
    P.up = u < 0.55 ? u * 4 : 0; P.sx = (k ? 1 : -1) * 2 * Math.sin(u * Math.PI);
    const a = { th: 0.6 + (u > 0.55 ? 0.4 : 0), sw: 0, b: -0.4 };
    P.arms[0] = a; P.arms[1] = { ...a };
    P.mouth = u > 0.55 && u < 0.8 ? 0.7 : 0; P.head.dy = u > 0.55 && u < 0.7 ? 1.5 : 0;
    P.rune = u > 0.55 ? 1 : 0.4;
  } else if (pose === 'stretch') {            // зевает и тянется: руки медленно вверх, пасть нараспашку
    const a = { th: 0.2 + ee * 2.75, sw: 0, b: ee * 0.1 - (1 - ee) * 0.28 };
    P.arms[0] = a; P.arms[1] = { ...a };
    P.mouth = ee; P.head.dy = -ee * 3; P.br = ee * 1.3; P.up = ee * 2.2; P.rune = 0.5 + 0.3 * ee;
  } else if (pose === 'scratch') {            // чешет затылок кулаком
    const w = Math.sin(t * Math.PI * 6) * 0.14 * ee;
    P.arms[1] = { th: 0.2 + ee * 2.2 + w, sw: 0, b: -0.28 + ee * 2.4 };
    P.arms[0] = { th: 0.2, sw: 0.05, b: -0.28 };
    P.head.dx = ee * 7 + w * 6; P.head.dy = ee * 1.5; P.sx = -ee;
  } else if (pose === 'flex') {               // показывает силу: обе руки согнуты кулаками вверх, дрожит от натуги
    const tr = Math.sin(t * Math.PI * 14) * 0.5 * ee;
    const a = { th: 0.2 + ee * 1.35, sw: 0, b: -0.28 + ee * 1.85 };
    P.arms[0] = a; P.arms[1] = { ...a };
    P.up = ee * 1.5 + tr; P.mouth = ee * 0.6; P.br = ee * 1.2; P.head.dy = -ee * 1.5; P.rune = 0.4 + 0.6 * ee; P.sx = tr;
  }
}

// ---------- Рисование одного кадра ----------

function drawGolemBody(c, view, pose, f) {
  const P = golemPose(view, pose, f), E = view === 'E', N = view === 'N';
  GL_MOSS.splice(0, 4, ...GL_MOSS_SEA[GL_SEA]);
  if (GL_DORM) P.rune = 0.1;
  const kx = E ? 0.6 : 1, bob = -P.up, sx = P.sx, br = P.br;
  c.save(); c.translate(GL_AX, GL_AY); c.lineJoin = 'round';

  const leg = i => {
    const s = i ? 1 : -1, hx = s * 13 * kx + sx * 0.4, hy = -30 + bob;
    const fx = hx + P.feet[i].x + (E ? 0 : s * 1.5), fy = -P.feet[i].y;
    gLimb(c, hx, hy, fx, fy - 11, 12.5, 11.5, 20 + i * 5, i ? 0.02 : -0.05);
    gBlob(c, fx + (E ? 4 : 0), fy - 6.5, E ? 15 : 14.5, 7, 31 + i, { tone: i ? 0.02 : -0.06, moss: 2 });
    if (!N) { c.fillStyle = rgba(GL_ST.ink, 0.8); for (const dx of E ? [8, 11] : [-4, 0, 4]) c.fillRect(fx + (E ? 4 : 0) + dx - 0.4, fy - 4.4, 0.8, 2.6); }   // борозды-пальцы
  };

  const arm = i => {
    const A = P.arms[i], s = i ? 1 : -1;
    const shx = s * 31 * kx + sx, shy = -52 + bob;
    const dir = (a, a2) => E ? [Math.sin(a), Math.cos(a)] : [s * Math.sin(a), Math.cos(a)];
    const sw = A.sw, fore = E ? A.sw : A.th;
    const k = E ? 1 : 1 - 0.18 * Math.abs(Math.sin(sw));
    const d1 = dir(E ? sw : A.th), d2 = dir((E ? sw : A.th) + A.b);
    const ex = shx + d1[0] * 21 * k, ey = shy + d1[1] * 21 * k;
    const fx = ex + d2[0] * 20 * k, fy = ey + d2[1] * 20 * k + (E ? 0 : Math.sin(sw) * 2);
    const tn = i ? 0.0 : -0.07;
    gLimb(c, shx, shy, ex, ey, 11.5, 10.5, 40 + i * 9, tn);
    gBlob(c, ex, ey, 9, 8.5, 58 + i, { tone: tn, n: 8, moss: 5 });
    gLimb(c, ex, ey, fx, fy, 10.5, 10, 62 + i * 9, tn);
    gBlob(c, fx, fy + 1.5, 12, 10.5, 70 + i, { tone: tn + 0.03, n: 10, moss: 3 });                         // кулак
    c.fillStyle = rgba(GL_ST.ink, 0.75); for (const dx of [-4, 0, 4]) c.fillRect(fx + dx - 0.4, fy + 4, 0.8, 3.4);
  };

  const pauldron = i => {
    const s = i ? 1 : -1;
    gBlob(c, s * 31 * kx + sx, -54 + bob, E ? 12 : 15, 12.5, 80 + i, { tone: i ? 0.05 : -0.02, moss: 11, crack: true });
    if (!i && !N) for (let k = -2; k <= 2; k++) line(c, -31 * kx + sx + k * 2.2, -64 + bob, -31 * kx + sx + k * 2.6 + k * 0.6, -70 + bob - Math.abs(k) * -1.2 - 1, GL_MOSS[2 + (k & 1)], 0.8);   // пучок травы
  };

  // мховая накидка на плечах и свисающие пряди
  const mantle = () => {
    const r = mulberry32(555);
    for (let k = -6; k <= 6; k++) {
      const x = sx + k * 5 * kx, y = -63 + bob + Math.abs(k) * 0.9 + (r() - 0.5) * 2;
      ellipse(c, x, y, 5.6, 3.2 + r(), GL_MOSS[(r() * 4) | 0]);
      if (r() < 0.6) line(c, x + (r() - 0.5) * 3, y + 1, x + (r() - 0.5) * 4, y + 6 + r() * 7, GL_MOSS[(r() * 3) | 0], 1.1);
    }
    for (let k = 0; k < 7; k++) ellipse(c, sx + (r() - 0.5) * 40 * kx, -44 + bob + r() * 12, 2.4 + r() * 2.4, 1.6 + r(), GL_MOSS[(r() * 4) | 0]);
  };

  const torso = () => {
    gBlob(c, sx * 0.5, -29 + bob, 20 * (E ? 0.8 : 1), 11, 90, { tone: -0.1, n: 10, moss: 5 });                    // таз
    gBlob(c, sx * 0.8, -40 + bob, 24 * (E ? 0.8 : 1), 13, 91, { tone: -0.04, n: 10, moss: 6 });                   // живот
    c.fillStyle = rgba(GL_ST.ink, 0.8); for (let k = -2; k <= 2; k++) c.fillRect(sx * 0.7 + k * 7 * kx - 0.4, -36 + bob, 0.8, 5);   // швы-плиты
    gBlob(c, sx + (E ? 2 : 0), -51 + bob - br * 0.4, 31 * (E ? 0.82 : 1), 15.5 + br * 0.9, 92, { tone: 0.02, n: 11, crack: true, moss: 11 });   // грудь
    mantle();
    if (N) {
      gBlob(c, sx, -56 + bob, 24, 11, 93, { tone: 0.04, n: 10, moss: 12 });                                // горб
      for (let k = 0; k < 4; k++) gBlob(c, sx, -66 + bob + k * 9, 5.2 - k * 0.4, 4.4, 95 + k, { tone: 0.08, n: 7 });   // гребень
      c.strokeStyle = rgba(GL_GOLD, 0.85); c.lineWidth = 0.9; c.beginPath(); c.moveTo(sx - 9, -62 + bob); c.lineTo(sx - 6, -52 + bob); c.lineTo(sx - 10, -44 + bob); c.lineTo(sx - 7, -33 + bob); c.stroke();   // золотая жила
    } else {
      // руна на груди: ромб с крестом, пульсирует
      const rx = sx + (E ? 4 : 0), ry = -48 + bob, a = 0.45 + 0.55 * P.rune;
      c.globalAlpha = a * 0.35; ellipse(c, rx, ry, 9, 9, GL_GOLD); c.globalAlpha = 1;
      c.strokeStyle = rgba(GL_GOLD, 0.35 + 0.65 * a); c.lineWidth = 1.2;
      c.beginPath(); c.arc(rx, ry, 6.6, 0, Math.PI * 2); c.stroke();                                   // кольцо
      c.beginPath();                                                                                   // спираль
      for (let k = 0; k <= 26; k++) { const th = k / 26 * Math.PI * 4.2, r = 0.8 + k / 26 * 5; const X = rx + Math.cos(th) * r, Y = ry + Math.sin(th) * r; k ? c.lineTo(X, Y) : c.moveTo(X, Y); }
      c.stroke();
      c.fillStyle = rgba(GL_GOLD, 0.35 + 0.65 * a); c.fillRect(rx - 0.6, ry - 0.6, 1.2, 1.2);
    }
  };

  const head = () => {
    const hx = sx + (E ? 7 : 0) + P.head.dx, hy = -67 + bob + P.head.dy;
    gBlob(c, sx + (E ? 3 : 0), -59 + bob, 10, 6, 100, { tone: -0.25, n: 8 });                           // шея
    if (N) { gBlob(c, hx, hy, 12.5, 10.5, 101, { tone: -0.02, n: 10, moss: 8, crack: true }); }
    else {
      gBlob(c, hx, hy, 12.5, 9.6, 101, { tone: 0.03, n: 10, moss: 7 });
      // рот: щель или раскрытая пасть с жаром внутри
      const m = P.mouth, my = hy + 4.2;
      c.fillStyle = GL_ST.ink; c.fillRect(hx - 5.5 + (E ? 2 : 0), my, 11, 1 + m * 5);
      if (m > 0.3) { c.fillStyle = rgba(GL_EYE, 0.8 * m); c.fillRect(hx - 3.5 + (E ? 2 : 0), my + 1.4, 7, m * 3); }
      gBlob(c, hx + (E ? 2 : 0), hy + 8.6 + m * 4.2, 8.6, 4.4, 102, { tone: -0.14, n: 8 });            // челюсть
      // тяжёлая бровь и глаза
      const ey = hy - 1.2, ex = E ? [hx + 1.5, hx + 7.5] : [hx - 4.6, hx + 4.6];
      poly(c, [[ex[0] - 5.6, ey - 3.2], [ex[1] + 5.6, ey - 3.2], [ex[1] + 5.6, ey - 0.8], [ex[0] - 5.6, ey - 0.8]], shade(GL_ST.lo, -0.35), rgba(GL_ST.ink, 0.9), 0.6);
      for (const x of ex) {
        if (GL_DORM) { c.fillStyle = '#3a3226'; c.fillRect(x - 2.3, ey + 0.6, 4.6, 1.2); continue; }   // спит: глаза — тёмные щёлки
        c.globalAlpha = 0.5; ellipse(c, x, ey + 1.4, 5.6, 4, GL_EYE); c.globalAlpha = 1;
        c.fillStyle = GL_EYE; c.fillRect(x - 2.3, ey, 4.6, 2.3);
        c.fillStyle = GL_EYE2; c.fillRect(x - 1.1, ey + 0.4, 2.2, 1.2);
      }
    }
    // каменный гребень и мох сверху
    for (const [dx, dy, rx, ry, sd] of [[-6, -8.6, 4.4, 3.6, 105], [0, -10.8, 5, 4.2, 106], [6, -8.6, 4.4, 3.6, 107]]) gBlob(c, hx + dx * (E ? 0.8 : 1), hy + dy, rx, ry, sd, { tone: 0.06, n: 7, moss: dx === 0 ? 2 : 0 });
  };

  if (N) head();
  if (E) { leg(0); arm(0); leg(1); } else { leg(0); leg(1); }
  torso();
  if (!E) { arm(0); arm(1); pauldron(0); pauldron(1); } else { pauldron(0); arm(1); pauldron(1); }
  if (!N) head();
  if (typeof golemDeco === 'function') golemDeco(c, view, P, sx, bob, kx);
  c.restore();
}

// ---------- Кэш кадров ----------

// Облик: время года и «спит/ожил» (Game.glq, golemlife.js) — при смене кадры перерисовываются
const golemSea = () => (typeof seaIdx === 'function' ? seaIdx() : 3);
const golemDorm = () => !!(Game.glq && !Game.glq.awake);
function golemLookSync() {
  const k = golemSea() + (golemDorm() ? 'd' : 'a');
  if (k === GL_LOOK) return;
  GL_LOOK = k; GL_CACHE.clear(); GL_QUEUE = null;
}
// зимой голем медленнее
const golemSpeedMul = () => (golemSea() === 2 ? 0.6 : 1);

function golemSprite(view, pose, f, force) {
  golemLookSync();
  const key = view + pose + f;
  let cv = GL_CACHE.get(key);
  if (cv) return cv;
  if (!force && !spriteBudgetOk(true)) return null;   // у голема всегда есть запасной кадр (g.last)
  const t0 = performance.now();
  if (!GL_SCRATCH) GL_SCRATCH = mkSprite(GL_W, GL_H, PS);
  const [c2, ctx] = GL_SCRATCH;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c2.width, c2.height);
  ctx.setTransform(PS, 0, 0, PS, 0, 0);
  GL_SEA = golemSea(); GL_DORM = golemDorm();
  drawGolemBody(ctx, view, pose, f);
  cv = toPixelArt(c2, PS / PART, { outline: true, outlineDark: 0.36, alphaCut: 105 });
  GL_CACHE.set(key, cv);
  if (!force) spriteSpent(t0);
  return cv;
}

// Очередь прогрева. Раньше — по кадру на каждый шаг симуляции: 120 кадров по ~11 мс (на телефоне ~60 мс)
// подряд в первые 6 секунд игры, а на ускорении и по несколько за кадр — главный лаг после выхода из меню.
// Теперь — только в простое браузера; нет простоя (или requestIdleCallback) — кадры рисуются по мере показа.
let GL_IDLE = false;
function golemIdleWarm() {
  if (GL_IDLE || typeof requestIdleCallback !== 'function') return;
  GL_IDLE = true;
  requestIdleCallback(function warm(dl) {
    while (Game.golem && (GL_QUEUE === null || GL_QUEUE.length) && dl.timeRemaining() > 14) golemWarmup();
    if (Game.golem && (GL_QUEUE === null || GL_QUEUE.length)) requestIdleCallback(warm); else GL_IDLE = false;
  });
}
function golemWarmup() {
  if (!GL_QUEUE) {
    GL_QUEUE = [];
    if (golemDorm()) GL_QUEUE.push(['S', 'idle', 0]);
    else for (const v of ['S', 'E', 'N']) for (const p of ['walk', 'idle']) for (let f = 0; f < GL_FRAMES[p]; f++) GL_QUEUE.push([v, p, f]);
    if (!golemDorm()) for (const p of Object.keys(GL_FRAMES).slice(2)) for (let f = 0; f < GL_FRAMES[p]; f++) GL_QUEUE.push(['S', p, f]);
  }
  const q = GL_QUEUE.shift();
  if (q) golemSprite(q[0], q[1], q[2], true);
}

// ---------- Жизнь голема ----------

function golemFree(gx, gy) {
  for (let y = gy; y < gy + 2; y++) for (let x = gx; x < gx + 3; x++) {
    if (!inb(x, y) || !isWalkable(x, y)) return false;
    const i = idx(x, y), o = World.obj[i];
    if (World.door[i] || Game.roadSites.has(i) || (o && o.t !== 'field')) return false;
  }
  return true;
}

function golemHome() {
  const st = Game.buildings.find(b => b.type === 'storehouse') || Game.buildings[0];
  return st ? [st.doorX, st.doorY] : [MAP_W >> 1, MAP_H >> 1];
}

function spawnGolem(at) {
  const [hx, hy] = golemHome();
  // из сохранения — где и стоял (сам дошёл, пусть стоит); «не ближе 18 клеток к лагерю» — только для нового места
  let pos = at && golemFree(at.gx, at.gy) ? [at.gx, at.gy] : null;
  for (let tries = 0; !pos && tries < 1500; tries++) {
    const r = tries < 800 ? 24 + Math.random() * 14 : 14 + Math.random() * 28, a = Math.random() * Math.PI * 2;
    const gx = Math.round(hx + Math.cos(a) * r - 1), gy = Math.round(hy + Math.sin(a) * r * 0.7 - 1);
    if (golemFree(gx, gy)) pos = [gx, gy];
  }
  if (!pos) { Game.golem = null; return null; }
  Game.golem = { fx: pos[0], fy: pos[1], hx: pos[0] + 1.5, hy: pos[1] + 1, state: 'idle', timer: 2 + Math.random() * 3, view: 'S', face: 1, ph: 0, t: 0, stuck: 0, dust: [], emote: null, lastF: -1 };
  return Game.golem;
}

function golemPickMove(g) {
  const gx = Math.round(g.fx), gy = Math.round(g.fy);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].sort(() => Math.random() - 0.5);
  const home = Math.hypot(gx + 1.5 - g.hx, gy + 1 - g.hy) > 12;
  for (const [dx, dy] of dirs) {
    let n = 0, x = gx, y = gy;
    const want = 1 + ((Math.random() * 4) | 0);
    while (n < want && golemFree(x + dx, y + dy)) { x += dx; y += dy; n++; }
    if (!n) continue;
    if (home && Math.hypot(x + 1.5 - g.hx, y + 1 - g.hy) > Math.hypot(gx + 1.5 - g.hx, gy + 1 - g.hy)) continue;   // далеко — идём к городу
    g.tx = x; g.ty = y; g.state = 'walk';
    g.view = dy < 0 ? 'N' : dy > 0 ? 'S' : 'E';
    if (dx) g.face = dx;
    return true;
  }
  return false;
}

function golemPickEmote(g) {
  const list = GL_EMOTES.filter(e => e[0] !== g.lastEmote);
  let r = Math.random() * list.reduce((a, e) => a + e[2], 0), em = list[0];
  for (const e of list) { r -= e[2]; if (r <= 0) { em = e; break; } }
  g.emote = g.lastEmote = em[0]; g.dur = em[1];
}

function golemTick(dt) {
  const g = Game.golem;
  if (!g) return;
  golemLookSync();
  if (GL_QUEUE === null || GL_QUEUE.length) golemIdleWarm();
  g.t += dt;
  const gx = Math.round(g.fx), gy = Math.round(g.fy);
  if (g.state === 'walk') {
    const dx = g.tx - g.fx, dy = g.ty - g.fy, d = Math.hypot(dx, dy), stepD = Math.min(d, 0.62 * golemSpeedMul() * dt);
    if (d < 1e-3 || !golemFree(Math.round(g.tx), Math.round(g.ty))) { g.state = 'idle'; g.timer = 1.5 + Math.random() * 3; g.fx = Math.round(g.fx); g.fy = Math.round(g.fy); }
    else {
      g.fx += dx / d * stepD; g.fy += dy / d * stepD; g.ph += stepD / 1.7;
      const fr = Math.floor(g.ph * 8) & 7;
      if ((fr === 0 || fr === 4) && fr !== g.lastF) {   // тяжёлая ступня опустилась — пыль
        for (let k = 0; k < 4; k++) g.dust.push({ x: (g.fx + 1.5) * TILE + (fr ? 14 : -14) + (Math.random() - 0.5) * 16, y: (g.fy + 2) * TILE - 10, vx: (Math.random() - 0.5) * 8, vy: -4 - Math.random() * 5, a: 0.55, r: 2.4 + Math.random() * 2 });
      }
      g.lastF = fr;
      if (d - stepD < 1e-3) { g.fx = g.tx; g.fy = g.ty; g.state = 'idle'; g.timer = 2 + Math.random() * 5; }
    }
  } else if (g.state === 'emote') {
    g.et += dt;
    if (g.emote === 'stomp') {   // удар ноги о землю — пыль
      const fr = Math.floor(g.et / g.dur * 12), hit = fr === 5 || fr === 11;
      if (hit && fr !== g.lastF) for (let k = 0; k < 7; k++) g.dust.push({ x: (g.fx + 1.5) * TILE + (fr === 5 ? -14 : 14) + (Math.random() - 0.5) * 24, y: (g.fy + 2) * TILE - 10, vx: (Math.random() - 0.5) * 18, vy: -5 - Math.random() * 7, a: 0.7, r: 3 + Math.random() * 3 });
      g.lastF = fr;
    }
    if (g.et >= g.dur) { g.state = 'idle'; g.timer = 4 + Math.random() * 6; g.emote = null; }
  } else {
    g.timer -= dt;
    const ok = golemFree(gx, gy);
    if (!ok) {   // на месте построили здание — выбираемся или переезжаем
      g.stuck += dt;
      if (golemPickMove(g)) g.stuck = 0; else if (g.stuck > 10) { const at = Game.golem; spawnGolem(); if (!Game.golem) Game.golem = at; return; }
    } else if (g.timer <= 0) {
      if (Math.random() < 0.38) { g.state = 'emote'; golemPickEmote(g); g.et = 0; g.view = 'S'; g.lastF = -1; }
      else if (!golemPickMove(g)) g.timer = 1 + Math.random() * 2;
    }
  }
  for (const p of g.dust) { p.x += p.vx * dt; p.y += p.vy * dt; p.a -= dt * 0.55; p.r += dt * 2.2; }
  g.dust = g.dust.filter(p => p.a > 0);
}

// ---------- Отрисовка ----------

function golemFrameOf(g) {
  if (golemDorm()) return ['idle', 0];
  if (g.state === 'walk') return ['walk', Math.floor(g.ph * 8) & 7];
  if (g.state === 'emote') return [g.emote, Math.min(GL_FRAMES[g.emote] - 1, Math.floor(g.et / g.dur * GL_FRAMES[g.emote]))];
  return ['idle', Math.floor(g.t * 2.2) & 3];
}

function drawGolem(c, g) {
  const px = Math.round((g.fx + 1.5) * TILE), py = Math.round((g.fy + 2) * TILE - 10);
  const [pose, f] = golemFrameOf(g);
  const view0 = golemDorm() ? 'S' : g.view;
  let spr = golemSprite(view0, pose, f), view = view0;
  if (!spr) spr = g.last || golemSprite('S', 'idle', 0, true);
  g.last = spr;
  const lift = g.state === 'emote' && g.emote === 'wave' ? 1 : 0;
  // тень: широкая мягкая и плотное пятно под ступнями
  c.fillStyle = 'rgba(10,8,4,0.22)'; c.beginPath(); c.ellipse(px + 3, py + 1, 54, 12, 0, 0, 7); c.fill();
  c.fillStyle = 'rgba(10,8,4,0.28)'; c.beginPath(); c.ellipse(px + 2, py, 42, 8.5, 0, 0, 7); c.fill();
  c.imageSmoothingEnabled = false;
  const sh = g.state === 'emote' && g.emote === 'pound' ? Math.sin(g.et * 40) * 0.3 : 0;
  if (g.face < 0 && view === 'E') { c.save(); c.translate(px, py); c.scale(-1, 1); c.drawImage(spr, -GL_AX, -GL_AY, GL_W, GL_H); c.restore(); }
  else c.drawImage(spr, px - GL_AX + sh, py - GL_AY - lift * 0, GL_W, GL_H);
  c.imageSmoothingEnabled = R.smooth;
  for (const p of g.dust) { c.fillStyle = `rgba(176,160,128,${Math.max(0, p.a * 0.6)})`; c.beginPath(); c.ellipse(p.x, p.y, p.r * 1.3, p.r * 0.8, 0, 0, 7); c.fill(); }
}

function golemDrawList(list, c, x0, y0, x1, y1) {
  const g = Game.golem;
  if (!g || g.fx + 5 < x0 || g.fx - 3 > x1 || g.fy + 3 < y0 || g.fy - 3 > y1 + 2) return;
  list.push([g.fy + 1.75, () => drawGolem(c, g)]);
}

// ---------- Подключение: сброс, новая игра, сохранение ----------

{
  const _reset = resetGameState;
  resetGameState = function () { _reset(); Game.golem = null; };

  const _setup = setupStart;
  setupStart = function (seed, ...o) { _setup(seed, ...o); spawnGolem(); golemIdleWarm(); };   // пока открыто меню, браузер простаивает — кадры голема готовятся заранее

  const _step = step;
  step = function (dt) { _step(dt); golemTick(dt); };

  const _ser = serializeGame;
  serializeGame = function () {
    const s = _ser(), g = Game.golem;
    if (g) s.golem = { gx: Math.round(g.fx), gy: Math.round(g.fy) };
    return s;
  };

  const _apply = applySave;
  applySave = function (s) { _apply(s); spawnGolem(s.golem); };
}
