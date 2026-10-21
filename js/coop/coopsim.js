'use strict';
// Кооператив, серверная часть: выполняется ТОЛЬКО в Node (server/simhost.js), в браузер не подключается.
// Живёт внутри той же симуляции, что и одиночная игра: у каждого игрока свой герой (обычный Unit с u.owner),
// команды приходят строками JSON, снимки для клиентов уходят строками JSON.
// Наружу (в server.js) торчат функции coop*: Join, Leave, Cmd, UnitsPacket, WorldPacket, InitPacket, Drain, MeData, HeroData.

const COOP_CLASSES = {
  warrior:   { name: 'Воин',   hp: 120, col: '#c8503a', info: 'Крепкий боец в железе' },
  barbarian: { name: 'Варвар', hp: 140, col: '#b87a2a', info: 'Самый выносливый, меньше всех думает' },
  mage:      { name: 'Маг',    hp: 80,  col: '#6a8aea', info: 'Хрупкий, зато умный' },
  archer:    { name: 'Лучник', hp: 90,  col: '#6aaa4a', info: 'Меткий глаз и быстрые ноги' },
  druid:     { name: 'Друид',  hp: 100, col: '#4aa07a', info: 'Дружит с лесом и грибами' },
  rogue:     { name: 'Плут',   hp: 90,  col: '#8a6aaa', info: 'Всё, что плохо лежит, лежит хорошо' },
  monk:      { name: 'Монах',  hp: 110, col: '#d8b84a', info: 'Спокойствие и крепкие кулаки' },
  priest:    { name: 'Жрец',   hp: 100, col: '#e8e0c8', info: 'Лечит словом и пивом' },
  paladin:   { name: 'Паладин', hp: 120, col: '#f0c860', info: 'Держит костёр, бьёт нечисть светом' },
  bard:      { name: 'Бард',   hp: 90,  col: '#e07ab0', info: 'Поёт, пьёт и вдохновляет других' },
};
const COOP_CHAT = [
  'Опять всё самому делать?',
  'Кто строил этот забор — тот пил.',
  'Дорогу бы сперва проложили, гении.',
  'Пиво кончилось. Цивилизация тоже.',
  'Я не ленюсь, я копирую силы для драмы.',
  'Отличный план. Жаль, что не мой.',
];
// Что хост разрешает игрокам (сам хост может всё). Включается и выключается в админ-панели.
const COOP_PERMS = {
  build: 'Строить здания', road: 'Класть дороги', erase: 'Сносить здания', eraseRoad: 'Убирать дороги и поля',
  field: 'Размечать поля', upgrade: 'Улучшать здания', manage: 'Паузы, доставки, рецепты, склад', train: 'Обучать жителей', chat: 'Чат', council: 'Совет деревни (голосование раз в сутки)',
};
const COOP_INV = 10;
const COOP_DRUNK = 5, COOP_FALL = 1, COOP_STARS = 4;

const coop = {
  players: new Map(),         // ник -> герой (Unit)
  out: [],                    // события для рассылки: { to?, msg }
  shB: new Map(), shO: null, shOr: null, shOf: null, shRa: null, shRS: '', shP: '', shSB: '',
  t: 0, lvT: 0,
  perms: Object.fromEntries(Object.keys(COOP_PERMS).map(k => [k, true])),
  // общая жизнь: ночи без потерь и заказы деревни (сохраняются отдельным файлом сервера)
  vil: { streak: 0, best: 0, nights: 0, hall: {}, fr: {} },
  quest: null, qDone: 0, prevNight: false, prevEve: false, lostAtEve: null,
  pairQ: [], pairDay: new Map(), cn: null, cnDay: -1, qT: 0,
};

// ---------- Герой игрока ----------

function coopBaseHp(clsKey, level) { return (COOP_CLASSES[clsKey] || COOP_CLASSES.warrior).hp + 8 * ((level || 1) - 1); }

function coopHome() {
  const st = Game.buildings.find(b => b.type === 'storehouse') || Game.buildings[0];
  if (!st) return [40, 30];
  return randomFreeNear(st.doorX, st.doorY + 2, 1, 3, (x, y) => isWalkable(x, y) && !World.door[idx(x, y)]) || [st.doorX, st.doorY + 1];
}

function coopSay(to, text) { coop.out.push({ to, msg: { t: 'toast', text } }); }

function coopJoin(name, dataJson) {
  const d = JSON.parse(dataJson);
  coopLeave(name);
  const cls = coopOwn(COOP_CLASSES, d.cls) ? d.cls : 'warrior';
  let x, y;
  if (d.x != null && isWalkable(Math.floor(d.x), Math.floor(d.y))) { x = Math.floor(d.x); y = Math.floor(d.y); }
  else [x, y] = coopHome();
  const u = spawnUnit('hero', x, y);
  u.smoker = false; u.owner = name;
  if (d.look != null) u.look = d.look;
  u.food = d.food != null ? d.food : 1;
  const level = d.level || 1;
  const H = heroDefaults({ name, level, cls: COOP_CLASSES[cls].name });
  H.clsKey = cls; H.owner = name; H.nightFalls = d.nf || 0;
  H.quests = d.q || null; H.xp = d.xp || 0; H.titles = Array.isArray(d.ti) ? d.ti.slice(0, 12) : []; H.qstat = d.qs || {}; H.title = d.tt || null;
  H.maxhp = coopBaseHp(cls, level);
  H.hp = d.hp > 0 ? Math.min(d.hp, H.maxhp) : H.maxhp;
  H.inv = Array.from({ length: COOP_INV }, (_, i) => (d.inv && d.inv[i]) || null);
  u.hero = H;
  coop.players.set(name, u);
  coopCheckBrothers(H);
  coop.out.push({ msg: { t: 'toast', text: `${name} (${H.cls}) приходит в деревню` } });
  return u.id;
}

function coopHeroData(name) {
  const u = coop.players.get(name);
  if (!u) return null;
  const H = u.hero;
  return JSON.stringify({ cls: H.clsKey, level: H.level, hp: Math.round(H.hp), inv: H.inv, x: u.x, y: u.y, food: u.food, look: u.look, nf: H.nightFalls || 0, q: H.quests || null, xp: H.xp || 0, ti: H.titles || [], qs: H.qstat || {}, tt: H.title || null });
}

function coopLeave(name) {
  const u = coop.players.get(name);
  if (!u) return null;
  const data = coopHeroData(name);
  coop.players.delete(name);
  coopKill(u);
  return data;
}

function coopKill(u) {
  heroStopUnit(u);
  u.dead = true;
  u.releaseOcc();
  Game.smokers.delete(u);
  purgeDead();
}

function coopDropHeroes() {
  for (const u of Game.units.slice()) if (u.type === 'hero') { u.dead = true; u.proc = null; u.releaseOcc(); }
  purgeDead();
  coop.players.clear();
  Game.hero = null;
}

// ---------- Инвентарь ----------

function coopAddItem(H, key, n = 1) {
  for (const s of H.inv) if (s && s.k === key && s.n < 20) { s.n += n; return true; }
  const i = H.inv.findIndex(s => !s);
  if (i < 0) return false;
  H.inv[i] = { k: key, n };
  return true;
}

function coopUseItem(u, slot) {
  const H = u.hero, s = H.inv[slot];
  if (!s) return;
  const fv = { bread: 0.45, sausage: 0.55, chickenleg: 0.6, steak: 0.65, croissant: 0.5, fish: 0.5 }[s.k];
  if (!fv) { coopSay(H.owner, 'Это не съесть'); return; }
  s.n--; if (s.n <= 0) H.inv[slot] = null;
  u.food = Math.min(1.3, u.food + fv);
  H.hp = Math.min(H.maxhp, H.hp + H.maxhp * 0.1);
  floater(u.x, u.y - 1.6, 'Ням', '#ffe8a0');
}

// ---------- Таверна и пиво ----------

function* tavernGen(u, c) {
  const inn = c.b, H = u.hero;
  if (!inn || inn.removed) return;
  const ok = yield { walk: [inn.doorX, inn.doorY] };
  if (!ok || inn.removed) return;
  const food = innFood(inn);
  if (!food) { floater(u.x, u.y - 1.6, 'Еды нет', '#e8a070'); coopSay(H.owner, 'В трактире нет еды'); return; }
  yield { enter: inn };
  yield { wait: 3.5 };
  if (!inn.removed && inn.stock[food] > 0) {
    inn.stock[food]--;
    coopQEvent(H, 'tavern');
    if (u.food >= 0.85 && coopAddItem(H, food, 1)) floater(u.x, u.y - 1.6, 'Взял с собой', '#ffe8a0');
    else u.food = Math.max(u.food, Math.min(1.3, u.food + (food === 'chickenleg' ? 0.6 : food === 'steak' ? 0.65 : 0.45)));
    H.hp = Math.min(H.maxhp, H.hp + H.maxhp * 0.15);
  }
  if (Math.random() < 0.4 || coopWantsToast(H)) {
    yield { wait: 2 };
    if (!inn.removed) {
      if (inn.stock.beer > 0) inn.stock.beer--;
      u.food = Math.min(1.3, u.food + 0.15);
      H.drunkUntil = Game.time + COOP_DRUNK;
      H.drunkNext = Game.time;
      floater(u.x, u.y - 1.6, 'Ик!', '#ffe070');
      coopToastDrink(H);
    }
  }
  yield { leave: true };
}

{
  const _rc = runCmd;
  runCmd = function* (u, c) {
    if (c.kind === 'tavern') yield* tavernGen(u, c);
    else if (c.kind === 'foe') { if (foeAlive(c.f)) yield* fightGen(u, c.f); }
    else yield* _rc(u, c);
  };
  const _kf = killFoe;
  killFoe = function (f, u) {      // зачёт боя игроку: враг убит, а не просто «держится»
    _kf(f, u);
    if (u && u.owner && u.hero && !foeAlive(f)) { coopQEvent(u.hero, 'foes'); u.hero.kills = (u.hero.kills || 0) + 1; }
  };
  const _us = unlockStage;
  unlockStage = function (id, quiet) {
    const had = Game.unlocked[id];
    _us(id, quiet);
    if (!had && Game.unlocked[id]) coop.out.push({ msg: { t: 'unlock', id } });
  };
  const _we = Unit.prototype.wantsEat;
  Unit.prototype.wantsEat = function () { return this.owner ? false : _we.call(this); };   // игрок кормит героя сам
}

