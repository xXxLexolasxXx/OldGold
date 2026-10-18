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
  if (['continue', 'new', 'mp', 'help'].includes(a)) track('menu-' + a, { continue: 'Нажал «Продолжить»', new: 'Нажал «Новая игра»', mp: 'Открыл «Мультиплеер»', help: 'Открыл «Как играть» в стартовом меню' }[a]);
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
const VS = 0.72;   // общий масштаб листьев, шишек и колосьев — лоза не должна мешать и выпирать

function vLeaf(x, y, rot, s, kind, col) {
  const d = kind === 'grape'
    ? 'M0 0 L-3 -4 L-8 -4 L-5 -8 L-8 -12 L-3 -11 L0 -17 L3 -11 L8 -12 L5 -8 L8 -4 L3 -4 Z'
    : kind === 'hops'
      ? 'M0 0 L-3 1 L-6 -1 L-5 -4 L-9 -4 L-7 -7 L-11 -8 L-7 -11 L-8 -14 L-4 -13 L-3 -17 L-1 -15 L0 -20 L1 -15 L3 -17 L4 -13 L8 -14 L7 -11 L11 -8 L7 -7 L9 -4 L5 -4 L6 -1 L3 1 Z'
      : 'M0 0 C-6 -3 -9 -11 0 -17 C9 -11 6 -3 0 0 Z';
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(0)}) scale(${(s * VS).toFixed(2)})"><path d="${d}" fill="${col}" stroke="${VINE_DARK}" stroke-width="1"/><path d="M0 -1 L0 -14 M0 -6 L-6 -9 M0 -6 L6 -9" stroke="${VINE_DARK}" stroke-width=".7" opacity=".55" fill="none"/></g>`;
}
const SM_VAR = { hop: 0, grape: 0, wheat: 0 };   // подряд идущие плоды всегда разные: три варианта по кругу
function vGrapes(x, y, s, rot = 0, st = 6, bend = 2) {
  const v = SM_VAR.grape++ % 3;
  let h = `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(0)}) scale(${(s * VS).toFixed(2)}) translate(0 ${st})"><path d="M0 ${-st} Q${bend} ${-st / 2} 0 0" stroke="${VINE_DARK}" stroke-width="1.4" fill="none"/>`;
  // 0 — тёмно-фиолетовая круглая гроздь; 1 — зелёная длинная; 2 — розово-красная широкая с плечами
  const V = [
    { rows: [[-6, 0, 6], [-3, 3], [-4, 4], [0]], r: 4.2, dy: 6.6, c: '#5a2a7a', hi: '#c8a0e8' },
    { rows: [[-3.5, 3.5], [-3.5, 0, 3.5], [-3.5, 3.5], [0, -0.01], [0]], r: 3.6, dy: 5.6, c: '#9acb4c', hi: '#e6f6a8' },
    { rows: [[-8, -2.7, 2.7, 8], [-5.4, 0, 5.4], [-2.7, 2.7], [0]], r: 3.9, dy: 6.2, c: '#b8344c', hi: '#f6a0b0' },
  ][v];
  let yy = 4;
  for (const r of V.rows) { for (const dx of r) h += `<circle cx="${dx}" cy="${yy}" r="${V.r}" fill="${V.c}" stroke="${VINE_DARK}" stroke-width="1"/><circle cx="${dx - 1.2}" cy="${yy - 1.4}" r="1.2" fill="${V.hi}" opacity=".8"/>`; yy += V.dy; }
  return h + '</g>';
}
function vWheat(x, y, len, rot) {
  const v = SM_VAR.wheat++ % 3;
  let h = `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(0)}) scale(${VS})"><path d="M0 0 Q${v === 1 ? 5 : 2} ${-len * 0.5} 0 ${-len}" stroke="${v === 2 ? '#7a9a3a' : '#9a8a3a'}" stroke-width="1.8" fill="none"/>`;
  if (v === 0) {   // пшеница: крупные золотые зёрна парами, усики
    for (let i = 0; i < 6; i++) {
      const yy = -len + 3 + i * 5;
      for (const sx of [-1, 1]) h += `<ellipse cx="${sx * 3.2}" cy="${yy}" rx="2.1" ry="4" transform="rotate(${sx * 24} ${sx * 3.2} ${yy})" fill="#e8c850" stroke="#8a6a1a" stroke-width=".8"/>`;
    }
    h += `<ellipse cx="0" cy="${-len - 3}" rx="2" ry="4.4" fill="#f0d664" stroke="#8a6a1a" stroke-width=".8"/>`;
    for (const sx of [-1, 0, 1]) h += `<path d="M${sx * 2} ${-len - 6} L${sx * 5} ${-len - 17}" stroke="#d8b84a" stroke-width=".7"/>`;
  } else if (v === 1) {   // ячмень: плотный колос, длинные остья в стороны
    for (let i = 0; i < 8; i++) {
      const yy = -len + 2 + i * 3.6;
      for (const sx of [-1, 1]) h += `<ellipse cx="${sx * 2.2}" cy="${yy}" rx="1.7" ry="3" transform="rotate(${sx * 14} ${sx * 2.2} ${yy})" fill="#d8a838" stroke="#7a5a18" stroke-width=".8"/><path d="M${sx * 3} ${yy - 1} L${sx * 11} ${yy - 8}" stroke="#c8a040" stroke-width=".6"/>`;
    }
  } else {   // зелёный овёс: метёлка с висящими колосками
    for (let i = 0; i < 5; i++) {
      const yy = -len + 2 + i * 5, sx = i % 2 ? 1 : -1;
      h += `<path d="M0 ${yy} Q${sx * 6} ${yy - 2} ${sx * 7} ${yy + 4}" stroke="#7a9a3a" stroke-width=".8" fill="none"/><ellipse cx="${sx * 7}" cy="${yy + 7}" rx="1.9" ry="3.6" fill="#c8d870" stroke="#5a6a1a" stroke-width=".8"/>`;
    }
    h += `<ellipse cx="0" cy="${-len - 2}" rx="1.8" ry="3.8" fill="#d8e080" stroke="#5a6a1a" stroke-width=".8"/>`;
  }
  return h + '</g>';
}
function vHop(x, y, s, rot = 0, st = 7, bend = 2) {
  // шишка: ряды перекрывающихся чешуек, сужается книзу; варианты — обычная, длинная тёмная, короткая жёлто-зелёная
  const n = SM_VAR.hop++ % 6, v = n % 3;
  const V = [
    { rows: [[-4.2, 0, 4.2], [-5.2, -1.7, 1.7, 5.2], [-4.6, -1.5, 1.5, 4.6], [-3.4, 0, 3.4], [-1.9, 1.9], [0]], dy: 3.7, cols: ['#b8dc5a', '#9cc848', '#86b83a'] },
    { rows: [[-2.4, 2.4], [-3.4, 0, 3.4], [-3.6, -1.2, 1.2, 3.6], [-3.2, 0, 3.2], [-2.6, 0, 2.6], [-1.6, 1.6], [0]], dy: 3.6, cols: ['#78a838', '#5e9230', '#82b440'] },
    { rows: [[-5.6, -1.9, 1.9, 5.6], [-5.6, 0, 5.6], [-3.2, 3.2], [0]], dy: 4.2, cols: ['#d4e46a', '#c0d452', '#e6ee8a'] },
  ][v];
  // шесть расцветок: зелёная, тёмно-зелёная, салатовая, жёлтая, тёмная (почти чёрно-зелёная), розовая; формы чередуются
  if (n >= 3) V.cols = [['#f2d84a', '#e0c030', '#f8e676'], ['#3a5028', '#2a3c1c', '#4a6234'], ['#f0a0c0', '#e07ca4', '#f8c0d6']][n - 3];
  let h = `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(0)}) scale(${(s * VS).toFixed(2)}) translate(0 ${st})"><path d="M0 ${-st} Q${bend} ${-st / 2} 0 0" stroke="${VINE_DARK}" stroke-width="1.3" fill="none"/>`;
  for (let r = V.rows.length - 1; r >= 0; r--) {
    const yy = 2 + r * V.dy, sz = 3.6 - r * (v === 1 ? 0.2 : 0.28);
    V.rows[r].forEach((dx, k) => {
      h += `<path d="M${dx - sz} ${yy - 2.2} Q${dx - sz * 0.9} ${yy + sz * 0.7} ${dx} ${yy + sz * 1.45} Q${dx + sz * 0.9} ${yy + sz * 0.7} ${dx + sz} ${yy - 2.2} Q${dx} ${yy - 3.4} ${dx - sz} ${yy - 2.2} Z" fill="${V.cols[(r + k) % 3]}" stroke="${VINE_DARK}" stroke-width=".9"/><path d="M${dx} ${yy - 1.4} L${dx} ${yy + sz * 0.9}" stroke="#4a7a22" stroke-width=".6" opacity=".7"/>`;
    });
  }
  return h + '</g>';
}

