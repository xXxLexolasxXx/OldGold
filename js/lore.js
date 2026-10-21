'use strict';
// Лор: история долины малыми порциями. После каждого шага обучения (и дальше — по ходу первых часов)
// случается короткая сцена: воспоминание старосты, находка, видение, письмо, голос из тьмы, чужой костёр.
// Одна сцена за раз — через общую очередь окон (notify.js, Notify.modal), можно «Дальше» и «Пропустить».
// Найденное складывается в журнал «Лор» (меню → «Лор: история долины»), главы — как в СЮЖЕТ.md.
// Прогресс — у игрока (localStorage oldgold.lore), а не у мира: в коопе каждый получает лор сам,
// сервер и хост ничего не знают и ничего не ждут. Условия читаются из общего состояния мира (зеркала).
// Данные LORE_CHAPTERS / LORE_FRAGS — простые массивы, их можно забрать для сайта и бестиария.

const LORE_KEY = 'oldgold.lore';
const LORE_TUT_GAP = 9;        // с. между сценами во время обучения (реального игрового времени)
const LORE_GAP = 150;          // с. между сценами после обучения
const LORE_IDLE = 16;          // с. без нажатий — сцена листается сама

const LORE_CHAPTERS = ['Приехали', 'Хлеб и недоверие', 'Пиво вместо совести', 'Свинья — друг гнома', 'Блеск и железо', 'Тишина дороже золота'];

const LORE_WHO = {
  grum: { name: 'Грум Ворчун', ch: 'Г', col: '#e0a050', bg: '#3a2a14' },
  yagla: { name: 'Бабушка Ягла', ch: 'Я', col: '#e8b4d4', bg: '#3a1e30' },
  pim: { name: 'Пим Чернилкин', ch: 'П', col: '#8ad8a8', bg: '#16302a' },
  mrak: { name: 'Малгор', ch: 'М', col: '#9cf06a', bg: '#2a1840' },
  note: { name: '', ch: '✎', col: '#e0c890', bg: '#2a2014' },
};
const LORE_KIND = { memory: 'Воспоминание', find: 'Находка', vision: 'Видение', voice: 'Голос из тьмы', letter: 'Письмо', fire: 'Вдалеке', song: 'Песня' };

// ---------- Условия ----------
const loreB = t => Game.buildings.some(b => b.type === t && !b.removed);
const loreDone = t => Game.buildings.some(b => b.type === t && b.state === 'done' && !b.removed);
const loreTut = i => typeof Tut !== 'undefined' && !!(Tut.ok && Tut.ok[i]);
const loreNights = () => (typeof goalNights === 'function' ? goalNights() : 0);
const loreDay = () => (typeof cycleAt === 'function' ? cycleAt(Game.time).k + 1 : 1);
const loreEve = () => typeof isEveningNow === 'function' && isEveningNow();
const loreProd = g => (Game.produced && Game.produced[g]) || 0;
const loreRoad = t => {
  const b = Game.buildings.find(x => x.type === t && !x.removed), s = Game.buildings.find(x => x.isStore && x.isStore() && !x.isPile);
  if (!b || !s || typeof compAt !== 'function') return false;
  const c = compAt(b.doorX, b.doorY);
  return !!c && c === compAt(s.doorX, s.doorY);
};
const loreFoe = n => !!(Game.foe && (Game.foe.stage || 0) >= n);
const loreCh = () => (Game.goal && Game.goal.mode === 'scenario' ? Game.goal.ch : -1);
const lorePeople = () => Game.units.filter(u => !u.dead && typeof isPerson === 'function' && isPerson(u)).length;

