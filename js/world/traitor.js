'use strict';
// Подъём к шпилю: предатель в своих (продолжение цепочки Малгора, ascent.js). Летописец деревни Пим Чернилкин
// с первой главы пишет летопись «в двух экземплярах» — вторую копию носят вороны Шпиля. Намёки — во фрагментах лора
// (lore.js: pim1…pim4) и в его репликах на подъёме: нечисть его не трогает, он считает бойцов «для летописи».
// Как только отряд дошёл до шпиля, Пим догоняет героя. После второго стража ворон Малгора путает адресата и роняет
// письмо «Агенту П. Ч.» герою — окно-дилемма (dilemma.js, событие malgor_spy; в коопе голосование или хост):
//  • ПРОСТИТЬ — Пим встаёт в отряд (рекрут-разбойник) и выдаёт слабое место следующего стража (−25%). Но когда
//    просыпается Малгор, Пим бьёт в спину: гибнет фонарщик Ойвин (иначе освобождённый пленник, рекрут, а если
//    никого — герой падает), Пим уходит к хозяину в зелёном дыму, Малгор подлечивается.
//  • НЕ ПРОЩАТЬ — Пим пятится, рассказывая злобный план, и срывается с края яруса. Сумка донесений: золото,
//    а Малгор без разведки слабее на 10%.
// Эпилог (asEpilogue → goalFinish) помнит исход. Состояние — T.as.tr (сохраняется вместе с T.as), у юнита — u.pim
// (1 — летописец, 2 — в отряде), в сейве d.pim. Кооп: считает сервер; клиентам — tiers.as.tr (стадия, id Пима,
// эффекты), реплики и тосты доходят сами. Подключается после ascent.js.

UNIT_TYPES.scribe = { name: 'Летописец', shirt: '#2e5a46', noTrain: true };

const SPY_NAME = 'Пим Чернилкин';
const SPY_TAG = ['Записываю: «герой храбро шагнул в туман…» Красиво. Отправлю… в архив.', 'Не обращайте на меня внимания. Я просто пишу. Всё. Подробно.',
  'Сколько вас в отряде? Это для летописи! Только для летописи.', 'Какой высокий шпиль. Я бы тут жил. В смысле — ужас какой, бр-р.'];
const SPY_IGNORED = 'Нечисть меня обходит. Наверное, уважает литературу.';
const SPY_RANT = ['Ну и ладно! Да, я шпион! Двенадцать лет в Подгорье, три года в долине!', 'Каждый вечер — донесение: сколько хлеба, сколько пива, кто храпит!',
  'А теперь — мой злобный план! Сначала я отступаю на шаг…', '…потом ещё на шаг, а потом — ха-ха! — мы…', '…ой.'];
const spyVictimLbl = (k, nm) => (k === 'lamp' ? 'фонарщик Ойвин Фитиль' : k === 'freed' ? 'освобождённый пленник ' + nm : k === 'rec' ? 'боец ' + nm : 'герой');

const spyA = () => { const T = asT(); return T && T.as ? T.as : null; };
const spyPim = () => Game.units.find(u => u.pim && !u.dead) || null;
const spySay = (u, text, col) => floater(u.x, u.y - 2.3, text, col || '#a8e8c0');
const spyFx = (k, x, y, o) => { const A = spyA(); if (!A || !A.tr) return; A.tr.fn = (A.tr.fn || 0) + 1; (A.tr.fx = A.tr.fx || []).push(Object.assign({ id: A.tr.fn, k, x: +x.toFixed(2), y: +y.toFixed(2), t0: Game.time }, o)); if (A.tr.fx.length > 6) A.tr.fx.shift(); };
const spyDilOpen = () => { const d = Game.dil, c = d && d.cur; return !!(c && c.id === 'malgor_spy'); };

function spyMakeScribe(u) { u.pim = 1; u.smoker = false; u.food = 1; u.look = (u.look & ~32) | 32; }

// ---------- Летописец ходит за героем ----------

