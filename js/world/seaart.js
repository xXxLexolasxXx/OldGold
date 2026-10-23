'use strict';
// Спрайты морских обитателей (МОРЕ.md, кадры — КАДРЫ.md): пиксель-арт рампами тона, лицом вправо.
// Каждый кадр строится при первом показе и кэшируется: SEA_ART[вид].draw(P, анимация, кадр, всего).
// Опорная точка (ax, ay) — середина низа (линия воды или земли). Под водой части рисуются тоном «в воде».
// Наборы кадров:
//   килька 4 (мелкие, исключение) · лосось плавание 8, прыжок 6 · краб покой 6, бег 8, атака 9, смерть 6, нора 6
//   звезда и ёж покой 6 · медуза плавание 8, атака 9, смерть 6 · черепаха покой 6, плавание 8, ход 8, детёныш 6
//   чайка полёт 8, покой 6, атака 9, смерть 6 · баклан покой 6 (сушит крылья), полёт 8, нырок 9
//   дельфин плавание 8, прыжок 9 · кит плавание 8, фонтан 6 · осьминог покой 6, плавание 8, атака 9, смерть 6
//   морской змей плавание 8, атака 9, смерть 6 · кракен: щупальце покой 6, удар 9, смерть 9 (босс), глаз 6

const SA_CACHE = new Map();
const SA_TAU = Math.PI * 2;

// Пиксельная «кисть» поверх 2d-контекста: только целые пиксели, без сглаживания
// q — клеток сетки на игровой пиксель: при мелком пикселе (PX_FINE, pixel.js) кисть рисует те же формы
// на сетке в q раз мельче (холст увеличен в q раз и отмасштабирован), линии — в 2 клетки толщиной
function saPen(g, q = 1) {
  const R = v => Math.round(v * q) / q, u = 1 / q, d2 = q > 1 ? 2 / q : 1;
  const P = {
    r(x, y, w, h, c) { g.fillStyle = c; g.fillRect(R(x), R(y), Math.max(u, R(w)), Math.max(u, R(h))); },
    p(x, y, c) { g.fillStyle = c; g.fillRect(R(x), R(y), 1, 1); },        // точка — целый игровой пиксель: из точек сложены щупальца
    e(cx, cy, rx, ry, c) {   // эллипс построчно
      g.fillStyle = c;
      for (let Y = -Math.ceil(ry * q); Y <= Math.ceil(ry * q); Y++) {
        const y = Y / q, k = 1 - (y * y) / (ry * ry + 0.01);
        if (k < 0) continue;
        const w = Math.round(rx * Math.sqrt(k) * q) / q;
        g.fillRect(R(cx - w), R(cy) + y, w * 2 + u, u);
      }
    },
    l(x0, y0, x1, y1, c) {   // отрезок Брезенхэма (на сетке q)
      g.fillStyle = c;
      x0 = Math.round(x0 * q); y0 = Math.round(y0 * q); x1 = Math.round(x1 * q); y1 = Math.round(y1 * q);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (let n = 0; n < 200 * q; n++) {
        g.fillRect(x0 / q, y0 / q, d2, d2);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    },
    a(alpha) { g.globalAlpha = alpha; },
    // Итог рисунка: висящие точки стираются, силуэт обводится тоном корпуса (dark — рампа, 0..1 — насколько темнее)
    fin(dark = 0.42) {
      const W = g.canvas.width, H = g.canvas.height, img = g.getImageData(0, 0, W, H), d = img.data;
      dropSpecks(d, W, H, 0);
      const src = new Uint8ClampedArray(d);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const o = (y * W + x) * 4;
        if (src[o + 3]) continue;
        for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const p = (yy * W + xx) * 4;
          if (!src[p + 3]) continue;
          d[o] = src[p] * dark; d[o + 1] = src[p + 1] * dark * 0.9; d[o + 2] = src[p + 2] * dark * 1.05; d[o + 3] = src[p + 3];
          break;
        }
      }
      g.putImageData(img, 0, 0);
    },
  };
  return P;
}

