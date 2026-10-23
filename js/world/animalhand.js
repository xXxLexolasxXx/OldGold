'use strict';
// Ручная перерисовка зверей под мелкий пиксель ×3 (animalart.js): тот же образ и размер, что у карт-строк,
// но нарисованный вектором — шерсть, щетина, перья и глаза видны втрое детальнее. Шаг — свой, по фазе кадра.
// Каждая функция получает ряды карты (только ради размера кадра), палитру и ключ кадра.

const AF_TAU = Math.PI * 2;

// ---------- Кабан (карта BOAR_A 20×10, рытьё BOAR_ROOT) ----------
afHand(/^boar/, (rows, pal, key) => {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length, root = key === 'boarR', ph = afPh(key, 8);
  const C = { n: '#5a4636', d: '#46342a', N: '#2e2420', h: '#76604c', s: '#c09484', S: '#98685c', e: '#ece6cc', k: '#14100c', z: '#1e1814' };
  const sn = ph == null ? 0 : Math.sin(ph * AF_TAU), G = h - 0.15;
  return afPaint(w, h, Object.values(C), c => {
    const legs = (far) => {
      const col = far ? C.N : C.d, s = far ? -sn : sn;
      for (const [x, k] of [[3.2, 1], [14.2, -1]]) {
        const off = s * k * 1.3, hx = x + (far ? 1.6 : 0);
        afLeg(c, hx, 6.6, G - 0.7, off, col, 1.25, 0.15);
        afL(c, hx + off - 0.3, G - 0.5, hx + off + 0.4, G - 0.5, C.z, 0.9);      // копытце
      }
    };
    legs(true);
    c.save();
    if (root) { c.translate(10, 5); c.rotate(0.06); c.translate(-10, -4.4); }
    // туловище: круп, бочка, высокий загривок
    afE(c, 3.6, 4.6, 3.3, 2.9, C.n); afE(c, 9, 4.6, 7.6, 3.1, C.n); afE(c, 12.6, 3.9, 4.4, 3.2, C.n);
    afE(c, 9.4, 6.6, 7, 1.15, C.d); afE(c, 9.6, 2.9, 5.4, 0.8, C.h, -0.04);
    // шерсть: короткие тёмные штрихи по бокам
    for (let k = 0; k < 9; k++) { const x = 2.6 + k * 1.45, y = 4.2 + (k % 3) * 0.7; afL(c, x, y, x - 0.5, y + 0.9, C.d, 0.38); }
    // щетина по хребту
    for (let x = 2.4; x < 14; x += 1.05) { const y = 2.3 - Math.sin((x - 2) / 12 * Math.PI) * 1.4; afL(c, x, y + 0.6, x - 0.35, y - 0.55, C.N, 0.55); }
    // хвостик-крючок
    afQ(c, 0.8, 3.6, -0.1, 4.4, 0.5, 5.4, C.N, 0.5);
    c.restore();
    c.save();
    if (root) { c.translate(14.5, 4.5); c.rotate(0.42); c.translate(-14.5, -3.8); }
    // голова клином, пятачок, клык, глаз, ухо
    afP(c, [[13.4, 1.9], [16.4, 2.5], [18.9, 3.6], [19.6, 4.4], [19.6, 6.2], [17.6, 7.2], [14.2, 7.3]], C.n);
    afP(c, [[15, 5.6], [19.4, 5.4], [19.4, 6.3], [17.6, 7.1], [15, 7]], C.d);
    afE(c, 19.25, 4.95, 0.62, 1.2, C.s); afE(c, 19.45, 4.6, 0.17, 0.3, C.S); afE(c, 19.45, 5.4, 0.17, 0.3, C.S);
    afQ(c, 17.6, 6.7, 18.5, 6.4, 18.6, 5.0, C.e, 0.6);
    afE(c, 16.2, 3.55, 0.45, 0.45, C.k);
    afP(c, [[14.5, 2.4], [15.2, 0.3], [16.3, 2.5]], C.d); afL(c, 15.1, 1, 15.5, 2.2, C.N, 0.35);
    c.restore();
    legs(false);
  });
});

