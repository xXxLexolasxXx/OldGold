'use strict';
// Пиксельный гном в методе Полудницы: тело из форм (эллипсы, капсулы, трубка вдоль кривой), оттенки по нормали со светом сверху-слева,
// дизеринг Байера, цветная внутренняя и внешняя обводка. Координаты в «мировых» единицах (ступни в (0,0), вверх — минус),
// шаг пикселя S (сколько пикселей арта на единицу мира: у нынешних гномов 2, у нечисти 3).
// Главное правило: глаза всегда открыты — край колпака в середине лба выше бровей, под ним только узкая полоска тени на коже.
const GN_UW = 30, GN_UH = 44, GN_OX = 15, GN_OY = 40;
const gnHex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const gnMix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
function gnRamp(h) {
  const b = typeof h === 'string' ? gnHex(h) : h;
  return [gnMix(b, [20, 12, 38], .68), gnMix(b, [44, 30, 72], .42), b, gnMix(b, [255, 236, 190], .28), gnMix(b, [255, 248, 222], .52)];
}
const GN_B4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const gnN = (x, y) => { const z = Math.sqrt(Math.max(0, 1 - x * x - y * y)); return Math.max(0, Math.min(1, .52 + (x * -.5 + y * -.6 + z * .62 - .55) * 1.0)); };
function gnPick(r, v, px, py, dith = .5) {
  v = Math.max(0, Math.min(.999, v));
  const f = v * (r.length - 1), lo = Math.floor(f), fr = f - lo, t = (GN_B4[py & 3][px & 3] + .5) / 16;
  return r[lo + (fr > .5 + (t - .5) * dith ? 1 : 0)];
}
const gnEll = (cx, cy, rx, ry) => ({ bb: [cx - rx, cy - ry, cx + rx, cy + ry], in: (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, v: (x, y) => gnN((x - cx) / rx, (y - cy) / ry) });
function gnCap(x0, y0, x1, y1, r0, r1) {
  const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1, rm = Math.max(r0, r1);
  const q = (x, y) => { const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / l2)), ex = x - x0 - dx * t, ey = y - y0 - dy * t, r = r0 + (r1 - r0) * t; return [ex / r, ey / r]; };
  return { bb: [Math.min(x0, x1) - rm, Math.min(y0, y1) - rm, Math.max(x0, x1) + rm, Math.max(y0, y1) + rm], in: (x, y) => { const [a, b] = q(x, y); return a * a + b * b <= 1; }, v: (x, y) => { const [a, b] = q(x, y); return gnN(a, b); } };
}
const gnTri = (p, q, r) => {
  const s = (a, b, c) => (a[0] - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (a[1] - c[1]);
  return { bb: [Math.min(p[0], q[0], r[0]), Math.min(p[1], q[1], r[1]), Math.max(p[0], q[0], r[0]), Math.max(p[1], q[1], r[1])],
    in: (x, y) => { const a = [x, y], d1 = s(a, p, q), d2 = s(a, q, r), d3 = s(a, r, p); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); }, v: (x, y) => .5 };
};