// плод на изогнутой ножке: качается в обе стороны, иногда торчит вбок, ножка то короткая, то длинная
function smFruit(kind, x, y, sc, side, rnd) {
  const rot = (rnd() - 0.5) * 80 + side * 12, st = 3 + rnd() * 11, bend = (rnd() - 0.5) * 10;
  return kind === 'hops' ? vHop(x, y, sc, rot, st, bend) : vGrapes(x, y, sc, rot, st, bend);
}

function vineSVG(w, h, kind, seed) {
  const rnd = smRand(seed * 977 + 13), P = 16;
  const W = w + P * 2, H = h + P * 2;
  // путь стебля: обвивает кнопку по всему периметру (чуть больше круга), то снаружи кромки, то поверх неё
  const pts = [];
  const laps = 1.12, per = 2 * (w + h), n = Math.max(8, Math.round(per * laps / 10)), s0 = rnd(), ph = rnd() * 6.28, fr = 5 + rnd() * 2;
  for (let i = 0; i <= n; i++) {
    const f = i / n, [x, y, nx, ny] = smPerim(s0 + f * laps, w, h);
    const o = Math.sin(f * laps * Math.PI * 2 * fr + ph) * 3.4 + 0.5;
    pts.push([P + x + nx * o, P + y + ny * o]);
  }
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; d += ` Q${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`; }
  const lastP = pts[pts.length - 1]; d += ` L${lastP[0].toFixed(1)} ${lastP[1].toFixed(1)}`;
  let svg = `<svg class="sm-vine" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="left:${-P}px;top:${-P}px" aria-hidden="true">`;
  svg += `<path d="${d}" fill="none" stroke="${VINE_DARK}" stroke-width="3.4" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${kind === 'wheat' ? '#9a8a3a' : '#4a7a22'}" stroke-width="1.8" stroke-linecap="round"/>`;
  const greens = ['#5a9a2a', '#6aaa34', '#4a8a24', '#78b83e'];
  let items = '';
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i], nx = pts[i + 1][0] - pts[i - 1][0], ny = pts[i + 1][1] - pts[i - 1][1];
    const ang = Math.atan2(ny, nx) * 180 / Math.PI;        // направление стебля
    const side = i % 2 ? 1 : -1;
    if (kind === 'wheat') {
      if (rnd() < 0.55) items += vWheat(x, y, 18 + rnd() * 20, ang + 90 * side + (rnd() - 0.5) * 50);
      else items += vLeaf(x, y, ang + 90 * side * 0.9, 0.9, 'plain', '#8aa83a');
    } else {
      items += vLeaf(x, y, ang + 90 * side + (rnd() - 0.5) * 30, 0.9 + rnd() * 0.5, kind, greens[(i * 7) % 4]);
      if (i % 2 === 0) items += smFruit(kind, x + ((i >> 1) % 2 ? 2 : -2), y + 2, 0.8 + rnd() * 0.35, (i >> 1) % 2 ? 1 : -1, rnd);   // по плоду через звено, по очереди с сторон — не толпятся
    }
  }
  // усики-завитки
  for (let k = 0; k < 3; k++) { const [x, y] = pts[1 + ((rnd() * (pts.length - 2)) | 0)]; const r = 4 + rnd() * 3; items += `<path d="M${x.toFixed(1)} ${y.toFixed(1)} q${r} ${-r} ${r * 1.6} 0 q${-r * 0.4} ${r} ${-r * 0.8} ${r * 0.2}" fill="none" stroke="#6aaa34" stroke-width="1.1"/>`; }
  return svg + items + '</svg>';
}

