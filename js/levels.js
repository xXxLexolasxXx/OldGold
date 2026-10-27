'use strict';
// Второй уровень зданий: достройка за товары со склада, новый облик и новые возможности.
// Здание хранит ссылку на свой def: у уровня 2 это производный описатель (levelDef).

// Сарказм по зданиям: [уровень 1, уровень 2]
const DESCS = {
  storehouse: ['Большой каменный амбар. Хранит всё и никому не объясняет, почему именно так. Если чего-то нет — значит, вы это не привезли, а не он потерял.', 'Склад с пристройкой: места стало больше, порядка — ровно столько же. Внутрь набивается до 8 трудяг, снаружи — их начальство с важным видом.'],
  school: ['Школа с колокольней. Учит за 1 золото — рекордно дешёвое образование, никаких стипендий, никаких знаний сверх нужного. Выпускник умеет одно, зато твёрдо.', 'Второй этаж, второй звонок. Учат вдвое быстрее: отличники сдают экзамен, пока двоечник ищет парту. Диплом по-прежнему выдают на выходе, не глядя.'],
  inn: ['Курица, колбаса, хлеб и пиво — меню от шефа, который ничего другого не умеет и этим гордится. Пьяный может уснуть прямо на дороге, и это не баг, а традиция.', 'Трактир с мансардой: круассаны, стейки, тёмное пиво и свечи на столах. Цены прежние, амбиции выросли, уровень разговоров — нет.'],
  bonfire: ['Сюда носят мусор из урн. Сгорая, он даёт пепел — фермы удобряют им поля. Единственное место в деревне, где хлам превращается во что-то полезное, а не наоборот.', 'Костёр с каменным ободом: жрёт мусор вдвое быстрее и гордится этим на всю округу. Греться у него по-прежнему никто не просит.'],
  goatpen: ['Пастух приручает диких коз. Ручная коза возит груз сама, без профсоюза, зато с характером: что не унесёт — съест.', 'Загон с сеновалом: коз больше, а сена они едят меньше, потому что воруют соседское. Пастух делает вид, что это дрессировка.'],
  stable: ['Пастух растит лошадей. Лошадь с телегой — извозчик: везёт сразу кучу груза и не жалуется, потому что жаловаться некому.', 'Конюшня с чердаком: лошади довольнее, конюх спит на сене и называет это апартаментами. Арендную плату берёт с себя же.'],
  woodcutter: ['Избушка лесоруба. Рубит деревья, сажает новые — экологи плачут, но тихо, потому что у лесоруба топор.', 'Лесоруб купил вторую пилу и вдвое больше уверенности: брёвен за раз вдвое больше, пальцев — пока столько же.'],
  sawmill: ['Распиливает брёвна на доски. Опилки — это тоже еда, если очень надо, и лесничий проверял.', 'Лесопилка с мощным колесом: пилит на четверть быстрее и сильнее кричит. Соседи считают, что это одно и то же.'],
  quarry: ['Достаёт камень из земли. Земля обычно против, но спросить её никто не додумался.', 'Каменоломня с краном-журавлём: камня за раз вдвое больше, спина каменотёса — на месте. Пока.'],
  goldmine: ['Добывает золотую руду. Жилы обещают всё, золото — потом, шахтёр — верит. Трое в одной лодке.', 'Рудник с вагонетками: копает быстрее. Золота не стало больше, но шахтёры стали важнее и теперь ходят со свечой, как с орденом.'],
  metallurgist: ['Плавит руду в золото, сжигая брёвна. Лес жалко, зато блестит. Деревня выбирает блестит.', 'Плавильня с двумя горнами: быстрее, жарче, и от гномов снова пахнет подпалённой бородой. Это у них вместо парфюма.'],
  farm: ['Ферма: пшеница и сено. Фермер смотрит на небо, небо — на фермера, оба ждут, кто первый моргнёт.', 'Ферма с большим амбаром: влезает вдвое больше, а шутки про урожай стали вдвое длиннее. Урожай — нет.'],
  hopfarm: ['Хмельник. Хмелевод утверждает, что работает ради хлеба. Ни один хлеб из хмеля ещё не вышел, и все это знают.', 'Хмельник с высокой сушильней: больше шишек, и вся деревня знает, зачем. Хмелевод по-прежнему говорит «для аромата».'],
  brewery: ['Варит пиво из зерна и хмеля. Единственное предприятие, чьи отходы приятно пить, — так считает пивовар, и спорить с ним никто не трезв.', 'Пивоварня с погребом: варит ещё и тёмное пиво — вдвое сытнее и вдвое опаснее для головы. Погреб придуман, чтобы было где её потом искать.'],
  mill: ['Мельница мелет зерно в муку. Ветер её любит и не берёт денег — единственный работник без зарплаты и претензий.', 'Мельница с новыми крыльями: мелет быстрее, а мельник машет им рукой всё чаще. Крылья не отвечают, но он не теряет надежды.'],
  bakery: ['Печёт хлеб из муки, а хотел бы булочки. Мечта пекаря — единственное в деревне, что поднимается без дрожжей.', 'Пекарня с мансардой: хлеб остался, но появились круассаны. Пекарь теперь говорит «круассан» с придыханием и поднимает бровь, будто сам его придумал.'],
  swine: ['Свинарник. Свиньи подрастают на сене, гномы — на их надеждах. Надежды свиней в учёт не идут.', 'Свинарник с кормушками: вмещает больше свиней, которые лучше не знают, что их ждёт. Им и так хорошо, пусть радуются.'],
  butchery: ['Из свиньи — колбаса и шкура. Из мясника — философ: каждый вечер думает о бренности, каждое утро берёт топор.', 'Бойня с коптильней: из одной свиньи — шесть стейков. Свинья недовольна, трактир в восторге, мясник записал рецепт на фартуке.'],
  tannery: ['Выделывает шкуры в кожу. Запах — бесплатное приложение, которое нельзя удалить.', 'Дубильня с большими чанами: быстрее, а запах теперь слышно из соседней деревни. Соседи считают это объявлением войны.'],
  armory: ['Шьёт кожаные доспехи: долго, вдумчиво и с примеркой. Железные тут пока не клепают — мастерская для них слишком скромна. Заказы встают в очередь.', 'Мастерская с наковальней: клепает железные доспехи — 48 секунд и пять слитков на один. Зато в таком не страшно ни скелет, ни тёща.'],
  crystalmine: ['Добывает магические камни. Камни светятся — шахтёр делает вид, что не боится, а камни делают вид, что не светятся. Договорились.', 'Шахта с кристальной крепью: камней больше, света больше, здравого смысла — как раньше, то есть по минимуму.'],
  magiccircle: ['Камни отдают силу в банки маны. Работает сам, как и положено нормальной магии: ни работника, ни зарплаты, ни благодарности.', 'Круг с рунным ободом: из камня теперь две банки маны. Алхимики в шоке, чародей — в плюсе, камни — в банках.'],
  ironmine: ['Добывает железную руду. Скала считает это личным оскорблением и ржавеет в ответ, но шахтёр упрям: у него вагонетка и отпуск не скоро.', 'Рудник с рельсами и воротом: руды за заход вдвое больше, а скала ржавеет ещё обиднее. Шахтёр получил каску и считает себя инженером.'],
  smeltery: ['Домница с мехами: брёвна на входе, слитки на выходе, копоть везде. Кузнец утверждает, что так и задумано.', 'Домница с двойным дутьём: новый рецепт выжимает из руды больше слитков на то же полено. Копоти не стало меньше, зато теперь она эффективная.'],
  weaponsmith: ['Кузнец гнёт луки, ковёт мечи и точит кинжалы. Покупателей мало: все друг другу ровня и друг друга побаиваются.', 'Оружейная с большим горном: мечи выходят парами, а клиенты — не чаще. Кузнец повесил табличку «Скидок нет» и сам удивился, как это сработало.'],
  guild_warrior: ['Каменный зал с башней и двором, где бьют чучела. Чучела не жалуются, и потому лучшие рекруты — они.', 'Зал расширен: в гильдию влезает шесть бойцов, а потолок мастерства поднят до 14 уровня. Тренировки бодрее — чучела просят пощады.'],
  guild_archer: ['Лесная ложа с вышкой. Лучники попадают во всё, кроме тех, кого хотели бы, но стараются.', 'Ложа пристроила второй ярус стрельбища: шесть лучников, 14 уровней и очень уставшие мишени. Ветер, как и прежде, виноват во всём.'],
  guild_rogue: ['Кособокий дом с подвалом. Атаман клянётся, что всё честно, а ваше оружие забыл положить на место ещё вчера.', 'Подвал расширен и пахнет потайными ходами: шесть ловкачей, 14 уровней и бодрая тренировка. Кошельки соседей напряглись заранее.'],
  guild_mage: ['Башня со звёздным куполом. Маги серьёзны, пока не попросишь показать фокус: тогда они серьёзны вдвойне, потому что фокус не вышел.', 'Башня выросла: шесть магов, 14 уровней и учёба вдвое быстрее. Звёзды на куполе теперь подмигивают, но это, скорее всего, сквозняк.'],
  magicworkshop: ['Чародей создаёт посохи и мантии. Волшебство в рассрочку: сегодня мана, завтра посох, послезавтра объяснение, почему он не искрит.', 'Мастерская с башенкой-обсерваторией: быстрее и звёздно. Чародей вдохновлён, вдохновение — тоже ресурс, но на склад его не принимают.'],
};

