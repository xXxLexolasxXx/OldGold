'use strict';
// Вольная живность по биомам и времени суток (в придачу к animals.js, fauna*.js, beasts.js).
// Отзыв игрока: «на карте одни феи». Здесь — мирные и редкие звери, которые показываются рядом с тем местом,
// куда смотрит игрок (в кооперативе — рядом с героями), не больше WL_SCREEN на экран и WL_MAX на всю карту:
//  • днём: заяц (зимой — беляк), стайка пичуг (зимой — снегири), фазан в лугах и степи, сурок у скал, выдра у воды;
//  • ночью: мотыльки у огней деревни; редкие — мшистый олень (днём) и звёздный лис (ночью).
// Виды открываются с днями (WL_SPEC.day), в первый день — только заяц и пичуги, чтобы не перегружать новичка.
// Все безобидны: пасутся, замечают гнома (реакция — 4 кадра), убегают или улетают. Кадры: покой 6, ходьба 6
// (крупные — 8), реакция 4, полёт 8 (пичуги) (КАДРЫ.md). Свой генератор случайных чисел — чужие события не сдвигаются.
// Список Game.wild в сейв не пишется (живность временная), в сейв идёт только Game.wlSeen — кого уже видели.
// В кооперативе считает сервер, клиенты получают список 'wild' зеркалом и только рисуют.

const WL_MAX = 12;          // на всю карту (телефон: каждый зверёк — один готовый спрайт за кадр)
const WL_SCREEN = 6;        // на один экран; стайка и рой считаются за одного
const WL_SPAWN_CD = [5, 9]; // пауза между попытками появления, с
const WL_SHY = 2.6;         // ближе — замечает гнома
const WL_RARE_GAP = 360;    // редкий зверь того же вида — не чаще раза в столько секунд

// day — с каких суток; t — 'day' | 'night'; at — где живёт; bio — вес по биомам; rare — не больше одного на карте
const WL_SPEC = {
  hare:     { name: 'Заяц',          day: 1, t: 'day',   at: 'edge',   w: 1.0, life: [70, 120], spd: 1.2, run: 3.6, bio: { steppe: 1.3, meadow: 1.2, winter: 1.3, swamp: 0.5, mountain: 0.6 } },
  bird:     { name: 'Пичуги',        day: 1, t: 'day',   at: 'edge',   w: 1.0, life: [40, 80],  spd: 0.7, run: 4.5, fly: 1, bio: {} },
  pheasant: { name: 'Фазан',         day: 2, t: 'day',   at: 'open',   w: 0.7, life: [60, 110], spd: 0.8, run: 3.0, bio: { steppe: 1.5, meadow: 1.1, forest: 0.4, mountain: 0.3, winter: 0.3 } },
  marmot:   { name: 'Сурок',         day: 2, t: 'day',   at: 'rock',   w: 0.8, life: [60, 120], spd: 0.9, run: 2.6, noWinter: 1, bio: { mountain: 1.7, steppe: 1.1, meadow: 0.5, forest: 0.3, swamp: 0.2 } },
  otter:    { name: 'Выдра',         day: 3, t: 'day',   at: 'shore',  w: 0.7, life: [60, 120], spd: 1.0, run: 2.8, noWinter: 1, bio: { swamp: 1.6, meadow: 0.9, forest: 0.9, steppe: 0.4, mountain: 0.5 } },
  moth:     { name: 'Мотыльки',      day: 2, t: 'night', at: 'light',  w: 0.9, life: [50, 90],  spd: 0.6, run: 2.0, fly: 1, noWinter: 1, bio: {} },
  stag:     { name: 'Мшистый олень', day: 6, t: 'day',   at: 'forest', w: 0.22, life: [60, 100], spd: 0.9, run: 4.2, rare: 1, bio: { forest: 1.6, swamp: 1.1, steppe: 0.3 } },
  starfox:  { name: 'Звёздный лис',  day: 9, t: 'night', at: 'edge',   w: 0.2, life: [50, 90],  spd: 1.3, run: 4.0, rare: 1, bio: { winter: 1.8 } },
};
const WL_KINDS = Object.keys(WL_SPEC);
// что говорит редкий зверь, если подойти (первая встреча ещё и пишется в журнал)
const WL_SAY = {
  stag: ['*шорох мха*', '*цветы на рогах качаются*'],
  starfox: ['*звёздный хвост искрит*', '*тихое «тяф»*'],
};

const WL = { rng: Math.random, cd: 3, view: null, viewT: -99, seq: 1, rareT: {} };
Game.wild = [];
Game.wlSeen = {};

