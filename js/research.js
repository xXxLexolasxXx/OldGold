'use strict';
// Исследования (СИСТЕМЫ.md, раздел 4): три ветки по четыре открытия — Ремёсла, Земледелие, Тайны.
// Очки знаний копит «Читальня» (своё здание, работает без работника; рядом с магической мастерской — быстрее),
// открытие стоит очков и немного товаров. В ветке — по порядку; третье открытие ждёт звания «Деревня»,
// четвёртое — «Город» (goal.js). Ничего обязательного не закрыто: открытия — только прибавки.
// Эффекты читают соседи (обёртками и через resHas/resWork/resMood):
//   mood.js — resWork(u) (темп по месту работы), resMood() (настроение); laws.js — +1 место под указ;
//   sickness.js — травник (меньше заразы, быстрее лечение); difficulty — dif().food; trade.js — цены; night.js — шаг ночью.
// Состояние — Game.rsc { done:[id], pts } (сохранение s.rsc). Кооп: считает сервер, команда {t:'rsc', id} (право «Совет деревни»),
// зеркало mir.rsc.

const RSC_CAP = 240;             // больше очков не копится
const RSC_TICK = 8;              // одна читальня даёт очко за столько секунд
const RSC_BRANCHES = [['craft', 'Ремёсла'], ['farm', 'Земледелие'], ['lore', 'Тайны']];
const RSC_COST = [15, 30, 50, 80];
const RSC_RANK = [0, 0, 1, 2];   // какое звание нужно для 1-го…4-го открытия ветки
// fx: work {здание: множитель темпа работника}, food, sell, nightWalk, mood, slot, herbs
const RSC_DEFS = [
  { id: 'saw', b: 'craft', t: 'Двуручная пила', goods: { gold: 4 }, fx: { work: { woodcutter: 1.12, sawmill: 1.12 } },
    d: 'Пилить вдвоём веселее и быстрее. Лесничие работают на 12% быстрее.' },
  { id: 'mason', b: 'craft', t: 'Каменная кладка', goods: { gold: 5, stone: 6 }, fx: { work: { quarry: 1.12 } },
    d: 'Отвес, уровень и крепкое слово. Каменотёсы работают на 12% быстрее.' },
  { id: 'forge', b: 'craft', t: 'Кузнечные мехи', goods: { gold: 8, timber: 6 }, fx: { work: { metallurgist: 1.12, smeltery: 1.12, weaponsmith: 1.12, armory: 1.12, tannery: 1.08 } },
    d: 'Огонь жарче — металл мягче. Кузнецы во всех цехах — до 12% быстрее.' },
  { id: 'brand', b: 'craft', t: 'Цеховые клейма', goods: { gold: 12 }, fx: { sell: 1.08 },
    d: 'На каждом изделии — гномье клеймо. Купцы платят за наши товары на 8% больше.' },
  { id: 'plough', b: 'farm', t: 'Тяжёлый плуг', goods: { gold: 4, timber: 4 }, fx: { work: { farm: 1.12, hopfarm: 1.12 } },
    d: 'Плуг тяжелее — борозда глубже. Пахари — на 12% быстрее.' },
  { id: 'yeast', b: 'farm', t: 'Закваска', goods: { gold: 5, bread: 4 }, fx: { work: { mill: 1.1, bakery: 1.1, brewery: 1.1 } },
    d: 'Тайна пышного хлеба и пенного пива. Пекари-мельники и пивовары — на 10% быстрее.' },
  { id: 'salt', b: 'farm', t: 'Соленья', goods: { gold: 8, sausage: 4 }, fx: { food: 1.12 },
    d: 'Бочки с огурцами и солониной. Гномы сыты на 12% дольше.' },
  { id: 'herbs', b: 'farm', t: 'Травник', goods: { gold: 10, hops: 6 }, fx: { herbs: 1 },
    d: 'Знать, какой лист к чему прикладывать. Заразы меньше, хворь проходит быстрее.' },
  { id: 'lamps', b: 'lore', t: 'Масляные фонари', goods: { gold: 4 }, fx: { nightWalk: 1.08 },
    d: 'Свет, который не гаснет от первого чиха. Ночью гномы ходят на 8% быстрее.' },
  { id: 'circle', b: 'lore', t: 'Чародейский круг', goods: { gold: 6, magicstone: 1 }, fx: { work: { crystalmine: 1.12, magiccircle: 1.12, magicworkshop: 1.12 } },
    d: 'Мел, свечи и правильные слова. Магические постройки — на 12% быстрее.' },
  { id: 'calendar', b: 'lore', t: 'Праздничный календарь', goods: { gold: 10, beer: 6 }, fx: { mood: 2 },
    d: 'Теперь каждый день — чей-нибудь праздник. Настроение всей деревни +2.' },
  { id: 'council', b: 'lore', t: 'Совет мудрецов', goods: { gold: 15 }, fx: { slot: 1 },
    d: 'Седые бороды собираются по вечерам и спорят. Ещё одно место под указ.' },
];
const RSC_BY_ID = Object.create(null);
for (const r of RSC_DEFS) RSC_BY_ID[r.id] = r;