// ---------- Фрагменты ----------
// ch — глава журнала (1–6, как в СЮЖЕТ.md); tut — сцена этапа обучения (идёт сразу за ним);
// when — когда сцена может случиться; hint — подсказка в журнале, пока фрагмент не найден; chron — строка в летопись
const LORE_FRAGS = [
  // ===== Глава 1. Приехали — по шагам обучения =====
  {
    id: 'map', ch: 1, tut: true, kind: 'memory', title: 'Дедова карта', hint: 'Первые минуты в долине',
    when: () => loreTut(0) || Lore.playT > 50,
    lines: [
      ['grum', 'Дедова карта. «Долина Старого Золота: тут золото поёт по ночам». Дед много чего писал. Особенно после третьей кружки.'],
      ['note', 'На краю карты нарисована башня, а рядом подписано: «НЕ ШУМЕТЬ». Буквы дрожат.'],
    ],
    entry: 'Гномы зовут эту долину Старым Золотом. Сто лет назад здесь стояли их копи, потом предки ушли — быстро и не оглядываясь. Карта досталась Груму от деда. На ней есть всё, кроме объяснения, почему ушли.',
    chron: 'староста развернул дедову карту и объявил, что мы дома. Гномы сделали вид, что поверили.',
  },
  {
    id: 'home', ch: 1, tut: true, kind: 'memory', title: 'Что осталось от Подгорья', hint: 'Загляните на склад',
    when: () => loreTut(1) || Lore.playT > 110,
    lines: [
      ['note', 'На складе — всё, что влезло в повозки: брёвна, пара мешков и старая кирка с зарубками.'],
      ['grum', 'Сто лет жили под Брюзгой-горой. Потом гора решила, что с неё хватит, и легла нам на крыши. Обиделась, наверное.'],
    ],
    entry: 'Подгорье — прежний дом лесных гномов, под горой Брюзгой. Копи расшатали гору, и однажды весной она просела. Выбрались все, но дом остался под камнем. Тогда Грум и вспомнил про дедову карту.',
  },
  {
    id: 'forest', ch: 1, tut: true, kind: 'vision', title: 'Лес помнит', hint: 'Первый лесоруб',
    when: () => loreB('woodcutter'),
    lines: [
      ['note', 'Первое дерево упало со стоном. Где-то в чаще ему ответили — тихо и без слов.'],
      ['yagla', 'Этот лес помнит наших прадедов. Не в хорошем смысле.'],
    ],
    entry: 'Старые деревья долины живут дольше гномов и спят чутко. Ночью некоторые открывают глаза и бродят у своих корней. Бабушка Ягла говорит, что они не злые: просто с ними давно никто не разговаривал, кроме топора.',
  },
  {
    id: 'road', ch: 1, tut: true, kind: 'find', title: 'Старая дорога и чужие следы', hint: 'Первая дорога к складу',
    when: () => loreTut(2) || loreRoad('woodcutter'),
    lines: [
      ['note', 'Под мхом нашлась старая мостовая — гномья, с клеймом-молоточком. По ней кто-то недавно прошёл.'],
      ['grum', 'Следы длинные, узкие и босые. Для гнома великоваты, для человека тощеваты. Ведут к башне. Я туда не пойду. Я посмотрел.'],
    ],
    entry: 'Предки мостили дороги от копей до складов — по старым камням и теперь удобно ходить. Чьи следы, неизвестно. Скорее всего, слуги из башни: они выходят в туман, когда в долине становится слишком светло.',
    chron: 'под мхом нашли дорогу предков, а на ней — чужие следы. Следы вели к башне. Мы — нет.',
  },
  {
    id: 'stamp', ch: 1, tut: true, kind: 'find', title: 'Камень с клеймом', hint: 'Каменоломня',
    when: () => loreTut(3) || loreB('quarry'),
    lines: [
      ['note', 'Каменотёс отколол глыбу, а на ней клеймо: фонарь и молот.'],
      ['yagla', 'Знак Фонарщиков. Они держали в долине свет всю ночь. Пока свет горел, башня спала.'],
    ],
    entry: 'Фонарщики — старая гномья гильдия. Каждую ночь они зажигали огни вдоль дорог и у копей. Гильдия пропала вместе с долиной, а привычка носить фонарь осталась у каждого гнома — даже у тех, кто не помнит зачем.',
  },
  {
    id: 'sawdust', ch: 1, tut: true, kind: 'memory', title: 'Староста вспоминает дом', hint: 'Лесопилка',
    when: () => loreTut(4) || loreB('sawmill'),
    lines: [
      ['grum', 'Пахнет опилками — как в отцовской мастерской в Подгорье. Отец пилил, я подметал. Двести лет прошло, а я всё подметаю. Только теперь — за всеми.'],
      ['note', 'Грум отвернулся и сказал, что опилка попала в глаз. Опилок ещё не было.'],
    ],
    entry: 'Грум Ворчун — староста переселенцев и бывший прораб Подгорья. Ворчит на всё, что построено криво, и на всё, что построено прямо, — для порядка. Гномы его слушаются: только он умеет читать дедову карту.',
  },
  {
    id: 'seeds', ch: 1, tut: true, kind: 'memory', title: 'Последняя горсть', hint: 'Ферма',
    when: () => loreTut(5) || loreB('farm'),
    lines: [
      ['yagla', 'Это зерно мы везли из Подгорья в кисете. Одна горсть. Не просыпьте — второй нет.'],
      ['grum', 'Засеять горстью целое поле? Гномы и не такое делали. Обычно — на спор.'],
    ],
    entry: 'Под горой гномы растили грибы, а у предков в долине были поля. Ягла хранила зерно сто лет — по крайней мере, так она говорит. Скорее всего, сорок. Ягла — старшая в деревне и помнит все песни, даже те, которые лучше бы забыть.',
  },
  {
    id: 'song', ch: 1, tut: true, kind: 'song', title: 'Песня предков', hint: 'Первый хлеб',
    when: () => loreTut(6) || loreProd('bread') >= 1 || loreDone('bakery'),
    lines: [
      ['note', 'Из пекарни потянуло хлебом, и Ягла запела. Остальные подхватили — кто как помнил:'],
      ['yagla', '«Горит фонарь, печётся хлеб, — пока огонь, и мы живём. А тьме — ни крошки, ни монет: мы до рассвета подождём».'],
      ['grum', 'Был ещё куплет — про башню. Его никто не поёт. Говорят, к утру он сбывается.'],
    ],
    entry: 'Хлебная песня — самое старое, что гномы унесли из долины. Её поют у печи и у костра. Последний куплет забыли нарочно: в нём кто-то в Шпиле просыпается от шума.',
    chron: 'испекли первый хлеб и спели песню предков. Последний куплет, как положено, пропустили.',
  },
  {
    id: 'barrel', ch: 1, tut: true, kind: 'letter', title: 'Записка в бочке', hint: 'Вкладка «Хозяйство»',
    when: () => loreTut(7) || Lore.playT > 600,
    lines: [
      ['note', 'В трактире нашлась старая бочка, а в ней записка прадеда: «Кто читает — значит, вернулись. Свет не гасите. Камни не трогайте. Пиво — не досуха».'],
      ['grum', 'Свет — понял. Пиво — понял. Про камни потом разберёмся.'],
    ],
    entry: 'Записки предков находятся в самых неожиданных местах: в бочках, под порогом, в сапогах. Все советуют одно и то же — не гасить свет. Некоторые — ещё и вернуть какие-то камни.',
  },
  {
    id: 'lantern', ch: 1, tut: true, kind: 'memory', title: 'Внук Фонарщика', hint: 'Первое дело героя',
    when: () => loreTut(8) || !!(Game.hero && Game.hero.cmd && Game.hero.cmd.kind && Game.hero.cmd.kind !== 'move'),
    lines: [
      ['note', 'У героя на поясе — старый фонарь с клеймом-молотом. Достался от прадеда вместе с фляжкой.'],
      ['grum', 'Его прадед был последним Фонарщиком. Фонарь, говорят, так и не погасил. А фляжку так и не допил. Семья держит слово.'],
    ],
    entry: 'Герой — потомок Фонарщиков. Он быстрее и упрямее остальных, лечится у огня и не боится темноты — по крайней мере, вслух. Гильдии долины научат его ремеслу, а фонарь — прадедовской привычке не отступать.',
  },
  {
    id: 'shadow', ch: 1, tut: true, kind: 'voice', title: 'Тень у леса', hint: 'Первый вечер', soon: true,
    when: () => loreEve() && typeof nightAmt === 'function' && nightAmt() > 0.15,
    lines: [
      ['note', 'Стемнело. У кромки леса стоит высокая тень. Там, где у людей лицо, — две зелёные искры.'],
      ['mrak', '…Опять свет. Опять стук. Сто лет тишины — и вот…'],
      ['grum', 'Все слышали? Отлично, значит, не я один сошёл с ума. Костёр — ярче!'],
    ],
    entry: 'Голос из тьмы слышат все гномы разом — и каждый думает, что ему одному. Он приходит с туманом, ругается на шум и уходит к рассвету. Ягла уверена, что это хозяин Шпиля. Грум уверен, что это сквозняк. Сквозняк, который разговаривает.',
    chron: 'в первую ночь из тьмы кто-то пожаловался на шум. Шуметь, разумеется, не перестали.',
  },
  {
    id: 'smoke', ch: 1, tut: true, kind: 'fire', title: 'Чужой костёр', hint: 'Пережить первую ночь',
    when: () => loreNights() >= 1 && !loreEve(),
    lines: [
      ['note', 'На рассвете далеко за лесом поднялся дым. Кто-то ещё жжёт костры в этой долине.'],
      ['grum', 'Соседи? Беглые? Или ещё кто-то с картой своего деда? Ладно, пусть живут. Пока не начнут шуметь громче нас.'],
    ],
    entry: 'Мы в долине не одни: в лесах бродят дикие гномы, путники и прочие, у кого тоже бывают костры. Кто-то из них ещё постучится в деревню — с подарком или с бедой.',
  },

  {
    id: 'pim1', ch: 1, kind: 'memory', title: 'Летописец', hint: 'Пережить первую ночь и немного пожить',
    when: () => loreNights() >= 1 && Lore.playT > 420 && !loreEve(),
    lines: [
      ['pim', 'Я — Пим Чернилкин, летописец. Буду записывать всё, что вы делаете. Для истории. И для… истории.'],
      ['note', 'Чернила у Пима зелёные. Говорит, других в Подгорье не нашлось. В Подгорье, кажется, вообще не было зелёных чернил.'],
      ['grum', 'Пиши, пиши. Только меня рисуй выше. И без живота.'],
    ],
    entry: 'Пим Чернилкин ведёт летопись деревни: что построили, кто погиб, кто опять уронил бочку. Пришёл к переселенцам за день до отъезда из Подгорья и с тех пор ни на шаг не отстаёт. Пишет всё в двух экземплярах — «на всякий случай».',
    chron: 'Пим Чернилкин завёл летопись. Пишет в двух экземплярах — на всякий случай.',
  },

  // ===== Глава 2. Хлеб и недоверие =====
  {
    id: 'spire', ch: 2, kind: 'vision', title: 'Огарок на скале', hint: 'Второй день в долине',
    when: () => loreNights() >= 1 && loreDay() >= 2 && !loreEve(),
    lines: [
      ['note', 'Утро ясное, и наконец башню видно целиком: чёрная, тонкая, как обгоревшая свеча. Предки звали её Огарком.'],
      ['yagla', 'Чёрный шпиль. В нём живёт Малгор. Не говорите имя громко — он не любит громкое.'],
    ],
    entry: 'Чёрный шпиль стоит на дальнем краю долины. По вечерам в нём светятся зелёные окна. Хозяина зовут Малгор, и это всё, что гномы знают наверняка. Остальное — слухи, а слухи в трактире бесплатные.',
    chron: 'Ягла впервые назвала хозяина башни по имени. Шёпотом.',
  },
  {
    id: 'stones', ch: 2, kind: 'memory', title: 'Сто лет назад', hint: 'Пусть деревня подрастёт',
    when: () => loreNights() >= 2 && (lorePeople() >= 10 || loreProd('bread') >= 15),
    lines: [
      ['yagla', 'Сто лет назад наши нашли под Огарком жилу. Камни светились, как угли, и пели. Копали день и ночь.'],
      ['yagla', 'А потом камни замолчали, а ночи — заговорили. Вот тогда и ушли.'],
      ['grum', 'То есть дед утащил у соседа камни и сбежал. Ну хоть карту оставил. Честный был жулик.'],
    ],
    entry: 'Магические камни — то самое «старое золото» долины. Предки унесли их в Подгорье, и там камни кончились. Малгор, похоже, считает, что камни были его. Грум считает, что камни были ничьи, пока их не выкопали.',
    chron: 'узнали, зачем предки ушли из долины. Гордиться пока нечем.',
  },
  {
    id: 'dreams', ch: 2, kind: 'voice', title: 'Почему оживает лес', hint: 'Третья ночь',
    when: () => loreNights() >= 2 && loreEve(),
    lines: [
      ['mrak', 'Свет режет мне сон. А пока я сплю, вашу ночь стерегут мои сны. Не будите их — они голодные.'],
      ['note', 'Наутро гномы долго спорили, что это значило. Сошлись на том, что фонарей нужно больше.'],
    ],
    entry: 'Малгор спит в Шпиле, а его сны бродят по долине: скелеты, призраки, ожившие деревья. Свет их отгоняет — у большого костра нечисть не держится. Фонарщики это знали и не давали долине погаснуть. Потом гильдии не стало.',
  },

  {
    id: 'pim2', ch: 2, kind: 'memory', title: 'Вторая копия', hint: 'Утро после третьей ночи',
    when: () => loreHas('pim1') && loreNights() >= 3 && !loreEve(),
    lines: [
      ['grum', 'Пим, а зачем тебе вторая копия летописи?'],
      ['pim', 'Для архива! Архив далеко. Очень далеко. В общем, не спрашивайте.'],
      ['note', 'Утром от окна летописца улетел ворон. Чёрный, с зелёными глазами. В сторону Шпиля.'],
    ],
    entry: 'Вторую копию летописи Пим каждый вечер сворачивает трубочкой и уносит «в архив». Где архив, никто не знает. Ягла думает, что Пим просто стесняется своего почерка.',
  },

  // ===== Глава 3. Пиво вместо совести =====
  {
    id: 'boot', ch: 3, kind: 'letter', title: 'Рецепт в сапоге', hint: 'Пиво',
    when: () => loreB('brewery') || loreProd('beer') >= 1,
    lines: [
      ['note', 'В старом сапоге под крыльцом — рецепт тёмного пива и приписка: «Малгору не наливать. Он потом поёт».'],
      ['grum', 'Малгор пил с нашими? Значит, когда-то дружили. Или это был очень длинный вечер.'],
    ],
    entry: 'Похоже, когда-то гномы и Малгор жили по соседству без войны: пили, торговали, ругались по-соседски. Что испортило дружбу — камни, шум или песни, — записки молчат. Говорят только, что пел он плохо.',
  },
  {
    id: 'ghosts', ch: 3, kind: 'vision', title: 'Те, кто не ушёл', hint: 'Первая потеря или первый призрак',
    when: () => (Game.lostGnomes || 0) > 0 || !!(Game.ghosts && Game.ghosts.length),
    lines: [
      ['note', 'Призрак у дороги остановился, посмотрел на фонарь и побрёл дальше — к Шпилю.'],
      ['yagla', 'Наши, что погибли здесь сто лет назад, так и не ушли: Шпиль держит их. Новых своих ему не отдавайте.'],
    ],
    entry: 'Погибший гном ночью возвращается призраком и уходит служить снам Шпиля. Поэтому гномы так держатся за огонь и друг за друга. Жнец забирает тех, кого не успели спасти. С ним не спорят: у него график.',
  },
  {
    id: 'long', ch: 3, kind: 'voice', title: 'Долгая ночь', hint: 'Дожить до пятой ночи',
    when: () => loreNights() >= 4 && loreEve(),
    lines: [
      ['mrak', 'Раз в пять ночей я ворочаюсь. Не обижайтесь на то, что выйдет из леса.'],
      ['grum', 'Он ещё и предупреждает. Вежливый. Хуже нет вежливых злодеев.'],
    ],
    entry: 'Каждая пятая ночь дольше и злее: Малгор во сне переворачивается на другой бок, и из тумана выходят странные гости — студни, лампоглавы и прочие, кого лучше не описывать на ночь.',
    chron: 'Малгор предупредил о долгой ночи. Вежливо. Стало только страшнее.',
  },

  {
    id: 'pim3', ch: 3, kind: 'vision', title: 'Птицы любят Пима', hint: 'Вороны Шпиля или пятая ночь',
    when: () => loreHas('pim2') && (loreFoe(2) || loreNights() >= 5) && !loreEve(),
    lines: [
      ['note', 'Ворон-разведчик сел на крышу летописца и улетел молча. На всех остальных он каркал.'],
      ['pim', 'Птицы меня любят! Это… талант. Врождённый.'],
      ['grum', 'Птицы любят крошки. Ты, Пим, не крошка. Ты подозрительный.'],
    ],
    entry: 'Вороны Шпиля облетают деревню каждый вечер и каркают на всех, кроме Пима. Ещё Пим не ходит к большому костру: говорит, от огня чернила сохнут. Гномы пожимают плечами — у каждого свои странности.',
  },

  // ===== Глава 4. Свинья — друг гнома =====
  {
    id: 'armor', ch: 4, kind: 'find', title: 'Броня с вмятинами', hint: 'Дубильня или мастерская доспехов',
    when: () => loreB('tannery') || loreB('armory'),
    lines: [
      ['note', 'Дубильщик выделал первую кожу и вспомнил: в Подгорье доспехи передавали по наследству. Вместе с вмятинами.'],
      ['grum', 'Слышите, как тихо стало по ночам? Это не к добру. Это Шпиль набирает воздух.'],
    ],
    entry: 'Лесные гномы — не воины, но и не дураки: доспех у них чинят дольше, чем носят. Каждая вмятина — семейная история, и почти все истории кончаются словами «а потом из тумана…».',
  },

  // ===== Глава 5. Блеск и железо =====
  {
    id: 'windows', ch: 5, kind: 'vision', title: 'Окна загорелись', hint: 'Шпиль заметит деревню',
    when: () => loreFoe(1) || loreCh() >= 4,
    lines: [
      ['note', 'Ночью окна Шпиля вспыхнули разом. Над лесом зажглись дозорные огни.'],
      ['mrak', 'Ах вот вы кто. Внуки воров. Я узнал вас по шуму.'],
    ],
    entry: 'Когда деревня растёт, Малгор просыпается всё больше: сначала зажигает окна, потом шлёт воронов-разведчиков, проклятия и, наконец, слуг из тумана. Свет, костры и фонари — по-прежнему лучшая защита.',
    chron: 'Шпиль заметил деревню. Окна загорелись зелёным, и спать стало труднее всем.',
  },
  {
    id: 'singing', ch: 5, kind: 'find', title: 'Камень запел', hint: 'Рудник',
    when: () => loreB('goldmine') || loreB('ironmine'),
    lines: [
      ['note', 'В руднике нашли камень, который светится и тихо гудит. Ягла заплакала. Грум сказал, что это пыль.'],
      ['yagla', 'Он поёт тот самый куплет. Последний. Про башню.'],
    ],
    entry: 'В глубине долины ещё остались камни из той жилы. Если приложить ухо, слышно мелодию — ту самую, хлебную. Только медленнее, будто её поёт кто-то во сне.',
  },

  {
    id: 'pim4', ch: 5, kind: 'memory', title: 'Недооценённый сосед', hint: 'Проклятия Шпиля или глава 5',
    when: () => loreHas('pim3') && (loreFoe(3) || loreCh() >= 4),
    lines: [
      ['pim', 'А вы не думали, что Малгор просто недооценён? Одинокий, умный, с хорошей башней…'],
      ['yagla', 'Пим, сынок, ты чего?'],
      ['pim', 'Ничего! Шучу! Ха. Ха-ха. Записываю: «все смеялись».'],
    ],
    entry: 'Чем ближе поход к Шпилю, тем больше Пим спрашивает: сколько бойцов, сколько хлеба, когда выходим. «Для летописи», — говорит он и пишет зелёными чернилами очень мелко.',
  },

  // ===== Глава 6. Тишина дороже золота =====
  {
    id: 'truth', ch: 6, kind: 'voice', title: 'Кто такой Малгор', hint: 'Последняя глава или осада',
    when: () => loreFoe(4) || loreCh() >= 5,
    lines: [
      ['yagla', 'Камни — это его сны. Малгор складывал их в скалу, чтобы спать спокойно. А мы выкопали сны колдуна, и они разбежались по ночам.'],
      ['mrak', 'Верните мне тишину. Или я заберу её у вас — вместе со светом.'],
      ['grum', 'Тогда я бы тоже разозлился. Но бить всё равно пойдём: он первый начал. Ну, вторым. Неважно.'],
    ],
    entry: 'Малгор — не просто злодей из башни. Он спит сто лет и не может уснуть по-настоящему: его сны унесли в мешках гномьи прадеды. Отсюда нечисть, проклятия и набеги. Чтобы ночи снова стали ночами, Шпиль придётся погасить.',
    chron: 'Ягла рассказала правду о камнях. Правда оказалась неудобной, но поход никто не отменил.',
  },
  {
    id: 'pim5', ch: 6, kind: 'letter', title: 'Агенту П. Ч.', hint: 'Подъём к шпилю',
    when: () => { const T = Game.foe && Game.foe.tiers, S = T && T.as && T.as.tr; return !!(S && S.st && S.st !== 'tag' && S.st !== 'reveal'); },
    lines: [
      ['note', 'Ворон Шпиля перепутал адресата: «Агенту П. Ч., лично. Отчёт получил. Веди их выше. — М.»'],
      ['pim', 'Я могу объяснить! Он платил сухарями!'],
      ['grum', 'Летописец. Вторая копия. Вороны. Зелёные чернила. А я думал, у него просто плохой вкус.'],
    ],
    entry: 'Пим Чернилкин двенадцать лет писал Малгору донесения: сначала из Подгорья, потом из долины. Вторая копия летописи уходила в Шпиль с воронами. Чем это кончилось — решать тому, кто прочёл письмо.',
    chron: 'ворон Малгора перепутал адресата, и мы узнали, кому Пим писал вторую копию летописи.',
  },
  {
    id: 'silence', ch: 6, kind: 'fire', title: 'Тишина', hint: 'Победить Малгора',
    when: () => !!(Game.foe && Game.foe.defeated) || !!(Game.goal && Game.goal.flags && Game.goal.flags.darkMage === 'dead'),
    lines: [
      ['note', 'Шпиль погас. Впервые за сто лет над долиной — обычная ночь, без чужих снов.'],
      ['grum', 'Теперь шум наш. По праву. И, пожалуйста, по расписанию.'],
    ],
    entry: 'После Малгора ночь в долине — просто ночь: темно, тихо, сверчки. Гномы по привычке всё равно зажигают фонари. Ягла наконец спела последний куплет. Ничего не случилось. Все немного расстроились.',
  },
];

