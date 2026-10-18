'use strict';
// Жизнь героя (одиночная игра): здоровье и беды деревни, трактир с пивом, заклинания
// (телепорт на базу, малое лечение), изгнание призраков, рюкзак на 10 вещей, неловкое надевание
// доспехов и оружия. Всё хранится в hero.hero (сохраняется вместе с героем).
// Подключается после hero.js и оборачивает его функции. В кооперативе (Game.coop)
// не делает ничего: там то же самое считает сервер (js/coopsim.js).

const HL_INV = 10;                    // вещей в рюкзаке
const HL_DRUNK = 5, HL_FALL = 1, HL_STARS = 4;
const HL_TP_CD = 60, HL_HEAL_CD = 25;
const HL_EQUIP_WIN = 0.3;             // шанс удачного надевания: в 70% случаев неудача

// Что можно надеть. Чужим сессиям: добавьте свой товар сюда — он сам станет надеваемым.
// slot: 'weapon' | 'armor'; cls — для какого класса (необязательно)
const HL_GEAR = {
  leatherArmor: { slot: 'armor', name: 'Кожаный доспех' },
  mageArmor: { slot: 'armor', name: 'Мантия мага' },
  staff: { slot: 'weapon', name: 'Посох' },
};
// Заготовка под классы: у каждого своё оружие и анимация атаки (anim — из ANIM_TOOL в people.js)
const HL_CLASS = {
  warrior: { weapon: 'sword', anim: 'chop' },
  barbarian: { weapon: 'axe', anim: 'chop' },
  mage: { weapon: 'staff', anim: 'build' },
  archer: { weapon: 'bow', anim: 'reap' },
  druid: { weapon: 'staff', anim: 'build' },
  rogue: { weapon: 'dagger', anim: 'mine' },
  monk: { weapon: 'fists', anim: 'build' },
  priest: { weapon: 'mace', anim: 'build' },
};
const HL_FOOD = { bread: 0.45, sausage: 0.55, chickenleg: 0.6, steak: 0.65, croissant: 0.5 };
const hlOn = () => !!(Game.hero && !Game.coop);
const hlName = k => (HL_GEAR[k] && HL_GEAR[k].name) || (GOODS[k] && GOODS[k].name) || k;

// ---------- Данные героя ----------

function hlMaxHp(H) { return 40 + 5 * heroStats(H).end; }
// Малое лечение: 30% здоровья на 1-м уровне и на 10% сильнее с каждым следующим (на 15-м — 72%)
function hlHealPart(H) { return 0.3 * (1 + 0.1 * ((H.level || 1) - 1)); }

{
  const _hd = heroDefaults;
  heroDefaults = function (h) {
    _hd(h);
    if (!Array.isArray(h.inv)) h.inv = Array.from({ length: HL_INV }, () => null);
    h.maxhp = hlMaxHp(h);
    if (h.hp == null || h.hp > h.maxhp) h.hp = h.maxhp;
    return h;
  };
}

function hlAddItem(H, k, n = 1) {
  for (const s of H.inv) if (s && s.k === k && s.n < 20) { s.n += n; return true; }
  const i = H.inv.findIndex(s => !s);
  if (i < 0) return false;
  H.inv[i] = { k, n };
  return true;
}

function hlHurt(u, n, why) {
  const H = u.hero;
  H.hp = Math.max(0, H.hp - n);
  if (why && n >= 3) floater(u.x, u.y - 1.8, '−' + Math.round(n), '#ff8a70');
}
function hlHeal(u, n) { const H = u.hero; H.hp = Math.min(H.maxhp, H.hp + n); }

// ---------- Таверна и пиво ----------

