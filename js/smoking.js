'use strict';
// Курево гномов: 7 трубок и 7 сортов сигарет, каждый — крошечный пиксельный спрайт со своей палитрой
// (рампа из 6 оттенков: свет тёплый, тень холодная; вокруг — 1-px тёмный контур).
// Анимация курения — 6 кадров: 0 достал, 1 поднёс, 2 вдох, 3 затяжка (огонёк горит ярче), 4 убрал ото рта, 5 выдох с дымком.
// Рука гнома запекается в спрайт по кадру (SMOKE_ARM), сама трубка рисуется поверх (drawSmoking).
// Один пиксель курева = 1/3 мирового пикселя, как в остальной графике.

const SM_U = 1 / 3, SM_PAD = 1, SM_W = 48, SM_H = 22, SM_A = 12;   // SM_A — строка оси (там рот)
const SM_GRIP = 7;                                                  // в пикселях курева от губ: где рука держит
const SM_INK = '#1c1216';                                           // контур
const SM_NF = 6;                                                    // кадров: достал, поднёс, вдох, затяжка, убрал, выдох
const SM_DUR = [0.5, 0.4, 0.5, 0.9, 0.6, 1.5];                                // сколько держится каждый кадр, сек
const SM_CYCLE = SM_DUR.reduce((a, b) => a + b, 0);
const SM_SLOPE = { E: [-0.55, -0.28, 0, 0, -0.14, -0.25], S: [-0.5, -0.28, 0.2, 0.2, 0, -0.2] };                             // наклон: рука внизу — курево задрано
const SM_EMBER_LVL = [0, 1, 2, 2, 1, 1];                                  // накал огонька по кадрам

// Положение кулака (мировые пиксели от ног) в каждом кадре; E — боком (лицом вправо), S — анфас
const SMOKE_ARM = {
  E: { hand: [[5.7, -8.2], [6.0, -10.6], [6.6, -13.0], [6.5, -13.0], [6.4, -11.8], [6.1, -10.4]], elbow: [[2.8, -9.4], [2.9, -9.6], [3.0, -9.6], [3.0, -9.6], [3.0, -9.6], [2.9, -9.6]] },
  S: { hand: [[5.0, -8.2], [4.4, -10.6], [3.7, -12.7], [3.7, -12.8], [4.3, -11.6], [4.4, -10.6]], elbow: [[5.4, -8.8], [5.4, -10.4], [5.2, -12.0], [5.2, -12.0], [5.2, -11.0], [5.4, -10.4]] },
};
const SMOKE_MOUTH = { E: [4.3, -13.3], S: [1.4, -13.0] };

// ---------- палитры ----------
function smHex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
const SM_RAMPS = new Map();
function smRamp(col) {   // 0 — светлее и теплее … 5 — темнее и холоднее
  let r = SM_RAMPS.get(col);
  if (r) return r;
  const [R0, G0, B0] = smHex(col);
  const cl = v => Math.max(0, Math.min(255, Math.round(v)));
  r = [];
  for (let i = 0; i < 6; i++) {
    const t = (i - 2) / 3;
    let R, G, B;
    if (t < 0) { const f = -t * 0.58; R = R0 + (255 - R0) * f * 1.05; G = G0 + (255 - G0) * f * 0.95; B = B0 + (255 - B0) * f * 0.7; }
    else { const f = t * 0.58; R = R0 * (1 - f) * 0.97; G = G0 * (1 - f) * 0.985; B = B0 * (1 - f) + 3 * t; }
    r.push(`rgb(${cl(R)},${cl(G)},${cl(B)})`);
  }
  SM_RAMPS.set(col, r);
  return r;
}
function smNoise(a, b) { const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return n - Math.floor(n); }

// огонёк: по накалу 0/1/2 — тусклый уголёк, живой, яркая затяжка
const SM_EMBER = [['#6a3020', '#8a4226'], ['#c8501e', '#f08a2c', '#ffc050'], ['#ff8c28', '#ffd860', '#fff6c0']];
const SM_ASH = ['#cfcac2', '#a8a6a8', '#7c7c88'];

