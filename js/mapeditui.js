'use strict';
// Редактор карт: список своих карт в стартовом меню и экран редактора (кисть, слои, проверка, цели, обмен).
// Логика формата, проверки и хранилища — в mapedit.js. Дизайн — КАРТЫ_РЕДАКТОР.md.

const MEUI = { E: null, ready: false };

const meEsc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const meEl = id => document.getElementById(id);

// ---------- Инструменты ----------
const ME_TOOLS = [
  { g: 'Рельеф' },
  { id: 'grass', ico: '🌿', name: 'Трава' }, { id: 'water', ico: '💧', name: 'Вода' }, { id: 'rock', ico: '⛰', name: 'Горы' }, { id: 'sand', ico: '🏖', name: 'Песок' },
  { g: 'Ресурсы' },
  { id: 'forest', ico: '🌲', name: 'Лес' }, { id: 'tree', ico: '🌳', name: 'Деревья' }, { id: 'stone', ico: '◼', name: 'Камни' }, { id: 'ore', ico: '💎', name: 'Руда' }, { id: 'erase', ico: '🧹', name: 'Ластик' },
  { g: 'Точки' },
  { id: 'start', ico: '🚩', name: 'Старт' }, { id: 'lair', ico: '🐗', name: 'Логово' },
  { g: 'Вид' },
  { id: 'hand', ico: '✋', name: 'Двигать' },
];
const ME_BRUSHES = [1, 2, 3, 5, 8];
const MEC = {   // цвета слоёв
  tree: [28, 74, 30], young: [78, 132, 54], stone: [178, 174, 162], rock: [116, 110, 102], ore: [178, 118, 200],
};

// ---------- Меню: кнопка и панель «Свои карты» ----------

function meInjectMenu() {
  const root = meEl('start-menu');
  if (!root || root.querySelector('[data-panel="maps"]')) return;
  const main = root.querySelector('[data-panel="main"]');
  const b = document.createElement('button');
  b.className = 'sm-btn'; b.dataset.me = 'open';
  b.innerHTML = '<b>Редактор карт</b><small>свои карты, обмен кодом</small>';
  const help = main.querySelector('[data-sm="help"]');
  main.insertBefore(b, help);
  const p = document.createElement('div');
  p.className = 'sm-panel hidden'; p.dataset.panel = 'maps';
  p.innerHTML = `<div class="sm-title">Свои карты</div><div class="me-list" id="me-list"></div>
    <div class="sm-grid"><button class="sm-btn" data-me="new"><b>Новая</b></button><button class="sm-btn" data-me="file"><b>Файл…</b></button><button class="sm-btn" data-me="code"><b>Код…</b></button></div>
    <div class="sm-msg" id="me-list-msg"></div>
    <button class="sm-btn ghost" data-sm="back"><b>Назад</b></button>
    <input type="file" id="me-file" accept=".json,application/json" hidden>`;
  root.appendChild(p);
  root.addEventListener('click', e => { const t = e.target.closest('[data-me]'); if (t && !t.disabled) meAct(t.dataset.me); });
  meEl('me-file').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > ME_MAX_BYTES) { meListMsg('Файл слишком большой (больше 400 КБ)'); return; }
    meImport(await f.text());
  });
}
{
  const _ism = initStartMenu;
  initStartMenu = function () { _ism(); meInjectMenu(); };
}

function meListMsg(t) { const m = meEl('me-list-msg'); if (m) m.textContent = t || ''; }

function meRenderList() {
  const box = meEl('me-list');
  if (!box) return;
  const list = meList();
  if (!list.length) { box.innerHTML = '<div class="me-empty">Пока нет своих карт.<br>Нажмите «Новая», чтобы нарисовать, или «Файл…»/«Код…», чтобы принять чужую.</div>'; return; }
  box.innerHTML = list.map(({ id, map }) => {
    const v = meValidate(map);
    const st = v.errors.length ? `<small class="bad">⚠ ${meEsc(v.errors[0])}</small>` : `<small class="ok">✔ играбельна${v.warnings.length ? ' · замечаний: ' + v.warnings.length : ''}</small>`;
    return `<div class="me-item"><b>${meEsc(map.name)}</b><small>${map.w}×${map.h} · ${BIOMES[map.biome].name}${map.rules.length ? ' · целей: ' + map.rules.length : ''}</small>${st}
      <div class="me-row"><button class="me-btn primary" data-me="play:${id}"${v.errors.length ? ' disabled' : ''}>▶ Играть</button><button class="me-btn" data-me="edit:${id}">✎</button><button class="me-btn" data-me="copy:${id}" title="Копия">⧉</button><button class="me-btn" data-me="share:${id}" title="Обмен">⇪</button><button class="me-btn ghost" data-me="del:${id}" title="Удалить">🗑</button></div></div>`;
  }).join('');
}

function meGet(id) { const e = meList().find(x => x.id === id); return e ? e.map : null; }

