'use strict';
// Случайные события-дилеммы (как в RimWorld/Frostpunk): раз в пару суток у деревни появляется окошко с историей
// и 2–3 вариантами решения. У каждого варианта есть цена, последствия (ресурсы, настроение, отношения с феями,
// лесными нейтралами, гильдиями и купцами, жители, герой) и, бывает, шанс побочки. Одни события тянут за собой другие (цепочки).
// Условия показа: ночь/день, размер деревни, сезон, нужен ли герой/торговый пост/гильдия, отношения, флаги прошлых решений.
// Состояние — Game.dil (пишется в сохранение). Журнал решений — вкладка «Журнал» → фильтр «Решения».
// Кооп: событие выбирает и считает сервер; решение — голосованием (большинство) или за хоста, это настройка (хост, кнопка в окне);
// клиентам идёт зеркало mir.dil, ответ — сообщение {t:'dil', seq, i}. Время на ответ в коопе — DIL_VOTE_T секунд, потом «ничего не делать».
// Согласовано: «Торговля» (купцы: отношения меняют цены, события двигают цены/зовут караван), «Сценарий» (не выходим поверх заставок,
// не мешаем итоговому экрану), «Враг» (не во время осады; чем ближе Малгор, тем реже весёлые события).

const DIL_GAP = 2;               // не чаще раза в столько суток
const DIL_VOTE_T = 120;          // на коопе: сколько секунд даётся на голосование
const DIL_CALM = 8;              // сколько секунд должно быть спокойно (нет боя), прежде чем показать окно
const DIL_REL = { fairy: 'Феи', neutral: 'Лесные', guilds: 'Гильдии', traders: 'Купцы' };
const DIL_RAR = ['', 'обычное', 'необычное', 'редкое'];
const DIL_SEASONS = ['весна', 'лето', 'осень', 'зима'];

