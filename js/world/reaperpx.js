'use strict';
// Жнец в пиксель-арте той же стилистики, что пиксельные призраки (ghostpx.js): метод Полудницы и дракона — сетка ×3 мельче мирового,
// fzPxKit, рампы, Байер, тело ОДНОЙ формой (DS_body, smin), обводка в конце. Жнец в 1,35 раза крупнее призрака:
// мир 81×103 → сетка 243×309, начало — центр головы (как у векторного жнеца: GHOST_OX/OY × REAPER_SC).
// Чёрная ряса с холодным отсветом по краю, хвост тает зерном; костлявые руки с когтями; большая коса (как серп Полудницы, только длиннее).
// Три головы на выбор (лист tools/pxghost/reaper.html):
//   R1 — «шлем»: чёрный рогатый шлем с прорезью, в ней череп (как нынешний векторный жнец), бараньи рога;
//   R2 — «колпак»: высокий чёрный колпак-жнец с лентой, заплатой и потрёпанными полями (как у призраков), рожки сквозь колпак;
//   R3 — «капюшон»: глубокий капюшон, череп в тени, над ним — корона из костяных шипов.
// mood: 'idle' | 'boo' | 'atk'; p — фаза парения 0..1; k — ход взмаха 0..1 (замах 0–.35, удар .35–.6, отдача).
// Владелец выбрал: у всех жнецов колпак (R2), у каждой из трёх форм рогов (g.var) — свой колпак; шлем R1 и капюшон R3 не в игре.
// В игре рисуется из drawGhosts (ghosts.js), R3 пока не в игре.

const RPX = {
  RB: [[4, 6, 12], [10, 14, 24], [20, 26, 40], [34, 44, 64], [56, 72, 100], [90, 114, 148]],      // ряса: чёрно-синяя, холодный край
  BO: [[50, 58, 64], [92, 104, 110], [140, 154, 158], [188, 200, 200], [228, 238, 236]],
  HM: [[6, 8, 12], [20, 24, 32], [42, 48, 60], [72, 82, 98], [124, 140, 160]],                    // шлем: воронёный
  CAP: [[6, 8, 14], [16, 20, 30], [30, 36, 50], [50, 58, 76], [80, 92, 112]],
  BAND: [[30, 6, 8], [64, 14, 14], [100, 28, 22], [140, 48, 34]],                                  // лента на колпаке — запёкшаяся кровь
  BAND2: [[22, 8, 30], [46, 18, 58], [76, 34, 90], [110, 60, 124]],                                // лиловая
  BAND3: [[8, 22, 18], [18, 44, 36], [34, 70, 56], [58, 100, 80]],                                  // тёмно-зелёная
  CAP2: [[10, 8, 10], [22, 18, 22], [38, 32, 38], [60, 52, 58], [92, 82, 88]],                     // бурая чернь
  CAP3: [[4, 8, 12], [12, 20, 28], [24, 36, 48], [42, 58, 74], [72, 92, 110]],                      // сине-чёрный
  PATCH: [[18, 20, 26], [32, 36, 44], [52, 58, 68], [78, 86, 98]],
  HORN: [[24, 8, 8], [60, 20, 14], [110, 44, 26], [170, 90, 50], [230, 170, 110]],
  VO: [[2, 4, 8], [8, 12, 20], [16, 22, 34]],
  WD: [[20, 12, 8], [44, 28, 16], [72, 48, 28], [104, 74, 44]],                                     // древко
  IR: [[18, 22, 28], [46, 54, 64], [92, 104, 116], [160, 176, 190], [232, 240, 248]],              // лезвие
  CL: [[6, 8, 10], [24, 30, 34], [56, 64, 70]],
  EYE: { idle: [[110, 180, 255], [226, 244, 255]], boo: [[255, 50, 24], [255, 210, 160]] },
  EDGE: [2, 4, 10],
};

