'use strict';
// Поселения диких гномов (ДИКИЕ_ГНОМЫ.md, порции 2–4). Далеко от старта стоят лагерь, деревня или крепость одной из фракций:
// Медноборы, Мхиные, Сизые кланы, Песочники. Постройки — те же модели из bmodels.js, но со своими флагами, частоколом и жителями
// в колпаках цвета фракции. Число поселений: малая карта — 2, средняя — 3, большая — 4; злых — 1, 1 и 2 (не больше двух).
// Клик по поселению — окно у ворот (окно дилемм dilemma.js, в коопе голосование): обмен по курсу фракции, караван, подарок,
// поединок с вождём. Отношение −100…100: сделки и караваны поднимают, отказы и поражения роняют; ≥ 50 — союз (хлеб в голод).
// Дружеские поселения сами шлют купцов (путники из travelers.js), злые — воров и разбойников.
// Поединок: мир замирает, идут только герой и вождь; вождь — сложный бот со стилем фракции (тяжёлые удары, уклоны и яд, щит
// и контрудар, песок в глаза), читает удары героя и уходит перекатом. Победа — деревня наша на WG_OWN_DAYS суток (дань, жители),
// потом бунт, и она снова нейтральна. В коопе поединок пока недоступен (окно его не предлагает).
// Состояние — Game.wild (в сохранение), клиентам коопа — зеркало mir.wild, клик — сообщение {t:'wild', a:'gate', id}.
// Подключается после travelers.js: всё через обёртки.

const WG_W = 13, WG_H = 10;      // участок поселения в клетках; ворота — середина нижнего края
const WG_OWN_DAYS = 3;           // столько суток завоёванная деревня платит дань, потом бунт
const WG_DUEL_T = 90;            // поединок дольше — ничья
const WG_ARENA_R = 4.5;          // круг арены перед воротами
const WG_CLEAR = new Set(['tree', 'stump', 'log', 'stone']);     // это под поселение расчищается

// tr — обмен [отдаём, получаем], car — караван [везём, привезут], st — стиль вождя
const WG_FAC = {
  copper: { name: 'Медноборы', hat: '#c8642a', body: '#7a4a2a', beard: '#d8742a', flag: '#b8501e', emb: '#ffd070', st: 'heavy', rel: 0,
    d: 'Рыжебородые рудокопы с топорами за поясом. Железо у них есть, хлеба вечно не хватает.',
    tr: [[{ bread: 6 }, { iron: 3 }], [{ beer: 4 }, { ironore: 5 }]], car: [{ bread: 10 }, { iron: 6, ironore: 4 }],
    names: ['Медный Лог', 'Рыжая Падь', 'Кайло-на-Горке'] },
  moss: { name: 'Мхиные', hat: '#4a8a3a', body: '#3a5a2a', beard: '#9ab070', flag: '#2e6a2a', emb: '#c8f0a0', st: 'dodge', rel: 10,
    d: 'Лесники и травники в зелёных колпаках. Пахнут мхом, торгуют маной и брёвнами, мясо любят больше, чем признаются.',
    tr: [[{ sausage: 4 }, { mana: 2 }], [{ iron: 2 }, { trunk: 8 }]], car: [{ sausage: 8 }, { mana: 3, hops: 6 }],
    names: ['Мшистый Дол', 'Зелёный Пень', 'Тихая Хвоя'] },
  grey: { name: 'Сизые кланы', hat: '#7a8a9a', body: '#4a5a6a', beard: '#c8ccd4', flag: '#5a6a7a', emb: '#e8ecf0', st: 'shield', rel: -5,
    d: 'Седые щитоносцы за каменной стеной. Камня у них — горы, досок — ни щепки.',
    tr: [[{ timber: 6 }, { stone: 8 }], [{ bread: 6 }, { sword: 1 }]], car: [{ timber: 10 }, { stone: 12 }],
    names: ['Сизая Твердь', 'Пепельный Кряж', 'Щит-Гора'] },
  sand: { name: 'Песочники', hat: '#d8b050', body: '#a8803a', beard: '#e8d8a8', flag: '#d0a028', emb: '#7a3a12', st: 'sand', rel: 15,
    d: 'Жёлтые колпаки, хитрые глаза, весы на поясе. Песочники купят что угодно — и продадут это же дороже.',
    tr: [[{ stone: 6 }, { gold: 4 }], [{ hide: 4 }, { leather: 4 }]], car: [{ beer: 8 }, { gold: 8 }],
    names: ['Песчаный Брод', 'Жёлтая Пристань', 'Барханы'] },
};
// b — постройки [тип, dx, dy] внутри участка; hp/lv — сила вождя
const WG_KIND = {
  camp: { name: 'Лагерь', pop: 3, hp: 1, lv: 1, fence: 0, b: [['bonfire', 5, 4], ['woodcutter', 1, 3], ['woodcutter', 10, 3]] },
  village: { name: 'Деревня', pop: 5, hp: 1.3, lv: 1.15, fence: 'wood', b: [['inn', 1, 1], ['bakery', 6, 1], ['woodcutter', 9, 1], ['bonfire', 5, 5]] },
  fort: { name: 'Крепость', pop: 6, hp: 1.6, lv: 1.3, fence: 'stone', b: [['storehouse', 1, 1], ['weaponsmith', 6, 1], ['quarry', 10, 1], ['bonfire', 5, 5]] },
};
const WG_TIER = { cold: 'Смотрят исподлобья: курс у них сейчас грабительский.', ok: 'Встречают ровно: торговать можно.', ally: 'Встречают как своих: лучший курс и место у костра.' };
// сколько поселений на карте и сколько из них злых: малая (96×72) — 2/1, средняя (128×96) — 3/1, большая (160×120) — 4/2
function wgWant() { const n = MAP_W * MAP_H; return n < 8000 ? 2 : n < 14000 ? 3 : 4; }
function wgEvilMax() { return wgWant() >= 4 ? 2 : 1; }

// ---------- События у ворот (окно dilemma.js) ----------