// Пиксель-арт: рисуем векторную лозу в крошечный холст (клетка SM_PX экранных пикселей),
// убираем сглаживание (жёсткий альфа-порог) и ужимаем палитру, потом растягиваем без сглаживания
const SM_PX = 2;
function smPixelCanvas(svg, W, H, cls, left, top) {
  const cv = document.createElement('canvas');
  cv.className = cls;
  cv.width = Math.max(1, Math.ceil(W / SM_PX)); cv.height = Math.max(1, Math.ceil(H / SM_PX));
  cv.style.cssText = `left:${left}px;top:${top}px;width:${W}px;height:${H}px;image-rendering:pixelated`;
  const img = new Image();
  img.onload = () => {
    const c = cv.getContext('2d', { willReadFrequently: true });
    c.imageSmoothingQuality = 'high';
    c.drawImage(img, 0, 0, cv.width, cv.height);
    const d = c.getImageData(0, 0, cv.width, cv.height), a = d.data;
    for (let i = 0; i < a.length; i += 4) {
      if (a[i + 3] < 90) { a[i + 3] = 0; continue; }
      a[i + 3] = 255;
      for (let k = 0; k < 3; k++) a[i + k] = Math.min(255, (a[i + k] >> 5) * 36 + 12);   // 8 уровней на канал
    }
    // тёмная обводка в один пиксель вокруг всего рисунка, как у спрайтов игры
    const w = cv.width, h = cv.height, src = new Uint8ClampedArray(a);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (src[i + 3]) continue;
      if ((x > 0 && src[i - 1]) || (x < w - 1 && src[i + 7]) || (y > 0 && src[i - w * 4 + 3]) || (y < h - 1 && src[i + w * 4 + 3])) { a[i] = 22; a[i + 1] = 28; a[i + 2] = 12; a[i + 3] = 255; }
    }
    c.putImageData(d, 0, 0);
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  return cv;
}
function smPixelVine(svgStr) {
  const m = /width="(\d+)" height="(\d+)" viewBox[^>]*style="left:(-?\d+)px;top:(-?\d+)px"/.exec(svgStr);
  const svg = svgStr.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ').replace(/ class="sm-vine"/, '');
  return smPixelCanvas(svg, +m[1], +m[2], 'sm-vine', +m[3], +m[4]);
}

