'use strict';
// Призраки: с вечера бродят над деревней 1–3 прозрачных гнома-тени. Пугают всех, кого видят —
// и гномов, и нечисть, — но сами безобидны. Призрака можно задобрить хлебом: гном с хлебом в руках
// отдаёт его, призрак успокаивается, благодарит и (иногда) оставляет золотую монету.
// С 0.11.57 призрак смертен (жалоба тестера 261026-2235-c649: «много призраков, с первого раза не прогнать — дай полоску и бой»):
// здоровье растёт с ночами (36, +2 за ночь, до 60), тронутый призрак бросается на обидчика и студит его когтями, раненый
// (меньше 45%) может удрать, вне боя раны затягиваются. Святые силы снимают ровно половину здоровья (ghHoly) — дважды, и он развеян;
// за победу опыт и иногда монета. Выходят реже и меньше: бывают пустые вечера, одновременно не больше 3 (+1 за четыре потери, до 6).
// Бой с отрядом, способности и полоса здоровья — ghostfight.js.

const GHOST_SEE = 4.5, GHOST_SEE_ENT = 5.5;
const GHOST_APPEAR = 0.3;   // проступают, когда потемнело настолько (вечер темнеет до 0.35 — то есть к концу вечера, а не с его начала)
const GH = {
  HP0: 36, HP_NIGHT: 2, HP_MAX: 60,                        // здоровье: 36 на первых ночах, +2 за ночь, до 60
  XP: 24, XP_NIGHT: 2,                                     // опыт за победу: 24 + 2 за ночь (до 10-й)
  FORGET: 20, REACH: 1.6, CD: 2.4, SPD: 1.25,              // бой: забывает обидчика через 20 с, бьёт вплотную раз в 2,4 с
  FLEE_AT: 0.45, FLEE_P: 0.35, FLEE_SPD: 2.4, FLEE_T: 5,   // раненый ниже 45% удирает с вероятностью 35% (раз за жизнь)
  REGEN: 0.6, CAP: 3, CAP_MAX: 6,
};

// где появиться: из кладбища, если оно есть, иначе над случайным жителем
function ghostSpot(gy, live) {
  if (gy) return { x: gy.x + 1 + Math.random() * (gy.w - 2), y: gy.y + 0.5 + Math.random() * (gy.h - 1), gy: true };
  const u = live.length ? live[(Math.random() * live.length) | 0] : null;
  const x = (u ? u.x : MAP_W / 2) + (Math.random() - 0.5) * 16, y = (u ? u.y : MAP_H / 2) + (Math.random() - 0.5) * 12;
  return { x: Math.max(2, Math.min(MAP_W - 2, x)), y: Math.max(2, Math.min(MAP_H - 2, y)), gy: false };
}

// Сколько призраков выходит за вечер: было 1–3 + половина потерь каждый вечер, теперь треть вечеров пустые, иначе 1–2 + четверть потерь
function ghostsWant() {
  const lost = Game.lostGnomes || 0;
  return Math.random() < 0.3 ? 0 : 1 + (Math.random() < 0.35 ? 1 : 0) + Math.floor(lost / 4);
}
const ghostsCap = () => Math.min(GH.CAP_MAX, GH.CAP + Math.floor((Game.lostGnomes || 0) / 4));

// Призраки заводятся с началом вечера, но остаются невидимыми (rev: false) до GHOST_APPEAR — см. ghostsTick
function ghostsSpawn(n) {
  const gs = Game.ghosts || (Game.ghosts = []);
  const live = Game.units.filter(u => !u.dead);
  const gy = graveyardOf(), cap = ghostsCap();
  let made = 0;
  for (let i = 0; i < n && gs.filter(g => g.kind !== 'reaper' && !g.slain).length < cap; i++, made++) {
    const sp = ghostSpot(gy, live);
    gs.push(ghInit({ x: sp.x, y: sp.y, hx: sp.x, hy: sp.y, alpha: 0, ph: Math.random() * 9, face: 1, rev: false, fromGy: sp.gy,
      mode: 'drift', modeT: 0, tx: sp.x, ty: sp.y, retarget: 0, scan: Math.random() }));
  }
  if (made > 0) logEvent('night', 'Над деревней поплыли призраки');
}

// ---------- Здоровье, урон, гибель, бегство ----------
const ghMaxHp = () => Math.min(GH.HP_MAX, GH.HP0 + GH.HP_NIGHT * Math.max(0, nightIndex() - 1));
function ghInit(g) {
  if (!g || g.kind === 'reaper') return g;
  if (g.mhp == null) { g.mhp = ghMaxHp(); g.hp = g.mhp; }
  if (!g.look) g.look = Math.random() < 0.5 ? 'A' : 'B';          // пиксельный облик (ghostpx.js): колпак или дед — вперемешку
  if (g.rag == null) g.rag = ['', 'T1', 'T2'][(Math.random() * 3) | 0];   // саван: гладкий, полосы или рваньё — вперемешку
  return g;
}
// живой и видимый обычный призрак — его можно бить
const ghLive = g => !!g && g.kind !== 'reaper' && !g.slain && !g.exo && g.rev !== false && g.alpha >= 0.25 && g.mode !== 'leave' && g.mode !== 'grab' && (Game.ghosts || []).includes(g);
const ghProv = g => Game.time - (g.prov || -99) < GH.FORGET;
function ghTarget(g) {
  const u = !g.tg ? null : Game.unitMap ? Game.unitMap.get(g.tg) : Game.units.find(o => o.id === g.tg);
  return u && !(typeof neuUnitOut === 'function' ? neuUnitOut(u) : u.dead || u.inside) ? u : null;
}
const ghWho = u => u ? (u.hero ? u.hero.name : typeof unitTitle === 'function' ? unitTitle(u) : 'Житель') : 'Кто-то';

