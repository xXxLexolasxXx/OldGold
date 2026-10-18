'use strict';
// Поиск пути A* по клеткам, 8 направлений. Дороги дешевле — по ним ходят быстрее.

function isWalkable(x, y) {
  if (!inb(x, y)) return false;
  const i = idx(x, y), t = World.terrain[i];
  if (t === T_WATER || t === T_ROCK) return false;
  if (World.bmap[i]) return false;
  const o = World.obj[i];
  if (o && o.t === 'stone') return false;
  return true;
}

function stepCost(i) {
  if (World.road[i]) return 0.6;
  const o = World.obj[i];
  if (o && o.t === 'tree') return 1.5;
  return 1;
}

const PF = {
  g: new Float32Array(N_TILES),
  from: new Int32Array(N_TILES),
  seen: new Int32Array(N_TILES),
  closed: new Int32Array(N_TILES),
  stamp: 0,
  reg: new Int32Array(N_TILES),   // метки связных областей проходимых клеток (0 — непроходимо)
  regT: -1e9, regN: 0,
  hF: new Float64Array(4096), hI: new Int32Array(4096),   // двоичная куча открытого списка, растёт по надобности
  q: new Int32Array(N_TILES),     // очередь заливок
};
// проходимость клетки по индексу — то же, что isWalkable, без проверки границ (её делает вызывающий)
function walkIdx(i) {
  const t = World.terrain[i];
  if (t === T_WATER || t === T_ROCK || World.bmap[i]) return false;
  const o = World.obj[i];
  return !(o && o.t === 'stone');
}
function pfResize() {
  PF.g = new Float32Array(N_TILES); PF.from = new Int32Array(N_TILES);
  PF.seen = new Int32Array(N_TILES); PF.closed = new Int32Array(N_TILES); PF.stamp = 0;
  PF.reg = new Int32Array(N_TILES); PF.regT = -1e9; PF.q = new Int32Array(N_TILES);
}

const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
const DX8 = [1, -1, 0, 0, 1, 1, -1, -1], DY8 = [0, 0, 1, -1, 1, -1, 1, -1], DM8 = [1, 1, 1, 1, 1.414, 1.414, 1.414, 1.414];

// Заливка проходимых клеток от точки; возвращает метку для PF.closed.
function floodFrom(sx, sy) {
  const st = ++PF.stamp;
  const W = MAP_W, N = N_TILES, closed = PF.closed, q = PF.q;
  if (!inb(sx, sy)) return st;
  let qh = 0, qt = 0;
  const s = idx(sx, sy);
  closed[s] = st; q[qt++] = s;
  // стартовая клетка может быть непроходимой (дверь склада) — заливаем от неё, как и раньше
  while (qh < qt) {
    const c = q[qh++], cx = c % W;
    if (cx + 1 < W && closed[c + 1] !== st && walkIdx(c + 1)) { closed[c + 1] = st; q[qt++] = c + 1; }
    if (cx > 0 && closed[c - 1] !== st && walkIdx(c - 1)) { closed[c - 1] = st; q[qt++] = c - 1; }
    if (c + W < N && closed[c + W] !== st && walkIdx(c + W)) { closed[c + W] = st; q[qt++] = c + W; }
    if (c - W >= 0 && closed[c - W] !== st && walkIdx(c - W)) { closed[c - W] = st; q[qt++] = c - W; }
  }
  return st;
}

function reachedIn(st, x, y) { return inb(x, y) && PF.closed[idx(x, y)] === st; }

// Связные области (4 соседа — ровно та связность, что у путей без срезания углов).
// Пересчёт не чаще раза в 2 с игрового времени: если цель в другой области, A* не обходит
// всю карту впустую (раньше так зверь за рекой подвешивал шаг на 70+ мс).
// Устаревшая метка «та же область» лишь стоит времени, «другая» — живёт не дольше 2 с.
function pfRegions() {
  if (Game.time - PF.regT < 2 && Game.time >= PF.regT) return;
  PF.regT = Game.time;
  const reg = PF.reg, W = MAP_W, N = N_TILES, walk = walkIdx;
  reg.fill(0);
  const q = PF.q;
  let n = 0;
  for (let s = 0; s < N; s++) {
    if (reg[s] || !walk(s)) continue;
    const lab = ++n;
    let qh = 0, qt = 0;
    q[qt++] = s; reg[s] = lab;
    while (qh < qt) {
      const c = q[qh++], cx = c % W;
      if (cx + 1 < W && !reg[c + 1] && walk(c + 1)) { reg[c + 1] = lab; q[qt++] = c + 1; }
      if (cx > 0 && !reg[c - 1] && walk(c - 1)) { reg[c - 1] = lab; q[qt++] = c - 1; }
      if (c + W < N && !reg[c + W] && walk(c + W)) { reg[c + W] = lab; q[qt++] = c + W; }
      if (c - W >= 0 && !reg[c - W] && walk(c - W)) { reg[c - W] = lab; q[qt++] = c - W; }
    }
  }
  PF.regN = n;
}
// Заведомо недостижимо (по меткам областей)? Старт на непроходимой клетке (в дверях, у стены) — не знаем.
function pfApart(s, t) {
  pfRegions();
  const a = PF.reg[s], b = PF.reg[t];
  return a && b && a !== b;
}

