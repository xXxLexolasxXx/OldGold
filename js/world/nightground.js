'use strict';
// Ночная земля: тихая жуть на траве, снегу и болоте — из земли тянется костяная рука, плотоядный цветок кусает воздух,
// встаёт надгробие, в траве моргают глаза, по низинам ползёт туман. Всё стоит на клетках по сиду мира (в коопе у всех одинаково)
// и кадрируется по КАДРЫ.md: рука 6 кадров, цветок 6, надгробие 6 (подъём), глаза 4 (моргание), туман — медленный дрейф.
// Спрайты рисуются один раз в маленькие холсты и берутся из кэша; считаются только клетки в кадре, днём — ничего.
// Рисуется двумя проходами: ground (до объектов, ночь его притемняет) и glow (после ночного затемнения: глаза светятся, туман светлеет).

const NG_CYC = { hand: 16, flower: 10, tomb: 44, eyes: 12 };
const NG_COLS = {
  meadow: { dk: '#281a40', pet: ['#7e58cc', '#4c3080', '#bea4f6'], mouth: ['#d0808e', '#7a3a4a'], eyes: ['#f6d458', '#e04a3a'], fog: '#8ea0b8', soil: ['#341f14', '#45291a', '#583522'], cap: null },
  forest: { dk: '#4a1614', pet: ['#c8583a', '#8c2c20', '#f0a070'], mouth: ['#d0808e', '#4a1614'], eyes: ['#f6d458', '#e07a50'], fog: '#8aa896', soil: ['#24170f', '#341f14', '#45291a'], cap: null },
  steppe: { dk: '#5a3a10', pet: ['#e4b434', '#a4701c', '#fff2a0'], mouth: ['#ac3e2a', '#4a1614'], eyes: ['#e04a3a', '#f6d458'], fog: '#bfae8a', soil: ['#583522', '#6e432a', '#875434'], cap: null },
  mountain: { dk: '#38245c', pet: ['#9c7ae6', '#6440a8', '#e2d6ff'], mouth: ['#d0808e', '#4c3080'], eyes: ['#76b2d4', '#f6d458'], fog: '#9aa6b6', soil: ['#3a3632', '#4a4540', '#5c564f'], cap: null },
  swamp: { dk: '#243520', pet: ['#73963e', '#3a5a2a', '#c8da84'], mouth: ['#ac3e2a', '#2e0e0e'], eyes: ['#8eab4c', '#e4b434'], fog: '#7f9a6a', soil: ['#141c12', '#1c2818', '#243520'], cap: null },
  winter: { dk: '#22486c', pet: ['#a6d2e6', '#5292bc', '#ffffff'], mouth: ['#7e58cc', '#281a40'], eyes: ['#76b2d4', '#d6eef6'], fog: '#c8d8ea', soil: ['#a6d2e6', '#d6eef6', '#f6f2ea'], cap: '#f6f2ea' },
};
const NG_SPR = {};
function ngCols(set) { return NG_COLS[set] || NG_COLS.meadow; }
function ngSprite(key, w, h, fn) {
  let s = NG_SPR[key];
  if (s) return s;
  const cv = mkCanvas(w, h), c = cv.getContext('2d');
  const P = (x, y, col) => { if (x < 0 || y < 0 || x >= w || y >= h) return; c.fillStyle = col; c.fillRect(x | 0, y | 0, 1, 1); };
  fn(c, P, w, h);
  return (NG_SPR[key] = cv);
}
function ngFree() { for (const k of Object.keys(NG_SPR)) { NG_SPR[k].width = NG_SPR[k].height = 0; delete NG_SPR[k]; } }

