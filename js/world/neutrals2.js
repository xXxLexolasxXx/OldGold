'use strict';
// Нейтралы 2 (НЕЙТРАЛЫ_2.md): лес взрослеет вместе с деревней.
// 1) Ранги 1…5: со 2-го дня есть хотя бы один нейтрал 2-го ранга, потолок растёт с ночами; ранг виден значком над головой.
// 2) Патрули: нейтралы уходят от логова тем дальше, чем больше дней прошло (не нападают первыми).
// 3) Новые народы по ночам и биомам: тролли (лесной, каменный, болотный — регенерация, огонь её гасит),
//    броненосец (сворачивается и катится, сносит всех, гномят объезжает, отскок от стен), гоблины (лагерь 5–8, нападают
//    все разом), гномтавры (копейщик с наскока, лучник держит дистанцию).
// 4) Огненный шар и Оберег героя бьют и по нейтралам (гоблинов — по площади).
// Всё считает симуляция (в кооперативе — сервер); клиенту в зеркало идут ранг (rk) и стрела лучника (arw).
// Подключается после combat.js; чужие файлы не правятся — только обёртки, как frostart.js.

const N2_RK_HP = [1, 1, 1.6, 2.2, 2.8, 3.4];
const N2_RK_DMG = [1, 1, 1.3, 1.6, 1.9, 2.2];
const N2_RK_XP = [1, 1, 1.7, 2.4, 3.1, 3.8];
const N2_RK_SZ = [1, 1, 1.12, 1.22, 1.3, 1.38];
const N2_TROLLS = { troll: 1, trollS: 1, trollB: 1 };
const N2_KINDS = { troll: 1, trollS: 1, trollB: 1, armad: 1, goblin: 1, gtSpear: 1, gtBow: 1 };
const N2_LAIRS = { troll: 1, trollS: 1, trollB: 1, armad: 1, goblin: 1, gnomtaur: 1 };
const N2_TOP = { troll: 84, trollS: 86, trollB: 82, armad: 34, goblin: 30, gtSpear: 58, gtBow: 58, leshy: 54, fairy: 46, pixie: 46, boar: 38, frost: 50 };
// рост от ранга; тролли растут сдержанно (×1,15 на 5-м ранге), чтобы не перерасти голема
const n2Sz = N => { const s = N2_RK_SZ[n2Rk(N)]; return N2_TROLLS[N.k] ? 1 + (s - 1) * 0.4 : s; };
const N2 = { cast: null, fireN: null, mul: 1, sec: 0, rng: null };
// своя случайность: общий Math.random не сдвигается (детерминизм и чужие тесты по сиду не зависят от нейтралов 2)
const n2Rand = () => (N2.rng || (N2.rng = mulberry32(0x4E2B17)))();

const n2Rk = N => Math.max(1, Math.min(5, N.rk | 0 || 1));
const n2Kid = u => u && u.type === 'kid';
const n2Now = () => Game.time;

if (typeof NSPEC !== 'undefined') {
  Object.assign(NSPEC, {
    troll:  { name: 'Лесной тролль', mhp: 150, dmg: [11, 16], cd: 2.2, rng: 1.9, spd: 1.3, parry: 0.08, xp: 160, roam: 3, sz: 19, regen: 0.012,
      drop: [['hide', 2, 1], ['gold', 3, 0.8], ['trunk', 2, 0.7], ['magicstone', 1, 0.25]], msg: ['Кто топчет мой мост?!', 'Тролль голоден!', 'Ррраздавлю!'] },
    trollS: { name: 'Каменный тролль', mhp: 175, dmg: [12, 17], cd: 2.4, rng: 1.9, spd: 1.15, parry: 0.12, xp: 180, roam: 2.6, sz: 19, regen: 0.01,
      drop: [['stone', 3, 1], ['ironore', 1, 0.7], ['gold', 3, 0.7], ['magicstone', 1, 0.35]], msg: ['Камень не боится!', 'Гр-р-рохот!', 'Вы — песок!'] },
    trollB: { name: 'Болотный тролль', mhp: 135, dmg: [10, 14], cd: 2.0, rng: 1.9, spd: 1.4, parry: 0.06, xp: 150, roam: 3.2, sz: 18, regen: 0.016,
      drop: [['hide', 2, 1], ['hops', 2, 0.8], ['mana', 1, 0.5], ['gold', 2, 0.6]], msg: ['Бульк… Я вас утоплю!', 'Тина помнит всё!', 'Чвяк-чвяк!'] },
    armad:  { name: 'Броненосец', mhp: 95, dmg: [6, 9], cd: 1.6, rng: 1.5, spd: 1.7, parry: 0.2, xp: 120, roam: 3, sz: 13,
      drop: [['hide', 3, 1], ['gold', 1, 0.6], ['magicstone', 1, 0.4]], msg: ['Пф-ф! (сворачивается)', 'Хрусь-хрусь!', 'Не тронь панцирь!'] },
    goblin: { name: 'Гоблин', mhp: 14, dmg: [2, 3], cd: 1.1, rng: 1.2, spd: 2.6, parry: 0.05, xp: 10, roam: 3.4, sz: 6,
      drop: [['gold', 1, 0.5], ['sausage', 1, 0.3], ['ironore', 1, 0.2]], msg: ['Йа-а-а! Все на него!', 'Блестяшки наши!', 'Хи-хи, окружай!'] },
    gtSpear:{ name: 'Гномтавр-копейщик', mhp: 62, dmg: [6, 9], cd: 1.7, rng: 1.8, spd: 3.6, parry: 0.15, xp: 75, roam: 4.5, sz: 12,
      drop: [['hide', 1, 0.8], ['gold', 2, 0.8], ['bread', 2, 0.5]], msg: ['За степь и бороду!', 'Копьё не шутит!', 'И-го-го… то есть, к бою!'] },
    gtBow:  { name: 'Гномтавр-лучник', mhp: 46, dmg: [4, 7], cd: 2.0, rng: 5.5, spd: 3.4, parry: 0.1, xp: 70, roam: 4.5, sz: 12, ranged: true,
      drop: [['hide', 1, 0.8], ['gold', 2, 0.7], ['magicstone', 1, 0.3]], msg: ['Ветер в гриву — стрелу в цель!', 'Догони, коротыш!', 'Тетива поёт!'] },
  });
  Object.assign(NLAIR, { troll: ['troll'], trollS: ['trollS'], trollB: ['trollB'], armad: ['armad'], goblin: ['goblin', 'goblin', 'goblin', 'goblin', 'goblin'], gnomtaur: ['gtSpear', 'gtBow'] });
  Object.assign(NEU_LAIR_NAME, { troll: 'Нора тролля', trollS: 'Каменная нора тролля', trollB: 'Топкая нора тролля', armad: 'Нора броненосца', goblin: 'Гоблинский лагерь', gnomtaur: 'Стойбище гномтавров' });
}
if (typeof CB_WEAK !== 'undefined') Object.assign(CB_WEAK, {
  troll: { fire: 1.8, pierce: 1.1, nature: 0.6, blunt: 0.8 },
  trollS: { blunt: 1.4, fire: 1.4, steel: 0.7, pierce: 0.6 },
  trollB: { fire: 2, holy: 1.2, nature: 0.5 },
  armad: { pierce: 1.3, steel: 1.2, blunt: 0.8 },
  goblin: { fire: 2.5, holy: 1.5, steel: 1.2 },
  gtSpear: { pierce: 1.3, steel: 0.9 },
  gtBow: { steel: 1.3, blunt: 1.2 },
});

