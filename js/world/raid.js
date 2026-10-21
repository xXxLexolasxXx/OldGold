'use strict';
// Совместный босс: каркас рейда и первый босс — Курганный князь (нечисть, синие огни, кость и ржавое золото).
// Князь — «нейтрал» особого вида в Game.neutrals: бой героя и рекрутов (fightGen, strike, способности Z/X,
// урон по герою, зеркало для коопа) работает с ним как есть; здесь — знамение, фазы, механики и награды.
// · Знамение: ночью, когда в деревне 2+ героя (одиночка: герой и 2 рекрута за ним), над курганом синие огни;
//   князь встаёт, когда герои подошли (6 клеток). На рассвете уходит в курган с полным здоровьем.
// · Фаза I «Костяной щит» (100–66%): два оберега, пока стоят — по князю идёт четверть урона; стрелки бьют их вдвое,
//   «Изгнание нежити» жреца ломает сразу. Князь зовёт скелетов.
// · Фаза II «Могильный холод» (66–33%): синие круги под героями — через 1,6 с в них бьёт холод. Воин, варвар и монах
//   вплотную к князю «держат» его на себе.
// · Фаза III «Ярость» (<33%): бьёт чаще и пьёт жизнь; удар разбойника со спины — вдвое.
// · Награды: добыча на землю, опыт, вещи; титулы «Победитель князя», «Клинок отряда», «Щит отряда», «Ломатель оберегов».
// Точка интеграции с «Врагом» (ВРАГ.md, Малгор и Чёрный шпиль): raidRegister(kind, spec) + raidStart(kind, x, y) —
// общая шкала, учёт урона, фазы, подсказки, титулы и награды; флаг Game.foe.defeated — за ним, рейд его не трогает.

const RAID_KINDS = {};
const RAID_TANKS = new Set(['warrior', 'barbarian', 'monk']);
const RAID_HP = 260;           // на одного героя
const RAID_RISE_R = 6, RAID_COOLDOWN = 3, RAID_MIN_LVL = 3;   // герои ниже 3-го уровня князя не будят
const RD = { t: 0, hooked: false, cHooked: false, el: null };

const rdServer = () => typeof coop !== 'undefined' && !!coop.players;
const rdMirror = () => typeof Coop !== 'undefined' && !!Coop.on;
function rdSay(text, to) { if (rdServer()) { if (to) coopSay(to, text); else coop.out.push({ msg: { t: 'toast', text } }); } else toast(text); }
const rdNight = () => cycleAt(Game.time).k;

function raidRegister(kind, spec) { RAID_KINDS[kind] = spec; if (spec.nspec) NSPEC[kind] = spec.nspec; for (const k in spec.extra || {}) NSPEC[k] = spec.extra[k]; }
function raidState() { return Game.raid || (Game.raid = { site: null, wins: 0, last: -9, omen: false, f: null }); }

// герои рядом с точкой: в общей деревне — игроки, в одиночке — герой (рекруты «за героем» идут как подмога)
function raidHeroes(x, y, r) {
  const hs = rdServer() ? [...coop.players.values()] : Game.hero ? [Game.hero] : [];
  return hs.filter(h => !h.dead && !h.inside && h.hero && h.hero.hp > 0 && (x == null || Math.hypot(h.x - x, h.y - y) <= r));
}
function raidParty(x, y, r) {
  const hs = raidHeroes(x, y, r).filter(h => (h.hero.level || 1) >= RAID_MIN_LVL);
  if (rdServer()) return hs.length;
  if (!hs.length) return 0;
  const recs = Game.units.filter(u => u.rec && !u.dead && u.rec.order === 'follow' && !(u.rec.train > 0) && (x == null || Math.hypot(u.x - x, u.y - y) <= r + 4)).length;
  return recs >= 2 ? 2 : 1;
}
const rdKey = u => (u && u.hero ? u.hero.name : null);

// ================= Начало, фазы, конец =================

function raidStart(kind, x, y) {
  const K = RAID_KINDS[kind], S = raidState();
  if (!K || S.f) return null;
  const n = Math.max(2, raidHeroes(x, y, 14).length);
  const N = raidMake(kind, x, y, Math.round(K.hpPer * n * dif().neuHp));
  Game.neutrals.push(N);
  S.f = { k: kind, nid: N.id, ph: 0, dmg: {}, taken: {}, wards: {}, marks: [], adds: [], t0: Game.time, n };
  S.omen = false;
  if (K.start) K.start(N, S.f);
  raidPhase(N, S.f, 1);
  rdSay(`${K.name} пробудился! Нужны двое и больше героев — подсказки вверху экрана`);
  logEvent('animal', `${K.name} встал из ${K.lair || 'логова'}`, x, y);
  if (typeof sfxAt === 'function') sfxAt('wail', x * TILE, y * TILE, 1);
  return N;
}

function raidMake(k, x, y, mhp) {
  const N = {
    id: Game.nextId++, k, lair: 0, raid: 1, x, y, hx: x, hy: y, mhp, hp: mhp, lv: 1, face: 1, st: 'idle', t: 1,
    fr: 'i0', ph: 0, tg: 0, prov: Game.time, cdA: 1.5, atkT: 9, hit: 1, ov: ['roar'], ovT: 0, ovP: 0.5, winT: 0, dt: 0, wx: 0, wy: 0, say: 0,
  };
  return N;
}

function raidBoss() { const F = Game.raid && Game.raid.f; return F ? Game.neutrals.find(N => N.id === F.nid) || null : null; }