function decorateVines() {
  const btns = document.querySelectorAll('#start-menu .sm-panel:not(.hidden) .sm-btn');
  // нечётная последняя кнопка (скрытые не считаем) занимает весь ряд
  const vis = [...btns].filter(b => b.offsetWidth && !b.closest('.sm-sub'));
  vis.forEach(b => b.classList.remove('sm-wide'));
  if (vis.length % 2) vis[vis.length - 1].classList.add('sm-wide');
  btns.forEach((b, i) => {
    const old = b.querySelector('.sm-vine'); if (old) old.remove();
    const w = b.offsetWidth, h = b.offsetHeight;
    if (!w || !h) return;
    b.appendChild(smPixelVine(vineSVG(w, h, VINE_KINDS[(i + (smVineShift++)) % 3], i * 31 + smVineShift)));
    if (smSlide) {   // кнопка выплывает вбок со своей стороны, лоза прорастает следом
      const r = b.getBoundingClientRect(), fromRight = r.left + r.width / 2 > window.innerWidth / 2 + 4 || (Math.abs(r.left + r.width / 2 - window.innerWidth / 2) <= 4 && i % 2);
      const d = (i * 0.09).toFixed(2);
      b.classList.remove('sm-in-l', 'sm-in-r'); void b.offsetWidth;
      b.style.setProperty('--d', d + 's');
      b.classList.add(fromRight ? 'sm-in-r' : 'sm-in-l');
    }
  });
}
let smVineShift = 0, smSlide = false;

