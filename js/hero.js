'use strict';
// Главный герой: гном-универсал, которого игрок называет в начале игры.
// Выбирается кликом, по клику на любое «дело» идёт его делать, ходит и работает чуть быстрее
// остальных, берёт в команду одного гнома (скорость обоих общая).
// Характеристики растут вместе с городом. Подключается последним: оборачивает
// несколько глобальных функций (клик, выбор, шаг, интерфейс), не меняя их файлы.

const HERO_NAMES_M = ['Торин', 'Гимли', 'Дорин', 'Балин', 'Орин', 'Громм', 'Харальд', 'Двалин'];
const HERO_NAMES_F = ['Брунгильд', 'Фрейя', 'Хельга', 'Берта', 'Дис', 'Гудрун'];
const HERO_NAMES = HERO_NAMES_M.concat(HERO_NAMES_F);
const heroNameFor = fem => { const a = fem ? HERO_NAMES_F : HERO_NAMES_M; return a[(Math.random() * a.length) | 0]; };
const TEAM_MAX = 3;                 // сколько гномов герой берёт в команду
const HERO_CARRY = 3;               // сколько несёт за раз из кучи
const DASH_CD = 45, DASH_TIME = 8, CRY_CD = 70, CRY_TIME = 12;

// ---------- Рост города и характеристики ----------

function heroTownScore() {
  let s = 0;
  for (const b of Game.buildings) if (b.state === 'done') s += 1 + ((b.level || 1) - 1);
  s += Game.units.length / 3;
  return s;
}
// 15 уровней; каждый следующий даётся всё труднее: очки растут как L^2.3
// (5-й — около 57 очков города и боёв, 10-й — около 320, 15-й — около 875)
const HERO_LVL_MAX = 15;
const heroNeedFor = L => 8 + 2 * Math.pow(L, 2.3);     // очки, с которых начинается уровень L+1
const heroLevelAt = score => { let L = 1; while (L < HERO_LVL_MAX && score >= heroNeedFor(L)) L++; return L; };

function heroDefaults(h) {
  h.name = h.name || 'Герой';
  h.level = Math.min(HERO_LVL_MAX, h.level || 1);   // старые сохранения могли дорасти выше 15
  h.cls = h.cls || null;          // профессия из гильдии (маг, лучник, воин, разбойник)
  h.equip = h.equip || { weapon: null, armor: null };
  return h;
}

function heroStats(h) {
  const L = h.level, k = heroRestMul(h);
  return { str: Math.round((6 + Math.round(L * 1.6)) * k), agi: Math.round((7 + Math.round(L * 1.2)) * k), int: 5 + Math.round(L * 1.4), end: 8 + Math.round(L * 1.5) };
}

// «отлёживание» после проигранного забега (js/run/tavern.js, meta.hurtUntil): минуту герой слабее и медленнее
function heroRestLeft(h) {
  if (typeof runMeta !== 'function' || typeof Game === 'undefined' || !Game.hero || Game.hero.hero !== h) return 0;
  return Math.max(0, (runMeta().hurtUntil || 0) - Date.now());
}
const heroRestMul = h => (heroRestLeft(h) > 0 ? 0.8 : 1);

function heroOf(u) {
  if (u.type === 'hero') return u;
  return u.teamOf ? Game.unitMap.get(u.teamOf) || null : null;
}

// множитель скорости ходьбы и работы: у героя и его напарника он общий
function teamSpeedMul(u) {
  const h = heroOf(u);
  if (!h || !h.hero) return 1;
  let m = 1.1 + heroStats(h.hero).agi * 0.007;
  if (h.dashUntil > Game.time) m *= 1.4;
  return m;
}
function teamWorkMul(u) {
  const h = heroOf(u);
  if (!h || !h.hero) return 1;
  return 1.05 + heroStats(h.hero).str * 0.008;
}

// ---------- Появление героя ----------

// Точка появления — у большого костра: табличка стоит у костра, гном возникает рядом.
// Ничего не хранится в сохранении: место вычисляется по костру детерминированно.
const SPAWN_SIGNS = [
  'Бесплатное воскрешение. Не благодарите — вы и так всё испортите.',
  'Опять ты? А мы только подмели.',
  'Добро пожаловать обратно. Смерть тебе, видимо, не понравилась.',
  'Гном возродился. Склад об этом пока не в курсе.',
  'Место для воскрешений. Скидок нет, гарантии тоже.',
  'Герой воскрес! Осталось подождать, когда он снова об этом пожалеет.',
  'У костра тепло, а у гнома — привычка искать приключения.',
  'Смерть была неплоха, но ты решил продолжить. Смелое решение.',
  'Здесь выдают гномов повторно. Состояние — как у прежнего: так себе.',
  'Держись подальше от смерти. Это не совет, это мольба склада.'
];
let spawnSpotCache = null;
function heroSpawnSpot() {
  const bf = Game.buildings.find(b => b.type === 'bonfire' && b.state === 'done') || Game.buildings.find(b => b.type === 'bonfire');
  const st = Game.buildings.find(b => b.type === 'storehouse') || Game.buildings[0];
  const base = bf || st;
  if (!base) return null;
  if (spawnSpotCache && spawnSpotCache.b === base) return spawnSpotCache;
  const ok = (xx, yy) => inb(xx, yy) && isWalkable(xx, yy) && !World.door[idx(xx, yy)] && !World.bmap[idx(xx, yy)];
  const cands = [];
  for (let y = base.doorY - 5; y <= base.doorY + 5; y++) for (let x = base.doorX - 5; x <= base.doorX + 5; x++) {
    const d = Math.hypot(x - base.doorX, y - base.doorY);
    if (d >= 2 && d <= BONFIRE_HERO && ok(x, y)) cands.push([d, x, y]);
  }
  cands.sort((a, b) => a[0] - b[0] || a[2] - b[2] || a[1] - b[1]);
  let spot = null;
  if (cands.length >= 2) {
    const [, sx, sy] = cands[0];
    const nb = cands.find(c => c[1] !== sx || c[2] !== sy);
    spot = { b: base, sign: [sx, sy], at: [nb[1], nb[2]] };
  } else spot = { b: base, sign: [base.doorX + 1, base.doorY + 1], at: [base.doorX, base.doorY + 1] };
  return (spawnSpotCache = spot);
}

