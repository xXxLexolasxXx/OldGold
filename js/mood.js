'use strict';
// Настроение и потребности гномов.
// У каждого жителя семь потребностей: еда, сон, уют (крыша, погода, свет и тепло), досуг, общение (пиво, компания),
// безопасность ночью и курево. Из них, плюс короткие «события» (кружка пива, дай пять, похмелье, драка, праздник),
// складывается настроение 0–100 и список причин «почему» — он виден в карточке гнома (клик по гному).
// Последствия: хорошее настроение — бодрее и словоохотливее (до +6 % к темпу), плохое — ворчат и ленятся (до −6 %),
// а в самом низу срываются: идут пить, дерутся, бросают работу «назло всем», а совсем отчаявшиеся уходят.
// Массовая тоска (тоскует каждый третий) — событие «Хандра».
// Считает только хозяин мира (одиночная игра или кооп-сервер): раз в ~2 с на гнома, дёшево. Клиент кооператива
// получает число и причины только для выбранного гнома (поле mdr), остальное ему не нужно.
// Для соседних систем (драки, таверна): moodPoke(u, код, ±очки, секунд) — добавить причину, moodOf(u) — {m, r, n}.

const MD = {
  STEP: 2,                 // секунд между пересчётами одного гнома (гномы считаются по очереди, четвертинками)
  BASE: 9,                 // «жить можно»: надбавка к 50
  SMOOTH: 18,              // настроение подтягивается к цели за ~18 с, а не прыгает
  REST_T: 2100, FUN_T: 1500, SOC_T: 1800, SM_T: 260,   // за сколько секунд пустеют сон, досуг, общение; как быстро накатывает тяга к куреву
  GOOD: 68, BAD: 38, CRIT: 22,        // границы: бодр / ворчит / на грани
  SPEED: 0.06,                        // насколько настроение влияет на темп: ±6 % на краях шкалы
  LOW_BREAK: 28,                      // сколько секунд подряд «на грани», чтобы сорваться
  LEAVE_LOW: 170,                     // сколько секунд на самом дне, чтобы собрать узелок
  BREAK_CD: [240, 360],               // пауза между срывами одного гнома
  FIGHT_GAP: 70,                      // не чаще одной драки на деревню за столько секунд
  GLOOM_FRAC: 0.4, GLOOM_SEC: 30, GLOOM_CD: 420, GLOOM_LEN: 100,
  QUIP_GAP: 1.6,                      // не чаще одной реплики на деревню за столько секунд
};

const MD_NEED_NAMES = ['Еда', 'Сон', 'Уют', 'Досуг', 'Общение', 'Покой ночью', 'Курево'];
// код причины -> [слабое название при плюсе, при минусе]; строка — одно название на оба знака
const MD_WHY = {
  food: ['Сыт, как и положено', 'Живот подводит'],
  rest: ['Выспался', 'Не высыпается'],
  cozy: ['Уютно', 'Неуютно'],
  rain: 'Мокнет без крыши',
  cold: 'Мёрзнет',
  fire: 'Костёр греет',
  lamp: 'Фонарь рядом',
  fun: ['Развлёкся', 'Скука смертная'],
  soc: ['Душевная компания', 'Не с кем пива выпить'],
  safe: ['В тепле и безопасности', 'Страшно'],
  dark: 'Темно и без фонаря',
  evil: 'Рядом нечисть!',
  smoke: ['Затянулся', 'Тянет курить'],
  beer: 'Кружка пива',
  dry: 'Всухомятку',
  cosy: 'Тепло в трактире',
  five: 'Дали пять',
  fest: 'Праздник!',
  hang: 'Похмелье',
  hurt: 'Болит нога или рука',
  vent: 'Выпустил пар',
  beaten: 'Получил по шапке',
  sulk: 'Назло всем отдохнул',
  lostg: 'Кого-то не досчитались',
  gloom: 'Хандра на всю деревню',
  cheer: 'Подъём духа в деревне',
  dil: ['Хорошие вести в деревне', 'Дурные вести в деревне'],
  base: 'Жить можно',
};
const MD_SIGN = c => { const w = MD_WHY[c]; return typeof w === 'string' ? [w, w] : w; };

// ---------- Реплики с сарказмом ----------