function* spyScribeGen(u) {
  u.idleFlag = false; u.food = 1;
  const T = asT(), A = spyA(), S = A && A.tr;
  if (T && S && S.st === 'rant') { yield* spyRantGen(u, T, S); return; }
  if (!T || !S || Game.foe.defeated) { yield { wait: 2 }; if (Game.foe && Game.foe.defeated) { const lost = Game.lostGnomes; removeUnit(u); Game.lostGnomes = lost; } return; }
  if (S.st === 'reveal' || S.st === 'open') { yield { wait: 0.5 }; return; }       // стоит, бледный, держит письмо
  const h = asLeader(u.x, u.y, 40);
  if (!h) { yield { wait: 1 }; return; }
  if (Game.time - (u._sayT || -99) > 28) {
    u._sayT = Game.time;
    const near = Game.raiders.some(N => foeLive(N) && N.k !== 'ftower' && Math.hypot(N.x - u.x, N.y - u.y) < 5);
    spySay(u, near ? SPY_IGNORED : SPY_TAG[(Math.random() * SPY_TAG.length) | 0]);
  }
  const d = Math.hypot(u.x - h.x, u.y - h.y);
  if (d > 3.8) {
    // держится позади отряда, со стороны деревни (рядом с фонарщиком, если он есть)
    const bx = h.x + Math.cos(T.a0) * 3.2 + 1, by = h.y + Math.sin(T.a0) * 3.2;
    const s = randomFreeNear(Math.floor(bx), Math.floor(by), 0, 2, (x, y) => isWalkable(x, y) && !World.door[idx(x, y)]);
    if (s) { const ok = yield { walk: s, offroad: true }; if (!ok) yield { wait: 0.6 }; return; }
  }
  u.face = h.x > u.x ? 1 : -1;
  yield { wait: 0.7, anim: 'build' };                                                // пишет в книжку
}

// «Не прощать»: пятится от героя, рассказывая план, — и срывается с края яруса
function* spyRantGen(u, T, S) {
  const h = asLeader(u.x, u.y, 30);
  for (; S.k < SPY_RANT.length - 1; S.k++) {
    spySay(u, SPY_RANT[S.k], '#ffe0a0');
    if (h) u.face = h.x > u.x ? 1 : -1;
    const ax = h ? u.x - h.x : u.x - T.cx, ay = h ? u.y - h.y : u.y - T.cy, al = Math.hypot(ax, ay) || 1;
    const s = randomFreeNear(Math.floor(u.x + ax / al * 1.2), Math.floor(u.y + ay / al * 1.2), 0, 1, (x, y) => isWalkable(x, y) && !World.door[idx(x, y)]);
    if (s) yield { walk: s, offroad: true };
    yield { wait: 1.5, anim: 'build' };                                              // размахивает руками
  }
  spyFall(u);
}

function spyFall(u) {
  const A = spyA(), S = A && A.tr;
  if (!S) return;
  spySay(u, SPY_RANT[SPY_RANT.length - 1], '#ffffff');
  floater(u.x, u.y - 1.2, 'А-а-а-а…', '#d8d0c0');
  spyFx('fall', u.x, u.y, { face: u.face || 1 });
  sfxAt('wail', u.x * TILE, u.y * TILE, 0.6);
  S.st = 'fell'; S.t = Game.time;
  const got = dilGive('gold', 15);
  S.mw = 0.9;
  const B = Game.raiders.find(N => N.k === 'malgor' && foeLive(N));
  if (B && !B._trw) { B._trw = 1; B.mhp = Math.round(B.mhp * 0.9); B.hp = Math.min(B.hp, B.mhp); Game.foe.bossHp = B.hp; }
  toast(got ? 'Пим Чернилкин сорвался с края яруса, не досказав злобный план. На краю осталась сумка донесений и 15 золота. Малгор остался без разведки — он слабее на 10%.'
    : 'Пим Чернилкин сорвался с края яруса, не досказав злобный план. На краю осталась сумка донесений. Малгор остался без разведки — он слабее на 10%.');
  logEvent('night', 'Шпион Малгора Пим Чернилкин сорвался с края яруса', u.x, u.y);
  if (typeof chronAdd === 'function' && typeof chronWhen === 'function') { try { chronAdd('lore', chronWhen() + ' летописец Пим оказался шпионом Малгора. Рассказывая злобный план, отступил на шаг больше, чем нужно.', 1); } catch (e) { /* летопись подождёт */ } }
  const lost = Game.lostGnomes; removeUnit(u); Game.lostGnomes = lost;       // не наш житель — в потери не идёт
}

// ---------- Разоблачение ----------

