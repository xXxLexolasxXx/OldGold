'use strict';
// Кампания «Исход из Подгорья» (КАМПАНИЯ.md): сценарные миссии со своей картой, готовым миром, диалогами,
// триггерами, катсценами и целью. Акт описывает js/campaign/actN.js: CAMP_ACTS[n] = { name, seed, map(), setup(C), steps, fail(C) }.
// Сценарий — список шагов, выполняемых по порядку (типы — CAMP_STEP ниже): say — реплики, cut — катсцена (камера, полосы),
// goal — цели (счётчики, зоны для героя), wait — ждать время/условие, do — действие акта, check — контрольная точка, end — итог.
// Состояние миссии — Game.camp (пишется в сохранение мира), прогресс кампании и наследие — localStorage oldgold.campaign.
// Считается в шаге симуляции; интерфейс (диалоги, полосы, цели, итог) только читает Game.camp и отмечает прочитанные реплики.
// В кампании выключены: сценарий глав (goal.js), лор долины, обучение, случайные дилеммы, бедствия и Малгор (Game.foe — заглушка).
// Кооп (КАМПАНИЯ_КООП.md): сценарий считает сервер, клиентам — зеркало campMirrorOut/In; акт запускает хост (coopsim.js, команда campaign).
// Реплики на сервере листаются голосом «Дальше» всех игроков или сами через CAMP_COOP_LINE с, паузы нет; выбор — за хостом.

const CAMP_KEY = 'oldgold.campaign';
const CAMP_SLOT = 'camp';            // слот свежего сейва кампании (saveGame/loadGame)
const CAMP_CP = 'campcp';            // слот последней контрольной точки
const CAMP_LINE_T = 1.2;             // без интерфейса (сервер, тесты): реплика «читается» столько игровых секунд
const CAMP_IDLE = 14;                // с. без нажатий — реплика листается сама
const CAMP_COOP_LINE = 10;           // кооп: строка листается сама через столько игровых секунд
const CAMP_COOP_PICK = 90;           // кооп: хост не выбрал — вариант по умолчанию
const CAMP_COOP_OUT = 8;             // кооп: итог выбора висит столько секунд (или пока все не нажали «Дальше»)
const CAMP_ACTS = {};                // заполняют js/campaign/actN.js
const CAMP_WHO = {
  grum: { name: 'Грум Ворчун', ch: 'Г', col: '#e0a050', bg: '#3a2a14' },
  yagla: { name: 'Бабушка Ягла', ch: 'Я', col: '#e8b4d4', bg: '#3a1e30' },
  pim: { name: 'Пим Чернилкин', ch: 'П', col: '#8ad8a8', bg: '#16302a' },
  tan: { name: 'Тан Борода Старший', ch: 'Т', col: '#f0d070', bg: '#3a3010' },
  shnyr: { name: 'Король Шнырь Пороховой', ch: 'Ш', col: '#a8d060', bg: '#24300e' },
  gob: { name: 'Гоблин', ch: 'г', col: '#8ab850', bg: '#1e2a10' },
  champ: { name: 'Чемпион гоблинов', ch: 'Ч', col: '#c8c070', bg: '#262a14' },
  troll: { name: 'Тролль', ch: 'Т', col: '#9ac070', bg: '#1a2a14' },
  golem: { name: 'Голем', ch: 'Г', col: '#e8b030', bg: '#2a2a24' },
  zhmykha: { name: 'Жмыха Кремнёвая', ch: 'Ж', col: '#b0c4e0', bg: '#1e2838' },
  kremen: { name: 'Кремень-младший', ch: 'К', col: '#e09060', bg: '#3a2014' },
  mrak: { name: 'Малгор', ch: 'М', col: '#9cf06a', bg: '#2a1840' },
  hero: { name: 'Герой', ch: '★', col: '#ffe9a8', bg: '#2a2a3a' },
  note: { name: '', ch: '✎', col: '#e0c890', bg: '#2a2014' },
};
const CampBoot = { on: false };      // идёт сборка мира акта: Малгор не создаётся

Game.camp = null;

// ---------- Прогресс кампании (у игрока, не у мира) ----------

function campProg() {
  try { const p = JSON.parse(localStorage.getItem(CAMP_KEY)); if (p && p.v === 1 && p.done) return p; } catch (e) { /* нет хранилища */ }
  return { v: 1, done: {}, legacy: {}, last: 0 };
}
function campProgSave(p) { try { localStorage.setItem(CAMP_KEY, JSON.stringify(p)); } catch (e) { /* нет хранилища */ } }
function campIsOpen(n) { return n === 1 || !!campProg().done[n - 1]; }
const campOn = () => !!Game.camp;
const campAct = () => (Game.camp ? CAMP_ACTS[Game.camp.act] : null);
// настоящий DOM (на сервере и в тестах document — заглушка, у неё nodeType не число)
const campHasUI = () => typeof document !== 'undefined' && !window.__SERVER__ && !!document.getElementById && (document.getElementById('view') || {}).nodeType === 1;
// кооп-сервер ведёт сценарий; без игроков (тесты одиночной кампании на том же движке сервера) — как в одиночной игре
const campSrv = () => typeof coop !== 'undefined' && !!coop && !!coop.out && !!coop.players && coop.players.size > 0;
const campMir = () => typeof Coop !== 'undefined' && !!Coop.mirror;                          // кооп-клиент: только зеркало
const CampSrv = { cp: null, cpN: 0, byVote: 0, byTime: 0 };   // кооп-сервер: последняя контрольная точка (сейв мира строкой)

// ---------- Помощники для сценариев ----------

// облик героя переходит между актами: имя, цвета/борода/жилет (hero.app), класс гильдии (clsKey, mastery)
function campHeroLook(u) {
  const H = u && u.hero;
  if (!H) return null;
  const o = { name: H.name };
  if (H.app) o.app = H.app.slice();
  for (const k of ['clsKey', 'cls', 'mastery']) if (H[k] != null) o[k] = H[k];
  return o;
}
function campHeroLookApply(u, o) {
  if (!u || !u.hero || !o) return false;
  if (o.name) u.hero.name = o.name;
  if (Array.isArray(o.app) && (typeof haClean !== 'function' || haClean(o.app))) u.hero.app = o.app.slice();
  for (const k of ['clsKey', 'cls', 'mastery']) if (o[k] != null) u.hero[k] = o[k];
  u._spr = null;
  if (typeof HA !== 'undefined' && u.hero.app) HA.last = u.hero.app.slice();
  Game.heroAsk = false;
  return true;
}
function campHero() { return Game.units.find(u => u.type === 'hero' && !u.dead) || null; }
// в коопе героев несколько: зоны и «подойти» засчитываются любому
function campHeroes() { return Game.units.filter(u => u.type === 'hero' && !u.dead); }
function campHeroNear(x, y, r) {
  let best = null, bd = r;
  for (const h of campHeroes()) { const d = Math.hypot(h.x - x, h.y - y); if (!h.inside && d <= bd) { best = h; bd = d; } }
  return best;
}
function campPeople() { let n = 0; for (const u of Game.units) if (!u.dead && isPerson(u) && u.type !== 'hero' && u.type !== 'carter') n++; return n; }
function campStock(g) { let n = 0; for (const b of Game.buildings) if (!b.removed && b.isStore && b.isStore()) n += Math.max(0, b.stock[g] || 0); return n; }
function campProduced(g) { return (Game.produced && Game.produced[g]) || 0; }
function campIn(u, z) { return !!u && !u.inside && Math.hypot(u.x - z[0], u.y - z[1]) <= z[2]; }
function campDone(type) { return Game.buildings.filter(b => b.type === type && b.state === 'done' && !b.removed).length; }
function campFoes(tag) { return Game.raiders.filter(N => N.st !== 'die' && N.st !== 'vanish' && (!tag || N.ctag === tag)); }
// где сейчас отряд метки tag (◎ у цели «отбить»): вожак, если жив, иначе первый живой
function campFoeAt(tag) {
  const L = campFoes(tag);
  if (!L.length) return null;
  const N = L.find(M => FSPEC[M.k] && FSPEC[M.k].mhp >= 100) || L[0];
  return [Math.round(N.x), Math.round(N.y)];
}
// отставшие: отряд tag дольше sec после t0 бродит вдали от всех (застрял в лесу) — удирает, чтобы цель «отбить» не повисла
function campStragglers(tag, t0, sec, msg) {
  if (!t0 || Game.time - t0 < sec) return;
  const L = campFoes(tag);
  if (!L.length || L.some(N => Game.units.some(u => !u.dead && isPerson(u) && Math.hypot(u.x - N.x, u.y - N.y) < 12))) return;
  for (const N of L) { N.st = 'vanish'; N.vt = 0; }
  if (msg) campSay(msg);
}
function campSay(text) { if (typeof toast === 'function') toast(text); }

