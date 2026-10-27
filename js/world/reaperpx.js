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
// Пока только лист на согласование: в index.html не подключён.

const RPX = {
  RB: [[4, 6, 12], [10, 14, 24], [20, 26, 40], [34, 44, 64], [56, 72, 100], [90, 114, 148]],      // ряса: чёрно-синяя, холодный край
  BO: [[50, 58, 64], [92, 104, 110], [140, 154, 158], [188, 200, 200], [228, 238, 236]],
  HM: [[6, 8, 12], [20, 24, 32], [42, 48, 60], [72, 82, 98], [124, 140, 160]],                    // шлем: воронёный
  CAP: [[6, 8, 14], [16, 20, 30], [30, 36, 50], [50, 58, 76], [80, 92, 112]],
  BAND: [[30, 6, 8], [64, 14, 14], [100, 28, 22], [140, 48, 34]],                                  // лента на колпаке — запёкшаяся кровь
  PATCH: [[18, 20, 26], [32, 36, 44], [52, 58, 68], [78, 86, 98]],
  HORN: [[24, 8, 8], [60, 20, 14], [110, 44, 26], [170, 90, 50], [230, 170, 110]],
  VO: [[2, 4, 8], [8, 12, 20], [16, 22, 34]],
  WD: [[20, 12, 8], [44, 28, 16], [72, 48, 28], [104, 74, 44]],                                     // древко
  IR: [[18, 22, 28], [46, 54, 64], [92, 104, 116], [160, 176, 190], [232, 240, 248]],              // лезвие
  CL: [[6, 8, 10], [24, 30, 34], [56, 64, 70]],
  EYE: { idle: [[110, 180, 255], [226, 244, 255]], boo: [[255, 50, 24], [255, 210, 160]] },
  EDGE: [2, 4, 10],
};

