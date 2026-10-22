'use strict';
// Жилой дом (2×2): место, где жители ночуют и прячутся от нечисти.
// · Восемь видов: белёный коттедж, изба, каменный домик, дощатый дом, кирпичный, фахверк на камне, длинный низкий,
//   высокий двухэтажный. Вид — от места постройки (houseVar), поэтому один и тот же на сейве и у всех игроков коопа.
//   Крыша — по уровню, как у всех зданий: солома → дранка → черепица (bmodels.js, levelRoof).
// · Жильцы: дом вмещает 3 / 4 / 6 гномов (по уровню). Семьи (family.js) селятся вместе: супруги и их гномята.
//   Расселение пересчитывается само раз в пару секунд (u.dwell), в сейв не пишется.
// · Ночью уставший житель (сон ниже 60 %) и гномята идут домой и спят: сон восстанавливается, утром — «Выспался дома».
//   Увидел нечисть — бежит домой прятаться, если дом недалеко. Внутри целого дома призраки, скелеты, совы и мыши
//   его не трогают (нечисть не видит тех, кто внутри). Ходячие деревья ломают дома как любые здания: дом с
//   повреждением от половины и выше не защищает — жильцы выбегают. Дом 2-го и 3-го уровня крепче.
// · Бездомные: пока в деревне нет ни одного дома, всё как раньше (никаких штрафов старым сейвам).
//   Когда дома есть, бездомный ночует в трактире: спит хуже и ворчит «Ночует где придётся».
// · Окна домов, где кто-то есть, светятся тёплым светом.
// Считает хозяин мира (одиночка или кооп-сервер); клиент коопа видит u.inside из пакета жителей.

const HOUSE = {
  CAP: [3, 4, 6],              // жильцов по уровню
  SLEEP: [0.009, 0.011, 0.013], // сколько сна прибавляется за секунду в доме (уровень 1/2/3)
  INN_SLEEP: 0.004,            // в трактире — хуже
  MIN_SLEEP: 40,               // спит хотя бы столько, с
  WAKE: 0.95,                  // проснулся выспавшимся
  TIRED: 0.6,                  // ниже этого — ночью пора спать
  HIDE_R: 16,                  // до дома не дальше, чтобы бежать прятаться
  HIDE_MIN: 18,                // прячется хотя бы столько, с
  HIT: [1, 0.75, 0.5],         // доля урона от ходячих деревьев по дому (уровень 1/2/3)
  MOOD: [3, 4, 6],             // «Выспался дома» по уровню
  BROKEN: 0.5,                 // с такого повреждения дом не защищает
};
const HOUSE_NAMES = ['Белёный коттедж', 'Изба', 'Каменный домик', 'Дощатый дом', 'Кирпичный дом', 'Фахверк на камне', 'Длинный дом', 'Высокий дом'];

BUILDINGS.house = {
  name: 'Дом', cat: 'Основа', w: 2, h: 2, top: 70, cost: { timber: 3, stone: 1 }, home: true,
  desc: 'Жилой дом на три гнома. Ночью жильцы спят здесь и высыпаются, а увидев нечисть — прячутся: внутри целого дома призраки и скелеты их не достанут. Семья живёт вместе.',
  desc2: 'Дом с мансардой: четыре жильца, сон слаще, стены крепче — ходячему дереву придётся постараться. Соседи завидуют, но молча.',
  desc3: 'Дом под черепицей и с флюгером: шесть жильцов, лучший сон в деревне и стены вдвое крепче соломенных. Нечисть обходит его стороной, а сосед — с поклоном.',
  up: { cost: { timber: 3, stone: 2 } },
  up3: { cost: { timber: 5, stone: 4 } },
};
BUILD_ORDER.push('house');
UNLOCKS.push({ id: 'home', items: ['house'], after: ['sawmill'] });
if (typeof UNLOCK_NAMES !== 'undefined') UNLOCK_NAMES.home = 'Дома';
if (typeof REVEAL_STAGE !== 'undefined') REVEAL_STAGE.home = ['Дома', 'Плотник предлагает жилые дома: ночью жильцы спят в них и прячутся от нечисти. Пока домов нет, гномы ночуют как раньше — где придётся.'];
if (typeof SARC_B !== 'undefined') SARC_B.house = 'Четыре стены, крыша и кровать. Гному больше не надо — разве что пива и чтобы призрак не заглядывал в окно.';
if (typeof MD_WHY !== 'undefined') Object.assign(MD_WHY, { home: 'Выспался дома', nohome: 'Ночует где придётся', hid: 'Отсиделся дома', coldhome: 'Спал в нетопленом доме' });
if (typeof HINTS !== 'undefined') HINTS.house = { icon: ['ui', 'play'], text: 'Открыты дома! Поставьте пару домов у костра: ночью жильцы спят там и высыпаются, а от призраков и скелетов прячутся внутри. Дом на 3 гнома, семья живёт вместе. Без домов всё как раньше, но с домами бездомные ворчат.',
  when: () => !!(Game.unlocked && Game.unlocked.home) };

