'use strict';
// Помощь новичку: причина простоя здания, баланс ресурсов в минуту, справка-энциклопедия
// и контекстные подсказки «при первом разе». Всё отдельным файлом, в ядро вшито несколько вызовов:
// Guide.whyHTML (окно здания), Guide.hint (вкладка «Хозяйство»), Guide.statsHTML (она же).

const Guide = { seen: {}, queue: [], cur: null, curT: 0, sample: [], sampleT: -99, sel: null, selWas: null, playT: 0, open: false, cat: 'b', q: '' };

const gLoad = () => { try { Guide.seen = JSON.parse(localStorage.getItem('oldgold-hints') || '{}') || {}; } catch (e) { Guide.seen = {}; } };
const gSave = () => { try { localStorage.setItem('oldgold-hints', JSON.stringify(Guide.seen)); } catch (e) { /* нет хранилища */ } };
const gEsc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- Кто что делает ----------

function producersOf(g) {
  return BUILD_ORDER.filter(t => {
    const d = BUILDINGS[t];
    return (d.outputs && d.outputs[g] != null && !(d.recipes && d.recipes.length && !d.recipes.some(r => r.out[g]) && !d.outputs[g])) || (d.recipes || []).some(r => r.out[g]);
  });
}
function consumersOf(g) {
  const out = BUILD_ORDER.filter(t => {
    const d = BUILDINGS[t];
    return (d.recipes || []).some(r => r.in[g]) || (t === 'swine' && g === 'hay') || (t === 'butchery' && g === 'pig');
  });
  if (FOODS.includes(g) || g === 'beer' || g === 'darkbeer') out.push('inn');
  return [...new Set(out)];
}
const bName = t => BUILDINGS[t] ? BUILDINGS[t].name : t;
const storeHas = g => Game.buildings.reduce((s, b) => s + (b.isStore() ? b.stock[g] : 0), 0);
const hasBuilt = t => Game.buildings.some(b => b.type === t && b.state === 'done');

// ---------- 1. Почему здание стоит ----------

// {t: причина, a: что делать, g: товар для иконки} или null
function whyInfo(b) {
  if (!b || b.isRoad || b.removed) return null;
  if (b.state !== 'done') {
    if (b.problem() === 'noroad') return { t: 'Стройка не соединена дорогой со складом — материалы некому привезти.', a: 'Нажмите «Дорога» (R) и протяните её от склада ко входу здания.', icon: 'road' };
    return siteWhy(b);
  }
  const sw = b.type === 'school' && schoolWhy(b);
  if (sw) return sw;
  const p = b.problem();
  if (!p && b.noDeliver) return { t: 'Доставки закрыты: трудяги сюда ничего не везут.', a: 'Нажмите «Доставки закрыты» в окне здания (клавиша B), чтобы открыть.', icon: 'nodeliver' };
  if (!p) return null;
  if (p === 'paused') return { t: 'Здание на паузе — вы сами так решили.', a: 'Кнопка ⏵ в окне здания или клавиша P.', icon: 'pause' };
  if (p === 'noroad') return { t: 'Вход не соединён дорогой со складом. Трудяги по траве не ходят, у них принципы.', a: 'Нажмите «Дорога» (R) и протяните её от склада ко входу этого здания.', icon: 'road' };
  if (p === 'damaged') return { t: 'Нечисть повредила здание: пока не починят, оно не работает.', a: 'Нужен свободный работяга — он починит сам. Лучше — ещё один в школе.', icon: 'warn' };
  if (p === 'noworker') {
    const w = UNIT_TYPES[b.def.worker].name.toLowerCase();
    const free = Game.units.some(u => u.type === b.def.worker && !u.home && !u.dead && !u.teamOf);
    if (free) return { t: `Свободный ${w} уже есть — сейчас придёт.`, a: 'Если долго: проверьте вкладку «Приоритеты» — не выключена ли эта профессия.', icon: 'noworker' };
    return { t: `Нет рабочего: нужен именно ${w} — работяги и трудяги его не заменят.`, a: 'Откройте вкладку «Жители» или школу и нажмите «Обучить». Обучение стоит 1 золото.', icon: 'noworker' };
  }
  if (p === 'full') {
    const store = Game.buildings.some(x => x.isStore());
    return { t: 'Готовое некуда девать: выход забит, цех встал.', a: store ? 'Проверьте дорогу до склада, не закрыт ли склад для этого товара (вкладка «Склад»), и постройте потребителя или второй склад.' : 'Постройте склад.', icon: 'full' };
  }
  if (p.startsWith('need:')) {
    const g = p.slice(5), name = GOODS[g].name.toLowerCase();
    let a;
    if (g === 'trash') a = 'Мусор жители сами сносят из урн — просто подождите.';
    else if (b.noDeliver) a = 'Доставки закрыты — откройте их (клавиша B).';
    else if (Game.storeBlock[g]) a = `Склад не принимает «${name}» (вкладка «Склад») — разрешите.`;
    else if (storeHas(g) > 0) a = `На складе «${name}» есть — везут, ждите. Если долго: проверьте дорогу и свободных трудяг.`;
    else {
      const pr = producersOf(g).filter(t => !['inn'].includes(t));
      const built = pr.filter(hasBuilt);
      a = built.length ? `Это производит: ${built.map(bName).join(', ')} — проверьте, не стоит ли оно само (значок над ним).`
        : pr.length ? `Постройте: ${pr.slice(0, 2).map(bName).join(' или ')}.` : 'Этого пока негде взять.';
    }
    return { t: `Не хватает: ${name}.`, a, icon: 'g:' + g };
  }
  return null;
}

