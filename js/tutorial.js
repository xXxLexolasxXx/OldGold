'use strict';
// Обучение: короткие задания по шагам. Нужная кнопка подсвечивается, на карте
// прыгает стрелка, а шаг засчитывается сам, как только игрок сделал, что просили.
// Любой шаг можно пропустить, обучение — закрыть и запустить снова из меню.

const Tut = { on: false, i: 0, doneAt: 0, cam0: null, el: null };

const isMob = () => typeof Mobile !== 'undefined' && Mobile.on;
const findB = type => Game.buildings.find(b => b.type === type);
const storeB = () => Game.buildings.find(b => b.isStore() && !b.isPile);
// здание связано дорогой со складом
const linked = b => { const s = storeB(); return !!(b && s && compAt(b.doorX, b.doorY) && compAt(b.doorX, b.doorY) === compAt(s.doorX, s.doorY)); };
const catBtn = name => `#build-cats button[data-cat="${name}"]`;
const tutSeen = () => { try { return localStorage.getItem('oldgold-tut') === 'done'; } catch (e) { return false; } };

// Конец обучения (или пропуск): достраиваем школу и открываем «Ресурсы»
function releaseStart() {
  for (const b of Game.buildings) b.hold = false;
  unlockStage('res', true);
}

const more = (title, html) => `<details><summary>${title}</summary>${html}</details>`;

