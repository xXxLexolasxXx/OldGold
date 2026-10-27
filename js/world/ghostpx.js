'use strict';
// Призрак-гном в пиксель-арте методом Полудницы (fzNoonPx в fairy2.js) и легендарного дракона (DS_body в pxbeasts.js):
// сетка ×3 мельче мирового (мир 60×76 → сетка 180×228, начало — центр головы, как у векторного призрака GHOST_OX/OY),
// растеризатор fzPxKit, рампы палитры, дизеринг Байера, слои сзади вперёд, обводка в конце. Саван, плечи, ближняя рука,
// голова и колпак — ОДНА форма: поля расстояний слиты сглаженным минимумом, свет по общей нормали, без швов.
// Дальняя рука — своя форма позади, потемнее. Хвост рассыпается Байером в дымку.
// Три облика на выбор (лист tools/pxghost/sheet.html):
//   A — «колпак»: гном-мертвец в остром колпаке, череп, борода из тумана, большие когтистые лапы;
//   B — «дед»: старый гном с носом-картошкой, бородой-туманом до пояса и обрывком цепи на запястье, глаза — тлеющие провалы;
//   C — «саван»: глубокий капюшон, череп в тени, сквозь рваный саван видны рёбра, длинные когти.
// mood: 'idle' | 'boo' | 'calm' | 'atk' | 'hurt' | 'flee'; p — фаза парения 0..1 (петля); k — ход удара 0..1
// (замах 0–.35, бросок .35–.6, отдача). Подключается после pxbeasts.js.
// Владелец выбрал A и B вперемешку: каждому призраку облик достаётся при рождении (ghInit, g.look), C пока не в игре.
// Захват гнома (grab) по-прежнему рисуется векторным призраком ghosts.js.

const GHOST_PX = ['A', 'B'];
const GPX = {
  SH: [[14, 38, 48], [28, 64, 74], [50, 100, 106], [84, 144, 142], [128, 190, 178], [180, 228, 212], [226, 250, 240]],
  BO: [[56, 70, 68], [98, 116, 110], [148, 166, 158], [194, 210, 200], [232, 244, 236]],
  CAP: [[12, 26, 36], [24, 46, 58], [40, 72, 84], [64, 104, 112], [96, 142, 146]],
  VO: [[3, 12, 16], [9, 26, 32], [18, 40, 46]],
  IR: [[36, 46, 52], [80, 94, 100], [136, 152, 156]],
  CL: [[8, 16, 18], [30, 42, 42], [66, 80, 76]],
  EYE: { idle: [[80, 226, 170], [214, 255, 236]], boo: [[255, 60, 30], [255, 214, 170]], calm: [[120, 200, 255], [226, 246, 255]] },
  BAND: [[8, 16, 22], [18, 32, 40], [32, 52, 60], [52, 78, 84]],
  PATCH: [[20, 30, 30], [34, 50, 48], [52, 74, 68], [76, 102, 92]],
  BRD: [[70, 124, 124], [118, 176, 166], [172, 222, 206], [218, 246, 236], [244, 255, 250]],
  EDGE: [6, 22, 28],
};

