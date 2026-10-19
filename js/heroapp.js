'use strict';
// Облик героя: форма колпака и его цвет, борода (форма, длина, цвет), усы, кожа, цвет куртки, украшение; имя — в одиночной игре.
// Облик — короткий массив из девяти чисел H.app (-1 — «как было»), поэтому он легко ложится в сейв, аккаунт кооп-сервера
// и пакет с юнитами. Один и тот же файл работает в браузере и на сервере (там только данные и команда {t:'app'}).
// Рисуем теми же гномами из people.js: на облик заводится свой «тип» одежды OUTFIT['hero~…'] и подмена внешности в lookOf.

const HA_CAP_COLS = ['#d4a018', '#c83a28', '#e8782c', '#f0d040', '#4e8a2a', '#2e4a7a', '#4aa8d0', '#7a3a9a', '#e886a8', '#3a3a5a', '#f4f0e4', '#2a2a30'];
const HA_COAT_COLS = ['#8a1c22', '#6e1c22', '#2e5a7e', '#4a6a8a', '#6e8e3a', '#3f7a46', '#8a6e4c', '#5a3a2a', '#5a3a6a', '#c86a3a', '#3e6a5a', '#2a2a32'];
const HA_BEARD_COLS = ['#ece6cc', '#e0d8b8', '#cfc8a8', '#d8d0c0', '#b8a888', '#9a7a52', '#c8823a', '#eae0b0', '#6a5a4a', '#3e3028', '#b04a24', '#d8c8a0'];   // = BEARDS из people.js
const HA_SKIN_COLS = ['#f2c8a0', '#e4b08a', '#c88e66'];
const HA_CAP_NAMES = ['Завиток', 'Конус', 'Мягкий мешок', 'Фригийский', 'Ночной', 'Зигзаг', 'Гриб', 'Штопор', 'С помпоном', 'Два рожка'];
const HA_BEARD_NAMES = ['Круглая', 'Раздвоенная', 'Клином', 'Лопатой', 'Козлиная'];
const HA_LEN_NAMES = ['До груди', 'До ремня'];
const HA_MUST_NAMES = ['Пышные', 'Закрученные', 'Моржовые'];
const HA_DECO_NAMES = ['Веточка', 'Листья', 'Грибок', 'Перо', 'Жёлудь', 'Без украшений'];
// индексы массива: 0 колпак, 1 цвет колпака, 2 цвет бороды, 3 форма бороды, 4 длина, 5 усы, 6 кожа, 7 куртка, 8 украшение
const HA_MAX = [9, 11, 11, 4, 1, 2, 2, 11, 5];
const HA_CLS_CAP = { warrior: '#9aa0aa', barbarian: '#8a6a4a', mage: '#2c4a9a', archer: '#3a7a2a', druid: '#6a5230', rogue: '#2a2a34', monk: '#d8501a', priest: '#e4e0d2' };
const HA = { last: null, hooked: false, types: new Map(), look: {} };

function haClean(a) {
  if (!Array.isArray(a)) return null;
  const r = HA_MAX.map((mx, i) => { const v = a[i]; return Number.isInteger(v) && v >= -1 && v <= mx ? v : -1; });
  return r.every(v => v < 0) ? null : r;
}

// облик юнита: в кооп-клиенте он приходит в u.ap, в одиночной игре и на сервере лежит в u.hero.app
const haOf = u => (u && u.type === 'hero' ? (u.ap && haClean(u.ap)) || (u.hero && u.hero.app && haClean(u.hero.app)) || null : null);
const haBase = u => { const k = u && u.hero && u.hero.clsKey; return k && OUTFIT['hero_' + k] ? 'hero_' + k : 'hero'; };