function* hlTavernGen(u, c) {
  const inn = c.b, H = u.hero;
  if (!inn || inn.removed) return;
  const ok = yield { walk: [inn.doorX, inn.doorY] };
  if (!ok || inn.removed) return;
  const food = innFood(inn);
  if (!food) { floater(u.x, u.y - 1.6, 'Еды нет', '#e8a070'); toast('В трактире нет еды'); return; }
  yield { enter: inn };
  yield { wait: 3.5 };
  if (!inn.removed && inn.stock[food] > 0) {
    inn.stock[food]--;
    if (u.food >= 0.85 && hlAddItem(H, food, 1)) floater(u.x, u.y - 1.6, 'Взял с собой', '#ffe8a0');
    else u.food = Math.min(1.3, Math.max(u.food, u.food + (HL_FOOD[food] || 0.45)));
    hlHeal(u, H.maxhp * 0.15);
  }
  // с шансом 40% — кружка пива
  if (Math.random() < 0.4) {
    yield { wait: 2 };
    if (!inn.removed && inn.stock.beer > 0) {
      inn.stock.beer--;
      u.food = Math.min(1.3, u.food + 0.15);
      H.drunkUntil = Game.time + HL_DRUNK; H.drunkNext = Game.time;
      u.drunkAt = 1e9;                       // метка для походки и «ик!»
      floater(u.x, u.y - 1.6, 'Ик!', '#ffe070');
    }
  }
  yield { leave: true };
}

// ---------- Взять снаряжение из склада или мастерской ----------

function hlGearIn(b) { return Object.keys(HL_GEAR).find(k => b.stock[k] - (b.reserved[k] || 0) > 0) || null; }

function* hlTakeGen(u, c) {
  const b = c.b, H = u.hero;
  if (!b || b.removed) return;
  const ok = yield { walk: [b.doorX, b.doorY] };
  if (!ok || b.removed) return;
  const k = hlGearIn(b);
  if (!k) { floater(u.x, u.y - 1.6, 'Снаряжения нет', '#e8a070'); return; }
  yield { enter: b };
  yield { wait: 1.2 };
  if (!b.removed && b.stock[k] > 0) {
    if (hlAddItem(H, k, 1)) { b.stock[k]--; floater(u.x, u.y - 1.6, 'Взял: ' + hlName(k), '#ffe8a0'); }
    else floater(u.x, u.y - 1.6, 'Рюкзак полон', '#e8a070');
  }
  yield { leave: true };
}

// ---------- Неловкое надевание: в 70% неудача ----------

function* hlEquipGen(u, c) {
  const H = u.hero, s = H.inv[c.slot];
  if (!s || !HL_GEAR[s.k]) return;
  const g = HL_GEAR[s.k], armor = g.slot === 'armor';
  const say = (t, col) => floater(u.x, u.y - 1.7, t, col || '#ffe8b0');
  say(armor ? 'Так, надеваем…' : 'Ну-ка, подержим…');
  const lines = armor ? ['Ох!', 'Не лезет…', 'Застряло!', 'Тесновато…', 'Ай!'] : ['Тяжёлая!', 'Куда её?', 'Ой!', 'Как это держат?', 'Уу-ух!'];
  for (let k = 0; k < 6; k++) {
    u.vdir = 'S';
    yield { wait: 0.6, anim: armor ? (k % 2 ? 'duck' : 'dig') : (k % 2 ? 'chop' : 'build') };
    if (k === 1 || k === 3) say(lines[(Math.random() * lines.length) | 0], '#ffd0a0');
  }
  const win = Math.random() < HL_EQUIP_WIN;
  if (win) {
    const old = H.equip[g.slot];
    H.inv[c.slot].n--; if (H.inv[c.slot].n <= 0) H.inv[c.slot] = null;
    H.equip[g.slot] = s.k;
    if (old) hlAddItem(H, old, 1);
    fxBurst(u.x * TILE, u.y * TILE - 10, 14, ['#ffe070', '#fff6c0', '#ffd040'], 70, 60, 0.9, 1.8, 120);
    sfxAt('chime', u.x * TILE, u.y * TILE);
    say(armor ? 'Сидит как влитой!' : 'Вот это — оружие!', '#ffe070');
    yield { wait: 0.8, anim: 'build' };
  } else {
    // неудача: запутался, шлёпнулся, звёздочки над головой
    say(armor ? 'Застрял и упал!' : 'Выронил на ногу!', '#ff9a80');
    hlHurt(u, armor ? 2 : 4, 'fail');
    u.ouchUntil = Game.time + 2.6;
    sfxAt('ouch', u.x * TILE, u.y * TILE);
    yield { wait: HL_FALL + 0.5, anim: 'knocked' };
  }
}