function spawnHero(name) {
  const spot = heroSpawnSpot();
  const [x, y] = spot ? spot.at : [40, 30];
  const u = spawnUnit('hero', x, y);
  u.smoker = false;
  u.hero = heroDefaults({ name: name || 'Герой' });
  Game.hero = u;
  Game.signBump = (Game.signBump || 0) + 1;   // после возрождения надпись на табличке другая
  return u;
}

function drawSpawnSign(c) {
  const spot = heroSpawnSpot();
  if (!spot || !Game.buildings.includes(spot.b)) return;
  const px = (spot.sign[0] + 0.5) * TILE, py = (spot.sign[1] + 1) * TILE - 2;
  const n = SPAWN_SIGNS.length;
  const k = (Math.floor(Game.time / 12) * 7 + (Game.seed | 0) + (Game.signBump || 0) * 3) % n;
  const text = t(SPAWN_SIGNS[(k + n) % n]);
  c.save();
  c.font = 'bold 6px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  // перенос по словам: ширина доски ~64 px
  const lines = []; let cur = '';
  for (const w of text.split(' ')) {
    const t = cur ? cur + ' ' + w : w;
    if (c.measureText(t).width > 62 && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  lines.push(cur);
  const bw = 70, bh = 8 + lines.length * 8, top = py - 14 - bh;
  c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(px - 6 + 3, py - 3, 12, 3);                 // тень у основания
  c.fillStyle = '#4a3220'; c.fillRect(px - 1, top + bh - 2, 3, py - top - bh + 2);       // столб
  c.fillStyle = '#6a4a2c'; c.fillRect(px - 1, top + bh - 2, 1, py - top - bh + 2);
  c.fillStyle = '#0a0705'; c.fillRect(px - bw / 2 - 1, top - 1, bw + 2, bh + 2);         // рамка
  c.fillStyle = '#7a5630'; c.fillRect(px - bw / 2, top, bw, bh);                          // доска
  c.fillStyle = '#8a6438'; c.fillRect(px - bw / 2, top, bw, 1);
  c.fillStyle = 'rgba(30,16,6,0.35)';
  for (let y = top + 4; y < top + bh - 2; y += 4) c.fillRect(px - bw / 2 + 1, y, bw - 2, 1);   // прожилки
  c.fillStyle = '#d8d0c0';
  for (const [nx, ny] of [[-bw / 2 + 3, top + 2], [bw / 2 - 4, top + 2], [-bw / 2 + 3, top + bh - 4], [bw / 2 - 4, top + bh - 4]]) c.fillRect(px + nx, ny, 1, 1);   // гвозди
  lines.forEach((ln, i) => {
    const ty = top + 9 + i * 8;
    c.lineWidth = 2; c.strokeStyle = 'rgba(20,10,2,0.55)'; c.strokeText(ln, px, ty);
    c.fillStyle = '#fff0c0'; c.fillText(ln, px, ty);
  });
  c.restore();
}

function ensureHero() {
  let h = Game.units.find(u => u.type === 'hero' && !u.dead);
  if (h) { heroDefaults(h.hero || (h.hero = {})); Game.hero = h; return false; }
  spawnHero('Герой');
  return true;
}

// ---------- Имя в начале игры ----------

function askHeroName() {
  const h = Game.hero;
  if (!h) return;
  const wasSpeed = Game.speed, wasPaused = Game.paused;
  Game.paused = true;
  let box = document.getElementById('hero-name');
  if (box) box.remove();
  box = document.createElement('div');
  box.id = 'hero-name';
  box.innerHTML = `<div class="hn-card">
    <img src="${portraitURL('hero', h.look)}" alt="">
    <h2>Как зовут героя?</h2>
    <p>Он поведёт ваш город: ходит и работает быстрее обычных гномов, умеет любое дело и растёт вместе с городом.</p>
    <input id="hn-input" maxlength="16" value="${HERO_NAMES[(Math.random() * HERO_NAMES.length) | 0]}" autocomplete="off">
    <button id="hn-ok">В путь</button></div>`;
  document.body.appendChild(box);
  const inp = box.querySelector('#hn-input');
  const done = () => {
    const nm = inp.value.trim().slice(0, 16) || 'Герой';
    h.hero.name = nm;
    box.remove();
    Game.paused = wasPaused; Game.speed = wasSpeed;
    selectHero(true);
    updateUI(true);
  };
  box.querySelector('#hn-ok').onclick = done;
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') done(); });
  setTimeout(() => { inp.focus(); inp.select(); }, 50);
}

// ---------- Выбор и команды ----------

function selectHero(center) {
  const h = Game.hero;
  if (!h) return;
  Game.selected = null;
  Game.selUnit = h;
  if (center) centerOn(h.x * TILE, h.y * TILE);
  if (Mobile.on) mobileSheet(null);   // на телефоне у героя своя компактная плашка, шторки не нужны
  updateUI(true);
}

function heroCanJoin(u) {
  return u && u.type !== 'hero' && !u.dead && (u.type === 'goat' || u.type === 'carter' || !UNIT_TYPES[u.type].animal);
}

// Коза идёт в команду с 5 уровня героя, извозчик — с 10
const TEAM_LEVEL = { goat: 5, carter: 10 };
function heroTeamLocked(hero, u) {
  const need = TEAM_LEVEL[u.type] || 0;
  return need > hero.hero.level ? need : 0;
}

function joinTeam(hero, u) {
  const mates = Game.units.filter(x => x.teamOf === hero.id);
  if (mates.includes(u)) { leaveTeam(u); return; }
  const need = heroTeamLocked(hero, u);
  if (need) { toast(`${hero.hero.name}: ${UNIT_TYPES[u.type].name.toLowerCase()} пойдёт в команду с ${need} уровня героя`); floater(u.x, u.y - 1.4, `С ${need} ур.`, '#e8a070'); return; }
  if (mates.length >= TEAM_MAX) leaveTeam(mates[0]);
  heroStopUnit(u);
  if (u.isCourier) u.releaseOcc();
  u.teamOf = hero.id;
  u.idleFlag = false;
  toast(`${hero.hero.name}: ${UNIT_TYPES[u.type].name} теперь в команде`);
  floater(u.x, u.y - 1.4, 'В команде', '#f6d458');
}

// Мини-диалог «Взять в команду? ✓ ✕» (телефон): сверху, подальше от пальца; первые 0,4 с кнопки глухие, через 6 с гаснет
let teamAskEl = null, teamAskTimer = 0;
function teamAskClose() {
  clearTimeout(teamAskTimer);
  if (teamAskEl) { teamAskEl.remove(); teamAskEl = null; }
}
function askTeam(hero, u) {
  teamAskClose();
  const mate = u.teamOf === hero.id;
  const el = teamAskEl = document.createElement('div');
  el.className = 'team-ask';
  el.innerHTML = `<span>${mate ? 'Отпустить' : 'Взять в команду'}: ${UNIT_TYPES[u.type].name}?</span><button class="ta-no" title="Нет">✕</button><button class="ta-ok" title="Да">✓</button>`;
  const t0 = performance.now();
  let down = null;
  el.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
  el.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const moved = down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 12;
    down = null;
    if (b.classList.contains('ta-ok')) {
      if (performance.now() - t0 < 400 || moved || u.dead) return;
      teamAskClose();
      joinTeam(hero, u);
      updateUI(true);
    } else teamAskClose();
  });
  document.body.appendChild(el);
  teamAskTimer = setTimeout(teamAskClose, 6000);
}

