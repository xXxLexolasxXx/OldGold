'use strict';
// Групповые забавы скучающих гномов. Выходят только в свободное время (как и одиночный досуг) и днём без дождя:
// 1) чертёж на земле — склонились над синькой, спорят, тычут пальцем;
// 2) карты — сидят кружком, бросают карты на платок, мухлюют;
// 3) ножички — круг пополам, каждый кидает нож в чужую половину и отрезает кусок земли;
// 4) классики — рисуют на дороге мелом и скачут; остаются на дороге, пока их не смоет дождь или не подметут на субботнике.
// Гнома, которому нашлась работа (диспетчер забрал), игра отпускает сразу — логистику не держим.
// Состояние игр лежит в Game.games (плоские объекты, их зеркалит кооп); рисунки классиков — объекты клеток World.obj {t:'hop'}.

const GAME_P = 0.22;          // шанс, что скучающий гном позовёт компанию вместо одиночной забавы
const GAME_CAP = 2;           // игр одновременно
const GAME_GAP = 40;          // пауза между затеями, сек
const GAME_FAR = 14;          // как далеко гном зовёт соседей
const HOP_MAX = 5;            // классиков на карте
const KN_CELL = 2;            // ножички: сторона клетки маски земли, мировых пикселей
const KN_R = 1.45;            // радиус круга, клеток карты
const KN_THROWS = 8;

const GROUPS = [];
let gameSeq = 1, gameNext = 0, lastGameToast = -999, gameScanT = 0, gameSweepT = 0, gameHopSnd = 0;

const gamesList = () => Game.games || (Game.games = []);
const gpick = a => a[(Math.random() * a.length) | 0];
const gUnitName = u => UNIT_TYPES[u.type].name;
const gSay = (u, t, col = '#fff6d0') => floater(u.x, u.y - 1.45, Array.isArray(t) ? gpick(t) : t, col);
const gGauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 0.75;

// ---------- Звуки ----------

Object.assign(SFX, {
  paper:  (d, t) => { noiseHit(d, 'bandpass', 3400, 1800, 1.1, t, 0.2, 0.22, 0.012); noiseHit(d, 'highpass', 5000, 3000, 0.8, t + 0.07, 0.1, 0.12, 0.01); },
  card:   (d, t) => { noiseHit(d, 'highpass', 2600, 4600, 1, t, 0.06, 0.3, 0.002); tone(d, 'sine', 950, 520, t, 0.04, 0.08, 0.002); },
  knife:  (d, t) => { tone(d, 'sine', 260, 120, t, 0.06, 0.3, 0.002); noiseHit(d, 'bandpass', 2200, 900, 2, t, 0.05, 0.25, 0.001); tone(d, 'triangle', 1560, 1540, t + 0.03, 0.3, 0.05, 0.002); },
  chalk:  (d, t) => noiseHit(d, 'highpass', 2200, 5200, 0.7, t, 0.35, 0.14, 0.04),
  hopTap: (d, t) => { tone(d, 'sine', 180, 90, t, 0.06, 0.26, 0.003); noiseHit(d, 'lowpass', 900, 500, 1, t, 0.05, 0.18, 0.002); },
});
Object.assign(SFX_DEF, {
  paper:  { pri: 0, gain: 0.4,  poly: 2, cd: 0.4,  len: 0.3 },
  card:   { pri: 0, gain: 0.45, poly: 3, cd: 0.1,  len: 0.12 },
  knife:  { pri: 1, gain: 0.5,  poly: 2, cd: 0.2,  len: 0.4 },
  chalk:  { pri: 0, gain: 0.35, poly: 2, cd: 0.3,  len: 0.4 },
  hopTap: { pri: 0, gain: 0.35, poly: 3, cd: 0.08, len: 0.1 },
});
Object.assign(FLOAT_SFX, { 'Хоп!': 'hopTap', 'Раз-два!': 'hopTap', 'Заступил!': 'ouch', 'Моя взятка!': 'cheer', 'Мой кусок!': 'grab', 'Земля моя!': 'cheer', 'Выиграл!': 'cheer', 'Мухлюешь!': 'hey', 'Ура, классики!': 'cheer' });

// ---------- Общее: участники и места ----------

function gameWeatherOK() {
  return !isNightNow() && !isEveningNow() && !(typeof WX !== 'undefined' && WX.k > 0.15)
    && !(Game.sub && Game.sub.active) && !(typeof festOn === 'function' && festOn());
}

// Клетка и квадрат вокруг свободны от дорог, построек, дверей и предметов: играем на траве, не у курьеров на пути
function gameSpot(x0, y0, maxR, clr) {
  for (let k = 0; k < 70; k++) {
    const a = Math.random() * 6.2832, r = 2 + Math.random() * maxR;
    const x = Math.round(x0 + Math.cos(a) * r), y = Math.round(y0 + Math.sin(a) * r);
    let ok = inb(x, y);
    for (let yy = y - clr; yy <= y + clr && ok; yy++) for (let xx = x - clr; xx <= x + clr; xx++) {
      if (!inb(xx, yy)) { ok = false; break; }
      const i = idx(xx, yy), t = World.terrain[i];
      if (!isWalkable(xx, yy) || World.door[i] || World.obj[i] || World.road[i] || Game.piles.has(i) || (t !== T_GRASS && t !== T_SAND)) { ok = false; break; }
    }
    if (!ok) continue;
    if (GROUPS.some(g => Math.hypot(g.cx - x, g.cy - y) < 5)) continue;
    return [x, y];
  }
  return null;
}

function gameRecruits(leader, n) {
  const c = [];
  for (const o of Game.units) {
    if (o === leader || o.dead || o.inside || o.brk || !o.idleFlag || o.gp || o.glide || o.carry || o.dlv || !isPerson(o)) continue;
    if (o.isCourier || o.type === 'hero' || o.teamOf || o.rec || o.gx || o.gm || o.repairJob || o.cmd) continue;
    if (o.food < HUNGRY || injLeg(o.injury)) continue;
    const d = Math.hypot(o.x - leader.x, o.y - leader.y);
    if (d < GAME_FAR) c.push([d, o]);
  }
  c.sort((a, b) => a[0] - b[0]);
  return c.slice(0, n).map(e => e[1]);
}

function faceTo(u, tx, ty) {
  const dx = tx - u.x, dy = ty - u.y;
  if (Math.abs(dy) > Math.abs(dx) * 1.3) u.vdir = dy > 0 ? 'S' : 'N';
  else { u.vdir = 'E'; if (Math.abs(dx) > 0.02) u.face = dx > 0 ? 1 : -1; }
}

function gesture2(u, kind, time, tx) { u.gest = kind; u.gestUntil = Game.time + time; u.gestFace = tx > u.x ? 1 : -1; }

function setSt(g, st) { g.st = st; g.stT = Game.time; }

function beginGroup(kind, leader, recs, cx, cy, vis) {
  const g = { id: gameSeq++, kind, alive: true, t0: Game.time, st: 'gather', stT: Game.time, members: [leader, ...recs], cx, cy, slot: {}, min: 2, nextT: 0, vis };
  vis.k = kind; vis.cx = cx; vis.cy = cy; vis.born = Game.time; vis.out = 0;
  gamesList().push(vis); GROUPS.push(g);
  gameNext = Game.time + GAME_GAP;
  return g;
}