const wgGood = g => (typeof GOODS !== 'undefined' && GOODS[g] ? GOODS[g].name.toLowerCase() : g);
const wgList = o => Object.keys(o).map(g => `${wgGood(g)} ×${o[g]}`).join(', ');
const wgScale = (o, k) => { const r = {}; for (const g in o) r[g] = Math.max(1, Math.round(o[g] * k)); return r; };
const wgMul = tier => (tier === 'ally' ? 1.5 : tier === 'cold' ? 0.67 : 1);
const WG_EVENTS = [];
for (const f in WG_FAC) {
  const F = WG_FAC[f];
  const duel = { t: 'Вызвать вождя на поединок', req: 'hero', fx: { wg: 'duel' }, out: 'Вождь снял колпак, поплевал на ладони и вышел на круг перед воротами.' };
  for (const tier of ['cold', 'ok', 'ally']) {
    const k = wgMul(tier), o = F.tr.map(([give, get]) => ({ t: `Обмен: ${wgList(give)} → ${wgList(wgScale(get, k))}`, cost: give, fx: { res: wgScale(get, k), wg: 'deal' },
      out: 'Ударили по рукам. Товар пересчитали дважды — у диких гномов так принято.' }));
    if (tier === 'cold') o.push({ t: 'Задобрить подарком', cost: { gold: 4 }, fx: { wg: 'gift' }, out: 'Вождь попробовал монету на зуб и впервые улыбнулся. Зуб, кажется, золотой.' });
    else o.push({ t: `Снарядить караван: ${wgList(F.car[0])}`, cost: F.car[0], fx: { wg: 'caravan' }, out: 'Тележка заскрипела к ним по дороге. Вернётся с товаром — если по пути никто не позарится.' });
    o.push(duel, { t: 'Уйти', def: 1, out: 'Постояли у ворот, поглядели на чужие флаги и пошли домой.' });
    WG_EVENTS.push({ id: `wg_${f}_${tier}`, t: `${F.name}: у ворот`, ic: 'trade', r: 1, c: { chainOnly: true }, d: F.d + ' ' + WG_TIER[tier], o });
  }
  WG_EVENTS.push({ id: `wg_${f}_evil`, t: `${F.name}: злое поселение`, ic: 'log_animal', r: 1, c: { chainOnly: true },
    d: `${F.d} Только эти — злые: на воротах черепа, а их воры уже бывали у нашего склада. Говорят только с тем, кто сильнее.`,
    o: [duel, { t: 'Откупиться: 5 золота', cost: { gold: 5 }, fx: { wg: 'bribe' }, out: 'Монеты исчезли за воротами. Пару дней их воры к нам не сунутся.' },
      { t: 'Уйти', def: 1, out: 'Из-за частокола свистнули вслед. Свистеть они умеют.' }] });
  const [give, get] = F.tr[0];
  WG_EVENTS.push({ id: `tv_wg_${f}`, t: `Купец: ${F.name}`, ic: 'trade', r: 1, c: { chainOnly: true },
    d: `Купец в колпаке цвета своего клана (${F.name}) пришёл прямо к складу с тележкой. Курс у него лучше, чем у ворот.`,
    o: [{ t: `Обмен: ${wgList(give)} → ${wgList(wgScale(get, 1.25))}`, cost: give, fx: { res: wgScale(get, 1.25), wg: 'trdeal', trav: 'leave' }, out: 'Купец доволен, мы довольны, тележка поехала обратно легче, чем пришла.' },
      { t: 'Угостить пивом', cost: { beer: 2 }, fx: { wg: 'treat', trav: 'leave' }, out: 'Выпили за дружбу кланов. Купец обещал замолвить словечко вождю.' },
      { t: 'Отказать', def: 1, fx: { wg: 'snub', trav: 'leave' }, out: 'Купец развернул тележку. Вождю он тоже кое-что расскажет.' }] });
}
if (typeof DIL_EVENTS !== 'undefined') for (const e of WG_EVENTS) { DIL_EVENTS.push(e); DIL_BY_ID[e.id] = e; }
// купцы поселений — путники (travelers.js), но приходят только от своих ворот
if (typeof TV_KINDS !== 'undefined') {
  for (const f in WG_FAC) {
    const F = WG_FAC[f];
    TV_KINDS['wt_' + f] = { name: 'Купец: ' + F.name, emo: 'good', w: 0, spd: 1.3, goal: 'store', stay: 40, body: F.body, hat: F.hat, beard: F.beard, pack: 1, ev: 'tv_wg_' + f, wg: f };
  }
}

// ---------- Состояние и размещение ----------

const wgServer = () => typeof coop !== 'undefined' && !!coop && !!coop.out && !!coop.players;
const wgMirror = () => typeof Coop !== 'undefined' && !!Coop.on;
const wgCoopOn = () => wgServer() && coop.players.size > 0;      // сервер с игроками (без них — одиночная симуляция)
const wgHero = () => (typeof tvHero === 'function' && tvHero()) || Game.units.find(u => u.type === 'hero' && !u.dead && u.hero && u.hero.hp > 0) || null;
function wgEnsure() { return Game.wild || (Game.wild = { list: [], cars: [], duel: null, day: -1, acc: 0 }); }
const wgDay = () => cycleAt(Game.time).k;
const wgGate = S => [S.x + 6, S.y + WG_H];                     // клетка перед воротами
const wgBy = id => (Game.wild ? Game.wild.list.find(S => S.id === id) : null) || null;
const wgByFac = f => (Game.wild ? Game.wild.list.find(S => S.fac === f) : null) || null;
const wgName = S => `${WG_KIND[S.kind].name} «${S.name}»`;
function wgTier(S) { return S.evil ? 'evil' : S.rel < -20 ? 'cold' : S.rel >= 50 ? 'ally' : 'ok'; }
function wgLog(text, S) { if (typeof logEvent === 'function') logEvent('trade', text, S ? S.x + 6.5 : undefined, S ? S.y + 5 : undefined); }
function wgSay(text) { if (wgServer()) coop.out.push({ msg: { t: 'toast', text } }); else if (typeof toast === 'function') toast(text); }

// занятые клетки: постройки и частокол (кроме ворот)
function wgCells(S) {
  const K = WG_KIND[S.kind], out = [];
  for (const [t, dx, dy] of K.b) { const B = BUILDINGS[t]; for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) out.push(idx(S.x + dx + x, S.y + dy + y)); }
  if (K.fence) for (let x = 0; x < WG_W; x++) for (let y = 0; y < WG_H; y++) {
    if (x > 0 && x < WG_W - 1 && y > 0 && y < WG_H - 1) continue;
    if (y === WG_H - 1 && x >= 5 && x <= 7) continue;            // ворота
    out.push(idx(S.x + x, S.y + y));
  }
  return out;
}
function wgMark(S) { for (const i of wgCells(S)) if (!World.obj[i] || World.obj[i].t === 'wgb') World.obj[i] = { t: 'wgb', blk: 1 }; }

function wgTrySite(rng, stamp, home, minD, townR) {
  const x = 2 + (rng() * (MAP_W - WG_W - 4) | 0), y = 2 + (rng() * (MAP_H - WG_H - 8) | 0);
  const [gx, gy] = [x + 6, y + WG_H];
  if (Math.hypot(gx - home[0], gy - home[1]) < minD) return null;
  const bad = wgArea(x, y, (xx, yy) => {
    if (!inb(xx, yy)) return true;
    const i = idx(xx, yy), t = World.terrain[i], o = World.obj[i];
    return t === T_WATER || t === T_ROCK || World.bmap[i] || World.road[i] || (o && !WG_CLEAR.has(o.t));
  });
  if (bad || !reachedIn(stamp, gx, gy)) return null;
  if (typeof MOUNTS !== 'undefined' && MOUNTS.some(m => {                     // нарисованная гора не должна налезать на двор и арену
    const Z = MT_SIZES[m.size], mx = m.x / TILE, my = m.y / TILE, hw = Z.w / TILE / 2 + 1;
    return mx + hw > x && mx - hw < x + WG_W && my + 1 > y && my - Z.h / TILE < y + WG_H + 4;
  })) return null;
  if (Game.buildings.some(b => Math.hypot(b.x - gx, b.y - gy) < townR)) return null;
  const F = Game.foe;
  if (F && Math.hypot(F.tx + 1.5 - (x + 6), F.ty + 2 - (y + 6)) < Math.min(20, townR)) return null;          // от Чёрного шпиля подальше
  if ((Game.lairs || []).some(l => Math.hypot(l.x - (x + 6), l.y - (y + 5)) < 9)) return null;
  if (Game.wild.list.some(S => Math.hypot(S.x - x, S.y - y) < 18)) return null;
  return { x, y };
}
// участок поселения и арена перед воротами; cb вернул true — дальше не смотрим
function wgArea(x, y, cb) {
  for (let yy = y; yy < y + WG_H + 3; yy++) {
    const arena = yy >= y + WG_H;
    for (let xx = arena ? x + 2 : x; xx < (arena ? x + WG_W - 2 : x + WG_W); xx++) if (cb(xx, yy)) return true;
  }
  return false;
}

