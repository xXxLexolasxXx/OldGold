'use strict';
// Лесные нейтралы: логова в лесах (грибное кольцо фей, дупло лешего, лёжка кабанов, пятно чумных моховиков).
// Нейтральны: ни на кого не нападают, пока их не тронули. Герой (по клику) и рекруты гильдий могут напасть;
// тронутый нейтрал дерётся в ответ и зовёт своих. За победу: добыча падает на землю (её подбирают трудяги),
// опыт получают герой и все жители и рекруты в радиусе NEU_XP_R. Поражение героя — как в herolife.js.
// Симуляция идёт там же, где и вся игра (в кооперативе — на сервере), клиенты получают нейтралов зеркалом.
// Подключается после guilds.js: оборачивает их «врагов» (foesNear, strike, fightGen…), рисует через drawSkeletons.

const NEU_LEASH = 16;       // дальше от логова не гонятся
const NEU_XP_R = 12;        // радиус, в котором жители получают опыт
const NEU_CALL_R = 10;      // радиус зова своих
const NEU_RESPAWN = 480;    // через сколько секунд логово заселяется снова
const NEU_FORGET = 28;      // через сколько секунд без драки нейтрал успокаивается

// dmg — удар, cd — пауза между ударами, rng — дальность, spd — клеток/с, parry — шанс отвести удар
const NSPEC = {
  pixie: { name: 'Цветочная фея', mhp: 18, dmg: [1, 3],  cd: 1.4, rng: 2.4, spd: 2.8, parry: 0.3, xp: 18, fly: true, roam: 3.5, sz: 5, friendly: true,
    drop: [['mana', 1, 0.5], ['gold', 1, 0.4], ['magicstone', 1, 0.4]], msg: ['Ай! За что?!', 'Мы же добрые!', 'Рощу не троньте!'] },
  fairy: { name: 'Лесная фея',    mhp: 22, dmg: [2, 4],  cd: 1.3, rng: 2.4, spd: 2.7, parry: 0.22, xp: 22, fly: true, roam: 4.5, sz: 6,
    drop: [['magicstone', 1, 0.55], ['mana', 1, 0.4], ['gold', 1, 0.3]], msg: ['Не трожь наш лес!', 'Пыльца — не бесплатная!', 'Ай! Сестрички!'] },
  leshy: { name: 'Леший',         mhp: 82, dmg: [8, 12], cd: 1.9, rng: 1.7, spd: 1.5, parry: 0.1, xp: 90, roam: 2.5, sz: 12,
    drop: [['trunk', 4, 1], ['timber', 2, 0.6], ['gold', 2, 0.5], ['magicstone', 1, 0.3]], msg: ['Кто бродит по моим кочкам?!', 'Уходи по-хорошему!', 'Мох мне свидетель!'] },
  boar:  { name: 'Кабан-страж',   mhp: 46, dmg: [4, 6],  cd: 1.5, rng: 1.3, spd: 3.1, parry: 0.14, xp: 48, roam: 3.2, sz: 14,
    drop: [['hide', 2, 1], ['sausage', 2, 0.8], ['gold', 1, 0.2]], msg: ['Хрю! (угрожающе)', 'Хрррр!', 'Хрюк-хрюк!'] },
  spore: { name: 'Чумной моховик', mhp: 36, dmg: [3, 6],  cd: 1.5, rng: 1.7, spd: 1.35, parry: 0.08, xp: 30, roam: 2.6, sz: 9,
    drop: [['hops', 2, 1], ['magicstone', 1, 0.5], ['mana', 1, 0.35]], msg: ['Апчхи! (на вас)', 'Мы — грибы. Мы — везде.', 'Не наступай на семью!'] },
};
// из чего состоит логово
const NLAIR = {
  pixie: ['pixie', 'pixie'],
  fairy: ['fairy', 'fairy'],
  leshy: ['leshy'],
  boar:  ['boar', 'boar'],
  spore: ['spore', 'spore'],
};
const NEU_LAIR_NAME = { pixie: 'Домик фей на дереве', fairy: 'Поляна лесных фей', leshy: 'Дупло лешего', boar: 'Лёжка кабанов', spore: 'Пятно чумных грибов' };

Game.neutrals = [];
Game.lairs = [];
Game.nstat = { kills: {}, lost: 0, lairs: 0, xp: 0 };

const neuAlive = N => N && N.st !== 'die';
const neuUnit = id => (id ? Game.unitMap.get(id) || null : null);
function neuR(a, b) { return a + Math.random() * (b - a); }

// ---------- Рождение ----------

function neuMake(k, lair, i) {
  const S = NSPEC[k], lv = lair.lv || 1;
  const a = i * 2.4 + Math.random(), r = 1 + Math.random() * 1.6;
  let x = lair.x + 0.5 + Math.cos(a) * r, y = lair.y + 0.5 + Math.sin(a) * r * 0.7;
  if (!S.fly && !isWalkable(Math.floor(x), Math.floor(y))) { x = lair.x + 0.5; y = lair.y + 1.5; }
  const N = {
    id: Game.nextId++, k, lair: lair.id, x, y, hx: lair.x + 0.5, hy: lair.y + 0.5,
    mhp: Math.round(S.mhp * lv * dif().neuHp), hp: 0, lv, face: Math.random() < 0.5 ? 1 : -1, st: 'idle', t: 1 + Math.random() * 4,
    fr: 'i0', ph: Math.random() * 6, tg: 0, prov: -99, cdA: 1, atkT: 9, hit: 1, ov: null, ovT: 0, winT: 0, dt: 0, wx: 0, wy: 0, say: 0,
  };
  N.hp = N.mhp;
  return N;
}

function neuFillLair(lair) {
  const kinds = NLAIR[lair.k].slice();
  if (lair.lv > 1.25 && !NEU_NO_EXTRA[lair.k]) kinds.push(lair.k);          // дальние логова населены гуще (кроме одиночек, фей и кабанов — их и так не должно быть много)
  kinds.forEach((k, i) => Game.neutrals.push(neuMake(k, lair, i)));
  lair.respawn = 0; lair.alive = kinds.length;
}

// Подходящее место для логова: трава в лесу, достижимо от деревни, не у воды и построек, не рядом с другим логовом
function neuTrySite(rng, stamp, minStart) {
  const cx = MAP_W >> 1, cy = MAP_H >> 1;
  const x = 4 + (rng() * (MAP_W - 8) | 0), y = 4 + (rng() * (MAP_H - 8) | 0);
  const i = idx(x, y);
  if (World.terrain[i] !== T_GRASS || World.bmap[i] || World.road[i] || !reachedIn(stamp, x, y)) return null;
  const ds = Math.hypot(x - cx, y - cy);
  if (ds < minStart) return null;
  let trees = 0;
  for (let yy = y - 4; yy <= y + 4; yy++) for (let xx = x - 4; xx <= x + 4; xx++) {
    if (!inb(xx, yy)) return null;
    const t = World.terrain[idx(xx, yy)], o = World.obj[idx(xx, yy)];
    if (t === T_WATER || World.bmap[idx(xx, yy)]) return null;
    if (o && o.t === 'tree') trees++;
  }
  if (trees < 11) return null;
  if (Game.buildings.some(b => Math.hypot(b.x - x, b.y - y) < 12)) return null;
  if (Game.lairs.some(l => Math.hypot(l.x - x, l.y - y) < 15)) return null;
  return { x, y, ds };
}