// ---------- Медведь (BEAR_A 24×13, ест мёд BEAR_EAT) ----------
afHand(/^bear/, (rows, pal, key) => {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length, eat = key === 'bearE', ph = afPh(key, 8);
  const C = { q: '#6a4428', Q: '#3e2616', d: '#54341e', h: '#86583a', m: '#b8946a', M: '#8e6c4a', z: '#14100c', k: '#120c08', y: '#e0b438', Y: '#a8802c' };
  const sn = ph == null ? 0 : Math.sin(ph * AF_TAU), G = h - 0.15;
  return afPaint(w, h, Object.values(C), c => {
    const legs = far => {
      const col = far ? C.Q : C.q, s = far ? -sn : sn;
      for (const [x, k] of [[4.6, 1], [18.2, -1]]) {
        const off = s * k * 1.2, hx = x + (far ? 4.8 : 0) * (k > 0 ? 1 : -0.62);
        afLeg(c, hx, 8, G - 0.9, off, col, 2.6, 0.1);
        afE(c, hx + off + 0.4, G - 0.6, 1.5, 0.6, far ? C.Q : C.d);        // лапа
      }
    };
    legs(true);
    // туловище: круп, бочка, горб на загривке
    afE(c, 5, 5.8, 3.6, 3.8, C.q); afE(c, 11, 6, 8.2, 3.9, C.q); afE(c, 14.6, 4.2, 4.6, 3.6, C.q);
    afE(c, 11, 8.9, 7, 0.9, C.d); afE(c, 12.4, 2.6, 4.6, 0.9, C.h, -0.08);
    // мех: клоки по краю и штрихи
    for (let k = 0; k < 13; k++) { const x = 3 + k * 1.3, y = 4.4 + (k % 3) * 1.1; afQ(c, x, y, x - 0.7, y + 0.7, x - 0.4, y + 1.4, C.d, 0.42); }
    for (let k = 0; k < 6; k++) { const x = 9 + k * 1.4; afL(c, x, 2.6 + Math.abs(k - 2.5) * 0.2, x - 0.5, 3.6, C.h, 0.35); }
    afE(c, 1.6, 5.4, 0.9, 0.8, C.d);                                        // хвостик
    // голова: лоб, уши, морда светлая
    c.save(); if (eat) { c.translate(20, 5); c.rotate(0.18); c.translate(-20, -4.6); }
    afE(c, 20.4, 4.6, 3.3, 2.9, C.q); afE(c, 18.9, 1.9, 1.05, 1, C.q); afE(c, 18.95, 2.05, 0.5, 0.45, C.Q); afE(c, 22.4, 1.8, 0.95, 0.95, C.q); afE(c, 22.4, 1.95, 0.45, 0.42, C.Q);
    afE(c, 22.6, 5.9, 1.65, 1.25, C.m); afE(c, 22.4, 6.7, 1.3, 0.45, C.M);
    afE(c, 23.55, 5.2, 0.58, 0.48, C.z); afL(c, 23.3, 5.9, 23.2, 6.7, C.Q, 0.32);
    afE(c, 20.9, 3.9, 0.42, 0.42, C.k);
    afL(c, 19.6, 3.4, 20.6, 3.2, C.d, 0.35);                                 // бровь
    if (eat) { afE(c, 23.3, 7.6, 0.75, 0.6, C.y); afE(c, 23.5, 8.5, 0.32, 0.55, C.y); afE(c, 23.1, 7.4, 0.3, 0.2, C.Y); }
    c.restore();
    legs(false);
  });
});

