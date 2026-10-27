'use strict';
// Оборона: меню строительства, ввод мышью, карточка выбранной постройки, окна башни и большого костра.

// ================= Меню =================

function defMenuButtons() {
  const list = document.getElementById('build-list');
  if (!list) return;
  const first = list.firstChild;
  for (const f of FORT_ORDER) {
    if (!isUnlocked('fort:' + f)) continue;
    const F = FORTS[f], btn = document.createElement('button');
    btn.className = 'bbtn';
    btn.dataset.type = 'fort:' + f;
    btn.title = F.desc[0];
    btn.innerHTML = `<img class="bimg" src="${defIconURL(f)}" alt=""><span class="bname">${F.name}</span>${costHTML(F.cost[0])}`;
    btn.onclick = () => typeof wpPick === 'function' ? wpPick('fort:' + f) : setTool(Game.tool && Game.tool.kind === 'fort' && Game.tool.f === f ? null : { kind: 'fort', f, type: 'fort:' + f });
    if (Game.tool && Game.tool.kind === 'fort' && Game.tool.f === f) btn.classList.add('active');
    list.insertBefore(btn, first);
  }
  // в порядке FORT_ORDER: вставка перед первым ставила в обратном порядке
  const btns = [...list.querySelectorAll('.bbtn[data-type^="fort:"]')];
  btns.sort((a, b) => FORT_ORDER.indexOf(a.dataset.type.slice(5)) - FORT_ORDER.indexOf(b.dataset.type.slice(5)));
  for (const b of btns) list.insertBefore(b, first);
}

// раздел «Оборона» по группам: стены, ловушки, свет и башни (заголовок на всю ширину сетки)
const DEF_GROUPS = [['Стены', ['wall_wood', 'wall_stone', 'gate', 'barricade']], ['Ловушки', ['pit', 'spike', 'fire']], ['Свет и башни', null]];
function defMenuGroups() {
  const list = document.getElementById('build-list');
  if (!list) return;
  const btns = [...list.querySelectorAll('.bbtn')], used = new Set();
  const out = [];
  for (const [name, fs] of DEF_GROUPS) {
    const g = btns.filter(b => !used.has(b) && (fs ? fs.some(f => b.dataset.type === 'fort:' + f) : true));
    if (!g.length) continue;
    g.forEach(b => used.add(b));
    const h = document.createElement('div');
    h.className = 'bgroup'; h.textContent = name;
    out.push(h, ...g);
  }
  for (const el of out) list.appendChild(el);
}

{
  const _rbl = renderBuildList;
  renderBuildList = function () {
    _rbl();
    if (BUILD_CATS[UI.cat] === 'Оборона') { defMenuButtons(); defMenuGroups(); }
  };

  const _st = setTool;
  setTool = function (tool) {
    _st(tool);
    R.fortDrag = null; Input.fortStart = null;
    if (!tool || tool.kind !== 'fort') return;
    document.querySelector(`.bbtn[data-type="fort:${tool.f}"]`)?.classList.add('active');
    DEF.sel = -1; defCardUpdate();
    const F = FORTS[tool.f];
    const txt = tool.f === 'gate'
      ? 'Ставьте ворота в линию стены или на дорогу: курьеры проходят всегда. Щёлкните по готовым — режим «авто / открыты / закрыты».'
      : F.drag ? 'Тяните мышью — поставится линия. Правая кнопка — отмена. <kbd>Shift</kbd> — не снимать инструмент.' : 'Клик — поставить.';
    const el = document.getElementById('tool-hint');
    if (el && !Mobile.on) { el.innerHTML = `<b>${F.name}</b>: ${txt}`; el.classList.remove('hidden'); }
    const mt = document.getElementById('mtool-text');
    if (mt && Mobile.on) { document.getElementById('mtool').classList.remove('hidden'); mt.textContent = `${F.name}: коснитесь места`; }
  };

  const _sb = selectBuilding;
  selectBuilding = function (b) { if (b) { DEF.sel = -1; defCardUpdate(); } return _sb(b); };
}

// ================= Ввод =================

function defToolDown(t) {
  const tool = Game.tool;
  if (!tool || tool.kind !== 'fort') return false;
  if (tool.f === 'gate') {
    const o = fortAt(t[0], t[1]);
    if (o && o.f === 'gate') return false;     // по готовым воротам — выбор, а не стройка
  }
  if (!FORTS[tool.f].drag) return false;
  Input.fortStart = t; R.fortDrag = [t];
  return true;
}
function defToolMove(h) { if (Input.fortStart) R.fortDrag = defLine(Input.fortStart, h); }
function defToolUp() {
  const cells = R.fortDrag; R.fortDrag = null; Input.fortStart = null;
  if (!cells || !cells.length || !Game.tool || Game.tool.kind !== 'fort') return;
  defCommit(Game.tool.f, cells);
}

function defCommit(f, cells) {
  if (isDefMirror()) { coopSend({ t: 'def', a: 'place', f, cells }); return; }
  const r = defPlaceMany(f, cells);
  if (r.err) toast(r.err);
  if (r.n && !Input.keys.has('Shift') && !FORTS[f].drag) setTool(null);
  updateUI(true);
}