// ---------- холст-сетка ----------
class SmGrid {
  constructor(lvl) { this.cv = document.createElement('canvas'); this.cv.width = SM_W; this.cv.height = SM_H; this.c = this.cv.getContext('2d'); this.lvl = lvl; this.hot = []; this.len = 0; this.ember = [0, SM_A]; }
  px(x, y, col) { this.c.fillStyle = col; this.c.fillRect(x + SM_PAD, y, 1, 1); if (x + 1 > this.len) this.len = x + 1; }
  fill(x0, y0, x1, y1, col) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.px(x, y, col); }
  // горизонтальная трубка: сверху блик, снизу холодная тень
  tube(x0, x1, yTop, th, ramp) {
    const idx = { 1: [2], 2: [1, 3], 3: [1, 2, 4], 4: [0, 2, 3, 4], 5: [0, 1, 2, 3, 4] }[th];
    for (let k = 0; k < th; k++) this.fill(x0, yTop + k, x1, yTop + k, ramp[idx[k]]);
  }
  // чашка: трапеция, слева свет, справа холодная тень, венчик светлее
  bowl(xc, yTop, yBot, wTop, wBot, ramp) {
    for (let y = yTop; y <= yBot; y++) {
      const t = yBot === yTop ? 0 : (y - yTop) / (yBot - yTop);
      const w = Math.round(wTop + (wBot - wTop) * t), xl = xc - Math.floor(w / 2), xr = xl + w - 1;
      for (let x = xl; x <= xr; x++) {
        const f = w < 2 ? 0.4 : (x - xl) / (w - 1);
        let i = f < 0.3 ? 1 : f < 0.66 ? 2 : 4;
        if (y === yTop) i = Math.max(0, i - 1);
        if (y === yBot) i = Math.min(5, i + 1);
        this.px(x, y, ramp[i]);
      }
    }
  }
  // уголёк в чашке трубки: зола по краям, огонь по центру
  coal(x0, x1, y) {
    const E = SM_EMBER[this.lvl];
    for (let x = x0; x <= x1; x++) {
      const mid = x > x0 && x < x1;
      this.px(x, y, mid ? E[(x + y) % 2 ? E.length - 1 : 1] : SM_ASH[2]);
      if (mid) this.hot.push([x, y]);
    }
    this.ember = [Math.round((x0 + x1) / 2), y];
  }
  // горящий кончик сигареты: зола перед угольком
  tip(xEnd, yTop, th, ashLen) {
    const E = SM_EMBER[this.lvl];
    for (let k = 0; k < th; k++) {
      const y = yTop + k;
      this.px(xEnd, y, E[k === 0 ? 1 : k === th - 1 ? 0 : E.length - 1]); this.hot.push([xEnd, y]);
      for (let a = 1; a <= ashLen; a++) this.px(xEnd - a, y, SM_ASH[k === 0 ? 0 : k === th - 1 ? 2 : 1]);
    }
    this.ember = [xEnd, yTop + (th >> 1)];
  }
  // светящаяся точка отдельно (щели крышки)
  spark(x, y) { this.px(x, y, SM_EMBER[this.lvl][1]); this.hot.push([x, y]); this.ember = [x, y]; }
}

