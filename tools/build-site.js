'use strict';
// Собирает страницы сайта (site/*.html) из данных игры: js/config.js (здания, товары, жители), js/guilds.js (классы),
// js/herokit.js (способности), js/world/enemy.js (враги) + site/data/sprites.json (картинки из tools/site-export.html).
// Журнал обновлений читается на странице прямо из js/changelog.js — пересобирать при релизе не нужно.
// Запуск: node tools/build-site.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'site');

// ---------- данные игры ----------
function grab(file, name) {
  const t = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const i = t.search(new RegExp('^const ' + name + ' *= *[{\\[]', 'm'));
  if (i < 0) throw new Error('нет ' + name + ' в ' + file);
  let j = t.indexOf('=', i) + 1; while (/\s/.test(t[j])) j++;
  const o = t[j], c = o === '{' ? '}' : ']';
  let d = 0, k = j, q = null;
  for (; k < t.length; k++) {
    const ch = t[k];
    if (q) { if (ch === '\\') k++; else if (ch === q) q = null; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { q = ch; continue; }
    if (ch === o) d++;
    if (ch === c && !--d) break;
  }
  return vm.runInNewContext('(' + t.slice(j, k + 1) + ')');
}
const BUILDINGS = grab('js/config.js', 'BUILDINGS'), GOODS = grab('js/config.js', 'GOODS'), UNITS = grab('js/config.js', 'UNIT_TYPES');
const GOOD_GROUPS = grab('js/config.js', 'GOOD_GROUPS');
const GCLS = grab('js/guilds.js', 'GCLS'), ABIL = grab('js/herokit.js', 'HERO_ABIL'), KIT_ITEMS = grab('js/herokit.js', 'KIT_ITEMS'), KIT_OF = grab('js/herokit.js', 'KIT_OF');
const FSPEC = grab('js/world/enemy.js', 'FSPEC'), FOE_STAGES = grab('js/world/enemy.js', 'FOE_STAGES');
const SP = JSON.parse(fs.readFileSync(path.join(OUT, 'data/sprites.json'), 'utf8'));
const STAT_RU = { str: 'сила', agi: 'ловкость', int: 'смекалка', end: 'стойкость' };
const CLS_EXTRA = {};

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TELEGRAM_URL = '';   // ссылка на Telegram-канал: впиши, когда канал опубликован — кнопка появится сама
const GAME_URL = '../';

// ---------- общий каркас ----------
const NAV = [['index.html', 'Главная'], ['lore.html', 'Лор'], ['bestiary.html', 'Бестиарий'], ['guide.html', 'Справочник'], ['changelog.html', 'Обновления'], ['bugs.html', 'Баги']];
function page(file, title, desc, body, opts = {}) {
  const nav = NAV.map(([f, n]) => `<a href="${f}"${f === file ? ' aria-current="page"' : ''}>${n}</a>`).join('') + `<a class="play" href="${GAME_URL}">Играть</a>`;
  const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#1a130d">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="website">
<link rel="icon" href="../favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="css/site.css">
</head><body>
<header class="top"><div class="wrap">
<a class="logo" href="index.html"><img src="../favicon.svg" alt="" width="28" height="26">OldGold</a>
<button id="burger" type="button" aria-label="Меню" aria-expanded="false">☰</button>
<nav>${nav}</nav>
</div></header>
<main>
${body}
</main>
<footer><div class="wrap">OldGold — браузерная игра про деревню лесных гномов. Вся графика и звук нарисованы для игры.<br>
<a href="../privacy.html">Конфиденциальность</a> · <a href="https://github.com/xXxLexolasxXx/OldGold">GitHub</a>${TELEGRAM_URL ? ` · <a href="${esc(TELEGRAM_URL)}">Telegram</a>` : ''} · <a href="bugs.html">Сообщить об ошибке</a></div></footer>
<div id="lb" role="dialog" aria-label="Скриншот"><img alt=""></div>
<script src="js/site.js" defer></script>
</body></html>
`;
  fs.writeFileSync(path.join(OUT, file), html);
  console.log('  ' + file + ' ' + (html.length / 1024).toFixed(1) + ' КБ');
}
const head = (h, lead) => `<div class="wrap fade"><div class="hero" style="padding-bottom:6px;text-align:left"><h1>${h}</h1>${lead ? `<p class="dim" style="max-width:720px">${lead}</p>` : ''}</div></div>`;

// ---------- Главная ----------
const SHOT_CAP = {
  '01_camp_day': 'Деревня днём: дороги, склад и работяги', '20_village_pixel': 'Пиксельная деревня', '23b_night_lanterns': 'Ночь: у каждого гнома свой фонарь',
  '25_buildings_set': 'Здания гномьей деревни', '12_hero_card': 'Карточка героя: скиллы и вкладки', '11_ui_minimap': 'Миникарта и интерфейс',
  '03b_ghosts': 'Призраки над кладбищем', '10b_rain': 'Дождь: гномы раскрывают зонтики', '32_neutrals_fairies': 'Лесные нейтралы и феи', '15_start_menu_coop': 'Старт: одиночная и общая деревня',
};
function shotsHtml(ids, wideFirst) {
  return `<div class="shots">${ids.map((id, i) => { const s = SP._shots.find(x => x.id === id); return s ? `<figure${wideFirst && !i ? ' class="wide"' : ''}><img src="img/shots/${id}.webp" width="${s.w}" height="${s.h}" alt="${esc(SHOT_CAP[id] || id)}" loading="${i < 2 ? 'eager' : 'lazy'}" decoding="async"><figcaption>${esc(SHOT_CAP[id] || '')}</figcaption></figure>` : ''; }).join('')}</div>`;
}
page('index.html', 'OldGold — игра про деревню лесных гномов', 'Бесплатная браузерная стратегия: стройте деревню гномов, переживайте ночи с нечистью, нанимайте героев и победите тёмного мага. С телефона и компьютера, без установки.', `
<div class="wrap fade">
<section class="hero">
<h1>OldGold</h1>
<p class="lead">Деревня лесных гномов: стройка, хозяйство, герои — и ночи, когда из тумана выходит нечисть. Открыл и играешь: с телефона и с компьютера, одному или в общей деревне.</p>
<a class="btn big bob" href="${GAME_URL}">Играть</a>
<div class="sub">Бесплатно, без регистрации и установки · <span id="latest">журнал обновлений загружается…</span></div>
</section>
${shotsHtml(['01_camp_day', '23b_night_lanterns', '25_buildings_set', '12_hero_card', '03b_ghosts', '10b_rain'], true)}
<h2>Что внутри</h2>
<div class="feat">
<div class="panel"><h3>Дороги и цепочки</h3><p>Трудяги ходят только по дорогам. Ферма → мельница → пекарня, хмель → пивоварня, шахта → кузня: ${BUILD_COUNT()} зданий и ${Object.keys(GOODS).length} товаров.</p></div>
<div class="panel"><h3>Ночь и нечисть</h3><p>С темнотой оживают деревья, встают скелеты, выходят призраки. Большой костёр и фонари — ваша защита. <a href="bestiary.html">Бестиарий →</a></p></div>
<div class="panel"><h3>Герои и гильдии</h3><p>Восемь классов, ${Object.values(ABIL).reduce((n, a) => n + a.length, 0)} способностей, рекруты в гильдиях. <a href="guide.html#heroes">О героях →</a></p></div>
<div class="panel"><h3>Злодей в башне</h3><p>Тёмный маг Малгор копит гнев и шлёт вороньё. Его можно победить — если собрать отряд. <a href="lore.html">Лор →</a></p></div>
<div class="panel"><h3>Вместе</h3><p>Общая деревня для двоих-троих: общие ночи, квесты на пару и утренний Совет.</p></div>
<div class="panel"><h3>Своя графика и музыка</h3><p>Каждый гном, дерево и здание нарисованы для игры. Музыку и звуки тоже сочинили специально.</p></div>
</div>
<h2>Ещё скриншоты</h2>
${shotsHtml(['20_village_pixel', '32_neutrals_fairies', '11_ui_minimap', '15_start_menu_coop'])}
<h2>Новое в игре</h2>
<div id="changelog" class="news" data-limit="3"><p class="dim">Загрузка…</p></div>
<div class="panel" style="margin-top:22px;text-align:center"><h3>Нашли ошибку или есть идея?</h3><p>Напишите — без регистрации в игре и без сбора личных данных.</p><a class="btn" href="bugs.html">Сообщить</a></div>
</div>`);
function BUILD_COUNT() { return Object.keys(BUILDINGS).filter(k => SP._buildings.includes(k) || true).length; }

// ---------- Лор ----------
const spireImg = SP.spire ? `<figure class="spire-fig"><img class="px" src="img/mon/spire.png" width="${SP.spire.w}" height="${SP.spire.h}" alt="Чёрный шпиль" loading="lazy"><figcaption class="dim" style="font-size:13px">Чёрный шпиль</figcaption></figure>` : '';
const wrathRows = [['Спит', 'Тишина: льготные первые ночи.'], ['Заметил', 'Зажигаются зелёные окна шпиля и дозорные огни на подступах.'], ['Разведка', 'По вечерам прилетают вороны-разведчики.'], ['Проклятия', 'Раз в пару ночей Малгор насылает проклятие на одну ночь.'], ['Налёты', 'Прислужники ходят в набеги на склады: держитесь ближе к большому костру.'], ['Осада', 'Приходят рыцари тьмы. Остановит это только поход к Чёрному шпилю.']];
page('lore.html', 'Лор — мир OldGold, гномы и тёмный маг', 'Мир OldGold: лесные гномы, ночная нечисть и тёмный маг Малгор из Чёрного шпиля.', head('Лор', 'Коротко о мире, в котором вы строите деревню. Без спойлеров к концовке.') + `
<div class="wrap lore fade">
<h2>Мир</h2>
<p>Долина лежит в лесу, куда редко заходят люди. Земля здесь свободна — «подозрительно свободна», как говорит прораб Грум. Днём тут шумят топоры и скрипят телеги, а с темнотой на деревню ложится туман, и тот, у кого нет фонаря, теряется.</p>
<p>Лес живёт сам по себе: олени и кролики пасутся, дикие козы поддаются пастуху, волки охотятся на тех, кто несёт груз, а в чащах прячутся логова фей, лешего и кабанов. Это нейтральные соседи — они не нападают, пока их не тронут.</p>
<h2>Гномы</h2>
<p>Гномы — маленькие, упрямые и работящие. Из безымянных трудяг школа растит лесорубов, каменотёсов, пахарей, пекарей, шахтёров, кузнецов и пивоваров. Гном без хлеба — «просто маленький сердитый бородач», а без перекура — несчастный: они курят, ссорятся, падают с грузом и засыпают прямо на дороге после трактира.</p>
<p>Самые толковые становятся <a href="guide.html#heroes">героями</a> и учатся в гильдиях — у воинов, лучников, разбойников и магов. Главы гильдий приходят сами и берут в обучение рекрутов.</p>
<blockquote>«Земля свободна. Подозрительно свободна.»<cite>Грум Ворчун, прораб</cite></blockquote>
<h2>Ночь и кладбище</h2>
<p>Когда темнеет, просыпаются существа, которых днём не видно. Деревья вылезают из земли и тянутся к гномам, из воды встают водяные, из кладбища — скелеты в рваных колпаках. Над крышами бродят призраки: они безобидны, но пугают всех подряд. Павший гном нередко встаёт скелетом сам, и кладбище растёт. Подробности — в <a href="bestiary.html">бестиарии</a>.</p>
<h2>Злодей из башни</h2>
${spireImg}
<p>Далеко на краю карты стоит <strong>Чёрный шпиль</strong> — высокая башня из индиго-камня, с кривой крышей и ядовито-зелёными окнами. Живёт в ней <strong>Малгор, тёмный маг</strong>: высокий, узкий, в мантии цвета ночи, с зелёными глазами и кристаллом на посохе.</p>
<p>Сто лет назад гномы выкопали жилу магических камней у подножия его башни и унесли «его» камни в свои склады. Малгор не мстит из злобы — он забирает своё. Заодно он гасит свет в долине, потому что свет мешает ему спать. Ночная нечисть не его вина по природе, но его воля её будит и ведёт.</p>
<blockquote>«Я просил тишины. Получите её — навсегда.»<cite>Малгор Тёмный</cite></blockquote>
<h3 style="margin-top:1.4em">Гнев Малгора</h3>
<p>Чем больше деревня и чем больше прошло ночей, тем сильнее его гнев — тут же растёт и число встреч с его слугами.</p>
<table><thead><tr><th>Ступень</th><th>Что происходит</th></tr></thead><tbody>${wrathRows.map(([a, b], i) => `<tr><td>${i} · ${a}</td><td>${b}</td></tr>`).join('')}</tbody></table>
<p style="margin-top:1em">Остановить Малгора можно: нужны герой, отряд и поход к шпилю. Победа гасит окна башни, и набеги прекращаются навсегда.</p>
<h2>Сценарий «Тишина дороже золота»</h2>
<p>Шесть глав, в которых вы вместе с Грумом строите деревню, а Малгор то присылает письма, то счета «за нарушение тишины».</p>
<ol class="chap">
<li><b>Приехали</b> — первая ночь и первые крыши.</li>
<li><b>Хлеб и недоверие</b> — ферма, мельница, пекарня.</li>
<li><b>Пиво вместо совести</b> — хмельник и пивоварня.</li>
<li><b>Свинья — друг гнома</b> — колбаса, кожа, доспех.</li>
<li><b>Блеск и железо</b> — золото, металл, первая гильдия.</li>
<li><b>Тишина дороже золота</b> — осада и поход к шпилю.</li>
</ol>
<p style="margin-top:1em" class="dim">Есть и свободная игра без сюжета: победа — город и 10 пережитых ночей.</p>
<p style="text-align:center;margin-top:28px"><a class="btn big" href="${GAME_URL}">Играть</a></p>
</div>`);

// ---------- Бестиарий ----------
const FOE_DATA = n => FSPEC[n];
const hp = n => `здоровье ${FSPEC[n].mhp}`, dmg = n => FSPEC[n].dmg ? `, удар ${FSPEC[n].dmg[0]}–${FSPEC[n].dmg[1]}` : '';
const MON = {
  night: { title: 'Ночная нечисть', lead: 'Выходит с наступлением темноты. Большой костёр отпугивает её, фонарь не даёт заблудиться, а герой и рекруты гильдий могут дать отпор.', items: [
    ['oak', 'Ходячий дуб', 'Ночью выбирается из земли, тянется к гномам и хватает зазевавшегося, а ещё бьёт по зданиям. Боится большого костра.', ['деревья', 'хватает']],
    ['birch', 'Ходячая берёза', 'Тонкая и быстрая сестра дуба. Тоже выходит по ночам и уносит гнома, который остался без света.', ['деревья', 'хватает']],
    ['pine', 'Ходячая сосна', 'Высокая, тянет руку издалека. Отпугивается большим костром.', ['деревья', 'хватает']],
    ['fir', 'Ходячая ель', 'Тёмная лапа, которую в лесу легко принять за обычную ёлку, пока та не пошла.', ['деревья', 'хватает']],
    ['water', 'Водяной', 'Водяной элементаль: поднимается из воды, бьёт струёй, сжимает гнома волной и утаскивает. Оставляет за собой лужи.', ['вода', 'хватает']],
    ['skeleton', 'Скелет', 'Встаёт из кладбища ночью. Бродит у своей могилы и рубит ржавым мечом тех, кто подошёл. Гном, павший от скелета, нередко встаёт скелетом сам. Пугается призраков.', ['кладбище', 'бьёт']],
    ['ghost', 'Призрак', 'Прозрачная гномья тень. Безобиден, но пугает всех, кого видит. Его можно задобрить хлебом — он успокоится, поблагодарит и иногда оставит золотую монету.', ['нежить', 'можно задобрить']],
    ['reaper', 'Призрак-жнец', 'Нежить второго уровня. Появляется с третьей ночи на окраине, к глубокой ночи. Хлебом не задобрить, молитвой героя не изгнать: чем больше потерь, тем больше жнецов.', ['нежить', 'опасен']],
  ] },
  foe: { title: 'Слуги тёмного мага', lead: 'Появляются, когда растёт гнев Малгора (см. <a href="lore.html">лор</a>). Это не нечисть: они ходят в набеги за добычей и теряют интерес к деревне, когда башня гаснет.', dark: true, items: [
    ['raven', 'Ворон-разведчик', () => `Летает и хрупок. Высматривает деревню; долетел живой — Малгор «знает» вас. ${hp('raven')}.`, ['маг', 'летает']],
    ['thrall', 'Прислужник тьмы', () => `Пеший налётчик в индиго-латах, глаза светятся зелёным. Грабит склады. ${hp('thrall')}${dmg('thrall')}.`, ['маг', 'налётчик']],
    ['knight', 'Рыцарь тьмы', () => `Крепкий и умеет парировать. Приходит в поздние ночи во время осады. ${hp('knight')}${dmg('knight')}.`, ['маг', 'поздние ночи']],
    ['malgor', 'Малгор, тёмный маг', () => `Хозяин Чёрного шпиля, босс. Бой идёт в три фазы: призыв, зелёный огонь, ярость. ${hp('malgor')}${dmg('malgor')}.`, ['босс']],
    ['spire', 'Чёрный шпиль', 'Башня Малгора на дальнем краю карты. Окна светятся ядовито-зелёным по вечерам, на подступах горят дозорные огни.', ['логово']],
  ] },
  neutral: { title: 'Лесные нейтралы и феи', lead: 'Живут в логовах в лесу и ни на кого не нападают, пока их не тронут. Герой или рекруты могут напасть сами; тронутый нейтрал дерётся и зовёт своих. За победу — добыча и опыт.', items: [
    ['pixie', 'Цветочная фея', 'Крошка с цветочной короной и ярко-зелёными крыльями. Живёт в домике на дереве и умеет колдовать.', ['феи', 'нейтрал']],
    ['fairy', 'Лесная фея', 'Живёт в грибном кольце. Нейтральна, пока её не тронули; умеет колдовать.', ['феи', 'нейтрал']],
    ['leshy', 'Леший', 'Хозяин леса, обитает в дупле. Если за сутки срублено много деревьев, ночью может наслать на дровосеков блуждания.', ['лес', 'нейтрал']],
    ['boar', 'Кабан-страж', 'Охраняет лёжку. Сильный и упрямый: бросается, если тронуть своих.', ['звери', 'нейтрал']],
    ['spore', 'Чумной моховик', 'Гриб-переросток из пятна чумных грибов. Не трогает тех, кто не трогает его.', ['грибы', 'нейтрал']],
  ] },
  beast: { title: 'Звери', lead: 'Обычное зверьё вокруг деревни. Часть его можно приручить, часть — отпугнуть, а от волков лучше беречь груз.', items: [
    ['wolf', 'Волк', 'Злой: подкрадывается к тем, кто несёт груз, и утаскивает его.', ['звери', 'злой']],
    ['deer', 'Олень', 'Нейтральный: пасётся и убегает от людей.', ['звери', 'нейтрал']],
    ['rabbit', 'Кролик', 'Нейтральный: пасётся и убегает от людей.', ['звери', 'нейтрал']],
    ['goat', 'Дикая коза', 'Добрая: пастух может её приручить. Вьючная коза возит по 2 груза за раз.', ['звери', 'добрая']],
    ['fox', 'Лиса', 'Рыжая лесная жительница; часть живой природы вокруг деревни.', ['звери']],
    ['elk', 'Лось', 'Крупный лесной зверь с ветвистыми рогами.', ['звери']],
    ['chicken', 'Курица', 'Обитатель двора. Тушка идёт в трактир и делится на 4 куска.', ['скот']],
    ['goose', 'Гусь', 'Домашняя птица, на воде и на суше.', ['скот']],
  ] },
};
const SMOOTH = new Set(['ghost', 'reaper', 'oak', 'birch', 'pine', 'fir', 'water', 'spire', 'malgor']);
function monCard(group, [id, name, text, tags], dark) {
  const s = SP[id]; if (!s) return '';
  const cap = (SMOOTH.has(id) ? 2.2 : 3) * Math.min(1, 1), top = Math.max(s.w, s.h);
  let k = Math.min(cap, 135 / s.h, 230 / s.w); if (!SMOOTH.has(id)) k = Math.max(1, Math.floor(k)); else k = Math.max(0.3, k);
  const w = Math.round(s.w * k), h = Math.round(s.h * k), tall = h > 140 ? ' tall' : '';
  const t = typeof text === 'function' ? text() : text;
  const tg = (tags || []).map(x => `<span class="tag${/злой|опасен|налётчик|босс/.test(x) ? ' hot' : /добрая|задобрить/.test(x) ? ' good' : ''}">${esc(x)}</span>`).join('');
  return `<article class="card" id="m-${id}"><div class="art${dark ? ' dark' : ''}${tall}"><img class="${SMOOTH.has(id) ? '' : 'px'}" src="img/mon/${id}.png" width="${w}" height="${h}" alt="${esc(name)}" loading="lazy" decoding="async" style="max-width:100%;height:auto"></div><h3>${esc(name)}</h3><div>${tg}</div><p>${esc(t)}</p></article>`;
}
const monBody = Object.entries(MON).map(([g, m]) => `<section id="${g}"><h2>${m.title}</h2><p class="dim" style="max-width:760px">${m.lead}</p><div class="cards">${m.items.map(it => monCard(g, it, m.dark)).join('')}</div></section>`).join('');
page('bestiary.html', 'Бестиарий — нечисть, нейтралы и звери OldGold', 'Все, кого можно встретить в игре OldGold: ночная нечисть, призраки, слуги тёмного мага, феи и звери — с картинками прямо из игры.', head('Бестиарий', 'Карточки нарисованы настоящими функциями игры, поэтому выглядят так же, как в деревне.') + `
<div class="wrap"><div class="toc">${Object.entries(MON).map(([g, m]) => `<a href="#${g}">${m.title}</a>`).join('')}</div>${monBody}</div>`);

// ---------- Справочник ----------
const ico = (g, n) => `<img src="img/ico/${g}.png" width="24" height="24" alt="" loading="lazy">`;
const goodName = g => (GOODS[g] || {}).name || g;
const costHtml = c => `<span class="cost">${Object.entries(c || {}).map(([g, n]) => `<b title="${esc(goodName(g))}"><img src="img/ico/${g}.png" alt="${esc(goodName(g))}" loading="lazy">${n}</b>`).join('')}</span>`;
const NO_SPRITE = new Set(['ironmine', 'smeltery', 'weaponsmith', 'guild_warrior', 'guild_archer', 'guild_rogue', 'guild_mage']);   // у них в листе кадров пока заглушка-крыша
const cats = [...new Set(Object.values(BUILDINGS).map(b => b.cat))];
const bCard = id => {
  const b = BUILDINGS[id], has = SP._buildings.includes(id) && !NO_SPRITE.has(id), w = (UNITS[b.worker] || {}).name;
  const dims = `${b.w}×${b.h}`;
  return `<article class="card bcard"><div class="art">${has ? `<img src="img/bld/${id}.png" alt="${esc(b.name)}" loading="lazy" decoding="async" style="max-height:100%;width:auto">` : `<span class="dim">без картинки</span>`}</div><h3>${esc(b.name)}</h3><p>${esc(b.desc || '')}</p><div class="stats">${costHtml(b.cost)}${w ? `<div>Работает: ${esc(w)}</div>` : ''}<div>Фундамент ${dims}</div></div></article>`;
};
const heroCls = Object.keys(ABIL).map(k => {
  const c = GCLS[k] || {}, name = c.name || CLS_EXTRA[k] || k;
  const bonus = c.bonus ? Object.entries(c.bonus).map(([s, v]) => `${STAT_RU[s]} +${v}`).join(', ') : '';
  const kit = (KIT_OF[k] || []).map(i => KIT_ITEMS[i].name.toLowerCase()).join(' и ');
  return `<article class="card"><h3 style="color:${c.col || 'var(--gold-hi)'}">${esc(name)}</h3>${bonus ? `<div class="stats">${esc(bonus)}${c.range ? ` · дальность ${c.range}` : ''}</div>` : ''}${kit ? `<div class="stats">Стартовое оружие: ${esc(kit)}</div>` : ''}<ul class="abil">${ABIL[k].map(a => `<li><b>${esc(a.name)}</b>${a.lvl ? ` <span class="dim">(с ${a.lvl} ур.)</span>` : ''}<br>${esc(a.desc)} <span class="dim">Перезарядка ${a.cd} с.</span></li>`).join('')}</ul></article>`;
}).join('');
const jobs = Object.entries(UNITS).filter(([k, u]) => !u.noTrain && !u.animal).map(([k, u]) => u.name);
page('guide.html', 'Справочник — здания, ресурсы, герои и классы OldGold', 'Справочник по игре OldGold: все здания и их стоимость, товары, профессии жителей, классы героев и их способности.', head('Справочник', 'Всё берётся из данных игры, поэтому не отстаёт от версии.') + `
<div class="wrap">
<div class="toc"><a href="#res">Ресурсы</a><a href="#buildings">Здания</a><a href="#people">Жители</a><a href="#heroes">Герой и классы</a></div>
<section id="res"><h2>Ресурсы</h2>
${GOOD_GROUPS.map(g => { const l = Object.entries(GOODS).filter(([k, v]) => v.group === g); return l.length ? `<h3 style="margin-top:1em">${g}</h3><div class="res">${l.map(([k, v]) => `<span><img src="img/ico/${k}.png" alt="" loading="lazy">${esc(v.name)}</span>`).join('')}</div>` : ''; }).join('')}
</section>
<section id="buildings"><h2>Здания</h2>
<p class="dim">Стоимость указана в товарах; фундамент — в клетках. Поворот здания — клавиша T в игре.</p>
<div class="toc">${cats.map(c => `<a href="#b-${esc(c)}">${esc(c)}</a>`).join('')}</div>
${cats.map(c => `<h3 id="b-${esc(c)}" style="margin-top:1.4em;scroll-margin-top:70px">${esc(c)}</h3><div class="cards">${Object.keys(BUILDINGS).filter(k => BUILDINGS[k].cat === c).map(bCard).join('')}</div>`).join('')}
</section>
<section id="people"><h2>Жители</h2>
<p>Каждый новый гном — трудяга. В школе (за 1 золото) его учат профессии, а некоторые профессии появляются сами, когда построено нужное здание.</p>
<p>Профессии: ${jobs.map(esc).join(', ')}.</p>
<p>Герои, воины, лучники, разбойники и маги приходят через гильдии. Извозчик — это конюшня с лошадью и телегой, вьючная коза — из загона для коз.</p>
</section>
<section id="heroes"><h2>Герой и классы</h2>
<p>Герой растёт вместе с городом и боями: высший уровень — 15-й. Класс он получает в гильдии; у воинов учат варвара, у магов — друида. У каждого класса по две способности (вторая открывается с 4-го уровня), на клавишах Z и X.</p>
<div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr))">${heroCls}</div>
</section>
</div>`);

// ---------- Журнал обновлений ----------
page('changelog.html', 'Журнал обновлений OldGold', 'Что нового в OldGold: все версии и исправления.', head('Журнал обновлений', 'Берётся прямо из файла игры — всегда актуально.') + `<div class="wrap"><div id="changelog"><p class="dim">Загрузка…</p></div></div>`);

// ---------- Багрепорты ----------
page('bugs.html', 'Сообщить об ошибке — OldGold', 'Нашли баг или есть идея для OldGold? Сообщите через GitHub или Telegram — без сбора личных данных.', head('Сообщить об ошибке', 'Нашли баг, опечатку или хотите предложить идею? Расскажите — мы читаем всё.') + `
<div class="wrap" style="max-width:760px">
<form id="bugform" class="panel" autocomplete="off">
<label for="kind">Что это</label>
<select id="kind" name="kind"><option>Ошибка</option><option>Идея</option><option>Вопрос</option></select>
<label for="title">Коротко</label>
<input type="text" id="title" name="title" maxlength="100" placeholder="Например: гном застрял у склада">
<label for="what">Что случилось</label>
<textarea id="what" name="what" maxlength="2000" required placeholder="Что вы делали и что пошло не так"></textarea>
<label for="steps">Как повторить (по желанию)</label>
<textarea id="steps" name="steps" maxlength="2000" style="min-height:80px" placeholder="1. Построил… 2. Нажал…"></textarea>
<label class="chk"><input type="checkbox" id="env" name="env"> <span>Добавить сведения об устройстве: браузер, система, размер экрана и версия игры. Ничего больше. По умолчанию выключено.</span></label>
<div class="btns"><button class="btn" type="submit">Открыть заявку на GitHub</button><button class="btn" type="button" id="copy">Скопировать текст</button>${TELEGRAM_URL ? `<a class="btn" href="${esc(TELEGRAM_URL)}">Написать в Telegram</a>` : ''}</div>
<div class="dim" style="font-size:13px;margin-top:10px">Предпросмотр того, что уйдёт в заявку:</div>
<div id="preview" aria-live="polite"></div>
</form>
<div class="panel" style="margin-top:16px">
<h3>Как это работает</h3>
<p>Сайт сам ничего не отправляет и не хранит: форма лишь собирает текст и открывает страницу новой заявки на GitHub, где вы можете проверить и поправить его. Для отправки там нужен аккаунт GitHub; если его нет — скопируйте текст и напишите в Telegram.</p>
<p>Если ошибка случилась в игре, откройте меню и нажмите «Сообщить о проблеме» — игра сама отправит описание, снимок экрана и журнал (или «Скопировать журнал» и приложите его к заявке). Подробности о данных — в <a href="../privacy.html">политике конфиденциальности</a>.</p>
</div>
</div>`);
