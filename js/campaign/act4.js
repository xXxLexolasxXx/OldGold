'use strict';
// Кампания, акт 4 «Игра не стоит свеч» (КАМПАНИЯ.md §3): дорога на запад по дедовой карте. Колонна идёт от стоянки
// к стоянке, на стоянке зажигается большой костёр (у огня гоблины гномов не трогают), герой днём разведывает путь,
// а ночью отбивает погоню Шныря. Тролль из-под Брюзги обгоняет колонну и ставит на дороге ловушки (яма, сеть, обвал) —
// днём герой их снимает. Вторая ночь — поединок с Чемпионом гоблинов, на третью приходит сам король. У межевого камня
// с зелёным огнём погоня останавливается: дальше — земли Малгора. «Игра не стоит свеч. Буквально — он их гасит.»
// Дальше — сценарий «Тишина дороже золота» (акт 5, js/campaign/act5.js) с наследием кампании.

const CAMP4 = {
  W: 160, H: 72, seed: 400400,
  start: [150, 36],
  camps: [[118, 38], [84, 34], [50, 38]],     // стоянки по дням
  scouts: [[100, 30], [66, 44], [34, 32]],    // куда днём ходит герой на разведку
  stone: [26, 36],                            // межевой камень с зелёным огнём
  spire: [7, 28],                             // Чёрный шпиль вдали
  border: 30,                                 // западнее этой x — земли Малгора
};

// ---------- Карта: дорога с востока на запад, пустошь → луга ----------

const camp4RoadY = x => 36 + Math.sin(x * 0.07) * 4 + Math.sin(x * 0.19) * 1.5;

function camp4Map() {
  const { W, H } = CAMP4, m = meNew(W, H, 'meadow', 'Дорога на запад');
  m.seed = CAMP4.seed; m.nm = 'manual'; m.desc = 'Кампания, акт 4: дорога к Долине Старого Золота';
  const n1 = camp1Noise(51, 9), n2 = camp1Noise(52, 6), nf = camp1Noise(53, 7);
  const rnd = mulberry32(CAMP4.seed);
  const at = (x, y) => y * W + x;
  const roadY = camp4RoadY;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = at(x, y);
    if (y < 6 + (n1(x, y) - 0.5) * 6 || y > H - 7 + (n2(x, y) - 0.5) * 5) m.t[i] = 2;
    const rv = Math.abs(y - (20 + x * 0.05)) < 1.2 && x > 60 && x < 78;      // ручей
    if (rv && Math.abs(y - roadY(x)) > 2) m.t[i] = 1;
    if (x < 6 && y > 20 && y < 40) m.t[i] = 2;                                                   // скала под шпилем
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = at(x, y);
    if (m.t[i] === 2 && rnd() < 0.05) m.c[i] = 1;
    if (m.t[i] !== 0 || Math.abs(y - roadY(x)) < 3) continue;
    if (CAMP4.camps.concat([CAMP4.start, CAMP4.stone]).some(([cx, cy]) => Math.hypot(x - cx, y - cy) < 9)) continue;
    const f = nf(x, y), west = x < 90;                       // восток — пустошь, запад — луга с перелесками
    if ((west ? f > 0.5 : f > 0.74) && rnd() < 0.7) m.o[i] = rnd() < 0.25 ? 2 : 1;
    else if (!west && rnd() < 0.02) m.o[i] = 3;
  }
  m.start = CAMP4.start.slice();
  return m;
}

// ---------- Колонна, стоянки, погоня ----------

const camp4Ppl = () => Game.units.filter(u => !u.dead && isPerson(u) && u.type !== 'hero' && u.type !== 'carter');
const camp4Near = (p, r) => camp4Ppl().filter(u => Math.hypot(u.x - p[0], u.y - p[1]) <= r).length;
const camp4Night = () => isNightNow() || isEveningNow();

function camp4Go(C, p) { campMarch(camp4Ppl(), p[0], p[1], 3); C.flags.goal = p.slice(); }

// стоянка: большой костёр (у огня налётчики гномов не видят), рядом — колонна
function camp4Camp(C, k) {
  if ((C.flags.fires || []).includes(k)) return;
  const [x, y] = CAMP4.camps[k];
  for (let r = 0; r < 6; r++) for (let a = 0; a < Math.max(1, r * 8); a++) {
    const xx = Math.round(x + Math.cos(a) * r), yy = Math.round(y - 3 + Math.sin(a) * r * 0.6);
    if (checkPlacement('bonfire', xx, yy, 0)) continue;
    placeBuilding('bonfire', xx, yy, true, 0);
    (C.flags.fires || (C.flags.fires = [])).push(k);
    return;
  }
}