// ---------- Коты (CAT_SIT 11×11, CAT_WALK_A 14×9, CAT_SLEEP 11×5), окрас — палитра CAT_VARS ----------
afHand(/^cat\d/, (rows, pal, key) => {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length, P = pal;
  const C = [P.a, P.b, P.c, P.x, P.e, P.p, '#101014'];
  const ear = (c, x0, x1, xt, yt, yb) => { afP(c, [[x0, yb], [xt, yt], [x1, yb]], P.a); afP(c, [[x0 + 0.35, yb], [xt, yt + 0.6], [x1 - 0.35, yb]], P.p); };
  const eyes = (c, xs, y) => { for (const x of xs) { afE(c, x, y, 0.48, 0.52, P.e); afE(c, x + 0.08, y, 0.14, 0.42, '#101014'); } };
  if (/s$/.test(key)) return afPaint(w, h, C, c => {                     // спит калачиком
    afE(c, 5, 3, 4.7, 1.9, P.a); afE(c, 4.6, 4.2, 4, 0.7, P.b);
    afQ(c, 0.6, 3.6, 2, 4.9, 6.6, 4.6, P.b, 1);                            // хвост вокруг лап
    for (const x of [3, 5.4]) afQ(c, x, 1.4, x + 0.4, 2.4, x + 0.1, 3.2, P.x, 0.5);
    afE(c, 8.6, 3, 1.9, 1.6, P.a); ear(c, 7.6, 8.8, 8, 0.4, 2); ear(c, 9.2, 10.3, 10, 0.6, 2.2);
    afQ(c, 8.6, 3.1, 9.1, 3.5, 9.6, 3.1, '#101014', 0.3);                  // закрытый глаз
    afE(c, 10.3, 3.6, 0.3, 0.25, P.p); afE(c, 9.6, 3.9, 0.9, 0.45, P.c);
  });
  if (/i$/.test(key)) return afPaint(w, h, C, c => {                     // сидит
    afQ(c, 3.8, 10.5, 0.4, 10.6, 0.8, 8.2, P.a, 1.2); afL(c, 0.8, 8.4, 0.9, 7.6, P.b, 1);
    afE(c, 5.2, 8.3, 4.2, 2.6, P.a); afE(c, 7.6, 6.4, 2, 3, P.a); afE(c, 8.4, 6.8, 0.9, 2.3, P.c);
    for (const [x, y] of [[3.6, 7.2], [4.8, 6.6], [3, 8.6]]) afQ(c, x, y, x + 0.6, y + 0.4, x + 0.5, y + 1.3, P.x, 0.5);
    afL(c, 7.3, 8, 7.2, 10.5, P.a, 1.1); afL(c, 8.9, 8, 9, 10.5, P.a, 1.1); afE(c, 7.3, 10.5, 0.7, 0.4, P.c); afE(c, 9.1, 10.5, 0.7, 0.4, P.c);
    afE(c, 8.4, 2.9, 2.5, 2.1, P.a); ear(c, 6.2, 7.6, 6.7, 0.1, 2); ear(c, 9.2, 10.6, 10.2, 0.1, 2);
    afE(c, 8.5, 4.1, 1.3, 0.75, P.c); eyes(c, [7.4, 9.4], 2.9);
    afE(c, 8.45, 3.75, 0.32, 0.24, P.p); afQ(c, 7.9, 4.35, 8.45, 4.7, 9, 4.35, P.b, 0.25);
  });
  const ph = afPh(key, 6), sn = ph == null ? 0 : Math.sin(ph * AF_TAU), G = h - 0.15;   // идёт
  return afPaint(w, h, C, c => {
    const legs = far => { const s = far ? -sn : sn; for (const [x, k] of [[3, 1], [11.6, -1]]) { const off = s * k * 1.2, hx = x + (far ? 1.2 : 0); afLeg(c, hx, 5.6, G - 0.4, off, far ? P.b : P.a, 0.95, 0.1); afE(c, hx + off + 0.2, G - 0.35, 0.55, 0.35, far ? P.b : P.c); } };
    legs(true);
    afQ(c, 2.2, 5, 0.4, 4.4, 1, 1.6, P.a, 1); afL(c, 1, 2, 1.1, 1.2, P.b, 0.9);   // хвост трубой
    afE(c, 7.2, 5.4, 5.6, 1.7, P.a); afE(c, 9.4, 6.2, 2.4, 0.8, P.c);
    for (const x of [5.3, 7.6, 9.6]) afQ(c, x, 3.9, x + 0.4, 4.8, x + 0.1, 5.6, P.x, 0.5);
    afE(c, 11.4, 2.5, 2.3, 1.9, P.a); ear(c, 9.4, 10.7, 9.9, 0.05, 1.6); ear(c, 11.9, 13.3, 12.9, 0.05, 1.6);
    afE(c, 12, 3.5, 1.2, 0.7, P.c); eyes(c, [10.6, 12.4], 2.4);
    afE(c, 13.1, 3.1, 0.3, 0.24, P.p);
    legs(false);
  });
});

// ---------- Аист (STORK_S 16×19; на гнезде — первые 13 рядов) ----------
afHand(/^stork[SN]$/, (rows, pal, key) => {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length, nest = key === 'storkN';
  const C = { w: '#f4f2ea', W: '#d4d0c2', g: '#b4b0a4', k: '#1c1a20', K: '#3a3640', r: '#d03a2c', R: '#a82820', e: '#120e10' };
  return afPaint(w, h, Object.values(C), c => {
    if (!nest) for (const x of [5.6, 8.4]) { afL(c, x, 12, x, 18.2, C.R, 0.8); afL(c, x - 0.8, 18.5, x + 0.8, 18.5, C.R, 0.6); afE(c, x, 15.2, 0.45, 0.35, C.r); }
    afE(c, 7.2, 9.4, 5.2, 2.8, C.w, -0.18); afE(c, 7.4, 10.9, 4.2, 1.2, C.W, -0.12);
    // крыло: белые кроющие и чёрные маховые к хвосту
    afP(c, [[0.2, 8.4], [3.4, 7.4], [6.6, 8.2], [5.8, 10.6], [2.2, 10.9]], C.k);
    for (let k = 0; k < 4; k++) afL(c, 1 + k * 1.2, 8.3 + k * 0.1, 0.6 + k * 1.3, 10.4, C.K, 0.35);
    afQ(c, 4, 7.6, 7, 7, 10, 8.2, C.W, 0.4);
    // шея изгибом и голова
    afQ(c, 9.6, 8, 8.2, 5, 8.7, 2.4, C.w, 1.7);
    afE(c, 8.8, 1.6, 1.6, 1.25, C.w);
    afP(c, [[9.9, 1.05], [15.8, 1.45], [9.9, 2.35]], C.r); afL(c, 10.4, 1.95, 15.2, 1.6, C.R, 0.3);
    afE(c, 9.35, 1.3, 0.36, 0.36, C.e);
    afQ(c, 8.2, 3.4, 8.3, 5, 9, 6.4, C.W, 0.35);
  });
});

