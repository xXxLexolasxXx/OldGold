'use strict';
// Здания в духе Knights and Merchants: объёмы с фасадами, крыши трёх типов,
// фактурные материалы, двор с реквизитом. Рисуются с тройной сверхвыборкой.

const BS = 4;          // сверхвыборка зданий (потом сводится в пиксель-арт ×2)
const BPADX = 38;      // запас по бокам спрайта (место для столба с вывеской)
const BBOTTOM = 14;    // запас снизу (реквизит перед фасадом)

// ================= Материалы стен =================

function wallTex(c, kind, x, y, w, h, col) {
  c.save();
  c.beginPath(); c.rect(x, y, w, h); c.clip();
  if (kind === 'stone' || kind === 'fieldstone') {
    c.fillStyle = shade(col, -0.5); c.fillRect(x, y, w, h);
    const rh = kind === 'stone' ? 4.6 : 5.4;
    for (let ry = y + h, row = 0; ry > y - rh; ry -= rh, row++) {
      let rx = x - (row % 2 ? 3 : 0) - srand() * 2;
      while (rx < x + w) {
        const sw = kind === 'stone' ? rnd(5, 8.5) : rnd(4, 7);
        const sh = rh - (kind === 'stone' ? 0.6 : rnd(0.3, 1.2));
        rrect(c, rx + 0.4, ry - sh, sw - 0.8, sh, kind === 'stone' ? 0.9 : 1.8);
        c.fillStyle = shade(col, rnd(-0.2, 0.16)); c.fill();
        c.fillStyle = 'rgba(255,250,235,0.3)'; c.fillRect(rx + 1, ry - sh + 0.2, sw - 2.4, 0.6);
        c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(rx + 1, ry - 0.8, sw - 2, 0.6);
        if (srand() < 0.05) ellipse(c, rx + sw / 2, ry - sh / 2, 1.4, 0.8, 'rgba(80,100,40,0.5)');
        rx += sw;
      }
    }
  } else if (kind === 'brick') {
    c.fillStyle = '#c8b498'; c.fillRect(x, y, w, h);
    for (let ry = y + h, row = 0; ry > y - 3; ry -= 2.8, row++)
      for (let rx = x - (row % 2 ? 2.8 : 0); rx < x + w; rx += 5.6) {
        c.fillStyle = shade(col, rnd(-0.22, 0.12));
        c.fillRect(rx + 0.35, ry - 2.45, 4.9, 2.1);
        c.fillStyle = 'rgba(255,220,190,0.22)'; c.fillRect(rx + 0.35, ry - 2.45, 4.9, 0.45);
      }
  } else if (kind === 'logs') {
    for (let ry = y + h; ry > y - 4; ry -= 4) {
      c.fillStyle = lingrad(c, 0, ry - 4, 0, ry, [[0, shade(col, 0.32)], [0.4, shade(col, 0.05)], [1, shade(col, -0.55)]]);
      c.fillRect(x, ry - 4, w, 4);
      c.strokeStyle = 'rgba(40,20,8,0.35)'; c.lineWidth = 0.35;
      for (let k = 0; k < w / 5; k++) {
        const sx = x + srand() * w, sy = ry - rnd(1, 3);
        c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + rnd(2, 6), sy + rnd(-0.3, 0.3)); c.stroke();
      }
    }
  } else if (kind === 'plank') {
    for (let rx = x; rx < x + w; rx += 3.6) {
      c.fillStyle = lingrad(c, rx, 0, rx + 3.6, 0, [[0, shade(col, 0.14)], [1, shade(col, -0.2)]]);
      c.fillRect(rx, y, 3.6, h);
      c.fillStyle = 'rgba(20,8,2,0.55)'; c.fillRect(rx + 3.2, y, 0.4, h);
      if (srand() < 0.35) ellipse(c, rx + 1.8, y + rnd(3, h - 3), 0.6, 1, 'rgba(40,15,5,0.5)');
    }
  } else if (kind === 'plaster') {
    c.fillStyle = col; c.fillRect(x, y, w, h);
    for (let k = 0; k < w * h / 6; k++) {
      c.fillStyle = srand() < 0.5 ? 'rgba(120,96,60,0.1)' : 'rgba(255,255,248,0.22)';
      c.fillRect(x + srand() * w, y + srand() * h, rnd(0.5, 1.5), rnd(0.5, 1.5));
    }
    for (let k = 0; k < w / 25; k++) ellipse(c, x + srand() * w, y + h - rnd(1, 5), rnd(3, 7), rnd(1.5, 3), 'rgba(110,80,40,0.12)');
  }
  c.restore();
}

// Фахверк поверх штукатурки
function timberFrame(c, x, y, w, h, beam = '#4a2c16', floors = 1) {
  const hi = shade(beam, 0.35);
  const n = Math.max(2, Math.round(w / 13));
  const posts = [];
  for (let k = 0; k <= n; k++) posts.push(x + k * (w - 2.2) / n);
  const fh = h / floors;
  for (let f = 0; f < floors; f++) {
    const y0 = y + f * fh, y1 = y0 + fh;
    for (let k = 0; k < n; k++) {
      if ((k + f) % 2) continue;
      const a = posts[k] + 2.2, b = posts[k + 1];
      line(c, a, y1 - 1.4, b, y0 + 1.6, beam, 1.8);
      line(c, a, y0 + 1.6, b, y1 - 1.4, beam, 1.8);
    }
    c.fillStyle = beam; c.fillRect(x, y0, w, 2.2);
    c.fillStyle = hi; c.fillRect(x, y0, w, 0.5);
  }
  for (const px of posts) { c.fillStyle = beam; c.fillRect(px, y, 2.2, h); c.fillStyle = hi; c.fillRect(px, y, 0.5, h); }
  c.fillStyle = beam; c.fillRect(x, y + h - 2.4, w, 2.4);
}

function wallShade(c, x, y, w, h) {
  c.fillStyle = lingrad(c, 0, y, 0, y + h, [[0, 'rgba(0,0,0,0.5)'], [0.14, 'rgba(0,0,0,0.05)'], [0.75, 'rgba(0,0,0,0)'], [1, 'rgba(40,25,10,0.35)']]);
  c.fillRect(x, y, w, h);
  c.fillStyle = lingrad(c, x, 0, x + w, 0, [[0, 'rgba(255,240,210,0.1)'], [1, 'rgba(0,0,0,0.2)']]);
  c.fillRect(x, y, w, h);
}

function plinth(c, x, y, w, hgt = 3.6) {
  c.fillStyle = '#4a4540'; c.fillRect(x - 0.8, y - hgt, w + 1.6, hgt);
  for (let rx = x - 0.8; rx < x + w + 0.8;) {
    const sw = rnd(3.5, 6.5);
    rrect(c, rx + 0.25, y - hgt + 0.3, sw - 0.5, hgt - 0.5, 0.9);
    c.fillStyle = shade('#8e877c', rnd(-0.22, 0.1)); c.fill();
    rx += sw;
  }
  c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(x - 0.8, y - hgt, w + 1.6, 0.5);
}

// ================= Крыши =================

const GMOSS = ['#3a5a2a', '#4a6e30', '#5c8236', '#73963e'];

const ROOF = {
  thatch(c, Lu, Lv, col) {
    c.fillStyle = shade(col, -0.2); c.fillRect(-2, -2, Lu + 4, Lv + 4);
    c.lineWidth = 0.55;
    for (let u = -3; u < Lu + 3; u += 3.3) {
      for (let v = -1; v < Lv + 1; v += 0.8) {
        c.strokeStyle = shade(col, rnd(-0.38, 0.24));
        const l = rnd(4, 6.5);
        c.beginPath(); c.moveTo(u + l, v + rnd(-0.3, 0.3)); c.lineTo(u, v + rnd(-0.5, 0.5)); c.stroke();
      }
      c.fillStyle = 'rgba(30,18,4,0.28)'; c.fillRect(u - 0.3, -2, 0.7, Lv + 4);
    }
    for (let k = 0; k < Lu * Lv / 260; k++) ellipse(c, rnd(2, Lu), rnd(0, Lv), rnd(1.5, 4), rnd(1, 2.5), 'rgba(80,100,36,0.28)');
    c.fillStyle = shade(col, -0.45); c.fillRect(-2, -2, 3, Lv + 4);
    c.strokeStyle = shade(col, -0.5); c.lineWidth = 0.6;
    for (let v = 0; v < Lv; v += 0.9) { c.beginPath(); c.moveTo(2.5, v); c.lineTo(-0.5, v + rnd(-0.6, 0.6)); c.stroke(); }
  },
  shingle(c, Lu, Lv, col) {
    c.fillStyle = shade(col, -0.55); c.fillRect(-2, -2, Lu + 4, Lv + 4);
    for (let u = -1; u < Lu + 2; u += 3.3) {
      let v = -rnd(0, 3);
      while (v < Lv + 2) {
        const w = rnd(2.4, 4);
        c.fillStyle = shade(col, rnd(-0.24, 0.16));
        c.fillRect(u + 0.1, v + 0.2, 3.5, w - 0.4);
        c.fillStyle = 'rgba(255,235,200,0.2)'; c.fillRect(u + 2.9, v + 0.2, 0.6, w - 0.4);
        if (srand() < 0.06) ellipse(c, u + 1.5, v + w / 2, 1.4, 1.2, 'rgba(80,100,40,0.4)');
        v += w;
      }
      c.fillStyle = 'rgba(0,0,0,0.38)'; c.fillRect(u, -2, 0.6, Lv + 4);
    }
  },
  tiles(c, Lu, Lv, col) {
    c.fillStyle = shade(col, -0.5); c.fillRect(-2, -2, Lu + 4, Lv + 4);
    for (let u = -1; u < Lu + 2; u += 4) {
      for (let v = -1; v < Lv + 2; v += 3.2) {
        const cc = shade(col, rnd(-0.14, 0.12));
        c.fillStyle = lingrad(c, 0, v, 0, v + 3.2, [[0, shade(col, -0.4)], [0.3, cc], [0.55, shade(col, 0.28)], [1, shade(col, -0.42)]]);
        rrect(c, u + 0.15, v + 0.1, 4.3, 3, 1.4); c.fill();
      }
      c.fillStyle = 'rgba(25,6,0,0.4)'; c.fillRect(u, -2, 0.55, Lv + 4);
    }
  },
  // гномская дранка, заросшая мхом
  moss(c, Lu, Lv, col) {
    ROOF.shingle(c, Lu, Lv, col);
    for (let k = 0; k < Lu * Lv / 55; k++) {
      const u = rnd(-2, Lu + 1), v = rnd(-2, Lv + 1), r = rnd(1.6, 4.6);
      ellipse(c, u, v, r, r * 0.75, shade(GMOSS[(srand() * 4) | 0], rnd(-0.15, 0.08)));
      ellipse(c, u + r * 0.25, v - r * 0.2, r * 0.45, r * 0.35, 'rgba(190,220,110,0.35)');
    }
    for (let k = 0; k < Lu * Lv / 14; k++) {
      c.fillStyle = srand() < 0.5 ? 'rgba(150,190,80,0.55)' : 'rgba(40,60,20,0.4)';
      c.fillRect(rnd(0, Lu), rnd(0, Lv), 0.7, 0.7);
    }
  },
  // дёрн: трава, цветы, у свеса — земля с корешками
  turf(c, Lu, Lv, col) {
    c.fillStyle = shade(col, -0.25); c.fillRect(-2, -2, Lu + 4, Lv + 4);
    c.lineWidth = 0.5;
    for (let k = 0; k < Lu * Lv / 2.2; k++) {
      const u = rnd(-1, Lu + 1), v = rnd(-1, Lv + 1);
      c.strokeStyle = shade(col, rnd(-0.35, 0.3));
      c.beginPath(); c.moveTo(u, v); c.lineTo(u - rnd(1.2, 2.6), v + rnd(-0.6, 0.6)); c.stroke();
    }
    for (let k = 0; k < Lu * Lv / 70; k++) ellipse(c, rnd(3, Lu), rnd(0, Lv), 0.6, 0.6, ['#f4f4f4', '#f0d040', '#e06a8a', '#a0b8f0'][(srand() * 4) | 0]);
    c.fillStyle = '#45291a'; c.fillRect(-2, -2, 3.4, Lv + 4);
    c.strokeStyle = '#6e432a'; c.lineWidth = 0.4;
    for (let v = 0; v < Lv; v += 1.6) { c.beginPath(); c.moveTo(1, v); c.lineTo(-1.6, v + rnd(-0.8, 0.8)); c.stroke(); }
    for (let v = 0; v < Lv; v += rnd(2, 5)) ellipse(c, 1.6, v, 1.2, 1.6, shade(col, rnd(-0.2, 0.15)));
  },
  slate(c, Lu, Lv, col) {
    c.fillStyle = shade(col, -0.55); c.fillRect(-2, -2, Lu + 4, Lv + 4);
    for (let u = -1; u < Lu + 2; u += 2.9) {
      let v = -rnd(0, 3);
      while (v < Lv + 2) {
        const w = rnd(3, 5.5);
        c.fillStyle = shade(col, rnd(-0.2, 0.16));
        c.fillRect(u + 0.1, v + 0.2, 3, w - 0.4);
        c.fillStyle = 'rgba(255,255,255,0.16)'; c.fillRect(u + 2.5, v + 0.2, 0.5, w - 0.4);
        v += w;
      }
      c.fillStyle = 'rgba(0,0,0,0.38)'; c.fillRect(u, -2, 0.5, Lv + 4);
    }
  },
};

