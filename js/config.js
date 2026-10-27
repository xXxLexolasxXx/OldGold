'use strict';
// Общие константы и описания игровых сущностей.

const TILE = 32;          // размер клетки в пикселях мира
// Размер карты меняется: новая игра — большая карта, старые сохранения (и мир кооп-сервера) остаются 96×72.
// Холст рельефа нарезан на полосы (см. terrain.js), поэтому размер ограничен лишь памятью: 160×120 ≈ 80 МБ земли.
const MAP_LEGACY_W = 96, MAP_LEGACY_H = 72;
const MAP_NEW_W = 160, MAP_NEW_H = 120;
let MAP_W = MAP_NEW_W;
let MAP_H = MAP_NEW_H;
// Радиусы большого костра (клетки): нечисть и скелеты не заходят в BONFIRE_SAFE, свет ночью покрывает ту же зону, а у самого костра — тепло и точка возрождения героев
const BONFIRE_SAFE = 8, BONFIRE_NOSPAWN = 12, BONFIRE_LIGHT = BONFIRE_SAFE * 30, BONFIRE_HERO = 5;
const SIM_DT = 0.05;      // шаг симуляции, сек

const T_GRASS = 0, T_WATER = 1, T_ROCK = 2, T_SAND = 3;

// Длина каждого сезона (лето, осень, зима, весна) в игровых сутках — единственный источник: сезоны (world/season.js), события-дилеммы, подписи.
const SEASON_DAYS = 8;
// Дрова зимой (season.js): здание с печью раз в WINTER_BURN_EVERY секунд берёт бревно с ближайшего склада; нет дров — здание мёрзнет
const WINTER_BURN_EVERY = 420;
const WINTER_HEATED = ['house', 'inn', 'bakery', 'weaponsmith', 'armory', 'infirmary', 'school'];
const WINTER_INSULATION = [1, 1.5, 2];   // дом уровня 1/2/3 держит тепло дольше — топится реже
const WINTER_COLD_WORK = 1.3;            // в нетопленой мастерской работа идёт на треть дольше
const WINTER_COLD_SLEEP = 0.4;           // в нетопленом доме сон восстанавливает 0,4 от нормы

const FOOD_TIME = 720;    // за сколько секунд житель проголодается полностью (12 минут)
const HUNGRY = 0.3;       // ниже этого уровня сытости идёт в трактир
const TRAIN_TIME = 12;    // время обучения в школе

