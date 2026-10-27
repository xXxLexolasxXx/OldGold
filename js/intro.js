'use strict';
// «Новое в деревне»: лорное введение к каждой новой ветке стройки — на всю партию, а не только в обучении.
// Открылась стадия меню (UNLOCKS: лазарет, дома, свиньи, гильдии…) — Грум, Ягла или Пим коротко рассказывают,
// что это и зачем, кнопка «Показать на стройке» открывает нужный раздел и подсвечивает здание,
// внизу строка «Дальше: …» — какая ветка следующая и что для неё построить. Так игрока ведут по веткам до конца.
// Поводом бывает и событие (INTRO_NUDGES): первый заболевший, а лазарета нет; пожар без колодца; пережили ночь без башни.
// Показ — той же карточкой, что и лор (lore.js, f.intro): одна за раз, через общую очередь окон (Notify.modal),
// не во время обучения (оно само ведёт по первым веткам) и не чаще раза в INTRO_GAP.
// Что уже рассказано — в мире (Game.intro, поле сохранения intro). Старое сохранение: открытое раньше — молча в «рассказано».
// Ветка, здание которой уже стоит, засчитывается молча: игрок о ней и так знает.

const INTRO_GAP = 25000;       // мс реального времени между карточками (после лора или другой карточки)
const INTRO_QUIET = 20;        // с игры после старта/загрузки без карточек

