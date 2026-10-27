'use strict';
// Побочное задание «Жаба в камышах» (акт 3) и союзник Жабьен (акты 3–4): жаболюд-охотник, чьё болото гоблины Шныря
// подорвали порохом. Взяли в колонну — ходит за героем и метает дротики во врагов кампании рядом с ним.
// Вид — по рисунку владельца: оливковая жаба в буром капюшоне, с кривым посохом. Гоблины его не замечают (их цель — гномы), поэтому погибнуть он не может: это помощник, а не ещё один подопечный.
// Состояние — Game.camp.zb { x, y, face, mv, ph, cd, said } (пишется в сохранение, в коопе уходит в зеркало);
// перешёл ли он в акт 4 — наследие a3.zhab.

if (typeof CAMP_WHO !== 'undefined') CAMP_WHO.zhab = { name: 'Жабьен', ch: 'Ж', col: '#8ad0f0', bg: '#142a34' };

// свой вид для рисунка: как охотник по размеру тени, но кадры — свои (frogart.js, каста Z: капюшон, посох, обмотки)
if (typeof NSPEC !== 'undefined' && NSPEC.ftB && !NSPEC.ftZ) NSPEC.ftZ = Object.assign({}, NSPEC.ftB, { name: 'Жабьен' });

const ZB = { spd: 3.4, near: 2.2, rng: 6.5, cd: 2.1, dmg: [4, 7] };
const ZB_BARK = ['Ква! Дротик — в цель!', 'Это за болото!', 'Мокро тебе? Будет мокрее!', 'Ква-ква — и мимо… шучу, в лоб.', 'Порох — громче. Дротик — точнее!'];

function campZbJoin(C, x, y) {
  const s = (typeof randomFreeNear === 'function' && randomFreeNear(Math.floor(x), Math.floor(y), 0, 4)) || [Math.floor(x), Math.floor(y)];
  C.zb = { x: s[0] + 0.5, y: s[1] + 0.5, face: 1, mv: 0, ph: 0, cd: 1, said: 0 };
}

// угощение: хлеб со своих складов (сколько найдётся)
function campZbFeed(n) {
  for (const b of Game.buildings) {
    if (n <= 0) break;
    if (b.removed || b.foreign || !b.isStore || !b.isStore()) continue;
    const k = Math.min(n, Math.max(0, b.stock.bread || 0));
    b.stock.bread -= k; n -= k;
  }
}

function campZbTick(C, dt) {
  const Z = C.zb;
  if (!Z || !dt) return;
  const h = campHero(), now = Game.time;
  // за героем, чуть позади; отстал далеко (герой в доме, вернулся из другой части карты) — догоняет прыжком
  if (h && !h.inside) {
    const tx = h.x - (h.face || 1) * 1.4, ty = h.y + 0.6, dx = tx - Z.x, dy = ty - Z.y, d = Math.hypot(dx, dy);
    if (d > 28) { Z.x = tx; Z.y = ty; Z.mv = 0; }
    else if (d > ZB.near) {
      const st = Math.min(d, ZB.spd * (d > 8 ? 1.6 : 1) * dt);
      Z.x += dx / d * st; Z.y += dy / d * st; Z.mv = 1; Z.ph += st * 2.2;
      if (Math.abs(dx) > 0.05) Z.face = dx > 0 ? 1 : -1;
      Z.vf = dy > Math.abs(dx) * 0.7 ? 1 : 0;                  // идёт к зрителю — лицом (анфас), иначе боком
    } else Z.mv = 0;
  } else Z.mv = 0;
  // дротики: ближайший враг кампании в пределах броска; в поединок (Кремень, Чемпион) не лезет — там честно один на один
  Z.cd -= dt;
  if (Z.cd > 0) return;
  let tg = null, bd = ZB.rng;
  for (const N of Game.raiders || []) {
    if (N.st === 'die' || N.st === 'vanish' || N.st === 'emerge' || N.halt || N.ctag === 'duel' || (typeof foeLive === 'function' && !foeLive(N))) continue;
    const d = Math.hypot(N.x - Z.x, N.y - Z.y);
    if (d < bd) { bd = d; tg = N; }
  }
  if (!tg) { Z.cd = 0.4; return; }
  Z.cd = ZB.cd;
  Z.face = tg.x >= Z.x ? 1 : -1; Z.vf = 0;
  if (Game.dshots) Game.dshots.push({ x: Z.x, y: Z.y - 0.5, gx: tg.x, gy: tg.y - 0.5, born: now, dur: 0.28, k: 'dart' });
  if (typeof sfxAt === 'function') sfxAt('ftDart', Z.x * TILE, Z.y * TILE, 0.6);
  if (typeof DEF_KILLER !== 'undefined' && typeof foeHit === 'function') {
    DEF_KILLER.x = Z.x; DEF_KILLER.y = Z.y;
    foeHit(tg, DEF_KILLER, ZB.dmg[0] + Math.random() * (ZB.dmg[1] - ZB.dmg[0]));
  }
  if (!(Z.said > now - 14)) { Z.said = now; floater(Z.x, Z.y - 2.2, ZB_BARK[(Math.random() * ZB_BARK.length) | 0], '#8ad0f0'); }
}

// рисунок: жаболюд Жабьен (frogart.js, вид ftZ) с подписью-именем; Zo — другой Жабьен (сидит в камышах до встречи)
function campZbDraw(list, c, x0, y0, x1, y1, Zo) {
  const Z = Zo || (Game.camp && Game.camp.zb);
  if (!Z || typeof neuDraw !== 'function' || typeof NSPEC === 'undefined' || !NSPEC.ftZ) return;
  if (Z.x < x0 - 2 || Z.x > x1 + 2 || Z.y < y0 - 2 || Z.y > y1 + 3) return;
  list.push([Z.y + 0.1, () => {
    const N = { k: 'ftZ', id: 7707, x: Z.x, y: Z.y, face: Z.face, vf: Z.vf || 0, st: Z.mv ? 'roam' : 'idle', ph: Z.ph || 0, hp: 1, mhp: 1, dt: 0, winT: 0 };
    N.fr = typeof neuFrame === 'function' ? neuFrame(N) : 'i0';
    neuDraw(c, N);
    c.save();
    c.font = 'bold 9px sans-serif'; c.textAlign = 'center';
    const px = Math.round(Z.x * TILE), py = Math.round(Z.y * TILE) - 46;
    c.fillStyle = 'rgba(10,8,4,0.7)'; c.fillText('Жабьен', px + 1, py + 1);
    c.fillStyle = '#8ad0f0'; c.fillText('Жабьен', px, py);
    c.restore();
  }]);
}
