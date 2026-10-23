'use strict';
// Жнец смертен (reaper.js — облик и бродяжничество, здесь — бой). Раньше он бил героя, но сам был неуязвим и не изгонялся.
// · Здоровье растёт с ночами (600 на 3-й ночи, +50 за ночь, до 1200), сталь и стрелы вязнут в тумане (×0,6 / ×0,5),
//   огонь ×1,35, удар жреца или паладина ×1,5, изгнание и освящение ×2,2. Оглушения держит втрое короче.
// · В бою косит больно: к холоду призрака (5–8) добавляется 6 + 0,6 за ночь, в ярости ещё +2 и +4, через уклонение и щиты героя.
// · Три фазы: до ⅔ — обычная; ярость (⅔) — косит чаще и быстрее плывёт; ниже ⅓ — «рвёт завесу»: зовёт двух призраков.
// · Изгнание нежити, оберег, «Чудо», освящение не прогоняют его, а ранят светом («Сопротивляется!»). С рассветом уходит сам.
// · Пока его не тронули, он не враг для отряда: рекруты и герой сами не лезут (ночи и дефициты прежние).
//   Первый удар героя (клик, способность) — и жнец бьётся с обидчиком, в том числе с рекрутами.
// · Победа: золото, опыт герою и тем, кто рядом, гномы в 14 клетках воодушевлены, две ночи жнецы обходят деревню.
// · Полоса здоровья над ним с отметками фаз; сейв — счёт побед, «передышка» и показанная подсказка; кооп — поля жнеца
//   (hp, mhp, ph3) уходят клиентам в списке ghosts, считает сервер.
// Подключается после heroult.js: обёртки поверх врагов гильдий, способностей и ульт.

const RPF = {
  HP0: 600, HP_NIGHT: 50, HP_MAX: 1200,
  EL: { sacred: 2.2, holy: 1.5, fire: 1.35, frost: 1, nature: 0.8, blunt: 0.7, steel: 0.6, pierce: 0.5 },
  CD: [0, 3.4, 2.7, 2.1],        // перезарядка взмаха косой по фазам
  SPD: [0, 1.15, 1.4, 1.6],
  FORGET: 25,                    // через столько секунд без ударов жнец забывает обидчика
  REST: 2,                       // ночей без жнецов после победы
  wide: false,
  trace: null,                   // массив — тесты собирают сюда, откуда пришёл урон                   // во время способности героя жнец — законная цель, даже нетронутый
};

const rpMaxHp = () => Math.min(RPF.HP_MAX, RPF.HP0 + RPF.HP_NIGHT * Math.max(0, nightIndex() - 2));
function rpInit(g) {
  if (g.mhp == null) { g.mhp = rpMaxHp(); g.hp = g.mhp; g.ph3 = 1; }
  return g;
}
const rpVisible = g => g && g.kind === 'reaper' && !g.slain && g.rev !== false && g.alpha >= 0.35 && g.mode !== 'leave' && (Game.ghosts || []).includes(g);
const rpProv = g => Game.time - (g.prov || -99) < RPF.FORGET;
const rpAll = () => (Game.ghosts || []).filter(rpVisible);

// ---------- Урон ----------
function rpHurt(g, u, dmg, el, src) {
  if (!rpVisible(g)) return;
  rpInit(g);
  const k = RPF.EL[el] || 0.7;
  dmg = Math.max(1, dmg * k);
  g.hp -= dmg; g.prov = Game.time;
  if (RPF.trace) RPF.trace.push([src || '?', el, dmg]);
  if (u && !u.dead) g.tg = u.id;
  const px = g.x * TILE, py = g.y * TILE - 22;
  fxBurst(px, py, 8, el === 'holy' || el === 'sacred' ? ['#fff6c0', '#ffe070', '#ffffff'] : el === 'fire' ? ['#fff0a0', '#ff9a30', '#e04a18'] : ['#bfe0ff', '#6fd0b0', '#2a3a44'], 60, 40, 0.5, 1.6, 120);
  floater(g.x, g.y - 2.2, '−' + Math.round(dmg), k > 1 ? '#ffd070' : '#c8d8ff');
  if (k >= 1.5 && Math.random() < 0.5) floater(g.x, g.y - 3, el === 'fire' ? 'Горит!' : 'Свет жжёт!', '#ffe070');
  else if (k <= 0.6 && Math.random() < 0.2) floater(g.x, g.y - 3, 'Вязнет в тумане…', '#9ab0c8');
  sfxAt('thud', px, py, 0.5);
  if (g.hp <= 0) { rpDie(g, u); return; }
  const ph = g.hp <= g.mhp / 3 ? 3 : g.hp <= g.mhp * 2 / 3 ? 2 : 1;
  if (ph > (g.ph3 || 1)) rpPhase(g, ph);
}

