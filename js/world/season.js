'use strict';
// Времена года. Лето → осень → зима → весна, круг привязан к игровым суткам (cycleAt из night.js):
// в каждом сезоне Game.sea.len суток (по умолчанию SEASON_DAYS из config.js = 8; ?seasondays=N или localStorage 'feod.seasondays' для новых игр).
// Старые сохранения без поля sea начинают с лета с текущих суток. Game.sea.fixed (0..3) замораживает сезон —
// для карт с постоянной зимой (биом): seaFix(2).
//
// Осень — переходный сезон: поля ещё дают урожай, но игра напоминает о запасах (сено для свиней и зверей).
// Зима — ничего не растёт, ложится снег, реки и озёра замерзают, свиньи и звери едят заготовленное сено;
// нет запасов — скот голодает и гибнет. Появляются ледяные элементали (нейтралы 'frost', логова на дальних полянах).
// Весна — снег тает, лёд сходит, элементали растворяются, погибшая дичь возвращается.
// Всё считает тот, кто считает игру (в кооперативе — сервер), клиенты получают sea зеркалом (seaMirrorOut/In).
// Рисование снега и льда — snow.js, зимние забавы и Дед Мороз — winterlife.js, ледяной элементаль — frostart.js.

const SEA_NAMES = ['Лето', 'Осень', 'Зима', 'Весна'];
const SEA_LEN_DEFAULT = SEASON_DAYS, SEA_LEN_LEGACY = 4, SEA_LEN_MIN = 1, SEA_LEN_MAX = 30;
const SEA_FEED_PERIOD = CYCLE * 2 / 3;  // как часто зимой свиньи и звери едят: 1,5 раза в сутки — 12 кормёжек за зиму из 8 суток
const SEA_FEEDS_PER_DAY = CYCLE / SEA_FEED_PERIOD;
const SEA_PIG_PER_HAY = 4;              // сколько свиней кормит одна охапка за раз
const SEA_WILD_KINDS = ['deer', 'rabbit', 'goat'];
const SEA_SNOW_TIME = 110, SEA_MELT_TIME = 130, SEA_ICE_TIME = 140;
const SEA_STARVE_K = 0.6;              // падёж диких зверей на кормёжку (зима длиннее — на один раунд мягче)
const SEA_PRESNOW = 0.28;             // сколько снега ложится к концу последних осенних суток (ниже порога «земля промёрзла» 0.4)

function seaLoadLen() {
  let n = 0;
  try { const m = /[?&]seasondays=(\d+)/.exec(location.search); n = m ? +m[1] : +localStorage.getItem('feod.seasondays'); } catch (e) {}
  return n >= SEA_LEN_MIN && n <= SEA_LEN_MAX ? Math.floor(n) : SEA_LEN_DEFAULT;
}
function localStorageLen() { try { return !!+localStorage.getItem('feod.seasondays'); } catch (e) { return false; } }
function seaNew() {
  return { off: 0, len: seaLoadLen(), snow: 0, ice: 0, fall: 0, fallTgt: 0, fallT: 0, idx: 0, feedAt: 0, yr: 0, frostYr: -1, santaYr: -1, fixed: null,
    lost: 0, pigsLost: 0, warnDay: -1 };
}
Game.sea = seaNew();
Game.wfx = [];                          // снежки, снеговики, сани (зимние забавы, winterlife.js)
const SEA = () => Game.sea || (Game.sea = seaNew());