// вид дома — от места постройки: соседние дома почти всегда разные
const houseVar = b => (((b.x * 7 + b.y * 13) % 8) + 8) % 8;
const houseMirror = () => typeof Coop !== 'undefined' && !!Coop.mirror;
const houseLv = b => Math.max(1, Math.min(3, b.level || 1));
const houseCap = b => HOUSE.CAP[houseLv(b) - 1];
const houseOk = b => !!b && !b.removed && b.state === 'done' && b.type === 'house';
const houseSafe = b => houseOk(b) && (b.dmg || 0) < HOUSE.BROKEN;
const houseList = () => Game.buildings.filter(houseOk);
// кто живёт в домах: взрослые жители и гномята (не герой, не рекрут гильдии, не извозчик, не скотина)
const houseFolk = u => !u.dead && !u.removed && isPerson(u) && u.type !== 'hero' && !u.hero && !u.rec && u.type !== 'carter' && !u.owner;

// ---------- Восемь видов ----------
// Модель в мировых координатах участка 64×64: y0 — фасад (юг), дверь на x = 48 (как у всех домов 2×2).
const HV = [
  { wall: 'plaster', col: '#ece2c8', frame: true, axis: 'X', rise: 13, h: 30, sh: '#6a2a1a', fl: true, chim: [{ x: 14, y: 40, h: 12, kind: 'brick' }], porch: true },
  { wall: 'logs', col: '#7a4e2c', axis: 'Y', rise: 22, h: 20, sh: '#4a6a2a', chim: [{ x: 40, y: 46, h: 10, kind: 'stone', w: 6 }], gw: true, pile: true },
  { wall: 'fieldstone', col: '#9a907a', axis: 'X', rise: 12, h: 28, sh: '#3e5a3a', chim: [{ x: 46, y: 38, h: 12, kind: 'stone', w: 6 }], barrel: true, round: true },
  { wall: 'plank', col: '#7a5030', axis: 'Y', rise: 20, h: 22, sh: '#3e5a7a', x1: 50, shed: true },
  { wall: 'brick', col: '#a8543a', axis: 'X', rise: 12, h: 32, stoneWin: true, chim: [{ x: 10, y: 40, h: 12, kind: 'brick' }, { x: 50, y: 40, h: 12, kind: 'brick' }], dormer: true },
  { wall: 'plaster', col: '#e6d4b0', frame: true, low: 10, axis: 'Y', rise: 22, h: 24, sh: '#a07820', fl: true, porch: true, chim: [{ x: 16, y: 44, h: 10, kind: 'stone', w: 6 }] },
  { wall: 'plaster', col: '#efe6cc', low: 7, axis: 'X', rise: 10, h: 25, x0: 2, x1: 62, y0: 14, round: true, arch: true, chim: [{ x: 30, y: 40, h: 10, kind: 'stone', w: 6 }], barrel: true },
  { wall: 'plank', col: '#8a5e34', axis: 'Y', rise: 24, h: 32, x0: 12, x1: 58, y0: 14, y1: 52, sh: '#6a2a1a', two: true, chim: [{ x: 20, y: 44, h: 12, kind: 'brick' }] },
];