function wgAdd(site, fac, kind, evil, rng) {
  const F = WG_FAC[fac], rep = (Game.dil && Game.dil.rel && Game.dil.rel.road) || 0;
  const S = { id: 9e8 + Game.wild.list.length, fac, kind, x: site.x, y: site.y, name: F.names[(rng() * F.names.length) | 0], evil: evil ? 1 : 0,
    rel: evil ? -60 : F.rel + rep * 8, own: 0, up: 0, calm: 0, deals: 0, nextTr: 3, nextRaid: 4 };
  wgArea(S.x, S.y, (xx, yy) => {                                 // вырубка под поселение и арену
    const i = idx(xx, yy), o = World.obj[i];
    if (o && WG_CLEAR.has(o.t)) { World.obj[i] = null; World.growing.delete(i); }
  });
  Game.wild.list.push(S);
  wgMark(S);
  return S;
}

function wgSpawnAll(seed) {
  Game.wild = null;
  const W = wgEnsure();
  if (Game.stress || (typeof MapOpt !== 'undefined' && MapOpt.custom && MapOpt.custom.nm !== 'auto')) return;
  const rng = mulberry32(((seed | 0) ^ 0x6A0E5) >>> 0);
  const st = Game.buildings.find(b => b.isStore && b.isStore()) || null, diag = Math.hypot(MAP_W, MAP_H);
  const home = st ? [st.x, st.y] : [MAP_W >> 1, MAP_H >> 1];
  const stamp = floodFrom(home[0] | 0, home[1] | 0);
  const want = wgWant(), facs = Object.keys(WG_FAC);
  for (let i = facs.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [facs[i], facs[j]] = [facs[j], facs[i]]; }
  const evil = wgEvilMax();
  for (let minD = diag * 0.28; W.list.length < want && minD > 8; minD -= 5) {
    for (let tries = 0; W.list.length < want && tries < 3000; tries++) {
      const site = wgTrySite(rng, stamp, home, minD, Math.min(22, diag * 0.15));
      if (!site) continue;
      const far = Math.hypot(site.x + 6 - home[0], site.y + WG_H - home[1]) / Math.hypot(MAP_W, MAP_H);
      const kind = far > 0.42 ? 'fort' : rng() < 0.5 ? 'village' : 'camp';
      wgAdd(site, facs[W.list.length % facs.length], kind, false, rng);
    }
  }
  // злые — самые дальние, если поселений хотя бы два (одно-единственное пусть будет добрым)
  const far = W.list.slice().sort((a, b) => Math.hypot(b.x - home[0], b.y - home[1]) - Math.hypot(a.x - home[0], a.y - home[1]));
  for (const S of far.slice(0, W.list.length >= 2 ? Math.min(evil, W.list.length - 1) : 0)) { S.evil = 1; S.rel = -60; }
}

// ---------- Ход: купцы, набеги, дань, бунт, караваны ----------

function wgDaily(day) {
  const W = Game.wild;
  for (const S of W.list) {
    const F = WG_FAC[S.fac];
    if (S.own) {
      if (day >= S.own) {                                          // срок вышел — бунт
        S.own = 0; S.evil = 0; S.rel = -10; S.up = (S.up || 0) + 0.2;
        wgLog(`Бунт: ${wgName(S)} скинул нашу руку и снова сам по себе. Вождь окреп и ждёт нового вызова`, S);
        wgSay(`Бунт в поселении «${S.name}»! Оно снова нейтрально — можно торговать или вызвать вождя ещё раз`);
        continue;
      }
      const g = wgScale(F.car[1], 0.5);
      for (const k in g) dilGive(k, g[k]);
      wgLog(`Дань от поселения «${S.name}»: ${wgList(g)}`, S);
      continue;
    }
    if (S.evil) {
      if (day < S.nextRaid || day < S.calm || day < 3 || typeof tvSpawn !== 'function') continue;
      S.nextRaid = day + 2 + (Math.random() < 0.5 ? 1 : 0);
      if (Game.trav && Game.trav.list.length >= TV_MAX) continue;
      const k = Math.random() < 0.5 && tvFighters().length ? 'brigand' : 'thief';
      const T = wgSendTraveler(S, k);
      if (T) wgLog(`Из злого поселения «${S.name}» вышел ${TV_KINDS[k].name.toLowerCase()}`, S);
      continue;
    }
    if (S.rel >= 50 && dilHave('bread') + dilHave('sausage') < 8) {
      dilGive('bread', 6);
      wgLog(`Союзники из «${S.name}» прислали 6 хлеба: прослышали, что у нас голодно`, S);
    }
    if (S.rel >= 10 && day >= S.nextTr && typeof tvSpawn === 'function' && !(Game.trav && Game.trav.list.length >= TV_MAX)) {
      S.nextTr = day + 2 + (Math.random() < 0.5 ? 1 : 0);
      if (wgSendTraveler(S, 'wt_' + S.fac)) wgLog(`Из «${S.name}» к нам идёт купец`, S);
    }
  }
}

// путник выходит из ворот поселения (а не с края карты) и уходит обратно туда же
function wgSendTraveler(S, k) {
  const T = tvSpawn(k);
  if (!T) return null;
  const [gx, gy] = wgGate(S), end = T.route[T.route.length - 1];
  const p = findPath(gx, gy, end[0], end[1], false, 0, 40000, 0.9);
  if (p && p.length) { T.route = [[gx, gy], ...p]; T.pi = 0; T.x = gx + 0.5; T.y = gy + 0.5; }
  T.wg = S.id;
  return T;
}

