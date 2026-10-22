'use strict';
// Подъём к Чёрному шпилю, этап 2 (МАЛГОР_ОСТАЛОСЬ.md): Фонарщик с «Лампой предков», пленные гномы в клетках
// и сделки с Малгором между ярусами. Ядро ярусов — guards.js; сделки — окна из dilemma.js; эпилог — goal.js.
// Фонарщик Ойвин ждёт отряд у внешних врат и идёт за героем: его лампа разгоняет затмение (u.lampR → gdLights),
// нечисть выбирает его целью первым. Погиб — тьма гуще навсегда (T.dark), а он и его огонёк уходят в эхо павших.
// Клетки с пленными стоят на ярусах 2…n: подошёл герой — пленные свободны и идут в бой (рекруты u.freed), но ярус
// поднимает тревогу (башни бьют сразу, страж просыпается, из тумана лезут прислужники). Павшие освобождённые — в эхо.
// После каждого стража (кроме последнего) Малгор предлагает сделку: ослабить следующего стража или открыть врата
// за золото, уровень героя, запасы или пленных. Каждая сделка делает Малгора крепче и меняет эпилог.
// Считается там же, где вся игра (в кооперативе — на сервере). Подключается после guards.js и dilemma.js.

UNIT_TYPES.lamplighter = { name: 'Фонарщик', shirt: '#3a4466', noTrain: true };

const AS_LAMP = {
  name: 'Ойвин Фитиль', r: 5.5, hp: 120,
  story: 'Последний из рода фонарщиков подгорья. Его прадед зажёг Лампу предков в ту ночь, когда Малгор впервые погасил звёзды. Лампа горит без масла, пока помнят имена павших, — и Малгор очень хочет, чтобы их забыли.',
  hello: 'Ты к шпилю? Без света там пропадёшь. Я — Ойвин Фитиль, и Лампа предков со мной.',
  dark: ['Тьма густеет! Держитесь ближе к лампе!', 'Не отходи от света, там тебя не видно даже мне.', 'Прадед говорил: тьма боится тех, кто поёт. Пой!'],
  hurt: ['Лампу не трожь!', 'Ай! Фитиль цел, борода — не очень.', 'Прикройте фонарщика, олухи!'],
  gate: ['Ещё ярус! Прадед бы гордился.', 'Врата пали, лампа горит. Пока всё по плану.', 'Выше, выше. Свет любит высоту.'],
  boss: 'Малгор! Помнишь эту лампу? Она тебя тоже помнит.',
  bye: 'Лампа… помни… имена…',
  win: 'Погасла не лампа — погас шпиль. Пойду повешу её над воротами.',
};
const AS_FREE_LINES = ['Свобода! За бороду предков!', 'Дайте мне топор — и покажите, где тут Малгор!', 'Месяц на сухарях. Я очень зол.', 'Вы пришли! А мы уж думали — сказки.'];
const AS_PRIS_CLS = ['warrior', 'archer', 'warrior', 'rogue'];

const asT = () => { const T = gdT(); return T && !T.none ? T : null; };
const asLamp = () => Game.units.find(u => u.lamp && !u.dead) || null;
const asLampOn = () => { const T = asT(); return T && T.as && T.as.lamp === 'go' ? asLamp() : null; };     // в отряде: нечисть его видит
const asFreed = () => Game.units.filter(u => u.freed && !u.dead);
const asSay = (u, text, col) => floater(u.x, u.y - 2.3, text, col || '#ffe8b0');
function asLeader(x, y, r) {
  let best = null, bd = r;
  for (const u of Game.units) if (u.hero && !u.dead && !u.inside) { const d = Math.hypot(u.x - x, u.y - y); if (d < bd) { bd = d; best = u; } }
  return best;
}

// ---------- Устройство: пост фонарщика и клетки ----------

function asSetup(T) {
  if (T.as) return;
  T.as = { lamp: 'wait', dark: 0, cages: [], deals: [], wk: {}, proud: 0, dq: -1, saved: 0 };
  const A = T.as;
  T.pw = A.pw = +asPow().toFixed(3);
  // пост фонарщика: снаружи внешних врат, со стороны деревни, подальше от первого стража
  const post = gdSpot(T.cx + Math.cos(T.a0) * (T.r[0] + 15), T.cy + Math.sin(T.a0) * (T.r[0] + 15), 4);   // страж просыпается в 10 кл. от дома (r0+4)
  if (post) {
    const u = spawnUnit('lamplighter', post[0], post[1]);
    asMakeLamp(u, AS_LAMP.hp);
    A.post = post;
  } else A.lamp = 'none';
  // клетки: на ярусах 2…n, по другую сторону от башни яруса
  for (let i = 1; i < T.n; i++) {
    const rad = (T.r[i] + T.r[i - 1]) / 2, a = T.a0 + (i % 2 ? -0.5 : 0.5) * Math.min(1, 9 / rad);
    const p = gdSpot(T.cx + Math.cos(a) * rad, T.cy + Math.sin(a) * rad, 3);
    if (p) A.cages.push({ i, p, n: i >= 3 ? 3 : 2, open: 0 });
  }
}
// Баланс (tests/spire-balance.js): сила подъёма по уровню героев у шпиля. Герой 5 ур. — ×0,87, герой 12 ур. — ×1,08,
// потолок ×1,1. Множит урон нечисти на ярусах; здоровье стражей и Малгора не трогает (их держит отряд).
function asPow() {
  const T = gdT();
  if (T && T.pw) return T.pw;
  let L = 0;
  for (const u of Game.units) if (u.hero && !u.dead) L = Math.max(L, u.hero.level || 1);
  return Math.max(0.75, Math.min(1.1, 0.72 + 0.03 * (L || 5)));
}
// где очнётся павший герой: у последних открытых врат, а не в деревне (контрольная точка подъёма)
function asCheckpoint(T) {
  const i = Math.min(T.open, T.n - 1), h = T.homes[i];
  const rad = Math.min(T.r[0] + 6, (h ? Math.hypot(h[0] - T.cx, h[1] - T.cy) : 6) + 7);
  return gdSpot(T.cx + Math.cos(T.a0) * rad, T.cy + Math.sin(T.a0) * rad, 4);
}
function asMakeLamp(u, hp) {
  u.lamp = 1; u.lampR = AS_LAMP.r; u.lampHp = hp; u.lampMax = Math.round(AS_LAMP.hp * (0.7 + 0.3 * gdDiff()));
  u.smoker = false; u.food = 1; u.look = (u.look & ~32) | 32;           // длинная борода
}

