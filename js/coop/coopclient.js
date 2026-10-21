'use strict';
// Кооператив, клиентская часть. Одиночная игра не меняется: всё здесь оживает только после входа на сервер
// (StartMenu.onConnect). В сетевом режиме клиент НЕ считает симуляцию — мир считает сервер (server/, js/coopsim.js),
// сюда приходят снимки; существующая отрисовка рисует их как обычно. Ввод превращается в команды серверу.
// Подключается после hero.js и startmenu.js: оборачивает несколько глобальных функций.

const Coop = {
  on: false, ws: null, nick: '', host: false, meta: null, creds: null, uid: 0,
  anim: new Map(), bubbles: new Map(), chatLog: [], roadBatch: [], me: null, saveT: 0, regMode: false,
  lastLoad: 0, reconnecting: false, noticeField: false, heroCmdAt: 0,
};
const COOP_SLOT = 'coop';

const COOP_TOK = 'feod.coop';
function coopSaved(set) {
  try {
    if (set === null) { localStorage.removeItem(COOP_TOK); return null; }
    if (set) localStorage.setItem(COOP_TOK, JSON.stringify(set));
    return JSON.parse(localStorage.getItem(COOP_TOK));
  } catch (e) { return null; }
}

// Общий сервер по умолчанию — для игры, открытой не с самого сервера (GitHub Pages, файл с диска).
// Страница по https (GitHub Pages) может подключиться только к wss:// — см. server/DEPLOY.md.
// Можно подменить ссылкой: ...?server=wss://адрес
const COOP_SERVER = 'wss://151-252-107-75.sslip.io';

// Строки от сервера в разметку — только через это: ссылку ?server= может подсунуть кто угодно, и чужой сервер
// прислал бы в чат или подписи <img onerror=…> (XSS на странице игры, доступ к сохранениям и входу)
const coopEsc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// адрес сервера, если страница открыта с него же
function coopOrigin() { return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host; }

// «1.2.3.4», «1.2.3.4:8787», «http://…», «https://…» → адрес WebSocket
function coopWsUrl(a) {
  a = String(a || '').trim().replace(/\/+$/, '');
  if (!a) return '';
  if (/^https:\/\//i.test(a)) return 'wss://' + a.slice(8);
  if (/^http:\/\//i.test(a)) return 'ws://' + a.slice(7);
  if (/^wss?:\/\//i.test(a)) return a;
  return (location.protocol === 'https:' ? 'wss://' : 'ws://') + a;
}
function coopDefaultServer() {
  let q = '';
  try { q = new URLSearchParams(location.search).get('server') || ''; } catch (e) { /* старый браузер */ }
  return coopWsUrl(q || COOP_SERVER);
}
// адрес для запросов по HTTP к тому же серверу (coop-info)
const coopHttpUrl = ws => ws.replace(/^ws/i, 'http');

// версия клиента для статистики сервера: откуда открыта игра и когда выложена её страница
function coopVer() {
  const d = new Date(document.lastModified), when = isNaN(d) ? '?' : d.toISOString().slice(0, 16).replace('T', ' ');
  return (/github\.io$/.test(location.hostname) ? 'pages ' : location.protocol === 'file:' ? 'file ' : 'site ') + when;
}

const COOP_ZIP = typeof DecompressionStream === 'function';
async function coopInflate(buf) {
  const ds = new DecompressionStream('deflate-raw');
  const w = ds.writable.getWriter();
  w.write(buf); w.close();
  return await new Response(ds.readable).text();
}

function coopSend(o) { if (Coop.ws && Coop.ws.readyState === 1) Coop.ws.send(JSON.stringify(o)); }

// ---------- Подключение ----------

function coopConnect(opts) {
  return new Promise((resolve, reject) => {
    let ws, settled = false;
    opts = { ...opts, server: coopWsUrl(opts.server) };
    if (!opts.server) { reject(new Error('Укажите адрес сервера')); return; }
    if (location.protocol === 'https:' && opts.server.startsWith('ws://')) { reject(new Error('Страница открыта по https, а сервер без шифрования (ws://). Откройте игру с адреса сервера: ' + coopHttpUrl(opts.server) + '/ — или настройте wss (server/DEPLOY.md)')); return; }
    try { ws = new WebSocket(opts.server); } catch (e) { reject(new Error('Неверный адрес сервера')); return; }
    Coop.ws = ws; Coop.creds = opts;
    const fail = msg => { if (settled) return; settled = true; reject(new Error(msg)); try { ws.close(); } catch (e) { /* ничего */ } };
    ws.onopen = () => ws.send(JSON.stringify({ t: 'auth', mode: opts.mode, nick: opts.nick, pass: opts.pass, token: opts.token, ver: coopVer(), z: COOP_ZIP ? 1 : 0, d: 1 }));
    ws.binaryType = 'arraybuffer';
    ws.onerror = () => fail('Сервер не отвечает. Он запущен? Адрес верный?');
    ws.onclose = () => { if (!settled) fail('Связь оборвана'); else if (Coop.ws === ws) coopLost(); };
    // большие пакеты приходят сжатыми (бинарный кадр deflate-raw); разжатие асинхронное, поэтому порядок держим очередью
    let pend = Promise.resolve(), pendN = 0;
    ws.onmessage = ev => {
      if (typeof ev.data !== 'string') {
        pendN++;
        pend = pend.then(() => coopInflate(ev.data)).then(t => { pendN--; handleText(t); }, () => { pendN--; });
      } else if (pendN) { pendN++; pend = pend.then(() => { pendN--; handleText(ev.data); }); } else handleText(ev.data);
    };
    const handleText = data => {
      let m; try { m = JSON.parse(data); } catch (e) { return; }
      if (m.t === 'err') { if (m.stale) coopSaved(null); return fail(m.msg); }
      if (m.t === 'welcome') {
        if (m.token) coopSaved({ server: opts.server, nick: m.nick, token: m.token });
        Coop.perms = m.perms; Coop.permLabels = m.permLabels;
        Coop.nick = m.nick; Coop.host = m.host; Coop.meta = { classes: m.classes, chat: m.chat };
        if (m.needClass) coopPickClass(m.classes);
        return;
      }
      if (m.t === 'init') { coopApplyInit(m); if (!settled) { settled = true; track('coop-join', 'Зашёл в кооп'); resolve(true); } return; }
      coopHandle(m);
    };
  });
}

function coopApplyInit(m) {
  Coop.on = true; Coop.mirror = true; Game.coop = true;
  document.body.classList.add('coop');   // в онлайне время считает сервер: скорость выбирает хост, паузу просят голосованием
  document.body.classList.toggle('coop-host', !!Coop.host);
  Coop.tempo = Coop.tempo || { speed: 1, paused: false };
  applySave(m.world);
  Game.units = []; Game.unitMap.clear(); Game.animals = []; Game.hero = null; Game.heroAsk = false; Game.selUnit = null; Game.selected = null;
  Game.piles.clear();
  World.obj.fill(null);
  for (const [i, o] of m.ob || []) World.obj[i] = o;
  for (const k of COOP_LISTS) Game[k] = [];
  Game.golem = null; Game.sub = null; Game.foe = null;
  Game.nextId = Math.max(Game.nextId, m.nextId || 0);
  Game.time = m.time;
  Game.paused = false; Game.speed = 1;
  Coop.uid = m.uid; Coop.view = null; Coop.mir = null; Coop.anim.clear(); Coop.bubbles.clear(); Coop.roadBatch = [];
  Coop.saveT = 0;
  if (Coop.host) unlockAll();       // хосту доступно всё, остальным меню открывается по мере развития деревни
  else renderBuildMenu();
  coopInitHud();
  coopInitControls();
  if (Tut.on) { Tut.on = false; if (Tut.el) Tut.el.classList.add('hidden'); tutHighlight([]); }   // обучение в общей деревне не нужно
}

function coopHandle(m) {
  switch (m.t) {
    case 'u': coopUnits(m); break;
    case 'w': coopWorld(m); break;
    case 'me': Coop.me = m; coopRefreshHud(); coopVilHud(m.vil); coopQuestHud(m.qx, m.tt); break;
    case 'unlock': if (typeof unlockStage === 'function') unlockStage(m.id, true); break;
    case 'toast': toast(m.text, null, 'coop'); break;
    case 'fl': floater(m.x, m.y, m.text, m.col || '#fff6d0'); break;
    case 'chat': coopChat(m); break;
    case 'chron': if (typeof chronMirrorIn === 'function') chronMirrorIn(m.e); break;
    case 'saved': break;
    case 'restarting': Coop.reconnecting = true; toast('Сервер перезапускается…'); break;
    case 'kicked': Coop.kicked = m.msg || 'Вы вошли в деревню из другого окна'; break;
  }
}

function coopChat(m) {
  Coop.chatLog.push({ from: m.from, text: m.text, at: Date.now() });
  if (Coop.chatLog.length > 30) Coop.chatLog.shift();
  if (m.uid) Coop.bubbles.set(m.uid, { text: m.text, until: Game.time + 5 });
  coopRefreshHud();
}

// ---------- Зеркало мира ----------

function coopUnits(m) {
  if (Math.abs(Game.time - m.time) > 1) Game.time = m.time; else Game.time += (m.time - Game.time) * 0.3;
  const byId = new Map(Game.buildings.map(b => [b.id, b]));
  // d:1 — дельта: пришли только изменившиеся (тип и внешность — лишь при первом показе), ушедшие — в ug,
  // раз в секунду ids — весь состав. Без d — старый полный пакет: кого нет в списке, того нет и в деревне.
  const seen = m.d ? (m.ids ? new Set(m.ids) : null) : new Set();
  if (m.ug) for (const id of m.ug) coopDropUnit(id);
  for (const d of m.units) {
    if (seen && !m.d) seen.add(d.i);
    let u = Game.unitMap.get(d.i);
    if (!u) {
      if (!d.t) continue;
      u = new Unit(d.t, 0, 0);
      u.id = d.i; u.x = d.x; u.y = d.y; u.smoker = false;
      Game.units.push(u); Game.unitMap.set(u.id, u);
    }
    u.tx = d.x; u.ty = d.y; u.face = d.f; u.vdir = d.v || 'S'; u.food = d.fd;
    if (d.lk !== undefined) u.look = d.lk;
    u.anim = d.a || null; u.carry = d.c || null; u.carryN = d.n || 0;
    u.inside = d.in ? byId.get(d.in) || null : null;
    u.injury = d.inj || null; u.drunkAt = d.dr ? 1e9 : 0; u.ouchUntil = d.ou ? Game.time + 0.7 : 0;
    for (const k of COOP_UNIT_EX) {
      // семья и облик в дельте приходят только вместе с типом (sx), в старом пакете — в ex
      if (COOP_UNIT_STATIC.includes(k)) { if (!m.d || d.t !== undefined) u[k] = (d.sx && d.sx[k]) ?? (d.ex && d.ex[k]); continue; }
      u[k] = d.ex && d.ex[k] !== undefined ? d.ex[k] : undefined;
    }
    if (d.m) { if (!(u.action && u.action.walk)) u.action = { walk: [0, 0], path: [1], i: 0, block: 0 }; }
    else if (d.at !== undefined) { if (!u.action || u.action.walk) u.action = { wait: 1, T: d.aT, anim: d.a }; u.action.t = d.at; }
    else u.action = null;
    if (d.ow) {
      u.owner = d.ow; u.title = d.tt || null;
      u.hero = Object.assign(u.hero || {}, { name: d.ow, owner: d.ow, level: d.lv, clsKey: d.cl, hp: d.hp, maxhp: d.mhp, cls: ((Coop.meta && Coop.meta.classes[d.cl]) || {}).name || '', equip: { weapon: null, armor: null } });
      if (d.i === Coop.uid && Game.hero !== u) {
        Game.hero = u;
        if (!Game.selUnit) { Game.selUnit = null; centerOn(u.x * TILE, u.y * TILE); }   // без карточки: новичку хватает карты
      }
    }
  }
  if (seen) for (let i = Game.units.length - 1; i >= 0; i--) if (!seen.has(Game.units[i].id)) coopDropUnit(Game.units[i].id);
  // звери
  const aSeen = m.d ? (m.aids ? new Set(m.aids) : null) : new Set();
  if (m.ag) for (const id of m.ag) Coop.anim.delete(id);
  for (const d of m.animals) {
    if (aSeen && !m.d) aSeen.add(d.i);
    let a = Coop.anim.get(d.i);
    if (!a) { a = makeAnimal(d.k, 0, 0); a.id = d.i; a.x = d.x; a.y = d.y; Coop.anim.set(d.i, a); }
    a.tx = d.x; a.ty = d.y; a.face = d.f; a.moving = !!d.m; a.loot = d.l || null; a.state = d.s; a.phase = d.p;
  }
  if (aSeen) for (const id of [...Coop.anim.keys()]) if (!aSeen.has(id)) Coop.anim.delete(id);
  Game.animals = [...Coop.anim.values()];
  if (m.mir) coopMirror(m.mir);
  if (m.d) coopMirrorDelta(m);
}

function coopDropUnit(id) {
  const u = Game.unitMap.get(id);
  if (!u) return;
  const i = Game.units.indexOf(u);
  if (i >= 0) Game.units.splice(i, 1);
  Game.unitMap.delete(id);
  if (Game.hero === u) Game.hero = null;
}

// Какие клетки видит камера: сервер шлёт жителей вне них реже (интерес-менеджмент). Шлём, только когда окно сдвинулось.
function coopSendView() {
  if (!R.canvas || !R.cam) return;
  const z = devScale(), x0 = Math.floor(R.cam.x / TILE), y0 = Math.floor(R.cam.y / TILE);
  const x1 = Math.ceil((R.cam.x + R.canvas.width / z) / TILE), y1 = Math.ceil((R.cam.y + R.canvas.height / z) / TILE);
  const v = [x0, y0, x1, y1], o = Coop.view;
  if (o && v.every((k, i) => Math.abs(k - o[i]) < 2)) return;
  Coop.view = v;
  coopSend({ t: 'view', x0, y0, x1, y1 });
}

function coopApplyBuilding(d, byId) {
  let b = byId.get(d.id);
  const fresh = !b || b.type !== d.type || b.x !== d.x || b.y !== d.y || (b.level || 1) !== (d.level || 1) || !!b.upg !== !!d.upg || (b.rot || 0) !== (d.rot || 0);
  if (fresh) {
    const was = b && Game.selected === b;
    if (b) coopDropBuilding(b);
    b = new Building(d.type, d.x, d.y, d.state === 'done', d.rot || 0);
    b.id = d.id;
    if (b.type === 'graveyard' && d.state !== 'done') { b.selfBuild = true; b.maxHits = SITE_HITS + GY_BUILD_HITS; b.total = 1; }
    if (d.level >= 2 && b.def.up) { upgradeBuilding(b, true); if (d.level >= 3 && b.def.up3) upgradeBuilding(b, true); }
    if (d.upg && canUpgrade(b)) startUpgrade(b);
    for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) World.bmap[idx(xx, yy)] = b.id;
    World.door[idx(b.doorX, b.doorY)] = 1;
    if (b.door2) World.door[idx(b.door2[0], b.door2[1])] = 1;
    Game.buildings.push(b);
    byId.set(b.id, b);
    if (was) Game.selected = b;
  }
  b.state = d.state;
  for (const g in b.stock) b.stock[g] = 0;
  Object.assign(b.stock, d.stock);
  for (const g in b.usedOf) b.usedOf[g] = 0;
  Object.assign(b.usedOf, d.usedOf);
  b.used = d.used;
  b.hits = d.hits ?? (b.state === 'done' ? b.maxHits : 0);
  b.queue = d.queue || [];
  b.training = d.training || null;
  b.paused = !!d.paused; b.hold = !!d.hold; b.noDeliver = !!d.noDeliver; b.dmg = d.dmg || 0;
  if (d.recipeOn && d.recipeOn.length === b.recipeOn.length) b.recipeOn = d.recipeOn;
  b.recipeIdx = d.recipeIdx || 0;
  b.orders = Array.isArray(d.orders) ? d.orders : [];
  if (d.pigs) b.pigs = d.pigs;
  if (d.crops) b.crops = d.crops;
  if (d.upg && b.upg) { Object.assign(b.upg.used, d.upg.used); Object.assign(b.upg.stock, d.upg.stock); b.upg.usedN = d.upg.usedN; b.upg.hits = d.upg.hits; }
  b.working = !!d.wk; if (d.an) b.anim = d.an;
}

function coopDropBuilding(b) {
  b.removed = true;
  for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) if (World.bmap[idx(xx, yy)] === b.id) World.bmap[idx(xx, yy)] = 0;
  World.door[idx(b.doorX, b.doorY)] = 0;
  if (b.door2) World.door[idx(b.door2[0], b.door2[1])] = 0;
  const k = Game.buildings.indexOf(b);
  if (k >= 0) Game.buildings.splice(k, 1);
}

const COOP_LISTS = ['ghosts', 'skels', 'ents', 'owls', 'bats', 'critters', 'falling', 'neutrals', 'lepr', 'lairs', 'raiders', 'foeShots', 'foeZones', 'games', 'dshots', 'dtowers', 'wfx', 'wild'];
const COOP_UNIT_STATIC = ['fam', 'ap'];   // как на сервере (coopsim.js)
const COOP_UNIT_EX = ['slip', 'burn', 'lantern', 'knock', 'gest', 'gestFace', 'gestUntil', 'netUntil', 'umbrella', 'fleeUntil', 'panicUntil', 'fun', 'hangUntil', 'gp', 'brawl', 'mdr', 'ill', 'fam', 'kp', 'bah'];

// ссылки {__u:id} / {__b:id} из снимка превращаем обратно в жителей и здания
function coopResolve(v) {
  if (v && typeof v === 'object') {
    if (v.__u !== undefined) return Game.unitMap.get(v.__u) || null;
    if (v.__b !== undefined) return Game.buildings.find(b => b.id === v.__b) || null;
    if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) v[i] = coopResolve(v[i]); return v; }
    for (const k in v) v[k] = coopResolve(v[k]);
  }
  return v;
}