// Записывает гнома в игру. Рекрут получает генератор прямо в proc (до этого скучал); ведущий идёт внутри своего досуга
function enlist(g, u, slot, leader) {
  g.slot[u.id] = slot;
  u.gp = { gid: g.id, k: g.kind, pose: 'stand', here: 0, cx: g.vis.cx, cy: g.vis.cy, lift: 0 };
  u.fun = null; u.netUntil = 0; u.gest = ''; u.gestUntil = 0; u.hopMove = null;
  const gen = gameMemberGen(u, g, slot);
  if (leader) { u._gproc = u.proc; return gen; }
  u.action = null; u.anim = null; u.lastRes = undefined;
  u.proc = u._gproc = gen;
  return gen;
}

function* gameMemberGen(u, g, slot) {
  const gp = u.gp;
  if (!gp) return;   // игра уже распущена к моменту старта: иначе ниже gp.here падало на null
  const ok = yield { walk: [slot.cx, slot.cy], offroad: true };
  if (!g.alive || u.gp !== gp || !ok) { if (u.gp === gp) u.gp = null; return; }
  u.fiveSlide = { x0: u.x, y0: u.y, x1: slot.x, y1: slot.y, t0: Game.time };
  gp.here = 1;
  while (g.alive && u.gp === gp) yield { wait: 0.2, anim: 'game' };
}

const gMemberOK = (g, u) => !u.dead && Game.unitMap.get(u.id) === u && u.gp && u.gp.gid === g.id && u.proc === u._gproc && !u.brk && !u.inside;

function endGroup(g, why) {
  if (!g.alive) return;
  g.alive = false;
  for (const u of g.members) { if (u.gp && u.gp.gid === g.id) { u.gp = null; u.hopMove = null; } }
  g.vis.out = Game.time;
  const k = GROUPS.indexOf(g); if (k >= 0) GROUPS.splice(k, 1);
  if (why === 'weather' && g.members[0]) { const u = g.members.find(m => m.gp === null && !m.dead); if (u) gSay(u, ['Дождь! По домам!', 'Пора по делам'], '#cfe4ff'); }
}

const ringSlot = (cx, cy, rx, ry, a) => { const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry; return { x, y, cx: Math.floor(x), cy: Math.floor(y) }; };

// ---------- Вход: выбор игры вместо одиночного досуга ----------

const _leisureExtraBase = leisureExtra;
leisureExtra = function (u) {
  const g = groupLeisure(u);
  return g || _leisureExtraBase(u);
};

function groupLeisure(u) {
  if (Game.time < gameNext || !startOpen('games') || GROUPS.length >= GAME_CAP || Game.units.length < 3 || u.gp || Math.random() > GAME_P || !gameWeatherOK()) return null;
  if (u.type === 'hero' || u.teamOf || u.rec || u.gx || u.gm || u.glide) return null;
  const kinds = ['plan', 'plan', 'cards', 'cards', 'knives', 'knives', 'hop', 'hop'];
  while (kinds.length) {
    const k = kinds.splice((Math.random() * kinds.length) | 0, 1)[0];
    for (let j = kinds.length - 1; j >= 0; j--) if (kinds[j] === k) kinds.splice(j, 1);
    const gen = k === 'plan' ? startPlan(u) : k === 'cards' ? startCards(u) : k === 'knives' ? startKnives(u) : startHop(u);
    if (gen) return gen;
  }
  return null;
}

function startPlan(u) {
  const sp = gameSpot(u.x, u.y, 9, 1); if (!sp) return null;
  const recs = gameRecruits(u, 1 + (Math.random() < 0.5) + (Math.random() < 0.25)); if (!recs.length) return null;
  const cx = sp[0] + 0.5, cy = sp[1] + 0.5;
  const g = beginGroup('plan', u, recs, cx, cy, { p: 0, dur: 0, seed: (Math.random() * 1e6) | 0 });
  const a0 = Math.random() * 6.28, n = g.members.length;
  let gen = null;
  g.members.forEach((m, i) => { const r = enlist(g, m, ringSlot(cx, cy, 0.66, 0.5, a0 + i / n * 6.2832), i === 0); if (i === 0) gen = r; });
  gSay(u, ['Гляньте-ка, чертёж!', 'Идите сюда, я план нашёл'], '#cfe4ff');
  return gen;
}

function startCards(u) {
  const sp = gameSpot(u.x, u.y, 9, 1); if (!sp) return null;
  const recs = gameRecruits(u, 1 + ((Math.random() * 3) | 0)); if (!recs.length) return null;
  const cx = sp[0] + 0.5, cy = sp[1] + 0.5;
  const g = beginGroup('cards', u, recs, cx, cy, { table: [], fly: null, seed: (Math.random() * 1e6) | 0 });
  const a0 = Math.random() * 6.28, n = g.members.length;
  let gen = null;
  g.members.forEach((m, i) => { const r = enlist(g, m, ringSlot(cx, cy, 0.78, 0.6, a0 + i / n * 6.2832), i === 0); if (i === 0) gen = r; });
  gSay(u, ['Сыграем в карты?', 'Кто в дурака?'], '#ffe9a0');
  return gen;
}

function startKnives(u) {
  const sp = gameSpot(u.x, u.y, 9, 2); if (!sp) return null;
  const recs = gameRecruits(u, 1); if (!recs.length) return null;
  const cx = sp[0] + 0.5, cy = sp[1] + 0.5, th = (Math.random() - 0.5) * 0.9;
  const g = beginGroup('knives', u, recs, cx, cy, { R: KN_R, th, draw: 0, line: 0, cuts: [], kn: [null, null], fly: null, prev: null, w: 0 });
  const nx = Math.cos(th), ny = Math.sin(th), d = KN_R + 0.62;
  let gen = null;
  [1, -1].forEach((sgn, i) => { const r = enlist(g, g.members[i], ringSlot(cx + nx * d * sgn, cy + ny * d * sgn * 0.8, 0, 0, 0), i === 0); if (i === 0) gen = r; });
  g.throws = 0; g.turn = 0;
  gSay(u, ['Давай в ножички!', 'Ножик есть? Рисуем круг!'], '#ffe9a0');
  return gen;
}

function hopCellOK(x, y) {
  if (!inb(x, y)) return false;
  const i = idx(x, y);
  if (!World.road[i] || World.door[i] || World.obj[i] || World.bmap[i] || Game.piles.has(i)) return false;
  for (let yy = y - 2; yy <= y + 2; yy++) for (let xx = x - 2; xx <= x + 2; xx++) if (inb(xx, yy) && World.door[idx(xx, yy)]) return false;   // не у входов
  return true;
}

function hopList() {
  const a = [];
  for (let i = 0; i < N_TILES; i++) { const o = World.obj[i]; if (o && o.t === 'hop' && !((o.v | 0) & 4)) a.push(i); }
  return a;
}