// Скат крыши: P0 — угол у свеса, U — к коньку, V — вдоль свеса.
function plane(c, P0, U, V, mat, col, light = 1, clipPts = null) {
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
  c.fillStyle = lingrad(c, 0, 0, Lu, 0, [[0, 'rgba(0,0,0,0.3)'], [0.22, 'rgba(0,0,0,0)'], [1, 'rgba(255,240,210,0.1)']]);
  c.fillRect(-2, -2, Lu + 4, Lv + 4);
  if (light > 1) { c.fillStyle = `rgba(255,240,210,${light - 1})`; c.fillRect(-2, -2, Lu + 4, Lv + 4); }
  if (light < 1) { c.fillStyle = `rgba(15,8,2,${1 - light})`; c.fillRect(-2, -2, Lu + 4, Lv + 4); }
  c.restore();
}

function ridgeCap(c, x0, y0, x1, y1, mat, col) {
  c.lineCap = 'round';
  if (mat === 'thatch') {
    line(c, x0, y0, x1, y1, shade(col, -0.45), 4.2);
    line(c, x0, y0 - 0.6, x1, y1 - 0.6, shade(col, 0.05), 3);
    const n = Math.hypot(x1 - x0, y1 - y0) / 3;
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      line(c, x - 1, y - 1.4, x + 1, y + 1.2, shade(col, -0.35), 0.5);
    }
  } else if (mat === 'moss' || mat === 'turf') {
    // конёк — толстый валик мха с кочками
    line(c, x0, y0, x1, y1, '#2f4a26', 4.4);
    line(c, x0, y0 - 0.7, x1, y1 - 0.7, mat === 'turf' ? '#5c8236' : '#4a6e30', 3);
    const n = Math.hypot(x1 - x0, y1 - y0) / 2.6;
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      ellipse(c, x + rnd(-0.6, 0.6), y - 1.2, rnd(1.2, 2.2), rnd(1, 1.6), shade(GMOSS[(srand() * 4) | 0], 0.05));
    }
  } else if (mat === 'tiles') {
    line(c, x0, y0, x1, y1, shade(col, -0.5), 3.4);
    const n = Math.hypot(x1 - x0, y1 - y0) / 4;
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      ellipse(c, x, y - 0.4, 2.2, 1.6, shade(col, 0.08));
      ellipse(c, x - 0.6, y - 0.9, 1, 0.6, shade(col, 0.4));
    }
  } else {
    line(c, x0, y0, x1, y1, shade(col, -0.55), 3);
    line(c, x0, y0 - 0.6, x1, y1 - 0.6, shade(col, 0.25), 1.4);
  }
  c.lineCap = 'butt';
}

function bargeBoard(c, pts, col = '#4a2c16') {
  c.lineJoin = 'round';
  c.strokeStyle = shade(col, -0.4); c.lineWidth = 2.6;
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) c.lineTo(p[0], p[1]); c.stroke();
  c.strokeStyle = col; c.lineWidth = 1.6;
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1] - 0.4); for (const p of pts.slice(1)) c.lineTo(p[0], p[1] - 0.4); c.stroke();
  c.strokeStyle = shade(col, 0.4); c.lineWidth = 0.4;
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1] - 1); for (const p of pts.slice(1)) c.lineTo(p[0], p[1] - 1); c.stroke();
}

// Тень объёма на отдельный слой: падает вправо.
function shadowBox(g, x0, x1, base, back, h) {
  const s = h * 0.62, up = h * 0.14;
  poly(g.sc, [[x0 + 4, back], [x1, back], [x1, base], [x1 + s, base - up], [x1 + s, back - up], [x0 + s, back - up]], 'rgba(12,10,6,0.34)');
}

// ================= Объём дома =================
// o: x0, x1, base, back, H, wall, wallCol, frame (фахверк), floors, roof: X | Z | L | H,
//    mat, roofCol, rise, ov, gableWall, noPlinth
function house(c, g, o) {
  const x0 = o.x0, x1 = o.x1, base = o.base ?? g.base, back = o.back ?? g.back;
  const H = o.H, rise = o.rise ?? 18, ov = o.ov ?? 4;
  const yF = base - H, yB = back - H, cx = (x0 + x1) / 2, D = base - back;
  const geo = { x0, x1, cx, base, back, H, yF, yB };
  if (!o.noShadow) shadowBox(g, x0, x1, base, back, H + rise * 0.6);

  const facade = () => {
    wallTex(c, o.wall, x0, yF, x1 - x0, H, o.wallCol);
    if (o.frame) timberFrame(c, x0, yF, x1 - x0, H - (o.noPlinth ? 0 : 3.4), o.beam, o.floors || 1);
    if (o.lowerStone) { wallTex(c, 'stone', x0, base - o.lowerStone, x1 - x0, o.lowerStone, '#9a9286'); c.fillStyle = '#3a2414'; c.fillRect(x0 - 1.5, base - o.lowerStone - 2.2, x1 - x0 + 3, 2.4); }
    wallShade(c, x0, yF, x1 - x0, H);
    if (!o.noPlinth) plinth(c, x0, base, x1 - x0);
    c.strokeStyle = 'rgba(20,10,4,0.7)'; c.lineWidth = 0.7; c.strokeRect(x0, yF, x1 - x0, H);
  };

  if (o.roof === 'X' || o.roof === 'H') {
    const yR = (base + back) / 2 - H - rise;
    geo.ridgeY = yR;
    const eb = yB - ov * 0.4, ef = yF + ov * 0.6;
    const L = x0 - ov, Rx = x1 + ov;
    const ri = o.roof === 'H' ? Math.min((x1 - x0) * 0.25, rise * 1.2) : 0;
    if (yR > eb + 0.5) plane(c, [L, eb], [0, yR - eb], [Rx - L, 0], o.mat, o.roofCol, 1.12,
      ri ? [[L, eb], [Rx, eb], [Rx - ri, yR], [L + ri, yR]] : null);
    facade();
    if (ri) {
      plane(c, [L, ef], [ri, yR - ef], [0, eb - ef], o.mat, o.roofCol, 1.06, [[L, ef], [L + ri, yR], [L, eb]]);
      plane(c, [Rx, ef], [-ri, yR - ef], [0, eb - ef], o.mat, o.roofCol, 0.72, [[Rx, ef], [Rx - ri, yR], [Rx, eb]]);
    }
    plane(c, [L, ef], [0, yR - ef], [Rx - L, 0], o.mat, o.roofCol, 1.0,
      ri ? [[L, ef], [Rx, ef], [Rx - ri, yR], [L + ri, yR]] : null);
    if (!ri) {
      line(c, L, ef, L, Math.min(yR, eb), 'rgba(20,10,4,0.55)', 0.8);
      line(c, Rx, ef, Rx, Math.min(yR, eb), 'rgba(20,10,4,0.55)', 0.8);
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(Rx - 3, Math.min(yR, eb), 3, ef - Math.min(yR, eb));
    } else {
      line(c, L, ef, L + ri, yR, 'rgba(255,240,210,0.3)', 0.6);
      line(c, Rx, ef, Rx - ri, yR, 'rgba(0,0,0,0.45)', 0.6);
    }
    ridgeCap(c, L + ri, yR, Rx - ri, yR, o.mat, o.roofCol);
    line(c, L, ef + 0.3, Rx, ef + 0.3, 'rgba(15,8,2,0.7)', 0.9);
    geo.roofTop = Math.min(yR, eb);
    geo.eaveY = ef;
  } else if (o.roof === 'Z') {
    const apex = yF - rise, ef = yF + ov * 0.5;
    geo.apexY = apex; geo.ridgeY = apex - D; geo.roofTop = apex - D; geo.eaveY = ef;
    plane(c, [x0 - ov, ef], [cx - (x0 - ov), apex - 1 - ef], [0, -D], o.mat, o.roofCol, 1.06);
    plane(c, [x1 + ov, ef], [cx - (x1 + ov), apex - 1 - ef], [0, -D], o.mat, o.roofCol, 0.7);
    ridgeCap(c, cx, apex - 1, cx, apex - 1 - D, o.mat, o.roofCol);
    line(c, x0 - ov, ef - D, cx, apex - 1 - D, 'rgba(255,240,210,0.25)', 0.6);
    facade();
    // фронтон
    const tri = [[x0, yF + 0.5], [cx, apex], [x1, yF + 0.5]];
    clipPoly(c, tri, () => {
      wallTex(c, o.gableWall || o.wall, x0, apex, x1 - x0, yF - apex + 1, o.gableCol || o.wallCol);
      if (o.frame || o.gableWall === 'plaster') {
        const b = o.beam || '#4a2c16';
        c.fillStyle = b; c.fillRect(cx - 1, apex, 2.2, yF - apex);
        line(c, cx, yF - (yF - apex) * 0.45, x0 + (cx - x0) * 0.35, yF, b, 1.6);
        line(c, cx, yF - (yF - apex) * 0.45, x1 - (x1 - cx) * 0.35, yF, b, 1.6);
        c.fillRect(x0, yF - 1.8, x1 - x0, 2);
      }
      c.fillStyle = lingrad(c, 0, apex, 0, yF, [[0, 'rgba(0,0,0,0.45)'], [1, 'rgba(0,0,0,0.05)']]);
      c.fillRect(x0, apex, x1 - x0, yF - apex);
    });
    bargeBoard(c, [[x0 - ov, ef], [cx, apex - 1.2], [x1 + ov, ef]], o.beam || '#5a3a1e');
  } else if (o.roof === 'L') {
    const top = yB - rise, ef = yF + ov * 0.6;
    geo.roofTop = top; geo.eaveY = ef;
    facade();
    plane(c, [x0 - ov, ef], [0, top - ef], [x1 - x0 + 2 * ov, 0], o.mat, o.roofCol, 1.04);
    line(c, x0 - ov, ef + 0.3, x1 + ov, ef + 0.3, 'rgba(15,8,2,0.7)', 0.9);
    line(c, x1 + ov, ef, x1 + ov, top, 'rgba(0,0,0,0.5)', 0.8);
  }
  return geo;
}