function wlRnd(a, b) { return a + WL.rng() * (b - a); }
function wlSeed() { WL.rng = mulberry32((((Game.seed | 0) ^ 0x5EED17) + Math.floor(Game.time)) >>> 0); WL.cd = 3; WL.rareT = {}; }

// ---------- Где и когда ----------

const wlNight = () => (typeof nightAmt === 'function' ? nightAmt() : 0);
const wlWinter = () => (typeof isWinter === 'function' && isWinter()) || (typeof SEA === 'function' && SEA().snow > 0.5) || (typeof isWinterMap === 'function' && isWinterMap());
const wlBiome = () => (typeof biomeId === 'function' && biomeId()) || 'meadow';

// какие виды могут выйти прямо сейчас (с весами)
function wlOpenKinds() {
  const day = startDay(), n = wlNight(), win = wlWinter(), rain = typeof isRaining === 'function' && isRaining(), bio = wlBiome();
  const out = [];
  for (const k of WL_KINDS) {
    const S = WL_SPEC[k];
    if (day < S.day || (S.noWinter && win)) continue;
    if (S.t === 'day' ? n > 0.35 : n < 0.5) continue;
    if (rain && S.fly) continue;
    const w = S.w * (S.bio[bio] != null ? S.bio[bio] : 1);
    if (w > 0) out.push([k, w]);
  }
  return out;
}

// куда смотрит игрок; на сервере и в тестах — герои и центр деревни
function wlAnchors() {
  if (WL.view && Game.time - WL.viewT < 3) return [WL.view];
  const out = [];
  for (const u of Game.units) if (u.hero && !u.dead && !u.inside) out.push([u.x, u.y, 13, 8]);
  if (!out.length) out.push([MAP_W >> 1, MAP_H >> 1, 13, 8]);
  return out;
}
const wlInBox = (o, A, pad = 0) => Math.abs(o.x - A[0]) < A[2] + pad && Math.abs(o.y - A[1]) < A[3] + pad;

function wlTreesNear(x, y, r) {
  let n = 0;
  for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) {
    if (!inb(xx, yy)) continue;
    const o = World.obj[idx(xx, yy)];
    if (o && o.t === 'tree') n++;
  }
  return n;
}
function wlTerrNear(x, y, r, t) {
  for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) if (inb(xx, yy) && World.terrain[idx(xx, yy)] === t) return true;
  return false;
}
// огни деревни: двери готовых домов — у них ночью вьются мотыльки
function wlLight(A) {
  const bs = Game.buildings.filter(b => b.state === 'done' && !b.removed && Math.abs(b.doorX - A[0]) < A[2] + 2 && Math.abs(b.doorY - A[1]) < A[3] + 2);
  if (!bs.length) return null;
  const b = bs[Math.floor(WL.rng() * bs.length)];
  return [b.doorX + 0.5, b.doorY + 0.2];
}
function wlSpot(at, A) {
  if (at === 'light') return wlLight(A);
  for (let k = 0; k < 40; k++) {
    const x = Math.floor(A[0] + wlRnd(-A[2] + 1, A[2] - 1)), y = Math.floor(A[1] + wlRnd(-A[3] + 1, A[3] - 1));   // в кадре: появляется с проявлением
    if (!inb(x, y) || !isWalkable(x, y)) continue;
    const i = idx(x, y);
    if (World.terrain[i] !== T_GRASS || World.road[i] || World.bmap[i]) continue;
    if (Game.buildings.some(b => !b.removed && Math.abs(b.x + b.w / 2 - x) < b.w / 2 + 3 && Math.abs(b.y + b.h / 2 - y) < b.h / 2 + 3)) continue;
    if (nearestPerson({ x: x + 0.5, y: y + 0.5 }, 5)) continue;
    const tr = at === 'forest' || at === 'edge' || at === 'open' ? wlTreesNear(x, y, 3) : 0;
    if (at === 'forest' && tr < 5) continue;
    if (at === 'edge' && (tr < 1 || tr > 9)) continue;
    if (at === 'open' && tr > 2) continue;
    if (at === 'rock' && !wlTerrNear(x, y, 2, T_ROCK)) continue;
    if (at === 'shore' && !wlTerrNear(x, y, 1, T_WATER)) continue;
    return [x + 0.5, y + 0.5];
  }
  return null;
}

// ---------- Появление ----------

