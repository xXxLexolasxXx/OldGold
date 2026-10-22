'use strict';
// Арена PvP (АРЕНА.md, этап 1): ядро боя «герой против героя». Один файл для браузера и будущего сервера арены:
// без DOM, без Game/World, без Math.random и реального времени. Один сид + одни и те же входы = один и тот же бой.
// · Площадка — круг 14 клеток с зеркальными колоннами и ящиками Брюма, овертайм — горящий песок по краю (6.1).
// · Фиксированный шаг 20 Гц; случайность — генератор rngMake из dungeon.js, но его состояние лежит в S.rs (6.2):
//   так всё состояние боя — простой объект, который можно сохранить, переслать (снапшот) и продолжить.
// · Удары, точность, крит, тяжёлый удар с телеграфом, комбо, перекат (6.3); статусы с PvP-иммунитетами (6.4);
//   раунд 75 с, матч до двух побед (6.5); ресурсы и шкала ульты (7.3); 60 способностей по таблице 7.1; боты 6.6.
// · Вход игрока — только намерение { mx, my, cast, roll, aim }: направление, слот способности 0–5 (−1 — нет),
//   перекат, точка наведения. Всё остальное (позиции, урон, откаты) считает ядро — на сервере так же.
// · Все числа — в ARENA_TUNE: правка баланса = правка таблицы и прогон tools/soak/arena.js, без правки логики.

const ARENA_PROTO = 1;

const ARENA_TUNE = {
  v: 1,
  dt: 0.05,
  // площадка: центр, радиус, радиус бойца, препятствия (col — колонна: не пройти и не прострелить; box — ящик: прострел есть)
  cx: 7, cy: 7, R: 7, fr: 0.4, start: 4.5,
  obs: [{ k: 'col', x: 7, y: 4.2, r: 0.6 }, { k: 'col', x: 7, y: 9.8, r: 0.6 }, { k: 'box', x: 4.4, y: 4.6, r: 0.55 }, { k: 'box', x: 9.6, y: 9.4, r: 0.55 }],
  // раунд и матч
  roundT: 75, otT: 60, otEvery: 5, otStep: 0.5, otMin: 2.5, otDmg: 0.03, countT: 3, endT: 1.2, restT: 2.8, wins: 2,
  // движение и перекат
  spd: 3.2, rollT: 0.45, rollMove: 0.3, rollDist: 1.5, rollCd: 5, atkLock: 0.15, reach: 0.15,
  // удары
  shotSp: 11, heavyEvery: 3, heavyWind: 0.4, heavyMul: 1.6, heavyCos: 0.75, heavyExtra: 0.7, openT: 2, openMul: 1.5,
  comboN: 3, comboT: 2.5, finMul: 1.4, finCd: 6, shotLock: 0.25, crit: 0.1, critMul: 1.5, spread: 0.2, iceMul: 1.2,
  // статусы: потолки и иммунитеты
  stunMax: 1.5, iceMax: 2, ccImm: 3, ccWin: 6, rootMax: 2.5, rootImm: 3, slowMax: 4, slowMul: 0.6, silMax: 2,
  dotPct: 0.02, dotCap: 0.25, blind: 0.3, dodgeMax: 0.6, redMin: -0.5, redMax: 0.7, accMin: 0.05, accMax: 0.97,
  // ресурсы (все по 100) и шкала ульты
  res: {
    rage: { start: 20, hit: 8, hurt: 6, decay: 3, calm: 3 },
    energy: { start: 100, regen: 6 },
    mana: { start: 100, regen: 3 },
    faith: { start: 60, regen: 1.5, hit: 4, hurt: 6 },
  },
  ultDeal: 1, ultTake: 0.7, ultPerRound: 1, otHeal: 0.75,
  // классы: здоровье = кооп-база + 8·12 и Клятва (раздел 5), дальше — по итогам матрицы ботов (АРЕНА_БАЛАНС.md)
  // mv — скорость (Клятва), rng — дальность, atkT — интервал удара, dmg — урон удара, acc — точность, crit — шанс крита,
  // shot — снаряд вместо удара вблизи, dodge — уворот Клятвы, melee — точность вплотную у стрелка
  cls: {
    warrior: { res: 'rage', hp: 271, mv: 0.94, rng: 1.5, atkT: 1.0, dmg: 7.0, acc: 0.85 },
    barbarian: { res: 'rage', hp: 214, mv: 1, rng: 1.5, atkT: 1.15, dmg: 6.5, acc: 0.8 },
    archer: { res: 'energy', hp: 265, mv: 1, rng: 7, atkT: 1.1, dmg: 7.0, acc: 0.85, shot: 'arrow', melee: 0.8 },
    rogue: { res: 'energy', hp: 209, mv: 1, rng: 1.4, atkT: 0.9, dmg: 6.85, acc: 0.88, crit: 0.2 },
    mage: { res: 'mana', hp: 226, mv: 1, rng: 6, atkT: 1.2, dmg: 7.0, acc: 0.9, shot: 'bolt' },
    druid: { res: 'mana', hp: 235, mv: 1, rng: 3.6, atkT: 1.2, dmg: 5.6, acc: 0.88, shot: 'thorn' },
    priest: { res: 'mana', hp: 255, mv: 1, rng: 1.4, atkT: 1.1, dmg: 6.4, acc: 0.77 },
    paladin: { res: 'faith', hp: 245, mv: 0.96, rng: 1.5, atkT: 1.1, dmg: 5.75, acc: 0.85 },
    bard: { res: 'mana', hp: 268, mv: 1, rng: 1.5, atkT: 0.95, dmg: 8.5, acc: 0.8 },
    monk: { res: 'energy', hp: 278, mv: 1.06, rng: 1.4, atkT: 0.7, dmg: 5.0, acc: 0.86, dodge: 0.1 },
  },
  // способности (раздел 7.1). cost — ресурс, cd — откат, dur — время действия, buf — усиления на время
  // (atk точность, dmg урон, red меньше урона по себе, dodge уворот, spd чаще удары, mv скорость, regen %/с здоровья),
  // pas — пассивка (res, heal, cd — множители; остальное прибавляется), ult — ульта со шкалы, r — дальность до соперника
  ab: {
    bash: { cost: 20, cd: 10, r: 1.9, mul: 1, stun: 1 },
    cry: { cost: 15, cd: 30, dur: 8, buf: { atk: 0.15 } },
    stand: { pas: { red: 0.15 } },
    surge: { cost: 30, cd: 40, dur: 6, buf: { spd: 1, atk: 0.25 } },
    wall: { cost: 40, cd: 60, dur: 5, buf: { red: 0.45 }, r: 3, stun: 1 },
    ult_warrior: { ult: 1, dur: 6, buf: { red: 0.6 }, r: 5, stun: 1.5 },

    rage: { cost: 30, cd: 40, dur: 10, buf: { dmg: 0.4, red: 0.3 } },
    reckless: { cost: 15, cd: 25, dur: 6, buf: { atk: 0.35, red: -0.25 } },
    stomp: { cost: 25, cd: 20, r: 3, mul: 1, stun: 1.2 },
    hide: { pas: { red: 0.12, hpr: 0.3 } },
    roar: { cost: 20, cd: 25, r: 4, slow: 0.3, slowT: 6 },
    ult_barbarian: { ult: 1, dur: 10, buf: { dmg: 0.8, red: 0.35, spd: 0.5 }, r: 4, stun: 1 },

    aimed: { cost: 25, cd: 10, next: 2.2 },
    volley: { cost: 40, cd: 30, n: 5, mul: 0.7, gap: 0.06 },
    trap: { cost: 30, cd: 25, max: 2, root: 2, open: 2, life: 40, zr: 0.65 },
    eagle: { pas: { atk: 0.1, rng: 0.5 } },
    leap: { cost: 20, cd: 18, dist: 3, inv: 0.3 },
    ult_archer: { ult: 1, zr: 3, n: 14, mul: 0.9, delay: 0.8, dur: 3, lead: 0.5 },

    sneak: { cost: 25, cd: 12, next: 2.5, back: 3 },
    trip: { cost: 20, cd: 14, r: 2.2, stun: 1.2 },
    steal: { cost: 30, cd: 40, r: 3, take: 20, gauge: 10 },
    vanish: { cost: 40, cd: 45, dur: 4, next: 2.5 },
    nimble: { pas: { dodge: 0.15 } },
    ult_rogue: { ult: 1, n: 3, mul: 2, every: 0.5 },

    fire: { cost: 10, cd: 6, r: 7, mul: 1.6, burn: 3 },
    ward: { cost: 12, cd: 25, dur: 3 },
    frost: { cost: 14, cd: 12, r: 7, mul: 0.6, ice: 2 },
    shield: { cost: 16, cd: 35, dur: 5, buf: { red: 0.5 } },
    spring: { pas: { res: 1.6 } },
    ult_mage: { ult: 1, dur: 4, every: 0.5, mul: 1.2, lag: 0.6, fall: 0.45, hitR: 1.3, spread: 1.2 },

    thorns: { cost: 10, cd: 14, r: 5, mul: 0.8, root: 1 },
    grow: { cost: 15, cd: 30, dur: 6, zr: 2.5, slow: 0.2 },
    mend: { cost: 20, cd: 30, heal: 0.15 },
    beast: { cost: 25, cd: 50, dur: 12, hp: 25, mul: 0.6, every: 1.2, sp: 4.5 },
    wild: { cost: 30, cd: 60, dur: 10, buf: { dmg: 0.4, red: 0.2, regen: 1 } },
    ult_druid: { ult: 1, dur: 8, zr: 5, root: 1.5, every: 3, regen: 3 },

    heal: { cost: 18, cd: 25, heal: 0.21 },
    cure: { cost: 15, cd: 35, imm: 2 },
    bless: { cost: 20, cd: 35, dur: 10, buf: { atk: 0.2, red: 0.1 } },
    turn: { cost: 25, cd: 30, r: 4, push: 3, blind: 2 },
    mercy: { pas: { heal: 1.15, hpr: 0.2 } },
    ult_priest: { ult: 1, r: 6, blind: 2.5, heal: 0.6 },

    hands: { cost: 25, cd: 40, heal: 0.18 },
    smite: { cost: 20, cd: 14, next: 2.2, blind: 1 },
    consecrate: { cost: 30, cd: 35, dur: 8, zr: 3, dot: 2, regen: 2 },
    faith: { cost: 25, cd: 40, dur: 6, buf: { red: 0.35 } },
    aura: { pas: { atk: 0.08, red: 0.08 } },
    ult_paladin: { ult: 1, dur: 10, zr: 5, dot: 3, slow: 0.4, buf: { red: 0.35 } },

    inspire: { cost: 12, cd: 30, dur: 10, buf: { atk: 0.2, mv: 0.1, dmg: 0.15 } },
    chord: { cost: 18, cd: 25, r: 4, mul: 1, stun: 1.2 },
    five: { cost: 10, cd: 45, dur: 6, buf: { regen: 2 }, gauge: 15 },
    voice: { pas: { cd: 0.85, res: 1.3 } },
    sour: { cost: 20, cd: 30, r: 5, mul: 0.8, drain: 15, sil: 0.8 },
    ult_bard: { ult: 1, dur: 8, r: 6, stun: 1.5, slow: 0.4, buf: { atk: 0.3, spd: 0.25 } },

    flurry: { cost: 30, cd: 30, dur: 6, buf: { spd: 1 } },
    palm: { cost: 20, cd: 12, r: 1.9, mul: 1, sil: 1.5 },
    patience: { cost: 25, cd: 35, dur: 8, buf: { dodge: 0.3, red: 0.15 } },
    calm: { pas: { res: 1.5, dodge: 0.05 } },
    windstep: { cost: 15, cd: 15, dist: 4 },
    ult_monk: { ult: 1, dur: 6, buf: { spd: 1.5, dodge: 0.45, dmg: 0.4 }, r: 3, push: 2.5 },
  },
  // добивание комбо по классу: [статус, секунд] (bard — сбит с ритма: −ресурс)
  fin: { warrior: ['stun', 1], monk: ['stun', 0.8], priest: ['blind', 2], paladin: ['blind', 2], bard: ['drain', 15],
    barbarian: ['bleed', 4], rogue: ['bleed', 4], druid: ['slow', 4], archer: ['slow', 3], mage: ['burn', 3] },
  // боты: реакция (с), доля перекатов от тяжёлых ударов, держит ли дистанцию, бережёт ли ресурс, прерывает ли
  bot: {
    1: { react: 0.6, roll: 0, kite: 0, save: 0, think: 0.6, dodgeShot: 0, zone: 0, aim: 0.6, lead: 0 },
    2: { react: 0.35, roll: 0.5, kite: 1, save: 0, think: 0.3, dodgeShot: 0.15, zone: 1, aim: 0.85, lead: 0.3 },
    3: { react: 0.2, roll: 0.85, kite: 1, save: 1, think: 0.15, dodgeShot: 0.4, zone: 1, aim: 1, lead: 0.5 },
  },
};