function startHop(u) {
  const have = hopList();
  if (have.length >= HOP_MAX) return null;
  const ux = Math.floor(u.x), uy = Math.floor(u.y), cand = [];
  for (let yy = uy - GAME_FAR; yy <= uy + GAME_FAR; yy++) for (let xx = ux - GAME_FAR; xx <= ux + GAME_FAR; xx++) {
    if (!inb(xx, yy) || !World.road[idx(xx, yy)]) continue;
    for (const vert of [false, true]) {
      if (!hopCellOK(xx, yy) || !hopCellOK(xx + (vert ? 0 : 1), yy + (vert ? 1 : 0))) continue;
      if (have.some(i => Math.hypot(i % MAP_W - xx, ((i / MAP_W) | 0) - yy) < 6)) continue;
      cand.push([xx, yy, vert]);
    }
  }
  if (!cand.length) return null;
  const [sx, sy, vert] = gpick(cand);
  const recs = gameRecruits(u, (Math.random() * 3) | 0);
  const g = beginGroup('hop', u, recs, sx + (vert ? 0.5 : 1), sy + (vert ? 1 : 0.5), { v: (Math.random() * 4) | 0 });
  g.min = 1; g.sx = sx; g.sy = sy; g.vert = vert; g.order = []; g.run = null; g.laps = 0;
  // ведущий встаёт на старт рисунка; остальные ждут рядом на траве
  let gen = null;
  g.members.forEach((m, i) => {
    let s;
    if (i === 0) s = { x: sx + 0.5, y: sy + 0.5, cx: sx, cy: sy };
    else {
      const w = randomFreeNear(sx, sy, 2, 3, (x, y) => isWalkable(x, y) && !World.road[idx(x, y)] && !World.door[idx(x, y)] && !World.obj[idx(x, y)]);
      s = w ? { x: w[0] + 0.5, y: w[1] + 0.5, cx: w[0], cy: w[1] } : { x: sx + 0.5, y: sy + 0.5, cx: sx, cy: sy };
    }
    const r = enlist(g, m, s, i === 0); if (i === 0) gen = r;
  });
  gSay(u, ['Рисуем классики!', 'Мел есть? Классики!'], '#fff2a0');
  return gen;
}

// ---------- Ход игр ----------

function gamesTick(dt) {
  const now = Game.time;
  // классики: гном на рисунке пропрыгивает его — сквозь других, без падений
  for (const u of Game.units) {
    const a = u.action;
    if (!(a && a.walk) || u.inside || u.dead) continue;
    const o = World.obj[idx(Math.floor(u.x), Math.floor(u.y))];
    if (o && o.t === 'hop') {
      if (!(u.hopUntil > now - 0.1)) hopPassFx(u);
      u.hopUntil = now + 0.25;
    }
  }
  for (let k = GROUPS.length - 1; k >= 0; k--) {
    const g = GROUPS[k];
    for (const u of g.members) {
      if (!gMemberOK(g, u)) { if (u.gp && u.gp.gid === g.id) { u.gp = null; u.hopMove = null; } g.dropped = true; }
    }
    if (g.dropped) { g.members = g.members.filter(u => u.gp && u.gp.gid === g.id); g.dropped = false; if (g.run && !g.members.includes(g.run.u)) g.run = null; }
    if (g.members.length < g.min) { endGroup(g, 'few'); continue; }
    if (!gameWeatherOK()) { endGroup(g, 'weather'); continue; }
    if (g.st === 'gather' && now - g.stT > 28) { endGroup(g, 'late'); continue; }
    for (const u of g.members) {
      const gp = u.gp;
      if (gp.here) { if (g.kind !== 'hop' || gp.pose !== 'hop') faceTo(u, g.vis.cx, g.vis.cy); }
      if (u.hopMove) hopMoveStep(u);
    }
    if (g.kind === 'plan') planTick(g, gatherOK(g));
    else if (g.kind === 'cards') cardsTick(g, gatherOK(g));
    else if (g.kind === 'knives') knifeTick(g, g.members.every(u => u.gp.here));
    else if (g.kind === 'hop') hopTick(g, true);
    else if (typeof kidGroupTick === 'function') kidGroupTick(g);          // городки и снежки детей (kidsplay.js)
  }
  const L = gamesList();
  for (let i = L.length - 1; i >= 0; i--) if (L[i].out && now - L[i].out > 2.2) L.splice(i, 1);
  // смыв классиков: дождём и субботником
  gameScanT += dt;
  if (gameScanT >= 3) {
    const step = gameScanT; gameScanT = 0;
    const rain = typeof WX !== 'undefined' && WX.k > 0.5, sub = !!(Game.sub && Game.sub.active);
    if (rain || sub) {
      const list = hopList();
      for (const i of list) {
        if (Math.random() < (rain ? 0.4 : 0.55)) hopWipe(i, rain ? 'rain' : 'sub');
      }
    }
  }
}

// Не ждём опоздавшего вечно: двое уже на месте и прошло 8 с — начинаем без него
function gatherOK(g) {
  const n = g.members.filter(u => u.gp.here).length;
  if (n === g.members.length) return true;
  if (n < 2 || Game.time - g.stT < 8) return false;
  for (const u of g.members) if (!u.gp.here) u.gp = null;
  g.members = g.members.filter(u => u.gp);
  return true;
}

function hopWipe(i, why) {
  const o = World.obj[i]; if (!o || o.t !== 'hop') return;
  const x = i % MAP_W, y = (i / MAP_W) | 0, vert = !!o.vert, x2 = x + (vert ? 0 : 1), y2 = y + (vert ? 1 : 0);
  for (const j of [i, idx(x2, y2)]) { const p = World.obj[j]; if (p && p.t === 'hop') World.obj[j] = null; }
  const mx = (x + (vert ? 0.5 : 1)) * TILE, my = (y + (vert ? 1 : 0.5)) * TILE;
  if (why === 'rain') fxBurst(mx, my, 6, ['#9ab0c8', '#c8d8e8', '#f2eee0'], 26, 10, 0.5, 1.2, 40);
  else { fxBurst(mx, my, 8, ['#d8c8a0', '#c8b890', '#f2eee0'], 34, 16, 0.6, 1.4, 60); floater(mx / TILE, my / TILE - 0.6, 'Чисто!', '#d8f0a0'); }
}

function hopPassFx(u) {
  if (Game.time - gameHopSnd > 0.9 && Math.random() < 0.5) { gameHopSnd = Game.time; sfxAt('hopTap', u.x * TILE, u.y * TILE, 0.9); }
  if (Math.random() < 0.12 && Game.time - (u.hopSay || 0) > 40) { u.hopSay = Game.time; floater(u.x, u.y - 1.4, gpick(['Хоп!', 'Раз-два!']), '#fff2a0'); }
}

function hopMoveStep(u) {
  const m = u.hopMove, k = Math.min(1, Math.max(0, (Game.time - m.t0) / m.dur)), e = k;
  u.x = m.x0 + (m.x1 - m.x0) * e; u.y = m.y0 + (m.y1 - m.y0) * e;
  u.gp.lift = Math.sin(k * Math.PI) * (m.h || 6);
  if (k >= 1) {
    u.hopMove = null; u.gp.lift = 0;
    sfxAt('hopTap', u.x * TILE, u.y * TILE, 0.8);
    if (m.dust) fxBurst(u.x * TILE, u.y * TILE + 6, 2, ['#e0d4b0', '#c8b890'], 14, 6, 0.35, 1, 30);
  }
}

// ---------- 1. Чертёж ----------

const PLAN_TALK = ['Тут крыльцо!', 'А печь куда?', 'Стена кривая…', 'Мерить надо дважды', 'Это же погреб!', 'Не сходится!', 'Крышу повыше!', 'А окно где?'];
const PLAN_END = ['Гениально!', 'Ну, строим!', 'Бери молоток'];