function wlMake(k, s) {
  const S = WL_SPEC[k], o = {
    id: WL.seq++, k, x: s[0], y: s[1], hx: s[0], hy: s[1], face: WL.rng() < 0.5 ? 1 : -1, st: 'idle', t: wlRnd(1, 4),
    life: wlRnd(S.life[0], S.life[1]), mv: 0, fade: 0, rt: 0, win: wlWinter() ? 1 : 0, sw: 0, n: 1, sc: 0,
  };
  if (k === 'bird') o.n = 3 + Math.floor(WL.rng() * 3);
  if (k === 'moth') { o.n = 2 + Math.floor(WL.rng() * 3); o.lx = s[0]; o.ly = s[1]; }
  return o;
}

function wlTrySpawn() {
  const kinds = wlOpenKinds();
  if (!kinds.length || Game.wild.length >= WL_MAX) return null;
  const anchors = wlAnchors(), A = anchors[Math.floor(WL.rng() * anchors.length)];
  if (Game.wild.filter(o => wlInBox(o, A, 3)).length >= WL_SCREEN) return null;
  // редкий вид — не больше одного; одинаковых обычных на экране — не больше двух (иначе снова «одни зайцы»)
  const ok = kinds.filter(([k]) => WL_SPEC[k].rare ? !Game.wild.some(o => o.k === k) && !(Game.time < (WL.rareT[k] || 0)) : Game.wild.filter(o => o.k === k && wlInBox(o, A, 3)).length < 2);
  if (!ok.length) return null;
  let r = WL.rng() * ok.reduce((s, [, w]) => s + w, 0), k = ok[0][0];
  for (const [kk, w] of ok) { r -= w; if (r <= 0) { k = kk; break; } }
  const s = wlSpot(WL_SPEC[k].at, A);
  if (!s) return null;
  const o = wlMake(k, s);
  Game.wild.push(o);
  if (WL_SPEC[k].rare) WL.rareT[k] = Game.time + WL_RARE_GAP;
  Game.wlN = Game.wlN || {};
  Game.wlN[k] = (Game.wlN[k] || 0) + 1;
  return o;
}

// ---------- Поведение ----------

// шаг к точке; выдра плавает, птицы летят над чем угодно
function wlMove(o, tx, ty, speed, dt) {
  const dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy);
  if (d < 0.08) { o.mv = 0; return true; }
  const s = Math.min(d, speed * dt), nx = o.x + dx / d * s, ny = o.y + dy / d * s;
  const S = WL_SPEC[o.k], cx = Math.floor(nx), cy = Math.floor(ny);
  if (!S.fly || o.st !== 'flee') {
    if (!inb(cx, cy)) { o.mv = 0; return false; }
    const t = World.terrain[idx(cx, cy)];
    const water = t === T_WATER;
    if (World.bmap[idx(cx, cy)] || t === T_ROCK || (water && o.k !== 'otter')) { o.mv = 0; return false; }
    if (o.k === 'otter') o.sw = water ? 1 : 0;
  }
  o.x = nx; o.y = ny; o.mv = 1;
  if (Math.abs(dx) > 0.02) o.face = dx > 0 ? 1 : -1;
  return s >= d;
}

function wlScare(o, p) {
  const S = WL_SPEC[o.k];
  o.st = 'react'; o.rt = 0; o.t = 0.7; o.mv = 0;
  o.face = p.x > o.x ? 1 : -1;
  const a = Math.atan2(o.y - p.y, o.x - p.x) + wlRnd(-0.5, 0.5), dist = S.fly ? 14 : 8;
  o.fx = o.x + Math.cos(a) * dist; o.fy = o.y + Math.sin(a) * dist;
  if (o.k === 'otter') { const w = wlWaterNear(o); if (w) { o.fx = w[0]; o.fy = w[1]; } }
  if (WL_SAY[o.k] && (p.hero || WL.rng() < 0.4)) {
    const say = WL_SAY[o.k];
    floater(o.x, o.y - 1.6, say[Math.floor(WL.rng() * say.length)], o.k === 'starfox' ? '#e8e0ff' : '#f0e0b0');
  }
  if (typeof faunaSfx === 'function') faunaSfx(o.k === 'bird' || o.k === 'pheasant' ? 'wingFlap' : o.k === 'marmot' ? 'peckWhistle' : o.k === 'otter' ? 'splash' : 'barkRustle', o.x, o.y, 0.7);
}
function wlWaterNear(o) {
  for (let r = 1; r <= 3; r++) for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2, x = Math.floor(o.x + Math.cos(a) * r), y = Math.floor(o.y + Math.sin(a) * r);
    if (inb(x, y) && World.terrain[idx(x, y)] === T_WATER) return [x + 0.5, y + 0.5];
  }
  return null;
}

// первая встреча с редким зверем — строчка в журнал (без всплывашки: оповещений и так хватает)
function wlSeen(o) {
  if (Game.wlSeen[o.k]) return;
  Game.wlSeen[o.k] = 1;
  if (WL_SPEC[o.k].rare) logEvent('animal', `Впервые замечен: ${WL_SPEC[o.k].name}`, o.x, o.y);
}