function leaveTeam(u) {
  u.teamOf = null;
  heroStopUnit(u);
}

// Сбросить текущее дело: освободить занятое, выйти из здания
function heroStopUnit(u) {
  if (u.proc && u.proc.return) { try { u.proc.return(); } catch (e) { /* ничего */ } }
  if (u.brk) dropBreak(u);   // перекур/сон прерван приказом: иначе brk висит до конца нового дела, а клетка перекура занята
  u.proc = null; u.action = null; u.anim = null; u.lastRes = undefined;
  if (u.inside) { const b = u.inside; u.inside = null; u.x = b.doorX + 0.5; u.y = b.doorY + 0.5; }
  if (u.home && !u.home.removed) { if (u.home.worker === u) u.home.worker = null; }
  if (u.home && u.type === 'hero') u.home = null;
  else if (u.home && u.teamOf) u.home = null;
  u.job = null;
  heroDropLoad(u);
  if (u.carry) { dropPile(Math.floor(u.x), Math.floor(u.y), u.carry, u.carryN || 1); u.carry = null; u.carryN = 0; }
  if (u.cmd) {
    const c = u.cmd;
    if (c.o && c.i != null && World.obj[c.i] === c.o) c.o.res = false;
    u.cmd = null;
  }
}

function issueCmd(hero, c) {
  heroStopUnit(hero);
  hero.cmd = c;
  if (c.o && c.i != null) c.o.res = true;
  if (c.kind === 'work') { c.b.worker = hero; hero.home = c.b; hero.cmd = null; }
}

// Что можно сделать по клику на клетку t
function resolveCmd(t) {
  const [x, y] = t;
  if (!inb(x, y)) return null;
  const i = idx(x, y);
  const b = buildingAt(t);
  if (b) {
    if (b.state !== 'done' || b.upg) return { kind: 'build', b, tx: b.doorX, ty: b.doorY, label: 'Строить' };
    if ((b.def.worker || b.def.auto) && !b.def.auto && !(b.worker && !b.worker.dead && b.worker.home === b))
      return { kind: 'work', b, tx: b.doorX, ty: b.doorY, label: 'Работать: ' + b.def.name };
    if (b.def.outputs && Object.keys(b.def.outputs).some(k => b.offer(k) > 0)) return { kind: 'haul', b, tx: b.doorX, ty: b.doorY, label: 'Отнести на склад' };
    return { kind: 'move', x: b.doorX, y: b.doorY, tx: b.doorX, ty: b.doorY, label: 'Идти' };
  }
  const rs = Game.roadSites.get(i);
  if (rs) return { kind: 'build', b: rs, tx: x, ty: y, label: 'Строить дорогу' };
  const p = Game.piles.get(i);
  if (p && !p.removed && GOOD_KEYS.some(g => p.stock[g] > 0)) return { kind: 'pile', p, tx: x, ty: y, label: 'Убрать кучу' };
  const o = World.obj[i];
  if (o) {
    if (o.t === 'field' && o.plan && !o.res) return { kind: 'dig', i, o, tx: x, ty: y, label: 'Вскопать' };
    if (o.t === 'field' && !o.plan && o.g >= 1 && o.farm && !o.res) return { kind: 'reap', i, o, tx: x, ty: y, label: 'Жать' };
    if (o.t === 'tree' && o.g >= 1 && !o.res) return { kind: 'chop', i, o, x, y, tx: x, ty: y, label: 'Рубить' };
    if (o.t === 'stone' && o.n > 0 && !o.res) return { kind: 'mine', i, o, x, y, tx: x, ty: y, label: 'Добывать камень' };
  }
  if (!isWalkable(x, y)) return null;
  return { kind: 'move', x, y, tx: x, ty: y, label: 'Идти' };
}