// Возвращает массив [x, y] без стартовой клетки или null.
// road — идти только по дорогам (цель может быть клеткой рядом с дорогой);
// selfId — обходить клетки, занятые другими курьерами;
// limit — сколько клеток можно раскрыть (звери не ищут путь через полкарты), hw — вес эвристики.
function findPath(sx, sy, tx, ty, road = false, selfId = 0, limit = 0, hw = 0.6) {
  if (!isWalkable(tx, ty)) return null;
  if (sx === tx && sy === ty) return [];
  if (!inb(sx, sy)) return null;
  const W = MAP_W, H = MAP_H;
  const s = sy * W + sx, target = ty * W + tx;
  if (pfApart(s, target)) return null;
  const ter = World.terrain, bm = World.bmap, obj = World.obj, rd = World.road, occ = World.occ;
  const g = PF.g, from = PF.from, seen = PF.seen, closed = PF.closed;
  // проходимость клетки по индексу (координаты проверяет вызывающий)
  const walk = i => { const t = ter[i]; if (t === T_WATER || t === T_ROCK || bm[i]) return false; const o = obj[i]; return !(o && o.t === 'stone'); };
  const ok = road ? i => walk(i) && (rd[i] === 1 || i === target) : walk;
  const st = ++PF.stamp;
  let hF = PF.hF, hI = PF.hI, hn = 0;
  const push = (f, i) => {
    if (hn === hF.length) {
      const nF = new Float64Array(hn * 2), nI = new Int32Array(hn * 2);
      nF.set(hF); nI.set(hI); PF.hF = hF = nF; PF.hI = hI = nI;
    }
    let n = hn++;
    while (n > 0) {
      const p = (n - 1) >> 1;
      if (hF[p] <= f) break;
      hF[n] = hF[p]; hI[n] = hI[p];
      n = p;
    }
    hF[n] = f; hI[n] = i;
  };
  const pop = () => {
    const top = hI[0];
    hn--;
    if (hn > 0) {
      const lf = hF[hn], li = hI[hn];
      let n = 0;
      for (;;) {
        const l = 2 * n + 1, r = l + 1;
        let m = n, mf = lf;
        if (l < hn && hF[l] < mf) { m = l; mf = hF[l]; }
        if (r < hn && hF[r] < mf) m = r;
        if (m === n) break;
        hF[n] = hF[m]; hI[n] = hI[m];
        n = m;
      }
      hF[n] = lf; hI[n] = li;
    }
    return top;
  };
  const h = (x, y) => {
    const dx = x > tx ? x - tx : tx - x, dy = y > ty ? y - ty : ty - y;
    return hw * (dx > dy ? dx + 0.414 * dy : dy + 0.414 * dx);
  };

  seen[s] = st; g[s] = 0; from[s] = -1;
  push(h(sx, sy), s);
  let opened = 0;
  while (hn) {
    const cur = pop();
    if (closed[cur] === st) continue;
    closed[cur] = st;
    if (cur === target) break;
    if (limit && ++opened > limit) break;
    const cx = cur % W, cy = (cur / W) | 0, gc = g[cur];
    for (let d = 0; d < 8; d++) {
      const dx = DX8[d], dy = DY8[d], nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      if (closed[ni] === st || !ok(ni)) continue;
      // по диагонали: вне дорог — не срезая углы; по дороге хватает одного свободного угла
      // (так же считаются дорожные сети, иначе курьер видит дом в сети, но не может дойти)
      if (d >= 4) {
        const a = cy * W + nx, b = ny * W + cx;   // соседние клетки по горизонтали и вертикали (всегда в карте)
        if (road ? !walk(a) && !walk(b) : !ok(a) || !ok(b)) continue;
      }
      let c = rd[ni] ? 0.6 : 1;
      if (c === 1) { const o = obj[ni]; if (o && o.t === 'tree') c = 1.5; }
      if (selfId) { const o = occ[ni]; if (o && o !== selfId) c += 2.5; }
      const ng = gc + DM8[d] * c;
      if (seen[ni] !== st || ng < g[ni]) {
        seen[ni] = st; g[ni] = ng; from[ni] = cur;
        push(ng + h(nx, ny), ni);
      }
    }
  }
  if (closed[target] !== st) return null;
  const path = [];
  for (let c = target; c !== s; c = from[c]) path.push([c % W, (c / W) | 0]);
  path.reverse();
  return path;
}
