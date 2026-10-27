'use strict';
// Материалы и реквизит в масштабе референсов: 1 пиксель арта = 1 мировой пиксель (BK = 1).
// Технические цифры взяты с референсов владельца (pixeljoint 190×190, башня 139×128, фасадный домик ~115×140):
// ряд черепицы 3 px, плитка 4 px, брус 2 px, окно 8×10 с рамой 1 px, обводка 1 px тёмно-лиловая, 4 тона на материал.

const P1 = {
  ink: bhex('#2a1a24'),
  tileR: bramp(['#ec7e52', '#c8503a', '#9a3428', '#681f1c']),
  tileD: bramp(['#b85452', '#8e3434', '#662222', '#441616']),
  scale: bramp(['#7aa6e8', '#4e78c4', '#365694', '#243a68']),
  slate: bramp(['#7c8496', '#5c6478', '#444a5a', '#2e3240']),
  plaster: bramp(['#f4ecd8', '#dfd4ba', '#bfb296', '#9c8e74']),
  plasterC: bramp(['#e2e4dc', '#c6c9bf', '#a5a89e', '#82857c']),       // холодная серая (фасадный домик)
  beam: bramp(['#7a5238', '#563826', '#3a2418', '#241610']),
  beamD: bramp(['#5a3040', '#40202e', '#2c1420', '#1a0c14']),         // тёмно-лиловый брус
  stone: bramp(['#aab2c0', '#8792a4', '#677286', '#4b5364']),         // голубоватый камень pixeljoint
  stoneW: bramp(['#c6beaa', '#a69e8a', '#827a6a', '#5e584a']),
  stoneB: bramp(['#b4b8c4', '#949aa8', '#747a88', '#545866']),        // крупные блоки башни
  log: bramp(['#b67e50', '#905c36', '#6c4224', '#4a2c18']),
  dark: bramp(['#6e4e3e', '#52362a', '#38241c', '#241610']),
  plank: bramp(['#c09060', '#9a6c42', '#74502e', '#50361e']),
  plankB: bramp(['#8ea6b4', '#6c8494', '#506472', '#384854']),
  brick: bramp(['#bc6e52', '#9a503c', '#7a3a2c', '#56281e']),
  fascia: bramp(['#d8945a', '#b06a38', '#804824']),                   // деревянная кромка кровли
  glass: bramp(['#fff0a8', '#f2bc4c', '#cc8630']),
  glassD: bramp(['#b4d0e4', '#7a98b0', '#52708a']),
  glassB: bramp(['#d0f0ff', '#78c0f0', '#3c88c8']),
  iron: bramp(['#9898a4', '#64646e', '#3c3c44']),
  ivy: bramp(['#a4d85c', '#6eac40', '#4a8030', '#2e5a1e']),
  grass: bramp(['#92c454', '#6ea040', '#4e7c2e']),
  trunk: bramp(['#6e4a30', '#4c3020']),
  red: bramp(['#e04c40', '#b03028', '#7c1e1a']),
  white: bramp(['#f8f4ea', '#d4cec2', '#aca69a']),
  gold: bramp(['#ffd864', '#e0a830', '#a87818']),
  cloth: bramp(['#e6d6b0', '#c4b084', '#9c8858']),
  smoke: bramp(['#e4e2dc', '#bcbab4', '#908e8a']),
  straw: bramp(['#e8c868', '#c8a448', '#a07c30', '#705420']),
};
const p1 = (R, i, n = 3) => R[i < 0 ? 0 : i > n ? n : i];
// свет: li 0 — освещённая грань (юг/запад/верх), 1 — боковая (восток), 2 — тень
const L1 = F => (F.li >= 2 ? 1 : F.li);