// враг кампании: налётчик из enemy.js (видят его герой, рекруты и башни), не уходит на рассвете
function campFoe(k, x, y, tag, opts = {}) {
  const N = foeMake(k, x, y);
  N.ctag = tag || ''; N.stay = 1; N.hunt = !!opts.hunt; N.st = 'emerge'; N.t = -(opts.delay || 0);
  if (opts.hold) { N.hold = 1; N.hx = x; N.hy = y; }
  return N;
}

// гоблины Шныря Порохового: дерутся как слуги Малгора, но склады не грабят — им нужна гора.
// hold — сторожат место (штрек), пока рядом не появится житель или герой
if (typeof FSPEC !== 'undefined') {
  FSPEC.goblin = { name: 'Гоблин-подрывник', mhp: 26, dmg: [2, 5], cd: 1.4, rng: 1.4, spd: 2.3, parry: 0.08, xp: 26, sz: 7,
    drop: [['gold', 1, 0.45], ['trunk', 1, 0.3]], draw: (c, N) => campDrawGoblin(c, N), ai: campGoblinAi };
  // чемпион: почти с тролля, щит отводит удары, ржавый меч бьёт тяжело
  FSPEC.goblinChamp = { name: 'Чемпион гоблинов', mhp: 130, dmg: [6, 10], cd: 1.9, rng: 1.9, spd: 1.8, parry: 0.3, xp: 130, sz: 13,
    drop: [['gold', 3, 1], ['iron', 1, 0.5]], draw: (c, N) => campDrawGoblin(c, N), ai: campGoblinAi, bar: (c, N, px, py) => { if (N.hp < N.mhp - 0.5) foeDrawBar(c, N, px, py - 70, false); } };
}
// тролль из-под Брюзги: гора легла на его пещеру, и виноватыми он назначил гномов. Медленный, толстокожий, бьёт больно
if (typeof FSPEC !== 'undefined') {
  FSPEC.campTroll = { name: 'Тролль из-под Брюзги', mhp: 120, dmg: [7, 12], cd: 2.2, rng: 1.9, spd: 1.35, parry: 0.08, xp: 140, sz: 18,
    drop: [['hide', 2, 1], ['gold', 2, 0.7]], draw: (c, N) => campDrawGoblin(c, N, 'troll'), ai: campGoblinAi,
    bar: (c, N, px, py) => { if (N.hp < N.mhp - 0.5) foeDrawBar(c, N, px, py - 58, false); } };
}
// короткая реплика над головой врага (гоблины, тролли): живой противник, а не мишень
function campBark(N, text, col = '#f0e0a0') { if (N && text) floater(N.x, N.y - (N.k === 'campTroll' ? 3.4 : 2.6), text, col); }

function campGoblinAi(N, dt) {
  if (N.halt) { N.st = 'idle'; N.tg = 0; N.cdA -= dt; return; }   // встали как вкопанные (граница владений)
  if (N.hold && !N.tg) {
    N.cdA -= dt;
    if (N.st === 'emerge') { N.t += dt; if (N.t >= 0) N.st = 'idle'; return; }
    N.scan = (N.scan || 0) - dt;
    if (N.scan <= 0) {
      N.scan = 0.5;
      const t = foeTargetNear(N, 6);
      if (t) { N.tg = t.id; N.prov = Game.time; N.hold = 0; }
    }
    if (N.hold) { N.st = 'idle'; return; }
  }
  rdMelee(N, dt);
}

// Марш: жители бросают дела и идут к точке (бегство, сбор); flags.march — пока он идёт. Дошедшие ждут на месте
function campMarch(units, x, y, spread = 3) {
  const C = Game.camp;
  C.flags.march = [x, y, spread];
  units.forEach((u, k) => { if (!u.dead && u.type !== 'hero') { u.march = 1; u.marchK = k; campMarchGo(u); } });
}
function campMarchGo(u) {
  const [x, y, spread] = Game.camp.flags.march, k = u.marchK || 0;
  const tx = Math.round(x + ((k * 7) % (spread * 2 + 1)) - spread), ty = Math.round(y + ((k * 3) % 3) - 1);
  u.action = null; u.brk = null;
  u.proc = u.marchProc = (function* () {
    while (Game.camp && Game.camp.flags.march) {
      const ok = yield { walk: [tx, ty], offroad: true };
      yield { wait: ok ? 2 : 1 };
    }
    u.march = 0;
  })();
}
// голод, лечение, сон и досуг перехватывают поведение — идущих в колонне возвращаем на дорогу
function campMarchTick() {
  for (const u of Game.units) {
    if (!u.march || u.dead) continue;
    u.food = Math.max(u.food, 0.9);
    if (u.proc !== u.marchProc) campMarchGo(u);
  }
}
function campMarchStop() { const C = Game.camp; if (C) C.flags.march = null; for (const u of Game.units) if (u.march) { u.march = 0; u.proc = null; u.action = null; } }

// ---------- Шаги ----------
// s — состояние шага (не сохраняется: после загрузки шаг начинается заново), S — описание шага из сценария

// кооп: строка у всех одна (s.k); листается, когда «Дальше» нажали все игроки (s.rd — их ники), или сама через CAMP_COOP_LINE
function campTalkTick(s, n, dt) {
  s.k = s.k || 0; s.lt = (s.lt || 0) + dt; s.rd = s.rd || {};
  let voted = 0;
  for (const nick in s.rd) if (coop.players.has(nick)) voted++;
  if (coop.players.size && (voted >= coop.players.size || s.lt >= CAMP_COOP_LINE)) {
    if (voted >= coop.players.size) CampSrv.byVote++; else CampSrv.byTime++;    // для тестов: строки голосами или по времени
    s.k++; s.lt = 0; s.rd = {};
    if (s.k >= n) s.done = true;
  }
  return s.done;
}

