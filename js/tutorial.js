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
const catBtn = name => `#build-cats button:nth-child(${BUILD_CATS.indexOf(name) + 1})`;

const TUT_STEPS = [
  {
    title: 'Добро пожаловать в OldGold!',
    text: () => `Вы — старейшина лесных гномов. Задача — вырастить деревню: строить, кормить жителей и наладить производство.<br><br>
      <b>Осмотритесь:</b> ${isMob() ? 'двигайте карту пальцем, двумя пальцами — масштаб' : 'двигайте карту <b>правой кнопкой мыши</b> или клавишами <kbd>W A S D</kbd>, колесо мыши — масштаб'}.`,
    done: () => Tut.cam0 && (Math.hypot(R.cam.x - Tut.cam0.x, R.cam.y - Tut.cam0.y) > 120 || R.cam.z !== Tut.cam0.z),
  },
  {
    title: 'Склад — сердце деревни',
    text: () => `Здесь хранится всё добро: брёвна, доски, камень, еда, золото. Трудяги в зелёных колпаках возят товары между складом и мастерскими.<br><br>
      <b>${isMob() ? 'Коснитесь' : 'Кликните по'} складу</b> (стрелка на карте) — внизу слева откроется окно здания с его запасами.`,
    marks: () => { const s = storeB(); return s ? [[s.x + s.w / 2, s.y]] : []; },
    done: () => Game.selected && Game.selected.isStore && Game.selected.isStore(),
  },
  {
    title: 'Дом лесоруба',
    text: () => `Всё строится из <b>досок и камня</b>. Доски делают из брёвен, а брёвна рубит лесоруб.<br><br>
      Откройте раздел <b>«Ресурсы»</b>, выберите <b>Дом лесоруба</b> и поставьте его <b>рядом с лесом</b>${isMob() ? ' (коснитесь места, затем ✓)' : ''}. Зелёная рамка — можно строить, красная — нельзя.`,
    hl: () => [catBtn('Ресурсы'), '.bbtn[data-type="woodcutter"]', isMob() ? '[data-tab="build"]' : ''],
    done: () => !!findB('woodcutter'),
  },
  {
    title: 'Проведите дорогу',
    text: () => `<b>Трудяги и работяги ходят только по дорогам.</b> Перед входом в новое здание есть клочок дороги — его нужно соединить с дорогой у склада.<br><br>
      Нажмите <b>«Дорога»</b> и ${isMob() ? 'проведите пальцем' : 'протяните мышью'} от готовой дороги к стрелке. Клетка дороги стоит 1 камень. Работяга сначала копает, потом мостит.`,
    hl: () => ['#tool-road', isMob() ? '[data-tab="build"]' : ''],
    marks: () => { const b = findB('woodcutter'); return b ? [[b.doorX + 0.5, b.doorY + 0.5]] : []; },
    done: () => linked(findB('woodcutter')),
  },
  {
    title: 'Каменоломня и лесопилка',
    text: () => `Теперь камень и доски.<br>• <b>Каменоломня</b> — ставьте у серых скал.<br>• <b>Лесопилка</b> — пилит брёвна в доски, ставьте где удобно.<br><br>
      Обе — в разделе «Ресурсы». Не забудьте <b>соединить их дорогой</b>. Постройку ведут работяги (бордовые кафтаны), материалы подвозят трудяги.`,
    hl: () => [catBtn('Ресурсы'), '.bbtn[data-type="quarry"]', '.bbtn[data-type="sawmill"]', isMob() ? '[data-tab="build"]' : ''],
    done: () => linked(findB('quarry')) && linked(findB('sawmill')),
  },
  {
    title: 'Еда',
    text: () => `Голодный гном работает медленно и может упасть без сил. Едят в <b>трактире</b> — он уже есть.<br><br>
      Цепочка хлеба: <b>Ферма → Мельница → Пекарня</b> (раздел «Еда»). Ферма засевает поля вокруг себя — оставьте ей свободную траву. Всё соедините дорогами.`,
    hl: () => [catBtn('Еда'), '.bbtn[data-type="farm"]', '.bbtn[data-type="mill"]', '.bbtn[data-type="bakery"]', isMob() ? '[data-tab="build"]' : ''],
    done: () => !!(findB('farm') && findB('mill') && findB('bakery')),
  },
  {
    title: 'Окно здания',
    text: () => `${isMob() ? 'Коснитесь' : 'Кликните'} по любой мастерской. В окне видно: работника, что привезено и что готово к вывозу.<br><br>
      Большая кнопка <b>«Доставки открыты / закрыты»</b> запрещает трудягам везти сюда товары — пригодится, если склад или цех переполнен. ${isMob() ? '' : 'Клавиша <kbd>B</kbd>.'}<br>
      <b>Значки над домами</b> показывают, чего не хватает: дороги, рабочего, сырья.`,
    done: () => Game.selected && !Game.selected.isRoad && Game.selected.def && !Game.selected.isStore(),
  },
  {
    title: 'Хозяйство и журнал',
    text: () => `Вкладка <b>«Хозяйство»</b> (свиток) собирает все проблемы деревни — клик по строке покажет здание.<br>
      Вкладка <b>«Журнал»</b> (книга) хранит все события: что уронила сова, что утащил волк, кто с кем столкнулся, что построено. Клик по записи — место на карте.<br><br>
      Откройте одну из них.`,
    hl: () => ['[data-tab="overview"]', '[data-tab="log"]'],
    done: () => UI.tab === 'overview' || UI.tab === 'log',
  },
  {
    title: 'Ночь и туман',
    text: () => `Сутки идут сами: днём гномы шагают бодрее, ночью медленнее, и ложится туман (☀/☾ у часов вверху).<br><br>
      • Ночью у каждого фонарь. <b>Упал — фонарь разбит</b>, гном теряется в тумане, пока его не выведет кто-то с фонарём.<br>
      • Уличные фонари вдоль дорог светят слабо, но помогают.<br>
      • <b>Ночью оживают деревья</b>. Увидев такое, гном застынет, удерёт в трактир или кинется с топором: срубит — останется бревно, нет — дерево утащит его в туман.`,
  },
  {
    title: 'Дальше — сами!',
    text: () => `• <b>Школа</b> учит новых рабочих за золото (вкладка «Жители» или кнопка в окне здания).<br>
      • Широкая дорога в 2 клетки — трудяги разъезжаются без пробок.<br>
      • Мусор из урн сжигают в <b>большом костре</b>, пепел удобряет поля.<br>
      • Скорость игры и пауза — справа вверху. Подсказки и это обучение — в меню.<br><br>Удачи, старейшина!`,
    last: true,
  },
];

function tutStart() {
  Tut.on = true; Tut.i = 0; Tut.doneAt = 0;
  Tut.cam0 = { x: R.cam.x, y: R.cam.y, z: R.cam.z };
  document.getElementById('help').classList.add('hidden');
  tutRender();
}

function tutClose(finished) {
  Tut.on = false;
  try { localStorage.setItem('oldgold-tut', 'done'); } catch (e) { /* нет хранилища */ }
  tutHighlight([]);
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
  Tut.el.classList.remove('hidden');
  Tut.el.classList.toggle('ok', ok);
  Tut.el.innerHTML = `
    <div class="tut-head"><span class="tut-n">Обучение · ${Tut.i + 1} из ${TUT_STEPS.length}</span>
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

function initTutorial() {
  setInterval(tutTick, 300);
  let seen = false;
  try { seen = localStorage.getItem('oldgold-tut') === 'done'; } catch (e) { /* нет хранилища */ }
  if (!seen) setTimeout(tutStart, 600);
}
