'use strict';
// Левая колонка: вкладки, строительство, склад, жители, хозяйство, меню и окно здания.

const UI = { cat: 0, tab: 'build', hoverType: null, last: {}, bicons: {} };

// ---------- Мелочи ----------

function toast(text, target) {
  const box = document.getElementById('toasts');
  if (!box) return;
  if (box.childElementCount > 3) box.firstChild.remove();
  const el = document.createElement('div');
  el.className = 'toast' + (target ? ' link' : '');
  el.textContent = text;
  if (target) el.onclick = () => focusBuilding(target);
  box.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function focusBuilding(b) {
  if (!b || b.removed) return;
  selectBuilding(b);
  centerOn((b.x + b.w / 2) * TILE, (b.y + b.h / 2) * TILE);
}

const gi = (g, cls = '') => `<img class="${cls}" src="${iconURL('good', g, 2)}" alt="" title="${GOODS[g].name}">`;
const ui = n => `<img src="${iconURL('ui', n, 2)}" alt="">`;

function costHTML(cost) {
  return '<div class="cost">' + Object.entries(cost).filter(([, n]) => n)
    .map(([g, n]) => `<span>${gi(g)}${n}</span>`).join('') + '</div>';
}

// Иконка здания: обрезаем прозрачные поля спрайта и плавно уменьшаем.
function buildingIconURL(type) {
  if (UI.bicons[type]) return UI.bicons[type];
  const spr = buildingSprite(type).canvas;
  const c0 = spr.getContext('2d');
  const d = c0.getImageData(0, 0, spr.width, spr.height).data;
  let x0 = spr.width, y0 = spr.height, x1 = 0, y1 = 0;
  for (let y = 0; y < spr.height; y++) for (let x = 0; x < spr.width; x++) {
    if (d[(y * spr.width + x) * 4 + 3] === 0) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const k = Math.min(144 / w, 108 / h);
  const cv = mkCanvas(144, 108), c = cv.getContext('2d');
  c.imageSmoothingEnabled = k < 1;
  c.imageSmoothingQuality = 'high';
  c.drawImage(spr, x0, y0, w, h, (144 - w * k) / 2, 108 - h * k, w * k, h * k);
  UI.bicons[type] = cv.toDataURL();
  return UI.bicons[type];
}

function makeUITextures() {
  const wood = mkCanvas(128, 128), w = wood.getContext('2d');
  const r = mulberry32(5);
  w.fillStyle = '#2a1e14'; w.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x++) {
    const v = Math.sin(x * 0.18) * 0.5 + Math.sin(x * 0.53 + 1) * 0.3 + (r() - 0.5) * 0.7;
    w.fillStyle = v > 0 ? `rgba(110,78,46,${v * 0.22})` : `rgba(6,4,2,${-v * 0.3})`;
    w.fillRect(x, 0, 1, 128);
  }
  for (let k = 0; k < 18; k++) { w.fillStyle = 'rgba(8,5,2,0.35)'; w.fillRect((r() * 128) | 0, 0, 1, 128); }
  for (let y = 0; y < 128; y += 32) { w.fillStyle = 'rgba(0,0,0,0.35)'; w.fillRect(0, y, 128, 1); w.fillStyle = 'rgba(255,220,160,0.05)'; w.fillRect(0, y + 1, 128, 1); }
  document.documentElement.style.setProperty('--wood-tex', `url(${wood.toDataURL()})`);
}

function setTool(tool) {
  Game.tool = tool;
  R.roadDrag = null;
  document.querySelectorAll('.bbtn, .tools button').forEach(b => b.classList.remove('active'));
  mobileTool(tool);
  if (!tool) return;
  if (tool.kind === 'build') document.querySelector(`.bbtn[data-type="${tool.type}"]`)?.classList.add('active');
  if (tool.kind === 'road') document.getElementById('tool-road').classList.add('active');
  if (tool.kind === 'erase') document.getElementById('tool-erase').classList.add('active');
}

function setSpeed(s) {
  Game.paused = s === 0;
  if (s) Game.speed = s;
  document.querySelectorAll('[data-speed]').forEach(b =>
    b.classList.toggle('active', Game.paused ? b.dataset.speed === '0' : +b.dataset.speed === Game.speed));
}

function openTab(name) {
  UI.tab = name;
  document.querySelectorAll('#tabs .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + name));
  updateUI(true);
}

function openBuildCat(k) {
  if (k < 0 || k >= BUILD_CATS.length) return;
  UI.cat = k;
  openTab('build');
  renderBuildList();
}

function queueTraining(type) {
  const schools = Game.buildings.filter(b => b.type === 'school' && b.state === 'done');
  if (!schools.length) { toast('Нет готовой школы'); return; }
  schools.sort((a, b) => a.queue.length - b.queue.length);
  if (schools[0].queue.length >= 10) { toast('Очередь в школе заполнена'); return; }
  schools[0].queue.push(type);
  toast(`В школу: ${UNIT_TYPES[type].name}`);
}

// ---------- Инициализация ----------

function initUI() {
  makeUITextures();
  document.querySelectorAll('img[data-icon]').forEach(im => { im.src = iconURL('ui', im.dataset.icon, 2); });

  document.querySelectorAll('#tabs .tab-btn').forEach(btn => { btn.onclick = () => Mobile.on ? mobileTab(btn.dataset.tab) : openTab(btn.dataset.tab); });

  const cats = document.getElementById('build-cats');
  BUILD_CATS.forEach((name, k) => {
    const b = document.createElement('button');
    b.innerHTML = `${name}<kbd>${k + 1}</kbd>`;
    b.title = `${name} (${k + 1})`;
    b.onclick = () => openBuildCat(k);
    cats.appendChild(b);
  });
  renderBuildList();

  document.getElementById('tool-road').onclick = () => setTool(Game.tool && Game.tool.kind === 'road' ? null : { kind: 'road' });
  document.getElementById('tool-rotate').onclick = () => rotateTool();
  document.getElementById('tool-erase').onclick =() => setTool(Game.tool && Game.tool.kind === 'erase' ? null : { kind: 'erase' });

  document.querySelectorAll('[data-speed]').forEach(btn => { btn.onclick = () => setSpeed(+btn.dataset.speed); });
  document.getElementById('help-close').onclick = () => document.getElementById('help').classList.add('hidden');

  document.querySelector('#tab-menu').addEventListener('click', e => {
    const t = e.target.closest('[data-menu]');
    if (!t) return;
    const m = t.dataset.menu;
    track('menu-' + m, { save: 'Сохранил игру', load: 'Загрузил сохранение', loadauto: 'Загрузил автосохранение', new: 'Открыл «Новая карта»', help: 'Открыл «Как играть»' }[m]);
    if (m === 'save') toast(saveGame('manual') ? 'Игра сохранена' : 'Не удалось сохранить');
    if (m === 'load') { if (loadGame('manual')) { toast('Игра загружена'); updateUI(true); } else toast('Сохранения нет'); }
    if (m === 'loadauto') { if (loadGame('auto')) { toast('Загружено автосохранение'); updateUI(true); } else toast('Автосохранения пока нет'); }
    if (m === 'new' && confirm('Начать на новой карте? Несохранённый прогресс пропадёт.')) newGame();
    if (m === 'help') document.getElementById('help').classList.toggle('hidden');
    updateUI(true);
  });

  // склад: клик по слоту — запретить/разрешить приём
  document.getElementById('store-list').addEventListener('click', e => {
    const s = e.target.closest('[data-block]');
    if (!s) return;
    const g = s.dataset.block;
    Game.storeBlock[g] = !Game.storeBlock[g];
    toast(Game.storeBlock[g] ? `Склады не принимают: ${GOODS[g].name}` : `Склады снова принимают: ${GOODS[g].name}`);
    updateUI(true);
  });

  document.getElementById('people-list').addEventListener('click', e => {
    const t = e.target.closest('[data-train]');
    if (t) { queueTraining(t.dataset.train); updateUI(true); }
  });

  document.getElementById('overview').addEventListener('click', e => {
    const a = e.target.closest('[data-goto]');
    if (!a) return;
    const b = Game.buildings.find(x => x.id === +a.dataset.goto);
    if (b) focusBuilding(b);
  });

  const info = document.getElementById('info');
  info.addEventListener('click', e => {
    const t = e.target.closest('button, [data-untrain-at], [data-block]');
    if (!t) return;
    const b = Game.selected;
    if (!b || b.removed) return;
    const act = t.dataset.act;
    if (t.dataset.train) { if (b.queue.length < 10) b.queue.push(t.dataset.train); }
    else if (t.dataset.untrainAt) b.queue.splice(+t.dataset.untrainAt, 1);
    else if (act === 'demolish') {
      if (b.isRoad) removeRoadSite(b);
      else if (b.state !== 'done' || confirm(`Снести «${b.def.name}»?`)) removeBuilding(b);
      Game.selected = null;
    }
    else if (act === 'pause') b.paused = !b.paused;
    else if (act === 'goto') focusBuilding(b);
    else if (act === 'prev') cycleBuilding(-1);
    else if (act === 'next') cycleBuilding(1);
    else if (act === 'hire') queueTraining(b.def.worker);
    else if (t.dataset.block) Game.storeBlock[t.dataset.block] = !Game.storeBlock[t.dataset.block];
    updateUI(true);
  });
  info.addEventListener('change', e => {
    const t = e.target;
    const b = Game.selected;
    if (t.dataset.recipe !== undefined && b) { b.recipeOn[+t.dataset.recipe] = t.checked; updateUI(true); }
    if (t.dataset.crop && b) { b.crops[t.dataset.crop] = t.checked; updateUI(true); }
  });
}

function renderBuildList() {
  document.querySelectorAll('#build-cats button').forEach((b, k) => b.classList.toggle('active', k === UI.cat));
  const list = document.getElementById('build-list');
  list.innerHTML = '';
  const cat = BUILD_CATS[UI.cat];
  for (const type of BUILD_ORDER) {
    const def = BUILDINGS[type];
    if (def.cat !== cat) continue;
    const btn = document.createElement('button');
    btn.className = 'bbtn';
    btn.dataset.type = type;
    btn.innerHTML = `<img class="bimg" src="${buildingIconURL(type)}" alt=""><span class="bname">${def.name}</span>${costHTML(def.cost)}`;
    btn.onclick = () => setTool(Game.tool && Game.tool.type === type ? null : { kind: 'build', type, rot: def.noRotate ? 0 : (UI.lastRot || 0) });
    btn.onmouseenter = () => { if (Mobile.on) return; UI.hoverType = type; updateUI(true); };
    btn.onmouseleave = () => { UI.hoverType = null; updateUI(true); };
    if (Game.tool && Game.tool.type === type) btn.classList.add('active');
    list.appendChild(btn);
  }
}

// ---------- Содержимое вкладок ----------

function totals() {
  const t = emptyGoods();
  for (const b of Game.buildings) if (b.isStore()) for (const g of GOOD_KEYS) t[g] += b.stock[g];
  return t;
}

function storeHTML() {
  const t = totals();
  let h = '<div class="muted small">Клик по товару — запретить складам его принимать.</div>';
  for (const grp of GOOD_GROUPS) {
    h += `<div class="group-title">${grp}</div><div class="slots">`;
    for (const g of GOOD_KEYS) if (GOODS[g].group === grp)
      h += `<div class="slot click${t[g] ? '' : ' zero'}${Game.storeBlock[g] ? ' blocked' : ''}" data-block="${g}" title="${GOODS[g].name}">${gi(g)}<span class="n">${t[g]}</span></div>`;
    h += '</div>';
  }
  return h;
}

function peopleHTML() {
  const cnt = {}, idle = {}, queued = {};
  let hungry = 0, smoking = 0, sleeping = 0, hurt = 0;
  for (const u of Game.units) {
    cnt[u.type] = (cnt[u.type] || 0) + 1;
    if (u.idleFlag || (!u.home && !u.isCourier && u.type !== 'builder')) idle[u.type] = (idle[u.type] || 0) + 1;
    if (!u.noFood && u.food < HUNGRY) hungry++;
    if (u.brk && u.brk.kind === 'sleep') sleeping++;
    else if (u.brk) smoking++;
    if (u.injury) hurt++;
  }
  for (const b of Game.buildings) if (b.type === 'school') {
    for (const q of b.queue) queued[q] = (queued[q] || 0) + 1;
    if (b.training) queued[b.training.type] = (queued[b.training.type] || 0) + 1;
  }
  let h = `<div class="stat-row"><b>Всего жителей</b><span class="v">${Game.units.length}</span></div>`;
  if (hungry) h += `<div class="stat-row warn">Голодных: ${hungry}</div>`;
  if (smoking) h += `<div class="stat-row muted">На перекуре: ${smoking}</div>`;
  if (sleeping) h += `<div class="stat-row warn">Спят пьяные: ${sleeping}</div>`;
  if (hurt) h += `<div class="stat-row warn">Травмированы: ${hurt}</div>`;
  for (const k of ALL_UNIT_KEYS) {
    const c = cnt[k] || 0;
    const T = UNIT_TYPES[k];
    if (T.noTrain && !c) continue;
    h += `<div class="prow"><img class="portrait" src="${portraitURL(k)}" alt="">
      <div><div class="pn">${T.name}</div><div class="muted small">${idle[k] ? `свободно: ${idle[k]}` : c ? 'все заняты' : 'нет'}${queued[k] ? ` · учится: ${queued[k]}` : ''}</div></div>
      <span class="pc">${c}</span>${T.noTrain ? '<span></span>' : `<button data-train="${k}" title="Обучить в школе (1 золото)">+</button>`}</div>`;
  }
  return h;
}

function collectAlerts() {
  const out = [];
  const idleBuilders = Game.units.filter(u => u.type === 'builder' && u.idleFlag).length;
  for (const b of Game.buildings) {
    if (b.state !== 'done') {
      if (b.problem() === 'noroad') out.push({ b, icon: ['ui', 'road'], text: `${b.def.name}: стройка без дороги к складу` });
      else if (!b.builder && !idleBuilders) out.push({ b, icon: ['ui', 'noworker'], text: `${b.def.name}: стройка ждёт строителя` });
      continue;
    }
    const p = b.problem();
    if (!p || p === 'paused') continue;
    if (p === 'noroad') { out.push({ b, icon: ['ui', 'road'], text: `${b.def.name}: нет дороги к складу` }); continue; }
    if (p === 'noworker') out.push({ b, icon: ['ui', 'noworker'], text: `${b.def.name}: нужен ${UNIT_TYPES[b.def.worker].name.toLowerCase()}` });
    else if (p === 'full') out.push({ b, icon: ['ui', 'full'], text: `${b.def.name}: всё заполнено` });
    else if (p.startsWith('need:')) out.push({ b, icon: ['good', p.slice(5)], text: `${b.def.name}: нет «${GOODS[p.slice(5)].name}»` });
  }
  for (const b of Game.buildings) if (b.type === 'school' && b.state === 'done' && b.queue.length && b.stock.gold < 1 && !b.training)
    out.push({ b, icon: ['good', 'gold'], text: 'Школа ждёт золото' });
  const hungry = Game.units.filter(u => u.food < HUNGRY).length;
  if (hungry) {
    const inn = Game.buildings.find(b => b.type === 'inn' && b.state === 'done');
    out.push({ b: inn, icon: ['good', 'bread'], text: `Голодных жителей: ${hungry}` + (inn && !innFood(inn) ? ' — в трактире нет еды' : '') });
  }
  return out;
}

function overviewHTML(alerts) {
  let h = '<div class="group-title">Проблемы</div>';
  if (!alerts.length) h += '<div class="muted small">Всё работает как надо.</div>';
  for (const a of alerts)
    h += `<div class="alert" ${a.b ? `data-goto="${a.b.id}"` : ''}><img src="${iconURL(a.icon[0], a.icon[1], 2)}" alt="">${a.text}</div>`;
  h += '<div class="group-title">Произведено за игру</div>';
  let any = false;
  for (const g of GOOD_KEYS) if (Game.produced[g]) {
    any = true;
    h += `<div class="stat-row">${gi(g)}${GOODS[g].name}<span class="v">${Game.produced[g]}</span></div>`;
  }
  if (!any) h += '<div class="muted small">Пока ничего.</div>';
  const counts = {};
  for (const b of Game.buildings) counts[b.type] = (counts[b.type] || 0) + 1;
  h += '<div class="group-title">Здания</div>';
  for (const t of BUILD_ORDER) if (counts[t]) h += `<div class="stat-row">${BUILDINGS[t].name}<span class="v">${counts[t]}</span></div>`;
  return h;
}

// ---------- Окно здания ----------

function statusChip(b) {
  if (b.isRoad) return b.dug < 1 ? `<span class="chip wait">Копают ${Math.round(b.dug * 100)}%</span>`
    : b.pave > 0 ? `<span class="chip wait">Мостят ${Math.round(b.pave * 100)}%</span>` : '<span class="chip wait">Выкопано, ждёт камень</span>';
  if (b.state !== 'done' && b.problem() === 'noroad') return '<span class="chip bad">Нет дороги к складу</span>';
  if (b.state === 'site') return '<span class="chip wait">Разметка площадки</span>';
  if (b.state === 'build') return `<span class="chip wait">Строится ${Math.round(b.progress * 100)}%</span>`;
  const p = b.problem();
  if (!p) return b.working || b.def.worker === undefined || b.type === 'woodcutter' || b.type === 'quarry' || b.type === 'farm'
    ? '<span class="chip ok">Работает</span>' : '<span class="chip ok">Готово</span>';
  if (p === 'noroad') return '<span class="chip bad">Нет дороги к складу</span>';
  if (p === 'paused') return '<span class="chip off">На паузе</span>';
  if (p === 'noworker') return '<span class="chip bad">Нет рабочего</span>';
  if (p === 'full') return '<span class="chip wait">Всё заполнено</span>';
  return `<span class="chip bad">Нет: ${GOODS[p.slice(5)].name}</span>`;
}

function slotHTML(g, n, cap, extra = '') {
  return `<div class="slot${n ? '' : ' zero'}${extra}" title="${GOODS[g].name}">${gi(g)}<span class="n">${cap != null ? `${n}/${cap}` : n}</span></div>`;
}

function recipeHTML(b, r, i) {
  const ins = Object.entries(r.in).map(([g, n]) => `${gi(g)}${n > 1 ? '×' + n : ''}`).join(' ');
  const outs = Object.entries(r.out).map(([g, n]) => `${gi(g)}${n > 1 ? '×' + n : ''}`).join(' ');
  const multi = b && b.def.recipes.length > 1;
  const on = !b || b.recipeOn[i];
  return `<div class="recipe${on ? '' : ' off'}">${ins || '<span class="muted">из недр</span>'}<span class="arrow">→</span>${outs}<span class="t">${r.time}с</span>${multi ? `<input type="checkbox" data-recipe="${i}" ${on ? 'checked' : ''} title="Производить">` : ''}</div>`;
}

function workerHTML(b) {
  const type = b.def.worker;
  const w = b.worker && b.worker.home === b ? b.worker : null;
  const st = w ? (w.inside === b ? (b.working ? 'работает' : 'внутри') : 'в пути / снаружи') : null;
  return `<div class="irow"><img class="portrait" src="${portraitURL(type, w ? w.look : 3)}" alt="">
    <div><div>${UNIT_TYPES[type].name}</div><div class="small ${w ? 'muted' : 'warn'}">${w ? st : 'нет — нужно обучить'}</div></div>
    ${w ? '' : '<button data-act="hire" style="margin-left:auto">Обучить</button>'}</div>`;
}

function infoBuilding(b) {
  if (b.isRoad) {
    return `<div class="ihead"><img class="bpic" src="${iconURL('ui', 'road', 2)}" alt=""><div><h3>Дорога</h3>${statusChip(b)}</div></div>
      <div class="slots">${slotHTML('stone', b.stock.stone, ROAD_STONE)}</div>
      <div class="irow">Строитель: ${b.builder ? (b.dug < 1 ? 'копает' : 'кладёт камень') : `<span class="muted">${b.dug < 1 ? 'ждёт свободного строителя' : 'ждёт камень'}</span>`}</div>
      <div class="tip">Сначала строитель бесплатно копает корыто, потом за 1 камень выкладывает мостовую.</div>
      <div class="iactions"><button data-act="demolish">${ui('trash')}Отменить</button></div>`;
  }
  const def = b.def;
  const same = Game.buildings.filter(x => x.type === b.type).length;
  let h = `<div class="ihead"><img class="bpic" src="${buildingIconURL(b.type)}" alt=""><div><h3>${def.name}</h3>${statusChip(b)}</div></div>`;
  h += '<div class="iactions">';
  if (same > 1) h += `<button data-act="prev" title="Предыдущее такое же ([)">${ui('prev')}</button><button data-act="next" title="Следующее такое же (])">${ui('next')}</button>`;
  h += `<button data-act="goto" title="Показать на карте">${ui('eye')}</button>`;
  if (b.state === 'done' && (def.worker || def.auto)) h += `<button data-act="pause" title="Пауза производства (P)" class="${b.paused ? 'active' : ''}">${ui(b.paused ? 'play' : 'pause')}</button>`;
  h += `<span class="grow"></span><button data-act="demolish" title="Снести">${ui('trash')}</button></div>`;

  if (b.state !== 'done') {
    h += `<div class="bar"><div style="width:${Math.round(b.progress * 100)}%"></div></div>`;
    h += '<div class="isec">Материалы</div><div class="slots">';
    for (const g in def.cost) if (def.cost[g]) h += slotHTML(g, b.usedOf[g] + b.stock[g], def.cost[g]);
    h += '</div>';
    h += `<div class="irow">Строитель: ${b.builder ? '<span class="good">работает</span>' : '<span class="warn">нет свободного</span>'}</div>`;
    return h + `<div class="idesc">${def.desc}</div>`;
  }

  if (b.autoJob) h += `<div class="bar mana"><div style="width:${Math.round((1 - b.autoJob.t / b.autoJob.r.time) * 100)}%"></div></div>`;
  if (def.worker) h += workerHTML(b);

  if (def.recipes) {
    h += `<div class="isec">Производство${def.recipes.length > 1 ? ' (галочки — что делать)' : ''}</div>`;
    def.recipes.forEach((r, i) => { h += recipeHTML(b, r, i); });
  }

  if (b.isStore()) {
    h += '<div class="isec">Хранится (клик — не принимать)</div><div class="slots">';
    for (const g of GOOD_KEYS) if (b.stock[g] || Game.storeBlock[g])
      h += `<div class="slot click${Game.storeBlock[g] ? ' blocked' : ''}" title="${GOODS[g].name}" data-block="${g}">${gi(g)}<span class="n">${b.stock[g]}</span></div>`;
    h += '</div>';
  } else {
    if (def.inputs) {
      h += '<div class="isec">Привезено</div><div class="slots">';
      for (const g in def.inputs) h += slotHTML(g, b.stock[g], def.inputs[g], b.wantsInput(g) ? '' : ' blocked');
      h += '</div>';
    }
    if (def.outputs) {
      h += '<div class="isec">Готово к вывозу</div><div class="slots">';
      for (const g in def.outputs) h += slotHTML(g, b.stock[g], def.outputs[g]);
      h += '</div>';
    }
  }

  if (b.type === 'school') {
    h += '<div class="isec">Обучение · 1 золото</div>';
    if (b.training) {
      h += `<div class="irow"><img class="portrait" src="${portraitURL(b.training.type)}" alt="">${UNIT_TYPES[b.training.type].name}</div>`;
      h += `<div class="bar"><div style="width:${Math.round(b.training.t / TRAIN_TIME * 100)}%"></div></div>`;
    } else if (b.queue.length && b.stock.gold < 1) h += '<div class="warn small">Ждём золото</div>';
    h += '<div class="queue">' + b.queue.map((q, i) => `<img src="${portraitURL(q)}" title="${UNIT_TYPES[q].name} — клик убирает" data-untrain-at="${i}">`).join('') + '</div>';
    h += '<div class="train-grid">';
    for (const t of UNIT_KEYS) {
      const q = b.queue.filter(x => x === t).length;
      h += `<button class="tbtn" data-train="${t}" title="${UNIT_TYPES[t].name}"><img src="${portraitURL(t)}" alt="">${UNIT_TYPES[t].name.slice(0, 7)}${q ? `<span class="q">${q}</span>` : ''}</button>`;
    }
    h += '</div>';
  }
  if (b.type === 'inn') {
    const hungry = Game.units.filter(u => u.food < HUNGRY).length;
    h += `<div class="irow ${hungry ? 'warn' : 'muted'}">Голодных: ${hungry}</div>`;
  }
  if (b.type === 'quarry') {
    let n = 0;
    for (let y = b.doorY - 10; y <= b.doorY + 10; y++) for (let x = b.doorX - 10; x <= b.doorX + 10; x++) {
      const o = inb(x, y) && World.obj[idx(x, y)];
      if (o && o.t === 'stone') n += o.n;
    }
    h += `<div class="irow ${n ? 'muted' : 'warn'}">Камня вокруг: ${n}</div>`;
  }
  if (b.type === 'woodcutter') {
    let n = 0, grown = 0;
    for (let y = b.doorY - 9; y <= b.doorY + 9; y++) for (let x = b.doorX - 9; x <= b.doorX + 9; x++) {
      const o = inb(x, y) && World.obj[idx(x, y)];
      if (o && o.t === 'tree') { n++; if (o.g >= 1) grown++; }
    }
    h += `<div class="irow muted">Деревьев рядом: ${n}, взрослых: ${grown}</div>`;
  }
  if (b.type === 'goatpen') {
    const n = Game.units.filter(x => x.type === 'goat' && x.homePen === b.id).length;
    const wild = Game.animals.filter(a => a.kind === 'goat').length;
    h += `<div class="irow">Вьючных коз: <b>${n}</b> из 3</div><div class="irow muted">Диких коз на карте: ${wild}</div>`;
  }
  if (b.type === 'stable') {
    const n = Game.units.filter(x => x.type === 'carter' && x.homeStable === b.id).length;
    h += `<div class="irow">Извозчиков: <b>${n}</b> из 3</div><div class="small muted">Лошадь: 3 сена + 2 зерна. Телега везёт сразу весь стек — до 5 штук.</div>`;
  }
  if (b.def.crops) {
    const cnt = {};
    for (const o of World.obj) if (o && o.t === 'field' && o.farm === b.id) cnt[o.crop || 'wheat'] = (cnt[o.crop || 'wheat'] || 0) + 1;
    h += '<div class="isec">Что сеять</div>';
    const CROP_NAMES = { wheat: 'Пшеница → зерно', hay: 'Травы → сено', hops: 'Хмель на шестах' };
    for (const crop of def.crops)
      h += `<div class="recipe${b.crops[crop] ? '' : ' off'}">${gi(crop)} ${CROP_NAMES[crop]}<span class="t">полей: ${cnt[crop] || 0}</span>${def.crops.length > 1 ? `<input type="checkbox" data-crop="${crop}" ${b.crops[crop] ? 'checked' : ''}>` : ''}</div>`;
    h += `<div class="irow muted">Всего полей: ${Object.values(cnt).reduce((a, v) => a + v, 0)} из ${FARM_FIELDS}</div>`;
  }
  if (b.type === 'swine') {
    const st = ['', '⅓', '⅔'];
    h += '<div class="isec">Загон</div>';
    h += `<div class="irow">Взрослых (3/3): <b>${b.stock.pig}</b> из ${def.outputs.pig}</div>`;
    h += `<div class="irow muted">Подрастают: ${b.pigs.length ? b.pigs.map(s => st[s]).join(', ') : 'нет'}</div>`;
    h += '<div class="small muted">Каждая охапка сена: все подрастают на треть и рождается поросёнок.</div>';
  }
  return h + `<div class="idesc">${def.desc}</div>`;
}

function infoPreview(type) {
  const def = BUILDINGS[type];
  let h = `<div class="ihead"><img class="bpic" src="${buildingIconURL(type)}" alt=""><div><h3>${def.name}</h3><span class="chip off">${def.cat}</span></div></div>`;
  h += '<div class="isec">Стоимость</div>' + costHTML(def.cost);
  if (def.worker) h += `<div class="irow"><img class="portrait" src="${portraitURL(def.worker)}" alt="">Работник: ${UNIT_TYPES[def.worker].name}</div>`;
  else if (def.auto) h += '<div class="irow muted">Работает без работника</div>';
  if (def.recipes) { h += '<div class="isec">Производство</div>'; def.recipes.forEach((r, i) => { h += recipeHTML(null, r, i); }); }
  else if (def.outputs) h += '<div class="isec">Добывает</div><div class="slots">' + Object.keys(def.outputs).map(g => slotHTML(g, 1)).join('') + '</div>';
  return h + `<div class="idesc">${def.desc}</div>`;
}

function infoTips() {
  return `<div class="ihead"><img class="bpic" src="${iconURL('ui', 'scroll', 2)}" alt=""><div><h3>Окно здания</h3><span class="chip off">ничего не выбрано</span></div></div>
    <div class="tip">Кликните по зданию на карте — здесь появятся его запасы, рабочий и производство.<br><br>
    Наведите на кнопку здания слева — увидите, что оно производит и сколько стоит.<br><br>
    <b>Значки над домами</b> подсказывают, чего не хватает: рабочего, сырья или места.</div>`;
}

// ---------- Обновление ----------

function setHTML(id, html) {
  if (UI.last[id] === html) return;
  UI.last[id] = html;
  document.getElementById(id).innerHTML = html;
}

function updateUI(force) {
  if (force) UI.last = {};
  const sel = Game.selected && !Game.selected.removed ? Game.selected : null;
  let info;
  if (sel) info = infoBuilding(sel);
  else if (UI.hoverType) info = infoPreview(UI.hoverType);
  else {
    const hb = R.hover && !Game.tool ? buildingAt(R.hover) : null;
    info = hb ? infoBuilding(hb) : infoTips();
  }
  setHTML('info', info);

  if (UI.tab === 'store') setHTML('store-list', storeHTML());
  if (UI.tab === 'people') setHTML('people-list', peopleHTML());
  const alerts = collectAlerts();
  if (UI.tab === 'overview') setHTML('overview', overviewHTML(alerts));
  if (UI.tab === 'menu') {
    const fmt = m => m ? `${new Date(m.at).toLocaleString('ru-RU')} · ${Math.floor(m.time / 60)} мин · ${m.people} жит.` : 'нет';
    setHTML('save-info', `Сохранение: ${fmt(saveMeta('manual'))}<br>Автосохранение: ${fmt(saveMeta('auto'))}`);
  }
  const badge = document.getElementById('alert-badge');
  badge.textContent = alerts.length;
  badge.classList.toggle('hidden', !alerts.length);

  const t = totals();
  const food = t.bread + t.sausage;
  setHTML('res-bar', [['timber', t.timber], ['stone', t.stone], ['gold', t.gold], ['bread', food], ['mana', t.mana]]
    .map(([g, n]) => `<span title="${g === 'bread' ? 'Еда (хлеб + колбаса)' : GOODS[g].name}">${gi(g)}${n}</span>`).join('')
    + `<span title="Жители">${ui('people')}${Game.units.length}</span>`);

  const sec = Math.floor(Game.time);
  document.getElementById('clock').textContent =
    `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}
