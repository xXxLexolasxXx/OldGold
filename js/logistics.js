'use strict';
// Распределение работы: курьеры возят товары по дорогам, строители идут на стройки, рабочие — в свои здания.

function mdist(ax, ay, bx, by) { return Math.abs(ax - bx) + Math.abs(ay - by); }

function takeNearest(list, x, y) {
  let bi = -1, bd = 1e9;
  for (let i = 0; i < list.length; i++) {
    const d = mdist(list[i].x, list[i].y, x, y);
    if (d < bd) { bd = d; bi = i; }
  }
  return bi < 0 ? null : list.splice(bi, 1)[0];
}

function assignDelivery(u, from, to, g, n = 1) {
  from.reserved[g] += n;
  to.incoming[g] += n;
  u.idleFlag = false; u.idleStreak = 0;
  u.action = null; u.anim = null;
  // трудяга помнит, что и куда несёт — по этому пересчитывается «в пути»
  const gen = (function* () { try { yield* deliverGen(u, from, to, g, n); } finally { u.dlv = null; } })();
  u.dlv = { from, to, g, n, gen };
  u.proc = gen;
}

// Самопроверка: «в пути» у каждого получателя = сумма того, что реально несут к нему.
// Если какая-то доставка оборвалась и не вычла своё, здание не застрянет в ожидании.
// Так же и бронь в зданиях: = ещё не забранные доставки + обеды в пути. Брошенное задание
// (гном погиб, его дом снесли, работу перехватили) больше не держит товар «занятым» навсегда.
function auditIncoming() {
  const holders = [...Game.buildings, ...Game.roadSites.values(), ...Game.piles.values()];
  for (const h of holders) if (h.incoming) for (const g of GOOD_KEYS) h.incoming[g] = 0;
  const resv = new Map();
  const book = (h, g, n) => { if (!h || h.removed || !h.reserved) return; let m = resv.get(h); if (!m) resv.set(h, m = {}); m[g] = (m[g] || 0) + n; };
  const live = (u, gen) => u.proc === gen || (u.brk && u.brk.saved && u.brk.saved.proc === gen);
  for (const u of Game.units) {
    const e = u.eat;
    if (e) { if (live(u, e.gen) && !u.dead) book(e.inn, e.food, 1); else u.eat = null; }
    const sr = u.subRes;   // субботник: мусор из кучки
    if (sr) { if (live(u, sr.gen) && !u.dead) book(sr.pile, 'trash', 1); else u.subRes = null; }
    const d = u.dlv;
    if (!d) continue;
    if (!live(u, d.gen)) { u.dlv = null; continue; }
    // груз уже уронили (испуг ночью, столкновение, волк) — он лежит кучкой, а не едет к адресату.
    // Раньше такой «призрак» числился «в пути» всю дорогу пустого гнома: стройка ждала его, не звала
    // других и стояла на «80%» с полным складом
    if (d.to && !d.to.removed && d.to.incoming && !(d.picked && !u.carry)) d.to.incoming[d.g] += d.n;
    if (!d.picked) book(d.from, d.g, d.n);
  }
  // звери тоже берут из кучек: на субботнике носят мусор, питомцы подбирают находки
  for (const a of Game.animals) {
    if (a.dead) continue;
    if (a.subSt === 'toPile' && a.subPile) book(a.subPile, 'trash', 1);
    if (a.err && a.err.st === 'toPile' && a.err.pile) book(a.err.pile, a.err.g, 1);
  }
  for (const h of [...Game.buildings, ...Game.piles.values()]) {
    const m = resv.get(h);
    for (const g of GOOD_KEYS) h.reserved[g] = m ? m[g] || 0 : 0;
    if (h.isPile && !m) cleanupPile(h);   // забытая бронь держала опустевшую кучку на земле
  }
}

// Тяжёлое не унести с травмой руки
const HEAVY = new Set(['trunk', 'stone', 'timber', 'pig', 'goldore', 'leatherArmor']);