function rpPhase(g, ph) {
  g.ph3 = ph;
  g.mode = 'boo'; g.modeT = 1.6;
  sfxAt('wail', g.x * TILE, g.y * TILE, 1.5);
  fxBurst(g.x * TILE, g.y * TILE - 22, 26, ['#ff3a1c', '#2a1010', '#bfe0ff'], 110, 50, 0.9, 2.2, -30);
  if (ph === 2) { floater(g.x, g.y - 3.2, 'Жнец в ярости!', '#ff6a4a'); logEvent('night', 'Раненый жнец пришёл в ярость', g.x, g.y); }
  else {
    floater(g.x, g.y - 3.2, 'Жнец рвёт завесу!', '#ff3a1c');
    logEvent('night', 'Жнец рвёт завесу — на зов слетаются призраки', g.x, g.y);
    const gs = Game.ghosts;
    for (let n = 0; n < 2 && gs.filter(o => o.kind !== 'reaper').length < 12; n++) {
      const x = Math.max(2, Math.min(MAP_W - 2, g.x + (Math.random() - 0.5) * 4)), y = Math.max(2, Math.min(MAP_H - 2, g.y + (Math.random() - 0.5) * 3));
      gs.push({ x, y, hx: x, hy: y, alpha: 0.2, ph: Math.random() * 9, face: 1, rev: true, fromGy: true, mode: 'drift', modeT: 0, tx: x, ty: y, retarget: 0, scan: Math.random() });
    }
  }
}

function rpDie(g, u) {
  g.slain = true; g.hp = 0; g.mode = 'leave'; g.modeT = 99; g.atkT = 0; g.atkU = null; g.tx = g.x; g.ty = g.y;
  const tx = Math.floor(g.x), ty = Math.floor(g.y), night = nightIndex();
  sfxAt('wail', g.x * TILE, g.y * TILE, 0.55);
  sfxAt('rattle', g.x * TILE, g.y * TILE, 1.4);
  sfxAt('chime', g.x * TILE, g.y * TILE, 1);
  fxBurst(g.x * TILE, g.y * TILE - 20, 46, ['#ffffff', '#bfe0ff', '#6fd0b0', '#2a3a44'], 140, 80, 1.4, 2.6, -40);
  floater(g.x, g.y - 3.2, 'Коса падает…', '#e8f4ff');
  const sp = isWalkable(tx, ty) ? [tx, ty] : randomFreeNear(tx, ty, 0, 2, (x, y) => isWalkable(x, y)) || [tx, ty];
  dropPile(sp[0], sp[1], 'gold', Math.min(15, 5 + night));
  if (typeof neuGiveXp === 'function') neuGiveXp(g, u, 120 + 20 * Math.min(10, night));
  let cheer = 0;
  for (const w of Game.units) {
    if (w.dead || w.inside || !isPerson(w) || w.hero || Math.hypot(w.x - g.x, w.y - g.y) > 14) continue;
    w.boostUntil = Math.max(w.boostUntil || 0, Game.time + 40);
    if (cheer++ < 4) floater(w.x, w.y - 1.4, ['Ура!', 'Слава!', 'Наш-то, а!', 'Получил, косарь!'][cheer - 1], '#ffe9a0');
  }
  Game.reaperSlain = (Game.reaperSlain || 0) + 1;
  Game.reaperRest = night + RPF.REST;
  const who = u ? (u.hero ? u.hero.name : typeof unitTitle === 'function' ? unitTitle(u) : 'Житель') : 'Деревня';
  logEvent('night', `${who} одолел жнеца! Две ночи жнецы будут обходить деревню стороной`, g.x, g.y);
  toast(`${who} одолел жнеца! Гномы ликуют, а жнецы две ночи обойдут деревню`);
  if (typeof track === 'function' && !(typeof isServerSim === 'function' && isServerSim())) track('reaper-kill', 'Одолел жнеца');
}

