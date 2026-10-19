'use strict';
// Законы и курс деревни: несколько «слотов» под указы, у каждого указа плюсы и минусы (СИСТЕМЫ.md, раздел 3).
// Слоты открывает звание из goal.js: Поселение — 1, Деревня — 2, Город — 3. Ввести указ стоит золота,
// менять порядки можно не чаще раза в сутки. Взаимоисключающие пары (режим/вольница, пир/пост, ворота).
// Эффекты читают соседи через обёртки, свои файлы не трогаем:
//   mood.js     — lawMood(night) — причина «Порядки», lawWork() — множитель темпа; MD.FIGHT_GAP — частота драк;
//   night.js    — daySpeedMul (ночной дозор ходит быстрее ночью);
//   difficulty  — dif().food (как долго гном сыт);
//   trade.js    — tradeQuote (цены), trAfterCaravan (частота караванов).
// Состояние — Game.laws { on:[id], day, seq, prop, beer, last } (пишется в сохранение).
// Кооп: считает сервер. Указ предлагает игрок с правом «Совет деревни», остальные голосуют (LAW_VOTE_T с);
// если события решает хост (режим из dilemma.js) — указ хоста проходит сразу. Клиентам — зеркало mir.law.

const LAW_COST = 8;              // золота за новый указ (отмена бесплатна)
const LAW_VOTE_T = 60;           // кооп: секунд на голосование
const LAW_SLOTS = [1, 2, 3];     // по званию: поселение, деревня, город
const LAW_TAX_T = 120;           // как часто берётся «десятина» по пивному указу, с
const LAW_FIGHT0 = typeof MD !== 'undefined' ? MD.FIGHT_GAP : 70;

// fx: work — темп работы, mood — очки настроения всегда, moodNight / moodDay — только ночью / днём,
// food — во сколько раз дольше гном сыт, fight — пауза между драками, sell / buy — цены купцов,
// caravan — пауза между караванами, migr — беглецы прибиваются к деревне, beer — пивная десятина (гномов на кружку)
const LAW_DEFS = [
  { id: 'strict', t: 'Жёсткий режим', x: 'free', fx: { work: 1.08, mood: -6, fight: 1.6 },
    d: 'Подъём с петухами, перекур по свистку. Работа идёт бодрее, гномы — хмурее. Драться боятся: надзиратель смотрит.' },
  { id: 'free', t: 'Вольница', x: 'strict', fx: { work: 0.95, mood: 6, fight: 0.6 },
    d: 'Каждый сам себе мастер. Песни, шутки и неспешная работа. Кулаки, правда, тоже чешутся чаще.' },
  { id: 'beer', t: 'Культ пива', fx: { beer: 10 },
    d: 'Пиво — святое. Раз в две минуты со складов уходит кружка на каждые десять гномов. Есть пиво — праздник в душе, нет — траур.' },
  { id: 'feast', t: 'Сытный стол', x: 'fast', fx: { food: 0.85, mood: 4, work: 1.03 },
    d: 'Кормить от пуза. Гномы довольны и работают охотнее, но и в трактир бегают чаще — хлеба уходит больше.' },
  { id: 'fast', t: 'Пояса потуже', x: 'feast', fx: { food: 1.3, mood: -5, work: 0.97 },
    d: 'Экономия на еде: сытость тянется дольше, склад пустеет медленнее. Ворчат на каждом шагу и ползают как сонные мухи.' },
  { id: 'open', t: 'Открытые ворота', x: 'closed', fx: { caravan: 0.7, sell: 1.08, mood: -2, migr: 1 },
    d: 'Двери настежь: караваны чаще и щедрее, а бродяги иногда остаются насовсем. Свои, правда, косятся на чужаков.' },
  { id: 'closed', t: 'Закрытые ворота', x: 'open', fx: { caravan: 1.6, sell: 0.9, buy: 1.1, mood: 3 },
    d: 'Засовы, частокол, никаких чужих. Спокойно и тихо — но купцы приезжают реже и торгуются злее.' },
  { id: 'watch', t: 'Ночной дозор', fx: { nightWalk: 1.12, moodNight: 3, moodDay: -3 },
    d: 'Ночью — дозоры с факелами: по темноте ходят смелее и быстрее. Днём дозорные клюют носом и злятся.' },
];
const LAW_BY_ID = Object.create(null);
for (const L of LAW_DEFS) LAW_BY_ID[L.id] = L;