// ---------- 14 видов ----------
const SM_PIPES = [
  { name: 'Глиняная коротышка', build(g) {
    const clay = smRamp('#b5603a'), stem = smRamp('#d9c9a6');
    g.tube(0, 7, SM_A - 1, 2, stem);
    g.bowl(9, SM_A - 5, SM_A, 5, 4, clay);
    g.fill(7, SM_A - 5, 11, SM_A - 5, clay[1]);                       // венчик
    g.px(8, SM_A - 3, clay[3]); g.px(10, SM_A - 3, clay[4]);           // пояски
    g.coal(8, 10, SM_A - 6);
  } },
  { name: 'Чубук', build(g) {
    const wood = smRamp('#6a3220'), brass = smRamp('#d8b050'), amber = smRamp('#e0a030'), bowlC = smRamp('#3c2a24');
    g.tube(0, 26, SM_A - 1, 2, wood);
    g.tube(0, 2, SM_A - 1, 2, amber);
    for (const x of [8, 20]) { g.px(x, SM_A - 1, brass[1]); g.px(x, SM_A, brass[3]); }
    g.bowl(29, SM_A - 4, SM_A + 1, 5, 4, bowlC);
    g.fill(27, SM_A - 4, 31, SM_A - 4, bowlC[0]);
    g.px(29, SM_A - 2, brass[2]);
    g.coal(28, 30, SM_A - 5);
  } },
  { name: 'Вересковая', build(g) {
    const briar = smRamp('#8a4a26'), amber = smRamp('#e0a030');
    g.tube(0, 3, SM_A + 1, 2, amber);
    g.tube(4, 7, SM_A, 2, briar);
    g.tube(8, 10, SM_A - 1, 2, briar);
    g.bowl(13, SM_A - 6, SM_A - 1, 7, 5, briar);
    g.fill(10, SM_A - 6, 16, SM_A - 6, briar[0]);
    for (let i = 0; i < 9; i++) g.px(8 + Math.floor(smNoise(i, 3) * 8), SM_A - 5 + Math.floor(smNoise(i, 7) * 5), briar[1]);   // прожилки
    g.coal(11, 15, SM_A - 7);
  } },
  { name: 'Кукурузная', build(g) {
    const cob = smRamp('#e8b830'), reed = smRamp('#e0d49a'), husk = smRamp('#6a9a3c');
    g.tube(0, 8, SM_A, 2, reed);
    g.bowl(12, SM_A - 6, SM_A + 1, 7, 6, cob);
    for (let y = SM_A - 5; y <= SM_A; y++) for (let x = 9; x <= 15; x++) if ((x + y) % 2 === 0) g.px(x, y, cob[smNoise(x, y) < 0.3 ? 0 : 3]);   // зёрна
    g.fill(9, SM_A + 1, 15, SM_A + 1, husk[2]); g.fill(11, SM_A + 2, 13, SM_A + 2, husk[4]);   // листок
    g.coal(10, 14, SM_A - 7);
  } },
  { name: 'Костяная', build(g) {
    const bone = smRamp('#e8e0cc'), bead = smRamp('#4ab0b0');
    g.tube(0, 10, SM_A - 1, 2, bone);
    for (const x of [3, 6]) { g.px(x, SM_A - 1, bone[3]); g.px(x, SM_A, bone[5]); }          // резные кольца
    g.px(1, SM_A - 1, bead[1]); g.px(1, SM_A, bead[3]);                                       // бирюзовая бусина
    g.bowl(13, SM_A - 5, SM_A, 6, 5, bone);
    g.fill(10, SM_A - 5, 15, SM_A - 5, bone[0]);
    g.fill(11, SM_A - 3, 15, SM_A - 3, bone[3]);
    g.coal(11, 14, SM_A - 6);
  } },
  { name: 'Резная с крышкой', build(g) {
    const wood = smRamp('#6a4428'), brass = smRamp('#d8b040');
    g.tube(0, 9, SM_A - 1, 2, wood);
    g.bowl(12, SM_A - 6, SM_A, 7, 5, wood);
    for (let y = SM_A - 5; y <= SM_A - 1; y += 2) for (let x = 10; x <= 14; x += 2) g.px(x, y, wood[0]);      // резьба
    g.fill(9, SM_A - 7, 15, SM_A - 7, brass[1]);                                                               // крышка
    g.fill(10, SM_A - 8, 14, SM_A - 8, brass[2]); g.px(11, SM_A - 9, brass[0]); g.px(12, SM_A - 9, brass[2]); g.px(13, SM_A - 9, brass[0]);
    g.px(11, SM_A - 8, SM_INK); g.px(13, SM_A - 8, SM_INK);                                                    // щели
    g.spark(11, SM_A - 8); g.spark(13, SM_A - 8);
    g.px(9, SM_A - 7, brass[4]); g.px(15, SM_A - 7, brass[4]);
  } },
  { name: 'Кальянная с чашей', build(g) {
    const glaze = smRamp('#3e6fa8'), hose = smRamp('#8a2e2a'), brass = smRamp('#d8b040');
    g.tube(0, 1, SM_A, 2, brass);
    for (let x = 2; x <= 13; x++) {                                                            // ребристый шланг волной
      const y = SM_A + (x < 5 ? 0 : x < 9 ? 1 : x < 12 ? 0 : -1);
      g.px(x, y, hose[x % 2 ? 1 : 2]); g.px(x, y + 1, hose[x % 2 ? 3 : 4]);
    }
    g.bowl(19, SM_A - 8, SM_A + 3, 9, 7, glaze);
    for (let y = SM_A - 8; y <= SM_A + 3; y++) { const t = (y - (SM_A - 8)) / 11, w = Math.round(9 - 2 * t); if (t > 0.15 && t < 0.8) { g.px(19 - (w >> 1), y, glaze[0]); } }   // бок чаши светлее
    g.fill(15, SM_A - 3, 23, SM_A - 3, brass[2]);                                              // золотой пояс
    g.px(16, SM_A - 6, glaze[0]); g.px(17, SM_A - 7, glaze[0]); g.px(16, SM_A - 5, glaze[1]);   // блик
    g.fill(16, SM_A - 9, 22, SM_A - 9, brass[1]);
    g.coal(17, 21, SM_A - 10);
  } },
];