function wgCaravan(S) {
  const st = tvStore();
  if (!st) return null;
  const a = isWalkable(st.doorX, st.doorY + 1) ? [st.doorX, st.doorY + 1] : [st.doorX, st.doorY];
  const [gx, gy] = wgGate(S);
  const p = findPath(a[0], a[1], gx, gy, false, 0, 40000, 0.9);
  if (!p || !p.length) return null;
  const C = { id: Game.nextId++, s: S.id, route: [a, ...p], pi: 0, dir: 1, x: a[0] + 0.5, y: a[1] + 0.5, f: 1, wait: 0, load: wgScale(WG_FAC[S.fac].car[1], wgMul(wgTier(S))) };
  Game.wild.cars.push(C);
  return C;
}
function wgCarTick(C, dt) {
  if (C.wait > 0) { C.wait -= dt; return false; }
  if (tvMove(C, dt, C.dir, 1.6)) {
    const S = wgBy(C.s);
    if (C.dir > 0) {
      C.dir = -1; C.wait = 6;
      if (S) floater(C.x, C.y - 2, 'Меняем товар!', '#ffe9a0');
      return false;
    }
    for (const g in C.load) dilGive(g, C.load[g]);
    if (S) { wgRel(S, 6, null); wgLog(`Караван вернулся из «${S.name}»: ${wgList(C.load)}`, S); }
    wgSay('Караван вернулся с товаром: ' + wgList(C.load));
    return true;
  }
  return false;
}

function wgRel(S, n, chips) {
  const was = wgTier(S);
  S.rel = Math.max(-100, Math.min(S.evil ? -10 : 100, S.rel + n));
  if (chips) chips.push({ k: n > 0 ? 'up' : 'dn', t: `«${S.name}» ${n > 0 ? '+' : '−'}${Math.abs(n)}` });
  const now = wgTier(S);
  if (now !== was && now === 'ally') { wgLog(`${wgName(S)} теперь наш союзник: лучший курс, хлеб в голод`, S); wgSay(`«${S.name}» — союзники! Курс лучше, в голод пришлют хлеба`); }
  else if (now !== was && now === 'cold') wgLog(`${wgName(S)} обиделся: курс у ворот стал грабительским`, S);
}

function wgTick(dt) {
  const W = Game.wild;
  if (!W || !W.list.length) return;
  for (let i = W.cars.length - 1; i >= 0; i--) if (wgCarTick(W.cars[i], dt)) W.cars.splice(i, 1);
  W.acc += dt;
  if (W.acc < 1) return;
  W.acc = 0;
  const day = wgDay();
  if (W.day < 0) W.day = day;
  if (day !== W.day) { W.day = day; wgDaily(day); }
}

// ---------- Окно у ворот ----------

function wgTalk(id) {
  const S = wgBy(id);
  if (!S || typeof dilOpen !== 'function') return { ok: false, text: '' };
  if (Game.wild.duel) return { ok: false, text: 'Идёт поединок' };
  if (S.own) return { ok: false, text: `«${S.name}» под нашей рукой ещё ${Math.max(1, S.own - wgDay())} сут. — дань приходит каждое утро` };
  const d = dilEnsure();
  if (d.cur) return { ok: false, text: 'Сначала решите текущее событие' };
  const e = DIL_BY_ID[`wg_${S.fac}_${wgTier(S)}`];
  if (!e) return { ok: false, text: '' };
  if (typeof tvForceModal === 'function') tvForceModal();
  const nx = d.next;
  dilOpen(e);
  d.next = nx;
  return { ok: true, text: '' };
}

function wgFx(S, act, chips) {
  if (act === 'deal') { S.deals++; wgRel(S, 4, chips); }
  else if (act === 'gift') wgRel(S, 12, chips);
  else if (act === 'bribe') { S.calm = wgDay() + 3; wgRel(S, 5, chips); }
  else if (act === 'trdeal') { S.deals++; wgRel(S, 5, chips); }
  else if (act === 'treat') wgRel(S, 8, chips);
  else if (act === 'snub') wgRel(S, -4, chips);
  else if (act === 'caravan') {
    if (wgCaravan(S)) { wgRel(S, 2, chips); chips.push({ k: 'up', t: 'Караван в пути' }); }
    else { for (const g in WG_FAC[S.fac].car[0]) dilGive(g, WG_FAC[S.fac].car[0][g]); chips.push({ k: 'warn', t: 'Нет дороги — товар остался дома' }); }
  } else if (act === 'duel') {
    if (wgDuelStart(S)) chips.push({ k: 'warn', t: 'Поединок! Мир замер' });
    else chips.push({ k: 'warn', t: 'Поединка не будет: нужен герой на ногах' });
  }
}

if (typeof dilApply === 'function') {
  const _ap = dilApply;
  dilApply = function (fx, chips) {
    _ap(fx, chips);
    if (!fx || !fx.wg) return;
    const cur = Game.dil && Game.dil.cur, m = cur && /^(?:tv_)?wg_([a-z]+)/.exec(cur.id), S = m && wgByFac(m[1]);
    if (S) wgFx(S, fx.wg, chips);
  };
  const _rs = dilResolve;
  dilResolve = function (i, who) {
    const d = dilEnsure(), wg = !!(d.cur && /^wg_/.test(d.cur.id)), nx = d.next, lt = d.lastT;
    const r = _rs(i, who);
    if (wg && r.ok) { d.next = nx; d.lastT = lt; }                // разговор у ворот не сдвигает обычные дилеммы
    return r;
  };
  const _sh = dilStatusHTML;
  dilStatusHTML = function () {                                    // в окне у ворот — отношение этого поселения
    const h = _sh(), cur = Game.dil && Game.dil.cur, m = cur && /^(?:tv_)?wg_([a-z]+)/.exec(cur.id), S = m && wgByFac(m[1]);
    if (!h || !S) return h;
    return h.replace(/<\/div>$/, `<span class="dl-rel ${S.rel > 0 ? 'up' : S.rel < 0 ? 'dn' : ''}">«${S.name}» ${S.rel > 0 ? '+' : ''}${S.rel}</span></div>`);
  };
  const _av = dilAvail;
  dilAvail = function (cur) {
    const a = _av(cur);
    if (/^wg_/.test(cur.id) && wgCoopOn()) { const e = DIL_BY_ID[cur.id]; e.o.forEach((o, k) => { if (o.fx && o.fx.wg === 'duel') a[k] = false; }); }   // в коопе поединок пока недоступен
    return a;
  };
}

function wildCmd(name, m) {
  if (!m || m.a !== 'gate' || !Number.isInteger(m.id)) return;
  const r = wgTalk(m.id);
  if (!r.ok && r.text && typeof coopSay === 'function') coopSay(name, r.text);
  else if (r.ok) { const S = wgBy(m.id); if (S) wgSay(`${name} у ворот поселения «${S.name}»`); }
}

// ---------- Поединок с вождём ----------

if (typeof NSPEC !== 'undefined') {
  NSPEC.wgchief = { name: 'Вождь', mhp: 100, dmg: [5, 8], cd: 1.35, rng: 1.4, spd: 2.5, parry: 0.12, xp: 0, roam: 1, sz: 12, drop: [],
    msg: ['Ну, держись!', 'Посмотрим, кто кого!', 'За клан!'] };
}
const WG_SEQ = { heavy: ['light', 'heavy', 'light', 'heavy', 'heavy'], dodge: ['light', 'light', 'feint', 'light', 'poison'], shield: ['light', 'heavy', 'light', 'light'], sand: ['light', 'sand', 'light', 'heavy'] };

