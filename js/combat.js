'use strict';
// Разнообразие боя (см. БОЁВКА.md): телеграф тяжёлых ударов врагов, перекат героя [V] и «идеальный уворот»,
// критическое окно «Открыт», эффекты ударов (оглушение, горение, кровотечение, замедление), комбо с добиванием,
// слабости и сопротивления по стихиям, костёр как оружие, серия побед.
// Всё считается там же, где вся симуляция (в кооперативе — на сервере); клиенты получают метки через neuMirror и только рисуют.
// Подключается после herokit.js/heromana.js: чужие файлы не правятся, всё через обёртки.

const CB = { mul: 1, hooked: false, hint: false };
const CB_ROLL_T = 0.45, CB_ROLL_CD = 5, CB_WIND = 0.24;

// стихия удара по классу и слабости врагов (множитель урона)
const CB_EL = { warrior: 'steel', barbarian: 'steel', rogue: 'steel', monk: 'blunt', archer: 'pierce', mage: 'fire', priest: 'holy', druid: 'nature', paladin: 'holy', bard: 'steel' };
const CB_ELN = { fire: 'огонь', holy: 'свет', steel: 'сталь', pierce: 'стрелы', nature: 'природа', blunt: 'кулаки' };
const CB_WEAK = {
  pixie: { steel: 1.3, nature: 0.7 }, fairy: { steel: 1.3, nature: 0.7 },
  leshy: { fire: 1.6, steel: 1.15, nature: 0.5, pierce: 0.8 },
  boar: { pierce: 1.3, blunt: 0.85 },
  spore: { fire: 1.7, holy: 1.3, nature: 0.5 },
};
// добивание третьим ударом подряд: эффект по классу [эффект, секунд, надпись, цвет]
const CB_FIN = {
  warrior: ['stun', 1.0, 'Оглушён!', '#ffe070'], monk: ['stun', 0.8, 'Оглушён!', '#ffe070'], priest: ['stun', 0.8, 'Ослеплён!', '#fff2a0'],
  paladin: ['stun', 0.9, 'Ослеплён!', '#fff2a0'], bard: ['slow', 3, 'Сбит с ритма!', '#f0a0d0'],
  barbarian: ['bleed', 4, 'Кровь!', '#ff6a5a'], rogue: ['bleed', 4, 'Кровь!', '#ff6a5a'],
  druid: ['slow', 4, 'Корни!', '#8ae070'], archer: ['slow', 3, 'В колено!', '#9ec8ff'], mage: ['burn', 3, 'Горит!', '#ff9a40'],
};
const CB_MASK = { stun: 1, burn: 2, bleed: 4, slow: 8, open: 16 };

const cbEl = u => CB_EL[unitCls(u)] || 'blunt';
const cbWeak = (N, el) => (CB_WEAK[N.k] || {})[el] || 1;
const cbOn = (N, k) => !!(N.fx && N.fx[k] > Game.time);
const cbR2 = v => Math.round(v * 100) / 100;
const cbFighter = u => !!(u && !u.dead && (u.hero || u.rec));

function cbFxSet(N, k, dur, src, text, col) {
  const f = N.fx || (N.fx = {}), now = Game.time;
  f[k] = Math.max(f[k] > now ? f[k] : 0, now + dur);
  if (src) N.fxSrc = src.id;
  if (k === 'stun' && N.st === 'atk') { N.st = 'chase'; N.atkT = 9; N.tel = null; }
  if (text) floater(N.x, N.y - 2.3, text, col || '#fff2a0');
}