function coopSyncList(name, arr) {
  const old = new Map((Game[name] || []).map(o => [o.__id, o]));
  Game[name] = arr.map(d => {
    coopResolve(d);
    const o = old.get(d.__id);
    if (!o) { if (typeof d.x === 'number') { d.tx = d.x; d.ty = d.y; } if (name === 'ghosts') d.ta = d.alpha; return d; }
    for (const k in d) { if (k === 'x' || k === 'y' || (name === 'ghosts' && (k === 'ph' || k === 'alpha'))) continue; o[k] = d[k]; }
    if (name === 'ghosts') o.ta = d.alpha;      // фазу покачивания ведём сами, прозрачность подтягиваем плавно (coopStep)
    if (typeof d.x === 'number') { o.tx = d.x; o.ty = d.y; }
    return o;
  });
}

// нечисть, ночные твари, голем, субботник и погода — считает сервер, мы только показываем
function coopMirror(m) {
  for (const k of COOP_LISTS) coopSyncList(k, m[k] || []);
  if (m.foe !== undefined) Game.foe = m.foe ? Object.assign(Game.foe || {}, m.foe) : null;     // шпиль Малгора (enemy.js)
  if (typeof spireMirrorIn === 'function') spireMirrorIn(m.sp);     // тропа к шпилю: рубит сервер (spire.js)
  Game.golem = m.golem ? Object.assign(Game.golem || {}, coopResolve(m.golem)) : null;
  Game.sub = m.sub ? coopResolve(m.sub) : null;
  Game.lostGnomes = m.lost || 0;
  if (typeof goalMirrorIn === 'function') goalMirrorIn(m.goal);
  if (typeof tradeMirrorIn === 'function') tradeMirrorIn(m.trade);
  if (typeof dilMirrorIn === 'function') dilMirrorIn(m.dil);
  if (typeof travMirrorIn === 'function') travMirrorIn(m.trav);
  if (typeof wgsMirrorIn === 'function') wgsMirrorIn(m.wgs);
  if (typeof lawMirrorIn === 'function') lawMirrorIn(m.law);
  if (typeof medMirrorIn === 'function') medMirrorIn(m.med);
  if (typeof rscMirrorIn === 'function') rscMirrorIn(m.rsc);
  if (typeof famMirrorIn === 'function') famMirrorIn(m.fam);
  if (m.df) Game.diff = diffKey(m.df);
  const festWas = festOn();
  Game.festival = m.fest || null;
  if (!festWas && festOn()) festCheers();       // праздник начался — аплодисменты и у клиентов
  Object.assign(WX, m.wx, { ready: true });
  if (typeof seaMirrorIn === 'function') seaMirrorIn(m.sea);
  if (typeof seaLifeMirrorIn === 'function') seaLifeMirrorIn(m.sl);
  if (typeof fyMirrorIn === 'function') fyMirrorIn(m.fy);      // единорог, дракон, грифон, саламандры (fairy1.js)
}

