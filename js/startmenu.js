'use strict';
// Стартовый экран: после загрузки мира заставка с костром остаётся, под названием —
// кнопки «Продолжить», «Новая игра», «Мультиплеер», «Как играть». Игра на паузе,
// пока не нажата кнопка. Раздел «Мультиплеер» — заготовка: ник и адрес сервера
// сохраняются, подключение подключит сетевая часть через StartMenu.onConnect.
// Грузится после hero.js: он при StartMenu.on не спрашивает имя сам.

const StartMenu = {
  on: true,            // меню собирается показать себя
  open: false,
  onConnect: null,     // function({ nick, server }) -> Promise|void — подставит сетевая часть
};
const MP_KEY = 'feod.mp';

function mpConfig() {
  let c = {};
  try { c = JSON.parse(localStorage.getItem(MP_KEY)) || {}; } catch (e) { c = {}; }
  return { nick: c.nick || '', server: c.server || 'ws://localhost:8787' };
}
function mpSave(c) { try { localStorage.setItem(MP_KEY, JSON.stringify(c)); } catch (e) { /* нет доступа к хранилищу */ } }

function smBestSave() {
  const a = saveMeta('auto'), m = saveMeta('manual');
  if (!a && !m) return null;
  if (a && (!m || a.at >= m.at)) return { slot: 'auto', meta: a, name: 'Автосохранение' };
  return { slot: 'manual', meta: m, name: 'Сохранение' };
}

function smShow(panel) {
  const root = document.getElementById('start-menu');
  if (!root) return;
  for (const p of root.querySelectorAll('.sm-panel')) p.classList.toggle('hidden', p.dataset.panel !== panel);
}

function smClose(then) {
  const box = document.getElementById('loading');
  StartMenu.open = false;
  box.classList.remove('with-menu');
  box.classList.add('leaving');
  setTimeout(() => { box.classList.add('hidden'); box.classList.remove('leaving'); }, 650);
  Game.paused = false;
  if (then) then();
}

function smRender() {
  const root = document.getElementById('start-menu');
  const sv = smBestSave();
  const cont = root.querySelector('[data-sm="continue"]');
  cont.disabled = !sv;
  cont.querySelector('small').textContent = sv ? `${sv.name} · ${Math.floor(sv.meta.time / 60)} мин · ${sv.meta.people} жит.` : 'сохранений пока нет';
  const c = mpConfig();
  root.querySelector('#sm-nick').value = c.nick;
  root.querySelector('#sm-server').value = c.server;
}

function smAction(a) {
  const root = document.getElementById('start-menu');
  if (a === 'continue') {
    const sv = smBestSave();
    if (!sv) return;
    smClose(() => { if (loadGame(sv.slot)) { updateUI(true); toast('Игра загружена'); } });
  } else if (a === 'new') {
    smClose(() => { if (Game.heroAsk) { Game.heroAsk = false; askHeroName(); } });
  } else if (a === 'mp') {
    smRender(); smShow('mp');
  } else if (a === 'help') {
    smShow('help');
  } else if (a === 'back') {
    smShow('main');
  } else if (a === 'connect') {
    const nick = root.querySelector('#sm-nick').value.trim().slice(0, 16);
    const server = root.querySelector('#sm-server').value.trim();
    const msg = root.querySelector('#sm-mp-msg');
    if (!nick) { msg.textContent = 'Введите ник — так вас увидят другие игроки'; return; }
    mpSave({ nick, server });
    if (!StartMenu.onConnect) { msg.textContent = 'Сетевая игра ещё готовится: ник и адрес сохранены, подключение появится в следующем обновлении.'; return; }
    msg.textContent = 'Подключаемся…';
    Promise.resolve(StartMenu.onConnect({ nick, server })).then(ok => { if (ok !== false) smClose(); else msg.textContent = 'Не удалось подключиться'; })
      .catch(e => { msg.textContent = 'Ошибка: ' + (e && e.message || e); });
  }
}

function initStartMenu() {
  const box = document.getElementById('loading');
  if (!box || document.getElementById('start-menu')) return;
  const root = document.createElement('div');
  root.id = 'start-menu';
  root.innerHTML = `
    <div class="sm-panel" data-panel="main">
      <button class="sm-btn primary" data-sm="continue"><b>Продолжить</b><small></small></button>
      <button class="sm-btn" data-sm="new"><b>Новая игра</b><small>новый мир, назвать героя</small></button>
      <button class="sm-btn" data-sm="mp"><b>Мультиплеер</b><small>играть с друзьями</small></button>
      <button class="sm-btn ghost" data-sm="help"><b>Как играть</b></button>
    </div>
    <div class="sm-panel hidden" data-panel="mp">
      <label>Ваш ник<input id="sm-nick" maxlength="16" autocomplete="off" placeholder="Например, Торин"></label>
      <label>Адрес сервера<input id="sm-server" autocomplete="off" spellcheck="false"></label>
      <div id="sm-mp-msg" class="sm-msg"></div>
      <button class="sm-btn primary" data-sm="connect"><b>Подключиться</b></button>
      <button class="sm-btn ghost" data-sm="back"><b>Назад</b></button>
    </div>
    <div class="sm-panel hidden" data-panel="help">
      <ul class="sm-help">
        <li>Стройте дороги и дома: трудяги носят товары, работяги строят.</li>
        <li>Герой ходит быстрее: выберите его (кнопка слева внизу или H) и кликайте по делу.</li>
        <li>Колесо мыши — масштаб, правая кнопка — тянуть карту. На телефоне: палец — карта, щипок — масштаб.</li>
        <li>Следите за вкладкой «Хозяйство»: там все проблемы деревни.</li>
      </ul>
      <button class="sm-btn ghost" data-sm="back"><b>Назад</b></button>
    </div>`;
  box.appendChild(root);
  root.addEventListener('click', e => { const b = e.target.closest('[data-sm]'); if (b && !b.disabled) smAction(b.dataset.sm); });
  window.addEventListener('keydown', e => {
    if (!StartMenu.open) return;
    if (e.target && e.target.tagName === 'INPUT') { if (e.key === 'Enter') { const c = root.querySelector('[data-sm="connect"]'); if (!root.querySelector('[data-panel="mp"]').classList.contains('hidden')) c.click(); } return; }
    if (e.key === 'Enter') { const sv = smBestSave(); smAction(sv ? 'continue' : 'new'); }
    if (e.key === 'Escape') smShow('main');
  });
}

// После того как игра построена, не прячем заставку, а показываем меню
{
  const _start = startGame;
  startGame = function () {
    _start();
    initStartMenu();
    const box = document.getElementById('loading');
    box.classList.remove('hidden');
    box.classList.add('with-menu');
    StartMenu.open = true;
    Game.paused = true;
    smRender(); smShow('main');
  };
}
