'use strict';
// Лесные нейтралы: пиксель-арт кадры. Четыре вида (лесная фея, леший, кабан-страж, чумной моховик),
// кадры по КАДРЫ.md (стандарт 12): покой, ходьба, атака, смерть, торжество — по 12, получение удара и парирование — 6.
// Смерть: удар, отшатнулся, падает, лежит, тает, остаётся пыль — 12 кадров по 0,055 с = 0,66 с самого падения плюс
// «растворение» ещё 1,4 с на последних кадрах (альфа гасится при отрисовке, а не новыми кадрами).
// Торжество крутится по кругу (поднял руки, подпрыгнул, пик, опустил), пока рядом лежит поверженный.
//
// Рисуется векторно в 3× и сводится в пиксели (toPixelArt) — тот же конвейер, что у деревьев, гномов и нечисти.
// Все кадры смотрят вправо, влево — отражением при отрисовке. Начало координат — точка земли под ногами.

// Стандарт 12 кадров (КАДРЫ.md, как у призраков): покой, ходьба, атака, смерть, торжество, колдовство, сон — по 12
// (10 к/с), получение удара — 6 (0,3 с). Прежние 4–9 поз остались ключевыми: промежуточные кадры — плавное
// смешение соседних ключей (naMix), рисовалки видов читают только числа позы, поэтому новые кадры не рисуются руками.
// Одиночные позы боя (ready, step, windup, strike, recover, parry, hurt, stagger, roar) живы для сцен и чужих файлов.
const naSeq = (p, n) => Array.from({ length: n }, (_, k) => p + k);
const NA_N = 12, NA_HURT_N = 6, NA_ATK_T = 0.56;     // атака: замах до 0,24 с, удар до 0,36, возврат до 0,56 (neuFrame)
const NA_FRAMES = {
  idle: naSeq('i', NA_N),                         // дыхание, покачивание, моргание
  walk: naSeq('w', NA_N),                         // полный шаг на обе ноги
  fight: ['ready', 'step', 'windup', 'strike', 'recover', 'parry', 'hurt', 'stagger', 'roar'],
  atk: naSeq('a', NA_N),                          // стойка → замах → удар → возврат
  hurt: naSeq('h', NA_HURT_N),                    // вздрогнул → отшатнулся → дрожь → просел → выпрямился
  die: naSeq('d', NA_N),
  win: naSeq('v', NA_N),
};
NA_FRAMES.cast = naSeq('c', NA_N);
NA_FRAMES.sleep = naSeq('z', NA_N);
NA_FRAMES.curse = naSeq('k', NA_N);   // тёмное заклинание: то же движение, но посох чёрно-фиолетовый
NA_FRAMES.roar = naSeq('r', NA_N);
NA_FRAMES.parry = naSeq('p', NA_HURT_N);
NA_FRAMES.hurt4 = NA_FRAMES.hurt;     // прежнее имя (neutrals2.js, frogart2.js)
const NA_EXTRA = { fairy: ['cast', 'curse', 'sleep'], pixie: ['cast', 'curse', 'sleep'] };
const NA_ALL = [].concat(NA_FRAMES.idle, NA_FRAMES.walk, NA_FRAMES.fight, NA_FRAMES.atk, NA_FRAMES.hurt, NA_FRAMES.die, NA_FRAMES.win);

// Смешение поз: числа — линейно, «переключатели» (глаза, лежит, тьма, сон) — по ближнему ключу
const NA_STEPF = { eye: 1, dead: 1, dark: 1, sleep: 1 };
function naMix(A, B, t) {
  const o = {};
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
    const d = k === 'sq' ? 1 : 0, a = A[k] ?? d, b = B[k] ?? d;
    o[k] = NA_STEPF[k] || typeof a !== 'number' ? (t < 0.5 ? a : b) : a + (b - a) * t;
  }
  return o;
}
// n кадров из ключей keys (позы): loop — по кругу, иначе от первого до последнего включительно
function naExpand(keys, n, loop) {
  const out = [], m = keys.length;
  for (let k = 0; k < n; k++) {
    const u = loop ? k / n * m : k / (n - 1) * (m - 1), i = Math.min(m - 1, Math.floor(u)), t = u - i;
    out.push(t < 1e-6 ? Object.assign({}, keys[i]) : naMix(keys[i], keys[(i + 1) % m], t));
  }
  return out;
}
// кадр атаки по времени от начала (t, с) при общей длительности dur: кадр 6 — удар
const naAtkFr = (t, dur = NA_ATK_T) => 'a' + Math.max(0, Math.min(NA_N - 1, Math.floor(t / dur * NA_N)));
const naIdleFr = (t, id = 0) => 'i' + (Math.floor(t * 10 + id) % NA_N + NA_N) % NA_N;     // 1,2 с на вдох-выдох
const naWalkFr = ph => 'w' + (Math.floor(ph * 1.5) % NA_N + NA_N) % NA_N;                  // ph — прежняя фаза шага (8 на цикл)
const naDieFr = dt => 'd' + Math.min(NA_N - 1, Math.floor(dt / 0.055));                     // падение 0,66 с, как было
const naWinFr = t => 'v' + (Math.floor(t * 10) % NA_N + NA_N) % NA_N;
const naHurtFr = t => 'h' + Math.max(0, Math.min(NA_HURT_N - 1, Math.floor(t / 0.05)));
// смысл кадра для чужих рисовалок (гномы-разбойники, дикие гномы, налётчики): 'windup' | 'strike' | 'recover' | 'hurt' | null
function naFightKey(fr) {
  if (!fr) return null;
  if (fr === 'windup' || fr === 'strike' || fr === 'recover') return fr;
  if (fr === 'hurt' || fr === 'stagger' || /^h\d/.test(fr)) return 'hurt';
  if (/^p\d/.test(fr)) return 'parry';
  if (/^a\d/.test(fr)) { const k = +fr.slice(1); return k < 5 ? 'windup' : k < 8 ? 'strike' : 'recover'; }
  return null;
}

// Общая таблица поз; рисовалка каждого вида читает только то, что ей нужно.
// x,y — сдвиг тела; rot — наклон; a — рука/голова/оружие: −1 замах … 0 готов … 1 удар; up — руки вверх;
// b — защита (парирование); leg — фаза шага −1…1; mouth — рот; eye — 0 обычный, 1 злой, 2 зажмурен, 3 крестик;
// hurt — «белая вспышка» от удара; sq — растяжение; wing — взмах; fade — растворение; dead — лежит
// ключевые позы (прежние кадры); из них naPoseTable собирает по 12 кадров на действие
const NA_KEY = {
  ready: { eye: 1, a: 0, wing: 0 },
  step: { x: 2, leg: 0.9, a: 0.15, eye: 1, wing: 1 },
  windup: { x: -2, rot: -0.1, a: -1, eye: 1, wing: -1 },
  strike: { x: 5, rot: 0.18, a: 1, eye: 1, mouth: 0.6, wing: 1 },
  recover: { x: 2, rot: 0.06, a: 0.35, eye: 1, wing: 0 },
  parry: { x: -2, rot: -0.08, b: 1, a: -0.2, eye: 1, wing: -1 },
  hurt: { x: -4, rot: -0.22, hurt: 1, eye: 2, mouth: 0.8, wing: -1 },
  stagger: { x: -2, rot: 0.14, hurt: 0.55, eye: 2, y: 1, wing: 1 },
  roar: { y: -1, rot: -0.14, a: -0.6, mouth: 1, eye: 1, sq: 1.08, wing: 1 },
  d0: { x: -4, rot: -0.25, hurt: 1, eye: 2, mouth: 0.6, wing: -1 },
  d1: { x: -6, rot: -0.6, y: 0, hurt: 0.7, eye: 3, a: -0.5, wing: 1 },
  d2: { x: -8, rot: -1.1, y: -1, hurt: 0.4, eye: 3, a: -0.2, wing: -1 },
  d3: { x: -9, rot: -1.5, y: -3, eye: 3, dead: 1, wing: 0 },
  d4: { x: -9, rot: -1.5, y: -3, eye: 3, dead: 1, fade: 0.45 },
  d5: { x: -9, rot: -1.5, y: -3, eye: 3, dead: 1, fade: 0.85 },
  c0: { a: -0.6, wing: -1, eye: 0, rot: -0.05 },
  c1: { up: 1, y: -2, eye: 0, wing: 1, cast: 0.2 },
  c2: { up: 1, y: -4, rot: 0.08, eye: 0, mouth: 0.5, wing: -1, cast: 0.55 },
  c3: { a: 0.6, x: 2, y: -2, eye: 0, mouth: 0.4, wing: 1, cast: 1 },
  c4: { a: 1, x: 3, rot: 0.14, eye: 0, wing: -1, cast: 0.8 },
  c5: { a: 0.3, x: 1, eye: 0, wing: 0, cast: 0.3 },
  k0: { a: -0.6, wing: -1, eye: 1, rot: -0.05, dark: 1 },
  k1: { up: 1, y: -2, eye: 1, wing: 1, cast: 0.2, dark: 1 },
  k2: { up: 1, y: -4, rot: 0.08, eye: 1, mouth: 0.5, wing: -1, cast: 0.55, dark: 1 },
  k3: { a: 0.6, x: 2, y: -2, eye: 1, mouth: 0.4, wing: 1, cast: 1, dark: 1 },
  k4: { a: 1, x: 3, rot: 0.14, eye: 1, wing: -1, cast: 0.8, dark: 1 },
  k5: { a: 0.3, x: 1, eye: 1, wing: 0, cast: 0.3, dark: 1 },
  z0: { rot: -1.45, x: -9, y: -3, eye: 2, sleep: 1 },
  z1: { rot: -1.45, x: -9, y: -2.4, eye: 2, sleep: 2 },
  v0: { up: 1, eye: 0, mouth: 0.3, wing: 1 },
  v1: { up: 1, y: -5, eye: 0, mouth: 1, wing: -1 },
  v2: { up: 1, y: -1, eye: 0, mouth: 0.4, wing: 1 },
  v3: { up: 0.2, a: 0.2, rot: 0.05, eye: 0, mouth: 0.5, wing: 0 },
};
let NA_T = null;
function naPoseTable() {
  const K = NA_KEY, T = Object.assign({}, K), put = (p, arr) => arr.forEach((q, k) => { T[p + k] = q; });
  const TAU = Math.PI * 2;
  // покой: вдох-выдох (y, растяжение), мерное махание крыльями, подёргивание рукой, моргание на 9-м кадре (0,1 с)
  for (let k = 0; k < NA_N; k++) { const c = (1 - Math.cos(k / NA_N * TAU)) / 2; T['i' + k] = { y: -c, sq: 1 + 0.02 * c, wing: Math.max(-1, Math.min(1, Math.sin(k / NA_N * TAU) * 1.3)), a: 0.05 * c, eye: k === 8 ? 2 : 0 }; }
  // ходьба: фаза ноги по синусу, подскок на каждом шаге, крылья в такт
  for (let k = 0; k < NA_N; k++) { const ph = Math.sin(k / NA_N * TAU); T['w' + k] = { leg: Math.round(ph * 100) / 100, y: -Math.round(Math.abs(ph) * 90) / 100, wing: -Math.cos(k / NA_N * TAU) }; }
  // атака: ключи по времени (с) — стойка, замах к 0,22, удар 0,30, возврат 0,44, стойка 0,56; кадр берёт середину своего отрезка
  const AK = [[0, K.ready], [0.22, K.windup], [0.3, K.strike], [0.44, K.recover], [NA_ATK_T, K.ready]];
  for (let k = 0; k < NA_N; k++) {
    const u = (k + 0.5) / NA_N * NA_ATK_T; let i = 0;
    while (i < AK.length - 2 && u > AK[i + 1][0]) i++;
    const t = Math.max(0, Math.min(1, (u - AK[i][0]) / (AK[i + 1][0] - AK[i][0])));
    T['a' + k] = naMix(AK[i][1], AK[i + 1][1], t * t * (3 - 2 * t));
  }
  // получение удара, 6 кадров по 0,05 с
  put('h', [
    { x: -2, rot: -0.1, hurt: 1, eye: 2, mouth: 0.5, wing: -1, a: -0.2 },                  // вздрогнул
    { x: -4, rot: -0.22, hurt: 1, eye: 2, mouth: 0.8, wing: 1, a: -0.4 },                  // отшатнулся
    { x: -3.5, y: 0.5, rot: -0.17, hurt: 0.75, eye: 2, mouth: 0.9, wing: -1, a: -0.3 },    // дрожь
    { x: -3, y: 1, rot: -0.12, hurt: 0.45, eye: 2, sq: 0.94, wing: -0.5, a: -0.1 },        // просел
    { x: -1.8, y: 0.5, rot: -0.07, hurt: 0.25, eye: 1, sq: 0.97, wing: 0.5 },              // поднимается
    { x: -0.6, rot: -0.02, hurt: 0.08, eye: 1, wing: 0 },                                  // выпрямился
  ]);
  put('r', naExpand([K.ready, K.roar, Object.assign({}, K.roar, { y: -1.6, sq: 1.11 }), K.roar, K.ready], NA_N, false));   // рёв-зов своих
  put('p', naExpand([K.ready, K.parry, Object.assign({}, K.parry, { x: -2.6 }), K.ready], NA_HURT_N, false));       // парирование, как и рана, — 6
  put('d', naExpand([K.d0, K.d1, K.d2, K.d3, K.d4, K.d5], NA_N, false));
  put('c', naExpand([K.c0, K.c1, K.c2, K.c3, K.c4, K.c5], NA_N, false));
  put('k', naExpand([K.k0, K.k1, K.k2, K.k3, K.k4, K.k5], NA_N, false));
  put('v', naExpand([K.v0, K.v1, K.v2, K.v3, K.v2, K.v1], NA_N, true));                  // поднял руки, подпрыгнул, пик, опустил — по кругу
  for (let k = 0; k < NA_N; k++) { const c = (1 - Math.cos(k / NA_N * TAU)) / 2; T['z' + k] = { rot: -1.45, x: -9, y: -3 + 0.6 * c, eye: 2, sleep: k < NA_N / 2 ? 1 : 2 }; }   // сон: медленный вдох
  return T;
}
function naPose(n) {
  const T = NA_T || (NA_T = naPoseTable());
  return Object.assign({ dark: 0, cast: 0, sleep: 0, x: 0, y: 0, rot: 0, a: 0, up: 0, b: 0, leg: 0, mouth: 0, eye: 0, hurt: 0, sq: 1, wing: 0, fade: 0, dead: 0 }, T[n]);
}