// Дельта зеркала (d:1): последнее состояние держим у себя и собираем из него полный снимок для coopMirror —
// так обёртки coopMirror из других модулей (гильдии, умения, оборона…) получают то же, что и раньше.
// ml — изменившиеся записи списков, mg — ушедшие, mids — весь состав (раз в секунду), mo — прочие ключи, когда поменялись.
function coopMirrorDelta(m) {
  const C = Coop.mir || (Coop.mir = { lists: {}, mo: {} });
  if (!m.ml && !m.mg && !m.mids && !m.mo && !C.ready) return;
  if (m.mo) Object.assign(C.mo, m.mo);
  for (const k in m.ml || {}) { const L = C.lists[k] || (C.lists[k] = new Map()); for (const d of m.ml[k]) L.set(d.__id, d); }
  for (const k in m.mg || {}) { const L = C.lists[k]; if (L) for (const id of m.mg[k]) L.delete(id); }
  for (const k in m.mids || {}) {
    const L = C.lists[k] || (C.lists[k] = new Map()), keep = new Set(m.mids[k]);
    for (const id of L.keys()) if (!keep.has(id)) L.delete(id);
  }
  C.ready = true;
  // копия: coopSyncList и coopResolve меняют записи на месте (новые записи становятся объектами игры)
  const full = JSON.parse(JSON.stringify(C.mo));
  for (const k in C.lists) full[k] = JSON.parse(JSON.stringify([...C.lists[k].values()]));
  coopMirror(full);
}

function coopWorld(m) {
  Game.nextId = Math.max(Game.nextId, m.nextId || 0);
  if (m.bx) for (const id of m.bx) { const b = Game.buildings.find(x => x.id === id); if (b) coopDropBuilding(b); }
  if (m.b) { const byId = new Map(Game.buildings.map(b => [b.id, b])); for (const d of m.b) coopApplyBuilding(d, byId); }
  if (m.o) for (const [i, o] of m.o) World.obj[i] = o;
  if (m.ox) for (const i of m.ox) World.obj[i] = null;
  if (m.r || m.rx) {
    // в слое TERR.roads дорога нарисована заранее — после дельты перерисовываем клетки и соседей
    if (m.r) for (const i of m.r) setRoad(i % MAP_W, (i / MAP_W) | 0, 1);
    if (m.rx) for (const i of m.rx) setRoad(i % MAP_W, (i / MAP_W) | 0, 0);
  }
  if (m.rs) {
    Game.roadSites.clear();
    for (const r of m.rs) { const s = new RoadSite(r.x, r.y); s.stock.stone = r.st; s.dug = r.dg; s.pave = r.pv; Game.roadSites.set(idx(r.x, r.y), s); }
  }
  if (m.sb) Game.storeBlock = m.sb;
  if (m.pl) {
    Game.piles.clear();
    for (const q of m.pl) { const p = new Pile(q.x, q.y); Object.assign(p.stock, q.st); Game.piles.set(idx(q.x, q.y), p); }
  }
}

// Вместо step(): время идёт, всё плавно доезжает до последнего снимка
function coopStep(dt) {
  Game.time += dt;
  const k = Math.min(1, dt * 12), k2 = k;
  for (const u of Game.units) {
    if (u.tx === undefined) continue;
    const dx = u.tx - u.x, dy = u.ty - u.y, d = Math.hypot(dx, dy);
    if (d > 3) { u.x = u.tx; u.y = u.ty; } else if (d > 0.002) {
      u.x += dx * k; u.y += dy * k;
      if (u.action && u.action.walk) u.walkPhase += Math.hypot(dx * k, dy * k) * 6;
    }
    if (u.action && u.action.t !== undefined && u.action.t > 0) u.action.t -= dt;
  }
  for (const a of Game.animals) {
    if (a.tx === undefined) continue;
    const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
    if (d > 3) { a.x = a.tx; a.y = a.ty; } else { a.x += dx * k; a.y += dy * k; a.phase += Math.hypot(dx * k, dy * k) * 3; }
  }
  if (typeof fyMirrorStep === 'function') fyMirrorStep(k2);
  for (const k of COOP_LISTS) for (const o of Game[k]) {
    if (o.tx === undefined || typeof o.x !== 'number') continue;
    const dx = o.tx - o.x, dy = o.ty - o.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) { o.x = o.tx; o.y = o.ty; } else { o.x += dx * k2; o.y += dy * k2; }
  }
  for (const g of Game.ghosts) {      // между снимками призрак качается и проступает/тает плавно, а не рывками
    g.ph += dt * 2.2;
    if (g.ta !== undefined) g.alpha += (g.ta - g.alpha) * Math.min(1, dt * 4);
  }
  for (const b of Game.buildings) b.anim += dt * (b.working ? 3 : 0.25);   // колёса мельницы и т.п.: сервер шлёт кадр только вместе с остальным состоянием
  const h = Game.hero;
  if (h && h.cmd && Game.time - Coop.heroCmdAt > 1.2 && !(h.action && h.action.walk)) h.cmd = null;
  Coop.saveT += dt;
  if (Coop.saveT >= 30) { Coop.saveT = 0; coopSaveCopy(); }
  Coop.viewT = (Coop.viewT || 0) + dt;
  if (Coop.viewT >= 0.25) { Coop.viewT = 0; coopSendView(); }
}

// Копия общего мира на случай, когда сервер выключен: свой слот, личные сохранения не трогаем
function coopSaveCopy() {
  if (!Coop.on) return;
  try {
    const s = serializeGame();
    localStorage.setItem(SAVE_KEY + COOP_SLOT, JSON.stringify(s));
    localStorage.setItem(SAVE_KEY + COOP_SLOT + '.meta', JSON.stringify({ at: Date.now(), time: Game.time, people: Game.units.length, nick: Coop.nick }));
  } catch (e) { console.warn('копия мира не сохранилась', e); }
}

// ---------- Подключение к игре: оборачиваем глобальные функции ----------

{
  const _step = step;
  // пока связь потеряна, на экране зеркало общего мира: своя симуляция по нему не идёт (у жителей там нет настоящих дел)
  step = function (dt) { if (Coop.on) coopStep(dt); else if (!Coop.mirror) _step(dt); };

  const _pb = placeBuilding;
  placeBuilding = function (type, x, y, done, rot) {
    if (!Coop.on) return _pb(type, x, y, done, rot);
    coopSend({ t: 'build', type, x, y, rot: rot || 0 });
    return null;
  };

  const _pr = placeRoadSite;
  placeRoadSite = function (x, y) {
    if (!Coop.on) return _pr(x, y);
    if (!canPlaceRoad(x, y)) return null;
    Coop.roadBatch.push([x, y]);
    if (Coop.roadBatch.length === 1) setTimeout(() => { coopSend({ t: 'road', cells: Coop.roadBatch }); Coop.roadBatch = []; }, 0);
    return true;
  };

  const _er = eraseAt;
  eraseAt = function (t) {
    if (!Coop.on) return _er(t);
    if (!inb(t[0], t[1])) return;
    const i = idx(t[0], t[1]), id = World.bmap[i];
    if (id) {
      const b = Game.buildings.find(o => o.id === id);
      if (b && b.state === 'done' && !confirm(`Снести «${b.def.name}»? Деревня общая — другие игроки это увидят.`)) return;
    }
    coopSend({ t: 'erase', cells: [[t[0], t[1]]] });
  };

  const _fs = fieldStroke;
  fieldStroke = function (t, first) {
    if (!Coop.on) return _fs(t, first);
    const tool = Game.tool;
    if (!tool || tool.kind !== 'field' || !inb(t[0], t[1])) return;
    const key = t.join();
    if (!first && key === Input.lastFieldTile) return;
    Input.lastFieldTile = key;
    if (first) { const o = World.obj[idx(t[0], t[1])]; Input.fieldMode = o && o.t === 'field' ? 'del' : 'add'; }
    if (!Input.fieldMode) return;
    Coop.fieldBatch = Coop.fieldBatch || [];
    Coop.fieldBatch.push([t[0], t[1]]);
    if (Coop.fieldBatch.length === 1) { const mode = Input.fieldMode; setTimeout(() => { coopSend({ t: 'field', cells: Coop.fieldBatch, mode, crop: tool.crop }); Coop.fieldBatch = []; }, 120); }
  };

  const _ss = setSpeed;
  setSpeed = function (s) { if (!Coop.on) return _ss(s); toast('В общей деревне время не остановить'); };

  const _sg = saveGame;
  saveGame = function (slot) { return Coop.on ? (coopSaveCopy(), true) : _sg(slot); };

  const _lg = loadGame;
  loadGame = function (slot) {
    if (Coop.on) { toast('В общей деревне загрузка недоступна'); return false; }
    return _lg(slot);
  };

  const _ic = issueCmd;
  issueCmd = function (hero, c) {
    if (!Coop.on) return _ic(hero, c);
    coopSend({ t: 'go', x: c.tx, y: c.ty });
    hero.cmd = c; Coop.heroCmdAt = Game.time;
  };

  const _rc = resolveCmd;
  resolveCmd = function (t) {
    if (Coop.on && inb(t[0], t[1])) {
      const b = buildingAt(t);
      if (b && !b.isRoad && b.type === 'inn' && b.state === 'done' && !b.upg) return { kind: 'tavern', b, tx: b.doorX, ty: b.doorY, label: 'Поесть в трактире' };
    }
    return _rc(t);
  };

  const _hp = heroPanel;
  heroPanel = function () { return Coop.on ? coopPanel() : _hp(); };   // в одиночной игре — панель героя из hero.js / herolife.js
  const _hb = heroBtnUpdate;
  heroBtnUpdate = function () { if (!Coop.on) _hb(); else { const b = document.getElementById('hero-btn'); if (b) b.style.display = Game.hero ? '' : 'none'; if (Game.hero) _hb(); } };

  const _ov = drawOverlay;
  drawOverlay = function (c) {
    if (!Coop.on) return _ov(c);
    const h = Game.hero, nm = h && h.hero ? h.hero.name : null;
    if (nm !== null) h.hero.name = '';          // свой ник рисуем сами, вместе с остальными
    _ov(c);
    if (nm !== null) h.hero.name = nm;
    coopPlates(c);
  };
}

