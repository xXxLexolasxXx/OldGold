'use strict';
// Изгнание нечисти: обычные призраки и банши. Подключается после reaperfight.js (жнец изгнанию сопротивляется — там).
// Жалоба 0.11.34: «обычных призраков не получается прогнать». Причины были старые, не от жнеца:
//  · в общей деревне молитва героя по клику не работала вовсе (herolife.js проверяет hlOn(), а в коопе он ложен);
//  · пока герой шёл к призраку, тот пугал его («Призрак!» — бегство или оцепенение) и приказ обрывался;
//    к тому же призрак уплывал быстрее, чем ночью идёт герой, и через 14 шагов «Ушёл…»;
//  · «Изгнание нежити» жреца призраков не трогало, а без скелетов рядом писало «Врагов рядом нет».
// Теперь: призрак, которого изгоняют, замирает, герой во время молитвы не пугается; клик работает и в коопе;
// изгнание нежити жреца, оберег мага, «Чудо» и солнце паладина прогоняют банши, а призракам с 0.11.66 снимают ровно
// половину здоровья (ghHoly в ghosts.js) — всем в зоне разом; второй раз — и призрак развеян.
// Банши (fairy2.js) можно прогнать кликом героя («Прогнать банши») или теми же способностями: она уходит,
// и до конца ночи (но не дольше 4 минут) плакальщица у кладбища не воет.

const BN = { HOLD: 18, AWAY: 240, R_TURN: 6, R_WARD: 12, spirit: false };

const bnGhostOk = g => g && g.kind !== 'reaper' && !g.exo && g.alpha >= 0.25 && g.mode !== 'leave' && g.mode !== 'grab' && (Game.ghosts || []).includes(g);
const bnFz = () => (typeof Game !== 'undefined' && Game.fairy2) || null;
const bnBanOk = b => b && !b.gone && b.alpha >= 0.25 && !!bnFz() && bnFz().ban.includes(b);
function bnBansheeAt(x, y, r) {
  const F = bnFz();
  let best = null, bd = r;
  for (const b of F ? F.ban : []) { if (!bnBanOk(b)) continue; const d = Math.hypot(b.x - x, b.y - y); if (d < bd) { bd = d; best = b; } }
  return best;
}
const bnSpiritsNear = (x, y, r) => (Game.ghosts || []).filter(g => bnGhostOk(g) && Math.hypot(g.x - x, g.y - y) < r).length + ((bnFz() || { ban: [] }).ban.filter(b => bnBanOk(b) && Math.hypot(b.x - x, b.y - y) < r).length);

// прогнать банши: уходит, до конца ночи плакальщица не возвращается
function bnBanish(b, who) {
  const F = bnFz();
  if (!bnBanOk(b) || !F) return false;
  b.gone = true; b.omen = true; b.t = 99; b.tx = b.x; b.ty = b.y; b.wail = 0;
  F.banAway = Game.time + BN.AWAY;
  floater(b.x, b.y - 2.4, ['И-и-и… ухожу…', 'Не буду выть… не буду…', 'Тише, тише…'][(Math.random() * 3) | 0], '#dcecff');
  fxBurst(b.x * TILE, b.y * TILE - 16, 18, ['#fff6c0', '#dcecff', '#ffffff'], 70, 70, 1, 2, -50);
  sfxAt('chime', b.x * TILE, b.y * TILE, 0.9); sfxAt('wail', b.x * TILE, b.y * TILE, 0.5);
  logEvent('night', `${who ? (who.hero ? who.hero.name : unitTitle(who)) : 'Кто-то'} прогнал банши — у кладбища стало тихо`, b.x, b.y);
  if (typeof fstat === 'function') fstat('banBanish');
  return true;
}
// все духи вокруг: призракам — половина здоровья, банши прогоняет (жнец не трогается — его ранит reaperfight.js)
function bnBanishAround(h, r, noGhosts) {
  let n = 0;
  for (const g of (Game.ghosts || []).slice()) if (!noGhosts && ghLive(g) && Math.hypot(g.x - h.x, g.y - h.y) < r && ghHoly(g, h, 'banish')) n++;
  const F = bnFz();
  for (const b of F ? F.ban.slice() : []) if (bnBanOk(b) && Math.hypot(b.x - h.x, b.y - h.y) < r && bnBanish(b, h)) n++;
  if (n) logEvent('night', `${h.hero ? h.hero.name : unitTitle(h)}: свет обжёг духов (${n})`, h.x, h.y);
  return n;
}

// молитва героя над банши — как над призраком (hlExorcise), но короче, и она воет в ответ
function* bnBansheeGen(u, c) {
  const b = c.b;
  for (let tries = 0; tries < 14; tries++) {
    if (!bnBanOk(b)) return;
    if (Math.hypot(b.x - u.x, b.y - u.y) < 2.2) break;
    const tx = Math.max(1, Math.min(MAP_W - 2, Math.floor(b.x))), ty = Math.max(1, Math.min(MAP_H - 2, Math.floor(b.y)));
    const spot = isWalkable(tx, ty) ? [tx, ty] : (randomFreeNear(tx, ty, 0, 2, (x, y) => isWalkable(x, y)) || null);
    if (!spot) return;
    yield { walk: spot };
    if (tries === 13) { floater(u.x, u.y - 1.6, 'Ушла…', '#cfe6ff'); return; }
  }
  if (!bnBanOk(b)) return;
  u.face = b.x > u.x ? 1 : -1; u.vdir = 'E';
  floater(u.x, u.y - 1.7, 'Тише, плакальщица — ступай с миром!', '#ffe9a0');
  sfxAt('chime', b.x * TILE, b.y * TILE);
  for (let k = 0; k < 3; k++) {
    u.gest = 'fist'; u.gestUntil = Game.time + 0.7; u.gestFace = u.face;
    if (k === 1) { floater(b.x, b.y - 2.4, 'А-а-ау-у!', '#dcecff'); sfxAt('wail', b.x * TILE, b.y * TILE, 0.8); if (u.hero && typeof hlHurt === 'function') hlHurt(u, 2 * (typeof fsEnvMul === 'function' ? fsEnvMul(u) : 1), 'ghost'); }
    yield { wait: 0.6 };
    if (!bnBanOk(b)) return;
    fxBurst(b.x * TILE, b.y * TILE - 16, 7, ['#fff6c0', '#ffe070', '#bfe8ff'], 50, 60, 0.9, 1.6, -40);
  }
  bnBanish(b, u);
  yield { wait: 0.6 };
}