// ---------- Читальня ----------

BUILDINGS.library = {
  name: 'Читальня', cat: 'Основа', w: 3, h: 2, top: 70, cost: { timber: 6, stone: 4 }, auto: true,
  desc: 'Книги, свечи и тишина. Копит очки знаний для открытий во вкладке «Совет» (очко за 8 с, рядом с магической мастерской — быстрее).',
};
BUILD_ORDER.push('library');
UNLOCKS.push({ id: 'lib', items: ['library'], after: ['bakery'] });
if (typeof UNLOCK_NAMES !== 'undefined') UNLOCK_NAMES.lib = 'Читальня';
if (typeof SIGN_OF !== 'undefined') SIGN_OF.library = 'book';
if (typeof MODELS !== 'undefined') {
  MODELS.library = function (m) {
    m.box({
      x0: 6, x1: 90, y0: 10, y1: 58, h: 34, wall: 'stone', col: '#9a907e', lowerStone: 0,
      roof: { type: 'gable', axis: 'X', rise: 24, mat: 'slate', col: '#4a5a7a', ov: 5 },
      decor: {
        S: [{ t: 'door', main: true, shift: 0, w: 16, h: 20, o: { frame: 'stone' } },
          { t: 'win', at: 16, z: 12, w: 9, h: 12, o: { lit: true, arch: true } }, { t: 'win', at: 72, z: 12, w: 9, h: 12, o: { lit: true, arch: true } },
          { t: 'sign', at: 30, z: 24, kind: 'book' }],
        E: [{ t: 'win', at: 30, z: 12, w: 7, h: 10, o: { lit: true, arch: true } }],
        W: [{ t: 'win', at: 30, z: 12, w: 7, h: 10, o: { lit: true, arch: true } }],
      },
      chimneys: [{ x: 20, y: 44, h: 12, kind: 'stone', w: 5 }],
    });
    m.g.spr.doorPt = m.at(m.doorX, 10);
  };
}

// ---------- Состояние и правила ----------

const rscServer = () => typeof coop !== 'undefined' && !!coop && !!coop.out && !!coop.players;
const rscMirror = () => typeof Coop !== 'undefined' && !!Coop.mirror;
function rscEnsure() { return Game.rsc || (Game.rsc = { done: [], pts: 0 }); }
function rscSay(text) { if (rscServer()) coop.out.push({ msg: { t: 'toast', text } }); else if (typeof toast === 'function') toast(text); }
const resHas = id => !!(Game.rsc && Game.rsc.done.includes(id));
const rscRank = () => Game.goal ? Game.goal.rank | 0 : 0;
const rscIndex = r => RSC_DEFS.filter(x => x.b === r.b).indexOf(r);
const rscCost = r => RSC_COST[rscIndex(r)];
function rscHave(g) { let n = 0; for (const s of Game.buildings) if (s.isStore() && !s.removed) n += Math.max(0, s.offer(g)); return n; }
function rscTake(g, n) {
  let left = n;
  for (const s of Game.buildings) { if (!left) break; if (!s.isStore() || s.removed) continue; const t = Math.min(left, Math.max(0, s.offer(g))); s.stock[g] -= t; left -= t; }
  return n - left;
}

