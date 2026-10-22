'use strict';
// Дикие гномы — спрайты. Рисуются тем же drawPerson, что и наши гномы (те же пропорции, уши, нос, борода, шаг в 8 кадров,
// бой, жесты, пиксель-арт с обводкой), но в другой манере: землистая палитра, вместо мшистого колпака — повязки, рога, перья,
// рога лося, чалма, капюшон, меховая шапка; вместо окладистой бороды — косы, дреды, сухие пряди; боевая раскраска,
// меховой воротник, ремень с амулетом, заплатки, дубина, топорик, копьё, костяной нож.
// Внешность — ключ-строка (например 'folk:copper:2', 'brigand', 'chief:grey!'): в сейвах и кооп-пакетах ничего нового.
// Читает: people.js (drawPerson, drawBeard, drawCap, drawWeapon, drawSheath, SKINS, OUTFIT, WPN_STYLE), sprites.js, pixel.js.

// ---------- Кожа ----------
// 3 загорелая, 4 бурая обветренная, 5 пепельная (сизые кланы), 6 с зеленцой (мхиные)
const WILD_SKIN0 = SKINS.length;
SKINS.push(['#dcae80', '#b8845a', '#80563a'], ['#c4946a', '#9c6844', '#6a4228'], ['#cdb894', '#a69070', '#706048'], ['#c8c090', '#a09a6a', '#6a6644']);

// ---------- Описания ----------
// bs — форма бороды из people.js (0 круглая, 1 раздвоенная, 2 клином, 3 лопатой, 4 козлиная), bstyle — что поверх неё:
// braids (две косы с бусинами), dreads (дреды), dry (сухие рваные пряди), plait (одна толстая коса), tuft (стянута кольцом)
const WILD_FAC = {
  copper: { skin: 3, bcol: '#c8582a', bs: 3, bstyle: 'braids', coat: '#7a4a2a', pants: '#4a3226', head: 'helm', capc: '#b8642a', acc: '#d8742a', acc2: '#ffd070', paint: 'stripe', pcol: '#b8301e', patch: '#a8642a', strap: '#4a2c14', wpn: 'whatchet||1', hair: '#6a2a14', prop: 'ore' },
  moss:   { skin: 6, bcol: '#98a070', bs: 1, bstyle: 'dry', coat: '#4a4a2a', pants: '#3e3822', head: 'antler', capc: '#566a38', acc: '#7a9a48', acc2: '#d8e8a0', paint: 'dots', pcol: '#e8f0d0', mantle: '#566a38', patch: '#8a6a34', strap: '#3a2a14', wpn: 'wspear||1', hair: '#4a4a22' },
  grey:   { skin: 5, bcol: '#c8ccd4', bs: 2, bstyle: 'plait', coat: '#4a5a6a', pants: '#3a3e46', head: 'fur', capc: '#8a929c', acc: '#e8ecf0', acc2: '#ffffff', paint: 'scar', pcol: '#f0d0c0', mantle: '#9aa2ac', patch: '#6a7a8c', strap: '#2e2e36', wpn: 'whatchet|wshield|1', hair: '#6a707a' },
  sand:   { skin: 3, bcol: '#e8d8a8', bs: 0, bstyle: 'braids', coat: '#a8803a', pants: '#6a4a28', head: 'turban', capc: '#d89a20', acc: '#a83a1a', acc2: '#f0c030', paint: 'tear', pcol: '#e8b020', patch: '#d8b050', strap: '#7a3a12', wpn: 'wbone||1', hair: '#7a5a2a', prop: 'scales' },
};
const WILD_FOLK_HEAD = { copper: ['helm', 'wrap', 'helm'], moss: ['antler', 'hood', 'feather'], grey: ['fur', 'hood', 'fur'], sand: ['turban', 'wrap', 'turban'] };
const WILD_FOLK_BEARD = ['', 'dreads', 'dry'];

const WILD_KIND = {
  pilgrim:   { skin: 3, bcol: '#ece6dc', bs: 3, bstyle: 'dry', coat: '#9a8a68', pants: '#5a4a34', head: 'hood', capc: '#b8a880', acc: '#8a6a3a', acc2: '#d8c070', strap: '#6a4a2a', amulet: 'gourd', wpn: 'wstick||1', hair: '#9a9a90', bl: 2 },
  herbalist: { skin: 3, bcol: '#c87a3a', bs: 0, bstyle: '', coat: '#5a7a3a', pants: '#4a4428', head: 'wrap', capc: '#6aa84a', acc: '#6aa84a', acc2: '#e86a8a', strap: '#5a3a1e', prop: 'basket', fem: true, hair: '#c87a3a', hs: 0 },
  courier:   { skin: 3, bcol: '#8a5a2a', bs: 4, bstyle: 'tuft', coat: '#4a6a8a', pants: '#3a3a4a', head: 'feather', capc: '#c8a030', acc: '#c8a030', acc2: '#e8d070', strap: '#3a2a14', prop: 'sack', hair: '#5a3a1a' },
  wanderer:  { skin: 4, bcol: '#9a9a90', bs: 1, bstyle: 'dry', coat: '#7a6a5a', pants: '#4a4034', head: 'patchcap', capc: '#6a5a46', capStyle: 3, acc: '#a87a3a', acc2: '#c8a060', strap: '#4a3a24', prop: 'bundle', wpn: 'wstick||1', hair: '#6a6a60' },
  seeker:    { skin: 3, bcol: '#d8c8b0', bs: 2, bstyle: 'dreads', coat: '#6e4a70', pants: '#3a3040', head: 'wrap', capc: '#7a4aa0', acc: '#7a4aa0', acc2: '#bfe8ff', paint: 'band', pcol: '#2a1c30', strap: '#3a2a3a', prop: 'pick', hair: '#4a3a50' },
  thief:     { skin: 5, bcol: '#3a2a20', bs: 4, bstyle: 'tuft', coat: '#2a2a34', pants: '#1c1c24', head: 'hood', capc: '#1e1e28', acc: '#5a1a1a', acc2: '#8a2a2a', paint: 'band', pcol: '#0e0e14', strap: '#5a1a1a', wpn: 'wbone|', hair: '#1e1e28', evil: 1 },
  brigand:   { skin: 4, bcol: '#2a1a10', bs: 3, bstyle: 'dreads', coat: '#6a2a22', pants: '#3a2418', head: 'horns', capc: '#4a3828', acc: '#c8b890', acc2: '#e8dcc0', paint: 'stripe', pcol: '#e8dcc0', mantle: '#3a2a22', strap: '#2a1a10', wpn: 'wclub||1', hair: '#2a1a10', evil: 1, spikes: 1, bl: 2 },
};