// ---------- Фонарщик: ходит за героем ----------

function* asLampGen(u) {
  u.idleFlag = false; u.food = 1;
  const T = asT(), F = Game.foe;
  if (!T || !F || F.defeated) {                                  // шпиль погас: прощается и уходит домой
    if (!u._bye) { u._bye = 1; asSay(u, AS_LAMP.win); }
    yield { wait: 4 };
    if (T && T.as.lamp === 'go') T.as.lamp = 'home';
    const lost = Game.lostGnomes; removeUnit(u); Game.lostGnomes = lost;     // ушёл домой, а не погиб
    return;
  }
  const A = T.as, h = asLeader(u.x, u.y, A.lamp === 'go' ? 40 : 9);
  if (!h) {
    if (A.post && Math.hypot(u.x - A.post[0], u.y - A.post[1]) > 2) yield { walk: [Math.floor(A.post[0]), Math.floor(A.post[1])], offroad: true };
    yield { wait: 1 };
    return;
  }
  if (A.lamp === 'wait') {
    A.lamp = 'go';
    u.face = h.x > u.x ? 1 : -1;
    asSay(u, AS_LAMP.hello);
    toast(`Фонарщик ${AS_LAMP.name}: «${AS_LAMP.hello}» ${AS_LAMP.story} Берегите его: нечисть охотится за светом первым делом.`);
    logEvent('night', `К отряду примкнул фонарщик ${AS_LAMP.name} с Лампой предков`, u.x, u.y);
    yield { wait: 1.5 };
  }
  if (T.ecl > 0.55 && Game.time - (u._sayT || -99) > 30) { u._sayT = Game.time; asSay(u, AS_LAMP.dark[(Math.random() * AS_LAMP.dark.length) | 0]); }
  // враг вплотную — отступает от него, но так, чтобы свет доставал до героя
  let fo = null, fd = 3.2;
  for (const N of Game.raiders) if (foeLive(N) && N.k !== 'ftower') { const dd = Math.hypot(N.x - u.x, N.y - u.y); if (dd < fd) { fd = dd; fo = N; } }
  if (fo && fd < 2.6 && Game.time > (u.flareT || 0)) { asFlare(u); yield { wait: 0.6, anim: 'build' }; return; }
  if (fo) {
    const k = 3.4 / (fd || 1), bx = u.x + (u.x - fo.x) * k, by = u.y + (u.y - fo.y) * k;
    if (Math.hypot(bx - h.x, by - h.y) < AS_LAMP.r + 1.5) {
      const s = randomFreeNear(Math.floor(bx), Math.floor(by), 0, 1, (x, y) => isWalkable(x, y) && !World.door[idx(x, y)]);
      if (s) { yield { walk: s, offroad: true }; return; }
    }
  }
  const d = Math.hypot(u.x - h.x, u.y - h.y);
  if (d > 3.5) {
    // встаёт чуть позади героя (со стороны деревни), чтобы светить и не лезть под удар
    const bx = h.x + Math.cos(T.a0) * 2.4, by = h.y + Math.sin(T.a0) * 2.4;
    const s = randomFreeNear(Math.floor(bx), Math.floor(by), 0, 2, (x, y) => isWalkable(x, y) && !World.door[idx(x, y)]);
    if (s) { const ok = yield { walk: s, offroad: true }; if (!ok) yield { wait: 0.6 }; return; }
  }
  u.face = h.x > u.x ? 1 : -1;
  yield { wait: 0.6 };
}

// «Вспышка лампы»: раз в 8 с, когда враг вплотную — слепит и отбрасывает всех рядом (кроме самого Малгора)
function asFlare(u) {
  u.flareT = Game.time + 8;
  asSay(u, 'Вспышка лампы!', '#fff2a0');
  (Game.asFx = Game.asFx || []).push({ k: 'flare', x: u.x, y: u.y, t0: Game.time });
  sfxAt('chime', u.x * TILE, u.y * TILE, 0.9);
  for (const N of Game.raiders) {
    if (!foeLive(N) || N.k === 'ftower' || N.k === 'malgor' || N.inv) continue;
    const d = Math.hypot(N.x - u.x, N.y - u.y);
    if (d > 3.2) continue;
    foeHit(N, null, 6);
    if (!foeLive(N)) continue;
    N.tg = 0; N.prov = -99; N.cdA = Math.max(N.cdA, 1.6); N.scan = 1.6;
    if (N.gi == null) { const k = 1.6 / (d || 1), nx = N.x + (N.x - u.x) * k, ny = N.y + (N.y - u.y) * k; if (rdOk(N, nx, ny)) { N.x = nx; N.y = ny; } }
  }
}

function asLampHurt(u, n) {
  if (!Game.foe || Game.foe.defeated) return;
  n *= 0.5;                                                       // Лампа предков бережёт хозяина: половина удара уходит в свет
  u.lampHp -= n;
  u.ouchUntil = Game.time + 0.5; u.lampHurtT = Game.time;
  floater(u.x, u.y - 1.8, '−' + Math.max(1, Math.round(n)), '#ff8a70');
  if (Game.time - (u._hurtSay || -99) > 6) { u._hurtSay = Game.time; asSay(u, AS_LAMP.hurt[(Math.random() * AS_LAMP.hurt.length) | 0], '#ffc0a0'); }
  if (u.lampHp <= 0) asLampDown(u);
}

