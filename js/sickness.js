'use strict';
// Болезни и лазарет (СИСТЕМЫ.md, раздел 2). У гнома может быть один недуг: u.ill = { k, s } — вид и тяжесть 0…1.
//   простуда (холод, дождь, усталость; слабо заразна), хворь живота (голод, «пояса потуже»), чумная хворь
//   (приходит с караванами и бродягами, заразна; может унести гнома, если нет лазарета).
// Больной работает медленнее и хмурится (через mood.js: sickMul(u), sickMood(u)); тяжёлый (s ≥ SICK.BED) бросает
// работу: идёт в лазарет, а без лазарета отлёживается на лавочке. В лазарете лекарь варит зелья из хмеля и хлеба,
// зелье сразу сбивает хворь, а присмотр лекаря лечит быстрее. Много чумных — «эпидемия»: тоска по всей деревне.
// Связи: указы (laws.js — пир/пост, ворота), дилеммы (dilemma.js — два события и fx.sick), торговля
// (trade.js — зелья в цене, мор в округе, заразные караваны), сложность («Спокойный» — мягче и без смертей).
// Состояние: u.ill в сохранении жителя (s.units[k].ill), Game.med { st, epi, poxDay } — в s.med.
// Кооп: считает сервер; u.ill идёт в пакете жителей (COOP_UNIT_EX), Game.med — зеркалом mir.med.

const SICK = {
  STEP: 10,            // секунд между проверками одного гнома
  START: 0.22,         // тяжесть свежего недуга
  BED: 0.6,            // с такой тяжести гном бросает работу и лечится
  REST_CD: 80,         // пауза между походами «отлежаться»
  BEDS: 4,             // мест в лазарете
  EPI: 0.15,           // доля чумных для эпидемии (не меньше 3 гномов)
};
const SICK_KINDS = {
  cold: { t: 'Простуда', grow: 0.010, heal: 0.016, spread: 0.0012, mul: 0.22, mood: 4, col: '#8ac8e8' },
  gut:  { t: 'Хворь живота', grow: 0.014, heal: 0.018, spread: 0, mul: 0.3, mood: 5, col: '#b8c048' },
  pox:  { t: 'Чумная хворь', grow: 0.02, heal: 0.008, spread: 0.006, mul: 0.4, mood: 8, col: '#7ad04a', deadly: true },
};

// ---------- Товар, профессия, здание ----------

GOODS.potion = { name: 'Целебные зелья', color: '#d0405a', group: 'Ремесло' };
if (!GOOD_KEYS.includes('potion')) GOOD_KEYS.push('potion');
UNIT_TYPES.healer = { name: 'Лекарь', shirt: '#e8e4d8' };
if (!UNIT_KEYS.includes('healer')) UNIT_KEYS.push('healer');
if (!ALL_UNIT_KEYS.includes('healer')) ALL_UNIT_KEYS.push('healer');
if (typeof OUTFIT !== 'undefined') OUTFIT.healer = { cap: '#f2eee2', pants: '#4a3a2a', apron: '#f6f1e4', coat: '#2e6a5a' };   // белый колпак, бирюзовая куртка
BUILDINGS.infirmary = {
  name: 'Лазарет', cat: 'Основа', w: 3, h: 2, top: 64, cost: { timber: 5, stone: 3 }, worker: 'healer',
  inputs: { hops: 8, bread: 6 }, outputs: { potion: 8 },
  recipes: [{ in: { hops: 2, bread: 1 }, out: { potion: 2 }, time: 14 }],
  desc: 'Лекарь варит целебные зелья из хмеля и хлеба и выхаживает больных: тяжёлые гномы приходят сюда сами. Мест — четыре.',
};
BUILD_ORDER.push('infirmary');
UNLOCKS.push({ id: 'med', items: ['infirmary'], after: ['brewery'] });
if (typeof UNLOCK_NAMES !== 'undefined') UNLOCK_NAMES.med = 'Лазарет';
if (typeof SIGN_OF !== 'undefined') SIGN_OF.infirmary = 'herb';
if (typeof TR_BASE !== 'undefined') { TR_BASE.potion = 4.5; TR_GROUPS.wander.sells.push('potion'); TR_GROUPS.mage.sells.push('potion'); TR_GROUPS.farm.wants.push('potion'); }
if (typeof TR_EVENTS !== 'undefined') TR_EVENTS.push({ id: 'plague', name: 'Мор в округе', goods: ['potion', 'bread', 'hops'], f: 1.5, text: 'Мор в округе: зелья и хлеб в цене' });

