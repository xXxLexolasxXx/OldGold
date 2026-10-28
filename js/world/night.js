'use strict';
// День и ночь. Днём гномы шагают бодрее, ночью — медленнее, и на деревню ложится туман.
// С темнотой каждый достаёт фонарь (в начале каждой ночи — новый). Упал — фонарь вдребезги,
// и до рассвета гном без света теряется в тумане, пока его не найдёт кто-то с фонарём.
// Уличные фонари светят слабо, но помогают. А ещё ночью оживают деревья: вылезают из земли
// на корнях-ногах, бродят у своего места и пугают гномов. Увидевший такое дерево застывает
// от ужаса, бросает груз и мчится в трактир или берётся за топор: срубит — останется бревно
// для дровосека, нет — дерево утащит его в туман навсегда.

// Сутки: день → вечер (темнеет, горят фонари, у деревьев загораются глаза) →
// сумерки → долгая ночь с туманом → рассвет.
const DAY_LEN = 220;           // ясный день, с
const EVE_LEN = 80;            // вечер
const DUSK_LEN = 20;           // сумерки: из вечера в ночь
const NIGHT_LEN = 220;         // ночь — столько же, сколько день
const DAWN_LEN = 25;           // рассвет
const EVE_START = DAY_LEN, NIGHT_START = DAY_LEN + EVE_LEN + DUSK_LEN;
const CYCLE = NIGHT_START + NIGHT_LEN + DAWN_LEN;
const EVE_DARK = 0.35;         // насколько темно вечером
const ENT_SEE = 5;             // с какого расстояния гном замечает ходячее дерево
const ENT_ROAM = 4;            // насколько дерево отходит от своего места

// Каждая пятая ночь (5, 10, 15…) в полтора раза длиннее обычной
const LONG_EVERY = 5, LONG_EXTRA = NIGHT_LEN * 0.5;
const CYCLE_BLOCK = CYCLE * LONG_EVERY + LONG_EXTRA;
// какие сейчас сутки: k — номер, p — секунда внутри суток, nl — длина ночи в них
function cycleAt(t) {
  // длина ночи зависит от сложности (Game.diff); у «Обычного» множитель 1 — всё как раньше
  const nl0 = NIGHT_LEN * dif().nightLen, cyc = NIGHT_START + nl0 + DAWN_LEN, extra = nl0 * 0.5, block = cyc * LONG_EVERY + extra;
  const b = Math.floor(t / block), r = t - b * block, normal = cyc * (LONG_EVERY - 1);
  if (r < normal) { const k = Math.floor(r / cyc); return { k: b * LONG_EVERY + k, p: r - k * cyc, nl: nl0 }; }
  return { k: b * LONG_EVERY + LONG_EVERY - 1, p: r - normal, nl: nl0 + extra };
}

// 0 — ясный день, 1 — глубокая ночь
function nightAmt(t = Game.time) {
  const { p, nl } = cycleAt(t);
  if (p < EVE_START) return 0;
  if (p < EVE_START + EVE_LEN) { const q = (p - EVE_START) / EVE_LEN; return EVE_DARK * q * q * (3 - 2 * q); }
  if (p < NIGHT_START) return EVE_DARK + (1 - EVE_DARK) * (p - EVE_START - EVE_LEN) / DUSK_LEN;
  if (p < NIGHT_START + nl) return 1;
  return Math.max(0, 1 - (p - NIGHT_START - nl) / DAWN_LEN);
}
function isNightNow() { return nightAmt() >= 0.5; }
// вечер и ночь: горят фонари
function isEveningNow() { return cycleAt(Game.time).p >= EVE_START && nightAmt() > 0.02; }
// фонари (уличные и в руках) горят только когда уже темнеет: не днём и не на светлом рассвете
const LAMP_ON = 0.05;
function lampsOn() { return cycleAt(Game.time).p >= EVE_START && nightAmt() >= LAMP_ON; }
function lanternLit(u) { return !!u.lantern && lampsOn(); }
// рассвет: ночь кончилась, но ещё не совсем светло (вечер по isEveningNow тянется и сюда)
function isDawnNow() { const c = cycleAt(Game.time); return c.p >= NIGHT_START + c.nl; }
// номер текущих «суток тьмы»: одинаков от начала вечера до рассвета
function nightIndex() { const c = cycleAt(Game.time); return c.p >= EVE_START ? c.k : c.k - 1; }
// идёт ли сейчас (или готовится) долгая ночь
function isLongNight() { return (nightIndex() + 1) % LONG_EVERY === 0; }
// туман густеет только с наступлением ночи
function fogAmt() { return Math.max(0, (nightAmt() - EVE_DARK) / (1 - EVE_DARK)); }
// днём на треть бодрее, ночью заметно медленнее
function daySpeedMul() { return 1.15 - 0.4 * nightAmt(); }

// ---------- Фонари и потерявшиеся ----------

// Упал (столкнулся, свалился без сил, уснул пьяным) — фонарь разбит до конца ночи
function lanternFall(u) {
  if (!u.lantern || !isNightNow()) return;
  u.lantern = false;
  floater(u.x, u.y - 0.8, 'Дзынь!', '#ffd880');
  logEvent('night', `${UNIT_TYPES[u.type].name} упал и разбил фонарь`, u.x, u.y);
}

function* lostGen(u) {
  u.lostSince = Game.time;
  floater(u.x, u.y - 1, '?', '#d8e0ff');
  logEvent('night', `${UNIT_TYPES[u.type].name} заблудился в тумане`, u.x, u.y);
  while (isNightNow() && !u.rescued && !u.dead) {
    // голодный идёт на запах еды из трактира — и выходит к людям
    if (u.food < HUNGRY && Game.time - u.lostSince > 20) { u.rescued = true; floater(u.x, u.y - 1, 'Пахнет хлебом!', '#ffe7a0'); break; }
    const s = randomFreeNear(Math.floor(u.x), Math.floor(u.y), 1, 2.5, (x, y) => isWalkable(x, y) && !World.bmap[idx(x, y)]);
    if (s) yield { walk: s, offroad: true };
    yield { wait: 1.2 + Math.random() * 2, anim: 'lost' };
  }
}

function* rescueGen(r, l) {
  for (let k = 0; k < 5 && !l.dead && !l.rescued && isNightNow(); k++) {
    if (Math.hypot(l.x - r.x, l.y - r.y) < 1.6) break;
    const ok = yield { walk: [Math.floor(l.x), Math.floor(l.y)], offroad: true };
    if (!ok) break;
  }
  if (!l.dead && !l.rescued && Math.hypot(l.x - r.x, l.y - r.y) < 2) {
    l.rescued = true;
    r.face = l.x > r.x ? 1 : -1; r.vdir = 'E';
    r.gest = 'wave'; r.gestUntil = Game.time + 1.5;
    floater(r.x, r.y - 1, 'Сюда, на свет!', '#ffe7a0');
    logEvent('night', `${UNIT_TYPES[r.type].name} с фонарём вывел заблудившегося`, l.x, l.y);
    sfxUnit(r, 'hey');
    yield { wait: 1.2 };
  }
  l.rescuer = 0;
}

function rescuerOf(l) {
  const r = l.rescuer && Game.unitMap.get(l.rescuer);
  return r && !r.dead && r.brk && r.brk.kind === 'rescue' ? r : null;
}

// ---------- Испуг ----------

function* freezeGen(u) {
  floater(u.x, u.y - 1, 'Ой!', '#ffe0e0');
  yield { wait: 3 + Math.random() * 3, anim: 'freeze' };
}

function* fleeGen(u) {
  dropLoad(u);
  floater(u.x, u.y - 1, 'А-а-а!', '#ffe0e0');
  u.panicUntil = Game.time + 30;
  let inn = null, bd = 1e9;
  for (const b of Game.buildings) {
    if (b.state !== 'done' || (b.type !== 'inn' && !(b.isStore() && !b.isPile))) continue;
    const d = Math.abs(b.doorX - u.x) + Math.abs(b.doorY - u.y) + (b.type === 'inn' ? 0 : 12);
    if (d < bd) { bd = d; inn = b; }
  }
  if (inn) {
    const ok = yield { walk: [inn.doorX, inn.doorY], offroad: true };
    if (ok && !inn.removed) {
      yield { enter: inn };
      u.panicUntil = 0;
      yield { wait: 8 + Math.random() * 6 };       // отсиживается, пока не отпустит
      yield { leave: true };
    }
  } else yield { wait: 3 };
  u.panicUntil = 0;
}

function* entFightGen(u, e) {   // не fightGen: так называется бой гильдий (guilds.js), и он затирал эту
  floater(u.x, u.y - 1, 'За бороду!', '#ffd0a0');
  sfxUnit(u, 'grr');
  if (!e.fighters) e.fighters = [u];
  const mine = e.fighters.indexOf(u);
  const side = mine % 2 ? 1 : -1;                       // бойцы встают по обе стороны нечисти
  const tx = Math.floor(e.x + side * 0.9), ty = Math.floor(e.y + (mine > 1 ? 0.6 : 0));
  if (isWalkable(tx, ty) && Math.hypot(e.x - u.x, e.y - u.y) > 1.2) yield { walk: [tx, ty], offroad: true };
  if (e.state !== 'fight') { u.fighting = null; return; }
  const faceOff = () => { u.face = e.x > u.x ? 1 : -1; u.vdir = 'E'; };
  faceOff();
  if (e.fightT === undefined) { e.fightT = Game.time; e.t = 0; e.face = -u.face; }
  u.fighting = e;
  // три схватки: боец рубит — летят осколки; нечисть замахивается — боец пригибается
  for (let k = 0; k < 3; k++) {
    faceOff();
    yield { wait: 0.9, anim: 'chop' };
    if (e.state !== 'fight') { u.fighting = null; return; }
    entHit(e, u, false);
    e.atk = Game.time;                         // ответный удар
    yield { wait: 0.35 };
    yield { wait: 0.45, anim: 'duck' };        // пригнулся — удар прошёл над колпаком
    entSlamFx(e, u);
  }
  // решает первый из бойцов, остальные ждут исхода
  if (e.state === 'fight' && !e.resolved && e.fighters[0] === u) {
    faceOff();
    yield { wait: 0.9, anim: 'chop' };
    resolveFight(e);
  }
  u.fighting = null;
  for (let k = 0; k < 40 && e.state === 'fight'; k++) yield { wait: 0.3 };
  if (u.dead) return;
  if (e.state === 'dying' || e.state === 'gone') {
    yield { wait: 2.2 };                       // смотрит, как оно валится
    if (u.dead) return;
    u.gest = 'fist'; u.gestUntil = Game.time + 2.5;
    floater(u.x, u.y - 1.2, ['Ура!', 'Так вам!', 'Получила!'][Math.floor(Math.random() * 3)], '#fff2a0');
    sfxUnit(u, 'hey');
    yield { wait: 2.4 };
  } else if (e.escaped === u) {
    // уцелел: отлетел, лежит, потом встаёт
    yield { wait: 1.5, anim: 'knocked' };
    floater(u.x, u.y - 1.2, 'Жив…', '#e8e0c0');
    yield { wait: 1 };
  }
}