function asLampDown(u) {
  const T = asT();
  asSay(u, AS_LAMP.bye, '#c8a8ff');
  (Game.asFx = Game.asFx || []).push({ k: 'lamp', x: u.x, y: u.y, t0: Game.time, face: u.face || 1 });
  sfxAt('wail', u.x * TILE, u.y * TILE, 0.8);
  if (T) {
    T.as.lamp = 'dead';
    T.as.dark = +((T.as.dark || 0) + 0.15).toFixed(2); T.dark = T.as.dark;      // тьма гуще до конца подъёма
    if (T.fallen.length < 16) T.fallen.push({ n: 'Фонарщик ' + AS_LAMP.name.split(' ')[0], k: 'gnome', c: 'lamplighter' });
    if (T.fallen.length < 16) T.fallen.push({ n: 'Огонёк Лампы', k: 'gnome', c: 'lamp' });
    T.clean = 0;
  }
  toast(`Фонарщик ${AS_LAMP.name} пал. Лампа предков погасла — затмение над шпилем стало гуще. В последнем бою Малгор поднимет его призраком.`);
  logEvent('night', `Пал фонарщик ${AS_LAMP.name}, Лампа предков погасла`, u.x, u.y);
  u._ecDn = true;
  removeUnit(u);
}

// ---------- Клетки с пленными ----------

function asFree(cg, by) {
  const T = asT();
  if (!T || cg.open) return;
  cg.open = 1; cg.openT = Game.time;
  const [x, y] = cg.p;
  fxBurst(x * TILE, y * TILE - 10, 16, ['#e8d8a8', '#8a7a5a', '#ffffff'], 70, 50, 0.6, 1.8, 120);
  sfxAt('thud', x * TILE, y * TILE, 0.8);
  const names = [];
  for (let k = 0; k < cg.n; k++) {
    const p = randomFreeNear(Math.floor(x), Math.floor(y), 0, 2, (a, b) => isWalkable(a, b)) || [Math.floor(x), Math.floor(y)];
    const cls = AS_PRIS_CLS[(cg.i + k) % AS_PRIS_CLS.length];
    const u = spawnUnit(cls, p[0] + 0.5, p[1] + 0.5);
    u.smoker = false; u.freed = 1;
    u.rec = { cls, lvl: 1 + Math.floor(cg.i / 2), xp: 0, guild: 0, order: 'follow', leader: by ? by.id : 0, train: 0, armor: false, name: REC_NAMES[(Math.random() * REC_NAMES.length) | 0] };
    names.push(u.rec.name);
    if (!k) asSay(u, AS_FREE_LINES[(Math.random() * AS_FREE_LINES.length) | 0], '#fff2a0');
  }
  T.as.saved += cg.n;
  // тревога яруса: башни бьют сразу, страж просыпается, из тумана лезут прислужники
  for (const N of Game.raiders) {
    if (!foeLive(N)) continue;
    if (N.k === 'ftower' && N.tier === cg.i) N.cdA = 0;
    if (N.gi === cg.i && by && !N.inv) { N.tg = by.id; N.prov = Game.time; if (!N.woke) gdWake(N, by); }
  }
  for (let k = 0; k < 1 + Math.floor(cg.i / 2); k++) {
    const p = randomFreeNear(Math.floor(x), Math.floor(y), 2, 4, (a, b) => isWalkable(a, b));
    if (!p) continue;
    const M = foeMake('thrall', p[0] + 0.5, p[1] + 0.5);
    M.summoned = true; M.hunt = true; M.st = 'emerge'; M.t = -0.4 * k; M.tg = by ? by.id : 0; M.prov = Game.time;
  }
  toast(`Пленные свободны: ${names.join(', ')} идут в бой за героем! Но ярус ${cg.i + 1} поднял тревогу.`);
  logEvent('night', `Освобождены пленные гномы (${cg.n}) на ярусе ${cg.i + 1}; поднята тревога`, x, y);
}

function asFreedFall(u) {
  const T = asT();
  if (T && T.fallen.length < 16) { T.fallen.push({ n: u.rec.name, k: 'rec', c: u.rec.cls }); T.clean = 0; }
  floater(u.x, u.y - 2.4, 'Вернётся призраком…', '#c8a8ff');
  u._ecDn = true;
  logEvent('night', `Пал освобождённый пленник ${u.rec.name}`, u.x, u.y);
  removeUnit(u);
}

// ---------- Сделки с Малгором ----------