const GOODS = {
  trunk:      { name: 'Брёвна',          color: '#7a4a22', group: 'Стройка' },
  timber:     { name: 'Доски',           color: '#d8a45a', group: 'Стройка' },
  stone:      { name: 'Камень',          color: '#a3a3a3', group: 'Стройка' },
  wheat:      { name: 'Зерно',           color: '#e6c24a', group: 'Еда' },
  hay:        { name: 'Сено',            color: '#b8b860', group: 'Еда' },
  hops:       { name: 'Хмель',           color: '#8ab048', group: 'Еда' },
  beer:       { name: 'Пиво',            color: '#d8a030', group: 'Еда' },
  flour:      { name: 'Мука',            color: '#f4f0e2', group: 'Еда' },
  bread:      { name: 'Хлеб',            color: '#b8742c', group: 'Еда' },
  pig:        { name: 'Свиньи',          color: '#e8a0a0', group: 'Еда' },
  sausage:    { name: 'Колбаса',         color: '#a83a2a', group: 'Еда' },
  goldore:    { name: 'Золотая руда',    color: '#b89a3c', group: 'Ценности' },
  gold:       { name: 'Золото',          color: '#ffd700', group: 'Ценности' },
  hide:       { name: 'Шкуры',           color: '#b07850', group: 'Ремесло' },
  leather:    { name: 'Кожа',            color: '#8a5030', group: 'Ремесло' },
  leatherArmor: { name: 'Кожаный доспех', color: '#7a4a2a', group: 'Снаряжение' },
  magicstone: { name: 'Магические камни', color: '#a060f0', group: 'Магия' },
  mana:       { name: 'Банки маны',      color: '#40a0ff', group: 'Магия' },
  staff:      { name: 'Посохи',          color: '#8a6aff', group: 'Снаряжение' },
  mageArmor:  { name: 'Мантии мага',     color: '#5040a0', group: 'Снаряжение' },
  ironore:    { name: 'Железная руда',   color: '#8a6a5a', group: 'Металл' },
  iron:       { name: 'Железные слитки', color: '#9aa0aa', group: 'Металл' },
  sword:      { name: 'Мечи',            color: '#c8ccd4', group: 'Снаряжение' },
  bow:        { name: 'Луки',            color: '#a87040', group: 'Снаряжение' },
  dagger:     { name: 'Кинжалы',         color: '#8a8a9a', group: 'Снаряжение' },
  ironArmor:  { name: 'Железный доспех', color: '#7a8090', group: 'Снаряжение' },
  trash:      { name: 'Мусор',           color: '#7a6a50', group: 'Хозяйство', noStore: true },
  ash:        { name: 'Пепел',           color: '#9e958a', group: 'Хозяйство' },
  chicken:    { name: 'Курица (тушка)',  color: '#f0c8a0', group: 'Еда' },
  chickenleg: { name: 'Куски курицы',    color: '#c8803a', group: 'Еда', noStore: true },
  croissant:  { name: 'Круассаны',      color: '#d89a3c', group: 'Еда' },
  steak:      { name: 'Стейки',         color: '#a84a32', group: 'Еда' },
  darkbeer:   { name: 'Тёмное пиво',    color: '#5a3418', group: 'Еда' },
  fish:       { name: 'Рыба',           color: '#8ab0c4', group: 'Еда' },              // рыбацкая хижина, крабы (МОРЕ.md)
  pearl:      { name: 'Жемчуг',         color: '#e8e4f0', group: 'Ценности' },         // ракушки, кракен, рыбаки
};
const GOOD_KEYS = Object.keys(GOODS);
const GOOD_GROUPS = ['Стройка', 'Еда', 'Ценности', 'Ремесло', 'Металл', 'Магия', 'Снаряжение', 'Хозяйство'];
const FOODS = ['chickenleg', 'steak', 'croissant', 'sausage', 'fish', 'bread'];   // что едят в трактире (по порядку предпочтения)

const UNIT_TYPES = {
  serf:       { name: 'Трудяга',   shirt: '#8a5a3a' },
  builder:    { name: 'Работяга',  shirt: '#b0884a' },
  woodcutter: { name: 'Лесничий',  shirt: '#4a6e33' },
  carpenter:  { name: 'Плотник',   shirt: '#a8662e', noTrain: true, legacy: 'woodcutter' },
  stonemason: { name: 'Каменотёс', shirt: '#6d6d72' },
  farmer:     { name: 'Пахарь',    shirt: '#c9a83a' },       // пшеница и хмель
  miller:     { name: 'Мельник',   shirt: '#d8d4c8', noTrain: true, legacy: 'baker' },
  baker:      { name: 'Пекарь-мельник', shirt: '#e8e2d4' },
  miner:      { name: 'Шахтёр',    shirt: '#5a5048' },
  smelter:    { name: 'Кузнец',    shirt: '#7a2e22' },
  breeder:    { name: 'Свинопас-кожевник', shirt: '#6a7a3a', noTrain: true, legacy: 'herder' },
  butcher:    { name: 'Мясник',    shirt: '#b84a3a' },
  tanner:     { name: 'Бронник',   shirt: '#7a5a3a', noTrain: true, legacy: 'smelter' },
  armorer:    { name: 'Бронник',   shirt: '#4a4a5a', noTrain: true, legacy: 'smelter' },
  enchanter:  { name: 'Чародей',   shirt: '#4a3a8a' },
  hopgrower:  { name: 'Хмелевод',  shirt: '#5a8a3a', noTrain: true, legacy: 'farmer' },
  brewer:     { name: 'Пивовар',   shirt: '#9a6a2a' },
  herder:     { name: 'Пастух', shirt: '#7a8a5a' },
  stableman:  { name: 'Конюх',     shirt: '#6a4a3a', noTrain: true, legacy: 'herder' },
  goat:       { name: 'Вьючная коза', shirt: '#d8d0c0', animal: true, noTrain: true },
  carter:     { name: 'Извозчик',  shirt: '#5a5a6a', noTrain: true },
  hero:       { name: 'Герой',     shirt: '#8a1c22', noTrain: true },
  // гильдии: главы гильдий приходят сами, рекрутов набирают из трудяг (js/guilds.js)
  gm_warrior: { name: 'Мастер воинов',   shirt: '#6a6a76', noTrain: true },
  gm_archer:  { name: 'Мастер лучников', shirt: '#3a7a2a', noTrain: true },
  gm_rogue:   { name: 'Атаман',          shirt: '#2e2e3a', noTrain: true },
  gm_mage:    { name: 'Архимаг',         shirt: '#2c4a9a', noTrain: true },
  warrior:    { name: 'Воин',      shirt: '#6a6a76', noTrain: true, recruit: true },
  archer:     { name: 'Лучник',    shirt: '#3a7a2a', noTrain: true, recruit: true },
  rogue:      { name: 'Разбойник', shirt: '#2e2e3a', noTrain: true, recruit: true },
  mage:       { name: 'Маг',       shirt: '#2c4a9a', noTrain: true, recruit: true },
};
const UNIT_KEYS = Object.keys(UNIT_TYPES).filter(k => !UNIT_TYPES[k].noTrain);   // кого учат в школе
const ALL_UNIT_KEYS = Object.keys(UNIT_TYPES);