// Навес на столбах (открытый сарай): видно тёмное нутро.
function shed(c, g, o) {
  const { x0, x1, H } = o, base = o.base ?? g.base, back = o.back ?? g.back;
  const yF = base - H;
  shadowBox(g, x0, x1, base, back, H + (o.rise || 10) * 0.6);
  c.fillStyle = lingrad(c, 0, back - H, 0, base, [[0, '#120a06'], [1, '#2e1e12']]);
  c.fillRect(x0, back - H, x1 - x0, base - back + H);
  if (o.inside) o.inside(c);
  const posts = o.posts || 3;
  for (let k = 0; k < posts; k++) {
    const px = x0 + k * (x1 - x0 - 2.6) / (posts - 1);
    c.fillStyle = lingrad(c, px, 0, px + 2.6, 0, [[0, '#8a5a30'], [1, '#3e2410']]);
    c.fillRect(px, yF, 2.6, H);
  }
  return house(c, g, { ...o, wall: 'plank', wallCol: '#3a2414', noShadow: true, noPlinth: true, H: 0.01, base: yF, back: back - H + 0.01, roof: o.roof || 'L' });
}

// ================= Двери, окна, трубы =================

function door(c, cx, base, w, h, o = {}) {
  const arch = (ww, hh) => {
    c.beginPath();
    c.moveTo(cx - ww / 2, base);
    if (o.square) { c.lineTo(cx - ww / 2, base - hh); c.lineTo(cx + ww / 2, base - hh); }
    else { c.lineTo(cx - ww / 2, base - hh + ww / 2); c.arc(cx, base - hh + ww / 2, ww / 2, Math.PI, 0); }
    c.lineTo(cx + ww / 2, base); c.closePath();
  };
  if (o.frame === 'stone') {
    arch(w + 4, h + 2.2); c.fillStyle = '#9a9286'; c.fill();
    c.strokeStyle = 'rgba(40,30,20,0.6)'; c.lineWidth = 0.4;
    for (let k = 0; k < 7; k++) {
      const a = Math.PI + k / 6 * Math.PI, ay = base - h + w / 2;
      c.beginPath(); c.moveTo(cx + Math.cos(a) * w / 2, ay + Math.sin(a) * w / 2); c.lineTo(cx + Math.cos(a) * (w / 2 + 2), ay + Math.sin(a) * (w / 2 + 2)); c.stroke();
    }
  } else {
    c.fillStyle = '#3a2414';
    c.fillRect(cx - w / 2 - 1.6, base - h - (o.square ? 1.6 : 0), w + 3.2, h + (o.square ? 1.6 : 0));
    if (o.square) { c.fillStyle = '#6a4424'; c.fillRect(cx - w / 2 - 2.2, base - h - 2, w + 4.4, 1.4); }
  }
  arch(w, h);
  if (o.open) { c.fillStyle = '#0e0805'; c.fill(); }
  else {
    c.fillStyle = lingrad(c, cx - w / 2, 0, cx + w / 2, 0, [[0, o.col ? shade(o.col, 0.1) : '#7a4e2a'], [1, o.col ? shade(o.col, -0.35) : '#4a2c16']]);
    c.fill();
    c.save(); arch(w, h); c.clip();
    c.fillStyle = 'rgba(25,10,4,0.55)';
    for (let x = cx - w / 2 + 2; x < cx + w / 2; x += 2) c.fillRect(x, base - h, 0.35, h);
    if (o.double) { c.fillStyle = 'rgba(10,5,2,0.8)'; c.fillRect(cx - 0.4, base - h, 0.8, h); }
    c.fillStyle = '#2c2a28';
    c.fillRect(cx - w / 2, base - h * 0.72, w, 0.9);
    c.fillRect(cx - w / 2, base - h * 0.28, w, 0.9);
    if (o.braces) {
      const half = o.double ? [[cx - w / 2, cx], [cx, cx + w / 2]] : [[cx - w / 2, cx + w / 2]];
      for (const [a, b] of half) { line(c, a + 0.5, base - 1, b - 0.5, base - h + 2, 'rgba(240,230,210,0.85)', 1); line(c, b - 0.5, base - 1, a + 0.5, base - h + 2, 'rgba(240,230,210,0.85)', 1); }
    }
    c.fillStyle = lingrad(c, 0, base - h, 0, base, [[0, 'rgba(0,0,0,0.45)'], [0.3, 'rgba(0,0,0,0)']]);
    c.fillRect(cx - w / 2, base - h, w, h);
    c.restore();
    c.strokeStyle = '#c8a050'; c.lineWidth = 0.4;
    if (o.gnome && !o.double) {
      // гномья круглая дверь: латунная ручка посередине и кованые петли
      ellipse(c, cx, base - h * 0.5, 1.1, 1.1, '#c8a050'); ellipse(c, cx - 0.3, base - h * 0.5 - 0.3, 0.4, 0.4, '#fff2a0');
      c.fillStyle = '#2c2a28'; c.fillRect(cx - w / 2, base - h * 0.72, w * 0.45, 1.1); c.fillRect(cx - w / 2, base - h * 0.28, w * 0.45, 1.1);
    } else { c.beginPath(); c.arc(cx + (o.double ? 1.6 : w / 2 - 1.8), base - h * 0.48, 0.7, 0, 7); c.stroke(); }
  }
  // ступенька
  c.fillStyle = '#7e766c'; c.fillRect(cx - w / 2 - 2, base - 0.3, w + 4, 2);
  c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(cx - w / 2 - 2, base - 0.3, w + 4, 0.4);
  c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(cx - w / 2 - 2, base + 1.4, w + 4, 0.5);
}

// Круглое гномье окошко в деревянном кольце
function roundWin(c, cx, cy, r, o = {}) {
  ellipse(c, cx, cy, r + 1.3, r + 1.3, '#3a2414');
  ellipse(c, cx, cy, r + 0.8, r + 0.8, '#7a5030');
  c.save();
  c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.clip();
  c.fillStyle = o.magic ? lingrad(c, cx, cy - r, cx, cy + r, [[0, '#f0e8ff'], [1, '#8a60e0']])
    : o.lit ? radgrad(c, cx, cy, 0.5, r * 1.2, [[0, '#fff4c0'], [1, '#e8943a']])
      : lingrad(c, cx - r, cy - r, cx + r, cy + r, [[0, '#6c8aa8'], [0.5, '#2a3848'], [1, '#141c26']]);
  c.fillRect(cx - r, cy - r, r * 2, r * 2);
  c.fillStyle = '#3a2414';
  c.fillRect(cx - 0.35, cy - r, 0.7, r * 2); c.fillRect(cx - r, cy - 0.35, r * 2, 0.7);
  if (!o.lit && !o.magic) { c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(cx - r * 0.6, cy - r * 0.55, 0.7, 0.7); }
  c.restore();
  if (o.flowers) {
    c.fillStyle = '#5a3a1e'; c.fillRect(cx - r - 1, cy + r + 0.8, r * 2 + 2, 1.6);
    for (let k = 0; k <= 3; k++) {
      ellipse(c, cx - r + k * (r * 2 / 3), cy + r + 0.6, 0.9, 0.9, '#3e7a2a');
      ellipse(c, cx - r + k * (r * 2 / 3) + 0.2, cy + r, 0.6, 0.6, ['#e04a5a', '#f0d040', '#f4f4f4', '#d070c0'][k % 4]);
    }
  }
}

// Грибок у стены: красная шляпка в белый горошек или бурый боровик
function mushroomProp(c, x, y, s = 1, red = true) {
  c.fillStyle = '#efe6d0'; c.fillRect(x - 0.7 * s, y - 2.4 * s, 1.4 * s, 2.4 * s);
  const cap = red ? '#c8341e' : '#8a5a2a';
  c.fillStyle = cap;
  c.beginPath(); c.ellipse(x, y - 2.4 * s, 2.2 * s, 1.7 * s, 0, Math.PI, 0); c.fill();
  c.fillStyle = shade(cap, -0.35); c.fillRect(x - 2.2 * s, y - 2.5 * s, 4.4 * s, 0.5 * s);
  if (red) { c.fillStyle = '#fff6ea'; c.fillRect(x - 1 * s, y - 3.5 * s, 0.7 * s, 0.6 * s); c.fillRect(x + 0.6 * s, y - 3.1 * s, 0.6 * s, 0.6 * s); c.fillRect(x - 0.1 * s, y - 4 * s, 0.5 * s, 0.5 * s); }
  else { c.fillStyle = 'rgba(255,230,180,0.4)'; c.fillRect(x - 1.2 * s, y - 3.6 * s, 1.2 * s, 0.5 * s); }
}

function win(c, x, y, w, h, o = {}) {
  if (o.round) { roundWin(c, x + w / 2, y + h / 2, Math.min(w, h) / 2 + 0.6, o); return; }
  if (o.shutter) {
    for (const sx of [x - 3, x + w]) {
      c.fillStyle = lingrad(c, sx, 0, sx + 3, 0, [[0, shade(o.shutter, 0.15)], [1, shade(o.shutter, -0.25)]]);
      c.fillRect(sx, y - 0.4, 3, h + 0.8);
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(sx + 1, y, 0.3, h); c.fillRect(sx + 2, y, 0.3, h);
      c.fillStyle = '#2c2a28'; c.fillRect(sx, y + 1.2, 3, 0.5); c.fillRect(sx, y + h - 1.6, 3, 0.5);
    }
  }
  c.fillStyle = o.stone ? '#a49c90' : '#3a2414';
  if (o.arch) { c.beginPath(); c.moveTo(x - 1, y + h + 1); c.lineTo(x - 1, y + w / 2); c.arc(x + w / 2, y + w / 2, w / 2 + 1, Math.PI, 0); c.lineTo(x + w + 1, y + h + 1); c.fill(); }
  else c.fillRect(x - 0.9, y - 0.9, w + 1.8, h + 1.8);
  c.save();
  c.beginPath();
  if (o.arch) { c.moveTo(x, y + h); c.lineTo(x, y + w / 2); c.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); c.lineTo(x + w, y + h); c.closePath(); }
  else c.rect(x, y, w, h);
  c.clip();
  c.fillStyle = o.magic ? lingrad(c, x, y, x, y + h, [[0, '#f0e8ff'], [1, '#8a60e0']])
    : o.lit ? lingrad(c, x, y, x, y + h, [[0, '#fff0b8'], [1, '#e8943a']])
      : lingrad(c, x, y, x + w, y + h, [[0, '#6c8aa8'], [0.5, '#2a3848'], [1, '#141c26']]);
  c.fillRect(x, y, w, h);
  if (!o.lit && !o.magic) { c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(x + 0.5, y + h * 0.7); c.lineTo(x + w * 0.7, y + 0.5); c.stroke(); }
  c.fillStyle = '#3a2414';
  c.fillRect(x + w / 2 - 0.35, y, 0.7, h);
  c.fillRect(x, y + h * 0.48, w, 0.7);
  c.restore();
  c.fillStyle = '#b0a698'; c.fillRect(x - 1.4, y + h + 0.6, w + 2.8, 1.2);
  c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x - 1.4, y + h + 1.8, w + 2.8, 0.5);
  if (o.flowers) {
    c.fillStyle = '#5a3a1e'; c.fillRect(x - 0.8, y + h + 1.6, w + 1.6, 1.8);
    for (let k = 0; k <= 4; k++) {
      ellipse(c, x + k * (w / 4), y + h + 1.2, 0.9, 0.9, '#3e7a2a');
      ellipse(c, x + k * (w / 4) + 0.2, y + h + 0.6, 0.6, 0.6, ['#e04a5a', '#f0d040', '#f4f4f4', '#d070c0'][k % 4]);
    }
  }
}

function chimney(c, x, yBase, h, kind = 'brick', w = 5) {
  const col = kind === 'brick' ? '#9a4e34' : '#8e877c';
  wallTex(c, kind, x, yBase - h, w, h, col);
  c.fillStyle = lingrad(c, x, 0, x + w, 0, [[0, 'rgba(255,240,210,0.15)'], [1, 'rgba(0,0,0,0.35)']]);
  c.fillRect(x, yBase - h, w, h);
  c.fillStyle = '#4a4440'; c.fillRect(x - 0.8, yBase - h - 1.4, w + 1.6, 1.8);
  c.fillStyle = '#100c0a'; c.fillRect(x + 0.6, yBase - h - 1.4, w - 1.2, 0.8);
  c.strokeStyle = 'rgba(20,10,4,0.6)'; c.lineWidth = 0.5; c.strokeRect(x, yBase - h, w, h);
  return [x + w / 2, yBase - h - 2];
}

