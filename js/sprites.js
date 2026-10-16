'use strict';
// Общие инструменты рисования и природа (деревья, камни, поля).
// Здания — в buildings.js. Свет падает сверху-слева.

const SS = 2;        // сверхвыборка природных спрайтов

const SPR = { buildings: {}, trees: [], fields: {}, boulders: [] };

function mkCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function mkSprite(w, h, s = SS) {
  const cv = mkCanvas(Math.ceil(w * s), Math.ceil(h * s));
  const c = cv.getContext('2d');
  c.scale(s, s);
  c.lineJoin = 'round';
  return [cv, c];
}

function hexToRgb(h) {
  if (h.startsWith('rgb')) return h.match(/\d+/g).slice(0, 3).map(Number);
  h = h.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
}

function shade(hex, f) {
  const [r, g, b] = hexToRgb(hex);
  const k = v => Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))));
  return `rgb(${k(r)},${k(g)},${k(b)})`;
}

function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

let srand = mulberry32(777);
const rnd = (a, b) => a + srand() * (b - a);

function poly(c, pts, fill, stroke, lw = 1) {
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}

function clipPoly(c, pts, fn) {
  c.save();
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath();
  c.clip();
  fn();
  c.restore();
}

function rrect(c, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function ellipse(c, x, y, rx, ry, fill) {
  c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, Math.PI * 2);
  c.fillStyle = fill; c.fill();
}

function line(c, x0, y0, x1, y1, col, w = 1) {
  c.strokeStyle = col; c.lineWidth = w;
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
}

function lingrad(c, x0, y0, x1, y1, stops) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}

function radgrad(c, x, y, r0, r1, stops) {
  const g = c.createRadialGradient(x, y, r0, x, y, r1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}

// Шум «краски» по непрозрачным пикселям.
function grain(cv, amt, seed) {
  const c = cv.getContext('2d');
  const d = c.getImageData(0, 0, cv.width, cv.height);
  const a = d.data, r = mulberry32(seed);
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] === 0) continue;
    const k = 1 + (r() - 0.5) * amt;
    a[i] *= k; a[i + 1] *= k; a[i + 2] *= k;
  }
  c.putImageData(d, 0, 0);
}

// ================= Природа =================

function foliage(c, cx, cy, rx, ry, n, base, light, seed) {
  const r = mulberry32(seed);
  const cl = [];
  for (let k = 0; k < n; k++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r());
    cl.push([cx + Math.cos(a) * d * rx, cy + Math.sin(a) * d * ry, rnd(5, 9) * (rx / 22)]);
  }
  cl.sort((a, b) => a[1] - b[1]);
  for (const [x, y, s] of cl) ellipse(c, x + 1, y + 1.5, s, s * 0.92, shade(base, -0.55));
  for (const [x, y, s] of cl) ellipse(c, x - 0.6, y - 0.8, s * 0.86, s * 0.8, shade(base, -0.12 + (cy - y) / ry * 0.15));
  for (const [x, y, s] of cl) {
    const lit = ((cx - x) / rx + (cy - y) / ry) * 0.5;
    if (lit > -0.2) ellipse(c, x - s * 0.3, y - s * 0.35, s * 0.45, s * 0.38, shade(light, Math.min(0.25, lit * 0.3)));
  }
  for (let k = 0; k < n * 9; k++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r());
    const x = cx + Math.cos(a) * d * rx * 1.05, y = cy + Math.sin(a) * d * ry * 1.05;
    const lit = ((cx - x) / rx + (cy - y) / ry);
    c.fillStyle = lit > 0.3 && r() < 0.7 ? shade(light, 0.3) : shade(base, -0.6);
    c.fillRect(x, y, 1.1, 1.1);
  }
}