// собирает описание по ключу: 'pilgrim' | 'folk:<фракция>:<n>' | 'wt:<фракция>' (купец) | 'chief:<фракция>'; '!' на конце — злое поселение
let WILD_STYLE = (typeof window !== 'undefined' && window.WILD_STYLE) || 'A';   // 'B' — запасной вариант оформления (лист-сравнение)
const WILD_DESC = {};
function wildDesc(key) {
  let D = WILD_DESC[key];
  if (D) return D;
  let k = key, evil = false;
  if (k.endsWith('!')) { evil = true; k = k.slice(0, -1); }
  const [t, fac, n] = k.split(':');
  if (WILD_KIND[t]) D = { ...WILD_KIND[t] };
  else {
    const F = WILD_FAC[fac] || WILD_FAC.copper, v = (+n || 0) % 3;
    D = { ...F };
    if (t === 'folk') {
      D.head = WILD_FOLK_HEAD[fac][v];
      if (WILD_FOLK_BEARD[v]) D.bstyle = WILD_FOLK_BEARD[v];
      if (v === 1) D.wpn = 'wstick||1'; else if (v === 2) { D.wpn = ''; D.paint = ''; }
      if (v === 2) D.bcol = shade(F.bcol, -0.18);
    } else if (t === 'wt') { D.wpn = ''; D.prop = 'pack'; D.paint = ''; D.mantle = ''; }
    else if (t === 'chief') { D.chief = 1; D.mantle = F.mantle || shade(F.capc, -0.1); D.scale = 1.12; }
  }
  if (evil) {
    D.evil = 1; D.skin = 4; D.paint = 'stripe'; D.pcol = '#d8281a'; D.coat = shade(D.coat, -0.5); D.pants = shade(D.pants, -0.45);
    D.bcol = shade(D.bcol, -0.55); D.hair = '#1e1418'; D.spikes = 1; D.moss = false; D.acc = '#8a1a1a'; D.mantle = D.mantle || '#2a1c20';
    if (D.head !== 'hood') D.head = 'bone';
  }
  if (WILD_STYLE === 'B' && !evil && D.head !== 'hood') {   // вариант Б: наш конусный колпак, но тусклый, с заплаткой и пером; без рогов и воротников
    D.head = 'patchcap'; D.capStyle = { copper: 1, moss: 2, grey: 3, sand: 5 }[fac] != null ? { copper: 1, moss: 2, grey: 3, sand: 5 }[fac] : D.capStyle; D.paint = D.paint === 'band' ? 'band' : ''; if (!D.chief) D.mantle = '';
  }
  if (t === 'brigand') D.scale = 1.1;
  D.id = key;
  return (WILD_DESC[key] = D);
}