// Сводка эффектов
const RSCC = { work: {}, food: 1, sell: 1, nightWalk: 1, mood: 0, slot: 0, herbs: 0, difSrc: null, dif: null };
function rscRecalc() {
  const C = { work: {}, food: 1, sell: 1, nightWalk: 1, mood: 0, slot: 0, herbs: 0 };
  for (const id of (Game.rsc && Game.rsc.done) || []) {
    const fx = RSC_BY_ID[id] && RSC_BY_ID[id].fx;
    if (!fx) continue;
    for (const k in fx.work || {}) C.work[k] = (C.work[k] || 1) * fx.work[k];
    if (fx.food) C.food *= fx.food;
    if (fx.sell) C.sell *= fx.sell;
    if (fx.nightWalk) C.nightWalk *= fx.nightWalk;
    C.mood += fx.mood || 0; C.slot += fx.slot || 0; C.herbs += fx.herbs || 0;
  }
  Object.assign(RSCC, C, { difSrc: null, dif: null });
}
function resWork(u) { const h = u.home; return h && !h.removed && RSCC.work[h.type] || 1; }
const resMood = () => RSCC.mood;

// Почему нельзя открыть (или '' — можно)
function rscWhyNot(id, pts) {
  const r = RSC_BY_ID[id], R = Game.rsc || { done: [], pts: 0 };
  if (!r) return 'Нет такого открытия';
  if (R.done.includes(id)) return 'Уже открыто';
  const i = rscIndex(r), prev = RSC_DEFS.filter(x => x.b === r.b)[i - 1];
  if (prev && !R.done.includes(prev.id)) return 'Сначала «' + prev.t + '»';
  if (rscRank() < RSC_RANK[i]) return 'Нужно звание «' + GOAL_RANKS[RSC_RANK[i]].name + '»';
  if ((pts != null ? pts : R.pts) < rscCost(r)) return 'Мало знаний';
  if (pts == null) for (const g in r.goods) if (rscHave(g) < r.goods[g]) return 'Не хватает: ' + GOODS[g].name.toLowerCase();
  return '';
}
function rscOpen(id, who) {
  const R = rscEnsure(), r = RSC_BY_ID[id];
  const why = rscWhyNot(id);
  if (why) return { ok: false, text: why };
  for (const g in r.goods) rscTake(g, r.goods[g]);
  R.pts -= rscCost(r);
  R.done.push(id);
  rscRecalc();
  const text = `Открытие: «${r.t}»`;
  if (typeof logEvent === 'function') logEvent('rsc', who ? `${text} (${who})` : text);
  rscSay(text + '. Учёные гномы довольно чешут бороды');
  return { ok: true, text };
}

// ---------- Ход времени: читальни копят знания ----------

const RSCT = { acc: 0 };
function rscRate() {
  let n = 0, magic = false;
  for (const b of Game.buildings) {
    if (b.removed || b.state !== 'done' || b.paused) continue;
    if (b.type === 'library') n += (b.level || 1) > 1 ? 1.5 : 1;
    else if (b.type === 'magicworkshop' || b.type === 'magiccircle') magic = true;
  }
  return n * (magic ? 1.5 : 1) / RSC_TICK;
}
function rscTick(dt) {
  RSCT.acc += dt;
  if (RSCT.acc < 1) return;
  const step = RSCT.acc; RSCT.acc = 0;
  const rate = rscRate();
  if (!rate && !Game.rsc) return;
  const R = rscEnsure();
  if (R.pts >= RSC_CAP) return;
  R.pts = Math.min(RSC_CAP, Math.round((R.pts + rate * step) * 100) / 100);
}

function rscCmd(name, m) {
  if (typeof m.id !== 'string' || !RSC_BY_ID[m.id]) return;
  const r = rscOpen(m.id, name);
  if (!r.ok) coop.out.push({ to: name, msg: { t: 'toast', text: r.text } });
}
function rscMirrorOut() { const R = Game.rsc; return R ? { done: R.done, pts: Math.floor(R.pts), rate: +rscRate().toFixed(3) } : null; }
function rscMirrorIn(m) {
  if (!m) { if (Game.rsc) { Game.rsc = null; rscRecalc(); } return; }
  const R = rscEnsure(), ch = R.done.join() !== m.done.join();
  R.done = m.done.slice(); R.pts = m.pts; R.rate = m.rate;
  if (ch) rscRecalc();
}

// ---------- Обёртки соседей ----------