const NA_SPEC = {
  pixie:   { name: 'Цветочная фея', w: 104, h: 104, ax: 62, ay: 82, sc: 1.45, pal: { dr: '#7ad068', dr2: '#3f9a4a', hr: '#a8f0a0', hr2: '#5ab868', wing: '#a6e87a', wing2: '#3a9a4a', wing3: '#f2ffc0', wingBack: '#6cc858', tip: '#ffe0f4', crown: true } },
  fairy:   { name: 'Лесная фея',    w: 104, h: 104, ax: 62, ay: 82, sc: 1.45 },
  leshy:   { name: 'Леший',         w: 128, h: 88, ax: 58, ay: 80 },
  boar:    { name: 'Кабан-страж',   w: 84, h: 60, ax: 42, ay: 50, sc: 1.25 },
  spore:   { name: 'Чумной моховик', w: 90, h: 64, ax: 54, ay: 54, sc: 1.2 },
};

const naCache = new Map();
// Ручной пиксель-арт на сетке ×3 (как Полудница, fzPxKit в fairy2.js): NA_PX[вид](K, P, кадр) рисует позу
// стоя, в пикселях арта (3 на игровой), начало — у ног, лицом вправо. Сдвиг, наклон и вспышку удара
// из позы накладывает naPxFrame. На телефонах (PX_FINE = 1) кадр сводится в ×1 (pxToCoarse).
const NA_PX = {};
function naPxFrame(kind, S, P, fr) {
  const W = S.w * 3, H = S.h * 3, AX = S.ax * 3, AY = S.ay * 3, sc = (S.sc || 1) * 3;
  const K = fzPxKit(W, H, AX, AY);
  NA_PX[kind](K, P, fr);
  const art = K.done(), out = mkCanvas(W, H), o = out.getContext('2d');
  o.imageSmoothingEnabled = false;
  o.translate(AX + Math.round(P.x * sc), AY + Math.round(P.y * sc));
  if (P.rot) o.rotate(P.rot);
  if (P.sq && P.sq !== 1) o.scale(1 / Math.sqrt(P.sq), P.sq);
  o.drawImage(art, -AX, -AY);
  if (P.hurt > 0.05) {                                   // вспышка удара: тёплый блик по силуэту
    o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-atop';
    o.fillStyle = `rgba(255,236,220,${Math.min(0.4, P.hurt * 0.32)})`; o.fillRect(0, 0, W, H);
  }
  out.fine = 3;
  return out;
}
const NA_CACHE_PX = 24e6;          // предел пикселей в кэше (~96 МБ): самые давние кадры уходят первыми
let naCachePx = 0;
function naHash(a, b) { const n = Math.sin(a * 127.1 + b * 311.7 + 374.5) * 43758.5453; return n - Math.floor(n); }

function naFrame(kind, fr) {
  const key = kind + '|' + fr;
  let s = naCache.get(key);
  if (s) { naCache.delete(key); naCache.set(key, s); return s; }
  // кадр строится десятки мс (ручной ×3-арт — на телефоне сотни): в кадре игры при готовом соседнем кадре той же
  // анимации (или любом этого вида) — пока он, новый позже, по бюджету тяжёлых сборок (heavyBuildOk, people.js)
  const heavy = typeof heavyBuildOk === 'function' && typeof R !== 'undefined' && R.inFrame;
  if (heavy) {
    const fb = naNear(kind, fr);
    if (fb && (!heavyBuildOk(true) || !spriteBudgetOk(true))) return fb;
  }
  const t0 = performance.now();
  const S = NA_SPEC[kind], F = PX_FINE;
  const P = naPose(fr);
  P.pal = S.pal || null;
  let out;
  if (NA_PX[kind]) out = pxToCoarse(naPxFrame(kind, S, P, fr));   // на телефоне — тот же арт, сведённый в ×1
  else {
    // мелкий пиксель: F деталей на игровой пиксель, сверхвыборка 2 на пиксель арта (при F = 1 — 3, как было)
    const [cv, c] = (typeof mkScratch === 'function' ? mkScratch : mkSprite)(S.w, S.h, F > 1 ? 2 * F : 3);   // OffscreenCanvas — чтение пикселей быстрее
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.save();
    c.translate(S.ax, S.ay);
    if (S.sc) c.scale(S.sc, S.sc);
    NA_DRAW[kind](c, P, fr);
    c.restore();
    out = toPixelArt(cv, F > 1 ? 2 : 3, { outline: true, outlineDark: 0.3, alphaCut: 100 });
    out.fine = F;
  }
  if (P.fade > 0) {   // рассыпается пикселями: случайные точки пропадают (пиксель-арт «дизер»), остальные бледнеют
    const oc = out.getContext('2d'), img = oc.getImageData(0, 0, out.width, out.height), d = img.data;
    for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) {
      const o = (y * out.width + x) * 4;
      if (!d[o + 3]) continue;
      if (naHash(x, y) < P.fade) d[o + 3] = 0;
      else { d[o] = d[o] + (230 - d[o]) * P.fade * 0.4; d[o + 1] = d[o + 1] + (240 - d[o + 1]) * P.fade * 0.4; d[o + 2] = d[o + 2] + (200 - d[o + 2]) * P.fade * 0.4; }
    }
    oc.putImageData(img, 0, 0);
  }
  s = { cv: out, ax: S.ax, ay: S.ay, w: S.w, h: S.h };
  naCachePx += out.width * out.height;
  while (naCachePx > NA_CACHE_PX && naCache.size) {
    const k0 = naCache.keys().next().value, c0 = naCache.get(k0).cv;
    naCachePx -= c0.width * c0.height; naCache.delete(k0);
  }
  naCache.set(key, s);
  if (heavy) { spriteSpent(t0); heavySpent(t0); }
  return s;
}
// Готовый кадр того же вида: ближайший номер той же анимации, иначе покой, иначе любой
function naNear(kind, fr) {
  const m = /^([a-z]+)(\d+)$/.exec(fr || '');
  if (m) for (let d = 1; d <= 12; d++) for (const n of [+m[2] - d, +m[2] + d]) { const s = n >= 0 && naCache.get(kind + '|' + m[1] + n); if (s) return s; }
  const i0 = naCache.get(kind + '|i0');
  if (i0) return i0;
  for (const [k, s] of naCache) if (k.startsWith(kind + '|')) return s;
  return null;
}

// ---------- общие помощники ----------

