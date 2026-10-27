'use strict';
// Тёмные сказочные существа. Живут по ночам рядом с нечистью (night.js, ghosts.js, graveyard.js) и на её же правилах:
//  • КИКИМОРА — сидит в камышах у воды; хватает гнома с берега и тащит в тину, груз оставляет себе. Откуп — еда на кочке;
//  • ЛЕШИЙ — хозяин леса. Если за сутки срублено много деревьев, насылает «блуждания» на дровосеков (ходят кругами).
//    Хлеб на пне его смягчает;
//  • ВОДЯНОЙ и РУСАЛКА — в озере: водяной тащит груз с берега, русалка поёт и заманивает гномов к воде. Пиво в воду — утихают;
//  • БАНШИ — воет у кладбища и перед бедой гнома (журнал, мигание значка), пугает работников рядом;
//  • БЛУЖДАЮЩИЕ ОГОНЬКИ — три болотных огонька у воды уводят гнома без фонаря в тину;
//  • ПОЛУДНИЦА — в зной кружит голову крестьянину в поле; пиво её прогоняет;
//  • ПРИЗРАЧНЫЙ ВОЛК — ходит за ночной нечистью, воет, отнимает у гномов фонари. Костёр и герой его отгоняют.
// Существа не сохраняются (как призраки): с вечера заводятся заново. В сохранение идёт счётчик срубленного и гнев лешего (поле f2),
// итоги — в Game.faunaStat. Звуков нет — только floater-тексты.

const FZ_PAL = {
  k: '#10141a', e: '#f0f26a', E: '#c8ff6a', t: '#ece8d0',
  L: '#5a4630', l: '#8a7050', w: '#b09a70', M: '#3e6a2a', m: '#68a040',
  g: '#6a8a5a', G: '#4a6a40', h: '#2e4a2c', H: '#4a7a44', r: '#5a4632', R: '#3c2e20', u: '#3e3424',
  S: '#4a8a7c', s: '#2e6a5c', b: '#8ad0b0', a: '#2c6a3a', A: '#4a9a50',
  z: '#c8843a', Z: '#8a5420', X: '#e8b060', x: '#c83a28', q: '#f4ecd8',
  p: '#e6d4c4', P: '#c4a898', c: '#d4607a', T: '#3a9ab8', Y: '#78d4e4', C: '#2a7a98', j: '#58d8c8', J: '#2e9a98', o: '#e8a0b8',
  W: '#f6fbff', V: '#dce8f6', B: '#a8b8d8', D: '#6a7ea8', n: '#1a2438',
  f: '#b6c4e0', F: '#7684a8', y: '#9affff', d: '#56628a',
};
const fzSpr = (k, rows) => FZ_CACHE[k] || (FZ_CACHE[k] = faSprite(rows, FZ_PAL));
const FZ_CACHE = {};

// ---------- Карты ----------
// «подношение»: кочка с булкой; на пне — та же булка
const FZ_MOUND = [
  '....m.....m....m',
  '...mM..m..mM..mM',
  '.mmmMmmMmmmMmmMm',
  'mMmmmmMmmmmmMmmm',
  'rrMrrrrMrrrrMrrr',
  'RrrrrRrrrrRrrrrR',
  '.RRRRRRRRRRRRRR.',
];
const FZ_LOAF = [
  '..zXXXXz..',
  '.zXzXXzXz.',
  'zXXXXXXXXz',
  'zzXXXXXXzZ',
  '.ZZZZZZZZ.',
];

function fzSprites() {
  return {
    mound: fzSpr('mound', FZ_MOUND), bread: fzSpr('bread', FZ_LOAF),
  };
}

// ---------- Состояние ----------
function fz() {
  return Game.fairy2 || (Game.fairy2 = { day: -1, cut: 0, angryUntil: 0, calmDay: -2, night: -1, kik: [], les: null, pond: null, ban: [], wolves: [], wisps: [], noon: null, noonDay: -1, shore: null, lost: -1, omenAt: 0, lastCut: 0 });
}
function resetFairy() { Game.fairy2 = null; }
function serializeFairy() {
  const F = Game.fairy2;
  if (!F || (!F.cut && !F.angryUntil)) return undefined;
  return { d: F.day, c: F.cut, a: Math.max(0, Math.round(F.angryUntil)), cd: F.calmDay };
}
function loadFairy(o) {
  resetFairy();
  if (!o) return;
  const F = fz();
  F.day = o.d === undefined ? -1 : o.d; F.cut = o.c || 0; F.angryUntil = o.a || 0; F.calmDay = o.cd === undefined ? -2 : o.cd;
}

const FZ_ON = () => FAUNA_ON() && typeof Game.units !== 'undefined' && Game.units && Game.buildings;
const fzName = u => UNIT_TYPES[u.type].name.toLowerCase();
const fzDark = () => nightAmt();
const fzCanBeTaken = u => isPerson(u) && u.type !== 'carter' && u.type !== 'hero' && !u.inside && !u.dead;
const fzLand = (x, y) => inb(x, y) && isWalkable(x, y) && !World.bmap[idx(x, y)];

// гном отдаёт «откуп»: из рук, а если нет — из кладовой (обеденный припас); возвращает название блага или null
function fzOffer(u, goods, pStore) {
  if (u.carry && goods.includes(u.carry)) {
    const g = u.carry;
    u.carryN = (u.carryN || 1) - 1;
    if (u.carryN <= 0) { u.carry = null; u.carryN = 0; }
    return g;
  }
  if (pStore && Math.random() < pStore) {
    for (const b of Game.buildings) {
      if (b.type !== 'storehouse' || b.state !== 'done' || b.removed || !b.stock) continue;
      for (const g of goods) if (b.stock[g] - (b.reserved ? b.reserved[g] : 0) >= 1) { b.stock[g]--; return g; }
    }
  }
  return null;
}
const FZ_FOOD = ['bread', 'sausage', 'chickenleg', 'steak', 'croissant', 'chicken', 'wheat', 'flour'];
const FZ_BEER = ['beer', 'darkbeer'];

// «Блуждание»: гном ходит кругами и теряет время
function* fzWanderGen(u, why) {
  floater(u.x, u.y - 1.2, why || 'Куда это я?..', '#cfe0a0');
  const cx = u.x, cy = u.y, a0 = Math.random() * 6.28;
  for (let k = 0; k < 6; k++) {
    const a = a0 + k * 1.05, s = randomFreeNear(Math.floor(cx + Math.cos(a) * 2.4), Math.floor(cy + Math.sin(a) * 2.4), 0, 1.4, fzLand);
    if (s) yield { walk: s, offroad: true };
    yield { wait: 0.5 + Math.random() * 0.8, anim: 'lost' };
  }
  floater(u.x, u.y - 1.2, 'Где я?..', '#cfe0a0');
}
function fzDaze(u, spot, say) {
  if (u.brk) endBreak(u);
  startBreak(u, 'lure', null);
  u.proc = (function* () {
    floater(u.x, u.y - 1.2, say, '#bfeaff');
    const ok = yield { walk: spot, offroad: true };
    yield { wait: 6 + Math.random() * 3, anim: 'lost' };
    floater(u.x, u.y - 1.2, 'Ох… где я?', '#e8f0ff');
  })();
}
function fzBog(u) {
  if (u.brk) endBreak(u);
  startBreak(u, 'freeze', null);
  u.proc = (function* () {
    floater(u.x, u.y - 1.4, 'Тону!', '#ffc0c0');
    for (let k = 0; k < 50 && u._bog; k++) yield { wait: 0.3, anim: 'freeze' };
    u._bog = false;
    floater(u.x, u.y - 1.2, 'Фу, тина!', '#d8e8b0');
  })();
}

function fzScareAround(x, y, r, cd, txt, col) {
  let n = 0;
  for (const u of Game.units) {
    if (!isPerson(u) || u.type === 'carter' || u.inside || u.dead || (u.fzCD || 0) > Game.time) continue;
    if (Math.hypot(u.x - x, u.y - y) > r) continue;
    u.fzCD = Game.time + cd;
    floater(u.x, u.y - 1.3, txt, col || '#e0ecff');
    scare(u, { x, y });
    n++;
  }
  return n;
}

// ---------- Берега ----------
function fzShore() {
  const F = fz();
  if (F.shore) return F.shore;
  const out = [];
  for (let y = 3; y < MAP_H - 3; y++) for (let x = 3; x < MAP_W - 3; x++) {
    if (!fzLand(x, y)) continue;
    const i = idx(x, y);
    if (World.road[i] || World.obj[i] || World.door[i]) continue;
    let wx = -1, wy = -1;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inb(x + dx, y + dy) && World.terrain[idx(x + dx, y + dy)] === T_WATER) { wx = x + dx; wy = y + dy; break; }
    if (wx < 0) continue;
    let n = 0;
    for (let yy = y - 3; yy <= y + 3; yy++) for (let xx = x - 3; xx <= x + 3; xx++) if (inb(xx, yy) && World.terrain[idx(xx, yy)] === T_WATER) n++;
    if (n >= 6) out.push({ x, y, wx, wy, n });
  }
  F.shore = out;
  return out;
}
// выбрать берег поближе к деревне (иначе встречи не случатся), не ближе d от уже занятых
function fzPickShore(taken, d) {
  const sh = fzShore();
  if (!sh.length) return null;
  const cx = MAP_W / 2, cy = MAP_H / 2;
  const free = sh.filter(s => taken.every(t => Math.hypot(t.x - s.x, t.y - s.y) >= d));
  const pool = (free.length ? free : sh).slice().sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
  const top = pool.slice(0, Math.max(3, Math.ceil(pool.length * 0.35)));
  return top[(Math.random() * top.length) | 0];
}

// ---------- Ночной завод ----------
function fzSpawnNight() {
  const F = fz();
  F.kik = []; F.ban = []; F.wolves = []; F.pond = null;
  const taken = [];
  const nk = isLongNight() ? 2 : 1;
  for (let k = 0; k < nk; k++) {
    const s = fzPickShore(taken, 9);
    if (!s) break;
    taken.push(s);
    F.kik.push({ hx: s.x, hy: s.y, wx: s.wx, wy: s.wy, x: s.wx + 0.5, y: s.wy + 0.5, state: 'hide', t: 0, ph: Math.random() * 9, face: 1, alpha: 0, tgt: 0, sated: false, scan: 0, rest: 0 });
  }
  const p = fzPickShore(taken, 9);
  if (p) {
    F.pond = {
      x: p.x, y: p.y, wx: p.wx, wy: p.wy, calm: false, hoard: [],
      vod: { x: p.wx + 0.5, y: p.wy + 0.5, state: 'hide', t: 0, ph: Math.random() * 9, alpha: 0, face: 1, scan: 0, tgt: 0 },
      rus: { x: p.x + 0.5, y: p.y + 0.5, state: 'sit', t: 0, ph: Math.random() * 9, alpha: 0, song: 4 + Math.random() * 6, scan: 0 },
    };
  }
  F.lost = Game.lostGnomes || 0;
  fzWispsSpawn(F);
  logEvent('night', 'К воде вышли кикимора и русалка — на берегу лучше не задерживаться');
}

function fzMakeBanshee(x, y, omen) {
  return { x, y, hx: x, hy: y, tx: x, ty: y, alpha: 0, ph: Math.random() * 9, face: 1, omen, t: 0, wailT: 3 + Math.random() * 8, retarget: 0, wail: 0 };
}

// ---------- Лес и леший ----------
function fzCutScan(F) {
  const k = cycleAt(Game.time).k;
  if (F.day !== k) { F.day = k; F.cut = 0; }
  let cutters = 0;
  for (const u of Game.units) {
    if (u.type !== 'woodcutter' || u.dead) continue;
    if (!u.home || u.home.type === 'woodcutter') cutters++;   // лесничий с лесопилки леса не рубит — порог гнева прежний
    const ch = !!(u.action && u.action.anim === 'chop');
    if (u._fzChop && !ch && u.carry === 'trunk') F.cut++;
    u._fzChop = ch;
  }
  const thr = Math.max(6, cutters * 4);
  if (F.cut >= thr && Game.time > F.angryUntil && F.calmDay !== k) {
    F.angryUntil = Game.time + 110; F.cut = 0;
    toast('Леший недоволен вырубкой: дровосеки начнут блуждать по лесу');
    logEvent('tree', 'Лес гневается: леший послал дровосекам блуждания', undefined, undefined);
    fstat('leshAngry');
  }
}
function fzLeshySpawn(F) {
  let best = null, bd = 1e9;
  const wc = Game.buildings.filter(b => b.type === 'woodcutter' && b.state === 'done' && !b.removed);
  const ref = wc.length ? wc[(Math.random() * wc.length) | 0] : null;
  const cx = ref ? ref.doorX : MAP_W >> 1, cy = ref ? ref.doorY : MAP_H >> 1;
  const tr = findObjNear(cx, cy, 10, o => o.t === 'tree');
  if (tr) { best = [tr.x, tr.y]; }
  const x = best ? best[0] + 0.5 : cx + 5.5, y = best ? best[1] + 0.8 : cy + 0.5;
  F.les = { x, y, state: 'angry', alpha: 0, ph: Math.random() * 9, t: 0, wander: 0, gift: null, said: 0 };
}
function fzLeshyTick(F, dt) {
  const angry = Game.time < F.angryUntil;
  if (angry && !F.les) fzLeshySpawn(F);
  const L = F.les;
  if (!L) return;
  L.ph += dt; L.t += dt;
  if (L.state === 'angry') {
    L.alpha = Math.min(1, L.alpha + dt * 0.5);
    if (!angry) { L.state = 'leave'; floater(L.x, L.y - 2.2, 'Ладно, живите…', '#bfe890'); logEvent('tree', 'Леший отступил: лес снова спокоен'); }
    else {
      L.wander -= dt;
      if (L.wander <= 0) {
        L.wander = 2;
        for (const u of Game.units) {
          if (u.type !== 'woodcutter' || u.dead || u.inside || (u.fzWander || 0) > Game.time || !interruptible(u)) continue;
          if (Math.hypot(u.x - L.x, u.y - L.y) > 26) continue;
          u.fzWander = Game.time + 22;
          const g = fzOffer(u, ['bread'], 0.4);
          if (g) {
            const stump = findObjNear(Math.floor(u.x), Math.floor(u.y), 6, o => o.t === 'stump');
            L.gift = stump ? { x: stump.x + 0.5, y: stump.y + 0.6 } : { x: u.x, y: u.y + 0.3 };
            L.state = 'calm'; L.t = 0; F.angryUntil = 0; F.calmDay = F.day;
            floater(u.x, u.y - 1.3, 'Хлебушек, хозяин леса', '#ffe9b0');
            floater(L.x, L.y - 2.4, 'Хм… уважил', '#bfe890');
            logEvent('tree', `${UNIT_TYPES[u.type].name} оставил хлеб на пне — леший смягчился`, u.x, u.y);
            fstat('leshPaid');
            break;
          }
          startBreak(u, 'wander', null);
          u.proc = fzWanderGen(u);
          fstat('leshWander');
          if (Game.time - (F.lastWanderLog || -99) > 25) { F.lastWanderLog = Game.time; logEvent('tree', `Леший водит кругами: ${fzName(u)} блуждает по лесу`, u.x, u.y); }
        }
      }
    }
  } else if (L.state === 'calm') {
    if (L.t > 6) L.state = 'leave';
  }
  if (L.state === 'leave') { L.alpha -= dt * 0.4; if (L.alpha <= 0) F.les = null; }
}

// ---------- Кикимора ----------
function fzKikTick(F, k, dt, act) {
  k.ph += dt; k.t += dt;
  if (!act) { k.alpha = Math.max(0, k.alpha - dt * 0.5); return !!F.over && k.alpha <= 0; }
  k.alpha = Math.min(1, k.alpha + dt * 0.4);
  if (k.sated) { k.state = k.state === 'drag' ? 'hide' : k.state; }
  switch (k.state) {
    case 'hide': {
      k.scan -= dt;
      if (k.scan > 0) break;
      k.scan = 0.5;
      for (const u of Game.units) {
        if (!fzCanBeTaken(u) || (u.kikCD || 0) > Game.time) continue;
        const d = Math.hypot(u.x - k.hx, u.y - k.hy);
        if (d > 7) continue;
        const g = fzOffer(u, FZ_FOOD, d < 3.6 ? 0.3 : 0);        // кто идёт мимо с едой — кладёт на кочку
        if (g) {
          k.sated = true; u.kikCD = Game.time + 60;
          floater(u.x, u.y - 1.3, 'Это тебе, болотная', '#ffe9b0');
          floater(k.x, k.y - 1.6, 'Хи-хи… спасибо', '#c8f0a0');
          logEvent('night', `${UNIT_TYPES[u.type].name} оставил еду на кочке — кикимора довольна`, k.hx, k.hy);
          fstat('kikPaid');
          break;
        }
        if (k.sated || !interruptible(u) || d > 6.5) continue;
        k.tgt = u.id; k.state = 'chase'; k.t = 0; k.x = k.wx + 0.5; k.y = k.wy + 0.5;
        floater(k.x, k.y - 1.6, 'Иди-ка сюда…', '#c8f0a0');
        break;
      }
      break;
    }
    case 'chase': {
      const u = Game.unitMap.get(k.tgt);
      if (!u || u.dead || u.inside || k.t > 9 || k.sated || Math.hypot(u.x - k.hx, u.y - k.hy) > 9) { k.state = 'back'; k.tgt = 0; break; }
      const dx = u.x - k.x, dy = u.y - k.y, d = Math.hypot(dx, dy) || 1;
      if (d > 0.8) {
        const s = Math.min(d, 1.9 * dt), nx = k.x + dx / d * s, ny = k.y + dy / d * s;
        if (fzLand(Math.floor(nx), Math.floor(ny)) || World.terrain[idx(Math.floor(nx), Math.floor(ny))] === T_WATER) { k.x = nx; k.y = ny; }
        k.face = dx >= 0 ? 1 : -1;
      } else {
        u.kikCD = Game.time + 90; u._bog = true;
        k.loot = u.carry ? [u.carry, u.carryN || 1] : null;
        u.carry = null; u.carryN = 0;
        fzBog(u);
        k.state = 'drag'; k.t = 0;
        floater(k.x, k.y - 1.6, 'Моё!', '#c8f0a0');
        logEvent('night', `Кикимора утащила в тину: ${fzName(u)}${k.loot ? ' (вместе с грузом)' : ''}`, k.x, k.y);
        fstat('kikGrab');
      }
      break;
    }
    case 'drag': {
      const u = Game.unitMap.get(k.tgt);
      const dx = k.hx + 0.5 - k.x, dy = k.hy + 0.5 - k.y, d = Math.hypot(dx, dy);
      if (d > 0.2) { const s = Math.min(d, 1.3 * dt); k.x += dx / d * s; k.y += dy / d * s; k.face = dx >= 0 ? 1 : -1; }
      if (u && u._bog) { u.x = k.x - k.face * 0.45; u.y = k.y + 0.1; }
      if (d <= 0.2 || k.t > 10) {
        if (u) {
          u._bog = false; u.x = k.hx + 0.5; u.y = k.hy + 0.9;
          if (!u.injury && Math.random() < 0.35) { injure(u, 'leg'); u.injuryUntil = Game.time + 40; }
        }
        k.state = 'rest'; k.t = 0; k.tgt = 0; k.rest = 14 + Math.random() * 14;
        if (k.loot) { k.hoard = k.loot; k.loot = null; }
      }
      break;
    }
    case 'back': {
      const dx = k.wx + 0.5 - k.x, dy = k.wy + 0.5 - k.y, d = Math.hypot(dx, dy);
      if (d < 0.15) { k.x = k.wx + 0.5; k.y = k.wy + 0.5; k.state = 'hide'; k.scan = 2; break; }
      const s = Math.min(d, 1.5 * dt); k.x += dx / d * s; k.y += dy / d * s;
      break;
    }
    case 'rest': {
      if (k.t > k.rest) k.state = 'back';
      break;
    }
  }
  // сытая кикимора мирно отдыхает: хватает еды
  if (k.sated && k.state === 'chase') k.state = 'back';
  return false;
}
function fzKikCleanup(k) {
  const u = k.tgt && Game.unitMap.get(k.tgt);
  if (u && u._bog) u._bog = false;
}