function dormer(c, cx, base, w, h, mat, roofCol, wallCol, o = {}) {
  wallTex(c, 'plaster', cx - w / 2, base - h, w, h, wallCol);
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(cx - w / 2, base - h, w, 2);
  win(c, cx - w / 2 + 2, base - h + 2, w - 4, h - 3.5, o);
  const ap = base - h - w * 0.45;
  plane(c, [cx - w / 2 - 1.5, base - h + 0.6], [w / 2 + 1.5, ap - (base - h + 0.6)], [0, -5], mat, roofCol, 1.06);
  plane(c, [cx + w / 2 + 1.5, base - h + 0.6], [-(w / 2 + 1.5), ap - (base - h + 0.6)], [0, -5], mat, roofCol, 0.72);
  bargeBoard(c, [[cx - w / 2 - 1.5, base - h + 0.6], [cx, ap], [cx + w / 2 + 1.5, base - h + 0.6]]);
}

// ================= Реквизит =================

function shadowAt(c, x, y, rx, ry = rx * 0.32) { ellipse(c, x + rx * 0.3, y, rx, ry, 'rgba(10,8,4,0.32)'); }

function barrel(c, x, y, s = 1) {
  shadowAt(c, x + 1, y + 0.5, 5 * s);
  c.fillStyle = lingrad(c, x - 4.5 * s, 0, x + 4.5 * s, 0, [[0, '#a86c38'], [0.35, '#8a5428'], [1, '#3e220e']]);
  c.beginPath();
  c.moveTo(x - 3.6 * s, y); c.quadraticCurveTo(x - 4.8 * s, y - 5 * s, x - 3.6 * s, y - 10 * s);
  c.lineTo(x + 3.6 * s, y - 10 * s); c.quadraticCurveTo(x + 4.8 * s, y - 5 * s, x + 3.6 * s, y);
  c.closePath(); c.fill();
  c.strokeStyle = 'rgba(30,15,5,0.5)'; c.lineWidth = 0.3;
  for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(x + k * 1.6 * s, y); c.lineTo(x + k * 1.6 * s, y - 10 * s); c.stroke(); }
  for (const hy of [1.6, 8.4]) { c.fillStyle = '#2e2e30'; c.fillRect(x - 4.4 * s, y - hy * s - 0.5, 8.8 * s, 1); c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(x - 4 * s, y - hy * s - 0.5, 3 * s, 0.3); }
  ellipse(c, x, y - 10 * s, 3.6 * s, 1.3 * s, '#5a3a1a');
  ellipse(c, x, y - 10 * s, 2.8 * s, 0.9 * s, '#8a5a30');
}

function crate(c, x, y, s = 7, col = '#9a6a36') {
  shadowAt(c, x + s / 2 + 2, y + 0.5, s * 0.7);
  const top = y - s;
  poly(c, [[x, top], [x + s, top], [x + s + 2.4, top - 2], [x + 2.4, top - 2]], shade(col, 0.25));
  poly(c, [[x + s, top], [x + s + 2.4, top - 2], [x + s + 2.4, y - 2], [x + s, y]], shade(col, -0.4));
  c.fillStyle = lingrad(c, x, top, x, y, [[0, col], [1, shade(col, -0.25)]]);
  c.fillRect(x, top, s, s);
  c.strokeStyle = shade(col, -0.6); c.lineWidth = 0.5;
  c.strokeRect(x + 0.3, top + 0.3, s - 0.6, s - 0.6);
  c.beginPath(); c.moveTo(x + 0.8, top + 0.8); c.lineTo(x + s - 0.8, y - 0.8); c.stroke();
  c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(x, top + s / 2, s, 0.4);
}

function sack(c, x, y, col = '#d8c8a0', s = 1) {
  shadowAt(c, x + 1, y + 0.4, 4.5 * s);
  c.fillStyle = lingrad(c, x - 4 * s, y - 8 * s, x + 4 * s, y, [[0, shade(col, 0.18)], [1, shade(col, -0.38)]]);
  c.beginPath();
  c.moveTo(x - 4 * s, y); c.quadraticCurveTo(x - 5 * s, y - 5.5 * s, x - 1.6 * s, y - 7.5 * s);
  c.lineTo(x + 1.6 * s, y - 7.5 * s); c.quadraticCurveTo(x + 5 * s, y - 5.5 * s, x + 4 * s, y);
  c.closePath(); c.fill();
  c.strokeStyle = 'rgba(60,40,20,0.4)'; c.lineWidth = 0.35;
  c.beginPath(); c.moveTo(x - 2 * s, y - 2 * s); c.quadraticCurveTo(x, y - 4 * s, x + 1.5 * s, y - 2.5 * s); c.stroke();
  c.fillStyle = '#7a6040'; c.fillRect(x - 1.6 * s, y - 8 * s, 3.2 * s, 1.2 * s);
  ellipse(c, x, y - 8.6 * s, 1.4 * s, 0.8 * s, shade(col, -0.1));
}

function logPile(c, x, y, rows = 3, len = 9) {
  shadowAt(c, x + rows * 3, y + 0.5, rows * 4 + 3);
  for (let row = 0; row < rows; row++) for (let k = 0; k < rows - row; k++) {
    const lx = x + k * 5.6 + row * 2.8, ly = y - 2.6 - row * 4.8;
    c.fillStyle = lingrad(c, 0, ly - 2.6, 0, ly + 2.6, [[0, '#9a6a38'], [1, '#4a2c14']]);
    c.fillRect(lx - len, ly - 2.6, len, 5.2);
    c.strokeStyle = 'rgba(30,15,5,0.4)'; c.lineWidth = 0.3;
    c.beginPath(); c.moveTo(lx - len, ly - 0.6); c.lineTo(lx, ly - 0.6); c.stroke();
    ellipse(c, lx, ly, 2.7, 2.6, '#5a3a1c');
    ellipse(c, lx, ly, 2.2, 2.1, '#dcb27a');
    c.strokeStyle = 'rgba(140,90,40,0.7)'; c.lineWidth = 0.3;
    c.beginPath(); c.arc(lx, ly, 1.3, 0, 7); c.stroke();
    c.beginPath(); c.arc(lx, ly, 0.5, 0, 7); c.stroke();
  }
}

function plankStack(c, x, y, w = 16, n = 5) {
  shadowAt(c, x + w / 2 + 2, y + 0.5, w * 0.6);
  for (let k = 0; k < n; k++) {
    const yy = y - k * 1.6, xx = x + (k % 2) * 0.8;
    c.fillStyle = shade('#d8a45a', rnd(-0.12, 0.06)); c.fillRect(xx, yy - 1.6, w, 1.6);
    c.fillStyle = 'rgba(80,40,10,0.45)'; c.fillRect(xx, yy - 0.3, w, 0.3);
    c.fillStyle = '#c08a48'; c.fillRect(xx + w - 0.6, yy - 1.6, 0.6, 1.6);
  }
}

function hayBale(c, x, y, s = 1) {
  shadowAt(c, x + 1, y + 0.5, 7 * s);
  c.fillStyle = lingrad(c, x - 7 * s, y - 9 * s, x + 7 * s, y, [[0, '#f0d878'], [1, '#9a7a24']]);
  c.beginPath(); c.moveTo(x - 7 * s, y); c.quadraticCurveTo(x - 7.5 * s, y - 9 * s, x, y - 10 * s); c.quadraticCurveTo(x + 7.5 * s, y - 9 * s, x + 7 * s, y); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(110,80,20,0.55)'; c.lineWidth = 0.35;
  for (let k = -6; k <= 6; k += 1.1) { c.beginPath(); c.moveTo(x + k * s, y - 0.4); c.lineTo(x + k * 0.6 * s + rnd(-0.4, 0.4), y - 9 * s + Math.abs(k) * 0.6); c.stroke(); }
  line(c, x - 6 * s, y - 4 * s, x + 6 * s, y - 4 * s, 'rgba(110,70,20,0.5)', 0.5);
}

function cart(c, x, y, load = null) {
  shadowAt(c, x + 9, y + 0.5, 11, 2.6);
  c.fillStyle = lingrad(c, 0, y - 9, 0, y - 3, [[0, '#9a6a38'], [1, '#4a2c14']]);
  c.fillRect(x, y - 9, 17, 5.5);
  c.strokeStyle = '#2e1a0a'; c.lineWidth = 0.4; c.strokeRect(x, y - 9, 17, 5.5);
  for (let k = 1; k < 4; k++) line(c, x + k * 4.2, y - 9, x + k * 4.2, y - 3.5, 'rgba(30,15,5,0.5)', 0.3);
  if (load === 'logs') for (let k = 0; k < 3; k++) { c.fillStyle = '#7a4a22'; c.fillRect(x - 1, y - 12 - k * 2.2 + (k > 1 ? 1 : 0), 19, 2.4); ellipse(c, x + 18, y - 10.8 - k * 2.2, 1.2, 1.2, '#dcb27a'); }
  else if (load) {
    c.fillStyle = load;
    c.beginPath(); c.ellipse(x + 8.5, y - 9, 8, 3.4, 0, Math.PI, 0); c.fill();
    for (let k = 0; k < 10; k++) ellipse(c, x + 2 + srand() * 13, y - 9.4 - srand() * 2.4, 1.1, 0.8, shade(load, rnd(0.1, 0.4)));
  }
  line(c, x + 17, y - 5, x + 24, y - 2.4, '#5a3a1e', 1);
  line(c, x + 17, y - 6.5, x + 24, y - 3.6, '#5a3a1e', 0.8);
  for (const wx of [x + 4, x + 13]) {
    ellipse(c, wx, y - 2.4, 3.2, 3.2, '#2e1a0a');
    ellipse(c, wx, y - 2.4, 2.5, 2.5, '#7a5030');
    c.strokeStyle = '#2e1a0a'; c.lineWidth = 0.4;
    for (let a = 0; a < 6; a++) { c.beginPath(); c.moveTo(wx, y - 2.4); c.lineTo(wx + Math.cos(a) * 2.4, y - 2.4 + Math.sin(a) * 2.4); c.stroke(); }
    ellipse(c, wx, y - 2.4, 0.7, 0.7, '#1a0e06');
  }
}

function fence(c, x0, x1, y, h = 6) {
  for (let x = x0; x <= x1; x += 4.5) {
    c.fillStyle = '#4a2c14'; c.fillRect(x, y - h, 1.3, h + 0.6);
    c.fillStyle = '#8a6040'; c.fillRect(x, y - h, 0.45, h + 0.6);
    c.fillStyle = '#2e1a0a'; c.fillRect(x - 0.2, y - h - 0.4, 1.7, 0.6);
  }
  c.fillStyle = '#6e4a2c'; c.fillRect(x0, y - h * 0.75, x1 - x0 + 1.3, 0.9); c.fillRect(x0, y - h * 0.35, x1 - x0 + 1.3, 0.9);
  c.fillStyle = 'rgba(255,230,190,0.25)'; c.fillRect(x0, y - h * 0.75, x1 - x0 + 1.3, 0.3); c.fillRect(x0, y - h * 0.35, x1 - x0 + 1.3, 0.3);
}

function fenceV(c, x, y0, y1, h = 6) {
  for (let y = y0; y <= y1; y += 4.5) {
    c.fillStyle = '#4a2c14'; c.fillRect(x, y - h, 1.3, h + 0.6);
    c.fillStyle = '#8a6040'; c.fillRect(x, y - h, 0.45, h + 0.6);
  }
  c.fillStyle = '#6e4a2c'; c.fillRect(x + 0.2, y0 - h * 0.75, 0.9, y1 - y0); c.fillRect(x + 0.2, y0 - h * 0.35, 0.9, y1 - y0);
}