function wlThink(o, dt) {
  const S = WL_SPEC[o.k];
  o.life -= dt; o.t -= dt;
  const n = wlNight(), wrongTime = S.t === 'day' ? n > 0.5 : n < 0.3;
  if (o.fade) { o.fade += dt; return o.fade > 1.2; }
  if (o.life <= 0 || wrongTime) { o.fade = 0.01; return false; }
  if (o.k === 'moth') {           // мотыльки кружат у огня и людей не боятся
    o.mv = 1;
    return false;
  }
  if (o.st !== 'react' && o.st !== 'flee') {
    o.sc -= dt;
    if (o.sc <= 0) {
      o.sc = 0.35;
      const p = nearestPerson(o, WL_SHY, u => isPerson(u));
      if (p) { wlSeen(o); wlScare(o, p); return false; }
    }
  }
  if (o.st === 'react') { o.rt += dt; if (o.t <= 0) o.st = 'flee'; return false; }
  if (o.st === 'flee') {
    const done = wlMove(o, o.fx, o.fy, S.run, dt);
    if (o.k === 'otter' && o.sw) { o.fade = 0.01; return false; }     // нырнула
    if (done || !o.mv) { if (S.fly || o.life < 20) o.fade = 0.01; else { o.st = 'idle'; o.t = wlRnd(2, 4); o.hx = o.x; o.hy = o.y; } }
    return false;
  }
  if (o.st === 'walk') {
    if (wlMove(o, o.tx, o.ty, S.spd, dt) || !o.mv) { o.st = 'idle'; o.t = wlRnd(2, 6); o.mv = 0; }
    return false;
  }
  // покой: пасётся, клюёт, озирается; потом переходит на пару клеток
  if (o.t <= 0) {
    const a = WL.rng() * Math.PI * 2, r = wlRnd(0.8, o.k === 'stag' ? 3 : 2);
    o.tx = o.hx + Math.cos(a) * r; o.ty = o.hy + Math.sin(a) * r * 0.7;
    o.st = 'walk';
  }
  return false;
}

function wlTick(dt) {
  if (!Game.wild || !Game.units) return;
  WL.cd -= dt;
  if (WL.cd <= 0) {
    WL.cd = wlRnd(WL_SPAWN_CD[0], WL_SPAWN_CD[1]) * (startDay() <= 1 ? 1.6 : 1);    // в первый день живности поменьше
    if (!Game.stress) wlTrySpawn();
  }
  const list = Game.wild;
  for (let i = list.length - 1; i >= 0; i--) if (wlThink(list[i], dt)) list.splice(i, 1);
  // сбежавшие могли набиться в чужой кадр: лишние тихо уходят, кому меньше осталось — первыми
  WL.capT = (WL.capT || 0) - dt;
  if (WL.capT > 0) return;
  WL.capT = 1;
  for (const A of wlAnchors()) {
    const inA = list.filter(o => !o.fade && wlInBox(o, A, 3)).sort((a, b) => a.life - b.life);
    for (let i = 0; i < inA.length - WL_SCREEN; i++) inA[i].fade = 0.01;
  }
}

// ---------- Пиксель-арт (смотрят вправо; влево — отражением) ----------

const WL_PAL = {
  hare:   { h: '#9a7a54', H: '#c8a87e', e: '#5a4630', k: '#16120e', n: '#e09a9a', w: '#f2eee6', d: '#6a5236' },
  hareW:  { h: '#e6eaee', H: '#ffffff', e: '#2a2a30', k: '#16120e', n: '#e09a9a', w: '#ffffff', d: '#b0b8c4' },
  bird:   { b: '#8a6a4a', r: '#d8703a', t: '#4a3a2a', k: '#14100c', o: '#e0c060', l: '#5a4630', W: '#6a503a' },
  birdW:  { b: '#646a7a', r: '#e2483a', t: '#2a2a34', k: '#101014', o: '#3a3a40', l: '#3a3a40', W: '#2a2a34' },
  pheasant: { k: '#2a5a3a', g: '#2f7a4a', r: '#d8382a', o: '#e0c070', c: '#f0ece0', b: '#b0602a', B: '#d88a40', t: '#7a4a24', l: '#6a5236', y: '#14100c' },
  marmot: { m: '#a07a48', M: '#d0b080', k: '#16120e', n: '#4a3420', d: '#6a4a2a', i: '#f2eee6' },
  otter:  { o: '#6a4a30', O: '#b0906a', k: '#100c08', n: '#2a1a10', w: '#e0ecf4' },
  stag:   { a: '#e0d0a8', p: '#f0a0c8', P: '#f8e070', m: '#5a8a3a', M: '#86b85a', s: '#8a6a44', S: '#c4a476', k: '#14100c', n: '#2a1a10', d: '#4a3622' },
  starfox:{ x: '#3a4a8a', X: '#9ab0ec', K: '#20284a', k: '#f8f0c0', n: '#10142a', '*': '#f8eca0', '+': '#ffffff' },
};