// ---- рука скелета: 0 бугорок и кончики пальцев, 1 вылезает кулаком-когтем, 2 рука вверх, 3 и 4 качнулась влево/вправо, 5 сжала кулак ----
// Настоящая кисть: две кости предплечья, запястье из косточек, четыре пястные кости веером, у пальцев по три фаланги с суставами, большой палец сбоку.
const NG_HAND_SEQ = [0, 0, 1, 1, 2, 3, 4, 3, 4, 3, 5, 5, 2, 1, 0];   // шаг 0.35 с
const NG_HAND_F = [
  { L: 0, tilt: 0, curl: 1, sp: 0 }, { L: 6, tilt: 0, curl: 0.75, sp: 0.1 }, { L: 8, tilt: 0, curl: 0.05, sp: 0.3 },
  { L: 8, tilt: -1, curl: 0.1, sp: 0.5 }, { L: 8, tilt: 1, curl: 0.1, sp: 0.5 }, { L: 8, tilt: 0, curl: 1, sp: 0 },
];
function ngHand(set, f) {
  return ngSprite('hand_' + set + f, 19, 30, (c, P, W, H) => {
    const K = ngCols(set).soil, F = NG_HAND_F[f], cx = 9, gy = H - 3;
    // холмик
    for (let x = 3; x <= 15; x++) P(x, H - 1, K[0]);
    for (let x = 4; x <= 14; x++) P(x, H - 2, x < 9 ? K[2] : K[1]);
    for (let x = 6; x <= 12; x++) P(x, H - 3, x < 9 ? K[2] : K[1]);
    P(3, H - 2, K[1]); P(15, H - 2, K[0]); P(5, H - 3, K[1]); P(13, H - 3, K[0]);
    const BONE = ['#f6f2ea', '#e4ddd2', '#b6ada0', '#706960'];   // свет, тело, тень, щель
    const bone = (x, y, sh) => P(Math.round(x), Math.round(y), BONE[sh]);
    if (f === 0) {   // торчат кончики пальцев
      for (const [dx, h] of [[-3, 1], [-1, 2], [1, 3], [3, 1]]) { bone(cx + dx, gy - h, 0); bone(cx + dx, gy - h + 1, 1); }
      return;
    }
    const wy = gy - F.L;                          // запястье
    // предплечье: локтевая и лучевая кости с зазором, суставные утолщения
    for (let j = 0; j < F.L; j++) {
      const y = gy - j, xo = Math.round(F.tilt * (j / Math.max(1, F.L)) * 2);
      bone(cx - 2 + xo, y, 1); bone(cx - 1 + xo, y, 2); bone(cx + xo, y, 3); bone(cx + 1 + xo, y, 1); bone(cx + 2 + xo, y, 2);
      if (j === 2 || j === F.L - 2) { bone(cx - 3 + xo, y, 1); bone(cx + 3 + xo, y, 2); }
    }
    const hx = cx + Math.round(F.tilt * 2), top = wy;
    // запястье: два ряда косточек
    for (let x = -3; x <= 3; x++) { bone(hx + x, top - 1, (x + 3) % 2 ? 1 : 2); bone(hx + x, top, x < 0 ? 1 : 2); }
    bone(hx - 4, top - 1, 2); bone(hx + 4, top - 1, 3);
    // пястные кости веером и пальцы
    const offs = [-3, -1, 1, 3], lens = [5, 7, 6, 4], my = top - 2;
    for (let i = 0; i < 4; i++) {
      const fan = (i - 1.5) * F.sp * 0.5, kx = hx + offs[i] + Math.round(fan * 2), ky = my - 4;
      for (let j = 0; j < 4; j++) bone(hx + offs[i] * (0.75 + 0.06 * j), my - j, j === 3 ? 0 : 1);   // пясть
      const lenK = 1 - 0.78 * F.curl;   // сжатый кулак — пальцы короче
      let x = kx, y = ky;
      const ang = -Math.PI / 2 + fan * 0.7;
      const segs = [Math.ceil(lens[i] * 0.45), Math.ceil(lens[i] * 0.33), Math.max(1, Math.ceil(lens[i] * 0.22))];
      for (let k = 0; k < 3; k++) {
        const n = Math.max(1, Math.round(segs[k] * lenK));
        for (let m = 0; m < n; m++) {
          x += Math.cos(ang + fan * 0.3 * k) * 0.9; y += Math.sin(ang + fan * 0.3 * k);
          bone(x, y, m === n - 1 ? 0 : (k === 1 ? 2 : 1));
        }
        if (F.curl < 0.5) bone(x + (offs[i] < 0 ? -1 : 1), y + 0.4, 3);   // щель у сустава
      }
      bone(x, y - 1, F.curl < 0.5 ? 0 : 1);
    }
    // большой палец слева: две фаланги наискось
    let tx = hx - 4, ty = my - 1;
    const tn = F.curl > 0.6 ? 1 : 3;
    for (let m = 0; m < tn; m++) { tx -= 0.8; ty -= 0.9; bone(tx, ty, m === tn - 1 ? 0 : 1); }
    if (F.curl < 0.5) { tx -= 0.5; ty -= 1; bone(tx, ty, 0); bone(tx + 1, ty, 3); }
    if (F.curl > 0.9) for (let x = -2; x <= 2; x += 2) bone(hx + x, top - 5, 0);   // костяшки кулака
  });
}

