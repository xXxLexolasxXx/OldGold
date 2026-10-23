'use strict';
// Драконы в пиксель-арте методом Полудницы (сетка ×3 мельче мирового, fzPxKit, рампы, Байер, обводка) с телом одной формой
// без швов (DS_body из dragshroom.js: поля расстояний + smin, свет по общей нормали).
//  • Взрослый — легендарный: изумруд, золотое брюхо из пластин с тлеющим огнём в щелях, корона рогов, гребень шипов, хвост с лезвием.
//  • Дракончик — пухлый малыш той же породы: та же палитра, пластины, рожки-бугорки, круглые шипики, крылышки; крупная голова, большие глаза.
// Режимы обоих: 'idle' (6, моргание на p4), 'fly' (8, взмах крыльев), 'flyatk' (6, огонь в полёте — вниз-вперёд), 'sleep' (6, спит в гнезде);
// у взрослого ещё 'walk' (6) и 'atk' (6: p0..1 вдох, p2..5 огонь стоя). Смотрят вправо, низ — y = 0.
// Пока лист-картинка; в игру не подключено.

const DR = {
  SK: [[8, 26, 26], [12, 44, 40], [18, 68, 54], [28, 98, 70], [44, 130, 84], [78, 168, 100], [140, 212, 132], [206, 244, 176]],
  SKF: [[6, 18, 20], [9, 32, 32], [14, 50, 44], [22, 74, 58], [34, 100, 70]],
  BE: [[128, 84, 34], [176, 124, 50], [214, 166, 72], [240, 204, 110], [255, 234, 164]],
  BEF: [[96, 62, 26], [140, 98, 40], [176, 132, 58]],
  HO: [[64, 42, 22], [124, 88, 44], [190, 152, 86], [234, 206, 140], [255, 244, 206]],
  HOF: [[44, 30, 18], [86, 62, 34], [134, 104, 62]],
  CL: [[56, 48, 40], [116, 104, 86], [184, 170, 142], [238, 228, 202]], CLF: [[36, 32, 28], [74, 66, 56], [120, 110, 92]],
  MEM: [[12, 34, 46], [18, 56, 66], [28, 84, 84], [44, 116, 102], [74, 156, 124], [120, 196, 146]],
  EMB: [[190, 56, 18], [255, 128, 36], [255, 198, 84], [255, 246, 190]],
  FL: [[150, 28, 18], [226, 76, 22], [255, 142, 36], [255, 208, 84], [255, 250, 206]],
  OUT: [10, 20, 18],
};
const DS_rot = (S, v, a) => [S[0] + v[0] * Math.cos(a) - v[1] * Math.sin(a), S[1] + v[0] * Math.sin(a) + v[1] * Math.cos(a)];

// Крыло: локоть назад, запястье вперёд, 4 пальца; перепонка складками у пальцев и с жилками; кости — одна форма.
// a — поворот вокруг плеча S (+ вверх), sc — масштаб (малыш ~0.45), fold 0..1 — сложено вдоль спины.
function DS_wing(K, S, a, near, sc, fold) {
  const { R, dth } = K;
  const OPEN = { E: [-20, -24], W: [-14, -58], T: [[-68, -70], [-90, -44], [-82, -14], [-56, -1]], A: [-30, 13] };
  const FOLD = { E: [-16, -4], W: [-40, -12], T: [[-72, -8], [-74, -3], [-66, 2], [-50, 6]], A: [-30, 10] };
  const mx = (q, f) => [q[0] + (f[0] - q[0]) * fold, q[1] + (f[1] - q[1]) * fold];
  const s = sc * (near ? 1.06 : 1), V = q => DS_rot(S, [q[0] * s, q[1] * s], a);
  const E = V(mx(OPEN.E, FOLD.E)), Wr = V(mx(OPEN.W, FOLD.W)), T = OPEN.T.map((q, i) => V(mx(q, FOLD.T[i]))), A = V(mx(OPEN.A, FOLD.A));
  const pull = (a2, b) => { const m = [(a2[0] + b[0]) / 2, (a2[1] + b[1]) / 2]; return [m[0] + (Wr[0] - m[0]) * 0.27, m[1] + (Wr[1] - m[1]) * 0.27]; };
  const sag = [pull(T[0], T[1]), pull(T[1], T[2]), pull(T[2], T[3]), pull(T[3], A)];
  const poly = [S, E, Wr, T[0], sag[0], T[1], sag[1], T[2], sag[2], T[3], sag[3], A];
  const fing = T.map(q => DS_cap(Wr[0], Wr[1], q[0], q[1], 0, 0));
  const vein = sag.slice(0, 3).map(q => DS_cap(Wr[0] + (q[0] - Wr[0]) * 0.15, Wr[1] + (q[1] - Wr[1]) * 0.15, q[0], q[1], 0, 0));
  const xs = poly.map(q => q[0]), ys = poly.map(q => q[1]), M = near ? DR.MEM : DR.MEM.slice(0, 4);
  R(Math.min(...xs) - 1, Math.min(...ys) - 1, Math.max(...xs) + 1, Math.max(...ys) + 1, (x, y) => {
    if (!DS_pip(x, y, poly)) return null;
    const fd = Math.min(...fing.map(f => f(x, y))), vd = sc > 0.6 ? Math.min(...vein.map(f => f(x, y))) : 9;
    let v = 0.22 + 0.5 * Math.min(1, Math.hypot(x - Wr[0], y - Wr[1]) / (80 * sc)) + (near ? 0.12 : -0.04) - fold * 0.08;
    if (fd < 3.5 * sc + 0.5) v -= 0.14 * (1 - fd / (3.5 * sc + 0.5));                    // складка у пальца
    if (vd < 0.75) v += 0.13;                                                              // жилка
    return M[Math.max(0, Math.min(M.length - 1, Math.floor((v + (dth(x, y) - 0.5) * 0.2) * M.length)))];
  });
  const rr = r => r * (0.45 + 0.55 * sc);
  const bones = [{ f: DS_cap(S[0], S[1], E[0], E[1], rr(4), rr(3.4)) }, { f: DS_cap(E[0], E[1], Wr[0], Wr[1], rr(3.4), rr(2.8)) }];
  for (const q of T) bones.push({ f: DS_cap(Wr[0], Wr[1], q[0], q[1], rr(2.6), rr(1)) });
  const th = V(mx([-8, -68], [-36, -24])); bones.push({ f: DS_cap(Wr[0], Wr[1], th[0], th[1], rr(2.2), 0.3), mat: 'horn', k: 1.5 });
  for (const q of T) { const d = Math.hypot(q[0] - Wr[0], q[1] - Wr[1]) || 1, l = 4 * sc + 1; bones.push({ f: DS_cap(q[0], q[1], q[0] + (q[0] - Wr[0]) / d * l, q[1] + (q[1] - Wr[1]) / d * l, rr(1.3), 0.2), mat: 'horn', k: 1 }); }
  DS_body(K, bones, near ? { skin: DR.SK, horn: DR.HO } : { skin: DR.SKF, horn: DR.HOF },
    { bb: [Math.round(Math.min(...xs)) - 8, Math.round(Math.min(...ys)) - 8, Math.round(Math.max(...xs)) + 8, Math.round(Math.max(...ys)) + 8], W: 3 * sc + 0.5, k: 2.5 * sc + 0.5 });
}

