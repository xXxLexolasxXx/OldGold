'use strict';
// Главный герой: гном-универсал, которого игрок называет в начале игры.
// Выбирается кликом, по клику на любое «дело» идёт его делать, ходит и работает чуть быстрее
// остальных, берёт в команду одного гнома (скорость обоих общая).
// Характеристики растут вместе с городом. Подключается последним: оборачивает
// несколько глобальных функций (клик, выбор, шаг, интерфейс), не меняя их файлы.

const HERO_NAMES = ['Торин', 'Брунгильд', 'Гимли', 'Дорин', 'Фрейя', 'Балин', 'Хельга', 'Орин', 'Берта', 'Громм', 'Дис', 'Харальд'];
const TEAM_MAX = 1;                 // сколько гномов герой берёт в команду
const HERO_CARRY = 3;               // сколько несёт за раз из кучи
const DASH_CD = 45, DASH_TIME = 8, CRY_CD = 70, CRY_TIME = 12;

// ---------- Рост города и характеристики ----------

function heroTownScore() {
  let s = 0;
  for (const b of Game.buildings) if (b.state === 'done') s += 1 + ((b.level || 1) - 1);
  s += Game.units.length / 3;
  return s;
}
const heroLevelAt = score => Math.min(40, 1 + Math.floor(Math.sqrt(Math.max(0, score - 9) / 1.5)));
const heroNeedFor = L => 9 + 1.5 * L * L;     // очки города, с которых начинается уровень L+1

function heroDefaults(h) {
  h.name = h.name || 'Герой';
  h.level = h.level || 1;
  h.cls = h.cls || null;          // профессия из гильдии (маг, лучник, воин, разбойник)
  h.equip = h.equip || { weapon: null, armor: null };
  return h;
}

function heroStats(h) {
  const L = h.level;
  return { str: 6 + Math.round(L * 1.6), agi: 7 + Math.round(L * 1.2), int: 5 + Math.round(L * 1.4), end: 8 + Math.round(L * 1.5) };
}

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

function spawnHero(name) {
  const st = Game.buildings.find(b => b.type === 'storehouse') || Game.buildings[0];
  let x = 40, y = 30;
  if (st) {
    const s = randomFreeNear(st.doorX, st.doorY + 2, 1, 3, (xx, yy) => isWalkable(xx, yy) && !World.door[idx(xx, yy)]);
    [x, y] = s || [st.doorX, st.doorY + 1];
  }
  const u = spawnUnit('hero', x, y);
  u.smoker = false;
  u.hero = heroDefaults({ name: name || 'Герой' });
  Game.hero = u;
  return u;
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
  if (Mobile.on) mobileSheet('info');
  updateUI(true);
}

function heroCanJoin(u) {
  return u && u.type !== 'hero' && !u.dead && !u.isCourier && !UNIT_TYPES[u.type].animal;
}

function joinTeam(hero, u) {
  const mates = Game.units.filter(x => x.teamOf === hero.id);
  if (mates.includes(u)) { leaveTeam(u); return; }
  if (mates.length >= TEAM_MAX) leaveTeam(mates[0]);
  heroStopUnit(u);
  u.teamOf = hero.id;
  u.idleFlag = false;
  toast(`${hero.hero.name}: ${UNIT_TYPES[u.type].name} теперь в команде`);
  floater(u.x, u.y - 1.4, 'В команде', '#f6d458');
}

function leaveTeam(u) {
  u.teamOf = null;
  heroStopUnit(u);
}