// Почему стройка стоит — по-настоящему: раньше на любую стройку без работяги писали «Обучите работяг»,
// даже когда свободных работяг полно, а нет материала или все трудяги заняты.
const SITE_MATS = ['trunk', 'timber', 'stone'];
function siteWhy(b) {
  if (b.builder || b.hold) return null;
  if (prioBlocked(b)) return { t: 'Стройки выключены во вкладке «Приоритеты».', a: 'Поставьте «Стройка» на «Авто» или «Высокий».', icon: 'pause' };
  const comp = compAt(b.doorX, b.doorY);
  const left = k => (b.def.cost[k] || 0) - b.usedOf[k];
  const onSite = SITE_MATS.some(k => b.stock[k] > 0), coming = SITE_MATS.some(k => b.incoming[k] > 0);
  const need = SITE_MATS.filter(k => left(k) > b.stock[k] + b.incoming[k]);
  const gone = need.filter(k => !storeHaving(b.doorX, b.doorY, k, comp));
  const people = Game.units.filter(u => !u.dead && !u.teamOf);
  const bTot = people.filter(u => u.type === 'builder').length;
  const bFree = people.filter(u => u.type === 'builder' && u.idleFlag && !u.inside && !u.brk).length;
  const sTot = people.filter(u => u.isCourier).length;
  const sFree = people.filter(u => u.isCourier && u.idleFlag && !u.inside && !u.brk).length;
  if (b.state !== 'site' && !onSite && !coming && gone.length === need.length && need.length) {
    const g = gone[0], name = GOODS[g].name.toLowerCase();
    const pr = producersOf(g).filter(hasBuilt);
    return { t: `Нет материала: ${gone.map(k => GOODS[k].name.toLowerCase()).join(', ')} — на складах этой дорожной сети пусто.`,
      a: storeHas(g) > 0 ? `«${name}» лежит на складе, не связанном дорогой с этой стройкой — протяните дорогу.` : pr.length ? `Это делает: ${pr.map(bName).join(', ')} — проверьте, работает ли.` : `Постройте: ${producersOf(g).slice(0, 2).map(bName).join(' или ')}.`, icon: 'g:' + g };
  }
  if (!bTot) return { t: 'В деревне нет ни одного работяги.', a: 'Обучите работягу в школе (вкладка «Жители»), 1 золото.', icon: 'noworker' };
  if (!bFree) return { t: `Все работяги заняты (${bTot}). Закончат — придут.`, a: 'Быстрее: обучите ещё работяг в школе или поставьте «Стройка» на «Высокий» во вкладке «Приоритеты».', icon: 'noworker' };
  if (need.length && !sFree) return { t: `Материал на складе есть, но все трудяги заняты (свободно 0 из ${sTot}).`, a: 'Работяга сейчас придёт и принесёт сам. Чтобы быстрее — обучите трудяг или поднимите «Стройку» в «Приоритетах».', icon: 'g:' + need[0] };
  return { t: `Работяга уже идёт (свободно ${bFree} из ${bTot}).`, a: 'Подождите немного.', icon: 'noworker' };
}