// ---------- Данные событий ----------
// id, t — заголовок, ic — значок, r — редкость (1–3), d — история, c — условия, o — варианты.
// Вариант: t — название, cost — цена (ресурсы), fx — последствия, risk {p, fx, out} — шанс побочки, out — что вышло, def — «по умолчанию».
// c: night (true — вечер/ночь, false — только день, 'any'), pop [мин, макс], season [..], hero, post, guild, relMin/relMax {rel:n}, flag, noFlag, once, chainOnly, day (мин. сутки)
// fx: res {товар: ±n}, mood ±n, rel {fairy|neutral|guilds|traders: ±n}, people ±n, heroHp ±n, flag, chain [id, мин. суток, макс.], price {goods, f, min}, caravan
const DIL_EVENTS = [
  { id: 'trader', t: 'Бродячий торговец', ic: 'trade', r: 1, c: {},
    d: 'К воротам подкатил торговец с тележкой и честными глазами. В тележке — «эликсир бодрости», который, по его словам, пьёт сам король. Король, видимо, пьёт нечасто.',
    o: [{ t: 'Купить эликсир', cost: { gold: 3 }, fx: { mood: 1 }, risk: { p: 0.35, fx: { mood: -2 }, out: 'Эликсир оказался настоем лопуха на честном слове.' }, out: 'Выпили всей бригадой. Бодрость — какая-то есть, изжога — точно.' },
      { t: 'Выменять на хлеб', cost: { bread: 6 }, fx: { res: { gold: 4 }, rel: { traders: 1 } }, out: 'Торговец ушёл с хлебом, мы — с монетами. Все довольны, и это подозрительно.' },
      { t: 'Прогнать', def: 1, fx: { rel: { traders: -1 } }, out: 'Тележка скрипнула и уехала. Торговец обещал рассказать всем, какие вы гостеприимные.' }] },
  { id: 'fugitives', t: 'Беглецы-гномы', ic: 'people', r: 1, c: { pop: [5, 60] },
    d: 'Трое гномов в рваных плащах просят приюта: сбежали от барона, который «слегка» задерживал жалованье — лет на девять.',
    o: [{ t: 'Принять всех', cost: { bread: 6, beer: 2 }, fx: { people: 3, mood: 1, chain: ['baron_envoy', 2, 4] }, risk: { p: 0.25, fx: { res: { gold: -3 } }, out: 'Один из новичков оказался карманником.' }, out: 'Новые руки, новые рты. Склад вздохнул, но не возразил.' },
      { t: 'Принять одного, мастера', cost: { bread: 3 }, fx: { people: 1, chain: ['baron_envoy', 3, 5] }, out: 'Остальные ушли дальше, обругав вас на трёх диалектах.' },
      { t: 'Отказать', def: 1, fx: { mood: -1 }, out: 'Ушли в сторону леса. Совесть сказала «ну ладно» и пошла спать.' }] },
  { id: 'chest', t: 'Подозрительный сундук', ic: 'store', r: 1, c: {},
    d: 'На дороге стоит сундук. Один. Без замка. И с табличкой «Не открывать» — написано кривым почерком, будто для убедительности.',
    o: [{ t: 'Открыть самим', fx: { res: { gold: 6 } }, risk: { p: 0.4, fx: { heroHp: -14, mood: -1 }, out: 'Сундук оказался мимиком и укусил за ногу. Ногу героя — гномы просто смотрели.' }, out: 'В сундуке золото. В табличке — ложь.' },
      { t: 'Послать героя проверить', req: 'hero', fx: { res: { gold: 3 } }, risk: { p: 0.15, fx: { heroHp: -10 }, out: 'Что-то кусается, но герой справился.' }, out: 'Герой вернулся с мешочком и видом знатока.' },
      { t: 'Обойти стороной', def: 1, out: 'Мудро. Скучно, но мудро. Сундук остался ждать следующего любопытного.' }] },
  { id: 'cattle', t: 'Больной скот', ic: 'log_animal', r: 1, c: { pop: [6, 80] },
    d: 'Свиньи грустны, куры мрачны, а гусь, как обычно, зол. Знахарь говорит — «поветрие». Знахарь — это ваш повар, но другого нет.',
    o: [{ t: 'Лечить отваром', cost: { beer: 3, bread: 2 }, fx: { mood: 1 }, out: 'Скотина выздоровела, повар зазнался.' },
      { t: 'Пустить на колбасу', fx: { res: { sausage: 8, hide: 3 }, mood: -1 }, risk: { p: 0.3, fx: { mood: -1 }, out: 'Колбаса вышла с привкусом тревоги.' }, out: 'Колбасы на неделю, совесть — на склад.' },
      { t: 'Само пройдёт', def: 1, fx: { mood: -1 }, risk: { p: 0.5, fx: { res: { sausage: -4 } }, out: 'Не прошло. Часть стада прошла мимо нас на тот свет.' }, out: 'Само рассосётся. Поголовье — тоже.' }] },
  { id: 'bard', t: 'Пьяный бард', ic: 'log_gossip', r: 1, c: { night: true },
    d: 'У костра сидит бард в состоянии «почти стоит». Знает четыреста песен, и все — про вас, причём в невыгодном свете.',
    o: [{ t: 'Накормить и напоить', cost: { beer: 3, bread: 2 }, fx: { mood: 2, chain: ['bard_famous', 3, 6] }, out: 'Спел балладу «Как гномы лопату потеряли». Хит сезона.' },
      { t: 'Заплатить за тишину', cost: { gold: 2 }, out: 'Самая выгодная инвестиция недели: бард молчит, а кошелёк просто плачет.' },
      { t: 'Выгнать', def: 1, fx: { mood: -1 }, risk: { p: 0.5, fx: { mood: -1 }, out: 'Бард уходит и сочиняет об этом куплеты. Дрязги обеспечены.' }, out: 'Бард ушёл в ночь, бормоча рифмы к слову «жадины».' }] },
  { id: 'fairy_gift', t: 'Фея просит дар', ic: 'log_tree', r: 1, c: { night: false },
    d: 'Над грядкой завис огонёк размером с кулак: фея требует «дар от чистого сердца». Конкретно — три хлеба. Чистота сердца оценивается на вес.',
    o: [{ t: 'Отдать хлеб', cost: { bread: 3 }, fx: { rel: { fairy: 1 }, res: { magicstone: 1 } }, out: 'Фея куснула краешек и расцвела. На прощание уронила искорку магического камня.' },
      { t: 'Предложить пива', cost: { beer: 2 }, fx: { rel: { fairy: 1 }, mood: 1 }, risk: { p: 0.3, fx: { rel: { fairy: -1 } }, out: 'Фея решила, что её хотят споить.' }, out: 'Фея выпила, икнула и обещала всем добра.' },
      { t: 'Отказать', def: 1, fx: { rel: { fairy: -1 } }, out: 'Фея улетела, оставив немного пыльцы. В глаза. Нашим.' }] },
  { id: 'beast', t: 'Раненый зверь', ic: 'log_animal', r: 1, c: { night: false },
    d: 'У опушки лежит раненый олень. Смотрит так, будто ему уже неловко, что побеспокоил. Рядом шарят волки — делают вид, что просто мимо идут.',
    o: [{ t: 'Выходить', cost: { bread: 2, hide: 1 }, fx: { rel: { neutral: 1 }, mood: 1, chain: ['deer_back', 3, 5] }, out: 'Олень встал, поклонился (по-оленьи) и ушёл в лес. Вернётся — зверь слово держит.' },
      { t: 'Добить на мясо', fx: { res: { sausage: 3, hide: 2 }, rel: { neutral: -1 } }, out: 'Мясо есть. Лес запомнил. Лес вообще злопамятен.' },
      { t: 'Не вмешиваться', def: 1, out: 'Природа сама разберётся. Обычно именно так и говорят перед тем, как природа разбирается с вами.' }] },
  { id: 'guild_quarrel', t: 'Ссора гильдий', ic: 'log_gossip', r: 2, c: { guild: true, pop: [10, 200] },
    d: 'Мастер воинов утверждает, что лучники — трусы. Мастер лучников — что воины не умеют ни считать, ни целиться. Оба, увы, правы.',
    o: [{ t: 'Совместные учения', cost: { beer: 4 }, fx: { rel: { guilds: 1 }, mood: 1 }, out: 'Выпили вместе, подрались, снова выпили. Мир, точнее — перемирие.' },
      { t: 'По бочке каждой', cost: { gold: 2 }, fx: { rel: { guilds: 1 } }, out: 'Бочки закрыли вопрос. Вопрос закрыл бочки.' },
      { t: 'Пусть сами разбираются', def: 1, fx: { rel: { guilds: -1 } }, risk: { p: 0.4, fx: { heroHp: -6 }, out: 'Под горячую руку попал герой.' }, out: 'Разбирались до утра. Утром никто ничего не помнил, а претензии — помнили все.' }] },
  { id: 'treasure', t: 'Находка клада', ic: 'log_gold', r: 2, c: {},
    d: 'Копали выгребную яму, нашли ящик. Копали не зря. Или зря: в ящике карта, и она явно нарисована человеком, который никогда не видел карт.',
    o: [{ t: 'Копать самим', cost: { bread: 3 }, fx: { res: { gold: 8 } }, risk: { p: 0.35, fx: { mood: -1 }, out: 'Нашли ещё три старых сапога. Сапоги, как водится, оказались не нашими.' }, out: 'Монеты! Старые, тёмные, зато настоящие.' },
      { t: 'Отправить героя', req: 'hero', fx: { res: { gold: 10 }, heroHp: -6 }, risk: { p: 0.3, fx: { res: { gold: 6 } }, out: 'И вторая связка нашлась — под первой.' }, out: 'Герой вернулся грязный и счастливый, как положено героям.' },
      { t: 'Продать карту купцу', fx: { res: { gold: 3 }, rel: { traders: 1 } }, out: 'Купец выложил три монеты и поклялся, что искать не будет. Конечно.' }] },
  { id: 'caravan', t: 'Чужой караван', ic: 'trade', r: 2, c: { night: false, day: 2 },
    d: 'Караван без гербов встал в двух шагах от склада. Возницы смотрят на ваши запасы так, как смотрят на пирог.',
    o: [{ t: 'Продать им брёвна', cost: { trunk: 6 }, fx: { res: { gold: 5 }, rel: { traders: 1 } }, out: 'Караван ушёл довольный, брёвна — тоже, а золото — к нам.' },
      { t: 'Сговориться о ценах', cost: { gold: 2 }, fx: { caravan: 1, rel: { traders: 1 } }, out: 'Побратались, пошептались. Следующий караван поспешит.' },
      { t: 'Охрана у ворот', def: 1, risk: { p: 0.3, fx: { res: { bread: -3 } }, out: 'При отъезде что-то незаметно стало легче на три хлеба.' }, out: 'Постояли друг на друга и разъехались без глупостей.' }] },
  { id: 'mage', t: 'Странствующий маг', ic: 'mana', r: 2, c: { pop: [8, 200], night: false },
    d: 'Старик в колпаке просит ночлег и обещает «благодарность по способностям». Способности он не уточняет, и это настораживает.',
    o: [{ t: 'Приютить', cost: { bread: 2, beer: 1 }, fx: { res: { magicstone: 2 }, mood: 1 }, risk: { p: 0.25, fx: { res: { beer: -3 }, mood: -1 }, out: 'Благодарность оказалась пустыми бочками.' }, out: 'Спал прекрасно. Утром оставил камни и странное пятно на потолке.' },
      { t: 'Взять плату вперёд', fx: { res: { gold: 2 }, mood: -1 }, out: 'Заплатил, сморщился, ушёл. Репутация гостеприимных пошла трещинами.' },
      { t: 'Отказать', def: 1, out: 'Старик пробормотал что-то на латыни и повернул козе рога. Мелочь.' }] },
  { id: 'wolves', t: 'Волки у ворот', ic: 'log_night', r: 2, c: { night: true },
    d: 'С опушки смотрят жёлтые глаза. Много. Они вежливо ждут: или мясо, или драка. Они, правда, ничего не говорили, но вы поняли.',
    o: [{ t: 'Бросить мяса', cost: { sausage: 4 }, fx: { rel: { neutral: 1 } }, out: 'Волки съели, повиляли хвостами и ушли. Хвост, оказывается, у них не только для красоты.' },
      { t: 'Отпугнуть огнём', cost: { trunk: 3 }, fx: { mood: 1 }, risk: { p: 0.3, fx: { heroHp: -6 }, out: 'Один волк не оценил огонь, зато оценил героя.' }, def: 1, out: 'Факелы, крики, дым. Волки ушли, гномы остались, как ни странно.' },
      { t: 'Отправить героя', req: 'hero', fx: { res: { hide: 4 }, heroHp: -10, rel: { neutral: -1 } }, out: 'Шкуры добыты, лес недоволен, а герой — хромает с гордостью.' }] },
  { id: 'cold', t: 'Лютый холод', ic: 'log_night', r: 1, c: { season: [3] },
    d: 'Мороз такой, что даже ругательства замерзают на лету и падают на ногу.',
    o: [{ t: 'Топить щедро', cost: { trunk: 6 }, fx: { mood: 1 }, out: 'Тепло и дымно. Гномы довольны, брёвна — меньше.' },
      { t: 'Греться пивом', cost: { beer: 4 }, fx: { mood: 1 }, risk: { p: 0.5, fx: { mood: -1 }, out: 'Согрелись настолько, что утром никто ничего не помнит.' }, out: 'Метод старый, надёжный и немного печальный.' },
      { t: 'Терпеть', def: 1, fx: { mood: -2 }, risk: { p: 0.3, fx: { heroHp: -6 }, out: 'Герой простудился и чихает героически.' }, out: 'Терпели. Зубы стучали — оркестр.' }] },
  { id: 'harvest', t: 'Страда', ic: 'log_food', r: 1, c: { season: [2] },
    d: 'Пшеница выросла, как на дрожжах, и, судя по запаху, дрожжи тоже были не лишние.',
    o: [{ t: 'Праздничный сбор', cost: { beer: 2 }, fx: { res: { wheat: 10 }, mood: 1 }, out: 'С песнями и пивом собирали бодро. Собрали даже кое-что из пива.' },
      { t: 'Нанять сезонников', cost: { gold: 3 }, fx: { res: { wheat: 16 } }, out: 'Платишь — и урожай целый. Платить всегда приятнее, когда не ты платишь.' },
      { t: 'Как обычно', def: 1, fx: { res: { wheat: 5 } }, out: 'Собрали, сколько собралось. Остальное осталось на поле на радость воронам.' }] },
  { id: 'heat', t: 'Летняя жара', ic: 'log_gossip', r: 1, c: { season: [1] },
    d: 'Жара такая, что кузнецы просят прохладу, а пекарь — перевод в зимний сектор.',
    o: [{ t: 'Холодное пиво всем', cost: { beer: 3 }, fx: { mood: 2 }, out: 'Рабочий день закончился на удивление рано. Зато песен — на весь вечер.' },
      { t: 'Сиеста', fx: { mood: 1 }, risk: { p: 0.5, fx: { res: { gold: -2 } }, out: 'Проспали торговца с выгодной сделкой.' }, out: 'Все спали под деревьями. Деревья, впрочем, тоже.' },
      { t: 'Терпеть', def: 1, fx: { mood: -1 }, out: 'Терпели. Ругались шёпотом, чтобы не нагреваться.' }] },
  { id: 'mud', t: 'Весенняя распутица', ic: 'build', r: 1, c: { season: [0] },
    d: 'Дороги превратились в кашу. Гномы идут медленно, ругаются быстро.',
    o: [{ t: 'Настелить мостки', cost: { timber: 4 }, fx: { mood: 1, flag: 'mosty' }, out: 'Мостки держатся и скрипят в такт шагам. Музыкально.' },
      { t: 'Вычерпать по одному', fx: { mood: -1 }, out: 'Вычерпали. Сапоги — нет.' },
      { t: 'Ждать, пока высохнет', def: 1, risk: { p: 0.4, fx: { mood: -1 }, out: 'Не высохло. Зато самый пафосный гном упал красиво.' }, out: 'Подождали. Грязь подождала в ответ.' }] },
  { id: 'inspector', t: 'Налоговый инспектор', ic: 'scroll', r: 2, c: { pop: [25, 500] },
    d: 'Из соседнего баронства прибыл человек в чёрном: «По слухам, у вас завелась деревня размером с город. Налоги.»',
    o: [{ t: 'Откупиться', cost: { gold: 8 }, out: 'Заплатили. Инспектор вежливо улыбнулся — так, что кошелёк вздрогнул.' },
      { t: 'Угостить и убедить', cost: { beer: 4, sausage: 3 }, fx: { rel: { traders: 1 }, mood: 1 }, risk: { p: 0.35, fx: { res: { gold: -6 } }, out: 'Уговорил — но и себе в карман что-то положил.' }, out: 'Инспектор ушёл довольный, а в протоколе вышло «налогов нет, гномы милые».' },
      { t: 'Выставить за ворота', def: 1, fx: { mood: 1, chain: ['baron_envoy', 2, 4] }, out: 'Народ в восторге. Барон в курсе. Завтра узнаем, насколько в курсе.' }] },
  { id: 'lost_kid', t: 'Потерявшийся гномик', ic: 'people', r: 1, c: { pop: [0, 14] },
    d: 'У ворот сидит маленький гном и жуёт чужой сухарь. Говорит, что потерялся. Хотя в голосе — уверенность человека, который всё спланировал.',
    o: [{ t: 'Оставить, вырастим', cost: { bread: 2 }, fx: { people: 1, mood: 1 }, out: 'Мелочь быстро освоилась и уже учит взрослых жизни.' },
      { t: 'Вернуть родителям', cost: { bread: 2 }, fx: { res: { gold: 2 }, rel: { traders: 1 } }, out: 'Родители рыдали от счастья и подарили пару монет. Сухарь — не вернули.' },
      { t: 'Не наше дело', def: 1, fx: { mood: -1 }, out: 'Чужой сухарь жалко, ребёнка почему-то тоже.' }] },
  { id: 'baron_envoy', t: 'Посланец барона', ic: 'scroll', r: 2, c: { chainOnly: true },
    d: 'Приехал посланец барона: «Верните беглых». Обещает награду, угрожает последствиями. Последствия звучат убедительнее награды.',
    o: [{ t: 'Отказать', fx: { mood: 2 }, risk: { p: 0.3, fx: { res: { gold: -5 } }, out: 'Выписали штраф за «укрывательство трудящихся».' }, out: 'Гномы в восторге: свои не выдаём. Посланец уехал, пообещав вернуться, как все посланцы.' },
      { t: 'Выдать одного', fx: { people: -1, res: { gold: 8 }, mood: -2 }, out: 'Золото есть, настроение — нет. Выдали самого тихого. Он тоже был тих.' },
      { t: 'Откупиться', cost: { gold: 6 }, def: 1, out: 'Откупились. Барон, вероятно, купит на это себе ещё одного посланца.' }] },
  { id: 'bard_famous', t: 'Бард вернулся', ic: 'log_gossip', r: 2, c: { chainOnly: true },
    d: 'Бард вернулся — уже с шапкой и тремя поклонниками. Баллада про вас разошлась по тавернам; половина слов в ней правдивая, и именно эта половина обидная.',
    o: [{ t: 'Устроить концерт', cost: { beer: 4, bread: 3 }, fx: { mood: 2, rel: { traders: 1 }, caravan: 1 }, out: 'Слава! В деревню потянулись любопытные с кошельками.' },
      { t: 'Взять процент', fx: { res: { gold: 4 } }, out: 'Бард недоволен, но пел бесплатно — и теперь платит за громкое имя.' },
      { t: 'Не пускать', def: 1, fx: { mood: -1 }, out: 'Бард ушёл в соседнюю деревню. Там рады.' }] },
  { id: 'deer_back', t: 'Олень вернулся', ic: 'log_animal', r: 2, c: { chainOnly: true },
    d: 'Тот самый олень стоит у опушки. Рядом — свёрток. В свёртке — подарок: туша косули, добытая явно не им. Но от души.',
    o: [{ t: 'Принять с благодарностью', fx: { res: { steak: 4, hide: 2 }, rel: { neutral: 1 }, mood: 1 }, out: 'Благодарность была взаимной. Олень удалился хвастаться перед другими оленями.' },
      { t: 'Угостить в ответ', cost: { bread: 3 }, fx: { rel: { neutral: 2 }, mood: 1 }, out: 'Лес запомнил вашу доброту. Он вообще сентиментален.' }] },
  { id: 'barrel', t: 'Бочка в реке', ic: 'log_food', r: 1, c: { night: false },
    d: 'По реке плывёт бочка. Бочка, как и всё плывущее без присмотра, подозрительна.',
    o: [{ t: 'Выловить и открыть', fx: { res: { beer: 6 } }, risk: { p: 0.3, fx: { mood: -1 }, out: 'В бочке была не только выпивка. Больше не будем.' }, out: 'Пиво! Не такое, как у нас, но кому какая разница в пятницу.' },
      { t: 'Продать нераспечатанной', fx: { res: { gold: 3 }, rel: { traders: 1 } }, out: 'Купцы заплатили, не заглядывая. Они, наверное, знают, что внутри.' },
      { t: 'Пусть плывёт', def: 1, out: 'Бочка уплыла. Что в ней было — теперь узнает кто-то другой. Нам не узнать.' }] },
  { id: 'rats', t: 'Крысы в амбаре', ic: 'log_food', r: 1, c: { night: false },
    d: 'Крысы устроили в амбаре собрание. Повестка: «пшеница, налог, пшеница».',
    o: [{ t: 'Завести кошек', cost: { sausage: 2 }, fx: { mood: 1 }, out: 'Кошки справились. Кошки теперь не уходят и требуют сметану.' },
      { t: 'Потравить', cost: { hops: 3 }, fx: { res: { wheat: -2 } }, risk: { p: 0.3, fx: { rel: { neutral: -1 } }, out: 'Яд ушёл в лес, лес не обрадовался.' }, out: 'Крыс нет. Но и тишины нет: гномы обсуждают, кто крайний.' },
      { t: 'Самим ловить', def: 1, fx: { res: { wheat: -5 }, mood: -1 }, out: 'Ловили всей деревней, поймали одну. Её звали Мартой.' }] },
  { id: 'spark', t: 'Искра в сарае', ic: 'build', r: 2, c: { night: false },
    d: 'Кто-то курил в сарае. Кто именно — неизвестно, а вот тлеющий пепел уже известен всем.',
    o: [{ t: 'Тушить ведрами', risk: { p: 0.4, fx: { res: { timber: -4 } }, out: 'Тушили вдохновенно и поздно: доски подгорели.' }, def: 1, out: 'Залили. Заодно полили самих себя и сарай чуть изменил цвет.' },
      { t: 'Позвать героя', req: 'hero', fx: { heroHp: -5, mood: 1 }, out: 'Герой потушил голыми руками и красиво обгорел.' },
      { t: 'Сломать сарай', fx: { res: { timber: 4 }, mood: -1 }, out: 'Снесли сарай, спасли доски. Сарай не простил.' }] },
  { id: 'pilgrims', t: 'Паломники', ic: 'people', r: 1, c: { night: false },
    d: 'Паломники идут к валуну, о котором легенда гласит: «здесь что-то было». Просят воды и ночлега.',
    o: [{ t: 'Накормить', cost: { bread: 4 }, fx: { res: { gold: 2 }, mood: 1 }, out: 'Паломники оставили пожертвование. Не нам, но мы подобрали.' },
      { t: 'Брать плату за проход', fx: { res: { gold: 4 }, mood: -1 }, out: 'Заплатили, ворча. Теперь нас в легендах не упомянут. Что и требовалось.' },
      { t: 'Пусть идут', def: 1, out: 'Прошли мимо. Валун по-прежнему молчит.' }] },
  { id: 'lights', t: 'Огоньки в лесу', ic: 'log_night', r: 2, c: { night: true },
    d: 'В лесу плывут огни. Один гном клянется, что они манят. Другой — что они подмигивают лично ему. Оба просят не оставлять их одних.',
    o: [{ t: 'Оставить пирожок у опушки', cost: { bread: 2 }, fx: { rel: { fairy: 1 }, mood: 1 }, out: 'Утром пирожка не было. Блюдце — вылизано.' },
      { t: 'Пойти с фонарём', req: 'hero', fx: { rel: { fairy: 1 }, heroHp: -4 }, risk: { p: 0.3, fx: { rel: { fairy: -1 } }, out: 'Феи не любят, когда за ними идут с фонарём.' }, out: 'Герой вернулся с цветком за ухом и взглядом человека, который что-то понял.' },
      { t: 'Закрыть ставни', def: 1, fx: { mood: -1 }, out: 'Спали. Огни тоже, как ни странно.' }] },
  { id: 'night_guest', t: 'Ночной путник', ic: 'log_night', r: 1, c: { night: true },
    d: 'Запоздалый путник стучит в ворота. В темноте у него слишком много зубов. Или просто улыбка широкая.',
    o: [{ t: 'Впустить', fx: { res: { gold: 2 }, mood: 1 }, risk: { p: 0.35, fx: { people: -1, mood: -2 }, out: 'Утром за столом не хватало одного жителя. И нескольких пирожков.' }, out: 'Путник оказался просто путником. Что обидно: теперь ему придётся что-то объяснить гостю.' },
      { t: 'Передать еду через забор', cost: { bread: 2 }, fx: { rel: { neutral: 1 } }, def: 1, out: 'Путник поел, поблагодарил и растворился в темноте. Вежливый.' },
      { t: 'Не открывать', fx: { mood: -1 }, out: 'Постучал и ушёл. Следы вели от ворот… в сторону ворот. Кого-то в доме съели совести.' }] },
  { id: 'boar', t: 'Кабан в огороде', ic: 'log_animal', r: 1, c: { night: false },
    d: 'Кабан методично уничтожает грядку с капустой и смотрит на вас так, будто это вы тут лишние.',
    o: [{ t: 'Задобрить зерном', cost: { wheat: 4 }, fx: { rel: { neutral: 1 } }, out: 'Кабан съел зерно, удовлетворённо хрюкнул и вернулся в лес — к капусте, к сожалению, он тоже вернётся.' },
      { t: 'Охота', fx: { res: { sausage: 4, hide: 2 }, rel: { neutral: -1 } }, risk: { p: 0.3, fx: { heroHp: -8 }, out: 'Кабан оказался сильнее, чем выглядел. Герой — тоже, но не сильно.' }, out: 'Колбасы будет много, капусты — нет.' },
      { t: 'Прогнать криками', def: 1, risk: { p: 0.4, fx: { mood: -1 }, out: 'Кабан обиделся и ответил по-своему.' }, out: 'Кричали все. Кабан ушёл, прихватив капусту.' }] },
  { id: 'leshy', t: 'Леший требует дань', ic: 'log_tree', r: 2, c: { pop: [12, 500] },
    d: 'Леший шепчет из дупла: «Дрова брали? Брали. Дань будет». Дань измеряется в досках и недобрых взглядах.',
    o: [{ t: 'Заплатить досками', cost: { timber: 4 }, fx: { rel: { neutral: 1 }, res: { trunk: 6 } }, out: 'Леший рассчитался брёвнами: обмен честный, насколько это возможно с пнём.' },
      { t: 'Торговаться пивом', cost: { beer: 2 }, fx: { rel: { neutral: 1 } }, risk: { p: 0.5, fx: { rel: { neutral: -1 } }, out: 'Леший пиво не пьёт. Теперь он ещё и в курсе.' }, out: 'Леший понюхал, поморщился и согласился.' },
      { t: 'Отказать', def: 1, fx: { rel: { neutral: -1 } }, risk: { p: 0.3, fx: { res: { trunk: -4 } }, out: 'Лес обиделся и спрятал дрова.' }, out: 'Леший вздохнул и ушёл в дупло. Дупло хлопнуло дверью.' }] },
  { id: 'deserter', t: 'Дезертир', ic: 'log_gossip', r: 2, c: { pop: [8, 500] },
    d: 'Из леса вышел воин в доспехах, но без командира и без гордости: «Я дезертир, но с идеями».',
    o: [{ t: 'Принять в деревню', fx: { people: 1, res: { sword: 1 } }, risk: { p: 0.3, fx: { mood: -1 }, out: 'Идеи у него оказались громкими. Очень.' }, out: 'Доспехов нет, меч остался — оплата за гостеприимство.' },
      { t: 'Выдать патрулю', fx: { res: { gold: 4 }, mood: -1 }, out: 'Патруль заплатил честно, совесть — нет.' },
      { t: 'Прогнать', def: 1, out: 'Ушёл, сочиняя про себя новую биографию.' }] },
  { id: 'fairy_curse', t: 'Феи обиделись', ic: 'log_tree', r: 2, c: { relMax: { fairy: -2 } },
    d: 'Молоко кисло, пиво плоское, куры несут квадратные яйца. Феи сказали, что это «случайно». Феи врут.',
    o: [{ t: 'Извиниться подарком', cost: { bread: 3, beer: 2 }, fx: { rel: { fairy: 2 } }, out: 'Феи приняли извинения и немного повозмущались — для вида.' },
      { t: 'Игнорировать', def: 1, fx: { mood: -1 }, risk: { p: 0.5, fx: { res: { beer: -4 } }, out: 'Пиво скисло окончательно.' }, out: 'Яйца остались квадратными. Куры выглядят довольными.' }] },
  { id: 'fairy_bless', t: 'Феи в хорошем настроении', ic: 'log_tree', r: 3, c: { relMin: { fairy: 2 } },
    d: 'Феи, довольные вами, решили сделать подарок. Правда, потом спросили: «А что вы ещё любите?» — и это немного пугает.',
    o: [{ t: 'Волшебные камни', fx: { res: { magicstone: 3 }, mood: 2 }, out: 'Камни светятся, мы тоже. Феи гордо улетели.' },
      { t: 'Урожай на полях', fx: { res: { wheat: 10, hops: 4 } }, out: 'Поля зашумели. Хмель растёт на глазах и, кажется, подслушивает.' },
      { t: 'Скромно отказаться', def: 1, fx: { rel: { fairy: 1 }, mood: 1 }, out: 'Феи были тронуты скромностью и обещали вернуться с вещами побольше.' }] },
  { id: 'rumor', t: 'Тревожные слухи', ic: 'trade', r: 2, c: { post: true },
    d: 'Гонец на взмыленном коне кричит: «В долине голод!» — и просит не оглядываться. Оглядываться вы, конечно, не будете. А вот цены на еду…',
    o: [{ t: 'Придержать запасы', fx: { price: { goods: ['bread', 'flour', 'wheat', 'sausage', 'beer'], f: 1.4, min: 6, text: 'Слухи о голоде: еда дорожает' }, mood: -1 }, out: 'Запасы придержаны. Цены довольны, хлеб — не очень.' },
      { t: 'Закупиться дёшево', cost: { gold: 4 }, fx: { price: { goods: ['timber', 'stone', 'trunk'], f: 0.7, min: 5, text: 'Слухи: стройматериалы подешевели' }, res: { timber: 6, stone: 4 } }, out: 'Пока все думали о хлебе, мы думали о досках. И это было правильно.' },
      { t: 'Не обращать внимания', def: 1, out: 'Слухи как пришли, так и ушли. Гонцу, как всегда, никто не заплатил.' }] },
  { id: 'rain_feast', t: 'Дождь и тоска', ic: 'log_gossip', r: 1, c: { night: false },
    d: 'Третий день льёт без паузы. Гномы мрачнее обычного, что для гномов уже достижение.',
    o: [{ t: 'Устроить посиделки', cost: { beer: 3, bread: 2 }, fx: { mood: 2 }, out: 'Пели хором, пока не охрипли. После этого стало слышно, как капает.' },
      { t: 'Раздать сухари и анекдоты', cost: { bread: 2 }, fx: { mood: 1 }, out: 'Сухари были чёрствыми. Анекдоты — тоже.' },
      { t: 'Молча ждать', def: 1, fx: { mood: -1 }, out: 'Дождь кончился. Хотелось бы сказать — благодаря нам.' }] },
  { id: 'old_gnome', t: 'Старый гном с советом', ic: 'people', r: 1, c: { pop: [8, 500], night: false },
    d: 'Седой гном с кружкой утверждает, что знает, как улучшить деревню. Ответил на пять вопросов подряд, ни на один из которых вы не спрашивали.',
    o: [{ t: 'Послушать за кружкой', cost: { beer: 2 }, fx: { mood: 1, res: { gold: 3 } }, risk: { p: 0.3, fx: { mood: -1 }, out: 'Совет оказался «надо больше пива». Он прав, но не в этом дело.' }, out: 'Совет оказался дельным: перенести склад. Перенесли в голове, и то хорошо.' },
      { t: 'Отмахнуться', def: 1, out: 'Ушёл, бурча про «молодёжь». Через неделю оказался прав — но мы это узнали из слухов.' }] },
  { id: 'lost_cart', t: 'Брошенная повозка', ic: 'trade', r: 1, c: { night: false },
    d: 'На дороге стоит повозка без лошади, без возницы, но с мешком, который шевелится. Мешок, пожалуй, надо бы решить, трогать или нет.',
    o: [{ t: 'Вскрыть мешок', fx: { res: { hide: 3, leather: 1 } }, risk: { p: 0.35, fx: { mood: -1, heroHp: -5 }, out: 'В мешке сидела недовольная курица. Нет, что-то другое. Что-то с когтями.' }, out: 'В мешке — шкуры. Шевелился ветер.' },
      { t: 'Продать повозку', fx: { res: { gold: 3 }, rel: { traders: 1 } }, out: 'Купцы забрали повозку и мешок, даже не заглядывая — наверное, опытные.' },
      { t: 'Оставить на месте', def: 1, out: 'Повозка осталась. Мешок, кажется, всё ещё шевелится.' }] },
  { id: 'smugglers', t: 'Контрабандисты', ic: 'log_gold', r: 2, c: { night: true, post: true },
    d: 'Двое в тёмных плащах предлагают «товар без вопросов». Вопросов, впрочем, много. Один из них — зачем вы вообще этим занялись.',
    o: [{ t: 'Купить без вопросов', cost: { gold: 4 }, fx: { res: { iron: 3, mana: 1 }, rel: { traders: -1 } }, risk: { p: 0.3, fx: { mood: -1 }, out: 'Товар оказался краденым, стыд — настоящим.' }, out: 'Купили. Сидим тихо и стараемся не шуметь железом.' },
      { t: 'Сдать страже', fx: { rel: { traders: 1 }, res: { gold: 2 } }, out: 'Стража заплатила за наводку, а контрабандисты — нет, зато в других местах.' },
      { t: 'Прогнать', def: 1, out: 'Ушли в темноту. В темноте им, кажется, самое место.' }] },
  { id: 'gnomish_wedding', t: 'Свадьба по расчёту', ic: 'people', r: 3, c: { pop: [20, 500], night: false },
    d: 'Двое жителей решили пожениться. Остальные решили, что это повод для праздника. Склад решил, что это повод для паники.',
    o: [{ t: 'Закатить пир', cost: { beer: 6, sausage: 4, bread: 4 }, fx: { mood: 3, rel: { guilds: 1 } }, out: 'Гуляли до рассвета. Молодожёны — ещё дольше. Куда делись три бочки — никто не помнит.' },
      { t: 'Скромный стол', cost: { beer: 2, bread: 3 }, fx: { mood: 1 }, out: 'Скромно, но уютно. Жених плакал, невеста сделала вид, что не заметила.' },
      { t: 'Отказаться', def: 1, fx: { mood: -2 }, out: 'Молодожёны женились без вас. Вы узнали из слухов, как и положено начальству.' }] },
];
const DIL_BY_ID = {};
for (const e of DIL_EVENTS) DIL_BY_ID[e.id] = e;