// ---------- Цапля (HERON_S 12×19, удар HERON_STRIKE) ----------
afHand(/^heron[SK]$/, (rows, pal, key) => {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length, strike = key === 'heronK';
  const C = { h: '#8a98a8', H: '#5a6878', d: '#6e7c8c', w: '#d8e0e8', k: '#1c1a20', y: '#e0b438', Y: '#b08a2c', s: '#3a4452' };
  return afPaint(w, h, Object.values(C), c => {
    for (const x of [5.5, 7.5]) { afL(c, x, 11.5, x, 18.3, C.Y, 0.72); afL(c, x - 0.8, 18.5, x + 0.7, 18.5, C.Y, 0.55); }
    afE(c, 6, 9.4, 3.9, 2.5, C.h, strike ? 0.25 : -0.1); afE(c, 5.4, 10.6, 3, 1, C.H);
    afQ(c, 3, 8.4, 4.6, 10.6, 7.6, 11.2, C.d, 0.4); afQ(c, 2.6, 10, 3.4, 11.4, 5, 12, C.s, 0.5);   // перо крыла
    if (strike) {                                                          // шея броском вперёд-вниз, клюв в воду
      afQ(c, 6.6, 7.6, 8.6, 7.6, 9.6, 8.4, C.w, 1.15);
      afE(c, 10, 8.6, 0.95, 0.85, C.h); afE(c, 10.2, 8.3, 0.3, 0.28, C.k);
      afP(c, [[10.4, 9], [11.6, 12.8], [10.9, 9.1]], C.y);
      afL(c, 9.2, 8, 8, 7.4, C.s, 0.35);
    } else {
      afQ(c, 6.6, 7.8, 4.6, 5.4, 5.6, 2.6, C.w, 1.2);
      for (let k = 0; k < 3; k++) afL(c, 5.2 + k * 0.1, 3.6 + k * 1.2, 5.5 + k * 0.1, 4.1 + k * 1.2, C.s, 0.3);   // тёмные крапины по шее
      afE(c, 5.6, 1.6, 1.4, 1.05, C.h); afE(c, 5.9, 2.1, 0.9, 0.5, C.w);
      afQ(c, 4.6, 1, 3.4, 0.6, 2.6, 1.6, C.s, 0.4);                          // хохолок
      afP(c, [[6.6, 1.2], [11.8, 1.6], [6.6, 2.2]], C.y); afL(c, 7.2, 1.9, 11.2, 1.7, C.Y, 0.25);
      afE(c, 6.2, 1.3, 0.3, 0.3, C.k);
    }
  });
});

// ---------- Ворона стоя и в шаге (CROW_STAND + ноги, 18×13) ----------
afHand(/^crow:[sw]/, (rows, pal, key) => {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length, kind = key.split(':')[1], G = h - 0.15;
  const C = { k: '#26262f', K: '#34343f', h: '#4a4a62', m: '#181820', b: '#cfae58', B: '#8a7030', e: '#e8e2c4', l: '#7a6444', L: '#5a4a32' };
  const ph = kind[0] === 'w' ? (+kind.slice(1) % 6) / 6 : null, sn = ph == null ? 0 : Math.sin(ph * AF_TAU);
  const pose = kind[0] === 's' ? +kind[1] : 0;
  return afPaint(w, h, Object.values(C), c => {
    const leg = (x, off, far) => { afL(c, x, 9.6, x + off, G - 0.3, far ? C.L : C.l, 0.5); afL(c, x + off - 0.5, G - 0.2, x + off + 0.7, G - 0.2, far ? C.L : C.l, 0.4); };
    const sp = pose === 1 ? 1.6 : pose === 2 ? -0.6 : 0;
    leg(9.6, -sn * 1.1 - sp * 0.4, true);
    afP(c, [[0, 7.4], [3.6, 6.2], [6.8, 7.6], [5.8, 9.6], [0.6, 8.8]], C.k);          // хвост
    afE(c, 8.4, 7.2, 5, 3, C.k, -0.22); afE(c, 8.6, 9.2, 3.6, 1, C.m);
    afP(c, [[4.4, 5.4], [8.8, 4.6], [11.6, 6.6], [9.4, 8.8], [4.2, 8.4]], C.K);       // крыло
    for (let k = 0; k < 3; k++) afQ(c, 5 + k * 1.6, 5.4 + k * 0.1, 6.4 + k * 1.4, 7.4, 5.6 + k * 1.5, 8.6, C.h, 0.32);
    afE(c, 11.4, 2.9, 2.5, 2.2, C.k); afE(c, 11.8, 4.8, 1.6, 1.3, C.k);                 // голова и зоб
    afP(c, [[13.4, 2.4], [17.4, 3.4], [13.4, 4.2]], C.b); afL(c, 13.6, 3.6, 16.8, 3.5, C.B, 0.35);
    afE(c, 12, 2.4, 0.5, 0.5, C.e); afE(c, 12.15, 2.45, 0.22, 0.22, C.m);
    leg(10.6, sn * 1.1 + sp, false);
  });
});