// ---------- Водяной и русалка ----------
function fzPondTick(F, P, dt, act) {
  const v = P.vod, r = P.rus;
  v.ph += dt; r.ph += dt; v.t += dt; r.t += dt;
  const a = act ? Math.min(1, v.alpha + dt * 0.35) : Math.max(0, v.alpha - dt * 0.4);
  v.alpha = a; r.alpha = a;
  if (!act) return !!F.over && a <= 0;
  // русалка: поёт по расписанию
  if (!P.calm) {
    r.song -= dt;
    if (r.state === 'sit' && r.song <= 0) { r.state = 'sing'; r.t = 0; floater(r.x, r.y - 2.4, 'Ла-а-а… ♪', '#bfeaff'); }
    else if (r.state === 'sing') {
      if (r.t > 6) { r.state = 'sit'; r.song = 9 + Math.random() * 8; }
      r.scan -= dt;
      if (r.scan <= 0) {
        r.scan = 1;
        if (Math.random() < 0.3) floater(r.x + (Math.random() - 0.5) * 1.5, r.y - 2.6, '♪', '#bfeaff');
        for (const u of Game.units) {
          if (!fzCanBeTaken(u) || (u.lureCD || 0) > Game.time || !interruptible(u)) continue;
          if (Math.hypot(u.x - r.x, u.y - r.y) > 9) continue;
          u.lureCD = Game.time + 80;
          // гном с пивом успевает бросить его в воду — песня стихает
          const g = fzOffer(u, FZ_BEER, 0.25);
          if (g) { fzPondCalm(F, P, u); break; }
          const spot = randomFreeNear(Math.floor(r.x), Math.floor(r.y), 1, 2.6, fzLand);
          if (!spot) continue;
          fzDaze(u, spot, 'Что за голос…');
          u._lure = Game.time;
          fstat('rusLure');
          if (Game.time - (F.lastLureLog || -99) > 30) { F.lastLureLog = Game.time; logEvent('night', `Русалка заманила к воде: ${fzName(u)}`, r.x, r.y); }
          break;
        }
      }
    }
  } else if (r.state === 'sing') r.state = 'sit';
  // заворожённые теряют фонарь у воды
  for (const u of Game.units) {
    if (u._lure && Game.time - u._lure > 5 && u.lantern && Math.hypot(u.x - r.x, u.y - r.y) < 4) {
      u._lure = 0;
      if (Math.random() < 0.3) { u.lantern = false; floater(u.x, u.y - 1.2, 'Плюх! Фонарь…', '#ffd880'); logEvent('night', `${UNIT_TYPES[u.type].name} уронил фонарь в воду`, u.x, u.y); }
    } else if (u._lure && Game.time - u._lure > 12) u._lure = 0;
  }
  // водяной: утаскивает груз с берега
  if (!P.calm) {
    if (v.state === 'hide') {
      v.scan -= dt;
      if (v.scan <= 0) {
        v.scan = 0.8;
        let hit = null;
        for (const u of Game.units) {
          if (!isPerson(u) || u.inside || u.dead || u.type === 'hero' || !u.carry || (u.vodCD || 0) > Game.time) continue;
          if (Math.hypot(u.x - v.x, u.y - v.y) < 3.2) { hit = { u }; break; }
        }
        if (!hit) for (const p of Game.piles.values()) {
          if (p.removed || Math.hypot(p.x + 0.5 - v.x, p.y + 0.5 - v.y) > 3.4) continue;
          const g = GOOD_KEYS.find(gg => p.stock[gg] - p.reserved[gg] > 0);
          if (g) { hit = { p, g }; break; }
        }
        if (hit) { v.state = 'grab'; v.t = 0; v.hit = hit; v.face = (hit.u ? hit.u.x : hit.p.x) >= v.x ? 1 : -1; floater(v.x, v.y - 1.6, 'Моё-ё!', '#a0f0d8'); }
      }
    } else if (v.state === 'grab') {
      if (v.t > 0.9 && v.hit) {
        const h = v.hit; v.hit = null;
        let what = null;
        if (h.u && h.u.carry) {
          what = [h.u.carry, h.u.carryN || 1]; h.u.carry = null; h.u.carryN = 0; h.u.vodCD = Game.time + 70;
          floater(h.u.x, h.u.y - 1.3, 'Мой груз!', '#ffc0c0'); scare(h.u, v);
        } else if (h.p && !h.p.removed) {
          const g = h.g, n = Math.min(3, h.p.stock[g] - h.p.reserved[g]);
          if (n > 0) { h.p.stock[g] -= n; what = [g, n]; cleanupPile(h.p); }
        }
        if (what) {
          P.hoard.push(what);
          floater(v.x, v.y - 1.4, 'Плюх!', '#a0f0d8');
          logEvent('night', `Водяной утащил в омут: ${GOODS[what[0]].name.toLowerCase()} ×${what[1]}`, v.x, v.y);
          fstat('vodSteal');
        }
      }
      if (v.t > 1.8) { v.state = 'hide'; v.scan = 4; }
    }
  }
}
function fzPondCalm(F, P, u) {
  P.calm = true;
  floater(u.x, u.y - 1.3, 'Плюх! Пей, хозяин', '#ffe9b0');
  floater(P.vod.x, P.vod.y - 1.6, 'Буль-буль… благодарствую', '#a0f0d8');
  logEvent('night', `${UNIT_TYPES[u.type].name} бросил пиво в озеро — водяной и русалка утихли`, P.x, P.y);
  fstat('waterPaid');
  let back = '';
  while (P.hoard.length) {
    const [g, n] = P.hoard.pop();
    dropPile(P.x, P.y, g, n);
    back = ' и вернул украденное';
  }
  if (back) logEvent('night', 'Водяной вернул украденное на берег', P.x, P.y);
  if (Math.random() < 0.5) dropPile(P.x, P.y, 'gold', 1);
}

// ---------- Банши ----------
function fzOmen(F, x, y, why, u) {
  if (Game.time - F.omenAt < 10 || F.ban.filter(b => b.omen).length >= 2) return;
  F.omenAt = Game.time;
  const b = fzMakeBanshee(x + (Math.random() < 0.5 ? -2.4 : 2.4), y - 0.6, true);
  b.tx = x; b.ty = y; b.alpha = 0.1;
  F.ban.push(b);
  floater(b.x, b.y - 2.2, 'Ау-у-у!', '#dcecff');
  const t = u ? ` у ${fzName(u)}` : '';
  logEvent('night', `Банши завыла${t}: ${why}`, x, y);
  toast('Банши воет — быть беде!');
  fstat('banOmen');
  fzScareAround(x, y, 6, 40, 'Банши!', '#dcecff');
  try {                                   // мигает значок журнала
    const lb = document.getElementById('log-badge');
    if (lb && lb.animate) lb.animate([{ transform: 'scale(1)', filter: 'brightness(1)' }, { transform: 'scale(1.5)', filter: 'brightness(2.4)' }, { transform: 'scale(1)', filter: 'brightness(1)' }], { duration: 600, iterations: 6 });
  } catch (e) { /* без DOM — не страшно */ }
}
function fzBansheeTick(F, act, dt) {
  const gy = graveyardOf();
  // постоянная плакальщица у кладбища
  if (act && gy && !F.ban.some(b => !b.omen)) F.ban.push(fzMakeBanshee(gy.x + 1 + Math.random() * (gy.w - 2), gy.y + 0.5 + Math.random() * (gy.h - 1), false));
  if (act) {
    F.banScan = (F.banScan || 0) - dt;
    if (F.banScan <= 0) {
      F.banScan = 0.5;
      // потеря гнома — вой на кладбище
      const lost = Game.lostGnomes || 0;
      if (F.lost >= 0 && lost > F.lost && gy) fzOmen(F, gy.x + gy.w / 2, gy.y + gy.h / 2, 'ещё один гном не вернётся', null);
      F.lost = lost;
      const hostile = [];
      for (const e of Game.ents || []) if ((e.state === 'walk' || e.state === 'smash') && !e.dead) hostile.push(e);
      for (const s of Game.skels || []) if (s.state === 'roam' && !s.dead) hostile.push(s);
      for (const u of Game.units) {
        if (!isPerson(u) || u.inside || u.dead) continue;
        const inj = !!u.injury;
        if (inj && !u._bnInj) { u._bnInj = true; if (isNightNow() && Math.random() < 0.5) fzOmen(F, u.x, u.y, 'гном ранен', u); }
        else if (!inj) u._bnInj = false;
        if (!hostile.length || (u.bnCD || 0) > Game.time || u.type === 'hero') continue;
        for (const e of hostile) if (Math.hypot(e.x - u.x, e.y - u.y) < 5) { u.bnCD = Game.time + 70; fzOmen(F, u.x, u.y, 'нечисть рядом с гномом', u); break; }
      }
    }
  }
  for (let i = F.ban.length - 1; i >= 0; i--) {
    const b = F.ban[i];
    b.ph += dt; b.t += dt; b.wail = Math.max(0, b.wail - dt);
    let leaving = !act;
    if (b.omen && b.t > 7) leaving = true;
    b.alpha = Math.max(0, Math.min(0.75, b.alpha + (leaving ? -dt * 0.5 : dt * 0.4)));
    if (leaving && b.alpha <= 0) { F.ban.splice(i, 1); continue; }
    if (b.omen) { const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy) || 1; if (d > 2) { b.x += dx / d * 0.5 * dt; b.y += dy / d * 0.5 * dt; } b.face = dx >= 0 ? 1 : -1; }
    else {
      b.retarget -= dt;
      if (b.retarget <= 0 || Math.hypot(b.tx - b.x, b.ty - b.y) < 0.4) {
        b.retarget = 4 + Math.random() * 4;
        b.tx = b.hx + (Math.random() - 0.5) * 7; b.ty = b.hy + (Math.random() - 0.5) * 5;
      }
      const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy) || 1;
      b.x += dx / d * 0.45 * dt; b.y += dy / d * 0.45 * dt; b.face = dx >= 0 ? 1 : -1;
    }
    b.wailT -= dt;
    if (b.wailT <= 0 && b.alpha > 0.35) {
      b.wailT = 16 + Math.random() * 14; b.wail = 2.4;
      floater(b.x, b.y - 2.4, ['У-у-у…', 'Ау-у-у!', 'И-и-и…'][(Math.random() * 3) | 0], '#dcecff');
      if (fzScareAround(b.x, b.y, 7, 45, 'Банши!..', '#dcecff')) { fstat('banWail'); if (Game.time - (F.lastWailLog || -99) > 60) { F.lastWailLog = Game.time; logEvent('night', 'Банши воет у кладбища — работники в страхе', b.x, b.y); } }
    }
  }
}

// ---------- Призрачный волк ----------
function fzBonfireNear(x, y, r) {
  for (const b of Game.buildings) if (b.type === 'bonfire' && b.state === 'done' && !b.removed && Math.hypot(b.x + b.w / 2 - x, b.y + b.h / 2 - y) < r) return b;
  return null;
}
function fzWolvesTick(F, act, dt) {
  const ws = F.wolves;
  if (act) {
    F.wolfScan = (F.wolfScan || 0) - dt;
    if (F.wolfScan <= 0) {
      F.wolfScan = 2;
      const esc = [];
      for (const e of Game.ents || []) if ((e.state === 'walk' || e.state === 'smash') && !e.dead) esc.push(e);
      for (const s of Game.skels || []) if (s.state === 'roam' && !s.dead) esc.push(s);
      const want = Math.min(3, Math.ceil(esc.length / 3));
      if (ws.filter(w => w.state !== 'fade').length < want && Math.random() < 0.5) {
        const e = esc[(Math.random() * esc.length) | 0];
        if (!fzBonfireNear(e.x, e.y, 9)) ws.push({ x: e.x + 1.5, y: e.y + 0.5, alpha: 0, ph: Math.random() * 9, face: 1, state: 'escort', esc: e, ang: Math.random() * 6.28, howl: 8 + Math.random() * 15, hold: 0, t: 0, victim: 0, home: [e.x, e.y] });
      }
    }
  }
  for (let i = ws.length - 1; i >= 0; i--) {
    const w = ws[i];
    w.ph += dt * 6; w.t += dt; w.howlT = Math.max(0, (w.howlT || 0) - dt); w.howl -= dt; w.hold = Math.max(0, w.hold - dt);
    const away = !act || w.state === 'fade';
    w.alpha = Math.max(0, Math.min(0.62, w.alpha + (away ? -dt * 0.5 : dt * 0.4)));
    if (away && w.alpha <= 0) { fzWolfDrop(w, false); ws.splice(i, 1); continue; }
    if (w.state === 'fade') { w.x += (w.fx || 1) * 2.5 * dt; continue; }
    // отгоняют: костёр или герой
    const hero = heroNear(w.x, w.y, 5.5), bf = fzBonfireNear(w.x, w.y, 9);
    if (hero || bf) {
      floater(w.x, w.y - 1.5, 'Ай-й!', '#cfe0ff');
      const lantern = fzWolfDrop(w, true);
      logEvent('night', (hero ? 'Герой' : 'Костёр') + ` отогнал призрачного волка${lantern ? ' — фонарь вернулся хозяину' : ''}`, w.x, w.y);
      fstat('wolfBanish');
      w.state = 'fade'; w.fx = w.x > (bf ? bf.x : hero.x) ? 1 : -1; w.face = w.fx; continue;
    }
    let tx = w.x, ty = w.y, sp = 1.5;
    const tgt = w.state === 'lunge' ? Game.unitMap.get(w.victim) : null;
    if (w.state === 'lunge') {
      if (!tgt || tgt.dead || tgt.inside || !tgt.lantern || w.t > 5) { w.state = 'escort'; w.t = 0; }
      else {
        tx = tgt.x; ty = tgt.y; sp = 3.8;
        if (Math.hypot(tgt.x - w.x, tgt.y - w.y) < 0.9) {
          tgt.lantern = false; w.stole = tgt.id; w.state = 'flee'; w.t = 0;
          floater(tgt.x, tgt.y - 1.3, 'Фонарь!', '#ffd880'); scare(tgt, w);
          floater(w.x, w.y - 1.5, 'Р-р-р…', '#cfe0ff');
          logEvent('night', `Призрачный волк отнял фонарь у: ${fzName(tgt)}`, w.x, w.y);
          fstat('wolfSteal');
        }
      }
    } else if (w.state === 'flee') {
      const sx = w.home[0] - w.x, sy = w.home[1] - w.y, sd = Math.hypot(sx, sy) || 1;
      tx = w.x - sx / sd * 4 + (w.x > MAP_W / 2 ? 3 : -3); ty = w.y - sy / sd; sp = 3;
      if (w.t > 14) { w.state = 'fade'; w.fx = w.x > MAP_W / 2 ? 1 : -1; continue; }
    } else {
      const e = w.esc;
      const alive = e && !e.dead && (e.state === 'walk' || e.state === 'smash' || e.state === 'roam' || e.state === 'fight');
      if (!alive) { w.esc = null; w.state = 'escort'; tx = w.home[0]; ty = w.home[1]; sp = 0.9; if (w.t > 20) w.state = 'fade'; }
      else { w.home = [e.x, e.y]; w.ang += dt * 0.4; tx = e.x + Math.cos(w.ang) * 2.2; ty = e.y + Math.sin(w.ang) * 1.5; }
      if (!w.hold && w.state === 'escort') {
        for (const u of Game.units) {
          if (!u.lantern || !fzCanBeTaken(u) || (u.wolfCD || 0) > Game.time) continue;
          if (Math.hypot(u.x - w.x, u.y - w.y) < 5.5 && !fzBonfireNear(u.x, u.y, 9)) { u.wolfCD = Game.time + 60; w.state = 'lunge'; w.victim = u.id; w.t = 0; break; }
        }
      }
    }
    const dx = tx - w.x, dy = ty - w.y, d = Math.hypot(dx, dy);
    if (d > 0.1) { const s = Math.min(d, sp * dt); w.x += dx / d * s; w.y += dy / d * s; if (Math.abs(dx) > 0.05) w.face = dx > 0 ? 1 : -1; }
    if (w.howl <= 0 && w.alpha > 0.3) {
      w.howl = 22 + Math.random() * 14;
      floater(w.x, w.y - 1.6, 'Ау-у-у-у!', '#cfe0ff'); w.howlT = 1.8;
      if (fzScareAround(w.x, w.y, 6.5, 50, 'Волк воет!', '#cfe0ff')) fstat('wolfHowl');
    }
  }
}
// волк уходит: если украл фонарь и его отогнали — фонарь возвращается
function fzWolfDrop(w, giveBack) {
  if (!w.stole) return false;
  const u = Game.unitMap.get(w.stole);
  w.stole = 0;
  if (giveBack && u && !u.dead && isNightNow()) { u.lantern = true; return true; }
  return false;
}