const naK = (P, col) => (P.hurt > 0.01 ? shade(col, P.hurt * 0.26) : col);
const naDir = a => [Math.sin(a), Math.cos(a)];   // угол от «вниз» вперёд
function naLimb(c, x0, y0, x1, y1, w, col) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
// двухзвенная рука: плечо → локоть → кисть, угол направления в ra
function naArm(c, sx, sy, L1, L2, th, bend, w, col) {
  const [dx, dy] = naDir(th), [ex, ey] = naDir(th + bend);
  const mx = sx + dx * L1, my = sy + dy * L1, hx = mx + ex * L2, hy = my + ey * L2;
  naLimb(c, sx, sy, mx, my, w, col); naLimb(c, mx, my, hx, hy, w * 0.9, col);
  return [hx, hy, th + bend];
}
// угол замаха из позы: −1 → вверх-назад, 0 → готов, 1 → вперёд-вниз-в-цель; руки вверх (торжество) — поверх всего
function naTheta(P) {
  if (P.up > 0.5) return -3.0 + (1 - P.up) * 2.4;
  return P.a < 0 ? 0.7 + P.a * 3.2 : 0.7 + P.a * 0.9;
}
function naShadow(c, w, k = 1) { c.fillStyle = 'rgba(10,8,4,0.32)'; c.beginPath(); c.ellipse(0, 0.5, w, w * 0.28, 0, 0, 7); c.fill(); }
function naEye(c, x, y, P, col, r = 1) {
  if (P.eye === 3) { c.strokeStyle = '#1a0f0a'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(x - 0.8, y - 0.8); c.lineTo(x + 0.8, y + 0.8); c.moveTo(x + 0.8, y - 0.8); c.lineTo(x - 0.8, y + 0.8); c.stroke(); return; }
  if (P.eye === 2) { c.strokeStyle = '#1a0f0a'; c.lineWidth = 0.55; c.beginPath(); c.moveTo(x - 1, y); c.lineTo(x + 0.8, y + 0.2); c.stroke(); return; }
  ellipse(c, x, y, r, r * (P.eye === 1 ? 0.7 : 1), col || '#1a0f0a');
  if (P.eye === 1) { c.strokeStyle = '#1a0f0a'; c.lineWidth = 0.55; c.beginPath(); c.moveTo(x - 1.4, y - 1.5); c.lineTo(x + 1.2, y - 0.4); c.stroke(); }
}

// =============== Лесная фея ===============
function drawFairy(c, P) {
  const lift = P.dead ? 0 : P.sleep ? 1 : 7;
  c.save();
  c.translate(P.x, P.y - lift);
  c.rotate(P.rot);
  const PL = P.pal || {}, SK = naK(P, '#f6d8b8'), SK2 = naK(P, '#d9ac88');
  const DR = naK(P, PL.dr || '#3fa83a'), DR2 = naK(P, PL.dr2 || '#2a7430'), HR = naK(P, PL.hr || '#2f8a3c'), HR2 = naK(P, PL.hr2 || '#1e5a2a');
  const WC = PL.wing || '#7ad65a', WC2 = PL.wing2 || '#2e8a3a', WC3 = PL.wing3 || '#e4ffb0';
  const fl = P.dead || P.sleep ? -1 : P.wing;
  const WX = -1.2, WY = -19.6;   // где крылья крепятся к спине
  // тонкие длинные крылья-«листья» бабочки: верхние длинные, нижние короче; дальняя пара темнее и чуть выше
  const wing = (k, col, edge, dy, rot) => {
    c.save(); c.translate(WX, WY + dy); c.rotate(rot);
    const up = -15 * k - fl * 3 * k;
    const leaf = (tx, ty, w) => {
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(tx * 0.2 - w, ty * 0.5, tx, ty); c.quadraticCurveTo(tx * 0.9 + w * 0.2, ty * 0.35, 0, 0); c.closePath();
      c.fillStyle = col; c.fill(); c.strokeStyle = edge; c.lineWidth = 0.55; c.stroke();
      c.strokeStyle = WC3; c.lineWidth = 0.35; c.beginPath(); c.moveTo(0, 0); c.lineTo(tx * 0.85, ty * 0.85); c.stroke();
    };
    leaf(-9 * k, up, 3.2 * k);
    leaf(-11 * k, 8 * k + fl * 2 * k, 2.6 * k);
    ellipse(c, -6.4 * k, up * 0.62, 0.8 * k, 0.8 * k, WC3); ellipse(c, -7.4 * k, 4.4 * k, 0.6 * k, 0.6 * k, WC3);
    c.restore();
  };
  wing(0.92, naK(P, PL.wingBack || '#3f9a3a'), WC2, -0.4, -0.18);
  // тонкие длинные ноги
  const sw = P.leg * 1.3;
  naLimb(c, -0.9, -10.6, -1.3 + sw, -0.6, 1.1, SK2); naLimb(c, 1, -10.6, 1.4 - sw, -0.6, 1.2, SK);
  ellipse(c, -1.3 + sw, -0.4, 1.1, 0.5, SK2); ellipse(c, 1.5 - sw, -0.4, 1.2, 0.5, SK);
  // дальняя рука
  naArm(c, -1.2, WY + 0.6, 3.5, 3.4, P.up > 0.5 ? -2.7 : 0.35 + P.b * 0.2, -0.4, 0.95, SK2);
  // бёдра и юбка из листьев
  ellipse(c, 0, -11.6, 3.1, 1.9, SK);
  poly(c, [[-3.4, -12.4], [3.4, -12.4], [4.6 + P.leg * 0.4, -9.2], [2.6, -10], [0.8, -8.2], [-0.8, -9.8], [-2.8, -8.8], [-4.6 - P.leg * 0.4, -9.4]], DR);
  poly(c, [[-3.4, -12.4], [-0.4, -12.4], [-0.8, -9.8], [-2.8, -8.8], [-4.6, -9.4]], DR2);
  c.fillStyle = naK(P, '#d4f59a'); c.fillRect(-3.4, -12.5, 6.8, 0.6);
  // талия тонкая, плечи и грудь: песочные часы
  poly(c, [[-1.3, -13.2], [1.3, -13.2], [2.4, -15.4], [3, -17.8], [2.6, -20.2], [-2.6, -20.2], [-3, -17.8], [-2.4, -15.4]], SK);
  poly(c, [[-1.3, -13.2], [-0.2, -13.2], [-0.6, -20.2], [-2.6, -20.2], [-3, -17.8], [-2.4, -15.4]], SK2);
  ellipse(c, 0, -20.3, 3.5, 1.1, SK);                         // плечи
  ellipse(c, 2.5, -17.8, 1.85, 1.7, SK);                      // грудь
  ellipse(c, 2.1, -18.1, 0.9, 0.7, shade(SK, 0.25));
  // топ из двух листьев + лямки
  poly(c, [[-0.6, -19.4], [4.4, -19.2], [4.5, -16.6], [2.8, -16], [0.4, -16.4]], DR);
  poly(c, [[-0.6, -19.4], [1.6, -19.3], [1.2, -16], [0.4, -16.2]], DR2);
  c.strokeStyle = DR2; c.lineWidth = 0.5; c.beginPath(); c.moveTo(1, -19.6); c.lineTo(0.2, -21); c.moveTo(4.4, -19.4); c.lineTo(3.6, -21); c.stroke();
  // ближняя рука с палочкой
  const th = naTheta(P);
  const [hx, hy, ang] = naArm(c, 0.8, -20, 3.8, 3.6, th, -0.5 + P.b * 0.6, 0.95, SK);
  if (P.b > 0.5) { c.strokeStyle = 'rgba(190,255,230,0.9)'; c.lineWidth = 0.7; c.beginPath(); c.arc(6, -17, 6, -1.2, 1.2); c.stroke(); }
  const [wx, wy] = naDir(ang + 0.2);
  naLimb(c, hx, hy, hx + wx * 7, hy + wy * 7, P.dark ? 1 : 0.8, P.dark ? '#2a1236' : '#8a6a3a');
  if (P.dark) { const ex = hx + wx * 7, ey = hy + wy * 7; naLimb(c, ex, ey, ex + wx * 1.6 - wy * 1.4, ey + wy * 1.6 + wx * 1.4, 0.8, '#2a1236'); naLimb(c, ex, ey, ex + wx * 1.6 + wy * 1.4, ey + wy * 1.6 - wx * 1.4, 0.8, '#2a1236'); }   // рогатый навершие
  const tipx = hx + wx * 7.3, tipy = hy + wy * 7.3;
  c.save(); c.globalCompositeOperation = 'lighter';
  ellipse(c, tipx, tipy, 2.4 + (P.a > 0.5 ? 1.5 : 0), 2.4 + (P.a > 0.5 ? 1.5 : 0), P.dark ? 'rgba(170,40,230,0.6)' : 'rgba(255,240,140,0.55)');
  c.restore();
  ellipse(c, tipx, tipy, 1.3, 1.3, P.dark ? '#1a0a24' : (PL.tip || '#fff6b0'));
  if (P.dark) { c.fillStyle = '#ff3a8a'; c.fillRect(tipx - 0.5, tipy - 0.5, 1, 1); }
  if (P.a > 0.5 || P.up > 0.5) for (const [dx, dy] of [[3, -2], [2, 2.4], [4.4, 0.4], [-1, -3]]) { c.fillStyle = P.dark ? '#b04aff' : '#fff6b0'; c.fillRect(tipx + dx - 0.4, tipy + dy - 0.4, 0.8, 0.8); }
  if (P.cast > 0) {   // колдовство: расходящееся кольцо рун вокруг кончика палочки
    c.save(); c.globalCompositeOperation = 'lighter';
    const rr = 3 + P.cast * 7;
    c.strokeStyle = P.dark ? 'rgba(190,70,255,0.9)' : 'rgba(214,255,176,0.85)'; c.lineWidth = 0.7; c.beginPath(); c.ellipse(tipx, tipy, rr, rr * 0.8, 0, 0, 7); c.stroke();
    if (P.dark) { c.beginPath(); c.ellipse(tipx, tipy, rr * 0.6, rr * 0.48, 0, 0, 7); c.stroke(); }   // двойное кольцо, как тёмная печать
    for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283 + P.cast * 2; c.fillStyle = P.dark ? (k % 2 ? '#ff4a8a' : '#c060ff') : (k % 2 ? '#fff6b0' : '#ffb0e0'); c.fillRect(tipx + Math.cos(a) * rr - 0.6, tipy + Math.sin(a) * rr * 0.8 - 0.6, 1.3, 1.3); }
    c.restore();
  }
  // шея и голова
  const hx0 = 0.9, hy0 = -24 + (P.hurt > 0.5 ? 0.6 : 0);
  c.fillStyle = SK2; c.fillRect(hx0 - 0.9, hy0 + 2, 1.8, 2.4);
  // длинные волосы струятся за спиной и покачиваются
  const hsw = fl * 0.9;
  poly(c, [[hx0 - 2.4, hy0 - 1.6], [hx0 - 4.4 - hsw, hy0 + 4], [hx0 - 5.4 - hsw * 1.4, -11.5], [hx0 - 3.4 - hsw, -10], [hx0 - 1.6, -15], [hx0 + 0.2, hy0 + 3]], HR2);
  poly(c, [[hx0 - 2.4, hy0 - 1.6], [hx0 - 3.6 - hsw, hy0 + 3.4], [hx0 - 4.6 - hsw, -13], [hx0 - 2.6, hy0 + 3.4]], HR);
  ellipse(c, hx0, hy0, 2.7, 2.9, SK);
  ellipse(c, hx0 + 0.9, hy0 + 1.2, 1.2, 0.8, shade(SK, 0.1));
  poly(c, [[hx0 - 2.6, hy0 - 1.6], [hx0 + 0.4, hy0 - 3.6], [hx0 + 3.4, hy0 - 1.2], [hx0 + 2.4, hy0 - 2], [hx0 + 0.2, hy0 - 2.6]], HR);   // чёлка
  ellipse(c, hx0 - 1.2, hy0 - 3, 1.5, 1.2, HR);
  poly(c, [[hx0 + 2.4, hy0 - 0.6], [hx0 + 5.4, hy0 - 1.8], [hx0 + 2.8, hy0 + 0.4]], SK);                                                  // острое ушко
  if (!P.dead) { ellipse(c, hx0 + 0.2, hy0 - 2.6, 1.3, 0.6, '#ffe070'); c.fillStyle = '#ff6ad0'; c.fillRect(hx0 - 0.1, hy0 - 3.1, 0.7, 0.7); }   // диадема с самоцветом
  if (PL.crown) for (const [fx, fy, fc] of [[-1.8, -2.4, '#ff8ac8'], [2, -2.6, '#ffe070']]) ellipse(c, hx0 + fx, hy0 + fy, 0.9, 0.9, fc);
  naEye(c, hx0 + 1.5, hy0 - 0.1, P.eye === 1 ? Object.assign({}, P, { eye: 0 }) : P, P.dark ? '#c060ff' : '#1a3a4a', P.dark ? 0.95 : 0.7);   // без бровей; в тёмном заклинании глаза светятся
  if (P.mouth > 0.4) ellipse(c, hx0 + 1.7, hy0 + 1.5, 0.7, 0.8 * P.mouth, '#8a2a3a');
  else { c.fillStyle = '#d0586a'; c.fillRect(hx0 + 1.1, hy0 + 1.3, 1, 0.5); }
  // ближние крылья поверх спины
  wing(1, naK(P, WC), WC2, 0, 0.06);
  // сказочная пыльца: звёздочки-крестики вокруг и след за спиной
  const dust = P.sleep ? [] : [[-12, -3, 0], [-16, -16, 1], [8, -27, 2], [-6, -30, 3], [11, -4, 4], [-12, -25, 5]];
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const [dx, dy, k] of dust) {
    if (P.dead && k > 2) continue;
    const ph = (k + (fl > 0 ? 1 : 0) + (P.leg > 0 ? 1 : 0)) % 3, x = dx + Math.sin(fl * 2 + k) * 1.2, y = dy + (ph - 1) * 1.1 + P.leg * 0.6;
    c.fillStyle = ['#fff6b0', '#d4ffb8', '#ffffff'][ph];
    if (ph === 0) { c.fillRect(x - 1.4, y - 0.35, 2.8, 0.7); c.fillRect(x - 0.35, y - 1.4, 0.7, 2.8); } else c.fillRect(x - 0.5, y - 0.5, 1, 1);
  }
  c.restore();
  if (P.sleep) {   // спит: «z-z-z» над головой (в координатах кадра, не повёрнутых)
    c.fillStyle = '#f2ffd0';
    const zz = (x, y, k) => { c.fillRect(x, y, 3 * k, 0.8 * k); c.fillRect(x + 2 * k, y + 0.8 * k, 0.9 * k, 0.9 * k); c.fillRect(x + 1 * k, y + 1.6 * k, 0.9 * k, 0.9 * k); c.fillRect(x, y + 2.4 * k, 3 * k, 0.8 * k); };
    zz(-12 + (P.sleep > 1 ? 2 : 0), -14 - (P.sleep > 1 ? 3 : 0), 1); zz(-8 + (P.sleep > 1 ? 3 : 0), -21 - (P.sleep > 1 ? 4 : 0), 0.7);
  }
  c.restore();
}