// урон по призраку; возвращает, сколько снято
function ghHurt(g, u, dmg, el, src) {
  if (!ghLive(g)) return 0;
  ghInit(g);
  dmg = Math.max(1, Math.min(g.hp, Math.round(dmg)));
  g.hp -= dmg; g.prov = Game.time; g.hurtT = Game.time;
  if (u && !u.dead && g.mode !== 'flee') g.tg = u.id;
  if (g.mode === 'calm' || g.mode === 'boo') { g.mode = 'drift'; g.modeT = 0; }
  const holy = el === 'holy' || el === 'sacred', px = g.x * TILE, py = g.y * TILE - 16;
  fxBurst(px, py, holy ? 12 : 7, holy ? ['#fff6c0', '#ffe070', '#ffffff'] : el === 'fire' ? ['#fff0a0', '#ff9a30', '#e04a18'] : ['#bfffe0', '#6fd0b0', '#2a3a44'], 60, 40, 0.5, 1.6, holy ? -40 : 120);
  floater(g.x, g.y - 2.1, '−' + dmg, holy ? '#ffe070' : '#c8f0e0');
  sfxAt('thud', px, py, 0.45);
  if (g.hp <= 0) { ghDie(g, u); return dmg; }
  if (!g.fled && g.hp <= g.mhp * GH.FLEE_AT && Math.random() < GH.FLEE_P) ghFlee(g, u);
  return dmg;
}
// святая сила: ровно половина здоровья (изгнание, оберег, «Чудо», солнце, освящённая земля)
function ghHoly(g, u, src) { return ghLive(g) ? ghHurt(g, u, Math.ceil(ghInit(g).mhp / 2), 'holy', src || 'holy') : 0; }

function ghFlee(g, u) {
  g.fled = true; g.mode = 'flee'; g.modeT = GH.FLEE_T; g.holdUntil = 0; g.atkT = 0; g.atkU = null;
  const fx = u ? g.x - u.x : Math.random() - 0.5, fy = u ? g.y - u.y : Math.random() - 0.5, d = Math.hypot(fx, fy) || 1;
  g.tx = Math.max(1.5, Math.min(MAP_W - 1.5, g.x + fx / d * 12)); g.ty = Math.max(1.5, Math.min(MAP_H - 1.5, g.y + fy / d * 12));
  g.face = g.tx >= g.x ? 1 : -1;
  ghostSay(g, ['У-у-у… не надо!', 'Прочь, прочь!', 'Больно… ухожу…'][(Math.random() * 3) | 0]);
  sfxAt('wail', g.x * TILE, g.y * TILE, 0.7);
}

function ghDie(g, u) {
  g.slain = true; g.hp = 0; g.da = Math.max(0.05, g.alpha); g.exo = Game.time; g.mode = 'leave'; g.modeT = 99;
  g.atkT = 0; g.atkU = null; g.holdUntil = 0; g.tx = g.x; g.ty = g.y;
  ghostSay(g, ['Свет… наконец-то…', 'Отпустили… спасибо…', 'Я иду домой…'][(Math.random() * 3) | 0]);
  fxBurst(g.x * TILE, g.y * TILE - 16, 26, ['#ffffff', '#fff6c0', '#bfffe0', '#6fd0b0'], 110, 70, 1.1, 2.2, -50);
  sfxAt('wail', g.x * TILE, g.y * TILE, 0.6); sfxAt('chime', g.x * TILE, g.y * TILE, 0.9);
  if (Math.random() < 0.4) dropPile(Math.floor(g.x), Math.floor(g.y), 'gold', 1);
  if (u && typeof neuGiveXp === 'function') neuGiveXp(g, u, GH.XP + GH.XP_NIGHT * Math.min(10, nightIndex()));
  Game.ghostSlain = (Game.ghostSlain || 0) + 1;
  logEvent('night', `${ghWho(u)} развеял призрака`, g.x, g.y);
}

function ghostSay(g, text) { floater(g.x, g.y - 1.6, text, '#cfe6ff'); }