// трудяга с выслугой носит 2 и 3 предмета (уровни 2 и 3); лёгкого — на одну штуку больше.
// Каждый обед — хотя бы одна ходка трудяги с буханкой в трактир: в деревне на 50 жителей так была занята почти половина
// курьеров, а мельница при 700 зерна на складе и плавильня без брёвен ждали подвоза (замер tools/soak/deficit.js, ДЕФИЦИТЫ.md)
const LIGHT = new Set(['bread', 'croissant', 'sausage', 'chickenleg', 'fish', 'flour', 'hay', 'hops']);
function carryCap(u, g) { return u.type === 'serf' ? unitLevel(u) + (g && LIGHT.has(g) ? 1 : 0) : (CARRY_CAP[u.type] || 1); }
function canCarry(u, g) { return !(u.injury === 'arm' && HEAVY.has(g)); }

// Подобрать перевозчика под партию: большой партии — телегу, средней — козу, иначе курьера.
function pickCarrier(idle, x, y, g, amount) {
  const ok = idle.filter(u => canCarry(u, g));
  if (!ok.length) return null;
  const pref = amount >= 3 ? ['carter', 'goat', 'serf'] : amount >= 2 ? ['goat', 'serf', 'carter'] : ['serf', 'goat', 'carter'];
  if (Game.prio) pref.sort((a, b) => prioLv('jobs', prioJobKey(b)) - prioLv('jobs', prioJobKey(a)));   // «Высокий» перевозчик — первым (порядок при равных не меняется)
  for (const t of pref) {
    let list = ok.filter(u => u.type === t);
    if (!list.length) continue;
    // на большую партию — сперва трудяги с выслугой, которые унесут больше за раз
    if (t === 'serf' && amount >= 2) { const big = list.filter(u => carryCap(u, g) >= Math.min(3, amount)); if (big.length) list = big; }
    const u = takeNearest(list, x, y);
    idle.splice(idle.indexOf(u), 1);
    return u;
  }
  return null;
}

// Курьеры ездят только по дорогам: всё распределяется внутри одной дорожной сети.
// вне очереди — только то, что идёт на еду: в мельницу, пекарню, свинарник, бойню, трактир
const isFoodProducer = b => b.type === 'farm' || FOOD_DEST.has(b.type);
const FOOD_DEST = new Set(['mill', 'bakery', 'swine', 'butchery', 'inn']);
const FOOD_CHAIN = new Set(['wheat', 'flour', 'bread', 'sausage', 'pig', 'hay', 'chicken']);

// Очередь заявок (меньше — раньше). Срочное — то, без чего что-то встанет прямо сейчас:
// золото в школу с очередью учеников, еда в трактир, где она кончается, сырьё пищевому цеху на исходе.
// Обычная дозагрузка полного трактира и цехов идёт ПОСЛЕ строек: в деревне на 150 жителей трактир
// раньше всегда стоял первым и забирал почти всех трудяг — стройки годами ждали материал,
// хотя на складе его были сотни.
function innFoodLeft(b) {
  let n = (b.stock.chicken + b.incoming.chicken) * 4;
  for (const g of FOODS) n += b.stock[g] + b.incoming[g] - b.reserved[g];
  return n;
}
function reqPri(d, g) {
  // дорога — наравне со стройками: недостроенный кусок держит здание за ним (раньше дорога шла последней
  // и в большой деревне последняя клетка ждала камень по пять минут — «кусок построила и опять стопор»)
  if (d.isRoad) return 0;
  if (d.type === 'school' && g === 'gold' && d.state === 'done' && d.queue.length && d.stock.gold + d.incoming.gold < 1) return -3;
  if (d.upg || d.state !== 'done') return 0;
  if (FOOD_CHAIN.has(g) && FOOD_DEST.has(d.type)) {
    if (d.type === 'inn') return innFoodLeft(d) < Math.max(INN_LOW, Game.units.length * 0.1) ? -2 : 1;
    return d.stock[g] + d.incoming[g] < 2 ? -1 : 1;
  }
  // плавильня на исходе руды или брёвен — как пищевой цех: без неё нет золота для школы, а с ним и замены потерям
  if (d.type === 'metallurgist' && (g === 'goldore' || g === 'trunk')) return d.stock[g] + d.incoming[g] < 2 ? -1 : 1;
  return 1;
}
const INN_LOW = 12;      // столько порций в трактире (с тем, что везут) — ещё не тревога

