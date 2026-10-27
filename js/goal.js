'use strict';
// Цель игры: вехи «поселение → деревня → город», победа и поражение, экран итога и сюжетный сценарий
// «Тишина дороже золота» (главы, заставки, события). Описание — в СЮЖЕТ.md.
// Состояние — Game.goal (пишется в сохранение, в коопе живёт на сервере и зеркалится клиентам).
// Код подключается обёртками (step, resetGameState, serializeGame, applySave, nightDiff, newGame),
// чтобы не трогать чужие файлы; на кооп-сервере UI не создаётся.
//
// Интерфейс для задачи «Враг» (тёмный маг):
//   Game.foe.defeated === true     — враг (Малгор) побеждён (см. ВРАГ.md; также можно вызвать goalEnemyDefeated('darkMage'));
//   Game.foe существует            — настоящий враг реализован (иначе финал идёт запасным путём: 2 ночи осады);
//   enemyOnChapter(n)              — необязательный хук: глава n началась (5 — маг заметил, 6 — осада);
//   goalFlag(name) / goalSetFlag(name, v) — общие флаги сценария.

const GOAL_FREE_NIGHTS = 10;       // свободная игра: победа — «Город» и столько пережитых ночей
const GOAL_SIEGE_NIGHTS = 2;       // запасной финал без настоящего врага: столько ночей осады
const GOAL_NAME = 'Тишина дороже золота';

const GOAL_RANKS = [
  { id: 'settlement', name: 'Поселение', title: '' },
  {
    id: 'village', name: 'Деревня', title: 'Староста',
    need: { pop: 14, blds: 8, nights: 2, bread: 30 },
    reward: { gold: 40, timber: 30, stone: 30 },
    text: 'Над крышами пошёл дым, а в трактире — слухи. Это уже деревня: тут есть кому жаловаться.',
  },
  {
    id: 'city', name: 'Город', title: 'Градоначальник',
    need: { pop: 30, blds: 18, nights: 6, bread: 100, timber: 50 },
    reward: { gold: 100, timber: 50, stone: 50, bread: 40 },
    text: 'Тридцать гномов, куча зданий и ни одного повода для скромности. Поздравляем: это город.',
  },
];
const GOAL_NEED_NAMES = { pop: 'жители', blds: 'здания', nights: 'пережито ночей', bread: 'хлеб', timber: 'доски' };
const GOAL_GOOD_NAMES = { gold: 'золота', timber: 'досок', stone: 'камня', bread: 'хлеба', beer: 'пива' };

const GOAL_WHO = {
  grum: { name: 'Грум Ворчун', ch: 'Г', col: '#c98a3c', bg: '#3a2a14' },
  mrak: { name: 'Малгор Тёмный', ch: 'М', col: '#9cf06a', bg: '#2a1840' },
  note: { name: '', ch: '✎', col: '#d8c088', bg: '#2a2014' },
};