// prm: S шаг; hs масштаб головы; hy центр головы; capH высота колпака; tipX/droop изгиб; bl длина бороды; eye вид глаз; det детализация 0..2; nose; ear
function gnomePx(prm, prof) {
  const S = prm.S, W = GN_UW * S, H = GN_UH * S, D = new Uint8ClampedArray(W * H * 4), SOL = new Uint8Array(W * H), SKIN = new Uint8Array(W * H);
  const hs = prm.hs, hy = prm.hy;
  const px2u = (p, o) => (p + .5) / S - o;
  const put = (x, y, c, a = 1, sol = true) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4, da = D[i + 3] / 255, oa = a + da * (1 - a);
    for (let k = 0; k < 3; k++) D[i + k] = Math.round((c[k] * a + D[i + k] * da * (1 - a)) / oa); D[i + 3] = Math.round(oa * 255); if (sol) SOL[y * W + x] = 1;
  };
  const cur = (x, y) => { const i = (y * W + x) * 4; return D[i + 3] ? [D[i], D[i + 1], D[i + 2]] : null; };
  // слой: shape ({bb,in,v}), цвет — рампа (или функция), edge — внутренняя обводка по границе слоя
  function layer(sh, col, o = {}) {
    const [bx0, by0, bx1, by1] = sh.bb, ex = 1 / S;
    for (let py = Math.max(0, Math.floor((by0 + GN_OY) * S) - 1); py <= Math.min(H - 1, Math.ceil((by1 + GN_OY) * S) + 1); py++)
      for (let px = Math.max(0, Math.floor((bx0 + GN_OX) * S) - 1); px <= Math.min(W - 1, Math.ceil((bx1 + GN_OX) * S) + 1); px++) {
        const x = px2u(px, GN_OX), y = px2u(py, GN_OY); if (!sh.in(x, y)) continue;
        let c;
        if (o.edge && !(sh.in(x - ex, y) && sh.in(x + ex, y) && sh.in(x, y - ex) && sh.in(x, y + ex))) c = o.edgeCol || (Array.isArray(col) ? col[o.edgeIdx || 0] : [20, 12, 24]);
        else c = typeof col === 'function' ? col(x, y, px, py) : gnPick(col, sh.v(x, y) + (o.bias || 0), px, py, o.dith === undefined ? .5 : o.dith);
        if (!c) continue;
        put(px, py, c, o.a === undefined ? 1 : o.a, o.sol !== false);
        if (o.skin) SKIN[py * W + px] = 1;
      }
  }
  const pf = prof;
  const skin = gnRamp(pf.skin || '#ecbc90'), coat = gnRamp(pf.coat), capc = gnRamp(pf.cap), beard = gnRamp(pf.beard), pants = gnRamp(pf.pants || '#5a4028'), boots = gnRamp('#5a3a22');
  // тень на земле
  layer(gnEll(0, .3, 8.2, 2.2), () => [0, 0, 0], { a: .34, sol: false });
  // ноги и сапоги
  for (const s of [-1, 1]) {
    layer(gnCap(s * 2.7, -6.8, s * 2.9, -3, 1.9, 1.8), pants, { edge: 1 });
    layer(gnEll(s * 3.1, -1.7, 2.7, 1.9), boots, { edge: 1 });
  }
  // куртка
  const bodyE = gnEll(0, -9.8, 5.9, 4.9), body = { bb: [-6, -14.8, 6, -5.2], in: (x, y) => y <= -5.5 && bodyE.in(x, y), v: bodyE.v };
  layer(body, coat, { edge: 1, dith: .55 });
  if (pf.apron) layer({ bb: [-4, -9, 4, -5], in: (x, y) => y > -8.2 && y <= -5.5 && Math.abs(x) <= 3.6 && bodyE.in(x, y), v: (x, y) => .55 - x * .04 }, gnRamp(pf.apron), { edge: 1 });
  // пояс с пряжкой
  layer({ bb: [-6, -8.6, 6, -7], in: (x, y) => y >= -8.5 && y <= -7.3 && bodyE.in(x, y + .01), v: (x, y) => .62 - (y + 8.5) * .5 - x * .02 }, gnRamp('#4a2c18'), { edge: 1 });
  layer(gnEll(0, -7.9, 1, .95), gnRamp('#e8c850'), { edge: 1 });
  // руки
  for (const s of [-1, 1]) {
    layer(gnCap(s * 5.2, -12.4, s * 6.4, -8.2, 1.75, 1.5), coat, { edge: 1 });
    layer(gnEll(s * 6.5, -6.9, 1.35, 1.3), skin, { edge: 1 });
  }
  // уши
  for (const s of [-1, 1]) {
    layer(gnTri([s * 4.6 * hs, hy - 1.5 * hs], [s * 5 * hs, hy + 1.6 * hs], [s * (5 + 3.8 * prm.ear) * hs, hy - 3.6 * hs]), skin, { edge: 1, bias: .05 });
    layer(gnTri([s * 5.3 * hs, hy - 1 * hs], [s * 5.5 * hs, hy + 0.8 * hs], [s * (5.3 + 2 * prm.ear) * hs, hy - 2.7 * hs]), gnRamp('#c97868'), { sol: false, bias: -.1, dith: 0 });
  }
  // голова
  const head = gnEll(0, hy, 5.7 * hs, 5.3 * hs);
  layer(head, skin, { edge: 1, skin: 1, dith: .5 });
  // борода: щёки и подбородок до пояса
  const bl = prm.bl * hs, btop = x => hy + (2.5 - 2.1 * Math.min(1, (Math.abs(x) / (5.1 * hs)) ** 1.5)) * hs;
  const bhw = y => { const t = (y - (hy + 1.2 * hs)) / (bl - 1.2 * hs); return t <= 0 ? 5.7 * hs : 5.7 * hs * Math.sqrt(Math.max(0, 1 - t * t)) * (1 - .22 * t) + .15; };
  const bshape = { bb: [-6 * hs, hy, 6 * hs, hy + bl], in: (x, y) => y >= btop(x) - .001 && y <= hy + bl && Math.abs(x) <= bhw(y), v: (x, y) => gnN(x / (5.7 * hs) * .8, (y - hy - bl * .35) / (bl * .62)) };
  layer(bshape, (x, y, px, py) => {
    const w = bhw(y), u = x / Math.max(.8, w), v = bshape.v(x, y);
    let c = gnPick(beard, v, px, py, .45);
    if (prm.det >= 1) {   // пряди по контуру бороды
      const fl = Math.abs(((u * 4.2 + Math.sin(y * .7) * .12 + 8) % 1) - .5);
      if (fl > .43 && y > hy + 3 * hs) c = gnPick(beard, v - .32, px, py, 0);
      else if (fl < .06 && y > hy + 2.6 * hs && prm.det >= 2) c = gnPick(beard, v + .3, px, py, 0);
    }
    return c;
  }, { edge: 1, dith: .5 });
  // щёки
  for (const s of [-1, 1]) layer(gnEll(s * 3.9 * hs, hy + .9 * hs, 1.25 * hs, .95 * hs), (x, y, px, py) => { const c = cur(px, py); return c ? gnMix(c, [235, 110, 110], .32) : null; }, { sol: false });
  // нос
  const nr = prm.nose, nbase = gnMix(gnHex(pf.skin || '#ecbc90'), [225, 125, 105], .28);
  layer(gnEll(0, hy + .85 * hs, 1.55 * hs * nr, 1.4 * hs * nr), gnRamp(nbase), { edge: 1, edgeIdx: 1, dith: .5 });
  layer(gnEll(-.5 * hs, hy + .3 * hs, .42 * hs, .32 * hs), () => gnRamp(nbase)[4], { sol: false });
  // усы
  const must = [gnCap(.3 * hs, hy + 2 * hs, 3.4 * hs, hy + 2.7 * hs, 1.25 * hs, .95 * hs), gnCap(3.4 * hs, hy + 2.7 * hs, 5 * hs, hy + 1.6 * hs, .9 * hs, .55 * hs)];
  for (const s of [-1, 1]) for (const m of must) {
    const sh = { bb: [Math.min(m.bb[0] * s, m.bb[2] * s), m.bb[1], Math.max(m.bb[0] * s, m.bb[2] * s), m.bb[3]], in: (x, y) => m.in(x * s, y), v: (x, y) => m.v(x * s, y) };
    layer(sh, gnRamp(gnMix(gnHex(pf.beard), [255, 255, 255], .12)), { edge: 1, edgeIdx: 1 });
  }
  // брови: кустистые, видны под краем колпака
  for (const s of [-1, 1]) layer(gnCap(s * 1.3 * hs, hy - 2.15 * hs, s * 4.1 * hs, hy - 2.45 * hs, .55 * hs, .45 * hs), beard, { edge: 1, edgeIdx: 1 });
  // колпак: трубка вдоль изогнутой оси, радиус сужается к кончику
  const baseY = hy - 5.6 * hs, capH = prm.capH, R0 = 6.3 * hs * (prm.capW || 1), N = 30;
  const ax = t => prm.tipX * t ** 2.2, ay = t => baseY - capH * (t - prm.droop * t ** 3), rr = t => R0 * (1 - t) ** 1.3 + .3;
  const yb = x => hy + (-3.7 + 1.6 * (x / (6.6 * hs)) ** 2) * hs, bandT = 1.9 * hs;
  const hit = (x, y) => { let best = 9, bt = 0; for (let i = 0; i <= N; i++) { const t = i / N, d = Math.hypot(x - ax(t), y - ay(t)) / rr(t); if (d < best) { best = d; bt = t; } } return [best, bt]; };
  const cone = { bb: [-12, baseY - capH - 4, 12, hy], in: (x, y) => y <= yb(x) - .2 && hit(x, y)[0] <= 1, v: (x, y) => { const [, t] = hit(x, y), r = rr(t); return gnN((x - ax(t)) / r, (y - ay(t)) / r * .5); } };
  layer(cone, (x, y, px, py) => {
    const v = cone.v(x, y), [, t] = hit(x, y), dx = (x - ax(t)) / rr(t);
    let c = gnPick(capc, v, px, py, .5);
    if (prm.det >= 1 && Math.abs(dx - .18) < .06 && t > .12 && t < .85) c = gnPick(capc, v - .3, px, py, 0);   // складка
    return c;
  }, { edge: 1, dith: .5 });
  if (prm.det >= 2) layer(gnEll(-1.6 * hs + ax(.35), ay(.35), 1.0, 1.0), gnRamp(gnMix(gnHex(pf.cap), [200, 170, 110], .45)), { edge: 1, edgeIdx: 1, dith: 0 });   // заплатка
  // отворот: ниже в середине лба нет, к ушам опускается — лоб и глаза открыты
  const band = { bb: [-8 * hs, hy - 6 * hs, 8 * hs, hy], in: (x, y) => { const b = yb(x), m = b - bandT / 2; return y <= b && y >= b - bandT && Math.abs(x) <= 6.9 * hs - 1.1 * hs * ((y - m) / (bandT / 2)) ** 2; }, v: (x, y) => { const b = yb(x); return .73 - .28 * ((y - (b - bandT)) / bandT) - x * .028 / hs; } };
  layer(band, (x, y, px, py) => {
    const b = yb(x); let c = gnPick(capc, band.v(x, y), px, py, .35);
    if (prm.det >= 1 && Math.abs(y - (b - bandT * .5)) < .5 / S + .12 && (Math.round(x * 1.2 * S / 2) % 2) === 0) c = capc[1];   // строчка
    return c;
  }, { edge: 1, dith: .4 });
  // тень от отворота на лбу — тонкая полоска только по коже, глаза ниже
  const th = 2.3 / S;
  layer({ bb: [-8 * hs, hy - 5 * hs, 8 * hs, hy], in: (x, y) => y > yb(x) && y <= yb(x) + th, v: () => .5 }, (x, y, px, py) => SKIN[py * W + px] ? gnMix(cur(px, py), [70, 30, 60], .38) : null, { sol: false });
  // глаза (в пикселях арта: читаются на любом масштабе)
  const exu = 2.45 * hs, eyy = hy - .85 * hs, kind = prm.eye;
  const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, c); };
  for (const s of [-1, 1]) {
    const cx = Math.round((s * exu + GN_OX) * S), cy = Math.round((eyy + GN_OY) * S), dk = [22, 14, 18];
    if (kind === 'dot') { rect(cx - 2, cy - 1, 4, 3, [236, 230, 218]); rect(cx - 1, cy - 1, 2, 3, dk); put(cx - 1, cy - 1, [255, 255, 255]); }
    else if (kind === 'big') { rect(cx - 1, cy - 2, 3, 4, dk); put(cx - 1, cy - 2, [255, 255, 255]); put(cx + 1, cy, [190, 210, 240]); }
    else if (kind === 'iris') {
      rect(cx - 2, cy - 2, 4, 1, [60, 36, 34]); rect(cx - 2, cy - 1, 4, 3, [238, 232, 220]);
      rect(cx - 1, cy - 1, 2, 3, pf.eyes || [86, 128, 70]); rect(cx - 1, cy, 2, 1, dk); put(cx - 1, cy - 1, [255, 255, 255]);
    } else {   // fine, S=6
      rect(cx - 4, cy - 3, 8, 6, [238, 232, 220]); rect(cx - 4, cy - 3, 8, 1, [150, 120, 118]); rect(cx - 3, cy - 2, 6, 1, [206, 192, 186]);
      rect(cx - 2, cy - 3, 4, 6, pf.eyes || [58, 92, 128]); rect(cx - 1, cy - 1, 2, 3, dk); rect(cx - 2, cy - 2, 2, 1, [255, 255, 255]); rect(cx + 1, cy + 1, 1, 1, [190, 215, 240]);
      rect(cx - 4, cy - 4, 8, 1, [40, 24, 24]); rect(cx - 5, cy - 3, 1, 1, [40, 24, 24]); rect(cx + 4, cy - 3, 1, 1, [40, 24, 24]);
    }
  }
  // свеча на колпаке шахтёра
  if (pf.candle) {
    const cx = Math.round(GN_OX * S), cy = Math.round((yb(0) - bandT + GN_OY) * S), cw = Math.max(2, Math.round(S * .9)), ch = Math.round(S * 1.7), x0 = cx - Math.round(S * .5);
    rect(x0, cy - ch, cw, ch, [240, 228, 190]); rect(x0, cy - ch, 1, ch, [255, 250, 226]);
    const fh = Math.round(S * 1.0); rect(x0, cy - ch - fh, cw, fh, [255, 200, 60]); rect(x0 + (cw > 2 ? 1 : 0), cy - ch - fh - 1, Math.max(1, cw - 2), fh, [255, 244, 170]);
  }
  // обводка по силуэту: цвет — потемневший цвет ближайших пикселей
  const nbs = i => { const x = i % W, y = (i / W) | 0; return [x > 0 && SOL[i - 1] ? i - 1 : -1, x < W - 1 && SOL[i + 1] ? i + 1 : -1, y > 0 && SOL[i - W] ? i - W : -1, y < H - 1 && SOL[i + W] ? i + W : -1].filter(k => k >= 0); };
  const out = [];
  for (let i = 0; i < W * H; i++) if (!SOL[i]) { const nb = nbs(i); if (nb.length) out.push([i, nb]); }
  for (const [i, nb] of out) {
    let r = 0, g = 0, b = 0; for (const k of nb) { r += D[k * 4]; g += D[k * 4 + 1]; b += D[k * 4 + 2]; }
    const c = gnMix([r / nb.length, g / nb.length, b / nb.length], [18, 10, 24], .74);
    D[i * 4] = c[0]; D[i * 4 + 1] = c[1]; D[i * 4 + 2] = c[2]; D[i * 4 + 3] = 255;
  }
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  cv.getContext('2d').putImageData(new ImageData(D, W, H), 0, 0); cv.gnS = S; return cv;
}
