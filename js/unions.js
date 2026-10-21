'use strict';
// Профсоюзы (заметка пользователя: «рабочие объединяются в профсоюз и предлагают игроку лучшие действия по постройкам,
// у ремесленников тоже профсоюз — предлагают, что лучше создавать сейчас»):
//  · профсоюз трудяг и работяг — что строить сейчас, чего не хватает, где затор;
//  · цех мастеров — что ковать, шить, варить и печь: оружие и доспехи для гильдий, перевязки раненым, зелья больным, еда к зиме.
// Советы считает хозяин мира (одиночная игра, кооп-сервер) раз в UN_TICK с игрового времени → Game.un.adv = { w: [...], c: [...] }
// (по 1–3 лучших, каждый должен продержаться две проверки подряд). В коопе снимок уходит клиентам ({t:'un'}).
// Показ — на клиенте: одним тостом через очередь notify.js не чаще раза в UN_EVERY минут, не на входе, не в обучении,
// не в первые UN_START игровых минут; выключатель — в «Совете деревни» (раздел «Профсоюзы», запоминается на устройстве).
// Нажатие — действие одним касанием: выбрать здание для постройки, заказ мастерской, учёба в школе, показать место.
// Сохранение — поле un (какой совет когда звучал).

const UN_TICK = 10, UN_START = 15 * 60, UN_EVERY = 5, UN_REPEAT = 15 * 60, UN_MAX = 3;
const UN_KEY = 'oldgold.unions';
const UN_MAT = ['trunk', 'timber', 'stone'];
const UN_CRAFT = ['sword', 'bow', 'dagger', 'ironArmor', 'leatherArmor', 'staff', 'mageArmor', 'mana', 'potion', 'bandage'];
const UN_FOOD_CHAIN = ['farm', 'mill', 'bakery', 'inn'];

function unState() { return Game.un || (Game.un = { adv: { w: [], c: [] }, seen: {}, next: 0, streak: {} }); }
const unDone = b => b && b.state === 'done' && !b.removed;
const unAll = type => Game.buildings.filter(b => b.type === type && unDone(b));
const unOpen = type => !!BUILDINGS[type] && !BUILDINGS[type].noMenu && !BUILDINGS[type].hidden && (typeof isUnlocked !== 'function' || isUnlocked(type));
function unStore(g) {
  let n = 0;
  for (const b of Game.buildings) if (unDone(b) && b.isStore()) n += Math.max(0, b.offer(g));
  return n;
}
// у мастерских на полках (ещё не свезли на склад)
function unShelf(g) {
  let n = 0;
  for (const b of Game.buildings) if (unDone(b) && !b.isStore() && b.def.outputs && b.def.outputs[g]) n += Math.max(0, b.offer(g));
  for (const p of Game.piles.values()) if (!p.removed) n += Math.max(0, p.stock[g] || 0);
  return n;
}
// кто делает товар g: здания, у которых он в выходе (первым — открытое в меню)
const UN_PROD = {};
function unProducers(g) {
  if (!UN_PROD[g]) UN_PROD[g] = BUILD_ORDER.filter(k => { const d = BUILDINGS[k]; return !d.guild && k !== 'storehouse' && ((d.outputs && d.outputs[g]) || (d.recipes || []).some(r => r.out[g])); });
  return UN_PROD[g];
}
const unProducer = g => unProducers(g).find(unOpen) || null;
const unPeople = () => Game.units.filter(u => !u.dead && !u.noFood && typeof isPerson === 'function' && isPerson(u));
const unProblem = b => { try { return typeof b.problem === 'function' ? b.problem() : null; } catch (e) { return null; } };

