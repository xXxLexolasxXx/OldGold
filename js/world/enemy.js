'use strict';
// Главный злодей: тёмный маг Малгор из Чёрного шпиля (та самая башня с заставки, нарисованная в её стиле).
// Дизайн — ВРАГ.md. Гнев Малгора растёт с ночами и размером деревни: дозорные огни → вороны-разведчики →
// проклятия → набеги прислужников (воруют со складов) → осада с рыцарями тьмы. Победить его можно только
// походом героя к шпилю: бой по трём фазам. Победа: Game.foe.defeated / foeDefeated() (флаг для сюжета).
// Считается там же, где вся игра (в кооперативе — на сервере), клиентам уходит зеркало (foeMirror*).
// Подключается после neutrals.js и herokit.js: оборачивает их «врагов» (foesNear, strike, fightGen…).

const FOE_ON = true;                     // false — враг не создаётся (старые сохранения тоже)
const FOE_STAGES = [12, 28, 44, 60, 85]; // гнев, с которого начинается ступень 1…5
const FOE_GRACE = 3;                     // первые ночи без событий
const FOE_SEE = 7;                       // с какого расстояния налётчик замечает жителя
const FOE_MAX = 12;                      // налётчиков одновременно

// dmg — удар, cd — пауза, rng — дальность, spd — клеток/с, parry — шанс отвести удар
const FSPEC = {
  raven:  { name: 'Ворон-разведчик',   mhp: 6,   spd: 4.4, fly: true, xp: 8, sz: 5 },
  thrall: { name: 'Прислужник тьмы',   mhp: 34,  dmg: [3, 6],   cd: 1.5, rng: 1.5, spd: 2.25, parry: 0.1,  xp: 38,  sz: 8,
    drop: [['gold', 1, 0.5], ['magicstone', 1, 0.4], ['iron', 1, 0.25]] },
  knight: { name: 'Рыцарь тьмы',       mhp: 100, dmg: [8, 13],  cd: 1.9, rng: 1.8, spd: 1.95, parry: 0.28, xp: 120, sz: 11,
    drop: [['gold', 3, 1], ['magicstone', 2, 0.8], ['ironArmor', 1, 0.2]] },
  malgor: { name: 'Тёмный маг Малгор', mhp: 440, dmg: [9, 14],  cd: 2.1, rng: 2.2, spd: 1.7, parry: 0,    xp: 900, sz: 10 },
};
const FOE_PHASE_NAME = ['', 'Призыв', 'Зелёный огонь', 'Ярость'];

Game.raiders = [];
Game.foeShots = [];
Game.foe = null;

const foeUnit = id => (id ? Game.unitMap.get(id) || null : null);
const foeLive = N => N && N.st !== 'die' && N.st !== 'vanish';
const foeR = (a, b) => a + Math.random() * (b - a);
const foeDefeated = () => !!(Game.foe && Game.foe.defeated);
const foeStage = () => (Game.foe ? Game.foe.stage : 0);
const foeOnSim = () => !isMirror();
if (typeof window !== 'undefined' && FOE_ON) window.ENEMY_READY = true;     // для js/goal.js: настоящий враг есть

// Хук сценария (js/goal.js, СЮЖЕТ.md): глава 5 — маг заметил деревню, глава 6 — осада и поход к шпилю
function enemyOnChapter(n) {
  const F = Game.foe;
  if (!F || F.defeated || isMirror()) return;
  F.known = true;
  const need = n >= 6 ? FOE_STAGES[3] : n >= 5 ? FOE_STAGES[2] : 0;
  if (F.wrath < need) F.wrath = need;
  F.nights = Math.max(F.nights, FOE_GRACE);
  if (n >= 6) toast('Чёрный шпиль отмечен на миникарте. Соберите героя и отряд — Малгор ждёт у своей двери.');
}

// ---------- Шпиль: выбор места ----------

function foePickTower(seed) {
  const rng = mulberry32((((seed | 0) ^ 0x6D41C0) >>> 0));
  const cx = MAP_W >> 1, cy = MAP_H >> 1, st = floodFrom(cx, cy);
  const minD = Math.min(MAP_W, MAP_H) * 0.36;
  let best = null;
  for (let k = 0; k < 9000; k++) {
    const x = 7 + (rng() * (MAP_W - 16) | 0), y = 6 + (rng() * (MAP_H - 16) | 0);
    const d = Math.hypot(x + 1.5 - cx, y + 1 - cy);
    if (d < minD || (best && d <= best.d)) continue;
    let ok = true;
    // подножие 3×2, площадка перед ним 5×3 — ровная доступная земля; вокруг — не вода
    for (let yy = y - 2; yy <= y + 6 && ok; yy++) for (let xx = x - 3; xx <= x + 5; xx++) {
      if (!inb(xx, yy)) { ok = false; break; }
      const i = idx(xx, yy), t = World.terrain[i];
      if (t === T_WATER || World.bmap[i] || World.road[i]) { ok = false; break; }
      const front = yy >= y + 2 && yy <= y + 4 && xx >= x - 1 && xx <= x + 3;
      const foot = yy >= y && yy <= y + 1 && xx >= x && xx <= x + 2;
      if ((front || foot) && (t === T_ROCK || !reachedIn(st, xx, yy) && !foot)) { ok = false; break; }
    }
    if (!ok || Game.lairs.some(l => Math.hypot(l.x - x, l.y - y) < 8) || Game.buildings.some(b => Math.hypot(b.x - x, b.y - y) < 14)) continue;
    best = { x, y, d };
  }
  return best;
}

// расчистить поляну вокруг шпиля и закрыть клетки фундамента
function foeBuildTower(F) {
  const { tx, ty } = F;
  for (let yy = ty - 3; yy <= ty + 6; yy++) for (let xx = tx - 4; xx <= tx + 6; xx++) {
    const ex = (xx - tx - 1) / 5, ey = (yy - ty - 1.5) / (yy >= ty ? 5.5 : 3.2);
    if (!inb(xx, yy) || ex * ex + ey * ey > 1) continue;
    const i = idx(xx, yy), o = World.obj[i];
    if (o && (o.t === 'tree' || o.t === 'stump' || o.t === 'stone' && ey * ey + ex * ex < 1)) { World.obj[i] = null; World.growing.delete(i); }
  }
  foeMarkTower(F);
}
function foeMarkTower(F) {
  for (let yy = F.ty; yy < F.ty + 2; yy++) for (let xx = F.tx; xx < F.tx + 3; xx++) if (inb(xx, yy)) { World.bmap[idx(xx, yy)] = -1; World.obj[idx(xx, yy)] = null; }
  F.marked = true;
}

function foeInit(seed) {
  Game.raiders = []; Game.foeShots = []; Game.foe = null;
  if (!FOE_ON || Game.stress) return;
  const site = foePickTower(seed);
  if (!site) return;
  const rng = mulberry32((((seed | 0) ^ 0x51D3) >>> 0));
  const F = { tx: site.x, ty: site.y, wrath: 0, stage: 0, nights: 0, kills: 0, known: false, defeated: false, ni: -1, plan: [], fires: [], bossHp: FSPEC.malgor.mhp, said: 0, stat: { ravens: 0, raids: 0, loot: 0, hurt: 0, curses: 0 } };
  const cx = MAP_W >> 1, cy = MAP_H >> 1, tcx = F.tx + 1.5, tcy = F.ty + 2;
  // дозорные огни: четыре у подножия и два на подступах (между шпилем и деревней)
  const spot = (x, y) => randomFreeNear(Math.floor(x), Math.floor(y), 0, 2, (a, b) => isWalkable(a, b) && !World.obj[idx(a, b)]);
  for (let k = 0; k < 4; k++) {
    const a = -0.6 + k * 1.45 + rng() * 0.3, p = spot(tcx + Math.cos(a) * 6.2, tcy + 1 + Math.sin(a) * 4.2);
    if (p) F.fires.push(p);
  }
  for (const f of [0.34, 0.62]) { const p = spot(tcx + (cx - tcx) * f, tcy + (cy - tcy) * f); if (p) F.fires.push(p); }
  Game.foe = F;
  foeBuildTower(F);
  foeSpawnBoss(F);
}

function foeSpawnBoss(F) {
  if (F.defeated) return;
  const N = foeMake('malgor', F.tx + 1.5, F.ty + 3.2);
  N.hp = Math.max(1, F.bossHp || N.mhp); N.fz = 1; N.cdF = 3; N.cdS = 5; N.cdB = 6; N.inv = 0; N.home = [N.x, N.y];
  F.boss = N;
}

function foeMake(k, x, y) {
  const S = FSPEC[k], F = Game.foe;
  const sc = k === 'thrall' || k === 'knight' ? 1 + Math.max(0, (F ? F.wrath : 0) - 60) / 120 : 1;
  const N = {
    id: Game.nextId++, k, x, y, hx: x, hy: y, face: 1, st: 'idle', t: 0, ph: Math.random() * 6, tg: 0, cdA: 1, atkT: 9, hit: 1,
    mhp: Math.round(S.mhp * sc), hp: 0, lv: sc, ov: null, ovT: 0, dt: 0, vt: 0, prov: -99, scan: Math.random() * 0.5, loot: null, path: null, pi: 0, pk: '', pt: -99, castT: 0, hurtT: -9, sayT: 0,
  };
  N.hp = N.mhp;
  Game.raiders.push(N);
  return N;
}

// ---------- Гнев и ступени ----------

function foeWrathNow(F) {
  let pop = 0, bl = 0, stones = 0;
  for (const u of Game.units) if (!u.dead && isPerson(u)) pop++;
  for (const b of Game.buildings) if (b.state === 'done' && !b.removed) { bl++; if (b.isStore && b.isStore()) stones += (b.stock.magicstone || 0); }
  return Math.min(100, F.nights * 3 + pop * 0.8 + bl * 0.25 + Math.min(10, stones) * 0.5 + F.kills * 0.4);
}
const FOE_STAGE_MSG = [
  '',
  'Вдали, за лесом, в окнах Чёрного шпиля вспыхнул ядовито-зелёный свет… Кто-то там проснулся.',
  'Над деревней кружат вороны Чёрного шпиля — кто-то высматривает вас.',
  'Тёмный маг Малгор знает о вашей деревне. Он начинает насылать проклятия.',
  'Малгор шлёт слуг: по ночам — набеги на склады. Держитесь ближе к большому костру!',
  'Осада! Малгор послал рыцарей тьмы. Только поход к Чёрному шпилю положит этому конец.',
];

