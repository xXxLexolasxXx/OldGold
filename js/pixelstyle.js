'use strict';
// Пиксельный стиль материалов зданий. Подключается после buildings.js/bmodels.js и
// подменяет генераторы текстур: вместо случайных градиентов и шума — ровная кладка из
// плоских пятен цвета, рампы оттенков со сдвигом (свет тёплый, тень холодная), 1-px швы.
// Спрайт потом сводится в пиксель-арт ×3 (toPixelArt), поэтому все детали кратны
// 1/3 мирового пикселя: PXU — один пиксель будущего арта.

const PXU = 1 / 3;

// детерминированный шум 0..1 по целым координатам (узор не плывёт при перерисовке)
function hsh(a, b, s = 0) { const n = Math.sin(a * 127.1 + b * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); }
const clampI = (v, a, b) => (v < a ? a : v > b ? b : v);

// Рампа из 6 оттенков: 0 — самый светлый (теплее), 5 — самый тёмный (холоднее, лиловее)
const RAMP_CACHE = new Map();
function rampOf(col) {
  if (!col) col = '#a49c90';
  let r = RAMP_CACHE.get(col);
  if (r) return r;
  const [R0, G0, B0] = hexToRgb(col);
  r = [];
  for (let i = 0; i < 6; i++) {
    const t = (i - 2) / 3;   // -0.67 … +1
    let R, G, B;
    if (t < 0) { const f = -t * 0.58; R = R0 + (255 - R0) * f * 1.05; G = G0 + (255 - G0) * f * 0.95; B = B0 + (255 - B0) * f * 0.7; }
    else { const f = t * 0.58; R = R0 * (1 - f) * 0.97; G = G0 * (1 - f) * 0.985; B = B0 * (1 - f) + 3 * t; }
    r.push(`rgb(${clampI(Math.round(R), 0, 255)},${clampI(Math.round(G), 0, 255)},${clampI(Math.round(B), 0, 255)})`);
  }
  RAMP_CACHE.set(col, r);
  return r;
}

// ================= Крыши =================
// Координаты ската: x — вдоль ската от свеса (0) к коньку (Lu), y — вдоль свеса (0…Lv).
// Ряды у свеса темнее, у конька светлее — ступенями, а не градиентом.
function rowShade(u, Lu) { return u < Lu * 0.3 ? 1 : u < Lu * 0.72 ? 0 : -1; }

ROOF.tiles = function (c, Lu, Lv, col) {
  const R = rampOf(col), TH = 3.6, TW = 4.2;
  c.fillStyle = R[4]; c.fillRect(-2, -2, Lu + 4, Lv + 4);
  for (let u = -TH, row = 0; u < Lu + TH; u += TH, row++) {
    const base = 2 + rowShade(u, Lu), off = row % 2 ? TW / 2 : 0;
    for (let v = -TW + off, k = 0; v < Lv + TW; v += TW, k++) {
      const n = hsh(k, row, 1), vr = n < 0.1 ? 1 : 0;
      c.fillStyle = R[clampI(base + vr, 0, 5)];
      c.fillRect(u + 0.55, v + 0.3, TH - 0.55, TW - 0.6);
    }
    // блик по нижней кромке ряда и тень под кромкой следующего
    c.fillStyle = R[clampI(base - 1, 0, 5)]; c.fillRect(u + 0.55, -2, PXU, Lv + 4);
    c.fillStyle = R[5]; c.fillRect(u + TH - 0.45, -2, 0.45, Lv + 4);
  }
};

ROOF.slate = function (c, Lu, Lv, col) {
  const R = rampOf(col), TH = 3.2, TW = 3.2;
  c.fillStyle = R[5]; c.fillRect(-2, -2, Lu + 4, Lv + 4);
  for (let u = -TH, row = 0; u < Lu + TH; u += TH, row++) {
    const base = 2 + rowShade(u, Lu), off = row % 2 ? TW / 2 : 0;
    for (let v = -TW + off, k = 0; v < Lv + TW; v += TW, k++) {
      const n = hsh(k, row, 2), vr = n < 0.14 ? 1 : n > 0.92 ? -1 : 0;
      c.fillStyle = R[clampI(base + vr, 0, 5)];
      c.fillRect(u + 0.45, v + 0.35, TH - 0.45, TW - 0.35);
    }
    c.fillStyle = R[clampI(base - 1, 0, 5)]; c.fillRect(u + 0.45, -2, PXU, Lv + 4);
  }
};

ROOF.shingle = function (c, Lu, Lv, col) {
  const R = rampOf(col), TW = 3.4, SL = 4.2;
  c.fillStyle = R[5]; c.fillRect(-2, -2, Lu + 4, Lv + 4);
  for (let v = -TW, k = 0; v < Lv + TW; v += TW, k++) {
    const start = -SL * hsh(k, 0, 3);
    for (let u = start, j = 0; u < Lu + SL; u += SL, j++) {
      const base = 2 + rowShade(u, Lu), n = hsh(k, j, 4), vr = n < 0.16 ? 1 : n > 0.86 ? -1 : 0;
      c.fillStyle = R[clampI(base + vr, 0, 5)];
      c.fillRect(u + 0.5, v + 0.4, SL - 0.5, TW - 0.4);
      c.fillStyle = R[clampI(base - 2, 0, 5)]; c.fillRect(u + 0.5, v + 0.4, PXU, TW - 0.4);    // освещённый торец
    }
  }
};