if (typeof signIcon === 'function') {
  const _si = signIcon;
  signIcon = function (c, cx, cy, kind) {
    if (kind !== 'herb') { _si(c, cx, cy, kind); return; }
    // склянка с красным зельем и листик
    c.fillStyle = '#e8e0d0'; c.fillRect(cx - 0.8, cy - 3.2, 1.6, 1.4);
    ellipse(c, cx, cy + 0.8, 2.6, 2.4, '#e8e0d0');
    ellipse(c, cx, cy + 1.2, 2, 1.7, '#c8303a');
    ellipse(c, cx - 0.7, cy + 0.4, 0.6, 0.5, '#ff9aa0');
    ellipse(c, cx + 2.8, cy - 1.8, 1.4, 0.8, '#5aa03a');
  };
}
if (typeof MODELS !== 'undefined') {
  MODELS.infirmary = function (m) {
    m.box({
      x0: 6, x1: 90, y0: 10, y1: 58, h: 30, wall: 'plank', col: '#d8d0bc', beam: '#5a3a22',
      roof: { type: 'gable', axis: 'X', rise: 22, mat: 'shingle', col: '#6a8a7a', ov: 5 },
      decor: {
        S: [{ t: 'door', main: true, shift: -10, w: 16, h: 20 },
          { t: 'win', at: 16, z: 10, w: 9, h: 10, o: { lit: true } }, { t: 'win', at: 70, z: 10, w: 9, h: 10, o: { lit: true } },
          { t: 'sign', at: 56, z: 22, kind: 'herb' }, { t: 'lantern', at: 82, z: 18 }],
        E: [{ t: 'win', at: 30, z: 10, w: 7, h: 9, o: { lit: true } }],
        W: [{ t: 'win', at: 30, z: 10, w: 7, h: 9, o: { lit: true } }],
      },
      chimneys: [{ x: 74, y: 44, h: 14, kind: 'stone', w: 5 }],
    });
    m.g.spr.doorPt = m.at(m.doorX, 10);
    m.prop((c, x, y) => barrel(c, x, y), 2, 14);
  };
}
if (typeof ICON_GRIDS !== 'undefined') {
  ICON_GRIDS.good.potion = { pal: { k: '#3a1a14', g: '#e8e0d0', w: '#ffffff', r: '#d0303a', R: '#8a1a22', p: '#ff9aa0', c: '#8a5a30' }, rows: [
    '................',
    '......kkkk......',
    '......kcck......',
    '.......kgk......',
    '.......kgk......',
    '.....kkggkk.....',
    '....kggggggk....',
    '...kgwggggggk...',
    '...kgrrrrrrgk...',
    '...krprrrrrRk...',
    '...krrrrrrrRk...',
    '...krrrrrrRRk...',
    '....kRrrrRRk....',
    '.....kkkkkk.....',
    '................',
    '................'] };
}

// ---------- Состояние ----------

const skServer = () => typeof coop !== 'undefined' && !!coop && !!coop.out && !!coop.players;
const skMirror = () => typeof Coop !== 'undefined' && !!Coop.mirror;
function skSay(text) { if (skServer()) coop.out.push({ msg: { t: 'toast', text } }); else if (typeof toast === 'function') toast(text); }
function medEnsure() { return Game.med || (Game.med = { st: { sick: 0, cured: 0, died: 0, potions: 0, epi: 0 }, epi: false, poxDay: 4 }); }
const skOn = u => typeof mdOn === 'function' ? mdOn(u) : (!u.dead && isPerson(u) && u.type !== 'hero' && u.type !== 'carter');
const skCalm = () => !!dif().noLoss;
const skDay = () => cycleAt(Game.time).k;
const skLaw = id => typeof lawIsOn === 'function' && lawIsOn(id);
const skHerbs = () => typeof RSCC !== 'undefined' && RSCC.herbs > 0;   // открытие «Травник» (research.js)
function skStoreHave(g) { let n = 0; for (const s of Game.buildings) if (s.isStore() && !s.removed) n += Math.max(0, s.offer(g)); return n; }
function skStoreTake(g) {
  for (const s of Game.buildings) if (s.isStore() && !s.removed && s.offer(g) > 0) { s.stock[g]--; return true; }
  return false;
}