// ---------- Блуждающие огоньки ----------
// Три болотных огонька парят у воды. Гном без фонаря идёт на огонёк, пока тот не погаснет — и блуждает в тине.
function fzWispsSpawn(F) {
  F.wisps = [];
  const s = F.pond ? { x: F.pond.x, y: F.pond.y } : (F.kik[0] ? { x: F.kik[0].hx, y: F.kik[0].hy } : null);
  if (!s) return;
  for (let i = 0; i < 3; i++) F.wisps.push({ x: s.x + (Math.random() - 0.5) * 6, y: s.y + (Math.random() - 0.5) * 4, hx: s.x, hy: s.y, tx: s.x, ty: s.y, ph: Math.random() * 9, alpha: 0, retarget: 0, scan: Math.random() * 2 });
}
function fzWispsTick(F, act, dt) {
  for (let i = F.wisps.length - 1; i >= 0; i--) {
    const w = F.wisps[i];
    w.ph += dt * 2; w.retarget -= dt; w.scan -= dt;
    w.alpha = Math.max(0, Math.min(1, w.alpha + (act ? dt * 0.4 : -dt * 0.5)));
    if (!act && F.over && w.alpha <= 0) { F.wisps.splice(i, 1); continue; }
    if (w.retarget <= 0 || Math.hypot(w.tx - w.x, w.ty - w.y) < 0.4) { w.tx = w.hx + (Math.random() - 0.5) * 9; w.ty = w.hy + (Math.random() - 0.5) * 6; w.retarget = 3 + Math.random() * 3; }
    const dx = w.tx - w.x, dy = w.ty - w.y, d = Math.hypot(dx, dy) || 1;
    w.x += dx / d * 0.7 * dt; w.y += dy / d * 0.7 * dt;
    if (!act || w.scan > 0) continue;
    w.scan = 1;
    for (const u of Game.units) {
      if (!fzCanBeTaken(u) || u.lantern || (u.wispCD || 0) > Game.time || !interruptible(u)) continue;
      if (Math.hypot(u.x - w.x, u.y - w.y) > 6) continue;
      u.wispCD = Game.time + 70;
      if (u.brk) endBreak(u);
      startBreak(u, 'lure', null);
      u.proc = (function* () {
        floater(u.x, u.y - 1.2, 'Огонёк! Тётя, идём за ним', '#bfffe8');
        for (let k = 0; k < 3; k++) {
          const s2 = randomFreeNear(Math.floor(w.x), Math.floor(w.y), 0, 2.6, fzLand);
          if (s2) yield { walk: s2, offroad: true };
          yield { wait: 0.6, anim: 'lost' };
        }
        floater(u.x, u.y - 1.2, 'Погас… где я?', '#cfe8e0');
        yield { wait: 2, anim: 'lost' };
      })();
      fstat('wispLure');
      if (Game.time - (F.lastWispLog || -99) > 30) { F.lastWispLog = Game.time; logEvent('night', `Болотный огонёк увёл гнома без фонаря: ${fzName(u)}`, w.x, w.y); }
      break;
    }
  }
}

// ---------- Полудница ----------
// В самый зной появляется вихрь пыли с женским лицом, находит работающего в поле крестьянина и кружит ему голову.
// Пиво — откуп: выпила и ушла.
function fzNoonTick(F, dt) {
  const cy = cycleAt(Game.time);
  const mid = EVE_START * 0.5;
  if (!F.noon && F.noonDay !== cy.k && nightAmt() < 0.01 && Math.abs(cy.p - mid) < EVE_START * 0.12) {
    F.noonDay = cy.k;
    const fs = Game.units.filter(u => u.type === 'farmer' && fzCanBeTaken(u));
    if (fs.length) {
      const u = fs[(Math.random() * fs.length) | 0];
      F.noon = { x: u.x + 7, y: u.y - 1, tgt: u.id, state: 'come', t: 0, ph: Math.random() * 9, alpha: 0, face: -1 };
      floater(F.noon.x, F.noon.y - 2, 'Ш-ш-ш…', '#e8d8b0');
      logEvent('animal', 'В зной над полем закружилась Полудница', F.noon.x, F.noon.y);
    }
  }
  const n = F.noon;
  if (!n) return;
  n.ph += dt; n.t += dt;
  const u = Game.unitMap.get(n.tgt);
  const away = n.state === 'leave' || nightAmt() > 0.05 || !u || u.dead;
  n.alpha = Math.max(0, Math.min(0.9, n.alpha + (away ? -dt * 0.6 : dt * 0.5)));
  if (away && n.alpha <= 0) { F.noon = null; return; }
  if (away) return;
  if (n.state === 'come') {
    const dx = u.x - n.x, dy = u.y - n.y, d = Math.hypot(dx, dy) || 1;
    n.face = dx >= 0 ? 1 : -1;
    if (d > 1.1) { n.x += dx / d * 1.8 * dt; n.y += dy / d * 1.8 * dt; }
    else {
      const g = fzOffer(u, FZ_BEER, 0.2);
      if (g) {
        floater(u.x, u.y - 1.3, 'Выпей, Полудница', '#ffe9b0'); floater(n.x, n.y - 2.2, 'Хороша брага…', '#e8d8b0');
        logEvent('animal', `${UNIT_TYPES[u.type].name} угостил Полудницу пивом — она ушла`, u.x, u.y);
        fstat('noonPaid'); n.state = 'leave'; return;
      }
      n.state = 'haunt'; n.t = 0;
      if (u.brk) endBreak(u);
      if (interruptible(u)) {
        startBreak(u, 'freeze', null);
        u.proc = (function* () { floater(u.x, u.y - 1.3, 'В голове шумит…', '#f0e0b0'); yield { wait: 7, anim: 'lost' }; floater(u.x, u.y - 1.2, 'Фух, отпустило', '#f0e0b0'); })();
        fstat('noonDaze');
        logEvent('animal', `Полудница заморочила голову: ${fzName(u)} застыл в поле`, u.x, u.y);
      }
    }
  } else if (n.state === 'haunt') {
    n.x = u.x + Math.cos(n.ph * 1.6) * 0.8; n.y = u.y + Math.sin(n.ph * 1.6) * 0.4;
    if (n.t > 9) n.state = 'leave';
  } else if (n.state === 'leave') n.alpha = 0;
}