// Сбросить текущее дело: освободить занятое, выйти из здания
function heroStopUnit(u) {
  if (u.proc && u.proc.return) { try { u.proc.return(); } catch (e) { /* ничего */ } }
  u.proc = null; u.action = null; u.anim = null; u.lastRes = undefined;
  if (u.inside) { const b = u.inside; u.inside = null; u.x = b.doorX + 0.5; u.y = b.doorY + 0.5; }
  if (u.home && !u.home.removed) { if (u.home.worker === u) u.home.worker = null; }
  if (u.home && u.type === 'hero') u.home = null;
  else if (u.home && u.teamOf) u.home = null;
  u.job = null;
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
    case 'build': yield* heroBuild(u, c.b); break;
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

function* followGen(u, h) {
  const s = randomFreeNear(Math.floor(h.x), Math.floor(h.y), 1, 2, (x, y) => isWalkable(x, y) && !World.door[idx(x, y)]);
  if (s) yield { walk: s };
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
  if (k === 'cry' && H.level >= 3) {
    if ((H.cdCry || 0) > Game.time) return;
    H.cdCry = Game.time + CRY_CD;
    let n = 0;
    for (const u of Game.units) if (u !== h && !u.isCourier && Math.hypot(u.x - h.x, u.y - h.y) < 9) { u.boostUntil = Game.time + CRY_TIME; n++; }
    floater(h.x, h.y - 1.6, 'За мной!', '#ffb050');
    toast(`${H.name}: боевой клич вдохновил ${n} гном.`);
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
  const pct = Math.max(0, Math.min(100, ((score - lo) / (hi - lo)) * 100));
  const mate = Game.units.find(u => u.teamOf === h.id);
  const cd = k => Math.max(0, Math.ceil((H[k] || 0) - Game.time));
  const bar = (n, c) => `<span class="hp-bar"><i style="width:${Math.min(100, n * 2.2)}%;background:${c}"></i></span>`;
  const abil = (k, name, lvl, cdk, desc) => {
    if (H.level < lvl) return `<div class="hp-ab off"><b>${name}</b><small>с уровня ${lvl}</small></div>`;
    const c = cd(cdk);
    return `<button class="hp-ab" data-hero="${k}" ${c ? 'disabled' : ''} title="${desc}"><b>${name}</b><small>${c ? c + ' с' : desc}</small></button>`;
  };
  return `<div class="ihead"><img class="bpic" src="${portraitURL('hero', h.look)}" alt=""><div><h3>${H.name}</h3>
    <span class="muted small">${H.cls ? H.cls : 'Гном-универсал'} · уровень ${H.level}</span></div></div>
    <div class="hp-xp" title="Растёт вместе с городом: больше зданий и жителей — выше уровень"><i style="width:${pct}%"></i></div>
    <div class="hp-stats">
      <div>Сила ${bar(s.str, '#d0603a')}<b>${s.str}</b></div>
      <div>Ловкость ${bar(s.agi, '#6ac04a')}<b>${s.agi}</b></div>
      <div>Смекалка ${bar(s.int, '#5a8ae0')}<b>${s.int}</b></div>
      <div>Стойкость ${bar(s.end, '#d0a83a')}<b>${s.end}</b></div>
    </div>
    <div class="irow">Скорость: <b>×${teamSpeedMul(h).toFixed(2)}</b> · работа: <b>×${teamWorkMul(h).toFixed(2)}</b></div>
    <div class="hp-abs">${abil('dash', 'Рывок', 1, 'cdDash', 'скорость ×1.4 на 8 с')}${abil('cry', 'Клич', 3, 'cdCry', 'гномы рядом бодрее')}</div>
    <div class="irow">Команда: ${mate ? `<b>${UNIT_TYPES[mate.type].name}</b> <button data-hero="leave" class="hp-sm">Отпустить</button>` : '<span class="muted">пусто — кликните по гному</span>'}</div>
    <div class="irow muted small">Оружие: ${H.equip.weapon || 'нет'} · Доспех: ${H.equip.armor || 'нет'}</div>
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
  btn.onclick = () => selectHero(true);
  document.getElementById('info').addEventListener('click', e => {
    const el = e.target.closest('[data-hero]');
    if (!el || !Game.hero) return;
    const k = el.dataset.hero;
    if (k === 'leave') { const m = Game.units.find(u => u.teamOf === Game.hero.id); if (m) leaveTeam(m); updateUI(true); }
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
        if (near && heroCanJoin(near)) { joinTeam(h, near); updateUI(true); return; }
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
  setupStart = function (seed) { _setup(seed); spawnHero('Герой'); Game.heroAsk = true; };

  const _apply = applySave;
  applySave = function (s) { _apply(s); Game.heroAsk = ensureHero(); };

  const _start = startGame;
  startGame = function () { _start(); initHeroUI(); updateUI(true); if (Game.heroAsk && typeof StartMenu === "undefined") { Game.heroAsk = false; askHeroName(); } };

  const _newGame = newGame;
  newGame = function () { _newGame(); if (Game.heroAsk) { Game.heroAsk = false; askHeroName(); } };

  const _load = loadGame;
  loadGame = function (slot) { const ok = _load(slot); if (ok && Game.heroAsk) { Game.heroAsk = false; askHeroName(); } return ok; };

  const _overlay = drawOverlay;
  drawOverlay = function (c) {
    _overlay(c);
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
    // флажок на цели команды
    const cm = h.cmd;
    if (sel && cm && cm.tx != null) {
      const fx = (cm.tx + 0.5) * TILE, fy = (cm.ty + 0.5) * TILE, b = Math.sin(t * 8) * 2;
      c.fillStyle = '#f6d458'; c.fillRect(fx - 1, fy - 16 + b, 2, 14);
      c.fillStyle = '#d83a2a'; c.beginPath(); c.moveTo(fx + 1, fy - 16 + b); c.lineTo(fx + 9, fy - 12 + b); c.lineTo(fx + 1, fy - 8 + b); c.fill();
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
function heroCardUpdate() {
  let card = document.getElementById('hero-card');
  if (!card) {
    card = document.createElement('div'); card.id = 'hero-card';
    card.addEventListener('click', e => {
      if (e.target.closest('.hc-x')) { Game.selUnit = null; updateUI(true); return; }
      const el = e.target.closest('[data-hero]');
      if (!el || !Game.hero) return;
      if (el.dataset.hero === 'leave') { const m = Game.units.find(u => u.teamOf === Game.hero.id); if (m) leaveTeam(m); updateUI(true); }
      else heroAbility(el.dataset.hero);
    });
    document.getElementById('view').appendChild(card);
    const st = document.createElement('style');
    st.textContent = `#hero-card{position:absolute;top:58px;right:10px;width:250px;z-index:6;padding:8px 10px 10px;background:rgba(26,19,13,.94);color:#e8dcc0;border:1px solid #b8902c;border-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,.6);font-size:13px;display:none}
    #hero-card .hc-x{position:absolute;top:3px;right:5px;padding:0 6px;font-size:13px;line-height:18px}
    #hero-card .ihead{margin-bottom:4px}
    body.mobile #hero-card{top:auto;bottom:calc(112px + env(safe-area-inset-bottom));right:6px;width:min(250px,64vw)}`;
    document.head.appendChild(st);
  }
  const on = !!(Game.hero && Game.selUnit && Game.selUnit === Game.hero);
  if (!on) { card.style.display = 'none'; return; }
  const html = heroPanel() + '<button class="hc-x" title="Закрыть (Esc)">×</button>';
  if (card.dataset.h !== html) { card.dataset.h = html; card.innerHTML = html; }
  card.style.display = 'block';
}