function meAct(a) {
  const [k, id] = a.split(':');
  if (k === 'open') { smShow('maps'); meListMsg(''); meRenderList(); return; }
  if (k === 'new') { meDlgNew(); return; }
  if (k === 'file') { meEl('me-file').click(); return; }
  if (k === 'code') { meDlgCode(); return; }
  if (k === 'edit') { const m = meGet(id); if (m) meOpenEditor(m, id); return; }
  if (k === 'play') { const m = meGet(id); if (m) mePlay(m); return; }
  if (k === 'copy') { const m = meGet(id); if (m) { m.name = (m.name + ' (копия)').slice(0, 40); const r = meSave(m); meListMsg(r.err || 'Копия сохранена'); meRenderList(); } return; }
  if (k === 'share') { const m = meGet(id); if (m) meDlgShare(m); return; }
  if (k === 'del') { const m = meGet(id); if (m && confirm('Удалить карту «' + m.name + '»?')) { meDelete(id); meRenderList(); } return; }
}

// Принять карту из файла или кода и положить в список
function meImport(text) {
  Promise.resolve(meFromCode(text)).then(r => {
    if (r.err) { meListMsg(r.err); return; }
    const s = meSave(r.map);
    meListMsg(s.err || 'Карта «' + r.map.name + '» добавлена');
    meRenderList();
    meDlgClose();
  });
}

// Запуск карты как игры: строим мир под меню и переходим к выбору сложности (как «Новая игра»)
function mePlay(map) {
  const v = meValidate(map);
  if (v.errors.length) { meDlgValidate(map, v); return; }
  if (StartMenu.busy) return;
  if (MEUI.E) meCloseEditor(true);
  smShow('maps');
  meListMsg('Создаём карту…');
  StartMenu.busy = true;
  setTimeout(() => {
    try {
      const seed = map.seed || mapSeedFrom(map.name);
      StartMenu.goalMode = 'free';
      setupStart(seed, { custom: meClone(map) });
      buildTerrain(seed);
      updateMinimapBase();
      StartMenu.dirty = true;
      track('map-custom', 'Запустил свою карту');
      meListMsg('');
      smShow('diff');
    } catch (e) { console.error(e); meListMsg('Не вышло создать мир из этой карты'); }
    StartMenu.busy = false;
  }, 30);
}

// ---------- Диалоги ----------

function meDlg(html, onClick, onChange) {
  let d = meEl('me-dlg');
  if (!d) {
    d = document.createElement('div'); d.id = 'me-dlg'; d.className = 'me-dlg me-hidden';
    d.addEventListener('pointerdown', e => { if (e.target === d) meDlgClose(); });
    document.body.appendChild(d);
  }
  d.innerHTML = `<div class="me-card">${html}</div>`;
  d.onclick = e => { const t = e.target.closest('[data-d]'); if (t && !t.disabled && onClick) onClick(t.dataset.d, t); };
  d.onchange = e => { if (onChange) onChange(e.target); };
  d.classList.remove('me-hidden');
  return d;
}
function meDlgClose() { const d = meEl('me-dlg'); if (d) d.classList.add('me-hidden'); }

function meDlgNew() {
  const st = { biome: 'meadow', size: 'medium', base: 'empty' };
  const draw = () => {
    const d = meEl('me-dlg');
    d.querySelectorAll('[data-d^="b:"]').forEach(b => b.classList.toggle('sel', b.dataset.d === 'b:' + st.biome));
    d.querySelectorAll('[data-d^="s:"]').forEach(b => b.classList.toggle('sel', b.dataset.d === 's:' + st.size));
    d.querySelectorAll('[data-d^="base:"]').forEach(b => b.classList.toggle('sel', b.dataset.d === 'base:' + st.base));
    const gen = d.querySelector('[data-d="base:gen"]');
    gen.disabled = st.size === 'tiny';
    if (st.size === 'tiny' && st.base === 'gen') st.base = 'empty';
  };
  meDlg(`<h3>Новая карта</h3>
    <div class="me-info">Биом задаёт вид земли, деревьев и скал.</div>
    <div class="me-chips">${BIOME_ORDER.map(k => `<button class="me-btn" data-d="b:${k}">${BIOMES[k].icon} ${BIOMES[k].name}</button>`).join('')}</div>
    <div class="me-info">Размер</div>
    <div class="me-chips">${Object.keys(ME_SIZES).map(k => `<button class="me-btn" data-d="s:${k}">${ME_SIZES[k].name}<br><small>${ME_SIZES[k].w}×${ME_SIZES[k].h}</small></button>`).join('')}</div>
    <div class="me-info">С чего начать</div>
    <div class="me-chips"><button class="me-btn" data-d="base:empty">Пустая трава</button><button class="me-btn" data-d="base:gen">Заготовка игры<br><small>реки, леса, горы</small></button></div>
    <div class="me-btns"><button class="me-btn primary" data-d="go">Создать</button><button class="me-btn ghost" data-d="x">Отмена</button></div>`,
  (a) => {
    if (a === 'x') meDlgClose();
    else if (a.startsWith('b:')) { st.biome = a.slice(2); draw(); }
    else if (a.startsWith('s:')) { st.size = a.slice(2); draw(); }
    else if (a.startsWith('base:')) { st.base = a.slice(5); draw(); }
    else if (a === 'go') {
      meDlgClose();
      const sz = ME_SIZES[st.size], m = meNew(sz.w, sz.h, st.biome, 'Моя карта');
      if (st.base === 'gen') meFromTemplate(m, st.size, () => meOpenEditor(m, null)); else meOpenEditor(m, null);
    }
  });
  draw();
}