function neuAddLair(k, site, minStart) {
  const { x, y, ds } = site;
  const far = Math.min(1, Math.max(0, (ds - minStart) / 40));
  const lair = { id: Game.nextId++, k, x, y, lv: k === 'pixie' ? 1 : Math.round((1 + far * 0.45) * 100) / 100, respawn: 0, alive: 0, fr: 0 };
  // полянка: вырубаем деревья вокруг, чтобы было где жить и драться (к югу шире: кроны южных деревьев иначе закрывают логово)
  for (let yy = y - 3; yy <= y + 5; yy++) for (let xx = x - 4; xx <= x + 4; xx++) {
    const ex = (xx - x) / 3.4, ey = (yy - y) / (yy >= y ? 4.2 : 2.6);
    if (!inb(xx, yy) || ex * ex + ey * ey > 1) continue;
    const o = World.obj[idx(xx, yy)];
    if (o && (o.t === 'tree' || o.t === 'stump')) { World.obj[idx(xx, yy)] = null; World.growing.delete(idx(xx, yy)); }
  }
  Game.lairs.push(lair);
  neuFillLair(lair);
  return lair;
}

const NEU_MIN_PIXIE = 1;   // на каждой карте есть хотя бы одно селение цветочных фей
const NEU_NO_EXTRA = { leshy: 1, pixie: 1, fairy: 1, boar: 1 };
// Потолки логов на карту (отзыв «одни феи и кабаны»; СУЩЕСТВА_БАЛАНС.md): феи и кабаны — не больше ~10–15 % нейтралов,
// грибы — не больше четверти логов; остальное — лешие. С ночами лес пополняют тролли, гоблины, броненосцы, гномтавры (neutrals2.js).
function neuCap(kind, want) {
  if (kind === 'pixie') return 1;
  if (kind === 'fairy') return N_TILES >= 15000 ? 1 : 0;          // поляна лесных фей — только на большой карте
  if (kind === 'boar') return N_TILES >= 15000 ? 2 : 1;
  if (kind === 'spore') return Math.max(1, Math.round(want * 0.25));
  return 99;
}
// какие логова идут в лес по очереди; сверх потолка вид пропускается
const NEU_KIND_BAG = ['leshy', 'spore', 'boar', 'leshy', 'fairy', 'spore', 'leshy', 'boar', 'spore'];
function neuPickKind(rng, n, want) {
  for (let k = 0; k < NEU_KIND_BAG.length; k++) {
    const kind = NEU_KIND_BAG[(n + (rng() * 3 | 0) + k) % NEU_KIND_BAG.length];
    if (Game.lairs.filter(l => l.k === kind).length < neuCap(kind, want)) return kind;
  }
  return 'leshy';
}
const neuWant = () => Math.max(Math.round(5.5 * (N_TILES / 6912) * 1.1), NEU_MIN_PIXIE + 3);

function neuSpawnAll(seed) {
  if (MapOpt.custom && MapOpt.custom.nm !== 'auto') { meSpawnLairs(); return; }   // карта игрока: логова расставил автор
  Game.neutrals = []; Game.lairs = [];
  Game.nstat = { kills: {}, lost: 0, lairs: 0, xp: 0 };
  const rng = mulberry32(((seed | 0) ^ 0xFA17E) >>> 0);
  const cx = MAP_W >> 1, cy = MAP_H >> 1;
  const want = neuWant();
  const minStart = mapIsLegacy() ? 20 : 24;
  const stamp = floodFrom(cx, cy);
  let tries = 0;
  while (Game.lairs.length < want && tries++ < 6000) {
    const pix = Game.lairs.filter(l => l.k === 'pixie').length;
    const needPix = pix < NEU_MIN_PIXIE;
    // цветочные феи — первыми: доброе селение не должно остаться без места; ему можно ближе к деревне
    const site = neuTrySite(rng, stamp, needPix ? minStart - 6 : minStart);
    if (!site) continue;
    const k = needPix ? 'pixie' : neuPickKind(rng, Game.lairs.length, want);
    neuAddLair(k, site, minStart);
  }
  neuEnsurePixies(seed);
}

// Старые сохранения и запасной случай: догнать число селений фей до минимума
function neuEnsurePixies(seed) {
  const have = () => Game.lairs.filter(l => l.k === 'pixie').length;
  if (have() >= NEU_MIN_PIXIE || Game.stress || (MapOpt.custom && MapOpt.custom.nm !== 'auto')) return;
  const rng = mulberry32((((seed | 0) ^ 0x9E3779) + Game.lairs.length * 131) >>> 0);
  const stamp = floodFrom(MAP_W >> 1, MAP_H >> 1), minStart = mapIsLegacy() ? 14 : 18;
  for (let tries = 0; have() < NEU_MIN_PIXIE && tries < 8000; tries++) {
    const site = neuTrySite(rng, stamp, minStart);
    if (site) neuAddLair('pixie', site, minStart);
  }
}

// Старые сохранения и миры кооператива: логова фей, кабанов и грибов сверх потолка заселяют лешие.
// Дружное селение (fd) и селение с заданием (fr) не трогаем; жильцы прежнего вида уходят, логово заселяется заново.
function neuTrimFairies() {
  if (MapOpt.custom && MapOpt.custom.nm !== 'auto') return;
  const want = neuWant();
  for (const kind of ['pixie', 'fairy', 'boar', 'spore']) {
    const extra = Game.lairs.filter(l => l.k === kind && !l.friend && !l.fr).sort((a, b) => a.id - b.id);
    let keep = neuCap(kind, want) - Game.lairs.filter(l => l.k === kind && (l.friend || l.fr)).length;
    for (const L of extra) {
      if (keep-- > 0) continue;
      Game.neutrals = Game.neutrals.filter(N => N.lair !== L.id);
      L.k = 'leshy'; L.alive = 0; L.respawn = Game.time + 30;
    }
  }
}

// ---------- Урон и награда ----------

function neuHurtUnit(u, n) {
  if (!u || u.dead) return;
  if (u.hero) {
    const H = u.hero;
    H.hp = Math.max(-5, H.hp - n);   // ниже нуля: иначе подлечивание в hlTick успевает вернуть героя «в строй» раньше проверки
    if (n >= 1) floater(u.x, u.y - 1.8, '−' + Math.round(n), '#ff8a70');
    return;
  }
  if (u.rec) {
    const R = u.rec, max = 30 + 8 * R.lvl;
    if (R.hp == null) R.hp = max;
    R.hp = Math.max(0, R.hp - n);
    floater(u.x, u.y - 1.8, '−' + Math.round(n), '#ff8a70');
    if (R.hp <= 0 && !(u.downUntil > Game.time)) {
      u.downUntil = Game.time + 8;
      heroStopUnit(u); R.target = null;
      u.proc = (function* () { yield { wait: 4, anim: 'knocked' }; })();
      floater(u.x, u.y - 2, 'Вышел из боя', '#ffd0a0');
    }
    return;
  }
  if (Math.random() < 0.35) injure(u, Math.random() < 0.5 ? 'arm' : 'leg');   // обычный житель просто хромает
}
const neuUnitHp = u => (u.hero ? u.hero.hp : u.rec ? (u.rec.hp == null ? 1 : u.rec.hp) : 1);
const neuUnitOut = u => !u || u.dead || u.inside || (u.hero && u.hero.hp <= 0) || (u.rec && u.rec.hp != null && u.rec.hp <= 0 && u.downUntil > Game.time);

// урон по нейтралу от жителя u
function neuDamageOf(u) {
  if (u.type === 'hero' && u.hero) {
    const s = heroStats(u.hero), w = u.hero.equip && u.hero.equip.weapon, wb = typeof GEAR_BONUS !== 'undefined' && GEAR_BONUS[w];
    return (5 + s.str * 0.55) * (1 + (wb && wb.atk ? wb.atk * 2 : 0));
  }
  if (u.rec) return (5 + u.rec.lvl * 2.2) * (u.rec.armor ? 1.08 : 1);
  return 3;
}
const neuHitChance = (u, N) => Math.min(0.97, 0.5 + 0.5 * unitAtk(u)) * (N.k === 'fairy' ? 0.9 : 1);