function wgDuelStart(S) {
  const h = wgHero();
  if (!h || wgCoopOn() || Game.wild.duel) return false;
  const [gx, gy] = wgGate(S), ax = gx + 0.5, ay = gy + 2.5, K = WG_KIND[S.kind];
  heroStopUnit(h);
  h.x = ax - 2.5; h.y = ay; h.roll = null;
  const mhp = Math.round(NSPEC.wgchief.mhp * K.hp * (1 + (S.up || 0)) * dif().neuHp);
  const N = { id: Game.nextId++, k: 'wgchief', lair: 0, wgc: S.id, fac: S.fac, x: ax + 2.5, y: ay, hx: ax, hy: ay, mhp, hp: mhp, lv: K.lv + (S.up || 0), face: -1,
    st: 'chase', t: 1, fr: 'i0', ph: 0, tg: h.id, prov: Game.time, cdA: 1.2, atkT: 9, hit: 1, ov: null, ovT: 0, winT: 0, dt: 0, wx: 0, wy: 0, say: 0, seq: 0, combo: 0 };
  Game.neutrals.push(N);
  Game.wild.duel = { s: S.id, n: N.id, h: h.id, t: 0, ax, ay };
  issueCmd(h, { kind: 'attack', f: { kind: 'neu', o: N }, tx: Math.floor(N.x), ty: Math.floor(N.y), label: 'Поединок' });
  floater(N.x, N.y - 2.4, 'За клан!', '#ffb0a0');
  if (typeof centerOn === 'function' && typeof R !== 'undefined' && R.canvas) centerOn(ax * TILE, ay * TILE);
  wgSay(`Поединок с вождём (${WG_FAC[S.fac].name})! Мир замер. Следите за красным кругом — [V] перекат`);
  return true;
}

// какой удар готовит вождь: стиль фракции, серии, финты
function wgPlan(N) {
  const tg = neuUnit(N.tg), now = Game.time, seq = WG_SEQ[WG_FAC[N.fac].st];
  let k = seq[N.seq++ % seq.length];
  if (N.combo > 0) { k = 'light'; N.combo--; }
  else if (k === 'light' && Math.random() < 0.3) N.combo = 2;                // серия из трёх быстрых ударов
  N.atkK = k === 'feint' ? 'heavy' : k === 'heavy' ? 'heavy' : 'light';
  N.feint = k === 'feint' ? 1 : 0; N.psn = k === 'poison' ? 1 : 0;
  N.tel = null;
  if (N.atkK === 'heavy' && tg) {
    N.tel = { k: 'heavy', x: Math.round(tg.x * 100) / 100, y: Math.round(tg.y * 100) / 100, r: 1.2, p: 0 }; N.telAt = now;
    floater(N.x, N.y - 2.4, '!', '#ff5a3a');
  }
  if (k === 'sand' && tg && Math.hypot(tg.x - N.x, tg.y - N.y) < 3.5) {
    tg._blind = now + 3;
    floater(tg.x, tg.y - 2.1, 'Песок в глаза!', '#e8d080');
    if (typeof fxBurst === 'function') fxBurst(tg.x * TILE, tg.y * TILE - 14, 10, ['#e8d080', '#c8a850'], 50, 30, 0.5, 1.4, 120);
  }
  if (N.combo > 0) N.cdA = Math.min(N.cdA, 0.35);
}

if (typeof neuThink === 'function') {
  const _th = neuThink;
  neuThink = function (N, dt) {
    if (!N.wgc || N.st === 'die') return _th(N, dt);
    const D = Game.wild && Game.wild.duel;
    if (D) { N.hx = D.ax; N.hy = D.ay; }
    N.prov = Game.time;
    if (N.rollT > 0) {                                             // перекат прочь от героя
      N.rollT -= dt; N.tel = null; N.st = 'chase'; N.atkT = 9;
      neuMove(N, N.x + N.rvx, N.y + N.rvy, 7, dt);
      N.fr = 'w' + (Math.floor(N.ph) % 8);
      return;
    }
    _th(N, dt);
    if (N.st === 'atk' && N.atkT === 0) wgPlan(N);
    if (N.feint && N.tel && N.tel.p >= 0.55) {                    // финт: замах обрывается, сразу быстрый удар
      N.tel = null; N.feint = 0; N.st = 'chase'; N.atkT = 9; N.cdA = 0.15; N.combo = 1;
      floater(N.x, N.y - 2.3, 'Финт!', '#ffe9a0');
    }
  };
  const _hit = neuHit;
  neuHit = function (N, u, dmg) {
    if (!N.wgc || N.st === 'die') return _hit(N, u, dmg);
    const now = Game.time, st = WG_FAC[N.fac].st;
    if (N.iframe > now) { floater(N.x, N.y - 1.9, 'Увернулся!', '#cfe8ff'); return; }
    if (st === 'shield' && Math.random() < 0.3) {                  // щит и контрудар
      floater(N.x, N.y - 1.9, 'Щит!', '#e8ecf0'); N.cdA = 0; N.combo = 0;
      if (typeof sfxAt === 'function') sfxAt('thud', N.x * TILE, N.y * TILE, 0.5);
      return;
    }
    _hit(N, u, Math.min(dmg, Math.max(0, N.hp - 1)));
    if (N.hp < 1) N.hp = 1;
    if (u && Math.random() < (st === 'dodge' ? 0.4 : 0.18)) {      // прочитал удар — уходит перекатом
      const d = Math.hypot(N.x - u.x, N.y - u.y) || 1;
      N.rollT = 0.35; N.iframe = now + 0.55; N.rvx = (N.x - u.x) / d * 2.5; N.rvy = (N.y - u.y) / d * 2.5;
      floater(N.x, N.y - 2.2, 'Перекат!', '#cfe8ff');
    }
  };
  const _kill = neuKill;
  neuKill = function (N, killer) { if (N.wgc) { N.hp = Math.max(1, N.hp); N.st = 'chase'; return; } _kill(N, killer); };
  const _sk = neuStrike;
  neuStrike = function (N, tg) {
    _sk(N, tg);
    if (N.wgc && N.psn && tg && tg.hero && !(tg.hero.rollT > Game.time)) { tg._psn = Game.time + 5; floater(tg.x, tg.y - 2.1, 'Яд!', '#8ae070'); }
  };
}
if (typeof strike === 'function') {
  const _st = strike;
  strike = function (u, f) {
    if (f && f.kind === 'neu' && f.o && f.o.wgc && u && u._blind > Game.time && Math.random() < 0.5) { floater(f.o.x, f.o.y - 1.7, 'Ничего не вижу!', '#e8d080'); return; }
    _st(u, f);
  };
}