// ---------- Профсоюз трудяг и работяг: постройки ----------
function unBuildAdvice() {
  const out = [];
  const add = (id, s, text, args, act) => out.push({ id, s, text, args: args || [], act: act || null });
  const sites = [...Game.buildings.filter(b => !b.removed && (b.state !== 'done' || b.upg)), ...Game.roadSites.values()];
  const idleB = Game.units.filter(u => u.type === 'builder' && !u.dead && u.idleFlag && !u.brk).length;

  // 1) стройкам не хватает материала, а на складе его нет — нужен ещё добытчик
  for (const g of UN_MAT) {
    let need = 0;
    for (const s of sites) need += s.demand(g);
    const have = unStore(g) + unShelf(g);
    if (need < 3 || have >= need / 2) continue;
    let prod = unProducer(g);
    // доски есть кому пилить, но нечего — значит, мало брёвен
    if (g === 'timber' && unAll('sawmill').some(b => unProblem(b) === 'need:trunk')) prod = unOpen('woodcutter') ? 'woodcutter' : prod;
    if (!prod) continue;
    add('mat:' + g, 50 + Math.min(30, need) + idleB * 3, 'Стройки ждут: {0} не хватает ({1} шт.). Нужен ещё «{2}», а то работяги уже точат колышки от скуки', ['~' + GOODS[g].name, need, BUILDINGS[prod].name], { k: 'build', type: prod });
  }

  // 2) выученные мастера сидят без здания
  const lazy = {};
  for (const u of unPeople()) {
    if (u.home || u.teamOf || u.type === 'hero' || u.rec || u.kid || u.isCourier || u.type === 'builder') continue;
    if (!BUILD_ORDER.some(k => BUILDINGS[k].worker === u.type)) continue;
    lazy[u.type] = (lazy[u.type] || 0) + 1;
  }
  for (const type in lazy) {
    const bt = BUILD_ORDER.find(k => BUILDINGS[k].worker === type && unOpen(k));
    if (!bt || Game.buildings.some(b => b.type === bt && !b.removed && b.state !== 'done')) continue;   // уже строится
    add('idle:' + type, 40 + 8 * lazy[type], 'Без дела сидят: {0} ×{1}. Им бы здание «{2}» — а то уже сочиняют песни про безработицу', [UNIT_TYPES[type].name, lazy[type], BUILDINGS[bt].name], { k: 'build', type: bt });
  }

  // 3) мастерская стоит без сырья, и на складе его нет — нужен добытчик сырья
  const stall = {};
  for (const b of Game.buildings) {
    if (!unDone(b) || b.isStore()) continue;
    const p = unProblem(b);
    if (p === 'noroad') add('road:' + b.id, 60, 'К зданию «{0}» не подходит дорога, а трудяги по кустам не носят', [b.def.name], { k: 'focus', id: b.id });
    if (!p || !p.startsWith('need:')) continue;
    const g = p.slice(5);
    if (b.incoming[g] > 0 || unStore(g) + unShelf(g) > 0) continue;
    (stall[g] || (stall[g] = [])).push(b);
  }
  for (const g in stall) {
    if (UN_MAT.includes(g) && out.some(a => a.id === 'mat:' + g)) continue;
    const prod = unProducer(g);
    if (!prod || !GOODS[g]) continue;
    const many = Game.buildings.filter(b => b.type === prod && !b.removed).length;
    add('need:' + g, 35 + 6 * stall[g].length - 4 * many, '«{0}» стоит: нет сырья — {1}. Ещё бы «{2}»', [stall[g][0].def.name, '~' + GOODS[g].name, BUILDINGS[prod].name], { k: 'build', type: prod });
  }

  // 4) трудяги не успевают: свободных почти нет, а заявки копятся
  const U = unState();
  const cour = Game.units.filter(u => u.isCourier && !u.dead && u.type === 'serf');
  if (cour.length) {
    const free = cour.filter(u => u.idleFlag && !u.brk).length / cour.length;
    let wait = 0;
    for (const d of [...Game.buildings, ...Game.roadSites.values()]) {
      if (d.removed || (d.isStore && d.isStore() && !d.upg)) continue;
      for (const g of GOOD_KEYS) if (d.demand(g) > 0 && !(d.incoming[g] > 0)) wait++;
    }
    U.ema = U.ema == null ? free : U.ema * 0.7 + free * 0.3;
    const school = unAll('school')[0];
    if (U.ema < 0.08 && wait >= 6 && school) add('serfs', 45 + Math.min(20, wait), 'Носильщиков не хватает: {0} заявок ждут. Выучите ещё трудяг — мы не железные', [wait], { k: 'train', type: 'serf', id: school.id });
  }

  // 5) кучи на земле: складу не хватает рук или места
  let piles = 0;
  for (const p of Game.piles.values()) if (!p.removed && GOOD_KEYS.some(g => (p.stock[g] || 0) > 0)) piles++;
  if (piles >= 8 && unOpen('storehouse')) add('piles', 25 + piles, 'По деревне валяется {0} куч добра. Второй склад поближе к мастерским?', [piles], { k: 'build', type: 'storehouse' });

  // 6) еда: обедов мало — чего не хватает в цепочке поле → мельница → пекарня → трактир
  const ppl = unPeople().length;
  if (ppl >= 6) {
    let meals = 0;
    for (const b of Game.buildings) if (unDone(b) && (b.type === 'inn' || b.isStore())) for (const g of FOODS) meals += b.stock[g] || 0;
    if (meals < ppl) {
      const miss = UN_FOOD_CHAIN.find(k => unOpen(k) && !Game.buildings.some(b => b.type === k && !b.removed));
      if (miss) add('food:' + miss, 55, 'Обедов на складах {0} на {1} ртов. В цепочке хлеба не хватает: «{2}»', [meals, ppl, BUILDINGS[miss].name], { k: 'build', type: miss });
    }
  }
  return out;
}