function ghostPx(v, mood, p = 0, k = 0, o = {}) {
  const K = fzPxKit(180, 228, 90, 96), { P, R, L, dth, hsh } = K, TAU = Math.PI * 2, { SH, BO, CAP, VO, IR, CL } = GPX;
  const atk = mood === 'atk', boo = mood === 'boo' || atk, calm = mood === 'calm', flee = mood === 'flee', hurt = mood === 'hurt';
  const sn = (m, o = 0) => Math.sin(p * TAU * m + o), sm = x => x * x * (3 - 2 * x);
  const wind = atk ? sm(Math.min(1, k / 0.35)) : 0, strike = atk ? sm(Math.max(0, Math.min(1, (k - 0.35) / 0.25))) : 0, recoil = atk ? sm(Math.max(0, (k - 0.6) / 0.4)) : 0;
  const lean = atk ? (-9 * wind + 27 * strike) * (1 - recoil) : flee ? 14 : hurt ? -12 : 0;
  const HX = lean * 0.7, HY = (atk ? 4.5 * strike - 3 * wind : hurt ? -3 : 0) + sn(1, 0.8) * 1.2;
  const eye = GPX.EYE[boo ? 'boo' : calm ? 'calm' : 'idle'];
  // раскрытие рта 0..1: челюсть отпадает вниз, овал лица вытягивается, рот не выходит за подбородок
  const open = o.open ?? (atk ? Math.max(wind * 0.4, strike) * (1 - recoil * 0.6) : boo ? 0.85 + 0.15 * sn(2) : hurt ? 0.35 : calm ? 0 : 0.1 + 0.06 * sn(2));
  const drop = open * 7, FX = HX + (v === 'C' ? 2 : 0), FY = HY + 3, FRX = v === 'B' ? 14 : 14;
  // овал лица: лоб под полями колпака (FY − 13), подбородок FY + 19 + drop, книзу сужается
  const faceF = (x, y) => {
    const dy = (y - FY) / (y > FY ? 19 + drop : 13), dx = (x - FX) / (FRX * (1 - Math.max(0, dy) * 0.24));
    return (Math.hypot(dx, dy) - 1) * 12;
  };
  const ell = (cx, cy, rx, ry) => DS_ell(cx, cy, rx, ry), cap = DS_cap;

  // ---- ось савана: плечи → S-хвост; при бегстве хвост вытягивается назад
  const tailLen = 110 - 18 * strike + (flee ? 8 : 0), N = 12, spine = [];
  for (let n = 0; n <= N; n++) {
    const t = n / N, y = 14 + t * tailLen * (flee ? 0.8 : 1);
    const cx = lean * (1 - t) * 0.9 + sn(1, -t * 5.2) * (3 + t * 20) - strike * t * 18 - (flee ? t * t * 46 : 0);
    spine.push([cx, y, (v === 'C' ? 28 : 25) * Math.pow(1 - t, 0.8) + 1.5]);
  }
  const tailEnd = spine[N][1];
  const cut = (x, y) => {                                                             // хвост и низ савана тают: чем ниже, тем больше «выеденных» крупинок
    if (y < 46) return false;
    const q = Math.pow((y - 46) / (tailEnd - 46), 1.3) * 1.15;
    return dth(x, y) * 0.55 + hsh(x * 7.31 + y * 3.17) * 0.45 < q;
  };
  const folds = (x, y, mat, idx, ramp) => {                                           // складки савана — вертикальные тени, волной; пряди бороды деда
    if (mat === 'brd') return ((x * 0.5 + Math.sin(y * 0.11 + p * TAU) * 1.2) % 3 + 3) % 3 < 0.8 ? ramp[Math.max(0, idx - 2)] : null;
    if (mat === 'cap') {                                                              // колпак: складки по конусу, мятые кольца, потрёпанный край полей, у капюшона — бахрома
      const cy = y - HY, cx = x - HX;
      if (cy > -9 && cy < -2 && hsh(Math.floor(x / 2) * 3.7) > 0.62 && (v !== 'C') && cy > -4.5) return ramp[0];
      if (v === 'C') { const d = faceF(x, y); return d > 0 && d < 5 && hsh(Math.floor(x / 2) + y * 0.3) > 0.55 ? ramp[0] : (((cx * 0.3 + cy * 0.12) % 4 + 4) % 4 < 0.7 ? ramp[Math.max(0, idx - 1)] : null); }
      if (cy < -19 && (((cx + cy * 0.3 + 40) % 8) + 8) % 8 < 1.2) return ramp[Math.max(0, idx - 1)];
      if (cy < -22 && (((cy + Math.sin(cx * 0.35) * 2.2) % 10) + 10) % 10 < 1) return ramp[Math.max(0, idx - 2)];
      if (cy < -22 && (((cy + Math.sin(cx * 0.35) * 2.2) % 10) + 10) % 10 > 8.6) return ramp[Math.min(ramp.length - 1, idx + 1)];
      return null;
    }
    if (mat === 'band') return Math.round(y - HY + (v === 'B' ? 19 : 20)) === 0 && ((x + 40) % 4) < 2 ? GPX.BO[2] : null;   // стежки по ленте
    if (mat === 'patch') { const ex = Math.abs(x - (v === 'B' ? HX + 7 : HX - 5 + tip * 0.15)), ey = Math.abs(y - HY + (v === 'B' ? 28 : 31)); return (ex > 3.5 || ey > 3) ? (((x + y) & 1) ? GPX.BO[3] : ramp[0]) : null; }
    if (mat !== 'sh') return null;
    const w = ((x * 0.26 + Math.sin(y * 0.07 + p * TAU) * 1.6) % 5 + 5) % 5;
    return y > 24 && w < 0.9 ? ramp[Math.max(0, idx - 1)] : null;
  };

  // ---- руки: плечо → локоть → кисть
  const arm = s => {
    const shx = lean * 0.5 + s * 20, shy = 15;
    let hx, hy;
    if (atk) {
      const wx = s * 21 - 9, wy = -63, sx = 63 - s * 6, sy = 33 - s * 9, rx = s * 33, ry = 18, lift = Math.max(wind, 0.15);
      hx = (wx + (sx - wx) * strike) * (1 - recoil) + rx * recoil; hy = (wy + (sy - wy) * strike) * (1 - recoil) + ry * recoil;
      hx = shx + (hx - shx) * lift; hy = shy + (hy - shy) * lift;
    } else if (boo) { hx = s * 40 + sn(1, s) * 3; hy = -40 + sn(2, s) * 4; }
    else if (calm) { hx = s * 14 + 4; hy = 40 + sn(1, s) * 2; }
    else if (flee) { hx = s * 14 - 34; hy = 34 + s * 5 + sn(2, s) * 3; }
    else if (hurt) { hx = s * 30 - 12; hy = -10 + s * 4; }
    else { hx = s * 42 + sn(1, s) * 5; hy = 10 + sn(2, s * 1.3) * 8; }
    const ex = (shx + hx) / 2 + s * 8, ey = (shy + hy) / 2 + 13 + sn(1, s * 2) * 3;
    return { shx, shy, ex, ey, hx, hy, dir: Math.atan2(hy - ey, hx - ex) };
  };
  const AF = arm(-1), AN = arm(1);
  const armParts = (A, mats) => [
    { f: cap(A.shx, A.shy, A.ex, A.ey, 9, 6), mat: mats[0], k: 6 },
    { f: cap(A.ex, A.ey, A.hx, A.hy, 5.5, 3.4), mat: mats[1], k: 4 },
  ];

  // ---- кисть: ладонь, четыре пальца веером и большой, длинные загнутые когти
  const claw = (A, s, far) => {
    const B = far ? BO.slice(0, 4) : BO, { hx, hy, dir } = A, long = v === 'C' ? 1.35 : 1;
    R(hx - 7, hy - 7, hx + 7, hy + 7, (x, y) => { const d = (x - hx) ** 2 + (y - hy) ** 2; return d <= 24 ? (d > 15 ? B[1] : B[2]) : null; });
    for (const j of [-1.5, -0.5, 0.5, 1.5, -3.1]) {
      const th = j < -2, a = dir + j * (th ? 0.45 : 0.3) * s, a2 = a + 0.28 * s;
      const l1 = th ? 6 : Math.abs(j) > 1 ? 8 : 10, l2 = th ? 4 : Math.abs(j) > 1 ? 6 : 7;
      const bx = hx + Math.cos(a) * 4, by = hy + Math.sin(a) * 4, x1 = bx + Math.cos(a) * l1, y1 = by + Math.sin(a) * l1, x2 = x1 + Math.cos(a2) * l2, y2 = y1 + Math.sin(a2) * l2;
      L(bx, by, x1, y1, 1.8, 1.4, (t, e) => e ? B[1] : B[far ? 2 : 3]);
      P(x1, y1, B[0]);
      L(x1, y1, x2, y2, 1.4, 1.1, (t, e) => e ? B[1] : B[2]);
      const a3 = a2 + 0.5 * s, cl = (th ? 6 : 11) * long;
      L(x2, y2, x2 + Math.cos(a3) * cl, y2 + Math.sin(a3) * cl, 1.5, 0.2, (t, e) => t > 0.72 || e ? CL[0] : t < 0.35 ? CL[2] : CL[1]);
    }
  };

  // ---- дальняя рука: своя форма позади тела, в тени
  DS_body(K, armParts(AF, ['sh', 'bo']), { sh: SH.slice(0, 5), bo: BO.slice(0, 4) }, { bb: [-88, -92, 87, 126], W: 5, k: 5, amb: 0.15, mat: 'sh' });
  claw(AF, -1, true);

  // ---- одна форма: саван, плечи, ближняя рука, голова, колпак / капюшон, борода
  // саван: гладкий или лохмотья (o.rag, у каждого призрака свой — g.rag): T1 полосы, T2 рваньё с дырами; лист tools/pxghost/ghostrags.html
  const caps0 = DS_chain(spine).map(q => q.f), sho = ell(lean * 0.6, 17, 30, 14);
  const shroud0 = (x, y) => { let u = sho(x, y); for (const f of caps0) u = DS_smin(u, f(x, y), 7); return u; };
  const vn = (x, y, sc) => {
    const gx = x / sc, gy = y / sc, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy, h = (a, b) => hsh(a * 57.1 + b * 13.7);
    const u = fx * fx * (3 - 2 * fx), w = fy * fy * (3 - 2 * fy);
    return (h(ix, iy) * (1 - u) + h(ix + 1, iy) * u) * (1 - w) + (h(ix, iy + 1) * (1 - u) + h(ix + 1, iy + 1) * u) * w;
  };
  const sway = (y, a) => Math.sin(y * 0.11 + p * TAU) * a;
  const shroud = o.rag === 'T1' ? (x, y) => {
    let d = shroud0(x, y);
    if (y > 24) d += Math.max(0, Math.sin(y * 0.6 + hsh(Math.floor(y / 5)) * 4)) * 2.6 * Math.min(1, (y - 24) / 24);
    if (y > 52) {
      const xs = x - sway(y, 2.5) * (y - 52) / 50, i = Math.floor((xs + 200) / 6.5), fx = ((xs + 200) % 6.5) / 6.5;
      const end = tailEnd - 4 - hsh(i * 3.3) * 26;                                  // низ выгрызен неглубоко
      if (y > end) d = Math.max(d, (y - end) * 0.8);
      if (fx < 0.14 || fx > 0.95) d = Math.max(d, Math.min(2.5, (y - 52) * 0.08));
    }
    return d;
  } : o.rag === 'T2' ? (x, y) => {
    let d = shroud0(x, y) + (vn(x + sway(y, 3), y, 6) - 0.45) * 6 + (vn(x * 1.7, y * 1.7, 3.5) - 0.5) * 2.5;
    for (let i = 0; i < 5; i++) {
      const hx = lean * 0.5 + (hsh(i * 7.7 + 1) - 0.5) * 34, hy = 32 + hsh(i * 3.9 + 2) * 52, r = 1.6 + hsh(i * 5.1) * 2.2;                                                                        // дыры небольшие
      const dh = r - Math.hypot((x - hx) * (1 + (vn(x, y, 3) - 0.5) * 0.6), y - hy);
      if (dh > -2) d = Math.max(d, dh * 1.6);
    }
    return d;
  } : shroud0;
  const parts = [
    { f: shroud, mat: 'sh', k: 7 },
    ...armParts(AN, ['sh', 'bo']),
  ];
  const tip = sn(1, 0.6) * 6 + lean * 0.4;
  if (v === 'A') {
    parts.push({ f: ell(HX, HY - 2, 18, 19), mat: 'bo', k: 6 }, { f: faceF, mat: 'bo', k: 4 });
    parts.push(...DS_chain([[HX, HY - 13, 19], [HX - 4 + tip * 0.3, HY - 38, 10], [HX - 14 + tip, HY - 60, 4], [HX - 26 + tip * 1.5, HY - 70, 1]], { mat: 'cap', k: 3 }));
    parts.push({ f: ell(HX, HY - 10, 23, 7), mat: 'cap', k: 2, front: true, fw: 3 });
    parts.push({ f: (x, y) => Math.max(DS_ell(HX, HY - 13, 19, 30)(x, y), Math.abs(y - HY + 20) - 2.5), mat: 'band', zone: true });
    parts.push({ f: (x, y) => Math.max(Math.abs(x - HX + 5 - tip * 0.15) - 4.5, Math.abs(y - HY + 31) - 4), mat: 'patch', zone: true });
    parts.push({ f: (x, y) => Math.max(faceF(x, y), HY - 4 - y), mat: 'bo', zone: true });
    for (const e of [-1, 1]) parts.push({ f: ell(FX + e * 10, FY + 7 + drop * 0.3, 2.5, 5), mat: 'hol', zone: true });
  } else if (v === 'B') {
    // борода обрамляет лицо: бакенбарды от висков, огибает щёки и подбородок, ниже — волной до пояса; само лицо открыто
    const bw = sn(1, 1.3) * 4 - strike * 9;
    parts.push({ f: ell(HX, HY - 1, 19, 18), mat: 'bo', k: 6 });
    parts.push(...DS_chain([[HX, HY - 11, 20], [HX + 2, HY - 33, 11], [HX + 15 + tip, HY - 45, 5], [HX + 28 + tip, HY - 36, 2]], { mat: 'cap', k: 3 }));
    parts.push({ f: (x, y) => Math.max(ell(FX, FY + 12 + drop * 0.6, 18, 22 + drop * 0.6)(x, y), FY - 3 - y), mat: 'brd', k: 4, front: true, fw: 5, W: 6 });
    parts.push(...DS_chain([[FX, FY + 27 + drop, 14], [FX + 2 + bw * 0.5, FY + 44, 10], [FX - 1 + bw, FY + 60, 5], [FX - 4 + bw * 1.6, FY + 72, 1]], { mat: 'brd', k: 6, front: true, fw: 5, W: 6 }));
    parts.push({ f: ell(HX, HY - 9, 23, 7), mat: 'cap', k: 2, front: true, fw: 3 });
    parts.push({ f: (x, y) => Math.max(DS_ell(HX, HY - 12, 20, 30)(x, y), Math.abs(y - HY + 19) - 2.5), mat: 'band', zone: true });
    parts.push({ f: (x, y) => Math.max(Math.abs(x - HX - 7) - 4.5, Math.abs(y - HY + 28) - 4), mat: 'patch', zone: true });
    parts.push({ f: (x, y) => Math.max(faceF(x, y), HY - 4 - y), mat: 'bo', zone: true });
    parts.push({ f: ell(FX + 2, FY + 5, 4.5, 4), mat: 'nose', zone: true });
  } else {
    parts.push({ f: ell(HX - 3, HY - 4, 26, 28), mat: 'cap', k: 8 });
    parts.push(...DS_chain([[HX - 6, HY - 24, 12], [HX - 14 + tip * 0.5, HY - 40, 5], [HX - 22 + tip, HY - 50, 1]], { mat: 'cap', k: 4 }));
    parts.push({ f: (x, y) => faceF(x, y) - 3, mat: 'void', zone: true });
    parts.push({ f: ell(lean * 0.5, 36, 13, 17), mat: 'void', zone: true });
  }
  const body = DS_body(K, parts, { sh: SH, bo: BO, hol: BO.slice(0, 3), cap: CAP, band: GPX.BAND, patch: GPX.PATCH, brd: GPX.BRD, nose: BO, void: VO }, {
    bb: [-88, -92, 87, 126], W: 9, k: 6, amb: 0.22, mat: 'sh', cut, tex: folds,
    light: hurt ? () => 0.3 : undefined,
  });

  // ---- череп в глубине капюшона (C): отдельная форма, в тени
  if (v === 'C') DS_body(K, [{ f: ell(FX, FY - 4, 13, 12), mat: 'bo' }, { f: faceF, mat: 'bo', k: 4 },
    ...[-1, 1].map(e => ({ f: ell(FX + e * 10, FY + 7 + drop * 0.3, 2.5, 5), mat: 'hol', zone: true }))], { bo: BO.slice(0, 4), hol: BO.slice(0, 2) }, { bb: [-40, -40, 40, 50], W: 6, k: 4, amb: 0.1, mat: 'bo', light: hurt ? () => 0.3 : undefined });

  // ---- борода из тумана (A): пряди растут по линии челюсти — от висков вокруг подбородка, лицо не закрывают
  if (v === 'A') for (let b = -3; b <= 3; b++) {
    const th = Math.PI / 2 + b * 0.3, a = 0.85 - Math.abs(b) * 0.07;
    const x0 = FX + Math.cos(th) * (FRX * (1 - 0.24 * Math.max(0, Math.sin(th))) + 1), y0 = FY + Math.sin(th) * (19 + drop + 1);
    const x1 = x0 + Math.cos(th) * 5 + sn(1, b * 0.9) * 3, y1 = y0 + 14, x2 = x0 + Math.cos(th) * 8 + sn(2, b * 1.3) * 7 - strike * 9, y2 = y0 + 26 + (4 - Math.abs(b)) * 4;
    const pts = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8, u = 1 - t; pts.push([u * u * x0 + 2 * u * t * x1 + t * t * x2, u * u * y0 + 2 * u * t * y1 + t * t * y2, 2.2 - t * 1.4]); }
    K.path(pts, (t, e) => e ? [...SH[4], a * 0.7] : [...SH[t < 0.5 ? 6 : 5], a * (1 - t * 0.5)], false);
  }

  // ---- кромка овала лица: отделяет лицо от бороды и савана; у деда — контур носа снизу
  if (v !== 'C') R(FX - 18, HY - 4, FX + 18, FY + 26 + drop, (x, y) => { const d = faceF(x, y); return d > -1.2 && d <= 0 && y > HY - 4 ? BO[0] : null; });
  if (v === 'B') R(FX - 4, FY + 5, FX + 8, FY + 10, (x, y) => { const d = ((x - FX - 2) / 4.5) ** 2 + ((y - FY - 5) / 4) ** 2; return d > 0.62 && d <= 1.05 && y > FY + 5 ? BO[0] : null; });

  // ---- лицо: злые глазницы под полями колпака, тлеющие зрачки, провал носа, рот внутри овала
  const gz = sn(1, 0.4) * 1;
  for (const e of [-1, 1]) {
    const cx = FX + e * 6.5, cy = FY - 1, ys = boo ? 1.3 : 1;
    const loc = hurt ? [[-3.5, 0], [4.5, -1.5], [4.5, 0.5], [-3.5, 1]]
      : calm ? [[-3.5, -1], [4, -1.5], [4, 1.5], [-3.5, 1.5]]
      : [[-3.5, -1.5], [4.5, -4], [4.5, 2], [0.5, 3.5], [-3.5, 2]];
    const pl = loc.map(([u, y]) => [cx + e * u, cy + y * ys]);
    R(cx - 7, cy - 7, cx + 7, cy + 7, (x, y) => {
      if (DS_pip(x + 0.5, y + 0.5, pl)) return VO[0];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (DS_pip(x + dx + 0.5, y + dy + 0.5, pl)) return BO[1];
      return null;
    });
    if (hurt) continue;                                                               // от боли зажмурился: огоньки гаснут
    const ex = cx + e * 0.5 + gz, ey = cy + (calm ? 0 : 0.3), cr = boo ? 2.6 : calm ? 1.2 : 1.9;
    R(ex - 8, ey - 8, ex + 8, ey + 8, (x, y) => { const d = Math.hypot(x - ex, y - ey); return d > cr + 0.5 && d < 7 && dth(x, y) < (1 - d / 7) * 0.9 ? [...eye[0], 0.5] : null; }, false);
    R(ex - 3, ey - 3, ex + 3, ey + 3, (x, y) => { const d = Math.hypot(x - ex, y - ey); return d < 1 ? eye[1] : d < cr ? eye[0] : null; });
  }
  if (v === 'B') for (const [x, y] of [[0, 8], [1, 8], [4, 8], [5, 8]]) P(FX + x, FY + y, BO[0]);                 // ноздри деда
  else for (const [x, y] of [[0, 3], [-1, 4], [0, 4], [1, 4], [-1, 5], [1, 5]]) P(FX + x, FY + y, VO[0]);   // провал носа
  // рот: верхняя кромка неподвижна, нижняя уходит вниз вместе с челюстью
  const MY = FY + (v === 'B' ? 11 : 9), mh = 1.5 + open * 12, mrx = (v === 'B' ? 5.5 : 7) + open * 1.5;
  R(FX - mrx - 1, MY - 1, FX + mrx + 1, MY + mh + 2, (x, y) => {
    const dx = (x - FX) / mrx, dy = (y - MY) / mh, d = dx * dx + dy * dy;
    if (y < MY || d > 1) return y >= MY && d < 1.45 && faceF(x, y) < -1 ? BO[0] : null;
    const ix = Math.round(x - FX + 20), up = y - MY, dn = MY + mh * Math.sqrt(Math.max(0, 1 - dx * dx)) - y;
    if (v !== 'B' && Math.abs(dx) < 0.85) {
      if (up < (boo ? 3 : 2) && ix % 2 === 0) return BO[up < 1 ? 4 : 3];                // верхние зубы
      if (open > 0.4 && dn < 2 && ix % 2 === 1) return BO[3];                          // нижние
    }
    return open > 0.5 && dy > 0.55 && Math.abs(dx) < 0.5 ? [80, 14, 10] : VO[0];
  });

  // ---- рёбра сквозь рваный саван (C)
  if (v === 'C') {
    const cx = lean * 0.5;
    for (let r = 0; r < 4; r++) {
      const y = 25 + r * 7, w = 11 - r * 1.2;
      K.path([[cx - w, y, 1.3], [cx - w * 0.5, y + 4, 1.4], [cx, y + 5, 1.2], [cx + w * 0.5, y + 4, 1.4], [cx + w, y, 1.3]], (t, e) => e ? BO[1] : BO[3]);
    }
    for (let y = 22; y < 52; y += 3) P(cx, y, BO[2]), P(cx, y + 1, BO[1]);
  }
  // ---- ближняя кисть, у деда — обрывок цепи на запястье
  claw(AN, 1, false);
  if (v === 'B') {
    const wx = AN.ex + (AN.hx - AN.ex) * 0.72, wy = AN.ey + (AN.hy - AN.ey) * 0.72;
    R(wx - 6, wy - 6, wx + 6, wy + 6, (x, y) => { const d = Math.hypot((x - wx) / 1.2, y - wy); return d > 3 && d < 5.2 ? (y < wy ? IR[2] : IR[1]) : null; });
    for (let l = 0; l < 3; l++) {
      const lx = wx - 2 + sn(2, l) * 2 + l * 0.8, ly = wy + 7 + l * 6, rot = l % 2;
      R(lx - 4, ly - 5, lx + 4, ly + 5, (x, y) => { const d = rot ? Math.hypot((x - lx) / 1.6, (y - ly) / 3.4) : Math.hypot((x - lx) / 3, (y - ly) / 3.6); return d > 0.62 && d < 1 ? (x < lx ? IR[2] : IR[1]) : null; });
    }
  }
  // ---- крупинки ушедшей дымки: парят под хвостом и вокруг, холодные искры
  for (let n = 0; n < 34; n++) {
    const t = 0.4 + hsh(n * 3.1) * 0.7, s = spine[Math.min(N, Math.floor(t * N))];
    const x = s[0] + (hsh(n * 5.7) - 0.5) * (s[2] * 2 + 16) + sn(1, n) * 3 - (flee ? t * 20 : 0), y = s[1] + hsh(n * 7.9) * 10;
    const a = (0.75 - (t - 0.4) * 0.7) * (0.5 + hsh(n) * 0.5);
    P(x, y, SH[hsh(n * 2.3) > 0.6 ? 6 : 5], a, false);
    if (hsh(n * 9.1) > 0.7) P(x + 1, y, SH[4], a * 0.6, false);
  }
  K.outline(GPX.EDGE);
  return K.done();
}