function makeTree(kind, seed) {
  srand = mulberry32(seed);
  const [cv, c] = mkSprite(64, 92);
  const cx = 32, base = 88;
  if (kind === 'oak' || kind === 'birch') {
    const birch = kind === 'birch';
    const tw = birch ? 2.2 : 3.6, th = birch ? 44 : 38;
    c.fillStyle = birch
      ? lingrad(c, cx - tw, 0, cx + tw, 0, [[0, '#f4f0e6'], [1, '#a8a294']])
      : lingrad(c, cx - tw, 0, cx + tw, 0, [[0, '#8a6038'], [1, '#3a2210']]);
    c.beginPath();
    c.moveTo(cx - tw - 2, base); c.quadraticCurveTo(cx - tw, base - 4, cx - tw * 0.7, base - th);
    c.lineTo(cx + tw * 0.7, base - th); c.quadraticCurveTo(cx + tw, base - 4, cx + tw + 2, base);
    c.closePath(); c.fill();
    if (birch) {
      c.fillStyle = '#2a2622';
      for (let k = 0; k < 9; k++) c.fillRect(cx - tw + srand() * tw, base - 4 - srand() * (th - 6), rnd(1, 2.4), 0.8);
    } else {
      c.strokeStyle = 'rgba(30,15,5,0.5)'; c.lineWidth = 0.5;
      for (let k = 0; k < 6; k++) { const x = cx - tw + 1 + srand() * tw * 1.6; c.beginPath(); c.moveTo(x, base - 2); c.lineTo(x + rnd(-1, 1), base - th + 4); c.stroke(); }
    }
    c.strokeStyle = birch ? '#d8d2c4' : '#5a3a1e'; c.lineWidth = birch ? 1 : 1.8;
    c.beginPath();
    c.moveTo(cx, base - th + 6); c.lineTo(cx - 9, base - th - 6);
    c.moveTo(cx + 1, base - th + 10); c.lineTo(cx + 10, base - th - 2);
    c.stroke();
    if (birch) foliage(c, cx, 34, 16, 24, 22, '#5e8e30', '#b8d860', seed);
    else foliage(c, cx, 36, 25, 22, 30, '#3e6a26', '#8ab848', seed);
  } else {
    const fir = kind === 'fir';
    c.fillStyle = lingrad(c, cx - 2.5, 0, cx + 2.5, 0, [[0, '#6a4424'], [1, '#2e1a0a']]);
    c.fillRect(cx - 2.2, base - 18, 4.4, 18);
    const tiers = fir ? 6 : 5;
    const col = fir ? '#24452c' : '#2c5030';
    for (let k = 0; k < tiers; k++) {
      const y = base - 12 - k * (fir ? 11 : 12.5);
      const w = (fir ? 22 : 24) * (1 - k / (tiers + 1.2));
      const top = y - (fir ? 18 : 20);
      c.beginPath();
      c.moveTo(cx, top);
      c.quadraticCurveTo(cx + w * 0.4, y - 8, cx + w, y);
      for (let t = 1; t <= 6; t++) {
        const x = cx + w - t * (2 * w / 6);
        c.quadraticCurveTo(x + w / 6, y + 3.5, x, y + (t % 2 ? 1 : 0));
      }
      c.quadraticCurveTo(cx - w * 0.4, y - 8, cx, top);
      c.closePath();
      c.fillStyle = lingrad(c, cx - w, top, cx + w, y, [[0, shade(col, 0.35)], [0.45, col], [1, shade(col, -0.5)]]);
      c.fill();
      c.strokeStyle = 'rgba(10,25,12,0.6)'; c.lineWidth = 0.6; c.stroke();
      c.strokeStyle = shade(col, 0.45); c.lineWidth = 0.5;
      for (let t = 0; t < w * 1.2; t++) {
        const x = cx - w * 0.8 + srand() * w * 1.1, yy = top + 6 + srand() * (y - top - 4);
        if (Math.abs(x - cx) > (yy - top) / (y - top) * w) continue;
        c.beginPath(); c.moveTo(x, yy); c.lineTo(x - 1.5, yy + 2); c.stroke();
      }
    }
  }
  grain(cv, 0.1, seed);
  return toPixelArt(cv, SS, { outline: true, alphaCut: 100 });
}

function makeTrees() {
  SPR.trees = [
    makeTree('oak', 11), makeTree('oak', 23), makeTree('oak', 37),
    makeTree('birch', 41), makeTree('pine', 53), makeTree('fir', 67), makeTree('pine', 71),
  ];
}