const MD_GOOD_Q = {
  _: ['Работа не волк. Волк — вон тот, в кустах.', 'Если это счастье, то подозрительно бесплатное.', 'Начальство, а вы знали, что я гений?', 'Давайте ещё ящик — я сегодня в ударе!', 'Хорошо жить! Особенно пока не вспомнил про ночь.', 'Эх, ещё бы выходной. Шучу, шучу.', 'Я бы и пел, но соседи только что простили.'],
  beer: ['Пиво — лучшая профсоюзная льгота.', 'Одна кружка — и я снова верю в руководство.'],
  fest: ['Праздник! Я бы и до завтра так работал.', 'Работать после такого? Ладно, ради вас.'],
  food: ['Накормили — теперь могу и не бастовать.', 'Сытый гном — гном без идей про революцию.'],
  smoke: ['Затянулся — и жизнь налаживается.', 'Перекур — это не лень, это стратегия.'],
  five: ['Дай пять! Это не повышение, но приятно.'],
  fun: ['Развлёкся — теперь вернусь к страданиям.'],
};
const MD_BAD_Q = {
  _: ['Опять работа. Какая неожиданность.', 'Я не жалуюсь. Я просто вслух констатирую.', 'В уставе про отдых что-нибудь есть?', 'Работаю как лошадь. Только овса не дают.', 'Спасибо, что не забыли. Нет, правда. (Нет.)', 'Тут просто курорт. Для тех, кто не здесь.'],
  food: ['Брюхо поёт, но почему-то не мне.', 'Пустой живот — лучший будильник. Спал бы ещё.'],
  rest: ['Спать хочется так, что и призраки уютными кажутся.', 'Я бы прилёг. Хоть на гвозди.'],
  fun: ['Развлечений в деревне — как золота в корнях. То есть иногда мерещится.', 'Скука такая, что я уже считаю бревна ради удовольствия.'],
  soc: ['Пива нет, компании нет, зато есть работа. Везёт же.', 'Поговорить бы… с кружкой хотя бы.'],
  smoke: ['Без перекура день — как булка без… ну, вы поняли.', 'Курить хочу. Это не просьба, это факт.'],
  safe: ['Ночью тут так уютно, что хочется завыть.', 'Фонаря нет, зато нервов — на троих.'],
  cozy: ['Сырость, холод… курорт, а не деревня.', 'Мёрзну. Зато закаляюсь. Быстро.'],
  hang: ['Голова не болит — она просто мечтает отвалиться.'],
  hurt: ['Нога хромает, работа тоже. Всё честно.'],
  beaten: ['Я ему ещё припомню. Когда зубы отрастут.'],
  lostg: ['Кого-то нет, а работы не убавилось. Закономерность!'],
  gloom: ['Тоска — зелёная. Как и мои надежды на премию.'],
};
const MD_BREAK_Q = {
  drink: ['Увольняюсь! В трактир.', 'С меня хватит. Я — к кружке.'],
  fight: ['Ты на что смотришь?!', 'Ну всё, это личное!', 'Давно хотел сказать… кулаком.'],
  sulk: ['Бросаю! Вернусь, когда остыну.', 'Я в отпуске. Бессрочном. До обеда.'],
  leave: ['Ухожу в лес. Там хоть никто не командует.', 'Прощайте. Передайте начальству… нет, ничего не передавайте.'],
};
const mdPick = a => a[(Math.random() * a.length) | 0];

// ---------- Состояние ----------

function mdOn(u) {
  return !u.dead && isPerson(u) && u.type !== 'hero' && u.type !== 'carter' && u.type !== 'goat' && !u.hero && !u.rec && !u.gm && !u.teamOf && !u.owner;
}

function mdNew(u) {
  const r = Math.random;
  return { m: 52 + (r() * 14 | 0), rest: 0.55 + r() * 0.4, fun: 0.4 + r() * 0.4, soc: 0.35 + r() * 0.4, sm: Game.time - r() * 120,
    t: Game.time, ev: [], r: [], n: [100, 100, 50, 50, 50, 100, 100], cf: 0, sf: 0, low: 0, hi: 0, cool: Game.time + 60 + r() * 120, qT: Game.time + 20 + r() * 60, bT: 0 };
}

function mdOf(u) { return u.md || (u.md = mdNew(u)); }
function moodOf(u) { const M = u.md; return M ? { m: M.m, r: M.r, n: M.n } : null; }

const mdStat = () => Game.moodStat || (Game.moodStat = { fights: 0, drinks: 0, sulks: 0, left: 0, gloom: 0, cheer: 0, rests: 0, quips: 0, slacks: 0 });
const mdG = () => Game.mood || (Game.mood = { gloom: 0, cheer: 0, nextGloom: 0, lowSince: 0, hiSince: 0, quipAt: 0, fightAt: 0, toastAt: 0, bTime: 0 });

// Добавить к настроению причину на несколько секунд (повтор того же кода заменяет прежний)
function moodPoke(u, code, val, secs) {
  if (!u || !mdOn(u)) return;
  const M = mdOf(u), now = Game.time;
  M.ev = M.ev.filter(e => e[0] !== code && e[2] > now);
  M.ev.push([code, Math.round(val), +(now + secs).toFixed(1)]);
  if (M.ev.length > 6) M.ev.shift();
}
function mdBump(u, key, v) {
  if (!u || !mdOn(u)) return;
  const M = mdOf(u);
  M[key] = Math.max(0, Math.min(1, M[key] + v));
}

// ---------- Подсчёт настроения ----------

const mdClamp = (v, a, b) => v < a ? a : v > b ? b : v;

// Обстановка вокруг гнома одним проходом по клеткам: фонарь рядом, скамейка, костёр
function mdSurround(u) {
  const cx = Math.floor(u.x), cy = Math.floor(u.y);
  let lamp = false, bench = false;
  for (let yy = cy - 5; yy <= cy + 5; yy++) for (let xx = cx - 5; xx <= cx + 5; xx++) {
    if (!inb(xx, yy)) continue;
    const o = World.obj[idx(xx, yy)];
    if (!o) continue;
    if (o.t === 'lamp' && !o.out && Math.hypot(xx - cx, yy - cy) <= 3.2) lamp = true;
    else if (o.t === 'bench') bench = true;
  }
  let fire = false;
  for (const b of Game.buildings) if (b.state === 'done' && !b.removed && (b.type === 'bonfire' || b.type === 'inn') && Math.hypot(b.x + b.w / 2 - u.x, b.y + b.h / 2 - u.y) < (b.type === 'bonfire' ? 8 : 5)) { fire = true; break; }
  return { lamp, bench, fire };
}