// Ник, полоска здоровья и реплика над головой каждого героя
function coopPlates(c) {
  const classes = (Coop.meta && Coop.meta.classes) || {};
  const hh = Game.hero;
  if (hh && hh.cmd && hh.cmd.tx != null) {       // куда идёт герой: пульсирующее кольцо
    const p = (Game.time * 1.6) % 1, fx = (hh.cmd.tx + 0.5) * TILE, fy = (hh.cmd.ty + 0.5) * TILE + 6;
    c.strokeStyle = `rgba(246,212,88,${0.9 - p * 0.8})`; c.lineWidth = 2;
    c.beginPath(); c.ellipse(fx, fy, 6 + p * 8, 3 + p * 4, 0, 0, Math.PI * 2); c.stroke();
  }
  const qx = Coop.qx;
  if (qx) {      // метки заданий: дальняя точка и рычаги
    const marks = [];
    for (const q of qx.q) if (q.x != null) marks.push([q.x, q.y, '#9fe070']);
    if (qx.p && qx.p.pts) for (const p of qx.p.pts) marks.push([p[0], p[1], '#e8a0f0']);
    for (const [mx, my, col] of marks) {
      const p = (Game.time * 1.1) % 1, fx = (mx + 0.5) * TILE, fy = (my + 0.5) * TILE;
      c.strokeStyle = col; c.globalAlpha = 0.9 - p * 0.7; c.lineWidth = 2;
      c.beginPath(); c.ellipse(fx, fy, 8 + p * 10, 4 + p * 5, 0, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx, fy - 26 - p * 4); c.stroke();
      c.globalAlpha = 1;
    }
  }
  c.textAlign = 'center';
  for (const u of Game.units) {
    if (!u.owner || u.inside) continue;
    const H = u.hero, px = u.x * TILE, py = u.y * TILE - 38;
    const col = (classes[H.clsKey] || {}).col || '#f0d890';
    c.font = 'bold 8px sans-serif';
    c.lineWidth = 3; c.strokeStyle = 'rgba(20,12,4,0.9)'; c.strokeText(u.owner, px, py);
    c.fillStyle = col; c.fillText(u.owner, px, py);
    if (u.title) { c.font = 'italic 6px sans-serif'; c.lineWidth = 2; c.strokeText('«' + u.title + '»', px, py - 8); c.fillStyle = '#f0d890'; c.fillText('«' + u.title + '»', px, py - 8); c.font = 'bold 8px sans-serif'; }
    const w = 26, ratio = Math.max(0, Math.min(1, H.hp / H.maxhp));
    c.fillStyle = 'rgba(20,12,4,0.9)'; c.fillRect(px - w / 2 - 1, py + 2, w + 2, 5);
    c.fillStyle = '#4a1612'; c.fillRect(px - w / 2, py + 3, w, 3);
    c.fillStyle = ratio > 0.5 ? '#5ac04a' : ratio > 0.25 ? '#e0b030' : '#e04030';
    c.fillRect(px - w / 2, py + 3, Math.round(w * ratio), 3);
    const bub = Coop.bubbles.get(u.id);
    if (bub && bub.until > Game.time) {
      c.font = 'bold 7px sans-serif';
      const tw = c.measureText(bub.text).width + 8;
      c.fillStyle = 'rgba(250,240,210,0.95)'; c.fillRect(px - tw / 2, py - 20, tw, 11);
      c.strokeStyle = '#3a2a14'; c.lineWidth = 1; c.strokeRect(px - tw / 2 + 0.5, py - 19.5, tw - 1, 10);
      c.fillStyle = '#2a1c0c'; c.fillText(bub.text, px, py - 12);
    }
  }
  c.textAlign = 'start';
}

// ---------- Интерфейс ----------

function coopCss() {
  if (document.getElementById('coop-css')) return;
  const st = document.createElement('style');
  st.id = 'coop-css';
  st.textContent = `
  .cp-modal{overflow:auto;position:fixed;inset:0;background:rgba(8,6,3,.82);z-index:10000;display:flex;align-items:center;justify-content:center;color:#e8dcc0;font-family:inherit}
  .cp-card{box-sizing:border-box;margin:auto;background:#1f1710;border:2px solid #b8902c;border-radius:8px;padding:20px 22px;width:min(560px,94vw);max-height:92vh;overflow:auto;text-align:center}
  .cp-card h2{margin:0 0 6px;color:#f6d458;font-size:20px}.cp-card p{margin:0 0 12px;font-size:13px;opacity:.85}
  .cp-card .cp-nw{margin-top:22px;padding-top:14px;border-top:1px solid #5a4520}.cp-maps{display:flex;flex-wrap:wrap;justify-content:center;gap:2px 4px}
  .cp-cls{display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:8px}
  .cp-c{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:2px;min-width:0;text-align:center;background:#2a2014;border:2px solid var(--c);border-radius:6px;padding:8px 4px;cursor:pointer;color:#f6e8c0;font-size:12px;font-family:inherit}
  .cp-c:hover{background:#3a2c14}.cp-c b{display:block;color:var(--c);font-size:14px;margin-bottom:3px}.cp-c small{opacity:.75;font-size:10px;display:block}
  .cp-btn{margin:8px 4px 0;padding:7px 18px;font-size:14px;background:#8a6a1c;color:#fff4d0;border:1px solid #d8b04a;border-radius:4px;cursor:pointer;font-family:inherit}
  .cp-btn.sec{background:#3a2c14;border-color:#7a5f28}
  #coop-hud{position:absolute;right:10px;bottom:10px;z-index:6;display:flex;flex-direction:column;align-items:flex-end;gap:5px;font-size:12px;color:#f0e4c0;max-width:min(300px,70vw)}
  #coop-hud .cp-row{display:flex;gap:5px}
  #coop-hud button{background:rgba(26,19,13,.9);color:#f6d458;border:1px solid #b8902c;border-radius:5px;padding:4px 9px;cursor:pointer;font-size:12px;font-family:inherit}
  #coop-hud button:hover{background:#3a2c14}
  #cp-vil{background:rgba(26,19,13,.88);border:1px solid #7a5f28;border-radius:5px;padding:4px 8px;text-align:right;line-height:1.35;pointer-events:none}
  #cp-vil:empty{display:none}#cp-vil .ok{color:#9fe070}#cp-vil .lo{opacity:.75}
  #cp-qs{background:rgba(26,19,13,.88);border:1px solid #7a5f28;border-radius:5px;padding:4px 8px;line-height:1.35;max-width:100%;box-sizing:border-box}
  #cp-qs:empty{display:none}#cp-qs .ok{color:#9fe070}#cp-qs .lo{opacity:.7}#cp-qs h4{margin:3px 0 1px;font-size:11px;color:#f6d458;font-weight:bold}
  #cp-qs .cv{display:block;width:100%;text-align:left;margin:2px 0}#cp-qs .cv.my{border-color:#9fe070}
  #cp-log{display:flex;flex-direction:column;gap:2px;align-items:flex-end;pointer-events:none}
  #cp-log div{background:rgba(26,19,13,.85);border-radius:4px;padding:2px 7px;text-shadow:0 1px 1px #000}
  #cp-log b{color:#f6d458}
  #cp-pop{background:rgba(26,19,13,.95);border:1px solid #b8902c;border-radius:6px;padding:8px;display:none;flex-direction:column;gap:5px;min-width:200px}
  #cp-pop.open{display:flex}
  #cp-pop button{text-align:left}
  .cp-inv{display:grid;grid-template-columns:repeat(5,34px);gap:4px}
  .cp-slot{width:34px;height:34px;background:#120d08;border:1px solid #5a4620;border-radius:4px;position:relative;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:9px;color:#f6e8c0;text-align:center;line-height:1}
  .cp-slot.has:hover{border-color:#f6d458}.cp-slot i{position:absolute;right:2px;bottom:1px;font-style:normal;font-size:9px;color:#ffd45a}
  .cp-bar{height:8px;background:#2a1410;border-radius:3px;overflow:hidden;border:1px solid #000}.cp-bar i{display:block;height:100%}
  .cp-sm{font-size:11px;padding:2px 8px;margin:2px 3px 0 0;background:#3a2c14;color:#f6e8c0;border:1px solid #8a6a28;border-radius:4px;cursor:pointer;font-family:inherit}
  `;
  document.head.appendChild(st);
}

function coopPickClass(classes) {
  coopCss();
  document.getElementById('cp-class')?.remove();
  const box = document.createElement('div');
  box.id = 'cp-class'; box.className = 'cp-modal';
  box.innerHTML = `<div class="cp-card"><h2>Кто ты, гном?</h2><p>Первый заход в деревню: выбери класс. Он останется с героем.</p>
    <div class="cp-cls">${Object.entries(classes).map(([k, c]) => `<button class="cp-c" style="--c:${coopEsc(c.col)}" data-cls="${coopEsc(k)}"><img src="${coopEsc(portraitURL('hero_' + k, 7))}" alt="" style="width:48px;height:48px;image-rendering:pixelated;display:block;margin:0 auto 4px"><b>${coopEsc(c.name)}</b>${coopEsc(c.info)}<small>здоровье ${coopEsc(c.hp)}</small></button>`).join('')}</div></div>`;
  document.body.appendChild(box);
  box.addEventListener('click', e => {
    const b = e.target.closest('[data-cls]');
    if (!b) return;
    coopSend({ t: 'class', cls: b.dataset.cls });
    box.remove();
  });
}

const ITEM_NAME = k => (typeof GOODS !== 'undefined' && GOODS[k] ? GOODS[k].name : k);

function coopInvHtml() {
  const me = Coop.me;
  const inv = me ? me.inv : Array(10).fill(null);
  return `<div class="cp-inv">${inv.map((s, i) => s
    ? `<div class="cp-slot has" data-coop="use" data-slot="${i}" title="${coopEsc(ITEM_NAME(s.k))} — клик: съесть, Shift+клик: выбросить">${coopEsc(String(ITEM_NAME(s.k)).slice(0, 5))}<i>${coopEsc(s.n)}</i></div>`
    : '<div class="cp-slot"></div>').join('')}</div>`;
}

function coopPanel() {
  const h = Game.hero, H = h.hero, me = Coop.me || {};
  const cl = ((Coop.meta && Coop.meta.classes) || {})[H.clsKey] || { col: '#f0d890', name: H.cls };
  const hp = Math.round(H.hp), mhp = H.maxhp || 1;
  const food = Math.max(0, Math.min(1, h.food));
  return `<div class="ihead"><img class="bpic" src="${portraitURL('hero', h.look)}" alt=""><div><h3 style="color:${cl.col}">${H.name}</h3>
    <span class="muted small">${cl.name} · уровень ${H.level}</span></div></div>
    <div class="irow">Здоровье <b>${hp}/${mhp}</b></div><div class="cp-bar"><i style="width:${Math.round(100 * hp / mhp)}%;background:#5ac04a"></i></div>
    <div class="irow">Сытость <b>${Math.round(food * 100)}%</b></div><div class="cp-bar"><i style="width:${Math.round(100 * Math.min(1, food))}%;background:#d0a83a"></i></div>
    <div class="irow" style="margin-top:6px">Инвентарь (10)</div>${coopInvHtml()}
    <div class="tip">Клик по земле, стройке, дереву, камню — герой идёт и делает. Клик по трактиру — пойдёт поесть (иногда с пивом…). Строить, класть и сносить дороги могут все, а герой у каждого свой.</div>`;
}