// ---------- Состояние ----------

const lawServer = () => typeof coop !== 'undefined' && !!coop && !!coop.out && !!coop.players;
const lawMirror = () => typeof Coop !== 'undefined' && !!Coop.mirror;
const lawDay = () => cycleAt(Game.time).k;
function lawEnsure() { return Game.laws || (Game.laws = { on: [], day: -9, seq: 0, prop: null, beer: { t: 0, ok: true }, last: null }); }
function lawSay(text) { if (lawServer()) coop.out.push({ msg: { t: 'toast', text } }); else if (typeof toast === 'function') toast(text); }
function lawRank() { return Game.goal ? Math.max(0, Math.min(2, Game.goal.rank | 0)) : 0; }
const lawSlots = () => LAW_SLOTS[lawRank()] + (typeof RSCC !== 'undefined' ? RSCC.slot : 0);   // «Совет мудрецов» (research.js) — ещё место
const lawIsOn = id => !!(Game.laws && Game.laws.on.includes(id));
function lawPop() { let n = 0; for (const u of Game.units) if (isPerson(u) && !u.dead && u.type !== 'hero' && u.type !== 'carter' && !u.owner && !u.rec) n++; return n; }

// склад: та же логика, что у дилемм
function lawHave(g) { let n = 0; for (const s of Game.buildings) if (s.isStore() && !s.removed) n += Math.max(0, s.offer(g)); return n; }
function lawTake(g, n) {
  let left = n;
  for (const s of Game.buildings) { if (!left) break; if (!s.isStore() || s.removed) continue; const t = Math.min(left, Math.max(0, s.offer(g))); s.stock[g] -= t; left -= t; }
  return n - left;
}

// Сводка эффектов активных указов (пересчитывается при смене)
const LAWC = { work: 1, mood: 0, moodNight: 0, moodDay: 0, food: 1, fight: 1, sell: 1, buy: 1, caravan: 1, nightWalk: 1, migr: 0, beer: 0, difSrc: null, dif: null };
function lawRecalc() {
  const C = { work: 1, mood: 0, moodNight: 0, moodDay: 0, food: 1, fight: 1, sell: 1, buy: 1, caravan: 1, nightWalk: 1, migr: 0, beer: 0 };
  for (const id of (Game.laws && Game.laws.on) || []) {
    const fx = LAW_BY_ID[id] && LAW_BY_ID[id].fx;
    if (!fx) continue;
    for (const k in fx) {
      if (k === 'mood' || k === 'moodNight' || k === 'moodDay' || k === 'migr' || k === 'beer') C[k] += fx[k];
      else C[k] *= fx[k];
    }
  }
  Object.assign(LAWC, C, { difSrc: null, dif: null });
  if (typeof MD !== 'undefined') MD.FIGHT_GAP = Math.round(LAW_FIGHT0 * LAWC.fight);
}

// для mood.js: очки настроения от порядков и множитель темпа
function lawMood(night) {
  if (!Game.laws || !Game.laws.on.length) return 0;
  let v = LAWC.mood + (night ? LAWC.moodNight : LAWC.moodDay);
  if (LAWC.beer) v += Game.laws.beer && Game.laws.beer.ok ? 5 : -4;
  return v;
}
const lawWork = () => LAWC.work;