function mdThreat(u) {
  for (const g of Game.ghosts || []) if (!g.exo && g.alpha > 0.3 && g.mode !== 'leave' && g.mode !== 'calm' && Math.hypot(g.x - u.x, g.y - u.y) < 5) return true;
  for (const s of Game.skels || []) if (!s.dead && Math.hypot(s.x - u.x, s.y - u.y) < 5.5) return true;
  for (const e of Game.ents || []) if ((e.state === 'walk' || e.state === 'smash' || e.state === 'fight') && e.k > 0.5 && Math.hypot(e.x - u.x, e.y - u.y) < 5.5) return true;
  return false;
}

function mdUpdate(u, now) {
  const M = mdOf(u);
  const el = mdClamp(now - M.t, 0, 12);
  M.t = now;
  if (el <= 0) return;
  const kind = u.brk && u.brk.kind, night = isNightNow(), inside = !!u.inside;
  const sit = u.anim === 'sit' || u.benchAt >= 0;
  const sur = (inside || u.brk && u.brk.kind === 'lost') ? { lamp: false, bench: false, fire: false } : mdSurround(u);
  const rain = typeof WX !== 'undefined' && WX.k > 0.3 && !inside;
  const winter = typeof isWinterMap === 'function' && isWinterMap();

  // --- потребности: что убывает, что восстанавливается
  M.rest = mdClamp(M.rest - el / MD.REST_T * (night ? 1.5 : 1) + el * (kind === 'sleep' ? 0.03 : sit ? 0.022 : kind === 'sulk' ? 0.012 : kind === 'rest' ? 0.02 : (kind === 'smoke' || kind === 'join') ? 0.001 : inside ? (u.inside.type === 'inn' ? 0.004 : 0.0003) : 0), 0, 1);
  let fg = -el / MD.FUN_T, sg = -el / MD.SOC_T;
  if (u.fun) fg += el * 0.03;                                  // пляшет
  if (kind === 'feast') { fg += el * 0.014; sg += el * 0.014; }
  if (u.gp) { fg += el * 0.012; sg += el * 0.012; }               // игры скучающих гномов (карты, ножички, классики)
  if (sit) fg += el * 0.006;
  if (kind === 'smoke' || kind === 'join') sg += el * 0.0035;     // перекур — тоже компания
  M.fun = mdClamp(M.fun + fg, 0, 1);
  M.soc = mdClamp(M.soc + sg, 0, 1);
  if (kind === 'smoke' || kind === 'join') M.sm = now;
  const crave = u.smoker ? mdClamp((now - M.sm) / MD.SM_T, 0, 1) : 0;

  // --- причины (каждая — вклад в очки настроения)
  const R = [];
  const add = (c, v) => { v = Math.round(v); if (v) R.push([c, v]); };
  add('base', MD.BASE);
  const f = u.food;
  add('food', f <= 0.01 ? -20 : f < HUNGRY ? -10 : f < 0.55 ? -2 : f > 0.95 ? 4 : 0);
  add('rest', M.rest < 0.08 ? -11 : M.rest < 0.25 ? -6 : M.rest < 0.45 ? -2 : M.rest > 0.85 ? 4 : 0);
  add('fun', M.fun < 0.12 ? -6 : M.fun < 0.3 ? -2 : M.fun > 0.7 ? 5 : 0);
  add('soc', M.soc < 0.12 ? -5 : M.soc < 0.3 ? -2 : M.soc > 0.65 ? 5 : 0);
  if (u.smoker) add('smoke', crave > 0.8 ? -7 : crave > 0.5 ? -3 : now - M.sm < 50 ? 4 : 0);
  // уют: погода, тепло, свет
  let cz = 0;
  if (rain && !u.umbrella) { cz -= 3; add('rain', -3); }
  if (winter && !inside && !sur.fire) { cz -= night ? 5 : 3; add('cold', night ? -5 : -3); }
  if (sur.fire && (night || winter)) { cz += 3; add('fire', 3); }
  if (inside) cz += 2;
  if (sur.lamp && night) { cz += 1; add('lamp', 2); }
  if (sur.bench && !night) cz += 1;
  M.cf = cz;
  // безопасность ночью
  let sf = 0;
  if (night) {
    if (inside) { sf = 2; add('safe', 2); }
    else if (!u.lantern && !sur.lamp) { sf = -5; add('dark', -5); }
  }
  if (!inside && night && mdThreat(u)) { sf -= 8; add('evil', -8); }
  M.sf = sf;
  // события
  M.ev = M.ev.filter(e => e[2] > now);
  for (const e of M.ev) add(e[0], e[1]);
  if (u.hangUntil > now) add('hang', -6);
  if (u.injury) add('hurt', -4);
  if (kind === 'feast') add('fest', 10);
  const G = mdG();
  if (G.lostAt > now - 200) add('lostg', -3);
  if (G.gloom > now) add('gloom', -3);
  if (G.cheer > now) add('cheer', 4);
  if (Game.dil && Game.dil.mood) add('dil', Game.dil.mood * 2);   // вести и события-дилеммы (dilemma.js)

  let tgt = 50;
  for (const r of R) tgt += r[1];
  tgt = mdClamp(tgt, 0, 100);
  M.m = mdClamp(M.m + (tgt - M.m) * Math.min(1, el / MD.SMOOTH), 0, 100);
  M.m = Math.round(M.m * 10) / 10;
  R.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  M.r = R;
  M.n = [mdClamp(Math.round(f * 100), 0, 100), Math.round(M.rest * 100), Math.round(mdClamp(50 + M.cf * 8, 0, 100)), Math.round(M.fun * 100),
    Math.round(M.soc * 100), Math.round(mdClamp(100 + (M.sf < 0 ? M.sf * 9 : 0), 0, 100)), Math.round((1 - crave) * 100)];
  M.sur = sur;

  // --- последствия
  const dev = M.m - 50;
  let mul = 1 + (Math.abs(dev) < 8 ? 0 : mdClamp(dev / 50, -1, 1)) * MD.SPEED;
  if (G.gloom > now) mul *= 0.98;
  if (G.cheer > now) mul *= 1.02;
  u.mdMul = Math.round(mul * 1000) / 1000;
  M.low = M.m <= MD.CRIT ? M.low + el : Math.max(0, M.low - el * 2);
  M.hi = M.m >= MD.GOOD ? M.hi + el : Math.max(0, M.hi - el);
  if (inside || u.dead) return;
  mdBehave(u, M, now, el, G);
}