function foeEvening(F, ni) {
  F.nights++;
  F.wrath = Math.max(F.wrath, foeWrathNow(F));
  let stage = 0;
  if (F.nights >= FOE_GRACE) for (let i = 0; i < FOE_STAGES.length; i++) if (F.wrath >= FOE_STAGES[i]) stage = i + 1;
  if (stage > F.stage) {
    F.stage = stage;
    toast(FOE_STAGE_MSG[stage]);
    logEvent('night', FOE_STAGE_MSG[stage], F.tx + 1.5, F.ty + 1);
    if (stage >= 2) F.known = true;
  }
  const t0 = Game.time, long = isLongNight() ? 1.5 : 1;
  if (stage >= 2) {
    const n = Math.min(4, stage - 1 + (F.wrath > 70 ? 1 : 0));
    if (Math.random() < (stage === 2 ? 0.8 : 1)) F.plan.push({ at: t0 + foeR(8, 25), k: 'ravens', n });
  }
  if (stage >= 3 && Math.random() < (stage === 3 ? 0.5 : 0.7)) F.plan.push({ at: t0 + foeR(30, 70), k: 'curse', night: true });
  if (stage >= 4 && Math.random() < (stage === 4 ? 0.65 : 1)) {
    const thr = Math.min(7, Math.round((2 + Math.floor((F.wrath - 60) / 14)) * long));
    const kn = stage >= 5 ? Math.min(3, 1 + Math.floor((F.wrath - 85) / 8)) : 0;
    F.plan.push({ at: t0 + foeR(35, 75), k: 'raid', thr, kn, night: true });
  }
}

// ---------- Налёт: где появляются, проклятия ----------

function foeVillageCenter() {
  let sx = 0, sy = 0, n = 0;
  for (const b of Game.buildings) if (b.state === 'done' && !b.removed) { sx += b.x + b.w / 2; sy += b.y + b.h / 2; n++; }
  return n ? [sx / n, sy / n] : [MAP_W / 2, MAP_H / 2];
}

function foeRaidSite() {
  const F = Game.foe, [vx, vy] = foeVillageCenter();
  const st = floodFrom(Math.floor(vx), Math.floor(vy));
  const base = Math.atan2(F.ty + 1 - vy, F.tx + 1.5 - vx);
  for (let tries = 0; tries < 80; tries++) {
    const a = base + foeR(-0.9, 0.9), r = 34 - tries * 0.18;
    const x = Math.floor(vx + Math.cos(a) * r), y = Math.floor(vy + Math.sin(a) * r);
    if (!inb(x, y) || !isWalkable(x, y) || !reachedIn(st, x, y) || World.obj[idx(x, y)]) continue;
    if (nearBonfire(x, y, BONFIRE_NOSPAWN) || Game.buildings.some(b => Math.hypot(b.x - x, b.y - y) < 9)) continue;
    return [x + 0.5, y + 0.5];
  }
  return null;
}

function foeRaid(F, p) {
  const site = foeRaidSite();
  if (!site) return;
  F.stat.raids++;
  const list = [];
  for (let i = 0; i < p.thr; i++) list.push('thrall');
  for (let i = 0; i < p.kn; i++) list.push('knight');
  list.forEach((k, i) => {
    if (Game.raiders.filter(N => foeLive(N) && N.k !== 'raven' && N.k !== 'malgor').length >= FOE_MAX) return;
    const a = i * 2.4, N = foeMake(k, site[0] + Math.cos(a) * 1.4, site[1] + Math.sin(a) * 1.0);
    if (!isWalkable(Math.floor(N.x), Math.floor(N.y))) { N.x = site[0]; N.y = site[1]; }
    N.hx = site[0]; N.hy = site[1]; N.st = 'emerge'; N.t = -i * 0.5; N.hunt = k === 'knight';
  });
  fxBurst(site[0] * TILE, site[1] * TILE - 8, 26, ['#2a2452', '#9cff66', '#b07cff'], 80, 50, 1.1, 2.2, 120);
  sfxAt('wail', site[0] * TILE, site[1] * TILE, 1);
  toast(`Из тумана выходят слуги Малгора: ${list.length}! К костру и в дома!`);
  logEvent('night', `Набег Малгора: из тумана вышли слуги (${list.length})`, site[0], site[1]);
}

function foeCurse(F) {
  F.stat.curses++;
  const persons = Game.units.filter(u => !u.dead && isPerson(u) && !u.inside);
  const kinds = ['lanterns', 'hunger', 'whisper'];
  const k = kinds[(Math.random() * 3) | 0];
  if (k === 'lanterns') {
    let n = 0;
    for (const u of persons.sort(() => Math.random() - 0.5)) if (u.lantern && n < 3) { lanternFall(u); n++; }
    toast('Проклятие Малгора: фонари в деревне гаснут один за другим!');
    logEvent('night', 'Проклятие Малгора: гаснущие фонари');
  } else if (k === 'hunger') {
    for (const u of Game.units) if (!u.dead && isPerson(u) && u.food != null && !u.noFood) u.food = Math.max(0.05, u.food - 0.2);
    toast('Проклятие Малгора: мор голода — животы пусты!');
    logEvent('night', 'Проклятие Малгора: мор голода');
  } else {
    const gy = graveyardOf();
    if (!gy) { for (const u of Game.units) if (!u.dead && isPerson(u) && u.food != null && !u.noFood) u.food = Math.max(0.05, u.food - 0.2); toast('Проклятие Малгора: мор голода — животы пусты!'); logEvent('night', 'Проклятие Малгора: мор голода'); return; }
    for (let i = 0; i < 3; i++) {
      const x = gy.x - 1 + ((Math.random() * (gy.w + 2)) | 0), y = gy.y + gy.h;
      if (inb(x, y) && isWalkable(x, y)) skelRise(x + 0.5, y + 0.5, i * 0.8);
    }
    toast('Проклятие Малгора: злой шёпот — из могил встают лишние скелеты!');
    logEvent('night', 'Проклятие Малгора: злой шёпот над кладбищем');
  }
}

function foeRavens(F, n) {
  const [vx, vy] = foeVillageCenter();
  for (let i = 0; i < n; i++) {
    const N = foeMake('raven', F.tx + 1.5 + foeR(-1, 1), F.ty + 0.5);
    N.st = 'fly'; N.t = -i * 1.6; N.goal = [vx + foeR(-6, 6), vy + foeR(-5, 5)]; N.circ = 0;
  }
  logEvent('night', `Над деревней кружат вороны Малгора (${n})`, vx, vy);
}

// ---------- Движение ----------

function rdOk(N, x, y) {
  if (FSPEC[N.k].fly) return x > 0.5 && y > 0.5 && x < MAP_W - 0.5 && y < MAP_H - 0.5;
  if (!isWalkable(Math.floor(x), Math.floor(y))) return false;
  return N.k === 'malgor' || !nearBonfire(x, y, BONFIRE_SAFE);          // у большого костра слуги не держатся
}
function rdStep(N, tx, ty, spd, dt) {
  const dx = tx - N.x, dy = ty - N.y, d = Math.hypot(dx, dy);
  if (d < 0.05) return true;
  const st = Math.min(d, spd * dt), nx = N.x + dx / d * st, ny = N.y + dy / d * st;
  if (rdOk(N, nx, ny)) { N.x = nx; N.y = ny; }
  else if (rdOk(N, nx, N.y)) N.x = nx;
  else if (rdOk(N, N.x, ny)) N.y = ny;
  else { N.stuck = (N.stuck || 0) + dt; if (N.stuck > 0.8) { N.stuck = 0; return true; } return false; }
  if (Math.abs(dx) > 0.05) N.face = dx > 0 ? 1 : -1;
  N.ph += st * 3.6;
  return d - st < 0.1;
}
// дальняя дорога — по найденному пути, ближняя и полёт — прямо
function rdGo(N, tx, ty, spd, dt) {
  if (FSPEC[N.k].fly || Math.hypot(tx - N.x, ty - N.y) < 3) return rdStep(N, tx, ty, spd, dt);
  const key = Math.floor(tx) + ',' + Math.floor(ty);
  if (N.pk !== key || (!N.path && Game.time - N.pt > 3)) {
    N.pk = key; N.pt = Game.time; N.pi = 0;
    N.path = findPath(Math.floor(N.x), Math.floor(N.y), Math.floor(tx), Math.floor(ty));
  }
  if (N.path && N.pi < N.path.length) {
    const [px, py] = N.path[N.pi];
    if (rdStep(N, px + 0.5, py + 0.5, spd, dt) || Math.hypot(px + 0.5 - N.x, py + 0.5 - N.y) < 0.25) N.pi++;
    return N.pi >= N.path.length && Math.hypot(tx - N.x, ty - N.y) < 0.6;
  }
  return rdStep(N, tx, ty, spd, dt);
}

// ---------- Урон и награда ----------

function foeProvoke(N, u) {
  N.prov = Game.time;
  if (u && !foeUnit(N.tg)) N.tg = u.id;
}

function foeHit(N, u, dmg) {
  if (!foeLive(N) || N.inv > 0) return;
  const S = FSPEC[N.k];
  if (u) foeProvoke(N, u);
  const px = N.x * TILE, py = N.y * TILE - 14;
  if (N.k === 'malgor' && N.shield) {
    dmg *= 0.3;
    if (Game.time - (N.shT || 0) > 1.5) { N.shT = Game.time; floater(N.x, N.y - 3, 'Щит тьмы!', '#b8ff90'); }
    fxBurst(px, py, 6, ['#9cff66', '#b07cff'], 50, 30, 0.4, 1.4, 80);
  } else if (Math.random() < (S.parry || 0)) {
    dmg *= 0.25;
    floater(N.x, N.y - 2.1, 'Отбил!', '#cfe8ff');
    fxBurst(px, py, 5, ['#ffffff', '#cfe8ff'], 40, 20, 0.3, 1.3, 120);
  } else {
    N.hurtT = Game.time;
    fxBurst(px, py, 7, ['#9cff66', '#4a3e88', '#b07cff'], 60, 40, 0.5, 1.6, 200);
    if (N.k !== 'malgor' && N.k !== 'raven' && u) {
      const d = Math.hypot(N.x - u.x, N.y - u.y) || 1, kx = N.x + (N.x - u.x) / d * 0.3, ky = N.y + (N.y - u.y) / d * 0.3;
      if (rdOk(N, kx, ky)) { N.x = kx; N.y = ky; }
      N.cdA = Math.max(N.cdA, 0.35); N.atkT = 9;
    }
  }
  N.hp -= dmg;
  floater(N.x, N.y - 1.8, '−' + Math.max(1, Math.round(dmg)), '#ffd070');
  sfxAt('thud', N.x * TILE, N.y * TILE, 0.5);
  if (N.k === 'malgor' && Game.foe) Game.foe.bossHp = Math.max(1, N.hp);
  if (N.hp <= 0) foeKill(N, u);
}