// ---------- Команды игрока ----------

function coopGo(u, x, y) {
  const H = u.hero;
  if (H.stunUntil > Game.time) return;
  if (H.drunkUntil > Game.time) { x += Math.floor(Math.random() * 7) - 3; y += Math.floor(Math.random() * 7) - 3; }   // пьяному не до точности
  if (!inb(x, y)) return;
  const b = buildingAt([x, y]);
  let c;
  const foe = foesNear(x + 0.5, y + 0.5, 1.7)[0];
  if (foe) c = { kind: 'foe', f: foe, tx: x, ty: y, label: 'Бой' };
  else if (b && !b.isRoad && b.type === 'inn' && b.state === 'done' && !b.upg) c = { kind: 'tavern', b, tx: b.doorX, ty: b.doorY, label: 'Поесть' };
  else c = resolveCmd([x, y]);
  if (!c) { coopSay(H.owner, 'Сюда не пройти'); return; }
  issueCmd(u, c);
}

const coopInt = v => Number.isInteger(v);
// ключ из команды игрока есть в справочнике своим полем: BUILDINGS['constructor'] — это функция Object, а не «да»
const coopOwn = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);

function coopSetPerms(json) {
  const p = JSON.parse(json);
  for (const k in coop.perms) if (typeof p[k] === 'boolean') coop.perms[k] = p[k];
  return JSON.stringify(coop.perms);
}

function coopCmd(name, msgJson, admin) {
  let m;
  try { m = JSON.parse(msgJson); } catch (e) { return; }
  const u = coop.players.get(name);
  const can = k => { if (admin || coop.perms[k]) return true; coopSay(name, 'Хост запретил: ' + COOP_PERMS[k].toLowerCase()); return false; };
  switch (m.t) {
    case 'go': if (u && coopInt(m.x) && coopInt(m.y)) coopGo(u, m.x, m.y); break;
    case 'prio': if (can('manage')) coop.out.push({ msg: prioCmd(m) }); break;
    case 'use': if (u && coopInt(m.slot) && m.slot >= 0 && m.slot < COOP_INV) coopUseItem(u, m.slot); break;
    case 'drop': if (u && coopInt(m.slot) && u.hero.inv[m.slot]) u.hero.inv[m.slot] = null; break;
    case 'vote': if (u && coopInt(m.i) && can('upgrade')) coopVote(name, m.i); break;
    case 'chat': {
      if (!can('chat')) break;
      const text = coopInt(m.i) ? COOP_CHAT[m.i] : null;
      if (!text) break;
      coop.out.push({ msg: { t: 'chat', from: name, text, uid: u ? u.id : 0 } });
      break;
    }
    case 'build': {
      if (!can('build')) break;
      if (!coopOwn(BUILDINGS, m.type) || !coopInt(m.x) || !coopInt(m.y)) break;
      if (!admin && !isUnlocked(m.type)) { coopSay(name, 'Это здание ещё не открыто для деревни'); break; }
      const rot = m.rot === 1 || m.rot === 2 ? m.rot : 0;
      const err = checkPlacement(m.type, m.x, m.y, rot);
      if (err) { coopSay(name, err); break; }
      placeBuilding(m.type, m.x, m.y, false, rot);
      if (u) coopQEvent(u.hero, 'build');
      break;
    }
    case 'bact': {
      const need = { demolish: 'erase', upgrade: 'upgrade', upgcancel: 'upgrade', train: 'train', untrain: 'train', untrainall: 'train', hire: 'train' }[m.act] || 'manage';
      if (can(need)) coopBuildingAct(name, m);
      break;
    }
    case 'trade': {
      if (!can('manage') || !u) break;
      if (m.side !== 'buy' && m.side !== 'sell') break;
      if (typeof m.g !== 'string' || !coopInt(m.n) || m.n < 1) break;
      coopSay(name, tradeDo(m.side, m.g, Math.min(m.n, 999)).text);
      break;
    }
    case 'trav': if (typeof travCmd === 'function') travCmd(name, m); break;
    case 'wgs': if (typeof wgsCmd === 'function') wgsCmd(name, m); break;
    case 'dil': if (typeof dilVote === 'function') dilVote(name, !!admin, m.seq, m.i); break;
    case 'rsc': if (typeof rscCmd === 'function' && can('council')) rscCmd(name, m); break;
    case 'law': if (typeof lawCmd === 'function' && can('council')) lawCmd(name, !!admin, m); break;
    case 'dilmode': if (admin && typeof dilSetMode === 'function') dilSetMode(m.mode); else if (!admin) coopSay(name, 'Режим событий меняет только хост'); break;
    case 'qt': {
      if (can('train') && coopOwn(UNIT_TYPES, m.type) && !UNIT_TYPES[m.type].animal && !UNIT_TYPES[m.type].legacy) queueTraining(m.type);
      break;
    }
    case 'field': {
      if (!can('field')) break;
      if (!Array.isArray(m.cells) || !['add', 'del'].includes(m.mode)) break;
      if (!admin && m.mode === 'add' && !isUnlocked('tool:' + m.crop)) { coopSay(name, 'Эта культура ещё не открыта'); break; }
      for (const c of m.cells.slice(0, 80)) {
        if (!Array.isArray(c) || !coopInt(c[0]) || !coopInt(c[1]) || !inb(c[0], c[1])) continue;
        if (m.mode === 'del') removeField(c[0], c[1]);
        else if (['wheat', 'hay', 'hops'].includes(m.crop) && !planField(c[0], c[1], m.crop) && u) { coopQEvent(u.hero, 'field'); coopFieldPlanted(u.hero, idx(c[0], c[1])); }
      }
      break;
    }
    case 'road': {
      if (!can('road')) break;
      if (!Array.isArray(m.cells)) break;
      for (const c of m.cells.slice(0, 300)) if (Array.isArray(c) && coopInt(c[0]) && coopInt(c[1]) && placeRoadSite(c[0], c[1]) && u) coopQEvent(u.hero, 'road');
      break;
    }
    case 'erase': {
      if (!Array.isArray(m.cells)) break;
      let denied = false;
      for (const c of m.cells.slice(0, 60)) {
        if (!Array.isArray(c) || !coopInt(c[0]) || !coopInt(c[1]) || !inb(c[0], c[1])) continue;
        const bld = World.bmap[idx(c[0], c[1])] && Game.buildings.find(b => b.id === World.bmap[idx(c[0], c[1])]);
        const key = bld && !(bld.state !== 'done') ? 'erase' : 'eraseRoad';
        if (admin || coop.perms[key]) eraseAt([c[0], c[1]]); else denied = key;
      }
      if (denied) coopSay(name, 'Хост запретил: ' + COOP_PERMS[denied].toLowerCase());
      break;
    }
  }
}

// Кнопки окна здания: те же действия, что в ui.js, только на сервере и для всех
function coopBuildingAct(name, m) {
  const b = Game.buildings.find(x => x.id === m.id);
  if (!b || b.removed) return;
  switch (m.act) {
    case 'pause': if (b.state === 'done' && (b.def.worker || b.def.auto)) b.paused = !b.paused; break;
    case 'deliver': if (b.state === 'done' && (b.def.inputs || b.isStore())) toggleDeliver(b); break;
    case 'upgrade': if (canUpgrade(b)) startUpgrade(b); break;
    case 'upgcancel': if (b.upg) cancelUpgrade(b); break;
    case 'demolish': removeBuilding(b); break;
    case 'train': if (coopOwn(UNIT_TYPES, m.type) && !UNIT_TYPES[m.type].animal && !UNIT_TYPES[m.type].legacy && b.queue && b.queue.length < 10) b.queue.push(m.type); break;
    case 'untrain': if (coopInt(m.i)) b.queue.splice(m.i, 1); break;
    case 'untrainall': b.queue.length = 0; break;
    case 'hire': if (b.def.worker) queueTraining(b.def.worker); break;
    case 'recipe': if (b.recipeOn && coopInt(m.i) && m.i >= 0 && m.i < b.recipeOn.length) b.recipeOn[m.i] = !!m.on; break;
    case 'crop': if (b.crops && coopOwn(b.crops, m.c)) b.crops[m.c] = !!m.on; break;
    case 'block': if (coopOwn(GOODS, m.g)) Game.storeBlock[m.g] = !Game.storeBlock[m.g]; break;
  }
}


// ---------- Общая жизнь: ночи без потерь и заказы деревни ----------
// Ночь: от вечера до рассвета считаем потери гномов. Рассвет без потерь — серия растёт, деревня получает золото,
// а все герои — отдых и хлеб. «Герой ночи» — тот, кто не падал и остался здоровее всех.
// Заказ: каждый день деревня просит произвести столько-то товара до вечера; делает это весь мир вместе, награда — золото на склад.

const COOP_QUEST_POOL = [
  { g: 'trunk', n: 30, word: 'Заготовить' }, { g: 'stone', n: 24, word: 'Наколоть' }, { g: 'timber', n: 24, word: 'Напилить' },
  { g: 'wheat', n: 30, word: 'Собрать' }, { g: 'bread', n: 16, word: 'Испечь' }, { g: 'sausage', n: 12, word: 'Накоптить' },
  { g: 'beer', n: 12, word: 'Сварить' }, { g: 'flour', n: 20, word: 'Смолоть' },
];

function coopVillageGold(n) {
  const st = Game.buildings.find(b => b.type === 'storehouse' && b.state === 'done');
  if (!st) return false;
  st.stock.gold = (st.stock.gold || 0) + n;
  return true;
}