// Что гном делает от настроения: шутит, ворчит, ленится, срывается
function mdBehave(u, M, now, el, G) {
  const ok = interruptible(u);
  // реплика: чаще всего про самую весомую причину
  if (now >= M.qT && (M.m >= MD.GOOD || M.m <= MD.BAD) && now >= G.quipAt) {
    M.qT = now + 55 + Math.random() * 80;
    const good = M.m >= MD.GOOD;
    const T = good ? MD_GOOD_Q : MD_BAD_Q;
    let line = null;
    for (const r of M.r) {
      if (good ? r[1] <= 0 : r[1] >= 0) continue;
      const k = r[0] === 'rest' || r[0] === 'fun' || r[0] === 'soc' || r[0] === 'smoke' || r[0] === 'food' ? r[0] : r[0] === 'rain' || r[0] === 'cold' ? 'cozy' : r[0] === 'dark' || r[0] === 'evil' ? 'safe' : r[0];
      if (T[k]) { line = mdPick(T[k]); break; }
    }
    if (!line || Math.random() < 0.3) line = mdPick(T._);
    G.quipAt = now + MD.QUIP_GAP;
    mdStat().quips++;
    floater(u.x, u.y - 1.5, line, good ? '#ffe9a0' : '#c8b8a0');
  }
  if (!ok) return;
  // лень: на ходу замирает — «перекур — святое»
  if (M.m <= MD.BAD && u.action && u.action.walk && Math.random() < el * 0.004 * (M.m <= MD.CRIT ? 2 : 1)) {
    u.pauseUntil = now + 2 + Math.random() * 3;
    mdStat().slacks++;
    return;
  }
  // сон на лавочке: валится с ног — присядет, если есть где
  if (M.rest < 0.3 && now >= M.bT) {
    M.bT = now + 120;
    const bench = freeBench(u, 10);
    if (bench) {
      mdStat().rests++;
      startBreak(u, 'rest', null);
      u.proc = mdRestGen(u, bench);
      return;
    }
  }
  // срыв
  if (M.low >= MD.LOW_BREAK && now >= M.cool && !festOn()) {
    M.cool = now + MD.BREAK_CD[0] + Math.random() * (MD.BREAK_CD[1] - MD.BREAK_CD[0]);
    mdBreak(u, M, now, G);
  }
}

function* mdRestGen(u, bench) {
  yield* benchGen(u, bench);
  mdBump(u, 'rest', 0.25);
  moodPoke(u, 'cosy', 3, 60);
}

// ---------- Срывы ----------

function mdPeopleFor(u) {
  return Game.units.filter(o => o !== u && mdOn(o) && interruptible(o) && Math.hypot(o.x - u.x, o.y - u.y) < 9);
}

function mdBreak(u, M, now, G) {
  const st = mdStat();
  const inn = Game.buildings.filter(b => b.type === 'inn' && b.state === 'done' && !b.removed && b.stock.beer - b.reserved.beer > 0)
    .sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0];
  const foes = now >= G.fightAt ? mdPeopleFor(u) : [];
  // что сильнее давит — то и толкает на срыв: голод и скука — драться, одиночество — пить, усталость — бросить работу
  const top = (M.r.find(r => r[1] < 0) || ['x'])[0];
  const w = { drink: inn ? 4 + (top === 'soc' ? 3 : 0) : 0, fight: foes.length ? 2.5 + (top === 'food' || top === 'fun' ? 2 : 0) : 0, sulk: 3 + (top === 'rest' ? 3 : 0) };
  const sum = w.drink + w.fight + w.sulk;
  let r = Math.random() * sum, pick = 'sulk';
  for (const k of ['drink', 'fight', 'sulk']) { if ((r -= w[k]) < 0) { pick = k; break; } }
  const name = UNIT_TYPES[u.type].name;
  if (pick === 'fight') {
    const foe = foes.sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0];
    if (mdFight(u, foe)) { G.fightAt = now + MD.FIGHT_GAP; st.fights++; floater(u.x, u.y - 1.5, mdPick(MD_BREAK_Q.fight), '#ff9a70'); return; }
    pick = inn ? 'drink' : 'sulk';
  }
  if (pick === 'drink' && inn) {
    st.drinks++;
    floater(u.x, u.y - 1.5, mdPick(MD_BREAK_Q.drink), '#ffb890');
    mdNote(u, G, `${name} бросил всё и пошёл в трактир заливать тоску`);
    startBreak(u, 'rage', null);
    u.proc = mdDrinkGen(u, inn);
    return;
  }
  st.sulks++;
  floater(u.x, u.y - 1.5, mdPick(MD_BREAK_Q.sulk), '#ffb890');
  mdNote(u, G, `${name} бросил работу и обиженно отошёл в сторонку`);
  startBreak(u, 'sulk', null);
  u.proc = mdSulkGen(u);
}