function foeKill(N, killer) {
  const S = FSPEC[N.k], F = Game.foe;
  if (!foeLive(N)) return;
  N.st = 'die'; N.dt = 0; N.hp = 0; N.tg = 0;
  fxBurst(N.x * TILE, N.y * TILE - 10, N.k === 'malgor' ? 60 : 22, ['#2a2452', '#9cff66', '#b07cff', '#e8ffc8'], 90, 70, 1.2, 2.2, 140);
  sfxAt('wail', N.x * TILE, N.y * TILE, N.k === 'malgor' ? 1.4 : 0.6);
  const tx = Math.floor(N.x), ty = Math.floor(N.y);
  if (N.loot) { dropPile(tx, ty, N.loot.g, N.loot.n); N.loot = null; }
  const who = killer ? neuName(killer) : 'Кто-то';
  if (N.k === 'raven') { F.stat.ravens++; logEvent('tree', `${who} сбил ворона-разведчика`, N.x, N.y); F.kills++; return; }
  F.kills++;
  if (!N.noDrop && S.drop) {
    let any = false;
    for (const [g, n0, p] of S.drop) {
      if (Math.random() > p) continue;
      const o = any ? randomFreeNear(tx, ty, 0, 1, (x, y) => isWalkable(x, y)) || [tx, ty] : [tx, ty];
      dropPile(o[0], o[1], g, n0 > 1 ? Math.max(1, n0 - (Math.random() < 0.5 ? 1 : 0)) : 1); any = true;
    }
  }
  if (!N.noDrop) neuGiveXp(N, killer, Math.round(S.xp * (N.lv || 1)));
  if (N.k === 'malgor') { foeBossDown(N, killer); return; }
  logEvent('tree', `${who} победил: ${S.name}`, N.x, N.y);
  const p = typeof profCur === 'function' && !isServerSim() ? profCur() : null;
  if (p) { p.st.fkill = (p.st.fkill || 0) + 1; profSave(); }
  if (typeof track === 'function') track('foe-kill-' + N.k, 'Победил: ' + S.name);
}

function foeBossDown(N, killer) {
  const F = Game.foe;
  F.defeated = true; F.bossHp = 0; F.plan = []; F.boss = null;
  for (const M of Game.raiders) if (M !== N && foeLive(M)) { M.noDrop = true; M.loot = null; M.st = 'die'; M.dt = 0; M.tg = 0; fxBurst(M.x * TILE, M.y * TILE - 10, 14, ['#2a2452', '#9cff66'], 70, 50, 1, 2, 140); }
  const tx = Math.floor(N.x), ty = Math.floor(N.y);
  dropPile(tx, ty, 'gold', 18);
  for (const [g, n] of [['magicstone', 8], ['mana', 4]]) { const o = randomFreeNear(tx, ty, 0, 2, (x, y) => isWalkable(x, y)) || [tx, ty]; dropPile(o[0], o[1], g, n); }
  for (const u of Game.units) if (u.hero && !u.dead) { u.hero.title = 'Победитель Малгора'; u.hero.cxp = (u.hero.cxp || 0) + 300; }
  const who = killer ? neuName(killer) : 'Герои';
  toast(`${who} победил тёмного мага Малгора! Чёрный шпиль погас, набеги и проклятия кончились.`);
  logEvent('night', `${who} победил: Тёмный маг Малгор — Чёрный шпиль погас, злодей повержен`, N.x, N.y);
  if (typeof track === 'function') track('foe-malgor', 'Побеждён тёмный маг Малгор');
  const p = typeof profCur === 'function' && !isServerSim() ? profCur() : null;
  if (p) { p.st.malgor = (p.st.malgor || 0) + 1; profSave(); }
}

// ---------- Удары налётчиков ----------

function foeStrike(N, tg) {
  const S = FSPEC[N.k], F = Game.foe;
  let dmg = foeR(S.dmg[0], S.dmg[1]) * (N.lv || 1) * (N.k === 'malgor' ? 1 + 0.12 * (N.fz - 1) : 1);
  if (!tg.hero && !tg.rec && Math.random() < 0.12) { floater(tg.x, tg.y - 1.8, 'Увернулся!', '#cfe8ff'); return; }
  const def = tg.hero && typeof heroDef === 'function' ? heroDef(tg) : tg.rec && tg.rec.armor ? 0.3 : 0;
  dmg *= 1 - Math.min(0.6, def);
  fxBurst(tg.x * TILE, tg.y * TILE - 12, 6, ['#9cff66', '#ffffff', '#b07cff'], 55, 40, 0.5, 1.5, 160);
  sfxAt('thud', tg.x * TILE, tg.y * TILE, 0.6);
  if (!tg.hero && !tg.rec) {
    F.stat.hurt++;
    if (Math.random() < 0.5) injure(tg, Math.random() < 0.5 ? 'arm' : 'leg');
    if (interruptible(tg)) { startBreak(tg, 'flee', null); tg.proc = fleeGen(tg); }
    floater(tg.x, tg.y - 1.8, 'Налёт!', '#b8ff90');
  } else neuHurtUnit(tg, dmg);
  tg.ouchUntil = Game.time + 0.5;
  if (tg.hero && tg.hero.hp <= 0) foeHeroDown(N, tg);
}
function foeHeroDown(N, tg) {
  if (tg._lostT > Game.time - 6) return;
  tg._lostT = Game.time;
  logEvent('night', `${tg.hero.name} проиграл бой: ${FSPEC[N.k].name}`, N.x, N.y);
  for (const M of Game.raiders) if (foeLive(M) && M.tg === tg.id) { M.tg = 0; M.prov = -99; M.st = 'idle'; }
  floater(N.x, N.y - 2.4, N.k === 'malgor' ? 'Жалкий смертный!' : 'Тьма сильнее!', '#b8ff90');
}

// ---------- Поведение ----------

function foeTargetNear(N, r) {
  let best = null, bd = r;
  for (const u of Game.units) {
    if (u.dead || u.inside || !isPerson(u) || u.type === 'carter' || neuUnitOut(u)) continue;
    if (nearBonfire(u.x, u.y, BONFIRE_SAFE)) continue;
    const d = Math.hypot(u.x - N.x, u.y - N.y) * (u.hero || u.rec ? 0.75 : 1);
    if (d < bd) { bd = d; best = u; }
  }
  return best;
}