// ---------- Состояние ----------

const Lore = { found: {}, unread: 0, playT: 0, lastAt: -999, pend: null, cur: null, el: null, fx: null, typing: 0, idle: 0, world: '', silent: false, bookOpen: false };
const LORE_ON = typeof document !== 'undefined' && typeof window !== 'undefined' && !window.__SERVER__;

function loreLoad() {
  try { const s = JSON.parse(localStorage.getItem(LORE_KEY) || '{}') || {}; Lore.found = s.f || {}; Lore.unread = s.u || 0; } catch (e) { Lore.found = {}; }
}
function loreSave() {
  try { localStorage.setItem(LORE_KEY, JSON.stringify({ f: Lore.found, u: Lore.unread })); } catch (e) { /* нет хранилища — лор на этот сеанс */ }
}
const loreHas = id => !!Lore.found[id];
const loreCount = () => LORE_FRAGS.filter(f => loreHas(f.id)).length;
function loreFind(f, silent) {
  if (loreHas(f.id)) return;
  Lore.found[f.id] = Date.now();
  Lore.unread++;
  loreSave();
  if (!silent && f.chron && typeof chronAdd === 'function' && typeof chronWhen === 'function') { try { chronAdd('lore', chronWhen() + ' ' + f.chron, 1); } catch (e) { /* летопись подождёт */ } }
  if (typeof track === 'function') track('lore-' + f.id, 'Лор: ' + f.title);
  loreMenuBadge();
}