function planTick(g, all) {
  const v = g.vis, now = Game.time;
  if (g.st === 'gather') {
    if (!all) return;
    setSt(g, 'view'); v.dur = 14 + Math.random() * 8; v.t0 = now; g.nextT = now + 1;
    for (const u of g.members) u.gp.pose = 'lean';
    sfxAt('paper', v.cx * TILE, v.cy * TILE);
    return;
  }
  if (g.st === 'view') {
    v.p = Math.min(1, (now - v.t0) / v.dur);
    if (now >= g.nextT) {
      g.nextT = now + 1.5 + Math.random() * 1.8;
      const u = gpick(g.members), r = Math.random();
      if (r < 0.72) { gesture2(u, 'point', 1.4, v.cx); gSay(u, PLAN_TALK); if (Math.random() < 0.4) sfxAt('paper', u.x * TILE, u.y * TILE, 0.7); }
      else if (r < 0.88) { gesture2(u, 'scratch', 1.2, v.cx); }
      else if (g.members.length > 1) { const w = gpick(g.members.filter(m => m !== u)); gesture2(u, 'fist', 1.3, w.x); gSay(w, ['Сам считай!', 'Ничего не понимаешь'], '#ffd0d0'); }
    }
    if (v.p >= 1) {
      setSt(g, 'done'); v.out = now;
      for (const u of g.members) { u.gp.pose = 'stand'; gesture2(u, Math.random() < 0.5 ? 'clap' : 'wave', 1.6, v.cx); }
      gSay(g.members[0], PLAN_END, '#d8f0a0');
      logEvent('people', `${g.members.length} гн. склонились над чертежом: «${gpick(PLAN_TALK)}»`, v.cx, v.cy);
    }
    return;
  }
  if (now - g.stT > 1.8) endGroup(g, 'done');
}

// ---------- 2. Карты ----------

const CARD_TALK = ['Хожу с козыря!', 'Ух ты!', 'Пас', 'Бью тузом!', 'Ходи давай', 'Дама пик!', 'Вот это да!', 'Ещё партию?'];

function cardsTick(g, all) {
  const v = g.vis, now = Game.time;
  if (g.st === 'gather') {
    if (!all) return;
    setSt(g, 'play'); g.round = 0; g.R = 6 + ((Math.random() * 4) | 0); g.nextT = now + 0.9;
    for (const u of g.members) u.gp.pose = 'sit';
    sfxAt('card', v.cx * TILE, v.cy * TILE);
    return;
  }
  if (g.st === 'play') {
    if (v.fly && now >= v.fly.t0 + v.fly.dur) {
      v.table.push([v.fly.tx, v.fly.ty, v.fly.rot, v.fly.s, v.fly.r]);
      if (v.table.length > 9) v.table.shift();
      v.fly = null; sfxAt('card', v.cx * TILE, v.cy * TILE, 0.9);
    }
    if (now >= g.nextT && !v.fly) {
      if (g.round >= g.R) {
        setSt(g, 'result');
        const w = gpick(g.members), cheat = g.members.length > 2 && Math.random() < 0.2;
        g.winner = w;
        for (const u of g.members) u.gp.pose = 'stand';
        if (cheat) {
          gSay(w, 'Моя взятка!'); gesture2(w, 'wave', 2.4, v.cx);
          const acc = gpick(g.members.filter(m => m !== w));
          gSay(acc, 'Мухлюешь!', '#ffd0d0'); gesture2(acc, 'fist', 2.4, w.x);
          logEvent('people', `Игра в карты: ${gUnitName(w).toLowerCase()} выиграл, но его обвинили в мухлеже`, v.cx, v.cy);
        } else {
          gSay(w, ['Выиграл!', 'Моя взятка!']); gesture2(w, 'wave', 2.4, v.cx);
          for (const u of g.members) if (u !== w) gesture2(u, Math.random() < 0.5 ? 'scratch' : 'fist', 2, w.x);
          logEvent('people', `Игра в карты: победил ${gUnitName(w).toLowerCase()}`, v.cx, v.cy);
        }
        return;
      }
      const u = g.members[g.round % g.members.length];
      v.fly = { t0: now, dur: 0.34, fx: u.x * TILE, fy: u.y * TILE - 8, tx: (Math.random() - 0.5) * 18, ty: (Math.random() - 0.5) * 7, rot: (Math.random() - 0.5) * 1.2, s: (Math.random() * 4) | 0, r: (Math.random() * 9) | 0 };
      sfxAt('card', u.x * TILE, u.y * TILE, 0.8);
      if (Math.random() < 0.35) gSay(u, CARD_TALK);
      else if (g.members.length > 1 && Math.random() < 0.4) gSay(gpick(g.members.filter(m => m !== u)), ['Ух ты!', 'Ого!', 'Хм…', 'Ну-ну'], '#ffe9c0');
      g.round++; g.nextT = now + 1.4 + Math.random() * 0.8;
    }
    return;
  }
  if (now - g.stT > 2.8) { v.out = now; endGroup(g, 'done'); }
}

// ---------- 3. Ножички ----------

const KN_GROOVE = '#4a3220', KN_LIGHT = 'rgba(240,222,180,0.5)';

function knifeState(vis) {
  let s = KNC.get(vis);
  const N = Math.ceil(vis.R * TILE / KN_CELL) * 2;
  if (!s || s.th !== vis.th) {
    s = { N, th: vis.th, mask: new Uint8Array(N * N), n: 0, cv: null, bd: [], area: [0, 0, 0], dirty: true };
    const nx = Math.cos(vis.th), ny = Math.sin(vis.th), Rp = vis.R * TILE, half = N * KN_CELL / 2;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i + 0.5) * KN_CELL - half, y = (j + 0.5) * KN_CELL - half;
      if (x * x + y * y <= Rp * Rp) s.mask[j * N + i] = x * nx + y * ny >= 0 ? 1 : 2;
    }
    KNC.set(vis, s);
  }
  while (s.n < vis.cuts.length) { knifeCut(s, vis.cuts[s.n]); s.n++; s.dirty = true; }
  if (s.dirty) knifeRebuild(s);
  return s;
}
const KNC = new WeakMap();

// Бросавший забирает меньший кусок чужой земли по ту сторону линии, что прошла через нож
function knifeCut(s, cut) {
  const [px, py, nx, ny, owner] = cut, opp = owner === 1 ? 2 : 1, half = s.N * KN_CELL / 2;
  let pos = 0, neg = 0;
  const side = new Int8Array(s.N * s.N);
  for (let j = 0; j < s.N; j++) for (let i = 0; i < s.N; i++) {
    if (s.mask[j * s.N + i] !== opp) continue;
    const d = ((i + 0.5) * KN_CELL - half - px) * nx + ((j + 0.5) * KN_CELL - half - py) * ny;
    if (d >= 0) { side[j * s.N + i] = 1; pos++; } else { side[j * s.N + i] = -1; neg++; }
  }
  const take = pos <= neg ? 1 : -1;
  for (let k = 0; k < side.length; k++) if (side[k] === take) s.mask[k] = owner;
}

function knifeRebuild(s) {
  s.dirty = false; s.cvDirty = true;
  const N = s.N;
  s.bd = []; s.area = [0, 0, 0];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const m = s.mask[j * N + i];
    if (!m) continue;
    s.area[m]++;
    const r = i + 1 < N ? s.mask[j * N + i + 1] : 0, d = j + 1 < N ? s.mask[(j + 1) * N + i] : 0;
    if ((r && r !== m) || (d && d !== m)) s.bd.push(i, j);
  }
}

// Тень территории: рисуется только в браузере, на сервере кооп-симуляции холста нет
function knifeTint(s) {
  s.cvDirty = false;
  const N = s.N;
  if (!s.cv) { s.cv = document.createElement('canvas'); s.cv.width = N; s.cv.height = N; }
  const c = s.cv.getContext('2d');
  c.clearRect(0, 0, N, N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const m = s.mask[j * N + i];
    if (!m) continue;
    c.fillStyle = m === 1 ? 'rgba(90,150,235,0.17)' : 'rgba(235,100,80,0.17)';
    c.fillRect(i, j, 1, 1);
  }
}