// Исход схватки. Один гном почти наверняка погибает (но может победить или уцелеть),
// группа убивает нечисть вместе; редко нечисть разделывается со всеми бойцами сразу.
function resolveFight(e) {
  const fs = e.fighters.filter(u => !u.dead && u.brk && u.brk.kind === 'fight');
  e.resolved = true;
  if (!fs.length) { e.state = 'walk'; e.foe = null; return; }
  const n = fs.length;
  let outcome;
  if (e.forceWin !== undefined) outcome = e.forceWin ? 'win' : 'lose';
  else if (n === 1) { const r = Math.random(), w = 0.2 / Math.sqrt(nightDiff()); outcome = r < w ? 'win' : r < w + 0.15 ? 'escape' : 'lose'; }
  else {
    // с каждой ночью нечисть крепче: группе труднее победить, чаще всех расшвыривает
    const d = nightDiff(), r = Math.random(), pWipe = Math.min(0.2, 0.06 * Math.sqrt(d)), pWin = Math.min(0.94, 0.5 + 0.15 * n) / Math.pow(d, 0.35);
    outcome = r < pWipe ? 'wipe' : r < pWipe + (1 - pWipe) * pWin ? 'win' : 'lose';
  }
  if (dif().noLoss && (outcome === 'lose' || outcome === 'wipe')) outcome = n === 1 ? 'escape' : 'win';   // «Спокойный»: гномы не гибнут
  // потолок потерь за ночь (grab.js nightTakeOk): сверх него нечисть не уносит, а расшвыривает — деревня не вымирает за ночь
  if ((outcome === 'lose' || outcome === 'wipe') && !nightTakeOk()) outcome = 'escape';
  // героя нечисть не уносит: он отлетает и встаёт (иначе игрок теряет своего героя, например посреди подъёма к шпилю)
  if ((outcome === 'lose' || outcome === 'wipe') && fs[0].hero) outcome = 'escape';
  e.foe = null;
  if (outcome === 'win') {
    entFell(e, fs[0]);
    if (n > 1) logEvent('tree', `Нечисть одолели вместе: ${n} гномов`, e.x, e.y);
  } else if (outcome === 'escape') {
    e.escaped = fs[0];
    knockBack(fs[0], e); injure(fs[0], 'arm');
    e.state = 'walk'; e.wait = 5; e.fighters = []; e.fightT = undefined; e.resolved = false;
    logEvent('tree', `${UNIT_TYPES[fs[0].type].name} ушёл от нечисти живым`, e.x, e.y);
  } else {
    // нечисть берёт одного; остальных, если они выжили, расшвыривает
    entTakes(e, fs[0]);
    for (const o of fs.slice(1)) {
      if (outcome === 'wipe' && !o.hero) { floater(o.x, o.y - 1, '!', '#ff6040'); fxBurst(o.x * TILE, o.y * TILE - 6, 8, ['#ffc0c0', '#a02818'], 40, 30, 0.7, 1.8, 160); removeUnit(o); }
      else { e.escaped = o; knockBack(o, e); injure(o, Math.random() < 0.5 ? 'leg' : 'arm'); }
    }
    if (outcome === 'wipe') { toast(`${entName(e)} расправилась со всеми, кто осмелился напасть!`); logEvent('tree', `Нечисть перебила всех нападавших: ${n}`, e.x, e.y); }
  }
}

// ---------- Щепки, пыль, листья ----------

function fxBurst(x, y, n, cols, sp, up, life, size, grav = 260) {
  const fx = Game.fx || (Game.fx = []);
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2, v = sp * (0.4 + Math.random() * 0.6);
    fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5 - up * (0.5 + Math.random() * 0.5), g: grav, t: 0, life: life * (0.6 + Math.random() * 0.4), col: cols[k % cols.length], s: size * (0.6 + Math.random() * 0.6) });
  }
}

// удар топором: щепки летят из ствола, дерево вздрагивает
function entHit(e, u, big) {
  e.hitT = Game.time;
  if (e.rock) rockCrack(e);
  const L = ENT_LOOK[entBase(e).kind];
  const { bx, by } = entBase(e);
  fxBurst(bx - e.face * 6, by - 30, big ? 26 : 10, [L.light, L.bark, '#d8b080', L.dark], big ? 110 : 70, 70, 0.7, 2.2);
  if (big) fxBurst(bx, by - 70, 18, [L.crown[0], L.crown[1]], 60, 10, 1.6, 2.4, 40);   // листья осыпаются
  sfxAt('chop', e.x * TILE, e.y * TILE, big ? 1.4 : 1);
  floater(e.x, e.y - 2.4, big ? 'ХРЯСЬ!' : ['Тюк!', 'Хрясь!', 'На!'][Math.floor(Math.random() * 3)], '#e0b882');
}

// ветви бьют в землю — пыль у ног гнома
function entSlamFx(e, u) {
  fxBurst(u.x * TILE, u.y * TILE + 4, 10, ['#8a7a60', '#6a5a44', '#a8987a'], 40, 30, 0.6, 2.4, 60);
  sfxAt('thud', u.x * TILE, u.y * TILE, 0.6);
}

function updateFx(dt) {
  fxTimersTick();
  const fx = Game.fx;
  if (!fx || !fx.length) return;
  for (const p of fx) { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.98; }
  Game.fx = fx.filter(p => p.t < p.life);
}

function drawNightFx(c) {
  const fx = Game.fx;
  if (!fx || !fx.length) return;
  for (const p of fx) {
    c.globalAlpha = Math.max(0, 1 - p.t / p.life);
    c.fillStyle = p.col;
    c.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s * 0.8);
  }
  c.globalAlpha = 1;
}

// ---------- Ходячие деревья ----------

// Нечисть первых четырёх ночей [от, до] на «Обычном» (Спокойный ×0,3, Выживание ×1,5). Было 1–3, 3–5, 5–7, 7–9:
// первая ночь с одним деревом не пугала. Закрытые мягким стартом виды (камни, водяные) уходят в деревья.
const NIGHT_EARLY = [[3, 4], [4, 6], [5, 7], [7, 9]];

// Сколько нечисти выходит за ночь: сначала по нарастающей, в долгую пятую ночь — до 25.
// Виды делят это число случайно: деревья, камни, водяные.
function nightTotal() {
  const n = nightIndex() + 1;
  // до первой долгой ночи нечисти прибывает с каждой ночью (NIGHT_EARLY, «Обычный»)
  const mul = dif().nightN, cnt = k => Math.max(1, Math.round(k * mul));
  if (n < LONG_EVERY) { const [lo, hi] = NIGHT_EARLY[n - 1]; return cnt(lo + Math.floor(Math.random() * (hi - lo + 1))); }
  // дальше — больше с каждой ночью: к 10-й (долгой) — 23–39, к 9-й обычной — 9–15
  const more = 0.7 + 0.3 * nightDiff(n);
  if (n % LONG_EVERY === 0) return cnt((15 + Math.floor(Math.random() * 11)) * more);   // долгая ночь
  return cnt((6 + Math.floor(Math.random() * 5)) * more);                                // обычная
}

// Сложность ночи n (1, 2, …): во сколько раз нечисть крепче, злее и упорнее, чем в первую ночь.
// 1-я — 1, 3-я — 1,3, 5-я — 1,6, 7-я — 2,1, 10-я — 2,9, потолок — 5 (к 18-й ночи).
// От неё зависят: число нечисти и скелетов, их здоровье (сколько ударов держат), сила ответных ударов,
// дальность, на которой они замечают гномов, скорость, частота набегов на здания и исход схваток.
function nightDiff(n = nightIndex() + 1) {
  const k = Math.max(0, n - 1);
  return Math.min(5, 1 + 0.12 * k + 0.01 * k * k) * dif().foe;
}

function spawnEnts() {
  Game.ents = Game.ents || [];
  const people = Game.units.filter(u => isPerson(u));   // и те, кто в домах: нечисть проснётся рядом
  if (!people.length) return;
  const total = nightTotal();
  // случайные доли видов: каждый раз разные пропорции
  const w = [0.15 + Math.random(), 0.15 + Math.random(), 0.15 + Math.random()], sw = w[0] + w[1] + w[2];
  let nT = Math.round(total * w[0] / sw), nR = Math.round(total * w[1] / sw), nW = total - nT - nR;
  nW = Math.max(0, nW);
  // мягкий старт: в первые ночи — деревья (хотя бы одно); камни и водяные подключаются позже (START_GRACE)
  if (!startOpen('rockEnts')) { nT += nR; nR = 0; }
  if (!startOpen('waterEnts')) { nT += nW; nW = 0; }
  if (nT + nR + nW === 0) nT = 1;
  spawnTreeEnts(people, nT);
  spawnRockEnts(nR);
  spawnWaterEnts(people, nW);
  Game.nightEntTotal = Game.ents.length;
}

function spawnTreeEnts(people, want) {
  let made = 0;
  // сперва ищем на опушке, не нашлось — любое лиственное поближе
  for (let tries = 0; tries < 1200 && made < want; tries++) {
    const strict = tries < 800;
    const u = people[(Math.random() * people.length) | 0];
    const a = Math.random() * Math.PI * 2, d = 5 + Math.random() * 12;
    const x = Math.round(u.x + Math.cos(a) * d), y = Math.round(u.y + Math.sin(a) * d);
    if (!inb(x, y)) continue;
    const i = idx(x, y), o = World.obj[i];
    if (!o || o.t !== 'tree' || o.g < 1 || o.res || o.awake) continue;
    if (nearBonfire(x, y, BONFIRE_NOSPAWN)) continue;
    // только на опушке: перед деревом открыто, чтобы его было видно, а не в глухой чаще
    let front = 0;
    for (let yy = y + 1; yy <= y + 2; yy++) for (let xx = x - 2; xx <= x + 2; xx++) {
      const q = inb(xx, yy) && World.obj[idx(xx, yy)];
      if (q && q.t === 'tree') front++;
    }
    if (strict && front > 2) continue;
    if (Game.ents.some(e => Math.abs(e.hx - x) + Math.abs(e.hy - y) < 4)) continue;
    o.awake = true; o.res = true;           // дровосек его не тронет
    Game.ents.push(newEnt({ i, o, hx: x, hy: y, x: x + 0.5, y: y + 0.5 }));
    made++;
  }
}

function newEnt(p) {
  return Object.assign({
    state: 'sleep', t: 0, k: 0, delay: Math.random() * 10, face: 1, phase: Math.random() * 6, alpha: 1,
    wait: 0, goal: null, moving: false, foe: null, victim: null, seen: new Set(), fighters: [],
  }, p);
}

