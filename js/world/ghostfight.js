'use strict';
// Бой с призраками (ghosts.js — здоровье, ответный удар, бегство; здесь — призрак среди врагов героя, отряда и способностей).
// Жалоба тестера 261026-2235-c649 (телефон, день 14): «Много призраков слишком и их не прогнать с первого раза, сделай им хп полоску и бой».
// · Призрак — враг 'ghost': его бьют оружием, стрелами, огнём и способностями; святой удар паладина ×1,5, огонь ×1,3.
// · Святые силы — молитва по клику и «Изгнание нежити», оберег, «Чудо», солнце (banish.js) и освящённая земля (здесь) —
//   снимают ровно половину здоровья каждому призраку в зоне, по разу за умение: два раза — и он развеян.
// · Молитва по клику: герой жжёт светом (половина здоровья призракам в 3 клетках), недобитого добивает в бою (herolife.js).
// · Нетронутый призрак — не враг для отряда (как жнец): цель только по клику или для способности героя; тронутый — враг для всех.
// · Полоса здоровья над раненым или тем, кто в бою; за победу — опыт герою и тем, кто рядом, иногда монета.
//   Кооп: hp, mhp, prov, slain уходят клиентам в списке ghosts, считает сервер.
// Подключается после banish.js.

const GHF = { EL: { sacred: 1.5, holy: 1.5, fire: 1.3 }, wide: false };
const GK = f => !!f && f.kind === 'ghost';
const ghAll = () => (Game.ghosts || []).filter(ghLive);