if (typeof MODELS !== 'undefined') MODELS.house = function (m) {
  const v = HV[m.vr || 0] || HV[0];
  const x0 = v.x0 ?? 6, x1 = v.x1 ?? 58, y0 = v.y0 ?? 12, y1 = v.y1 ?? 56;
  const win = (at, z, o = {}) => ({ t: 'win', at, z, w: 7, h: 8, o: Object.assign({ lit: true }, v.sh ? { shutter: v.sh } : {}, v.fl ? { flowers: true } : {}, v.round ? { round: true } : {}, v.stoneWin ? { stone: true } : {}, o) });
  const S = [{ t: 'door', main: true, w: 10, h: 15, o: Object.assign({ col: ['#5a3a1e', '#3e6a2c', '#6a2a1a', '#3e4a6a'][(m.vr || 0) % 4] }, v.arch ? { arch: true } : {}) }];
  S.push(win(x0 + 12, v.axis === 'X' ? 10 : 6));
  if (v.two) { S.push(win(x0 + 12, 19), win(48, 19)); }
  const E = [win((y0 + y1) / 2, 6)];
  if (v.two) E.push(win((y0 + y1) / 2, 19));
  const W = [win((y0 + y1) / 2, 6)];
  m.box({
    x0, x1, y0, y1, h: v.h, wall: v.wall, col: v.col, frame: !!v.frame, beam: typeof BEAM !== 'undefined' ? BEAM : '#3a2414', lowerStone: v.low || 0,
    roof: { type: 'gable', axis: v.axis, rise: v.rise, mat: 'shingle', col: '#7a5434', ov: 4 },
    decor: { S, E, W },
    gable: v.axis === 'Y' && v.gw ? { S: [{ t: 'win', at: (x0 + x1) / 2, z: 5, w: 5, h: 5, o: { round: true, lit: true } }] } : undefined,
    dormers: v.dormer ? [{ x: (x0 + x1) / 2 - 12, w: 11, h: 9, o: { lit: true } }] : undefined,
    chimneys: v.chim,
  });
  if (v.porch) m.box({ x0: 38, x1: 58, y0: 4, y1: y0, h: 18, open: true, canopy: true, noShadow: true, roof: { type: 'lean', down: 'S', rise: 5, mat: 'shingle', col: '#7a5434', ov: 2 } });
  if (v.shed) m.box({ x0: 50, x1: 62, y0: 20, y1: 52, h: 14, open: true, noShadow: true, roof: { type: 'lean', down: 'E', rise: 6, mat: 'shingle', col: '#6e4a2c', ov: 2 },
    inside: (c, mm) => { const a = mm.at(56, 36); if (typeof logPile === 'function') logPile(c, a[0], a[1], 2, 7); } });
  if (v.pile && typeof logPile === 'function') m.prop((c, x, y) => logPile(c, x, y, 2, 8), 8, 4);
  if (v.barrel && typeof barrel === 'function') m.prop((c, x, y) => barrel(c, x, y, 0.8), 6, 6);
  if (m.vr === 4 && typeof crate === 'function') m.prop((c, x, y) => crate(c, x, y, 5), 8, 4);
};

// ---------- Расселение ----------

function houseGroups() {
  const folk = Game.units.filter(houseFolk);
  const byId = new Map(folk.map(u => [u.id, u]));
  const byName = new Map();
  for (const u of folk) if (u.fam) byName.set(u.fam.r + '|' + u.fam.n, u);
  const head = new Map();                                  // житель -> глава его семьи
  const root = u => {
    if (!u.fam) return u;
    if (u.type === 'kid' && Array.isArray(u.fam.pn)) {     // гномёнок — к родителям
      for (const n of u.fam.pn) { const p = byName.get(u.fam.r + '|' + n); if (p && p !== u && p.type !== 'kid') return root(p); }
    }
    const sp = u.fam.sp && byId.get(u.fam.sp);
    return sp && sp.id < u.id ? sp : u;
  };
  for (const u of folk) head.set(u, root(u));
  const groups = new Map();
  for (const u of folk) { const h = head.get(u); let g = groups.get(h); if (!g) groups.set(h, g = []); g.push(u); }
  return [...groups.values()].sort((a, b) => b.length - a.length || a[0].id - b[0].id);
}