// ---------- Мелкие помощники ----------
const wDark = '#1e160e';
function wTri(c, a, b, d, col) { poly(c, [a, b, d], col); }
function wFeather(c, x, y, ang, col, col2) {
  c.save(); c.translate(x, y); c.rotate(ang);
  c.fillStyle = col; c.beginPath(); c.ellipse(0, -3.2, 1.05, 3.5, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = col2; c.beginPath(); c.ellipse(0, -4.6, 0.9, 1.3, 0, 0, Math.PI * 2); c.fill();
  line(c, 0, 0.4, 0, -6.4, shade(col, -0.4), 0.28);
  c.restore();
}
function wBand(c, x, y, w, h, col, dots) {
  rrect(c, x, y, w, h, Math.min(0.8, h / 2)); c.fillStyle = lingrad(c, 0, y, 0, y + h, [[0, shade(col, 0.2)], [1, shade(col, -0.35)]]); c.fill();
  if (dots) { c.fillStyle = dots; for (let k = 0; k < 4; k++) c.fillRect(x + 1.2 + k * (w - 2.4) / 3.2, y + h * 0.38, 0.55, 0.55); }
}
function wHairDome(c, hx, b, W, view) {
  // всклокоченные волосы поверх лба — вместо мшистого колпака
  const col = W.hair || '#4a3020';
  c.fillStyle = lingrad(c, hx - 4.5, 0, hx + 4.5, 0, [[0, shade(col, 0.18)], [0.55, col], [1, shade(col, -0.35)]]);
  c.beginPath(); c.ellipse(hx, b - 0.5, 4.6, 3.4, 0, Math.PI, 0); c.fill();
  if (view === 'N') ellipse(c, hx, b + 1.2, 4.2, 3.4, col);
  for (let k = -3; k <= 3; k++) poly(c, [[hx + k * 1.3 - 0.7, b - 2.4], [hx + k * 1.3 + 0.2 + (k % 2) * 0.5, b - 4.5 - ((k + 4) % 3) * 0.55], [hx + k * 1.3 + 0.8, b - 2.4]], col);
}
// след боевой раскраски на лице
function wPaint(c, view, hx, hy, W) {
  if (!W.paint) return;
  const col = W.pcol || '#b8301e', e = view === 'E';
  c.lineCap = 'round';
  if (W.paint === 'stripe') {
    if (e) { line(c, hx + 1.0, hy - 0.1, hx + 2.7, hy + 2.5, col, 0.65); line(c, hx + 2.0, hy - 0.1, hx + 3.5, hy + 2.1, col, 0.55); }
    else for (const sd of [-1, 1]) { line(c, hx + sd * 3.3, hy + 0.1, hx + sd * 1.7, hy + 2.5, col, 0.65); line(c, hx + sd * 2.4, hy - 0.1, hx + sd * 1.0, hy + 1.9, col, 0.5); }
  } else if (W.paint === 'band') {
    c.fillStyle = col;
    if (e) c.fillRect(hx + 0.2, hy + 0.15, 4.2, 1.35); else c.fillRect(hx - 3.6, hy + 0.15, 7.2, 1.35);
  } else if (W.paint === 'dots' || W.paint === 'tear') {
    c.fillStyle = col;
    const pts = e ? [[1.9, 1.5], [2.7, 2.5], [1.3, 2.6]] : [[-2.6, 1.5], [-3.2, 2.5], [-2, 2.7], [2.6, 1.5], [3.2, 2.5], [2, 2.7]];
    if (W.paint === 'tear') { for (const [dx, dy] of e ? [[2.2, 1.7]] : [[-2.4, 1.7], [2.4, 1.7]]) { c.fillRect(hx + dx - 0.3, hy + dy, 0.6, 1.5); c.fillRect(hx + dx - 0.3, hy + dy + 1.6, 0.6, 0.6); } }
    else for (const [dx, dy] of pts) c.fillRect(hx + dx - 0.3, hy + dy - 0.3, 0.65, 0.65);
  } else if (W.paint === 'scar') {
    if (e) line(c, hx + 0.9, hy - 0.5, hx + 2.8, hy + 2.5, col, 0.4);
    else { line(c, hx - 3.1, hy - 0.9, hx - 1.3, hy + 2.5, col, 0.4); line(c, hx - 3.3, hy + 0.5, hx - 2.2, hy + 0.1, col, 0.3); line(c, hx - 2.6, hy + 1.6, hx - 1.5, hy + 1.1, col, 0.3); }
  }
  c.lineCap = 'butt';
}
function wEvilEyes(c, view, hx, hy) {
  if (view === 'N') return;
  const g = 'rgba(255,60,40,0.9)';
  if (view === 'E') { ellipse(c, hx + 2.4, hy + 0.9, 0.55, 0.4, g); return; }
  ellipse(c, hx - 1.6, hy + 0.9, 0.55, 0.4, g); ellipse(c, hx + 1.6, hy + 0.9, 0.55, 0.4, g);
}

// ---------- Голова ----------
const _drawCap = drawCap, _drawBeard = drawBeard;
drawCap = function (c, O, view, hx, hy, tipSway, L, r, lvl) {
  if (!L.wild) return _drawCap(c, O, view, hx, hy, tipSway, L, r, lvl);
  wildHead(c, view, hx, hy, tipSway, L, r);
};
drawBeard = function (c, view, hx, hy, L, type, bottom, r) {
  if (!L.wild) return _drawBeard(c, view, hx, hy, L, type, bottom, r);
  const W = L.wild, bc = _drawBeard(c, view, hx, hy, { ...L, braid: false }, type, bottom, r), e = view === 'E';
  const dark = shade(bc, -0.25), mid = shade(bc, -0.1), lite = shade(bc, 0.12), acc = W.acc2 || '#c8a050';
  switch (W.bstyle) {
    case 'braids': {
      const xs = e ? [hx + 2.4] : [hx - 2.3, hx + 2.3];
      for (const x of xs) {
        for (let k = 0; k < 4; k++) ellipse(c, x + (k % 2 ? 0.25 : -0.1), bottom - 0.7 + k * 1.05, 0.95, 0.72, k % 2 ? mid : lite);
        c.fillStyle = acc; c.fillRect(x - 0.9, bottom + 0.9, 1.8, 0.45); ellipse(c, x, bottom + 3.9, 0.75, 0.75, acc);
      }
      break;
    }
    case 'dreads': {
      const xs = e ? [hx + 1.2, hx + 2.6, hx + 4] : [-3.2, -1.6, 0, 1.6, 3.2].map(k => hx + k);
      xs.forEach((x, i) => {
        const len = 2.8 + (i % 2) * 1.4;
        line(c, x, bottom - 1.6, x + (i - 2) * 0.12, bottom + len, i % 2 ? dark : mid, 1.0);
        line(c, x - 0.2, bottom - 1.2, x - 0.2 + (i - 2) * 0.1, bottom + len - 0.6, shade(bc, 0.1), 0.25);
        c.fillStyle = acc; c.fillRect(x - 0.55, bottom + 0.7 + (i % 2) * 0.5, 1.1, 0.4);
      });
      break;
    }
    case 'dry': {
      c.fillStyle = dark;
      for (let k = -3; k <= 3; k++) {
        const x = e ? hx + 1.4 + (k + 3) * 0.55 : hx + k * 1.1, l = 1.2 + ((k * 7 + 21) & 1) * 1.1 + (k & 2) * 0.3;
        poly(c, [[x - 0.55, bottom - 0.6], [x + 0.55, bottom - 0.6], [x + 0.1 * (k % 2 ? 1 : -1), bottom + l]], k % 2 ? dark : mid);
      }
      for (const [dx, dy] of [[-1.8, -2.4], [1.2, -1.2], [0.2, -3.4], [-0.6, -0.6]]) { c.fillStyle = 'rgba(40,30,20,0.55)'; c.fillRect(hx + (e ? 2.6 : 0) + dx, bottom + dy, 0.5, 0.5); }   // клочья и пепел
      break;
    }
    case 'plait': {
      const x = e ? hx + 2.6 : hx;
      for (let k = 0; k < 5; k++) ellipse(c, x + (k % 2 ? 0.2 : -0.15), bottom - 0.6 + k * 1.0, 1.05, 0.75, k % 2 ? mid : lite);
      c.fillStyle = acc; c.fillRect(x - 1.1, bottom + 1.3, 2.2, 0.5); c.fillRect(x - 1.1, bottom + 3, 2.2, 0.5);
      poly(c, [[x - 0.8, bottom + 4.6], [x + 0.8, bottom + 4.6], [x, bottom + 6.2]], dark);
      break;
    }
    case 'tuft': {
      const x = e ? hx + 2.8 : hx;
      c.fillStyle = acc; c.fillRect(x - 1.2, bottom - 1.4, 2.4, 0.5);
      poly(c, [[x - 0.9, bottom - 0.5], [x + 0.9, bottom - 0.5], [x, bottom + 1.8]], dark);
      break;
    }
  }
  return bc;
};

function wildHead(c, view, hx, hy, tipSway, L, r) {
  const W = L.wild, e = view === 'E', n = view === 'N', b = hy - 1.1, sw = tipSway || 0;
  const col = W.capc || '#6a5a46', acc = W.acc || '#c8a030', acc2 = W.acc2 || '#e8d070', bone = '#e8dcc0', boneD = '#a89c80';
  if (!n) wPaint(c, view, hx, hy, W);
  if (W.evil && !n) wEvilEyes(c, view, hx, hy);
  switch (W.head) {
    case 'wrap': case 'feather': case 'horns': case 'bone': {
      if (W.head === 'horns' || W.head === 'bone') {
        // кожаный шлем-колпачок
        c.save();
        c.beginPath(); c.ellipse(hx, b - 0.2, 4.9, 3.7, 0, Math.PI, 0); c.closePath();
        c.fillStyle = lingrad(c, hx - 4.5, 0, hx + 4.5, 0, [[0, shade(col, 0.22)], [0.5, col], [1, shade(col, -0.4)]]); c.fill();
        c.clip(); c.strokeStyle = shade(col, -0.35); c.lineWidth = 0.3;
        for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(hx + k * 1.7, b); c.lineTo(hx + k * 0.9, b - 4); c.stroke(); }
        c.restore();
        wBand(c, hx - 5, b - 1.3, 10, 2.1, W.head === 'bone' ? '#5a4a40' : acc, acc2);
      } else {
        wHairDome(c, hx, b, W, view);
        wBand(c, hx - 4.8, b - 1.5, 9.6, 2.1, acc, acc2);
      }
      // хвосты повязки / узел
      if (W.head === 'wrap' || W.head === 'feather') {
        const tl = 3.6 + sw * 0.5;
        if (e) { poly(c, [[hx - 4.6, b - 0.6], [hx - 8 + sw * 0.4, b + tl - 0.6], [hx - 6.2, b + tl + 1], [hx - 4.2, b + 1]], shade(acc, -0.1)); }
        else if (n) { ellipse(c, hx, b - 0.2, 1.3, 1.1, acc); poly(c, [[hx - 1.2, b], [hx - 2.6 + sw * 0.3, b + tl], [hx - 0.4, b + tl - 0.6]], shade(acc, -0.1)); poly(c, [[hx + 1.2, b], [hx + 2.6 + sw * 0.3, b + tl], [hx + 0.4, b + tl - 0.6]], shade(acc, -0.25)); }
        else { ellipse(c, hx + 4.4, b - 0.2, 1.2, 1.1, acc); poly(c, [[hx + 4, b], [hx + 5.4 + sw * 0.3, b + tl], [hx + 3.6, b + tl - 0.8]], shade(acc, -0.1)); }
      }
      if (W.head === 'feather') {
        const dx = e ? -1 : 1;
        wFeather(c, hx + 3.2 * dx, b - 1.2, 0.35 * dx, '#e4d6b4', acc); wFeather(c, hx + 2.2 * dx, b - 1.6, 0.05, '#c8603a', '#7a2a14'); wFeather(c, hx + 1.2 * dx, b - 1.8, -0.3 * dx, '#6aa04a', '#2e5a22');
      }
      if (W.head === 'horns' || W.head === 'bone') {
        if (W.head === 'horns') {
          if (e) wTri(c, [hx - 1.6, b - 2], [hx + 1.4, b - 8.2], [hx + 0.6, b - 1.6], bone);
          else for (const sd of [-1, 1]) {
            poly(c, [[hx + sd * 3.6, b - 1.2], [hx + sd * 7.4, b - 2.4], [hx + sd * 6.6, b - 7.4], [hx + sd * 5.4, b - 3.2], [hx + sd * 3.2, b - 3]], bone, boneD, 0.3);
            wTri(c, [hx + sd * 6.6, b - 7.4], [hx + sd * 6.9, b - 5.6], [hx + sd * 5.8, b - 6], shade(bone, -0.15));
          }
        } else {
          // костяной венец: зубцы
          for (let k = -2; k <= 2; k++) wTri(c, [hx + k * 1.8 - 0.8, b - 2.2], [hx + k * 1.8 + 0.1 * (k > 0 ? 1 : -1), b - 5.2 - (2 - Math.abs(k)) * 1.0], [hx + k * 1.8 + 0.8, b - 2.2], k % 2 ? bone : shade(bone, -0.12));
        }
      }
      break;
    }
    case 'helm': {
      // медный шлем-колпак с гребнем и красным хвостом
      c.save();
      c.beginPath(); c.ellipse(hx, b - 0.3, 4.9, 4.2, 0, Math.PI, 0); c.closePath();
      c.fillStyle = lingrad(c, hx - 4.5, 0, hx + 4.5, 0, [[0, shade(col, 0.35)], [0.45, col], [1, shade(col, -0.45)]]); c.fill();
      c.clip(); c.strokeStyle = shade(col, -0.4); c.lineWidth = 0.35;
      c.beginPath(); c.moveTo(hx, b - 4.6); c.lineTo(hx, b); c.stroke();
      c.strokeStyle = shade(col, 0.4); c.lineWidth = 0.3; c.beginPath(); c.moveTo(hx - 2.6, b - 3); c.quadraticCurveTo(hx - 3.6, b - 1.4, hx - 3.8, b - 0.4); c.stroke();
      c.restore();
      wBand(c, hx - 5, b - 1.3, 10, 2.1, '#6a3a1a', acc2);
      if (!n) for (const dx of e ? [1.6, 3.6] : [-2.8, 2.8]) { c.fillStyle = '#e8c070'; c.fillRect(hx + dx - 0.25, b - 0.6, 0.5, 0.5); }
      const dir = e ? -1 : 0;
      poly(c, [[hx - 0.9 + dir * 0.4, b - 4.2], [hx + 0.9 + dir * 0.4, b - 4.2], [hx + dir * 1.4 + 0.2, b - 6.2]], '#c8c0b0');
      poly(c, [[hx + dir * 0.4 - 0.3, b - 4.6], [hx + dir * 3.2 - 0.6 + (sw * 0.5), b - 4.2], [hx + dir * 4.6 + sw * 0.6, b - 1.2], [hx + dir * 2.2, b - 3.2]], '#c8302a');
      break;
    }
    case 'antler': {
      wHairDome(c, hx, b, W, view);
      // венок из листьев и рога лося
      const dxs = e ? [-3, -1, 1.2, 3] : [-3.6, -1.8, 0, 1.8, 3.6];
      dxs.forEach((x, i) => { c.save(); c.translate(hx + x, b - 0.4 - (i % 2) * 0.4); c.rotate((i - 2) * 0.3); ellipse(c, 0, 0, 1.5, 0.75, i % 2 ? '#4e8a2a' : '#7aa83a'); c.restore(); });
      ellipse(c, hx + (e ? 1.6 : -2.6), b - 0.7, 0.7, 0.7, '#e8c0d0'); ellipse(c, hx + (e ? -2 : 2.4), b - 0.5, 0.6, 0.6, '#f0e8a0');
      const tw = '#6a4a2a';
      const antler = (sd, base) => {
        const x0 = hx + sd * base;
        c.lineCap = 'round';
        line(c, x0, b - 1.4, x0 + sd * 1.6, b - 5.4, tw, 0.75); line(c, x0 + sd * 1.6, b - 5.4, x0 + sd * 1, b - 8.2, tw, 0.6);
        line(c, x0 + sd * 1.1, b - 3.6, x0 + sd * 3.4, b - 5, tw, 0.55); line(c, x0 + sd * 1.5, b - 5, x0 + sd * 3.6, b - 7.2, tw, 0.5);
        c.lineCap = 'butt';
      };
      if (e) antler(1, 0.2); else { antler(-1, 2.6); antler(1, 2.6); }
      break;
    }
    case 'turban': {
      c.save();
      c.beginPath(); c.ellipse(hx, b - 1.7, 5.3, 4.1, 0, 0, Math.PI * 2);
      c.fillStyle = lingrad(c, hx - 5, 0, hx + 5, 0, [[0, shade(col, 0.28)], [0.5, col], [1, shade(col, -0.4)]]); c.fill();
      c.clip(); c.strokeStyle = shade(col, -0.32); c.lineWidth = 0.35;
      for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(hx - 6, b - 4.4 + k * 1.8); c.quadraticCurveTo(hx, b - 6.2 + k * 1.8, hx + 6, b - 2.2 + k * 1.8); c.stroke(); }
      c.strokeStyle = shade(col, 0.3); c.beginPath(); c.moveTo(hx - 5, b - 3.2); c.quadraticCurveTo(hx - 1, b - 5.6, hx + 5, b - 2.6); c.stroke();
      c.restore();
      wBand(c, hx - 5.1, b - 1.4, 10.2, 2, acc, acc2);
      if (!n) { ellipse(c, hx + (e ? 2.2 : 0), b - 0.6, 0.85, 0.85, acc2); ellipse(c, hx + (e ? 2.1 : -0.2), b - 0.8, 0.3, 0.3, '#fff0b0'); }
      const tl = 5.4 + sw * 0.6;
      if (e) poly(c, [[hx - 4.2, b - 1.4], [hx - 7.4 + sw * 0.5, b + tl - 1], [hx - 5.4, b + tl + 0.4], [hx - 3.6, b + 1.4]], shade(col, -0.18));
      else if (n) poly(c, [[hx - 1.4, b], [hx - 2.2 + sw * 0.4, b + tl], [hx + 1.4, b + tl - 0.4], [hx + 1.4, b]], shade(col, -0.22));
      else poly(c, [[hx + 3.4, b - 0.8], [hx + 5.6 + sw * 0.4, b + tl - 1], [hx + 3.8, b + tl + 0.2], [hx + 2.8, b + 0.6]], shade(col, -0.2));
      break;
    }
    case 'hood': {
      const tip = hx + (e ? -6.2 : 4.4) + sw * 0.5, ty = e ? b - 1.6 : b - 9.6;
      c.beginPath();
      if (e) {
        c.moveTo(hx + 3.2, hy - 0.4); c.quadraticCurveTo(hx + 3.6, b - 4, hx - 0.4, b - 4.4); c.quadraticCurveTo(hx - 3.6, b - 4.8, tip, ty);
        c.quadraticCurveTo(hx - 5.4, b + 1, hx - 4.8, hy + 3.8); c.lineTo(hx - 1.4, hy + 3.4); c.quadraticCurveTo(hx - 2.4, hy + 0.6, hx + 0.2, hy - 1.7); c.quadraticCurveTo(hx + 1.8, hy - 1.9, hx + 3.2, hy - 0.4);
      } else if (n) {
        c.moveTo(hx - 5, hy + 3.4); c.quadraticCurveTo(hx - 6.2, b - 4.6, hx - 0.6, b - 6); c.quadraticCurveTo(hx + 1.6, b - 7.4, tip, ty);
        c.quadraticCurveTo(hx + 6.4, b - 3.8, hx + 5, hy + 3.4); c.quadraticCurveTo(hx, hy + 5, hx - 5, hy + 3.4);
      } else {
        c.moveTo(hx - 5, hy + 3.6); c.quadraticCurveTo(hx - 6.4, b - 4.6, hx - 0.6, b - 6); c.quadraticCurveTo(hx + 1.6, b - 7.4, tip, ty);
        c.quadraticCurveTo(hx + 6.4, b - 3.8, hx + 5, hy + 3.6); c.lineTo(hx + 3.5, hy + 3.6); c.lineTo(hx + 3.5, hy - 0.6);
        c.quadraticCurveTo(hx, hy - 3.6, hx - 3.5, hy - 0.6); c.lineTo(hx - 3.5, hy + 3.6);
      }
      c.closePath();
      c.fillStyle = lingrad(c, hx - 5, 0, hx + 5, 0, [[0, shade(col, 0.22)], [0.5, col], [1, shade(col, -0.45)]]); c.fill();
      c.strokeStyle = shade(col, -0.5); c.lineWidth = 0.3; c.stroke();
      // заплатка на капюшоне
      if (!e) { c.fillStyle = W.acc; c.fillRect(hx - 4.4, b - 3.4, 1.7, 1.7); c.fillStyle = 'rgba(30,20,10,0.7)'; c.fillRect(hx - 4.1, b - 3.1, 0.35, 0.35); c.fillRect(hx - 2.9, b - 1.9, 0.35, 0.35); }
      break;
    }
    case 'fur': {
      c.save();
      c.beginPath(); c.ellipse(hx, b - 1.2, 5.7, 4.3, 0, 0, Math.PI * 2);
      c.fillStyle = lingrad(c, hx - 5, 0, hx + 5, 0, [[0, shade(col, 0.25)], [0.5, col], [1, shade(col, -0.4)]]); c.fill();
      c.clip(); c.strokeStyle = shade(col, -0.3); c.lineWidth = 0.3;
      for (let k = -4; k <= 4; k++) { c.beginPath(); c.moveTo(hx + k * 1.3, b - 5); c.lineTo(hx + k * 1.4 + 0.3, b + 1.6); c.stroke(); }
      c.restore();
      for (let k = -4; k <= 4; k++) poly(c, [[hx + k * 1.25 - 0.7, b + 0.6], [hx + k * 1.25 + 0.7, b + 0.6], [hx + k * 1.25, b + 2.2 + (k & 1) * 0.6]], k % 2 ? col : shade(col, -0.18));
      if (view === 'S') for (const sd of [-1, 1]) { ellipse(c, hx + sd * 5.2, hy + 1.8, 1.3, 2.4, shade(col, -0.1)); ellipse(c, hx + sd * 5, hy + 1.2, 0.6, 1.2, shade(col, 0.18)); }
      wBand(c, hx - 4.9, b - 0.2, 9.8, 1.5, acc, acc2);
      break;
    }
    case 'patchcap': {
      const O2 = { cap: col }, L2 = { ...L, capStyle: W.capStyle || 5, deco: 5, wild: null };
      _drawCap(c, O2, view, hx, hy, tipSway, L2, r, 1);
      if (!n) { c.fillStyle = acc; c.fillRect(hx + 0.8 * (e ? -1 : 1), b - 5.6, 2, 2); c.fillStyle = 'rgba(30,20,10,0.75)'; c.fillRect(hx + (e ? -0.6 : 1.1), b - 5.3, 0.4, 0.4); c.fillRect(hx + (e ? -1.6 : 2.1), b - 4.3, 0.4, 0.4); }
      wFeather(c, hx - 3.4 * (e ? -1 : 1), b - 0.8, e ? 0.5 : -0.5, '#b8a070', '#6a5030');
      break;
    }
    default: _drawCap(c, { cap: col }, view, hx, hy, tipSway, { ...L, wild: null }, r, 1);
  }
  if (W.chief && !n) {
    // золотой обруч вождя поверх убора
    const gb = b - 3.6;
    c.fillStyle = '#e8c040'; c.fillRect(hx - 3.4, gb, 6.8, 0.9); for (const k of [-2.6, 0, 2.6]) wTri(c, [hx + k - 0.8, gb], [hx + k, gb - 2.0], [hx + k + 0.8, gb], '#f6d458');
    ellipse(c, hx, gb + 0.45, 0.5, 0.45, '#c83a28');
  }
}