const GOAL_CHAPTERS = [
  {
    name: 'Приехали',
    intro: [
      ['#', 'Глава 1. Приехали'],
      ['note', 'Повозки скрипнули и встали. Впереди — поляна, лес и ни одной живой души. Если не считать гномов.'],
      ['grum', 'Земля свободна. Подозрительно свободна. Обычно такое бывает, когда её никто не хочет.'],
      ['note', 'Далеко над лесом, на скале, торчит башня. В окнах — ядовито-зелёный свет.'],
      ['grum', 'Это, наверное, маяк. Или сосед. Начнём с дров, а там посмотрим.'],
    ],
    goals: [{ k: 'build', t: 'woodcutter' }, { k: 'build', t: 'quarry' }, { k: 'build', t: 'sawmill' }, { k: 'nights', n: 1 }],
    hint: 'Дом лесоруба, каменоломня, лесопилка — и дожить до утра. Ночью в лесу всё не так просто, как днём.',
    outro: [['mrak', 'Кто-то рубит деревья у подножия моей башни. Я это запомню. Я всё запоминаю, но медленно.']],
    reward: { timber: 20 },
  },
  {
    name: 'Хлеб и недоверие',
    intro: [
      ['#', 'Глава 2. Хлеб и недоверие'],
      ['grum', 'Гном без хлеба — это просто маленький сердитый бородач. Строим ферму, мельницу и пекарню.'],
      ['mrak', 'Шум. Опять шум. Кто разрешил стучать молотками в моём лесу?'],
      ['grum', 'Лес не его, но спорить с человеком, у которого башня, как-то неловко.'],
    ],
    goals: [{ k: 'build', t: 'farm' }, { k: 'build', t: 'mill' }, { k: 'build', t: 'bakery' }, { k: 'prod', g: 'bread', n: 40 }, { k: 'pop', n: 14 }],
    hint: 'Ферма → мельница → пекарня. Сорок буханок хлеба и четырнадцать жителей.',
    start: { event: 'flour' },
    reward: { gold: 15 },
  },
  {
    name: 'Пиво вместо совести',
    intro: [
      ['#', 'Глава 3. Пиво вместо совести'],
      ['note', 'Утром у ворот лежал свиток. Гербовая бумага, зелёные чернила, запах серы.'],
      ['mrak', 'СЧЁТ за нарушение тишины: 40 золотых и ваша совесть. Совесть можно частями.'],
      ['grum', 'Золота нет, совесть давно пропили. Значит, пиво. Нужен хмель и пивовар.'],
    ],
    goals: [{ k: 'build', t: 'hopfarm' }, { k: 'build', t: 'brewery' }, { k: 'prod', g: 'beer', n: 25 }, { k: 'nights', n: 3 }],
    hint: 'Хмельник, пивоварня, двадцать пять кружек — и пережить три ночи.',
    start: { event: 'bill' },
    reward: { gold: 20 },
  },
  {
    name: 'Свинья — друг гнома',
    intro: [
      ['#', 'Глава 4. Свинья — друг гнома'],
      ['grum', 'Колбаса. Кожа. Доспех. Именно в таком порядке, потому что колбаса вкуснее.'],
      ['mrak', 'Вы разводите свиней. У меня в башне — пауки. Мы разные люди.'],
    ],
    goals: [{ k: 'build', t: 'swine' }, { k: 'build', t: 'butchery' }, { k: 'build', t: 'tannery' }, { k: 'build', t: 'armory' }, { k: 'nights', n: 5 }],
    hint: 'Свинарник, бойня, дубильня, мастерская доспехов. Пятая ночь — долгая.',
    outro: [['grum', 'Пятая ночь позади, а мы ещё тут. Это почти подвиг. Почти.']],
    reward: { gold: 20 },
    end: { event: 'feast' },
  },
  {
    name: 'Блеск и железо',
    intro: [
      ['#', 'Глава 5. Блеск и железо'],
      ['grum', 'Золото красиво. Железо полезно. Герою нужно второе, а гномам — первое. Как обычно.'],
      ['note', 'Башня на скале мигнула окнами. Кажется, в деревню посмотрели.'],
      ['mrak', 'Так-так. Гильдии, железо, герой… И мои магические камни у вас на складе. Любопытно. Нет, мне не любопытно. Мне не нравится.'],
    ],
    goals: [{ k: 'build', t: 'goldmine' }, { k: 'build', t: 'metallurgist' }, { k: 'build', t: 'ironmine' }, { k: 'build', t: 'smeltery' }, { k: 'build', t: 'weaponsmith' },
      { k: 'any', ts: ['guild_warrior', 'guild_archer', 'guild_rogue', 'guild_mage'], label: 'Построить любую гильдию' }, { k: 'rank', n: 2 }],
    hint: 'Рудники, плавильня, оружейная, любая гильдия — и звание «Город».',
    chapter: 5,
    reward: { gold: 50 },
  },
  {
    name: 'Тишина дороже золота',
    intro: [
      ['#', 'Глава 6. Тишина дороже золота'],
      ['mrak', 'Я просил тишины и вернуть мои камни. Вы принесли шум и забыли про камни. Ночи теперь будут моими.'],
      ['grum', 'Он серьёзно. Я бы испугался, но я старый, и мне лень.'],
      ['grum', 'Герой, гильдии, костры и хлеб. Всё, что у нас есть. Разберёмся.'],
    ],
    goals: [{ k: 'guards' }, { k: 'enemy', id: 'darkMage' }],
    hint: 'Чёрный шпиль — фиолетовая башня на краю карты: к ней ведёт стрелка у края экрана, на миникарте — мигающее кольцо. Соберите героя, отряд и провиант, жмите «Выступить в поход» или просто тапните по башне.',
    chapter: 6,
    final: true,
  },
];