// номер суток от начала круга (с учётом смещения старых сохранений)
function seaDay() { return Math.max(0, cycleAt(Game.time).k + SEA().off); }
function seaIdx() {
  const S = SEA();
  if (S.fixed != null) return S.fixed;
  return Math.floor(seaDay() / S.len) % 4;
}
function seaYear() { const S = SEA(); return Math.floor(seaDay() / (S.len * 4)); }
// сколько суток прошло в текущем сезоне (0-based) и доля сезона 0..1
function seaDayIn() { const S = SEA(); return seaDay() % S.len; }
function seaProgress() {
  const S = SEA(), c = cycleAt(Game.time);
  return Math.min(1, (seaDayIn() + Math.min(1, c.p / (CYCLE + c.nl - NIGHT_LEN))) / S.len);
}
const isWinter = () => seaIdx() === 2;
const isAutumn = () => seaIdx() === 1;
const seaName = () => SEA_NAMES[seaIdx()];
// зима «по факту»: снег лежит (не растаял) — ничего не растёт
const seaFrozen = () => seaIdx() === 2 || SEA().snow > 0.4;
// сколько суток осталось до зимы (0 — зима уже идёт); для предупреждений
function seaDaysToWinter() {
  const S = SEA(), idx = seaIdx();
  if (idx === 2) return 0;
  const left = S.len - seaDayIn();
  return (idx === 0 ? left + S.len : idx === 1 ? left : left + S.len * 2);
}
// включить сезон с текущего момента (отладка, постоянная зима биома): seaSet(2)
function seaSet(i) { const S = SEA(); S.off = i * S.len - cycleAt(Game.time).k; S.idx = i; if (i === 2) S.snow = S.ice = 1; }
function seaFix(i) { const S = SEA(); S.fixed = i; S.idx = i; if (i === 2) { S.snow = 1; S.ice = 1; } }
// сменить длину сезона так, чтобы текущие год, сезон и день в нём не скачнули (старые сейвы, отладка)
function seaRelen(S, n) {
  const day = seaDay(), oldLen = S.len, yr = Math.floor(day / (oldLen * 4)), cur = Math.floor(day / oldLen) % 4, di = day % oldLen;
  S.len = n;
  S.off = (yr * 4 + cur) * n + Math.min(di, n - 1) - cycleAt(Game.time).k;
}
function seaSetLen(n) {
  n = Math.max(SEA_LEN_MIN, Math.min(SEA_LEN_MAX, Math.floor(+n) || SEA_LEN_DEFAULT));
  seaRelen(SEA(), n);
  try { localStorage.setItem('feod.seasondays', String(n)); } catch (e) {}
  return n;
}

// ---------- Запасы на зиму ----------

const seaHerd = b => (b.pigs ? b.pigs.length : 0) + (b.stock && b.stock.pig ? b.stock.pig : 0);
function seaPigYards() { return Game.buildings.filter(b => b.type === 'swine' && b.state === 'done' && !b.removed); }
function seaStoreYards() { return Game.buildings.filter(b => b.type === 'storehouse' && b.state === 'done' && !b.removed); }
// сколько сена нужно на зиму и сколько заготовлено (в свинарниках и складах)
function seaHayInfo() {
  const S = SEA(), feeds = Math.ceil(S.len * SEA_FEEDS_PER_DAY);
  let need = 0, have = 0;
  for (const b of seaPigYards()) { need += Math.ceil(Math.max(5, seaHerd(b)) / SEA_PIG_PER_HAY) * feeds; have += b.stock.hay || 0; }
  for (const b of seaStoreYards()) have += b.stock.hay || 0;
  const wild = Game.animals.filter(a => !a.dead && SEA_WILD_KINDS.includes(a.kind) && !a.owner && !a.tamedBy).length;
  const wneed = seaStoreYards().length ? Math.ceil(wild / 4) * Math.ceil(feeds / 2) : 0;
  return { need: need + wneed, have, pigs: need, wild: wneed };
}

// Заготовки: осенью и зимой, пока сена на зиму не хватает, свинарник не разводит свиней — каждая охапка идёт в запас
// (раньше свиньи съедали всё сено ещё осенью, и к зиме склад был пуст). Осенью с поля пшеницы вяжут лишний сноп сена.
function seaHoldHay() {
  const S = SEA(), i = seaIdx();
  if (S.fixed != null || !(i === 1 || i === 2 || (i === 0 && seaDaysToWinter() <= 2))) return false;
  if (S.holdT != null && Math.abs(Game.time - S.holdT) < 3) return S.hold;
  const h = seaHayInfo(), need = i === 2 ? h.pigs * (1 - seaProgress()) : h.pigs;   // дикие звери подождут — свиней кормим первыми
  S.holdT = Game.time; S.hold = h.have < need;
  return S.hold;
}
function seaHayBonus(crop) { return crop !== 'hops' && seaIdx() === 1 && SEA().fixed == null ? 1 : 0; }