// есть ли рядом большой костёр: он отпугивает нечисть
function nearBonfire(x, y, r) {
  for (const b of Game.buildings) if (b.type === 'bonfire' && b.state === 'done' && Math.hypot(b.x + b.w / 2 - x, b.y + b.h / 2 - y) <= r * bonfireMul(b)) return true;
  return false;
}

function entMove(e, tx, ty, speed, dt) {
  const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
  const step = speed * dt;
  e.moving = d > 0.02;
  if (!e.moving) return true;
  if (Math.abs(dx) > 0.02) e.face = dx > 0 ? 1 : -1;
  e.phase += step * 7;
  if (step >= d) { e.x = tx; e.y = ty; return true; }
  e.x += dx / d * step; e.y += dy / d * step;
  return false;
}

// Последний удар: глаза гаснут, дерево шатается и с грохотом валится от гнома
function entFell(e, u) {
  e.state = 'dying'; e.t = 0; e.foe = null; e.moving = false; e.fightT = undefined;
  e.fallDir = u.x < e.x ? 1 : -1;
  sfxAt('creak', e.x * TILE, e.y * TILE, 1.3);
  logEvent('tree', `${UNIT_TYPES[u.type].name} одолел: ${entName(e).toLowerCase()}`, e.x, e.y);
  if (Game.time - (Game.entToastT || -99) > 30) {
    Game.entToastT = Game.time;
    toast(e.water ? `${UNIT_TYPES[u.type].name} рассеял водяного — осталась лужа` : e.rock ? `${UNIT_TYPES[u.type].name} разбил ходячий камень! Остались камни для каменотёса` : `${UNIT_TYPES[u.type].name} срубил ходячее дерево! Бревно заберёт дровосек`);
  }
}

// Захват: тянется рукой, хватает, поднимает в кулаке, разворачивается и уносит в туман
const GRAB_REACH = 0.9, GRAB_LIFT = 1.7, GRAB_TURN = 2.1, GRAB_FADE = 4.8, GRAB_END = 6.8;
function entTakes(e, u) {
  nightTook();
  e.state = 'drag'; e.t = 0; e.foe = null; e.scream = 0; e.sayV = false; e.sayK = false; e.turned = false;
  e.victim = u; e.vsnap = snapVictim(u);
  e.vx0 = u.x; e.vy0 = u.y;
  e.face = u.x > e.x ? 1 : -1;
  let dx = e.x - u.x, dy = e.y - u.y;
  const d = Math.hypot(dx, dy) || 1;
  e.dragDir = [dx / d, dy / d];
  if (Math.abs(e.dragDir[0]) < 0.4) e.dragDir = [-e.face * 0.7, Math.sign(dy || 1) * 0.7];   // уходит вбок, чтобы было видно
  floater(u.x, u.y - 1.2, '!', '#ff6040');
  sfxAt('roar', e.x * TILE, e.y * TILE);
  toast(`${entName(e)} утащил${e.rock || e.water ? '' : 'о'} в туман: ${UNIT_TYPES[u.type].name}`);
  logEvent('tree', `${entName(e)} утащил${e.rock || e.water ? '' : 'о'} в туман: ${UNIT_TYPES[u.type].name}`, e.x, e.y);
  removeUnit(u);
}

// стал бревном: на месте дерева — пень (отрастёт), бревно лежит, где упало
function entToLog(e) {
  if (e.water) return entWaterRest(e);
  if (e.rock) return rockEntRest(e);
  const home = e.i;
  if (World.obj[home] === e.o) { World.obj[home] = { t: 'stump', g: 0 }; World.growing.add(home); }
  const lx = Math.floor(e.x + e.fallDir * 0.8), ly = Math.floor(e.y);
  const li = inb(lx, ly) ? idx(lx, ly) : -1;
  const ok = li >= 0 && !World.obj[li] && !World.road[li] && !World.bmap[li] && isWalkable(lx, ly);
  World.obj[ok ? li : home] = { t: 'log', g: 0 };
  if (!ok) World.growing.delete(home);
}

function updateEnts(dt) {
  const list = Game.ents;
  if (!list || !list.length) return;
  const night = isNightNow();
  for (const e of list) {
    e.t += dt;
    e.moving = false;
    if (entBonfireRepel(e)) continue;
    switch (e.state) {
      case 'sleep':
        // вечером стоит обычным деревом, только глаза горят; вылезает с наступлением ночи
        if (!night && !isEveningNow()) e.state = 'done';
        else if (night) {
          if (e.wakeAt === undefined) e.wakeAt = Game.time + e.delay;
          if (Game.time >= e.wakeAt) { e.state = 'emerge'; e.t = 0; sfxAt('creak', e.x * TILE, e.y * TILE); }
        }
        break;
      case 'emerge':
        e.k = Math.min(1, e.t / 1.8);
        if (e.t >= 1.8) { e.state = 'walk'; e.t = 0; e.wait = 0.5; }
        break;
      case 'walk':
        if (!night) { e.state = 'return'; break; }
        if (e.wait > 0) { e.wait -= dt; break; }
        // иногда нечисть идёт крушить ближайшее здание
        if (!e.goal && !e.target && Math.random() < dt * 0.25 * Math.min(2.5, nightDiff())) {   // поздние ночи — набеги чаще
          const tb = pickSmashTarget(e);
          if (tb) { e.target = tb; e.goal = smashSpot(e, tb); }
        }
        if (!e.goal) {
          for (let k = 0; k < 8 && !e.goal; k++) {
            const x = e.hx + Math.round((Math.random() * 2 - 1) * ENT_ROAM), y = e.hy + Math.round((Math.random() * 2 - 1) * ENT_ROAM);
            if (isWalkable(x, y) && !World.bmap[idx(x, y)]) e.goal = [x + 0.5, y + 0.5];
          }
          if (!e.goal) { e.wait = 2; break; }
        }
        if (entMove(e, e.goal[0], e.goal[1], (e.target ? 0.8 : 0.55) * (1 + 0.12 * (Math.min(4, nightDiff()) - 1)), dt)) {
          e.goal = null; e.wait = 1.5 + Math.random() * 3.5;
          if (e.target) {
            // дошла до здания — начинает бить
            const tb = e.target;
            if (tb.removed) e.target = null;
            else { e.state = 'smash'; e.t = 0; e.hitsDone = 0; e.face = tb.x + tb.w / 2 > e.x ? 1 : -1; e.wait = 0; }
          } else if (Math.random() < 0.3) sfxAt('creak', e.x * TILE, e.y * TILE, 0.7);
        }
        break;
      case 'ghosted': {
        // испугалась призрака: пятится прочь, потом приходит в себя
        const f = e.gFrom || [e.x, e.y], dx = e.x - f[0], dy = e.y - f[1], d = Math.hypot(dx, dy) || 1;
        entMove(e, e.x + dx / d * 2, e.y + dy / d * 2, 0.9, dt);
        if (e.t > 4.5 || !night) { e.state = night ? 'walk' : 'return'; e.t = 0; e.wait = 1; e.goal = null; }
        break;
      }
      case 'smash': {
        const tb = e.target;
        if (!tb || tb.removed || !night) { e.target = null; e.state = night ? 'walk' : 'return'; break; }
        // каждые 1.1 с — удар по зданию: пыль, щепки, треск
        if (e.t >= 0.6 + e.hitsDone * 1.1) {
          e.hitsDone++; e.atk = Game.time; e.hitT = Game.time;
          buildingHit(e, tb);
        }
        if (e.hitsDone >= 7) { e.target = null; e.state = 'walk'; e.wait = 3 + Math.random() * 4; }
        break;
      }
      case 'fight': {
        // бойцов не осталось (сбили с ног, убежали) — нечисть снова бродит
        const alive = (e.fighters || []).filter(f => !f.dead && f.brk && f.brk.kind === 'fight');
        if (!alive.length) { if (e.t > 1) { e.state = 'walk'; e.foe = null; e.fighters = []; e.fightT = undefined; e.resolved = false; } break; }
        if (e.t > 30 && !e.resolved) resolveFight(e);
        break;
      }
      case 'dying':
        if (e.rock && e.t >= 0.9 && !e.split) {   // камень раскололся: осколки и грохот
          e.split = true;
          const { bx, by } = entBase(e);
          fxBurst(bx, by - 20, 20, [ROCK_COL.base, ROCK_COL.mid, ROCK_COL.light, ROCK_COL.dark], 90, 60, 0.9, 2.4, 260);
          fxBurst(bx, by - 8, 8, ['rgba(200,186,160,0.55)', 'rgba(170,156,130,0.5)'], 20, 14, 1.2, 3.5, -12);
          sfxAt('thud', e.x * TILE, e.y * TILE, 1.2);
        }
        // шатается → заваливается → удар о землю: пыль, листья, бревно
        if (e.t >= 2.2) {
          const { bx, by } = entBase(e);
          const off = e.rock || e.water ? 0 : e.fallDir;
          fxBurst(bx + off * 40, by - 2, 30, e.water ? ['#7ac8f0', '#bfefff', '#4aa0d0'] : ['#8a7a60', '#6a5a44', '#a8987a'], 90, 40, 0.9, 3, 80);
          fxBurst(bx + off * 50, by - 10, 22, ENT_LOOK[entBase(e).kind].crown, 70, 50, 1.4, 2.4, 60);
          floater(e.x + off * 1.2, e.y - 1, e.water ? 'Плюх!' : e.rock ? 'Хрусть!' : 'БУХ!', '#e0b882');
          sfxAt('thud', e.x * TILE, e.y * TILE, 1.6);
          entToLog(e); e.state = 'gone';
        }
        break;
      case 'drag': {
        if (e.t < GRAB_REACH) {
          // подшагивает и тянется к гному
          entMove(e, e.vx0 - e.face * 0.85, e.vy0 - 0.05, 1.2, dt);
          e.face = e.vx0 > e.x ? 1 : -1;
          e.moving = false;
        } else if (e.t < GRAB_TURN) {
          if (e.t >= GRAB_LIFT && !e.turned) { e.turned = true; e.face = e.dragDir[0] >= 0 ? 1 : -1; sfxAt('creak', e.x * TILE, e.y * TILE); }
        } else {
          e.x += e.dragDir[0] * 0.8 * dt; e.y += e.dragDir[1] * 0.8 * dt;
          e.moving = true; e.phase += 0.8 * dt * 7;
        }
        // гном орёт и вырывается
        if (e.t > GRAB_REACH && e.t < GRAB_FADE - 1.1 && (e.scream -= dt) <= 0) {
          e.scream = 0.9 + Math.random() * 0.5;
          const h = entHandWorld(e);
          floater(h.x / TILE, h.y / TILE - 0.6, ['А-а-а!', 'Помогите!', 'Пусти!', 'Мама!'][Math.floor(Math.random() * 4)], '#ffc0c0');
        }
        // перед уходом в тень: последние слова жертвы и короткая реплика нечисти
        if (!e.sayV && e.t >= GRAB_FADE - 0.9) { e.sayV = true; const hh = entHandWorld(e); floater(hh.x / TILE, hh.y / TILE - 0.9, 'А надо было раньше…', '#ffc0c0'); }
        if (!e.sayK && e.t >= GRAB_FADE - 0.1) { e.sayK = true; floater(e.x, e.y - 2.8, 'А всё.', '#e8e8f4'); sfxAt('roar', e.x * TILE, e.y * TILE, 0.7); }
        e.alpha = e.t < GRAB_FADE ? 1 : Math.max(0, 1 - (e.t - GRAB_FADE) / (GRAB_END - GRAB_FADE));   // растворяется в тумане
        if (e.t >= GRAB_END) {
          // утащил — и тихо вернулся на своё место
          e.victim = null; { const hm = entHomeXY(e); e.x = hm[0]; e.y = hm[1]; }
          e.state = 'fadein'; e.t = 0;
        }
        break;
      }
      case 'fadein':
        e.alpha = Math.min(1, e.t / 2);
        if (e.t >= 2) { e.alpha = 1; e.state = 'root'; e.t = 0; }   // насытилось — уходит в землю до следующей ночи
        break;
      case 'return':
        { const hm = entHomeXY(e); if (entMove(e, hm[0], hm[1], 0.7, dt)) { e.state = 'root'; e.t = 0; } }
        break;
      case 'root':
        e.k = Math.max(0, 1 - e.t / 1.8);
        if (e.t >= 1.8) e.state = 'done';
        break;
    }
    if (e.state === 'done' && e.o) { e.o.awake = false; e.o.res = false; }
    if (e.state === 'done') e.dead = true;
  }
  Game.ents = list.filter(e => e.state !== 'done' && e.state !== 'gone');
}