// inputs / outputs — сколько единиц товара здание держит у себя.
// recipes — что расходуется и что получается за цикл; несколько рецептов
// можно включать и выключать в окне здания.
// auto — здание работает без рабочего.
// w, h — фундамент в клетках; top — сколько пикселей спрайт поднимается над фундаментом.
const BUILDINGS = {
  storehouse: {
    name: 'Склад', cat: 'Основа', w: 4, h: 3, top: 70, cost: { timber: 6, stone: 6 }, wideDoor: true,
    desc: 'Большой каменный амбар. Хранит все товары, трудяги свозят сюда излишки.',
  },
  school: {
    name: 'Школа', cat: 'Основа', noMenu: true, w: 3, h: 3, top: 96, cost: { timber: 5, stone: 5 }, inputs: { gold: 5 },
    desc: 'Двухэтажная школа с колокольней. Обучает жителей за 1 золото.',
  },
  inn: {
    name: 'Трактир', cat: 'Основа', w: 4, h: 3, top: 86, cost: { timber: 6, stone: 4 }, wideDoor: true, inputs: { bread: 16, sausage: 16, beer: 10, chicken: 4, croissant: 12, steak: 12, darkbeer: 8, fish: 12 },
    desc: 'Голодные жители едят здесь всё, что есть в запасе — курицу, стейк, колбасу, круассаны, хлеб — и запивают пивом. Тушку курицы разделывают на 4 куска. Пьяный может уснуть прямо на дороге.',
  },
  bonfire: {
    name: 'Большой костёр', cat: 'Ресурсы', w: 3, h: 3, top: 78, rots: [0, 3], wideDoor: true, cost: { timber: 4, stone: 2 }, auto: true,
    inputs: { trash: 40 }, outputs: { ash: 6 }, burn: true,
    recipes: [{ in: { trash: 1 }, out: { ash: 1 }, time: 10 }],
    desc: 'Сюда трудяги сносят мусор из урн. Сгорая, он даёт пепел — фермы удобряют им поля, урожай растёт быстрее и богаче.',
  },
  goatpen: {
    name: 'Загон для коз', cat: 'Основа', w: 3, h: 2, top: 50, cost: { timber: 4, stone: 1 }, worker: 'herder',
    desc: 'Пастух приручает диких коз. Ручная коза возит груз по дорогам — по 2 штуки за раз. До 3 коз на загон.',
  },
  stable: {
    name: 'Извозчик', cat: 'Основа', w: 3, h: 2, top: 70, cost: { timber: 5, stone: 3 }, worker: 'herder',
    inputs: { hay: 6, wheat: 4 },
    desc: 'Пастух растит лошадей на сене и зерне. Каждая лошадь с телегой — извозчик: везёт сразу весь стек, до 5 штук. До 3 на конюшню.',
  },
  woodcutter: {
    name: 'Дом лесоруба', cat: 'Ресурсы', w: 2, h: 2, top: 66, cost: { trunk: 2, stone: 1 }, worker: 'woodcutter',
    outputs: { trunk: 5 },
    desc: 'Бревенчатая избушка. Лесничий рубит взрослые деревья и сажает новые.',
  },
  sawmill: {
    name: 'Лесопилка', cat: 'Ресурсы', w: 3, h: 2, top: 58, cost: { trunk: 3, stone: 2 }, worker: 'woodcutter',
    inputs: { trunk: 5 }, outputs: { timber: 6 },
    recipes: [{ in: { trunk: 1 }, out: { timber: 2 }, time: 7 }],
    desc: 'Распиливает брёвна на доски.',
  },
  quarry: {
    name: 'Каменоломня', cat: 'Ресурсы', w: 2, h: 2, top: 50, cost: { trunk: 3 }, worker: 'stonemason',
    outputs: { stone: 5 }, need: 'stone',
    desc: 'Добывает камень. Ставить рядом с каменными глыбами.',
  },
  goldmine: {
    name: 'Золотой рудник', cat: 'Ресурсы', w: 3, h: 2, top: 70, noRotate: true, cost: { timber: 4, stone: 2 }, worker: 'miner',
    outputs: { goldore: 5 }, need: 'rock',
    recipes: [{ in: {}, out: { goldore: 1 }, time: 20 }],
    desc: 'Добывает золотую руду. Ставить вплотную под скалой.',
  },
  metallurgist: {
    name: 'Плавильня', cat: 'Ресурсы', w: 3, h: 2, top: 84, cost: { timber: 3, stone: 4 }, worker: 'smelter',
    inputs: { goldore: 5, trunk: 5 }, outputs: { gold: 6 },
    recipes: [{ in: { goldore: 1, trunk: 1 }, out: { gold: 1 }, time: 10 }],
    desc: 'Плавит руду в золото, сжигая брёвна.',
  },
  ironmine: {
    name: 'Железный рудник', cat: 'Ресурсы', w: 3, h: 2, top: 70, noRotate: true, cost: { timber: 4, stone: 3 }, worker: 'miner',
    outputs: { ironore: 5 }, need: 'rock',
    recipes: [{ in: {}, out: { ironore: 1 }, time: 16 }],
    desc: 'Добывает железную руду. Ставить вплотную под скалой.',
  },
  smeltery: {
    name: 'Плавильня металла', cat: 'Ремесло', w: 3, h: 2, top: 96, cost: { timber: 3, stone: 6 }, worker: 'smelter',
    inputs: { ironore: 6, trunk: 6 }, outputs: { iron: 6 },
    recipes: [{ in: { ironore: 1, trunk: 1 }, out: { iron: 1 }, time: 11 }],
    desc: 'Домница с мехами: из железной руды и брёвен выходят железные слитки для оружия и доспехов.',
  },
  weaponsmith: {
    name: 'Оружейная', cat: 'Ремесло', w: 3, h: 2, top: 78, cost: { timber: 4, stone: 5 }, worker: 'smelter',
    inputs: { iron: 6, timber: 4, leather: 3 }, outputs: { sword: 3, bow: 3, dagger: 3 },
    recipes: [
      { in: { iron: 2, timber: 1 }, out: { sword: 1 }, time: 14 },
      { in: { timber: 2, leather: 1 }, out: { bow: 1 }, time: 12 },
      { in: { iron: 1, leather: 1 }, out: { dagger: 1 }, time: 10 },
    ],
    desc: 'Кузнец-оружейник ковёт мечи и кинжалы, гнёт луки. Герой и рекруты берут оружие здесь.',
  },
  farm: {
    name: 'Ферма', cat: 'Еда', w: 4, h: 3, top: 72, cost: { timber: 5, stone: 3 }, worker: 'farmer',
    inputs: { ash: 4 }, outputs: { wheat: 10, hay: 10 }, crops: ['wheat'],
    desc: 'Фермер сеет и жнёт поля пшеницы, которые вы заложили рядом. Сено — побочный продукт жатвы.',
  },
  hopfarm: {
    name: 'Хмельник', cat: 'Еда', w: 3, h: 2, top: 92, cost: { timber: 4, stone: 2 }, worker: 'farmer',
    inputs: { ash: 3 }, outputs: { hops: 5, hay: 5 }, crops: ['hops'],
    desc: 'Хмелевод растит хмель на шестах вокруг и сушит шишки в башне.',
  },
  brewery: {
    name: 'Пивоварня', cat: 'Еда', w: 3, h: 2, top: 78, cost: { timber: 4, stone: 4 }, worker: 'brewer',
    inputs: { wheat: 5, hops: 5 }, outputs: { beer: 6 },
    recipes: [{ in: { wheat: 1, hops: 1 }, out: { beer: 2 }, time: 12 }],
    desc: 'Варит пиво из зерна и хмеля. Пиво везут в трактир.',
  },
  mill: {
    name: 'Мельница', cat: 'Еда', w: 2, h: 2, top: 118, noRotate: true, cost: { timber: 4, stone: 2 }, worker: 'baker',
    inputs: { wheat: 14 }, outputs: { flour: 12 },
    recipes: [{ in: { wheat: 1 }, out: { flour: 1 }, time: 8 }],
    desc: 'Мелет зерно в муку.',
  },
  bakery: {
    name: 'Пекарня', cat: 'Еда', w: 2, h: 2, top: 66, cost: { timber: 3, stone: 3 }, worker: 'baker',
    inputs: { flour: 12 }, outputs: { bread: 18 },
    recipes: [{ in: { flour: 1 }, out: { bread: 3 }, time: 9 }],
    desc: 'Печёт хлеб из муки.',
  },
  swine: {
    name: 'Свинарник', cat: 'Еда', w: 4, h: 3, top: 56, cost: { timber: 4, stone: 2 }, worker: 'herder',
    inputs: { hay: 10 }, outputs: { pig: 5 },
    desc: 'Каждая охапка сена: свиньи подрастают на треть и появляется поросёнок. Взрослых везут на бойню.',
  },
  butchery: {
    name: 'Бойня', cat: 'Еда', w: 2, h: 2, top: 60, cost: { timber: 3, stone: 3 }, worker: 'butcher',
    inputs: { pig: 6 }, outputs: { sausage: 12, hide: 8 },
    recipes: [{ in: { pig: 1 }, out: { sausage: 3, hide: 1 }, time: 10 }],
    desc: 'Из свиньи — колбаса и шкура.',
  },
  tannery: {
    name: 'Дубильня', cat: 'Ремесло', w: 3, h: 2, top: 56, cost: { timber: 3, stone: 2 }, worker: 'butcher',
    inputs: { hide: 5 }, outputs: { leather: 5 },
    recipes: [{ in: { hide: 1 }, out: { leather: 1 }, time: 9 }],
    desc: 'Выделывает шкуры в кожу.',
  },
  armory: {
    name: 'Мастерская доспехов', cat: 'Ремесло', w: 3, h: 2, top: 66, cost: { timber: 3, stone: 4 }, worker: 'smelter',
    inputs: { leather: 6, iron: 6 }, outputs: { leatherArmor: 3, ironArmor: 2 }, orders: true,
    recipes: [
      { in: { leather: 3 }, out: { leatherArmor: 1 }, time: 26 },
    ],
    desc: 'Шьёт кожаные доспехи — долго и вдумчиво. Железные клепают только в мастерской 2-го уровня. Заказы ставятся в очередь.',
  },
  crystalmine: {
    name: 'Шахта маг. камней', cat: 'Магия', w: 3, h: 2, top: 70, noRotate: true, cost: { timber: 4, stone: 3 }, worker: 'miner',
    outputs: { magicstone: 5 }, need: 'crystal',
    recipes: [{ in: {}, out: { magicstone: 1 }, time: 18 }],
    desc: 'Шахтёр добывает магические камни. Ставить под скалой с кристаллами.',
  },
  magiccircle: {
    name: 'Магический круг', cat: 'Магия', w: 3, h: 3, top: 40, noRotate: true, cost: { stone: 8 }, auto: true,
    inputs: { magicstone: 5 }, outputs: { mana: 6, stone: 5 },
    recipes: [{ in: { magicstone: 1 }, out: { mana: 1, stone: 1 }, time: 12 }],
    desc: 'Камни отдают силу в банки маны и становятся обычными камнями. Работает сам.',
  },
  magicworkshop: {
    name: 'Магическая мастерская', cat: 'Магия', w: 2, h: 2, top: 130, noRotate: true, cost: { timber: 4, stone: 4 }, worker: 'enchanter',
    inputs: { timber: 4, leather: 4, mana: 6 }, outputs: { staff: 4, mageArmor: 4 },
    recipes: [
      { in: { timber: 1, mana: 1 }, out: { staff: 1 }, time: 12 },
      { in: { leather: 1, mana: 2 }, out: { mageArmor: 1 }, time: 16 },
    ],
    desc: 'Чародей создаёт посохи и мантии мага.',
  },
  // Гильдии: глава гильдии приходит сам, учит героя классу и набирает рекрутов из трудяг (js/guilds.js)
  guild_warrior: {
    name: 'Гильдия воинов', cat: 'Гильдии', w: 3, h: 3, top: 104, cost: { timber: 5, stone: 8 }, guild: 'warrior',
    inputs: { gold: 6, sword: 3, ironArmor: 2 },
    desc: 'Каменный зал с башней и тренировочным двором. Мастер воинов учит держать меч и носить железо.',
  },
  guild_archer: {
    name: 'Гильдия лучников', cat: 'Гильдии', w: 3, h: 3, top: 110, cost: { timber: 8, stone: 4 }, guild: 'archer',
    inputs: { gold: 6, bow: 3, leatherArmor: 2 },
    desc: 'Лесная ложа с дозорной вышкой и мишенями. Мастер лучников учит меткости и быстрым ногам.',
  },
  guild_rogue: {
    name: 'Гильдия разбойников', cat: 'Гильдии', w: 3, h: 3, top: 92, cost: { timber: 6, stone: 5 }, guild: 'rogue',
    inputs: { gold: 6, dagger: 3, leatherArmor: 2 },
    desc: 'Кособокий дом с подвалом и глухими окнами. Атаман учит ловкости рук и тому, что плохо лежит.',
  },
  guild_mage: {
    name: 'Гильдия магов', cat: 'Гильдии', w: 3, h: 3, top: 130, noRotate: true, cost: { timber: 4, stone: 8 }, guild: 'mage',
    inputs: { gold: 6, staff: 3, mageArmor: 2, mana: 4 },
    desc: 'Башня со звёздным куполом и библиотекой. Архимаг учит смекалке и заклинаниям.',
  },
};
const BUILD_ORDER = Object.keys(BUILDINGS);
const BUILD_CATS = ['Основа', 'Ресурсы', 'Еда', 'Ремесло', 'Магия', 'Гильдии'];