// Еда на зиму: зимой поля стоят, хлеб пекут только из запасов зерна. Считаем в обедах (гном ест раз в ~FOOD_TIME·(1−HUNGRY) с):
// готовая еда + мука и зерно (1 зерно → 1 мука → 3 хлеба, если есть мельница и пекарня) + взрослые свиньи (свинья → 3 колбасы)
const SEA_MEAL_FOODS = ['bread', 'sausage', 'chicken', 'croissant', 'steak'];
function seaFoodInfo() {
  const S = SEA(), ppl = Game.units.filter(u => !u.dead && !u.noFood && isPerson(u)).length;
  const meal = FOOD_TIME * (1 - HUNGRY) * dif().food, left = seaIdx() === 2 ? 1 - seaProgress() : 1;
  const need = Math.ceil(ppl * S.len * CYCLE * left / meal);
  let ready = 0, grain = 0, pigs = 0;
  for (const b of Game.buildings) {
    if (b.state !== 'done' || b.removed) continue;
    for (const g of SEA_MEAL_FOODS) ready += b.stock[g] || 0;
    grain += (b.stock.wheat || 0) + (b.stock.flour || 0);
    pigs += b.stock.pig || 0;
  }
  const canBake = Game.buildings.some(b => b.type === 'bakery' && b.state === 'done') && Game.buildings.some(b => b.type === 'mill' && b.state === 'done');
  const have = Math.round(ready + (canBake ? grain * 3 : 0) + pigs * 3);
  return { need, have, ready, grain, ppl };
}
// ---------- Дрова: зимой здания с печью топятся брёвнами ----------
// Раз в WINTER_BURN_EVERY секунд (дом выше уровнем — реже) здание берёт 1 бревно с ближайшего склада и держит тепло до следующего раза.
// Нет бревна — b.cold: дым гаснет, на стенах иней; жильцы хуже спят и простывают (house.js, sickness.js, mood.js), мастерская работает медленнее (jobs.js).
// Склад списывает сервер (тот, кто считает игру); клиент получает b.cold вместе со зданием, а счётчик дров — в зеркале сезона.

