'use strict';
// «Земелька» (ножички) — полная версия поверх групповых забав games.js (круг, ножи и отрезание земли там уже были).
// Правила: на земле чертится круг, делится чертой пополам; игроки по очереди бросают нож в половину соперника,
// нож должен воткнуться; от места попадания тянется черта, и меньший кусок чужой земли отходит бросавшему.
// Выиграл тот, кто отнял землю (остаток соперника меньше четверти круга) или у кого больше земли после 14 бросков.
// Приёмы идут лесенкой (ладонь → кулак → локоть → плечо → ухо → нос → голова → вертушка): удался бросок — приём сложнее,
// промах — лесенка с нуля. Играют гномы и гномята между собой (чаще у таверны), герой с гномом, два героя в коопе.
// Бросок героя — по сигналу: прицел ходит по кругу, жмёшь кнопку «Бросить» (клавиша N или клик по карте) — нож летит туда, где прицел.
// Вокруг собираются болельщики (до 3) и переживают каждый бросок. Всё покадрово (КАДРЫ.md): бросок 9 кадров.
// Состояние партии — плоский объект в Game.games (его зеркалит кооп), счёт героя — Game.zem (сохранение, поле zem).

const ZEM_THROWS = 14;        // бросков до подсчёта земли
const ZEM_LOSE = 0.24;        // доля круга, ниже которой соперник проиграл
const ZEM_HOLD = 12;          // сколько ждём бросок героя, сек
const ZEM_WIND = 0.62;        // замах до отпускания, сек (кадр 6 из 9)
const ZEM_FANS = 3;           // болельщиков на партию
const ZEM_NEAR = 12;          // как далеко болельщик слышит игру, клеток

const ZEM_TRICKS = [
  { k: 'palm',     n: 'с ладони', hx: 5,  hy: -17, sc: 1.0,  spin: 1.5, h: 14 },
  { k: 'fist',     n: 'с кулака', hx: 5,  hy: -19, sc: 1.05, spin: 1.5, h: 14 },
  { k: 'elbow',    n: 'с локтя',  hx: 2,  hy: -14, sc: 1.15, spin: 2,   h: 16 },
  { k: 'shoulder', n: 'с плеча',  hx: -1, hy: -25, sc: 1.25, spin: 2,   h: 18 },
  { k: 'ear',      n: 'с уха',    hx: 2,  hy: -30, sc: 1.35, spin: 2,   h: 18 },
  { k: 'nose',     n: 'с носа',   hx: 3,  hy: -27, sc: 1.45, spin: 2.5, h: 20 },
  { k: 'head',     n: 'с головы', hx: 0,  hy: -39, sc: 1.6,  spin: 2.5, h: 22 },
  { k: 'spin',     n: 'вертушкой', hx: 4, hy: -20, sc: 1.75, spin: 3,   h: 20 },
];
// 9 кадров броска: отклон назад → замах → удержание → разгон → отпускание (6) → проводка → возврат
const ZT_ROT  = [-0.04, -0.10, -0.16, -0.20, -0.20, -0.02, 0.30, 0.22, 0.06];
const ZT_LIFT = [0, -1, -1, 0, 0, 1, 2, 1, 0];
const ZT_WX   = [0, -1, -3, -4, -4, 1, 5, 7, 0];
const ZT_WY   = [0, 0, -1, -3, -3, -1, -2, -2, 0];
const ZT_KR   = [-0.3, -0.5, -0.9, -1.3, -1.3, -0.6, 0.4, 0.9, 0];

const ZI = { cmd: false };
const zRnd = (a, b) => a + Math.random() * (b - a);
const zPick = a => a[(Math.random() * a.length) | 0];
const zSkill = u => ((((u.id * 2654435761) >>> 0) % 1000) / 1000);
const zIsHero = u => u.type === 'hero';

Object.assign(SFX, {
  zStick: (d, t) => { tone(d, 'sine', 210, 90, t, 0.07, 0.32, 0.002); noiseHit(d, 'bandpass', 1800, 700, 2, t, 0.05, 0.22, 0.001); tone(d, 'triangle', 1640, 1600, t + 0.04, 0.34, 0.05, 0.002); },
  zFlat:  (d, t) => { noiseHit(d, 'bandpass', 3000, 1400, 1.4, t, 0.05, 0.2, 0.001); tone(d, 'triangle', 1180, 900, t + 0.02, 0.1, 0.07, 0.002); tone(d, 'triangle', 1060, 820, t + 0.13, 0.08, 0.05, 0.002); },
  zSlice: (d, t) => { noiseHit(d, 'bandpass', 1500, 600, 1.2, t, 0.28, 0.2, 0.03); tone(d, 'sine', 140, 70, t + 0.2, 0.1, 0.18, 0.003); },
  zPop:   (d, t) => { tone(d, 'sine', 300, 760, t, 0.08, 0.26, 0.002); noiseHit(d, 'highpass', 3000, 5000, 1, t, 0.04, 0.18, 0.001); },
});
Object.assign(SFX_DEF, {
  zStick: { pri: 1, gain: 0.5,  poly: 2, cd: 0.2,  len: 0.45 },
  zFlat:  { pri: 0, gain: 0.4,  poly: 2, cd: 0.25, len: 0.3 },
  zSlice: { pri: 0, gain: 0.4,  poly: 2, cd: 0.3,  len: 0.35 },
  zPop:   { pri: 0, gain: 0.4,  poly: 2, cd: 0.3,  len: 0.2 },
});
Object.assign(FLOAT_SFX, { 'Воткнулся!': 'zStick', 'Плашмя!': 'zFlat' });

// ---------- Партии: состав, место, зрители ----------

const zemGameOf = u => GROUPS.find(g => g.alive && g.kind === 'knives' && g.members.includes(u)) || null;
const zemUnitOK = u => !u.dead && !u.inside && Game.unitMap.get(u.id) === u && !u.brk;

function zemPickRecruit(u) {
  const kidFirst = u.type === 'kid' && typeof kidRecruits === 'function';
  let r = kidFirst ? kidRecruits(u, 1) : gameRecruits(u, 1);
  if (!r.length) r = kidFirst ? gameRecruits(u, 1) : (typeof kidRecruits === 'function' ? kidRecruits(u, 1) : []);
  return r;
}

// Ножи на площади: часть партий затевается у таверны, где собирается народ
function zemSpot(u) {
  const inn = Game.buildings.find(b => b.type === 'inn' && b.state === 'done' && !b.upg && Math.hypot(b.doorX - u.x, b.doorY - u.y) < 24);
  if (inn && Math.random() < 0.55) {
    const sp = gameSpot(inn.doorX, inn.doorY, 8, 2);
    if (sp) return sp;
  }
  return gameSpot(u.x, u.y, 9, 2);
}

function zemBegin(a, b, sp, leaderProc) {
  const cx = sp[0] + 0.5, cy = sp[1] + 0.5, th = (Math.random() - 0.5) * 0.9;
  const vis = { R: KN_R, th, draw: 0, dv: 0, line: 0, cuts: [], kn: [null, null], fly: null, prev: null, w: 0, aim: null, sc: [50, 50], hum: [zIsHero(a) ? 1 : 0, zIsHero(b) ? 1 : 0], trk: 0, win: -1, winT: 0, pull: null, lad: [0, 0] };
  const g = beginGroup('knives', a, [b], cx, cy, vis);
  const nx = Math.cos(th), ny = Math.sin(th), d = KN_R + 0.62;
  let gen = null;
  [1, -1].forEach((sgn, i) => { const r = enlist(g, g.members[i], ringSlot(cx + nx * d * sgn, cy + ny * d * sgn * 0.8, 0, 0, 0), i === 0 && leaderProc); if (i === 0 && leaderProc) gen = r; });
  g.throws = 0; g.turn = 0; g.zi = true;
  g.lad = vis.lad; g.sk = g.members.map(u => zIsHero(u) ? 0.5 : zSkill(u));
  g.fans = []; g.fav = {}; g.fanT = 0; g.ef = 0;
  return { g, gen };
}

startKnives = function (u) {
  const sp = zemSpot(u); if (!sp) return null;
  const recs = zemPickRecruit(u); if (!recs.length) return null;
  const { g, gen } = zemBegin(u, recs[0], sp, true);
  gSay(u, zPick(['Давай в земельку!', 'Ножик есть? Рисуем круг!', 'Сыграем в ножички?']), '#ffe9a0');
  return gen;
};