// ---------- Поведение ----------

function heroProgress(s) {
  let p = (s.hits || 0) + (s.used || 0) + (s.dug || 0) + (s.pave || 0) + (s.stock && s.stock.stone ? 0 : 0);
  if (s.upg) p += s.upg.hits + s.upg.usedN;
  return p;
}

function* heroBuild(u, s) {
  u.job = s;
  let last = heroProgress(s), since = Game.time, warned = false;
  const g = s.upg ? upgradeGen(u, s) : buildGen(u, s);
  let r = g.next();
  while (!r.done) {
    const p = heroProgress(s);
    if (p !== last) { last = p; since = Game.time; }
    const finished = s.removed || (!s.isRoad && s.state === 'done' && !s.upg);
    if (finished || Game.time - since > 10) {
      if (!finished && !warned) { warned = true; floater(u.x, u.y - 1.4, 'Нет материалов', '#e8a070'); }
      u.job = null;
    }
    const res = yield r.value;
    if (r.value && r.value.walk) since = Game.time;   // дорога к стройке — не простой: издалека идут дольше 10 с
    r = g.next(res);
  }
  u.job = null;
}

// Отнести груз на склад
function* heroStash(u) {
  const g = u.carry, n = u.carryN || 1;
  if (!g) return;
  const st = nearestStore(u.x, u.y, g);
  if (!st) { dropPile(Math.floor(u.x), Math.floor(u.y), g, n); u.carry = null; u.carryN = 0; return; }
  const ok = yield { walk: [st.doorX, st.doorY] };
  if (!u.carry) return;
  if (ok && !st.removed && st.isStore()) {
    yield { enter: st };
    st.stock[g] += n; Game.produced[g] += n;
    u.carry = null; u.carryN = 0;
    yield { wait: 0.5 };
    yield { walk: [Math.floor(u.x), Math.floor(u.y)] };
  } else {
    dropPile(Math.floor(u.x), Math.floor(u.y), g, n); u.carry = null; u.carryN = 0;
  }
}

function* heroChop(u, c) {
  const ok = yield { walk: [c.x, c.y] };
  if (!ok || World.obj[c.i] !== c.o) { c.o.res = false; return; }
  yield { wait: 4.5, anim: 'chop' };
  if (World.obj[c.i] === c.o) {
    World.obj[c.i] = { t: 'stump', g: 0 };
    World.growing.add(c.i);
    u.carry = 'trunk'; u.carryN = 1;
  }
  yield* heroStash(u);
}

function* heroMine(u, c) {
  let spot = null, bd = 1e9;
  for (const [dx, dy] of DIRS) {
    const x = c.x + dx, y = c.y + dy;
    if (!isWalkable(x, y)) continue;
    const d = Math.hypot(x - u.x, y - u.y);
    if (d < bd) { bd = d; spot = [x, y]; }
  }
  if (!spot) { c.o.res = false; floater(c.x + 0.5, c.y - 0.5, 'Не подойти', '#e8a070'); return; }
  const ok = yield { walk: spot };
  if (!ok || World.obj[c.i] !== c.o) { c.o.res = false; return; }
  for (let k = 0; k < 5; k++) {
    u.face = c.x + 0.5 > u.x ? 1 : -1; u.vdir = 'E';
    fxLater(0.52, () => rockHit(c.x, c.y, c.o, u, k === 4));
    yield { wait: 1, anim: 'mine' };
    if (World.obj[c.i] !== c.o) break;
  }
  c.o.res = false;
  if (World.obj[c.i] === c.o) {
    c.o.n--; c.o.dmg = 0;
    if (c.o.n <= 0) World.obj[c.i] = null;
    u.carry = 'stone'; u.carryN = 1;
    yield { wait: 0.5, anim: 'duck' };
  }
  yield* heroStash(u);
}

function* heroPile(u, c) {
  const p = c.p;
  const ok = yield { walk: [p.x, p.y], offroad: true };
  if (!ok || p.removed) return;
  const g = GOOD_KEYS.find(k => p.stock[k] - p.reserved[k] > 0);
  if (!g) return;
  const n = Math.min(HERO_CARRY, p.stock[g] - p.reserved[g]);
  p.stock[g] -= n;
  cleanupPile(p);
  yield { wait: 0.5, anim: 'duck' };
  u.carry = g; u.carryN = n;
  yield* heroStash(u);
}

function* runCmd(u, c) {
  switch (c.kind) {
    case 'move': yield { walk: [c.x, c.y] }; break;
    case 'build': yield* heroBuildChain(u, c.b); break;
    case 'haul': yield* heroHaul(u, c); break;
    case 'dig': yield* fieldDigGen(u, c.i); break;
    case 'reap': yield* helpHarvestGen(u, c.i); break;
    case 'chop': yield* heroChop(u, c); break;
    case 'mine': yield* heroMine(u, c); break;
    case 'pile': yield* heroPile(u, c); break;
  }
}