// ---------- Изгнание призраков ----------

function hlGhostAt(t) {
  let best = null, bd = 1.3;
  for (const g of Game.ghosts || []) {
    if (g.exo || g.kind === 'reaper' || g.alpha < 0.25 || g.mode === 'leave') continue;
    const d = Math.hypot(g.x - (t[0] + 0.5), g.y - (t[1] + 0.5));
    if (d < bd) { bd = d; best = g; }
  }
  return best;
}

function* hlExorcise(u, c) {
  const g = c.g;
  for (let tries = 0; tries < 14; tries++) {      // призрак дрейфует — догоняем
    if (!g || g.exo || (Game.ghosts || []).indexOf(g) < 0) return;
    if (Math.hypot(g.x - u.x, g.y - u.y) < 1.9) break;
    const tx = Math.max(1, Math.min(MAP_W - 2, Math.floor(g.x))), ty = Math.max(1, Math.min(MAP_H - 2, Math.floor(g.y)));
    const spot = isWalkable(tx, ty) ? [tx, ty] : (randomFreeNear(tx, ty, 0, 2, (x, y) => isWalkable(x, y)) || null);
    if (!spot) return;
    yield { walk: spot };
    if (tries === 13) { floater(u.x, u.y - 1.6, 'Ушёл…', '#cfe6ff'); return; }
  }
  if (!g || g.exo) return;
  u.face = g.x > u.x ? 1 : -1; u.vdir = 'E';
  floater(u.x, u.y - 1.7, 'Именем деревни — прочь!', '#ffe9a0');
  HL.fx.push({ kind: 'exo', g, x: g.x, y: g.y, t0: Game.time, dur: 2.4 });
  sfxAt('chime', g.x * TILE, g.y * TILE);
  for (let k = 0; k < 4; k++) {
    u.gest = 'fist'; u.gestUntil = Game.time + 0.7; u.gestFace = u.face;
    if (k === 1 || k === 3) ghostStrike(g, u);      // призрак огрызается: бросок когтями
    yield { wait: 0.6 };
    if (g.exo || (Game.ghosts || []).indexOf(g) < 0) break;
    fxBurst(g.x * TILE, g.y * TILE - 14, 7, ['#fff6c0', '#ffe070', '#bfe8ff'], 50, 60, 0.9, 1.6, -40);
  }
  if ((Game.ghosts || []).indexOf(g) < 0) return;
  g.exo = Game.time; g.mode = 'leave'; g.modeT = 99;
  ghostSay(g, ['Свет… наконец-то…', 'Спасибо, что отпустил…', 'Я иду домой…'][(Math.random() * 3) | 0]);
  sfxAt('wail', g.x * TILE, g.y * TILE, 0.8);
  if (Math.random() < 0.45) { dropPile(Math.floor(g.x), Math.floor(g.y), 'gold', 1); logEvent('night', `${u.hero.name} отпустил призрака, тот оставил монету`, g.x, g.y); }
  else logEvent('night', `${u.hero.name} прогнал призрака в мир иной`, g.x, g.y);
  yield { wait: 0.6 };
}

// ---------- Заклинания ----------