// В журнал — всегда, во всплывашку — не чаще раза в 20 с (иначе заспамит)
function mdNote(u, G, text) {
  logEvent('people', text, u.x, u.y);
  if (Game.time - G.toastAt > 20) { G.toastAt = Game.time; toast(text); }
}

function* mdDrinkGen(u, inn) {
  const ok = yield { walk: [inn.doorX, inn.doorY] };
  if (!ok || inn.removed) return;
  yield { enter: inn };
  yield { wait: 3.5 };
  if (!inn.removed) {
    const mug = inn.stock.darkbeer - inn.reserved.darkbeer > 0 && Math.random() < 0.4 ? 'darkbeer' : 'beer';
    if (inn.stock[mug] - inn.reserved[mug] > 0) {
      inn.stock[mug]--;
      moodPoke(u, 'beer', 12, 150);
      mdBump(u, 'soc', 0.4); mdBump(u, 'fun', 0.2);
      const M = mdOf(u); M.low = 0; M.m = Math.min(100, M.m + 12);
      if (Math.random() < Math.min(0.9, DRUNK_CHANCE * (mug === 'darkbeer' ? 2 : 1) * 0.7)) u.drunkAt = Game.time + 3 + Math.random() * 9;   // тоска — плохой закусон
    }
  }
  yield { leave: true };
}

function* mdSulkGen(u) {
  const bench = freeBench(u, 9);
  if (bench) { yield* benchGen(u, bench); yield { wait: 10 + Math.random() * 12 }; }
  else yield { wait: 22 + Math.random() * 30, anim: u.smoker ? 'smoke' : undefined };
  const M = mdOf(u);
  M.low = 0; M.m = Math.min(100, M.m + 9);
  moodPoke(u, 'sulk', 5, 120);
  mdBump(u, 'rest', 0.2);
}

// Драка двух гномов — настоящая, из brawl.js (кулаки, пинки, бутыль; один бой на деревню за раз)
function mdFight(a, b) {
  if (!b || !interruptible(b) || typeof brawlGather !== 'function' || Game.brawl || festThreat()) return false;
  brawlGather([a, b], 'mood');
  return !!Game.brawl;
}

// Уходит насовсем: идёт к краю карты. Потери деревни это не «гибель»: призраки не заводятся
function mdLeave(u, G) {
  const st = mdStat();
  const name = UNIT_TYPES[u.type].name;
  floater(u.x, u.y - 1.5, mdPick(MD_BREAK_Q.leave), '#ffb890');
  mdNote(u, G, `${name} собрал узелок и ушёл из деревни`);
  startBreak(u, 'leave', null);
  u.proc = mdLeaveGen(u, st);
}

function* mdLeaveGen(u, st) {
  const dx = u.x < MAP_W / 2 ? 1 : -1, ex = dx > 0 ? MAP_W - 2 : 1;
  let ok = true;
  for (let k = 0; k < 24 && ok; k++) {
    const x = mdClamp(Math.floor(u.x + dx * 12), 1, MAP_W - 2), y = Math.floor(u.y);
    const s = randomFreeNear(x, y, 0, 4, (xx, yy) => isWalkable(xx, yy) && !World.bmap[idx(xx, yy)]);
    if (!s) break;
    ok = yield { walk: s, offroad: true };
    const M = mdOf(u);
    if (M.m > 30) return;                        // отлегло — вернулся (дошёл бы кто-то с пивом)
    if (Math.abs(u.x - ex) < 3) break;
  }
  if (!ok || Math.abs(u.x - ex) > 8) return;      // не дошёл до края — передумал
  const lost = Game.lostGnomes;
  removeUnit(u);
  Game.lostGnomes = lost;
  st.left++;
}

// ---------- Деревня: хандра и подъём духа ----------

function mdVillage() {
  const us = Game.units.filter(u => mdOn(u) && u.md);
  let sum = 0, good = 0, bad = 0, crit = 0;
  for (const u of us) { const m = u.md.m; sum += m; if (m >= MD.GOOD) good++; if (m <= MD.BAD) bad++; if (m <= MD.CRIT) crit++; }
  return { n: us.length, avg: us.length ? sum / us.length : 50, good, bad, crit };
}

function mdVillageTick(now) {
  const G = mdG(), V = mdVillage();
  if ((Game.lostGnomes || 0) > (G.lostSeen || 0)) G.lostAt = now;
  G.lostSeen = Game.lostGnomes || 0;
  if (V.n < 6) { G.lowSince = G.hiSince = 0; return V; }
  // хандра
  if (V.bad / V.n >= MD.GLOOM_FRAC) G.lowSince = G.lowSince || now; else G.lowSince = 0;
  if (G.lowSince && now - G.lowSince >= MD.GLOOM_SEC && now >= G.nextGloom && G.gloom <= now && !festOn()) {
    G.gloom = now + MD.GLOOM_LEN;
    G.nextGloom = now + MD.GLOOM_CD;
    G.lowSince = 0;
    mdStat().gloom++;
    toast('Хандра на всю деревню: гномы ворчат хором и работают вполсилы. Налейте им пива или устройте праздник — иначе в ход пойдут кулаки.');
    logEvent('people', `Деревню накрыла хандра: тоскует ${V.bad} из ${V.n}`);
    for (const u of Game.units) if (u.md && mdOn(u) && !u.inside && Math.random() < 0.3) floater(u.x, u.y - 1.5, mdPick(MD_BAD_Q.gloom), '#a8b0c0');
  }
  if (G.gloom > now && festOn()) { G.gloom = 0; logEvent('people', 'Праздник разогнал хандру'); }
  // подъём духа
  if (V.good / V.n >= 0.5) G.hiSince = G.hiSince || now; else G.hiSince = 0;
  if (G.hiSince && now - G.hiSince >= 60 && now >= (G.nextCheer || 0) && G.cheer <= now && G.gloom <= now) {
    G.cheer = now + 90;
    G.nextCheer = now + 600;
    G.hiSince = 0;
    mdStat().cheer++;
    toast('Подъём духа: гномы работают с огоньком. Подозрительно, но пользуйтесь, пока не передумали!');
    logEvent('people', 'В деревне подъём духа: работа спорится');
  }
  // уход: только если деревня в тоске, гном на дне давно, а людей достаточно
  if (V.crit >= 1 && V.n >= 8 && now >= (G.nextLeave || 0)) {
    for (const u of Game.units) {
      if (!u.md || !mdOn(u) || u.md.low < MD.LEAVE_LOW || u.md.m > 12 || !interruptible(u) || festOn()) continue;
      G.nextLeave = now + 240;
      mdLeave(u, G);
      break;
    }
  }
  return V;
}