// Кто увидел ходячее дерево — реагирует один раз на каждое дерево
function entReact(u) {
  for (const e of Game.ents) {
    const open = e.state === 'walk' || e.state === 'smash' || e.state === 'fight' || (e.state === 'emerge' && e.k > 0.5);
    if (!open || e.seen.has(u.id) || Math.hypot(e.x - u.x, e.y - u.y) > ENT_SEE) continue;
    const lost = u.brk && u.brk.kind === 'lost';
    if (!lost && !interruptible(u)) continue;
    if (u.hero && u.cmd && !lost) continue;                    // герой с приказом игрока не отвлекается
    e.seen.add(u.id);
    if (lost) endBreak(u);
    // друзья рядом придают храбрости: в компании чаще бросаются в драку, в одиночку — застывают или бегут
    let friends = 0;
    for (const o of Game.units) if (o !== u && !o.dead && !o.inside && isPerson(o) && Math.hypot(o.x - u.x, o.y - u.y) < 5) friends++;
    if (e.state === 'fight') {
      // идёт драка: присоединиться, если ещё не поздно
      if (!e.resolved && e.fighters.length < 6 && Math.random() < (friends ? 0.75 : 0.5) && !(typeof folkNoFight === 'function' && folkNoFight(u))) { e.fighters.push(u); startBreak(u, 'fight', null); u.proc = entFightGen(u, e); }
      else { startBreak(u, 'flee', null); u.proc = fleeGen(u); }
      return;
    }
    const r = Math.random();
    const canFight = e.state === 'walk' || e.state === 'smash';
    const pFreeze = friends ? 0.12 : 0.4, pFlee = friends ? 0.28 : 0.75;     // накопительные пороги: застыть / бежать / драться
    if (typeof folkNoFight === 'function' && folkNoFight(u)) folkHide(u);   // гномята и гномки с нечистью не дерутся (folk.js)
    else if (r < pFreeze) { startBreak(u, 'freeze', null); u.proc = freezeGen(u); }
    else if (r < pFlee || !canFight) { startBreak(u, 'flee', null); u.proc = fleeGen(u); }
    else {
      e.target = null; e.state = 'fight'; e.foe = u; e.t = 0; e.goal = null; e.fighters = [u]; e.fightT = undefined; e.resolved = false;
      startBreak(u, 'fight', null); u.proc = entFightGen(u, e);
    }
    return;
  }
}

// ---------- Гибель гнома ----------

function removeUnit(u) {
  if (u.dead) return;
  u.dead = true;
  if (isPerson(u) && u.type !== 'carter') Game.lostGnomes = (Game.lostGnomes || 0) + dif().lossW;     // потери копятся — призраков и скелетов будет больше
  if (u.carry) dropLoad(u);
  else if (u.dlv && u.dlv.from && !u.dlv.from.removed && u.dlv.from.reserved)
    u.dlv.from.reserved[u.dlv.g] = Math.max(0, u.dlv.from.reserved[u.dlv.g] - u.dlv.n);
  u.dlv = null;
  Game.smokers.delete(u);
  if (u.blockT >= 0 && World.occ[u.blockT] === u.id) World.occ[u.blockT] = 0;
  u.releaseOcc();
  if (u.home && u.home.worker === u) u.home.worker = null;
  if (u.job && u.job.builder === u) u.job.builder = null;
  if (u.job && u.job.upg && u.job.upg.builder === u) u.job.upg.builder = null;
  u.home = null; u.job = null; u.brk = null;
  if (Game.selected === u) Game.selected = null;
}

function purgeDead() {
  for (let i = Game.units.length - 1; i >= 0; i--) {
    const u = Game.units[i];
    if (!u.dead) continue;
    Game.units.splice(i, 1);
    Game.unitMap.delete(u.id);
  }
}

// ---------- Такт ----------

function nightTick(dt) {
  if (!Game.ents) Game.ents = [];
  updateEnts(dt);
  batsTick(dt);
  ghostsTick(dt);
  skeletonsTick(dt);
  graveyardTick(dt);
  updateFx(dt);
  purgeDead();
  Game.nightT = (Game.nightT || 0) + dt;
  if (Game.nightT < 0.5) return;
  Game.nightT = 0;
  const night = isNightNow(), eve = isEveningNow(), ni = nightIndex();
  // вечер: зажигаются фонари, а в лесу открываются глаза
  if (eve && Game.entNight !== ni && isDawnNow()) Game.entNight = ni;     // загрузились на рассвете: нечисть уже не выходит
  if (eve && Game.entNight !== ni) {
    Game.entNight = ni;
    spawnEnts();
    ghostsSpawn(startNights() <= 1 && START_GRACE.on && !Game.noGrace ? START_GRACE.firstGhosts : ghostsWant());
    if (startOpen('reaper')) reapersSpawn();
    if (startOpen('skeletons')) skeletonsSpawn();
    if (isLongNight()) toast('Эта ночь будет долгой — в полтора раза дольше обычной. Готовьте хлеб и костры!');
    toast('Вечереет: зажглись фонари. В лесу кто-то открыл глаза…');
    logEvent('night', 'Вечер: зажглись фонари');
  }
  if (night && !Game.wasNight) {
    toast('Ночь: на деревню лёг туман. Деревья вылезают из земли!');
    logEvent('night', 'Наступила ночь, лёг туман');
  }
  if (!night && Game.wasNight) { toast('Рассвет: туман рассеялся'); logEvent('night', 'Рассвет, туман рассеялся'); }
  if (Game.musicNight !== night) { Game.musicNight = night; musicDayNight(night); }
  Game.wasNight = night;
  if (!eve) return;
  for (const u of Game.units) {
    if (!isPerson(u) || u.dead) continue;
    // каждый вечер — новый фонарь
    if (u.nightNo !== ni) { u.nightNo = ni; u.lantern = true; u.rescued = false; u.rescuer = 0; }
    if (!night || u.inside || u.type === 'carter') continue;
    if (Game.ents.length) entReact(u);
    // фонарь иногда разбивается сам — оступился, задел ветку (раз в ~3 минуты тумана)
    if (u.lantern && night && !u.brk && Math.random() < 0.003) lanternFall(u);
    // без фонаря в тумане — теряется
    if (!u.lantern && !u.rescued && interruptible(u)) {
      if (nearLamp(u.x, u.y, 2.5)) { u.rescued = true; continue; }   // стоит под фонарём — не теряется (иначе «заблудился» и «вышел к фонарю» в один шаг, журнал пухнет)
      startBreak(u, 'lost', null); u.proc = lostGen(u);
    }
  }
  // кто с фонарём рядом — выводит; свободные идут искать потерявшихся
  for (const l of Game.units) {
    if (!l.brk || l.brk.kind !== 'lost' || l.rescued) continue;
    if (rescuerOf(l)) continue;
    // вышел к уличному фонарю — по свету нашёл дорогу
    if (nearLamp(l.x, l.y, 2.5)) { l.rescued = true; floater(l.x, l.y - 1, 'Фонарь! Нашёлся!', '#ffe7a0'); logEvent('night', `${UNIT_TYPES[l.type].name} вышел к уличному фонарю`, l.x, l.y); continue; }
    let best = null, bd = 20;
    for (const r of Game.units) {
      if (r === l || !r.lantern || r.inside || r.dead || !isPerson(r) || r.type === 'carter') continue;
      const d = Math.hypot(r.x - l.x, r.y - l.y);
      if (d < 2.5) { l.rescued = true; floater(l.x, l.y - 1, 'Спасибо!', '#ffe7a0'); best = null; break; }
      if (!interruptible(r)) continue;
      const score = d - (r.idleFlag ? 4 : 0);
      if (score < bd) { bd = score; best = r; }
    }
    if (best && !l.rescued) {
      startBreak(best, 'rescue', null);
      best.proc = rescueGen(best, l);
      l.rescuer = best.id;
    }
  }
}

// ---------- Рисование ----------

const NIGHT = { cv: null, ctx: null, puff: null, hole: null };

function nightSprites() {
  if (NIGHT.puff) return;
  const mk = (rgb) => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const c = cv.getContext('2d'), g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(0.3, `rgba(${rgb},0.55)`); g.addColorStop(0.7, `rgba(${rgb},0.12)`); g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    return cv;
  };
  NIGHT.puff = mk('150,162,186');
  NIGHT.hole = mk('0,0,0');
  NIGHT.warm = mk('255,190,105');
  NIGHT.eerie = mk('110,240,190');
}