function* cmdGen(u, c, own) {
  yield* runCmd(u, c);
  if (own && u.cmd === c) u.cmd = null;
}

function* serfMateGen(u, h, c) {
  let did = false;
  if (c && c.kind === 'build') did = yield* serfAssistBuild(u, c.b);
  else if (c && c.kind === 'haul') did = yield* serfAssistHaul(u, c.b);
  if (!did) {
    if (Math.hypot(u.x - h.x, u.y - h.y) > 2.5) yield* followGen(u, h);
    else yield { wait: 0.8 };
  }
}

function* followGen(u, h) {
  const s = randomFreeNear(Math.floor(h.x), Math.floor(h.y), 1, 2, (x, y) => isWalkable(x, y) && !World.door[idx(x, y)]);
  if (s) yield { walk: s, offroad: !!u.isCourier };
  yield { wait: 0.6 };
}

function heroThink(u) {
  u.idleFlag = false;
  if (u.cmd) return cmdGen(u, u.cmd, true);
  if (u.home && !u.home.removed && u.home.worker === u) return workerGen(u, u.home);
  u.home = null;
  return (function* () { yield { wait: 0.8 }; })();
}

function teamThink(u) {
  const h = heroOf(u);
  if (!h || h.dead) { u.teamOf = null; return null; }
  u.idleFlag = false; u.job = null;
  if (u.home) { if (u.home.worker === u) u.home.worker = null; u.home = null; }
  const c = h.cmd;
  if (u.isCourier) return serfMateGen(u, h, c);   // трудяга носит предметы под цель героя
  if (c && c.kind !== 'move' && c.kind !== 'work') return cmdGen(u, c, false);
  if (Math.hypot(u.x - h.x, u.y - h.y) > 2.5) return followGen(u, h);
  return (function* () { yield { wait: 0.8 }; })();
}

// ---------- Способности ----------

function heroAbility(k) {
  const h = Game.hero;
  if (!h || !h.hero) return;
  const H = h.hero;
  if (k === 'dash') {
    if ((H.cdDash || 0) > Game.time) return;
    h.dashUntil = Game.time + DASH_TIME; H.cdDash = Game.time + DASH_CD;
    floater(h.x, h.y - 1.6, 'Рывок!', '#ffe070');
  }
  updateUI(true);
}

// ---------- Тик ----------

function heroTick(dt) {
  Game.heroT = (Game.heroT || 0) + dt;
  if (Game.heroT < 1) return;
  Game.heroT = 0;
  const h = Game.hero;
  if (!h || h.dead || !Game.unitMap.has(h.id)) {
    if (Game.time > 5) { spawnHero(h && h.hero ? h.hero.name : 'Герой'); toast('Герой вернулся в город'); }
    return;
  }
  const H = h.hero, L = heroLevelAt(heroTownScore());
  if (L > H.level) {
    H.level = L;
    toast(`${H.name} достиг уровня ${L}: город вырос!`);
    logEvent('people', `${H.name} достиг уровня ${L}`, h.x, h.y);
    floater(h.x, h.y - 1.6, `Уровень ${L}!`, '#ffe070');
  }
}

// ---------- Интерфейс ----------

function heroPanel() {
  const h = Game.hero, H = h.hero, s = heroStats(H);
  const score = heroTownScore(), lo = H.level > 1 ? heroNeedFor(H.level - 1) : 0, hi = heroNeedFor(H.level);
  const pct = H.level >= HERO_LVL_MAX ? 100 : Math.max(0, Math.min(100, ((score - lo) / (hi - lo)) * 100));
  const mate = Game.units.find(u => u.teamOf === h.id);
  const bar = (n, c) => `<span class="hp-bar"><i style="width:${Math.min(100, n * 2.2)}%;background:${c}"></i></span>`;

  return `<div class="ihead"><img class="bpic" src="${portraitURL('hero', h.look)}" alt=""><div><h3>${H.name}</h3>
    <span class="muted small">${H.cls ? H.cls : 'Гном-универсал'} · уровень ${H.level}</span>${heroRestLeft(H) > 0 ? `<br><span class="small" title="После проигранного забега: минуту слабее и медленнее">😴 Отлёживается: ${Math.ceil(heroRestLeft(H) / 1000)} с</span>` : ''}</div></div>
    <div class="hp-xp" title="${H.level >= HERO_LVL_MAX ? 'Высший, 15-й уровень' : `Растёт вместе с городом и боями: ${Math.floor(score)} из ${Math.ceil(hi)} очков до уровня ${H.level + 1}`}"><i style="width:${pct}%"></i></div>
    <div class="hp-stats">
      <div>Сила ${bar(s.str, '#d0603a')}<b>${s.str}</b></div>
      <div>Ловкость ${bar(s.agi, '#6ac04a')}<b>${s.agi}</b></div>
      <div>Смекалка ${bar(s.int, '#5a8ae0')}<b>${s.int}</b></div>
      <div>Стойкость ${bar(s.end, '#d0a83a')}<b>${s.end}</b></div>
    </div>
    <div class="irow">Скорость: <b>×${teamSpeedMul(h).toFixed(2)}</b> · работа: <b>×${teamWorkMul(h).toFixed(2)}</b></div>
    <div class="irow small muted">Способности класса — на панели быстрых способностей (клавиши 1–5)</div>
    <div class="irow">Команда: ${mate ? `<b>${UNIT_TYPES[mate.type].name}</b> <button data-hero="leave" class="hp-sm">Отпустить</button>` : '<span class="muted">пусто — кликните по гному</span>'}</div>
    <div class="irow muted small">Оружие: ${H.equip.weapon || 'нет'} · Доспех: ${H.equip.armor || 'нет'}</div>
    ${typeof neuPanelRow === 'function' ? neuPanelRow() : ''}
    ${typeof dpHeroRow === 'function' ? dpHeroRow() : ''}
    <div class="tip">Кликните по стройке, полю, дереву, камню, куче груза или зданию без работника — ${H.name} пойдёт делать это. По земле — просто идёт. Esc — снять выбор.</div>`;
}