// мир на паузе: идут только герой и вождь (и их боевые системы)
function wgDuelStep(D, dt) {
  Game.time += dt; D.t += dt;
  const h = Game.unitMap.get(D.h), N = Game.neutrals.find(q => q.id === D.n);
  if (!h || !N) return wgDuelEnd(D, 'draw');
  const keep = Game.neutrals;
  Game.neutrals = [N];
  try {
    if (!h.dead) h.update(dt);
    neuThink(N, dt);
    for (const f of ['cbTick', 'abTick', 'hmTick', 'hmFxStep', 'kitTick']) if (typeof globalThis[f] === 'function') globalThis[f](dt);
  } finally { Game.neutrals = keep; }
  if (h._psn > Game.time) { D.pa = (D.pa || 0) + dt; if (D.pa >= 1) { D.pa = 0; hlHurt(h, 2, true); } }
  if (!h.cmd && !h.proc && !h.dead && !h.roll && D.t > 1) issueCmd(h, { kind: 'attack', f: { kind: 'neu', o: N }, tx: Math.floor(N.x), ty: Math.floor(N.y), label: 'Поединок' });
  if (h.dead || !h.hero || h.hero.hp <= 0) return wgDuelEnd(D, 'lose');
  if (N.hp <= N.mhp * 0.15) return wgDuelEnd(D, 'win');
  if (D.t >= WG_DUEL_T) wgDuelEnd(D, 'draw');
}

function wgDuelEnd(D, res) {
  const W = Game.wild, S = wgBy(D.s), h = Game.unitMap.get(D.h);
  W.duel = null;
  const i = Game.neutrals.findIndex(q => q.id === D.n), N = i >= 0 ? Game.neutrals[i] : null;
  if (i >= 0) Game.neutrals.splice(i, 1);
  if (h && !h.dead) { heroStopUnit(h); h._psn = 0; h._blind = 0; }
  if (!S) return;
  const F = WG_FAC[S.fac], K = WG_KIND[S.kind];
  if (res === 'win') {
    S.own = wgDay() + WG_OWN_DAYS; S.rel = Math.max(S.rel, 0);
    const gold = Math.round(8 * K.hp);
    dilGive('gold', gold);
    for (const g in F.car[1]) dilGive(g, F.car[1][g]);
    const st = tvStore();
    for (let k = 0; k < 2 && st; k++) { const p = randomFreeNear(st.doorX, st.doorY + 1, 1, 6) || [st.doorX, st.doorY + 1]; spawnUnit('serf', p[0], p[1]); }
    if (h && h.hero) { h.hero.cxp = (h.hero.cxp || 0) + 120; floater(h.x, h.y - 2.1, '+120 опыта', '#ffe070'); }
    if (N) floater(N.x, N.y - 2.2, 'Сдаюсь! Твоя взяла', '#ffe9a0');
    wgLog(`Поединок выигран: ${wgName(S)} присоединился на ${WG_OWN_DAYS} сут. Золото +${gold}, ${wgList(F.car[1])}, двое жителей перешли к нам`, S);
    wgSay(`Победа! «${S.name}» под нашей рукой ${WG_OWN_DAYS} суток: дань каждое утро, потом жди бунта`);
  } else if (res === 'lose') {
    wgRel(S, -15, null);
    if (N) floater(N.x, N.y - 2.2, 'Ступай домой, герой', '#ffb0a0');
    wgLog(`Поединок проигран: вождь (${F.name}) победил. Отношение −15`, S);
    wgSay('Поединок проигран — герою нужно отлежаться');
  } else {
    wgRel(S, 5, null);
    wgLog(`Поединок с вождём (${F.name}) — ничья. Кланы зауважали героя`, S);
    wgSay('Ничья! Вождь пожал герою руку');
  }
}

{
  const wrapStep = () => {
    const _s = step;
    step = function (dt) {
      const D = Game.wild && Game.wild.duel;
      if (D && !wgMirror()) return wgDuelStep(D, dt);
      _s(dt);
      if (!wgMirror()) wgTick(dt);
    };
    step.wg = 1;
  };
  wrapStep();
  // пауза мира должна быть снаружи всех обёрток шага: если после нас кто-то обернул step, оборачиваем ещё раз
  if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('load', () => { if (!step.wg) { const _s = step; step = function (dt) { if (Game.wild && Game.wild.duel && !wgMirror()) return wgDuelStep(Game.wild.duel, dt); _s(dt); }; step.wg = 1; } });
}

// ---------- Сохранение, создание карты, кооп ----------

{
  const _rgs = resetGameState;
  resetGameState = function () { _rgs(); Game.wild = null; };
  const _ss = setupStart;                                         // после логов нейтралов и шпиля Малгора
  setupStart = function (seed, ...o) { _ss(seed, ...o); wgSpawnAll(seed); };
  const _sg = serializeGame;
  serializeGame = function () {
    const s = _sg();
    if (Array.isArray(s.obj)) s.obj = s.obj.filter(e => e[1] !== 'wgb');                   // клетки поселений восстанавливаются из s.wild
    const W = Game.wild;
    if (W) s.wild = { day: W.day, list: W.list.map(S => Object.assign({}, S, { g: undefined, lt: undefined, own: S.own ? S.own - wgDay() : 0 })),
      cars: W.cars.map(C => Object.assign({}, C, { x: +C.x.toFixed(2), y: +C.y.toFixed(2) })) };
    return s;
  };
  const _as = applySave;
  applySave = function (s) {
    _as(s);
    Game.wild = null;
    const v = s.wild;
    if (!v) { if (!(typeof isMirror === 'function' && isMirror()) && s.seed != null) wgSpawnAll(s.seed); return; }      // старое сохранение — поселения появятся сейчас
    const W = wgEnsure();
    W.day = wgDay();
    W.list = (v.list || []).filter(S => WG_FAC[S.fac] && WG_KIND[S.kind]).map(S => Object.assign({}, S, { own: S.own ? W.day + S.own : 0 }));
    W.cars = (v.cars || []).filter(C => Array.isArray(C.route) && C.route.length > 1);
    for (const S of W.list) wgMark(S);
  };
}

function wildMirrorOut() {
  const W = Game.wild;
  if (!W) return null;
  const r = v => Math.round(v * 100) / 100;
  return { list: W.list.map(S => ({ id: S.id, fac: S.fac, kind: S.kind, x: S.x, y: S.y, name: S.name, rel: S.rel, evil: S.evil, own: S.own ? 1 : 0 })),
    cars: W.cars.map(C => ({ id: C.id, x: r(C.x), y: r(C.y), f: C.f, dir: C.dir })) };
}
function wildMirrorIn(m) {
  if (!m) { Game.wild = null; return; }
  const W = wgEnsure(), old = new Map(W.list.map(S => [S.id, S]));
  W.list = m.list.map(S => Object.assign(old.get(S.id) || {}, S));
  W.cars = m.cars;
}