function raidPhase(N, F, ph) {
  if (F.ph === ph) return;
  F.ph = ph;
  const K = RAID_KINDS[F.k], P = K.phases[ph - 1];
  F.hint = P.hint;
  rdSay(`${K.name} — фаза ${['I', 'II', 'III'][ph - 1] || ph}: «${P.n}». ${P.hint}`);
  floater(N.x, N.y - 3, `«${P.n}»`, '#9ae0ff');
  N.ov = ['roar']; N.ovT = 0; N.ovP = 0.6;
  fxBurst(N.x * TILE, N.y * TILE - 20, 30, ['#6ad0ff', '#bff0ff', '#2a6aaa'], 110, 70, 1, 2.4, -20);
  if (K.phase) K.phase(N, F, ph);
}

function raidEnd(why) {
  const S = Game.raid, F = S && S.f;
  if (!F) return;
  const K = RAID_KINDS[F.k];
  for (let i = Game.neutrals.length - 1; i >= 0; i--) { const N = Game.neutrals[i]; if (N.raid) Game.neutrals.splice(i, 1); }
  S.f = null;
  if (why === 'dawn') { rdSay(`Рассвет: ${K.name} уходит в ${K.lair || 'логово'}. Ещё вернётся`); logEvent('animal', `${K.name} ушёл на рассвете`, S.site ? S.site.x : undefined, S.site ? S.site.y : undefined); }
}

function raidVictory(N) {
  const S = Game.raid, F = S.f, K = RAID_KINDS[F.k];
  const best = o => { let k = null, v = 0; for (const n in o) if (o[n] > v) { v = o[n]; k = n; } return k; };
  const blade = best(F.dmg), shield = best(F.taken), breaker = best(F.wards);
  // награда — всем, кто бился (даже если сейчас лежит) или стоит рядом
  const all = rdServer() ? [...coop.players.values()] : Game.hero ? [Game.hero] : [];
  const hs = all.filter(h => !h.dead && h.hero && (Math.hypot(h.x - N.x, h.y - N.y) <= 16 || F.dmg[h.hero.name] || F.taken[h.hero.name]));
  for (const h of hs) {
    const H = h.hero, nm = H.name, ts = [K.title];
    if (nm === blade) ts.push('Клинок отряда');
    if (nm === shield) ts.push('Щит отряда');
    if (nm === breaker) ts.push('Ломатель оберегов');
    if (rdServer() && H.owner) {
      if (typeof coopGiveXp === 'function') coopGiveXp(H, K.xp);
      coopAddItem(H, 'steak', 2);
      for (const t of ts) coopGiveTitle(H, t);
      coopSay(H.owner, `Победа! +${K.xp} опыта, жаркое ×2, титулы: ${ts.join(', ')}`);
    } else {
      H.cxp = (H.cxp || 0) + K.xp;
      H.titles = H.titles || [];
      for (const t of ts) if (!H.titles.includes(t)) H.titles.push(t);
      if (typeof hlOn === 'function' && hlOn() && Array.isArray(H.inv)) hlAddItem(H, 'steak', 2);
      toast(`Победа над князем! +${K.xp} опыта, титулы: ${ts.join(', ')}`);
    }
    floater(h.x, h.y - 2.4, K.title + '!', '#ffe070');
  }
  S.wins = (S.wins || 0) + 1; S.last = rdNight();
  rdSay(`${K.name} повержен! ${blade ? `Клинок отряда — ${blade}. ` : ''}${shield ? `Щит отряда — ${shield}. ` : ''}Добыча — на земле у кургана`);
  logEvent('animal', `${K.name} повержен${hs.length ? ': ' + hs.map(h => h.hero.name).join(', ') : ''}`, N.x, N.y);
  if (K.win) K.win(N, F);
  for (let i = Game.neutrals.length - 1; i >= 0; i--) { const M = Game.neutrals[i]; if (M.raid && M !== N && M.st !== 'die') { M.st = 'die'; M.dt = 0; M.hp = 0; } }
  S.f = null;
  if (typeof festivalStart === 'function' && !Game.festWish) Game.festWish = true;   // утром — праздник победы (festival.js)
}

// ================= Тик =================

function raidTick(dt) {
  if (rdMirror()) return;
  if (rdServer() && !RD.hooked) rdServerHook();
  RD.t += dt;
  const S = raidState(), F = S.f;
  if (F) raidFightTick(dt, S, F);
  if (RD.t < 0.5) return;
  RD.t = 0;
  const K = RAID_KINDS.kurgan;
  if (!S.site) { const s = K.site(); if (!s) return; S.site = { x: s[0] + 0.5, y: s[1] + 0.5 }; }
  S.st = raidSt(S);
  if (F) { if (!isNightNow() && !isEveningNow()) raidEnd('dawn'); return; }
  const night = isNightNow();
  if (!night) { S.omen = false; return; }
  if (!startOpen('raid')) return;
  if (rdNight() - (S.last || -9) < RAID_COOLDOWN || S.tried === rdNight()) return;
  if (!S.omen) {
    if (raidParty() >= 2) { S.omen = true; S.st = 'omen'; rdSay(`Над курганом загорелись синие огни… ${K.name} ждёт гостей. Подойдите туда вдвоём или больше (герои от ${RAID_MIN_LVL} уровня)`); }
    return;
  }
  if (raidParty(S.site.x, S.site.y, RAID_RISE_R) >= 2) { S.tried = rdNight(); raidStart('kurgan', S.site.x, S.site.y + 1.2); S.st = raidSt(S); }
}

// ================= Вход в курган =================
// Курган стоит на карте с первого дня, а князь встаёт только ночью, с 4-й ночи и перед двумя героями.
// Состояние кургана считает тот, кто считает игру (в общей деревне — сервер), клиенты получают его в зеркале (S.st):
// shut — запечатан (рано), rest — князь отдыхает после битвы, day — вход ночью, wait — ночь, но героев мало, omen — синие огни, fight — бой.