const GOAL_EPILOGUE = [
  ['#', 'Эпилог'],
  ['note', 'Башня погасла разом, как свеча, которую наконец-то заметили. Над лесом стало тихо.'],
  ['grum', 'Тишина закончилась. Теперь шум — наш. По праву. И по расписанию.'],
  ['note', 'Деревня гудела до рассвета. Пекарь клялся, что слышал, как маг извинялся. Никто не поверил.'],
];

// ---------- Состояние ----------

function goalNew(mode) {
  Game.goal = {
    mode: mode === 'scenario' ? 'scenario' : 'free', ch: 0, rank: 0, flags: {}, chStart: 0, seq: 0, cut: null, over: null,
    st: { maxPop: typeof Game !== 'undefined' && Game.units ? goalAlive() : 0 }, rewarded: {}, won: false,
  };
  if (Game.goal.mode === 'scenario') goalCut({ kind: 'story', lines: goalStartChapter(0) });
  Game.goalView = null; Game.goalT = 0; GoalUI.seen = -1; GoalUI.hudHtml = null;
  return Game.goal;
}
function goalEnsure() {
  if (!Game.goal) { Game.goal = goalNew('free'); Game.goal.fromOld = true; }
  return Game.goal;
}
function goalEnemyReady() { return !!(window.ENEMY_READY || (typeof Game !== 'undefined' && Game.foe)); }
function goalEnemyDead() { return !!(Game.foe && Game.foe.defeated) || (Game.goal && Game.goal.flags.darkMage === 'dead'); }
function goalFlag(n) { return Game.goal ? Game.goal.flags[n] : undefined; }
function goalSetFlag(n, v) { goalEnsure().flags[n] = v === undefined ? true : v; }

// пережито ночей (полностью, с рассветом)
function goalNights(t = Game.time) {
  const c = cycleAt(t);
  return c.k + (c.p >= NIGHT_START + c.nl ? 1 : 0);
}
function goalAlive() {
  let n = 0;
  for (const u of Game.units) if (!u.dead && isPerson(u) && u.type !== 'hero' && u.type !== 'carter') n++;
  return n;
}
function goalBuilt() {
  return Game.buildings.filter(b => b.state === 'done' && b.type !== 'graveyard').length;
}
function goalStats() {
  const g = goalEnsure(), P = Game.produced || {};
  return {
    time: Game.time, nights: goalNights(), pop: goalAlive(), maxPop: Math.max(g.st.maxPop || 0, goalAlive()), lost: Game.lostGnomes || 0,
    blds: goalBuilt(), bread: P.bread || 0, timber: P.timber || 0, gold: P.gold || 0, beer: P.beer || 0, rank: g.rank, ch: g.ch,
  };
}

// ---------- Цели ----------

// «Пережить ночь» / «Пережить 3 ночи» / «Пережить 5 ночей»: склонение по числу
function goalNightsText(n) {
  const m = n % 100, d = n % 10;
  if (n === 1) return 'Пережить ночь';
  return 'Пережить ' + n + (m >= 11 && m <= 14 ? ' ночей' : d === 1 ? ' ночь' : d >= 2 && d <= 4 ? ' ночи' : ' ночей');
}

function goalObjective(o, S) {
  const done = t => Game.buildings.filter(b => b.state === 'done' && b.type === t).length;
  if (o.k === 'build') return { t: 'Построить: ' + BUILDINGS[o.t].name, cur: Math.min(1, done(o.t)), need: 1 };
  if (o.k === 'any') return { t: o.label, cur: Math.min(1, o.ts.reduce((s, t) => s + done(t), 0)), need: 1 };
  if (o.k === 'pop') return { t: 'Жителей', cur: Math.min(o.n, S.pop), need: o.n };
  if (o.k === 'nights') return { t: goalNightsText(o.n), cur: Math.min(o.n, S.nights), need: o.n };
  if (o.k === 'prod') return { t: 'Произвести: ' + GOODS[o.g].name.toLowerCase(), cur: Math.min(o.n, Math.floor((Game.produced || {})[o.g] || 0)), need: o.n };
  if (o.k === 'rank') return { t: 'Звание «' + GOAL_RANKS[o.n].name + '»', cur: Math.min(o.n, S.rank), need: o.n };
  if (o.k === 'guards') return typeof guardsGoal === 'function' ? guardsGoal() : { t: 'Победить стражей Чёрного шпиля', cur: 1, need: 1 };
  if (o.k === 'enemy') {
    const g = Game.goal;
    if (goalEnemyReady()) return { t: 'Победить тёмного мага Малгора', cur: goalEnemyDead() ? 1 : 0, need: 1 };
    const left = Math.max(0, g.siegeAt + GOAL_SIEGE_NIGHTS - S.nights);
    return { t: 'Пережить ночи осады', cur: GOAL_SIEGE_NIGHTS - left, need: GOAL_SIEGE_NIGHTS };
  }
  return { t: '?', cur: 0, need: 1 };
}