// =============== Леший ===============
// Хозяин леса: сгорбленный дед ростом с молодую ель. Плащ из мха и листьев до земли (из-под подола — корни-ступни),
// берестяное лицо с сучком-носом, светящиеся зелёные глаза под лиственными бровями, борода-лишайник до пояса,
// ветвистые рога с листвой и узловатый посох с живым огоньком-лишайником. Длинные руки-сучья.
function drawLeshy(c, P) {
  naShadow(c, 13);
  c.save();
  c.translate(P.x, P.y);
  c.rotate(P.rot);
  c.scale(1, P.sq);
  const CL = naK(P, '#4a7a32'), CL2 = naK(P, '#2f5424'), CL3 = naK(P, '#6e9c44'), LF = naK(P, '#8cc24e'), AU = naK(P, '#d89a3a');
  const BR = naK(P, '#b39a72'), BR2 = naK(P, '#86704e'), BR3 = naK(P, '#5c4c38'), AR = naK(P, '#7c5c38'), TW = naK(P, '#6a4a2c'), TW2 = naK(P, '#4a321e');
  const LI = naK(P, '#d2d8c0'), LI2 = naK(P, '#99a888'), EY = '#d8ff6a';
  const sw = P.leg, hunch = P.up > 0.5 ? -0.5 : 1;
  // корни-ступни из-под плаща
  naLimb(c, -4, -6, -6 - sw * 3, -0.6, 3.2, TW2); naLimb(c, 4, -6, 5.5 + sw * 3, -0.6, 3.4, TW);
  poly(c, [[-10 - sw * 3, 0], [-6 - sw * 3, -2.2], [-3 - sw * 3, 0]], TW2); poly(c, [[3 + sw * 3, 0], [7 + sw * 3, -2.4], [11 + sw * 3, 0]], TW);
  c.strokeStyle = TW2; c.lineWidth = 0.8; c.beginPath(); c.moveTo(10 + sw * 3, -0.4); c.lineTo(12.6 + sw * 3, 0.2); c.moveTo(-9.6 - sw * 3, -0.4); c.lineTo(-12 - sw * 3, 0.3); c.stroke();
  // дальняя рука в рукаве
  const th2 = P.b > 0.5 ? -1.0 : P.up > 0.5 ? -2.8 : 0.25 - P.a * 0.5;
  const [fx, fy] = naArm(c, -3 + hunch, -37, 9, 8, th2, P.b > 0.5 ? 1.6 : 0.3, 3.6, CL2);
  ellipse(c, fx, fy, 1.9, 1.8, BR3);
  // плащ: от плеч до земли, подол рваный, листьями; качается в такт шагу
  const hem = [];
  for (let k = 0; k <= 8; k++) hem.push([-13 + k * 3.3 + sw * 1.2 * (k / 8 - 0.5), k % 2 ? -2 : -4.6]);
  poly(c, [[-6 + hunch, -40], [9 + hunch, -40], [12.6, -20], [14, -4], ...hem.slice().reverse(), [-13.6, -4], [-11, -22]], CL);
  poly(c, [[-6 + hunch, -40], [-1 + hunch, -40], [-3, -20], [-4, -3], [-13, -4], [-13.6, -4], [-11, -22]], CL2);
  c.fillStyle = CL3;
  for (const [x, y] of [[4, -34], [7, -27], [2, -22], [9, -14], [-2, -12], [5, -8], [-8, -17], [10.5, -6]]) { c.fillRect(x, y, 2, 1.2); c.fillRect(x + 0.6, y - 0.8, 0.9, 0.8); }
  for (const [x, y] of hem) { c.fillStyle = LF; c.fillRect(x - 0.6, y + 0.4, 1.6, 1.6); }
  c.fillStyle = AU; c.fillRect(6.4, -18, 1.4, 1.4); c.fillRect(-6, -9, 1.4, 1.4); c.fillRect(11, -28, 1.4, 1.2);
  // грибы на подоле
  naLimb(c, -9, -6, -9, -3.6, 1.1, '#e8e0c8'); ellipse(c, -9, -6.4, 2.2, 1.3, naK(P, '#c8483a'));
  ellipse(c, -6.4, -5, 1.5, 1, naK(P, '#c8483a')); c.fillStyle = '#f6ece0'; c.fillRect(-9.6, -7.2, 0.8, 0.7); c.fillRect(-8.2, -6.8, 0.7, 0.6);
  // ближняя рука: моховой рукав, кора-предплечье, кисть с пальцами; рисуется до головы — плечо уходит за бороду. Посох — сбоку:
  // в покое и на ходу стоит на земле, в бою леший бьёт набалдашником с размаху
  const fighting = Math.abs(P.a) > 0.25 || P.up > 0.5 || P.b > 0.5;
  const shx = 9 + hunch * 0.6, shy = -36;
  const th = fighting ? naTheta(P) : 0.75, bend = P.up > 0.5 ? 0.2 : fighting ? -0.5 : -1.0;
  const [d1x, d1y] = naDir(th), [d2x, d2y] = naDir(th + bend);
  const ex = shx + d1x * 8.6, ey = shy + d1y * 8.6, hx2 = ex + d2x * 7.6, hy2 = ey + d2y * 7.6, ang = th + bend;
  let top, bot;
  if (fighting) { const [dx, dy] = naDir(ang + 0.15); bot = [hx2 - dx * 6, hy2 - dy * 6]; top = [hx2 + dx * 20, hy2 + dy * 20]; }
  else { top = [hx2 + 0.4, hy2 - 13]; bot = [hx2 + 1.4 + sw, -0.4]; }
  const mid = [(bot[0] + top[0]) / 2 + 1.2, (bot[1] + top[1]) / 2];
  c.strokeStyle = TW2; c.lineWidth = 2.4; c.beginPath(); c.moveTo(bot[0], bot[1]); c.quadraticCurveTo(mid[0], mid[1], top[0], top[1]); c.stroke();
  c.strokeStyle = TW; c.lineWidth = 0.9; c.beginPath(); c.moveTo(bot[0] - 0.6, bot[1]); c.quadraticCurveTo(mid[0] - 0.6, mid[1], top[0] - 0.6, top[1]); c.stroke();
  // набалдашник: завиток ветки и огонёк-лишайник
  c.strokeStyle = TW2; c.lineWidth = 1.6; c.beginPath(); c.arc(top[0] + 1.6, top[1] - 0.6, 2.2, 3.4, 6.48); c.stroke();
  ellipse(c, top[0] + 1.6, top[1] - 0.8, 1.6, 1.6, EY); ellipse(c, top[0] + 1.6, top[1] - 0.8, 0.7, 0.7, '#ffffe0');
  ellipse(c, top[0] - 1.6, top[1] + 2.4, 1.4, 1, LF);
  // рука поверх посоха — кисть его обхватывает
  naLimb(c, shx, shy, ex, ey, 4.6, CL2); naLimb(c, shx, shy, ex, ey, 3.2, CL);           // рукав
  ellipse(c, shx, shy, 3, 2.6, CL3);                                                      // моховой наплечник
  naLimb(c, ex, ey, hx2, hy2, 2.8, AR);                                                   // предплечье
  ellipse(c, ex, ey, 2.2, 2, CL3);                                                        // край рукава
  ellipse(c, hx2, hy2, 2.1, 2, AR);                                                       // кисть
  c.fillStyle = BR3; for (const k of [-1, 0, 1]) c.fillRect(hx2 + 0.6 + k * 0.2, hy2 - 1.4 + k * 1.1, 1.6, 0.7);   // пальцы
  // голова: вынесена вперёд (горбится), берестяная
  const hy = -46 + (P.hurt > 0.5 ? 1.2 : 0) + (P.up > 0.5 ? -2 : 0), hx = 5 * hunch + 1 + (P.a > 0.5 ? 1.4 : 0);
  // рога-ветви с листвой
  const antler = (bx, side, col) => {
    const tx = bx + side * 6, ty = hy - 15;
    naLimb(c, bx, hy - 5, bx + side * 2, hy - 10, 1.6, col); naLimb(c, bx + side * 2, hy - 10, tx, ty, 1.3, col);
    naLimb(c, bx + side * 2, hy - 10, bx + side * 1, hy - 16, 1.1, col);
    naLimb(c, tx - side * 1.6, ty + 2.4, tx + side * 3, ty + 1, 1, col);
    naLimb(c, tx, ty, tx + side * 1.2, ty - 3.4, 1, col);
    for (const [lx, ly, cc] of [[tx + side * 3, ty + 0.4, LF], [tx + side * 1.2, ty - 4, LF], [bx + side * 1, hy - 17, CL3], [tx - side * 0.6, ty - 1, AU]]) ellipse(c, lx, ly, 1.5, 1.1, cc);
  };
  antler(hx - 3, -1, TW2); antler(hx + 3, 1, TW);
  ellipse(c, hx - 1.2, hy + 0.6, 6.8, 7.6, CL2);   // моховой капюшон обрамляет лицо
  ellipse(c, hx, hy, 5.2, 6.4, BR);
  ellipse(c, hx - 2, hy + 0.4, 3.2, 5.8, BR2);
  c.fillStyle = BR3; c.fillRect(hx - 3.6, hy - 4, 2, 0.7); c.fillRect(hx + 1.6, hy - 5, 1.8, 0.7); c.fillRect(hx - 0.6, hy + 2.6, 1.6, 0.6);   // чёрточки бересты
  // лиственные брови
  poly(c, [[hx - 5, hy - 2.6], [hx + 0.4, hy - 1.6], [hx - 1, hy - 3.6], [hx - 4.4, hy - 4]], CL3);
  poly(c, [[hx + 1.2, hy - 1.6], [hx + 6.6, hy - 3], [hx + 5.4, hy - 4.4], [hx + 2, hy - 3.6]], LF);
  // глаза светятся; злой — щурится под бровями
  if (P.eye === 2 || P.eye === 3) { naEye(c, hx + 3.4, hy - 0.4, P); naEye(c, hx - 1.4, hy - 0.4, P); }
  else {
    const eh = P.eye === 1 ? 0.8 : 1.3;
    ellipse(c, hx + 3.4, hy - 0.4, 1.7, eh, EY); ellipse(c, hx - 1.4, hy - 0.4, 1.5, eh, EY);
    c.fillStyle = '#1a2a08'; c.fillRect(hx + 3.4, hy - 0.8, 0.8, 0.9); c.fillRect(hx - 1.2, hy - 0.8, 0.8, 0.9);
  }
  // нос — шишковатый нарост
  ellipse(c, hx + 4.4, hy + 1.6, 1.5, 1.2, BR2); ellipse(c, hx + 4.8, hy + 1.2, 0.6, 0.5, BR);
  // борода-лишайник до пояса, колышется; тень с дальней стороны
  const bs = sw * 1.4, bl = P.mouth > 0.5 ? 2 : 0;
  poly(c, [[hx - 4.4, hy + 2.4], [hx + 5.6, hy + 2.4], [hx + 5 + bs, hy + 10], [hx + 3.4 + bs, hy + 18 + bl], [hx + 1 + bs * 1.3, hy + 23 + bl], [hx - 0.6 + bs, hy + 17], [hx - 3 + bs * 0.6, hy + 12]], LI);
  poly(c, [[hx - 4.4, hy + 2.4], [hx - 1, hy + 2.6], [hx + 0.4 + bs, hy + 16], [hx + 1 + bs * 1.3, hy + 23 + bl], [hx - 0.6 + bs, hy + 17], [hx - 3 + bs * 0.6, hy + 12]], LI2);
  if (P.mouth > 0.4) { c.fillStyle = '#20180e'; c.fillRect(hx + 0.4, hy + 3.6, 3.6, 1.4 * P.mouth + 0.6); }
  if (P.a > 0.6) { c.strokeStyle = 'rgba(220,255,170,0.75)'; c.lineWidth = 0.7; c.beginPath(); c.arc(hx2, hy2, 22, ang - 1.3, ang - 0.2); c.stroke(); }   // дуга замаха
  if (P.mouth > 0.7) for (const [dx, dy, cc] of [[10, -3, LF], [12, 1, AU], [11, -6, CL3], [14, -2, LF]]) { c.fillStyle = cc; c.fillRect(hx + dx, hy + dy, 1.2, 1); }   // рёв — летят листья
  if (P.up > 0.5) for (const [dx, dy] of [[-8, -58], [10, -60], [2, -64]]) { c.fillStyle = EY; c.fillRect(dx, dy, 1, 1); }       // торжество — светлячки
  c.restore();
}