function knifeChord(px, py, nx, ny, Rp) {
  const dx = -ny, dy = nx, b = px * dx + py * dy, disc = b * b - (px * px + py * py) + Rp * Rp;
  if (disc <= 0) return null;
  const q = Math.sqrt(disc);
  return [px + dx * (-b - q), py + dy * (-b - q), px + dx * (-b + q), py + dy * (-b + q)];
}

function knifeTick(g, all) {
  const v = g.vis, now = Game.time, s = knifeState(v), [A, B] = g.members, Rp = v.R * TILE;
  const cxp = v.cx * TILE, cyp = v.cy * TILE + 6;
  if (g.members.length < 2) return;
  const who = k => g.members[k % 2];        // чётные броски — первый: он на стороне «+», его земля — 1
  if (g.st === 'gather') {
    if (!all) return;
    setSt(g, 'draw'); g.chalkT = 0;
    who(0).gp.pose = 'bend'; who(1).gp.pose = 'stand';
    return;
  }
  if (g.st === 'draw') {
    v.draw = Math.min(1, (now - g.stT) / 2.6);
    if (now >= g.chalkT) { g.chalkT = now + 0.5; sfxAt('chalk', cxp, cyp); }
    if (v.draw >= 1) {
      v.line = 1; sfxAt('chalk', cxp, cyp);
      who(0).gp.pose = 'stand';
      setSt(g, 'turn'); gSay(who(1), ['Делим пополам!', 'Моя половина — вот эта'], '#ffe9a0');
      g.wait = now + 0.9;
    }
    return;
  }
  const th = g.turn, thr = who(th), owner = th % 2 === 0 ? 1 : 2, opp = owner === 1 ? 2 : 1, tgp = thr.gp;
  const tp = g.slot[thr.id], tx = (tp.x - v.cx) * TILE, ty = (tp.y - v.cy) * TILE;
  if (g.st === 'turn') {
    if (now < g.wait) return;
    v.kn[owner - 1] = null;                                       // свой старый нож подобрал
    // куда метит: случайная клетка чужой земли, с разбросом
    let lx = 0, ly = 0, tries = 0;
    do {
      const i = (Math.random() * s.N) | 0, j = (Math.random() * s.N) | 0;
      if (s.mask[j * s.N + i] === opp) { lx = (i + 0.5) * KN_CELL - s.N * KN_CELL / 2 + gGauss() * Rp * 0.14; ly = (j + 0.5) * KN_CELL - s.N * KN_CELL / 2 + gGauss() * Rp * 0.14; break; }
    } while (++tries < 300);
    g.land = [lx, ly];
    tgp.pose = 'throw'; tgp.ph = now; tgp.rel = 0; tgp.kv = 1;
    faceTo(thr, v.cx + lx / TILE, v.cy + ly / TILE);
    setSt(g, 'aim');
    return;
  }
  if (g.st === 'aim') {
    if (now - g.stT < 0.55) return;
    tgp.rel = now;
    const [lx, ly] = g.land;
    v.fly = { t0: now, dur: 0.42, x0: thr.x * TILE, y0: thr.y * TILE - 12, x1: cxp + lx, y1: cyp + ly, a0: owner === 1 ? 3.14 : 0, h: 16 };
    sfxAt('whoosh', thr.x * TILE, thr.y * TILE, 0.8);
    setSt(g, 'fly');
    return;
  }
  if (g.st === 'fly') {
    if (now - g.stT < v.fly.dur) return;
    const [lx, ly] = g.land, ix = Math.floor(lx / KN_CELL + s.N / 2), iy = Math.floor(ly / KN_CELL + s.N / 2);
    const cell = ix >= 0 && iy >= 0 && ix < s.N && iy < s.N ? s.mask[iy * s.N + ix] : 0;
    v.fly = null; tgp.kv = 0;
    v.kn[owner - 1] = [Math.round(lx * 10) / 10, Math.round(ly * 10) / 10, now];
    sfxAt('knife', cxp + lx, cyp + ly);
    fxBurst(cxp + lx, cyp + ly, 4, ['#c8a878', '#8a6a44', '#e0d4b0'], 22, 12, 0.4, 1.1, 60);
    g.hit = cell === opp;
    g.throws++;
    if (!g.hit) { gSay(thr, ['Мимо!', 'Не воткнулся', 'Ножик подвёл'], '#ffd0a0'); setSt(g, 'react'); g.wait = now + 1.0; }
    else setSt(g, 'stick');
    tgp.pose = 'stand';
    return;
  }
  if (g.st === 'stick') {
    if (now - g.stT < 0.55) return;
    // линия через нож перпендикулярно броску; бросавший склоняется и чертит
    const [lx, ly] = g.land;
    let vx = lx - tx, vy = ly - ty; const vl = Math.hypot(vx, vy) || 1; vx /= vl; vy /= vl;
    const a = gGauss() * 0.4, nx = vx * Math.cos(a) - vy * Math.sin(a), ny = vx * Math.sin(a) + vy * Math.cos(a);
    g.cut = [Math.round(lx * 10) / 10, Math.round(ly * 10) / 10, Math.round(nx * 100) / 100, Math.round(ny * 100) / 100, owner];
    const ch = knifeChord(lx, ly, g.cut[2], g.cut[3], Rp);
    v.prev = ch ? { t0: now, dur: 0.8, x0: ch[0], y0: ch[1], x1: ch[2], y1: ch[3] } : null;
    tgp.pose = 'bend'; sfxAt('chalk', cxp + lx, cyp + ly);
    gSay(thr, ['Мой кусок!', 'Тесно стало?', 'Вот тебе!'], '#ffe9a0');
    setSt(g, 'cut');
    return;
  }
  if (g.st === 'cut') {
    if (now - g.stT < 0.9) return;
    v.prev = null; v.cuts.push(g.cut);
    const s2 = knifeState(v);                                        // граница сдвинулась
    sfxAt('chalk', cxp, cyp, 0.9);
    tgp.pose = 'stand';
    const opponent = who(th + 1);
    gesture2(opponent, Math.random() < 0.5 ? 'fist' : 'scratch', 1.4, thr.x); if (Math.random() < 0.5) gSay(opponent, ['Эй, это моё!', 'Ну погоди!', 'Земля же…'], '#ffd0d0');
    const total = s2.area[1] + s2.area[2];
    if (s2.area[opp] < total * 0.3 || g.throws >= KN_THROWS) return knifeEnd(g, s2);
    setSt(g, 'react'); g.wait = now + 0.9;
    return;
  }
  if (g.st === 'react') {
    if (now < g.wait) return;
    if (g.throws >= KN_THROWS) return knifeEnd(g, s);
    g.turn++; setSt(g, 'turn'); g.wait = now;
    return;
  }
  if (g.st === 'end') {
    if (now - g.stT > 4.2) endGroup(g, 'done');
  }
}

function knifeEnd(g, s) {
  const now = Game.time, v = g.vis;
  const w = s.area[1] === s.area[2] ? null : (s.area[1] > s.area[2] ? g.members[0] : g.members[1]);
  setSt(g, 'end');
  if (!w) { for (const u of g.members) { u.gp.pose = 'stand'; gSay(u, 'Ничья!'); } logEvent('people', 'Ножички закончились вничью', v.cx, v.cy); return; }
  const l = w === g.members[0] ? g.members[1] : g.members[0];
  w.gp.pose = 'stand'; gesture2(w, 'wave', 3, l.x); gSay(w, ['Земля моя!', 'Выиграл!'], '#d8f0a0'); sfxAt('cheer', w.x * TILE, w.y * TILE);
  l.gp.pose = 'bend'; fxLater(0.8, () => { if (l.gp) gSay(l, 'Мфм… достану зубами', '#ffd0d0'); });   // проигравший вытаскивает нож зубами
  logEvent('people', `Ножички: ${gUnitName(w).toLowerCase()} отобрал землю у ${gUnitName(l).toLowerCase()}`, v.cx, v.cy);
}