// Основа из обычной генерации: строим мир тем же путём, что «Новая игра», и снимаем с него рельеф и деревья
function meFromTemplate(m, sizeKey, done) {
  if (StartMenu.busy) return;
  StartMenu.busy = true;
  meListMsg('Создаём заготовку…');
  setTimeout(() => {
    try {
      setupStart(m.seed, { biome: m.biome, size: sizeKey });
      buildTerrain(m.seed); updateMinimapBase();
      StartMenu.dirty = true;
      for (let i = 0; i < m.w * m.h; i++) {
        const t = World.terrain[i], o = World.obj[i];
        m.t[i] = t; m.c[i] = t === T_ROCK && World.crystal[i] ? 1 : 0;
        m.o[i] = o && o.t === 'tree' ? (o.g >= 1 ? 1 : 2) : o && o.t === 'stone' ? 3 : 0;
      }
      m.start = [MAP_W >> 1, MAP_H >> 1];
      meListMsg('');
    } catch (e) { console.error(e); meListMsg('Заготовка не вышла — начните с пустой'); }
    StartMenu.busy = false;
    done();
  }, 30);
}

function meDlgCode() {
  meDlg(`<h3>Карта по коду</h3><label>Вставьте код (OGM…) или содержимое файла карты<textarea id="me-code" spellcheck="false" placeholder="OGM2.…"></textarea></label>
    <div class="me-btns"><button class="me-btn primary" data-d="ok">Принять</button><button class="me-btn ghost" data-d="x">Отмена</button></div>`,
  a => { if (a === 'x') meDlgClose(); else if (a === 'ok') meImport(meEl('me-code').value); });
}

function meDlgShare(map) {
  const fname = (map.name.replace(/[^\wа-яёА-ЯЁ-]+/g, '_') || 'karta') + '.oldgold-map.json';
  const d = meDlg(`<h3>Обмен картой</h3><div class="me-info">Отправьте файл или код другу в чате. Друг нажмёт «Редактор карт» → «Файл…» или «Код…». Сервера нет — карта живёт у вас.</div>
    <label>Код карты<textarea id="me-sharecode" readonly>Готовим код…</textarea></label>
    <div class="me-btns"><button class="me-btn primary" data-d="copy">Копировать код</button><button class="me-btn" data-d="file">Скачать файл</button><button class="me-btn ghost" data-d="x">Закрыть</button></div><div class="sm-msg me-info" id="me-sharemsg"></div>`,
  a => {
    const say = t => { const m = meEl('me-sharemsg'); if (m) m.textContent = t; };
    if (a === 'x') meDlgClose();
    else if (a === 'copy') {
      const ta = meEl('me-sharecode'); ta.select();
      (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(ta.value) : Promise.reject()).then(() => say('Код скопирован'), () => { try { document.execCommand('copy'); say('Код скопирован'); } catch (e) { say('Выделите код и скопируйте вручную'); } });
    } else if (a === 'file') {
      const blob = new Blob([JSON.stringify(meEncode(map))], { type: 'application/json' }), url = URL.createObjectURL(blob), l = document.createElement('a');
      l.href = url; l.download = fname; document.body.appendChild(l); l.click(); l.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      say('Файл ' + fname + ' скачан');
    }
  });
  meToCode(map).then(c => { const ta = meEl('me-sharecode'); if (ta) ta.value = c; }, () => { const ta = meEl('me-sharecode'); if (ta) ta.value = 'Не вышло подготовить код — используйте файл'; });
  return d;
}

function meDlgValidate(map, v) {
  v = v || meValidate(map);
  const i = v.info || {};
  const stats = i.trees === undefined ? '' : `<div class="me-info">Деревьев: ${i.trees} (достижимо ${i.reachTrees}) · камни и скалы у границы: ${i.reachStone} · вода у берега: ${i.reachWater} · руда: ${i.ore} · свободной земли у старта: ${i.reach}</div>`;
  meDlg(`<h3>Проверка карты</h3>${v.errors.length ? '<ul>' + v.errors.map(e => `<li class="bad">${meEsc(e)}</li>`).join('') + '</ul>' : ''}
    ${v.warnings.length ? '<ul>' + v.warnings.map(e => `<li class="warn">${meEsc(e)}</li>`).join('') + '</ul>' : ''}
    ${!v.errors.length && !v.warnings.length ? '<ul><li class="ok">✔ Всё в порядке: есть вода, дерево, камень и место под старт.</li></ul>' : v.errors.length ? '' : '<ul><li class="ok">✔ Играть можно — замечания не мешают запуску.</li></ul>'}
    ${stats}<div class="me-btns"><button class="me-btn" data-d="x">Понятно</button></div>`, a => { if (a === 'x') meDlgClose(); });
}