// Почему нельзя ввести указ (или '' — можно)
function lawWhyNot(id) {
  const L = lawEnsure(), d = LAW_BY_ID[id];
  if (!d) return 'Нет такого указа';
  if (!startOpen('laws')) return 'Указы появятся позже: сперва поселению нужно стать деревней';
  if (L.on.includes(id)) return 'Уже действует';
  if (L.prop) return 'Идёт голосование';
  if (L.day === lawDay()) return 'Порядки сегодня уже меняли — завтра';
  if (d.x && L.on.includes(d.x)) return 'Мешает «' + LAW_BY_ID[d.x].t + '»';
  if (L.on.length >= lawSlots()) return lawRank() < 2 ? 'Все места заняты: новое звание даст ещё одно' : 'Все места заняты';
  if (lawHave('gold') < LAW_COST) return 'Нужно ' + LAW_COST + ' золота';
  return '';
}

// Применить решение (хозяин мира)
function lawSet(id, on, who) {
  const L = lawEnsure(), d = LAW_BY_ID[id];
  if (!d) return { ok: false, text: 'Нет такого указа' };
  if (on) {
    const why = lawWhyNot(id);
    if (why) return { ok: false, text: why };
    lawTake('gold', LAW_COST);
    L.on.push(id);
  } else {
    if (!L.on.includes(id)) return { ok: false, text: 'Указ и так не действует' };
    if (L.day === lawDay()) return { ok: false, text: 'Порядки сегодня уже меняли — завтра' };
    L.on = L.on.filter(x => x !== id);
  }
  L.day = lawDay();
  L.seq++;
  if (id === 'beer') L.beer = { t: Game.time + 5, ok: lawHave('beer') > 0 };
  lawRecalc();
  const text = on ? `Новый указ: «${d.t}»` : `Указ «${d.t}» отменён`;
  L.last = { seq: L.seq, text, t: Game.time };
  if (typeof logEvent === 'function') logEvent('law', who ? `${text} (предложил ${who})` : text);
  lawSay(on ? text + '. Гномы читают объявление на складе и чешут бороды' : text + '. Гномы выдохнули — или наоборот');
  return { ok: true, text };
}

// ---------- Ход времени ----------

const LAWT = { acc: 0, migrDay: -1 };
function lawTick(dt) {
  const L = Game.laws;
  if (!L) return;
  LAWT.acc += dt;
  if (LAWT.acc < 1) return;
  LAWT.acc = 0;
  const now = Game.time;
  // голосование
  if (L.prop && lawServer()) {
    if (!coop.players.size) L.prop.dl = Math.max(L.prop.dl, now + 20);
    else if (now >= L.prop.dl) lawFinish();
  }
  if (!L.on.length) return;
  // пивная десятина
  if (LAWC.beer && now >= (L.beer.t || 0)) {
    L.beer.t = now + LAW_TAX_T;
    const need = Math.max(1, Math.ceil(lawPop() / LAWC.beer));
    const got = lawTake('beer', need);
    const ok = got >= need;
    if (ok !== L.beer.ok && typeof logEvent === 'function') logEvent('law', ok ? 'Культ пива: кружки снова полны, деревня славит пивоваров' : 'Культ пива: пива на десятину не хватило — траур и ропот');
    L.beer.ok = ok;
  }
  // открытые ворота: раз в сутки бродяга может остаться
  if (LAWC.migr) {
    const day = lawDay();
    if (day !== LAWT.migrDay) {
      const first = LAWT.migrDay < 0;
      LAWT.migrDay = day;
      if (!first && !isNightNow() && Math.random() < 0.45 && lawPop() < 60) lawMigrant();
    }
  }
}

function lawMigrant() {
  const st = Game.buildings.find(s => s.isStore() && !s.removed && s.state === 'done');
  if (!st) return;
  const p = (typeof randomFreeNear === 'function' && randomFreeNear(st.doorX, st.doorY + 1, 1, 6)) || [st.doorX, st.doorY + 1];
  spawnUnit('serf', p[0], p[1]);
  if (typeof logEvent === 'function') logEvent('law', 'Открытые ворота: бродяга попросился в работяги и остался', p[0], p[1]);
  lawSay('Через открытые ворота пришёл бродяга и остался работать');
}

// ---------- Кооп: предложения и голоса ----------

