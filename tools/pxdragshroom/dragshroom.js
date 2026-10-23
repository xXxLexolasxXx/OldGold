'use strict';
// Пиксель-арт дракона и чумного моховика тем же методом, что Полудница (fzNoonPx): сетка ×3 мельче мирового,
// свой растеризатор fzPxKit из js/world/fairy2.js, рампы палитры, дизеринг Байера, слои сзади вперёд, обводка в конце.
// Тело — ОДНА форма без швов: части заданы полями расстояний и слиты сглаженным минимумом, свет — по нормали общего поля.
// Пока только лист-картинка (sheet.html); в игру не подключено.

// ---------- поля расстояний ----------
const DS_smin = (a, b, k) => { if (k <= 0) return Math.min(a, b); const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const DS_cap = (ax, ay, bx, by, ra, rb) => {          // капсула с сужением
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  return (x, y) => { const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)); return Math.hypot(x - ax - dx * t, y - ay - dy * t) - (ra + (rb - ra) * t); };
};
const DS_ell = (cx, cy, rx, ry) => (x, y) => (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry);
const DS_sst = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const DS_pip = (x, y, poly) => {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
};
// точки кривой Безье (3 или 4 опорные) с радиусом r0 → r1
function DS_bez(pts, n, r0, r1) {
  const out = [];
  for (let k = 0; k <= n; k++) {
    const u = k / n; let q = pts.map(a => a.slice());
    while (q.length > 1) q = q.slice(1).map((b, i) => [q[i][0] + (b[0] - q[i][0]) * u, q[i][1] + (b[1] - q[i][1]) * u]);
    out.push([q[0][0], q[0][1], r0 + (r1 - r0) * u]);
  }
  return out;
}
const DS_tube = pts => { const fs = pts.slice(1).map((b, i) => DS_cap(pts[i][0], pts[i][1], b[0], b[1], pts[i][2], b[2])); return (x, y) => { let m = 1e9; for (const f of fs) m = Math.min(m, f(x, y)); return m; }; };
const DS_chain = (pts, o = {}) => pts.slice(1).map((b, i) => ({ f: DS_cap(pts[i][0], pts[i][1], b[0], b[1], pts[i][2], b[2]), ...o }));
const DS_LIGHT = (() => { const l = Math.hypot(-0.45, -0.72, 0.55); return [-0.45 / l, -0.72 / l, 0.55 / l]; })();

// Одно тело из частей: parts — [{f, k, mat, front, zone}] сзади вперёд. Геометрия = smin всех не-zone частей (k — радиус слияния).
// Нормаль общего поля + у front-частей своя нормаль, подмешанная плавно от края (никаких ободков на стыке).
// Материал — последняя часть, внутри которой пиксель (zone-части только красят). mats: {имя: рампа тёмный → светлый}.
function DS_body(K, parts, mats, o) {
  const { P, dth } = K, [x0, y0, x1, y1] = o.bb, w = x1 - x0 + 1, h = y1 - y0 + 1, N = w * h;
  const D = parts.map(() => new Float32Array(N)), U = new Float32Array(N), OW = new Int16Array(N), Wd = o.W || 7, amb = o.amb ?? 0.2;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = x0 + i, y = y0 + j, id = j * w + i; let u = 1e9;
    let best = 1e9, ow = 0;
    for (let k = 0; k < parts.length; k++) { const q = parts[k], d = q.f(x, y); D[k][id] = d; if (!q.zone) { u = u === 1e9 ? d : DS_smin(u, d, q.k ?? o.k ?? 4); if (d < best) { best = d; ow = k; } } }
    U[id] = u; OW[id] = ow;
  }
  const nrm = (A, i, j, W) => {
    const ix = Math.max(1, Math.min(w - 2, i)), jy = Math.max(1, Math.min(h - 2, j));
    let gx = A[jy * w + ix + 1] - A[jy * w + ix - 1], gy = A[(jy + 1) * w + ix] - A[(jy - 1) * w + ix];
    const l = Math.hypot(gx, gy) || 1; gx /= l; gy /= l;
    const s = Math.min(1, Math.max(0, -A[j * w + i] / W)), nz = Math.sqrt(1 - (1 - s) ** 2), q = Math.sqrt(Math.max(0, 1 - nz * nz));
    return [gx * q, gy * q, nz];
  };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const id = j * w + i; if (U[id] > 0) continue;
    const x = x0 + i, y = y0 + j;
    let n = nrm(U, i, j, Wd), mat = o.mat || 'skin';
    for (let k = 0; k < parts.length; k++) {
      const q = parts[k], d = D[k][id];
      if (q.mat && d < (q.zone ? 0 : 0.5)) mat = q.mat;
      if (q.front && d < 0) {
        const wt = DS_sst(0, q.fw || 4, -d), m = nrm(D[k], i, j, q.W || Wd);
        n = [n[0] + (m[0] - n[0]) * wt, n[1] + (m[1] - n[1]) * wt, n[2] + (m[2] - n[2]) * wt];
        const l = Math.hypot(...n) || 1; n = [n[0] / l, n[1] / l, n[2] / l];
      }
    }
    if (o.mat2) {
      const ix = Math.max(1, Math.min(w - 2, i)), jy = Math.max(1, Math.min(h - 2, j)), gx = U[jy * w + ix + 1] - U[jy * w + ix - 1], gy = U[(jy + 1) * w + ix] - U[(jy - 1) * w + ix], gl = Math.hypot(gx, gy) || 1;
      mat = o.mat2(x, y, n, mat, parts[OW[id]], gx / gl, gy / gl, -U[id]) || mat;
    }
    let v = amb + (1 - amb) * Math.max(0, n[0] * DS_LIGHT[0] + n[1] * DS_LIGHT[1] + n[2] * DS_LIGHT[2]);
    if (n[1] > 0.55) v += 0.06;                                                         // отражённый свет снизу
    if (o.light) v += o.light(x, y, mat, v);
    const ramp = mats[mat], idx = Math.max(0, Math.min(ramp.length - 1, Math.floor((v + (dth(x, y) - 0.5) * (o.dither ?? 0.16)) * ramp.length)));
    P(x, y, (o.tex && o.tex(x, y, mat, idx, ramp, v)) || ramp[idx]);
  }
  return { at: (x, y) => { const i = Math.round(x) - x0, j = Math.round(y) - y0; return i < 0 || j < 0 || i >= w || j >= h ? 1e9 : U[j * w + i]; } };
}