// Цели карты: правила и режим логов
function meDlgGoal(map) {
  const bOpts = sel => Object.keys(BUILDINGS).filter(k => BUILDINGS[k].name).sort((a, b) => BUILDINGS[a].name.localeCompare(BUILDINGS[b].name, 'ru')).map(k => `<option value="${k}"${k === sel ? ' selected' : ''}>${meEsc(BUILDINGS[k].name)}</option>`).join('');
  const gOpts = sel => GOOD_KEYS.filter(k => GOODS[k] && GOODS[k].name).map(k => `<option value="${k}"${k === sel ? ' selected' : ''}>${meEsc(GOODS[k].name)}</option>`).join('');
  const rule = (r, i) => {
    let w = '';
    if (r.k === 'build') w = `<select data-r="t" data-i="${i}">${bOpts(r.t)}</select>`;
    else if (r.k === 'prod') w = `<select data-r="g" data-i="${i}">${gOpts(r.g)}</select><input type="number" data-r="n" data-i="${i}" min="1" max="9999" value="${r.n}">`;
    else if (r.k === 'rank') w = `<select data-r="n" data-i="${i}"><option value="1"${r.n === 1 ? ' selected' : ''}>Деревня</option><option value="2"${r.n === 2 ? ' selected' : ''}>Город</option></select>`;
    else w = `<input type="number" data-r="n" data-i="${i}" min="1" max="${r.k === 'lairs' ? ME_MAX_LAIRS : r.k === 'nights' ? 100 : 300}" value="${r.n}">`;
    return `<div class="me-rule"><select data-r="k" data-i="${i}">${Object.keys(ME_RULE_KINDS).map(k => `<option value="${k}"${k === r.k ? ' selected' : ''}>${ME_RULE_KINDS[k]}</option>`).join('')}</select>${w}<button class="me-btn ghost" data-d="rd:${i}">✕</button></div>`;
  };
  const draw = () => {
    meDlg(`<h3>Цели карты</h3>
      <div class="me-info">Победа — когда выполнены все правила. Без правил карта — свободная игра. Поражение — если погибли все гномы.</div>
      <label>Название цели<input type="text" id="me-gtitle" maxlength="40" value="${meEsc(map.title)}" placeholder="например, «Город у реки»"></label>
      ${map.rules.map(rule).join('') || '<div class="me-empty">Правил нет</div>'}
      <div class="me-btns"><button class="me-btn" data-d="radd"${map.rules.length >= ME_MAX_RULES ? ' disabled' : ''}>＋ Правило</button></div>
      <div class="me-info">Нейтралы (логова фей, лешего, кабанов, грибов)</div>
      <div class="me-chips"><button class="me-btn${map.nm === 'manual' ? ' sel' : ''}" data-d="nm:manual">Как расставил я</button><button class="me-btn${map.nm === 'auto' ? ' sel' : ''}" data-d="nm:auto">Случайные логова</button></div>
      <div class="me-btns"><button class="me-btn primary" data-d="x">Готово</button></div>`,
    a => {
      if (a === 'x') { map.title = meTxt(meEl('me-gtitle').value, 40); meDlgClose(); MEUI.E.dirty = true; }
      else if (a === 'radd') { map.title = meTxt(meEl('me-gtitle').value, 40); map.rules.push({ k: 'pop', n: 10 }); draw(); MEUI.E.dirty = true; }
      else if (a.startsWith('rd:')) { map.title = meTxt(meEl('me-gtitle').value, 40); map.rules.splice(+a.slice(3), 1); draw(); MEUI.E.dirty = true; }
      else if (a.startsWith('nm:')) { map.title = meTxt(meEl('me-gtitle').value, 40); map.nm = a.slice(3); draw(); MEUI.E.dirty = true; }
    },
    el => {
      const i = +el.dataset.i, f = el.dataset.r;
      if (f === undefined) return;
      const r = map.rules[i];
      if (!r) return;
      if (f === 'k') {
        const def = { build: { k: 'build', t: 'bakery' }, pop: { k: 'pop', n: 20 }, nights: { k: 'nights', n: 5 }, prod: { k: 'prod', g: 'bread', n: 50 }, rank: { k: 'rank', n: 1 }, lairs: { k: 'lairs', n: 1 } }[el.value];
        if (def) map.rules[i] = def;
        map.title = meTxt(meEl('me-gtitle').value, 40);
        draw();
      } else {
        const c = meRule(Object.assign({}, r, { [f]: f === 'n' ? +el.value : el.value }));
        if (c) map.rules[i] = c;
      }
      MEUI.E.dirty = true;
    });
  };
  draw();
}

// ---------- Редактор ----------