// в сценарии фрагменты следующих глав ждут свою главу (глава журнала = глава СЮЖЕТ.md)
function loreChapterOk(f) {
  const g = Game.goal;
  if (!g || g.mode !== 'scenario') return true;
  return f.ch <= g.ch + 2;
}

function loreReady(f) {
  if (loreHas(f.id) || !loreChapterOk(f)) return false;
  try { return !!f.when(); } catch (e) { return false; }
}

function loreMenuOpen() {
  if (typeof StartMenu !== 'undefined' && StartMenu.open) return true;
  const ld = document.getElementById('loading');
  return !!(ld && !ld.classList.contains('hidden'));
}

function loreTick(dt) {
  if (!Game.units || !Game.units.length || loreMenuOpen()) return;
  // новый мир / загрузка: в старом мире (до этой версии) всё, что уже позади, ложится в журнал молча
  const wk = String(Game.seed) + ':' + (typeof Coop !== 'undefined' && Coop.on ? 'c' : 's');
  if (Lore.world !== wk) {
    Lore.world = wk; Lore.playT = 0; Lore.lastAt = -999;
    const coop = typeof Coop !== 'undefined' && Coop.on;
    if (!coop && !loreCount() && (Game.time || 0) > 1200) {
      let n = 0;
      for (const f of LORE_FRAGS) if (f.tut && loreReady(f)) { loreFind(f, true); n++; }
      if (n) setTimeout(() => toast(t('В журнале «Лор» — {0} записей об истории долины (меню → «Лор»)', n)), 30000);
    }
  }
  if (!Game.paused) Lore.playT += dt;
  if (Lore.pend || Lore.cur) return;
  const tutOn = typeof Tut !== 'undefined' && Tut.on;
  const tutLeft = LORE_FRAGS.some(f => f.tut && !loreHas(f.id));
  // сцены обучения — часто и по порядку шагов; остальное — реже и после главы 1; «к сроку» (вечер) — вне очереди
  const ready = LORE_FRAGS.filter(f => (f.tut || f.soon || !(tutOn || tutLeft && Lore.playT < 1500)) && loreReady(f));
  const f = ready.find(x => x.soon) || ready[0];
  if (!f || Lore.playT < 6) return;
  if (Lore.playT - Lore.lastAt < (f.soon ? 4 : f.tut ? LORE_TUT_GAP : LORE_GAP)) return;
  loreQueue(f);
}