// ---------- 4. Классики ----------

const HOP_TALK = ['Хоп!', 'Раз-два!', 'Не заступи!', 'Моя очередь', 'Давай-давай'];

// точка рисунка: s вдоль дороги от начала (0..64), w поперёк (−16..16) → клетки карты
function hopPt(g, s, w) {
  const x = g.vert ? g.sx + (16 + w) / TILE : g.sx + s / TILE;
  const y = g.vert ? g.sy + (s - 6) / TILE : g.sy + (16 - 6 + w) / TILE;
  return [x, y];
}

function hopTick(g, all) {
  const v = g.vis, now = Game.time, lead = g.members[0];
  if (g.st === 'gather') {
    if (!lead.gp.here) return;
    // рисует мелом: рисунок проступает за 3 секунды
    const i = idx(g.sx, g.sy), j = idx(g.sx + (g.vert ? 0 : 1), g.sy + (g.vert ? 1 : 0));
    if (!World.obj[i] && !World.obj[j] && World.road[i] && World.road[j]) {
      World.obj[i] = { t: 'hop', v: g.vis.v, vert: g.vert ? true : undefined, born: now };
      World.obj[j] = { t: 'hop', v: g.vis.v | 4, vert: g.vert ? true : undefined };
    } else return endGroup(g, 'busy');
    lead.gp.pose = 'bend'; g.chalkT = 0;
    setSt(g, 'draw');
    return;
  }
  if (g.st === 'draw') {
    if (now >= g.chalkT) { g.chalkT = now + 0.55; sfxAt('chalk', lead.x * TILE, lead.y * TILE); }
    if (now - g.stT < 3.2) return;
    lead.gp.pose = 'stand'; gesture2(lead, 'wave', 1.6, lead.x + 1); gSay(lead, 'Ура, классики!', '#fff2a0');
    g.order = g.members.slice();
    setSt(g, 'play'); g.nextT = now + 1.2;
    logEvent('people', `${gUnitName(lead)} нарисовал на дороге классики`, g.sx, g.sy);
    return;
  }
  if (g.st === 'play') {
    // зрители хлопают и подбадривают
    for (const u of g.members) if (!g.run || u !== g.run.u) { if (u.gp.pose === 'hop') { u.gp.pose = 'stand'; } }
    if (!g.run) {
      if (now < g.nextT) return;
      if (g.laps >= g.order.length * (g.members.length > 1 ? 1 : 2)) { setSt(g, 'done'); for (const u of g.members) gesture2(u, 'wave', 1.5, lead.x); return; }
      const u = g.order[g.laps % g.order.length]; g.laps++;
      if (!g.members.includes(u) || !u.gp.here) { g.nextT = now + 0.1; return; }
      // путь прыжков: к старту, 8 клеток вперёд (пары — враскорячку), разворот, обратно
      const pts = [[-7, 0]]; for (let c = 0; c < 8; c++) pts.push([4 + c * 8, 0]); for (let c = 6; c >= 0; c--) pts.push([4 + c * 8, 0]); pts.push([-7, 0]);
      g.run = { u, i: 0, pts, fail: Math.random() < 0.28 ? 2 + ((Math.random() * 10) | 0) : -1 };
      u.gp.pose = 'hop';
      return;
    }
    const r = g.run, u = r.u;
    if (u.hopMove) return;
    if (r.i >= r.pts.length) {
      g.run = null; g.nextT = now + 0.8; u.gp.pose = 'stand'; hopBack(g, u);
      return;
    }
    if (r.i === r.fail) {                                         // заступил за черту
      gSay(u, 'Заступил!', '#ffd0d0'); sfxAt('ouch', u.x * TILE, u.y * TILE, 0.7);
      for (const o of g.members) if (o !== u) gesture2(o, 'clap', 1.4, u.x);
      u.gp.pose = 'stand'; g.run = null; g.nextT = now + 1.4; hopBack(g, u);
      return;
    }
    const [s, w] = r.pts[r.i], [x1, y1] = hopPt(g, s, w);
    if (r.i === 0) { u.hopMove = { x0: u.x, y0: u.y, x1, y1, t0: now, dur: 0.7, h: 3 }; }
    else u.hopMove = { x0: u.x, y0: u.y, x1, y1, t0: now, dur: 0.34, h: 8, dust: true };
    u.face = x1 >= u.x ? 1 : -1; u.vdir = g.vert ? (y1 >= u.y ? 'S' : 'N') : 'E';
    if (r.i === 9) { gSay(u, 'Небо!', '#cfe4ff'); }
    else if (r.i > 1 && Math.random() < 0.12) gSay(u, HOP_TALK);
    r.i++;
    return;
  }
  if (now - g.stT > 2) endGroup(g, 'done');
}

function hopBack(g, u) {
  const sl = g.slot[u.id];
  if (sl) u.fiveSlide = { x0: u.x, y0: u.y, x1: sl.x, y1: sl.y, t0: Game.time };
}

// ---------- Рисование: земля ----------

const gpx = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); };

function drawGamesGround(c, x0, y0, x1, y1) {
  const L = Game.games;
  if (!L || !L.length) return;
  const now = Game.time;
  for (const v of L) {
    if (v.cx < x0 - 3 || v.cx > x1 + 3 || v.cy < y0 - 3 || v.cy > y1 + 3) continue;
    const a = v.out ? Math.max(0, 1 - (now - v.out) / (v.k === 'knives' ? 1.6 : 0.7)) : 1;
    if (a <= 0) continue;
    c.globalAlpha = a;
    const px = Math.round(v.cx * TILE), py = Math.round(v.cy * TILE + 6);
    if (v.k === 'plan') drawPlanGround(c, v, px, py, a);
    else if (v.k === 'cards') drawCardsGround(c, v, px, py);
    else if (v.k === 'knives') drawKnivesGround(c, v, px, py);
    c.globalAlpha = 1;
  }
}