// Источники света в кадре: [x, y, радиус, сила] в мировых пикселях
function nightLights(x0, y0, x1, y1) {
  const L = [];
  for (const u of Game.units) {
    if (u.inside || u.x < x0 - 4 || u.x > x1 + 4 || u.y < y0 - 4 || u.y > y1 + 4) continue;
    if (u.type === 'carter') L.push([u.x * TILE, u.y * TILE - 6, 62, 0.8]);
    else if (lanternLit(u) && isPerson(u)) L.push([u.x * TILE + (u.face || 1) * 6, u.y * TILE - 4, 50, 0.85]);
  }
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const o = World.obj[idx(x, y)];
    if (o && o.t === 'lamp' && !o.out && lampsOn()) L.push([x * TILE + 27, y * TILE + 6, 46, 0.42]);   // в тумане светят слабо
    if (o && isStreetObj(o) && o.born === undefined || (o && o.born !== undefined && Game.time - o.born > GROW_T)) { const mm = o && isStreetObj(o) ? decorMorph(o, x, y) : 0; if (mm) { const ml = decorMorphLight(mm, x, y); if (ml) L.push(ml); } }
  }
  // ожившее дерево окружено мертвенным отсветом — его силуэт видно в тумане
  for (const e of Game.ents || []) if (e.k > 0.05 && e.state !== 'gone') {
    const { bx, by } = entBase(e);
    L.push([bx, by - (e.rock ? 18 : 50), e.rock ? 50 : 80, (e.state === 'drag' ? 0.95 : 0.7) * e.k * e.alpha, 'ent']);
    if (e.state === 'drag' && (e.victim || e.vsnap)) L.push([bx + e.face * 21, by - 30, 50, 0.8 * e.alpha]);   // фонарь бедняги ещё светит
  }
  weatherLights(L, x0, y0, x1, y1);
  if (typeof dpLights === 'function') dpLights(L, x0, y0, x1, y1);      // дракончик со светом (dragonpet.js)
  skeletonLights(L, x0, y0, x1, y1);
  ghostLights(L, x0, y0, x1, y1);
  for (const b of Game.buildings) {
    if (b.state !== 'done' || b.x + b.w < x0 - 3 || b.x > x1 + 3 || b.y + b.h < y0 - 3 || b.y > y1 + 3) continue;
    if (b.type === 'bonfire') L.push([(b.x + b.w / 2) * TILE, (b.y + b.h / 2) * TILE, BONFIRE_LIGHT * bonfireMul(b), 1]);
    else if (b.type === 'inn' || b.isStore() || (b.worker && b.worker.inside === b))
      L.push([(b.doorX + 0.5) * TILE, b.doorY * TILE, 36, 0.4]);                // окна и дверь светятся
  }
  return L;
}

// Насколько точка мира застроена (здания и дороги в радиусе ~4 клеток): 0 — лес и поле, 1 — деревня
function fogSettleAt(wx, wy) {
  const cx = Math.floor(wx / TILE), cy = Math.floor(wy / TILE);
  let n = 0, k = 0;
  for (let dy = -4; dy <= 4; dy += 2) for (let dx = -4; dx <= 4; dx += 2) {
    const x = cx + dx, y = cy + dy;
    k++;
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
    const i = y * MAP_W + x;
    if (World.bmap[i] || World.road[i]) n++;
  }
  return Math.min(1, n / k * 4);
}
// Плотность клуба тумана. Раньше клуб доходил до полной непрозрачности и одинаково ложился на деревню,
// и ночью весь город тонул в светло-серой пелене (жалоба тестера, 0.10.90). Теперь потолок FOG_MAX,
// а над жильём туман вчетверо реже: густые клубы остаются в лесу и полях.
const FOG_MAX = 0.6;
function fogPuffAlpha(k, hh, wx, wy) {
  return Math.min(FOG_MAX, k * (0.45 + ((hh >>> 12) % 100) / 220)) * (1 - 0.75 * fogSettleAt(wx, wy));
}

function drawNight(c, x0, y0, x1, y1) {
  const n = nightAmt();
  if (n <= 0.001) return;
  nightSprites();
  const cam = R.cam, z = devScale();
  const vw = R.canvas.width / z, vh = R.canvas.height / z;
  const S = 4;                                  // мировых px на px карты света
  const ox = Math.floor(cam.x / S) * S - S, oy = Math.floor(cam.y / S) * S - S;
  const w = Math.ceil(vw / S) + 3, h = Math.ceil(vh / S) + 3;
  if (!NIGHT.cv) { NIGHT.cv = document.createElement('canvas'); NIGHT.ctx = NIGHT.cv.getContext('2d'); }
  if (NIGHT.cv.width !== w || NIGHT.cv.height !== h) { NIGHT.cv.width = w; NIGHT.cv.height = h; NIGHT.key = ''; }   // новый размер — холст чист, рисуем заново
  const lights = nightLights(x0, y0, x1, y1);
  // Карта темноты и тумана (¼ разрешения) меняется медленно: туман плывёт ~5 px/с, фонари мерцают на 4%.
  // Перерисовываем её не чаще 30 раз в секунду (экономный режим — ~12) и сразу, если сдвинулась камера или темнота.
  const nkey = ox + ',' + oy + ',' + w + ',' + h, now = performance.now(), gap = typeof Fps !== 'undefined' && Fps.eco ? 80 : 33;
  if (NIGHT.key !== nkey || now - NIGHT.at >= gap || Math.abs(n - NIGHT.n) > 0.01 || now < NIGHT.at) {
    NIGHT.key = nkey; NIGHT.at = now; NIGHT.n = n;
    const l = NIGHT.ctx;
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.globalCompositeOperation = 'source-over';
    l.globalAlpha = 1;
    l.clearRect(0, 0, w, h);
    l.setTransform(1 / S, 0, 0, 1 / S, -ox / S, -oy / S);
    // темнота
    l.fillStyle = `rgba(6,9,26,${0.86 * n})`;
    l.fillRect(ox, oy, w * S, h * S);
    // туман: медленно плывущие густые клубы (только ночью); второй слой — лёгкая дымка
    // поверх света, чтобы и у фонарей было видно, что вокруг всё в тумане
    const fog = fogAmt();
    const G = 96, drift = Game.time * 5;
    const puffs = (mul, size) => {
      if (fog <= 0.01) return;
      for (let gy = Math.floor(oy / G) - 1; gy <= Math.ceil((oy + h * S) / G) + 1; gy++) {
        for (let gx = Math.floor((ox - drift) / G) - 1; gx <= Math.ceil((ox + w * S - drift) / G) + 1; gx++) {
          const hh = hash(gx * 7919 + gy * 104729);
          const r = G * size * (0.8 + ((hh >>> 3) % 100) / 140);
          const fx = gx * G + drift + ((hh >>> 8) % 50) - 25 + Math.sin(Game.time * 0.11 + gy) * 18;
          const fy = gy * G + ((hh >>> 16) % 50) - 25;
          l.globalAlpha = fogPuffAlpha(fog * mul, hh, fx, fy);
          l.drawImage(NIGHT.puff, fx - r, fy - r * 0.7, r * 2, r * 1.4);
        }
      }
    };
    puffs(1.15, 1.15);
    // свет прорезает и темноту, и туман
    l.globalCompositeOperation = 'destination-out';
    for (const [x, y, r, a] of lights) {
      const fl = 1 + Math.sin(Game.time * 7 + x * 0.3) * 0.04;
      l.globalAlpha = a;
      l.drawImage(NIGHT.hole, x - r * fl, y - r * fl, r * 2 * fl, r * 2 * fl);
    }
    l.globalCompositeOperation = 'source-over';
    puffs(0.28, 0.9);                                       // лёгкая дымка поверх света
    l.globalAlpha = 1;
  }
  c.save();
  c.imageSmoothingEnabled = true;
  c.drawImage(NIGHT.cv, ox, oy, w * S, h * S);
  // тёплый ореол
  c.globalCompositeOperation = 'lighter';
  for (const [x, y, r, a, kind] of lights) {
    c.globalAlpha = (kind === 'ent' ? 0.3 : 0.16) * a * n;
    c.drawImage(kind === 'ent' ? NIGHT.eerie : NIGHT.warm, x - r * 0.6, y - r * 0.6, r * 1.2, r * 1.2);
  }
  c.restore();
  c.imageSmoothingEnabled = R.smooth;
  // у нечисти сквозь туман и кроны остаётся только могильное свечение; сами глаза рисуются вместе со всем (под кронами)
  for (const e of Game.ents || []) {
    if (e.state === 'gone' || e.state === 'done' || e.alpha <= 0.05 || (e.state === 'dying' && e.t > 0.5)) continue;
    const asleep = e.state === 'sleep';
    if (!asleep && e.k < 0.4 && !e.rock && !e.water) continue;
    const p = asleep || e.rock || e.water ? entFacePos(e) : entFacePos(e);
    if (typeof onScreen === 'function' && !onScreen(p.x, p.y, 24)) continue;   // за краем экрана
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = e.alpha * Math.min(1, n * 1.5) * (asleep ? 0.38 : 0.5);
    nightSprites();
    c.drawImage(NIGHT.eerie, p.x - 8, p.y - 5, 16, 10);
    c.restore();
  }
}

// Закат и рассвет — тёплый оттенок
function drawDusk(c) {
  const n = nightAmt(), d = 4 * n * (1 - n);
  if (d <= 0.01) return;
  const cam = R.cam, z = devScale();
  const cy = cycleAt(Game.time), dawn = cy.p >= NIGHT_START + cy.nl;
  c.fillStyle = dawn ? `rgba(255,170,120,${0.1 * d})` : `rgba(255,120,40,${0.14 * d})`;
  c.fillRect(cam.x - 4, cam.y - 4, R.canvas.width / z + 8, R.canvas.height / z + 8);
}

// ---------- Облик ходячего дерева ----------
// Для каждой породы — свой набор кадров: стоит, четыре кадра шага, два кадра атаки
// и кадр «тащит добычу». Рисуется в большом разрешении и сводится в пиксель-арт
// с тёмным контуром, как обычные деревья. Рожа поверх — вручную по пикселям.

const ENT_SW = 80, ENT_SH = 112, ENT_CX = 40, ENT_BASE = 108;
// какая порода у дерева на карте (по номеру спрайта из makeTrees)
const ENT_KIND = ['oak', 'oak', 'oak', 'birch', 'pine', 'fir', 'pine'];
const ENT_LOOK = {
  oak:   { bark: '#5e3c22', light: '#8a6038', dark: '#2a170a', crown: ['#2c5020', '#76a43c'], faceY: 54, sh: 60, crownY: 30 },
  birch: { bark: '#c8c2b4', light: '#ece6d8', dark: '#6a645a', limb: { bark: '#5e5a52', light: '#9c968a', dark: '#24211d' }, crown: ['#4a7826', '#a4c44c'], faceY: 56, sh: 62, crownY: 30, dash: '#2a2622' },
  pine:  { bark: '#7a4024', light: '#a86a3c', dark: '#341a0a', crown: ['#24452c', '#4e7a44'], faceY: 52, sh: 60, crownY: 22 },
  fir:   { bark: '#5a3a20', light: '#80583a', dark: '#26160a', crown: ['#1c3a24', '#3e6a40'], faceY: 60, sh: 66, crownY: 0 },
};
const ENT_SPR = {};