const seaHeating = () => seaIdx() === 2 && SEA().fixed == null;     // топят только в обычную зиму
const seaHeated = b => !!b && b.state === 'done' && !b.removed && WINTER_HEATED.includes(b.type);
function seaHeatEvery(b) { return WINTER_BURN_EVERY * (b.type === 'house' ? WINTER_INSULATION[Math.max(1, Math.min(3, b.level || 1)) - 1] : 1); }
function seaWoodStock() { let n = 0; for (const s of seaStoreYards()) n += Math.max(0, (s.stock.trunk || 0) - ((s.reserved && s.reserved.trunk) || 0)); return n; }
// сколько брёвен нужно на оставшуюся зиму (или на целую, пока она не началась) и сколько лежит на складах
function seaWoodInfo() {
  const S = SEA(), left = seaIdx() === 2 ? 1 - seaProgress() : 1;
  let need = 0, n = 0, cold = 0;
  for (const b of Game.buildings) if (seaHeated(b)) { n++; if (b.cold) cold++; need += Math.ceil(S.len * CYCLE * left / seaHeatEvery(b)); }
  return { need, have: seaWoodStock(), n, cold };
}
// брёвен мало, а зима близко или уже идёт: лесорубы получают рабочих первыми и рубят быстрее
function seaWoodRush() {
  const S = SEA(), i = seaIdx();
  if (S.fixed != null || !(i === 1 || i === 2 || (i === 0 && seaDaysToWinter() <= 2))) return false;
  if (S.rushT != null && Math.abs(Game.time - S.rushT) < 5) return S.rush;
  const w = seaWoodInfo();
  S.rushT = Game.time; S.rush = w.n > 0 && w.have < w.need * 1.3;
  return S.rush;
}
// сколько брёвен на каждом складе держим про запас на печи: осенью, зимой и за двое суток до осени; берут только печи (seaTakeWood)
function seaWoodHold() {
  const S = SEA(), i = seaIdx();
  if (S.fixed != null || !(i === 1 || i === 2 || (i === 0 && seaDaysToWinter() <= 2))) return 0;
  if (S.holdWT != null && Math.abs(Game.time - S.holdWT) < 5) return S.holdW;
  const st = seaStoreYards().length, w = seaWoodInfo();
  S.holdWT = Game.time; S.holdW = st && w.n ? Math.ceil(w.need * 0.8 / st) : 0; S.holdLow = !!(st && w.n && w.have < w.need);
  return S.holdW;
}
const seaWoodLow = () => seaWoodHold() > 0 && !!SEA().holdLow;
// Стройкам не хватает досок: на складах и у лесопилок досок меньше, чем ждут стройки и достройки.
// Тогда зимний запас не держит лесопилку голодной: раньше перед зимой она стояла всю осень и зиму,
// и здания, заложенные игроком, не могли достроиться (отзыв владельца 27.10).
function seaTimberShort() {
  const S = SEA();
  if (S.tsT != null && Math.abs(Game.time - S.tsT) < 2) return S.ts;
  let need = 0, have = 0;
  for (const b of Game.buildings) {
    if (b.removed) continue;
    if (b.state !== 'done' || b.upg) need += b.demand('timber');
    else if (b.isStore() || b.type === 'sawmill') have += Math.max(0, b.stock.timber - b.reserved.timber);
  }
  S.tsT = Game.time; S.ts = need > have;
  return S.ts;
}
// Брёвна из зимнего запаса склада отдаём стройке (её заложил игрок, и без неё встаёт всё, даже новый дом лесоруба)
// и лесопилке, когда стройкам не хватает досок или игрок нажал «Срочно». Остальным (торговля, указы, ярмарка) — только сверх запаса.
function seaWoodFor(d) {
  if (!d || d.removed) return false;
  if (d.isRoad || d.state !== 'done' || d.upg) return true;
  return d.type === 'sawmill' && (seaTimberShort() || (typeof urgOn === 'function' && urgOn(d)));
}
const seaRush = d => (d && d.type === 'woodcutter' && seaWoodRush()) ? 1 : 0;
function seaTakeWood(b) {
  let best = null, bd = 1e9;
  for (const s of seaStoreYards()) {
    if ((s.stock.trunk || 0) - ((s.reserved && s.reserved.trunk) || 0) < 1) continue;
    const d = Math.hypot(s.doorX - b.doorX, s.doorY - b.doorY);
    if (d < bd) { bd = d; best = s; }
  }
  if (!best) {                      // склады пусты — печь берёт бревно прямо у дома лесоруба рядом
    for (const s of Game.buildings) {
      if (s.type !== 'woodcutter' || s.state !== 'done' || s.removed || (s.stock.trunk || 0) - ((s.reserved && s.reserved.trunk) || 0) < 1) continue;
      const d = Math.hypot(s.doorX - b.doorX, s.doorY - b.doorY);
      if (d < bd && d < 40) { bd = d; best = s; }
    }
  }
  if (!best) return false;
  best.stock.trunk--;
  return true;
}
function seaHeatTick(now) {
  const S = SEA();
  let froze = 0;
  for (const b of Game.buildings) {
    if (!seaHeated(b)) { if (b.cold) b.cold = false; continue; }
    if (b.burnAt == null) { b.burnAt = now + (b.id * 37) % 40; b.warmUntil = b.burnAt; }   // начало зимы: печи затапливают не все разом
    if (now >= b.burnAt) {
      if (seaTakeWood(b)) {
        const e = seaHeatEvery(b);
        b.warmUntil = now + e * 1.02; b.burnAt = now + e;
        S.burned = (S.burned || 0) + 1;
        if (b.cold) { b.cold = false; floater(b.doorX + 0.5, b.doorY - 1, 'Затопили!', '#ffcf8a'); }
      } else b.burnAt = now + 15;       // на складах пусто — пробуем снова, пока не подвезут
    }
    const cold = now > b.warmUntil;
    if (cold !== !!b.cold) {
      b.cold = cold;
      if (cold) { froze++; floater(b.doorX + 0.5, b.doorY - 1, 'Нет дров — холодно!', '#9ad4ff'); }
    }
  }
  if (froze && now - (S.coldAt || -999) > 120) {
    S.coldAt = now;
    const w = seaWoodInfo();
    toast(`Нет дров: мёрзнет зданий — ${w.cold}. Брёвен на складах: ${w.have}. Поставь дом лесоруба и вези брёвна на склад!`, Game.buildings.find(b => b.cold) || null);
    logEvent('weather', `Зима: без дров мёрзнет зданий — ${w.cold}`);
  }
}
function seaHeatClear() { for (const b of Game.buildings) { b.cold = false; b.burnAt = null; b.warmUntil = 0; } }

// куда вести игрока по нажатию: свинарник (сено), ферма, склад
function seaHayPlace() { return seaPigYards()[0] || Game.buildings.find(b => b.type === 'farm' && b.state === 'done') || seaStoreYards()[0] || null; }

