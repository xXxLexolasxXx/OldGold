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
  stable: ['Конюх растит лошадей. Лошадь с телегой — извозчик: везёт сразу кучу груза и не жалуется, потому что жаловаться некому.', 'Конюшня с чердаком: лошади довольнее, конюх спит на сене и называет это апартаментами. Арендную плату берёт с себя же.'],
  woodcutter: ['Избушка лесоруба. Рубит деревья, сажает новые — экологи плачут, но тихо, потому что у лесоруба топор.', 'Лесоруб купил вторую пилу и вдвое больше уверенности: брёвен за раз вдвое больше, пальцев — пока столько же.'],
  sawmill: ['Распиливает брёвна на доски. Опилки — это тоже еда, если очень надо, и плотник проверял.', 'Лесопилка с мощным колесом: пилит на четверть быстрее и сильнее кричит. Соседи считают, что это одно и то же.'],
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
  armory: ['Шьёт кожаные доспехи для будущей армии, которой никто не видел. Доспехи видели все — они пылятся на складе.', 'Мастерская с наковальней: шьёт и клепает быстрее, а армия всё равно «в планах». Планы хранятся рядом с доспехами.'],
  crystalmine: ['Добывает магические камни. Камни светятся — шахтёр делает вид, что не боится, а камни делают вид, что не светятся. Договорились.', 'Шахта с кристальной крепью: камней больше, света больше, здравого смысла — как раньше, то есть по минимуму.'],
  magiccircle: ['Камни отдают силу в банки маны. Работает сам, как и положено нормальной магии: ни работника, ни зарплаты, ни благодарности.', 'Круг с рунным ободом: из камня теперь две банки маны. Алхимики в шоке, чародей — в плюсе, камни — в банках.'],
  ironmine: ['Добывает железную руду. Скала считает это личным оскорблением и ржавеет в ответ, но шахтёр упрям: у него вагонетка и отпуск не скоро.', 'Рудник с рельсами и воротом: руды за заход вдвое больше, а скала ржавеет ещё обиднее. Шахтёр получил каску и считает себя инженером.'],
  smeltery: ['Домница с мехами: брёвна на входе, слитки на выходе, копоть везде. Металлург утверждает, что так и задумано.', 'Домница с двойным дутьём: новый рецепт выжимает из руды больше слитков на то же полено. Копоти не стало меньше, зато теперь она эффективная.'],
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
  armory:        { cost: { timber: 3, stone: 4 } },
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

// Общий закон уровня 2: циклы на четверть быстрее, склады у здания в полтора раза вместительнее
const scaleCaps = o => { if (!o) return o; const r = {}; for (const g in o) r[g] = Math.ceil(o[g] * 1.5); return r; };

for (const t in DESCS) if (BUILDINGS[t]) { BUILDINGS[t].desc = DESCS[t][0]; BUILDINGS[t].desc2 = DESCS[t][1]; BUILDINGS[t].up = LEVEL2[t]; }

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

function canUpgrade(b) { return b.state === 'done' && !b.removed && (b.level || 1) < 2 && !!b.def.up && !b.isRoad; }