// ---------- Урон со слабостями, комбо, эффекты ----------
{
  const _nh = neuHit;
  neuHit = function (N, u, dmg) {
    if (!neuAlive(N) || !cbFighter(u) || dmg >= N.hp) return _nh(N, u, dmg);       // смертельный удар не трогаем
    const now = Game.time, el = cbEl(u), w = cbWeak(N, el);
    let mul = w;
    if (cbOn(N, 'open')) mul *= 2;
    else if (cbOn(N, 'stun')) mul *= 1.25;
    // комбо: три попадания подряд за 2,5 с — «добивание»
    if (!(u.cmbT > now - 2.5)) u.cmbN = 0;
    u.cmbN = (u.cmbN || 0) + 1; u.cmbT = now;
    const fin = u.cmbN >= 3;
    if (fin) { mul *= 1.5; u.cmbN = 0; }
    if (w > 1.2 && !(N.wkT > now - 3)) { N.wkT = now; floater(N.x, N.y - 2.5, `Слабость: ${CB_ELN[el]}!`, '#ffb060'); }
    else if (w < 0.8 && !(N.wkT > now - 3)) { N.wkT = now; floater(N.x, N.y - 2.5, `Стойкий к: ${CB_ELN[el]}`, '#a8b8c8'); }
    const wind = N.st === 'atk' && N.atkT < CB_WIND && N.atkK && N.atkK !== 'light' ? N.atkT : -1;
    _nh(N, u, dmg * mul);
    if (!neuAlive(N)) return;
    if (wind >= 0 && !cbOn(N, 'stun')) { N.st = 'atk'; N.atkT = wind; }        // тяжёлый замах обычным ударом не сбить — только оглушением
    if (fin) {
      floater(u.x, u.y - 2.3, 'Добивание!', '#ffe070');
      fxBurst(N.x * TILE, N.y * TILE - 12, 12, ['#fff2a0', '#ffd070'], 70, 40, 0.5, 1.6, 150);
      const e = CB_FIN[unitCls(u)];
      if (e) cbFxSet(N, e[0], e[1], u, e[2], e[3]);
    } else if (u.cmbN === 2) floater(u.x, u.y - 2.1, 'Серия ×2', '#ffe9a0');
  };

  // «Открытый» враг не промахивается: попадание гарантировано
  const _st = strike;
  strike = function (u, f) {
    const N = f && f.kind === 'neu' && f.o;
    if (N && !f.sure && cbFighter(u) && neuAlive(N) && cbOn(N, 'open')) {
      let dmg = neuDamageOf(u) * neuR(0.8, 1.25);
      if (unitCls(u) === 'rogue' && Math.random() < 0.25) { dmg *= 2; floater(N.x, N.y - 2, 'Крит!', '#e0b0ff'); }
      neuHit(N, u, dmg);
      return;
    }
    _st(u, f);
  };

  // сопротивления нечисти: скелет и ходячее дерево «держатся» по числу ударов
  const _kf = killFoe;
  killFoe = function (f, u) {
    const o = f && f.o;
    if (!(o && (f.kind === 'skel' || f.kind === 'ent')) || !cbFighter(u) || (typeof KIT !== 'undefined' && KIT.force)) return _kf(f, u);
    const el = cbEl(u);
    let extra = 0, say = '', res = false;
    if (f.kind === 'skel') { if (el === 'holy') { extra = 1; say = 'Свет жжёт кости!'; } else if (el === 'blunt') { extra = 1; say = 'Кости трещат!'; } else if (el === 'pierce') res = true; }
    else if (el === 'fire') { extra = 1; say = 'Дерево горит!'; } else if (u.rec ? u.rec.cls === 'barbarian' : unitCls(u) === 'barbarian') { extra = 1; say = 'Топор по дереву!'; } else if (el === 'nature') res = true;
    if (o.open > Game.time) { extra += 1; say = say || 'Открыт: двойной удар!'; }
    _kf(f, u);
    if (!foeAlive(f) || o.nhp == null || o.nhp < 1) return;
    if (res && Math.random() < 0.4) { o.nhp++; floater(o.x, o.y - 2.3, 'Стойкий', '#a8b8c8'); }
    else if (extra) {
      o.nhp -= extra; floater(o.x, o.y - 2.3, say, '#ffb060');
      if (o.nhp <= 0 && typeof abForceKill === 'function') abForceKill(f, u);
    }
  };

  // серия побед: +10% опыта за звено, до +50%
  const _gx = neuGiveXp;
  neuGiveXp = function (N, killer, xp) {
    if (killer && killer.hero) {
      const now = Game.time;
      killer._chn = killer._chT > now - 12 ? (killer._chn || 0) + 1 : 1; killer._chT = now;
      if (killer._chn >= 2) {
        const b = Math.min(0.5, 0.1 * (killer._chn - 1));
        xp = Math.round(xp * (1 + b));
        floater(killer.x, killer.y - 2.6, `Серия побед ×${killer._chn}: +${Math.round(b * 100)}% опыта`, '#ffe070');
      }
    }
    _gx(N, killer, xp);
  };

  // костёр рядом даёт точность
  const _ua = unitAtk;
  unitAtk = function (u) {
    const a = _ua(u);
    return cbFighter(u) && nearBonfire(u.x, u.y, 5) ? Math.min(0.97, a * 1.1) : a;
  };
}

