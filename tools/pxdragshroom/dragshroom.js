'use strict';
// Пиксель-арт дракончика и чумного моховика тем же методом, что Полудница (fzNoonPx): сетка ×3 мельче мирового,
// свой растеризатор fzPxKit из js/world/fairy2.js, рампы палитры, дизеринг Байера, слои сзади вперёд, обводка в конце.
// Пока только лист-картинка (sheet.html); в игру не подключено.
const DS_inE = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const DS_pip = (x, y, poly) => {                       // точка в многоугольнике
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
};
// закрашенный эллипс с освещением сверху-слева: рампа тёмный → светлый, дизеринг на стыках оттенков
function DS_blob(K, cx, cy, rx, ry, ramp, o = {}) {
  const { R, dth } = K, n = ramp.length;
  R(cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1, (x, y) => {
    if (!DS_inE(x, y, cx, cy, rx, ry) || (o.clip && !o.clip(x, y))) return null;
    const l = -((x - cx) / rx) * 0.45 - ((y - cy) / ry) * 0.65;
    const v = l * 0.5 + 0.5 + (dth(x, y) - 0.5) * 0.2 + (o.bias || 0);
    return ramp[Math.max(0, Math.min(n - 1, Math.floor(v * n)))];
  }, o.sol !== false);
}