// ph — раздел в шапке. Порядок: деревня и дорога → хозяйство и ночь → герой, бой, гильдии → «узнать больше».
// События воронки: tut2-step-NN / tut2-ok-NN / tut2-skip-NN (старые tut-step-NN — прежнее обучение на 15 шагов, их не трогаем)
const TUT_STEPS = [
  {
    ph: 'Деревня', title: 'Добро пожаловать в OldGold!',
    text: () => `Вы — старейшина лесных гномов: строите, кормите и пытаетесь не потерять жителей. Гномы помогают — в меру настроения.<br><br>
      <b>Осмотритесь:</b> ${isMob() ? 'двигайте карту пальцем, двумя пальцами — масштаб' : 'двигайте карту <b>правой кнопкой мыши</b> или клавишами <kbd>W A S D</kbd>, колесо мыши — масштаб'}.`,
    done: () => Tut.cam0 && (Math.hypot(R.cam.x - Tut.cam0.x, R.cam.y - Tut.cam0.y) > 120 || R.cam.z !== Tut.cam0.z),
  },
  {
    ph: 'Деревня', title: 'Стартовый набор',
    text: () => `Кое-что уже стоит (стрелки на карте):<br>
      • <b>склад</b> — всё добро: брёвна, доски, камень, еда, золото;<br>
      • <b>школа</b> — учит рабочих за 1 золото, без экзаменов и отчислений;<br>
      • <b>костёр</b> — сжигает мусор, пепел идёт на поля;<br>
      • <b>трактир</b> — еда и эль. Голодный гном ворчит и падает.<br><br>
      <b>${isMob() ? 'Коснитесь' : 'Кликните по'} складу</b> — внизу откроется окно здания с запасами.`,
    marks: () => ['storehouse', 'school', 'bonfire', 'inn'].map(findB).filter(Boolean).map(b => [b.x + b.w / 2, b.y]),
    done: () => Game.selected && Game.selected.isStore && Game.selected.isStore(),
  },
  {
    ph: 'Деревня', title: 'Дом лесоруба',
    enter: () => unlockStage('res'),
    text: () => `Всё строится из <b>досок и камня</b>. Доски — из брёвен, брёвна рубит лесоруб.<br><br>
      Откройте раздел <b>«Ресурсы»</b>, выберите <b>Дом лесоруба</b> и поставьте <b>рядом с лесом</b>${isMob() ? ' (коснитесь места, затем ✓)' : ''}. Зелёная рамка — можно, красная — нельзя. Достроят работяги или герой — о нём позже.`,
    hl: () => [catBtn('Ресурсы'), '.bbtn[data-type="woodcutter"]', isMob() ? '[data-tab="build"]' : ''],
    done: () => !!findB('woodcutter'),
  },
  {
    ph: 'Деревня', title: 'Проведите дорогу',
    text: () => `<b>Гномы ходят только по дорогам.</b> Перед входом в здание есть клочок дороги — соедините его с дорогой у склада, иначе стройка и добыча будут ждать вечно.<br><br>
      Нажмите <b>«Дорога»</b> и ${isMob() ? 'проведите пальцем' : 'протяните мышью'} от готовой дороги к стрелке. Клетка стоит 1 камень.`,
    hl: () => ['#tool-road', isMob() ? '[data-tab="build"]' : ''],
    marks: () => { const b = findB('woodcutter'); return b ? [[b.doorX + 0.5, b.doorY + 0.5]] : []; },
    done: () => linked(findB('woodcutter')),
  },
  {
    ph: 'Деревня', title: 'Каменоломня и лесопилка',
    text: () => `Камень и доски:<br>• <b>Каменоломня</b> — у серых скал.<br>• <b>Лесопилка</b> — где удобно.<br><br>
      Обе в «Ресурсах», и обе <b>соедините дорогой</b>. Материалы подвозят трудяги (зелёные колпаки), строят работяги (бордовые кафтаны). Не хватает рук — школа выучит новых.`,
    hl: () => [catBtn('Ресурсы'), '.bbtn[data-type="quarry"]', '.bbtn[data-type="sawmill"]', isMob() ? '[data-tab="build"]' : ''],
    done: () => linked(findB('quarry')) && linked(findB('sawmill')),
  },
  {
    ph: 'Хозяйство', title: 'Хлеб насущный',
    enter: () => unlockStage('grain'),
    text: () => `Трактир кормит, но кому-то надо кормить трактир. Цепочка: <b>Ферма → Мельница → Пекарня</b> (раздел «Еда»), всё — дорогами. Ферма засевает траву вокруг, оставьте ей место.<br><br>
      Дальше меню открывается само: достроили цепочку — появился новый раздел. Всё сразу не дадут, без паники.`,
    hl: () => [catBtn('Еда'), '.bbtn[data-type="farm"]', '.bbtn[data-type="mill"]', '.bbtn[data-type="bakery"]', isMob() ? '[data-tab="build"]' : ''],
    done: () => !!(findB('farm') && findB('mill') && findB('bakery')),
  },
  {
    ph: 'Хозяйство', title: 'Хозяйство и журнал',
    text: () => `Клик по зданию открывает окно: работник, запасы, <b>«Доставки открыты/закрыты»</b>${isMob() ? '' : ' (клавиша <kbd>B</kbd>)'}. <b>Значки над домами</b> подсказывают, чего не хватает: дороги, рабочего, сырья.<br><br>
      Вкладка <b>«Хозяйство»</b> (свиток) собирает все проблемы, <b>«Журнал»</b> (книга) — все события. Клик по строке покажет место на карте. Откройте любую.`,
    hl: () => ['[data-tab="overview"]', '[data-tab="log"]'],
    done: () => UI.tab === 'overview' || UI.tab === 'log',
  },
  {
    ph: 'Ночь', title: 'Ночь и туман',
    text: () => `Сутки идут сами. Вечером зажигаются фонари, ночью ложится туман, гномы бредут медленнее, а в лесу <b>оживают деревья</b>, бродят скелеты и призраки.<br><br>
      • У каждого гнома фонарь. <b>Упал — фонарь разбит</b>, гном заблудился, пока его не найдёт кто-то со светом.<br>
      • К вечеру пусть в трактире будет еда, а вдоль дорог — фонари.<br>
      • Каждая <b>5-я ночь</b> в полтора раза длиннее и злее. ${more('Узнать больше', 'С 5-й ночи появляются странные существа: студень, лампоглав и компания. Они безобидны, просто смотрят. Это хуже.')}`,
  },
  {
    ph: 'Герой', title: 'Ваш герой',
    text: () => `<b>Герой</b> — гном, быстрее всех и мастер на все руки. Растёт вместе с деревней, до 15-го уровня.<br><br>
      <b>Выберите героя:</b> ${isMob() ? 'портрет слева внизу (◎ в карточке — камера к нему)' : 'портрет слева внизу, он сам на карте или клавиша <kbd>H</kbd>'}. Потом дайте дело: ${isMob() ? 'коснитесь' : 'кликните'} по <b>дереву</b>, <b>камню</b>, <b>стройке</b> или спелому полю. По пустой земле он просто идёт. Закончив, достаёт фляжку — не пьянеет.`,
    hl: () => ['#hero-btn'],
    marks: () => {
      const h = Game.hero; if (!h || h.inside) return [];
      if (Game.selUnit !== h) return [[h.x, h.y]];
      const b = Game.buildings.find(x => x.state !== 'done' && !x.isRoad);
      return b ? [[b.x + b.w / 2, b.y]] : [];
    },
    done: () => { const h = Game.hero; return !!(h && h.cmd && h.cmd.kind && h.cmd.kind !== 'move'); },
  },
  {
    ph: 'Бой', title: 'Бой и мана',
    text: () => `Нечисть и звери — на герое. У него <b>здоровье</b>, <b>мана</b> и заклинания: <b>Огненный шар</b> <kbd>F</kbd>, <b>Малое лечение</b> <kbd>E</kbd>, <b>Оберег</b> <kbd>C</kbd> (с 3-го уровня), <b>Телепорт</b> на базу. Рывок и Клич — там же. Кнопки — в карточке героя.<br><br>
      Приказ врагу — клик по нему. Погиб — не конец света, но обидно. ${more('Узнать больше', 'Лесные нейтралы (феи, леший, кабаны, моховики) сами не лезут, пока их не трогать. Победа — награда, поражение — урок. Выбрав героя, кликните по гному: тот станет напарником и будет помогать (повторный клик отпустит). Сундуки в лесу бывают мимиками: открывать на свой страх.')}`,
  },
  {
    ph: 'Гильдии', title: 'Гильдии и классы',
    text: () => `Разделы меню открываются цепочкой: хлеб → пиво → свиньи → ремесло → металл. Дойдёте до <b>оружейника</b> — откроются <b>Гильдии</b>: воинов, лучников, разбойников, магов.<br><br>
      Глава гильдии <b>обучит героя классу</b> за золото, а рекруты станут отрядом. Путь долгий, зато скучно не будет. ${more('Узнать больше', 'У зданий есть уровень 2: кнопка «Достроить» в окне здания. Конюшня даёт извозчика, загон — козу. Тоже пригодятся.')}`,
  },
  {
    ph: 'Финал', title: 'Дальше — сами!',
    text: () => `Главное: дороги, хлеб, непустой склад, к ночи — свет и герой на месте. Остальное — по ходу.<br><br>
      ${more('Праздник и субботник', 'Праздник — кнопка в трактире: все пляшут, пьют, потом болеют. Субботник — кнопка вверху, раз в день с утра: вся деревня убирает мусор.')}
      ${more('Кооператив', 'Меню → Мультиплеер: общая деревня, задания и Совет деревни. Друзья помогают, и даже иногда мешают.')}
      ${more('Скорость и помощь', 'Пауза и скорость — справа вверху. Это обучение можно повторить в меню.')}
      <br>Удачи, старейшина! Гномы в вас верят. Ну, некоторые.`,
    last: true,
  },
];