function hlCast(k) {
  const h = Game.hero, H = h && h.hero;
  if (!hlOn() || !H) return;
  if (H.stunUntil > Game.time || H.drunkUntil > Game.time) { toast(`${H.name} сейчас не в том состоянии, чтобы колдовать`); return; }
  if (k === 'tp') {
    if ((H.cdTp || 0) > Game.time) return;
    H.cdTp = Game.time + HL_TP_CD;
    heroStopUnit(h);
    HL.fx.push({ kind: 'tp', x: h.x, y: h.y, t0: Game.time, dur: 1.3 });
    sfxAt('chime', h.x * TILE, h.y * TILE);
    h.proc = (function* () {
      yield { wait: 1.3, anim: 'duck' };
      const st = Game.buildings.find(b => b.type === 'storehouse') || Game.buildings[0];
      let x = 40, y = 30;
      const sp = typeof heroSpawnSpot === 'function' ? heroSpawnSpot() : null;   // возрождение у большого костра, где стоит табличка
  if (sp) { [x, y] = sp.at; Game.signBump = (Game.signBump || 0) + 1; }
  else if (st) { const s = randomFreeNear(st.doorX, st.doorY + 2, 1, 3, (xx, yy) => isWalkable(xx, yy) && !World.door[idx(xx, yy)]); [x, y] = s || [st.doorX, st.doorY + 1]; }
      h.x = x + 0.5; h.y = y + 0.5;
      HL.fx.push({ kind: 'tp', x: h.x, y: h.y, t0: Game.time, dur: 1.0, arrive: true });
      sfxAt('chime', h.x * TILE, h.y * TILE);
      if (Game.selUnit === h) centerOn(h.x * TILE, h.y * TILE);
    })();
    h.action = null;
  }
  if (k === 'heal') {
    if ((H.cdHeal || 0) > Game.time) return;
    H.cdHeal = Game.time + HL_HEAL_CD;
    hlHeal(h, H.maxhp * hlHealPart(H));
    h.injury = null;
    const mate = Game.units.find(x => x.teamOf === h.id);
    if (mate) mate.injury = null;
    HL.fx.push({ kind: 'heal', x: h.x, y: h.y, t0: Game.time, dur: 1.2 });
    if (!h.inside) { h.hfx = { k: 'win0', t: Game.time + 0.55 }; h.vdir = 'E'; }   // поднял руку с оружием — колдует
    sfxAt('chime', h.x * TILE, h.y * TILE);
    floater(h.x, h.y - 1.7, 'Малое лечение', '#9af0a0');
  }
  updateUI(true);
}

// ---------- Рюкзак ----------

function hlUse(i) {
  const h = Game.hero, H = h && h.hero;
  if (!hlOn() || !H) return;
  const s = H.inv[i];
  if (!s) return;
  if (HL_FOOD[s.k]) {
    s.n--; if (s.n <= 0) H.inv[i] = null;
    h.food = Math.min(1.3, h.food + HL_FOOD[s.k]);
    hlHeal(h, H.maxhp * 0.1);
    floater(h.x, h.y - 1.6, 'Ням', '#ffe8a0');
  } else if (HL_GEAR[s.k]) {
    if (H.stunUntil > Game.time || H.drunkUntil > Game.time) return;
    issueCmd(h, { kind: 'equip', slot: i, tx: Math.floor(h.x), ty: Math.floor(h.y), label: 'Надеть' });
  } else toast('Это не съесть и не надеть');
  updateUI(true);
}
function hlDrop(i) {
  const H = Game.hero && Game.hero.hero;
  if (H && H.inv[i]) { H.inv[i] = null; updateUI(true); }
}
function hlUnequip(slot) {
  const H = Game.hero && Game.hero.hero;
  if (!H || !H.equip[slot]) return;
  if (hlAddItem(H, H.equip[slot], 1)) { H.equip[slot] = null; updateUI(true); } else toast('Рюкзак полон');
}

// ---------- Тик: беды деревни, пьяный героя, возрождение ----------

const HL = { fx: [], unit: null, hpT: 0 };

function hlRespawn(u, why) {
  const H = u.hero;
  heroStopUnit(u);
  u.dead = false; u.brk = null; u.burn = null; u.injury = null; u.anim = null; u.drunkAt = 0;
  const st = Game.buildings.find(b => b.type === 'storehouse') || Game.buildings[0];
  let x = 40, y = 30;
  // очнётся у большого костра, где табличка (как при телепорте); нет костра — у склада
  const sp = typeof heroSpawnSpot === 'function' ? heroSpawnSpot() : null;
  if (sp) { [x, y] = sp.at; Game.signBump = (Game.signBump || 0) + 1; }
  else if (st) { const s = randomFreeNear(st.doorX, st.doorY + 2, 1, 3, (xx, yy) => isWalkable(xx, yy) && !World.door[idx(xx, yy)]); [x, y] = s || [st.doorX, st.doorY + 1]; }
  u.x = x + 0.5; u.y = y + 0.5; u.food = Math.max(u.food, 0.6);
  H.hp = Math.round(H.maxhp * dif().heroHp); H.drunkUntil = 0; H.stunUntil = 0; H.downT = 0;
  u.abfx = null; u.hfx = null; u.combatUntil = 0;
  toast(`${H.name} очнулся у костра${why ? ': ' + why : ''}`);
}