// stage — id стадии UNLOCKS; go — здание, которое показать; keys — если любое из них уже стоит, рассказывать поздно
const INTROS = [
  { stage: 'grain', go: 'farm', keys: ['farm', 'mill', 'bakery'], kind: 'memory', title: 'Хлеб',
    lines: [
      ['yagla', 'Зерно из кисета просится в землю. Ферма вырастит пшеницу, мельница смелет муку, пекарня испечёт хлеб.'],
      ['grum', 'Без хлеба гном работает вполсилы и ворчит вдвое. Ворчать у нас есть кому — я справлюсь. Стройте ферму.'],
    ] },
  { stage: 'home', go: 'house', kind: 'memory', title: 'Свой угол',
    lines: [
      ['grum', 'Гномы спят на складе вповалку и пинаются. Доски есть — ставьте дома.'],
      ['yagla', 'В доме трое высыпаются, а ночью прячутся от нечисти: в целый дом ни призрак, ни скелет не войдёт. И семьи там заводятся.'],
    ] },
  { stage: 'well', go: 'well', kind: 'find', title: 'Колодец',
    lines: [
      ['note', 'У поля нашли старый сруб, заваленный камнями. Под ними — вода.'],
      ['grum', 'Колодец. Рядом с ним пожар тушат вёдрами, а поля не сохнут в засуху. Деревянная деревня без колодца — это растопка.'],
    ] },
  { stage: 'def', go: 'watchtower', kind: 'memory', title: 'Оборона',
    lines: [
      ['grum', 'Одну ночь пережили. Вторая будет злее — нечисть запомнила дорогу.'],
      ['yagla', 'Частокол, ловушки, факелы и сторожевая башня: дозорный стреляет в нечисть и видит её издалека. Раздел «Оборона».'],
    ] },
  { stage: 'lib', go: 'library', kind: 'letter', title: 'Читальня',
    lines: [
      ['pim', 'Нашёлся гном, который умеет читать! Один. Это я. Дайте мне читальню — и книги, и свечи.'],
      ['note', 'Читальня копит очки знаний, а за них во вкладке «Совет» открываются улучшения для всей деревни.'],
    ] },
  { stage: 'hops', go: 'hopfarm', keys: ['hopfarm', 'brewery'], kind: 'letter', title: 'Пиво',
    lines: [
      ['grum', 'Хлеб есть. А чем его запивать? Старый пивовар показал, где растёт хмель.'],
      ['note', 'Хмельник растит хмель, пивоварня варит пиво из зерна и хмеля. Пиво — в трактир: гномы веселеют, а ночью храбреют.'],
    ] },
  { stage: 'med', go: 'infirmary', kind: 'memory', title: 'Лазарет',
    lines: [
      ['yagla', 'Где пиво, там и шишки, а к третьему дню в долине начнут кашлять. Нужен лазарет.'],
      ['note', 'Лекарь варит целебные зелья из хмеля и хлеба и выхаживает больных и раненых. Без лазарета тяжёлая хворь может унести гнома.'],
    ] },
  { stage: 'inn2', go: 'inn', kind: 'song', title: 'Второй трактир',
    lines: [
      ['grum', 'В трактире очередь, как за жалованьем. Половина обедает, половина ругается, что не обедает.'],
      ['note', 'Можно поставить второй трактир — ближе к дальним мастерским, чтобы гномы не ходили через всю деревню за кружкой.'],
    ] },
  { stage: 'pigs', go: 'swine', keys: ['swine', 'butchery'], kind: 'find', title: 'Свиньи',
    lines: [
      ['note', 'Кто-то привёл свинью. Свинья привела идею.'],
      ['grum', 'Свинарник растит свиней на сене, бойня делает из них колбасу и шкуры. Колбаса — в трактир, шкуры — в ремесло.'],
    ] },
  { stage: 'base', go: 'goatpen', keys: ['goatpen', 'stable'], kind: 'memory', title: 'Козы и лошади',
    lines: [
      ['yagla', 'Носильщики сбили ноги. Дикие козы согласны возить груз за сено.'],
      ['note', 'Загон приручает коз: коза носит втрое больше гнома. Извозчик растит лошадей — телега везёт целую кучу.'],
    ] },
  { stage: 'craft', go: 'tannery', keys: ['tannery', 'armory'], kind: 'find', title: 'Ремесло',
    lines: [
      ['note', 'На бойне скопились шкуры. Пахнут они как напоминание.'],
      ['grum', 'Дубильня выделает кожу, мастерская доспехов сошьёт броню. Гном в коже живёт дольше гнома в рубахе.'],
    ] },
  { stage: 'arms', go: 'weaponsmith', kind: 'memory', title: 'Оружие',
    lines: [
      ['grum', 'Доспехи есть, а бьёмся по-прежнему ржавыми топорами. Позор предкам.'],
      ['note', 'Оружейная делает луки, мечи и кинжалы. С ней откроются гильдии — там учат воинов, лучников, плутов и магов.'],
    ] },
  { stage: 'trade', go: 'tradepost', kind: 'letter', title: 'Торговля',
    lines: [
      ['pim', 'Из-за края карты пришло письмо: торговцы готовы ехать к нам, если будет где встать.'],
      ['note', 'Торговый пост: караваны меняют излишки на золото и привозят то, чего в долине нет. Нужен склад с золотом.'],
    ] },
  { stage: 'metal', go: 'goldmine', keys: ['goldmine', 'metallurgist'], kind: 'vision', title: 'Золото',
    lines: [
      ['yagla', 'Долина не зря зовётся Старым Золотом. В скалах ещё блестит.'],
      ['note', 'Золотой рудник добывает руду, плавильня переплавляет её в золото. Золото нужно гильдиям, торговле и указам.'],
    ] },
  { stage: 'iron', go: 'ironmine', keys: ['ironmine', 'smeltery'], kind: 'find', title: 'Железо',
    lines: [
      ['note', 'Рудокоп принёс рыжий камень: «Он ржавый ещё до того, как стал железом».'],
      ['grum', 'Железный рудник и плавильня металла: слитки — на мечи и железную броню.'],
    ] },
  { stage: 'magic', go: 'crystalmine', keys: ['crystalmine', 'magiccircle', 'magicworkshop'], kind: 'vision', title: 'Магия',
    lines: [
      ['yagla', 'В скалах мерцают камни — те самые, что пели предкам. Осторожно с ними.'],
      ['note', 'Шахта добывает магические камни, круг превращает их в ману, мастерская делает посохи и мантии для магов.'],
    ] },
  { stage: 'guilds', go: 'guild_warrior', keys: ['guild_warrior', 'guild_archer', 'guild_rogue', 'guild_mage'], kind: 'letter', title: 'Гильдии',
    lines: [
      ['pim', 'К нам просятся наставники: воин, лучник, атаман и архимаг. Каждый уверен, что главный — он.'],
      ['note', 'Гильдия учит гнома ремеслу бойца, если на складе есть оружие и доспехи. Бойцы стерегут деревню и ходят с героем в походы.'],
    ] },
];