function ghostsTick(dt) {
  const gs = Game.ghosts;
  if (!gs || !gs.length) return;
  const dark = nightAmt();
  let gyd, live;
  for (let i = gs.length - 1; i >= 0; i--) {
    const g = gs[i];
    g.ph += dt * 2.2; g.modeT -= dt; g.retarget -= dt;
    if (g.rev === false) {
      // ещё не проступил: ждёт темноты. Если за вечер выросло кладбище — выходит уже из него (в ту же ночь)
      if (dark < (g.appear || GHOST_APPEAR)) { if (isDawnNow() || (!isNightNow() && !isEveningNow())) gs.splice(i, 1); continue; }
      g.rev = true;
      if (!g.fromGy && (gyd === undefined ? (gyd = graveyardOf() || null) : gyd)) {
        const sp = ghostSpot(gyd, live || (live = Game.units.filter(u => !u.dead)));
        g.x = g.hx = g.tx = sp.x; g.y = g.hy = g.ty = sp.y; g.fromGy = true;
      }
    }
    const leaving = g.mode === 'leave' || isDawnNow() || (!isNightNow() && !isEveningNow());   // уходят с рассветом (вечером ещё светло — тогда не гаснут)
    if (!g.fade) g.fade = 0.15 + Math.random() * 0.35;      // растворяются не разом, а кто когда
    g.alpha = Math.max(0, Math.min(1, g.alpha + (leaving ? -dt * (g.mode === 'leave' ? 0.5 : g.fade) : dt * 0.35)));
    if (leaving && g.alpha <= 0) { gs.splice(i, 1); continue; }
    if (g.mode !== 'drift' && g.modeT <= 0) {
      if (g.mode === 'calm') {
        // наелся: благодарит, иногда оставляет монету, растворяется
        ghostSay(g, ['Спасибо…', 'Вкусно… я помню вкус…', 'Теперь можно и на покой'][Math.floor(Math.random() * 3)]);
        if (Math.random() < 0.38) { dropPile(Math.floor(g.x), Math.floor(g.y), 'gold', 1); logEvent('night', 'Призрак отблагодарил золотой монеткой', g.x, g.y); }
        g.mode = 'leave'; g.modeT = 99;
      } else g.mode = 'drift';
    }
    if (g.kind === 'reaper') { reaperTick(g, dt); if (g.mode === 'boo' && g.modeT <= 0) g.mode = 'drift'; continue; }     // жнец: своя механика (reaper.js)
    if (g.mode === 'grab') { ghGrabTick(g, dt); continue; }       // уносит гнома — больше ничем не занят
    if (g.slain) continue;                                        // развеян: только тает
    ghInit(g);
    if (g.mode === 'flee') {                                      // удирает от обидчика, никого не пугает
      const dx = g.tx - g.x, dy = g.ty - g.y, d = Math.hypot(dx, dy);
      if (d > 0.3) { g.x += dx / d * GH.FLEE_SPD * dt; g.y += dy / d * GH.FLEE_SPD * dt; g.face = dx >= 0 ? 1 : -1; }
      g.hx = g.x; g.hy = g.y;
      continue;
    }
    if (ghProv(g)) {                                              // в бою: бросается на обидчика и бьёт когтями
      const u = ghTarget(g);
      if (u && !leaving && g.alpha >= 0.3) {
        if (g.atkT > 0) { ghostStrikeTick(g, dt); continue; }
        if (g.abStun > Game.time) continue;
        const dx = u.x - g.x, dy = u.y - g.y, d = Math.hypot(dx, dy) || 1;
        g.face = dx >= 0 ? 1 : -1;
        if (d > 1.2) { const st = Math.min(d - 1.2, GH.SPD * dt); g.x += dx / d * st; g.y += dy / d * st; }
        g.hx = g.x; g.hy = g.y; g.tx = g.x; g.ty = g.y;
        if (d < GH.REACH && (g.sweepCD || 0) < Game.time) { g.sweepCD = Game.time + GH.CD; ghostStrike(g, u); }
        continue;
      }
    } else if (g.hp < g.mhp) g.hp = Math.min(g.mhp, g.hp + GH.REGEN * dt);   // вне боя раны затягиваются
    if (g.atkT > 0) ghostStrikeTick(g, dt);
    else if (g.mode === 'drift' || g.mode === 'boo') {
      if (g.retarget <= 0 || Math.hypot(g.tx - g.x, g.ty - g.y) < 0.6) {
        g.tx = Math.max(1.5, Math.min(MAP_W - 1.5, g.hx + (Math.random() - 0.5) * 18)); g.ty = Math.max(1.5, Math.min(MAP_H - 1.5, g.hy + (Math.random() - 0.5) * 14)); g.retarget = 3 + Math.random() * 5;
        // иногда тянется к ближайшему гному
        if (Math.random() < 0.5) { const u = Game.units[(Math.random() * Game.units.length) | 0]; if (u && !u.inside) { g.tx = u.x; g.ty = u.y; } }
      }
      const dx = g.tx - g.x, dy = g.ty - g.y, d = Math.hypot(dx, dy) || 1, sp = g.mode === 'boo' ? 0.2 : 0.9;
      g.x += dx / d * sp * dt; g.y += dy / d * sp * dt; g.face = dx >= 0 ? 1 : -1;
    }
    if (leaving || g.alpha < 0.3) continue;      // ещё не проступил (или уже тает) — не пугает
    g.scan -= dt;
    if (g.scan > 0) continue;
    g.scan = 0.7;
    // гномы: либо угощение, либо испуг
    for (const u of Game.units) {
      if (u.inside || u.dead || !isPerson(u) || u.type === 'carter' || (u.ghostCD || 0) > Game.time) continue;
      if (Math.hypot(u.x - g.x, u.y - g.y) > GHOST_SEE) continue;
      if (g.mode === 'drift' && u.carry === 'bread' && Math.random() < 0.6) {
        u.ghostCD = Game.time + 40;
        u.carryN = (u.carryN || 1) - 1; if (u.carryN <= 0) u.carry = null;
        g.mode = 'calm'; g.modeT = 7; g.tx = g.x; g.ty = g.y;
        floater(u.x, u.y - 1.2, 'Хлебушек… держи', '#ffe9b0');
        logEvent('night', `${UNIT_TYPES[u.type].name} угостил призрака хлебом`, u.x, u.y);
        break;
      }
      if (g.mode === 'drift' && ghCanTake(g, u)) { ghTakes(g, u); break; }   // редко: одинокого гнома хватает и уносит
      if (g.mode === 'calm' || !interruptible(u)) continue;      // успокоенный призрак больше не пугает
      u.ghostCD = Game.time + 40;
      floater(u.x, u.y - 1.2, 'Призрак!', '#dcecff');
      if (Math.random() < 0.5) { startBreak(u, 'freeze', null); u.proc = freezeGen(u); }
      else { startBreak(u, 'flee', null); u.proc = fleeGen(u); }
      if (g.mode === 'drift') { g.mode = 'boo'; g.modeT = 1.6; sfxAt('wail', g.x * TILE, g.y * TILE, 1); }
    }
    // нечисть тоже боится: пятится и бросает свои дела
    if (g.mode === 'calm') continue;
    for (const e of Game.ents || []) {
      if ((e.state !== 'walk' && e.state !== 'smash') || (e.ghostCD || 0) > Game.time) continue;
      if (Math.hypot(e.x - g.x, e.y - g.y) > GHOST_SEE_ENT) continue;
      e.ghostCD = Game.time + 30;
      e.target = null; e.goal = null; e.state = 'ghosted'; e.t = 0; e.gFrom = [g.x, g.y];
      floater(e.x, e.y - (e.rock ? 1.2 : 2.6), 'У-у-у!..', '#dcecff');
      if (g.mode === 'drift') { g.mode = 'boo'; g.modeT = 1.6; sfxAt('wail', g.x * TILE, g.y * TILE, 1); }
    }
  }
}