const SM_CIGS = [
  { name: 'Самокрутка', build(g) {
    const p = smRamp('#e6d8b0');
    g.px(0, SM_A, p[3]);
    g.tube(1, 12, SM_A - 1, 3, p);
    for (const x of [5, 9]) { g.px(x, SM_A - 1, p[3]); g.px(x, SM_A, p[4]); }                 // мятая бумага
    g.px(11, SM_A - 1, smRamp('#6a4a28')[2]);
    g.tip(13, SM_A - 1, 3, 1);
  } },
  { name: 'Обычная', build(g) {
    const p = smRamp('#f0ece0'), f = smRamp('#d49a58');
    g.tube(0, 3, SM_A - 1, 3, f); g.px(1, SM_A, f[4]); g.px(2, SM_A - 1, f[3]);
    g.tube(4, 15, SM_A - 1, 3, p); g.px(4, SM_A, '#c0a070');
    g.tip(16, SM_A - 1, 3, 2);
  } },
  { name: 'Тонкая', build(g) {
    const p = smRamp('#e8a6b8'), f = smRamp('#f4f0e8'), gold = smRamp('#d8b050');
    g.tube(0, 2, SM_A, 2, f);
    g.tube(3, 19, SM_A, 2, p);
    g.px(4, SM_A, gold[1]); g.px(4, SM_A + 1, gold[3]); g.px(5, SM_A, gold[2]); g.px(5, SM_A + 1, gold[4]);
    g.tip(20, SM_A, 2, 1);
  } },
  { name: 'Сигара', build(g) {
    const leaf = smRamp('#7a4a24'), red = smRamp('#b02e2e'), gold = smRamp('#d8b050');
    g.tube(1, 21, SM_A - 2, 4, leaf);
    g.px(0, SM_A - 1, leaf[2]); g.px(0, SM_A, leaf[3]);                                         // срез с краю
    for (let x = 2; x < 21; x += 3) { g.px(x, SM_A - 2 + Math.floor(smNoise(x, 1) * 4), leaf[x % 2 ? 0 : 4]); }   // жилки листа
    g.fill(8, SM_A - 2, 10, SM_A + 1, red[2]); g.fill(8, SM_A - 2, 10, SM_A - 2, red[1]); g.fill(8, SM_A + 1, 10, SM_A + 1, red[4]);
    g.px(9, SM_A - 1, gold[1]); g.px(9, SM_A, gold[3]);                                          // золотая лента
    g.tip(25, SM_A - 2, 4, 3);
  } },
  { name: 'Длинная на мундштуке', build(g) {
    const eb = smRamp('#2e2a34'), gold = smRamp('#d8b050'), ame = smRamp('#9a5ac0'), p = smRamp('#f4f0e8');
    g.tube(0, 15, SM_A, 2, eb);
    g.px(0, SM_A, ame[1]); g.px(0, SM_A + 1, ame[3]); g.px(1, SM_A, ame[2]); g.px(1, SM_A + 1, ame[4]);   // аметистовый наконечник
    for (const x of [5, 14]) { g.px(x, SM_A, gold[1]); g.px(x, SM_A + 1, gold[3]); }
    g.px(14, SM_A - 1, eb[2]); g.px(14, SM_A + 2, eb[4]);                                        // чашечка под сигарету
    g.tube(16, 28, SM_A, 2, p);
    g.tip(29, SM_A, 2, 1);
  } },
  { name: 'Бидис', build(g) {
    const leaf = smRamp('#9a7a4a'), thr = smRamp('#d85a8a');
    g.px(0, SM_A, leaf[3]);
    g.tube(1, 8, SM_A - 1, 2, leaf); g.px(5, SM_A - 1, leaf[0]);
    g.px(2, SM_A - 1, thr[1]); g.px(2, SM_A, thr[3]);                                            // нитка
    g.tip(9, SM_A - 1, 2, 1);
  } },
  { name: 'Сигарилла', build(g) {
    const br = smRamp('#5a3a22'), pl = smRamp('#f0ece0'), gold = smRamp('#d8b050');
    g.tube(0, 3, SM_A - 1, 3, pl); g.px(3, SM_A - 1, pl[4]); g.px(3, SM_A, pl[5]); g.px(3, SM_A + 1, pl[5]);
    g.tube(4, 19, SM_A - 1, 3, br);
    g.px(9, SM_A - 1, gold[1]); g.px(9, SM_A, gold[2]); g.px(9, SM_A + 1, gold[4]);
    g.tip(20, SM_A - 1, 3, 2);
  } },
];