// для mood.js
function sickMul(u) { const I = u.ill; return I && SICK_KINDS[I.k] ? 1 - SICK_KINDS[I.k].mul * Math.min(1, I.s + 0.25) : 1; }
function sickMood(u) {
  const I = u.ill, M = Game.med;
  let v = I && SICK_KINDS[I.k] ? -Math.round(SICK_KINDS[I.k].mood * (0.6 + I.s)) : 0;
  if (M && M.epi && skOn(u)) v -= 3;
  return v;
}

function sickInfect(u, k, why) {
  if (!u || u.dead || u.ill || !skOn(u)) return false;
  u.ill = { k, s: SICK.START };
  medEnsure().st.sick++;
  if (why && typeof logEvent === 'function') logEvent('med', `${UNIT_TYPES[u.type].name}: ${SICK_KINDS[k].t.toLowerCase()} — ${why}`, u.x, u.y);
  return true;
}
function sickCure(u, how) {
  if (!u.ill) return;
  const k = u.ill.k;
  u.ill = null;
  medEnsure().st.cured++;
  if (typeof moodPoke === 'function') moodPoke(u, 'cured', 6, 120);
  if (how && typeof logEvent === 'function') logEvent('med', `${UNIT_TYPES[u.type].name} поправился: ${SICK_KINDS[k].t.toLowerCase()} отступила${how === 'ward' ? ' (лазарет)' : ''}`, u.x, u.y);
}

// ---------- Ход болезни ----------

const SKT = { acc: 0, phase: 0, hooked: false, slot: 0 };
function sickTick(dt) {
  SKT.acc += dt;
  if (SKT.acc < 1) return;
  const step = SKT.acc; SKT.acc = 0;
  if (Game.time < 30 || !startOpen('sickness')) return;
  const M = medEnsure(), now = Game.time;
  // гномы проверяются по очереди: каждый — раз в SICK.STEP секунд
  SKT.phase = (SKT.phase + 1) % SICK.STEP;
  const units = Game.units;
  let sickN = 0, poxN = 0, pop = 0;
  for (const u of units) {
    if (!skOn(u)) { if (u.ill && u.dead) u.ill = null; continue; }
    pop++;
    if (u.ill) { sickN++; if (u.ill.k === 'pox') poxN++; }
    if (u.id % SICK.STEP !== SKT.phase) continue;
    sickCheck(u, now, units);
  }
  // чума приходит сама изредка: раз в несколько суток, в большой деревне
  const day = skDay();
  if (day > M.poxDay && pop >= 12) {
    M.poxDay = day + 3 + ((Math.random() * 3) | 0);
    if (Math.random() < (skLaw('closed') ? 0.12 : 0.3)) {
      const cand = units.filter(u => skOn(u) && !u.ill && !u.inside);
      const u = cand[(Math.random() * cand.length) | 0];
      if (sickInfect(u, 'pox', 'подхватил заразу у колодца')) skSay('В деревне чумная хворь! Постройте лазарет — и пусть лекарь варит зелья');
    }
  }
  // эпидемия
  const need = Math.max(3, Math.ceil(pop * SICK.EPI));
  if (!M.epi && poxN >= need) {
    M.epi = true; M.st.epi++;
    skSay('Эпидемия чумной хвори! Деревня в тоске, больные заражают соседей');
    if (typeof logEvent === 'function') logEvent('med', 'Началась эпидемия чумной хвори');
  } else if (M.epi && poxN === 0) {
    M.epi = false;
    skSay('Чумная хворь отступила. Деревня выдохнула');
    if (typeof logEvent === 'function') logEvent('med', 'Эпидемия закончилась');
  }
  M.n = sickN;
}