// Постепенно открывающееся меню строительства. Стадия открывается, когда готово
// всё из `after` (типы зданий), достигнута веха `rank` цели (1 — «Деревня», 2 — «Город») и пережито `night` ночей,
// либо её открывает обучение. Школы в меню нет: она появляется в обучении (noMenu).
// На старте — только дорога и «Ресурсы»: лесоруб, каменоломня, лесопилка, большой костёр. Хмель — только вместе с пивоварней.
const UNLOCKS = [
  { id: 'res',   items: ['woodcutter', 'quarry', 'sawmill', 'bonfire'] },
  { id: 'grain', items: ['farm', 'mill', 'bakery', 'storehouse', 'tool:wheat'], after: ['woodcutter', 'quarry', 'sawmill'] },
  { id: 'hops',  items: ['hopfarm', 'brewery', 'tool:hops'], after: ['bakery'] },
  { id: 'inn2',  items: ['inn'], after: ['brewery'] },   // стартовый трактир уже стоит; второй — когда пошло пиво
  { id: 'pigs',  items: ['swine', 'butchery'], after: ['brewery'] },
  { id: 'base',  items: ['goatpen', 'stable'], after: ['swine'] },
  { id: 'craft', items: ['tannery', 'armory'], after: ['butchery'] },
  { id: 'arms',  items: ['weaponsmith'], after: ['armory'] },   // оружейная — следом за доспехами: лук без железа делается и так
  { id: 'metal', items: ['goldmine', 'metallurgist'], after: ['armory'], rank: 1 },
  { id: 'magic', items: ['crystalmine', 'magiccircle', 'magicworkshop'], after: ['goldmine', 'metallurgist'], rank: 1 },
  { id: 'iron',  items: ['ironmine', 'smeltery'], after: ['metallurgist'], rank: 1 },
  { id: 'guilds', items: ['guild_warrior', 'guild_archer', 'guild_rogue', 'guild_mage'], after: ['weaponsmith'], rank: 1 },
];