const SM_ALL = [...SM_PIPES.map(p => ({ ...p, kind: 'pipe' })), ...SM_CIGS.map(p => ({ ...p, kind: 'cig' }))];

// ---------- сборка спрайта: контур, свечение, наклон по кадру ----------
const SM_CACHE = new Map();
function smokeItemSprite(id, frame, view = 'E') {
  const key = (id * SM_NF + frame) * 2 + (view === 'S' ? 1 : 0);
  let s = SM_CACHE.get(key);
  if (s) return s;
  const lvl = SM_EMBER_LVL[frame], slope = SM_SLOPE[view][frame];
  const g = new SmGrid(lvl);
  SM_ALL[id].build(g);
  const W = SM_W, H = SM_H, src = g.c.getImageData(0, 0, W, H), d = src.data;
  const has = (x, y) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] > 0;
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const o = out.getContext('2d'), od = o.createImageData(W, H);
  const put = (x, y, r, gg, b, a) => { const i = (y * W + x) * 4; od.data[i] = r; od.data[i + 1] = gg; od.data[i + 2] = b; od.data[i + 3] = a; };
  const ink = smHex(SM_INK);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (has(x, y)) { const i = (y * W + x) * 4; put(x, y, d[i], d[i + 1], d[i + 2], 255); }
    else if (has(x - 1, y) || has(x + 1, y) || has(x, y - 1) || has(x, y + 1)) put(x, y, ink[0], ink[1], ink[2], 255);
  }
  // свечение вокруг огонька: ярче на затяжке
  if (lvl) for (const [hx, hy] of g.hot) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const x = hx + SM_PAD + dx, y = hy + dy;
    if (x < 0 || y < 0 || x >= W || y >= H || od.data[(y * W + x) * 4 + 3]) continue;
    const dist = Math.max(Math.abs(dx), Math.abs(dy));
    if (dist > lvl) continue;
    put(x, y, 255, 170, 70, dist === 1 ? 120 : 60);
  }
  o.putImageData(od, 0, 0);
  // наклон: сдвиг столбцов (пиксельный, без поворота и сглаживания)
  const hs = Math.ceil(W * Math.abs(slope));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H + hs;
  const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
  const base = slope < 0 ? hs : 0;
  for (let x = 0; x < W; x++) c.drawImage(out, x, 0, 1, H, x, base + Math.round(x * slope), 1, H);
  const shift = x => base + Math.round(x * slope);
  s = { cv, w: W, h: H + hs, shift, len: g.len, ember: [g.ember[0] + SM_PAD, g.ember[1]], kind: SM_ALL[id].kind, name: SM_ALL[id].name };
  SM_CACHE.set(key, s);
  return s;
}

// ---------- кто что курит и какой сейчас кадр ----------
function smokeKindOf(u) { return (Math.imul((u.id | 0) + 11, 2654435761) >>> 9) % SM_ALL.length; }
function smokeKindName(u) { return SM_ALL[smokeKindOf(u)].name; }
// длинное курево анфас торчало бы в ухо — такие гномы курят только боком
const SM_SHORT = new Set([0, 2, 3, 4, 5, 7, 8, 12]);
function smokeViewOf(u) { return (u.id * 7 + (u.id >> 2)) % 2 && SM_SHORT.has(smokeKindOf(u)) ? 'S' : 'E'; }
function smokeFrameOf(u) {
  let t = (Game.time + (u.id | 0) * 0.73) % SM_CYCLE;
  for (let f = 0; f < SM_NF; f++) { if (t < SM_DUR[f]) return f; t -= SM_DUR[f]; }
  return SM_NF - 1;
}
// 0..1 — доля текущего кадра, для дымка выдоха
function smokePhaseOf(u) {
  let t = (Game.time + (u.id | 0) * 0.73) % SM_CYCLE;
  for (let f = 0; f < SM_NF; f++) { if (t < SM_DUR[f]) return t / SM_DUR[f]; t -= SM_DUR[f]; }
  return 1;
}

