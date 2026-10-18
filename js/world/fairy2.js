'use strict';
// Тёмные сказочные существа. Живут по ночам рядом с нечистью (night.js, ghosts.js, graveyard.js) и на её же правилах:
//  • КИКИМОРА — сидит в камышах у воды; хватает гнома с берега и тащит в тину, груз оставляет себе. Откуп — еда на кочке;
//  • ЛЕШИЙ — хозяин леса. Если за сутки срублено много деревьев, насылает «блуждания» на дровосеков (ходят кругами).
//    Хлеб на пне его смягчает;
//  • ВОДЯНОЙ и РУСАЛКА — в озере: водяной тащит груз с берега, русалка поёт и заманивает гномов к воде. Пиво в воду — утихают;
//  • БАНШИ — воет у кладбища и перед бедой гнома (журнал, мигание значка), пугает работников рядом;
//  • ПРИЗРАЧНЫЙ ВОЛК — ходит за ночной нечистью, воет, отнимает у гномов фонари. Костёр и герой его отгоняют.
// Существа не сохраняются (как призраки): с вечера заводятся заново. В сохранение идёт счётчик срубленного и гнев лешего (поле f2),
// итоги — в Game.faunaStat. Звуков нет — только floater-тексты.

const FZ_PAL = {
  k: '#10141a', e: '#f0f26a', E: '#c8ff6a', t: '#ece8d0',
  L: '#5a4630', l: '#8a7050', w: '#b09a70', M: '#3e6a2a', m: '#68a040',
  g: '#6a8a5a', G: '#4a6a40', h: '#2e4a2c', H: '#4a7a44', r: '#5a4632', R: '#3c2e20', u: '#3e3424',
  S: '#4a8a7c', s: '#2e6a5c', b: '#8ad0b0', a: '#2c6a3a', A: '#4a9a50',
  p: '#e6d4c4', P: '#c4a898', c: '#d4607a', T: '#3a9ab8', Y: '#78d4e4', C: '#2a7a98', j: '#58d8c8', J: '#2e9a98', o: '#e8a0b8',
  W: '#f6fbff', V: '#dce8f6', B: '#a8b8d8', D: '#6a7ea8', n: '#1a2438',
  f: '#b6c4e0', F: '#7684a8', y: '#9affff', d: '#56628a',
};
const fzSpr = (k, rows) => FZ_CACHE[k] || (FZ_CACHE[k] = faSprite(rows, FZ_PAL));
const FZ_CACHE = {};