// ---------- Состояние ----------

function dilEnsure() {
  if (!Game.dil) Game.dil = { next: cycleAt(Game.time).k + 1, lastT: -9999, cur: null, last: null, flags: {}, chain: [], rel: { fairy: 0, neutral: 0, guilds: 0, traders: 0 }, mood: 0, moodT: Game.time, seen: {}, n: 0, seq: 0, mode: 'vote', calm: 0, acc: 0 };
  return Game.dil;
}
const dilServer = () => typeof coop !== 'undefined' && !!coop && !!coop.out && !!coop.players;
const dilMirror = () => typeof Coop !== 'undefined' && !!Coop.mirror;
const dilHasUI = () => !dilServer() && typeof document !== 'undefined' && !!document.getElementById && !!document.getElementById('view') && !window.__SERVER__;
function dilSay(text) { if (dilServer()) coop.out.push({ msg: { t: 'toast', text } }); else if (typeof toast === 'function') toast(text); }
const dilRnd = (a, b) => a + Math.random() * (b - a);
const dilEsc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dilClamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dilDay = () => cycleAt(Game.time).k;
// сезон для событий: 0 весна, 1 лето, 2 осень, 3 зима (порядок DIL_SEASONS); считает world/season.js (там лето — 0), длина сезона — SEASON_DAYS
function dilSeason() {
  if (typeof isWinterMap === 'function' && isWinterMap()) return 3;
  if (typeof seaIdx === 'function' && typeof Game !== 'undefined' && Game.sea) return (seaIdx() + 1) % 4;
  return (Math.floor(dilDay() / SEASON_DAYS) + 1) % 4;
}
const dilGoodName = g => (typeof GOODS !== 'undefined' && GOODS[g] ? GOODS[g].name : g);
function dilPop() { let n = 0; for (const u of Game.units) if (isPerson(u) && !u.dead && u.type !== 'hero' && u.type !== 'carter') n++; return n; }
const dilHero = () => Game.units.find(u => u.type === 'hero' && !u.dead && u.hero && !u.inside) || null;
const dilGuilds = () => typeof GUILD_TYPES !== 'undefined' && Game.buildings.some(b => GUILD_TYPES.includes(b.type) && b.state === 'done' && !b.removed);
const dilPost = () => typeof tradePost === 'function' ? tradePost() : null;