// Зерна вдоволь: на складах 1–2 тысячи зерна и сотни охапок сена, а курьеры всё возят и возят урожай с ферм — при том что
// мельница рядом ждёт подвоза (замер tools/soak/deficit.js). Когда на складах запас (зерна — ~6 на жителя, это 18 обедов хлебом;
// сена — полторы зимы свиньям), урожай остаётся на ферме: ферма заполнится и подождёт, а мельница и свинарник берут прямо с неё.
// Зерно придерживаем, только если и сена хватает: сено вяжут с тех же полей пшеницы, полная ферма перестала бы жать.
const CROP_WHEAT_PER = 6, CROP_WHEAT_MIN = 100, CROP_HAY_MIN = 40;
let cropPlT = -1, cropPlC = null;
function cropPlenty(g) {
  if (g !== 'wheat' && g !== 'hay') return false;
  if (!cropPlC || Math.abs(Game.time - cropPlT) >= 2) {
    let w = 0, h = 0, ppl = 0;
    for (const s of Game.buildings) if (s.isStore()) { w += s.stock.wheat - s.reserved.wheat; h += s.stock.hay - s.reserved.hay; }
    for (const u of Game.units) if (!u.dead && !u.noFood && isPerson(u)) ppl++;
    const hayOk = h >= Math.max(CROP_HAY_MIN, (typeof seaHayInfo === 'function' ? seaHayInfo().need : 0) * 1.5);
    cropPlC = { wheat: hayOk && w >= Math.max(CROP_WHEAT_MIN, ppl * CROP_WHEAT_PER), hay: hayOk };
    cropPlT = Game.time;
  }
  return cropPlC[g];
}