// «тип» одежды под облик: копия базового наряда с другими цветами и шапкой
function haType(base, ap) {
  const key = base + '~' + ap.join('.');
  if (HA.types.has(key)) return key;
  const O = OUTFIT[base] || OUTFIT.hero, o = Object.assign({}, O);
  const cls = typeof O.cap === 'string' && O.cap.startsWith('cls:');
  if (ap[0] >= 0 || (ap[1] >= 0 && !cls)) {
    o.cap = ap[1] >= 0 ? HA_CAP_COLS[ap[1]] : cls ? HA_CLS_CAP[O.cap.slice(4)] || '#8a6a4a' : O.cap;
  }
  if (ap[7] >= 0) { if (O.robe) o.robeCol = HA_COAT_COLS[ap[7]]; else o.coat = HA_COAT_COLS[ap[7]]; }
  OUTFIT[key] = o;
  const L = {};
  if (ap[0] >= 0) L.capStyle = ap[0];
  if (ap[2] >= 0) L.beard = ap[2];
  if (ap[3] >= 0) L.beardStyle = ap[3];
  if (ap[4] >= 0) L.beardLen = ap[4] + 1;
  if (ap[5] >= 0) L.must = ap[5];
  if (ap[6] >= 0) L.skin = ap[6];
  if (ap[8] >= 0) L.deco = ap[8];
  HA.look[key] = L;
  HA.types.set(key, true);
  return key;
}

// ---------- Рисование ----------

{
  const _lo = lookOf;
  lookOf = function (u) {
    const L = _lo(u), o = HA.look[u.type];
    return o ? Object.assign(L, o) : L;
  };

  const _ps = personSprite;
  personSprite = function (u, view, pose, frame, opt) {
    const ap = haOf(u);
    if (!ap) return _ps(u, view, pose, frame, opt);
    const sh = { type: haType(haBase(u), ap), look: u.look, carry: u.carry, carryN: u.carryN, injury: u.injury, _spr: u._spr };
    const cv = _ps(sh, view, pose, frame, opt);
    u._spr = cv;
    return cv;
  };

  const _pu = portraitURL;
  portraitURL = function (type, look) {
    if (type === 'hero' && typeof Game !== 'undefined') {
      const me = Game.hero && Game.hero.look === look && haOf(Game.hero) ? Game.hero : Game.units.find(x => x.type === 'hero' && x.look === look && haOf(x));
      if (me) return _pu(haType(haBase(me), haOf(me)), look);
    }
    return _pu(type, look);
  };
}

// портрет и фигура по облику — для окна редактора
function haPortraitFor(ap, clsKey, look) {
  const base = clsKey && OUTFIT['hero_' + clsKey] ? 'hero_' + clsKey : 'hero';
  return portraitURL(ap ? haType(base, ap) : base, look);
}
function haBodyFor(ap, clsKey, look) {
  const base = clsKey && OUTFIT['hero_' + clsKey] ? 'hero_' + clsKey : 'hero';
  return personSprite({ type: ap ? haType(base, ap) : base, look, carry: null }, 'S', 'idle', 0);
}

// ---------- Окно редактора ----------

function haCss() {
  if (document.getElementById('ha-css')) return;
  const st = document.createElement('style');
  st.id = 'ha-css';
  st.textContent = `
  .ha-modal{position:fixed;inset:0;background:rgba(8,6,3,.82);z-index:10010;display:flex;align-items:center;justify-content:center;overflow:auto;color:#e8dcc0;font-family:inherit}
  .ha-card{background:#1f1710;border:2px solid #b8902c;border-radius:8px;padding:16px 18px;width:min(580px,96vw);max-height:96vh;overflow:auto;box-sizing:border-box}
  .ha-card h2{margin:0 0 4px;color:#f6d458;font-size:20px}.ha-card p{margin:0 0 10px;font-size:13px;opacity:.85}
  .ha-body{display:flex;gap:14px;flex-wrap:wrap}
  .ha-pv{flex:0 0 132px;display:flex;flex-direction:column;align-items:center;gap:6px}
  .ha-pv canvas,.ha-pv img{image-rendering:pixelated;background:radial-gradient(#4a5a30,#141a0c);border:2px solid #5a4620;border-radius:6px}
  .ha-pv input{width:100%;box-sizing:border-box;padding:6px 8px;font-size:15px;text-align:center;background:#120d08;color:#f6e8c0;border:1px solid #7a5f28;border-radius:4px}
  .ha-pv .ha-nm{font-size:15px;color:#f6d458;font-weight:bold}
  .ha-rows{flex:1 1 250px;min-width:230px;display:flex;flex-direction:column;gap:5px}
  .ha-row{display:flex;align-items:center;gap:6px;font-size:12px}.ha-row>span{flex:0 0 92px;opacity:.8}
  .ha-row b{flex:1;text-align:center;font-weight:normal;font-size:12px;color:#f6e8c0}
  .ha-row button,.ha-sw{cursor:pointer}
  .ha-arr{width:24px;height:24px;background:#3a2c14;color:#f6d458;border:1px solid #8a6a28;border-radius:4px;font-size:13px;line-height:1;padding:0}
  .ha-sws{display:flex;flex-wrap:wrap;gap:3px;flex:1}
  .ha-sw{width:18px;height:18px;border:2px solid #2a2014;border-radius:4px;padding:0}.ha-sw.on{border-color:#fff4d0;box-shadow:0 0 0 1px #000}
  .ha-sw.def{background:repeating-linear-gradient(45deg,#3a3a3a,#3a3a3a 3px,#555 3px,#555 6px)}
  .ha-btns{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end;margin-top:12px}
  .ha-btns button{padding:7px 16px;font-size:14px;background:#8a6a1c;color:#fff4d0;border:1px solid #d8b04a;border-radius:4px;cursor:pointer;font-family:inherit}
  .ha-btns button.sec{background:#3a2c14;border-color:#7a5f28}
  .ha-note{font-size:12px;opacity:.75;margin-top:6px}`;
  document.head.appendChild(st);
}