// ---------- Склады ----------

function dilHave(g) { let n = 0; for (const s of Game.buildings) if (s.isStore() && !s.removed) n += Math.max(0, s.offer(g)); return n; }
function dilTake(g, n) {
  let left = n;
  for (const s of Game.buildings) { if (!left) break; if (!s.isStore() || s.removed) continue; const t = Math.min(left, Math.max(0, s.offer(g))); s.stock[g] -= t; left -= t; }
  return n - left;
}
function dilGive(g, n) {
  const st = Game.buildings.find(s => s.isStore() && !s.removed && s.state === 'done') || Game.buildings.find(s => s.isStore() && !s.removed);
  if (!st || n <= 0) return 0;
  st.stock[g] = (st.stock[g] || 0) + n;
  return n;
}
function dilAfford(cost) { for (const g in cost || {}) if (dilHave(g) < cost[g]) return false; return true; }

// ---------- Условия и выбор события ----------

function dilNightLike() { return isNightNow() || isEveningNow(); }
function dilBusy() {
  if ((Game.raiders || []).some(N => N.st !== 'die' && N.st !== 'vanish' && N.k !== 'raven' && (N.k !== 'malgor' || N.tg))) return true;     // Малгор в башне — не бой
  if (Game.raid && Game.raid.f) return true;
  if ((Game.skels || []).length) return true;
  if ((Game.ghosts || []).some(g => g.mode === 'atk' || g.mode === 'grab' || g.mode === 'carry')) return true;
  if ((Game.ents || []).some(e => e.state === 'fight')) return true;
  if ((Game.neutrals || []).some(N => N.tg && N.st !== 'die')) return true;
  if (Game.units.some(u => u.brk && u.brk.kind === 'fight')) return true;
  const car = Game.trade && Game.trade.car;
  if (car && car.st === 'ambush') return true;
  if (typeof fairOn === 'function' && fairOn()) return true;
  if (Game.festival && Game.festival.on) return true;
  const F = Game.foe;
  if (F && !F.defeated && F.stage >= 4 && dilNightLike()) return true;
  return false;
}
function dilOk(e, ignoreTime) {
  const c = e.c || {}, d = dilEnsure();
  if (!ignoreTime) {
    const nl = dilNightLike();
    if (c.night === true && !nl) return false;
    if (c.night !== true && c.night !== 'any' && nl) return false;
    if (c.night === true && isDawnNow()) return false;
  }
  const pop = dilPop();
  if (c.pop && (pop < c.pop[0] || pop > c.pop[1])) return false;
  if (c.season && !c.season.includes(dilSeason())) return false;
  if (c.hero && !dilHero()) return false;
  if (c.post && !dilPost()) return false;
  if (c.guild && !dilGuilds()) return false;
  if (c.day && dilDay() < c.day) return false;
  for (const k in c.relMin || {}) if ((d.rel[k] || 0) < c.relMin[k]) return false;
  for (const k in c.relMax || {}) if ((d.rel[k] || 0) > c.relMax[k]) return false;
  if (c.flag && !d.flags[c.flag]) return false;
  if (c.noFlag && d.flags[c.noFlag]) return false;
  if (c.once && d.seen[e.id]) return false;
  return true;
}
function dilPick() {
  const d = dilEnsure(), day = dilDay();
  // цепочки идут вперёд очереди, если подошёл срок
  const ci = d.chain.findIndex(c => c.day <= day && DIL_BY_ID[c.id] && dilOk(DIL_BY_ID[c.id], false));
  if (ci >= 0) { const c = d.chain.splice(ci, 1)[0]; return DIL_BY_ID[c.id]; }
  let tot = 0;
  const pool = [];
  const foe = Game.foe && !Game.foe.defeated && Game.foe.stage >= 3;
  for (const e of DIL_EVENTS) {
    if ((e.c && e.c.chainOnly) || !dilOk(e)) continue;
    let w = [0, 10, 5, 2][e.r || 1] / (1 + (d.seen[e.id] || 0) * 1.4);
    if (e.id === d.lastId) w *= 0.1;
    if (foe && e.ic === 'log_gossip') w *= 0.5;      // Малгор близко — не до баллад
    pool.push([e, w]); tot += w;
  }
  if (!pool.length) return null;
  let r = Math.random() * tot;
  for (const [e, w] of pool) { r -= w; if (r <= 0) return e; }
  return pool[pool.length - 1][0];
}

