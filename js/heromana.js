'use strict';
// Мана героя (поверх herolife.js). С 0.10.69 общих заклинаний нет: огненный шар и оберег — способности мага,
// банок маны и зелья лечения больше нет (heroabil.js: свои способности у каждого класса, лечение — отдыхом).
// Здесь осталось:
// · запас маны (макс. 12 + 3·Смекалка) — ресурс магов, друидов, жрецов и бардов; копится сам (abTick в heroabil.js),
//   в трактире возвращается треть;
// · снаряды заклинаний (огненный шар, ледяная стрела) — hmBolt: летят к цели и срабатывают по прилёту;
// · призрак вплотную студит ману (−3), пока не включён оберег мага;
// · скелет, схвативший героя, ранит его (−16 здоровья), а не уносит в могилу;
// · склад: взять снаряжение и перевязки.
// Всё хранится в hero.hero (mana, wardUntil). В кооперативе (Game.coop) не работает.

const hmMax = H => 12 + 3 * heroStats(H).int;

{
  const _hd = heroDefaults;
  heroDefaults = function (h) {
    _hd(h);
    const m = hmMax(h);
    if (h.mana == null) h.mana = m;
    if (h.mana > m) h.mana = m;
    h.mmax = m;
    return h;
  };
}

// ---------- Склад: снаряжение и перевязки ----------

const hmFree = (b, g) => Math.max(0, (b.stock[g] || 0) - ((b.reserved && b.reserved[g]) || 0));
const HM_BANDAGE_MAX = 3;                      // перевязок в рюкзаке — не больше трёх
const hmBandages = H => (H.inv || []).reduce((n, s) => n + (s && s.k === 'bandage' ? s.n : 0), 0);

function* hmSupplyGen(u, c) {
  const b = c.b, H = u.hero;
  const ok = yield { walk: [b.doorX, b.doorY] };
  if (!ok || b.removed) return;
  yield { enter: b };
  yield { wait: 0.8 };
  const parts = [];
  const j = Math.min(HM_BANDAGE_MAX - hmBandages(H), hmFree(b, 'bandage'));
  if (j > 0 && hlAddItem(H, 'bandage', j)) { b.stock.bandage -= j; parts.push(`перевязки ×${j}`); }
  const gk = hlGearIn(b);
  if (gk) {
    if (hlAddItem(H, gk, 1)) { b.stock[gk]--; if (typeof durFresh === 'function') durFresh(H, gk); parts.push(hlName(gk)); }
    else parts.push('рюкзак полон');
  }
  floater(u.x, u.y - 1.4, parts.length ? 'Взял: ' + parts.join(', ') : 'Нечего брать', '#c8e0ff');
  yield { leave: true };
}

// ---------- Снаряды заклинаний ----------

function hmBolt(sx, sy, tx, ty, col, done, kind) { (Game.hfx || (Game.hfx = [])).push({ x: sx, y: sy, tx, ty, col, done, kind: kind || 'fire' }); }

function hmFxStep(dt) {
  const L = Game.hfx;
  if (!L || !L.length) return;
  for (let i = L.length - 1; i >= 0; i--) {
    const p = L[i], dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy), st = 16 * dt;
    fxBurst(p.x * TILE, p.y * TILE - 12, 2, p.col, 18, 18, 0.35, 1.8, -40);
    if (d <= st) { L.splice(i, 1); try { p.done(); } catch (e) { /* цель пропала */ } continue; }
    p.x += dx / d * st; p.y += dy / d * st;
  }
}

// ---------- Тик: потолок маны, холод призраков ----------