// --- кровли ---
function m1Tile(R) {
  return (u, v, F) => {
    const row = Math.floor(v / 3), st = row % 2 ? 2 : 0, tu = (((u + st) % 4) + 4) % 4, vv = ((v % 3) + 3) % 3, k = L1(F);
    if (tu === 0) return p1(R, 2 + k);
    if (vv === 0) return p1(R, 0 + k);
    if (vv === 2) return p1(R, 2 + k);
    return p1(R, 1 + k + (bhash(Math.floor((u + st) / 4), row, 201) < 0.12 ? 1 : 0));
  };
}
function m1Scale(R) {
  return (u, v, F) => {
    const row = Math.floor(v / 3), st = row % 2 ? 2 : 0, tu = (((u + st) % 4) + 4) % 4, vv = ((v % 3) + 3) % 3, k = L1(F);
    if (vv === 2 && (tu === 0 || tu === 3)) return p1(R, 1 + k);           // скруглённый низ: углы уходят в тон ряда ниже
    if (vv === 2) return p1(R, 3);
    if (tu === 0) return p1(R, 2 + k);
    if (vv === 0) return p1(R, 0 + k);
    return p1(R, 1 + k);
  };
}
function m1Slate(R) {
  return (u, v, F) => {
    const row = Math.floor(v / 3), st = row % 2 ? 3 : 0, tu = (((u + st) % 5) + 5) % 5, vv = ((v % 3) + 3) % 3, k = L1(F);
    if (tu === 0 || vv === 2) return p1(R, 2 + k);
    const h = bhash(Math.floor((u + st) / 5), row, 202);
    return p1(R, (h < 0.3 ? 0 : h < 0.85 ? 1 : 2) + k);
  };
}
function m1Straw(R) {
  return (u, v, F) => {
    const k = L1(F), c = Math.floor(u / 2), h = bhash(c, 0, 203), t = v / F.L;
    let i = h < 0.3 ? 0 : h < 0.8 ? 1 : 2;
    if (((v + Math.floor(h * 3)) % 7) === 0) i += 1;
    if (t > 0.8) i += 1; if (t < 0.15) i -= 1;
    if (F.cap && v < 2) i = 2;
    if (v > F.L) { if (v > F.L + 1 + (h < 0.5 ? 1 : 0)) return null; return p1(R, 3); }
    return p1(R, i + k);
  };
}
function m1Ivy(base, patches, R = P1.ivy) {
  return (u, v, F) => {
    for (const p of patches) {
      const d = Math.hypot((u - p.u) / p.rx, (v - p.v) / p.ry) + (bhash(u, v, 204) - 0.5) * 0.5;
      if (d < 1) { const h = bhash(u + v, v - u, 205); return p1(R, (h < 0.25 ? 0 : h < 0.75 ? 1 : 2) + (d > 0.8 ? 1 : 0) + L1(F)); }
    }
    return base(u, v, F);
  };
}
function m1Awning(A = P1.red, B = P1.white) { return (u, v, F) => p1(Math.floor(u / 4) % 2 ? B : A, ((u % 4) + 4) % 4 === 0 ? 1 : 0 + (v > F.L - 1.5 ? 1 : 0), 2); }
const m1Fascia = (u, v, F) => (v > F.T - 1 ? P1.fascia[0] : P1.fascia[F.li >= 2 ? 2 : 1]);
const m1FasciaDark = (u, v, F) => (v > F.T - 1 ? P1.beamD[0] : P1.beamD[1]);