// Школа с очередью стоит без золота — почему именно и что делать
function goldAnywhere() {
  let n = 0;
  for (const b of Game.buildings) if (b.type !== 'school') n += Math.max(0, b.stock.gold - b.reserved.gold);
  for (const p of Game.piles.values()) n += p.stock.gold;
  for (const u of Game.units) if (u.carry === 'gold') n += u.carryN || 1;
  return n;
}
function schoolWhy(b) {
  if (b.training || !b.queue.length || b.stock.gold >= 1) return null;
  if (b.incoming.gold > 0) return { t: 'Золото уже везут.', a: 'Обучение начнётся, как только трудяга донесёт слиток.', icon: 'g:gold' };
  if (b.noDeliver) return { t: 'Доставки в школу закрыты — золото сюда не везут.', a: 'Нажмите «Доставки закрыты» в окне школы (клавиша B).', icon: 'nodeliver' };
  const comp = compAt(b.doorX, b.doorY);
  if (!storeHaving(b.doorX, b.doorY, 'gold', comp)) {
    if (goldAnywhere() > 0) return { t: 'Золото есть, но не на складе, связанном дорогой со школой.', a: 'Протяните дорогу от школы до склада с золотом или до плавильни.', icon: 'road' };
    return { t: 'Золота нет нигде — школе нечем платить учителю.', a: 'Постройте золотой рудник под скалой и плавильню. Очередь можно очистить кнопкой ниже.', icon: 'g:gold' };
  }
  const serfs = Game.units.filter(u => u.isCourier && !u.dead && !u.teamOf);
  if (!serfs.length) return { t: 'Нет ни одного трудяги, чтобы привезти золото.', a: 'Школа сама возьмёт слиток со склада и выучит трудягу.', icon: 'noworker' };
  return { t: 'Золото на складе есть — его привезут первым же свободным трудягой.', a: 'Если долго: проверьте вкладку «Приоритеты» (трудяги не на «Выкл»).', icon: 'g:gold' };
}

function whyHTML(b) {
  const w = whyInfo(b);
  const link = b && !b.isRoad && b.type ? `<a class="g-link" data-guide="b:${b.type}">Что это за здание?</a>` : '';
  if (!w) return link ? `<div class="why-wrap">${link}</div>` : '';
  const img = w.icon.startsWith('g:') ? iconURL('good', w.icon.slice(2), 2) : iconURL('ui', w.icon, 2);
  return `<div class="why"><img src="${img}" alt=""><div><b>${w.t}</b><div class="why-a">→ ${w.a}</div></div></div>${link}`;
}

// Короткая подсказка к записи вкладки «Хозяйство»
function hintFor(b) {
  const w = b && whyInfo(b);
  return w ? `<div class="alert-a">→ ${w.a}</div>` : '';
}

// ---------- 2. Баланс ресурсов в минуту ----------

function holdings() {
  const h = {};
  for (const g of GOOD_KEYS) h[g] = 0;
  for (const b of Game.buildings) for (const g of GOOD_KEYS) h[g] += b.stock[g] || 0;
  return h;
}

function takeSample() {
  Guide.sample.push({ t: Game.time, p: { ...Game.produced }, h: holdings() });
  if (Guide.sample.length > 30) Guide.sample.shift();     // окно ~2,5 минуты игрового времени
}

// {prod, cons} в минуту по каждому товару; null — рано судить
function rates() {
  const s = Guide.sample;
  if (s.length < 2) return null;
  const a = s[0], z = s[s.length - 1], dt = z.t - a.t;
  if (dt < 20) return null;
  const r = {};
  for (const g of GOOD_KEYS) {
    const prod = Math.max(0, z.p[g] - a.p[g]);
    const cons = Math.max(0, prod - (z.h[g] - a.h[g]));
    r[g] = { prod: prod * 60 / dt, cons: cons * 60 / dt };
  }
  return r;
}

