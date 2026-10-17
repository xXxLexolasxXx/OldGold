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

// ---------- Лозы вокруг кнопок: хмель, виноград, пшеница ----------

function smRand(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const VINE_KINDS = ['hops', 'grape', 'wheat'];
const VINE_DARK = '#16220c';

function vLeaf(x, y, rot, s, kind, col) {
  const d = kind === 'grape'
    ? 'M0 0 L-3 -4 L-8 -4 L-5 -8 L-8 -12 L-3 -11 L0 -17 L3 -11 L8 -12 L5 -8 L8 -4 L3 -4 Z'
    : 'M0 0 C-6 -3 -9 -11 0 -17 C9 -11 6 -3 0 0 Z';
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(0)}) scale(${s.toFixed(2)})"><path d="${d}" fill="${col}" stroke="${VINE_DARK}" stroke-width="1"/><path d="M0 -1 L0 -14" stroke="${VINE_DARK}" stroke-width=".7" opacity=".6"/></g>`;
}
function vHop(x, y, s) {
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(2)})"><path d="M0 -6 L0 0" stroke="${VINE_DARK}" stroke-width="1.2"/>
    <path d="M0 0 C-6 4 -7 13 0 20 C7 13 6 4 0 0 Z" fill="#9ac84a" stroke="${VINE_DARK}" stroke-width="1"/>
    <path d="M-5 6 Q0 9 5 6 M-5.5 11 Q0 14 5.5 11 M-3.5 16 Q0 18 3.5 16" fill="none" stroke="#5a8a22" stroke-width="1"/>
    <path d="M-2 3 Q-4 8 -2 12" stroke="#d4ee90" stroke-width="1" fill="none" opacity=".8"/></g>`;
}
function vGrapes(x, y, s) {
  let h = `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(2)})"><path d="M0 -6 L0 0" stroke="${VINE_DARK}" stroke-width="1.4"/>`;
  const rows = [[-6, 0, 6], [-3, 3], [-6, 0, 6].slice(0, 0).concat([-4, 4]), [0]];
  let yy = 4;
  for (const r of rows) { for (const dx of r) h += `<circle cx="${dx + (rows.indexOf(r) % 2 ? 0 : 0)}" cy="${yy}" r="4.2" fill="#5a2a7a" stroke="${VINE_DARK}" stroke-width="1"/><circle cx="${dx - 1.2}" cy="${yy - 1.4}" r="1.3" fill="#c8a0e8" opacity=".8"/>`; yy += 6.6; }
  return h + '</g>';
}
function vWheat(x, y, len, rot) {
  let h = `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(0)})"><path d="M0 0 Q2 ${-len * 0.5} 0 ${-len}" stroke="#9a8a3a" stroke-width="1.8" fill="none"/>`;
  for (let i = 0; i < 6; i++) {
    const yy = -len + 3 + i * 5;
    for (const sx of [-1, 1]) h += `<ellipse cx="${sx * 3.2}" cy="${yy}" rx="2.1" ry="4" transform="rotate(${sx * 24} ${sx * 3.2} ${yy})" fill="#e8c850" stroke="#8a6a1a" stroke-width=".8"/>`;
  }
  h += `<ellipse cx="0" cy="${-len - 3}" rx="2" ry="4.4" fill="#f0d664" stroke="#8a6a1a" stroke-width=".8"/>`;
  for (const sx of [-1, 0, 1]) h += `<path d="M${sx * 2} ${-len - 6} L${sx * 5} ${-len - 17}" stroke="#d8b84a" stroke-width=".7"/>`;
  return h + '</g>';
}