function coopNewQuest() {
  const players = Math.max(1, coop.players.size);
  // берём товары, которые деревня уже производит (или базовые), чтобы заказ был выполним
  const opts = COOP_QUEST_POOL.filter(q => ['trunk', 'stone', 'timber'].includes(q.g) || (Game.produced[q.g] || 0) > 0);
  const q = opts[Math.floor(Math.random() * opts.length)] || COOP_QUEST_POOL[0];
  const need = Math.ceil(q.n * (1 + 0.2 * (players - 1)) / 2) * 2;
  coop.quest = { g: q.g, need, base: Game.produced[q.g] || 0, word: q.word, reward: 4 + 2 * players, until: 0, done: false };
  coop.out.push({ msg: { t: 'toast', text: `Заказ деревни: ${q.word.toLowerCase()} «${GOODS[q.g].name}» — ${need} шт. до вечера. Награда — золото на склад` } });
}

function coopQuestHave() { const q = coop.quest; return q ? Math.max(0, (Game.produced[q.g] || 0) - q.base) : 0; }

function coopVillageTick() {
  if (!coop.players.size) return;
  const night = isNightNow(), eve = isEveningNow();
  // вечер: считаем потери с этой точки; заказ, не выполненный за день, сгорает
  if (eve && !coop.prevEve) {
    coop.lostAtEve = Game.lostGnomes || 0;
    for (const u of coop.players.values()) { u.hero.nightFalls = 0; u.hero.eveIn = true; }
    const q = coop.quest;
    if (q && !q.done) { coop.out.push({ msg: { t: 'toast', text: `Заказ «${GOODS[q.g].name}» не выполнен: ${coopQuestHave()}/${q.need}. Завтра будет новый` } }); }
    coop.quest = null;
  }
  // рассвет: итоги ночи
  if (!night && coop.prevNight && coop.lostAtEve != null) {
    const lost = (Game.lostGnomes || 0) - coop.lostAtEve;
    coop.lostAtEve = null;
    coop.vil.nights++;
    const heroes = [...coop.players.values()];
    const star = heroes.slice().sort((a, b) => (a.hero.nightFalls || 0) - (b.hero.nightFalls || 0) || b.hero.hp - a.hero.hp)[0];
    if (lost <= 0) {
      coop.vil.streak++;
      coop.vil.best = Math.max(coop.vil.best, coop.vil.streak);
      const gold = Math.min(20, 2 + 2 * coop.vil.streak);
      const got = coopVillageGold(gold);
      for (const u of heroes) { u.hero.hp = u.hero.maxhp; if (coop.vil.streak >= 2) coopAddItem(u.hero, 'bread', Math.min(3, Math.floor(coop.vil.streak / 2))); }
      coop.out.push({ msg: { t: 'toast', text: `Ночь без потерь! Серия: ${coop.vil.streak}${coop.vil.streak >= coop.vil.best && coop.vil.streak > 1 ? ' — рекорд деревни' : ''}. ${got ? `+${gold} золота на склад, ` : ''}герои отдохнули` } });
    } else {
      const was = coop.vil.streak;
      coop.vil.streak = 0;
      coop.out.push({ msg: { t: 'toast', text: `Ночь унесла гномов: ${lost}.${was ? ` Серия из ${was} прервана.` : ''} Рекорд — ${coop.vil.best}` } });
    }
    if (star && heroes.length > 1) {
      coop.vil.hall[star.owner] = (coop.vil.hall[star.owner] || 0) + 1;
      coop.out.push({ msg: { t: 'toast', text: `Герой ночи: ${star.owner}${star.hero.nightFalls ? '' : ' — ни разу не упал'} (${coop.vil.hall[star.owner]} раз)` } });
    }
    coop.qDone = 0;
    coopDawn();
  }
  // рассвет/день без заказа — выдаём новый (но не вечером и не ночью)
  if (!coop.quest && !eve && !night && Game.time > 5) coopNewQuest();
  coop.prevNight = night; coop.prevEve = eve;
  try { coopQuestTick(night); } catch (e) { if (!coop.qErr) { coop.qErr = 1; console.log('квесты:', e.stack); } }
  const q = coop.quest;
  if (q && !q.done && coopQuestHave() >= q.need) {
    q.done = true; coop.qDone++;
    const got = coopVillageGold(q.reward);
    coop.out.push({ msg: { t: 'toast', text: `Заказ выполнен! «${GOODS[q.g].name}» ${q.need}/${q.need}.${got ? ` +${q.reward} золота на склад.` : ''}` } });
    for (const u of coop.players.values()) coopAddItem(u.hero, 'bread', 1);
    if (coop.qDone < 3) coop.quest = null;   // выполнил рано — добавочный заказ (до трёх за день)
  }
}

function coopVillageInfo() {
  const q = coop.quest;
  const c = cycleAt(Game.time);
  return {
    q: q ? { g: GOODS[q.g].name, w: q.word, have: Math.min(q.need, coopQuestHave()), need: q.need, done: q.done, rw: q.reward, left: Math.max(0, Math.round(EVE_START - c.p)) } : null,
    st: coop.vil.streak, best: coop.vil.best, nights: coop.vil.nights, hero: Object.entries(coop.vil.hall).sort((a, b) => b[1] - a[1]).slice(0, 3),
  };
}

function coopStateGet() {
  const cn = coop.cn;
  return JSON.stringify({ ...coop.vil, pq: coop.pairQ, pd: [...coop.pairDay], cnDay: coop.cnDay, cn: cn ? { ...cn, votes: [...cn.votes] } : null });
}
function coopStateSet(json) {
  try {
    const { pq, pd, cnDay, cn, ...vil } = JSON.parse(json);
    Object.assign(coop.vil, vil);
    if (!coop.vil.fr) coop.vil.fr = {};
    if (Array.isArray(pq)) coop.pairQ = pq;
    if (Array.isArray(pd)) coop.pairDay = new Map(pd);
    if (typeof cnDay === 'number') coop.cnDay = cnDay;
    if (cn && Array.isArray(cn.opts)) coop.cn = { ...cn, votes: new Map(cn.votes || []) };
  } catch (e) { /* пусто */ }
}

// Меню строительства для игроков открывается постепенно (как в одиночной игре), хост видит всё.
// Стадии считаются по уже построенному: так же и со старым миром.
function coopInitUnlocks() {
  Game.unlocked = { res: true };
  for (let ch = true; ch;) {
    ch = false;
    for (const st of UNLOCKS) if (!Game.unlocked[st.id] && unlockReady(st)) { Game.unlocked[st.id] = true; ch = true; }
  }
}

// ---------- Такт игроков ----------

function coopRespawn(u) {
  const H = u.hero;
  heroStopUnit(u);
  u.dead = false; u.brk = null; u.burn = null; u.injury = null; u.anim = null;
  const [x, y] = coopHome();
  u.x = x + 0.5; u.y = y + 0.5; u.food = Math.max(u.food, 0.6);
  H.hp = Math.round(H.maxhp * 0.5);
  H.drunkUntil = 0; H.stunUntil = 0; H.downT = 0; H.nightFalls = (H.nightFalls || 0) + 1;
  u.abfx = null; u.hfx = null; u.combatUntil = 0;
  coop.out.push({ msg: { t: 'toast', text: `${H.owner} приходит в себя у склада — деревня не отпускает так просто` } });
}

// Повержен: падает со звёздочками над головой, пару секунд лежит — потом приходит в себя у склада
const COOP_DOWN = 2.6;
function coopDown(u) {
  const H = u.hero;
  heroStopUnit(u);
  H.downT = Game.time + COOP_DOWN; H.stunUntil = H.downT; H.hp = Math.min(H.hp, 0);
  u.ouchUntil = H.downT;
  u.proc = (function* () { yield { wait: COOP_DOWN, anim: 'knocked' }; })();
  u.action = null;
  floater(u.x, u.y - 1.8, ['Повержен…', 'Ох…', 'Всё, лежу'][(Math.random() * 3) | 0], '#ff9a80');
}

function coopTick(dt) {
  coop.t += dt;
  const now = Game.time;
  for (const [name, u] of coop.players) {
    const H = u.hero;
    if (u.dead || !Game.unitMap.has(u.id)) {
      // героя убила беда (нечисть, ночь) — возвращаем
      const data = JSON.parse(coopHeroData(name));
      coop.players.delete(name);
      coopJoin(name, JSON.stringify({ ...data, hp: 0, x: null }));
      const nu = coop.players.get(name);
      if (nu) { nu.hero.hp = Math.round(nu.hero.maxhp * 0.5); nu.hero.nightFalls = (data.nf || 0) + 1; coop.out.push({ msg: { t: 'toast', text: `${name} падает без сил и снова стоит у склада` } }); }
      continue;
    }
    u.nextJoin = 1e9;
    if (H.downT) { if (now >= H.downT || u.inside) coopRespawn(u); continue; }
    // пьяная походка: управление сбито, шаги в случайные стороны
    if (H.drunkUntil > now && now >= H.drunkNext && !u.inside) {
      H.drunkNext = now + 0.6;
      if (Math.random() < 0.8) {
        const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 2;
        const tx = Math.floor(u.x + Math.cos(a) * r), ty = Math.floor(u.y + Math.sin(a) * r);
        if (isWalkable(tx, ty) && !World.door[idx(tx, ty)]) issueCmd(u, { kind: 'move', x: tx, y: ty, tx, ty, label: '' });
      }
    }
    if (H.drunkUntil && now >= H.drunkUntil) {
      H.drunkUntil = 0;
      heroStopUnit(u);
      H.stunUntil = now + COOP_FALL;
      u.proc = (function* () { yield { wait: COOP_FALL, anim: 'knocked' }; u.ouchUntil = Game.time + COOP_STARS; })();
      u.action = null;
    }
    if (H.stunUntil > now && u.cmd) u.cmd = null;
    coopAutoFight(u);
    // здоровье: беды деревни
    if (u.food <= 0) H.hp -= 0.5 * dt;
    else if (H.hp < H.maxhp && u.food > 0.25 && !(u.burn && u.burn.stage)) H.hp = Math.min(H.maxhp, H.hp + (typeof hlRegen === 'function' ? hlRegen(u) : 0.2) * dt);   // медленно: лечение — отдыхом (0.10.69)
    if (u.burn && u.burn.stage) H.hp -= 6 * dt;
    if (u.injury && u.injury !== H.seenInj) H.hp -= 8;
    H.seenInj = u.injury || null;
    const fly = u.anim === 'fly';
    if (fly && !H.seenFly) H.hp -= 5;
    H.seenFly = fly;
    if (H.hp <= 0) coopDown(u);
  }
  coop.vilT = (coop.vilT || 0) + dt;
  if (coop.vilT >= 1) { coop.vilT = 0; coopVillageTick(); }
  coop.lvT += dt;
  if (coop.lvT >= 2) {
    coop.lvT = 0;
    const L = heroLevelAt(heroTownScore());
    for (const u of coop.players.values()) if (L > u.hero.level) { u.hero.level = L; u.hero.maxhp = coopBaseHp(u.hero.clsKey, L); }
  }
}