function neuProvoke(N, u) {
  const now = Game.time;
  if (NSPEC[N.k].friendly) { const L = Game.lairs.find(l => l.id === N.lair); if (L) { L.fr = 0; L.friend = false; } }
  const first = !(now - N.prov < NEU_FORGET);
  N.prov = now;
  if (u && !neuUnit(N.tg)) N.tg = u.id;
  if (!first || !u) return;
  if (u.hero && typeof track === 'function' && !isServerSim()) track('neu-attack', 'Герой напал на лесных нейтралов');
  let called = 0;
  for (const M of Game.neutrals) {
    if (M === N || !neuAlive(M) || M.tg || Math.hypot(M.x - N.x, M.y - N.y) > NEU_CALL_R) continue;
    M.tg = u.id; M.prov = now; M.cdA = 0.5 + Math.random() * 0.9; called++;
    if (called <= 2) { M.ov = ['roar']; M.ovT = 0; M.ovP = 0.55; }
  }
  N.ov = ['roar']; N.ovT = 0; N.ovP = 0.5;
  const S = NSPEC[N.k];
  floater(N.x, N.y - 2.1, S.msg[(Math.random() * S.msg.length) | 0], '#ffe9a0');
  logEvent('animal', called ? `${S.name} поднял тревогу — «свои» бегут на помощь` : `${S.name} дерётся с ${neuName(u)}`, N.x, N.y);
  sfxAt('thud', N.x * TILE, N.y * TILE, 0.7);
}
function neuName(u) { return u.hero ? u.hero.name : (typeof unitTitle === 'function' ? unitTitle(u) : 'житель'); }

function neuHit(N, u, dmg) {
  if (!neuAlive(N)) return;
  const S = NSPEC[N.k];
  neuProvoke(N, u);
  const px = N.x * TILE, py = N.y * TILE - 12;
  if (Math.random() < S.parry) {
    dmg *= 0.25;
    N.ov = ['parry']; N.ovT = 0; N.ovP = 0.28;
    floater(N.x, N.y - 1.9, 'Отбил!', '#cfe8ff');
    fxBurst(px, py, 5, ['#ffffff', '#cfe8ff'], 40, 20, 0.3, 1.3, 120);
  } else {
    N.ov = ['hurt', 'stagger']; N.ovT = 0; N.ovP = 0.14;
    N.cdA = Math.max(N.cdA, 0.35); N.atkT = 9;
    const d = Math.hypot(N.x - u.x, N.y - u.y) || 1, kx = N.x + (N.x - u.x) / d * 0.3, ky = N.y + (N.y - u.y) / d * 0.3;
    if (S.fly ? inb(Math.floor(kx), Math.floor(ky)) : isWalkable(Math.floor(kx), Math.floor(ky))) { N.x = kx; N.y = ky; }
    fxBurst(px, py, 7, N.k === 'spore' ? ['#b8f070', '#9ad04a'] : N.k === 'fairy' ? ['#fff6b0', '#ffe070'] : ['#c8a070', '#8a6a4a'], 60, 40, 0.5, 1.6, 200);
  }
  N.hp -= dmg;
  floater(N.x, N.y - 1.6, '−' + Math.max(1, Math.round(dmg)), '#ffd070');
  sfxAt('thud', N.x * TILE, N.y * TILE, 0.5);
  if (N.hp <= 0) neuKill(N, u);
}

function neuKill(N, killer) {
  const S = NSPEC[N.k];
  N.st = 'die'; N.dt = 0; N.hp = 0; N.tg = 0; N.ov = null;
  const lair = Game.lairs.find(l => l.id === N.lair);
  if (lair) lair.alive = Math.max(0, (lair.alive || 1) - 1);
  Game.nstat.kills[N.k] = (Game.nstat.kills[N.k] || 0) + 1;
  fxBurst(N.x * TILE, N.y * TILE - 10, 22, N.k === 'fairy' ? ['#fff6b0', '#ffe070', '#bfe8ff'] : N.k === 'spore' ? ['#b8f070', '#8a48b0'] : N.k === 'leshy' ? ['#7ab04a', '#8c6438'] : ['#8a6a4a', '#c8a070'], 80, 60, 1.1, 2, 220);
  sfxAt('wail', N.x * TILE, N.y * TILE, 0.5);
  // добыча
  const tx = Math.floor(N.x), ty = Math.floor(N.y);
  let any = false;
  for (const [g, n0, p] of S.drop) {
    if (Math.random() > p) continue;
    const n = n0 > 1 ? Math.max(1, n0 - (Math.random() < 0.5 ? 1 : 0)) : 1;
    const o = any ? randomFreeNear(tx, ty, 0, 1, (x, y) => isWalkable(x, y)) || [tx, ty] : [tx, ty];
    dropPile(o[0], o[1], g, n); any = true;
  }
  if (!any) dropPile(tx, ty, S.drop[0][0], 1);
  // опыт: герой, рекруты и жители рядом
  const xp = Math.round(S.xp * (N.lv || 1));
  neuGiveXp(N, killer, xp);
  const who = killer ? neuName(killer) : 'Кто-то';
  const p = typeof profCur === 'function' && !isServerSim() ? profCur() : null;
  if (p) { p.st.nkill = (p.st.nkill || 0) + 1; profSave(); }
  logEvent('animal', `${who} победил: ${S.name}`, N.x, N.y);
  if (typeof track === 'function') { track('neu-kill', 'Победил лесного нейтрала'); track('neu-kill-' + N.k, 'Победил: ' + S.name); }
  // последний в логове: зачищено
  if (lair && !lair.alive) {
    lair.respawn = Game.time + NEU_RESPAWN * dif().neuResp;
    Game.nstat.lairs++;
    logEvent('animal', `${NEU_LAIR_NAME[lair.k]} зачищено — ${who} чувствует себя хозяином леса`, lair.x + 0.5, lair.y + 0.5);
    for (const [g, n] of [['gold', 2 + (lair.k === 'leshy' ? 2 : 0)]]) dropPile(Math.floor(N.x), Math.floor(N.y), g, n);
  }
}
const isServerSim = () => typeof coop !== 'undefined';

function neuGiveXp(N, killer, xp) {
  let heroGot = 0, crew = 0;
  for (const u of Game.units) {
    if (u.dead || u.inside) continue;
    const d = Math.hypot(u.x - N.x, u.y - N.y);
    const near = d <= NEU_XP_R;
    if (u.hero) {
      if (!near && u !== killer) continue;
      const k = u === killer ? 1.25 : 1, n = Math.round(xp * k);
      u.hero.cxp = (u.hero.cxp || 0) + n; Game.nstat.xp += n; heroGot = n;
      floater(u.x, u.y - 2.1, '+' + n + ' опыта', '#ffe070');
    } else if (!near) continue;
    else if (u.rec) { const n = Math.round(xp * 0.8 * (u === killer ? 1.25 : 1)); recXp(u, n); floater(u.x, u.y - 2.1, '+' + n, '#ffe8a0'); crew++; }
    else if (isPerson(u) && typeof LEVEL_XP !== 'undefined' && LEVEL_XP[u.type]) { gainXp(u, Math.max(1, Math.round(xp / 8))); crew++; }
  }
  if (heroGot && crew) toast(`Опыт за победу получили и ${crew} рядом стоявших`);
}

// ---------- Поведение ----------