function meBuildEditor() {
  if (meEl('me-ed')) return;
  const ed = document.createElement('div');
  ed.id = 'me-ed'; ed.className = 'me-hidden';
  ed.innerHTML = `<div class="me-top">
      <input id="me-name" maxlength="40" placeholder="Название карты" autocomplete="off">
      <select id="me-biome" title="Биом">${BIOME_ORDER.map(k => `<option value="${k}">${BIOMES[k].icon} ${BIOMES[k].name}</option>`).join('')}</select>
      <button class="me-btn" data-e="check">✓ Проверка</button><button class="me-btn" data-e="goal">🎯 Цели</button><button class="me-btn" data-e="share">⇪ Обмен</button>
      <button class="me-btn primary" data-e="play">▶ Играть</button><button class="me-btn ghost" data-e="close">✕ Закрыть</button>
    </div>
    <div class="me-body"><div class="me-tools" id="me-tools"></div>
      <div class="me-view" id="me-view"><canvas id="me-cv"></canvas><div class="me-hud" id="me-hud"></div><div class="me-flash" id="me-flash"></div></div></div>`;
  document.body.appendChild(ed);
  const tools = meEl('me-tools');
  let h = '';
  for (const t of ME_TOOLS) h += t.g ? `<h4>${t.g}</h4>` : `<button class="me-btn" data-t="${t.id}">${t.ico} ${t.name}</button>`;
  h += '<h4>Кисть</h4><div class="me-row">' + ME_BRUSHES.map(n => `<button class="me-btn" data-b="${n}">${n}</button>`).join('') + '</div>';
  h += '<div id="me-lairpick" class="me-row"></div>';
  h += '<h4>Правка</h4><div class="me-row"><button class="me-btn" data-e="undo">↶ Отмена</button><button class="me-btn" data-e="fill">▦ Залить</button><button class="me-btn" data-e="fit">⤢ Вся</button></div>';
  tools.innerHTML = h;
  const lp = meEl('me-lairpick');
  lp.innerHTML = Object.keys(ME_LAIRS).map(k => `<button class="me-btn" data-l="${k}" title="${ME_LAIRS[k].name}">${ME_LAIRS[k].ico}</button>`).join('');
  ed.addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t || !MEUI.E) return;
    const E = MEUI.E;
    if (t.dataset.t) { E.tool = t.dataset.t; meSync(); }
    else if (t.dataset.b) { E.size = +t.dataset.b; meSync(); }
    else if (t.dataset.l) { E.lairKind = t.dataset.l; E.tool = 'lair'; meSync(); }
    else if (t.dataset.e) meEdAct(t.dataset.e);
  });
  meEl('me-name').addEventListener('input', e => { if (MEUI.E) { MEUI.E.map.name = meTxt(e.target.value, 40) || 'Без названия'; MEUI.E.dirty = true; } });
  meEl('me-biome').addEventListener('change', e => { if (MEUI.E) { MEUI.E.map.biome = e.target.value; MEUI.E.dirty = true; MEUI.E.rebake = true; } });
  meBindCanvas(meEl('me-cv'));
  window.addEventListener('resize', () => { if (MEUI.E) meResizeCv(); });
  window.addEventListener('keydown', e => {
    if (!MEUI.E) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { meUndo(); e.preventDefault(); }
    if (e.code === 'Space') { MEUI.E.space = true; e.preventDefault(); }
    if (e.key === 'Escape') { const d = meEl('me-dlg'); if (d && !d.classList.contains('me-hidden')) meDlgClose(); }
  }, true);
  window.addEventListener('keyup', e => { if (MEUI.E && e.code === 'Space') MEUI.E.space = false; });
}

