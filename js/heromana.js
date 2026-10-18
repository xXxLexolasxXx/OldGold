'use strict';
// Мана героя и боевые заклинания (одиночная игра), поверх herolife.js:
// · мана (макс. 12 + 3·Смекалка) и банки маны в котомке (товар «mana» со склада, +25 маны за банку, до 4);
// · Огненный шар [F] — летит в ближайшего скелета или ходячую нечисть: скелет рассыпается, дерево загорается, камень и водяной отступают;
// · Лечение [E] — это малое лечение из herolife.js (бесплатное): тут оно ещё снимает раны у гномов в 5 клетках;
// · Оберег [C] — гонит призраков, пугает скелетов и нечисть, 20 с не даёт призракам студить ману;
// · выпить банку [G]; призрак вплотную студит ману (−3), пока не включён оберег;
// · скелет, схвативший героя, ранит его (−16 здоровья), а не уносит в могилу.
// Клавиши: Q занята классовым ударом гильдий (guilds.js), поэтому шар — на F.
// Всё хранится в hero.hero (mana, jars, cdFire, cdWard, wardUntil). В кооперативе (Game.coop) не работает.

const HM_JAR_MANA = 25, HM_JARS_MAX = 4;
const HM_SPELLS = {
  fire: { name: 'Огненный шар', lvl: 1, cost: 10, cd: 6, cdk: 'cdFire', key: 'F', desc: 'сжигает ближайшего скелета или нечисть' },
  ward: { name: 'Оберег', lvl: 3, cost: 12, cd: 25, cdk: 'cdWard', key: 'C', desc: 'гонит призраков, пугает скелетов' },
};
const hmMax = H => 12 + 3 * heroStats(H).int;

{
  const _hd = heroDefaults;
  heroDefaults = function (h) {
    _hd(h);
    const m = hmMax(h);
    if (h.mana == null) h.mana = m;
    if (h.mana > m) h.mana = m;
    h.jars = h.jars || 0;
    h.mmax = m;
    return h;
  };
}

function hmBusy(H) { return !!(H.downT || H.stunUntil > Game.time || H.drunkUntil > Game.time); }

function hmDrink() {
  const u = Game.hero, H = u && u.hero;
  if (!hlOn() || !H || hmBusy(H)) return false;
  const m = hmMax(H);
  if (H.jars <= 0) { floater(u.x, u.y - 1.5, 'Нет банок маны', '#e8a070'); return false; }
  if (H.mana >= m - 1) { floater(u.x, u.y - 1.5, 'Мана и так полна', '#9ec8ff'); return false; }
  H.jars--; H.mana = Math.min(m, H.mana + HM_JAR_MANA);
  floater(u.x, u.y - 1.5, `+${HM_JAR_MANA} маны`, '#6ab0ff');
  fxBurst(u.x * TILE, u.y * TILE - 12, 8, ['#80c0ff', '#c0e0ff'], 35, 40, 0.6, 1.5, -20);
  sfxAt('chime', u.x * TILE, u.y * TILE, 0.6);
  return true;
}

// ---------- Склад: банки маны и снаряжение ----------

const hmFree = (b, g) => Math.max(0, (b.stock[g] || 0) - ((b.reserved && b.reserved[g]) || 0));

function* hmSupplyGen(u, c) {
  const b = c.b, H = u.hero;
  const ok = yield { walk: [b.doorX, b.doorY] };
  if (!ok || b.removed) return;
  yield { enter: b };
  yield { wait: 0.8 };
  const j = Math.min(HM_JARS_MAX - H.jars, hmFree(b, 'mana'));
  const parts = [];
  if (j > 0) { b.stock.mana -= j; H.jars += j; parts.push(`${j} банк. маны`); }
  const gk = hlGearIn(b);
  if (gk) {
    if (hlAddItem(H, gk, 1)) { b.stock[gk]--; parts.push(hlName(gk)); }
    else parts.push('рюкзак полон');
  }
  floater(u.x, u.y - 1.4, parts.length ? 'Взял: ' + parts.join(', ') : 'Нечего брать', '#c8e0ff');
  yield { leave: true };
}

// ---------- Заклинания ----------