function neuMove(N, tx, ty, spd, dt) {
  const S = NSPEC[N.k], dx = tx - N.x, dy = ty - N.y, d = Math.hypot(dx, dy);
  if (d < 0.05) return true;
  const st = Math.min(d, spd * dt);
  const nx = N.x + dx / d * st, ny = N.y + dy / d * st;
  const ok = (x, y) => (S.fly ? x > 0.5 && y > 0.5 && x < MAP_W - 0.5 && y < MAP_H - 0.5 : isWalkable(Math.floor(x), Math.floor(y)));
  if (ok(nx, ny)) { N.x = nx; N.y = ny; }
  else if (ok(nx, N.y)) N.x = nx;
  else if (ok(N.x, ny)) N.y = ny;
  else { N.stuck = (N.stuck || 0) + dt; if (N.stuck > 0.8) { N.stuck = 0; return true; } return false; }
  if (Math.abs(dx) > 0.05) N.face = dx > 0 ? 1 : -1;
  N.ph += st * 3.6;
  return d - st < 0.08;
}

function neuFrame(N) {
  if (N.st === 'die') { const k = Math.min(5, Math.floor(N.dt / 0.11)); return 'd' + k; }
  if (N.winT > 0) return 'v' + [0, 1, 2, 3, 2, 1][Math.floor((N.winT * 5) % 6)];
  if (N.ov) { const i = Math.floor(N.ovT / (N.ovP || 0.14)); if (i < N.ov.length) return N.ov[i]; N.ov = null; }
  if (N.st === 'atk') {
    const t = N.atkT;
    if (t < 0.24) return 'windup';
    if (t < 0.36) return 'strike';
    if (t < 0.56) return 'recover';
    return 'ready';
  }
  if (N.st === 'chase' || N.st === 'flee') return N.dist < 3.2 && N.st === 'chase' ? (Math.floor(N.ph) % 2 ? 'step' : 'ready') : 'w' + (Math.floor(N.ph) % 8);
  if (N.st === 'roam' || N.st === 'home') return 'w' + (Math.floor(N.ph) % 8);
  if ((N.k === 'pixie' || N.k === 'fairy') && typeof isNightNow === 'function' && isNightNow() && !(Game.time - (N.awake || -99) < 25) && N.st === 'idle') return Math.floor(Game.time * 0.8 + N.id) % 2 ? 'z1' : 'z0';   // ночью феи спят, пока рядом нет нечисти
  return 'i' + (Math.floor(Game.time * 5 + N.id) % 6);
}

function neuStrike(N, tg) {
  const S = NSPEC[N.k];
  let dmg = neuR(S.dmg[0], S.dmg[1]) * (1 + ((N.lv || 1) - 1) * 0.5);
  const dodge = tg.hero ? 0.1 + heroStats(tg.hero).agi * 0.004 : 0.12;
  if (Math.random() < dodge) { floater(tg.x, tg.y - 1.8, 'Увернулся!', '#cfe8ff'); return; }
  const def = tg.hero && typeof heroDef === 'function' ? heroDef(tg) : tg.rec && tg.rec.armor ? 0.3 : 0;
  dmg *= (1 - Math.min(0.6, def)) * dif().neuDmg;
  const px = tg.x * TILE, py = tg.y * TILE - 12;
  fxBurst(px, py, N.k === 'fairy' ? 8 : 6, N.k === 'fairy' ? ['#fff6b0', '#ffe070', '#ff9ad8'] : N.k === 'spore' ? ['#b8f070', '#9ad04a'] : ['#ffffff', '#ffd0a0'], 55, 40, 0.5, 1.5, 160);
  sfxAt(N.k === 'fairy' ? 'chime' : 'thud', tg.x * TILE, tg.y * TILE, 0.55);
  if (N.k === 'spore' && Math.random() < 0.3 && !tg.hero) injure(tg, Math.random() < 0.5 ? 'arm' : 'leg');
  neuHurtUnit(tg, dmg);
  tg.ouchUntil = Game.time + 0.5;
  if (tg.hero && tg.hero.hp <= 0) neuHeroDown(N, tg);
}

function neuHeroDown(N, tg) {
  if (tg._lostT > Game.time - 6) return;
  tg._lostT = Game.time;
  const name = tg.hero ? tg.hero.name : neuName(tg);
  logEvent('animal', `${name} проиграл бой: ${NSPEC[N.k].name}`, N.x, N.y);
  Game.nstat.lost++;
  if (typeof track === 'function' && !isServerSim() && tg.hero) track('neu-lose', 'Герой проиграл бой лесному жителю');
  for (const M of Game.neutrals) if (neuAlive(M) && M.tg === tg.id) { M.tg = 0; M.prov = -99; M.winT = 3.2; M.ov = null; M.st = 'idle'; M.ovT = 0; }
  floater(N.x, N.y - 2.1, ['Так-то!', 'Не лезь в лес!', 'Слабак!'][(Math.random() * 3) | 0], '#ffe9a0');
}

const tg0 = N => neuUnit(N.tg);
function neuThink(N, dt) {
  const S = NSPEC[N.k], now = Game.time;
  if (N.st === 'die') { N.dt += dt; N.fr = neuFrame(N); return; }
  if (N.ov) N.ovT += dt;
  if (N.winT > 0) { N.winT -= dt; N.fr = neuFrame(N); if (N.winT <= 0) { N.winT = 0; N.st = 'idle'; } return; }
  N.cdA -= dt;
  let tg = neuUnit(N.tg);
  if (N.k === 'pixie' && !tg0(N) && now - N.prov > NEU_FORGET) neuPixieMagic(N, dt);
  if (tg && (neuUnitOut(tg) || now - N.prov > NEU_FORGET || Math.hypot(tg.x - N.hx, tg.y - N.hy) > NEU_LEASH + 4 || Math.hypot(N.x - N.hx, N.y - N.hy) > NEU_LEASH)) {
    if (tg && neuUnitOut(tg) && tg.hero && tg.hero.hp <= 0) neuHeroDown(N, tg);
    N.tg = 0; tg = null; N.st = 'home';
  }
  if (tg) {
    N.dist = Math.hypot(tg.x - N.x, tg.y - N.y);
    if (N.st === 'atk' && N.atkT < 0.56) {
      // замах и удар: урон — на кадре «удар»
      N.atkT += dt;
      N.face = tg.x >= N.x ? 1 : -1;
      if (!N.hit && N.atkT >= 0.24) { N.hit = 1; if (N.dist <= S.rng + 0.8) neuStrike(N, tg); }
    } else {
      const low = N.k === 'fairy' && N.hp < N.mhp * 0.3;
      if (low && N.dist < 5) {                       // фея ранена — удирает по воздуху, потом вернётся
        N.st = 'flee';
        const a = Math.atan2(N.y - tg.y, N.x - tg.x);
        neuMove(N, N.x + Math.cos(a) * 3, N.y + Math.sin(a) * 3, S.spd * 1.1, dt);
        N.hp = Math.min(N.mhp, N.hp + dt * 1.5);
      } else if (N.dist > S.rng) {
        N.st = 'chase';
        neuMove(N, tg.x, tg.y, S.spd, dt);
      } else {
        N.face = tg.x >= N.x ? 1 : -1;
        if (N.cdA <= 0) { N.st = 'atk'; N.atkT = 0; N.hit = 0; N.cdA = S.cd * neuR(0.9, 1.2); }
        else if (N.st === 'atk') { N.st = 'chase'; N.atkT = 9; }
      }
    }
  } else if (N.st === 'atk') { N.st = 'idle'; N.atkT = 9; }
  else {
    // спокойная жизнь у логова
    if (N.hp < N.mhp) N.hp = Math.min(N.mhp, N.hp + dt * 2.2);
    const home = Math.hypot(N.x - N.hx, N.y - N.hy);
    if (N.st === 'home' || home > S.roam + 1.5) {
      N.st = 'home';
      if (neuMove(N, N.hx + neuR(-1, 1), N.hy + neuR(-0.6, 0.6), S.spd * 0.8, dt) || home < 1.4) { N.st = 'idle'; N.t = 1 + Math.random() * 3; }
    } else if (N.st === 'roam') {
      if (neuMove(N, N.wx, N.wy, S.spd * 0.45, dt)) { N.st = 'idle'; N.t = 2 + Math.random() * 5; }
    } else {
      N.st = 'idle';
      N.t -= dt;
      if (N.t <= 0) {
        const a = Math.random() * 6.283, r = 0.8 + Math.random() * S.roam;
        N.wx = N.hx + Math.cos(a) * r; N.wy = N.hy + Math.sin(a) * r * 0.75; N.st = 'roam';
        if (!S.fly && !isWalkable(Math.floor(N.wx), Math.floor(N.wy))) { N.st = 'idle'; N.t = 1; }
      }
    }
  }
  N.fr = neuFrame(N);
}

