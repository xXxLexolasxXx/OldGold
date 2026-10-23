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

// ================= Чумной моховик =================
// Живой гриб с лицом на ножке: сиреневая шляпка в белых пятнах, пластинки снизу, зелёная плесень и споры.
// Ножка, ступни и ручки — одна форма (слиты), без воротничка. Шляпка — отдельная форма над ножкой.
// mode: 'idle' (p 0..5, на p4 моргает), 'walk' (p 0..5), 'atk' (p 0..1 замах: шляпка назад, ручки вверх; p 2..5 удар шляпкой и облако спор). Сетка 132×132 (мир 44×44).
function fzShroomPx(mode, p) {
  const K = fzPxKit(132, 132, 66, 120), { P, R, L, dth, hsh } = K, BB = [-66, -120, 65, 11];
  const t = p / 6 * Math.PI * 2;
  const CP = [[46, 20, 80], [80, 40, 120], [118, 64, 160], [156, 96, 196], [192, 136, 224], [226, 184, 244]];
  const ST = [[92, 90, 70], [128, 126, 98], [166, 166, 132], [202, 202, 168], [230, 230, 198], [250, 248, 226]];
  const SPT = [[176, 160, 196], [214, 200, 230], [240, 232, 250], [255, 252, 255]];
  const MOLD = [[60, 110, 40], [96, 156, 56], [138, 202, 84], [184, 236, 120]];
  const GL = [[48, 30, 60], [84, 46, 96]];
  const PL = [[96, 160, 52], [150, 218, 86], [206, 252, 140]];
  const OUT = [34, 14, 38];
  const walk = mode === 'walk', atk = mode === 'atk', wind = atk && p < 2, smash = atk && p >= 2;
  const bob = (walk ? -Math.round(Math.abs(Math.sin(t)) * 2) : mode === 'idle' ? Math.round(Math.sin(t)) : wind ? 2 : 0) - 13;   // −13: тело выше, ноги длиннее
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
    { f: DS_cap(0, -22 + bob, sx(-38), -38 + bob, 14, 17), k: 4 },
    { f: DS_cap(sx(-38), -38 + bob, sx(-64), -64 + bob, 17, 12), k: 6 },
  ];
  for (const [x, ph] of [[-9, Math.PI], [9, 0]]) {
    const sv = walk ? Math.sin(t + ph) * 8 : 0, lift = walk ? Math.max(0, Math.cos(t + ph)) * 6 : 0, fy = -4 - lift, fx = x + sv;
    const kn = [x + sv * 0.5 + 1.5, -17 - lift * 0.6];                                // колено чуть вперёд
    parts.push({ f: DS_cap(x * 0.7, -24 + bob, kn[0], kn[1], 6.6, 5.4), k: 6, front: true, fw: 3 }, { f: DS_cap(kn[0], kn[1], fx, fy, 5.4, 4.8), k: 2.5 }, { f: DS_ell(fx + 2, fy + 1, 8.4, 4.2), k: 4, front: true, fw: 3, W: 4 });
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

  // ---- лицо: злое — брови резко сведены, глаза-щёлки с ядовитым огнём, складки на переносице, оскал с кривыми зубами ----
  const fx = sx(-32) + 3, fy = -33 + bob, jw = smash ? 5 : wind ? 3 : 1;
  const blink = mode === 'idle' && p === 4;
  for (const [ex, sd] of [[fx - 6, -1], [fx + 8, 1]]) {
    R(ex - 7, fy - 7, ex + 7, fy + 6, (x, y) => {                                                        // впалые тёмные глазницы
      const d = Math.hypot((x - ex) / 6.2, (y - fy) / 5.4);
      return d <= 1 && dth(x, y) < (1 - d) * 2.4 ? (d < 0.7 ? [84, 40, 92] : [126, 96, 122]) : null;
    });
    if (blink) L(ex - 4, fy + 1, ex + 4, fy, 1, 1, () => OUT);
    else R(ex - 5, fy - 4, ex + 5, fy + 4, (x, y) => {
      if (((x - ex) / 4.4) ** 2 + ((y - fy - 0.5) / 3.2) ** 2 > 1) return null;
      if (y < fy - 1 - sd * (x - ex) * 0.75 - (smash ? 1 : 0)) return null;                         // веко срезано бровью к переносице
      if (Math.abs(x - ex + sd * 0.8) < 1 && Math.abs(y - fy - 0.6) < 1.6) return [150, 10, 14];   // зрачок-уголёк
      return Math.hypot(x - ex, y - fy) < 2.4 ? [226, 250, 110] : [176, 214, 64];
    });
    L(ex + sd * 6.5, fy - 6.5, ex - sd * 5, fy - 1.5, 1.6, 1.3, () => GL[0]);                            // бровь: снаружи высоко, к носу низко
    P(ex + sd * 7, fy - 7, GL[0]);
  }
  for (const dx of [0, 2]) L(fx + dx, fy - 7, fx + dx + (dx ? 0.5 : -0.5), fy - 2, 0.6, 0.6, () => ST[1]);   // складки на переносице
  P(fx + 1, fy + 2, ST[1]); P(fx, fy + 3, ST[0]); P(fx + 2, fy + 3, ST[0]);                               // ноздри
  L(fx - 4, fy + 2, fx - 8, fy + 8, 0.6, 0.6, () => ST[1]); L(fx + 6, fy + 2, fx + 10, fy + 8, 0.6, 0.6, () => ST[1]);   // носогубные складки
  const mx = fx + 1, top = x => fy + 7 + ((x - mx) / 8) ** 2 * 2.5, bot = x => top(x) + 2 + jw * Math.max(0, 1 - ((x - mx) / 9.5) ** 2);
  R(mx - 10, fy + 5, mx + 10, fy + 16 + jw, (x, y) => {                                                     // оскал: уголки вниз
    if (Math.abs(x - mx) > 9.5 || y < top(x) || y > bot(x)) return null;
    if (y > bot(x) - 1.5 && Math.abs(x - mx) < 5 && jw > 2) return [190, 60, 80];
    return [46, 8, 26];
  });
  for (let k = -3; k <= 3; k++) {
    const x = mx + k * 2.6, tl = (k === -2 || k === 2) ? 3 : (k & 1) ? 1 : 2;                             // верхние: клыки длиннее, кривые
    for (let q = 0; q < tl; q++) P(x + (q === 2 ? (k < 0 ? -0.6 : 0.6) : 0), top(x) + 0.5 + q, q ? ST[4] : ST[5]);
    if (jw > 1 && Math.abs(k) < 3) { const yb = bot(x); P(x + 1, yb - 0.5, ST[4]); if (k % 2 === 0) P(x + 1, yb - 1.5, ST[5]); }
  }
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
function fzShroomSprite(mode, p) { return fzPxSprite('sh' + mode + p, 44, 44, 22, 40, () => fzShroomPx(mode, p)); }