function lawPropose(name, isHost, id, on) {
  const L = lawEnsure(), d = LAW_BY_ID[id];
  if (!d) return;
  const tell = text => coop.out.push({ to: name, msg: { t: 'toast', text } });
  if (L.prop) { tell('Уже голосуем за другой указ'); return; }
  if (on) { const why = lawWhyNot(id); if (why) { tell(why); return; } }
  else if (!L.on.includes(id)) return;
  else if (L.day === lawDay()) { tell('Порядки сегодня уже меняли — завтра'); return; }
  const hostMode = Game.dil && Game.dil.mode === 'host';
  if (hostMode && !isHost) { tell('Указы сейчас решает хост'); return; }
  if (hostMode || coop.players.size <= 1) { lawSet(id, on, name); return; }
  L.prop = { seq: ++L.seq, id, on: !!on, by: name, votes: { [name]: true }, dl: Game.time + LAW_VOTE_T };
  lawSay(`${name} предлагает ${on ? 'ввести' : 'отменить'} указ «${d.t}» — голосуйте во вкладке «Совет»`);
}
function lawVote(name, seq, yes) {
  const L = Game.laws, P = L && L.prop;
  if (!P || P.seq !== seq) return;
  P.votes[name] = !!yes;
  const n = coop.players.size, v = Object.values(P.votes), y = v.filter(Boolean).length, no = v.length - y;
  if (v.length >= n || y > n / 2 || no >= n / 2) lawFinish();
}
function lawFinish() {
  const L = Game.laws, P = L && L.prop;
  if (!P) return;
  L.prop = null;
  const v = Object.values(P.votes), y = v.filter(Boolean).length;
  const d = LAW_BY_ID[P.id];
  if (y > v.length - y) {
    const r = lawSet(P.id, P.on, P.by);
    if (!r.ok) lawSay(`Указ «${d.t}» не прошёл: ${r.text.toLowerCase()}`);
  } else lawSay(`Совет против: указ «${d.t}» ${P.on ? 'не вводим' : 'остаётся'}`);
}
function lawCmd(name, isHost, m) {
  if (m.a === 'prop' && typeof m.id === 'string' && LAW_BY_ID[m.id]) lawPropose(name, isHost, m.id, !!m.on);
  else if (m.a === 'vote' && Number.isInteger(m.seq)) lawVote(name, m.seq, !!m.y);
}

function lawMirrorOut() {
  const L = Game.laws;
  if (!L) return null;
  const P = L.prop;
  return { on: L.on, day: L.day, beer: L.beer.ok ? 1 : 0, last: L.last, prop: P ? { seq: P.seq, id: P.id, on: P.on, by: P.by, votes: P.votes, left: Math.max(0, Math.round(P.dl - Game.time)) } : null };
}
function lawMirrorIn(m) {
  if (!m) { if (Game.laws) { Game.laws = null; lawRecalc(); } return; }
  const L = lawEnsure();
  const ch = L.on.join() !== m.on.join();
  if (m.last && (!L.last || L.last.seq !== m.last.seq) && typeof logEvent === 'function') logEvent('law', m.last.text);
  L.on = m.on.slice(); L.day = m.day; L.beer = { t: 0, ok: !!m.beer }; L.last = m.last; L.prop = m.prop;
  if (ch) lawRecalc();
}

// ---------- Обёртки соседей ----------

if (typeof daySpeedMul === 'function') {
  const _dsm = daySpeedMul;
  daySpeedMul = function () { const v = _dsm(); return LAWC.nightWalk !== 1 && isNightNow() ? v * LAWC.nightWalk : v; };
}
if (typeof dif === 'function') {
  const _dif = dif;
  dif = function () {
    const d = _dif();
    if (LAWC.food === 1) return d;
    if (LAWC.difSrc !== d) { LAWC.difSrc = d; LAWC.dif = Object.assign({}, d, { food: d.food * LAWC.food }); }
    return LAWC.dif;
  };
}
if (typeof tradeQuote === 'function') {
  const _tq = tradeQuote;
  tradeQuote = function (g, side, k = 1) { const p = _tq(g, side, k); return side === 'sell' ? p * LAWC.sell : side === 'buy' ? p * LAWC.buy : p; };
}
if (typeof trAfterCaravan === 'function') {
  const _tac = trAfterCaravan;
  trAfterCaravan = function (T) { _tac(T); if (LAWC.caravan !== 1 && T.next > Game.time) T.next = Game.time + (T.next - Game.time) * LAWC.caravan; };
}