function houseAssign() {
  const hs = houseList().sort((a, b) => a.id - b.id);
  for (const u of Game.units) u.dwell = null;
  if (!hs.length) return;
  const free = new Map(hs.map(b => [b, houseCap(b)]));
  for (const g of houseGroups()) {
    // вся семья — в один дом, где хватает мест; не влезла — по одному куда есть
    let b = hs.find(h => free.get(h) >= g.length);
    if (b) { for (const u of g) u.dwell = b; free.set(b, free.get(b) - g.length); continue; }
    for (const u of g) { const h = hs.find(x => free.get(x) > 0); if (!h) break; u.dwell = h; free.set(h, free.get(h) - 1); }
  }
}
const houseResidents = b => Game.units.filter(u => u.dwell === b && !u.dead);

// ---------- Ночь и укрытие ----------

function* houseGen(u, b, why0) {
  let why = why0;
  u.brk.until = Game.time + 900;
  const ok = yield { walk: [b.doorX, b.doorY] };
  if (!ok || b.removed || (why !== 'inn' && !houseSafe(b))) return;
  yield { enter: b };
  let t0 = Game.time;
  const lv = why === 'inn' ? 1 : houseLv(b);
  while (!u.dead && !b.removed && (why === 'inn' || houseSafe(b))) {
    yield { wait: 1 };
    const t = Game.time - t0;
    if (why === 'hide') {
      const tired = u.type === 'kid' || (u.md ? u.md.rest : 1) < HOUSE.TIRED;
      if ((t >= HOUSE.HIDE_MIN && !houseThreat(b)) || t > 120) {
        if (isNightNow() && tired) { why = 'sleep'; t0 = Game.time; continue; }   // отсиделся, а ночь и спать хочется — ложится
        break;
      }
      continue;
    }
    if (typeof mdBump === 'function') mdBump(u, 'rest', (why === 'inn' ? HOUSE.INN_SLEEP : HOUSE.SLEEP[lv - 1]) * (b.cold ? WINTER_COLD_SLEEP : 1));   // нетопленый дом зимой: не выспишься (season.js)
    const rest = u.md ? u.md.rest : 1;
    if (!isNightNow() && t >= 5) break;                           // рассвет — пора вставать
    if (u.type !== 'kid' && t >= HOUSE.MIN_SLEEP && rest >= HOUSE.WAKE) break;
  }
  if (typeof moodPoke === 'function') {
    if (why === 'sleep' && b.cold) moodPoke(u, 'coldhome', -5, 300);
    else if (why === 'sleep') moodPoke(u, 'home', HOUSE.MOOD[lv - 1], 240);
    else if (why === 'hide') moodPoke(u, 'hid', 2, 90);
    else moodPoke(u, 'nohome', -3, 200);
  }
  u.homeNext = Game.time + 45;
  if (u.inside === b) yield { leave: true };
}

// нечисть рядом с домом
function houseThreat(b) {
  const x = b.x + b.w / 2, y = b.y + b.h / 2;
  return typeof mdThreat === 'function' && mdThreat({ x, y });
}

function houseSend(u, b, why) {
  startBreak(u, 'home', null);
  u.proc = houseGen(u, b, why);
}

const HS = { t: 0, at: 0 };
function houseTick(dt) {
  HS.t += dt;
  if (HS.t < 1) return;
  HS.t = 0;
  const now = Game.time;
  if (now >= HS.at) { HS.at = now + 2; houseAssign(); }
  const any = Game.buildings.some(houseOk);
  if (!any) return;                                          // нет домов — всё как раньше
  const night = isNightNow();
  for (const u of Game.units) {
    if (!houseFolk(u) || u.carry || u.dlv || u.eat || u.cmd || (u.homeNext || 0) > now) continue;
    if (!interruptible(u)) continue;
    const b = u.dwell, home = houseSafe(b);
    const threat = night && typeof mdThreat === 'function' && mdThreat(u);
    if (home && threat && Math.hypot(b.doorX - u.x, b.doorY - u.y) < HOUSE.HIDE_R) { houseSend(u, b, 'hide'); continue; }
    if (!night) continue;
    const rest = u.md ? u.md.rest : 1;
    if (home && (u.type === 'kid' || rest < HOUSE.TIRED)) { houseSend(u, b, 'sleep'); continue; }
    if (!b && rest < 0.5 && typeof findInn === 'function') {
      const inn = Game.buildings.find(x => x.type === 'inn' && x.state === 'done' && !x.removed);
      if (inn) houseSend(u, inn, 'inn');
      else if (typeof moodPoke === 'function') { moodPoke(u, 'nohome', -3, 60); u.homeNext = now + 50; }
    }
  }
}