// Гибель: саван тает снизу вверх и поднимается холодным туманом, огоньки глаз гаснут последними; t — 0..1
function ghostPxDie(v, t, rag) {
  const { SH } = GPX, MI = [SH[2], SH[3], SH[4], SH[5], SH[6]], lift = t * t * 30, wv = y => Math.sin(y * 0.09 + t * 9) * t * 6;
  return fzPxDie(() => ghostPx(v, 'idle', 0, 0, { rag }), 180, 228, 90, 96, t, {
    map: (x, y) => [x + wv(y), y + lift],
    s: (x, y) => fzCl((126 - y) / 220),
    mat: (c, x, y, val) => fzRamp(MI, c, Math.max(0.15, 0.6 - Math.max(0, val) * 1.2)),
    edge: GPX.EDGE,
    fx(K) {
      const { R, dth } = K, fy = Math.max(-80, 126 - t * 1.3 * 220);
      for (let j = 0; j < 28; j++) {
        if (fzH(j * 2.1) > t * 1.1) continue;
        const cx = (fzH(j * 3.7) - 0.5) * (50 + t * 80), cy = fy + fzH(j * 5.9) * (126 - fy) - t * 40 - lift * 0.5, r = 6 + fzH(j * 7.3) * 8 + t * 7;
        R(cx - r * 1.6, cy - r, cx + r * 1.6, cy + r, (x, y) => { const d = Math.hypot((x - cx) / 1.6, (y - cy) * 1.4) / r; return d < 1 && dth(x, y) < (1 - d) * (1 - d) * 0.7 * (1.2 - t * 0.5) ? [...(d < 0.35 ? SH[6] : SH[5]), 0.32] : null; }, false);
      }
      const a = 1 - Math.max(0, t - 0.6) * 1.6, E = GPX.EYE.idle;
      for (const s of [-1, 1]) {
        const ey = -2 - lift, ex = s * 8.5 + (v === 'C' ? 2 : 0) - wv(ey);
        R(ex - 3, ey - 3, ex + 3, ey + 3, (x, y) => { const d = Math.hypot(x - ex, y - ey); return d < 1 ? [...E[1], a] : d < 2.4 ? [...E[0], a * 0.7] : null; }, false);
      }
    },
  });
}