function initHeroUI() {
  const st = document.createElement('style');
  st.textContent = `
  #hero-name{position:fixed;inset:0;background:rgba(8,6,3,.72);z-index:9999;display:flex;align-items:center;justify-content:center}
  .hn-card{background:#1f1710;border:2px solid #b8902c;border-radius:8px;padding:22px 26px;width:min(340px,90vw);text-align:center;color:#e8dcc0;font-family:inherit}
  .hn-card img{width:72px;height:72px;image-rendering:pixelated;border:2px solid #5a4620;border-radius:6px}
  .hn-card h2{margin:10px 0 6px;color:#f6d458;font-size:20px}
  .hn-card p{margin:0 0 12px;font-size:13px;opacity:.85}
  .hn-card input{width:100%;box-sizing:border-box;padding:8px 10px;font-size:17px;text-align:center;background:#120d08;color:#f6e8c0;border:1px solid #7a5f28;border-radius:4px}
  .hn-card button{margin-top:14px;padding:8px 26px;font-size:16px;background:#8a6a1c;color:#fff4d0;border:1px solid #d8b04a;border-radius:4px;cursor:pointer}
  #hero-btn{position:absolute;left:10px;bottom:10px;z-index:5;display:flex;align-items:center;gap:6px;padding:3px 10px 3px 3px;background:rgba(26,19,13,.88);color:#f6d458;border:1px solid #b8902c;border-radius:6px;cursor:pointer;font-size:13px}
  #hero-btn img{width:30px;height:30px;image-rendering:pixelated;border-radius:4px}
  .hp-xp{height:5px;background:#2a2014;border-radius:3px;margin:6px 0 8px;overflow:hidden}.hp-xp i{display:block;height:100%;background:#f6d458}
  .hp-stats{display:grid;grid-template-columns:1fr 1fr;gap:3px 12px;font-size:12px;margin-bottom:6px}
  .hp-stats div{display:flex;align-items:center;gap:4px}.hp-stats b{margin-left:auto}
  .hp-bar{flex:1;height:4px;background:#2a2014;border-radius:2px;overflow:hidden;min-width:20px}.hp-bar i{display:block;height:100%}
  .hp-abs{display:flex;gap:6px;margin:6px 0}
  .hp-ab{flex:1;display:flex;flex-direction:column;text-align:left;padding:5px 7px;background:#3a2c14;color:#f6e8c0;border:1px solid #8a6a28;border-radius:4px;cursor:pointer;font-size:12px}
  .hp-ab small{opacity:.75;font-size:10px}.hp-ab:disabled,.hp-ab.off{opacity:.45;cursor:default}
  .hp-sm{font-size:11px;padding:1px 6px;margin-left:6px}`;
  document.head.appendChild(st);
  const btn = document.createElement('button');
  btn.id = 'hero-btn';
  btn.title = 'Выбрать героя (H)';
  document.getElementById('view').appendChild(btn);
  btn.onclick = () => {
    if (Mobile.on && Game.hero && Game.selUnit === Game.hero) { heroCardMini = !heroCardMini; heroCardUpdate(); return; }   // уже выбран — выдвинуть/задвинуть карточку
    selectHero(true);
  };
  document.getElementById('info').addEventListener('click', e => {
    const el = e.target.closest('[data-hero]');
    if (!el || !Game.hero) return;
    const k = el.dataset.hero;
    if (k === 'leave') { for (const m of Game.units.filter(u => u.teamOf === Game.hero.id)) leaveTeam(m); updateUI(true); }
    else heroAbility(k);
  });
  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.code === 'KeyH') selectHero(true);
    if (e.code === 'Escape' && Game.selUnit) { Game.selUnit = null; updateUI(true); }
  });
}

function heroBtnUpdate() {
  const btn = document.getElementById('hero-btn');
  if (!btn || !Game.hero) return;
  const html = `<img src="${portraitURL("hero", Game.hero.look)}" alt=""><span class="hb-t">${Game.hero.hero.name} · ${Game.hero.hero.level}</span><span class="hb-lv">${Game.hero.hero.level}</span>`;
  if (btn.dataset.h !== html) { btn.dataset.h = html; btn.innerHTML = html; }
}

// ---------- Подключение к игре: оборачиваем глобальные функции ----------