function reaperPx(v, mood, p = 0, k = 0, hv = 0, rag = null) {
  const K = fzPxKit(243, 309, 120, 129), { P, R, L, dth, hsh } = K, TAU = Math.PI * 2, { RB, BO, VO, IR, WD, CL } = RPX;
  const atk = mood === 'atk', hurt = mood === 'hurt', boo = mood === 'boo' || atk;
  const sn = (m, o = 0) => Math.sin(p * TAU * m + o), sm = x => x * x * (3 - 2 * x);
  const wind = atk ? sm(Math.min(1, k / 0.35)) : 0, strike = atk ? sm(Math.max(0, Math.min(1, (k - 0.35) / 0.25))) : 0, recoil = atk ? sm(Math.max(0, (k - 0.6) / 0.4)) : 0;
  const lean = atk ? (-10 * wind + 24 * strike) * (1 - recoil) : hurt ? -14 : 0;
  const HX = lean * 0.7, HY = (atk ? 5 * strike - 4 * wind : 0) + sn(1, 0.8) * 1.5;
  const eye = RPX.EYE[boo ? 'boo' : 'idle'];
  const open = atk ? Math.max(wind * 0.3, strike) * (1 - recoil * 0.6) : boo ? 0.9 : 0.12 + 0.06 * sn(2);
  const drop = open * 9, FX = HX + (v === 'R3' ? 2 : 0), FY = HY + 4, FRX = 16;
  const faceF = (x, y) => {
    const dy = (y - FY) / (y > FY ? 22 + drop : 15), dx = (x - FX) / (FRX * (1 - Math.max(0, dy) * 0.26));
    return (Math.hypot(dx, dy) - 1) * 12;
  };
  const ell = DS_ell, cap = DS_cap, tip = sn(1, 0.6) * 7 + lean * 0.4;
  // колпак жнеца — свой у каждой формы рогов (образец — колпаки призраков: лента со стежками, заплата, складки, потрёпанные поля):
  //  hv 2 бычьи с завитком — высокий острый, кончик загнут назад, кровавая лента;
  //  hv 0 бараньи спирали — мягкий, кончик свисает вперёд, широкие поля, лиловая лента, две заплаты;
  //  hv 1 винтом вверх — узкий, между рогами, кончик крюком назад и вниз, помпон, тёмно-зелёная лента
  const CP = [
    { cone: [[HX, HY - 14, 25], [HX + 3, HY - 40, 14], [HX + 16 + tip * 0.6, HY - 58, 8], [HX + 32 + tip, HY - 54, 4], [HX + 38 + tip, HY - 42, 1.5]], brim: 33,
      patch: [[HX + 9, HY - 36], [HX - 9, HY - 30]], band: RPX.BAND2, fab: RPX.CAP2 },
    { cone: [[HX, HY - 15, 21], [HX - 3 + tip * 0.2, HY - 44, 11], [HX - 10 + tip * 0.6, HY - 70, 6], [HX - 26 + tip, HY - 80, 3.5], [HX - 36 + tip, HY - 70, 2]], brim: 26,
      patch: [[HX - 5, HY - 44]], band: RPX.BAND3, fab: RPX.CAP3, bob: [HX - 37 + tip, HY - 66] },
    { cone: [[HX, HY - 15, 24], [HX - 6 + tip * 0.3, HY - 48, 13], [HX - 20 + tip, HY - 78, 5], [HX - 36 + tip * 1.5, HY - 90, 1]], brim: 30,
      patch: [[HX - 7 + tip * 0.15, HY - 42]], band: RPX.BAND, fab: RPX.CAP },
  ][hv];

  // ---- ось рясы: плечи → длинный хвост
  const tailLen = 150 - 20 * strike, N = 14, spine = [];
  for (let n = 0; n <= N; n++) {
    const t = n / N, y = 18 + t * tailLen;
    spine.push([lean * (1 - t) * 0.9 + sn(1, -t * 5) * (4 + t * 26) - strike * t * 22, y, 36 * Math.pow(1 - t, 0.75) + 2]);
  }
  const tailEnd = spine[N][1];
  const cut = (x, y) => y > 70 && dth(x, y) * 0.55 + hsh(x * 7.31 + y * 3.17) * 0.45 < Math.pow((y - 70) / (tailEnd - 70), 1.3) * 1.15;

  // ---- коса: древко через ближнюю кисть, лезвие на верхнем конце
  // угол древка: в покое наискось за плечом, в замахе — назад-вверх, в ударе — вперёд-вниз
  const pa = atk ? (-1.95 - 0.5 * wind) * (1 - strike) + 0.15 * strike + (-1.2 - 0.15) * recoil * 0 : -1.25 + sn(1) * 0.05;
  const hand = atk
    ? [24 - 18 * wind + 40 * strike - 20 * recoil, 30 - 34 * wind + 30 * strike - 10 * recoil]
    : boo ? [34, -10] : [30 + sn(1, 1) * 2, 26 + sn(2) * 3];
  const ux = Math.cos(pa), uy = Math.sin(pa), POLE_UP = 92, POLE_DN = 64;
  const top = [hand[0] + ux * POLE_UP, hand[1] + uy * POLE_UP], bot = [hand[0] - ux * POLE_DN, hand[1] - uy * POLE_DN];
  const scythe = () => {
    L(bot[0], bot[1], top[0], top[1], 2.4, 2.1, (t, e, sd) => e ? WD[0] : sd > 0 ? WD[1] : ((t * 40 | 0) % 7 === 0 ? WD[1] : WD[2]));     // древко
    R(bot[0] - 4, bot[1] - 4, bot[0] + 4, bot[1] + 4, (x, y) => { const d = Math.hypot(x - bot[0], y - bot[1]); return d < 3.2 ? (d < 2 ? IR[2] : IR[1]) : null; });   // набалдашник
    L(top[0] - ux * 6, top[1] - uy * 6, top[0] + ux * 2, top[1] + uy * 2, 3.4, 3.4, (t, e) => e ? IR[0] : IR[2]);                       // оковка
    // лезвие: от верхушки поперёк древка вперёд, дугой вниз; шире у пятки, к острию игла
    const sg = 1, n0 = pa + Math.PI / 2 * sg, NB = 48, pts = [];
    let x = top[0], y = top[1], d = n0 - 0.15;
    for (let i = 0; i <= NB; i++) {
      const t = i / NB; pts.push([x, y, t < 0.18 ? 4.5 : 4.6 * (1 - (t - 0.18) / 0.82) + 0.3]);
      d += sg * (t < 0.2 ? 0.012 : 0.034); x += Math.cos(d) * 1.45; y += Math.sin(d) * 1.45;
    }
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0, w0] = pts[i - 1], [x1, y1, w1] = pts[i], t0 = (i - 1) / NB;
      L(x0, y0, x1, y1, w0, w1, (t, e, sd) => {
        const inner = sd * sg > 0;
        if (e && !inner) return IR[0];
        if (e && inner) return t0 > 0.2 && t0 < 0.85 && hsh(x0 * 3 + y0) > 0.6 ? IR[4] : IR[3];
        return hsh(Math.round(x0) * 7 + Math.round(y0) * 13) > 0.9 ? RPX.HORN[1] : inner ? IR[2] : IR[1];
      });
    }
  };

  // ---- руки
  const arm = s => {
    const shx = lean * 0.5 + s * 26, shy = 20;
    let hx, hy;
    if (s > 0) [hx, hy] = hand;
    else if (atk) { hx = -30 + 60 * strike - 20 * recoil; hy = -30 * wind + 40 * strike; }
    else if (boo) { hx = -48; hy = -46 + sn(2) * 4; }
    else { hx = -50 + sn(1) * 5; hy = 14 + sn(2, 1) * 8; }
    const ex = (shx + hx) / 2 + s * 10, ey = (shy + hy) / 2 + 16;
    return { shx, shy, ex, ey, hx, hy, dir: Math.atan2(hy - ey, hx - ex) };
  };
  const AF = arm(-1), AN = arm(1);
  const armParts = A => [{ f: cap(A.shx, A.shy, A.ex, A.ey, 12, 8), mat: 'rb', k: 7 }, { f: cap(A.ex, A.ey, A.hx, A.hy, 6, 4), mat: 'bo', k: 4 }];
  const claw = (A, s, far, grip) => {
    const B = far ? BO.slice(0, 4) : BO, { hx, hy, dir } = A;
    R(hx - 8, hy - 8, hx + 8, hy + 8, (x, y) => { const d = (x - hx) ** 2 + (y - hy) ** 2; return d <= 30 ? (d > 18 ? B[1] : B[2]) : null; });
    for (const j of [-1.5, -0.5, 0.5, 1.5, -3.1]) {
      const th = j < -2, a = dir + j * (th ? 0.45 : 0.3) * s + (grip ? 0.9 * s : 0), a2 = a + (grip ? 1.2 : 0.3) * s;
      const l1 = th ? 7 : Math.abs(j) > 1 ? 9 : 11, l2 = th ? 5 : Math.abs(j) > 1 ? 7 : 8;
      const bx = hx + Math.cos(a) * 4.5, by = hy + Math.sin(a) * 4.5, x1 = bx + Math.cos(a) * l1, y1 = by + Math.sin(a) * l1, x2 = x1 + Math.cos(a2) * l2, y2 = y1 + Math.sin(a2) * l2;
      L(bx, by, x1, y1, 2, 1.5, (t, e) => e ? B[1] : B[far ? 2 : 3]);
      P(x1, y1, B[0]);
      L(x1, y1, x2, y2, 1.5, 1.2, (t, e) => e ? B[1] : B[2]);
      const a3 = a2 + 0.5 * s, cl = th ? 7 : 13;
      L(x2, y2, x2 + Math.cos(a3) * cl, y2 + Math.sin(a3) * cl, 1.6, 0.2, (t, e) => t > 0.72 || e ? CL[0] : t < 0.35 ? CL[2] : CL[1]);
    }
  };

  // ---- слои сзади вперёд: в покое коса за спиной, дальняя рука
  if (!atk) scythe();
  DS_body(K, armParts(AF), { rb: RB.slice(0, 5), bo: BO.slice(0, 4) }, { bb: [-120, -128, 121, 179], W: 6, k: 5, amb: 0.12, mat: 'rb' });
  claw(AF, -1, true, false);

  // ---- рога: часть ОДНОЙ формы — капсулы вдоль оси слиты с колпаком smin, у корня цвет колпака переходит в рог Байером.
  // Три формы (hv, как g.var у векторного жнеца) — 0 бараньи спирали, 1 винтом вверх, 2 бычьи с завитком на конце;
  // у шлема (R1) крупные, у колпака (R2) торчат сквозь колпак и закручены сильнее; R3 — корона костяных шипов
  const HORNS = [], horn = (pts, r0) => HORNS.push(pts.map((q, i) => [q[0], q[1], r0 * Math.pow(1 - i / (pts.length - 1), 0.75) + 0.5]));
  const curl = v === 'R2' ? 1.45 : 1, HS = v === 'R2' ? 1.1 : 1.25;                    // закрут и размер
  for (const s of [-1, 1]) {
    if (v === 'R3') {
      for (const j of [0.7, 1.2]) { const a = -Math.PI / 2 + s * j * 0.5, b = [HX - 3 + s * j * 14, HY - 34 + j * 6]; horn([b, [b[0] + Math.cos(a) * 7, b[1] + Math.sin(a) * 7], [b[0] + Math.cos(a) * 14, b[1] + Math.sin(a) * 14]], 2.8); }
      continue;
    }
    const b = v === 'R1' ? [HX + s * 19, HY - 9] : hv === 0 ? [HX + s * 19, HY - 25] : [HX + s * (hv === 1 ? 21 : 19), HY - 18], pts = [];   // бычьи и винтовые — пониже, у висков
    if (hv === 0) {                                                                     // баранья спираль: вверх, наружу и вниз к щеке, тугой завиток
      const c0 = [b[0] + s * 13 * HS, b[1] + 3 * HS], th0 = s > 0 ? Math.PI : 0, r0 = Math.hypot(b[0] - c0[0], b[1] - c0[1]);
      for (let i = 0; i <= 26; i++) { const t = i / 26, th = th0 + s * t * Math.PI * 2 * (v === 'R2' ? 0.74 : 1.15), r = r0 * (1 - 0.32 * t) + 6 * HS * Math.sin(t * Math.PI) * (1 - t); pts.push([c0[0] + Math.cos(th) * r, c0[1] + Math.sin(th) * r]); }
      horn(pts, 7 * HS);
    } else if (hv === 1) {                                                              // винтом вверх: высокие, витые
      for (let i = 0; i <= 22; i++) { const t = i / 22; pts.push([b[0] + s * (6 + 18 * t + Math.sin(t * Math.PI * 2.5 * curl) * 6 * (1 - t * 0.5)) * HS, b[1] - 44 * t * HS]); }   // винтом вверх и вразлёт
      horn(pts, 6 * HS);
    } else {                                                                            // бычьи: вбок, вверх и завиток внутрь на конце
      for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push([b[0] + s * (30 * Math.sin(t * Math.PI * 0.55)) * HS, b[1] - (4 + 30 * t * t) * HS]); }
      const e = pts[pts.length - 1], c0 = [e[0] - s * 6 * HS, e[1]];
      for (let i = 1; i <= 12; i++) { const t = i / 12, th = (s > 0 ? 0 : Math.PI) - s * t * Math.PI * 1.3 * curl, r = 6 * HS * (1 - 0.6 * t); pts.push([c0[0] + Math.cos(th) * r, c0[1] + Math.sin(th) * r]); }
      horn(pts, 6.5 * HS);
    }
  }
  if (v === 'R3') horn([[HX - 4, HY - 38], [HX - 4, HY - 46], [HX - 3, HY - 54]], 3);

  // ---- одна форма: ряса, плечи, ближняя рука, голова и убор
  // ряса: гладкая (rag = null) или лохмотья — T1 полосы, T2 рваньё с дырами, T3 клочья (лист tools/pxghost/rags.html)
  const robeCaps = DS_chain(spine).map(q => q.f), shoulder = ell(lean * 0.6, 22, 40, 18);
  const robe0 = (x, y) => { let u = shoulder(x, y); for (const f of robeCaps) u = DS_smin(u, f(x, y), 8); return u; };
  const vn = (x, y, sc) => {                                                          // гладкий шум по сетке хэшей
    const gx = x / sc, gy = y / sc, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy, h = (a, b) => hsh(a * 57.1 + b * 13.7);
    const u = fx * fx * (3 - 2 * fx), w = fy * fy * (3 - 2 * fy);
    return (h(ix, iy) * (1 - u) + h(ix + 1, iy) * u) * (1 - w) + (h(ix, iy + 1) * (1 - u) + h(ix + 1, iy + 1) * u) * w;
  };
  const sway = (y, a) => Math.sin(y * 0.09 + p * TAU) * a;                           // лохмотья колышутся
  const robe = !rag ? robe0 : rag === 'T1' ? (x, y) => {
    let d = robe0(x, y);
    if (y > 30) {                                                                     // по бокам — зазубрины
      d += Math.max(0, Math.sin(y * 0.55 + hsh(Math.floor(y / 6)) * 4)) * 3.2 * Math.min(1, (y - 30) / 30);
    }
    if (y > 52) {                                                                     // низ распущен на полосы разной длины, между ними — щели
      const xs = x - sway(y, 3) * (y - 52) / 60, i = Math.floor((xs + 200) / 8), fx = ((xs + 200) % 8) / 8;
      const end = tailEnd - 8 - hsh(i * 3.3) * 70;
      if (y > end) d = Math.max(d, (y - end) * 0.8);
      if (fx < 0.16 || fx > 0.94) d = Math.max(d, Math.min(4, (y - 52) * 0.08));
    }
    return d;
  } : rag === 'T2' ? (x, y) => {
    let d = robe0(x, y) + (vn(x + sway(y, 4), y, 7) - 0.45) * 7 + (vn(x * 1.7, y * 1.7, 4) - 0.5) * 3;
    for (let i = 0; i < 6; i++) {                                                     // сквозные дыры в ткани
      const hx = lean * 0.5 + (hsh(i * 7.7) - 0.5) * 44, hy = 42 + hsh(i * 3.9) * 70, r = 3 + hsh(i * 5.1) * 4.5;
      const dh = r - Math.hypot((x - hx) * (1 + (vn(x, y, 3) - 0.5) * 0.6), y - hy);
      if (dh > -2) d = Math.max(d, dh * 1.6);
    }
    return d;
  } : (x, y) => {
    let d = robe0(x, y);
    if (y > 26) {                                                                     // острые клочья по краю
      const ph = (y + sway(y, 6) + hsh(Math.floor(y / 11)) * 5) / 11, tri = Math.abs((ph % 1 + 1) % 1 - 0.5) * 2;
      d += (tri - 0.35) * 7 * Math.min(1, (y - 26) / 24);
    }
    if (y > 70) {                                                                     // подол зубьями
      const ph = (x + sway(y, 5) + 200) / 13, tri = Math.abs((ph % 1 + 1) % 1 - 0.5) * 2;
      d += Math.max(0, (y - 70) / (tailEnd - 70) * 30 * (1 - tri) - 6) * 0.6;
    }
    return d;
  };
  const shreds = [];                                                                  // T3: оторванные лоскуты летят назад; у всех лохмотьев — тряпки с рукавов
  if (rag === 'T3') for (let i = 0; i < 4; i++) {
    const t = 0.25 + i * 0.16, s0 = spine[Math.floor(t * N)], ax = s0[0] - s0[2] + 3, ay = s0[1], len = 18 + hsh(i * 2.3) * 14;
    const pts = []; for (let j = 0; j <= 5; j++) { const u = j / 5; pts.push([ax - u * len, ay + u * len * 0.35 + Math.sin(u * 3 + p * TAU + i) * 4 * u, 4.5 * (1 - u) + 0.6]); }
    shreds.push(...DS_chain(pts, { mat: 'rb', k: 4 }));
  }
  if (rag) for (const A of [AN]) for (let i = 0; i < 3; i++) {
    const t = 0.35 + i * 0.25, sx = A.shx + (A.ex - A.shx) * t, sy = A.shy + (A.ey - A.shy) * t + 6, len = 12 + hsh(i * 4.4 + 1) * 10;
    shreds.push(...DS_chain([[sx, sy, 3.5], [sx - 2 + sway(sy, 2), sy + len * 0.6, 2.2], [sx - 3 + sway(sy + 9, 3), sy + len, 0.8]], { mat: 'rb', k: 3 }));
  }
  const parts = [{ f: robe, mat: 'rb', k: 8 }, ...shreds, ...armParts(AN)];
  if (v === 'R1') {
    parts.push({ f: ell(HX, HY - 2, 23, 25), mat: 'hm', k: 6 }, { f: ell(HX, HY + 16 + drop * 0.6, 17, 13 + drop * 0.5), mat: 'hm', k: 5 });
    parts.push({ f: (x, y) => Math.max(faceF(x, y), HY - 9 - y) - 1, mat: 'void', zone: true });
  } else if (v === 'R2') {
    parts.push({ f: ell(HX, HY - 2, 22, 22), mat: 'bo', k: 6 }, { f: faceF, mat: 'bo', k: 4 });
    parts.push(...DS_chain(CP.cone, { mat: 'cap', k: 3 }));
    parts.push({ f: ell(HX, HY - 12, CP.brim, 9), mat: 'cap', k: 2, front: true, fw: 3 });
    parts.push({ f: (x, y) => Math.max(DS_ell(HX, HY - 15, 26, 40)(x, y), Math.abs(y - HY + 24) - 3), mat: 'band', zone: true });
    for (const [px, py] of CP.patch) parts.push({ f: (x, y) => Math.max(Math.abs(x - px) - 6, Math.abs(y - py) - 5), mat: 'patch', zone: true });
    if (CP.bob) parts.push({ f: ell(CP.bob[0], CP.bob[1], 6, 6), mat: 'band', k: 2, front: true, fw: 3 });
    parts.push({ f: (x, y) => Math.max(faceF(x, y), HY - 5 - y), mat: 'bo', zone: true });
  } else {
    parts.push({ f: ell(HX - 3, HY - 5, 33, 36), mat: 'cap', k: 9 });
    parts.push(...DS_chain([[HX - 8, HY - 30, 15], [HX - 18 + tip * 0.5, HY - 50, 6], [HX - 28 + tip, HY - 62, 1]], { mat: 'cap', k: 5 }));
    parts.push({ f: (x, y) => faceF(x, y) - 4, mat: 'void', zone: true });
  }
  const tex = (x, y, mat, idx, ramp) => {
    const cy = y - HY, cx = x - HX;
    if (mat === 'horn') {                                                             // ход вдоль рога: рёбра поперёк, светлый кончик, у корня — колпак
      let bt = 0, bd = 1e9, bh = null;
      for (const h of HORNS) for (let i = 0; i < h.length; i++) { const d = (x - h[i][0]) ** 2 + (y - h[i][1]) ** 2; if (d < bd) { bd = d; bt = i / (h.length - 1); bh = h; } }
      const len = bh.length, root = bt * len;
      if (v === 'R2' && root < 3.5 && dth(x, y) < 1 - root / 3.5) return CP.fab[Math.min(CP.fab.length - 1, idx)];
      if (Math.floor(bt * 22) % 3 === 0) return ramp[Math.max(0, idx - 1)];
      if (bt > 0.82) return ramp[Math.min(ramp.length - 1, idx + 1)];
      return null;
    }
    if (mat === 'rb') { const w = ((x * 0.22 + Math.sin(y * 0.06 + p * TAU) * 2) % 6 + 6) % 6; return y > 30 && w < 1 ? ramp[Math.max(0, idx - 1)] : null; }
    if (mat === 'cap' && v === 'R2') {
      if (cy > -12 && cy < -2.5 && cy > -6 && hsh(Math.floor(x / 2) * 3.7) > 0.6) return ramp[0];
      if (cy < -26 && (((cx + cy * 0.3 + 60) % 9) + 9) % 9 < 1.2) return ramp[Math.max(0, idx - 1)];
      if (cy < -30 && (((cy + Math.sin(cx * 0.3) * 2.5) % 12) + 12) % 12 > 10.5) return ramp[Math.min(ramp.length - 1, idx + 1)];
    }
    if (mat === 'cap' && v === 'R3') { const d = faceF(x, y); if (d > 0 && d < 6 && hsh(Math.floor(x / 2) + y * 0.3) > 0.55) return ramp[0]; }
    if (mat === 'band') return Math.round(cy + 24) === 0 && ((x + 60) % 5) < 2 ? BO[2] : null;
    if (mat === 'patch') { const [px, py] = CP.patch.reduce((a, q) => Math.hypot(x - q[0], y - q[1]) < Math.hypot(x - a[0], y - a[1]) ? q : a), ex = Math.abs(x - px), ey = Math.abs(y - py); return ex > 5 || ey > 4 ? (((x + y) & 1) ? BO[3] : ramp[0]) : null; }
    if (mat === 'hm') {                                                                // шлем: заклёпки по ободу
      if (Math.abs(cy + 8) < 1 && Math.abs(cx) > 12 && Math.abs(cx) < 20 && (x & 3) === 0) return RPX.IR[3];
    }
    return null;
  };
  for (const h of HORNS) parts.push(...DS_chain(h, { mat: 'horn', k: 3, front: true, fw: 2, W: 4 }));
  DS_body(K, parts, { rb: RB, bo: BO, cap: CP.fab, band: CP.band, patch: RPX.PATCH, hm: RPX.HM, void: VO, horn: RPX.HORN }, { bb: [-120, -128, 121, 179], W: 10, k: 6, amb: 0.14, mat: 'rb', cut, tex });

  // ---- череп в прорези шлема (R1) или в глубине капюшона (R3)
  if (v !== 'R2') DS_body(K, [{ f: ell(FX, FY - 4, 15, 13), mat: 'bo' }, { f: faceF, mat: 'bo', k: 4 }],
    { bo: BO.slice(0, 4) }, { bb: [-50, -50, 50, 60], W: 6, k: 4, amb: 0.1, mat: 'bo' });
  // кромка лица
  R(FX - 22, HY - 8, FX + 22, FY + 32 + drop, (x, y) => { const d = faceF(x, y); return d > -1.2 && d <= 0 && y > HY - 6 ? BO[0] : null; });

  // ---- лицо: глазницы, ледяные (в гневе — красные) огоньки, провал носа, пасть
  for (const e of [-1, 1]) {
    const cx = FX + e * 7.5, cy = FY - 2, ys = boo ? 1.3 : 1;
    const pl = [[-4, -1.5], [5.5, -5], [5.5, 2.5], [0.5, 4], [-4, 2.5]].map(([u, y]) => [cx + e * u, cy + y * ys]);
    R(cx - 8, cy - 8, cx + 8, cy + 8, (x, y) => {
      if (DS_pip(x + 0.5, y + 0.5, pl)) return VO[0];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (DS_pip(x + dx + 0.5, y + dy + 0.5, pl)) return BO[1];
      return null;
    });
    const ex = cx + e * 0.5 + sn(1, 0.4), ey = cy + 0.3, cr = boo ? 3 : 2.2;
    R(ex - 10, ey - 10, ex + 10, ey + 10, (x, y) => { const d = Math.hypot(x - ex, y - ey); return d > cr + 0.5 && d < 9 && dth(x, y) < (1 - d / 9) * 0.9 ? [...eye[0], 0.55] : null; }, false);
    R(ex - 4, ey - 4, ex + 4, ey + 4, (x, y) => { const d = Math.hypot(x - ex, y - ey); return d < 1.2 ? eye[1] : d < cr ? eye[0] : null; });
  }
  for (const [x, y] of [[0, 4], [-1, 5], [0, 5], [1, 5], [-1, 6], [1, 6], [-2, 7], [2, 7]]) P(FX + x, FY + y, VO[0]);
  const MY = FY + 11, mh = 2 + open * 15, mrx = 9 + open * 2;
  R(FX - mrx - 1, MY - 1, FX + mrx + 1, MY + mh + 2, (x, y) => {
    const dx = (x - FX) / mrx, dy = (y - MY) / mh, d = dx * dx + dy * dy;
    if (y < MY || d > 1) return y >= MY && d < 1.45 && faceF(x, y) < -1 ? BO[0] : null;
    const ix = Math.round(x - FX + 30), up = y - MY, dn = MY + mh * Math.sqrt(Math.max(0, 1 - dx * dx)) - y;
    if (Math.abs(dx) < 0.88) {
      if (up < (boo ? 4 : 2.5) && ix % 2 === 0) return BO[up < 1 ? 4 : 3];
      if (open > 0.4 && dn < 2.5 && ix % 2 === 1) return BO[3];
    }
    return open > 0.5 && dy > 0.55 && Math.abs(dx) < 0.5 ? [90, 10, 8] : VO[0];
  });

  // ---- ближняя кисть на древке; в ударе коса впереди всего
  if (atk) scythe();
  claw(AN, 1, false, true);
  // ---- холодная дымка вокруг хвоста
  for (let n = 0; n < 40; n++) {
    const t = 0.4 + hsh(n * 3.1) * 0.7, s = spine[Math.min(N, Math.floor(t * N))];
    const x = s[0] + (hsh(n * 5.7) - 0.5) * (s[2] * 2 + 20) + sn(1, n) * 3, y = s[1] + hsh(n * 7.9) * 12, a = (0.7 - (t - 0.4) * 0.6) * (0.5 + hsh(n) * 0.5);
    P(x, y, RB[hsh(n * 2.3) > 0.6 ? 5 : 4], a, false);
  }
  K.outline(RPX.EDGE);
  return K.done();
}
// Кадры: всё по 12 (10 к/с, как у призраков) — парение, гнев, взмах косой, гибель; рана — одна вспышка. hv — форма рогов 0..2.
const RPX_N = { idle: 12, boo: 12, atk: 12, hurt: 1, die: 12 };
let RPX_RAG = null;      // ряса по умолчанию (лист); в игре у каждого жнеца свои лохмотья — g.rag: 'T1' полосы или 'T2' рваньё (выбор владельца)
function reaperPxSprite(v, mood, f, n = RPX_N[mood], hv = 0, rag = RPX_RAG) {
  f = Math.max(0, Math.min(n - 1, f | 0));
  return fzPxSprite('rp' + v + mood + f + '_' + n + 'h' + hv + (rag || ''), 81, 103, 40, 43, () => mood === 'die' ? reaperPxDie(v, (f + 1) / n, hv, rag)
    : reaperPx(v, mood, mood === 'atk' ? 0 : f / n, mood === 'atk' ? f / (n - 1) : 0, hv, rag));
}
// кадр для игры по бюджету новых спрайтов (как ghostPxFrame)
const RPX_LAST = new WeakMap();
function reaperPxFrame(g, v, mood, f, hv, rag = RPX_RAG) {
  f = Math.max(0, Math.min(RPX_N[mood] - 1, f | 0));
  const have = FZ_CVC['rp' + v + mood + f + '_' + RPX_N[mood] + 'h' + hv + (rag || '')], last = RPX_LAST.get(g);
  if (have) { RPX_LAST.set(g, have); return have; }
  if (last && typeof spriteBudgetOk === 'function' && !spriteBudgetOk(true)) return last;
  const t0 = performance.now(), cv = reaperPxSprite(v, mood, f, RPX_N[mood], hv, rag);
  if (typeof spriteSpent === 'function') spriteSpent(t0);
  RPX_LAST.set(g, cv);
  return cv;
}