// Что даёт второй уровень: цена достройки и особые свойства (сверх общего «быстрее/просторнее»)
const LEVEL2 = {
  storehouse:    { cost: { timber: 5, stone: 5 }, cap: 8 },
  school:        { cost: { timber: 4, stone: 4 }, train: 0.5 },
  inn:           { cost: { timber: 5, stone: 4 }, cozy: true },
  bonfire:       { cost: { timber: 3, stone: 3 } },
  goatpen:       { cost: { timber: 3, stone: 2 } },
  stable:        { cost: { timber: 4, stone: 3 } },
  woodcutter:    { cost: { timber: 2, stone: 2 }, gather: 2 },
  sawmill:       { cost: { timber: 3, stone: 3 } },
  quarry:        { cost: { timber: 3, stone: 2 }, gather: 2 },
  goldmine:      { cost: { timber: 3, stone: 3 } },
  metallurgist:  { cost: { timber: 3, stone: 4 } },
  farm:          { cost: { timber: 4, stone: 3 } },
  hopfarm:       { cost: { timber: 3, stone: 3 } },
  brewery:       { cost: { timber: 4, stone: 4 }, addOut: { darkbeer: 6 }, addRecipes: [{ in: { wheat: 1, hops: 1 }, out: { darkbeer: 1 }, time: 14 }] },
  mill:          { cost: { timber: 3, stone: 3 } },
  bakery:        { cost: { timber: 4, stone: 3 }, addIn: {}, addOut: { croissant: 9 }, addRecipes: [{ in: { flour: 2 }, out: { croissant: 3 }, time: 11 }] },
  swine:         { cost: { timber: 4, stone: 3 } },
  butchery:      { cost: { timber: 3, stone: 4 }, addOut: { steak: 12 }, addRecipes: [{ in: { pig: 1 }, out: { steak: 6 }, time: 12 }] },
  tannery:       { cost: { timber: 3, stone: 3 } },
  armory:        { cost: { timber: 5, stone: 8 }, addRecipes: [{ in: { iron: 5, leather: 2 }, out: { ironArmor: 1 }, time: 48 }] },
  crystalmine:   { cost: { timber: 3, stone: 4 } },
  magiccircle:   { cost: { stone: 8 }, double: true },
  ironmine:      { cost: { timber: 4, stone: 4 }, outMult: 2 },
  smeltery:      { cost: { timber: 4, stone: 6 }, addRecipes: [{ in: { ironore: 2, trunk: 1 }, out: { iron: 2 }, time: 14 }] },
  weaponsmith:   { cost: { timber: 4, stone: 6 }, addRecipes: [{ in: { iron: 3, timber: 1 }, out: { sword: 2 }, time: 22 }] },
  guild_warrior: { cost: { timber: 5, stone: 10 }, recMax: 6, recLvl: 14, drillXp: 40, train: 0.5 },
  guild_archer:  { cost: { timber: 10, stone: 5 }, recMax: 6, recLvl: 14, drillXp: 40, train: 0.5 },
  guild_rogue:   { cost: { timber: 7, stone: 6 }, recMax: 6, recLvl: 14, drillXp: 40, train: 0.5 },
  guild_mage:    { cost: { timber: 5, stone: 10 }, recMax: 6, recLvl: 14, drillXp: 40, train: 0.5 },
  magicworkshop: { cost: { timber: 3, stone: 4 } },
};