// ---------- Мшистый олень (WL stag 24×17): мох на спине, рога в цветах; пасётся — голова к траве ----------
afHand(/^wl:stag:/, (rows, pal, key) => {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length, P = pal, fr = key.split(':')[2];
  const ph = fr[0] === 'w' ? (+fr.slice(1) % 8) / 8 : null, sn = ph == null ? 0 : Math.sin(ph * AF_TAU), G = h - 0.15;
  const graze = fr[0] === 'i' && +fr.slice(1) >= 2 && +fr.slice(1) <= 4, dip = graze ? (fr === 'i3' ? 6 : 5) : 0;
  const S2 = '#6e5434';
  return afPaint(w, h, [P.a, P.p, P.P, P.m, P.M, P.s, P.S, P.k, P.n, P.d, S2], c => {
    const legs = far => { const s = far ? -sn : sn; for (const [x, k] of [[3.6, 1], [11, -1]]) { const off = s * k * 1.5, hx = x + (far ? 1.3 : 0); afLeg(c, hx, 12.6, G - 0.8, off, far ? S2 : P.s, 1.05, 0.25); afL(c, hx + off - 0.2, G - 0.5, hx + off + 0.4, G - 0.5, P.d, 0.9); } };
    legs(true);
    afE(c, 7.4, 11.6, 6.6, 2.4, P.s); afE(c, 7.2, 12.9, 5.2, 0.9, P.S);
    for (let k = 0; k < 8; k++) afE(c, 2.6 + k * 1.25, 9.9 + Math.sin(k * 1.7) * 0.25, 1, 0.7, k & 1 ? P.M : P.m);   // мох
    for (let k = 0; k < 5; k++) afL(c, 3 + k * 2, 10.6, 3.2 + k * 2, 11.3, P.m, 0.4);                                // свисающие пряди
    afL(c, 1, 10.6, 0.4, 12, P.S, 0.8);                                                                             // хвостик
    c.save(); c.translate(0, dip);
    afQ(c, 11.6, 11 - dip, 13.2, 8.8 - dip * 0.5, 14, 6.6, P.s, 2.2);                                                // шея
    afE(c, 14.6, 5.9, 2.2, 1.55, P.s, 0.15); afE(c, 16.6, 6.5, 1.1, 0.8, P.s); afE(c, 17.3, 6.4, 0.42, 0.36, P.n);
    afE(c, 14.6, 5.7, 0.4, 0.4, P.k); afP(c, [[12.8, 4.8], [12.1, 3.6], [13.6, 4.4]], P.S);
    // рога веточками и цветы на них
    afQ(c, 13.6, 4.4, 13, 2.2, 13.6, 0.5, P.a, 0.9); afQ(c, 13.3, 2.6, 12.2, 2, 12, 0.8, P.a, 0.75); afL(c, 13.4, 1.6, 14.4, 1, P.a, 0.65);
    afQ(c, 15, 4.3, 16, 2.4, 17, 0.6, P.a, 0.9); afQ(c, 15.8, 2.6, 17, 2.4, 17.8, 1.6, P.a, 0.75); afL(c, 16.4, 1.6, 15.8, 0.6, P.a, 0.65);
    afE(c, 12.1, 1.1, 0.5, 0.45, P.p); afE(c, 17.6, 1.6, 0.55, 0.5, P.P); afE(c, 16.9, 0.7, 0.35, 0.32, P.p);
    c.restore();
    legs(false);
  });
});

// ---------- Звёздный лис (WL starfox 16×9): синий, с искрами на хвосте ----------
afHand(/^wl:starfox:/, (rows, pal, key) => {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length, P = pal, fr = key.split(':')[2];
  const ph = fr[0] === 'w' ? (+fr.slice(1) % 8) / 8 : null, sn = ph == null ? 0 : Math.sin(ph * AF_TAU), G = h - 0.15;
  const tw = fr[0] === 'i' ? +fr.slice(1) % 3 : 0, low = fr === 'r1' || fr === 'r2' ? 0.6 : 0;
  const ST = P['*'], ST2 = P['+'];
  return afPaint(w, h, [P.x, P.X, P.K, P.k, P.n, ST, ST2], c => {
    const legs = far => { const s = far ? -sn : sn; for (const [x, k] of [[4.4, 1], [10.4, -1]]) { const off = s * k * 1.1, hx = x + (far ? 1.1 : 0); afLeg(c, hx, 6, G - 0.2, off, far ? P.K : P.x, 0.85, 0.1); } };
    legs(true);
    afQ(c, 4, 5.4, 1.4, 4.2, 0.6, 6.4, P.x, 1.8); afE(c, 0.8, 6.2, 0.8, 0.7, P.X);                                   // хвост
    afE(c, 7.6, 5.4, 4.3, 1.5, P.x); afE(c, 8.4, 6.2, 3, 0.6, P.X);
    afE(c, 12.6, 2.8 + low, 1.9, 1.35, P.x); afP(c, [[13.2, 2.4 + low], [15.8, 2.6 + low], [13.4, 3.8 + low]], P.x); afE(c, 13, 3.6 + low, 1.1, 0.5, P.X);
    afP(c, [[11.5, 2 + low], [11.9, 0.1 + low * 1.6], [12.9, 1.7 + low]], P.K); afP(c, [[12.8, 1.8 + low], [13.4, 0.1 + low * 1.6], [14, 1.8 + low]], P.K);
    afE(c, 15.7, 2.65 + low, 0.32, 0.3, P.n); afE(c, 13.4, 2.3 + low, 0.36, 0.33, P.k);
    [[0.6, 4.6], [1.8, 5.6], [0.4, 7.2], [2.6, 4.4]].forEach(([x, y], i) => { const big = (i + tw) % 3 === 0; afE(c, x, y, big ? 0.42 : 0.26, big ? 0.42 : 0.26, big ? ST2 : ST); });
    legs(false);
  });
});