{
  const _show = smShow;
  smShow = function (p) { _show(p); smSlide = true; requestAnimationFrame(() => { decorateVines(); smSlide = false; }); };
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

// Субботник — в боковое меню (вкладка «Меню»), а не в верхнюю панель
{
  const _s2 = startGame;
  startGame = function () {
    _s2();
    const b = document.getElementById('sub-btn'), list = document.querySelector('#tab-menu .menu-list');
    if (b && list && b.parentElement !== list) { const wrap = b.parentElement; list.prepend(b); if (wrap && wrap.classList.contains('speed') && !wrap.children.length) wrap.remove(); }
  };
}

// ---------- Выбор кнопки: стебель прорастает, обвивает её, летят искры ----------

const SM_DELAY = 620;   // сколько показываем рост, прежде чем выполнить действие
let smPicking = false;

function smPerim(s, w, h, r) {   // точка на скруглённом периметре кнопки: s ∈ [0,1) от левого верха по часовой
  const L = 2 * (w + h);
  let d = ((s % 1) + 1) % 1 * L, x, y, nx, ny;
  if (d < w) { x = d; y = 0; nx = 0; ny = -1; }
  else if ((d -= w) < h) { x = w; y = d; nx = 1; ny = 0; }
  else if ((d -= h) < w) { x = w - d; y = h; nx = 0; ny = 1; }
  else { d -= w; x = 0; y = h - d; nx = -1; ny = 0; }
  return [x, y, nx, ny];
}

function smGrow(btn) {
  const old = btn.querySelector('.sm-grow'); if (old) old.remove();
  const w = btn.offsetWidth, h = btn.offsetHeight, P = 22;
  if (!w || !h) return;
  const rnd = smRand(Date.now() & 0xffff);
  let sparks = '';
  for (let i = 0; i < 14; i++) {
    const [x, y, nx, ny] = smPerim(rnd(), w, h);
    const a = Math.atan2(ny, nx) + (rnd() - 0.5) * 1.6, dist = 14 + rnd() * 26;
    sparks += `<i class="sm-spark" style="left:${(x + P).toFixed(0)}px;top:${(y + P).toFixed(0)}px;--dx:${(Math.cos(a) * dist).toFixed(0)}px;--dy:${(Math.sin(a) * dist - 10).toFixed(0)}px;animation-delay:${(0.05 + rnd() * 0.4).toFixed(2)}s"></i>`;
  }
  btn.insertAdjacentHTML('beforeend', `<span class="sm-grow" style="left:${-P}px;top:${-P}px;width:${w + P * 2}px;height:${h + P * 2}px">${sparks}</span>`);
  // та же лоза сползает вниз и исчезает, потом отрастает заново
  btn.classList.remove('sm-peel', 'sm-regrow'); void btn.offsetWidth;
  btn.classList.add('sm-peel');
  clearTimeout(btn._peelT);
  btn._peelT = setTimeout(() => {
    btn.classList.remove('sm-peel'); void btn.offsetWidth; btn.classList.add('sm-regrow');
    btn._peelT = setTimeout(() => btn.classList.remove('sm-regrow'), 700);
  }, SM_DELAY + 40);
}

// выбор — наведение пальца/мыши и нажатие; действие откладываем на время роста
{
  const root = () => document.getElementById('start-menu');
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest && e.target.closest('#start-menu .sm-btn');
    if (b && !b.disabled && !smPicking) smGrow(b, VINE_KINDS[(Math.random() * 3) | 0]);
  }, true);
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('#start-menu [data-sm]');
    if (!b || b.disabled) return;
    if (smPicking) { e.stopImmediatePropagation(); return; }
    if (!b.querySelector('.sm-grow')) smGrow(b, VINE_KINDS[(Math.random() * 3) | 0]);
    if (b.dataset.sm === 'back' || b.dataset.sm === 'mp') return;
    // действие после роста: перехватываем клик и пускаем заново
    e.stopImmediatePropagation();
    smPicking = true;
    b.classList.add('sm-picked');
    setTimeout(() => { smPicking = false; b.classList.remove('sm-picked'); const g = b.querySelector('.sm-grow'); if (g) g.remove(); smAction(b.dataset.sm); }, SM_DELAY);
  }, true);
}
// касание без выбора (палец уехал) — стебель убираем сам
{
  const _grow = smGrow;
  smGrow = function (btn, kind) {
    _grow(btn, kind);
    const g = btn.querySelector('.sm-grow');
    if (g) setTimeout(() => { if (!btn.classList.contains('sm-picked') && g.parentNode) g.remove(); }, 1500);
  };
}