// Полудница: высокая иссохшая баба в выгоревшей рубахе, венок из колосьев с маками, за головой — раскалённый нимб полуденного солнца.
// Лицо — обтянутый череп в трещинах от зноя: злые брови, впалые глазницы с добела раскалёнными точками, растянутый безгубый оскал (в ударе — разинутая пасть).
// Солома волос вздыблена жаром, низ рубахи обгорел и рассыпается в пылевой вихрь с половой. В правой руке ржавый серп, левая — когтистая пятерня.
// Пиксель-арт 180×264: шаг пикселя втрое мельче мирового (шаблон нечисти «×3»), рисуется 1:1 в 3× холст.
// lv: 0 покой, 1 замах серпом (так же и опускание), 2 удар. p — фаза вихря 0..5 (петли и полова зациклены); в покое на p=4 моргает.
function fzNoonPx(lv, p) {
  const K = fzPxKit(180, 264, 90, 240), { P, R, L, dth, hsh } = K;
  const ph = p / 6 * Math.PI * 2, hit = lv === 2, blink = lv === 0 && p === 4, HY = -163;
  // палитра: зной от раскалённо-белого до бурого
  const K0 = [40, 16, 6], K1 = [78, 36, 14], K2 = [124, 64, 24], K3 = [178, 110, 38], K4 = [216, 162, 60], K5 = [238, 206, 122], K6 = [250, 234, 186], K7 = [255, 252, 232];
  const S0 = [92, 48, 22], S1 = [146, 92, 46], S2 = [198, 146, 88], S3 = [228, 192, 134], S4 = [246, 224, 176];
  const I0 = [46, 34, 28], I1 = [96, 82, 70], I2 = [164, 152, 136], I3 = [232, 228, 214], RU = [146, 70, 32], RED = [168, 44, 26], RED2 = [204, 82, 44];

  // ---- раскалённый нимб за головой: кольцо и лучи, лучи медленно вращаются
  const NX = 0, NY = HY - 4;
  R(NX - 56, NY - 56, NX + 56, NY + 56, (x, y) => {
    const dx = x - NX, dy = y - NY, d = Math.sqrt(dx * dx + dy * dy), an = Math.atan2(dy, dx) - ph / 12;
    if (d >= 37 && d < 42) return d < 38 || d >= 41 ? [...K4, 0.95] : d < 35.5 ? [...K7, 0.95] : [...K6, 0.95];
    const ray = ((an / (Math.PI * 2) * 12) % 1 + 1) % 1, long = Math.floor(((an / (Math.PI * 2) * 12) % 12 + 12) % 12) % 2 === 0;
    const len = long ? 15 : 9, w = 0.12 * (1 - (d - 42) / len);
    if (d >= 42 && d < 42 + len && Math.abs(ray - 0.5) < w) return d < 42 + len * 0.5 ? [...K5, 0.9] : dth(x, y) < 0.6 ? [...K4, 0.75] : null;
    return null;
  }, false);

  // ---- пылевой вихрь: петли (задние половины), плотный столб, полова
  const loops = front => {
    for (let i = 0; i < 11; i++) {
      const t = i / 10, y0 = 2 - t * 104, rx = 9 + t * 12 + t * t * 34, ry = rx * 0.24 + 1.5, sx = Math.sin(ph + t * 4.5) * 7 * t, th = t > 0.5 ? 3 : 2;
      for (let s = 0; s < 1; s += 1 / (rx * 7)) {
        const a = s * Math.PI * 2, sn = Math.sin(a);
        if ((sn > 0) !== front) continue;
        const dash = ((s * 3 - p / 6 + i * 0.37) % 1 + 1) % 1;
        if (dash > 0.64) continue;
        const x = sx + Math.cos(a) * rx, y = y0 + sn * ry, head = dash > 0.52;
        const col = front ? (head ? K6 : t > 0.6 ? K5 : K4) : (t > 0.6 ? K3 : K2);
        for (let k = 0; k < th; k++) P(x, y + k, col, front ? 0.85 - k * 0.15 : 0.6, false);
      }
    }
  };
  const chaff = front => {
    for (let j = 0; j < 40; j++) {
      const r = 12 + hsh(j) * 42, yy = -4 - hsh(j * 7 + 1) * 112, a = hsh(j * 3 + 2) * Math.PI * 2 + ph * (1 + (j & 1)), sn = Math.sin(a);
      if ((sn > 0) !== front) continue;
      const x = Math.cos(a) * r * (0.5 + 0.5 * (-yy / 116)), y = yy + sn * r * 0.22;
      if (j % 5 === 0) P(x, y, K2, 0.9, false);
      else { P(x, y, front ? K5 : K4, 0.9, false); P(x + 1, y, front ? K4 : K3, 0.75, false); }
    }
  };
  R(-30, -4, 30, 8, (x, y) => { const d = (x / 28) ** 2 + ((y - 2) / 5) ** 2; return d < 1 && dth(x, y) < 0.55 * (1 - d) ? [...K3, 0.6] : null; }, false);   // пыль у земли
  loops(false); chaff(false);
  for (let y = -76; y <= 2; y++) {                                                    // столб вихря
    const t = -y / 76, hw = 4 + t * t * 20 + t * 4, sx = Math.sin(ph + t * 4.5) * 7 * t * 1.05;
    for (let x = Math.floor(sx - hw); x <= Math.ceil(sx + hw); x++) {
      const r = (x - sx) / hw, band = (((r * 1.6 + y * 0.09 + p / 6) % 1) + 1) % 1, a = (0.82 - t * 0.3) * (1 - r * r * 0.6);
      if (dth(x, y) > a) continue;
      P(x, y, band < 0.22 ? K5 : band < 0.5 ? K3 : band < 0.62 ? K4 : K2, 0.85, false);
    }
  }

  // ---- волосы-солома позади: длинные пряди, по ветру назад; часть прядей вздыблена жаром вверх, как языки пламени
  const strand = (k, back) => {
    const side = k % 2 ? 1 : -1, wild = back && k % 4 === 3, fi = back ? 0.45 + (k >> 1) * 0.18 : 1.35 + (k >> 1) * 0.3;
    const x0 = side * Math.sin(fi) * 16, y0 = HY - 2 - Math.cos(fi) * 18;
    const len = wild ? 30 + hsh(k) * 14 : back ? 44 + hsh(k) * 26 : 30 + hsh(k) * 10, cols = back ? [K4, K3, K2] : [K5, K4, K3];
    let px0 = x0, py0 = y0;
    for (let m = 1; m <= 14; m++) {
      const t = m / 14, wv = Math.sin(ph + t * 5 + k * 1.3) * 4 * t;
      const x = wild ? x0 + side * t * 10 - t * t * 10 + wv : x0 + side * t * (back ? 12 + (k >> 1) * 1.6 : 4) + wv * (back ? 1 : 0.4) - (back ? t * t * 8 : 0);
      const y = wild ? y0 - t * len * 0.7 + t * t * 6 : y0 + t * len;
      if (t < 0.8 || dth(Math.round(x), Math.round(y)) < (1 - t) * 4) L(px0, py0, x, y, 2.4 - t * 1.4, 2.4 - t * 1.6, (u, e) => e ? cols[2] : cols[(k + m) % 2]);
      px0 = x; py0 = y;
    }
  };
  for (let k = 0; k < 16; k++) strand(k, true);

  // ---- рубаха: узкая в груди и талии, книзу раструбом; складки, вышивка, обгорелый рваный подол тает в вихре
  const cxAt = y => y > -108 ? Math.sin(ph + y * 0.05) * 3 * (y + 108) / 42 : 0;
  const hwAt = y => y < -132 ? 12 + (y + 140) * 0.75 : y < -118 ? 18 - (y + 132) * 0.28 : y < -108 ? 14 - (y + 118) * 0.3 : 11 + (-108 - y < 0 ? (y + 108) * 0.58 : 0);
  const bot = x => -64 + Math.floor(hsh(Math.floor(x / 3) + 11) * 16) + Math.round(Math.sin(ph + x * 0.25) * 3);
  R(-50, -140, 50, -44, (x, y) => {
    const cx = cxAt(y), hw = hwAt(y), r = (x - cx) / hw;
    if (Math.abs(r) > 1 || y > bot(x)) return null;
    if (y > -86 && dth(x, y) > 1 - (y + 86) / (bot(x) + 92)) return null;
    if (y < -131 && Math.abs(x) < (y + 141) * 0.6) return null;                    // вырез ворота
    let col = r < -0.72 ? K4 : r > 0.82 ? K5 : y < -120 && r > 0.1 && r < 0.45 ? K7 : K6;
    if (y > -108 && ((((x - cx) / (hw / 4) + Math.sin(y * 0.08 + ph) * 0.3) % 1 + 1) % 1) < 0.16) col = r < 0 ? K4 : K5;   // складки
    if (y > -128 && y < -116 && Math.abs(x) < 10 && (y + 128) % 4 === 0) col = K5;   // рёбра сквозь ткань
    if (y > -92 && dth(x, y) < (y + 92) / 34) col = y > -76 && dth(x + 1, y) < (y + 76) / 30 ? K2 : K3;   // гарь и пыль
    if (y >= -82 && y <= -78) { const q = Math.abs(((x + 60) % 6) - 3) + Math.abs(y + 80); if (q <= 2) col = q < 1 ? RED2 : RED; }   // вышивка по подолу
    return col;
  });
  // ворот: кожа, ключицы, яремная впадина; красная вышивка по кромке
  R(-8, -141, 8, -131, (x, y) => {
    const v = (y + 141) * 0.6;
    if (Math.abs(x) >= v) return Math.abs(x) < v + 1.6 && y > -140 ? (((x + y) & 1) ? RED : RED2) : null;
    if (y === -136 && Math.abs(x) > 1) return S1;
    if (Math.abs(x) <= 1 && y > -139 && y < -135) return S0;
    return y > -134 ? S1 : S2;
  });
  // пояс и концы пояса, треплет ветром назад
  R(-16, -112, 16, -106, (x, y) => Math.abs(x) <= hwAt(y) ? (y === -112 ? RED2 : y === -106 ? [96, 28, 16] : (x + y) % 5 === 0 ? RED2 : RED) : null);
  for (const [o, l] of [[0, 30], [3, 24]]) L(-6 + o, -108, -20 - o + Math.sin(ph + o) * 5, -108 + l, 2.2, 1.4, (t, e) => e ? [96, 28, 16] : t > 0.85 && dth(o, l) < 0.5 ? RED2 : RED);

  // ---- руки, кисти с когтями, серп
  const S = [[-16, -134], [16, -134]];
  const pose = [
    { L: [-34, -94, Math.PI / 2 + 0.3], R: [34, -100, Math.PI / 2 - 0.25] },
    { L: [-40, -142, -Math.PI / 2 - 0.55], R: [24, -186, -Math.PI / 2 - 0.65] },
    { L: [-44, -124, Math.PI + 0.15], R: [50, -116, 0.35] },
  ][lv];
  if (hit) R(-30, -200, 80, -60, (x, y) => {                                        // след удара серпом
    const dx = x - 14, dy = y + 136, d = Math.sqrt(dx * dx + dy * dy), a = Math.atan2(dy, dx);
    if (a < -2.1 || a > 0.55 || Math.abs(d - 60) > 2.5 + (a + 2.1) * 1.2) return null;
    const t = (a + 2.1) / 2.65;
    return dth(x, y) < t ? [...(Math.abs(d - 60) < 1.5 ? K7 : K5), 0.4 + t * 0.5] : null;
  }, false);
  const arm = (s, h) => {
    const [sx, sy] = S[s < 0 ? 0 : 1], [hx, hy] = h, mx = (sx + hx) / 2, my = (sy + hy) / 2;
    let nx = -(hy - sy), ny = hx - sx; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
    if (nx * s < 0) { nx = -nx; ny = -ny; }
    const ex = mx + nx * 7, ey = my + ny * 7 + 2;
    // рукав до локтя: широкий, с лохмотьями и вышитой полосой
    L(sx, sy, ex, ey, 6, 4.5, (t, e, sd) => e ? K4 : t > 0.72 && t < 0.86 ? (((sd | 0) & 2) ? RED : RED2) : sd * s > 0 ? K5 : K6);
    for (let k = 0; k < 4; k++) L(ex - 3 + k * 2, ey + 2, ex - 3 + k * 2 + Math.sin(ph + k) * 2, ey + 5 + hsh(k + s) * 6, 1, 0.5, () => k & 1 ? K4 : K5);
    // костлявое предплечье
    L(ex, ey, hx, hy, 3, 2.2, (t, e, sd) => e ? (sd * s > 0 ? S0 : S1) : t < 0.12 ? S3 : sd * s < -30 ? S3 : S2);
    R(hx - 4, hy - 4, hx + 4, hy + 4, (x, y) => { const d = (x - hx) ** 2 + (y - hy) ** 2; return d <= 12 ? (d > 8 ? S1 : S2) : null; });
    return [ex, ey];
  };
  const claw = (hx, hy, dir, side) => {                                               // ладонь, четыре пальца веером и большой, длинные загнутые когти
    for (const j of [-1.5, -0.5, 0.5, 1.5, -3.2]) {
      const thumb = j < -2, a = dir + j * (thumb ? 0.4 : 0.36) * side, a2 = a + 0.2 * side;
      const l1 = thumb ? 4.5 : Math.abs(j) > 1 ? 6 : 7.5, l2 = thumb ? 3.5 : Math.abs(j) > 1 ? 4.5 : 5.5;
      const bx = hx + Math.cos(a) * 2.5, by = hy + Math.sin(a) * 2.5;
      const x1 = bx + Math.cos(a) * l1, y1 = by + Math.sin(a) * l1, x2 = x1 + Math.cos(a2) * l2, y2 = y1 + Math.sin(a2) * l2;
      L(bx, by, x1, y1, 1.3, 1.1, (t, e) => e ? S1 : S2);
      P(x1, y1, S0);
      L(x1, y1, x2, y2, 1.1, 0.9, (t, e) => e ? S1 : S3);
      const a3 = a2 + 0.45 * side, cl = thumb ? 4 : 6.5;
      L(x2, y2, x2 + Math.cos(a3) * cl, y2 + Math.sin(a3) * cl, 1.2, 0.2, (t, e) => t > 0.8 ? K0 : e ? K1 : t < 0.4 ? K2 : K1);
    }
  };
  // серп: рукоять поперёк кулака, от кольца клинок идёт вперёд и закручивается крюком (кривизна растёт к острию), шире всего в первой трети
  const sickle = (hx, hy, a) => {
    const ux = Math.cos(a), uy = Math.sin(a);
    L(hx - ux * 8, hy - uy * 8, hx + ux * 9, hy + uy * 9, 2.2, 2, (t, e) => e ? [70, 38, 18] : t < 0.08 ? [70, 38, 18] : [118, 70, 34]);   // рукоять
    L(hx + ux * 8.5, hy + uy * 8.5, hx + ux * 11, hy + uy * 11, 2.5, 2.5, (t, e) => e ? I0 : I1);                                          // кольцо
    const sg = -Math.sin(a + Math.PI / 2) > -Math.sin(a - Math.PI / 2) ? 1 : -1, N = 40, pts = [];
    let x = hx + ux * 11, y = hy + uy * 11, d = a;
    for (let i = 0; i <= N; i++) {
      const t = i / N, w = t < 0.3 ? 3 + t * 5.5 : 4.65 * (1 - (t - 0.3) / 0.7) + 0.25;
      pts.push([x, y, w]);
      d += sg * (t < 0.1 ? 0.02 : 0.095); x += Math.cos(d) * 1.35; y += Math.sin(d) * 1.35;   // короткое горло, дальше ровная дуга ~200° — серп-«вопросик»
    }
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0, w0] = pts[i - 1], [x1, y1, w1] = pts[i], t0 = (i - 1) / N;
      L(x0, y0, x1, y1, w0, w1, (t, e, sd) => {
        const inner = sd * sg > 0;
        if (e && !inner) return I0;                                                     // обух
        if (e && inner) return t0 > 0.25 && t0 < 0.8 && hsh(x0 * 3 + y0) > 0.55 ? K7 : I3;   // жало блестит на солнце
        return hsh(Math.round(x0) * 7 + Math.round(y0) * 13 + (sd > 0 ? 1 : 0)) > 0.86 ? RU : inner ? I2 : [128, 116, 102];   // ржа
      });
    }
  };
  // дальняя (левая) рука — когтистая пятерня
  arm(-1, pose.L);
  claw(pose.L[0], pose.L[1], pose.L[2], -1);

  // ---- шея: тонкая, жилистая
  R(-4, -150, 4, -136, (x, y) => Math.abs(x) <= 3 ? (Math.abs(x) === 3 ? S1 : x === -1 && y > -146 ? S1 : S2) : null);

  // ---- голова: шапка соломенных волос с пробором, венок, лицо-череп
  R(-18, HY - 22, 18, HY + 14, (x, y) => {
    const dx = x / 17.5, dy = (y - HY + 2) / 20;
    if (dx * dx + dy * dy > 1) return null;
    const st = (((Math.atan2(x, y - HY + 26) * 10) % 1) + 1) % 1;
    return x === 0 && y < HY - 12 ? K2 : st < 0.3 ? K3 : st < 0.65 ? K4 : K5;
  });
  const jaw = hit ? 25 : lv === 1 ? 20 : 18;
  const face = (x, y) => { const dx = (x + 0.5) / 14, dy = (y - HY) / (y > HY ? jaw : 15); return dx * dx * (1 + Math.max(0, dy) * 0.9) + dy * dy <= 1 && y >= HY - 12; };
  R(-15, HY - 13, 15, HY + jaw + 1, (x, y) => {
    if (!face(x, y)) return null;
    const ax = Math.abs(x + 0.5), edge = !face(x + (x < 0 ? -1 : 1), y) || !face(x, y + 1);
    if (edge) return S0;
    const ch = (ax - 9.5) ** 2 * 0.7 + (y - HY - 7) ** 2;
    if (ch < 10) return ch < 4 ? S0 : S1;                                               // впалые щёки
    if (ax > 11) return S1;
    if ((ax - 9) ** 2 + (y - HY - 1.5) ** 2 < 4) return S4;                             // скулы
    if (y < HY - 7 && ax < 7) return S4;
    return y > HY + 12 ? S2 : S3;
  });
  for (const [x, y] of [[-4, HY - 11], [-3, HY - 10], [-3, HY - 9], [-2, HY - 8], [5, HY - 11], [6, HY - 10], [6, HY - 9], [11, HY + 4], [10, HY + 5], [10, HY + 6], [-11, HY + 9], [-10, HY + 10]]) P(x, y, S1);   // трещины от зноя
  // глазницы: глубокие, с раскалённой точкой; брови сведены злобно
  for (const s of [-1, 1]) {
    const ex = s * 6 - (s < 0 ? 1 : 0), ey = HY - 1;
    R(ex - 6, ey - 5, ex + 6, ey + 5, (x, y) => { const d = ((x - ex) / 4.8) ** 2 + ((y - ey) / 4) ** 2; return d <= 1 ? (blink ? (y === ey ? S0 : S1) : K0) : d <= 1.45 ? S0 : null; });
    if (!blink) {
      const g = hit ? 1.6 : 1.1, cy = ey + 0.5;
      R(ex - 3, cy - 3, ex + 3, cy + 3, (x, y) => { const d = Math.hypot(x - ex, y - cy); return d < g ? K7 : d < g + 1 ? K5 : d < g + 2 && dth(x, y) < 0.5 ? K3 : null; });
      if (hit) R(ex - 7, ey - 7, ex + 7, ey + 7, (x, y) => { const d = Math.hypot(x - ex, y - ey); return d > 5.5 && d < 7 && dth(x, y) < 0.35 ? [...K6, 0.55] : null; }, false);
    }
    L(ex - s * 4, HY - 6, ex + s * 5, HY - 10, 0.9, 0.7, (t, e) => e ? K1 : K0);      // бровь: внутренний край ниже — злоба
  }
  // нос черепа: провал
  P(-1, HY + 3, S1); P(-1, HY + 4, S1);
  for (const [x, y] of [[-3, HY + 6], [-2, HY + 6], [1, HY + 6], [0, HY + 6], [-2, HY + 7], [-1, HY + 7], [0, HY + 7], [-1, HY + 8]]) P(x, y, K0);
  // рот
  const MY = HY + 12;
  if (lv === 0) {                                                                     // безгубый растянутый оскал до ушей
    for (let x = -10; x <= 9; x++) {
      const ax = Math.abs(x + 0.5), up = ax > 7 ? Math.round(ax - 7) : 0;
      P(x, MY - up, K0); P(x, MY + 2 - up, K0);
      P(x, MY + 1 - up, ax > 8 ? K0 : x & 1 ? K5 : K6);
      if (ax < 7 && !(x & 1)) { P(x, MY - 1, S0); P(x, MY + 3, S0); }
    }
  } else {
    const ry = hit ? 9 : 4, my = MY + (hit ? 5 : 2);
    R(-10, my - ry - 1, 9, my + ry + 1, (x, y) => {
      const d = ((x + 0.5) / 7.5) ** 2 + ((y - my) / ry) ** 2;
      if (d > 1) return d < 1.35 ? S0 : null;
      const tt = y - (my - ry), bb = my + ry - y, tl = (x & 1) ? 2 : hit ? 5 : 2;     // клыки сверху и снизу, длинные в ударе
      if (Math.abs(x + 0.5) < 7 && (tt < tl || bb < (hit ? ((x & 1) ? 4 : 1.5) : 1.5))) return (x & 1) ? K5 : K6;
      return d < 0.35 && hit ? [110, 24, 12] : K0;
    });
  }
  // венок: колосья веером (зерно в три ряда, ости), жгут из соломы, кровавые маки
  for (let k = 0; k < 9; k++) {
    const a = (k - 4) * 0.28 + Math.sin(ph + k) * 0.05, bx = Math.sin(a) * 16, by = HY - 16 - Math.cos(a) * 2, len = 10 + (k % 2 ? 0 : 3) + (k === 4 ? 2 : 0);
    const ux = Math.sin(a * 1.15), uy = -Math.cos(a * 1.15);
    L(bx, by, bx + ux * 3, by + uy * 3, 0.6, 0.6, () => K3);
    for (let m = 3; m < len; m += 2) {
      const x = bx + ux * m, y = by + uy * m, w = m < len - 2 ? 1.4 : 0.6;
      P(x - uy * w, y + ux * w, K5); P(x + uy * w, y - ux * w, K3); P(x, y, K4); P(x + ux, y + uy, K2);
    }
    const tx = bx + ux * len, ty = by + uy * len;
    for (const o of [-0.35, 0, 0.35]) for (let m = 1; m < 7; m++) if (dth(Math.round(tx + o * 9), m) < 1 - m / 8) P(tx + Math.sin(a * 1.15 + o) * m, ty - Math.cos(a * 1.15 + o) * m, K6, 0.8);   // ости
  }
  R(-19, HY - 21, 19, HY - 11, (x, y) => { const d = (x / 18) ** 2 + ((y - HY + 16) / 3.6) ** 2; return d <= 1 && y >= HY - 17 ? (((x + y) % 3 + 3) % 3 === 0 ? K2 : (x + y) & 1 ? K3 : K4) : null; });
  for (const s of [-1, 1]) R(s * 12 - 3, HY - 20, s * 12 + 3, HY - 13, (x, y) => { const d = (x - s * 12) ** 2 + (y - HY + 16) ** 2; return d <= 1 ? K0 : d <= 5 ? (y < HY - 16 ? RED2 : RED) : d <= 8 ? [110, 26, 14] : null; });
  // пряди спереди: от висков падают на плечи и грудь, обрамляют лицо
  for (let k = 0; k < 4; k++) strand(k, false);

  // ---- ближняя (правая) рука с серпом
  const [rex, rey] = arm(1, pose.R), fa = Math.atan2(pose.R[1] - rey, pose.R[0] - rex);
  const ha = [fa + Math.PI / 2 - 0.35, fa - Math.PI / 2 + 0.35].reduce((b, c) => Math.cos(c) * 0.6 - Math.sin(c) > Math.cos(b) * 0.6 - Math.sin(b) ? c : b);   // рукоять поперёк кулака, вперёд-вверх
  sickle(pose.R[0], pose.R[1], ha);
  R(pose.R[0] - 4, pose.R[1] - 4, pose.R[0] + 4, pose.R[1] + 4, (x, y) => { const d = (x - pose.R[0]) ** 2 + (y - pose.R[1]) ** 2; return d <= 10 ? (d > 6 ? S1 : S2) : null; });   // кулак на рукояти
  for (const j of [-1, 0, 1]) {                                                       // когти поверх рукояти
    const a = fa, x = pose.R[0] + Math.cos(ha) * j * 2.2 + Math.cos(a) * 2.5, y = pose.R[1] + Math.sin(ha) * j * 2.2 + Math.sin(a) * 2.5;
    L(x, y, x + Math.cos(a - 0.6) * 4, y + Math.sin(a - 0.6) * 4, 1, 0.2, t => t > 0.7 ? K0 : K1);
  }

  // ---- передние половины петель вихря и полова
  loops(true); chaff(true);

  K.outline([58, 24, 8]);                                                         // обводка: тёплая тёмно-бурая, без чёрного
  return K.done();
}
function fzNoonSprite(lv, p) { return fzPxSprite('noon' + lv + p, 60, 88, 30, 80, () => fzNoonPx(lv, p)); }
// Кадр Полудницы по времени кружения над жертвой: замах — удар серпом — опускание — покой
const fzNoonLv = t => { const s = t % 2.2; return s < 0.45 ? 1 : s < 0.8 ? 2 : s < 1.05 ? 1 : 0; };
// Огонёк рисуется мягкой кистью
function fzWispDraw(c, w) {
  const px = Math.round(w.x * TILE), py = Math.round(w.y * TILE - 16 + Math.sin(w.ph) * 4), r = 9 + Math.sin(w.ph * 2.3) * 1.5;
  c.save(); c.globalAlpha *= w.alpha; c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(px, py, 0, px, py, r * 2.2); g.addColorStop(0, 'rgba(210,255,240,0.95)'); g.addColorStop(0.3, 'rgba(110,240,200,0.5)'); g.addColorStop(1, 'rgba(60,200,180,0)');
  c.fillStyle = g; c.beginPath(); c.arc(px, py, r * 2.2, 0, 7); c.fill();
  c.restore();
}

// ---------- Главный тик ----------
function fairy2Tick(dt) {
  if (!FZ_ON() || !startOpen('fairy2')) return;
  const F = fz();
  F.acc = (F.acc || 0) + dt;
  fzSelfStep(F, dt);
}
function fzSelfStep(F, dt) {
  const ni = nightIndex(), eve = isEveningNow(), dawn = isDawnNow();
  if (eve && !dawn && F.night !== ni) { F.night = ni; fzSpawnNight(); }
  const act = fzDark() > 0.35 && !dawn;
  F.over = dawn || (!eve && !isNightNow());       // ночь кончилась: можно убирать с карты
  F.acc2 = (F.acc2 || 0) + dt;
  if (F.acc2 >= 0.4) { fzCutScan(F); F.acc2 = 0; }
  fzLeshyTick(F, dt);
  for (let i = F.kik.length - 1; i >= 0; i--) {
    const k = F.kik[i];
    if (fzKikTick(F, k, dt, act)) { fzKikCleanup(k); F.kik.splice(i, 1); }
  }
  if (F.pond && fzPondTick(F, F.pond, dt, act)) F.pond = null;
  fzBansheeTick(F, act, dt);
  fzWolvesTick(F, act, dt);
  fzWispsTick(F, act, dt);
  fzNoonTick(F, dt);
}