// ---------- Ранги ----------

// потолок ранга на ночь n: 1-й день — 1; после 1-й ночи — 2; затем +1 за две ночи; сложность сдвигает на ступень
function n2Cap(n) {
  if (n < 1) return 1;
  let c = 2 + Math.floor((n - 1) / 2);
  if (Game.diff === 'calm') c -= 1; else if (Game.diff === 'survival') c += 1;
  return Math.max(2, Math.min(5, c));
}

function n2SetRank(N, r, quiet) {
  r = Math.max(1, Math.min(5, r | 0));
  const base = Math.round(NSPEC[N.k].mhp * (N.lv || 1) * (typeof dif === 'function' ? dif().neuHp : 1));
  const ratio = N.mhp ? N.hp / N.mhp : 1;
  N.rk = r; N.mhp = Math.round(base * N2_RK_HP[r]); N.hp = Math.max(1, Math.round(N.mhp * ratio));
  if (quiet) return;
  fxBurst(N.x * TILE, N.y * TILE - 14, 18, ['#ffe070', '#fff6c0', '#ff9a40'], 70, 60, 0.9, 1.8, -30);
  floater(N.x, N.y - 2.4, `Окреп: ${r} ранг!`, '#ffd040');
}

// ---------- Новые логова: где и когда ----------

const N2_SCHED = { 1: ['goblin', 'goblin'], 2: ['troll', 'armad', 'goblin'], 3: ['gnomtaur', 'troll', 'armad'], 4: ['gnomtaur'] };
const N2_BIOME = {
  goblin: { forest: 1.3, swamp: 1.3 }, troll: { steppe: 0.8, meadow: 0.9, mountain: 1.2 },
  armad: { steppe: 1.5, mountain: 1, forest: 0.5, swamp: 0.5, winter: 0 }, gnomtaur: { steppe: 1.5, forest: 0.5, swamp: 0.5, mountain: 0.5, winter: 0.5 },
};
const N2_BASE = { goblin: 3, troll: 2, armad: 2, gnomtaur: 2 };

function n2Biome() { return typeof biomeId === 'function' ? biomeId() : 'meadow'; }
function n2Quota(k) {
  const m = (N2_BIOME[k] || {})[n2Biome()], w = m === undefined ? 1 : m;
  if (w <= 0) return 0;
  return Math.max(1, Math.round(N2_BASE[k] * w * (N_TILES / 19200)));
}
function n2TrollKind() { const b = n2Biome(); return b === 'swamp' ? 'trollB' : (b === 'mountain' || b === 'winter' || b === 'steppe') ? 'trollS' : 'troll'; }

function n2Site(k, stamp, near) {
  const cx = MAP_W >> 1, cy = MAP_H >> 1, minStart = mapIsLegacy() ? 20 : 24, open = k === 'armad' || k === 'gnomtaur';
  for (let t = 0; t < 3000; t++) {
    const x = 5 + ((n2Rand() * (MAP_W - 10)) | 0), y = 5 + ((n2Rand() * (MAP_H - 10)) | 0), i = idx(x, y);
    if (World.terrain[i] !== T_GRASS || World.bmap[i] || World.road[i] || !reachedIn(stamp, x, y)) continue;
    const ds = Math.hypot(x - cx, y - cy);
    if (ds < minStart + (t < 1500 ? 4 : 0) - (near ? 6 : 0)) continue;
    if (near && t < 2700 && ds > minStart + 20) continue;    // первое логово народа — там, где его встретят, а не на краю карты
    let trees = 0, bad = false;
    for (let yy = y - 4; yy <= y + 4 && !bad; yy++) for (let xx = x - 4; xx <= x + 4; xx++) {
      if (!inb(xx, yy)) { bad = true; break; }
      const j = idx(xx, yy), o = World.obj[j];
      if (World.bmap[j] || (World.terrain[j] === T_WATER && Math.abs(xx - x) < 4 && Math.abs(yy - y) < 4)) { bad = true; break; }
      if (o && o.t === 'tree') trees++;
    }
    if (bad || (open ? trees > (near && t >= 2000 ? 24 : 14) : trees < (t < 2000 ? 8 : 3))) continue;
    if (Game.buildings.some(b => Math.hypot(b.x - x, b.y - y) < 12)) continue;
    if (Game.lairs.some(l => Math.hypot(l.x - x, l.y - y) < 13)) continue;
    return { x, y, ds, minStart };
  }
  return null;
}

function n2SpawnLair(k, cap) {
  const S = Game.n2;
  if ((S.sp[k] || 0) >= n2Quota(k)) return null;
  const kind = k === 'troll' ? n2TrollKind() : k;
  const near = !(S.sp[k] || 0);
  const site = n2Site(k, N2.stamp || (N2.stamp = floodFrom(MAP_W >> 1, MAP_H >> 1)), near);
  if (!site) return null;
  N2.rk0 = Math.max(1, cap - 2);
  const L = neuAddLair(kind, site, site.minStart);
  N2.rk0 = 0;
  L.rk0 = Math.max(1, cap - 2);
  S.sp[k] = (S.sp[k] || 0) + 1;
  const what = { goblin: 'разбили лагерь гоблины', troll: 'поселился тролль', armad: 'вырыл нору броненосец', gnomtaur: 'встали стойбищем гномтавры' }[k];
  logEvent('animal', `${near ? 'Недалеко от деревни' : 'В дальнем лесу'} ${what} — ${NEU_LAIR_NAME[kind]}`, L.x + 0.5, L.y + 0.5);
  return L;
}