function meOpenEditor(map, id) {
  meBuildEditor();
  const E = MEUI.E = {
    map: meClone(map), id, tool: 'grass', size: 3, lairKind: 'fairy', z: 6, ox: 0, oy: 0, undo: [], dirty: false, rebake: true, draw: true,
    off: document.createElement('canvas'), ptr: new Map(), gest: null, stroke: null, hover: null, space: false, saved: 0,
  };
  E.off.width = map.w; E.off.height = map.h;
  meEl('me-ed').classList.remove('me-hidden');
  meEl('me-name').value = map.name;
  meEl('me-biome').value = map.biome;
  meResizeCv();
  meFit();
  meSync();
  meFlash('Рисуйте ЛКМ/пальцем · ПКМ или два пальца — двигать · колесо — масштаб');
  const loop = () => {
    if (MEUI.E !== E) return;
    if (E.dirty && Date.now() - E.saved > 20000) meSaveDraft();   // черновик не теряется
    if (E.draw) { E.draw = false; meDraw(); }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function meSaveDraft() {
  const E = MEUI.E;
  if (!E) return null;
  const r = meSave(E.map, E.id);
  if (r.id) { E.id = r.id; E.dirty = false; E.saved = Date.now(); }
  return r;
}

function meCloseEditor(skipSave) {
  const E = MEUI.E;
  if (!E) return;
  let err = null;
  if (!skipSave) { const r = E.dirty || !E.id ? meSaveDraft() : null; if (r && r.err) err = r.err; }
  else if (E.dirty || !E.id) meSaveDraft();
  MEUI.E = null;
  meEl('me-ed').classList.add('me-hidden');
  meDlgClose();
  if (typeof StartMenu !== 'undefined' && StartMenu.open) { smShow('maps'); meRenderList(); meListMsg(err || ''); }
}

function meEdAct(a) {
  const E = MEUI.E;
  if (a === 'close') { const r = E.dirty || !E.id ? meSave(E.map, E.id) : { id: E.id }; if (r.err && !confirm(r.err + '\nЗакрыть без сохранения?')) return; if (r.id) { E.id = r.id; E.dirty = false; } meCloseEditor(true); }
  else if (a === 'undo') meUndo();
  else if (a === 'fit') meFit();
  else if (a === 'fill') {
    const v = { grass: 0, water: 1, rock: 2, sand: 3 }[E.tool];
    if (v === undefined) { meFlash('Выберите кистью рельеф: трава, вода, горы или песок'); return; }
    if (!confirm('Залить всю карту выбранным рельефом? Деревья и камни пропадут. Это можно отменить.')) return;
    mePush(); E.map.t.fill(v); E.map.o.fill(0); E.map.c.fill(0); E.rebake = true; E.dirty = true; E.draw = true;
  } else if (a === 'check') meDlgValidate(E.map);
  else if (a === 'goal') meDlgGoal(E.map);
  else if (a === 'share') { meDlgShare(E.map); }
  else if (a === 'play') {
    const r = meSaveDraft();
    if (r && r.err) { meFlash(r.err); }
    mePlay(E.map);
  }
}

function meSync() {
  const E = MEUI.E;
  for (const b of document.querySelectorAll('#me-tools [data-t]')) b.classList.toggle('sel', b.dataset.t === E.tool);
  for (const b of document.querySelectorAll('#me-tools [data-b]')) b.classList.toggle('sel', +b.dataset.b === E.size);
  for (const b of document.querySelectorAll('#me-tools [data-l]')) b.classList.toggle('sel', b.dataset.l === E.lairKind && E.tool === 'lair');
  meEl('me-lairpick').style.display = E.tool === 'lair' ? '' : 'none';
  const lt = document.querySelector('#me-tools [data-t="lair"]');
  if (lt) lt.textContent = ME_LAIRS[E.lairKind].ico + ' Логово';
  E.draw = true;
}

let meFlashT = 0;
function meFlash(t) {
  const f = meEl('me-flash');
  if (!f) return;
  f.textContent = t; f.classList.add('on');
  clearTimeout(meFlashT);
  meFlashT = setTimeout(() => f.classList.remove('on'), 3500);
}

// ---------- Холст ----------

function meResizeCv() {
  const cv = meEl('me-cv'), v = meEl('me-view'), dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.max(1, Math.round(v.clientWidth * dpr)); cv.height = Math.max(1, Math.round(v.clientHeight * dpr));
  MEUI.E.dpr = dpr; MEUI.E.draw = true;
}
function meFit() {
  const E = MEUI.E, v = meEl('me-view');
  E.z = Math.max(2, Math.min(32, Math.floor(Math.min(v.clientWidth / E.map.w, v.clientHeight / E.map.h) * 10) / 10));
  E.ox = (v.clientWidth - E.map.w * E.z) / 2; E.oy = (v.clientHeight - E.map.h * E.z) / 2;
  E.draw = true;
}

function meRebake() {
  const E = MEUI.E, m = E.map;
  E.bk = meBake(m);
  const pal = BIOME_PAL[m.biome] || BIOME_PAL.meadow, c = E.off.getContext('2d'), im = c.createImageData(m.w, m.h), d = im.data;
  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  for (let i = 0; i < m.w * m.h; i++) {
    const n = (meSeedHash(i % m.w, (i / m.w) | 0) % 1000) / 1000, t = E.bk.ter[i], o = E.bk.ob[i];
    let col;
    if (o === 1) col = MEC.tree; else if (o === 2) col = MEC.young; else if (o === 3) col = MEC.stone;
    else if (t === 1) col = mix(pal.w0, pal.w1, n * 0.5);
    else if (t === 2) col = E.bk.cry[i] ? MEC.ore : mix(MEC.rock, [140, 134, 124], n);
    else if (t === 3) col = pal.sand;
    else col = mix(pal.g0, pal.g1, 0.25 + n * 0.5);
    d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = 255;
  }
  c.putImageData(im, 0, 0);
  E.rebake = false;
}

function meDraw() {
  const E = MEUI.E, m = E.map, cv = meEl('me-cv'), c = cv.getContext('2d'), k = E.dpr, z = E.z;
  if (E.rebake) meRebake();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#14100a'; c.fillRect(0, 0, cv.width, cv.height);
  c.setTransform(k, 0, 0, k, 0, 0);
  c.imageSmoothingEnabled = false;
  c.drawImage(E.off, E.ox, E.oy, m.w * z, m.h * z);
  c.strokeStyle = '#b8902c'; c.lineWidth = 2; c.strokeRect(E.ox, E.oy, m.w * z, m.h * z);
  const x0 = Math.max(0, Math.floor(-E.ox / z)), y0 = Math.max(0, Math.floor(-E.oy / z));
  const x1 = Math.min(m.w - 1, Math.ceil((cv.width / k - E.ox) / z)), y1 = Math.min(m.h - 1, Math.ceil((cv.height / k - E.oy) / z));
  if (z >= 7) {
    c.font = Math.round(z * 0.9) + 'px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * m.w + x, o = E.bk.ob[i], px = E.ox + (x + 0.5) * z, py = E.oy + (y + 0.5) * z;
      if (o === 1 || o === 2) { c.fillStyle = o === 1 ? '#1c4a1e' : '#4c8a36'; c.beginPath(); c.arc(px, py - z * 0.05, z * (o === 1 ? 0.42 : 0.28), 0, 6.3); c.fill(); }
      else if (o === 3) { c.fillStyle = '#c8c4b4'; c.fillRect(px - z * 0.3, py - z * 0.2, z * 0.6, z * 0.4); }
      else if (E.bk.cry[i]) { c.fillStyle = '#f0b8ff'; c.beginPath(); c.moveTo(px, py - z * 0.32); c.lineTo(px + z * 0.24, py); c.lineTo(px, py + z * 0.32); c.lineTo(px - z * 0.24, py); c.fill(); }
    }
  }
  if (z >= 14) {
    c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 1; c.beginPath();
    for (let x = x0; x <= x1 + 1; x++) { c.moveTo(E.ox + x * z, E.oy + y0 * z); c.lineTo(E.ox + x * z, E.oy + (y1 + 1) * z); }
    for (let y = y0; y <= y1 + 1; y++) { c.moveTo(E.ox + x0 * z, E.oy + y * z); c.lineTo(E.ox + (x1 + 1) * z, E.oy + y * z); }
    c.stroke();
  }
  // поляна и старт
  if (m.start) {
    const px = E.ox + (m.start[0] + 0.5) * z, py = E.oy + (m.start[1] + 0.5) * z;
    c.setLineDash([6, 5]); c.strokeStyle = 'rgba(255,220,120,0.9)'; c.lineWidth = 2; c.beginPath(); c.arc(px, py, ME_START_R * z, 0, 6.3); c.stroke(); c.setLineDash([]);
    c.font = Math.max(14, z * 1.6) + 'px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🚩', px, py);
  }
  for (const [kind, x, y] of m.lairs) {
    const L = ME_LAIRS[kind], px = E.ox + (x + 0.5) * z, py = E.oy + (y + 0.5) * z, r = Math.max(5, z * 0.8);
    c.fillStyle = L.col; c.strokeStyle = '#1a1008'; c.lineWidth = 2; c.beginPath(); c.arc(px, py, r, 0, 6.3); c.fill(); c.stroke();
    c.font = Math.round(r * 1.3) + 'px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(L.ico, px, py + 1);
  }
  // кисть под курсором
  if (E.hover && E.tool !== 'hand' && E.ptr.size < 2) {
    const [hx, hy] = E.hover, r = meBrushR(E);
    c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 1.5;
    if (E.tool === 'start' || E.tool === 'lair') c.strokeRect(E.ox + hx * z, E.oy + hy * z, z, z);
    else { c.beginPath(); c.arc(E.ox + (hx + 0.5) * z, E.oy + (hy + 0.5) * z, (r + 0.5) * z, 0, 6.3); c.stroke(); }
  }
}