// на экране плашка «Новое: …» (reveal.js) — она стоит там же, где сцена: ждём, пока догорит
const loreRvBusy = () => !!document.querySelector('.rv-note:not(.out)');

function loreQueue(f) {
  Lore.pend = f;
  const show = () => {
    if (loreRvBusy()) { setTimeout(show, 700); return; }
    Lore.pend = null; if (!loreHas(f.id)) loreShow(f);
  };
  if (typeof Notify !== 'undefined' && Notify.modal) Notify.modal('lore:' + f.id, show, 1);
  else show();
}

// ---------- Сцена ----------

const loreEsc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const loreReduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

function loreEls() {
  if (Lore.el) return;
  Lore.fx = document.createElement('div'); Lore.fx.id = 'lore-fx'; Lore.fx.className = 'hidden';
  Lore.el = document.createElement('div'); Lore.el.id = 'lore-card'; Lore.el.className = 'hidden';
  document.body.append(Lore.fx, Lore.el);
  Lore.el.addEventListener('click', e => {
    const b = e.target.closest('[data-lc]');
    Lore.idle = 0;
    if (!b) { if (Lore.typing) loreTypeAll(); return; }
    const k = b.dataset.lc;
    if (k === 'next') loreNext();
    if (k === 'skip') loreClose();
    if (k === 'book') { loreClose(); loreBookOpen(Lore.lastId); }
  });
}