// ================= Дракончик =================
// mode: 'idle' (p 0..5, на p4 моргает), 'walk' (p 0..5), 'atk' (p 0..1 замах, p 2..5 струя огня). Смотрит вправо, сетка 168×108 (мир 56×36, справа запас под струю огня).
function fzDragonPx(mode, p) {
  const K = fzPxKit(168, 108, 60, 98), { P, R, L, dth, hsh } = K;
  const t = p / 6 * Math.PI * 2;
  const G = [[16, 46, 34], [28, 86, 56], [48, 134, 74], [88, 180, 96], [146, 220, 124], [206, 246, 166]];
  const B = [[150, 104, 56], [204, 160, 90], [240, 206, 126], [255, 238, 176]];
  const M = [[24, 76, 84], [40, 120, 112], [74, 168, 142], [128, 208, 164]];
  const C = [[128, 100, 76], [206, 186, 140], [248, 236, 198]];
  const FL = [[230, 70, 24], [255, 142, 36], [255, 204, 70], [255, 246, 170]];
  const OUT = [10, 30, 22];
  const walk = mode === 'walk', atk = mode === 'atk', wind = atk && p < 2, breath = atk && p >= 2;
  const bob = walk ? -Math.round(Math.abs(Math.sin(t)) * 2) : mode === 'idle' ? Math.round(Math.sin(t) * 0.8) : wind ? 2 : -1;
  const flap = walk ? Math.sin(t * 2) * 4 : mode === 'idle' ? Math.sin(t) * 3 : wind ? -3 : 9 + Math.sin(t * 2) * 2;
  const lean = wind ? -5 : breath ? 4 : 0;                                  // голова назад / вперёд
  const bx = -6, by = -32 + bob, brx = 24, bry = 20 + (mode === 'idle' ? Math.round(Math.sin(t) * 0.9) : wind ? 2 : 0);
  const topY = x => by - bry * Math.sqrt(Math.max(0, 1 - ((x - bx) / brx) ** 2));
  const rampSide = (a, b) => (u, e, s) => e ? a : s < 0 ? b : a;

  // крылья: дальнее темнее, рисуется до тела; ближнее — после
  const wing = (sx, sy, near) => {
    const f = flap * (near ? 1 : 0.8), base = near ? 1 : 0;
    const E = [sx - 6, sy - 28 - f], A = [sx - 32 + (atk && breath ? -4 : 0), sy - 46 - f * 1.3], Bt = [sx - 42, sy - 26 - f * 0.8], Ct = [sx - 33, sy - 4 - f * 0.3];
    const mid = (a, b) => [(a[0] + b[0]) / 2 + (E[0] - (a[0] + b[0]) / 2) * 0.3, (a[1] + b[1]) / 2 + (E[1] - (a[1] + b[1]) / 2) * 0.3];
    const poly = [[sx, sy], E, A, mid(A, Bt), Bt, mid(Bt, Ct), Ct, [sx - 10, sy + 12]];
    R(sx - 50, sy - 70 - Math.abs(f) * 1.4, sx + 4, sy + 14, (x, y) => {
      if (!DS_pip(x, y, poly)) return null;
      const d = Math.hypot(x - sx, y - sy) / 52, v = Math.floor((1 - d) * 3 + (dth(x, y) - 0.5) * 1.2 + (near ? 0.6 : 0));
      return M[Math.max(0, Math.min(3, v))];
    });
    for (const T of [A, Bt, Ct]) L(E[0], E[1], T[0], T[1], 1.5, 0.8, () => near ? C[1] : C[0]);
    L(sx, sy, E[0], E[1], 3, 1.8, (u, e) => e ? C[0] : near ? C[2] : C[1]);
    P(A[0], A[1], C[2]); P(Bt[0], Bt[1], C[2]); P(Ct[0], Ct[1], C[2]);        // коготки на кончиках
  };
  wing(bx - 2, by - 14, false);

  // хвост: от крупа вниз-назад с завитком и лопаткой на конце
  const sw = walk ? Math.sin(t - 1) * 6 : mode === 'idle' ? Math.sin(t - 1) * 5 : wind ? -3 : 3;
  const tail = [];
  for (let k = 0; k <= 9; k++) { const u = k / 9; tail.push([bx - 18 - u * 40, by + 6 + u * 12 - Math.sin(u * Math.PI) * 9 + Math.sin(t - u * 3) * sw * u, 10 * (1 - u) + 2.2]); }
  K.path(tail, (u, e, s) => e ? G[1] : s < 0 ? G[3] : G[2]);
  for (let k = 1; k < 8; k++) { const q = tail[k], u = k / 9; P(q[0], q[1] - q[2] + 1.5, G[4]); if (k % 2) P(q[0], q[1] + q[2] - 1, G[1]); }
  { const q = tail[9], tx = q[0] - 3, ty = q[1] + 1;                                  // лопатка
    R(tx - 7, ty - 8, tx + 3, ty + 8, (x, y) => Math.abs(x - tx + 2) + Math.abs(y - ty) * 0.8 <= 6 ? (x < tx - 2 ? C[1] : C[2]) : null); }

  // лапы: дальние темнее
  const leg = (x, ph, far, hind) => {
    const sv = walk ? Math.sin(t + ph) * 8 : 0, lift = walk ? Math.max(0, Math.cos(t + ph)) * 6 : 0;
    const R0 = far ? [G[0], G[1], G[2]] : [G[1], G[2], G[3]], fx = x + sv, fy = -3 - lift;
    DS_blob(K, x, -22 + bob, hind ? 9 : 7, hind ? 10 : 8, R0);
    L(x, -18 + bob, fx, fy, hind ? 6 : 5, 4.2, (u, e, s) => e ? R0[0] : s < 0 ? R0[2] : R0[1]);
    DS_blob(K, fx + 3, fy + 1, 8, 3.6, R0);
    for (let k = 0; k < 3; k++) L(fx + 7 + k, fy - 1 + k * 1.4, fx + 11 + k, fy + 1 + k * 1.6, 1, 0.5, () => far ? C[0] : C[2]);
  };
  leg(-19, Math.PI, true, true); leg(10, 0, true, false);

  // тело: спина зелёная, светлое пузо с пластинами, шипы по хребту
  DS_blob(K, bx, by, brx, bry, G);
  for (let i = 0; i < 7; i++) {
    const x = bx - 21 + i * 6.2, y0 = topY(x), h = 6 + (i === 3 ? 2 : 0) - Math.abs(i - 3) * 0.6;
    R(x - 4, y0 - h - 1, x + 4, y0 + 1, (px, py) => {
      const u = (y0 - py) / h; if (u < 0 || u > 1) return null;
      return Math.abs(px - x + 0.6 * u) <= 3 * (1 - u) ? (u > 0.55 ? C[2] : px < x ? C[1] : C[0]) : null;
    });
  }
  R(bx - 20, by - 4, bx + 26, by + bry + 2, (x, y) => {
    if (!DS_inE(x, y, bx + 6, by + 5, 17, bry - 3) || !DS_inE(x, y, bx, by, brx - 1, bry - 1)) return null;
    const band = (Math.floor(y - by) + 40) % 5 === 0;
    const v = -((x - bx - 6) / 17) * 0.3 - ((y - by - 5) / 17) * 0.55 + 0.45 + (dth(x, y) - 0.5) * 0.25;
    const c = B[Math.max(0, Math.min(3, Math.floor(v * 4)))];
    return band ? B[Math.max(0, Math.floor(v * 4) - 1)] : c;
  });
  for (let k = 0; k < 26; k++) {                                                   // чешуйки-крапинки на спине
    const x = bx - 22 + hsh(k * 3.1) * 40, y = topY(x) + 2 + hsh(k * 5.3) * 8;
    if (DS_inE(x, y, bx, by, brx - 2, bry - 2) && !DS_inE(x, y, bx + 6, by + 5, 17, bry - 3)) P(x, y, G[hsh(k) > 0.5 ? 1 : 4], 0.9);
  }

  // шея и голова
  const hx = 25 + lean, hy = -57 + bob + (mode === 'idle' ? Math.round(Math.sin(t + 1) * 0.8) : 0) + (wind ? 3 : breath ? -2 : 0);
  K.path([[8, by - 8, 11], [hx - 8, hy + 10, 10]], (u, e, s) => e ? G[1] : s < 0 ? G[3] : G[2]);
  const jaw = breath ? 8 : wind ? 3 : 0;
  // пасть изнутри
  if (jaw) R(hx + 6, hy + 8, hx + 32, hy + 22, (x, y) => y > hy + 8 + (x - hx - 6) * 0.05 && y < hy + 12 + jaw && x > hx + 8 && x < hx + 30 ? ((y > hy + 11 + jaw * 0.5 && x < hx + 24) ? [200, 70, 70] : [70, 14, 28]) : null);
  // нижняя челюсть
  DS_blob(K, hx + 15, hy + 12 + jaw, 12, 4.4, [G[2], G[3], G[4]], { bias: 0.1 });
  // рога (дальний темнее)
  L(hx - 8, hy - 11, hx - 21, hy - 26, 4, 1, (u, e) => e ? C[0] : u > 0.5 ? C[2] : C[1]);
  L(hx - 1, hy - 14, hx - 12, hy - 30, 4.4, 1, (u, e) => e ? C[0] : u > 0.5 ? C[2] : C[1]);
  // череп и морда
  DS_blob(K, hx, hy, 17, 15, G);
  DS_blob(K, hx + 16, hy + 5, 13, 8.4, G, { bias: 0.08 });
  for (const sx of [-4, 4, 12]) L(hx - 2 + sx * 0.4, hy - 14, hx - 6 + sx * 0.4, hy - 19 + Math.abs(sx) * 0.1, 2.2, 0.5, () => C[1]);   // гребешок
  P(hx + 25, hy + 2, G[0]); P(hx + 26, hy + 2, G[0]); P(hx + 25, hy + 3, G[0]);                                                        // ноздря
  if (jaw) for (const dx of [14, 20, 26]) { P(hx + dx, hy + 10, C[2]); P(hx + dx, hy + 11, C[2]); }                                     // зубки
  else { L(hx + 10, hy + 12, hx + 27, hy + 11, 0.9, 0.9, () => G[0]); P(hx + 9, hy + 11, G[0]); }                                       // улыбка
  // глаз: огромный, милый (в атаке — злой прищур)
  const ex = hx + 5, ey = hy - 2, blink = mode === 'idle' && p === 4;
  if (blink) { L(ex - 5, ey + 1, ex + 5, ey + 1, 1.2, 1.2, () => G[0]); }
  else {
    R(ex - 8, ey - 9, ex + 8, ey + 9, (x, y) => {
      const d = ((x - ex) / 6) ** 2 + ((y - ey) / 7) ** 2;
      if (d > 1) return null;
      if (atk && y < ey - 4 + (x - ex) * 0.5) return null;                                        // злой скос сверху
      if (d > 0.82) return G[0];
      if (((x - ex - 1) / 4.2) ** 2 + ((y - ey) / 5.4) ** 2 <= 1) {
        if (((x - ex - 1.5) / 1.8) ** 2 + ((y - ey) / 3.8) ** 2 <= 1) return [30, 14, 8];
        return y > ey + 1 ? [255, 190, 40] : [255, 232, 90];
      }
      return [250, 252, 240];
    });
    if (!atk) { P(ex - 1, ey - 3, [255, 255, 255]); P(ex, ey - 3, [255, 255, 255]); P(ex - 1, ey - 2, [255, 255, 255]); }
    if (atk) L(ex - 7, ey - 7 + (x0 => 0)(0), ex + 7, ey - 3, 1.3, 1.3, () => G[0]);
  }
  for (let k = 0; k < 6; k++) if (dth(k * 5, k) < 0.6) P(hx + 10 + (k % 3) * 2, hy + 6 + (k >> 1), [236, 120, 110], 0.6, false);                 // румянец

  // ближние лапы и ближнее крыло
  leg(-8, 0, false, true); leg(20, Math.PI, false, false);
  wing(bx + 6, by - 12, true);
  // огонь из пасти
  if (breath) {
    const mx = hx + 28, my = hy + 11 + jaw * 0.4, len = 38 + (p & 1) * 6;
    R(mx - 2, my - 22, mx + len + 4, my + 22, (x, y) => {
      const d = x - mx; if (d < -1 || d > len) return null;
      const w = 2 + d * 0.22, yy = y - my - Math.sin(d * 0.35 + p * 1.7) * 2.2, a = Math.abs(yy) / w;
      if (a > 1) return null;
      const v = (1 - a) * 0.8 + (1 - d / len) * 0.5 + (hsh(x * 3 + y * 7 + p) - 0.5) * 0.35;
      if (d / len > 0.55 && dth(x, y) > (1 - d / len) * 1.6) return null;
      return FL[Math.max(0, Math.min(3, Math.floor(v * 3)))];
    }, false);
    for (let k = 0; k < 8; k++) P(mx + 8 + hsh(k + p * 9) * (len + 6), my - 10 + hsh(k * 2 + p) * 20, FL[1 + (k & 1)], 0.9, false);   // искры
  } else if (wind) for (const [dx, dy] of [[0, 0], [3, -2], [5, 1]]) P(hx + 28 + dx, hy + 10 + dy, FL[2], 0.7, false);                      // тлеет в горле
  K.outline(OUT);
  return K.done();
}
function fzDragonSprite(mode, p) { return fzPxSprite("dr" + mode + p, 56, 36, 20, 33, () => fzDragonPx(mode, p)); }