function raidSt(S) {
  if (S.f) return 'fight';
  if (!startOpen('raid')) return 'shut';
  if (rdNight() - (S.last || -9) < RAID_COOLDOWN || S.tried === rdNight()) return 'rest';
  if (!isNightNow()) return 'day';
  return S.omen ? 'omen' : 'wait';
}

// клетка у проёма и сам холм (вместе с кольцом камней)
function raidDoor(S) { return [Math.floor(S.site.x), Math.floor(S.site.y) + 1]; }
function raidOnMound(S, x, y) { return !!(S && S.site) && Math.abs(x + 0.5 - S.site.x) <= 1.8 && y + 0.5 - S.site.y >= -1.6 && y + 0.5 - S.site.y <= 1.6; }

// почему князь не встаёт перед этим героем (или что он встаёт): { m — текст, ok — встаёт }
function raidWhy(u) {
  const S = raidState(), st = raidSt(S);
  if (st === 'fight') return { ok: 1, m: 'Курганный князь уже встал — в бой!' };
  if (st === 'shut') {
    const n = Math.ceil(START_GRACE.sys.raid.night * startGraceMul());
    return { m: startNights() < n ? `Курган запечатан: князь проснётся после ${n}-й ночи` : 'Курган запечатан: князь ждёт, пока деревня окрепнет' };
  }
  if (st === 'rest') return { m: 'Князь отдыхает после битвы — курган откроется через несколько ночей' };
  if (st === 'day') return { m: 'Вход в курган открывается ночью, когда над ним загорятся синие огни' };
  if (u && u.hero && (u.hero.level || 1) < RAID_MIN_LVL) return { m: `Князь не встанет перед героем ниже ${RAID_MIN_LVL} уровня` };
  if (raidParty(S.site.x, S.site.y, RAID_RISE_R) < 2)
    return { m: rdServer() ? `Одному не войти: нужен второй герой от ${RAID_MIN_LVL} уровня у входа` : 'Одному не войти: возьмите двух рекрутов «За героем»' };
  return { ok: 1, m: 'Курганный князь пробуждается!' };
}

// герой дошёл до входа: князь встанет на ближайшем тике (raidTick), если всё сошлось, иначе — объясняем почему
function raidKnock(u) {
  const S = raidState();
  if (!S.site) return;
  const w = raidWhy(u);
  if (rdServer()) { if (u.hero && u.hero.owner) coopSay(u.hero.owner, w.m); } else toast(w.m);
  floater(S.site.x, S.site.y - 2.2, w.ok ? 'Вход открыт!' : 'Закрыто', w.ok ? '#9ae0ff' : '#c8c0b0');
}

function raidFightTick(dt, S, F) {
  const N = raidBoss(), K = RAID_KINDS[F.k];
  if (!N) { S.f = null; return; }
  if (N.st === 'die') return;
  N.prov = Game.time;
  for (const M of Game.neutrals) if (M.raid) M.prov = Game.time;
  const r = N.hp / N.mhp;
  const want = r > 0.66 ? 1 : r > 0.33 ? 2 : 3;
  if (want > F.ph) raidPhase(N, F, want);
  if (K.tick) K.tick(N, F, dt);
  // никого рядом — князь лечится и ждёт
  if (!raidHeroes(N.x, N.y, 18).length) N.hp = Math.min(N.mhp, N.hp + dt * N.mhp * 0.01);
}

// ================= Курганный князь =================