// Что даёт третий уровень (кроме гильдий — у них свой путь в guildpath.js): цена = полторы цены уровня 2,
// плюс общий закон: циклы ещё на 20% быстрее, склады у здания на четверть вместительнее, особое свойство типа
const LEVEL3 = {};
for (const t in LEVEL2) {
  if (t.startsWith('guild_')) continue;
  const c = LEVEL2[t].cost, o = {};
  for (const g in c) o[g] = Math.ceil(c[g] * (g === 'stone' ? 1.8 : 1.5));
  LEVEL3[t] = { cost: o };
}
Object.assign(LEVEL3.storehouse, { cap: 4 });                    // ещё +4 места внутри
Object.assign(LEVEL3.school, { train: 0.7 });                    // учат вдвое быстрее прежнего уровня 2
Object.assign(LEVEL3.inn, { cozy: true });
Object.assign(LEVEL3.woodcutter, { gather: 1 });                 // ещё +1 к охапке
Object.assign(LEVEL3.quarry, { gather: 1 });
Object.assign(LEVEL3.ironmine, { outMult: 1.5 });
Object.assign(LEVEL3.goldmine, { outMult: 1.5 });
Object.assign(LEVEL3.crystalmine, { outMult: 1.5 });
const DESCS3 = {
  storehouse: 'Склад под черепицей: места ещё больше, порядка — всё так же. Теперь его не только не найти, но и не обойти.',
  school: 'Школа под черепицей и с флюгером: учат втрое быстрее, чем в первый день. Звонок слышно уже из соседнего уезда.',
  inn: 'Трактир под черепицей: уютнее некуда, а флюгер-петух кукарекает на ветру. Пиво прежнее, гордость — на уровне крыши.',
  bonfire: 'Костёр в каменной чаше: сжигает мусор втрое быстрее первого. Греться подходят всё равно по-прежнему мало.',
  goatpen: 'Козий загон под черепицей: козы теперь живут лучше пастуха и знают об этом.',
  stable: 'Конюшня под черепицей: лошади в стойлах с позолотой. Пастух уверяет, что флюгер — это не лишнее.',
  woodcutter: 'Избушка лесоруба под черепицей: охапка вдвое больше, топор тот же, лес — всё ещё в ужасе.',
  sawmill: 'Лесопилка под черепицей и с флюгером: пилит как зверь. Опилки теперь просеивают.',
  quarry: 'Каменоломня с двумя журавлями: камня за заход целая гора. Гора, впрочем, теперь поменьше.',
  goldmine: 'Рудник под черепицей: золота за заход ещё полтора раза больше, шахтёры — на полтора раза важнее.',
  metallurgist: 'Плавильня с тремя горнами под черепицей: плавит быстрее всех, коптит — тоже.',
  farm: 'Ферма под черепицей: амбар ещё просторнее, шутки про урожай — прежние.',
  hopfarm: 'Хмельник под черепицей: сушильня ещё вместительнее. Для аромата, конечно, для чего же ещё.',
  brewery: 'Пивоварня под черепицей: варит быстрее и крепче. Флюгер показывает не ветер, а где сегодня пивовар.',
  mill: 'Мельница под черепицей: мелет так, что мука витает над деревней. Ветер уже не против.',
  bakery: 'Пекарня под черепицей: хлеб, круассаны и ещё больше хлеба. Пекарь поправляет колпак с видом шеф-повара.',
  swine: 'Свинарник под черепицей: свиньям живётся как господам. Они, впрочем, ничего не заметили.',
  butchery: 'Бойня под черепицей: коптит и режет быстрее. Мясник теперь философствует в двух экземплярах.',
  tannery: 'Дубильня под черепицей: кожа выходит быстро, запах — ещё быстрее.',
  armory: 'Мастерская под черепицей: доспехи шьют стахановскими темпами, армия по-прежнему «в планах».',
  crystalmine: 'Шахта с кристальной крепью под черепицей: камней в полтора раза больше, света — слепит.',
  magiccircle: 'Круг с золотым ободом: маны из камня ещё быстрее. Алхимики подали в отставку.',
  ironmine: 'Рудник под черепицей, рельсы стальные: руды за заход в полтора раза больше. Скала сдалась.',
  smeltery: 'Домница под черепицей: выплавляет быстрее всех. Копоть теперь — с гордостью.',
  weaponsmith: 'Оружейная под черепицей: мечи выходят пачками, а клиентов всё нет. Кузнец повесил вторую табличку «Скидок нет».',
  magicworkshop: 'Мастерская под черепицей: посохи искрят даже вхолостую. Чародей называет это рекламой.',
};

// Общий закон уровня 2: циклы на четверть быстрее, склады у здания в полтора раза вместительнее
const scaleCaps = o => { if (!o) return o; const r = {}; for (const g in o) r[g] = Math.ceil(o[g] * 1.5); return r; };

for (const t in DESCS) if (BUILDINGS[t]) { BUILDINGS[t].desc = DESCS[t][0]; BUILDINGS[t].desc2 = DESCS[t][1]; BUILDINGS[t].up = LEVEL2[t]; if (LEVEL3[t]) { BUILDINGS[t].up3 = LEVEL3[t]; BUILDINGS[t].desc3 = DESCS3[t]; } }

function levelDef(type) {
  const d = BUILDINGS[type];
  if (!d.up) return d;
  if (d._l2) return d._l2;
  const u = d.up, o = Object.assign({}, d);
  o.inputs = d.inputs ? scaleCaps(d.inputs) : undefined;
  o.outputs = d.outputs ? scaleCaps(d.outputs) : undefined;
  if (u.addIn) o.inputs = Object.assign(o.inputs || {}, u.addIn);
  if (u.addOut) o.outputs = Object.assign(o.outputs || {}, u.addOut);
  if (d.recipes) {
    o.recipes = d.recipes.map(r => Object.assign({}, r, { time: Math.max(3, Math.round(r.time * 0.75)) }));
    if (u.outMult) for (const r of o.recipes) { r.out = Object.assign({}, r.out); for (const g in r.out) r.out[g] *= u.outMult; }
    if (u.double) for (const r of o.recipes) r.out = Object.assign({}, r.out, { mana: (r.out.mana || 1) * 2 });
    if (u.addRecipes) for (const r of u.addRecipes) o.recipes.push(Object.assign({}, r));
  }
  o.desc = d.desc2;
  o.level2 = true; o.gatherMult = u.gather || 1; o.storeCap = u.cap || 0; o.trainMult = u.train || 1; o.cozy = !!u.cozy;
  o.recMax = u.recMax || 0; o.recLvl = u.recLvl || 0; o.drillXp = u.drillXp || 0;
  d._l2 = o;
  return o;
}

