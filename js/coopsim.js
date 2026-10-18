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
  field: 'Размечать поля', upgrade: 'Улучшать здания', manage: 'Паузы, доставки, рецепты, склад', train: 'Обучать жителей', chat: 'Чат',
};
const COOP_INV = 10;
const COOP_DRUNK = 5, COOP_FALL = 1, COOP_STARS = 4;

const coop = {
  players: new Map(),         // ник -> герой (Unit)
  out: [],                    // события для рассылки: { to?, msg }
  shB: new Map(), shO: new Map(), shR: new Set(), shRS: '', shP: '', shSB: '',
  t: 0, lvT: 0,
  perms: Object.fromEntries(Object.keys(COOP_PERMS).map(k => [k, true])),
  // общая жизнь: ночи без потерь и заказы деревни (сохраняются отдельным файлом сервера)
  vil: { streak: 0, best: 0, nights: 0, hall: {} },
  quest: null, qDone: 0, prevNight: false, prevEve: false, lostAtEve: null,
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
  const cls = COOP_CLASSES[d.cls] ? d.cls : 'warrior';
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
  H.maxhp = coopBaseHp(cls, level);
  H.hp = d.hp > 0 ? Math.min(d.hp, H.maxhp) : H.maxhp;
  H.inv = Array.from({ length: COOP_INV }, (_, i) => (d.inv && d.inv[i]) || null);
  u.hero = H;
  coop.players.set(name, u);
  coop.out.push({ msg: { t: 'toast', text: `${name} (${H.cls}) приходит в деревню` } });
  return u.id;
}

function coopHeroData(name) {
  const u = coop.players.get(name);
  if (!u) return null;
  const H = u.hero;
  return JSON.stringify({ cls: H.clsKey, level: H.level, hp: Math.round(H.hp), inv: H.inv, x: u.x, y: u.y, food: u.food, look: u.look, nf: H.nightFalls || 0 });
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
  const fv = { bread: 0.45, sausage: 0.55, chickenleg: 0.6, steak: 0.65, croissant: 0.5 }[s.k];
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
    if (u.food >= 0.85 && coopAddItem(H, food, 1)) floater(u.x, u.y - 1.6, 'Взял с собой', '#ffe8a0');
    else u.food = Math.max(u.food, Math.min(1.3, u.food + (food === 'chickenleg' ? 0.6 : food === 'steak' ? 0.65 : 0.45)));
    H.hp = Math.min(H.maxhp, H.hp + H.maxhp * 0.15);
  }
  if (Math.random() < 0.4) {
    yield { wait: 2 };
    if (!inn.removed) {
      if (inn.stock.beer > 0) inn.stock.beer--;
      u.food = Math.min(1.3, u.food + 0.15);
      H.drunkUntil = Game.time + COOP_DRUNK;
      H.drunkNext = Game.time;
      floater(u.x, u.y - 1.6, 'Ик!', '#ffe070');
    }
  }
  yield { leave: true };
}