function trough(c, x, y, w, fill = '#d8c060') {
  shadowAt(c, x + w / 2 + 1, y + 0.5, w * 0.55);
  c.fillStyle = '#4a2c14'; c.fillRect(x + 1, y - 1.5, 1, 1.5); c.fillRect(x + w - 2, y - 1.5, 1, 1.5);
  poly(c, [[x, y - 5], [x + w, y - 5], [x + w - 1, y - 1.5], [x + 1, y - 1.5]], '#7a5030', '#2e1a0a', 0.4);
  c.fillStyle = fill; c.fillRect(x + 0.8, y - 5, w - 1.6, 1.2);
}

function well(c, x, y) {
  shadowAt(c, x + 2, y + 0.5, 8, 2.8);
  c.fillStyle = lingrad(c, x - 6, 0, x + 6, 0, [[0, '#b0a898'], [1, '#5c564f']]);
  c.beginPath(); c.ellipse(x, y - 3, 6, 2.6, 0, 0, Math.PI); c.lineTo(x - 6, y - 7); c.ellipse(x, y - 7, 6, 2.6, 0, Math.PI, 0, true); c.closePath(); c.fill();
  ellipse(c, x, y - 7, 6, 2.6, '#8e877c'); ellipse(c, x, y - 7, 4.6, 1.8, '#101418');
  c.fillStyle = '#4a2c14'; c.fillRect(x - 5.6, y - 17, 1.2, 10); c.fillRect(x + 4.4, y - 17, 1.2, 10);
  poly(c, [[x - 8, y - 16], [x, y - 22], [x + 8, y - 16]], '#6a4424', '#2e1a0a', 0.4);
  line(c, x - 5, y - 15, x + 5, y - 15, '#3a2414', 1);
  line(c, x, y - 15, x, y - 10, '#c8b890', 0.4);
  c.fillStyle = '#6a4424'; c.fillRect(x - 1.2, y - 10.5, 2.4, 2);
}

function bench(c, x, y, w = 12) {
  c.fillStyle = '#3a2210'; c.fillRect(x + 1, y - 3, 1, 3); c.fillRect(x + w - 2, y - 3, 1, 3);
  c.fillStyle = lingrad(c, 0, y - 4.4, 0, y - 2.8, [[0, '#a87848'], [1, '#6a4422']]);
  c.fillRect(x, y - 4.4, w, 1.6);
}

function table(c, x, y, things = true) {
  shadowAt(c, x + 7, y + 0.4, 8);
  c.fillStyle = '#3a2210'; c.fillRect(x + 1.5, y - 5, 1.2, 5); c.fillRect(x + 11.5, y - 5, 1.2, 5);
  poly(c, [[x, y - 5], [x + 14, y - 5], [x + 15.5, y - 7.5], [x + 1.5, y - 7.5]], '#9a6a3c', '#3a2210', 0.4);
  if (things) {
    c.fillStyle = '#d8a840'; c.fillRect(x + 4, y - 9.6, 2, 2.6); c.fillStyle = '#fffbe8'; c.fillRect(x + 4, y - 10, 2, 0.8);
    ellipse(c, x + 10, y - 7.2, 2.4, 0.9, '#cec6ba'); ellipse(c, x + 10, y - 7.6, 1.4, 0.6, '#b8742c');
  }
}

function lantern(c, x, y) {
  line(c, x, y - 3, x + 3, y - 3, '#2a2220', 0.6);
  c.fillStyle = '#2a2220'; c.fillRect(x + 2, y - 2.6, 2.4, 3.6);
  c.fillStyle = '#ffd070'; c.fillRect(x + 2.4, y - 2, 1.6, 2.4);
}

// Средневековая вывеска: кованый прут из стены с подкосом и завитком,
// на двух цепочках — деревянная доска со значком ремесла, без надписей.
// (x, y) — где прут входит в стену, dir — в какую сторону он торчит.
function hangingSign(c, x0, y0, kind, dir = 1) {
  c.save(); c.translate(x0, y0); c.scale(1.55, 1.55);
  drawHangingSign(c, 0, 0, kind, dir);
  c.restore();
}

function drawHangingSign(c, x, y, kind, dir) {
  const iron = '#24201e';
  c.fillStyle = iron; c.fillRect(x - 0.9, y - 2.2, 1.8, 5.2);                 // накладка на стене
  c.fillStyle = '#5c564f'; c.fillRect(x - 0.9, y - 2.2, 0.5, 5.2);
  line(c, x, y, x + dir * 13, y, iron, 0.9);                                  // прут
  line(c, x, y + 3.6, x + dir * 7.5, y + 0.2, iron, 0.6);                     // подкос
  c.strokeStyle = iron; c.lineWidth = 0.6;                                    // завиток на конце
  c.beginPath(); c.arc(x + dir * 13, y - 1, 1, Math.PI / 2, dir > 0 ? Math.PI * 2 : Math.PI, dir < 0); c.stroke();
  const bx = x + dir * 7.6, top = y + 2;
  for (const k of [-3.6, 3.6]) line(c, bx + k, y + 0.3, bx + k * 0.95, top + 0.3, '#3a3632', 0.4);   // цепочки
  // доска с фигурным верхом
  c.beginPath();
  c.moveTo(bx - 5, top + 1.2); c.quadraticCurveTo(bx, top - 1.2, bx + 5, top + 1.2);
  c.lineTo(bx + 5, top + 8.6); c.quadraticCurveTo(bx, top + 9.6, bx - 5, top + 8.6); c.closePath();
  c.fillStyle = lingrad(c, 0, top, 0, top + 9.5, [[0, '#b88a50'], [1, '#6a4422']]);
  c.fill();
  c.strokeStyle = '#2e1a0c'; c.lineWidth = 0.6; c.stroke();
  c.fillStyle = 'rgba(255,230,180,0.25)'; c.fillRect(bx - 4.2, top + 1.4, 8.4, 0.4);
  c.fillStyle = '#2a2624'; c.fillRect(bx - 3.7, top + 1, 0.6, 0.6); c.fillRect(bx + 3.1, top + 1, 0.6, 0.6);
  signIcon(c, bx, top + 5.1, kind);
}

function signBoard(c, x, y, kind) { hangingSign(c, x, y, kind, 1); }

// Отдельный столб у входа: тёсаный брус в камнях, сверху кованый кронштейн,
// на цепочках — доска со значком. Доска повёрнута к зрителю при любом развороте здания.
function postSign(c, x, y, kind, dir = 1) {
  const H = 30, top = y - H;
  shadowAt(c, x + 1, y, 5);
  line(c, x + 2, y, x + 2 + H * 0.5, y - H * 0.14, 'rgba(12,10,6,0.25)', 2.2);   // тень столба
  c.fillStyle = lingrad(c, x - 1.4, 0, x + 1.4, 0, [[0, '#9a6a38'], [0.5, '#7a4e2a'], [1, '#3e2410']]);
  c.fillRect(x - 1.4, top, 2.8, H);
  c.fillStyle = 'rgba(30,15,5,0.45)'; for (let k = 4; k < H; k += 6) c.fillRect(x - 1.4, top + k, 2.8, 0.4);   // трещинки
  c.fillStyle = '#5a3a1e'; c.fillRect(x - 1.9, top - 1, 3.8, 1.4);                 // шапочка
  // мох и камушки у основания
  for (const [dx, s] of [[-2.6, 1.3], [2.4, 1.1], [0.3, 0.9]]) { ellipse(c, x + dx, y - 0.2, s * 1.4, s, '#8e877c'); ellipse(c, x + dx - 0.3, y - 0.6, s * 0.6, s * 0.4, '#cec6ba'); }
  ellipse(c, x - 0.6, y - 2.2, 1.6, 1, '#4a6e30');
  hangingSign(c, x + dir * 0.6, top + 2.5, kind, dir);
}