// Повержен: падает навзничь, над головой звёздочки, пару секунд лежит — и только потом очнётся у костра
const HL_DOWN = 2.6;
function hlDown(u, why) {
  const H = u.hero, now = Game.time, down = dif().heroDown;   // «Спокойный» поднимает быстро, «Выживание» держит дольше
  heroStopUnit(u);
  H.downT = now + down; H.downWhy = why; H.stunUntil = H.downT; H.hp = Math.min(H.hp, 0);
  u.ouchUntil = H.downT;
  u.proc = (function* () { yield { wait: down, anim: 'knocked' }; })();
  u.action = null;
  floater(u.x, u.y - 1.8, ['Повержен…', 'Ох…', 'Всё, лежу'][(Math.random() * 3) | 0], '#ff9a80');
  if (typeof sfxAt === 'function') sfxAt('ouch', u.x * TILE, u.y * TILE);
}

function hlTick(dt) {
  if (!hlOn()) { HL.unit = null; return; }
  let h = Game.hero;
  // героя убила беда и герой возродился новым юнитом — переносим здоровье, рюкзак и всё остальное
  if (HL.unit && HL.unit !== h && HL.unit.hero && h.hero !== HL.unit.hero) {
    const old = HL.unit.hero;
    h.hero = heroDefaults(old); h.look = HL.unit.look;
    old.hp = Math.round(hlMaxHp(old) * dif().heroHp); old.drunkUntil = 0; old.stunUntil = 0;
    toast(`${old.name} погиб и вернулся к складу`);
  }
  HL.unit = h;
  const H = h.hero, now = Game.time;
  H.maxhp = hlMaxHp(H);
  h.smoker = false;
  h.ghostCD = now + 5;                        // герой не боится призраков
  // фоновые эффекты
  for (let i = HL.fx.length - 1; i >= 0; i--) if (now - HL.fx[i].t0 > HL.fx[i].dur) HL.fx.splice(i, 1);
  for (const g of Game.ghosts || []) if (g.exo) {
    g.y -= dt * 1.4; g.alpha = Math.max(0, g.alpha - dt * 0.9);
    if (Math.random() < dt * 25) fxBurst(g.x * TILE, g.y * TILE - 10, 1, ['#fff6c0', '#bfe8ff'], 20, 30, 0.8, 1.4, -30);
  }
  // пьяный: сбитое управление, потом падение и звёздочки
  if (H.drunkUntil > now && now >= H.drunkNext && !h.inside) {
    H.drunkNext = now + 0.6;
    if (Math.random() < 0.8) {
      const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 2;
      const tx = Math.floor(h.x + Math.cos(a) * r), ty = Math.floor(h.y + Math.sin(a) * r);
      if (isWalkable(tx, ty) && !World.door[idx(tx, ty)]) HL.rawIssue(h, { kind: 'move', x: tx, y: ty, tx, ty, label: '' });
    }
  }
  if (H.drunkUntil && now >= H.drunkUntil) {
    H.drunkUntil = 0; h.drunkAt = 0;
    heroStopUnit(h);
    H.stunUntil = now + HL_FALL;
    h.proc = (function* () { yield { wait: HL_FALL, anim: 'knocked' }; h.ouchUntil = Game.time + HL_STARS; })();
    h.action = null;
  }
  if (H.stunUntil > now && h.cmd) h.cmd = null;
  // повержен — лежит, здоровье не копится, потом очнётся у костра
  if (H.downT) {
    if (now >= H.downT || h.inside) hlRespawn(h, H.downWhy || 'деревня не пускает так просто');
    return;
  }
  // здоровье
  if (!h.noFood && h.food <= 0 && !dif().noStarve) H.hp -= 0.5 * dt * dif().starve;
  else if (H.hp < H.maxhp && h.food > 0.25 && !(h.burn && h.burn.stage)) H.hp = Math.min(H.maxhp, H.hp + 0.4 * dt);
  if (h.burn && h.burn.stage) H.hp -= 6 * dt;
  if (h.injury && h.injury !== H.seenInj) hlHurt(h, 8, 'injury');
  H.seenInj = h.injury || null;
  const fly = h.anim === 'fly';
  if (fly && !H.seenFly) hlHurt(h, 5, 'hit');
  H.seenFly = fly;
  const frz = h.anim === "freeze";
  if (frz && !H.seenFrz) hlHurt(h, 3, 'fright');
  H.seenFrz = frz;
  if (H.hp <= 0) hlDown(h, 'деревня не пускает так просто');
}