// Болельщики: свободные жители неподалёку подходят и встают вокруг круга
function zemFanPool(g) {
  const v = g.vis, c = [];
  for (const o of Game.units) {
    if (o.dead || o.inside || o.brk || !o.idleFlag || o.gp || o.glide || o.carry || o.dlv || !isPerson(o)) continue;
    if (o.isCourier || zIsHero(o) || o.teamOf || o.rec || o.gx || o.gm || o.repairJob || o.cmd || o.food < HUNGRY || o.injury === 'leg') continue;
    const d = Math.hypot(o.x - v.cx, o.y - v.cy);
    if (d < ZEM_NEAR) c.push([d, o]);
  }
  c.sort((a, b) => a[0] - b[0]);
  return c.map(e => e[1]);
}

function zemFanSlot(g) {
  const v = g.vis;
  for (let k = 0; k < 14; k++) {
    const a = v.th + Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1) + zRnd(-1.15, 1.15), r = zRnd(2.0, 2.8);
    const x = v.cx + Math.cos(a) * r, y = v.cy + Math.sin(a) * r * 0.85, cx = Math.floor(x), cy = Math.floor(y);
    if (!inb(cx, cy) || !isWalkable(cx, cy) || World.door[idx(cx, cy)] || World.obj[idx(cx, cy)] || World.road[idx(cx, cy)]) continue;
    if (g.fans.some(f => { const s = g.slot[f.id]; return s && Math.hypot(s.x - x, s.y - y) < 0.8; })) continue;
    return { x, y, cx, cy };
  }
  return null;
}

function* zemFanGen(u, g, slot) {
  const gp = u.gp;
  if (!gp) return;
  const ok = yield { walk: [slot.cx, slot.cy], offroad: true };
  if (!g.alive || u.gp !== gp || !ok) { if (u.gp === gp) u.gp = null; return; }
  u.fiveSlide = { x0: u.x, y0: u.y, x1: slot.x, y1: slot.y, t0: Game.time };
  gp.here = 1;
  while (g.alive && u.gp === gp) yield { wait: 0.2, anim: 'game' };
}

function zemFansTick(g, now) {
  const v = g.vis;
  for (let i = g.fans.length - 1; i >= 0; i--) {   // ушёл по делам: диспетчер забрал, умер, зашёл в дом
    const f = g.fans[i];
    if (!f.gp || f.gp.gid !== g.id || !zemUnitOK(f) || f.proc !== f._gproc) { if (f.gp && f.gp.gid === g.id) f.gp = null; g.fans.splice(i, 1); continue; }
    const gp = f.gp;
    if (gp.pu && now >= gp.pu) { gp.pose = 'watch'; gp.pu = 0; }
    if (gp.here) faceTo(f, v.cx, v.cy);
  }
  if (g.st === 'end' || g.st === 'gather' || now < g.fanT || g.fans.length >= ZEM_FANS) return;
  g.fanT = now + zRnd(1.2, 2.6);
  const pool = zemFanPool(g);
  if (!pool.length) return;
  const f = pool[0], slot = zemFanSlot(g);
  if (!slot) return;
  g.slot[f.id] = slot;
  f.gp = { gid: g.id, k: 'knives', role: 'fan', pose: 'watch', here: 0, cx: v.cx, cy: v.cy, lift: 0, pt: 0, pu: 0 };
  f.fun = null; f.netUntil = 0; f.gest = ''; f.gestUntil = 0; f.hopMove = null;
  f.action = null; f.anim = null; f.lastRes = undefined;
  f.proc = f._gproc = zemFanGen(f, g, slot);
  g.fans.push(f);
  g.fav[f.id] = Math.random() < 0.7 ? (Math.random() < 0.5 ? 0 : 1) : -1;   // за кого болеет (−1 — просто смотрит)
  if (Math.random() < 0.6) gSay(f, zPick(['О, ножички!', 'Дай посмотрю', 'Кто выигрывает?', 'Я за ' + (g.fav[f.id] === 1 ? 'второго' : 'первого')]), '#e8e0c0');
}

const _endGroupZ = endGroup;
endGroup = function (g, why) {
  if (g.kind === 'knives' && g.fans) {
    for (const f of g.fans) if (f.gp && f.gp.gid === g.id) f.gp = null;
    g.fans.length = 0;
    g.vis.aim = null;
  }
  _endGroupZ(g, why);
};

// Поза с таймером: после неё игрок снова смотрит на круг
function zemPose(u, pose, dur, gest) {
  const gp = u.gp; if (!gp) return;
  gp.pose = pose; gp.pt = Game.time; gp.pu = dur ? Game.time + dur : 0;
  if (gest) gesture2(u, gest, dur || 1, u.x + (gp.cx > u.x ? 1 : -1));
}

// Реакции болельщиков и игроков; ev: wind | stick | miss | cut | win | draw; who — индекс бросавшего (победителя)
function zemReact(g, ev, who) {
  const now = Game.time;
  for (const f of g.fans || []) {
    const gp = f.gp; if (!gp || !gp.here || Math.random() < 0.2) continue;
    const fav = g.fav[f.id] === undefined ? -1 : g.fav[f.id], mine = fav === who, theirs = fav === 1 - who;
    let pose = null, dur = 1.2, gest = null, say = null;
    switch (ev) {
      case 'wind': pose = 'hush'; dur = 0.95; break;
      case 'stick':
        if (theirs) { pose = 'gasp'; say = zPick(['Ой-ой…', 'Попал, гад']); } else { pose = 'cheer'; gest = 'clap'; say = zPick(['Ого!', 'Метко!', 'Ух ты!']); }
        break;
      case 'miss':
        if (theirs) { pose = 'cheer'; gest = 'clap'; dur = 1.1; say = zPick(['Ха!', 'Мимо!']); } else { pose = 'sad'; dur = 1.4; say = mine ? zPick(['Эх!', 'Ну как же так…']) : null; }
        break;
      case 'cut':
        if (theirs) { pose = 'gasp'; gest = 'panic'; dur = 1.2; say = zPick(['Земля!', 'Отрезал!']); } else { pose = 'cheer'; gest = 'wave'; dur = 1.4; say = zPick(['Так его!', 'Мой кусок!']); }
        break;
      case 'win':
        if (mine) { pose = 'cheer'; gest = 'wave'; dur = 3.4; say = zPick(['Ура-а!', 'Наша взяла!', 'Победа!']); }
        else if (theirs) { pose = 'sad'; dur = 3; say = 'Эх…'; }
        else { pose = 'cheer'; gest = 'clap'; dur = 2.6; say = 'Браво!'; }
        break;
      case 'draw': pose = 'shrug'; dur = 2; say = 'Ничья…'; break;
    }
    if (!pose) continue;
    const delay = zRnd(0, 0.28);
    fxLater(delay, () => {
      if (!f.gp || f.gp.gid !== g.id) return;
      zemPose(f, pose, dur, gest);
      if (say && Math.random() < 0.45) gSay(f, say, '#fff0c0');
    });
  }
}

// ---------- Земля: круг, кусок, вспышка ----------

const ZKS = new Map();
knifeState = function (vis) {
  const key = vis.cx + ',' + vis.cy + ',' + vis.born, N = Math.ceil(vis.R * TILE / KN_CELL) * 2;
  let s = ZKS.get(key);
  if (!s || s.th !== vis.th || s.n > vis.cuts.length) {
    if (ZKS.size > 16) ZKS.delete(ZKS.keys().next().value);
    s = { N, th: vis.th, mask: new Uint8Array(N * N), n: 0, cv: null, bd: [], area: [0, 0, 0], dirty: true, chg: null, chgD: null, chgT: -9, chgOwner: 0, live: false };
    const nx = Math.cos(vis.th), ny = Math.sin(vis.th), Rp = vis.R * TILE, half = N * KN_CELL / 2;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i + 0.5) * KN_CELL - half, y = (j + 0.5) * KN_CELL - half;
      if (x * x + y * y <= Rp * Rp) s.mask[j * N + i] = x * nx + y * ny >= 0 ? 1 : 2;
    }
    ZKS.set(key, s);
  }
  while (s.n < vis.cuts.length) { zemCut(s, vis.cuts[s.n]); s.n++; s.dirty = true; }
  if (s.dirty) knifeRebuild(s);
  s.live = true;
  return s;
};