{
  const _click = onLeftClickTile;
  onLeftClickTile = function (t) {
    const h = Game.hero;
    if (h && !Game.tool && inb(t[0], t[1])) {
      // клик по гному: герой — выбрать, при выбранном герое — позвать в команду
      let near = null, bd = 0.8;
      for (const u of Game.units) {
        if (u.inside || u.dead) continue;
        const d = Math.hypot(u.x - (t[0] + 0.5), u.y - (t[1] + 0.5));
        if (d < bd) { bd = d; near = u; }
      }
      if (near === h) { selectHero(false); return; }
      if (Game.selUnit === h) {
        if (near && heroCanJoin(near)) {
          if (typeof Mobile !== 'undefined' && Mobile.on) askTeam(h, near);   // на телефоне тап по гному слишком случаен: спрашиваем
          else { joinTeam(h, near); updateUI(true); }
          return;
        }
        teamAskClose();
        const c = resolveCmd(t);
        if (c) {
          issueCmd(h, c);
          if (c.kind !== 'move') floater(c.tx + 0.5, c.ty - 0.4, c.label, '#f6d458');
          return;
        }
        toast('Сюда не пройти');
        return;
      }
    }
    _click(t);
  };

  const _select = selectBuilding;
  selectBuilding = function (b) {
    if (Game.selUnit) Game.selUnit = null;
    _select(b);
  };

  const _step = step;
  step = function (dt) { _step(dt); heroTick(dt); };

  const _setHTML = setHTML;
  setHTML = function (id, html) {
    if (id === 'info') heroCardUpdate();   // панель героя — отдельное окно, окно здания не трогаем
    _setHTML(id, html);
  };

  const _upd = updateUI;
  updateUI = function (force) { _upd(force); heroBtnUpdate(); };

  const _reset = resetGameState;
  resetGameState = function () { _reset(); Game.hero = null; Game.selUnit = null; Game.heroT = 0; };

  const _setup = setupStart;
  setupStart = function (seed, ...o) { _setup(seed, ...o); spawnHero('Герой'); Game.heroAsk = true; };

  const _apply = applySave;
  applySave = function (s) { _apply(s); Game.heroAsk = ensureHero(); };

  const _start = startGame;
  startGame = function () { _start(); initHeroUI(); updateUI(true); if (Game.heroAsk && typeof StartMenu === "undefined") { Game.heroAsk = false; askHeroName(); } };

  const _newGame = newGame;
  newGame = function (...a) { _newGame(...a); if (Game.heroAsk) { Game.heroAsk = false; askHeroName(); } };

  const _load = loadGame;
  loadGame = function (slot) { const ok = _load(slot); if (ok && Game.heroAsk) { Game.heroAsk = false; askHeroName(); } return ok; };

  const _overlay = drawOverlay;
  drawOverlay = function (c) {
    _overlay(c);
    if (typeof drawSpawnSign === 'function') drawSpawnSign(c);
    const h = Game.hero;
    if (!h || h.dead) return;
    const t = Game.time;
    const ring = (u, col, r) => {
      c.strokeStyle = col; c.lineWidth = 1.5;
      c.beginPath(); c.ellipse(u.x * TILE, u.y * TILE + 6, r, r * 0.5, 0, 0, Math.PI * 2); c.stroke();
    };
    const sel = Game.selUnit === h;
    if (sel) ring(h, `rgba(246,212,88,${0.7 + 0.3 * Math.sin(t * 6)})`, 13);
    for (const u of Game.units) if (u.teamOf === h.id) ring(u, 'rgba(120,200,255,0.8)', 10);
    if (!h.inside) {
      c.font = 'bold 8px sans-serif'; c.textAlign = 'center';
      const nm = h.hero.name, px = h.x * TILE, py = h.y * TILE - 44;
      c.lineWidth = 3; c.strokeStyle = 'rgba(20,12,4,0.9)'; c.strokeText(nm, px, py);
      c.fillStyle = sel ? '#ffe070' : '#f0d890'; c.fillText(nm, px, py);
      c.textAlign = 'start';
    }
    // цель команды: пульсирующие угольники на клетке (вместо флажка); удар героя рисует herocard.js
    const cm = h.cmd;
    if (sel && cm && cm.tx != null) {
      const fx = (cm.tx + 0.5) * TILE, fy = (cm.ty + 0.5) * TILE, r = 10 + Math.round(Math.abs(Math.sin(t * 4)) * 3);
      c.fillStyle = '#f6d458';
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const x = Math.round(fx + sx * r), y = Math.round(fy + sy * r * 0.8);
        c.fillRect(x - (sx > 0 ? 3 : 0), y, 4, 2); c.fillRect(x - (sx > 0 ? 1 : 0), y - (sy > 0 ? 3 : 0), 2, 4);
      }
    }
    // подсказка под курсором: что сделает клик
    if (sel && R.hover && !Game.tool) {
      const cm2 = resolveCmd(R.hover);
      if (cm2 && cm2.kind !== 'move') {
        c.font = 'bold 7px sans-serif'; c.textAlign = 'center';
        const px = (R.hover[0] + 0.5) * TILE, py = R.hover[1] * TILE - 2;
        c.lineWidth = 3; c.strokeStyle = 'rgba(20,12,4,0.9)'; c.strokeText(cm2.label, px, py);
        c.fillStyle = '#fff0b0'; c.fillText(cm2.label, px, py);
        c.textAlign = 'start';
      }
    }
  };
}