const AS_DEAL_FX = {
  weak: 'Следующий страж слабее на 40%',
  open: 'Врата следующего яруса откроются',
  lvl: 'Герой −1 уровень',
  pris: 'Освобождённые уйдут к Малгору',
};
const AS_DEAL_O = [
  { t: 'Ослабить стража за золото', cost: { gold: 10 }, fx: { malgor: 'weak' }, out: 'Монеты исчезли в зеркале, а из-за врат донёсся кашель: страж простыл. Малгор считает золото и улыбается.' },
  { t: 'Открыть врата: отдать уровень героя', req: 'lvl', fx: { malgor: 'open', lvl: 1 }, out: 'Герой почувствовал, как из него вытекла частица силы. Врата заскрипели и открылись. Стража там будто и не было.' },
  { t: 'Откупиться запасами', cost: { bread: 12, sausage: 6 }, fx: { malgor: 'weak' }, out: 'Хлеб и колбаса растворились в тумане. Страж за вратами наелся и обленился. Слуги Малгора тоже любят колбасу.' },
  { t: 'Отдать пленных — врата откроются', req: 'pris', fx: { malgor: 'open', pris: 1 }, out: 'Освобождённые ушли в туман, не оглядываясь. Врата открылись. Где-то в шпиле теперь звенят новые цепи.' },
  { t: 'Отказать', def: 1, fx: { malgor: 'refuse' }, out: 'Малгор фыркнул: «Гордые умирают красиво». Зеркало треснуло. Дальше — честно, через стража.' },
];
for (const [id, t, d] of [
  ['malgor_deal1', 'Голос из зеркала', 'Над павшим стражем повисло тёмное зеркало. Из него — вежливый, почти ласковый голос Малгора: «Сильно, сильно. Но устали ведь? Давайте по-деловому. Я могу помочь… за скромную плату».'],
  ['malgor_deal2', 'Сделка у врат', 'У открывшихся врат стоит прислужник с подносом. На подносе — свиток и перо. «Хозяин предлагает облегчить вам путь, — шепчет прислужник. — Подпись кровью необязательна. Чернилами тоже можно, но дороже»'],
  ['malgor_deal3', 'Последнее предложение', 'Туман сгустился в лицо Малгора, огромное, во весь ярус. «Последний раз предлагаю. Там, наверху, я не буду таким добрым. Отдай мне немного — и дойдёшь до меня живым»'],
]) {
  const e = { id, t, ic: 'log_night', r: 3, c: { chainOnly: true }, d, o: AS_DEAL_O, malgor: 1 };
  DIL_EVENTS.push(e); DIL_BY_ID[id] = e;
}
const asDealOpen = () => { const d = Game.dil, c = d && d.cur; return !!(c && DIL_BY_ID[c.id] && DIL_BY_ID[c.id].malgor); };
function asReqOk(o) {
  if (o.req === 'lvl') { const h = dilHero(); return !!h && h.hero.level >= 2; }
  if (o.req === 'pris') return asFreed().length > 0;
  return true;
}
// предложить сделку перед ярусом i (страж i ещё жив)
function asDealTry(i) {
  const T = asT();
  if (!T || !T.as || i <= 0 || i >= T.n || T.open !== i || T.as.deals.some(x => x.i === i) || T.as.offered === i) return;
  const d = dilEnsure();
  if (d.cur) {
    if (asDealOpen()) dilFinish(true);                // старая сделка без ответа — «Отказать»
    else { T.as.dq = i; return; }                     // идёт обычное событие — предложим, когда закроют
  }
  T.as.dq = -1; T.as.offered = i;
  const k = Math.min(3, T.as.deals.length + 1 + (i >= T.n - 1 ? 3 : 0));
  dilOpen(DIL_BY_ID['malgor_deal' + k]);
  logEvent('night', `Малгор предлагает сделку перед ярусом ${i + 1}`, T.cx, T.cy);
}

function asDealApply(fx, chips) {
  const T = asT();
  if (!T) return;
  const A = T.as, i = T.open, G = Game.raiders.find(N => N.gi === i && foeLive(N));
  if (fx.malgor === 'refuse') { A.proud++; chips.push({ k: 'up', t: 'Честь цела' }); return; }
  if (fx.lvl) {
    const h = dilHero(), H = h && h.hero;
    if (H && H.level >= 2) {
      const sc = heroTownScore();
      H.lvDebt = (H.lvDebt || 0) + Math.max(0, sc - heroNeedFor(H.level - 2) - 0.5);    // уровень вернётся, когда город и бои его нарастят
      H.level--; if (typeof hlMaxHp === 'function') { H.maxhp = hlMaxHp(H); H.hp = Math.min(H.hp, H.maxhp); }
      chips.push({ k: 'dn', t: 'Герой: уровень ' + H.level });
    }
  }
  if (fx.pris) {
    const list = asFreed();
    for (const u of list) { if (T.fallen.length < 16) T.fallen.push({ n: u.rec.name, k: 'rec', c: u.rec.cls }); u._ecDn = true; removeUnit(u); }
    if (list.length) { T.clean = 0; chips.push({ k: 'dn', t: 'Отдано пленных: ' + list.length }); }
  }
  if (fx.malgor === 'weak') {
    A.wk[i] = 0.6;
    if (G) { G.mhp = Math.round(G.mhp * 0.6); G.hp = Math.min(G.hp, G.mhp); floater(G.x, G.y - 3, 'Ослаблен сделкой', '#c8a8ff'); }
    chips.push({ k: 'up', t: AS_DEAL_FX.weak });
  } else if (fx.malgor === 'open') {
    asPactOpen(i, G);
    chips.push({ k: 'up', t: 'Врата открыты' });
  }
  A.deals.push({ i, k: fx.malgor, w: fx.lvl ? 'lvl' : fx.pris ? 'pris' : 'res' });
  chips.push({ k: 'warn', t: 'Малгор окреп' });
}

// врата открываются без боя: страж уходит в туман, печати нет
function asPactOpen(i, G) {
  const F = Game.foe, T = asT();
  for (const M of Game.raiders) if (foeLive(M) && G && M.owner === G.id) { M.noDrop = true; M.st = 'vanish'; M.vt = 0; }
  if (G) { G.noDrop = true; G.st = 'vanish'; G.vt = 0; fxBurst(G.x * TILE, G.y * TILE - 14, 22, ['#14102c', '#b07cff'], 80, 50, 0.9, 2, 80); }
  T.open = Math.max(T.open, i + 1);
  for (const k of T.gates[i] || []) if (World.bmap[k] === -1) World.bmap[k] = 0;
  PF.regT = -1e9;
  if (typeof spireEnsureRoute === 'function' && G) { try { spireEnsureRoute(Math.floor(G.x), Math.floor(G.y)); } catch (e) { console.error(e); } }
  logEvent('night', `Врата яруса ${i + 1} открыты сделкой с Малгором`, T.cx, T.cy);
  if (T.open < T.n && T.as) T.as.dq = T.open;                // у следующих врат Малгор предложит снова
  if (T.open >= T.n) {
    foeSpawnBoss(F);
    if (F.boss) { F.boss.woke = false; floater(F.boss.x, F.boss.y - 3.4, 'Договорились. Теперь я сам.', '#b8ff90'); }
    toast('Врата распахнуты сделкой. Из Чёрного шпиля выходит тёмный маг Малгор!');
  }
}

// ---------- Эпилог ----------