// ---------- Тело ----------
// вызывается из drawPerson (people.js) после туники и пояса, до рук и головы; L.wild — описание
function wildBody(c, view, L, shY, hipY, headY, sw) {
  const W = L.wild, e = view === 'E', n = view === 'N', S = view === 'S';
  const leather = W.strap || '#4a2c14', fur = W.mantle, acc = W.acc || '#c8a030', acc2 = W.acc2 || '#e8d070', bone = '#e8dcc0';
  // заплатки на тунике
  if (W.patch && !e) {
    const px = n ? 1.6 : -3.4;
    c.fillStyle = W.patch; c.fillRect(px, hipY - 4.4, 2.1, 2.1); c.fillStyle = 'rgba(30,20,10,0.65)'; c.fillRect(px + 0.2, hipY - 4.2, 0.35, 0.35); c.fillRect(px + 1.5, hipY - 2.8, 0.35, 0.35);
    c.fillStyle = shade(W.patch, -0.2); c.fillRect(px + 3.6 - (n ? 6 : 0), hipY - 6.5, 1.5, 1.5);
  } else if (W.patch) { c.fillStyle = W.patch; c.fillRect(0.2, hipY - 4.8, 1.9, 1.9); c.fillStyle = 'rgba(30,20,10,0.65)'; c.fillRect(0.4, hipY - 4.6, 0.35, 0.35); }
  // перевязь с амулетом
  if (S) {
    line(c, -3.4, shY + 0.4, 3.2, hipY, leather, 0.95); line(c, -3.4, shY + 0.4, 3.2, hipY, shade(leather, 0.25), 0.3);
    const ax = -0.2, ay = shY + 4.4;
    if (W.amulet === 'gourd') { ellipse(c, ax, ay + 0.6, 1.2, 1.5, '#b8943a'); ellipse(c, ax, ay - 0.9, 0.7, 0.8, '#b8943a'); line(c, ax, ay - 1.7, ax, ay - 2.4, wDark, 0.3); }
    else { wTri(c, [ax - 0.9, ay - 0.6], [ax + 0.9, ay - 0.6], [ax, ay + 1.8], bone); ellipse(c, ax + 1.5, ay + 0.3, 0.55, 0.9, acc2); }
  } else if (e) {
    line(c, -2.8, shY + 0.2, 3, hipY, leather, 0.9);
    if (W.amulet === 'gourd') { ellipse(c, 1.2, shY + 4.2, 1, 1.3, '#b8943a'); ellipse(c, 1.2, shY + 2.9, 0.6, 0.7, '#b8943a'); }
    else wTri(c, [0.5, shY + 3.6], [1.9, shY + 3.6], [1.2, shY + 5.8], bone);
  } else {
    line(c, 3.2, shY + 0.4, -3.2, hipY, leather, 0.95);
  }
  // меховой воротник на плечах — шире, чем у наших
  if (fur) {
    const dk = shade(fur, -0.3), lt = shade(fur, 0.22);
    if (e) {
      ellipse(c, -0.6, shY + 0.6, 3.9, 2.3, fur);
      for (let k = 0; k < 5; k++) wTri(c, [-3.6 + k * 1.5, shY + 2], [-2.4 + k * 1.5, shY + 2], [-3 + k * 1.5, shY + 3.6 + (k & 1) * 0.7], k % 2 ? dk : fur);
      for (const [dx, dy] of [[-2, -0.4], [0, 0.2], [-1, 1], [1, -0.2]]) { c.fillStyle = lt; c.fillRect(dx - 0.5, shY + dy - 0.3, 0.8, 0.45); }
    } else {
      ellipse(c, 0, shY + 0.4, 5.9, 2.4, fur);
      for (let k = -5; k <= 5; k++) wTri(c, [k * 1.05 - 0.7, shY + 1.8], [k * 1.05 + 0.7, shY + 1.8], [k * 1.05, shY + 3.3 + ((k * 3) & 1) * 0.9 + (n ? 1 : 0)], k % 2 ? dk : fur);
      for (const [dx, dy] of [[-4, -0.6], [-2, 0.2], [0, -0.5], [2, 0.3], [4, -0.4], [-3, 1], [3, 1]]) { c.fillStyle = lt; c.fillRect(dx - 0.5, shY + dy, 0.9, 0.45); }
    }
  }
  // шипы на плечах злых
  if (W.spikes) {
    if (e) wTri(c, [-1.6, shY - 0.4], [0.6, shY - 0.6], [-0.2, shY - 3.6], bone);
    else for (const sd of [-1, 1]) wTri(c, [sd * 3.6, shY - 0.2], [sd * 5.4, shY + 0.4], [sd * 5.6, shY - 3.2], sd < 0 ? bone : shade(bone, -0.15));
  }
  // снаряжение
  switch (W.prop) {
    case 'bundle': case 'pack': {
      const big = W.prop === 'pack', cl = big ? '#8a6a3a' : '#9a7a4a';
      if (e) { ellipse(c, -4.3, shY + 2.2, big ? 3 : 2.5, big ? 4.2 : 3.2, cl); ellipse(c, -4.9, shY + 0.9, 1.1, 1, shade(cl, 0.22)); line(c, -3, shY - 0.8, -3.2, shY + 3, leather, 0.7); if (big) { c.fillStyle = '#c8302a'; c.fillRect(-6.4, shY + 2, 1.6, 0.8); } if (!big) line(c, -5.6, shY - 3, -1.6, shY + 3.6, '#6e4428', 0.55); }
      else if (n) { ellipse(c, 0, shY + 3.4, big ? 4.4 : 3.4, big ? 4.6 : 3.8, cl); c.fillStyle = shade(cl, -0.3); c.fillRect(-4, shY + 1.4, 8, 0.6); ellipse(c, -1, shY + 1.6, 1.4, 1, shade(cl, 0.2)); if (big) { c.fillStyle = '#c8302a'; c.fillRect(-1, shY + 4, 2, 0.9); } if (!big) line(c, -5.2, shY - 0.2, 4.6, shY + 7.2, '#6e4428', 0.6); }
      else {
        line(c, -2.6, shY, -2.4, hipY - 0.4, leather, 0.8); line(c, 2.6, shY, 2.4, hipY - 0.4, leather, 0.8);
        if (big) { ellipse(c, -4.6, shY - 1.2, 2.2, 3.2, cl); ellipse(c, 4.6, shY - 1.6, 2.4, 3.6, shade(cl, -0.12)); c.fillStyle = '#c8302a'; c.fillRect(-3, shY - 3.6, 6, 1.2); }   // скатка и мешки за плечами
        else ellipse(c, 4.4, shY - 0.6, 1.8, 2.4, cl);
      }
      break;
    }
    case 'sack': {
      if (e) { ellipse(c, -1.8, hipY + 1.6, 2, 2.2, '#c8a060'); c.fillStyle = '#e04030'; c.fillRect(-2.2, hipY + 0.8, 0.9, 0.9); }
      else if (n) { ellipse(c, -2.2, hipY + 1.2, 2.2, 2.4, '#c8a060'); c.fillStyle = '#e04030'; c.fillRect(-2.6, hipY + 0.4, 0.9, 0.9); }
      else { ellipse(c, 3.6, hipY + 1.6, 2.2, 2.4, '#c8a060'); c.fillStyle = '#e04030'; c.fillRect(3.2, hipY + 0.8, 0.9, 0.9); line(c, 2.4, hipY - 0.4, 3.4, hipY + 0.4, wDark, 0.3); }
      break;
    }
    case 'basket': {
      const bx = e ? 3.2 : S ? -4.4 : 4.2, by = hipY + 2;
      ellipse(c, bx, by, 2.5, 1.9, '#a87a3a'); c.fillStyle = '#7a5428'; c.fillRect(bx - 2.4, by - 0.2, 4.8, 0.45);
      for (const [dx, col] of [[-1.3, '#6ac04a'], [0, '#e86a8a'], [1.3, '#6ac04a']]) ellipse(c, bx + dx, by - 1.5, 0.9, 1.1, col);
      break;
    }
    case 'pick': {
      if (e) { line(c, -4.4, shY - 2, -1.4, hipY + 3, '#6e4428', 0.75); c.strokeStyle = '#8a8e92'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-6.4, shY - 2.6); c.quadraticCurveTo(-4.4, shY - 3.8, -2.4, shY - 2.2); c.stroke(); }
      else if (n) { line(c, -3.6, shY - 2.4, 3, hipY + 2.4, '#6e4428', 0.75); c.strokeStyle = '#8a8e92'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-6.4, shY - 3.8); c.quadraticCurveTo(-4, shY - 5.4, -2.2, shY - 1.4); c.stroke(); }
      else { line(c, 3.4, shY - 2.4, 4.6, hipY + 2.6, '#6e4428', 0.75); c.strokeStyle = '#8a8e92'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(1.6, shY - 3.4); c.quadraticCurveTo(3.8, shY - 5.2, 6, shY - 2.6); c.stroke(); }
      break;
    }
    case 'ore': {   // мешочек с рудой на поясе
      const ox = e ? 2.8 : S ? -3.6 : 3.4;
      ellipse(c, ox, hipY + 2.4, 1.5, 1.7, '#5a4030'); for (const [dx, dy] of [[-0.4, 1.9], [0.5, 2.2]]) { c.fillStyle = '#c8802a'; c.fillRect(ox + dx - 0.3, hipY + dy, 0.7, 0.6); }
      break;
    }
    case 'scales': {   // весы на поясе
      const ox = e ? 2.6 : S ? 3.4 : -3.4;
      line(c, ox, hipY + 0.6, ox, hipY + 3.4, '#8a6a3a', 0.4); line(c, ox - 1.6, hipY + 3.6, ox + 1.6, hipY + 3.6, '#8a6a3a', 0.4);
      ellipse(c, ox - 1.5, hipY + 4.2, 0.9, 0.35, '#e8c040'); ellipse(c, ox + 1.5, hipY + 4.2, 0.9, 0.35, '#e8c040');
      break;
    }
  }
  // трофеи (зубы, когти) на ремне у боевых
  if (W.wpn && !e) {
    const tx = n ? 1.4 : -1.4;
    for (let k = 0; k < 3; k++) wTri(c, [tx - 0.4 + k * 1.1, hipY + 0.8], [tx + 0.4 + k * 1.1, hipY + 0.8], [tx + 0.1 + k * 1.1, hipY + 2.4], bone);
  }
}