function hmTick() {
  if (!hlOn()) return;
  const h = Game.hero, H = h.hero, now = Game.time;
  const m = hmMax(H);
  if (H.mmax == null) H.mmax = m;
  if (m > H.mmax) { H.mana += m - H.mmax; }         // выросла Смекалка — запас маны растёт вместе с ним
  H.mmax = m;
  if (H.mana > m) H.mana = m;
  if (H.downT) return;
  // призрак вплотную студит ману; оберег защищает
  if ((H.wardUntil || 0) < now && now >= (H.chillAt || 0) && CLS_RES[H.clsKey] === 'mana') {
    for (const g of Game.ghosts || []) if (g.alpha > 0.4 && g.mode !== 'calm' && g.mode !== 'leave' && !g.exo && Math.hypot(g.x - h.x, g.y - h.y) < 2) {
      H.mana = Math.max(0, H.mana - 3); H.chillAt = now + 1.5;
      floater(h.x, h.y - 1.5, 'Холод… −3 маны', '#9ec8ff');
      break;
    }
  }
}

// ---------- Подключение ----------

{
  const _step = step;
  step = function (dt) { _step(dt); hmTick(dt); hmFxStep(dt); };

  const _rs = resetGameState;
  resetGameState = function () { _rs(); Game.hfx = []; };

  // склад с перевязками (или снаряжением) — идти и взять
  const _rc = resolveCmd;
  resolveCmd = function (t) {
    if (hlOn() && !Game.hero.dead && inb(t[0], t[1])) {
      const b = buildingAt(t), H = Game.hero.hero;
      if (b && !b.isRoad && b.state === 'done' && !b.upg && !b.removed && b.isStore && b.isStore() && !hlGhostAt(t)) {
        const band = hmBandages(H) < HM_BANDAGE_MAX && hmFree(b, 'bandage') > 0;
        if (band || hlGearIn(b)) return { kind: 'supply', b, tx: b.doorX, ty: b.doorY, label: band ? 'Взять перевязки и снаряжение' : 'Взять снаряжение' };
      }
    }
    return _rc(t);
  };

  const _run = runCmd;
  runCmd = function* (u, c) {
    if (c.kind === 'supply') {
      if (u.type !== 'hero') { yield { wait: 0.8 }; return; }       // напарник на склад не ходит
      yield* hmSupplyGen(u, c);
    } else {
      yield* _run(u, c);
      // в трактире и мана восстанавливается
      if (c.kind === 'tavern' && u.hero && hlOn()) {
        const H = u.hero, m = hmMax(H);
        if (H.mana < m && CLS_RES[H.clsKey] === 'mana') { H.mana = Math.min(m, H.mana + m * 0.35); floater(u.x, u.y - 1.5, 'Мана вернулась', '#9ec8ff'); }
      }
    }
  };

  const _tt = teamThink;
  teamThink = function (u) {
    const h = heroOf(u);
    if (h && h.cmd && h.cmd.kind === 'supply') { u.idleFlag = false; u.job = null; return (function* () { yield { wait: 0.8 }; })(); }
    return _tt(u);
  };

  // скелет схватил героя — рана, а не могила
  const _remove = removeUnit;
  removeUnit = function (u) {
    if (u.type === 'hero' && u.hero && !u.dead && hlOn() && u === Game.hero) {
      if ((Game.skels || []).some(s => s.fighters && s.fighters.includes(u) && s.state !== 'grab')) { hlHurt(u, 16 * (typeof fsEnvMul === 'function' ? fsEnvMul(u) : 1), 'ранен скелетом'); return; }
    }
    _remove(u);
  };

  // снаряды в полёте: огненный шар — светящийся комок, ледяная стрела — голубой осколок
  const _ov = drawOverlay;
  drawOverlay = function (c) {
    _ov(c);
    for (const p of Game.hfx || []) {
      const px = p.x * TILE, py = p.y * TILE - 12, ice = p.kind === 'frost', r = ice ? 8 : 11, gl = c.createRadialGradient(px, py, 1, px, py, r);
      if (ice) { gl.addColorStop(0, '#ffffff'); gl.addColorStop(0.4, '#9ee0ff'); gl.addColorStop(1, 'rgba(60,140,230,0)'); }
      else { gl.addColorStop(0, '#fffbd0'); gl.addColorStop(0.4, '#ffa030'); gl.addColorStop(1, 'rgba(230,70,20,0)'); }
      c.fillStyle = gl; c.beginPath(); c.arc(px, py, r, 0, 7); c.fill();
    }
  };
}