// Кадры (выбор владельца — шаг 12 кадров на петлю парения 1,2 с, 10 к/с; ролики promo/ref/ghost-px-2026-10-27): парение и «задобрен» — 12,
// пугает — 9 (рот раскрыт), удар — 9 (замах 3, бросок 3, отдача 3), рана — 1, бегство — 6, гибель — 6. Холст 3× мира, 1:1 без сглаживания.
const GPX_N = { idle: 12, boo: 9, calm: 12, atk: 9, hurt: 1, flee: 6, die: 6 }, GPX_FPS = 10;
function ghostPxSprite(v, mood, f, rag = '') {
  f = Math.max(0, Math.min(GPX_N[mood] - 1, f | 0));
  return fzPxSprite('gh' + v + mood + f + rag, 60, 76, 30, 32, () => mood === 'die' ? ghostPxDie(v, (f + 1) / 6, rag)
    : ghostPx(v, mood, mood === 'atk' ? 0 : f / GPX_N[mood], mood === 'atk' ? f / (GPX_N.atk - 1) : 0, { rag }));
}

// Кадр для игры по общему бюджету новых спрайтов (spriteBudgetOk, people.js): кадр строится десятки миллисекунд,
// поэтому новый — только если в этом кадре рендера ещё есть время; иначе рисуется прошлый кадр этого призрака.
const GPX_LAST = new WeakMap();
function ghostPxFrame(g, v, mood, f, rag = '') {
  f = Math.max(0, Math.min(GPX_N[mood] - 1, f | 0));
  const have = FZ_CVC['gh' + v + mood + f + rag], last = GPX_LAST.get(g);
  if (have) { GPX_LAST.set(g, have); return have; }
  if (last && typeof spriteBudgetOk === 'function' && !spriteBudgetOk(true)) return last;
  const t0 = performance.now(), cv = ghostPxSprite(v, mood, f, rag);
  if (typeof spriteSpent === 'function') spriteSpent(t0);
  GPX_LAST.set(g, cv);
  return cv;
}