function spyReveal(u) {
  const T = asT(), S = spyA().tr;
  S.st = 'reveal'; S.t = Game.time;
  heroStopUnit(u); u.path = null;
  const dx = T.cx - u.x, dy = T.cy - u.y, dl = Math.hypot(dx, dy) || 1;            // ворон прилетает со стороны шпиля
  spyFx('raven', u.x + dx / dl * 11, u.y + dy / dl * 11 - 4, { tx: u.x, ty: u.y });
  sfxAt('chime', u.x * TILE, u.y * TILE, 0.5);
  floater(u.x, u.y - 3, 'Кар! Письмо!', '#c8a8ff');
  logEvent('night', 'Ворон Малгора принёс письмо «Агенту П. Ч.»', u.x, u.y);
}

function spyOpenDil() {
  const S = spyA().tr;
  if (Game.dil && Game.dil.cur) return;                     // ждёт, пока закроют другое окно (сделку)
  S.st = 'open';
  dilOpen(DIL_BY_ID.malgor_spy);
}

// ---------- Простили: в отряд, а потом нож в спину ----------

function spyForgive() {
  const A = spyA(), T = asT(), S = A.tr, P = spyPim();
  if (!P) { S.st = 'gone'; return; }
  const h = asLeader(P.x, P.y, 40) || dilHero();
  const u = spawnUnit('rogue', P.x, P.y);
  u.smoker = false; u.pim = 2; u.face = P.face; u.look = P.look;
  u.rec = { cls: 'rogue', lvl: 3, xp: 0, guild: 0, order: 'follow', leader: h ? h.id : 0, train: 0, armor: false, name: SPY_NAME };
  const lost = Game.lostGnomes; P.pim = 0; removeUnit(P); Game.lostGnomes = lost;
  if (typeof purgeDead === 'function') purgeDead();                  // решение приходит из окна, вне обхода жителей: сейв сразу после — без летописца-двойника
  S.st = 'forgiven'; S.t = Game.time;
  spySay(u, 'Клянусь бородой! Больше ни строчки Малгору!', '#a8e8c0');
  const i = T.open, G = Game.raiders.find(N => N.gi === i && foeLive(N));
  if (i < T.n) {
    A.wk[i] = +((A.wk[i] || 1) * 0.75).toFixed(3);
    if (G) { G.mhp = Math.round(G.mhp * 0.75); G.hp = Math.min(G.hp, G.mhp); floater(G.x, G.y - 3, 'Пим знает его слабое место', '#a8e8c0'); }
  }
}

function spyVictim(P) {
  const A = spyA(), L = asLamp();
  if (L && A.lamp === 'go') return ['lamp', L];
  const fr = asFreed().filter(u => !neuUnitOut(u))[0];
  if (fr) return ['freed', fr];
  let best = null, bd = 25;
  for (const u of Game.units) if (u.rec && !u.pim && !u.dead && !u.inside && !neuUnitOut(u)) { const d = Math.hypot(u.x - P.x, u.y - P.y); if (d < bd) { bd = d; best = u; } }
  if (best) return ['rec', best];
  const h = asLeader(P.x, P.y, 40) || dilHero();
  return h ? ['hero', h] : null;
}

function spyBetray(P) {
  const A = spyA(), T = asT(), S = A.tr, v = spyVictim(P);
  S.st = 'betray'; S.t = Game.time;
  if (!v) { S.vk = ''; return; }
  const [k, V] = v, nm = k === 'freed' || k === 'rec' ? V.rec.name : k === 'hero' ? (V.hero.name || 'Герой') : 'Ойвин Фитиль';
  S.vk = k; S.vn = spyVictimLbl(k, nm);
  // подкрался сзади
  const bx = V.x - (V.face || 1) * 0.9, by = V.y;
  spyFx('smoke', P.x, P.y);
  if (isWalkable(Math.floor(bx), Math.floor(by))) { P.x = bx; P.y = by; }
  else { P.x = V.x + 0.4; P.y = V.y + 0.3; }
  P.path = null; heroStopUnit(P); P.face = V.x > P.x ? 1 : -1;
  spyFx('stab', V.x, V.y, { face: P.face });
  sfxAt('thud', V.x * TILE, V.y * TILE, 1);
  spySay(P, 'Прикрою тебе спину… вот так!', '#9cff66');
  if (k === 'lamp') asLampDown(V);
  else if (k === 'freed') asFreedFall(V);
  else if (k === 'rec') {
    if (T.fallen.length < 16) { T.fallen.push({ n: V.rec.name, k: 'rec', c: V.rec.cls }); T.clean = 0; }
    floater(V.x, V.y - 2.4, 'За что?..', '#ffc0a0');
    V._ecDn = true; removeUnit(V);
  } else neuHurtUnit(V, 9999);
  toast(k === 'hero' ? 'Пим Чернилкин ударил героя в спину! Прощёный шпион бежит к хозяину.' : `Пим Чернилкин ударил в спину: погиб ${S.vn}. Прощёный шпион бежит к хозяину.`);
  logEvent('night', `Пим Чернилкин предал отряд: от удара в спину пал ${S.vn}`, V.x, V.y);
}