// ---------- Такт ----------

const MDS = { acc: 0, phase: 0, vacc: 0, hooked: false };

function moodTick(dt) {
  if (typeof isMirror === 'function' && isMirror()) return;          // клиент кооператива не считает: данные приходят с сервера
  mdHook();
  MDS.acc += dt;
  if (MDS.acc < MD.STEP / 4) return;
  MDS.acc = 0;
  const now = Game.time, ph = MDS.phase = (MDS.phase + 1) & 3;
  for (const u of Game.units) {
    if (!mdOn(u)) { if (u.mdMul) u.mdMul = 0; continue; }
    if ((u.id & 3) !== ph) continue;
    mdUpdate(u, now);
    if (Game.moodSel && u.md) {
      const e = Game.moodSel.get(u.id);
      if (e > now) u.mdr = { m: Math.round(u.md.m), x: Math.round((u.mdMul || 1) * 100), n: u.md.n, r: u.md.r.slice(0, 7).map(r => r[0] + ':' + r[1]) };
      else { u.mdr = undefined; if (e !== undefined) Game.moodSel.delete(u.id); }
    }
  }
  MDS.vacc++;
  if (MDS.vacc >= 4) { MDS.vacc = 0; mdVillageTick(now); }
}

// ---------- Подключение к остальным системам ----------

function mdHook() {
  if (MDS.hooked) return;
  MDS.hooked = true;
  // обед: пиво и компания вместо вечной работы; всухомятку — обидно
  const _eat = eatGen;
  eatGen = function* (u, inn) {
    const beer0 = inn.stock.beer + inn.stock.darkbeer;
    yield* _eat(u, inn);
    if (!mdOn(u) || inn.removed) return;
    if (isStoreB(inn)) { moodPoke(u, 'dry', -4, 90); return; }
    mdBump(u, 'rest', 0.12); mdBump(u, 'soc', 0.15);
    if (inn.def && inn.def.cozy) moodPoke(u, 'cosy', 4, 90);
    if (inn.stock.beer + inn.stock.darkbeer < beer0) { moodPoke(u, 'beer', 9, 150); mdBump(u, 'soc', 0.3); mdBump(u, 'fun', 0.1); }
  };
  const _lg = leisureGen;
  leisureGen = function* (u) { yield* _lg(u); mdBump(u, 'fun', 0.3); mdBump(u, 'soc', 0.05); };
  // итог драки (и с праздника, и от тоски): победитель выпустил пар, проигравший получил по шапке
  if (typeof brawlEnd === 'function') {
    const _be = brawlEnd;
    brawlEnd = function (B, why) {
      _be(B, why);
      if (why !== 'done') return;
      B.fs.forEach((u, k) => {
        if (!mdOn(u)) return;
        const M = mdOf(u);
        M.low = 0; mdBump(u, 'fun', 0.15);
        if (k === B.lose) { moodPoke(u, 'beaten', -8, 140); M.m = Math.max(0, M.m - 6); } else { moodPoke(u, 'vent', 7, 120); M.m = Math.min(100, M.m + 6); }
      });
    };
  }
  const _hf = highFive;
  highFive = function (a, b) { _hf(a, b); for (const x of [a, b]) { moodPoke(x, 'five', 4, 70); mdBump(x, 'soc', 0.1); mdBump(x, 'fun', 0.05); } };
  if (typeof COOP_UNIT_EX !== 'undefined' && !COOP_UNIT_EX.includes('mdr')) COOP_UNIT_EX.push('mdr');
  if (typeof coopCmd === 'function') {
    const _cc = coopCmd;
    coopCmd = function (name, json, admin) {
      let m = null;
      try { m = JSON.parse(json); } catch (e) { return; }
      if (m && m.t === 'mpick') {
        if (Number.isInteger(m.id)) { (Game.moodSel || (Game.moodSel = new Map())).set(m.id, Game.time + 10); if (Game.moodSel.size > 40) Game.moodSel.delete(Game.moodSel.keys().next().value); }
        return;
      }
      return _cc(name, json, admin);
    };
  }
}

// ---------- Сохранение ----------

function mdPackUnit(u) {
  const M = u.md;
  if (!M) return undefined;
  const t = v => Math.round(v * 100) / 100;
  return [t(M.m), t(M.rest), t(M.fun), t(M.soc), t(M.sm), M.ev.map(e => [e[0], e[1], e[2]])];
}
function mdApplyUnit(u, a) {
  if (!Array.isArray(a) || a.length < 5 || !mdOn(u)) return;
  const M = mdNew(u);
  M.m = +a[0] || 50; M.rest = +a[1]; M.fun = +a[2]; M.soc = +a[3]; M.sm = +a[4];
  M.ev = Array.isArray(a[5]) ? a[5].filter(e => Array.isArray(e) && typeof e[0] === 'string' && MD_WHY[e[0]]).map(e => [e[0], e[1] | 0, +e[2] || 0]) : [];
  for (const k of ['m', 'rest', 'fun', 'soc', 'sm']) if (!isFinite(M[k])) M[k] = k === 'm' ? 50 : 0.5;
  u.md = M;
}

