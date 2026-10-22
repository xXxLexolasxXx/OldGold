'use strict';
// Голем по временам года, руны и барьер Малгора: своя пиксель-графика поверх каменного тела (golem.js).
// Весной на нём цветочки, летом густой мох и грибы, осенью жухлые листья, зимой лёд и иней.
// Руны (лес, шахта, вода) — светящиеся плитки на карте; барьер — дрожащий лиловый купол вокруг шпиля.

const GL_FLOWER = ['#ff8fb8', '#fff4f0', '#ffd84a', '#c9a6ff'];
const GL_LEAF = ['#c8561a', '#e0902a', '#a83a1a', '#d8b040', '#7a4a1a'];
const GL_ICE = ['#cfe8f8', '#eaf6ff', '#8fbfe0', '#ffffff'];
const GL_RUNE_COL = { forest: '#7be06a', mine: '#ffb04a', water: '#6ac8ff' };
const GL_RUNE_NAME = { forest: 'лесная', mine: 'шахтная', water: 'водная' };

// Места на теле, куда садятся украшения: плечи, голова, грудь, пояс
function golemSpots(view, P, sx, bob, kx) {
  const E = view === 'E', hx = sx + (E ? 7 : 0) + P.head.dx, hy = -67 + bob + P.head.dy;
  return {
    sh: [[-31 * kx + sx, -54 + bob], [31 * kx + sx, -54 + bob]],
    head: [hx, hy],
    chest: [sx + (E ? 2 : 0), -51 + bob],
    belly: [sx * 0.8, -40 + bob],
    hip: [sx * 0.5, -29 + bob],
  };
}

function glFlower(c, x, y, col) {
  for (const [dx, dy] of [[-1.3, 0], [1.3, 0], [0, -1.3], [0, 1.3]]) ellipse(c, x + dx, y + dy, 1.3, 1.1, col);
  c.fillStyle = '#e0a020'; c.fillRect(x - 0.6, y - 0.6, 1.2, 1.2);
}
function glLeaf(c, x, y, a, col) {
  const dx = Math.cos(a) * 2.6, dy = Math.sin(a) * 2.6;
  poly(c, [[x - dx, y - dy], [x - dy * 0.55, y + dx * 0.55], [x + dx, y + dy], [x + dy * 0.55, y - dx * 0.55]], col, rgba('#3a2410', 0.7), 0.5);
}
function glShard(c, x, y, h, w, col) {
  poly(c, [[x - w, y], [x, y - h], [x + w, y], [x + w * 0.2, y + 1.2]], col, rgba('#4a7aa0', 0.85), 0.5);
  poly(c, [[x - w * 0.6, y - h * 0.15], [x - w * 0.1, y - h * 0.85], [x + w * 0.1, y - h * 0.2]], rgba('#ffffff', 0.7));
}