function goalRankProgress(r) {
  const S = goalStats(), n = GOAL_RANKS[r].need || {};
  return Object.keys(n).map(k => ({ t: GOAL_NEED_NAMES[k], cur: Math.min(n[k], Math.floor(S[k] || 0)), need: n[k] }));
}

function goalMakeView() {
  const g = goalEnsure(), S = goalStats(), v = { mode: g.mode, rank: g.rank, ch: g.ch, nights: S.nights, free: GOAL_FREE_NIGHTS };
  if (g.mode === 'scenario' && g.ch < GOAL_CHAPTERS.length) {
    const c = GOAL_CHAPTERS[g.ch];
    v.chName = c.name; v.hint = c.hint; v.chN = GOAL_CHAPTERS.length;
    v.objs = c.goals.map(o => goalObjective(o, S));
  }
  if (g.rank < GOAL_RANKS.length - 1) v.next = { name: GOAL_RANKS[g.rank + 1].name, objs: goalRankProgress(g.rank + 1) };
  return v;
}

// ---------- Награды, заставки, события ----------

function goalGive(goods) {
  const st = Game.buildings.find(b => b.type === 'storehouse' && b.state === 'done');
  if (!st) return;
  for (const g in goods) st.stock[g] = (st.stock[g] || 0) + goods[g];
}
function goalRewardText(r) {
  return Object.keys(r || {}).map(g => '+' + r[g] + ' ' + (GOAL_GOOD_NAMES[g] || g)).join(', ');
}
function goalCut(c) {
  const g = goalEnsure();
  g.cut = Object.assign({ seq: ++g.seq }, c);
  g.cuts = (g.cuts || []).concat([g.cut]).slice(-4);     // очередь: веха и глава в одну секунду не затирают друг друга
}

function goalEvent(id) {
  if (id === 'flour') { goalGive({ bread: 10 }); toast('Обоз с мукой: подкинули 10 хлеба'); logEvent('goal', 'Мимо проезжал обоз с мукой: +10 хлеба на склад'); }
  if (id === 'bill') { toast('У ворот лежит свиток: Малгор прислал счёт за шум'); logEvent('goal', 'Малгор прислал счёт за нарушение тишины'); if (typeof ghostsSpawn === 'function' && isEveningNow()) ghostsSpawn(1); }
  if (id === 'feast') { if (typeof festivalStart === 'function') { const bad = festivalStart('victory', 1); if (bad) toast('Праздник отложен: ' + bad); } }
}

function goalStartChapter(i, silent) {
  const g = Game.goal, c = GOAL_CHAPTERS[i];
  g.ch = i; g.chStart = goalNights(); g.siegeAt = i === GOAL_CHAPTERS.length - 1 ? goalNights() : 0;
  if (c.start && c.start.event) goalEvent(c.start.event);
  if (c.chapter && typeof enemyOnChapter === 'function') { try { enemyOnChapter(c.chapter); } catch (e) { console.error(e); } }
  return c.intro;
}

function goalFinishChapter() {
  const g = Game.goal, c = GOAL_CHAPTERS[g.ch];
  let lines = [];
  if (c.outro) lines = lines.concat(c.outro);
  if (c.reward) { goalGive(c.reward); lines.push(['note', 'Награда за главу: ' + goalRewardText(c.reward) + '.']); }
  if (c.end && c.end.event) goalEvent(c.end.event);
  logEvent('goal', `Глава ${g.ch + 1} пройдена: «${c.name}»`);
  if (g.ch + 1 < GOAL_CHAPTERS.length) {
    lines = lines.concat(goalStartChapter(g.ch + 1));
    goalCut({ kind: 'story', lines });
  } else {
    g.ch = GOAL_CHAPTERS.length;
  }
  return lines;
}