function hmFoe(u, r) {
  let best = null, bd = r;
  for (const s of Game.skels || []) {
    if (s.k < 0.5 || s.state === 'dead' || s.state === 'sink') continue;
    const d = Math.hypot(s.x - u.x, s.y - u.y);
    if (d < bd) { bd = d; best = { kind: 'skel', o: s }; }
  }
  for (const e of Game.ents || []) {
    if (!(e.state === 'walk' || e.state === 'smash' || e.state === 'fight') || e.k <= 0.5 || e.burnT) continue;
    const d = Math.hypot(e.x - u.x, e.y - u.y);
    if (d < bd) { bd = d; best = { kind: 'ent', o: e }; }
  }
  return best;
}

function hmBolt(sx, sy, tx, ty, col, done) { (Game.hfx || (Game.hfx = [])).push({ x: sx, y: sy, tx, ty, col, done }); }

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

function hmCast(k) {
  const u = Game.hero, S = HM_SPELLS[k], H = u && u.hero;
  if (!hlOn() || !H || !S || u.dead) return;
  if (hmBusy(H)) { toast(`${H.name} сейчас не в том состоянии, чтобы колдовать`); return; }
  if (H.level < S.lvl) { floater(u.x, u.y - 1.6, `С уровня ${S.lvl}`, '#e8a070'); return; }
  if ((H[S.cdk] || 0) > Game.time) return;
  if (H.mana < S.cost && H.jars > 0) hmDrink();
  if (H.mana < S.cost) { floater(u.x, u.y - 1.6, 'Не хватает маны', '#8ab8ff'); return; }
  if (k === 'fire') {
    const f = hmFoe(u, 9);
    if (!f) { floater(u.x, u.y - 1.6, 'Нет цели', '#e8a070'); return; }
    u.face = f.o.x > u.x ? 1 : -1; u.vdir = 'E';
    if (!u.inside) u.hfx = { k: 'win0', t: Game.time + 0.55 };      // поднял оружие — колдует (кадр из herokit/people)
    sfxAt('crackle', u.x * TILE, u.y * TILE, 0.9);
    hmBolt(u.x, u.y, f.o.x, f.o.y, ['#fff0a0', '#ff9a30', '#e04a18'], () => {
      const o = f.o;
      fxBurst(o.x * TILE, o.y * TILE - 10, 22, ['#fff0a0', '#ff9a30', '#e04a18'], 90, 60, 0.7, 2.2, 160);
      if (f.kind === 'skel') {
        if (o.state === 'dead' || o.state === 'sink') return;
        o.state = 'dead'; o.t = 0; o.resolved = true; o.moving = false;
        sfxAt('rattle', o.x * TILE, o.y * TILE, 1.2);
        floater(o.x, o.y - 1.6, 'Клац…', '#e8e8d0');
        logEvent('tree', `${H.name} испепелил скелета огненным шаром`, o.x, o.y);
      } else if (o.rock || o.water) {
        o.target = null; o.goal = null; o.state = 'ghosted'; o.t = 0; o.gFrom = [u.x, u.y];
        floater(o.x, o.y - 1.8, 'Отступает!', '#ffd0a0');
      } else {
        o.burnT = Game.time;
        floater(o.x, o.y - 3, 'Горит!', '#ffb060');
        logEvent('tree', `${H.name} поджёг ходячее дерево`, o.x, o.y);
      }
    });
    floater(u.x, u.y - 1.6, S.name + '!', '#ffb050');
  } else if (k === 'ward') {
    let n = 0;
    for (const g of Game.ghosts || []) if (Math.hypot(g.x - u.x, g.y - u.y) < 12) { g.mode = 'leave'; g.modeT = 99; floater(g.x, g.y - 1.6, 'А-а-ай!', '#cfe6ff'); n++; }
    for (const s of Game.skels || []) if (Math.hypot(s.x - u.x, s.y - u.y) < 7 && s.state === 'roam') { s.scared = 8; s.goal = null; n++; }
    for (const e of Game.ents || []) if ((e.state === 'walk' || e.state === 'smash') && Math.hypot(e.x - u.x, e.y - u.y) < 7) {
      e.target = null; e.goal = null; e.state = 'ghosted'; e.t = 0; e.gFrom = [u.x, u.y]; n++;
    }
    H.wardUntil = Game.time + 20;
    if (!u.inside) u.hfx = { k: 'win0', t: Game.time + 0.55 };
    sfxAt('hiss', u.x * TILE, u.y * TILE, 1);
    fxBurst(u.x * TILE, u.y * TILE - 12, 30, ['#fff6c0', '#ffe070', '#ffffff'], 110, 20, 0.9, 2, 0);
    floater(u.x, u.y - 1.6, S.name + (n ? '!' : ' (никого рядом)'), '#fff0a0');
  }
  H.mana -= S.cost; H[S.cdk] = Game.time + S.cd;
  updateUI(true);
}