function neuTick(dt) {
  if (!Game.neutrals) return;
  const list = Game.neutrals;
  for (let i = list.length - 1; i >= 0; i--) {
    const N = list[i];
    neuThink(N, dt);
    if (N.st === 'die' && N.dt > 3.4) list.splice(i, 1);
  }
  // рекруты после боя приходят в себя
  Game.nT = (Game.nT || 0) + dt;
  if (Game.nT < 1) return;
  Game.nT = 0;
  for (const u of Game.units) if (u.rec && u.rec.hp != null) { const max = 30 + 8 * u.rec.lvl; if (u.rec.hp < max) u.rec.hp = Math.min(max, u.rec.hp + 1.1); else u.rec.hp = undefined; }
  if (startOpen('neutrals')) for (const L of Game.lairs) if (L.k === 'pixie') neuWatchGrove(L);
  for (const L of Game.lairs) {
    if (L.respawn && Game.time >= L.respawn && !Game.units.some(u => !u.dead && Math.hypot(u.x - L.x, u.y - L.y) < 9)) {
      neuFillLair(L);
      logEvent('animal', `${NEU_LAIR_NAME[L.k]}: в логове снова завелись жильцы`, L.x + 0.5, L.y + 0.5);
    }
  }
}

// ---------- Подключение к «врагам» гильдий и к приказам героя ----------

{
  const NF = f => f.kind === 'neu';
  const _alive = foeAlive;
  foeAlive = function (f) { return NF(f) ? neuAlive(f.o) && Game.neutrals.includes(f.o) : _alive(f); };
  const _near = foesNear;
  foesNear = function (x, y, r) {
    const out = _near(x, y, r);
    // тронутые нейтралы — обычные враги для рекрутов; нетронутых выбирают только прицельным кликом (r ≤ 1,45)
    for (const N of Game.neutrals) {
      if (!neuAlive(N)) continue;
      if (!(r <= 1.45 || Game.time - N.prov < NEU_FORGET)) continue;
      if (Math.hypot(N.x - x, N.y - y) < r + (r <= 1.45 ? 0.5 : 0)) out.push({ kind: 'neu', o: N });
    }
    out.sort((p, q) => Math.hypot(p.o.x - x, p.o.y - y) - Math.hypot(q.o.x - x, q.o.y - y));
    return out;
  };
  const _kill = killFoe;
  killFoe = function (f, u) { if (NF(f)) neuHit(f.o, u, f.o.hp + 1); else _kill(f, u); };
  const _strike = strike;
  strike = function (u, f) {
    if (!NF(f)) return _strike(u, f);
    const N = f.o;
    if (!neuAlive(N)) return;
    if (Math.random() > neuHitChance(u, N)) {
      floater(N.x, N.y - 1.7, 'Мимо!', '#e8e0c0');
      neuProvoke(N, u);
      return;
    }
    let dmg = neuDamageOf(u) * neuR(0.8, 1.25);
    const cls = unitCls(u);
    if (cls === 'rogue' && Math.random() < 0.25) { dmg *= 2; floater(N.x, N.y - 2, 'Крит!', '#e0b0ff'); }
    neuHit(N, u, dmg);
  };
  const _run = runCmd;
  runCmd = function* (u, c) { if (c.kind === 'gift') yield* neuGiftGen(u, c); else yield* _run(u, c); };
  const _fight = fightGen;
  fightGen = function* (u, f) {
    if (!NF(f)) { yield* _fight(u, f); return; }
    const cls = unitCls(u), C = cls && GCLS[cls], range = unitRange(u);
    neuProvoke(f.o, u);
    for (let round = 0; round < 90 && !neuUnitOut(u); round++) {
      if (!foeAlive(f)) {       // добил — сразу берётся за следующего, кто на него напал
        const nx = foesNear(u.x, u.y, 7).find(x => x.kind === 'neu' && x.o.tg === u.id);
        if (!nx) break;
        f = nx;
      }
      const o = f.o, d = Math.hypot(o.x - u.x, o.y - u.y);
      if (d > range + 0.3) {
        const keep = C && C.shot ? range * 0.7 : 0.9;
        let tx = Math.floor(o.x + (u.x - o.x) / d * keep), ty = Math.floor(o.y + (u.y - o.y) / d * keep);
        if (!isWalkable(tx, ty)) { const s = randomFreeNear(tx, ty, 0, 2, (x, y) => isWalkable(x, y)); if (!s) return; [tx, ty] = s; }
        const ok = yield { walk: [tx, ty], offroad: true };
        if (!ok) return;
        continue;
      }
      u.face = o.x > u.x ? 1 : -1; u.vdir = 'E';
      yield { wait: 0.55, anim: C && C.shot ? 'build' : 'chop' };
      if (!foeAlive(f) || neuUnitOut(u)) break;
      if (C && C.shot) {
        const sh = { kind: C.shot, x: u.x, y: u.y - 0.7, f, u, t: 0, dur: Math.max(0.25, d / (C.shot === 'arrow' ? 14 : 8)) };
        G.shots.push(sh);
        sfxAt(C.shot === 'arrow' ? 'thud' : 'chime', u.x * TILE, u.y * TILE, 0.6);
        yield { wait: sh.dur + 0.1 };
      } else strike(u, f);
      yield { wait: 0.4 };
    }
  };
  // нетронутое нейтральное существо под курсором — приказ «Напасть»; поражённый герой приказов не слушает
  const _rc = resolveCmd;
  resolveCmd = function (t) {
    if (inb(t[0], t[1])) {
      const f = foesNear(t[0] + 0.5, t[1] + 0.5, 1.4).find(x => x.kind === 'neu');
      // дружелюбных фей по клику одаривают; напасть на них — с зажатым Shift
      if (f && NSPEC[f.o.k].friendly && !(Game.time - f.o.prov < NEU_FORGET) && !(typeof event !== 'undefined' && event && event.shiftKey))
        return { kind: 'gift', f, tx: Math.floor(f.o.x), ty: Math.floor(f.o.y), label: 'Одарить: ' + NSPEC[f.o.k].name + ' (Shift — напасть)' };
      if (f) return { kind: 'attack', f, tx: Math.floor(f.o.x), ty: Math.floor(f.o.y), label: 'Напасть на: ' + NSPEC[f.o.k].name };
    }
    return _rc(t);
  };
  // опыт боёв повышает уровень героя вместе с городом
  const _ts = heroTownScore;
  heroTownScore = function () {
    const h = Game.hero;
    return _ts() + (h && h.hero && h.hero.cxp ? h.hero.cxp / 10 : 0);
  };
  const _reset = resetGameState;
  resetGameState = function () { _reset(); Game.neutrals = []; Game.lairs = []; Game.nstat = { kills: {}, lost: 0, lairs: 0, xp: 0 }; };
  const _setup = setupStart;
  setupStart = function (seed, ...o) { _setup(seed, ...o); if (!Game.stress) neuSpawnAll(seed); };
  const _ser = serializeGame;
  serializeGame = function () {
    const s = _ser();
    s.nt = {
      st: Game.nstat,
      lairs: Game.lairs.map(l => ({ id: l.id, k: l.k, x: l.x, y: l.y, lv: l.lv, fr: l.fr || 0, fd: l.friend ? 1 : 0, rs: l.respawn ? Math.round(l.respawn - Game.time) : 0 })),
      mem: Game.neutrals.filter(N => N.st !== 'die').map(N => ({ id: N.id, k: N.k, lair: N.lair, x: +N.x.toFixed(2), y: +N.y.toFixed(2), hp: Math.round(N.hp), lv: N.lv })),
    };
    return s;
  };
  const _apply = applySave;
  applySave = function (s) {
    _apply(s);
    Game.neutrals = []; Game.lairs = [];
    if (!s.nt) { if (!Game.stress && !isMirror()) neuSpawnAll(s.seed); return; }
    Game.nstat = Object.assign({ kills: {}, lost: 0, lairs: 0, xp: 0 }, s.nt.st);
    for (const l of s.nt.lairs) Game.lairs.push({ id: l.id, k: l.k, x: l.x, y: l.y, lv: l.lv || 1, respawn: l.rs ? Game.time + l.rs : 0, alive: 0, fr: l.fr || 0, friend: !!l.fd });
    for (const m of s.nt.mem) {
      const lair = Game.lairs.find(l => l.id === m.lair);
      if (!lair) continue;
      const N = neuMake(m.k, lair, 0);
      N.id = m.id; N.x = m.x; N.y = m.y; N.lv = m.lv || 1; N.mhp = Math.round(NSPEC[m.k].mhp * N.lv); N.hp = Math.min(N.mhp, m.hp || N.mhp);
      Game.neutrals.push(N); lair.alive++;
    }
    for (const l of Game.lairs) if (!l.alive && !l.respawn) l.respawn = Game.time + 30;
    if (!isMirror()) { neuTrimFairies(); neuEnsurePixies(s.seed); }
  };
  const _step = step;
  step = function (dt) { _step(dt); if (!isMirror()) neuTick(dt); };
}

