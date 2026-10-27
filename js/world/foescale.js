'use strict';
// Сила окружения растёт вместе с героем (жалоба владельца: «герой просто всех убивает, призраков слишком много»).
// · Сила героя P = уровень + заточка×0,5 + оружие + доспех (берётся самый сильный живой герой; в коопе — на сервере).
// · Пока P ≤ p0, всё как раньше (слабому герою не хуже). Выше — у нейтралов и врагов больше ХП (урон героя делится
//   на hpMul), их удары по герою сильнее (dmgMul), скелеты/ходячие деревья/волки держат больше ударов (hitsMul),
//   а один удар героя снимает не больше oneHit от полного ХП (кроме «добивающих» ультимейтов).
// · Призраков за ночь меньше; потолок зависит от силы героя и числа павших.
// · Полоски ХП: одна общая fsBar для всех видов, видна, пока существо ранено или в бою.
// Все числа — в FOE_SCALE ниже. Подключается после banish.js (обёртки killFoe/drawGhosts/neuHurtUnit).

const FOE_SCALE = {
  on: true,
  pw: { lvl: 1, enh: 0.5, weapon: 1, armor: 1 },   // из чего складывается сила героя
  p0: 3,                    // до этой силы враги как раньше (герой 1–2 ур. без снаряжения)
  hpPer: 0.10, hpMax: 2.5,  // ХП врагов: +10% за единицу силы сверх p0, не больше ×2,5
  dmgPer: 0.05, dmgMax: 1.6, // урон врагов по герою: +5% за единицу, не больше ×1,6
  hitsPer: 0.12, hitsMax: 3, // число ударов для скелетов, деревьев, волков: ×(1+0,12·…), не больше ×3
  oneHit: 0.45,             // один удар (или способность) героя снимает не больше 45% полного ХП, когда враги усилены
  ghost: { base: 1, rnd: 1, lostDiv: 4, capBase: 2, capPw: 5, capLost: 6, capMax: 6 },
};

const FS = { t: -99, p: 0, mob: null };

function fsHeroPower() {
  if (typeof Game === 'undefined' || !Game.units) return 0;
  if (Game.time - FS.t < 1 && Game.time >= FS.t) return FS.p;
  const W = FOE_SCALE.pw;
  let best = 0;
  for (const u of Game.units) {
    const H = u.hero;
    if (!H || u.dead) continue;
    const e = H.equip || {}, enh = typeof enhLv === 'function' ? enhLv(H) : 0;
    const p = (H.level || 1) * W.lvl + enh * W.enh + (e.weapon ? W.weapon : 0) + (e.armor ? W.armor : 0);
    if (p > best) best = p;
  }
  FS.t = Game.time; FS.p = best;
  return best;
}
const fsOver = () => Math.max(0, fsHeroPower() - FOE_SCALE.p0);
const fsHpMul = () => FOE_SCALE.on ? Math.min(FOE_SCALE.hpMax, 1 + FOE_SCALE.hpPer * fsOver()) : 1;
const fsDmgMul = () => FOE_SCALE.on ? Math.min(FOE_SCALE.dmgMax, 1 + FOE_SCALE.dmgPer * fsOver()) : 1;
const fsHitsMul = () => FOE_SCALE.on ? Math.min(FOE_SCALE.hitsMax, 1 + FOE_SCALE.hitsPer * fsOver()) : 1;
const fsForce = () => typeof KIT !== 'undefined' && KIT.force;

// удар героя по нейтралу/врагу (neutrals.js neuHit, enemy.js foeHit): возвращает урон с учётом силы окружения
function fsHeroHit(N, u, dmg) {
  if (!u || !u.hero || !(dmg > 0) || fsForce()) return dmg;
  const m = fsHpMul();
  if (m <= 1) return dmg;
  return Math.min(dmg / m, N.mhp * FOE_SCALE.oneHit);
}

// сколько призраков вывести за ночь и сколько их может быть сразу (ghosts.js, night.js, save.js)
function fsGhostCount() {
  const G = FOE_SCALE.ghost, lost = Game.lostGnomes || 0;
  return G.base + Math.floor(Math.random() * (G.rnd + 1)) + Math.floor(lost / G.lostDiv);
}
function fsGhostCap() {
  const G = FOE_SCALE.ghost, lost = Game.lostGnomes || 0;
  return Math.min(G.capMax, G.capBase + Math.floor(fsHeroPower() / G.capPw) + Math.floor(lost / G.capLost));
}