const WL_ROWS = {
  hare: [
    '.........hh..',
    '.........he..',
    '........hhhh.',
    '........hhkhn',
    '..hhhhhhhhhh.',
    '.hhhhhhhhhh..',
    'whhhHHHHhh...',
    '.hhhHHHHh....',
    '..hh...hh....',
    '..dd...dd....',
  ],
  hareUp: [
    '.......hh....',
    '.......eh....',
    '......hhhh...',
    '......hhkhn..',
    '......hhhh...',
    '.....hhhhh...',
    '....hhHHh....',
    '...whhHHh....',
    '....hhhhh....',
    '....dd.dd....',
  ],
  bird: ['...bb..', '..bbkbo', 'tbbrrb.', '.bbrr..', '..l.l..'],
  birdPeck: ['.......', '...bb..', 'tbbrbbk', '.bbrrbo', '..l.l..'],
  pheasant: [
    '..........yk....',
    '.........gkrr...',
    '.........ggko...',
    '........cgg.....',
    'tt.....cbbb.....',
    '.ttbbbbbbbbb....',
    '..ttbbBBBbbb....',
    '....bbbbbbb.....',
    '.....l..l.......',
    '.....l..l.......',
  ],
  marmot: [
    '..........',
    '......mmm.',
    '.....mmkmn',
    '.mmmmmmmmi',
    'mmMMMMmm..',
    '.mmmmmmm..',
    '..d...d...',
  ],
  marmotUp: [
    '....mm....',
    '...mkmn...',
    '...mmmi...',
    '..mMMm....',
    '..mMMmd...',
    '..mMMm....',
    '..mmmm....',
    '.mmddm....',
  ],
  otter: [
    '..........ooo.',
    '.........ookon',
    'ooo.ooooooooO.',
    '.oooOOOOooo...',
    '..oo.....oo...',
  ],
  otterSwim: ['..ooo.', '.ookon', 'wwOOww'],
  stag: [
    '.............a..a.......',
    '............ap.aaP......',
    '.............aaaa.......',
    '..............aa........',
    '.............sss........',
    '............sssss.......',
    '............sskssn......',
    '.............sssss......',
    '............sss.........',
    '...mMmmMmmmsss..........',
    '..msssssssssss..........',
    '.ssssssssssss...........',
    '..sssSSSSSsss...........',
    '...ssSSSSSss............',
    '...ss.....ss............',
    '...ss.....ss............',
    '...dd.....dd............',
  ],
  starfox: [
    '............KK..',
    '...........KxxK.',
    '..........xxxkxn',
    '...........XXX..',
    '*.....xxxxxxx...',
    '+*.xxxxxxxxxx...',
    '.*+xxXXXXxxx....',
    '..*.xx....xx....',
    '....xx....xx....',
  ],
};

// сдвиг прямоугольника рядов на dy вниз (голова пасущегося оленя, клюющей птицы)
function wlShift(rows, r0, r1, c0, c1, dy) {
  const out = rows.map(r => r.padEnd(c1 + 1, '.').split(''));
  const block = [];
  for (let r = r0; r <= r1; r++) { block.push(out[r].slice(c0, c1 + 1)); for (let c = c0; c <= c1; c++) out[r][c] = '.'; }
  while (out.length < r1 + dy + 1) out.push('.'.repeat(out[0].length).split(''));
  block.forEach((b, i) => b.forEach((ch, j) => { if (ch !== '.') out[r0 + i + dy][c0 + j] = ch; }));
  return out.map(r => r.join(''));
}
// крылья поверх сидящей птицы: off — смещение кончиков крыла (-2 вверх … +2 вниз)
function wlWings(rows, cx, cy, span, off, ch) {
  const out = rows.map(r => r.split(''));
  for (let s = 1; s <= span; s++) {
    const y = cy + Math.round(off * s / span), xl = cx - s, xr = cx + s;
    for (const x of [xl, xr]) if (out[y] && x >= 0 && x < out[y].length) out[y][x] = ch;
  }
  return out.map(r => r.join(''));
}

