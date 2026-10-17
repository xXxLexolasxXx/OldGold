'use strict';
// Второй уровень зданий: достройка за товары со склада, новый облик и новые возможности.
// Здание хранит ссылку на свой def: у уровня 2 это производный описатель (levelDef).

// Сарказм по зданиям: [уровень 1, уровень 2]
const DESCS = {
  storehouse: ['Большой каменный амбар. Хранит всё и никому не объясняет, почему именно так.', 'Склад с пристройкой: места стало больше, а порядка — всё равно как было. Внутрь помещается до 8 трудяг, снаружи — их начальство.'],
  school: ['Школа с колокольней. Учит за 1 золото — рекордно дешёвое образование, никаких стипендий.', 'Второй этаж, второй звонок. Учат вдвое быстрее: отличники сдают экзамен, пока двоечник ищет парту.'],
  inn: ['Курица, колбаса, хлеб и пиво — меню от шефа, который ничего другого не умеет. Пьяный может уснуть прямо на дороге.', 'Трактир с мансардой: круассаны, стейки, тёмное пиво и свечи на столах. Цены прежние, амбиции выросли.'],
  bonfire: ['Сюда носят мусор из урн. Сгорая, он даёт пепел — фермы удобряют им поля.', 'Костёр с каменным ободом: жрёт мусор вдвое быстрее и гордится этим на всю округу.'],
  goatpen: ['Пастух приручает диких коз. Ручная коза возит груз — сама, без профсоюза.', 'Загон с сеновалом: коз больше, а сена они едят меньше, потому что воруют соседское.'],
  stable: ['Конюх растит лошадей. Лошадь с телегой — извозчик, везёт сразу кучу груза и не жалуется.', 'Конюшня с чердаком: лошади довольнее, конюх спит на сене и называет это апартаментами.'],
  woodcutter: ['Избушка лесоруба. Рубит деревья, сажает новые — экологи плачут, но тихо.', 'Лесоруб купил вторую пилу и вдвое больше уверенности: брёвен за раз вдвое больше.'],
  sawmill: ['Распиливает брёвна на доски. Опилки — это тоже еда, если очень надо.', 'Лесопилка с мощным колесом: пилит на четверть быстрее и сильнее кричит.'],
  quarry: ['Достаёт камень из земли. Земля обычно против.', 'Каменоломня с краном-журавлём: камня за раз вдвое больше, спина каменотёса — на месте.'],
  goldmine: ['Добывает золотую руду. Жилы обещают всё, но золото — потом.', 'Рудник с вагонетками: копает быстрее. Золота не стало больше, но шахтёры стали важнее.'],
  metallurgist: ['Плавит руду в золото, сжигая брёвна. Лес жалко, зато блестит.', 'Плавильня с двумя горнами: быстрее, жарче, и от гномов снова пахнет подпалённой бородой.'],
  farm: ['Ферма: пшеница и сено. Фермер смотрит на небо, а небо — на фермера.', 'Ферма с большим амбаром: влезает вдвое больше, а шутки про урожай стали вдвое длиннее.'],
  hopfarm: ['Хмельник. Хмелевод утверждает, что работает ради хлеба. Но не ради хлеба.', 'Хмельник с высокой сушильней: больше шишек, и вся деревня знает, зачем.'],
  brewery: ['Варит пиво из зерна и хмеля. Единственное предприятие, чьи отходы приятно пить.', 'Пивоварня с погребом: варит ещё и тёмное пиво — вдвое сытнее и вдвое опаснее для головы.'],
  mill: ['Мельница мелет зерно в муку. Ветер её любит и не берёт денег.', 'Мельница с новыми крыльями: мелет быстрее, а мельник машет им рукой всё чаще.'],
  bakery: ['Печёт хлеб из муки, а хотел бы булочки.', 'Пекарня с мансардой: хлеб остался, но появились круассаны. Пекарь теперь говорит «круассан» и поднимает бровь.'],
  swine: ['Свинарник. Свиньи подрастают на сене, а гномы — на их надеждах.', 'Свинарник с кормушками: вмещает больше свиней, которые лучше не знают, что их ждёт.'],
  butchery: ['Из свиньи — колбаса и шкура. Из мясника — философ.', 'Бойня с коптильней: из одной свиньи — шесть стейков. Свинья недовольна, трактир в восторге.'],
  tannery: ['Выделывает шкуры в кожу. Запах — бесплатное приложение.', 'Дубильня с большими чанами: быстрее, а запах теперь слышно из соседней деревни.'],
  armory: ['Шьёт кожаные доспехи. Для будущей армии, которой никто не видел.', 'Мастерская с наковальней: шьёт и клепает быстрее, а армия всё равно «в планах».'],
  crystalmine: ['Добывает магические камни. Камни светятся — шахтёр делает вид, что не боится.', 'Шахта с кристальной крепью: камней больше, света больше, здравого смысла — как раньше.'],
  magiccircle: ['Камни отдают силу в банки маны. Работает сам, как и положено нормальной магии.', 'Круг с рунным ободом: из камня теперь две банки маны. Алхимики в шоке.'],
  magicworkshop: ['Чародей создаёт посохи и мантии. Волшебство в рассрочку.', 'Мастерская с башенкой-обсерваторией: быстрее и звёздно. Чародей вдохновлён, вдохновение — тоже ресурс.'],
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
    if (u.double) for (const r of o.recipes) r.out = Object.assign({}, r.out, { mana: (r.out.mana || 1) * 2 });
    if (u.addRecipes) for (const r of u.addRecipes) o.recipes.push(Object.assign({}, r));
  }
  o.desc = d.desc2;
  o.level2 = true; o.gatherMult = u.gather || 1; o.storeCap = u.cap || 0; o.trainMult = u.train || 1; o.cozy = !!u.cozy;
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
    const U = b.upg, g = ['timber', 'stone'].find(k => U.stock[k] > 0);
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