function spyVanish(P) {
  const S = spyA().tr;
  spySay(P, 'Летопись окончена! Последняя строка — моя! Ха-ха!', '#9cff66');
  spyFx('smoke', P.x, P.y);
  sfxAt('wail', P.x * TILE, P.y * TILE, 0.5);
  const B = Game.raiders.find(N => N.k === 'malgor' && foeLive(N));
  if (B) {
    B.hp = Math.min(B.mhp, B.hp + Math.round(B.mhp * 0.15)); Game.foe.bossHp = B.hp;
    floater(B.x, B.y - 3.4, 'Молодец, э-э… Пум? Пэм? Неважно.', '#b8ff90');
  }
  S.st = 'gone'; S.t = Game.time;
  const lost = Game.lostGnomes; removeUnit(P); Game.lostGnomes = lost;
}

// ---------- Такт ----------

function spyTick(dt) {
  const T = asT(), A = spyA();
  if (!T || !A || Game.foe.defeated) {
    if (T && A && A.tr && A.tr.st === 'forgiven' && Game.foe.defeated) {
      const P = spyPim();
      A.tr.st = 'loyal';
      if (P) spySay(P, 'Я… я так и не решился. Записываю: «был верен». Почти.');
    }
    if (spyDilOpen()) dilFinish(true);
    return;
  }
  A.trk = (A.trk || 0) + dt;
  if (A.trk < 0.25) return;
  A.trk = 0;
  const S = A.tr;
  if (!S) {
    // отряд у шпиля — летописец догоняет («обязан видеть подвиг лично»)
    const h = Game.units.find(u => u.hero && !u.dead && !u.inside && (A.lamp === 'go' || Math.hypot(u.x - T.cx, u.y - T.cy) < T.r[0] + 18));
    if (!h) return;
    const p = randomFreeNear(Math.floor(h.x + Math.cos(T.a0) * 4), Math.floor(h.y + Math.sin(T.a0) * 4), 0, 3, (x, y) => isWalkable(x, y) && !World.door[idx(x, y)]);
    if (!p) return;
    const u = spawnUnit('scribe', p[0] + 0.5, p[1] + 0.5);
    spyMakeScribe(u);
    A.tr = { st: 'tag', t: Game.time, k: 0, fx: [], fn: 0 };
    spySay(u, 'Подождите! Летописец обязан видеть подвиг лично!');
    toast('Летописец деревни Пим Чернилкин догнал отряд у шпиля: «Кто-то же должен всё записать!»');
    return;
  }
  let P = spyPim();
  if (S.st === 'tag') {
    if (!P) {                                             // потерялся (утащила ночь, сбой) — догонит снова
      const h = asLeader(T.cx, T.cy, T.r[0] + 14);
      const p = h && randomFreeNear(Math.floor(h.x), Math.floor(h.y), 1, 3, (x, y) => isWalkable(x, y));
      if (p) { P = spawnUnit('scribe', p[0] + 0.5, p[1] + 0.5); spyMakeScribe(P); }
      return;
    }
    if (T.open >= Math.min(2, T.n - 1) && !(Game.dil && Game.dil.cur)) spyReveal(P);
  } else if (S.st === 'reveal') {
    if (Game.time - S.t > 2.4) spyOpenDil();
  } else if (S.st === 'open') {
    if (!spyDilOpen() && !(Game.dil && Game.dil.cur)) S.st = 'tag';      // окно пропало без решения (загрузка старого сейва) — покажем снова
  } else if (S.st === 'forgiven') {
    if (!P) { S.st = 'fought'; return; }
    const B = Game.raiders.find(N => N.k === 'malgor' && foeLive(N));       // Малгор вышел и отряд у него — время ножа
    if (B && (B.woke || asLeader(B.x, B.y, 12)) && Game.time - S.t > 20 && !neuUnitOut(P)) spyBetray(P);
  } else if (S.st === 'betray') {
    if (!P) { S.st = 'gone'; return; }
    if (Game.time - S.t > 1.6) spyVanish(P);
  }
}