// ---------- Рисование ----------

{
  const _ds = drawSkeletons;
  drawSkeletons = function (list, c, x0, y0, x1, y1) {
    _ds(list, c, x0, y0, x1, y1);
    neuDrawList(list, c, x0, y0, x1, y1);
  };
}

function neuDrawList(list, c, x0, y0, x1, y1) {
  for (const L of Game.lairs || []) {
    if (L.x < x0 - 3 || L.x > x1 + 3 || L.y < y0 - 3 || L.y > y1 + 4) continue;
    list.push([L.y + 0.12, () => neuDrawLair(c, L)]);
  }
  for (const N of Game.neutrals || []) {
    if (N.x < x0 - 3 || N.x > x1 + 3 || N.y < y0 - 3 || N.y > y1 + 4) continue;
    list.push([N.y + 0.2, () => neuDraw(c, N)]);
  }
}

function neuDrawLair(c, L) {
  const t = Game.time, live = Game.neutrals.some(N => N.lair === L.id && N.st !== 'die');
  const s = naLairSprite(L.k, live ? String(Math.floor(t * 1.8 + L.id) % 2) : 'd');
  const px = Math.round(L.x * TILE + 16), py = Math.round(L.y * TILE + 22);
  c.drawImage(s.cv, px - s.ax, py - s.ay);
  if (live && (L.k === 'fairy' || L.k === 'spore' || L.k === 'pixie')) {
    // плавающие огоньки над логовом (сверх запечённых в кадры)
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 5; k++) {
      const ph = t * (0.5 + k * 0.09) + k * 1.7, a = k * 1.25 + t * 0.15;
      const x = px + Math.cos(a) * 22, y = py - 6 - ((ph % 3) / 3) * 26 + Math.sin(a) * 4, al = Math.sin((ph % 3) / 3 * Math.PI);
      c.fillStyle = L.k === 'spore' ? `rgba(170,240,110,${0.8 * al})` : L.k === 'pixie' ? `rgba(255,190,230,${0.9 * al})` : `rgba(255,240,150,${0.9 * al})`;
      c.fillRect(Math.round(x), Math.round(y), 1.5, 1.5);
    }
    c.restore();
  }
}

function neuDraw(c, N) {
  const S = NSPEC[N.k], sp = naFrame(N.k, N.fr || 'i0'), t = Game.time;
  const px = Math.round(N.x * TILE), py = Math.round(N.y * TILE + 6);
  const dead = N.st === 'die';
  const al = dead ? Math.max(0, Math.min(1, 1 - (N.dt - 0.9) / 2.3)) : 1;
  if (al <= 0) return;
  c.save();
  c.globalAlpha = al;
  c.fillStyle = 'rgba(10,8,4,0.3)';
  c.beginPath(); c.ellipse(px, py + 1, S.sz * (dead ? 1.1 : 0.8), S.sz * 0.28, 0, 0, 7); c.fill();
  const bob = N.k === 'fairy' && !dead ? Math.round(Math.sin(t * 3.2 + N.id) * 1.3) : 0;
  c.translate(px, py + bob);
  if (N.face < 0) c.scale(-1, 1);
  if (sp.hi) { c.imageSmoothingEnabled = false; c.drawImage(sp.cv, -sp.ax, -sp.ay, sp.w, sp.h); }   // 3× пиксельный кадр (pxbeasts.js)
  else c.drawImage(sp.cv, -sp.ax, -sp.ay);
  c.restore();
  if (!dead && N.hp < N.mhp - 0.5) {
    const w = 18, hy = py - (N.k === 'leshy' ? 64 : (N.k === 'fairy' || N.k === 'pixie') ? 46 : N.k === 'boar' ? 38 : 40), r = Math.max(0, N.hp / N.mhp);
    c.fillStyle = 'rgba(10,6,2,0.85)'; c.fillRect(px - w / 2 - 1, hy - 1, w + 2, 4);
    c.fillStyle = r > 0.5 ? '#5ac04a' : r > 0.25 ? '#e0b030' : '#e04a3a'; c.fillRect(px - w / 2, hy, Math.round(w * r), 2);
  }
}

// Зеркало для кооператива: только то, что нужно для рисования (id — общий с сервером)
function neuMirror() {
  const r = v => Math.round(v * 100) / 100;
  return Game.neutrals.map(N => ({ __id: N.id, id: N.id, k: N.k, x: r(N.x), y: r(N.y), face: N.face, st: N.st, fr: N.fr, hp: Math.round(N.hp), mhp: N.mhp, dt: r(N.dt), lv: N.lv }));
}
function neuMirrorLairs() { return Game.lairs.map(L => ({ __id: L.id, id: L.id, k: L.k, x: L.x, y: L.y })); }

// Строка в карточке героя: победы над лесными жителями и опыт боёв
function neuPanelRow() {
  const h = Game.hero, H = h && h.hero, st = Game.nstat;
  const kills = st && st.kills ? Object.values(st.kills).reduce((a, b) => a + b, 0) : 0;
  if (!H || (!H.cxp && !kills && !(st && st.lost))) return '';
  return `<div class="irow small muted" title="Победы над лесными жителями дают опыт: он повышает уровень героя вместе с ростом города">Лесные бои: побед ${kills} · опыт ${H.cxp || 0}${st.lost ? ' · поражений ' + st.lost : ''}</div>`;
}