// ---------- Банши и волк: рисуются «призрачно» (мягкая кисть, как призраки в ghosts.js) один раз в 3× холсты ----------
const FZ_SS = 3, FZ_CVC = {};
function fzCanvas(key, w, h, ox, oy, draw) {
  let cv = FZ_CVC[key];
  if (cv) return cv;
  cv = FZ_CVC[key] = document.createElement('canvas');
  cv.width = w * FZ_SS; cv.height = h * FZ_SS; cv.fzO = [ox, oy, w, h];
  const c = cv.getContext('2d');
  c.scale(FZ_SS, FZ_SS); c.translate(ox, oy); c.lineJoin = 'round'; c.lineCap = 'round';
  draw(c);
  return cv;
}
// Набор для ручного пиксель-арта нечисти на сетке W×H (начало координат — OX, OY): пиксель с альфой и маской «твёрдого»,
// заливка по условию, толстая линия с сужением, дизеринг Байера, хэш-шум, тёплая/холодная обводка по маске в конце.
function fzPxKit(W, H, OX, OY) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d'), img = c.createImageData(W, H), D = img.data, SOL = new Uint8Array(W * H);
  const K = {
    cv, W, H,
    dth: (x, y) => (FZ_B4[(Math.round(y) + OY) & 3][(Math.round(x) + OX) & 3] + 0.5) / 16,
    hsh: n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); },
    P(x, y, col, a = 1, sol = true) {
      x = Math.round(x) + OX; y = Math.round(y) + OY;
      if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
      const i = (y * W + x) * 4, da = D[i + 3] / 255, oa = a + da * (1 - a);
      for (let k = 0; k < 3; k++) D[i + k] = Math.round((col[k] * a + D[i + k] * da * (1 - a)) / oa);
      D[i + 3] = Math.round(oa * 255);
      if (sol) SOL[y * W + x] = 1;
    },
    // заливка по условию: f(x, y) → цвет [r, g, b] или [r, g, b, a], либо null
    R(x0, y0, x1, y1, f, sol = true) {
      for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
        const col = f(x, y);
        if (col) K.P(x, y, col, col[3] === undefined ? 1 : col[3], sol);
      }
    },
    // толстая линия с сужением: f(t, край, сторона) → цвет
    L(x0, y0, x1, y1, r0, r1, f, sol = true) {
      const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1, rm = Math.max(r0, r1) + 1;
      K.R(Math.min(x0, x1) - rm, Math.min(y0, y1) - rm, Math.max(x0, x1) + rm, Math.max(y0, y1) + rm, (x, y) => {
        const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / l2)), ex = x - x0 - dx * t, ey = y - y0 - dy * t, r = r0 + (r1 - r0) * t, d = Math.sqrt(ex * ex + ey * ey);
        return d <= r ? f(t, d > r - 1, ex * dy - ey * dx) : null;
      }, sol);
    },
    // ломаная по точкам [[x, y, r], …]
    path(pts, f, sol = true) {
      for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], n = pts.length - 1; K.L(a[0], a[1], b[0], b[1], a[2], b[2], (t, e, s) => f((i - 1 + t) / n, e, s), sol); }
    },
    // обводка по маске твёрдых пикселей, цветная (не чёрная)
    outline(col, a = 0.92) {
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (SOL[i] || !(SOL[i - 1] || SOL[i + 1] || SOL[i - W] || SOL[i + W])) continue;
        const j = i * 4, da = D[j + 3] / 255, oa = a + da * (1 - a);
        for (let k = 0; k < 3; k++) D[j + k] = Math.round((col[k] * a + D[j + k] * da * (1 - a)) / oa);
        D[j + 3] = Math.round(oa * 255);
      }
    },
    done() { c.putImageData(img, 0, 0); return cv; },
  };
  return K;
}
// Пиксельный спрайт сетки (×3 мельче мирового) → 3× холст 1:1 без сглаживания
function fzPxSprite(key, w, h, ox, oy, make) {
  if (FZ_CVC[key]) return FZ_CVC[key];
  const px = make();
  const cv = fzCanvas(key, w, h, ox, oy, c => { c.imageSmoothingEnabled = false; c.drawImage(px, -ox, -oy, w, h); });
  cv.fzPx = true;
  return cv;
}
const FZ_B4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
// Банши: плакальщица в рваном саване под тёмным острым капюшоном. Пиксель-арт 192×252 (×3 мельче мирового 64×84), рисуется 1:1 в 3× холст.
// Лицо — обтянутый череп: скорбные брови домиком, глубокие глазницы с ледяными огоньками, светящиеся дорожки слёз; в крике челюсть отвисает
// в длинную воющую пасть, от неё расходятся волны звука. В груди — тёмная пустота с огоньком души. Седые космы, тощие руки, пальцы веером с когтями.
// lv — стадия крика: 0 покой, 1 замах (руки поднимаются, рот приоткрыт; так же опускаются), 2 крик. p — фаза парения (0..11); в покое на фазе 7 глаза закрыты.
function fzBansheePx(lv, p) {
  const K = fzPxKit(192, 252, 96, 90), { P, R, L, dth, hsh } = K;
  const ph = p / 12 * Math.PI * 2, wail = lv === 2, kk = lv / 2, lerp = (a, b) => a + (b - a) * kk, blink = lv === 0 && p === 7, HY = -27;
  const C0 = [6, 14, 24], C1 = [14, 30, 52], C3 = [60, 100, 150], C4 = [104, 150, 204], C5 = [152, 198, 230], C6 = [205, 232, 246], C7 = [240, 252, 255];
  const G1 = [110, 240, 220], G2 = [200, 255, 244];
  const F0 = [52, 74, 106], F1 = [104, 134, 168], F2 = [156, 186, 212], F3 = [200, 222, 238], F4 = [230, 244, 252];
  const H0 = [14, 24, 40], H1 = [28, 46, 72], H2 = [46, 72, 104];
  const cxAt = y => Math.sin(ph - y * 0.043) * (1.2 + Math.max(0, y) * 0.06);
  const hwAt = y => y < 12 ? 20 + (y + 6) * 0.4 : y < 40 ? 27 : 27 - (y - 40) * 0.12;
  const bot = x => 104 + Math.floor(hsh(Math.floor(x / 3) * 3.1) * 44) + Math.round(Math.sin(ph + x * 0.37) * 5);

  // холодная дымка вокруг савана
  R(-46, -10, 46, 140, (x, y) => {
    const cx = cxAt(y), hw = hwAt(y) + 1, d = Math.abs(x - cx) - hw;
    if (d < 0 || d > 6) return null;
    return dth(x, y) < (1 - d / 6) * (1 - y / 150) * 0.55 ? [120, 235, 235, 0.3] : null;
  }, false);
  // рваные лоскуты по бокам хвоста, треплются
  for (const [y0, len, sw] of [[56, 40, 15], [84, 46, 24], [108, 30, 15]]) for (const s of [-1, 1]) {
    const pts = [];
    for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push([s * (hwAt(y0) - 3 + sw * t * t + Math.sin(ph + y0 + t * 3) * 4 * t) + cxAt(y0), y0 + t * len, 4 * (1 - t) + 0.6]); }
    K.path(pts, (t, e) => dth(t * 40, t * 60) > 1 - t * 0.8 ? null : e ? [...C3, 0.7 - t * 0.3] : [...C4, 0.75 - t * 0.35], false);
  }
  // саван: сверху светлый, книзу темнее и прозрачнее; складки, кромки, распад в дымку
  R(-34, -6, 34, 152, (x, y) => {
    const cx = cxAt(y), hw = hwAt(y), r = (x - cx) / hw;
    if (Math.abs(r) > 1 || y > bot(x)) return null;
    const a = y < 70 ? 1 : 1 - (y - 70) / (bot(x) + 14 - 70);
    if (a < 1 && dth(x, y) > a) return null;
    let col = y < 30 ? C6 : y < 66 ? C5 : y < 100 ? C4 : C3;
    const fold = ((((x - cx) / 4.5 + Math.sin(y * 0.07 + ph + (r > 0 ? 1 : 0)) * 0.4) % 1) + 1) % 1 < 0.2;
    if (Math.abs(r) > 0.9) col = y < 66 ? C4 : C3; else if (fold) col = y < 30 ? C5 : y < 66 ? C4 : C3; else if (r > -0.35 && r < -0.15 && y < 66) col = C7;
    if (y > 9 && y < 22 && Math.abs(Math.abs(r) - 0.6) < 0.05) col = C4;               // сгиб на плечах
    return [...col, y < 30 ? 0.96 : y < 66 ? 0.9 : 0.78];
  });
  // тёмная пустота в груди, внутри — огонёк души
  R(-20, 6, 20, 54, (x, y) => {
    const d = Math.hypot((x + 0.5) / 16, (y - 30) / 20);
    return d < 0.6 ? [5, 18, 34, 0.86] : d < 1 && dth(x, y) > d ? [5, 18, 34, 0.55] : null;
  });
  const fl = Math.sin(ph * 2) * 1.5;
  R(-7, 18, 7, 40, (x, y) => {
    const dy = (y - 32) / 7, w = (1 - Math.abs(dy)) * (dy < 0 ? 3.5 + dy * 2.5 : 4) + 0.5, sx = (x + 0.5 - Math.sin(ph + y * 0.3) * (y < 30 ? 1 : 0)) ;
    if (Math.abs(dy) > 1.2 || Math.abs(sx) > w) return null;
    const v = Math.abs(sx) / w;
    return v < 0.4 && dy > -0.6 ? G2 : v < 0.8 ? G1 : [...G1, 0.5];
  });
  for (let k = 0; k < 3; k++) P(Math.sin(ph * 3 + k * 2) * 3, 22 - k * 4 + fl, G2, 0.6 - k * 0.15, false);
  // тёмные прорехи савана (парные)
  for (const [x, y, h] of [[12, 52, 15], [18, 76, 12], [6, 82, 15]]) for (const s of [-1, 1]) L(s * x + cxAt(y), y, s * (x + h / 3) + cxAt(y), y + h, 1.6, 0.6, () => [6, 20, 36, 0.62]);

  // седые космы сзади
  for (let k = 0; k < 12; k++) {
    const s = k % 2 ? 1 : -1, i = k >> 1, len = 64 + i * 9 + (kk * 6 | 0), top = HY - 22 + i * 4, pts = [];
    for (let m = 0; m <= 10; m++) { const t = m / 10; pts.push([s * (15 + i * 2.4 + t * (i + 2) * 1.6 + Math.sin(ph + t * 4 + k) * 3 * t), top + t * len, 2.6 - t * 1.6]); }
    K.path(pts, (t, e) => dth(k * 5, t * 50) > 1 - t * t ? null : e ? C3 : (k & 2) ? C4 : C5);
  }
  // капюшон: стрельчатая макушка, зубчатая рваная кромка на плечах, глубокая тень вокруг лица
  R(-38, HY - 46, 38, 18, (x, y) => {
    const ax = Math.abs(x + 0.5), t = Math.min(1, (y - (HY - 46)) / 40), hw = 3 + 31 * Math.pow(Math.sin(t * Math.PI / 2), 0.7) + (y > 0 ? 2 : 0);
    if (ax > hw || y < HY - 46) return null;
    const saw = Math.abs(((ax / 6) % 1) - 0.5) * 2;
    if (y > 4 + saw * 12 + K.hsh(Math.floor(ax / 6)) * 4) return null;                 // зубья кромки
    if (ax > hw - 1.5) return H2;
    const inner = Math.hypot(ax / 19, (y - HY + 2) / 24);
    return inner < 1 ? H0 : y < HY - 24 ? H1 : (ax * 2 + y) % 11 === 0 ? H2 : H1;
  });
  // лицо: обтянутый череп
  const jaw = wail ? 38 : lv === 1 ? 24 : 20;
  const face = (x, y) => { const dx = (x + 0.5) / 14, dy = (y - HY) / (y > HY ? jaw : 17); return dx * dx * (1 + Math.max(0, dy) * 1.1) + dy * dy <= 1 && y >= HY - 15; };
  R(-15, HY - 16, 15, HY + jaw + 1, (x, y) => {
    if (!face(x, y)) return null;
    const ax = Math.abs(x + 0.5), edge = !face(x + (x < 0 ? -1 : 1), y) || !face(x, y + 1);
    if (edge) return F0;
    const ch = (ax - 10) ** 2 * 0.7 + (y - HY - 8) ** 2;
    if (ch < 12) return ch < 5 ? F0 : F1;                                              // впалые щёки
    if (ax > 11.5) return F1;
    if ((ax - 9.5) ** 2 + (y - HY - 1) ** 2 < 4) return F4;                            // скулы
    if (y < HY - 8 && ax < 8) return F4;
    return y > HY + 14 ? F2 : F3;
  });
  // глазницы, огоньки, брови домиком (скорбь), слёзы
  for (const s of [-1, 1]) {
    const ex = s * 6.5 - 0.5, ey = HY - 2;
    R(ex - 6, ey - 5, ex + 6, ey + 6, (x, y) => { const d = ((x - ex) / 5) ** 2 + ((y - ey) / 4.4) ** 2; return d <= 1 ? (blink ? (y === ey + 1 ? F0 : F1) : C0) : d <= 1.5 ? F0 : null; });
    if (!blink) {
      const g = wail ? 1.7 : 1.1;
      R(ex - 4, ey - 3, ex + 4, ey + 4, (x, y) => { const d = Math.hypot(x - ex, y - ey - 0.5); return d < g ? G2 : d < g + 1 ? G1 : d < g + 2 && dth(x, y) < 0.5 ? [...G1, 0.6] : null; });
      if (wail) R(ex - 8, ey - 8, ex + 8, ey + 8, (x, y) => { const d = Math.hypot(x - ex, y - ey); return d > 5.5 && d < 7.5 && dth(x, y) < 0.3 ? [...G1, 0.5] : null; }, false);
    }
    L(ex - s * 4, HY - 12.5, ex + s * 5.5, HY - 6.5, 1.4, 0.8, t => t < 0.5 ? C0 : C1);     // бровь: внутренний край выше — скорбь
    L(ex + s * 1.5, ey + 5, ex + s * 2.5 + Math.sin(ph) * 0.4 * s, HY + 18 + (wail ? 6 : 0), 1, 0.6, t => [...G1, 0.8 - t * 0.4]);   // слеза
    if (dth(s * 3, p) < 0.6) P(ex + s * 2.5, HY + 20 + (wail ? 6 : 0) + (p % 3), G2, 0.7, false);
  }
  // нос черепа
  P(-1, HY + 4, F1); P(-1, HY + 5, F1);
  for (const [x, y] of [[-3, HY + 7], [-2, HY + 7], [0, HY + 7], [1, HY + 7], [-2, HY + 8], [-1, HY + 8], [0, HY + 8], [-1, HY + 9]]) P(x, y, C0);
  // рот
  if (lv === 0) {                                                                     // скорбно опущенные уголки, щель между губ
    for (let x = -7; x <= 6; x++) { const ax = Math.abs(x + 0.5), dn = ax > 4 ? Math.round((ax - 4) * 0.6) : 0; P(x, HY + 13 + dn, C0); P(x, HY + 12 + dn, F1); P(x, HY + 14 + dn, F1); }
  } else {
    const ry = wail ? 17 : 5, my = HY + 13 + ry * 0.75, rx = wail ? 7 : 6;
    R(-rx - 2, my - ry - 1, rx + 1, my + ry + 1, (x, y) => {
      const d = ((x + 0.5) / rx) ** 2 + ((y - my) / ry) ** 2;
      if (d > 1) return d < 1.3 ? F0 : null;
      const tt = y - (my - ry);
      if (Math.abs(x + 0.5) < rx - 1.5 && tt < ((x & 1) ? 1.5 : 3)) return C6;           // редкие верхние зубы
      if (wail && my + ry - y < ((x & 1) ? 2.5 : 1)) return C5;
      return d < 0.45 ? [10, 40, 60] : C0;
    });
    if (wail) for (let k = 0; k < 3; k++) {                                           // волны крика
      const r = 10 + k * 9 + (p % 4) * 2.2;
      R(-r - 2, my - r * 0.5, r + 2, my + r * 1.2, (x, y) => {
        const d = Math.hypot(x + 0.5, (y - my) * 1.25);
        if (Math.abs(d - r - 18) > 1) return null;
        const a = Math.atan2(y - my, x + 0.5);
        return a > 0.5 && a < 2.64 && dth(x, y) < 0.8 - k * 0.2 ? [...G1, 0.55 - k * 0.12] : null;
      }, false);
    }
  }
  // передние пряди у висков
  for (let k = 0; k < 4; k++) {
    const s = k % 2 ? 1 : -1, i = k >> 1, pts = [];
    for (let m = 0; m <= 8; m++) { const t = m / 8; pts.push([s * (13 + i * 3 + t * 3 + Math.sin(ph + t * 3 + k) * 2 * t), HY - 10 + i * 3 + t * (40 + i * 10), 1.8 - t]); }
    K.path(pts, (t, e) => dth(k * 7, t * 40) > 1 - t * t ? null : e ? C4 : i ? C5 : C6);
  }
  // руки: широкий рваный рукав тает в тощее предплечье; кисть — ладонь и четыре пальца веером с белыми когтями
  const sw1 = Math.sin(ph) * 3, sw2 = Math.sin(ph * 2) * 2;
  for (const s of [-1, 1]) {
    const sx = s * 21, sy = 15, hx = s * (lerp(33, 37) + sw1), hy = lerp(36, -44) + sw2;
    const ex = (sx + hx) / 2 + s * 12, ey = (sy + hy) / 2 + lerp(8, 2);
    L(sx, sy, ex, ey, 8, 6, (t, e, sd) => e ? C4 : sd * s > 0 ? C5 : C6);
    for (let k = 0; k < 5; k++) {                                                     // лохмотья рукава
      const bx = ex - 6 + k * 3, by = ey + 4, l = 8 + K.hsh(k + s) * 12;
      L(bx, by, bx + Math.sin(ph + k) * 3 - s * 2, by + l, 1.4, 0.4, t => dth(bx, by + t * l) < 1 - t * 0.7 ? [...(k & 1 ? C4 : C5), 0.85] : null);
    }
    L(ex, ey, hx, hy, 3.2, 2.4, (t, e, sd) => e ? (sd * s > 0 ? F0 : F1) : t < 0.12 ? F4 : F2);
    R(hx - 5, hy - 5, hx + 5, hy + 5, (x, y) => { const d = (x - hx) ** 2 + (y - hy) ** 2; return d <= 16 ? (d > 10 ? F1 : F3) : null; });
    const dir = Math.atan2(hy - ey, hx - ex);
    for (const j of [-1.5, -0.5, 0.5, 1.5]) {
      const a = dir + j * 0.4, l1 = Math.abs(j) > 1 ? 8 : 10, l2 = Math.abs(j) > 1 ? 6 : 8, a2 = a - j * 0.25;
      const bx = hx + Math.cos(a) * 3, by = hy + Math.sin(a) * 3, x1 = bx + Math.cos(a) * l1, y1 = by + Math.sin(a) * l1, x2 = x1 + Math.cos(a2) * l2, y2 = y1 + Math.sin(a2) * l2;
      L(bx, by, x1, y1, 1.4, 1.1, (t, e) => e ? F1 : F3);
      P(x1, y1, F0);
      L(x1, y1, x2, y2, 1.1, 0.9, (t, e) => e ? F1 : F4);
      const a3 = a2 - j * 0.3;
      L(x2, y2, x2 + Math.cos(a3) * 7, y2 + Math.sin(a3) * 7, 1.1, 0.2, t => t > 0.75 ? C7 : C6);
    }
  }
  K.outline([12, 26, 46]);
  return K.done();
}
function fzBansheeSprite(lv, p) { return fzPxSprite('ban' + lv + '_' + p, 64, 84, 32, 30, () => fzBansheePx(lv, p)); }
// Призрачный волк: тощий, горбатый, ощеренный — вздыбленный загривок шипами, видны рёбра и впалое брюхо, череп-морда с отвисшей челюстью и клыками,
// злой прищур с ледяным огоньком. Хвост и лапы рассыпаются в дымку. Пиксель-арт 252×162 (×3 мельче мирового 84×54), рисуется 1:1 в 3× холст.
// f — кадр бега 0..3, howl — морда вверх (вой).
function fzWolfPx(f, howl) {
  const K = fzPxKit(252, 162, 118, 138), { P, R, L, dth, hsh } = K;
  const t = f / 4 * Math.PI * 2, bob = Math.round(Math.sin(t * 2) * 1.5);
  const C0 = [6, 14, 24], C1 = [16, 30, 52], C2 = [34, 60, 96], C3 = [62, 100, 152], C4 = [104, 148, 204], C5 = [156, 196, 232], C6 = [206, 228, 248], C7 = [242, 250, 255];
  const G1 = [110, 240, 220], G2 = [210, 255, 246], TON = [96, 44, 86];
  const inE = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  const body = (x, y) => inE(x, y, 28, -56 + bob, 25, 24) || inE(x, y, -14, -58 + bob, 38, 14) || inE(x, y, -48, -58 + bob, 22, 19) || inE(x, y, 8, -72 + bob, 22, 9);
  // холодное свечение вокруг
  R(-120, -130, 126, 10, (x, y) => {
    const d = Math.hypot((x - 5) / 115, (y + 60) / 62);
    return d < 1 && dth(x, y) < (1 - d) * 0.32 ? [120, 200, 255, 0.35] : null;
  }, false);
  // хвост: низкий, дымный, рассыпается
  for (let j = 0; j < 4; j++) {
    const tail = [];
    for (let k = 0; k <= 10; k++) { const u = k / 10; tail.push([-60 - u * (58 + j * 4), -64 + bob + j * 3 + u * (20 - j * 3) + Math.sin(t + u * 3 + j) * 7 * u, (7 - j) * (1 - u) + 1.5]); }
    K.path(tail, (u, e) => dth(u * 90 + j * 2, u * 30 + j) > 1.05 - u ? null : [...(j === 1 ? C6 : j === 3 ? C4 : C5), u < 0.4 ? 1 : 0.8], j === 0);
  }
  for (let k = 0; k < 14; k++) { const u = 0.4 + hsh(k) * 0.6; P(-60 - u * 64 - hsh(k + 9) * 6, -64 + bob + u * 20 + (hsh(k + 3) - 0.5) * 14, C5, 0.5, false); }
  // лапы: тощие, с когтями; дальние темнее
  const leg = (x, ph, far, hind) => {
    const sw = Math.sin(t + ph) * 16, lift = Math.max(0, Math.cos(t + ph)) * 9, top = -44 + bob;
    const fx = x + sw, fy = -lift, kx = x + sw * 0.5 + (hind ? -8 : 3), ky = -24 - lift * 0.6;
    const cA = far ? C3 : C5, cB = far ? C2 : C4, cH = far ? C4 : C6;
    if (hind) {
      const hx = x + sw * 0.7 + 6, hy = -14 - lift;                                     // скакательный сустав назад
      L(x, top - 6, kx, ky, 9, 5, (u, e, s) => e ? cB : s < 0 ? cH : cA);
      L(kx, ky, hx, hy, 4.5, 3, (u, e) => e ? cB : cA);
      L(hx, hy, fx, fy - 2, 3, 2.6, (u, e) => u > 0.4 && dth(hx + u * 9, u * 20) > 1.4 - u ? null : e ? cB : cA);
    } else {
      L(x, top, kx, ky, 7, 4.5, (u, e, s) => e ? cB : s < 0 ? cH : cA);
      L(kx, ky, fx, fy - 2, 4, 2.8, (u, e) => u > 0.6 && dth(kx + u * 9, u * 20) > 1.6 - u ? null : e ? cB : cA);
    }
    for (let k = -1; k <= 1; k++) L(fx + 2 + k * 2.5, fy - 1, fx + 7 + k * 3, fy + 2, 0.9, 0.3, () => far ? C5 : C7);   // когти
    for (let k = 0; k < 4; k++) if (dth(fx + k * 5, f) < 0.5) P(fx - 4 + k * 4, fy + 3 + (k & 1), C5, 0.45, false);   // дымка
  };
  leg(28, 0, true, false); leg(-40, Math.PI, true, true);
  // шея: тонкая, жилистая, уходит за грудь (рисуется до туловища)
  K.path([[22, -66 + bob, 9], [howl ? 50 : 56, howl ? -80 + bob : -71 + bob, 7], [howl ? 64 : 76, howl ? -86 + bob : -70 + bob, 6.5]], (u, e, sd) => e ? (sd > 0 ? C3 : C5) : sd > 0 ? C4 : C5);
  // туловище: горб загривка, тонкая талия, глубокая грудь; мех клочьями
  R(-72, -102, 66, -28, (x, y) => {
    if (!body(x, y)) return null;
    const top = !body(x, y - 2), under = !body(x, y + 3);
    if (under) return dth(x, y) < 0.7 ? C3 : null;                                     // рваная бахрома снизу
    if (top) return C7;
    const fur = hsh(x * 7.13 + (y - bob) * 13.7) > 0.8 || ((x * 2 + y + 400) % 7 === 0 && hsh(Math.floor(x / 4) + Math.floor(y / 4) * 31) > 0.45);
    const yy = y - bob;
    let col = yy < -72 ? C6 : yy < -58 ? C5 : yy < -46 ? C4 : C3;
    if (fur) col = col === C6 ? C5 : col === C5 ? C4 : C3;
    return col;
  });
  // рёбра — проступают сквозь шкуру
  for (let i = 0; i < 5; i++) { const x0 = -10 + i * 10.5; K.path([[x0, -70 + bob + (i > 2 ? 4 : 0), 1.2], [x0 + 7, -56 + bob, 1.2], [x0 + 4, -40 + bob, 0.8]], () => [...C2, 0.8]); }
  // вздыбленный загривок — шипы
  for (let i = 0; i < 13; i++) {
    const x = -56 + i * 9.2, base = -70 + bob - (i > 4 ? Math.min(10, (i - 4) * 2.4) : i < 3 ? -4 + i * 2 : 0) - (body(x, -80 + bob) ? 4 : 0), h = 13 + (i % 2) * 7 + (i > 5 && i < 11 ? 6 : 0);
    const lean = -5 + Math.sin(t + i) * 1.5;
    R(x - 6, base - h - 2, x + 6, base + 3, (px, py) => {
      const u = (base - py) / h; if (u < 0 || u > 1) return null;
      const cx = x + lean * u, w = 4.5 * (1 - u);
      return Math.abs(px - cx) <= w ? (u > 0.6 ? C7 : px < cx ? C5 : C6) : null;
    });
  }
  // голова в своей системе координат: поворот вокруг шеи (вой — морда вверх)
  const PX = howl ? 64 : 76, PY = (howl ? -86 : -70) + bob, A = howl ? -1.0 : 0.12, ca = Math.cos(A), sa = Math.sin(A);
  const H = (f2, x0 = -16, y0 = -40, x1 = 64, y1 = 40) => {
    const xs = [x0, x1], ys = [y0, y1], bx = [], by = [];
    for (const a of xs) for (const b of ys) { bx.push(PX + a * ca - b * sa); by.push(PY + a * sa + b * ca); }
    R(Math.min(...bx), Math.min(...by), Math.max(...bx), Math.max(...by), (x, y) => { const dx = x - PX, dy = y - PY; return f2(dx * ca + dy * sa, -dx * sa + dy * ca); });
  };
  const jawA = howl ? 0.75 : 0.5;
  const inJawU = (u, v) => u > 6 && u < 52 && v > -12 && v < 10 && v < -12 + (52 - u) * 0.1 + 18 && v > -3 - (u - 6) * 0.05 - 9;   // верхняя челюсть
  const lj = (u, v) => { const r = u * Math.cos(-jawA) - (v - 6) * Math.sin(-jawA), q = u * Math.sin(-jawA) + (v - 6) * Math.cos(-jawA); return [r, q]; };   // локальные оси нижней челюсти
  // ухо
  H((u, v) => { const q = (v + 14) / -22; if (q < 0 || q > 1) return null; const w = 7 * (1 - q); return Math.abs(u - 2 + q * 8) < w ? (Math.abs(u - 2 + q * 8) < w - 2.5 && q < 0.7 ? C2 : C5) : null; });
  // пасть изнутри (между челюстями)
  H((u, v) => { const [r, q] = lj(u, v); return u > 10 && u < 48 && v > 2 && q < 0 && r < 44 ? (v > 6 && u > 16 && u < 34 && q > -4 ? TON : C0) : null; });
  // нижняя челюсть: отвисла
  H((u, v) => { const [r, q] = lj(u, v); if (r < 4 || r > 44 || q < 0 || q > 7 - r * 0.06) return null; return q > 5 - r * 0.06 ? C3 : C4; });
  H((u, v) => { const [r, q] = lj(u, v); for (const [x, l] of [[24, 7], [34, 6], [41, 5]]) if (Math.abs(r - x) < 1.6 * (1 - (-q) / l) && q < 0.5 && q > -l) return C7; return null; });   // нижние клыки
  // череп и морда
  H((u, v) => {
    const skull = ((u - 4) / 17) ** 2 + ((v + 2) / 14) ** 2 <= 1, snout = u > 6 && u < 54 && v > -11 + u * 0.02 && v < 4 - Math.max(0, u - 44) * 0.4;
    if (!skull && !snout) return null;
    if (snout && !skull && v > 2) return C4;
    if (v < -8 && u < 20) return C6;
    if (snout && !skull && (u > 24 && u < 36) && ((u + v) % 4 === 0) && v < -4) return C3;   // морщины оскала
    return v < -4 ? C5 : C4;
  });
  for (const [x, l] of [[22, 9], [33, 11], [44, 8], [50, 5]]) H((u, v) => v > 3 && v < 3 + l && Math.abs(u - x) < 1.8 * (1 - (v - 3) / l) ? C7 : null);   // верхние клыки
  H((u, v) => Math.hypot(u - 53, v + 6) < 3.2 ? C0 : null);                              // нос
  // злой прищур: тёмная щель наискосок, внутри ледяной огонёк
  H((u, v) => {
    const s = v + 7 + (u - 10) * 0.35;
    if (u < 2 || u > 18 || Math.abs(s) > 3.2) return null;
    const d = Math.hypot(u - 10, s * 1.6);
    return d < 2 ? G2 : d < 3.6 ? G1 : C0;
  });
  H((u, v) => u > 0 && u < 20 && Math.abs(v + 12 + (u - 10) * 0.35) < 1 ? C1 : null);     // бровь
  // ближние лапы
  leg(38, Math.PI * 0.5, false, false); leg(-50, Math.PI * 1.5, false, true);
  K.outline([12, 24, 44]);
  return K.done();
}
function fzWolfSprite(f, howl) { return fzPxSprite('wolf' + f + (howl ? 'h' : ''), 84, 54, 42, 46, () => fzWolfPx(f, howl)); }
// Леший: сутулый великан из коры. Рога-ветви с листвой, лицо — кора с глубокими дуплами глаз, в которых тлеют жёлто-зелёные огни, пасть-дупло с зубами-щепками;
// мшистая борода с лозой до пояса, грибы на плече, руки-сучья до колен с когтями-прутьями, ноги уходят корнями в землю.
// Пиксель-арт 108×150 (×3 мельче мирового 36×50), рисуется 1:1 в 3× холст. arms — гнев: руки вскинуты, пасть раскрыта; p — фаза качания 0..5.
function fzLeshyPx(arms, p) {
  const K = fzPxKit(108, 150, 54, 144), { P, R, L, dth, hsh } = K;
  const ph = p / 6 * Math.PI * 2, sw = Math.sin(ph), HY = -88;
  const B0 = [26, 18, 12], B1 = [50, 36, 24], B2 = [84, 62, 40], B3 = [120, 92, 62], B4 = [160, 128, 90], B5 = [196, 168, 124];
  const M0 = [26, 46, 20], M1 = [48, 80, 30], M2 = [84, 122, 46], M3 = [132, 172, 70];
  const LF1 = [60, 100, 36], LF2 = [104, 146, 52], LF3 = [176, 120, 40], E1 = [196, 255, 80], E2 = [250, 255, 200], RED = [176, 46, 28], WH = [238, 230, 210];
  const bark = (x, y, s = 0) => { const g = ((x * 3 + Math.floor(y / 7) * 5 + 400) % 9); return g === 0 ? B1 : g === 4 && hsh(x + y * 0.1) > 0.5 ? B3 : s > 0 ? B3 : B2; };
  // корни в земле
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const a = s * (0.3 + k * 0.5), x0 = s * 14, l = 12 + k * 4;
    K.path([[x0, -6, 4], [x0 + Math.sin(a) * l * 0.6, -2, 2.6], [x0 + Math.sin(a) * l, 1 + k, 1]], (u, e) => e ? B1 : B2);
  }
  // ноги-стволы
  for (const s of [-1, 1]) L(s * 10, -40, s * 14, -5, 9, 7.5, (u, e, sd) => e ? B1 : sd * s > 4 ? B3 : bark(s * 12 + Math.round(sd / 9), Math.round(u * 30)));
  // рога-ветви с листвой (позади головы)
  const tine = (x0, y0, a, l, r, depth, s) => {
    const x1 = x0 + Math.cos(a) * l, y1 = y0 + Math.sin(a) * l;
    L(x0, y0, x1, y1, r, r * 0.6, (u, e) => e ? B1 : B3);
    if (depth > 0) { tine(x1, y1, a - s * 0.5, l * 0.7, r * 0.6, depth - 1, s); tine(x1, y1, a + s * 0.45, l * 0.55, r * 0.55, depth - 1, s); }
    else R(x1 - 7, y1 - 7, x1 + 7, y1 + 7, (x, y) => {                                     // листва на кончике
      const d = Math.hypot(x - x1, (y - y1) * 1.2);
      if (d > 6 || dth(x, y) > 1.3 - d / 6) return null;
      return hsh(x * 3.1 + y * 7.7 + depth) > 0.86 ? LF3 : y < y1 - 1 ? LF2 : LF1;
    });
  };
  for (const s of [-1, 1]) tine(s * 10, HY - 13, -Math.PI / 2 + s * (0.62 + sw * 0.03), 17, 3.6, 2, s);
  // туловище: сутулое, в коре, с дуплом-сучком
  R(-24, -82, 24, -34, (x, y) => {
    const hw = y < -74 ? 17 + (y + 82) * 0.6 : 22 - (y + 74) * 0.12;
    if (Math.abs(x + 0.5) > hw) return null;
    if (Math.abs(x + 0.5) > hw - 1.5) return B1;
    return bark(x, y, -(x + 0.5) / hw);
  });
  R(7, -54, 13, -46, (x, y) => { const d = Math.hypot(x - 10, (y + 50) / 1.3); return d < 2 ? B0 : d < 3 ? B1 : null; });   // дупло
  // мох на плечах
  R(-24, -84, 24, -72, (x, y) => Math.abs(x + 0.5) > 7 && dth(x, y) < 0.6 - (y + 84) * 0.04 ? (hsh(x + y * 3) > 0.5 ? M2 : M1) : null);
  // грибы на левом плече
  for (const [gx, gy, r] of [[-16, -82, 4], [-21, -80, 3]]) {
    L(gx, gy, gx, gy + 4, 1, 1, () => WH);
    R(gx - r - 1, gy - r, gx + r + 1, gy + 1, (x, y) => { const d = Math.hypot((x - gx) / r, (y - gy) / (r * 0.8)); return d <= 1 && y <= gy ? (hsh(x * 5 + y) > 0.8 ? WH : RED) : null; });
  }
  // голова: вытянутая, кора, нависшие надбровья
  R(-17, HY - 19, 17, HY + 17, (x, y) => {
    const dx = (x + 0.5) / 15.5, dy = (y - HY) / (y > HY ? 16 : 18);
    if (dx * dx + dy * dy > 1) return null;
    const ax = Math.abs(x + 0.5);
    if (dx * dx + dy * dy > 0.82) return B1;
    if (y > HY - 7 && y < HY - 4 && ax < 11) return y === HY - 7 ? B4 : B3;             // надбровья
    return bark(x, y, -(x + 0.5) / 13);
  });
  // мох на макушке
  R(-12, HY - 18, 12, HY - 10, (x, y) => { const d = Math.hypot((x + 0.5) / 12, (y - HY + 12) / 6); return d < 1 && dth(x, y) < 0.8 - d * 0.4 ? (hsh(x * 2 + y) > 0.5 ? M3 : M2) : null; });
  // дупла глаз и огни
  for (const s of [-1, 1]) {
    const ex = s * 5.5 - 0.5, ey = HY - 1;
    R(ex - 5, ey - 4, ex + 5, ey + 5, (x, y) => { const d = ((x - ex) / 4.2) ** 2 + ((y - ey) / 3.6) ** 2; return d <= 1 ? B0 : d <= 1.5 ? B1 : null; });
    const g = arms ? 1.6 : 1 + (p % 3 === 0 ? 0.3 : 0);
    R(ex - 4, ey - 3, ex + 4, ey + 4, (x, y) => { const d = Math.hypot(x - ex, y - ey - 0.5); return d < g ? E2 : d < g + 1.1 ? E1 : null; });
    R(ex - 8, ey - 8, ex + 8, ey + 8, (x, y) => { const d = Math.hypot(x - ex, y - ey); return d > 4 && d < 7 && dth(x, y) < (arms ? 0.35 : 0.18) ? [...E1, 0.4] : null; }, false);
    L(ex - s * 3, HY - 8, ex + s * 6, HY - 3, 1, 0.7, () => B0);                         // хмурая складка коры
  }
  // нос-сучок
  L(0, HY + 2, 0.5, HY + 9, 2.2, 1.6, (u, e) => e ? B1 : B4);
  // пасть-дупло с зубами-щепками
  const mry = arms ? 6 : 3, my = HY + 12 + (arms ? 2 : 0);
  R(-9, my - mry - 1, 8, my + mry + 1, (x, y) => {
    const d = ((x + 0.5) / 7.5) ** 2 + ((y - my) / mry) ** 2;
    if (d > 1) return d < 1.4 ? B1 : null;
    const tt = y - (my - mry), bb = my + mry - y;
    if (Math.abs(x + 0.5) < 6.5 && (tt < ((x * 7) % 3 === 0 ? 3 : 1.2) || bb < ((x * 5) % 3 === 0 ? 2.5 : 0.8))) return B5;
    return B0;
  });
  // мшистая борода с лозой
  for (let k = 0; k < 9; k++) {
    const x0 = (k - 4) * 2.6, len = 30 + (4 - Math.abs(k - 4)) * 6 + hsh(k) * 6, pts = [];
    for (let m = 0; m <= 8; m++) { const u = m / 8; pts.push([x0 * (1 - u * 0.5) + Math.sin(ph + u * 3 + k) * 2.4 * u, HY + 17 + u * len, 2.4 - u * 1.4]); }
    K.path(pts, (u, e) => dth(x0 + u * 9, u * 30) > 1.2 - u * 0.6 ? null : e ? M0 : k % 3 === 0 ? M3 : k & 1 ? M1 : M2);
  }
  for (const s of [-1, 1]) {                                                            // лоза с листочками
    const x0 = s * 8, pts = [];
    for (let m = 0; m <= 10; m++) { const u = m / 10; pts.push([x0 + s * u * 3 + Math.sin(ph + u * 4) * 3 * u, HY + 17 + u * 52, 0.9]); }
    K.path(pts, () => M1);
    for (let m = 2; m <= 10; m += 3) { const q = pts[m]; R(q[0] - 2, q[1] - 2, q[0] + 2, q[1] + 2, (x, y) => Math.hypot(x - q[0] - s, y - q[1]) < 1.8 ? LF2 : null); }
  }
  // руки-сучья: до колен; в гневе — вскинуты, когти-прутья веером
  for (const s of [-1, 1]) {
    const sx = s * 19, sy = -76, hx = s * (arms ? 37 : 30) + (arms ? 0 : sw * s * 1.5), hy = arms ? -116 : -30;
    const ex = s * (arms ? 35 : 32), ey = arms ? -90 : -54;
    L(sx, sy, ex, ey, 7, 5, (u, e, sd) => e ? B1 : sd * s > 0 ? B3 : B2);
    L(ex, ey, hx, hy, 5, 3.6, (u, e, sd) => e ? B1 : sd * s > 0 ? B3 : B2);
    R(ex - 6, ey - 6, ex + 6, ey + 6, (x, y) => Math.hypot(x - ex, y - ey) < 4.5 && dth(x, y) < 0.5 ? M2 : null);   // мох на локте
    const dir = Math.atan2(hy - ey, hx - ex);
    for (const j of [-1.5, -0.5, 0.5, 1.5]) {
      const a = dir + j * 0.42, l1 = Math.abs(j) > 1 ? 7 : 9, x1 = hx + Math.cos(a) * l1, y1 = hy + Math.sin(a) * l1, a2 = a + j * 0.3, x2 = x1 + Math.cos(a2) * 6, y2 = y1 + Math.sin(a2) * 6;
      L(hx, hy, x1, y1, 1.6, 1.1, (u, e) => e ? B1 : B3);
      L(x1, y1, x2, y2, 1.1, 0.3, u => u > 0.6 ? B5 : B4);
    }
  }
  K.outline([30, 22, 12]);
  return K.done();
}
function fzLeshySprite(arms, p) { return fzPxSprite('les' + (arms ? 'A' : '') + p, 36, 50, 18, 48, () => fzLeshyPx(arms, p)); }
// Кикимора: сгорбленная болотная карга. Длинные мокрые волосы-тина до земли, из-под них — серо-зелёное иссохшее лицо с крючковатым носом,
// круглые глаза, залитые жёлтым светом, широкий рот с игольчатыми зубами; рваное платье, тощие руки с длинными когтями. С волос капает вода.
// Пиксель-арт 78×96 (×3 мельче мирового 26×32), рисуется 1:1 в 3× холст. b — руки вскинуты когтями вверх, рот разинут; p — фаза 0..3 (капли, колыхание).
function fzKikPx(b, p) {
  const K = fzPxKit(78, 96, 39, 90), { P, R, L, dth, hsh } = K;
  const ph = p / 4 * Math.PI * 2, HY = -58;
  const H0 = [12, 28, 20], H1 = [24, 50, 34], H2 = [44, 80, 50], H3 = [72, 116, 66], H4 = [118, 158, 92];
  const S0 = [48, 62, 50], S1 = [88, 108, 86], S2 = [134, 154, 124], S3 = [174, 192, 156], S4 = [204, 218, 184];
  const Y1 = [240, 242, 106], Y2 = [255, 255, 222], DK = [18, 14, 12], TE = [232, 226, 198], RG0 = [56, 46, 34], RG1 = [84, 70, 52], RG2 = [112, 96, 72], WA = [160, 214, 210];
  // тина и грязь под ногами
  R(-26, -4, 26, 6, (x, y) => { const d = Math.hypot(x / 25, (y - 1) / 4.5); return d < 1 && dth(x, y) < 1.1 - d ? (hsh(x + y * 9) > 0.6 ? H2 : RG0) : null; }, false);
  // задние космы — плащ из тины до земли
  for (let k = 0; k < 14; k++) {
    const s = k % 2 ? 1 : -1, i = k >> 1, x0 = s * (4 + i * 1.4), pts = [];
    for (let m = 0; m <= 8; m++) { const u = m / 8; pts.push([x0 + s * (Math.sin(u * 2.4) * 5 + u * i * 1.3) + Math.sin(ph + u * 3 + k) * 1.8 * u, HY - 10 + u * (62 + hsh(k) * 8), 3 - u * 1.2]); }
    K.path(pts, (u, e) => e ? H0 : k % 3 === 0 ? H3 : H1);
  }
  // рваное платье, сгорбленное тело
  R(-14, -50, 14, -2, (x, y) => {
    const hw = 6.5 + (y + 50) * 0.08, ax = Math.abs(x + 0.5);
    if (ax > hw) return null;
    if (y > -8 && hsh(Math.floor(x / 2) + 3) * 8 > -y) return null;                    // рваный подол
    if (ax > hw - 1) return RG0;
    return ((x + 400) % 5 === 0 || (y + 400) % 11 === 0 && hsh(x) > 0.5) ? RG0 : x < 0 ? RG1 : RG2;
  });
  for (const [x, y] of [[-4, -36], [3, -24], [-2, -14]]) R(x - 2, y - 2, x + 2, y + 3, (px, py) => Math.hypot(px - x, (py - y) / 1.4) < 1.8 ? DK : null);   // прорехи
  // руки: тощие, длинные пальцы-когти; в рывке вскинуты в стороны
  for (const s of [-1, 1]) {
    const sx = s * 9, sy = -47, hx = s * (b ? 26 : 15), hy = b ? -76 : -18 + Math.sin(ph + s) * 1.5, ex = s * (b ? 22 : 16), ey = b ? -52 : -32;
    L(sx, sy, ex, ey, 2.6, 2, (u, e) => e ? S0 : S2);
    L(ex, ey, hx, hy, 2, 1.5, (u, e) => e ? S0 : S3);
    const dir = Math.atan2(hy - ey, hx - ex);
    for (const j of [-1.5, -0.5, 0.5, 1.5]) {
      const a = dir + j * 0.32, x1 = hx + Math.cos(a) * 5, y1 = hy + Math.sin(a) * 5, a2 = a + j * 0.25 * (b ? -1 : 1), x2 = x1 + Math.cos(a2) * 5, y2 = y1 + Math.sin(a2) * 5;
      L(hx, hy, x1, y1, 0.9, 0.8, () => S2);
      L(x1, y1, x2, y2, 0.8, 0.2, u => u > 0.5 ? DK : RG0);
    }
    for (let k = 0; k < 3; k++) L(sx + s * k, sy, sx + s * k + Math.sin(ph + k) * 1.5, sy + 10 + k * 3, 1, 0.4, () => k & 1 ? H2 : H1);   // тина свисает с плеч
  }
  // голова: иссохшее лицо
  const jaw = b ? 15 : 13;
  const face = (x, y) => { const dx = (x + 0.5) / 10.5, dy = (y - HY) / (y > HY ? jaw : 10); return dx * dx * (1 + Math.max(0, dy) * 0.8) + dy * dy <= 1; };
  R(-12, HY - 11, 12, HY + jaw + 1, (x, y) => {
    if (!face(x, y)) return null;
    const ax = Math.abs(x + 0.5);
    if (!face(x + (x < 0 ? -1 : 1), y) || !face(x, y + 1)) return S0;
    if ((ax - 7) ** 2 + (y - HY - 6) ** 2 < 6) return S1;                               // впалые щёки
    if (y < HY - 4 && ax < 5) return S4;
    return ax > 8 ? S2 : S3;
  });
  for (const [x, y] of [[-6, HY + 2], [5, HY - 3], [3, HY + 7]]) { P(x, y, S1); P(x + 1, y, S0); }   // бородавки
  // глаза, залитые светом
  for (const s of [-1, 1]) {
    const ex = s * 5 - 0.5, ey = HY - 1;
    R(ex - 5, ey - 5, ex + 5, ey + 5, (x, y) => { const d = Math.hypot(x - ex, y - ey); return d < 1.6 ? Y2 : d < 3.4 ? Y1 : d < 4.4 ? DK : null; });
    R(ex - 6, ey - 6, ex + 6, ey + 6, (x, y) => { const d = Math.hypot(x - ex, y - ey); return d > 4 && d < 6 && dth(x, y) < 0.25 ? [...Y1, 0.45] : null; }, false);
    L(ex - s * 3, ey - 6.5, ex + s * 4, ey - 4.5, 0.9, 0.6, () => S0);
  }
  // крючковатый нос
  K.path([[-0.5, HY + 1, 1.4], [0.5, HY + 6, 2], [-1, HY + 9, 1.2]], (u, e) => e ? S1 : S3);
  P(-1, HY + 8, S0);
  // рот с игольчатыми зубами
  const mry = b ? 5 : 1.8, my = HY + 12 + (b ? 1.5 : 0);
  R(-9, my - mry - 1, 8, my + mry + 1, (x, y) => {
    const ax = Math.abs(x + 0.5), up = ax > 3 ? (ax - 3) * 0.5 : 0, d = (ax / 7.5) ** 2 + ((y - my + up) / mry) ** 2;
    if (d > 1) return null;
    const tt = y - (my - up - mry), bb = my - up + mry - y;
    if (ax < 7 && ((tt < (x & 1 ? 2.5 : 1) ) || (b && bb < (x & 1 ? 1 : 2.5)))) return TE;
    return DK;
  });
  // передние пряди: падают на лицо и плечи, мокрые
  for (let k = 0; k < 8; k++) {
    const s = k % 2 ? 1 : -1, i = k >> 1, x0 = s * (i ? 8 + i * 1.6 : 1.5), len = 20 + i * 9 + hsh(k + 7) * 8, pts = [];
    for (let m = 0; m <= 8; m++) { const u = m / 8; pts.push([x0 + s * u * (i < 1 ? 1 : 2 + i * 0.6) + s * Math.sin(u * 2) * (i > 1 ? 3 : 0) + Math.sin(ph + u * 4 + k) * 1.2 * u, HY - 11 + u * len, (i < 1 ? 1.4 : 2) - u * 0.8]); }
    if (i === 0) pts.length = 3;                                                      // у пробора — коротко, лицо видно
    K.path(pts, (u, e) => e ? H1 : k % 3 === 0 ? H4 : H2);
    const q = pts[pts.length - 1];
    if ((p + k) % 4 === 0) P(q[0], q[1] + 2 + (p & 1) * 2, WA, 0.8, false);            // капли
  }
  // макушка: мокрые волосы облепили голову
  R(-13, HY - 14, 13, HY - 4, (x, y) => { const d = Math.hypot((x + 0.5) / 12.5, (y - HY + 4) / 10); return d < 1 && y < HY - 8 + Math.abs(x + 0.5) * 0.3 ? ((x + 40) % 3 === 0 ? H0 : (x + y) & 1 ? H2 : H3) : null; });
  K.outline([14, 28, 18]);
  return K.done();
}
function fzKikSprite(b, p) { return fzPxSprite('kik' + (b ? 'B' : 'A') + p, 26, 32, 13, 30, () => fzKikPx(b, p)); }
// Водяной: жирный жабий старик по грудь в воде. Плоская широкая голова, пасть во всё лицо с пилой зубов, выпученные жёлтые глаза
// с узкими зрачками, плавники-уши с шипами, волосы и борода из тины с ракушками, бородавки и чешуя на плечах.
// Пиксель-арт 90×84 (×3 мельче мирового 30×28), рисуется 1:1 в 3× холст. b — схватка: перепончатые лапы вскинуты, пасть разинута; p — фаза 0..3.
function fzVodPx(b, p) {
  const K = fzPxKit(90, 84, 45, 78), { P, R, L, dth, hsh } = K;
  const ph = p / 4 * Math.PI * 2, HY = -46;
  const V0 = [14, 40, 36], V1 = [30, 72, 64], V2 = [52, 110, 96], V3 = [80, 146, 124], V4 = [130, 190, 160], BL = [168, 200, 156];
  const A0 = [18, 48, 24], A1 = [42, 92, 44], A2 = [76, 138, 62], A3 = [120, 176, 90];
  const Y1 = [236, 214, 70], Y2 = [255, 246, 170], DK = [24, 10, 14], TE = [232, 226, 196], TG = [140, 52, 64], SH1 = [236, 214, 184], SH2 = [196, 140, 110];
  const wet = y => y > -8;                                                              // ниже — под водой
  // волосы-тина сзади
  for (let k = 0; k < 10; k++) {
    const s = k % 2 ? 1 : -1, i = k >> 1, pts = [];
    for (let m = 0; m <= 6; m++) { const u = m / 6; pts.push([s * (8 + i * 4 + u * (6 + i)) + Math.sin(ph + k + u * 3) * 1.5 * u, HY - 14 + i * 2 + u * (26 + i * 4), 2.6 - u]); }
    K.path(pts, (u, e) => e ? A0 : k % 3 ? A1 : A2);
  }
  // туловище: жирные плечи, светлое брюхо
  R(-32, -42, 32, 6, (x, y) => {
    const d = Math.hypot(x / 30, (y + 20) / 24);
    if (d > 1 || y > 6) return null;
    if (wet(y) && dth(x, y) > 1 - (y + 8) / 16) return null;
    let col = Math.hypot(x / 14, (y + 12) / 16) < 1 ? BL : d > 0.9 ? V1 : x < -8 ? V2 : V3;
    if (col !== BL && y < -24 && ((Math.floor(x / 4) + Math.floor(y / 3)) & 1) && (x + 400) % 4 === 0) col = V1;   // чешуя
    if (col === BL && (y + 400) % 4 === 0) col = V4;                                   // складки брюха
    return wet(y) ? [...col.map(v => v * 0.75), 0.9] : col;
  });
  // руки
  for (const s of [-1, 1]) {
    const sx = s * 24, sy = -30, ex = s * (b ? 34 : 31), ey = b ? -38 : -16, hx = s * (b ? 38 : 26), hy = b ? -64 : -6 + Math.sin(ph + s) * 1;
    L(sx, sy, ex, ey, 6, 5, (u, e) => e ? V1 : V2);
    L(ex, ey, hx, hy, 5, 3.6, (u, e) => e ? V1 : V3);
    const dir = Math.atan2(hy - ey, hx - ex), tips = [];
    for (const j of [-1.5, -0.5, 0.5, 1.5]) { const a = dir + j * 0.38; tips.push([hx + Math.cos(a) * 11, hy + Math.sin(a) * 11, a]); }
    for (let k = 1; k < 4; k++) {                                                       // перепонки
      const [ax, ay] = tips[k - 1], [bx, by] = tips[k];
      R(Math.min(hx, ax, bx) - 1, Math.min(hy, ay, by) - 1, Math.max(hx, ax, bx) + 1, Math.max(hy, ay, by) + 1, (x, y) => {
        const c1 = (ax - hx) * (y - hy) - (ay - hy) * (x - hx), c2 = (bx - ax) * (y - ay) - (by - ay) * (x - ax), c3 = (hx - bx) * (y - by) - (hy - by) * (x - bx);
        const inside = (c1 >= 0 && c2 >= 0 && c3 >= 0) || (c1 <= 0 && c2 <= 0 && c3 <= 0);
        return inside && Math.hypot(x - hx, y - hy) < 9 ? [...V4, 0.75] : null;
      });
    }
    for (const [tx, ty, a] of tips) {
      L(hx, hy, tx, ty, 1.3, 1, (u, e) => e ? V1 : V3);
      L(tx, ty, tx + Math.cos(a) * 3.5, ty + Math.sin(a) * 3.5, 1, 0.2, () => DK);
    }
  }
  // плавники-уши с шипами
  for (const s of [-1, 1]) {
    for (let k = 0; k < 4; k++) L(s * 19, HY - 2, s * (29 + k * 1.5), HY - 12 + k * 6 + Math.sin(ph + k) * 0.8, 1, 0.3, () => V1);
    R(s > 0 ? 18 : -33, HY - 13, s > 0 ? 33 : -18, HY + 10, (x, y) => {
      const u = (Math.abs(x) - 19) / 12; if (u < 0 || u > 1) return null;
      const top = HY - 2 - u * 9, bot = HY - 2 + u * 10, edge = Math.sin(u * 14 + y) > 0.6 && u > 0.85;
      return y > top && y < bot && !edge ? [...V3, 0.8] : null;
    });
  }
  // голова: плоская, широкая, без шеи
  R(-24, HY - 20, 24, HY + 16, (x, y) => {
    const dx = (x + 0.5) / 22, dy = (y - HY) / (y < HY ? 15 : 14);
    if (dx * dx + dy * dy > 1) return null;
    if (dx * dx + dy * dy > 0.86) return V1;
    if (hsh(x * 3.3 + y * 7.1) > 0.93) return V1;                                      // бородавки
    return y < HY - 6 ? V3 : x < -10 ? V2 : V3;
  });
  // выпученные глаза на макушке, узкий зрачок
  for (const s of [-1, 1]) {
    const ex = s * 10 - 0.5, ey = HY - 13;
    R(ex - 8, ey - 8, ex + 8, ey + 8, (x, y) => {
      const d = Math.hypot(x - ex, y - ey);
      if (d > 7) return null;
      if (d > 5.8) return V1;
      if (y < ey - 4 + (b ? 1 : 0)) return V2;                                        // веко
      if (Math.abs(x - ex) < (b ? 0.9 : 1.4) && Math.abs(y - ey) < 4) return DK;      // зрачок-щель
      return d < 2.5 && x < ex ? Y2 : Y1;
    });
  }
  // пасть во всё лицо, пила зубов
  const mry = b ? 9 : 4, my = HY + 4 + mry * 0.6;
  R(-21, my - mry - 2, 21, my + mry + 2, (x, y) => {
    const ax = Math.abs(x + 0.5), dn = (ax / 20) ** 2 * 3;                              // уголки вниз
    const d = (ax / 19) ** 2 + ((y - my - dn) / mry) ** 2;
    if (d > 1) return d < 1.25 ? V0 : null;
    const tt = y - (my + dn - mry * Math.sqrt(Math.max(0, 1 - (ax / 19) ** 2))), saw = (ax % 3) / 3;
    if (tt < 3.2 * (1 - Math.abs(saw - 0.5) * 2) + 0.5) return TE;                     // верхняя пила
    const bb = my + dn + mry * Math.sqrt(Math.max(0, 1 - (ax / 19) ** 2)) - y;
    if (bb < 2.6 * (1 - Math.abs(((ax + 1.5) % 3) / 3 - 0.5) * 2) + 0.3) return TE;    // нижняя пила
    return b && y > my + 2 && ax < 8 ? TG : DK;
  });
  // борода из тины с ракушками
  for (let k = 0; k < 9; k++) {
    const x0 = (k - 4) * 3.6, pts = [];
    for (let m = 0; m <= 6; m++) { const u = m / 6; pts.push([x0 * (1 - u * 0.3) + Math.sin(ph + u * 3 + k) * 1.6 * u, my + mry + 4 + u * (18 + (4 - Math.abs(k - 4)) * 3), 2.2 - u * 1.2]); }
    K.path(pts, (u, e) => (u > 0.7 && dth(x0, u * 30) > 1.6 - u) ? null : e ? A0 : k % 3 === 0 ? A3 : k & 1 ? A1 : A2);
  }
  for (const [x, y, c] of [[-9, -22, SH1], [6, -18, SH2], [-2, -12, SH1], [16, -34, SH2]]) R(x - 2, y - 2, x + 2, y + 2, (px, py) => { const d = Math.hypot(px - x, py - y); return d < 1.2 ? c : d < 2.2 ? (((px + py) & 1) ? SH2 : c) : null; });
  // тина на макушке между глаз
  for (let k = 0; k < 5; k++) L(-4 + k * 2, HY - 15, -5 + k * 2.4 + Math.sin(ph + k) * 1.2, HY - 5, 1.1, 0.5, () => k & 1 ? A2 : A1);
  // вода по грудь: блики
  R(-34, -6, 34, 6, (x, y) => y === -6 + ((x + p * 3 + 300) % 7 === 0 ? 0 : 1) && dth(x, y) < 0.6 ? [190, 236, 240, 0.7] : null, false);
  K.outline([10, 30, 30]);
  return K.done();
}
function fzVodSprite(b, p) { return fzPxSprite('vod' + (b ? 'B' : 'A') + p, 30, 28, 15, 26, () => fzVodPx(b, p)); }
// Русалка: не нечисть с оскалом, а красивая девушка на камне у воды. Длинные золотистые волосы с зелёными прядями тины, венок из кувшинок,
// большие бирюзовые глаза, румянец, мягкая улыбка; мокрая белая рубаха, чешуйчатый хвост бирюзой с веером плавника.
// Пиксель-арт 66×90 (×3 мельче мирового 22×30), рисуется 1:1 в 3× холст. sing — поёт: рот приоткрыт, глаза прикрыты, рука протянута; p — фаза 0..3.
function fzRusPx(sing, p) {
  const K = fzPxKit(66, 90, 33, 84), { P, R, L, dth, hsh } = K;
  const ph = p / 4 * Math.PI * 2, HY = -64;
  const R0 = [150, 100, 92], R1 = [204, 152, 138], R2 = [236, 198, 182], R3 = [250, 224, 210], CH = [236, 160, 156], LIP = [200, 88, 100];
  const H0 = [84, 60, 32], H1 = [132, 100, 54], H2 = [184, 148, 84], H3 = [222, 192, 124], HG = [104, 138, 82];
  const W0 = [150, 164, 178], W1 = [206, 216, 224], W2 = [242, 246, 250];
  const T0 = [18, 66, 86], T1 = [36, 116, 138], T2 = [76, 168, 180], T3 = [150, 220, 224];
  const IR = [52, 150, 160], DK = [36, 28, 36], FW = [250, 250, 238], FY = [240, 208, 90], FP = [234, 150, 172];
  // волосы сзади: длинные, волной до самого хвоста
  for (let k = 0; k < 12; k++) {
    const s = k % 2 ? 1 : -1, i = k >> 1, pts = [];
    for (let m = 0; m <= 8; m++) { const u = m / 8; pts.push([s * (5 + i * 1.3 + u * (3 + i * 0.8)) + Math.sin(ph + u * 4 + k) * 1.6 * u, HY - 6 + u * (40 + i * 3), 2.4 - u * 1.2]); }
    K.path(pts, (u, e) => e ? H0 : k % 5 === 2 ? HG : (k & 1) ? H2 : H1);
  }
  // хвост: от бёдер изгибом вниз-вправо, чешуя, веер плавника на земле
  const tail = [[0, -24, 9], [4, -14, 7.5], [11, -7, 5], [17, -4, 3]];
  K.path(tail, (u, e, sd) => {
    if (e) return T0;
    return sd > 6 ? T1 : T2;
  });
  R(-10, -28, 20, -2, (x, y) => (((x + y * 2 + 300) % 5 === 0) && ((x * 2 - y + 300) % 5 !== 0) && hsh(x * 3 + y) > 0.35 ? [...T3, 0.55] : null));   // блики чешуи
  for (let k = -2; k <= 2; k++) L(18, -4, 26 + Math.sin(ph + k) * 0.8, -4 + k * 3.2, 2.2, 0.6, (u, e) => e ? T1 : u > 0.6 ? T3 : T2);   // плавник
  // рубаха: мокрая, белая, по фигуре
  R(-11, -52, 11, -22, (x, y) => {
    const hw = y < -44 ? 8 + (y + 52) * 0.2 : y < -34 ? 9.6 - (y + 44) * 0.25 : 7 + (y + 34) * 0.25, ax = Math.abs(x + 0.5);
    if (ax > hw) return null;
    if (y < -46 && ax < (y + 53) * 0.7) return y > -48 ? R1 : R2;                       // вырез ворота
    if (ax > hw - 1) return W0;
    return x < -3 ? W1 : ((x + 40) % 4 === 0 && y > -34) ? W1 : W2;
  });
  for (let x = -7; x <= 6; x++) if (Math.abs(x + 0.5) < 7 && (x & 1)) P(x, -51 + (Math.abs(x + 0.5) * 0.7 | 0), FP);   // вышивка ворота
  // руки: правая опирается на камень, левая — к волосам; в песне протянута ладонью вверх
  L(9, -48, 13, -36, 2.4, 2, (u, e) => e ? W0 : W1);
  L(13, -36, 14, -24, 2, 1.7, (u, e) => e ? R0 : R2);
  R(12, -26, 17, -21, (x, y) => Math.hypot(x - 14.5, y - 23.5) < 2.2 ? R2 : null);
  if (sing) {
    L(-9, -48, -16, -40, 2.4, 2, (u, e) => e ? W0 : W1);
    L(-16, -40, -21, -48, 2, 1.7, (u, e) => e ? R0 : R2);
    R(-25, -52, -18, -46, (x, y) => Math.hypot(x - 22, (y + 49) * 1.4) < 3 ? (y > -48 ? R1 : R2) : null);
  } else {
    L(-9, -48, -14, -38, 2.4, 2, (u, e) => e ? W0 : W1);
    L(-14, -38, -9, -30, 2, 1.7, (u, e) => e ? R0 : R2);
    R(-10, -32, -5, -27, (x, y) => Math.hypot(x - 7.5, y + 29.5) < 2.2 ? R2 : null);
  }
  // шея
  R(-3, -57, 2, -51, (x, y) => x === -3 || x === 2 ? R1 : R2);
  // лицо: мягкий овал, румянец
  const face = (x, y) => { const dx = (x + 0.5) / 7.5, dy = (y - HY) / (y > HY ? 9.5 : 9); return dx * dx * (1 + Math.max(0, dy) * 0.35) + dy * dy <= 1; };
  R(-9, HY - 10, 8, HY + 10, (x, y) => {
    if (!face(x, y)) return null;
    const ax = Math.abs(x + 0.5);
    if (!face(x + (x < 0 ? -1 : 1), y) || !face(x, y + 1)) return R1;
    if ((ax - 4.5) ** 2 + (y - HY - 3) ** 2 < 3) return CH;                             // румянец
    return x < -4 ? R2 : R3;
  });
  // глаза: большие, с ресницами и бликом; в песне прикрыты
  for (const s of [-1, 1]) {
    const ex = s * 3.5 - 0.5, ey = HY;
    if (sing) { for (let k = -2; k <= 2; k++) P(ex + k, ey + (Math.abs(k) > 1 ? 0 : 1), DK); P(ex + s * 3, ey - 1, DK); }
    else {
      const cx = Math.round(ex), SC = [250, 250, 252];
      const rows = [[DK, DK, DK, DK], [SC, IR, FW, SC], [SC, DK, IR, SC]];
      rows.forEach((row, j) => row.forEach((col, i) => P(cx - 2 + i, ey - 2 + j, col)));
      P(cx + (s > 0 ? 2 : -3), ey - 2, DK); P(cx + (s > 0 ? 2 : -3), ey - 3, DK);         // ресницы
      P(cx - 1, ey + 1, R1); P(cx, ey + 1, R1);
    }
    L(ex - s * 1.5, ey - 4.5, ex + s * 2.5, ey - 5, 0.6, 0.5, () => H1);                // брови мягкой дугой
  }
  P(-1, HY + 3, R1); P(0, HY + 4, R1);                                                  // нос
  if (sing) R(-3, HY + 5, 2, HY + 9, (x, y) => { const d = ((x + 0.5) / 1.8) ** 2 + ((y - HY - 7) / 1.6) ** 2; return d <= 1 ? (d < 0.4 ? [120, 40, 56] : LIP) : null; });
  else { for (let x = -3; x <= 2; x++) P(x, HY + 6 + (Math.abs(x + 0.5) > 2 ? -1 : 0), LIP); P(-1, HY + 7, CH); P(0, HY + 7, CH); }
  // волосы: чёлка с пробором, пряди у лица, одна прядь через плечо на грудь
  R(-10, HY - 12, 9, HY - 3, (x, y) => {
    const ax = Math.abs(x + 0.5), dy = (y - HY + 3) / 9, inHead = (ax / 9.5) ** 2 + dy * dy <= 1;
    if (!inHead || y > HY - 6 + (ax > 5 ? (ax - 5) * 1.6 : 0)) return null;
    return ax < 1 ? H1 : ((Math.floor(ax * 1.3) + y) % 3 === 0) ? H1 : y < HY - 9 ? H3 : H2;
  });
  for (const s of [-1, 1]) {
    const pts = [];
    for (let m = 0; m <= 8; m++) { const u = m / 8; pts.push([s * (9.5 + u * (s < 0 ? -1 : 2)) + Math.sin(ph + u * 3) * 1.2 * u, HY - 4 + u * (s < 0 ? 38 : 16), 2 - u * 0.8]); }
    K.path(pts, (u, e) => e ? H1 : u > 0.5 && s < 0 ? H2 : H3);
  }
  // венок: кувшинки и мелкие цветы
  for (let k = 0; k < 7; k++) {
    const a = -Math.PI / 2 + (k - 3) * 0.42, x = Math.cos(a) * 9, y = HY - 3 + Math.sin(a) * 9.5;
    const col = k % 3 === 0 ? FW : k % 3 === 1 ? FP : FW;
    R(x - 2, y - 2, x + 2, y + 2, (px, py) => { const d = Math.hypot(px - x, py - y); return d < 0.8 ? FY : d < 2 ? col : null; });
  }
  K.outline([60, 44, 54]);
  return K.done();
}
function fzRusSprite(sing, p) { return fzPxSprite('rus' + (sing ? 'B' : 'A') + p, 22, 30, 11, 28, () => fzRusPx(sing, p)); }
function fzDrawHi(c, cv, x, y, a, face, dy) {
  const [ox, oy, w, h] = cv.fzO;
  c.save();
  c.globalAlpha *= a; c.imageSmoothingEnabled = !cv.fzPx;
  c.translate(Math.round(x * TILE), Math.round(y * TILE + dy));
  if (face < 0) c.scale(-1, 1);
  blitFine(c, cv, -ox, -oy, w, h);
  c.restore();
}