// Клик с инструментом (ворота и другое «в одну клетку»)
function defToolClick(t) {
  const tool = Game.tool;
  if (tool.f === 'gate') {
    const o = fortAt(t[0], t[1]);
    if (o && o.f === 'gate') { defSelect(t); return; }
  }
  defCommit(tool.f, [t]);
}

// Клик без инструмента: выбирает стену, ворота, ловушку
function defClickTile(t) {
  if (!inb(t[0], t[1])) { DEF.sel = -1; defCardUpdate(); return false; }
  const o = fortAt(t[0], t[1]);
  if (o && !World.bmap[idx(t[0], t[1])]) { defSelect(t); return true; }
  DEF.sel = -1; defCardUpdate();
  return false;
}

function defEraseAct(t) {
  if (isDefMirror()) return;                       // у клиента сносит сервер по команде erase
  defErase(t[0], t[1]);
}

function defSelect(t) {
  DEF.sel = idx(t[0], t[1]);
  Game.selected = null;
  updateUI(true);
  defCardUpdate();
}

// ================= Карточка =================

function defCardEl() {
  let card = document.getElementById('fort-card');
  if (card) return card;
  card = document.createElement('div'); card.id = 'fort-card';
  document.body.appendChild(card);
  const st = document.createElement('style');
  st.textContent = `#fort-card{position:absolute;top:58px;right:10px;width:250px;z-index:6;padding:8px 10px 10px;background:rgba(26,19,13,.94);color:#e8dcc0;border:1px solid #b08a4a;border-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,.6);font-size:13px;display:none}
  #fort-card h3{margin:0 0 2px;font-size:15px;color:#f6d458}
  #fort-card .fc-x{position:absolute;top:3px;right:5px;padding:0 6px;font-size:13px;line-height:18px}
  #fort-card .fc-bar{height:6px;background:#2a1e14;border-radius:3px;margin:4px 0 6px;overflow:hidden}
  #fort-card .fc-bar i{display:block;height:100%;background:#7ac85a}
  #fort-card .fc-row{display:flex;gap:4px;flex-wrap:wrap;margin-top:6px}
  #fort-card .fc-row button{flex:1;min-width:70px;padding:4px 6px;font-size:12px;background:#3a2a1a;color:#e8dcc0;border:1px solid #6a4a2a;border-radius:4px;cursor:pointer}
  #fort-card .fc-row button.on{border-color:#f6d458;background:#5a4418}
  #fort-card .fc-row button:disabled{opacity:.45;cursor:default}
  #fort-card .fc-d{margin-top:4px;color:#b8a888;font-size:12px}
  body.mobile #fort-card{top:calc(92px + env(safe-area-inset-top));right:auto;left:6px;width:min(300px,calc(100vw - 12px))}`;
  document.head.appendChild(st);
  card.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.classList.contains('fc-x')) { DEF.sel = -1; defCardUpdate(); return; }
    const a = b.dataset.fa;
    if (!a || DEF.sel < 0) return;
    const x = DEF.sel % MAP_W, y = (DEF.sel / MAP_W) | 0;
    if (a === 'gate') { if (isDefMirror()) coopSend({ t: 'def', a: 'gate', x, y, mode: b.dataset.mode }); else defGateMode(x, y, b.dataset.mode); }
    else if (a === 'upg') { if (isDefMirror()) coopSend({ t: 'def', a: 'upg', x, y }); else { const e2 = defUpgrade(x, y); if (e2) toast(e2); } }
    else if (a === 'repair') { if (isDefMirror()) coopSend({ t: 'def', a: 'repair', x, y }); else { const e2 = defRepair(x, y); if (e2) toast(e2); } }
    else if (a === 'erase') {
      if (isDefMirror()) coopSend({ t: 'erase', cells: [[x, y]] }); else defErase(x, y);
      DEF.sel = -1;
    }
    defCardUpdate(true);
  });
  return card;
}

const defCostLine = cost => Object.entries(cost).filter(([, n]) => n).map(([g, n]) => `${n} ${GOOD_RU[g] || GOODS[g].name.toLowerCase()}`).join(', ');