// наступила ночь n: окрепнуть, заселиться
function n2Night(n) {
  const cap = n2Cap(n), cx = MAP_W >> 1, cy = MAP_H >> 1;
  N2.stamp = null;
  for (const L of Game.lairs) if (L.k !== 'pixie' && L.k !== 'frost') L.rk0 = Math.max(1, cap - 2);
  const pool = Game.neutrals.filter(N => neuAlive(N) && N.lair && !NSPEC[N.k].friendly && N.k !== 'frost' && n2Rk(N) < cap);
  pool.sort((a, b) => Math.hypot(b.x - cx, b.y - cy) * (0.7 + n2Rand() * 0.6) - Math.hypot(a.x - cx, a.y - cy) * (0.7 + n2Rand() * 0.6));
  // первым крепнет вожак — самый сильный из ещё не достигших потолка: так к поздним ночам в лесу есть звери высших рангов
  const lead = pool.reduce((m, N) => (!N.tg && (!m || n2Rk(N) > n2Rk(m)) ? N : m), null);
  if (lead) { pool.splice(pool.indexOf(lead), 1); pool.unshift(lead); }
  let up = 0;
  for (const N of pool) {
    if (up >= 1 + Math.floor(n / 3)) break;
    if (N.tg) continue;
    n2SetRank(N, n2Rk(N) + 1);
    up++;
    if (up === 1) logEvent('animal', `В лесу окреп ${NSPEC[N.k].name}: теперь ${n2Rk(N)} ранга`, N.x, N.y);
  }
  n2EnsureRank2(n);
  // новые народы по расписанию (старый сейв или неудачное место — догоняются в следующие ночи)
  for (const kind in N2_BASE) {
    const want = N2_SCHED_UPTO(kind, n);
    for (let t = 0; t < want && (Game.n2.sp[kind] || 0) < want; t++) if (!n2SpawnLair(kind, cap)) break;
  }
}
// сколько логов вида kind должно стоять к ночи n по расписанию (догон для старых сейвов)
function N2_SCHED_UPTO(kind, n) { let c = 0; for (let k = 1; k <= n; k++) for (const x of N2_SCHED[k] || []) if (x === kind) c++; return Math.min(c, n2Quota(kind)); }

function n2EnsureRank2(n) {
  if (n < 1 || Game.neutrals.some(N => neuAlive(N) && n2Rk(N) >= 2)) return;
  const cx = MAP_W >> 1, cy = MAP_H >> 1;
  const c = Game.neutrals.filter(N => neuAlive(N) && N.lair && !NSPEC[N.k].friendly && N.k !== 'frost').sort((a, b) => Math.hypot(b.x - cx, b.y - cy) - Math.hypot(a.x - cx, a.y - cy))[0];
  if (c) { n2SetRank(c, 2); logEvent('animal', `В лесу окреп ${NSPEC[c.k].name}: теперь 2 ранга`, c.x, c.y); }
}

function n2Tick(dt) {
  N2.sec += dt;
  if (N2.sec < 1) return;
  N2.sec = 0;
  if (Game.stress || !Game.lairs) return;
  if (!Game.n2) Game.n2 = { nt: startNights(), sp: {} };
  // покой у логова тем шире, чем дольше длится игра
  const day = startDay(), wide = Math.min(2.5, 1 + 0.25 * (day - 1));
  for (const k in NSPEC) { const S = NSPEC[k]; if (S.roam0 === undefined) S.roam0 = S.roam; S.roam = S.friendly ? S.roam0 : S.roam0 * wide; }
  if (!startOpen('neutrals')) return;
  const custom = typeof MapOpt !== 'undefined' && MapOpt.custom && MapOpt.custom.nm !== 'auto';
  const nights = startNights();
  while (Game.n2.nt < nights) {
    Game.n2.nt++;
    if (custom) { n2EnsureRank2(Game.n2.nt); continue; }
    n2Night(Game.n2.nt);
  }
}

// ---------- Броненосец: шаром по прямой ----------

function n2RollStart(N, tg) {
  const dx = tg.x - N.x, dy = tg.y - N.y, d = Math.hypot(dx, dy) || 1, len = Math.min(11, d + 3);
  N.rl = { ph: 'curl', t: 0, dx: dx / d, dy: dy / d, len, went: 0, hit: [] };
  N.tel = { k: 'heavy', x: Math.round((N.x + dx / d * len) * 100) / 100, y: Math.round((N.y + dy / d * len) * 100) / 100, r: 1.1, p: 0 }; N.telAt = n2Now();
  N.st = 'roll'; N.face = dx >= 0 ? 1 : -1;
  floater(N.x, N.y - 2, NSPEC.armad.msg[0], '#ffe9a0');
  sfxAt('armadRoll', N.x * TILE, N.y * TILE, 0.5);
}

function n2RollEnd(N, why) {
  const R = N.rl;
  N.tel = null;
  if (why === 'bounce') { N.rl = { ph: 'bounce', t: 0, dx: R.dx, dy: R.dy }; sfxAt('armadBonk', N.x * TILE, N.y * TILE, 0.9); floater(N.x, N.y - 2, 'Бом!', '#fff2a0'); return; }
  N.rl = { ph: 'uncurl', t: 0, dx: R.dx, dy: R.dy };
}

// сбит шаром: урон, отброс; герою перекат спасает
function n2RollHit(N, u) {
  const now = n2Now();
  if (u.hero && u.hero.rollT > now) { floater(u.x, u.y - 1.9, 'Перекат!', '#cfe8ff'); return; }
  const dmg = neuR(10, 14) * (1 + ((N.lv || 1) - 1) * 0.5) * N2_RK_DMG[n2Rk(N)] * (typeof dif === 'function' ? dif().neuDmg : 1);
  const px = -N.rl.dy, py = N.rl.dx, side = (u.x - N.x) * px + (u.y - N.y) * py >= 0 ? 1 : -1;
  const kx = u.x + px * side * 0.9 + N.rl.dx * 0.4, ky = u.y + py * side * 0.9 + N.rl.dy * 0.4;
  if (isWalkable(Math.floor(kx), Math.floor(ky))) { u.x = kx; u.y = ky; }
  fxBurst(u.x * TILE, u.y * TILE - 10, 10, ['#d8c8a0', '#ffffff', '#a89870'], 70, 50, 0.6, 1.6, 160);
  sfxAt('thud', u.x * TILE, u.y * TILE, 0.8);
  floater(u.x, u.y - 2, 'Сбит!', '#ffb070');
  u.ouchUntil = now + 0.8;
  if (u.hero || u.rec) {
    N2.mul = 1; neuHurtUnit(u, dmg);
    if (u.hero && u.hero.hp <= 0) neuHeroDown(N, u);
  } else if (isPerson(u)) injure(u, 'leg');
}