if (typeof daySpeedMul === 'function') {
  const _dsm = daySpeedMul;
  daySpeedMul = function () { const v = _dsm(); return RSCC.nightWalk !== 1 && isNightNow() ? v * RSCC.nightWalk : v; };
}
if (typeof dif === 'function') {
  const _dif = dif;
  dif = function () {
    const d = _dif();
    if (RSCC.food === 1) return d;
    if (RSCC.difSrc !== d) { RSCC.difSrc = d; RSCC.dif = Object.assign({}, d, { food: d.food * RSCC.food }); }
    return RSCC.dif;
  };
}
if (typeof tradeQuote === 'function') {
  const _tq = tradeQuote;
  tradeQuote = function (g, side, k = 1) { const p = _tq(g, side, k); return side === 'sell' && RSCC.sell !== 1 ? p * RSCC.sell : p; };
}

if (typeof LOG_KINDS !== 'undefined') {
  LOG_KINDS.rsc = { icon: 'scroll', name: 'Открытия' };
  LOG_GROUP.rsc = 'life';
  if (typeof LOG_SARC !== 'undefined') LOG_SARC.rsc = ['Наука движется. Медленно, но с бородой.', 'Учёный гном — гном, который прочёл две книги.', 'Записали в толстую книгу. Её никто не откроет.'];
}

if (typeof step === 'function') {
  const _step = step;
  step = function (dt) { _step(dt); if (!rscMirror()) rscTick(dt); };
  const _rgs = resetGameState;
  resetGameState = function () { _rgs(); Game.rsc = null; rscRecalc(); };
  const _sg = serializeGame;
  serializeGame = function () { const s = _sg(), R = Game.rsc; if (R) s.rsc = { done: R.done.slice(), pts: R.pts }; return s; };
  const _as = applySave;
  applySave = function (s) {
    _as(s);
    Game.rsc = null;
    const r = s && s.rsc;
    if (r && Array.isArray(r.done)) {
      const R = rscEnsure();
      R.done = r.done.filter((id, i, a) => RSC_BY_ID[id] && a.indexOf(id) === i);
      R.pts = Number.isFinite(r.pts) ? Math.max(0, Math.min(RSC_CAP, r.pts)) : 0;
    }
    rscRecalc();
  };
}

// ---------- «Совет»: часть «Открытия» ----------

function rscHTML() {
  const R = Game.rsc || { done: [], pts: 0 }, mirror = rscMirror();
  const rate = mirror ? (R.rate || 0) : rscRate();
  let h = `<div class="lw-top"><span>Знаний: <b>${Math.floor(R.pts)}</b>/${RSC_CAP}</span><span class="muted small">${rate ? `+${Math.round(rate * 60)} в минуту` : 'читален нет'}</span><span class="muted small">открыто ${R.done.length}/${RSC_DEFS.length}</span></div>`;
  if (!rate) h += `<div class="muted small lw-note">${isUnlocked('library') ? 'Постройте «Читальню» (вкладка «Основа»): она копит очки знаний.' : 'Читальня откроется после пекарни.'}</div>`;
  for (const [b, name] of RSC_BRANCHES) {
    h += `<div class="rs-branch"><div class="rs-bn">${name}</div>`;
    for (const r of RSC_DEFS.filter(x => x.b === b)) {
      const done = R.done.includes(r.id), why = done ? '' : rscWhyNot(r.id, mirror ? R.pts : null);
      const cost = Object.entries(r.goods).map(([g, n]) => `${GOODS[g].name.toLowerCase()} ${n}`).join(', ');
      h += `<div class="rs-node${done ? ' done' : why ? ' off' : ' ready'}"><div class="lw-name"><b>${r.t}</b>${done ? '<span class="lw-tag">открыто</span>' : ''}</div><div class="lw-d">${r.d}</div>`;
      if (!done) h += `<div class="lw-btns"><button data-cn="rsc:${r.id}"${why ? ' disabled' : ''}>Открыть · ${rscCost(r)} знаний</button><span class="lw-why">${why ? why : cost}</span></div>`;
      h += '</div>';
    }
    h += '</div>';
  }
  return h;
}
function rscClick(id) {
  if (!RSC_BY_ID[id]) return;
  if (rscMirror()) { coopSend({ t: 'rsc', id }); return; }
  const r = rscOpen(id, null);
  if (!r.ok && r.text) toast(r.text);
  updateUI(true);
}
if (typeof councilAdd === 'function') {
  councilAdd({ id: 'rsc', order: 3, title: 'Открытия', html: rscHTML, click: rscClick,
    badge: () => !!(Game.rsc && RSC_DEFS.some(r => !Game.rsc.done.includes(r.id) && !rscWhyNot(r.id, rscMirror() ? Game.rsc.pts : null))) });
}
rscRecalc();
