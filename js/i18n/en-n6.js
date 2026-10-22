'use strict';
// Лазарет и травмы, драки, зима и Новый год, мемы, фото-режим, указы, стили земли, поле боя, интерфейс
I18N.add('en', {
  // лазарет (js/sickness.js)
  "{0} поправился: {1} отступила{2}": "{0} recovered: {1} receded{2}", "(лазарет)": "(infirmary)",
  "Перевязали!": "Bandaged up!", "Как новенький!": "Good as new!", "Жду лекаря…": "Waiting for the healer…", "повредил ногу": "hurt a leg",
  "лазарет ещё строится, пока заживает само": "the infirmary is still being built, healing on its own for now",
  "заживёт само, но в лазарете лечат быстрее": "will heal on its own, but the infirmary heals faster",
  "в лазарете нет лекаря — лечатся дольше": "no healer in the infirmary — recovery takes longer",
  "в лазарете нет ни лекаря, ни перевязок — обучите лекаря в школе": "the infirmary has neither a healer nor bandages — train a healer at the school",
  "раненые не могут дойти до лазарета — проведите туда дорогу": "the wounded can’t reach the infirmary — lay a road to it",
  "все койки лазарета заняты": "all infirmary beds are taken",
  "Травмы за минуту: {0}{1} — {2}": "Injuries per minute: {0}{1} — {2}", ", ранены {0}": ", wounded {0}",
  "Травмы за минуту: {0}{1}": "Injuries per minute: {0}{1}", ", лечатся у лекаря": ", being treated by the healer",
  "{0}зараза": "{0}contagion", "· мест {0}/{1} · {2} · зелий {3}{4}": "· beds {0}/{1} · {2} · potions {3}{4}",
  "· строится": "· under construction", "· в лазарете": "· in the infirmary",

  // драки (js/world/brawl.js)
  "Ах ты бородач!": "Why, you bearded rascal!", "Получай!": "Take that!", "А ну иди сюда!": "Come here, you!", "Я тебя уважаю! Бам!": "I respect you! Bam!",
  "Кто пил мой эль?!": "Who drank my ale?!", "Моя кружка!": "My mug!", "Эй, я мимо проходил!": "Hey, I was just passing by!", "А меня-то за что?!": "What did I do?!",
  "У них тут свой праздник…": "They’re having their own party here…", "Ой-ой-ой…": "Oh-oh-oh…", "Бам!": "Bam!", "Пинок!": "Kick!",
  "Пьяная драка на празднике: {0} не поделили кружку": "Drunken brawl at the festival: {0} couldn’t share a mug",
  "На празднике назревает драка…": "A brawl is brewing at the festival…",
  "Драка кончилась: победил {0}, {1} отдыхает в пыли": "The brawl is over: {0} won, {1} is resting in the dust",
  "{0} попал под раздачу в пьяной драке и отлетел на два шага": "{0} got caught in the drunken brawl and flew back two paces",
  "{0} попал под раздачу в пьяной драке!": "{0} got caught in the drunken brawl!",

  // зимние забавы (js/world/winterlife.js)
  "Снежок в героя!": "Snowball at the hero!", "Ай! Холодно!": "Ow! Cold!", "Подарок! +6 маны": "A gift! +6 mana", "Золото в носке!": "Gold in the sock!",
  "Пряник!": "Gingerbread!", "Подарок!": "A gift!", "Держись!": "Hang on!", "Лепим снеговика!": "Let’s build a snowman!", "Снеговик!": "Snowman!", "На каток!": "To the rink!",
  "❄ Снежок": "❄ Snowball", "Герой кидает снежок в ближайшего гнома": "The hero throws a snowball at the nearest gnome",
  "Новый год! Дед Мороз летит на оленях, а гномы уже у трактира": "New Year! Santa is flying in on reindeer, and the gnomes are already at the tavern",
  "Новый год! Дед Мороз летит на санях с подарками для всех гномов": "New Year! Santa is flying in on a sleigh with gifts for all the gnomes",
  "Дед Мороз прилетел раздавать подарки": "Santa has arrived to hand out gifts",
  "Дед Мороз улетел: «С Новым годом, гномы!»": "Santa flew away: “Happy New Year, gnomes!”",
  "Хо-хо-хо!": "Ho-ho-ho!",

  // интерфейс (js/ui.js, index.html)
  "Выйти из общей деревни в главное меню?": "Leave the shared village for the main menu?",
  "Выйти в главное меню? Игра сохранится в автосохранение.": "Go to the main menu? The game will be saved to the autosave.",
  "Не удалось сохранить игру. Всё равно выйти?": "Couldn’t save the game. Leave anyway?",
  "Второй трактир": "Second Tavern", "— склады не принимают": "— storehouses don’t accept",
  "Отдыхает: еды на складе вдоволь": "Resting: plenty of food in store", "Ждём золото{0}": "Waiting for gold{0}", "Очистить очередь": "Clear the queue",
  "Еда в запасе: {0}": "Food in stock: {0}", "Еды нет — голодные идут на склад всухомятку": "No food — the hungry go to the store for dry rations",
  "{0} Сено — побочный продукт жатвы.": "{0} Hay is a by-product of the harvest.",
  "Поля хмеля закладывайте инструментом «Хмель» рядом (до {0} клеток): доска за подвесы.": "Lay out hop fields with the “Hops” tool nearby (up to {0} tiles): a plank for the trellises.",
  "Поля закладывайте инструментом «Пшеница» рядом с фермой (до {0} клеток) — работяга вскопает их бесплатно.": "Lay out fields with the “Wheat” tool near the farm (up to {0} tiles) — a toiler will dig them for free.",
  "Ничего не выбрано. {0} на карте — здесь появятся его запасы, рабочий и производство.": "Nothing selected. {0} on the map — its stock, worker and production will show up here.",
  "Коснитесь здания": "Tap a building", "Кликните по зданию": "Click a building",
  "Приоритеты работ: еда, стройка, дрова, оборона, профессии": "Work priorities: food, construction, firewood, defence, trades",
  "Пауза: можно планировать — дороги, здания, поля, снос (Пробел)": "Pause: planning is allowed — roads, buildings, fields, demolition (Space)",
  "Медленно (Shift+1)": "Slow (Shift+1)", "Обычная (Shift+2)": "Normal (Shift+2)", "Быстро (Shift+3)": "Fast (Shift+3)", "Очень быстро (Shift+4)": "Very fast (Shift+4)",
  "Вызов дня": "Daily challenge", "Выйти в главное меню": "Go to the main menu", "♪ Музыка": "♪ Music", "🔊 Звуки": "🔊 Sounds",
  "(колбаса). Поля пшеницы закладываете сами рядом с фермой; хмель появится позже, вместе с пивоварней.": "(sausage). You lay out the wheat fields yourself next to the farm; hops come later, along with the brewery.",
  "Пауза": "Pause",
  "; скорость ×0,5 / ×1 / ×2 / ×3 —": "; speed ×0.5 / ×1 / ×2 / ×3 —",
  "или кнопка времени справа сверху. На паузе можно ставить дороги, здания, поля и сносить, а гномы начнут работать, когда снимете паузу. Вкладка": "or the time button at the top right. While paused you can place roads, buildings and fields and demolish, and the gnomes start working when you unpause. The",
  "«Приоритеты»": "“Priorities”",
  "решает, чем гномы заняты в первую очередь (еда, стройка, дрова, оборона, профессии) и что отключить.": "tab decides what the gnomes do first (food, construction, firewood, defence, trades) and what to switch off.",

  // мемы (js/world/memes.js)
  "Шесть-семь!": "Six-seven!", "Шесть… семь!": "Six… seven!", "Шесть на семь локтей!": "Six by seven cubits!", "Шесть-семь — моя масть!": "Six-seven is my suit!",
  "Шесть-семь! Мой кусок!": "Six-seven! My piece!", "Шесть… семь! Хоп!": "Six… seven! Hop!", "Опять шесть-семь…": "Six-seven again…",
  "Это что вообще?": "What even is this?", "Не смешно. Ну, почти": "Not funny. Well, almost", "Что за шесть-семь?": "What’s with six-seven?",
  "«Шесть-семь!» — гном снова не удержался": "“Six-seven!” — the gnome couldn’t resist again",
  "Вау. Много золото": "Wow. Much gold", "«Такой гном. Много золото. Вау.»": "“Such gnome. Much gold. Wow.”",
  "Нормально делай!": "Do it properly!", "Это не пробка, это фича": "It’s not a jam, it’s a feature", "Не понятно, но интересно": "Unclear, but interesting",
  "Ты кто такой? До свидания!": "Who are you? Goodbye!", "Только спокойствие!": "Just stay calm!", "Ор выше гор!": "Screaming above the mountains!",
  "Доставка: шесть-семь минут": "Delivery: six-seven minutes", "Меню дня: шесть-семь": "Menu of the day: six-seven",
  "Борщ сегодня. Завтра тоже": "Borscht today. Tomorrow too", "Эль: пей — не жалей": "Ale: drink up, no regrets",
  "Вай-фая нет, зато есть эль": "No Wi-Fi, but there’s ale", "Закуска — 6, эль — 7": "Snack — 6, ale — 7", "Ничего не помню — наливай": "Don’t remember a thing — pour another",

  // фото-режим (js/photo.js)
  "Без рамки": "No frame", "Пергамент": "Parchment", "Дерево": "Wood", "Двойная": "Double", "Кино": "Cinema", "Тёплый": "Warm", "Холодный": "Cool",
  "Закат": "Sunset", "Сепия": "Sepia", "Чёрно-белый": "Black and white", "Старина": "Vintage",
  "«{0}» · сутки {1}": "“{0}” · day {1}", "Не удалось сделать снимок": "Couldn’t take the photo", "Снимок сохранён: {0}": "Photo saved: {0}",
  "Свернуть панель": "Collapse panel", "Сделать снимок (Пробел)": "Take a photo (Space)", "Выйти (Esc)": "Exit (Esc)", "Подпись": "Caption", "📷 Снимок": "📷 Photo",
  "Фото-режим: тяните карту, щипок — масштаб": "Photo mode: drag the map, pinch to zoom",
  "Фото-режим: тяните карту, колесо — масштаб. Выход — Esc": "Photo mode: drag the map, wheel to zoom. Exit with Esc",

  // указы совета (js/laws.js)
  "Нет такого указа": "No such decree", "Указы появятся позже: сперва поселению нужно стать деревней": "Decrees come later: the settlement must first become a village",
  "{0}. Гномы читают объявление на складе и чешут бороды": "{0}. The gnomes read the notice at the storehouse and scratch their beards",
  "{0}. Гномы выдохнули — или наоборот": "{0}. The gnomes breathed out — or the opposite",
  "{0} предлагает {1} указ «{2}» — голосуйте во вкладке «Совет»": "{0} proposes to {1} the decree “{2}” — vote in the “Council” tab",
  "ввести": "enact", "отменить": "repeal", "Совет против: указ «{0}» {1}": "The council is against: decree “{0}” {1}",
  "не вводим": "not enacted", "остаётся": "stays",
  "{0} · указ — {1} зол.": "{0} · decree — {1} gold",
  "предлагает {0} «{1}» · за {2}, против {3} · ещё {4} с": "proposes to {0} “{1}” · for {2}, against {3} · {4} s left",

  // стили земли (js/world/groundstyle.js)
  "1. Луговая мозаика": "1. Meadow Mosaic", "Крупные пятна трёх-четырёх тонов, много штрихов-травинок, ромашки и колокольчики кучками.": "Large patches of three or four tones, lots of grass strokes, daisies and bellflowers in clumps.",
  "2. Поляны и чаща": "2. Glades and Thicket", "Светлые стриженые поляны с мелкими цветами среди тёмной густой травы: клевер, папоротник, грибы по краю.": "Light mown glades with small flowers amid dark dense grass: clover, fern, mushrooms at the edge.",
  "3. Тропы и почва": "3. Paths and Soil", "Спокойная трава, вытоптанные тропки-извилины, пятна голой земли с рваным краем, камешки на тропе.": "Calm grass, trampled winding paths, patches of bare earth with ragged edges, pebbles on the trail.",
  "4. Цветущий луг": "4. Flowering Meadow", "Светло-салатовая, весенняя: россыпь клевера, лютики, маки, васильки, ромашки; мелкие и яркие точки без шума.": "Light lime, springlike: a scatter of clover, buttercups, poppies, cornflowers, daisies; small bright dots without noise.",
  "5. Сухая степь": "5. Dry Steppe", "Выгоревшая охристая трава с зелёными прожилками, высокие сухие стебли, чертополох, растрескавшаяся земля, валуны.": "Sun-bleached ochre grass with green veins, tall dry stalks, thistle, cracked earth, boulders.",
  "6. Мшистая глушь": "6. Mossy Wilds", "Сумрачно-зелёная, сырая: мшистые пятна, тёмная влажная земля с корнями, валуны в моху, папоротник и грибы.": "Gloomy green, damp: mossy patches, dark wet soil with roots, mossy boulders, fern and mushrooms.",

  // поле боя (js/combatfield.js)
  "Капкан": "Bear Trap", "Колья": "Stakes", "Боевой фонарь": "Battle Lantern", "{0}: ещё {1} с": "{0}: {1} s left", "Здесь не поставить": "Can’t place here",
  "В капкане!": "Trapped!", "Колья!": "Stakes!", "Колья сломаны": "Stakes broken", "Яркий свет!": "Bright light!",

  // мобильный интерфейс (js/landscape.js, js/restip.js)
  "Меню: строительство, склад, жители…": "Menu: building, storehouse, residents…", "Интерфейс (горизонтально)": "Interface (landscape)", "Интерфейс": "Interface",
  "Как выглядит игра, когда телефон повёрнут набок. В вертикальном положении ничего не меняется.": "How the game looks when the phone is turned sideways. In portrait nothing changes.",
  "А · Колонка слева": "A · Left column",
  "Узкая колонка иконок: строительство, склад, жители, хозяйство, журнал, меню. Панели выезжают поверх карты.": "A narrow column of icons: building, storehouse, residents, household, log, menu. Panels slide in over the map.",
  "Б · Карта на весь экран": "B · Full-screen map",
  "Без колонки. Кнопка ☰ раскрывает вкладки, рядом кнопка «Строительство». Панели — шторки поверх карты.": "No column. The ☰ button opens the tabs, with the “Building” button beside it. Panels are sheets over the map.",
  "Нужно:": "Needs:", "· на складе:": "· in store:", "На складе:": "In store:", "Производят: {0}": "Produced by: {0}",
  "Не производится: добывают в мире или привозят": "Not produced: gathered in the world or brought in",
  "Идёт в: {0}": "Goes into: {0}", "Для стройки: {0}": "For construction: {0}", "Нажмите на число — запретить складам брать": "Click the number to forbid stores from taking it",

  // сезоны и лёд (js/world/snow.js, frostart.js)
  "· день {0} из {1}": "· day {0} of {1}", "{0}: день {1} из {2}.{3}": "{0}: day {1} of {2}.{3}", "Смена сезона через {0} сут.": "Season changes in {0} days.",
  "Всё растёт. Осенью пора делать заготовки.": "Everything grows. Time to stock up in autumn.",
  "Весна: снег тает, всё оживает.": "Spring: snow melts, everything comes alive.",
  "Сено: {0} из ~{1} нужных.": "Hay: {0} of ~{1} needed.",
  "Ледяной элементаль": "Ice Elemental", "Ледяной шпиль": "Ice Spire", "Хруст-хруст!": "Crunch-crunch!", "Зима не любит гостей!": "Winter doesn’t like guests!",
  "Заморожу!": "I’ll freeze you!", "Холодно? Будет холоднее!": "Cold? It’ll get colder!", "Брр!": "Brr!"
});