const ROAD_STONE = 1;     // сколько камня уходит на клетку дороги
const STORE_CAP = 5;      // сколько курьеров одновременно внутри склада
const ROAD_DIG_HITS = 4;  // взмахов лопатой: корыто под дорогу (бесплатно)
const ROAD_PAVE_HITS = 4; // ударов молотком: укладка булыжника
const SITE_HITS = 3;      // ударов на разметку площадки
const HITS_PER_UNIT = 4;  // ударов молота на единицу материала
const HIT_TIME = 0.6;     // секунд на удар
const FARM_CROPS = ['wheat', 'hay', 'hops'];   // все виды полей
const CARRY_CAP = { serf: 1, goat: 3, carter: 5 };   // сколько единиц за раз

// Жизнь жителей
const SMOKE_TIME = 15, JOIN_SMOKE_TIME = 8;   // длительность перекура и подсевшего
const SMOKE_CD_MIN = 25, SMOKE_CD_MAX = 70;   // перезарядка перекура, сек — курят часто
const JOIN_CD = 30;                           // перезарядка подсаживания к курящему
const JOIN_RADIUS = 10;                       // в клетках: перекур заразен, как чума
const SLEEP_TIME = 60;                        // пьяный сон
const STARVE_FAINT = 25, FAINT_TIME = 15;      // через сколько секунд без еды падает, сколько лежит
const DRUNK_CHANCE = 0.65;                   // шанс захмелеть после кружки
const INJURY_TIME = 150;                      // сколько заживает травма
const COLLIDE_CHANCE = 0.015;                 // базовый шанс уронить груз при столкновении
const INJURY_CHANCE = 0.3;                    // из уронивших груз — доля, когда встречный травмируется (ночь, усталость, хмель — чаще)
const INJURY_GAP = 45;                        // на всю деревню: травма от столкновения не чаще раза в столько секунд