// ---------- Ответ жнеца: гонится за обидчиком и косит его ----------
const rpTarget = g => { const u = g.tg && Game.unitMap ? Game.unitMap.get(g.tg) : Game.units.find(o => o.id === g.tg); return u && !(typeof neuUnitOut === 'function' ? neuUnitOut(u) : u.dead || u.inside) ? u : null; };

{
  const _tick = reaperTick;
  reaperTick = function (g, dt) {
    rpInit(g);
    if (g.slain) { g.alpha = Math.max(0, g.alpha - dt * 0.6); return; }
    // вне боя раны затягиваются
    if (!rpProv(g)) { if (g.hp < g.mhp) g.hp = Math.min(g.mhp, g.hp + 2 * dt); g.tg = 0; return _tick(g, dt); }
    const u = rpTarget(g);
    if (!u || g.alpha < 0.4) return _tick(g, dt);
    if (g.atkT > 0) { ghostStrikeTick(g, dt); return; }
    if (g.abStun > Game.time) return;                 // оглушён (втрое короче, чем другие)
    const ph = g.ph3 || 1, dx = u.x - g.x, dy = u.y - g.y, d = Math.hypot(dx, dy) || 1;
    g.face = dx >= 0 ? 1 : -1;
    if (d > 1.6) { const s = Math.min(d - 1.6, RPF.SPD[ph] * dt); g.x += dx / d * s; g.y += dy / d * s; }
    g.hx = g.x; g.hy = g.y; g.tx = g.x; g.ty = g.y;
    if (d < REAPER_REACH && (g.sweepCD || 0) < Game.time) { g.sweepCD = Game.time + RPF.CD[ph]; ghostStrike(g, u); }
  };

  // коса бьёт больнее призрачных когтей и задевает рекрутов (призрак бьёт только героя)
  const _gst = ghostStrikeTick;
  ghostStrikeTick = function (g, dt) {
    const u = g.atkU, hit0 = g.atkHit;
    _gst(g, dt);
    // только в бою: мимоходом жнец задевает героя, как раньше (5–8), чтобы обычные ночи не стали тяжелее
    if (g.kind !== 'reaper' || hit0 || !g.atkHit || !u || u.dead || !rpProv(g) || Math.hypot(u.x - g.x, u.y - g.y) >= REAPER_REACH) return;
    const extra = 6 + 0.6 * Math.min(12, nightIndex()) + 2 * ((g.ph3 || 1) - 1);
    if (u.hero) { if (typeof heroHit === 'function') heroHit(u, extra, ''); return; }
    if (typeof neuHurtUnit === 'function') {
      neuHurtUnit(u, extra + Math.random() * 4);
      floater(u.x, u.y - 2.4, 'Коса!', '#bfeaff');
    }
  };

  // после победы — передышка
  const _want = reapersWanted;
  reapersWanted = function () { return (Game.reaperRest || 0) > nightIndex() ? 0 : _want(); };

  // первый жнец в игре — подсказка, что его можно одолеть
  const _spawn = reapersSpawn;
  reapersSpawn = function () {
    const n0 = (Game.ghosts || []).filter(g => g.kind === 'reaper').length;
    _spawn();
    const n1 = (Game.ghosts || []).filter(g => g.kind === 'reaper').length;
    if (n1 > n0 && !Game.reaperHint && Game.hero) {
      Game.reaperHint = 1;
      toast('На окраине бродит жнец. Он смертен, но крепок: огонь и святой свет жгут его вдвое, сталь вязнет в тумане');
    }
  };
}