// Набор класса на арене: те же ключи и порядок, что в HERO_ABIL (herokit.js), ульта — шестая (клавиша 6)
const ARENA_KIT = {
  warrior: ['bash', 'cry', 'stand', 'surge', 'wall', 'ult_warrior'],
  barbarian: ['rage', 'reckless', 'stomp', 'hide', 'roar', 'ult_barbarian'],
  archer: ['aimed', 'volley', 'trap', 'eagle', 'leap', 'ult_archer'],
  rogue: ['sneak', 'trip', 'steal', 'vanish', 'nimble', 'ult_rogue'],
  mage: ['fire', 'ward', 'frost', 'shield', 'spring', 'ult_mage'],
  druid: ['thorns', 'grow', 'mend', 'beast', 'wild', 'ult_druid'],
  priest: ['heal', 'cure', 'bless', 'turn', 'mercy', 'ult_priest'],
  paladin: ['hands', 'smite', 'consecrate', 'faith', 'aura', 'ult_paladin'],
  bard: ['inspire', 'chord', 'five', 'voice', 'sour', 'ult_bard'],
  monk: ['flurry', 'palm', 'patience', 'calm', 'windstep', 'ult_monk'],
};
const ARENA_CLS = Object.keys(ARENA_KIT);

// Имена и описания на арене (поле pvp): имена прежние, кроме тех, чей деревенский смысл на арене пуст (раздел 7)
const ARENA_TXT = {
  bash: ['Удар щитом', 'Удар вплотную и оглушение на 1 с'],
  cry: ['Боевой клич', '8 с: точность +15%, снимает замедление'],
  stand: ['Непоколебимость', 'Пассивно: урон по воину −15%'],
  surge: ['Всплеск действий', '6 с: бьёт вдвое чаще, точность +25%'],
  wall: ['Стена щитов', '5 с: урон по нему −45%; соперник в 3 клетках сбит с ног на 1 с'],
  ult_warrior: ['Несокрушимый строй', 'Ульта. 6 с: урон по воину −60%, стрелы и снаряды не пробивают; соперник в 5 клетках сбит с ног на 1,5 с'],
  rage: ['Ярость', '10 с: урон +40%, по нему −30%'],
  reckless: ['Безрассудная атака', '6 с: точность +35%, но урон по нему +25%'],
  stomp: ['Топот', 'Соперник в 3 клетках падает на 1,2 с и получает удар'],
  hide: ['Толстая шкура', 'Пассивно: урон по нему −12%, +0,3% здоровья в секунду'],
  roar: ['Рык', 'Соперник в 4 клетках замедлен на 30%'],
  ult_barbarian: ['Гнев предков', 'Ульта. 10 с: урон +80%, по нему −35%, бьёт чаще; соперник в 4 клетках падает на 1 с'],
  aimed: ['Меткий выстрел', 'Следующий выстрел — без промаха и в 2,2 раза сильнее'],
  volley: ['Залп', 'Пять стрел без промаха по ×0,7; перекат или колонна спасают'],
  trap: ['Ловушка', 'Капкан под ноги (до двух): наступивший 2 с в путах и открыт'],
  eagle: ['Орлиный глаз', 'Пассивно: точность +10%, дальность +0,5 клетки'],
  leap: ['Отскок', 'Прыжок на 3 клетки от соперника, 0,3 с неуязвим'],
  ult_archer: ['Дождь стрел', 'Ульта. 3 с на зону 3 клетки у соперника падают 14 стрел; зона видна заранее — из неё можно выйти'],
  sneak: ['Скрытая атака', 'Следующий удар без промаха ×2,5, со спины ×3'],
  trip: ['Подножка', 'Соперник рядом падает на 1,2 с'],
  steal: ['Карманы', 'Крадёт у соперника 20 ресурса и 10% шкалы ульты'],
  vanish: ['Исчезновение', '4 с невидим для соперника, следующий удар ×2,5'],
  nimble: ['Увёртливость', 'Пассивно: уходит от 15% ударов'],
  ult_rogue: ['Танец теней', 'Ульта. Три удара ×2 из-за спины соперника, между ними неуязвим'],
  fire: ['Огненный шар', 'Снаряд ×1,6, поджигает на 3 с'],
  ward: ['Оберег', '3 с: следующий контроль не действует; снимает горение и кровь'],
  frost: ['Ледяная стрела', 'Снаряд: соперник во льду 2 с, удар по замёрзшему сильнее'],
  shield: ['Щит', '5 с: урон по магу −50%'],
  spring: ['Источник', 'Пассивно: мана копится в 1,6 раза быстрее'],
  ult_mage: ['Метеоритный дождь', 'Ульта. 4 с метеориты падают вокруг соперника; зона идёт за ним с отставанием — можно убежать'],
  thorns: ['Шипы', 'Соперник в 5 клетках: удар ×0,8 и 1 с в путах'],
  grow: ['Корни', '6 с: земля в 2,5 клетки вокруг друида замедляет соперника на 20%'],
  mend: ['Целебное слово', '+15% здоровья'],
  beast: ['Призыв зверя', '12 с дух-волк кусает соперника; волка можно убить'],
  wild: ['Дикий облик', '10 с: урон +40%, по нему −20%, +1% здоровья в секунду'],
  ult_druid: ['Гнев природы', 'Ульта. 8 с роща в 5 клетках: соперник в путах каждые 3 с, друид лечится'],
  heal: ['Исцеление', '+21% здоровья'],
  cure: ['Очищение', 'Снимает все статусы и 2 с защищает от контроля'],
  bless: ['Благословение', '10 с: точность +20%, урон по жрецу −10%'],
  turn: ['Изгнание', 'Соперник в 4 клетках отброшен на 3 клетки и ослеплён на 2 с'],
  mercy: ['Милосердие', 'Пассивно: лечение ×1,15, +0,2% здоровья в секунду'],
  ult_priest: ['Чудо', 'Ульта. +60% здоровья и снятие всех статусов; соперник в 6 клетках ослеплён на 2,5 с'],
  hands: ['Наложение рук', '+18% здоровья'],
  smite: ['Святой удар', 'Следующий удар без промаха ×2,2 и ослепляет на 1 с'],
  consecrate: ['Освящение', '8 с круг 3 клетки: соперник в нём горит, паладин лечится'],
  faith: ['Щит веры', '6 с: урон по паладину −35%'],
  aura: ['Аура мужества', 'Пассивно: точность +8%, урон по нему −8%'],
  ult_paladin: ['Кара Костра', 'Ульта. 10 с солнце в 5 клетках: соперник горит и замедлен, по паладину −35%'],
  inspire: ['Песня бодрости', '10 с: точность +20%, урон +15%, скорость +10%'],
  chord: ['Оглушающий аккорд', 'Соперник в 4 клетках получает удар и оглушён на 1,2 с'],
  five: ['Дай пять!', 'Трибуны ревут: 6 с бард лечится, шкала ульты +15%'],
  voice: ['Звонкий голос', 'Пассивно: откаты короче на 15%, мана быстрее'],
  sour: ['Фальшивая нота', 'Соперник в 5 клетках: удар ×0,8, −15 ресурса и 0,8 с не может колдовать'],
  ult_bard: ['Эпическая баллада', 'Ульта. 8 с: соперник в 6 клетках пляшет (оглушён, потом замедлен), бард точнее и быстрее'],
  flurry: ['Шквал ударов', '6 с: бьёт вдвое чаще'],
  palm: ['Удар ладонью', 'Удар и 1,5 с соперник не может колдовать'],
  patience: ['Терпеливая оборона', '8 с: уворот +30%, урон по нему −15%'],
  calm: ['Внутренний покой', 'Пассивно: энергия в 1,5 раза быстрее, уворот +5%'],
  windstep: ['Шаг ветра', 'Рывок к сопернику на 4 клетки, следующий удар без промаха'],
  ult_monk: ['Тысяча ударов', 'Ульта. 6 с: бьёт в 2,5 раза чаще, уворот +45%, урон +40%; соперник в 3 клетках отброшен'],
};
// деревенские способности получают арена-описание (одна таблица на обе стороны)
if (typeof HERO_ABIL !== 'undefined') for (const c in HERO_ABIL) for (const a of HERO_ABIL[c]) if (ARENA_TXT[a.k]) a.pvp = ARENA_TXT[a.k][1];