// ---------- Тик: мана, холод призраков ----------

function hmTick(dt) {
  if (!hlOn()) return;
  const h = Game.hero, H = h.hero, now = Game.time;
  const m = hmMax(H);
  if (H.mmax == null) H.mmax = m;
  if (m > H.mmax) { H.mana += m - H.mmax; }         // выросла Смекалка — запас маны растёт вместе с ним
  H.mmax = m;
  if (H.mana > m) H.mana = m;
  if (H.downT) return;
  if (!h.inside && H.mana < m) H.mana = Math.min(m, H.mana + m * 0.006 * dt);
  // призрак вплотную студит ману; оберег защищает
  if ((H.wardUntil || 0) < now && now >= (H.chillAt || 0)) {
    for (const g of Game.ghosts || []) if (g.alpha > 0.4 && g.mode !== 'calm' && g.mode !== 'leave' && !g.exo && Math.hypot(g.x - h.x, g.y - h.y) < 2) {
      H.mana = Math.max(0, H.mana - 3); H.chillAt = now + 1.5;
      floater(h.x, h.y - 1.5, 'Холод… −3 маны', '#9ec8ff');
      break;
    }
  }
  if (H.jars > 0 && H.mana < m * 0.2) hmDrink();
}

// ---------- Подключение ----------