// Логова на миникарте: янтарные точки; зачищенное — серое
{
  const _dm = drawMinimapUnits;
  drawMinimapUnits = function () {
    _dm();
    const c = MINI.ctx, cv = MINI.canvas, kx = cv.width / MAP_W, ky = cv.height / MAP_H, fac = cv.width / Math.max(60, cv.clientWidth);
    const s = Math.max(2.4, 3 * fac);
    for (const L of Game.lairs || []) {
      const live = Game.neutrals.some(N => N.lair === L.id && N.st !== 'die');
      const px = (L.x + 0.5) * kx - s / 2, py = (L.y + 0.5) * ky - s / 2;
      c.fillStyle = 'rgba(8,6,4,0.85)'; c.fillRect(px - 0.8, py - 0.8, s + 1.6, s + 1.6);
      c.fillStyle = live ? '#f0b030' : '#8a8478'; c.fillRect(px, py, s, s);
    }
  };
}

// Ачивки (profile.js грузится позже — вписываем их после загрузки страницы)
function neuAchInit() {
  if (typeof ACHS === 'undefined' || typeof ACH_BY === 'undefined' || ACH_BY.nfairy) return;
  const add = [
    { id: 'nfairy',  name: 'Пыльца в качестве компенсации', desc: 'Побеждена лесная фея. Крылышки — не броня, а комариный аргумент.', ev: /победил: Лесная фея/ },
    { id: 'nboar',   name: 'Свинина по-лесному', desc: 'Побеждён кабан-страж. Охрана леса уволена без выходного пособия.', ev: /победил: Кабан-страж/ },
    { id: 'nspore',  name: 'Грибной сезон открыт', desc: 'Побеждён чумной моховик. Остальные грибы сделали вид, что их тут не было.', ev: /победил: Чумной моховик/ },
    { id: 'nleshy',  name: 'Лес остался без хозяина', desc: 'Побеждён леший. Мох ещё долго будет припоминать это в суде.', ev: /победил: Леший/ },
    { id: 'nlair',   name: 'Выселен за неуплату', desc: 'Зачищено лесное логово. Жильцы вернутся… минут через восемь, как обычно.', ev: /зачищено —/ },
    { id: 'nwar',    name: 'Кто разбудил лес?', desc: 'Лесной житель позвал своих на помощь. Драка вышла командная, повестки разослали всем.', ev: /поднял тревогу/ },
    { id: 'nlose',   name: 'Фея — не подарок', desc: 'Герой проиграл бой лесному жителю. Утешает одно: хроника об этом, к сожалению, всё помнит.', ev: /проиграл бой: /, secret: true },
    { id: 'npix',     name: 'Друг лесных малышей', desc: 'Герой подружился с цветочными феями. Хлеб отдал, зато репутация осталась.', ev: /подружился с цветочными феями/ },
    { id: 'npixmap',  name: 'Карта сокровищ от доброй феи', desc: 'Феи показали клад. Объяснять, где именно, они, как всегда, не стали — просто махнули крылышком.', ev: /показали клад/ },
    { id: 'npixmad',  name: 'Не рубите рощу, звери', desc: 'Цветочные феи вышли из себя из-за вырубки. Милые существа, но память у них — как у налоговой.', ev: /феи в ярости/ },
    { id: 'nkill25', name: 'Лесной санитар', desc: 'Двадцать пять побед над лесными жителями. Экологи в ужасе, лесорубы в восторге.', st: 'nkill', need: 25 },
  ];
  for (const a of add) { ACHS.push(a); ACH_BY[a.id] = a; }
}
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('DOMContentLoaded', neuAchInit);

// ---------- Цветочные феи: дружба, дары, обида ----------

// чем можно задобрить: вес дружбы (50 — «друг»)
const NEU_GIFT = { bread: 15, sausage: 15, chickenleg: 15, steak: 18, croissant: 18, hops: 10, magicstone: 35, goldore: 35, ironore: 25, gold: 40, mana: 30 };

function neuGiftGen(u, c) {
  return (function* () {
    const N = c.f.o, L = Game.lairs.find(l => l.id === N.lair);
    if (!neuAlive(N) || !L) return;
    if (!u.hero) { floater(N.x, N.y - 1.8, 'Мы только с героями дружим', '#ffe9a0'); return; }
    const H = u.hero;
    for (let k = 0; k < 8 && Math.hypot(N.x - u.x, N.y - u.y) > 1.6; k++) {
      const ok = yield { walk: [Math.floor(N.x), Math.floor(N.y)], offroad: true };
      if (!ok || !neuAlive(N)) return;
    }
    u.face = N.x > u.x ? 1 : -1; u.vdir = 'E';
    const slot = H.inv ? H.inv.findIndex(s => s && NEU_GIFT[s.k]) : -1;
    if (slot < 0) {
      floater(N.x, N.y - 1.9, 'С пустыми руками?', '#ffe9a0');
      toast('Цветочным феям нравятся еда, золото, руда и магические камни: положите дар в рюкзак (хлеб из трактира, руда со склада). Shift + клик — напасть');
      return;
    }
    yield { wait: 0.8, anim: 'build' };
    if (!neuAlive(N) || !H.inv[slot]) return;
    const s = H.inv[slot], k = s.k;
    s.n--; if (s.n <= 0) H.inv[slot] = null;
    L.fr = Math.min(100, (L.fr || 0) + NEU_GIFT[k]);
    N.ov = ['roar']; N.ovT = 0; N.ovP = 0.6; N.winT = 2;
    fxBurst(N.x * TILE, N.y * TILE - 14, 14, ['#ffb0e0', '#fff6b0', '#c8a0ff'], 60, 60, 0.9, 1.6, -30);
    sfxAt('chime', N.x * TILE, N.y * TILE, 0.7);
    if (L.fr < 50) { floater(N.x, N.y - 2, `Спасибо! (дружба ${L.fr}/50)`, '#ffb0e0'); return; }
    if (!L.friend) { L.friend = true; logEvent('animal', `${H.name} подружился с цветочными феями`, N.x, N.y); }
    neuPixieReward(u, L);
  })();
}

function neuPixieReward(u, L) {
  const H = u.hero, kind = (L.rw = (L.rw || 0) + 1) % 3;
  const mate = Game.units.filter(x => x.teamOf === u.id);
  if (kind === 1) {                     // исцеление
    H.hp = H.maxhp; u.injury = null; for (const m of mate) m.injury = null;
    floater(u.x, u.y - 2.1, 'Феи исцелили!', '#9af0a0');
    logEvent('animal', `Цветочные феи исцелили героя ${H.name}`, u.x, u.y);
  } else if (kind === 2) {              // благословение: бодрее
    for (const x of [u, ...mate]) x.boostUntil = Game.time + 90;
    u.dashUntil = Game.time + 40;
    floater(u.x, u.y - 2.1, 'Благословение лесных фей!', '#ffe070');
    logEvent('animal', `Цветочные феи благословили героя ${H.name}: бодрее на полторы минуты`, u.x, u.y);
  } else {                              // клад
    const a = Math.random() * 6.283, r = 7 + Math.random() * 5;
    const sp = randomFreeNear(Math.floor(L.x + Math.cos(a) * r), Math.floor(L.y + Math.sin(a) * r), 0, 3, (x, y) => isWalkable(x, y));
    if (sp) {
      dropPile(sp[0], sp[1], 'gold', 3 + (Math.random() * 3 | 0)); dropPile(sp[0], sp[1], 'magicstone', 1);
      fxBurst((sp[0] + 0.5) * TILE, (sp[1] + 0.5) * TILE - 10, 24, ['#ffe070', '#fff6b0'], 70, 90, 1.6, 2, -20);
      floater(sp[0] + 0.5, sp[1] - 0.5, 'Клад!', '#ffe070');
      logEvent('animal', `Цветочные феи показали клад — ${H.name} спешит за золотом`, sp[0] + 0.5, sp[1] + 0.5);
    } else { H.hp = H.maxhp; floater(u.x, u.y - 2.1, 'Феи исцелили!', '#9af0a0'); }
  }
  if (typeof updateUI === 'function') updateUI(true);
}