ROOF.thatch = function (c, Lu, Lv, col) {
  const R = rampOf(col), LAY = 5.2;
  c.fillStyle = R[2]; c.fillRect(-2, -2, Lu + 4, Lv + 4);
  // слои соломы: внутри слоя — вертикальные пряди шириной в 1 мировой пиксель
  for (let u = -LAY, L = 0; u < Lu + LAY; u += LAY, L++) {
    const base = 2 + rowShade(u, Lu);
    for (let v = -1, k = 0; v < Lv + 1; v += 1, k++) {
      const n = hsh(k, L, 5), vr = n < 0.1 ? -1 : n < 0.3 ? 1 : 0;
      c.fillStyle = R[clampI(base + vr, 0, 5)];
      c.fillRect(u, v, LAY, 1);
    }
    // тень под кромкой слоя и подсвеченная кромка
    c.fillStyle = R[5]; c.fillRect(u + LAY - 0.5, -2, 0.5, Lv + 4);
    c.fillStyle = R[clampI(base - 2, 0, 5)]; c.fillRect(u + LAY - 0.5 - PXU, -2, PXU, Lv + 4);
    // редкие тёмные прядки, свисающие с кромки
    for (let v = hsh(L, 9, 6) * 4; v < Lv; v += 6 + hsh(L, v | 0, 7) * 5) { c.fillStyle = R[3]; c.fillRect(u + LAY - 1.6, v, 1, PXU * 2); }
  }
  // толстый подстриженный край у свеса
  c.fillStyle = R[4]; c.fillRect(-2, -2, 3.2, Lv + 4);
  c.fillStyle = R[3]; for (let v = 0; v < Lv; v += 2) c.fillRect(0.2, v, 1, 1);
};

ROOF.moss = function (c, Lu, Lv, col) {
  ROOF.shingle(c, Lu, Lv, col);
  // мох аккуратными кочками, гуще у свеса; каждая — тень, тело, блик
  const n = Math.round(Lu * Lv / 85);
  for (let k = 0; k < n; k++) {
    const u = Math.pow(hsh(k, 1, 8), 1.5) * (Lu + 2) - 1, v = hsh(k, 2, 8) * (Lv + 2) - 1, r = 1.3 + hsh(k, 3, 8) * 1.8;
    const g = GMOSS[1 + ((hsh(k, 4, 8) * 2) | 0)];
    ellipse(c, u - 0.4, v + 0.5, r, r * 0.75, GMOSS[0]);
    ellipse(c, u, v, r, r * 0.75, g);
    ellipse(c, u + r * 0.25, v - r * 0.25, r * 0.45, r * 0.3, GMOSS[3]);
    if (r > 2.2) { ellipse(c, u - r * 0.5, v + r * 0.6, r * 0.5, r * 0.4, g); }
  }
};

ROOF.turf = function (c, Lu, Lv, col) {
  const R = rampOf(col), LAY = 4;
  c.fillStyle = R[2]; c.fillRect(-2, -2, Lu + 4, Lv + 4);
  for (let u = -LAY, L = 0; u < Lu + LAY; u += LAY, L++) {
    const base = 2 + rowShade(u, Lu);
    for (let v = -1, k = 0; v < Lv + 1; v += 1, k++) {
      const n = hsh(k, L, 10), vr = n < 0.22 ? -1 : n < 0.4 ? 1 : 0;
      c.fillStyle = R[clampI(base + vr, 0, 5)];
      c.fillRect(u, v, LAY, 1);
    }
    c.fillStyle = R[4]; c.fillRect(u + LAY - 0.4, -2, 0.4, Lv + 4);
    // травинки, торчащие из слоя
    for (let v = hsh(L, 5, 11) * 3; v < Lv; v += 2.5 + hsh(L, v | 0, 12) * 3) { c.fillStyle = R[0]; c.fillRect(u + LAY - 1.8, v, 1.4, PXU); }
  }
  // цветы: по два пикселя, с тёмным основанием
  const fl = ['#f4f4f4', '#f0d040', '#e06a8a', '#a0b8f0'];
  for (let k = 0; k < Lu * Lv / 90; k++) {
    const u = 3 + hsh(k, 1, 13) * (Lu - 4), v = hsh(k, 2, 13) * Lv;
    c.fillStyle = fl[(hsh(k, 3, 13) * 4) | 0]; c.fillRect(u, v, PXU * 2, PXU * 2);
    c.fillStyle = R[4]; c.fillRect(u - PXU, v, PXU, PXU * 2);
  }
  // край свеса — земля с корешками
  c.fillStyle = '#45291a'; c.fillRect(-2, -2, 3.4, Lv + 4);
  c.fillStyle = '#6e432a'; for (let v = 0; v < Lv; v += 2.6) c.fillRect(0.4, v, 0.8, 1);
  c.fillStyle = R[1]; for (let v = 1; v < Lv; v += 3.4) c.fillRect(1.4, v, 1, 1.4);
};