function seaAutumnWarn(first) {
  const S = SEA(), h = seaHayInfo(), f = seaFoodInfo(), w = seaWoodInfo(), d = seaDaysToWinter();
  if (S.warnDay === seaDay()) return;
  S.warnDay = seaDay();
  const when = d <= 1 ? 'Зима уже на пороге' : `До зимы ${d} суток`;
  const farms = Game.buildings.some(b => b.type === 'farm' && b.state === 'done');
  const lackW = w.n > 0 && w.have < w.need;
  if (first) {
    toast(`Осень! Пора делать заготовки: зимой ничего не растёт. Сено ${h.have}/${h.need || '—'}, еда ${f.have}/${f.need} обедов.` + (farms ? '' : ' Построй ферму и заложи поля пшеницы!'), seaHayPlace());
    logEvent('weather', 'Наступила осень: пора заготавливать сено и зерно на зиму');
    if (w.n) logEvent('weather', `Запасите дров: зимой печи съедят ≈${w.need} брёвен, на складах ${w.have}`);
  } else if (d <= 2 && (h.pigs > h.have || f.need > f.have || lackW)) {
    // каждый день не напоминаем — висит закреплённая подсказка вверху (pins.js); тост — за двое и за сутки до зимы
    const miss = [h.pigs > h.have ? `сена ${h.have} из ${h.pigs}` : '', f.need > f.have ? `еды ${f.have} из ${f.need} обедов` : '', lackW ? `дров ${w.have} из ${w.need}` : ''].filter(Boolean).join(', ');
    toast(`${when}: ${miss}. Больше полей пшеницы у ферм и больше брёвен на склад — печи зимой не потушишь`, seaHayPlace());
  } else if (d > 2 && lackW) {
    toast(`Запасите дров: до зимы ${d} суток, брёвен на складах ${w.have} из ${w.need}. Зимой печи в домах, пекарне и кузнице топят брёвнами`, seaStoreYards()[0] || null);
    logEvent('weather', `Запасите дров: на складах ${w.have} из ${w.need} брёвен`);
  } else if (d <= 1 && h.need) toast(`${when}. Запасов хватает — можно зимовать.`);
}

function seaChange(from, to) {
  const S = SEA();
  if (to === 0 && from === 3) { /* новый круг */ }
  const t = [
    'Наступило лето: всё растёт, гномы отдыхают на солнце',
    'Наступила осень: листва желтеет. Заготовь сено и зерно — зимой ничего не растёт!',
    'Пришла зима! Земля под снегом, реки встали. Свиньи и звери едят заготовленное сено',
    'Пришла весна: снег тает, лёд сходит, всё снова растёт',
  ];
  toast(t[to], null, to === 2 ? 'night' : undefined);
  logEvent('weather', t[to]);
  if (typeof track === 'function' && !isServerSim()) track('season-' + to, 'Сезон: ' + SEA_NAMES[to]);
  if (to === 1) { S.warnDay = -1; seaAutumnWarn(true); }
  if (to === 2) {
    S.feedAt = Game.time + SEA_FEED_PERIOD * 0.6; S.yr = seaYear(); S.lost = 0; S.pigsLost = 0; S.fallT = 0;
    seaWildToVillage(true);
    const h = seaHayInfo();
    if (h.need > h.have) toast(`Сена маловато: ${h.have} из ${h.need}. Скот может голодать!`);
    seaHeatClear(); S.burned = 0; S.coldAt = -999; S.rushT = null;
    const w = seaWoodInfo();
    if (w.n) toast(`Печи затоплены: греются здания (${w.n}). Дров на складах ${w.have}, до весны нужно ≈${w.need}`);
  }
  if (from === 2) seaHeatClear();
  if (to === 3) { seaMelt(); seaWildToVillage(false); seaRestoreWild(); }
}

// ---------- Дикие звери зимой ----------

function seaWildToVillage(on) {
  const st = seaStoreYards();
  for (const a of Game.animals) {
    if (a.dead || !SEA_WILD_KINDS.includes(a.kind) || a.owner || a.tamedBy) continue;
    if (on) {
      if (!st.length || a.home0) continue;
      const b = st[(Math.random() * st.length) | 0];
      const s = randomFreeNear(b.doorX, b.doorY, 4, 10, (x, y) => isWalkable(x, y) && !World.bmap[idx(x, y)]);
      if (s) { a.home0 = a.home; a.home = [s[0], s[1]]; }
    } else if (a.home0) { a.home = a.home0; a.home0 = null; }
  }
}
function seaRestoreWild() {
  const S = SEA();
  for (let n = S.lost; n > 0; n--) {
    const kind = SEA_WILD_KINDS[(Math.random() * 2) | 0], s = typeof wildSpot === 'function' ? wildSpot(14, true) : null;
    if (s) Game.animals.push(makeAnimal(kind, s[0], s[1]));
  }
  if (S.lost) toast('Весна: в лесу снова появилась дичь');
  S.lost = 0;
}

// ---------- Корм: свиньи и звери ----------