function n2RollThink(N, dt) {
  const R = N.rl, now = n2Now();
  R.t += dt;
  if (R.ph === 'curl') {
    N.fr = 'cu' + Math.min(3, Math.floor(R.t / 0.1));
    if (N.tel) N.tel.p = Math.min(1, R.t / 0.4);
    if (R.t >= 0.4) { R.ph = 'roll'; R.t = 0; }
    return;
  }
  if (R.ph === 'roll') {
    N.fr = 'ro' + (Math.floor(R.went * 2.6) % 8);
    if (Math.floor(R.t * 4) !== Math.floor((R.t - dt) * 4)) sfxAt('armadRoll', N.x * TILE, N.y * TILE, 0.35);
    // гномёнок впереди — объехать боком, а если некуда — тормозить
    const kid = Game.units.find(u => n2Kid(u) && !u.dead && !u.inside && (() => { const ax = u.x - N.x, ay = u.y - N.y, along = ax * R.dx + ay * R.dy, lat = Math.abs(ax * -R.dy + ay * R.dx); return along > 0 && along < 2.6 && lat < 1; })());
    if (kid) {
      const s = ((kid.x - N.x) * -R.dy + (kid.y - N.y) * R.dx) > 0 ? -1 : 1;
      let turned = false;
      for (const a of [0.55 * s, -0.55 * s]) {
        const c = Math.cos(a), sn = Math.sin(a), nx = R.dx * c - R.dy * sn, ny = R.dx * sn + R.dy * c;
        if (isWalkable(Math.floor(N.x + nx * 1.2), Math.floor(N.y + ny * 1.2))) { R.dx = nx; R.dy = ny; turned = true; break; }
      }
      if (!R.kidSay) { R.kidSay = 1; floater(N.x, N.y - 2, turned ? 'Малыш! Объезжаю!' : 'Ой, малыш! Тормозу!', '#bfe8ff'); }
      if (!turned) { n2RollEnd(N, 'stop'); return; }
      N.tel = null;
    }
    const st = Math.min(7 * dt, 0.45), nx = N.x + R.dx * st, ny = N.y + R.dy * st;
    if (!isWalkable(Math.floor(nx), Math.floor(ny))) { n2RollEnd(N, 'bounce'); return; }
    N.x = nx; N.y = ny; R.went += st;
    if (Math.abs(R.dx) > 0.1) N.face = R.dx > 0 ? 1 : -1;
    // сносит всех на пути — кроме гномят
    for (const u of Game.units) {
      if (u.dead || u.inside || R.hit.includes(u.id) || n2Kid(u) || Math.hypot(u.x - N.x, u.y - N.y) > 0.85) continue;
      if (u.hero && u.hero.hp <= 0) continue;
      R.hit.push(u.id);
      n2RollHit(N, u);
    }
    for (const M of Game.neutrals) {
      if (M === N || !neuAlive(M) || R.hit.includes(M.id) || Math.hypot(M.x - N.x, M.y - N.y) > 0.9) continue;
      R.hit.push(M.id);
      const d = 6 + n2Rand() * 4;
      M.hp -= d; M.ov = NA_FRAMES.hurt4; M.ovT = 0; M.ovP = 0.07;
      floater(M.x, M.y - 1.8, '−' + Math.round(d), '#ffd070');
      if (M.hp <= 0) neuKill(M, null);
    }
    if (R.went >= R.len) n2RollEnd(N, 'stop');
    return;
  }
  if (R.ph === 'bounce') {
    N.fr = 'bo' + Math.min(3, Math.floor(R.t / 0.12));
    const bx = N.x - R.dx * dt * 2.4, by = N.y - R.dy * dt * 2.4;
    if (isWalkable(Math.floor(bx), Math.floor(by))) { N.x = bx; N.y = by; }
    if (R.t >= 0.48) {
      N.rl = null; N.st = 'chase'; N.rlCd = now + 7; N.atkT = 9;
      if (typeof cbFxSet === 'function') { cbFxSet(N, 'stun', 1.5, null, 'Оглушён!', '#ffe070'); cbFxSet(N, 'open', 3, null, null); floater(N.x, N.y - 2.8, 'Открыт!', '#ffd040'); }
    }
    return;
  }
  // разворот: раскрылся, огляделся
  N.fr = 'un' + Math.min(3, Math.floor(R.t / 0.1));
  if (R.t >= 0.4) { N.rl = null; N.st = 'chase'; N.rlCd = now + 7; N.face = -N.face; N.atkT = 9; }
}