{
  const _st = step;
  step = function (dt) { _st(dt); coopTick(dt); };
  heroTick = function () { };       // возрождение героев — у coopTick; общего героя нет
  ensureHero = function () { return false; };
  const _fl = floater;
  floater = function (x, y, text, col, icon) {
    _fl(x, y, text, col, icon);
    if (text && coop.out.length < 200) coop.out.push({ msg: { t: 'fl', x: +x.toFixed(2), y: +y.toFixed(2), text, col } });
  };
  const _ts = toast;
  toast = function (text, target) { _ts(text, target); if (text && coop.out.length < 200) coop.out.push({ msg: { t: 'toast', text: String(text) } }); };
}

// ---------- Снимки ----------

// Плоская копия состояния для клиентов: числа, строки, массивы и простые объекты; жители и здания — ссылкой по id
const COOP_SKIP = new Set(['path', 'proc', 'action', 'ref']);
const COOP_OP = Object.getPrototypeOf({});   // свой Object.prototype контекста (vm), а не хозяйский
const coopIds = new WeakMap();
let coopIdN = 1;
function coopPlain(v, d = 0, top = false) {
  if (v === null) return null;
  const t = typeof v;
  if (t === 'number') return isFinite(v) ? Math.round(v * 1000) / 1000 : 0;
  if (t === 'string' || t === 'boolean') return v;
  if (t !== 'object') return undefined;
  if (v instanceof Unit) return { __u: v.id };
  if (v instanceof Building) return { __b: v.id };
  if (Array.isArray(v)) {
    if (d > 3 || v.length > 300) return undefined;
    return v.map(x => { const p = coopPlain(x, d + 1); return p === undefined ? null : p; });
  }
  const pr = Object.getPrototypeOf(v);
  if (!top && pr !== COOP_OP && pr !== null) return undefined;
  if (d > 3) return undefined;
  const o = {};
  for (const k in v) { if (COOP_SKIP.has(k)) continue; const p = coopPlain(v[k], d + 1); if (p !== undefined) o[k] = p; }
  return o;
}
function coopList(arr) {
  const out = [];
  for (const o of arr || []) {
    if (!o || typeof o !== 'object') continue;
    let id = coopIds.get(o);
    if (!id) { id = coopIdN++; coopIds.set(o, id); }
    const p = coopPlain(o, 0, true);
    p.__id = id;
    out.push(p);
  }
  return out;
}
const COOP_UNIT_EX = ['slip', 'burn', 'lantern', 'knock', 'gest', 'gestFace', 'gestUntil', 'netUntil', 'umbrella', 'fleeUntil', 'panicUntil', 'fun', 'hangUntil', 'gp', 'brawl', 'mdr', 'ill', 'fam', 'kp', 'bah'];
const COOP_WX = ['k', 'target', 'bolt', 'scorch', 'fires', 'rainEnd', 'nextRain'];

// всё, что нечисть, ночь и погода держат вне жителей и клеток
function coopMirror() {
  const m = {
    ghosts: coopList(Game.ghosts), skels: coopList(Game.skels), ents: coopList(Game.ents), owls: coopList(Game.owls),
    bats: coopList(Game.bats), critters: coopList(Game.critters), falling: coopList(Game.falling), games: coopList(Game.games),
    lepr: typeof lepMirror === 'function' ? lepMirror() : [], neutrals: typeof neuMirror === 'function' ? neuMirror() : [], lairs: typeof neuMirrorLairs === 'function' ? neuMirrorLairs() : [],
    raiders: typeof foeMirrorRaiders === 'function' ? foeMirrorRaiders() : [], foeShots: typeof foeMirrorShots === 'function' ? foeMirrorShots() : [],
    foeZones: typeof foeMirrorZones === 'function' ? foeMirrorZones() : [],
    foe: typeof foeMirror === 'function' ? foeMirror() : null,
    sp: typeof spireMirrorOut === 'function' ? spireMirrorOut() : null,
    golem: Game.golem ? coopPlain(Game.golem, 0, true) : null,
    sub: Game.sub ? coopPlain(Game.sub, 0, true) : null,
    lost: Game.lostGnomes || 0, df: Game.diff,
    goal: typeof goalMirrorOut === 'function' ? goalMirrorOut() : null,
    trade: typeof tradeMirrorOut === 'function' ? tradeMirrorOut() : null,
    dil: typeof dilMirrorOut === 'function' ? dilMirrorOut() : null,
    trav: typeof travMirrorOut === 'function' ? travMirrorOut() : null,
    wgs: typeof wgsMirrorOut === 'function' ? wgsMirrorOut() : null,
    law: typeof lawMirrorOut === 'function' ? lawMirrorOut() : null,
    med: typeof medMirrorOut === 'function' ? medMirrorOut() : null,
    rsc: typeof rscMirrorOut === 'function' ? rscMirrorOut() : null,
    fam: typeof famMirrorOut === 'function' ? famMirrorOut() : null,
    fest: festOn() ? { on: true, until: Game.festival.until } : null,
    sea: typeof seaMirrorOut === 'function' ? seaMirrorOut() : null, wfx: coopList(Game.wfx), wild: coopList(Game.wild), fy: typeof fyMirrorOut === 'function' ? fyMirrorOut() : null,
    sl: typeof seaLifeMirrorOut === 'function' ? seaLifeMirrorOut() : null,
    wx: {},
  };
  for (const k of COOP_WX) m.wx[k] = coopPlain(WX[k]);
  return m;
}

// Тайлы: всё, что лежит на клетке (деревья, фонари, поля…), как есть, без служебной брони res
function coopTileObj(o) {
  if (!o) return null;
  const p = {};
  for (const k in o) { if (k === 'res') continue; const v = coopPlain(o[k], 1); if (v !== undefined) p[k] = v; }
  return p;
}
function coopAllObjs() {
  const a = [];
  for (let i = 0; i < N_TILES; i++) if (World.obj[i]) a.push([i, coopTileObj(World.obj[i])]);
  return a;
}


const r2 = v => Math.round(v * 100) / 100;

// ---------- Пакет жителей: дельта и интерес по камере ----------
// Раз в рассылку (coopUnitsBuild) все жители и звери сериализуются один раз: готовая строка JSON и подпись
// (без бегущего таймера действия — вместо него его конец). Новым клиентам (d:1) coopUnitsFor шлёт только записи,
// чья подпись изменилась с прошлой отправки этому клиенту: у камеры (+COOP_VIEW_PAD клеток) — сразу, дальних —
// не чаще раза в COOP_FAR с. Ушедших перечисляет ug/ag, а раз в COOP_IDS_EVERY с идёт полный список id (сверка).
// Тип, внешность и редко меняющееся из ex (семья, облик — COOP_UNIT_STATIC, в sx) шлются, только когда клиент видит
// жителя впервые или они поменялись (возраст в семье и прочие дробные числа сравниваются с точностью до целого).
// Зеркало (нечисть, погода…) — так же: списки по записям (ml — изменившиеся, mg — ушедшие, mids — состав;
// список — любой массив, где у всех записей есть __id, как от coopList),
// остальное (mo) — по ключам, когда поменялось. Лесных жителей вдали от камеры — реже, как и жителей;
// птиц, зверушек и прочие украшения — не чаще раза в COOP_DECOR_EVERY с (клиент всё равно доводит их плавно).
// Старые клиенты получают прежний полный пакет (coopUnitsPacket).
const COOP_FAR = 2, COOP_IDS_EVERY = 1, COOP_VIEW_PAD = 6, COOP_DECOR_EVERY = 0.4;
const COOP_MFAR = new Set(['neutrals', 'lairs']), COOP_MDECOR = new Set(['owls', 'bats', 'critters', 'falling', 'wfx']);
const COOP_UNIT_STATIC = ['fam', 'ap'];
const coopViews = new Map();      // ник → что этому клиенту уже отправлено
const coopU = { units: [], animals: [], live: new Set(), aLive: new Set(), uIds: '[]', aIds: '[]', mirObj: {}, ml: {}, mlIds: {}, mo: {}, moV: {}, moOnly: new Set(), time: 0 };

function coopUnitRec(u, now) {
  const a = u.action;
  const o = { i: u.id, x: r2(u.x), y: r2(u.y), f: u.face, v: u.vdir, fd: r2(u.food) };
  if (u.anim) o.a = u.anim;
  if (a && a.walk && a.path && !(a.block > 0 && !a.squeeze)) o.m = 1;
  if (a && a.T) o.aT = r2(a.T);
  if (u.carry) { o.c = u.carry; o.n = u.carryN || 1; }
  if (u.inside) o.in = u.inside.id;
  if (u.injury) o.inj = u.injury;
  if (u.drunkAt || (u.hero && u.hero.drunkUntil > now)) o.dr = 1;
  if (u.ouchUntil > now) o.ou = 1;
  let ex = null;
  for (const k of COOP_UNIT_EX) { const v = u[k]; if (v) (ex || (ex = {}))[k] = coopPlain(v, 1); }
  if (ex) o.ex = ex;
  if (u.owner) o.ow = u.owner;
  if (u.hero && u.owner) { o.hp = Math.round(u.hero.hp); o.mhp = u.hero.maxhp; o.cl = u.hero.clsKey; o.lv = u.hero.level; if (u.hero.title) o.tt = u.hero.title; }
  return o;
}