// ---------- Цех мастеров: что делать сейчас ----------
function unCraftAdvice() {
  const out = [];
  const add = (id, s, text, args, act) => out.push({ id, s, text, args: args || [], act: act || null });
  const ppl = unPeople();
  const hurt = ppl.filter(u => u.injury).length, ill = ppl.filter(u => u.ill).length;
  const sea = typeof seaIdx === 'function' && Game.sea && Game.sea.fixed == null ? seaIdx() : -1;
  for (const g of UN_CRAFT) {
    if (!GOODS[g]) continue;
    let need = 0;
    for (const b of Game.buildings) if (unDone(b) && !b.isStore() && !b.removed && b.def.inputs && b.def.inputs[g] && !(b.def.outputs && b.def.outputs[g])) need += b.demand(g);
    if (g === 'bandage') need += hurt;
    if (g === 'potion') need += ill + (sea === 1 || sea === 2 ? 2 : 0) * (unAll('infirmary').length ? 1 : 0);
    need -= unStore(g) + unShelf(g);
    if (need <= 0) continue;
    const name = '~' + GOODS[g].name;   // «~» — строчными (unText)
    // где это делают и по какому рецепту
    let shop = null, ri = -1;
    for (const b of Game.buildings) {
      if (!unDone(b) || !b.def.recipes) continue;
      const i = b.def.recipes.findIndex(r => r.out[g]);
      if (i >= 0) { shop = b; ri = i; if (b.worker && !b.paused) break; }
    }
    // «(раненых N)» / «(больных N)» — число всегда последним аргументом, k — его номер в шаблоне
    const n = g === 'bandage' ? hurt : ill;
    const why = k => g === 'bandage' && hurt ? ` (раненых {${k}})` : g === 'potion' && ill ? ` (больных {${k}})` : '';
    if (!shop) {
      const prod = unProducer(g);
      if (prod && !Game.buildings.some(b => b.type === prod && !b.removed)) add('cb:' + g, 30 + Math.min(20, need * 3), 'Нужны {0}' + why(2) + ', а делать негде. Поставим «{1}»?', [name, BUILDINGS[prod].name, n], { k: 'build', type: prod });
      continue;
    }
    const r = shop.def.recipes[ri];
    const lack = Object.keys(r.in).filter(m => unStore(m) + (shop.stock[m] || 0) + unShelf(m) < r.in[m]);
    if (lack.length) {
      const prod = unProducer(lack[0]);
      const act = prod && !Game.buildings.some(b => b.type === prod && !b.removed) ? { k: 'build', type: prod } : { k: 'focus', id: shop.id };
      add('cm:' + g, 25 + Math.min(20, need * 2), 'На {0} нечем работать: нет — {1}', [name, lack.map(m => '~' + GOODS[m].name)], act);
      continue;
    }
    if (!shop.worker) {
      const wt = shop.def.worker, school = unAll('school')[0];
      if (wt && school && UNIT_TYPES[wt] && !UNIT_TYPES[wt].noTrain) add('cw:' + g, 40, 'Некому делать {0}: в «{1}» нет мастера — выучим «{2}»?', [name, shop.def.name, UNIT_TYPES[wt].name], { k: 'train', type: wt, id: school.id });
      continue;
    }
    if (shop.recipeOn && shop.recipeOn[ri] === false) { add('cr:' + g, 45 + need, 'В «{0}» выключен рецепт: {1}, а они нужны' + why(2) + '. Включить?', [shop.def.name, name, n], { k: 'rcp', id: shop.id, i: ri }); continue; }
    // мастерская делает всё по кругу — пусть пока делает только нужное (рецепты потом включаются в карточке здания)
    const on = (shop.recipeOn || []).filter(Boolean).length;
    if (!shop.def.orders && on > 1) { add('cs:' + g, 35 + need * 2, 'Нужны {0}' + why(2) + '. Пусть «{1}» пока делает только их?', [name, shop.def.name, n], { k: 'solo', id: shop.id, i: ri }); continue; }
    if (shop.def.orders) {
      const queued = (shop.orders || []).filter(o => o.i === ri).reduce((a, o) => a + o.n, 0);
      const want = Math.min(3, need) - queued;
      if (want > 0) add('co:' + g, 40 + need * 2, 'Заказать {0} ×{1} в «{2}»' + why(3), [name, want, shop.def.name, n], { k: 'ord', id: shop.id, i: ri, n: want });
    }
  }
  // зима: еда и сено впрок (осень или за два дня до зимы)
  if (sea >= 0 && typeof seaDaysToWinter === 'function') {
    const d = seaDaysToWinter();
    if (sea === 1 || (sea === 0 && d <= 2)) {
      const f = typeof seaFoodInfo === 'function' ? seaFoodInfo() : null;
      if (f && f.need > f.have) {
        const bak = unAll('bakery')[0] || unAll('butchery')[0];
        const act = bak ? { k: 'focus', id: bak.id } : unOpen('bakery') ? { k: 'build', type: 'bakery' } : null;
        add('winter', 55 + Math.min(25, Math.round((f.need - f.have) / Math.max(1, f.need) * 30)), 'Зима через {0} сут.: еды {1} из {2}. Печём и коптим впрок, пиво подождёт', [d, f.have, f.need], act);
      }
      const h = typeof seaHayInfo === 'function' ? seaHayInfo() : null;
      if (h && h.pigs > h.have) { const farm = unAll('farm')[0]; add('hay', 40, 'Сена на зиму {0} из {1} — свиньи уже смотрят на солому в бороде', [h.have, h.pigs], farm ? { k: 'focus', id: farm.id } : unOpen('farm') ? { k: 'build', type: 'farm' } : null); }
    }
  }
  return out;
}

