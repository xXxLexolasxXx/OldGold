'use strict';
// Детские забавы и взросление (поверх family.js и games.js).
// 1) Игры гномят: классики (games.js), городки (бита, фигура из чурок, бросок и разлёт), песочные замки на пляже
//    (башня, крепость, дворец; стоят игровые сутки, смываются волной, дождём или осыпаются), снежки зимой.
//    Все движения покадрово (КАДРЫ.md): бросок — 9 кадров, хлопанье по песку — 8, трубка с пузырями — 6, пузырь — 6.
// 2) Приручение: гномёнок зовёт зверька (кролик, коза, лиса, волчонок), с вероятностью 80 % зверёк его признаёт
//    (питомцы из pets.js). Хищник при неудаче кусается.
// 3) Игрушечная трубка: пускает мыльные пузыри, никакого табака. Рисуется на месте курева (smoking.js).
// 4) Взросление: гномёнок выбирает дело по нехватке рук в деревне — еда, дрова, стройка, оборона; иначе семейное ремесло.
// Всё считает сервер: игры — плоские объекты Game.games (kind 'gorodki'/'snow'), замки — клетки World.obj {t:'sandc'}
// (b — когда заложен, bd — сколько строился, w — когда смыло), трубка — u.kp. Сейв: замки в obj (save.js), игры не хранятся.

const KP_P = 0.6;                 // шанс, что свободный гномёнок затеет особую игру вместо обычной возни
const KP_GAP = [18, 40];          // пауза между затеями одного гномёнка, сек
const KP_TAME = 0.8;              // шанс, что зверёк признал гномёнка
const KP_PETS = 2;                // питомцев на гномёнка
const KP_CASTLES = 4;             // песочных замков на карте
const KP_NEAR = 16;               // как далеко гномёнок видит зверька
const TOSS_DUR = 1.0;             // бросок: 9 кадров
const TOSS_REL = 6 / 9;           // кадр отпускания
const PIN_G = 130;                // «тяжесть» разлетающихся чурок, px/с²
const SANDC_BD = [7, 9.5, 12];    // сколько строятся башня, крепость, дворец, сек
const TOY_NAMES = ['Колодец', 'Пушка', 'Звезда'];

const kpMirror = () => typeof famMirror === 'function' && famMirror();
const kpPick = a => a[(Math.random() * a.length) | 0];
const kpRand = (a, b) => a + Math.random() * (b - a);
const kpSay = (u, t, col = '#fff6d0') => floater(u.x, u.y - 1.2, t, col);
const kpWinter = () => (typeof isWinter === 'function' && isWinter()) || (typeof SEA === 'function' && SEA().snow > 0.4);

Object.assign(SFX, {
  knock:   (d, t) => { tone(d, 'triangle', 430, 210, t, 0.09, 0.3, 0.002); tone(d, 'sine', 310, 150, t + 0.05, 0.08, 0.24, 0.002); noiseHit(d, 'bandpass', 1900, 900, 1.4, t, 0.05, 0.22, 0.001); },
  pinSet:  (d, t) => { tone(d, 'triangle', 330, 240, t, 0.05, 0.2, 0.002); tone(d, 'triangle', 380, 280, t + 0.07, 0.05, 0.18, 0.002); },
  snowHit: (d, t) => { noiseHit(d, 'lowpass', 1500, 500, 1, t, 0.12, 0.24, 0.004); },
});
Object.assign(SFX_DEF, {
  knock:   { pri: 1, gain: 0.5,  poly: 3, cd: 0.08, len: 0.3 },
  pinSet:  { pri: 0, gain: 0.35, poly: 2, cd: 0.1,  len: 0.2 },
  snowHit: { pri: 0, gain: 0.4,  poly: 3, cd: 0.1,  len: 0.2 },
});
Object.assign(FLOAT_SFX, { 'Вышибли!': 'cheer', 'Фигура!': 'cheer', 'Снегом!': 'snowHit' });

// ---------- Кадры броска и хлопанья ----------

const _swingFrameKids = swingFrame;
swingFrame = function (u) {
  if (u.__tf !== undefined) return u.__tf;                       // бросок в групповой игре: кадр по времени броска
  if (u.anim === 'pat') {                                        // хлопает по песку: 8 кадров по кругу
    const a = u.action, n = a && a.T ? Math.max(1, Math.round(a.T / 0.9)) : 1;
    const p = a && a.T ? ((1 - Math.max(0, a.t) / a.T) * n) % 1 : (Game.time * 1.1) % 1;
    return Math.min(7, Math.floor(p * 8));
  }
  return _swingFrameKids(u);
};

// ---------- Выбор забавы ----------

const _kidGenBase = kidGen;
kidGen = function (u) {
  const kind = kpMirror() ? null : kidPlayPick(u);
  return kind ? kpRun(u, kind) : _kidGenBase(u);
};

function kidPlayPick(u) {
  if (Game.time < (u.kpAt || 0) || u.gp || u.eat || !gameWeatherOK() || Math.random() > KP_P) return null;
  const ok = [];
  ok.push('pipe', 'pipe');
  if (startOpen('games')) {
    ok.push('gorodki', 'gorodki', 'hop');
    if (kpWinter()) ok.push('snow', 'snow', 'snow', 'snow');
  }
  if (!kpWinter() && sandCount() < KP_CASTLES) ok.push('sand', 'sand', 'sand');
  if (tameTarget(u)) ok.push('tame', 'tame', 'tame');
  const k = kpPick(ok);
  u.kpAt = Game.time + kpRand(KP_GAP[0], KP_GAP[1]);
  return k;
}

// Запускаем внутри работающего процесса гномёнка: группа проверяет, что его proc — это его же игра
function* kpRun(u, kind) {
  let gen = null;
  switch (kind) {
    case 'pipe': gen = pipeGen(u); break;
    case 'sand': gen = sandGen(u); break;
    case 'tame': gen = tameGen(u); break;
    case 'gorodki': gen = startGorodki(u); break;
    case 'snow': gen = startSnow(u); break;
    case 'hop': gen = startHop(u); break;
  }
  if (gen) yield* gen; else yield { wait: 0.6 };
}

// Подбор компании из свободных гномят
function kidRecruits(leader, n) {
  const c = [];
  for (const o of Game.units) {
    if (o === leader || o.type !== 'kid' || o.dead || o.inside || o.brk || o.gp || o.eat || o.food < HUNGRY || o.injury === 'leg') continue;
    const d = Math.hypot(o.x - leader.x, o.y - leader.y);
    if (d < GAME_FAR) c.push([d, o]);
  }
  c.sort((a, b) => a[0] - b[0]);
  return c.slice(0, n).map(e => e[1]);
}

// ---------- Игрушечная трубка ----------