// ---------- Мягкий старт: когда просыпаются системы ----------
// Новичку в первые минуты хватает экономики и первой ночи. Остальные системы открываются по порядку: по суткам,
// по номеру ночи, по зданиям и по вехам цели («Поселение» → «Деревня» → «Город»). Всё настраивается здесь.
//   day   — не раньше N-х суток (1 — с самого начала; сутки ≈ 9,5 игровых минут)
//   night — не раньше N-й ночи (с её вечера)
//   after — должны быть достроены эти здания
//   rank  — веха цели: 1 — «Деревня», 2 — «Город»
// «Спокойный» растягивает сроки (множитель grace в difficulty.js), «Выживание» сжимает. on: false — всё как раньше.
const START_GRACE = {
  on: true,
  sys: {
    dilemma:  { day: 3, after: ['inn'] },     // дилеммы жителей
    festival: { day: 3, after: ['inn'] },     // праздники
    fair:     { day: 3, after: ['inn'] },     // ярмарка
    brawl:    { day: 4, after: ['inn'] },     // драки на празднике
    trade:    { day: 2 },                     // караваны торговцев (поверх торгового поста)
    games:    { day: 2 },                     // карты, ножички, классики, параплан
    raid:     { night: 4, rank: 1 },          // набеги: курган и прочее
    foe:      { night: 4, rank: 1 },          // вылазки врага вне сюжета
    strange:  { night: 3 },                   // странные существа ночи
    mimic:    { day: 3 },                     // сундуки-мимики
    fairy:    { day: 3 },                     // сказочные звери (единорог, дракончик, грифон...)
    fairy2:   { night: 3 },                   // ночная нежить фей: кикимора, банши, волки, огоньки, леший
    neutrals: { day: 2 },                     // нейтралы в лесу не нападают
    rockEnts: { night: 2 },                   // ожившие камни
    waterEnts:{ night: 3 },                   // кикимора и русалка у воды
    reaper:   { night: 3 },                   // жнец
    skeletons:{ night: 2 },                   // скелеты кладбища
    bats:     { night: 2 },                   // летучие мыши
    sickness: { day: 3 },                     // болезни
    laws:     { day: 4, rank: 1 },            // указы
    moodMass: { day: 3 },                     // хандра, подъём духа и драки от тоски
    achieve:  { gap: 20 },                    // ачивки не пачкой: не чаще раза в gap секунд, остальные ждут в очереди
    flood:    { day: 3 },                     // паводок
    lightning:{ day: 3 },                     // молнии в гномов
    lvToast:  { day: 3 },                     // всплывашки о повышении каждого гнома (раньше — только первое по званию)
    thieves:  { day: 3 },                     // волк и лиса таскают груз, гуси щиплют
    owls:     { day: 3 },                     // сова роняет вещи
    cats:     { day: 2 },                     // коты прибиваются к складу
    bear:     { day: 3 },                     // медведь, кабаны, ульи
    critters: { day: 2 },                     // мыши, кроты, барсуки, дятлы, белки, вороны
  },
  firstGhosts: 1,       // сколько призраков выходит в самую первую ночь (дальше — ghostsWant)
  bump: 0.35,           // шанс столкновений с грузом в первые двое суток (доля обычного)
};