// Удар: призрак бросается на героя, дерзнувшего его изгонять; на самого гнома он не нападает — только пугает
function ghostStrike(g, u) { if (!(g.atkT > 0)) { g.atkT = 0.001; g.atkU = u; g.atkHit = false; g.face = u.x >= g.x ? 1 : -1; sfxAt('wail', g.x * TILE, g.y * TILE, 1); } }
function ghostStrikeTick(g, dt) {
  g.atkT += dt;
  const u = g.atkU, k = g.atkT / GHOST_ATK_DUR;
  if (u && !u.dead) {
    const dx = u.x - g.x, dy = u.y - g.y, d = Math.hypot(dx, dy) || 1;
    g.face = dx >= 0 ? 1 : -1;
    if (k > 0.3 && k < 0.6 && d > 1.0) { g.x += dx / d * 5 * dt; g.y += dy / d * 5 * dt; }      // бросок
    else if (k >= 0.6 && d < 1.6) { g.x -= dx / d * 1.6 * dt; g.y -= dy / d * 1.6 * dt; }        // отдача
    if (!g.atkHit && k >= 0.5) {
      g.atkHit = true;
      const rp = g.kind === 'reaper';
      if (d < (rp ? REAPER_REACH : 2.4) && u.hero) {
        hlHurt(u, rp ? 5 + Math.random() * 3 : 2 + Math.random() * 2, 'ghost');
        fxBurst(u.x * TILE, u.y * TILE - 14, 8, ['#bfffe0', '#6fd0b0', '#e8fff6'], 40, 50, 0.7, 1.6, -20);
        floater(u.x, u.y - 2.4, 'Холод пробирает!', '#bfeaff');
      } else if (!rp && d < 2.4 && u.rec && typeof neuHurtUnit === 'function') {     // рекрут, что бьётся с призраком, тоже мёрзнет
        neuHurtUnit(u, 2 + Math.random() * 2);
        floater(u.x, u.y - 2.4, 'Холод!', '#bfeaff');
      }
    }
  }
  if (g.atkT >= GHOST_ATK_DUR) { g.atkT = 0; g.atkU = null; }
}

function ghostLights(L, x0, y0, x1, y1) {
  for (const g of Game.ghosts || []) if (g.x > x0 - 4 && g.x < x1 + 4 && g.y > y0 - 4 && g.y < y1 + 4)
    L.push([g.x * TILE, g.y * TILE - 12, 46, 0.5 * g.alpha, 'ent']);
}

// ---------- Спрайты ----------
// Призрак-гном в духе некрополя: рваный саван без ног, пустые глазницы с тлеющими зрачками,
// костлявые когти, борода как мокрый туман. 9 кадров плавания (петля) и 8 кадров удара когтями.
// Кадры рисуются один раз в offscreen-холсты (в 2× для чёткости), в игре только blit.

const GHOST_FRAMES = 9, GHOST_ATK_FRAMES = 8, GHOST_ATK_DUR = 0.9, GHOST_SS = 3, GHOST_W = 60, GHOST_H = 76, GHOST_OX = 30, GHOST_OY = 32;
const GHOST_CACHE = {};