// Скат без градиента: только ровная освещённость грани
plane = function (c, P0, U, V, mat, col, light = 1, clipPts = null) {
  const Lu = Math.hypot(U[0], U[1]), Lv = Math.hypot(V[0], V[1]);
  if (Lu < 0.5 || Lv < 0.5) return;
  const pts = clipPts || [P0, [P0[0] + U[0], P0[1] + U[1]], [P0[0] + U[0] + V[0], P0[1] + U[1] + V[1]], [P0[0] + V[0], P0[1] + V[1]]];
  c.save();
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath();
  c.clip();
  c.transform(U[0] / Lu, U[1] / Lu, V[0] / Lv, V[1] / Lv, P0[0], P0[1]);
  ROOF[mat](c, Lu, Lv, col);
  if (light > 1) { c.fillStyle = `rgba(255,240,210,${(light - 1) * 0.8})`; c.fillRect(-2, -2, Lu + 4, Lv + 4); }
  if (light < 1) { c.fillStyle = `rgba(15,8,2,${1 - light})`; c.fillRect(-2, -2, Lu + 4, Lv + 4); }
  c.restore();
};

// ================= Стены =================

wallTex = function (c, kind, x, y, w, h, col) {
  c.save();
  c.beginPath(); c.rect(x, y, w, h); c.clip();
  const R = rampOf(col);
  if (kind === 'stone' || kind === 'fieldstone') {
    const field = kind === 'fieldstone', rh = field ? 5.4 : 4.6, widths = field ? [4.2, 5.4, 6.6] : [5.2, 6.4, 8];
    c.fillStyle = R[5]; c.fillRect(x, y, w, h);
    for (let ry = y + h, row = 0; ry > y - rh; ry -= rh, row++) {
      let rx = x - (row % 2 ? 2.8 : 0), k = 0;
      while (rx < x + w) {
        const sw = widths[(hsh(k, row, 20) * 3) | 0], sh = rh - (field ? 0.5 + hsh(k, row, 21) * 0.7 : 0.5);
        const n = hsh(k, row, 22), vr = n < 0.16 ? 1 : n > 0.9 ? -1 : 0;
        rrect(c, rx + 0.35, ry - sh, sw - 0.7, sh, field ? 1.6 : 0.7);
        c.fillStyle = R[clampI(2 + vr, 0, 5)]; c.fill();
        c.fillStyle = R[clampI(vr, 0, 5)]; c.fillRect(rx + 0.9, ry - sh + 0.2, sw - 1.9, PXU);     // свет по верху камня
        c.fillStyle = R[4]; c.fillRect(rx + 0.9, ry - 0.75, sw - 1.5, PXU);                        // тень под камнем
        rx += sw; k++;
      }
    }
  } else if (kind === 'brick') {
    c.fillStyle = '#c8b498'; c.fillRect(x, y, w, h);
    for (let ry = y + h, row = 0; ry > y - 3; ry -= 2.8, row++)
      for (let rx = x - (row % 2 ? 2.8 : 0), k = 0; rx < x + w; rx += 5.6, k++) {
        const n = hsh(k, row, 23);
        c.fillStyle = R[n < 0.22 ? 3 : n > 0.82 ? 1 : 2];
        c.fillRect(rx + 0.35, ry - 2.45, 4.9, 2.1);
        c.fillStyle = R[1]; c.fillRect(rx + 0.35, ry - 2.45, 4.9, PXU);
      }
  } else if (kind === 'logs') {
    for (let ry = y + h, row = 0; ry > y - 4; ry -= 4, row++) {
      c.fillStyle = R[0]; c.fillRect(x, ry - 4, w, 0.8);
      c.fillStyle = R[1]; c.fillRect(x, ry - 3.2, w, 1.1);
      c.fillStyle = R[2]; c.fillRect(x, ry - 2.1, w, 1.2);
      c.fillStyle = R[4]; c.fillRect(x, ry - 0.9, w, 0.6);
      c.fillStyle = R[5]; c.fillRect(x, ry - 0.3, w, 0.3);
      // сучки: тёмное кольцо со светлой сердцевиной
      for (let k = 0, kx = x + 2 + hsh(row, 1, 24) * 9; kx < x + w - 2; kx += 9 + hsh(row, k, 25) * 10, k++) {
        ellipse(c, kx, ry - 2.1, 0.9, 1.1, R[4]); ellipse(c, kx, ry - 2.1, 0.4, 0.5, R[1]);
      }
    }
  } else if (kind === 'plank') {
    const PW = 3.67;
    for (let rx = x, k = 0; rx < x + w; rx += PW, k++) {
      const n = hsh(k, 0, 26);
      c.fillStyle = R[n < 0.2 ? 3 : n > 0.8 ? 1 : 2]; c.fillRect(rx, y, PW, h);
      c.fillStyle = R[0]; c.fillRect(rx, y, PXU, h);                   // освещённая кромка
      c.fillStyle = R[5]; c.fillRect(rx + PW - 0.4, y, 0.4, h);        // щель
      if (n > 0.55 && n < 0.7) { const ky = y + 2 + hsh(k, 1, 27) * (h - 4); c.fillStyle = R[4]; c.fillRect(rx + 1.2, ky, PXU * 2, PXU * 3); }
    }
  } else if (kind === 'plaster') {
    c.fillStyle = col || '#e8dcc0'; c.fillRect(x, y, w, h);
    // лёгкая грязца у земли и пара отбитых пятен — плоскими пятнами, без крапа
    c.fillStyle = R[3]; c.fillRect(x, y + h - 1.6, w, 1.6);
    for (let k = 0, px = x + 3 + hsh(0, 1, 28) * 10; px < x + w - 6; px += 14 + hsh(k, 2, 28) * 16, k++) {
      const pw = 3 + hsh(k, 3, 28) * 4;
      c.fillStyle = R[3]; c.fillRect(px, y + h - 1.6 - PXU * (1 + ((hsh(k, 4, 28) * 3) | 0)), pw, 2);
    }
  }
  c.restore();
};