const WL_CACHE = new Map();
function wlSprite(key, rowsFn, pal) {
  let s = WL_CACHE.get(key);
  if (!s) { s = afSprite(rowsFn(), pal, 'wl:' + key); WL_CACHE.set(key, s); }   // мелкий пиксель ×3 — animalart.js
  return s;
}
function wlBlit(c, spr, x, y, face, lift = 0, alpha = 1, shadow = true) {
  const w = afW(spr), h = afH(spr);
  if (shadow) { c.fillStyle = `rgba(10,8,4,${0.26 * alpha})`; c.beginPath(); c.ellipse(x, y, Math.max(2, w * 0.36), 1.4, 0, 0, 7); c.fill(); }
  c.imageSmoothingEnabled = false;
  c.save(); c.globalAlpha = alpha; c.translate(Math.round(x), Math.round(y - h - lift + 1));
  if (face < 0) c.scale(-1, 1);
  afBlit(c, spr, -Math.round(w / 2), 0);
  c.restore();
  c.imageSmoothingEnabled = R.smooth;
}

const WL_HOP = [0, 1, 3, 3, 1, 0];
const WL_FLAP8 = [-2, -1, 0, 1, 2, 1, 0, -1];
// номер кадра цикла из N по времени (в кооперативе клиент сам ведёт анимацию между снимками)
const wlFr = (o, rate, N) => Math.floor(Game.time * rate + o.id * 0.37) % N;

// какой кадр рисовать: [ключ кэша, ряды, подскок]
function wlFrame(o) {
  const k = o.k, st = o.st, R0 = WL_ROWS;
  if (k === 'hare') {
    if (st === 'react') { const i = Math.min(3, Math.floor(o.rt / 0.18)); return ['up' + i, () => i % 2 ? wlShift(R0.hareUp, 0, 1, 6, 9, 1) : R0.hareUp, i < 2 ? i : 0]; }   // 4 кадра: привстал, уши торчком/прижал
    if (o.mv) { const i = wlFr(o, st === 'flee' ? 14 : 8, 6); return ['w' + i, () => gaitRows(R0.hare, 2, 6, i), WL_HOP[i]]; }
    const i = wlFr(o, 3, 6);                                                        // покой 6: уши и нос шевелятся
    return ['i' + i, () => (i === 2 || i === 3) ? wlShift(R0.hare, 0, 1, 9, 10, 1) : i === 5 ? wlShift(R0.hare, 2, 3, 8, 12, 1) : R0.hare, 0];
  }
  if (k === 'bird') {
    const base = R0.bird, cx = 3, cy = 2, span = 3, wc = 'W';
    if (st === 'flee' || (st === 'react' && o.rt > 0.5)) { const i = wlFr(o, 16, 8); return ['f' + i, () => wlWings(base, cx, cy, span, WL_FLAP8[i], wc), 4 + (i % 4 > 1 ? 1 : 0)]; }   // полёт 8
    if (st === 'react') { const i = Math.min(3, Math.floor(o.rt / 0.14)); return ['r' + i, () => wlWings(base, cx, cy, Math.min(span, i + 1), -1, wc), 0]; }    // 4: крылья раскрываются
    if (o.mv) { const i = wlFr(o, 10, 6); return ['w' + i, () => base, WL_HOP[i] > 1 ? 1 : 0]; }
    const i = wlFr(o, 4, 6);
    return ['i' + i, () => (i === 1 || i === 4) ? R0.birdPeck : base, 0];        // покой: клюёт зёрна
  }
  if (k === 'pheasant') {
    if (st === 'react') { const i = Math.min(3, Math.floor(o.rt / 0.18)); return ['r' + i, () => wlWings(R0.pheasant, 8, 5, 2 + i, -1, 'B'), i]; }
    if (o.mv) { const i = wlFr(o, st === 'flee' ? 14 : 8, 6); return ['w' + i, () => gaitRows(R0.pheasant, 2, 6, i), 0]; }
    const i = wlFr(o, 2.5, 6);
    return ['i' + i, () => (i === 2 || i === 3) ? wlShift(R0.pheasant, 0, 3, 8, 13, 2) : R0.pheasant, 0];
  }
  if (k === 'marmot') {
    if (st === 'react') { const i = Math.min(3, Math.floor(o.rt / 0.18)); return ['r' + i, () => i === 0 ? R0.marmot : i === 3 ? wlShift(R0.marmotUp, 0, 2, 3, 7, 1) : R0.marmotUp, 0]; }   // встал столбиком и свистит
    if (o.mv) { const i = wlFr(o, st === 'flee' ? 14 : 9, 6); return ['w' + i, () => gaitRows(R0.marmot, 1, 6, i), 0]; }
    const i = wlFr(o, 2, 6);
    return ['i' + i, () => i === 4 ? R0.marmotUp : i === 1 ? wlShift(R0.marmot, 1, 3, 5, 9, 1) : R0.marmot, 0];
  }
  if (k === 'otter') {
    if (o.sw) { const i = wlFr(o, 4, 6); return ['s' + i, () => i % 3 === 2 ? R0.otterSwim.map(r => r.replace(/w/g, '.')) : R0.otterSwim, 0]; }
    if (st === 'react') { const i = Math.min(3, Math.floor(o.rt / 0.18)); return ['r' + i, () => i % 2 ? wlShift(R0.otter, 0, 1, 9, 13, 1) : R0.otter, i === 1 || i === 2 ? 1 : 0]; }   // 4: привстала, огляделась
    if (o.mv) { const i = wlFr(o, st === 'flee' ? 14 : 9, 6); return ['w' + i, () => gaitRows(R0.otter, 1, 6, i), 0]; }
    const i = wlFr(o, 2, 6);
    return ['i' + i, () => i === 2 || i === 3 ? wlShift(R0.otter, 0, 1, 9, 13, 1) : R0.otter, 0];
  }
  if (k === 'stag') {
    if (st === 'react') { const i = Math.min(3, Math.floor(o.rt / 0.18)); return ['r' + i, () => R0.stag, [0, 1, 2, 1][i]]; }
    if (o.mv) { const i = wlFr(o, st === 'flee' ? 12 : 7, 8); return ['w' + i, () => gaitRows(R0.stag, 3, 8, i), st === 'flee' ? [0, 1, 3, 4, 4, 3, 1, 0][i] : 0]; }   // крупный: 8 кадров
    const i = wlFr(o, 1.5, 6);
    return ['i' + i, () => i >= 2 && i <= 4 ? wlShift(R0.stag, 0, 8, 11, 18, i === 3 ? 6 : 5) : R0.stag, 0];   // пасётся: голова к траве
  }
  if (k === 'starfox') {
    if (o.mv) { const i = wlFr(o, st === 'flee' ? 14 : 9, 8); return ['w' + i, () => gaitRows(R0.starfox, 2, 8, i), 0]; }
    if (st === 'react') { const i = Math.min(3, Math.floor(o.rt / 0.18)); return ['r' + i, () => i === 1 || i === 2 ? wlShift(R0.starfox, 0, 1, 10, 15, 1) : R0.starfox, i === 2 ? 1 : 0]; }   // 4: прижал уши, припал
    const i = wlFr(o, 2, 6);
    return ['i' + i, () => i % 3 === 1 ? R0.starfox.map(r => r.replace(/\+/g, '*')) : i % 3 === 2 ? R0.starfox.map(r => r.replace(/\*/g, '+')) : R0.starfox, 0];   // хвост мерцает
  }
  return null;
}