// --- стены ---
function m1Stone(R, cw = 5, ch = 3) {
  return (u, v, F) => {
    const row = Math.floor(v / ch), st = row % 2 ? Math.floor(cw / 2) : 0, uu = (((u + st) % cw) + cw) % cw, vv = ((v % ch) + ch) % ch, k = L1(F);
    if (uu === 0 || vv === 0) return p1(R, 3);
    const h = bhash(Math.floor((u + st) / cw), row, 211);
    let i = h < 0.3 ? 0 : h < 0.8 ? 1 : 2;
    if (vv === 1 && i > 0) i -= 1;                                  // светлый верх камня
    if (F.h && v > F.h - 3) i += 1;                                 // тень под свесом
    return p1(R, i + k);
  };
}
function m1Plaster(R, o = {}) {
  const B = o.beam || P1.beam, bay = o.bay || 14, low = o.low || 0;
  return (u, v, F) => {
    if (low && v < low) return m1Stone(o.stoneR || P1.stone)(u, v, F);
    const k = L1(F), w = F.w, h = F.h;
    if (o.frame) {
      const inB = (() => {
        if (v < 2 || v > h - 3) return true;
        if (u < 2 || u > w - 3) return true;
        if (o.mid && Math.abs(v - h * 0.55) < 1) return true;
        const n = Math.max(1, Math.round(w / bay)), bw = w / n, kx = Math.floor(u / bw), lu = u - kx * bw;
        if (lu < 1 || lu > bw - 2) return true;
        if (o.brace !== false && kx % 2 === (o.braceOdd ? 1 : 0)) { const t = (v - low) / (h - low); const bx = o.braceX ? bw - t * bw : t * bw; if (Math.abs(lu - bx) < 1.3) return true; }
        return false;
      })();
      if (inB) return p1(B, 1 + k);
    }
    let i = k;
    if (bhash(u, v, 212) < 0.04) i += 1;
    if (F.h && v > F.h - 3) i += 1;
    return p1(R, i);
  };
}
function m1Logs(R) { return (u, v, F) => { const vv = ((v % 4) + 4) % 4, k = L1(F); let i = vv === 0 ? 3 : vv === 1 ? 2 : vv === 2 ? 1 : 0; if (vv === 3 && bhash(Math.floor(u / 5), Math.floor(v / 4), 213) < 0.2) i = 1; if (F.h && v > F.h - 3) i += 1; return p1(R, i + (vv === 0 ? 0 : k)); }; }
function m1Plank(R, pw = 4, ver = true) { return (u, v, F) => { const a = ver ? u : v, aa = ((a % pw) + pw) % pw, k = L1(F); if (aa === 0) return p1(R, 3); const h = bhash(Math.floor(a / pw), 0, 214); let i = h < 0.3 ? 0 : h < 0.85 ? 1 : 2; if (F.h && v > F.h - 3) i += 1; return p1(R, i + k); }; }
function m1Brick(R) { return (u, v, F) => { const row = Math.floor(v / 3), st = row % 2 ? 3 : 0, uu = (((u + st) % 6) + 6) % 6, vv = ((v % 3) + 3) % 3, k = L1(F); if (uu === 0 || vv === 0) return p1(R, 3); const h = bhash(Math.floor((u + st) / 6), row, 215); return p1(R, (h < 0.25 ? 0 : h < 0.8 ? 1 : 2) + k); }; }
const m1Flat = c => () => c;

// --- окна и двери (рама 1 px) ---
function m1Window(o = {}) {
  const G = o.G || (o.lit === false ? P1.glassD : P1.glass), Fr = o.frameR || P1.beam, w = o.w, h = o.h;
  return (u, v) => {
    const cx = (w - 1) / 2, cy = (h - 1) / 2;
    if (o.round) { const r = Math.min(w, h) / 2, d = Math.hypot(u - cx, v - cy); if (d > r) return null; if (d > r - 1.2) return Fr[1]; if (Math.abs(u - cx) < 0.6 || Math.abs(v - cy) < 0.6) return Fr[2]; return G[u < cx && v > cy ? 0 : u > cx && v < cy ? 2 : 1]; }
    if (o.arch) { const r = (w - 1) / 2; if (v > h - 1 - r) { const d = Math.hypot(u - cx, v - (h - 1 - r)); if (d > r + 0.5) return null; if (d > r - 0.6) return Fr[1]; } }
    if (u < 1 || u > w - 2 || v < 1 || v > h - 2) return Fr[v < 1 ? 1 : 1];
    if (o.sill && v < 2) return P1.plank[0];
    if (o.cross !== false && (Math.abs(u - cx) < 0.6 || Math.abs(v - cy) < 0.6)) return Fr[2];
    const t = (u - 1) / (w - 3) + (1 - (v - 1) / (h - 3));
    return G[t < 0.6 ? 0 : t < 1.3 ? 1 : 2];
  };
}
function m1Door(o = {}) {
  const R = o.col || P1.plank, w = o.w, h = o.h, cx = (w - 1) / 2;
  return (u, v) => {
    if (o.arch) { const r = (w - 1) / 2; if (v > h - 1 - r && Math.hypot(u - cx, v - (h - 1 - r)) > r + 0.5) return null; }
    if (u < 1 || u > w - 2 || v > h - 2) return P1.beam[2];
    if (o.double && Math.abs(u - cx) < 0.6) return P1.beam[3];
    const uu = ((u % 3) + 3) % 3;
    if (uu === 0) return R[3];
    if ((v > 3 && v < 5) || (v > h - 7 && v < h - 5)) return P1.iron[uu === 1 ? 0 : 1];
    if (o.knob && Math.abs(u - (w - 3)) < 0.6 && Math.abs(v - h / 2) < 0.6) return P1.gold[1];
    return R[uu === 1 ? 1 : 2];
  };
}
function m1RoundDoor(o = {}) {
  const R = o.col || P1.plank, w = o.w, h = o.h, cx = (w - 1) / 2, cy = (h - 1) / 2, r = Math.min(w, h) / 2;
  return (u, v) => { const d = Math.hypot(u - cx, v - cy); if (d > r) return null; if (d > r - 1.2) return P1.beam[2]; if (d < 1) return P1.gold[1]; const uu = (((u + 1) % 3) + 3) % 3; return uu === 0 ? R[3] : R[uu === 1 ? 1 : 2]; };
}
// рисунок как материал грани (вывеска на фронтоне)
function m1Sprite(w, h, draw) { const buf = new Map(); draw((x, y, c) => { if (c) buf.set(x + ',' + y, c); }); return (u, v) => buf.get(Math.round(u - w / 2) + ',' + Math.round(h / 2 - v - 0.5)) || null; }