// Уровень 3 (кроме гильдий): ещё на 20% быстрее, склады на четверть больше, плюс особое свойство типа
function levelDefL3(type) {
  const d = BUILDINGS[type];
  if (d._l3c) return d._l3c;
  const u = d.up3, o = Object.assign({}, levelDef(type));
  const grow = x => { if (!x) return x; const r = {}; for (const g in x) r[g] = Math.ceil(x[g] * 1.25); return r; };
  o.inputs = grow(o.inputs); o.outputs = grow(o.outputs);
  if (o.recipes) {
    o.recipes = o.recipes.map(r => Object.assign({}, r, { time: Math.max(3, Math.round(r.time * 0.8)) }));
    if (u.outMult) for (const r of o.recipes) { r.out = Object.assign({}, r.out); for (const g in r.out) if (g !== 'mana') r.out[g] = Math.max(r.out[g], Math.round(r.out[g] * u.outMult)); }
  }
  o.up = null; o.level3 = true; o.desc = d.desc3 || o.desc;
  o.gatherMult = (o.gatherMult || 1) + (u.gather || 0); o.storeCap = (o.storeCap || 0) + (u.cap || 0);
  if (u.train) o.trainMult = 0.35;
  d._l3c = o;
  return o;
}

function canUpgrade(b) { return b.state === 'done' && !b.removed && !b.isRoad && ((b.level || 1) < 2 ? !!b.def.up : (b.level || 1) < 3 && !!b.def.up3); }
// следующий уровень здания и цена достройки до него
const nextLevelOf = b => ((b.level || 1) >= 2 ? 3 : 2);

// Достройка — настоящая стройка: материалы везут трудяги, работяга по кирпичику надстраивает
// здание, пока идёт стройка, производство стоит.
function startUpgrade(b) {
  if (!canUpgrade(b) || b.upg) return false;
  const nl = nextLevelOf(b), cost = (nl === 3 ? b.def.up3 : b.def.up).cost, total = Object.values(cost).reduce((a, n) => a + n, 0);
  b.upg = { cost, total, used: emptyGoods(), stock: emptyGoods(), usedN: 0, hits: 0, maxHits: Math.max(1, total * HITS_PER_UNIT), builder: null, to: nl };
  b.builder = null;
  b._usite = null;
  toast(`«${b.def.name}»: начата достройка до уровня ${nl}`, b);
  logEvent('build', `«${b.def.name}»: начата достройка до уровня ${nl}`, b.doorX + 0.5, b.doorY);
  return true;
}

function cancelUpgrade(b) {
  if (!b.upg) return;
  const u = b.upg.builder; if (u && u.job === b) u.job = null;
  b.upg = null; b._usite = null;
}

// Работяга: ждёт материалов, на каждую единицу — несколько ударов молота
function* upgradeGen(u, b) {
  const ok = yield { walk: [b.doorX, b.doorY] };
  if (!ok) { if (b.upg && b.upg.builder === u) b.upg.builder = null; u.job = null; yield { wait: 3 }; return; }
  let idleT = 0;
  while (!b.removed && b.upg && u.job === b) {
    if (u.wantsEat() && findInn(u)) break;
    const U = b.upg, g = ['trunk', 'timber', 'stone'].find(k => U.stock[k] > 0);
    if (g) {
      U.stock[g]--; U.used[g]++; U.usedN++;
      for (let k = 0; k < HITS_PER_UNIT && !b.removed && b.upg; k++) { yield { wait: HIT_TIME, anim: 'build' }; if (b.upg) { b.upg.hits++; b.lastHit = Game.time; } }
      if (b.removed || !b.upg) break;
      if (U.usedN >= U.total) { finishUpgrade(b); break; }
      idleT = 0;
    } else {
      // как на стройке: никто не везёт — сходить самому; совсем нечего класть — уйти, а не стоять вечно
      const none = !['trunk', 'timber', 'stone'].some(k => b.incoming[k] > 0);
      if (none && idleT >= 2 && (yield* fetchForSiteGen(u, b, true))) { idleT = 0; continue; }
      if (none && (idleT += 1) > 20) break;
      yield { wait: 1 };
    }
  }
  if (b.upg && b.upg.builder === u) b.upg.builder = null;
  if (u.job === b) u.job = null;
}

function finishUpgrade(b) {
  if (!b.upg) return;
  b.upg = null; b._usite = null;
  upgradeBuilding(b);
}

function upgradeBuilding(b, silent) {
  const nl = nextLevelOf(b);
  b.level = nl;
  b.def = nl === 3 && b.def.up3 ? levelDefL3(b.type) : levelDef(b.type);
  // новые рецепты — в конец списка, прежние галочки остаются
  while (b.recipeOn.length < (b.def.recipes || []).length) b.recipeOn.push(true);
  if (!silent) {
    b.dmg = 0;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    fxBurst(cx * TILE, cy * TILE, 30, ['#d8b070', '#a0703a', '#e8cc90', '#cfc7b4'], 90, 60, 0.9, 2.4, 240);
    floater(cx, b.y - 1, `Уровень ${nl}!`, '#ffe08a');
    logEvent('build', `«${BUILDINGS[b.type].name}» достроено до уровня ${nl}`, cx, cy);
    toast(`«${BUILDINGS[b.type].name}» достроено до уровня ${nl}`, b);
    sfxAt('build', cx * TILE, cy * TILE);
  }
  return true;
}

// ---------- Облик уровня 2 ----------
// Поверх готового спрайта: каменный цоколь, мансарда с тёплым окном на коньке крыши,
// красно-золотой вымпел и фонарь у двери. У каждого типа своя пропорция, цвета слегка разные.