const SAC = {   // общие рампы
  sh: '#1c2e3c',                                       // тень под водой
  sil: ['#e8f0f4', '#b8c8d4', '#7890a4', '#4a5e74'],   // серебро чешуи
  sand: ['#e8d4a4', '#c8a870'],
  crab: ['#f08a5c', '#d0583a', '#9a3424', '#5e1c14'],
  star: ['#f6a860', '#e07038', '#a8462a'],
  urch: ['#6a3a6a', '#4a2448', '#2a1428', '#a874a4'],
  jel: ['#f4d8f0', '#d8a4e0', '#a878c8', '#7a58a8'],
  tur: ['#a8c070', '#7a9a48', '#4e6a30', '#c8b078', '#8a6a3e'],
  gull: ['#ffffff', '#e4e8ec', '#a8b0b8', '#5a6068', '#f0c040', '#d04a2a'],
  corm: ['#3a3e44', '#24282c', '#14161a', '#e8c86a', '#5a6a5a'],
  dol: ['#8aa4b8', '#6a849a', '#4a6278', '#d4e0e8'],
  wha: ['#5a6a84', '#3e4c64', '#2a3448', '#a8b4c4'],
  oct: ['#e07070', '#b84a54', '#8a2e3e', '#f8c0b0'],
  ser: ['#4a9a7a', '#2e7a5c', '#1c5040', '#c8e070', '#e04030'],
  kra: ['#a05a8a', '#7a3a6c', '#52244a', '#e0a0c8', '#f4e080'],
};