// --- реквизит ×1 (экранные пиксели, опора в (0,0)) ---
const Q1 = {
  barrel(P, w = 9, h = 11, R = P1.plank) {
    for (let y = -h; y <= 0; y++) for (let x = 0; x < w; x++) { let i = x === 0 || x === w - 1 ? 3 : x < 3 ? 0 : x < 6 ? 1 : 2; if ((y + h) % 4 === 0 && x > 0 && x < w - 1) { P(x - (w >> 1), y, P1.iron[x < 4 ? 0 : 1]); continue; } if (y === -h) i = 2; P(x - (w >> 1), y, R[i]); }
    for (let x = 1; x < w - 1; x++) P(x - (w >> 1), -h - 1, R[3]);
  },
  crate(P, s = 8, R = P1.plank) { for (let y = -s; y <= 0; y++) for (let x = 0; x < s; x++) { let i = 1; if (x === 0 || x === s - 1 || y === -s || y === 0) i = 3; else if (x === y + s || x === s - 1 - (y + s)) i = 2; else if (x === 1 || y === -s + 1) i = 0; P(x, y, R[i]); } for (let k = 1; k <= 3; k++) for (let x = 0; x < s; x++) P(x + k, -s - k, R[k === 3 ? 3 : 0]); for (let k = 1; k <= 3; k++) for (let y = -s; y <= 0; y++) P(s - 1 + k, y - k, R[k === 3 ? 3 : 2]); },
  sack(P, w = 7, h = 9, R = P1.cloth) { PR.ell(P, 0, -h / 2, w / 2, h / 2, (x, y, a, b) => R[a < -0.3 && b < 0 ? 0 : a > 0.5 || b > 0.6 ? 2 : 1]); P(0, -h, R[2]); P(-1, -h + 1, R[2]); P(1, -h + 1, R[2]); },
  tree(P, r = 13, R = P1.grass) { PR.rect(P, -1, -r + 2, 0, 0, P1.trunk[1]); P(-1, -r + 4, P1.trunk[0]); for (const [cx, cy, rr, s] of [[0, -r - 3, r, 1], [-r * 0.45, -r - 6, r * 0.6, 0], [r * 0.4, -r - 1, r * 0.55, 1], [0, -r - r * 0.55, r * 0.5, 0]]) PR.ell(P, cx, cy, rr, rr * 0.85, (x, y, a, b) => { const e = a * a + b * b; let i = s + (e > 0.6 ? 1 : 0) + (a > 0.35 || b > 0.45 ? 1 : 0); if (bhash(x, y, 221) < 0.12 && e < 0.7) i -= 1; return p1(R, i, 2); }); },
  smoke(P) { for (const [cx, cy, r, t] of [[0, -4, 2.2, 0], [2, -9, 2.8, 0], [-1, -15, 3.2, 1], [3, -21, 3.6, 1], [0, -27, 3.6, 2]]) PR.ell(P, cx, cy, r, r * 0.8, (x, y, a, b) => (t < 2 || bdith(x, y) < 0.5 ? P1.smoke[t === 0 ? (a < 0 ? 0 : 1) : t] : null)); },
  lantern(P) { PR.rect(P, -1, -6, 1, -2, P1.iron[2]); P(0, -5, P1.glass[1]); P(0, -4, P1.glass[0]); P(0, -7, P1.iron[1]); for (const [x, y] of [[-3, -5], [3, -4], [-2, -8], [2, -8], [0, 0], [-3, -1], [3, -2]]) P(x, y, P1.gold[0]); },
  streetLamp(P, h = 22) { PR.rect(P, 0, -h, 0, 0, P1.iron[2]); PR.rect(P, -1, 0, 1, 0, P1.iron[2]); PR.rect(P, -1, -h - 5, 1, -h, P1.iron[2]); P(0, -h - 3, P1.glass[0]); P(0, -h - 2, P1.glass[1]); for (const [x, y] of [[-3, -h - 3], [3, -h - 2], [-2, -h - 7], [2, -h - 7], [-4, -h], [4, -h - 1], [0, -h - 9]]) P(x, y, P1.gold[0]); },
  sign(P, kind, dir = 1, w = 12, h = 9) {
    const x0 = dir > 0 ? 2 : -2 - w, y0 = -h - 2;
    for (let x = 0; x <= Math.abs(dir * 7); x++) P(x * dir, -h - 4, P1.iron[1]);
    P(x0 + (dir > 0 ? 2 : w - 3), -h - 3, P1.iron[2]); P(x0 + (dir > 0 ? w - 3 : 2), -h - 3, P1.iron[2]);
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) P(x, y, P1.plank[x === x0 || x === x0 + w - 1 || y === y0 || y === y0 + h - 1 ? 3 : 1]);
    Q1.icon(P, kind, x0 + (w >> 1), y0 + (h >> 1));
  },
  board(P, kind, w = 16, h = 10) { const x0 = -(w >> 1), y0 = -(h >> 1); for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) P(x, y, P1.plank[x === x0 || x === x0 + w - 1 || y === y0 || y === y0 + h - 1 ? 3 : y === y0 + 1 ? 0 : 1]); Q1.icon(P, kind, 0, 0); },
  icon(P, kind, cx, cy) {
    if (kind === 'mug') { PR.rect(P, cx - 2, cy - 1, cx + 1, cy + 3, P1.gold[1]); P(cx - 2, cy + 3, P1.gold[2]); PR.rect(P, cx + 2, cy, cx + 2, cy + 2, P1.gold[2]); PR.rect(P, cx - 3, cy - 2, cx + 1, cy - 2, P1.white[0]); P(cx - 1, cy - 3, P1.white[0]); }
    else if (kind === 'skull') { PR.rect(P, cx - 2, cy - 2, cx + 2, cy, P1.white[0]); PR.rect(P, cx - 1, cy + 1, cx + 1, cy + 1, P1.white[1]); P(cx - 1, cy - 1, P1.ink); P(cx + 1, cy - 1, P1.ink); P(cx - 3, cy + 2, P1.white[1]); P(cx + 3, cy + 2, P1.white[1]); P(cx - 3, cy - 3, P1.white[1]); P(cx + 3, cy - 3, P1.white[1]); }
    else if (kind === 'lamp') { PR.ell(P, cx, cy, 2.6, 2.6, (x, y, a, b) => (a * a + b * b > 0.6 ? P1.iron[2] : a < 0 && b < 0 ? P1.glass[0] : P1.glass[1])); P(cx, cy - 3, P1.iron[1]); }
  },
  table(P, w = 14) { PR.rect(P, -w / 2, -7, w / 2, -6, P1.plank[0]); PR.rect(P, -w / 2 + 1, -5, w / 2 - 1, -5, P1.plank[2]); P(-w / 2 + 1, -4, P1.plank[2]); P(-w / 2 + 1, -3, P1.plank[2]); P(w / 2 - 1, -4, P1.plank[2]); P(w / 2 - 1, -3, P1.plank[2]); PR.rect(P, -w / 2 - 2, -2, w / 2 + 2, -2, P1.plank[1]); P(-w / 2 - 1, -1, P1.plank[3]); P(w / 2 + 1, -1, P1.plank[3]); P(-1, -9, P1.gold[1]); P(0, -9, P1.gold[1]); P(-1, -8, P1.gold[1]); P(0, -8, P1.gold[1]); P(-1, -10, P1.white[0]); P(0, -10, P1.white[0]); },
  bench(P, w = 10) { PR.rect(P, -w / 2, -3, w / 2, -3, P1.plank[0]); PR.rect(P, -w / 2, -2, w / 2, -2, P1.plank[2]); P(-w / 2 + 1, -1, P1.plank[3]); P(w / 2 - 1, -1, P1.plank[3]); },
  steps(P, w = 12, n = 2) { for (let k = 0; k < n; k++) { const y = -k * 2, hw = (w >> 1) - k; PR.rect(P, -hw, y - 1, hw, y - 1, P1.stone[k === n - 1 ? 0 : 1]); PR.rect(P, -hw, y, hw, y, P1.stone[2]); } },
  stones(P) { for (const [cx, cy, r] of [[0, 0, 2.2], [4, -1, 1.6], [-3, -1, 1.6]]) PR.ell(P, cx, cy, r, r * 0.7, (x, y, a, b) => P1.stone[b < -0.3 ? 0 : a > 0.4 ? 2 : 1]); },
  flowers(P, w = 10) { for (let x = 0; x < w; x++) { const h = 1 + (bhash(x, 0, 231) * 2 | 0); PR.rect(P, x, -h, x, 0, P1.grass[1 + (x % 2)]); if (x % 2 === 1) P(x, -h - 1, [P1.red[0], P1.gold[0], P1.white[0], P1.scale[0]][(bhash(x, 1, 232) * 4) | 0]); } },
  planter(P, w = 9) { PR.rect(P, -(w >> 1), -3, (w >> 1), 0, P1.plank[2]); PR.rect(P, -(w >> 1), -3, (w >> 1), -3, P1.plank[0]); for (let x = -(w >> 1) + 1; x < (w >> 1); x++) { P(x, -4, P1.ivy[1 + (x % 2 ? 1 : 0)]); if (x % 3 === 0) P(x, -5, [P1.red[0], P1.gold[0], P1.white[0]][((x + 30) / 3 | 0) % 3]); } },
  hay(P, r = 7) { PR.ell(P, 0, -r, r, r * 0.9, (x, y, a, b) => P1.straw[a < -0.3 && b < -0.2 ? 0 : a > 0.4 || b > 0.5 ? 2 : (bhash(x, y, 241) < 0.2 ? 2 : 1)]); },
  sunflower(P, h = 16) { PR.rect(P, 0, -h, 0, 0, P1.grass[1]); P(1, -h / 2 | 0, P1.grass[2]); P(-1, -(h * 0.7) | 0, P1.grass[2]); PR.ell(P, 0, -h, 3.2, 3.2, (x, y, a, b) => (a * a + b * b < 0.25 ? P1.beam[2] : P1.gold[(x + y) % 2 ? 0 : 1])); },
  pumpkin(P) { PR.ell(P, 0, -2.5, 3.5, 2.8, (x, y, a, b) => (x % 3 === 0 ? P1.tileR[2] : a < -0.3 && b < -0.2 ? P1.gold[1] : P1.tileR[1])); P(0, -6, P1.grass[2]); },
  barrow(P) { PR.rect(P, -5, -5, 4, -3, P1.plank[1]); PR.rect(P, -5, -6, 4, -6, P1.plank[0]); PR.rect(P, 4, -4, 8, -4, P1.plank[2]); P(-4, -2, P1.plank[3]); PR.ell(P, 1, -1, 2.2, 2.2, (x, y, a, b) => (a * a + b * b > 0.5 ? P1.plank[3] : P1.iron[1])); P(-3, -7, P1.red[0]); P(-1, -7, P1.gold[0]); P(1, -7, P1.grass[0]); },
  pennant(P, h = 12, R = P1.red) { PR.rect(P, 0, -h, 0, 0, P1.beam[2]); for (let y = -h; y < -h + 4; y++) { const len = 6 - (y + h) * 1.5; for (let x = 1; x <= len; x++) P(x, y, R[x > len - 1 ? 1 : 0]); } P(0, -h - 1, P1.gold[1]); },
  banner(P, R = P1.red, w = 5, h = 8) { for (let y = 0; y < h; y++) { const hw = Math.round(w / 2 * (1 - y / h)); for (let x = -hw; x <= hw; x++) P(x, y, R[x === hw ? 1 : 0]); } PR.rect(P, -w / 2 - 1, 0, w / 2 + 1, 0, P1.beam[2]); },
  ladder(P, h = 20) { for (let y = -h; y <= 0; y++) { P(-2, y, P1.plank[2]); P(2, y, P1.plank[3]); if (((y + h) % 4) === 2) { P(-1, y, P1.plank[1]); P(0, y, P1.plank[1]); P(1, y, P1.plank[1]); } } },
  logs(P) { for (let r = 0; r < 2; r++) for (let k = 0; k < 4 - r; k++) PR.ell(P, k * 4 + r * 2, -2 - r * 3.4, 2, 1.8, (x, y, a, b) => (a * a + b * b > 0.55 ? P1.log[3] : a * a + b * b < 0.15 ? P1.log[0] : P1.log[a < 0 ? 1 : 2])); },
  bell(P) { PR.rect(P, -1, -4, 1, -2, P1.gold[1]); PR.rect(P, -2, -1, 2, -1, P1.gold[2]); P(0, -5, P1.iron[2]); P(-1, -3, P1.gold[0]); P(0, 0, P1.gold[2]); },
  mushroom(P, r = 3, R = P1.red) { PR.rect(P, -1, -r + 1, 0, 0, P1.cloth[1]); PR.ell(P, 0, -r, r, r * 0.7, (x, y, a, b) => (b > 0.6 ? null : R[a < -0.3 && b < -0.2 ? 0 : a > 0.4 ? 2 : 1])); P(0, -r - 1, P1.white[0]); P(-2, -r, P1.white[0]); },
};