function goalEnemyDefeated(id) {
  const g = goalEnsure();
  g.flags[id || 'darkMage'] = 'dead';
}

function goalRankUp(r) {
  const g = Game.goal, R = GOAL_RANKS[r];
  g.rank = r;
  goalGive(R.reward);
  logEvent('goal', `Поселение выросло: «${R.name}»`);
  toast(`Новая веха: «${R.name}»! Награда: ${goalRewardText(R.reward)}`);
  goalCut({ kind: 'rank', rank: r, text: R.text, reward: goalRewardText(R.reward), stats: goalStats() });
}

function goalFinish(res, why, lines) {
  const g = Game.goal;
  g.over = { res, why, t: Game.time };
  if (res === 'win') g.won = true;
  goalCut({ kind: 'over', res, why, lines: lines || [], stats: goalStats() });
  logEvent('goal', res === 'win' ? 'ПОБЕДА: ' + why : 'ПОРАЖЕНИЕ: ' + why);
}

// ---------- Такт ----------

function goalTick(dt) {
  if (typeof Coop !== 'undefined' && Coop.mirror) return;           // клиент кооп-игры: считает сервер
  const g = goalEnsure();
  Game.goalT = (Game.goalT || 0) + dt;
  if (Game.goalT < 1) return;
  Game.goalT = 0;
  const S = goalStats();
  g.st.maxPop = S.maxPop;
  if (!g.over || g.over.res === 'win') {
    // вехи
    const nx = GOAL_RANKS[g.rank + 1];
    if (nx) {
      const n = nx.need;
      if (Object.keys(n).every(k => (S[k] || 0) >= n[k])) goalRankUp(g.rank + 1);
    }
    // сценарий
    if (g.mode === 'scenario' && g.ch < GOAL_CHAPTERS.length && !g.over) {
      const c = GOAL_CHAPTERS[g.ch];
      if (c.final && goalEnemyReady() && Game.foe && Game.foe.defeated) goalEnemyDefeated('darkMage');
      if (c.final && !goalEnemyReady() && S.nights >= g.siegeAt + GOAL_SIEGE_NIGHTS) goalEnemyDefeated('darkMage');
      const ok = c.goals.every(o => { const r = goalObjective(o, S); return r.cur >= r.need; });
      if (ok) {
        if (c.final) {
          g.ch = GOAL_CHAPTERS.length;
          goalFinish('win', 'Тёмный маг побеждён, башня погасла. В деревне снова шумно.', GOAL_EPILOGUE);
        } else goalFinishChapter();
      }
    }
    // свободная игра
    if (g.mode === 'free' && !g.won && !g.custom && g.rank >= 2 && S.nights >= GOAL_FREE_NIGHTS) goalFinish('win', `Город пережил ${GOAL_FREE_NIGHTS} ночей и не потерял бороду. Это называется процветание.`);
  }
  // поражение: гномов не осталось
  if ((!g.over || g.over.res === 'win') && Game.time > 30 && S.pop === 0) {
    goalFinish('lose', 'Все гномы погибли. Деревня опустела, а ночь осталась.');
    Game.paused = true;
  }
  Game.goalView = goalMakeView();
}

// ---------- Обёртки ----------

{
  const _step = step;
  step = function (dt) { _step(dt); goalTick(dt); };
  const _rgs = resetGameState;
  resetGameState = function () { _rgs(); Game.goal = null; Game.goalView = null; Game.goalT = 0; };
  const _sg = serializeGame;
  serializeGame = function () { const s = _sg(); if (Game.goal) s.goal = Game.goal; return s; };
  const _as = applySave;
  applySave = function (s) {
    _as(s); Game.goal = s.goal || null; Game.goalView = null;
    if (Game.goal) goalEnsure();
    const c = Game.goal && Game.goal.cut;      // заставки, которые игрок уже видел, не повторяем (кроме экрана поражения)
    GoalUI.seen = c ? (c.kind === 'over' && c.res === 'lose' ? c.seq - 1 : c.seq) : -1;
  };
  const _nd = nightDiff;
  nightDiff = function (n) {
    let d = _nd(n);
    const g = Game.goal;
    if (g && g.mode === 'scenario' && g.ch >= GOAL_CHAPTERS.length - 1) d += 0.5 + Math.min(1, 0.25 * Math.max(0, goalNights() - (g.siegeAt || 0)));   // последняя глава: ночи злее
    return d;
  };
  if (typeof newGame === 'function') {
    const _ng = newGame;
    newGame = function (...a) { _ng(...a); goalNew('free'); GoalUI.pendingMode = true; };
  }
}