const SEA_ART = {
  // ---- килька: силуэт под водой (стайка рисуется из многих)
  sprat: { w: 7, h: 4, ax: 3, ay: 3, anims: { swim: 4 }, draw(P, a, f) {
    const t = [0, 1, 0, -1][f];
    P.r(1, 1, 4, 2, SAC.sh); P.r(5, 1 + (t > 0 ? 0 : 1), 1, 1, SAC.sh); P.r(0, 1 + t * 0.5, 1, 1, SAC.sh);
    P.p(4, 1, '#3a5468');
  } },
  // ---- лосось: плавание 8 (тень с изгибом хвоста), прыжок 6 (над водой, серебро)
  salmon: { w: 16, h: 14, ax: 8, ay: 12, anims: { swim: 8, jump: 6 }, draw(P, a, f, n) {
    if (a === 'swim') {
      const s = Math.sin(f / n * SA_TAU);
      P.e(8, 11, 4.5, 1.4, SAC.sh);
      P.r(2, 10 + Math.round(s), 2, 2, SAC.sh); P.p(1, 10 + Math.round(s * 1.6), SAC.sh); P.p(1, 12 + Math.round(s * 1.6), SAC.sh);
      P.p(11, 11, '#3a5468');
      return;
    }
    const k = f / (n - 1), lift = Math.round(Math.sin(k * Math.PI) * 7), bend = Math.round((k - 0.5) * 4);
    const y = 9 - lift;
    P.e(8, y, 4.5, 1.6, SAC.sil[2]); P.r(5, y - 1, 7, 1, SAC.sil[1]); P.r(6, y - 1, 4, 1, SAC.sil[0]);
    P.r(5, y + 1, 6, 1, '#d88a80');                                   // розовый бок
    P.r(2, y - 1 + bend, 2, 3, SAC.sil[3]); P.p(1, y - 2 + bend, SAC.sil[3]); P.p(1, y + 2 + bend, SAC.sil[3]);
    P.p(11, y - 1, '#14161a'); P.p(12, y, SAC.sil[3]);
    if (f === 0 || f === n - 1) { P.p(3, 12, '#e8f6ff'); P.p(12, 12, '#e8f6ff'); P.p(7, 11, '#ffffff'); }   // брызги на входе и выходе
  } },
  // ---- краб: покой 6, бег боком 8, атака 9, смерть 6, нора 6
  crab: { w: 17, h: 14, ax: 8, ay: 12, pad: [1, 3], anims: { idle: 6, walk: 8, atk: 9, die: 6, hide: 6 }, draw(P, a, f, n) {
    const C = SAC.crab;
    let sink = 0, flip = false, claw = 0, lift = 0, legPh = 0, fade = 1;
    if (a === 'idle') { claw = [0, 1, 1, 0, 0, 1][f] ; lift = [0, 0, 1, 1, 0, 0][f]; }
    if (a === 'walk') legPh = f;
    if (a === 'atk') { const ph = f < 3 ? f / 2 : f < 6 ? 1 : 1 - (f - 5) / 3; lift = Math.round(ph * 3); claw = f >= 3 && f < 6 ? (f % 2 ? 2 : 0) : 1; }
    if (a === 'die') { flip = f >= 2; fade = f >= 4 ? 1 - (f - 3) * 0.3 : 1; }
    if (a === 'hide') sink = Math.round(f / (n - 1) * 5);
    P.a(fade);
    const by = 6 + sink;
    // ноги (по три с боков)
    for (let k = 0; k < (sink > 1 ? 0 : 3); k++) {   // в норе ног не видно
      const up = ((legPh + k * 3) % 8) < 4 ? 0 : 1;
      if (!flip) { P.l(4 - k, by + 1, 2 - k * 1.2, by + 3 - up, C[2]); P.l(10 + k, by + 1, 12 + k * 1.2, by + 3 - (1 - up), C[2]); }
      else { P.l(4 - k, by - 1, 2 - k, by - 3 + up, C[2]); P.l(10 + k, by - 1, 12 + k, by - 3 + up, C[2]); }
    }
    // панцирь
    P.e(7, by, 4, 2.2, flip ? '#e8c0a0' : C[1]); P.r(4, by - 2, 7, 1, flip ? '#f4dcc4' : C[0]);
    if (!flip) { P.r(4, by + 1, 7, 1, C[2]); P.p(6, by - 1, C[0]); }
    // клешни: плечо к телу и цельные челюсти; пасть — просвет между челюстями, его обводит контур
    if (!flip) for (const s of [-1, 1]) {
      const cx = 7 + s * 5, cy = by - 2 - lift;
      P.l(7 + s * 3, by - 1, cx, cy + 1, C[2]);
      P.r(Math.min(cx, cx + s * 2), cy, 3, 2, C[1]);                         // кисть
      P.p(cx - s, cy + 1, C[2]);                                              // тень под кистью
      P.p(cx, cy - 1, C[0]);                                                  // верхняя челюсть, блик
      if (claw > 1) { P.p(cx, cy - 2, C[0]); P.p(cx, cy - 3, C[1]); P.p(cx + s, cy - 3, C[1]); }
      else if (claw) { P.p(cx, cy - 2, C[1]); P.p(cx + s, cy - 2, C[1]); }
      else P.p(cx + s, cy - 1, C[1]);
      P.p(cx + s * 2, cy + 1, C[1]);                                          // нижняя челюсть
    }
    // глаза на стебельках: светлая бусинка, а не чёрная точка
    if (!flip && sink < 4) { const ey = by - 3 - (lift ? 1 : 0); P.p(5, ey, '#f8e8d0'); P.p(9, ey, '#f8e8d0'); P.p(5, by - 2, C[2]); P.p(9, by - 2, C[2]); }
    P.fin();
    if (sink) { P.a(1); P.r(1, 9 - Math.max(0, sink - 4), 13, 1 + Math.min(4, sink), SAC.sand[1]); P.r(2, 9 - Math.max(0, sink - 4), 11, 1, SAC.sand[0]); }
    P.a(1);
  } },
  // ---- морская звезда и ёж: покой 6
  star: { w: 9, h: 8, ax: 4, ay: 7, anims: { idle: 6 }, draw(P, a, f) {
    const C = SAC.star, curl = [0, 0, 1, 1, 0, 0][f];
    for (let k = 0; k < 5; k++) {
      const an = -Math.PI / 2 + k * SA_TAU / 5 + (k === 1 ? curl * 0.2 : 0), L = 3.6 - (k === 3 ? curl * 0.6 : 0);
      P.l(4, 4, 4 + Math.cos(an) * L, 4 + Math.sin(an) * L * 0.8, C[1]);
    }
    P.r(3, 3, 3, 2, C[1]); P.p(4, 3, C[0]); P.p(3, 5, C[2]); P.p(5, 2, C[0]);
  } },
  urchin: { w: 9, h: 7, ax: 4, ay: 6, anims: { idle: 6 }, draw(P, a, f) {
    const C = SAC.urch;
    P.e(4, 4, 2.6, 1.8, C[1]);
    for (let k = 0; k < 9; k++) {
      const an = Math.PI + k * Math.PI / 8 + ((f + k) % 3 === 0 ? 0.12 : 0), L = 3.6 + ((f + k) % 2) * 0.5;
      P.p(4 + Math.cos(an) * L, 4 + Math.sin(an) * L * 0.8, C[2]);
    }
    P.p(3, 3, C[3]); P.p(5, 3, C[0]);
  } },
  // ---- медуза: плавание 8 (купол сжимается), атака 9 (щупальца хлещут), смерть 6
  jelly: { w: 13, h: 16, ax: 6, ay: 12, anims: { swim: 8, atk: 9, die: 6 }, draw(P, a, f, n) {
    const C = SAC.jel;
    let sq = 0, lash = 0, fade = 1, drop = 0;
    if (a === 'swim') sq = Math.sin(f / n * SA_TAU);
    if (a === 'atk') { sq = f < 3 ? f / 3 : -0.5; lash = f >= 3 && f < 6 ? (f - 2) : f >= 6 ? 9 - f : 0; }
    if (a === 'die') { sq = -f / 5; fade = 1 - f / 7; drop = f; }
    P.a(0.8 * fade);
    const rx = 4 + sq * 0.8, ry = 3 - sq * 0.6, cy = 5 + drop * 0.6;
    // щупальца
    for (let k = 0; k < 4; k++) {
      const x0 = 3 + k * 2, L = 5 + (k % 2) * 2 + lash;
      for (let j = 0; j < L; j++) P.p(x0 + Math.round(Math.sin(j * 0.8 + f * 0.8 + k) * (lash ? 1.6 : 0.8)), cy + 2 + j, j % 3 ? C[2] : C[1]);
    }
    P.e(6, cy, rx, ry, C[1]); P.r(6 - rx + 1, cy - 1, rx * 2 - 1, 1, C[0]); P.r(4, cy + 1, 5, 1, C[2]);
    P.p(5, cy - 1, '#ffffff');
    P.a(1);
  } },
  // ---- черепаха: покой 6 (голова прячется), плавание 8, ход по песку 8; детёныш 6
  turtle: { w: 20, h: 13, ax: 10, ay: 11, anims: { idle: 6, swim: 8, walk: 8 }, draw(P, a, f, n) {
    const C = SAC.tur;
    const s = Math.sin(f / n * SA_TAU), head = a === 'idle' ? [2, 2, 1, 0, 1, 2][f] : 2;
    const fl = a === 'swim' ? Math.round(s * 2.2) : a === 'walk' ? Math.round(s * 1.4) : 0;
    const by = a === 'walk' ? 7 + (f % 4 === 0 ? 1 : 0) : 7;
    // ласты
    P.e(6 - fl * 0.3, by + 2 + fl * 0.5, 2.4, 1.2, C[2]); P.e(14 + fl * 0.4, by + 2 - fl * 0.5, 2.6, 1.2, C[2]);
    P.e(6 + fl * 0.3, by - 2 - fl * 0.4, 2, 1, C[2]); P.e(14 - fl * 0.3, by - 2 + fl * 0.4, 2.4, 1, C[2]);
    // панцирь: рамка, щитки
    P.e(10, by, 5.4, 3.4, C[4]); P.e(10, by - 0.4, 4.6, 2.8, C[3]);
    P.r(8, by - 2, 4, 1, C[0]); P.r(7, by, 6, 1, C[4]); P.p(10, by - 1, C[4]); P.p(9, by + 1, C[4]); P.p(11, by + 1, C[4]);
    // голова
    if (head) { P.e(15 + head, by - 0.6, 1.6, 1.3, C[1]); P.p(16 + head, by - 1, '#14161a'); }
    if (a === 'swim') { P.a(0.6); P.r(3, by + 3, 14, 1, '#d8eef4'); P.a(1); }   // кромка воды по панцирю
  } },
  hatch: { w: 7, h: 5, ax: 3, ay: 4, anims: { walk: 6 }, draw(P, a, f) {
    const C = SAC.tur, s = f % 2;
    P.e(3, 2, 2, 1.3, C[4]); P.p(3, 1, C[3]); P.p(6, 2 - s, C[1]); P.p(1, 3 + s, C[2]); P.p(5, 3 + (1 - s), C[2]); P.p(1, 1 - s, C[2]);
  } },
  // ---- чайка: полёт 8, покой 6, атака 9 (нырок-клевок), смерть 6
  gull: { w: 22, h: 16, ax: 11, ay: 14, anims: { fly: 8, idle: 6, atk: 9, die: 6 }, draw(P, a, f, n) {
    const C = SAC.gull;
    if (a === 'fly' || (a === 'atk' && f < 4)) {
      const w = a === 'fly' ? Math.sin(f / n * SA_TAU) : -0.8;        // взмах: +1 крылья вверх
      const tipY = 7 - Math.round(w * 5), midY = 8 - Math.round(w * 2);
      P.l(11, 8, 5, midY, C[1]); P.l(5, midY, 1, tipY, C[2]); P.l(11, 8, 17, midY, C[1]); P.l(17, midY, 21, tipY, C[2]);
      P.p(1, tipY, C[3]); P.p(21, tipY, C[3]);
      P.e(11, 8.5, 3, 1.3, C[0]); P.r(14, 8, 2, 1, C[0]); P.p(16, 8, C[4]); P.p(15, 7, C[3]); P.r(7, 8, 2, 1, C[1]);
      return;
    }
    if (a === 'die') {
      const k = f / (n - 1);
      P.a(1 - k * 0.6);
      P.e(11, 12 + k * 2, 3.4, 1.4, C[1]); P.l(8, 12, 4, 13 + k, C[2]); P.l(14, 12, 18, 13 + k, C[2]);
      P.p(15, 12, C[3]); P.r(2 + f, 9 - f, 1, 1, C[0]); P.r(18 - f, 8 - f, 1, 1, C[1]);   // перья летят
      P.a(1);
      return;
    }
    // стоит: голова вертится (покой) или клюёт (атака, кадры 4…8)
    const peck = a === 'atk' ? [0, 0, 0, 0, 1, 2, 2, 1, 0][f] : 0;
    const look = a === 'idle' ? [0, 0, 1, 1, 0, -1][f] : 0;
    P.r(10, 12, 1, 2, C[4]); P.r(12, 12, 1, 2, C[4]);
    P.e(11, 10, 3.4, 2, C[0]); P.r(8, 9, 6, 1, C[2]); P.r(7, 10, 2, 1, C[3]);
    const hx = 14 + peck, hy = 7 + peck * 1.5;
    P.e(hx, hy, 1.7, 1.5, C[0]); P.p(hx + (look >= 0 ? 1 : -1), hy - 1, '#14161a');
    P.r(hx + (look >= 0 ? 2 : -3), hy, 2, 1, C[4]); P.p(hx + (look >= 0 ? 3 : -3), hy, C[5]);
  } },
  // ---- баклан: покой 6 (сушит крылья), полёт 8, нырок 9
  corm: { w: 22, h: 18, ax: 11, ay: 16, anims: { idle: 6, fly: 8, dive: 9 }, draw(P, a, f, n) {
    const C = SAC.corm;
    if (a === 'fly') {
      const w = Math.sin(f / n * SA_TAU), tip = 9 - Math.round(w * 5);
      P.l(11, 10, 4, 10 - w * 2, C[0]); P.l(4, 10 - w * 2, 1, tip, C[1]); P.l(11, 10, 18, 10 - w * 2, C[0]); P.l(18, 10 - w * 2, 21, tip, C[1]);
      P.e(11, 10.5, 3.4, 1.2, C[1]); P.r(14, 9, 3, 1, C[1]); P.r(17, 9, 2, 1, C[3]); P.r(6, 10, 2, 1, C[2]);
      return;
    }
    if (a === 'dive') {   // клюв вниз, сложенные крылья, уходит под воду
      const k = f / (n - 1), y = 4 + Math.round(k * 12);
      P.a(k > 0.6 ? 1 - (k - 0.6) * 2 : 1);
      P.e(11, y, 1.6, 3.4, C[1]); P.r(11, y + 3, 1, 3, C[3]); P.p(10, y - 3, C[2]);
      if (k > 0.55) { P.a(1); P.r(7, 15, 9, 1, '#e8f6ff'); P.p(6, 14, '#ffffff'); P.p(16, 14, '#ffffff'); }
      P.a(1);
      return;
    }
    // сидит на камне, крылья распахнуты и чуть качаются
    const wv = [0, 1, 1, 0, -1, -1][f];
    P.r(10, 14, 1, 2, C[2]); P.r(12, 14, 1, 2, C[2]);
    P.e(11, 10, 2.4, 4, C[1]); P.r(10, 8, 3, 3, C[0]);
    for (const s of [-1, 1]) { P.l(11 + s * 2, 8, 11 + s * 8, 6 + wv, C[0]); P.l(11 + s * 8, 6 + wv, 11 + s * 9, 11 + wv, C[1]); P.l(11 + s * 2, 11, 11 + s * 9, 11 + wv, C[2]); P.l(11 + s * 3, 9, 11 + s * 7, 8 + wv, C[1]); }
    P.r(11, 3, 2, 4, C[1]); P.r(12, 2, 3, 2, C[1]); P.r(15, 3, 2, 1, C[3]); P.p(13, 2, C[3]);
  } },
  // ---- дельфин: плавание 8 (спина с плавником дугой из воды), прыжок 9
  dolphin: { w: 26, h: 22, ax: 13, ay: 18, anims: { swim: 8, jump: 9 }, draw(P, a, f, n) {
    const C = SAC.dol;
    if (a === 'swim') {
      const k = f / n, up = Math.sin(k * Math.PI);
      if (up < 0.15) { P.e(13, 18, 6, 1.4, SAC.sh); return; }
      const x = 6 + Math.round(k * 14), h = Math.round(up * 3);
      P.e(13, 18, 6, 1.4, SAC.sh);
      P.e(x, 18 - h, 4, h, C[1]); P.r(x - 3, 18 - h, 7, 1, C[0]);
      P.l(x, 18 - h, x - 1, 15 - h * 1.6, C[2]); P.l(x + 1, 18 - h, x - 1, 15 - h * 1.6, C[1]);   // плавник
      P.r(x - 5, 18, 11, 1, '#d8eef4');
      return;
    }
    const k = f / (n - 1), x = 2 + k * 22, y = 18 - Math.sin(k * Math.PI) * 13, ang = (0.5 - k) * 1.8;
    const ca = Math.cos(ang), sa = -Math.sin(ang);
    const pt = (u, v) => [x + u * ca - v * sa, y + u * sa + v * ca];
    for (let u = -6; u <= 6; u++) {
      const th = u > 4 ? 0.6 : u < -4 ? 0.8 : 1.8 - Math.abs(u) * 0.12;
      const [px, py] = pt(u, 0);
      P.r(px, py - th, 1, th * 2, C[1]); P.p(px, py + th, C[3]); P.p(px, py - th, C[2]);
    }
    const [hx, hy] = pt(7, 0.5); P.p(hx, hy, C[2]); const [ex, ey] = pt(4, -0.6); P.p(ex, ey, '#14161a');
    const [fx0, fy0] = pt(-6, 0); P.l(fx0, fy0, fx0 - 2, fy0 - 2, C[2]); P.l(fx0, fy0, fx0 - 2, fy0 + 2, C[2]);
    const [dx, dy] = pt(0, -2); P.l(dx, dy, dx - 2, dy - 2, C[2]);
    if (f === 0 || f === n - 1) { P.r(x - 4, 18, 9, 1, '#e8f6ff'); P.p(x - 3, 16, '#ffffff'); P.p(x + 2, 15, '#ffffff'); }
  } },
  // ---- кит: плавание 8 (горб спины всплывает), фонтан 6
  whale: { w: 52, h: 26, ax: 26, ay: 22, anims: { swim: 8, spout: 6 }, draw(P, a, f, n) {
    const C = SAC.wha;
    const k = a === 'swim' ? Math.sin(f / n * Math.PI) : 1, h = Math.round(k * 4);
    P.e(26, 22, 20, 3, SAC.sh);
    if (h > 0) {
      P.e(24, 22 - h * 0.5, 15, h, C[1]); P.r(12, 22 - h, 22, 1, C[0]);
      P.r(30, 21 - h, 3, 1, C[3]); P.p(33, 21 - h, C[3]);                 // шрамы-ракушки
      P.r(9, 22, 31, 1, '#d8eef4');
      if (a === 'swim' && f >= 5) { P.l(6, 22, 2, 18 - (f - 5) * 2, C[2]); P.l(6, 22, 1, 21 - (f - 5), C[2]); P.r(1, 18 - (f - 5) * 2, 3, 1, C[1]); }   // хвост уходит
    }
    if (a === 'spout') {   // струя: растёт, распадается на капли
      const H = [4, 9, 13, 14, 12, 8][f], spread = [0, 1, 2, 4, 6, 8][f];
      P.a(f > 3 ? 0.7 : 0.9);
      for (let j = 0; j < H; j++) P.r(35 - (j > H - 4 ? spread * 0.5 : 0), 21 - h - j, 1 + (j > H - 4 ? spread : 0), 1, j % 3 ? '#e4f2f8' : '#ffffff');
      if (f >= 3) for (let j = 0; j < 5; j++) P.p(32 + j * 2 - spread * 0.3, 22 - h - H + (j % 2) * 2 + f, '#d0e8f4');
      P.a(1);
    }
  } },
  // ---- осьминог: покой 6, плавание 8 (реактивный толчок), атака 9 (хватает), смерть 6 (чернила)
  octo: { w: 22, h: 20, ax: 11, ay: 16, anims: { idle: 6, swim: 8, atk: 9, die: 6 }, draw(P, a, f, n) {
    const C = SAC.oct;
    let reach = 0, sq = 0, fade = 1, ink = 0;
    if (a === 'idle') sq = [0, 0.2, 0.4, 0.4, 0.2, 0][f];
    if (a === 'swim') sq = Math.sin(f / n * SA_TAU);
    if (a === 'atk') reach = f < 3 ? f : f < 6 ? 4 : 9 - f;
    if (a === 'die') { fade = 1 - f / 6; ink = f + 1; }
    if (ink) { P.a(0.5); P.e(11, 13, 4 + ink, 2 + ink * 0.5, '#141018'); P.a(1); }
    P.a(fade);
    for (let k = 0; k < 6; k++) {   // щупальца
      const bx = 6 + k * 2, L = 5 + (k % 2) + (k === 4 ? reach : 0);
      for (let j = 0; j < L; j++) {
        const xx = bx + Math.sin(j * 0.9 + f * 0.9 + k * 1.3) * (1 + sq) + (k === 4 ? j * reach * 0.25 : (k - 2.5) * j * 0.25);
        P.p(xx, 12 + j * (0.8 - sq * 0.2) - (k === 4 ? j * reach * 0.12 : 0), j > L - 2 ? C[0] : C[1]);
      }
    }
    P.e(11, 8 - sq, 4 - sq * 0.5, 4.4 + sq * 0.6, C[1]); P.e(11, 7 - sq, 3, 3, C[0]); P.p(10, 5 - sq, C[3]);
    P.r(8, 10 - sq, 2, 1, '#f8f0d0'); P.r(13, 10 - sq, 2, 1, '#f8f0d0'); P.p(9, 10 - sq, '#14161a'); P.p(13, 10 - sq, '#14161a');
    P.a(1);
  } },
  // ---- морской змей: плавание 8 (горбы катятся), атака 9 (голова вздымается, укус), смерть 6
  serpent: { w: 44, h: 26, ax: 22, ay: 20, anims: { swim: 8, atk: 9, die: 6 }, draw(P, a, f, n) {
    const C = SAC.ser;
    const ph = f / n * SA_TAU;
    let rear = 0, fade = 1, sink = 0;
    if (a === 'atk') rear = f < 3 ? f * 3 : f < 6 ? 9 - (f - 3) * 2 : 3 - (f - 6);
    if (a === 'die') { sink = f * 2; fade = 1 - f / 6; }
    P.a(fade);
    P.e(20, 20, 16, 2, SAC.sh);
    for (let k = 0; k < 3; k++) {   // горбы
      const hx = 6 + k * 9, hh = Math.max(0, Math.round((Math.sin(ph - k * 1.4) * 0.5 + 0.6) * 4) - sink);
      if (hh <= 0) continue;
      P.e(hx, 20 - hh * 0.5, 3, hh, C[1]); P.r(hx - 2, 20 - hh, 4, 1, C[0]); P.p(hx, 19 - hh, C[3]);
      P.r(hx - 3, 20, 7, 1, '#d8eef4');
    }
    // шея и голова
    const nh = Math.max(0, 6 + rear - sink), hx = 36, hy = 20 - nh;
    for (let j = 0; j <= nh; j++) P.r(33 + j * 0.25, 20 - j, 3, 1, j % 3 ? C[1] : C[2]);
    P.e(hx, hy - 1, 3.2, 2, C[1]); P.r(hx + 1, hy - 2, 3, 1, C[0]); P.p(hx + 1, hy - 2, C[4]);
    if (a === 'atk' && f >= 3 && f < 6) { P.r(hx + 2, hy, 4, 1, '#3a0a08'); P.p(hx + 3, hy - 1, '#ffffff'); P.p(hx + 5, hy + 1, '#ffffff'); }   // пасть
    P.r(hx - 2, hy - 4, 1, 2, C[3]); P.r(hx, hy - 4, 1, 2, C[3]);                                                                        // гребень
    P.r(30, 20, 9, 1, '#d8eef4');
    P.a(1);
  } },
  // ---- кракен: щупальце (покой 6, удар 9, смерть 9) и глаз над водой (6)
  tent: { w: 18, h: 46, ax: 9, ay: 44, anims: { idle: 6, atk: 9, die: 9, rise: 6 }, draw(P, a, f, n) {
    const C = SAC.kra;
    let H = 30, bend = 0, fade = 1;
    if (a === 'idle') bend = Math.sin(f / n * SA_TAU) * 3;
    if (a === 'rise') H = 6 + f * 5;
    if (a === 'atk') { if (f < 3) { H = 30 + f * 4; bend = -f * 2; } else if (f < 6) { H = 40 - (f - 3) * 13; bend = 4 + (f - 3) * 3; } else { H = 4 + (f - 6) * 8; bend = 6 - (f - 6) * 2; } }
    if (a === 'die') { H = Math.max(0, 30 - f * 4); bend = Math.sin(f * 1.7) * 4; fade = 1 - f / 10; }
    P.a(fade);
    for (let j = 0; j < H; j++) {
      const t = j / Math.max(1, H), w = Math.max(1, Math.round(6.5 * (1 - t) + 1.2));
      const curl = t > 0.72 ? (t - 0.72) * (t - 0.72) * 60 : 0;           // кончик закручен крючком
      const x = 9 + Math.sin(t * 2.2) * bend * t + bend * t * t * 0.8 + curl;
      P.r(x - w / 2, 44 - j, w, 1, j % 4 ? C[1] : C[2]);
      if (w > 2 && j % 3 === 1) P.p(x + w / 2 - 1, 44 - j, C[3]);                 // присоски
      if (w > 1) P.p(x - w / 2, 44 - j, C[0]);
    }
    P.e(9, 44, 6, 1.3, '#d8eef4');                                                // бурун у воды
    if (a === 'atk' && f === 5) { P.r(1, 43, 16, 2, '#ffffff'); P.p(0, 40, '#e8f6ff'); P.p(17, 39, '#e8f6ff'); P.p(4, 37, '#ffffff'); }   // удар — брызги
    P.a(1);
  } },
  kraeye: { w: 26, h: 16, ax: 13, ay: 14, anims: { idle: 6 }, draw(P, a, f) {
    const C = SAC.kra, blink = f === 3;
    P.e(13, 12, 11, 4, C[1]); P.e(13, 11, 9, 3, C[0]); P.r(4, 14, 18, 1, '#d8eef4');
    P.e(9, 10, 2.4, blink ? 0.4 : 2, C[4]); P.e(17, 10, 2.4, blink ? 0.4 : 2, C[4]);
    if (!blink) { P.r(9, 9, 1, 3, '#14161a'); P.r(17, 9, 1, 3, '#14161a'); }
  } },
  // ---- раковины и жемчужина: лут на пляже
  shell: { w: 7, h: 5, ax: 3, ay: 4, anims: { idle: 2 }, draw(P, a, f) {
    if (f === 0) { P.e(3, 2, 2.6, 1.6, '#f0d8c8'); P.l(1, 3, 3, 0, '#c8a090'); P.l(5, 3, 3, 0, '#c8a090'); P.p(3, 3, '#a87868'); }
    else { P.e(3, 2, 2, 1.4, '#e8c0a0'); P.l(1, 2, 5, 2, '#b88868'); P.p(5, 1, '#f8e8d8'); }
  } },
  pearl: { w: 5, h: 5, ax: 2, ay: 4, anims: { idle: 6 }, draw(P, a, f) {
    P.e(2, 2, 1.6, 1.6, '#e8e4f0'); P.p(1, 1, '#ffffff'); P.p(3, 3, '#a8a0c0');
    if (f === 2 || f === 3) { P.p(2, -0.4, '#ffffff'); P.p(4.4, 2, '#ffffff'); }
  } },
};