// рубку рощи феи не прощают: деревьев рядом с домиком стало меньше — нападают на ближайшего жителя
function neuWatchGrove(L) {
  let n = 0;
  for (let y = L.y - 5; y <= L.y + 5; y++) for (let x = L.x - 5; x <= L.x + 5; x++) {
    if (!inb(x, y)) continue;
    const o = World.obj[idx(x, y)];
    if (o && o.t === 'tree') n++;
  }
  if (L.trees === undefined || n > L.trees) { L.trees = n; return; }
  if (n === L.trees) return;
  L.trees = n;
  const mem = Game.neutrals.filter(N => N.lair === L.id && neuAlive(N));
  if (!mem.length || Game.time - (L.angry || -999) < 120) return;
  let best = null, bd = 16;
  for (const u of Game.units) {
    if (u.dead || u.inside || !isPerson(u)) continue;
    const d = Math.hypot(u.x - L.x, u.y - L.y);
    if (d < bd) { bd = d; best = u; }
  }
  if (!best) return;
  L.angry = Game.time; L.fr = 0; L.friend = false;
  logEvent('animal', 'Цветочные феи в ярости: в их роще рубят деревья', L.x + 0.5, L.y + 0.5);
  neuProvoke(mem[0], best);
}

// ---------- Заклинания цветочных фей: 5 добрых для гномов и 5 недобрых для нечисти ----------
// Каждые 8–14 с фея (если её не тронули) смотрит вокруг в радиусе NEU_SPELL_R клеток. Нечисть гонит всегда;
// гномов привечает только тогда, когда её логово «подружилось» (дары героя, L.friend).
const NEU_SPELL_R = 9;
const NEU_SPELLS_GOOD = [
  { id: 'heal',  name: 'Исцеление',        col: ['#9af0a0', '#d8ffd8'], need: u => !!u.injury, fn: u => { u.injury = null; if (u.hero) u.hero.hp = Math.min(u.hero.maxhp, u.hero.hp + u.hero.maxhp * 0.15); } },
  { id: 'vigor', name: 'Бодрость',         col: ['#ffe070', '#fff6c0'], need: u => !(u.boostUntil > Game.time + 5), fn: u => { u.boostUntil = Game.time + 40; } },
  { id: 'feed',  name: 'Сытость',          col: ['#ffd090', '#ffeccc'], need: u => u.food < 0.55, fn: u => { u.food = Math.min(1.3, u.food + 0.4); } },
  { id: 'ward',  name: 'Оберег от призраков', col: ['#bfe8ff', '#ffffff'], need: u => !(u.ghostCD > Game.time + 10), fn: u => { u.ghostCD = Game.time + 60; } },
  { id: 'calm',  name: 'Покой',            col: ['#c8a0ff', '#f0e0ff'], need: u => u.fleeUntil > Game.time || u.panicUntil > Game.time, fn: u => { u.fleeUntil = 0; u.panicUntil = 0; } },
];
const neuFairyHome = N => Math.hypot(N.x - N.hx, N.y - N.hy) < 8;

function neuPixieMagic(N, dt) {
  N.spT = (N.spT === undefined ? 3 + Math.random() * 6 : N.spT) - dt;
  if (N.spT > 0 || N.st === 'atk' || N.ov) return;
  N.spT = 8 + Math.random() * 6;
  const L = Game.lairs.find(l => l.id === N.lair), R = NEU_SPELL_R, near = (o, r = R) => Math.hypot(o.x - N.x, o.y - N.y) < r;
  // 1) нечисть: пять заклинаний — по виду цели
  const cast = (name, col, x, y, dark) => {
    if (dark) col = ['#c060ff', '#8a2ad0', '#ff4a8a'];
    N.ov = dark ? NA_FRAMES.curse : NA_FRAMES.cast; N.ovT = 0; N.ovP = 0.13; N.face = x >= N.x ? 1 : -1; N.awake = Game.time;
    fxBurst(x * TILE, y * TILE - 10, 18, col, 70, 70, 0.9, 1.8, -20);
    sfxAt('chime', x * TILE, y * TILE, 0.6);
    floater(x, y - 1.9, name, col[0]);
  };
  const g = (Game.ghosts || []).find(o => !o.exo && o.alpha > 0.25 && o.mode !== 'leave' && near(o));
  if (g) {
    cast('Свет фей!', ['#fff6c0', '#bfe8ff', '#ffe070'], g.x, g.y, true);
    g.exo = Game.time; g.mode = 'leave'; g.modeT = 99;
    logEvent('night', 'Цветочные феи прогнали призрака светом', g.x, g.y);
    return;
  }
  const sk = (Game.skels || []).find(o => o.state === 'roam' && o.k > 0.5 && near(o));
  if (sk) {
    cast('Рассыпься!', ['#e6dfc8', '#c8ffb0', '#fff6b0'], sk.x, sk.y, true);
    sk.state = 'dead'; sk.t = 0; sk.moving = false; sk.resolved = true;
    sfxAt('rattle', sk.x * TILE, sk.y * TILE, 1.0);
    logEvent('night', 'Цветочные феи рассыпали скелета в кости', sk.x, sk.y);
    return;
  }
  const en = (Game.ents || []).find(o => o.state === 'walk' && near(o));
  if (en) {
    cast('Усни, дерево…', ['#9af0a0', '#d4ffb8', '#7ab04a'], en.x, en.y, true);
    en.state = 'root'; en.t = 0; en.alpha = 1;
    logEvent('night', 'Цветочные феи усыпили ходячее дерево', en.x, en.y);
    return;
  }
  const bt = (Game.bats || []).find(o => !o.leave && near(o, R + 4));
  if (bt) {
    cast('Звон крыльев!', ['#d8f6ff', '#ffffff', '#c8a0ff'], bt.x, bt.y, true);
    bt.leave = true;
    return;
  }
  // «блуждающие огни»: любую другую нечисть (в т.ч. бродящих рядом с деревней) уводят прочь на пару клеток
  const stray = [...(Game.skels || []).filter(o => o.state === 'roam'), ...(Game.ents || []).filter(o => o.state === 'walk' || o.state === 'emerge')].find(o => near(o, R + 3));
  if (stray) {
    cast('Блуждающие огни!', ['#bfe8ff', '#ffe070', '#c8ffb0'], stray.x, stray.y, true);
    const a = Math.atan2(stray.y - N.y, stray.x - N.x), nx = stray.x + Math.cos(a) * 4, ny = stray.y + Math.sin(a) * 4;
    if (isWalkable(Math.floor(nx), Math.floor(ny))) { stray.x = nx; stray.y = ny; }
    return;
  }
  // 2) гномам: только друзья
  if (!L || !L.friend) return;
  const pool = Game.units.filter(u => !u.dead && !u.inside && isPerson(u) && near(u));
  for (const u of pool.sort(() => Math.random() - 0.5)) {
    const sp = NEU_SPELLS_GOOD.filter(s => s.need(u));
    if (!sp.length) continue;
    const s = sp[(Math.random() * sp.length) | 0];
    s.fn(u);
    cast(s.name, s.col, u.x, u.y);
    return;
  }
}