function statsHTML() {
  let h = '<div class="group-title">Баланс в минуту</div>';
  const r = rates();
  if (!r) return h + '<div class="muted small">Считаю… нужно полминуты игрового времени.</div>';
  const need = {};
  for (const b of Game.buildings) { const p = b.state === 'done' && b.problem(); if (p && p.startsWith('need:') && p !== 'need:trash') need[p.slice(5)] = (need[p.slice(5)] || 0) + 1; }
  const rows = [];
  for (const g of GOOD_KEYS) {
    const x = r[g], lack = need[g] || 0;
    if (x.prod < 0.3 && x.cons < 0.3 && !lack) continue;
    rows.push({ g, x, lack, deficit: lack > 0 || (x.cons > x.prod + 0.5 && storeHas(g) < 3) });
  }
  if (!rows.length) return h + '<div class="muted small">Пока ничего не добывается и не тратится. Тишь, гладь, нищета.</div>';
  rows.sort((a, b) => (b.deficit - a.deficit) || (b.x.prod + b.x.cons) - (a.x.prod + a.x.cons));
  h += '<div class="bal">';
  for (const { g, x, lack, deficit } of rows) {
    const f = v => (v < 10 ? Math.round(v * 10) / 10 : Math.round(v)).toString().replace('.', ',');
    h += `<div class="bal-row${deficit ? ' def' : ''}" data-guide="g:${g}" title="${GOODS[g].name}: добыто ${f(x.prod)}/мин, потрачено ${f(x.cons)}/мин, на складе ${storeHas(g)}">${gi(g)}<span class="bn">${GOODS[g].name}</span>`
      + `<span class="bp">+${f(x.prod)}</span><span class="bc">−${f(x.cons)}</span><span class="bs">${storeHas(g)}</span>${deficit ? `<span class="bd">${lack ? 'ждут ' + lack : 'мало'}</span>` : ''}</div>`;
  }
  return h + '</div><div class="muted small">+ добыто, − потрачено (в минуту), справа — на складе. Красное — дефицит. Нажмите на строку — справка.</div>';
}

// ---------- 3. Справка ----------

const SARC_B = {
  storehouse: 'Сюда сносят всё. Что сюда попало — пропало… то есть сохранено.', school: 'Единственное учебное заведение, где «выпуск» — это «пошёл работать».',
  watchtower: 'Дозорный видит нечисть раньше, чем нечисть видит дозорного. В этом и весь расчёт.',
  inn: 'Гномы приходят за хлебом, а уходят за приключениями. И за добавкой.', bonfire: 'Мусор сжигается, пепел идёт в поля. Круговорот гномов в природе.',
  woodcutter: 'Лес большой, лесоруб упорный. Лес пока не жалуется. Вслух.', sawmill: 'Из брёвен делает доски, из тишины — визг.',
  quarry: 'Камни не кончаются. Терпение гномов — да.', farm: 'Пшеница растёт сама. Нет, не сама, но вы туда не ходите.',
  mill: 'Крутится, пока есть зерно. Потом тоже крутится — для вида.', bakery: 'Хлеб — основа всего. Включая настроение.',
  brewery: 'Пиво повышает мораль. И шанс уснуть на дороге.', swine: 'Свиньи едят сено и ни о чём не думают. Завидно.',
  butchery: 'Здесь свинья становится колбасой. Грустно, вкусно.', guild_warrior: 'Тут учат бить врага. И иногда не бить своих.',
  guild_mage: 'Много звёзд, ещё больше счетов за ману.', goldmine: 'Золото любит тех, кто копает. И тех, кто охраняет.', magiccircle: 'Работает сам. Так бы все.',
};
const SARC_CAT = { 'Основа': 'База всего. Без неё всё остальное — просто кучка брёвен.', 'Ресурсы': 'Добыча: тяжело, пыльно, зато честно.', 'Еда': 'Кто кормит гномов — тот и главный.', 'Ремесло': 'Чем сложнее цепочка, тем больше мест, где всё встанет.', 'Магия': 'Мана дорого, но красиво.', 'Гильдии': 'Профессиональные драчуны. За ваш счёт.', 'Оборона': 'Заборы, ворота и ловушки: чтобы нечисть знала своё место — снаружи.' };
const SARC_G = {
  trunk: 'Из них делают доски, дрова и повод для споров с лесом.', timber: 'Без досок гномы строят только планы.', stone: 'На камне стоит всё — дороги, склады и гордость.',
  wheat: 'Зерно: из него хлеб, пиво и корм. Универсальный солдат.', hay: 'Побочный продукт жатвы. Свиньи в восторге.', beer: 'Валюта радости. Расходуется быстрее, чем варится.',
  bread: 'Главная еда. Нет хлеба — начнётся бунт, тихий и голодный.', sausage: 'Свинья, пережившая карьерный рост.', gold: 'Нужно для обучения и гильдий. Утекает, как вода.',
  mana: 'Магия в банках. Хранить подальше от гномов.', iron: 'Тяжёлое, дорогое, для серьёзных дел.', trash: 'Уносят в костёр. Кто-то же должен.', ash: 'Удобрение для полей. Из ничего — урожай.',
};