function asEpilogue() {
  const T = asT();
  if (!T || !T.as) return [];
  const A = T.as, n = A.deals.length, out = [['#', 'Подъём к шпилю']];
  if (!n) {
    out.push(['mrak', A.proud ? 'Ни одной сделки… Упрямые гномы. Ненавижу упрямых гномов.' : 'Даже не поговорили. Невежливо.']);
    out.push(['note', 'Летописцы запишут: шпиль взят честно, без единой сделки с тёмным магом. Барды уже спорят, кто первый сочинит об этом песню.']);
  } else {
    const what = [...new Set(A.deals.map(d => ({ lvl: 'частицу силы героя', pris: 'спасённых пленников', res: 'золото и запасы' }[d.w])))].join(', ');
    out.push(['mrak', `Ты заплатил мне ${n} ${n === 1 ? 'раз' : n < 5 ? 'раза' : 'раз'}. Я проиграл, но ты — тоже немного мой.`]);
    out.push(['note', `Шпиль пал, но по деревне ползут слухи: герой торговался с Малгором и отдал ему ${what}. Старики качают головами, а дети играют «в сделку».`]);
    if (A.deals.some(d => d.w === 'pris')) out.push(['grum', 'Пленных мы спасли, а потом отдали. Это как построить мост и продать его на дрова. Не повторять.']);
  }
  if (A.lamp === 'dead') out.push(['note', `Лампу предков нашли у врат, холодную. ${AS_LAMP.name} не вернулся, но каждый вечер кто-нибудь ставит у ворот свечу — в его честь.`]);
  else if (A.lamp === 'go' || A.lamp === 'home') out.push(['note', `${AS_LAMP.name} повесил Лампу предков над воротами деревни. С тех пор там никогда не бывает совсем темно.`]);
  if (A.saved) {
    const alive = asFreed().length;
    out.push(['note', alive ? `Из клеток шпиля спасено гномов: ${A.saved}. Домой вернулись ${alive} — и первым делом потребовали пива.` : `Из клеток шпиля спасено гномов: ${A.saved}, но домой не вернулся никто. Их имена вырезали на воротах.`]);
  }
  return out;
}

// ---------- Такт ----------

function asTick(dt) {
  const T = asT();
  if (!T || !T.as) return;
  const A = T.as;
  A.tk = (A.tk || 0) + dt;
  if (A.tk < 0.25) return;
  A.tk = 0;
  if (Game.foe.defeated) {
    if (asDealOpen()) dilFinish(true);
    return;
  }
  const L = asLamp();
  if (L && L.lampHp < L.lampMax && Game.time - (L.lampHurtT || -99) > 5) L.lampHp = Math.min(L.lampMax, L.lampHp + 0.5);       // 2 HP/с
  if (L && Game.raiders.some(N => N.k === 'malgor' && N.woke && foeLive(N)) && !A.bossSaid) { A.bossSaid = 1; asSay(L, AS_LAMP.boss); }
  // большой отряд — страж и Малгор крепче: +35% здоровья за каждого бойца сверх трёх, не больше ×2 (один раз, когда проснулся)
  for (const N of Game.raiders) {
    if (N._ps || !N.woke || !foeLive(N) || (N.gi == null && N.k !== 'malgor')) continue;
    let n = 0;
    for (const u of Game.units) if (!u.dead && !u.inside && (u.hero || u.rec) && Math.hypot(u.x - N.x, u.y - N.y) < 18) n++;
    N._ps = Math.min(2, 1 + 0.35 * Math.max(0, n - 3));
    if (N._ps > 1) { N.mhp = Math.round(N.mhp * N._ps); N.hp = Math.round(N.hp * N._ps); if (N.k === 'malgor') Game.foe.bossHp = N.hp; }
  }
  // клетки: открываются, когда рядом герой, а ярус уже открыт
  for (const cg of A.cages) {
    if (cg.open || T.open < cg.i) continue;
    const h = asLeader(cg.p[0], cg.p[1], 1.9);
    if (h) asFree(cg, h);
  }
  if (A.dq >= 0 && !(Game.dil && Game.dil.cur)) asDealTry(A.dq);
  // эхо помнит каждого павшего один раз: герой, упавший пять раз, — одна тень, а не пять
  if (T.fallen.length > 1) { const seen = new Set(); T.fallen = T.fallen.filter(f => { const k = f.k + '|' + f.n; if (seen.has(k)) return false; seen.add(k); return true; }); }
}

// ---------- Подключение ----------