// ---------- Жнец среди врагов гильдий, героя и способностей ----------
{
  const RK = f => f && f.kind === 'reaper';
  const _alive = foeAlive;
  foeAlive = function (f) { return RK(f) ? rpVisible(f.o) : _alive(f); };

  // тронутый жнец — враг для всех; нетронутого выбирают только прицельным кликом (r ≤ 1,8) или способностью героя
  const _near = foesNear;
  foesNear = function (x, y, r) {
    const out = _near(x, y, r);
    let add = false;
    for (const g of rpAll()) {
      if (!(RPF.wide || r <= 1.8 || rpProv(g))) continue;
      if (Math.hypot(g.x - x, g.y - y) < r + (r <= 1.8 ? 0.6 : 0)) { out.push({ kind: 'reaper', o: rpInit(g) }); add = true; }
    }
    if (add) out.sort((p, q) => Math.hypot(p.o.x - x, p.o.y - y) - Math.hypot(q.o.x - x, q.o.y - y));
    return out;
  };

  // удар «насмерть» для нечисти (огненный шар по скелету, изгнание…) жнецу — просто сильный удар
  const _kill = killFoe;
  killFoe = function (f, u) {
    if (!RK(f)) return _kill(f, u);
    const force = typeof KIT !== 'undefined' && KIT.force;
    rpHurt(f.o, u, neuDamageOf(u) * (force ? 2.5 : 1.3), cbEl(u), force ? 'force' : 'kill');
  };

  const _strike = strike;
  strike = function (u, f) {
    if (!RK(f)) return _strike(u, f);
    const g = f.o;
    if (!rpVisible(g)) return;
    const H = u && u.type === 'hero' && u.hero;
    const sure = f.sure || (H && H.abNext) || 0;
    let el = cbEl(u);
    if (sure) {
      if (!f.sure && H) { if (unitCls(u) === 'paladin') el = 'holy'; H.abNext = 0; if (u.abfx && u.abfx.t > Game.time && u.abfx.k !== 'ult_rogue') u.abfx = null; }
      floater(g.x, g.y - 2.6, 'В цель!', '#ffe070');
      rpHurt(g, u, neuDamageOf(u) * sure, el, 'sure');
      return;
    }
    if (Math.random() > Math.min(0.95, 0.5 + 0.5 * unitAtk(u)) * 0.85) {
      floater(g.x, g.y - 2.2, 'Сквозь туман!', '#c8d8ff');
      g.prov = Game.time; if (!g.tg) g.tg = u.id;
      return;
    }
    let dmg = neuDamageOf(u) * (0.8 + Math.random() * 0.45);
    if (unitCls(u) === 'rogue' && Math.random() < 0.25) { dmg *= 2; floater(g.x, g.y - 2.6, 'Крит!', '#e0b0ff'); }
    rpHurt(g, u, dmg, el, 'strike');
  };

  // кто бьётся со жнецом, не «теряется в тумане» и не бежит от его ужаса: иначе погасший фонарь обрывает бой
  const _intr = interruptible;
  interruptible = function (u) { return u && u.rpFight > Game.time ? false : _intr(u); };

  // клик по жнецу — понятный приказ
  const _rc = resolveCmd;
  resolveCmd = function (t) {
    const r = _rc(t);
    if (r && r.kind === 'attack' && RK(r.f)) r.label = 'Бой со жнецом';
    return r;
  };

  // долгий бой, как с лесными жителями: до победы, пока боец на ногах
  const _fight = fightGen;
  fightGen = function* (u, f) {
    if (!RK(f)) { yield* _fight(u, f); return; }
    const cls = unitCls(u), C = cls && GCLS[cls], range = unitRange(u);
    const out = () => (typeof neuUnitOut === 'function' ? neuUnitOut(u) : u.dead || u.inside);
    f.o.prov = Game.time; if (!f.o.tg) f.o.tg = u.id;
    for (let round = 0; round < 120 && foeAlive(f) && !out(); round++) {
      const o = f.o, d = Math.hypot(o.x - u.x, o.y - u.y);
      u.rpFight = Game.time + 3;
      if (d > range + 0.6) {
        const keep = C && C.shot ? range * 0.7 : 1.2;
        let tx = Math.floor(o.x + (u.x - o.x) / d * keep), ty = Math.floor(o.y + (u.y - o.y) / d * keep);
        if (!isWalkable(tx, ty)) { const s = randomFreeNear(tx, ty, 0, 2, (x, y) => isWalkable(x, y)); if (!s) return; [tx, ty] = s; }
        const ok = yield { walk: [tx, ty], offroad: true };
        if (!ok) return;
        continue;
      }
      u.face = o.x > u.x ? 1 : -1; u.vdir = 'E';
      yield { wait: 0.55, anim: C && C.shot ? 'build' : 'chop' };
      if (!foeAlive(f) || out()) break;
      if (C && C.shot) {
        const sh = { kind: C.shot, x: u.x, y: u.y - 0.7, f, u, t: 0, dur: Math.max(0.25, d / (C.shot === 'arrow' ? 14 : 8)) };
        G.shots.push(sh);
        sfxAt(C.shot === 'arrow' ? 'thud' : 'chime', u.x * TILE, u.y * TILE, 0.6);
        yield { wait: sh.dur + 0.1 };
      } else strike(u, f);
      yield { wait: 0.4 };
    }
  };

  // способности: жнец всегда в списке целей, урон по стихии класса, оглушения втрое короче
  const _abFoes = abFoes;
  abFoes = function (h, r) {
    const out = _abFoes(h, r);
    for (const g of rpAll()) if (!out.some(f => f.o === g) && Math.hypot(g.x - h.x, g.y - h.y) < r) out.push({ kind: 'reaper', o: rpInit(g) });
    return out;
  };
  const _abHit = abHit;
  abHit = function (f, h, mul) {
    if (!RK(f)) return _abHit(f, h, mul);
    rpHurt(f.o, h, neuDamageOf(h) * (mul || 1) * 1.2, cbEl(h), 'abil');
  };
  const _abStun = abStun;
  abStun = function (f, d, h, text, col) {
    if (!RK(f)) return _abStun(f, d, h, text, col);
    if (!rpVisible(f.o)) return;
    f.o.abStun = Math.max(f.o.abStun || 0, Game.time + d * 0.35);
    f.o.prov = Game.time; if (!f.o.tg && h) f.o.tg = h.id;
    floater(f.o.x, f.o.y - 2.6, 'Сопротивляется!', '#c8d8ff');
  };

  // огненный шар по жнецу: огонь жжёт сильнее
  const _fire = ABIL_FX.fire;
  ABIL_FX.fire = function (h, a, H) {
    const f = abFoes(h, 9)[0];
    if (!RK(f)) return _fire(h, a, H);
    abFace(h, f.o); abCast(h);
    hmBolt(h.x, h.y, f.o.x, f.o.y, ['#fff0a0', '#ff9a30', '#e04a18'], () => { if (rpVisible(f.o)) rpHurt(f.o, h, neuDamageOf(h) * 2.5 + 6, 'fire', 'fireball'); });
  };

  // изгнание не прогоняет жнеца, а жжёт его светом
  const resist = (h, r, dmg) => {
    let n = 0;
    for (const g of rpAll()) if (Math.hypot(g.x - h.x, g.y - h.y) < r) {
      floater(g.x, g.y - 3.4, 'Жнец сопротивляется изгнанию!', '#fff2a0');
      rpHurt(g, h, dmg, 'sacred', 'banish'); n++;
    }
    return n;
  };
  const keepModes = (fn) => function (h, a, H) {
    const was = rpAll().map(g => [g, g.mode, g.modeT]);
    const r = fn.apply(this, arguments);
    for (const [g, m, t] of was) if (!g.slain) { g.mode = m; g.modeT = t; }
    return r;
  };
  const _ward = ABIL_FX.ward;
  ABIL_FX.ward = function (h, a, H) {
    const n = resist(h, 12, 10 + 2 * ((H && H.level) || 1));
    const r = keepModes(_ward).call(this, h, a, H);
    return r === false && n ? undefined : r;
  };
  if (ABIL_FX.ult_priest) {
    const _up = ABIL_FX.ult_priest;
    ABIL_FX.ult_priest = function (h, a, H) {
      const r = keepModes(_up).call(this, h, a, H);
      resist(h, 12, 30 + 3 * ((H && H.level) || 1));
      return r;
    };
  }
  const _haf = heroAbilityFor;
  heroAbilityFor = function (h, i) {
    const as = heroAbils(h && h.hero), a = as && as[i];
    RPF.wide = true;
    let r;
    try { r = _haf(h, i); } finally { RPF.wide = false; }
    if (r && a && a.turn) resist(h, 6, 18 + 3 * ((h.hero && h.hero.level) || 1));
    return r;
  };

  // освящённая земля паладина жжёт жнеца каждую секунду (зона сама нечисть другого рода не ищет)
  const _zt = abZoneTick;
  abZoneTick = function (dt) {
    _zt(dt);
    const L = Game.abz;
    if (!L || !L.length || kitMirror()) return;
    for (const z of L) {
      if (z.k !== 'holy' || Game.time < (z.rpT || 0)) continue;
      z.rpT = Game.time + 1;
      const own = Game.unitMap && Game.unitMap.get(z.own);
      if (!own) continue;
      for (const g of rpAll()) if (Math.hypot(g.x - z.x, g.y - z.y) <= z.r + 0.5) rpHurt(g, own, neuDamageOf(own) * 0.5, 'sacred', 'zone');
    }
  };
}