// ---------- Дилемма ----------

{
  const e = {
    id: 'malgor_spy', t: 'Письмо не тому адресату', ic: 'log_night', r: 3, c: { chainOnly: true }, spy: 1,
    d: 'Ворон из Шпиля сел не на то плечо и уронил письмо: «Агенту П. Ч., лично. Отчёт получил. Хлеба у них правда так много? Веди их выше, к моим стражам. Зелёные чернила вышлю. — М.». Летописец Пим Чернилкин побелел, потом позеленел, как его чернила: «Я… могу объяснить! Он платил сухарями! Я почти передумал!»',
    o: [
      { t: 'Простить: пусть искупит в бою', fx: { spy: 'forgive' }, out: 'Пим всхлипнул, поклялся бородой и встал в строй: «Я знаю, где у стража слабое место! Честно-честно!» Отряд стал на одного больше. Летопись — на одну главу интереснее.' },
      { t: 'Не прощать', def: 1, fx: { spy: 'punish' }, out: 'Пим выпрямился и отступил на шаг: «Ах так? Тогда слушайте мой злобный план!» Все послушно замолчали. Он отступил ещё на шаг…' },
    ],
  };
  DIL_EVENTS.push(e); DIL_BY_ID[e.id] = e;
}

// ---------- Эпилог ----------

function spyEpilogue() {
  const A = spyA(), S = A && A.tr;
  if (!S) return [];
  const out = [];
  if (S.st === 'fell') {
    out.push(['note', 'Летопись дописывали всей деревней. Последняя страница Пима Чернилкина кончается словами «…и тогда мы —». Дальше пусто.']);
    out.push(['grum', 'Злодейский план рассказывают после того, как отойдут от края. Это знает даже моя коза.']);
  } else if (S.st === 'gone' || S.st === 'betray') {
    out.push(['note', S.vk === 'hero' ? 'Герой очнулся с ножом в спине и с тех пор садится только лицом к двери. Пима видели у руин Шпиля: он уверяет, что был двойным агентом.'
      : `Прощёный Пим Чернилкин ударил в спину — погиб ${S.vn || 'боец отряда'}. Пима видели у руин Шпиля: он уверяет, что был двойным агентом.`]);
    out.push(['mrak', 'Пим? А, этот. Я его не просил. Сам прибежал. Пишет он, кстати, ужасно.']);
    out.push(['grum', 'Простили — и вот. Доброта как пиво: хороша, но не досуха.']);
  } else if (S.st === 'loyal' || S.st === 'forgiven') {
    out.push(['note', 'Прощёный шпион Пим Чернилкин так и не ударил в спину. В летописи он записал себя героем. Летопись теперь читают с осторожностью.']);
  } else if (S.st === 'fought') {
    out.push(['note', 'Прощёный шпион Пим Чернилкин пал в бою на подъёме, так и не успев предать. В летописи его записали героем. По ошибке, но красиво.']);
  }
  return out;
}

// ---------- Подключение ----------