function golemDeco(c, view, P, sx, bob, kx) {
  const S = golemSpots(view, P, sx, bob, kx), r = mulberry32(4242 + GL_SEA * 31), N = view === 'N';
  const around = (p, rx, ry, n, a0, a1, fn) => { for (let k = 0; k < n; k++) { const a = a0 + (a1 - a0) * ((k + 0.3 + r() * 0.4) / n); fn(p[0] + Math.cos(a) * rx * (0.7 + r() * 0.3), p[1] + Math.sin(a) * ry * (0.7 + r() * 0.3), k); } };
  const TOP = [Math.PI * 1.05, Math.PI * 1.95];
  if (GL_SEA === 3) {                          // весна: цветочки на плечах, макушке, груди и поясе
    for (const p of S.sh) around(p, 13, 10, 4, TOP[0], TOP[1], (x, y, k) => glFlower(c, x, y, GL_FLOWER[(r() * 4) | 0]));
    around(S.head, 11, 9, 4, TOP[0], TOP[1], (x, y) => glFlower(c, x, y, GL_FLOWER[(r() * 4) | 0]));
    if (!N) around(S.chest, 24, 8, 5, Math.PI * 0.05, Math.PI * 0.95, (x, y) => glFlower(c, x, y - 4, GL_FLOWER[(r() * 4) | 0]));
    around(S.hip, 14, 6, 3, Math.PI * 0.1, Math.PI * 0.9, (x, y) => glFlower(c, x, y - 2, GL_FLOWER[(r() * 4) | 0]));
  } else if (GL_SEA === 0) {                   // лето: густой мох, лозы и грибы-мухоморы
    for (const p of [...S.sh, S.chest, S.belly, S.hip]) around(p, 16, 9, 5, TOP[0] - 0.4, TOP[1] + 0.4, (x, y) => ellipse(c, x, y, 3 + r() * 3, 1.8 + r() * 1.4, GL_MOSS[(r() * 4) | 0]));
    around(S.head, 11, 8, 5, TOP[0], TOP[1], (x, y) => ellipse(c, x, y, 2.6 + r() * 2, 1.6 + r(), GL_MOSS[(r() * 4) | 0]));
    for (let k = 0; k < 6; k++) { const x = sx + (r() - 0.5) * 50 * kx, y = -60 + bob + r() * 6; line(c, x, y, x + (r() - 0.5) * 3, y + 7 + r() * 9, GL_MOSS[(r() * 3) | 0], 1.1); }
    for (const [p, dx] of [[S.sh[0], 3], [S.sh[1], -2], [S.hip, 6]]) {
      const x = p[0] + dx, y = p[1] - 12 + (p === S.hip ? 8 : 0);
      c.fillStyle = '#e8e0cc'; c.fillRect(x - 0.7, y, 1.4, 3);
      ellipse(c, x, y, 3, 1.9, '#c8321e'); c.fillStyle = '#fff4e0'; c.fillRect(x - 1.4, y - 1, 1, 1); c.fillRect(x + 0.6, y - 0.5, 1, 1);
    }
  } else if (GL_SEA === 1) {                   // осень: жухлые листья и сухие плети
    for (const p of [...S.sh, S.chest, S.belly]) around(p, 16, 9, 5, TOP[0] - 0.3, TOP[1] + 0.3, (x, y) => glLeaf(c, x, y, r() * 6.28, GL_LEAF[(r() * 5) | 0]));
    around(S.head, 11, 8, 4, TOP[0], TOP[1], (x, y) => glLeaf(c, x, y, r() * 6.28, GL_LEAF[(r() * 5) | 0]));
    for (let k = 0; k < 5; k++) { const x = sx + (r() - 0.5) * 50 * kx, y = -60 + bob + r() * 6; line(c, x, y, x + (r() - 0.5) * 3, y + 6 + r() * 8, '#6a4a22', 1); }
  } else {                                     // зима: ледяные кристаллы, иней, сосульки
    for (const p of S.sh) around(p, 13, 10, 4, TOP[0], TOP[1], (x, y) => glShard(c, x, y + 3, 6 + r() * 6, 2 + r() * 1.2, GL_ICE[(r() * 3) | 0]));
    around(S.head, 11, 9, 3, TOP[0] + 0.2, TOP[1] - 0.2, (x, y) => glShard(c, x, y + 3, 5 + r() * 5, 1.8 + r(), GL_ICE[(r() * 3) | 0]));
    for (const p of [S.chest, S.belly, S.hip]) around(p, 18, 8, 4, TOP[0] - 0.5, TOP[1] + 0.5, (x, y) => { c.globalAlpha = 0.7; ellipse(c, x, y, 3 + r() * 3, 1.6 + r(), '#f2f8fc'); c.globalAlpha = 1; });
    for (let k = 0; k < 6; k++) { const x = sx + (r() - 0.5) * 56 * kx, y = -57 + bob + r() * 5; poly(c, [[x - 0.9, y], [x + 0.9, y], [x, y + 4 + r() * 5]], rgba('#d4ecfa', 0.9)); }
  }
}

// ---------- Частицы вокруг голема (по времени, без состояния) ----------

function golemAura(c, g) {
  if (golemDorm()) return;
  const cx = (g.fx + 1.5) * TILE, cy = (g.fy + 2) * TILE - 10, t = Game.time || 0;
  const sea = GL_SEA, n = sea === 2 ? 5 : 7;
  for (let k = 0; k < n; k++) {
    const ph = (t * (sea === 0 ? 0.35 : 0.22) + k / n) % 1, wob = Math.sin(ph * 9 + k * 2.1);
    const x = cx + (k / n - 0.5) * 100 + wob * 6, y = cy - 96 + ph * 100;
    if (sea === 3) { c.fillStyle = `rgba(255,170,200,${0.8 * (1 - ph)})`; c.fillRect(Math.round(x), Math.round(y), 2, 2); }
    else if (sea === 1) { c.fillStyle = `rgba(214,120,40,${0.85 * (1 - ph)})`; c.fillRect(Math.round(x), Math.round(y), 3, 2); }
    else if (sea === 2) { c.fillStyle = `rgba(240,248,255,${0.8 * (1 - ph)})`; c.fillRect(Math.round(x), Math.round(y), 2, 2); }
    else { c.fillStyle = `rgba(130,230,90,${0.7 * Math.sin(ph * Math.PI)})`; c.fillRect(Math.round(cx + Math.cos(k * 1.9 + t) * 58), Math.round(cy - 20 - ph * 60), 2, 2); }
  }
}

// ---------- Руны ----------