// ---- плотоядный цветок («чомпер» с большой головой): 0 пасть закрыта, 1 качнулся, 2 приоткрылся, 3 распахнул, 4 щёлкнул, 5 жуёт ----
const NG_FL_SX = [0, 1, 0, 0, 0, 0];
function ngFlower(set, f) {
  return ngSprite('flower_' + set + f, 28, 40, (c, P, W, H) => {
    const C = ngCols(set), [p0, p1, p2] = C.pet, dk = C.dk, [m0, m1] = C.mouth, sx = NG_FL_SX[f], cx = 13;
    // стебель: толстый, изогнутый к голове
    for (let j = 0; j < 12; j++) {
      const x = cx + Math.round(sx * j / 12 + Math.sin(j * 0.45) * 1.2), y = H - 1 - j;
      P(x - 1, y, '#2f4a26'); P(x, y, '#3a5a2a'); P(x + 1, y, j % 4 ? '#4a6e30' : '#73963e');
    }
    // два больших листа у земли
    for (let i = 0; i < 6; i++) {
      const dy = i < 3 ? -i : -2 + (i - 3) * 0.5;
      P(cx - 2 - i, H - 3 + dy, i < 4 ? '#4a6e30' : '#73963e'); P(cx - 2 - i, H - 2 + dy, '#2f4a26');
      P(cx + 3 + i, H - 5 + dy, i < 4 ? '#4a6e30' : '#73963e'); P(cx + 3 + i, H - 4 + dy, '#2f4a26');
    }
    const R = 8, hy = H - 22 + (f === 4 || f === 5 ? 1 : 0) + (f === 3 ? -1 : 0), hx = cx + sx, mouthDy = 3;   // рот чуть ниже середины шара
    const gap = [0, 0, 4, 9, 1, 0][f];
    const tone = (dx, dy) => {   // шар, свет сверху-слева
      const lit = 0.55 - dx * 0.42 / R - dy * 0.42 / R;
      return lit > 0.8 ? p2 : lit > 0.42 ? p0 : lit > 0.14 ? p1 : dk;
    };
    const inside = (dx, dy) => dx * dx + dy * dy <= R * R + 1;
    if (gap > 1) {   // нутро пасти, язык
      const top = hy + mouthDy - gap, bot = hy + mouthDy;
      for (let y = top; y < bot; y++) { const w = R - 1 - Math.floor(Math.abs(y - (top + bot) / 2) * 0.9); for (let x = -w; x <= w; x++) P(hx + x, y, y === top ? m1 : m0); }
      for (let x = -3; x <= 3; x++) { P(hx + x, bot - 1, '#eeaab2'); if (Math.abs(x) < 3) P(hx + x, bot - 2, '#d0808e'); }
      P(hx, bot - 3, '#eeaab2');
    }
    // верхняя часть головы (большая) поднимается на gap
    for (let dy = -R; dy <= mouthDy; dy++) for (let dx = -R; dx <= R; dx++) {
      if (!inside(dx, dy)) continue;
      const edge = !inside(dx - 1, dy) || !inside(dx + 1, dy) || !inside(dx, dy - 1);
      P(hx + dx, hy + dy - gap, edge ? dk : tone(dx, dy));
    }
    for (const [dx, dy] of [[-3, -3], [2, -4], [4, -1], [-5, 0], [0, -1]]) { P(hx + dx, hy + dy - gap, p2); P(hx + dx + 1, hy + dy - gap, p2); P(hx + dx, hy + dy - gap + 1, p0); }   // пятна
    const ym = hy + mouthDy - gap;
    for (let x = -R + 1; x <= R - 1; x++) P(hx + x, ym, dk);   // линия рта
    for (const x of [-5, -2, 1, 4]) { P(hx + x, ym, '#ffffff'); P(hx + x, ym + 1, f === 4 ? '#f6f2ea' : '#cec6ba'); }   // клыки
    // нижняя челюсть (маленькая) с клыками
    for (let dy = mouthDy + 1; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      if (!inside(dx, dy)) continue;
      const edge = !inside(dx - 1, dy) || !inside(dx + 1, dy) || !inside(dx, dy + 1);
      const tn = tone(dx, dy);
      P(hx + dx, hy + dy, edge ? dk : tn === p2 ? p0 : tn);
    }
    for (const x of [-3, 0, 3]) P(hx + x, hy + mouthDy + 1, '#ffffff');
    if (f === 4) for (let x = -R + 2; x <= R - 2; x += 2) { P(hx + x, hy + mouthDy, '#ffffff'); P(hx + x + 1, hy + mouthDy + 1, '#f6f2ea'); }
    if (f === 5) { P(hx + R, hy + 1, p0); P(hx + R + 1, hy + 2, p1); P(hx - R - 1, hy - 1, p1); P(hx - R, hy, p0); }
    // чашелистики под головой
    P(hx - 3, hy + R + 1, '#3a5a2a'); P(hx + 3, hy + R + 1, '#3a5a2a'); P(hx, hy + R + 1, '#4a6e30'); P(hx - 2, hy + R + 2, '#2f4a26'); P(hx + 2, hy + R + 2, '#2f4a26');
  });
}