// ---------- Случайность и геометрия ----------
// rngMake (dungeon.js), но с состоянием в объекте: состояние боя целиком сериализуемо
function arRnd(o) {
  const a = o.rs = (o.rs + 0x6D2B79F5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const arD2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
const arDist = (a, b) => Math.sqrt(arD2(a.x, a.y, b.x, b.y));
const arClamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// расстояние от точки до отрезка (квадрат)
function arSegD2(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay, L = vx * vx + vy * vy;
  let k = L > 0 ? ((px - ax) * vx + (py - ay) * vy) / L : 0;
  k = k < 0 ? 0 : k > 1 ? 1 : k;
  return arD2(px, py, ax + vx * k, ay + vy * k);
}
// прямая видимость: колонны закрывают, ящики — нет
function arLos(ax, ay, bx, by) {
  for (const o of ARENA_TUNE.obs) if (o.k === 'col' && arSegD2(o.x, o.y, ax, ay, bx, by) < o.r * o.r) return false;
  return true;
}

// ---------- Создание боя ----------
function arStFresh() {
  return { stun: 0, ice: 0, root: 0, slow: 0, slowV: 1, burn: 0, burnB: 0, burnS: -1, bleed: 0, bleedB: 0, bleedS: -1,
    open: 0, blind: 0, sil: 0, invis: 0, inv: 0, ward: 0, imm: 0, stunImm: 0, rootImm: 0, lastStun: -99, block: 0 };
}
function arPassives(cls) {
  const C = ARENA_TUNE.cls[cls], p = { red: 0, atk: 0, dodge: C.dodge || 0, hpr: 0, rng: 0, res: 1, heal: 1, cd: 1 };
  for (const k of ARENA_KIT[cls]) {
    const P = ARENA_TUNE.ab[k].pas;
    if (!P) continue;
    for (const q in P) if (q === 'res' || q === 'heal' || q === 'cd') p[q] *= P[q]; else p[q] += P[q];
  }
  return p;
}
function arFighter(S, i, cls, nm) {
  const C = ARENA_TUNE.cls[cls];
  const F = { i, cls, nm: nm || '', x: 0, y: 0, dx: i ? -1 : 1, dy: 0, face: i ? -1 : 1, vx: 0, vy: 0, mx: 0, my: 0,
    hp: C.hp, mhp: C.hp, rk: C.res, res: 0, ult: 0, pas: arPassives(cls), cd: {}, buf: {}, st: arStFresh(),
    atkCd: 0.6, lock: 0, atkN: 0, swing: null, cmbN: 0, cmbT: -9, roll: null, rollCd: 0, rollAt: -9, next: 0, nextK: '',
    combat: -9, dance: null, anim: null, wins: 0, sm: { dmg: 0, taken: 0, hit: 0, miss: 0, perfect: 0, stunT: 0, heal: 0, casts: 0, ults: 0 } };
  arRoundReset(S, F);
  return F;
}
function arRoundReset(S, F) {
  const T = ARENA_TUNE, side = F.i ? 1 : -1;
  F.x = T.cx + side * T.start; F.y = T.cy; F.dx = -side; F.dy = 0; F.face = -side; F.vx = F.vy = 0; F.mx = F.my = 0;
  F.hp = F.mhp; F.res = T.res[F.rk].start; F.ult = 0; F.cd = {}; F.buf = {}; F.st = arStFresh();
  F.atkCd = 0.6; F.lock = 0; F.atkN = 0; F.swing = null; F.cmbN = 0; F.cmbT = -9; F.roll = null; F.rollCd = 0; F.rollAt = -9;
  F.next = 0; F.nextK = ''; F.combat = -9; F.dance = null; F.anim = null; F.dead = false; F.finT = 0; F.ultN = 0;
  F.rs = { dmg: 0, taken: 0 };
}

// opt: { seed, cls: [a, b], nm: [a, b], bots: [null | 1..3, null | 1..3] }
function arenaNew(opt) {
  const seed = (opt.seed >>> 0) || 1;
  const S = { v: ARENA_TUNE.v, proto: ARENA_PROTO, seed, rs: seed, tick: 0, T: 0, t: 0, phase: 'count', phT: ARENA_TUNE.countT, round: 1,
    score: [0, 0], winner: -1, sur: -1, rw: [], f: [], shots: [], zones: [], pets: [], ev: [], bots: [null, null], ring: ARENA_TUNE.R, ot: 0, cnt: 3 };
  for (let i = 0; i < 2; i++) {
    const cls = ARENA_KIT[opt.cls && opt.cls[i]] ? opt.cls[i] : 'warrior';
    S.f.push(arFighter(S, i, cls, opt.nm && opt.nm[i]));
    const tier = opt.bots && opt.bots[i];
    if (tier) { S.bots[i] = { tier: arClamp(tier | 0, 1, 3), rs: (seed * 7919 + 101 * (i + 1)) >>> 0, think: 0, mx: 0, my: 0, rollAt: -1, rollDir: 0, sw: -1, swRoll: false, cast: -1, seen: null, lastSeen: null, shotSeen: -1, wander: 0, fm: null }; arBotForm(S.bots[i]); }
  }
  S.ev.push({ k: 'count', n: 3 });
  return S;
}

// ---------- Вспомогательное: усиления, статусы, урон ----------
function arStat(S, F, key) {
  let s = F.pas[key] || 0;
  const ab = ARENA_TUNE.ab;
  for (const k in F.buf) if (F.buf[k] > S.T) { const b = ab[k].buf; if (b && b[key]) s += b[key]; }
  return s;
}
const arOn = (S, F, s) => F.st[s] > S.T;
const arHard = (S, F) => F.st.stun > S.T || F.st.ice > S.T;            // не ходит, не бьёт, не колдует
const arVisible = (S, F) => !(F.st.invis > S.T);
function arEv(S, e) { S.ev.push(e); }

function arDodge(S, F) { return Math.min(ARENA_TUNE.dodgeMax, arStat(S, F, 'dodge')); }
function arRed(S, F) { return arClamp(arStat(S, F, 'red'), ARENA_TUNE.redMin, ARENA_TUNE.redMax); }

// Контроль с PvP-правилами (раздел 6.4): оглушение и лёд — потолок и иммунитет 3 с, второе подряд за 6 с — вдвое короче;
// путы — свой иммунитет; «Оберег» мага гасит следующий контроль; «Очищение» жреца — полная защита на 2 с
function arCC(S, src, B, kind, dur, opt) {
  const T = ARENA_TUNE, now = S.T, st = B.st;
  if (B.dead || st.inv > now) return 0;
  const hard = kind === 'stun' || kind === 'ice' || kind === 'root' || kind === 'sil';
  if (hard) {
    if (st.imm > now) { arEv(S, { k: 'imm', i: B.i }); return 0; }
    if (st.ward > now) { st.ward = 0; arEv(S, { k: 'ward', i: B.i }); return 0; }
  }
  let d = dur;
  if (kind === 'stun' || kind === 'ice') {
    if (st.stunImm > now && !(opt && opt.force)) { arEv(S, { k: 'imm', i: B.i }); return 0; }
    d = Math.min(d, kind === 'ice' ? T.iceMax : T.stunMax);
    if (now - st.lastStun < T.ccWin) d *= 0.5;
    st.lastStun = now;
    st[kind] = now + d;
    st.stunImm = now + d + T.ccImm;
    if (B.swing) { B.swing = null; arEv(S, { k: 'break', i: B.i }); }
    B.roll = null; B.dance = null;
    B.sm.stunT += d;
  } else if (kind === 'root') {
    if (st.rootImm > now && !(opt && opt.force)) { arEv(S, { k: 'imm', i: B.i }); return 0; }
    d = Math.min(d, T.rootMax);
    st.root = Math.max(st.root, now + d);
    if (!(opt && opt.force)) st.rootImm = now + d + T.rootImm;
  } else if (kind === 'slow') {
    d = Math.min(d, T.slowMax);
    const v = 1 - ((opt && opt.pct) || (1 - T.slowMul));
    st.slowV = st.slow > now ? Math.min(st.slowV, v) : v;
    st.slow = Math.max(st.slow, now + d);
  } else if (kind === 'sil') {
    d = Math.min(d, T.silMax);
    st.sil = Math.max(st.sil, now + d);
  } else if (kind === 'blind') st.blind = Math.max(st.blind, now + d);
  else if (kind === 'open') st.open = Math.max(st.open, now + d);
  else if (kind === 'burn' || kind === 'bleed') {
    // горение и кровь: 2%/с, один источник обновляет, не складывает; потолок 25% здоровья за эффект
    const on = st[kind] > now;
    st[kind] = Math.max(st[kind], now + d);
    if (!on) st[kind + 'B'] = T.dotCap * B.mhp;
    st[kind + 'S'] = src ? src.i : -1;
  }
  arEv(S, { k: 'st', i: B.i, s: kind, d: Math.round(d * 10) / 10 });
  return d;
}

// изменение ресурса
function arRes(F, n) { F.res = arClamp(F.res + n, 0, 100); }
// шкала ульты: одна ульта за раунд (АРЕНА.md 7.3 — «в среднем одна ульта за раунд»), иначе затяжной бой с лечением даёт три
function arUltAdd(F, n) { if (F.ultN < ARENA_TUNE.ultPerRound) F.ult = Math.min(100, F.ult + n); }
// лечение в овертайме вдвое слабее: затяжка лечением не должна переигрывать урон
const arHealMul = S => (S.ot ? ARENA_TUNE.otHeal : 1);

// Урон по B. kind: 'hit' — удар или снаряд (броня, ярость, лёд), 'dot' — горение/кровь, 'zone' — песок, круги
function arHurt(S, A, B, n, kind, info) {
  const T = ARENA_TUNE, now = S.T;
  if (B.dead || n <= 0) return 0;
  if (B.st.inv > now) { arEv(S, { k: 'inv', i: B.i }); return 0; }
  if (kind === 'hit') {
    n *= 1 - arRed(S, B);
    if (B.st.ice > now) { n *= T.iceMul; B.st.ice = 0; arEv(S, { k: 'shatter', i: B.i }); }
  }
  n = Math.max(0, n);
  B.hp -= n;
  B.sm.taken += n; B.rs.taken += n;
  if (A && A !== B) {
    A.sm.dmg += n; A.rs.dmg += n;
    arUltAdd(A, n / B.mhp * 100 * T.ultDeal);
    if (kind === 'hit') { A.combat = now; const R = T.res[A.rk]; if (R.hit) arRes(A, R.hit); }
  }
  if (kind !== 'zone' || A) arUltAdd(B, n / B.mhp * 100 * T.ultTake);
  if (kind === 'hit') { B.combat = now; const R = T.res[B.rk]; if (R.hurt) arRes(B, R.hurt); B.anim = { k: 'hurt', t: now }; }
  // невидимого плута удар не раскрывает, но шлейф «задели» виден
  if (kind !== 'dot') arEv(S, Object.assign({ k: 'dmg', i: B.i, a: A ? A.i : -1, n: Math.round(n * 10) / 10, kind }, info || null));
  if (B.hp <= 0) { B.hp = 0; B.dead = true; }
  return n;
}
function arenaHealF(S, F, part, why) {
  if (F.dead) return 0;
  const n = Math.min(F.mhp - F.hp, F.mhp * part * F.pas.heal * arHealMul(S));
  if (n <= 0) return 0;
  F.hp += n; F.sm.heal += n;
  arEv(S, { k: 'heal', i: F.i, n: Math.round(n * 10) / 10, why: why || '' });
  return n;
}

// Бросок на попадание: без промаха — «открыт», оглушён/лёд, «наверняка»; иначе точность − уворот − ослепление
function arRoll(S, A, B, sure) {
  const T = ARENA_TUNE, C = T.cls[A.cls], now = S.T;
  if (sure || B.st.open > now || B.st.stun > now || B.st.ice > now) return true;
  let p = C.acc * (1 + arStat(S, A, 'atk'));
  if (C.melee && arDist(A, B) < 1.8) p *= C.melee;
  if (A.st.blind > now) p -= T.blind;
  p -= arDodge(S, B);
  p = arClamp(p, T.accMin, T.accMax);
  return arRnd(S) < p;
}
function arDmg(S, A, mul) {
  const T = ARENA_TUNE, C = T.cls[A.cls];
  return C.dmg * mul * (1 + arStat(S, A, 'dmg')) * (1 - T.spread + 2 * T.spread * arRnd(S));
}
// удар по бойцу со всеми множителями: открыт, крит; возвращает нанесённое
function arStrike(S, A, B, mul, opt) {
  const T = ARENA_TUNE, C = T.cls[A.cls], now = S.T;
  opt = opt || {};
  if (!arRoll(S, A, B, opt.sure)) { A.sm.miss++; arEv(S, { k: 'miss', i: B.i, a: A.i }); return -1; }
  let m = mul;
  const open = B.st.open > now;
  if (open) m *= T.openMul;
  const crit = arRnd(S) < (C.crit || T.crit);
  if (crit) m *= T.critMul;
  A.sm.hit++;
  return arHurt(S, A, B, arDmg(S, A, m), 'hit', { crit: crit ? 1 : 0, open: open ? 1 : 0, src: opt.src || '', heavy: opt.heavy ? 1 : 0, fin: opt.fin ? 1 : 0, back: opt.back ? 1 : 0 });
}

// ---------- Движение ----------
// можно ли стоять: стена — круг, препятствия и соперник — круги; уже застрявший может выходить (не углубляться)
function arFreeAt(S, F, x, y, strict) {
  const T = ARENA_TUNE, r = T.fr;
  const wr = T.R - r, d0 = arD2(F.x, F.y, T.cx, T.cy), d1 = arD2(x, y, T.cx, T.cy);
  if (d1 > wr * wr && (strict || d1 > d0)) return false;
  for (const o of T.obs) {
    const rr = (o.r + r) * (o.r + r), a = arD2(x, y, o.x, o.y);
    if (a < rr && (strict || a < arD2(F.x, F.y, o.x, o.y))) return false;
  }
  const O = S.f[1 - F.i];
  if (O && !O.dead) {
    const rr = 4 * r * r, a = arD2(x, y, O.x, O.y);
    if (a < rr && (strict || a < arD2(F.x, F.y, O.x, O.y))) return false;
  }
  return true;
}
// кто мешает встать в точку: нормаль от препятствия к бойцу (у борта — к центру)
function arBlocker(S, F, x, y) {
  const T = ARENA_TUNE, r = T.fr, wr = T.R - r;
  const nrm = (ax, ay) => { const L = Math.sqrt(ax * ax + ay * ay) || 1; return [ax / L, ay / L]; };
  if (arD2(x, y, T.cx, T.cy) > wr * wr) return nrm(T.cx - F.x, T.cy - F.y);
  for (const o of T.obs) if (arD2(x, y, o.x, o.y) < (o.r + r) * (o.r + r)) return nrm(F.x - o.x, F.y - o.y);
  const O = S.f[1 - F.i];
  if (O && !O.dead && arD2(x, y, O.x, O.y) < 4 * r * r) return nrm(F.x - O.x, F.y - O.y);
  return null;
}
function arMove(S, F, mx, my) {
  if (!mx && !my) return false;
  if (arFreeAt(S, F, F.x + mx, F.y + my)) { F.x += mx; F.y += my; return true; }
  // скользим вдоль препятствия: убираем из шага часть «в препятствие» (дважды — на случай угла между двумя)
  for (let k = 0; k < 2; k++) {
    const n = arBlocker(S, F, F.x + mx, F.y + my);
    if (!n) break;
    const d = mx * n[0] + my * n[1];
    if (d >= 0) break;
    mx -= d * n[0]; my -= d * n[1];
    if (Math.abs(mx) + Math.abs(my) < 1e-4) return false;
    if (arFreeAt(S, F, F.x + mx, F.y + my)) { F.x += mx; F.y += my; return true; }
  }
  if (mx && arFreeAt(S, F, F.x + mx, F.y)) { F.x += mx; return true; }
  if (my && arFreeAt(S, F, F.x, F.y + my)) { F.y += my; return true; }
  return false;
}
// обход для бота: если прямой путь упирается в колонну, ящик или чужую зону (Корни, Освящение, роща) — идти
// к точке сбоку от неё. Зону, в которой уже стоит бот или его цель, не обходим (из неё выходят или в ней дерутся)
const AR_STEER_Z = { roots: 1, holy: 1, grove: 1 };
function arSteer(S, F, tx, ty) {
  const T = ARENA_TUNE;
  let best = null, bk = 2, br = 0;
  const vx = tx - F.x, vy = ty - F.y, L2 = vx * vx + vy * vy;
  if (L2 < 0.01) return [tx, ty];
  const test = (x, y, r) => {
    const k = ((x - F.x) * vx + (y - F.y) * vy) / L2;
    if (k <= 0 || k >= 1.2 || arSegD2(x, y, F.x, F.y, tx, ty) >= r * r) return;
    if (k < bk) { bk = k; best = { x, y }; br = r; }
  };
  for (const o of T.obs) test(o.x, o.y, o.r + T.fr + 0.08);
  for (const z of S.zones) {
    if (!AR_STEER_Z[z.k] || z.o === F.i) continue;
    const r = z.r + T.fr * 0.5;
    if (arD2(F.x, F.y, z.x, z.y) < r * r || arD2(tx, ty, z.x, z.y) < r * r) continue;
    test(z.x, z.y, r);
  }
  if (!best) return [tx, ty];
  const L = Math.sqrt(L2), px = -vy / L, py = vx / L;
  const side = (F.x - best.x) * px + (F.y - best.y) * py >= 0 ? 1 : -1, off = br + 0.45;
  return [best.x + px * side * off, best.y + py * side * off];
}
// толчок/рывок по прямой мелкими шагами (до первого препятствия)
function arPush(S, F, ux, uy, dist) {
  const n = Math.max(1, Math.ceil(dist / 0.2)), sx = ux * dist / n, sy = uy * dist / n;
  let k = 0;
  for (; k < n; k++) if (!arFreeAt(S, F, F.x + sx, F.y + sy)) break; else { F.x += sx; F.y += sy; }
  return k * dist / n;
}
// свободная клетка рядом с точкой (телепорт плута, рывок монаха)
function arSpotNear(S, F, x, y, ux, uy) {
  const cand = [[ux, uy], [uy, -ux], [-uy, ux], [-ux, -uy]];
  for (const [a, b] of cand) for (const d of [0.95, 1.2]) {
    const px = x + a * d, py = y + b * d;
    if (arFreeAt(S, F, px, py, true)) return [px, py];
  }
  return null;
}

// ---------- Вход: только намерение ----------
// очистка: всё, что прислал клиент, — числа в своих пределах; лишнее отбрасывается (раздел 13)
function arenaInput(raw) {
  const q = v => (Number.isFinite(v) ? Math.round(arClamp(v, -1, 1) * 100) / 100 : 0);
  const o = raw && typeof raw === 'object' ? raw : {};
  let mx = q(o.mx), my = q(o.my);
  const L = Math.sqrt(mx * mx + my * my);
  if (L > 1) { mx /= L; my /= L; }
  const cast = Number.isInteger(o.cast) && o.cast >= 0 && o.cast < 6 ? o.cast : -1;
  const aim = Array.isArray(o.aim) && o.aim.length === 2 && Number.isFinite(o.aim[0]) && Number.isFinite(o.aim[1])
    ? [arClamp(o.aim[0], 0, 2 * ARENA_TUNE.R), arClamp(o.aim[1], 0, 2 * ARENA_TUNE.R)] : null;
  return { mx, my, cast, roll: o.roll ? 1 : 0, aim };
}

// ---------- Способности ----------
function arCdLeft(S, F, k) { return Math.max(0, (F.cd[k] || 0) - S.T); }
function arCanCast(S, F, slot) {
  const k = ARENA_KIT[F.cls][slot], a = k && ARENA_TUNE.ab[k];
  if (!a || a.pas) return 'pas';
  if (F.dead || S.phase !== 'fight') return 'phase';
  if (arHard(S, F) || F.dance) return 'stun';
  if (F.st.sil > S.T) return 'sil';
  if (a.ult) return F.ult >= 100 ? '' : 'ult';
  if (arCdLeft(S, F, k) > 0) return 'cd';
  if (F.res < a.cost) return 'res';
  return '';
}
// соперник в радиусе и виден: для способностей «по сопернику»
function arFoeIn(S, F, r) {
  const O = S.f[1 - F.i];
  return !O.dead && arVisible(S, O) && arDist(F, O) <= r + ARENA_TUNE.reach ? O : null;
}
function arShot(S, A, B, kind, mul, extra) {
  S.shots.push(Object.assign({ o: A.i, tg: B.i, pet: -1, x: A.x, y: A.y, sp: ARENA_TUNE.shotSp, mul, kind, sure: 0, auto: 0, delay: 0, fx: null }, extra || null));
  arEv(S, { k: 'shot', i: A.i, s: kind });
}
function arZone(S, z) { S.zones.push(Object.assign({ t0: S.T, nt: S.T, n: 0 }, z)); }

// Применение способности. false — не сработала (ресурс и откат не тратятся)
function arCast(S, F, slot, inp) {
  const why = arCanCast(S, F, slot);
  const k = ARENA_KIT[F.cls][slot];
  if (why) { if (why !== 'pas' && why !== 'phase') arEv(S, { k: 'fail', i: F.i, ab: k, why }); return false; }
  const a = ARENA_TUNE.ab[k], T = ARENA_TUNE, now = S.T, O = S.f[1 - F.i];
  const need = r => { const o = arFoeIn(S, F, r); if (!o) arEv(S, { k: 'fail', i: F.i, ab: k, why: arVisible(S, O) ? 'far' : 'hidden' }); return o; };
  let B = null;
  switch (k) {
    // воин
    case 'bash': case 'palm': if (!(B = need(a.r))) return false; arStrike(S, F, B, a.mul, { src: k }); if (a.stun) arCC(S, F, B, 'stun', a.stun); if (a.sil) arCC(S, F, B, 'sil', a.sil); break;
    case 'cry': F.st.slow = 0; break;
    case 'wall': case 'ult_warrior': case 'stomp': case 'ult_barbarian': case 'chord': case 'trip':
      if (k === 'stomp' || k === 'chord' || k === 'trip') { if (!(B = need(a.r))) return false; }
      else B = arFoeIn(S, F, a.r);
      if (B) { if (a.mul) arStrike(S, F, B, a.mul, { src: k }); arCC(S, F, B, 'stun', a.stun); }
      if (k === 'ult_warrior') F.st.block = now + a.dur;
      break;
    case 'roar': if (!(B = need(a.r))) return false; arCC(S, F, B, 'slow', a.slowT, { pct: a.slow }); break;
    // лучник
    case 'volley': {
      if (!(B = need(T.cls[F.cls].rng + F.pas.rng))) return false;
      for (let n = 0; n < a.n; n++) arShot(S, F, B, 'arrow', a.mul, { sure: 1, delay: n * a.gap });
      break;
    }
    case 'trap': {
      const mine = S.zones.filter(z => z.k === 'trap' && z.o === F.i);
      if (mine.length >= a.max) S.zones.splice(S.zones.indexOf(mine[0]), 1);
      arZone(S, { k: 'trap', o: F.i, x: F.x, y: F.y + 0.15, r: a.zr, t1: now + a.life });
      break;
    }
    case 'leap': {
      let ux = F.x - O.x, uy = F.y - O.y, L = Math.sqrt(ux * ux + uy * uy);
      if (L < 0.01) { ux = -F.dx; uy = -F.dy; L = 1; }
      F.st.inv = Math.max(F.st.inv, now + a.inv);
      arPush(S, F, ux / L, uy / L, a.dist);
      F.roll = { t0: now, dx: 0, dy: 0, leap: 1 };
      break;
    }
    case 'ult_archer': {
      if (O.dead) return false;
      const p = inp && inp.aim ? inp.aim : [O.x + O.vx * a.lead, O.y + O.vy * a.lead];
      arZone(S, { k: 'rain', o: F.i, x: arClamp(p[0], 1, 13), y: arClamp(p[1], 1, 13), r: a.zr, t1: now + a.delay + a.dur, nt: now + a.delay });
      break;
    }
    // плут
    case 'steal': {
      if (!(B = need(a.r))) return false;
      const n = Math.min(a.take, B.res); arRes(B, -n); arRes(F, n);
      const g = Math.min(a.gauge, B.ult); B.ult -= g; arUltAdd(F, g);
      arEv(S, { k: 'steal', i: B.i, a: F.i, n: Math.round(n), g: Math.round(g) });
      break;
    }
    case 'vanish': F.st.invis = now + a.dur; F.next = a.next; F.nextK = k; break;
    case 'ult_rogue': if (O.dead || !arVisible(S, O)) { arEv(S, { k: 'fail', i: F.i, ab: k, why: 'hidden' }); return false; } F.dance = { n: a.n, next: now }; F.st.inv = now + a.n * a.every + 0.1; break;
    // маг
    case 'fire': case 'frost': {
      if (!(B = need(a.r))) return false;
      if (!arLos(F.x, F.y, B.x, B.y)) { arEv(S, { k: 'fail', i: F.i, ab: k, why: 'los' }); return false; }
      arShot(S, F, B, k, a.mul, { fx: k === 'fire' ? { burn: a.burn } : { ice: a.ice }, sp: T.shotSp * 0.9 });
      break;
    }
    case 'ward': F.st.ward = now + a.dur; F.st.burn = 0; F.st.bleed = 0; break;
    case 'ult_mage': if (O.dead) return false; arZone(S, { k: 'meteor', o: F.i, x: O.x, y: O.y, r: 4, t1: now + a.dur, nt: now + 0.2, hist: [[now, O.x, O.y]], marks: [] }); break;
    // друид
    case 'thorns': if (!(B = need(a.r))) return false; arStrike(S, F, B, a.mul, { src: k, sure: 1 }); arCC(S, F, B, 'root', a.root); break;
    case 'grow': arZone(S, { k: 'roots', o: F.i, x: F.x, y: F.y, r: a.zr, t1: now + a.dur }); break;
    case 'beast': {
      for (let n = S.pets.length - 1; n >= 0; n--) if (S.pets[n].o === F.i) S.pets.splice(n, 1);
      S.pets.push({ o: F.i, x: F.x - F.dx * 0.8, y: F.y - F.dy * 0.8 + 0.2, hp: a.hp, mhp: a.hp, t1: now + a.dur, bite: now + 0.6, face: F.face, bt: -9 });
      break;
    }
    case 'ult_druid': arZone(S, { k: 'grove', o: F.i, x: F.x, y: F.y, r: a.zr, t1: now + a.dur, nt: now }); break;
    // жрец
    case 'cure': F.st = Object.assign(arStFresh(), { inv: F.st.inv, invis: F.st.invis, lastStun: F.st.lastStun, stunImm: F.st.stunImm, rootImm: F.st.rootImm, block: F.st.block, imm: now + a.imm }); arEv(S, { k: 'cleanse', i: F.i }); break;
    case 'turn': {
      if (!(B = need(a.r))) return false;
      let ux = B.x - F.x, uy = B.y - F.y, L = Math.sqrt(ux * ux + uy * uy) || 1;
      if (!(B.st.inv > now) && !(B.st.imm > now)) arPush(S, B, ux / L, uy / L, a.push);
      arCC(S, F, B, 'blind', a.blind);
      break;
    }
    case 'ult_priest': {
      arenaHealF(S, F, a.heal, k);
      F.st = Object.assign(arStFresh(), { inv: F.st.inv, invis: F.st.invis, lastStun: F.st.lastStun, stunImm: F.st.stunImm, rootImm: F.st.rootImm, block: F.st.block, imm: F.st.imm });
      B = arFoeIn(S, F, a.r);
      if (B) arCC(S, F, B, 'blind', a.blind);
      break;
    }
    // паладин
    case 'consecrate': arZone(S, { k: 'holy', o: F.i, x: F.x, y: F.y, r: a.zr, t1: now + a.dur }); break;
    case 'ult_paladin': arZone(S, { k: 'sun', o: F.i, x: F.x, y: F.y, r: a.zr, t1: now + a.dur, fol: 1 }); break;
    // бард
    case 'five': arUltAdd(F, a.gauge); break;
    case 'sour': {
      if (!(B = need(a.r))) return false;
      const n = Math.min(a.drain, B.res); arRes(B, -n);
      arEv(S, { k: 'drain', i: B.i, n: Math.round(n) });
      arStrike(S, F, B, a.mul, { src: k, sure: 1 });
      arCC(S, F, B, 'sil', a.sil);
      break;
    }
    case 'ult_bard': B = arFoeIn(S, F, a.r); if (B) { const d = arCC(S, F, B, 'stun', a.stun); arCC(S, F, B, 'slow', a.dur - d, { pct: a.slow }); } break;
    // монах
    case 'windstep': {
      if (O.dead || !arVisible(S, O)) { arEv(S, { k: 'fail', i: F.i, ab: k, why: 'hidden' }); return false; }
      let ux = O.x - F.x, uy = O.y - F.y; const L = Math.sqrt(ux * ux + uy * uy) || 1; ux /= L; uy /= L;
      arPush(S, F, ux, uy, Math.max(0, Math.min(a.dist, L - 0.95)));
      F.next = Math.max(F.next, 1); F.nextK = k;
      F.roll = { t0: now, dx: 0, dy: 0, leap: 1 };
      break;
    }
    case 'ult_monk': {
      B = arFoeIn(S, F, a.r);
      if (B && !(B.st.inv > now)) { let ux = B.x - F.x, uy = B.y - F.y; const L = Math.sqrt(ux * ux + uy * uy) || 1; arPush(S, B, ux / L, uy / L, a.push); arStrike(S, F, B, 1, { src: k, sure: 1 }); }
      break;
    }
    default:
      if (a.heal) arenaHealF(S, F, a.heal, k);
      if (a.next) { F.next = a.next; F.nextK = k; }
  }
  // общее: время действия, ресурс, откат
  if (a.dur && a.buf) F.buf[k] = now + a.dur;
  if (a.next && F.nextK !== k && k !== 'vanish') { F.next = a.next; F.nextK = k; }
  if (a.ult) { F.ult = 0; F.ultN++; F.sm.ults++; } else { arRes(F, -a.cost); F.cd[k] = now + a.cd * F.pas.cd; }
  // колдовство раскрывает невидимку (кроме самого исчезновения)
  if (k !== 'vanish' && F.st.invis > now) F.st.invis = 0;
  F.sm.casts++;
  F.anim = { k: 'cast', t: now, ab: k };
  arEv(S, { k: a.ult ? 'ult' : 'cast', i: F.i, ab: k });
  return true;
}

// ---------- Удары с руки ----------
function arTarget(S, F) {
  // цель: соперник (если виден) или его дух-волк, кто ближе
  const O = S.f[1 - F.i];
  let best = !O.dead && arVisible(S, O) ? O : null, bd = best ? arDist(F, O) : 1e9;
  for (const p of S.pets) if (p.o === O.i && p.hp > 0) { const d = arDist(F, p); if (d < bd - 0.5) { best = p; bd = d; } }
  return best ? { o: best, d: bd, pet: best !== O } : null;
}
function arAuto(S, F, dt) {
  const T = ARENA_TUNE, C = T.cls[F.cls], now = S.T;
  F.atkCd -= dt;
  if (F.swing) {
    // тяжёлый замах: стоит, клин на земле, удар — в конце замаха
    if (now < F.swing.t1) return;
    arHeavy(S, F);
    return;
  }
  if (F.atkCd > 0 || arHard(S, F) || F.dance || F.roll) return;
  const tg = arTarget(S, F);
  if (!tg) return;
  const rng = C.rng + F.pas.rng;
  if (tg.d > rng + T.reach) return;
  if (C.shot && !arLos(F.x, F.y, tg.o.x, tg.o.y)) return;
  const spd = 1 + arStat(S, F, 'spd');
  F.atkCd = C.atkT / spd;
  F.lock = C.shot ? T.shotLock : T.atkLock;
  if (F.st.invis > now) F.st.invis = 0;
  if (tg.pet) {
    // по волку: просто удар, без комбо
    tg.o.hp -= arDmg(S, F, 1); tg.o.ht = now;
    F.anim = { k: 'atk', t: now };
    arEv(S, { k: 'pet', i: F.i, n: 1 });
    if (C.shot) arEv(S, { k: 'shot', i: F.i, s: C.shot });
    return;
  }
  const B = tg.o;
  F.anim = { k: 'atk', t: now };
  if (C.shot) {
    // стрелок: снаряд летит, попадание — по факту прилёта
    const sure = F.next > 0, mul = F.next > 0 ? F.next : 1;
    arShot(S, F, B, C.shot, mul, { sure: sure ? 1 : 0, auto: 1, nk: F.nextK });
    F.next = 0; F.nextK = '';
    return;
  }
  F.atkN++;
  if (F.atkN % T.heavyEvery === 0 && !F.next) {
    // каждый третий удар ближника — тяжёлый: замах 0,4 с, красный клин
    let ux = B.x - F.x, uy = B.y - F.y; const L = Math.sqrt(ux * ux + uy * uy) || 1;
    F.swing = { t0: now, t1: now + T.heavyWind, ux: ux / L, uy: uy / L, r: rng + T.heavyExtra };
    F.lock = T.heavyWind;
    arEv(S, { k: 'tel', i: F.i });
    return;
  }
  arMelee(S, F, B, 1, false);
}
// удар с руки по сопернику: «наверняка» от способностей, со спины, комбо и добивание
function arMelee(S, F, B, mul, heavy) {
  const T = ARENA_TUNE, now = S.T;
  let m = mul, sure = false, back = false, src = heavy ? 'heavy' : '';
  if (F.next > 0) {
    m *= F.next; sure = true; src = F.nextK;
    // скрытая атака со спины: соперник смотрит в другую сторону (угол > 120°)
    if (F.nextK === 'sneak' || F.nextK === 'vanish') {
      const vx = F.x - B.x, vy = F.y - B.y, L = Math.sqrt(vx * vx + vy * vy) || 1;
      if ((vx * B.dx + vy * B.dy) / L < -0.5) { m *= T.ab.sneak.back / T.ab.sneak.next; back = true; }
    }
    if (F.nextK === 'smite') arCC(S, F, B, 'blind', T.ab.smite.blind);
    F.next = 0; F.nextK = '';
  }
  // комбо: три попадания за 2,5 с — добивание
  if (!(F.cmbT > now - T.comboT)) F.cmbN = 0;
  const fin = F.cmbN + 1 >= T.comboN;
  if (fin) m *= T.finMul;
  const n = arStrike(S, F, B, m, { sure, back, heavy, fin, src });
  if (n >= 0) {
    F.cmbN = fin ? 0 : F.cmbN + 1; F.cmbT = now;
    if (fin && !B.dead) arFinisher(S, F, B);
  }
  return n;
}
function arFinisher(S, F, B) {
  const e = ARENA_TUNE.fin[F.cls];
  arEv(S, { k: 'fin', i: F.i });
  // эффект добивания — не чаще раза в 6 с (иначе ближник держит соперника в статусе постоянно)
  if (!e || F.finT > S.T) return;
  F.finT = S.T + ARENA_TUNE.finCd;
  if (e[0] === 'drain') { arRes(B, -e[1]); arEv(S, { k: 'drain', i: B.i, n: e[1] }); }
  else arCC(S, F, B, e[0], e[1]);
}
// конец тяжёлого замаха: кто в клине — получает ×1,6; перекатился в клине — «идеальный уворот», бьющий открыт
function arHeavy(S, F) {
  const T = ARENA_TUNE, now = S.T, sw = F.swing, B = S.f[1 - F.i];
  F.swing = null;
  if (B.dead) return;
  const vx = B.x - F.x, vy = B.y - F.y, L = Math.sqrt(vx * vx + vy * vy);
  const inWedge = L <= sw.r + T.fr && (L < 0.5 || (vx * sw.ux + vy * sw.uy) / L >= T.heavyCos);
  const rolledEarly = B.rollAt >= sw.t0 - 0.05;
  if ((inWedge && B.st.inv > now) || (rolledEarly && (inWedge || L <= sw.r + 1.6))) {
    B.sm.perfect++;
    arEv(S, { k: 'perfect', i: B.i, a: F.i });
    arCC(S, B, F, 'open', T.openT);
    return;
  }
  if (!inWedge) { arEv(S, { k: 'whiff', i: F.i }); return; }
  arMelee(S, F, B, T.heavyMul, true);
}

// ---------- Снаряды, зоны, волк ----------
function arShots(S, dt) {
  const T = ARENA_TUNE, now = S.T;
  for (let n = S.shots.length - 1; n >= 0; n--) {
    const p = S.shots[n];
    if (p.delay > 0) { p.delay -= dt; continue; }
    const A = S.f[p.o], B = S.f[p.tg];
    // цель — живой соперник; пропал из виду — снаряд летит в последнюю точку и гаснет
    const tx = B.dead ? p.x : B.x, ty = B.dead ? p.y : B.y;
    const dx = tx - p.x, dy = ty - p.y, L = Math.sqrt(dx * dx + dy * dy), step = p.sp * dt;
    const nx = L > step ? p.x + dx / L * step : tx, ny = L > step ? p.y + dy / L * step : ty;
    if (!arLos(p.x, p.y, nx, ny)) { arEv(S, { k: 'block', x: nx, y: ny, s: p.kind }); S.shots.splice(n, 1); continue; }
    p.x = nx; p.y = ny;
    if (L > step + 0.35 || B.dead) { if (B.dead) S.shots.splice(n, 1); continue; }
    S.shots.splice(n, 1);
    if (B.st.inv > now) { arEv(S, { k: 'dodge', i: B.i }); continue; }
    if (B.st.block > now) { arEv(S, { k: 'shield', i: B.i }); continue; }
    if (p.auto) {
      // выстрел с руки: комбо считается и у стрелков
      if (!(A.cmbT > now - T.comboT)) A.cmbN = 0;
      const fin = A.cmbN + 1 >= T.comboN;
      const r = arStrike(S, A, B, p.mul * (fin ? T.finMul : 1), { sure: !!p.sure, fin, src: p.nk || p.kind });
      if (r >= 0) { A.cmbN = fin ? 0 : A.cmbN + 1; A.cmbT = now; if (fin && !B.dead) arFinisher(S, A, B); }
    } else {
      const r = arStrike(S, A, B, p.mul, { sure: !!p.sure, src: p.kind });
      if (r >= 0 && p.fx && !B.dead) {
        if (p.fx.burn) arCC(S, A, B, 'burn', p.fx.burn);
        if (p.fx.ice) arCC(S, A, B, 'ice', p.fx.ice);
      }
    }
  }
}
function arZones(S, dt) {
  const T = ARENA_TUNE, now = S.T;
  for (let n = S.zones.length - 1; n >= 0; n--) {
    const z = S.zones[n], own = S.f[z.o], B = S.f[1 - z.o], a = T.ab;
    if (now > z.t1 || own.dead && z.k !== 'trap') { S.zones.splice(n, 1); continue; }
    const inB = !B.dead && arD2(B.x, B.y, z.x, z.y) <= z.r * z.r, inA = arD2(own.x, own.y, z.x, z.y) <= z.r * z.r;
    if (z.k === 'trap') {
      if (inB && !(B.st.inv > now)) {
        arEv(S, { k: 'trap', i: B.i, x: z.x, y: z.y });
        arCC(S, own, B, 'root', a.trap.root); arCC(S, own, B, 'open', a.trap.open);
        S.zones.splice(n, 1);
      }
    } else if (z.k === 'roots') {
      if (inB) arCC(S, own, B, 'slow', 0.35, { pct: a.grow.slow });
    } else if (z.k === 'holy' || z.k === 'sun') {
      if (z.fol) { z.x = own.x; z.y = own.y; }
      const A = z.k === 'holy' ? a.consecrate : a.ult_paladin;
      if (inB) { arHurt(S, own, B, B.mhp * A.dot / 100 * dt, 'zone'); if (A.slow) arCC(S, own, B, 'slow', 0.35, { pct: A.slow }); }
      if (A.regen && (inA || z.fol)) { const h = Math.min(own.mhp - own.hp, own.mhp * A.regen / 100 * dt * arHealMul(S)); own.hp += h; own.sm.heal += h; }
    } else if (z.k === 'grove') {
      if (inA) { const h = Math.min(own.mhp - own.hp, own.mhp * a.ult_druid.regen / 100 * dt * arHealMul(S)); own.hp += h; own.sm.heal += h; }
      if (now >= z.nt) { z.nt += a.ult_druid.every; if (inB) arCC(S, own, B, 'root', a.ult_druid.root, { force: 1 }); }
    } else if (z.k === 'rain') {
      // стрелы падают по одной; каждая — по зоне целиком
      const A = a.ult_archer;
      while (now >= z.nt && z.n < A.n) {
        z.n++; z.nt += A.dur / A.n;
        const ox = (arRnd(S) - 0.5) * z.r * 1.4, oy = (arRnd(S) - 0.5) * z.r * 1.4;
        arEv(S, { k: 'arrowfall', x: z.x + ox, y: z.y + oy });
        if (inB) { if (B.st.inv > now) arEv(S, { k: 'dodge', i: B.i }); else arStrike(S, own, B, A.mul, { sure: 1, src: 'rain' }); }
      }
    } else if (z.k === 'meteor') {
      // зона идёт за соперником с отставанием: центр — где он был 0,6 с назад
      const A = a.ult_mage;
      if (!B.dead) z.hist.push([now, B.x, B.y]);
      while (z.hist.length > 1 && z.hist[1][0] <= now - A.lag) z.hist.shift();
      z.x = z.hist[0][1]; z.y = z.hist[0][2];
      if (now >= z.nt && now < z.t1 - A.fall) {
        z.nt += A.every;
        z.marks.push({ x: arClamp(z.x + (arRnd(S) - 0.5) * 2 * A.spread, 0.5, 13.5), y: arClamp(z.y + (arRnd(S) - 0.5) * 2 * A.spread, 0.5, 13.5), t: now + A.fall });
      }
      for (let m = z.marks.length - 1; m >= 0; m--) {
        const M = z.marks[m];
        if (now < M.t) continue;
        z.marks.splice(m, 1);
        arEv(S, { k: 'meteor', x: M.x, y: M.y });
        if (!B.dead && arD2(B.x, B.y, M.x, M.y) <= A.hitR * A.hitR) { if (B.st.inv > now) arEv(S, { k: 'dodge', i: B.i }); else arStrike(S, own, B, A.mul, { sure: 1, src: 'meteor' }); }
      }
    }
  }
}
function arPets(S, dt) {
  const A = ARENA_TUNE.ab.beast, now = S.T;
  for (let n = S.pets.length - 1; n >= 0; n--) {
    const p = S.pets[n], own = S.f[p.o], B = S.f[1 - p.o];
    if (now > p.t1 || p.hp <= 0 || own.dead) { arEv(S, { k: 'petgone', i: p.o, x: p.x, y: p.y, dead: p.hp <= 0 ? 1 : 0 }); S.pets.splice(n, 1); continue; }
    const see = !B.dead && arVisible(S, B);
    const tx = see ? B.x - Math.sign(B.x - own.x || 1) * 0.7 : own.x - own.dx * 0.9, ty = see ? B.y + 0.1 : own.y + 0.3;
    const dx = tx - p.x, dy = ty - p.y, L = Math.sqrt(dx * dx + dy * dy), st = A.sp * dt;
    if (L > 0.05) { p.x += dx / L * Math.min(L, st); p.y += dy / L * Math.min(L, st); p.face = dx > 0 ? 1 : -1; p.run = now; }
    if (see && now >= p.bite && arD2(p.x, p.y, B.x, B.y) < 1.3 * 1.3) {
      p.bite = now + A.every; p.bt = now;
      arStrike(S, own, B, A.mul, { src: 'beast' });
    }
  }
}

// ---------- Такт бойца ----------
function arFighterTick(S, F, inp, dt) {
  const T = ARENA_TUNE, now = S.T, st = F.st, R = T.res[F.rk];
  // ресурс
  if (F.rk === 'rage') { if (now - F.combat > R.calm) arRes(F, -R.decay * dt); }
  else arRes(F, R.regen * F.pas.res * dt);
  // здоровье: пассивки и «лечащие» усиления (%/с)
  const rg = F.pas.hpr + arStat(S, F, 'regen');
  if (rg > 0 && !F.dead) { const h = Math.min(F.mhp - F.hp, F.mhp * rg / 100 * dt * arHealMul(S)); F.hp += h; F.sm.heal += h; }
  // горение и кровь — с потолком на эффект
  for (const s of ['burn', 'bleed']) {
    if (!(st[s] > now) || st[s + 'B'] <= 0) continue;
    const n = Math.min(st[s + 'B'], F.mhp * T.dotPct * dt);
    st[s + 'B'] -= n;
    const src = st[s + 'S'] >= 0 ? S.f[st[s + 'S']] : null;
    arHurt(S, src, F, n, 'dot');
  }
  // песок горит за кругом овертайма
  if (S.ring < T.R && arD2(F.x, F.y, T.cx, T.cy) > S.ring * S.ring) arHurt(S, null, F, F.mhp * T.otDmg * dt, 'zone', { src: 'ring' });
  if (F.dead) return;
  // танец теней плута: три удара из-за спины
  if (F.dance) {
    const B = S.f[1 - F.i];
    if (B.dead) { F.dance = null; }
    else if (now >= F.dance.next) {
      const a = T.ab.ult_rogue;
      const sp = arSpotNear(S, F, B.x, B.y, -B.dx, -B.dy);
      if (sp) { F.x = sp[0]; F.y = sp[1]; }
      F.dx = B.x - F.x; F.dy = B.y - F.y; const L = Math.sqrt(F.dx * F.dx + F.dy * F.dy) || 1; F.dx /= L; F.dy /= L; F.face = F.dx >= 0 ? 1 : -1;
      arEv(S, { k: 'blink', i: F.i, x: F.x, y: F.y });
      F.anim = { k: 'atk', t: now };
      arStrike(S, F, B, a.mul, { sure: 1, src: 'ult_rogue', back: 1 });
      F.dance.n--; F.dance.next = now + a.every;
      if (F.dance.n <= 0) F.dance = null;
    }
    return;
  }
  const hard = arHard(S, F);
  // перекат: 0,45 с неуязвим, 1,5 клетки в сторону ввода (или вбок от соперника)
  if (inp.roll && !hard && !F.roll && !F.swing && F.rollCd <= now && !(st.root > now)) {
    let ux = inp.mx, uy = inp.my, L = Math.sqrt(ux * ux + uy * uy);
    if (L < 0.2) { const O = S.f[1 - F.i]; ux = -(O.y - F.y); uy = O.x - F.x; L = Math.sqrt(ux * ux + uy * uy) || 1; }
    F.roll = { t0: now, dx: ux / L, dy: uy / L };
    F.rollCd = now + T.rollCd; F.rollAt = now;
    st.inv = Math.max(st.inv, now + T.rollT);
    arEv(S, { k: 'roll', i: F.i });
  }
  // способность
  if (inp.cast >= 0 && !hard) arCast(S, F, inp.cast, inp);
  // движение
  const ox = F.x, oy = F.y;
  if (F.roll) {
    if (F.roll.leap || now - F.roll.t0 >= T.rollMove) { if (now - F.roll.t0 >= (F.roll.leap ? 0.25 : T.rollT)) F.roll = null; }
    else arMove(S, F, F.roll.dx * T.rollDist / T.rollMove * dt, F.roll.dy * T.rollDist / T.rollMove * dt);
  } else if (!hard && !(st.root > now) && !F.swing && F.lock <= 0) {
    let mx = inp.mx, my = inp.my;
    if (mx || my) {
      const v = T.spd * T.cls[F.cls].mv * (1 + arStat(S, F, 'mv')) * (st.slow > now ? st.slowV : 1);
      arMove(S, F, mx * v * dt, my * v * dt);
    }
  }
  F.lock -= dt;
  F.vx = (F.x - ox) / dt; F.vy = (F.y - oy) / dt;
  F.mx = inp.mx; F.my = inp.my;
  // взгляд: на ходу — куда идёт, стоя — на соперника
  const O = S.f[1 - F.i];
  const mv = Math.sqrt(F.vx * F.vx + F.vy * F.vy);
  if (F.swing) { F.dx = F.swing.ux; F.dy = F.swing.uy; }
  else if (mv > 0.5) { F.dx = F.vx / mv; F.dy = F.vy / mv; }
  else if (!O.dead) { const dx = O.x - F.x, dy = O.y - F.y, L = Math.sqrt(dx * dx + dy * dy) || 1; F.dx = dx / L; F.dy = dy / L; }
  const fx = !O.dead && arVisible(S, O) && mv < 0.5 ? O.x - F.x : F.dx;
  if (Math.abs(fx) > 0.05) F.face = fx > 0 ? 1 : -1;
  // удары с руки
  if (!hard) arAuto(S, F, dt);
}

// ---------- Раунд и матч ----------
function arRoundOver(S, w, why) {
  const T = ARENA_TUNE;
  S.score[w]++;
  S.rw.push({ w, why, t: Math.round(S.t * 10) / 10, hp: S.f.map(F => Math.round(F.hp / F.mhp * 100)) });
  S.f[w].wins++;
  S.phase = 'end'; S.phT = T.endT; S.lastW = w;
  arEv(S, { k: 'round', w, why, score: S.score.slice() });
  if (S.score[w] >= T.wins) { S.winner = w; arEv(S, { k: 'won', w }); }
}
function arCheckRound(S) {
  const T = ARENA_TUNE, [a, b] = S.f;
  if (a.dead || b.dead) {
    if (a.dead && b.dead) arRoundOver(S, a.rs.dmg >= b.rs.dmg ? 0 : 1, 'ko');
    else arRoundOver(S, a.dead ? 1 : 0, 'ko');
    return;
  }
  if (S.t >= T.roundT) {
    // таймер: больший % здоровья, затем — кто больше нанёс
    const pa = a.hp / a.mhp, pb = b.hp / b.mhp;
    const w = Math.abs(pa - pb) > 1e-9 ? (pa > pb ? 0 : 1) : Math.abs(a.rs.dmg - b.rs.dmg) > 1e-9 ? (a.rs.dmg > b.rs.dmg ? 0 : 1) : (arRnd(S) < 0.5 ? 0 : 1);
    arRoundOver(S, w, 'time');
  }
}
function arNewRound(S) {
  S.round++; S.t = 0; S.ring = ARENA_TUNE.R; S.ot = 0;
  S.shots = []; S.zones = []; S.pets = [];
  for (const F of S.f) arRoundReset(S, F);
  for (const B of S.bots) if (B) { B.rollAt = -1; B.sw = -1; B.seen = null; B.lastSeen = null; B.cast = -1; arBotForm(B); }
}
function arenaSurrender(S, i) {
  if (S.phase === 'over' || !(i === 0 || i === 1)) return false;
  S.sur = i; S.winner = 1 - i; S.phase = 'over';
  arEv(S, { k: 'surrender', i });
  arEv(S, { k: 'won', w: 1 - i, sur: 1 });
  return true;
}

// Один такт 50 мс. ins — [вход бойца 0, вход бойца 1] (null — стоит); у ботов вход считается здесь же
function arenaStep(S, ins) {
  const T = ARENA_TUNE, dt = T.dt;
  S.ev = [];
  S.tick++; S.T = Math.round(S.tick * dt * 1000) / 1000;
  const inp = [0, 1].map(i => (S.bots[i] ? arenaBotInput(S, i) : arenaInput(ins && ins[i])));
  if (S.phase === 'over') return S;
  if (S.phase !== 'fight') {
    S.phT -= dt;
    if (S.phase === 'count') {
      const n = Math.ceil(S.phT);
      if (n < S.cnt && n > 0) { S.cnt = n; arEv(S, { k: 'count', n }); }
      if (S.phT <= 0) { S.phase = 'fight'; S.t = 0; arEv(S, { k: 'go', round: S.round }); }
    } else if (S.phase === 'end' && S.phT <= 0) {
      if (S.winner >= 0) { S.phase = 'over'; arEv(S, { k: 'over', w: S.winner }); }
      else { S.phase = 'rest'; S.phT = T.restT; arNewRound(S); arEv(S, { k: 'rest', round: S.round }); }
    } else if (S.phase === 'rest' && S.phT <= 0) { S.phase = 'count'; S.phT = T.countT; S.cnt = 3; arEv(S, { k: 'count', n: 3 }); }
    return S;
  }
  S.t = Math.round((S.t + dt) * 1000) / 1000;
  // овертайм: с 60-й секунды борт сужается на 0,5 клетки каждые 5 с
  if (S.t >= T.otT) {
    const k = 1 + Math.floor((S.t - T.otT) / T.otEvery), r = Math.max(T.otMin, T.R - T.otStep * k);
    if (!S.ot) { S.ot = 1; arEv(S, { k: 'ot' }); }
    if (r < S.ring) { S.ring = r; arEv(S, { k: 'shrink', r }); }
  }
  // очерёдность бойцов меняется каждый такт: никто не бьёт «первым» всегда
  const ord = S.tick & 1 ? [1, 0] : [0, 1];
  for (const i of ord) arFighterTick(S, S.f[i], inp[i], dt);
  arShots(S, dt);
  arZones(S, dt);
  arPets(S, dt);
  arCheckRound(S);
  return S;
}

// ---------- Снапшот, хэш ----------
function arenaSnap(S) { return JSON.parse(JSON.stringify(S)); }
function arenaHash(S) {
  const s = JSON.stringify([S.tick, S.rs, S.phase, S.round, S.score, S.winner, S.f.map(F => [F.x, F.y, F.hp, F.res, F.ult, F.st, F.cd, F.buf]), S.shots, S.zones, S.pets, S.bots]);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

// ---------- Бот-дуэлянт (6.6): те же входы, что у игрока, с задержкой реакции ----------
// роль способности для бота
const ARENA_BOT_ROLE = {
  bash: 'cc', cry: 'buff', surge: 'buff', wall: 'def', ult_warrior: 'ult',
  rage: 'buff', reckless: 'buff', stomp: 'cc', roar: 'hit', ult_barbarian: 'ult',
  aimed: 'hit', volley: 'hit', trap: 'trap', leap: 'flee', ult_archer: 'ult',
  sneak: 'hit', trip: 'cc', steal: 'steal', vanish: 'def', ult_rogue: 'ult',
  fire: 'hit', ward: 'ward', frost: 'cc', shield: 'def', ult_mage: 'ult',
  thorns: 'cc', grow: 'zone', mend: 'heal', beast: 'buff', wild: 'buff', ult_druid: 'ult',
  heal: 'heal', cure: 'cleanse', bless: 'buff', turn: 'cc', ult_priest: 'ultheal',
  hands: 'heal', smite: 'hit', consecrate: 'zone', faith: 'def', ult_paladin: 'ult',
  inspire: 'buff', chord: 'cc', five: 'heal2', sour: 'steal', ult_bard: 'ult',
  flurry: 'buff', palm: 'hit', patience: 'def', windstep: 'gap', ult_monk: 'ult',
};
// «форма» бота на раунд: живой игрок тоже то собран, то рассеян — реакция, перекаты, дистанция, напор, разброс решений
function arBotForm(B) {
  const r = () => arRnd(B);
  B.fm = { r: 0.75 + 0.6 * r(), rl: (r() - 0.5) * 0.3, k: (r() - 0.5) * 2, n: r(), ag: r(), th: 0.8 + 0.5 * r() };
}
// удобная дистанция: стрелки держат свою, ближники — вплотную
function arBotRange(S, F) { const C = ARENA_TUNE.cls[F.cls]; return C.shot ? Math.min(C.rng + F.pas.rng - 1, 5.5) : C.rng * 0.75; }

function arenaBotInput(S, i) {
  const B = S.bots[i], P = ARENA_TUNE.bot[B.tier], T = ARENA_TUNE, F = S.f[i], O = S.f[1 - i], now = S.T;
  const out = { mx: 0, my: 0, cast: -1, roll: 0, aim: null };
  if (S.phase !== 'fight' || F.dead) { B.mx = B.my = 0; return out; }
  // что бот видит: соперника (невидимку — нет), с задержкой реакции
  const vis = !O.dead && arVisible(S, O);
  if (vis) { B.lastSeen = [O.x, O.y, now]; }
  // тяжёлый замах соперника — заметить через react и, может быть, перекатиться
  const fm = B.fm;
  if (O.swing && O.swing.t0 !== B.sw) { B.sw = O.swing.t0; B.swRoll = arRnd(B) < P.roll + (P.roll ? fm.rl : 0); if (B.swRoll) B.rollAt = O.swing.t0 + P.react * fm.r * (0.8 + 0.4 * arRnd(B)); }
  if (B.rollAt > 0 && now >= B.rollAt) {
    B.rollAt = -1;
    if (O.swing && F.rollCd <= now) { out.roll = 1; const ux = F.x - O.x, uy = F.y - O.y, L = Math.sqrt(ux * ux + uy * uy) || 1; const s = arRnd(B) < 0.5 ? 1 : -1; out.mx = (-uy / L * s + ux / L * 0.5); out.my = (ux / L * s + uy / L * 0.5); return out; }
  }
  // летящий опасный снаряд: чемпион иногда перекатывается
  if (P.dodgeShot && F.rollCd <= now) for (const p of S.shots) {
    if (p.tg !== i || p.delay > 0 || p.auto && !p.sure) continue;
    const d = Math.sqrt(arD2(p.x, p.y, F.x, F.y));
    if (d < 2.2 && d > 0.6 && p.seen !== B.tier) { p.seen = B.tier; if (arRnd(B) < P.dodgeShot) { out.roll = 1; out.mx = -F.dy; out.my = F.dx; return out; } }
  }
  if (now < B.think) { out.mx = B.mx; out.my = B.my; out.cast = -1; return out; }
  B.think = now + P.think * fm.th * (0.8 + 0.4 * arRnd(B));
  // ---- куда идти ----
  let tx = T.cx, ty = T.cy, want = 0;
  const tgt = vis ? O : null;
  const dist = tgt ? arDist(F, O) : 99;
  const C = T.cls[F.cls], ranged = !!C.shot;
  if (tgt) {
    const keep = arBotRange(S, F) + (C.shot ? fm.k : 0);
    const ux = (F.x - O.x) / (dist || 1), uy = (F.y - O.y) / (dist || 1);
    if (ranged && P.kite && dist < keep - 1.2 && arRnd(B) > fm.ag * 0.5) { tx = F.x + ux * 2; ty = F.y + uy * 2; want = 1; }
    else if (dist > keep || (ranged && !arLos(F.x, F.y, O.x, O.y))) { const ld = ranged ? 0 : P.lead * Math.min(1, dist / 4); tx = O.x + O.vx * ld; ty = O.y + O.vy * ld; want = 1; }
    else if (!ranged && dist > C.rng) { tx = O.x + O.vx * P.lead * 0.5; ty = O.y + O.vy * P.lead * 0.5; want = 1; }
    else if (ranged && P.kite) { tx = F.x - uy * 1.5; ty = F.y + ux * 1.5; want = 0.6; }
  } else if (B.lastSeen && now - B.lastSeen[2] < 3) { tx = B.lastSeen[0] + (arRnd(B) - 0.5) * 3; ty = B.lastSeen[1] + (arRnd(B) - 0.5) * 3; want = 0.8; }
  else { tx = T.cx + (arRnd(B) - 0.5) * 6; ty = T.cy + (arRnd(B) - 0.5) * 6; want = 0.7; }
  // опасные зоны и горящий край — уходить (умелые боты)
  let ax = 0, ay = 0;
  if (P.zone) {
    for (const z of S.zones) {
      if (z.o === i) continue;
      const bad = z.k === 'holy' || z.k === 'sun' || z.k === 'rain' || z.k === 'meteor' || z.k === 'grove' || z.k === 'roots' || z.k === 'trap';
      if (!bad) continue;
      const rr = z.k === 'trap' ? 1.1 : z.r + 0.6, d2 = arD2(F.x, F.y, z.x, z.y);
      if (d2 < rr * rr) { const d = Math.sqrt(d2) || 0.01; ax += (F.x - z.x) / d * 2; ay += (F.y - z.y) / d * 2; }
    }
  }
  const dc = Math.sqrt(arD2(F.x, F.y, T.cx, T.cy));
  if (dc > S.ring - 1.2) { ax += (T.cx - F.x) / (dc || 1) * 3; ay += (T.cy - F.y) / (dc || 1) * 3; }
  else if (dc > T.R - 1.4) { ax += (T.cx - F.x) / (dc || 1) * 0.8; ay += (T.cy - F.y) / (dc || 1) * 0.8; }   // не зажиматься у борта
  if (want) [tx, ty] = arSteer(S, F, tx, ty);
  let mx = (tx - F.x) * want + ax, my = (ty - F.y) * want + ay;
  const L = Math.sqrt(mx * mx + my * my);
  if (L > 0.15) { mx /= L; my /= L; } else { mx = 0; my = 0; }
  // неумелый ходит рывками и не держит линию
  if (P.aim < 1) { mx += (arRnd(B) - 0.5) * (1 - P.aim); my += (arRnd(B) - 0.5) * (1 - P.aim); }
  out.mx = B.mx = mx; out.my = B.my = my;
  // ---- способности ----
  out.cast = arBotCast(S, i, B, P, dist, vis);
  if (out.cast >= 0 && ARENA_KIT[F.cls][out.cast] === 'ult_archer' && vis) out.aim = [O.x + O.vx * 0.5 * P.aim, O.y + O.vy * 0.5 * P.aim];
  return out;
}
function arBotCast(S, i, B, P, dist, vis) {
  const T = ARENA_TUNE, F = S.f[i], O = S.f[1 - i], now = S.T, kit = ARENA_KIT[F.cls];
  const hp = F.hp / F.mhp, ohp = O.hp / O.mhp, C = T.cls[F.cls];
  const reach = C.rng + F.pas.rng;
  const threat = O.swing || O.anim && O.anim.k === 'atk' && now - O.anim.t < 0.6 || dist < 2.2;
  const oUlt = O.buf && Object.keys(O.buf).some(k => k.startsWith('ult_') && O.buf[k] > now) || O.dance;
  const opts = [];
  for (let s = 0; s < 6; s++) {
    const k = kit[s], a = T.ab[k];
    if (a.pas || arCanCast(S, F, s)) continue;
    const role = ARENA_BOT_ROLE[k] || 'hit';
    const r = a.r != null ? a.r : (role === 'hit' || role === 'gap' ? reach : 0);
    let score = 0;
    // экономный бот держит запас на лечение и контроль
    const reserve = P.save && role !== 'heal' && role !== 'cc' && role !== 'ult' ? 25 : 0;
    if (!a.ult && F.res - a.cost < reserve) continue;
    switch (role) {
      case 'heal': score = hp < (P.save ? 0.55 : 0.7) ? 9 : hp < 0.85 && B.tier === 1 ? 3 : 0; break;
      case 'heal2': score = hp < 0.9 ? 4 : 0; break;
      case 'ultheal': score = hp < 0.4 || hp < 0.6 && ohp > 0.7 ? 10 : 0; break;
      case 'cc':
        if (!vis || dist > r + 0.1) break;
        if (P.save) score = (O.swing ? 9 : 0) + (oUlt ? 8 : 0) + (ohp < 0.35 ? 5 : 0) + (dist < 2.5 && hp < 0.5 ? 4 : 0) + (O.st.stunImm > now ? -20 : 2);
        else score = 5;
        break;
      case 'hit': if (vis && dist <= (r || reach) + 0.1) score = 4; break;
      case 'buff': if (vis && dist <= Math.max(reach, 2.5) + 1) score = 3 + (hp < 0.6 ? 1 : 0); break;
      case 'def': if (vis && (threat || oUlt) && (hp < 0.75 || oUlt)) score = 6 + (oUlt ? 3 : 0); break;
      case 'ult': if (vis && dist <= Math.max(a.r || 0, a.zr || 0, reach, 3) + 0.5) score = 7 + (ohp < 0.5 ? 2 : 0); break;
      case 'zone': if (vis && dist <= (a.zr || 3) - 0.3) score = 5; break;
      case 'trap': if (vis && dist < 4 && dist > 1.2) score = 4; break;
      case 'flee': if (vis && dist < 1.8 && C.shot) score = 6; break;
      case 'gap': if (vis && dist > 2.4 && dist < 4.6) score = 5; break;
      case 'steal': if (vis && dist <= r && (O.res >= 30 || O.ult >= 50)) score = 4; break;
      case 'ward': if (vis && dist < 7 && !(F.st.ward > now) && hp < 0.95) score = 3; break;
      case 'cleanse': if (F.st.root > now || F.st.slow > now || F.st.burn > now || F.st.bleed > now || F.st.sil > now) score = 6; break;
    }
    if (score > 0) opts.push([score + arRnd(B) * (B.tier === 1 ? 6 : 1.5 + 3 * B.fm.n), s]);
  }
  if (!opts.length) return -1;
  // соломенный жмёт что попало и не всегда
  if (B.tier === 1 && arRnd(B) < 0.5) return -1;
  opts.sort((x, y) => y[0] - x[0]);
  return opts[0][1];
}

// для Node (сервер арены, тесты, прогон баланса)
if (typeof module !== 'undefined' && module.exports) module.exports = { ARENA_PROTO, ARENA_TUNE, ARENA_KIT, ARENA_CLS, ARENA_TXT, ARENA_BOT_ROLE, arenaNew, arenaStep, arenaInput, arenaSurrender, arenaSnap, arenaHash, arenaBotInput, arCanCast, arCdLeft };