// Узловатая конечность: путь с изломами, толщина от w0 к w1, тень справа-снизу, блик слева
function gnarl(c, pts, w0, w1, L, seed) {
  const r = mulberry32(seed);
  const P = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const nx = -(by - ay), ny = bx - ax, nl = Math.hypot(nx, ny) || 1;
    for (let k = 0; k < 3; k++) {
      const t = k / 3, j = k ? (r() - 0.5) * 2.2 : 0;
      P.push([ax + (bx - ax) * t + nx / nl * j, ay + (by - ay) * t + ny / nl * j]);
    }
  }
  P.push(pts[pts.length - 1]);
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const [col, ox, oy, f] of [[L.dark, 0.7, 0.8, 1.05], [L.bark, 0, 0, 1], [L.light, -0.5, -0.4, 0.38]]) {
    c.strokeStyle = col;
    for (let i = 0; i < P.length - 1; i++) {
      const t = i / (P.length - 1);
      c.lineWidth = Math.max(0.5, (w0 + (w1 - w0) * t) * f);
      c.beginPath(); c.moveTo(P[i][0] + ox, P[i][1] + oy); c.lineTo(P[i + 1][0] + ox, P[i + 1][1] + oy); c.stroke();
    }
  }
  // наросты-узлы
  for (let i = 3; i < P.length - 2; i += 4) {
    const t = i / (P.length - 1), w = w0 + (w1 - w0) * t;
    if (w < 2) continue;
    ellipse(c, P[i][0] + 0.4, P[i][1] + 0.4, w * 0.62, w * 0.5, L.dark);
    ellipse(c, P[i][0], P[i][1], w * 0.55, w * 0.45, L.bark);
  }
}

// Когти: пучок загнутых тонких сучьев или корней из одной точки
function claws(c, x, y, dir, spread, len, n, curl, L, seed, w = 1.8) {
  for (let k = 0; k < n; k++) {
    const a = dir + (k / (n - 1) - 0.5) * spread;
    const mx = x + Math.cos(a) * len * 0.55, my = y + Math.sin(a) * len * 0.55;
    const a2 = a + curl;
    gnarl(c, [[x, y], [mx, my], [mx + Math.cos(a2) * len * 0.5, my + Math.sin(a2) * len * 0.5]], w, 0.35, L, seed + k);
  }
}

// кисть хватающей руки по кадрам g0…g8 (от центра ствола по x, y в спрайте): замах назад, бросок, тянется, у гнома, сжала, тянет вверх…
const ENT_GRAB_HAND = [[-6, 34], [14, 42], [24, 62], [28, 84], [27, 91], [27, 82], [27, 72], [27, 62], [27, 54]];
// Поза: ноги (бедро → колено → ступня) и руки (плечо → локоть → кисть)
function entPose(name, L) {
  const cx = ENT_CX, hipY = 84, base = ENT_BASE;
  let sL = 0, sR = 0, lL = 0, lR = 0;
  const wi = name[0] === 'w' ? +name.slice(1) : name.startsWith('cw') ? +name.slice(2) : -1;   // кадр шага (cw — шагает с добычей)
  if (wi >= 0) {
    const p = wi / 8 * Math.PI * 2;   // 8 кадров шага
    sL = 7 * Math.sin(p); sR = -sL;
    lL = Math.max(0, -Math.cos(p)) * 6; lR = Math.max(0, Math.cos(p)) * 6;
  }
  const leg = (side, s, l) => {
    const hx = cx + side * 6;
    return [[hx, hipY], [hx + side * 9 + s * 0.4, hipY + 11 - l * 0.6], [hx + side * 7 + s, base - 2 - l]];
  };
  const shY = L.sh;
  const arm = (side, pose) => {
    const sx = cx + side * 8;
    const swing = wi >= 0 ? -(side < 0 ? sL : sR) * 0.7 : 0;
    if (pose === 'up') return [[sx, shY], [sx + side * 13, shY - 14], [sx + side * 9, shY - 30]];
    if (pose === 'slash') return [[sx, shY], [sx + side * 17, shY - 2], [sx + side * 25, shY + 10]];
    if (pose === 'grab') return [[sx, shY], [sx + side * 15, shY - 8], [sx + side * 21, shY - 2]];
    if (pose === 'reach') return [[sx, shY], [sx + side * 16, shY + 10], [sx + side * 27, shY + 28]];   // тянется к гному
    if (pose === 'hold') return [[sx, shY], [sx + side * 15, shY + 4], [sx + side * 19, shY - 6]];    // держит добычу перед собой на весу
    // локти наружу, предплечья и когти загнуты внутрь, к телу
    return [[sx, shY], [sx + side * 14 + swing * 0.4, shY + 8], [sx + side * 9 + swing, shY + 24]];
  };
  // захват (дерево): g0…g8 — замах, бросок, тянется, обхватывает, сжимает, отрывает от земли, поднимает, разворот; кисть и локоть — по таблице
  const gm = /^g(\d)$/.exec(name);
  if (gm) {
    const i = +gm[1], hnd = ENT_GRAB_HAND[i], sx1 = cx + 8;
    const grabArm = [[sx1, shY], [(sx1 + cx + hnd[0]) / 2 + 3, (shY + hnd[1]) / 2 + 8], [cx + hnd[0], hnd[1]]];
    return { legs: [leg(-1, 0, 0), leg(1, 0, 0)], arms: [arm(-1, i < 1 || i > 4 ? 'up' : 'hang'), grabArm], noClaw: i >= 3 };
  }
  const f = name === 'f0' ? ['up', 'up'] : name === 'f1' ? ['slash', 'slash'] : name === 'drag' ? ['up', 'grab']
    : name === 'reach' ? ['hang', 'reach'] : name === 'hold' || name.startsWith('cw') ? ['up', 'hold'] : ['hang', 'hang'];
  return { legs: [leg(-1, sL, lL), leg(1, sR, lR)], arms: [arm(-1, f[0]), arm(1, f[1])], noClaw: name.startsWith('cw') };
}

function drawEntCrown(c, kind, L, seed) {
  const cx = ENT_CX;
  if (kind === 'oak') {
    foliage(c, cx, L.crownY + 4, 33, 24, 46, L.crown[0], L.crown[1], seed);
    foliage(c, cx - 14, L.crownY + 14, 16, 12, 14, L.crown[0], L.crown[1], seed + 3);
    foliage(c, cx + 15, L.crownY + 12, 16, 12, 14, L.crown[0], L.crown[1], seed + 5);
  } else if (kind === 'birch') {
    foliage(c, cx, L.crownY + 2, 26, 28, 44, L.crown[0], L.crown[1], seed);
    foliage(c, cx - 15, L.crownY + 12, 13, 15, 16, L.crown[0], L.crown[1], seed + 7);
    foliage(c, cx + 15, L.crownY + 10, 13, 15, 16, L.crown[0], L.crown[1], seed + 9);
    // свисающие плети
    c.strokeStyle = shade(L.crown[0], -0.3); c.lineWidth = 1.2;
    for (let k = 0; k < 9; k++) {
      const x = cx - 20 + k * 5;
      c.beginPath(); c.moveTo(x, L.crownY + 20); c.quadraticCurveTo(x + 2, L.crownY + 30, x - 1, L.crownY + 38 + (k % 3) * 3); c.stroke();
    }
  } else {
    const fir = kind === 'fir';
    const tiers = fir ? 6 : 4, col = L.crown[0];
    for (let k = 0; k < tiers; k++) {
      const y = (fir ? 58 : 40) - k * (fir ? 10 : 9);
      const w = (fir ? 30 : 26) * (1 - k / (tiers + 1));
      const top = y - (fir ? 16 : 14);
      c.beginPath(); c.moveTo(cx, top);
      c.quadraticCurveTo(cx + w * 0.4, y - 7, cx + w, y);
      for (let t = 1; t <= 7; t++) { const x = cx + w - t * (2 * w / 7); c.quadraticCurveTo(x + w / 7, y + 4, x, y + (t % 2 ? 1.5 : 0)); }
      c.quadraticCurveTo(cx - w * 0.4, y - 7, cx, top); c.closePath();
      c.fillStyle = lingrad(c, cx - w, top, cx + w, y, [[0, shade(col, 0.35)], [0.45, col], [1, shade(col, -0.5)]]);
      c.fill();
      c.strokeStyle = shade(col, 0.4); c.lineWidth = 0.5;
      for (let t = 0; t < w; t++) {
        const x = cx - w * 0.7 + srand() * w * 1.2, yy = top + 5 + srand() * (y - top - 4);
        c.beginPath(); c.moveTo(x, yy); c.lineTo(x - 1.5, yy + 2); c.stroke();
      }
    }
  }
}

function drawEntBody(c, kind, L, P, seed) {
  const cx = ENT_CX, top = kind === 'fir' ? 50 : L.crownY + 14;
  // ноги-корни: толстые, узловатые, на полусогнутых, с когтистыми корнями
  P.legs.forEach((g, i) => {
    const LL = L.limb || L;
    gnarl(c, g, 9, 6, LL, seed + 10 + i);
    const [fx, fy] = g[2], side = i ? 1 : -1;
    claws(c, fx, fy, side > 0 ? 0.25 : Math.PI - 0.25, 1.9, 11, 4, side * 0.5, LL, seed + 20 + i * 7, 2.6);
  });
  // туловище: сгорбленный корявый ствол
  // низ ствола расходится в ноги плавной аркой: без острого паха и ступенек
  const pts = [[cx - 10, 84], [cx - 13.5, 91], [cx - 13, 96], [cx - 9, 98.5], [cx - 4.5, 97.5], [cx, 96], [cx + 4.5, 97.5], [cx + 9, 98.5], [cx + 13, 96], [cx + 13.5, 91], [cx + 10, 84],
    [cx + 9.5, 70], [cx + 9, top + 6], [cx + 6, top], [cx - 5, top], [cx - 8.5, top + 6], [cx - 9, 70]];
  poly(c, pts, lingrad(c, cx - 11, 0, cx + 12, 0, [[0, L.light], [0.35, L.bark], [1, L.dark]]));
  // к низу ствол темнеет и перетекает в цвет ног
  const LB = L.limb || L;
  clipPoly(c, pts, () => { c.fillStyle = lingrad(c, 0, 66, 0, 94, [[0, rgba(LB.bark, 0)], [1, rgba(LB.bark, L.limb ? 1 : 0.55)]]); c.fillRect(cx - 20, 60, 40, 40); });
  if (L.dash) {
    c.fillStyle = L.dash;
    for (let k = 0; k < 16; k++) c.fillRect(cx - 9 + srand() * 17, top + 4 + srand() * (84 - top), rnd(1.5, 3.5), 1);
  } else {
    c.strokeStyle = rgba(L.dark, 0.8); c.lineWidth = 0.9;
    for (let k = 0; k < 7; k++) {
      const x = cx - 8 + k * 2.6 + rnd(-0.6, 0.6);
      c.beginPath(); c.moveTo(x + (x - cx) * 0.4, 92); c.quadraticCurveTo(x + rnd(-2, 2), 72, x + rnd(-1, 1), top + 2); c.stroke();
    }
  }
  // мох у корней
  if (kind !== 'birch') for (let k = 0; k < 14; k++) ellipse(c, cx - 10 + srand() * 8, 80 + srand() * 8, 1.2, 1, srand() < 0.5 ? '#4a6428' : '#6e8c38');
  // обломанные сучья на плечах
  gnarl(c, [[cx - 4, top + 2], [cx - 10, top - 8], [cx - 16, top - 12]], 3, 0.6, L, seed + 40);
  gnarl(c, [[cx + 4, top + 1], [cx + 11, top - 9], [cx + 14, top - 16]], 3, 0.6, L, seed + 41);
}