// ---- надгробие: 0..5 — всё выше из земли ----
const NG_TOMB_VIS = [3, 6, 9, 12, 15, 16];
function ngTomb(set, f) {
  return ngSprite('tomb_' + set + f, 16, 20, (c, P, W, H) => {
    const C = ngCols(set), K = C.soil, vis = NG_TOMB_VIS[f], cx = 8, w = 5, bottom = H - 2;   // нижний край над землёй
    for (let r = 0; r < vis; r++) {   // сверху вниз: сначала показывается верх
      const y = bottom - vis + 1 + r;
      const rw = r < 1 ? w - 3 : r < 2 ? w - 2 : r < 3 ? w - 1 : w;
      for (let x = -rw; x <= rw; x++) {
        let col = x < -rw + 1 ? '#b6ada0' : x > rw - 1 ? '#5c564f' : r < 2 ? '#b6ada0' : '#9e958a';
        if (r === 0 && x < 0) col = '#cec6ba';
        P(cx + x, y, col);
      }
      if (C.cap && r < 2) for (let x = -rw; x <= rw; x++) P(cx + x, y, r === 0 ? '#ffffff' : '#f6f2ea');
      if (r === 5 || r === 6) P(cx - 1 + (r === 5 ? 0 : 0), y, '#4a4540');   // крест
      if (r === 7) { P(cx - 2, y, '#4a4540'); P(cx - 1, y, '#4a4540'); P(cx, y, '#4a4540'); P(cx + 1, y, '#4a4540'); }
      if (r === 9 || r === 11) { P(cx - 2, y, '#706960'); P(cx - 1, y, '#706960'); P(cx + 1, y, '#706960'); }   // «RIP»
      if (r > 10 && !C.cap && (r * 7 + f) % 3 === 0) P(cx - w + 1, y, '#4a6e30');   // мох
    }
    // земля вокруг основания
    for (let x = -w - 2; x <= w + 2; x++) P(cx + x, bottom + 1, K[0]);
    for (let x = -w - 1; x <= w + 1; x++) P(cx + x, bottom, x < 0 ? K[2] : K[1]);
    if (f < 5) { P(cx - w - 2, bottom - 1, K[1]); P(cx + w + 2, bottom - 2, K[2]); P(cx - w - 1, bottom - 2, K[2]); P(cx + w + 1, bottom - 1, K[1]); P(cx - 1, bottom - 4 - f, K[2]); }
  });
}