function drawRune(c, r) {
  const px = (r.x + 0.5) * TILE, py = (r.y + 0.5) * TILE, t = Game.time || 0, col = GL_RUNE_COL[r.k], pul = 0.5 + 0.5 * Math.sin(t * 2.4 + r.x);
  c.fillStyle = 'rgba(10,8,4,0.3)'; c.beginPath(); c.ellipse(px, py + 5, 11, 4, 0, 0, 7); c.fill();
  c.globalAlpha = 0.18 + 0.2 * pul; c.fillStyle = col; c.beginPath(); c.ellipse(px, py - 2, 17 + 3 * pul, 11 + 2 * pul, 0, 0, 7); c.fill(); c.globalAlpha = 1;
  poly(c, [[px - 7, py + 3], [px - 5, py - 9], [px + 5, py - 9], [px + 7, py + 3]], '#6e695d', '#26221f', 1);     // плитка
  poly(c, [[px - 5, py - 9], [px + 5, py - 9], [px + 4, py - 6], [px - 4, py - 6]], '#9a9486');
  c.strokeStyle = col; c.lineWidth = 1.4; c.globalAlpha = 0.6 + 0.4 * pul; c.beginPath();
  if (r.k === 'forest') { c.moveTo(px, py + 1); c.lineTo(px, py - 7); c.moveTo(px, py - 3); c.lineTo(px - 3, py - 6); c.moveTo(px, py - 4); c.lineTo(px + 3, py - 7); }
  else if (r.k === 'mine') { c.moveTo(px - 3, py + 1); c.lineTo(px, py - 7); c.lineTo(px + 3, py + 1); c.lineTo(px - 3, py - 4); c.lineTo(px + 3, py - 4); }
  else { c.moveTo(px - 4, py - 5); c.quadraticCurveTo(px - 2, py - 8, px, py - 5); c.quadraticCurveTo(px + 2, py - 2, px + 4, py - 5); c.moveTo(px - 4, py - 1); c.quadraticCurveTo(px - 2, py - 4, px, py - 1); c.quadraticCurveTo(px + 2, py + 2, px + 4, py - 1); }
  c.stroke(); c.globalAlpha = 1;
  for (let k = 0; k < 3; k++) { const ph = (t * 0.5 + k / 3 + r.x * 0.13) % 1; c.fillStyle = rgba(col, 0.9 * (1 - ph)); c.fillRect(Math.round(px - 8 + k * 8 + Math.sin(ph * 6) * 2), Math.round(py - 8 - ph * 16), 2, 2); }
}

// ---------- Барьер ----------

function drawBarrier(c, F) {
  const G = Game.glq, age = Game.time - (G.bar || -99);
  if (age > 9) return;
  const k = 1 - age / 9, cx = (F.tx + 1.5) * TILE, cy = (F.ty - 1) * TILE, R = GL_BARRIER * TILE, t = Game.time;
  c.save(); c.translate(cx, cy); c.scale(1, 0.72);
  c.lineWidth = 2.4; c.strokeStyle = `rgba(190,120,255,${0.75 * k})`; c.beginPath();
  for (let a = 0; a <= 64; a++) { const th = a / 64 * Math.PI * 2, rr = R * (1 + 0.012 * Math.sin(th * 14 + t * 9)); const X = Math.cos(th) * rr, Y = Math.sin(th) * rr; a ? c.lineTo(X, Y) : c.moveTo(X, Y); }
  c.stroke();
  c.fillStyle = `rgba(140,70,220,${0.1 * k})`; c.beginPath(); c.arc(0, 0, R, 0, 7); c.fill();
  // вспышка в месте удара
  if (G.barX != null) {
    const a = Math.atan2((G.barY - (F.ty - 1)) / 0.72, G.barX - (F.tx + 1.5)), hx = Math.cos(a) * R, hy = Math.sin(a) * R;
    c.fillStyle = `rgba(235,200,255,${0.8 * k})`; c.beginPath(); c.arc(hx, hy, 16 + 10 * Math.sin(age * 12), 0, 7); c.fill();
    for (let s = 0; s < 7; s++) { const q = a + (s - 3) * 0.07; c.fillStyle = `rgba(255,255,255,${0.7 * k})`; c.fillRect(Math.cos(q) * R - 1, Math.sin(q) * R - 1 - ((age * 30 + s * 9) % 24), 2, 6); }
  }
  c.restore();
}

// ---------- Подключение к списку отрисовки ----------

{
  const _dl = golemDrawList;
  golemDrawList = function (list, c, x0, y0, x1, y1) {
    _dl(list, c, x0, y0, x1, y1);
    const g = Game.golem, G = Game.glq;
    if (g && !(g.fx + 6 < x0 || g.fx - 4 > x1 || g.fy + 4 < y0 || g.fy - 6 > y1)) list.push([g.fy + 1.8, () => golemAura(c, g)]);
    if (!G) return;
    const heroes = Game.units.filter(u => u.type === 'hero' && !u.dead);
    for (const r of G.runes) {
      if (!r || r.got || r.x < x0 - 1 || r.x > x1 + 1 || r.y < y0 - 1 || r.y > y1 + 1) continue;
      if (!G.known && !heroes.some(h => Math.hypot(h.x - r.x, h.y - r.y) < 14)) continue;       // пока не знаем про руны — видны только вблизи героя
      list.push([r.y + 0.6, () => drawRune(c, r)]);
    }
    const F = Game.foe;
    if (F && G.bar && Game.time - G.bar < 9) list.push([F.ty + 8, () => drawBarrier(c, F)]);
  };
}