function sickCheck(u, now, units) {
  const night = isNightNow(), inside = !!u.inside;
  const winter = typeof isWinterMap === 'function' && isWinterMap();
  const rain = typeof WX !== 'undefined' && WX.k > 0.3 && !inside && !u.umbrella;
  const md = u.md, tired = md && md.rest < 0.2, sad = md && md.m < 30;
  const calm = (skCalm() ? 0.5 : 1) * (skHerbs() ? 0.75 : 1);
  const I = u.ill;
  if (!I) {
    // простуда: холод и сырость; живот: голод и скудный стол
    let pc = 0.0002 + (rain ? 0.0025 : 0) + (winter && !inside ? (night ? 0.004 : 0.0015) : 0) + (tired ? 0.001 : 0);
    let pg = 0.0001 + (u.food < HUNGRY ? 0.003 : 0) + (skLaw('fast') ? 0.0012 : 0) - (skLaw('feast') ? 0.0001 : 0);
    if (sad) { pc *= 1.5; pg *= 1.5; }
    // зараза от соседей (в трактире — вдвое)
    let pk = null, ps = 0;
    for (const o of units) {
      if (o === u || !o.ill || o.dead) continue;
      const K = SICK_KINDS[o.ill.k];
      if (!K.spread) continue;
      const same = inside && o.inside === u.inside;
      if (!same && (inside || o.inside || Math.abs(o.x - u.x) > 2.5 || Math.abs(o.y - u.y) > 2.5)) continue;
      const p = K.spread * (same && u.inside.type === 'inn' ? 2 : 1) * (0.5 + o.ill.s);
      if (p > ps) { ps = p; pk = o.ill.k; }
    }
    const r = Math.random();
    if (pk && r < ps * calm) sickInfect(u, pk, 'заразился от соседа');
    else if (r < pc * calm) sickInfect(u, 'cold', rain ? 'промок под дождём' : 'продрог');
    else if (r < (pc + pg) * calm) sickInfect(u, 'gut', 'съел что-то не то');
    return;
  }
  const K = SICK_KINDS[I.k];
  if (!K) { u.ill = null; return; }
  if (u.ward && !(u.brk && u.brk.kind === 'sick')) u.ward = null;   // поход в лазарет прервали (испуг, драка)
  if (u.ward) return;                                    // в лазарете тяжесть считает палата
  // тяжелеет от холода, голода и усталости, иначе понемногу проходит
  // тяжелеет от холода (простуда), пустого живота и сильной усталости; просто «голодноват» — уже не мешает поправляться
  const bad = (I.k === 'cold' && (rain || winter && !inside)) || u.food <= 0.05 || (md && md.rest < 0.1);
  I.s += bad ? K.grow * (skCalm() ? 0.6 : 1) : -K.heal * (inside ? 1.4 : 1) * (skCalm() ? 1.5 : 1) * (skHerbs() ? 1.3 : 1);
  if (u.brk && u.brk.kind === 'sick') I.s -= K.heal * 1.5;
  I.s = Math.round(Math.min(1, I.s) * 1000) / 1000;
  if (I.s <= 0) { sickCure(u, 'self'); return; }
  // чума без лечения может унести
  if (K.deadly && I.s >= 1 && !skCalm() && !inside && Math.random() < 0.08) {
    medEnsure().st.died++;
    if (typeof logEvent === 'function') logEvent('med', `${UNIT_TYPES[u.type].name} не пережил чумную хворь`, u.x, u.y);
    skSay(`${UNIT_TYPES[u.type].name} умер от чумной хвори. Нужен лазарет`);
    u.ill = null;
    removeUnit(u);
    return;
  }
  // тяжёлый: в лазарет или отлежаться
  if (I.s >= SICK.BED && now >= (u.sickCd || 0) && interruptible(u)) {
    u.sickCd = now + SICK.REST_CD;
    const ward = sickWardFor(u);
    startBreak(u, 'sick', null);
    u.proc = ward ? sickWardGen(u, ward) : sickRestGen(u);
    if (typeof floater === 'function') floater(u.x, u.y - 1.5, ward ? 'Мне бы к лекарю…' : 'Прилягу. Ненадолго. Навсегда.', '#c8e0a8');
  }
}

