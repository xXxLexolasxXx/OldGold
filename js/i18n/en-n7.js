'use strict';
// Хвосты: кооператив (сервер, клиент), эпохи, питомцы, музыка, мелкие подписи, нейтралы-2 (названия), лист земли
I18N.add('en', {
  // сервер и кооператив (server/server.js, js/coop/*)
  "настройки не сохранились:": "settings were not saved:", ": пауза — можно планировать": ": paused — planning allowed", ": игра продолжается": ": the game goes on",
  "карта игрока не принята, делаем обычную:": "player map rejected, making a regular one:", "карта игрока {0}": "player map {0}", "биом {0}, размер {1}": "biome {0}, size {1}",
  "Новый мир начинает только хост": "Only the host can start a new world", "Карта не принята: {0}": "Map rejected: {0}",
  "новый мир не начат:": "new world not started:", "Сервер не смог начать новый мир": "The server couldn’t start a new world",
  "хост начал новый мир": "the host started a new world", "на своей карте": "on a custom map", "обычной генерацией": "with regular generation", "— старый мир в архиве": "— the old world is archived",
  "Скорость выбирает только хост": "Only the host picks the speed", "Хост {0}": "Host {0}", "Голосование": "Vote",
  "просит паузу": "asks for a pause", "просит продолжить": "asks to resume",
  "Новый мир": "New World",
  "Текущий мир уйдёт в архив на сервере, деревня начнётся заново. Свои карты — из «Редактора карт» на этом устройстве.": "The current world goes to the server archive and the village starts over. Your own maps come from the “Map Editor” on this device.",
  "Да, начать заново": "Yes, start over", "Карта не готова: {0}": "Map isn’t ready: {0}", "Начать новый мир: {0}?": "Start a new world: {0}?", "Обычная карта": "Regular map",
  "Режим событий меняет только хост": "Only the host changes the events mode", "разведчик": "scout", "· {0} кл., на {1}": "· {0} tiles, to the {1}",

  // школа и размещение (js/entities.js)
  "Школа выучит трудягу в долг: золота нет, а возить некому": "The school will train a hauler on credit: no gold, and nobody to carry it",
  "Школа стоит: золота нет нигде. Нужен золотой рудник у скалы и плавильня — или очистите очередь в школе": "The school is idle: there is no gold anywhere. You need a gold mine by a cliff and a smelter — or clear the school queue",
  "Подходящих мест на карте не осталось.": "No suitable spots left on the map.", "о-": "-",
  "Ближайшее место — в {0} кл.{1}; подходящие места подсвечены.": "The nearest spot is {0} tiles away{1}; suitable spots are highlighted.",
  "на {0}": "to the {0}",

  // люди, эпохи, профиль (js/people.js, eras.js, profile.js)
  "Две косы": "Two braids", "Коса": "Braid", "Платок": "Kerchief", "Чепец": "Bonnet", "Пучок": "Bun", "Кудри": "Curls",
  "Солома и дерево": "Straw and Wood", "Камень и дерево": "Stone and Wood", "Дворцовая эпоха": "Palace Era",
  "Новая эпоха: «{0}». Гномы схватились за молотки и перестраивают всё подряд": "A new era: “{0}”. The gnomes grabbed hammers and are rebuilding everything",
  "Эпоха зданий: «{0}»": "Building era: “{0}”",
  "Выпил — подрался": "Drank, Brawled",
  "На празднике гномы подрались: кулаки, пинки и бутыль. Начали за мир, закончили на земле.": "The gnomes brawled at the festival: fists, kicks and a jug. Started for peace, ended on the ground.",
  "Мимо проходил": "Just Passing By",
  "Героя зацепило в пьяной драке, и он отлетел на пару клеток. Урон небольшой, обида — большая.": "The hero got hit in a drunken brawl and flew a couple of tiles. Little damage, big offence.",
  "Наследие {0}": "Legacy {0}",

  // питомцы, дом, музыка (js/world/pets.js, inside.js, sound/*, startmenu.js)
  "коза": "goat", "лиса": "fox", "волчонок": "wolf cub", "козу": "goat", "волчонка": "wolf cub",
  "Нахал!": "Cheeky!", "Ах ты!": "Why, you!", "Не смей!": "Don’t you dare!", "Ой…": "Oh…",
  "Музыка выключена, чтобы не перебивать ваш плеер. Включить: ♪ вверху": "Music is off so as not to talk over your player. Turn on: ♪ at the top",
  "♪ Музыка: выкл": "♪ Music: off", "Музыка: вкл — нажмите, чтобы выключить": "Music: on — click to turn off", "Музыка: выкл — нажмите, чтобы включить": "Music: off — click to turn on",
  "Музыка меню: вкл": "Menu music: on", "Музыка меню: выкл": "Menu music: off", "🔈 Звуки: выкл": "🔈 Sounds: off",

  // цели, герой, способности (js/goal.js, hero.js, herocard.js, herokit.js, heromana.js, combat.js)
  "Победить стражей Чёрного шпиля": "Defeat the guardians of the Black Spire", "Цель карты": "Map goal", "Глава {0}/{1}": "Chapter {0}/{1}",
  "Нет": "No", "Да": "Yes", "Взять в команду": "Recruit",
  "Способностей пока нет: герой выучится им в гильдии — у каждого класса свои.": "No abilities yet: the hero learns them at a guild — every class has its own.",
  "Нажмите на значок — подсказка. Применять удобнее с панели в углу экрана.": "Click an icon for a hint. It is handier to use abilities from the panel in the screen corner.",
  "Наведите на значок — подсказка, клик — применить (или клавиши 1–5)": "Hover an icon for a hint, click to use (or keys 1–5)",
  "{0} — действует всегда": "{0} — always active", ". Перезарядка {0} с": ". Cooldown {0} s", "пассивно": "passive",
  "перевязки ×{0}": "bandages ×{0}", "Открыт: двойной удар!": "Unlocked: double strike!", "Щит!": "Shield!",

  // описания зданий (js/config.js, levels.js)
  "Голодные жители едят здесь всё, что есть в запасе — курицу, стейк, колбасу, круассаны, хлеб — и запивают пивом. Тушку курицы разделывают на 4 куска. Пьяный может уснуть прямо на дороге.": "Hungry residents eat whatever is in stock here — chicken, steak, sausage, croissants, bread — washed down with beer. A chicken carcass is carved into 4 pieces. A drunk may fall asleep right on the road.",
  "Шьёт кожаные доспехи — долго и вдумчиво. Железные клепают только в мастерской 2-го уровня. Заказы ставятся в очередь.": "Stitches leather armour — slowly and thoughtfully. Iron armour is riveted only in a level 2 workshop. Orders go into a queue.",
  "Шьёт кожаные доспехи: долго, вдумчиво и с примеркой. Железные тут пока не клепают — мастерская для них слишком скромна. Заказы встают в очередь.": "Stitches leather armour: slowly, thoughtfully and with fittings. Iron isn’t riveted here yet — the shop is too modest for it. Orders join the queue.",
  "Мастерская с наковальней: клепает железные доспехи — 48 секунд и пять слитков на один. Зато в таком не страшно ни скелет, ни тёща.": "A workshop with an anvil: rivets iron armour — 48 seconds and five ingots apiece. In one of those, you fear neither skeleton nor mother-in-law.",

  // мелочи (js/life.js, oaths.js, reveal.js, leisure.js, defenseart.js, guildpath.js, guilds.js, jobs.js, main.js, menugroups.js, mobile.js, research.js, festival.js)
  "Столкновение: {0} уронил «{1}»{2}": "Collision: {0} dropped “{1}”{2}", "— подберут": "— will be picked up",
  ": дар и цена, круг {0} клеток": ": gift and price, radius {0} tiles", "(круг {0} клеток, обет {1})": "(radius {0} tiles, vow {1})",
  "Где что не так": "What’s Wrong Where", "{0}Показать всё сразу:": "{0}Show everything at once:",
  "Куры проучили: {0} оттащен в кусты{1}": "The chickens taught a lesson: {0} was dragged into the bushes{1}", "и хромает": "and limps",
  "близко": "close", "кнопка «Обучиться» в этом окне или клик героем по гильдии": "the “Train” button in this window, or click the guild with the hero",
  "на башне": "on the tower", "Каша из зерна…": "Porridge from grain…",
  "Дорога с разрывом: {0} кл. не проложено (дерево, камень, вода или дом) — по ней не пройдут. Обведите помеху или уберите её": "The road has a gap: {0} tiles not laid (tree, stone, water or house) — it can’t be walked. Route around the obstacle or remove it",
  "Настройки": "Settings", "{0}: коснитесь места или тяните здание{1}": "{0}: tap a spot or drag the building{1}",
  "{0}. Учёные гномы довольно чешут бороды": "{0}. The scholar gnomes scratch their beards contentedly",
  "Новый год! Все бросили работу: гуляем у трактира, Дед Мороз уже в пути": "New Year! Everyone dropped their work: we’re partying by the tavern, Santa is on his way",

  // нейтралы: названия (js/world/neutralart2.js)
  "Лесной тролль": "Forest Troll", "Каменный тролль": "Stone Troll", "Болотный тролль": "Swamp Troll", "Броненосец": "Armadillo", "Гоблин": "Goblin",
  "Гоблин с копьецом": "Goblin with a Little Spear", "Гномтавр-копейщик": "Gnometaur Spearman", "Гномтавр-лучник": "Gnometaur Archer",
  "Нора тролля": "Troll Burrow", "Каменная нора тролля": "Stone Troll Burrow", "Топкая нора тролля": "Boggy Troll Burrow",
  "Нора броненосца": "Armadillo Burrow", "Гоблинский лагерь": "Goblin Camp", "Стойбище гномтавров": "Gnometaur Camp",

  // лист земли (ground.html)
  "Лист вариантов земли": "Ground Variants Sheet", "Варианты ДНЕВНОЙ земли": "DAYTIME ground variants", "клеток": "tiles", "сид": "seed"
});