function wlPal(o) {
  if (o.k === 'hare') return o.win ? WL_PAL.hareW : WL_PAL.hare;
  if (o.k === 'bird') return o.win ? WL_PAL.birdW : WL_PAL.bird;
  return WL_PAL[o.k];
}

function wlDraw(c, o) {
  const alpha = o.fade ? Math.max(0, 1 - o.fade / 1.2) : Math.min(1, (WL_SPEC[o.k].life[1] - o.life) / 1.5 + 0.2);
  const px = o.x * TILE, py = o.y * TILE + 3;
  if (o.k === 'moth') {          // мотыльки: 4 кадра крыла (мелкие, КАДРЫ.md — исключение), кружат вокруг огня
    for (let j = 0; j < o.n; j++) {
      const a = Game.time * (1.3 + j * 0.27) + j * 2.1 + o.id, r = 3 + j * 1.6;
      const mx = (o.lx || o.x) * TILE + Math.cos(a) * r, my = (o.ly || o.y) * TILE - 12 + Math.sin(a * 1.4) * r * 0.6;
      const f = Math.floor(Game.time * 18 + j) % 4, w = [0.6, 1.6, 2.4, 1.6][f];
      c.globalAlpha = alpha * 0.9;
      c.fillStyle = 'rgba(255,240,180,0.18)'; c.fillRect(mx - 3, my - 3, 6, 6);
      c.fillStyle = '#efe6cc'; c.fillRect(mx - w - 0.5, my - 0.5, w, 1.5); c.fillRect(mx + 0.5, my - 0.5, w, 1.5);
      c.fillStyle = '#8a7a5a'; c.fillRect(mx - 0.5, my - 1, 1, 2);
    }
    c.globalAlpha = 1;
    return;
  }
  const fr = wlFrame(o);
  if (!fr) return;
  const [key, rows, lift] = fr, pal = wlPal(o), spr = wlSprite(o.k + (o.win ? 'W' : '') + ':' + key, rows, pal);
  const fly = WL_SPEC[o.k].fly && (o.st === 'flee');
  if (o.k === 'bird') {          // стайка: каждая птичка со своим сдвигом и фазой
    for (let j = 0; j < o.n; j++) {
      const a = j * 2.4 + o.id, ox = Math.round(Math.cos(a) * (2 + j * 1.6)), oy = Math.round(Math.sin(a) * (1 + j));
      const sub = { id: o.id + j * 5, st: o.st, mv: o.mv || (!fly && Math.floor(Game.time * 0.7 + j) % 4 === 0), rt: o.rt, k: 'bird' };
      const f2 = wlFrame(sub);
      const s2 = wlSprite('bird' + (o.win ? 'W' : '') + ':' + f2[0], f2[1], pal);
      wlBlit(c, s2, px + ox, py + oy, j % 3 === 1 ? -o.face : o.face, f2[2] + (fly ? 6 + j * 2 + (o.rt || 0) : 0), alpha, !fly);
    }
    return;
  }
  if (o.k === 'otter' && o.sw) {
    c.strokeStyle = `rgba(235,245,255,${0.5 * alpha})`; c.lineWidth = 0.5;
    c.beginPath(); c.ellipse(px, py - 1, 5 + Math.sin(Game.time * 3) * 0.6, 1.4, 0, 0, 7); c.stroke();
  }
  if (o.k === 'starfox' || o.k === 'stag') {     // мягкое свечение редких зверей
    const g = o.k === 'starfox' ? '200,210,255' : '200,255,170', a2 = (o.k === 'starfox' ? 0.22 : 0.12) * alpha * (0.8 + 0.2 * Math.sin(Game.time * 3 + o.id));
    c.fillStyle = `rgba(${g},${a2})`; c.beginPath(); c.ellipse(px, py - afH(spr) * 0.45, afW(spr) * 0.55, afH(spr) * 0.5, 0, 0, 7); c.fill();
  }
  wlBlit(c, spr, px, py, o.face, lift + (fly ? 4 : 0), alpha, !(o.k === 'otter' && o.sw) && !fly);
  if (o.k === 'starfox' && o.mv) {          // звёздный след
    for (let j = 1; j <= 3; j++) {
      const tx = px - o.face * (7 + j * 3), ty = py - 5 + Math.sin(Game.time * 6 + j) * 1.2;
      c.fillStyle = `rgba(248,236,160,${(0.6 - j * 0.15) * alpha})`; c.fillRect(Math.round(tx), Math.round(ty), 1, 1);
    }
  }
}