// ---- глаза в траве: миндалевидные, с вертикальным зрачком. 0 открыты, 1 прищур, 2 закрыты ----
function ngEyes(set, f) {
  return ngSprite('eyes_' + set + f, 20, 10, (c, P, W, H) => {
    const E = ngCols(set).eyes, pupil = '#0c0c14', blade = '#0c140c', blade2 = '#141c12';
    const eye = (cx, left) => {
      if (f === 2) { for (let x = -2; x <= 2; x++) P(cx + x, 4, E[1]); return; }
      const sl = left ? 1 : -1;   // злой прищур: внешний уголок выше
      if (f === 0) {
        for (let x = -1; x <= 1; x++) P(cx + x, 2, E[1]);
        P(cx - 2 * sl, 2, E[1]);
        for (let x = -2; x <= 2; x++) P(cx + x, 3, E[0]);
        P(cx, 3, pupil);
        for (let x = -1; x <= 1; x++) P(cx + x, 4, E[0]);
        P(cx, 4, pupil); P(cx + 2 * sl, 4, E[1]);
        P(cx - 1, 5, E[1]); P(cx + 1, 5, E[1]);
      } else {
        for (let x = -2; x <= 2; x++) P(cx + x, 3, E[0]);
        P(cx, 3, pupil);
        for (let x = -1; x <= 1; x++) P(cx + x, 4, E[1]);
      }
    };
    eye(5, true); eye(14, false);
    for (const [x, h] of [[1, 3], [4, 2], [9, 3], [10, 2], [13, 2], [17, 3], [18, 2]]) for (let j = 0; j < h; j++) P(x, H - 1 - j, j % 2 ? blade2 : blade);   // травинки прикрывают нижний край
  });
}
function ngGlow(set) {
  return ngSprite('eglow_' + set, 30, 16, (c) => {
    const g = c.createRadialGradient(15, 8, 0, 15, 8, 13); const e = ngCols(set).eyes[0];
    g.addColorStop(0, e + 'aa'); g.addColorStop(1, e + '00'); c.fillStyle = g; c.fillRect(0, 0, 30, 16);
  });
}
// ---- туман: пиксельное пятно из трёх ступеней прозрачности ----
function ngFog(set, v) {
  return ngSprite('fog_' + set + v, 112, 32, (c, P, W, H) => {
    const col = ngCols(set).fog, o = v * 9;
    c.fillStyle = col;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const nx = (x - W / 2) / (W / 2 - 2), ny = (y - H / 2) / (H / 2 - 2);
      let d = nx * nx + ny * ny + 0.18 * Math.sin((x + o) * 0.21) * Math.sin(y * 0.4 + o) ;
      if (d > 1) continue;
      const a = d < 0.35 ? 0.5 : d < 0.7 ? 0.32 : (((x + y) & 1) ? 0 : 0.16);
      if (!a) continue;
      c.globalAlpha = a; c.fillRect(x, y, 1, 1);
    }
    c.globalAlpha = 1;
  });
}