function coopInitHud() {
  coopCss();
  let hud = document.getElementById('coop-hud');
  if (hud) hud.remove();
  hud = document.createElement('div');
  hud.id = 'coop-hud';
  hud.innerHTML = `<div id="cp-vil"></div><div id="cp-qs"></div><div id="cp-log"></div><div id="cp-pop"></div>
    <div class="cp-row"><span id="cp-online" style="align-self:center;background:rgba(26,19,13,.85);padding:3px 7px;border-radius:4px"></span>
    <button data-cp="chat" title="Сказать что-нибудь">Чат</button><button data-cp="inv" title="Инвентарь героя">Рюкзак</button>
    ${Coop.host ? '<button data-cp="restart" title="Только хост">Сервер ⟳</button>' : ''}<button data-cp="leave" title="Выйти из общей деревни">Выйти</button></div>`;
  document.getElementById('view').appendChild(hud);
  hud.addEventListener('click', e => {
    const b = e.target.closest('[data-cp]');
    if (b) {
      const k = b.dataset.cp, pop = document.getElementById('cp-pop');
      if (k === 'chat') {
        pop.innerHTML = Coop.meta.chat.map((t, i) => `<button data-cpchat="${i}">${coopEsc(t)}</button>`).join('');
        pop.classList.toggle('open', !(pop.classList.contains('open') && pop.dataset.k === 'chat')); pop.dataset.k = 'chat';
      } else if (k === 'inv') {
        pop.innerHTML = coopInvHtml();
        pop.classList.toggle('open', !(pop.classList.contains('open') && pop.dataset.k === 'inv')); pop.dataset.k = 'inv';
      } else if (k === 'restart') coopRestartDialog();
      else if (k === 'leave') { if (confirm('Выйти из общей деревни? Герой и рюкзак сохранятся.')) coopLeaveGame(); }
      return;
    }
    const v = e.target.closest('[data-vote]');
    if (v) { coopSend({ t: 'vote', i: +v.dataset.vote }); return; }
    const c = e.target.closest('[data-cpchat]');
    if (c) { coopSend({ t: 'chat', i: +c.dataset.cpchat }); document.getElementById('cp-pop').classList.remove('open'); return; }
    const s = e.target.closest('[data-coop]');
    if (s) coopSlotClick(s, e);
  });
  if (!Coop.docHook) {   // слоты в карточке героя (#hero-card) и в окне здания
    Coop.docHook = true;
    document.addEventListener('click', e => {
      const s = e.target.closest('#hero-card [data-coop], #info [data-coop]');
      if (s && Coop.on) coopSlotClick(s, e);
    });
  }
  coopRefreshHud();
}

function coopSlotClick(el, e) {
  const slot = +el.dataset.slot;
  coopSend({ t: e.shiftKey ? 'drop' : 'use', slot });
}

// Личные и парные задания, Совет деревни (считает сервер, приходит вместе с 'me')
function coopQuestHud(x, title) {
  const el = document.getElementById('cp-qs');
  if (!el || !x) return;
  Coop.qx = x;
  const sig = JSON.stringify([x, title]);
  if (el.dataset.sig === sig) return;
  el.dataset.sig = sig;
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let h = '';
  if (x.c) {
    h += `<h4>Совет деревни · ${x.c.left} с</h4><div>${esc(x.c.q)}</div>`
      + x.c.o.map((l, i) => `<button class="cv${x.c.my === i ? ' my' : ''}" data-vote="${i}">${esc(l)} <b>${x.c.v[i]}</b></button>`).join('');
  }
  if (x.q.length) {
    h += '<h4>Задания дня' + (title ? ` · «${esc(title)}»` : '') + '</h4>'
      + x.q.map(q => `<div class="${q.d ? 'ok' : ''}">${q.d ? '✔' : '•'} ${esc(q.t)}${q.need > 1 && !q.d ? ` <b>${q.n}/${q.need}</b>` : ''}${q.h ? ` <span class="lo">· ${esc(q.h)}</span>` : ''}</div>`).join('');
  }
  if (x.p) {
    h += `<h4>Вдвоём с ${esc(x.p.w)}${x.p.on ? '' : ' (не в сети)'}</h4><div class="${x.p.d ? 'ok' : ''}">${x.p.d ? '✔ ' : ''}${esc(x.p.t)}${x.p.prog != null ? ` <b>${x.p.prog}%</b>` : ''}</div>`
      + `<div class="lo">${esc(x.p.x)} · побратимство ${x.p.fr}/5</div>`;
  }
  el.innerHTML = h;
}

// «Заказ деревни» и серия ночей без потерь (считает сервер, приходит вместе с 'me')
function coopVilHud(v) {
  const el = document.getElementById('cp-vil');
  if (!el || !v) return;
  const q = v.q, e = coopEsc, tm = q ? `${Math.floor(q.left / 60)}:${String(q.left % 60).padStart(2, '0')}` : '';
  el.innerHTML = (q ? `<div>${q.done ? '<span class="ok">Заказ выполнен</span>' : 'Заказ деревни'}: ${e(String(q.w).toLowerCase())} «${e(q.g)}» <b>${e(q.have)}/${e(q.need)}</b>${q.done ? '' : ` <span class="lo">· до вечера ${e(tm)} · +${e(q.rw)} зол.</span>`}</div>` : '')
    + `<div class="lo">Ночей без потерь подряд: <b>${e(v.st)}</b> · рекорд ${e(v.best)}${Array.isArray(v.hero) && v.hero.length ? ' · герои ночи: ' + v.hero.map(h => e(h[0]) + ' ×' + e(h[1])).join(', ') : ''}</div>`;
}

function coopRefreshHud() {
  if (!Coop.on) return;
  const on = document.getElementById('cp-online');
  if (on) on.textContent = 'В деревне: ' + Game.units.filter(u => u.owner).map(u => u.owner).join(', ');
  const pop = document.getElementById('cp-pop');
  if (pop && pop.classList.contains('open') && pop.dataset.k === 'inv') pop.innerHTML = coopInvHtml();
  const lg = document.getElementById('cp-log');
  if (lg) {
    const now = Date.now();
    lg.innerHTML = Coop.chatLog.filter(m => now - m.at < 12000).slice(-5).map(m => `<div><b>${coopEsc(m.from)}:</b> ${coopEsc(m.text)}</div>`).join('');
  }
  if (Game.selUnit && Game.selUnit === Game.hero) updateUI(true);
}
setInterval(() => { if (Coop.on) coopRefreshHud(); }, 1000);

function coopRestartDialog() {
  if (!Coop.host) { toast('Перезапустить сервер может только хост'); return; }
  const box = document.createElement('div');
  box.className = 'cp-modal';
  box.innerHTML = `<div class="cp-card"><h2>Перезапустить сервер?</h2><p>Мир сохранится, все игроки на несколько секунд отвалятся и переподключатся сами.</p>
    <button class="cp-btn" data-y>Перезапустить</button><button class="cp-btn sec" data-n>Отмена</button>
    <h2 class="cp-nw">Новый мир</h2><p>Текущий мир уйдёт в архив на сервере, деревня начнётся заново. Свои карты — из «Редактора карт» на этом устройстве.</p>
    <div class="cp-maps"></div><div data-ask hidden><p></p><button class="cp-btn" data-go>Да, начать заново</button></div></div>`;
  const list = box.querySelector('.cp-maps');
  const pick = (label, map) => {
    const b = document.createElement('button');
    b.className = 'cp-btn sec';
    b.textContent = label;   // имя карты — только текстом
    b.addEventListener('click', () => {
      if (map) { const v = meValidate(map); if (v.errors.length) { toast('Карта не готова: ' + v.errors[0]); return; } }
      const ask = box.querySelector('[data-ask]');
      ask.hidden = false;
      ask.querySelector('p').textContent = 'Начать новый мир: ' + label + '?';
      ask.querySelector('[data-go]').onclick = () => { coopSend({ t: 'newworld', confirm: true, map: map ? meEncode(map) : null }); box.remove(); };
    });
    list.appendChild(b);
  };
  pick('Обычная карта', null);
  if (typeof meList === 'function') for (const e of meList()) pick('🗺 ' + e.map.name, e.map);
  document.body.appendChild(box);
  box.addEventListener('click', e => {
    if (e.target.closest('[data-y]')) { coopSend({ t: 'restart', confirm: true }); box.remove(); }
    else if (e.target.closest('[data-n]') || e.target === box) box.remove();
  });
}

function coopLeaveGame() {
  const ws = Coop.ws;
  Coop.on = false; Coop.reconnecting = false; Coop.ws = null; Game.coop = false;
  try { ws && ws.close(); } catch (e) { /* ничего */ }
  location.reload();
}

// ---------- Обрыв связи ----------

function coopLost() {
  if (!Coop.on) return;
  Coop.on = false;
  coopSaveCopyNow();
  document.getElementById('coop-hud')?.remove();
  const retry = true;
  const box = document.createElement('div');
  box.id = 'cp-lost'; box.className = 'cp-modal';
  const kicked = Coop.kicked;
  Coop.kicked = null;
  box.innerHTML = `<div class="cp-card"><h2>${kicked ? 'Герой ушёл в другое окно' : Coop.reconnecting ? 'Сервер перезапускается' : 'Связь потерялась'}</h2>
    <p id="cp-lost-msg">${kicked ? kicked + '. Нажмите «Попробовать сейчас», чтобы играть здесь.' : 'Переподключаемся сами… Копия общего мира лежит у вас в браузере: пока сервер молчит, можно поиграть с ней в одиночку.'}</p>
    <button class="cp-btn" data-re>Попробовать сейчас</button><button class="cp-btn sec" data-solo>Играть с копией одиночно</button></div>`;
  document.body.appendChild(box);
  const msg = box.querySelector('#cp-lost-msg');
  let stop = false;
  let busy = false;
  const tryAgain = () => {
    if (stop || busy) return;
    busy = true;
    msg.textContent = 'Подключаемся…';
    // токен в браузере один на всех: годится, только если он от этого же героя (в соседней вкладке мог войти другой)
    const sv = coopSaved(), cr = Coop.creds, nick = Coop.nick || cr.nick;
    const opts = sv && sv.token && sv.nick === nick ? { server: cr.server, nick, token: sv.token, mode: 'token' }
      : cr.pass ? { server: cr.server, nick, pass: cr.pass, mode: 'login' } : null;
    if (!opts) { busy = false; stop = true; msg.textContent = 'Войдите заново через меню (Выйти → Общая деревня).'; return; }
    coopConnect(opts).then(() => { stop = true; Coop.reconnecting = false; box.remove(); }).catch(e => {
      busy = false;
      msg.textContent = e.message;
      if (!stop && !Coop.kicked) setTimeout(tryAgain, 3000);
    });
  };
  box.addEventListener('click', e => {
    if (e.target.closest('[data-re]')) tryAgain();
    else if (e.target.closest('[data-solo]')) { stop = true; box.remove(); coopPlayCopy(); }
  });
  if (!kicked) setTimeout(tryAgain, 2000);
}
function coopSaveCopyNow() { Coop.on = true; coopSaveCopy(); Coop.on = false; }