// Лапа дракона: цепочка суставов pts [[x, y, r], …] (бедро → … → подушечка), три пальца веером под углом ta, загнутые когти.
function DS_dLeg(pts, ta, sc, extra = []) {
  const out = [{ f: DS_cap(...pts[0].slice(0, 2), ...pts[1].slice(0, 2), pts[0][2], pts[1][2]), front: true, fw: 7 * sc, W: 9 * sc, k: 6 * sc }];
  for (let i = 1; i < pts.length - 1; i++) out.push({ f: DS_cap(...pts[i].slice(0, 2), ...pts[i + 1].slice(0, 2), pts[i][2], pts[i + 1][2]), k: 5 * sc });
  out.push(...extra);
  const ball = pts[pts.length - 1], c = Math.cos(ta), s = Math.sin(ta), O = (dx, dy) => [ball[0] + (dx * c - dy * s) * sc, ball[1] + (dx * s + dy * c) * sc];
  for (const [k, dx, dy, r] of [[-1, 7, -2.5, 2.8], [0, 11, 1, 3.3], [1, 8.5, 3.6, 3.4]]) {
    const b0 = O(1, k * 1.4), tip = O(dx, dy), mid = O((1 + dx) / 2, (k * 1.4 + dy) / 2 - 1.1), R0 = r * sc;
    out.push({ f: DS_cap(b0[0], b0[1], mid[0], mid[1], R0, R0 * 0.86), k: sc, front: true, fw: 1.6 * sc, W: 2.5 * sc }, { f: DS_cap(mid[0], mid[1], tip[0], tip[1], R0 * 0.86, R0 * 0.7), k: sc, front: true, fw: 1.6 * sc, W: 2.5 * sc });
    const c1 = O(dx + r * 0.4, dy - 0.8), c2 = O(dx + 4.2, dy - 0.2), c3 = O(dx + 5.6, dy + 2.2);
    out.push({ f: DS_cap(c1[0], c1[1], c2[0], c2[1], 1.5 * sc + 0.2, 0.9 * sc + 0.1), mat: 'claw', k: 0.6 }, { f: DS_cap(c2[0], c2[1], c3[0], c3[1], 0.9 * sc + 0.1, 0.2), mat: 'claw', k: 0.4 });
  }
  return out;
}