// ======================= Интерфейс =======================

const GoalUI = { seen: -1, queue: null, idx: 0, open: false, wasPaused: false, hud: null, fold: false };

function goalHas() { return typeof document !== 'undefined' && document.getElementById && document.getElementById('view') && !window.__SERVER__; }
function goalEsc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function goalTime(t) { const m = Math.floor(t / 60); return m >= 60 ? Math.floor(m / 60) + ' ч ' + (m % 60) + ' мин' : m + ' мин'; }

function goalPause(on) {
  if (typeof Coop !== 'undefined' && Coop.mirror) return;
  if (on) { GoalUI.wasPaused = Game.paused; Game.paused = true; }
  else if (!(Game.goal && Game.goal.over && Game.goal.over.res === 'lose')) { if (!GoalUI.wasPaused) setSpeed(Game.speed || 1); }
}

function goalModalEl() {
  let el = document.getElementById('goal-modal');
  if (!el) {
    el = document.createElement('div');
    el.id = 'goal-modal'; el.className = 'hidden';
    document.body.appendChild(el);
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-gm]');
      if (b) goalModalAct(b.dataset.gm);
    });
  }
  return el;
}

function goalStatsHTML(S) {
  const row = (k, v) => `<div><span>${k}</span><b>${v}</b></div>`;
  return '<div class="gm-stats">' + row('Время', goalTime(S.time)) + row('Пережито ночей', S.nights) + row('Жителей сейчас / рекорд', S.pop + ' / ' + S.maxPop) + row('Потеряно гномов', S.lost)
    + row('Готовых зданий', S.blds) + row('Хлеба испечено', Math.floor(S.bread)) + row('Досок напилено', Math.floor(S.timber)) + row('Веха', GOAL_RANKS[S.rank].name) + '</div>';
}

function goalRenderCut() {
  const el = goalModalEl(), q = GoalUI.queue;
  const cut = q.cut;
  let html = '';
  if (q.step < q.lines.length) {
    const L = q.lines[q.step];
    if (L[0] === '#') html = `<div class="gm-card"><h2 class="gm-chap">${goalEsc(L[1])}</h2><div class="gm-text gm-hint">Нажмите «Дальше»</div><div class="gm-btns"><button data-gm="next" class="primary">Дальше ▸</button><button data-gm="skip">Пропустить</button></div></div>`;
    else {
      const w = GOAL_WHO[L[0]] || GOAL_WHO.note;
      html = `<div class="gm-card"><div class="gm-say"><div class="gm-face" style="background:${w.bg};color:${w.col};border-color:${w.col}">${w.ch}</div>
        <div class="gm-body">${w.name ? `<div class="gm-name" style="color:${w.col}">${w.name}</div>` : ''}<div class="gm-text${L[0] === 'note' ? ' note' : ''}">${goalEsc(L[1])}</div></div></div>
        <div class="gm-btns"><button data-gm="next" class="primary">Дальше ▸</button><button data-gm="skip">Пропустить</button></div></div>`;
    }
  } else if (cut.kind === 'rank') {
    html = `<div class="gm-card gm-sum"><h2>Новая веха: ${goalEsc(GOAL_RANKS[cut.rank].name)}</h2>
      <div class="gm-text">${goalEsc(cut.text)}</div>${GOAL_RANKS[cut.rank].title ? `<div class="gm-title">Ваш титул: <b>${goalEsc(GOAL_RANKS[cut.rank].title)}</b></div>` : ''}
      <div class="gm-reward">Награда на склад: ${goalEsc(cut.reward)}</div>${goalStatsHTML(cut.stats)}
      <div class="gm-btns"><button data-gm="close" class="primary">Играем дальше</button></div></div>`;
  } else if (cut.kind === 'over') {
    const win = cut.res === 'win';
    html = `<div class="gm-card gm-sum ${win ? 'win' : 'lose'}"><h2>${win ? 'Победа' : 'Деревня опустела'}</h2>
      <div class="gm-text">${goalEsc(cut.why)}</div>${goalStatsHTML(cut.stats)}
      <div class="gm-btns">${win ? '<button data-gm="close" class="primary">Играть дальше</button><button data-gm="menu">В меню</button>' : '<button data-gm="menu" class="primary">Начать заново</button><button data-gm="close">Посмотреть на пепелище</button>'}</div></div>`;
  } else { goalCloseCut(); return; }
  el.innerHTML = html;
  el.classList.remove('hidden');
}

