'use strict';
// Общие константы и описания игровых сущностей.

const TILE = 32;          // размер клетки в пикселях мира
const MAP_W = 96;
const MAP_H = 72;
const SIM_DT = 0.05;      // шаг симуляции, сек

const T_GRASS = 0, T_WATER = 1, T_ROCK = 2, T_SAND = 3;

const FOOD_TIME = 420;    // за сколько секунд житель проголодается полностью
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
  trash:      { name: 'Мусор',           color: '#7a6a50', group: 'Хозяйство', noStore: true },
  ash:        { name: 'Пепел',           color: '#9e958a', group: 'Хозяйство' },
};
const GOOD_KEYS = Object.keys(GOODS);
const GOOD_GROUPS = ['Стройка', 'Еда', 'Ценности', 'Ремесло', 'Магия', 'Снаряжение', 'Хозяйство'];
const FOODS = ['sausage', 'bread'];   // что едят в трактире (по порядку предпочтения)

const UNIT_TYPES = {
  serf:       { name: 'Трудяга',   shirt: '#8a5a3a' },
  builder:    { name: 'Работяга',  shirt: '#b0884a' },
  woodcutter: { name: 'Лесоруб',   shirt: '#4a6e33' },
  carpenter:  { name: 'Плотник',   shirt: '#a8662e' },
  stonemason: { name: 'Каменотёс', shirt: '#6d6d72' },
  farmer:     { name: 'Фермер',    shirt: '#c9a83a' },
  miller:     { name: 'Мельник',   shirt: '#d8d4c8' },
  baker:      { name: 'Пекарь',    shirt: '#e8e2d4' },
  miner:      { name: 'Шахтёр',    shirt: '#5a5048' },
  smelter:    { name: 'Металлург', shirt: '#7a2e22' },
  breeder:    { name: 'Свинопас',  shirt: '#6a7a3a' },
  butcher:    { name: 'Мясник',    shirt: '#b84a3a' },
  tanner:     { name: 'Кожевник',  shirt: '#7a5a3a' },
  armorer:    { name: 'Бронник',   shirt: '#4a4a5a' },
  enchanter:  { name: 'Чародей',   shirt: '#4a3a8a' },
  hopgrower:  { name: 'Хмелевод',  shirt: '#5a8a3a' },
  brewer:     { name: 'Пивовар',   shirt: '#9a6a2a' },
  herder:     { name: 'Пастух',    shirt: '#7a8a5a' },
  stableman:  { name: 'Конюх',     shirt: '#6a4a3a' },
  goat:       { name: 'Вьючная коза', shirt: '#d8d0c0', animal: true, noTrain: true },
  carter:     { name: 'Извозчик',  shirt: '#5a5a6a', noTrain: true },
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
    name: 'Школа', cat: 'Основа', w: 3, h: 3, top: 96, cost: { timber: 5, stone: 5 }, inputs: { gold: 5 },
    desc: 'Двухэтажная школа с колокольней. Обучает жителей за 1 золото.',
  },
  inn: {
    name: 'Трактир', cat: 'Основа', w: 4, h: 3, top: 86, cost: { timber: 6, stone: 4 }, inputs: { bread: 10, sausage: 10, beer: 10 },
    desc: 'Голодные жители едят здесь колбасу или хлеб и запивают пивом. Пьяный может уснуть прямо на дороге.',
  },
  bonfire: {
    name: 'Большой костёр', cat: 'Основа', w: 3, h: 3, top: 40, noRotate: true, cost: { timber: 4, stone: 2 }, auto: true,
    inputs: { trash: 12 }, outputs: { ash: 6 },
    recipes: [{ in: { trash: 1 }, out: { ash: 1 }, time: 10 }],
    desc: 'Сюда трудяги сносят мусор из урн. Сгорая, он даёт пепел — фермы удобряют им поля, урожай растёт быстрее и богаче.',
  },
  goatpen: {
    name: 'Загон для коз', cat: 'Основа', w: 3, h: 2, top: 50, cost: { timber: 4, stone: 1 }, worker: 'herder',
    desc: 'Пастух приручает диких коз. Ручная коза возит груз по дорогам — по 2 штуки за раз. До 3 коз на загон.',
  },
  stable: {
    name: 'Извозчик', cat: 'Основа', w: 3, h: 2, top: 70, cost: { timber: 5, stone: 3 }, worker: 'stableman',
    inputs: { hay: 6, wheat: 4 },
    desc: 'Конюх растит лошадей на сене и зерне. Каждая лошадь с телегой — извозчик: везёт сразу весь стек, до 5 штук. До 3 на конюшню.',
  },
  woodcutter: {
    name: 'Дом лесоруба', cat: 'Ресурсы', w: 2, h: 2, top: 50, cost: { timber: 2, stone: 1 }, worker: 'woodcutter',
    outputs: { trunk: 5 },
    desc: 'Бревенчатая избушка. Лесоруб рубит взрослые деревья и сажает новые.',
  },
  sawmill: {
    name: 'Лесопилка', cat: 'Ресурсы', w: 3, h: 2, top: 58, cost: { timber: 3, stone: 2 }, worker: 'carpenter',
    inputs: { trunk: 5 }, outputs: { timber: 6 },
    recipes: [{ in: { trunk: 1 }, out: { timber: 2 }, time: 7 }],
    desc: 'Распиливает брёвна на доски.',
  },
  quarry: {
    name: 'Каменоломня', cat: 'Ресурсы', w: 2, h: 2, top: 50, cost: { timber: 3, stone: 0 }, worker: 'stonemason',
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
  farm: {
    name: 'Ферма', cat: 'Еда', w: 4, h: 3, top: 72, cost: { timber: 5, stone: 3 }, worker: 'farmer',
    inputs: { ash: 4 }, outputs: { wheat: 5, hay: 5 }, crops: ['wheat', 'hay'],
    desc: 'Фермер засевает поля вокруг: пшеницу на зерно или травы на сено.',
  },
  hopfarm: {
    name: 'Хмельник', cat: 'Еда', w: 3, h: 2, top: 92, cost: { timber: 4, stone: 2 }, worker: 'hopgrower',
    inputs: { ash: 3 }, outputs: { hops: 5 }, crops: ['hops'],
    desc: 'Хмелевод растит хмель на шестах вокруг и сушит шишки в башне.',
  },
  brewery: {
    name: 'Пивоварня', cat: 'Еда', w: 3, h: 2, top: 78, cost: { timber: 4, stone: 4 }, worker: 'brewer',
    inputs: { wheat: 5, hops: 5 }, outputs: { beer: 6 },
    recipes: [{ in: { wheat: 1, hops: 1 }, out: { beer: 2 }, time: 12 }],
    desc: 'Варит пиво из зерна и хмеля. Пиво везут в трактир.',
  },
  mill: {
    name: 'Мельница', cat: 'Еда', w: 2, h: 2, top: 118, noRotate: true, cost: { timber: 4, stone: 2 }, worker: 'miller',
    inputs: { wheat: 5 }, outputs: { flour: 5 },
    recipes: [{ in: { wheat: 1 }, out: { flour: 1 }, time: 8 }],
    desc: 'Мелет зерно в муку.',
  },
  bakery: {
    name: 'Пекарня', cat: 'Еда', w: 2, h: 2, top: 66, cost: { timber: 3, stone: 3 }, worker: 'baker',
    inputs: { flour: 5 }, outputs: { bread: 6 },
    recipes: [{ in: { flour: 1 }, out: { bread: 2 }, time: 9 }],
    desc: 'Печёт хлеб из муки.',
  },
  swine: {
    name: 'Свинарник', cat: 'Еда', w: 4, h: 3, top: 56, cost: { timber: 4, stone: 2 }, worker: 'breeder',
    inputs: { hay: 5 }, outputs: { pig: 3 },
    desc: 'Каждая охапка сена: свиньи подрастают на треть и появляется поросёнок. Взрослых везут на бойню.',
  },
  butchery: {
    name: 'Бойня', cat: 'Еда', w: 2, h: 2, top: 60, cost: { timber: 3, stone: 3 }, worker: 'butcher',
    inputs: { pig: 4 }, outputs: { sausage: 6, hide: 4 },
    recipes: [{ in: { pig: 1 }, out: { sausage: 2, hide: 1 }, time: 10 }],
    desc: 'Из свиньи — колбаса и шкура.',
  },
  tannery: {
    name: 'Дубильня', cat: 'Ремесло', w: 3, h: 2, top: 56, cost: { timber: 3, stone: 2 }, worker: 'tanner',
    inputs: { hide: 5 }, outputs: { leather: 5 },
    recipes: [{ in: { hide: 1 }, out: { leather: 1 }, time: 9 }],
    desc: 'Выделывает шкуры в кожу.',
  },
  armory: {
    name: 'Мастерская доспехов', cat: 'Ремесло', w: 3, h: 2, top: 66, cost: { timber: 3, stone: 4 }, worker: 'armorer',
    inputs: { leather: 5 }, outputs: { leatherArmor: 4 },
    recipes: [{ in: { leather: 2 }, out: { leatherArmor: 1 }, time: 12 }],
    desc: 'Шьёт кожаные доспехи для будущей армии.',
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
};
const BUILD_ORDER = Object.keys(BUILDINGS);
const BUILD_CATS = ['Основа', 'Ресурсы', 'Еда', 'Ремесло', 'Магия'];

const ROAD_STONE = 1;     // сколько камня уходит на клетку дороги
const STORE_CAP = 5;      // сколько курьеров одновременно внутри склада
const ROAD_DIG_HITS = 4;  // взмахов лопатой: корыто под дорогу (бесплатно)
const ROAD_PAVE_HITS = 4; // ударов молотком: укладка булыжника
const SITE_HITS = 3;      // ударов на разметку площадки
const HITS_PER_UNIT = 4;  // ударов молота на единицу материала
const HIT_TIME = 0.6;     // секунд на удар
const FARM_CROPS = ['wheat', 'hay', 'hops'];   // все виды полей
const CARRY_CAP = { serf: 1, goat: 2, carter: 5 };   // сколько единиц за раз

// Жизнь жителей
const SMOKE_TIME = 15, JOIN_SMOKE_TIME = 8;   // длительность перекура и подсевшего
const SMOKE_CD_MIN = 40, SMOKE_CD_MAX = 110;  // перезарядка перекура, сек
const JOIN_CD = 50;                           // перезарядка подсаживания к курящему
const JOIN_RADIUS = 7;                        // в клетках
const SLEEP_TIME = 60;                        // пьяный сон
const STARVE_FAINT = 25, FAINT_TIME = 15;      // через сколько секунд без еды падает, сколько лежит
const DRUNK_CHANCE = 0.65;                   // шанс захмелеть после кружки
const INJURY_TIME = 150;                      // сколько заживает травма
const COLLIDE_CHANCE = 0.03;                  // базовый шанс уронить груз при столкновении