// ---------- Эффекты на врагах и телеграф их ударов ----------
function cbDot(N, dt) {
  const f = N.fx, now = Game.time;
  if (!f) return;
  let d = 0;
  if (f.burn > now) d += N.mhp * 0.04 * dt * cbWeak(N, 'fire');
  if (f.bleed > now) d += N.mhp * 0.025 * dt;
  if (d <= 0) return;
  N.hp -= d; N.dotAcc = (N.dotAcc || 0) + d;
  if (N.dotAcc >= Math.max(1, N.mhp * 0.06)) {
    floater(N.x, N.y - 1.6, '−' + Math.max(1, Math.round(N.dotAcc)), f.burn > now ? '#ff9a40' : '#e04a3a');
    if (f.burn > now) fxBurst(N.x * TILE, N.y * TILE - 14, 5, ['#ff9a40', '#ffd070'], 25, 35, 0.5, 1.4, -40);
    N.dotAcc = 0;
  }
  if (N.hp <= 0 && N.st !== 'die') neuKill(N, neuUnit(N.fxSrc));
}

// какой удар готовит враг: лёгкий — без предупреждения; тяжёлый (леший, кабан) и облако (моховик) — с красным кругом на земле
function cbPlan(N) {
  N.atkN = (N.atkN || 0) + 1;
  let k = 'light';
  if ((N.k === 'leshy' || N.k === 'boar') && N.atkN % 3 === 0) k = 'heavy';
  else if (N.k === 'spore' && N.atkN % 2 === 0) k = 'cloud';
  N.atkK = k;
  const tg = neuUnit(N.tg);
  if (k !== 'light' && tg) {
    N.tel = { k, x: cbR2(tg.x), y: cbR2(tg.y), r: k === 'heavy' ? 1.15 : 1.7, p: 0 }; N.telAt = Game.time;
    floater(N.x, N.y - 2.4, '!', '#ff5a3a');
    sfxAt('thud', N.x * TILE, N.y * TILE, 0.35);
  } else N.tel = null;
}