function coopUnitsBuild() {
  const now = Game.time, units = [], animals = [], live = new Set(), aLive = new Set();
  for (const u of Game.units) {
    if (u.dead) continue;
    const o = coopUnitRec(u, now), a = u.action, at = o.aT !== undefined ? r2(a.t) : undefined;
    let sx = null, d = o;
    if (o.ex) for (const k of COOP_UNIT_STATIC) if (o.ex[k] !== undefined) (sx || (sx = {}))[k] = o.ex[k];
    if (sx) { d = { ...o, ex: { ...o.ex } }; for (const k in sx) delete d.ex[k]; if (!Object.keys(d.ex).length) delete d.ex; }
    let dyn = JSON.stringify(d), sig = dyn;
    if (at !== undefined) { sig += '|' + Math.round((now + at) * 10); dyn = dyn.slice(0, -1) + ',"at":' + at + '}'; }
    const head = '"t":' + JSON.stringify(u.type) + ',"lk":' + JSON.stringify(u.look ?? null);
    const stat = sx ? head + ',"sx":' + JSON.stringify(sx) : head, statSig = sx ? head + JSON.stringify(sx, (k, v) => typeof v === 'number' ? Math.round(v) : v) : head;
    units.push({ id: u.id, x: u.x, y: u.y, hero: !!u.owner, o, at, type: u.type, look: u.look, statSig, sig, dyn, full: '{' + stat + ',' + dyn.slice(1) });
    live.add(u.id);
  }
  for (const a of Game.animals) {
    if (a.dead) continue;
    const s = JSON.stringify({ i: a.id, k: a.kind, x: r2(a.x), y: r2(a.y), f: a.face, m: a.moving ? 1 : 0, p: r2(a.phase), l: a.loot || undefined, s: a.state });
    animals.push({ id: a.id, x: a.x, y: a.y, s });
    aLive.add(a.id);
  }
  const mo = coopMirror(), ml = {}, mlIds = {};
  for (const k in mo) {
    // ключ, хоть раз пришедший не списком, так и шлём целиком — чтобы клиент не путался, откуда его обновлять
    const list = !coopU.moOnly.has(k) && Array.isArray(mo[k]) && mo[k].every(e => e && e.__id !== undefined);
    if (!list && Array.isArray(mo[k])) coopU.moOnly.add(k);
    if (list) {
      const ids = [];
      ml[k] = (mo[k] || []).map(e => { ids.push(e.__id); return { id: e.__id, x: e.x, y: e.y, s: JSON.stringify(e), live: null }; });
      ml[k].live = new Set(ids); mlIds[k] = JSON.stringify(ids);
    } else {
      if (mo[k] === undefined && !(k in coopU.mo)) continue;
      const v = JSON.stringify(mo[k] === undefined ? null : mo[k]);
      if (coopU.mo[k] !== v) { coopU.mo[k] = v; coopU.moV[k] = (coopU.moV[k] || 0) + 1; }
    }
  }
  Object.assign(coopU, { units, animals, live, aLive, time: now, builtAt: now, uIds: JSON.stringify([...live]), aIds: JSON.stringify([...aLive]), mirObj: mo, ml, mlIds });
}

// Полный пакет — для старых клиентов (без d:1 в auth). Сам пересобирает записи, если мир с прошлой сборки шагнул
// (сервер зовёт coopUnitsBuild перед рассылкой, тесты и прочие вызовы — сразу coopUnitsPacket)
function coopUnitsPacket() {
  if (coopU.builtAt !== Game.time) coopUnitsBuild();
  const us = coopU.units.map(r => JSON.stringify(Object.assign({ i: r.id, t: r.type, lk: r.look }, r.o, r.at !== undefined ? { at: r.at } : null)));
  return '{"t":"u","time":' + r2(coopU.time) + ',"units":[' + us.join(',') + '],"animals":[' + coopU.animals.map(r => r.s).join(',') + '],"mir":' + JSON.stringify(coopU.mirObj) + '}';
}

function coopViewDrop(name) { coopViews.delete(name); }

// Дельта для одного клиента; x0..y1 — клетки, которые он видит (NaN — камеры ещё нет, тогда всё «рядом»)
function coopUnitsFor(name, x0, y0, x1, y1) {
  if (coopU.builtAt !== Game.time) coopUnitsBuild();
  const now = coopU.time, P = COOP_VIEW_PAD, all = !(x1 >= x0 && y1 >= y0);
  let st = coopViews.get(name);
  if (!st) coopViews.set(name, st = { u: new Map(), a: new Map(), ml: {}, moV: {}, idsAt: -1e9 });
  const near = r => all || (r.x >= x0 - P && r.x <= x1 + P && r.y >= y0 - P && r.y <= y1 + P);
  const us = [], ug = [], an = [], ag = [];
  for (const r of coopU.units) {
    const prev = st.u.get(r.id);
    if (prev && prev.sig === r.sig && prev.stat === r.statSig) continue;
    if (prev && !r.hero && now - prev.at < COOP_FAR && !near(r)) continue;
    us.push(prev && prev.stat === r.statSig ? r.dyn : r.full);
    if (prev) { prev.sig = r.sig; prev.stat = r.statSig; prev.at = now; } else st.u.set(r.id, { sig: r.sig, stat: r.statSig, at: now });
  }
  for (const id of st.u.keys()) if (!coopU.live.has(id)) { st.u.delete(id); ug.push(id); }
  for (const r of coopU.animals) {
    const prev = st.a.get(r.id);
    if (prev && prev.s === r.s) continue;
    if (prev && now - prev.at < COOP_FAR && !near(r)) continue;
    an.push(r.s);
    if (prev) { prev.s = r.s; prev.at = now; } else st.a.set(r.id, { s: r.s, at: now });
  }
  for (const id of st.a.keys()) if (!coopU.aLive.has(id)) { st.a.delete(id); ag.push(id); }
  let out = '{"t":"u","d":1,"time":' + r2(now) + ',"units":[' + us.join(',') + '],"animals":[' + an.join(',') + ']';
  if (ug.length) out += ',"ug":' + JSON.stringify(ug);
  if (ag.length) out += ',"ag":' + JSON.stringify(ag);
  const ids = now - st.idsAt >= COOP_IDS_EVERY;
  if (ids) { st.idsAt = now; out += ',"ids":' + coopU.uIds + ',"aids":' + coopU.aIds; }
  // зеркало
  const ml = [], mg = [], mids = [], mo = [];
  for (const k in coopU.ml) {
    const L = coopU.ml[k];
    const seen = st.ml[k] || (st.ml[k] = new Map()), far = COOP_MFAR.has(k), decor = COOP_MDECOR.has(k), ups = [], gone = [];
    for (const r of L) {
      const prev = seen.get(r.id);
      if (prev && prev.s === r.s) continue;
      if (prev && far && now - prev.at < COOP_FAR && !near(r)) continue;
      if (prev && decor && now - prev.at < COOP_DECOR_EVERY) continue;
      ups.push(r.s);
      if (prev) { prev.s = r.s; prev.at = now; } else seen.set(r.id, { s: r.s, at: now });
    }
    for (const id of seen.keys()) if (!L.live.has(id)) { seen.delete(id); gone.push(id); }
    if (ups.length) ml.push('"' + k + '":[' + ups.join(',') + ']');
    if (gone.length) mg.push('"' + k + '":' + JSON.stringify(gone));
    if (ids) mids.push('"' + k + '":' + coopU.mlIds[k]);
  }
  for (const k in coopU.mo) if (st.moV[k] !== coopU.moV[k]) { st.moV[k] = coopU.moV[k]; mo.push('"' + k + '":' + coopU.mo[k]); }
  if (ml.length) out += ',"ml":{' + ml.join(',') + '}';
  if (mg.length) out += ',"mg":{' + mg.join(',') + '}';
  if (mids.length) out += ',"mids":{' + mids.join(',') + '}';
  if (mo.length) out += ',"mo":{' + mo.join(',') + '}';
  return out + '}';
}

function coopInitPacket(uid) {
  const s = serializeGame();
  s.units = [];
  return JSON.stringify({ t: 'init', world: s, ob: coopAllObjs(), uid, time: Game.time, nextId: Game.nextId });
}