{
  const _gb = gdBuild;
  gdBuild = function (F) {
    const had = F.tiers;
    if (had) return _gb(F);
    Game._asLoad = { pw: +asPow().toFixed(3), wk: {} };          // стражи появляются внутри gdBuild — сила подъёма нужна уже там
    let T;
    try { T = _gb(F); } finally { Game._asLoad = null; }
    if (T && !T.none) asSetup(T);
    return T;
  };
  const _sg = gdSpawnGuard;
  gdSpawnGuard = function (F, i, hp) {
    const A = F.tiers.as || Game._asLoad, N = _sg(F, i, hp), w = A && A.wk[i];      // при загрузке T.as ещё не восстановлен
    if (w) { N.mhp = Math.round(N.mhp * w); N.hp = Math.min(N.hp, N.mhp); }
    return N;
  };
  // страж без противника лечится вчетверо медленнее (5 HP/с): павший герой успевает вернуться от врат
  for (const k of GD_ORDER) {
    const S = FSPEC['g_' + k], ai = S.ai;
    S.ai = function (N, dt) { const h0 = N.hp; ai(N, dt); if (N.hp > h0 && !N.tg) N.hp = h0 + (N.hp - h0) * 0.25; };
  }
  const _sm = foeStrikeMul;
  foeStrikeMul = function (N, tg) { const m = _sm(N, tg), T = asT(); return m !== 1 && T && T.pw ? m * T.pw : m; };
  const _hr = hlRespawn;
  hlRespawn = function (u, why) {
    const T = asT(), inA = T && !Game.foe.defeated && Math.hypot(u.x - T.cx, u.y - T.cy) < T.r[0] + 8;
    _hr(u, why);
    if (!inA) return;
    const p = asCheckpoint(T);
    if (!p) return;
    u.x = p[0]; u.y = p[1]; u.path = null;
    const L = asLamp();
    floater(u.x, u.y - 2, L ? 'Ойвин вытащил меня к вратам…' : 'Очнулся у врат…', '#ffe0b0');
    toast(L ? `${AS_LAMP.name} вытащил героя к последним открытым вратам. Ещё попытка!` : 'Герой очнулся у последних открытых врат. Ещё попытка!');
  };
  const _gd = gdGuardDown;
  gdGuardDown = function (N, killer) {
    _gd(N, killer);
    const T = asT(), L = asLamp();
    if (!T || !T.as) return;
    if (L && T.as.lamp === 'go') asSay(L, AS_LAMP.gate[N.gi % AS_LAMP.gate.length]);
    if (T.open < T.n) asDealTry(T.open);
  };
  // каждая сделка делает Малгора крепче
  const _sb = foeSpawnBoss;
  foeSpawnBoss = function (F) {
    const had = F.boss;
    _sb(F);
    const A = F.tiers && F.tiers.as, B = F.boss;
    if (!A || !B || B === had) return;
    if (!A.bm) { A.bm = +(1 + 0.1 * A.deals.length).toFixed(3); B.hp = Math.round(B.hp * A.bm); }   // первый выход: здоровье по силе и сделкам
    B.mhp = Math.round(FSPEC.malgor.mhp * A.bm); B.hp = Math.min(B.hp, B.mhp); F.bossHp = B.hp;
  };
  // стражи видят фонарщика, только когда он в отряде; прислужники и эхо выбирают его целью первым
  gdTargetNear = function (N, x, y, r) {
    let best = null, bd = r;
    const L = asLampOn();
    for (const u of Game.units) {
      if (u.dead || u.inside || !isPerson(u) || neuUnitOut(u) || !(u.hero || u.rec || u.freed || u.lamp && u === L)) continue;
      const d = Math.hypot(u.x - x, u.y - y);
      if (d < bd) { bd = d; best = u; }
    }
    return best;
  };
  const _ft = foeTargetNear;
  foeTargetNear = function (N, r) {
    const b = _ft(N, r), L = asLampOn();
    if (!L || L.inside || N.k === 'malgor') return b;
    const dl = Math.hypot(L.x - N.x, L.y - N.y);
    if (dl > r * 0.9) return b;
    const db = b ? Math.hypot(b.x - N.x, b.y - N.y) * (b.hero || b.rec ? 0.75 : 1) : 1e9;
    return dl * 0.7 < db ? L : b;
  };
  const _fs = foeStrike;
  foeStrike = function (N, tg) {
    if (!tg || !tg.lamp) return _fs(N, tg);
    const S = FSPEC[N.k];
    let dmg = foeR(S.dmg[0], S.dmg[1]) * (N.lv || 1);
    if (typeof foeStrikeMul === 'function') dmg *= foeStrikeMul(N, tg);
    fxBurst(tg.x * TILE, tg.y * TILE - 12, 6, ['#9cff66', '#ffffff', '#ffd070'], 55, 40, 0.5, 1.5, 160);
    sfxAt('thud', tg.x * TILE, tg.y * TILE, 0.6);
    asLampHurt(tg, dmg);
  };
  const _hu = neuHurtUnit;
  neuHurtUnit = function (u, n) {
    if (u && u.lamp && !u.dead) { asLampHurt(u, n * 0.6); return; }            // от кругов на земле фонарщик успевает отпрыгнуть
    _hu(u, n);
    if (u && u.freed && u.rec && u.rec.hp <= 0 && !u.dead && asT()) asFreedFall(u);
  };
  // уровень, отданный Малгору, возвращается только с ростом города и боями
  const _ts = heroTownScore;
  heroTownScore = function () { const h = Game.hero; return _ts() - (h && h.hero && h.hero.lvDebt ? h.hero.lvDebt : 0); };
  // окно сделки: свои условия и подписи последствий
  const _av = dilAvail;
  dilAvail = function (cur) { const r = _av(cur), e = DIL_BY_ID[cur.id]; return e && e.malgor ? r.map((ok, i) => ok && asReqOk(e.o[i])) : r; };
  const _rs = dilResolve;
  dilResolve = function (i, who) {
    const d = Game.dil, e = d && d.cur && DIL_BY_ID[d.cur.id], o = e && e.malgor && e.o[i];
    if (o && !asReqOk(o)) return { ok: false, text: o.req === 'lvl' ? 'Герою нечего отдать: у него первый уровень' : 'Освобождённых пленных рядом нет' };
    return _rs(i, who);
  };
  const _ap = dilApply;
  dilApply = function (fx, chips) { _ap(fx, chips); if (fx && fx.malgor) asDealApply(fx, chips); };
  const _ch = dilChipsOf;
  dilChipsOf = function (o, av) {
    let h = _ch(o, av);
    const fx = o.fx || {};
    if (!fx.malgor || fx.malgor === 'refuse') return h;
    const add = (k, t) => { h += `<span class="dl-chip ${k}">${dilEsc(t)}</span>`; };
    add('up', AS_DEAL_FX[fx.malgor]);
    if (fx.lvl) add('dn', AS_DEAL_FX.lvl);
    if (fx.pris) add('dn', AS_DEAL_FX.pris);
    if (o.req === 'lvl') add('req', 'Нужен герой 2+ уровня');
    if (o.req === 'pris') add('req', 'Нужны освобождённые пленные');
    add('risk', 'Малгор окрепнет · концовка запомнит');
    return h;
  };
  // под недоступной сделкой — не «не хватает припасов», а чего именно не хватает
  const _us = dilUiSync;
  dilUiSync = function () {
    _us();
    if (!asDealOpen() || !DilUI.el) return;
    const e = DIL_BY_ID[Game.dil.cur.id];
    DilUI.el.querySelectorAll('.dl-opt').forEach((b, k) => {
      const o = e.o[k], no = b.querySelector('.dl-no');
      if (o && no && !asReqOk(o)) no.textContent = o.req === 'lvl' ? 'герою нечего отдать' : 'освобождённых пленных нет';
    });
  };
  // эпилог: чем кончился подъём
  const _gf = goalFinish;
  goalFinish = function (res, why, lines) {
    const T = asT();
    if (res === 'win' && T && T.as && Game.foe && Game.foe.defeated) {
      if (T.as.deals.length) why += ' Правда, не без сделок с тёмным магом.';
      lines = (lines || []).concat(asEpilogue());
    }
    return _gf(res, why, lines);
  };
  // тап по клетке — идти освобождать
  const _rc = resolveCmd;
  resolveCmd = function (t) {
    const T = asT();
    if (T && T.as && inb(t[0], t[1])) for (const cg of T.as.cages) {
      if (cg.open || Math.hypot(t[0] + 0.5 - cg.p[0], t[1] + 0.5 - cg.p[1]) > 1.3) continue;
      const s = randomFreeNear(Math.floor(cg.p[0]), Math.floor(cg.p[1]), 1, 1, (x, y) => isWalkable(x, y)) || [Math.floor(cg.p[0]), Math.floor(cg.p[1])];
      return { kind: 'move', x: s[0], y: s[1], tx: s[0], ty: s[1], label: 'Освободить пленных' };
    }
    return _rc(t);
  };
  const _th = Unit.prototype.think;
  Unit.prototype.think = function () { return this.lamp ? asLampGen(this) : _th.call(this); };
  const _fm = foeMirror;
  foeMirror = function () {
    const m = _fm(), T = asT();
    if (m && m.tiers && T && T.as) m.tiers.as = { cages: T.as.cages, lamp: T.as.lamp, deals: T.as.deals.length };
    return m;
  };
  const _step = step;
  step = function (dt) { _step(dt); if (!isMirror()) asTick(dt); };
  const _reset = resetGameState;
  resetGameState = function () { _reset(); Game.asFx = []; };
  const _ser = serializeGame;
  serializeGame = function () {
    const s = _ser(), T = asT();
    if (s.fo && s.fo.tr && T && T.as) s.fo.tr.as = T.as;
    Game.units.forEach((u, k) => {
      const d = s.units[k];
      if (!d) return;
      if (u.lamp) d.lmp = Math.round(u.lampHp);
      if (u.freed) d.frd = 1;
    });
    return s;
  };
  const _apply = applySave;
  applySave = function (s) {
    Game._asLoad = s.fo && s.fo.tr && s.fo.tr.as || null;
    try { _apply(s); } finally { Game._asLoad = null; }
    const T = asT(), o = s.fo && s.fo.tr && s.fo.tr.as;
    if (T && o) { T.as = Object.assign({ lamp: 'none', dark: 0, cages: [], deals: [], wk: {}, proud: 0, dq: -1, saved: 0 }, JSON.parse(JSON.stringify(o))); T.dark = T.as.dark || 0; T.pw = T.as.pw || 0; }
    (s.units || []).forEach((d, k) => {
      const u = Game.units[k];
      if (!u) return;
      if (d.lmp != null) asMakeLamp(u, d.lmp);
      if (d.frd) u.freed = 1;
    });
    Game.asFx = [];
  };
  // фонарщик несёт Лампу предков
  const _du = drawUnit;
  drawUnit = function (c, u) { _du(c, u); if (u.lamp && !u.inside && !u.dead) asDrawLamp(c, u); };
  const _ds = drawSkeletons;
  drawSkeletons = function (list, c, x0, y0, x1, y1) {
    _ds(list, c, x0, y0, x1, y1);
    const T = gdT();
    if (T && !T.none && T.as) for (const cg of T.as.cages) {
      const [x, y] = cg.p;
      if (x > x0 - 2 && x < x1 + 2 && y > y0 - 2 && y < y1 + 2) list.push([y, () => asDrawCage(c, cg)]);
    }
    const fx = Game.asFx || [];
    for (let i = fx.length - 1; i >= 0; i--) if (Game.time - fx[i].t0 > 1.6) fx.splice(i, 1);
    for (const f of fx) list.push([f.y, () => f.k === 'flare' ? asDrawFlare(c, f) : asDrawLampFall(c, f)]);
  };
}