{
  const _th = neuThink;
  neuThink = function (N, dt) {
    if (N.st === 'die') { N.tel = null; return _th(N, dt); }
    cbDot(N, dt);
    if (N.st === 'die') return;
    if (cbOn(N, 'stun')) { N.fr = 'stagger'; N.tel = null; N.cdA = Math.max(N.cdA, 0.3); return; }
    let d = dt;
    if (cbOn(N, 'slow')) d *= 0.55;
    if (N.st === 'atk' && N.atkT < CB_WIND && N.atkK && N.atkK !== 'light') d *= 0.4;     // долгий замах тяжёлого удара — время среагировать
    _th(N, d);
    if (N.st === 'atk' && N.atkT === 0) cbPlan(N);
    if (N.tel) {
      if (N.st === 'atk' && N.atkT < CB_WIND) N.tel.p = cbR2(N.atkT / CB_WIND);
      else { const tg = neuUnit(N.tg); if (tg && N.st === 'atk') neuStrike(N, tg); N.tel = null; }    // цель отскочила за дальность — удар всё равно приходит в красный круг
    }
  };

  // удар врага: лёгкий — как был; тяжёлый — в клетку, куда целился (отступил или перекатился — мимо)
  const _ns = neuStrike;
  neuStrike = function (N, tg) {
    const now = Game.time, k = N.atkK || 'light', T = N.tel;
    N.tel = null;
    const rolled = u => u && u.hero && u.hero.rollT > now;
    const early = u => u && u.hero && u.hero.rollAt >= (N.telAt || 0) - 0.05;      // перекатился, пока враг замахивался
    if (k === 'light' || !T) {
      if (rolled(tg)) { cbDodged(N, tg, false); return; }
      return _ns(N, tg);
    }
    const hit = [];
    for (const u of Game.units) {
      if (!cbFighter(u) || u.inside || Math.hypot(u.x - T.x, u.y - T.y) > T.r) continue;
      if (rolled(u)) { cbDodged(N, u, true); continue; }
      hit.push(u);
    }
    if (early(tg) && !hit.includes(tg) && !(tg.hero.rollT > now && Math.hypot(tg.x - T.x, tg.y - T.y) <= T.r)) cbDodged(N, tg, true);
    else if (!hit.length && !rolled(tg)) { floater(N.x, N.y - 1.8, 'Мимо!', '#e8e0c0'); return; }
    CB.mul = k === 'heavy' ? 1.6 : 0.8;
    try { for (const u of hit) _ns(N, u); } finally { CB.mul = 1; }
  };
  const _hu = neuHurtUnit;
  neuHurtUnit = function (u, n) { _hu(u, n * CB.mul); };
}

// увернулся перекатом: от тяжёлого удара — «идеальный уворот» (оглушение + открыт)
function cbDodged(N, u, perfect) {
  if (!perfect) { floater(u.x, u.y - 1.9, 'Перекат!', '#cfe8ff'); return; }
  floater(u.x, u.y - 2.1, 'Идеальный уворот!', '#ffe070');
  fxBurst(u.x * TILE, u.y * TILE - 14, 14, ['#ffffff', '#ffe070'], 60, 40, 0.5, 1.6, 100);
  sfxAt('chime', u.x * TILE, u.y * TILE, 0.7);
  cbFxSet(N, 'stun', 1.5, u, 'Оглушён!', '#ffe070');
  cbFxSet(N, 'open', 3, u, null);
  if (u.hero) u.hero.cxp = (u.hero.cxp || 0) + 6;
  floater(N.x, N.y - 2.8, 'Открыт!', '#ffd040');
}

// ---------- Перекат героя ----------
function cbRoll(h) {
  const H = h && h.hero, now = Game.time;
  if (!H || h.dead || h.inside || H.downT || H.hp <= 0 || H.stunUntil > now) return false;
  if (H.rollCd > now) { floater(h.x, h.y - 1.6, `Перекат: ${Math.ceil(H.rollCd - now)} с`, '#e8e0c0'); return false; }
  // в сторону от врага: боком, чтобы не потерять его из виду
  const fs = foesNear(h.x, h.y, 5);
  const foe = fs.find(f => f.kind === 'neu' && f.o.tg === h.id) || fs[0];
  let ax = h.face || 1, ay = 0;
  if (foe) { const dx = h.x - foe.o.x, dy = h.y - foe.o.y, d = Math.hypot(dx, dy) || 1; ax = dx / d; ay = dy / d; }
  const opts = [[-ay, ax], [ay, -ax], [ax, ay]].map(([x, y]) => [x * 1.6, y * 1.6]).filter(([x, y]) => isWalkable(Math.floor(h.x + x), Math.floor(h.y + y)));
  H.rollT = now + CB_ROLL_T; H.rollCd = now + CB_ROLL_CD; H.rollAt = now;
  if (opts.length) {
    const [dx, dy] = opts[(Math.random() * Math.min(2, opts.length)) | 0];
    h.roll = { x0: h.x, y0: h.y, dx, dy, t: 0 };
    if (Math.abs(dx) > 0.2) h.face = dx > 0 ? 1 : -1;
  }
  h.hfx = { k: 'parry', t: now + 0.4 };
  fxBurst(h.x * TILE, h.y * TILE - 4, 8, ['#d8c8a0', '#a89870'], 40, 15, 0.5, 1.6, 200);
  sfxAt('thud', h.x * TILE, h.y * TILE, 0.4);
  return true;
}