function camp4Chase(C, n, champs, king, trolls = 0) {
  const col = C.flags.goal || CAMP4.start;
  const x = Math.min(CAMP4.W - 4, col[0] + 26), y = col[1];
  C.flags.chaseT = Game.time;
  for (let k = 0; k < n; k++) campFoe('goblin', x + (k % 3), y - 2 + (k % 5), 'chase', { delay: k * 0.6, hunt: true });
  for (let k = 0; k < champs; k++) campFoe('goblinChamp', x + 2, y + k * 2, 'chase', { delay: 2 + k, hunt: true });
  for (let k = 0; k < trolls; k++) campFoe('campTroll', x + 4, y + 3 - k * 6, 'chase', { delay: 4 + k, hunt: true });
  if (king && !C.flags.kingOut) {
    C.flags.kingOut = 1;
    const N = campFoe('shnyr', x + 3, y, 'chase', { delay: 3, hunt: true });
    N.boss = 1;
  }
  if (typeof campSnd === 'function') campSnd('gobHorn', x, y, 1.2);
}

// король Шнырь в бою: крепок, но, получив своё, удирает (до межевого камня он ещё нужен)
if (typeof FSPEC !== 'undefined') {
  FSPEC.shnyr = { name: 'Король Шнырь Пороховой', mhp: 260, dmg: [6, 11], cd: 1.7, rng: 1.8, spd: 2.2, parry: 0.25, xp: 260, sz: 10,
    drop: [['gold', 6, 1]], draw: (c, N) => campDrawGoblin(c, N, 'shnyrKing'), ai: campGoblinAi,
    bar: (c, N, px, py) => { if (N.hp < N.mhp - 0.5) foeDrawBar(c, N, px, py - 62, true); } };
}

// поединок второй ночи: Чемпион бьётся только с героем, свита ждёт в сторонке. Чемпион пал — свита разбегается;
// герой тянет дольше двух минут — свите надоедает, и Чемпион становится обычной погоней
if (typeof FSPEC !== 'undefined' && FSPEC.goblinChamp) {
  FSPEC.champDuel = Object.assign({}, FSPEC.goblinChamp, { draw: (c, N) => campDrawGoblin(c, N, 'goblinChamp'),
    ai(N, dt) { const h = campHero(); if (h && !h.dead && N.ctag === 'duel') { N.tg = h.id; N.hunt = true; N.prov = Game.time; } campGoblinAi(N, dt); } });
}
function camp4Duelist(C) {
  const col = C.flags.goal || CAMP4.camps[1];
  campFoe('champDuel', Math.min(CAMP4.W - 4, col[0] + 9), col[1], 'duel', { delay: 1, hunt: true });
  C.flags.duelT = Game.time;
}
function camp4DuelTick(C) {
  if (C.flags.duelDone) return;
  const D = campFoes('duel')[0], late = Game.time - (C.flags.duelT || Game.time) > 120;
  if (!D) {
    C.flags.duelDone = 1; C.flags.duelWon = 1;
    const h = campHero();
    if (h) floater(h.x, h.y - 2.6, 'Чемпион повержен! Свита удирает', '#ffe080');
    for (const N of campFoes('chase')) { N.halt = 0; N.st = 'vanish'; N.vt = 0; }
    return;
  }
  if (late) { C.flags.duelDone = 1; D.ctag = 'chase'; campBark(D, 'Надоело! Все на них!'); for (const N of campFoes('chase')) N.halt = 0; return; }
  for (const N of campFoes('chase')) N.halt = N.st === 'emerge' && N.t < 0 ? 0 : 1;
}

// ---------- Ловушки тролля на дороге (дни 2 и 3) ----------
// Герой снимает ловушку, если дойдёт до неё первым; иначе она срабатывает на голове колонны (колонна идёт на запад)

const CAMP4_TRAPS = [[108, 'pit', 2], [96, 'net', 2], [72, 'rocks', 3], [60, 'pit', 3]];    // x на дороге, вид, день
const camp4Trap = i => { const [x, k, d] = CAMP4_TRAPS[i]; return { i, x, y: Math.round(camp4RoadY(x)), k, d }; };
const camp4TrapSt = (C, i) => (C.flags.traps || {})[i] || '';

function camp4TrapTick(C, day) {
  const T = C.flags.traps || (C.flags.traps = {}), h = campHero(), ppl = camp4Ppl();
  for (let i = 0; i < CAMP4_TRAPS.length; i++) {
    const t = camp4Trap(i);
    if (t.d !== day || T[i]) continue;
    if (h && !h.inside && Math.hypot(h.x - t.x - 0.5, h.y - t.y - 0.5) < 2) {
      T[i] = 'off';
      floater(t.x + 0.5, t.y - 1, 'Ловушка снята', '#a8e080');
      if (typeof logEvent === 'function') logEvent('gossip', 'Герой снял ловушку тролля на дороге', t.x, t.y);
      continue;
    }
    const lead = ppl.filter(u => u.march && u.x < t.x + 1.5 && Math.abs(u.y - t.y) < 6);
    if (lead.length) camp4TrapHit(C, t, lead.sort((a, b) => a.x - b.x));
  }
}