// События-поводы: открытая, но не построенная ветка + что-то случилось — напоминание сценой (один раз за мир)
const introHas = t => Game.buildings.some(b => b.type === t && !b.removed);
const INTRO_NUDGES = [
  { id: 'n:sick', stage: 'med', go: 'infirmary', kind: 'memory', title: 'Первый больной',
    when: () => !!(Game.med && Game.med.st && Game.med.st.sick > 0),
    lines: [
      ['yagla', 'Один гном слёг: жар и кашель. На лавочке он отлежится, но чумная хворь лавочек не боится.'],
      ['grum', 'Лазарет открыт, а мы его так и не поставили. Ставим, пока не слёг второй.'],
    ] },
  { id: 'n:fire', stage: 'well', go: 'well', kind: 'memory', title: 'Пожар',
    when: () => !!(Game.wf && (Game.wf.bld.length || Game.wf.cells.length)),
    lines: [
      ['grum', 'Горим! Вёдрами бы залить, да воды рядом нет.'],
      ['yagla', 'Колодец бы. Рядом с колодцем огонь живёт вдвое меньше и через крышу не прыгает.'],
    ] },
  { id: 'n:tower', stage: 'def', go: 'watchtower', kind: 'voice', title: 'Ещё ночь',
    when: () => typeof startNights === 'function' && startNights() >= 2 && typeof isEveningNow === 'function' && isEveningNow(),
    lines: [
      ['note', 'Вечереет. Из леса снова тянет холодом и чужими голосами.'],
      ['grum', 'Оборона открыта, а у нас ни башни, ни частокола. Хоть факелы у дороги поставьте!'],
    ] },
];

const Intro = { quietUntil: 0, last: -1e9 };

const introSt = id => typeof UNLOCKS !== 'undefined' && UNLOCKS.find(u => u.id === id);
const introOpen = id => !!(Game.unlocked && Game.unlocked[id]);
// есть ли у стадии своя карточка (тогда reveal.js не показывает плашку «Новое»)
function introFor(stage) { return INTROS.some(x => x.stage === stage); }

// Какая ветка следующая: из ещё закрытых стадий, всё нужное для которых уже можно строить, — та, где меньше всего недостроено
function introNext() {
  if (typeof UNLOCKS === 'undefined') return '';
  let best = null;
  for (const st of UNLOCKS) {
    if (introOpen(st.id) || !st.after || !INTROS.some(x => x.stage === st.id)) continue;
    const miss = st.after.filter(t => !Game.buildings.some(b => b.type === t && b.state === 'done' && !b.removed));
    if (typeof isUnlocked === 'function' && !miss.every(isUnlocked)) continue;   // нужное для неё ещё и самому не открыто — это не следующая
    const rankMiss = st.rank && typeof startRank === 'function' && startRank() < st.rank;
    const score = miss.length + (rankMiss ? 3 : 0) + (st.night ? 1 : 0);
    if (!best || score < best.score) best = { st, miss, rankMiss, score };
  }
  if (!best) return '';
  const name = INTROS.find(x => x.stage === best.st.id).title;
  const need = [];
  if (best.miss.length) need.push(t('постройте: {0}', best.miss.map(x => (BUILDINGS[x] && t(BUILDINGS[x].name)) || x).join(', ')));
  if (best.rankMiss) need.push(t('деревня должна дорасти до вехи «Деревня»'));
  if (best.st.night && typeof startNights === 'function' && startNights() < best.st.night) need.push(t('переживите ночь'));
  return need.length ? t('Дальше — «{0}»: {1}.', t(name), need.join('; ')) : '';
}