const KURGAN = {
  name: 'Курганный князь', lair: 'кургана', title: 'Победитель князя', hpPer: RAID_HP, xp: 120,
  nspec: { name: 'Курганный князь', mhp: RAID_HP, dmg: [9, 14], cd: 1.7, rng: 1.9, spd: 1.55, parry: 0.12, xp: 160, sz: 15, roam: 1,
    drop: [['gold', 4, 1], ['magicstone', 2, 1], ['iron', 2, 0.7], ['mana', 1, 0.6]], msg: ['Кто тревожит мой сон?!', 'Курган мой, и вы мои!', 'Поклонитесь князю!'] },
  extra: {
    kost: { name: 'Костяной оберег', mhp: 34, dmg: [0, 0], cd: 99, rng: 0, spd: 0, parry: 0, xp: 20, sz: 6, roam: 0,
      drop: [['magicstone', 1, 0.5]], msg: ['…'] },
  },
  phases: [
    { n: 'Костяной щит', hint: 'Пока стоят два оберега, по князю идёт лишь четверть урона. Лучники, маги и друиды бьют обереги вдвое; «Изгнание» жреца ломает их сразу.' },
    { n: 'Могильный холод', hint: 'Под героями вспыхивают синие круги — выходите из них! Воин, варвар или монах вплотную к князю держат его удары на себе.' },
    { n: 'Ярость', hint: 'Князь бьёт чаще и пьёт жизнь. Разбойник со спины бьёт вдвое; лечите команду способностями Z/X.' },
  ],
  site() {
    const gy = typeof graveyardOf === 'function' ? graveyardOf() : null;
    const free = (x, y) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (!inb(x + dx, y + dy) || World.bmap[idx(x + dx, y + dy)] || !isWalkable(x + dx, y + dy)) return false; return true; };
    if (gy) { const s = randomFreeNear(gy.x + (gy.w >> 1), gy.y + gy.h + 3, 2, 12, free); if (s) return s; }
    const st = Game.buildings.find(b => b.isStore()) || Game.buildings[0];
    if (!st) return null;
    for (let k = 0; k < 60; k++) {
      const a = Math.random() * Math.PI * 2, r = 16 + Math.random() * 10;
      const x = Math.floor(st.doorX + Math.cos(a) * r), y = Math.floor(st.doorY + Math.sin(a) * r * 0.8);
      if (inb(x, y) && free(x, y)) return [x, y];
    }
    return randomFreeNear(st.doorX, st.doorY + 10, 4, 20, free);
  },
  start(N, F) {
    // два оберега по бокам кургана
    for (const dx of [-3, 3]) {
      const x = N.x + dx, y = N.y - 0.6;
      const W = raidMake('kost', isWalkable(Math.floor(x), Math.floor(y)) ? x : N.x + dx * 0.6, y, Math.round(34 * Math.max(2, F.n) * 0.75 * dif().neuHp));
      W.ov = null; F.adds.push(W.id); Game.neutrals.push(W);
    }
    F.nextAdd = Game.time + 8; F.nextMark = Game.time + 6;
  },
  tick(N, F, dt) {
    const wards = Game.neutrals.filter(M => M.k === 'kost' && M.st !== 'die');
    F.sh = wards.length && F.ph === 1 ? 1 : 0;
    // жрец: «Изгнание нежити» рядом с оберегом ломает его сразу
    for (const h of raidHeroes(N.x, N.y, 16)) {
      if (!h.abbu || h.abbu.k !== 'turn' || Game.time - h.abbu.s > 0.6 || h._rdTurn === h.abbu.s) continue;
      h._rdTurn = h.abbu.s;
      for (const W of wards) if (Math.hypot(W.x - h.x, W.y - h.y) < 6.5) { F.wards[rdKey(h)] = (F.wards[rdKey(h)] || 0) + 1; neuHit(W, h, W.hp + 1); }
    }
    // фаза I: скелеты из земли
    if (F.ph === 1 && Game.time >= F.nextAdd && typeof skelRise === 'function') {
      F.nextAdd = Game.time + 14;
      if ((Game.skels || []).filter(s => s.state !== 'dead' && Math.hypot(s.x - N.x, s.y - N.y) < 10).length < 4)
        for (let k = 0; k < 2; k++) { const s = randomFreeNear(Math.floor(N.x), Math.floor(N.y), 2, 4, (x, y) => isWalkable(x, y)); if (s) skelRise(s[0] + 0.5, s[1] + 0.5, k * 0.8); }
      floater(N.x, N.y - 2.6, 'Встаньте, слуги!', '#9ae0ff');
    }
    // фаза II и III: синие круги под героями
    if (F.ph >= 2 && Game.time >= F.nextMark) {
      F.nextMark = Game.time + (F.ph === 3 ? 6 : 7.5);
      for (const h of raidHeroes(N.x, N.y, 12)) F.marks.push({ x: +h.x.toFixed(2), y: +h.y.toFixed(2), t: Game.time + 1.6 });
      floater(N.x, N.y - 2.6, 'Холод могил!', '#9ae0ff');
    }
    for (let i = F.marks.length - 1; i >= 0; i--) {
      const m = F.marks[i];
      if (Game.time < m.t) continue;
      F.marks.splice(i, 1);
      fxBurst(m.x * TILE, m.y * TILE, 16, ['#bff0ff', '#6ad0ff', '#ffffff'], 70, 50, 0.6, 1.8, -30);
      for (const h of raidHeroes(m.x, m.y, 1.15)) { neuHurtUnit(h, 18 * dif().neuDmg); floater(h.x, h.y - 2.2, 'Холод!', '#9ae0ff'); F.taken[rdKey(h)] = (F.taken[rdKey(h)] || 0) + 18; raidDownCheck(N, h); }
    }
    // «держат»: боец вплотную забирает удары на себя
    const tank = raidHeroes(N.x, N.y, 2.2).find(h => RAID_TANKS.has(h.hero.clsKey));
    if (F.ph >= 2 && tank && N.tg !== tank.id) { N.tg = tank.id; if (Math.random() < 0.3) floater(tank.x, tank.y - 2.2, 'Держу!', '#ffd070'); }
    if (!N.tg) { const h = raidHeroes(N.x, N.y, 12)[0]; if (h) N.tg = h.id; }
    // фаза III: быстрее
    if (F.ph === 3) N.cdA -= dt * 0.6;
  },
};

function raidDownCheck(N, h) { if (h.hero && h.hero.hp <= 0 && typeof neuHeroDown === 'function') neuHeroDown(N, h); }

raidRegister('kurgan', KURGAN);

// ================= Подключение к бою нейтралов =================