function loreShow(f) {
  loreEls();
  Lore.cur = { f, i: 0 };
  Lore.lastId = f.id;
  Lore.lastAt = Lore.playT;
  loreFind(f);
  Lore.el.setAttribute('data-nq-modal', '');   // держит общую очередь окон, пока открыта
  Lore.el.className = 'k-' + f.kind;
  Lore.fx.className = 'k-' + f.kind;
  Lore.fx.innerHTML = f.kind === 'song' ? '<i>♪</i><i>♫</i><i>♪</i><i>♩</i>' : f.kind === 'find' ? '<i></i><i></i><i></i><i></i><i></i>' : '';
  loreSfx(f.kind);
  loreRender();
}

function loreWho(k) {
  if (k === 'hero' && Game.hero && Game.hero.hero) return { name: Game.hero.hero.name, ch: '⚒', col: '#f6d458', bg: '#2a2014' };
  return LORE_WHO[k] || LORE_WHO.note;
}

function loreRender() {
  const { f, i } = Lore.cur, L = f.lines[i], w = loreWho(L[0]), last = i >= f.lines.length - 1;
  const text = t(L[1]);
  Lore.el.innerHTML = `
    <div class="lc-top"><span class="lc-kind">${loreEsc(t(LORE_KIND[f.kind] || ''))}</span><b>${loreEsc(t(f.title))}</b><span class="lc-ch">${loreEsc(t('Глава {0}', f.ch))}</span></div>
    <div class="lc-say"><div class="lc-face" style="background:${w.bg};color:${w.col};border-color:${w.col}">${w.ch}</div>
      <div class="lc-body">${w.name ? `<div class="lc-name" style="color:${w.col}">${loreEsc(t(w.name))}</div>` : ''}<div class="lc-text${L[0] === 'note' ? ' note' : ''}${L[0] === 'mrak' ? ' dark' : ''}"></div></div></div>
    <div class="lc-btns"><button data-lc="skip">${loreEsc(t('Пропустить'))}</button>${last ? `<button data-lc="book">${loreEsc(t('В журнал «Лор»'))}</button>` : ''}<span class="lc-dots">${f.lines.map((x, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</span>
      <button data-lc="next" class="primary">${loreEsc(t(last ? 'Закрыть' : 'Дальше ▸'))}</button></div>`;
  Lore.el.classList.remove('hidden');
  Lore.fx.classList.remove('hidden');
  Lore.idle = 0;
  loreType(Lore.el.querySelector('.lc-text'), text);
}