const CREATURES = [
  ['serf', 'Трудяга', 'Носит товары по дорогам. На 2–3 уровне — по 2–3 предмета и сам берёт материалы на стройку. Не уважает траву.', 'Главный двигатель экономики. Благодарность в штатное расписание не входит.'],
  ['builder', 'Работяга', 'Строит и копает дороги. Его мало — стройки ждут именно его. Обучается в школе за золото.', 'Всё время слышит: «Когда будет готово?». Отвечает ударом молотка.'],
  ['hero', 'Герой', 'Ваш боец и мастер на все руки: строит, чинит, носит еду, защищает от нечисти. Учится классу у главы гильдии. Погиб — возродится у большого костра.', 'Ваш любимчик. Гномы ревнуют.'],
  ['ghost', 'Призрак', 'Приходит ночью, чем больше потерь — тем больше призраков. Пугает гномов. Возле большого костра не появляется. Гномы с фонарём на руках смелее.', 'Бывший житель. Обиды не забывает.'],
  ['skel', 'Скелет', 'Ночная нечисть послабее призрака, но с оружием. Держите воинов у границ деревни и топите костёрами.', 'Умерли — а всё равно ходят на работу. Пример для сотрудников.'],
  ['ent', 'Ходячее дерево', 'Ночью деревья оживают и бродят у своего места. Увидевший гном роняет груз и бежит прятаться или рубить.', 'Лесоруб однажды начал — лес решил закончить.'],
  ['reaper', 'Жнец', 'Забирает павших гномов. Лучше не пересекаться.', 'Работа у него такая. Отпуска нет.'],
  ['fairy', 'Феи, леший, мимики', 'Нейтральные жители леса: могут помочь (исцеление, пыльца, карты) или подставить. Читайте, что они предлагают.', 'Феи — не подарок. Бесплатный сыр, знаете ли.'],
  ['wolf', 'Дикие звери', 'Волки, совы, вороны, кабаны. Волки опасны ночью и за деревней. Вороны любят блестящее — золото на складе тоже.', 'Природа — главный по неприятностям.'],
  ['goat', 'Коза и извозчик', 'Коза (загон) возит по 3 предмета, лошадь с телегой (извозчик) — сразу до 5. Ускоряют дальние доставки.', 'Транспорт с характером.'],
  ['strange', 'Странные гости', 'Студень, лампоглав, часовой, лента, хоровод осколков: с 5-й ночи приходят вместо обычных зверей. Не похожи ни на кого.', 'Что это — никто не знает. Автор тоже.'],
];

const GUIDE_TOPICS = [
  ['hero', 'Герой и бой', 'Клик героем по гильдии — учит классу. Атака — Q. Клик по рекруту — выбор, по земле — пост, по врагу — атака. Полоска здоровья слева; еду герой берёт в трактире, ману — банками. Погиб — возродится у большого костра.', 'Он не бессмертный, просто настойчивый.'],
  ['night', 'Ночь и нечисть', 'Сутки: день → вечер (темнеет, фонари) → ночь с туманом → рассвет. Каждая 5-я ночь длиннее. Возле большого костра (радиус 8 клеток) нечисть не заходит и светло. Падение гнома = разбитый фонарь, он теряется в тумане. Потери растят число призраков и скелетов.', 'Страшно? Так и должно быть.'],
  ['def', 'Оборона', 'Вкладка «Оборона»: частокол и каменная стена (тяните линию), ворота, баррикады, ловушки (яма, шипы, огонь), факелы и сторожевая башня. Стены непроходимы, но вход любого здания закрыть нельзя — ставьте ворота: жители и курьеры проходят всегда, нечисть — когда открыто (щёлкните по воротам: авто / открыты / закрыты). Налётчики Малгора ломают стены, ловушки их ранят, башня стреляет и замечает врага заранее; свободные лучники и воины гильдий сами идут на башню. У большого костра есть кнопка «Обнести частоколом».', 'Забор — лучший друг гнома. Особенно с воротами.'],
  ['food', 'Еда и голод', 'Голодный (сытость ниже 30%) идёт в трактир. Нет еды — падает в обморок и умирает. Цепочки: ферма → мельница → пекарня (хлеб); сено → свинарник → бойня (колбаса); пшеница + хмель → пивоварня.', 'Голодный гном — это сердитый гном, но недолго.'],
  ['roads', 'Дороги и доставки', 'Трудяги ходят только по дорогам. Если вход здания не связан со складом — оно стоит. Дорога в 2 клетки — две полосы. Кнопка «Доставки» в окне здания запрещает возить туда товары (B).', 'Дорога из ниоткуда в никуда — это не дорога, это ландшафтный дизайн.'],
  ['levels', 'Уровни и достройка', 'Трудяги и работяги растут до 3 уровня (нашивки на колпаках). Здания достраиваются до уровня 2: в окне здания кнопка «Достроить» — материалы везут трудяги, пока идёт стройка, производство стоит.', 'Расти можно всем. Кроме зарплаты.'],
  ['ctl', 'Управление: ПК', 'Карта: правая кнопка / WASD, колесо — масштаб. Строить: выберите здание и кликните; Shift — несколько; T — повернуть; R — дорога; Del — снос; P — пауза здания; B — доставки; [ ] — соседнее; Пробел — пауза; H — эта справка.', 'Горячих клавиш больше, чем нервов.'],
  ['mob', 'Управление: телефон', 'Один палец тянет карту, два — масштаб. Коснитесь здания — выбрать; со зданием в руке первое касание показывает место, второе (или ✓) — ставит; ↻ — повернуть. Дорогу ведите пальцем. Вкладки внизу открывают шторку; ▦ — миникарта. Коснулись здания с проблемой — всплывёт причина.', 'Палец один, а жалоб две.'],
];