// Меньший кусок чужой земли по одну сторону черты переходит бросавшему; список клеток нужен для вспышки
function zemCut(s, cut) {
  const [px, py, nx, ny, owner] = cut, opp = owner === 1 ? 2 : 1, half = s.N * KN_CELL / 2;
  let pos = 0, neg = 0;
  const side = new Int8Array(s.N * s.N), dist = new Float32Array(s.N * s.N);
  for (let j = 0; j < s.N; j++) for (let i = 0; i < s.N; i++) {
    if (s.mask[j * s.N + i] !== opp) continue;
    const d = ((i + 0.5) * KN_CELL - half - px) * nx + ((j + 0.5) * KN_CELL - half - py) * ny;
    dist[j * s.N + i] = Math.abs(d);
    if (d >= 0) { side[j * s.N + i] = 1; pos++; } else { side[j * s.N + i] = -1; neg++; }
  }
  const take = pos <= neg ? 1 : -1, chg = [], dd = [];
  let mx = 1;
  for (let k = 0; k < side.length; k++) if (side[k] === take) { s.mask[k] = owner; chg.push(k); dd.push(dist[k]); if (dist[k] > mx) mx = dist[k]; }
  if (s.live) { s.chg = chg; s.chgD = dd.map(d => d / mx); s.chgT = Game.time; s.chgOwner = owner; }
}

// Сколько отойдёт бросавшему, если нож воткнётся в (lx, ly) при броске из (tx, ty): ИИ прикидывает перед броском
function zemGain(s, owner, lx, ly, nx, ny) {
  const opp = owner === 1 ? 2 : 1, half = s.N * KN_CELL / 2;
  let pos = 0, neg = 0;
  for (let j = 0; j < s.N; j++) for (let i = 0; i < s.N; i++) {
    if (s.mask[j * s.N + i] !== opp) continue;
    const d = ((i + 0.5) * KN_CELL - half - lx) * nx + ((j + 0.5) * KN_CELL - half - ly) * ny;
    if (d >= 0) pos++; else neg++;
  }
  return Math.min(pos, neg);
}

function zemPickCell(s, who) {
  for (let k = 0; k < 300; k++) {
    const i = (Math.random() * s.N) | 0, j = (Math.random() * s.N) | 0;
    if (s.mask[j * s.N + i] === who) return [(i + 0.5) * KN_CELL - s.N * KN_CELL / 2, (j + 0.5) * KN_CELL - s.N * KN_CELL / 2];
  }
  return [0, 0];
}

// Куда целится гном: смотрит несколько мест (опытный — больше) и берёт то, где отрежет больше; рука дрожит тем сильнее, чем сложнее приём
function zemAiTarget(g, s, th, owner, tx, ty, tr) {
  const sk = g.sk[th % 2], tries = 1 + Math.round(sk * 5), Rp = g.vis.R * TILE;
  let best = null;
  for (let k = 0; k < tries; k++) {
    const [lx, ly] = zemPickCell(s, owner === 1 ? 2 : 1);
    let vx = lx - tx, vy = ly - ty; const vl = Math.hypot(vx, vy) || 1; vx /= vl; vy /= vl;
    const gain = zemGain(s, owner, lx, ly, vx, vy) + Math.random() * 8;
    if (!best || gain > best[2]) best = [lx, ly, gain];
  }
  const sig = Rp * (0.17 - 0.1 * sk) * tr.sc;
  return [best[0] + gGauss() * sig, best[1] + gGauss() * sig];
}

const zemStickP = (g, th) => Math.max(0.5, 0.93 - 0.035 * (g.lad[th % 2] % 8) + (g.sk[th % 2] - 0.5) * 0.14);

// Прицел героя: ходит по кругу восьмёркой, чем выше приём в лесенке, тем быстрее
function zemReticle(v, t) {
  const a = v.aim, Rp = v.R * TILE, sp = 1 + 0.07 * (a.l | 0);
  let x = Math.sin(t * 1.35 * sp + a.ph), y = Math.sin(t * 1.9 * sp + a.ph * 1.7 + 1);
  const m = Math.hypot(x, y);
  if (m > 1) { x /= m; y /= m; }
  return [x * Rp * 0.96, y * Rp * 0.96];
}

// ---------- Ход партии ----------

const zemWho = (g, k) => g.members[k % 2];