{
  const _th = neuThink;
  neuThink = function (N, dt) {
    if (N.k === 'kost') { N.prov = Game.time; if (N.st === 'die') N.dt += dt; if (N.ov) { N.ovT += dt; } N.fr = N.st === 'die' ? 'd' + Math.min(5, Math.floor(N.dt / 0.11)) : N.ov ? N.ov[Math.min(N.ov.length - 1, Math.floor(N.ovT / 0.14))] : 'i0'; if (N.ov && N.ovT > 0.3) N.ov = null; return; }
    _th(N, dt);
  };
  const _hit = neuHit;
  neuHit = function (N, u, dmg) {
    const F = Game.raid && Game.raid.f;
    if (!N || !N.raid || !F) return _hit(N, u, dmg);
    const key = rdKey(u), C = typeof GCLS !== 'undefined' && GCLS[unitCls(u)];
    if (N.k === 'kost') {
      if (C && C.shot) dmg *= 2;
      const was = N.hp, ox = N.x, oy = N.y;
      _hit(N, u, dmg);
      N.x = ox; N.y = oy;                                   // оберег врыт в землю — от ударов не отъезжает
      if (was > 0 && N.hp <= 0 && key) F.wards[key] = (F.wards[key] || 0) + 1;
      if (N.hp <= 0 && !Game.neutrals.some(M => M.k === 'kost' && M.st !== 'die' && M !== N)) rdSay('Обереги разбиты — щит князя пал!');
      return;
    }
    if (F.sh) { dmg *= 0.25; if (Math.random() < 0.3) floater(N.x, N.y - 2.4, 'Щит оберегов!', '#9ae0ff'); }
    // удар со спины разбойника
    if (u && (unitCls(u) === 'rogue' || (u.hero && u.hero.clsKey === 'rogue')) && (u.x - N.x) * N.face < 0 && Math.hypot(u.x - N.x, u.y - N.y) < 2.4) { dmg *= 2; floater(N.x, N.y - 2.6, 'Со спины!', '#e0b0ff'); }
    if (key) F.dmg[key] = (F.dmg[key] || 0) + Math.max(0, Math.min(N.hp, dmg));
    _hit(N, u, dmg);
  };
  const _kill = neuKill;
  neuKill = function (N, killer) {
    if (N.raid && N.k !== 'kost' && Game.raid && Game.raid.f && Game.raid.f.nid === N.id) { _kill(N, killer); raidVictory(N); return; }
    _kill(N, killer);
  };
  const _ns = neuStrike;
  neuStrike = function (N, tg) {
    const F = Game.raid && Game.raid.f;
    if (!N.raid || !F) return _ns(N, tg);
    const was = tg.hero ? tg.hero.hp : 0;
    _ns(N, tg);
    if (tg.hero) {
      const lost = Math.max(0, was - tg.hero.hp), key = rdKey(tg);
      F.taken[key] = (F.taken[key] || 0) + lost;
      if (F.ph === 3 && lost > 0) { N.hp = Math.min(N.mhp, N.hp + lost * 0.35); floater(N.x, N.y - 2.2, '+' + Math.round(lost * 0.35), '#9ae0ff'); }
    }
  };
  // клик по кургану — «Войти в курган»: герой идёт к проёму, там князь встаёт или герой узнаёт, чего не хватает.
  // В общей деревне клиент шлёт обычный 'go' на клетку у входа, а сервер по ней же разбирает приказ (coopGo → resolveCmd).
  const _rc = resolveCmd;
  resolveCmd = function (t) {
    const S = Game.raid;
    if (S && S.site && !S.f && raidOnMound(S, t[0], t[1])) { const [tx, ty] = raidDoor(S); return { kind: 'kurgan', tx, ty, label: 'Войти в курган' }; }
    return _rc(t);
  };
  const _run = runCmd;
  runCmd = function* (u, c) {
    if (c.kind !== 'kurgan') { yield* _run(u, c); return; }
    const ok = yield { walk: [c.tx, c.ty] };
    if (ok) raidKnock(u);
  };
  const _nd = neuDraw;
  neuDraw = function (c, N) {
    if (N.k === 'kurgan') return raidDrawKurgan(c, N);
    if (N.k === 'kost') return raidDrawWard(c, N);
    return _nd(c, N);
  };
  const _dl = neuDrawList;
  neuDrawList = function (list, c, x0, y0, x1, y1) {
    _dl(list, c, x0, y0, x1, y1);
    const S = Game.raid;
    if (S && S.site && S.site.x > x0 - 4 && S.site.x < x1 + 4 && S.site.y > y0 - 4 && S.site.y < y1 + 5) list.push([S.site.y - 0.4, () => raidDrawMound(c, S)]);
    const F = S && S.f;
    if (F && F.marks && F.marks.length) list.push([-1e9, () => raidDrawMarks(c, F)]);
  };
  // старые зеркала без поля raid: босса из Game.neutrals не сохраняем — он встаёт заново следующей ночью
  const _ser = serializeGame;
  serializeGame = function () {
    const s = _ser();
    if (s.nt && s.nt.mem) s.nt.mem = s.nt.mem.filter(m => m.k !== 'kurgan' && m.k !== 'kost');
    const S = Game.raid;
    if (S) s.raid = { site: S.site, wins: S.wins || 0, last: S.last == null ? -9 : S.last };
    return s;
  };
  const _apply = applySave;
  applySave = function (s) {
    _apply(s);
    const d = s.raid;
    Game.raid = d ? { site: d.site || null, wins: d.wins || 0, last: d.last == null ? -9 : d.last, omen: false, f: null } : null;
  };
  const _reset = resetGameState;
  resetGameState = function () { _reset(); Game.raid = null; };
  const _step = step;
  step = function (dt) { _step(dt); raidTick(dt); };
  const _ov = drawOverlay;
  drawOverlay = function (c) { _ov(c); raidDrawBar(c); };
  const _upd = updateUI;
  updateUI = function (force) { _upd(force); raidHud(); };
  const _start = startGame;
  startGame = function () {
    _start();
    raidClientHook();
  };
  if (typeof setInterval === 'function' && typeof document !== 'undefined' && document.getElementById) setInterval(() => { if (typeof coop === 'undefined') raidHud(); }, 500);
}

// клиент общей деревни: курган, огни, состояние входа и бой приходят в зеркале сервера
function raidClientHook() {
  if (RD.cHooked || typeof coopApplyInit !== 'function') return;
  RD.cHooked = true;
  const _cm = coopMirror;
  coopMirror = function (m) { _cm(m); Game.raid = m.raid || null; };
}

function rdServerHook() {
  RD.hooked = true;
  const _mir = coopMirror;
  coopMirror = function () {
    const m = _mir(), S = Game.raid;
    if (S) {
      const F = S.f;
      m.raid = { site: S.site, omen: S.omen ? 1 : 0, st: S.st || null, f: F ? { k: F.k, nid: F.nid, ph: F.ph, sh: F.sh || 0, hint: F.hint, marks: F.marks } : null };
    }
    return m;
  };
}

// ================= Рисование =================

const RP = (c, x, y) => (a, b, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x + a), Math.round(y + b), w, h); };