// ---------- «Мультиплеер» — выпадающий список: общая деревня, копия общего мира, свой сервер ----------
// Кнопка раскрывает плашку над собой; остальные кнопки меню остаются короткими.

function smSub() {
  const main = document.querySelector('#start-menu [data-panel="main"]');
  if (!main) return null;
  let sub = main.querySelector('.sm-sub');
  if (!sub) {
    sub = document.createElement('div');
    sub.className = 'sm-sub hidden';
    sub.innerHTML = '<button class="sm-btn ghost" data-sm="mpown"><b>Свой сервер</b><small>ник и адрес друга</small></button>';
    main.appendChild(sub);
  }
  return sub;
}
// кнопки кооператива (общая деревня, копия мира) складываются в список; первой — главная
function smSubAdd(btn, first) {
  const sub = smSub();
  if (!sub) return;
  btn.classList.remove('primary');
  if (first) sub.prepend(btn); else sub.insertBefore(btn, sub.querySelector('[data-sm="mpown"]'));
  const mp = document.querySelector('#start-menu [data-sm="mp"] small');
  if (mp && !mp.dataset.sub) { mp.dataset.sub = '1'; mp.textContent = 'общая деревня, друзья ▾'; }
}
function smSubToggle(open) {
  const sub = smSub(), mp = document.querySelector('#start-menu [data-sm="mp"]');
  if (!sub || !mp) return;
  const show = open === undefined ? sub.classList.contains('hidden') : open;
  sub.classList.toggle('hidden', !show);
  if (show) {
    const r = mp.getBoundingClientRect(), root = document.getElementById('start-menu').getBoundingClientRect(), w = Math.max(r.width, 220);
    sub.style.width = w + 'px';
    sub.style.left = Math.max(8, Math.min(root.width - w - 8, r.left - root.left)) + 'px';
    sub.style.bottom = (root.bottom - r.top + 8) + 'px';
    requestAnimationFrame(decorateVines);
  }
}
{
  const _act = smAction;
  smAction = function (a) {
    if (a === 'mp') {
      const sub = smSub();
      // в списке только «Свой сервер» — раскрывать нечего, сразу открываем
      if (sub && sub.children.length > 1) { smSubToggle(); return; }
      _act('mp'); return;
    }
    if (a === 'mpown') { smSubToggle(false); _act('mp'); return; }
    smSubToggle(false);
    _act(a);
  };
  // нажатие в списке (кроме «Свой сервер») закрывает его; тап мимо — тоже
  document.addEventListener('click', e => {
    const sub = document.querySelector('#start-menu .sm-sub');
    if (!sub || sub.classList.contains('hidden')) return;
    if (e.target.closest('.sm-sub')) { if (!e.target.closest('[data-sm="mpown"]')) setTimeout(() => smSubToggle(false), 0); return; }
    if (!e.target.closest('[data-sm="mp"]')) smSubToggle(false);
  });
  const _init = initStartMenu;
  initStartMenu = function () { _init(); smSub(); const mp = document.querySelector('#start-menu [data-sm="mp"] small'); if (mp) mp.textContent = 'играть с друзьями'; };
}