knifeTick = function (g, all) {
  const v = g.vis, now = Game.time, s = knifeState(v), Rp = v.R * TILE;
  if (g.members.length < 2) return;
  const cxp = v.cx * TILE, cyp = v.cy * TILE + 6;
  // пошла пора: позы с таймером возвращаются в стойку, болельщики следят
  for (const u of g.members) { const gp = u.gp; if (gp && gp.pu && now >= gp.pu) { gp.pose = 'stand'; gp.pu = 0; } }
  zemFansTick(g, now);
  const sc = () => { const t = (s.area[1] + s.area[2]) || 1; v.sc = [Math.round(s.area[1] / t * 100), Math.round(s.area[2] / t * 100)]; };

  if (g.st === 'gather') {
    if (!all) return;
    setSt(g, 'draw'); g.chalkT = 0;
    zemWho(g, 0).gp.pose = 'kneel'; zemWho(g, 1).gp.pose = 'watch';
    return;
  }
  if (g.st === 'draw') {                                           // чертят круг ножом по земле
    v.draw = Math.min(1, (now - g.stT) / 2.8);
    const a = v.draw * 6.2832, gp0 = zemWho(g, 0).gp;
    gp0.tip = [Math.round(cxp + Math.cos(a) * Rp), Math.round(cyp + Math.sin(a) * Rp)];
    if (now >= g.chalkT) { g.chalkT = now + 0.45; sfxAt('chalk', gp0.tip[0], gp0.tip[1]); fxBurst(gp0.tip[0], gp0.tip[1], 2, ['#c8b890', '#8a6a44'], 10, 6, 0.4, 1, 30); }
    if (v.draw >= 1) {
      gp0.pose = 'stand'; gp0.tip = null;
      setSt(g, 'divide'); v.dv = 0;
      const d = zemWho(g, 1); d.gp.pose = 'kneel'; gSay(d, zPick(['Делим пополам!', 'Моя половина — вот эта']), '#ffe9a0');
    }
    return;
  }
  if (g.st === 'divide') {                                         // черта через весь круг
    v.dv = Math.min(1, (now - g.stT) / 1.4);
    const nx = Math.cos(v.th), ny = Math.sin(v.th), dx = -ny, dy = nx, gp1 = zemWho(g, 1).gp, k = v.dv * 2 - 1;
    gp1.tip = [Math.round(cxp + dx * Rp * k), Math.round(cyp + dy * Rp * k)];
    if (now >= g.chalkT) { g.chalkT = now + 0.35; sfxAt('chalk', gp1.tip[0], gp1.tip[1]); fxBurst(gp1.tip[0], gp1.tip[1], 2, ['#c8b890', '#8a6a44'], 10, 6, 0.4, 1, 30); }
    if (v.dv >= 1) {
      v.line = 1; v.lineT = now; gp1.pose = 'watch'; gp1.tip = null;
      sfxAt('zSlice', cxp, cyp);
      setSt(g, 'turn'); g.wait = now + 0.9; sc();
    }
    return;
  }
  if (g.st === 'end') { zemEndTick(g, s, now); return; }

  const th = g.turn, thr = zemWho(g, th), oth = zemWho(g, th + 1), owner = th % 2 === 0 ? 1 : 2, opp = owner === 1 ? 2 : 1, tgp = thr.gp;
  const tp = g.slot[thr.id], tx = (tp.x - v.cx) * TILE, ty = (tp.y - v.cy) * TILE;
  const trkI = g.lad[th % 2] % ZEM_TRICKS.length, tr = ZEM_TRICKS[trkI];

  if (g.st === 'turn') {
    if (now < g.wait) return;
    v.kn[owner - 1] = null;                                        // свой старый нож подобрал
    v.trk = trkI; tgp.trk = trkI; tgp.ph = now; tgp.rel = 0; tgp.kv = 1; tgp.pu = 0; oth.gp.pose = 'watch'; oth.gp.pu = 0;
    if (trkI > 0 && g.lad[th % 2] > 0 && Math.random() < 0.8) gSay(thr, 'Теперь — ' + tr.n + '!', '#ffe9a0');
    if (zIsHero(thr)) {                                            // человек: прицел ходит по кругу
      tgp.pose = 'ready';
      v.aim = { t0: now, ph: Math.random() * 6.28, u: thr.id, l: g.lad[th % 2] % 8, T: ZEM_HOLD };
      faceTo(thr, v.cx, v.cy);
      setSt(g, 'hold');
      floater(thr.x, thr.y - 1.8, 'Твой бросок!', '#ffe070');
      zemReact(g, 'wind', th % 2);
      return;
    }
    g.land = zemAiTarget(g, s, th, owner, tx, ty, tr);
    tgp.pose = 'throw';
    faceTo(thr, v.cx + g.land[0] / TILE, v.cy + g.land[1] / TILE);
    zemReact(g, 'wind', th % 2);
    setSt(g, 'wind');
    return;
  }
  if (g.st === 'hold') {
    const a = v.aim;
    if (!a || !zemUnitOK(thr)) return;
    if (now - a.t0 >= a.T) { floater(thr.x, thr.y - 1.8, 'Время!', '#ffd0a0'); zemRelease(g, thr); }
    return;
  }
  if (g.st === 'wind') {
    if (now - g.stT < ZEM_WIND) return;
    tgp.rel = now; tgp.kv = 0;
    const [lx, ly] = g.land, toward = tgp.cx > thr.x ? 1 : -1;
    v.fly = { t0: now, dur: 0.42, x0: thr.x * TILE + toward * tr.hx, y0: thr.y * TILE + 6 + tr.hy, x1: cxp + lx, y1: cyp + ly, a0: owner === 1 ? 3.14 : 0, h: tr.h, sp: tr.spin };
    sfxAt('whoosh', thr.x * TILE, thr.y * TILE, 0.8);
    setSt(g, 'fly');
    return;
  }
  if (g.st === 'fly') {
    if (now - g.stT < v.fly.dur) return;
    const [lx, ly] = g.land, ix = Math.floor(lx / KN_CELL + s.N / 2), iy = Math.floor(ly / KN_CELL + s.N / 2);
    const cell = ix >= 0 && iy >= 0 && ix < s.N && iy < s.N ? s.mask[iy * s.N + ix] : 0;
    v.fly = null;
    g.throws++;
    const rl = [Math.round(lx * 10) / 10, Math.round(ly * 10) / 10];
    tgp.pose = 'stand';
    if (cell === opp && Math.random() < zemStickP(g, th)) {        // воткнулся и дрожит
      v.kn[owner - 1] = [rl[0], rl[1], now, 0];
      sfxAt('zStick', cxp + lx, cyp + ly);
      fxBurst(cxp + lx, cyp + ly, 5, ['#c8a878', '#8a6a44', '#e0d4b0'], 24, 14, 0.45, 1.1, 60);
      floater(v.cx + lx / TILE, v.cy + ly / TILE - 1.1, 'Воткнулся!', '#e8f0c0');
      zemReact(g, 'stick', th % 2);
      setSt(g, 'stick');
      return;
    }
    // промах: за круг, в свою землю или упал плашмя
    const why = cell === opp ? 'flat' : cell === 0 ? 'out' : 'own';
    v.kn[owner - 1] = [rl[0], rl[1], now, why === 'flat' ? 1 : 2];
    sfxAt('zFlat', cxp + lx, cyp + ly);
    fxBurst(cxp + lx, cyp + ly, 3, ['#e0d4b0', '#c8b890'], 18, 8, 0.35, 1, 40);
    gSay(thr, why === 'flat' ? 'Плашмя!' : why === 'out' ? zPick(['За круг!', 'Улетел!']) : zPick(['В свою!', 'Мимо!', 'Ножик подвёл']), '#ffd0a0');
    zemPose(thr, 'sad', 1.5, Math.random() < 0.5 ? 'scratch' : null);
    zemPose(oth, 'smirk', 1.4, 'clap');
    if (Math.random() < 0.6) gSay(oth, zPick(['Ха-ха!', 'Не вышло?', 'Тренируйся!']), '#d8f0a0');
    if (g.lad[th % 2] > 0) { g.lad[th % 2] = 0; floater(thr.x, thr.y - 2.1, 'Лесенка с начала', '#ffd0a0'); }
    zemReact(g, 'miss', th % 2);
    setSt(g, 'react'); g.wait = now + 1.5;
    return;
  }
  if (g.st === 'stick') {
    if (now - g.stT < 0.6) return;
    // черта через нож поперёк броска; бросавший встаёт на колено и чертит
    const [lx, ly] = g.land;
    let vx = lx - tx, vy = ly - ty; const vl = Math.hypot(vx, vy) || 1; vx /= vl; vy /= vl;
    const a = gGauss() * 0.4, nx = vx * Math.cos(a) - vy * Math.sin(a), ny = vx * Math.sin(a) + vy * Math.cos(a);
    g.cut = [Math.round(lx * 10) / 10, Math.round(ly * 10) / 10, Math.round(nx * 100) / 100, Math.round(ny * 100) / 100, owner];
    const ch = knifeChord(lx, ly, g.cut[2], g.cut[3], Rp);
    v.prev = ch ? { t0: now, dur: 1.0, x0: ch[0], y0: ch[1], x1: ch[2], y1: ch[3], kx: lx, ky: ly } : null;
    g.cutCh = ch;
    zemPose(thr, 'kneel', 0);
    gSay(thr, zPick(['Мой кусок!', 'Тесно стало?', 'Вот тебе!']), '#ffe9a0');
    setSt(g, 'cut');
    return;
  }
  if (g.st === 'cut') {
    const p = Math.min(1, (now - g.stT) / 1.0), ch = g.cutCh;
    if (ch) {                                                      // кончик ножа ведёт черту от нашей точки к концам хорды
      const e = p < 0.5 ? [ch[0], ch[1]] : [ch[2], ch[3]], q = p < 0.5 ? p * 2 : (p - 0.5) * 2, k0 = p < 0.5 ? [g.cut[0], g.cut[1]] : [ch[0], ch[1]];
      tgp.tip = [Math.round(cxp + k0[0] + (e[0] - k0[0]) * q), Math.round(cyp + k0[1] + (e[1] - k0[1]) * q)];
      if (now >= (g.chalkT || 0)) { g.chalkT = now + 0.3; sfxAt('chalk', tgp.tip[0], tgp.tip[1]); fxBurst(tgp.tip[0], tgp.tip[1], 2, ['#c8b890', '#8a6a44'], 12, 6, 0.4, 1, 30); }
    }
    if (p < 1) return;
    tgp.tip = null; tgp.pose = 'stand'; v.prev = null;
    const before = s.area[opp];
    v.cuts.push(g.cut);
    const s2 = knifeState(v);                                      // граница сдвинулась, клетки куска вспыхнут
    sc();
    const got = before - s2.area[opp];
    sfxAt('zSlice', cxp, cyp);
    fxBurst(cxp + g.cut[0], cyp + g.cut[1], 8, owner === 1 ? ['#7ab4ff', '#cfe6ff', '#c8a878'] : ['#ff9a80', '#ffd0c0', '#c8a878'], 40, 20, 0.6, 1.3, 90);
    floater(thr.x, thr.y - 2, got > 0 ? '+' + Math.round(got / Math.max(1, s2.area[1] + s2.area[2]) * 100) + '%' : 'Пусто', '#e8f0a0');
    if (got > 0) {
      zemPose(thr, 'cheer', 1.3, 'wave');
      zemPose(oth, 'gasp', 1.4, Math.random() < 0.5 ? 'fist' : 'scratch');
      if (Math.random() < 0.55) gSay(oth, zPick(['Эй, это моё!', 'Ну погоди!', 'Земля же…', 'Отдай кусок!']), '#ffd0d0');
      g.lad[th % 2]++;
      zemReact(g, 'cut', th % 2);
    }
    const total = s2.area[1] + s2.area[2];
    if (s2.area[opp] < total * ZEM_LOSE || g.throws >= ZEM_THROWS) return knifeEnd(g, s2);
    setSt(g, 'react'); g.wait = now + 1.5;
    return;
  }
  if (g.st === 'react') {
    if (now < g.wait) return;
    if (g.throws >= ZEM_THROWS) return knifeEnd(g, s);
    g.turn++; setSt(g, 'turn'); g.wait = now;
    return;
  }
};