// ================= Чумной моховик =================
// Живой гриб с лицом на ножке: сиреневая шляпка в белых пятнах, пластинки снизу, зелёная плесень и споры.
// mode: 'idle' (p 0..5, на p4 моргает), 'walk' (p 0..5), 'atk' (p 0..1 замах: шляпка назад, ручки вверх; p 2..5 удар шляпкой и облако спор). Сетка 132×126 (мир 44×42).
function fzShroomPx(mode, p) {
  const K = fzPxKit(132, 126, 66, 114), { P, R, L, dth, hsh } = K;
  const t = p / 6 * Math.PI * 2;
  const CP = [[50, 22, 84], [92, 46, 132], [136, 76, 174], [180, 116, 210], [220, 170, 238]];
  const ST = [[104, 100, 80], [150, 148, 116], [194, 192, 158], [226, 224, 192], [248, 246, 222]];
  const GL = [[56, 40, 70], [96, 52, 104]];
  const SP = [[222, 206, 238], [255, 250, 255]];
  const PL = [[96, 160, 52], [150, 218, 86], [206, 252, 140]];
  const OUT = [34, 14, 38];
  const walk = mode === 'walk', atk = mode === 'atk', wind = atk && p < 2, smash = atk && p >= 2;
  const bob = walk ? -Math.round(Math.abs(Math.sin(t)) * 2) : mode === 'idle' ? Math.round(Math.sin(t) * 1) : wind ? 2 : 0;
  const tilt = walk ? Math.round(Math.sin(t - 0.8) * 2.4) : mode === 'idle' ? Math.round(Math.sin(t - 0.6) * 1.8) : wind ? -6 : 6;
  const cx = tilt, cy = -70 + bob + (smash ? 5 : wind ? -3 : 0), crx = 41, cry = 28;
  const sx0 = 2 + (smash ? 3 : wind ? -2 : 0);                                        // ножка наклоняется вслед за ударом
  const hw = y => 12 + 5 * Math.sin(Math.PI * Math.min(1, Math.max(0, (-y - 14) / 50)));
  const sxAt = y => sx0 * Math.min(1, Math.max(0, (-y - 10) / 50));
  const inStalk = (x, y) => y < -12 + bob && y > -66 + bob && Math.abs(x - sxAt(y)) < hw(y - bob);

  // споры (за телом)
  const spore = (front) => {
    for (let k = 0; k < 12; k++) {
      const fr = k % 2 === 0; if (fr !== front) continue;
      const x = -46 + hsh(k * 2.3) * 92 + Math.sin(t + k) * 3, y = -112 + ((k * 7 + p * 5) % 30) * 1.2 + 50 - 20;
      if (Math.abs(x) < 40 && y > cy - 24) continue;
      P(x, y, PL[1 + (k & 1)], 0.8, false); if (k % 3 === 0) P(x + 1, y, PL[2], 0.6, false);
    }
  };
  spore(false);

  // ножки-ступни
  const foot = (x, ph, far) => {
    const sv = walk ? Math.sin(t + ph) * 7 : 0, lift = walk ? Math.max(0, Math.cos(t + ph)) * 5 : 0, fy = -3 - lift, fx = x + sv;
    const rp = far ? [ST[0], ST[1], ST[2]] : [ST[1], ST[2], ST[3]];
    L(x * 0.8, -16 + bob, fx, fy - 1, 6, 5, (u, e, s) => e ? rp[0] : s < 0 ? rp[2] : rp[1]);
    DS_blob(K, fx + 2, fy + 1, 8, 3.8, rp);
  };
  foot(-9, Math.PI, true); foot(9, 0, false);

  // дальняя ручка
  const arm = (side, far) => {
    const ph = walk ? Math.sin(t + (side > 0 ? 0 : Math.PI)) * 5 : 0;
    const sh = [sxAt(-44) + side * (hw(-44) - 2), -44 + bob];
    let hx, hy;
    if (wind) { hx = sh[0] + side * 5; hy = sh[1] - 22; }
    else if (smash) { hx = sh[0] + 17; hy = sh[1] + 4 + (p & 1) * 2; }
    else { hx = sh[0] + side * 11 + ph * 0.3; hy = sh[1] + 15 + (mode === 'idle' ? Math.round(Math.sin(t + side) * 1) : 0); }
    const rp = far ? [ST[0], ST[1], ST[2]] : [ST[1], ST[2], ST[3]];
    L(sh[0], sh[1], hx, hy, 4.4, 3.4, (u, e, s) => e ? rp[0] : s < 0 ? rp[2] : rp[1]);
    DS_blob(K, hx, hy + 1, 4.6, 4.2, rp);
    for (let k = -1; k <= 1; k++) P(hx + k * 2, hy + 5, far ? ST[0] : ST[2]);
  };
  arm(-1, true);

  // ножка-тело: кремовая, с плесенью и жилками
  R(-24, -70 + bob, 24, -10 + bob, (x, y) => {
    if (!inStalk(x, y)) return null;
    const w = hw(y - bob), l = -(x - sxAt(y)) / w * 0.5 + 0.55 + (dth(x, y) - 0.5) * 0.22 + ((y - bob) < -56 ? -0.2 : 0);
    let c = ST[Math.max(0, Math.min(4, Math.floor(l * 5)))];
    const mold = hsh(Math.floor(x / 2) * 7 + Math.floor((y - bob) / 2) * 13) > 0.86 + (y - bob < -50 ? 0 : 0.05);
    if (mold && ((x + y) & 1) === 0) c = PL[0];
    return c;
  });
  // воротничок-юбка на ножке
  R(-24, -52 + bob, 24, -38 + bob, (x, y) => {
    const yy = y - (-45 + bob), xx = x - sxAt(-45);
    if (yy < -4 || yy > 4 + Math.abs(xx) * 0.1) return null;
    if (Math.abs(xx) > 19 - Math.max(0, yy) * 0.8) return null;
    if (yy > 2 && dth(x, y) > 0.55) return null;
    return yy < -1 ? ST[3] : yy < 2 ? ST[2] : ST[1];
  });

  // лицо: больные глаза с кругами, злые брови, зубастая пасть
  const fx = sxAt(-32) + 3, fy = -33 + bob, jw = smash ? 5 : wind ? 2 : mode === 'idle' && p === 3 ? 1 : 0;
  const blink = mode === 'idle' && p === 4;
  for (const [ex, sd] of [[fx - 6, -1], [fx + 8, 1]]) {
    DS_blob(K, ex, fy, 5.4, 5.6, [[74, 36, 84], [110, 62, 120]]);
    if (blink) L(ex - 4, fy + 1, ex + 4, fy + 1, 1, 1, () => OUT);
    else {
      R(ex - 4, fy - 5, ex + 4, fy + 5, (x, y) => {
        if (((x - ex) / 3.8) ** 2 + ((y - fy) / 4.2) ** 2 > 1) return null;
        if (y < fy - 1.5 + (sd < 0 ? 1 : -1) * (x - ex) * 0.4 - (smash ? 1 : 0)) return null;                 // злой скос бровью
        if (((x - ex - 0.6) / 1.5) ** 2 + ((y - fy + 0.5) / 2.2) ** 2 <= 1) return [30, 16, 8];
        return y > fy + 1.5 ? [246, 226, 120] : [250, 246, 214];
      });
    }
    L(ex - 5, fy - 5 + (sd < 0 ? -1 : 1) * 1.5, ex + 5, fy - 5 + (sd < 0 ? 1 : -1) * 1.5, 1.2, 1.2, () => GL[0]);   // бровь домиком вниз к носу
  }
  P(fx + 1, fy + 3, ST[1]); P(fx + 1, fy + 4, ST[1]);                                                       // нос-бугорок
  R(fx - 7, fy + 6, fx + 9, fy + 14 + jw, (x, y) => {
    const d = ((x - (fx + 1)) / (7 + jw * 0.3)) ** 2 + ((y - (fy + 9)) / (2.2 + jw * 0.9)) ** 2;
    if (d > 1) return null;
    if (d > 0.7) return [60, 16, 40];
    return (y - fy) % 4 === 0 && dth(x, y) > 0.3 ? [220, 70, 80] : [60, 16, 40];
  });
  for (let k = 0; k < 4; k++) { const x = fx - 4 + k * 3; P(x, fy + 7 - (jw ? 0 : -0), ST[4]); P(x, fy + 8, ST[4]); if (jw > 1) { P(x + 1, fy + 11 + jw, ST[4]); } }   // зубки
  for (const [dx, dy] of [[-12, 8], [12, 12], [-9, 20]]) if (inStalk(fx + dx, fy + dy)) { P(fx + dx, fy + dy, PL[1]); P(fx + dx + 1, fy + dy, PL[0]); P(fx + dx, fy + dy + 1, PL[0]); }   // гнойнички

  // нижняя сторона шляпки: пластинки
  R(cx - crx, cy - 2, cx + crx, cy + 12, (x, y) => {
    if (!DS_inE(x, y, cx, cy + 4, crx - 1, 8) || y < cy + 1) return null;
    return (x - cx + 100) % 4 < 2 ? GL[1] : GL[0];
  });
  // шляпка
  R(cx - crx - 1, cy - cry - 1, cx + crx + 1, cy + 6, (x, y) => {
    if (!DS_inE(x, y, cx, cy + 3, crx, cry + 3) || y > cy + 3) return null;
    const l = -((x - cx) / crx) * 0.5 - ((y - cy - 3) / (cry + 3)) * 0.7;
    const v = l * 0.5 + 0.5 + (dth(x, y) - 0.5) * 0.22;
    let c = CP[Math.max(0, Math.min(4, Math.floor(v * 5)))];
    const edge = ((x - cx) / (crx - 3)) ** 2 + ((y - cy - 3) / (cry)) ** 2 > 1;
    if (edge && hsh(Math.floor(x / 2) * 3 + Math.floor(y / 2)) > 0.62) c = CP[Math.max(0, CP.indexOf(c) - 1)] || c;   // тёмный ободок
    if (hsh(Math.floor(x / 2) * 11 + Math.floor(y / 2) * 5) > 0.93 && ((x + y) & 1) === 0) c = PL[0];                  // плесень
    return c;
  });
  // белые пятна с каёмкой
  for (const [sx, sy, rx, ry] of [[-26, -8, 6, 4.4], [-6, -17, 7.4, 5], [16, -9, 6.4, 4.4], [31, -1, 4.6, 3.2], [-14, 0, 3.6, 2.4], [4, -2, 3, 2]]) {
    R(cx + sx - rx - 1, cy + sy - ry - 1, cx + sx + rx + 1, cy + sy + ry + 1, (x, y) => {
      const d = ((x - cx - sx) / rx) ** 2 + ((y - cy - sy) / ry) ** 2;
      if (d > 1 || y > cy + 3) return null;
      return d > 0.7 ? SP[0] : (x - cx - sx) + (y - cy - sy) < 0 ? SP[1] : SP[0];
    });
  }
  // слизь с края шляпки
  for (const [dx, len] of [[-30, 5], [-14, 8], [6, 4], [22, 7], [35, 3]]) {
    const L2 = len + (walk ? Math.round(Math.sin(t + dx) * 1.5) : 0) + (smash ? 3 : 0);
    for (let y = 0; y < L2; y++) { const x = cx + dx + (y > L2 - 3 ? 0 : 0); const c = y > L2 - 2 ? PL[2] : PL[1]; P(x, cy + 8 + y, c); P(x + 1, cy + 8 + y, y === 0 ? PL[1] : PL[0]); }
  }
  // ближняя ручка
  arm(1, false);

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
function fzShroomSprite(mode, p) { return fzPxSprite('sh' + mode + p, 44, 42, 22, 38, () => fzShroomPx(mode, p)); }