// колонна ждёт у костра, пока герой проверяет дорогу: до 40 с или пока ловушки дня не сняты
function camp4DayGo(C, day, p) {
  if (C.flags.goal && C.flags.goal[0] === p[0]) return;
  const w = C.flags.mw || (C.flags.mw = {});
  if (w[day] == null) w[day] = Game.time + 40;
  if (Game.time >= w[day] || !CAMP4_TRAPS.some((t, i) => t[2] === day && !camp4TrapSt(C, i))) camp4Go(C, p);
}

function camp4TrapHit(C, t, lead) {
  C.flags.traps[t.i] = 'hit';
  const cx = t.x + 0.5, cy = t.y + 0.5, hurt = n => { if (typeof injure === 'function') for (const u of lead.slice(0, n)) injure(u, Math.random() < 0.5 ? 'arm' : 'leg'); };
  if (t.k === 'pit') {
    const s = Game.buildings.find(b => b.type === 'storehouse' && !b.removed);
    if (s) s.stock.bread = Math.max(0, (s.stock.bread || 0) - 6);
    hurt(1);
    floater(cx, cy - 1.5, 'В яму! Телега без колеса, хлеба −6', '#f08a6a');
  } else if (t.k === 'net') {
    floater(cx, cy - 1.5, 'Сеть! Засада тролля!', '#f08a6a');
    const N = campFoe('campTroll', t.x - 2, t.y - 4, 'trap', { hunt: true });
    campBark(N, 'Попались! Тролль ужинает!');
  } else {
    const busy = new Set(Game.units.map(u => idx(Math.floor(u.x), Math.floor(u.y))));
    for (let k = 0; k < 14; k++) {
      const x = t.x - 2 + (k % 5), y = t.y - 2 + (k / 5 | 0) * 2, i = idx(x, y);
      if (inb(x, y) && World.terrain[i] === T_GRASS && !World.bmap[i] && !World.obj[i] && !busy.has(i)) setStone(i, 2);
    }
    hurt(2);
    PF.regT = -1e9;
    floater(cx, cy - 1.5, 'Обвал! Камни на дороге', '#f08a6a');
    fxBurst(cx * TILE, cy * TILE, 26, ['#8a7a6a', '#5a4a3a', '#c8b898'], 90, 80, 1.2, 3, 160);
    if (typeof campSnd === 'function') campSnd('campRockfall', t.x, t.y, 1);
  }
}

// вид ловушек: яма под листьями (сработала — открытая, с кольями), сеть с колокольцами, валуны на подпорке
function camp4DrawTrap(c, t, st) {
  const x = Math.round(t.x * TILE + 16), y = Math.round(t.y * TILE + 18), tm = Game.time;
  if (t.k === 'pit') {
    c.fillStyle = st ? '#1a120a' : '#5a4a26'; c.beginPath(); c.ellipse(x, y, 15, 6, 0, 0, 7); c.fill();
    if (st) { c.strokeStyle = '#8a6a3a'; c.lineWidth = 2; for (const dx of [-8, -3, 2, 7]) { c.beginPath(); c.moveTo(x + dx, y + 3); c.lineTo(x + dx + 1, y - 2); c.stroke(); } return; }
    for (const [dx, dy, col] of [[-9, -1, '#6a7a30'], [-3, 2, '#8a8a3a'], [4, -2, '#7a6a2a'], [9, 1, '#6a7a30'], [0, -3, '#9a8a40']]) { c.fillStyle = col; c.beginPath(); c.ellipse(x + dx, y + dy, 3.5, 1.6, dx * 0.2, 0, 7); c.fill(); }
    c.fillStyle = '#c8b080'; for (const dx of [-6, 1, 6]) { c.beginPath(); c.moveTo(x + dx - 1.5, y); c.lineTo(x + dx, y - 4); c.lineTo(x + dx + 1.5, y); c.fill(); }
  } else if (t.k === 'net') {
    c.strokeStyle = 'rgba(200,180,130,0.85)'; c.lineWidth = 1;
    for (let k = -3; k <= 3; k++) { c.beginPath(); c.moveTo(x + k * 5 - 6, y - 6); c.lineTo(x + k * 5 + 6, y + 6); c.moveTo(x + k * 5 + 6, y - 6); c.lineTo(x + k * 5 - 6, y + 6); c.stroke(); }
    c.fillStyle = '#e0c050'; for (const dx of [-14, 14]) { c.beginPath(); c.arc(x + dx + Math.sin(tm * 6 + dx) * 0.8, y - 6, 1.8, 0, 7); c.fill(); }
  } else {
    c.strokeStyle = '#6a4a2a'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(x - 10, y + 2); c.lineTo(x - 5, y - 16); c.stroke();
    c.strokeStyle = '#c8b080'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - 5, y - 16); c.quadraticCurveTo(x + 4, y - 6, x + 12, y); c.stroke();
    for (const [dx, dy, r] of [[-1, -19, 5], [5, -16, 4], [1, -24, 3.5]]) { c.fillStyle = '#7a7468'; c.beginPath(); c.ellipse(x + dx, y + dy, r, r * 0.8, 0, 0, 7); c.fill(); c.fillStyle = '#9a9488'; c.beginPath(); c.ellipse(x + dx - 1, y + dy - 1, r * 0.5, r * 0.35, 0, 0, 7); c.fill(); }
  }
}