function guideEntries() {
  const E = [];
  for (const t of BUILD_ORDER) {
    const d = BUILDINGS[t];
    const cost = Object.entries(d.cost).map(([g, n]) => `${n} ${GOODS[g].name.toLowerCase()}`).join(', ');
    let body = `<p>${d.desc}</p><p class="gk">Стоит: ${cost}.${d.worker ? ` Работает: ${UNIT_TYPES[d.worker].name.toLowerCase()}.` : d.auto ? ' Работает сам.' : ''}</p>`;
    const rc = (d.recipes || []).map(r => `${Object.entries(r.in).map(([g, n]) => n + '×' + GOODS[g].name).join(' + ') || 'из недр'} → ${Object.entries(r.out).map(([g, n]) => n + '×' + GOODS[g].name).join(' + ')}`);
    if (rc.length) body += `<p class="gk">${rc.join('<br>')}</p>`;
    E.push({ id: 'b:' + t, cat: 'b', title: d.name, sub: d.cat, body, sarc: SARC_B[t] || SARC_CAT[d.cat] || '', icon: ['b', t] });
  }
  for (const g of GOOD_KEYS) {
    const pr = producersOf(g).map(bName), co = consumersOf(g).map(bName);
    let body = `<p class="gk">Группа: ${GOODS[g].group}.</p>`;
    body += `<p>Делает: ${pr.length ? pr.join(', ') : 'нигде (находка или добыча)'}.<br>Нужен: ${co.length ? co.join(', ') : 'для стройки и обмена'}.</p>`;
    E.push({ id: 'g:' + g, cat: 'g', title: GOODS[g].name, sub: GOODS[g].group, body, sarc: SARC_G[g] || '', icon: ['g', g] });
  }
  for (const [id, title, text, sarc] of CREATURES) E.push({ id: 'c:' + id, cat: 'c', title, sub: 'Существа', body: `<p>${text}</p>`, sarc });
  for (const [id, title, text, sarc] of GUIDE_TOPICS) E.push({ id: 't:' + id, cat: id === 'hero' ? 'h' : id === 'night' ? 'n' : 'k', title, sub: 'Раздел', body: `<p>${text}</p>`, sarc });
  return E;
}

const GUIDE_CATS = [['b', 'Здания'], ['g', 'Ресурсы'], ['c', 'Существа'], ['h', 'Герой'], ['n', 'Ночи'], ['k', 'Как играть']];