function vineSVG(w, h, kind, seed) {
  const rnd = smRand(seed * 977 + 13), P = 14;
  const W = w + P * 2, H = h + P * 2;
  // путь стебля: слева снизу вверх, по верхней кромке и вниз по правой стороне
  const pts = [];
  const add = (x, y) => pts.push([x, y]);
  const wob = () => (rnd() - 0.5) * 5;
  const left = rnd() < 0.5;   // с какой стороны поднимается лоза
  const xa = left ? P : P + w, xb = left ? P + w : P;
  const run = (x0, y0, x1, y1, step) => { const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / step)); for (let i = 0; i <= n; i++) add(x0 + (x1 - x0) * i / n + wob(), y0 + (y1 - y0) * i / n + wob()); };
  run(xa - 3, P - 5, xa - 3, P + h + 3, 15);
  run(xa - 3, P + h + 3, xa + (xb - xa) * (0.45 + rnd() * 0.4), P + h + 3, 15);
  run(pts[pts.length - 1][0], P + h + 3, xb + (left ? 3 : -3), P + h * (0.4 + rnd() * 0.4), 15);
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; d += ` Q${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`; }
  const lastP = pts[pts.length - 1]; d += ` L${lastP[0].toFixed(1)} ${lastP[1].toFixed(1)}`;
  let svg = `<svg class="sm-vine" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="left:${-P}px;top:${-P}px" aria-hidden="true">`;
  svg += `<path d="${d}" fill="none" stroke="${VINE_DARK}" stroke-width="4.6" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${kind === 'wheat' ? '#9a8a3a' : '#4a7a22'}" stroke-width="2.6" stroke-linecap="round"/>`;
  const greens = ['#5a9a2a', '#6aaa34', '#4a8a24', '#78b83e'];
  let items = '';
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i], nx = pts[i + 1][0] - pts[i - 1][0], ny = pts[i + 1][1] - pts[i - 1][1];
    const ang = Math.atan2(ny, nx) * 180 / Math.PI;        // направление стебля
    const side = i % 2 ? 1 : -1;
    if (kind === 'wheat') {
      if (i % 2 === 0) items += vWheat(x, y, 24 + rnd() * 14, ang + 90 * side + (rnd() - 0.5) * 26);
      else items += vLeaf(x, y, ang + 90 * side * 0.9, 0.9, 'hops', '#8aa83a');
    } else {
      items += vLeaf(x, y, ang + 90 * side + (rnd() - 0.5) * 30, 0.9 + rnd() * 0.5, kind, greens[(i * 7) % 4]);
      if (i % 3 === 0 && y > P + h * 0.8) items += kind === 'hops' ? vHop(x + side * 3, y + 3, 0.8 + rnd() * 0.4) : vGrapes(x + side * 3, y + 3, 0.8 + rnd() * 0.3);
    }
  }
  // усики-завитки
  for (let k = 0; k < 3; k++) { const [x, y] = pts[1 + ((rnd() * (pts.length - 2)) | 0)]; const r = 4 + rnd() * 3; items += `<path d="M${x.toFixed(1)} ${y.toFixed(1)} q${r} ${-r} ${r * 1.6} 0 q${-r * 0.4} ${r} ${-r * 0.8} ${r * 0.2}" fill="none" stroke="#6aaa34" stroke-width="1.1"/>`; }
  return svg + items + '</svg>';
}

function decorateVines() {
  const btns = document.querySelectorAll('#start-menu .sm-panel:not(.hidden) .sm-btn');
  btns.forEach((b, i) => {
    const old = b.querySelector('.sm-vine'); if (old) old.remove();
    const w = b.offsetWidth, h = b.offsetHeight;
    if (!w || !h) return;
    b.insertAdjacentHTML('beforeend', vineSVG(w, h, VINE_KINDS[(i + (smVineShift++)) % 3], i * 31 + smVineShift));
  });
}
let smVineShift = 0;

{
  const _show = smShow;
  smShow = function (p) { _show(p); requestAnimationFrame(decorateVines); };
  const _render = smRender;
  smRender = function () { _render(); requestAnimationFrame(decorateVines); };
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(decorateVines, 150); });
}

// ---------- Телефон: ресурсы спрятаны, пока не нажмёшь кнопку ----------
function initResToggle() {
  const mm = document.getElementById('mm-btn');
  if (!mm || document.getElementById('res-btn')) return;
  let hidden = true;
  try { hidden = localStorage.getItem('feod.res') !== '1'; } catch (e) { hidden = true; }
  document.body.classList.toggle('res-hidden', hidden);
  const b = document.createElement('button');
  b.id = 'res-btn'; b.title = 'Ресурсы: показать / скрыть';
  b.innerHTML = `<img src="${iconURL('good', 'gold', 2)}" alt="">`;
  b.onclick = () => {
    const h = document.body.classList.toggle('res-hidden');
    try { localStorage.setItem('feod.res', h ? '0' : '1'); } catch (e) { /* нет доступа к хранилищу */ }
  };
  mm.insertAdjacentElement('afterend', b);
}
{
  const _s = startGame;
  startGame = function () { _s(); initResToggle(); };
}