// Тень под карнизом — двумя ступенями, у земли — тонкая полоса; никаких градиентов
wallShade = function (c, x, y, w, h) {
  c.fillStyle = 'rgba(14,8,2,0.32)'; c.fillRect(x, y, w, Math.min(h, 2.4));
  c.fillStyle = 'rgba(14,8,2,0.14)'; c.fillRect(x, y + 2.4, w, Math.min(h - 2.4, 1.6));
  if (h > 8) { c.fillStyle = 'rgba(40,25,10,0.18)'; c.fillRect(x, y + h - 1.4, w, 1.4); }
};

plinth = function (c, x, y, w, hgt = 3.6) {
  const R = rampOf('#8e877c');
  c.fillStyle = R[5]; c.fillRect(x - 0.8, y - hgt, w + 1.6, hgt);
  for (let rx = x - 0.8, k = 0; rx < x + w + 0.8; k++) {
    const sw = [3.6, 4.6, 5.8, 6.4][(hsh(k, 9, 29) * 4) | 0], n = hsh(k, 8, 29);
    rrect(c, rx + 0.25, y - hgt + 0.3, sw - 0.5, hgt - 0.5, 0.8);
    c.fillStyle = R[n < 0.25 ? 3 : n > 0.8 ? 1 : 2]; c.fill();
    c.fillStyle = R[0]; c.fillRect(rx + 0.7, y - hgt + 0.4, sw - 1.4, PXU);
    rx += sw;
  }
};

// ================= Окна и двери =================