// ---------- Общая полоска ХП ----------
// r — доля здоровья 0…1, top — верх полоски в пикселях мира
function fsBar(c, px, top, r, w) {
  w = w || 22; r = Math.max(0, Math.min(1, r));
  const x = Math.round(px - w / 2), y = Math.round(top);
  c.fillStyle = 'rgba(10,6,4,0.85)'; c.fillRect(x - 1, y - 1, w + 2, 5);
  c.fillStyle = '#3a1a14'; c.fillRect(x, y, w, 3);
  c.fillStyle = r > 0.5 ? '#5ac04a' : r > 0.25 ? '#e0b030' : '#e04a3a'; c.fillRect(x, y, Math.round(w * r), 3);
  c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(x, y, Math.round(w * r), 1);
}
// показывать: ранен или недавно в бою
const fsBarOn = N => N.hp < N.mhp - 0.5 || (!!N.tg && Game.time - (N.prov == null ? -99 : N.prov) < 8);

// ---------- Скелеты, ходячие деревья, волки и лисы: «держатся» больше ударов ----------
{
  const _kill = killFoe;
  killFoe = function (f, u) {
    const o = f && f.o;
    if (!o || !(f.kind === 'skel' || f.kind === 'ent' || f.kind === 'beast') || fsForce()) return _kill(f, u);
    const mul = u && u.hero ? fsHitsMul() : 1;
    if (o.nhp == null) {
      const base = f.kind === 'skel' ? Math.max(1, Math.round(nightDiff() * 0.9)) : f.kind === 'ent' ? Math.max(1, Math.round(nightDiff())) : 1;
      o.nhp = Math.max(1, Math.round(base * mul)); o.nmax = o.nhp;
    }
    if (f.kind === 'beast') {        // волк и лиса раньше падали с одного удара; у herokit своей «крепости» для них нет
      if (--o.nhp > 0) {
        floater(o.x, o.y - 1.8, `Держится! (${o.nhp})`, '#e8e0c0');
        fxBurst(o.x * TILE, o.y * TILE - 8, 6, ['#8a6a4a', '#c8a880'], 45, 30, 0.4, 1.3, 200);
        return;
      }
    }
    _kill(f, u);
  };
}

// ---------- Урон врагов по герою ----------
// только удары самих существ (neuStrike, foeStrike), а не ловушки шпиля, снаряды и прочее, что тоже идёт через neuHurtUnit
{
  const _hu = neuHurtUnit;
  neuHurtUnit = function (u, n) { return _hu(u, FS.mob && u && u.hero ? n * fsDmgMul() : n); };
  const mobHit = (fn, ok) => function (N, tg) {
    const m0 = FS.mob; FS.mob = ok(N) ? N : null;
    try { return fn.apply(this, arguments); } finally { FS.mob = m0; }
  };
  neuStrike = mobHit(neuStrike, () => true);
  foeStrike = mobHit(foeStrike, N => N && N.k !== 'malgor' && !(FSPEC[N.k] && FSPEC[N.k].big));
}

// ---------- Полоски над скелетами, деревьями, зверями и изгоняемыми призраками ----------
{
  const _dg = drawGhosts;
  drawGhosts = function (c) {
    _dg(c);
    const nb = (o, top, w) => { if (o.nmax > 1 && o.nhp > 0 && o.nhp < o.nmax) fsBar(c, o.x * TILE, top, o.nhp / o.nmax, w); };
    for (const s of Game.skels || []) if (s.state === 'roam' || s.state === 'fight') nb(s, s.y * TILE - 34);
    for (const e of Game.ents || []) if (ENT_HIT.has(e.state)) nb(e, e.y * TILE - (e.rock ? 44 : 70), 28);
    for (const a of Game.animals || []) if (!a.dead && (a.kind === 'wolf' || a.kind === 'fox')) nb(a, a.y * TILE - 18, 18);
    // призрак под молитвой героя: полоска тает за время изгнания
    const fx = typeof HL !== 'undefined' && HL.fx;
    if (fx) for (const f of fx) {
      if (f.kind !== 'exo' || !f.g || f.g.exo || !(Game.ghosts || []).includes(f.g)) continue;
      const k = 1 - (Game.time - f.t0) / f.dur;
      if (k > 0) fsBar(c, f.g.x * TILE, f.g.y * TILE - 64, k, 24);
    }
  };
}