// --- кровли ×1, уточнение: чёткая черепица (плитка 5×4), дранка, солома своих оттенков ---
function m1Tile2(R) {
  // черепица «монах-монашка»: плитка 6×5, выпуклая (слева блик, справа тень), нахлёст рядов со щелью, разброс тона по плиткам
  return (u, v, F) => {
    const k = L1(F);
    if (v < 3) return p1(R, v < 1 ? 1 + k : 2 + k);                  // коньковая черепица
    const vv0 = v - 3, row = Math.floor(vv0 / 5), st = row % 2 ? 3 : 0, tu = (((u + st) % 6) + 6) % 6, vv = ((vv0 % 5) + 5) % 5;
    const id = Math.floor((u + st) / 6), h = bhash(id, row, 281);
    if (vv === 4) return tu === 0 ? R[3] : p1(R, 2 + k + (tu > 3 ? 1 : 0));   // тень-нахлёст под рядом
    if (tu === 0) return R[3];                                        // шов
    let i = tu === 1 ? 0 : tu <= 3 ? 1 : 2;                           // выпуклость плитки
    if (vv === 0 && tu < 4) i -= 1;                                   // блик на кромке
    if (h < 0.15) i += 1; else if (h > 0.9) i -= 1;                   // старая/новая плитка
    if (h > 0.97 && vv > 0 && vv < 3) return P1.moss ? p1(BP.moss, 1 + k, 3) : p1(R, 2);   // редкий мох
    return p1(R, i + k);
  };
}
function m1Shingle(R) {
  return (u, v, F) => {
    const row = Math.floor(v / 3), st = row % 2 ? 2 : 0, tu = (((u + st) % 4) + 4) % 4, vv = ((v % 3) + 3) % 3, k = L1(F);
    if (v < 2) return p1(R, 2 + k);
    const h = bhash(Math.floor((u + st) / 4), row, 251);
    if (vv === 2) return p1(R, (tu === 0 || tu === 3) ? 2 + k : 3);  // скруглённый низ пластины
    if (tu === 0) return p1(R, 2 + k);
    if (vv === 0 && h > 0.5) return p1(R, 0 + k);
    return p1(R, (h < 0.15 ? 0 : h < 0.93 ? 1 : 2) + k);
  };
}
function m1Straw2(R) {
  return (u, v, F) => {
    const k = L1(F), c = Math.floor(u / 2), h = bhash(c, 0, 261), t = v / F.L;
    if (v > F.L) { if (v > F.L + 1 + (h < 0.5 ? 1 : 0)) return null; return p1(R, 3); }
    let i = h < 0.25 ? 0 : h < 0.8 ? 1 : 2;
    const course = (v + Math.floor(h * 3)) % 8;
    if (course === 0) i += 1; else if (course === 7) i -= 1;        // слои соломы
    if (bhash(c, 1, 262) < 0.06) i += 1;                            // борозда
    if (t > 0.78) i += 1; if (t < 0.12) i -= 1;
    if (F.cap && v < 3) i = v < 1 ? 0 : 2;                          // конёк: валик с прутьями
    if (F.cap && v < 3 && v >= 1 && ((u % 6) + 6) % 6 === 0) i = 3;
    return p1(R, i + k);
  };
}
const STRAW1 = {   // солома трактира — четыре своих оттенка (не золотая, как у склада и школы)
  rye: bramp(['#eab874', '#cc9050', '#a46a32', '#744822']),      // ржаная, рыже-медовая
  olive: bramp(['#cfc784', '#a8a25c', '#807a3c', '#565226']),    // оливковая, старая
  wheat: bramp(['#f6e6a6', '#d8c676', '#b09a4c', '#7c6c30']),    // светлая пшеничная
  reed: bramp(['#c4a070', '#a07c4e', '#7a5c34', '#523c20']),     // камышовая, тёмная
};
const SHINGLE1 = bramp(['#b48a5c', '#8e6840', '#6c4c2c', '#48321c']);