// текст печатается по буквам; касание — сразу весь
function loreType(el, text) {
  clearInterval(Lore.typing); Lore.typing = 0;
  Lore.full = { el, text };
  if (loreReduced()) { el.textContent = text; return; }
  let n = 0;
  el.textContent = '';
  Lore.typing = setInterval(() => {
    n = Math.min(text.length, n + 2);
    el.textContent = text.slice(0, n);
    if (n >= text.length) { clearInterval(Lore.typing); Lore.typing = 0; }
  }, 32);
}
function loreTypeAll() {
  clearInterval(Lore.typing); Lore.typing = 0;
  if (Lore.full) Lore.full.el.textContent = Lore.full.text;
}

function loreNext() {
  if (!Lore.cur) return;
  if (Lore.typing) { loreTypeAll(); return; }
  if (Lore.cur.i >= Lore.cur.f.lines.length - 1) { loreClose(); return; }
  Lore.cur.i++;
  if (typeof uiSfx === 'function') uiSfx('click', 0.6);
  loreRender();
}

function loreClose() {
  clearInterval(Lore.typing); Lore.typing = 0;
  Lore.cur = null;
  if (!Lore.el) return;
  Lore.el.removeAttribute('data-nq-modal');
  Lore.el.classList.add('out');
  Lore.fx.classList.add('out');
  setTimeout(() => { if (!Lore.cur) { Lore.el.className = 'hidden'; Lore.fx.className = 'hidden'; } }, 450);
}

// сцену никто не листает — листается сама (новичок не застрянет, очередь окон не встанет)
function loreIdleTick(dt) {
  if (!Lore.cur || Lore.typing) return;
  Lore.idle += dt;
  if (Lore.idle > LORE_IDLE) { Lore.idle = 0; loreNext(); }
}

// ---------- Звук: короткие мотивы на шине интерфейса, свой синтез ----------

function loreSfx(kind) {
  if (typeof Sfx === 'undefined' || !Sfx.ctx || !Sfx.on || Sfx.ctx.state !== 'running' || typeof AudioCore === 'undefined' || !AudioCore.ui || typeof tone !== 'function') return;
  const ctx = Sfx.ctx, t0 = ctx.currentTime + 0.03, g = ctx.createGain();
  g.gain.value = 0.5; g.connect(AudioCore.ui);
  const pluck = (f, t, v = 0.5) => modal(g, t, [[f, 1, 1.1], [f * 2, 0.3, 0.6], [f * 3.01, 0.12, 0.35]], v, 0.004);
  try {
    if (kind === 'memory') [392, 494, 587, 740].forEach((f, k) => pluck(f, t0 + k * 0.16, 0.38));
    else if (kind === 'find') { [1318, 1760, 2349].forEach((f, k) => modal(g, t0 + k * 0.08, [[f, 1, 0.9], [f * 2.76, 0.2, 0.3]], 0.22)); noiseHit(g, 'highpass', 6000, 9000, 0.7, t0, 0.5, 0.05, 0.05); }
    else if (kind === 'vision') { tone(g, 'sine', 110, 104, t0, 2.6, 0.22, 0.7); tone(g, 'sine', 165, 158, t0 + 0.2, 2.3, 0.12, 0.7); [1568, 1976, 2349].forEach((f, k) => modal(g, t0 + 0.5 + k * 0.3, [[f, 1, 1.4]], 0.06, 0.2)); }
    else if (kind === 'voice') { tone(g, 'triangle', 92, 58, t0, 1.9, 0.32, 0.25); tone(g, 'sine', 138, 87, t0 + 0.1, 1.7, 0.14, 0.3); breath(g, t0, 1.6, 900, 300, 0.12, 0.4); }
    else if (kind === 'letter') { noiseHit(g, 'bandpass', 2600, 1800, 1.4, t0, 0.18, 0.2, 0.02); noiseHit(g, 'bandpass', 3200, 2200, 1.4, t0 + 0.22, 0.22, 0.16, 0.02); pluck(659, t0 + 0.45, 0.25); }
    else if (kind === 'fire') { for (let k = 0; k < 7; k++) noiseHit(g, 'bandpass', 1500 + Math.random() * 2500, 1200, 3, t0 + k * 0.11 + Math.random() * 0.05, 0.015, 0.22, 0.001); tone(g, 'sine', 196, 196, t0, 1.6, 0.1, 0.5); }
    else if (kind === 'song') [[294, 0], [349, 0.28], [392, 0.56], [440, 0.84], [392, 1.2], [349, 1.48], [294, 1.8]].forEach(([f, d]) => { tone(g, 'triangle', f, f, t0 + d, 0.34, 0.16, 0.03); pluck(f / 2, t0 + d, 0.12); });
  } catch (e) { /* без звука */ }
}

// ---------- Журнал «Лор» ----------