// клик по поселению — окно у ворот (обёртка ставится после всех скриптов, снаружи путников)
function wgAt(t) {
  const W = Game.wild;
  if (!W) return null;
  return W.list.find(S => t[0] >= S.x - 1 && t[0] <= S.x + WG_W && t[1] >= S.y - 2 && t[1] <= S.y + WG_H + 1) || null;
}
if (typeof window !== 'undefined' && window.addEventListener && typeof onLeftClickTile === 'function') {
  window.addEventListener('load', () => {
    const _click = onLeftClickTile;
    onLeftClickTile = function (t) {
      if (!Game.tool && !(Game.wild && Game.wild.duel)) {
        const S = wgAt(t);
        if (S) {
          if (wgMirror()) { if (typeof tvForceModal === 'function') tvForceModal(); coopSend({ t: 'wild', a: 'gate', id: S.id }); return; }
          const r = wgTalk(S.id);
          if (!r.ok && r.text) toast(r.text);
          if (r.ok || r.text) return;
        }
      }
      _click(t);
    };
  });
}

// ---------- Рисунок ----------

// жители: косметика, ходят по своему двору (своё время у каждого клиента)
function wgFolk(S) {
  if (S.g) return S.g;
  const n = WG_KIND[S.kind].pop, g = [];
  for (let i = 0; i < n; i++) { const p = wgYard(S); g.push({ x: p[0], y: p[1], tx: p[0], ty: p[1], f: 1, t: Math.random() * 4, ph: 0 }); }
  return (S.g = g);
}
function wgYard(S) {
  for (let k = 0; k < 20; k++) {
    const x = S.x + 1 + ((Math.random() * (WG_W - 2)) | 0), y = S.y + 4 + ((Math.random() * (WG_H - 5)) | 0);
    const o = World.obj[idx(x, y)];
    if (!(o && o.t === 'wgb')) return [x + 0.5, y + 0.5];
  }
  return [S.x + 6.5, S.y + WG_H - 1.5];
}
function wgFolkTick(S) {
  const now = Game.time, dt = Math.min(0.2, Math.max(0, now - (S.lt || now)));
  S.lt = now;
  for (const p of wgFolk(S)) {
    const d = Math.hypot(p.tx - p.x, p.ty - p.y);
    if (d > 0.05) { const s = Math.min(d, 0.7 * dt); p.x += (p.tx - p.x) / d * s; p.y += (p.ty - p.y) / d * s; p.ph += s * 5; if (Math.abs(p.tx - p.x) > 0.05) p.f = p.tx > p.x ? 1 : -1; }
    else if ((p.t -= dt) <= 0) { const q = wgYard(S); p.tx = q[0]; p.ty = q[1]; p.t = 2 + Math.random() * 5; }
  }
}

function wgDrawFence(c, S, x, y, kind) {
  const X = x * TILE, Y = y * TILE;
  if (kind === 'stone') {
    c.fillStyle = '#5a5a60'; c.fillRect(X, Y + 6, TILE, TILE - 6);
    c.fillStyle = '#8a8a92'; c.fillRect(X, Y + 2, TILE, 10);
    c.fillStyle = '#a8a8b0'; for (let k = 0; k < 4; k++) c.fillRect(X + k * 8, Y - 3, 5, 6);
    c.fillStyle = '#4a4a50'; c.fillRect(X, Y + 12, TILE, 1); c.fillRect(X + 15, Y + 2, 1, 10);
  } else {
    for (let k = 0; k < 4; k++) {
      const sx = X + 2 + k * 8, h = 22 + ((k * 7 + x * 3 + y) % 5);
      c.fillStyle = '#6a4424'; c.fillRect(sx, Y + TILE - h, 6, h);
      c.fillStyle = '#8a5e34'; c.fillRect(sx + 1, Y + TILE - h, 2, h);
      c.fillStyle = '#4a2c16'; c.fillRect(sx + 2, Y + TILE - h - 3, 2, 3);
    }
  }
}

const WG_EMB = {                 // знак на флаге 5×5
  copper: ['.xxx.', 'xxxx.', '..x..', '..x..', '..x..'],      // топор
  moss: ['..x..', '.xxx.', 'xxxxx', '.xxx.', '..x..'],         // лист
  grey: ['xxxxx', 'xxxxx', 'xxxxx', '.xxx.', '..x..'],         // щит
  sand: ['x.x.x', '.xxx.', 'xxxxx', '.xxx.', 'x.x.x'],         // солнце
};
function wgDrawFlag(c, S) {
  const F = WG_FAC[S.fac], X = Math.round((S.x + 4.4) * TILE), Y = Math.round((S.y + WG_H) * TILE - 4), t = Game.time;
  c.fillStyle = '#3a2614'; c.fillRect(X, Y - 46, 3, 46);
  c.fillStyle = '#d8b878'; c.fillRect(X - 1, Y - 48, 5, 3);
  const col = S.evil && !S.own ? '#2a1a1e' : F.flag;
  for (let k = 0; k < 6; k++) {                                   // полотнище колышется полосками
    const off = Math.round(Math.sin(t * 4 + k * 0.7) * 1.5);
    c.fillStyle = col; c.fillRect(X + 3 + k * 3, Y - 45 + off, 3, 15);
  }
  const emb = S.evil && !S.own ? ['x...x', '.xxx.', 'x.x.x', '.xxx.', '.x.x.'] : WG_EMB[S.fac];      // у злых — череп
  c.fillStyle = S.evil && !S.own ? '#e8e0d0' : F.emb;
  emb.forEach((row, yy) => { for (let xx = 0; xx < 5; xx++) if (row[xx] === 'x') c.fillRect(X + 7 + xx * 2, Y - 42 + yy * 2 + Math.round(Math.sin(t * 4 + xx * 0.5) * 1), 2, 2); });
  if (S.own) { c.fillStyle = '#ffd700'; c.fillRect(X + 3, Y - 30, 18, 2); }     // наша лента
}

function wgDrawChief(c, S) {
  const [gx, gy] = wgGate(S), X = Math.round((gx + 0.5) * TILE), Y = Math.round((gy + 0.2) * TILE + 6);
  if (!(Game.wild.duel && Game.wild.duel.s === S.id)) {
    c.save(); c.translate(X, Y); c.scale(1.8, 1.8);
    tvDrawGnome(c, 0, 0, { k: 'wt_' + S.fac, f: 1 }, 0, false);
    c.fillStyle = '#ffd700'; c.fillRect(-3, -21, 6, 2); c.fillRect(-3, -23, 1, 2); c.fillRect(0, -23, 1, 2); c.fillRect(2, -23, 1, 2);   // корона вождя
    c.restore();
    tvDrawEmo(c, S.own ? 'good' : S.evil ? 'evil' : S.rel < -20 ? 'neu' : 'good', X, Y - 52, false);
  }
  const tier = S.own ? 'наши' : S.evil ? 'злые' : S.rel >= 50 ? 'союзники' : S.rel < -20 ? 'в обиде' : 'нейтральны';
  c.save();
  c.font = 'bold 11px sans-serif'; c.textAlign = 'center';
  const txt = `${S.name} · ${WG_FAC[S.fac].name} · ${tier}`, w = c.measureText(txt).width + 10;
  c.fillStyle = 'rgba(20,14,6,0.7)'; c.fillRect(X - w / 2, Y - 80, w, 15);
  c.fillStyle = S.evil && !S.own ? '#ffb0a0' : S.own ? '#ffe070' : '#f0e6c8'; c.fillText(txt, X, Y - 69);
  c.restore();
}