// ---------- Карты ----------
const FZ_LESHY = [
  '..l.....mm.....l..',
  '..wl...mMMm...lw..',
  '...wl.lMMMMl.lw...',
  '....wlLLLLLLlw....',
  '.....LLLLLLLL.....',
  '....LLEkLLkELL....',
  '....LLEELLEELL....',
  '.....LLLLLLLL.....',
  '.....LmmmmmmL.....',
  '....MmmmMMmmmM....',
  '...LMmmmMMmmmML...',
  '..LLLMmMMMMmMLLL..',
  '.LLLLLLMMMMLLLLLL.',
  '.LlLLLLLLLLLLLLlL.',
  'LL.LLlLLLLLLlLL.LL',
  'Lw.LLLLLLLLLLLL.wL',
  'L..LLlLLLLLLlLL..L',
  '...LLLLLLLLLLLL...',
  '...LLLLLLLLLLLL...',
  '...LLl.LLLL.lLL...',
  '...LL..LLLL..LL...',
  '...LL..LLLL..LL...',
  '..LLL..LLLL..LLL..',
  '.LLLLL.LLLL.LLLLL.',
];
const FZ_LESHY_ARMS = [   // воздел руки-ветви: гневная поза
  'w..l.....mm.....l..w',
  'lw.wl...mMMm...lw.wl',
  '.lw.wl.lMMMMl.lw.wl.',
  '..lw.wlLLLLLLlw.wl..',
  '...L..LLLLLLLL..L...',
  '...LL.LLEkLLkELL.LL.',
  '....L.LLEELLEELL.L..',
  '.....LLLLLLLLLLLL...',
  '.....LmmmmmmmmmmL...',
  '....MmmmmMMmmmmmM...',
  '...LMmmmmMMmmmmmML..',
  '..LLLMmmMMMMmmMLLL..',
  '.LLLLLLMMMMMMLLLLLL.',
  '.LlLLLLLLLLLLLLLLlL.',
  '.L.LLlLLLLLLLLlLL.L.',
  '...LLLLLLLLLLLLLL...',
  '...LLLLLLLLLLLLLL...',
  '...LLLLLLLLLLLLLL...',
  '...LLl..LLLL..lLL...',
  '...LL...LLLL...LL...',
  '...LL...LLLL...LL...',
  '..LLL...LLLL...LLL..',
  '.LLLLL..LLLL..LLLLL.',
];
const FZ_KIK_A = [
  '..hh.Hh.hh..',
  '.hhHhhhhHhh.',
  'hhhggggggghh',
  'hhgeGggGegh.',
  'hhggggggggh.',
  '.hgggttttgg.',
  '.hhgggggghh.',
  '..hrrggrrh..',
  '.hrrrrrrrrh.',
  'ggrrrrrrrrgg',
  'g.rrrrrrrr.g',
  'g.rrRrrRrr.g',
  '..uuuuuuuu..',
];
const FZ_KIK_B = [   // тянет когтистые лапы вперёд-вверх
  '..hh.Hh.hh..',
  '.hhHhhhhHhh.',
  'hhhggggggghh',
  'hhgEkggkEgh.',
  'hhggggggggh.',
  '.hgtttttttg.',
  'g.hhgggggh.g',
  'g.hrrggrrh.g',
  'gg.rrrrrr.gg',
  'tg.rrrrrr.gt',
  '..rrrrrrrr..',
  '..rrRrrRrr..',
  '..uuuuuuuu..',
];
const FZ_VOD_A = [
  '....aa.aa.aa....',
  '...aSSSSSSSSa...',
  '..SSSSSSSSSSSS..',
  '..SSeeSSSSeeSS..',
  '..SSkeSSSSkeSS..',
  '..SSSSSSSSSSSS..',
  '..SSSbbbbbbSSS..',
  '...SbbbbbbbbS...',
  '...bbbbbbbbbb...',
  '..aSSSbbbbSSSa..',
  '.SSSSSSSSSSSSSS.',
  'sSSSSSSSSSSSSSSs',
];
const FZ_VOD_B = [   // воздет руки из воды
  'S...aa.aa.aa...S',
  'S..aSSSSSSSSa..S',
  'SS.SSSSSSSSSS.SS',
  'SS.SSeeSSSSeeSSS',
  '.S.SSkeSSSSkeSS.',
  '.SSSSSSSSSSSSSS.',
  '..SSSbbbbbbSSS..',
  '...SbbbbbbbbS...',
  '...bbbbbbbbbb...',
  '..aSSSbbbbSSSa..',
  '.SSSSSSSSSSSSSS.',
  'sSSSSSSSSSSSSSSs',
];
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
const FZ_RUS_B = FZ_RUS_A.map((r, i) => i === 4 ? '.hhppcccpHhh.' : i === 5 ? '.hhhpcccphhh.' : r);   // поёт: рот открыт
const FZ_BAN_A = [
  '...WWWWWW...',
  '..WWWWWWWW..',
  '.WWWVVVVWWW.',
  '.WWVnVVnVWW.',
  '.WWVnVVnVWW.',
  '.WWVVVVVVWW.',
  '.WWVVVVVVWW.',
  '.WWWVVVVWWW.',
  '.WWWBBBBWWW.',
  'WWWBBBBBBWWW',
  'WW.BBBBBBB.W',
  'W..BBDBBDBB.',
  'W..BBBBBBBB.',
  'W..BDBBBBDB.',
  '...BBBBBBBB.',
  '...BBDBBBDB.',
  '...BBBBBBBB.',
  '..BBDBBBBDBB',
  '..BBBBBBBBBB',
  '.BDBB.BB.BDB',
  '.B.B..BB..B.',
];
const FZ_BAN_B = FZ_BAN_A.map((r, i) => i === 5 ? '.WWVnnnnVWW.' : i === 6 ? '.WWVnnnnVWW.' : i === 7 ? '.WWWVnnVWWW.' : r);   // вой: рот раззявлен
const FZ_WOLF_A = [
  '...............w.w..',
  '..........wwwwwWWWw.',
  '.w.......wwwwwwWWykW',
  'ww.....wwwwwwwwwWWWn',
  'wWw.wwwwwwwwwwwwwWWn',
  'wwwwwwwwwwwwwwwwwwn.',
  '.wwwwwwwwwwwwwwwww..',
  '..fwwwwwwwwwwwwwww..',
  '...wd.wd......wd.wd.',
  '...wd.wd......wd.wd.',
  '...dd.dd......dd.dd.',
];
const FZ_WOLF_B = FZ_WOLF_A.slice(0, 8).concat(['..wd.wd.......wd.wd..', '..wd.wd.......wd.wd..', '..dd.dd.......dd.dd..']);
const FZ_MOUND = [
  '..mmm.mm..',
  '.mMMmmMMm.',
  'rrMrrMrrrr',
  'RrrrrrrrrR',
  '.RRRRRRRR.',
];
const FZ_BREAD = ['.rrrr.', 'rttttr', '.RRRR.'];