// ---------- Показ и решение ----------

function dilAvail(cur) {
  const e = DIL_BY_ID[cur.id];
  return e.o.map(o => dilAfford(o.cost) && (o.req !== 'hero' || !!dilHero()));
}

function dilOpen(e) {
  const d = dilEnsure();
  d.seq++;
  d.lastId = e.id;
  d.seen[e.id] = (d.seen[e.id] || 0) + 1;
  d.cur = { id: e.id, seq: d.seq, day: dilDay(), season: dilSeason(), votes: {}, dl: dilServer() ? Game.time + DIL_VOTE_T : 0 };
  if (dilServer()) dilSay('Новое событие в деревне: «' + e.t + '» — нужно решение');
  dilUiSync();
}

// Применить последствия; возвращает список «чипов» для итога
function dilApply(fx, chips) {
  const d = dilEnsure();
  if (!fx) return;
  for (const g in fx.res || {}) {
    const n = fx.res[g];
    if (n > 0) { dilGive(g, n); chips.push({ k: 'up', t: dilGoodName(g) + ' +' + n }); }
    else if (n < 0) { const got = dilTake(g, -n); if (got) chips.push({ k: 'dn', t: dilGoodName(g) + ' −' + got }); }
  }
  if (fx.mood) { d.mood = dilClamp(d.mood + fx.mood, -3, 3); chips.push({ k: fx.mood > 0 ? 'up' : 'dn', t: 'Настроение ' + (fx.mood > 0 ? '↑' : '↓') }); }
  for (const k in fx.rel || {}) { d.rel[k] = dilClamp((d.rel[k] || 0) + fx.rel[k], -4, 4); chips.push({ k: fx.rel[k] > 0 ? 'up' : 'dn', t: DIL_REL[k] + ' ' + (fx.rel[k] > 0 ? '+' : '−') + Math.abs(fx.rel[k]) }); }
  if (fx.people > 0) {
    const st = Game.buildings.find(s => s.isStore() && !s.removed);
    const [x, y] = st ? [st.doorX, st.doorY + 1] : [8, 8];
    for (let i = 0; i < fx.people; i++) { const p = randomFreeNear(x, y, 1, 6) || [x, y]; spawnUnit('serf', p[0], p[1]); }
    chips.push({ k: 'up', t: 'Жители +' + fx.people });
  } else if (fx.people < 0) {
    let n = 0;
    for (let i = 0; i < -fx.people; i++) {
      const u = Game.units.filter(q => q.type === 'serf' && !q.dead && !q.inside)[0];
      if (!u) break;
      const before = Game.lostGnomes || 0;
      removeUnit(u); Game.lostGnomes = before;       // ушёл, а не погиб: призраки не множатся
      n++;
    }
    if (n) chips.push({ k: 'dn', t: 'Жители −' + n });
  }
  if (fx.heroHp) {
    const h = dilHero();
    if (h) {
      if (fx.heroHp < 0) { hlHurt(h, -fx.heroHp, true); h.hero.hp = Math.max(1, h.hero.hp); chips.push({ k: 'dn', t: 'Герой −' + (-fx.heroHp) + ' здоровья' }); }
      else { hlHeal(h, fx.heroHp); chips.push({ k: 'up', t: 'Герой +' + fx.heroHp + ' здоровья' }); }
    }
  }
  if (fx.flag) d.flags[fx.flag] = true;
  if (fx.unflag) delete d.flags[fx.unflag];
  if (fx.chain) d.chain.push({ id: fx.chain[0], day: dilDay() + Math.round(dilRnd(fx.chain[1], fx.chain[2])) });
  if (fx.price && typeof trEnsure === 'function' && dilPost()) {
    const T = trEnsure(), p = fx.price;
    T.ev = { id: 'dil', name: 'Слухи', goods: p.goods, f: p.f, until: Game.time + p.min * 60, text: p.text };
    chips.push({ k: p.f > 1 ? 'up' : 'dn', t: 'Цены: ' + p.text.toLowerCase() });
  }
  if (fx.caravan && typeof trEnsure === 'function' && dilPost()) {
    const T = trEnsure();
    if (!T.car) T.next = Math.min(T.next < 0 ? Game.time + 20 : T.next, Game.time + 20);
    chips.push({ k: 'up', t: 'Караван поспешит' });
  }
}