// ---------- Оружие ----------
Object.assign(WPN_STYLE, { wclub: 'blade', whatchet: 'blade', wbone: 'stab', wspear: 'heavy', wstick: 'heavy' });
const _drawWeapon = drawWeapon, _drawSheath = drawSheath;
drawWeapon = function (c, k, x, y, dx, dy, part) {
  if (!/^w(club|hatchet|bone|spear|stick)$/.test(k)) return _drawWeapon(c, k, x, y, dx, dy, part);
  const P = t => [x + dx * t, y + dy * t], nx = -dy, ny = dx, side = (t, o) => { const p = P(t); return [p[0] + nx * o, p[1] + ny * o]; };
  const seg = (t0, t1, col, w) => { const a = P(t0), b = P(t1); line(c, a[0], a[1], b[0], b[1], wDark, w + 0.55); line(c, a[0], a[1], b[0], b[1], col, w); };
  const hl = (t0, t1, col, w) => { const a = P(t0), b = P(t1); line(c, a[0], a[1], b[0], b[1], col, w); };
  c.lineCap = 'round';
  if (k === 'wclub') {
    seg(-1.4, 4.6, '#6e4428', 1.1); seg(3.6, 7.2, '#5a3a20', 2.2); hl(3.6, 6.4, '#8a5a34', 0.5);
    for (const [t, o] of [[4.2, 0.9], [5.4, -0.9], [6.2, 0.7]]) { const p = side(t, o); c.fillStyle = '#c8c0b0'; c.fillRect(p[0] - 0.3, p[1] - 0.3, 0.7, 0.7); }
  } else if (k === 'whatchet') {
    seg(-1.4, 6.4, '#6e4428', 1.0); hl(-1.2, 1.8, '#9a7a4a', 0.5);
    const a = P(4.8), b = P(6.8), c1 = side(7.2, 3.3), d = side(4.6, 3.1);
    poly(c, [a, b, c1, d], '#c8c4b4', wDark, 0.4); hl(5, 6.6, '#f4f0e0', 0.35);
    const l = P(4.7); c.fillStyle = '#c8a050'; c.fillRect(l[0] - 0.5, l[1] - 0.3, 1.1, 0.6);   // обмотка
  } else if (k === 'wbone') {
    seg(-1.1, 0.4, '#5a3a20', 0.9); const a = side(0.4, 0.9), b = side(0.4, -0.9), t = P(3.9), m = side(2, 0.15);
    poly(c, [a, m, t, b], '#e8dcc0', '#8a7e64', 0.3);
  } else {   // копьё и посох путника
    const spear = k === 'wspear';
    seg(-2.4, spear ? 9.6 : 8, spear ? '#7a5a34' : '#6a4a2a', 0.9);
    if (spear) {
      const a = P(9.6), b = P(12.4), l = side(10.2, 1.2), r = side(10.2, -1.2);
      poly(c, [a, l, b, r], '#b8c0a8', wDark, 0.3);
      const f1 = P(8.2), f2 = P(7.2); wTriF(c, f1, 0.5, '#c8603a'); wTriF(c, f2, -0.5, '#e8dcc0');
    } else {
      const h = P(8); line(c, h[0], h[1], h[0] + dy * 0 + 1.4 * Math.sign(dx || 1), h[1] - 0.2, '#6a4a2a', 0.8);
      const hg = P(6.6); line(c, hg[0], hg[1], hg[0] + 0.5, hg[1] + 2.2, '#c8a060', 0.4); ellipse(c, hg[0] + 0.5, hg[1] + 2.5, 0.7, 0.9, '#e8dcc0');
      hl(2.4, 3.6, '#a87a3a', 0.45);
    }
  }
  c.lineCap = 'butt';
};
function wTriF(c, p, s, col) { poly(c, [[p[0], p[1]], [p[0] + s * 1.6, p[1] + 1.6], [p[0] + s * 0.4, p[1] + 2.4]], col); }
drawSheath = function (c, k, x, y, dx, dy, full) {
  if (!/^w(club|hatchet|bone)$/.test(k)) return _drawSheath(c, k, x, y, dx, dy, full);
  // на поясе висит рукоятью вверх
  const a = [x, y], b = [x + dx * 3.4, y + dy * 3.4];
  if (k === 'wbone') { line(c, x - dx * 0.4, y - dy * 0.4, b[0], b[1], wDark, 1.3); line(c, a[0], a[1], b[0], b[1], '#e8dcc0', 0.75); return; }
  line(c, a[0], a[1], b[0], b[1], wDark, 1.5); line(c, a[0], a[1], b[0], b[1], k === 'wclub' ? '#6e4428' : '#8a6a3a', 0.9);
  if (k === 'wclub') ellipse(c, b[0], b[1], 1.3, 1.3, '#5a3a20'); else poly(c, [b, [b[0] + 1.8, b[1] - 0.6], [b[0] + 1.6, b[1] + 1.6]], '#a8a090');
};