// ---------- Рассвет: недобитый жнец уходит ----------
{
  const _gt = ghostsTick;
  ghostsTick = function (dt) {
    _gt(dt);
    if (!isDawnNow()) return;
    for (const g of Game.ghosts || []) if (g.kind === 'reaper' && !g.slain && !g.dawnSaid && g.mhp && g.hp < g.mhp) {
      g.dawnSaid = true;
      floater(g.x, g.y - 3, 'Рассвет! Жнец уходит недобитым', '#ffe9a0');
      logEvent('night', 'С рассветом раненый жнец растворился в тумане');
    }
  };
}

// ---------- Полоса здоровья ----------
{
  const _dg = drawGhosts;
  drawGhosts = function (c) {
    _dg(c);
    for (const g of Game.ghosts || []) {
      if (g.kind !== 'reaper' || !g.mhp || g.alpha < 0.3 || g.slain) continue;
      if (g.hp >= g.mhp && !rpProv(g)) continue;
      const w = 36, h = 4, x = Math.round(g.x * TILE - w / 2), y = Math.round(g.y * TILE - 17 - Math.sin(g.ph) * 2.4 - 54), k = Math.max(0, g.hp / g.mhp);
      c.save(); c.globalAlpha = Math.min(1, g.alpha * 1.2);
      c.fillStyle = 'rgba(0,0,0,0.75)'; c.fillRect(x - 1, y - 1, w + 2, h + 2);
      c.fillStyle = '#3a1418'; c.fillRect(x, y, w, h);
      c.fillStyle = (g.ph3 || 1) === 3 ? '#ff3a1c' : (g.ph3 || 1) === 2 ? '#e0702a' : '#b8d8ff'; c.fillRect(x, y, Math.round(w * k), h);
      c.fillStyle = 'rgba(0,0,0,0.8)'; for (const m of [1 / 3, 2 / 3]) c.fillRect(x + Math.round(w * m), y, 1, h);
      c.restore();
    }
  };
}

// ---------- Сохранение ----------
{
  const _ser = serializeGame;
  serializeGame = function () {
    const s = _ser();
    if (Game.reaperSlain || Game.reaperRest || Game.reaperHint) s.rp = { n: Game.reaperSlain || 0, rest: Game.reaperRest || 0, hint: Game.reaperHint ? 1 : 0 };
    return s;
  };
  const _apply = applySave;
  applySave = function (s) {
    _apply(s);
    const r = (s && s.rp) || {};
    Game.reaperSlain = r.n || 0; Game.reaperRest = r.rest || 0; Game.reaperHint = r.hint ? 1 : 0;
  };
  const _reset = resetGameState;
  resetGameState = function () { _reset(); Game.reaperSlain = 0; Game.reaperRest = 0; Game.reaperHint = 0; };
}