// ---------- Эпохи облика ----------
// Облик здания = эпоха поселения (веха: поселение → деревня → город) плюс шаг за уровень 2
// и нижняя планка для зданий с каменным нравом (гильдии). Спрайты кэшируются по эпохе (#e1…#e3);
// спрайты ненужных эпох выбрасываются (eraEvict), поэтому память не растёт.
const ERA_MIN = { guild_warrior: 2, guild_archer: 2, guild_rogue: 2, guild_mage: 2, weaponsmith: 2, smeltery: 2, magicworkshop: 2 };
function settleEra() {
  if (typeof window !== 'undefined' && window.ERA_FORCE) return window.ERA_FORCE;
  const g = typeof Game !== 'undefined' && Game.goal;
  return 1 + Math.max(0, Math.min(2, (g && g.rank) | 0));
}
function buildingEra(type, level = 1, settle = settleEra()) {
  const forced = typeof window !== 'undefined' && window.ERA_FORCE;
  const e = settle + (level >= 2 && !forced ? 1 : 0);
  return Math.max(1, Math.min(3, forced ? settle : Math.max(e, ERA_MIN[type] || 1)));
}
// выбросить спрайты зданий всех эпох, кроме перечисленных
function eraEvict(keep) {
  for (const k in SPR.buildings) { const e = +k.split('#e')[1]; if (e && !keep.includes(e)) delete SPR.buildings[k]; }
}

const PX_TYPES = new Set(['inn', 'storehouse', 'house', 'school', 'sawmill', 'woodcutter', 'quarry']);   // здания в новом пиксельном стиле (bldpx.js)
function buildingSprite(type, rot = 0, level = 1, settle, vr = 0) {
  const lv = level >= 3 && (BUILDINGS[type].up3 || type.startsWith('guild_')) ? 3 : level >= 2 && BUILDINGS[type].up ? 2 : 1;
  if (PX_TYPES.has(type) && typeof pxSprite === 'function') return pxSprite(type, rot, lv, vr);   // пиксельные здания ×1 со своими уровнями (bldpx.js)
  const era = buildingEra(type, lv, settle);
  if (lv < 2 && NO_GREEN.has(type)) return buildingSpriteBase(type, rot, 1, era, vr);
  const d = bDims(type, rot);
  const key = type + ':' + d.rot + (lv === 3 ? ':L3' : lv === 2 ? ':L2' : ':G') + (vr ? '~v' + vr : '') + '#e' + era;
  if (SPR.buildings[key]) return SPR.buildings[key];
  const base = buildingSpriteBase(type, rot, lv, era, vr);
  const cv = mkCanvas(base.canvas.width, base.canvas.height), c = cv.getContext('2d');
  c.drawImage(base.canvas, 0, 0);
  c.imageSmoothingEnabled = false;
  // Рисуем в пикселях готового арта (их втрое больше мировых): все детали — тем же пикселем,
  // что и само здание, с 1-px тёмным контуром.
  const k = base.canvas.width / base.w;
  const rnd = mulberry32(hashStr(type + 'L2' + (vr || '')));
  const px = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const OUT = '#1a100a';
  if (lv >= 2) {
    rnd();
    const rc = lv === 3 ? '#b04a2c' : '#8a6238';   // мансарда в цвет кровли уровня: дерево / черепица
    const P = (base.perches && base.perches[0]) || [base.padx + base.fw / 2, base.top * 0.4];
    const mx = Math.round(P[0] * k), my = Math.round(P[1] * k) + 20 * k;
    if (!base.tall && type !== 'watchtower') {
      // мансарда на коньке: белёная стенка, ступенчатая крыша, тёплое окно
      const W = 44, H = 26;
      px(mx - W / 2 - 1, my - H - 1, W + 2, H + 2, OUT);
      px(mx - W / 2, my - H, W, H, '#d8b98a'); px(mx - W / 2, my - H, W, 1, '#ecd5ac');
      px(mx - W / 2, my - 4, W, 4, '#6e4a2a');                               // нижняя балка
      for (let i = 0; i < 14; i++) {                                         // крыша: по 1 px на ступень
        const hw = W / 2 + 4 - i * 1.7;
        px(mx - hw - 1, my - H - 2 - i, hw * 2 + 2, 1, OUT);
      }
      for (let i = 0; i < 13; i++) { const hw = W / 2 + 3 - i * 1.7; px(mx - hw, my - H - 2 - i, hw * 2, 1, i % 4 === 3 ? '#4a2a1e' : i < 6 ? rc : shade(rc, 0.18)); }
      px(mx - 7, my - 20, 14, 15, OUT); px(mx - 6, my - 19, 12, 13, '#ffd878'); px(mx - 6, my - 19, 12, 6, '#fff0b8');
      px(mx - 1, my - 19, 1, 13, '#5a3a1e'); px(mx - 6, my - 13, 12, 1, '#5a3a1e');
    }
    // вымпел на шесте
    const FX = (base.perches && base.perches[1]) ? base.perches[1] : [P[0] + 18, P[1] + 4];
    const fx = Math.round((Math.abs(FX[0] - P[0]) < 12 ? P[0] + 20 : FX[0]) * k), fy = Math.round(Math.min(FX[1], P[1]) * k) + 3 * k;
    px(fx - 1, fy - 70, 4, 74, OUT); px(fx, fy - 69, 2, 72, '#6a4a2a'); px(fx, fy - 69, 1, 72, '#a07848');
    for (let i = 0; i < 18; i++) { const w = 38 - i * 2; px(fx + 2, fy - 68 + i, w + 1, 1, OUT); }
    for (let i = 1; i < 17; i++) { const w = 36 - i * 2; px(fx + 2, fy - 68 + i, w, 1, i > 6 && i < 10 ? '#f0c040' : i > 12 ? '#8a2020' : '#c03030'); }
    // фонарь у двери
    const lx = Math.round((base.doorCx + 10) * k), ly = Math.round((base.baseY - 26) * k);
    px(lx - 3, ly - 22, 12, 26, OUT); px(lx - 2, ly - 21, 10, 3, '#3a2a1a'); px(lx - 2, ly - 18, 10, 18, '#ffd060'); px(lx - 2, ly - 18, 10, 6, '#fff0b8');
    px(lx + 2, ly - 25, 2, 3, OUT); px(lx - 2, ly, 10, 4, '#3a2a1a');
  }
  if (lv >= 2 && type === 'ironmine') {
    // копёр над штольней: две стойки, перекладина и железное колесо ворота
    const hx = Math.round((base.doorCx - 34) * k / 1), hy = Math.round((base.baseY - 14) * k);
    for (const sx of [0, 56]) { px(hx + sx - 1, hy - 100, 8, 102, OUT); px(hx + sx, hy - 99, 6, 100, '#6a4a2a'); px(hx + sx, hy - 99, 2, 100, '#a07848'); }
    px(hx - 3, hy - 104, 68, 10, OUT); px(hx - 2, hy - 103, 66, 8, '#7a5632'); px(hx - 2, hy - 103, 66, 2, '#b08a58');
    px(hx + 22, hy - 126, 20, 22, OUT); px(hx + 24, hy - 124, 16, 18, '#8a909c'); px(hx + 28, hy - 120, 8, 10, '#2a2c34'); px(hx + 24, hy - 124, 16, 3, '#c4cad4');
    px(hx + 31, hy - 100, 2, 56, '#2a2018');
  }
  if (lv >= 2 && type.startsWith('guild_')) {
    // позолоченный щит над входом цвета класса
    const col = GCLS[type.slice(6)].col, gx = Math.round(base.doorCx * k), gy = Math.round((base.baseY - 60) * k);
    px(gx - 14, gy - 2, 30, 36, OUT); px(gx - 12, gy, 26, 30, '#f0c040'); px(gx - 10, gy + 2, 22, 24, col); px(gx - 8, gy + 4, 18, 4, shade(col, 0.25)); px(gx - 8, gy + 26, 18, 2, OUT);
    px(gx - 1, gy + 4, 4, 22, '#f0c040');
  }
  if (lv === 3 && !type.startsWith('guild_')) {
    // флюгер на коньке: шест с золотым шаром, стрелка и петух — приметный знак «здание достроено до конца»
    const P = (base.perches && base.perches[0]) || [base.padx + base.fw / 2, base.top * 0.4];
    const vx = Math.round(P[0] * k) - 24 * k / 3, vy = Math.round(P[1] * k) + (base.tall || type === 'watchtower' ? 8 : -22) * k / 3;
    const GOLD = '#f0c040', HI = '#fff0a0', SH = '#b8901e';
    px(vx - 2, vy - 66, 6, 70, OUT); px(vx - 1, vy - 65, 4, 68, '#5a5a62'); px(vx - 1, vy - 65, 1, 68, '#9a9aa6');
    px(vx - 5, vy - 74, 12, 10, OUT); px(vx - 4, vy - 73, 10, 8, GOLD); px(vx - 4, vy - 73, 4, 3, HI); px(vx + 2, vy - 68, 4, 2, SH);
    px(vx - 22, vy - 51, 46, 8, OUT); px(vx - 21, vy - 50, 44, 6, GOLD); px(vx - 21, vy - 50, 44, 2, HI); px(vx - 21, vy - 46, 44, 2, SH);   // стрелка
    px(vx + 22, vy - 54, 6, 14, OUT); px(vx + 22, vy - 53, 4, 12, GOLD); px(vx - 28, vy - 54, 8, 14, OUT); px(vx - 27, vy - 53, 6, 12, GOLD);
    px(vx + 4, vy - 66, 14, 16, OUT); px(vx + 5, vy - 65, 12, 14, GOLD); px(vx + 5, vy - 65, 12, 3, HI);   // петух
    px(vx + 14, vy - 72, 6, 8, OUT); px(vx + 15, vy - 71, 4, 6, GOLD); px(vx + 18, vy - 68, 6, 4, '#e04a3a'); px(vx + 9, vy - 71, 4, 5, '#e04a3a');
  }
  greenery(c, base, type, px, k);
  const spr = Object.assign({}, base, { canvas: cv });
  SPR.buildings[key] = spr;
  return spr;
}