// дом 2-го и 3-го уровня крепче: ходячее дерево ломает его медленнее
if (typeof buildingHit === 'function') {
  const _bh = buildingHit;
  buildingHit = function (e, b) {
    const before = b.dmg || 0;
    _bh(e, b);
    if (b.type === 'house' && b.dmg > before) b.dmg = before + (b.dmg - before) * HOUSE.HIT[houseLv(b) - 1];
  };
}

// ---------- Окна и окно здания ----------

if (typeof drawInsideLife === 'function') {
  const _dil = drawInsideLife;
  drawInsideLife = function (c, b, spr, ox, oy) {
    if (b.type !== 'house') return _dil(c, b, spr, ox, oy);
    const wins = spr.wins;
    if (!wins || !wins.length || !(INS_CNT.get(b) > 0)) return;
    const k = typeof nightAmt === 'function' ? nightAmt() : 1;
    if (k < 0.15) return;
    const t = Game.time;
    for (let i = 0; i < wins.length; i++) {
      const [wx, wy, ww, wh, round] = wins[i];
      if (ww < 4) continue;
      const x = ox + wx, y = oy + wy;
      c.save(); c.beginPath();
      if (round) c.arc(x, y, Math.min(ww, wh) / 2, 0, Math.PI * 2); else c.rect(x - ww / 2, y - wh / 2, ww, wh);
      c.clip();
      c.fillStyle = `rgba(255,${196 + Math.sin(t * 2.3 + i + b.id) * 14 | 0},104,${(0.55 + 0.4 * k).toFixed(2)})`;
      c.fillRect(x - ww / 2, y - wh / 2, ww, wh);
      c.restore();
    }
  };
}

if (typeof infoBuilding === 'function') {
  const _ib = infoBuilding;
  infoBuilding = function (b) {
    let h = _ib(b);
    if (b.type !== 'house' || b.state !== 'done') return h;
    if (houseMirror()) houseAssign();                        // клиент коопа считает расселение сам (семьи приходят в пакете)
    const rs = houseResidents(b), inside = Game.units.filter(u => u.inside === b).length;
    const nm = u => (u.fam && u.fam.n) || UNIT_TYPES[u.type].name;
    let x = `<div class="isec">${HOUSE_NAMES[houseVar(b)]} · жильцов ${rs.length} из ${houseCap(b)}</div>`;
    x += rs.length ? `<div class="irow small">${rs.map(u => nm(u) + (u.type === 'kid' ? ' (гномёнок)' : '') + (u.inside === b ? ' 💤' : '')).join(', ')}</div>` : '<div class="irow small muted">Пока никто не живёт: все места заняты в других домах или жителей мало</div>';
    x += `<div class="irow small">${inside ? `Дома сейчас: ${inside}` : 'Все на работе'}${(b.dmg || 0) >= HOUSE.BROKEN ? ' · <span class="warn">дом разбит — не защищает, нужен ремонт</span>' : ''}</div>`;
    const i = h.lastIndexOf('<div class="idesc">');
    return i >= 0 ? h.slice(0, i) + x + h.slice(i) : h + x;
  };
}

// ---------- Подключение ----------

if (typeof Building === 'function') {
  // вид дома — свойство здания: рисуется в render.js, eras.js, leisure.js, levels.js (5-й аргумент buildingSprite)
  Object.defineProperty(Building.prototype, 'hv', { get() { return this.type === 'house' ? houseVar(this) : 0; }, configurable: true });
}

if (typeof step === 'function') {
  const _step = step;
  step = function (dt) { _step(dt); if (!houseMirror()) { try { houseTick(dt); } catch (e) { console.error(e); } } };
}