// ---------- Заяц (WL hare 13×10, столбиком hareUp; зимой белый — палитра hareW) ----------
afHand(/^wl:hareW?:/, (rows, pal, key) => {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length, P = pal, fr = key.split(':')[2], G = h - 0.15;
  const C = [P.h, P.H, P.e, P.k, P.n, P.w, P.d];
  if (fr.startsWith('up')) {
    const back = +fr.slice(2) % 2;                                                   // привстал; уши то торчком, то прижаты
    return afPaint(w, h, C, c => {
      afE(c, 6.6, 7.6, 2.6, 2.2, P.h); afE(c, 6.8, 5.4, 1.7, 2, P.h); afE(c, 7.2, 6.8, 0.9, 1.6, P.H);
      afE(c, 4, 8.4, 0.75, 0.7, P.w); afE(c, 6.2, G - 0.5, 1.4, 0.55, P.d); afE(c, 8, G - 0.5, 1.1, 0.5, P.d);
      afE(c, 8, 3.1, 1.6, 1.25, P.h); afE(c, 9.4, 3.4, 0.33, 0.28, P.n); afE(c, 8.4, 2.8, 0.34, 0.34, P.k);
      if (back) afE(c, 6.2, 1.9, 0.5, 1.6, P.h, 1.1);
      else { afE(c, 7.4, 1.4, 0.45, 1.3, P.h, -0.1); afE(c, 8.3, 1.3, 0.45, 1.3, P.h, 0.15); afE(c, 8.25, 1.4, 0.18, 0.9, P.e, 0.15); }
    });
  }
  const ph = fr[0] === 'w' ? (+fr.slice(1) % 6) / 6 : null, hop = ph == null ? 0 : Math.sin(ph * Math.PI);
  const ear = fr === 'i2' || fr === 'i3' ? 1 : 0, nose = fr === 'i5' ? 0.3 : 0;
  return afPaint(w, h, C, c => {
    c.save(); c.translate(0, -hop * 0.4);
    afE(c, 5, 6.4, 4.3, 2.2, P.h); afE(c, 4.6, 7.4, 3.2, 1, P.H);
    afE(c, 2.4, 7.7, 1.8, 1.1, P.h); afE(c, 0.8, 6.4, 0.75, 0.7, P.w);             // задняя лапа, хвостик
    afE(c, 9.8, 3.8, 2, 1.5, P.h); afE(c, 11.8, 3.4 + nose, 0.34, 0.3, P.n); afE(c, 10.4, 3.2, 0.36, 0.36, P.k);
    afE(c, 9.4 - ear * 0.6, 1.3 + ear * 0.7, 0.45, 1.5, P.h, -0.2 - ear * 0.9); afE(c, 10.2, 1.2 + ear * 0.4, 0.45, 1.5, P.h, 0.1 - ear * 0.6); afE(c, 10.15, 1.4 + ear * 0.4, 0.17, 1, P.e, 0.1 - ear * 0.6);
    c.restore();
    const s = ph == null ? 0 : Math.cos(ph * AF_TAU);
    afL(c, 2.6 - s, 8.4, 2.4 - s * 1.6, G - 0.4, P.h, 0.9); afL(c, 7.6 + s, 7.6, 7.8 + s * 1.6, G - 0.4, P.h, 0.8);
    afE(c, 2.4 - s * 1.6, G - 0.4, 0.8, 0.4, P.d); afE(c, 8 + s * 1.6, G - 0.4, 0.6, 0.4, P.d);
  });
});