// ---------- Рисование ----------
let FZS = null;
function fzDraw(c, spr, x, y, o = {}) {
  const px = Math.round(x * TILE), py = Math.round(y * TILE + (o.dy || 0));
  c.save();
  c.globalAlpha *= o.a === undefined ? 1 : o.a;
  const S = o.s || 1;
  c.imageSmoothingEnabled = S !== 1;   // дробный масштаб без сглаживания рвёт контур в пунктир
  if (S !== 1) c.imageSmoothingQuality = 'high';
  c.translate(px, py);
  if (o.face < 0) c.scale(-1, 1);
  const W = spr.width / (spr.fine || 1), H = spr.height / (spr.fine || 1);   // мелкий пиксель: размер в игровых пикселях
  if (spr.fine > 1) blitFine(c, spr, Math.round(-W * S / 2), Math.round(-H * S + (o.lift || 0)), W * S, H * S);
  else c.drawImage(spr, Math.round(-W * S / 2), Math.round(-H * S + (o.lift || 0)), W * S, H * S);
  c.restore();
}
function fzShadow(c, x, y, rx, a = 0.3) { c.fillStyle = `rgba(10,8,4,${a})`; c.beginPath(); c.ellipse(x * TILE, y * TILE + 2, rx, rx * 0.26, 0, 0, 7); c.fill(); }
function fzReeds(c, x, y, ph, a) {
  c.save(); c.globalAlpha *= a;
  for (let i = -3; i <= 3; i++) {
    const bx = Math.round(x * TILE + i * 4), sway = Math.round(Math.sin(ph * 1.3 + i) * 1.2), h = 14 + ((i * 7) & 5);
    c.fillStyle = '#3e6a2a'; c.fillRect(bx + sway, Math.round(y * TILE + 4) - h, 1, h);
    c.fillStyle = '#5a8a3a'; c.fillRect(bx + sway + 1, Math.round(y * TILE + 4) - h + 3, 1, h - 3);
    if (i % 2) { c.fillStyle = '#6a4a28'; c.fillRect(bx + sway - 1, Math.round(y * TILE + 4) - h - 3, 3, 4); }
  }
  c.restore();
}
function fzRipple(c, x, y, ph, a, rx) {
  c.save(); c.globalAlpha *= a * 0.6; c.strokeStyle = '#cfeef0'; c.lineWidth = 1;
  for (let i = 0; i < 2; i++) { const k = (ph * 0.5 + i * 0.5) % 1; c.globalAlpha = a * 0.6 * (1 - k); c.beginPath(); c.ellipse(Math.round(x * TILE), Math.round(y * TILE + 3), rx * (0.6 + k * 0.7), rx * 0.2 * (0.6 + k * 0.7), 0, 0, 7); c.stroke(); }
  c.restore();
}