// Человек бросает: нож летит туда, где был прицел (+ дрожь руки)
function zemRelease(g, u) {
  const v = g.vis, now = Game.time, a = v.aim;
  if (g.st !== 'hold' || !a) return false;
  const th = g.turn, tr = ZEM_TRICKS[g.lad[th % 2] % ZEM_TRICKS.length], Rp = v.R * TILE;
  const [rx, ry] = zemReticle(v, now - a.t0), sig = Rp * 0.05 * tr.sc;
  g.land = [rx + gGauss() * sig, ry + gGauss() * sig];
  v.aim = null;
  u.gp.pose = 'throw'; u.gp.ph = now;
  faceTo(u, v.cx + g.land[0] / TILE, v.cy + g.land[1] / TILE);
  setSt(g, 'wind');
  return true;
}

// Конец партии: победа по земле или по очкам, радость, огорчение, вытаскивание ножа зубами
function knifeEnd(g, s) {
  const now = Game.time, v = g.vis;
  const w = s.area[1] === s.area[2] ? null : (s.area[1] > s.area[2] ? g.members[0] : g.members[1]);
  setSt(g, 'end'); g.ef = 0;
  v.aim = null;
  const t = (s.area[1] + s.area[2]) || 1; v.sc = [Math.round(s.area[1] / t * 100), Math.round(s.area[2] / t * 100)];
  for (const u of g.members) { u.gp.tip = null; u.gp.pose = 'stand'; }
  if (!w) {
    v.win = -2; v.winT = now;
    for (const u of g.members) { zemPose(u, 'shrug', 2.4, 'clap'); gSay(u, 'Ничья!', '#ffe9a0'); }
    zemReact(g, 'draw', 0);
    logEvent('people', 'Земелька закончилась вничью', v.cx, v.cy);
    for (const u of g.members) if (zIsHero(u)) zemRecord(u, 0);
    return;
  }
  const wi = w === g.members[0] ? 0 : 1, l = g.members[1 - wi];
  v.win = wi; v.winT = now;
  zemPose(w, 'spin', 1.7, 'wave');
  gSay(w, zPick(['Земля моя!', 'Выиграл!', 'Вся земля — моя!']), '#d8f0a0');
  sfxAt('cheer', w.x * TILE, w.y * TILE);
  fxBurst(w.x * TILE, w.y * TILE - 20, 14, ['#ffe070', '#fff6c0', '#ff9ac0', '#9ad8ff'], 56, 40, 0.9, 1.4, 70);
  zemPose(l, 'sad', 1.5);
  zemReact(g, 'win', wi);
  logEvent('people', `Земелька: ${gUnitName(w).toLowerCase()} отобрал землю у ${gUnitName(l).toLowerCase()}`, v.cx, v.cy);
  if (zIsHero(w)) zemRecord(w, 1); if (zIsHero(l)) zemRecord(l, -1);
}

function zemEndTick(g, s, now) {
  const v = g.vis, el = now - g.stT;
  if (v.win >= 0) {
    const w = g.members[v.win], l = g.members[1 - v.win], kn = v.kn[v.win];
    if (w.gp && !g.ef && el > 1.7) { g.ef = 1; zemPose(w, 'cheer', 4); }
    // проигравший идёт к чужому ножу, тянет его зубами и возвращается
    if (kn && l.gp && g.ef < 2 && el > 1.6) {
      g.ef = 2;
      const kx = v.cx + kn[0] / TILE, ky = v.cy + (kn[1] + 6) / TILE - 6 / TILE, sl = g.slot[l.id];
      const d = Math.hypot(kx - l.x, ky - l.y) || 1, ex = kx - (kx - l.x) / d * 0.5, ey = ky - (ky - l.y) / d * 0.5;
      g.walkTo = [ex, ey];
      l.hopMove = { x0: l.x, y0: l.y, x1: ex, y1: ey, t0: now, dur: 0.9, h: 1.5 };
      gSay(l, 'Мфм… достану зубами', '#ffd0d0');
    }
    if (kn && g.ef === 2 && el > 2.7 && !l.hopMove && l.gp) { g.ef = 3; zemPose(l, 'tooth', 0); v.pull = { i: v.win, t0: now }; }
    if (kn && g.ef === 3 && el > 5.0 && l.gp) {
      g.ef = 4; v.pull = null; v.kn[v.win] = null;
      zemPose(l, 'sad', 1.2);
      sfxAt('zPop', l.x * TILE, l.y * TILE);
      fxBurst(l.x * TILE, l.y * TILE - 14, 6, ['#c8ccd4', '#eef0f6', '#e0d4b0'], 30, 30, 0.5, 1.1, 120);
      gSay(l, zPick(['Фтфу!', 'Земля на зубах…']), '#ffd0d0');
    }
    if (g.ef === 4 && el > 5.5 && l.gp && !l.hopMove) {
      g.ef = 5; const sl = g.slot[l.id];
      if (sl) l.hopMove = { x0: l.x, y0: l.y, x1: sl.x, y1: sl.y, t0: now, dur: 0.9, h: 1.5 };
      if (Math.random() < 0.6) gSay(w, zPick(['Давай ещё!', 'Реванш?', 'Не обижайся']), '#d8f0a0');
    }
  }
  if (el > 7.2) endGroup(g, 'done');
}

// ---------- Герой играет ----------

function zemRecord(h, res) {
  const z = Game.zem || (Game.zem = { n: 0, w: 0, l: 0, d: 0, st: 0, best: 0 });
  z.n++;
  if (res > 0) { z.w++; z.st++; z.best = Math.max(z.best, z.st); } else if (res < 0) { z.l++; z.st = 0; } else z.d++;
  if (res > 0) floater(h.x, h.y - 2.4, `Побед в земельку: ${z.w}`, '#ffe070');
  if (res > 0 && (z.w === 1 || z.w === 5 || z.w === 15)) {
    const t = z.w === 1 ? 'Первая победа в ножички!' : z.w === 5 ? 'Пять побед в ножички — гномы зовут тебя «Землемером»' : 'Король земельки: пятнадцать побед';
    if (typeof toast === 'function' && typeof document !== 'undefined') toast(t); else if (typeof coopSay === 'function' && h.owner) coopSay(h.owner, t);
  }
}

function zemSay(u, t) { floater(u.x, u.y - 1.6, t, '#ffd0a0'); }