// Чертёж: синька с белыми линиями, придавленная камешками; чертёж дорисовывается на глазах
function drawPlanGround(c, v, px, py, a) {
  const unroll = Math.min(1, (Game.time - v.born) / 0.7), w = Math.round(26 * (0.25 + 0.75 * unroll)), h = 18;
  const x = px - (w >> 1), y = py - 9;
  gpx(c, x + 1, y + 2, w, h, 'rgba(10,8,4,0.3)');
  gpx(c, x, y, w, h, '#2f5f9e'); gpx(c, x, y, w, 1, '#4f84c4'); gpx(c, x, y + h - 1, w, 1, '#214878'); gpx(c, x + w - 1, y, 1, h, '#254f86');
  if (unroll < 1) return;
  c.fillStyle = 'rgba(120,170,230,0.35)';
  for (let i = 4; i < w - 1; i += 4) c.fillRect(x + i, y + 1, 1, h - 2);
  for (let j = 4; j < h - 1; j += 4) c.fillRect(x + 1, y + j, w - 2, 1);
  // линии чертежа: дом с крыльцом, размеры, циркуль — открываются по мере разглядывания
  const segs = [[4, 12, 12, 1], [4, 6, 1, 7], [15, 6, 1, 7], [4, 6, 12, 1], [3, 5, 3, 1], [6, 3, 4, 1], [10, 4, 4, 1], [13, 5, 3, 1], [8, 9, 3, 4], [18, 5, 1, 9], [17, 5, 3, 1], [17, 13, 3, 1], [21, 10, 3, 1], [22, 8, 1, 5], [20, 14, 5, 1], [5, 15, 10, 1]];
  const n = Math.floor(v.p * segs.length + 0.99);
  for (let k = 0; k < n && k < segs.length; k++) { const s = segs[k]; gpx(c, x + s[0], y + s[1], s[2], s[3], k === n - 1 && v.p < 1 ? '#ffffff' : '#d4eaff'); }
  // камешки по углам, подвёрнутый уголок
  for (const [dx, dy] of [[0, 0], [w - 3, 0], [0, h - 3], [w - 3, h - 3]]) { gpx(c, x + dx, y + dy, 3, 3, '#7a7a80'); gpx(c, x + dx, y + dy, 2, 1, '#a8a8ae'); gpx(c, x + dx + 1, y + dy + 2, 2, 1, '#52525a'); }
  gpx(c, x + w - 5, y + h - 4, 5, 4, '#1d3f6e'); gpx(c, x + w - 4, y + h - 3, 3, 3, '#c8defa');
  // карандаш и циркуль рядом
  gpx(c, x + w + 2, y + 6, 5, 1, '#e8c040'); gpx(c, x + w + 7, y + 6, 1, 1, '#c8584a'); gpx(c, x + w + 1, y + 6, 1, 1, '#3a3a40');
}

// Платок для карт и сыгранные карты
function drawCardsGround(c, v, px, py) {
  const x = px - 15, y = py - 9;
  gpx(c, x + 1, y + 2, 30, 18, 'rgba(10,8,4,0.28)');
  gpx(c, x, y, 30, 18, '#2c7a4c'); gpx(c, x, y, 30, 1, '#4a9a68'); gpx(c, x, y + 17, 30, 1, '#1c5232'); gpx(c, x, y, 1, 18, '#3a8a5a'); gpx(c, x + 29, y, 1, 18, '#1c5232');
  c.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 3; i < 28; i += 4) c.fillRect(x + i, y + 1, 1, 16);
  gpx(c, x + 2, y + 2, 26, 1, '#e8c860'); gpx(c, x + 2, y + 15, 26, 1, '#e8c860');
  for (const [ox, oy, rot, s, r] of v.table || []) { c.save(); c.translate(px + ox, py + oy); c.rotate(rot); drawCardFace(c, s, r); c.restore(); }
}

const CARD_COL = ['#c8342c', '#c8342c', '#2a2430', '#2a2430'];
function drawCardFace(c, s, r) {
  c.fillStyle = 'rgba(10,8,4,0.3)'; c.fillRect(-2, -3, 5, 7);
  c.fillStyle = '#f6f0dc'; c.fillRect(-2, -3, 5, 7);
  c.fillStyle = '#8a7e66'; c.fillRect(-2, -3, 5, 1); c.fillRect(-2, 3, 5, 1); c.fillRect(-2, -3, 1, 7); c.fillRect(2, -3, 1, 7);
  c.fillStyle = CARD_COL[s];
  c.fillRect(-1, -2, 1, 1);                       // номинал
  if (r % 3 === 0) c.fillRect(0, 0, 1, 1); else if (r % 3 === 1) { c.fillRect(-1, 0, 3, 1); c.fillRect(0, 1, 1, 1); } else { c.fillRect(0, -1, 1, 3); c.fillRect(-1, 0, 3, 1); }
}

function drawCardBack(c) {
  c.fillStyle = '#f6f0dc'; c.fillRect(-2, -3, 5, 7);
  c.fillStyle = '#b02e28'; c.fillRect(-1, -2, 3, 5);
  c.fillStyle = '#e8d8a0'; c.fillRect(0, 0, 1, 1);
}

// Круг ножичков: канавка, граница, тень территории, воткнутые ножи
function drawKnivesGround(c, v, px, py) {
  const s = knifeState(v), Rp = v.R * TILE, half = s.N * KN_CELL / 2;
  if (s.cvDirty || !s.cv) knifeTint(s);
  const steps = Math.round(Rp * 6.2832), n = Math.round(steps * v.draw);
  c.save(); c.translate(px, py);
  if (v.line) { c.imageSmoothingEnabled = false; c.drawImage(s.cv, -half, -half, s.N * KN_CELL, s.N * KN_CELL); }
  for (let k = 0; k < n; k++) {
    const a = k / steps * 6.2832, x = Math.round(Math.cos(a) * Rp), y = Math.round(Math.sin(a) * Rp);
    c.fillStyle = KN_LIGHT; c.fillRect(x + 1, y + 1, 1, 1);
    c.fillStyle = KN_GROOVE; c.fillRect(x, y, 2, 1);
  }
  if (v.line) {
    for (let k = 0; k < s.bd.length; k += 2) {
      const x = s.bd[k] * KN_CELL - half, y = s.bd[k + 1] * KN_CELL - half;
      c.fillStyle = KN_LIGHT; c.fillRect(x + 2, y + 1, 1, 2);
      c.fillStyle = KN_GROOVE; c.fillRect(x, y, 2, 2);
    }
  }
  if (v.prev) {
    const p = Math.min(1, (Game.time - v.prev.t0) / v.prev.dur), m = 36;
    for (let k = 0; k < m * p; k++) {
      const t = k / m, x = Math.round(v.prev.x0 + (v.prev.x1 - v.prev.x0) * t), y = Math.round(v.prev.y0 + (v.prev.y1 - v.prev.y0) * t);
      c.fillStyle = KN_GROOVE; c.fillRect(x, y, 2, 1);
    }
  }
  for (const k of v.kn || []) if (k) drawKnifeStuck(c, k[0], k[1], Game.time - k[2]);
  c.restore();
}

function drawKnifeStuck(c, x, y, age) {
  const w = Math.sin(age * 22) * Math.max(0, 1 - age / 0.9) * 0.35;
  c.save(); c.translate(Math.round(x), Math.round(y)); c.rotate(-0.22 + w);
  gpx(c, -1, -10, 2, 5, '#6a3c1e'); gpx(c, -1, -10, 1, 5, '#8a5430');    // рукоять
  gpx(c, -3, -5, 6, 1, '#c8a850'); gpx(c, -3, -5, 2, 1, '#e8cc70');       // гарда
  gpx(c, -1, -4, 2, 4, '#c8ccd4'); gpx(c, -1, -4, 1, 4, '#eef0f6');       // клинок над землёй
  c.restore();
  gpx(c, x - 3, y, 2, 1, '#6a4c30'); gpx(c, x + 2, y + 1, 2, 1, '#6a4c30');
}

// ---------- Рисование: воздух ----------

function drawGamesAir(c) {
  const L = Game.games;
  if (!L || !L.length) return;
  const now = Game.time;
  for (const v of L) {
    if (v.k === 'cards' && v.fly) {
      const f = v.fly, p = Math.min(1, (now - f.t0) / f.dur), px = v.cx * TILE, py = v.cy * TILE + 6;
      const x = f.fx + (px + f.tx - f.fx) * p, y = f.fy + (py + f.ty - f.fy) * p - Math.sin(p * Math.PI) * 9;
      c.save(); c.translate(Math.round(x), Math.round(y)); c.rotate(p * 9 + f.rot);
      if (p < 0.5) drawCardBack(c); else drawCardFace(c, f.s, f.r);
      c.restore();
    } else if (v.k === 'knives' && v.fly) {
      const f = v.fly, p = Math.min(1, (now - f.t0) / f.dur);
      const x = f.x0 + (f.x1 - f.x0) * p, y = f.y0 + (f.y1 - f.y0) * p - Math.sin(p * Math.PI) * f.h;
      c.save(); c.translate(Math.round(x), Math.round(y)); c.rotate(f.a0 + p * 12.6 * (f.x1 >= f.x0 ? 1 : -1));
      drawKnifeFlat(c);
      c.restore();
    }
  }
}