door = function (c, cx, base, w, h, o = {}) {
  const arch = (ww, hh) => {
    c.beginPath();
    c.moveTo(cx - ww / 2, base);
    if (o.square) { c.lineTo(cx - ww / 2, base - hh); c.lineTo(cx + ww / 2, base - hh); }
    else { c.lineTo(cx - ww / 2, base - hh + ww / 2); c.arc(cx, base - hh + ww / 2, ww / 2, Math.PI, 0); }
    c.lineTo(cx + ww / 2, base); c.closePath();
  };
  if (o.frame === 'stone') {
    const S = rampOf('#9a9286');
    arch(w + 4, h + 2.2); c.fillStyle = S[2]; c.fill();
    c.save(); arch(w + 4, h + 2.2); c.clip();
    // клинчатые камни арки и блоки косяков
    for (let k = 0; k < 7; k++) {
      const a = Math.PI + k / 6 * Math.PI, ay = base - h + w / 2;
      line(c, cx + Math.cos(a) * w / 2, ay + Math.sin(a) * w / 2, cx + Math.cos(a) * (w / 2 + 2.6), ay + Math.sin(a) * (w / 2 + 2.6), S[4], 0.4);
    }
    for (let yy = base - 3; yy > base - h + w / 2; yy -= 3.4) { c.fillStyle = S[4]; c.fillRect(cx - w / 2 - 2.2, yy, 2.4, 0.4); c.fillRect(cx + w / 2 - 0.2, yy - 1.4, 2.4, 0.4); }
    c.fillStyle = S[0]; c.fillRect(cx - w / 2 - 2, base - h + w / 2 - 0.4, 0.4, h - w / 2);
    c.restore();
  } else {
    c.fillStyle = '#3a2414';
    c.fillRect(cx - w / 2 - 1.6, base - h - (o.square ? 1.6 : 0), w + 3.2, h + (o.square ? 1.6 : 0));
    if (o.square) { c.fillStyle = '#6a4424'; c.fillRect(cx - w / 2 - 2.2, base - h - 2, w + 4.4, 1.4); c.fillStyle = '#9a6a3a'; c.fillRect(cx - w / 2 - 2.2, base - h - 2, w + 4.4, PXU); }
  }
  arch(w, h);
  if (o.open) { c.fillStyle = '#0e0805'; c.fill(); }
  else {
    const D = rampOf(o.col || '#7a4e2a');
    c.fillStyle = D[2]; c.fill();
    c.save(); arch(w, h); c.clip();
    // доски: плоские полосы двух оттенков со щелью
    const PW = 2.33;
    for (let x = cx - w / 2, k = 0; x < cx + w / 2; x += PW, k++) {
      c.fillStyle = D[k % 3 === 1 ? 3 : 2]; c.fillRect(x, base - h, PW, h);
      c.fillStyle = D[1]; c.fillRect(x, base - h, PXU, h);
      c.fillStyle = D[5]; c.fillRect(x + PW - 0.34, base - h, 0.34, h);
    }
    if (o.double) { c.fillStyle = '#0a0502'; c.fillRect(cx - 0.4, base - h, 0.8, h); }
    // кованые полосы
    c.fillStyle = '#2c2a28'; c.fillRect(cx - w / 2, base - h * 0.72, w, 1); c.fillRect(cx - w / 2, base - h * 0.28, w, 1);
    c.fillStyle = '#6a6460'; c.fillRect(cx - w / 2, base - h * 0.72, w, PXU); c.fillRect(cx - w / 2, base - h * 0.28, w, PXU);
    if (o.braces) {
      const half = o.double ? [[cx - w / 2, cx], [cx, cx + w / 2]] : [[cx - w / 2, cx + w / 2]];
      for (const [a, b] of half) { line(c, a + 0.5, base - 1, b - 0.5, base - h + 2, D[0], 1); line(c, b - 0.5, base - 1, a + 0.5, base - h + 2, D[0], 1); }
    }
    // тень верха проёма — одной ступенью
    c.fillStyle = 'rgba(0,0,0,0.38)'; c.fillRect(cx - w / 2, base - h, w, 1.6);
    c.restore();
    if (o.gnome && !o.double) {
      ellipse(c, cx, base - h * 0.5, 1.1, 1.1, '#c8a050'); c.fillStyle = '#fff2a0'; c.fillRect(cx - 0.6, base - h * 0.5 - 0.6, PXU, PXU);
      c.fillStyle = '#2c2a28'; c.fillRect(cx - w / 2, base - h * 0.72, w * 0.45, 1.1); c.fillRect(cx - w / 2, base - h * 0.28, w * 0.45, 1.1);
    } else { c.fillStyle = '#c8a050'; c.fillRect(cx + (o.double ? 1.2 : w / 2 - 2.2), base - h * 0.48 - 0.5, PXU * 2, PXU * 3); }
  }
  // ступенька
  c.fillStyle = '#7e766c'; c.fillRect(cx - w / 2 - 2, base - 0.3, w + 4, 2);
  c.fillStyle = '#b6ada0'; c.fillRect(cx - w / 2 - 2, base - 0.3, w + 4, PXU);
  c.fillStyle = '#4a4540'; c.fillRect(cx - w / 2 - 2, base + 1.4, w + 4, 0.4);
};

// Стекло: тёплое — две ступени света, холодное — тёмно-синее с бликом в углу
function glassFill(c, x, y, w, h, o) {
  if (o.magic) { c.fillStyle = '#9c7ae6'; c.fillRect(x, y, w, h); c.fillStyle = '#e2d6ff'; c.fillRect(x, y, w, h * 0.4); }
  else if (o.lit) { c.fillStyle = '#e8943a'; c.fillRect(x, y, w, h); c.fillStyle = '#fff0b8'; c.fillRect(x, y, w, h * 0.5); c.fillStyle = '#ffd878'; c.fillRect(x, y + h * 0.5, w, h * 0.2); }
  else { c.fillStyle = '#22486c'; c.fillRect(x, y, w, h); c.fillStyle = '#141c26'; c.fillRect(x, y + h * 0.55, w, h * 0.45); c.fillStyle = '#5292bc'; c.fillRect(x + PXU, y + PXU, w * 0.45, PXU * 2); }
}

roundWin = function (c, cx, cy, r, o = {}) {
  recWin(c, cx, cy, r * 2, r * 2, true);
  ellipse(c, cx, cy, r + 1.3, r + 1.3, '#3a2414');
  ellipse(c, cx, cy, r + 0.8, r + 0.8, '#7a5030');
  ellipse(c, cx - 0.2, cy - 0.2, r + 0.5, r + 0.5, '#a87040');
  c.save();
  c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.clip();
  glassFill(c, cx - r, cy - r, r * 2, r * 2, o);
  c.fillStyle = '#3a2414';
  c.fillRect(cx - 0.35, cy - r, 0.7, r * 2); c.fillRect(cx - r, cy - 0.35, r * 2, 0.7);
  c.restore();
  if (o.flowers) {
    c.fillStyle = '#5a3a1e'; c.fillRect(cx - r - 1, cy + r + 0.8, r * 2 + 2, 1.6);
    c.fillStyle = '#8a5a30'; c.fillRect(cx - r - 1, cy + r + 0.8, r * 2 + 2, PXU);
    for (let k = 0; k <= 3; k++) {
      const fx = cx - r + k * (r * 2 / 3);
      c.fillStyle = '#3e7a2a'; c.fillRect(fx - 0.8, cy + r - 0.2, 1.6, 1.2);
      c.fillStyle = ['#e04a5a', '#f0d040', '#f4f4f4', '#d070c0'][k % 4]; c.fillRect(fx - 0.4, cy + r - 0.7, PXU * 2, PXU * 2);
    }
  }
};