function drawEntArms(c, kind, L, P, seed) {
  P.arms.forEach((a, i) => {
    const side = i ? 1 : -1;
    const LL = L.limb || L;
    gnarl(c, a, 6.5, 3, LL, seed + 60 + i);
    // сучки на руке
    const [ex, ey] = a[1];
    gnarl(c, [[ex, ey], [ex + side * 4, ey - 6], [ex + side * 7, ey - 8]], 1.6, 0.4, LL, seed + 70 + i);
    if (kind !== 'birch') {
      // клочья хвои или листвы на ветвях-руках
      const col = L.crown[0];
      for (let k = 0; k < 4; k++) ellipse(c, ex + side * (2 + k * 2) + rnd(-1, 1), ey - 3 + rnd(-2, 2), 2.6, 1.8, shade(col, k % 2 ? -0.2 : 0.15));
    }
    // когтистая кисть: длинные загнутые пальцы-сучья
    const [hx, hy] = a[2], dir = Math.atan2(hy - ey, hx - ex);
    if (i && P.noClaw) return;                                    // хватающую кисть дорисовывают пальцы поверх гнома
    claws(c, hx, hy, dir, 1.5, 10, 4, side * 0.8, LL, seed + 80 + i * 9, 2);
  });
}

// Рожа (вручную по пикселям) поверх уже пиксельного кадра
const ENT_FACE = [
  'hh..........hh',
  'ohhh......hhho',
  '.oohhh..hhhoo.',
  '..ooohhhhooo..',
  '.sss.oooo.sss.',
  'sssssoNNosssss',
  'ssssssnNssssss',
  'ssssssnNssssss',
  '.ssss.nNN.sss.',
  '..ss..nnN..ss.',
  '......nNN.....',
  '..rrrrrrrrrr..',
  '.rmtmmmmmmtmr.',
  'rmmmmmmmmmmmmr',
  'rmmmmmmmmmmmmr',
  '.rmtmmmmmmtmr.',
  '..rrmmmmmmrr..',
  '....rrrrrr....',
];

function makeEntFrame(kind, name) {
  const L = ENT_LOOK[kind], seed = 9000 + Object.keys(ENT_LOOK).indexOf(kind) * 97;
  srand = mulberry32(seed);
  const F = PX_FINE, [cv, c] = mkSprite(ENT_SW, ENT_SH, F > 1 ? 2 * F : SS);   // мелкий пиксель: F деталей на игровой
  const P = entPose(name, L);
  drawEntBody(c, kind, L, P, seed);
  drawEntCrown(c, kind, L, seed);
  drawEntArms(c, kind, L, P, seed);
  grain(cv, 0.08, seed);
  const out = toPixelArt(cv, F > 1 ? 2 : SS, { outline: true, alphaCut: 100 });
  out.fine = F;
  const oc = out.getContext('2d');
  const x0 = ENT_CX - 7;
  const pal = { h: L.light, o: '#140a05', s: '#0a0503', n: L.light, N: L.dark, r: '#140a05', m: '#050201', t: '#d0b88c' };
  ENT_FACE.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] !== '.') { oc.fillStyle = pal[row[x]]; oc.fillRect((x0 + x) * F, (L.faceY + y) * F, F, F); }
  });
  return { cv: out, eyes: [[x0 + 2, L.faceY + 6], [x0 + 10, L.faceY + 6]], hand: P.arms[1][2] };
}

// Новый кадр энта строится десятки мс (на телефоне до 100): в кадре игры при готовом кадре того же вида —
// пока он, новый по бюджету тяжёлых сборок (heavyBuildOk, people.js)
const ENT_LAST = {};
function entSprite(kind, name) {
  const key = kind + name;
  if (ENT_SPR[key]) return (ENT_LAST[kind] = ENT_SPR[key]);
  const fb = ENT_LAST[kind];
  if (fb && typeof heavyBuildOk === 'function' && R.inFrame && (!heavyBuildOk(true) || !spriteBudgetOk(true))) return fb;
  const t0 = performance.now();
  ENT_SPR[key] = makeEntFrame(kind, name);
  if (fb && typeof heavySpent === 'function' && R.inFrame) { spriteSpent(t0); heavySpent(t0); }
  return (ENT_LAST[kind] = ENT_SPR[key]);
}

function entBase(e) {
  const h = hash(e.i);
  if (e.water) return { spr: null, kind: 'water', bx: Math.round(e.x * TILE), by: Math.round(e.y * TILE + 12) };
  if (e.rock) return { spr: null, kind: 'rock', bx: Math.round(e.x * TILE + ((h >>> 5) % 15) - 7), by: Math.round(e.y * TILE + 10 + ((h >>> 9) % 11) - 5) };
  return {
    spr: SPR.trees[h % SPR.trees.length],
    kind: ENT_KIND[h % SPR.trees.length] || 'oak',
    bx: Math.round(e.x * TILE + ((h >>> 4) % 7) - 3),
    by: Math.round(e.y * TILE + 12 + ((h >>> 12) % 5) - 2),
  };
}

function entFrameName(e) {
  if (e.state === 'fight' || e.state === 'smash') {
    // замах ветвями и удар, иначе стоит и ждёт
    const a = e.atk ? Game.time - e.atk : 9;
    return a < 0.35 ? 'f0' : a < 0.8 ? 'f1' : 'idle';
  }
  if (e.state === 'dying') return 'f0';           // вскинул ветви от боли
  if (e.state === 'drag') {
    const gi = grabIdx(e.t);
    return gi < 9 ? 'g' + gi : 'cw' + (Math.floor(e.phase / 1.7 * 2) & 7);
  }
  if (e.moving) return 'w' + (Math.floor(e.phase / 1.7 * 2) & 7);
  return 'idle';
}

// где сейчас кулак, держащий гнома (мировые пиксели)
function entHandWorld(e) {
  if (e.water) return waterEntHand(e);
  if (e.rock) return rockEntHand(e);
  const { kind, bx, by } = entBase(e);
  const f = entSprite(kind, entFrameName(e));
  return { x: bx + (f.hand[0] - ENT_CX) * (e.face < 0 ? -1 : 1), y: by + Math.round((1 - e.k) * 40) + f.hand[1] - ENT_BASE };
}

// глаза на стволе ещё спящего дерева: у лиственных ствол виден выше, у хвойных — у самой земли
function treeEyePos(e) {
  const { bx, by, kind } = entBase(e);
  return { x: bx, y: by - (kind === 'oak' || kind === 'birch' ? 26 : 11) };
}

// цвет глаз по виду нечисти: дерево — жёлтый, камень — красный, водяной — зелёный (rgb-строка; fl — мерцание 130..210)
const EYE_RGB = { tree: '255,214,80', rock: '255,84,64', water: '120,255,150' };
const eyeFlick = (fl, kind) => { const k = (fl + 40) / 250, [r, g, b] = EYE_RGB[kind].split(',').map(Number); return `rgb(${Math.min(255, Math.round(r * k))},${Math.min(255, Math.round(g * k))},${Math.min(255, Math.round(b * k))})`; };

function drawTreeEyes(c, e, a) {
  if (e.water) return drawWaterEyes(c, e, a);
  if (e.rock) return drawRockEyes(c, e, a);
  const p = treeEyePos(e);
  const blink = (Game.time * 0.37 + e.i * 0.13) % 1 < 0.04;     // изредка моргает
  const fl = 150 + Math.round(Math.sin(Game.time * 6 + e.i) * 40);
  c.save();
  c.globalAlpha = a;
  c.globalCompositeOperation = 'lighter';
  nightSprites();
  c.drawImage(NIGHT.eerie, p.x - 7, p.y - 4, 14, 8);
  c.globalCompositeOperation = 'source-over';
  c.fillStyle = '#140a05';
  c.fillRect(p.x - 4, p.y - 1, 3, 2); c.fillRect(p.x + 1, p.y - 1, 3, 2);
  if (!blink) {
    c.fillStyle = eyeFlick(fl, 'tree');
    c.fillRect(p.x - 3.5, p.y - 0.5, 2, 1); c.fillRect(p.x + 1.5, p.y - 0.5, 2, 1);
  }
  c.restore();
}

// где глаза в мире (для свечения сквозь туман)
function entFacePos(e) {
  if (e.water) return waterEyeCenter(e);
  if (e.rock) return rockEyeCenter(e);
  if (e.k < 0.3) return treeEyePos(e);
  const { bx, by, kind } = entBase(e);
  const f = entSprite(kind, entFrameName(e));
  const rise = Math.round((1 - e.k) * 40);
  return { x: bx + (f.eyes[0][0] + f.eyes[1][0]) / 2 + 1 - ENT_CX, y: by + rise - ENT_BASE + f.eyes[0][1] + 1 };
}