const CAMP_STEP = {
  say: {
    init(C, s, S) { s.t = 0; s.done = false; if (S.fx) S.fx(C); },
    tick(C, s, S, dt) { s.t += dt; if (campSrv()) return campTalkTick(s, S.lines.length, dt); return s.done || (!campHasUI() && s.t >= S.lines.length * CAMP_LINE_T); },
  },
  cut: {
    init(C, s, S) { s.t = 0; s.done = false; if (S.fx) S.fx(C); },
    tick(C, s, S, dt) {
      s.t += dt;
      if (S.during) S.during(C, s, dt);
      if (campSrv()) return campTalkTick(s, S.lines.length, dt) && s.t >= (S.min || 0);
      return (s.done || (!campHasUI() && s.t >= Math.max(S.lines.length * CAMP_LINE_T, S.min || 0))) && s.t >= (S.min || 0);
    },
  },
  goal: {
    init(C, s, S) { s.got = {}; s.tk = 9; if (S.init) S.init(C, s); campGoalEval(C, s, S); },
    tick(C, s, S, dt) {
      if (S.during) S.during(C, s, dt);
      s.tk += dt;
      if (s.tk < 0.5) return false;
      s.tk = 0;
      const all = campGoalEval(C, s, S);
      // or — шаг кончается и без всех целей (например, вышло время); невыполненное запоминается в flags.missed
      if (!all && S.or && S.or(C, s)) { C.flags.missed = (C.flags.missed || []).concat(C.objs.filter(o => o.cur < o.need).map(o => o.t)); return true; }
      return all;
    },
  },
  wait: {
    init(C, s) { s.t = 0; },
    tick(C, s, S, dt) { s.t += dt; if (S.during) S.during(C, s, dt); return S.until ? !!S.until(C, s) : s.t >= (S.sec || 0); },
  },
  do: { init(C, s, S) { S.fn(C); }, tick() { return true; } },
  // выбор (дилемма): вопрос и варианты; выбранный вариант применяет fx и показывает итог. Без интерфейса — вариант def
  choice: {
    init(C, s) { s.pick = -1; s.done = false; },
    tick(C, s, S, dt) {
      // кооп: выбирает хост (команда campaign/pick); молчит CAMP_COOP_PICK с — вариант по умолчанию. Итог висит, пока все не прочли
      if (campSrv()) {
        s.wt = (s.wt || 0) + dt;
        if (s.pick < 0 && s.wt >= CAMP_COOP_PICK) campChoose(C, Math.max(0, S.opts.findIndex(o => o.def)));
        if (s.pick >= 0) {
          s.ot = (s.ot || 0) + dt; s.rd = s.rd || {};
          let voted = 0;
          for (const nick in s.rd) if (coop.players.has(nick)) voted++;
          if (s.ot >= CAMP_COOP_OUT || (coop.players.size && voted >= coop.players.size)) s.done = true;
        }
        return s.done;
      }
      if (!campHasUI() && s.pick < 0) { const pre = Game.__campPick && Game.__campPick[S.id]; campChoose(C, pre != null ? pre : Math.max(0, S.opts.findIndex(o => o.def))); s.done = true; }   // __campPick — ответы тестов
      return s.done;
    },
  },
  check: {
    init(C) {
      C.cp = C.i; C.cpN = (C.cpN || 0) + 1;
      if (campSrv()) { CampSrv.cp = JSON.stringify(serializeGame()); CampSrv.cpN++; return; }   // сервер пишет её в файл (server.js)
      if (campHasUI() && typeof saveGame === 'function') setTimeout(() => { if (Game.camp === C) { saveGame(CAMP_CP); saveGame(CAMP_SLOT); } }, 0);
    },
    tick() { return true; },
  },
  end: { init(C, s, S) { campFinish(C, 'win', S.why || ''); }, tick() { return false; } },
};

// цели шага: { t, need, cur(C) } — счётчик; { t, zone:[x,y,r] } — герою дойти; выполненное запоминается
function campGoalEval(C, s, S) {
  const out = [];
  let all = true;
  for (const o of S.objs) {
    let cur, need = o.need || 1;
    const zone = typeof o.zone === 'function' ? o.zone(C) : o.zone;
    if (s.got[o.id || o.t]) cur = need;
    else if (zone) cur = campHeroes().some(h => campIn(h, zone)) ? 1 : 0;
    else cur = Math.max(0, Math.min(need, o.cur(C, s) | 0));
    if (cur >= need) s.got[o.id || o.t] = 1;
    else all = false;
    out.push({ t: o.t, cur, need, z: zone || (typeof o.at === 'function' ? o.at(C) : o.at) || null, put: o.put || null, opt: !!o.opt });
  }
  C.objs = out;
  C.hint = S.hint || '';
  return all;
}

function campChoose(C, i) {
  const S = campStepNow(C), s = C.st;
  if (!S || S.k !== 'choice' || s.pick >= 0) return;
  const o = S.opts[i];
  if (!o) return;
  s.pick = i;
  (C.flags.choices || (C.flags.choices = {}))[S.id] = i;
  if (o.fx) o.fx(C);
  if (typeof logEvent === 'function') logEvent('gossip', `${S.t}: ${o.t}`);
}

function campStepNow(C) { const A = CAMP_ACTS[C.act]; return A && A.steps[C.i] || null; }

function campEnter(C, i) {
  const A = CAMP_ACTS[C.act];
  C.i = i;
  C.seq = (C.seq || 0) + 1;              // интерфейс по нему узнаёт новый шаг
  C.objs = null; C.hint = ''; C.mark = null;
  const S = A.steps[i];
  C.st = {};
  if (!S) return;
  if (S.when && !S.when(C)) { C.st.skip = 1; return; }       // шаг не для этой ветки сюжета
  if (S.mark) C.mark = S.mark;
  if (S.label) C.label = S.label;
  CAMP_STEP[S.k].init(C, C.st, S);
}

function campTick(dt) {
  const C = Game.camp;
  if (!C || C.over) return;
  const A = CAMP_ACTS[C.act];
  if (!A) return;
  C.t += dt;
  if (!C.st) campEnter(C, C.i < 0 ? 0 : C.i);
  if (A.tick) A.tick(C, dt);
  if (C.flags.march && (C.mt = (C.mt || 0) + dt) >= 0.5) { C.mt = 0; campMarchTick(); }
  C.ft = (C.ft || 0) + dt;
  if (C.ft >= 1 && A.fail) {
    C.ft = 0;
    const why = A.fail(C);
    if (why) { campFinish(C, 'lose', why); return; }
  }
  for (let guard = 0; guard < 8 && !C.over; guard++) {
    const S = campStepNow(C);
    if (!S) { campFinish(C, 'win', ''); return; }
    if (!C.st.skip && !CAMP_STEP[S.k].tick(C, C.st, S, dt)) break;
    if (S.after && !C.st.skip) S.after(C);
    campEnter(C, C.i + 1);
    dt = 0;
  }
}

// итог акта: победа пишет прогресс и наследие, поражение — только экран
function campFinish(C, res, why) {
  if (C.over) return;
  const A = CAMP_ACTS[C.act];
  const stats = { t: Math.round(C.t), alive: campPeople(), lost: C.lost || 0 };
  let stars = 0;
  if (res === 'win') {
    stars = A.stars ? A.stars(C, stats) : 1;
    const p = campProg(), old = p.done[C.act];
    p.done[C.act] = { t: Date.now(), time: stats.t, stars: Math.max(stars, old ? old.stars : 0), alive: stats.alive };
    if (A.legacy) p.legacy = Object.assign(p.legacy || {}, A.legacy(C, stats));
    p.last = C.act;
    const hl = campHeroLook(campHero() || Game.hero); if (hl) p.hero = hl;   // погиб под конец — облик всё равно его
    campProgSave(p);
    if (typeof track === 'function') track('camp-win-' + C.act, 'Кампания: пройден акт ' + C.act);
  } else if (typeof track === 'function') track('camp-lose-' + C.act, 'Кампания: поражение в акте ' + C.act);
  C.over = { res, why, stars, stats };
  // кооп: пройденный акт и наследие сервера уходят игрокам — каждый отмечает их в своей одиночной кампании (campMirrorIn)
  if (res === 'win' && campSrv()) { const p = campProg(); C.over.prog = { done: p.done[C.act], legacy: p.legacy }; }
  C.objs = null; C.mark = null;
  if (typeof logEvent === 'function') logEvent('night', res === 'win' ? `Акт ${C.act} «${A.name}» пройден` : `Акт ${C.act}: поражение — ${why}`);
}

// ---------- Запуск акта ----------
// Мир строится по карте акта (формат редактора карт), затем акт расставляет город и жителей.

function campStart(n, opts = {}) {
  const A = CAMP_ACTS[n];
  if (!A) return false;
  if (A.scenario) return A.start(opts);       // акт 5 — обычный сценарий с наследием (act5.js)
  const map = A.map();
  CampBoot.on = true;
  try { setupStart(A.seed, { custom: map }); } finally { CampBoot.on = false; }
  if (typeof releaseStart === 'function') releaseStart();
  for (const b of Game.buildings) b.hold = false;
  if (typeof allUnlocked === 'function') Game.unlocked = allUnlocked();
  if (Game.dz) Game.dz.freq = 0;
  Game.camp = { v: 1, act: n, i: -1, st: null, seq: 0, t: 0, cp: -1, cpN: 0, flags: {}, tilt: 0, lost: 0, over: null, objs: null, mark: null, label: '' };
  A.setup(Game.camp, opts);
  if (campHasUI() && typeof buildTerrain === 'function') { buildTerrain(A.seed); if (typeof updateMinimapBase === 'function') updateMinimapBase(); }
  if (n > 1) campHeroLookApply(campHero(), campProg().hero);
  campEnter(Game.camp, 0);
  if (typeof track === 'function') track('camp-start-' + n, 'Кампания: начат акт ' + n);
  return true;
}