// Гибель жнеца: ряса осыпается чёрным пеплом снизу вверх, коса падает, рога и колпак держатся дольше, огоньки глаз гаснут последними; t — 0..1
function reaperPxDie(v, t, hv, rag) {
  const { RB } = RPX, MI = [RB[1], RB[2], RB[3], RB[4], RB[5]], lift = t * t * 26, wv = y => Math.sin(y * 0.08 + t * 8) * t * 7;
  return fzPxDie(() => reaperPx(v, 'idle', 0, 0, hv, rag), 243, 309, 120, 129, t, {
    map: (x, y) => [x + wv(y), y + lift],
    s: (x, y) => fzCl((176 - y) / 300),
    mat: (c, x, y, val) => fzRamp(MI, c, Math.max(0.2, 0.7 - Math.max(0, val) * 1.2)),
    edge: RPX.EDGE,
    fx(K) {
      const { R, dth } = K, fy = Math.max(-110, 176 - t * 1.3 * 300);
      for (let j = 0; j < 34; j++) {
        if (fzH(j * 2.1) > t * 1.1) continue;
        const cx = (fzH(j * 3.7) - 0.5) * (70 + t * 100), cy = fy + fzH(j * 5.9) * (176 - fy) - t * 50 - lift * 0.5, r = 7 + fzH(j * 7.3) * 9 + t * 8;
        R(cx - r * 1.6, cy - r, cx + r * 1.6, cy + r, (x, y) => { const d = Math.hypot((x - cx) / 1.6, (y - cy) * 1.4) / r; return d < 1 && dth(x, y) < (1 - d) * (1 - d) * 0.7 * (1.2 - t * 0.5) ? [...(d < 0.35 ? RB[3] : RB[2]), 0.4] : null; }, false);
      }
      const a = 1 - Math.max(0, t - 0.6) * 1.6, E = RPX.EYE.idle;
      for (const s of [-1, 1]) {
        const ey = 3 - lift, ex = s * 8 - wv(ey);
        R(ex - 4, ey - 4, ex + 4, ey + 4, (x, y) => { const d = Math.hypot(x - ex, y - ey); return d < 1.2 ? [...E[1], a] : d < 2.8 ? [...E[0], a * 0.7] : null; }, false);
      }
    },
  });
}