function zemPartner(h) {
  let best = null, bd = 17;
  for (const o of Game.units) {
    if (o === h || o.dead || o.inside || o.brk || o.gp || o.glide || o.carry || o.dlv || !isPerson(o) || zIsHero(o) || o.teamOf || o.cmd || o.rec || o.gx || o.gm) continue;
    if (!o.idleFlag || o.isCourier || o.repairJob || o.food < HUNGRY || o.injury === 'leg') continue;
    const d = Math.hypot(o.x - h.x, o.y - h.y);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

function zemStartHero(h) {
  if (!h || !h.hero || h.dead || h.gp || h.inside) return false;
  if (!gameWeatherOK() || !startOpen('games')) { zemSay(h, 'Сейчас не до игры'); return false; }
  if (GROUPS.length > GAME_CAP) { zemSay(h, 'Вокруг и так игры'); return false; }
  if ((H => H.stunUntil > Game.time || H.drunkUntil > Game.time)(h.hero)) { zemSay(h, 'Не в том я состоянии'); return false; }
  // в коопе другой герой рядом может принять вызов; иначе — гном
  let mate = null;
  if (ZI.ch && ZI.ch.u !== h.id && Game.time - ZI.ch.t < 14) { const c = Game.unitMap.get(ZI.ch.u); if (c && !c.dead && !c.gp && Math.hypot(c.x - h.x, c.y - h.y) < 18) mate = c; }
  if (!mate) mate = zemPartner(h);
  if (!mate) { zemSay(h, 'Не с кем играть'); return false; }
  const sp = gameSpot(h.x, h.y, 5, 2);
  if (!sp) { zemSay(h, 'Тут тесно'); return false; }
  if (zIsHero(mate)) { ZI.ch = null; heroStopUnit(mate); }
  heroStopUnit(h);
  const { g } = zemBegin(h, mate, sp, false);
  gSay(h, zPick(['Давай в земельку!', 'Сыграем в ножички?']), '#ffe9a0');
  if (!zIsHero(mate)) gSay(mate, zPick(['Давай!', 'Ну держись!', 'Я в это мастер']), '#ffe9a0');
  return true;
}

function zemLeave(h) {
  const g = zemGameOf(h);
  if (!g) return;
  floater(h.x, h.y - 1.6, 'Я пас', '#ffd0a0');
  h.gp = null; h.proc = null; h.action = null;
  g.dropped = true;
}

// Единый вход: кнопка, клавиша N и сообщение коопа; a — 'start' | 'throw' | 'leave' (пусто — по обстановке)
function zemAct(h, a) {
  if (!h || !h.hero || h.dead) return;
  const g = zemGameOf(h);
  if (g) {
    if (g.st === 'hold' && g.members[g.turn % 2] === h && a !== 'leave') zemRelease(g, h);
    else if (a === 'leave') zemLeave(h);
    return;
  }
  if (a === 'throw' || a === 'leave') return;
  // в коопе, если рядом другой герой: первый нажавший зовёт («Кто в ножички?»), второй принимает; не откликнулись — играем с гномом
  const fresh = ZI.ch && Game.time - ZI.ch.t < 14;
  if (h.owner && !(fresh && ZI.ch.u !== h.id)) {
    const other = Game.units.find(o => o !== h && zIsHero(o) && o.owner && !o.gp && !o.dead && Math.hypot(o.x - h.x, o.y - h.y) < 18);
    if (other && !fresh) {
      ZI.ch = { u: h.id, t: Game.time };
      ZI.fb = { u: h.id, t: Game.time + 12 };
      floater(h.x, h.y - 1.9, 'Кто в ножички? (N)', '#ffe070');
      return;
    }
  }
  ZI.fb = null;
  zemStartHero(h);
}

// Клик по карте героя в игре: на своём ходу — бросок; далеко от круга — уйти из игры (и выполнить приказ)
function zemClick(h, c) {
  const g = zemGameOf(h);
  if (!g) return false;
  if (g.st === 'hold' && g.members[g.turn % 2] === h) { zemRelease(g, h); return true; }
  if (Math.hypot(c.tx - g.vis.cx, c.ty - g.vis.cy) > 9) { zemLeave(h); return false; }
  return true;
}

// ---------- Подключение: приказы героя, кооп, дети, сохранение ----------

{
  const _ic = issueCmd;
  issueCmd = function (hero, c) {
    if (hero.gp && hero.gp.k === 'knives' && hero.hero && !(typeof Coop !== 'undefined' && Coop.on) && zemClick(hero, c)) return;
    return _ic(hero, c);
  };
  const _gt = gamesTick;
  gamesTick = function (dt) {
    zemInstall();
    if (ZI.fb && Game.time >= ZI.fb.t) { const h = Game.unitMap.get(ZI.fb.u); ZI.fb = null; if (h && !h.dead && !h.gp) { ZI.ch = null; zemStartHero(h); } }
    _gt(dt);
  };
  if (typeof kidPlayPick === 'function') {
    const _kpp = kidPlayPick;
    kidPlayPick = function (u) { const k = _kpp(u); return k === 'gorodki' && Math.random() < 0.45 ? 'zem' : k; };
    const _kr = kpRun;
    kpRun = function* (u, kind) {
      if (kind === 'zem') { const gen = startKnives(u); if (gen) yield* gen; else yield { wait: 0.6 }; return; }
      yield* _kr(u, kind);
    };
  }
  const _sg = serializeGame;
  serializeGame = function () { const s = _sg(); if (Game.zem && Game.zem.n) s.zem = Game.zem; return s; };
  const _as = applySave;
  applySave = function (s) {
    _as(s);
    const z = s.zem;
    Game.zem = z && Number.isFinite(z.n) ? { n: z.n | 0, w: z.w | 0, l: z.l | 0, d: z.d | 0, st: z.st | 0, best: z.best | 0 } : null;
    ZKS.clear();
  };
  const _rgs = resetGameState;
  resetGameState = function () { _rgs(); Game.zem = null; ZI.ch = null; ZKS.clear(); };
}

// Кооп-сервер: файл coopsim.js грузится позже, поэтому его функции оборачиваем при первом тике
function zemInstall() {
  if (ZI.cmd) return;
  if (typeof coopCmd === 'function' && typeof coopGo === 'function') {
    ZI.cmd = true;
    const _cc = coopCmd;
    coopCmd = function (name, msgJson, admin) {
      let m = null;
      try { m = JSON.parse(msgJson); } catch (e) { /* дальше разберётся сам coopCmd */ }
      if (m && m.t === 'zem') { const u = coop.players.get(name); if (u) zemAct(u, m.a); return; }
      return _cc.apply(this, arguments);
    };
    const _cg = coopGo;
    coopGo = function (u, x, y) {
      if (u.gp && u.gp.k === 'knives' && zemClick(u, { tx: x, ty: y })) return;
      return _cg.apply(this, arguments);
    };
  }
}

// ---------- Рисование: земля ----------

const KN_OWN = ['', '122,180,255', '255,140,110'];

// Круг ножичков: канавка, черта пополам, тень территории, вспышка куска, прицел, ножи
drawKnivesGround = function (c, v, px, py) {
  const s = knifeState(v), Rp = v.R * TILE, half = s.N * KN_CELL / 2, now = Game.time;
  if (s.cvDirty || !s.cv) knifeTint(s);
  const steps = Math.round(Rp * 6.2832), n = Math.round(steps * v.draw);
  c.save(); c.translate(px, py);
  if (v.line) {
    c.imageSmoothingEnabled = false;
    c.globalAlpha = Math.min(1, (now - (v.lineT || 0)) / 0.5) * (c.globalAlpha || 1);
    c.drawImage(s.cv, -half, -half, s.N * KN_CELL, s.N * KN_CELL);
    c.globalAlpha = 1;
  }
  for (let k = 0; k < n; k++) {
    const a = k / steps * 6.2832, x = Math.round(Math.cos(a) * Rp), y = Math.round(Math.sin(a) * Rp);
    c.fillStyle = KN_LIGHT; c.fillRect(x + 1, y + 1, 1, 1);
    c.fillStyle = KN_GROOVE; c.fillRect(x, y, 2, 1);
  }
  // граница: пока делим — открывается вдоль черты, потом вся
  const nx = Math.cos(v.th), ny = Math.sin(v.th);
  if (v.line || v.dv > 0) {
    for (let k = 0; k < s.bd.length; k += 2) {
      const x = s.bd[k] * KN_CELL - half, y = s.bd[k + 1] * KN_CELL - half;
      if (!v.line && ((-ny * x + nx * y) / Rp + 1) / 2 > v.dv) continue;
      c.fillStyle = KN_LIGHT; c.fillRect(x + 2, y + 1, 1, 2);
      c.fillStyle = KN_GROOVE; c.fillRect(x, y, 2, 2);
    }
  }
  // вспышка и заливка отрезанного куска
  const age = now - s.chgT;
  if (s.chg && age >= 0 && age < 1.4) {
    const rev = age / 0.6, col = KN_OWN[s.chgOwner];
    for (let k = 0; k < s.chg.length; k++) {
      const cell = s.chg[k], d = s.chgD[k], x = (cell % s.N) * KN_CELL - half, y = ((cell / s.N) | 0) * KN_CELL - half;
      if (d <= rev) c.fillStyle = `rgba(${col},${Math.max(0.12, 0.7 - (age - d * 0.6) * 0.45).toFixed(2)})`;
      else c.fillStyle = `rgba(255,248,220,${(0.45 * (1 - Math.min(1, age / 0.6))).toFixed(2)})`;
      c.fillRect(x, y, KN_CELL, KN_CELL);
    }
    if (age < 0.7) {                                                 // светлая кромка бежит вдоль черты
      c.fillStyle = 'rgba(255,255,255,0.7)';
      for (let k = 0; k < s.chg.length; k += 3) { if (Math.abs(s.chgD[k] - rev) < 0.06) { const cell = s.chg[k]; c.fillRect((cell % s.N) * KN_CELL - half, ((cell / s.N) | 0) * KN_CELL - half, KN_CELL, KN_CELL); } }
    }
  }
  if (v.prev) {                                                      // черта через нож: растёт в обе стороны
    const p = Math.min(1, (now - v.prev.t0) / v.prev.dur), m = 40, kx = v.prev.kx, ky = v.prev.ky;
    for (let side = 0; side < 2; side++) {
      const ex = side ? v.prev.x1 : v.prev.x0, ey = side ? v.prev.y1 : v.prev.y0, pp = side ? Math.max(0, p * 2 - 1) : Math.min(1, p * 2);
      for (let k = 0; k < m * pp; k++) {
        const t = k / m, x = Math.round(kx + (ex - kx) * t), y = Math.round(ky + (ey - ky) * t);
        c.fillStyle = KN_GROOVE; c.fillRect(x, y, 2, 1);
      }
    }
  }
  const kn = v.kn || [];
  for (let i = 0; i < 2; i++) {
    const k = kn[i]; if (!k) continue;
    if (k[3] === 1 || k[3] === 2) drawKnifeLying(c, k[0], k[1], now - k[2], k[3] === 2);
    else drawKnifePulled(c, k[0], k[1], now - k[2], v.pull && v.pull.i === i ? now - v.pull.t0 : -1);
  }
  if (v.aim && !v.out) drawAimMark(c, v, now);
  c.restore();
};

// Нож лежит: упал плашмя или улетел мимо; два отскока и тишина
function drawKnifeLying(c, x, y, age, far) {
  const b = age < 0.5 ? Math.abs(Math.sin(age * 12)) * Math.max(0, 1 - age * 2) * 4 : 0, rot = (far ? 0.9 : -0.4) + (age < 0.5 ? Math.sin(age * 18) * 0.3 * (1 - age * 2) : 0);
  c.fillStyle = 'rgba(10,8,4,0.3)'; c.fillRect(Math.round(x) - 3, Math.round(y) + 1, 8, 2);
  c.save(); c.translate(Math.round(x), Math.round(y - b)); c.rotate(rot); drawKnifeFlat(c); c.restore();
}

// Воткнутый нож: дрожит; при вытаскивании зубами дёргается рывками и выскакивает
function drawKnifePulled(c, x, y, age, pull) {
  if (pull < 0) { drawKnifeStuck(c, x, y, age); return; }
  const jerk = Math.floor(pull / 0.7), up = Math.min(7, jerk * 2 + (pull % 0.7 < 0.18 ? 1 : 0)), sh = Math.sin(pull * 40) * 0.5;
  c.save(); c.translate(Math.round(x + sh), Math.round(y - up));
  c.rotate(-0.22 + Math.sin(pull * 14) * 0.12);
  gpx(c, -1, -10, 2, 5, '#6a3c1e'); gpx(c, -1, -10, 1, 5, '#8a5430');
  gpx(c, -3, -5, 6, 1, '#c8a850'); gpx(c, -3, -5, 2, 1, '#e8cc70');
  gpx(c, -1, -4, 2, 4 + Math.min(up, 4), '#c8ccd4'); gpx(c, -1, -4, 1, 4 + Math.min(up, 4), '#eef0f6');
  c.restore();
  gpx(c, x - 3, y, 2, 1, '#6a4c30'); gpx(c, x + 2, y + 1, 2, 1, '#6a4c30');
  if (pull % 0.7 < 0.1) gpx(c, x + (pull * 7 % 5) - 2, y - up - 1, 1, 1, '#c8a878');
}

function drawAimMark(c, v, now) {
  const [rx, ry] = zemReticle(v, now - v.aim.t0), pulse = 1 + Math.sin(now * 9) * 0.25, r = Math.round(5 * pulse);
  const hot = Math.floor(now * 5) & 1;
  c.fillStyle = 'rgba(10,8,4,0.35)'; c.fillRect(Math.round(rx) - r, Math.round(ry) + 1, r * 2 + 1, 1);
  c.fillStyle = hot ? '#ffe070' : '#fff6c0';
  c.fillRect(Math.round(rx) - r, Math.round(ry), 3, 1); c.fillRect(Math.round(rx) + r - 2, Math.round(ry), 3, 1);
  c.fillRect(Math.round(rx), Math.round(ry) - r, 1, 3); c.fillRect(Math.round(rx), Math.round(ry) + r - 2, 1, 3);
  c.fillStyle = '#ff6a3a'; c.fillRect(Math.round(rx), Math.round(ry), 1, 1);
}

// ---------- Рисование: воздух (счёт, след ножа, подсказки) ----------

const _drawGamesAirZ = drawGamesAir;
drawGamesAir = function (c) {
  _drawGamesAirZ(c);
  const L = Game.games;
  if (typeof document !== 'undefined') zemBtnUpdate();
  if (!L || !L.length) return;
  const now = Game.time;
  for (const v of L) {
    if (v.k !== 'knives' || (v.out && now - v.out > 1.4)) continue;
    const px = Math.round(v.cx * TILE), py = Math.round(v.cy * TILE + 6), Rp = v.R * TILE;
    if (v.fly) {                                                   // след в воздухе и тень на земле
      const f = v.fly, p = Math.min(1, (now - f.t0) / f.dur);
      for (let k = 1; k <= 4; k++) {
        const q = Math.max(0, p - k * 0.07), x = f.x0 + (f.x1 - f.x0) * q, y = f.y0 + (f.y1 - f.y0) * q - Math.sin(q * Math.PI) * f.h;
        c.fillStyle = `rgba(230,236,255,${(0.3 - k * 0.06).toFixed(2)})`; c.fillRect(Math.round(x), Math.round(y), 2, 1);
      }
      const gx = f.x0 + (f.x1 - f.x0) * p, gy = f.y0 + (f.y1 - f.y0) * p;
      c.fillStyle = 'rgba(10,8,4,0.25)'; c.fillRect(Math.round(gx) - 2, Math.round(Math.max(gy, f.y1 - 3)) + 3, 5, 1);
    }
    if (v.line && !(v.win >= 0 && now - v.winT > 6)) {              // счёт над кругом
      const w = 28, x = px - 14, y = py - Rp - 11, a = v.sc[0] / 100;
      c.fillStyle = 'rgba(10,8,4,0.6)'; c.fillRect(x - 1, y - 1, w + 2, 5);
      c.fillStyle = '#5a9af0'; c.fillRect(x, y, Math.round(w * a), 3);
      c.fillStyle = '#e8644c'; c.fillRect(x + Math.round(w * a), y, w - Math.round(w * a), 3);
      c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(x, y, w, 1);
      c.fillStyle = '#fff6d0'; c.fillRect(px - 1, y - 2, 2, 7);
    }
    if (v.aim && Game.hero && v.aim.u === Game.hero.id) {          // подсказка своему
      const k = Math.max(0, 1 - (now - v.aim.t0) / v.aim.T);
      c.fillStyle = 'rgba(10,8,4,0.6)'; c.fillRect(px - 15, py + Rp + 9, 30, 4);
      c.fillStyle = k > 0.3 ? '#ffe070' : '#ff6a3a'; c.fillRect(px - 14, py + Rp + 10, Math.round(28 * k), 2);
    }
  }
};

// ---------- Рисование: гномы ----------

const _drawGameUnitZ = drawGameUnit;
drawGameUnit = function (c, u, gp) {
  if (gp.k === 'knives' && zemDrawUnit(c, u, gp)) return;
  _drawGameUnitZ(c, u, gp);
};

// Нож в руке: точка тела (dx, dy от ног) поворачивается вместе с наклоном
function zBodyPt(px, py, dx, dy, rot, lift) {
  const ry = dy + 10, cs = Math.cos(rot), sn = Math.sin(rot);
  return [px + dx * cs - ry * sn, py + dx * sn + ry * cs - 10 - lift];
}

function zKnife(c, x, y, rot, flip) {
  c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(flip, 1); c.rotate(rot); drawKnifeFlat(c); c.restore();
}

function zemDrawUnit(c, u, gp) {
  const now = Game.time, toward = gp.cx > u.x ? 1 : -1, px = Math.round(u.x * TILE), py = Math.round(u.y * TILE + 6);
  const age = now - (gp.pt || now);
  switch (gp.pose) {
    case 'throw': case 'ready': {
      const tr = ZEM_TRICKS[(gp.trk | 0) % ZEM_TRICKS.length];
      let f, wob = 0;
      if (gp.pose === 'ready') { f = 3; wob = Math.sin(now * 7) * 0.012; }
      else f = Math.max(0, Math.min(8, Math.floor((now - gp.ph) / 0.1)));
      const rot = toward * ZT_ROT[f] + wob, lift = ZT_LIFT[f] + (tr.k === 'head' && f >= 2 && f <= 5 ? -1 : 0);
      let flipFace = null;
      if (tr.k === 'spin' && gp.pose === 'throw' && f >= 1 && f <= 6) { flipFace = u.face; u.face = (f & 1) ? -toward : toward; }
      drawUnitXform(c, u, lift, rot + (tr.k === 'head' && f >= 3 && f <= 6 ? toward * 0.08 : 0), 0, 1);
      if (flipFace !== null) u.face = flipFace;
      if (gp.kv && !gp.rel || (gp.pose === 'ready')) {
        const [kx, ky] = zBodyPt(px, py, toward * (tr.hx + ZT_WX[f]), tr.hy + ZT_WY[f], rot, lift);
        zKnife(c, kx, ky, ZT_KR[f] * toward, toward);
      }
      drawFlower(c, u);
      return true;
    }
    case 'kneel': {
      const sv = u.anim; u.anim = 'forage'; _drawUnitGames(c, u); u.anim = sv;
      if (gp.tip) {                                                // нож в руке чертит по земле
        const tx = gp.tip[0], ty = gp.tip[1], hx = px + toward * 4, hy = py - 8, a = Math.atan2(ty - hy, tx - hx);
        c.save(); c.translate(Math.round((tx + hx) / 2), Math.round((ty + hy) / 2)); c.rotate(a); drawKnifeFlat(c); c.restore();
        if ((now * 12 | 0) & 1) gpx(c, tx + (Math.sin(now * 31) * 2 | 0), ty - 1, 1, 1, '#d8c8a0');
      }
      return true;
    }
    case 'watch': { drawUnitXform(c, u, 0, toward * (0.045 + Math.sin(now * 2.1 + u.id) * 0.012), 0, 1); drawFlower(c, u); return true; }
    case 'hush': { drawUnitXform(c, u, 0, toward * (0.13 + Math.sin(now * 11 + u.id) * 0.01), 0, 1); drawFlower(c, u); return true; }
    case 'cheer': {                                                // подскоки, руки вверх — жестом
      const ph = (now + u.id * 0.11) / 0.42, lift = Math.abs(Math.sin(ph * Math.PI)) * 7.5;
      drawUnitXform(c, u, lift, Math.sin(ph * Math.PI * 2) * 0.09, 0, 1 - lift / 16);
      drawFlower(c, u);
      if (gp.role !== 'fan' && Game.games && Game.games.some(v => v.k === 'knives' && v.win >= 0 && v.cx === gp.cx && v.cy === gp.cy)) drawCrown(c, px, py - 41 - lift, now);
      return true;
    }
    case 'spin': {                                                 // победная вертушка: разворачивается на месте, прыгая
      const ph = (now - gp.pt) / 0.2, lift = Math.abs(Math.sin(ph * Math.PI * 0.5)) * 6, sv = u.face;
      u.face = (Math.floor(ph) & 1) ? -1 : 1;
      drawUnitXform(c, u, lift, 0, 0, 1 - lift / 14);
      u.face = sv;
      drawFlower(c, u);
      drawCrown(c, px, py - 41 - lift, now);
      return true;
    }
    case 'sad': {                                                  // сник: плечи вниз, голова на грудь, капля пота
      const k = Math.min(1, age / 0.25);
      drawUnitXform(c, u, -1.2 * k, toward * (0.12 + Math.sin(now * 2.4) * 0.02) * k, 0, 1);
      drawFlower(c, u);
      const dy = (now * 14) % 9; gpx(c, px - toward * 6, py - 32 + dy, 1, 2, '#9fd4ff');
      return true;
    }
    case 'gasp': {                                                 // отпрянул, потом дрожь
      const k = Math.exp(-age * 2.4);
      drawUnitXform(c, u, Math.max(0, 3 * (1 - age * 5)), -toward * (0.2 * k + Math.sin(age * 38) * 0.02 * k), 0, 1);
      drawFlower(c, u);
      if (age < 0.5) { gpx(c, px - 3, py - 40, 1, 3, '#fff6d0'); gpx(c, px - 3, py - 36, 1, 1, '#fff6d0'); }   // «!»
      return true;
    }
    case 'smirk': { drawUnitXform(c, u, 0, -toward * 0.03 + Math.sin(now * 5 + u.id) * 0.035, 0, 1); drawFlower(c, u); return true; }
    case 'shrug': { const k = Math.sin(now * 3.1 + u.id); drawUnitXform(c, u, Math.max(0, k) * 1.5, k * 0.07, 0, 1); drawFlower(c, u); return true; }
    case 'tooth': {                                                // тянет нож зубами: упёрся, дёрнул, шатается
      const v = Game.games && Game.games.find(x => x.k === 'knives' && x.cx === gp.cx && x.cy === gp.cy), pull = v && v.pull ? now - v.pull.t0 : age;
      const sv = u.anim; u.anim = 'forage';
      const jit = Math.round(Math.sin(pull * 38) * (pull % 0.7 < 0.4 ? 1.2 : 0.3));
      c.save(); c.translate(jit, 0); _drawUnitGames(c, u); c.restore();
      u.anim = sv;
      return true;
    }
  }
  return false;
}

function drawCrown(c, x, y, now) {
  const b = Math.round(Math.sin(now * 6) * 0.6);
  gpx(c, x - 3, y + b, 7, 2, '#e8c040'); gpx(c, x - 3, y - 2 + b, 1, 2, '#e8c040'); gpx(c, x, y - 3 + b, 1, 3, '#e8c040'); gpx(c, x + 3, y - 2 + b, 1, 2, '#e8c040');
  gpx(c, x - 3, y + b, 7, 1, '#fff0a0'); gpx(c, x, y + 1 + b, 1, 1, '#e0405a');
  if ((now * 6 | 0) % 5 === 0) gpx(c, x + 4, y - 3 + b, 1, 1, '#ffffff');
}

// ---------- Кнопка героя ----------

let zemBtn = null, zemBtnAt = 0, zemBtnMode = '';
function zemBtnUpdate() {
  const t = performance.now();
  if (t - zemBtnAt < 200) return;
  zemBtnAt = t;
  const h = Game.hero;
  let mode = '';
  if (h && h.hero && !h.dead) {
    if (h.gp && h.gp.k === 'knives') {
      const mine = (Game.games || []).find(v => v.k === 'knives' && !v.out && v.aim && v.aim.u === h.id);
      mode = mine ? 'throw' : 'leave';
    } else if (!h.gp && startOpen('games') && gameWeatherOK() && !Game.over) {
      for (const o of Game.units) if (o !== h && !o.dead && !o.inside && isPerson(o) && !o.gp && Math.hypot(o.x - h.x, o.y - h.y) < 8) { mode = 'start'; break; }
    }
  }
  if (!zemBtn) {
    const view = document.getElementById('view');
    if (!view) return;
    const st = document.createElement('style');
    st.textContent = `#zem-btn{position:absolute;left:50%;transform:translateX(-50%);bottom:12px;z-index:6;padding:6px 16px;background:rgba(26,19,13,.9);color:#f6d458;border:1px solid #b8902c;border-radius:6px;cursor:pointer;font-size:14px;display:none}
      #zem-btn.throw{background:#7a2a14;color:#fff0c0;border-color:#ffe070;font-size:17px;padding:10px 28px;animation:zemp .5s infinite alternate}
      @keyframes zemp{to{transform:translateX(-50%) scale(1.07)}}
      body.mobile #zem-btn{bottom:calc(120px + env(safe-area-inset-bottom))}`;
    document.head.appendChild(st);
    zemBtn = document.createElement('button'); zemBtn.id = 'zem-btn';
    zemBtn.onclick = () => zemPressUI();
    view.appendChild(zemBtn);
    window.addEventListener('keydown', e => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.code === 'KeyN' && zemBtnMode) zemPressUI();
    });
  }
  if (mode !== zemBtnMode) {
    zemBtnMode = mode;
    zemBtn.className = mode === 'throw' ? 'throw' : '';
    zemBtn.style.display = mode ? 'block' : 'none';
    zemBtn.textContent = mode === 'throw' ? 'Бросить! (N)' : mode === 'leave' ? 'Выйти из игры' : 'Ножички (N)';
  }
}

function zemPressUI() {
  const h = Game.hero;
  if (!h || !zemBtnMode) return;
  const a = zemBtnMode === 'throw' ? 'throw' : zemBtnMode === 'leave' ? 'leave' : 'start';
  if (typeof Coop !== 'undefined' && Coop.on) coopSend({ t: 'zem', a });
  else zemAct(h, a);
}