// Достройка — настоящая стройка: материалы везут трудяги, работяга по кирпичику надстраивает
// здание, пока идёт стройка, производство стоит.
function startUpgrade(b) {
  if (!canUpgrade(b) || b.upg) return false;
  const cost = b.def.up.cost, total = Object.values(cost).reduce((a, n) => a + n, 0);
  b.upg = { cost, total, used: emptyGoods(), stock: emptyGoods(), usedN: 0, hits: 0, maxHits: Math.max(1, total * HITS_PER_UNIT), builder: null };
  b.builder = null;
  b._usite = null;
  toast(`«${b.def.name}»: начата достройка до уровня 2`, b);
  logEvent('build', `«${b.def.name}»: начата достройка до уровня 2`, b.doorX + 0.5, b.doorY);
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
  while (!b.removed && b.upg && u.job === b) {
    if (u.wantsEat() && findInn(u)) break;
    const U = b.upg, g = ['trunk', 'timber', 'stone'].find(k => U.stock[k] > 0);
    if (g) {
      U.stock[g]--; U.used[g]++; U.usedN++;
      for (let k = 0; k < HITS_PER_UNIT && !b.removed && b.upg; k++) { yield { wait: HIT_TIME, anim: 'build' }; if (b.upg) { b.upg.hits++; b.lastHit = Game.time; } }
      if (b.removed || !b.upg) break;
      if (U.usedN >= U.total) { finishUpgrade(b); break; }
    } else yield { wait: 1 };
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
  b.level = 2;
  b.def = levelDef(b.type);
  // новые рецепты — в конец списка, прежние галочки остаются
  while (b.recipeOn.length < (b.def.recipes || []).length) b.recipeOn.push(true);
  if (!silent) {
    b.dmg = 0;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    fxBurst(cx * TILE, cy * TILE, 30, ['#d8b070', '#a0703a', '#e8cc90', '#cfc7b4'], 90, 60, 0.9, 2.4, 240);
    floater(cx, b.y - 1, 'Уровень 2!', '#ffe08a');
    logEvent('build', `«${BUILDINGS[b.type].name}» достроено до уровня 2`, cx, cy);
    toast(`«${BUILDINGS[b.type].name}» достроено до уровня 2`, b);
    sfxAt('build', cx * TILE, cy * TILE);
  }
  return true;
}

// ---------- Облик уровня 2 ----------
// Поверх готового спрайта: каменный цоколь, мансарда с тёплым окном на коньке крыши,
// красно-золотой вымпел и фонарь у двери. У каждого типа своя пропорция, цвета слегка разные.

function buildingSprite(type, rot = 0, level = 1) {
  const lv = level >= 2 && BUILDINGS[type].up ? 2 : 1;
  if (lv < 2 && NO_GREEN.has(type)) return buildingSpriteBase(type, rot);
  const d = bDims(type, rot);
  const key = type + ':' + d.rot + (lv === 2 ? ':L2' : ':G');
  if (SPR.buildings[key]) return SPR.buildings[key];
  const base = buildingSpriteBase(type, rot, lv);
  const cv = mkCanvas(base.canvas.width, base.canvas.height), c = cv.getContext('2d');
  c.drawImage(base.canvas, 0, 0);
  c.imageSmoothingEnabled = false;
  // Рисуем в пикселях готового арта (их втрое больше мировых): все детали — тем же пикселем,
  // что и само здание, с 1-px тёмным контуром.
  const k = base.canvas.width / base.w;
  const rnd = mulberry32(hashStr(type + 'L2'));
  const px = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const OUT = '#1a100a';
  if (lv === 2) {
    const roofCols = ['#8a3a28', '#5a6a8a', '#3e6a4a', '#7a5a3a'], rc = roofCols[Math.floor(rnd() * roofCols.length)];
    const P = (base.perches && base.perches[0]) || [base.padx + base.fw / 2, base.top * 0.4];
    const mx = Math.round(P[0] * k), my = Math.round(P[1] * k) + 20 * k;
    if (!base.tall) {
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
  if (lv === 2 && type === 'ironmine') {
    // копёр над штольней: две стойки, перекладина и железное колесо ворота
    const hx = Math.round((base.doorCx - 34) * k / 1), hy = Math.round((base.baseY - 14) * k);
    for (const sx of [0, 56]) { px(hx + sx - 1, hy - 100, 8, 102, OUT); px(hx + sx, hy - 99, 6, 100, '#6a4a2a'); px(hx + sx, hy - 99, 2, 100, '#a07848'); }
    px(hx - 3, hy - 104, 68, 10, OUT); px(hx - 2, hy - 103, 66, 8, '#7a5632'); px(hx - 2, hy - 103, 66, 2, '#b08a58');
    px(hx + 22, hy - 126, 20, 22, OUT); px(hx + 24, hy - 124, 16, 18, '#8a909c'); px(hx + 28, hy - 120, 8, 10, '#2a2c34'); px(hx + 24, hy - 124, 16, 3, '#c4cad4');
    px(hx + 31, hy - 100, 2, 56, '#2a2018');
  }
  if (lv === 2 && type.startsWith('guild_')) {
    // позолоченный щит над входом цвета класса
    const col = GCLS[type.slice(6)].col, gx = Math.round(base.doorCx * k), gy = Math.round((base.baseY - 60) * k);
    px(gx - 14, gy - 2, 30, 36, OUT); px(gx - 12, gy, 26, 30, '#f0c040'); px(gx - 10, gy + 2, 22, 24, col); px(gx - 8, gy + 4, 18, 4, shade(col, 0.25)); px(gx - 8, gy + 26, 18, 2, OUT);
    px(gx - 1, gy + 4, 4, 22, '#f0c040');
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
  const spr = buildingSprite(b.type, b.rot || 0, 2);
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
  // строительные леса до текущей высоты
  const topY = S.top < 1e9 ? oy + S.top / k : fy + fh - 10;
  const poleTop = Math.min(fy + fh - 10, topY - 5);
  for (let q = 0; q <= b.w; q++) {
    const lx = Math.round(fx + 2 + q * (fw - 6) / b.w);
    c.fillStyle = '#583522'; c.fillRect(lx, poleTop, 2, fy + fh - poleTop);
    c.fillStyle = '#a06840'; c.fillRect(lx, poleTop, 1, fy + fh - poleTop);
  }
  for (let ly = fy + fh - 12; ly > poleTop + 2; ly -= 12) {
    c.fillStyle = '#45291a'; c.fillRect(fx, ly + 2, fw, 1);
    c.fillStyle = '#cc9a64'; c.fillRect(fx, ly, fw, 2);
  }
  // сложенные у стены материалы
  let mx = fx + 4; const my = fy + fh - 3;
  for (const g of ['timber', 'stone']) for (let n = 0; n < b.upg.stock[g]; n++, mx += 6) {
    c.fillStyle = g === 'timber' ? '#583522' : '#3a3632'; c.fillRect(mx - 1, my - 5, 7, 6);
    c.fillStyle = g === 'timber' ? '#cc9a64' : '#9e958a'; c.fillRect(mx, my - 4, 5, 4);
  }
}