function signIcon(c, cx, cy, kind) {
  if (kind === 'mug') {
    c.fillStyle = '#d8a840'; c.fillRect(cx - 2, cy - 2.2, 4, 4.8);
    c.fillStyle = '#fffbe8'; c.fillRect(cx - 2.3, cy - 3, 4.6, 1.4);
    c.strokeStyle = '#d8a840'; c.lineWidth = 0.8; c.beginPath(); c.arc(cx + 2.3, cy, 1.3, -1.5, 1.5); c.stroke();
  } else if (kind === 'bread') {
    ellipse(c, cx, cy + 0.4, 3.4, 2.1, '#c8823a');
    for (let k = -1; k <= 1; k++) line(c, cx + k * 1.3 - 0.6, cy - 0.6, cx + k * 1.3 + 0.6, cy + 1, '#f0c080', 0.5);
  } else if (kind === 'book') {
    c.fillStyle = '#f0e8d0'; c.fillRect(cx - 3.2, cy - 2.2, 6.4, 4.6);
    c.fillStyle = '#7a2a1a'; c.fillRect(cx - 0.3, cy - 2.4, 0.6, 5);
  } else if (kind === 'ham') {
    ellipse(c, cx, cy + 0.6, 2.4, 3, '#c8583a'); ellipse(c, cx - 0.5, cy, 1.2, 1.6, '#f0a070');
    c.fillStyle = '#f6f2ea'; c.fillRect(cx - 0.4, cy - 3.8, 0.8, 1.6);
  } else if (kind === 'star') {
    poly(c, [[cx, cy - 3.4], [cx + 0.9, cy - 1], [cx + 3.4, cy - 0.8], [cx + 1.4, cy + 0.9], [cx + 2.1, cy + 3.4], [cx, cy + 1.9], [cx - 2.1, cy + 3.4], [cx - 1.4, cy + 0.9], [cx - 3.4, cy - 0.8], [cx - 0.9, cy - 1]], '#f6d458');
  } else if (kind === 'anvil') {
    poly(c, [[cx - 3.4, cy - 1.4], [cx + 3.4, cy - 1.4], [cx + 1.4, cy + 0.4], [cx + 1.4, cy + 2.4], [cx - 1.4, cy + 2.4], [cx - 1.4, cy + 0.4]], '#3a3a40');
  } else if (kind === 'hide') {
    poly(c, [[cx - 2.4, cy - 3], [cx + 2.4, cy - 3], [cx + 3, cy], [cx + 2, cy + 3], [cx - 2, cy + 3], [cx - 3, cy]], '#c08850');
  } else if (kind === 'crate') {
    c.fillStyle = '#c89a5a'; c.fillRect(cx - 3, cy - 2.6, 6, 5.4);
    c.strokeStyle = '#5a3a1e'; c.lineWidth = 0.6; c.strokeRect(cx - 3, cy - 2.6, 6, 5.4);
    line(c, cx - 3, cy - 2.6, cx + 3, cy + 2.8, '#5a3a1e', 0.6); line(c, cx + 3, cy - 2.6, cx - 3, cy + 2.8, '#5a3a1e', 0.6);
  } else if (kind === 'goat') {
    for (const s of [-1, 1]) {
      c.strokeStyle = '#d8c8a0'; c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(cx + s * 0.8, cy - 1.6); c.quadraticCurveTo(cx + s * 3.4, cy - 4.4, cx + s * 3.6, cy - 1.2); c.stroke();
      ellipse(c, cx + s * 2.4, cy - 0.4, 1, 0.5, '#f0ece0');
    }
    ellipse(c, cx, cy + 0.4, 1.7, 2.4, '#f0ece0');
    c.fillStyle = '#1e1b19'; c.fillRect(cx - 1, cy - 0.2, 0.5, 0.5); c.fillRect(cx + 0.5, cy - 0.2, 0.5, 0.5);
    poly(c, [[cx - 0.6, cy + 2.6], [cx + 0.6, cy + 2.6], [cx, cy + 4]], '#cec6ba');
  } else if (kind === 'horseshoe') {
    c.strokeStyle = '#9e958a'; c.lineWidth = 1.4;
    c.beginPath(); c.arc(cx, cy - 0.4, 2.6, Math.PI * 0.95, Math.PI * 2.05, true); c.stroke();
    c.fillStyle = '#2c2825'; for (const a of [0.3, 0.75, 1.25, 1.7]) c.fillRect(cx + Math.cos(a * Math.PI / 2 + 0.2) * 2.6 - 0.25, cy - 0.4 + Math.sin(a * Math.PI / 2 + 0.2) * 2.6 - 0.25, 0.5, 0.5);
  } else if (kind === 'axe') {
    line(c, cx - 2.6, cy + 3, cx + 1.8, cy - 2.6, '#6e4428', 0.9);
    poly(c, [[cx + 0.6, cy - 3.4], [cx + 3.4, cy - 1.6], [cx + 2.6, cy + 0.6], [cx + 1, cy - 1.2]], '#cec6ba', '#3a3632', 0.3);
  } else if (kind === 'saw') {
    c.fillStyle = '#b6ada0'; c.fillRect(cx - 3.4, cy - 1.2, 6, 2);
    c.fillStyle = '#4a4540'; for (let k = 0; k < 6; k++) poly(c, [[cx - 3.4 + k, cy + 0.8], [cx - 2.4 + k, cy + 0.8], [cx - 2.9 + k, cy + 1.7]], '#706960');
    c.fillStyle = '#7a4a24'; rrect(c, cx + 2.4, cy - 1.8, 1.6, 3.2, 0.5); c.fill();
  } else if (kind === 'pick') {
    line(c, cx, cy - 1.6, cx, cy + 3.4, '#6e4428', 0.9);
    c.strokeStyle = '#9e958a'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(cx - 3.4, cy - 0.4); c.quadraticCurveTo(cx, cy - 3.4, cx + 3.4, cy - 0.4); c.stroke();
  } else if (kind === 'nugget') {
    line(c, cx - 2.6, cy + 3, cx + 1.4, cy - 1.6, '#6e4428', 0.7);
    ellipse(c, cx + 1, cy + 1.6, 1.8, 1.3, '#e4b434'); ellipse(c, cx - 1.2, cy + 2.2, 1.2, 0.9, '#c89226'); ellipse(c, cx + 0.5, cy + 1.1, 0.6, 0.4, '#fff2a0');
  } else if (kind === 'ingot') {
    poly(c, [[cx - 3.2, cy + 1.8], [cx + 3.2, cy + 1.8], [cx + 2.2, cy - 1], [cx - 2.2, cy - 1]], '#e4b434', '#7e5214', 0.4);
    c.fillStyle = '#fff2a0'; c.fillRect(cx - 1.8, cy - 0.6, 3.2, 0.5);
  } else if (kind === 'wheat') {
    for (const s of [-1.4, 0, 1.4]) {
      line(c, cx + s * 0.4, cy + 3.4, cx + s, cy - 1, '#a4701c', 0.4);
      for (let k = 0; k < 3; k++) ellipse(c, cx + s, cy - 1.2 - k * 0.9, 0.55, 0.6, '#e4b434');
    }
    c.fillStyle = '#7e5214'; c.fillRect(cx - 1.4, cy + 1.4, 2.8, 0.6);
  } else if (kind === 'hops') {
    line(c, cx, cy - 3.6, cx, cy - 2.4, '#3a5a2a', 0.5);
    for (let k = 0; k < 4; k++) for (let j = -1; j <= 1; j += 2) if (k < 3 || j < 0) ellipse(c, cx + j * (1.3 - k * 0.3) * (k === 3 ? 0 : 1), cy - 1.6 + k * 1.3, 1.2 - k * 0.15, 0.8, k % 2 ? '#8eab4c' : '#aac462');
  } else if (kind === 'barrel') {
    c.fillStyle = lingrad(c, cx - 2.6, 0, cx + 2.6, 0, [[0, '#a06840'], [0.5, '#cc9a64'], [1, '#6e432a']]);
    c.beginPath(); c.moveTo(cx - 2, cy - 3); c.quadraticCurveTo(cx - 3.2, cy, cx - 2, cy + 3); c.lineTo(cx + 2, cy + 3); c.quadraticCurveTo(cx + 3.2, cy, cx + 2, cy - 3); c.closePath(); c.fill();
    c.fillStyle = '#3a3632'; c.fillRect(cx - 2.6, cy - 1.6, 5.2, 0.6); c.fillRect(cx - 2.6, cy + 1.1, 5.2, 0.6);
  } else if (kind === 'flour') {
    c.fillStyle = '#efe6d0';
    c.beginPath(); c.moveTo(cx - 2.6, cy + 3); c.quadraticCurveTo(cx - 3.2, cy - 1, cx - 1, cy - 2.4); c.lineTo(cx + 1, cy - 2.4); c.quadraticCurveTo(cx + 3.2, cy - 1, cx + 2.6, cy + 3); c.closePath(); c.fill();
    c.fillStyle = '#8a6a44'; c.fillRect(cx - 1.2, cy - 2.6, 2.4, 0.7);
    ellipse(c, cx, cy - 3.2, 1, 0.6, '#efe6d0');
  } else if (kind === 'pig') {
    ellipse(c, cx - 0.3, cy + 0.4, 3, 2.1, '#eeaab2');
    ellipse(c, cx + 2.6, cy + 0.2, 1, 0.9, '#d0808e'); c.fillStyle = '#7a3a4a'; c.fillRect(cx + 2.4, cy, 0.4, 0.4);
    poly(c, [[cx + 1, cy - 1.4], [cx + 1.8, cy - 2.8], [cx + 2, cy - 1]], '#d0808e');
    c.fillStyle = '#a85a6a'; c.fillRect(cx - 2, cy + 2.2, 0.8, 1.2); c.fillRect(cx + 0.8, cy + 2.2, 0.8, 1.2);
  } else if (kind === 'shield') {
    c.beginPath(); c.moveTo(cx - 3, cy - 3); c.lineTo(cx + 3, cy - 3); c.lineTo(cx + 3, cy); c.quadraticCurveTo(cx + 2.6, cy + 2.6, cx, cy + 3.6); c.quadraticCurveTo(cx - 2.6, cy + 2.6, cx - 3, cy); c.closePath();
    c.fillStyle = '#8c2c20'; c.fill(); c.strokeStyle = '#cec6ba'; c.lineWidth = 0.5; c.stroke();
    c.fillStyle = '#e4b434'; c.fillRect(cx - 0.4, cy - 2.4, 0.8, 5); c.fillRect(cx - 2.2, cy - 0.6, 4.4, 0.8);
  } else if (kind === 'crystal') {
    poly(c, [[cx, cy - 3.6], [cx + 2, cy - 0.6], [cx + 1, cy + 3.2], [cx - 1, cy + 3.2], [cx - 2, cy - 0.6]], '#9c7ae6', '#38245c', 0.4);
    poly(c, [[cx, cy - 3.6], [cx + 0.6, cy - 0.4], [cx, cy + 3]], '#e2d6ff');
  }
}

// Какая вывеска у какого здания
const SIGN_OF = {
  storehouse: 'crate', school: 'book', inn: 'mug', goatpen: 'goat', stable: 'horseshoe', woodcutter: 'axe', sawmill: 'saw',
  quarry: 'pick', goldmine: 'nugget', metallurgist: 'ingot', farm: 'wheat', hopfarm: 'hops', brewery: 'barrel', mill: 'flour',
  bakery: 'bread', swine: 'pig', butchery: 'ham', tannery: 'hide', armory: 'shield', crystalmine: 'crystal', magicworkshop: 'star',
};

function anvil(c, x, y) {
  shadowAt(c, x + 4, y + 0.4, 6);
  c.fillStyle = '#4a2c14'; c.fillRect(x + 1.5, y - 4, 5, 4);
  poly(c, [[x - 1.5, y - 7], [x + 9, y - 7], [x + 7, y - 5], [x + 6, y - 4], [x + 2, y - 4], [x + 1, y - 5]], '#4a4a52');
  c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(x - 1.5, y - 7, 10.5, 0.5);
}

function choppingBlock(c, x, y, tool = 'axe') {
  shadowAt(c, x + 1, y + 0.5, 4);
  c.fillStyle = lingrad(c, x - 3.5, 0, x + 3.5, 0, [[0, '#8a5a30'], [1, '#4a2c14']]);
  c.fillRect(x - 3.5, y - 4, 7, 4);
  ellipse(c, x, y - 4, 3.5, 1.3, '#d4aa72');
  c.strokeStyle = 'rgba(120,70,30,0.6)'; c.lineWidth = 0.3; c.beginPath(); c.ellipse(x, y - 4, 2, 0.7, 0, 0, 7); c.stroke();
  line(c, x - 0.5, y - 4, x - 4, y - 11, '#5a3a1e', 0.9);
  if (tool === 'axe') poly(c, [[x - 1.6, y - 4.2], [x + 2.2, y - 5.6], [x + 1.8, y - 3.2]], '#b8bcc0');
  else poly(c, [[x - 1.6, y - 4.4], [x + 3, y - 5], [x + 3, y - 3], [x - 1.6, y - 3.6]], '#b8bcc0');
}

function sawHorse(c, x, y, withLog = true) {
  shadowAt(c, x + 8, y + 0.5, 10);
  for (const lx of [x, x + 12]) { line(c, lx, y, lx + 2.5, y - 6, '#4a2c14', 1); line(c, lx + 5, y, lx + 2.5, y - 6, '#4a2c14', 1); }
  if (withLog) {
    c.fillStyle = lingrad(c, 0, y - 9.5, 0, y - 5, [[0, '#a87848'], [1, '#5e3a1a']]);
    c.fillRect(x - 3, y - 9.5, 23, 4.5);
    ellipse(c, x + 20, y - 7.2, 1.6, 2.2, '#dcb27a');
    c.fillStyle = '#c8ccd0'; c.fillRect(x + 8, y - 15, 0.8, 7);
    c.fillStyle = '#6a4424'; c.fillRect(x + 6.6, y - 16.4, 3.6, 1.6);
  }
}

function stoneBlocks(c, x, y, n = 3) {
  shadowAt(c, x + 9, y + 0.5, 11);
  const blk = (bx, by, w, h) => {
    poly(c, [[bx, by - h], [bx + w, by - h], [bx + w + 2.4, by - h - 1.8], [bx + 2.4, by - h - 1.8]], '#d6d2c8');
    poly(c, [[bx + w, by - h], [bx + w + 2.4, by - h - 1.8], [bx + w + 2.4, by - 1.8], [bx + w, by]], '#7e7a72');
    c.fillStyle = lingrad(c, 0, by - h, 0, by, [[0, '#bab6ac'], [1, '#948f86']]);
    c.fillRect(bx, by - h, w, h);
    c.strokeStyle = 'rgba(40,36,30,0.6)'; c.lineWidth = 0.4;
    c.strokeRect(bx + 0.2, by - h + 0.2, w - 0.4, h - 0.4);
  };
  blk(x, y, 7.5, 5); if (n > 1) blk(x + 8.5, y, 6.5, 4.6); if (n > 2) blk(x + 3.6, y - 5, 7, 4.6);
}

function wheelbarrow(c, x, y, load = '#a49c90') {
  shadowAt(c, x + 6, y + 0.5, 7);
  ellipse(c, x + 2, y - 2.2, 2.2, 2.2, '#2e1a0a'); ellipse(c, x + 2, y - 2.2, 1.4, 1.4, '#7a5030');
  poly(c, [[x, y - 7], [x + 10, y - 7], [x + 9, y - 3], [x + 2, y - 3]], '#7a5030', '#2e1a0a', 0.4);
  line(c, x + 9, y - 5, x + 15, y - 1, '#5a3a1e', 0.8); line(c, x + 9, y - 3.5, x + 9, y, '#5a3a1e', 0.8);
  c.fillStyle = load; c.beginPath(); c.ellipse(x + 5, y - 7, 4.6, 1.8, 0, Math.PI, 0); c.fill();
}