// ================= Легендарный дракон =================
// Изумрудная чешуя, золотое брюхо из пластин, в щелях между пластинами тлеет огонь; корона из двух пар рогов, гребень шипов
// от затылка до хвоста, хвост с костяным лезвием, большие крылья. Шея — плавная лебединая S. Глаза — золото с огоньком.
// mode: 'idle' (p 0..5, на p4 моргает), 'walk' (p 0..5), 'atk' (p 0..1 вдох: шея назад, горло светится; p 2..5 струя огня).
// Смотрит вправо. Сетка 300×150 (мир 100×50; справа запас под огонь), ноги на y = 0.
function fzDragonPx(mode, p) {
  const K = fzPxKit(300, 150, 126, 141), { P, R, L, dth, hsh } = K, BB = [-126, -141, 173, 8];
  const t = p / 6 * Math.PI * 2, walk = mode === 'walk', idle = mode === 'idle', atk = mode === 'atk', wind = atk && p < 2, breath = atk && p >= 2;
  const SK = [[8, 26, 26], [12, 44, 40], [18, 68, 54], [28, 98, 70], [44, 130, 84], [78, 168, 100], [140, 212, 132], [206, 244, 176]];
  const SKF = [[6, 18, 20], [9, 32, 32], [14, 50, 44], [22, 74, 58], [34, 100, 70]];
  const BE = [[128, 84, 34], [176, 124, 50], [214, 166, 72], [240, 204, 110], [255, 234, 164]];
  const HO = [[64, 42, 22], [124, 88, 44], [190, 152, 86], [234, 206, 140], [255, 244, 206]];
  const HOF = [[44, 30, 18], [86, 62, 34], [134, 104, 62]];
  const MEM = [[12, 34, 46], [18, 56, 66], [28, 84, 84], [44, 116, 102], [74, 156, 124], [120, 196, 146]];
  const EMB = [[190, 56, 18], [255, 128, 36], [255, 198, 84], [255, 246, 190]];
  const FL = [[150, 28, 18], [226, 76, 22], [255, 142, 36], [255, 208, 84], [255, 250, 206]];
  const OUT = [10, 20, 18];
  const hb = walk ? -Math.round(Math.abs(Math.sin(t)) * 2) : idle ? Math.round(Math.sin(t) * 0.8) : wind ? 1 : -1;
  const br = idle ? Math.sin(t) : wind ? 2 : 0;
  const hdx = wind ? -10 : breath ? 7 : 0, hdy = (wind ? -4 : breath ? 3 : 0) + (idle ? Math.round(Math.sin(t + 1)) : walk ? Math.round(Math.sin(2 * t + 0.8)) : 0);
  const hx = 50 + hdx, hy = -106 + hb + hdy;
  const ja = breath ? 0.42 + (p & 1) * 0.05 : wind ? 0.1 : 0;
  const wa = idle ? Math.sin(t) * 0.05 : walk ? Math.sin(2 * t) * 0.06 : wind ? 0.22 : -0.06 + Math.sin(2 * t) * 0.04;
  const tsw = idle ? Math.sin(t - 1) * 5 : walk ? Math.sin(t - 1) * 7 : wind ? -4 : 4;
  const rot = (S, v, a) => [S[0] + v[0] * Math.cos(a) - v[1] * Math.sin(a), S[1] + v[0] * Math.sin(a) + v[1] * Math.cos(a)];

  // ---- скелет: шея, хвост, спина ----
  const neck = DS_bez([[14, -62 + hb], [20, -84 + hb + hdy * 0.3], [hx - 30, hy + 10], [hx - 8, hy + 3]], 9, 14, 8.6);
  const tail = DS_bez([[-34, -40 + hb], [-64, -36 + hb], [-90, -4 + tsw * 0.5], [-110, -20 + tsw]], 12, 14, 2.4);
  const torso = [[-34, -40 + hb, 17], [-20, -42 + hb, 17], [-4, -46 + hb, 17], [10, -52 + hb, 19 + br * 0.6]];
  const J = [hx - 6, hy + 5], jawTip = rot(J, [31, 1], ja), upTip = [hx + 28, hy + 5];
  const glowC = atk ? [neck[4][0] + 4, neck[4][1] + 6] : [12, -48 + hb], glow = idle ? 0.55 + Math.sin(t) * 0.2 : walk ? 0.5 : wind ? 1.05 : 0.85;
  const glowAt = (x, y) => glow * Math.max(0, 1 - Math.hypot(x - glowC[0], y - glowC[1]) / 28);

  // ---- искры-ореол (позади) ----
  const sparks = front => { for (let k = 0; k < 8; k++) if ((k & 1) === +front) { const x = -100 + hsh(k * 3.7) * 230, y = -6 - ((k * 13 + p * 6) % 36) * 3.6; P(x + Math.sin(t + k) * 2, y, k % 3 ? [255, 214, 110] : [255, 246, 200], 0.75, false); } };
  sparks(false);

  // ---- крыло: мембрана складками между пальцами, кости слиты в одну форму ----
  const wing = (S, a, near) => {
    const s = near ? 1.06 : 1, V = (x, y) => rot(S, [x * s, y * s], a);
    const E = V(-20, -24), Wr = V(-14, -58), T = [V(-68, -70), V(-90, -44), V(-82, -14), V(-56, -1)], A = V(-30, 13);
    const pull = (a2, b) => { const m = [(a2[0] + b[0]) / 2, (a2[1] + b[1]) / 2]; return [m[0] + (Wr[0] - m[0]) * 0.27, m[1] + (Wr[1] - m[1]) * 0.27]; };
    const poly = [S, E, Wr, T[0], pull(T[0], T[1]), T[1], pull(T[1], T[2]), T[2], pull(T[2], T[3]), T[3], pull(T[3], A), A];
    const fing = T.map(q => DS_cap(Wr[0], Wr[1], q[0], q[1], 0, 0));
    const xs = poly.map(q => q[0]), ys = poly.map(q => q[1]);
    R(Math.min(...xs) - 1, Math.min(...ys) - 1, Math.max(...xs) + 1, Math.max(...ys) + 1, (x, y) => {
      if (!DS_pip(x, y, poly)) return null;
      const fd = Math.min(...fing.map(f => f(x, y)));
      let v = 0.22 + 0.5 * Math.min(1, Math.hypot(x - Wr[0], y - Wr[1]) / 80) + (near ? 0.12 : -0.04);
      if (fd < 3.5) v -= 0.14 * (1 - fd / 3.5);                                          // складка у пальца
      const m = near ? MEM : MEM.slice(0, 4);
      return m[Math.max(0, Math.min(m.length - 1, Math.floor((v + (dth(x, y) - 0.5) * 0.2) * m.length)))];
    });
    const bones = [{ f: DS_cap(S[0], S[1], E[0], E[1], 4, 3.4) }, { f: DS_cap(E[0], E[1], Wr[0], Wr[1], 3.4, 2.8) }];
    for (const q of T) bones.push({ f: DS_cap(Wr[0], Wr[1], q[0], q[1], 2.6, 1) });
    const th = V(-8, -68); bones.push({ f: DS_cap(Wr[0], Wr[1], th[0], th[1], 2.2, 0.3), mat: 'horn', k: 1.5 });
    for (const q of T) { const d = Math.hypot(q[0] - Wr[0], q[1] - Wr[1]); bones.push({ f: DS_cap(q[0], q[1], q[0] + (q[0] - Wr[0]) / d * 4, q[1] + (q[1] - Wr[1]) / d * 4, 1.3, 0.2), mat: 'horn', k: 1 }); }
    DS_body(K, bones, near ? { skin: SK, horn: HO } : { skin: SKF, horn: HOF }, { bb: [Math.round(Math.min(...xs)) - 8, Math.round(Math.min(...ys)) - 8, Math.round(Math.max(...xs)) + 8, Math.round(Math.max(...ys)) + 8], W: 3, k: 2.5 });
  };
  wing([-2, -64 + hb], wa + 0.14, false);

  // ---- лапы: бедро, голень, ступня и когти — одной формой ----
  const leg = (hx0, hy0, ph, hind) => {
    const sv = walk ? Math.sin(t + ph) * 9 : 0, lift = walk ? Math.max(0, Math.cos(t + ph)) * 7 : 0, out = [];
    let toe;
    if (hind) {
      const kn = [hx0 + 6 + sv * 0.3, hy0 + 16 - lift * 0.4], hk = [hx0 - 4 + sv * 0.8, -11 - lift]; toe = [hx0 + 8 + sv, -3 - lift];
      out.push({ f: DS_cap(hx0, hy0, kn[0], kn[1], 13, 8), front: true, fw: 6 }, { f: DS_cap(kn[0], kn[1], hk[0], hk[1], 7.5, 4.6), k: 5 }, { f: DS_cap(hk[0], hk[1], toe[0], toe[1], 4.6, 3.6), k: 4 });
    } else {
      const el = [hx0 + 4 + sv * 0.3, hy0 + 18 - lift * 0.4], wr = [hx0 + 6 + sv * 0.9, -6 - lift]; toe = [hx0 + 15 + sv, -3 - lift];
      out.push({ f: DS_cap(hx0, hy0, el[0], el[1], 11, 7.4), front: true, fw: 5 }, { f: DS_cap(el[0], el[1], wr[0], wr[1], 7.4, 5), k: 5 }, { f: DS_cap(wr[0], wr[1], toe[0], toe[1], 4.6, 3.2), k: 4 });
    }
    for (let k = 0; k < 3; k++) out.push({ f: DS_cap(toe[0] + 1, toe[1] + (k - 1) * 1.4, toe[0] + 6 + k * 0.4, toe[1] + 1.6 + (k - 1) * 1.1, 1.7, 0.3), mat: 'horn', k: 1 });
    return out;
  };
  const sv0 = walk ? 0 : 0;
  DS_body(K, [...leg(-12, -42 + hb, Math.PI, true), ...leg(22, -48 + hb, 0, false)], { skin: SKF, horn: HOF }, { bb: BB, W: 6, k: 4 });

  // ---- пасть изнутри (до тела: тело накроет челюсти, видна только щель) ----
  if (ja > 0) R(J[0], hy - 2, Math.max(upTip[0], jawTip[0]) + 1, jawTip[1] + 2, (x, y) => {
    if (!DS_pip(x, y, [[J[0] + 2, J[1]], upTip, [jawTip[0], jawTip[1] - 2]])) return null;
    return y > (J[1] + (jawTip[1] - J[1]) * (x - J[0]) / (jawTip[0] - J[0])) - 4 && x < jawTip[0] - 6 ? [186, 58, 70] : [64, 10, 22];
  });

  // ---- тело одной формой ----
  const parts = [];
  parts.push({ f: DS_tube(tail), k: 6 });
  parts.push({ f: DS_ell(-20, -42 + hb, 19, 17), k: 8, bel: 1 }, { f: DS_cap(-20, -40 + hb, 8, -44 + hb, 16, 18), k: 8, bel: 1 }, { f: DS_ell(10, -52 + hb, 19, 20 + br * 0.6), k: 8, bel: 1 });
  parts.push({ f: DS_tube(neck), k: 9, bel: 2 });
  // гребень шипов: хвост → спина → шея
  const dors = [...tail.slice().reverse(), ...torso, ...neck.slice(0, -1)];
  let acc = 0;
  for (let i = 1; i < dors.length; i++) {
    const a = dors[i - 1], b = dors[i], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
    acc += l; if (acc < 9 || i < 2) continue; acc = 0;
    const u = i / dors.length, len = u < 0.45 ? 3 + 6 * u / 0.45 : u < 0.62 ? 10 : 10 - 5 * (u - 0.62) / 0.38, nx = ty / l, ny = -tx / l;
    const bx0 = b[0] + nx * (b[2] - 1.5), by0 = b[1] + ny * (b[2] - 1.5), tx1 = b[0] + nx * (b[2] + len) - tx / l * len * 0.4, ty1 = b[1] + ny * (b[2] + len) - ty / l * len * 0.4;
    parts.push({ f: DS_cap(bx0, by0, tx1, ty1, 3.4, 0.3), mat: 'horn', k: 2 });
  }
  // хвостовое лезвие
  { const a = tail[tail.length - 2], b = tail[tail.length - 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, dx = (b[0] - a[0]) / l, dy = (b[1] - a[1]) / l;
    parts.push({ f: DS_cap(b[0], b[1], b[0] + dx * 13, b[1] + dy * 13, 5.4, 0.2), mat: 'horn', k: 2.5 });
    for (const sd of [-1, 1]) parts.push({ f: DS_cap(b[0] + dx * 3, b[1] + dy * 3, b[0] + dx * 1 - dy * sd * 8, b[1] + dy * 1 + dx * sd * 8, 2.6, 0.2), mat: 'horn', k: 2 }); }
  // ближние лапы
  parts.push(...leg(-22, -40 + hb, 0, true), ...leg(12, -46 + hb, Math.PI, false));
  // голова: череп, надбровье, морда, нижняя челюсть
  parts.push({ f: DS_ell(hx, hy, 15, 12.5), k: 6 }, { f: DS_cap(hx - 6, hy - 9, hx + 11, hy - 7, 4.3, 3.2), k: 3 });
  parts.push({ f: DS_cap(hx + 4, hy - 2, hx + 25, hy + 1, 9.5, 6.4), k: 5 }, { f: DS_ell(hx + 25, hy, 5, 4.4), k: 3 });
  parts.push({ f: DS_cap(J[0] + 2, J[1] + 1, jawTip[0], jawTip[1], 6.4, 3.4), k: ja ? 1 : 4, front: true, fw: 3 });
  // шипы на скулах, рог на носу, корона рогов
  parts.push({ f: DS_cap(hx - 8, hy + 3, hx - 21, hy + 9, 3.6, 0.4), mat: 'horn', k: 2 }, { f: DS_cap(hx - 6, hy + 8, hx - 15, hy + 17 + ja * 10, 3, 0.3), mat: 'horn', k: 2 });
  parts.push({ f: DS_cap(hx + 21, hy - 5, hx + 24, hy - 12, 2.6, 0.3), mat: 'horn', k: 1.5 });
  for (const [b0, c0, e0, r0] of [[[hx - 9, hy - 6], [hx - 18, hy - 22], [hx - 42, hy - 25], 4.2], [[hx - 4, hy - 10], [hx - 10, hy - 30], [hx - 25, hy - 42], 3.9]])
    parts.push({ f: DS_tube(DS_bez([b0, c0, e0], 8, r0, 0.7)), mat: 'horn', k: 1.5, front: true, fw: 2, W: 3 });

  const lg = [0, 1];
  const body = DS_body(K, parts, { skin: SK, belly: BE, horn: HO }, {
    bb: BB, W: 8, k: 5,
    mat2: (x, y, n, mat, ow, gx, gy, dep) => (lg[0] = gx, lg[1] = gy, 0) || mat === 'skin' && ow.bel && gy * 0.8 + gx * 0.5 > 0.32 + (dth(x, y) - 0.5) * 0.12 && dep < (ow.bel === 2 ? 7 : 11) ? 'belly' : null,
    light: (x, y, mat) => mat === 'belly' ? 0.12 + glowAt(x, y) * 0.18 : 0,
    tex: (x, y, mat, idx, ramp) => {
      if (mat === 'belly') {                                                      // пластины: в щелях тлеет огонь
        const s = Math.round(x * lg[1] - y * lg[0]), seam = ((s + 600) % 6) === 0;
        if (!seam) return null;
        const g = glowAt(x, y);
        if (g > 0.22) return EMB[Math.min(3, Math.floor(g * 3.2 + (dth(x, y) - 0.5) * 0.6))] || EMB[0];
        return dth(x, y) < 0.6 ? ramp[Math.max(0, idx - 1)] : null;
      }
      if (mat === 'skin' && idx > 0 && idx < ramp.length - 1) {                   // чешуя: по пикселю на чешуйку
        const row = Math.floor((y + 600) / 3), cx = Math.floor((x + 600 + (row & 1) * 2) / 4);
        if ((y + 600) % 3 === 2 && (x + 600 + (row & 1) * 2) % 4 === 1) return ramp[idx - 1];
        if ((y + 600) % 3 === 0 && (x + 600 + (row & 1) * 2) % 4 === 2 && idx > 3 && hsh(cx * 7 + row) > 0.5) return ramp[idx + 1];
      }
      return null;
    },
  });

  // ---- лицо ----
  if (ja > 0) {
    for (let k = 0; k < 6; k++) { const x = hx + 4 + k * 4.2; P(x, hy + 7, HO[4]); P(x, hy + 8, HO[3]); if (k % 2 === 0) P(x, hy + 9, HO[3]); }
    for (let k = 0; k < 5; k++) { const u = 0.3 + k * 0.14, x = J[0] + (jawTip[0] - J[0]) * u, y = J[1] + (jawTip[1] - J[1]) * u - 4; P(x, y, HO[4]); P(x, y - 1, HO[3]); }
  } else {
    L(hx + 1, hy + 6, hx + 27, hy + 5, 0.7, 0.7, () => SK[0]); P(hx, hy + 5, SK[0]); P(hx - 1, hy + 4, SK[0]);
    P(hx + 19, hy + 7, HO[4]); P(hx + 19, hy + 8, HO[3]); P(hx + 8, hy + 7, HO[3]);
  }
  P(hx + 27, hy - 2, SK[0]); P(hx + 28, hy - 2, SK[0]); P(hx + 27, hy - 1, SK[1]);                         // ноздря
  if (wind || breath) for (let k = 0; k < 3; k++) P(hx + 30 + k, hy - 4 - k * 2 - (p & 1), [200, 190, 180], 0.5, false);   // дымок из ноздри
  const ex = hx + 5, ey = hy - 4, blink = idle && p === 4;
  if (blink) L(ex - 4, ey + 1, ex + 4, ey + 2, 0.8, 0.8, () => SK[0]);
  else {
    R(ex - 9, ey - 9, ex + 9, ey + 9, (x, y) => {                                                       // золотой ореол
      const d = Math.hypot(x - ex, (y - ey) * 1.3);
      return d > 3 && d < 8 && body.at(x, y) <= 0 && dth(x, y) < (1 - d / 8) * 0.5 ? [255, 214, 110, 0.55] : null;
    }, false);
    R(ex - 6, ey - 4, ex + 6, ey + 4, (x, y) => {
      const yy = y - ey - (x - ex) * 0.3;
      if ((x - ex) ** 2 / 21 + yy * yy / 5.8 > 1) return null;
      if (Math.abs(x - ex - 0.5) < 0.8 && Math.abs(yy) < 2.2) return [26, 8, 4];
      return Math.hypot(x - ex, yy) < 2.6 ? [255, 238, 150] : [255, 182, 44];
    });
    L(ex - 5, ey - 3.6, ex + 5, ey - 0.4, 0.8, 0.8, () => SK[0]);                                       // тяжёлое веко
  }

  // ---- ближнее крыло ----
  wing([-2, -66 + hb], wa, true);

  // ---- огонь ----
  const M = [(upTip[0] + jawTip[0]) / 2 + 2, (upTip[1] + jawTip[1]) / 2 - 1];
  if (breath) {
    const len = Math.min(170 - M[0], 76 + (p & 1) * 5), da = ja * 0.35, ca = Math.cos(da), sa = Math.sin(da);
    R(M[0] - 2, M[1] - 34, M[0] + len + 4, M[1] + 46, (x, y) => {
      const dx = x - M[0], dy = y - M[1], d = dx * ca + dy * sa, q = -dx * sa + dy * ca;
      if (d < -1 || d > len) return null;
      const wdt = 2.5 + d * 0.26, yy = q - Math.sin(d * 0.3 + p * 1.7) * 2.6, a = Math.abs(yy) / wdt;
      if (a > 1) return null;
      const f = d / len;
      if (f > 0.7 && dth(x, y) > (1 - f) * 2.6) return f > 0.82 && dth(x + 1, y) < 0.3 ? [96, 86, 86, 0.55] : null;   // хвост пламени рассыпается в дым
      const v = (1 - a) * 0.85 + (1 - f) * 0.45 + (hsh(x * 3 + y * 7 + p) - 0.5) * 0.3;
      return FL[Math.max(0, Math.min(4, Math.floor(v * 3.3)))];
    }, false);
    for (let k = 0; k < 10; k++) P(M[0] + 10 + hsh(k + p * 9) * (len + 6), M[1] - 14 + hsh(k * 2 + p) * 34, EMB[1 + (k % 3)], 0.9, false);
  } else if (wind) for (const [dx, dy] of [[0, 0], [2, -1], [3, 1], [1, 2]]) P(upTip[0] + dx - 2, hy + 7 + dy, EMB[2], 0.8, false);
  sparks(true);
  K.outline(OUT);
  return K.done();
}
function fzDragonSprite(mode, p) { return fzPxSprite('dr' + mode + p, 100, 50, 42, 47, () => fzDragonPx(mode, p)); }

// ================= Чумной моховик =================
// Живой гриб с лицом на ножке: сиреневая шляпка в белых пятнах, пластинки снизу, зелёная плесень и споры.
// Ножка, ступни и ручки — одна форма (слиты), без воротничка. Шляпка — отдельная форма над ножкой.
// mode: 'idle' (p 0..5, на p4 моргает), 'walk' (p 0..5), 'atk' (p 0..1 замах: шляпка назад, ручки вверх; p 2..5 удар шляпкой и облако спор). Сетка 132×126 (мир 44×42).
function fzShroomPx(mode, p) {
  const K = fzPxKit(132, 126, 66, 114), { P, R, L, dth, hsh } = K, BB = [-66, -114, 65, 11];
  const t = p / 6 * Math.PI * 2;
  const CP = [[46, 20, 80], [80, 40, 120], [118, 64, 160], [156, 96, 196], [192, 136, 224], [226, 184, 244]];
  const ST = [[92, 90, 70], [128, 126, 98], [166, 166, 132], [202, 202, 168], [230, 230, 198], [250, 248, 226]];
  const SPT = [[176, 160, 196], [214, 200, 230], [240, 232, 250], [255, 252, 255]];
  const MOLD = [[60, 110, 40], [96, 156, 56], [138, 202, 84], [184, 236, 120]];
  const GL = [[48, 30, 60], [84, 46, 96]];
  const PL = [[96, 160, 52], [150, 218, 86], [206, 252, 140]];
  const OUT = [34, 14, 38];
  const walk = mode === 'walk', atk = mode === 'atk', wind = atk && p < 2, smash = atk && p >= 2;
  const bob = walk ? -Math.round(Math.abs(Math.sin(t)) * 2) : mode === 'idle' ? Math.round(Math.sin(t)) : wind ? 2 : 0;
  const tilt = walk ? Math.round(Math.sin(t - 0.8) * 2.4) : mode === 'idle' ? Math.round(Math.sin(t - 0.6) * 1.8) : wind ? -6 : 6;
  const cx = tilt, cy = -70 + bob + (smash ? 5 : wind ? -3 : 0), crx = 41, cry = 28;
  const lean = smash ? 4 : wind ? -3 : tilt * 0.4;                                     // ножка клонится вслед за шляпкой

  // споры (за телом)
  const spore = front => {
    for (let k = 0; k < 12; k++) {
      if ((k % 2 === 0) !== front) continue;
      const x = -46 + hsh(k * 2.3) * 92 + Math.sin(t + k) * 3, y = -82 + ((k * 7 + p * 5) % 30) * 1.2;
      if (Math.abs(x) < 40 && y > cy - 24) continue;
      P(x, y, PL[1 + (k & 1)], 0.8, false); if (k % 3 === 0) P(x + 1, y, PL[2], 0.6, false);
    }
  };
  spore(false);

  // ---- ножка, ступни и ручки одной формой ----
  const sx = y => lean * Math.min(1, Math.max(0, (-y - 12) / 52));
  const parts = [
    { f: DS_cap(0, -16 + bob, sx(-38), -38 + bob, 15.5, 17), k: 4 },
    { f: DS_cap(sx(-38), -38 + bob, sx(-64), -64 + bob, 17, 12), k: 6 },
  ];
  for (const [x, ph] of [[-8, Math.PI], [8, 0]]) {
    const sv = walk ? Math.sin(t + ph) * 7 : 0, lift = walk ? Math.max(0, Math.cos(t + ph)) * 5 : 0, fy = -4 - lift, fx = x + sv;
    parts.push({ f: DS_cap(x * 0.6, -20 + bob, fx, fy, 7, 5.5), k: 7 }, { f: DS_ell(fx + 2, fy + 1, 8.4, 4.2), k: 4, front: true, fw: 3, W: 4 });
  }
  const hands = [];
  for (const side of [-1, 1]) {
    const ph = walk ? Math.sin(t + (side > 0 ? 0 : Math.PI)) * 5 : 0, sh = [sx(-46) + side * 13, -46 + bob];
    let hx, hy;
    if (wind) { hx = sh[0] + side * 6; hy = sh[1] - 22; }
    else if (smash) { hx = sh[0] + 18 - (side < 0 ? 6 : 0); hy = sh[1] + 4 + (p & 1) * 2; }
    else { hx = sh[0] + side * 11 + ph * 0.3; hy = sh[1] + 15 + (mode === 'idle' ? Math.round(Math.sin(t + side)) : 0); }
    parts.push({ f: DS_cap(sh[0], sh[1], hx, hy, 5, 3.8), k: 6, front: side > 0, fw: 3 }, { f: DS_ell(hx, hy + 1, 4.8, 4.4), k: 3 });
    hands.push([hx, hy]);
  }
  const stalk = DS_body(K, parts, { skin: ST }, {
    bb: BB, W: 9, k: 5,
    light: (x, y) => -0.3 * (1 - DS_sst(cy + 3, cy + 16, y)),
    tex: (x, y, mat, idx, ramp) => {
      const v = hsh(Math.floor(x / 2) * 7 + Math.floor((y - bob) / 2) * 13);
      if (v > 0.93 && ((x + y) & 1) === 0) return MOLD[Math.max(0, Math.min(3, idx - 1))];                 // плесень по свету формы
      return null;
    },
  });
  for (const [hx, hy] of hands) for (let k = -1; k <= 1; k++) P(hx + k * 2, hy + 5, ST[1]);               // пальчики

  // ---- лицо ----
  const fx = sx(-32) + 3, fy = -33 + bob, jw = smash ? 5 : wind ? 2 : mode === 'idle' && p === 3 ? 1 : 0;
  const blink = mode === 'idle' && p === 4;
  for (const [ex, sd] of [[fx - 6, -1], [fx + 8, 1]]) {
    R(ex - 6, fy - 6, ex + 6, fy + 6, (x, y) => {                                                        // впалые круги — мягко в цвет ножки
      const d = Math.hypot((x - ex) / 5.6, (y - fy - 0.5) / 5.8);
      return d <= 1 && dth(x, y) < (1 - d) * 2.2 ? (d < 0.75 ? [96, 54, 104] : [132, 104, 128]) : null;
    });
    if (blink) L(ex - 4, fy + 1, ex + 4, fy + 1, 1, 1, () => OUT);
    else R(ex - 4, fy - 5, ex + 4, fy + 5, (x, y) => {
      if (((x - ex) / 3.8) ** 2 + ((y - fy) / 4.2) ** 2 > 1) return null;
      if (y < fy - 1.5 + (sd < 0 ? 1 : -1) * (x - ex) * 0.4 - (smash ? 1 : 0)) return null;             // злой скос
      if (((x - ex - 0.6) / 1.5) ** 2 + ((y - fy + 0.5) / 2.2) ** 2 <= 1) return [30, 16, 8];
      return y > fy + 1.5 ? [246, 226, 120] : [250, 246, 214];
    });
    L(ex - 5, fy - 5 + (sd < 0 ? -1 : 1) * 1.5, ex + 5, fy - 5 + (sd < 0 ? 1 : -1) * 1.5, 1.2, 1.2, () => GL[0]);
  }
  P(fx + 1, fy + 3, ST[1]); P(fx + 1, fy + 4, ST[1]);
  R(fx - 7, fy + 6, fx + 9, fy + 14 + jw, (x, y) => {
    const d = ((x - (fx + 1)) / (7 + jw * 0.3)) ** 2 + ((y - (fy + 9)) / (2.2 + jw * 0.9)) ** 2;
    if (d > 1) return null;
    if (d > 0.7) return [60, 16, 40];
    return (y - fy) % 4 === 0 && dth(x, y) > 0.3 ? [220, 70, 80] : [60, 16, 40];
  });
  for (let k = 0; k < 4; k++) { const x = fx - 4 + k * 3; P(x, fy + 7, ST[5]); P(x, fy + 8, ST[5]); if (jw > 1) P(x + 1, fy + 11 + jw, ST[5]); }
  for (const [dx, dy] of [[-12, 8], [12, 12], [-9, 20]]) if (stalk.at(fx + dx, fy + dy) < -1) { P(fx + dx, fy + dy, PL[1]); P(fx + dx + 1, fy + dy, PL[0]); P(fx + dx, fy + dy + 1, PL[0]); }

  // ---- шляпка: пластинки снизу узкой дугой, купол одной формой, пятна красятся по его свету ----
  const yb = x => cy + 3 + 4 * Math.max(0, 1 - ((x - cx) / crx) ** 2), capF = (x, y) => Math.max(DS_ell(cx, cy + 3, crx, cry + 7)(x, y), y - yb(x));
  const spots = [[-26, -8, 6, 4.4], [-6, -17, 7.4, 5], [16, -9, 6.4, 4.4], [31, -1, 4.6, 3.2], [-14, 0, 3.6, 2.4], [4, -2, 3, 2]];
  DS_body(K, [{ f: capF }, ...spots.map(([a, b, rx, ry]) => ({ f: DS_ell(cx + a, cy + b, rx, ry), zone: true, mat: 'spot' }))], { cap: CP, spot: SPT }, {
    bb: BB, W: 16, mat: 'cap', amb: 0.24,
    tex: (x, y, mat, idx, ramp) => mat === 'cap' && hsh(Math.floor(x / 2) * 11 + Math.floor(y / 2) * 5) > 0.93 && ((x + y) & 1) === 0 ? MOLD[Math.min(3, idx)] : null,
  });
  // слизь с края шляпки
  for (const [dx, len] of [[-30, 5], [-14, 8], [6, 4], [22, 7], [35, 3]]) {
    const L2 = len + (walk ? Math.round(Math.sin(t + dx) * 1.5) : 0) + (smash ? 3 : 0);
    for (let y = 0; y < L2; y++) { const c = y > L2 - 2 ? PL[2] : PL[1]; const y0 = Math.floor(yb(cx + dx)) + 1; P(cx + dx, y0 + y, c); P(cx + dx + 1, y0 + y, y === 0 ? PL[1] : PL[0]); }
  }

  // облако спор при ударе
  if (smash) {
    const k0 = (p - 2) / 3;
    R(cx + 28, cy - 30, cx + 70, cy + 40, (x, y) => {
      const d = Math.hypot((x - cx - 48 - k0 * 6) / (16 + k0 * 8), (y - cy - 12) / (22 + k0 * 4));
      if (d > 1) return null;
      return dth(x, y) < (1 - d) * 1.4 ? [...PL[1 + (hsh(x * 5 + y * 3) > 0.6 ? 1 : 0)], 0.8] : null;
    }, false);
    for (let k = 0; k < 14; k++) P(cx + 34 + hsh(k + p) * 34, cy - 22 + hsh(k * 2 + p * 3) * 50, PL[2], 0.9, false);
  } else if (wind) for (let k = 0; k < 6; k++) P(cx + hsh(k) * 70 - 35, cy - 36 - hsh(k + 4) * 14, PL[1], 0.7, false);
  spore(true);
  K.outline(OUT);
  return K.done();
}
const DS_inE2 = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
function fzShroomSprite(mode, p) { return fzPxSprite('sh' + mode + p, 44, 42, 22, 38, () => fzShroomPx(mode, p)); }