function wlDrawList(list, c, x0, y0, x1, y1) {
  // запоминаем, куда смотрит игрок: зверьё выходит в кадр, а не на другом краю карты
  WL.view = [(x0 + x1) / 2, (y0 + y1) / 2, Math.max(8, (x1 - x0) / 2), Math.max(5, (y1 - y0) / 2)];
  WL.viewT = Game.time;
  for (const o of Game.wild || []) {
    if (o.x < x0 - 2 || o.x > x1 + 2 || o.y < y0 - 2 || o.y > y1 + 3) continue;
    list.push([o.k === 'moth' || (WL_SPEC[o.k].fly && o.st === 'flee') ? o.y + 3 : o.y + 0.15, () => wlDraw(c, o)]);
  }
}

// ---------- Подключение ----------

{
  const _step = step;
  step = function (dt) { _step(dt); if (!isMirror()) wlTick(dt); };
  const _bdl = beastsDrawList;
  beastsDrawList = function (list, c, x0, y0, x1, y1) { _bdl(list, c, x0, y0, x1, y1); wlDrawList(list, c, x0, y0, x1, y1); };
  const _reset = resetGameState;
  resetGameState = function () { _reset(); Game.wild = []; Game.wlSeen = {}; Game.wlN = {}; };
  const _setup = setupStart;
  setupStart = function (seed, ...o) { _setup(seed, ...o); Game.wild = []; Game.wlSeen = {}; Game.wlN = {}; wlSeed(); };
  const _ser = serializeGame;
  serializeGame = function () { const s = _ser(); s.wl = { seen: Object.keys(Game.wlSeen || {}) }; return s; };
  const _apply = applySave;
  applySave = function (s) {
    _apply(s);
    Game.wild = []; Game.wlN = {};
    Game.wlSeen = {};
    for (const k of (s.wl && s.wl.seen) || []) if (WL_SPEC[k]) Game.wlSeen[k] = 1;
    wlSeed();
  };
}