{
  const _step = step;
  step = function (dt) { _step(dt); hmTick(dt); hmFxStep(dt); };

  const _rs = resetGameState;
  resetGameState = function () { _rs(); Game.hfx = []; };

  // склад с банками маны (или снаряжением) — идти и взять
  const _rc = resolveCmd;
  resolveCmd = function (t) {
    if (hlOn() && !Game.hero.dead && inb(t[0], t[1])) {
      const b = buildingAt(t), H = Game.hero.hero;
      if (b && !b.isRoad && b.state === 'done' && !b.upg && !b.removed && b.isStore && b.isStore() && !hlGhostAt(t)) {
        const jars = H.jars < HM_JARS_MAX && hmFree(b, 'mana') > 0;
        if (jars || hlGearIn(b)) return { kind: 'supply', b, tx: b.doorX, ty: b.doorY, label: jars ? 'Взять банки маны и снаряжение' : 'Взять снаряжение' };
      }
    }
    return _rc(t);
  };

  const _run = runCmd;
  runCmd = function* (u, c) {
    if (c.kind === 'supply') {
      if (u.type !== 'hero') { yield { wait: 0.8 }; return; }       // напарник на склад за банками не ходит
      yield* hmSupplyGen(u, c);
    } else {
      yield* _run(u, c);
      // в трактире и мана восстанавливается
      if (c.kind === 'tavern' && u.hero && hlOn()) {
        const H = u.hero, m = hmMax(H);
        if (H.mana < m) { H.mana = Math.min(m, H.mana + m * 0.35); floater(u.x, u.y - 1.5, 'Мана вернулась', '#9ec8ff'); }
      }
    }
  };

  const _tt = teamThink;
  teamThink = function (u) {
    const h = heroOf(u);
    if (h && h.cmd && h.cmd.kind === 'supply') { u.idleFlag = false; u.job = null; return (function* () { yield { wait: 0.8 }; })(); }
    return _tt(u);
  };

  const _ab = heroAbility;
  heroAbility = function (k) {
    if (k === 'fire' || k === 'ward') { hmCast(k); return; }
    if (k === 'drink') { hmDrink(); updateUI(true); return; }
    if (k === 'heal' && hlOn() && Game.hero && Game.hero.hero) {
      const h = Game.hero, H = h.hero, before = H.cdHeal;
      _ab(k);
      if (H.cdHeal !== before) {                      // лечение сработало — заодно раненые гномы рядом
        for (const x of Game.units) if (x !== h && !x.dead && !x.inside && x.injury && Math.hypot(x.x - h.x, x.y - h.y) < 5) { x.injury = null; x.injuryUntil = 0; floater(x.x, x.y - 1.2, 'Здоров!', '#a0ffb0'); }
      }
      return;
    }
    _ab(k);
  };

  // скелет схватил героя — рана, а не могила
  const _remove = removeUnit;
  removeUnit = function (u) {
    if (u.type === 'hero' && u.hero && !u.dead && hlOn() && u === Game.hero) {
      if ((Game.skels || []).some(s => s.fighters && s.fighters.includes(u) && s.state !== 'grab')) { hlHurt(u, 16, 'ранен скелетом'); return; }
    }
    _remove(u);
  };

  // панель героя: мана, заклинания, котомка
  const mk = _hp => function () {
    let html = _hp();
    if (!hlOn() || !Game.hero || !Game.hero.hero) return html;
    const H = Game.hero.hero, now = Game.time, m = hmMax(H), mn = Math.max(0, Math.round(H.mana));
    const manaBlock = `<div class="irow">Мана <b>${mn}/${m}</b> · банок: <b>${H.jars}</b> <button data-hero="drink" class="hp-sm" title="Выпить банку маны [G]" ${H.jars ? '' : 'disabled'}>Выпить</button></div><div class="hl-hp"><i style="width:${Math.round(100 * H.mana / m)}%;background:#4a90e8"></i></div>`;
    const cd = k => Math.max(0, Math.ceil((H[k] || 0) - now));
    const sp = k => {
      const S = HM_SPELLS[k];
      if (H.level < S.lvl) return `<div class="hp-ab off"><b>${S.name}</b><small>с уровня ${S.lvl}</small></div>`;
      const c = cd(S.cdk);
      return `<button class="hp-ab" data-hero="${k}" ${c ? 'disabled' : ''} title="${S.desc}"><b>${S.name} [${S.key}]</b><small>${c ? c + ' с' : S.cost + ' маны · ' + S.desc}</small></button>`;
    };
    html = html.replace(/(<div class="hl-hp">.*?<\/i><\/div>)/, '$1' + manaBlock);
    html = html.replace('<b>Малое лечение</b>', '<b>Малое лечение [E]</b>');
    html = html.replace('<div class="irow small muted">Рюкзак', `<div class="hp-abs">${sp('fire')}${sp('ward')}</div><div class="irow small muted">Рюкзак`);
    return html;
  };
  let hmPanel = mk(heroPanel);
  heroPanel = hmPanel;
  // другие файлы могли переустановить панель в startGame — встаём поверх последними
  const _sg = startGame;
  startGame = function () {
    _sg();
    const cur = heroPanel;
    if (cur !== hmPanel) { hmPanel = mk(cur); heroPanel = hmPanel; }
  };

  // огненный шар в полёте: светящийся комок
  const _ov = drawOverlay;
  drawOverlay = function (c) {
    _ov(c);
    for (const p of Game.hfx || []) {
      const px = p.x * TILE, py = p.y * TILE - 12, gl = c.createRadialGradient(px, py, 1, px, py, 11);
      gl.addColorStop(0, '#fffbd0'); gl.addColorStop(0.4, '#ffa030'); gl.addColorStop(1, 'rgba(230,70,20,0)');
      c.fillStyle = gl; c.beginPath(); c.arc(px, py, 11, 0, 7); c.fill();
    }
  };

  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (!hlOn() || e.ctrlKey || e.altKey || e.metaKey) return;
    if (Game.selUnit !== Game.hero) return;
    if (e.code === 'KeyF') hmCast('fire');
    else if (e.code === 'KeyC') hmCast('ward');
    else if (e.code === 'KeyE') heroAbility('heal');
    else if (e.code === 'KeyG') { hmDrink(); updateUI(true); }
  });
}