// Открыть стройку на нужном разделе и подсветить здание
function introGo(type) {
  const d = BUILDINGS[type];
  if (!d || typeof openBuildCat !== 'function') return;
  const k = BUILD_CATS.indexOf(d.cat);
  if (k >= 0) openBuildCat(k); else if (typeof openTab === 'function') openTab('build');
  if (typeof Mobile !== 'undefined' && Mobile.on && typeof mobileSheet === 'function' && !document.body.classList.contains('sheet-tab')) mobileSheet('tab');
  setTimeout(() => {
    const el = document.querySelector(`.bbtn[data-type="${type}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'nearest' });
    el.classList.add('rv-new');
    const off = () => el.classList.remove('rv-new');
    el.addEventListener('click', off, { once: true });
    setTimeout(off, 14000);
  }, 60);
}

// Готовая к показу карточка (или null). Рассказывать поздно — помечаем молча.
function introPick() {
  const done = Game.intro;
  for (const x of INTROS) {
    if (done[x.stage] || !introOpen(x.stage)) continue;
    if ((x.keys || [x.go]).some(introHas)) { done[x.stage] = 1; continue; }
    return { key: x.stage, x };
  }
  for (const x of INTRO_NUDGES) {
    if (done[x.id] || !introOpen(x.stage) || !done[x.stage]) continue;
    if (introHas(x.go)) { done[x.id] = 1; continue; }
    let ok = false;
    try { ok = !!x.when(); } catch (e) { ok = false; }
    if (ok) return { key: x.id, x };
  }
  return null;
}

// карточка в формате сцены лора (lore.js рисует её, f.intro: без журнала, с кнопкой «Показать на стройке»)
function introFrag(key, x) {
  return { id: 'intro:' + key, intro: true, kind: x.kind || 'memory', title: x.title, lines: x.lines, go: x.go, next: introNext() };
}

function introBusy() {
  if (typeof Tut !== 'undefined' && Tut.on) return true;
  if (typeof Lore === 'undefined' || Lore.cur || Lore.pend) return true;
  const now = performance.now();
  if (now - Math.max(Lore.closedAt || -1e9, Intro.last) < INTRO_GAP) return true;
  if (typeof nqBusy === 'function' && nqBusy()) return true;
  if (typeof loreRvBusy === 'function' && loreRvBusy()) return true;   // плашка «Новое» стоит там же, где карточка
  return false;
}

function introTick() {
  if (!Game.units || !Game.units.length || !Game.buildings || (typeof loreMenuOpen === 'function' && loreMenuOpen())) return;
  if (!Game.intro) { Game.intro = {}; introSilent(); }   // кооп-клиент или мир без поля: что уже открыто — молча
  if ((Game.time || 0) < Intro.quietUntil || introBusy()) return;
  const p = introPick();
  if (!p) return;
  const f = introFrag(p.key, p.x);
  Lore.pend = f;
  const show = () => {
    if (typeof loreRvBusy === 'function' && loreRvBusy()) { setTimeout(show, 700); return; }
    Lore.pend = null;
    if (Game.intro[p.key] || Lore.cur) return;
    Game.intro[p.key] = 1;
    Intro.last = performance.now();
    f.next = introNext();
    loreShow(f);
    if (typeof track === 'function') track('intro-' + p.key, 'Новое в деревне: ' + p.x.title);
  };
  if (typeof Notify !== 'undefined' && Notify.modal) Notify.modal('intro:' + p.key, show, 2);
  else show();
}

// всё, что уже открыто, — в «рассказано» без карточек
function introSilent() {
  for (const x of INTROS) if (introOpen(x.stage)) Game.intro[x.stage] = 1;
}

if (typeof LORE_ON !== 'undefined' && LORE_ON) {
  const _rgs = resetGameState;
  resetGameState = function () { _rgs(); Game.intro = null; };
  const _sg = serializeGame;
  serializeGame = function () { const s = _sg(); if (Game.intro) s.intro = Object.keys(Game.intro); return s; };
  const _as = applySave;
  applySave = function (s) {
    _as(s);
    // сохранение до «Нового в деревне» — поля нет: первый тик молча засчитает открытые ветки (introTick)
    Game.intro = Array.isArray(s.intro) ? Object.fromEntries(s.intro.map(k => [k, 1])) : null;
    Intro.quietUntil = (Game.time || 0) + INTRO_QUIET;
  };
  const _ng = newGame;
  newGame = function (...a) { _ng(...a); Game.intro = {}; introSilent(); Intro.quietUntil = (Game.time || 0) + INTRO_QUIET; };
  setInterval(() => { try { introTick(); } catch (e) { if (!introTick.err) { introTick.err = 1; console.error(e); } } }, 500);
}