// ---------- Поведение: обёртка мысли нейтрала ----------
{
  const _th = neuThink;
  neuThink = function (N, dt) {
    if (N.st === 'die') { N.rl = null; N.pat = 0; return _th(N, dt); }
    const S = NSPEC[N.k], now = n2Now();
    // броненосец в шаре — своя механика
    if (N.rl) { if (N.ov) N.ovT += dt; N.cdA -= dt; n2RollThink(N, dt); return; }
    const tg = neuUnit(N.tg);
    if (tg) N.pat = 0;
    if (N.k === 'armad' && tg && !(N.rlCd > now) && N.st !== 'atk' && !(typeof cbOn === 'function' && cbOn(N, 'stun')) && !neuUnitOut(tg)) {
      const d = Math.hypot(tg.x - N.x, tg.y - N.y);
      if (d > 3 && d < 9 && Math.hypot(N.x - N.hx, N.y - N.hy) < NEU_LEASH - 2) { n2RollStart(N, tg); return; }
    }
    // лучник держит дистанцию: подошли вплотную — отскакивает
    if (S.ranged && tg && N.st !== 'atk' && !neuUnitOut(tg) && !(typeof cbOn === 'function' && cbOn(N, 'stun'))) {
      const d = Math.hypot(tg.x - N.x, tg.y - N.y);
      if (d < 2.6 && Math.hypot(N.x - N.hx, N.y - N.hy) < NEU_LEASH - 3) {
        N.cdA -= dt; if (N.ov) N.ovT += dt;
        const a = Math.atan2(N.y - tg.y, N.x - tg.x) + Math.sin(now * 0.9 + N.id) * 0.6;
        N.st = 'flee'; N.dist = d;
        neuMove(N, N.x + Math.cos(a) * 2, N.y + Math.sin(a) * 2, S.spd, dt);
        N.face = tg.x >= N.x ? 1 : -1;
        N.fr = neuFrame(N);
        if (!(N.galT > now)) { N.galT = now + 0.9; sfxAt('gtGallop', N.x * TILE, N.y * TILE, 0.4); }
        return;
      }
    }
    // патруль: уходит от логова, постоит, вернётся (первым не нападает)
    if (N.pat && !tg) {
      if (N.ov) N.ovT += dt;
      if (N.pat === 1) {
        N.st = 'roam';
        if (neuMove(N, N.wx, N.wy, S.spd * 0.5, dt)) { N.pat = 2; N.patW = 3 + n2Rand() * 4; N.st = 'idle'; }
      } else { N.st = 'idle'; N.patW -= dt; if (N.patW <= 0) { N.pat = 0; N.st = 'home'; N.patT = 40 + n2Rand() * 50; } }
      N.fr = neuFrame(N);
      return;
    }
    _th(N, dt);
    if (N.st === 'die') return;
    // тролль зарастает раны; огонь не даёт
    if (N2_TROLLS[N.k] && N.hp < N.mhp) {
      if (typeof cbOn === 'function' && cbOn(N, 'burn')) N.noRegen = now + 6;
      if (!(N.noRegen > now)) {
        const h = N.mhp * S.regen * dt;
        N.hp = Math.min(N.mhp, N.hp + h); N.rgAcc = (N.rgAcc || 0) + h;
        if (N.rgAcc >= N.mhp * 0.05) { floater(N.x, N.y - 2, '+' + Math.round(N.rgAcc), '#8af070'); N.rgAcc = 0; }
      } else if (!(N.rgSay > now - 4) && N.tg) { N.rgSay = now; floater(N.x, N.y - 2.4, 'Огонь не даёт зарасти!', '#ff9a40'); }
    }
    // гоблины обступают цель со всех сторон
    if (N.k === 'goblin' && N.st === 'chase' && tg && N.dist < 4) {
      const a = Math.atan2(tg.y - N.y, tg.x - N.x) + Math.PI / 2, s = (N.id % 2 ? 1 : -1) * 0.7 * dt;
      const nx = N.x + Math.cos(a) * s, ny = N.y + Math.sin(a) * s;
      if (isWalkable(Math.floor(nx), Math.floor(ny))) { N.x = nx; N.y = ny; }
    }
    // последний гоблин лагеря удирает
    if (N.k === 'goblin' && tg && !N.coward && N.hp < N.mhp * 0.7 && !Game.neutrals.some(M => M !== N && M.lair === N.lair && neuAlive(M))) {
      N.coward = 1; N.tg = 0; N.prov = -99; N.st = 'home';
      floater(N.x, N.y - 2, 'Мамочки! Я один!', '#ffe9a0');
    }
    // гномтавр на скаку цокает
    if ((N.k === 'gtSpear' || N.k === 'gtBow') && N.st === 'chase' && !(N.galT > now)) { N.galT = now + 0.9; sfxAt('gtGallop', N.x * TILE, N.y * TILE, 0.35); }
    // начать патруль: с ростом дней всё дальше; ледяные и дружелюбные феи сидят дома
    if (!tg && N.lair && N.st === 'idle' && !S.friendly && N.k !== 'frost' && startDay() >= 2 && startOpen('neutrals')) {
      N.patT = (N.patT === undefined ? 20 + n2Rand() * 60 : N.patT) - dt;
      if (N.patT <= 0) {
        N.patT = 40 + n2Rand() * 50;
        const R = Math.min(12, 4 + 1.4 * startDay()), a = n2Rand() * 6.283, r = R * (0.6 + n2Rand() * 0.4);
        const wx = N.hx + Math.cos(a) * r, wy = N.hy + Math.sin(a) * r * 0.8;
        if (inb(Math.floor(wx), Math.floor(wy)) && (S.fly || isWalkable(Math.floor(wx), Math.floor(wy)))) { N.wx = wx; N.wy = wy; N.pat = 1; }
      }
    }
  };
}

// ---------- Урон, зов, удары, опыт ----------
{
  // все гоблины лагеря — сразу на обидчика
  const _pv = neuProvoke;
  neuProvoke = function (N, u) {
    const first = !(n2Now() - N.prov < NEU_FORGET);
    _pv(N, u);
    if (!u || !first) return;
    if (N.k === 'goblin') {
      let n = 0;
      for (const M of Game.neutrals) if (M !== N && M.lair === N.lair && neuAlive(M) && !M.tg) { M.tg = u.id; M.prov = n2Now(); M.cdA = 0.2 + n2Rand() * 0.6; M.pat = 0; n++; }
      sfxAt('goblinCry', N.x * TILE, N.y * TILE, 0.8);
      if (n) logEvent('animal', 'Гоблины всем лагерем бросились в драку', N.x, N.y);
    } else if (N2_TROLLS[N.k]) sfxAt('trollRoar', N.x * TILE, N.y * TILE, 0.9);
    else if (N.k === 'gtSpear' || N.k === 'gtBow') sfxAt('gtGallop', N.x * TILE, N.y * TILE, 0.7);
  };

  // по шару броненосца бьют вполсилы… вчетверть; 4 кадра получения удара у всех
  const _nh = neuHit;
  neuHit = function (N, u, dmg) {
    if (N.rl && N.rl.ph !== 'bounce' && neuAlive(N)) { dmg *= 0.25; if (!(N.armSay > n2Now() - 2)) { N.armSay = n2Now(); floater(N.x, N.y - 2.4, 'Броня!', '#c8d0d8'); } }
    _nh(N, u, dmg);
    if (N.ov && N.ov[0] === 'hurt' && N.st !== 'die') { N.ov = NA_FRAMES.hurt4; N.ovT = 0; N.ovP = 0.07; }
  };

  // удар нейтрала: множитель ранга; лучник — видимая стрела; тролль — глухой удар дубины
  const _ns = neuStrike;
  neuStrike = function (N, tg) {
    if (N.k === 'gtBow') { N.arw = { x: Math.round(tg.x * 100) / 100, y: Math.round(tg.y * 100) / 100, t: Math.round(n2Now() * 100) / 100 }; sfxAt('gtBow', N.x * TILE, N.y * TILE, 0.7); }
    else if (N2_TROLLS[N.k]) sfxAt('trollClub', tg.x * TILE, tg.y * TILE, 0.8);
    else if (N.k === 'goblin' && n2Rand() < 0.3) sfxAt('goblinCry', N.x * TILE, N.y * TILE, 0.4);
    const m = N2.mul;
    N2.mul = N2_RK_DMG[n2Rk(N)];
    try { _ns(N, tg); } finally { N2.mul = m; }
  };
  const _hu = neuHurtUnit;
  neuHurtUnit = function (u, n) { _hu(u, n * N2.mul); };

  const _gx = neuGiveXp;
  neuGiveXp = function (N, killer, xp) { _gx(N, killer, Math.round(xp * N2_RK_XP[n2Rk(N)])); };

  const _kl = neuKill;
  neuKill = function (N, killer) {
    const L = Game.lairs.find(l => l.id === N.lair);
    _kl(N, killer);
    N.rl = null; N.tel = null;
    if (N.k === 'goblin') sfxAt('goblinDie', N.x * TILE, N.y * TILE, 0.7);
    else if (N2_TROLLS[N.k]) sfxAt('trollRoar', N.x * TILE, N.y * TILE, 0.5);
    if (n2Rk(N) >= 3) dropPile(Math.floor(N.x), Math.floor(N.y), 'gold', n2Rk(N) - 1);
    // зачистка новых логов — побольше награда
    if (L && !L.alive && N2_LAIRS[L.k]) dropPile(Math.floor(N.x), Math.floor(N.y), 'gold', N2_TROLLS[L.k] ? 4 : L.k === 'gnomtaur' ? 3 : 1);
  };

  // наполнение логова: гоблинов 5–8; стойбище — копейщик, лучник (+копейщик подальше); ранг — по ночам
  const _fl = neuFillLair;
  neuFillLair = function (lair) {
    if (lair.k === 'goblin') {
      const n = Math.min(8, 5 + (lair.lv > 1.2 ? 1 : 0) + ((n2Rand() * 3) | 0));
      for (let i = 0; i < n; i++) Game.neutrals.push(neuMake('goblin', lair, i));
      lair.respawn = 0; lair.alive = n;
      return;
    }
    if (lair.k === 'gnomtaur') {
      const ks = ['gtSpear', 'gtBow'].concat(lair.lv > 1.25 ? ['gtSpear'] : []);
      ks.forEach((k, i) => Game.neutrals.push(neuMake(k, lair, i)));
      lair.respawn = 0; lair.alive = ks.length;
      return;
    }
    if (N2_LAIRS[lair.k]) { Game.neutrals.push(neuMake(lair.k, lair, 0)); lair.respawn = 0; lair.alive = 1; return; }
    _fl(lair);
  };
  const _mk = neuMake;
  neuMake = function (k, lair, i) {
    const N = _mk(k, lair, i), r = N2.rk0 || lair.rk0 || 1;
    if (r > 1 && !NSPEC[k].friendly) n2SetRank(N, r, true);
    return N;
  };

  // тяжёлые удары троллей и копейщика — с красным кругом (телеграф combat.js)
  if (typeof cbPlan === 'function') {
    const _cp = cbPlan;
    cbPlan = function (N) {
      if (!(N2_TROLLS[N.k] || N.k === 'gtSpear')) return _cp(N);
      N.atkN = (N.atkN || 0) + 1;
      const heavy = N.atkN % 3 === 0, tg = neuUnit(N.tg);
      N.atkK = heavy ? 'heavy' : 'light';
      if (heavy && tg) {
        N.tel = { k: 'heavy', x: cbR2(tg.x), y: cbR2(tg.y), r: N2_TROLLS[N.k] ? 1.5 : 1.15, p: 0 }; N.telAt = n2Now();
        floater(N.x, N.y - 2.6, '!', '#ff5a3a');
        sfxAt(N2_TROLLS[N.k] ? 'trollRoar' : 'thud', N.x * TILE, N.y * TILE, 0.4);
      } else N.tel = null;
    };
  }
  if (typeof cbTop === 'function') { const _ct = cbTop; cbTop = function (N) { return (N2_TOP[N.k] || _ct(N)) * n2Sz(N); }; }
}