// какие сейчас сутки (с 1) и сколько ночей уже наступило (вечер новой ночи считается)
function startDay() { return typeof cycleAt === 'function' ? cycleAt(Game.time).k + 1 : 1; }
function startNights() { if (typeof cycleAt !== 'function') return 0; const c = cycleAt(Game.time); return c.p >= EVE_START ? c.k + 1 : c.k; }
function startRank() { return Game.goal && typeof Game.goal.rank === 'number' ? Game.goal.rank : 9; }
// множитель сроков по сложности
function startGraceMul() { return (typeof dif === 'function' && dif().grace) || 1; }
// доля обычного шанса столкновений в первые двое суток
function startBump() { return START_GRACE.on && !Game.noGrace && startDay() < 3 ? START_GRACE.bump : 1; }
// открыта ли система для событий
function startOpen(id) {
  if (!START_GRACE.on || Game.noGrace) return true;
  const s = START_GRACE.sys[id];
  if (!s) return true;
  const g = startGraceMul();
  if (s.day && startDay() < 1 + Math.ceil((s.day - 1) * g)) return false;
  if (s.night && startNights() < Math.ceil(s.night * g)) return false;
  if (s.rank && startRank() < s.rank) return false;
  if (s.after && !s.after.every(t => Game.buildings.some(b => b.type === t && b.state === 'done' && !b.removed))) return false;
  return true;
}