// Окно героя: отдельная карточка поверх карты (справа вверху), не закрывает окно здания в колонке
let heroCardOpen = false, heroCardMini = true, heroCardWasOn = false;   // телефон: по умолчанию карточка — маленькая иконка
function heroCardUpdate() {
  let card = document.getElementById('hero-card');
  if (!card) {
    card = document.createElement('div'); card.id = 'hero-card';
    card.addEventListener('click', e => {
      if (e.target.closest('.hc-x')) { Game.selUnit = null; updateUI(true); return; }
      if (e.target.closest('.hc-t')) { heroCardOpen = !heroCardOpen; heroCardUpdate(); return; }
      if (e.target.closest('.hc-m')) { heroCardMini = true; heroCardUpdate(); return; }
      if (e.target.closest('.hc-ico')) { heroCardMini = false; heroCardUpdate(); return; }
      const el = e.target.closest('[data-hero]');
      if (!el || !Game.hero) return;
      if (el.dataset.hero === 'leave') { for (const m of Game.units.filter(u => u.teamOf === Game.hero.id)) leaveTeam(m); updateUI(true); }
      else if (el.dataset.hero === 'center') centerOn(Game.hero.x * TILE, Game.hero.y * TILE);
      else heroAbility(el.dataset.hero);
    });
    document.getElementById('view').appendChild(card);
    const st = document.createElement('style');
    st.textContent = `#hero-card{position:absolute;top:58px;right:10px;width:250px;z-index:6;padding:8px 10px 10px;background:rgba(26,19,13,.94);color:#e8dcc0;border:1px solid #b8902c;border-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,.6);font-size:13px;display:none}
    #hero-card .hc-x{position:absolute;top:3px;right:5px;padding:0 6px;font-size:13px;line-height:18px}
    #hero-card .ihead{margin-bottom:4px}
    body.mobile #hero-card{top:auto;bottom:calc(116px + env(safe-area-inset-bottom));right:auto;left:6px;width:min(290px,calc(100vw - 12px));padding:3px 62px 3px 4px;font-size:11px;max-height:min(40vh,calc(100dvh - 200px));overflow-y:auto;transform-origin:left bottom;animation:hc-up .22s ease-out}
    @keyframes hc-up{from{opacity:0;transform:translateY(24px) scale(.92)}to{opacity:1;transform:none}}
    body.mobile #hero-card.mini{width:auto;padding:0;background:none;border:0;box-shadow:none}
    body.mobile #hero-card .hc-ico{padding:2px;border-radius:6px;background:rgba(26,19,13,.8);border:1px solid #b8902c;position:relative}
    body.mobile #hero-card .hc-ico img{width:24px;height:24px;image-rendering:pixelated;display:block}
    body.mobile #hero-card .hc-ico b{position:absolute;right:-4px;bottom:-4px;min-width:14px;padding:0 3px;border-radius:7px;background:#b8902c;color:#1a1008;font-size:10px;text-align:center}
    body.mobile #hero-card .hc-m{position:absolute;top:3px;right:48px;padding:0 5px;font-size:12px;line-height:16px}
    body.mobile.sheet-tab #hero-card,body.mobile.sheet-info #hero-card{display:none!important}
    body.mobile #hero-card .hc-t{position:absolute;top:3px;right:26px;padding:0 5px;font-size:12px;line-height:16px}
    body.mobile #hero-card .hc-x{top:3px;right:4px;padding:0 5px;font-size:12px;line-height:16px}
    #hero-card .hc-row{display:flex;align-items:center;gap:5px;min-height:30px}
    body.mobile #hero-card .hc-row img{width:22px;height:22px}
    #hero-card .hc-row img{width:30px;height:30px;image-rendering:pixelated;border-radius:4px;flex:none}
    body.mobile #hero-card .hc-body .ihead img{width:30px;height:30px}
    body.mobile #hero-card .hc-body{zoom:.78;max-height:260px;overflow-y:auto}
    body.mobile #hero-card .hc-body h3{font-size:12px;margin:0}
    body.mobile #hero-card .hc-body .hp-bar{height:4px}
    body.mobile #hero-card .hc-body button{padding:2px 4px;font-size:10px;min-height:22px}
    #hero-card .hc-row .hc-n{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #hero-card .hc-row .hp-ab{flex:none;min-height:26px;padding:1px 6px;font-size:11px}
    #hero-card .hc-body{margin-top:4px;border-top:1px solid #4a3a1c;padding-top:4px}
    #hero-card .hc-body .tip{display:none}`;
    document.head.appendChild(st);
  }
  const on = !!(Game.hero && Game.selUnit && Game.selUnit === Game.hero);
  if (on && !heroCardWasOn) { heroCardMini = true; heroCardOpen = false; }   // каждый новый выбор героя — снова маленькая иконка
  heroCardWasOn = on;
  if (!on) { card.style.display = 'none'; return; }
  card.classList.toggle('mini', Mobile.on && heroCardMini);
  let html;
  if (Mobile.on && heroCardMini) {
    card.style.display = 'none'; delete card.dataset.h; return;
  } else if (Mobile.on) {
    // телефон: тонкая плашка сверху (портрет, имя, рывок/клич), по ▾ раскрывается полная панель
    const H = Game.hero.hero, cd = k => Math.max(0, Math.ceil((H[k] || 0) - Game.time));
    const ab = (k, name, lvl, cdk) => H.level < lvl ? '' : `<button class="hp-ab" data-hero="${k}" ${cd(cdk) ? 'disabled' : ''}><b>${name}</b>${cd(cdk) ? ' ' + cd(cdk) : ''}</button>`;
    html = `<div class="hc-row"><img src="${portraitURL('hero', Game.hero.look)}" alt=""><span class="hc-n"><b>${H.name}</b> · ур. ${H.level}</span><button class="hp-ab" data-hero="center" title="Камера к герою"><b>◎</b></button>${ab('dash', 'Рывок', 1, 'cdDash')}${ab('cry', 'Клич', 3, 'cdCry')}</div>`
      + (heroCardOpen ? `<div class="hc-body">${heroPanel()}</div>` : '')
      + `<button class="hc-m" title="Свернуть в иконку">–</button><button class="hc-t" title="${heroCardOpen ? 'Меньше' : 'Подробнее'}">${heroCardOpen ? '▴' : '▾'}</button><button class="hc-x" title="Снять выбор">×</button>`;
  } else html = heroPanel() + '<button class="hc-x" title="Закрыть (Esc)">×</button>';
  if (card.dataset.h !== html) { card.dataset.h = html; card.innerHTML = html; }
  card.style.display = 'block';
}