function sickBeds(b) { let n = 0; for (const u of Game.units) if (u.ward === b && !u.dead) n++; return n; }
function sickWardFor(u) {
  let best = null, bd = 1e9;
  for (const b of Game.buildings) {
    if (b.type !== 'infirmary' || b.state !== 'done' || b.removed || (b.paused)) continue;
    if (sickBeds(b) >= SICK.BEDS) continue;
    const d = Math.hypot(b.doorX - u.x, b.doorY - u.y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

function* sickRestGen(u) {
  const bench = typeof freeBench === 'function' ? freeBench(u, 8) : null;
  if (bench) { yield* benchGen(u, bench); yield { wait: 18 + Math.random() * 10 }; }
  else yield { wait: 20 + Math.random() * 10 };
  if (u.ill) u.ill.s = Math.max(0, u.ill.s - 0.08);
  if (u.ill && u.ill.s <= 0) sickCure(u, 'self');
}

function* sickWardGen(u, b) {
  u.ward = b;
  const ok = yield { walk: [b.doorX, b.doorY] };
  if (!ok || b.removed) { u.ward = null; yield* sickRestGen(u); return; }
  yield { enter: b };
  let potion = false;
  for (let t = 0; t < 150 && u.ill && !b.removed; t += 2) {
    yield { wait: 2 };
    if (!u.ill || b.removed) break;
    const doc = b.worker && !b.worker.dead && b.worker.inside === b;
    if (!potion) {
      if (b.stock.potion - (b.reserved.potion || 0) > 0) { b.stock.potion--; potion = true; }
      else if (skStoreHave('potion') > 0 && skStoreTake('potion')) potion = true;
      if (potion) { u.ill.s -= 0.4; medEnsure().st.potions++; }
    }
    u.ill.s -= doc ? 0.03 : 0.012;
    if (u.ill.s <= 0.02) { sickCure(u, 'ward'); break; }
  }
  u.ward = null;
  if (!b.removed) yield { leave: true };
}

// бродяги через открытые ворота иногда приносят хворь
if (typeof lawMigrant === 'function') {
  const _lm = lawMigrant;
  lawMigrant = function () {
    const n0 = Game.units.length;
    _lm();
    const u = Game.units.length > n0 ? Game.units[Game.units.length - 1] : null;
    if (u && Math.random() < 0.3) sickInfect(u, Math.random() < 0.5 ? 'pox' : 'cold', 'пришёл больным');
  };
}
// караван уехал — может оставить заразу у поста
if (typeof trAfterCaravan === 'function') {
  const _tac = trAfterCaravan;
  trAfterCaravan = function (T) {
    _tac(T);
    if (Math.random() >= (skLaw('closed') ? 0.04 : skLaw('open') ? 0.14 : 0.08)) return;
    const post = typeof tradePost === 'function' ? tradePost() : null;
    if (!post) return;
    const near = Game.units.filter(u => skOn(u) && !u.ill && !u.inside && Math.hypot(u.x - post.doorX, u.y - post.doorY) < 10);
    const u = near[(Math.random() * near.length) | 0];
    if (sickInfect(u, 'pox', 'караванщики кашляли')) skSay('Караван уехал, а кашель остался: у поста чумная хворь');
  };
}

// ---------- Дилеммы ----------

if (typeof DIL_EVENTS !== 'undefined') {
  const add = e => { if (!DIL_BY_ID[e.id]) { DIL_EVENTS.push(e); DIL_BY_ID[e.id] = e; } };
  add({ id: 'quack', t: 'Знахарь-самозванец', ic: 'mana', r: 1, c: { pop: [8, 500], night: false },
    d: 'Человек в остроконечной шляпе продаёт «панацею от всего, кроме скуки». Пузырьки булькают, этикетки — от руки и с ошибками.',
    o: [{ t: 'Купить ящик', cost: { gold: 4 }, fx: { res: { potion: 3 } }, risk: { p: 0.4, fx: { sick: 1, mood: -1 }, out: 'Одна из склянок оказалась настойкой на лягушках. Кто-то её выпил.' }, out: 'Три склянки. На вкус — как обещание.' },
      { t: 'Позвать лекаря проверить', cost: { bread: 2 }, fx: { res: { potion: 1 }, mood: 1 }, out: 'Лекарь понюхал, поморщился и одну склянку оставил — «на всякий».' },
      { t: 'Прогнать', def: 1, out: 'Ушёл, бормоча, что у нас «лица больные». Спасибо, мы в курсе.' }] });
  add({ id: 'cough_caravan', t: 'Кашляющий караван', ic: 'trade', r: 2, c: { post: true, night: false },
    d: 'К посту подъехал караван. Возницы кашляют хором, но торговать готовы. И даже со скидкой — «пока живы».',
    o: [{ t: 'Торговать как обычно', fx: { res: { potion: 2 }, rel: { traders: 1 } }, risk: { p: 0.5, fx: { sick: 2 }, out: 'Кашель остался у нас. Вместе с зельями — удобно.' }, out: 'Сторговались. Повозки скрипнули прочь, кашель — тоже.' },
      { t: 'Карантин у ворот', cost: { bread: 4 }, fx: { rel: { traders: 1 } }, out: 'Возниц откормили за воротами. Ушли здоровее, чем пришли.' },
      { t: 'Не пускать', def: 1, fx: { rel: { traders: -1 } }, out: 'Купцы обиделись. Зато обиду, в отличие от хвори, не подхватишь.' }] });
  if (typeof dilApply === 'function') {
    const _da = dilApply;
    dilApply = function (fx, chips) {
      _da(fx, chips);
      if (!fx || !fx.sick) return;
      const cand = Game.units.filter(u => skOn(u) && !u.ill && !u.inside);
      let n = 0;
      for (let i = 0; i < fx.sick && cand.length; i++) { const u = cand.splice((Math.random() * cand.length) | 0, 1)[0]; if (sickInfect(u, i ? 'cold' : 'pox', 'дурное событие')) n++; }
      if (n) chips.push({ k: 'dn', t: 'Заболели: ' + n });
    };
  }
  if (typeof dilChipsOf === 'function') {
    const _dc = dilChipsOf;
    dilChipsOf = function (o, av) {
      let h = _dc(o, av);
      if (o.fx && o.fx.sick) h += `<span class="dl-chip dn">Зараза</span>`;
      if (o.risk && o.risk.fx && o.risk.fx.sick) h = h.replace(/(Риск \d+%: )([^<]*)/, (m, a, b) => a + (b && b !== 'неприятность' ? b + ', ' : '') + 'зараза');
      return h;
    };
  }
}

// ---------- Рисунок: значок над больным ----------

function sickDrawList(list, c, x0, y0, x1, y1) {
  for (const u of Game.units) {
    const I = u.ill;
    if (!I || u.dead || u.inside || u.x < x0 - 1 || u.x > x1 + 1 || u.y < y0 - 1 || u.y > y1 + 2) continue;
    list.push([u.y + 0.06, () => {
      const K = SICK_KINDS[I.k] || SICK_KINDS.cold;
      const x = Math.round(u.x * TILE), y = Math.round(u.y * TILE - 27);   // без покачивания: на телефоне не рябит
      c.save();
      c.globalAlpha = 0.85;
      c.fillStyle = 'rgba(20,14,8,0.6)'; c.fillRect(x - 5, y - 5, 10, 10);
      c.fillStyle = K.col; c.fillRect(x - 4, y - 4, 8, 8);
      c.fillStyle = '#fff'; c.fillRect(x - 1, y - 3, 2, 6); c.fillRect(x - 3, y - 1, 6, 2);
      if (I.s >= SICK.BED) { c.fillStyle = '#e04030'; c.fillRect(x + 4, y - 6, 2, 2); }
      c.restore();
    }]);
  }
}
if (typeof golemDrawList === 'function') {
  const _gdl = golemDrawList;
  golemDrawList = function (list, c, x0, y0, x1, y1) { _gdl(list, c, x0, y0, x1, y1); sickDrawList(list, c, x0, y0, x1, y1); };
}

// ---------- Кооп-зеркало ----------

function medMirrorOut() { const M = Game.med; return M ? { st: M.st, epi: M.epi, n: M.n || 0 } : null; }
function medMirrorIn(m) {
  if (!m) { Game.med = null; return; }
  const M = medEnsure();
  if (m.epi && !M.epi && typeof logEvent === 'function') logEvent('med', 'Началась эпидемия чумной хвори');
  M.st = m.st; M.epi = m.epi; M.n = m.n;
}

// ---------- Подключение ----------

if (typeof LOG_KINDS !== 'undefined') {
  LOG_KINDS.med = { icon: 'scroll', name: 'Здоровье' };
  LOG_GROUP.med = 'life';
  if (typeof LOG_SARC !== 'undefined') LOG_SARC.med = ['Лекарь пишет в журнал. Неразборчиво — как положено.', 'Чихнул — значит, правда.', 'Подорожник к уху не прикладывать.'];
}
if (typeof MD_WHY !== 'undefined') { MD_WHY.ill = 'Хворает'; MD_WHY.cured = 'Поправился!'; }

if (typeof step === 'function') {
  const _step = step;
  step = function (dt) { _step(dt); if (!skMirror()) sickTick(dt); };
  const _rgs = resetGameState;
  resetGameState = function () { _rgs(); Game.med = null; };
  const _sg = serializeGame;
  serializeGame = function () {
    const s = _sg();
    Game.units.forEach((u, k) => { const d = s.units && s.units[k]; if (d && u.ill) d.ill = [u.ill.k, u.ill.s]; });
    const M = Game.med;
    if (M) s.med = { st: M.st, epi: M.epi, pd: M.poxDay };
    return s;
  };
  const _as = applySave;
  applySave = function (s) {
    _as(s);
    (s.units || []).forEach((d, k) => {
      const u = Game.units[k];
      if (u && Array.isArray(d.ill) && Object.prototype.hasOwnProperty.call(SICK_KINDS, d.ill[0]) && Number.isFinite(+d.ill[1])) u.ill = { k: d.ill[0], s: Math.max(0.01, Math.min(1, +d.ill[1])) };
    });
    Game.med = null;
    const m = s.med;
    if (m && typeof m === 'object') {
      const M = medEnsure();
      for (const k in M.st) if (m.st && Number.isFinite(m.st[k])) M.st[k] = m.st[k];
      M.epi = !!m.epi; M.poxDay = Number.isFinite(m.pd) ? m.pd : 4;
    }
  };
}

// ---------- «Совет»: часть «Здоровье» ----------

function medHTML() {
  const M = Game.med || { st: { sick: 0, cured: 0, died: 0, potions: 0, epi: 0 }, epi: false };
  const sick = Game.units.filter(u => u.ill && !u.dead).sort((a, b) => a.id - b.id);   // порядок не скачет
  const inf = Game.buildings.filter(b => b.type === 'infirmary' && !b.removed);
  const potions = skStoreHave('potion') + inf.reduce((n, b) => n + (b.stock.potion || 0), 0);
  let h = '';
  if (M.epi) h += '<div class="md-epi">Эпидемия чумной хвори! Чумные заражают соседей, вся деревня в тоске. Лазарет и зелья — первое дело.</div>';
  h += `<div class="lw-top"><span>Больных: <b>${sick.length}</b></span><span>Зелий: <b>${potions}</b></span><span class="muted small">вылечено ${M.st.cured} · умерло ${M.st.died}</span></div>`;
  if (!inf.length) h += `<div class="muted small lw-note">${isUnlocked('infirmary') ? 'Лазарета нет: тяжёлые больные отлёживаются на лавочках, а чумная хворь может унести гнома.' : 'Лазарет откроется после пивоварни. Пока лечат лавочки и терпение.'}</div>`;
  else for (const b of inf) {
    const doc = b.worker && !b.worker.dead;
    h += `<div class="md-inf"><b>Лазарет</b> · мест ${sickBeds(b)}/${SICK.BEDS} · ${doc ? 'лекарь на месте' : '<span class="md-bad">нет лекаря</span>'} · зелий ${b.stock.potion || 0}${b.state !== 'done' ? ' · строится' : ''}</div>`;
  }
  if (sick.length) {
    h += '<div class="md-list">';
    for (const u of sick.slice(0, 12)) {
      const K = SICK_KINDS[u.ill.k] || SICK_KINDS.cold, p = Math.min(100, Math.ceil(u.ill.s * 10) * 10);   // ступенями по 10%: полоска не дёргается
      h += `<div class="md-row" data-cn="med:go:${u.id}"><span class="md-dot" style="background:${K.col}"></span><span class="md-n">${UNIT_TYPES[u.type].name}</span><span class="md-k">${K.t}${u.ward ? ' · в лазарете' : ''}</span><span class="md-bar"><i style="width:${p}%;background:${p >= SICK.BED * 100 ? '#e06a4a' : K.col}"></i></span></div>`;
    }
    if (sick.length > 12) h += `<div class="muted small">и ещё ${sick.length - 12}…</div>`;
    h += '</div>';
  }
  h += '<div class="muted small md-tips">Простуда — от холода и дождя, хворь живота — от голода, чумная хворь приходит с караванами и бродягами. Тепло, сытость и отдых лечат сами; лазарет — быстрее.</div>';
  return h;
}
function medClick(v) {
  const [a, id] = v.split(':');
  if (a !== 'go') return;
  const u = Game.unitMap.get(+id);
  if (u && typeof centerOn === 'function') centerOn(u.x * TILE, u.y * TILE);
}
if (typeof councilAdd === 'function') councilAdd({ id: 'med', order: 2, title: 'Здоровье', html: medHTML, click: medClick, badge: () => !!(Game.med && Game.med.epi) });