{
  const _ae = asEpilogue;
  asEpilogue = function () { return _ae().concat(spyEpilogue()); };
  const _ap = dilApply;
  dilApply = function (fx, chips) {
    _ap(fx, chips);
    if (!fx || !fx.spy) return;
    const A = spyA();
    if (!A || !A.tr) return;
    if (fx.spy === 'forgive') { spyForgive(); chips.push({ k: 'up', t: 'Пим в отряде' }); chips.push({ k: 'up', t: 'Страж слабее на 25%' }); }
    else { A.tr.st = 'rant'; A.tr.k = 0; chips.push({ k: 'warn', t: 'Пим рассказывает злобный план' }); }
  };
  const _av = dilAvail;
  dilAvail = function (cur) { const r = _av(cur); return cur.id === 'malgor_spy' ? r.map((ok, i) => ok && (i !== 0 || !!spyPim())) : r; };
  const _ch = dilChipsOf;
  dilChipsOf = function (o, av) {
    let h = _ch(o, av);
    const fx = o.fx || {};
    if (!fx.spy) return h;
    const add = (k, t) => { h += `<span class="dl-chip ${k}">${dilEsc(t)}</span>`; };
    if (fx.spy === 'forgive') { add('up', 'Пим встанет в отряд'); add('up', 'Следующий страж слабее на 25%'); add('risk', 'Кто предал однажды…'); }
    else { add('up', 'Сумка донесений'); add('warn', 'Пим ответит за всё'); }
    return h;
  };
  // до разоблачения нечисть летописца «не замечает» (это и есть намёк), а удары по нему — мимо
  const _ft = foeTargetNear;
  foeTargetNear = function (N, r) { const b = _ft(N, r); return b && b.pim === 1 ? null : b; };
  const _hu = neuHurtUnit;
  neuHurtUnit = function (u, n) {
    if (u && u.pim === 1) { if (Game.time - (u._hurtSay || -99) > 8) { u._hurtSay = Game.time; spySay(u, 'Не меня! Я свой! …то есть я просто пишу!', '#ffe0a0'); } return; }
    _hu(u, n);
  };
  const _th = Unit.prototype.think;
  Unit.prototype.think = function () { return this.pim === 1 ? spyScribeGen(this) : _th.call(this); };
  const _sb = foeSpawnBoss;
  foeSpawnBoss = function (F) {
    const had = F.boss;
    _sb(F);
    const A = F.tiers && F.tiers.as, B = F.boss;
    if (!A || !A.tr || !A.tr.mw || !B || B === had || B._trw) return;
    B._trw = 1; B.mhp = Math.round(B.mhp * A.tr.mw); B.hp = Math.min(B.hp, B.mhp); F.bossHp = B.hp;
  };
  const _fm = foeMirror;
  foeMirror = function () {
    const m = _fm(), A = spyA();
    if (m && m.tiers && m.tiers.as && A && A.tr) {
      const P = spyPim();
      m.tiers.as.tr = { st: A.tr.st, id: P ? P.id : 0, pim: P ? P.pim : 0, fx: (A.tr.fx || []).filter(f => Game.time - f.t0 < 3).map(f => Object.assign({}, f, { t0: undefined, age: +(Game.time - f.t0).toFixed(2) })) };
    }
    return m;
  };
  const _step = step;
  step = function (dt) { _step(dt); if (!isMirror()) spyTick(dt); };
  const _reset = resetGameState;
  resetGameState = function () { _reset(); SpyUI.fx = []; SpyUI.seen = 0; };
  const _ser = serializeGame;
  serializeGame = function () {
    const s = _ser();
    Game.units.forEach((u, k) => { const d = s.units[k]; if (d && u.pim && !u.dead) d.pim = u.pim; });
    if (s.fo && s.fo.tr && s.fo.tr.as && s.fo.tr.as.tr) s.fo.tr.as.tr.fx = [];
    return s;
  };
  const _apply = applySave;
  applySave = function (s) {
    _apply(s);
    (s.units || []).forEach((d, k) => {
      const u = Game.units[k];
      if (!u || !d.pim) return;
      if (d.pim === 1) spyMakeScribe(u); else u.pim = 2;
    });
    const A = spyA();
    if (A && A.tr && (A.tr.st === 'reveal' || A.tr.st === 'open') && !spyDilOpen()) A.tr.st = 'tag';     // окно покажется снова
    if (A && A.tr && A.tr.st === 'betray') A.tr.st = 'gone';
    SpyUI.fx = []; SpyUI.seen = 0;
  };
  const _du = drawUnit;
  drawUnit = function (c, u) {
    _du(c, u);
    if (u.inside || u.dead) return;
    const S = spyMir();
    if (u.pim || (S && S.id && S.id === u.id)) spyDrawBook(c, u, S);
  };
  const _ds = drawSkeletons;
  drawSkeletons = function (list, c, x0, y0, x1, y1) {
    _ds(list, c, x0, y0, x1, y1);
    spySyncFx();
    for (let i = SpyUI.fx.length - 1; i >= 0; i--) if (Game.time - SpyUI.fx[i].t0 > 3) SpyUI.fx.splice(i, 1);
    for (const f of SpyUI.fx) list.push([f.k === 'raven' ? 9999 : f.y + 0.5, () => spyDrawFx(c, f)]);
  };
}