function buildingSprite(type, rot = 0, level = 1) {  const lv = level >= 2 && BUILDINGS[type].up ? 2 : 1;  if (lv < 2 && NO_GREEN.has(type)) return buildingSpriteBase(type, rot);  const d = bDims(type, rot);  const key = type + ':' + d.rot + (lv === 2 ? ':L2' : ':G');  if (SPR.buildings[key]) return SPR.buildings[key];  const base = buildingSpriteBase(type, rot, lv);
  const cv = mkCanvas(base.canvas.width, base.canvas.height), c = cv.getContext('2d');
  c.drawImage(base.canvas, 0, 0);
  c.imageSmoothingEnabled = false;
  const k = base.canvas.width / base.w;
  c.scale(k, k);
  const rnd = mulberry32(hashStr(type + 'L2'));
  c.save();
  const roofCols = ['#8a3a28', '#5a6a8a', '#3e6a4a', '#7a5a3a'], rc = roofCols[Math.floor(rnd() * roofCols.length)];
  const px = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); };
  const OUT = '#1a100a';
  if (lv === 2) {
  // цоколь из тёсаного камня вдоль южной стены
  const x0 = base.padx - 1, y0 = base.baseY - 3, w = base.fw + 2;
  px(x0 - 1, y0 - 1, w + 2, 6, OUT); px(x0, y0, w, 4, '#9a9388'); px(x0, y0, w, 1, '#c0b9aa');
  for (let x = x0 + 5; x < x0 + w - 2; x += 9) px(x, y0 + 1, 1, 3, '#6a645a');
  const P = (base.perches && base.perches[0]) || [base.padx + base.fw / 2, base.top * 0.4];
  const mx = P[0], my = P[1] + 20;
  if (!base.tall) {
  // мансарда на коньке крыши
  px(mx - 8, my - 9, 16, 11, OUT); px(mx - 7, my - 8, 14, 9, '#d8b98a'); px(mx - 7, my - 8, 14, 1, '#ecd5ac');
  // крыша мансарды: ступенчатый треугольник
  for (let i = 0; i < 8; i++) { px(mx - 10 + i * 1.2, my - 9 - i, 20 - i * 2.4, 2, OUT); }
  for (let i = 0; i < 8; i++) { px(mx - 9 + i * 1.2, my - 9 - i + 1, 18 - i * 2.4, 1, i < 3 ? rc : '#b55a3c'); }
  px(mx - 3, my - 7, 6, 7, OUT); px(mx - 2, my - 6, 4, 5, '#ffd878'); px(mx - 0.5, my - 6, 1, 5, '#5a3a1e'); px(mx - 2, my - 3.5, 4, 1, '#5a3a1e');
  }
  // вымпел на шесте
  const FX = (base.perches && base.perches[1]) ? base.perches[1] : [mx + 18, P[1] + 4];
  const fx = Math.abs(FX[0] - mx) < 12 ? mx + 20 : FX[0], fy = Math.min(FX[1], P[1]) + 3;
  px(fx, fy - 22, 2, 24, OUT); px(fx, fy - 22, 1, 24, '#6a4a2a');
  c.fillStyle = OUT; c.beginPath(); c.moveTo(fx + 1, fy - 22); c.lineTo(fx + 14, fy - 18); c.lineTo(fx + 1, fy - 13); c.fill();
  c.fillStyle = '#c03030'; c.beginPath(); c.moveTo(fx + 2, fy - 20); c.lineTo(fx + 11, fy - 17.5); c.lineTo(fx + 2, fy - 15); c.fill();
  px(fx + 2, fy - 20, 8, 1, '#f0c040');
  // фонарь у двери
  const lx = base.doorCx + 10, ly = base.baseY - 26;
  px(lx - 1, ly - 7, 4, 9, OUT); px(lx, ly - 6, 2, 6, '#ffd060'); px(lx - 1, ly - 8, 4, 1, '#3a2a1a');
  }
  greenery(c, base, type, px);
  const spr = Object.assign({}, base, { canvas: cv });
  SPR.buildings[key] = spr;
  return spr;
}