function drawEnt(c, e) {
  if (e.water) return drawWaterEnt(c, e);
  if (e.rock) return drawRockEnt(c, e);
  const { spr, kind, bx, by } = entBase(e);
  const k = e.k;
  c.save();
  c.globalAlpha = e.alpha;
  c.imageSmoothingEnabled = R.smooth;
  c.fillStyle = 'rgba(12,18,6,0.4)';
  c.beginPath(); c.ellipse(bx + 4, by - 1, 22, 7, 0, 0, 7); c.fill();
  if (e.state === 'dying') {
    // шатается, потом медленно и всё быстрее заваливается
    const ang = e.t < 1 ? Math.sin(e.t * 18) * 0.05 * (1 - e.t * 0.5) : Math.pow(Math.min(1, (e.t - 1) / 1.2), 2.2) * Math.PI / 2 * 0.95;
    c.translate(bx, by); c.rotate(e.fallDir * ang); c.translate(-bx, -by);
  }
  // от удара топором вздрагивает
  if (e.hitT && Game.time - e.hitT < 0.25) c.translate(Math.round(Math.sin(Game.time * 80) * 2), 0);
  // ещё спит или только просыпается — обычное дерево растворяется
  if (k < 1) {
    c.globalAlpha = e.alpha * (1 - k);
    c.drawImage(spr, Math.round(bx - spr.width / 2), Math.round(by - spr.height * (88 / 92)));
    if (k < 0.3) drawTreeEyes(c, e, e.alpha * (1 - k / 0.3) * Math.min(1, nightAmt() * 4));
  }
  if (k > 0) {
    const f = entSprite(kind, entFrameName(e));
    const rise = Math.round((1 - k) * 40);              // вылезает из-под земли
    c.globalAlpha = e.alpha * Math.min(1, k * 1.6);
    c.save();
    c.beginPath(); c.rect(bx - ENT_SW, by - ENT_SH - 10, ENT_SW * 2, ENT_SH + 11); c.clip();
    const sway = e.state === 'fight' ? Math.sin(e.t * 9) * 0.05 : e.moving ? Math.sin(e.phase * 0.85) * 0.03 : 0;
    c.translate(bx, by + rise); c.rotate(sway);
    if (e.face < 0) c.scale(-1, 1);
    blitFine(c, f.cv, -ENT_CX, -ENT_BASE);
    // зрачки тлеют и косятся
    const look = Math.sin(Game.time * 0.7 + e.i) > 0.3 ? 1 : 0;
    const fl = 170 + Math.round(Math.sin(Game.time * 8 + e.i) * 40);
    if (e.state !== 'dying' || e.t < 0.5) for (const [ex, ey] of f.eyes) {   // после смертельного удара глаза гаснут
      c.fillStyle = eyeFlick(fl, 'tree'); c.fillRect(ex - ENT_CX + look, ey - ENT_BASE, 2, 2);
      c.fillStyle = '#eafff4'; c.fillRect(ex - ENT_CX + look, ey - ENT_BASE, 1, 1);
    }
    c.restore();
    // комья земли, пока вылезает или уходит в землю
    if (e.state === 'emerge' || e.state === 'root') {
      c.fillStyle = '#4a3020';
      for (let j = 0; j < 8; j++) {
        const p = (e.t * 1.3 + j / 8) % 1;
        c.fillRect(Math.round(bx - 16 + j * 4.4), Math.round(by - 2 - Math.sin(p * Math.PI) * 8), 2, 2);
      }
    }
    if (e.state === 'drag' && (e.victim || e.vsnap)) drawVictim(c, e);
  }
  c.restore();
}

// Схваченный гном: сначала стоит и трясётся, потом его поднимают в кулаке —
// дрыгает ногами, машет руками и вырывается
function drawVictimRock(c, e) {
  const v = e.victim || e.vsnap;
  const t = e.t;
  const gx = e.vx0 * TILE, gy = e.vy0 * TILE + 6;                  // где стоял (ступни)
  const h = entHandWorld(e);
  const p = t < GRAB_REACH ? 0 : Math.min(1, (t - GRAB_REACH) / (GRAB_LIFT - GRAB_REACH));
  const ease = p * p * (3 - 2 * p);
  const fx = gx + (h.x - gx) * ease, fy = gy + (h.y + 15 - gy) * ease;   // кулак сжимает поясом
  const held = p > 0.05;
  // тень на земле тает, пока поднимают
  c.fillStyle = `rgba(10,8,4,${0.32 * (1 - ease)})`;
  c.beginPath(); c.ellipse(gx + 1.5, gy, 5.5, 2, 0, 0, 7); c.fill();
  const opt = { gait: '', gest: 'panic', gf: gestCyc(Game.time * (held ? 10 : 6) + v.id) };
  const spr = held ? personSprite(v, 'S', 'walk', Math.floor(Game.time * 16) & 7, opt) : personSprite(v, 'S', 'idle', 0, opt);
  c.save();
  const shake = held ? 0 : (Math.floor(Game.time * 30) & 1 ? 0.8 : -0.8);   // трясётся от ужаса
  c.translate(Math.round(fx + shake), Math.round(fy - 14));
  if (held) c.rotate(Math.sin(Game.time * 9 + v.id) * 0.3);                // вырывается
  c.drawImage(spr, -PFX, -PFY + 14, PW, PH);
  c.restore();
  // кулак поверх гнома: когти обхватывают пояс
  if (held && !e.rock) {
    const L = ENT_LOOK[entBase(e).kind], LL = L.limb || L;
    c.fillStyle = '#140a05'; c.fillRect(Math.round(h.x) - 5, Math.round(h.y) - 3, 10, 6);
    c.fillStyle = LL.bark; c.fillRect(Math.round(h.x) - 4, Math.round(h.y) - 2, 8, 4);
    c.fillStyle = LL.light; c.fillRect(Math.round(h.x) - 4, Math.round(h.y) - 2, 8, 1);
  }
  if (!held) { c.fillStyle = '#ff6040'; c.font = 'bold 9px serif'; c.fillText('!', Math.round(gx) - 1, Math.round(gy) - 32); }
}

// Схваченный гном (дерево, водяной): стоит и трясётся, пока тянется рука, затем ладонь сжимается пальцами
// (кадр g4), и его поднимают — гном всё время в кисти: дрыгает ногами, машет руками, вырывается.
// Камень — по-старому (drawVictimRock).
function drawVictim(c, e) {
  if (e.rock) return drawVictimRock(c, e);
  const v = e.victim || e.vsnap, gi = grabIdx(e.t);
  const gx = e.vx0 * TILE, gy = e.vy0 * TILE + 6;                  // где стоял (ступни)
  const h = entHandWorld(e), f = e.face < 0 ? -1 : 1;
  const held = gi >= 4;
  // тень на земле тает, пока поднимают
  const lift = held ? Math.min(1, (gi - 4) / 3) : 0;
  c.fillStyle = `rgba(10,8,4,${0.32 * (1 - lift)})`;
  c.beginPath(); c.ellipse(gx + 1.5, gy, 5.5, 2, 0, 0, 7); c.fill();
  if (held) drawGrabbed(c, v, h.x + f * 2, h.y + 1, 0, true);     // в кисти, примерно за пояс
  else drawGrabbed(c, v, gx, gy - 14, 0, false);
  // пальцы поверх гнома: к кадру g4 сжимаются, до этого кисть раскрыта
  const k = gi < 3 ? 0 : gi === 3 ? 0.5 : 1;
  const pal = e.water ? { out: '#0a2744', fill: '#4aa6dc', hi: '#e8fbff' } : (() => { const L = ENT_LOOK[entBase(e).kind], LL = L.limb || L; return { out: '#140a05', fill: LL.bark, hi: LL.light }; })();
  if (gi >= 2) drawGrip(c, Math.round(h.x), Math.round(h.y), f, k, pal, e.water ? 1.35 : 1.35);
  if (!held) { c.fillStyle = '#ff6040'; c.font = 'bold 9px serif'; c.fillText('!', Math.round(gx) - 1, Math.round(gy) - 32); }
}

// Бревно от срубленного ходячего дерева
function drawLog(c, x, y) {
  const px = x * TILE + 4, py = y * TILE + 18;
  c.fillStyle = 'rgba(10,8,4,0.35)';
  c.beginPath(); c.ellipse(px + 13, py + 6, 14, 3, 0, 0, 7); c.fill();
  c.fillStyle = '#24160c'; c.fillRect(px, py - 1, 24, 8);
  c.fillStyle = '#6a4428'; c.fillRect(px + 1, py, 22, 6);
  c.fillStyle = '#4a2e1a'; for (let k = 0; k < 4; k++) c.fillRect(px + 3 + k * 5, py + 1 + (k % 2) * 2, 3, 1);
  c.fillStyle = '#8a5a34'; c.fillRect(px + 1, py, 22, 1);
  // торец с кольцами
  c.fillStyle = '#24160c'; c.beginPath(); c.ellipse(px + 24, py + 3, 3.4, 4.4, 0, 0, 7); c.fill();
  c.fillStyle = '#cc9a64'; c.beginPath(); c.ellipse(px + 24, py + 3, 2.6, 3.6, 0, 0, 7); c.fill();
  c.strokeStyle = '#a06840'; c.lineWidth = 0.6; c.beginPath(); c.ellipse(px + 24, py + 3, 1.4, 2, 0, 0, 7); c.stroke();
  // сучок
  c.fillStyle = '#4a2e1a'; c.fillRect(px + 8, py - 3, 2, 3);
}

// Фонарь в руке, «?» над потерявшимся, «!» у паникующего
function drawNightUnit(c, u, px, py, face, view, lying) {
  const n = nightAmt();
  if (lanternLit(u) && !lying && u.anim !== 'fly') {
    const side = view === 'E' ? face : 1;
    const sw = Math.sin(u.walkPhase * 0.9) * 0.8;
    const lx = Math.round(px + side * 6.5 + sw), ly = py - 11;
    c.strokeStyle = '#1a1410'; c.lineWidth = 0.7;
    c.beginPath(); c.moveTo(lx, ly - 4); c.lineTo(lx, ly - 2); c.stroke();
    c.fillStyle = '#1a1410'; c.fillRect(lx - 2, ly - 2, 4, 5);
    const fl = 200 + Math.round(Math.sin(Game.time * 9 + u.id) * 30);
    c.fillStyle = '#6a2c10'; c.fillRect(lx - 1.2, ly - 1.2, 2.4, 3.4);
    drawFire(c, lx, ly + 2, 'tiny', Game.time, u.id, { glow: 0 });
    c.fillStyle = '#1a1410'; c.fillRect(lx - 2.4, ly - 2.6, 4.8, 0.9);
    glow(c, lx, ly, 9, '255,200,110', 0.35 * n);
  }
  const brk = u.brk && u.brk.kind;
  if (brk === 'lost') {
    c.fillStyle = '#d8e0ff'; c.font = 'bold 8px serif';
    c.fillText('?', px - 2, py - 30 + Math.sin(Game.time * 3 + u.id) * 1.5);
  } else if (u.panicUntil > Game.time || brk === 'freeze') {
    c.fillStyle = '#ff6040'; c.font = 'bold 8px serif';
    c.fillText('!', px - 1, py - 30 + Math.sin(Game.time * 9 + u.id));
  }
}


function nearLamp(x, y, r) {
  const cx = Math.floor(x), cy = Math.floor(y), R2 = Math.ceil(r);
  for (let yy = cy - R2; yy <= cy + R2; yy++) for (let xx = cx - R2; xx <= cx + R2; xx++) {
    if (!inb(xx, yy)) continue;
    const o = World.obj[idx(xx, yy)];
    if (o && o.t === 'lamp' && !o.out && Math.hypot(xx + 0.5 - x, yy + 0.5 - y) <= r) return true;
  }
  return false;
}

function storeB0() { return Game.buildings.find(b => b.isStore() && !b.isPile); }
function entName(e) { return e.rock ? 'Ходячий камень' : e.water ? 'Водяной' : 'Ходячее дерево'; }