function raidDrawMound(c, S) {
  const x = Math.round(S.site.x * TILE), y = Math.round(S.site.y * TILE + 4), P = RP(c, x, y), t = Game.time;
  const lit = S.omen || S.f;
  c.fillStyle = 'rgba(10,8,4,0.3)'; c.beginPath(); c.ellipse(x, y + 2, 44, 12, 0, 0, 7); c.fill();
  // земляной холм с травой
  for (let r = 0; r < 14; r++) { const w = 40 - r * 2.2; P(-w, -r * 1.6 - 2, w * 2, 2, r % 3 === 0 ? '#4a6a2a' : r < 3 ? '#5a4a30' : '#5e7a34'); }
  P(-18, -24, 36, 2, '#6e8a3c'); P(-10, -26, 20, 2, '#7a9a44');
  // вход: каменный проём с перекладиной
  P(-9, -16, 18, 16, '#1a120a'); P(-8, -15, 16, 15, '#0e0a08'); P(-11, -19, 22, 4, '#6a6458'); P(-11, -19, 22, 1, '#9a9286');
  P(-11, -15, 3, 15, '#5a554c'); P(8, -15, 3, 15, '#5a554c');
  if (lit) { c.fillStyle = `rgba(110,210,255,${0.25 + 0.15 * Math.sin(t * 3)})`; c.fillRect(x - 8, y - 15, 16, 15); }
  // кольцо стоячих камней
  for (const [dx, dy, h] of [[-38, -2, 16], [-26, 8, 13], [26, 8, 13], [38, -2, 16]]) {
    P(dx - 4, dy - h, 8, h, '#1a160f'); P(dx - 3, dy - h + 1, 6, h - 1, '#7a746a'); P(dx - 3, dy - h + 1, 2, h - 1, '#9a9488');
    P(dx - 1, dy - h + 4, 2, 2, lit ? '#9ae0ff' : '#5a554c');
    if (lit) {
      const f = Math.sin(t * 8 + dx) * 1.5;
      c.save(); c.globalCompositeOperation = 'lighter';
      c.fillStyle = 'rgba(80,190,255,0.5)'; c.beginPath(); c.ellipse(x + dx, y + dy - h - 4, 4, 6 + f, 0, 0, 7); c.fill();
      c.fillStyle = 'rgba(200,245,255,0.8)'; c.beginPath(); c.ellipse(x + dx, y + dy - h - 3, 1.6, 3 + f * 0.5, 0, 0, 7); c.fill();
      c.restore();
    }
  }
  raidDrawSign(c, x, y - 32, S.st, t);
}

// подпись над курганом: где вход и что нужно, чтобы князь встал (в бою не нужна — над князем своя шкала)
const RAID_SIGN = {
  shut: ['Курган · запечатан', '#c8c0b0'], rest: ['Курган · князь отдыхает', '#c8c0b0'], day: ['Вход в курган — ночью', '#e8dcb8'],
  wait: ['Вход в курган — вдвоём, герои от 3 ур.', '#e8dcb8'], omen: ['▼ Вход в курган ▼', '#bff0ff'],
};
function raidDrawSign(c, x, y, st, t) {
  const S = RAID_SIGN[st];
  if (!S) return;
  c.save();
  c.font = 'bold 7px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  const w = Math.ceil(c.measureText(S[0]).width) + 8, by = st === 'omen' ? Math.round(y + Math.sin(t * 3) * 1.5) : y;
  c.fillStyle = 'rgba(12,10,8,0.72)'; c.fillRect(Math.round(x - w / 2), by - 8, w, 11);
  c.fillStyle = st === 'omen' ? 'rgba(106,208,255,0.9)' : 'rgba(150,140,120,0.7)'; c.fillRect(Math.round(x - w / 2), by + 3, w, 1);
  c.fillStyle = S[1]; c.fillText(S[0], x, by);
  c.restore();
}

function raidDrawMarks(c, F) {
  const t = Game.time;
  c.save();
  for (const m of F.marks) {
    const left = Math.max(0, m.t - t), k = Math.max(0.05, Math.min(1, 1 - left / 1.6)), x = m.x * TILE, y = m.y * TILE + 6;
    c.strokeStyle = `rgba(150,225,255,${0.5 + 0.5 * k})`; c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(x, y, 34, 15, 0, 0, 7); c.stroke();
    c.fillStyle = `rgba(90,190,255,${0.12 + 0.3 * k})`; c.beginPath(); c.ellipse(x, y, 34 * k, 15 * k, 0, 0, 7); c.fill();
    for (let j = 0; j < 6; j++) { const a = j / 6 * Math.PI * 2 + t; c.fillStyle = '#d8f6ff'; c.fillRect(Math.round(x + Math.cos(a) * 30), Math.round(y + Math.sin(a) * 13), 2, 2); }
  }
  c.restore();
}