function fairy2DrawList(list, c, x0, y0, x1, y1) {
  if (!FZ_ON() || !Game.fairy2) return;
  const F = Game.fairy2, vis = (x, y) => x >= x0 - 3 && x <= x1 + 3 && y >= y0 - 4 && y <= y1 + 4;
  FZS = FZS || fzSprites();
  const S = FZS;
  const L = F.les;
  if (L && vis(L.x, L.y)) {
    list.push([L.y + 0.05, () => {
      const arms = L.state === 'angry' && Math.floor(L.ph * 1.5) % 2 === 0;
      fzShadow(c, L.x, L.y, 14, 0.3 * L.alpha);
      fzDrawHi(c, fzLeshySprite(arms, Math.floor(L.ph * 2) % 6), L.x, L.y + 0.1, L.alpha, 1, 4 + (Math.sin(L.ph * 2) > 0.7 ? 1 : 0));
      if (L.gift) fzDraw(c, S.bread, L.gift.x, L.gift.y, { a: 1, dy: 2 });
    }]);
  }
  for (const k of F.kik) if (vis(k.hx, k.hy)) {
    list.push([(k.state === 'hide' ? k.wy + 0.9 : k.y) + 0.1, () => {
      fzDraw(c, S.mound, k.hx + 0.5, k.hy + 0.55, { a: Math.max(0.4, k.alpha), dy: 4 });
      if (k.sated) fzDraw(c, S.bread, k.hx + 0.5, k.hy + 0.42, { dy: 3 });
      const a = k.alpha;
      if (a <= 0) return;
      if (k.state === 'hide' || k.state === 'back') {
        fzReeds(c, k.x, k.y, k.ph, a);
        if (Math.sin(k.ph * 0.7) > 0.2) { c.save(); c.globalAlpha *= a; c.fillStyle = '#f0f26a'; c.fillRect(Math.round(k.x * TILE - 4), Math.round(k.y * TILE - 6), 2, 2); c.fillRect(Math.round(k.x * TILE + 3), Math.round(k.y * TILE - 6), 2, 2); c.restore(); }
        fzRipple(c, k.x, k.y, k.ph, a, 12);
      } else {
        const rise = k.state === 'chase' || k.state === 'drag';
        fzShadow(c, k.x, k.y, 8, 0.25 * a);
        fzDrawHi(c, fzKikSprite(rise && Math.floor(k.ph * 5) % 2 === 1, Math.floor(k.ph * 3) % 4), k.x, k.y, a, k.face, 4 + (k.state === 'rest' ? 3 : 0));
        if (k.state === 'rest') fzReeds(c, k.x, k.y, k.ph, a * 0.8);
      }
    }]);
  }
  const P = F.pond;
  if (P && vis(P.x, P.y) && P.vod.alpha > 0) {
    const v = P.vod, r = P.rus;
    list.push([v.y + 0.9, () => {
      fzRipple(c, v.x, v.y, v.ph, v.alpha, 14);
      fzDrawHi(c, fzVodSprite(v.state === 'grab', Math.floor(v.ph * 2) % 4), v.x, v.y + (v.state === 'grab' ? 0.05 : 0.18 + Math.sin(v.ph * 2) * 0.03), v.alpha, v.face, 4);
    }]);
    list.push([r.y + 0.2, () => {
      c.fillStyle = '#7a7872'; c.beginPath(); c.ellipse(Math.round(r.x * TILE), Math.round(r.y * TILE + 3), 9, 3, 0, 0, 7); c.fill();       // камень
      fzDrawHi(c, fzRusSprite(r.state === 'sing', Math.floor(r.ph * 2) % 4), r.x, r.y, r.alpha, 1, 3);
    }]);
  }
  for (const w of F.wisps || []) if (vis(w.x, w.y) && w.alpha > 0) list.push([w.y + 0.5, () => fzWispDraw(c, w)]);
  const N = F.noon;
  if (N && vis(N.x, N.y) && N.alpha > 0) list.push([N.y + 0.2, () => fzDrawHi(c, fzNoonSprite(N.state === 'haunt' ? fzNoonLv(N.t) : 0, Math.floor(N.ph * 3) % 6), N.x, N.y, N.alpha, N.face, 6)]);
  for (const b of F.ban) if (vis(b.x, b.y) && b.alpha > 0) list.push([b.y + 0.3, () => {
    fzDrawHi(c, fzBansheeSprite(b.wail > 2.1 ? 1 : b.wail > 0.3 ? 2 : b.wail > 0 ? 1 : 0, Math.floor(b.ph * 4.4) % 12), b.x, b.y, Math.min(1, b.alpha * 1.25), b.face, -14 + Math.sin(b.ph * 1.7) * 3);
  }]);
  for (const w of F.wolves) if (vis(w.x, w.y) && w.alpha > 0) list.push([w.y + 0.1, () => {
    fzDrawHi(c, fzWolfSprite(Math.floor(w.ph) % 4, w.howlT > 0), w.x, w.y, Math.min(1, w.alpha * 1.4), w.face, 4);
    if (w.stole) { c.save(); c.globalAlpha *= w.alpha + 0.3; c.fillStyle = '#ffd880'; c.fillRect(Math.round(w.x * TILE + w.face * 14), Math.round(w.y * TILE - 6), 3, 4); c.restore(); }
  }]);
}