// ---------- Фазан (WL pheasant 16×10): медная грудь, зелёная шея, белый ошейник, длинный хвост ----------
afHand(/^wl:pheasant:/, (rows, pal, key) => {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length, P = pal, fr = key.split(':')[2], G = h - 0.15;
  const ph = fr[0] === 'w' ? (+fr.slice(1) % 6) / 6 : null, sn = ph == null ? 0 : Math.sin(ph * AF_TAU);
  const peck = fr === 'i2' || fr === 'i3' ? 2 : 0, wing = fr[0] === 'r' ? +fr.slice(1) : -1, T2 = '#4a2a14';
  return afPaint(w, h, [P.k, P.g, P.r, P.o, P.c, P.b, P.B, P.t, P.l, P.y, T2], c => {
    for (const [x, s] of [[5.6, sn], [8.2, -sn]]) { afL(c, x, 7.4, x + s, G - 0.2, P.l, 0.5); afL(c, x + s - 0.5, G - 0.15, x + s + 0.6, G - 0.15, P.l, 0.35); }
    afQ(c, 4, 5.4, 1.6, 4.4, 0, 4.4, P.t, 1); afQ(c, 4.2, 5.8, 2, 5.4, 0.4, 5.6, P.t, 0.6);        // хвост
    for (let k = 0; k < 4; k++) afL(c, 0.6 + k * 0.9, 4.3 + k * 0.12, 0.9 + k * 0.9, 4.9 + k * 0.1, T2, 0.25);
    afE(c, 7.4, 5.8, 3.6, 1.9, P.b); afE(c, 7.8, 6.6, 2.6, 0.9, P.B);
    for (let k = 0; k < 4; k++) afE(c, 5.8 + k * 0.9, 5.4 + (k & 1) * 0.6, 0.22, 0.2, P.t);
    if (wing >= 0) { const sp = 2 + wing; afP(c, [[6, 4.8], [8, 4.4 - sp * 0.4], [9.6 + sp * 0.4, 4.2 - sp * 0.6], [9, 5.6]], P.B); }
    c.save(); c.translate(peck * 0.6, peck);
    afQ(c, 9.4, 5, 10.6, 3.6, 10.4, 2, P.g, 1.4); afE(c, 9.8, 4.4, 0.9, 0.45, P.c, -0.4);            // шея и ошейник
    afE(c, 10.6, 1.4, 1.05, 0.95, P.k); afE(c, 11.4, 1.3, 0.7, 0.55, P.r); afP(c, [[11.5, 1.6], [12.8, 1.9], [11.5, 2.2]], P.o);
    afE(c, 10.4, 0.5, 0.4, 0.3, P.k); afE(c, 11.2, 1.2, 0.2, 0.2, P.y);
    c.restore();
  });
});

// ---------- Барсук (BADGER_A 21×9, роет BADGER_DIG) ----------
afHand(/^badger/, (rows, pal, key) => {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length, P = pal, dig = key === 'badgerD', ph = afPh(key, 6);
  const sn = ph == null ? 0 : Math.sin(ph * AF_TAU), G = h - 0.15, D = '#6e6e78', L = '#3a3a44', E = '#6a4a2a';
  return afPaint(w, h, [P.b, P.B, P.W, P.n, D, L, E, '#101014'], c => {
    const legs = far => { const s = far ? -sn : sn; for (const [x, k] of [[2.8, 1], [13, -1]]) { const off = s * k * 0.9, hx = x + (far ? 1.4 : 0); afLeg(c, hx, h - 3.2, G - 0.3, off, far ? P.n : L, 1.5, 0.1); } };
    legs(true);
    c.save(); c.translate(0, h - 9); if (dig) { c.translate(10, 5); c.rotate(0.14); c.translate(-10, -4); }
    afE(c, 8.4, 4.6, 8, 2.4, P.b); afE(c, 8.6, 6.1, 7.2, 0.9, P.B);
    for (let k = 0; k < 10; k++) afL(c, 1.4 + k * 1.4, 3.1 + (k % 2) * 0.4, 1 + k * 1.4, 4.4, D, 0.35);   // жёсткая шерсть
    afE(c, 0.8, 4.4, 0.8, 0.6, P.B);
    // голова: белая с чёрными полосами через глаз
    afP(c, [[13.2, 2.6], [16.4, 2.2], [19, 3.4], [20.8, 4.6], [19.6, 5.6], [15.4, 6.4], [13.4, 5.8]], P.W);
    afQ(c, 14.2, 2.5, 17.4, 2.8, 20.2, 4.5, P.n, 0.9); afQ(c, 14.2, 5.4, 17, 4.6, 19.6, 5.3, P.n, 0.6);
    afE(c, 16.4, 3.4, 0.38, 0.36, '#101014'); afE(c, 20.6, 4.6, 0.42, 0.38, P.n);
    afE(c, 14.6, 1.8, 0.7, 0.55, P.W);
    c.restore();
    if (dig) { afL(c, 17, h - 3.2, 18.4, G - 0.3, L, 1); for (let k = 0; k < 3; k++) afE(c, 19 + k * 0.6, G - 0.4 - k * 0.5, 0.35, 0.3, E); }
    legs(false);
  });
});