function armorStand(c, x, y, kind = 'leather') {
  shadowAt(c, x + 1, y + 0.4, 4.5);
  c.fillStyle = '#3a2210'; c.fillRect(x - 0.6, y - 20, 1.2, 20); c.fillRect(x - 3, y - 1, 6, 1);
  c.fillRect(x - 5, y - 16, 10, 1);
  const col = kind === 'mage' ? '#4c3080' : '#875434';
  poly(c, [[x - 4.4, y - 16], [x + 4.4, y - 16], [x + 3.8, y - 7], [x - 3.8, y - 7]], col, shade(col, -0.6), 0.5);
  c.fillStyle = shade(col, -0.3); c.fillRect(x - 0.6, y - 16, 1.2, 9);
  c.fillStyle = '#c89226'; c.fillRect(x - 3, y - 13, 0.8, 0.8); c.fillRect(x + 2.2, y - 13, 0.8, 0.8);
  ellipse(c, x, y - 20.5, 2.4, 2.4, '#6e4a2a');
}

function shield(c, x, y, col) {
  poly(c, [[x - 3, y - 4], [x + 3, y - 4], [x + 3, y], [x, y + 3], [x - 3, y]], col, '#1a120a', 0.5);
  line(c, x, y - 4, x, y + 3, '#d8b050', 0.6);
}

function vat(c, x, y, liquid = '#7a5a2a', r = 6) {
  shadowAt(c, x + 1, y + 0.5, r + 1);
  c.fillStyle = lingrad(c, x - r, 0, x + r, 0, [[0, '#9a6a38'], [1, '#3e220e']]);
  c.beginPath(); c.moveTo(x - r, y - 6); c.lineTo(x - r + 0.6, y); c.lineTo(x + r - 0.6, y); c.lineTo(x + r, y - 6); c.closePath(); c.fill();
  c.fillStyle = '#2e2e30'; c.fillRect(x - r + 0.2, y - 4.6, 2 * r - 0.4, 0.7); c.fillRect(x - r + 0.5, y - 1.6, 2 * r - 1, 0.7);
  ellipse(c, x, y - 6, r, r * 0.35, '#5a3a1a');
  ellipse(c, x, y - 6, r - 1, r * 0.28, liquid);
  ellipse(c, x - r * 0.3, y - 6.3, r * 0.3, r * 0.08, 'rgba(255,255,255,0.3)');
}

function dryingRack(c, x, y, w, hides = 2) {
  shadowAt(c, x + w / 2 + 3, y + 0.5, w * 0.6);
  for (const px of [x, x + w]) { c.fillStyle = lingrad(c, px, 0, px + 1.6, 0, [[0, '#7a5030'], [1, '#3a2210']]); c.fillRect(px, y - 22, 1.6, 22); }
  c.fillStyle = '#4a2c14'; c.fillRect(x - 1, y - 22, w + 3.6, 1.6); c.fillRect(x, y - 4, w + 1.6, 1.2);
  for (let k = 0; k < hides; k++) {
    const hx = x + 2.5 + k * (w - 3) / hides, hw = (w - 3) / hides - 1.5;
    line(c, hx, y - 20.4, hx, y - 18.5, '#c8b890', 0.3); line(c, hx + hw, y - 20.4, hx + hw, y - 18.5, '#c8b890', 0.3);
    poly(c, [[hx, y - 18.5], [hx + hw, y - 18.5], [hx + hw + 1, y - 13], [hx + hw, y - 7], [hx + hw / 2, y - 5.5], [hx, y - 7], [hx - 1, y - 13]], '#b8804e', '#5a3820', 0.5);
    ellipse(c, hx + hw / 2, y - 12, hw * 0.3, 3, '#d0a070');
  }
}

function hen(c, x, y, col = '#f0ece0') {
  ellipse(c, x + 0.6, y + 0.2, 2, 0.6, 'rgba(0,0,0,0.3)');
  ellipse(c, x, y - 2, 2.2, 1.6, col); ellipse(c, x + 1.8, y - 3.6, 1, 1, col);
  c.fillStyle = '#d02a1a'; c.fillRect(x + 1.6, y - 4.9, 0.8, 0.6);
  c.fillStyle = '#e8a030'; c.fillRect(x + 2.7, y - 3.7, 0.8, 0.4);
  line(c, x - 0.4, y - 0.6, x - 0.4, y + 0.2, '#e8a030', 0.3); line(c, x + 0.6, y - 0.6, x + 0.6, y + 0.2, '#e8a030', 0.3);
}

function basket(c, x, y, content) {
  shadowAt(c, x + 1, y + 0.4, 4);
  c.fillStyle = lingrad(c, x - 4, 0, x + 4, 0, [[0, '#c09050'], [1, '#6a4a22']]);
  c.beginPath(); c.moveTo(x - 4, y - 4); c.lineTo(x - 3.2, y); c.lineTo(x + 3.2, y); c.lineTo(x + 4, y - 4); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(60,40,10,0.6)'; c.lineWidth = 0.3;
  for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(x - 4, y - k); c.lineTo(x + 4, y - k); c.stroke(); }
  for (let k = -1; k <= 1; k++) ellipse(c, x + k * 2.2, y - 4.4, 1.7, 1.1, content);
}

function cauldron(c, x, y, liquid = '#6440a8') {
  shadowAt(c, x + 1, y + 0.5, 6);
  c.fillStyle = '#2a2622'; c.fillRect(x - 5, y - 1.6, 1, 1.6); c.fillRect(x + 4, y - 1.6, 1, 1.6);
  c.fillStyle = lingrad(c, x - 5.5, 0, x + 5.5, 0, [[0, '#4a4540'], [1, '#141210']]);
  c.beginPath(); c.ellipse(x, y - 4, 5.5, 4.2, 0, 0, Math.PI); c.lineTo(x - 5.5, y - 4); c.fill();
  ellipse(c, x, y - 4, 5.5, 1.6, '#3a3632');
  ellipse(c, x, y - 4, 4.4, 1.1, liquid);
  ellipse(c, x - 1.4, y - 4.3, 1.2, 0.35, 'rgba(255,255,255,0.4)');
  // огонь под котлом
  ellipse(c, x, y + 0.2, 3, 1, 'rgba(255,140,40,0.85)');
}

function potionShelf(c, x, y) {
  c.fillStyle = '#4a2c14'; c.fillRect(x, y - 14, 1.2, 14); c.fillRect(x + 12, y - 14, 1.2, 14);
  for (const sy of [y - 13, y - 7]) {
    c.fillStyle = '#6a4424'; c.fillRect(x, sy, 13.2, 1);
    for (let k = 0; k < 4; k++) {
      const col = ['#5292bc', '#9c7ae6', '#76b2d4', '#8eab4c'][(k + (sy & 1)) % 4];
      c.fillStyle = col; c.fillRect(x + 1.6 + k * 2.8, sy - 3, 2, 3);
      c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(x + 1.8 + k * 2.8, sy - 2.6, 0.5, 1.4);
      c.fillStyle = '#d8d0c0'; c.fillRect(x + 2 + k * 2.8, sy - 3.8, 1.2, 0.8);
    }
  }
}

function ladder(c, x, y, h) {
  line(c, x, y, x + 2, y - h, '#6a4424', 0.8);
  line(c, x + 4, y, x + 6, y - h, '#6a4424', 0.8);
  for (let k = 2; k < h; k += 3) { const t = k / h; line(c, x + 2 * t, y - k, x + 4 + 2 * t, y - k, '#8a5a30', 0.6); }
}

function hangingMeat(c, x, y) {
  line(c, x, y, x, y + 2.5, '#867e74', 0.4);
  ellipse(c, x, y + 6, 2.2, 3.6, '#ac3e2a');
  ellipse(c, x - 0.5, y + 5, 1, 1.8, '#e07a50');
  c.fillStyle = '#f6f2ea'; c.fillRect(x - 0.4, y + 1.8, 0.8, 1.2);
}

function sausageString(c, x, y, n = 4) {
  for (let k = 0; k < n; k++) ellipse(c, x + k * 2.4, y + 2 + Math.sin(k) * 0.6, 1.3, 2.2, k % 2 ? '#a83a2a' : '#8c2c20');
}

function crystal(c, x, y, s, glow = true) {
  if (glow) ellipse(c, x, y - 4 * s, 5 * s, 5 * s, 'rgba(150,100,255,0.18)');
  poly(c, [[x - 2 * s, y], [x - 1.4 * s, y - 6 * s], [x, y - 9 * s], [x + 1.4 * s, y - 6 * s], [x + 2 * s, y]], '#7e58cc', '#38245c', 0.5);
  poly(c, [[x - 1.4 * s, y - 6 * s], [x, y - 9 * s], [x, y], [x - 2 * s, y]], '#bea4f6');
  c.fillStyle = '#ffffff'; c.fillRect(x - 0.8 * s, y - 7 * s, 0.5, 2.4 * s);
}