// ---------- Зелень на зданиях ----------
// Плющ по стене и ящики с цветами под окнами — тем же пикселем, что и здание.

const NO_GREEN = new Set(['magiccircle', 'bonfire', 'graveyard']);

function greenery(c, base, type, px, k = 3) {
  const rnd = mulberry32(hashStr(type + 'green'));
  const gs = ['#2f6a2a', '#4a8a34', '#6aa844', '#8cc85a'], OUT = '#16300f';
  const x0 = base.padx * k, w = base.fw * k, yb = base.baseY * k;
  const door = base.doorCx * k;
  const spotOK = x => Math.abs(x - door) > 14 * k;
  const leaf = (x, y, col) => { px(x, y, 3, 3, OUT); px(x, y, 2, 2, col); px(x + 1, y, 1, 1, '#8cc85a'); };
  // плющ: стебель с листьями парами
  if (rnd() < 0.75) {
    let vx = x0 + (6 + rnd() * (base.fw - 20)) * k;
    for (let t = 0; t < 8 && !spotOK(vx); t++) vx = x0 + (6 + rnd() * (base.fw - 20)) * k;
    const hgt = (14 + Math.floor(rnd() * 16)) * k;
    for (let s = 0; s < 3; s++) {
      let x = vx + s * 5 * k + (rnd() - 0.5) * 3 * k;
      const len = hgt - s * 3 * k;
      for (let y = 0; y < len; y += 2) {
        x += (rnd() - 0.5) * 1.6;
        const yy = yb - 8 * k - len + y;
        px(x, yy, 1, 2, OUT);
        if (rnd() < 0.5) leaf(x + (rnd() < 0.5 ? -3 : 1), yy - 1, gs[1 + Math.floor(rnd() * 3)]);
      }
    }
  }
  // ящик с цветами у стены
  if (rnd() < 0.8) {
    let fx = x0 + (6 + rnd() * (base.fw - 26)) * k;
    for (let t = 0; t < 8 && !spotOK(fx) && !spotOK(fx + 14 * k); t++) fx = x0 + (6 + rnd() * (base.fw - 26)) * k;
    const cols = [['#e8423a', '#f08070'], ['#f0c840', '#fff0a0'], ['#d070e0', '#f0b0f8'], ['#ffffff', '#f0e8f0']][Math.floor(rnd() * 4)];
    const BW = 42, BH = 12;
    px(fx - 1, yb - BH - 1, BW + 2, BH + 2, OUT); px(fx, yb - BH, BW, BH, '#7a4e2a'); px(fx, yb - BH, BW, 2, '#9a6a3a'); px(fx, yb - BH, BW, 1, '#b88a50');
    for (let i = 0; i < 7; i++) {
      const x = fx + 3 + i * 6, dy = (i % 2) * 2;
      px(x, yb - BH - 6 - dy, 2, 7 + dy, '#3f7a2e'); px(x + 2, yb - BH - 3 - dy, 2, 2, '#3f7a2e');
      px(x - 1, yb - BH - 10 - dy, 5, 5, OUT); px(x, yb - BH - 9 - dy, 3, 3, cols[0]); px(x, yb - BH - 9 - dy, 1, 1, cols[1]);
    }
  }
  // виноградная лоза по шпалере у входа
  if (rnd() < 0.3) {
    const gx = door + (rnd() < 0.5 ? -26 : 20) * k;
    for (let i = 0; i < 40; i++) {
      const gy = yb - 10 * k - i * 1.4, x = gx + Math.sin(i * 0.3) * 9;
      px(x, gy, 1, 2, '#4a3418');
      if (i % 3 === 0) leaf(x + (i % 6 ? 1 : -3), gy - 1, gs[1 + (i % 3)]);
    }
    for (let i = 0; i < 3; i++) { px(gx + 4 + i * 6, yb - 18 * k + (i % 2) * 3, 4, 4, OUT); px(gx + 5 + i * 6, yb - 18 * k + 1 + (i % 2) * 3, 2, 2, '#6a2a7a'); }
  }
}