// ---------- Зелень на зданиях ----------
// Плющ на стене, ящики с цветами под окнами, на некоторых крышах — мох и травяные кочки.

const NO_GREEN = new Set(['magiccircle', 'bonfire', 'graveyard']);

function greenery(c, base, type, px) {
  const rnd = mulberry32(hashStr(type + 'green'));
  const gs = ['#2f6a2a', '#4a8a34', '#6aa844', '#8cc85a'], OUT = '#16300f';
  const x0 = base.padx, w = base.fw, yb = base.baseY;
  const door = base.doorCx;
  const spotOK = x => Math.abs(x - door) > 14;
  // плющ: свисает от карниза по стене; у склада и трактира — гуще
  if (rnd() < 0.75) {
    let vx = x0 + 6 + rnd() * (w - 20);
    for (let t = 0; t < 8 && !spotOK(vx); t++) vx = x0 + 6 + rnd() * (w - 20);
    const hgt = 14 + Math.floor(rnd() * 16);
    for (let s = 0; s < 3; s++) {
      let x = vx + s * 5 + (rnd() - 0.5) * 3;
      const len = hgt - s * 3;
      for (let y = 0; y < len; y++) {
        x += (rnd() - 0.5) * 0.9;
        px(x, yb - 8 - len + y, 1, 1, OUT);
        if (rnd() < 0.55) { const col = gs[Math.floor(rnd() * 4)]; px(x - 1, yb - 8 - len + y, 3, 2, OUT); px(x - 0.5, yb - 8 - len + y, 2, 1.5, col); }
      }
    }
  }
  // ящик с цветами у стены
  if (rnd() < 0.8) {
    let fx = x0 + 6 + rnd() * (w - 26);
    for (let t = 0; t < 8 && !spotOK(fx) && !spotOK(fx + 14); t++) fx = x0 + 6 + rnd() * (w - 26);
    const cols = [['#e8423a', '#f08070'], ['#f0c840', '#fff0a0'], ['#d070e0', '#f0b0f8'], ['#ffffff', '#f0e8f0']][Math.floor(rnd() * 4)];
    px(fx - 1, yb - 6, 16, 6, OUT); px(fx, yb - 5, 14, 4, '#7a4e2a'); px(fx, yb - 5, 14, 1, '#9a6a3a');
    for (let i = 0; i < 6; i++) {
      const x = fx + 1 + i * 2.3;
      px(x, yb - 9 - (i % 2), 2, 4, '#3f7a2e');
      px(x - 0.5, yb - 10 - (i % 2), 3, 2, OUT); px(x, yb - 10 - (i % 2), 2, 1.5, cols[i % 2]);
    }
  }
  // виноградная лоза по шпалере у входа
  if (rnd() < 0.3) {
    const gx = door + (rnd() < 0.5 ? -26 : 20);
    for (let i = 0; i < 14; i++) { const gy = yb - 10 - i * 1.4; px(gx + Math.sin(i * 0.9) * 3, gy, 1, 1, '#4a3418'); if (i % 2) { px(gx + Math.sin(i * 0.9) * 3 - 1, gy, 3, 2, gs[1 + (i % 3)]); } }
    for (let i = 0; i < 3; i++) { px(gx + 2 + i * 2, yb - 18 + (i % 2), 2, 2, '#6a2a7a'); }
  }
  // мох и дерн на крыше: у каждого третьего дома
  if (rnd() < 0.33 && base.perches && base.perches.length) {
    for (const P of base.perches.slice(0, 2)) for (let i = 0; i < 7; i++) {
      const x = P[0] + (rnd() - 0.5) * 22, y = P[1] + 5 + rnd() * 8, sz = 2 + Math.floor(rnd() * 3);
      px(x - 1, y - 1, sz + 2, 3, OUT); px(x, y - 0.5, sz, 2, gs[Math.floor(rnd() * 4)]);
      if (rnd() < 0.3) px(x + 1, y - 2, 1, 1, '#f8e060');
    }
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