function dilResolve(i, who) {
  const d = dilEnsure(), cur = d.cur;
  if (!cur) return { ok: false, text: '' };
  const e = DIL_BY_ID[cur.id], o = e && e.o[i];
  if (!o) return { ok: false, text: '' };
  if (!dilAfford(o.cost)) return { ok: false, text: 'Не хватает припасов для этого решения' };
  if (o.req === 'hero' && !dilHero()) return { ok: false, text: 'Для этого решения нужен герой на ногах' };
  const chips = [], costChips = [];
  for (const g in o.cost || {}) { dilTake(g, o.cost[g]); costChips.push({ k: 'dn', t: dilGoodName(g) + ' −' + o.cost[g] }); }
  let out = o.out || '';
  dilApply(o.fx, chips);
  if (o.risk && Math.random() < o.risk.p) { dilApply(o.risk.fx, chips); out += ' ' + o.risk.out; chips.push({ k: 'warn', t: 'Побочка!' }); }
  d.n++;
  d.last = { seq: cur.seq, id: cur.id, i, out: out.trim(), chips: costChips.concat(chips), t: Game.time };
  d.cur = null;
  d.lastT = Game.time;
  d.next = dilDay() + DIL_GAP + (Math.random() < 0.4 ? 1 : 0);
  d.calm = 0;
  if (typeof logEvent === 'function') logEvent('dilemma', `«${e.t}»: ${o.t}. ${out.trim()}`);
  if (dilServer()) dilSay(who ? `${who}: «${e.t}» — ${o.t}` : `«${e.t}»: ${o.t}`);
  dilUiSync();
  return { ok: true, text: out };
}