// ---------- Настоящий второй этаж ----------
// Главный корпус здания поднимается на этаж выше, на новых стенах — ряд освещённых окон;
// крыша становится круче. Рисуется той же моделью, что и обычное здание, поэтому выглядит родным.
const UP_EXTRA = 18, UP_FLOOR = 15;

function upgradeModel(m) {
  let best = null, ba = 0;
  for (const part of m.parts) {
    if (part.kind !== 'box') continue;
    const p = part.p;
    if (p.open || p.canopy || p.noShadow || !p.roof || p.z0) continue;
    const a = (p.x1 - p.x0) * (p.y1 - p.y0);
    if (a > ba) { ba = a; best = part; }
  }
  if (!best) return false;
  const p = best.p, q = { ...p };
  q.h = p.h + UP_FLOOR;
  q.roof = { ...p.roof, rise: (p.roof.rise || 18) + 4 };
  const dec = { S: [...((p.decor && p.decor.S) || [])], E: [...((p.decor && p.decor.E) || [])], W: [...((p.decor && p.decor.W) || [])] };
  const z = p.h + 3;
  const sh = ['#6a2a1a', '#3e5a7a', '#5a3a1e'][(p.x0 | 0) % 3];
  for (let x = p.x0 + 14, i = 0; x < p.x1 - 8; x += 24, i++) dec.S.push({ t: 'win', at: x, z, w: 7, h: 9, o: { lit: true, shutter: sh, flowers: i % 2 === 0 } });
  for (let y = p.y0 + 14; y < p.y1 - 8; y += 24) dec.E.push({ t: 'win', at: y, z, w: 7, h: 9, o: { lit: true } });
  q.decor = dec;
  best.p = q;
  return true;
}