// Копия общего мира как одиночная игра: чужие герои уходят, остаётся свой
function coopPlayCopy() {
  Game.coop = false; Coop.on = false;
  if (!loadGame(COOP_SLOT)) { toast('Копии мира нет'); return false; }
  Coop.mirror = false;
  const nick = (saveMeta(COOP_SLOT) || {}).nick || Coop.nick;
  const heroes = Game.units.filter(u => u.type === 'hero');
  const mine = heroes.find(u => u.hero && u.hero.owner === nick) || heroes[0];
  for (const u of heroes) if (u !== mine) { u.dead = true; u.proc = null; }
  purgeDead();
  Game.hero = mine || null;
  Game.heroAsk = false;
  if (mine) {
    mine.hero.name = mine.hero.name || nick;
    if (Coop.me && Coop.me.inv) mine.hero.inv = Coop.me.inv.map(s => (s ? { k: s.k, n: s.n } : null));   // рюкзак уходит с героем
    heroDefaults(mine.hero);
    selectHero(true);
  }
  Game.paused = false; Game.speed = 1;
  updateUI(true);
  toast('Копия общего мира: теперь это одиночная игра');
  return true;
}

// ---------- Меню: вход, регистрация, копия мира ----------

{
  StartMenu.onConnect = ({ nick, server }) => {
    const pass = (document.getElementById('sm-pass') || {}).value || '';
    const mode = Coop.regMode ? 'register' : 'login';
    Coop.regMode = false;
    if (!pass) return Promise.reject(new Error('Введите пароль'));
    return coopConnect({ nick, server: Coop.served ? coopOrigin() : server, pass, mode });
  };

  // адрес по умолчанию: общий сервер игры (COOP_SERVER / ?server=), иначе тот, с которого открыта страница
  let srv0 = null;
  const coopFillServer = () => {
    const srv = document.getElementById('sm-server');
    if (!srv || (srv.value && srv.value !== 'ws://localhost:8787')) return;
    const def = coopDefaultServer();
    if (def) srv.value = def;
    else if (location.protocol.startsWith('http') && location.host) srv.value = coopOrigin();
  };
  const _smr = smRender;
  smRender = function () { _smr(); coopFillServer(); };

  const _start = startGame;
  startGame = function () {
    _start();
    const root = document.getElementById('start-menu');
    if (!root) return;
    const mp = root.querySelector('[data-panel="mp"]');
    if (mp && !document.getElementById('sm-pass')) {
      const lab = document.createElement('label');
      lab.innerHTML = 'Пароль<input id="sm-pass" type="password" maxlength="64" autocomplete="current-password" placeholder="Для входа и сохранения героя">';
      mp.querySelector('label:nth-of-type(2)').insertAdjacentElement('afterend', lab);
      const reg = document.createElement('button');
      reg.className = 'sm-btn'; reg.dataset.smReg = '1';
      reg.innerHTML = '<b>Зарегистрироваться</b><small>новый игрок на этом сервере</small>';
      mp.querySelector('[data-sm="connect"]').insertAdjacentElement('afterend', reg);
      reg.addEventListener('click', () => { Coop.regMode = true; mp.querySelector('[data-sm="connect"]').click(); });
      mp.querySelector('[data-sm="connect"] b').textContent = 'Войти';
      srv0 = root.querySelector('#sm-server');
      if (srv0) srv0.placeholder = 'wss://адрес или 1.2.3.4:8787';
    }
    coopFillServer();
    const main = root.querySelector('[data-panel="main"]');
    if (main && !main.querySelector('[data-sm-coop]')) {
      const meta = saveMeta(COOP_SLOT);
      if (meta) {
        const b = document.createElement('button');
        b.className = 'sm-btn'; b.dataset.smCoop = '1';
        b.innerHTML = `<b>Копия общего мира</b><small>${Math.floor(meta.time / 60)} мин · ${meta.people} жит. · на случай, когда сервер выключен</small>`;
        smSubAdd(b);
        b.addEventListener('click', () => smClose(() => coopPlayCopy()));
      }
    }
  };
}

// ---------- Облик героя по классу: шлем воина, рога варвара, колпак мага… ----------
// Те же гномы из people.js, только с другим снаряжением: OUTFIT.hero_<класс> и своя шапка в drawCap.

Object.assign(OUTFIT, {
  hero_warrior:   { cap: 'cls:warrior',   pants: '#3a3632', coat: '#6a6a76', vest: '#9aa0aa', rivets: true, belt: 'hammer' },
  hero_barbarian: { cap: 'cls:barbarian', pants: '#5a3a22', coat: '#8a5a2a', vest: '#b08a5a', belt: 'axe' },
  hero_mage:      { cap: 'cls:mage',      pants: '#22284a', robe: true, robeCol: '#2c4a9a', staff: true },
  hero_archer:    { cap: 'cls:archer',    pants: '#4a3a24', coat: '#3a7a2a', vest: '#6a4a28', belt: 'hammer' },
  hero_druid:     { cap: 'cls:druid',     pants: '#3a3a20', robe: true, robeCol: '#4e6a2a', staff: true },
  hero_rogue:     { cap: 'cls:rogue',     pants: '#1e1e26', coat: '#2e2e3a', vest: '#44445a' },
  hero_monk:      { cap: 'cls:monk',      pants: '#5a3a1c', robe: true, robeCol: '#c8641a' },
  hero_priest:    { cap: 'cls:priest',    pants: '#6a6458', robe: true, robeCol: '#e4e0d2', staff: true },
  hero_paladin:   { cap: 'cls:paladin',   pants: '#3a3632', coat: '#e0dcd0', vest: '#c8ccd4', rivets: true, belt: 'hammer' },
  hero_bard:      { cap: 'cls:bard',      pants: '#3a2a4a', coat: '#b03a7a', vest: '#f0c860' },
});

function coopHat(c, kind, view, hx, hy, tipSway) {
  const b = hy - 1.1, e = view === 'E', x0 = e ? hx + 0.6 : hx;
  const dome = (w, top, col, rim) => {
    c.beginPath(); c.moveTo(x0 - w, b + 0.8); c.quadraticCurveTo(x0 - w, b - top, x0, b - top); c.quadraticCurveTo(x0 + w, b - top, x0 + w, b + 0.8); c.closePath();
    c.fillStyle = lingrad(c, x0 - w, 0, x0 + w, 0, [[0, shade(col, 0.3)], [0.5, col], [1, shade(col, -0.4)]]); c.fill();
    c.strokeStyle = shade(col, -0.5); c.lineWidth = 0.35; c.stroke();
    if (rim) { rrect(c, x0 - w - 0.4, b - 0.6, w * 2 + 0.8, 2.2, 1); c.fillStyle = rim; c.fill(); }
  };
  if (kind === 'warrior') {
    dome(4.6, 7, '#aab0ba', '#7a808c');
    if (view === 'S') { c.fillStyle = '#8a909c'; c.fillRect(x0 - 0.6, b + 0.8, 1.2, 3.2); }
    ellipse(c, x0 + (e ? -1 : 0), b - 8, 1.3, 2.4, '#c8302a');
    if (e) poly(c, [[x0 - 1, b - 8], [x0 - 5, b - 5 + tipSway * 0.3], [x0 - 2, b - 6.4]], '#c8302a');
  } else if (kind === 'barbarian') {
    dome(4.5, 6, '#7a6a58', '#4a3a2a');
    for (const s of [-1, 1]) {
      if (e && s > 0) continue;
      poly(c, [[x0 + s * 4, b - 0.4], [x0 + s * 6.8, b - 2.4], [x0 + s * 6.6, b - 7], [x0 + s * 5.2, b - 4.4], [x0 + s * 3.4, b - 3]], '#eee2c4', '#a89870', 0.3);
    }
    c.fillStyle = '#5a4630'; c.fillRect(x0 - 4, b - 1.2, 8, 0.7);
  } else if (kind === 'mage') {
    ellipse(c, x0, b + 0.5, 6.6, 1.8, '#1c2c66');
    c.beginPath(); c.moveTo(x0 - 4.3, b); c.quadraticCurveTo(x0 - 2.5, b - 8, x0 + 2.5 + tipSway * 0.3, b - 14.5); c.quadraticCurveTo(x0 + 3.6, b - 6, x0 + 4.3, b); c.closePath();
    c.fillStyle = lingrad(c, x0 - 4, 0, x0 + 4, 0, [[0, '#4a6ac0'], [0.5, '#2c4a9a'], [1, '#18286a']]); c.fill();
    c.fillStyle = '#c89226'; c.fillRect(x0 - 4.2, b - 1.4, 8.4, 0.9);
    c.fillStyle = '#f6d458'; c.fillRect(x0 - 1, b - 5, 0.8, 0.8); c.fillRect(x0 + 1, b - 9, 0.7, 0.7); c.fillRect(x0 - 0.2, b - 11.5, 0.6, 0.6);
  } else if (kind === 'archer') {
    capShape(c, x0, b, e ? -1 : 1, 8.5, 3);
    c.fillStyle = lingrad(c, x0 - 4, 0, x0 + 5, 0, [[0, '#6aaa4a'], [0.5, '#3a7a2a'], [1, '#1e4a16']]); c.fill();
    rrect(c, x0 - 4.9, b - 1.2, 9.8, 2.6, 1.3); c.fillStyle = '#2e5a1e'; c.fill();
    poly(c, [[x0 + 3, b - 3], [x0 + 8, b - 9], [x0 + 6.4, b - 4.6]], '#f4f0e4', '#b8a888', 0.3);
    line(c, x0 + 3, b - 3, x0 + 7.6, b - 8.4, '#c8302a', 0.5);
  } else if (kind === 'druid') {
    dome(4.5, 5, '#6a5230', '#4a3820');
    for (const s of [-1, 1]) {
      c.strokeStyle = '#8a6a3a'; c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(x0 + s * 2.4, b - 4); c.lineTo(x0 + s * 3.4, b - 8); c.lineTo(x0 + s * 5, b - 11); c.moveTo(x0 + s * 3.4, b - 8); c.lineTo(x0 + s * 2.4, b - 11); c.stroke();
    }
    for (let k = 0; k < 6; k++) ellipse(c, x0 - 4.2 + k * 1.7, b - 0.2 + (k % 2) * 0.5, 1.1, 0.8, k % 2 ? '#6aaa3a' : '#4a8a2a');
  } else if (kind === 'rogue') {
    c.beginPath(); c.moveTo(x0 - 4.9, b + 3); c.quadraticCurveTo(x0 - 5.4, b - 3, x0 - 3.4, b - 6.5); c.quadraticCurveTo(x0, b - 9, x0 + 3.4, b - 6.5);
    c.quadraticCurveTo(x0 + 5.4, b - 3, x0 + 4.9, b + 3); c.lineTo(x0 + 3, b + 1); c.quadraticCurveTo(x0, b - 0.6, x0 - 3, b + 1); c.closePath();
    c.fillStyle = lingrad(c, x0 - 5, 0, x0 + 5, 0, [[0, '#4a4a5a'], [0.5, '#2a2a34'], [1, '#14141a']]); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(x0 - 3.4, b - 0.2, 6.8, 1);
  } else if (kind === 'monk') {
    rrect(c, x0 - 4.8, b - 1.4, 9.6, 1.8, 0.9); c.fillStyle = '#d8501a'; c.fill();
    poly(c, [[x0 + 4.4, b - 0.6], [x0 + 7, b + 1.4 + tipSway * 0.2], [x0 + 5, b + 0.2]], '#d8501a');
    c.fillStyle = '#f6d458'; c.fillRect(x0 - 0.5, b - 1.2, 1, 1);
  } else if (kind === 'priest') {
    c.beginPath(); c.moveTo(x0 - 4.3, b); c.quadraticCurveTo(x0 - 3.4, b - 7, x0, b - 12); c.quadraticCurveTo(x0 + 3.4, b - 7, x0 + 4.3, b); c.closePath();
    c.fillStyle = lingrad(c, x0 - 4, 0, x0 + 4, 0, [[0, '#ffffff'], [1, '#c8c4b8']]); c.fill();
    c.strokeStyle = '#c89226'; c.lineWidth = 0.4; c.stroke();
    c.fillStyle = '#d8a828'; c.fillRect(x0 - 0.3, b - 9, 0.7, 4.4); c.fillRect(x0 - 1.4, b - 7.6, 2.9, 0.7); c.fillRect(x0 - 4.4, b - 1.2, 8.8, 0.9);
  } else if (kind === 'paladin') {
    // светлый шлем с золотым гребнем-пламенем: Клятва Костра
    dome(4.6, 7, '#dcdce4', '#a8a070');
    if (view === 'S') { c.fillStyle = '#c8a040'; c.fillRect(x0 - 2.2, b + 0.6, 4.4, 0.7); c.fillRect(x0 - 0.35, b - 4, 0.7, 4.6); }
    poly(c, [[x0 - 1.4, b - 6.6], [x0 - 0.4 + tipSway * 0.2, b - 11], [x0 + 0.4, b - 8.6], [x0 + 1.2 + tipSway * 0.3, b - 10.4], [x0 + 1.6, b - 6.6]], '#ffb030', '#c86a1a', 0.3);
    ellipse(c, x0, b - 7.4, 0.9, 1.2, '#ffe070');
  } else if (kind === 'bard') {
    // берет набок с длинным пером: Клятва Песни
    ellipse(c, x0 + 0.6, b - 1.6, 5.4, 2.4, '#b03a7a');
    ellipse(c, x0 + 0.2, b - 2.4, 4.2, 1.5, '#d05a98');
    c.fillStyle = '#f0c860'; c.fillRect(x0 - 4.4, b - 0.8, 8.8, 0.8);
    c.strokeStyle = '#f4f0e4'; c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(x0 + 2.4, b - 2.8); c.quadraticCurveTo(x0 + 6, b - 6, x0 + 4.6 + tipSway * 0.4, b - 10.5); c.stroke();
    c.strokeStyle = '#3aa0c8'; c.lineWidth = 0.4;
    c.beginPath(); c.moveTo(x0 + 2.6, b - 2.8); c.quadraticCurveTo(x0 + 5.6, b - 6, x0 + 4.6 + tipSway * 0.4, b - 10.2); c.stroke();
  }
}