// ---------- Кисть ----------

function meBrushR(E) { return E.tool === 'start' || E.tool === 'lair' ? 0 : (E.size - 1) / 2 + 0.2; }

function mePush() {
  const E = MEUI.E, m = E.map;
  E.undo.push({ t: m.t.slice(), c: m.c.slice(), o: m.o.slice(), start: m.start && m.start.slice(), lairs: m.lairs.map(l => l.slice()) });
  if (E.undo.length > 30) E.undo.shift();
}
function meUndo() {
  const E = MEUI.E, s = E.undo.pop();
  if (!s) { meFlash('Отменять нечего'); return; }
  Object.assign(E.map, { t: s.t, c: s.c, o: s.o, start: s.start, lairs: s.lairs });
  E.rebake = true; E.dirty = true; E.draw = true;
}

function meApply(tx, ty, first) {
  const E = MEUI.E, m = E.map, { w, h } = m;
  if (tx < 0 || ty < 0 || tx >= w || ty >= h) return;
  if (E.tool === 'start') { m.start = [tx, ty]; }
  else if (E.tool === 'lair') {
    if (!first) return;
    const k = m.lairs.findIndex(l => Math.abs(l[1] - tx) <= 1 && Math.abs(l[2] - ty) <= 1);
    if (k >= 0) m.lairs.splice(k, 1);
    else if (m.lairs.length >= ME_MAX_LAIRS) { meFlash(`Не больше ${ME_MAX_LAIRS} логов`); return; }
    else m.lairs.push([E.lairKind, tx, ty]);
  } else {
    const r = meBrushR(E), rr = Math.ceil(r);
    const tv = { grass: 0, water: 1, rock: 2, sand: 3 }[E.tool];
    for (let y = ty - rr; y <= ty + rr; y++) for (let x = tx - rr; x <= tx + rr; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h || (x - tx) ** 2 + (y - ty) ** 2 > r * r + 0.25) continue;
      const i = y * w + x;
      if (tv !== undefined) { m.t[i] = tv; if (tv !== 0) m.o[i] = 0; if (tv !== 2) m.c[i] = 0; }
      else if (E.tool === 'forest') { if (m.t[i] === 0 && Math.random() < 0.55) m.o[i] = Math.random() < 0.12 ? 2 : 1; }
      else if (E.tool === 'tree') { if (m.t[i] === 0) m.o[i] = 1; }
      else if (E.tool === 'stone') { if (m.t[i] === 0 && (E.size < 3 || Math.random() < 0.5)) m.o[i] = 3; }
      else if (E.tool === 'ore') { if (m.t[i] === 2) m.c[i] = 1; }
      else if (E.tool === 'erase') { m.o[i] = 0; m.c[i] = 0; }
    }
  }
  E.rebake = true; E.dirty = true; E.draw = true;
}