win = function (c, x, y, w, h, o = {}) {
  if (o.round) { roundWin(c, x + w / 2, y + h / 2, Math.min(w, h) / 2 + 0.6, o); return; }
  recWin(c, x + w / 2, y + h / 2, w, h, false);
  if (o.shutter) {
    const S = rampOf(o.shutter);
    for (const sx of [x - 3, x + w]) {
      c.fillStyle = S[2]; c.fillRect(sx, y - 0.4, 3, h + 0.8);
      c.fillStyle = S[0]; c.fillRect(sx, y - 0.4, PXU, h + 0.8);
      c.fillStyle = S[4]; c.fillRect(sx + 1, y, PXU, h); c.fillRect(sx + 2, y, PXU, h);
      c.fillStyle = '#2c2a28'; c.fillRect(sx, y + 1.2, 3, 0.5); c.fillRect(sx, y + h - 1.6, 3, 0.5);
    }
  }
  c.fillStyle = o.stone ? '#a49c90' : '#3a2414';
  if (o.arch) { c.beginPath(); c.moveTo(x - 1, y + h + 1); c.lineTo(x - 1, y + w / 2); c.arc(x + w / 2, y + w / 2, w / 2 + 1, Math.PI, 0); c.lineTo(x + w + 1, y + h + 1); c.fill(); }
  else c.fillRect(x - 0.9, y - 0.9, w + 1.8, h + 1.8);
  if (o.stone) { c.fillStyle = '#cec6ba'; c.fillRect(x - 0.9, y - 0.9, w + 1.8, PXU); c.fillRect(x - 0.9, y - 0.9, PXU, h + 1.8); }
  c.save();
  c.beginPath();
  if (o.arch) { c.moveTo(x, y + h); c.lineTo(x, y + w / 2); c.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); c.lineTo(x + w, y + h); c.closePath(); }
  else c.rect(x, y, w, h);
  c.clip();
  glassFill(c, x, y, w, h, o);
  c.fillStyle = '#3a2414';
  c.fillRect(x + w / 2 - 0.35, y, 0.7, h);
  c.fillRect(x, y + h * 0.48, w, 0.7);
  c.restore();
  c.fillStyle = '#b0a698'; c.fillRect(x - 1.4, y + h + 0.6, w + 2.8, 1.2);
  c.fillStyle = '#e4ddd2'; c.fillRect(x - 1.4, y + h + 0.6, w + 2.8, PXU);
  c.fillStyle = '#4a4540'; c.fillRect(x - 1.4, y + h + 1.8, w + 2.8, 0.4);
  if (o.flowers) {
    c.fillStyle = '#5a3a1e'; c.fillRect(x - 0.8, y + h + 1.6, w + 1.6, 1.8);
    c.fillStyle = '#8a5a30'; c.fillRect(x - 0.8, y + h + 1.6, w + 1.6, PXU);
    for (let k = 0; k <= 4; k++) {
      const fx = x + k * (w / 4);
      c.fillStyle = '#3e7a2a'; c.fillRect(fx - 0.8, y + h + 0.5, 1.6, 1.2);
      c.fillStyle = ['#e04a5a', '#f0d040', '#f4f4f4', '#d070c0'][k % 4]; c.fillRect(fx - 0.4, y + h, PXU * 2, PXU * 2);
    }
  }
};

// Конёк: плоские валики без случайностей
ridgeCap = function (c, x0, y0, x1, y1, mat, col) {
  c.lineCap = 'round';
  const R = rampOf(col);
  if (mat === 'thatch') {
    line(c, x0, y0, x1, y1, R[4], 4.2);
    line(c, x0, y0 - 0.6, x1, y1 - 0.6, R[2], 3);
    line(c, x0, y0 - 1.4, x1, y1 - 1.4, R[0], 0.8);
    const n = Math.hypot(x1 - x0, y1 - y0) / 3;
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      line(c, x - 1, y - 1.4, x + 1, y + 1.2, R[4], 0.5);
    }
  } else if (mat === 'moss' || mat === 'turf') {
    line(c, x0, y0, x1, y1, '#2f4a26', 4.4);
    line(c, x0, y0 - 0.7, x1, y1 - 0.7, mat === 'turf' ? '#5c8236' : '#4a6e30', 3);
    const n = Math.hypot(x1 - x0, y1 - y0) / 2.8;
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      ellipse(c, x, y - 1.2, 1.6, 1.2, GMOSS[2]); c.fillStyle = GMOSS[3]; c.fillRect(x - 0.6, y - 2, PXU * 2, PXU);
    }
  } else if (mat === 'tiles') {
    line(c, x0, y0, x1, y1, R[5], 3.4);
    const n = Math.hypot(x1 - x0, y1 - y0) / 4;
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      ellipse(c, x, y - 0.4, 2.2, 1.6, R[1]);
      c.fillStyle = R[0]; c.fillRect(x - 1.2, y - 1.4, 1.4, PXU);
    }
  } else {
    line(c, x0, y0, x1, y1, R[5], 3);
    line(c, x0, y0 - 0.6, x1, y1 - 0.6, R[1], 1.4);
  }
  c.lineCap = 'butt';
};