// ---------- Кооп: зеркало сценария ----------
// Сервер шлёт состояние миссии (флаги акта — отдельным ключом campf: меняются редко, а цели и таймер — часто).
// Клиент ничего не считает: показывает цели, реплики, выбор и итог, а нажатия отправляет командой campaign.

function campMirrorOut() {
  const C = Game.camp;
  if (!C) return null;
  const s = C.st || {};
  const st = { k: s.k || 0, done: !!s.done, skip: !!s.skip, rd: Object.keys(s.rd || {}) };
  if (s.pick !== undefined) { st.pick = s.pick; st.left = Math.max(0, Math.ceil(CAMP_COOP_PICK - (s.wt || 0))); }
  return JSON.parse(JSON.stringify({ act: C.act, i: C.i, seq: C.seq, t: Math.round(C.t), objs: C.objs, hint: C.hint, label: C.label, mark: C.mark,
    tilt: Math.round((C.tilt || 0) * 1000) / 1000, vfx: C.vfx || null, timer: C.timer || null, meter: C.meter || null, over: C.over, cpN: C.cpN || 0, st, np: coop.players.size }));
}

function campMirrorIn(m, f, prog) {
  if (prog !== undefined) CampUI.cprog = prog;
  if (!m) { if (Game.camp) Game.camp = null; return; }
  if (!Game.camp || Game.camp.act !== m.act) Game.camp = { flags: {}, st: {} };
  const C = Game.camp;
  Object.assign(C, m);
  if (f) C.flags = f;
  // кооп-деревня открывает меню постепенно, а в акте нужны башни и всё остальное сразу (на сервере открыто всё)
  if (typeof unlockAll === 'function' && !CampUI.unlocked) { CampUI.unlocked = 1; unlockAll(); }
  // пройденный в отряде акт — и в своей одиночной кампании (наследие — серверное)
  const pr = C.over && C.over.prog;
  if (pr && pr.done && CampUI.recorded !== C.act + ':' + pr.done.t) {
    CampUI.recorded = C.act + ':' + pr.done.t;
    const p = campProg(), old = p.done[C.act];
    p.done[C.act] = Object.assign({}, pr.done, { stars: Math.max(pr.done.stars || 1, old ? old.stars : 0), coop: 1 });
    p.legacy = Object.assign(p.legacy || {}, pr.legacy || {});
    p.last = C.act;
    campProgSave(p);
  }
}

// сообщения сценария от сервера: звук (рожок, взрыв, обвал) и крупные вспышки
function campCoopMsg(m) {
  if (m.a === 'snd' && typeof campSnd === 'function') campSnd(m.k, m.x, m.y, m.v);
  else if (m.a === 'fx' && Array.isArray(m.p) && typeof fxBurst === 'function') fxBurst(...m.p);
}

// ---------- Подключение к игре ----------

{
  const _step = step;
  // кооп-клиент без связи (сервер перезапускается) — по-прежнему зеркало: своё состояние шага не полное, считать сценарий нельзя
  step = function (dt) { _step(dt); if (Game.camp && !(typeof isMirror === 'function' && isMirror()) && !campMir()) campTick(dt); };
  const _reset = resetGameState;
  resetGameState = function () { _reset(); Game.camp = null; };
  const _ser = serializeGame;
  serializeGame = function () {
    const s = _ser(), C = Game.camp;
    if (C) s.camp = { v: 1, act: C.act, i: C.i, t: Math.round(C.t), cp: C.cp, cpN: C.cpN, flags: C.flags, tilt: C.tilt, lost: C.lost, over: C.over, label: C.label, timer: C.timer || null, meter: C.meter || null };
    return s;
  };
  const _apply = applySave;
  applySave = function (s) {
    CampBoot.on = !!(s && s.camp);
    try { _apply(s); } finally { CampBoot.on = false; }
    Game.camp = null;
    const o = s && s.camp;
    if (!o || !CAMP_ACTS[o.act]) return;
    const C = Game.camp = { v: 1, act: o.act, i: Math.max(0, o.i | 0), st: null, seq: 0, t: o.t || 0, cp: o.cp ?? -1, cpN: o.cpN || 0, flags: o.flags || {}, tilt: o.tilt || 0, lost: o.lost || 0, over: o.over || null, objs: null, mark: null, label: o.label || '', timer: o.timer || null, meter: o.meter || null };
    const A = CAMP_ACTS[o.act];
    if (A.onLoad) A.onLoad(C);
    // колонна на марше: пометки u.march в сейв юнитов не попадают, флаг — попадает; без этого после загрузки (контрольная точка,
    // перезапуск кооп-сервера) шаг «Дойти до стоянки» ждал вечно, а гномы стояли
    if (C.flags.march) { const [mx, my, ms] = C.flags.march; campMarch(Game.units.filter(u => !u.dead && isPerson(u) && u.type !== 'hero' && u.type !== 'carter'), mx, my, ms); }
    if (Game.dz) Game.dz.freq = 0;
  };
  // Малгор в кампании не живёт: заглушка за краем карты, гнев не растёт (гоблины кампании — налётчики enemy.js)
  if (typeof foeInit === 'function') {
    const _fi = foeInit;
    foeInit = function (seed) {
      if (!CampBoot.on) return _fi(seed);
      Game.raiders = []; Game.foeShots = [];
      Game.foe = { camp: 1, tx: -999, ty: -999, wrath: 0, stage: 0, nights: 0, kills: 0, known: false, defeated: false, ni: -1, plan: [], fires: [], bossHp: 1, marked: true, stat: { ravens: 0, raids: 0, loot: 0, hurt: 0, curses: 0 } };
    };
    const _fe = foeEvening;
    foeEvening = function (F, ni) { if (F && F.camp) { F.nights++; return; } _fe(F, ni); };
    const _sb = foeSpawnBoss;
    foeSpawnBoss = function (F) { if (F && F.camp) return; _sb(F); };
    const _ser2 = serializeGame;
    serializeGame = function () { const s = _ser2(); if (Game.foe && Game.foe.camp && s.fo) s.fo.camp = 1; return s; };
    const _ap2 = applySave;
    applySave = function (s) { _ap2(s); if (s && s.camp && Game.foe && !Game.foe.camp) { Game.foe.camp = 1; Game.foe.defeated = false; Game.foe.stage = 0; Game.foe.boss = null; Game.raiders = []; } };
  }
  // чужие здания кампании (b.foreign — соседская деревня): стоят как декорация — без значков-проблем, грузов и работников
  if (typeof Building === 'function') {
    const P = Building.prototype, _pr = P.problem, _de = P.demand, _of = P.offer;
    P.problem = function () { return this.foreign ? null : _pr.call(this); };
    P.demand = function (g) { return this.foreign ? 0 : _de.call(this, g); };
    P.offer = function (g) { return this.foreign ? 0 : _of.call(this, g); };
  }
  // что в кампании выключено
  if (typeof goalTick === 'function') { const _g = goalTick; goalTick = function (dt) { if (!Game.camp) _g(dt); }; }
  if (typeof goalUiTick === 'function') { const _gu = goalUiTick; goalUiTick = function (f) { if (!Game.camp) _gu(f); else { const h = document.getElementById('goal-hud'); if (h) h.classList.add('hidden'); } }; }
  if (typeof dilTick === 'function') { const _d = dilTick; dilTick = function (dt) { if (!Game.camp) _d(dt); }; }
  if (typeof loreTick === 'function') { const _l = loreTick; loreTick = function (dt) { if (!Game.camp) _l(dt); }; }
  // случайных праздников в кампании нет — только сценарные (festivalForce в актах)
  if (typeof festivalTick === 'function') { const _ft = festivalTick; festivalTick = function (dt) { if (Game.camp && !Game.festival) return; _ft(dt); }; }
  if (typeof tutStart === 'function') { const _t = tutStart; tutStart = function (m) { if (!Game.camp) _t(m); }; }
  // мир акта собран вручную: курганы, новые логова по ночам, бродячие народы и путники в сюжет не вмешиваются
  for (const fn of ['raidTick', 'fwTick', 'ftTick', 'tvTick', 'lepTick', 'wgTick']) {
    if (typeof globalThis[fn] !== 'function') continue;
    const _f = globalThis[fn];
    globalThis[fn] = function (dt) { if (!Game.camp) return _f(dt); };
  }
  if (typeof n2Night === 'function') { const _n = n2Night; n2Night = function (n) { if (!Game.camp) return _n(n); }; }
}