function makeBoulders() {
  SPR.boulders = [];
  for (let k = 0; k < 4; k++) {
    srand = mulberry32(55 + k * 17);
    const [cv, c] = mkSprite(26, 20);
    const pts = [];
    const n = 9;
    for (let a = 0; a < n; a++) {
      const ang = a / n * Math.PI * 2, r = rnd(0.72, 1);
      pts.push([13 + Math.cos(ang) * 11 * r, 11 + Math.sin(ang) * 7.5 * r]);
    }
    poly(c, pts, lingrad(c, 3, 3, 23, 18, [[0, '#c4c0b6'], [0.5, '#8e8a82'], [1, '#4e4a44']]), 'rgba(30,26,22,0.8)', 0.8);
    poly(c, [pts[5], pts[6], pts[7], [12, 9]], 'rgba(255,252,240,0.22)');
    poly(c, [pts[0], pts[1], pts[2], [13, 12]], 'rgba(0,0,0,0.18)');
    c.strokeStyle = 'rgba(40,36,30,0.6)'; c.lineWidth = 0.6;
    c.beginPath(); c.moveTo(rnd(8, 12), rnd(6, 9)); c.lineTo(rnd(12, 16), rnd(11, 14)); c.lineTo(rnd(15, 19), rnd(14, 16)); c.stroke();
    if (k % 2) for (let m = 0; m < 5; m++) ellipse(c, rnd(7, 18), rnd(5, 9), rnd(1, 2), 0.8, 'rgba(90,120,50,0.6)');
    grain(cv, 0.15, k);
    SPR.boulders.push(toPixelArt(cv, SS, { outline: true }));
  }
}

