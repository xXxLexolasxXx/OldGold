'use strict';
// Дополнение набора под референсы владельца (27.10): чешуйчатая черепица, плющ, полосатый навес, дым,
// деревья, подсолнухи, кадки, стог, тачка, тыква, уличные фонари, вывески «череп»/«фонарь», каменный подиум.

BP.tileR = bramp(['#f0905e', '#d66a44', '#b84c32', '#902e22', '#6a1e18', '#44120e']);     // сочная красная черепица
BP.tileD = bramp(['#b85048', '#9a3a34', '#7c2a26', '#5e1e1c', '#421414', '#2a0c0c']);     // тёмно-красная
BP.scale = bramp(['#8ab8f0', '#5a8cd8', '#3e68b4', '#2c4c8c', '#1e3464', '#142244']);     // синяя чешуя
BP.slateD = bramp(['#6e7484', '#565c6c', '#424856', '#323744', '#242832', '#181b22']);    // тёмный сланец
BP.dark = bramp(['#7a5a44', '#5e4434', '#483426', '#36261c', '#261a12', '#180e08']);      // тёмное дерево (ночная таверна)
BP.ivy = bramp(['#a8d860', '#7cb444', '#548c30', '#386420']);
BP.smoke = bramp(['#e8e6e0', '#c4c2bc', '#9a9894', '#707070']);