function meLine(a, b, first) {
  let [x0, y0] = a; const [x1, y1] = b;
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  for (let n = 0; n < 600; n++) {
    meApply(x0, y0, first && n === 0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}

function meTile(e) {
  const E = MEUI.E, r = e.currentTarget.getBoundingClientRect();
  return [Math.floor((e.clientX - r.left - E.ox) / E.z), Math.floor((e.clientY - r.top - E.oy) / E.z)];
}

function meBindCanvas(cv) {
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    const E = MEUI.E;
    if (!E) return;
    cv.setPointerCapture(e.pointerId);
    E.ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (E.ptr.size >= 2) {   // два пальца — двигать и масштабировать
      E.stroke = null;
      const [a, b] = [...E.ptr.values()];
      E.gest = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, z: E.z, ox: E.ox, oy: E.oy };
      return;
    }
    if (e.button === 1 || e.button === 2 || E.tool === 'hand' || E.space) { E.pan = { x: e.clientX, y: e.clientY, ox: E.ox, oy: E.oy }; return; }
    mePush();
    const t = meTile(e);
    E.stroke = { last: t };
    meLine(t, t, true);
  });
  cv.addEventListener('pointermove', e => {
    const E = MEUI.E;
    if (!E) return;
    const p = E.ptr.get(e.pointerId);
    E.hover = e.pointerType === 'mouse' || E.stroke ? meTile(e) : null;
    const t = meTile(e), hud = meEl('me-hud');
    hud.textContent = t[0] >= 0 && t[1] >= 0 && t[0] < E.map.w && t[1] < E.map.h ? `${t[0]}, ${t[1]} · ${E.map.w}×${E.map.h} · лес ${E.bk ? E.bk.ob.filter(v => v === 1 || v === 2).length : 0}` : `${E.map.w}×${E.map.h}`;
    if (p) { p.x = e.clientX; p.y = e.clientY; }
    if (E.gest && E.ptr.size >= 2) {
      const [a, b] = [...E.ptr.values()], d = Math.hypot(a.x - b.x, a.y - b.y) || 1, g = E.gest, r = cv.getBoundingClientRect();
      const nz = Math.max(2, Math.min(32, g.z * d / g.d)), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      // точка карты под центром щипка остаётся под ним
      const wx = (g.cx - r.left - g.ox) / g.z, wy = (g.cy - r.top - g.oy) / g.z;
      E.z = nz; E.ox = cx - r.left - wx * nz; E.oy = cy - r.top - wy * nz;
    } else if (E.pan) { E.ox = E.pan.ox + e.clientX - E.pan.x; E.oy = E.pan.oy + e.clientY - E.pan.y; }
    else if (E.stroke) { const n = meTile(e); meLine(E.stroke.last, n, false); E.stroke.last = n; }
    E.draw = true;
  });
  const up = e => {
    const E = MEUI.E;
    if (!E) return;
    E.ptr.delete(e.pointerId);
    if (E.ptr.size < 2) E.gest = null;
    if (!E.ptr.size) { E.pan = null; E.stroke = null; if (e.pointerType !== 'mouse') E.hover = null; }
    E.draw = true;
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', () => { const E = MEUI.E; if (E && !E.stroke) { E.hover = null; E.draw = true; } });
  cv.addEventListener('wheel', e => {
    const E = MEUI.E;
    if (!E) return;
    e.preventDefault();
    const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const wx = (mx - E.ox) / E.z, wy = (my - E.oy) / E.z;
    E.z = Math.max(2, Math.min(32, E.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    E.ox = mx - wx * E.z; E.oy = my - wy * E.z;
    E.draw = true;
  }, { passive: false });
}