function fzSprites() {
  return {
    les: fzSpr('les', FZ_LESHY), lesA: fzSpr('lesA', FZ_LESHY_ARMS),
    kikA: fzSpr('kikA', FZ_KIK_A), kikB: fzSpr('kikB', FZ_KIK_B),
    vodA: fzSpr('vodA', FZ_VOD_A), vodB: fzSpr('vodB', FZ_VOD_B),
    rusA: fzSpr('rusA', FZ_RUS_A), rusB: fzSpr('rusB', FZ_RUS_B),
    banA: fzSpr('banA', FZ_BAN_A), banB: fzSpr('banB', FZ_BAN_B),
    wolfA: fzSpr('wolfA', FZ_WOLF_A), wolfB: fzSpr('wolfB', FZ_WOLF_B),
    mound: fzSpr('mound', FZ_MOUND), bread: fzSpr('bread', FZ_BREAD),
  };
}

// ---------- Состояние ----------
function fz() {
  return Game.fairy2 || (Game.fairy2 = { day: -1, cut: 0, angryUntil: 0, calmDay: -2, night: -1, kik: [], les: null, pond: null, ban: [], wolves: [], shore: null, lost: -1, omenAt: 0, lastCut: 0 });
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
  if (!act) { k.alpha = Math.max(0, k.alpha - dt * 0.5); return k.alpha <= 0 && !F.kikKeep; }
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
  if (!act) return a <= 0;
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
    w.ph += dt * 6; w.t += dt; w.howl -= dt; w.hold = Math.max(0, w.hold - dt);
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
      floater(w.x, w.y - 1.6, 'Ау-у-у-у!', '#cfe0ff');
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

// ---------- Главный тик ----------
function fairy2Tick(dt) {
  if (!FZ_ON()) return;
  const F = fz();
  F.acc = (F.acc || 0) + dt;
  fzSelfStep(F, dt);
}
function fzSelfStep(F, dt) {
  const ni = nightIndex(), eve = isEveningNow(), dawn = isDawnNow();
  if (eve && !dawn && F.night !== ni) { F.night = ni; fzSpawnNight(); }
  const act = fzDark() > 0.35 && !dawn;
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
}

// ---------- Рисование ----------
let FZS = null;
function fzDraw(c, spr, x, y, o = {}) {
  const px = Math.round(x * TILE), py = Math.round(y * TILE + (o.dy || 0));
  c.save();
  c.globalAlpha *= o.a === undefined ? 1 : o.a;
  c.imageSmoothingEnabled = false;
  c.translate(px, py);
  if (o.face < 0) c.scale(-1, 1);
  const S = o.s || 1;
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
  for (const b of F.ban) if (vis(b.x, b.y) && b.alpha > 0) list.push([b.y + 0.3, () => {
    fzDraw(c, b.wail > 0 ? S.banB : S.banA, b.x, b.y, { a: b.alpha, dy: 4 - 10 + Math.sin(b.ph * 1.7) * 3, face: b.face });
  }]);
  for (const w of F.wolves) if (vis(w.x, w.y) && w.alpha > 0) list.push([w.y + 0.1, () => {
    fzDraw(c, Math.floor(w.ph) % 2 ? S.wolfA : S.wolfB, w.x, w.y, { a: w.alpha, dy: 3 + Math.sin(w.ph) * 0.6, face: w.face });
    if (w.stole) { c.save(); c.globalAlpha *= w.alpha + 0.3; c.fillStyle = '#ffd880'; c.fillRect(Math.round(w.x * TILE + w.face * 11), Math.round(w.y * TILE - 8), 3, 4); c.restore(); }
  }]);
}