// =============== Кабан-страж ===============
function drawBoar(c, P) {
  c.save();
  c.translate(P.x, P.y);
  if (P.up > 0.5) { c.translate(-10, 0); c.rotate(-0.38 * P.up); c.translate(10, 0); }   // торжество: встал на дыбы
  c.rotate(P.dead ? 0 : P.rot * 0.4);
  if (P.dead) { c.translate(0, -13); c.scale(1, -1); c.translate(0, 13); }               // лежит на боку: ноги торчат вверх
  c.scale(1, P.sq);
  const FU = naK(P, '#6a5240'), FU2 = naK(P, '#463428'), FU3 = naK(P, '#86684c'), MS = naK(P, '#5a8a38'), MS2 = naK(P, '#3e6a28'), TU = '#f2eacc';
  const sw = P.leg, dead = P.dead;
  const lunge = P.a > 0 ? P.a : 0, paw = P.a < 0 ? -P.a : 0;
  // ноги: задние и передние, фаза шага
  const leg = (x, ph, front) => {
    const lift = front && paw > 0.3 ? 5 : Math.max(0, ph) * 2.6;
    naLimb(c, x, -9, x + (front ? 1.6 : -1.2) + ph * 2.4, -0.4 - lift, 2.9, front ? FU : FU2);
    ellipse(c, x + (front ? 1.8 : -1) + ph * 2.4, -0.7 - lift, 1.9, 1.1, '#2a1c14');
  };
  leg(-9, -sw, false); leg(5, -sw, true);
  // туловище
  ellipse(c, -2, -13.4, 14.4, 8.8, FU);
  ellipse(c, -4, -9.6, 11, 5.2, FU2);
  ellipse(c, -1, -17.6, 10, 4, FU3);
  // моховая накидка с грибочками на спине
  poly(c, [[-12, -17.4], [-6, -22.6], [2, -22.8], [8, -19.6], [6, -17.4], [1, -19.2], [-4, -17.6], [-8, -19]], MS);
  c.fillStyle = MS2; c.fillRect(-9, -19.4, 3, 1.2); c.fillRect(1.4, -20.4, 3, 1.2);
  ellipse(c, -2, -23, 1.8, 1.2, '#c8483a'); c.fillStyle = '#f6ece0'; c.fillRect(-2.8, -23.4, 0.8, 0.8); c.fillRect(-1, -22.8, 0.8, 0.7);
  c.fillStyle = FU2; c.fillRect(-1.6, -22, 1.2, 1.4);
  // шерстяной гребень
  for (let k = 0; k < 5; k++) poly(c, [[-11 + k * 3.4, -21], [-9.6 + k * 3.4, -25.4 - (k % 2)], [-8 + k * 3.4, -21.4]], FU2);
  // хвост
  naLimb(c, -16, -15, -19.5, -17 - P.hurt * 2 + sw, 1, FU2); ellipse(c, -19.8, -17.4 + sw, 1, 1, FU2);
  // голова: наклоняется вниз в атаке, вверх при замахе
  const hy = -13.4 + lunge * 3 - paw * 3, hx = 13 + lunge * 5.6 - paw * 1.4;
  poly(c, [[7, -18.4], [hx + 0.5, hy - 5], [hx + 8, hy - 1], [hx + 10, hy + 2.4], [hx + 3, hy + 4.6], [6, -8]], FU);
  poly(c, [[6, -9.4], [hx + 3, hy + 4.6], [hx + 9, hy + 3], [hx + 2, hy + 6.4], [4, -6]], FU2);
  ellipse(c, hx + 9.8, hy + 1.5, 2.8, 2.2, naK(P, '#8e6a58'));
  c.fillStyle = '#1a0f0a'; c.fillRect(hx + 10.6, hy + 0.4, 1, 1.1); c.fillRect(hx + 11.8, hy + 1.2, 0.8, 1);   // ноздри
  poly(c, [[hx + 5, hy + 2.6], [hx + 10.4, hy + 3], [hx + 11, hy - 2.4], [hx + 8.4, hy + 0.6]], TU);                     // клык
  poly(c, [[hx + 3, hy + 3.2], [hx + 6.8, hy + 4.4], [hx + 6.4, hy + 1.6]], '#d8cfae');
  if (P.mouth > 0.4) { c.fillStyle = '#6a1a1a'; c.fillRect(hx + 4.6, hy + 4, 5, 1.6); }
  poly(c, [[hx - 2.4, hy - 4.8], [hx + 0.6, hy - 9.2], [hx + 3.2, hy - 5]], FU2);                                         // ухо
  naEye(c, hx + 5, hy - 1.8, P, '#f0d838', 0.9);
  if (P.eye === 1) { c.fillStyle = '#1a0f0a'; c.fillRect(hx + 4.6, hy - 2.2, 0.8, 0.8); }
  // ближняя пара ног поверх
  leg(-5, sw, false); leg(9, sw, true);
  if (lunge > 0.6) { c.strokeStyle = 'rgba(255,255,230,0.7)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(hx + 12, hy - 5); c.lineTo(hx + 17, hy - 6); c.moveTo(hx + 12, hy + 5); c.lineTo(hx + 17, hy + 6); c.stroke(); }   // скорость
  if (paw > 0.3) for (const [dx, dy] of [[20, -1], [23, 0.4], [18, 0.8]]) { c.fillStyle = '#8a7058'; c.fillRect(dx, dy - 1, 1.2, 1.2); }   // пыль из-под копыта
  if (P.b > 0.5) { c.strokeStyle = 'rgba(200,236,160,0.85)'; c.lineWidth = 0.9; c.beginPath(); c.arc(hx + 6, hy, 7, -1.2, 1.2); c.stroke(); }    // парирование: клык отводит удар
  c.restore();
}

// =============== Чумной моховик ===============
function drawSpore(c, P) {
  naShadow(c, 9);
  c.save();
  c.translate(P.x, P.y);
  c.rotate(P.rot);
  c.scale(1 / Math.sqrt(P.sq), P.sq);
  const CAP = naK(P, '#8a48b0'), CAP2 = naK(P, '#62308a'), CAP3 = naK(P, '#b676d6'), ST = naK(P, '#cfd2bc'), ST2 = naK(P, '#9ea48e'), SP = '#eee0f8';
  const sw = P.leg;
  // ножки
  naLimb(c, -2.6, -10, -3 - sw * 2.2, -0.5, 2.6, ST2); naLimb(c, 2.6, -10, 3 + sw * 2.2, -0.5, 2.6, ST);
  ellipse(c, -3.4 - sw * 2.2, -0.8, 2.6, 1.2, ST2); ellipse(c, 3.6 + sw * 2.2, -0.8, 2.8, 1.2, ST);
  // дальняя ручка
  naArm(c, -4.6, -13, 4, 4, P.up > 0.5 ? -2.8 : 0.1, 0.4, 1.8, ST2);
  // ножка-тело
  poly(c, [[-5, -9], [5, -9], [4.4, -18], [-4.4, -18]], ST);
  poly(c, [[-5, -9], [-1.6, -9], [-1.6, -18], [-4.4, -18]], ST2);
  c.fillStyle = naK(P, '#9a8e6c'); c.fillRect(-4.8, -13, 9.6, 1);                               // кольцо на ножке
  // лицо на ножке
  const fx = 1.6;
  if (P.eye < 2) { ellipse(c, fx + 1.8, -15, 1.7, 1.7, '#f4f0d8'); ellipse(c, fx - 2.4, -15, 1.7, 1.7, '#f4f0d8'); ellipse(c, fx + 2.2, -15, 0.95, 0.95, '#1a1208'); ellipse(c, fx - 2, -15, 0.95, 0.95, '#1a1208'); if (P.eye === 1) { c.strokeStyle = '#3a1a2a'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(fx - 4.4, -17.2); c.lineTo(fx - 0.6, -15.8); c.moveTo(fx + 0.4, -15.8); c.lineTo(fx + 4, -17.4); c.stroke(); } }
  else { naEye(c, fx + 1.8, -15, P, '#2a1a08', 1.1); naEye(c, fx - 2.4, -15, P, '#2a1a08', 1.1); }
  if (P.mouth > 0.4) ellipse(c, fx - 0.4, -12.8, 1.5, 1.1 * P.mouth, '#4a1a2a'); else { c.fillStyle = '#6a3a3a'; c.fillRect(fx - 1.4, -13, 2.6, 0.6); }
  // шляпка: качается; парирование — опущена как зонт; удар — бьёт вперёд
  const tilt = P.a * 0.28 - (P.b > 0.5 ? -0.25 : 0), capY = -18 + (P.b > 0.5 ? 2.6 : 0) + (P.hurt > 0.5 ? 1.6 : 0), cr = P.dead ? 0.6 : 1;
  c.save(); c.translate(0.6, capY); c.rotate(tilt);
  poly(c, [[-12, 0.8], [12.4, 0.8], [10.4, -4], [6, -8.4 * cr], [0, -9.8 * cr], [-6, -8.4 * cr], [-10.4, -4]], CAP);
  poly(c, [[-12, 0.8], [-3, 0.8], [-3.6, -9.4 * cr], [-6, -8.4 * cr], [-10.4, -4]], CAP2);
  poly(c, [[1.4, -9.4 * cr], [6, -8 * cr], [9.6, -4.2], [5.4, -6], [2, -7.4 * cr]], CAP3);
  for (const [sx, sy, r] of [[-4, -3.2, 1.6], [3.4, -5.4, 1.4], [7.4, -2, 1.2], [-8, -1.4, 1]]) ellipse(c, sx, sy * cr, r, r * 0.8, SP);
  c.fillStyle = naK(P, '#5a2a78'); for (let k = -10; k <= 10; k += 3.4) c.fillRect(k, 0.4, 1.2, 1.6);    // пластинки снизу
  c.restore();
  // ближняя ручка
  const th = P.up > 0.5 ? -2.9 : P.a > 0 ? 0.8 + P.a * 0.8 : 0.4 + P.a * 1.3;
  naArm(c, 4.6, -13, 4.2, 4, th, -0.4, 1.9, ST);
  // споры: при ударе и рёве — зелёное облачко вперёд, при торжестве — маленькие
  const puff = (P.a > 0.5 ? 1 : 0) + (P.mouth > 0.7 ? 0.7 : 0) + (P.dead && P.fade < 0.9 ? 0.5 : 0);
  if (puff > 0) for (const [dx, dy, r] of [[10, -12, 2.6], [13.4, -14.4, 2.2], [15.6, -10.6, 1.8], [12, -9, 1.5], [8.6, -15.6, 1.4]]) { c.fillStyle = `rgba(160,236,90,${Math.min(0.8, puff * 0.6)})`; c.beginPath(); c.arc(dx, dy, r * Math.min(1.2, puff), 0, 7); c.fill(); }
  if (P.dead) for (const [dx, dy] of [[-6, -9], [2, -12], [8, -8], [-2, -16]]) { c.fillStyle = 'rgba(200,255,140,0.8)'; c.fillRect(dx, dy, 1, 1); }
  c.restore();
}

const NA_DRAW = { pixie: drawFairy, fairy: drawFairy, leshy: drawLeshy, boar: drawBoar, spore: drawSpore };

// ---------- Логова ----------
// У каждого логова 3 вида: кадры 0 и 1 (живое, огоньки/дым/свет чуть иные) и 'd' — разорено (зачищено, потухло, поблекло).
const NA_LAIR = {
  pixie: { name: 'Домик фей на дереве', w: 100, h: 112, ax: 50, ay: 98 },
  fairy: { name: 'Грибное кольцо фей',  w: 92, h: 64, ax: 46, ay: 36 },
  leshy: { name: 'Дупло лешего',        w: 96, h: 92, ax: 48, ay: 78 },
  boar:  { name: 'Лёжка кабанов',       w: 96, h: 64, ax: 48, ay: 38 },
  spore: { name: 'Пятно чумных грибов', w: 88, h: 64, ax: 44, ay: 38 },
};
const NA_LAIR_VARS = ['0', '1', 'd'];
const naLairCache = new Map();

// мазок «объём»: свет сверху-слева, тень справа-снизу; pts — контур, base — цвет
function naBlob(c, pts, base, lit = 0.28, dark = -0.32) {
  poly(c, pts, base);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  c.save();
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); c.clip();
  c.fillStyle = shade(base, dark); c.beginPath(); c.ellipse(x1 + (x1 - x0) * 0.1, y1 + (y1 - y0) * 0.2, (x1 - x0) * 0.75, (y1 - y0) * 0.7, 0, 0, 7); c.fill();
  c.fillStyle = shade(base, lit); c.beginPath(); c.ellipse(x0 + (x1 - x0) * 0.2, y0 + (y1 - y0) * 0.15, (x1 - x0) * 0.4, (y1 - y0) * 0.28, -0.4, 0, 7); c.fill();
  c.restore();
}
function naPuff(c, x, y, r, col, a) { c.fillStyle = col.replace('A', a.toFixed(2)); c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
function naShroomB(c, x, y, s, cap, spot, dead) {
  const st = dead ? '#9a9480' : '#ece0c4', cp = dead ? shade(cap, -0.1) : cap;
  naBlob(c, [[x - 1.1 * s, y], [x - 0.9 * s, y - 4.6 * s], [x + 0.9 * s, y - 4.6 * s], [x + 1.2 * s, y]], st, 0.2, -0.28);
  naBlob(c, [[x - 4.2 * s, y - 3.8 * s], [x - 3.4 * s, y - 6.8 * s], [x - 0.8 * s, y - 8.6 * s], [x + 2 * s, y - 8.4 * s], [x + 4 * s, y - 6.4 * s], [x + 4.4 * s, y - 3.8 * s], [x, y - 3 * s]], cp, 0.3, -0.34);
  if (!dead) { c.fillStyle = spot; c.fillRect(x - 2.2 * s, y - 6.8 * s, 1.1 * s, 1.1 * s); c.fillRect(x + 0.8 * s, y - 7.4 * s, 1.1 * s, 1.1 * s); c.fillRect(x + 2.2 * s, y - 5.6 * s, 0.9 * s, 0.9 * s); }
}
function naSparks(c, pts, t, col) {
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const [x, y, p] of pts) { const a = 0.5 + 0.5 * Math.sin(t * 3 + p); c.fillStyle = col.replace('A', a.toFixed(2)); c.fillRect(Math.round(x - 0.7), Math.round(y - 0.7), 1.6, 1.6); }
  c.restore();
}