function drawKnifeFlat(c) {
  gpx(c, -5, -1, 3, 2, '#6a3c1e'); gpx(c, -2, -2, 1, 4, '#c8a850'); gpx(c, -1, -1, 5, 2, '#c8ccd4'); gpx(c, -1, -1, 5, 1, '#eef0f6'); gpx(c, 4, -1, 1, 1, '#ffffff');
}

// ---------- Рисование: классики на дороге ----------

const HOP_COL = ['#f2eee0', '#ffe27a', '#ffb0c8', '#9ad8ff'];
const HOP_CV = new Map();
const DIGITS = { 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111', 0: '111101101101111' };

function hopCanvas(variant, vert) {
  const key = variant * 2 + (vert ? 1 : 0);
  let cv = HOP_CV.get(key);
  if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = vert ? 32 : 64; cv.height = vert ? 64 : 32;
  const c = cv.getContext('2d'), col = HOP_COL[variant & 3];
  const m = vert ? (s, w) => [16 + w, s] : (s, w) => [s, 16 + w];       // (вдоль, поперёк) → пиксель холста
  const rnd = mulberry32(variant * 7 + (vert ? 3 : 1));
  const dot = (s, w) => { if (rnd() < 0.08) return; const [x, y] = m(s, w); c.fillStyle = rnd() < 0.5 ? col : 'rgba(255,255,255,0.8)'; c.globalAlpha = 0.88; c.fillRect(x, y, 1, 1); c.globalAlpha = 1; };
  const line = (s0, w0, s1, w1) => { const n = Math.max(Math.abs(s1 - s0), Math.abs(w1 - w0)); for (let k = 0; k <= n; k++) dot(Math.round(s0 + (s1 - s0) * k / n), Math.round(w0 + (w1 - w0) * k / n)); };
  const box = (s0, w0, s1, w1) => { line(s0, w0, s1, w0); line(s0, w1, s1, w1); line(s0, w0, s0, w1); line(s1, w0, s1, w1); };
  const digit = (d, s, w) => {            // цифра прямо, не поворачивая вместе с дорогой
    const [cx, cy] = m(s, w), bits = DIGITS[d];
    for (let k = 0; k < 15; k++) if (bits[k] === '1') { c.fillStyle = col; c.globalAlpha = 0.9; c.fillRect(cx - 1 + (k % 3), cy - 2 + ((k / 3) | 0), 1, 1); c.globalAlpha = 1; }
  };
  let num = 1;
  for (let col8 = 0; col8 < 7; col8++) {
    const s0 = col8 * 8 + 1, s1 = s0 + 8, single = col8 % 2 === 0;
    if (single) { box(s0, -4, s1, 4); digit(num % 10, (s0 + s1) / 2, 0); num++; }
    else { box(s0, -8, s1, 0); box(s0, 0, s1, 8); digit(num % 10, (s0 + s1) / 2, -4); digit((num + 1) % 10, (s0 + s1) / 2, 4); num += 2; }
  }
  // «небо»: полукруг в конце
  for (let a = -1.57; a <= 1.57; a += 0.12) dot(Math.round(57 + Math.cos(a) * 6), Math.round(Math.sin(a) * 8));
  line(57, -8, 57, 8);
  HOP_CV.set(key, cv);
  return cv;
}

function drawHopObj(c, x, y, o) {
  if ((o.v | 0) & 4) return;                      // вторая половинка рисуется вместе с первой
  const cv = hopCanvas(o.v & 3, !!o.vert), p = o.born ? Math.min(1, (Game.time - o.born) / 3.2) : 1;
  const px = x * TILE, py = y * TILE;
  c.imageSmoothingEnabled = false;
  if (o.vert) c.drawImage(cv, 0, 0, 32, 64 * p, px, py, 32, 64 * p);
  else c.drawImage(cv, 0, 0, 64 * p, 32, px, py, 64 * p, 32);
  if (p < 1) { c.fillStyle = HOP_COL[o.v & 3]; const k = (Game.time * 9) & 3; c.fillRect(px + (o.vert ? 14 : 64 * p) + k, py + (o.vert ? 64 * p : 14) + k, 1, 1); }
  c.imageSmoothingEnabled = R.smooth;
}

// ---------- Рисование: гномы ----------

const _drawUnitGames = drawUnit;
drawUnit = function (c, u) {
  const gp = u.gp;
  if (gp && gp.here) { drawGameUnit(c, u, gp); return; }
  const a = u.action;
  if (a && a.walk && !u.inside && u.type !== 'goat' && u.type !== 'carter') {
    const o = World.obj[idx(Math.floor(u.x), Math.floor(u.y))];
    if (o && o.t === 'hop') {
      // пропрыгивает классики: подскоки по двум-трём клеткам, ноги вместе
      const ph = (Game.time + u.id * 0.13) / 0.3, k = ph % 1, lift = Math.sin(k * Math.PI) * 5.5;
      drawUnitXform(c, u, lift, ((ph | 0) & 1 ? 1 : -1) * 0.05, 0, 1 - lift / 12);
      drawFlower(c, u);
      return;
    }
  }
  _drawUnitGames(c, u);
};

function drawGameUnit(c, u, gp) {
  const now = Game.time, toward = gp.cx > u.x ? 1 : -1;
  const px = Math.round(u.x * TILE), py = Math.round(u.y * TILE + 6);
  switch (gp.pose) {
    case 'lean': drawUnitXform(c, u, 0, toward * (0.3 + Math.sin(now * 2.2 + u.id) * 0.035), 0, 1); drawFlower(c, u); return;
    case 'sit': { const sv = u.anim; u.anim = 'sit'; _drawUnitGames(c, u); u.anim = sv; drawCardFan(c, u, px, py); return; }
    case 'bend': { const sv = u.anim; u.anim = 'forage'; _drawUnitGames(c, u); u.anim = sv; return; }
    case 'hop': {
      const lift = gp.lift || 0;
      drawUnitXform(c, u, lift, 0, 0, 1 - lift / 14); drawFlower(c, u); return;
    }
    case 'throw': {
      const rel = gp.rel ? now - gp.rel : -1;
      let rot;
      if (rel >= 0) rot = rel < 0.3 ? toward * (0.32 - rel * 0.5) : 0;
      else rot = -toward * Math.min(0.2, (now - gp.ph) * 0.5);
      drawUnitXform(c, u, 0, rot, 0, 1);
      if (rel < 0 && gp.kv) { c.save(); c.translate(px + toward * 3, py - 24); c.rotate(-toward * 0.4 - 0.3); drawKnifeFlat(c); c.restore(); }
      return;
    }
  }
  _drawUnitGames(c, u);
  drawFlower(c, u);
}

function drawCardFan(c, u, px, py) {
  if (u.gp.k !== 'cards') return;
  for (let k = -1; k <= 1; k++) { c.save(); c.translate(px + u.face * 3 + k * 2, py - 9 - Math.abs(k)); c.rotate(k * 0.4); drawCardBack(c); c.restore(); }
}