// ---------- Ход времени ----------

function dilTick(dt) {
  const d = Game.dil;
  if (!d && Game.time < 40) return;
  dilEnsure();
  const D = Game.dil;
  D.acc += dt;
  if (D.acc < 1) return;
  const step = D.acc; D.acc = 0;
  // настроение понемногу остывает к нулю
  if (Game.time - D.moodT >= 100) { D.moodT = Game.time; if (D.mood > 0) D.mood = Math.max(0, D.mood - 1); else if (D.mood < 0) D.mood = Math.min(0, D.mood + 1); }
  if (D.cur) {
    if (dilServer()) {
      if (Game.time >= D.cur.dl) dilFinish(true);
      else if (!coop.players.size) D.cur.dl = Math.max(D.cur.dl, Game.time + 30);      // пока никого нет — время не идёт
    }
    return;
  }
  if (dilDay() < D.next || !startOpen('dilemma')) return;
  if (dilServer() && !coop.players.size) return;
  if (dilHasUI() && typeof GoalUI !== 'undefined' && GoalUI.open) return;
  if (Game.goal && Game.goal.over && Game.goal.over.res === 'lose') return;
  if (dilPop() < 5 || !Game.buildings.some(s => s.isStore() && !s.removed)) return;
  if (dilBusy()) { D.calm = 0; return; }
  D.calm += step;
  if (D.calm < DIL_CALM) return;
  const e = dilPick();
  if (!e) return;
  dilOpen(e);
}

// Подсчёт голосов (или решение хоста) → решение
function dilFinish(timeout) {
  const d = dilEnsure(), cur = d.cur;
  if (!cur) return;
  const e = DIL_BY_ID[cur.id], av = dilAvail(cur);
  const tally = e.o.map(() => 0);
  for (const n in cur.votes) if (tally[cur.votes[n]] != null && av[cur.votes[n]]) tally[cur.votes[n]]++;
  let best = -1, bv = 0, tie = false;
  tally.forEach((v, i) => { if (v > bv) { bv = v; best = i; tie = false; } else if (v === bv && v > 0) tie = true; });
  if (best < 0 || tie) best = e.o.findIndex((o, i) => o.def && av[i]);
  if (best < 0) best = e.o.findIndex((o, i) => av[i]);
  if (best < 0) best = e.o.length - 1;
  if (timeout && bv === 0) dilSay('Время вышло — деревня решила не решать');
  dilResolve(best, null);
}

// Голос игрока в коопе
function dilVote(name, isHost, seq, i) {
  const d = Game.dil, cur = d && d.cur;
  if (!cur || cur.seq !== seq || !Number.isInteger(i)) return;
  const e = DIL_BY_ID[cur.id];
  if (!e || i < 0 || i >= e.o.length) return;
  if (!dilAvail(cur)[i]) { coop.out.push({ to: name, msg: { t: 'toast', text: 'Для этого решения не хватает припасов' } }); return; }
  if (d.mode === 'host') {
    if (!isHost) { coop.out.push({ to: name, msg: { t: 'toast', text: 'Это решает хост' } }); return; }
    cur.votes = { [name]: i }; dilFinish(false); return;
  }
  cur.votes[name] = i;
  const n = coop.players.size, voted = Object.keys(cur.votes).length;
  const tally = e.o.map((o, k) => Object.values(cur.votes).filter(v => v === k).length);
  if (voted >= n || Math.max(...tally) > n / 2) dilFinish(false);
}
function dilSetMode(mode) {
  const d = dilEnsure();
  if (mode !== 'vote' && mode !== 'host') return;
  d.mode = mode;
  dilSay(mode === 'host' ? 'События: решает хост' : 'События: решает голосование');
}

// ---------- Отношения влияют на торговлю, настроение — на работу ----------

if (typeof daySpeedMul === 'function') {
  const _dsm = daySpeedMul;
  daySpeedMul = function () { const d = Game.dil; return _dsm() * (d && d.mood ? 1 + 0.04 * dilClamp(d.mood, -3, 3) : 1); };
}
if (typeof tradeQuote === 'function') {
  const _tq = tradeQuote;
  tradeQuote = function (g, side, k = 1) {
    const d = Game.dil, r = d ? dilClamp(d.rel.traders || 0, -3, 3) : 0;
    return _tq(g, side, k) * (r ? (side === 'sell' ? 1 + 0.03 * r : 1 - 0.03 * r) : 1);
  };
}

// ---------- Зеркало для кооп-клиентов ----------

function dilMirrorOut() {
  const d = Game.dil;
  if (!d) return null;
  const c = d.cur;
  return {
    mood: d.mood, rel: d.rel, mode: d.mode,
    last: d.last && Game.time - d.last.t < 90 ? d.last : null,
    cur: c ? { id: c.id, seq: c.seq, day: c.day, season: c.season, left: Math.max(0, Math.round(c.dl - Game.time)), votes: c.votes, av: dilAvail(c) } : null,
  };
}
function dilMirrorIn(m) {
  if (!m) { Game.dil = null; dilUiSync(); return; }
  const d = Game.dil || (Game.dil = { flags: {}, chain: [], seen: {} });
  d.mood = m.mood; d.rel = m.rel; d.mode = m.mode; d.cur = m.cur;
  if (m.last && (!d.last || d.last.seq !== m.last.seq) && DIL_BY_ID[m.last.id] && typeof logEvent === 'function') {      // у клиента свой журнал
    const e = DIL_BY_ID[m.last.id];
    logEvent('dilemma', `«${e.t}»: ${e.o[m.last.i].t}. ${m.last.out}`);
  }
  d.last = m.last;
  dilUiSync();
}

// ---------- Подключение к игре ----------

if (typeof LOG_KINDS !== 'undefined') {
  LOG_KINDS.dilemma = { icon: 'scroll', name: 'Решения' };
  LOG_GROUP.dilemma = 'life';
  if (typeof LOG_FILTERS !== 'undefined') LOG_FILTERS.push(['dilemma', 'Решения', 'scroll']);
  if (typeof LOG_SARC !== 'undefined') LOG_SARC.dilemma = [];
}
if (typeof logHTML === 'function') {
  const _lh = logHTML;
  logHTML = function () {
    const h = _lh();
    if (UI.logFilter !== 'dilemma') return h;
    const i = h.indexOf('</div>') + 6;
    return h.slice(0, i) + dilStatusHTML() + h.slice(i);
  };
}
if (typeof step === 'function') {
  const _step = step;
  step = function (dt) { _step(dt); if (!dilMirror()) dilTick(dt); };
  const _rgs = resetGameState;
  resetGameState = function () { _rgs(); Game.dil = null; dilUiSync(); };
  const _sg = serializeGame;
  serializeGame = function () { const s = _sg(); if (Game.dil) { const o = Object.assign({}, Game.dil); delete o.acc; s.dil = o; } return s; };
  const _as = applySave;
  applySave = function (s) {
    _as(s);
    Game.dil = s.dil ? Object.assign({ next: 0, lastT: -9999, cur: null, last: null, flags: {}, chain: [], rel: {}, mood: 0, moodT: Game.time, seen: {}, n: 0, seq: 0, mode: 'vote', calm: 0, acc: 0 }, s.dil) : null;
    if (Game.dil) {
      Game.dil.rel = Object.assign({ fairy: 0, neutral: 0, guilds: 0, traders: 0 }, Game.dil.rel);
      if (Game.dil.cur && !DIL_BY_ID[Game.dil.cur.id]) Game.dil.cur = null;
      if (Game.dil.cur && dilServer()) Game.dil.cur.dl = Game.time + DIL_VOTE_T;
    }
    DilUI.q = 0; DilUI.done = 0;
    dilUiSync();
  };
}

// ---------- Окно ----------

const DilUI = { q: 0, done: 0, sig: '', wasPaused: false, open: false, el: null };