function reaperPx(v, mood, p = 0, k = 0) {
  const K = fzPxKit(243, 309, 120, 129), { P, R, L, dth, hsh } = K, TAU = Math.PI * 2, { RB, BO, VO, IR, WD, CL } = RPX;
  const atk = mood === 'atk', boo = mood === 'boo' || atk;
  const sn = (m, o = 0) => Math.sin(p * TAU * m + o), sm = x => x * x * (3 - 2 * x);
  const wind = atk ? sm(Math.min(1, k / 0.35)) : 0, strike = atk ? sm(Math.max(0, Math.min(1, (k - 0.35) / 0.25))) : 0, recoil = atk ? sm(Math.max(0, (k - 0.6) / 0.4)) : 0;
  const lean = atk ? (-10 * wind + 24 * strike) * (1 - recoil) : 0;
  const HX = lean * 0.7, HY = (atk ? 5 * strike - 4 * wind : 0) + sn(1, 0.8) * 1.5;
  const eye = RPX.EYE[boo ? 'boo' : 'idle'];
  const open = atk ? Math.max(wind * 0.3, strike) * (1 - recoil * 0.6) : boo ? 0.9 : 0.12 + 0.06 * sn(2);
  const drop = open * 9, FX = HX + (v === 'R3' ? 2 : 0), FY = HY + 4, FRX = 16;
  const faceF = (x, y) => {
    const dy = (y - FY) / (y > FY ? 22 + drop : 15), dx = (x - FX) / (FRX * (1 - Math.max(0, dy) * 0.26));
    return (Math.hypot(dx, dy) - 1) * 12;
  };
  const ell = DS_ell, cap = DS_cap, tip = sn(1, 0.6) * 7 + lean * 0.4;

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

  // ---- одна форма: ряса, плечи, ближняя рука, голова и убор
  const parts = [...DS_chain(spine, { mat: 'rb', k: 8 }), { f: ell(lean * 0.6, 22, 40, 18), mat: 'rb', k: 9 }, ...armParts(AN)];
  if (v === 'R1') {
    parts.push({ f: ell(HX, HY - 2, 23, 25), mat: 'hm', k: 6 }, { f: ell(HX, HY + 16 + drop * 0.6, 17, 13 + drop * 0.5), mat: 'hm', k: 5 });
    parts.push({ f: (x, y) => Math.max(faceF(x, y), HY - 9 - y) - 1, mat: 'void', zone: true });
  } else if (v === 'R2') {
    parts.push({ f: ell(HX, HY - 2, 22, 22), mat: 'bo', k: 6 }, { f: faceF, mat: 'bo', k: 4 });
    parts.push(...DS_chain([[HX, HY - 15, 24], [HX - 6 + tip * 0.3, HY - 48, 13], [HX - 20 + tip, HY - 78, 5], [HX - 36 + tip * 1.5, HY - 90, 1]], { mat: 'cap', k: 3 }));
    parts.push({ f: ell(HX, HY - 12, 30, 9), mat: 'cap', k: 2, front: true, fw: 3 });
    parts.push({ f: (x, y) => Math.max(DS_ell(HX, HY - 15, 25, 40)(x, y), Math.abs(y - HY + 24) - 3), mat: 'band', zone: true });
    parts.push({ f: (x, y) => Math.max(Math.abs(x - HX + 7 - tip * 0.15) - 6, Math.abs(y - HY + 42) - 5), mat: 'patch', zone: true });
    parts.push({ f: (x, y) => Math.max(faceF(x, y), HY - 5 - y), mat: 'bo', zone: true });
  } else {
    parts.push({ f: ell(HX - 3, HY - 5, 33, 36), mat: 'cap', k: 9 });
    parts.push(...DS_chain([[HX - 8, HY - 30, 15], [HX - 18 + tip * 0.5, HY - 50, 6], [HX - 28 + tip, HY - 62, 1]], { mat: 'cap', k: 5 }));
    parts.push({ f: (x, y) => faceF(x, y) - 4, mat: 'void', zone: true });
  }
  const tex = (x, y, mat, idx, ramp) => {
    const cy = y - HY, cx = x - HX;
    if (mat === 'rb') { const w = ((x * 0.22 + Math.sin(y * 0.06 + p * TAU) * 2) % 6 + 6) % 6; return y > 30 && w < 1 ? ramp[Math.max(0, idx - 1)] : null; }
    if (mat === 'cap' && v === 'R2') {
      if (cy > -12 && cy < -2.5 && cy > -6 && hsh(Math.floor(x / 2) * 3.7) > 0.6) return ramp[0];
      if (cy < -26 && (((cx + cy * 0.3 + 60) % 9) + 9) % 9 < 1.2) return ramp[Math.max(0, idx - 1)];
      if (cy < -30 && (((cy + Math.sin(cx * 0.3) * 2.5) % 12) + 12) % 12 > 10.5) return ramp[Math.min(ramp.length - 1, idx + 1)];
    }
    if (mat === 'cap' && v === 'R3') { const d = faceF(x, y); if (d > 0 && d < 6 && hsh(Math.floor(x / 2) + y * 0.3) > 0.55) return ramp[0]; }
    if (mat === 'band') return Math.round(cy + 24) === 0 && ((x + 60) % 5) < 2 ? BO[2] : null;
    if (mat === 'patch') { const ex = Math.abs(x - HX + 7 - tip * 0.15), ey = Math.abs(y - HY + 42); return ex > 5 || ey > 4 ? (((x + y) & 1) ? BO[3] : ramp[0]) : null; }
    if (mat === 'hm') {                                                                // шлем: гребень посередине, заклёпки по ободу
      if (Math.abs(cx) < 1.5 && cy < -10) return ramp[Math.min(ramp.length - 1, idx + 1)];
      if (Math.abs(cy + 8) < 1 && Math.abs(cx) > 12 && Math.abs(cx) < 20 && (x & 3) === 0) return RPX.IR[3];
    }
    return null;
  };
  DS_body(K, parts, { rb: RB, bo: BO, cap: RPX.CAP, band: RPX.BAND, patch: RPX.PATCH, hm: RPX.HM, void: VO }, { bb: [-120, -128, 121, 179], W: 10, k: 6, amb: 0.14, mat: 'rb', cut, tex });

  // ---- череп в прорези шлема (R1) или в глубине капюшона (R3)
  if (v !== 'R2') DS_body(K, [{ f: ell(FX, FY - 4, 15, 13), mat: 'bo' }, { f: faceF, mat: 'bo', k: 4 }],
    { bo: BO.slice(0, 4) }, { bb: [-50, -50, 50, 60], W: 6, k: 4, amb: 0.1, mat: 'bo' });
  if (v === 'R1') R(FX - 26, HY - 26, FX + 26, HY - 6, (x, y) => {                     // нахмуренный козырёк шлема поверх черепа
    const d = ell(HX, HY - 2, 23, 25)(x, y);
    return d < 0 && y < HY - 7 + Math.abs(x - HX) * 0.18 && y > HY - 13 + Math.abs(x - HX) * 0.18 ? (y < HY - 10 + Math.abs(x - HX) * 0.18 ? RPX.HM[3] : RPX.HM[1]) : null;
  });
  // кромка лица
  R(FX - 22, HY - 8, FX + 22, FY + 32 + drop, (x, y) => { const d = faceF(x, y); return d > -1.2 && d <= 0 && y > HY - 6 ? BO[0] : null; });

  // ---- рога: R1 — бараньи, загнутые к щекам; R2 — короткие рожки сквозь колпак; R3 — корона костяных шипов
  const horn = (pts, r0) => {
    const H = RPX.HORN, n = pts.length - 1;
    K.path(pts.map((q, i) => [q[0], q[1], r0 * Math.pow(1 - i / n, 0.8) + 0.4]), (t, e, sd) => e ? H[0] : (Math.floor(t * 18) % 3 === 0 ? H[1] : t > 0.8 ? H[4] : sd > 0 ? H[2] : H[3]));
  };
  for (const s of [-1, 1]) {
    if (v === 'R1') {
      const b = [HX + s * 20, HY - 10], pts = [];
      for (let i = 0; i <= 14; i++) { const t = i / 14, a = -Math.PI / 2 + s * (0.3 + t * 4.2), r = 10 + t * 10; pts.push([b[0] + s * 14 * t + Math.cos(a) * r * t * 1.2, b[1] - 4 * t + Math.sin(a) * r * t]); }
      horn(pts, 6.5);
    } else if (v === 'R2') {
      const b = [HX + s * 20, HY - 22];
      horn([b, [b[0] + s * 8, b[1] - 6], [b[0] + s * 12, b[1] - 15], [b[0] + s * 10, b[1] - 22]], 3.6);
    } else for (const j of [0.7, 1.2]) {
      const a = -Math.PI / 2 + s * j * 0.5, b = [HX - 3 + s * j * 14, HY - 34 + j * 6];
      horn([b, [b[0] + Math.cos(a) * 7, b[1] + Math.sin(a) * 7], [b[0] + Math.cos(a) * 14, b[1] + Math.sin(a) * 14]], 2.8);
    }
  }
  if (v === 'R3') horn([[HX - 4, HY - 38], [HX - 4, HY - 46], [HX - 3, HY - 54]], 3);

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
function reaperPxSprite(v, mood, f, n) {
  return fzPxSprite('rp' + v + mood + f + '_' + n, 81, 103, 40, 43, () => reaperPx(v, mood, mood === 'atk' ? 0 : f / n, mood === 'atk' ? f / (n - 1) : 0));
}