if (typeof LOG_KINDS !== 'undefined') {
  LOG_KINDS.law = { icon: 'scroll', name: 'Указы' };
  LOG_GROUP.law = 'life';
  if (typeof LOG_SARC !== 'undefined') LOG_SARC.law = ['Бумага всё стерпит. Гномы — не всё.', 'Глашатай охрип, но доволен.', 'Указ прибили к двери склада. Гвоздём, для солидности.'];
}

if (typeof step === 'function') {
  const _step = step;
  step = function (dt) { _step(dt); if (!lawMirror()) lawTick(dt); };
  const _rgs = resetGameState;
  resetGameState = function () { _rgs(); Game.laws = null; LAWT.migrDay = -1; lawRecalc(); };
  const _sg = serializeGame;
  serializeGame = function () {
    const s = _sg(), L = Game.laws;
    if (L && (L.on.length || L.day >= 0)) s.law = { on: L.on.slice(), day: L.day, seq: L.seq, beer: L.beer };
    return s;
  };
  const _as = applySave;
  applySave = function (s) {
    _as(s);
    const l = s && s.law;
    Game.laws = null;
    if (l && Array.isArray(l.on)) {
      const L = lawEnsure();
      L.on = l.on.filter((id, i, a) => LAW_BY_ID[id] && a.indexOf(id) === i).slice(0, 3);
      L.day = Number.isFinite(l.day) ? l.day : -9;
      L.seq = l.seq | 0;
      L.beer = { t: Game.time + 10, ok: !(l.beer && l.beer.ok === false) };
    }
    LAWT.migrDay = -1;
    lawRecalc();
  };
}

// ---------- Вкладка «Совет»: часть «Указы» ----------

const lawEsc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function lawChips(fx) {
  const out = [], add = (k, t) => out.push(`<span class="dl-chip ${k}">${t}</span>`);
  const pct = v => (v > 1 ? '+' : '−') + Math.round(Math.abs(v - 1) * 100) + '%';
  if (fx.work) add(fx.work > 1 ? 'up' : 'dn', 'Темп ' + pct(fx.work));
  if (fx.mood) add(fx.mood > 0 ? 'up' : 'dn', 'Настроение ' + (fx.mood > 0 ? '+' : '−') + Math.abs(fx.mood));
  if (fx.moodNight) add('up', 'Ночью настроение +' + fx.moodNight);
  if (fx.moodDay) add('dn', 'Днём настроение −' + Math.abs(fx.moodDay));
  if (fx.nightWalk) add('up', 'Ночью шаг ' + pct(fx.nightWalk));
  if (fx.food) add(fx.food > 1 ? 'up' : 'dn', fx.food > 1 ? 'Сыты дольше' : 'Едят чаще');
  if (fx.fight) add(fx.fight > 1 ? 'up' : 'dn', fx.fight > 1 ? 'Драк меньше' : 'Драк больше');
  if (fx.caravan) add(fx.caravan < 1 ? 'up' : 'dn', fx.caravan < 1 ? 'Караваны чаще' : 'Караваны реже');
  if (fx.sell) add(fx.sell > 1 ? 'up' : 'dn', 'Продажа ' + pct(fx.sell));
  if (fx.buy) add(fx.buy < 1 ? 'up' : 'dn', 'Покупка ' + pct(fx.buy));
  if (fx.migr) add('up', 'Приходят бродяги');
  if (fx.beer) add('chain', 'Пиво есть: +5 · нет: −4'), add('dn', 'Кружка на ' + fx.beer + ' гномов / 2 мин');
  return out.join('');
}