// ---------- Огненный шар и Оберег героя по нейтралам ----------
function n2SpellHit(M, u, dmg, el) {
  if (!neuAlive(M)) return;
  neuProvoke(M, u);
  M.hp -= dmg;
  M.ov = NA_FRAMES.hurt4; M.ovT = 0; M.ovP = 0.07;
  floater(M.x, M.y - 1.7, '−' + Math.max(1, Math.round(dmg)), el === 'fire' ? '#ff9a40' : '#fff2a0');
  if (el === 'fire') { if (typeof cbFxSet === 'function') cbFxSet(M, 'burn', 3, u, null); if (N2_TROLLS[M.k]) M.noRegen = n2Now() + 6; }
  if (M.hp <= 0) neuKill(M, u);
}

function n2Fireball(N0, u, x, y) {
  const H = u && u.hero, lvl = (H && H.level) || 1;
  const cx = neuAlive(N0) ? N0.x : x, cy = neuAlive(N0) ? N0.y : y;
  fxBurst(cx * TILE, cy * TILE - 10, 30, ['#fff0a0', '#ff9a30', '#e04a18'], 110, 70, 0.8, 2.4, 160);
  sfxAt('crackle', cx * TILE, cy * TILE, 1);
  let n = 0;
  for (const M of Game.neutrals.slice()) {
    if (!neuAlive(M) || Math.hypot(M.x - cx, M.y - cy) > 2.2) continue;
    if (M !== N0 && NSPEC[M.k].friendly && !(n2Now() - M.prov < NEU_FORGET)) continue;
    const w = (typeof CB_WEAK !== 'undefined' && CB_WEAK[M.k] && CB_WEAK[M.k].fire) || 1;
    n2SpellHit(M, u, (18 + 2 * lvl) * w * (M === N0 ? 1 : 0.7), 'fire');
    n++;
  }
  if (n > 1) floater(cx, cy - 2.6, `Огненный шар: задело ${n}!`, '#ffb050');
  if (H) logEvent('tree', `${H.name} метнул огненный шар в лесных жителей`, cx, cy);
}

if (typeof hmCast === 'function') {
  const _hf = hmFoe;
  hmFoe = function (u, r) {
    const b = _hf(u, r);
    if (b || N2.cast !== 'fire') return b;
    let best = null, bs = -1;
    for (const N of Game.neutrals) {
      if (!neuAlive(N)) continue;
      const d = Math.hypot(N.x - u.x, N.y - u.y);
      if (d > r) continue;
      const angry = N.tg === u.id || n2Now() - N.prov < NEU_FORGET;
      const s = angry ? 100 - d : (N.k === 'goblin' || N2_TROLLS[N.k]) ? 50 - d : -1;
      if (s > bs) { bs = s; best = N; }
    }
    if (!best || bs < 0) return null;
    N2.fireN = best;
    return { kind: 'neu', o: best };
  };
  const _hb = hmBolt;
  hmBolt = function (sx, sy, tx, ty, col, done) {
    const N = N2.cast === 'fire' && N2.fireN, u = Game.hero;
    if (N) { N2.fireN = null; return _hb(sx, sy, tx, ty, col, () => n2Fireball(N, u, tx, ty)); }
    return _hb(sx, sy, tx, ty, col, done);
  };
  const _hc = hmCast;
  hmCast = function (k) {
    const u = Game.hero, H = u && u.hero, cd0 = H && H.cdWard;
    N2.cast = k; N2.fireN = null;
    try { _hc(k); } finally { N2.cast = null; N2.fireN = null; }
    // Оберег сработал: гоблины рядом обожжены светом и разбегаются
    if (k === 'ward' && H && H.cdWard !== cd0) {
      let n = 0;
      for (const M of Game.neutrals.slice()) {
        if (M.k !== 'goblin' || !neuAlive(M) || Math.hypot(M.x - u.x, M.y - u.y) > 7) continue;
        n2SpellHit(M, u, 8 + (H.level || 1), 'holy');
        if (neuAlive(M)) { M.tg = 0; M.st = 'home'; M.prov = n2Now() - NEU_FORGET + 6; floater(M.x, M.y - 2.2, 'Ай, свет!', '#fff2a0'); }
        n++;
      }
      if (n) logEvent('tree', `${H.name}: Оберег разогнал гоблинов (${n})`, u.x, u.y);
    }
  };
}