// дымок пикселями: светлый тёплый → серый → холодный тёмный
const SM_SMOKE = ['rgba(238,234,224,', 'rgba(204,204,208,', 'rgba(150,154,168,'];
function smPuff(c, x, y, size, age, a) {
  const k = age < 0.35 ? 0 : age < 0.7 ? 1 : 2;
  c.fillStyle = SM_SMOKE[k] + (a * (1 - age * 0.8)).toFixed(2) + ')';
  const s = size * SM_U;
  c.fillRect(Math.round(x / SM_U) * SM_U, Math.round(y / SM_U) * SM_U, s, s);
}

// Рисует курево в руке гнома и дымок. (px, py) — ноги, view — 'E' или 'S', face — взгляд (±1) для E.
function drawSmoking(c, u, px, py, view) {
  const fr = smokeFrameOf(u), id = smokeKindOf(u), sp = smokeItemSprite(id, fr, view === 'E' ? 'E' : 'S');
  const face = view === 'E' ? (u.face < 0 ? -1 : 1) : 1, V = view === 'E' ? 'E' : 'S';
  const hand = SMOKE_ARM[V].hand[fr];
  // колонка SM_PAD+SM_GRIP спрайта должна лечь в кулак
  const gc = SM_PAD + SM_GRIP;
  const ox = hand[0] - gc * SM_U, oy = hand[1] + 0.25 - (SM_A + sp.shift(gc)) * SM_U;
  const prev = c.imageSmoothingEnabled;
  c.save(); c.translate(px, py); if (face < 0) c.scale(-1, 1);
  c.imageSmoothingEnabled = false;
  c.drawImage(sp.cv, Math.round(ox / SM_U) * SM_U, Math.round(oy / SM_U) * SM_U, sp.w * SM_U, sp.h * SM_U);
  // кулак поверх курева: оно зажато в руке, а не лежит перед ней
  const sk = SKINS[lookOf({ type: u.type, look: LOOK_POOL[(u.look >>> 0) % LOOK_POOL.length] }).skin];
  const fx = Math.round(hand[0] / SM_U) * SM_U - 2 * SM_U, fy = Math.round((hand[1] + 0.25) / SM_U) * SM_U - 2 * SM_U;
  c.fillStyle = '#3a2214'; c.fillRect(fx - SM_U, fy, 6 * SM_U, 4 * SM_U); c.fillRect(fx, fy - SM_U, 4 * SM_U, 6 * SM_U);
  c.fillStyle = sk[0]; c.fillRect(fx, fy, 4 * SM_U, 3 * SM_U);
  c.fillStyle = sk[1]; c.fillRect(fx, fy + 3 * SM_U, 4 * SM_U, SM_U); c.fillRect(fx + 3 * SM_U, fy, SM_U, 4 * SM_U);
  c.fillStyle = sk[2]; c.fillRect(fx + SM_U, fy + SM_U, SM_U, SM_U);   // костяшка
  // тонкая струйка от огонька всегда; на выдохе — клуб изо рта
  const ex = ox + sp.ember[0] * SM_U, ey = oy + sp.shift(sp.ember[0]) * SM_U + sp.ember[1] * SM_U - 0.3;
  const T = Game.time + u.id * 0.37;
  for (let k = 0; k < 3; k++) {
    const p = (T * 0.5 + k / 3) % 1;
    smPuff(c, ex + Math.sin(p * 6 + k + u.id) * 1.1 + p * 1.5, ey - p * 11, 1 + Math.floor(p * 3), p, fr === 2 || fr === 3 ? 0.8 : 0.55);
  }
  if (fr === 5 || (fr === 0 && smokePhaseOf(u) < 0.5)) {
    const ph = fr === 5 ? smokePhaseOf(u) : 0.6 + smokePhaseOf(u) * 0.4;   // шлейф доходит и до следующего кадра
    const m = SMOKE_MOUTH[V];
    const mx = m[0] + 1.2 + ph * 5, my = m[1] + 0.8 - ph * (V === 'S' ? 7 : 4);
    for (let k = 0; k < 7; k++) {
      const a = k * 2.4 + u.id, r = ph * 2.2 + k * 0.18;
      smPuff(c, mx + Math.cos(a) * r - (V === 'S' ? 0 : 0), my + Math.sin(a) * r * 0.7, 2 + (k & 1) + (ph > 0.5 ? 1 : 0), ph, 0.85);
    }
  }
  c.restore();
  c.imageSmoothingEnabled = prev;
}