// ---------- Интерфейс: диалоги, полосы катсцены, цели, итог ----------

const CampUI = { seq: -1, k: 0, idle: 0, el: null, hud: null, sig: '', end: null, cam: null, wasPaused: false, lastNow: 0 };
const campEsc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function campEls() {
  if (CampUI.el) return CampUI.el;
  const view = document.getElementById('view') || document.body;
  const mk = (id, cls, html) => { const d = document.createElement('div'); d.id = id; if (cls) d.className = cls; d.innerHTML = html || ''; view.appendChild(d); return d; };
  CampUI.el = {
    bars: mk('camp-bars', 'hidden', '<i class="t"></i><i class="b"></i>'),
    flash: mk('camp-flash', ''),
    dlg: mk('camp-dlg', 'hidden', '<div class="cd-face"></div><div class="cd-body"><div class="cd-who"></div><div class="cd-text"></div><div class="cd-btns"><button data-camp="skip" class="ghost">Пропустить</button><button data-camp="next">Дальше ▸</button></div></div>'),
    hud: mk('camp-hud', 'hidden', ''),
    end: mk('camp-end', 'hidden', ''),
  };
  view.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-camp]');
    if (b) { e.stopPropagation(); campUiAct(b.dataset.camp, b); }
  }, true);
  document.addEventListener('keydown', e => {
    if (!(Game.camp || campTalkOn()) || CampUI.el.dlg.classList.contains('hidden')) return;
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); campUiAct('next'); }
    else if (e.code === 'Escape') campUiAct('skip');
  });
  return CampUI.el;
}

function campUiAct(a, btn) {
  const C = Game.camp;
  if (a === 'cstart') { campCoopStartAsk(+btn.dataset.n); return; }
  if (a === 'cclose') { campHideEnd(); return; }
  if (campMir() && C && campCoopAct(C, a, btn)) return;
  if ((a === 'next' || a === 'skip') && !C && campTalkOn()) {
    if (a === 'skip') CampUI.talk.length = 0; else CampUI.talk.shift();
    CampUI.talkCur = null; CampUI.idle = 0;
    if (!CampUI.talk.length) campHideDlg();
    return;
  }
  if (a === 'next' || a === 'skip') {
    const S = C && campStepNow(C);
    if (!S || (S.k !== 'say' && S.k !== 'cut')) return;
    CampUI.idle = 0;
    if (a === 'next' && CampUI.k < S.lines.length - 1) { CampUI.k++; campRenderDlg(C, S); return; }
    C.st.done = true;
    campHideDlg();
  } else if (a === 'pick') {
    if (C) campChoose(C, +btn.dataset.i);
  } else if (a === 'picked') {
    if (C && C.st) C.st.done = true;
    campRestoreBtns(); campHideDlg();
  } else if (a === 'show') {
    const z = btn && btn.dataset.z && btn.dataset.z.split(',').map(Number);
    if (z && typeof centerOn === 'function') centerOn((z[0] + 0.5) * TILE, (z[1] + 0.5) * TILE);
  } else if (a === 'retry-cp') {
    campHideEnd();
    if (!(typeof loadGame === 'function' && loadGame(CAMP_CP))) campRestart();
    else if (typeof updateUI === 'function') updateUI(true);
  } else if (a === 'retry') {
    campHideEnd(); campRestart();
  } else if (a === 'next-act') {
    campHideEnd(); const n = C ? C.act + 1 : 1;
    if (CAMP_ACTS[n]) { campStart(n); Game.paused = false; updateUI(true); }
  } else if (a === 'menu') {
    campHideEnd(); Game.paused = false;
    if (typeof campToMenu === 'function') campToMenu();
  } else if (a === 'stay') {
    campHideEnd(); Game.paused = false;
  }
}

function campRestoreBtns() {
  const bt = campEls().dlg.querySelector('.cd-btns');
  bt.classList.remove('choice');
  bt.innerHTML = '<button data-camp="skip" class="ghost">Пропустить</button><button data-camp="next">Дальше ▸</button>';
  CampUI.choiceKey = '';
}

// ---------- Кооп: кнопки клиента уходят на сервер ----------

// true — нажатие обработано здесь (на сервер ушла команда campaign)
function campCoopAct(C, a, btn) {
  const send = o => coopSend(Object.assign({ t: 'campaign', seq: C.seq }, o));
  if (a === 'next') { send({ a: 'next', k: CampUI.k }); CampUI.voted = C.seq + ':' + CampUI.k; CampUI.voteSig = ''; campCoopBtns(C, campStepNow(C)); return true; }
  if (a === 'skip') { if (Coop.host) send({ a: 'skip' }); return true; }
  if (a === 'pick') { if (Coop.host && C.st.pick < 0) send({ a: 'pick', i: +btn.dataset.i }); return true; }
  if (a === 'picked') { send({ a: 'next' }); campRestoreBtns(); campHideDlg(); return true; }
  if (a === 'retry-cp') { campHideEnd(); coopSend({ t: 'campaign', a: 'cp' }); return true; }
  if (a === 'retry') { campHideEnd(); coopSend({ t: 'campaign', a: 'start', n: C.act }); return true; }
  if (a === 'next-act') { campHideEnd(); coopSend({ t: 'campaign', a: 'start', n: C.act + 1 }); return true; }
  if (a === 'menu') { if (confirm('Выйти из общей деревни в меню?')) location.reload(); return true; }
  if (a === 'stay') { campHideEnd(); return true; }
  return false;
}

// «Дальше» в коопе — голос: сколько уже нажали, нажал ли я; «Пропустить» — только у хоста
function campCoopBtns(C, S) {
  if (!S || !C.st) return;
  const E = campEls(), nx = E.dlg.querySelector('[data-camp="next"]'), sk = E.dlg.querySelector('[data-camp="skip"]');
  if (!nx) return;
  const n = Math.max(1, C.np || 1), v = Math.min(n, (C.st.rd || []).length), mine = CampUI.voted === C.seq + ':' + CampUI.k;
  const sig = [C.seq, CampUI.k, v, n, mine, Coop.host].join('|');
  if (sig === CampUI.voteSig) return;
  CampUI.voteSig = sig;
  const last = CampUI.k >= S.lines.length - 1;
  nx.textContent = (mine ? '✔ ' : '') + (last ? 'Закрыть' : 'Дальше') + (n > 1 ? ` ${v}/${n}` : '') + ' ▸';
  nx.title = n > 1 ? 'Строка листается, когда нажмут все (или сама через несколько секунд)' : '';
  if (sk) sk.classList.toggle('hidden', !Coop.host);
}

// меню хоста «Кампания»: акты по прогрессу сервера
function campCoopMenu() {
  const E = campEls(), pr = CampUI.cprog || { done: {} }, C = Game.camp;
  const open = n => n === 1 || !!pr.done[n - 1];
  let h = '<div class="ce-box"><div class="ce-act">Кооп</div><h2>Кампания «Исход из Подгорья»</h2><p class="ce-leg">Вся деревня переходит в мир акта. Герои сохраняют уровень и рюкзак. Нынешний мир сервера уйдёт в архив.</p><div class="ce-btns">';
  for (let n = 1; n <= 5; n++) {
    const A = CAMP_ACTS[n];
    if (!A) continue;
    const st = pr.done[n] ? ' ' + '★'.repeat(pr.done[n]) : '';
    h += open(n) ? `<button data-camp="cstart" data-n="${n}">Акт ${n}. ${campEsc(A.name)}${st}</button>` : `<button disabled>🔒 Акт ${n}: пройдите акт ${n - 1}</button>`;
  }
  if (C && !C.over && C.cpN) h += '<button data-camp="retry-cp">С контрольной точки</button>';
  h += '<button class="ghost" data-camp="cclose">Закрыть</button></div></div>';
  E.end.innerHTML = h;
  E.end.classList.remove('hidden');
  CampUI.end = null;
}
function campCoopStartAsk(n) {
  if (!confirm(`Начать акт ${n} «${CAMP_ACTS[n].name}» для всей деревни? Нынешний мир сервера сменится миром акта.`)) return;
  campHideEnd();
  coopSend({ t: 'campaign', a: 'start', n });
}