// ---------- Тик, сохранение, зеркало ----------
{
  const _step = step;
  step = function (dt) { _step(dt); if (!isMirror()) n2Tick(dt); };
  const _setup = setupStart;
  setupStart = function (...a) { _setup(...a); N2.rng = mulberry32((((a[0] | 0) ^ 0x4E2B17) >>> 0)); Game.n2 = { nt: startNights(), sp: {} }; };
  const _reset = resetGameState;
  resetGameState = function () { _reset(); Game.n2 = null; N2.stamp = null; for (const k in NSPEC) if (NSPEC[k].roam0 !== undefined) NSPEC[k].roam = NSPEC[k].roam0; };
  const _ser = serializeGame;
  serializeGame = function () {
    const s = _ser();
    if (s.nt) {
      const rk = {}, lrk = {};
      for (const N of Game.neutrals) if (N.st !== 'die' && n2Rk(N) > 1) rk[N.id] = [n2Rk(N), Math.round(N.hp)];
      for (const L of Game.lairs) if (L.rk0 > 1) lrk[L.id] = L.rk0;
      s.nt.rk = rk; s.nt.lrk = lrk;
      if (Game.n2) s.nt.n2 = { nt: Game.n2.nt, sp: Game.n2.sp };
    }
    return s;
  };
  const _apply = applySave;
  applySave = function (s) {
    _apply(s);
    const nt = s && s.nt;
    if (!nt || isMirror()) { Game.n2 = null; return; }
    for (const L of Game.lairs) if (nt.lrk && nt.lrk[L.id]) L.rk0 = nt.lrk[L.id];
    if (nt.rk) for (const N of Game.neutrals) {
      const r = nt.rk[N.id];
      if (!r) continue;
      n2SetRank(N, r[0], true);
      N.hp = Math.max(1, Math.min(N.mhp, r[1] || N.mhp));
    }
    if (nt.n2) Game.n2 = { nt: nt.n2.nt | 0, sp: Object.assign({}, nt.n2.sp) };
    else {
      // старое сохранение: догнать одну ночь (окрепнет хотя бы один), новые логова встанут по расписанию
      const sp = {};
      for (const L of Game.lairs) { const k = N2_TROLLS[L.k] ? 'troll' : L.k; if (N2_BASE[k]) sp[k] = (sp[k] || 0) + 1; }
      Game.n2 = { nt: Math.max(0, startNights() - 1), sp };
    }
  };
  const _nm = neuMirror;
  neuMirror = function () {
    const a = _nm(), by = new Map(Game.neutrals.map(N => [N.id, N]));
    for (const d of a) {
      const N = by.get(d.id);
      if (!N) continue;
      if (n2Rk(N) > 1) d.rk = n2Rk(N);
      if (N.arw && n2Now() - N.arw.t < 0.4) d.arw = N.arw;
      if (N.tel && !d.tel) d.tel = N.tel;
    }
    return a;
  };
}

// ---------- Рисование: облики, ранг, стрелы ----------
{
  const _nd = neuDraw;
  neuDraw = function (c, N) {
    const rk = n2Rk(N);
    if (!N2_KINDS[N.k] && rk <= 1) return _nd(c, N);
    const S = NSPEC[N.k], art = N.k === 'goblin' && N.id % 2 ? 'goblinB' : N.k, sp = naFrame(art, N.fr || 'i0'), sc = n2Sz(N);
    const px = Math.round(N.x * TILE), py = Math.round(N.y * TILE + 6), dead = N.st === 'die';
    const al = dead ? Math.max(0, Math.min(1, 1 - (N.dt - 0.9) / 2.3)) : 1;
    if (al <= 0) return;
    c.save();
    c.globalAlpha = al;
    c.fillStyle = 'rgba(10,8,4,0.3)';
    c.beginPath(); c.ellipse(px, py + 1, S.sz * sc * (dead ? 1.1 : 0.8), S.sz * sc * 0.28, 0, 0, 7); c.fill();
    const bob = (N.k === 'fairy' || N.k === 'pixie') && !dead ? Math.round(Math.sin(Game.time * 3.2 + N.id) * 1.3) : 0;
    c.translate(px, py + bob);
    c.scale(N.face < 0 ? -sc : sc, sc);
    c.drawImage(sp.cv, -sp.ax, -sp.ay);
    c.restore();
    // стрела лучника в полёте
    const A = N.arw;
    if (A && !dead) {
      const k = (Game.time - A.t) / 0.3;
      if (k >= 0 && k < 1) {
        const x0 = N.x * TILE + N.face * 10, y0 = N.y * TILE - 26, x1 = A.x * TILE, y1 = A.y * TILE - 14;
        const x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * 10, ang = Math.atan2(y1 - y0 - Math.cos(k * Math.PI) * 10 * Math.PI, x1 - x0);
        c.save(); c.translate(Math.round(x), Math.round(y)); c.rotate(ang);
        c.fillStyle = '#8a6038'; c.fillRect(-7, -0.5, 9, 1); c.fillStyle = '#d8d8e0'; c.fillRect(2, -1, 3, 2); c.fillStyle = '#e8e0c8'; c.fillRect(-8, -1.5, 2, 1); c.fillRect(-8, 0.5, 2, 1);
        c.restore();
      }
    }
    if (dead) return;
    const top = py - Math.round((N2_TOP[N.k] || 40) * sc);
    if (N.hp < N.mhp - 0.5) {
      const w = 18 + (rk - 1) * 3, r = Math.max(0, N.hp / N.mhp);
      c.fillStyle = 'rgba(10,6,2,0.85)'; c.fillRect(px - w / 2 - 1, top - 1, w + 2, 4);
      c.fillStyle = r > 0.5 ? '#5ac04a' : r > 0.25 ? '#e0b030' : '#e04a3a'; c.fillRect(px - w / 2, top, Math.round(w * r), 2);
    }
    if (rk > 1) n2Badge(c, px, top - 5, rk);
  };
}