// ответный удар нечисти герою: раньше мгновенный (10% × (ночь−1) за удар), теперь с красным кругом на 0,6 с — можно отойти или перекатиться
CB.swings = [];
{
  const _hh = heroHit;
  heroHit = function (u, n, say) {
    if (!CB.direct && u && u.hero && (say === 'Скелет рубит!' || say === 'Ветвью наотмашь!')) {
      const f = foesNear(u.x, u.y, 2.2).find(x => (x.kind === 'skel' || x.kind === 'ent') && !x.o.tel);
      if (f) {
        const now = Game.time, T = { k: 'heavy', x: cbR2(u.x), y: cbR2(u.y), r: 1.1, t0: cbR2(now), at: cbR2(now + 0.6) };
        f.o.tel = T; CB.swings.push({ u, f, n, say, T });
        floater(f.o.x, f.o.y - 2.6, '!', '#ff5a3a');
        return;
      }
    }
    return _hh(u, n, say);
  };
}
function cbSwings() {
  const now = Game.time;
  for (let i = CB.swings.length - 1; i >= 0; i--) {
    const S = CB.swings[i], T = S.T;
    if (now < T.at) continue;
    CB.swings.splice(i, 1);
    const o = S.f.o, u = S.u, H = u.hero;
    if (o.tel === T) o.tel = null;
    if (!foeAlive(S.f) || u.dead || !H) continue;
    const inside = Math.hypot(u.x - T.x, u.y - T.y) <= T.r, early = H.rollAt >= T.t0 - 0.05, rolled = H.rollT > now;
    if (early || (inside && rolled)) {
      floater(u.x, u.y - 2.1, 'Идеальный уворот!', '#ffe070');
      fxBurst(u.x * TILE, u.y * TILE - 14, 12, ['#ffffff', '#ffe070'], 60, 40, 0.5, 1.6, 100);
      o.open = now + 3; H.cxp = (H.cxp || 0) + 6;
      floater(o.x, o.y - 2.8, 'Открыт!', '#ffd040');
    } else if (inside) { CB.direct = true; try { heroHit(u, S.n, S.say); } finally { CB.direct = false; } }
    else floater(o.x, o.y - 1.8, 'Мимо!', '#e8e0c0');
  }
}

function cbTick(dt) {
  const now = Game.time;
  cbSwings();
  if (!CB.hooked && typeof coop !== 'undefined' && coop.players && typeof coopCmd === 'function') {
    CB.hooked = true;
    const _cc = coopCmd;
    coopCmd = function (name, json, admin) {
      let m = null;
      try { m = JSON.parse(json); } catch (e) { return; }
      if (m && m.t === 'roll') { const u = coop.players.get(name); if (u && !u.dead) cbRoll(u); return; }
      return _cc(name, json, admin);
    };
  }
  for (const u of Game.units) {
    const r = u.roll;
    if (!r) continue;
    r.t += dt / 0.3;
    const k = Math.min(1, r.t), nx = r.x0 + r.dx * k, ny = r.y0 + r.dy * k;
    if (isWalkable(Math.floor(nx), Math.floor(ny))) { u.x = nx; u.y = ny; } else u.roll = null;
    if (k >= 1) u.roll = null;
  }
  // костёр жжёт тронутых врагов рядом
  CB.bt = (CB.bt || 0) + dt;
  if (CB.bt >= 0.5) {
    CB.bt = 0;
    for (const N of Game.neutrals || []) {
      if (!neuAlive(N) || !(now - N.prov < NEU_FORGET) || cbOn(N, 'burn') || !nearBonfire(N.x, N.y, 3)) continue;
      cbFxSet(N, 'burn', 2.5, null, 'Горит у костра!', '#ff9a40');
    }
  }
}