{
  const _rc = runCmd;
  runCmd = function* (u, c) {
    if (c.kind === 'tavern') yield* tavernGen(u, c);
    else yield* _rc(u, c);
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
  if (b && !b.isRoad && b.type === 'inn' && b.state === 'done' && !b.upg) c = { kind: 'tavern', b, tx: b.doorX, ty: b.doorY, label: 'Поесть' };
  else c = resolveCmd([x, y]);
  if (!c) { coopSay(H.owner, 'Сюда не пройти'); return; }
  issueCmd(u, c);
}

const coopInt = v => Number.isInteger(v);

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
    case 'use': if (u && coopInt(m.slot) && m.slot >= 0 && m.slot < COOP_INV) coopUseItem(u, m.slot); break;
    case 'drop': if (u && coopInt(m.slot) && u.hero.inv[m.slot]) u.hero.inv[m.slot] = null; break;
    case 'chat': {
      if (!can('chat')) break;
      const text = COOP_CHAT[m.i];
      if (!text) break;
      coop.out.push({ msg: { t: 'chat', from: name, text, uid: u ? u.id : 0 } });
      break;
    }
    case 'build': {
      if (!can('build')) break;
      if (!BUILDINGS[m.type] || !coopInt(m.x) || !coopInt(m.y)) break;
      const rot = m.rot === 1 || m.rot === 2 ? m.rot : 0;
      const err = checkPlacement(m.type, m.x, m.y, rot);
      if (err) { coopSay(name, err); break; }
      placeBuilding(m.type, m.x, m.y, false, rot);
      break;
    }
    case 'bact': {
      const need = { demolish: 'erase', upgrade: 'upgrade', upgcancel: 'upgrade', train: 'train', untrain: 'train', hire: 'train' }[m.act] || 'manage';
      if (can(need)) coopBuildingAct(name, m);
      break;
    }
    case 'qt': {
      if (can('train') && UNIT_TYPES[m.type] && !UNIT_TYPES[m.type].animal && !UNIT_TYPES[m.type].legacy) queueTraining(m.type);
      break;
    }
    case 'field': {
      if (!can('field')) break;
      if (!Array.isArray(m.cells) || !['add', 'del'].includes(m.mode)) break;
      for (const c of m.cells.slice(0, 80)) {
        if (!Array.isArray(c) || !coopInt(c[0]) || !coopInt(c[1]) || !inb(c[0], c[1])) continue;
        if (m.mode === 'del') removeField(c[0], c[1]);
        else if (['wheat', 'hay', 'hops'].includes(m.crop)) planField(c[0], c[1], m.crop);
      }
      break;
    }
    case 'road': {
      if (!can('road')) break;
      if (!Array.isArray(m.cells)) break;
      for (const c of m.cells.slice(0, 300)) if (Array.isArray(c) && coopInt(c[0]) && coopInt(c[1])) placeRoadSite(c[0], c[1]);
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
    case 'train': if (UNIT_TYPES[m.type] && !UNIT_TYPES[m.type].animal && b.queue.length < 10) b.queue.push(m.type); break;
    case 'untrain': if (coopInt(m.i)) b.queue.splice(m.i, 1); break;
    case 'hire': if (b.def.worker) queueTraining(b.def.worker); break;
    case 'recipe': if (coopInt(m.i) && m.i >= 0 && m.i < b.recipeOn.length) b.recipeOn[m.i] = !!m.on; break;
    case 'crop': if (b.crops && m.c in b.crops) b.crops[m.c] = !!m.on; break;
    case 'block': if (GOODS[m.g]) Game.storeBlock[m.g] = !Game.storeBlock[m.g]; break;
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
    for (const u of coop.players.values()) u.hero.nightFalls = 0;
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
  }
  // рассвет/день без заказа — выдаём новый (но не вечером и не ночью)
  if (!coop.quest && !eve && !night && Game.time > 5) coopNewQuest();
  coop.prevNight = night; coop.prevEve = eve;
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

function coopStateGet() { return JSON.stringify(coop.vil); }
function coopStateSet(json) { try { Object.assign(coop.vil, JSON.parse(json)); } catch (e) { /* пусто */ } }

// ---------- Такт игроков ----------

function coopRespawn(u) {
  const H = u.hero;
  heroStopUnit(u);
  u.dead = false; u.brk = null; u.burn = null; u.injury = null; u.anim = null;
  const [x, y] = coopHome();
  u.x = x + 0.5; u.y = y + 0.5; u.food = Math.max(u.food, 0.6);
  H.hp = Math.round(H.maxhp * 0.5);
  H.drunkUntil = 0; H.stunUntil = 0; H.nightFalls = (H.nightFalls || 0) + 1;
  coop.out.push({ msg: { t: 'toast', text: `${H.owner} приходит в себя у склада — деревня не отпускает так просто` } });
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
    // здоровье: беды деревни
    if (u.food <= 0) H.hp -= 0.5 * dt;
    else if (H.hp < H.maxhp && u.food > 0.25 && !(u.burn && u.burn.stage)) H.hp = Math.min(H.maxhp, H.hp + 0.4 * dt);
    if (u.burn && u.burn.stage) H.hp -= 6 * dt;
    if (u.injury && u.injury !== H.seenInj) H.hp -= 8;
    H.seenInj = u.injury || null;
    const fly = u.anim === 'fly';
    if (fly && !H.seenFly) H.hp -= 5;
    H.seenFly = fly;
    if (H.hp <= 0) coopRespawn(u);
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
const COOP_UNIT_EX = ['slip', 'burn', 'lantern', 'knock', 'gest', 'gestFace', 'gestUntil', 'netUntil', 'umbrella', 'fleeUntil', 'panicUntil'];
const COOP_WX = ['k', 'target', 'bolt', 'scorch', 'fires', 'rainEnd', 'nextRain'];

// всё, что нечисть, ночь и погода держат вне жителей и клеток
function coopMirror() {
  const m = {
    ghosts: coopList(Game.ghosts), skels: coopList(Game.skels), ents: coopList(Game.ents), owls: coopList(Game.owls),
    bats: coopList(Game.bats), critters: coopList(Game.critters), falling: coopList(Game.falling),
    golem: Game.golem ? coopPlain(Game.golem, 0, true) : null,
    sub: Game.sub ? coopPlain(Game.sub, 0, true) : null,
    lost: Game.lostGnomes || 0,
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

function coopUnitsPacket() {
  const us = [], now = Game.time;
  for (const u of Game.units) {
    if (u.dead) continue;
    const a = u.action;
    const o = { i: u.id, t: u.type, x: r2(u.x), y: r2(u.y), f: u.face, v: u.vdir, lk: u.look, fd: r2(u.food) };
    if (u.anim) o.a = u.anim;
    if (a && a.walk && a.path && !(a.block > 0 && !a.squeeze)) o.m = 1;
    if (a && a.T) { o.at = r2(a.t); o.aT = r2(a.T); }
    if (u.carry) { o.c = u.carry; o.n = u.carryN || 1; }
    if (u.inside) o.in = u.inside.id;
    if (u.injury) o.inj = u.injury;
    if (u.drunkAt || (u.hero && u.hero.drunkUntil > now)) o.dr = 1;
    if (u.ouchUntil > now) o.ou = 1;
    let ex = null;
    for (const k of COOP_UNIT_EX) { const v = u[k]; if (v) (ex || (ex = {}))[k] = coopPlain(v, 1); }
    if (ex) o.ex = ex;
    if (u.owner) o.ow = u.owner;
    if (u.hero && u.owner) { o.hp = Math.round(u.hero.hp); o.mhp = u.hero.maxhp; o.cl = u.hero.clsKey; o.lv = u.hero.level; }
    us.push(o);
  }
  const an = [];
  for (const a of Game.animals) if (!a.dead) an.push({ i: a.id, k: a.kind, x: r2(a.x), y: r2(a.y), f: a.face, m: a.moving ? 1 : 0, p: r2(a.phase), l: a.loot || undefined, s: a.state });
  return JSON.stringify({ t: 'u', time: r2(now), units: us, animals: an, mir: coopMirror() });
}

function coopInitPacket(uid) {
  const s = serializeGame();
  s.units = [];
  return JSON.stringify({ t: 'init', world: s, ob: coopAllObjs(), uid, time: Game.time, nextId: Game.nextId });
}

// Разница мира с прошлой рассылкой: здания, объекты на клетках, дороги, стройки дорог, груды
function coopWorldPacket() {
  // жителей в дельте не нужно (они уходят пакетом 'u'), а их сериализация дорога при большой деревне
  const us = Game.units; Game.units = [];
  let s;
  try { s = serializeGame(); } finally { Game.units = us; }
  const out = { t: 'w', time: r2(Game.time), nextId: Game.nextId };
  // здания; кадр анимации (an) меняется всё время — в подпись не входит, клиент крутит его сам
  const nb = new Map(), up = [], bById = new Map(Game.buildings.map(x => [x.id, x]));
  for (const d of s.buildings) {
    const b = bById.get(d.id);
    d.wk = b && b.working ? 1 : 0;
    const sig = JSON.stringify(d);
    d.an = b ? r2(b.anim || 0) : 0;
    nb.set(d.id, sig);
    if (coop.shB.get(d.id) !== sig) up.push(d);
  }
  const rm = [];
  for (const id of coop.shB.keys()) if (!nb.has(id)) rm.push(id);
  coop.shB = nb;
  if (up.length) out.b = up;
  if (rm.length) out.bx = rm;
  // объекты на клетках целиком
  const oc = [], ox = [];
  for (let i = 0; i < N_TILES; i++) {
    const o = World.obj[i];
    const sig = o ? JSON.stringify(coopTileObj(o)) : '';
    if ((coop.shO.get(i) || '') !== sig) {
      if (sig) { oc.push([i, JSON.parse(sig)]); coop.shO.set(i, sig); } else { ox.push(i); coop.shO.delete(i); }
    }
  }
  if (oc.length) out.o = oc;
  if (ox.length) out.ox = ox;
  // дороги
  const nr = new Set(s.road), ra = [], rx = [];
  for (const i of nr) if (!coop.shR.has(i)) ra.push(i);
  for (const i of coop.shR) if (!nr.has(i)) rx.push(i);
  coop.shR = nr;
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
  return JSON.stringify({ t: 'me', uid: u.id, cls: H.clsKey, clsName: H.cls, level: H.level, hp: Math.round(H.hp), mhp: H.maxhp, inv: H.inv, food: r2(u.food), vil: coopVillageInfo() });
}

function coopDrain() {
  const o = coop.out;
  coop.out = [];
  return JSON.stringify(o);
}

function coopMeta() {
  return JSON.stringify({ classes: COOP_CLASSES, chat: COOP_CHAT, permLabels: COOP_PERMS, perms: coop.perms });
}