function defCardUpdate(force) {
  const card = defCardEl();
  const o = DEF.sel >= 0 ? World.obj[DEF.sel] : null;
  if (!o || o.t !== 'fort') { if (card.style.display !== 'none') { card.style.display = 'none'; card.dataset.h = ''; } DEF.sel = -1; return; }
  const F = FORTS[o.f], done = o.bt === undefined;
  const mx = fortMax(o);
  let st, pct;
  if (!done) { pct = Math.round(o.bt * 100); st = `Строится: ${pct}%`; }
  else if (o.up !== undefined) { pct = Math.round(o.up * 100); st = `Достраивается до уровня 2: ${pct}%`; }
  else if (F.trap) { pct = Math.round(o.hp / mx * 100); st = `Осталось срабатываний: ${o.hp} из ${mx}`; }
  else if (F.hp) { pct = Math.round(o.hp / mx * 100); st = `Прочность: ${Math.round(o.hp)} из ${mx}`; }
  else { pct = 100; st = 'Горит'; }
  let h = `<button class="fc-x" title="Закрыть">✕</button><h3>${F.name}${o.f === 'gate' ? (o.m === 'stone' ? ' (каменные)' : ' (деревянные)') : ''}</h3><div class="muted small">Уровень ${o.lv} · ${F.sub[o.lv - 1]}</div>
    <div class="fc-bar"><i style="width:${pct}%;background:${pct < 34 ? '#e05a40' : pct < 67 ? '#e0b040' : '#7ac85a'}"></i></div><div class="small">${st}</div>`;
  if (o.f === 'gate' && done) {
    h += `<div class="fc-row">${[['auto', 'Авто'], ['open', 'Открыты'], ['closed', 'Закрыты']].map(([m, n]) => `<button data-fa="gate" data-mode="${m}" class="${o.mode === m ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="fc-d">${o.mode === 'auto' ? 'Автоматически: вечером и ночью закрыты.' : o.mode === 'open' ? 'Открыты всегда — нечисть заходит как к себе.' : 'Закрыты всегда — жители проходят, нечисть упирается.'} Сейчас: ${o.open ? 'открыты' : 'закрыты'}.</div>`;
  }
  h += `<div class="fc-d">${F.desc[o.lv - 1]}</div><div class="fc-row">`;
  if (done && o.lv < 2 && o.up === undefined) {
    const lack = defHave(F.cost[1]);
    h += `<button data-fa="upg" ${lack ? 'disabled' : ''} title="${lack ? defNeedText(lack) : ''}">Улучшить: ${defCostLine(F.cost[1])}</button>`;
  }
  if (done && F.hp && o.hp < mx) {
    const rc = defRepairCost(o), lack = defHave(rc);
    h += `<button data-fa="repair" ${lack ? 'disabled' : ''}>Починить: ${defCostLine(rc)}</button>`;
  }
  h += `<button data-fa="erase">Снести</button></div>`;
  if (force || card.dataset.h !== h) { card.dataset.h = h; card.innerHTML = h; }
  card.style.display = 'block';
}
setInterval(() => { try { if (DEF.sel >= 0) defCardUpdate(); } catch (e) { /* игра ещё грузится */ } }, 350);

// ================= Окна башни и костра =================

function defTowerHTML(b) {
  const T = (Game.dtowers || []).find(q => q.b === b.id);
  const L2 = (b.level || 1) >= 2, cap = TOWER_CAP[L2 ? 1 : 0];
  const g = T ? T.g : [];
  let h = `<div class="isec">Дозор · стражи ${g.length}/${cap}</div>`;
  h += `<div class="irow small">Дозорный-гном: стреляет на ${L2 ? 9 : 8} клеток, видит нечисть за ${L2 ? 14 : 11}. Стражи добавляют стрелков.</div>`;
  for (const q of g) h += `<div class="irow small">${q.c === 'archer' ? 'Лучник' : 'Воин'} · ур. ${q.l} — на посту</div>`;
  if (!g.length) h += '<div class="irow small muted">Лучники и воины гильдий со свободным приказом «охранять» сами придут на башню.</div>';
  const off = !!b.noGuards;
  h += `<button class="deliv ${off ? 'closed' : 'open'}" data-df="guards:${b.id}" title="Свободные рекруты гильдий не будут занимать башню"><span><b>${off ? 'Стражи не принимаются' : 'Принимать стражей из гильдий'}</b><small>нажмите, чтобы переключить</small></span></button>`;
  return h;
}

function defBonfireHTML(b) {
  const P = 2 * ((b.w + 4) + (b.h + 4)) - 4;
  return `<button class="upg" data-df="ring:${b.id}" title="Вокруг костра встанет частокол с воротами на дорогах и факелами по углам"><span><b>Обнести частоколом: ≈ ${P} брёвен</b><small>нечисть упрётся в ограду, а курьеры пройдут через ворота</small></span></button>`;
}

{
  const _ib = infoBuilding;
  infoBuilding = function (b) {
    let h = _ib(b);
    let add = '';
    if (b.type === 'watchtower' && b.state === 'done') add = defTowerHTML(b);
    else if (b.type === 'bonfire' && b.state === 'done') add = defBonfireHTML(b);
    if (!add) return h;
    const i = h.lastIndexOf('<div class="idesc">');
    return i >= 0 ? h.slice(0, i) + add + h.slice(i) : h + add;
  };
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-df]');
    if (!el) return;
    const [a, id] = el.dataset.df.split(':'), b = Game.buildings.find(x => x.id === +id);
    if (!b) return;
    if (isDefMirror()) coopSend({ t: 'def', a, id: b.id });
    else if (a === 'guards') { b.noGuards = !b.noGuards; const T = DEF.towers.get(b.id); if (T) T.ng = b.noGuards; }
    else if (a === 'ring') { const err = defRingBonfire(b); if (err) toast(err); }
    updateUI(true);
  });
}