function camp4DrawStone(c) {
  const t = Game.time, [sx, sy] = CAMP4.stone, x = Math.round(sx * TILE + 16), y = Math.round(sy * TILE + 26);
  c.fillStyle = 'rgba(10,8,4,0.35)'; c.beginPath(); c.ellipse(x, y + 1, 12, 3.5, 0, 0, 7); c.fill();
  c.fillStyle = '#4a4a5a'; c.beginPath(); c.moveTo(x - 9, y); c.lineTo(x - 7, y - 26); c.lineTo(x, y - 32); c.lineTo(x + 7, y - 27); c.lineTo(x + 9, y); c.closePath(); c.fill();
  c.fillStyle = '#6a6a7e'; c.beginPath(); c.moveTo(x - 7, y - 26); c.lineTo(x, y - 32); c.lineTo(x - 1, y - 2); c.lineTo(x - 8, y); c.closePath(); c.fill();
  c.strokeStyle = '#9cf06a'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - 3, y - 20); c.lineTo(x + 3, y - 14); c.moveTo(x + 3, y - 20); c.lineTo(x - 3, y - 14); c.stroke();   // знак
  // зелёный огонь на вершине: 5 кадров по времени
  const f = (t * 10 | 0) % 5, hs = [9, 11, 8, 12, 10][f];
  c.save(); c.globalCompositeOperation = 'lighter';
  c.fillStyle = 'rgba(120,255,90,0.35)'; c.beginPath(); c.ellipse(x, y - 36, 9, 12, 0, 0, 7); c.fill();
  c.fillStyle = '#9cf06a'; c.beginPath(); c.moveTo(x - 4, y - 32); c.quadraticCurveTo(x - 3 + f % 2, y - 32 - hs, x, y - 34 - hs); c.quadraticCurveTo(x + 3, y - 32 - hs * 0.6, x + 4, y - 32); c.closePath(); c.fill();
  c.fillStyle = '#e8ffc8'; c.fillRect(x - 1, y - 36, 2, 3);
  c.restore();
}

function camp4DrawSpire(c) {
  if (typeof foeTowerSprite !== 'function') return;
  const spr = foeTowerSprite(false), [sx, sy] = CAMP4.spire, t = Game.time;
  const ox = Math.round(sx * TILE - spr.cx), oy = Math.round(sy * TILE - spr.base);
  c.save(); c.globalAlpha = 0.85; c.drawImage(spr.cv, ox, oy); c.restore();
  c.save(); c.globalCompositeOperation = 'lighter';
  (spr.wins || []).forEach(([wx, wy, w, h], i) => { c.fillStyle = `rgba(150,255,100,${0.5 + 0.3 * Math.sin(t * 1.7 + i)})`; c.fillRect(ox + wx - w / 2, oy + wy - h / 2, w, h); });
  c.restore();
}

// телеги обоза (только вид): катятся в хвосте колонны, плавно догоняя её; с даром Кремнёвки — на одну больше
const CAMP4_CART = { C: null, t: 0, list: [] };
function camp4Carts() {
  const C = Game.camp, ppl = camp4Ppl();
  if (!ppl.length) return CAMP4_CART.list;
  let rear = 0, sy = 0;                                     // за серединой колонны (дальний отставший тянул бы обоз за край)
  for (const u of ppl) { rear += u.x; sy += u.y; }
  rear = Math.min(MAP_W - 12, rear / ppl.length + 3); sy /= ppl.length;
  const n = ((camp4Leg().a3 || {}).gift || {}).bread ? 3 : 2;
  if (CAMP4_CART.C !== C || CAMP4_CART.list.length !== n) {
    CAMP4_CART.C = C; CAMP4_CART.t = Game.time;
    CAMP4_CART.list = Array.from({ length: n }, (_, i) => ({ x: rear + 2 + i * 3.2, y: sy + [0.8, -0.8, 1.6][i], ph: i, flip: true }));
  }
  const dt = Math.min(0.5, Math.max(0, Game.time - CAMP4_CART.t));
  CAMP4_CART.t = Game.time;
  CAMP4_CART.list.forEach((k, i) => {
    const tx = rear + 2 + i * 3.2, ty = sy + [0.8, -0.8, 1.6][i], a = Math.min(1, dt * 0.8);
    const dx = (tx - k.x) * a, dy = (ty - k.y) * a;
    k.x += dx; k.y += dy; k.ph += Math.hypot(dx, dy);
    if (Math.abs(dx) > 0.002) k.flip = dx < 0;
  });
  return CAMP4_CART.list;
}