// Разница мира с прошлой рассылкой: здания, объекты на клетках, дороги, стройки дорог, груды.
// Полный serializeGame здесь не нужен (он же вызывался раз в полсекунды и тормозил сервер):
// здания собираем по одному, а клетку переводим в JSON, только если её объект сменился или поменял поля.
function coopTileFlat(o) {   // плоский слепок полей клетки; null — есть вложенные объекты, сверять через JSON
  const f = [];
  for (const k in o) {
    if (k === 'res') continue;
    const v = o[k];
    if (v !== null && typeof v === 'object') return null;
    f.push(k, v);
  }
  return f;
}
function coopTileSame(o, f) {
  let j = 0;
  for (const k in o) {
    if (k === 'res') continue;
    if (f[j] !== k || f[j + 1] !== o[k]) return false;
    j += 2;
  }
  return j === f.length;
}
function coopWorldPacket() {
  const out = { t: 'w', time: r2(Game.time), nextId: Game.nextId };
  // здания; кадр анимации (an) меняется всё время — в подпись не входит, клиент крутит его сам
  const nb = new Map(), up = [];
  for (const b of Game.buildings) {
    const d = serializeBuilding(b);
    d.wk = b.working ? 1 : 0;
    const sig = JSON.stringify(d);
    d.an = r2(b.anim || 0);
    nb.set(d.id, sig);
    if (coop.shB.get(d.id) !== sig) up.push(d);
  }
  const rm = [];
  for (const id of coop.shB.keys()) if (!nb.has(id)) rm.push(id);
  coop.shB = nb;
  if (up.length) out.b = up;
  if (rm.length) out.bx = rm;
  // объекты на клетках целиком. shOr/shOf — объект клетки и его сырые поля при прошлой сверке (не изменились — клетку
  // пропускаем без JSON); shO — что ушло клиентам: округлённые поля плоского объекта или JSON сложного
  if (!coop.shOr || coop.shOr.length !== N_TILES) { coop.shOr = new Array(N_TILES).fill(null); coop.shOf = new Array(N_TILES).fill(null); coop.shO = new Array(N_TILES).fill(null); }
  const oc = [], ox = [], ref = coop.shOr, raw = coop.shOf, sent = coop.shO;
  for (let i = 0; i < N_TILES; i++) {
    const o = World.obj[i];
    if (!o) {
      if (sent[i] !== null) { ox.push(i); sent[i] = ref[i] = raw[i] = null; }
      continue;
    }
    if (ref[i] === o && raw[i] && coopTileSame(o, raw[i])) continue;
    const f = coopTileFlat(o);
    ref[i] = o; raw[i] = f;
    if (f) {
      const r = [];
      for (let j = 0; j < f.length; j += 2) { const v = coopPlain(f[j + 1], 1); if (v !== undefined) r.push(f[j], v); }
      const was = sent[i];
      if (Array.isArray(was) && was.length === r.length && was.every((v, j) => v === r[j])) continue;
      sent[i] = r;
      const p = {};
      for (let j = 0; j < r.length; j += 2) p[r[j]] = r[j + 1];
      oc.push([i, p]);
    } else {
      const p = coopTileObj(o), sig = JSON.stringify(p);
      if (sent[i] !== sig) { oc.push([i, p]); sent[i] = sig; }
    }
  }
  if (oc.length) out.o = oc;
  if (ox.length) out.ox = ox;
  // дороги: сверяем с копией посланной карты дорог
  if (!coop.shRa || coop.shRa.length !== N_TILES) { coop.shRa = new Uint8Array(N_TILES); }
  const ra = [], rx = [], road = World.road, sra = coop.shRa;
  for (let i = 0; i < N_TILES; i++) {
    const r = road[i] ? 1 : 0;
    if (r !== sra[i]) { sra[i] = r; (r ? ra : rx).push(i); }
  }
  if (ra.length) out.r = ra;
  if (rx.length) out.rx = rx;
  // стройки дорог и груды: целиком, если изменились
  const sbj = JSON.stringify(Game.storeBlock);
  if (sbj !== coop.shSB) { coop.shSB = sbj; out.sb = Game.storeBlock; }
  const rs = [...Game.roadSites.values()].map(q => ({ x: q.x, y: q.y, st: q.stock.stone || 0, dg: r2(q.dug || 0), pv: r2(q.pave || 0) }));
  const rsj = JSON.stringify(rs);
  if (rsj !== coop.shRS) { coop.shRS = rsj; out.rs = rs; }
  const pl = [...Game.piles.values()].filter(p => !p.removed).map(p => { const st = {}; for (const g of GOOD_KEYS) if (p.stock[g] > 0) st[g] = p.stock[g]; return { x: p.x, y: p.y, st }; });
  const plj = JSON.stringify(pl);
  if (plj !== coop.shP) { coop.shP = plj; out.pl = pl; }
  return out.b || out.bx || out.o || out.ox || out.r || out.rx || out.rs || out.pl || out.sb ? JSON.stringify(out) : null;
}

function coopMeData(name) {
  const u = coop.players.get(name);
  if (!u) return null;
  const H = u.hero;
  return JSON.stringify({ t: 'me', uid: u.id, cls: H.clsKey, clsName: H.cls, level: H.level, hp: Math.round(H.hp), mhp: H.maxhp, inv: H.inv, food: r2(u.food), vil: coopVillageInfo(), qx: coopQuestInfo(name), xp: H.xp || 0, tt: H.title || null });
}

function coopDrain() {
  const o = coop.out;
  coop.out = [];
  return JSON.stringify(o);
}

function coopSetDiff(k) {
  Game.diff = diffKey(k);
  return Game.diff;
}
function coopMeta() {
  return JSON.stringify({ classes: COOP_CLASSES, chat: COOP_CHAT, permLabels: COOP_PERMS, perms: coop.perms });
}

// ---------- Задания героев: личные, парные и «Совет деревни» ----------
// Личные: 3 слота в сутки на героя (H.quests, живёт в аккаунте вместе с героем), прогресс считает сервер по командам и позициям.
// Парные: двум игрокам онлайн, без новых механик; награда обоим и счётчик дружбы пары (vil.fr) — 5 совместных дают «Побратимов».
// Совет: раз в сутки утром 60 секунд голосуют за улучшение здания (или за открытие стадии меню, если она ещё закрыта).

const QDEF = {
  tavern:   { name: 'Поесть в трактире',              need: 2,  xp: 20, item: ['sausage', 1], title: [5, 'Завсегдатай'] },
  road:     { name: 'Проложить 15 клеток дороги',     need: 15, xp: 25, item: ['bread', 2],   title: [3, 'Дорожник'] },
  field:    { name: 'Разметить 6 клеток полей',       need: 6,  xp: 20, item: ['bread', 2] },
  build:    { name: 'Построить здание',               need: 1,  xp: 25, item: ['steak', 1],   title: [3, 'Строитель'] },
  night:    { name: 'Пережить ночь, ни разу не упав', need: 1,  xp: 40, item: ['chickenleg', 1], title: [3, 'Ночной сторож'] },
  far:      { name: 'Дойти до дальней точки',         need: 1,  xp: 30, item: ['sausage', 2] },
  foes:     { name: 'Отбить 3 нечисти',               need: 3,  xp: 45, item: ['steak', 2],   title: [3, 'Защитник'] },
  lamps:    { name: 'Зажечь 3 погасших фонаря',       need: 3,  xp: 40, item: ['sausage', 2], title: [3, 'Хранитель огня'] },
  grow:     { name: 'Вырастить 4 клетки поля',        need: 4,  xp: 40, item: ['bread', 3],   title: [2, 'Садовод'] },
  treasure: { name: 'Найти спрятанный клад',          need: 1,  xp: 45, item: ['steak', 2],   cls: 'rogue', title: [2, 'Кладоискатель'] },
};
const PDEF = {
  tandem: { name: 'Тандем-ночь', text: 'Дожить до рассвета, держась рядом (≤6 клеток), и ни разу не упасть' },
  levers: { name: 'Два рычага',  text: 'Двоим одновременно постоять у двух меток 5 секунд' },
  toast:  { name: 'Тост',        text: 'Выпить пива в трактире вдвоём, с разницей не больше 30 секунд' },
  // по ролям Клятв (oaths.js, КЛАССЫ.md): выдаются, только если роли пары подходят
  shield: { name: 'Щит и свеча',  text: 'Танк и лекарь: ночью продержаться вдвоём у большого костра (≤8 клеток) минуту и не упасть' },
  trail:  { name: 'Тропа и тень', text: 'Разведчик ведёт: дойти вдвоём до старого клада по метке на карте — золото в казну' },
  song:   { name: 'Песня и меч',  text: 'Саппорт и урон: каждому применить по два приёма, пока напарник рядом (≤6 клеток)' },
};
// роли героя из его Клятвы: танк, лекарь, разведчик, урон, саппорт
const coopRole = (u, r) => !!(typeof OATHS !== 'undefined' && OATHS[u.hero.clsKey] && OATHS[u.hero.clsKey].role.includes(r));
const coopRoles2 = (a, b, r1, r2) => (coopRole(a, r1) && coopRole(b, r2)) || (coopRole(a, r2) && coopRole(b, r1));
const COOP_SONG_N = 2, COOP_SHIELD_T = 60, COOP_TRAIL_GOLD = 3;
const COOP_PAIR_XP = 40, COOP_BROTHERS = 5, COOP_COUNCIL_SEC = 60;
const coopDayIx = () => cycleAt(Game.time).k;
const coopDayP = () => cycleAt(Game.time).p;
const coopFrKey = (a, b) => [a, b].sort().join('|');
const coopDist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function coopGiveTitle(H, t) {
  if (H.titles.includes(t)) return;
  H.titles.push(t); H.title = t;
  coopSay(H.owner, `Новый титул: «${t}»!`);
  coop.out.push({ msg: { t: 'toast', text: `${H.owner} получает титул «${t}»` } });
}

function coopGiveXp(H, n) {
  H.xp = (H.xp || 0) + n;
  while (H.level < HERO_LVL_MAX && H.xp >= 50 * H.level) {
    H.xp -= 50 * H.level; H.level++; H.maxhp = coopBaseHp(H.clsKey, H.level);
    coopSay(H.owner, `Уровень героя: ${H.level}`);
  }
}

function coopReward(H, xp, item) {
  coopGiveXp(H, xp);
  if (item && !coopAddItem(H, item[0], item[1])) coopSay(H.owner, 'Рюкзак полон — награда предметом пропала');
}

// ---- личные ----

function coopFarPoint() {
  const st = Game.buildings.find(b => b.type === 'storehouse') || Game.buildings[0];
  const cx = st ? st.doorX : MAP_W / 2, cy = st ? st.doorY : MAP_H / 2;
  let best = null, bd = -1;
  for (let k = 0; k < 90; k++) {
    const x = 3 + Math.floor(Math.random() * (MAP_W - 6)), y = 3 + Math.floor(Math.random() * (MAP_H - 6));
    if (!isWalkable(x, y)) continue;
    const d = Math.hypot(x - cx, y - cy);
    if (d > bd && d <= 55) { bd = d; best = [x, y]; }
    if (d >= 35 && d <= 55) return [x, y];
  }
  return best;
}

function coopTreasurePoint() {
  const st = Game.buildings.find(b => b.type === 'storehouse') || Game.buildings[0];
  const cx = st ? st.doorX : 40, cy = st ? st.doorY : 30;
  for (let k = 0; k < 60; k++) {
    const a = Math.random() * Math.PI * 2, r = 12 + Math.random() * 22;
    const x = Math.floor(cx + Math.cos(a) * r), y = Math.floor(cy + Math.sin(a) * r);
    if (inb(x, y) && isWalkable(x, y)) return [x, y];
  }
  return null;
}