// Кадр: { cv, ax, ay } — строится при первом обращении
function seaSprite(kind, anim, f) {
  const A = SEA_ART[kind];
  if (!A) return null;
  const n = A.anims[anim] || 1;
  f = ((f % n) + n) % n;
  const key = kind + ':' + anim + ':' + f;
  let s = SA_CACHE.get(key);
  if (s) return s;
  const q = typeof PX_FINE !== 'undefined' ? PX_FINE : 1, cv = mkCanvas(A.w * q, A.h * q), g = cv.getContext('2d');   // без pixel.js (тесты) — как раньше
  if (q > 1) { g.scale(q, q); cv.fine = q; }
  if (A.pad) g.translate(A.pad[0], A.pad[1]);   // запас вокруг рисунка под обводку и поднятые клешни
  A.draw(saPen(g, q), anim, f, n);
  s = { cv, ax: A.ax, ay: A.ay };
  SA_CACHE.set(key, s);
  return s;
}
const seaFrames = (kind, anim) => (SEA_ART[kind] && SEA_ART[kind].anims[anim]) || 1;

// Нарисовать кадр в точке мира (px): face — 1 вправо / −1 влево
function seaBlit(c, kind, anim, f, px, py, face = 1, alpha = 1) {
  const s = seaSprite(kind, anim, f);
  if (!s) return;
  const ga = c.globalAlpha;
  if (alpha !== 1) c.globalAlpha = ga * alpha;
  c.imageSmoothingEnabled = false;
  if (face < 0) { c.save(); c.translate(Math.round(px), Math.round(py)); c.scale(-1, 1); blitFine(c, s.cv, -s.ax, -s.ay); c.restore(); }
  else blitFine(c, s.cv, Math.round(px) - s.ax, Math.round(py) - s.ay);
  c.imageSmoothingEnabled = R.smooth;
  c.globalAlpha = ga;
}

// Лист всех кадров (для проверки художником: ?seasheet=1 в консоли — seaSheet())
function seaSheet() {
  const rows = [];
  for (const k in SEA_ART) for (const a in SEA_ART[k].anims) rows.push([k, a, SEA_ART[k].anims[a]]);
  const cw = 44, ch = 50, W = cw * 9, H = ch * rows.length;
  const cv = mkCanvas(W, H), g = cv.getContext('2d');
  g.fillStyle = '#2a6e9e'; g.fillRect(0, 0, W, H);
  rows.forEach(([k, a, n], r) => {
    g.fillStyle = '#ffffff'; g.font = '9px monospace'; g.fillText(k + ' ' + a, 2, r * ch + 9);
    for (let f = 0; f < n; f++) { const s = seaSprite(k, a, f); g.drawImage(s.cv, f * cw + (cw - s.cv.width) / 2, r * ch + 10 + Math.max(0, 38 - s.cv.height)); }
  });
  return cv;
}