// Поля: 0 — пашня, 1 — всходы, 2 — зелёные, 3 — спелые.
function makeField(crop, stage) {
  srand = mulberry32(31 + stage + (crop === 'hay' ? 100 : crop === 'hops' ? 200 : 0));
  const [cv, c] = mkSprite(TILE, TILE);
  c.fillStyle = '#6a4828'; c.fillRect(0, 0, TILE, TILE);
  for (let y = 1.5; y < TILE; y += 4) {
    c.fillStyle = '#4a2e16'; c.fillRect(0, y, TILE, 1.4);
    c.fillStyle = '#8a6440'; c.fillRect(0, y + 1.6, TILE, 1.1);
  }
  for (let k = 0; k < 40; k++) ellipse(c, srand() * TILE, srand() * TILE, 0.7, 0.5, srand() < 0.5 ? '#9a7450' : '#3e2812');
  if (crop === 'wheat') {
    if (stage === 1) {
      c.strokeStyle = '#7ab040'; c.lineWidth = 0.6;
      for (let y = 4.5; y < TILE; y += 4) for (let x = 1; x < TILE; x += 2.4) {
        c.beginPath(); c.moveTo(x, y); c.lineTo(x - 0.8, y - 2); c.moveTo(x, y); c.lineTo(x + 0.8, y - 2.2); c.stroke();
      }
    } else if (stage >= 2) {
      const ripe = stage === 3;
      for (let y = 5; y < TILE + 4; y += 4) {
        ellipse(c, TILE / 2, y + 0.5, TILE / 2, 1, 'rgba(0,0,0,0.25)');
        for (let x = 0.5; x < TILE; x += 1.2) {
          const h = ripe ? rnd(6, 8) : rnd(4, 6.5), lean = rnd(-0.8, 0.8);
          c.strokeStyle = ripe ? shade('#d8b040', rnd(-0.25, 0.15)) : shade('#5e9a34', rnd(-0.25, 0.2));
          c.lineWidth = 0.6;
          c.beginPath(); c.moveTo(x, y); c.lineTo(x + lean, y - h); c.stroke();
          if (ripe && srand() < 0.7) ellipse(c, x + lean, y - h - 0.6, 0.6, 1.3, shade('#f0d060', rnd(-0.1, 0.2)));
        }
      }
    }
  } else if (crop === 'hops') {
    // хмель: ряды шестов, по которым вьются лозы; спелый — с бледно-зелёными шишками
    const poles = [[6, 30], [16, 30], [26, 30], [6, 16], [16, 16], [26, 16]];
    for (const [x, y] of poles) {
      const h = stage === 0 ? 3 : stage === 1 ? 7 : 13;
      c.strokeStyle = '#5a3a1e'; c.lineWidth = 0.9;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + 0.4, y - h); c.stroke();
      if (stage >= 1) {
        c.strokeStyle = '#4a7a2a'; c.lineWidth = 0.9;
        c.beginPath(); c.moveTo(x, y);
        for (let t = 0; t <= h; t += 1.5) c.lineTo(x + Math.sin(t * 1.3) * 1.6, y - t);
        c.stroke();
        for (let t = 2; t < h; t += 2.2) ellipse(c, x + Math.sin(t * 1.3) * 2.4, y - t, 1.4, 1, shade('#5a9a34', rnd(-0.2, 0.15)));
        if (stage === 3) for (let t = 4; t < h; t += 2.6) { ellipse(c, x + Math.sin(t * 1.7 + 1) * 2.6, y - t, 0.9, 1.2, '#c8e080'); ellipse(c, x + Math.sin(t * 1.7 + 1) * 2.6 - 0.3, y - t - 0.4, 0.4, 0.5, '#eaf4b0'); }
      }
    }
  } else {
    // травы на сено: густой травостой, при созревании — скошенные валки и копны
    if (stage === 1) {
      for (let k = 0; k < 120; k++) {
        const x = srand() * TILE, y = srand() * TILE;
        c.strokeStyle = shade('#6aa040', rnd(-0.2, 0.2)); c.lineWidth = 0.6;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + rnd(-1, 1), y - rnd(1.5, 3)); c.stroke();
      }
    } else if (stage === 2) {
      c.fillStyle = '#4e7a2c'; c.fillRect(0, 0, TILE, TILE);
      for (let k = 0; k < 380; k++) {
        const x = srand() * TILE, y = srand() * (TILE + 4);
        c.strokeStyle = shade('#6a9a3a', rnd(-0.3, 0.3)); c.lineWidth = 0.6;
        c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + rnd(-1, 1), y - 3, x + rnd(-2, 2), y - rnd(4, 7)); c.stroke();
        if (srand() < 0.04) ellipse(c, x, y - 6, 0.8, 0.8, ['#f0e070', '#e8e8f0', '#c070c0'][(srand() * 3) | 0]);
      }
    } else if (stage === 3) {
      c.fillStyle = '#7a8a3c'; c.fillRect(0, 0, TILE, TILE);
      for (let k = 0; k < 160; k++) {
        c.fillStyle = shade('#a8a050', rnd(-0.25, 0.15));
        c.fillRect(srand() * TILE, srand() * TILE, rnd(1, 3), 0.6);
      }
      for (const [x, y] of [[9, 12], [23, 22]]) {
        ellipse(c, x + 2, y + 2, 7, 2.5, 'rgba(0,0,0,0.3)');
        c.fillStyle = lingrad(c, x - 6, y - 9, x + 6, y, [[0, '#e4d888'], [1, '#8a8a3a']]);
        c.beginPath(); c.moveTo(x - 6.5, y + 1); c.quadraticCurveTo(x - 6, y - 8, x, y - 9.5); c.quadraticCurveTo(x + 6, y - 8, x + 6.5, y + 1); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(90,90,30,0.6)'; c.lineWidth = 0.5;
        for (let t = -5; t <= 5; t += 1.4) { c.beginPath(); c.moveTo(x + t, y); c.lineTo(x + t * 0.5, y - 8 + Math.abs(t) * 0.6); c.stroke(); }
      }
    }
  }
  c.strokeStyle = 'rgba(40,24,10,0.45)'; c.lineWidth = 0.8;
  c.strokeRect(0.4, 0.4, TILE - 0.8, TILE - 0.8);
  grain(cv, 0.12, stage);
  return toPixelArt(cv, SS, { outline: false });
}

function makeFields() {
  for (const crop of FARM_CROPS) {
    SPR.fields[crop] = [];
    for (let stage = 0; stage < 4; stage++) SPR.fields[crop].push(makeField(crop, stage));
  }
}

function initSprites() {
  makeTrees();
  makeBoulders();
  makeFields();
  for (const t of BUILD_ORDER) buildingSprite(t);
}