function foeBestLoot(b) {
  let best = null, bs = 0;
  for (const g of GOOD_KEYS) {
    if (GOODS[g].noStore) continue;
    const n = b.offer(g);
    if (n < 1) continue;
    const s = (g === 'gold' ? 50 : g === 'magicstone' ? 40 : g === 'mana' ? 30 : 0) + Math.min(n, 20);
    if (s > bs) { bs = s; best = g; }
  }
  return best;
}
function foeLootTarget(N) {
  let best = null, bd = 1e9;
  for (const b of Game.buildings) {
    if (!b.isStore || !b.isStore() || !foeBestLoot(b) || nearBonfire(b.doorX + 0.5, b.doorY + 0.5, BONFIRE_SAFE)) continue;   // склад у большого костра не достать
    const d = Math.hypot(b.doorX - N.x, b.doorY - N.y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

// замах → удар → восстановление; на кадре «удар» наносится урон
function foeAttackCycle(N, tg, dt, strikeFn) {
  const S = FSPEC[N.k];
  const dist = Math.hypot(tg.x - N.x, tg.y - N.y);
  N.dist = dist;
  if (N.st === 'atk' && N.atkT < 0.56) {
    N.atkT += dt;
    N.face = tg.x >= N.x ? 1 : -1;
    if (!N.hit && N.atkT >= 0.24) { N.hit = 1; if (dist <= S.rng + 0.8) strikeFn(N, tg); }
    return true;
  }
  if (dist <= S.rng) {
    if (dist < 0.9) { const sx = Math.sign(N.x - tg.x) || (N.id % 2 ? 1 : -1); rdStep(N, N.x + sx, N.y, 1.6, dt); }   // не стоять в обнимку
    N.face = tg.x >= N.x ? 1 : -1;
    if (N.cdA <= 0) { N.st = 'atk'; N.atkT = 0; N.hit = 0; N.cdA = S.cd * foeR(0.9, 1.2) * (N.k === 'malgor' && N.fz === 3 ? 0.6 : 1); }
    else if (N.st === 'atk') { N.st = 'chase'; N.atkT = 9; }
    return true;
  }
  return false;
}

function rdMelee(N, dt) {
  const S = FSPEC[N.k], F = Game.foe;
  if (N.st === 'emerge') {                       // выходят из тумана
    N.t += dt;
    if (N.t >= 0) N.st = 'idle';
    return;
  }
  // с добычей — к своим
  if (N.loot) {
    N.st = 'chase';
    if (rdGo(N, N.hx, N.hy, S.spd * 1.15, dt) || Math.hypot(N.x - N.hx, N.y - N.hy) < 2.2) {
      F.stat.loot++;
      fxBurst(N.x * TILE, N.y * TILE - 8, 14, ['#2a2452', '#9cff66'], 60, 40, 0.8, 1.8, 100);
      logEvent('night', `${S.name} унёс со склада: ${GOODS[N.loot.g].name} ×${N.loot.n}`, N.x, N.y);
      Game.raiders.splice(Game.raiders.indexOf(N), 1);
    }
    return;
  }
  let tg = foeUnit(N.tg);
  if (tg && (neuUnitOut(tg) || tg.inside || nearBonfire(tg.x, tg.y, BONFIRE_SAFE) || Math.hypot(tg.x - N.x, tg.y - N.y) > 16 || Game.time - N.prov > 25 && !N.hunt)) { N.tg = 0; tg = null; }
  N.scan -= dt;
  if (!tg && N.scan <= 0) {
    N.scan = 0.6;
    const t = foeTargetNear(N, FOE_SEE + (F.stage >= 5 ? 2 : 0));
    if (t && (N.hunt || N.k === 'knight' || !N.goalB)) { N.tg = t.id; tg = t; N.prov = Game.time; }
  }
  if (tg) {
    if (!foeAttackCycle(N, tg, dt, foeStrike)) { N.st = 'chase'; rdGo(N, tg.x, tg.y, S.spd, dt); }
    return;
  }
  if (N.st === 'atk') { N.st = 'idle'; N.atkT = 9; }
  // призванные стражи шпиля в деревню не ходят: держатся хозяина, бой кончился — тают
  if (N.summoned) {
    const B = F.boss;
    if (!B || !B.woke) { N.st = 'vanish'; N.vt = 0; return; }
    if (Math.hypot(N.x - B.x, N.y - B.y) > 3) { N.st = 'chase'; rdGo(N, B.x, B.y + 1, S.spd, dt); } else N.st = 'idle';
    return;
  }
  // цель: склад с добром, иначе — центр деревни
  if (N.k === 'thrall') {
    if (!N.goalB || N.goalB.removed || !foeBestLoot(N.goalB)) N.goalB = foeLootTarget(N);
    if (N.goalB) {
      N.st = 'chase';
      if (rdGo(N, N.goalB.doorX + 0.5, N.goalB.doorY + 0.5, S.spd, dt) || Math.hypot(N.goalB.doorX + 0.5 - N.x, N.goalB.doorY + 0.5 - N.y) < 1.6) {
        const g = foeBestLoot(N.goalB);
        if (g) {
          const n = Math.min(3, N.goalB.offer(g));
          N.goalB.stock[g] -= n; N.loot = { g, n };
          floater(N.x, N.y - 1.8, `Тащит: ${GOODS[g].name}`, '#b8ff90');
        }
        N.goalB = null;
      }
      return;
    }
  }
  const [vx, vy] = foeVillageCenter();
  if (Math.hypot(N.x - vx, N.y - vy) > 6) { N.st = 'chase'; rdGo(N, vx, vy, S.spd, dt); }
  else { N.st = 'idle'; N.t -= dt; if (N.t <= 0) { N.t = foeR(1, 3); N.hunt = true; } }
}

function rdRaven(N, dt) {
  const F = Game.foe;
  N.ph += dt * 14;
  if (N.t < 0) { N.t += dt; N.st = 'wait'; return; }
  if (N.st === 'wait') N.st = 'fly';
  if (N.st === 'fly') {
    if (rdStep(N, N.goal[0], N.goal[1], FSPEC.raven.spd, dt)) { N.st = 'scout'; N.circ = 0; sfxAt('crow', N.x * TILE, N.y * TILE, 0.5); }
  } else if (N.st === 'scout') {
    N.circ += dt;
    const a = N.circ * 1.1;
    rdStep(N, N.goal[0] + Math.cos(a) * 3.5, N.goal[1] + Math.sin(a) * 2.4, 3.2, dt);
    if (N.circ > 12) {
      N.st = 'home';
      F.wrath = Math.min(100, F.wrath + 2); F.known = true;
      toast('Ворон Малгора облетел деревню и скрылся в сторону шпиля…');
      logEvent('night', 'Ворон-разведчик облетел деревню — Малгор знает о вас больше', N.x, N.y);
    }
  } else if (N.st === 'home') {
    if (rdStep(N, F.tx + 1.5, F.ty + 0.5, FSPEC.raven.spd * 1.2, dt)) Game.raiders.splice(Game.raiders.indexOf(N), 1);
  }
}

// ---------- Малгор: бой по фазам ----------

function foeMinions() { return Game.raiders.filter(M => foeLive(M) && M.summoned).length; }
function foeSummon(N, k, n) {
  for (let i = 0; i < n; i++) {
    const p = randomFreeNear(Math.floor(N.x), Math.floor(N.y), 2, 4, (x, y) => isWalkable(x, y)) || [Math.floor(N.x), Math.floor(N.y) + 2];
    const M = foeMake(k, p[0] + 0.5, p[1] + 0.5);
    M.summoned = true; M.hunt = true; M.st = 'emerge'; M.t = -0.4 * i; M.noSafeHold = true;
    if (k === 'knight') N.guard = M.id;
    fxBurst(M.x * TILE, M.y * TILE - 8, 16, ['#2a2452', '#9cff66', '#b07cff'], 70, 50, 0.9, 2, 100);
  }
  sfxAt('wail', N.x * TILE, N.y * TILE, 0.9);
}
function foePhase(N, ph) {
  N.inv = 1.4; N.castT = 1.2;
  fxBurst(N.x * TILE, N.y * TILE - 24, 40, ['#9cff66', '#b07cff', '#e8ffc8'], 110, 70, 1.2, 2.4, 80);
  sfxAt('wail', N.x * TILE, N.y * TILE, 1.2);
  if (ph === 2) {
    floater(N.x, N.y - 3.4, 'Довольно! Узрите зелёное пламя!', '#b8ff90');
    foeSummon(N, 'knight', 1);
    toast('Малгор призвал рыцаря-стража: пока он жив, щит тьмы гасит удары. Бейте стража!');
  } else {
    floater(N.x, N.y - 3.4, 'Ничтожества! Я развею вас!', '#b8ff90');
    toast('Малгор в ярости: он исчезает и появляется рядом, сыплет огнём!');
  }
}

function rdBoss(N, dt) {
  const S = FSPEC.malgor, F = Game.foe;
  if (N.inv > 0) N.inv -= dt;
  if (N.castT > 0) N.castT -= dt;
  N.cdA -= dt; N.cdF -= dt; N.cdS -= dt; N.cdB -= dt;
  const guard = Game.raiders.find(M => M.id === N.guard);
  N.shield = N.fz === 2 && !!guard && foeLive(guard);
  const ratio = N.hp / N.mhp, ph = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
  if (ph > N.fz) { N.fz = ph; foePhase(N, ph); }
  let tg = foeUnit(N.tg);
  if (tg && (neuUnitOut(tg) || tg.inside || Math.hypot(tg.x - N.hx, tg.y - N.hy) > 18)) { N.tg = 0; tg = null; }
  N.scan -= dt;
  if (!tg && N.scan <= 0) {
    N.scan = 0.5;
    let best = null, bd = 11;
    for (const u of Game.units) {
      if (u.dead || u.inside || !isPerson(u) || neuUnitOut(u) || !(u.hero || u.rec)) continue;
      const d = Math.hypot(u.x - N.hx, u.y - N.hy);
      if (d < bd) { bd = d; best = u; }
    }
    if (best) {
      N.tg = best.id; tg = best; N.prov = Game.time;
      if (!N.woke) { N.woke = true; floater(N.x, N.y - 3.4, 'Кто посмел войти в мой дом?!', '#b8ff90'); toast('Малгор проснулся! Бой у Чёрного шпиля!'); sfxAt('wail', N.x * TILE, N.y * TILE, 1.2); }
    }
  }
  if (!tg) {                                      // никого: возвращается и лечится
    N.st = 'idle'; N.woke = false;
    rdStep(N, N.hx, N.hy, S.spd, dt);
    if (N.hp < N.mhp) { N.hp = Math.min(N.mhp, N.hp + dt * 16); F.bossHp = N.hp; }
    return;
  }
  const dist = Math.hypot(tg.x - N.x, tg.y - N.y);
  N.dist = dist;
  const spd = S.spd * (N.fz === 3 ? 1.5 : 1);
  // призыв (фазы 1 и 3)
  if ((N.fz === 1 || N.fz === 3) && N.cdS <= 0) {
    N.cdS = N.fz === 1 ? 9 : 11;
    if (foeMinions() < (N.fz === 1 ? 4 : 3)) { N.castT = 0.8; floater(N.x, N.y - 3.2, 'Ко мне, слуги!', '#b8ff90'); foeSummon(N, 'thrall', N.fz === 1 ? 2 : 1); }
  }
  // вспышка телепорта (фаза 3)
  if (N.fz === 3 && N.cdB <= 0 && dist > 3.2) {
    N.cdB = 5.5;
    fxBurst(N.x * TILE, N.y * TILE - 20, 24, ['#9cff66', '#b07cff'], 90, 60, 0.8, 2.2, 60);
    const a = Math.random() * 6.28, nx = tg.x + Math.cos(a) * 2, ny = tg.y + Math.sin(a) * 2;
    if (isWalkable(Math.floor(nx), Math.floor(ny))) { N.x = nx; N.y = ny; fxBurst(N.x * TILE, N.y * TILE - 20, 24, ['#9cff66', '#b07cff'], 90, 60, 0.8, 2.2, 60); sfxAt('chime', N.x * TILE, N.y * TILE, 1); }
  }
  // зелёный огонь (фазы 2 и 3)
  if (N.fz >= 2 && N.cdF <= 0 && dist <= 10 && N.atkT >= 0.56) {
    N.cdF = N.fz === 2 ? 3.2 : 2.0; N.castT = 0.55;
    Game.foeShots.push({ id: Game.nextId++, x: N.x, y: N.y - 1.9, gx: tg.x, gy: tg.y, t: 0, dur: Math.max(0.5, dist / 9), tg: tg.id, ph: N.fz });
    sfxAt('chime', N.x * TILE, N.y * TILE, 0.9);
  }
  if (N.fz === 2 && dist < 4 && !(N.st === 'atk' && N.atkT < 0.56)) {   // на второй фазе держит дистанцию, но от шпиля не уходит
    N.st = 'chase'; const a = Math.atan2(N.y - tg.y, N.x - tg.x), ax = N.x + Math.cos(a) * 2, ay = N.y + Math.sin(a) * 2;
    if (Math.hypot(ax - N.hx, ay - N.hy) < 5) rdStep(N, ax, ay, spd * 0.8, dt);
    else rdStep(N, N.hx, N.hy, spd * 0.8, dt);
    if (dist > 2.6) return;
  }
  if (!foeAttackCycle(N, tg, dt, foeStrike)) {
    if (N.fz === 2 && dist < 8) { N.st = 'idle'; N.face = tg.x >= N.x ? 1 : -1; return; }
    N.st = 'chase'; rdStep(N, tg.x - (Math.sign(tg.x - N.x) || -1) * 1.4, tg.y, spd, dt);
  }
}

function foeShotsTick(dt) {
  for (let i = Game.foeShots.length - 1; i >= 0; i--) {
    const s = Game.foeShots[i], tg = foeUnit(s.tg);
    s.t += dt;
    if (tg && s.t < s.dur * 0.7) { s.gx = tg.x; s.gy = tg.y - 0.6; }
    if (s.t >= s.dur) {
      Game.foeShots.splice(i, 1);
      fxBurst(s.gx * TILE, s.gy * TILE - 8, 22, ['#9cff66', '#b07cff', '#e8ffc8'], 90, 50, 0.7, 2, 100);
      sfxAt('crackle', s.gx * TILE, s.gy * TILE, 0.8);
      for (const u of Game.units) {
        if (u.dead || u.inside || !isPerson(u) || Math.hypot(u.x - s.gx, u.y - s.gy) > 1.3) continue;
        neuHurtUnit(u, foeR(10, 16) * (1 + 0.12 * (s.ph - 2)));
        u.ouchUntil = Game.time + 0.5;
        if (u.hero && u.hero.hp <= 0 && Game.foe && Game.foe.boss) foeHeroDown(Game.foe.boss, u);
      }
    }
  }
}

// ---------- Такт ----------

function foeTick(dt) {
  const F = Game.foe;
  if (!F) return;
  foeShotsTick(dt);
  const dawn = !isNightNow() && !isEveningNow();
  for (let i = Game.raiders.length - 1; i >= 0; i--) {
    const N = Game.raiders[i];
    if (N.st === 'die') { N.dt += dt; if (N.dt > (N.k === 'malgor' ? 4 : 3.4)) Game.raiders.splice(i, 1); continue; }
    if (N.st === 'vanish') { N.vt += dt; if (N.vt > 1.5) Game.raiders.splice(i, 1); continue; }
    if (dawn && N.k !== 'malgor' && !N.summoned) {                // на рассвете расходятся; награбленное роняют
      if (N.loot) { dropPile(Math.floor(N.x), Math.floor(N.y), N.loot.g, N.loot.n); N.loot = null; }
      N.st = 'vanish'; N.vt = 0; N.tg = 0; continue;
    }
    if (N.k === 'raven') rdRaven(N, dt);
    else if (N.k === 'malgor') rdBoss(N, dt);
    else rdMelee(N, dt);
    if (N.hp < N.mhp && N.k !== 'malgor' && !N.tg && N.k !== 'raven') N.hp = Math.min(N.mhp, N.hp + dt * 1.5);
    // не толпятся в одной точке
    if (N.k !== 'raven' && N.st !== 'atk') for (const M of Game.raiders) {
      if (M === N || M.k === 'raven' || !foeLive(M)) continue;
      const dx = N.x - M.x, dy = N.y - M.y, d = Math.hypot(dx, dy);
      if (d < 0.7) { const a = d > 0.01 ? Math.atan2(dy, dx) : N.id; const nx = N.x + Math.cos(a) * dt * 0.8, ny = N.y + Math.sin(a) * dt * 0.8; if (rdOk(N, nx, ny)) { N.x = nx; N.y = ny; } }
    }
  }
  F.tk = (F.tk || 0) + dt;
  if (F.tk < 0.5) return;
  F.tk = 0;
  if (F.defeated) return;
  // вечер: подсчёт гнева и события ночи
  const ni = nightIndex();
  if (F.ni < 0 && isEveningNow()) F.ni = ni;                       // загрузились посреди вечера: не повторять
  if (isEveningNow() && !isDawnNow() && F.ni !== ni) { F.ni = ni; foeEvening(F, ni); }
  for (let i = F.plan.length - 1; i >= 0; i--) {
    const p = F.plan[i];
    if (Game.time < p.at || (p.night && !isNightNow())) continue;
    F.plan.splice(i, 1);
    if (dawn) continue;
    if (p.k === 'ravens') foeRavens(F, p.n);
    else if (p.k === 'curse') foeCurse(F);
    else if (p.k === 'raid') foeRaid(F, p);
  }
  // герой подошёл к шпилю — теперь он отмечен на миникарте
  if (!F.known) for (const u of Game.units) if (u.hero && !u.dead && Math.hypot(u.x - F.tx - 1.5, u.y - F.ty - 1) < 28) { F.known = true; toast('Вдали виден Чёрный шпиль — там живёт тот, кто насылает нечисть.'); logEvent('night', 'Найден Чёрный шпиль тёмного мага', F.tx + 1.5, F.ty + 1); break; }
}

// ---------- Подключение: враги гильдий, приказы героя ----------

{
  const FF = f => f && f.kind === 'foe';
  const _alive = foeAlive;
  foeAlive = function (f) { return FF(f) ? foeLive(f.o) && Game.raiders.includes(f.o) : _alive(f); };
  const _near = foesNear;
  foesNear = function (x, y, r) {
    const out = _near(x, y, r);
    for (const N of Game.raiders) {
      if (!foeLive(N) || N.k === 'raven' && N.st !== 'scout' && r > 1.45) continue;
      if (N.k === 'malgor' && !N.tg && r > 1.45) continue;
      if (Math.hypot(N.x - x, N.y - y) < r + (r <= 1.45 ? 0.6 : 0)) out.push({ kind: 'foe', o: N });
    }
    out.sort((p, q) => Math.hypot(p.o.x - x, p.o.y - y) - Math.hypot(q.o.x - x, q.o.y - y));
    return out;
  };
  const _kill = killFoe;
  killFoe = function (f, u) {
    if (!FF(f)) return _kill(f, u);
    const N = f.o;
    foeHit(N, u, N.k === 'malgor' ? N.mhp * 0.12 : N.hp + 1);        // способности героя босса не убивают, лишь ранят
  };
  const _strike = strike;
  strike = function (u, f) {
    if (!FF(f)) return _strike(u, f);
    const N = f.o;
    if (!foeLive(N)) return;
    if (Math.random() > Math.min(0.97, 0.5 + 0.5 * unitAtk(u)) * (N.k === 'malgor' ? 0.88 : 1) * (N.k === 'raven' ? 0.85 : 1)) {
      floater(N.x, N.y - 2, 'Мимо!', '#e8e0c0');
      foeProvoke(N, u);
      return;
    }
    let dmg = neuDamageOf(u) * foeR(0.8, 1.25);
    if (unitCls(u) === 'rogue' && Math.random() < 0.25) { dmg *= 2; floater(N.x, N.y - 2.4, 'Крит!', '#e0b0ff'); }
    foeHit(N, u, dmg);
  };
  // бой с Малгором — серия обычных раундов (общий цикл подходит любому врагу из списка)
  const _fight = fightGen;
  fightGen = function* (u, f) {
    if (!FF(f)) { yield* _fight(u, f); return; }
    foeProvoke(f.o, u);
    for (let k = 0; k < 40 && foeAlive(f) && !neuUnitOut(u); k++) yield* _fight(u, f);
  };
  const _rc = resolveCmd;
  resolveCmd = function (t) {
    if (inb(t[0], t[1])) {
      const f = foesNear(t[0] + 0.5, t[1] + 0.5, 1.4).find(x => x.kind === 'foe');
      if (f) return { kind: 'attack', f, tx: Math.floor(f.o.x), ty: Math.floor(f.o.y), label: 'Напасть на: ' + FSPEC[f.o.k].name };
    }
    return _rc(t);
  };
  const _reset = resetGameState;
  resetGameState = function () { _reset(); Game.raiders = []; Game.foeShots = []; Game.foe = null; };
  const _setup = setupStart;
  setupStart = function (seed) { _setup(seed); foeInit(seed); };
  const _ser = serializeGame;
  serializeGame = function () {
    const s = _ser(), F = Game.foe;
    if (F) s.fo = { tx: F.tx, ty: F.ty, w: +F.wrath.toFixed(1), s: F.stage, n: F.nights, k: F.kills, kn: F.known ? 1 : 0, d: F.defeated ? 1 : 0, ni: F.ni, bh: Math.round(F.bossHp), f: F.fires, st: F.stat };
    return s;
  };
  const _apply = applySave;
  applySave = function (s) {
    _apply(s);
    Game.raiders = []; Game.foeShots = []; Game.foe = null;
    if (!FOE_ON || Game.stress) return;
    if (!s.fo) { if (!isMirror()) foeInit(s.seed); return; }
    const o = s.fo;
    Game.foe = { tx: o.tx, ty: o.ty, wrath: o.w || 0, stage: o.s || 0, nights: o.n || 0, kills: o.k || 0, known: !!o.kn, defeated: !!o.d, ni: o.ni ?? -1, plan: [], fires: o.f || [], bossHp: o.bh || FSPEC.malgor.mhp, stat: Object.assign({ ravens: 0, raids: 0, loot: 0, hurt: 0, curses: 0 }, o.st) };
    foeMarkTower(Game.foe);
    if (!isMirror()) foeSpawnBoss(Game.foe);
  };
  const _step = step;
  step = function (dt) { _step(dt); if (foeOnSim()) foeTick(dt); };
}

// ---------- Зеркало для кооператива ----------

function foeMirror() {
  const F = Game.foe;
  if (!F) return null;
  return { tx: F.tx, ty: F.ty, wrath: Math.round(F.wrath), stage: F.stage, known: F.known, defeated: F.defeated, fires: F.fires, bossHp: Math.round(F.bossHp) };
}
function foeMirrorRaiders() {
  const r = v => Math.round(v * 100) / 100;
  return Game.raiders.map(N => ({ __id: N.id, id: N.id, k: N.k, x: r(N.x), y: r(N.y), face: N.face, st: N.st, hp: Math.round(N.hp), mhp: N.mhp, dt: r(N.dt), vt: r(N.vt), atkT: r(N.atkT), ph: r(N.ph), castT: r(N.castT || 0), shield: !!N.shield, inv: N.inv > 0, phase: N.fz, woke: !!N.woke, t: r(N.t), loot: N.loot ? { g: N.loot.g, n: N.loot.n } : null, dist: r(N.dist || 9), hurtT: r(N.hurtT) }));
}
function foeMirrorShots() { return Game.foeShots.map(s => ({ __id: s.id, id: s.id, x: +s.x.toFixed(2), y: +s.y.toFixed(2), gx: +s.gx.toFixed(2), gy: +s.gy.toFixed(2), t: +s.t.toFixed(2), dur: s.dur })); }

// ---------- Рисование ----------

const fp = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
const FOE_SPR = {};

// Шпиль: в стиле башни заставки — индиго-камень, балкон с зубцами, кривая крыша, зелёные окна
function foeTowerSprite(ruin) {
  const key = ruin ? 'tr' : 't';
  if (FOE_SPR[key]) return FOE_SPR[key];
  const W = 128, H = 292, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d'), cx = W / 2, base = H - 3;
  const poly = (pts, col) => { c.fillStyle = col; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill(); };
  const hash = (a, b) => ((a * 73856093) ^ (b * 19349663)) >>> 0;
  // скала-основание: зубцы
  poly([[4, base + 2], [18, base - 18], [30, base - 34], [40, base - 22], [86, base - 36], [104, base - 16], [124, base + 2]], ruin ? '#1a1830' : '#15112c');
  poly([[86, base - 36], [104, base - 16], [124, base + 2], [70, base + 2]], '#0e0c20');
  // ярусы с кладкой (правая грань светлее: луна справа)
  const tier = (y0, y1, w0, w1, col, rim) => {
    poly([[cx - w0, y0], [cx + w0, y0], [cx + w1, y1], [cx - w1, y1]], col);
    poly([[cx + w0 * 0.55, y0], [cx + w0, y0], [cx + w1, y1], [cx + w1 * 0.55, y1]], rim);
    for (let y = y0 + 5; y < y1; y += 7) {
      c.fillStyle = 'rgba(10,8,30,0.55)'; c.fillRect(cx - w1, y, w1 * 2, 1);
      const off = ((y / 7) | 0) % 2 ? 6 : 0;
      for (let x = -w1 + off; x < w1; x += 12) c.fillRect(cx + x, y - 6, 1, 6);
    }
    for (let k = 0; k < 14; k++) { const h = hash(k, y0); c.fillStyle = h % 2 ? 'rgba(120,110,200,0.12)' : 'rgba(0,0,0,0.14)'; c.fillRect(cx - w1 + h % (w1 * 2 - 6), y0 + (h >> 4) % (y1 - y0 - 4), 5, 3); }
  };
  const yA = base - 18, yB = base - 138, yC = base - 214, yD = base - 250;
  tier(yB, yA, 30, 38, '#2a2452', '#4a3e88');
  // балкон с зубцами
  c.fillStyle = '#26204a'; c.fillRect(cx - 46, yB - 6, 92, 8);
  c.fillStyle = '#4a3e88'; c.fillRect(cx - 46, yB - 6, 92, 2);
  for (let k = -3; k <= 3; k++) { c.fillStyle = '#26204a'; c.fillRect(cx + k * 13 - 3, yB - 14, 6, 8); }
  tier(yC, yB - 6, 22, 28, '#262050', '#463a82');
  // верхняя камера — шире
  poly([[cx - 22, yC], [cx - 32, yC - (yC - yD) * 0.45], [cx - 30, yD], [cx + 30, yD], [cx + 32, yC - (yC - yD) * 0.45], [cx + 22, yC]], '#1c1838');
  poly([[cx + 18, yC], [cx + 32, yC - (yC - yD) * 0.45], [cx + 30, yD], [cx + 18, yD]], '#2e2858');
  // дверь-арка внизу
  poly([[cx - 11, base - 2], [cx - 11, base - 20], [cx - 5, base - 28], [cx + 5, base - 28], [cx + 11, base - 20], [cx + 11, base - 2]], '#07050f');
  c.fillStyle = '#4a3e88'; c.fillRect(cx - 12, base - 2, 24, 2);
  // крыша: кривая, островерхая
  const tip = base - 282;
  if (!ruin) {
    poly([[cx - 38, yD], [cx - 18, yD - (yD - tip) * 0.5], [cx - 6, tip + 14], [cx + 8, tip], [cx + 10, tip + 22], [cx + 24, yD - (yD - tip) * 0.45], [cx + 38, yD]], '#241c46');
    poly([[cx + 10, tip + 22], [cx + 24, yD - (yD - tip) * 0.45], [cx + 38, yD], [cx + 12, yD]], '#3a3066');
  } else {
    poly([[cx - 38, yD], [cx - 26, yD - 14], [cx - 14, yD - 4], [cx - 4, yD - 20], [cx + 10, yD - 6], [cx + 22, yD - 16], [cx + 38, yD]], '#1c1838');
    c.strokeStyle = '#0a0818'; c.lineWidth = 2;
    for (const [x0, y0, x1, y1] of [[-6, yB - 30, 4, yB + 20], [10, yC, 2, yC + 40], [-14, yA - 30, -6, yA - 4]]) { c.beginPath(); c.moveTo(cx + x0, y0); c.lineTo(cx + x1, y1); c.stroke(); }
  }
  FOE_SPR[key] = { cv, W, H, cx, base, tip, wins: [[cx, (yC + yD) / 2 + 1, 9, 18], [cx - 18, (yC + yD) / 2 + 6, 6, 12], [cx + 19, (yC + yD) / 2 + 6, 6, 12], [cx - 4, (yA + yB) / 2 - 20, 5, 16], [cx + 10, (yA + yB) / 2 + 24, 5, 12], [cx - 8, yB - 52, 4, 12]], yD };
  return FOE_SPR[key];
}

function foeMarkIfNeeded() {
  const F = Game.foe;
  if (F && !F.marked) foeMarkTower(F);
}

function foeLit() { const F = Game.foe; return !!F && !F.defeated && F.stage >= 1; }

function foeDrawTower(c, F) {
  const spr = foeTowerSprite(F.defeated), t = Game.time;
  const ox = Math.round((F.tx + 1.5) * TILE - spr.cx), oy = Math.round((F.ty + 2) * TILE - spr.base - 3);
  c.drawImage(spr.cv, ox, oy);
  const lit = foeLit(), night = nightAmt(), pulse = 0.75 + 0.25 * Math.sin(t * 1.7), flick = 0.85 + 0.15 * Math.sin(t * 9.1) * Math.sin(t * 5.3);
  c.save();
  // окна: ядовито-зелёные, ярче вечером и ночью
  const k = lit ? 0.45 + 0.55 * Math.min(1, night * 2 + 0.2) : 0;
  spr.wins.forEach(([wx, wy, w, h], i) => {
    const a = (i % 2 ? pulse : flick) * k;
    if (!F.defeated && a > 0) {
      c.fillStyle = `rgba(150,255,100,${0.45 + 0.5 * a})`; c.fillRect(ox + wx - w / 2, oy + wy - h / 2, w, h);
      c.fillStyle = '#e8ffc8'; c.fillRect(ox + wx - w / 4, oy + wy - h / 2, w / 2, h * 0.35);
    } else { c.fillStyle = '#07050f'; c.fillRect(ox + wx - w / 2, oy + wy - h / 2, w, h); }
  });
  if (!F.defeated) {
    // парящий кристалл у острия и три осколка
    const oyc = oy + spr.tip - 12 + Math.sin(t * 2.2) * 2, ocx = ox + spr.cx + 6;
    if (lit || F.stage === 0) {
      c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(ocx, oyc, 0, ocx, oyc, 34);
      g.addColorStop(0, `rgba(170,90,255,${0.55 * pulse})`); g.addColorStop(1, 'rgba(170,90,255,0)');
      c.fillStyle = g; c.fillRect(ocx - 34, oyc - 34, 68, 68);
      c.globalCompositeOperation = 'source-over';
    }
    c.fillStyle = '#c08cff'; c.beginPath(); c.moveTo(ocx, oyc - 9); c.lineTo(ocx + 6, oyc); c.lineTo(ocx, oyc + 9); c.lineTo(ocx - 6, oyc); c.fill();
    c.fillStyle = '#f0d8ff'; c.beginPath(); c.moveTo(ocx, oyc - 9); c.lineTo(ocx + 6, oyc); c.lineTo(ocx, oyc); c.fill();
    for (let i = 0; i < 3; i++) { const a = t * 1.3 + i * 2.09; c.fillStyle = i % 2 ? '#9cff66' : '#b07cff'; c.fillRect(Math.round(ocx + Math.cos(a) * 20), Math.round(oyc + Math.sin(a) * 6), 3, 3); }
    // зелёный луч в небо — только по вечерам, когда шпиль «проснулся»
    if (lit && night > 0.1) {
      c.globalCompositeOperation = 'lighter';
      const bg = c.createLinearGradient(0, oyc, 0, oyc - 320);
      bg.addColorStop(0, `rgba(120,255,80,${0.28 * pulse * Math.min(1, night * 2)})`); bg.addColorStop(1, 'rgba(120,255,80,0)');
      c.fillStyle = bg; c.fillRect(ocx - 2, oyc - 320, 4, 320);
    }
  }
  c.restore();
}

function foeDrawFire(c, f, i) {
  const F = Game.foe, px = f[0] * TILE + 16, py = f[1] * TILE + 26, on = !F.defeated && i < F.stage + 1 && F.stage >= 1, t = Game.time;
  fp(c, px - 4, py - 8, 8, 8, '#15112c'); fp(c, px - 5, py - 9, 10, 2, '#4a3e88'); fp(c, px - 2, py - 2, 4, 2, '#0e0c20');
  fp(c, px - 1, py - 14, 2, 6, '#0e0c20');
  if (!on) return;
  c.save();
  const fl = Math.sin(t * 9 + i * 2) * 1.2;
  fp(c, px - 3, py - 14, 6, 5, '#2f8a2a'); fp(c, px - 2, py - 18 + fl, 4, 6, '#6ae04a'); fp(c, px - 1, py - 21 + fl, 2, 5, '#c8ff90');
  c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(px, py - 12, 0, px, py - 12, 26);
  g.addColorStop(0, 'rgba(120,255,80,0.35)'); g.addColorStop(1, 'rgba(120,255,80,0)');
  c.fillStyle = g; c.fillRect(px - 26, py - 38, 52, 52);
  c.restore();
}

function foeEyes(c, x, y, col) {
  fp(c, x, y, 2, 1, col); fp(c, x + 3, y, 2, 1, col);
}

function foeDrawThrall(c, N, big) {
  const walking = N.st === 'chase', w = walking ? Math.floor(N.ph) % 2 : 0, pose = N.st === 'atk' ? (N.atkT < 0.24 ? 'w' : N.atkT < 0.36 ? 's' : 'r') : 'i';
  const bob = walking ? (w ? -1 : 0) : 0;
  c.save(); if (big) c.scale(1.35, 1.35);
  fp(c, -4, -5 - (w ? 1 : 0), 3, 5, '#161230'); fp(c, 1, -5 - (w ? 0 : 1), 3, 5, '#161230');                        // ноги
  fp(c, -5, -13 + bob, 10, 9, '#2a2452'); fp(c, 2, -13 + bob, 3, 9, '#4a3e88'); fp(c, -5, -13 + bob, 10, 2, '#4a3e88');  // торс
  fp(c, -5, -6 + bob, 10, 1, '#3a8a30');                                                                          // пояс
  fp(c, -6, -14 + bob, 3, 3, '#463a82'); fp(c, 3, -14 + bob, 3, 3, '#463a82');                                    // наплечники
  fp(c, -3, -20 + bob, 7, 7, '#1c1838'); fp(c, -3, -20 + bob, 7, 1, '#3a3066');                                   // шлем
  fp(c, -4, -23 + bob, 1, 4, '#8a82a8'); fp(c, 4, -23 + bob, 1, 4, '#8a82a8');                                    // рожки
  foeEyes(c, 0, -17 + bob, '#9cff66');
  // клинок
  c.save(); c.translate(4, -9 + bob);
  c.rotate(pose === 'w' ? -2.1 : pose === 's' ? 1.0 : pose === 'r' ? 0.6 : -0.5);
  fp(c, -1, -1, 2, 3, '#4a3e88'); fp(c, 0, -10, 2, 10, '#b8b4d0'); fp(c, 1, -10, 1, 10, '#9cff66');
  c.restore();
  c.restore();
}

function foeDrawKnight(c, N) {
  const walking = N.st === 'chase', w = walking ? Math.floor(N.ph) % 2 : 0, pose = N.st === 'atk' ? (N.atkT < 0.24 ? 'w' : N.atkT < 0.36 ? 's' : 'r') : 'i';
  c.save(); c.scale(1.4, 1.4);
  // плащ
  fp(c, -6, -14, 3, 11, '#15112c'); fp(c, -7, -6, 3, 5, '#15112c');
  fp(c, -4, -5 - (w ? 1 : 0), 3, 5, '#161230'); fp(c, 1, -5 - (w ? 0 : 1), 3, 5, '#161230');
  fp(c, -5, -14, 10, 10, '#34296a'); fp(c, 1, -14, 4, 10, '#4a3e88'); fp(c, -5, -14, 10, 2, '#6a5ab8');
  fp(c, -5, -6, 10, 1, '#3a8a30'); fp(c, -1, -10, 2, 2, '#9cff66');
  fp(c, -7, -16, 4, 4, '#4a3e88'); fp(c, 3, -16, 4, 4, '#4a3e88');
  fp(c, -3, -22, 7, 8, '#1c1838'); fp(c, -3, -22, 7, 1, '#6a5ab8'); fp(c, -1, -26, 3, 4, '#9cff66');                // шлем с гребнем
  fp(c, 0, -18, 4, 1, '#9cff66');                                                                                  // прорезь-глаза
  c.save(); c.translate(5, -10);
  c.rotate(pose === 'w' ? -2.2 : pose === 's' ? 1.1 : pose === 'r' ? 0.7 : -0.4);
  fp(c, -1, -1, 3, 3, '#6a5ab8'); fp(c, 0, -14, 3, 14, '#c8c4e0'); fp(c, 1, -14, 1, 14, '#9cff66');
  c.restore();
  c.restore();
}

function foeDrawRaven(c, N) {
  const f = Math.floor(N.ph) % 2, y = -18 + Math.sin(N.ph * 0.5) * 1.5;
  c.save(); c.translate(0, y);
  fp(c, -3, -2, 7, 4, '#14102c'); fp(c, 3, -3, 3, 3, '#14102c'); fp(c, 6, -2, 2, 1, '#8a82a8'); fp(c, 4, -3, 1, 1, '#9cff66');
  fp(c, -6, -1, 3, 2, '#14102c');
  if (f) { fp(c, -3, -7, 5, 4, '#241c46'); fp(c, -2, -8, 3, 1, '#241c46'); } else { fp(c, -3, 2, 5, 4, '#241c46'); fp(c, -2, 5, 3, 1, '#241c46'); }
  c.restore();
}

function foeDrawMalgor(c, N) {
  const t = Game.time, hov = Math.sin(t * 2.2) * 1.6, cast = N.castT > 0, ph = N.phase || N.fz || 1;
  c.save(); c.translate(0, -6 + hov);
  // мантия: высокая и узкая, индиго, подол рваными лоскутами
  fp(c, -5, -30, 10, 28, '#2a2452'); fp(c, -6, -22, 12, 22, '#2a2452'); fp(c, 2, -30, 4, 30, '#4a3e88');
  for (let i = -3; i <= 3; i++) fp(c, i * 2 - 1, -2 + (i % 2 ? 2 : 0) + Math.round(Math.sin(t * 3 + i) * 1), 2, 4, '#15112c');
  fp(c, -6, -30, 12, 2, '#6a5ab8'); fp(c, -1, -26, 2, 20, '#3a8a30');
  // капюшон и лицо во тьме, зелёные глаза
  fp(c, -4, -39, 9, 10, '#1c1838'); fp(c, -5, -37, 11, 6, '#1c1838'); fp(c, -3, -41, 6, 3, '#241c46'); fp(c, 0, -45, 3, 5, '#241c46');
  fp(c, -2, -36, 7, 4, '#07050f');
  const eye = ph === 3 ? '#e8ffc8' : '#9cff66';
  fp(c, -1, -35, 2, 1, eye); fp(c, 3, -35, 2, 1, eye);
  // длинная борода-тень
  fp(c, -2, -32, 5, 5, '#3a3066');
  // посох с кристаллом
  const sx = 9, up = cast ? -4 : 0;
  fp(c, sx, -40 + up, 2, 42, '#3a2a52'); fp(c, sx - 1, -34 + up, 4, 2, '#6a5ab8');
  c.fillStyle = cast || ph === 3 ? '#e8ffc8' : '#c08cff';
  c.beginPath(); c.moveTo(sx + 1, -50 + up); c.lineTo(sx + 5, -44 + up); c.lineTo(sx + 1, -38 + up); c.lineTo(sx - 3, -44 + up); c.fill();
  fp(c, -8, -24 + (cast ? -6 : 0), 3, 8, '#2a2452'); fp(c, 5, -24 + up / 2, 4, 3, '#2a2452');                      // руки
  c.restore();
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(sx + 1, -50 + hov - 6, 0, sx + 1, -50 + hov - 6, cast ? 30 : 18);
  g.addColorStop(0, `rgba(${ph === 3 ? '150,255,100' : '170,90,255'},${cast ? 0.7 : 0.4})`); g.addColorStop(1, 'rgba(170,90,255,0)');
  c.fillStyle = g; c.fillRect(sx - 30, -90 + hov, 62, 62);
  c.restore();
}

function foeDrawBar(c, N, px, top, wide) {
  const w = wide ? 56 : 18, r = Math.max(0, N.hp / N.mhp);
  c.fillStyle = 'rgba(10,6,24,0.85)'; c.fillRect(px - w / 2 - 1, top - 1, w + 2, wide ? 6 : 4);
  c.fillStyle = r > 0.5 ? '#7ad84a' : r > 0.25 ? '#e0b040' : '#d84a3a';
  c.fillRect(px - w / 2, top, Math.round(w * r), wide ? 4 : 2);
  if (wide) { c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillRect(px - w / 2 + Math.round(w * 0.66), top - 1, 1, 6); c.fillRect(px - w / 2 + Math.round(w * 0.33), top - 1, 1, 6); }
}

function foeBossBar(c, N) {
  if (!N.woke) return;
  const px = Math.round(N.x * TILE), py = Math.round(N.y * TILE + 6);
  c.save(); foeDrawBar(c, N, px, py - 72, true);
  c.font = '9px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#d8ffb8'; c.fillText(`Малгор · фаза ${N.phase || N.fz}: ${FOE_PHASE_NAME[N.phase || N.fz]}`, px, py - 78);
  c.restore();
}

function foeDrawRaider(c, N) {
  const S = FSPEC[N.k], t = Game.time;
  const dead = N.st === 'die', van = N.st === 'vanish';
  let al = 1;
  if (dead) al = Math.max(0, 1 - (N.dt - 0.8) / 2.3);
  else if (van) al = Math.max(0, 1 - N.vt / 1.4);
  else if (N.st === 'emerge') al = Math.max(0.15, Math.min(1, 1 + N.t));
  if (N.k === 'raven' && N.st === 'wait') return;
  if (al <= 0) return;
  const px = Math.round(N.x * TILE), py = Math.round(N.y * TILE + 6), fly = N.k === 'raven';
  c.save();
  c.globalAlpha = al;
  c.fillStyle = 'rgba(10,8,30,0.3)';
  c.beginPath(); c.ellipse(px, py + 1, S.sz * (dead ? 1.1 : 0.8), S.sz * 0.28, 0, 0, 7); c.fill();
  c.translate(px, py - (dead ? 0 : 0));
  if (N.face < 0) c.scale(-1, 1);
  if (dead) { c.translate(0, 0); c.rotate(Math.min(1.45, N.dt * 4)); c.translate(0, Math.min(6, N.dt * 12)); }
  if (N.k === 'raven') foeDrawRaven(c, N);
  else if (N.k === 'thrall') foeDrawThrall(c, N, false);
  else if (N.k === 'knight') foeDrawKnight(c, N);
  else foeDrawMalgor(c, N);
  c.restore();
  if (dead || van) return;
  if (N.k === 'malgor') {
    if (nightAmt() < 0.05) foeBossBar(c, N);
    if (N.shield) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(156,255,102,0.55)'; c.lineWidth = 2; c.beginPath(); c.ellipse(px, py - 26, 17, 28, 0, 0, 7); c.stroke(); c.fillStyle = 'rgba(156,255,102,0.1)'; c.fill(); c.restore(); }
  } else if (N.hp < N.mhp - 0.5) foeDrawBar(c, N, px, py - (fly ? 34 : N.k === 'knight' ? 44 : 32), false);
  if (N.loot) { c.fillStyle = GOODS[N.loot.g].color; c.fillRect(px + (N.face < 0 ? -9 : 5), py - 12, 5, 5); c.fillStyle = '#000'; c.fillRect(px + (N.face < 0 ? -9 : 5), py - 12, 5, 1); }
}

function foeDrawShot(c, s) {
  const k = Math.min(1, s.t / s.dur), x = (s.x + (s.gx - s.x) * k) * TILE, y = (s.y + (s.gy - s.y) * k - Math.sin(k * 3.14) * 0.6) * TILE;
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(x, y, 0, x, y, 14);
  g.addColorStop(0, 'rgba(232,255,200,0.95)'); g.addColorStop(0.35, 'rgba(120,255,80,0.6)'); g.addColorStop(1, 'rgba(120,255,80,0)');
  c.fillStyle = g; c.fillRect(x - 14, y - 14, 28, 28);
  for (let i = 1; i <= 3; i++) { const kk = Math.max(0, k - i * 0.04); c.fillStyle = `rgba(150,255,100,${0.4 - i * 0.1})`; c.fillRect(Math.round((s.x + (s.gx - s.x) * kk) * TILE) - 1, Math.round((s.y + (s.gy - s.y) * kk) * TILE) - 1, 3, 3); }
  c.restore();
}

function foeDrawList(list, c, x0, y0, x1, y1) {
  const F = Game.foe;
  if (!F) return;
  foeMarkIfNeeded();
  if (F.tx > x0 - 6 && F.tx < x1 + 6 && F.ty > y0 - 12 && F.ty < y1 + 6) list.push([F.ty + 2.02, () => foeDrawTower(c, F)]);
  F.fires.forEach((f, i) => { if (f[0] >= x0 - 2 && f[0] <= x1 + 2 && f[1] >= y0 - 2 && f[1] <= y1 + 2) list.push([f[1] + 0.9, () => foeDrawFire(c, f, i)]); });
  for (const N of Game.raiders) {
    if (N.x < x0 - 3 || N.x > x1 + 3 || N.y < y0 - 4 || N.y > y1 + 4) continue;
    list.push([N.y + (N.k === 'raven' ? 3 : 0.2), () => foeDrawRaider(c, N)]);
  }
  for (const s of Game.foeShots) list.push([s.y + 2, () => foeDrawShot(c, s)]);
}

{
  const _ds = drawSkeletons;
  drawSkeletons = function (list, c, x0, y0, x1, y1) { _ds(list, c, x0, y0, x1, y1); foeDrawList(list, c, x0, y0, x1, y1); };
  // ночью светятся окна шпиля, дозорные огни и колдун
  const _nl = nightLights;
  nightLights = function (x0, y0, x1, y1) {
    const L = _nl(x0, y0, x1, y1), F = Game.foe;
    if (!F || F.defeated || F.stage < 1) return L;
    if (F.tx > x0 - 8 && F.tx < x1 + 8 && F.ty > y0 - 14 && F.ty < y1 + 8) {
      L.push([(F.tx + 1.5) * TILE, (F.ty - 3) * TILE, 150, 0.7], [(F.tx + 1.5) * TILE, (F.ty + 2) * TILE, 90, 0.5]);
    }
    F.fires.forEach((f, i) => { if (i < F.stage + 1 && f[0] >= x0 - 4 && f[0] <= x1 + 4 && f[1] >= y0 - 4 && f[1] <= y1 + 4) L.push([f[0] * TILE + 16, f[1] * TILE + 14, 70, 0.55, 'ent']); });
    for (const N of Game.raiders) if (foeLive(N) && N.k !== 'raven' && N.x > x0 - 4 && N.x < x1 + 4 && N.y > y0 - 4 && N.y < y1 + 4) L.push([N.x * TILE, N.y * TILE - 14, N.k === 'malgor' ? 80 : 26, 0.5, 'ent']);
    return L;
  };
  // поверх ночной тьмы и тумана: светящиеся окна, кристалл, зелёный огонь, глаза слуг — их видно издалека
  const _dn = drawNight;
  drawNight = function (c, x0, y0, x1, y1) {
    _dn(c, x0, y0, x1, y1);
    const F = Game.foe, n = nightAmt();
    if (!F || n < 0.05) return;
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, n * 1.2);
    if (foeLit() && F.tx > x0 - 8 && F.tx < x1 + 8 && F.ty > y0 - 14 && F.ty < y1 + 8) {
      const spr = foeTowerSprite(false), ox = Math.round((F.tx + 1.5) * TILE - spr.cx), oy = Math.round((F.ty + 2) * TILE - spr.base - 3), t = Game.time;
      spr.wins.forEach(([wx, wy, w, h], i) => {
        const a = 0.55 + 0.35 * Math.sin(t * (i % 2 ? 1.7 : 6.3) + i);
        c.fillStyle = `rgba(150,255,100,${a})`; c.fillRect(ox + wx - w / 2, oy + wy - h / 2, w, h);
        const g = c.createRadialGradient(ox + wx, oy + wy, 0, ox + wx, oy + wy, 18);
        g.addColorStop(0, `rgba(110,255,70,${0.35 * a})`); g.addColorStop(1, 'rgba(110,255,70,0)');
        c.fillStyle = g; c.fillRect(ox + wx - 18, oy + wy - 18, 36, 36);
      });
      const oyc = oy + spr.tip - 12 + Math.sin(t * 2.2) * 2, ocx = ox + spr.cx + 6;
      const g = c.createRadialGradient(ocx, oyc, 0, ocx, oyc, 40);
      g.addColorStop(0, 'rgba(190,120,255,0.75)'); g.addColorStop(1, 'rgba(170,90,255,0)');
      c.fillStyle = g; c.fillRect(ocx - 40, oyc - 40, 80, 80);
      const bg = c.createLinearGradient(0, oyc, 0, oyc - 360);
      bg.addColorStop(0, 'rgba(120,255,80,0.35)'); bg.addColorStop(1, 'rgba(120,255,80,0)');
      c.fillStyle = bg; c.fillRect(ocx - 2, oyc - 360, 4, 360);
    }
    F.fires.forEach((f, i) => {
      if (F.defeated || F.stage < 1 || i >= F.stage + 1 || f[0] < x0 - 2 || f[0] > x1 + 2 || f[1] < y0 - 2 || f[1] > y1 + 2) return;
      const px = f[0] * TILE + 16, py = f[1] * TILE + 26 - 16 + Math.sin(Game.time * 9 + i * 2);
      c.fillStyle = 'rgba(150,255,100,0.8)'; c.fillRect(px - 2, py - 3, 4, 6);
    });
    for (const N of Game.raiders) {
      if (!foeLive(N) || N.k === 'raven' || N.x < x0 - 2 || N.x > x1 + 2 || N.y < y0 - 3 || N.y > y1 + 3) continue;
      const px = Math.round(N.x * TILE), py = Math.round(N.y * TILE + 6);
      if (N.k === 'malgor') {
        const g = c.createRadialGradient(px + N.face * 10, py - 56, 0, px + N.face * 10, py - 56, 22);
        g.addColorStop(0, 'rgba(190,120,255,0.8)'); g.addColorStop(1, 'rgba(170,90,255,0)');
        c.fillStyle = g; c.fillRect(px + N.face * 10 - 22, py - 78, 44, 44);
        c.fillStyle = '#9cff66'; c.fillRect(px + (N.face > 0 ? -1 : -4), py - 41, 2, 1); c.fillRect(px + (N.face > 0 ? 3 : 0), py - 41, 2, 1);
      } else {
        const s = N.k === 'knight' ? 1.4 : 1, ey = py + Math.round((N.k === 'knight' ? -18 : -17) * s);
        c.fillStyle = '#9cff66'; c.fillRect(px - 1, ey, Math.round(5 * s), 1);
      }
    }
    for (const s of Game.foeShots) foeDrawShot(c, s);
    c.restore();
    for (const N of Game.raiders) if (N.k === 'malgor' && foeLive(N)) foeBossBar(c, N);
  };
  // миникарта: шпиль (после того как о нём узнали) и налётчики
  const _dm = drawMinimapUnits;
  drawMinimapUnits = function () {
    _dm();
    const F = Game.foe;
    if (!F) return;
    const c = MINI.ctx, cv = MINI.canvas, kx = cv.width / MAP_W, ky = cv.height / MAP_H, fac = cv.width / Math.max(60, cv.clientWidth), s = Math.max(2.6, 3.2 * fac);
    if (F.known) {
      const px = (F.tx + 1.5) * kx - s / 2, py = (F.ty + 1) * ky - s / 2;
      c.fillStyle = 'rgba(8,6,20,0.9)'; c.fillRect(px - 1, py - 1, s + 2, s + 2);
      c.fillStyle = F.defeated ? '#6a6488' : '#b07cff'; c.fillRect(px, py, s, s);
      if (!F.defeated) { c.fillStyle = '#9cff66'; c.fillRect(px + s * 0.3, py + s * 0.3, s * 0.4, s * 0.4); }
    }
    for (const N of Game.raiders) if (foeLive(N) && N.k !== 'malgor') { c.fillStyle = '#9cff66'; c.fillRect(N.x * kx - 1, N.y * ky - 1, 2.4, 2.4); }
  };
}

// Строка в карточке героя
{
  const _pr = typeof neuPanelRow === 'function' ? neuPanelRow : () => '';
  neuPanelRow = function () {
    const F = Game.foe;
    let x = _pr();
    if (F && (F.stage >= 1 || F.defeated)) {
      const names = ['Спит', 'Заметил', 'Разведка', 'Проклятия', 'Набеги', 'Осада'];
      x += `<div class="irow small muted" title="Гнев тёмного мага растёт с ночами и размером деревни. Победить его можно только походом героя к Чёрному шпилю.">${F.defeated ? 'Тёмный маг Малгор повержен ✔' : `Малгор: гнев ${Math.round(F.wrath)}/100 · ${names[F.stage]}${F.known ? ' · шпиль на карте' : ''}`}</div>`;
    }
    return x;
  };
}

// Ачивки
function foeAchInit() {
  if (typeof ACHS === 'undefined' || typeof ACH_BY === 'undefined' || ACH_BY.fmalgor) return;
  const add = [
    { id: 'fraven',  name: 'Каркнуть не успел', desc: 'Сбит ворон-разведчик Малгора. Донос так и остался неотправленным.', ev: /сбил ворона-разведчика/ },
    { id: 'fthrall', name: 'Слуга двух господ? Нет, одного', desc: 'Побеждён прислужник тьмы. Увольняться из такой службы можно только вперёд ногами.', ev: /победил: Прислужник тьмы/ },
    { id: 'fknight', name: 'Рыцарь печального образа', desc: 'Побеждён рыцарь тьмы. Доспехи тяжёлые, а мораль — ещё тяжелее.', ev: /победил: Рыцарь тьмы/ },
    { id: 'fraid',   name: 'Налёт отбит', desc: 'Слуга Малгора унёс со склада добро. Склад, впрочем, тоже делает выводы.', ev: /унёс со склада/, secret: true },
    { id: 'fmalgor', name: 'Свет в конце башни', desc: 'Побеждён тёмный маг Малгор. Шпиль погас, а у соседей-призраков внезапно появилось много свободного времени.', ev: /победил: Тёмный маг Малгор/ },
  ];
  for (const a of add) { ACHS.push(a); ACH_BY[a.id] = a; }
}
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('DOMContentLoaded', foeAchInit);