function coopMakeQuests(H) {
  const k = coopDayIx(), day = coopDayP() < EVE_START;
  const pool = ['tavern', 'road', 'field', 'build', 'far'];
  if (day) pool.push('night');
  if (QCLS[H.clsKey]) pool.push(QCLS[H.clsKey], QCLS[H.clsKey]);
  const list = [];
  while (list.length < 3 && pool.length) {
    const id = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    if (list.some(q => q.id === id)) continue;
    const q = { id, n: 0, need: QDEF[id].need, done: false };
    if (id === 'grow') { q.cells = []; q.seen = []; }
    if (id === 'far') { const p = coopFarPoint(); if (!p) continue; q.x = p[0]; q.y = p[1]; }
    if (id === 'treasure') { const p = coopTreasurePoint(); if (!p) continue; q.x = p[0]; q.y = p[1]; }
    list.push(q);
  }
  H.quests = { day: k, list };
  coopSay(H.owner, 'Новые задания дня — смотри список справа');
}

function coopQDone(H, q) {
  const d = QDEF[q.id];
  q.done = true; q.n = q.need;
  coopReward(H, d.xp, d.item);
  H.qstat[q.id] = (H.qstat[q.id] || 0) + 1;
  coopSay(H.owner, `Задание выполнено: «${d.name}» (+${d.xp} опыта)`);
  if (d.title && H.qstat[q.id] >= d.title[0]) coopGiveTitle(H, d.title[1]);
}

function coopQEvent(H, id, n = 1) {
  const q = H.quests && H.quests.list.find(x => x.id === id && !x.done);
  if (!q) return;
  q.n = Math.min(q.need, q.n + n);
  if (q.n >= q.need) coopQDone(H, q);
}

function coopCompass(dx, dy) {
  const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return ['восток', 'юго-восток', 'юг', 'юго-запад', 'запад', 'северо-запад', 'север', 'северо-восток'][((a % 8) + 8) % 8];
}

function coopDawn() {
  coop.lampDawn = true;
  for (const u of coop.players.values()) {
    const H = u.hero;
    if (H.eveIn && !(H.nightFalls > 0)) coopQEvent(H, 'night');
    H.eveIn = false;
  }
  for (const p of coop.pairQ) {
    if (p.kind !== 'tandem' || p.done) continue;
    const ua = coop.players.get(p.a), ub = coop.players.get(p.b);
    if (ua && ub && p.tog >= 90 && !(ua.hero.nightFalls > 0) && !(ub.hero.nightFalls > 0)) coopPairDone(p);
    else if (ua && ub && p.armed) { p.done = true; coopSay(p.a, 'Тандем-ночь не вышла — вместе мало, или кто-то падал'); coopSay(p.b, 'Тандем-ночь не вышла — вместе мало, или кто-то падал'); }
  }
}

// ---- парные ----

function coopWantsToast(H) { return coop.pairQ.some(p => p.kind === 'toast' && !p.done && (p.a === H.owner || p.b === H.owner)); }

function coopToastDrink(H) {
  for (const p of coop.pairQ) {
    if (p.kind !== 'toast' || p.done || (p.a !== H.owner && p.b !== H.owner)) continue;
    p.t[H.owner] = Game.time;
    const other = p.a === H.owner ? p.b : p.a;
    if (p.t[other] != null && Game.time - p.t[other] <= 30) coopPairDone(p);
    else coopSay(other, `${H.owner} пьёт в трактире — присоединяйся за 30 секунд!`);
  }
}

// «Песня и меч»: приём героя засчитывается, если напарник рядом (зовёт oaths.js после удачного приёма)
function coopPairAbil(u) {
  const name = u.hero && u.hero.owner;
  if (!name) return;
  for (const p of coop.pairQ) {
    if (p.kind !== 'song' || p.done || (p.a !== name && p.b !== name)) continue;
    const o = coop.players.get(p.a === name ? p.b : p.a);
    if (!o || coopDist(u, o) > 6 || (p.t[name] || 0) >= COOP_SONG_N) continue;
    p.t[name] = (p.t[name] || 0) + 1;
    if (p.t[p.a] >= COOP_SONG_N && p.t[p.b] >= COOP_SONG_N) coopPairDone(p);
    else coopSay(o.hero.owner, `${name} применил приём рядом: ${p.t[name]}/${COOP_SONG_N}`);
  }
}

function coopPairDone(p) {
  p.done = true;
  const key = coopFrKey(p.a, p.b);
  const n = coop.vil.fr[key] = (coop.vil.fr[key] || 0) + 1;
  for (const name of [p.a, p.b]) {
    const u = coop.players.get(name);
    if (!u) continue;
    coopReward(u.hero, COOP_PAIR_XP, ['sausage', 1]);
    coopSay(name, `Парное задание «${PDEF[p.kind].name}» выполнено! (+${COOP_PAIR_XP} опыта) Побратимство: ${Math.min(n, COOP_BROTHERS)}/${COOP_BROTHERS}`);
  }
  if (n >= COOP_BROTHERS) { coopCheckBrothers({ owner: p.a }); coopCheckBrothers({ owner: p.b }); }
}

function coopCheckBrothers(H) {
  const u = coop.players.get(H.owner);
  if (!u) return;
  for (const k in coop.vil.fr) if (coop.vil.fr[k] >= COOP_BROTHERS && k.split('|').includes(H.owner)) { coopGiveTitle(u.hero, 'Побратимы'); break; }
}

function coopMakePair() {
  const free = [...coop.players.values()].filter(u => !coop.pairQ.some(p => !p.done && (p.a === u.owner || p.b === u.owner)));
  if (free.length < 2) return;
  free.sort((x, y) => x.hero.level - y.hero.level);
  const k = coopDayIx();
  let best = null, bd = 1e9;
  for (let i = 0; i + 1 < free.length; i++) {
    const a = free[i], b = free[i + 1], key = coopFrKey(a.owner, b.owner);
    if (coop.pairDay.get(key) === k) continue;
    const d = Math.abs(a.hero.level - b.hero.level);
    if (d < bd) { bd = d; best = [a, b]; }
  }
  if (!best) return;
  const [a, b] = best, early = coopDayP() < EVE_START - 40;
  const kinds = early ? ['tandem', 'levers'] : ['levers'];
  if (Game.buildings.some(x => x.type === 'inn' && x.state === 'done')) kinds.push('toast');
  // задания по ролям — вдвое чаще остальных, когда пара подходит
  if (early && coopRoles2(a, b, 'танк', 'лекарь') && Game.buildings.some(x => x.type === 'bonfire' && x.state === 'done')) kinds.push('shield', 'shield');
  if (coopRole(a, 'разведчик') || coopRole(b, 'разведчик')) kinds.push('trail', 'trail');
  if (coopRoles2(a, b, 'саппорт', 'урон')) kinds.push('song', 'song');
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  const p = { kind, a: a.owner, b: b.owner, k, done: false, prog: 0, tog: 0, t: {}, armed: false };
  if (kind === 'trail') { const c = coopTreasurePoint(); if (!c) return; p.pts = [c]; }
  if (kind === 'song') p.t = { [p.a]: 0, [p.b]: 0 };
  if (kind === 'levers') {
    const st = Game.buildings.find(x => x.type === 'storehouse') || Game.buildings[0];
    const cx = st ? st.doorX : 40, cy = st ? st.doorY + 2 : 30;
    const ok = (x, y) => isWalkable(x, y) && !World.door[idx(x, y)];
    const A = randomFreeNear(cx, cy, 3, 8, ok);
    let B = null;
    for (let i = 0; i < 25 && A; i++) { const c = randomFreeNear(cx, cy, 3, 9, ok); if (c && Math.hypot(c[0] - A[0], c[1] - A[1]) >= 5) { B = c; break; } }
    if (!A || !B) return;
    p.pts = [A, B];
  }
  coop.pairQ.push(p);
  coop.pairDay.set(coopFrKey(p.a, p.b), k);
  for (const nm of [p.a, p.b]) coopSay(nm, `Парное задание с ${nm === p.a ? p.b : p.a}: «${PDEF[p.kind].name}» — ${PDEF[p.kind].text}`);
}

function coopPairTick(night) {
  const k = coopDayIx();
  coop.pairQ = coop.pairQ.filter(p => p.k === k);
  for (const p of coop.pairQ) {
    if (p.done) continue;
    const ua = coop.players.get(p.a), ub = coop.players.get(p.b);
    if (!ua || !ub) continue;     // один вышел — квест ждёт до конца суток
    if (p.kind === 'tandem') {
      if (night && coopDist(ua, ub) <= 6 && !ua.inside && !ub.inside) { p.tog++; p.armed = true; }
    } else if (p.kind === 'levers') {
      const [A, B] = p.pts, at = (u, c) => Math.hypot(u.x - (c[0] + 0.5), u.y - (c[1] + 0.5)) <= 1.4;
      if ((at(ua, A) && at(ub, B)) || (at(ua, B) && at(ub, A))) { p.prog++; if (p.prog >= 5) coopPairDone(p); }
      else p.prog = 0;
    } else if (p.kind === 'shield') {
      // у костра вдвоём ночью; упал кто-то — задание сгорело
      if (ua.hero.nightFalls > 0 || ub.hero.nightFalls > 0) { if (p.armed) { p.done = true; for (const nm of [p.a, p.b]) coopSay(nm, '«Щит и свеча» не вышло: кто-то упал'); } continue; }
      if (night && !ua.inside && !ub.inside && nearBonfire(ua.x, ua.y, 8) && nearBonfire(ub.x, ub.y, 8)) { p.tog++; p.armed = true; if (p.tog >= COOP_SHIELD_T) coopPairDone(p); }
    } else if (p.kind === 'trail') {
      const [C] = p.pts, at = u => Math.hypot(u.x - (C[0] + 0.5), u.y - (C[1] + 0.5)) <= 1.6;
      if (at(ua) && at(ub)) {
        const got = coopVillageGold(COOP_TRAIL_GOLD);
        floater(C[0] + 0.5, C[1] - 0.5, got ? `Клад! +${COOP_TRAIL_GOLD} золота` : 'Клад!', '#ffe070');
        coopPairDone(p);
      }
    }
  }
  if (coop.players.size >= 2 && !night && coopDayP() < EVE_START - 20 && coopDayP() > 6) coopMakePair();
}

// ---- Совет деревни ----