// ---------- Спрайты и кэш ----------
const WILD_CACHE = new Map();
const WILD_CACHE_MAX = 1400;
function wildOutfit(D) {
  const key = 'w:' + D.id;
  if (!OUTFIT[key]) OUTFIT[key] = { cap: 'wild', pants: D.pants, coat: D.coat };
  return key;
}
function wildLook(D) {
  return {
    skin: D.skin, beard: 0, bcol: D.bcol, beardLen: D.bl || 1, beardStyle: D.bs || 0, must: 0, nose: D.nose != null ? D.nose : (D.skin & 1 ? 1 : 0), brow: D.evil ? 1 : 0,
    earring: !!D.chief || D.head === 'turban', freckles: false, braid: false, capTip: 1, green: D.coat, deco: 5, serfCap: D.capc, capStyle: D.capStyle || 0,
    fem: !!D.fem, hs: D.hs || 0, hair: D.hair || '#4a3020', wild: D,
  };
}
// view: S/N/E; pose: idle (0..5) | walk (0..7) | fight (кадры FIGHT_FRAMES); opt: gest/gf/wpn. Холст — как у personSprite (26×38 мировых px, ступни в 13,35)
function wildSprite(key, view, pose, frame, opt = {}) {
  const D = wildDesc(key), ck = `${key}|${view}${pose}${frame}|${opt.gest || ''}${opt.gf || ''}|${opt.wpn === undefined ? '' : opt.wpn}|${opt.gait || ''}`;
  let cv = WILD_CACHE.get(ck);
  if (cv) { WILD_CACHE.delete(ck); WILD_CACHE.set(ck, cv); return cv; }
  if (typeof R !== 'undefined' && typeof spriteBudgetOk === 'function' && !spriteBudgetOk(!!WILD_LAST[key])) return WILD_LAST[key];
  if (!PEOPLE_SCRATCH) PEOPLE_SCRATCH = mkSprite(PW, PH, PS);
  const [c2, ctx] = PEOPLE_SCRATCH;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c2.width, c2.height);
  ctx.setTransform(PS, 0, 0, PS, 0, 0); ctx.globalAlpha = 1;
  const seed = [...key].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) | 0, 7);
  const wpn = opt.wpn === undefined ? D.wpn : opt.wpn;
  MOSS_OFF = !D.moss;
  try { drawPerson(ctx, wildOutfit(D), wildLook(D), view, pose, frame, null, '', mulberry32(seed), { ...opt, wpn: wpn || undefined, lvl: 1, carryN: 0 }); }
  finally { MOSS_OFF = false; }
  cv = toPixelArt(c2, PS / PART, { outline: true, outlineDark: 0.36, alphaCut: 105 });
  if (WILD_CACHE.size >= WILD_CACHE_MAX) WILD_CACHE.delete(WILD_CACHE.keys().next().value);
  WILD_CACHE.set(ck, cv);
  WILD_LAST[key] = cv;
  return cv;
}
const WILD_LAST = {};