{
  const _alive = foeAlive;
  foeAlive = function (f) { return GK(f) ? ghLive(f.o) : _alive(f); };

  // тронутый призрак — враг для всех; нетронутый — только для способности героя (клик по нему — молитва, herolife.js / banish.js)
  const _near = foesNear;
  foesNear = function (x, y, r) {
    const out = _near(x, y, r);
    let add = false;
    for (const g of ghAll()) {
      if (!(GHF.wide || ghProv(g))) continue;
      if (Math.hypot(g.x - x, g.y - y) < r + (r <= 1.8 ? 0.6 : 0)) { out.push({ kind: 'ghost', o: ghInit(g) }); add = true; }
    }
    if (add) out.sort((p, q) => Math.hypot(p.o.x - x, p.o.y - y) - Math.hypot(q.o.x - x, q.o.y - y));
    return out;
  };

  // «насмерть» (огненный шар по скелету и т. п.) призраку — просто сильный удар
  const _kill = killFoe;
  killFoe = function (f, u) {
    if (!GK(f)) return _kill(f, u);
    const force = typeof KIT !== 'undefined' && KIT.force, el = cbEl(u);
    ghHurt(f.o, u, neuDamageOf(u) * (force ? 2.5 : 1.3) * (GHF.EL[el] || 1), el, force ? 'force' : 'kill');
  };

  const _strike = strike;
  strike = function (u, f) {
    if (!GK(f)) return _strike(u, f);
    const g = f.o;
    if (!ghLive(g)) return;
    const H = u && u.type === 'hero' && u.hero, sure = f.sure || (H && H.abNext) || 0;
    let el = cbEl(u);
    if (sure) {
      if (!f.sure && H) { if (unitCls(u) === 'paladin') el = 'holy'; H.abNext = 0; if (u.abfx && u.abfx.t > Game.time && u.abfx.k !== 'ult_rogue') u.abfx = null; }
      floater(g.x, g.y - 2.6, 'В цель!', '#ffe070');
      ghHurt(g, u, neuDamageOf(u) * sure * (GHF.EL[el] || 1), el, 'sure');
      return;
    }
    if (Math.random() > Math.min(0.95, 0.55 + 0.5 * unitAtk(u))) {
      floater(g.x, g.y - 2.2, 'Сквозь туман!', '#c8f0e0');
      g.prov = Game.time; if (!g.tg) g.tg = u.id;
      return;
    }
    let dmg = neuDamageOf(u) * (0.8 + Math.random() * 0.45) * (GHF.EL[el] || 1);
    if (unitCls(u) === 'rogue' && Math.random() < 0.25) { dmg *= 2; floater(g.x, g.y - 2.6, 'Крит!', '#e0b0ff'); }
    ghHurt(g, u, dmg, el, 'strike');
  };

  // кто бьётся с призраком, не пугается его и не бросает бой
  const _intr = interruptible;
  interruptible = function (u) { return u && u.ghFight > Game.time ? false : _intr(u); };

  const _rc = resolveCmd;
  resolveCmd = function (t) {
    const r = _rc(t);
    if (r && r.kind === 'attack' && GK(r.f)) r.label = 'Бой с призраком';
    return r;
  };

  // бой до победы, пока боец на ногах; удравшего догоняет, пока видит
  const _fight = fightGen;
  fightGen = function* (u, f) {
    if (!GK(f)) { yield* _fight(u, f); return; }
    const cls = unitCls(u), C = cls && GCLS[cls], range = unitRange(u);
    const out = () => (typeof neuUnitOut === 'function' ? neuUnitOut(u) : u.dead || u.inside);
    f.o.prov = Game.time; if (!f.o.tg) f.o.tg = u.id;
    for (let round = 0; round < 60 && foeAlive(f) && !out(); round++) {
      const o = f.o, d = Math.hypot(o.x - u.x, o.y - u.y);
      if (d > 16) { floater(u.x, u.y - 1.6, 'Улетел…', '#cfe6ff'); return; }
      u.ghFight = Game.time + 3;
      if (d > range + 0.6) {
        const keep = C && C.shot ? range * 0.7 : 1.1;
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

  // способности: призрак в списке целей, урон по стихии класса
  const _abFoes = abFoes;
  abFoes = function (h, r) {
    const out = _abFoes(h, r);
    for (const g of ghAll()) if (!out.some(f => f.o === g) && Math.hypot(g.x - h.x, g.y - h.y) < r) out.push({ kind: 'ghost', o: ghInit(g) });
    return out;
  };
  const _abHit = abHit;
  abHit = function (f, h, mul) {
    if (!GK(f)) return _abHit(f, h, mul);
    const el = cbEl(h);
    ghHurt(f.o, h, neuDamageOf(h) * (mul || 1) * (GHF.EL[el] || 1), el, 'abil');
  };
  const _abStun = abStun;
  abStun = function (f, d, h, text, col) {
    if (!GK(f)) return _abStun(f, d, h, text, col);
    if (!ghLive(f.o)) return;
    f.o.abStun = Math.max(f.o.abStun || 0, Game.time + d);
    f.o.prov = Game.time; if (!f.o.tg && h) f.o.tg = h.id;
    if (text) floater(f.o.x, f.o.y - 2.2, text, col || '#ffe070');
  };

  // во время любой способности героя призрак — законная цель, даже нетронутый
  const _haf = heroAbilityFor;
  heroAbilityFor = function (h, i) {
    GHF.wide = true;
    try { return _haf(h, i); } finally { GHF.wide = false; }
  };

  // освящённая земля паладина: половина здоровья каждому призраку, что в неё попал, — один раз за освящение
  const _zt = abZoneTick;
  abZoneTick = function (dt) {
    _zt(dt);
    const L = Game.abz;
    if (!L || !L.length || kitMirror()) return;
    for (const z of L) {
      if (z.k !== 'holy') continue;
      const own = Game.unitMap && Game.unitMap.get(z.own);
      if (!own) continue;
      for (const g of ghAll()) if (g.hzK !== z.until && Math.hypot(g.x - z.x, g.y - z.y) <= z.r + 0.5) { g.hzK = z.until; ghHoly(g, own, 'zone'); }
    }
  };

  // солнце паладина («Кара Костра», heroult.js) жжёт каждую секунду; призраку — половина здоровья один раз за ульту
  // (метеориты мага — огонь, бьют как обычно)
  if (typeof ultBlast === 'function') {
    const _ub = ultBlast;
    ultBlast = function (f, own, mul, burn) {
      if (!GK(f) || burn) return _ub(f, own, mul, burn);
      if (!ghLive(f.o) || (f.o.sunT || 0) > Game.time) return;
      f.o.sunT = Game.time + 13;
      ghHoly(f.o, own, 'sun');
    };
  }

  // полоса здоровья над раненым или тем, кто в бою
  const _dg = drawGhosts;
  drawGhosts = function (c) {
    _dg(c);
    for (const g of Game.ghosts || []) {
      if (g.kind === 'reaper' || !g.mhp || g.alpha < 0.3 || g.slain) continue;
      if (g.hp >= g.mhp && !ghProv(g)) continue;
      const w = 26, h = 3, x = Math.round(g.x * TILE - w / 2), y = Math.round(g.y * TILE - 17 - Math.sin(g.ph) * 2.4 - 44), k = Math.max(0, g.hp / g.mhp);
      c.save(); c.globalAlpha = Math.min(1, g.alpha * 1.2);
      c.fillStyle = 'rgba(0,0,0,0.75)'; c.fillRect(x - 1, y - 1, w + 2, h + 2);
      c.fillStyle = '#16302c'; c.fillRect(x, y, w, h);
      c.fillStyle = g.mode === 'flee' ? '#e0b050' : '#9fecd0'; c.fillRect(x, y, Math.round(w * k), h);
      c.fillStyle = 'rgba(0,0,0,0.8)'; c.fillRect(x + Math.round(w / 2), y, 1, h);     // отметка половины: столько снимает святая сила
      c.restore();
    }
  };

  // первый призрак в игре — подсказка, что его можно одолеть
  const _spawn = ghostsSpawn;
  ghostsSpawn = function (n) {
    const n0 = (Game.ghosts || []).length;
    _spawn(n);
    if ((Game.ghosts || []).length > n0 && !Game.ghostHint && Game.hero) {
      Game.ghostHint = 1;
      toast('Над деревней бродят призраки. Их можно одолеть: молитва и святые умения снимают половину здоровья, остальное — оружием');
    }
  };

  const _ser = serializeGame;
  serializeGame = function () {
    const s = _ser();
    if (Game.ghostSlain || Game.ghostHint) s.gh = { n: Game.ghostSlain || 0, hint: Game.ghostHint ? 1 : 0 };
    return s;
  };
  const _apply = applySave;
  applySave = function (s) {
    _apply(s);
    const r = (s && s.gh) || {};
    Game.ghostSlain = r.n || 0; Game.ghostHint = r.hint ? 1 : 0;
  };
  const _reset = resetGameState;
  resetGameState = function () { _reset(); Game.ghostSlain = 0; Game.ghostHint = 0; };
}