// Мелкий пиксель (PX_FINE > 1): призрак и жнец рисуются вдвое плотнее и сводятся в пиксель-арт
// с шагом 1/PX_FINE игрового пикселя; полупрозрачные клочья режем пониже, чтобы тело не таяло.
function ghFineSS() { return PX_FINE > 1 ? 2 * PX_FINE : GHOST_SS; }
function ghFinePx(cv) {
  if (PX_FINE <= 1) return cv;
  const out = toPixelArt(cv, 2, { outline: true, outlineDark: 0.5, alphaCut: 60, clean: true });
  out.fine = PX_FINE;
  return out;
}

function ghostSprite(mood, i) {
  const key = mood + i;
  let cv = GHOST_CACHE[key];
  if (cv) return cv;
  const S = ghFineSS();
  cv = document.createElement('canvas');
  cv.width = GHOST_W * S; cv.height = GHOST_H * S;
  const c = cv.getContext('2d');
  c.scale(S, S); c.translate(GHOST_OX, GHOST_OY);
  const atk = mood === 'atk', grab = mood === 'grab' || mood === 'carry';
  paintGhost(c, grab ? (mood === 'carry' ? i / 4 : 0) : atk ? 0 : i / GHOST_FRAMES, mood, grab ? (mood === 'carry' ? 8 : i) : atk ? i / (GHOST_ATK_FRAMES - 1) : 0);
  return (GHOST_CACHE[key] = ghFinePx(cv));
}