function campRestart() {
  const n = Game.camp ? Game.camp.act : 1;
  campStart(n);
  if (typeof updateMinimapBase === 'function') updateMinimapBase();
  if (typeof updateUI === 'function') updateUI(true);
}

// портрет собеседника (js/campaign/faces.js): два кадра, второй (моргание) поверх по CSS; без портрета — буква в круге
function campFace(w, who) {
  const a = typeof campFaceUrl === 'function' ? campFaceUrl(who, 0) : '';
  if (!a) return `<span class="cd-ch" style="color:${w.col};background:${w.bg}">${campEsc(w.ch)}</span>`;
  return `<span class="cd-pt" style="border-color:${w.col};background-color:${w.bg}"><img src="${a}" alt=""><img class="cd-blink" src="${campFaceUrl(who, 1)}" alt="" style="animation-delay:-${(Math.random() * 4).toFixed(1)}s"></span>`;
}
// портрет меняется только при смене собеседника — иначе моргание сбивалось бы на каждой реплике
function campSetFace(E, w, who) {
  const el = E.dlg.querySelector('.cd-face');
  if (el.dataset.who === who) return;
  el.dataset.who = who;
  el.innerHTML = campFace(w, who);
}

function campRenderDlg(C, S) {
  const [who, text] = S.lines[CampUI.k] || ['note', ''];
  campRenderLine(who, text, CampUI.k < S.lines.length - 1, S.k === 'cut');
  if (campMir()) { CampUI.voteSig = ''; campCoopBtns(C, S); }
}
function campRenderLine(who, text, more, cut) {
  const E = campEls(), w = CAMP_WHO[who] || CAMP_WHO.note;
  const name = who === 'hero' && campHero() ? campHero().hero.name || w.name : w.name;
  const fem = who === 'hero' && typeof haOf === 'function' && (haOf(campHero()) || [])[10] === 1;
  campSetFace(E, w, fem ? 'heroF' : CAMP_WHO[who] ? who : 'note');
  E.dlg.querySelector('.cd-who').textContent = name;
  E.dlg.querySelector('.cd-who').style.color = w.col;
  const tx = E.dlg.querySelector('.cd-text');
  tx.textContent = text;
  tx.classList.remove('in'); void tx.offsetWidth; tx.classList.add('in');
  if (!E.dlg.querySelector('[data-camp="next"]')) campRestoreBtns();
  E.dlg.querySelector('[data-camp="next"]').textContent = more ? 'Дальше ▸' : 'Закрыть ▸';
  E.dlg.classList.toggle('cut', !!cut);
  E.dlg.classList.remove('hidden');
}
// окно выбора: вопрос, варианты кнопками; после выбора — чем кончилось, и «Дальше»
function campRenderChoice(C, S) {
  const E = campEls(), s = C.st, key = C.seq + ':' + s.pick;
  if (CampUI.choiceKey === key) return;
  CampUI.choiceKey = key;
  CampUI.seq = C.seq;
  const w = CAMP_WHO[S.who] || CAMP_WHO.note;
  campSetFace(E, w, CAMP_WHO[S.who] ? S.who : 'note');
  E.dlg.querySelector('.cd-who').textContent = S.t;
  E.dlg.querySelector('.cd-who').style.color = w.col;
  const tx = E.dlg.querySelector('.cd-text'), bt = E.dlg.querySelector('.cd-btns');
  if (s.pick < 0) {
    tx.textContent = S.text;
    const wait = campMir() && !Coop.host;   // кооп: решает хост, остальные видят варианты
    bt.innerHTML = S.opts.map((o, i) => `<button data-camp="pick" data-i="${i}"${wait ? ' disabled' : ''}>${campEsc(o.t)}</button>`).join('') + (wait ? '<div class="cd-coop">Решает хост</div>' : '');
    bt.classList.add('choice');
    if (!Game.paused && !campMir()) { CampUI.wasPaused = true; Game.paused = true; }
  } else {
    tx.textContent = S.opts[s.pick].out || '';
    bt.innerHTML = '<button data-camp="picked">Дальше ▸</button>';
    bt.classList.remove('choice');
  }
  tx.classList.remove('in'); void tx.offsetWidth; tx.classList.add('in');
  E.dlg.classList.remove('cut');
  E.dlg.classList.remove('hidden');
}

function campHideDlg() {
  const E = campEls();
  E.dlg.classList.add('hidden');
  E.bars.classList.add('hidden');
  CampUI.cam = null;
  if (CampUI.wasPaused) { CampUI.wasPaused = false; Game.paused = false; }
}

function campBlocked() {
  return (typeof StartMenu !== 'undefined' && StartMenu.open) || !!document.getElementById('hero-name');
}

function campHudRender(C) {
  const E = campEls(), A = CAMP_ACTS[C.act];
  if (!C.objs || C.over) { E.hud.classList.add('hidden'); CampUI.sig = ''; return; }
  const sig = C.seq + '|' + C.objs.map(o => o.cur + '/' + o.need).join(',') + '|' + C.label + '|' + (C.timer ? Math.floor(C.timer.t - Game.time) : '') + '|' + (C.meter ? C.flags[C.meter.key] : '');
  if (sig === CampUI.sig) return;
  CampUI.sig = sig;
  let h = `<div class="cmh-act">Акт ${C.act}. ${campEsc(A.name)}</div>`;
  if (C.label) h += `<div class="cmh-step">${campEsc(C.label)}</div>`;
  h += '<ul>';
  for (const o of C.objs) {
    const ok = o.cur >= o.need;
    h += `<li class="${ok ? 'ok' : ''}${o.opt ? ' opt' : ''}"><span class="cmh-box">${ok ? '✔' : ''}</span><span class="cmh-t">${campEsc(o.t)}</span>`;
    if (o.need > 1) h += `<span class="cmh-n">${o.cur}/${o.need}</span>`;
    if (o.z && !ok) h += `<button class="ghost cmh-show" data-camp="show" data-z="${o.z[0]},${o.z[1]}" title="Показать на карте">◎</button>`;
    h += '</li>';
  }
  h += '</ul>';
  if (C.meter) { const v = C.flags[C.meter.key] || 0; h += `<div class="cmh-meter">${campEsc(C.meter.label)}: <b class="${v > 0 ? 'up' : v < 0 ? 'down' : ''}">${v > 0 ? '+' : ''}${v}</b></div>`; }
  if (C.timer) { const left = Math.max(0, C.timer.t - Game.time); h += `<div class="cmh-timer">${campEsc(C.timer.label)}: ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}</div>`; }
  if (C.hint) h += `<div class="cmh-hint">${campEsc(C.hint)}</div>`;
  E.hud.innerHTML = h;
  E.hud.classList.remove('hidden');
}