// значок ранга: золотые треугольники, у 5-го — корона
function n2Badge(c, x, y, rk) {
  c.save();
  if (rk >= 5) {
    c.fillStyle = '#1a1008'; c.fillRect(x - 6, y - 5, 12, 7);
    c.fillStyle = '#ffd040'; c.fillRect(x - 5, y - 1, 10, 2); for (const dx of [-5, -1, 3]) c.fillRect(x + dx, y - 4, 2, 3);
    c.fillStyle = '#e04a3a'; c.fillRect(x - 1, y - 1, 2, 1);
  } else {
    const n = rk - 1, w = n * 6;
    for (let i = 0; i < n; i++) {
      const bx = x - w / 2 + i * 6 + 3;
      c.fillStyle = '#1a1008'; c.beginPath(); c.moveTo(bx - 3.5, y + 1.5); c.lineTo(bx, y - 4.5); c.lineTo(bx + 3.5, y + 1.5); c.closePath(); c.fill();
      c.fillStyle = rk >= 4 ? '#ff9a40' : '#ffd040'; c.beginPath(); c.moveTo(bx - 2.2, y + 0.6); c.lineTo(bx, y - 3); c.lineTo(bx + 2.2, y + 0.6); c.closePath(); c.fill();
    }
  }
  c.restore();
}

// ---------- Звуки (своё синтез-ядро sfx.js) ----------
if (typeof SFX !== 'undefined' && typeof SFX_DEF !== 'undefined') {
  Object.assign(SFX_DEF, {
    trollRoar: { pri: 3, gain: 0.75, poly: 1, cd: 1.2, len: 1, wet: 0.4 },
    trollClub: { pri: 2, gain: 0.7, poly: 2, cd: 0.2, len: 0.5 },
    armadRoll: { pri: 1, gain: 0.5, poly: 2, cd: 0.2, len: 0.6 },
    armadBonk: { pri: 2, gain: 0.7, poly: 1, cd: 0.3, len: 0.8, wet: 0.3 },
    goblinCry: { pri: 2, gain: 0.5, poly: 3, cd: 0.25, len: 0.5 },
    goblinDie: { pri: 1, gain: 0.45, poly: 3, cd: 0.1, len: 0.4 },
    gtGallop: { pri: 1, gain: 0.45, poly: 2, cd: 0.3, len: 0.6 },
    gtBow: { pri: 2, gain: 0.5, poly: 2, cd: 0.15, len: 0.4 },
  });
  const rsp = (d, t, f0, f1, len, vol, fm, am, dp) => { if (typeof rasp === 'function') rasp(d, t, f0, f1, len, vol, fm, am, dp); else tone(d, 'sawtooth', f0, f1, t, len, vol * 0.5, 0.02); };
  Object.assign(SFX, {
    // тролль: низкий хриплый рёв с утробным гулом
    trollRoar: (d, t, v) => { rsp(d, t, 95 + v * 15, 62, 0.75, 0.6, 380, 28, 0.8); tone(d, 'sine', 58, 42, t, 0.7, 0.35, 0.05); noiseHit(d, 'lowpass', 500, 220, 1, t, 0.6, 0.2, 0.06); },
    // глухой удар бревна о землю
    trollClub: (d, t) => { tone(d, 'sine', 75, 38, t, 0.3, 0.7, 0.003); noiseHit(d, 'lowpass', 420, 160, 1, t, 0.22, 0.5); noiseHit(d, 'bandpass', 1400, 600, 1.4, t + 0.02, 0.05, 0.15); },
    // каменный рокот катящегося панциря
    armadRoll: (d, t) => { for (let k = 0; k < 6; k++) noiseHit(d, 'lowpass', 340 + Math.random() * 160, 200, 1.3, t + k * 0.08, 0.09, 0.32, 0.01); tone(d, 'triangle', 90, 70, t, 0.5, 0.15, 0.03); },
    // звонкий «бом» панциря о препятствие
    armadBonk: (d, t) => { modal(d, t, [[230, 1, 0.45], [590, 0.45, 0.22], [1180, 0.2, 0.1]], 0.55, 0.002); noiseHit(d, 'bandpass', 900, 500, 1.2, t, 0.06, 0.3); },
    // гоблин: визгливое «йа-а!»
    goblinCry: (d, t, v) => { rsp(d, t, 680 + v * 120, 1120, 0.24, 0.42, 1800, 95, 0.5); },
    // гоблинский писк
    goblinDie: (d, t) => { tone(d, 'square', 920, 300, t, 0.2, 0.18, 0.004); tone(d, 'sine', 1300, 500, t + 0.04, 0.15, 0.1, 0.004); },
    // цокот копыт
    gtGallop: (d, t) => { for (const [k, f] of [[0, 1], [0.11, 0.85], [0.26, 1], [0.37, 0.85]]) { noiseHit(d, 'bandpass', 1100 * f, 700, 2, t + k, 0.03, 0.35, 0.001); tone(d, 'sine', 160 * f, 90, t + k, 0.05, 0.2, 0.002); } },
    // тетива и свист стрелы
    gtBow: (d, t) => { tone(d, 'triangle', 190, 120, t, 0.12, 0.35, 0.002); noiseHit(d, 'highpass', 3000, 5200, 0.8, t + 0.03, 0.22, 0.2, 0.02); },
  });
}

// ---------- Ачивки ----------
function n2AchInit() {
  if (typeof ACHS === 'undefined' || typeof ACH_BY === 'undefined' || ACH_BY.ntroll) return;
  const add = [
    { id: 'ntroll', name: 'Мост свободен', desc: 'Побеждён тролль. Он зарастал, как газон после дождя, но огонь объяснил ему, что к чему.', ev: /победил: (Лесной|Каменный|Болотный) тролль/ },
    { id: 'narmad', name: 'Шар не прошёл', desc: 'Побеждён броненосец. Боулинг закрыт на ремонт.', ev: /победил: Броненосец/ },
    { id: 'ngoblin', name: 'Тапок для гоблинов', desc: 'Побеждён гоблин. Остальные шестеро уже бегут жаловаться маме.', ev: /победил: Гоблин/ },
    { id: 'ngtaur', name: 'Полконя, полгнома, полный разгром', desc: 'Побеждён гномтавр. Борода — гномья, копыта — нет. Спор о родстве продолжается.', ev: /победил: Гномтавр/ },
    { id: 'nrank', name: 'Лес качается', desc: 'В лесу окреп нейтрал. Пока гномы строили склад, кабаны ходили в качалку.', ev: /В лесу окреп/ },
  ];
  for (const a of add) { ACHS.push(a); ACH_BY[a.id] = a; }
}
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('DOMContentLoaded', n2AchInit);