function guideEl() {
  let el = document.getElementById('guide');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'guide'; el.className = 'hidden';
  el.innerHTML = `<div class="g-box"><div class="g-head"><b>Справка</b><input id="g-q" type="search" placeholder="Поиск по названию…" autocomplete="off"><button id="g-x" title="Закрыть (Esc)">✕</button></div>
    <div id="g-cats"></div><div id="g-list"></div></div>`;
  (document.getElementById('view') || document.body).appendChild(el);
  el.addEventListener('pointerdown', e => { if (e.target === el) guideClose(); });
  document.getElementById('g-x').onclick = guideClose;
  document.getElementById('g-q').oninput = e => { Guide.q = e.target.value.trim().toLowerCase(); guideRender(); };
  document.getElementById('g-cats').onclick = e => {
    const b = e.target.closest('[data-gc]'); if (!b) return;
    Guide.cat = b.dataset.gc; Guide.q = ''; document.getElementById('g-q').value = ''; guideRender();
  };
  document.getElementById('g-list').onclick = e => {
    const c = e.target.closest('.g-card'); if (c) c.classList.toggle('open');
  };
  return el;
}

function guideRender(focusId) {
  const all = guideEntries();
  const q = Guide.q;
  document.getElementById('g-cats').innerHTML = GUIDE_CATS.map(([k, n]) => `<button data-gc="${k}" class="${!q && Guide.cat === k ? 'on' : ''}">${n}</button>`).join('');
  const list = q ? all.filter(e => e.title.toLowerCase().includes(q)) : all.filter(e => e.cat === Guide.cat);
  const box = document.getElementById('g-list');
  box.innerHTML = list.length ? list.map(e => {
    const ic = e.icon ? `<img src="${e.icon[0] === 'b' ? buildingIconURL(e.icon[1]) : iconURL('good', e.icon[1], 2)}" alt="">` : '<span class="g-dot"></span>';
    return `<div class="g-card${e.id === focusId ? ' open' : ''}" data-id="${e.id}"><div class="g-t">${ic}<span>${gEsc(e.title)}</span><i>${gEsc(e.sub)}</i></div><div class="g-b">${e.body}${e.sarc ? `<p class="g-s">${gEsc(e.sarc)}</p>` : ''}</div></div>`;
  }).join('') : '<div class="muted small" style="padding:10px">Такого не знаем. Либо не бывает, либо вы придумали.</div>';
  if (focusId) { const c = box.querySelector(`[data-id="${focusId}"]`); if (c) c.scrollIntoView({ block: 'center' }); }
}

function guideOpen(id) {
  const el = guideEl();
  if (id) { const e = guideEntries().find(x => x.id === id); if (e) { Guide.cat = e.cat; Guide.q = ''; } }
  document.getElementById('g-q').value = Guide.q;
  guideRender(id);
  el.classList.remove('hidden'); Guide.open = true;
  if (typeof track === 'function') track('guide-open', 'Открыл справку');
}
function guideClose() { const el = document.getElementById('guide'); if (el) el.classList.add('hidden'); Guide.open = false; }

// ---------- 4. Подсказки «при первом разе» ----------

const HINTS = {
  hunger: { icon: ['good', 'bread'], text: 'Первый голодный! Сытость ниже 30% — гном идёт в трактир. Нет еды — упадёт, а там и до беды. Цепочка: ферма → мельница → пекарня.', ref: 't:food',
    when: () => Game.units.some(u => u.food != null && u.food < HUNGRY && !u.animal && u.type !== 'goat') },
  night: { icon: ['ui', 'warn'], text: 'Темнеет. Ночью выходит нечисть, а гном, упавший без фонаря, теряется в тумане. Держитесь ближе к большому костру: в 8 клетках от него светло и безопасно.', ref: 't:night',
    when: () => isEveningNow() && nightAmt() > 0.1 },
  loss: { icon: ['ui', 'warn'], text: 'Первая потеря. Каждый погибший гном ночью возвращается призраком, и чем больше потерь — тем больше нечисти. Берегите народ и держите костёр.', ref: 'c:ghost',
    when: () => (Game.lostGnomes || 0) > 0 },
  ghost: { icon: ['ui', 'warn'], text: 'Призрак! Он пугает гномов и роняет их груз. У большого костра нечисть не появляется, а воины и герой справятся с остальным.', ref: 'c:ghost',
    when: () => Game.ghosts && Game.ghosts.length > 0 },
  l2: { icon: ['ui', 'play'], text: 'Первое здание второго уровня! Достройка надстраивает здание новыми рецептами, но пока идёт стройка, производство стоит. В окне здания — что нового.', ref: 't:levels',
    when: () => Game.buildings.some(b => b.level === 2) },
  icon: { icon: ['ui', 'noworker'], text: 'Над зданием значок — значит, оно встало. Коснитесь (кликните) здания: в окне будет причина и что делать. Все проблемы собраны во вкладке «Хозяйство».', ref: 't:roads',
    when: () => Guide.playT > 120 && Game.buildings.some(b => b.state === 'done' && b.problem() && b.problem() !== 'paused') },
  prio: { icon: ['ui', 'prio'], text: 'Гномы хватаются не за то? Вкладка «Приоритеты»: что делать в первую очередь (еда, стройка, дрова, оборона) и кого отключить. «Авто» — как раньше, ничего трогать не обязательно. А на паузе (Пробел) можно спокойно расставить дороги и здания.',
    when: () => Guide.playT > 480 && Game.buildings.filter(b => b.state === 'done').length >= 10 },
  gest: { icon: ['ui', 'scroll'], text: 'Телефон: один палец — карта, два — масштаб, касание здания — выбрать, со зданием в руке касание показывает место, второе — ставит. Дорогу ведите пальцем.', ref: 't:mob',
    when: () => Mobile && Mobile.on && Guide.playT > 40 },
};