{
  const _step = step;
  step = function (dt) { _step(dt); if (!isMirror()) cbTick(dt); };
  const _nm = neuMirror;
  neuMirror = function () {
    const a = _nm(), by = new Map(Game.neutrals.map(N => [N.id, N]));
    for (const d of a) {
      const N = by.get(d.id);
      let m = 0;
      if (N && N.fx) for (const k in CB_MASK) if (N.fx[k] > Game.time) m |= CB_MASK[k];
      d.fxs = m; d.tel = N && N.tel ? N.tel : null;
    }
    return a;
  };
}

// ---------- Рисование: красный круг удара, значки эффектов ----------
function cbTop(N) { return N.k === 'leshy' ? 72 : (N.k === 'fairy' || N.k === 'pixie') ? 54 : N.k === 'boar' ? 46 : 48; }

function cbRing(c, x, y, r, p, col, from) {
  const px = x * TILE, py = y * TILE + 4, rr = r * TILE;
  c.save();
  c.fillStyle = `rgba(${col},${0.1 + 0.15 * p})`;
  c.beginPath(); c.ellipse(px, py, rr, rr * 0.62, 0, 0, 7); c.fill();
  c.fillStyle = `rgba(${col},${0.2 + 0.3 * p})`;
  c.beginPath(); c.ellipse(px, py, rr * p, rr * 0.62 * p, 0, 0, 7); c.fill();
  c.strokeStyle = `rgba(${col},0.9)`; c.lineWidth = 1.5; c.setLineDash([4, 3]);
  c.beginPath(); c.ellipse(px, py, rr, rr * 0.62, 0, 0, 7); c.stroke();
  if (from) { c.beginPath(); c.moveTo(from[0] * TILE, from[1] * TILE + 4); c.lineTo(px, py); c.stroke(); }
  c.restore();
}

function cbDrawTel(c, N) {
  const T = N.tel;
  if (!T || N.st === 'die') return;
  cbRing(c, T.x, T.y, T.r, Math.min(1, T.p || 0), T.k === 'cloud' ? '150,230,60' : '255,60,30', [N.x, N.y]);
}

// ночная нечисть: удар по зданию и ответные удары по бойцам — тоже с красным предупреждением; ответ герою — круг, от которого можно уйти
function cbNightTel(list, c) {
  const now = Game.time;
  for (const e of Game.ents || []) {
    if (e.state === 'smash' && e.target && !e.target.removed) {
      const tt = 0.6 + (e.hitsDone || 0) * 1.1 - e.t;
      if (tt > 0 && tt < 0.5) {
        const b = e.target, p = 1 - tt / 0.5;
        list.push([b.y - 0.5, () => {
          c.save(); c.fillStyle = `rgba(255,60,30,${0.1 + 0.2 * p})`; c.strokeStyle = 'rgba(255,80,40,0.9)'; c.lineWidth = 1.5; c.setLineDash([5, 3]);
          c.fillRect(b.x * TILE, (b.y + b.h - 0.6) * TILE, b.w * TILE, 0.9 * TILE); c.strokeRect(b.x * TILE, (b.y + b.h - 0.6) * TILE, b.w * TILE, 0.9 * TILE); c.restore();
        }]);
      }
    } else if (e.state === 'fight' && e.atk && now - e.atk >= 0 && now - e.atk < 0.75) {
      const p = (now - e.atk) / 0.75;
      for (const u of Game.units) if (!u.dead && !u.inside && Math.hypot(u.x - e.x, u.y - e.y) < 1.5) list.push([u.y - 0.5, () => cbRing(c, u.x, u.y, 0.8, p, '255,60,30')]);
    }
    if (e.tel) { const T = e.tel; list.push([T.y - 0.5, () => cbRing(c, T.x, T.y, T.r, Math.max(0, Math.min(1, (Game.time - T.t0) / (T.at - T.t0))), '255,60,30', [e.x, e.y])]); }
  }
  for (const s of Game.skels || []) if (s.tel) { const T = s.tel; list.push([T.y - 0.5, () => cbRing(c, T.x, T.y, T.r, Math.max(0, Math.min(1, (Game.time - T.t0) / (T.at - T.t0))), '255,60,30', [s.x, s.y])]); }
}

