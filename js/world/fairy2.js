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
const fzMirror = rows => rows.map(r => r + r.split('').reverse().join(''));
// ЛЕШИЙ — 24×30: рога-ветви с листвой, кора, глаза-огоньки, мшистая борода с лозой, грибы на плечах, корни вместо ступней
const FZ_LESHY = fzMirror([
  '.m...m..w...',
  'mMm.mMm.wl.m',
  '.mMmmMlwl.mM',
  '..mMMlwLLmMm',
  '...wlLLLLLLm',
  '....LLLLLLLL',
  '....LLEELLLL',
  '....LLEkLLLL',
  '....LLLLLLlL',
  '....LLLLLkkk',
  '....LmMLLkLL',
  '...LmMmmLLLL',
  '..xLmMmMmmMm',
  '.xqLmmMmMmmM',
  '.LLLmMmmMmMm',
  'LLlLLmMmMmmM',
  'LL.LLLmMmMmm',
  'LwLLLlLmmMmm',
  'L.LLlLLLmMmM',
  'L.LLLLLkkLmm',
  '..LLLlLLkLLL',
  '..LLLLLLLLlL',
  '..LLlLLLLLLL',
  '..LLLLL.LLLL',
  '..LLlLL.LLLL',
  '..LLLLL.LLLL',
  '.LLLLLL.LLLL',
  'LLlLLLLL.LLL',
  'LLLmLLLLL.LL',
  'mLLLLmLLLLLL',
]);
const FZ_LESHY_ARMS = fzMirror([
  'w..m...m..w.',
  'lwm.mMm.wl.m',
  '.lMmmMlwl.mM',
  '..mMMlwLLmMm',
  '..lwlLLLLLLm',
  '...LLLLLLLLL',
  '...LLLEELLLL',
  '....LLEkLLLL',
  '....LLLLLLlL',
  '....LLLLLkkk',
  '...LLmMLLkLL',
  '..LLmMmmLLLL',
  '.LLxLmMmMmMm',
  'LLxqLmmMmMmM',
  'LL.LLmMmmMmM',
  'L..LLLmMmMmm',
  'w..LLLlLmMmm',
  'w..LLlLLLmMm',
  '...LLLLLkLmm',
  '...LLLlLLkLL',
  '...LLLLLLLlL',
  '...LLlLLLLLL',
  '...LLLLL.LLL',
  '...LLlLL.LLL',
  '...LLLLL.LLL',
  '..LLLLLL.LLL',
  '.LLlLLLL.LLL',
  'LLLmLLLLL.LL',
  'mLLLLmLLLLLL',
]);
// КИКИМОРА — 20×22: длинные волосы до самой тины, глаза залиты светом, руки от плеч
const FZ_KIK_A = [
  '.......hhhhhh.......',
  '.....hhHhhhhHhh.....',
  '....hhhhHhhhhhhh....',
  '...hhhhgggggghhhh...',
  '...hhhgggggggghhh...',
  '..hhhggEEggEEgghhh..',
  '..hhhggEEggEEgghhh..',
  '..hhhgggggggggghhh..',
  '..hhHggtgttgtgghhh..',
  '..hhhgggttttgggHhh..',
  '..hhhhgggggggghhhh..',
  '..hhhh.gggggg.hhhh..',
  '.hhHhhrrrggrrrhhhHh.',
  '.hhhhrrrrrrrrrrhhhh.',
  '.hhHgrrrrrrrrrrghHh.',
  '.hhhg.rrrrrrrr.ghhh.',
  '.hhHg.rrRrrRrr.ghHh.',
  '.hhhg.rrrrrrrr.ghhh.',
  'hhhHgg.rrrrrr.gghHhh',
  'hhh.tg.rrrrrr.gt.hhh',
  'hh..t..rrrrrr..t..hh',
  'h...u.uuuuuuuu.u...h',
];
const FZ_KIK_B = [   // руки вскинуты в стороны когтями вверх
  '.......hhhhhh.......',
  '.....hhHhhhhHhh.....',
  '....hhhhHhhhhhhh....',
  '...hhhhgggggghhhh...',
  '...hhhgggggggghhh...',
  '..hhhggEEggEEgghhh..',
  '..hhhggEEggEEgghhh..',
  't.hhhgggggggggghhh.t',
  'tg.hhggtgttgtgghh.gt',
  '.g.hhgggttttgggHh.g.',
  '.gg.hhgggggggghh.gg.',
  '..g.hh.gggggg.hh.g..',
  '..ggrrrrrggrrrrrgg..',
  '..hhhrrrrrrrrrrhhh..',
  '.hhHhrrrrrrrrrrhHhh.',
  '.hhhh.rrrrrrrr.hhhh.',
  '.hhHh.rrRrrRrr.hHhh.',
  '.hhhh.rrrrrrrr.hhhh.',
  'hhhHhh.rrrrrr.hhHhhh',
  'hhh.hh.rrrrrr.hh.hhh',
  'hh..h..rrrrrr..h..hh',
  'h...u.uuuuuuuu.u...h',
];
// ВОДЯНОЙ — 24×24: лягушачий рот с пилой зубов, выпученные жёлтые глаза, перепонки-уши, борода и волосы из тины,
// чешуя на плечах и ракушки в тине; из воды по грудь. B — вскинул перепончатые лапы
const FZ_VOD_A = fzMirror([
  '....A.a..a.A',
  '..a.AaaAaAaA',
  '.aAaaAAaaAaa',
  '.aAaSSSSSSSS',
  '..aSSjSSSSSS',
  '.ssSSSSSSSSj',
  'sbsSeeeSSSSS',
  'sbsSeekeSSSS',
  '.ssSSeeeSSSS',
  '..SSSSsSSSSs',
  '..SSjSSSSSjS',
  '..Skkkkkkkkk',
  '..Sktktktktt',
  '..SSktktktkk',
  '.aSSSSkkkkkk',
  'aAaaSSSSSSaA',
  'aAAaAaaSSaAa',
  'aAaAAaAaAaAA',
  'sSaAaAAaAAaA',
  'sSSaAaAaAaAA',
  'SSsSSaAaSSaA',
  'SsSsSSaASsSS',
  'sSsSsSsSSsSs',
  'SsSsSsSsSsSs',
]);
const FZ_VOD_B = fzMirror([
  'S...A.a..a.A',
  'Ss.aAaaAaAaA',
  'tS.aAAaaAaaA',
  'tS.aSSSSSSSS',
  '.S.aSjSSSSSS',
  '.Ss.SSSSSSSj',
  '.sbsSeeeSSSS',
  '.sbsSeekeSSS',
  '..ssSSeeeSSS',
  '..sSSSSsSSSs',
  '..SSSjSSSSjS',
  '..Skkkkkkkkk',
  '..Sktktktktt',
  '..SSktktktkk',
  '.aSSSSkkkkkk',
  'aAaaSSSSSSaA',
  'aAAaAaaSSaAa',
  'aAaAAaAaAaAA',
  'sSaAaAAaAAaA',
  'sSSaAaAaAaAA',
  'SSsSSaAaSSaA',
  'SsSsSSaASsSS',
  'sSsSsSsSSsSs',
  'SsSsSsSsSsSs',
]);
const FZ_RUS_A = [
  '...HhhhhhH...',
  '..hhhhhhhhhH.',
  '.hhhppppphhh.',
  '.hhpkpppkphh.',
  '.hhppppppHhh.',
  '.hhhppppphhh.',
  '.hhhhpppphhh.',
  '.hhhooppooh..',
  '.hhhpppppphh.',
  '..hhpppppphh.',
  '...hYTTTTY...',
  '...YTTTTTTY..',
  '..TTYTTYTTYT.',
  '..TTTYTTYTT..',
  '...TTTTTTTY..',
  '....TYTTTT.Y.',
  '.....CTTC.YTY',
  '......CC...CC',
];
const FZ_RUS_B = FZ_RUS_A.map((r, i) => i === 4 ? '.hhppcccpHhh.' : i === 5 ? '.hhhpcccphhh.' : r);
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
    les: fzSpr('les', FZ_LESHY), lesA: fzSpr('lesA', FZ_LESHY_ARMS),
    kikA: fzSpr('kikA', FZ_KIK_A), kikB: fzSpr('kikB', FZ_KIK_B),
    vodA: fzSpr('vodA', FZ_VOD_A), vodB: fzSpr('vodB', FZ_VOD_B),
    rusA: fzSpr('rusA', FZ_RUS_A), rusB: fzSpr('rusB', FZ_RUS_B),
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
    cutters++;
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
  const W = 180, H = 264, OX = 90, OY = 240;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d'), img = c.createImageData(W, H), D = img.data, SOL = new Uint8Array(W * H);
  const ph = p / 6 * Math.PI * 2, hit = lv === 2, blink = lv === 0 && p === 4, HY = -163;
  // палитра: зной от раскалённо-белого до бурого
  const K0 = [40, 16, 6], K1 = [78, 36, 14], K2 = [124, 64, 24], K3 = [178, 110, 38], K4 = [216, 162, 60], K5 = [238, 206, 122], K6 = [250, 234, 186], K7 = [255, 252, 232];
  const S0 = [92, 48, 22], S1 = [146, 92, 46], S2 = [198, 146, 88], S3 = [228, 192, 134], S4 = [246, 224, 176];
  const I0 = [46, 34, 28], I1 = [96, 82, 70], I2 = [164, 152, 136], I3 = [232, 228, 214], RU = [146, 70, 32], RED = [168, 44, 26], RED2 = [204, 82, 44];
  const dth = (x, y) => (FZ_B4[(y + OY) & 3][(x + OX) & 3] + 0.5) / 16;
  const hsh = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const P = (x, y, col, a = 1, sol = true) => {
    x = Math.round(x) + OX; y = Math.round(y) + OY;
    if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
    const i = (y * W + x) * 4, da = D[i + 3] / 255, oa = a + da * (1 - a);
    for (let k = 0; k < 3; k++) D[i + k] = Math.round((col[k] * a + D[i + k] * da * (1 - a)) / oa);
    D[i + 3] = Math.round(oa * 255);
    if (sol) SOL[y * W + x] = 1;
  };
  // заливка по условию: f(x, y) → цвет или null
  const R = (x0, y0, x1, y1, f, sol = true) => {
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      const col = f(x, y);
      if (col) P(x, y, col, col[3] === undefined ? 1 : col[3], sol);
    }
  };
  // толстая линия с сужением: f(t, край) → цвет
  const L = (x0, y0, x1, y1, r0, r1, f, sol = true) => {
    const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1, rm = Math.max(r0, r1) + 1;
    R(Math.min(x0, x1) - rm, Math.min(y0, y1) - rm, Math.max(x0, x1) + rm, Math.max(y0, y1) + rm, (x, y) => {
      const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / l2)), ex = x - x0 - dx * t, ey = y - y0 - dy * t, r = r0 + (r1 - r0) * t, d = Math.sqrt(ex * ex + ey * ey);
      return d <= r ? f(t, d > r - 1, ex * dy - ey * dx) : null;
    }, sol);
  };

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
  const sickle = (hx, hy, a) => {
    const ux = Math.cos(a), uy = Math.sin(a);
    let nx = uy, ny = -ux; if (nx < 0) { nx = -nx; ny = -ny; }
    L(hx - ux * 7, hy - uy * 7, hx + ux * 9, hy + uy * 9, 2.2, 2, (t, e) => e ? [70, 38, 18] : t > 0.3 && t < 0.4 ? [70, 38, 18] : [118, 70, 34]);   // рукоять
    L(hx + ux * 8, hy + uy * 8, hx + ux * 11, hy + uy * 11, 2.4, 2.4, (t, e) => e ? I0 : I1);                                                        // кольцо
    const bx = hx + ux * 11, by = hy + uy * 11, Rr = 17, cx = bx + nx * Rr, cy = by + ny * Rr, a0 = Math.atan2(by - cy, bx - cx);
    const sg = (-Math.sin(a0) * ux + Math.cos(a0) * uy) > 0 ? 1 : -1, SW = 3.7;
    R(cx - Rr - 2, cy - Rr - 2, cx + Rr + 2, cy + Rr + 2, (x, y) => {
      const dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy);
      let da = (Math.atan2(dy, dx) - a0) * sg; da = ((da % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      if (da > SW) return null;
      const t = da / SW, w = 5 * (1 - t) + 0.6;
      if (d > Rr + 0.5 || d < Rr + 0.5 - w) return null;
      if (d > Rr - 0.6) return I0;                                                        // обух
      if (d < Rr + 1.5 - w) return t > 0.3 && t < 0.75 && hsh(x * 3 + y) > 0.6 ? K7 : I3;  // жало блестит на солнце
      return hsh(x * 7 + y * 13) > 0.82 ? RU : I2;                                        // ржа
    });
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
  arm(1, pose.R);
  sickle(pose.R[0], pose.R[1], pose.R[2]);
  R(pose.R[0] - 4, pose.R[1] - 4, pose.R[0] + 4, pose.R[1] + 4, (x, y) => { const d = (x - pose.R[0]) ** 2 + (y - pose.R[1]) ** 2; return d <= 10 ? (d > 6 ? S1 : S2) : null; });   // кулак на рукояти
  for (const j of [-1, 0, 1]) {                                                       // когти поверх рукояти
    const a = pose.R[2] + Math.PI / 2, x = pose.R[0] + Math.cos(pose.R[2]) * j * 2.2 + Math.cos(a) * 3, y = pose.R[1] + Math.sin(pose.R[2]) * j * 2.2 + Math.sin(a) * 3;
    L(x, y, x + Math.cos(a - 0.6) * 4, y + Math.sin(a - 0.6) * 4, 1, 0.2, t => t > 0.7 ? K0 : K1);
  }

  // ---- передние половины петель вихря и полова
  loops(true); chaff(true);

  // ---- обводка: тёплая тёмно-бурая, без чёрного
  const OUTC = [58, 24, 8];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    if (SOL[i] || !(SOL[i - 1] || SOL[i + 1] || SOL[i - W] || SOL[i + W])) continue;
    const j = i * 4, a = 0.92, da = D[j + 3] / 255, oa = a + da * (1 - a);
    for (let k = 0; k < 3; k++) D[j + k] = Math.round((OUTC[k] * a + D[j + k] * da * (1 - a)) / oa);
    D[j + 3] = Math.round(oa * 255);
  }
  c.putImageData(img, 0, 0);
  return cv;
}
function fzNoonSprite(lv, p) {
  const k = 'noon' + lv + p;
  if (FZ_CVC[k]) return FZ_CVC[k];
  const px = fzNoonPx(lv, p);
  const cv = fzCanvas(k, 60, 88, 30, 80, c => { c.imageSmoothingEnabled = false; c.drawImage(px, -30, -80, 60, 88); });
  cv.fzPx = true;
  return cv;
}
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
// Банши: печальная и жуткая плакальщица в рваном саване, пиксель-арт 64×84 (1 пиксель = 1 пиксель спрайта, потом ×3 без сглаживания).
// Саван в складках и просвечивает, хвост рассыпается лоскутами и дымкой; лицо живое, но мёртвое: впалые глазницы с огоньками, дорожки слёз, скорбный рот (в крике — раскрыт).
// Руки тонкие, пальцы разведены веером и чуть загнуты. Всё симметрично относительно оси.
// lv — стадия крика: 0 покой, 1 замах (руки поднимаются, рот приоткрыт; так же опускаются), 2 крик. p — фаза парения (0..11); в покое на фазе 7 глаза закрыты.
const FZ_B4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
function fzBansheePx(lv, p) {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 84;
  const c = cv.getContext('2d'), OX = 32, OY = 30, ph = p / 12 * Math.PI * 2, wail = lv === 2, kk = lv / 2, lerp = (a, b) => a + (b - a) * kk, blink = lv === 0 && p === 7;
  const P = (x, y, col) => { c.fillStyle = col; c.fillRect(OX + x, OY + y, 1, 1); };
  const M = (x, y, col) => { P(x, y, col); P(-1 - x, y, col); };                    // x >= 0: пара пикселей, зеркально относительно оси
  const dth = (x, y) => (FZ_B4[y & 3][x & 3] + 0.5) / 16;
  const hsh = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const CORE = '#050d16', OUT = '#0c1a2c';
  const cxAt = y => Math.round(Math.sin(ph - y * 0.13) * (0.4 + y * 0.06));
  const hwAt = y => Math.round(y < 8 ? 8 + y * 0.1 : 9 - (y - 8) * 0.1);
  const bottom = x => 36 + Math.floor(hsh(x * 3.1) * 14) + Math.round(Math.sin(ph + x * 1.1) * 2);
  // холодный ореол вокруг савана: пиксельная дымка
  for (let y = 4; y < 44; y++) {
    const cx = cxAt(y), hw = hwAt(y);
    for (const [x, a] of [[cx - hw - 1, 0.28], [cx - hw - 2, 0.12], [cx + hw, 0.28], [cx + hw + 1, 0.12]]) if (dth(x, y) < 1 - y / 50) P(x, y, `rgba(120,235,235,${a})`);
  }
  // рваные лоскуты по бокам хвоста
  for (const [y0, len, sw] of [[20, 13, 5], [29, 15, 8], [37, 10, 5]]) for (const s of [-1, 1]) {
    for (let k = 0; k <= len; k++) {
      const t = k / len, y = y0 + k, x = s * (hwAt(y0) + Math.round(sw * t * t + Math.sin(ph + y0) * 1.5 * t)) + cxAt(y0);
      if (dth(x, y) > 1 - t * 0.85) continue;
      for (const o of [0, 1]) P(x + (s > 0 ? o : -o), y, `rgba(${100 + o * 25},${155 + o * 25},205,${0.62 - t * 0.3})`);
    }
  }
  // сам саван: сверху светлый, книзу темнее и прозрачнее; складки, кромки, дымчатый распад
  for (let y = 0; y <= 52; y++) {
    const cx = cxAt(y), hw = hwAt(y);
    for (let r = -hw; r < hw; r++) {
      const x = cx + r;
      if (y > bottom(x)) continue;
      const a = y < 24 ? 1 : 1 - (y - 24) / (bottom(x) + 5 - 24);
      if (a < 1 && dth(x, y) > a) continue;
      let col = y < 10 ? [205, 232, 246, 0.95] : y < 22 ? [152, 198, 230, 0.88] : y < 34 ? [104, 150, 204, 0.72] : [72, 112, 178, 0.56];
      const fold = (r + Math.round(Math.sin(y * 0.22 + ph + (r > 0 ? 1 : 0)) * 1.2) + 40) % 4 === 0;
      let d = 0;
      if (r === -hw || r === hw - 1) d = -38; else if (fold) d = -26; else if (r >= -3 && r <= -2) d = 16;
      if (y > 3 && y < 8 && Math.abs(r) === 5) d = -20;                          // сгиб на плечах
      P(x, y, `rgba(${col[0] + d},${col[1] + d},${Math.min(255, col[2] + d * 0.6)},${col[3]})`);
    }
  }
  // тёмная пустота в груди, внутри — холодный огонёк души
  for (let y = 3; y <= 17; y++) for (let x = -6; x < 6; x++) {
    const dx = (x + 0.5) / 5.6, dy = (y - 10) / 6.5, d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.55) P(x, y, 'rgba(5,18,34,0.82)'); else if (d < 1 && dth(x, y) > d) P(x, y, 'rgba(5,18,34,0.5)');
  }
  M(0, 9, 'rgba(150,255,235,0.95)'); M(0, 10, 'rgba(110,240,220,0.9)'); M(1, 9, 'rgba(110,240,220,0.4)'); M(1, 10, 'rgba(110,240,220,0.4)'); M(0, 8, 'rgba(110,240,220,0.35)'); M(0, 11, 'rgba(110,240,220,0.35)');
  // тёмные прорехи савана (парные)
  for (const [x, y, h] of [[4, 17, 5], [6, 25, 4], [2, 27, 5]]) for (let k = 0; k < h; k++) M(x + (k >> 1), y + k, 'rgba(6,20,36,0.6)');
  // тёмный капюшон за головой: острая макушка, рваная кромка на плечах
  for (let y = -21; y <= 4; y++) {
    const hw = y < -9 ? 2 + Math.round((y + 21) * 0.8) : 11 + (y > -3 ? 1 : 0);
    for (let x = 0; x < hw; x++) {
      if (y > 1 && (x + y) % 3 === 0) continue;                                   // зубья кромки
      const edge = x === hw - 1;
      M(x, y, edge ? 'rgba(20,34,56,0.98)' : y < -6 ? 'rgba(34,54,80,0.96)' : 'rgba(44,70,100,0.9)');
    }
  }
  // длинные седые космы по бокам: пряди разной длины, тают к кончикам; верх — седая макушка с пробором
  for (let k = 0; k < 5; k++) {
    const len = 20 + k * 3 + (k === 4 ? 4 : 0) + (kk * 2 | 0), top = -13 + (k > 2 ? k - 2 : 0);
    for (let y = top; y <= top + len; y++) {
      const t = (y - top) / len, w = Math.round(Math.sin(ph + y * 0.2 + k) * (t * 1.6));
      if (dth(5 + k, y) > 1 - t * t) continue;
      const x = 5 + k + Math.round(t * (k + 1) * 0.5) + w * (k > 1 ? 1 : 0);
      M(x < 0 ? 0 : x, y, k % 2 ? `rgba(120,150,188,${0.95 - t * 0.35})` : `rgba(176,200,224,${0.97 - t * 0.4})`);
    }
  }
  // лицо: овал, человеческие пропорции; свет сверху, тень по краям и под скулами
  const FW = [3, 4, 5, 5, 5, 5, 5, 5, 5, 4, 4, 3, 3, 2, 1];                           // полуширина строк от y = -15
  for (let i = 0; i < FW.length; i++) {
    const y = -15 + i;
    if (y > -2 && !wail) continue;
    for (let x = 0; x < FW[i]; x++) {
      const e = x === FW[i] - 1;
      M(x, y, e ? 'rgb(150,184,210)' : (y < -11 || x < 2) ? 'rgb(226,244,252)' : 'rgb(212,232,244)');
    }
  }
  if (wail) { M(0, 0, 'rgb(150,184,210)'); M(1, -1, 'rgb(190,214,230)'); }
  // волосы над лбом: пробор по центру, пряди падают на виски
  for (let y = -15; y <= -12; y++) for (let x = 0; x < 6; x++) {
    if (x === 0 && y >= -13) continue;
    const inFace = x < FW[y + 15];
    if (y === -15 && x > 3) continue;
    if (y > -14 && x < (y === -14 ? 4 : 5 - (y + 12))) continue;
    M(x, y, (x + y) & 1 ? 'rgb(176,200,224)' : 'rgb(130,158,192)');
  }
  M(4, -12, 'rgb(130,158,192)'); M(4, -11, 'rgb(176,200,224)'); M(4, -10, 'rgb(130,158,192)'); M(4, -9, 'rgb(176,200,224)');
  // брови-«домиком» (скорбь), впалые глазницы, огоньки, дорожки слёз
  for (const [x, y] of [[1, -11], [2, -11], [3, -10], [4, -10]]) M(x, y, 'rgb(70,96,128)');
  if (blink) for (const x of [1, 2, 3]) M(x, -8, 'rgb(60,84,116)');                  // веки
  else {
    for (const [x, y] of [[1, -9], [2, -9], [3, -9], [1, -8], [2, -8], [3, -8], [2, -7]]) M(x, y, CORE);
    M(2, -8, wail ? 'rgb(190,255,240)' : 'rgb(120,250,225)'); M(2, -9, 'rgb(230,255,250)');
  }
  for (const x of [1, 3]) M(x, -7, 'rgb(96,126,160)');                              // тень под глазами
  for (const y of [-6, -5, -4]) M(3, y, 'rgba(110,235,215,0.65)');                  // слёзы
  M(3, -3, 'rgba(110,235,215,0.35)');
  // скулы: впалые, тёмные
  M(4, -6, 'rgb(130,162,192)'); M(4, -5, 'rgb(130,162,192)'); M(3, -5, 'rgb(170,200,222)');
  // нос
  M(0, -6, 'rgb(150,184,210)'); M(0, -5, 'rgb(150,184,210)'); M(1, -4, 'rgb(130,160,190)');
  // рот
  if (wail) {
    for (const [x0, x1, y] of [[0, 1, -3], [0, 2, -2], [0, 2, -1], [0, 2, 0], [0, 1, 1]]) for (let x = x0; x <= x1; x++) M(x, y, CORE);
    M(0, -3, '#f2fbff'); M(1, -3, '#f2fbff'); M(2, -2, '#f2fbff'); M(1, 1, '#f2fbff'); M(0, 1, '#f2fbff'); M(2, 0, 'rgb(190,214,230)');
  } else if (lv === 1) {
    for (const [x0, x1, y] of [[0, 1, -4], [0, 2, -3], [0, 1, -2]]) for (let x = x0; x <= x1; x++) M(x, y, CORE);
    M(0, -4, '#f2fbff'); M(1, -4, '#f2fbff');
  } else {
    M(0, -4, CORE); M(1, -4, CORE); M(2, -3, CORE); M(0, -3, 'rgb(150,184,210)'); M(3, -4, 'rgb(130,160,190)');
  }
  // шея
  for (let y = wail ? 2 : -2; y <= 2; y++) for (let x = 0; x < 2; x++) M(x, y, 'rgba(190,216,234,0.95)');
  // руки: широкий рваный рукав тает в тощее предплечье; кисть — ладонь и четыре пальца веером с когтями
  const sw1 = Math.round(Math.sin(ph) * 1), sw2 = Math.round(Math.sin(ph * 2));
  for (const s of [-1, 1]) {
    const Q = (x, y, col) => P(s > 0 ? x : -1 - x, y, col);
    const hx = Math.round(lerp(11, 12)) + sw1, hy = Math.round(lerp(12, -14)) + sw2;
    const sx = 7, sy = 5, mx = (sx + hx) / 2 + 4, my = (sy + hy) / 2 + Math.round(lerp(3, 0));
    for (let m = 0; m <= 24; m++) {
      const t = m / 24, u = 1 - t, x = u * u * sx + 2 * u * t * mx + t * t * hx, y = u * u * sy + 2 * u * t * my + t * t * hy;
      const w = t < 0.4 ? 3 : 2, col = t < 0.4 ? 'rgba(150,198,230,0.9)' : t < 0.7 ? 'rgba(190,222,240,0.92)' : 'rgba(215,240,250,0.95)';
      for (let i = 0; i < w; i++) for (let j = 0; j < w; j++) Q(Math.round(x - w / 2 + 0.5) + i, Math.round(y - w / 2 + 0.5) + j, (i === 0 && j === w - 1 && t < 0.4) ? 'rgba(90,130,180,0.9)' : col);
    }
    for (const [t, l] of [[0.1, 5], [0.22, 7], [0.34, 5]]) {                           // лохмотья рукава
      const u = 1 - t, x = Math.round(u * u * sx + 2 * u * t * mx + t * t * hx), y = Math.round(u * u * sy + 2 * u * t * my + t * t * hy) + 2;
      for (let k = 0; k < l; k++) if (dth(x + k, y + k) < 1 - k / l) Q(x + (kk < 0.5 ? 1 : 0), y + k, `rgba(120,172,214,${0.7 - k * 0.08})`);
    }
    // кисть
    const dir = lerp(Math.PI / 2 - 0.3, -Math.PI / 2 + 0.3), ca = Math.cos(dir), sa = Math.sin(dir);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) Q(hx + i, hy + j, 'rgba(205,234,247,0.95)');
    const line = (x0, y0, x1, y1, col, th) => {
      const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
      for (let k = 0; k <= n; k++) { const x = Math.round(x0 + (x1 - x0) * k / n), y = Math.round(y0 + (y1 - y0) * k / n); Q(x, y, col); if (th > 1) Q(Math.abs(x1 - x0) > Math.abs(y1 - y0) ? x : x + 1, Math.abs(x1 - x0) > Math.abs(y1 - y0) ? y + 1 : y, col); }
    };
    for (const j of [-1.5, -0.5, 0.5, 1.5]) {
      const outer = Math.abs(j) > 1, a = dir + j * 0.42;
      const bx = hx + ca * 1.5 - sa * j * 1.1, by = hy + sa * 1.5 + ca * j * 1.1;
      const l1 = outer ? 3.6 : 4.6, l2 = outer ? 2.8 : 3.6, a2 = a - j * 0.3, a3 = a2 - j * 0.35;
      const x1 = bx + Math.cos(a) * l1, y1 = by + Math.sin(a) * l1, x2 = x1 + Math.cos(a2) * l2, y2 = y1 + Math.sin(a2) * l2;
      line(bx, by, x1, y1, 'rgb(205,232,246)', 2);
      line(x1, y1, x2, y2, 'rgb(222,242,252)', outer ? 1 : 2);
      line(x2, y2, x2 + Math.cos(a3) * 3, y2 + Math.sin(a3) * 3, '#ffffff', 1);
    }
  }
  return cv;
}
function fzBansheeSprite(lv, p) {
  const k = 'ban' + lv + p;
  if (FZ_CVC[k]) return FZ_CVC[k];
  const px = fzBansheePx(lv, p);
  const cv = fzCanvas(k, 64, 84, 32, 30, c => { c.imageSmoothingEnabled = false; c.drawImage(px, -32, -30, 64, 84); });
  cv.fzPx = true;
  return cv;
}
// Призрачный волк: тощий, горбатый, ощеренный — вздыбленный загривок, видны рёбра, пасть с клыками, злой прищур.
// Мех клочьями, лапы и хвост рассыпаются в дымку. f — кадр бега 0..3, howl — морда вверх
function fzWolfSprite(f, howl) {
  return fzCanvas('wolf' + f + (howl ? 'h' : ''), 84, 54, 42, 46, c => {
    const t = f / 4 * Math.PI * 2;
    let sd = (f * 977 + (howl ? 55 : 3)) % 2147483647;
    const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const g = c.createLinearGradient(0, -34, 0, 4);
    g.addColorStop(0, 'rgba(214,232,252,0.96)'); g.addColorStop(0.5, 'rgba(150,186,230,0.8)'); g.addColorStop(1, 'rgba(96,136,200,0.15)');
    const fur = g;
    // зловещее свечение вокруг
    const gl = c.createRadialGradient(0, -16, 4, 0, -16, 34); gl.addColorStop(0, 'rgba(120,200,255,0.22)'); gl.addColorStop(1, 'rgba(120,200,255,0)');
    c.fillStyle = gl; c.fillRect(-42, -46, 84, 54);
    // хвост: низкий, дымный, рассыпается
    const tg = c.createLinearGradient(-16, -14, -40, -10); tg.addColorStop(0, 'rgba(170,200,238,0.85)'); tg.addColorStop(1, 'rgba(150,190,235,0)');
    c.strokeStyle = tg; c.lineWidth = 5.4; c.beginPath(); c.moveTo(-18, -18); c.bezierCurveTo(-26, -18, -32, -12 + Math.sin(t) * 2, -41, -11 + Math.sin(t + 1) * 3); c.stroke();
    c.lineWidth = 2.4; c.strokeStyle = 'rgba(220,238,255,0.5)'; c.beginPath(); c.moveTo(-18, -19); c.bezierCurveTo(-26, -20, -32, -14, -40, -14 + Math.sin(t + 1) * 3); c.stroke();
    // лапы
    const leg = (x, ph, far) => {
      const sw = Math.sin(t + ph) * 5.5, lift = Math.max(0, Math.cos(t + ph)) * 3;
      const kx = x + sw * 0.5, ky = -7 - lift, fx = x + sw, fy = -lift;
      c.strokeStyle = far ? 'rgba(112,146,200,0.75)' : fur; c.lineCap = 'round';
      c.lineWidth = 5.2; c.beginPath(); c.moveTo(x, -15); c.lineTo(kx, ky); c.stroke();
      c.lineWidth = 3; c.beginPath(); c.lineTo(kx, ky); c.lineTo(fx, fy); c.stroke();
      c.strokeStyle = far ? 'rgba(200,225,250,0.6)' : 'rgba(240,250,255,0.95)'; c.lineWidth = 0.7;
      for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(fx + 1 + k * 0.9, fy); c.lineTo(fx + 3.2 + k * 1.1, fy + 1.4); c.stroke(); }     // когти
    };
    leg(11, 0, true); leg(-12, Math.PI, true);
    // туловище: горб загривка, тонкая талия, глубокая грудь
    c.fillStyle = fur;
    c.beginPath(); c.moveTo(-21, -15); c.bezierCurveTo(-21, -24, -12, -26, -4, -23); c.bezierCurveTo(1, -24, 6, -32, 13, -29); c.bezierCurveTo(20, -26, 22, -18, 17, -11); c.bezierCurveTo(12, -6, 5, -9, 0, -10); c.bezierCurveTo(-8, -8, -21, -8, -21, -15); c.closePath(); c.fill();
    // рёбра — видна пустота внутри
    c.strokeStyle = 'rgba(54,84,140,0.55)'; c.lineWidth = 0.9;
    for (let i = 0; i < 4; i++) { const x = -3 + i * 3.6; c.beginPath(); c.moveTo(x, -22 + (i > 1 ? 2 : 0)); c.quadraticCurveTo(x + 3.4, -17, x + 1.6, -11); c.stroke(); }
    // вздыбленный загривок
    c.fillStyle = 'rgba(230,242,255,0.95)';
    for (let i = 0; i < 9; i++) { const x = -18 + i * 3.7, base = -24 - Math.max(0, i - 3) * 0.9, h = 5 + (i % 2) * 2.2 + (i > 3 ? 1.5 : 0); c.beginPath(); c.moveTo(x, base + 1.5); c.lineTo(x + 1.4 + Math.sin(t + i) * 0.5, base - h); c.lineTo(x + 3.2, base + 1); c.fill(); }
    // шея и голова (опущена, пасть оскалена)
    const hy = howl ? -10 : 0;
    c.fillStyle = fur;
    c.beginPath(); c.moveTo(11, -29); c.lineTo(22 + (howl ? -3 : 0), -28 + hy * 0.4); c.lineTo(27, -20 + hy * 0.5); c.lineTo(18, -10); c.closePath(); c.fill();
    c.save(); c.translate(howl ? 21 : 27, howl ? -35 : -19); c.rotate(howl ? -0.95 : 0.3);
    // нижняя челюсть: отвисла
    c.fillStyle = 'rgba(180,206,240,0.97)';
    c.beginPath(); c.moveTo(1, 2); c.lineTo(13.5, 8 + (howl ? 1 : 0)); c.lineTo(13, 10); c.lineTo(1, 5); c.closePath(); c.fill();
    // пасть изнутри
    c.fillStyle = '#10101e'; c.beginPath(); c.moveTo(3, 0); c.lineTo(14, 1); c.lineTo(13.5, 8); c.lineTo(2, 4); c.closePath(); c.fill();
    c.fillStyle = '#7a3a5a'; c.beginPath(); c.moveTo(5, 4); c.quadraticCurveTo(9, 3.4, 12, 6.4); c.lineTo(10, 7); c.closePath(); c.fill();     // язык
    // череп и верхняя челюсть
    c.fillStyle = 'rgba(204,224,248,0.98)';
    c.beginPath(); c.ellipse(0, -1, 6.8, 5, 0, 0, 7); c.fill();
    c.beginPath(); c.moveTo(3, -4); c.lineTo(15.5, -1.2); c.lineTo(15, 1.2); c.lineTo(3, 1.6); c.closePath(); c.fill();
    // клыки сверху и снизу
    c.fillStyle = '#f6fcff';
    for (const [x, y, l] of [[8, 1.4, 2.8], [11, 1.2, 3.6], [13.6, 1.2, 2.4]]) { c.beginPath(); c.moveTo(x - 0.9, y); c.lineTo(x + 0.2, y + l); c.lineTo(x + 1, y); c.fill(); }
    for (const [x, y, l] of [[9, 7.2, 2.8], [12, 8, 3]]) { c.beginPath(); c.moveTo(x - 0.9, y); c.lineTo(x + 0.2, y - l); c.lineTo(x + 1, y); c.fill(); }
    // нос и морщины ярости
    c.fillStyle = '#0c1424'; c.beginPath(); c.arc(15.6, -0.8, 1.5, 0, 7); c.fill();
    c.strokeStyle = 'rgba(60,92,150,0.8)'; c.lineWidth = 0.7;
    c.beginPath(); c.moveTo(9, -3); c.lineTo(12.4, -2); c.moveTo(8.6, -1.6); c.lineTo(12, -0.6); c.stroke();
    // злой глаз: свечение, узкий зрачок, нависшая бровь
    c.fillStyle = 'rgba(154,255,255,0.4)'; c.beginPath(); c.arc(4.6, -1.7, 3.4, 0, 7); c.fill();
    c.fillStyle = '#c8ffff'; c.beginPath(); c.moveTo(2.4, -1.2); c.lineTo(7.2, -3); c.lineTo(6.4, -0.2); c.lineTo(2.8, 0.2); c.closePath(); c.fill();
    c.fillStyle = '#0c1a2c'; c.fillRect(4.6, -2.3, 1, 1.8);
    c.fillStyle = '#26406c'; c.beginPath(); c.moveTo(1.4, -4.4); c.lineTo(8.2, -3.4); c.lineTo(7.8, -2.2); c.lineTo(1.6, -2.6); c.closePath(); c.fill();
    // уши прижаты назад
    c.fillStyle = 'rgba(176,204,240,0.98)';
    c.beginPath(); c.moveTo(-1, -4); c.lineTo(-9, -8); c.lineTo(-2, -0.4); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-3, -2); c.lineTo(-10.5, -3); c.lineTo(-4.4, 1.6); c.closePath(); c.fill();
    c.restore();
    leg(14, Math.PI * 0.5, false); leg(-8, Math.PI * 1.5, false);
    // нижняя часть растворяется: градиент и зерно
    c.globalCompositeOperation = 'destination-out';
    const gg = c.createLinearGradient(0, -11, 0, 4); gg.addColorStop(0, 'rgba(0,0,0,0)'); gg.addColorStop(1, 'rgba(0,0,0,0.95)');
    c.fillStyle = gg; c.fillRect(-44, -11, 88, 16);
    for (let n = 0; n < 260; n++) { const x = -22 + rnd() * 48, y = -22 + rnd() * 24; if (rnd() > Math.pow((y + 22) / 24, 1.8)) continue; c.fillStyle = `rgba(0,0,0,${0.5 + rnd() * 0.5})`; c.fillRect(x, y, 0.8 + rnd() * 1.2, 0.8 + rnd() * 1.2); }
    c.globalCompositeOperation = 'source-over';
    // искры холодной дымки
    for (let n = 0; n < 16; n++) { c.fillStyle = `rgba(200,236,255,${0.2 + rnd() * 0.4})`; c.fillRect(-26 + rnd() * 52, -8 + rnd() * 10, 0.8 + rnd(), 0.8 + rnd()); }
  });
}
function fzDrawHi(c, cv, x, y, a, face, dy) {
  const [ox, oy, w, h] = cv.fzO;
  c.save();
  c.globalAlpha *= a; c.imageSmoothingEnabled = !cv.fzPx;
  c.translate(Math.round(x * TILE), Math.round(y * TILE + dy));
  if (face < 0) c.scale(-1, 1);
  c.drawImage(cv, -ox, -oy, w, h);
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
  c.drawImage(spr, Math.round(-spr.width * S / 2), Math.round(-spr.height * S + (o.lift || 0)), spr.width * S, spr.height * S);
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
      fzDraw(c, arms ? S.lesA : S.les, L.x, L.y + 0.1, { a: L.alpha, dy: 4, s: 1, lift: Math.sin(L.ph * 2) > 0.7 ? 1 : 0 });
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
        fzDraw(c, rise && Math.floor(k.ph * 5) % 2 ? S.kikB : S.kikA, k.x, k.y, { a, dy: 4, face: k.face, lift: k.state === 'rest' ? 3 : 0 });
        if (k.state === 'rest') fzReeds(c, k.x, k.y, k.ph, a * 0.8);
      }
    }]);
  }
  const P = F.pond;
  if (P && vis(P.x, P.y) && P.vod.alpha > 0) {
    const v = P.vod, r = P.rus;
    list.push([v.y + 0.9, () => {
      fzRipple(c, v.x, v.y, v.ph, v.alpha, 14);
      fzDraw(c, v.state === 'grab' ? S.vodB : S.vodA, v.x, v.y + (v.state === 'grab' ? 0.05 : 0.18 + Math.sin(v.ph * 2) * 0.03), { a: v.alpha, dy: 4, face: v.face });
    }]);
    list.push([r.y + 0.2, () => {
      c.fillStyle = '#7a7872'; c.beginPath(); c.ellipse(Math.round(r.x * TILE), Math.round(r.y * TILE + 3), 9, 3, 0, 0, 7); c.fill();       // камень
      fzDraw(c, r.state === 'sing' && Math.floor(r.ph * 3) % 2 ? S.rusB : S.rusA, r.x, r.y, { a: r.alpha, dy: 3, lift: 0, face: 1 });
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