function tutStart() {
  track('tut-start', 'Обучение: началось');
  Tut.on = true; Tut.i = 0; Tut.doneAt = 0;
  Tut.cam0 = { x: R.cam.x, y: R.cam.y, z: R.cam.z };
  document.getElementById('help').classList.add('hidden');
  tutRender();
}

function tutClose(finished) {
  if (finished) track('tut-done', 'Обучение: пройдено до конца');
  else if (Tut.on) track('tut2-skip-' + String(Tut.i + 1).padStart(2, '0'), 'Обучение 2: закрыл на шаге ' + (Tut.i + 1));
  Tut.on = false;
  try { localStorage.setItem('oldgold-tut', 'done'); } catch (e) { /* нет хранилища */ }
  tutHighlight([]);
  releaseStart();
  if (Tut.el) Tut.el.classList.add('hidden');
  if (finished) { toast('Обучение пройдено! Его можно повторить в меню'); applaud('Деревня аплодирует: обучение пройдено!'); }
}

function tutGo(d) {
  Tut.i = Math.max(0, Math.min(TUT_STEPS.length - 1, Tut.i + d));
  Tut.doneAt = 0;
  if (Tut.i === 0) Tut.cam0 = { x: R.cam.x, y: R.cam.y, z: R.cam.z };
  tutRender();
}