// Трубы: плоский кирпич/камень, без градиентов (используется старой функцией house)
chimney = function (c, x, yBase, h, kind = 'brick', w = 5) {
  const col = kind === 'brick' ? '#9a4e34' : '#8e877c';
  wallTex(c, kind, x, yBase - h, w, h, col);
  c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x + w * 0.6, yBase - h, w * 0.4, h);
  c.fillStyle = '#4a4440'; c.fillRect(x - 0.8, yBase - h - 1.4, w + 1.6, 1.8);
  c.fillStyle = '#100c0a'; c.fillRect(x + 0.6, yBase - h - 1.4, w - 1.2, 0.8);
  c.strokeStyle = 'rgba(20,10,4,0.6)'; c.lineWidth = 0.5; c.strokeRect(x, yBase - h, w, h);
  return [x + w / 2, yBase - h - 2];
};

// ================= Скальный отвал рудников =================
// Крупные валуны плоскими пятнами: три ступени света слева направо, блик сверху-слева, тень под камнем
rockMound = function (c, pts, x0, y0, w, h, col = '#7e7468') {
  const R = rampOf(col);
  clipPoly(c, pts, () => {
    c.fillStyle = R[4]; c.fillRect(x0, y0, w, h);
    for (let ry = y0 + h, row = 0; ry > y0 - 8; ry -= 6.2, row++) {
      for (let rx = x0 - (row % 2 ? 5 : 0), k = 0; rx < x0 + w + 8; k++) {
        const rw = 7 + hsh(k, row, 50) * 5, rh = 5.4 + hsh(k, row, 51) * 1.6;
        const u = (rx + rw / 2 - x0) / w, band = u < 0.3 ? 1 : u < 0.62 ? 2 : 3;
        const n = hsh(k, row, 52), vr = n < 0.15 ? 1 : n > 0.9 ? -1 : 0;
        ellipse(c, rx + rw / 2 + 0.4, ry - rh / 2 + 0.6, rw / 2, rh / 2, R[5]);
        ellipse(c, rx + rw / 2, ry - rh / 2, rw / 2 - 0.3, rh / 2 - 0.3, R[clampI(band + vr, 0, 5)]);
        c.fillStyle = R[clampI(band + vr - 2, 0, 5)]; c.fillRect(rx + rw * 0.25, ry - rh + 0.9, rw * 0.4, PXU);
        if (hsh(k, row, 53) < 0.12) { ellipse(c, rx + rw * 0.4, ry - 1.2, 1.6, 1, GMOSS[1]); c.fillStyle = GMOSS[3]; c.fillRect(rx + rw * 0.3, ry - 1.8, PXU * 2, PXU); }
        rx += rw + 0.4;
      }
    }
  });
  poly(c, pts, null, 'rgba(20,10,4,0.5)', 0.7);
};

// ================= Реквизит без градиентов =================
barrel = function (c, x, y, s = 1) {
  const W = rampOf('#8a5428');
  shadowAt(c, x + 1, y + 0.5, 5 * s);
  c.beginPath();
  c.moveTo(x - 3.6 * s, y); c.quadraticCurveTo(x - 4.8 * s, y - 5 * s, x - 3.6 * s, y - 10 * s);
  c.lineTo(x + 3.6 * s, y - 10 * s); c.quadraticCurveTo(x + 4.8 * s, y - 5 * s, x + 3.6 * s, y);
  c.closePath(); c.fillStyle = W[2]; c.fill();
  c.save(); c.clip();
  c.fillStyle = W[1]; c.fillRect(x - 4.8 * s, y - 10 * s, 2.6 * s, 10 * s);
  c.fillStyle = W[0]; c.fillRect(x - 3.4 * s, y - 10 * s, 0.8 * s, 10 * s);
  c.fillStyle = W[3]; c.fillRect(x + 1.2 * s, y - 10 * s, 1.6 * s, 10 * s);
  c.fillStyle = W[4]; c.fillRect(x + 2.8 * s, y - 10 * s, 2.2 * s, 10 * s);
  c.fillStyle = W[5]; for (let k = -2; k <= 2; k++) c.fillRect(x + k * 1.6 * s - 0.17, y - 10 * s, PXU, 10 * s);
  for (const hy of [1.6, 8.4]) { c.fillStyle = '#2e2e30'; c.fillRect(x - 5 * s, y - hy * s - 0.5, 10 * s, 1); c.fillStyle = '#6a6a6e'; c.fillRect(x - 5 * s, y - hy * s - 0.5, 10 * s, PXU); }
  c.restore();
  ellipse(c, x, y - 10 * s, 3.6 * s, 1.3 * s, W[4]);
  ellipse(c, x, y - 10 * s, 2.8 * s, 0.9 * s, W[1]);
};