function seaFeedRound() {
  const S = SEA(), now = Game.time;
  let hungry = 0, died = 0;
  for (const b of seaPigYards()) {
    const herd = seaHerd(b);
    if (!herd) continue;
    const need = Math.ceil(herd / SEA_PIG_PER_HAY), got = Math.min(need, b.stock.hay || 0);
    b.stock.hay = (b.stock.hay || 0) - got;
    b.fedUntil = now + SEA_FEED_PERIOD * 1.05;
    if (got < need) {
      hungry++;
      // нехватка корма: гибнет по свинье за каждую недостающую порцию
      for (let k = need - got; k > 0 && seaHerd(b) > 0; k--) {
        if (b.pigs.length) b.pigs.pop(); else if (b.stock.pig > 0) b.stock.pig--;
        died++;
      }
      b.hungryUntil = now + SEA_FEED_PERIOD;
      floater(b.doorX + 0.5, b.doorY - 1, 'Хрю… голодно', '#ffb0a0');
    } else if (got) floater(b.doorX + 0.5, b.doorY - 1, 'Хрум-хрум', '#e8e0a0');
  }
  if (hungry) { S.pigsLost += died; toast(`Свиньи голодают: в свинарнике нет сена! Пало ${died}. Нужны заготовки`); logEvent('animal', `Зима: свиньи голодают, пало ${died}`); }
  // дикая живность: кормится у складов, где есть сено
  const herb = Game.animals.filter(a => !a.dead && SEA_WILD_KINDS.includes(a.kind) && !a.owner && !a.tamedBy);
  const fedSet = new Set();
  for (const b of seaStoreYards()) {
    let free = Math.max(0, (b.stock.hay || 0) - ((b.reserved && b.reserved.hay) || 0));
    if (!free) continue;
    const near = herb.filter(a => !fedSet.has(a) && Math.hypot(a.x - b.doorX, a.y - b.doorY) < 16);
    for (let i = 0; i < near.length && free > 0; i += 4) {
      b.stock.hay--; free--;
      for (const a of near.slice(i, i + 4)) { fedSet.add(a); a.fedUntil = now + SEA_FEED_PERIOD * 1.1; if (Math.random() < 0.4) floater(a.x, a.y - 0.8, 'Хрум', '#e8e0a0'); }
    }
  }
  // кто не поел — тот ослаб: иногда падает от голода
  let starved = 0;
  for (const a of herb) if (!fedSet.has(a) && !(a.fedUntil > now) && Math.random() < (Game.diff === 'survival' ? 0.25 : Game.diff === 'calm' ? 0.08 : 0.15) * SEA_STARVE_K && herb.length > 3 && starved < 2) { removeAnimal(a); S.lost++; starved++; }
  if (starved) { toast(`Зима: звери голодают, ${starved} не пережили стужу. Оставь им сено на складе`); logEvent('animal', `Зима: ${starved} диких зверей пало от голода`); }
}

// ---------- Ледяные элементали ----------

function seaFrostSites(n) {
  const out = [], cx = MAP_W >> 1, cy = MAP_H >> 1, stamp = floodFrom(cx, cy);
  for (let t = 0; t < 4000 && out.length < n; t++) {
    const x = 5 + ((Math.random() * (MAP_W - 10)) | 0), y = 5 + ((Math.random() * (MAP_H - 10)) | 0), i = idx(x, y);
    if (World.terrain[i] !== T_GRASS || World.bmap[i] || World.road[i] || World.obj[i] || !reachedIn(stamp, x, y)) continue;
    if (Math.hypot(x - cx, y - cy) < 19) continue;
    if (neuVillageDist(x, y) < neuHostileGap() - (t < 3000 ? 0 : 4)) continue;   // разросшейся деревне — запасной проход поближе
    if (Game.lairs.some(l => Math.hypot(l.x - x, l.y - y) < 10) || out.some(o => Math.hypot(o[0] - x, o[1] - y) < 14)) continue;
    out.push([x, y]);
  }
  return out;
}
function seaSpawnFrost() {
  if (typeof neuFillLair !== 'function' || Game.stress) return;
  const S = SEA(), n = Math.max(1, 2 + (Game.buildings.length > 40 ? 1 : 0) + (Game.buildings.length > 90 ? 1 : 0) + (Game.diff === 'survival' ? 1 : Game.diff === 'calm' ? -1 : 0));
  for (const [x, y] of seaFrostSites(n)) {
    const lair = { id: Game.nextId++, k: 'frost', x, y, lv: 1 + Math.min(0.5, Game.buildings.length / 200), respawn: 0, alive: 0, fr: 0 };
    Game.lairs.push(lair);
    neuFillLair(lair);
    fxBurst(x * TILE + 16, y * TILE + 10, 14, ['#ffffff', '#bfe8ff', '#7ac0f0'], 50, 40, 0.9, 1.6, 40);
  }
  S.frostYr = seaYear();
  toast('С дальних полян тянет стужей: в снегах завелись ледяные элементали', null, 'night');
  logEvent('animal', 'Зима: появились ледяные элементали');
}
function seaMelt() {
  let any = false;
  for (const N of Game.neutrals) if (N.k === 'frost' && N.st !== 'die') { N.st = 'die'; N.dt = 0; N.hp = 0; N.tg = 0; N.ov = null; any = true; fxBurst(N.x * TILE, N.y * TILE - 10, 16, ['#ffffff', '#bfe8ff', '#7ac0f0'], 50, 40, 0.9, 1.6, 40); }
  Game.lairs = Game.lairs.filter(l => l.k !== 'frost');
  if (any) logEvent('animal', 'Весна: ледяные элементали растаяли');
}
// элементаль не дружит ни с кем: бросается на любого, кто подошёл к логову
function seaFrostAggro() {
  for (const N of Game.neutrals) {
    if (N.k !== 'frost' || N.st === 'die' || N.tg) continue;
    let best = null, bd = 6.5;
    for (const u of Game.units) {
      if (u.dead || u.inside || !(u.type === 'hero' || isPerson(u))) continue;
      if (u.hero && u.hero.hp <= 0) continue;
      const d = Math.hypot(u.x - N.x, u.y - N.y);
      if (d < bd) { bd = d; best = u; }
    }
    if (best) neuProvoke(N, best);
  }
}