// ---------- Сценарий ----------

const camp4Leg = () => campProg().legacy || {};

// ожидание с подсказкой на экране: гномы на стоянке стоят нарочно (в пути им не до работы), и это надо объяснять
const CAMP4_REST = 'Гномы отдыхают у костра и не работают: они в походе. У огня гоблины гномов не трогают. Герой может осмотреться рядом.';
const camp4Wait = (label, t, until, hint = CAMP4_REST) => ({ k: 'goal', label, hint, objs: [{ id: 'w', t, cur: () => (until() ? 1 : 0) }] });

CAMP_ACTS[4] = {
  id: 4, name: 'Игра не стоит свеч', seed: CAMP4.seed, map: camp4Map,
  outro: 'Погоня осталась у межевого камня. Впереди — Долина Старого Золота и башня с зелёными окнами.',
  setup(C) {
    const L = camp4Leg(), want = Math.max(8, Math.min(50, (L.a2 && L.a2.saved) || 20));
    const [sx, sy] = CAMP4.start, extra = ['serf', 'farmer', 'baker', 'builder', 'woodcutter', 'serf', 'brewer', 'stonemason'];
    for (let k = 0; campPeople() < want && k < 60; k++) { const s = randomFreeNear(sx, sy + 2, 1, 8); if (s) spawnUnit(extra[k % extra.length], s[0], s[1]); }
    for (let i = Game.units.length - 1; i >= 0 && campPeople() > want; i--) { const u = Game.units[i]; if (u.type === 'serf') { Game.units.splice(i, 1); Game.unitMap.delete(u.id); if (u.releaseOcc) u.releaseOcc(); } }
    if (L.a2 && L.a2.vaska) { const s = randomFreeNear(sx + 2, sy, 0, 6); if (s) { const u = spawnUnit('smelter', s[0], s[1]); if (u) u.cname = 'Васька'; } }
    const store = Game.buildings.find(b => b.type === 'storehouse');
    const gift = (L.a3 && L.a3.gift) || {};
    Object.assign(store.stock, { bread: 20 + (gift.bread || 0), stone: 10 + (gift.stone || 0), timber: 10, sausage: 6 });
    C.flags.lost0 = Game.lostGnomes || 0;
    C.flags.resp = L.a3 ? L.a3.resp : 0;
    if (L.a3 && L.a3.zhab && typeof campZbJoin === 'function') campZbJoin(C, sx - 2, sy + 1);     // Жабьен из акта 3
  },
  tick(C, dt) {
    C.lost = Math.max(0, (Game.lostGnomes || 0) - (C.flags.lost0 || 0));
    // гоблин погони застрял в лесу вдали от колонны — «Отбить погоню» не должна висеть (у межевого камня погоня стоит нарочно)
    if (!campFoes('chase').some(N => N.halt)) campStragglers('chase', C.flags.chaseT, 300, 'Отставшие гоблины погони потеряли след.');
    // король, получив своё, удирает на восток — вернётся к межевому камню
    for (const N of campFoes('chase')) if (N.k === 'shnyr' && N.hp < N.mhp * 0.35 && !C.flags.kingFled) {
      C.flags.kingFled = 1; N.st = 'vanish'; N.vt = 0;
      floater(N.x, N.y - 3, 'Ай-ай! Не по-королевски!', '#ffe080');
    }
    if (typeof campZbTick === 'function') campZbTick(C, dt);
  },
  fail(C) { return campPeople() < 1 ? 'Колонна не дошла: в живых никого.' : null; },
  stars(C, S) { return 1 + (S.alive >= 18 ? 1 : 0) + ((C.flags.found || 0) >= 3 ? 1 : 0); },
  legacy(C, S) { return { a4: { arrived: S.alive, kingHit: !!C.flags.kingFled, found: C.flags.found || 0 } }; },
  legacyText(C) { return `до Долины дошли ${campPeople()} гномов — их и припасы обоза ждёт сценарий «Тишина дороже золота».`; },
  draw(list, c, x0, y0, x1, y1) {
    const [sx, sy] = CAMP4.stone, [px, py] = CAMP4.spire;
    if (sx > x0 - 3 && sx < x1 + 3 && sy > y0 - 3 && sy < y1 + 4) list.push([sy + 0.9, () => camp4DrawStone(c)]);
    if (px > x0 - 6 && px < x1 + 6 && py > y0 - 12 && py < y1 + 4) list.push([py + 0.5, () => camp4DrawSpire(c)]);
    for (let i = 0; i < CAMP4_TRAPS.length; i++) {
      const t = camp4Trap(i), st = camp4TrapSt(Game.camp, i);
      if (t.d > (Game.camp.flags.trapDay || 0) || st === 'off' || (st && t.k !== 'pit')) continue;
      if (t.x > x0 - 2 && t.x < x1 + 2 && t.y > y0 - 2 && t.y < y1 + 2) list.push([t.y + 0.2, () => camp4DrawTrap(c, t, st)]);
    }
    if (typeof campZbDraw === 'function') campZbDraw(list, c, x0, y0, x1, y1);
    if (typeof campDrawCartAt === 'function') for (const k of camp4Carts()) if (k.x > x0 - 3 && k.x < x1 + 3 && k.y > y0 - 2 && k.y < y1 + 3) list.push([k.y + 0.9, () => campDrawCartAt(c, k.x, k.y, k.ph, k.flip)]);
  },
  steps: [
    { k: 'cut', pause: true, cam: [140, 36], label: 'Дорога на запад', lines: [
      ['note', 'Дедова карта нарисована дедовой рукой: горы — треугольниками, реки — червячками, а Долина — большим жирным крестом.'],
      ['grum', 'Идём на запад. Три ночёвки — и мы на месте. Если крест не врёт.'],
      ['pim', 'Налево у сухого дуба, потом прямо до камня с огоньком. Я… читал.'],
      ['yagla', 'Пим, у тебя всё «читал». Ты что, и про нас читал, пока мы не пришли?'],
      ['pim', 'Ха-ха. Нет, конечно. Пошли?'],
      ['grum', 'За нами — Шнырь, за Шнырём — тролль из-под Брюзги. Каждый хочет свою долю. А мы, выходит, пирог.'],
      ['grum', 'Порядок такой: днём колонна шагает сама, в пути гномам не до работы. На ночь встаём у большого костра — у огня гоблины нас не трогают.'],
      ['grum', 'А ты, правнук, — глаза колонны. Иди вперёд, снимай ловушки и встречай гостей. Значки ◎ на карте покажут, куда.'],
    ] },
    { k: 'say', when: C => !!C.zb, lines: [
      ['zhab', 'Жабьен идёт рядом с героем. У Жабьена нос: гоблина чует за версту. Тролля — за две. Тролль не моется.'],
      ['yagla', 'Хоть кто-то в колонне чует что-то, кроме обеда.'],
    ] },
    { k: 'do', fn(C) { camp4Go(C, CAMP4.camps[0]); } },
    { k: 'check' },
    // ---- день 1
    { k: 'goal', label: 'День первый: в пути', hint: 'Колонна идёт сама, гномам в пути не до работы. Герой — на разведку вперёд: дойдите до ◎, а колонна догонит и станет у костра.',
      init(C) { if (!C.flags.march) camp4Go(C, CAMP4.camps[0]); },
      objs: [
        { id: 'camp', t: 'Дойти до первой стоянки', at: CAMP4.camps[0], need: 1, cur: () => (camp4Near(CAMP4.camps[0], 9) >= camp4Ppl().length * 0.7 ? 1 : 0) },
        { id: 'scout', t: 'Герой: разведать дорогу', zone: CAMP4.scouts[0].concat(3.2) },
      ] },
    { k: 'say', fx(C) { camp4Camp(C, 0); C.flags.found = (C.flags.found || 0) + 1; }, lines: [
      ['note', 'У дороги — старый верстовой камень. На нём клеймо: фонарь в круге.'],
      ['grum', 'Клеймо Фонарщиков. Сто лет назад они ставили такие вдоль всей дороги, чтобы гномы не плутали в темноте.'],
      ['grum', 'Слышишь, правнук? Это твои. Хорошо ставили — до сих пор стоит.'],
    ] },
    camp4Wait('Стоянка у костра', 'Дождаться ночи у костра', () => camp4Night()),
    { k: 'do', fn(C) { if (!C.flags.n1) { C.flags.n1 = 1; camp4Chase(C, 5, 0, false); } } },
    { k: 'say', lines: [['grum', 'Погоня! Все к костру — у огня они нас не видят. Герой — встречай гостей.']] },
    { k: 'goal', label: 'Ночь первая', hint: 'Гномы жмутся к костру. Гоблины пройдут сквозь круг света, но гномов в нём не тронут: бейте их героем, не давайте уйти к тем, кто вне круга.', objs: [{ id: 'n1', t: 'Отбить погоню', cur: () => (campFoes('chase').length ? 0 : 1) }] },
    camp4Wait('Ночь первая', 'Пережить ночь у костра', () => !camp4Night(), 'Гномы жмутся к огню и ждут утра. Круг света их защищает: гоблины проходят через него, но гномов внутри не трогают.'),
    // ---- день 2
    { k: 'cut', pause: true, cam: [104, 36], label: 'Следы на дороге', fx(C) { C.flags.trapDay = Math.max(2, C.flags.trapDay || 0); }, lines: [
      ['note', 'Утром на дороге — следы. Огромные, босые, по три пальца. Ночью кто-то обогнал колонну.'],
      ['troll', 'Тролль впереди. Тролль копал. Тролль ждёт.'],
      ['grum', 'Тролль наставил ловушек. Герой — вперёд, проверь дорогу. Колонна подождёт у костра, но недолго.'],
    ] },
    { k: 'goal', label: 'День второй: в пути', hint: 'Гномы стоят у костра не просто так: колонна ждёт героя (до 40 секунд). Ведите героя вперёд по дороге к значкам ◎ и снимите ловушки — потом колонна пойдёт сама.',
      during(C) { camp4DayGo(C, 2, CAMP4.camps[1]); camp4TrapTick(C, 2); },
      objs: [
        { id: 'trap0', t: 'Ловушка: волчья яма на дороге', at: [108, Math.round(camp4RoadY(108))], cur: C => (camp4TrapSt(C, 0) ? 1 : 0) },
        { id: 'trap1', t: 'Ловушка: сеть у дороги', at: [96, Math.round(camp4RoadY(96))], cur: C => (camp4TrapSt(C, 1) ? 1 : 0) },
        { id: 'camp', t: 'Дойти до второй стоянки', at: CAMP4.camps[1], cur: () => (camp4Near(CAMP4.camps[1], 9) >= camp4Ppl().length * 0.7 ? 1 : 0) },
        { id: 'scout', t: 'Герой: разведать брошенный лагерь', zone: CAMP4.scouts[1].concat(3.2) },
      ] },
    { k: 'say', fx(C) {
      camp4Camp(C, 1); C.flags.found = (C.flags.found || 0) + 1;
      const s = Game.buildings.find(b => b.type === 'storehouse' && !b.removed); if (s) s.stock.gold = (s.stock.gold || 0) + 10;
    }, lines: [
      ['note', 'В перелеске — заросший лагерь: обручи от бочек, ржавый котелок и истлевшая записка.'],
      ['yagla', '«Идём в горы. Долину оставляем Фонарщикам. Вернёмся, когда будет можно». Почерк прадеда Грума.'],
      ['grum', 'Сто лет «можно» не наступало. Ну что ж. Наступило без спросу. В котелке — десяток монет: прадед знал, что мы вернёмся.'],
    ] },
    camp4Wait('Стоянка у костра', 'Дождаться ночи у костра', () => camp4Night()),
    { k: 'do', fn(C) { if (!C.flags.n2) { C.flags.n2 = 1; camp4Chase(C, 6, 0, false); camp4Duelist(C); } } },
    { k: 'cut', cam: CAMP4.camps[1], label: 'Ночь вторая', lines: [
      ['champ', 'Эй, правнук Фонарщика! Выходи один на один! Победишь — уйдём до утра. Проиграешь — заберу бороду.'],
      ['champ', 'Чужую. У тебя своей маловато.'],
      ['grum', 'Гоблинская дуэль — это честно до первого удара в спину. Иди, правнук. Только спиной к нему не стой.'],
    ] },
    { k: 'goal', label: 'Ночь вторая: поединок', hint: 'Чемпион бьётся только с героем, свита ждёт. Победите его — свита разбежится.',
      during(C) { camp4DuelTick(C); },
      objs: [
        { id: 'duel', t: 'Победить Чемпиона в поединке', cur: C => (C.flags.duelDone ? 1 : 0) },
        { id: 'n2', t: 'Отбить погоню', cur: () => (campFoes('chase').length || campFoes('duel').length ? 0 : 1) },
      ] },
    camp4Wait('Ночь вторая', 'Пережить ночь у костра', () => !camp4Night(), 'Гномы ждут утра у костра. Дальше колонна пойдёт сама, как рассветёт.'),
    // ---- день 3
    { k: 'cut', pause: true, cam: [68, 36], label: 'Следы на дороге', fx(C) { C.flags.trapDay = 3; }, lines: [
      ['troll', 'Тролль снова впереди. Камни — наверху. Яма — внизу. Гномы — посередине.'],
      ['grum', 'Он ещё и стихи сочиняет. Герой, вперёд — снимать его поэзию с дороги.'],
    ] },
    { k: 'goal', label: 'День третий: в пути', hint: 'Гномы стоят у костра не просто так: колонна ждёт героя (до 40 секунд). Ведите героя вперёд по дороге к значкам ◎ и снимите ловушки — потом колонна пойдёт сама.',
      during(C) { camp4DayGo(C, 3, CAMP4.camps[2]); camp4TrapTick(C, 3); },
      objs: [
        { id: 'trap2', t: 'Ловушка: камни над дорогой', at: [72, Math.round(camp4RoadY(72))], cur: C => (camp4TrapSt(C, 2) ? 1 : 0) },
        { id: 'trap3', t: 'Ловушка: ещё одна яма', at: [60, Math.round(camp4RoadY(60))], cur: C => (camp4TrapSt(C, 3) ? 1 : 0) },
        { id: 'camp', t: 'Дойти до третьей стоянки', at: CAMP4.camps[2], cur: () => (camp4Near(CAMP4.camps[2], 9) >= camp4Ppl().length * 0.7 ? 1 : 0) },
        { id: 'scout', t: 'Герой: посмотреть, что за камень с огоньком', zone: CAMP4.scouts[2].concat(3.2) },
      ] },
    { k: 'say', fx(C) { camp4Camp(C, 2); C.flags.found = (C.flags.found || 0) + 1; }, lines: [
      ['note', 'Впереди, у самой дороги — межевой камень. На вершине горит огонь. Зелёный.'],
      ['grum', 'Огонь зелёный. Дрова, что ли, такие?'],
      ['pim', 'Это… граница. Дальше — чужие земли. Но там свободно. Совсем свободно. Я читал.'],
    ] },
    camp4Wait('Последняя стоянка', 'Дождаться ночи у костра', () => camp4Night()),
    { k: 'do', fn(C) { if (!C.flags.n3) { C.flags.n3 = 1; camp4Chase(C, 8, 2, true); } } },
    { k: 'cut', cam: [64, 38], label: 'Ночь третья', lines: [
      ['shnyr', 'Бородатые! Король лично пришёл попрощаться! С фейерверком!'],
      ['champ', 'Вчерашний Чемпион был ненастоящий! Я — настоящий! У меня и шлем есть!'],
      ['shnyr', 'Вот и покажи. А я покомандую. Издалека.'],
      ['grum', 'Сам Шнырь. В короне. На королевскую взбучку тоже, значит, лично.'],
    ] },
    { k: 'goal', label: 'Ночь третья', hint: 'Король крепок, но трусоват: поколотите его — удерёт.',
      objs: [{ id: 'n3', t: 'Отбить короля Шныря и его свиту', cur: () => (campFoes('chase').length ? 0 : 1) }] },
    camp4Wait('Ночь третья', 'Пережить ночь у костра', () => !camp4Night(), 'Гномы ждут утра у костра. Утром колонна пойдёт к межевому камню.'),
    // ---- к межевому камню
    { k: 'do', fn(C) {
      camp4Go(C, [CAMP4.stone[0] - 2, CAMP4.stone[1] + 2]);
      if (!C.flags.last) { C.flags.last = 1; camp4Chase(C, 6, 1, false, 1); C.flags.kingOut = 0; camp4Chase(C, 0, 0, true); }
    } },
    { k: 'goal', label: 'Межевой камень', hint: 'Погоня за спиной. Колонна — за камень, на запад.',
      objs: [{ id: 'cross', t: 'Довести колонну за межевой камень', at: CAMP4.stone, cur: () => (camp4Ppl().filter(u => u.x < CAMP4.border).length >= camp4Ppl().length * 0.8 ? 1 : 0) }],
      during() {
        // погоня у черты владений встаёт как вкопанная
        for (const N of campFoes('chase')) if (N.x < CAMP4.border + 8) N.halt = 1;
      } },
    { k: 'cut', pause: true, cam: [32, 36], fx(C) {
      for (const N of campFoes('chase')) N.halt = 1;
      C.flags.shnyrEnd = 1;
    }, lines: [
      ['note', 'Гоблины и тролль выбежали к камню — и встали. Даже самые глупые. Особенно самые глупые.'],
      ['shnyr', 'Стоять! Там Малгор. Игра не стоит свеч.'],
      ['gob', 'Каких свеч, ваше величество?'],
      ['shnyr', 'Любых. Буквально — он их гасит. Разворачиваемся!'],
      ['champ', 'Ваше величество, я их догоню! Я быстрый!'],
      ['shnyr', 'Догонишь. А обратно? Оттуда быстрыми не возвращаются. Оттуда вообще не возвращаются.'],
      ['troll', 'Зелёный огонь. Тролль помнит. Тролль не пойдёт. Тролль… подождёт.'],
      ['mrak', '…Шум. Опять шум.'],
      ['grum', 'Слыхали? Кто-то там не спит. Ну да ладно.'],
      ['grum', 'Земля свободна. Подозрительно свободна.'],
    ] },
    { k: 'say', when: C => !!C.zb, lines: [
      ['zhab', 'Ква… За камнем вода плохая. Тихая. Мёртвая. Ни одной мухи — Жабьен проверил.'],
      ['zhab', 'Жабьен останется у камня. Гоблины вернутся — будет мокро. Вы вернётесь — будет ква.'],
      ['grum', 'Спасибо, охотник. Дротиков тебе — полный колчан.'],
      ['zhab', 'Один. Но очень меткий. Ква.'],
    ] },
    { k: 'do', fn(C) { for (const N of campFoes('chase')) { N.st = 'vanish'; N.vt = 0; } campMarchStop(); } },
    { k: 'end' },
  ],
};