function coopCouncilOpen() {
  const k = coopDayIx();
  const locked = UNLOCKS.filter(s => !Game.unlocked[s.id]);
  const ups = [], seen = new Set();
  for (const b of Game.buildings) if (canUpgrade(b) && !b.upg && !seen.has(b.type)) { seen.add(b.type); ups.push({ type: b.type, l: b.def.name }); }
  let cn = null;
  if (locked.length && (k % 2 === 1 || !ups.length)) {
    cn = { kind: 'unlock', q: 'Что открыть в меню строительства?', opts: locked.slice(0, 4).map(s => ({ id: s.id, l: UNLOCK_NAMES[s.id] || s.id })) };
  } else if (ups.length) {
    ups.sort(() => Math.random() - 0.5);
    cn = { kind: 'upgrade', q: 'Какое здание улучшить до уровня 2?', opts: ups.slice(0, 4) };
  }
  if (!cn) return;
  cn.votes = new Map(); cn.until = Game.time + COOP_COUNCIL_SEC;
  coop.cn = cn;
  coop.out.push({ msg: { t: 'toast', text: `Совет деревни: ${cn.q} Голосуем ${COOP_COUNCIL_SEC} секунд` } });
}

function coopVote(name, i) {
  const cn = coop.cn;
  if (!cn || i < 0 || i >= cn.opts.length) return;
  cn.votes.set(name, i);
}

function coopCouncilClose() {
  const cn = coop.cn;
  coop.cn = null;
  const cnt = cn.opts.map(() => 0);
  for (const [nm, i] of cn.votes) if (coop.players.has(nm)) cnt[i]++;
  const top = Math.max(...cnt);
  if (top <= 0) { coop.out.push({ msg: { t: 'toast', text: 'Совет деревни: никто не проголосовал, всё остаётся как есть' } }); return; }
  const win = cnt.map((n, i) => n === top ? i : -1).filter(i => i >= 0);
  const o = cn.opts[win[Math.floor(Math.random() * win.length)]];
  if (cn.kind === 'upgrade') {
    const b = Game.buildings.find(x => x.type === o.type && canUpgrade(x) && !x.upg);
    if (b && startUpgrade(b)) coop.out.push({ msg: { t: 'toast', text: `Совет решил: улучшить «${o.l}» (голосов: ${top})` } });
    else coop.out.push({ msg: { t: 'toast', text: `Совет выбрал «${o.l}», но улучшить его уже нельзя` } });
  } else {
    Game.unlocked[o.id] = true;
    coop.out.push({ msg: { t: 'unlock', id: o.id } });
    coop.out.push({ msg: { t: 'toast', text: `Совет решил: открыть в меню «${o.l}» (голосов: ${top})` } });
  }
}

function coopCouncilTick() {
  const cn = coop.cn;
  if (cn) {
    const online = [...coop.players.keys()];
    if (!online.length || Game.time >= cn.until || online.every(n => cn.votes.has(n))) coopCouncilClose();
    return;
  }
  const k = coopDayIx(), p = coopDayP();
  if (coop.cnDay === k || !coop.players.size || p < 8 || p > EVE_START - 70) return;
  coop.cnDay = k;
  if (coop.perms.council && coop.perms.upgrade) coopCouncilOpen();
}

// ---- такт и данные для клиента ----

function coopQuestTick(night) {
  const k = coopDayIx();
  for (const u of coop.players.values()) {
    const H = u.hero;
    if (!H.quests || H.quests.day !== k) coopMakeQuests(H);
    const gq = H.quests.list.find(q => q.id === 'grow' && !q.done);
    if (gq) coopGrowTick(u, gq);
    for (const q of H.quests.list) {
      if (q.done || (q.id !== 'far' && q.id !== 'treasure')) continue;
      if (Math.hypot(u.x - (q.x + 0.5), u.y - (q.y + 0.5)) <= (q.id === 'far' ? 2 : 1.3)) coopQEvent(H, q.id);
    }
  }
  coopPairTick(night);
  coopCouncilTick();
  const dawn = coop.lampDawn; coop.lampDawn = false;
  coopLampTick(night, dawn);
  checkUnlocks();
}

function coopQuestInfo(name) {
  const u = coop.players.get(name);
  if (!u) return null;
  const H = u.hero, out = { q: [], ti: H.titles || [] };
  for (const q of (H.quests && H.quests.list) || []) {
    const o = { id: q.id, t: QDEF[q.id].name, n: q.n, need: q.need, d: q.done ? 1 : 0 };
    if (!q.done && (q.id === 'far' || q.id === 'treasure')) {
      const dx = q.x + 0.5 - u.x, dy = q.y + 0.5 - u.y, d = Math.hypot(dx, dy);
      if (q.id === 'far') { o.x = q.x; o.y = q.y; o.h = `${Math.round(d)} кл., на ${coopCompass(dx, dy)}`; }
      else o.h = d < 8 ? 'горячо!' : d < 18 ? 'тепло' : 'холодно';
    }
    out.q.push(o);
  }
  const p = coop.pairQ.find(x => x.a === name || x.b === name);
  if (p) {
    const other = p.a === name ? p.b : p.a;
    out.p = { t: PDEF[p.kind].name, x: PDEF[p.kind].text, w: other, d: p.done ? 1 : 0, on: coop.players.has(other) ? 1 : 0, fr: Math.min(COOP_BROTHERS, coop.vil.fr[coopFrKey(name, other)] || 0) };
    if (p.pts && !p.done) out.p.pts = p.pts;
    if (p.kind === 'tandem' && !p.done) out.p.prog = Math.min(100, Math.round(100 * p.tog / 90));
    if (p.kind === 'levers' && !p.done) out.p.prog = p.prog * 20;
    if (p.kind === 'shield' && !p.done) out.p.prog = Math.min(100, Math.round(100 * p.tog / COOP_SHIELD_T));
    if (p.kind === 'song' && !p.done) out.p.prog = Math.round(100 * (Math.min(COOP_SONG_N, p.t[p.a] || 0) + Math.min(COOP_SONG_N, p.t[p.b] || 0)) / (2 * COOP_SONG_N));
    if (p.kind === 'trail' && !p.done) { const C = p.pts[0], d = Math.hypot(C[0] + 0.5 - u.x, C[1] + 0.5 - u.y); out.p.x += ` · ${Math.round(d)} кл., на ${coopCompass(C[0] + 0.5 - u.x, C[1] + 0.5 - u.y)}`; }
  }
  const cn = coop.cn;
  if (cn) out.c = { q: cn.q, o: cn.opts.map(o => o.l), v: cn.opts.map((_, i) => [...cn.votes.values()].filter(x => x === i).length), left: Math.max(0, Math.round(cn.until - Game.time)), my: cn.votes.has(name) ? cn.votes.get(name) : -1 };
  return out;
}


// ---------- Бой, фонари и поля героев ----------

const QCLS = { warrior: 'foes', barbarian: 'foes', monk: 'foes', paladin: 'foes', archer: 'foes', mage: 'lamps', druid: 'grow', rogue: 'treasure' };
const coopCellX = i => i % MAP_W + 0.5, coopCellY = i => Math.floor(i / MAP_W) + 0.5;

function coopFieldPlanted(H, i) {
  const q = H.quests && H.quests.list.find(x => x.id === 'grow' && !x.done);
  if (q && q.cells.length < 12 && !q.cells.includes(i)) q.cells.push(i);
}

// Друид: рядом с его всходами растёт быстрее; созревшая клетка засчитывается один раз
function coopGrowTick(u, q) {
  for (const i of q.cells) {
    const o = World.obj[i];
    if (!o || o.t !== 'field' || q.seen.includes(i)) continue;
    if (o.g >= 1) { q.seen.push(i); coopQEvent(u.hero, 'grow'); floater(coopCellX(i), coopCellY(i) - 0.5, 'Созрело!', '#b8e060'); continue; }
    if (o.g >= 0 && Math.hypot(u.x - coopCellX(i), u.y - coopCellY(i)) <= 3) { o.g = Math.min(1, o.g + 0.04); World.growing.add(i); }
  }
}

// Фонари гаснут ночью, рассвет зажигает все. Герой, проходя рядом, зажигает погасший своим фонарём.
function coopLampTick(night, dawn) {
  if (!coop.lamps || Game.time > coop.lampsAt) {
    coop.lamps = []; coop.lampsAt = Game.time + 6;
    for (let i = 0; i < N_TILES; i++) { const o = World.obj[i]; if (o && o.t === 'lamp' && (o.born === undefined || Game.time - o.born > GROW_T)) coop.lamps.push(i); }
  }
  const L = coop.lamps;
  if (dawn) { for (const i of L) { const o = World.obj[i]; if (o && o.out) o.out = false; } return; }
  if (night && L.length) {
    const out = L.filter(i => World.obj[i] && World.obj[i].out).length;
    if (out < L.length * 0.6 && Math.random() < 0.3) {
      const i = L[Math.floor(Math.random() * L.length)], o = World.obj[i];
      if (o && !o.out) { o.out = true; floater(coopCellX(i), coopCellY(i) - 1, 'Фонарь погас', '#b0a890'); }
    }
  }
  if (!night && !isEveningNow()) return;
  for (const u of coop.players.values()) {
    if (u.hero.stunUntil > Game.time || u.inside) continue;
    for (const i of L) {
      const o = World.obj[i];
      if (!o || !o.out || Math.hypot(u.x - coopCellX(i), u.y - coopCellY(i)) > 2.3) continue;
      o.out = false;
      floater(coopCellX(i), coopCellY(i) - 1, `${u.owner} зажёг фонарь`, '#ffd070');
      coopQEvent(u.hero, 'lamps');
    }
  }
}

// Герой без дела сам отбивается от нечисти поблизости
function coopAutoFight(u) {
  const H = u.hero;
  if (u.cmd || u.inside || H.stunUntil > Game.time || H.drunkUntil > Game.time || (H.fightCd || 0) > Game.time) return;
  const f = foesNear(u.x, u.y, 3)[0];
  if (!f) return;
  H.fightCd = Game.time + 1.5;
  issueCmd(u, { kind: 'foe', f, tx: Math.floor(f.o.x), ty: Math.floor(f.o.y), label: 'Бой' });
}
