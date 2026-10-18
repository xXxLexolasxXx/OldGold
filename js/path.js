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
};
function pfResize() {
  PF.g = new Float32Array(N_TILES); PF.from = new Int32Array(N_TILES);
  PF.seen = new Int32Array(N_TILES); PF.closed = new Int32Array(N_TILES); PF.stamp = 0;
}

const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];

// Заливка проходимых клеток от точки; возвращает метку для PF.closed.
function floodFrom(sx, sy) {
  const st = ++PF.stamp;
  const q = [idx(sx, sy)];
  PF.closed[q[0]] = st;
  for (let k = 0; k < q.length; k++) {
    const c = q[k], cx = c % MAP_W, cy = (c / MAP_W) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = cx + DIRS[d][0], ny = cy + DIRS[d][1];
      if (!isWalkable(nx, ny)) continue;
      const ni = idx(nx, ny);
      if (PF.closed[ni] === st) continue;
      PF.closed[ni] = st;
      q.push(ni);
    }
  }
  return st;
}

function reachedIn(st, x, y) { return inb(x, y) && PF.closed[idx(x, y)] === st; }

// Возвращает массив [x, y] без стартовой клетки или null.
// road — идти только по дорогам (цель может быть клеткой рядом с дорогой);
// selfId — обходить клетки, занятые другими курьерами.
function findPath(sx, sy, tx, ty, road = false, selfId = 0) {
  if (!isWalkable(tx, ty)) return null;
  if (sx === tx && sy === ty) return [];
  const target0 = idx(tx, ty);
  const ok = road
    ? (x, y) => isWalkable(x, y) && (World.road[idx(x, y)] === 1 || idx(x, y) === target0)
    : isWalkable;
  const cost = selfId
    ? i => { const o = World.occ[i]; return stepCost(i) + (o && o !== selfId ? 2.5 : 0); }
    : stepCost;
  const st = ++PF.stamp;
  const hF = [], hI = [];
  const push = (f, i) => {
    let n = hF.length; hF.push(f); hI.push(i);
    while (n > 0) {
      const p = (n - 1) >> 1;
      if (hF[p] <= hF[n]) break;
      [hF[p], hF[n]] = [hF[n], hF[p]]; [hI[p], hI[n]] = [hI[n], hI[p]];
      n = p;
    }
  };
  const pop = () => {
    const top = hI[0];
    const lf = hF.pop(), li = hI.pop();
    if (hF.length) {
      hF[0] = lf; hI[0] = li;
      let n = 0;
      for (;;) {
        const l = 2 * n + 1, r = l + 1;
        let m = n;
        if (l < hF.length && hF[l] < hF[m]) m = l;
        if (r < hF.length && hF[r] < hF[m]) m = r;
        if (m === n) break;
        [hF[m], hF[n]] = [hF[n], hF[m]]; [hI[m], hI[n]] = [hI[n], hI[m]];
        n = m;
      }
    }
    return top;
  };
  const h = (x, y) => {
    const dx = Math.abs(x - tx), dy = Math.abs(y - ty);
    return 0.6 * (Math.max(dx, dy) + 0.414 * Math.min(dx, dy));
  };

  const s = idx(sx, sy), target = idx(tx, ty);
  PF.seen[s] = st; PF.g[s] = 0; PF.from[s] = -1;
  push(h(sx, sy), s);
  while (hF.length) {
    const cur = pop();
    if (PF.closed[cur] === st) continue;
    PF.closed[cur] = st;
    if (cur === target) break;
    const cx = cur % MAP_W, cy = (cur / MAP_W) | 0;
    for (const [dx, dy, m] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (!ok(nx, ny)) continue;
      // по диагонали: вне дорог — не срезая углы; по дороге хватает одного свободного угла
      // (так же считаются дорожные сети, иначе курьер видит дом в сети, но не может дойти)
      if (dx && dy && (road
        ? !isWalkable(cx + dx, cy) && !isWalkable(cx, cy + dy)
        : !ok(cx + dx, cy) || !ok(cx, cy + dy))) continue;
      const ni = idx(nx, ny);
      if (PF.closed[ni] === st) continue;
      const ng = PF.g[cur] + m * cost(ni);
      if (PF.seen[ni] !== st || ng < PF.g[ni]) {
        PF.seen[ni] = st; PF.g[ni] = ng; PF.from[ni] = cur;
        push(ng + h(nx, ny), ni);
      }
    }
  }
  if (PF.closed[target] !== st) return null;
  const path = [];
  for (let c = target; c !== s; c = PF.from[c]) path.push([c % MAP_W, (c / MAP_W) | 0]);
  path.reverse();
  return path;
}