// Князь: высокий скелет в ржавом золотом доспехе, корона с синими камнями, рваный синий плащ, древний меч
function raidDrawKurgan(c, N) {
  const fr = N.fr || 'i0', t = Game.time, dead = N.st === 'die';
  const al = dead ? Math.max(0, Math.min(1, 1 - (N.dt - 0.6) / 2.6)) : 1;
  if (al <= 0) return;
  const px = Math.round(N.x * TILE), py = Math.round(N.y * TILE + 6);
  c.save();
  c.globalAlpha = al;
  c.fillStyle = 'rgba(10,8,4,0.35)'; c.beginPath(); c.ellipse(px, py + 1, 16, 5, 0, 0, 7); c.fill();
  // синее свечение под ногами
  c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(80,180,255,${0.18 + 0.08 * Math.sin(t * 4)})`; c.beginPath(); c.ellipse(px, py, 20, 7, 0, 0, 7); c.fill(); c.restore();
  const sink = dead ? Math.min(14, N.dt * 6) : 0;
  c.translate(px, py + sink);
  if (N.face < 0) c.scale(-1, 1);
  const hurt = fr === 'hurt' || fr === 'stagger', lean = hurt ? -2 : 0;
  const walk = fr[0] === 'w' ? +fr.slice(1) : -1, step = walk >= 0 ? (walk % 4 < 2 ? 1 : -1) : 0;
  const bob = fr[0] === 'i' ? Math.round(Math.sin(t * 2) * 0.8) : 0;
  const P = RP(c, lean, bob);
  const BONE = '#e6dfc8', BONE2 = '#b8b096', DK = '#1a120a', GOLD = '#b8902e', GOLD2 = '#e0b84a', RUST = '#7a5a1e', CAPE = '#2a3a6a', CAPE2 = '#1a2448', BLUE = '#6ad0ff';
  // плащ
  const cw = Math.sin(t * 2.4) * 1.5;
  P(-10, -34, 14, 30, DK); P(-9, -33, 12, 28, CAPE); P(-9, -33, 3, 28, CAPE2);
  for (let k = 0; k < 4; k++) P(-9 + k * 3, -6 + (k % 2) * 2 + Math.round(cw * (k % 2 ? 1 : -1)), 3, 3, CAPE);
  // ноги: кость, наголенники
  P(-6 + step, -12, 4, 12, DK); P(-5 + step, -11, 2, 10, BONE); P(-6 + step, -6, 4, 3, RUST);
  P(2 - step, -12, 4, 12, DK); P(3 - step, -11, 2, 10, BONE); P(2 - step, -6, 4, 3, RUST);
  P(-7 + step, -1, 5, 2, DK); P(1 - step, -1, 5, 2, DK);
  // туловище: золотая кираса с ржавчиной, рёбра в прорехе
  P(-8, -30, 16, 19, DK); P(-7, -29, 14, 17, GOLD); P(-7, -29, 14, 3, GOLD2); P(-7, -15, 14, 3, RUST);
  P(-3, -25, 6, 7, DK); for (let k = 0; k < 3; k++) P(-2, -24 + k * 2, 4, 1, BONE);
  P(4, -27, 2, 2, RUST); P(-6, -20, 2, 3, RUST);
  // наплечники
  P(-11, -31, 6, 5, DK); P(-10, -30, 4, 3, GOLD2); P(5, -31, 6, 5, DK); P(6, -30, 4, 3, GOLD2);
  // голова: череп, синие глаза, корона
  const jaw = fr === 'roar' ? 2 : 0;
  P(-6, -42, 12, 12 + jaw, DK); P(-5, -41, 10, 9, BONE); P(-5, -41, 10, 2, '#f4eedc');
  P(-4, -38, 3, 3, '#0a1018'); P(1, -38, 3, 3, '#0a1018');
  c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(120,220,255,${0.7 + 0.3 * Math.sin(t * 6)})`; c.fillRect(-3 + lean, -37 + bob, 2, 2); c.fillRect(2 + lean, -37 + bob, 2, 2); c.restore();
  P(-1, -35, 2, 2, BONE2); P(-4, -33 + jaw, 8, 2, BONE2); for (let k = 0; k < 4; k++) P(-4 + k * 2, -33 + jaw, 1, 1, DK);
  P(-7, -46, 14, 5, DK); P(-6, -45, 12, 3, GOLD); P(-6, -45, 12, 1, GOLD2);
  for (const dx of [-6, -1, 4]) { P(dx, -49, 2, 4, GOLD); P(dx, -49, 1, 1, GOLD2); }
  P(-4, -44, 2, 2, BLUE); P(2, -44, 2, 2, BLUE);
  // меч: по кадру — на плече, занесён, удар
  const pose = fr === 'windup' ? 'up' : fr === 'strike' ? 'down' : fr === 'recover' ? 'mid' : 'rest';
  c.save(); c.translate(7 + lean, -22 + bob);
  c.rotate(pose === 'up' ? -2.4 : pose === 'down' ? 0.5 : pose === 'mid' ? -0.6 : -1.1);
  P(-2, -2, 4, 4, DK); P(-1, -1, 2, 2, BONE);                         // кисть
  c.fillStyle = DK; c.fillRect(-1, -6, 2, 5); c.fillStyle = '#5a3a1e'; c.fillRect(-0.5, -5, 1, 4);
  c.fillStyle = DK; c.fillRect(-4, -7, 8, 2); c.fillStyle = GOLD; c.fillRect(-3, -7, 6, 1);
  c.fillStyle = DK; c.fillRect(-2, -26, 4, 20); c.fillStyle = '#9aa4b0'; c.fillRect(-1, -25, 2, 18); c.fillStyle = '#dce4ec'; c.fillRect(-1, -25, 1, 18);
  c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(100,200,255,0.35)'; c.fillRect(-3, -27, 6, 22); c.restore();
  c.restore();
  // левая рука: кость с перчаткой
  P(-10, -26, 4, 10, DK); P(-9, -25, 2, 8, BONE); P(-10, -17, 4, 3, RUST);
  if (hurt) { c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(-12, -50, 26, 50); }
  c.restore();
  // огоньки-души вокруг
  if (!dead) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++) { const a = t * 1.3 + k * 2.1; c.fillStyle = 'rgba(150,230,255,0.8)'; c.fillRect(Math.round(px + Math.cos(a) * 16), Math.round(py - 24 + Math.sin(a * 1.4) * 8), 2, 2); }
    c.restore();
  }
}