function goalOpenCut(cut) {
  if (GoalUI.open) return;
  GoalUI.seen = cut.seq;
  GoalUI.queue = { cut, lines: cut.lines || [], step: 0 };
  GoalUI.open = true;
  goalPause(true);
  goalRenderCut();
}
function goalCloseCut() {
  GoalUI.open = false;
  const el = document.getElementById('goal-modal');
  if (el) el.classList.add('hidden');
  const cut = GoalUI.queue && GoalUI.queue.cut;
  GoalUI.queue = null;
  if (!(cut && cut.kind === 'over' && cut.res === 'lose')) goalPause(false);
}

function goalModalAct(a) {
  if (a === 'next' && GoalUI.queue) { GoalUI.queue.step++; goalRenderCut(); }
  else if (a === 'skip' && GoalUI.queue) { GoalUI.queue.step = GoalUI.queue.lines.length; goalRenderCut(); }
  else if (a === 'close') goalCloseCut();
  else if (a === 'menu') {
    try { if (Game.goal && Game.goal.over && Game.goal.over.res === 'lose') localStorage.removeItem(SAVE_KEY + 'auto'); else saveGame('auto'); } catch (e) { /* нет хранилища */ }
    location.reload();
  } else if (a === 'mode-scenario' || a === 'mode-free') {
    const sc = a === 'mode-scenario';
    goalNew(sc ? 'scenario' : 'free');
    document.getElementById('goal-modal').classList.add('hidden');
    GoalUI.open = false; GoalUI.askMode = false;
    goalPause(false);
    if (sc) goalUiTick(true); else toast('Свободная игра: цели — вехи поселения');
  } else if (a === 'mode-cancel') { document.getElementById('goal-modal').classList.add('hidden'); GoalUI.open = false; GoalUI.askMode = false; goalPause(false); }
}

function goalModeHTML(cancel) {
  return `<div class="gm-card"><h2>Новая игра</h2>
    <div class="gm-modes">
      <button class="sm-btn primary" data-gm="mode-scenario"><b>Сценарий</b><small>«${GOAL_NAME}»: 6 глав, заставки и тёмный маг</small></button>
      <button class="sm-btn" data-gm="mode-free"><b>Свободная игра</b><small>без сюжета: вехи «поселение → город»</small></button>
    </div>${cancel ? '<div class="gm-btns"><button data-gm="mode-cancel">Отмена</button></div>' : ''}</div>`;
}
function goalAskMode() {
  if (!goalHas()) return;
  const el = goalModalEl();
  el.innerHTML = goalModeHTML(true);
  el.classList.remove('hidden');
  GoalUI.open = true; GoalUI.askMode = true;
  goalPause(true);
}

// ---------- Панель целей ----------

function goalHudEl() {
  if (GoalUI.hud) return GoalUI.hud;
  const h = GoalUI.hud = document.createElement('div');
  h.id = 'goal-hud';
  h.addEventListener('click', e => {
    if (e.target.closest('[data-gh="fold"]')) { GoalUI.fold = !GoalUI.fold; GoalUI.hudHtml = null; goalHudRender(); }
    if (e.target.closest('[data-gh="mode"]') && typeof Coop !== 'undefined' && Coop.host) {
      if (confirm('Сменить режим мира? Прогресс сценария сбросится.')) coopSend({ t: 'goalmode', mode: Game.goal && Game.goal.mode === 'scenario' ? 'free' : 'scenario' });
    }
  });
  document.getElementById('view').appendChild(h);
  return h;
}