function wgDrawCar(c, C) {
  const X = Math.round(C.x * TILE), Y = Math.round(C.y * TILE + 6), f = C.f || 1, t = Game.time;
  c.save(); c.translate(X, Y); c.scale(1.5, 1.5);
  c.fillStyle = 'rgba(10,8,4,0.3)'; c.beginPath(); c.ellipse(-4 * f, 0, 10, 2.5, 0, 0, 7); c.fill();
  c.fillStyle = '#8a5a2a'; c.fillRect(-14 * f - (f > 0 ? 0 : -1) - (f < 0 ? 12 : 0), -9, 12, 6);
  c.fillStyle = '#d8b878'; c.fillRect(-13 * f - (f < 0 ? 10 : 0), -12, 10, 3);
  c.fillStyle = '#2a1c10'; const wx = -10 * f - (f < 0 ? 0 : 0); c.beginPath(); c.arc(wx, -2, 2.5, 0, 7); c.fill();
  c.fillStyle = '#c8a060'; c.fillRect(wx - 1 + Math.round(Math.sin(t * 6)), -3, 2, 2);
  tvDrawGnome(c, 0, 0, { k: 'courier', f }, t * 8, true);
  c.restore();
}

function wgDrawArena(c, D) {
  const X = D.ax * TILE, Y = D.ay * TILE, r = WG_ARENA_R * TILE;
  c.save();
  c.strokeStyle = 'rgba(255,220,120,0.55)'; c.lineWidth = 3; c.setLineDash([10, 8]);
  c.beginPath(); c.ellipse(X, Y, r, r * 0.6, 0, 0, 7); c.stroke();
  c.setLineDash([]);
  const left = Math.max(0, Math.ceil(WG_DUEL_T - D.t));
  c.font = 'bold 13px sans-serif'; c.textAlign = 'center';
  c.fillStyle = 'rgba(20,14,6,0.75)'; c.fillRect(X - 78, Y - r * 0.6 - 30, 156, 18);
  c.fillStyle = '#ffe070'; c.fillText(`Поединок · мир замер · ${left} с`, X, Y - r * 0.6 - 17);
  c.restore();
}

// вождь в поединке рисуется гномом своей фракции поверх бойца-нейтрала
function wgDrawChiefNeu(c, N) {
  const X = Math.round(N.x * TILE), Y = Math.round(N.y * TILE + 6), fr = N.fr || 'i0', f = N.face || 1;
  c.save(); c.translate(X, Y); c.scale(1.8, 1.8);
  tvDrawGnome(c, 0, 0, { k: 'wt_' + N.fac, f }, Game.time * 10, fr[0] === 'w' || fr === 'step');
  c.fillStyle = '#ffd700'; c.fillRect(-3, -21, 6, 2);
  c.fillStyle = '#9aa0aa';
  if (fr === 'windup') c.fillRect(1 * f, -26, 2, 12); else if (fr === 'strike') c.fillRect(4 * f - (f < 0 ? 10 : 0), -11, 11, 2); else c.fillRect(3 * f, -14, 2, 10);
  if (N.rollT > 0) { c.globalAlpha = 0.4; c.fillStyle = '#cfe8ff'; c.fillRect(-4, -18, 8, 18); }
  c.restore();
  const w = 26, hy = Y - 50, r = Math.max(0, N.hp / N.mhp);
  c.fillStyle = 'rgba(10,6,2,0.85)'; c.fillRect(X - w / 2 - 1, hy - 1, w + 2, 5);
  c.fillStyle = r > 0.5 ? '#5ac04a' : r > 0.25 ? '#e0b030' : '#e04a3a'; c.fillRect(X - w / 2, hy, Math.round(w * r), 3);
  c.fillStyle = '#ffe070'; c.fillRect(X - w / 2 + Math.round(w * 0.15), hy - 1, 1, 5);      // метка «сдастся здесь»
}

function wgDrawList(list, c, x0, y0, x1, y1) {
  const W = Game.wild;
  if (!W) return;
  for (const S of W.list) {
    if (S.x + WG_W < x0 - 3 || S.x > x1 + 3 || S.y + WG_H < y0 - 4 || S.y > y1 + 4) continue;
    const K = WG_KIND[S.kind];
    for (const [t, dx, dy] of K.b) {
      const B = BUILDINGS[t], bx = S.x + dx, by = S.y + dy;
      list.push([by + B.h - 0.05, () => {
        const spr = buildingSprite(t, 0, 1), ox = bx * TILE - spr.padx, oy = by * TILE - spr.top;
        c.drawImage(spr.shadow, ox, oy, spr.w, spr.h);
        c.drawImage(spr.canvas, ox, oy, spr.w, spr.h);
        if (spr.fire && typeof drawBonfireFlames === 'function') drawBonfireFlames(c, ox + spr.fire[0], oy + spr.fire[1], true, S.id + dx);
        if (spr.chimneys && typeof drawSmoke === 'function') for (const [sx, sy] of spr.chimneys) drawSmoke(c, ox + sx, oy + sy, S.id + sx, 0.5);
      }]);
    }
    if (K.fence) for (let x = 0; x < WG_W; x++) for (let y = 0; y < WG_H; y++) {
      if (x > 0 && x < WG_W - 1 && y > 0 && y < WG_H - 1) continue;
      if (y === WG_H - 1 && x >= 5 && x <= 7) continue;
      list.push([S.y + y + 0.8, () => wgDrawFence(c, S, S.x + x, S.y + y, K.fence)]);
    }
    list.push([S.y + WG_H + 0.1, () => wgDrawFlag(c, S)]);
    list.push([S.y + WG_H + 0.4, () => wgDrawChief(c, S)]);
    wgFolkTick(S);
    for (const p of wgFolk(S)) {
      list.push([p.y + 0.2, () => {
        c.save(); c.translate(Math.round(p.x * TILE), Math.round(p.y * TILE + 6)); c.scale(TV_SC, TV_SC);
        tvDrawGnome(c, 0, 0, { k: 'wt_' + S.fac, f: p.f }, p.ph, Math.hypot(p.tx - p.x, p.ty - p.y) > 0.05);
        c.restore();
      }]);
    }
  }
  for (const C of W.cars) if (C.x >= x0 - 3 && C.x <= x1 + 3 && C.y >= y0 - 3 && C.y <= y1 + 4) list.push([C.y + 0.2, () => wgDrawCar(c, C)]);
  if (W.duel) list.push([W.duel.ay - WG_ARENA_R, () => wgDrawArena(c, W.duel)]);
}

if (typeof neuDrawList === 'function') {
  const _dl = neuDrawList;
  neuDrawList = function (list, c, x0, y0, x1, y1) { _dl(list, c, x0, y0, x1, y1); wgDrawList(list, c, x0, y0, x1, y1); };
  const _nd = neuDraw;
  neuDraw = function (c, N) { if (N.k === 'wgchief') return wgDrawChiefNeu(c, N); return _nd(c, N); };
}