// ---------- Ход времени ----------

// на сколько должна быть заснежена земля: к концу осени — припорошило, зимой — сугробы, весной тает за первую треть сезона
function seaSnowTarget(i) {
  if (i === 2) return 1;
  if (i === 1) { const p = seaProgress(); return p > 0.8 ? SEA_PRESNOW * Math.min(1, (p - 0.8) / 0.2) : 0; }
  if (i === 3) return Math.max(0, 1 - seaProgress() * 3);
  return 0;
}
function seaAnim(dt) {      // и клиент, и сервер: плавное движение снега и льда к цели
  const S = SEA(), i = seaIdx(), win = i === 2;
  const tgt = seaSnowTarget(i);
  S.snow += Math.sign(tgt - S.snow) * Math.min(Math.abs(tgt - S.snow), dt / (tgt > S.snow ? SEA_SNOW_TIME : SEA_MELT_TIME));
  const itgt = (win && S.snow > 0.7) || (i === 3 && S.ice > 0 && S.snow > 0.45) ? 1 : 0;   // весной лёд сходит, когда снег уже сошёл наполовину
  S.ice += Math.sign(itgt - S.ice) * Math.min(Math.abs(itgt - S.ice), dt / (itgt ? SEA_ICE_TIME : SEA_ICE_TIME * 0.6));
  S.fall += Math.sign(S.fallTgt - S.fall) * Math.min(Math.abs(S.fallTgt - S.fall), dt / 8);
}

function seaTick(dt) {
  const S = SEA();
  if (isMirror()) return;
  const idx = seaIdx();
  if (S.idx !== idx) { const from = S.idx; S.idx = idx; if (from !== idx) seaChange(from, idx); }
  seaAnim(dt);
  S.tickT = (S.tickT || 0) + dt;
  // снегопад: волнами
  S.fallT -= dt;
  if (S.fallT <= 0) {
    if (idx === 2) { S.fallTgt = [0.15, 0.4, 0.7, 1][(Math.random() * 4) | 0]; S.fallT = 40 + Math.random() * 70; }
    else if (idx === 1 && seaProgress() > 0.85) { S.fallTgt = 0.12; S.fallT = 40 + Math.random() * 40; }   // первые снежинки перед зимой
    else if (idx === 3 && S.snow > 0.2) { S.fallTgt = Math.random() < 0.3 ? 0.3 : 0; S.fallT = 60 + Math.random() * 60; }
    else { S.fallTgt = 0; S.fallT = 30; }
  }
  if (S.tickT < 1) return;
  S.tickT = 0;
  if (idx === 1) {
    const dd = seaDayIn();
    if (dd !== S.warnD2) {
      S.warnD2 = dd;
      const d = seaDaysToWinter();          // напоминаем не каждые сутки, а за 4, 2 и 1 сутки до зимы
      if (dd > 0 && d <= Math.ceil(S.len / 2) && (d <= 2 || d % 2 === 0)) seaAutumnWarn(false);
    }
  }
  if (idx === 2) {
    if (S.fixed == null) seaHeatTick(Game.time);       // на картах с вечной зимой печи не считаем
    if (Game.time >= S.feedAt) { S.feedAt = Game.time + SEA_FEED_PERIOD; seaFeedRound(); }
    if (S.frostYr !== seaYear() && S.snow > 0.55 && Game.time > 60) seaSpawnFrost();
    seaFrostAggro();
  }
  // ранний сейв в разгар зимы без логов: элементалей нет — но и спавн уже был; позже они не возвращаются
}