{
  // клик по банши (и по призраку в общей деревне, где молитва herolife.js выключена)
  const _rc = resolveCmd;
  resolveCmd = function (t) {
    const shared = Game.coop || (typeof kitServer === 'function' && kitServer());      // общая деревня: игрок или сервер
    if (inb(t[0], t[1]) && (shared || (typeof hlOn === 'function' && hlOn() && !Game.hero.dead))) {
      const bx = t[0] + 0.5, by = t[1] + 0.5;
      if (shared && typeof hlGhostAt === 'function') {
        const gh = hlGhostAt(t);
        if (gh) return { kind: 'exorcise', g: gh, tx: Math.floor(gh.x), ty: Math.floor(gh.y), label: 'Прогнать призрака' };
      }
      // банши рисуется выше своей точки — ловим и клик по её силуэту (клеткой выше)
      const b = bnBansheeAt(bx, by, 1.4) || bnBansheeAt(bx, by + 1, 1.2);
      if (b) return { kind: 'banshee', b, tx: Math.floor(b.x), ty: Math.floor(b.y), label: 'Прогнать банши' };
    }
    return _rc(t);
  };

  // пока герой изгоняет, призрак замирает, а сам герой не пугается
  const _run = runCmd;
  runCmd = function* (u, c) {
    if (c.kind === 'banshee') {
      u.exoUntil = Game.time + BN.HOLD;
      try { yield* bnBansheeGen(u, c); } finally { u.exoUntil = 0; }
      return;
    }
    if (c.kind === 'exorcise' && c.g) {
      u.exoUntil = Game.time + BN.HOLD; c.g.holdUntil = Game.time + BN.HOLD;
      try { yield* _run(u, c); } finally { u.exoUntil = 0; if (c.g) c.g.holdUntil = 0; }
      return;
    }
    yield* _run(u, c);
  };
  const _intr = interruptible;
  interruptible = function (u) { return u && u.exoUntil > Game.time ? false : _intr(u); };

  const _gt = ghostsTick;
  ghostsTick = function (dt) {
    const held = [];
    for (const g of Game.ghosts || []) if (g.holdUntil > Game.time && g.mode !== 'leave' && g.kind !== 'reaper') held.push([g, g.x, g.y]);
    _gt(dt);
    for (const [g, x, y] of held) if (g.mode !== 'leave' && g.mode !== 'grab') { g.x = x; g.y = y; g.tx = x; g.ty = y; }
  };

  // прогнанная банши не возвращается до конца ночи (не дольше 4 минут): на это время её ночь «кончилась»
  if (typeof fzBansheeTick === 'function') {
    const _bt = fzBansheeTick;
    fzBansheeTick = function (F, act, dt) {
      if (F.banAway > Game.time && !isDawnNow()) act = false;
      else if (F.banAway && isDawnNow()) F.banAway = 0;
      for (const b of F.ban) if (b.gone) { b.omen = true; b.t = 99; }
      return _bt(F, act, dt);
    };
  }

  // способности: изгнание нежити отпускает призраков и гонит банши — даже если скелетов рядом нет
  const _near = foesNear;
  foesNear = function (x, y, r) {
    const out = _near(x, y, r);
    if (BN.spirit && !out.length) for (const g of Game.ghosts || []) if (bnGhostOk(g) && Math.hypot(g.x - x, g.y - y) < r) { out.push({ kind: 'spirit', o: g }); break; }
    if (BN.spirit && !out.length) { const b = bnBansheeAt(x, y, r); if (b) out.push({ kind: 'spirit', o: b }); }
    return out;
  };
  const _alive = foeAlive;
  foeAlive = function (f) { return f && f.kind === 'spirit' ? bnGhostOk(f.o) || bnBanOk(f.o) : _alive(f); };

  const _haf = heroAbilityFor;
  heroAbilityFor = function (h, i) {
    const as = heroAbils(h && h.hero), a = as && as[i];
    if (!a || !(a.turn || a.k === 'ward' || a.k === 'ult_priest' || a.k === 'ult_paladin')) return _haf(h, i);
    BN.spirit = !!a.turn;
    let r;
    try { r = _haf(h, i); } finally { BN.spirit = false; }
    if (r && h) {
      const n = bnBanishAround(h, a.turn ? BN.R_TURN : a.k === 'ult_paladin' ? 5 : BN.R_WARD, a.k === 'ult_paladin');      // призраков солнце жжёт само (ghostfight.js)
      if (n && a.turn) floater(h.x, h.y - 2.6, `Свет жжёт духов: ${n}`, '#fff2a0');
    }
    return r;
  };

  const _reset = resetGameState;
  resetGameState = function () { _reset(); BN.spirit = false; };
}