function dispatchSerfs() {
  updateRoadComps();
  // проголодавшийся без дела сначала поест (think() отправит его в трактир) — иначе диспетчер успевал дать ему заказ раньше
  let idleAll = Game.units.filter(u => u.isCourier && u.idleFlag && !u.inside && !u.brk && !u.wantsEat() && (prioJobLv(u) !== 0 || wkBoosted(u)) && wkMay(u));
  wkPinnedCouriers(idleAll);          // курьеры с маршрутом «откуда → куда» (workers.js) — только своё
  idleAll = wkTrim(idleAll);           // лимит «на работе» во вкладке «Рабочие»
  if (!idleAll.length) return;
  // свободные перевозчики по сетям
  const idleBy = new Map();
  for (const u of idleAll) {
    const c = compNear(Math.floor(u.x), Math.floor(u.y));
    if (!c) continue;
    if (!idleBy.has(c)) idleBy.set(c, []);
    idleBy.get(c).push(u);
  }
  if (!idleBy.size) return;
  const storeComp = (x, y) => { const st = nearestStore(x, y); return st ? compAt(st.doorX, st.doorY) : 0; };
  // сети, где есть склад: только там есть откуда брать камень и кому нести
  const withStore = new Set(Game.buildings.filter(b => b.isStore()).map(b => compAt(b.doorX, b.doorY)));
  const servedComp = (x, y) => { const c = compNear(x, y); return c && withStore.has(c) ? c : storeComp(x, y); };
  const depots = [...Game.buildings, ...Game.piles.values()];
  const compOf = new Map();
  // стройка, чей вход на обрывке дороги без склада (соединяющая дорога ещё строится), — тоже за ближайшим складом:
  // раньше она ждала материал по минуте при свободных трудягах (аудит «тупления», сиды 3 и 22)
  for (const b of Game.buildings) { const c = compAt(b.doorX, b.doorY); compOf.set(b, c && b.state !== 'done' && !withStore.has(c) ? servedComp(b.doorX, b.doorY) : c); }
  // кучки и стройки дорог могут лежать в стороне или примыкать к оторванному куску
  // дороги без склада — тогда их обслуживает сеть ближайшего склада (носят по бездорожью)
  for (const p of Game.piles.values()) compOf.set(p, servedComp(p.x, p.y));
  for (const s of Game.roadSites.values()) compOf.set(s, servedComp(s.x, s.y));

  // пищевой цех, у которого склад почти полон, разгружаем раньше всего — иначе он встанет
  const nearlyFull = b => Object.entries(b.def.outputs).some(([g, cap]) => b.offer(g) >= cap * 0.7);
  let nfDone = false;
  // рудники тоже: золотой рудник в 60 клетках от склада стоял «полным» (5/5 руды), пока курьеры возили зерно, —
  // руда ехала к плавильне по две штуки, золота для школы 26 за 47 суток (ДЕФИЦИТЫ.md, сид 4)
  const isMine = b => b.def && (b.def.need === 'rock' || b.def.need === 'crystal');
  const collectNearlyFull = () => { if (nfDone) return; nfDone = true; collectOutputs(b => !b.isPile && b.state === 'done' && (isFoodProducer(b) || isMine(b)) && !!b.def.outputs && nearlyFull(b)); };

  // «Перенос ресурсов» (вкладка «Приоритеты»): Выкл — не свозить на склад (кроме еды), Низкий — по 1 перевозчику
  // на здание, Высокий — рассыпанное с земли раньше заявок и по 5 перевозчиков на здание
  const haul = prioLv('tasks', 'haul'), haulPer = [0, 1, 3, 5][haul];
  if (haul === 3) collectOutputs(b => b.isPile);     // рассыпанное с земли — раньше заявок
  else if (haul > 0) {
    // кучка, пролежавшая на дороге больше минуты, — тоже раньше заявок, по одной за проход диспетчера. Иначе в
    // занятой деревне (свободных трудяг нет) рассыпанное копилось годами: в мире коопа 84 кучки (отчёт 261026-1839-c751)
    let one = 0;
    collectOutputs(b => b.isPile && !one && World.road[idx(b.x, b.y)] && Game.time - (b.t0 ?? -1e9) > 60 && GOOD_KEYS.some(g => b.offer(g) > 0 && !GOODS[g].noStore) && ++one);
  }
  const reqs = [];
  for (const [d, comp] of compOf) {
    if (!comp || !idleBy.has(comp)) continue;
    if (prioBlocked(d)) continue;      // адресат выключен во вкладке «Приоритеты»
    // трактир на исходе: срочно — только до нормы (INN_LOW), остальное до полного — обычной очередью.
    // Иначе одна «тревога» отправляла в трактир по 30–40 трудяг разом
    let innBudget = d.type === 'inn' && d.state === 'done' && !d.upg ? Math.max(INN_LOW, Game.units.length * 0.1) - innFoodLeft(d) : 0;
    for (const g of GOOD_KEYS) {
      const n = d.demand(g);
      if (n <= 0) continue;
      const pri = reqPri(d, g) - prioScore(d), r = Math.random();
      if (d.type === 'inn' && pri < 0 && FOODS.includes(g)) {
        const urgent = Math.min(n, Math.max(0, Math.ceil(innBudget)));
        innBudget -= urgent;
        if (urgent) reqs.push({ d, g, n: urgent, comp, pri, r });
        if (n > urgent) reqs.push({ d, g, n: n - urgent, comp, pri: 1 - prioScore(d), r });
        continue;
      }
      reqs.push({ d, g, n, comp, pri, r });
    }
  }
  reqs.sort((a, b) => a.pri - b.pri || a.r - b.r);

  let foodOut = false;
  for (const r of reqs) {
    // еда в трактир — самое первое, иначе ферма с полным амбаром забирает всех курьеров, а деревня голодает
    if (r.pri >= 0) collectNearlyFull();          // заявки трактира и пищевых цехов — раньше разгрузки полных ферм
    // после еды для трактира и цехов — урожай и еду с ферм, мельницы, пекарни, бойни,
    // свинарника: иначе склад здания забивается и работа встаёт
    // (не раньше строек: иначе в большой деревне ни одна стройка не дожидалась трудяги)
    if (!foodOut && r.pri >= 1) { foodOut = true; collectOutputs(b => !b.isPile && isFoodProducer(b)); }
    const idle = idleBy.get(r.comp);
    let need = r.n;
    while (need > 0 && idle.length) {
      let src = null, sd = 1e9;
      for (const o of depots) {
        if ((o === r.d && !(r.d.upg && r.d.isStore())) || compOf.get(o) !== r.comp || o.offer(r.g) <= 0) continue;
        // сперва забираем у мастерской — иначе она встанет с полным складом, а склад опустеет
        const dd = mdist(o.doorX, o.doorY, r.d.doorX, r.d.doorY) + (o.isPile || !o.isStore() ? 0 : 25);
        if (dd < sd) { sd = dd; src = o; }
      }
      if (!src) break;
      const avail = src.offer(r.g);
      const u = pickCarrier(idle, src.doorX, src.doorY, r.g, Math.min(need, avail));
      if (!u) break;
      const n = Math.min(need, avail, carryCap(u, r.g));
      assignDelivery(u, src, r.d, r.g, n);
      need -= n;
    }
  }

  collectNearlyFull();
  if (!foodOut) collectOutputs(b => !b.isPile && isFoodProducer(b));
  // рассыпанное по земле (в том числе зерно и хлеб) — раньше, чем продукция неспешных мастерских
  if (haul > 0) {
    collectOutputs(b => b.isPile);
    collectOutputs(b => !b.isPile && !isFoodProducer(b));
  }

  // Готовую продукцию и рассыпанное — на ближайший склад той же сети
  function collectOutputs(pred) {
    for (const b of depots) {
      if (!pred(b)) continue;
      const isP = b.isPile;
      if (!isP && (b.state !== 'done' || b.isStore() || !b.def.outputs)) continue;
      const comp = compOf.get(b), idle = idleBy.get(comp);
      if (!idle || !idle.length) continue;
      const goods = isP ? GOOD_KEYS : Object.keys(b.def.outputs);
      let taken = 0;                                           // на одно здание — не больше 3 перевозчиков за раз (диспетчер идёт каждые 0.4 с)
      const per = isFoodProducer(b) ? 3 : haulPer || 3;       // еду вывозим всегда; прочее — по «Переносу ресурсов»
      for (const g of goods) {
        if (!isP && b.def.crops && cropPlenty(g)) continue;    // зерна и сена на складах вдоволь — пусть лежит на ферме, мельница и свинарник возьмут оттуда
        let left = b.offer(g);
        while (left > 0 && idle.length && taken < per) {
          const st = nearestStore(b.doorX, b.doorY, g, comp);
          if (!st) break;
          const u = pickCarrier(idle, b.doorX, b.doorY, g, left);
          if (!u) break;
          const n = Math.min(left, carryCap(u, g));
          assignDelivery(u, b, st, g, n);
          left -= n; taken++;
        }
      }
    }
  }
}