function naLairDraw(c, kind, v) {
  const dead = v === 'd', f = v === '1' ? 1 : 0, R = mulberry32(kind.length * 977 + 11);
  if (kind === 'pixie') {
    // домик на дереве: старый дуб, в развилке — деревянный дом с листвяной крышей, верёвочная лестница, фонарики
    c.fillStyle = '#4a4430'; c.beginPath(); c.ellipse(1, 1, 26, 6.6, 0, 0, 7); c.fill();
    const BK = dead ? '#6a5a46' : '#7a5632', LF = dead ? ['#7a7a3a', '#6a6a30', '#5a5a28'] : ['#2f7a34', '#3f9a42', '#58b552'];
    // корни и ствол
    for (const [x, d] of [[-9, -1], [9, 1]]) naBlob(c, [[x, 1], [x + d * 5, -4], [x + d * 11, 1], [x + d * 6, 3]], BK, 0.2, -0.34);
    naBlob(c, [[-10, 1], [-8, -18], [-7, -42], [-10, -56], [10, -56], [7, -42], [9, -18], [11, 1]], BK, 0.26, -0.36);
    c.strokeStyle = dead ? '#4a3c2c' : '#5a3c20'; c.lineWidth = 0.9;
    for (const [x0, y0, x1, y1] of [[-4, -4, -4.6, -40], [1, -6, 0.6, -44], [6, -4, 6.4, -38]]) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
    ellipse(c, -3, -24, 1.7, 2.4, '#3a2414');           // дупло-норка
    // задняя крона
    const cloud = (cx, cy, r, col) => { const pts = []; for (let k = 0; k < 11; k++) { const a = k / 11 * 6.283, rr = r * (0.82 + 0.18 * Math.sin(k * 2.3 + cx)); pts.push([cx + Math.cos(a) * rr * 1.25, cy + Math.sin(a) * rr * 0.86]); } naBlob(c, pts, col, 0.1, -0.28); };
    cloud(-22, -66, 14, LF[0]); cloud(22, -64, 14, LF[0]); cloud(0, -80, 16, LF[0]); cloud(-30, -52, 10, LF[0]); cloud(30, -50, 10, LF[0]);
    // платформа и домик
    naBlob(c, [[-22, -44], [22, -44], [20, -40], [-20, -40]], '#8a6238', 0.25, -0.36);
    c.strokeStyle = '#5a3c20'; c.lineWidth = 0.6; for (let x = -18; x <= 18; x += 6) { c.beginPath(); c.moveTo(x, -44); c.lineTo(x, -40.4); c.stroke(); }
    naBlob(c, [[-13, -44], [-13, -60], [13, -60], [13, -44]], dead ? '#8a6a4a' : '#b0804e', 0.22, -0.34);
    c.strokeStyle = dead ? '#5a442c' : '#7a5230'; c.lineWidth = 0.6; for (let y = -48; y > -60; y -= 4) { c.beginPath(); c.moveTo(-13, y); c.lineTo(13, y); c.stroke(); }
    // дверка-арка и круглое окошко
    naBlob(c, [[-9, -44], [-9, -53], [-7, -56], [-3, -56], [-1, -53], [-1, -44]], dead ? '#14100a' : '#6a4226', 0.2, -0.4);
    if (!dead) { c.fillStyle = '#e8c850'; c.fillRect(-2.6, -49.4, 1, 1); }
    const glow = dead ? '#2a2820' : f ? '#fff2a0' : '#ffd860';
    ellipse(c, 6, -52, 3.4, 3.4, '#5a3a20'); ellipse(c, 6, -52, 2.5, 2.5, glow);
    if (!dead) { c.strokeStyle = '#5a3a20'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(6, -54.5); c.lineTo(6, -49.5); c.moveTo(3.5, -52); c.lineTo(8.5, -52); c.stroke(); }
    // перила балкона
    c.strokeStyle = '#6a4226'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-22, -50); c.lineTo(-13, -50); c.moveTo(13, -50); c.lineTo(22, -50); c.stroke();
    for (const x of [-22, -18, -14, 14, 18, 22]) { c.beginPath(); c.moveTo(x, -44); c.lineTo(x, -50); c.stroke(); }
    // крыша из листьев
    naBlob(c, [[-18, -58], [-14, -66], [-6, -72], [6, -72], [14, -66], [18, -58], [10, -60], [0, -61], [-10, -60]], LF[1], 0.3, -0.34);
    for (let k = 0; k < 6; k++) { c.strokeStyle = LF[2]; c.lineWidth = 0.7; c.beginPath(); c.arc(-12 + k * 5, -62 - (k % 2) * 3, 2.6, 0.2, 2.9); c.stroke(); }
    // гирлянда огоньков по краю крыши
    if (!dead) for (let k = 0; k < 7; k++) { const x = -15 + k * 5, y = -59.6 + Math.abs(k - 3) * -0.4; c.fillStyle = (k + f) % 2 ? '#ffe070' : '#ff9ad8'; c.fillRect(x - 0.6, y, 1.4, 1.4); }
    // фонарики на крючках
    for (const x of [-24, 24]) { naLimb(c, x, -44, x, -40, 0.6, '#5a3c20'); ellipse(c, x, -38, 2, 2.4, dead ? '#3a3a30' : f ? '#fff2a0' : '#ffd060'); }
    // верёвочная лестница
    c.strokeStyle = '#a8905a'; c.lineWidth = 0.7; const sw = dead ? 0 : (f ? 1 : -1);
    c.beginPath(); c.moveTo(-5, -40); c.quadraticCurveTo(-5 + sw, -20, -5 + sw * 1.4, dead ? -10 : 1); c.moveTo(-1, -40); c.quadraticCurveTo(-1 + sw, -20, -1 + sw * 1.4, dead ? -10 : 1); c.stroke();
    for (let y = -36; y < (dead ? -12 : 0); y += 5) { const k = (y + 40) / 40; c.beginPath(); c.moveTo(-5 + sw * k * 0.5, y); c.lineTo(-1 + sw * k * 0.5, y); c.stroke(); }
    // передняя листва и цветы
    cloud(-18, -50, 7, LF[2]); cloud(18, -46, 6, LF[2]);
    for (const [x, y, col] of [[-15, 2, '#ff8ac8'], [-11, 4, '#ffe070'], [12, 3, '#c8a0ff'], [17, 5, '#ff8ac8'], [8, 6, '#a8e0ff']]) {
      const w = dead ? 0 : (f ? 0.8 : -0.8);
      naLimb(c, x, y, x + w, y - (dead ? 2 : 5), 0.8, dead ? '#6a6a3a' : '#3e8a30');
      ellipse(c, x + w, y - (dead ? 1.4 : 5.6), 1.7, dead ? 0.9 : 1.7, dead ? '#8a7a6a' : col); if (!dead) ellipse(c, x + w, y - 5.6, 0.6, 0.6, '#fff6b0');
    }
    // свисающие лианы с цветами
    for (const [x, l] of [[-18, 12], [-8, 8], [10, 10], [20, 13]]) { c.strokeStyle = dead ? '#5a5a30' : '#4a8a2a'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(x, -40); c.quadraticCurveTo(x + (f ? 1.6 : -1.6), -40 + l * 0.5, x + (f ? 0.8 : -0.8), -40 + l); c.stroke(); if (!dead) ellipse(c, x + (f ? 0.8 : -0.8), -40 + l, 1.3, 1.3, '#ffb0e0'); }
    // трубочка-дымок
    if (!dead) { naPuff(c, 9 + f * 1.4, -75 - f, 2, 'rgba(240,240,248,A)', 0.7); naPuff(c, 10.5 - f, -80 - f * 2, 2.6, 'rgba(240,240,248,A)', 0.45); }
    if (!dead) naSparks(c, [[-28, -60, f], [27, -66, 2 + f], [-20, -86, 4 + f * 2], [18, -88, 6 + f], [0, -96, 1 + f]], f * 1.7, 'rgba(255,240,170,A)');
    else { c.strokeStyle = 'rgba(230,230,230,0.8)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(-12, -46); c.lineTo(-3, -54); c.moveTo(-12, -54); c.lineTo(-3, -48); c.stroke(); }
  } else if (kind === 'fairy') {
    c.fillStyle = dead ? 'rgba(120,120,90,0.2)' : 'rgba(110,210,160,0.3)'; c.beginPath(); c.ellipse(0, 0, 34, 12.6, 0, 0, 7); c.fill();
    c.strokeStyle = dead ? 'rgba(160,150,120,0.5)' : (f ? 'rgba(220,255,236,0.8)' : 'rgba(190,255,220,0.6)'); c.lineWidth = 0.8; c.beginPath(); c.ellipse(0, 0, 30, 10.8, 0, 0, 7); c.stroke();
    // центр: плоский камень-алтарь с кристаллом
    naBlob(c, [[-7, 1], [-8, -4], [-4, -7], [5, -7], [9, -3], [8, 1]], dead ? '#7a7870' : '#9a9a9a', 0.28, -0.34);
    if (!dead) { poly(c, [[-2, -7], [0, -17 - f], [3, -7]], f ? '#d8f6ff' : '#a8e8ff'); poly(c, [[-1, -7], [0, -17 - f], [0.6, -7]], '#ffffff'); c.save(); c.globalCompositeOperation = 'lighter'; ellipse(c, 0.6, -11, 6 + f * 1.5, 7 + f * 1.5, 'rgba(160,240,255,0.25)'); c.restore(); }
    // кольцо из грибов и цветов
    const n = 14;
    const items = [];
    for (let k = 0; k < n; k++) { const a = k / n * 6.283 + 0.2, x = Math.cos(a) * 30, y = Math.sin(a) * 10.8; items.push([x, y, k]); }
    items.sort((a, b) => a[1] - b[1]);
    for (const [x, y, k] of items) {
      if (k % 3 === 0) naShroomB(c, x, y + 1.5, 1.35, dead ? '#9a7a6a' : '#e85a4a', '#fff0e0', dead);
      else if (k % 3 === 1) { naLimb(c, x, y + 1, x, y - 4, 0.8, dead ? '#6a6a3a' : '#3e8a30'); ellipse(c, x, y - 4.6, 1.9, 1.9, dead ? '#8a7a6a' : '#f4a8d8'); if (!dead) ellipse(c, x, y - 4.6, 0.7, 0.7, '#fff0a0'); }
      else naShroomB(c, x, y + 1.5, 0.95, dead ? '#8a7a8a' : '#e0a8f0', '#fff', dead);
    }
    if (!dead) naSparks(c, [[-22, -10, f], [18, -14, 2 + f], [-8, -18, 4], [26, -4, 1 + f * 2], [-28, -2, 3 + f], [6, -22, 5 + f], [0, -4, 7 + f]], f * 1.5, 'rgba(255,244,170,A)');
  } else if (kind === 'leshy') {
    c.fillStyle = '#4a4430'; c.beginPath(); c.ellipse(0, 1, 30, 7.4, 0, 0, 7); c.fill();
    const BK = dead ? '#6a5a46' : '#7a5632', MS = dead ? '#6a6a3a' : '#62943a';
    // корни
    for (const [x, d] of [[-22, -1], [-17, -1], [20, 1], [25, 1]]) naBlob(c, [[x, 1], [x + d * 6, -3], [x + d * 11, 1], [x + d * 7, 3]], BK, 0.2, -0.34);
    // ствол-пень
    naBlob(c, [[-20, 1], [-16, -12], [-13, -30], [-17, -48], [-9, -44], [-3, -54], [4, -46], [11, -53], [14, -44], [19, -40], [15, -28], [18, -12], [22, 1]], BK, 0.24, -0.36);
    c.strokeStyle = dead ? '#4a3c2c' : '#5a3c20'; c.lineWidth = 0.9; for (const [x0, y0, x1, y1] of [[-10, -6, -11, -38], [-4, -8, -5, -44], [8, -6, 9, -40], [14, -10, 15, -34]]) { c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2 + 1.4, (y0 + y1) / 2, x1, y1); c.stroke(); }
    // дупло — лицо
    poly(c, [[-8, 0], [-9, -10], [-6, -20], [0, -24], [6, -20], [9, -10], [8, 0]], '#120a05');
    poly(c, [[-5, -3], [-6, -10], [-3, -16], [0, -18], [3, -16], [6, -10], [5, -3]], '#1c1008');
    if (!dead) {
      const ec = f ? '#fff08a' : '#d8e84a';
      ellipse(c, -2.6, -14.4, 1.7, 1.2 - f * 0.2, ec); ellipse(c, 3, -14.4, 1.7, 1.2 - f * 0.2, ec);
      c.save(); c.globalCompositeOperation = 'lighter'; ellipse(c, 0.2, -14.4, 8, 4, 'rgba(210,235,60,' + (f ? 0.22 : 0.14) + ')'); c.restore();
      c.fillStyle = '#1a2a08'; c.fillRect(-3, -14.8, 0.8, 1.2); c.fillRect(2.6, -14.8, 0.8, 1.2);
    }
    // мох сверху, свисающие лианы
    naBlob(c, [[-19, -44], [-9, -44], [-3, -54], [4, -46], [11, -53], [15, -44], [19, -40], [8, -36], [-4, -40], [-16, -36]], MS, 0.28, -0.32);
    for (const [x, l] of [[-14, 14], [-6, 10], [6, 16], [13, 11]]) { c.strokeStyle = dead ? '#5a5a30' : '#4a7a2a'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(x, -38); c.quadraticCurveTo(x + (f ? 2 : -2), -38 + l * 0.5, x + (f ? 1 : -1), -38 + l); c.stroke(); }
    // рога-ветви
    naLimb(c, -9, -50, -16, -64, 3, dead ? '#4a3c2c' : '#5a3c20'); naLimb(c, -14, -60, -20, -62, 2, dead ? '#4a3c2c' : '#5a3c20'); naLimb(c, 11, -50, 17, -66, 3, dead ? '#4a3c2c' : '#5a3c20'); naLimb(c, 15, -60, 21, -60, 2, dead ? '#4a3c2c' : '#5a3c20');
    if (!dead) { ellipse(c, -17, -64, 2.4, 1.8, '#7ab04a'); ellipse(c, 18, -66, 2.6, 1.8, '#7ab04a'); }
    // тотем-череп на колу
    naLimb(c, 26, 1, 26, -18, 1.8, '#5a3c20'); ellipse(c, 26, -20, 3.2, 3, dead ? '#b8b09a' : '#e6dcc0'); c.fillStyle = '#1a120a'; c.fillRect(24.4, -21, 1.4, 1.6); c.fillRect(27, -21, 1.4, 1.6);
    naShroomB(c, -26, 3, 1.4, dead ? '#8a7a56' : '#c8883a', '#f6e8c0', dead); naShroomB(c, -22, 4, 0.9, dead ? '#8a7a56' : '#c8883a', '#f6e8c0', dead); naShroomB(c, 30, 4, 1.2, dead ? '#8a7a56' : '#c8883a', '#f6e8c0', dead);
    if (!dead) naSparks(c, [[-26, -30, f], [24, -34, 3 + f], [0, -30, 5]], f * 1.4, 'rgba(210,240,110,A)');
    else { naLimb(c, 14, -2, 30, 2, 2.6, '#4a3c2c'); }   // упавшая ветка
  } else if (kind === 'boar') {
    c.fillStyle = dead ? '#5a5240' : '#5a4630'; c.beginPath(); c.ellipse(0, 0, 38, 12.6, 0, 0, 7); c.fill();
    c.fillStyle = dead ? '#4a4434' : '#3e2e1c'; c.beginPath(); c.ellipse(2, 1.6, 28, 8.4, 0, 0, 7); c.fill();
    // следы копыт
    c.fillStyle = dead ? '#3a3628' : '#2e2014'; for (const [x, y] of [[-30, 6], [-26, 7.6], [30, 5], [34, 7], [-14, 10]]) { c.fillRect(x, y, 1.4, 1.8); c.fillRect(x + 2.4, y, 1.4, 1.8); }
    // шалаш из брёвен и веток
    const LG = dead ? '#6a5c48' : '#7a5a34';
    if (!dead) {
      naBlob(c, [[-18, 0], [-14, -14], [-4, -22], [8, -22], [17, -14], [20, 0]], '#6a4a2a', 0.25, -0.36);
      for (let k = 0; k < 6; k++) naLimb(c, -18 + k * 7, 1, -12 + k * 5, -22 + (k % 2) * 2, 2.6, k % 2 ? '#8a6638' : '#6a4a28');
      poly(c, [[-7, 0], [-6, -9], [0, -13], [6, -9], [7, 0]], '#0e0804');
      // дымок-пар изнутри (дыхание)
      naPuff(c, 2 + f * 3, -9 - f * 2, 2.6, 'rgba(230,230,235,A)', 0.4); naPuff(c, 5 + f * 3, -13 - f * 2, 2, 'rgba(230,230,235,A)', 0.25);
      c.fillStyle = '#f0d838'; c.fillRect(-1, -6, 1.2, 1); c.fillRect(2.6, -6, 1.2, 1);   // глаза из тьмы
    } else {
      for (let k = 0; k < 4; k++) naLimb(c, -16 + k * 9, 1, -8 + k * 8, -3 - (k % 2) * 4, 2.6, LG);
      naLimb(c, -20, -2, 6, 1, 2.4, LG); naLimb(c, 14, 0, 26, -3, 2.2, LG);
    }
    // колья с клыками и кости
    for (const [x, ang] of [[-30, -0.2], [32, 0.2]]) { naLimb(c, x, 3, x + ang * 14, -17, 1.8, '#5a3c20'); poly(c, [[x + ang * 14 - 2.4, -15], [x + ang * 14 + 0.4, -23], [x + ang * 14 + 2.4, -15]], dead ? '#bfb8a0' : '#f4ecd0'); }
    naLimb(c, 20, 5, 30, 2, 1.8, '#f0e8cc'); ellipse(c, 31, 1.4, 1.8, 1.8, '#f0e8cc'); ellipse(c, 21, 6, 1.6, 1.6, '#f0e8cc');
    ellipse(c, -34, 6, 2.6, 1.8, '#e0d8bc'); c.fillStyle = '#6a5c48'; c.fillRect(-35.6, 5.4, 1, 1);
    // сено
    c.strokeStyle = dead ? '#8a8458' : '#b8a448'; c.lineWidth = 0.8; for (const [x, y] of [[-14, 6], [-9, 8], [-4, 6.6], [20, 8], [25, 6]]) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + 4, y - 1); c.stroke(); }
    // муха
    if (!dead) naSparks(c, [[-12 + f * 3, -20, 0], [30 - f * 2, -12, 2]], f * 1.1, 'rgba(60,50,40,A)');
  } else {
    c.fillStyle = dead ? '#55554a' : '#4e3a5a'; c.beginPath(); c.ellipse(0, 1, 34, 12, 0, 0, 7); c.fill();
    c.fillStyle = dead ? '#62625a' : '#52663a'; c.beginPath(); c.ellipse(0, 1, 21, 7.6, 0, 0, 7); c.fill();
    // грибница: жилки по земле
    c.strokeStyle = dead ? 'rgba(150,150,130,0.6)' : 'rgba(200,170,230,0.7)'; c.lineWidth = 0.6;
    for (let k = 0; k < 9; k++) { const a = k * 0.7 + 0.3; c.beginPath(); c.moveTo(Math.cos(a) * 3, Math.sin(a) * 1.2); c.quadraticCurveTo(Math.cos(a + 0.4) * 16, Math.sin(a + 0.4) * 6, Math.cos(a) * 31, Math.sin(a) * 10.6); c.stroke(); }
    const set = [[-22, 3, 1.3, '#8a48b0', '#eee0f8'], [-12, -3, 1.9, '#62308a', '#d8c0ec'], [0, 4, 2.3, '#8a48b0', '#eee0f8'], [14, -1, 2.6, '#b676d6', '#fff'], [25, 4, 1.2, '#62308a', '#d8c0ec'], [-4, -5, 1.4, '#b676d6', '#fff'], [8, 7, 1.1, '#62308a', '#d8c0ec'], [-28, -1, 0.9, '#b676d6', '#fff']];
    set.sort((a, b) => a[1] - b[1]);
    for (const [x, y, s, cp, sp] of set) naShroomB(c, x, y, s * (dead ? 0.75 : (f && s > 2 ? 1.04 : 1)), dead ? '#8a8294' : cp, sp, dead);
    if (!dead) {
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 7; k++) { const a = k * 0.9 + f * 0.8, x = Math.cos(a) * (8 + k * 2.4), y = -10 - ((k * 5 + f * 6) % 22); naPuff(c, x, y, 2.2 + (k % 3) * 0.7, 'rgba(170,240,100,A)', 0.2 + 0.05 * (k % 3)); }
      c.restore();
    } else { naLimb(c, -2, -2, 8, -1, 1, '#6a6a5a'); }
  }
}

function naLairSprite(kind, v = '0') {
  const key = kind + v;
  let s = naLairCache.get(key);
  if (s) return s;
  const S = NA_LAIR[kind], [cv, c] = mkSprite(S.w, S.h, 3);
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.save(); c.translate(S.ax, S.ay);
  naLairDraw(c, kind, v);
  c.restore();
  const out = toPixelArt(cv, 3, { outline: true, outlineDark: 0.3, alphaCut: 100 });
  s = { cv: out, ax: S.ax, ay: S.ay, w: S.w, h: S.h };
  naLairCache.set(key, s);
  return s;
}