function campShowEnd(C) {
  const E = campEls(), A = CAMP_ACTS[C.act], o = C.over, win = o.res === 'win';
  const m = Math.floor(o.stats.t / 60);
  const nextOk = win && CAMP_ACTS[C.act + 1];
  let h = `<div class="ce-box ${win ? 'win' : 'lose'}"><div class="ce-act">Акт ${C.act}</div><h2>${win ? campEsc(A.name) + ': пройдено' : 'Поражение'}</h2>`;
  if (win) h += `<div class="ce-stars">${'★'.repeat(o.stars)}${'☆'.repeat(3 - o.stars)}</div>`;
  else h += `<p class="ce-why">${campEsc(o.why)}</p>`;
  if (win && A.outro) h += `<p class="ce-outro">${campEsc(A.outro)}</p>`;
  h += `<ul class="ce-stats"><li>Время: ${m} мин</li><li>Жителей спасено: ${o.stats.alive}</li><li>Потеряно: ${o.stats.lost}</li></ul>`;
  if (win && A.legacyText) h += `<p class="ce-leg">Наследие: ${campEsc(A.legacyText(C))}</p>`;
  h += '<div class="ce-btns">';
  if (campMir() && !Coop.host) {
    h += '<p class="ce-leg">Что дальше — решает хост.</p><button data-camp="stay">Остаться в мире</button>';
  } else if (win) {
    h += nextOk ? `<button data-camp="next-act">Акт ${C.act + 1}: ${campEsc(CAMP_ACTS[C.act + 1].name)} ▸</button>` : `<button disabled>Акт ${C.act + 1} — скоро</button>`;
    if (nextOk && CAMP_ACTS[C.act + 1].scenario) h += '<p class="ce-leg">Дальше — сценарий на новой карте Долины: главы 1–6, Чёрный шпиль. Наследие кампании переходит с вами.</p>';
    h += '<button class="ghost" data-camp="stay">Остаться в мире</button>';
  } else {
    if (C.cpN) h += '<button data-camp="retry-cp">С контрольной точки</button>';
    h += '<button data-camp="retry">Акт с начала</button>';
  }
  h += '<button class="ghost" data-camp="menu">В меню</button></div></div>';
  E.end.innerHTML = h;
  E.end.classList.remove('hidden');
  if (!campMir()) Game.paused = true;
}
function campHideEnd() { const E = campEls(); E.end.classList.add('hidden'); CampUI.end = null; }

function campUiTick() {
  if (!campHasUI()) return;
  const C = Game.camp;
  const E = campEls();
  if (!C) {
    if (!E.hud.classList.contains('hidden')) E.hud.classList.add('hidden');
    if (campTalkOn()) { if (!campBlocked()) campTalkUiTick(); return; }
    if (!E.dlg.classList.contains('hidden')) campHideDlg();
    return;
  }
  if (C.over) {
    if (CampUI.end !== C.over) { CampUI.end = C.over; campHideDlg(); campHudRender(C); campShowEnd(C); }
    return;
  }
  campHudRender(C);
  const S = campStepNow(C);
  if (S && S.k === 'choice' && !C.st.done && !C.st.skip && C.st.pick !== undefined) { if (!campBlocked()) campRenderChoice(C, S); return; }
  const talk = S && (S.k === 'say' || S.k === 'cut') && !C.st.done && !C.st.skip;
  if (!talk) { if (!E.dlg.classList.contains('hidden')) campHideDlg(); CampUI.seq = C.seq; return; }
  if (campBlocked()) return;
  const now = performance.now(), dt = Math.min(1, (now - (CampUI.lastNow || now)) / 1000);
  CampUI.lastNow = now;
  if (CampUI.seq !== C.seq) {
    CampUI.seq = C.seq; CampUI.k = campMir() ? Math.min(C.st.k || 0, S.lines.length - 1) : 0; CampUI.idle = 0;
    if (S.k === 'cut') {
      E.bars.classList.remove('hidden');
      CampUI.cam = S.cam ? { x: (S.cam[0] + 0.5) * TILE, y: (S.cam[1] + 0.5) * TILE } : null;
      if (S.pause && !Game.paused && !campMir()) { CampUI.wasPaused = true; Game.paused = true; }
    }
    campRenderDlg(C, S);
    return;
  }
  // кооп: строку листает сервер (голоса всех или время) — догоняем его номер строки
  if (campMir()) {
    const k = Math.min(C.st.k || 0, S.lines.length - 1);
    if (k !== CampUI.k) { CampUI.k = k; campRenderDlg(C, S); } else campCoopBtns(C, S);
    return;
  }
  CampUI.idle += dt;
  if (CampUI.idle >= CAMP_IDLE) campUiAct('next');
}

// реплики вне акта (сценарий с наследием кампании, акт 5): очередь [[кто, текст]…], игру не останавливают, листаются сами
const campTalkOn = () => !!(CampUI.talk && CampUI.talk.length);
function campTalk(lines) {
  if (!campHasUI() || !lines || !lines.length) return;
  (CampUI.talk || (CampUI.talk = [])).push(...lines);
}
function campTalkUiTick() {
  const now = performance.now(), dt = Math.min(1, (now - (CampUI.lastNow || now)) / 1000), L = CampUI.talk[0];
  CampUI.lastNow = now;
  if (CampUI.talkCur !== L) { CampUI.talkCur = L; CampUI.idle = 0; campRenderLine(L[0], L[1], CampUI.talk.length > 1, false); return; }
  CampUI.idle += dt;
  if (CampUI.idle >= CAMP_IDLE) campUiAct('next');
}

// камера катсцены плавно едет к цели; тряска и вспышка взрыва
{
  if (typeof render === 'function') {
    const _r = render;
    render = function () {
      const C = Game.camp;
      if (!C || typeof R === 'undefined' || !R.cam) { _r(); return; }
      if (CampUI.cam && typeof viewSize === 'function') {
        const [vw, vh] = viewSize(), tx = CampUI.cam.x - vw / 2, ty = CampUI.cam.y - vh / 2;
        R.cam.x += (tx - R.cam.x) * 0.06; R.cam.y += (ty - R.cam.y) * 0.06;
        if (typeof clampCam === 'function') clampCam();
      }
      const V = C.vfx, age = V ? Game.time - V.t : 99;
      const s = age < V?.dur ? (1 - age / V.dur) * (V.amp || 8) : 0;
      if (CampUI.el) CampUI.el.flash.style.opacity = age < 0.9 ? String(Math.max(0, 0.85 - age)) : '0';
      if (!s) { _r(); return; }
      const ox = Math.round((Math.random() - 0.5) * 2 * s), oy = Math.round((Math.random() - 0.5) * 2 * s);
      R.cam.x += ox; R.cam.y += oy;
      try { _r(); } finally { R.cam.x -= ox; R.cam.y -= oy; }
    };
  }
  if (typeof updateUI === 'function') {
    const _uu = updateUI;
    updateUI = function (f) { _uu(f); try { campUiTick(); } catch (e) { if (!campUiTick.err) { campUiTick.err = 1; console.error(e); } } };
  }
  // крен горы: массивы севернее линии крена наклоняются вокруг подножия
  if (typeof drawMountain === 'function') {
    const _dm = drawMountain;
    drawMountain = function (c, m) {
      const C = Game.camp, A = campAct();
      if (!C || !C.tilt || !A || !A.tiltY || m.y > A.tiltY * TILE) { _dm(c, m); return; }
      const V = C.vfx, wob = V && Game.time - V.t < V.dur ? Math.sin(Game.time * 40) * 0.015 * (1 - (Game.time - V.t) / V.dur) : 0;
      const k = Math.min(1, (A.tiltY * TILE - m.y) / (A.tiltY * TILE * 0.6) + 0.35);
      c.save();
      c.translate(m.x, m.y);
      c.rotate((C.tilt * k + wob) * (m.x < (A.tiltX || MAP_W / 2) * TILE ? 1 : 0.8));
      c.translate(-m.x, -m.y);
      _dm(c, m);
      c.restore();
    };
  }
  // сцена акта (бочки, вожак на уступе, метки зон) — в общий список отрисовки по глубине
  if (typeof drawSkeletons === 'function') {
    const _ds = drawSkeletons;
    drawSkeletons = function (list, c, x0, y0, x1, y1) {
      _ds(list, c, x0, y0, x1, y1);
      const C = Game.camp, A = campAct();
      if (!C || !A) return;
      try {
        if (A.draw) A.draw(list, c, x0, y0, x1, y1);
        const z = C.objs && C.objs.find(o => o.z && o.cur < o.need);
        if (z) list.push([z.z[1] - 0.5, () => campDrawZone(c, z.z)]);
        for (const o of C.objs || []) if (o.put && o.cur < o.need) list.push([o.put[1] + o.put[3], () => campDrawPut(c, o.put)]);
      } catch (e) { if (!campDrawZone.err) { campDrawZone.err = 1; console.error(e); } }
    };
  }
}