// ---------- Белка (SQ_SIT 13×8, прыжок SQ_RUN/SQ_RUN2 13×7) ----------
afHand(/^sq/, (rows, pal, key) => {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length, P = pal, G = h - 0.15, K = '#14100c', N = '#e8b48a';
  const C = [P.o, P.O, P.c, P.t, K, N];
  if (key === 'sqS') return afPaint(w, h, C, c => {
    afQ(c, 4.4, 6.6, 0.2, 6, 1.6, 0.8, P.O, 2.4); afQ(c, 4.2, 6.4, 0.9, 5.6, 1.9, 1.4, P.o, 1.2);   // пышный хвост
    for (let k = 0; k < 4; k++) afL(c, 0.8 + k * 0.4, 2 + k * 1.1, 1.6 + k * 0.4, 2.4 + k * 1.1, P.t, 0.3);
    afE(c, 6.6, 5, 2.6, 2.4, P.o); afE(c, 7.8, 5.2, 1.3, 1.8, P.c);
    afE(c, 10.4, 2.8, 1.9, 1.5, P.o); afP(c, [[9.2, 1.8], [9.6, 0.2], [10.4, 1.5]], P.o); afP(c, [[10.6, 1.4], [11.3, 0.1], [11.6, 1.6]], P.o);
    afE(c, 11, 2.4, 0.36, 0.36, K); afE(c, 12.2, 3, 0.3, 0.26, K); afE(c, 11, 3.6, 1, 0.5, P.c);
    afE(c, 9.6, 5.6, 0.7, 0.5, P.t); afE(c, 8.6, 6.2, 0.6, 0.35, P.o);                                  // лапки с орешком
    afE(c, 5.6, G - 0.4, 1.2, 0.4, P.O); afE(c, 8, G - 0.4, 1, 0.4, P.O);
  });
  const ph = afPh(key, 6), stretch = ph == null || ph < 0.5 ? 1 : -1;
  return afPaint(w, h, C, c => {
    afQ(c, 3.6, 3.6, 0.6, 3.8, 1.8, 0.8, P.O, 2.2); afQ(c, 3.4, 3.4, 1.1, 3.4, 2, 1.2, P.o, 1);
    afE(c, 6.6, 3.8, 3.6, 1.6, P.o); afE(c, 7.6, 4.6, 2.2, 0.6, P.c);
    afE(c, 10.6, 2.8, 1.7, 1.3, P.o); afP(c, [[9.8, 1.9], [10.2, 0.6], [10.9, 1.7]], P.o); afP(c, [[11, 1.7], [11.6, 0.6], [11.9, 1.9]], P.o);
    afE(c, 11.2, 2.6, 0.34, 0.34, K); afE(c, 12.3, 3.1, 0.3, 0.26, N);
    afL(c, 4.6, 4.8, 3.6 - stretch * 0.8, G - 0.3, P.O, 0.9); afL(c, 8.4, 4.8, 9.2 + stretch * 0.8, G - 0.3, P.O, 0.7);
  });
});

// ---------- Ёж (HEDGE 13×8, клубком HEDGE_BALL 13×7) ----------
afHand(/^hg/, (rows, pal, key) => {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length, P = pal, ball = key === 'hgBall', G = h - 0.15, ph = afPh(key, 4), K = '#14100c', NS = P.p || P.P;
  return afPaint(w, h, [P.q, P.Q, P.x, P.f, K, NS], c => {
    if (ball) {
      afE(c, 6.5, 3.6, 6, 3.2, P.q);
      for (let a = 0; a < 30; a++) { const t = a / 30 * AF_TAU, r = 1 + (a % 3) * 1.4, x = 6.5 + Math.cos(t) * r * 1.5, y = 3.6 + Math.sin(t) * r * 0.82; afL(c, x, y, x + Math.cos(t) * 0.9, y + Math.sin(t) * 0.55, P.Q, 0.42); afL(c, x + Math.cos(t) * 0.8, y + Math.sin(t) * 0.5, x + Math.cos(t) * 1.3, y + Math.sin(t) * 0.8, P.x, 0.42); }
      return;
    }
    const s = ph == null ? 0 : Math.sin(ph * AF_TAU);
    for (const [x, o] of [[3.6, s], [8.6, -s]]) afL(c, x, 6, x + o * 0.6, G - 0.2, P.f, 0.75);
    afE(c, 6, 4, 5.6, 3, P.q);
    for (let k = 0; k < 34; k++) {                                                     // иголки назад и вверх: тёмные с светлыми кончиками
      const t = Math.PI * (0.95 + (k / 34) * 1.05), r = 1.4 + (k % 3) * 1.2, x = 6 + Math.cos(t) * r * 1.5, y = 4.4 + Math.sin(t) * r * 0.85;
      afL(c, x, y, x - 0.9, y - 0.6 + (k % 2) * 0.4, P.Q, 0.42); afL(c, x - 0.8, y - 0.55 + (k % 2) * 0.36, x - 1.25, y - 0.8 + (k % 2) * 0.5, P.x, 0.42);
    }
    afP(c, [[9.2, 3.6], [11.4, 4.2], [12.8, 5.6], [11.8, 6.6], [9.4, 6.6]], P.f);
    afE(c, 12.6, 5.7, 0.38, 0.34, NS); afE(c, 10.9, 4.8, 0.36, 0.36, K);
  });
});