{
  const _cap = drawCap;
  drawCap = function (c, O, view, hx, hy, tipSway, L, r) {
    if (typeof O.cap === 'string' && O.cap.startsWith('cls:')) coopHat(c, O.cap.slice(4), view, hx, hy, tipSway);
    else _cap(c, O, view, hx, hy, tipSway, L, r);
  };
  const _ps = personSprite;
  personSprite = function (u, view, pose, frame, opt) {
    const k = u.type === 'hero' && u.hero && u.hero.clsKey;
    if (k && OUTFIT['hero_' + k]) {
      const sh = { type: 'hero_' + k, look: u.look, carry: u.carry, injury: u.injury, _spr: u._spr };
      const cv = _ps(sh, view, pose, frame, opt);
      u._spr = cv;
      return cv;
    }
    return _ps(u, view, pose, frame, opt);
  };
  const _pu = portraitURL;
  portraitURL = function (type, look) {
    if (type === 'hero' && Coop.on && Game.hero && Game.hero.hero && Game.hero.hero.clsKey) type = 'hero_' + Game.hero.hero.clsKey;
    return _pu(type, look);
  };
}


// ---------- Кнопки окон: действия уходят серверу, а не меняют зеркало ----------

function coopInitControls() {
  if (Coop.ctl) return;
  Coop.ctl = true;
  const stop = e => { e.stopImmediatePropagation(); e.preventDefault(); };
  const act = (b, a, extra) => coopSend(Object.assign({ t: 'bact', id: b.id, act: a }, extra));
  // окно здания
  document.getElementById('info').addEventListener('click', e => {
    if (!Coop.on) return;
    const t = e.target.closest('button, [data-untrain-at], [data-block]');
    const b = Game.selected;
    if (!t || !b || b.removed) return;
    const a = t.dataset.act;
    if (a === 'goto' || a === 'prev' || a === 'next') return;      // только осмотр — оставляем как есть
    if (t.dataset.hero !== undefined || t.dataset.coop !== undefined) return;
    stop(e);
    if (t.dataset.train) act(b, 'train', { type: t.dataset.train });
    else if (t.dataset.untrainAt) act(b, 'untrain', { i: +t.dataset.untrainAt });
    else if (a === 'demolish') {
      if (b.isRoad) coopSend({ t: 'erase', cells: [[b.x, b.y]] });
      else if (b.state !== 'done' || confirm('Снести «' + b.def.name + '»? Деревня общая — другие игроки это увидят.')) act(b, 'demolish');
      Game.selected = null;
    } else if (a) act(b, a);
    else if (t.dataset.block) act(b, 'block', { g: t.dataset.block });
    updateUI(true);
  }, true);
  document.getElementById('info').addEventListener('change', e => {
    if (!Coop.on) return;
    const t = e.target, b = Game.selected;
    if (!b) return;
    if (t.dataset.recipe !== undefined) { stop(e); act(b, 'recipe', { i: +t.dataset.recipe, on: t.checked }); }
    else if (t.dataset.crop) { stop(e); act(b, 'crop', { c: t.dataset.crop, on: t.checked }); }
  }, true);
  document.getElementById('store-list').addEventListener('click', e => {
    const s = Coop.on && e.target.closest('[data-block]');
    if (!s) return;
    stop(e);
    const b = Game.buildings.find(x => x.isStore && x.isStore()) || Game.buildings[0];
    if (b) coopSend({ t: 'bact', id: b.id, act: 'block', g: s.dataset.block });
  }, true);
  document.getElementById('people-list').addEventListener('click', e => {
    const t = Coop.on && e.target.closest('[data-train]');
    if (t) { stop(e); coopSend({ t: 'qt', type: t.dataset.train }); }
  }, true);
  document.getElementById('tab-menu').addEventListener('click', e => {
    const t = Coop.on && e.target.closest('[data-menu]');
    if (!t) return;
    if (['new', 'load', 'loadauto', 'stress', 'hour', 'entdemo', 'entrock', 'entwater', 'entgroup', 'entwin'].includes(t.dataset.menu)) { stop(e); toast('В общей деревне это недоступно'); }
  }, true);
  // горячие клавиши здания: пауза (P) и доставки (B)
  window.addEventListener('keydown', e => {
    if (!Coop.on || (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName))) return;
    const b = Game.selected;
    if (!b || b.isRoad || b.state !== 'done') return;
    if (e.code === 'KeyP') { stop(e); act(b, 'pause'); }
    else if (e.code === 'KeyB' && (b.def.inputs || b.isStore())) { stop(e); act(b, 'deliver'); }
  }, true);
}


// ---------- Удобство: тап по земле ведёт героя, кнопка «Общая деревня», подсказка новичку ----------

{
  const _click = onLeftClickTile;
  onLeftClickTile = function (t) {
    const h = Game.hero;
    if (Coop.on && typeof wkTapUnit === 'function' && wkTapUnit(t)) return;   // тап по гному — карточка рабочего (workers.js)
    if (Coop.on && h && !Game.tool && inb(t[0], t[1])) {
      const b = buildingAt(t);
      const inn = b && !b.isRoad && b.type === 'inn' && b.state === 'done' && !b.upg;
      const nearHero = Math.hypot(h.x - (t[0] + 0.5), h.y - (t[1] + 0.5)) < 0.8;
      if (!nearHero && (inn || (!b && !Game.roadSites.get(idx(t[0], t[1]))))) {
        const c = resolveCmd(t);
        if (c) {
          issueCmd(h, c);
          if (c.kind !== 'move') floater(c.tx + 0.5, c.ty - 0.4, c.label, '#f6d458');
          coopHintDone();
          return;
        }
        toast('Сюда не пройти');
        return;
      }
    }
    _click(t);
  };
}

function coopHintDone() {
  const el = document.getElementById('cp-hint');
  if (el) el.remove();
  try { localStorage.setItem('feod.coop.hint', '1'); } catch (e) { /* нет хранилища */ }
}

function coopHint() {
  try { if (localStorage.getItem('feod.coop.hint')) return; } catch (e) { /* покажем */ }
  if (document.getElementById('cp-hint')) return;
  const tap = Mobile.on ? 'Тапните' : 'Кликните';
  const el = document.createElement('div');
  el.id = 'cp-hint';
  el.innerHTML = `<b>Добро пожаловать в общую деревню!</b>
    <div>1. ${tap} по земле — ваш герой пойдёт туда. По дереву или камню — будет работать.</div>
    <div>2. ${tap} по трактиру — герой пойдёт поесть (а иногда и выпить…).</div>
    <div>3. Кнопка с молотком — стройте дома и дороги вместе с остальными.</div>
    <button class="cp-btn" style="margin:6px 0 0">Понятно</button>`;
  el.querySelector('button').onclick = coopHintDone;
  document.getElementById('view').appendChild(el);
}