// ---------- Карточка гнома ----------

function mdFaceFor(m) { return m >= 80 ? 'Счастлив' : m >= MD.GOOD ? 'Бодр' : m > 55 ? 'Доволен' : m > 45 ? 'Так себе' : m > MD.BAD ? 'Хмурый' : m > MD.CRIT ? 'Ворчит' : 'На грани'; }
function mdCol(m) { return m >= MD.GOOD ? '#7cc860' : m > 55 ? '#b0cc58' : m > 45 ? '#e8cc58' : m > MD.BAD ? '#e8a448' : '#e06a4a'; }

function mdCardData(u) {
  if (typeof isMirror === 'function' && isMirror()) {
    const d = u.mdr;
    return d ? { m: d.m, x: d.x, n: d.n, r: (d.r || []).map(s => { const i = s.lastIndexOf(':'); return [s.slice(0, i), +s.slice(i + 1)]; }) } : null;
  }
  const M = u.md;
  return M ? { m: Math.round(M.m), x: Math.round((u.mdMul || 1) * 100), n: M.n, r: M.r } : null;
}

function mdCardHTML(u) {
  const D = mdCardData(u);
  const nm = UNIT_TYPES[u.type].name;
  if (!D) return `<div class="mc-h"><b>${nm}</b></div><div class="irow small muted">Присматриваемся к настроению…</div><button class="hc-x" title="Закрыть (Esc)">×</button>`;
  const need = D.n.map((v, i) => i === 6 && !u.smoker && v >= 100 ? '' :
    `<div class="mc-n" title="${MD_NEED_NAMES[i]}: ${v}%"><span>${MD_NEED_NAMES[i]}</span><div class="hp-bar"><i style="width:${v}%;background:${v > 60 ? '#7cc860' : v > 30 ? '#e8cc58' : '#e06a4a'}"></i></div></div>`).join('');
  const why = D.r.filter(r => r[1]).slice(0, 8).map(r => `<div class="mc-r ${r[1] > 0 ? 'p' : 'n'}"><span>${MD_SIGN(r[0])[r[1] > 0 ? 0 : 1] || r[0]}</span><b>${r[1] > 0 ? '+' : '−'}${Math.abs(r[1])}</b></div>`).join('');
  const eff = D.x > 103 ? `работает бодрее: +${D.x - 100}%` : D.x < 97 ? `ленится: ${D.x - 100}%` : 'работает в обычном темпе';
  return `<div class="mc-h"><b>${nm}</b><span style="color:${mdCol(D.m)}">${mdFaceFor(D.m)}</span></div>
    <div class="mc-bar"><i style="width:${D.m}%;background:${mdCol(D.m)}"></i><em>${D.m}</em></div>
    <div class="irow small muted">${eff}</div>
    <div class="mc-t">Потребности</div><div class="mc-ns">${need}</div>
    <div class="mc-t">Почему так</div>${why || '<div class="irow small muted">Ничего особенного.</div>'}
    <button class="hc-x" title="Закрыть (Esc)">×</button>`;
}

function mdCardUpdate() {
  if (typeof document === 'undefined' || !document.getElementById || !document.getElementById('view')) return;
  let card = document.getElementById('mood-card');
  if (!card) {
    card = document.createElement('div'); card.id = 'mood-card';
    document.getElementById('view').appendChild(card);
    card.addEventListener('click', e => { if (e.target.closest('.hc-x')) { Game.selUnit = null; updateUI(true); } });
    const st = document.createElement('style');
    st.textContent = `#mood-card{position:absolute;top:58px;right:10px;width:236px;z-index:6;padding:8px 10px 9px;background:rgba(26,19,13,.94);color:#e8dcc0;border:1px solid #b8902c;border-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,.6);font-size:12px;display:none}
    #mood-card .hc-x{position:absolute;top:3px;right:5px;padding:0 6px;font-size:13px;line-height:18px}
    #mood-card .mc-h{display:flex;gap:8px;align-items:baseline;margin:0 18px 5px 0;font-size:13px}#mood-card .mc-h span{margin-left:auto;font-size:12px}
    #mood-card .mc-bar{position:relative;height:12px;background:#2a2014;border-radius:3px;overflow:hidden;margin-bottom:3px}#mood-card .mc-bar i{display:block;height:100%}
    #mood-card .mc-bar em{position:absolute;inset:0;text-align:center;font-style:normal;font-size:10px;line-height:12px;color:#fff4d0;text-shadow:0 0 2px #000}
    #mood-card .mc-t{margin:7px 0 3px;font-size:10px;letter-spacing:.6px;text-transform:uppercase;color:#b8902c}
    #mood-card .mc-ns{display:grid;grid-template-columns:1fr 1fr;gap:2px 10px}
    #mood-card .mc-n{display:flex;align-items:center;gap:4px;font-size:11px}#mood-card .mc-n span{width:56px;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #mood-card .mc-r{display:flex;justify-content:space-between;gap:6px;padding:1px 0;border-bottom:1px solid rgba(255,230,160,.07)}
    #mood-card .mc-r.p b{color:#8fd070}#mood-card .mc-r.n b{color:#ec8060}
    body.mobile #mood-card{top:calc(92px + env(safe-area-inset-top));right:auto;left:6px;width:min(280px,calc(100vw - 12px));max-height:min(46vh,calc(100dvh - 150px));overflow-y:auto}`;
    document.head.appendChild(st);
  }
  const u = Game.selUnit;
  if (!u || u.dead || u === Game.hero || u.rec || u.gx || !isPerson(u) || u.type === 'hero' || u.type === 'carter') { card.style.display = 'none'; return; }
  if (typeof isMirror === 'function' && isMirror() && Game.time >= (MDS.pickAt || 0)) { MDS.pickAt = Game.time + 4; coopSend({ t: 'mpick', id: u.id }); }
  const html = mdCardHTML(u);
  if (card.dataset.h !== html) { card.dataset.h = html; card.innerHTML = html; }
  card.style.display = 'block';
}