function cbDrawFx(c, N) {
  const m = N.fxs | 0, t = Game.time;
  if (!m || N.st === 'die') return;
  const px = Math.round(N.x * TILE), py = Math.round(N.y * TILE + 6) - cbTop(N) - 6;
  let i = 0;
  const icon = (col, f) => { const x = px - 7 + i * 9; i++; c.fillStyle = '#1a1008'; c.fillRect(x - 1, py - 1, 8, 8); c.fillStyle = col; f(x, py); };
  c.save();
  if (m & 1) icon('#ffe070', (x, y) => { for (let k = 0; k < 3; k++) { const a = t * 6 + k * 2.1; c.fillRect(Math.round(x + 3 + Math.cos(a) * 2.5), Math.round(y + 3 + Math.sin(a) * 1.5), 2, 2); } });
  if (m & 2) icon('#ff8a30', (x, y) => { c.fillRect(x + 2, y + 2, 4, 5); c.fillStyle = '#ffe070'; c.fillRect(x + 3, y + 4, 2, 3); c.fillStyle = '#ff8a30'; c.fillRect(x + 3 + (Math.floor(t * 8) % 2), y, 2, 3); });
  if (m & 4) icon('#e04a3a', (x, y) => { c.fillRect(x + 3, y + 1, 2, 3); c.fillRect(x + 2, y + 4, 4, 3); });
  if (m & 8) icon('#7ac0ff', (x, y) => { c.fillRect(x + 1, y + 3, 6, 2); c.fillRect(x + 3, y + 1, 2, 6); });
  if (m & 16) {
    // золотой прицел: сюда бьют без промаха и вдвое сильнее
    const s = 8 + Math.sin(t * 9) * 1.5;
    c.strokeStyle = '#ffd040'; c.lineWidth = 1.5;
    c.beginPath(); c.arc(Math.round(N.x * TILE), Math.round(N.y * TILE - 8), s, 0, 7); c.stroke();
    c.beginPath(); c.moveTo(N.x * TILE - s - 3, N.y * TILE - 8); c.lineTo(N.x * TILE + s + 3, N.y * TILE - 8); c.moveTo(N.x * TILE, N.y * TILE - 8 - s - 3); c.lineTo(N.x * TILE, N.y * TILE - 8 + s + 3); c.stroke();
  }
  c.restore();
}

{
  const _ds = drawSkeletons;
  drawSkeletons = function (list, c, x0, y0, x1, y1) {
    _ds(list, c, x0, y0, x1, y1);
    cbNightTel(list, c);
    for (const N of Game.neutrals || []) {
      if (N.x < x0 - 3 || N.x > x1 + 3 || N.y < y0 - 3 || N.y > y1 + 4) continue;
      if (N.tel) {
        list.push([N.y - 0.45, () => cbDrawTel(c, N)]);
        if (!CB.hint && typeof toast === 'function' && !(typeof coop !== 'undefined')) {
          CB.hint = true;
          toast('Красный круг — тяжёлый удар врага. Нажмите V (перекат) в последний момент — «идеальный уворот»: враг оглушён, а его можно бить без промаха');
        }
      }
      if (N.fxs) list.push([N.y + 0.3, () => cbDrawFx(c, N)]);
    }
  };
}

// клавиша V — перекат (в общей деревне просьба серверу)
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('keydown', e => {
    if (e.code !== 'KeyV' || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const h = Game.hero;
    if (!h || h.dead || !h.hero) return;
    if (typeof Coop !== 'undefined' && Coop.on) { if (typeof coopSend === 'function') coopSend({ t: 'roll' }); return; }
    cbRoll(h);
  });
}