function raidDrawWard(c, N) {
  const t = Game.time, dead = N.st === 'die';
  const al = dead ? Math.max(0, 1 - N.dt / 1.2) : 1;
  if (al <= 0) return;
  const px = Math.round(N.x * TILE), py = Math.round(N.y * TILE + 6), P = RP(c, px, py);
  c.save(); c.globalAlpha = al;
  c.fillStyle = 'rgba(10,8,4,0.3)'; c.beginPath(); c.ellipse(px, py + 1, 7, 2.5, 0, 0, 7); c.fill();
  P(-1, -22, 3, 22, '#1a120a'); P(0, -21, 1, 21, '#6a4a2a');
  P(-6, -4, 13, 5, '#1a120a'); P(-5, -3, 11, 3, '#b8b096');
  for (const [dx, dy] of [[-5, -10], [1, -10], [-2, -16]]) { P(dx - 1, dy - 1, 6, 6, '#1a120a'); P(dx, dy, 4, 4, '#e6dfc8'); P(dx, dy + 1, 1, 1, '#1a120a'); P(dx + 2, dy + 1, 1, 1, '#1a120a'); }
  if (!dead) { c.globalCompositeOperation = 'lighter'; const f = Math.sin(t * 9 + N.id) * 1.2; c.fillStyle = 'rgba(90,200,255,0.6)'; c.beginPath(); c.ellipse(px + 0.5, py - 25, 3, 5 + f, 0, 0, 7); c.fill(); c.fillStyle = 'rgba(210,248,255,0.9)'; c.fillRect(px, py - 26, 1, 3); }
  if (N.ov) { c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(px - 7, py - 24, 15, 25); }
  c.restore();
  if (!dead && N.hp < N.mhp) { const w = 14, r = N.hp / N.mhp; c.fillStyle = 'rgba(10,6,2,0.85)'; c.fillRect(px - w / 2 - 1, py - 33, w + 2, 4); c.fillStyle = '#6ad0ff'; c.fillRect(px - w / 2, py - 32, Math.round(w * r), 2); }
}

// общая шкала над князем
function raidDrawBar(c) {
  const F = Game.raid && Game.raid.f;
  if (!F) return;
  const N = Game.neutrals.find(M => M.id === F.nid);
  if (!N || N.st === 'die') return;
  const px = Math.round(N.x * TILE), py = Math.round(N.y * TILE - 54), w = 64, r = Math.max(0, N.hp / N.mhp);
  c.fillStyle = 'rgba(10,6,2,0.9)'; c.fillRect(px - w / 2 - 2, py - 2, w + 4, 8);
  c.fillStyle = '#2a3a5a'; c.fillRect(px - w / 2, py, w, 4);
  c.fillStyle = F.sh ? '#9ae0ff' : r > 0.66 ? '#6ad0ff' : r > 0.33 ? '#e0b030' : '#e04a3a'; c.fillRect(px - w / 2, py, Math.round(w * r), 4);
  for (const k of [1 / 3, 2 / 3]) { c.fillStyle = '#0a0604'; c.fillRect(Math.round(px - w / 2 + w * k), py, 1, 4); }
  c.font = 'bold 7px sans-serif'; c.textAlign = 'center';
  const lbl = RAID_KINDS[F.k].name + (F.sh ? ' · щит' : '');
  c.lineWidth = 3; c.strokeStyle = 'rgba(10,6,2,0.9)'; c.strokeText(lbl, px, py - 4); c.fillStyle = '#bff0ff'; c.fillText(lbl, px, py - 4); c.textAlign = 'start';
}

// подсказка фазы вверху экрана — что делать каждому классу
function raidHud() {
  if (typeof coop !== 'undefined' || typeof document === 'undefined' || !document.getElementById) return;
  const v = document.getElementById('view');
  if (!v) return;
  let el = RD.el;
  if (!el) {
    const st = document.createElement('style');
    st.textContent = `#raid-hud{position:absolute;bottom:64px;left:50%;transform:translateX(-50%);z-index:6;width:min(420px,calc(100vw - 24px));display:none;padding:5px 10px;background:rgba(12,18,32,.92);color:#d8eeff;border:1px solid #6ad0ff;border-radius:6px;font-size:12px;line-height:1.35;pointer-events:none;box-shadow:0 2px 10px rgba(0,0,0,.6)}
    #raid-hud b{color:#9ae0ff}#raid-hud .rb{height:5px;background:#1a2440;border-radius:2px;overflow:hidden;margin:3px 0}#raid-hud .rb i{display:block;height:100%;background:#6ad0ff}
    body.mobile #raid-hud{bottom:calc(120px + env(safe-area-inset-bottom))}`;
    document.head.appendChild(st);
    el = RD.el = document.createElement('div'); el.id = 'raid-hud'; v.appendChild(el);
  }
  const S = Game.raid, F = S && S.f;
  if (!S || (!F && !S.omen)) { el.style.display = 'none'; return; }
  const K = RAID_KINDS[(F && F.k) || 'kurgan'];
  let h;
  if (!F) h = `<b>Синие огни над курганом</b> — ${K.name} ждёт. Подойдите туда вдвоём или больше, герои от ${RAID_MIN_LVL} уровня${rdMirror() ? '' : ' (одному — герой и 2 рекрута «За героем»)'}.`;
  else {
    const N = Game.neutrals.find(M => M.id === F.nid), r = N ? Math.max(0, N.hp / N.mhp) : 0, P = K.phases[F.ph - 1] || K.phases[0];
    h = `<b>${K.name}</b> · фаза ${['I', 'II', 'III'][F.ph - 1] || 'I'}: «${P.n}»<div class="rb"><i style="width:${Math.round(r * 100)}%"></i></div>${F.hint || P.hint}`;
  }
  if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
  // в общей деревне внизу справа — панель заданий: поднимаемся над ней
  if (!(typeof Mobile !== 'undefined' && Mobile.on)) el.style.bottom = rdMirror() ? '160px' : '';
  el.style.display = 'block';
}