{
  // зимой не растёт ничего: поля стоят, деревья не подрастают, пни не гниют; осенью растёт медленнее
  const _ug = updateGrowth;
  updateGrowth = function (dt) {
    if (seaFrozen()) return;
    _ug(seaIdx() === 1 ? dt * 0.75 : dt);
  };
  // зимой дождя нет — идёт снег (snow.js рисует метель)
  const _rs = rainStart;
  rainStart = function (len) {
    if (seaIdx() === 2 || SEA().snow > 0.3) { WX.target = 0; WX.nextRain = Game.time + 200 + Math.random() * 200; return; }
    _rs(len);
  };
  const _reset = resetGameState;
  resetGameState = function () { _reset(); Game.sea = seaNew(); Game.wfx = []; };
  const _setup = setupStart;
  setupStart = function (seed, ...o) { _setup(seed, ...o); Game.sea = Game.sea && Game.sea.fixed != null ? Game.sea : seaNew(); };
  const _ser = serializeGame;
  serializeGame = function () {
    const s = _ser(), S = SEA();
    s.sea = { v: 2, off: S.off, len: S.len, snow: +S.snow.toFixed(3), ice: +S.ice.toFixed(3), idx: S.idx, yr: S.yr, fy: S.frostYr, sy: S.santaYr, fx: S.fixed,
      lost: S.lost, pl: S.pigsLost, fd: Math.max(0, Math.round(S.feedAt - Game.time)),
      sm: (Game.wfx || []).filter(w => w.k === 'man').map(w => [w.x, w.y, w.hat, w.scarf, w.face]) };
    return s;
  };
  const _apply = applySave;
  applySave = function (s) {
    _apply(s);
    const S = Game.sea = seaNew();
    Game.wfx = [];
    if (s.sea) {
      const q = s.sea;
      S.off = q.off || 0; S.len = q.len || SEA_LEN_LEGACY; S.snow = q.snow || 0; S.ice = q.ice || 0; S.idx = q.idx != null ? q.idx : seaIdx();
      S.yr = q.yr || 0; S.frostYr = q.fy != null ? q.fy : -1; S.santaYr = q.sy != null ? q.sy : -1; S.fixed = q.fx != null ? q.fx : null;
      S.lost = q.lost || 0; S.pigsLost = q.pl || 0; S.feedAt = Game.time + (q.fd || 0);
      // сохранения, где сезон был 4 суток: растягиваем до SEASON_DAYS, но год, сезон и сутки в нём остаются прежними
      if (!q.v && S.fixed == null && S.len === SEA_LEN_LEGACY && S.len !== SEA_LEN_DEFAULT && !localStorageLen()) { S.idx = q.idx != null ? q.idx : 0; seaRelen(S, SEA_LEN_DEFAULT); S.idx = seaIdx(); }
      for (const m of q.sm || []) Game.wfx.push({ k: 'man', id: Game.nextId++, x: m[0], y: m[1], hat: m[2], scarf: m[3], face: m[4] || 1, born: Game.time });
    } else {
      // старое сохранение: лето начинается с текущих суток
      S.off = -cycleAt(Game.time).k; S.idx = 0;
    }
  };
  const _step = step;
  step = function (dt) { _step(dt); seaTick(dt); };
}

// ---------- Кооператив ----------

function seaMirrorOut() {
  const S = SEA();
  return { off: S.off, len: S.len, snow: +S.snow.toFixed(3), ice: +S.ice.toFixed(3), fall: +S.fall.toFixed(2), fallTgt: S.fallTgt, idx: S.idx, fixed: S.fixed,
    h: seaHayInfo(), w: seaWoodInfo() };
}
function seaMirrorIn(m) {
  if (!m) return;
  const S = SEA();
  const prev = S.idx;
  S.off = m.off; S.len = m.len; S.snow = m.snow; S.ice = m.ice; S.fall = m.fall; S.fallTgt = m.fallTgt; S.idx = m.idx; S.fixed = m.fixed;
  S.hay = m.h; S.wood = m.w;
  if (prev !== S.idx) { S.chg = Game.time; }
}