// ---------- Достройка на глазах ----------
// Поверх старого здания по кирпичику проявляется новое (второй этаж, новая крыша),
// вокруг стоят леса до достигнутой высоты, на месте удара — вспышка и пыль.
function drawUpgradeLayer(c, b) {
  const spr = buildingSprite(b.type, b.rot || 0, (b.upg && b.upg.to) || nextLevelOf(b), undefined, b.hv || 0);
  const fb = { buildFrac: b.upg.hits / b.upg.maxHits, _site: b._usite };
  const S = siteState(fb, spr);
  b._usite = fb._site;
  const ox = b.x * TILE - spr.padx, oy = b.y * TILE - spr.top;
  const fx = b.x * TILE, fy = b.y * TILE, fw = b.w * TILE, fh = b.h * TILE;
  c.imageSmoothingEnabled = true;
  c.drawImage(S.cv, ox, oy, spr.w, spr.h);
  const k = spr.canvas.width / spr.w;
  for (const p of S.pops) {
    const age = Game.time - p.t;
    if (age > 0.6) continue;
    const cl = p.cl, x = ox + cl.x / k, y = oy + cl.y / k, s = cl.s / k;
    if (age < 0.3) { c.fillStyle = `rgba(255,248,225,${0.55 * (1 - age / 0.3)})`; c.fillRect(x, y, s, s); }
    if (p.dust) {
      c.fillStyle = `rgba(200,180,150,${0.5 * (1 - age / 0.6)})`;
      for (let d = 0; d < 4; d++) { const a = d * 1.6 + cl.x; c.beginPath(); c.arc(x + s / 2 + Math.cos(a) * age * 14, y + s / 2 + Math.sin(a) * age * 8 - age * 6, 1 + age * 4, 0, 7); c.fill(); }
    }
  }
  c.imageSmoothingEnabled = R.smooth;
  // строительные леса до текущей высоты: стойки с раскосами, настилы из тех же досок, что и в интерфейсе,
  // перила, плинтус; такие же леса стоят вдоль боковой стены
  const topY = S.top < 1e9 ? oy + S.top / k : fy + fh - 10;
  const poleTop = Math.min(fy + fh - 10, topY - 5);
  const gy = fy + fh, t = Game.time;
  const sk = b.type === 'swine' && b.rot ? 0 : SK, dk = DK;
  const rect = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const tex = PLANK_TEX, seed = b.id * 37;
  // доска из интерфейсной текстуры: горизонтальный кусок len×h (с тёмным нижним краем)
  const plank = (x, y, len, h, n) => {
    if (tex) c.drawImage(tex, (seed + n * 53) % (tex.width - len - 1), (((seed + n * 7) % 24) * 16) % (tex.height - 16), Math.max(1, len), 12, x, y, len, h);
    else rect(x, y, len, h, '#8a5a34');
    rect(x, y + h - 1, len, 1, '#1a0f08'); rect(x, y, len, 1, 'rgba(255,230,180,0.35)');
  };
  const post = (x, y0, y1) => {                                   // вертикальная стойка из доски, повёрнутой на 90°
    const h = y1 - y0; if (h <= 0) return;
    c.save(); c.translate(Math.round(x), Math.round(y1)); c.rotate(-Math.PI / 2);
    if (tex) c.drawImage(tex, (seed * 3) % (tex.width - h - 1), 32, h, 12, 0, 0, h, 4); else rect(0, 0, h, 4, '#8a5a34');
    c.restore();
    rect(x - 1, y0, 1, h, '#1a0f08'); rect(x + 4, y0, 1, h, '#1a0f08');
  };
  const brace = (x0, y0, x1, y1) => {                             // косая связь с тёмной обводкой
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
    for (let i = 0; i <= n; i++) { const f = i / n, x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f; rect(x - 1, y - 1, 4, 4, '#1a0f08'); }
    for (let i = 0; i <= n; i++) { const f = i / n, x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f; rect(x, y, 2, 2, i % 5 === 0 ? '#c89a64' : '#8a5a34'); }
  };
  const decks = [];
  for (let ly = gy - 14; ly > poleTop + 2; ly -= 14) decks.push(ly);
  // боковая стена: стойки по глубине, настилы-параллелограммы, раскосы
  const sx0 = fx + fw, nSide = Math.max(1, b.h);
  if (sk > 0) {
    const sp = [];
    for (let q = 0; q <= nSide; q++) { const f = q / nSide; sp.push([Math.round(sx0 + f * fh * sk), -f * fh * dk]); }
    for (const [x, dy] of sp.slice().reverse()) post(x, poleTop + dy, gy + dy);
    for (let d = 0; d + 1 < decks.length; d++) for (let q = 0; q < nSide; q++) if ((d + q) % 2 === 0) brace(sp[q][0] + 3, decks[d + 1] + sp[q][1] + 2, sp[q + 1][0], decks[d] + sp[q + 1][1]);
    for (const ly of decks) {
      c.save(); c.transform(sk, -dk, 0, 1, sx0, ly);
      if (tex) c.drawImage(tex, (seed * 5 + ly * 11) % (tex.width - fh - 1), ((ly * 3) % 20) * 16 % (tex.height - 16), fh, 12, 0, -2, fh, 6); else { c.fillStyle = '#8a5a34'; c.fillRect(0, -2, fh, 6); }
      c.fillStyle = '#1a0f08'; c.fillRect(0, 3, fh, 1); c.fillStyle = 'rgba(255,230,180,0.35)'; c.fillRect(0, -2, fh, 1);
      c.restore();
    }
  }
  // фасад
  const poles = [];
  for (let q = 0; q <= b.w; q++) poles.push(Math.round(fx + 1 + q * (fw - 6) / b.w));
  for (const lx of poles) post(lx, poleTop, gy);
  for (let d = 0; d + 1 < decks.length; d++) for (let q = 0; q + 1 < poles.length; q++) {
    if ((d + q) % 2 === 0) brace(poles[q] + 3, decks[d + 1] + 2, poles[q + 1], decks[d]); else brace(poles[q + 1], decks[d + 1] + 2, poles[q] + 3, decks[d]);
  }
  decks.forEach((ly, n) => {
    plank(fx - 2, ly, fw + 4, 5, n);
    rect(fx - 2, ly + 5, fw + 4, 1, 'rgba(0,0,0,0.3)');
  });
  // перила на верхнем настиле
  if (decks.length) {
    const ly = decks[decks.length - 1] - 9;
    plank(fx - 2, ly, fw + 4, 3, 99);
    for (const lx of poles) rect(lx, ly, 3, 9, '#1a0f08');
  }
  // полотнища-фартуки на верхних настилах: колышутся, красно-белые
  for (let d = Math.max(0, decks.length - 1); d < decks.length; d++) {
    const ly = decks[d] + 4;
    for (let x = fx + 4, n = 0; x < fx + fw - 6; x += 6, n++) {
      const sw = Math.sin(t * 2 + n * 0.9 + b.id) * 1.2, hh = 7 + (n % 2) + Math.round(sw);
      rect(x, ly, 6, hh, '#2a1a10'); rect(x + 1, ly, 4, hh - 1, n % 2 ? '#f0e6d0' : '#b83c2c'); rect(x + 1, ly, 4, 1, n % 2 ? '#ffffff' : '#d86a50');
    }
  }
  // подъёмный журавль с ведром на верхнем настиле
  if (decks.length) {
    const cx = poles[poles.length - 1] + 1, cy = Math.min(decks[decks.length - 1], poleTop + 16) - 2;
    rect(cx, cy - 12, 2, 12, '#3a2414'); rect(cx - 1, cy - 14, 14, 2, '#3a2414'); rect(cx, cy - 13, 12, 1, '#c89a64');
    const bob = Math.sin(t * 2.4 + b.id) * 1.5, ry = cy - 12 + bob;
    rect(cx + 10, cy - 12, 1, ry - cy + 24, '#e4ddd2');
    rect(cx + 7, cy + 11 + bob, 7, 5, '#2a1a10'); rect(cx + 8, cy + 11 + bob, 5, 4, '#7a5632'); rect(cx + 8, cy + 11 + bob, 5, 1, '#b08a58');
  }
  // материалы: аккуратные штабели справа у входа (камень — блоки пирамидкой, брёвна — стопка досок)
  let sx = fx + fw - 8;
  const nSt = b.upg.stock.stone, nTi = b.upg.stock.timber;
  if (nSt > 0) {
    let left = nSt, row = 0;
    while (left > 0) {
      const cnt = Math.min(left, Math.max(1, 4 - row)); left -= cnt;
      const w0 = cnt * 8;
      for (let n = 0; n < cnt; n++) {
        const bx = sx - w0 + n * 8 + row * 4, by = gy - 2 - row * 6;
        rect(bx - 1, by - 6, 9, 7, '#26221e'); rect(bx, by - 5, 7, 5, '#9e958a'); rect(bx, by - 5, 7, 1, '#d4ccbf'); rect(bx + 5, by - 4, 2, 4, '#7a7268'); rect(bx + 2, by - 2, 2, 1, '#867d72');
      }
      row++;
    }
    sx -= Math.min(nSt, 4) * 8 + 6;
  }
  if (nTi > 0) {
    for (let n = 0; n < nTi; n++) {
      const col = n % 3, row = (n / 3) | 0, bx = sx - 22 + col * 7, by = gy - 2 - row * 5;
      rect(bx - 1, by - 5, 9, 6, '#2e1a0a'); rect(bx, by - 4, 7, 4, '#cc9a64'); rect(bx, by - 4, 7, 1, '#ecc48a'); rect(bx, by - 2, 7, 1, '#a06840');
    }
  }
}