// ---- что стоит на клетке и в какой момент ----
function ngKindAt(tx, ty, seed) {
  const h = gsHash(tx, ty, seed + 7);
  return h < 0.013 ? 1 : h < 0.033 ? 2 : h < 0.042 ? 3 : h < 0.09 ? 4 : 0;   // рука, цветок, плита, глаза
}
function ngTileOk(tx, ty) {
  const i = ty * MAP_W + tx;
  return World.terrain[i] === T_GRASS && !World.road[i] && !World.bmap[i] && !World.obj[i];
}
function ngPose(kind, u) {   // кадр по времени цикла u (с); -1 — не видно
  if (kind === 1) { if (u >= NG_HAND_SEQ.length * 0.35) return -1; return NG_HAND_SEQ[Math.floor(u / 0.35)]; }
  if (kind === 2) { if (u < 6) return (Math.floor(u / 0.5) & 1); if (u < 6.6) return 2; if (u < 7.8) return 3; if (u < 8.1) return 4; if (u < 8.7) return 5; return 0; }
  if (kind === 3) { if (u < 16 || u >= 37.5) return -1; if (u < 17.5) return Math.min(5, Math.floor((u - 16) / 0.25)); if (u < 36) return 5; return Math.max(0, 5 - Math.floor((u - 36) / 0.25)); }
  return 0;
}
// одна клетка: картинка и положение (px, py — низ спрайта)
function ngDrawTile(c, kind, set, tx, ty, seed, t, al, glowPass) {
  const ph = gsHash(tx, ty, seed + 11), px = tx * TILE + 6 + gsHash(tx, ty, seed + 13) * 20, py = ty * TILE + 12 + gsHash(tx, ty, seed + 17) * 16;
  if (kind === 1 || kind === 2 || kind === 3) {
    if (glowPass) return;
    const cyc = kind === 1 ? NG_CYC.hand : kind === 2 ? NG_CYC.flower : NG_CYC.tomb, f = ngPose(kind, (t + ph * cyc) % cyc);
    if (f < 0) return;
    const s = kind === 1 ? ngHand(set, f) : kind === 2 ? ngFlower(set, f) : ngTomb(set, f);
    c.globalAlpha = al; c.drawImage(s, Math.round(px - s.width / 2), Math.round(py - s.height + 2)); c.globalAlpha = 1;
  } else if (kind === 4 && glowPass) {
    const u = (t + ph * NG_CYC.eyes) % NG_CYC.eyes;
    if (u > 7.5) return;
    const k = Math.floor(u * 4), fade = Math.min(1, u * 2, (7.5 - u) * 2);
    const f = (k % 13 === 5) ? 2 : (k % 13 === 4 || k % 13 === 6) ? 1 : 0;
    const s = ngEyes(set, f), dx = Math.round(Math.sin(u * 0.8 + ph * 6) * 1);
    const x = Math.round(px - 10), y = Math.round(py - 9);
    c.globalAlpha = al * fade; c.drawImage(s, x, y);
    if (f === 0) { c.globalAlpha = al * fade * 0.5; c.globalCompositeOperation = 'lighter'; c.drawImage(ngGlow(set), x - 5 + dx, y - 3); c.globalCompositeOperation = 'source-over'; }
    c.globalAlpha = 1;
  }
}
function ngSetNow() { return (typeof MapOpt !== 'undefined' && MapOpt.biome) || 'meadow'; }
function ngAlpha() { const a = nightAmt(); return a < 0.55 ? 0 : Math.min(1, (a - 0.55) * 4); }

// Первый проход (до объектов): рука, цветок, плита
function nightGroundDraw(c, x0, y0, x1, y1) {
  const al = ngAlpha();
  if (!al) return;
  const set = ngSetNow(), seed = Game.seed | 0, t = Game.time;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const k = ngKindAt(tx, ty, seed);
    if (k < 1 || k > 3 || !ngTileOk(tx, ty)) continue;
    ngDrawTile(c, k, set, tx, ty, seed, t, al, false);
  }
}
// Второй проход (после затемнения): глаза и туман
const NG_FOG_CH = 6;
function nightGroundGlow(c, x0, y0, x1, y1) {
  const al = ngAlpha();
  if (!al || (typeof Fps !== 'undefined' && Fps.eco)) return;
  const set = ngSetNow(), seed = Game.seed | 0, t = Game.time;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (ngKindAt(tx, ty, seed) !== 4 || !ngTileOk(tx, ty)) continue;
    ngDrawTile(c, 4, set, tx, ty, seed, t, al, true);
  }
  // туман: в каждом квадрате NG_FOG_CH клеток — пятно с вероятностью 0.4, оно медленно дрейфует
  const cx0 = Math.floor(x0 / NG_FOG_CH) - 1, cx1 = Math.floor(x1 / NG_FOG_CH) + 1, cy0 = Math.floor(y0 / NG_FOG_CH) - 1, cy1 = Math.floor(y1 / NG_FOG_CH) + 1;
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
    if (gsHash(cx, cy, seed + 23) > 0.4) continue;
    const ph = gsHash(cx, cy, seed + 29) * 6.283, s = ngFog(set, (cx + cy) & 1);
    const x = cx * NG_FOG_CH * TILE + gsHash(cx, cy, seed + 31) * 100 + Math.sin(t * 0.05 + ph) * 26 - 56;
    const y = cy * NG_FOG_CH * TILE + gsHash(cx, cy, seed + 37) * 130 + Math.sin(t * 0.032 + ph * 1.7) * 7;
    c.globalAlpha = al * 0.34 * (0.65 + 0.35 * Math.sin(t * 0.17 + ph));
    c.drawImage(s, Math.round(x), Math.round(y));
  }
  c.globalAlpha = 1;
}