{
  const css = document.createElement('style');
  css.textContent = `
  #cp-hint{position:absolute;left:50%;bottom:64px;transform:translateX(-50%);z-index:7;width:min(340px,92vw);background:rgba(26,19,13,.96);border:2px solid #b8902c;border-radius:8px;padding:10px 12px;color:#f0e4c0;font-size:13px;line-height:1.35;box-shadow:0 4px 18px rgba(0,0,0,.6)}
  #cp-hint b{display:block;color:#f6d458;margin-bottom:4px;font-size:14px}#cp-hint div{margin:2px 0}
  body.mobile #coop-hud{bottom:calc(118px + env(safe-area-inset-bottom));right:6px;max-width:64vw}
  body.mobile #cp-hint{bottom:auto;top:96px}
  body.mobile #coop-hud button{padding:7px 10px;font-size:13px}
  body.mobile #cp-online{display:none}
  .cp-modal .cp-btn{min-height:40px}`;
  document.head.appendChild(css);

  const _start3 = startGame;
  startGame = function () {
    _start3();
    // на странице, открытой с сервера кооператива, «Общая деревня» — первая кнопка меню
    // на странице, открытой не с сервера (GitHub Pages), — то же самое для общего сервера по умолчанию
    const info = url => fetch(url, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(j => (j && j.coop ? j : null)).catch(() => null);
    const remote = coopDefaultServer();
    const canRemote = remote && !(location.protocol === 'https:' && remote.startsWith('ws://'));
    info('coop-info').then(j => {
      if (j) { Coop.served = true; Coop.target = coopOrigin(); return j; }
      if (!canRemote) return null;
      return info(coopHttpUrl(remote) + '/coop-info').then(r => { if (r) Coop.target = remote; return r; });
    }).then(j => {
      const root = document.getElementById('start-menu');
      if (!j || !root || root.querySelector('[data-sm-join]')) return;
      const main = root.querySelector('[data-panel="main"]');
      const saved = coopSaved();
      const b = document.createElement('button');
      b.className = 'sm-btn primary'; b.dataset.smJoin = '1';
      b.innerHTML = `<b>Общая деревня</b><small>онлайн: ${coopEsc(j.online)}${saved ? ' · войти как ' + coopEsc(saved.nick) : ' · вход и регистрация'}</small>`;
      smSubAdd(b, true);
      b.addEventListener('click', () => {
        const sv = coopSaved();
        if (!sv || !sv.token) { smRender(); smShow('mp'); return; }
        const small = b.querySelector('small'); small.textContent = 'подключаемся…';
        coopConnect({ server: Coop.target, nick: sv.nick, token: sv.token, mode: 'token' })
          .then(() => smClose())
          .catch(e => { small.textContent = e.message; setTimeout(() => { smRender(); smShow('mp'); }, 1200); });
      });
      const srv = root.querySelector('#sm-server');
      if (srv && Coop.served) { srv.value = coopOrigin(); const lab = srv.closest('label'); if (lab) lab.style.display = 'none'; }
      if (typeof decorateVines === 'function') requestAnimationFrame(decorateVines);
    }).catch(() => { /* страница не с сервера кооператива — обычное меню */ });
  };
  const _init3 = coopApplyInit;
  coopApplyInit = function (m) { _init3(m); setTimeout(coopHint, 900); };
}


// ---------- Админ-панель хоста: что разрешено игрокам ----------
// Серая кнопка — запрещено, зелёная с растущей лозой — разрешено. Права хранит и проверяет сервер.

function coopAdminCss() {
  if (document.getElementById('cp-admin-css')) return;
  const st = document.createElement('style');
  st.id = 'cp-admin-css';
  st.textContent = `
  .cp-adm{display:flex;flex-direction:column;gap:15px;margin:10px 0 4px;text-align:left}
  .cp-tg{position:relative;display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;box-sizing:border-box;min-height:46px;padding:8px 14px;border-radius:7px;cursor:pointer;
    font-family:inherit;font-size:14px;text-align:left;transition:background .35s,border-color .35s,color .35s;
    background:linear-gradient(#4a4640,#34312c);border:2px solid #6a655c;color:#a8a296}
  .cp-tg .cp-st{font-size:11px;letter-spacing:.06em;text-transform:uppercase;opacity:.85;position:relative;z-index:4}
  .cp-tg .cp-nm{position:relative;z-index:4}
  .cp-tg.on{background:linear-gradient(#4f8a2c,#2f5a1a);border-color:#9ad05a;color:#f4ffe0;box-shadow:0 0 12px rgba(120,200,60,.35)}
  .cp-tg:active{transform:translateY(1px)}
  .cp-tg svg.sm-vine{display:none}
  .cp-tg.on svg.sm-vine{display:block;animation:cp-vine-grow .9s ease-out both,cp-vine-sway 4.5s ease-in-out .9s infinite;transform-origin:0 100%}
  @keyframes cp-vine-grow{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(-20px -20px -20px -20px)}}
  @keyframes cp-vine-sway{0%,100%{transform:rotate(0) }50%{transform:rotate(.6deg) translateY(-.5px)}}
  .cp-adm-bar{display:flex;gap:8px;justify-content:center;margin-top:8px}`;
  document.head.appendChild(st);
}

function coopAdminRender(box) {
  const labels = Coop.permLabels || {}, perms = Coop.perms || {};
  const list = box.querySelector('.cp-adm');
  list.innerHTML = Object.keys(labels).map(k =>
    `<button class="cp-tg${perms[k] ? ' on' : ''}" data-perm="${coopEsc(k)}"><span class="cp-nm">${coopEsc(labels[k])}</span><span class="cp-st">${perms[k] ? 'можно' : 'нельзя'}</span></button>`).join('');
  list.querySelectorAll('.cp-tg.on').forEach((b, i) => {
    if (typeof vineSVG === 'function') b.insertAdjacentHTML('beforeend', vineSVG(b.offsetWidth || 300, b.offsetHeight || 46, ['hops', 'grape', 'wheat'][i % 3], 11 + i * 7));
  });
}

// сложность общей деревни: выбирает хост, считает сервер (ночи, голод, нейтралы)
function coopDiffRender(box) {
  const el = box.querySelector('.cp-diff');
  if (!el) return;
  el.innerHTML = '<div class="cp-nm" style="margin:6px 0 4px">Сложность деревни</div><div class="cp-adm-bar" style="margin:0 0 10px">' + DIFF_ORDER.map(k =>
    `<button class="cp-btn${Game.diff === k ? '' : ' sec'}" data-diff="${k}" title="${DIFFS[k].desc}">${DIFFS[k].name}</button>`).join('') + '</div>';
}

function coopAdminOpen() {
  if (!Coop.host) { toast('Права меняет только хост'); return; }
  coopCss(); coopAdminCss();
  document.getElementById('cp-admin')?.remove();
  const box = document.createElement('div');
  box.id = 'cp-admin'; box.className = 'cp-modal';
  box.innerHTML = `<div class="cp-card"><h2>Что можно игрокам</h2><p>Нажмите — переключите. Зелёное разрешено, серое запрещено. Вам (хосту) можно всегда, а герой у каждого свой.</p>
    <div class="cp-diff"></div>
    <div class="cp-adm"></div>
    <div class="cp-adm-bar"><button class="cp-btn sec" data-all="1">Разрешить всё</button><button class="cp-btn sec" data-all="0">Запретить всё</button><button class="cp-btn sec" data-stats>Статистика</button><button class="cp-btn" data-close>Готово</button></div></div>`;
  document.body.appendChild(box);
  coopAdminRender(box);
  coopDiffRender(box);
  box.addEventListener('click', e => {
    const d = e.target.closest('[data-diff]');
    if (d) { coopSend({ t: 'setdiff', k: d.dataset.diff }); return; }
    const t = e.target.closest('.cp-tg');
    if (t) { coopSend({ t: 'setperm', key: t.dataset.perm, on: !Coop.perms[t.dataset.perm] }); return; }
    const all = e.target.closest('[data-all]');
    if (all) { for (const k of Object.keys(Coop.permLabels)) coopSend({ t: 'setperm', key: k, on: all.dataset.all === '1' }); return; }
    if (e.target.closest('[data-stats]')) { coopSend({ t: 'stats' }); return; }
    if (e.target.closest('[data-close]') || e.target === box) box.remove();
  });
}

{
  const _h = coopHandle;
  coopHandle = function (m) {
    if (m.t === 'stats') { coopStatsShow(m.s, m.server); return; }
    if (m.t === 'tempo') { Coop.tempo = { speed: m.speed, paused: m.paused, votes: m.votes, need: m.need }; tempoShow(); return; }
    if (m.t === 'prio') { prioApply(m.p); updateUI(true); return; }
    if (m.t === 'wk') { wkApply(m); updateUI(true); return; }
    if (m.t === 'un') { if (typeof unApply === 'function') unApply(m); return; }
    if (m.t === 'diff') {
      Game.diff = diffKey(m.k);
      toast('Сложность деревни: ' + dif().name);
      const box = document.getElementById('cp-admin');
      if (box) coopDiffRender(box);
      return;
    }
    if (m.t === 'perms') {
      Coop.perms = m.perms;
      const box = document.getElementById('cp-admin');
      if (box) coopAdminRender(box);
      return;
    }
    _h(m);
  };
  const _ih = coopInitHud;
  coopInitHud = function () {
    _ih();
    const row = document.querySelector('#coop-hud .cp-row');
    if (Coop.host && row && !row.querySelector('[data-cp="admin"]')) {
      const b = document.createElement('button');
      b.dataset.cp = 'admin'; b.title = 'Что можно игрокам'; b.textContent = 'Права';
      row.insertBefore(b, row.querySelector('[data-cp="restart"]'));
      b.addEventListener('click', e => { e.stopPropagation(); coopAdminOpen(); });
    }
  };
}

// Статистика реальных игроков (только хосту): кто, сколько раз, сколько часов
function coopStatsShow(x, server) {
  coopCss();
  document.getElementById('cp-stats')?.remove();
  const esc = coopEsc;
  const dt = t => (t ? new Date(t).toLocaleString(I18N.locale(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
  const cls = (Coop.meta && Coop.meta.classes) || {};
  const box = document.createElement('div');
  box.id = 'cp-stats'; box.className = 'cp-modal';
  box.innerHTML = `<div class="cp-card" style="text-align:left;width:min(640px,94vw)"><h2 style="text-align:center">Статистика деревни</h2>
    <p>Игроков всего: <b>${esc(x.players)}</b> · за неделю: <b>${esc(x.activeWeek)}</b> · сегодня: <b>${esc(x.today.players)}</b> (входов ${esc(x.today.logins)}) · сейчас: <b>${esc(x.onlineNow)}</b><br>
    Пик онлайна: <b>${esc(x.peak.n)}</b> (${esc(dt(x.peak.at))}) · наиграно всего: <b>${esc(x.totalHours)} ч</b> · ведётся с ${dt(x.since)} · сервер ${esc(server)}</p>
    <table style="width:100%;font-size:12px;border-collapse:collapse"><tr style="color:#f6d458"><th align="left">Игрок</th><th>Класс</th><th>Входов</th><th>Часов</th><th>Последний вход</th></tr>
    ${x.list.map(p => `<tr><td>${p.online ? '● ' : ''}${esc(p.nick)}</td><td align="center">${esc((cls[p.cls] || {}).name || p.cls || '')}</td><td align="center">${esc(p.logins)}</td><td align="center">${esc(p.hours)}</td><td align="center">${esc(dt(p.last))}</td></tr>`).join('')}</table>
    <p style="margin-top:10px">По дням: ${esc(x.days.slice(0, 7).map(d => `${String(d.day).slice(5)} — ${d.players} игр., ${d.logins} вх., пик ${d.peak}`).join(' · ') || '—')}</p>
    <div style="text-align:center"><button class="cp-btn" data-close>Закрыть</button></div></div>`;
  document.body.appendChild(box);
  box.addEventListener('click', e => { if (e.target.closest('[data-close]') || e.target === box) box.remove(); });
}