// стройка на обрывке дороги без склада: материал к ней несут и по траве (как к стройке дороги)
function siteOffNet(b) {
  if (!b || b.isPile || b.isRoad || b.state === 'done' || typeof b.isStore !== 'function') return false;
  const c = compAt(b.doorX, b.doorY);
  return !!c && !Game.buildings.some(s => s.isStore() && compAt(s.doorX, s.doorY) === c);
}

// Ближайший склад, где товар g есть в наличии (откуда взять). В отличие от nearestStore, не смотрит на запрет
// «склад не принимает» и закрытые доставки: они про то, что везут НА склад, а не про то, что с него берут.
// Раньше стройка проверяла только ближайший склад — пустой ближний склад прятал 131 камень на дальнем.
function storeHaving(x, y, g, comp = 0) {
  let best = null, bd = 1e9;
  for (const b of Game.buildings) {
    if (!b.isStore() || b.offer(g) <= 0) continue;
    if (comp && compAt(b.doorX, b.doorY) !== comp) continue;
    const d = Math.abs(b.doorX - x) + Math.abs(b.doorY - y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

function dispatchBuilders() {
  // строитель, записанный за стройкой, мог уйти в напарники героя, погибнуть или взяться за другое —
  // тогда стройка навсегда «занята» и её больше никто не берёт
  const gone = u => u.dead || u.teamOf || !Game.unitMap.has(u.id);
  for (const s of Game.roadSites.values()) if (s.builder && (gone(s.builder) || s.builder.job !== s)) s.builder = null;
  for (const b of Game.buildings) {
    if (b.builder && b.state !== 'done' && (gone(b.builder) || b.builder.job !== b)) b.builder = null;
    if (b.upg && b.upg.builder && (gone(b.upg.builder) || b.upg.builder.job !== b)) b.upg.builder = null;
  }
  // на перерыве (перекур, сон, испуг) не трогаем: иначе proc обнуляется, а brk остаётся — гном до конца стройки
  // «непрерываем» (не ест, не пугается, не ходит на праздник), клетка перекура занята, а после стройки он
  // продолжает прерванное перекуром дело, как будто ничего не было
  let idle = Game.units.filter(u => u.type === 'builder' && u.idleFlag && !u.inside && !u.teamOf && !u.dead && !u.brk && (prioJobLv(u) !== 0 || wkBoosted(u)) && wkMay(u));
  wkPinnedBuilders(idle);              // закреплённые за зданием (workers.js) — только его стройка, достройка, ремонт
  idle = wkTrim(idle);                 // лимит «на работе»
  dispatchRepairs(idle);
  if (!idle.length) return;
  // стройка без материала и без доставки в пути подождёт: работяга без дела там только стоит
  const matOk = (b, st) => ['trunk', 'timber', 'stone'].some(k => st[k] > 0 || b.incoming[k] > 0 ||
    (b.demand(k) > 0 && storeHaving(b.doorX, b.doorY, k, compAt(b.doorX, b.doorY))));   // работяга донесёт сам
  const sites = [
    ...Game.buildings.filter(b => b.state !== 'done' && !b.builder && !b.selfBuild && !b.hold && (b.state === 'site' || matOk(b, b.stock))),
    ...Game.buildings.filter(b => b.upg && !b.upg.builder && matOk(b, b.upg.stock)),
    // дорогу можно копать сразу, а мостить — когда камень на месте или в пути
    ...[...Game.roadSites.values()].filter(s => !s.builder && (s.dug < 1 || s.stock.stone + s.incoming.stone > 0 || storeHaving(s.x, s.y, 'stone'))),
  ].filter(s => !prioBlocked(s));
  if (Game.prio) sites.sort((a, b) => prioScore(b) - prioScore(a));      // «Высокий» приоритет — первым в очереди на работяг
  for (const s of sites) {
    const u = takeNearest(idle, s.doorX, s.doorY);
    if (!u) return;
    if (s.upg && s.state === 'done') s.upg.builder = u; else s.builder = u;
    u.job = s;
    u.idleFlag = false; u.idleStreak = 0;
    u.proc = null; u.action = null; u.anim = null;
  }
  // оставшиеся без дела работяги вскапывают заложенные поля (бесплатно)
  if (idle.length && Game.fieldPlans && Game.fieldPlans.size && prioLv('tasks', 'food') !== 0) {
    for (const i of [...Game.fieldPlans]) {
      const o = World.obj[i];
      if (!o || o.t !== 'field' || !o.plan) { Game.fieldPlans.delete(i); continue; }
      if (o.res) continue;
      const x = i % MAP_W, y = (i / MAP_W) | 0;
      const u = takeNearest(idle, x, y);
      if (!u) break;
      o.res = true;
      u.fieldJob = i;
      u.idleFlag = false; u.idleStreak = 0;
      u.proc = null; u.action = null; u.anim = null;
    }
  }
  // ещё свободные — помогают фермерам убирать созревшие поля
  if (idle.length) {
    for (const b of Game.buildings) {
      if (b.state !== 'done' || !idle.length || !b.def.crops || prioOff(b)) continue;
      for (const f of farmFields(b)) {
        if (f.o.g < 1 || f.o.res || outFull(b, f.o.crop)) continue;

        const u = takeNearest(idle, f.x, f.y);
        if (!u) break;
        f.o.res = true;
        u.helpField = idx(f.x, f.y);
        u.idleFlag = false; u.idleStreak = 0;
        u.proc = null; u.action = null; u.anim = null;
      }
    }
  }
}

// Повреждённое здание чинит любой свободный гном (не только работяга): сначала свободные работяги,
// потом все, кто остался без дела (без дома-работы, не курьер, не герой и не напарник).
function dispatchRepairs(idleBuilders) {
  let todo = null;
  for (const b of Game.buildings) {
    if (b.repairer && (b.repairer.dead || (b.repairer.repairJob !== b && !(b.repairer.proc && b.repairer.repairBusy === b)))) b.repairer = null;   // чинивший погиб или передумал
    if (b.dmg > 0.05 && !b.repairer && !b.removed) (todo || (todo = [])).push(b);
  }
  if (!todo) return;
  const free = Game.units.filter(u => u.idleFlag && !u.inside && !u.dead && !u.brk && u.type !== 'builder' && !u.isCourier &&
    u.type !== 'hero' && !u.teamOf && !UNIT_TYPES[u.type].animal && !u.home && u.type !== 'carter');
  for (const b of todo) {
    const u = takeNearest(idleBuilders, b.doorX, b.doorY) || takeNearest(free, b.doorX, b.doorY);
    if (!u) break;
    b.repairer = u; u.repairJob = b;
    u.idleFlag = false; u.idleStreak = 0;
    u.proc = null; u.action = null; u.anim = null;
  }
}

function dispatchWorkers() {
  const rush = typeof seaWoodRush === 'function' && seaWoodRush();   // дров на зиму мало — дом лесоруба получает свободного гнома первым (season.js)
  // плавильня золота при равном приоритете — раньше оружейной и доспехов: кузнец у них один (без золота школа встаёт)
  const sc = b => (Game.prio ? prioScore(b) : 0) + (rush ? seaRush(b) : 0) + (b.type === 'metallurgist' ? 0.5 : 0);
  const bs = [...Game.buildings].sort((a, b) => sc(b) - sc(a));   // «Высокий» цех получает свободного гнома первым
  for (const b of bs) {
    if (b.state !== 'done' || !b.def.worker || (b.worker && !b.worker.dead && b.worker.home === b)) continue;
    if (prioOff(b)) continue;      // выключен во вкладке «Приоритеты» — нового рабочего не ставим
    b.worker = null;
    // у здания «потерялась» запись о работнике, а сам гном за ним числится — возвращаем запись, а не ищем замену
    const mine = Game.units.find(u => u.home === b && !u.dead && !u.teamOf && u.type !== 'hero');
    if (mine) { b.worker = mine; continue; }
    const idle = Game.units.filter(u => u.type === b.def.worker && !u.home && !u.inside && !u.teamOf && !u.brk && !u.dead);   // не с перерыва (см. dispatchBuilders)
    const u = takeNearest(idle, b.doorX, b.doorY);
    if (!u) continue;
    u.home = b;
    b.worker = u;
    u.idleFlag = false; u.idleStreak = 0;
    u.proc = null; u.action = null; u.anim = null;
  }
}

// Бронь объектов на карте (o.res у деревьев, глыб, полей, брёвен, урн; ROCKMINE.res у скалы) снимает тот, кто её
// поставил, — но не если он погиб, его дом снесли или диспетчер дал ему другое дело (proc просто обнуляют).
// Такая бронь висела вечно: лесоруб обходил «занятое» дерево, каменотёс — глыбу. Раз в ~25 с проверяем:
// у брони нет претендента (никто не стоит рядом, не идёт туда, не держит её в приказе) три проверки подряд — снимаем.
const resStale = new Map();   // индекс клетки -> сколько проверок подряд без претендента
function auditReserved() {
  const claim = new Set();
  const mark = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inb(x + dx, y + dy)) claim.add(idx(x + dx, y + dy)); };
  for (const u of Game.units) {
    if (u.dead) continue;
    mark(Math.floor(u.x), Math.floor(u.y));
    for (const a of [u.action, u.brk && u.brk.saved && u.brk.saved.action]) if (a && a.walk) mark(a.walk[0], a.walk[1]);
    if (u.cmd && u.cmd.i != null) claim.add(u.cmd.i);
    if (u.fieldJob >= 0) claim.add(u.fieldJob);
    if (u.helpField >= 0) claim.add(u.helpField);
  }
  const stale = (i, has = claim.has(i)) => { if (has) { resStale.delete(i); return false; } const n = (resStale.get(i) || 0) + 1; if (n >= 3) { resStale.delete(i); return true; } resStale.set(i, n); return false; };
  // урну (streets.js) бронирует конкретный работяга (o.res = id): претендент — только он сам, иначе урна у людной
  // дороги считалась «занятой» вечно (рядом всегда кто-то стоит) и больше никогда не вытряхивалась
  const binClaim = (o, i) => { const u = Game.unitMap.get(o.res), x = i % MAP_W, y = (i / MAP_W) | 0;
    return !!u && !u.dead && !u.inside && (Math.max(Math.abs(u.x - x - 0.5), Math.abs(u.y - y - 0.5)) <= 1.5 || !!(u.action && u.action.walk && u.action.walk[0] === x && u.action.walk[1] === y)); };
  for (const i of [...resStale.keys()]) { const o = World.obj[i]; if (!(o && o.res) && !ROCKMINE.res.has(i)) resStale.delete(i); }
  for (let i = 0; i < N_TILES; i++) {
    const o = World.obj[i];
    if (!o || !o.res || o.awake) continue;          // awake — ожившее дерево ночи, его бронь снимает nightTick
    if (o.t === 'bin' && typeof o.res === 'number' ? stale(i, binClaim(o, i)) : stale(i)) o.res = false;
  }
  for (const i of [...ROCKMINE.res]) if (stale(i)) ROCKMINE.res.delete(i);
}

let auditT = 0, resT = 0;
function dispatchAll() {
  if ((auditT += 1) >= 8) { auditT = 0; auditIncoming(); if ((resT += 1) >= 8) { resT = 0; auditReserved(); } }      // раз в ~3 с; бронь объектов — раз в ~25 с
  dispatchWorkers();
  dispatchBuilders();
  dispatchSerfs();
  sweepRoadPiles();
}

// Кучка, пять минут пролежавшая на дороге, «подобрана прохожими»: годный груз — на ближайший склад, который его берёт.
// Без этого в деревне с нехваткой трудяг рассыпанное копилось на дорогах часами (кооп: 84 кучки, отчёт 261026-1839-c751).
// Что везут (бронь) и что склад не берёт (мусор, запрет «не принимать») — остаётся на месте.
const PILE_SWEEP_T = 300;
function sweepRoadPiles() {
  for (const p of [...Game.piles.values()]) {
    if (p.removed || !World.road[idx(p.x, p.y)] || Game.time - (p.t0 ?? Game.time) < PILE_SWEEP_T) continue;
    for (const g of GOOD_KEYS) {
      const n = p.offer(g);
      if (n <= 0) continue;
      const st = nearestStore(p.x, p.y, g);
      if (!st) continue;
      st.stock[g] += n; p.stock[g] -= n;
    }
    cleanupPile(p);
  }
}