// ---------- Подключение ----------

{
  const _rs = resetGameState;
  resetGameState = function () { _rs(); HL.unit = null; HL.fx.length = 0; };
  const _ic = issueCmd;
  issueCmd = function (hero, c) {
    if (hlOn() && hero === Game.hero && hero.hero) {
      const H = hero.hero;
      if (H.stunUntil > Game.time) return;                 // лежит
      if (H.drunkUntil > Game.time && c.kind !== 'equip') {   // пьяному не до точности: приказ уходит в сторону
        if (Math.random() < 0.7) {
          const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 3;
          const tx = Math.floor(hero.x + Math.cos(a) * r), ty = Math.floor(hero.y + Math.sin(a) * r);
          if (isWalkable(tx, ty)) { floater(hero.x, hero.y - 1.6, 'Куда?..', '#ffe070'); c = { kind: 'move', x: tx, y: ty, tx, ty, label: '' }; }
        }
      }
    }
    return _ic(hero, c);
  };
  HL.rawIssue = _ic;

  const _rc = resolveCmd;
  resolveCmd = function (t) {
    if (!hlOn() || Game.hero.dead) return _rc(t);
    const [x, y] = t;
    if (inb(x, y)) {
      const gh = hlGhostAt(t);
      if (gh) return { kind: 'exorcise', g: gh, tx: Math.floor(gh.x), ty: Math.floor(gh.y), label: 'Прогнать призрака' };
      const b = buildingAt(t);
      if (b && !b.isRoad && b.state === 'done' && !b.upg) {
        if (b.type === 'inn') return { kind: 'tavern', b, tx: b.doorX, ty: b.doorY, label: 'Поесть в трактире' };
        if (hlGearIn(b)) return { kind: 'take', b, tx: b.doorX, ty: b.doorY, label: 'Взять снаряжение' };
      }
    }
    return _rc(t);
  };

  const _run = runCmd;
  runCmd = function* (u, c) {
    if (c.kind === 'tavern') yield* hlTavernGen(u, c);
    else if (c.kind === 'take') yield* hlTakeGen(u, c);
    else if (c.kind === 'equip') yield* hlEquipGen(u, c);
    else if (c.kind === 'exorcise') yield* hlExorcise(u, c);
    else yield* _run(u, c);
  };

  // напарнику не приказывают пить и надевать: он просто идёт рядом
  const _tt = teamThink;
  teamThink = function (u) {
    const h = heroOf(u);
    if (h && h.cmd && (h.cmd.kind === 'equip' || h.cmd.kind === 'take' || h.cmd.kind === 'tavern' || h.cmd.kind === 'exorcise')) {
      u.idleFlag = false; u.job = null;
      return (function* () { yield { wait: 0.8 }; })();
    }
    return _tt(u);
  };

  const _ab = heroAbility;
  heroAbility = function (k) {
    if (k === 'tp' || k === 'heal') { hlCast(k); return; }
    if (/^use\d+$/.test(k)) { hlUse(+k.slice(3)); return; }
    if (k === 'unw' || k === 'una') { hlUnequip(k === 'unw' ? 'weapon' : 'armor'); return; }
    _ab(k);
  };

  const _step2 = step;
  step = function (dt) { _step2(dt); hlTick(dt); };

  const _hpan = heroPanel;
  const hlPanel = function () {
    let html = _hpan();
    if (!hlOn()) return html;
    const h = Game.hero, H = h.hero, now = Game.time;
    const hp = Math.max(0, Math.round(H.hp)), mhp = H.maxhp;
    const col = hp / mhp > 0.5 ? '#5ac04a' : hp / mhp > 0.25 ? '#e0b030' : '#e04a3a';
    const hpBlock = `<div class="irow">Здоровье <b>${hp}/${mhp}</b></div><div class="hl-hp"><i style="width:${Math.round(100 * hp / mhp)}%;background:${col}"></i></div>`;
    const cd = k => Math.max(0, Math.ceil((H[k] || 0) - now));
    const spell = (k, name, cdk, desc) => { const c = cd(cdk); return `<button class="hp-ab" data-hero="${k}" ${c ? 'disabled' : ''} title="${desc}"><b>${name}</b><small>${c ? c + ' с' : desc}</small></button>`; };
    const spells = `<div class="hp-abs">${spell('tp', 'Телепорт', 'cdTp', 'на базу, к складу')}${spell('heal', 'Малое лечение', 'cdHeal', `+${Math.round(hlHealPart(H) * 100)}% здоровья`)}</div>`;
    let inv = '<div class="hl-inv">';
    for (let i = 0; i < HL_INV; i++) {
      const s = H.inv[i];
      inv += s ? `<button class="hl-slot" data-hero="use${i}" title="${hlName(s.k)}${HL_GEAR[s.k] ? ' — надеть (шанс удачи 30%)' : HL_FOOD[s.k] ? ' — съесть' : ''}. Правый клик — выбросить"><img src="${iconURL('good', s.k, 2)}" alt="">${s.n > 1 ? `<i>${s.n}</i>` : ''}</button>` : '<span class="hl-slot empty"></span>';
    }
    inv += '</div>';
    const eq = (slot, label, un) => H.equip[slot] ? `${label}: <b>${hlName(H.equip[slot])}</b> <button data-hero="${un}" class="hp-sm">снять</button>` : `${label}: <span class="muted">нет</span>`;
    const equip = `<div class="irow small">${eq('weapon', 'Оружие', 'unw')} · ${eq('armor', 'Доспех', 'una')}</div>`;
    html = html.replace('<div class="hp-xp"', hpBlock + '<div class="hp-xp"');
    html = html.replace(/<div class="irow muted small">Оружие:[^<]*<\/div>/, '');
    html = html.replace('<div class="tip">', `${spells}<div class="irow small muted">Рюкзак (${H.inv.filter(Boolean).length}/${HL_INV})</div>${inv}${equip}<div class="tip">`);
    return html;
  };
  heroPanel = hlPanel;
  // другой файл (кооператив) мог заменить heroPanel после нас: в одиночной игре панель всё равно наша
  const _sg = startGame;
  startGame = function () {
    _sg();
    const cur = heroPanel;
    if (cur !== hlPanel) heroPanel = function () { return (typeof Coop !== 'undefined' && Coop.on) ? cur() : hlPanel(); };
  };

  const _overlay2 = drawOverlay;
  drawOverlay = function (c) {
    _overlay2(c);
    if (!hlOn()) return;
    const h = Game.hero, H = h.hero, t = Game.time;
    // полоска здоровья над головой, под ником
    if (!h.inside && !h.dead) {
      const px = Math.round(h.x * TILE), py = Math.round(h.y * TILE) - 40, w = 28, r = Math.max(0, Math.min(1, H.hp / H.maxhp));
      c.fillStyle = 'rgba(10,6,2,0.85)'; c.fillRect(px - w / 2 - 1, py - 1, w + 2, 5);
      c.fillStyle = r > 0.5 ? '#5ac04a' : r > 0.25 ? '#e0b030' : '#e04a3a'; c.fillRect(px - w / 2, py, Math.round(w * r), 3);
      c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(px - w / 2, py, Math.round(w * r), 1);
      if (H.drunkUntil > t) { c.font = 'bold 7px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ffe070'; c.fillText('~ик~', px, py - 4); c.textAlign = 'start'; }
    }
    // заклинания и изгнание
    for (const f of HL.fx) {
      const p = (t - f.t0) / f.dur, px = f.x * TILE, py = f.y * TILE + 4;
      c.save();
      if (f.kind === 'tp') {
        const rr = f.arrive ? 26 * (1 - p) + 4 : 4 + 22 * p;
        c.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 14; k++) {
          const a = p * 9 + k * 0.45, rad = rr * (1 - k / 22);
          c.fillStyle = `rgba(${150 + k * 6},120,255,${0.8 * (f.arrive ? p : 1 - p * 0.5)})`;
          c.beginPath(); c.arc(px + Math.cos(a) * rad, py - k * 2.2 + Math.sin(a) * rad * 0.35, 2.2, 0, 7); c.fill();
        }
        c.strokeStyle = `rgba(190,150,255,${0.7 * (1 - p)})`; c.lineWidth = 1.5; c.beginPath(); c.ellipse(px, py, rr, rr * 0.35, 0, 0, 7); c.stroke();
      } else if (f.kind === 'heal') {
        c.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 6; k++) {
          const a = k / 6 * 6.28 + p * 3, yy = py - 6 - p * 30 - k * 3;
          c.fillStyle = `rgba(120,255,140,${0.9 * (1 - p)})`;
          c.fillRect(px + Math.cos(a) * 12 - 1.5, yy, 3, 7); c.fillRect(px + Math.cos(a) * 12 - 3.5, yy + 2, 7, 3);
        }
        c.strokeStyle = `rgba(140,255,160,${0.8 * (1 - p)})`; c.lineWidth = 1.5; c.beginPath(); c.ellipse(px, py, 8 + 14 * p, 3 + 5 * p, 0, 0, 7); c.stroke();
      } else if (f.kind === 'exo') {
        const g = f.g, gx = g ? g.x * TILE : px, gy = g ? g.y * TILE : py;
        c.globalCompositeOperation = 'lighter';
        const beam = c.createLinearGradient(0, gy - 90, 0, gy + 8);
        beam.addColorStop(0, 'rgba(255,240,180,0)'); beam.addColorStop(0.7, `rgba(255,240,170,${0.55 * Math.sin(Math.min(1, p) * Math.PI)})`); beam.addColorStop(1, 'rgba(255,255,220,0)');
        c.fillStyle = beam; c.fillRect(gx - 9 - 6 * p, gy - 90, 18 + 12 * p, 98);
        for (let k = 0; k < 3; k++) {
          const q = (p * 1.6 + k / 3) % 1;
          c.strokeStyle = `rgba(255,236,160,${0.7 * (1 - q)})`; c.lineWidth = 1.4; c.beginPath(); c.ellipse(gx, gy + 2, 6 + 22 * q, 2 + 7 * q, 0, 0, 7); c.stroke();
        }
      }
      c.restore();
    }
  };

}

// стили: рюкзак и полоска здоровья в карточке героя
{
  const st = document.createElement('style');
  st.textContent = `.hl-hp{height:7px;background:#2a2014;border:1px solid #0a0705;border-radius:3px;overflow:hidden;margin:2px 0 6px}.hl-hp i{display:block;height:100%}
  .hl-inv{display:grid;grid-template-columns:repeat(5,1fr);gap:3px;margin:3px 0 6px}
  .hl-slot{position:relative;height:34px;padding:0;background:#241a0e;border:1px solid #5a4620;border-radius:4px;cursor:pointer}
  .hl-slot.empty{display:block;cursor:default;opacity:.55}
  .hl-slot img{width:26px;height:26px;image-rendering:pixelated;vertical-align:middle}
  .hl-slot i{position:absolute;right:2px;bottom:0;font-size:10px;font-style:normal;color:#f6e8c0;text-shadow:0 1px 0 #000}`;
  document.head.appendChild(st);
  // правый клик по вещи — выбросить
  document.addEventListener('contextmenu', e => {
    const el = e.target.closest && e.target.closest('.hl-slot[data-hero^="use"]');
    if (!el) return;
    e.preventDefault();
    hlDrop(+el.dataset.hero.slice(3));
  });
}