// направление взгляда: по вектору движения. Возвращает [view, flip]
function wildView(dx, dy, prev) {
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (ax < 0.02 && ay < 0.02) return prev || ['S', 1];
  if (ay > ax * 1.3) return [dy > 0 ? 'S' : 'N', prev ? prev[1] : 1];
  return ['E', dx < 0 ? -1 : 1];
}
// режим → кадр: 'idle' | 'walk' | 'talk' | 'trade' | 'joy' | 'fight' (fr — имя кадра боя) | 'hurt'
function wildFrame(mode, t, id, fr) {
  switch (mode) {
    case 'walk': return ['walk', Math.floor(t * 9 + id) & 7, {}];
    case 'run': return ['walk', Math.floor(t * 14 + id) & 7, {}];
    case 'talk': return ['idle', 0, { gest: ['wave', 'point', 'fist'][Math.floor(t / 1.1 + id) % 3], gf: gestCyc(t * 3 + id) }];
    case 'trade': return ['idle', 0, { gest: 'clap', gf: gestCyc(t * 5 + id) }];
    case 'joy': return ['fight', Math.floor(t * 5 + id) & 1 ? 'win1' : 'win0', {}];
    case 'fight': return ['fight', fr || 'ready', {}];
    case 'hurt': return ['fight', 'hurt', {}];
    default: return ['idle', IDLE_POSE[Math.floor(((t / 2.6 + id * 0.37) % 1) * IDLE_FRAMES)], {}];
  }
}
// рисует гнома ступнями в (X, Y); f — взгляд вправо/влево; s — масштаб
function wildDraw(c, key, X, Y, view, f, pose, frame, opt, s) {
  const spr = wildSprite(key, view, pose, frame, opt || {});
  if (!spr) return;
  c.save(); c.translate(X, Y); if (s && s !== 1) c.scale(s, s);
  if (f < 0 && view === 'E') c.scale(-1, 1);
  c.imageSmoothingEnabled = false;
  c.drawImage(spr, -PFX, -PFY, PW, PH);
  c.restore();
}