// opts: { title, intro, app, clsKey, look, name (строка — показать поле имени; null — не показывать), nick, okText, cancelText, onOk(app, name), onCancel() }
function haOpenEditor(opts) {
  haCss();
  document.getElementById('ha-editor')?.remove();
  const ap = (haClean(opts.app) || Array(HA_MAX.length).fill(-1)).slice();
  const box = document.createElement('div');
  box.id = 'ha-editor'; box.className = 'ha-modal';
  const sw = (i, cols) => `<div class="ha-sws"><button class="ha-sw def" data-i="${i}" data-v="-1" title="Как есть"></button>${cols.map((c, v) => `<button class="ha-sw" data-i="${i}" data-v="${v}" style="background:${c}"></button>`).join('')}</div>`;
  const step = (i, label, names) => `<div class="ha-row"><span>${label}</span><button class="ha-arr" data-i="${i}" data-d="-1">◀</button><b data-nm="${i}"></b><button class="ha-arr" data-i="${i}" data-d="1">▶</button></div>`;
  box.innerHTML = `<div class="ha-card"><h2>${opts.title || 'Облик героя'}</h2><p>${opts.intro || ''}</p>
    <div class="ha-body"><div class="ha-pv"><canvas id="ha-body" width="120" height="132"></canvas>
      ${opts.name != null ? `<input id="ha-name" maxlength="16" value="${String(opts.name).replace(/"/g, '&quot;')}" autocomplete="off" placeholder="Имя героя">` : `<div class="ha-nm">${opts.nick || ''}</div>`}</div>
    <div class="ha-rows">
      ${step(0, 'Колпак')}<div class="ha-row"><span>Цвет колпака</span>${sw(1, HA_CAP_COLS)}</div>
      ${step(8, 'Украшение')}
      ${step(3, 'Борода')}${step(4, 'Длина')}<div class="ha-row"><span>Цвет бороды</span>${sw(2, HA_BEARD_COLS)}</div>
      ${step(5, 'Усы')}
      <div class="ha-row"><span>Кожа</span>${sw(6, HA_SKIN_COLS)}</div>
      <div class="ha-row"><span>Куртка</span>${sw(7, HA_COAT_COLS)}</div>
    </div></div>
    ${opts.note ? `<div class="ha-note">${opts.note}</div>` : ''}
    <div class="ha-btns"><button class="sec" data-ha="rnd">Случайно</button><button class="sec" data-ha="def">Сбросить</button>${opts.cancelText ? `<button class="sec" data-ha="no">${opts.cancelText}</button>` : ''}<button data-ha="ok">${opts.okText || 'Готово'}</button></div></div>`;
  document.body.appendChild(box);
  const NAMES = { 0: HA_CAP_NAMES, 3: HA_BEARD_NAMES, 4: HA_LEN_NAMES, 5: HA_MUST_NAMES, 8: HA_DECO_NAMES };
  const cv = box.querySelector('#ha-body');
  const draw = () => {
    for (const el of box.querySelectorAll('[data-nm]')) { const i = +el.dataset.nm; el.textContent = ap[i] < 0 ? 'По умолчанию' : NAMES[i][ap[i]]; }
    for (const el of box.querySelectorAll('.ha-sw')) el.classList.toggle('on', ap[+el.dataset.i] === +el.dataset.v);
    const spr = haBodyFor(haClean(ap), opts.clsKey, opts.look), c = cv.getContext('2d');
    c.clearRect(0, 0, cv.width, cv.height); c.imageSmoothingEnabled = false;
    if (spr && spr.width) { const k = Math.min(cv.width / spr.width, cv.height / spr.height); c.drawImage(spr, (cv.width - spr.width * k) / 2, cv.height - spr.height * k, spr.width * k, spr.height * k); }
  };
  const close = () => box.remove();
  box.addEventListener('click', e => {
    const a = e.target.closest('.ha-arr'), s = e.target.closest('.ha-sw'), b = e.target.closest('[data-ha]');
    if (a) { const i = +a.dataset.i, n = HA_MAX[i] + 2; ap[i] = ((ap[i] + 1 + +a.dataset.d + n) % n) - 1; draw(); }
    else if (s) { ap[+s.dataset.i] = +s.dataset.v; draw(); }
    else if (b) {
      const k = b.dataset.ha;
      if (k === 'rnd') { for (let i = 0; i < HA_MAX.length; i++) ap[i] = Math.floor(Math.random() * (HA_MAX[i] + 1)); draw(); }
      else if (k === 'def') { ap.fill(-1); draw(); }
      else if (k === 'no') { close(); if (opts.onCancel) opts.onCancel(); }
      else if (k === 'ok') { const nm = box.querySelector('#ha-name'); close(); opts.onOk(haClean(ap), nm ? nm.value.trim().slice(0, 16) : null); }
    }
  });
  draw();
  return box;
}

// ---------- Одиночная игра ----------

function haIsCoop() { return typeof Coop !== 'undefined' && !!Coop.on; }

if (typeof askHeroName === 'function') {
  askHeroName = function () {
    const h = Game.hero;
    if (!h) return;
    const wasSpeed = Game.speed, wasPaused = Game.paused;
    Game.paused = true;
    haOpenEditor({
      title: 'Как зовут героя?', intro: 'Он поведёт ваш город. Имя и облик можно поменять потом: карточка героя → «Облик».',
      app: h.hero.app, clsKey: h.hero.clsKey, look: h.look, name: HERO_NAMES[(Math.random() * HERO_NAMES.length) | 0], okText: 'В путь',
      onOk(app, nm) {
        h.hero.name = nm || 'Герой'; h.hero.app = app || undefined; h._spr = null; HA.last = app;
        Game.paused = wasPaused; Game.speed = wasSpeed;
        selectHero(true); updateUI(true);
      },
    });
  };
}

function haEditNow() {
  const h = Game.hero;
  if (!h || !h.hero) return;
  if (haIsCoop()) {
    haOpenEditor({
      title: 'Облик героя', intro: 'Внешность увидят все в деревне. Бесплатно и в любой момент.', app: haOf(h), clsKey: h.hero.clsKey, look: h.look, name: null, nick: h.hero.name,
      okText: 'Сохранить', cancelText: 'Отмена', onOk(app) { coopSend({ t: 'app', a: app || [] }); },
    });
  } else {
    haOpenEditor({
      title: 'Облик героя', intro: 'Переоденьтесь, пока никто не видит.', app: h.hero.app, clsKey: h.hero.clsKey, look: h.look, name: h.hero.name,
      okText: 'Сохранить', cancelText: 'Отмена',
      onOk(app, nm) { h.hero.name = nm || h.hero.name; h.hero.app = app || undefined; h._spr = null; HA.last = app; updateUI(true); },
    });
  }
}

{
  // кнопка «Облик» в карточке героя (и в кооп-панели)
  const _hp = heroPanel;
  heroPanel = function () {
    const html = _hp();
    const btn = '<div class="irow"><button class="hp-sm" data-ha-edit="1" title="Колпак, борода, цвета' + (haIsCoop() ? '' : ', имя') + '">✎ Облик героя</button></div>';
    const i = html.lastIndexOf('<div class="tip">');
    return i >= 0 ? html.slice(0, i) + btn + html.slice(i) : html + btn;
  };
  document.addEventListener('click', e => {
    if (e.target.closest && e.target.closest('[data-ha-edit]')) { e.stopPropagation(); haEditNow(); }
  }, true);

  // после смерти в одиночной игре герой создаётся заново — облик остаётся
  const _sh = spawnHero;
  spawnHero = function (name) {
    const u = _sh(name);
    if (HA.last && !u.hero.app) u.hero.app = HA.last.slice();
    return u;
  };
  const _rs = resetGameState;
  resetGameState = function () { _rs(); HA.last = null; };
  // сервер: перехваты кооп-функций ставим до первого входа игрока (мир создаётся или грузится раньше любого входа)
  for (const fn of ['setupStart', 'applySave']) {
    const _f = globalThis[fn];
    globalThis[fn] = function (...a) { const r = _f.apply(this, a); if (!HA.hooked && typeof coop !== 'undefined' && coop.players) haServerHook(); return r; };
  }
  const _st = step;
  step = function (dt) {
    _st(dt);
    if (typeof coop !== 'undefined' && coop.players) {
      if (!HA.hooked) haServerHook();
      for (const u of coop.players.values()) { const a = u.hero.app || null; if (u.ap !== a) u.ap = a; }
    } else if (Game.hero && Game.hero.hero && Game.hero.hero.app) HA.last = Game.hero.hero.app;
  };
}

// ---------- Кооп: клиент ----------

if (typeof coopUnits === 'function' && typeof COOP_UNIT_EX !== 'undefined') {
  if (!COOP_UNIT_EX.includes('ap')) COOP_UNIT_EX.push('ap');
  // выбор класса при первом входе: сначала облик, потом класс уходит на сервер вместе с ним
  const _pc = coopPickClass;
  coopPickClass = function (classes) {
    _pc(classes);
    const box = document.getElementById('cp-class');
    if (!box) return;
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-cls]');
      if (!b) return;
      e.stopImmediatePropagation(); e.preventDefault();
      const cls = b.dataset.cls;
      box.style.display = 'none';
      haOpenEditor({
        title: 'Как выглядит герой?', intro: `${(classes[cls] || {}).name || ''}: колпак, борода и цвета. Потом можно поменять в любой момент — кнопка «Облик» у героя.`,
        app: null, clsKey: cls, look: 7, name: null, nick: Coop.nick, okText: 'В деревню', cancelText: 'Назад',
        onCancel() { box.style.display = ''; },
        onOk(app) { coopSend({ t: 'class', cls, ap: app || [] }); box.remove(); },
      });
    }, true);
  };
}

// ---------- Кооп: сервер ----------

function haServerHook() {
  HA.hooked = true;
  if (typeof COOP_UNIT_EX !== 'undefined' && !COOP_UNIT_EX.includes('ap')) COOP_UNIT_EX.push('ap');
  const _cc = coopCmd;
  coopCmd = function (name, json, admin) {
    let m = null;
    try { m = JSON.parse(json); } catch (e) { return; }
    if (m && m.t === 'app') {
      const u = coop.players.get(name);
      if (u) { u.hero.app = haClean(m.a) || undefined; coopSay(name, 'Облик героя обновлён'); }
      return;
    }
    return _cc(name, json, admin);
  };
  const _cj = coopJoin;
  coopJoin = function (name, json) {
    const id = _cj(name, json);
    let d = null; try { d = JSON.parse(json); } catch (e) { /* ничего */ }
    const u = coop.players.get(name);
    if (u && d && d.ap) u.hero.app = haClean(d.ap) || undefined;
    return id;
  };
  const _hd = coopHeroData;
  coopHeroData = function (name) {
    const j = _hd(name), u = coop.players.get(name);
    if (!j || !u || !u.hero.app) return j;
    const d = JSON.parse(j); d.ap = u.hero.app; return JSON.stringify(d);
  };
}