function goalHudRender() {
  const v = Game.goalView, g = Game.goal;
  if (!v || !g) return;
  const bar = o => `<li class="${o.cur >= o.need ? 'ok' : ''}"><span>${o.cur >= o.need ? '✔' : '○'} ${goalEsc(o.t)}</span>${o.need > 1 ? `<i>${o.cur}/${o.need}</i>` : ''}</li>`;
  let html = `<div class="gh-head"><b>${goalEsc(GOAL_RANKS[v.rank].name)}${GOAL_RANKS[v.rank].title ? ' · ' + goalEsc(GOAL_RANKS[v.rank].title) : ''}</b>
    <button data-gh="fold" title="Свернуть / развернуть">${GoalUI.fold ? '▸' : '▾'}</button></div>`;
  if (!GoalUI.fold) {
    if (v.objs) html += `<div class="gh-sub">${v.custom ? 'Цель карты' : 'Глава ' + (v.ch + 1) + '/' + v.chN}: ${goalEsc(v.chName)}</div><ul>${v.objs.map(bar).join('')}</ul><div class="gh-hint">${goalEsc(v.hint || '')}</div>`;
    else if (g.mode === 'scenario') html += `<div class="gh-sub">Сценарий пройден</div>`;
    if (typeof spirePrepHTML === 'function') html += spirePrepHTML();     // поход к Чёрному шпилю (world/spire.js)
    if (v.next) html += `<div class="gh-sub">До «${goalEsc(v.next.name)}»</div><ul class="small">${v.next.objs.map(bar).join('')}</ul>`;
    if (g.mode === 'free' && !g.won && !v.custom) html += `<div class="gh-sub">Победа: «Город» и ${v.free} ночей (${Math.min(v.nights, v.free)}/${v.free})</div>`;
    if (typeof Coop !== 'undefined' && Coop.host && Coop.mirror) html += `<button class="gh-mode" data-gh="mode">${g.mode === 'scenario' ? 'Режим: сценарий ⇄' : 'Режим: свободный ⇄'} (хост)</button>`;
  }
  if (html !== GoalUI.hudHtml) { GoalUI.hudHtml = html; goalHudEl().innerHTML = html; }
}

// заставка главы — одно окно за раз: ждёт, пока закроют сцену лора или другое окно очереди, и короткую паузу после
function goalCutWait() {
  if (typeof Lore !== 'undefined' && Lore.cur) return true;
  if (typeof Notify === 'undefined' || !Notify.busy) return false;
  return Notify.busy() || (Notify.gap && Notify.gap());
}

function goalUiTick(force) {
  if (!goalHas() || typeof StartMenu !== 'undefined' && StartMenu.open) return;
  const g = Game.goal;
  if (!g) return;
  goalHudEl().style.display = '';
  if (!Game.goalView && !(typeof Coop !== 'undefined' && Coop.mirror)) Game.goalView = goalMakeView();
  goalHudRender();
  if (GoalUI.pendingMode && !document.getElementById('hero-name') && !GoalUI.open) { GoalUI.pendingMode = false; goalAskMode(); return; }
  const next = (g.cuts || (g.cut ? [g.cut] : [])).find(c => c.seq > GoalUI.seen);
  if (next && !GoalUI.open && !Game.heroAsk && !GoalUI.pendingMode && !document.getElementById('hero-name') && !goalCutWait()) goalOpenCut(next);
}

{
  const _uu = updateUI;
  updateUI = function (f) { _uu(f); try { goalUiTick(); } catch (e) { if (!goalUiTick.err) { goalUiTick.err = 1; console.error(e); } } };
}

// на кооп-клиенте цель считает сервер: присылает состояние и обзор (см. coopMirror)
function goalMirrorOut() {
  const g = Game.goal;
  if (!g) return null;
  return { mode: g.mode, ch: g.ch, rank: g.rank, cut: g.cut, cuts: g.cuts, seq: g.seq, over: g.over, won: g.won, view: Game.goalView || null };
}
function goalMirrorIn(m) {
  if (!m) return;
  const g = Game.goal || (Game.goal = { flags: {}, st: {} });
  const first = !Game.goal.mode;
  Object.assign(g, { mode: m.mode, ch: m.ch, rank: m.rank, cut: m.cut, cuts: m.cuts, seq: m.seq, over: m.over, won: m.won });
  if (first && m.cut) GoalUI.seen = m.cut.seq;      // подключились в середине игры — прошлые заставки не повторяем
  Game.goalView = m.view;
}