function hintEl() {
  let el = document.getElementById('hint');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'hint'; el.className = 'hidden';
  (document.getElementById('view') || document.body).appendChild(el);
  el.addEventListener('click', e => {
    const a = e.target.closest('button'); if (!a) return;
    const ref = el.dataset.ref;
    hintHide();
    if (a.dataset.h === 'more' && ref) guideOpen(ref);
  });
  return el;
}
function hintHide() { const el = document.getElementById('hint'); if (el) el.classList.add('hidden'); Guide.cur = null; }

function hintShow(id) {
  const h = HINTS[id], el = hintEl();
  Guide.seen[id] = 1; gSave();
  Guide.cur = id; Guide.curT = 0;
  el.dataset.ref = h.ref || '';
  const img = h.icon[0] === 'good' ? iconURL('good', h.icon[1], 2) : iconURL('ui', h.icon[1], 2);
  el.innerHTML = `<img src="${img}" alt=""><div class="h-t">${h.text}</div><div class="h-b"><button data-h="more">Справка</button><button data-h="ok">Понятно</button></div>`;
  el.classList.remove('hidden');
  if (typeof track === 'function') track('hint-' + id, 'Подсказка: ' + id);
}

// Можно ли сейчас показывать подсказки: не мешаем меню, загрузке, обучению и справке
function hintsAllowed() {
  if (Guide.open) return false;
  if (typeof StartMenu !== 'undefined' && StartMenu.open) return false;
  if (typeof Tut !== 'undefined' && Tut.on) return false;
  if (!Game.units || !Game.units.length || Game.stress) return false;
  return true;
}

// ---------- Общий тик (раз в ~0,5 с реального времени) ----------

function guideTick() {
  if (!hintsAllowed()) { if (Guide.cur && Guide.open) hintHide(); return; }
  if (!Game.paused) Guide.playT += 0.5 * Game.speed;
  if (Game.time - Guide.sampleT >= 5 || Game.time < Guide.sampleT) {
    if (Game.time < Guide.sampleT) Guide.sample = [];    // загрузили сохранение или новую карту
    Guide.sampleT = Game.time; takeSample();
  }
  if (Guide.cur) {
    Guide.curT += 0.5;
    if (Guide.curT > 16) hintHide();
  } else {
    for (const id in HINTS) if (!Guide.seen[id] && HINTS[id].when()) { hintShow(id); break; }
  }
  // на телефоне окно здания спрятано в шторке: причину простоя показываем всплывашкой
  const s = Game.selected;
  if (s !== Guide.selWas) {
    Guide.selWas = s;
    if (s && !s.isRoad && Mobile && Mobile.on) { const w = whyInfo(s); if (w) toast(w.t + ' ' + w.a, s); }
  }
}

function initGuide() {
  gLoad();
  setInterval(() => { try { guideTick(); } catch (e) { console.error(e); } }, 500);
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-guide]');
    if (!t) return;
    const v = t.dataset.guide;
    guideOpen(v === 'open' ? null : v);
  });
  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.code === 'KeyH') { if (Guide.open) guideClose(); else guideOpen(); }
    if (e.code === 'Escape' && Guide.open) guideClose();
  });
}

window.Guide = Object.assign(Guide, { whyHTML, hint: hintFor, statsHTML, open: false, openBook: guideOpen });
window.addEventListener('load', () => setTimeout(initGuide, 100));