function dilPause(on) {
  if (dilMirror() || dilServer()) return;
  if (on) { if (!DilUI.open) { DilUI.wasPaused = !!Game.paused; Game.paused = true; } }
  else if (DilUI.open && !DilUI.wasPaused && !(Game.goal && Game.goal.over && Game.goal.over.res === 'lose') && !(typeof GoalUI !== 'undefined' && GoalUI.open)) setSpeed(Game.speed || 1);
}
function dilModalEl() {
  if (DilUI.el) return DilUI.el;
  const el = document.createElement('div');
  el.id = 'dil-modal'; el.className = 'hidden';
  document.body.appendChild(el);
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-dl]');
    if (!b || b.disabled) return;
    const a = b.dataset.dl;
    if (a === 'ok') { DilUI.done = DilUI.q; dilHide(); }
    else if (a === 'mode') coopSend({ t: 'dilmode', mode: Game.dil && Game.dil.mode === 'host' ? 'vote' : 'host' });
    else dilChoose(+a);
  });
  return (DilUI.el = el);
}
function dilHide() {
  if (!DilUI.el) return;
  DilUI.el.classList.add('hidden'); DilUI.sig = '';
  if (DilUI.open) { dilPause(false); DilUI.open = false; }
}
function dilChoose(i) {
  const d = Game.dil, cur = d && d.cur;
  if (!cur) return;
  if (dilMirror()) { coopSend({ t: 'dil', seq: cur.seq, i }); return; }
  const r = dilResolve(i, null);
  if (!r.ok && r.text) toast(r.text);
}

function dilChipsOf(o, av) {
  const out = [];
  const add = (k, t) => out.push(`<span class="dl-chip ${k}">${dilEsc(t)}</span>`);
  for (const g in o.cost || {}) add('dn', dilGoodName(g) + ' −' + o.cost[g]);
  const fx = o.fx || {};
  for (const g in fx.res || {}) add(fx.res[g] > 0 ? 'up' : 'dn', dilGoodName(g) + (fx.res[g] > 0 ? ' +' : ' −') + Math.abs(fx.res[g]));
  if (fx.mood) add(fx.mood > 0 ? 'up' : 'dn', 'Настроение ' + (fx.mood > 0 ? '↑' : '↓'));
  for (const k in fx.rel || {}) add(fx.rel[k] > 0 ? 'up' : 'dn', DIL_REL[k] + ' ' + (fx.rel[k] > 0 ? '+' : '−') + Math.abs(fx.rel[k]));
  if (fx.people) add(fx.people > 0 ? 'up' : 'dn', 'Жители ' + (fx.people > 0 ? '+' : '−') + Math.abs(fx.people));
  if (fx.heroHp) add(fx.heroHp > 0 ? 'up' : 'dn', 'Герой ' + (fx.heroHp > 0 ? '+' : '−') + Math.abs(fx.heroHp));
  if (fx.price) add(fx.price.f > 1 ? 'up' : 'dn', 'Цены на рынке');
  if (fx.caravan) add('up', 'Караван скоро');
  if (fx.chain) add('chain', 'Будет продолжение');
  if (o.req === 'hero') add('req', 'Нужен герой');
  if (o.risk) {
    const rf = o.risk.fx || {};
    const bits = [];
    for (const g in rf.res || {}) bits.push(dilGoodName(g) + ' ' + (rf.res[g] > 0 ? '+' : '−') + Math.abs(rf.res[g]));
    if (rf.mood) bits.push('настроение ' + (rf.mood > 0 ? '↑' : '↓'));
    for (const k in rf.rel || {}) bits.push(DIL_REL[k].toLowerCase() + ' ' + (rf.rel[k] > 0 ? '+' : '−'));
    if (rf.people) bits.push('жители ' + (rf.people > 0 ? '+' : '−') + Math.abs(rf.people));
    if (rf.heroHp) bits.push('герой −' + Math.abs(rf.heroHp));
    out.push(`<span class="dl-chip risk">Риск ${Math.round(o.risk.p * 100)}%: ${dilEsc(bits.join(', ') || 'неприятность')}</span>`);
  }
  return out.join('');
}
function dilStatusHTML() {
  const d = Game.dil;
  if (!d) return '';
  const rel = k => { const v = d.rel[k] || 0; return `<span class="dl-rel ${v > 0 ? 'up' : v < 0 ? 'dn' : ''}">${DIL_REL[k]} ${v > 0 ? '+' : ''}${v}</span>`; };
  const m = d.mood || 0;
  return `<div class="dl-status"><span class="dl-rel ${m > 0 ? 'up' : m < 0 ? 'dn' : ''}">Настроение ${m > 0 ? '+' : ''}${m}</span>${['fairy', 'neutral', 'guilds', 'traders'].map(rel).join('')}</div>`;
}

function dilUiSync() {
  if (!dilHasUI()) return;
  const d = Game.dil, cur = d && d.cur, last = d && d.last;
  if (cur) {
    if (DilUI.done === cur.seq) return;
    const e = DIL_BY_ID[cur.id];
    if (!e) return;
    const mirror = dilMirror();
    const av = mirror ? cur.av : dilAvail(cur);
    const myVote = mirror && cur.votes ? cur.votes[Coop.nick] : undefined;
    const sig = [cur.seq, JSON.stringify(av), JSON.stringify(cur.votes || {}), d.mode, JSON.stringify(d.rel), d.mood].join('|');
    DilUI.q = cur.seq;
    if (sig !== DilUI.sig || DilUI.el.classList.contains('hidden')) {
      const tallies = e.o.map((o, k) => Object.values(cur.votes || {}).filter(v => v === k).length);
      let h = `<div class="gm-card dl-card"><div class="dl-head"><div class="dl-ic">${ui(e.ic)}</div><div><div class="dl-kicker">Сутки ${cur.day + 1} · ${DIL_SEASONS[cur.season]} · ${DIL_RAR[e.r || 1]}</div><h2>${dilEsc(e.t)}</h2></div></div>
        <div class="dl-text">${dilEsc(e.d)}</div><div class="dl-opts">`;
      e.o.forEach((o, k) => {
        const ok = av[k] !== false;
        h += `<button class="dl-opt${ok ? '' : ' off'}${myVote === k ? ' mine' : ''}" data-dl="${k}"${ok ? '' : ' disabled'}><span class="dl-t">${dilEsc(o.t)}${tallies[k] ? `<b class="dl-v">${'●'.repeat(Math.min(tallies[k], 8))}</b>` : ''}</span><span class="dl-chips">${dilChipsOf(o)}</span>${ok ? '' : '<span class="dl-no">не хватает припасов</span>'}</button>`;
      });
      h += '</div>';
      if (mirror) {
        h += `<div class="dl-coop">${d.mode === 'host' ? 'Решает хост' : 'Решает голосование'} · осталось <b id="dl-left">${cur.left}</b> с${Coop.host ? ' <button class="dl-mode" data-dl="mode">Сменить: ' + (d.mode === 'host' ? 'голосование' : 'хост') + '</button>' : ''}</div>`;
      }
      h += dilStatusHTML() + '</div>';
      const el = dilModalEl();
      el.innerHTML = h; el.classList.remove('hidden');
      DilUI.sig = sig;
      if (!DilUI.open) { dilPause(true); DilUI.open = true; }
    } else {
      const l = document.getElementById('dl-left');
      if (l && cur.left != null) l.textContent = cur.left;
    }
    return;
  }
  // события нет: показать итог только тем, кто видел вопрос
  if (last && DilUI.q && last.seq === DilUI.q && DilUI.done !== last.seq) {
    const e = DIL_BY_ID[last.id], o = e && e.o[last.i];
    if (e && o) {
      const el = dilModalEl();
      el.innerHTML = `<div class="gm-card dl-card dl-res"><div class="dl-head"><div class="dl-ic">${ui(e.ic)}</div><div><div class="dl-kicker">Решение принято</div><h2>${dilEsc(e.t)}</h2></div></div>
        <div class="dl-pick">«${dilEsc(o.t)}»</div><div class="dl-text">${dilEsc(last.out)}</div>
        <div class="dl-chips res">${(last.chips || []).map(c => `<span class="dl-chip ${c.k}">${dilEsc(c.t)}</span>`).join('')}</div>${dilStatusHTML()}
        <div class="gm-btns"><button data-dl="ok" class="primary">Ну ладно</button></div></div>`;
      el.classList.remove('hidden');
      DilUI.sig = 'res' + last.seq;
      if (!DilUI.open) { dilPause(true); DilUI.open = true; }
      return;
    }
  }
  if (DilUI.el && !DilUI.el.classList.contains('hidden') && !String(DilUI.sig).startsWith('res')) dilHide();
}