// p — фаза плавания 0..1 (петля), k — ход удара 0..1: замах (0–.35), бросок (.35–.6), отдача
function paintGhost(c, p, mood, k) {
  const atk = mood === 'atk', gp = mood === 'grab' || mood === 'carry' ? ghPoseAt(Math.round(k)) : null, boo = mood === 'boo' || atk || !!gp, calm = mood === 'calm';
  const TAU = Math.PI * 2, sn = (m, o = 0) => Math.sin(p * TAU * m + o);
  const sm = x => x * x * (3 - 2 * x);
  const wind = atk ? sm(Math.min(1, k / 0.35)) : 0;
  const strike = atk ? sm(Math.max(0, Math.min(1, (k - 0.35) / 0.25))) : 0;
  const recoil = atk ? sm(Math.max(0, (k - 0.6) / 0.4)) : 0;
  const lean = gp ? gp.lean : atk ? (-3 * wind + 9 * strike) * (1 - recoil) : 0;         // наклон корпуса (+ вперёд)
  const sway = sn(1) * 1.8 + lean * 0.5;
  c.lineJoin = 'round'; c.lineCap = 'round';
  // тело-саван: S-образный хвост, тянущийся за призраком
  const tailLen = 44 - (atk ? 6 * strike : 0), N = 22, L = [], R = [];
  for (let n = 0; n <= N; n++) {
    const t = n / N, y = -3 + t * tailLen;
    const hw = 9.5 * Math.pow(1 - t, 0.75) + 0.6 + (t > 0.3 ? Math.sin(t * 41 + (n % 3) * 1.7 + p * TAU) * 1.3 * t : 0);
    const cx = lean * (1 - t) * 0.9 + sn(1, -t * 5.2) * (1.2 + t * 7) - (atk ? strike * t * 6 : 0);
    L.push([cx - hw, y]); R.push([cx + hw, y]);
  }
  const body = () => {
    c.beginPath(); c.moveTo(L[0][0], L[0][1]);
    for (const q of L) c.lineTo(q[0], q[1]);
    for (let n = R.length - 1; n >= 0; n--) c.lineTo(R[n][0], R[n][1]);
    c.closePath();
  };
  // внешняя дымка
  let g = c.createLinearGradient(0, -8, 0, 40);
  g.addColorStop(0, 'rgba(150,235,215,0.40)'); g.addColorStop(1, 'rgba(90,200,200,0)');
  c.fillStyle = g; c.save(); c.scale(1.22, 1); body(); c.fill(); c.restore();
  // сам саван: бледный сверху, прозрачный снизу
  g = c.createLinearGradient(0, -8, 0, 40);
  g.addColorStop(0, 'rgba(226,248,240,0.95)'); g.addColorStop(0.35, 'rgba(150,205,198,0.78)'); g.addColorStop(0.7, 'rgba(80,140,150,0.4)'); g.addColorStop(1, 'rgba(50,100,125,0)');
  c.fillStyle = g; body(); c.fill();
  // тёмная пустота внутри: сквозь грудь виден мрак, рёбра, складки
  c.save(); body(); c.clip();
  g = c.createRadialGradient(lean * 0.5, 4, 1, lean * 0.5, 6, 11); g.addColorStop(0, 'rgba(6,24,30,0.7)'); g.addColorStop(1, 'rgba(6,24,30,0)');
  c.fillStyle = g; c.fillRect(-14, -6, 28, 24);
  c.strokeStyle = 'rgba(224,250,240,0.55)'; c.lineWidth = 0.8;
  for (let r = 0; r < 4; r++) { const y = r * 3.1; c.beginPath(); c.moveTo(-5 + r * 0.4 + lean * 0.5, y); c.quadraticCurveTo(lean * 0.5, y + 2.4, 5 - r * 0.4 + lean * 0.5, y); c.stroke(); }
  // зернистое растворение: чем ниже, тем больше «выеденных» крупинок — хвост не обрезан, а рассыпается в дымку
  let sd = (Math.floor(p * GHOST_FRAMES) * 131 + Math.floor(k * 7) * 17 + 7) % 2147483647;
  const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  c.globalCompositeOperation = 'destination-out';
  for (let n = 0; n < 420; n++) {
    const t = 0.25 + rnd() * 0.75, i = Math.min(N, Math.floor(t * N)), y = -3 + t * tailLen;
    if (rnd() > Math.pow(t, 1.5) * 1.05) continue;
    const x = L[i][0] + rnd() * (R[i][0] - L[i][0]) * 1.3 - 1, z = 0.5 + rnd() * 1.3;
    c.fillStyle = `rgba(0,0,0,${0.55 + rnd() * 0.45})`; c.fillRect(x, y, z, z);
  }
  c.globalCompositeOperation = 'source-over';
  c.restore();
  // крупинки ушедшей дымки: парят под и рядом с хвостом, как искры у костра, только холодные
  for (let n = 0; n < 26; n++) {
    const t = 0.35 + rnd() * 0.75, i = Math.min(N, Math.floor(t * N)), y = -3 + t * tailLen + rnd() * 4;
    const x = L[i][0] + (rnd() * 1.6 - 0.3) * (R[i][0] - L[i][0]) + sn(1, n) * 1.5, z = 0.5 + rnd() * 0.9;
    c.fillStyle = `rgba(${190 + rnd() * 40 | 0},255,${225 + rnd() * 20 | 0},${(0.55 - (t - 0.35) * 0.4) * (0.4 + rnd() * 0.6)})`; c.fillRect(x, y, z, z);
  }
  // тончайшие нити тумана по краям хвоста
  for (let w = 0; w < 5; w++) {
    const side = w % 2 ? 1 : -1, t0 = 0.3 + w * 0.09, a = (side > 0 ? R : L)[Math.floor(t0 * N)];
    const len = 11 + (w * 5 % 8), ph = p * TAU + w * 1.9;
    c.strokeStyle = `rgba(200,245,235,${0.34 - w * 0.04})`; c.lineWidth = 0.55;
    c.beginPath(); c.moveTo(a[0], a[1]);
    c.bezierCurveTo(a[0] + side * 4, a[1] + len * 0.3, a[0] + side * 2 + Math.sin(ph) * 3.5, a[1] + len * 0.7, a[0] + side * 6 + Math.sin(ph + 1) * 4, a[1] + len);
    c.stroke();
  }
  // порванная цепь на запястье: звенья качаются
  const chx = -11 + sn(2, 1) * 1.2 - (atk ? 4 * wind : 0), chy = 9 + sn(1, 2) * 1.6;
  c.strokeStyle = 'rgba(150,170,175,0.85)'; c.lineWidth = 1.1;
  for (let l = 0; l < 3; l++) { c.beginPath(); c.ellipse(chx - 1 + l * 0.6, chy + l * 2.6, 1.2, 1.7, l % 2 ? 0.6 : -0.4, 0, 7); c.stroke(); }
  // борода: длинные пряди тумана
  c.lineWidth = 1.3;
  for (let b = -3; b <= 3; b++) {
    c.strokeStyle = `rgba(236,252,246,${0.85 - Math.abs(b) * 0.08})`;
    c.beginPath(); c.moveTo(b * 1.3 + lean * 0.4, 3);
    c.quadraticCurveTo(b * 2 + sn(1, b * 0.9) * 2.2 + lean * 0.5, 9, b * 1.5 + sn(2, b * 1.3) * 3 + lean * 0.3 - strike * 3, 15 + Math.abs(b) * 1.3 + (3 - Math.abs(b)) * 2);
    c.stroke();
  }
  // костлявые руки с когтями
  for (const s of [-1, 1]) {
    const shx = s * 6 + lean * 0.5, shy = 1;
    let hx, hy;
    if (gp) { [hx, hy] = s > 0 ? gp.hf : gp.hn; }
    else if (atk) {
      // замах: руки воздеты над головой; бросок: обе вперёд и вниз; отдача: обвисли
      const wx = s * 7 - 3, wy = -21, sx = 21 - s * 2, sy = 11 - s * 3, rx = s * 11, ry = 6;
      const lift = Math.max(wind, 0.15);
      hx = (wx + (sx - wx) * strike) * (1 - recoil) + rx * recoil; hy = (wy + (sy - wy) * strike) * (1 - recoil) + ry * recoil;
      hx = shx + (hx - shx) * lift; hy = shy + (hy - shy) * lift;
    } else {
      hx = s * 14 + (calm ? -s * 4 : 0) + sn(1, s) * 1.6; hy = (calm ? 12 : boo ? -15 : 3) + sn(2, s * 1.3) * 2.6;
    }
    const mx = (shx + hx) / 2 + s * 2, my = (shy + hy) / 2 + 5 + sn(1, s * 2) * 1.4;
    // рука бестелесная, как и хвост: от плеча тает в дымку, к кисти снова проступает контуром
    const ag = c.createLinearGradient(shx, shy, hx, hy);
    ag.addColorStop(0, 'rgba(200,245,235,0.5)'); ag.addColorStop(0.5, 'rgba(170,230,220,0.1)'); ag.addColorStop(1, 'rgba(225,255,248,0.6)');
    c.strokeStyle = 'rgba(150,235,215,0.1)'; c.lineWidth = 4.2;
    c.beginPath(); c.moveTo(shx, shy); c.quadraticCurveTo(mx, my, hx, hy); c.stroke();
    c.strokeStyle = ag; c.lineWidth = 0.7;
    for (const o of [-1.1, 1.1]) { c.beginPath(); c.moveTo(shx, shy + o); c.quadraticCurveTo(mx, my + o * 1.4, hx, hy + o * 0.6); c.stroke(); }
    // огромная лапа: полупрозрачная ладонь с контуром и длинными изогнутыми когтями
    const ang = Math.atan2(hy - my, hx - mx), pk = gp ? 1 - 0.3 * gp.k : 1;
    paintGhostHand(c, hx, hy, ang, 11.5 + (atk ? strike * 3 : 0), boo, pk);
  }
  // голова с колпаком
  c.save(); c.translate(lean * 0.7, atk ? 1.5 * strike - wind : 0);
  const tip = sn(1, 0.6) * 2.2 + lean * 0.4;
  // череп
  g = c.createRadialGradient(-1.5, -2, 1, 0, 0, 8); g.addColorStop(0, '#f6fffb'); g.addColorStop(1, '#bcd9d0');
  c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, 6.4, 7.2, 0, 0, 7); c.fill();
  c.fillStyle = 'rgba(20,54,58,0.5)'; c.beginPath(); c.ellipse(-4.4, 3, 1.5, 3.1, 0.25, 0, 7); c.ellipse(4.4, 3, 1.5, 3.1, -0.25, 0, 7); c.fill();
  paintGhostHood(c, tip, sn);
  // глазницы: чёрные провалы под злым наклоном
  const eh = boo ? 4.6 : 3.8;
  c.fillStyle = '#010707';
  for (const e of [-1, 1]) {
    c.beginPath(); c.moveTo(e * 0.7, -3.2); c.lineTo(e * 5.6, -4.8); c.lineTo(e * 4.9, -0.8 + eh * 0.2); c.quadraticCurveTo(e * 3.2, -0.8 + eh, e * 1.7, 0.2 + eh * 0.5); c.closePath(); c.fill();
  }
  // тлеющие зрачки с ореолом
  const eyeCol = boo ? '#ff3a1c' : calm ? '#8fd6ff' : '#6fe0b4', gz = sn(1, 0.4) * 0.6, er = boo ? 1.35 : 0.95;
  for (const e of [-1, 1]) {
    const ex = e * 3.1 + gz, ey = -0.6;
    g = c.createRadialGradient(ex, ey, 0, ex, ey, 4.4); g.addColorStop(0, eyeCol); g.addColorStop(0.35, boo ? 'rgba(255,60,30,0.35)' : 'rgba(150,255,200,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(ex, ey, 4.4, 0, 7); c.fill();
    c.fillStyle = eyeCol; c.beginPath(); c.arc(ex, ey, er, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(ex, ey, er * 0.5, 0, 7); c.fill();
  }
  // нос-провал
  c.fillStyle = '#031010'; c.beginPath(); c.moveTo(0, 1.2); c.lineTo(-1, 3.4); c.lineTo(1, 3.4); c.closePath(); c.fill();
  // пасть: у удара раззявлена в беззвучном крике
  const mh = gp ? 11 : atk ? 5 + 7 * Math.max(wind * 0.5, strike) * (1 - recoil * 0.6) : boo ? 8.5 + sn(6) * 0.8 : calm ? 1.2 : 4.2 + sn(2) * 1.0;
  c.fillStyle = '#010707'; c.beginPath(); c.moveTo(-3.4, 4.2);
  for (let q = 0; q <= 6; q++) c.lineTo(-3.4 + q * 1.13, 4.2 + (q % 2 ? 0.9 : -0.3));
  c.lineTo(3.4, 4.4 + mh * 0.5); c.lineTo(1.7, 4.6 + mh); c.lineTo(0, 4.4 + mh * 0.85); c.lineTo(-1.7, 4.6 + mh); c.lineTo(-3.4, 4.4 + mh * 0.5); c.closePath(); c.fill();
  c.fillStyle = '#eefaf4';
  for (const x of [-2.4, -0.8, 0.8, 2.4]) { c.beginPath(); c.moveTo(x - 0.65, 4.3); c.lineTo(x, 4.3 + (boo ? 3.4 : 1.9)); c.lineTo(x + 0.65, 4.3); c.fill(); }
  if (mh > 6) for (const x of [-1.6, 0, 1.6]) { c.beginPath(); c.moveTo(x - 0.55, 4.6 + mh); c.lineTo(x, 4.6 + mh - 2.2); c.lineTo(x + 0.55, 4.6 + mh); c.fill(); }
  c.restore();
}

function drawGhosts(c) {
  const t = Game.time;
  for (const g of Game.ghosts || []) {
    if (g.alpha <= 0.01) continue;
    const bob = Math.sin(g.ph) * 2.4, px = Math.round(g.x * TILE), py = Math.round(g.y * TILE - 17 - bob);
    const atk = (g.atkT || 0) > 0;
    const rp = g.kind === 'reaper';
    const grab = !rp && g.mode === 'grab' && (g.vsnap || g._gi !== undefined), gi = grab ? ghGrabIndex(g) : -1;
    const mood = grab ? (gi < 9 ? 'grab' : 'carry') : atk ? 'atk' : g.mode === 'boo' ? 'boo' : g.mode === 'calm' ? 'calm' : 'idle';
    const frame = grab ? (gi < 9 ? gi : gi - 9) : atk ? Math.min(GHOST_ATK_FRAMES - 1, Math.floor(g.atkT / GHOST_ATK_DUR * GHOST_ATK_FRAMES)) : Math.floor(t * 9 + g.ph * 1.43) % GHOST_FRAMES;
    const flick = 0.82 + Math.sin(t * 13 + g.ph * 3) * 0.08 + (Math.sin(t * 31 + g.ph) > 0.93 ? -0.25 : 0);   // мерцает, как гаснущая свеча
    const A = g.alpha * flick;
    c.save();
    // холодное свечение вокруг (поверх тумана — призрак виден издалека), у атаки красноватое
    c.globalAlpha = A * (atk ? 0.6 : 0.45); c.globalCompositeOperation = 'lighter';
    const gl = c.createRadialGradient(px, py, 2, px, py, 30);
    gl.addColorStop(0, atk ? 'rgba(255,110,80,0.5)' : rp ? 'rgba(110,170,255,0.4)' : 'rgba(120,255,190,0.5)'); gl.addColorStop(1, 'rgba(120,255,190,0)');
    c.fillStyle = gl; c.beginPath(); c.arc(px, py, 30, 0, 7); c.fill();
    c.globalCompositeOperation = 'source-over';
    // тень на земле: чёрная, дрожащая
    c.globalAlpha = g.alpha * 0.4; c.fillStyle = 'rgba(0,10,10,0.7)'; c.beginPath(); c.ellipse(px, g.y * TILE + 2, 8 + Math.sin(g.ph * 2) * 1.2, 2.2, 0, 0, 7); c.fill();
    // кадр
    c.translate(px, py); c.scale(g.face, 1);
    c.globalAlpha = A;
    c.imageSmoothingEnabled = true;
    if (rp && typeof reaperPxFrame === 'function') {
      // пиксельный жнец (reaperpx.js): рога — одна из трёх форм g.var, у каждой свой колпак; ряса — полосы или рваньё (g.rag)
      const rm = atk ? 'atk' : mood === 'boo' ? 'boo' : 'idle';
      const rf = atk ? Math.floor(g.atkT / GHOST_ATK_DUR * RPX_N.atk) : Math.floor(t * 10 + g.ph * 1.27) % RPX_N[rm];
      c.imageSmoothingEnabled = false;
      c.drawImage(reaperPxFrame(g, 'R2', rm, rf, (g.var || 0) % 3, g.rag === 'T1' || g.rag === 'T2' ? g.rag : (g.var || 0) % 2 ? 'T2' : 'T1'), -40, -43, 81, 103);
    }
    else if (rp) blitFine(c, reaperSprite(mood === 'atk' ? 'atk' : mood === 'boo' ? 'boo' : 'idle', atk ? Math.min(REAPER_ATK_FRAMES - 1, Math.floor(g.atkT / GHOST_ATK_DUR * REAPER_ATK_FRAMES)) : Math.floor(t * 8 + g.ph * 1.27) % REAPER_FRAMES, g.var || 0), -GHOST_OX * REAPER_SC, -GHOST_OY * REAPER_SC, GHOST_W * REAPER_SC, GHOST_H * REAPER_SC);
    else if (typeof GHOST_PX !== 'undefined' && GHOST_PX.length && !grab) {
      // пиксельный облик (ghostpx.js, A или B по g.look): гибель по угасанию, вспышка раны, бегство
      const pm = g.slain ? 'die' : Game.time - (g.hurtT || -9) < 0.25 ? 'hurt' : g.mode === 'flee' ? 'flee' : mood;
      const pf = pm === 'die' ? fzDieF(g.alpha, g.da) : pm === 'atk' ? Math.floor(g.atkT / GHOST_ATK_DUR * GPX_N.atk) : Math.floor(t * GPX_FPS + g.ph * 1.43) % GPX_N[pm];
      if (g.slain) c.globalAlpha = Math.min(1, flick);
      c.imageSmoothingEnabled = false;
      c.drawImage(ghostPxFrame(g, GHOST_PX.includes(g.look) ? g.look : GHOST_PX[0], pm, pf, g.rag === 'T1' || g.rag === 'T2' ? g.rag : ''), -GHOST_OX, -GHOST_OY, GHOST_W, GHOST_H);
    }
    else blitFine(c, ghostSprite(mood, frame), -GHOST_OX, -GHOST_OY, GHOST_W, GHOST_H);
    if (grab && g.vsnap) { c.imageSmoothingEnabled = false; ghDrawVictim(c, g, Math.min(8, gi), g.alpha, px, py); }
    c.restore();
    // клочья тумана, уходящие вверх от призрака
    c.save(); c.globalAlpha = 1;
    for (let j = 0; j < 4; j++) { const q = (t * 0.5 + j * 0.25 + g.ph) % 1; c.fillStyle = `rgba(190,255,225,${0.28 * (1 - q) * g.alpha})`; c.beginPath(); c.arc(px + Math.sin(q * 6 + j * 2) * 8, py + 10 - q * 30, 2 + q * 3, 0, 7); c.fill(); }
    c.restore();
  }
}