crate = function (c, x, y, s = 7, col = '#9a6a36') {
  const W = rampOf(col);
  shadowAt(c, x + s / 2 + 2, y + 0.5, s * 0.7);
  const top = y - s;
  poly(c, [[x, top], [x + s, top], [x + s + 2.4, top - 2], [x + 2.4, top - 2]], W[0]);
  poly(c, [[x + s, top], [x + s + 2.4, top - 2], [x + s + 2.4, y - 2], [x + s, y]], W[4]);
  c.fillStyle = W[2]; c.fillRect(x, top, s, s);
  c.fillStyle = W[1]; c.fillRect(x, top, s, s * 0.4);
  c.fillStyle = W[5]; c.fillRect(x, top, s, 0.4); c.fillRect(x, y - 0.4, s, 0.4); c.fillRect(x, top, 0.4, s); c.fillRect(x + s - 0.4, top, 0.4, s);
  line(c, x + 0.8, top + 0.8, x + s - 0.8, y - 0.8, W[4], 0.6);
  c.fillStyle = W[4]; c.fillRect(x, top + s / 2, s, 0.4);
};

sack = function (c, x, y, col = '#d8c8a0', s = 1) {
  const S = rampOf(col);
  shadowAt(c, x + 1, y + 0.4, 4.5 * s);
  c.beginPath();
  c.moveTo(x - 4 * s, y); c.quadraticCurveTo(x - 5 * s, y - 5.5 * s, x - 1.6 * s, y - 7.5 * s);
  c.lineTo(x + 1.6 * s, y - 7.5 * s); c.quadraticCurveTo(x + 5 * s, y - 5.5 * s, x + 4 * s, y);
  c.closePath(); c.fillStyle = S[2]; c.fill();
  c.save(); c.clip();
  c.fillStyle = S[1]; c.fillRect(x - 5 * s, y - 8 * s, 4.2 * s, 8 * s);
  c.fillStyle = S[0]; c.fillRect(x - 3 * s, y - 7 * s, 1.6 * s, 2.6 * s);
  c.fillStyle = S[3]; c.fillRect(x + 2.2 * s, y - 8 * s, 3 * s, 8 * s);
  c.fillStyle = S[4]; c.fillRect(x - 5 * s, y - 1.2 * s, 10 * s, 1.2 * s);
  c.fillStyle = S[3]; c.fillRect(x - 2 * s, y - 3 * s, 3.6 * s, 0.5);
  c.restore();
  c.fillStyle = '#7a6040'; c.fillRect(x - 1.6 * s, y - 8 * s, 3.2 * s, 1.2 * s);
  ellipse(c, x, y - 8.6 * s, 1.4 * s, 0.8 * s, S[3]);
};

hayBale = function (c, x, y, s = 1) {
  const H = rampOf('#d8b848');
  shadowAt(c, x + 1, y + 0.5, 7 * s);
  c.beginPath(); c.moveTo(x - 7 * s, y); c.quadraticCurveTo(x - 7.5 * s, y - 9 * s, x, y - 10 * s); c.quadraticCurveTo(x + 7.5 * s, y - 9 * s, x + 7 * s, y); c.closePath();
  c.fillStyle = H[2]; c.fill();
  c.save(); c.clip();
  c.fillStyle = H[1]; c.fillRect(x - 8 * s, y - 10 * s, 6 * s, 10 * s);
  c.fillStyle = H[0]; c.fillRect(x - 5 * s, y - 9 * s, 2.4 * s, 3 * s);
  c.fillStyle = H[3]; c.fillRect(x + 3 * s, y - 10 * s, 5 * s, 10 * s);
  c.fillStyle = H[4]; c.fillRect(x - 8 * s, y - 1.4 * s, 16 * s, 1.4 * s);
  for (let k = -6; k <= 6; k += 2) { c.fillStyle = H[k < 0 ? 2 : 4]; c.fillRect(x + k * s, y - 8 * s + Math.abs(k) * 0.5, PXU, 7 * s); }
  c.fillStyle = H[4]; c.fillRect(x - 7 * s, y - 4 * s, 14 * s, 0.5);
  c.restore();
};

logPile = function (c, x, y, rows = 3, len = 9) {
  const W = rampOf('#7a4a24');
  shadowAt(c, x + rows * 3, y + 0.5, rows * 4 + 3);
  for (let row = 0; row < rows; row++) for (let k = 0; k < rows - row; k++) {
    const lx = x + k * 5.6 + row * 2.8, ly = y - 2.6 - row * 4.8;
    c.fillStyle = W[0]; c.fillRect(lx - len, ly - 2.6, len, 1);
    c.fillStyle = W[1]; c.fillRect(lx - len, ly - 1.6, len, 1.4);
    c.fillStyle = W[3]; c.fillRect(lx - len, ly - 0.2, len, 1.6);
    c.fillStyle = W[5]; c.fillRect(lx - len, ly + 1.4, len, 1.2);
    ellipse(c, lx, ly, 2.7, 2.6, W[4]);
    ellipse(c, lx, ly, 2.2, 2.1, '#dcb27a');
    c.strokeStyle = '#a8784a'; c.lineWidth = 0.4;
    c.beginPath(); c.arc(lx, ly, 1.3, 0, 7); c.stroke();
    c.fillStyle = '#a8784a'; c.fillRect(lx - 0.35, ly - 0.35, 0.7, 0.7);
  }
};
