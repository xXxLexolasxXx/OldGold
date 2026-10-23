'use strict';
// Бот забега для тестов (tests/runsim-test.js, кооп-комнаты): ходит по клеткам к врагу/сундуку/лестнице, бьёт, поднимает товарищей.
const R = require('../../js/run/runsim.js');
const STICKY = new WeakMap();
function bfsDir(S, h, tx, ty) {
  const T = R.RS_T, W = R.RS_W, H = R.RS_H, si = Math.floor(h.x / T), sj = Math.floor(h.y / T), ti = Math.floor(tx / T), tj = Math.floor(ty / T);
  if (si === ti && sj === tj) return [tx - h.x, ty - h.y];
  const prev = new Int32Array(W * H).fill(-1), q = [sj * W + si]; prev[q[0]] = q[0];
  for (let k = 0; k < q.length; k++) {
    const c = q[k]; if (c === tj * W + ti) break;
    const ci = c % W, cj = (c / W) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = ci + di, nj = cj + dj, n = nj * W + ni;
      if (ni < 0 || nj < 0 || ni >= W || nj >= H || prev[n] >= 0 || !S.map[n]) continue;
      prev[n] = c; q.push(n);
    }
  }
  let c = tj * W + ti; if (prev[c] < 0) return [tx - h.x, ty - h.y];
  while (prev[c] !== sj * W + si && prev[c] !== c) c = prev[c];
  return [((c % W) + 0.5) * T - h.x, (((c / W) | 0) + 0.5) * T - h.y];
}
function botInput(S, i) {
  const h = S.heroes[i];
  if (h.down || h.gone) return null;
  const down = S.heroes.find(o => o.down && !o.gone);
  let tgt = null, bd = 1e18;
  for (const e of S.enemies) if (e.hp > 0) { const d = (e.x - h.x) ** 2 + (e.y - h.y) ** 2; if (d < bd) { bd = d; tgt = e; } }
  // цель держим, пока жива и не появился кто-то совсем рядом, — иначе бот мечется между двумя равноудалёнными врагами
  const keep = STICKY.get(h);
  if (keep && keep.hp > 0 && S.enemies.includes(keep) && bd > 30 * 30) { tgt = keep; bd = (keep.x - h.x) ** 2 + (keep.y - h.y) ** 2; }
  if (tgt) STICKY.set(h, tgt);
  if (down && (!tgt || bd > 40 * 40)) tgt = down;           // поднять товарища, если рядом нет драки
  if (!tgt) { const ch = S.props.find(q => q.k === 'chest' && !q.used); tgt = ch || S.stairs; }
  let [dx, dy] = bfsDir(S, h, tgt.x, tgt.y);
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  if (tgt.hp > 0 && bd < 12 * 12) { dx = 0; dy = 0; }         // стоит и бьёт
  const mx = Math.round(dx / d * 8), my = Math.round(dy / d * 8);
  return { mx, my, dash: h.hp < h.max * 0.4 && h.dashCd <= 0 && bd < 20 * 20, slam: h.slamCd <= 0 && bd < 30 * 30 };
}
// играет забег ботами и пишет запись так же, как dungeon.js
function play(opts, maxMin) {
  const S = R.rsNew(opts), rec = [], last = S.heroes.map(() => [0, 0]);
  const PREF = ['beard', 'blade', 'hands', 'flask', 'boots', 'dash'];
  while (!S.over && S.step < 60 * 60 * (maxMin || 30)) {
    if (S.pick) {
      S.heroes.forEach((h, i) => { if (S.pick && S.pick.got[i] == null) { const o = S.pick.opts[i]; let k = 0; for (const p of PREF) { const j = o.indexOf(p); if (j >= 0) { k = j; break; } } rec.push([S.step, i, 3, k]); R.rsChoose(S, i, k); } });
      continue;
    }
    const inp = [];
    S.heroes.forEach((h, i) => {
      const b = botInput(S, i); if (!b) return;
      if (b.mx !== last[i][0] || b.my !== last[i][1]) { rec.push([S.step, i, 0, b.mx, b.my]); last[i] = [b.mx, b.my]; }
      if (b.dash) rec.push([S.step, i, 1]);
      if (b.slam) rec.push([S.step, i, 2]);
      inp[i] = { mx: b.mx / 8, my: b.my / 8, dash: b.dash, slam: b.slam };
    });
    R.rsStep(S, inp); S.ev.length = 0;
  }
  return { S, rec };
}
module.exports = { botInput, play, bfsDir };