// Чешуйчатая черепица: ряды полукруглых пластин внахлёст
function matScale(R, rh = 9, tw = 10) {
  return (u, v, F) => {
    let row = Math.floor(v / rh), st = row % 2 ? tw / 2 : 0, uu = ((u + st) % tw + tw) % tw, vv = v - row * rh;
    const arc = rh - (tw / 2 - Math.sqrt(Math.max(0, (tw / 2) ** 2 - (uu - tw / 2) ** 2)));
    let edge = false;
    if (vv > arc) { row += 1; st = row % 2 ? tw / 2 : 0; uu = ((u + st) % tw + tw) % tw; vv = v - row * rh; }
    else if (vv > arc - 1.5) edge = true;
    let i = F.li;
    const h = bhash(Math.floor((u + st) / tw), row, 141); if (h < 0.18) i -= 1; else if (h > 0.8) i += 1;
    if (edge) i += 2; else if (vv < 1.5 && vv >= 0) i -= 1;
    if (Math.abs(uu - tw / 2) > tw / 2 - 1.2 && vv < arc - 1.5) i += 1;
    if (v / F.L > 0.82) i += 1;
    return R[bcl(i)];
  };
}
// Плющ поверх материала: пятна листвы с рваным краем; patches — [{u, v, rx, ry}] в пикселях сетки ската
function matIvy(base, patches, R = BP.ivy) {
  return (u, v, F) => {
    for (const p of patches) {
      const d = Math.hypot((u - p.u) / p.rx, (v - p.v) / p.ry) + (bhash(Math.floor(u / 3), Math.floor(v / 3), 151) - 0.5) * 0.5;
      if (d < 1) {
        const leaf = bhash(Math.floor((u + v) / 3), Math.floor((v - u) / 3), 152);
        return R[bcl(F.li + (leaf < 0.3 ? 0 : leaf < 0.8 ? 1 : 2) + (d > 0.75 ? 1 : 0), 3)];
      }
    }
    return base(u, v, F);
  };
}
// Полосатый тент (красный/белый), с лёгкими складками
function matAwning(A = BP.red, B = BP.white, sw = 10) {
  return (u, v, F) => { const k = Math.floor(u / sw), R = k % 2 ? B : A, fold = ((u % sw) + sw) % sw < 1.5 ? 1 : 0; return R[bcl(F.li + fold + (v > F.L - 3 ? 1 : 0), 3)]; };
}
// Дым из трубы: клубы, редеющие кверху (дизеринг)
function propSmoke(P, h = 44) {
  for (let k = 0; k < 5; k++) {
    const t = k / 4, cx = Math.round(Math.sin(k * 1.3) * 7 + t * 10), cy = -8 - Math.round(t * h), r = 7 + k * 2.6;
    PR.ell(P, cx, cy, r, r * 0.8, (x, y, a, b) => (a * a + b * b < 0.55 || bdith(x, y) < 1 - t * 0.7 ? BP.smoke[a < -0.3 && b < 0 ? 0 : a > 0.4 || b > 0.5 ? 2 : 1] : null));
  }
}
// Дерево круглое: ствол и ярусы кроны
function propTree(P, r = 22, R = BP.grass) {
  PR.rect(P, -3, -r, 2, 0, BP.beam[1]); PR.rect(P, -1, -r, 0, 0, BP.beam[0]);
  for (const [cx, cy, rr, sh] of [[0, -r - 4, r, 2], [-r * 0.4, -r - 8, r * 0.6, 1], [r * 0.35, -r - 2, r * 0.6, 1], [-r * 0.1, -r - r * 0.5, r * 0.55, 0]]) {
    PR.ell(P, cx, cy, rr, rr * 0.85, (x, y, a, b) => { const e = a * a + b * b; const leaf = bhash(Math.floor(x / 3), Math.floor(y / 3), 161); return R[bcl(sh + (e > 0.7 ? 1 : 0) + (a > 0.3 || b > 0.4 ? 1 : 0) - (a < -0.3 && b < -0.2 && leaf < 0.5 ? 1 : 0), 3)]; });
  }
}
// Подсолнух
function propSunflower(P, h = 30) {
  PR.rect(P, 0, -h, 0, 0, BP.green[1]); PR.rect(P, 1, -h * 0.5, 4, -h * 0.5 + 1, BP.green[1]); PR.rect(P, -4, -h * 0.7, -1, -h * 0.7 + 1, BP.green[2]);
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; PR.rect(P, Math.round(Math.cos(a) * 6), -h + Math.round(Math.sin(a) * 6), Math.round(Math.cos(a) * 7), -h + Math.round(Math.sin(a) * 7), BP.gold[k % 3 === 0 ? 0 : 1]); }
  PR.ell(P, 0, -h, 3.5, 3.5, (x, y, a, b) => (a < -0.3 && b < -0.3 ? BP.beam[0] : BP.beam[2]));
}
// Кадка-ящик с цветами
function propPlanter(P, w = 18) { PR.rect(P, -w / 2, -7, w / 2, 0, BP.plank[2]); PR.rect(P, -w / 2, -7, w / 2, -7, BP.plank[0]); PR.rect(P, -w / 2, 0, w / 2, 0, BP.plank[4]); for (let x = -w / 2; x <= w / 2; x += 3) PR.rect(P, x, -6, x, -1, BP.plank[3]); propFlowers((x, y, c) => P(x - w / 2 + 2, y - 7, c), w - 4); }
// Стог сена
function propHay(P, r = 14) { PR.ell(P, 0, -r, r, r * 0.9, (x, y, a, b) => { let i = a < -0.3 && b < -0.2 ? 0 : a > 0.4 || b > 0.5 ? 2 : 1; if (bhash(x, y, 171) < 0.25) i += 1; return BP.straw[bcl(i)]; }); PR.rect(P, -r * 0.5, -r * 1.6, r * 0.5, -r * 1.55, BP.straw[3]); }
// Тачка с овощами
function propBarrow(P) { PR.rect(P, -10, -10, 8, -4, BP.plank[2]); PR.rect(P, -10, -11, 8, -11, BP.plank[0]); PR.rect(P, 8, -8, 16, -7, BP.plank[3]); PR.rect(P, -9, -4, -8, 0, BP.plank[3]); PR.ell(P, 3, -2, 4, 4, (x, y, a, b) => (a * a + b * b > 0.55 ? BP.plank[3] : BP.iron[1])); for (const [cx, R] of [[-6, BP.red], [-1, BP.gold], [4, BP.green]]) PR.ell(P, cx, -13, 3, 2.5, (x, y, a, b) => R[b < -0.3 ? 0 : 1]); }
// Тыква
function propPumpkin(P, r = 6) { PR.ell(P, 0, -r * 0.8, r, r * 0.8, (x, y, a, b) => { let i = a < -0.3 && b < -0.2 ? 0 : a > 0.4 || b > 0.5 ? 2 : 1; if (Math.abs(((x + 100) % 4) - 2) < 0.5) i += 1; return [BP.gold[1], BP.tileR[1], BP.tileR[3], BP.tileR[4]][bcl(i, 3)]; }); PR.rect(P, 0, -r * 1.6 - 2, 1, -r * 1.6, BP.green[2]); }
// Уличный фонарь на столбе с ореолом
function propStreetLamp(P, h = 40) { PR.rect(P, 0, -h, 1, 0, BP.iron[2]); PR.rect(P, -2, -2, 3, 0, BP.iron[2]); PR.rect(P, -3, -h - 10, 4, -h, BP.iron[2]); PR.rect(P, -2, -h - 8, 3, -h - 1, BP.glass[1]); P(0, -h - 5, BP.glass[0]); P(1, -h - 5, BP.glass[0]); PR.rect(P, -1, -h - 12, 2, -h - 11, BP.iron[1]); for (let y = -h - 16; y <= -h + 4; y++) for (let x = -10; x <= 11; x++) { const d = Math.hypot(x - 0.5, (y + h + 5) * 1.1); if (d < 10 && d > 4 && bdith(x, y) < 1 - d / 10) P(x, y, BP.gold[0]); } }
// Камни у дорожки
function propStones(P) { for (const [cx, cy, r] of [[0, 0, 4], [7, -2, 3], [-6, -1, 3], [3, -5, 2.5]]) PR.ell(P, cx, cy, r, r * 0.7, (x, y, a, b) => BP.stone[b < -0.3 ? 1 : a > 0.4 ? 3 : 2]); }
// Вывески: череп, круглый фонарь на кронштейне — расширение propSign
const _propSign = propSign;
propSign = function (P, kind, dir = 1, w = 22, h = 18) {
  if (kind === 'skull') {
    _propSign(P, 'none', dir, w, h);
    const x0 = dir > 0 ? 4 : -4 - w, cx = x0 + w / 2, cy = -h / 2;
    PR.ell(P, cx, cy - 1, 5, 5, (x, y, a, b) => (b > 0.5 && Math.abs(a) > 0.45 ? null : BP.white[a > 0.4 || b > 0.4 ? 1 : 0]));
    PR.rect(P, cx - 3, cy - 2, cx - 2, cy - 1, BP.ink); PR.rect(P, cx + 1, cy - 2, cx + 2, cy - 1, BP.ink); PR.rect(P, cx - 1, cy + 1, cx, cy + 1, BP.ink);
    PR.rect(P, cx - 3, cy + 3, cx + 3, cy + 3, BP.white[1]); for (let x = cx - 3; x <= cx + 3; x += 2) P(x, cy + 4, BP.white[1]);
    return;
  }
  if (kind === 'lamp') {
    PR.rect(P, Math.min(0, dir * 10), -h - 4, Math.max(0, dir * 10), -h - 3, BP.iron[1]);
    const cx = dir * 9; PR.rect(P, cx, -h - 3, cx, -h, BP.iron[2]);
    PR.ell(P, cx, -h + 6, 6, 6, (x, y, a, b) => (a * a + b * b > 0.75 ? BP.iron[2] : a < -0.3 && b < -0.3 ? BP.glass[0] : BP.glass[1]));
    PR.rect(P, cx - 2, -h - 1, cx + 2, -h, BP.iron[1]); PR.rect(P, cx - 1, -h + 12, cx + 1, -h + 13, BP.iron[2]);
    return;
  }
  _propSign(P, kind, dir, w, h);
};
// Каменный подиум со ступенями спереди (stepX — центр ступеней)
function plinth(g, x0, x1, y0, y1, h, stepX, stepW) {
  const st = matStone(BP.stone, 14, 8), tp = matStone(BP.stone, 12, 10);
  box(g, { x0, x1, y0, y1, h, mat: st, top: (u, v, F) => tp(u, v, Object.assign({}, F, { h: 0 })) });
  for (let k = 0; k < 3; k++) { const d = 3.2; box(g, { x0: stepX - stepW / 2 + k * 2, x1: stepX + stepW / 2 - k * 2, y0: y0 - d * (3 - k), y1: y0 - d * (2 - k) + 0.2, h: h * (k + 1) / 3, mat: st, top: matFlat(BP.stone[1]) }); }
}
// Перила: столбики и две жерди вдоль X (y фиксирован) или вдоль Y
function railing(g, x0, x1, y0, y1, z0, h = 8, R = BP.plank) {
  const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / 9));
  for (let k = 0; k <= n; k++) box(g, { x0: x0 + (x1 - x0) * k / n - 0.8, x1: x0 + (x1 - x0) * k / n + 0.8, y0: y0 + (y1 - y0) * k / n - 0.8, y1: y0 + (y1 - y0) * k / n + 0.8, z0, h, mat: (u, v, F) => R[F.li === 0 ? 1 : 3], top: matFlat(R[1]) });
  for (const z of [h - 1.4, h * 0.45]) box(g, { x0: Math.min(x0, x1) - 0.6, x1: Math.max(x0, x1) + 0.6, y0: Math.min(y0, y1) - 0.6, y1: Math.max(y0, y1) + 0.6, z0: z0 + z, h: 1.4, mat: (u, v, F) => R[F.li === 0 ? 0 : 2], top: matFlat(R[0]) });
}
// Доска-вывеска по центру (на фронтон): без кронштейна, с рисунком kind
function propBoard(P, kind, w = 28, h = 20) {
  const x0 = -w / 2, y0 = -h / 2;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { let i = 1; if (x === x0 || x === x0 + w - 1 || y === y0 || y === y0 + h - 1) i = 4; else if (x === x0 + 1 || y === y0 + 1) i = 0; else if ((y - y0) % 6 === 0) i = 2; P(x, y, BP.plank[i]); }
  for (const [x, y] of [[x0 + 2, y0 + 2], [x0 + w - 3, y0 + 2], [x0 + 2, y0 + h - 3], [x0 + w - 3, y0 + h - 3]]) P(x, y, BP.iron[1]);
  const Q = (x, y, c) => P(x, y, c);
  if (kind === 'skull') {
    PR.ell(Q, 0, -1, 5, 5, (x, y, a, b) => (b > 0.5 && Math.abs(a) > 0.45 ? null : BP.white[a > 0.4 || b > 0.4 ? 1 : 0]));
    PR.rect(Q, -3, -2, -2, -1, BP.ink); PR.rect(Q, 1, -2, 2, -1, BP.ink); PR.rect(Q, -1, 1, 0, 1, BP.ink);
    PR.rect(Q, -3, 3, 3, 3, BP.white[1]); for (let x = -3; x <= 3; x += 2) P(x, 4, BP.white[1]);
    PR.line(Q, -9, 7, -5, 3, BP.white[1], 2); PR.line(Q, 9, 7, 5, 3, BP.white[1], 2); PR.line(Q, -9, -7, -6, -4, BP.white[1], 2); PR.line(Q, 9, -7, 6, -4, BP.white[1], 2);
  } else if (kind === 'mug') { PR.rect(Q, -5, -3, 3, 6, BP.gold[1]); PR.rect(Q, -5, -3, -5, 6, BP.gold[2]); PR.rect(Q, 4, -1, 6, 3, BP.gold[2]); PR.rect(Q, -6, -7, 4, -4, BP.white[0]); PR.rect(Q, -4, -8, 1, -8, BP.white[0]); P(-2, -9, BP.white[0]); }
}
// Материал из рисунка-плаката: draw(P) рисует вокруг (0,0) (y вверх отрицательно); грань w×h в пикселях сетки
function spriteMat(w, h, draw) {
  const buf = new Map();
  draw((x, y, c) => { if (c) buf.set(x + ',' + y, c); });
  return (u, v) => buf.get(Math.round(u - w / 2) + ',' + Math.round(h / 2 - v)) || null;
}