function* pipeGen(u) {
  const n = Math.random() < 0.5 ? 2 : 1;
  u.kp = { k: 'pipe', t0: Game.time, x: u.x, y: u.y, end: Game.time + n * SM_CYCLE };
  kpSay(u, kpPick(['Пузырики!', 'Пуф-пуф!', 'Смотри, пузыри!']), '#cfeaff');
  yield { wait: n * SM_CYCLE, anim: 'smoke' };
  yield { wait: 2.6 };                                            // последние пузыри долетают
  u.kp = null;
}

const IRIS = ['#bfeaff', '#ffd0f0', '#d8ffc8', '#fff0b0'];
const BUB_RING = {
  1: [[0, 0]],
  2: [[0, 0], [1, 0], [0, 1], [1, 1]],
  3: [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
  4: [[1, 0], [2, 0], [0, 1], [3, 1], [0, 2], [3, 2], [1, 3], [2, 3]],
  6: [[2, 0], [3, 0], [1, 1], [4, 1], [0, 2], [5, 2], [0, 3], [5, 3], [1, 4], [4, 4], [2, 5], [3, 5]],
};
const bubRand = (a, b) => { const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return n - Math.floor(n); };

// Шесть кадров пузыря: 0–2 надувается (1,2,3 px), 3 плывёт и переливается (4 px), 4 лопнул кольцом, 5 брызги
function drawBubble(c, x, y, age, life, seed) {
  const pop = life - 0.2;
  let f, k = 0;
  if (age < 0.1) f = 0; else if (age < 0.22) f = 1; else if (age < 0.4) f = 2; else if (age < pop) f = 3; else if (age < pop + 0.1) f = 4; else f = 5;
  const rim = IRIS[(Math.floor(age * 4) + seed) & 3];
  x = Math.round(x); y = Math.round(y);
  if (f <= 3) {
    const s = [1, 2, 3, 4][f], ring = BUB_RING[s];
    if (s >= 3) { c.fillStyle = 'rgba(224,240,255,0.2)'; c.fillRect(x + 1, y + 1, s - 2, s - 2); }
    c.fillStyle = rim; c.globalAlpha = 0.9;
    for (const [dx, dy] of ring) c.fillRect(x + dx, y + dy, 1, 1);
    c.globalAlpha = 1;
    if (s >= 3) { c.fillStyle = '#ffffff'; c.fillRect(x + 1, y + 1, 1, 1); }
  } else if (f === 4) {
    c.fillStyle = rim; c.globalAlpha = 0.55;
    for (const [dx, dy] of BUB_RING[6]) c.fillRect(x - 1 + dx, y - 1 + dy, 1, 1);
    c.globalAlpha = 1;
  } else {
    const q = Math.min(1, (age - pop - 0.1) / 0.1);
    c.fillStyle = '#ffffff'; c.globalAlpha = 0.8 * (1 - q * 0.5);
    for (const [dx, dy] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) c.fillRect(Math.round(x + 1.5 + dx * (0.6 + q * 0.7)), Math.round(y + 1.5 + dy * (0.6 + q * 0.7)), 1, 1);
    c.globalAlpha = 1;
  }
}

// Пузыри из игрушечной трубки, пока гномёнок дует и ещё 2,6 с после: четыре за затяжку на кадре «выдох»
function drawBubbles(c, u) {
  const kp = u.kp, now = Game.time;
  if (!kp || kp.k !== 'pipe') return;
  const V = typeof smokeViewOf === 'function' ? smokeViewOf(u) : 'E', hand = SMOKE_ARM[V].hand[5], face = V === 'E' ? (u.face < 0 ? -1 : 1) : 1;
  const bx = kp.x * TILE + (V === 'E' ? face * (hand[0] + 2.4) : hand[0] + 1) * 0.68, by = kp.y * TILE + 6 + (hand[1] - 2) * 0.68;
  const off = (u.id | 0) * 0.73, c0 = Math.floor((kp.t0 + off) / SM_CYCLE) - 1, c1 = Math.floor((now + off) / SM_CYCLE);
  c.save();
  for (let n = c0; n <= c1; n++) for (let j = 0; j < 4; j++) {
    const tb = n * SM_CYCLE - off + 2.9 + j * 0.35;
    if (tb < kp.t0 || tb > kp.end) continue;
    const age = now - tb, seed = (n * 7 + j * 3 + (u.id | 0)) | 0, life = 1.6 + bubRand(seed, 1) * 1.0;
    if (age < 0 || age > life) continue;
    const drift = (bubRand(seed, 2) - 0.3) * 4.5;
    drawBubble(c, bx + face * (age * (3 + drift)) + Math.sin(age * 2.3 + seed) * 2, by - age * (5 + bubRand(seed, 3) * 3), age, life, seed);
  }
  c.restore();
}

// Игрушечная трубка вместо курева: деревянный чубук, яркая чашечка, трубка тянется ко рту
function drawToyPipe(c, u, px, py, view) {
  const V = view === 'E' ? 'E' : 'S', fr = smokeFrameOf(u), face = V === 'E' ? (u.face < 0 ? -1 : 1) : 1;
  const hand = SMOKE_ARM[V].hand[fr], mouth = SMOKE_MOUTH[V];
  let dx = mouth[0] - hand[0], dy = mouth[1] - hand[1];
  const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
  const col = ['#e04a4a', '#4a8ae0', '#e0b030', '#4ab060'][(u.id | 0) & 3];
  c.save(); c.translate(px, py); if (face < 0) c.scale(-1, 1);
  const P = (x, y, w, h, cc) => { c.fillStyle = cc; c.fillRect(Math.round(x * 3) / 3, Math.round(y * 3) / 3, w, h); };
  for (let t = -2.6; t <= 3.4; t += 0.34) P(hand[0] + dx * t, hand[1] + dy * t, 0.67, 0.67, t > 2.2 ? '#f2d89a' : '#9a6a38');      // чубук, мундштук светлее
  const cx = hand[0] - dx * 3.2, cy = hand[1] - dy * 3.2;
  P(cx - 1, cy - 1.3, 2.4, 2.4, '#3a2214');
  P(cx - 0.67, cy - 1, 1.67, 1.67, col);
  P(cx - 0.67, cy - 1, 0.67, 0.67, '#ffffff');
  c.restore();
}

const _drawSmokingKids = drawSmoking;
drawSmoking = function (c, u, px, py, view) {
  if (u.type === 'kid') { drawToyPipe(c, u, px, py, view); return; }
  _drawSmokingKids(c, u, px, py, view);
};

// ---------- Приручение ----------

const TAME_KINDS = ['rabbit', 'goat', 'fox', 'wolf'];
const TAME_SAY = { rabbit: ['Кролик, иди сюда!', 'Какой пушистый!'], goat: ['Козочка, не бойся!', 'Дай погладить!'], fox: ['Лисичка, рыжая!', 'Не бойся, я добрый'], wolf: ['Волчонок! Не кусайся', 'Иди ко мне, серенький'] };

function tameTarget(u) {
  if (Game.animals.filter(a => a.owner === u.id).length >= KP_PETS) return null;
  return nearestAnimal(u.x, u.y, KP_NEAR, a => TAME_KINDS.includes(a.kind) && !a.owner && !a.tamedBy && !a.follow && !a.dead && !a.hunted && !a.loot
    && a.state !== 'petchase' && a.state !== 'chase' && a.state !== 'flee' && !isWaterAt(Math.floor(a.x), Math.floor(a.y)) && canTame(u, a.kind));
}

function* tameGen(u, target) {
  const pet = target || tameTarget(u);
  if (!pet) return;
  const pred = pet.kind === 'fox' || pet.kind === 'wolf';
  kpSay(u, kpPick(TAME_SAY[pet.kind]), '#ffe8c0');
  pet.calm = Game.time + 16;                                      // замер и смотрит: не убегает и не крадёт
  const s = [Math.floor(pet.x), Math.floor(pet.y)];
  if (!isWalkable(s[0], s[1])) { pet.calm = 0; return; }
  const ok = yield { walk: s, offroad: true };
  if (!ok || pet.dead || pet.owner || Math.hypot(pet.x - u.x, pet.y - u.y) > 2.5) { pet.calm = 0; return; }
  faceTo(u, pet.x, pet.y);
  yield { wait: 2.4, anim: 'tame' };                              // протягивает руку с горбушкой
  if (pet.dead || pet.owner || !canTame(u, pet.kind)) { pet.calm = 0; return; }
  if (Math.random() < KP_TAME) {
    setTame(pet, u);
    pet.calm = 0;
    if (pred) pet.errCD = Game.time + 1e6;                        // хищники посылок не носят
  } else {
    pet.calm = 0;
    if (pred) {
      floater(pet.x, pet.y - 1, 'Р-р!', '#ffb0a0'); floater(u.x, u.y - 1.3, 'Кусается!', '#ffb0a0');
      u.ouchUntil = Game.time + 1.6; injure(u, 'arm'); u.food = Math.max(0, u.food - 0.15);
      logEvent('animal', `Гномёнок полез к ${pet.kind === 'wolf' ? 'волчонку' : 'лисе'} и был укушен`, u.x, u.y);
      pet.state = 'flee'; pet.fleeBoost = Game.time + 5;
      yield { wait: 1.6, anim: 'knocked' };
    } else {
      floater(u.x, u.y - 1.2, 'Убежал…', '#e8e0c0');
      pet.state = 'flee'; pet.fleeBoost = Game.time + 3;
      yield { wait: 1.2 };
    }
  }
}

// хищники-питомцы посылок не носят
const _startErrandKids = startErrand;
startErrand = function (a, u) {
  if (a.kind === 'fox' || a.kind === 'wolf') { a.errCD = Game.time + 1e6; return; }
  _startErrandKids(a, u);
};

// ---------- Песочные замки ----------

const sandList = () => { const a = []; for (let i = 0; i < N_TILES; i++) { const o = World.obj[i]; if (o && o.t === 'sandc') a.push(i); } return a; };
const sandCount = () => sandList().length;

function sandSpot(u) {
  const ux = Math.floor(u.x), uy = Math.floor(u.y), have = sandList().map(i => [i % MAP_W, (i / MAP_W) | 0]), c = [];
  for (let y = uy - 20; y <= uy + 20; y++) for (let x = ux - 20; x <= ux + 20; x++) {
    if (!inb(x, y) || !inb(x, y + 1)) continue;
    const i = idx(x, y);
    if (World.terrain[i] !== T_SAND || World.obj[i] || World.road[i] || World.door[i] || World.bmap[i] || Game.piles.has(i) || !isWalkable(x, y)) continue;
    const j = idx(x, y + 1);
    if (World.terrain[j] === T_WATER || !isWalkable(x, y + 1) || World.door[j] || World.bmap[j]) continue;
    let water = false;
    for (let yy = y - 3; yy <= y + 3 && !water; yy++) for (let xx = x - 3; xx <= x + 3; xx++) if (inb(xx, yy) && isWaterAt(xx, yy)) { water = true; break; }
    if (!water || have.some(h => Math.hypot(h[0] - x, h[1] - y) < 3.5)) continue;
    c.push([Math.hypot(x - u.x, y - u.y), x, y]);
  }
  if (!c.length) return null;
  c.sort((a, b) => a[0] - b[0]);
  const p = c[(Math.random() * Math.min(8, c.length)) | 0];
  return { cx: p[1], cy: p[2], sx: p[1], sy: p[2] + 1 };
}

function* sandGen(u, spot) {
  const sp = spot || sandSpot(u);
  if (!sp) return;
  if (!(yield { walk: [sp.sx, sp.sy], offroad: true })) return;
  const i = idx(sp.cx, sp.cy);
  if (World.obj[i] || Math.hypot(u.x - (sp.sx + 0.5), u.y - (sp.sy + 0.5)) > 1.5) return;
  const v = (Math.random() * 3) | 0, bd = SANDC_BD[v];
  World.obj[i] = { t: 'sandc', v, b: Game.time, bd };
  u.face = Math.random() < 0.5 ? 1 : -1;
  kpSay(u, kpPick(['Строю замок!', ['Башня!', 'Крепость!', 'Дворец!'][v]]), '#ffe9a0');
  for (let t = bd; t > 0.05; t -= 1.1) yield { wait: Math.min(1.1, t), anim: 'pat' };
  floater(u.x, u.y - 1.3, 'Готово!', '#fff2a0');
  u.gest = 'wave'; u.gestUntil = Game.time + 1.6;
  yield { wait: 1.6 };
}

// Живёт игровые сутки после завершения; смывает волна (раз в несколько минут), дождь, а к концу срока оседает
function sandTick(step) {
  const now = Game.time, rain = typeof WX !== 'undefined' && WX.k > 0.5;
  for (const i of sandList()) {
    const o = World.obj[i], x = i % MAP_W, y = (i / MAP_W) | 0;
    if (o.w) {
      if (now - o.w > 1.7) { World.obj[i] = null; fxBurst((x + 0.5) * TILE, (y + 0.7) * TILE, 8, ['#e6cf93', '#c2a468', '#f3e2b0'], 26, 12, 0.7, 1.4, 90); }
      continue;
    }
    const age = now - o.b - o.bd;
    if (age < 0) continue;
    let why = null;
    if (rain && Math.random() < 0.3) why = 'rain';
    else if (Math.random() < step / (CYCLE * 0.6)) why = 'wave';
    else if (age > CYCLE) why = 'time';
    if (!why) continue;
    o.w = now;
    if (why === 'wave') { fxBurst((x + 0.5) * TILE, (y + 0.6) * TILE, 10, ['#e8f4ff', '#bcd8f0', '#ffffff'], 40, 16, 0.6, 1.6, 120); if (typeof sfxAt === 'function') sfxAt('snowHit', (x + 0.5) * TILE, (y + 0.5) * TILE, 0.7); }
    for (const u of Game.units) if (u.type === 'kid' && !u.dead && !u.inside && Math.hypot(u.x - x, u.y - y) < 6 && Math.random() < 0.5) { kpSay(u, kpPick(['Смыло!', 'Мой замок!', 'Построю новый']), '#cfe4ff'); break; }
  }
}

// Три замка пикселями; progress 0..1 открывает сверху вниз то, что построено
const SC = { l: '#f3e2b0', m: '#e2c986', d: '#c4a566', k: '#9a8050', w: '#b99a5c', r: '#d8403a', p: '#8a5a2a', s: '#f4a8a0' };
function scRect(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
function scBlock(c, x, y, w, h) { scRect(c, x, y, w, h, SC.m); scRect(c, x, y, 1, h, SC.l); scRect(c, x + w - 1, y, 1, h, SC.d); }
function scMerlons(c, x, y, w) { for (let k = 0; k < w; k += 3) scRect(c, x + k, y - 2, 2, 2, SC.m), scRect(c, x + k, y - 2, 1, 2, SC.l); }
function scTower(c, x, y, w, h, flag) {
  scBlock(c, x, y - h, w, h); scMerlons(c, x, y - h, w);
  scRect(c, x + (w >> 1), y - h + 3, 1, 2, SC.k);
  if (flag) { scRect(c, x + (w >> 1), y - h - 6, 1, 5, SC.p); scRect(c, x + (w >> 1) + 1, y - h - 6, 3, 2, SC.r); }
}
const SC_DRAW = [
  (c, cx, y) => {          // башня
    scRect(c, cx - 8, y - 2, 16, 3, SC.w); scRect(c, cx - 7, y - 3, 14, 2, SC.m);
    scTower(c, cx - 5, y - 2, 10, 15, false);
    scBlock(c, cx - 3, y - 22, 6, 7); scMerlons(c, cx - 3, y - 22, 6);
    scRect(c, cx, y - 28, 1, 6, SC.p); scRect(c, cx + 1, y - 28, 4, 2, SC.r);
    scRect(c, cx - 1, y - 8, 3, 6, SC.k); scRect(c, cx - 4, y - 14, 1, 2, SC.k); scRect(c, cx + 3, y - 14, 1, 2, SC.k);
    scRect(c, cx + 6, y - 1, 1, 1, SC.s); scRect(c, cx - 7, y, 1, 1, SC.s);
  },
  (c, cx, y) => {          // крепость
    scRect(c, cx - 16, y - 2, 32, 3, SC.w); scRect(c, cx - 15, y - 3, 30, 2, SC.m);
    scBlock(c, cx - 11, y - 11, 22, 10); scMerlons(c, cx - 11, y - 11, 22);
    scTower(c, cx - 15, y - 1, 7, 15, false); scTower(c, cx + 8, y - 1, 7, 18, true);
    scRect(c, cx - 3, y - 8, 6, 8, SC.k); scRect(c, cx - 2, y - 9, 4, 1, SC.k); scRect(c, cx - 1, y - 7, 2, 7, '#7a6238');
    scRect(c, cx - 9, y - 7, 1, 2, SC.k); scRect(c, cx + 6, y - 7, 1, 2, SC.k);
    scRect(c, cx - 14, y, 1, 1, SC.s); scRect(c, cx + 12, y - 1, 1, 1, SC.s);
  },
  (c, cx, y) => {          // дворец
    scRect(c, cx - 18, y - 2, 36, 3, SC.w); scRect(c, cx - 17, y - 3, 34, 2, SC.m);
    scBlock(c, cx - 16, y - 12, 9, 11); scBlock(c, cx + 7, y - 12, 9, 11);
    for (const sx of [-16 + 3, 7 + 3]) { for (let k = 0; k < 5; k++) scRect(c, cx + sx + (k >> 1) * 0 - 1 + (k > 3 ? 1 : 0), y - 13 - k, 3 - (k > 3 ? 2 : k > 1 ? 1 : 0) + (k < 2 ? 0 : 0), 1, k < 2 ? SC.m : SC.l); }
    scBlock(c, cx - 8, y - 17, 16, 16);
    for (let k = 0; k < 6; k++) scRect(c, cx - 7 + k, y - 18 - k, 14 - k * 2, 1, k < 2 ? SC.m : SC.l);   // купол ступенями
    scRect(c, cx, y - 28, 1, 5, SC.p); scRect(c, cx + 1, y - 28, 4, 2, SC.r);
    scRect(c, cx - 2, y - 9, 4, 9, SC.k); scRect(c, cx - 1, y - 10, 2, 1, SC.k);
    scRect(c, cx - 6, y - 13, 1, 3, SC.k); scRect(c, cx + 5, y - 13, 1, 3, SC.k); scRect(c, cx - 13, y - 8, 1, 3, SC.k); scRect(c, cx + 12, y - 8, 1, 3, SC.k);
    scRect(c, cx - 4, y, 8, 1, SC.d); scRect(c, cx - 14, y, 1, 1, SC.s); scRect(c, cx + 13, y - 1, 1, 1, SC.s);
  },
];
const SC_H = [30, 24, 30], SC_W = [10, 18, 19];

function drawSandCastle(c, x, y, o) {
  const now = Game.time, p = Math.max(0.05, Math.min(1, (now - o.b) / (o.bd || 8))), v = (o.v | 0) % 3;
  const cx = x * TILE + 16, by = y * TILE + 24;
  let sag = 0, wk = 0;
  if (o.w) wk = Math.min(1, (now - o.w) / 1.6);
  else { const age = now - o.b - o.bd - CYCLE; if (age > -6) sag = Math.max(0, Math.min(1, (age + 6) / 6)) * 0.45; }   // перед концом срока оседает
  c.save();
  c.globalAlpha = 1 - wk * 0.8;
  c.fillStyle = 'rgba(80,60,30,0.22)'; c.beginPath(); c.ellipse(cx + 1, by + 1, SC_W[v] + 3, 3, 0, 0, 7); c.fill();
  if (wk > 0) { c.fillStyle = 'rgba(70,56,32,0.35)'; c.beginPath(); c.ellipse(cx, by, SC_W[v] + 4, 3.5, 0, 0, 7); c.fill(); }
  const k = (1 - sag) * (1 - wk * 0.85);
  c.translate(0, by); c.scale(1, k); c.translate(0, -by);
  const vis = SC_H[v] * p;
  c.beginPath(); c.rect(cx - SC_W[v] - 6, by - vis - 1, SC_W[v] * 2 + 12, vis + 5); c.clip();
  SC_DRAW[v](c, cx, by);
  c.restore();
  if (p < 1 && !o.w) {                                            // сыплется песок, пока строит
    c.fillStyle = SC.m;
    const t = (now * 6) | 0;
    c.fillRect(cx - 4 + (t % 5) * 2, by - vis - 2 - (t % 3), 1, 1);
  }
  if (wk > 0) {                                                   // пена накатывает
    c.fillStyle = `rgba(236,246,255,${0.8 * (1 - wk * 0.4)})`;
    for (let q = -3; q <= 3; q++) c.fillRect(cx + q * 5 - 1, by + 2 + Math.round(Math.sin(q * 1.7 + now * 5) * 1), 4, 1);
  }
}

// ---------- Общее для групповых игр ----------

function kpTossFrame(gp) { return Math.min(8, Math.max(0, Math.floor((Game.time - gp.ph) / TOSS_DUR * 9))); }
const kpTossing = gp => gp.pose === 'toss' && Game.time - gp.ph < TOSS_DUR + 0.05;

// Руки в кадрах броска (px от ног, масштаб гномёнка 0,68)
function kpHand(u, f) {
  const ang = TOSS_A[f], shY = -12 + TOSS_DIP[f], face = u.face < 0 ? -1 : 1;
  return [face * (0.4 + Math.sin(ang) * 3.8) * 0.68, (shY - Math.cos(ang) * 3.8) * 0.68, ang];
}

// Бросающий в кадрах 0–8 (снежок или бита у руки до отпускания на кадре 6)
function drawTossUnit(c, u, gp) {
  const f = kpTossFrame(gp), sv = u.anim;
  u.__tf = f; u.anim = 'toss';
  try { _drawUnitGames(c, u); } finally { u.anim = sv; u.__tf = undefined; }
  if (f >= 6) return;
  const [hx, hy, ang] = kpHand(u, f), px = Math.round(u.x * TILE), py = Math.round(u.y * TILE + 6), x = px + hx, y = py + hy;
  if (gp.k === 'snow') {
    c.fillStyle = '#c8d8ec'; c.fillRect(Math.round(x - 1.5), Math.round(y - 1), 3, 3);
    c.fillStyle = '#ffffff'; c.fillRect(Math.round(x - 1.5), Math.round(y - 1.5), 3, 2); c.fillRect(Math.round(x - 1), Math.round(y - 2), 2, 1);
  } else {
    const dx = Math.sin(ang) * (u.face < 0 ? -1 : 1), dy = -Math.cos(ang);       // бита торчит вдоль руки
    for (let t = -1; t <= 6; t++) { c.fillStyle = t > 3 ? '#6e4a22' : '#a8743a'; c.fillRect(Math.round(x + dx * t * 0.8), Math.round(y + dy * t * 0.8), 1, 1); }
    c.fillStyle = '#4a2c14'; c.fillRect(Math.round(x + dx * 5), Math.round(y + dy * 5), 2, 2);
  }
}

const _drawGameUnitKids = drawGameUnit;
drawGameUnit = function (c, u, gp) {
  if ((gp.k === 'gorodki' || gp.k === 'snow') && kpTossing(gp)) { drawTossUnit(c, u, gp); return; }
  _drawGameUnitKids(c, u, gp);
};

function kpHandWorld(u) {
  const f = 6, [hx, hy] = kpHand(u, f);
  return [u.x * TILE + hx, u.y * TILE + 6 + hy];
}

// ---------- Городки ----------

const GOR_D = 3.6;            // расстояние от черты до фигуры, клеток
const FIGS = [
  [[-5, -3], [0, -3], [5, -3], [-5, 3], [0, 3], [5, 3]],        // колодец
  [[-8, 0], [-3, 0], [2, 0], [7, 0], [-3, -5]],                 // пушка
  [[0, 0], [-5, 0], [5, 0], [0, -5], [0, 5]],                   // звезда
];

function figPins(fig) { return FIGS[fig % FIGS.length].map(p => ({ x: p[0], y: p[1], s: 0 })); }

function startGorodki(u) {
  if (Game.time < gameNext || GROUPS.length >= GAME_CAP) return null;
  const sp = gameSpot(u.x, u.y, 9, 1);
  if (!sp) return null;
  const recs = kidRecruits(u, 1 + ((Math.random() * 2) | 0)), n = 1 + recs.length;
  const cx = sp[0] + 0.5, cy = sp[1] + 0.5, ang = [];
  for (let k = 0; k < 8; k++) ang.push(k * Math.PI / 4 + Math.random() * 0.2);
  ang.sort(() => Math.random() - 0.5);
  let th = null;
  for (const a of ang) {                                          // черта броска: клетки свободны и проходимы
    let ok = true;
    for (let i = 0; i < n && ok; i++) {
      const s = gorSlot(cx, cy, a, i, n), x = s.cx, y = s.cy;
      if (!inb(x, y) || !isWalkable(x, y) || World.door[idx(x, y)] || World.obj[idx(x, y)]) ok = false;
    }
    if (ok) { th = a; break; }
  }
  if (th === null) return null;
  const g = beginGroup('gorodki', u, recs, cx, cy, { fig: (Math.random() * 3) | 0, th, pins: [], bat: null, set: 0 });
  g.min = 1; g.throws = 0; g.round = 0; g.turn = 0; g.cur = 0;
  let gen = null;
  g.members.forEach((m, i) => { const r = enlist(g, m, gorSlot(cx, cy, th, i, n), i === 0); if (i === 0) gen = r; });
  gSay(u, ['Играем в городки!', 'Кто со мной в городки?'], '#ffe9a0');
  return gen;
}

function gorSlot(cx, cy, th, i, n) {
  const dx = Math.cos(th), dy = Math.sin(th), off = (i - (n - 1) / 2) * 0.85;
  const x = cx + dx * GOR_D - dy * off, y = cy + dy * GOR_D + dx * off;
  return { x, y, cx: Math.floor(x), cy: Math.floor(y) };
}

function gorTick(g) {
  const now = Game.time, v = g.vis, n = g.members.length, ux = v.cx * TILE, uy = v.cy * TILE + 6;
  const cur = g.cur ? g.members.find(m => m.id === g.cur) : null;
  switch (g.st) {
    case 'gather':
      if (gatherOK(g)) { setSt(g, 'set'); v.set = now; v.pins = figPins(v.fig); sfxAt('pinSet', ux, uy, 0.8); gSay(g.members[0], TOY_NAMES[v.fig % 3] + '!', '#ffe9a0'); }
      break;
    case 'set':
      if (now - g.stT > 1.3) setSt(g, 'next');
      break;
    case 'next': {
      const u = g.members[g.turn % n]; g.turn++; g.cur = u.id;
      u.gp.pose = 'toss'; u.gp.ph = now;
      v.thrower = u.id;
      setSt(g, 'wind');
      break;
    }
    case 'wind': {
      if (!cur || !cur.gp) { setSt(g, 'look'); break; }
      if (now - cur.gp.ph < TOSS_DUR * TOSS_REL) break;
      const [sx, sy] = kpHandWorld(cur), hit = Math.random() < 0.68;
      const a = hit ? 0 : kpRand(5, 10) * (Math.random() < 0.5 ? -1 : 1), dx = ux - sx, dy = uy - sy, L = Math.hypot(dx, dy) || 1;
      v.bat = { x0: sx, y0: sy, x1: ux - dy / L * a + dx / L * (hit ? 0 : kpRand(-3, 3)), y1: uy + dx / L * a, t0: now, dur: 0.5, h: 12, a0: kpRand(0, 6), done: 0 };
      g.hit = hit;
      setSt(g, 'fly');
      break;
    }
    case 'fly': {
      const b = v.bat;
      if (!b || now - b.t0 < b.dur) break;
      b.done = now;
      const st = v.pins.filter(p => p.s === 0);
      let k = 0;
      if (g.hit && st.length) {
        k = Math.min(st.length, 1 + Math.floor(Math.random() * Math.random() * st.length * 1.7));
        st.sort((p, q) => Math.hypot(p.x - (b.x1 - ux), p.y - (b.y1 - uy)) - Math.hypot(q.x - (b.x1 - ux), q.y - (b.y1 - uy)));
        const dl = Math.hypot(b.x1 - b.x0, b.y1 - b.y0) || 1, ddx = (b.x1 - b.x0) / dl, ddy = (b.y1 - b.y0) / dl;
        for (let j = 0; j < k; j++) {
          const p = st[j], sp = kpRand(26, 58), vz = kpRand(34, 62), T = 2 * vz / PIN_G, side = kpRand(-0.7, 0.7);
          p.s = 1; p.t0 = now; p.vx = (ddx - ddy * side) * sp; p.vy = (ddy + ddx * side) * sp * 0.8; p.vz = vz; p.w = kpRand(7, 15) * (Math.random() < 0.5 ? -1 : 1); p.T = T; p.r = kpRand(0, 6.28);
        }
        sfxAt('knock', ux, uy, 1);
      } else sfxAt('knock', b.x1, b.y1, 0.5);
      g.last = k;
      if (cur) {
        const left = v.pins.filter(p => p.s === 0).length;
        if (k && !left) { gSay(cur, 'Фигура!', '#ffe27a'); cur.gest = 'clap'; cur.gestUntil = now + 1.6; }
        else if (k >= 2) gSay(cur, 'Вышибли!', '#fff2a0');
        else if (k === 1) gSay(cur, 'Попал!', '#fff6d0');
        else gSay(cur, ['Мимо!', 'Эх!', 'Криво'], '#e8e0c0');
      }
      setSt(g, 'look');
      break;
    }
    case 'look':
      if (now - g.stT < 1.5) break;
      if (cur && cur.gp) cur.gp.pose = 'stand';
      g.throws++;
      if (!v.pins.some(p => p.s === 0) || g.throws % (n * 2) === 0) setSt(g, 'reset');
      else setSt(g, 'next');
      break;
    case 'reset':
      if (now - g.stT < 1.2) break;
      g.round++;
      if (g.round >= 2) { for (const m of g.members) if (m.gp) { gSay(m, 'Ура, городки!', '#ffe27a'); m.gest = 'clap'; m.gestUntil = now + 2; } endGroup(g, 'done'); break; }
      v.fig = (v.fig + 1) % 3; v.pins = figPins(v.fig); v.bat = null; v.set = now;
      sfxAt('pinSet', ux, uy, 0.8);
      setSt(g, 'set');
      break;
  }
}

// Чурка: стоит (3×6 px) или лежит повёрнутая
function drawPin(c, x, y, rot) {
  c.save(); c.translate(Math.round(x), Math.round(y));
  if (rot !== undefined) c.rotate(rot);
  c.fillStyle = 'rgba(30,22,10,0.3)'; if (rot === undefined) c.fillRect(-2, 0, 5, 1);
  c.fillStyle = '#6e4a22'; c.fillRect(-2, -7, 1, 7);
  c.fillStyle = '#d9a45a'; c.fillRect(-1, -7, 3, 7);
  c.fillStyle = '#8a5a2a'; c.fillRect(-1, -4, 3, 1);
  c.fillStyle = '#f0cf86'; c.fillRect(-1, -7, 3, 1); c.fillRect(-1, -2, 1, 1);
  c.restore();
}

const pinPos = (p, now) => {
  const t = Math.min(p.T, Math.max(0, now - p.t0));
  return [p.x + p.vx * t, p.y + p.vy * t, Math.max(0, p.vz * t - 0.5 * PIN_G * t * t), t >= p.T];
};

function drawGorodkiGround(c, v, px, py) {
  const now = Game.time;
  // черта броска
  const dx = Math.cos(v.th), dy = Math.sin(v.th), lx = px + dx * GOR_D * TILE, ly = py + dy * GOR_D * TILE;
  c.fillStyle = 'rgba(240,226,190,0.55)';
  for (let k = -5; k <= 5; k++) c.fillRect(Math.round(lx - dy * k * 2.2 - dx * 8), Math.round(ly + dx * k * 2.2 - dy * 8), 1, 1);
  // круг-«город»
  c.fillStyle = 'rgba(120,96,56,0.25)';
  c.beginPath(); c.ellipse(px, py, 16, 6.5, 0, 0, 7); c.fill();
  const rise = Math.min(1, (now - v.set) / 0.5);
  const list = v.pins.slice().sort((a, b) => a.y - b.y);
  for (const p of list) {
    if (p.s === 0) drawPin(c, px + p.x, py + p.y - (1 - rise) * 6, undefined);
    else { const q = pinPos(p, now); if (q[3]) drawPin(c, px + q[0], py + q[1] - 1, p.r); }
  }
  if (v.bat && v.bat.done) {                                      // бита лежит там, где упала
    c.save(); c.translate(Math.round(v.bat.x1), Math.round(v.bat.y1)); c.rotate(v.bat.a0);
    c.fillStyle = '#a8743a'; c.fillRect(-4, -1, 7, 2); c.fillStyle = '#4a2c14'; c.fillRect(2, -1, 2, 2);
    c.restore();
  }
}

function drawGorodkiAir(c, v) {
  const now = Game.time, px = v.cx * TILE, py = v.cy * TILE + 6, b = v.bat;
  for (const p of v.pins) {
    if (p.s !== 1) continue;
    const q = pinPos(p, now);
    if (q[3]) continue;
    c.fillStyle = 'rgba(30,22,10,0.25)'; c.fillRect(Math.round(px + q[0]) - 1, Math.round(py + q[1]), 3, 1);
    c.save(); c.translate(Math.round(px + q[0]), Math.round(py + q[1] - q[2] - 3)); c.rotate(p.r + p.w * (now - p.t0));
    c.fillStyle = '#d9a45a'; c.fillRect(-3, -1, 6, 3); c.fillStyle = '#6e4a22'; c.fillRect(-3, -1, 1, 3); c.fillStyle = '#8a5a2a'; c.fillRect(0, -1, 1, 3);
    c.restore();
  }
  if (b && !b.done) {
    const k = Math.min(1, (now - b.t0) / b.dur), x = b.x0 + (b.x1 - b.x0) * k, y = b.y0 + (b.y1 - b.y0) * k - Math.sin(k * Math.PI) * b.h;
    c.fillStyle = 'rgba(30,22,10,0.25)'; c.fillRect(Math.round(b.x0 + (b.x1 - b.x0) * k) - 2, Math.round(b.y0 + (b.y1 - b.y0) * k), 5, 1);
    c.save(); c.translate(Math.round(x), Math.round(y)); c.rotate(b.a0 + k * 14);
    c.fillStyle = '#a8743a'; c.fillRect(-4, -1, 7, 2); c.fillStyle = '#4a2c14'; c.fillRect(2, -1, 2, 2);
    c.restore();
  }
}

// ---------- Снежки ----------

function startSnow(u) {
  if (!kpWinter() || Game.time < gameNext || GROUPS.length >= GAME_CAP) return null;
  const recs = kidRecruits(u, 1 + ((Math.random() * 3) | 0));
  if (!recs.length) return null;
  const sp = gameSpot(u.x, u.y, 9, 2);
  if (!sp) return null;
  const cx = sp[0] + 0.5, cy = sp[1] + 0.5;
  const g = beginGroup('snow', u, recs, cx, cy, { fly: [], hits: [] });
  g.min = 2; g.until = 0; g.nextT = 0;
  const a0 = Math.random() * 6.28, n = g.members.length;
  let gen = null;
  g.members.forEach((m, i) => { const r = enlist(g, m, ringSlot(cx, cy, 2.1, 1.7, a0 + i / n * 6.2832), i === 0); if (i === 0) gen = r; });
  gSay(u, ['Снежки!', 'Лепим снежки!', 'Кто кого?'], '#cfe4ff');
  return gen;
}

function snowTick(g) {
  const now = Game.time, v = g.vis;
  if (g.st === 'gather') {
    if (!gatherOK(g)) return;
    setSt(g, 'play'); g.until = now + kpRand(20, 30); g.nextT = now + 0.4;
    for (const m of g.members) m.gp.nextT = now + kpRand(0.2, 1.4);
  }
  if (!kpWinter()) { endGroup(g, 'thaw'); return; }
  if (now > g.until) {
    for (const m of g.members) if (m.gp) { gSay(m, kpPick(['Ничья!', 'Ха-ха!', 'Замёрзли!']), '#cfe4ff'); m.gest = 'clap'; m.gestUntil = now + 1.6; m.gp.pose = 'stand'; m.gp.tgt = 0; }
    endGroup(g, 'done');
    return;
  }
  const mem = g.members;
  for (const u of mem) {
    const gp = u.gp, tg = gp.tgt ? mem.find(m => m.id === gp.tgt) : null;
    if (tg) faceTo(u, tg.x, tg.y);
    if (gp.pose === 'toss') {
      if (tg && !gp.rel && now - gp.ph >= TOSS_DUR * TOSS_REL) {   // отпустил на кадре 6
        gp.rel = 1;
        const [sx, sy] = kpHandWorld(u), hit = Math.random() < 0.6, ex = tg.x * TILE + (hit ? 0 : kpRand(-9, 9)), ey = tg.y * TILE + 6 - 10 + (hit ? 0 : kpRand(-4, 4));
        v.fly.push({ x0: sx, y0: sy, x1: ex, y1: ey, t0: now, dur: 0.45, h: 9, hit: hit ? tg.id : 0 });
        if (v.fly.length > 5) v.fly.shift();
      }
      if (now - gp.ph >= TOSS_DUR + 0.05) { gp.pose = 'stand'; gp.rel = 0; gp.tgt = 0; gp.nextT = now + kpRand(0.7, 1.8); }
    } else if (now >= (gp.nextT || 0)) {
      const foes = mem.filter(m => m !== u);
      if (foes.length) { const t = kpPick(foes); gp.tgt = t.id; gp.pose = 'toss'; gp.ph = now; gp.rel = 0; }
    }
  }
  for (let i = v.fly.length - 1; i >= 0; i--) {
    const f = v.fly[i];
    if (now - f.t0 < f.dur) continue;
    v.fly.splice(i, 1);
    v.hits.push({ x: f.x1, y: f.y1, t0: now, m: f.hit ? 1 : 0 });
    if (v.hits.length > 6) v.hits.shift();
    sfxAt('snowHit', f.x1, f.y1, f.hit ? 0.9 : 0.5);
    const tg = f.hit ? mem.find(m => m.id === f.hit) : null;
    if (tg && tg.gp) { gSay(tg, kpPick(['Ай!', 'Снегом!', 'Ах так!']), '#cfe4ff'); gesture2(tg, 'scratch', 1.2, tg.x - 1); }
  }
}

function drawSnowAir(c, v) {
  const now = Game.time;
  for (const f of v.fly) {
    const k = Math.min(1, (now - f.t0) / f.dur), x = f.x0 + (f.x1 - f.x0) * k, y = f.y0 + (f.y1 - f.y0) * k - Math.sin(k * Math.PI) * f.h;
    c.fillStyle = 'rgba(40,50,70,0.22)'; c.fillRect(Math.round(f.x0 + (f.x1 - f.x0) * k) - 1, Math.round(f.y0 + (f.y1 - f.y0) * k + 6), 3, 1);
    c.fillStyle = '#c8d8ec'; c.fillRect(Math.round(x) - 1, Math.round(y), 3, 3);
    c.fillStyle = '#ffffff'; c.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 2); c.fillRect(Math.round(x), Math.round(y) - 2, 1, 1);
  }
  // удар снежка: 6 кадров облачка (0,09 с каждый)
  for (const h of v.hits) {
    const f = Math.floor((now - h.t0) / 0.09);
    if (f < 0 || f > 5) continue;
    const r = [1, 2, 3, 4, 4, 5][f], a = [1, 1, 0.9, 0.7, 0.45, 0.25][f];
    c.globalAlpha = a; c.fillStyle = '#ffffff';
    for (let k = 0; k < (h.m ? 8 : 5); k++) {
      const an = k * 0.785 + 0.4, rr = r * (k & 1 ? 1 : 0.65);
      c.fillRect(Math.round(h.x + Math.cos(an) * rr) - 1, Math.round(h.y + Math.sin(an) * rr * 0.8 - f * 0.4) - 1, f < 3 ? 2 : 1, f < 3 ? 2 : 1);
    }
    c.globalAlpha = 1;
  }
}

// ---------- Подключение: ход, рисование ----------

function kidGroupTick(g) {
  if (g.kind === 'gorodki') gorTick(g);
  else if (g.kind === 'snow') snowTick(g);
}

let kpSandT = 0;
const _gamesTickKids = gamesTick;
gamesTick = function (dt) {
  _gamesTickKids(dt);
  if (kpMirror()) return;
  kpSandT += dt;
  if (kpSandT >= 3) { const st = kpSandT; kpSandT = 0; sandTick(st); }
};

const _drawGamesGroundKids = drawGamesGround;
drawGamesGround = function (c, x0, y0, x1, y1) {
  _drawGamesGroundKids(c, x0, y0, x1, y1);
  const L = Game.games;
  if (!L || !L.length) return;
  for (const v of L) {
    if (v.k !== 'gorodki' || v.cx < x0 - 3 || v.cx > x1 + 3 || v.cy < y0 - 3 || v.cy > y1 + 3) continue;
    const a = v.out ? Math.max(0, 1 - (Game.time - v.out) / 0.7) : 1;
    if (a <= 0) continue;
    c.globalAlpha = a; drawGorodkiGround(c, v, Math.round(v.cx * TILE), Math.round(v.cy * TILE + 6)); c.globalAlpha = 1;
  }
};

const _drawGamesAirKids = drawGamesAir;
drawGamesAir = function (c) {
  _drawGamesAirKids(c);
  const L = Game.games;
  if (!L || !L.length) return;
  for (const v of L) {
    if (v.k === 'gorodki' && v.pins) drawGorodkiAir(c, v);
    else if (v.k === 'snow' && v.fly) drawSnowAir(c, v);
  }
};

const _drawUnitKp = drawUnit;
drawUnit = function (c, u) {
  _drawUnitKp(c, u);
  if (u.kp && u.kp.k === 'pipe') drawBubbles(c, u);
};

// ---------- Взросление ----------

// Чего не хватает деревне: рабочие места без работника минус свободные люди и ученики в школе
function kpNeeds() {
  const need = {}, have = {};
  for (const b of Game.buildings) {
    if (b.removed || b.state !== 'done') continue;
    const w = b.def && b.def.worker;
    if (w && !(b.worker && b.worker.home === b)) need[w] = (need[w] || 0) + 1;
    if (b.type === 'school') { for (const t of b.queue || []) have[t] = (have[t] || 0) + 1; if (b.training) have[b.training.type] = (have[b.training.type] || 0) + 1; }
  }
  for (const x of Game.units) if (!x.dead && !x.home && x.type !== 'kid' && need[x.type]) have[x.type] = (have[x.type] || 0) + 1;
  const sites = Game.buildings.filter(b => !b.removed && b.state !== 'done').length;
  const builders = Game.units.filter(x => !x.dead && x.type === 'builder').length;
  if (sites > 0 && builders < Math.min(3, Math.ceil(sites / 2))) need.builder = (need.builder || 0) + Math.min(3, Math.ceil(sites / 2)) - builders;
  const lack = {};
  for (const t in need) if (need[t] - (have[t] || 0) > 0) lack[t] = need[t] - (have[t] || 0);
  return lack;
}

// Приоритет: еда, дрова, стройка, оборона; затем всё остальное, чего не хватает
const KP_PRIO = [['еда', ['baker', 'farmer', 'butcher', 'herder', 'brewer']], ['дрова', ['woodcutter']], ['стройка', ['stonemason', 'builder']]];

function kidPickJob(u) {
  const lack = kpNeeds();
  for (const [why, types] of KP_PRIO) for (const t of types) if (lack[t] && UNIT_TYPES[t]) return { type: t, why };
  // оборона: башни без стражи и гильдия, которой есть чем снарядить рекрута
  const towers = Game.buildings.filter(b => b.type === 'watchtower' && b.state === 'done' && !b.removed).length;
  const armed = Game.units.filter(x => !x.dead && x.rec && (x.type === 'warrior' || x.type === 'archer')).length;
  if (towers && armed < towers * 2 && typeof hireCheck === 'function') {
    const gl = Game.buildings.find(b => b.def && (b.def.guild === 'warrior' || b.def.guild === 'archer') && b.state === 'done' && !b.removed && !hireCheck(b));
    if (gl) return { type: 'serf', why: 'оборона', guild: gl };
  }
  for (const t in lack) if (UNIT_TYPES[t] && !UNIT_TYPES[t].noTrain) return { type: t, why: 'ремесло' };
  // иначе по склонности: семейное ремесло — как у отца или матери
  const f = u.fam;
  if (f && f.pn) {
    const par = Game.units.filter(x => !x.dead && x.fam && f.pn.includes(x.fam.n) && x.fam.r === f.r && x.type !== 'kid' && UNIT_TYPES[x.type] && !UNIT_TYPES[x.type].noTrain && x.type !== 'serf');
    if (par.length && Math.random() < 0.6) return { type: kpPick(par).type, why: 'семья' };
  }
  return null;
}

const _famGrowUpKids = famGrowUp;
famGrowUp = function (u) {
  _famGrowUpKids(u);
  if (kpMirror()) return;
  u.kp = null; u.kpAt = 0;
  const job = kidPickJob(u);
  if (!job) return;
  const name = famName(u);
  if (job.type !== 'serf') { u.type = job.type; u._spr = null; u.idleFlag = true; }
  const prof = UNIT_TYPES[job.type].name.toLowerCase();
  let text;
  if (job.guild) {
    hireRecruit(job.guild);
    text = `${name} вырос и пойдёт в стражу: башням нужны защитники`;
  } else if (job.why === 'семья') text = `${name} вырос и пошёл по семейной стезе: теперь ${prof}`;
  else text = `${name} вырос и стал: ${prof}. В деревне не хватало рук (${job.why})`;
  famNote(text);
  famSay(text);
};