// Гребень шипов вдоль линии хвост → спина → шея; len(u) — длина по доле пути, r0 — толщина у основания
function DS_spines(dors, len, r0, step) {
  const out = []; let acc = 0;
  for (let i = 1; i < dors.length; i++) {
    const a = dors[i - 1], b = dors[i], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
    acc += l; if (acc < step || i < 2) continue; acc = 0;
    const L0 = len(i / dors.length), nx = ty / l, ny = -tx / l;
    const bx0 = b[0] + nx * (b[2] - 1.5), by0 = b[1] + ny * (b[2] - 1.5), tx1 = b[0] + nx * (b[2] + L0) - tx / l * L0 * 0.4, ty1 = b[1] + ny * (b[2] + L0) - ty / l * L0 * 0.4;
    out.push({ f: DS_cap(bx0, by0, tx1, ty1, r0, 0.3 + r0 * 0.15), mat: 'horn', k: 2 });
  }
  return out;
}
// хвостовое лезвие-наконечник
function DS_blade(tail, len, w) {
  const a = tail[tail.length - 2], b = tail[tail.length - 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, dx = (b[0] - a[0]) / l, dy = (b[1] - a[1]) / l;
  const out = [{ f: DS_cap(b[0], b[1], b[0] + dx * len, b[1] + dy * len, w, 0.2), mat: 'horn', k: 2.5 }];
  for (const sd of [-1, 1]) out.push({ f: DS_cap(b[0] + dx * len * 0.25, b[1] + dy * len * 0.25, b[0] + dx * 1 - dy * sd * len * 0.6, b[1] + dy * 1 + dx * sd * len * 0.6, w * 0.48, 0.2), mat: 'horn', k: 2 });
  return out;
}
// Огонь: струя из точки M под углом ang (вниз +), длиной len; к концу рассыпается дымом
function DS_fire(K, M, ang, len, p, wk) {
  const { P, R, dth, hsh } = K, ca = Math.cos(ang), sa = Math.sin(ang);
  R(M[0] - 2, M[1] - len * 0.5, M[0] + len + 4, M[1] + len * 0.9, (x, y) => {
    const dx = x - M[0], dy = y - M[1], d = dx * ca + dy * sa, q = -dx * sa + dy * ca;
    if (d < -1 || d > len) return null;
    const wdt = 2 * wk + d * 0.26, yy = q - Math.sin(d * 0.3 + p * 1.7) * 2.6 * wk, a = Math.abs(yy) / wdt;
    if (a > 1) return null;
    const f = d / len;
    if (f > 0.7 && dth(x, y) > (1 - f) * 2.6) return f > 0.82 && dth(x + 1, y) < 0.3 ? [96, 86, 86, 0.55] : null;
    const v = (1 - a) * 0.85 + (1 - f) * 0.45 + (hsh(x * 3 + y * 7 + p) - 0.5) * 0.3;
    return DR.FL[Math.max(0, Math.min(4, Math.floor(v * 3.3)))];
  }, false);
  for (let k = 0; k < 10 * wk; k++) { const d = 8 + hsh(k + p * 9) * (len + 4), q = (hsh(k * 2 + p) - 0.5) * (6 + d * 0.5); P(M[0] + d * ca - q * sa, M[1] + d * sa + q * ca, DR.EMB[1 + (k % 3)], 0.9, false); }
}
// общий шейдинг тела: брюхо по нормали, пластины поперёк полосы (у огня щели тлеют), чешуя, кольца на рогах
function DS_dragonBody(K, parts, glowAt, o) {
  const { dth, hsh } = K, lg = [0, 1], cell = o.scale || 4;
  return DS_body(K, parts, { skin: DR.SK, belly: DR.BE, horn: DR.HO, claw: DR.CL }, {
    bb: o.bb, W: o.W || 8, k: 5,
    mat2: (x, y, n, mat, ow, gx, gy, dep) => (lg[0] = gx, lg[1] = gy, 0) || mat === 'skin' && ow.bel && gy * 0.8 + gx * 0.5 > 0.32 + (dth(x, y) - 0.5) * 0.12 && dep < (ow.bel === 2 ? o.belN || 7 : o.belB || 11) ? 'belly' : null,
    light: (x, y, mat) => mat === 'belly' ? 0.12 + glowAt(x, y) * 0.18 : mat === 'skin' && o.dapple && hsh(Math.floor((x + 600) / 7) * 13 + Math.floor((y + 600) / 6) * 7) > 0.72 ? -0.06 : 0,
    tex: (x, y, mat, idx, ramp) => {
      if (mat === 'belly') {
        const s = Math.round(x * lg[1] - y * lg[0]), seam = ((s + 600) % (o.plate || 6)) === 0;
        if (!seam) return null;
        const g = glowAt(x, y);
        if (g > 0.22) return DR.EMB[Math.min(3, Math.floor(g * 3.2 + (dth(x, y) - 0.5) * 0.6))] || DR.EMB[0];
        return dth(x, y) < 0.6 ? ramp[Math.max(0, idx - 1)] : null;
      }
      if (mat === 'horn' && o.ridges && idx > 0 && (Math.round(x * 2 + y) + 600) % 5 === 0) return ramp[idx - 1];
      if (mat === 'skin' && idx > 0 && idx < ramp.length - 1) {                   // чешуя: тень снизу, блик сверху на светлой стороне
        const ch = cell - 1, row = Math.floor((y + 600) / ch), xx = x + 600 + (row & 1) * (cell >> 1), cx = Math.floor(xx / cell), yy = (y + 600) % ch;
        const m = xx % cell;
        if (yy === ch - 1 && (m === 1 || m === 2)) return ramp[idx - 1];
        if (yy === ch - 2 && (m === 0 || m === 3) && cell > 4) return ramp[idx - 1];
        if (yy === 0 && m === 1 && idx > 3 && hsh(cx * 7 + row) > 0.35) return ramp[idx + 1];
      }
      return null;
    },
  });
}

// ================= Взрослый легендарный дракон =================
// Сетка 300×180 (мир 100×60; сверху запас под взмах крыльев, справа — под огонь).
function fzDragonPx(mode, p) {
  const K = fzPxKit(300, 180, 126, 171), { P, R, L, dth, hsh } = K, BB = [-126, -171, 173, 8];
  const fly = mode === 'fly' || mode === 'flyatk', sleep = mode === 'sleep', walk = mode === 'walk', idle = mode === 'idle';
  const wind = mode === 'atk' && p < 2, breath = (mode === 'atk' && p >= 2) || mode === 'flyatk';
  const N = mode === 'fly' ? 8 : 6, t = p / N * Math.PI * 2;
  const hb = fly ? -8 - Math.round(Math.sin(t) * 2) : sleep ? 14 : walk ? -Math.round(Math.abs(Math.sin(t)) * 2) : idle ? Math.round(Math.sin(t) * 0.8) : wind ? 1 : -1;
  const br = idle ? Math.sin(t) : sleep ? Math.sin(t) * 1.3 : wind ? 2 : 0;
  const hdx = wind ? -10 : breath && !fly ? 7 : 0, hdy = (wind ? -4 : breath && !fly ? 3 : 0) + (idle ? Math.round(Math.sin(t + 1)) : walk ? Math.round(Math.sin(2 * t + 0.8)) : 0);
  const hx = fly ? 64 + (breath ? 3 : 0) : sleep ? 58 : 50 + hdx;
  const hy = fly ? -92 + hb + Math.round(Math.sin(t - 1) * 1.5) + (breath ? 3 : 0) : sleep ? -16 : -106 + hb + hdy;
  const ja = breath ? 0.42 + (p & 1) * 0.05 : wind ? 0.1 : 0;
  const wa = fly ? 0.2 + 0.75 * Math.cos(t) : sleep ? 0 : idle ? Math.sin(t) * 0.05 : walk ? Math.sin(2 * t) * 0.06 : wind ? 0.22 : -0.06 + Math.sin(2 * t) * 0.04;
  const tsw = idle ? Math.sin(t - 1) * 5 : walk ? Math.sin(t - 1) * 7 : wind ? -4 : 4;

  // ---- скелет ----
  const neck = fly ? DS_bez([[14, -62 + hb], [30, -76 + hb], [hx - 28, hy + 6], [hx - 8, hy + 3]], 9, 14, 8.6)
    : sleep ? DS_bez([[14, -62 + hb], [34, -70 + hb], [hx - 26, hy - 8], [hx - 8, hy + 3]], 9, 14, 8.6)
    : DS_bez([[14, -62 + hb], [20, -84 + hb + hdy * 0.3], [hx - 30, hy + 10], [hx - 8, hy + 3]], 9, 14, 8.6);
  const tail = fly ? DS_bez([[-34, -40 + hb], [-66, -42 + hb + Math.sin(t - 1) * 4], [-94, -36 + hb + Math.sin(t - 2) * 6], [-118, -44 + hb + Math.sin(t - 3) * 8]], 12, 14, 2.4)
    : sleep ? DS_bez([[-34, -40 + hb], [-72, -22], [-64, -2], [-24, -3]], 12, 14, 2.4)
    : DS_bez([[-34, -40 + hb], [-64, -36 + hb], [-90, -4 + tsw * 0.5], [-110, -20 + tsw]], 12, 14, 2.4);
  const torso = [[-34, -40 + hb, 17], [-20, -42 + hb, 17], [-4, -46 + hb, 17], [10, -52 + hb, 19 + br * 0.6]];
  const J = [hx - 6, hy + 5], jawTip = DS_rot(J, [31, 1], ja), upTip = [hx + 28, hy + 5];
  const glowC = wind || breath ? [neck[4][0] + 4, neck[4][1] + 6] : [12, -48 + hb];
  const glow = sleep ? 0.3 + Math.sin(t) * 0.12 : idle ? 0.55 + Math.sin(t) * 0.2 : walk || mode === 'fly' ? 0.5 : wind ? 1.05 : 0.85;
  const glowAt = (x, y) => glow * Math.max(0, 1 - Math.hypot(x - glowC[0], y - glowC[1]) / 28);

  // ---- искры-ореол ----
  const sparks = front => { if (sleep) return; for (let k = 0; k < 8; k++) if ((k & 1) === +front) { const x = -100 + hsh(k * 3.7) * 230, y = -6 - ((k * 13 + p * 6) % 36) * 3.6; P(x + Math.sin(t + k) * 2, y, k % 3 ? [255, 214, 110] : [255, 246, 200], 0.75, false); } };
  sparks(false);
  DS_wing(K, [-2, -64 + hb], fly ? 0.2 + 0.75 * Math.cos(t - 0.45) + 0.1 : sleep ? 0.02 : wa + 0.14, false, 1, sleep ? 1 : 0);

  // ---- лапы по позе ----
  const legs = (hx0, hy0, ph, hind) => {
    const sv = walk ? Math.sin(t + ph) * 9 : 0, lift = walk ? Math.max(0, Math.cos(t + ph)) * 7 : 0;
    let pts, ta = 0;
    if (fly) {
      if (hind) { pts = [[hx0, hy0, 14], [hx0 + 8, hy0 + 12, 10], [hx0 - 6, hy0 + 18, 6.6], [hx0 - 15, hy0 + 20, 5.4]]; ta = Math.PI - 0.3; }
      else { pts = [[hx0, hy0, 11.5], [hx0 - 4, hy0 + 14, 8.4], [hx0 + 4, hy0 + 21, 5.8], [hx0 + 8, hy0 + 24, 5]]; ta = 1.1; }
    } else if (sleep) {
      if (hind) pts = [[hx0, hy0, 14], [hx0 + 8, -12, 10], [hx0 + 4, -5.5, 6.6], [hx0 + 14, -4.5, 5.4]];
      else pts = [[hx0, hy0, 11.5], [hx0 - 2, -10, 8.4], [hx0 + 10, -6, 5.8], [hx0 + 20, -4.5, 5]];
    } else if (hind) pts = [[hx0, hy0, 14], [hx0 + 9 + sv * 0.35, hy0 + 14 - lift * 0.5, 10], [hx0 + 2 + sv * 0.8, -11 - lift * 0.9, 6.6], [hx0 + 8 + sv, -4.5 - lift, 5.4]];
    else pts = [[hx0, hy0, 11.5], [hx0 - 3 + sv * 0.3, hy0 + 17 - lift * 0.4, 8.4], [hx0 + 5 + sv * 0.85, -8 - lift * 0.9, 5.8], [hx0 + 11 + sv, -4.5 - lift, 5]];
    const ex = hind ? [{ f: DS_ell(hx0 + 2, hy0 + 7, 13, 11), k: 6 }, { f: DS_cap(pts[2][0] - 3, pts[2][1] + 3, pts[2][0] - 8, pts[2][1] + 8, 2.4, 0.3), mat: 'claw', k: 1.5 }]
      : [{ f: DS_ell((pts[1][0] + pts[2][0]) / 2 + 2.5, (pts[1][1] + pts[2][1]) / 2 - 3, 5.5, 7.5), k: 4 }];
    return DS_dLeg(pts, ta, 1, ex);
  };
  DS_body(K, [...legs(-12, -42 + hb, Math.PI, true), ...legs(22, -48 + hb, 0, false)], { skin: DR.SKF, horn: DR.HOF, claw: DR.CLF }, { bb: BB, W: 6, k: 4 });

  // ---- пасть изнутри ----
  if (ja > 0) R(J[0], hy - 2, Math.max(upTip[0], jawTip[0]) + 1, jawTip[1] + 2, (x, y) => {
    if (!DS_pip(x, y, [[J[0] + 2, J[1]], upTip, [jawTip[0], jawTip[1] - 2]])) return null;
    return y > (J[1] + (jawTip[1] - J[1]) * (x - J[0]) / (jawTip[0] - J[0])) - 4 && x < jawTip[0] - 6 ? [186, 58, 70] : [64, 10, 22];
  });

  // ---- тело одной формой ----
  const parts = [{ f: DS_tube(tail), k: 6, bel: sleep ? 0 : 2 }];
  parts.push({ f: DS_ell(-20, -42 + hb, 19, 17), k: 8 }, { f: DS_cap(-20, -40 + hb, 8, -44 + hb, 16, 18), k: 8, bel: sleep ? 0 : 1 }, { f: DS_ell(10, -52 + hb, 19, 20 + br * 0.6), k: 8, bel: sleep ? 0 : 1 });
  parts.push({ f: DS_tube(neck), k: 9, bel: 2 });
  parts.push(...DS_spines([...tail.slice().reverse(), ...torso, ...neck.slice(0, -1)], u => u < 0.45 ? 3 + 6 * u / 0.45 : u < 0.62 ? 10 : 10 - 5 * (u - 0.62) / 0.38, 3.4, 9));
  parts.push(...DS_blade(tail, 13, 5.4));
  parts.push(...legs(-22, -40 + hb, 0, true), ...legs(12, -46 + hb, Math.PI, false));
  // голова: череп, надбровье с шипиками, морда, нижняя челюсть, бородка
  parts.push({ f: DS_ell(hx, hy, 15, 12.5), k: 6 }, { f: DS_cap(hx - 6, hy - 9, hx + 11, hy - 7, 4.3, 3.2), k: 3 });
  parts.push({ f: DS_cap(hx + 4, hy - 2, hx + 25, hy + 1, 9.5, 6.4), k: 5 }, { f: DS_ell(hx + 25, hy, 5, 4.4), k: 3 });
  parts.push({ f: DS_cap(J[0] + 2, J[1] + 1, jawTip[0], jawTip[1], 6.4, 3.4), k: ja ? 1 : 4, front: true, fw: 3 });
  for (const dx of [2, 7]) parts.push({ f: DS_cap(hx + dx, hy - 10, hx + dx - 2, hy - 15, 1.8, 0.3), mat: 'horn', k: 1 });
  { const c1 = DS_rot(J, [14, 6], ja), c2 = DS_rot(J, [11, 13], ja), c3 = DS_rot(J, [20, 5], ja), c4 = DS_rot(J, [19, 10], ja);
    parts.push({ f: DS_cap(c1[0], c1[1], c2[0], c2[1], 2.2, 0.3), mat: 'horn', k: 1.2 }, { f: DS_cap(c3[0], c3[1], c4[0], c4[1], 1.8, 0.3), mat: 'horn', k: 1.2 }); }
  parts.push({ f: DS_cap(hx - 8, hy + 3, hx - 21, hy + 9, 3.6, 0.4), mat: 'horn', k: 2 }, { f: DS_cap(hx - 6, hy + 8, hx - 15, hy + 17 + ja * 10, 3, 0.3), mat: 'horn', k: 2 });
  parts.push({ f: DS_cap(hx + 21, hy - 5, hx + 24, hy - 12, 2.6, 0.3), mat: 'horn', k: 1.5 });
  for (const [b0, c0, e0, r0] of [[[hx - 9, hy - 6], [hx - 18, hy - 22], [hx - 42, hy - 25], 4.2], [[hx - 4, hy - 10], [hx - 10, hy - 30], [hx - 25, hy - 42], 3.9]])
    parts.push({ f: DS_tube(DS_bez([b0, c0, e0], 8, r0, 0.7)), mat: 'horn', k: 1.5, front: true, fw: 2, W: 3 });
  const body = DS_dragonBody(K, parts, glowAt, { bb: BB, W: 8, scale: 5, ridges: true, dapple: true });

  // ---- лицо ----
  const SK = DR.SK, HO = DR.HO;
  if (ja > 0) {
    for (let k = 0; k < 6; k++) { const x = hx + 4 + k * 4.2; P(x, hy + 7, HO[4]); P(x, hy + 8, HO[3]); if (k % 2 === 0) P(x, hy + 9, HO[3]); }
    for (let k = 0; k < 5; k++) { const u = 0.3 + k * 0.14, x = J[0] + (jawTip[0] - J[0]) * u, y = J[1] + (jawTip[1] - J[1]) * u - 4; P(x, y, HO[4]); P(x, y - 1, HO[3]); }
  } else {
    L(hx + 1, hy + 6, hx + 27, hy + 5, 0.7, 0.7, () => SK[0]); P(hx, hy + 5, SK[0]); P(hx - 1, hy + 4, SK[0]);
    for (const x of [hx + 8, hx + 14, hx + 19]) { P(x, hy + 7, HO[4]); if (x === hx + 19) P(x, hy + 8, HO[3]); }
  }
  P(hx + 27, hy - 2, SK[0]); P(hx + 28, hy - 2, SK[0]); P(hx + 27, hy - 1, SK[1]);                                  // ноздря
  if (wind || breath || sleep) for (let k = 0; k < 4; k++) { const q = (p + k * 1.5) % 6; P(hx + 30 + q * 1.2, hy - 4 - q * 2.4, [200, 194, 186], 0.55 - q * 0.08, false); }   // дымок
  const ex = hx + 5, ey = hy - 4;
  if ((idle && p === 4) || sleep) L(ex - 4, ey + 1, ex + 4, ey + 2, 0.8, 0.8, () => SK[0]);
  else {
    R(ex - 9, ey - 9, ex + 9, ey + 9, (x, y) => {
      const d = Math.hypot(x - ex, (y - ey) * 1.3);
      return d > 3 && d < 8 && body.at(x, y) <= 0 && dth(x, y) < (1 - d / 8) * 0.5 ? [255, 214, 110, 0.55] : null;
    }, false);
    R(ex - 6, ey - 4, ex + 6, ey + 4, (x, y) => {
      const yy = y - ey - (x - ex) * 0.3;
      if ((x - ex) ** 2 / 21 + yy * yy / 5.8 > 1) return null;
      if (Math.abs(x - ex - 0.5) < 0.8 && Math.abs(yy) < 2.2) return [26, 8, 4];
      return Math.hypot(x - ex, yy) < 2.6 ? [255, 238, 150] : [255, 182, 44];
    });
    P(ex - 2, ey - 1, [255, 252, 230]);
    L(ex - 5, ey - 3.6, ex + 5, ey - 0.4, 0.8, 0.8, () => SK[0]);
  }

  DS_wing(K, [-2, -66 + hb], sleep ? -0.06 : wa, true, 1, sleep ? 1 : 0);
  const M = [(upTip[0] + jawTip[0]) / 2 + 2, (upTip[1] + jawTip[1]) / 2 - 1];
  if (breath) { const ang = ja * 0.35 + (fly ? 0.32 : 0); DS_fire(K, M, ang, Math.min((170 - M[0]) / Math.cos(ang), fly ? 74 : 78) + (p & 1) * 4, p, 1); }
  else if (wind) for (const [dx, dy] of [[0, 0], [2, -1], [3, 1], [1, 2]]) P(upTip[0] + dx - 2, hy + 7 + dy, DR.EMB[2], 0.8, false);
  sparks(true);
  K.outline(DR.OUT);
  return K.done();
}
function fzDragonSprite(mode, p) { return fzPxSprite('dr' + mode + p, 100, 60, 42, 57, () => fzDragonPx(mode, p)); }

// ================= Дракончик =================
// Пухлый малыш той же породы. Сетка 132×120 (мир 44×40), низ — y = 0.
function fzBabyDragonPx(mode, p) {
  const K = fzPxKit(132, 120, 63, 111), { P, R, L, dth, hsh } = K, BB = [-63, -111, 68, 8];
  const fly = mode === 'fly' || mode === 'flyatk', sleep = mode === 'sleep', idle = mode === 'idle', breath = mode === 'flyatk';
  const N = mode === 'fly' ? 8 : 6, t = p / N * Math.PI * 2;
  const hb = fly ? -12 - Math.round(Math.sin(t) * 2) : sleep ? 6 : Math.round(Math.sin(t) * 0.8);
  const br = idle ? Math.sin(t) * 0.8 : sleep ? Math.sin(t) * 1.2 : 0;
  const hx = fly ? 26 : sleep ? 28 : 20, hy = fly ? -54 + hb + Math.round(Math.sin(t - 1)) : sleep ? -15 : -60 + hb + Math.round(Math.sin(t + 1) * 0.8);
  const SKr = DR.SK;

  // ---- скелет ----
  const bodyP = fly ? [[-12, -24 + hb, 13, 11], [-2, -26 + hb, 18, 13.5 + br * 0.4], [9, -31 + hb, 12.5, 12]]
    : sleep ? [[-10, -12, 15, 11], [-1, -15, 19, 13 + br * 0.5], [9, -20, 12, 11]]
    : [[-8, -13 + hb, 13, 11], [0, -23 + hb, 17, 17 + br * 0.5], [6, -35 + hb, 12, 12]];
  const nb = fly ? [12, -38 + hb] : sleep ? [12, -26] : [8, -42 + hb];
  const tail = fly ? DS_bez([[-18, -24 + hb], [-36, -26 + hb + Math.sin(t - 1) * 3], [-50, -22 + hb + Math.sin(t - 2) * 4], [-60, -28 + hb + Math.sin(t - 3) * 5]], 9, 10, 2.6)
    : sleep ? DS_bez([[-18, -12], [-42, -8], [-40, -2], [-14, -3]], 9, 10, 2.6)
    : DS_bez([[-14, -10 + hb], [-30, -4 + hb], [-38, -12 + Math.sin(t - 1) * 1.5], [-32, -24 + Math.sin(t - 1) * 3]], 8, 9, 2.6);
  const glowC = [bodyP[2][0] + 2, bodyP[2][1] + 4], glow = breath ? 0.8 : 0.3 + (idle ? Math.sin(t) * 0.1 : 0);
  const glowAt = (x, y) => glow * Math.max(0, 1 - Math.hypot(x - glowC[0], y - glowC[1]) / 16);

  DS_wing(K, fly ? [-7, -38 + hb] : sleep ? [0, -24] : [-2, -44 + hb], fly ? 0.3 + 0.85 * Math.cos(t - 0.45) + 0.1 : sleep ? 0.1 : 0.22 + Math.sin(t) * 0.08, false, 0.42, sleep ? 1 : 0);

  // ---- лапки ----
  const legs = far => {
    const dx = far ? 7 : 0, dy = far ? -1 : 0;
    let H, F, ta = 0, tf = 0;
    if (fly) { H = [[-10 + dx, -20 + hb + dy, 9], [-12 + dx, -10 + hb + dy, 5.4], [-18 + dx, -6 + hb + dy, 4.2]]; ta = Math.PI - 0.6; F = [[8 + dx, -28 + hb + dy, 5], [12 + dx, -20 + hb + dy, 4.2], [15 + dx, -17 + hb + dy, 3.6]]; tf = 1.2; }
    else if (sleep) { H = [[-6 + dx, -12 + dy, 9.5], [0 + dx, -5 + dy, 5], [9 + dx, -4 + dy, 4.2]]; F = [[9 + dx, -20 + dy, 5.5], [15 + dx, -6 + dy, 4.6], [22 + dx, -4 + dy, 4]]; }
    else { H = [[-6 + dx, -14 + hb + dy, 10], [-2 + dx, -6 + dy, 5], [5 + dx, -4.2 + dy, 4.4]]; F = [[8 + dx, -31 + hb + dy, 5.4], [12 + dx, -22 + hb + dy, 4.6], [16 + dx, -18 + hb + dy, 4]]; tf = 0.7; }
    return [...DS_dLeg(H, ta, 0.55, far ? [] : [{ f: DS_ell(H[0][0] + 1, H[0][1] + 2, 10.5, 9), k: 5 }]), ...DS_dLeg(F, tf, 0.42)];
  };
  DS_body(K, legs(true), { skin: DR.SKF, horn: DR.HOF, claw: DR.CLF }, { bb: BB, W: 5, k: 3 });

  // ---- тело одной формой ----
  const parts = [{ f: DS_tube(tail), k: 5, bel: fly ? 2 : 0 }];
  parts.push({ f: DS_ell(...bodyP[0]), k: 6 }, { f: DS_ell(...bodyP[1]), k: 6 }, { f: DS_ell(...bodyP[2]), k: 6 });
  parts.push({ f: DS_cap(nb[0], nb[1], hx - 8, hy + 7, 11, 10), k: 7 });
  // пузико — большой золотой овал спереди (как у старого малыша), край с дизерингом; горлышко
  const zd = f => (x, y) => f(x, y) - (dth(x, y) - 0.5) * 1.6;
  const [b1, b2] = [bodyP[1], bodyP[2]];
  if (fly) parts.push({ f: zd(DS_ell(b1[0] + 2, b1[1] + b1[3] - 3, b1[2] - 3, 6)), zone: true, mat: 'belly' }, { f: zd(DS_cap(b2[0] + 4, b2[1] + 7, hx - 2, hy + 12, 5.5, 4.5)), zone: true, mat: 'belly' });
  else if (!sleep) parts.push({ f: zd(DS_ell(b1[0] + 8, b1[1] + 3, 9.5, 13)), zone: true, mat: 'belly' }, { f: zd(DS_cap(b2[0] + 6, b2[1] + 2, hx - 1, hy + 12, 6, 5)), zone: true, mat: 'belly' });
  else parts.push({ f: zd(DS_cap(b2[0] + 6, b2[1] + 6, hx - 2, hy + 12, 5, 4.5)), zone: true, mat: 'belly' });
  const torsoLine = [[-18, bodyP[0][1], bodyP[0][3]], [-4, bodyP[1][1], bodyP[1][3]], [6, bodyP[2][1], bodyP[2][3]], [hx - 10, hy + 2, 10]];
  parts.push(...DS_spines([...tail.slice().reverse(), ...torsoLine], u => 2.5 + 1.8 * Math.sin(Math.PI * u), 2.6, 12));
  parts.push(...DS_blade(tail, 7, 3.4));
  parts.push(...legs(false));
  // большая голова: лоб, щёчки, короткая круглая мордочка, рожки-бугорки
  parts.push({ f: DS_ell(hx, hy, 19, 17), k: 6 }, { f: DS_ell(hx + 16, hy + 6, 10, 8.5), k: 6 }, { f: DS_ell(hx + 6, hy + 9, 10, 7), k: 5 });
  parts.push({ f: DS_cap(hx + 4, hy + 10, hx + 20, hy + 10, 5, 3.4), k: 3, front: true, fw: 2 });
  parts.push({ f: DS_cap(hx + 21, hy - 1, hx + 22, hy - 4, 2, 0.5), mat: 'horn', k: 1 });
  for (const [b0, c0, e0, r0] of [[[hx - 7, hy - 11], [hx - 13, hy - 19], [hx - 21, hy - 21], 4], [[hx + 0, hy - 14], [hx - 3, hy - 23], [hx - 10, hy - 28], 3.8]])
    parts.push({ f: DS_tube(DS_bez([b0, c0, e0], 6, r0, 1.3)), mat: 'horn', k: 1.5, front: true, fw: 1.6, W: 2.5 });
  const body = DS_dragonBody(K, parts, glowAt, { bb: BB, W: 7, scale: 4, plate: 5, belN: 6, belB: 16 });

  // ---- мордочка ----
  const ex = hx + 5, ey = hy - 3;
  if ((idle && p === 4) || sleep) for (let x = ex - 5; x <= ex + 5; x++) P(x, ey + 1 + 1.8 * Math.sqrt(Math.max(0, 1 - ((x - ex) / 5.2) ** 2)), SKr[0]);   // закрытый глаз ‿
  else {
    R(ex - 8, ey - 9, ex + 8, ey + 9, (x, y) => {
      const d = ((x - ex) / 7.2) ** 2 + ((y - ey) / 8.2) ** 2;
      if (d > 1) return null;
      if (d > 0.84) return SKr[1];
      if (((x - ex - 1.8) / 2.4) ** 2 + ((y - ey - 0.4) / 4.8) ** 2 <= 1) return [24, 10, 6];
      if (((x - ex - 1.3) / 5.4) ** 2 + ((y - ey - 0.4) / 6.8) ** 2 <= 1) return y > ey + 1 ? [255, 184, 40] : [255, 224, 90];
      return [250, 252, 240];
    });
    for (const [x, y] of [[ex - 1, ey - 4], [ex, ey - 4], [ex - 1, ey - 3], [ex + 3, ey + 3]]) P(x, y, [255, 255, 255]);
    for (let x = ex - 7; x <= ex + 7; x++) P(x, ey - 8.4 * Math.sqrt(Math.max(0, 1 - ((x - ex) / 7.4) ** 2)) - 0.4, SKr[0]);
  }
  R(hx + 5, hy + 3, hx + 12, hy + 9, (x, y) => Math.hypot(x - hx - 8.5, (y - hy - 6) * 1.4) < 3.4 && dth(x, y) < 0.55 ? [240, 120, 120, 0.7] : null, false);   // румянец
  P(hx + 23, hy + 1, SKr[0]); P(hx + 24, hy + 1, SKr[0]);
  if (breath) R(hx + 10, hy + 8, hx + 24, hy + 14, (x, y) => y > hy + 9 && y < hy + 12 + (x - hx - 10) * 0.12 && x > hx + 12 ? [70, 14, 26] : null);
  else { for (let x = hx + 11; x <= hx + 23; x++) P(x, hy + 9 + ((x - hx - 17) / 6) ** 2 * -1.2 + 0.6, SKr[0]); P(hx + 19, hy + 10, DR.HO[4]); P(hx + 19, hy + 11, DR.HO[3]); }
  if (sleep) { const r = 1.6 + 2.2 * (0.5 + 0.5 * Math.sin(t)), bx = hx + 26 + r * 0.6, by = hy - 1;   // пузырь из носа
    R(bx - r - 1, by - r - 1, bx + r + 1, by + r + 1, (x, y) => { const d = Math.hypot(x - bx, y - by); return d <= r ? (d > r - 1 ? [190, 230, 250, 0.8] : (x < bx - r * 0.3 && y < by - r * 0.3 ? [255, 255, 255, 0.9] : [170, 220, 245, 0.25])) : null; }, false); }

  DS_wing(K, fly ? [-5, -40 + hb] : sleep ? [2, -26] : [0, -46 + hb], fly ? 0.3 + 0.85 * Math.cos(t) : sleep ? 0 : 0.12 + Math.sin(t) * 0.08, true, 0.45, sleep ? 1 : 0);
  if (breath) DS_fire(K, [hx + 25, hy + 11], 0.35, 36 + (p & 1) * 3, p, 0.55);
  K.outline(DR.OUT);
  return K.done();
}
function fzBabyDragonSprite(mode, p) { return fzPxSprite('bdr' + mode + p, 44, 40, 21, 37, () => fzBabyDragonPx(mode, p)); }