function tutRender() {
  if (!Tut.el) {
    Tut.el = document.createElement('div');
    Tut.el.id = 'tut';
    document.getElementById('view').appendChild(Tut.el);
    Tut.el.addEventListener('click', e => {
      const a = e.target.closest('[data-tut]');
      if (!a) return;
      const k = a.dataset.tut;
      if (k === 'next') { if (TUT_STEPS[Tut.i].last) tutClose(true); else tutGo(1); }
      if (k === 'prev') tutGo(-1);
      if (k === 'close') tutClose(false);
      if (k === 'min') Tut.el.classList.toggle('min');
    });
  }
  const s = TUT_STEPS[Tut.i], ok = Tut.doneAt > 0;
  track('tut2-step-' + String(Tut.i + 1).padStart(2, '0'), 'Обучение 2: дошёл до шага ' + (Tut.i + 1));
  if (ok) track('tut2-ok-' + String(Tut.i + 1).padStart(2, '0'), 'Обучение 2: выполнил шаг ' + (Tut.i + 1));
  if (s.enter) s.enter();
  Tut.el.classList.remove('hidden');
  Tut.el.classList.toggle('ok', ok);
  Tut.el.innerHTML = `
    <div class="tut-head"><span class="tut-n">Обучение · ${Tut.i + 1} из ${TUT_STEPS.length}${s.ph ? ' · ' + s.ph : ''}</span>
      <button data-tut="min" title="Свернуть / развернуть">▁</button><button data-tut="close" title="Закрыть обучение">✕</button></div>
    <div class="tut-bar"><div style="width:${Math.round((Tut.i + (ok ? 1 : 0)) / TUT_STEPS.length * 100)}%"></div></div>
    <h3>${ok ? '✔ ' : ''}${s.title}</h3>
    <div class="tut-text">${s.text()}</div>
    <div class="tut-btns">
      ${Tut.i ? '<button data-tut="prev">← Назад</button>' : '<span></span>'}
      ${s.done && !ok ? '<span class="tut-wait">выполните задание или</span>' : ''}
      <button data-tut="next" class="${ok || !s.done ? 'primary' : ''}">${s.last ? 'Начать игру' : ok || !s.done ? 'Дальше →' : 'Пропустить'}</button>
    </div>`;
  tutHighlight(s.hl ? s.hl().filter(Boolean) : []);
  // телефон: прочитали — окно само сворачивается в строку, чтобы не закрывать карту
  clearTimeout(Tut.autoMin);
  { const step = Tut.i; Tut.autoMin = setTimeout(() => { if (Tut.on && Tut.i === step && Tut.el) Tut.el.classList.add('min'); }, isMob() ? 12000 : 30000); }
}

// Подсветка кнопок (список кнопок строительства перерисовывается — обновляем каждый такт)
function tutHighlight(sel) {
  document.querySelectorAll('.tut-hl').forEach(e => { if (!sel.some(s => e.matches(s))) e.classList.remove('tut-hl'); });
  for (const s of sel) document.querySelectorAll(s).forEach(e => e.classList.add('tut-hl'));
}

function tutTick() {
  if (!Tut.on) return;
  const s = TUT_STEPS[Tut.i];
  if (s.hl) tutHighlight(s.hl().filter(Boolean));
  if (s.done && !Tut.doneAt && s.done()) {
    Tut.doneAt = performance.now();
    sfxAt('chime', R.cam.x + 200, R.cam.y + 150);
    tutRender();
  }
  // выполнено — через пару секунд сам переходит дальше
  if (Tut.doneAt && performance.now() - Tut.doneAt > 2200) tutGo(1);
}

// Прыгающая стрелка над местом на карте
function drawTutMarks(c) {
  if (!Tut.on) return;
  const s = TUT_STEPS[Tut.i];
  if (!s.marks || Tut.doneAt) return;
  const bob = Math.abs(Math.sin(performance.now() / 260)) * 8;
  for (const [x, y] of s.marks()) {
    const px = x * TILE, py = y * TILE - 26 - bob;
    c.fillStyle = '#160e0a';
    c.beginPath(); c.moveTo(px - 9, py - 13); c.lineTo(px + 9, py - 13); c.lineTo(px + 9, py - 4); c.lineTo(px + 14, py - 4); c.lineTo(px, py + 9); c.lineTo(px - 14, py - 4); c.lineTo(px - 9, py - 4); c.closePath(); c.fill();
    c.fillStyle = '#f6d458';
    c.beginPath(); c.moveTo(px - 6, py - 11); c.lineTo(px + 6, py - 11); c.lineTo(px + 6, py - 3); c.lineTo(px + 10, py - 3); c.lineTo(px, py + 6); c.lineTo(px - 10, py - 3); c.lineTo(px - 6, py - 3); c.closePath(); c.fill();
  }
}

// ждём, пока игрок выйдет из стартового меню и назовёт героя: ни меню, ни окно имени не должны прятать обучение
function tutWhenFree(ready) {
  const menu = document.getElementById('loading');
  const busy = document.getElementById('hero-name') || (menu && !menu.classList.contains('hidden'));
  if (busy) setTimeout(tutWhenFree, 400);
  else if (ready) tutStart();
  else setTimeout(() => tutWhenFree(true), 800);   // окно имени появляется чуть позже меню — ещё раз проверяем
}

function initTutorial() {
  setInterval(tutTick, 300);
  let seen = false;
  try { seen = localStorage.getItem('oldgold-tut') === 'done'; } catch (e) { /* нет хранилища */ }
  if (!seen) tutWhenFree(); else track('tut-seen-before', 'Обучение не показано (уже проходил)');
}