function lawHTML() {
  const L = Game.laws || { on: [], day: -9, prop: null, beer: { ok: true } };
  const slots = lawSlots(), mirror = lawMirror(), today = L.day === lawDay();
  let h = `<div class="lw-top"><span>Мест под указы: <b>${L.on.length}/${slots}</b></span><span class="muted small">${today ? 'сегодня порядки уже меняли' : 'менять порядки можно раз в сутки'} · указ — ${LAW_COST} зол.</span></div>`;
  if (lawRank() < 2 && !(typeof RSCC !== 'undefined' && RSCC.slot)) h += `<div class="muted small lw-note">Новое звание деревни («${GOAL_RANKS[lawRank() + 1].name}») даст ещё одно место.</div>`;
  const P = L.prop;
  if (P && LAW_BY_ID[P.id]) {
    const v = Object.values(P.votes || {}), y = v.filter(Boolean).length, mine = mirror && P.votes ? P.votes[Coop.nick] : undefined;
    h += `<div class="lw-prop"><b>${lawEsc(P.by)}</b> предлагает ${P.on ? 'ввести' : 'отменить'} «${lawEsc(LAW_BY_ID[P.id].t)}» · за ${y}, против ${v.length - y} · ещё ${P.left} с
      <div class="lw-btns"><button data-cn="law:vote:1"${mine === true ? ' class="on"' : ''}>За</button><button data-cn="law:vote:0"${mine === false ? ' class="on"' : ''}>Против</button></div></div>`;
  }
  for (const d of LAW_DEFS) {
    const on = L.on.includes(d.id);
    const why = on ? '' : (mirror ? (P ? 'Идёт голосование' : lawWhyNotLite(d.id, L)) : lawWhyNot(d.id));
    const beerBad = on && d.id === 'beer' && !L.beer.ok;
    h += `<div class="lw-row${on ? ' on' : ''}"><div class="lw-name"><b>${d.t}</b>${on ? `<span class="lw-tag${beerBad ? ' bad' : ''}">${beerBad ? 'пива нет!' : 'действует'}</span>` : ''}</div>
      <div class="lw-d">${d.d}</div><div class="dl-chips">${lawChips(d.fx)}</div>
      <div class="lw-btns">${on ? `<button data-cn="law:off:${d.id}"${today || P ? ' disabled' : ''}>Отменить</button>` : `<button data-cn="law:on:${d.id}"${why ? ' disabled' : ''}>Ввести · ${LAW_COST} зол.</button>${why ? `<span class="lw-why">${lawEsc(why)}</span>` : ''}`}</div></div>`;
  }
  return h;
}
// у клиента кооператива нет складов-истины, проверяем только то, что знаем
function lawWhyNotLite(id, L) {
  const d = LAW_BY_ID[id];
  if (L.day === lawDay()) return 'Порядки сегодня уже меняли — завтра';
  if (d.x && L.on.includes(d.x)) return 'Мешает «' + LAW_BY_ID[d.x].t + '»';
  if (L.on.length >= lawSlots()) return 'Все места заняты';
  return '';
}

function lawClick(v) {
  const [a, x] = v.split(':');
  const L = Game.laws;
  if (a === 'vote') { if (L && L.prop) coopSend({ t: 'law', a: 'vote', seq: L.prop.seq, y: x === '1' }); return; }
  if (a !== 'on' && a !== 'off') return;
  if (lawMirror()) { coopSend({ t: 'law', a: 'prop', id: x, on: a === 'on' }); return; }
  const r = lawSet(x, a === 'on', null);
  if (!r.ok && r.text) toast(r.text);
  updateUI(true);
}

if (typeof councilAdd === 'function') {
  councilAdd({ id: 'law', order: 1, title: 'Указы и порядки', html: lawHTML, click: lawClick,
    badge: () => !!(Game.laws && Game.laws.prop && lawMirror() && !(Coop.nick in (Game.laws.prop.votes || {}))) });
}
lawRecalc();