// ---------- Рисование ----------
// По КАДРЫ.md: сам Пим — обычный гном (покой 6, ходьба 8 из people.js); книжка под мышкой качается в такт шагу (8),
// перо пишет 6 кадрами; ворон с письмом — взмах 8; падение с края — 8; удар в спину — 4; зелёный дым — 6.

const SpyUI = { fx: [], seen: 0 };
const spyMir = () => { const T = gdT(); return T && T.as && T.as.tr || null; };
// эффекты: у сервера и одиночной игры — из T.as.tr.fx, у кооп-клиента — из зеркала (возраст вместо времени)
function spySyncFx() {
  const S = spyMir();
  if (!S || !S.fx) return;
  for (const f of S.fx) {
    if (f.id <= SpyUI.seen) continue;
    SpyUI.seen = f.id;
    SpyUI.fx.push(Object.assign({}, f, { t0: f.t0 != null ? f.t0 : Game.time - (f.age || 0) }));
  }
}
function spyDrawBook(c, u, S) {
  const t = Game.time, a = u.action, moving = a && a.walk && a.path;
  const wf = moving ? Math.floor(u.walkPhase / 1.1) & 7 : 0, fc = u.face || 1;
  const bob = moving ? [0, 1, 1, 0, 0, 1, 1, 0][wf] : 0;
  const px = Math.round(u.x * TILE), py = Math.round(u.y * TILE + 6);
  c.save();
  // перо за ухом, зелёный кончик
  asFp(c, px - fc * 5, py - 23, 1, 5, '#f0ece0'); asFp(c, px - fc * 5, py - 24, 1, 2, '#5ad08a');
  // книжка-летопись: под мышкой при ходьбе, раскрыта при записи
  const st = S && S.st || 'tag';
  if (!moving && (st === 'tag' || st === 'forgiven')) {
    const wfr = Math.floor(t / 0.15 + u.id) % 6;
    asFp(c, px + fc * 2 - 4, py - 14, 9, 5, '#3a2a1a'); asFp(c, px + fc * 2 - 3, py - 14, 7, 4, '#f4ecd0');
    asFp(c, px + fc * 2 - 3 + [0, 1, 2, 3, 2, 1][wfr], py - 13 + (wfr & 1), 2, 1, '#2e7a4e');     // строчка ползёт
    asFp(c, px + fc * 2 + 1 + [0, 1, 2, 3, 2, 1][wfr], py - 18, 1, 5, '#f0ece0');                  // перо в руке
  } else {
    asFp(c, px + fc * 5 - 2, py - 14 + bob, 5, 7, '#2e5a46'); asFp(c, px + fc * 5 - 2, py - 14 + bob, 5, 1, '#5a8a6a');
    asFp(c, px + fc * 5 - 1, py - 13 + bob, 3, 1, '#c8b070');
  }
  if (st === 'reveal' || st === 'open') {                        // держит письмо с зелёной печатью, дрожит
    const sh = Math.floor(t / 0.06) & 1;
    asFp(c, px + fc * 8 - 3 + sh, py - 13, 6, 5, '#f4ecd0'); asFp(c, px + fc * 8 - 1 + sh, py - 11, 2, 2, '#4ac070');
  }
  c.restore();
}
function spyDrawFx(c, f) {
  const age = Game.time - f.t0;
  c.save();
  if (f.k === 'raven') {                                         // ворон летит от шпиля к Пиму: взмах 8 кадров, письмо падает
    const k = Math.min(1, age / 2.2), x = (f.x + (f.tx - f.x) * k) * TILE, y = (f.y + (f.ty - f.y) * k) * TILE - 40 * Math.sin(k * Math.PI) - 26 * (1 - k);
    const fr = Math.floor(age / 0.07) & 7, w = [4, 3, 1, -1, -3, -1, 1, 3][fr], dir = f.tx >= f.x ? 1 : -1;
    if (k < 1) {
      asFp(c, x - 3, y - 2, 7, 4, '#1a1622'); asFp(c, x + dir * 3, y - 3, 3, 3, '#1a1622'); asFp(c, x + dir * 5, y - 2, 2, 1, '#c8a040');
      asFp(c, x + dir * 4, y - 3, 1, 1, '#9cff66');                                                     // зелёный глаз
      asFp(c, x - 2, y - 2 - Math.max(0, w), 5, Math.abs(w) + 1, '#2a2434');                           // крыло
      asFp(c, x - 1, y + 2, 3, 2, '#f4ecd0');                                                           // письмо в лапах
    } else if (age < 2.9) {
      const d = (age - 2.2) / 0.7;
      asFp(c, x - 1 + Math.sin(age * 12) * 2, y + 2 + d * 22, 4, 3, '#f4ecd0'); asFp(c, x + Math.sin(age * 12) * 2, y + 3 + d * 22, 1, 1, '#4ac070');
    }
  } else if (f.k === 'fall') {                                   // 8 кадров: качнулся назад, замахал руками, полетел вниз
    const k = Math.min(7, Math.floor(age / 0.15)), px = f.x * TILE, py = f.y * TILE + 6;
    if (k < 7 && age < 1.6) {
      const tilt = [0, -0.2, 0.25, -0.35, -0.6, -1.1, -1.6][k] * f.face, drop = [0, 0, 0, 0, 4, 12, 24][k], sc = [1, 1, 1, 1, 0.9, 0.7, 0.45][k];
      c.translate(px, py + drop); c.rotate(tilt); c.scale(sc, sc); c.globalAlpha *= k >= 5 ? 0.6 : 1;
      asFp(c, -3, -9, 7, 8, '#2e5a46'); asFp(c, -2, -14, 5, 5, '#e8c09a'); asFp(c, -3, -11, 7, 4, '#d8d0c0');    // рубаха, лицо, борода
      asFp(c, -3, -16, 7, 2, '#3a6a52'); asFp(c, -1, -18, 3, 2, '#3a6a52');                                          // колпак
      const arm = k & 1 ? -3 : 3;
      asFp(c, -5, -9 + arm, 2, 4, '#e8c09a'); asFp(c, 4, -9 - arm, 2, 4, '#e8c09a');                                // машет руками
      asFp(c, -1, -1, 2, 3, '#3a2a20'); asFp(c, 2, -1, 2, 3, '#3a2a20');
      if (k >= 3) { asFp(c, 5, -20, 3, 4, '#f4ecd0'); asFp(c, 6, -21, 1, 1, '#f0ece0'); }                          // летопись улетает
    } else if (age < 2.4) {                                      // пыль с края
      const d = (age - 1.05) / 1.3;
      c.globalAlpha *= Math.max(0, 0.7 - d * 0.7);
      for (let i = 0; i < 5; i++) asFp(c, px - 8 + i * 4, py + 20 - d * 10 - (i % 2) * 3, 3, 3, '#8a8090');
    }
  } else if (f.k === 'stab') {                                   // удар в спину: 4 кадра, зелёный блеск кинжала
    const k = Math.min(3, Math.floor(age / 0.09)), px = f.x * TILE - f.face * 4, py = f.y * TILE - 12;
    if (age < 0.8) {
      c.globalCompositeOperation = 'lighter';
      asFp(c, px - f.face * (6 - k * 2), py, 6, 1, '#d8ffe0'); asFp(c, px - f.face * (6 - k * 2) - f.face * 2, py - 1, 2, 3, '#5a4028');
      if (k >= 2) { c.strokeStyle = `rgba(156,255,102,${0.9 - (age / 0.8) * 0.9})`; c.lineWidth = 2; c.beginPath(); c.arc(px, py, 4 + k * 3, 0, 7); c.stroke(); }
    }
  } else if (f.k === 'smoke') {                                  // зелёный дым: 6 кадров
    const k = Math.min(5, Math.floor(age / 0.12)), px = f.x * TILE, py = f.y * TILE - 8;
    if (age < 0.9) {
      c.globalAlpha *= 0.85 - k * 0.14;
      for (let i = 0; i < 6; i++) { const a = i * 1.05 + k * 0.2, r = 3 + k * 3; asFp(c, px + Math.cos(a) * r - 2, py + Math.sin(a) * r * 0.6 - k * 2 - 2, 4 + (i & 1), 4, i & 1 ? '#3a8a5a' : '#6ad08a'); }
    }
  }
  c.restore();
}