function rockMound(c, pts, x0, y0, w, h, col = '#7e7468') {
  clipPoly(c, pts, () => {
    c.fillStyle = shade(col, -0.2); c.fillRect(x0, y0, w, h);
    for (let k = 0; k < w * h / 30; k++) {
      const x = x0 + srand() * w, y = y0 + srand() * h, rx = rnd(3, 8), ry = rnd(2, 5);
      ellipse(c, x + 1, y + 1.2, rx, ry, 'rgba(0,0,0,0.28)');
      ellipse(c, x, y, rx, ry, shade(col, rnd(-0.25, 0.18)));
      ellipse(c, x - rx * 0.3, y - ry * 0.4, rx * 0.45, ry * 0.35, 'rgba(255,250,235,0.2)');
    }
    for (let k = 0; k < w / 6; k++) ellipse(c, x0 + srand() * w, y0 + srand() * h, rnd(2, 4), rnd(1, 2), 'rgba(70,100,40,0.45)');
    c.fillStyle = lingrad(c, x0, 0, x0 + w, 0, [[0, 'rgba(255,245,225,0.18)'], [0.55, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.45)']]);
    c.fillRect(x0, y0, w, h);
  });
  poly(c, pts, null, 'rgba(20,10,4,0.5)', 0.7);
}

// ================= Особые постройки (рисуются в экранных координатах) =================

// Большой костёр: выжженная земля, кольцо из камней, шалаш из досок, куча мусора
// с одной стороны и горка пепла с лопатой — с другой. Пламя анимируется в render.
function drawBonfire(c, g) {
  const cx = g.fx + g.fw / 2, cy = g.fy + g.fh / 2 + 8;
  shadowAt(c, cx, cy + 4, 30, 12);
  ellipse(c, cx, cy, 30, 21, '#3a3632');
  for (let k = 0; k < 60; k++) {
    const a = srand() * Math.PI * 2, d = Math.sqrt(srand());
    ellipse(c, cx + Math.cos(a) * d * 26, cy + Math.sin(a) * d * 18, rnd(1.5, 3.5), rnd(1, 2), shade('#5c564f', rnd(-0.2, 0.25)));
  }
  // кольцо из камней
  for (let k = 0; k < 18; k++) {
    const a = k / 18 * Math.PI * 2;
    const x = cx + Math.cos(a) * 15, y = cy + Math.sin(a) * 10.5;
    ellipse(c, x + 0.6, y + 0.8, 3, 2.2, 'rgba(10,8,4,0.4)');
    ellipse(c, x, y, 3, 2.2, shade('#9e958a', rnd(-0.18, 0.12)));
    ellipse(c, x - 0.8, y - 0.8, 1.2, 0.8, '#cec6ba');
  }
  // угли и пепел внутри
  ellipse(c, cx, cy, 11.5, 7.5, '#2a2624');
  for (let k = 0; k < 16; k++) ellipse(c, cx + rnd(-8, 8), cy + rnd(-5, 5), rnd(1, 2.2), rnd(0.7, 1.4), srand() < 0.4 ? '#c8583a' : '#706960');
  // шалаш из досок
  for (let k = 0; k < 7; k++) {
    const a = k / 7 * Math.PI * 2;
    const bx = cx + Math.cos(a) * 9, by = cy + Math.sin(a) * 6;
    line(c, bx, by, cx + Math.cos(a) * 1.5, cy - 15, '#3a2414', 2.4);
    line(c, bx, by - 0.4, cx + Math.cos(a) * 1.5, cy - 15.4, shade('#a06840', rnd(-0.15, 0.1)), 1.5);
  }
  // куча мусора слева
  const tx = cx - 30, ty = cy + 4;
  ellipse(c, tx, ty, 9, 5, '#45291a');
  for (let k = 0; k < 14; k++) ellipse(c, tx + rnd(-7, 7), ty + rnd(-4, 2), rnd(1, 2.4), rnd(0.8, 1.8), ['#6e432a', '#9c8e48', '#73963e', '#b6ada0', '#e0b882'][(srand() * 5) | 0]);
  line(c, tx - 3, ty - 3, tx - 6, ty - 8, '#e0b882', 0.8);
  // горка пепла справа с лопатой
  const ax = cx + 29, ay = cy + 5;
  c.fillStyle = '#9e958a'; c.beginPath(); c.ellipse(ax, ay, 8, 5, 0, Math.PI, 0); c.fill();
  ellipse(c, ax, ay, 8, 2.4, '#867e74'); ellipse(c, ax - 2, ay - 3, 3, 1.4, '#cec6ba');
  line(c, ax + 3, ay - 2, ax + 9, ay - 14, '#6e432a', 1);
  poly(c, [[ax + 1.4, ay - 1], [ax + 4.6, ay - 3.6], [ax + 5.4, ay + 0.4], [ax + 2.6, ay + 1.6]], '#867e74', '#3a3632', 0.4);
  // бревно-скамья у огня
  c.fillStyle = '#6e432a'; rrect(c, cx - 12, cy + 15, 24, 3.6, 1.6); c.fill();
  ellipse(c, cx + 12, cy + 16.8, 1.6, 1.8, '#cc9a64');
  g.spr.fire = [cx, cy - 6];
  (g.spr.chimneys = g.spr.chimneys || []).push([cx, cy - 22]);
}

// Пламя костра: языки дрожат, искры летят вверх
function drawBonfireFlames(c, x, y, strong, seed) {
  const t = Game.time;
  glow(c, x, y - 2, strong ? 34 : 22, '255,150,60', (strong ? 0.38 : 0.22) + 0.08 * Math.sin(t * 9 + seed));
  const n = strong ? 7 : 4;
  for (let k = 0; k < n; k++) {
    const ph = t * 6 + k * 1.7 + seed, h = (strong ? 13 : 8) * (0.6 + 0.4 * Math.abs(Math.sin(ph))), dx = (k - n / 2) * 1.8;
    c.fillStyle = k % 2 ? '#e07a28' : '#f0a030';
    c.beginPath(); c.moveTo(x + dx - 2.4, y + 1); c.quadraticCurveTo(x + dx + Math.sin(ph) * 2, y - h * 0.6, x + dx + Math.sin(ph * 1.3), y - h);
    c.quadraticCurveTo(x + dx + 1.4, y - h * 0.4, x + dx + 2.4, y + 1); c.fill();
  }
  c.fillStyle = '#fff2a0'; c.beginPath(); c.ellipse(x, y - 1, 3, 2.4, 0, 0, Math.PI * 2); c.fill();
  for (let k = 0; k < (strong ? 6 : 3); k++) {
    const p = (t * 0.7 + k / 6 + seed * 0.1) % 1;
    c.globalAlpha = 1 - p;
    c.fillStyle = '#ffd060';
    c.fillRect(Math.round(x + Math.sin(k * 3.1 + t) * 6 * p), Math.round(y - 8 - p * 26), 1, 1);
  }
  c.globalAlpha = 1;
}

function drawMagicCircle(c, g) {
    const cx = g.fx + g.fw / 2, cy = g.fy + g.fh / 2 + 6;
    ellipse(c, cx, cy, 46, 36, '#5c564f');
    ellipse(c, cx, cy, 44, 34, '#867e74');
    for (let k = 0; k < 90; k++) {
      const a = srand() * Math.PI * 2, d = Math.sqrt(srand());
      ellipse(c, cx + Math.cos(a) * d * 40, cy + Math.sin(a) * d * 30, rnd(2, 4), rnd(1.4, 2.6), shade('#9e958a', rnd(-0.2, 0.15)));
    }
    c.strokeStyle = '#7e58cc'; c.lineWidth = 1.1;
    c.beginPath(); c.ellipse(cx, cy, 27, 20, 0, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.ellipse(cx, cy, 19, 14, 0, 0, Math.PI * 2); c.stroke();
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * Math.PI * 2 - Math.PI / 2, b = (k + 2) / 5 * Math.PI * 2 - Math.PI / 2;
      line(c, cx + Math.cos(a) * 19, cy + Math.sin(a) * 14, cx + Math.cos(b) * 19, cy + Math.sin(b) * 14, '#9c7ae6', 0.9);
    }
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; c.fillStyle = '#bea4f6'; c.fillRect(cx + Math.cos(a) * 23 - 0.6, cy + Math.sin(a) * 17 - 0.6, 1.2, 1.2); }
    const stones = [];
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; stones.push([cx + Math.cos(a) * 38, cy + Math.sin(a) * 28]); }
    stones.sort((a, b) => a[1] - b[1]);
    const monolith = (x, y) => {
      ellipse(g.sc, x + 6, y - 1, 8, 2.4, 'rgba(12,10,6,0.35)');
      poly(c, [[x - 4.5, y], [x - 4, y - 18], [x - 2, y - 22], [x + 2.5, y - 21], [x + 4.5, y - 16], [x + 4.5, y]], '#8e877c', '#3a3632', 0.6);
      poly(c, [[x + 1, y - 21], [x + 2.5, y - 21], [x + 4.5, y - 16], [x + 4.5, y], [x + 1.5, y]], '#5c564f');
      poly(c, [[x - 4, y - 18], [x - 2, y - 22], [x, y - 21], [x - 2, y - 17]], '#b6ada0');
      c.fillStyle = '#9c7ae6';
      c.fillRect(x - 1.5, y - 15, 1, 3); c.fillRect(x - 2.5, y - 13, 3, 1); c.fillRect(x - 1, y - 9, 1, 3);
      if (srand() < 0.5) ellipse(c, x - 2, y - 4, 1.6, 1, 'rgba(90,120,50,0.8)');
    };
    for (const [x, y] of stones.filter(s => s[1] < cy)) monolith(x, y);
    c.fillStyle = lingrad(c, cx - 8, 0, cx + 8, 0, [[0, '#b6ada0'], [1, '#5c564f']]);
    c.fillRect(cx - 8, cy - 6, 16, 8);
    poly(c, [[cx - 8, cy - 6], [cx + 8, cy - 6], [cx + 6, cy - 9], [cx - 6, cy - 9]], '#cec6ba');
    crystal(c, cx, cy - 8, 1.4);
    for (const [x, y] of stones.filter(s => s[1] >= cy)) monolith(x, y);
    const rx = g.fx + g.fw + 2, ry = g.base + 6;
    c.fillStyle = '#583522'; c.fillRect(rx - 12, ry - 9, 18, 1.4); c.fillRect(rx - 12, ry - 2, 18, 1.4);
    c.fillRect(rx - 12, ry - 12, 1.2, 12); c.fillRect(rx + 4.8, ry - 12, 1.2, 12);
    for (let k = 0; k < 3; k++) {
      const jx = rx - 9 + k * 5;
      c.fillStyle = '#a6d2e6'; c.fillRect(jx, ry - 15, 3.4, 5.6);
      c.fillStyle = '#3a74a0'; c.fillRect(jx + 0.4, ry - 13, 2.6, 3.2);
      c.fillStyle = '#875434'; c.fillRect(jx + 0.4, ry - 16, 2.6, 1.2);
    }
    g.spr.circle = [cx, cy - 14];
}

function drawMineBody(c, g, magic) {
  const { fx, fy, fw, fh, base } = g;
  const pts = [[fx - 10, base + 2], [fx - 6, fy + 10], [fx + 10, fy - 18], [fx + fw * 0.45, fy - 30], [fx + fw - 10, fy - 22], [fx + fw + 8, fy + 4], [fx + fw + 10, base + 2]];
  poly(g.sc, pts.map(([x, y]) => [x + 18, y - 6]), 'rgba(12,10,6,0.3)');
  rockMound(c, pts, fx - 12, fy - 32, fw + 24, fh + 36, magic ? '#77706e' : '#7e7468');
  const dx = g.doorCx;
  // штольня с деревянной крепью
  c.fillStyle = '#0a0604';
  c.beginPath(); c.moveTo(dx - 10, base); c.lineTo(dx - 10, base - 16); c.arc(dx, base - 16, 10, Math.PI, 0); c.lineTo(dx + 10, base); c.fill();
  c.fillStyle = radgrad(c, dx, base - 8, 1, 14, [[0, magic ? 'rgba(160,110,255,0.4)' : 'rgba(255,190,90,0.25)'], [1, 'rgba(0,0,0,0)']]);
  c.fillRect(dx - 10, base - 26, 20, 26);
  for (const px of [dx - 13, dx + 9.4]) { c.fillStyle = lingrad(c, px, 0, px + 3.6, 0, [[0, '#9a6a38'], [1, '#4a2c14']]); c.fillRect(px, base - 26, 3.6, 26); }
  c.fillStyle = lingrad(c, 0, base - 30, 0, base - 25, [[0, '#a87848'], [1, '#4a2c14']]); c.fillRect(dx - 15, base - 30, 30, 5);
  line(c, dx - 13, base - 18, dx - 4, base - 26, '#5a3a1e', 1.2); line(c, dx + 13, base - 18, dx + 4, base - 26, '#5a3a1e', 1.2);
  lantern(c, dx + 12, base - 20);
  // копёр с колесом над входом
  const hx = dx + 2, hy = fy - 18;
  line(c, hx - 9, hy + 18, hx, hy - 8, '#5a3a1e', 1.4); line(c, hx + 9, hy + 18, hx, hy - 8, '#5a3a1e', 1.4);
  line(c, hx - 6, hy + 10, hx + 6, hy + 10, '#5a3a1e', 1);
  ellipse(c, hx, hy - 8, 5, 5, '#3a2414'); ellipse(c, hx, hy - 8, 3.8, 3.8, '#7a5030'); ellipse(c, hx, hy - 8, 1, 1, '#2a1a0a');
  for (let a = 0; a < 6; a++) line(c, hx, hy - 8, hx + Math.cos(a) * 3.6, hy - 8 + Math.sin(a) * 3.6, '#3a2414', 0.4);
  line(c, hx + 4, hy - 7, hx + 4, base - 30, '#c8b890', 0.4);
  // рельсы и тележка
  c.strokeStyle = '#4a3a2a'; c.lineWidth = 0.7;
  c.beginPath(); c.moveTo(dx - 4, base); c.lineTo(dx - 6, base + 12); c.moveTo(dx + 4, base); c.lineTo(dx + 6, base + 12); c.stroke();
  for (let k = 0; k < 4; k++) line(c, dx - 5 - k * 0.5, base + 2 + k * 3, dx + 5 + k * 0.5, base + 2 + k * 3, '#5a3a1e', 0.9);
  cart(c, fx - 14, base + 10, magic ? '#9c7ae6' : '#d4b040');
  if (magic) {
    for (const [x, y, s] of [[fx + 6, fy + 4, 1.3], [fx + 18, fy - 12, 1.1], [fx + fw - 8, fy - 4, 1.4], [fx + fw - 20, fy + 10, 1], [fx + 40, fy - 22, 0.9], [fx + fw - 4, base - 10, 1.1]])
      crystal(c, x, y, s);
    for (let k = 0; k < 4; k++) crystal(c, fx - 10 + k * 3.4, base + 1, 0.55, false);
    g.spr.glow = [dx, base - 8];
    g.spr.glowColor = '160,100,255';
  } else {
    // отвал пустой породы
    ellipse(c, fx + fw + 2, base + 6, 12, 5, '#6e665c');
    for (let k = 0; k < 10; k++) ellipse(c, fx + fw + rnd(-8, 10), base + rnd(2, 8), rnd(1, 2.5), rnd(0.8, 1.6), shade('#8e877c', rnd(-0.2, 0.2)));
    wheelbarrow(c, fx + fw - 18, base + 12, '#c9a640');
  }
}

function hashStr(s) { let h = 7; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 2654435761); return h >>> 0; }