// Солома объёмная: 4-тоновый градиент конёк→свес с дизерингом, курсы слоями (блик сверху, тень снизу),
// пряди колонками, валик конька, толстый свес с торцами (материал cut — m1StrawCut)
function m1Straw3(R) {
  return (u, v, F) => {
    const k = L1(F), L = F.L, t = v / L, c = Math.floor(u / 2), h = bhash(c, 0, 271);
    if (v > L) { const len = 1 + (bhash(c, 1, 272) * 2 | 0); if (v > L + len) return null; return p1(R, 3); }
    // базовый тон по положению на скате, с дизерингом между зонами
    let i = t + (bdith(u, v) - 0.5) * 0.35 < 0.22 ? 0 : t + (bdith(u, v) - 0.5) * 0.35 < 0.62 ? 1 : 2;
    // пряди: часть колонок светлее/темнее
    if (h < 0.18) i -= 1; else if (h > 0.84) i += 1;
    // курсы: слой каждые 7 px, сверху блик, снизу тень
    const cv = (v + Math.floor(bhash(Math.floor(u / 6), 0, 273) * 3)) % 7;
    if (cv === 0) i -= 1; else if (cv === 6) i += 1; else if (cv === 5 && bhash(u, v, 274) < 0.5) i += 1;
    if (bhash(c, 2, 275) < 0.05 && cv > 1) i += 2;                                  // глубокая борозда
    if (F.cap && v < 4) { i = v < 1 ? 0 : v < 3 ? 1 : 2; if (v >= 1 && v < 3 && ((u % 5) + 5) % 5 === 0) i = 3; }   // валик конька с прутьями
    return p1(R, i + k);
  };
}
function m1StrawCut(R) { return (u, v, F) => (v > F.T - 1 ? p1(R, 1) : ((u + (v | 0)) % 3 === 0 ? p1(R, 3) : p1(R, 2 + (bhash(u, v, 276) < 0.3 ? 1 : 0)))); }
STRAW1.olive = bramp(['#d8d08c', '#aeaa60', '#84803e', '#585424']);

// Чешуя крупная: пластины 6×5, полукруглый низ с тёмной каймой, блик слева сверху, тень справа, разброс тона
function m1Scale2(R) {
  return (u, v, F) => {
    const k = L1(F);
    if (v < 3) return p1(R, v < 1 ? 1 + k : 2 + k);
    const w = v - 3, row = Math.floor(w / 5), st = row % 2 ? 3 : 0, tu = (((u + st) % 6) + 6) % 6, vv = ((w % 5) + 5) % 5;
    const id = Math.floor((u + st) / 6), h = bhash(id, row, 311);
    const d = Math.hypot(tu - 2.5, Math.max(0, vv - 1.5) * 1.6);       // скругление нижнего края
    if (d > 3.2) return p1(R, 1 + k);                                  // зазор — виден ряд ниже
    if (d > 2.4) return R[3];                                          // кайма пластины
    let i = tu < 2 && vv < 2 ? 0 : tu > 3 || vv > 2 ? 2 : 1;
    if (h < 0.15) i += 1; else if (h > 0.9) i -= 1;
    return p1(R, i + k);
  };
}