function mdUnitAt(t) {
  let near = null, bd = 0.7;
  for (const u of Game.units) {
    if (u.inside || u.dead || u === Game.hero || u.rec || u.gx || u.gm || !isPerson(u) || u.type === 'hero' || u.type === 'carter' || u.owner) continue;
    const d = Math.hypot(u.x - (t[0] + 0.5), u.y - (t[1] + 0.5));
    if (d < bd) { bd = d; near = u; }
  }
  return near;
}

function initMoodUI() {
  if (MDS.ui) return;
  MDS.ui = true;
  if (typeof COOP_UNIT_EX !== 'undefined' && !COOP_UNIT_EX.includes('mdr')) COOP_UNIT_EX.push('mdr');   // клиент кооператива принимает данные выбранного гнома
  const _click = onLeftClickTile;
  onLeftClickTile = function (t) {
    if (!Game.tool && inb(t[0], t[1]) && !(Game.selUnit && (Game.selUnit === Game.hero || Game.selUnit.rec || Game.selUnit.gx))) {
      const u = mdUnitAt(t);
      if (u) { Game.selected = null; Game.selUnit = u; updateUI(true); return; }
    }
    _click(t);
  };
  const _upd = updateUI;
  updateUI = function (force) { _upd(force); mdCardUpdate(); };
  const _ov = drawOverlay;
  drawOverlay = function (c) {
    _ov(c);
    const u = Game.selUnit;
    if (!u || u.dead || u.inside || u === Game.hero || u.rec || u.gx || !isPerson(u) || u.type === 'hero') return;
    const D = mdCardData(u), col = D ? mdCol(D.m) : '#e8dcc0';
    c.strokeStyle = col; c.globalAlpha = 0.7 + 0.3 * Math.sin(Game.time * 6); c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(u.x * TILE, u.y * TILE + 6, 10, 5, 0, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1;
  };
  window.addEventListener('keydown', e => { if (e.code === 'Escape' && Game.selUnit && mdCardOn()) { Game.selUnit = null; updateUI(true); } });
  // сводка в панели «Жители»
  const _ph = peopleHTML;
  peopleHTML = function () {
    let h = _ph();
    if (typeof isMirror === 'function' && isMirror()) return h;
    const V = mdVillage();
    if (!V.n) return h;
    const row = `<div class="stat-row${V.avg < 45 ? ' warn' : ''}"><b>Настроение</b><span class="v" style="color:${mdCol(V.avg)}">${Math.round(V.avg)} · ${mdFaceFor(V.avg).toLowerCase()}</span></div>` +
      (V.bad ? `<div class="stat-row warn">Ворчат и ленятся: ${V.bad}</div>` : '') + (V.good ? `<div class="stat-row muted">Бодры и шутят: ${V.good}</div>` : '');
    const i = h.indexOf('</div>');
    return i >= 0 ? h.slice(0, i + 6) + row + h.slice(i + 6) : h + row;
  };
}
function mdCardOn() { const u = Game.selUnit; return !!(u && u !== Game.hero && !u.rec && !u.gx && isPerson(u) && u.type !== 'hero'); }

// ---------- Врезка в игру ----------

{
  const _step = step;
  step = function (dt) { _step(dt); moodTick(dt); };

  const _ser = serializeGame;
  serializeGame = function () {
    const s = _ser();
    Game.units.forEach((u, k) => { const d = s.units[k], p = d && mdPackUnit(u); if (p) d.md = p; });
    const G = Game.mood;
    if (G) s.mood = { g: +G.gloom.toFixed(1), c: +G.cheer.toFixed(1), ng: +G.nextGloom.toFixed(1), nc: +(G.nextCheer || 0).toFixed(1), fa: +G.fightAt.toFixed(1), la: +(G.lostAt || 0).toFixed(1), ls: G.lostSeen || 0 };
    return s;
  };

  const _apply = applySave;
  applySave = function (s) {
    _apply(s);
    (s.units || []).forEach((d, k) => { const u = Game.units[k]; if (u && d.md) mdApplyUnit(u, d.md); });
    const m = s.mood;
    Game.mood = null; Game.moodStat = null;
    if (m) { const G = mdG(); G.gloom = m.g || 0; G.cheer = m.c || 0; G.nextGloom = m.ng || 0; G.nextCheer = m.nc || 0; G.fightAt = m.fa || 0; G.lostAt = m.la || 0; G.lostSeen = m.ls || 0; }
  };

  const _reset = resetGameState;
  resetGameState = function () { _reset(); Game.mood = null; Game.moodStat = null; Game.moodSel = null; };

  const _start = startGame;
  startGame = function () { _start(); initMoodUI(); updateUI(true); };
}