// профсоюз есть, когда есть кому собираться
function unHasWorkers() {
  const ws = Game.units.filter(u => !u.dead && (u.type === 'serf' || u.type === 'builder'));
  return ws.length >= 4 && ws.some(u => typeof unitLevel === 'function' && unitLevel(u) >= 2);
}
function unHasCrafters() {
  let n = 0;
  for (const u of Game.units) if (!u.dead && u.home && !u.home.removed && u.home.def && u.home.def.recipes && u.home.def.cat !== 'Ресурсы') n++;   // пекари, мясники, бронники, чародеи, лекари
  return n >= 2;
}

function unPick(list, prev) {
  const st = unState().streak, now = {};
  for (const a of list) now[a.id] = (st[a.id] || 0) + 1;
  for (const id in now) st[id] = now[id];
  for (const id in st) if (!now[id]) delete st[id];
  // устойчивые: держатся две проверки подряд (или уже были в списке)
  return list.filter(a => now[a.id] >= 2 || prev.some(p => p.id === a.id)).sort((a, b) => b.s - a.s || (a.id < b.id ? -1 : 1)).slice(0, UN_MAX).map(a => ({ id: a.id, text: a.text, args: a.args, act: a.act }));
}

// хозяин мира: пересчёт советов
let unT = -1e9, unSent = '', unSentAt = 0;
function unTick() {
  if (Game.time - unT < UN_TICK && Game.time >= unT) return;
  unT = Game.time;
  const U = unState();
  let w = [], c = [];
  try {
    w = unHasWorkers() ? unPick(unBuildAdvice(), U.adv.w || []) : [];
    c = unHasCrafters() ? unPick(unCraftAdvice(), U.adv.c || []) : [];
  } catch (e) { if (!unTick.err) { unTick.err = 1; console.error(e); } }
  U.adv = { w, c };
  // кооп-сервер: снимок клиентам, если поменялся (и раз в минуту — для только что зашедших)
  if (typeof coop !== 'undefined' && coop && coop.out && typeof coopTick === 'function') {
    const s = JSON.stringify(U.adv);
    if (s !== unSent || Game.time - unSentAt > 60) { unSent = s; unSentAt = Game.time; coop.out.push({ msg: { t: 'un', w, c } }); }
  }
}
// клиент кооператива: снимок от сервера
function unApply(m) { const U = unState(); U.adv = { w: Array.isArray(m.w) ? m.w : [], c: Array.isArray(m.c) ? m.c : [] }; }