function loreBookHTML(focus) {
  const total = LORE_FRAGS.length, got = loreCount();
  let h = `<div class="lb-title">${loreEsc(t('Лор: история долины'))}<br><small>${loreEsc(t('Найдено {0} из {1}', got, total))}</small></div>`;
  LORE_CHAPTERS.forEach((name, k) => {
    const list = LORE_FRAGS.filter(f => f.ch === k + 1), open = list.some(f => loreHas(f.id));
    h += `<div class="lb-ch${open ? '' : ' locked'}">${loreEsc(t('Глава {0}', k + 1))}. ${open ? loreEsc(t(name)) : '???'}<i>${list.filter(f => loreHas(f.id)).length}/${list.length}</i></div>`;
    if (!open) { h += `<p class="lb-lock">${loreEsc(t('Эта глава ещё впереди.'))}</p>`; return; }
    for (const f of list) {
      if (!loreHas(f.id)) { h += `<div class="lb-f locked"><b>???</b><span>${loreEsc(t('Ещё не найдено. Подсказка: {0}', t(f.hint || '…')))}</span></div>`; continue; }
      const quotes = f.lines.map(L => { const w = loreWho(L[0]); return `<p class="lb-q">${w.name ? `<b style="color:${w.col}">${loreEsc(t(w.name))}:</b> ` : ''}${loreEsc(t(L[1]))}</p>`; }).join('');
      h += `<div class="lb-f${f.id === focus ? ' open' : ''}" data-lf="${f.id}"><b>${loreEsc(t(f.title))}<i>${loreEsc(t(LORE_KIND[f.kind] || ''))}</i></b><div class="lb-b"><p class="lb-e">${loreEsc(t(f.entry))}</p>${quotes}<button data-lb="replay" data-id="${f.id}">${loreEsc(t('Показать сцену ещё раз'))}</button></div></div>`;
    }
  });
  return h;
}

function loreBookOpen(focus) {
  if (typeof Mobile !== 'undefined' && Mobile.on && typeof mobileSheet === 'function') mobileSheet(null);
  let el = document.getElementById('lore-book');
  if (!el) {
    el = document.createElement('div');
    el.id = 'lore-book'; el.className = 'hidden';
    el.innerHTML = `<div class="lb-box"><div class="lb-head"><button id="lb-x" title="${loreEsc(t('Закрыть (Esc)'))}">✕</button></div><div id="lb-body"></div></div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => {
      if (e.target === el || e.target.id === 'lb-x') { loreBookClose(); return; }
      const r = e.target.closest('[data-lb="replay"]');
      if (r) { const f = LORE_FRAGS.find(x => x.id === r.dataset.id); loreBookClose(); if (f && !Lore.cur) loreShow(f); return; }
      const c = e.target.closest('.lb-f[data-lf]');
      if (c) c.classList.toggle('open');
    });
  }
  document.getElementById('lb-body').innerHTML = loreBookHTML(focus);
  el.classList.remove('hidden');
  el.setAttribute('data-nq-modal', '');   // пока журнал открыт, обучение не тушит экран, а окна из очереди ждут
  Lore.bookOpen = true;
  Lore.unread = 0; loreSave(); loreMenuBadge();
  if (focus) { const c = el.querySelector(`[data-lf="${focus}"]`); if (c) c.scrollIntoView({ block: 'center' }); }
  if (typeof track === 'function') track('lore-book', 'Открыл журнал «Лор»');
}
function loreBookClose() { const el = document.getElementById('lore-book'); if (el) { el.classList.add('hidden'); el.removeAttribute('data-nq-modal'); } Lore.bookOpen = false; }

function loreMenuBadge() {
  if (!LORE_ON) return;
  const b = document.querySelector('#tab-menu [data-lore="open"] .lore-n');
  if (b) b.textContent = Lore.unread ? ' · ' + Lore.unread : '';
}
function loreMenu() {
  const list = document.querySelector('#tab-menu .menu-list');
  if (!list || list.querySelector('[data-lore]')) return;
  const chron = list.querySelector('[data-chron]');
  const html = `<button data-lore="open"><img data-icon="log" alt="">${loreEsc(t('Лор: история долины'))}<span class="lore-n"></span></button>`;
  if (chron) chron.insertAdjacentHTML('afterend', html); else list.insertAdjacentHTML('beforeend', html);
  const im = list.querySelector('[data-lore] img'); try { im.src = iconURL('ui', 'log', 2); } catch (e) { /* без иконки */ }
  loreMenuBadge();
}

if (LORE_ON) {
  loreLoad();
  let last = performance.now();
  setInterval(() => {
    const now = performance.now(), dt = Math.min(1, (now - last) / 1000); last = now;
    try { loreTick(dt); loreIdleTick(dt); } catch (e) { if (!loreTick.err) { loreTick.err = 1; console.error(e); } }
  }, 250);
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-lore="open"]')) loreBookOpen(); });
  window.addEventListener('keydown', e => {
    if (e.code !== 'Escape') return;
    if (Lore.bookOpen) loreBookClose(); else if (Lore.cur) loreClose();
  });
  window.addEventListener('load', () => {
    setTimeout(loreMenu, 200);
    // и наоборот: пока идёт сцена, плашки «Новое» ждут своей очереди
    if (typeof rvNext === 'function') {
      const raw = rvNext;
      rvNext = function () { if (Lore.cur) { RV.noteEl = RV.noteEl || {}; setTimeout(() => { if (RV.noteEl && !RV.noteEl.nodeType) RV.noteEl = null; rvNext(); }, 800); return; } return raw.apply(this, arguments); };
    }
  });
  window.Lore = Object.assign(Lore, { open: loreBookOpen, frags: LORE_FRAGS, chapters: LORE_CHAPTERS });
}
if (typeof module !== 'undefined' && module.exports) module.exports = { LORE_CHAPTERS, LORE_FRAGS, LORE_WHO };