// ---------- Рисование ----------
// По КАДРЫ.md: сам фонарщик — обычный гном (покой 6, ходьба 8 из people.js); лампа качается в такт шагу (8),
// пламя дрожит 6 кадрами; гибель — 6 кадров (лампа падает и гаснет); клетка: пленники в покое 6, дверь открывается 4.

const asFp = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
function asDrawLamp(c, u) {
  const t = Game.time, a = u.action, moving = a && a.walk && a.path;
  const wf = moving ? Math.floor(u.walkPhase / 1.1) & 7 : 0, ff = Math.floor(t / 0.11 + u.id) % 6;
  const sw = moving ? [0, 1, 2, 1, 0, -1, -2, -1][wf] : [0, 0, 1, 1, 0, 0][Math.floor(t / 0.2) % 6] * 0.5;
  const px = Math.round(u.x * TILE) + (u.face || 1) * 6, py = Math.round(u.y * TILE + 6);
  c.save();
  asFp(c, px, py - 30, 1, 24, '#5a4028');                        // посох
  asFp(c, px - 3, py - 31, 7, 1, '#5a4028');
  c.translate(px + 0.5, py - 30); c.rotate(sw * 0.08);
  asFp(c, -0.5, 0, 1, 3, '#2a2420');                             // цепочка
  asFp(c, -3, 3, 7, 1, '#b08a3a'); asFp(c, -3, 10, 7, 1, '#b08a3a');
  asFp(c, -3, 4, 1, 6, '#8a6a2a'); asFp(c, 3, 4, 1, 6, '#8a6a2a');
  const fl = [3, 4, 3, 2, 3, 4][ff], fy = 9 - fl;
  asFp(c, -2, 4, 5, 6, 'rgba(255,220,140,0.35)');                // стекло
  asFp(c, -1, fy, 3, fl, '#ffd070'); asFp(c, 0, fy - 1 + (ff & 1), 1, 2, '#fff6d0');
  c.globalCompositeOperation = 'lighter';
  const r = 18 + (ff % 3), g = c.createRadialGradient(0, 7, 0, 0, 7, r);
  g.addColorStop(0, 'rgba(255,210,120,0.55)'); g.addColorStop(1, 'rgba(255,190,90,0)');
  c.fillStyle = g; c.fillRect(-r, 7 - r, r * 2, r * 2);
  c.restore();
  if (u.lampHp < u.lampMax) {                                    // полоска здоровья, когда ранен
    const w = 16, k = Math.max(0, u.lampHp / u.lampMax), bx = Math.round(u.x * TILE) - w / 2, by = py - 36;
    asFp(c, bx - 1, by - 1, w + 2, 4, 'rgba(0,0,0,0.6)'); asFp(c, bx, by, w * k, 2, '#ffd070');
  }
}
function asDrawLampFall(c, f) {
  const k = Math.min(5, Math.floor((Game.time - f.t0) / 0.2)), px = f.x * TILE + f.face * 6, py = f.y * TILE + 6;
  c.save(); c.translate(px, py - 4 + k * 0.6); c.rotate(f.face * k * 0.3);
  asFp(c, -3, -4, 7, 1, '#b08a3a'); asFp(c, -3, 3, 7, 1, '#b08a3a'); asFp(c, -3, -3, 1, 6, '#8a6a2a'); asFp(c, 3, -3, 1, 6, '#8a6a2a');
  const fl = [4, 3, 3, 2, 1, 0][k];
  if (fl) asFp(c, -1, 3 - fl, 3, fl, '#ffd070');
  if (k >= 3) { c.globalAlpha *= 0.5; asFp(c, -1 + k - 3, -8 - (k - 3) * 3, 2, 2, '#8a8090'); asFp(c, -2, -12 - (k - 3) * 3, 2, 2, '#6a6070'); }
  c.restore();
}
function asDrawFlare(c, f) {                                    // вспышка: 6 кадров, кольцо света расходится и гаснет
  const k = Math.min(5, Math.floor((Game.time - f.t0) / 0.08)), px = f.x * TILE, py = f.y * TILE - 16, r = 8 + k * 9;
  c.save(); c.globalCompositeOperation = 'lighter';
  c.strokeStyle = `rgba(255,236,160,${0.8 - k * 0.13})`; c.lineWidth = 3 - k * 0.4;
  c.beginPath(); c.ellipse(px, py + 14, r, r * 0.6, 0, 0, 7); c.stroke();
  const g = c.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, `rgba(255,240,190,${0.6 - k * 0.1})`); g.addColorStop(1, 'rgba(255,220,140,0)');
  c.fillStyle = g; c.fillRect(px - r, py - r, r * 2, r * 2);
  c.restore();
}
function asDrawCage(c, cg) {
  const t = Game.time, px = Math.round(cg.p[0] * TILE), py = Math.round(cg.p[1] * TILE + 6);
  const of = cg.open ? Math.min(3, Math.floor((t - (cg.openT || -9)) / 0.1)) : 0;     // дверь: 4 кадра
  const W = 12;
  c.save(); c.translate(px, py);
  asFp(c, -W - 1, -2, W * 2 + 2, 4, '#2a2224'); asFp(c, -W - 1, -2, W * 2 + 2, 1, '#4a4248');   // дно
  if (!cg.open) for (let k = 0; k < Math.min(cg.n, 3); k++) {   // пленники: покой 6 (переминаются, вцепились в прутья)
    const f = Math.floor(t / 0.2 + k * 2) % 6, b = [0, 0, -1, -1, 0, 0][f], x = -10 + k * 7, sh = ['#8a5a3a', '#6a6a76', '#4a6e33'][k];
    asFp(c, x + 1, -2, 2, 2, '#3a2a20'); asFp(c, x + 4, -2, 2, 2, '#3a2a20');                 // ноги
    asFp(c, x, -9 + b, 7, 7, sh); asFp(c, x, -9 + b, 7, 1, 'rgba(255,255,255,0.15)');       // рубаха
    asFp(c, x + 1, -14 + b, 5, 5, '#e8c09a');                                                   // лицо
    asFp(c, x + 2, -12 + b, 1, 1, '#2a1a10'); asFp(c, x + 4, -12 + b, 1, 1, '#2a1a10');       // глаза
    asFp(c, x, -11 + b, 7, 4, '#e0dcd0'); asFp(c, x + 1, -8 + b, 5, 2, '#e0dcd0');            // борода
    asFp(c, x, -16 + b, 7, 2, '#b03a2a'); asFp(c, x + 1, -18 + b, 5, 2, '#b03a2a'); asFp(c, x + 2, -20 + b, 3, 2, '#b03a2a'); asFp(c, x + 3, -21 + b, 1, 1, '#b03a2a');   // колпак
    if (f >= 2 && f <= 3) { asFp(c, x - 1, -8 + b, 1, 3, '#e8c09a'); asFp(c, x + 7, -8 + b, 1, 3, '#e8c09a'); }     // руки на прутьях
  }
  for (let x = -W; x <= W; x += 4) {                             // прутья
    if (cg.open && x > 3) continue;
    asFp(c, x, -24, 1, 22, '#3a343c'); asFp(c, x + 1, -24, 1, 22, '#6a626e');
  }
  asFp(c, -W - 1, -26, W * 2 + 3, 3, '#4a4248'); asFp(c, -W - 1, -26, W * 2 + 3, 1, '#7a727e');   // верх
  asFp(c, -2, -29, 5, 3, '#4a4248');                                                                 // кольцо
  if (cg.open) {                                                 // открытая дверь отходит в сторону
    const dx = [0, 3, 6, 9][of];
    for (let x = 7; x <= W; x += 4) { asFp(c, x + dx, -24, 1, 22, '#3a343c'); asFp(c, x + 1 + dx, -24, 1, 22, '#6a626e'); }
  } else asFp(c, 6, -13, 3, 3, '#a88a3a');                       // замок
  c.restore();
}