// ---------- Сохранение, сброс, диспетчер ----------
{
  const _rgs = resetGameState;
  resetGameState = function () { _rgs(); Game.un = null; unT = -1e9; };
  const _sg = serializeGame;
  serializeGame = function () {
    const s = _sg();
    const U = Game.un;
    if (U && (Object.keys(U.seen).length || U.next)) s.un = { seen: U.seen, next: U.next };
    return s;
  };
  const _as = applySave;
  applySave = function (s) {
    _as(s);
    Game.un = null; unT = -1e9;
    const u = s.un, U = unState();
    if (!u || typeof u !== 'object') return;
    for (const k in u.seen || {}) if (typeof u.seen[k] === 'number' && isFinite(u.seen[k])) U.seen[k] = u.seen[k];
    if (typeof u.next === 'number' && isFinite(u.next)) U.next = u.next;
  };
  const _da = dispatchAll;
  dispatchAll = function () { _da(); if (!Game.coop) unTick(); };
}

// ---------- Показ (браузер) ----------
const UN_W_SAY = ['Профсоюз трудяг постановил', 'Собрание у костра решило', 'Трудяги проголосовали бородами', 'Бригадир {0} от имени профсоюза'];
const UN_C_SAY = ['Цех мастеров ворчит', 'Мастера шепчут за наковальней', 'Подмастерья собрались и решили', 'Старшина цеха {0} советует'];
let unOff = false;
try { unOff = localStorage.getItem(UN_KEY) === 'off'; } catch (e) { /* нет хранилища — советы включены */ }
function unSetOn(on) { unOff = !on; try { localStorage.setItem(UN_KEY, on ? 'on' : 'off'); } catch (e) { /* не сохранится — не беда */ } }