// место под стройку, которое задание требует точно: рамка по размеру здания с подписью
function campDrawPut(c, p) {
  const t = Game.time, x = p[0] * TILE, y = p[1] * TILE, w = p[2] * TILE, h = p[3] * TILE;
  c.save();
  c.fillStyle = `rgba(255,220,120,${0.14 + Math.sin(t * 4) * 0.06})`;
  c.fillRect(x, y, w, h);
  c.strokeStyle = '#ffd860'; c.lineWidth = 2; c.setLineDash([6, 4]); c.lineDashOffset = -t * 12;
  c.strokeRect(x, y, w, h);
  c.setLineDash([]);
  c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ffd860'; c.strokeStyle = '#3a2a10'; c.lineWidth = 3;
  c.strokeText('Строить здесь', x + w / 2, y - 6); c.fillText('Строить здесь', x + w / 2, y - 6);
  c.restore();
}

function campDrawZone(c, z) {
  const t = Game.time, x = (z[0] + 0.5) * TILE, y = (z[1] + 0.5) * TILE, r = (z[2] || 2) * TILE;
  c.save();
  c.strokeStyle = `rgba(255,220,120,${0.55 + Math.sin(t * 4) * 0.25})`;
  c.lineWidth = 2;
  c.setLineDash([6, 5]); c.lineDashOffset = -t * 12;
  c.beginPath(); c.ellipse(x, y, r, r * 0.55, 0, 0, 7); c.stroke();
  c.setLineDash([]);
  const by = y - 30 - Math.abs(Math.sin(t * 3)) * 8;
  c.fillStyle = '#ffd860'; c.strokeStyle = '#3a2a10'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(x, by + 12); c.lineTo(x - 7, by); c.lineTo(x + 7, by); c.closePath(); c.fill(); c.stroke();
  c.restore();
}

// гоблины кампании рисуются кадрами гоблинов леса (neutralart2.js) и знати гоблинов (goblinart.js, campaign/art.js)
function campDrawGoblin(c, N, art) {
  if (typeof naFrame !== 'function') return;
  let fr;
  if (N.st === 'die') fr = 'd0';
  else if (N.st === 'atk') fr = N.atkT < 0.24 ? 'windup' : N.atkT < 0.4 ? 'strike' : 'recover';
  else if (N.st === 'chase') fr = 'w' + ((Game.time * 11 + N.id) % 8 | 0);
  else fr = 'i' + ((Game.time * 5 + N.id) % 6 | 0);
  if (Game.time - (N.hurtT || -9) < 0.2 && N.st !== 'die') fr = 'hurt';
  const kind = art || (N.k === 'goblinChamp' ? 'goblinChamp' : N.id % 2 ? 'goblinB' : 'goblin');
  const sp = naFrame(kind, fr), sc = kind === 'goblin' || kind === 'goblinB' ? 1.1 : 1;
  c.save(); c.scale(sc, sc); c.drawImage(sp.cv, -sp.ax, -sp.ay); c.restore();
}

// ---------- Сохранения кампании ----------
// 'camp' — свежий сейв кампании (пишется вместе с автосохранением), 'campcp' — последняя контрольная точка.

if (typeof saveGame === 'function') {
  const _sg = saveGame;
  saveGame = function (slot = 'manual') {
    const ok = _sg(slot);
    if (ok && slot === 'auto' && Game.camp && !Game.camp.over) _sg(CAMP_SLOT);
    return ok;
  };
}
if (typeof diffApplyStart === 'function') {
  const _da = diffApplyStart;
  diffApplyStart = function (k) {
    _da(k);
    const A = campAct(), store = Game.buildings.find(b => b.type === 'storehouse' && !b.removed);
    if (A && A.stock && store && !Game.camp.t) { const m = typeof dif === 'function' ? dif().stock || 1 : 1; for (const g in A.stock) store.stock[g] = Math.max(1, Math.round(A.stock[g] * m)); }
  };
}
function campToMenu() {
  if (typeof saveGame === 'function' && Game.camp && !Game.camp.over) saveGame(CAMP_SLOT);
  try { location.reload(); } catch (e) { /* без браузера меню нет */ }
}

// ---------- Стартовое меню: «Кампания» ----------

function campMenuHTML() {
  const p = campProg(), meta = typeof saveMeta === 'function' ? saveMeta(CAMP_SLOT) : null;
  let h = '<div class="sm-title">Кампания «Исход из Подгорья»</div>';
  if (meta) h += `<button class="sm-btn primary" data-sm="camp-cont"><b>Продолжить кампанию</b><small>${new Date(meta.at).toLocaleString().slice(0, 17)}</small></button>`;
  const names = { 1: 'Праздник Первого Камня', 2: 'Гора ложится', 3: 'Гости и рыба', 4: 'Игра не стоит свеч', 5: 'Тишина дороже золота' };
  for (let n = 1; n <= 5; n++) {
    const A = CAMP_ACTS[n], d = p.done[n], open = campIsOpen(n);
    const stars = d ? ' ' + '★'.repeat(d.stars) + '☆'.repeat(3 - d.stars) : '';
    if (!A) h += `<button class="sm-btn camp-act" disabled><b>Акт ${n}. ${open ? names[n] : '???'}</b><small>${open ? 'скоро' : 'закрыт'}</small></button>`;
    else if (!open) h += `<button class="sm-btn camp-act" disabled><b>🔒 Акт ${n}. ???</b><small>пройдите акт ${n - 1}</small></button>`;
    else h += `<button class="sm-btn camp-act${!meta && !d ? ' primary' : ''}" data-sm="camp:${n}"><b>Акт ${n}. ${A.name}${stars}</b><small>${d ? 'переиграть' : 'играть'}</small></button>`;
  }
  h += '<div id="camp-sm-msg" class="sm-msg"></div><button class="sm-btn ghost" data-sm="back"><b>Назад</b></button>';
  return h;
}

function campMenuPlay(n) {
  if (StartMenu.busy || !CAMP_ACTS[n] || !campIsOpen(n)) return;
  const msg = document.getElementById('camp-sm-msg');
  if (msg) msg.textContent = 'Строим Подгорье…';
  StartMenu.busy = true;
  setTimeout(() => {
    try {
      StartMenu.goalMode = CAMP_ACTS[n].goalMode || 'free';
      campStart(n);
      StartMenu.dirty = true;
      if (msg) msg.textContent = '';
      smShow('diff');
    } catch (e) { console.error(e); if (msg) msg.textContent = 'Не вышло построить мир акта'; }
    StartMenu.busy = false;
  }, 30);
}

if (typeof initStartMenu === 'function' && typeof smAction === 'function') {
  const _init = initStartMenu;
  initStartMenu = function () {
    _init();
    const root = document.getElementById('start-menu');
    if (!root || root.querySelector('[data-sm="camp"]')) return;
    const main = root.querySelector('[data-panel="main"]'), nb = main && main.querySelector('[data-sm="new"]');
    if (!nb) return;
    const btn = document.createElement('button');
    btn.className = 'sm-btn'; btn.dataset.sm = 'camp';
    btn.innerHTML = '<b>Кампания</b><small>«Исход из Подгорья»: сюжет по актам</small>';
    main.insertBefore(btn, nb);
    const p = document.createElement('div');
    p.className = 'sm-panel hidden'; p.dataset.panel = 'camp';
    nb.closest('.sm-panel').after(p);
  };
  const _act = smAction;
  smAction = function (a) {
    if (a === 'camp') {
      const p = document.querySelector('#start-menu [data-panel="camp"]');
      if (p) p.innerHTML = campMenuHTML();
      smShow('camp'); return;
    }
    if (a.startsWith('camp:')) { campMenuPlay(+a.slice(5)); return; }
    if (a === 'camp-cont') { smLoadPrepared(CAMP_SLOT, document.querySelector('#start-menu [data-sm="camp-cont"] small')); return; }
    _act(a);
  };
}