// стадия меню готова к открытию: достроено всё из after и достигнута веха
function unlockReady(st) {
  return !!st.after && (!st.rank || startRank() >= st.rank || !START_GRACE.on) && (!st.night || startNights() >= st.night) && st.after.every(t => Game.buildings.some(b => b.type === t && b.state === 'done'));
}

// ---------- Запас прочности снаряжения (js/durability.js) ----------
// max — очков прочности у новой вещи (у «ржавых» стартовых вещей класса — kit), wear — сколько очков
// снимает один удар оружием (weapon) или один пропущенный удар по доспеху (armor).
const DUR = {
  max: { sword: 160, dagger: 130, bow: 150, staff: 140, leatherArmor: 75, ironArmor: 150, mageArmor: 60 },
  kit: { weapon: 50, armor: 40 },
  wear: { sword: 1, dagger: 0.9, bow: 0.7, staff: 0.6, rustyAxe2: 1.3, weapon: 1, armor: 3 },
  low: 0.25,            // ниже этой доли — предупреждение и слабеющий удар
  brokenAtk: 0.5,       // сломанное оружие бьёт вполсилы
  repairShare: 0.6,     // полный ремонт стоит столько от материалов нового
  keepOnDismiss: 0.5,   // распущенный рекрут возвращает в гильдию только вещи не ниже этой доли
  repair: {             // где чинят и что нужно на полный ремонт
    sword: ['weaponsmith', { iron: 2, timber: 1 }], dagger: ['weaponsmith', { iron: 1, leather: 1 }],
    bow: ['weaponsmith', { timber: 2, leather: 1 }], staff: ['weaponsmith', { timber: 2, leather: 1 }],
    rustyAxe2: ['weaponsmith', { iron: 2, timber: 1 }], leatherArmor: ['armory', { leather: 3 }],
    ironArmor: ['armory', { iron: 5, leather: 2 }], mageArmor: ['armory', { leather: 3 }],
  },
};