// кто говорит от имени профсоюза: самый опытный трудяга или мастер
function unSpeaker(kind) {
  const list = Game.units.filter(u => !u.dead && (kind === 'w' ? u.type === 'serf' || u.type === 'builder' : u.home && u.home.def && u.home.def.recipes));
  list.sort((a, b) => (b.xp || 0) - (a.xp || 0) || a.id - b.id);
  return list[0] && typeof wkName === 'function' ? wkName(list[0]) : '';
}
function unSay(kind, a) {
  const L = kind === 'w' ? UN_W_SAY : UN_C_SAY;
  let h = 0;
  for (const ch of a.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const who = unSpeaker(kind);
  const pre = L[(h + Math.floor(Game.time / 600)) % (who ? L.length : L.length - 1)];
  return t(pre, who) + ': «' + unText(a) + '»';
}
// аргументы — русские ключи (переводятся в t); «~Имя» — строчными, массив — через запятую
const unArg = x => typeof x === 'number' ? x : Array.isArray(x) ? x.map(unArg).join(', ') : typeof x === 'string' && x[0] === '~' ? t(x.slice(1)).toLowerCase() : String(x);
const unText = a => t(a.text, ...(a.args || []).map(unArg));

function unDo(a) {
  const x = a && a.act;
  if (!x) return;
  const coopOn = !!Game.coop && typeof coopSend === 'function';
  const b = x.id != null ? Game.buildings.find(q => q.id === x.id && !q.removed) : null;
  if (x.k === 'build' && BUILDINGS[x.type] && unOpen(x.type) && typeof setTool === 'function') {
    const def = BUILDINGS[x.type];
    setTool({ kind: 'build', type: x.type, rot: def.noRotate || def.rots ? 0 : ((typeof UI !== 'undefined' && UI.lastRot) || 0) });
    toast(t('Выберите место: «{0}»', def.name));
  } else if (x.k === 'focus' && b && typeof focusBuilding === 'function') focusBuilding(b);
  else if (x.k === 'train' && UNIT_TYPES[x.type]) {
    if (coopOn) { const s = b || Game.buildings.find(q => q.type === 'school' && q.state === 'done'); if (s) coopSend({ t: 'bact', id: s.id, act: 'train', type: x.type }); }
    else if (typeof queueTraining === 'function') queueTraining(x.type);
  } else if (x.k === 'ord' && b && typeof durSend === 'function') {
    for (let i = 0; i < Math.min(3, x.n || 1); i++) durSend(`ord:${b.id}:${x.i}:1`);
    toast(t('Заказ принят: {0} ×{1}', b.def.recipes[x.i] ? GOODS[Object.keys(b.def.recipes[x.i].out)[0]].name : '', Math.min(3, x.n || 1)));
  } else if (x.k === 'solo' && b && b.recipeOn) {
    b.recipeOn.forEach((on, j) => { if (on === (j === x.i)) return; if (coopOn) coopSend({ t: 'bact', id: b.id, act: 'recipe', i: j, on: j === x.i }); else b.recipeOn[j] = j === x.i; });
    toast(t('«{0}» теперь делает только: {1}', b.def.name, b.def.recipes[x.i] ? unArg('~' + GOODS[Object.keys(b.def.recipes[x.i].out)[0]].name) : ''));
    focusBuilding(b);
  } else if (x.k === 'rcp' && b && b.recipeOn) {
    if (coopOn) coopSend({ t: 'bact', id: b.id, act: 'recipe', i: x.i, on: true });
    else b.recipeOn[x.i] = true;
    focusBuilding(b);
  }
  if (typeof updateUI === 'function') updateUI(true);
}

// пора ли что-то предложить: не на входе, не в обучении, не в первые минуты, не чаще раза в UN_EVERY минут
const UN = { nextReal: 0, turn: 0 };
function unShowTick() {
  if (unOff || typeof Notify === 'undefined' || !Notify.offer || !Game.units || !Game.units.length) return;
  if (typeof StartMenu !== 'undefined' && StartMenu.open) return;
  if (!Notify.entry || Notify.entry.step <= 5 || (typeof Tut !== 'undefined' && Tut.on)) return;
  if (Game.time < UN_START) return;
  const U = unState(), now = Date.now();
  if (now < UN.nextReal || Game.time < (U.next || 0)) return;
  const order = UN.turn ? ['c', 'w'] : ['w', 'c'];
  for (const k of order) {
    const a = (U.adv[k] || []).find(x => x.act && !(Game.time - (x.id in U.seen ? U.seen[x.id] : -1e9) < UN_REPEAT));
    if (!a) continue;
    U.seen[a.id] = Game.time;
    U.next = Game.time + UN_EVERY * 60;
    UN.nextReal = now + UN_EVERY * 60000;
    UN.turn = k === 'w' ? 1 : 0;
    Notify.offer(unSay(k, a) + ' ▸', () => unDo(a), 'union');
    return;
  }
}

// ---------- «Совет деревни» → «Профсоюзы» ----------
function unCouncilHTML() {
  const U = unState();
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const list = (k, title, none, has) => {
    const L = U.adv[k] || [];
    let h = `<div class="un-h">${title}</div>`;
    if (!has) return h + `<div class="muted small">${none}</div>`;
    if (!L.length) return h + '<div class="muted small">Жалоб нет. Работаем.</div>';
    return h + L.map((a, i) => `<div class="irow small un-row"><span>${esc(unText(a))}</span>${a.act ? `<button class="hp-sm" data-cn="unions:do:${k}:${i}">Сделать</button>` : ''}</div>`).join('');
  };
  const wOk = !Game.coop ? unHasWorkers() : (U.adv.w || []).length > 0 || Game.units.some(u => u.type === 'serf');
  const cOk = !Game.coop ? unHasCrafters() : (U.adv.c || []).length > 0 || Game.units.some(u => u.home && u.home.def && u.home.def.recipes);
  return `<div class="muted small">${esc(t('Самые бывалые гномы собираются у костра и решают, чего деревне не хватает. Совет приходит в оповещениях не чаще раза в {0} минут.', UN_EVERY))}</div>` +
    list('w', 'Профсоюз трудяг и работяг', 'Профсоюза пока нет: нужно хотя бы четверо трудяг и работяг, и чтобы один был опытным (2-й уровень).', wOk) +
    list('c', 'Цех мастеров', 'Цеха пока нет: нужны хотя бы два мастера в мастерских, пекарнях или лазарете.', cOk) +
    `<div class="irow small"><span>Советы в оповещениях</span><button class="hp-sm" data-cn="unions:toggle">${unOff ? 'Выключены' : 'Включены'}</button></div>`;
}
function unCouncilClick(v) {
  if (v === 'toggle') { unSetOn(unOff); updateUI(true); return; }
  const m = /^do:([wc]):(\d+)$/.exec(v);
  if (m) unDo((unState().adv[m[1]] || [])[+m[2]]);
}

if (typeof document !== 'undefined' && typeof navigator !== 'undefined' && navigator.userAgent !== 'node' && typeof councilAdd === 'function' && document.getElementById && document.getElementById('tab-council')) {
  councilAdd({ id: 'unions', order: 60, title: 'Профсоюзы', html: unCouncilHTML, click: unCouncilClick });
  const css = document.createElement('style');
  css.textContent = '.un-h{margin:8px 0 3px;font-weight:bold}.un-row{display:flex;justify-content:space-between;align-items:center;gap:8px}.un-row span{flex:1}#toasts .toast.union{border-color:#8a6a2a}';
  document.head.appendChild(css);
  setInterval(() => { try { if (typeof Game !== 'undefined' && Game.buildings) unShowTick(); } catch (e) { if (!unShowTick.err) { unShowTick.err = 1; console.error(e); } } }, 3000);
}
